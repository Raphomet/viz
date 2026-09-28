// Moiré Weave — two sheets of Jags zigzags laid over each other, one hearing
// the music now and one hearing it a beat late, so the moiré between them is
// the difference between the music now and the music a beat ago.
//
// Interference taught that moiré is a lever: two near-identical line sheets
// make broad, slow fringes, and moving one sheet by a pixel swings those
// fringes across the stage. Raph's 2016 Jags gave the line: a zigzag across a
// turning stage whose tooth height follows a band. Here both sheets are Jags
// sheets with the same rule. Sheet A reads the music as it is; sheet B reads
// the same music delayed by Memory (default one beat) and blurred over half
// that, like a player half a beat behind the band. Where the two agree the
// sheets are twins, a hair apart in spacing, and only broad, slow fringes
// running along the lines remain; wherever they disagree, the teeth differ in
// height or the lines in place, and the fringes kink into chevrons or crease.
// So a steady groove settles, and every transient, section change and rising
// build shows in the weave.
//
// The music does not land everywhere at once. Both sheets read a history of
// the track by distance from a seam across the lines: a kick leaves the seam
// as two fronts running along the lines like a shuttle, raising sheet A's
// teeth and shifting its lines a fraction of a line, with sheet B's blurred
// echo a beat behind; the fronts fade as they travel, so the beat lands as a
// set of sharp creases at the seam that ripple outward. The clap sends a
// different front: it slides sheet A's teeth along the line (combing the
// weave) rather than raising them. Hats lay a fine ripple on sheet A and
// straighten sines into jags. Bass slides the sheets past each other, so the
// broad fringes march. The drop turns overlay into exclusion, which also
// travels out from the seam: the fringes become broad cream-and-black folds,
// like satin, and the breakdown folds them back into lines.
//
// One line of sheet A is vermilion: the only colour. It is a thread of the
// weave, so it carries every front that passes as a leap in its teeth.
//
// Craft, after Interference: each sheet is a phase field whose lines are a
// pulse train box-filtered over the pixel footprint (crisp and antialiased,
// fading to grey below a 5-pixel period instead of beating against the pixel
// grid); coverage is combined in linear light and encoded once.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D hist;   // x = age in 1/60 s samples; row 0 rgba = kick A, clap A, kick B, clap B;
                          // row 1 r = overlay-to-exclusion
uniform vec2  res;        // device pixels
uniform float unitPx;     // device pixels per virtual unit
uniform float period;     // line spacing, virtual units
uniform float weight;     // line width, fraction of the period
uniform float rot;        // stage rotation
uniform float rel;        // sheet B's turn relative to sheet A
uniform float detune;     // sheet B's spacing = period * (1 + detune)
uniform vec2  ph;         // sheet phases in lines (A kept modulo threadN, B modulo 1)
uniform vec2  amp;        // base tooth height, sheets A and B
uniform float seg;        // half-tooth length (Jags' segmentLength)
uniform float sharp;      // 0 = sine, 1 = Jags' straight zigzag
uniform vec2  tph;        // tooth phase drift along the line, cycles, A and B
uniform float seam;       // where the fronts leave from, along the line
uniform float perSample;  // units a front travels per history sample
uniform vec3  gain;       // kick: extra tooth height (units); clap: tooth slide (cycles); kick: line shift (cycles)
uniform vec2  hat;        // hat ripple: amplitude (units), phase
uniform vec3  paper;      // linear RGB
uniform vec3  ink;
uniform vec3  verm;
uniform vec2  thread;     // index of the vermilion line, its strength
uniform float threadN;    // lines between repeats of the thread (one visible at a time)
out vec4 outColor;

// Box-filtered pulse train: lines of width w (cycles) centred on integers of
// x, averaged exactly over a footprint f (cycles) through the train's integral.
float lines(float x, float w, float f) {
  x += 0.5 * w;
  f = max(f, 1e-4);
  float a = x - 0.5 * f, b = x + 0.5 * f;
  float Ia = floor(a) * w + min(fract(a), w);
  float Ib = floor(b) * w + min(fract(b), w);
  float c = (Ib - Ia) / f;
  // A 0.2-cycle footprint is a 5-pixel period: tighter than that, moving
  // lines strobe once anything resamples them, so fade to their mean grey.
  return mix(c, w, smoothstep(0.2, 0.34, f));
}

