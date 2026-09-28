// Interference — moiré from two overlaid sheets of fine lines, rendered
// analytically.
//
// Two "transparent sheets" of black lines are stacked over a white light and
// multiplied together. Each sheet is a set of concentric circles around a
// centre that can sit anywhere, including thousands of units off stage: far
// away, its circles are a Riley-style current of near-parallel lines (with a
// travelling wave laid on them); brought close, they are rings. One geometry
// therefore morphs continuously from Currents to Rings and back, with every
// line crisp all the way, instead of cross-fading two images into mush.
//
// The two sheets are near twins, so where they fall in and out of step they
// make large, slow secondary fringes. Moiré is a lever: sliding one sheet by a
// fraction of a line spacing sweeps its fringes across the stage, so the music
// only ever nudges phases and the interference does the amplifying.
//
// Craft notes:
// - Each sheet is a phase field phi(x) in cycles; its lines are a pulse train
//   in phi, box-filtered exactly over the pixel's footprint in phi (the
//   integral of the pulse train, footprint from dFdx/dFdy). Lines are crisp
//   and antialiased, and wherever a period would fall below ~5 device pixels
//   the pattern fades to its mean grey instead of beating against the pixel
//   grid (or a projector's rescaler), which would add moiré we did not draw.
// - Coverage is combined in linear light and encoded to sRGB once, so thin
//   lines keep their weight and the fringes' grey ramps do not band.
// - The only colour is an accent laid on the fringe cores, computed from the
//   difference of the two phases: colour lives in the interference, never on
//   a line.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;        // device pixels
uniform float unitPx;     // device pixels per virtual unit
uniform float period;     // line spacing, virtual units
uniform float weight;     // line width as a fraction of the period
uniform vec2  dir;        // unit vector from the anchor toward both centres
uniform vec2  anchor;     // the on-stage point the geometry hangs from
uniform float dist;       // how far the centres are from the anchor
uniform vec2  offs;       // each sheet's centre offset across dir (1, 2)
uniform vec2  ph;         // sheet phases, cycles
uniform float detune;     // sheet 2 spacing = period * (1 + detune)
uniform vec4  wave1, wave2; // amplitude, wavelength, phase, second-swell phase
uniform vec2  petal;      // sheet 2's spiral swell: amplitude (units), turn
uniform float xorMix;     // 0 = overlay (multiply), 1 = exclusion (XOR)
uniform float accent;     // accent strength on fringe cores
uniform vec3  accentCol;  // linear RGB
uniform vec3  paper;      // linear RGB of the light behind the sheets
uniform float echo[96];   // the music's recent past, newest first, one per frame
uniform float echoSpeed;  // virtual units per sample the echo travels outward
uniform float echoGain;   // cycles of phase per unit of echo
out vec4 outColor;

// Box-filtered pulse train: 1 on lines of width w (cycles) centred on every
// integer of x, averaged over a footprint f (cycles). I(x) is the pulse
// train's integral, so the average is exact at any footprint.
float lines(float x, float w, float f) {
  x += 0.5 * w;
  f = max(f, 1e-4);
  float a = x - 0.5 * f, b = x + 0.5 * f;
  float Ia = floor(a) * w + min(fract(a), w);
  float Ib = floor(b) * w + min(fract(b), w);
  float c = (Ib - Ia) / f;
  // A footprint of 0.2 cycles is a 5-pixel period. Below that, moving
  // black-and-white lines strobe once anything resamples them, so fade to the
  // grey the eye would average them to anyway.
  return mix(c, w, smoothstep(0.2, 0.34, f));
}

float coverage(float phi, float w) {
  return lines(phi, w, length(vec2(dFdx(phi), dFdy(phi))));
}

// The music as it was d units ago: the echo travels outward at echoSpeed.
float heard(float d) {
  float i = clamp(d / echoSpeed, 0.0, 94.0);
  int k = int(i);
  return mix(echo[k], echo[k + 1], i - float(k));
}

// Signed radial distance from a centre at anchor + dir*dist + perp*o, minus
// dist. Written as (|q|^2 - 2 dist dir.q) / (|p-c| + dist) because the naive
// |p-c| - dist cancels catastrophically in float32 when dist is 20,000 units.
// Far away this is -dir.q: straight lines. Near, it is the radius: rings.
float sheetDist(vec2 p, vec2 perp, float o, out float r) {
  vec2 q = p - anchor - perp * o;
  float qd = dot(dir, q);
  r = length(q - dir * dist);
  return (dot(q, q) - 2.0 * dist * qd) / (r + dist);
}

float swell(float along, vec4 wv) {
  // Two incommensurate swells, so the waves change shape as they drift
  // rather than repeating as one sine.
  return wv.x * (sin(along / wv.y + wv.z) + 0.45 * sin(along / (wv.y * 0.37) + wv.w));
}

void main() {
  // Virtual units, origin at stage centre, y up.
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec2 perp = vec2(-dir.y, dir.x);
  float along = dot(p, perp);

  float r1, r2;
  float d1 = sheetDist(p, perp, offs.x, r1);
  float d2 = sheetDist(p, perp, offs.y, r2);

  // Sheet 2 carries the music: each kick leaves as a ripple of phase from its
  // centre (or, while the centre is far off, from the line through the
  // anchor). The lines move by a pixel or two; the fringes swing wide.
  float echo2 = heard(abs(d2));

  // Spiral swell on sheet 2, only meaningful as rings: an angle-only swell
  // merely slides a fan's spokes around, the radial term makes them curl.
  vec2 c2 = anchor + dir * dist + perp * offs.y;
  vec2 v2 = p - c2;
  float spiral = petal.x * sin(3.0 * atan(v2.y, v2.x) + r2 / 140.0 + petal.y) * min(1.0, r2 / 80.0);

  float phi1 = (d1 + swell(along, wave1)) / period - ph.x;
  float phi2 = (d2 + swell(along, wave2) + spiral) / (period * (1.0 + detune)) - ph.y
             - echoGain * echo2;

  float l1 = coverage(phi1, weight);
  float l2 = coverage(phi2, weight);
  float over = (1.0 - l1) * (1.0 - l2);      // light through both sheets' gaps
  float ex = l1 + l2 - 2.0 * l1 * l2;        // each sheet flips the other: XOR
  float v = mix(over, ex, xorMix);

  // Fringe cores: where the sheets are exactly in step (out of step for
  // exclusion, whose bright fringes are there). The accent shows only where a
  // ripple of the echo is passing, so it travels out along the fringes on
  // each kick and is gone in quiet passages; and only where the phase
  // difference has a gradient, since a flat stretch makes a stain, not a line.
  float dphi = phi1 - phi2;
  float beat = 0.5 + 0.5 * cos(6.2831853 * dphi + 3.1415927 * xorMix);
  float core = smoothstep(0.93, 1.0, beat) * clamp(echo2 * 1.6, 0.0, 1.0);
  core *= smoothstep(0.004, 0.012, fwidth(dphi));
  vec3 col = mix(paper, accentCol, clamp(core * accent * 2.0, 0.0, 1.0));

  outColor = vec4(pow(col * v, vec3(1.0 / 2.2)), 1.0);
}`;

  // sRGB hex to linear, for uniforms that the shader re-encodes.
  function linHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }

  const PAPER = linHex('#ecebe6');     // warm off-white: pure white glares on a projector
  const ACCENT = linHex('#ff4a1f');    // one vermilion, used only on fringe cores
  const ECHO_LEN = 96;                 // must match echo[] in the shader
  const FAR = 20000;                   // centre distance at which rings read as a current
  const MIN_PERIOD_PX = 5;             // never draw a line period tighter than this

  // Frame-rate independent one-pole smoothing, rate in 1/s.
  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }

  VIZ.register({
    id: 'interference',
    name: 'Interference',
    order: 106,

    params: [
      { key: 'families', label: 'Composition', type: 'select',
        options: ['Wander', 'Currents', 'Rings'], default: 0 },
      { key: 'spacing', label: 'Line spacing', type: 'range', min: 6, max: 14, default: 7, step: 0.1 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.15, max: 0.75, default: 0.5, step: 0.01 },
      { key: 'blend', label: 'Blend', type: 'select', options: ['Overlay', 'Exclusion'], default: 0 },
      { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'push', label: 'Music push', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'current', label: 'Waviness', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'accent', label: 'Accent', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'Re-seed', run() { this.reseed(); } },
    ],

    gallery: {
      title: 'Interference',
      technique: 'WebGL2 fragment shader: two analytic line sheets (circles around centres that travel from 20,000 units away to on stage, so currents morph into rings), box-filtered per pixel and multiplied like stacked transparencies',
      brief: 'Black-and-white op-art moiré. Two near-identical sheets of wavy lines drift over each other and the large fringes where they fall in and out of step sweep, bloom and fold; over about a minute and a half the sheets\' centres come in from far away, the current bends into great arcs and then rings, and goes back. The kick leaves one sheet as a ripple of phase, a pixel of line movement that the moiré magnifies into fringes swinging across the stage; the pad pulls the twin waves out of phase so the fringes fold in the breakdown; hats tighten the detune. One vermilion accent lives only on the fringe cores the ripples pass through.',
      lineage: [
        'Brief 06 (Riley, Molnár): two or three line families overlaid, music moving the interference rather than the lines.',
        'First pass multiplied three families at once (two ring sets and a wavy current): at a 6-unit spacing it read as textured noise, and the big fringes that make moiré hypnotic were lost. Rule taken: only near-twin sheets make legible fringes, so show pairs.',
        'Split into compositions of pairs: Rings (then the default), Currents, Rings × current.',
        'Music as an echo: the kick envelope is kept as a 1.6 s history and read at distance / speed, so each beat leaves one sheet as a ripple of phase. A pixel of line movement becomes a fringe swinging across the stage.',
        'Accent moved from every in-step core (a pink wash) to cores the echo is passing through, at full vermilion and only where the phase difference has a gradient: thin red threads that travel outward in the drop and vanish in the breakdown.',
        'Critic round 1: Rings was a single starburst knot in every tile (the textbook two-ring moiré, near the centred-shape rejection); Currents filled the stage and read as Riley; Rings × current was pixel-scale texture.',
        'Revision: one geometry for both. Each sheet is circles around a centre whose distance is interpolated logarithmically from 20,000 units (a current) to near the stage (rings), so the default Wander morphs currents → great arcs → rings off the edge of the frame and back over ~90 s with every line crisp; Rings × current removed.',
        'Breakdown fringes were straight bands because the pad swelled both waves alike; it now also pulls them out of phase, which folds the fringes.',
        'Anti-strobe: spacing minimum raised to 6, the period is clamped to at least 5 device pixels, and the antialiasing fades lines to grey from a 5-pixel period down.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    reseed() {
      const r = Math.random;
      this.seed = {
        ax: r() * 100, ay: r() * 100, bx: r() * 100, by: r() * 100,
        ang: r() * Math.PI * 2, wave: r() * 100, det: r() * 100, dw: r() * 100,
      };
    },

    setup() {
      this.reseed();
    },

    enter() {
      this.reseed();
      this.clock = 0;           // drift clock: seconds scaled by Drift
      this.lastMs = null;
      this.ph = [0, 0];
      this.env = { bass: 0, kick: 0, mid: 0, high: 0 };
      this.echo = new Float32Array(ECHO_LEN);
      this.morph = null;        // 0 = current, 1 = rings
      this.near = null;         // centre distance at morph 1
      this.xorMix = null;
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      const u = {};
      for (const name of ['res', 'unitPx', 'period', 'weight', 'dir', 'anchor', 'dist', 'offs', 'ph',
        'detune', 'wave1', 'wave2', 'petal', 'xorMix', 'accent', 'accentCol', 'paper',
        'echo', 'echoSpeed', 'echoGain']) {
        u[name] = gl.getUniformLocation(prog, name);
      }
      gl.uniform3fv(u.accentCol, ACCENT);
      gl.uniform3fv(u.paper, PAPER);
      this.gl = gl;
      this.glCanvas = c;
      this.u = u;
    },

    // Smoothed band energies (0–1). The kick envelope has a fast attack and a
    // quick release so each beat becomes one soft-edged ripple; the others are
    // slow, section-level levels.
    listen(signals, dt) {
      const e = this.env;
      const bass = (signals[0] + signals[1]) / 200;
      const mid = (signals[2] + signals[3] + signals[4]) / 300;
      const high = (signals[6] + signals[7] + signals[8]) / 300;
      e.kick = ease(e.kick, bass, bass > e.kick ? 18 : 6, dt);
      e.bass = ease(e.bass, bass, 1.2, dt);
      e.mid = ease(e.mid, mid, 0.8, dt);
      e.high = ease(e.high, high, 2, dt);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.listen(signals, dt);
      const e = this.env;
      const push = params.push;
      const s = this.seed;
      const mode = params.families | 0;

      // The echo line: newest sample first. It is what makes the music
      // travel through the pattern instead of flashing on it.
      this.echo.copyWithin(1, 0, ECHO_LEN - 1);
      this.echo[0] = e.kick * e.kick;

      // Everything that should never repeat runs on one drift clock with
      // incommensurate rates, so the configuration wanders instead of looping.
      this.clock += dt * params.drift;
      const T = this.clock;
      const sn = (rate, off) => Math.sin(T * rate + off);

      // Morph between current (0) and rings (1). Wander holds the current for
      // the opening, then spends a ~170 s cycle bending it through great arcs
      // into rings and back; the ends dwell, the passage takes 60-90 s.
      let target;
      if (mode === 1) target = 0;
      else if (mode === 2) target = 1;
      else {
        const c = 0.5 - 0.5 * Math.cos((2 * Math.PI * T) / 170);
        target = 0.3 + 0.7 * c * c * (3 - 2 * c);
      }
      this.morph = this.morph === null ? target : ease(this.morph, target, 0.5, dt);
      const m = this.morph;

      // Where the rings end up. In Wander their centres stop a good way off
      // the anchor, so the knot where the fan converges sits near or beyond
      // the frame's edge and the stage is filled by arcs, never a centred
      // starburst. The Rings composition brings them on stage for performers
      // who want that.
      const nearTarget = mode === 2 ? 1 : 0.42 * Math.max(ctx.width, ctx.height);
      this.near = this.near === null ? nearTarget : ease(this.near, nearTarget, 0.5, dt);
      // Logarithmic, so the approach from far away takes as long as the last
      // few hundred units, where all the visible change happens.
      const dist = FAR * Math.pow(this.near / FAR, m);

      const anchor = [0.16 * ctx.width * sn(0.031, s.ax), 0.16 * ctx.height * sn(0.043, s.ay)];
      const ang = s.ang + 0.5 * sn(0.013, s.by) + T * 0.012;
      const dir = [Math.cos(ang), Math.sin(ang)];

      // The sheets' centres sit either side of dir. Far off, their spread
      // is an angle between two near-parallel currents; near, it is the
      // distance between ring centres, which sets how many fringes radiate.
      const tilt = 0.004 + 0.012 * (0.5 + 0.5 * sn(0.037, s.dw));
      const ringSep = 14 + 50 * Math.pow(0.5 + 0.5 * sn(0.057, s.bx), 1.5);
      const spread = Math.max(tilt * dist, ringSep * m);

      // Phases: moiré magnifies them, so they are the whole of the motion.
      // Sheet 2 integrates the bass level, so the drop sets its fringes
      // flowing; sheet 1 creeps on its own so the pattern never stalls.
      this.ph[0] += dt * 0.045 * params.drift;
      this.ph[1] += dt * (0.02 * params.drift + push * 0.33 * e.bass);

      // A small spacing difference adds broad beat bands; hats tighten it.
      const detune = 0.012 * sn(0.029, s.det) + push * 0.01 * e.high;

      // Waves on the current: near twins that drift apart and back, since
      // the fringes map the difference between them. The pad swells both.
      // They ease off as the sheets become rings, where the spiral takes over.
      const amp = params.current * (1 - 0.75 * m) * (14 + 14 * (0.5 + 0.5 * sn(0.023, s.wave)) + push * 30 * e.mid);
      const lam = 110 + 30 * sn(0.017, s.wave * 2);
      const wz = T * 0.18 + s.wave;
      const wave1 = [amp, lam, wz, -wz * 1.3 + 1.3];
      const wave2 = [amp * (0.8 + 0.2 * sn(0.05, s.dw)), lam * 1.03,
        // The pad also pulls the twins' waves out of phase, which is what
        // bends the fringes: swelling both alike would leave them straight.
        wz + 0.5 * sn(0.041, s.dw * 2) + push * 0.9 * e.mid, -wz * 1.3 + 1.3 + 0.6 * sn(0.033, s.dw)];
      const petalAmp = m * params.current * (4 + push * 30 * e.mid);

      const xt = (params.blend | 0) === 1 ? 1 : 0;
      this.xorMix = this.xorMix === null ? xt : ease(this.xorMix, xt, 1.5, dt);

      // ---- render
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke();
        p.fill(236);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text('Interference needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const unitPx = Math.min(w, h) / 600;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, unitPx);
      // On a small canvas the virtual spacing would fall under the strobe
      // threshold, so the floor is in device pixels, not virtual units.
      gl.uniform1f(u.period, Math.max(params.spacing, MIN_PERIOD_PX / unitPx));
      gl.uniform1f(u.weight, params.weight);
      gl.uniform2f(u.dir, dir[0], dir[1]);
      gl.uniform2f(u.anchor, anchor[0], anchor[1]);
      gl.uniform1f(u.dist, dist);
      gl.uniform2f(u.offs, spread * 0.5, -spread * 0.5);
      // Phases go in modulo 1: float32 fract() loses fine phase as they grow.
      gl.uniform2f(u.ph, this.ph[0] % 1, this.ph[1] % 1);
      gl.uniform1f(u.detune, detune);
      gl.uniform4fv(u.wave1, wave1);
      gl.uniform4fv(u.wave2, wave2);
      gl.uniform2f(u.petal, petalAmp, T * 0.09 + s.ang);
      gl.uniform1f(u.xorMix, this.xorMix);
      gl.uniform1f(u.accent, params.accent);
      gl.uniform1fv(u.echo, this.echo);
      // ~5 units a frame: a ripple crosses the stage in about two seconds.
      gl.uniform1f(u.echoSpeed, 5.5);
      gl.uniform1f(u.echoGain, push * 0.45);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