vec4 heard(float d, int row) {
  float i = clamp(d / perSample, 0.0, 510.0);
  int k = int(i);
  vec4 a = texelFetch(hist, ivec2(k, row), 0);
  vec4 b = texelFetch(hist, ivec2(k + 1, row), 0);
  return mix(a, b, i - float(k));
}

// Jags' zigzag, t in teeth: +1 at vertex 0, -1 at vertex 1. The sine is the
// calm reading ("TODO: modes: jags, sines" in the original).
float zig(float t) {
  float tri = 4.0 * abs(fract(t) - 0.5) - 1.0;
  return mix(cos(6.2831853 * t), tri, sharp);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  float c = cos(rot), s = sin(rot);
  vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);   // sheet A: u along the lines
  float cr = cos(rot + rel), sr = sin(rot + rel);
  // Detune only across the lines: stretching B along them too would drift
  // its teeth out of step with A's, a phase error that grows with distance
  // and broke the stage into blotches.
  vec2 qb = vec2(cr * p.x + sr * p.y, (-sr * p.x + cr * p.y) / (1.0 + detune));

  // Fronts run outward along the lines from the seam, both ways.
  float dSeam = abs(q.x - seam);
  // Fronts fade as they travel, so the beat lands at the seam and ripples
  // out, rather than keeping half a dozen full-strength fronts churning the
  // whole stage at once in the drop (the first drop measured 70% of the
  // frame moving every beat).
  vec4 h = heard(dSeam, 0) * (1.0 / (1.0 + dSeam / 160.0));

  float teeth = 2.0 * seg;
  float hA = amp.x + gain.x * h.r;
  float hB = amp.y + gain.x * h.b;
  float dispA = hA * zig(q.x / teeth + tph.x + gain.y * h.g)
              + hat.x * sin(q.x / (seg * 0.19) + hat.y) * sin(q.x / (seg * 0.53) - 0.7 * hat.y);
  float dispB = hB * zig(qb.x / teeth + tph.y + gain.y * h.a);

  // The kick also shifts each sheet's lines by a fraction of a line as its
  // front passes. A pixel of movement, but half a cycle of it turns the
  // broad fringes dark-for-light inside the front, which is what makes the
  // beat legible from across a room.
  float phiA = (q.y + dispA) / period - ph.x - gain.z * h.r;
  float phiB = (qb.y + dispB) / period - ph.y - gain.z * h.b;

  float fA = length(vec2(dFdx(phiA), dFdy(phiA)));
  float fB = length(vec2(dFdx(phiB), dFdy(phiB)));
  float lA = lines(phiA, weight, fA);
  float lB = lines(phiB, weight, fB);
  float over = (1.0 - lA) * (1.0 - lB);
  float ex = lA + lB - 2.0 * lA * lB;
  // Overlay to exclusion also leaves from the seam, so the drop spreads out
  // across the weave as a front. Halfway between the two the fringes cancel
  // to a flat grey, so the crossing is kept to a narrow band.
  float xorMix = smoothstep(0.3, 0.7, heard(dSeam, 1).r);
  float v = mix(over, ex, xorMix);

  // A little paper falloff toward the corners: the sheet under a lamp.
  vec2 uv = gl_FragCoord.xy / res - 0.5;
  float lamp = 1.0 - 0.22 * dot(uv, uv);
  vec3 col = mix(ink, paper * lamp, v);

  // The vermilion thread: one line of sheet A, painted over the weave.
  float n = floor(phiA + 0.5);
  float k = n - thread.x;
  k -= threadN * floor(k / threadN + 0.5);
  if (abs(k) < 0.5 && thread.y > 0.0) {
    float t = lines(phiA, min(0.85, weight * 1.5), fA);
    col = mix(col, verm, t * thread.y);
  }

  outColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

  function linHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }

  const PAPER = linHex('#efe9da');   // cream: pure white glares on a projector
  const INK = linHex('#161412');     // warm black
  const VERM = linHex('#e2401b');    // the one vermilion thread
  const HLEN = 512;                  // history samples, 1/60 s each: must match the shader's clamp
  const STEP = 1 / 60;
  const FRONT = 300;                 // units per second a front travels along the lines
  const MIN_PERIOD_PX = 5;
  const THREAD_N = 240;              // lines between thread repeats: more than a stage diagonal
  const BEAT = 60 / 124;             // core's beat outside Demo

  const PRESETS = {
    calm: { height: 0.55, sharp: 0.25, flow: 0.6, weight: 0.45, weave: 0, push: 1, tooth: 40 },
    // Exclusion: each sheet flips the other, so the fringes become broad
    // cream-and-black folds, like satin, where overlay only darkens.
    drop: { height: 1, sharp: 1, flow: 1.6, weight: 0.5, weave: 1, push: 1.6, tooth: 60 },
    // Overlay at full height: the teeth's flanks line up across the lines
    // into Jags' herringbone, with the fringes riding along them.
    herringbone: { height: 1.2, sharp: 1, flow: 1.4, weight: 0.5, weave: 0, push: 1.5, tooth: 45 },
    // Long memory: sheet B two beats behind, so whole bars disagree.
    echo: { height: 0.8, sharp: 0.6, flow: 0.9, memory: 2, push: 1.3, tooth: 50 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['height', 'sharp', 'flow', 'weight', 'weave', 'push', 'tooth'];

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  VIZ.register({
    id: 'moireweave',
    name: 'Moiré Weave',
    order: 802,

    params: [
      { key: 'height', label: 'Tooth height', type: 'range', min: 0, max: 2, default: PRESETS.calm.height, step: 0.01 },
      { key: 'sharp', label: 'Sines to jags', type: 'range', min: 0, max: 1, default: PRESETS.calm.sharp, step: 0.01 },
      { key: 'flow', label: 'Flow', type: 'range', min: 0, max: 3, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.2, max: 0.7, default: PRESETS.calm.weight, step: 0.01 },
      { key: 'weave', label: 'Overlay to exclusion', type: 'range', min: 0, max: 1, default: PRESETS.calm.weave, step: 0.01 },
      { key: 'push', label: 'Music push', type: 'range', min: 0, max: 3, default: PRESETS.calm.push, step: 0.01 },
      { key: 'memory', label: 'Memory (beats behind)', type: 'range', min: 0.25, max: 4, default: 1, step: 0.05 },
      { key: 'spacing', label: 'Line spacing', type: 'range', min: 5, max: 12, default: 7, step: 0.1 },
      { key: 'tooth', label: 'Tooth length', type: 'range', min: 20, max: 90, default: PRESETS.calm.tooth, step: 1 },
      { key: 'speed', legacy: 'SPEED', label: 'Rotation speed', type: 'range', min: -10, max: 10, default: 0.4, step: 0.01 },
      { key: 'thread', label: 'Vermilion thread', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Moiré Weave',
      technique: 'WebGL2 fragment shader: two analytic sheets of Jags zigzag lines (sine-to-triangle morph), box-filtered per pixel and multiplied like stacked transparencies; each sheet\'s tooth height and tooth slide are read from a 60 Hz history texture by distance from a seam, sheet B from a copy delayed by one beat and blurred; one line of sheet A drawn in vermilion; a section follower easing between calm and drop presets',
      brief: 'Black on cream. Two sheets of Raph\'s zigzag lines lie over each other, a hair apart, one hearing the music now and one a beat late, so the moiré is the difference between the music now and a beat ago. In quiet passages broad, slow fringes run along the lines and march as the bass slides the sheets past each other; wherever the two readings disagree the fringes kink into chevrons. Each kick leaves a seam as two fronts running along the lines like a shuttle, so the beat lands as a set of sharp creases at the seam that ripple outward and fade; the clap sends fronts that comb the teeth sideways; rising hats straighten sines into jags through the build. The drop spreads out from the seam as the sheets switch from overlay to exclusion: the fringes turn into broad cream-and-black folds like satin, the teeth grow longer and taller and the flow quickens, and the breakdown folds it all back into lines. One vermilion thread runs through the weave and leaps with every front.',
      lineage: [
        'Batch 06, idea 2 (Purist): Interference crossed with Jags; two sheets of band-driven polylines, one a beat behind the other; black on cream with one vermilion thread.',
        'Interference (web/scenes/interference.js): analytic box-filtered line sheets, the moiré as a lever that magnifies small phase changes, the music read from a history at distance / speed.',
        'Jags (web/viz/jags.js, Raph\'s Jags.pde, 2016): the zigzag, its 40-unit segment, the band-driven tooth height, the turning stage; and the original\'s "TODO: modes: jags, sines" as Sines to jags.',
        'Distinct from Jags V2 (rows cut at a seam travelling outward as a record): here the lines never move off; the music travels along them, and the subject is the interference between two readings of it.',
        'A strict one-beat delay cancels a steady four-on-the-floor (the sheets become twins again), so sheet B is delayed and blurred over half its memory: steady states still settle, but every kick disagrees with the late sheet.',
        'Built, then revised: a relative turn between the sheets stood the fringes across the lines, parallel to the fronts, so a kick looked like one more fringe drifting by; sheet B is now detuned in spacing, which lays the fringes along the lines and lets the fronts cut across them.',
        'Tall teeth crowd a flank\'s lines under the 5-pixel floor (the first drop was flat grey), so tooth height is a fraction of tooth length; the first drop\'s six full-strength fronts also churned the whole stage every beat, so fronts now fade with distance and the level and bass drives leave the kick band out.',
        'Overlay to exclusion was a global cross-fade whose midpoint cancels to flat grey; it now travels out from the seam like the beat, with the grey confined to a narrow moving band.',
        'Presets: calm, drop (exclusion satin), herringbone (overlay at full height), echo (two beats of memory).',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.clock = 0;
      this.acc = 0;
      this.ph = [0, 0];
      this.tph = [0, 0];
      this.rot = 0;
      this.hatPh = 0;
      this.hist = new Float32Array(HLEN * 8);   // two rows
      this.levelHist = new Float32Array(HLEN);
      this.kB = 0; this.cB = 0;
      this.env = { kf: 0, ks: 0, kick: 0, cf: 0, cs: 0, clap: 0, level: 0, hat: 0, bass: 0,
        low: 0, dropOn: false, auto: 0, levelB: 0 };
      this.threadIdx = null;
      this.xorMix = null;
      const r = Math.random;
      this.seed = { a: r() * 100, b: r() * 100, c: r() * 100, d: r() * 100 };
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

      // Float history texture, read with texelFetch (float textures need no
      // filtering extension that way).
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, HLEN, 2, 0, gl.RGBA, gl.FLOAT, null);

      const u = {};
      for (const name of ['hist', 'res', 'unitPx', 'period', 'weight', 'rot', 'rel', 'detune', 'ph', 'amp',
        'seg', 'sharp', 'tph', 'seam', 'perSample', 'gain', 'hat', 'paper', 'ink', 'verm',
        'thread', 'threadN']) {
        u[name] = gl.getUniformLocation(prog, name);
      }
      gl.uniform1i(u.hist, 0);
      gl.uniform3fv(u.paper, PAPER);
      gl.uniform3fv(u.ink, INK);
      gl.uniform3fv(u.verm, VERM);
      gl.uniform1f(u.threadN, THREAD_N);
      this.gl = gl;
      this.glCanvas = c;
      this.u = u;
      this.tex = tex;
    },

    // Envelopes, 0–1. Kick and clap are onsets (fast minus slow), so the
    // drop's sidechained bass and the breakdown's pad never read as beats.
    listen(signals, dt) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp((e.kf - e.ks) * 2.2, 0, 1);
      e.kick = ease(e.kick, kOn, kOn > e.kick ? 30 : 10, dt);
      const cl = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp((e.cf - e.cs) * 3, 0, 1);
      e.clap = ease(e.clap, cOn, cOn > e.clap ? 30 : 6, dt);
      // The level leaves out the kick band and moves slowly: it sets both
      // sheets' tooth height, and a level that pumped with each kick would
      // make the late sheet disagree across the whole stage on every beat.
      e.level = ease(e.level, (signals[1] + signals[2] + signals[3]) / 300, 0.6, dt);
      // Bass sets the sheets sliding past each other. Band 0 stays out of it:
      // with the kick in, every beat surged the whole weave at once.
      e.bass = ease(e.bass, (signals[1] + signals[2]) / 200, 0.8, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 3, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    // One 1/60 s history sample. Sheet B hears the history `lag` samples
    // back, through a one-pole blur of half the lag: a strict delay would
    // make a steady beat line up with itself and vanish.
    pushSample(lag) {
      const e = this.env;
      const H = this.hist;
      H.copyWithin(4, 0, (HLEN - 1) * 4);
      H.copyWithin(HLEN * 4 + 4, HLEN * 4, HLEN * 8 - 4);
      H[HLEN * 4] = this.xorMix;
      this.levelHist.copyWithin(1, 0, HLEN - 1);
      H[0] = e.kick;
      H[1] = e.clap;
      this.levelHist[0] = e.level;
      const li = Math.min(HLEN - 1, Math.round(lag));
      const a = 1 - Math.exp(-STEP / Math.max(0.05, lag * STEP * 0.5));
      this.kB += (H[li * 4] - this.kB) * a;
      this.cB += (H[li * 4 + 1] - this.cB) * a;
      H[2] = this.kB;
      H[3] = this.cB;
      e.levelB += (this.levelHist[li] - e.levelB) * a;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.listen(signals, dt);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.5, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      this.xorMix = this.xorMix === null ? P.weave : ease(this.xorMix, P.weave, 1.5, dt);
      const lag = (params.memory * BEAT) / STEP;
      this.acc += dt;
      while (this.acc >= STEP) { this.acc -= STEP; this.pushSample(lag); }

      this.clock += dt;
      const T = this.clock;
      const sd = this.seed;
      const sn = (rate, off) => Math.sin(T * rate + off);

      // Phases in lines. The sheets creep together; bass slides B past A,
      // which is what sets the broad fringes marching.
      this.ph[0] += dt * 0.06 * P.flow;
      this.ph[1] += dt * (0.06 * P.flow + P.flow * (0.04 + 0.1 * P.push * e.bass));
      this.tph[0] += dt * 0.012 * P.flow;
      this.tph[1] += dt * 0.012 * P.flow;
      this.hatPh += dt * (2 + 6 * e.hat);
      this.rot += (params.speed / 1000) * 60 * dt;

      // Sheet B is a touch wider-spaced than A, so the broad fringes run
      // along the lines, beside the thread. A relative turn would stand them
      // across the lines instead, parallel to the fronts, and then a kick
      // front looks like one more fringe drifting by (the first version's
      // kicks vanished that way). The small turn that is left only leans them.
      const rel = 0.005 * sn(0.047, sd.a) + 0.002 * sn(0.11, sd.b);
      const detune = 0.03 + 0.014 * sn(0.031, sd.c);
      const seam = 0.2 * ctx.width * sn(0.023, sd.d);

      // Tooth height is a fraction of the tooth length, not units: the
      // steeper a flank, the closer its lines crowd, and past a slope of ~1.5
      // they fall under the 5-pixel floor and fade to grey (the first drop
      // render was a flat grey field for exactly that reason).
      const seg = P.tooth;
      const base = seg * P.height * (0.1 + 0.3 * e.level);
      const baseB = seg * P.height * (0.1 + 0.3 * e.levelB);

      // ---- render
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(20);
        p.noStroke();
        p.fill(236);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text('Moiré Weave needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const unitPx = Math.min(w, h) / 600;
      const period = Math.max(params.spacing, MIN_PERIOD_PX / unitPx);
      if (this.threadIdx === null) {
        // Start the thread a third of the way up the stage: line n sits at
        // v = (n + phA) * period.
        this.threadIdx = Math.round(-0.18 * ctx.height / period - this.ph[0]);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HLEN, 2, gl.RGBA, gl.FLOAT, this.hist);

      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, unitPx);
      gl.uniform1f(u.period, period);
      gl.uniform1f(u.weight, P.weight);
      gl.uniform1f(u.rot, this.rot + 0.35 + 0.08 * sn(0.019, sd.b));
      gl.uniform1f(u.rel, rel);
      gl.uniform1f(u.detune, detune);
      gl.uniform2f(u.ph, this.ph[0] % THREAD_N, this.ph[1] % 1);
      gl.uniform2f(u.amp, base, baseB);
      gl.uniform1f(u.seg, seg);
      // Rising hats straighten the sines toward jags, so the build visibly
      // sharpens before the drop lands (Jags' own "modes: jags, sines").
      gl.uniform1f(u.sharp, P.sharp + (1 - P.sharp) * clamp(e.hat * 1.8, 0, 0.8));
      gl.uniform2f(u.tph, this.tph[0] % 1, this.tph[1] % 1);
      gl.uniform1f(u.seam, seam);
      gl.uniform1f(u.perSample, FRONT * STEP);
      gl.uniform3f(u.gain, seg * P.push * 0.06, P.push * 0.035, P.push * 0.2);
      gl.uniform2f(u.hat, P.push * 2.2 * e.hat, this.hatPh);
      gl.uniform2f(u.thread, this.threadIdx, params.thread);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
