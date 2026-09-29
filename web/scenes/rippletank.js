// Ripple Tank — the school physics demonstration, seen from above in the dark.
//
// A shallow tank of black water with a lamp over it. Flat water sends the
// light straight down onto a black floor and reflects nothing toward us, so a
// still tank is simply black: only ripples show. Where the surface curves it
// focuses the lamp into bright caustic filaments on the floor, and where it
// tilts it catches one of two low lamps at the rim, so every wave has a lit
// flank and a dark one.
//
// The water is a real simulation: the 2D wave equation on a capped grid
// (240 cells on the short side, whatever the screen), leapfrog-integrated on
// the GPU in float32, with a sponge at the walls and a shallow glass plate
// (a region where the waves travel slower) that refracts them the way a lens
// bends light. Nothing is drawn as a ring; every ring, interference fringe,
// reflection and focus comes out of the physics.
//
// Rendering evaluates the height field with a cubic B-spline over 4x4 cells,
// which gives continuous first and second derivatives at screen resolution:
// the slopes light the surface, and the Hessian gives the caustic intensity
// 1/det(I + k H) (how much the curved surface squeezes the light), so the
// filaments are smooth instead of showing the grid.
//
// Music:
// - Kick: one drop, from a drip that wanders slowly over the tank, so
//   successive rings cross each other rather than nest.
// - Snare / clap: two drops at once, at the two dippers' positions; the
//   pair of rings, in step, draws hyperbolic nodal lines as they cross.
// - Bass: the dippers' amplitude, a continuous swell.
// - Hats: drizzle, tiny drops scattered across the tank, which glint.
// - Drop: the two dippers start vibrating in earnest, so the classic
//   two-source figure (still black hyperbolas fanning between moving
//   fringes) fills the tank and sweeps as the pair turns; the warm lamp comes
//   up opposite the cool one, the plate's refraction strengthens.

(function () {
  const MAX_DROPS = 24;
  const SIM_SHORT = 240;          // sim cells on the stage's short side (the cap)
  const STEPS_PER_S = 180;        // sim steps per second, independent of frame rate
  const C = 0.5;                  // cells per step: 90 cells/s ≈ 225 units/s
  const RENDER_LONG_CAP = 1920;   // render canvas long side cap (device px)

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  // One leapfrog step of h_tt = c^2 lap h. State texel = (h now, h before).
  const SIM = `#version 300 es
precision highp float;
uniform sampler2D state;
uniform ivec2 N;
uniform float c2;          // (c dt / dx)^2 in open water
uniform vec4 lens;         // centre (cells), semi-axes (cells)
uniform vec2 lensRot;      // cos, sin of the plate's angle
uniform float lensK;       // how much slower the waves are over the plate
uniform float damp;        // per-step velocity retention in open water
uniform float sponge;      // extra loss at the walls (0 = hard reflecting walls)
uniform vec4 dip;          // two dipper positions (cells)
uniform vec2 dip3;         // third dipper
uniform vec3 dipAmp;       // forcing per step for each dipper
uniform float dipPhase;
uniform vec4 drops[${MAX_DROPS}];   // x, y (cells), amplitude, radius (cells)
uniform int dropN;
out vec4 outC;

vec2 at(ivec2 p) { return texelFetch(state, clamp(p, ivec2(0), N - 1), 0).xy; }

void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec2 p = gl_FragCoord.xy;
  vec2 s = at(ij);
  vec2 l = at(ij + ivec2(-1, 0)), r = at(ij + ivec2(1, 0));
  vec2 d = at(ij + ivec2(0, -1)), u = at(ij + ivec2(0, 1));
  float lap = l.x + r.x + d.x + u.x - 4.0 * s.x;
  // A touch of viscosity (the Laplacian of the velocity) kills the grid's
  // shortest, checkerboard waves before they alias into shimmer.
  float lapV = lap - (l.y + r.y + d.y + u.y - 4.0 * s.y);

  // The glass plate: an ellipse of shallow water, slower, so it bends waves.
  vec2 q = p - lens.xy;
  q = vec2(q.x * lensRot.x + q.y * lensRot.y, -q.x * lensRot.y + q.y * lensRot.x) / lens.zw;
  float plate = 1.0 - smoothstep(0.82, 1.0, length(q));
  float cc = c2 * (1.0 - lensK * plate);

  // Sponge: a ramp of loss over the outer 14 cells, so rings leave the tank
  // instead of reverberating into mush. Wall echo lowers it.
  float e = float(min(min(ij.x, N.x - 1 - ij.x), min(ij.y, N.y - 1 - ij.y)));
  float edge = 1.0 - smoothstep(0.0, 14.0, e);
  float k = damp * (1.0 - sponge * 0.06 * edge * edge);

  float hn = s.x + (s.x - s.y) * k + cc * lap + 0.06 * lapV;

  // Dippers: small balls driven up and down, all in phase.
  float f = sin(dipPhase);
  hn += f * (dipAmp.x * exp(-dot(p - dip.xy, p - dip.xy) / 2.2)
           + dipAmp.y * exp(-dot(p - dip.zw, p - dip.zw) / 2.2)
           + dipAmp.z * exp(-dot(p - dip3, p - dip3) / 2.2));

  // Drops: a static dent added to both time levels, so it radiates evenly.
  float dent = 0.0;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= dropN) break;
    vec4 dr = drops[i];
    vec2 v = p - dr.xy;
    dent -= dr.z * exp(-dot(v, v) / (dr.w * dr.w));
  }
  outC = vec4(hn + dent, s.x + dent, 0.0, 1.0);
}`;

  const RENDER = `#version 300 es
precision highp float;
uniform sampler2D state;
uniform ivec2 N;
uniform vec2 res;          // render px
uniform float cellU;       // virtual units per cell
uniform float gain;        // height units to slope scale
uniform float causK;       // caustic focusing depth
uniform float causGain;
uniform vec2 lampA;        // direction toward the cool lamp (sim space, unit)
uniform vec3 colA;
uniform vec3 colB;         // warm lamp, opposite side
uniform float lampB;       // warm lamp strength
uniform vec3 causCol;
uniform float paper;       // 0 black water, 1 projection on a paper screen
uniform vec3 paperCol;
uniform vec3 inkCol;
uniform float gridK;       // the faint floor grid
uniform float omega;       // dipper angular frequency, radians per sim step
uniform float waveK;       // its wavenumber, radians per cell
uniform float expo;        // amplitude to brightness
uniform float lineP;       // how thin the lamp lines are
out vec4 o;

void bsp(float t, out vec4 w, out vec4 d, out vec4 dd) {
  float t2 = t * t, t3 = t2 * t, s = 1.0 - t;
  w = vec4(s * s * s, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
  d = vec4(-0.5 * s * s, 1.5 * t2 - 2.0 * t, -1.5 * t2 + t + 0.5, 0.5 * t2);
  dd = vec4(s, 3.0 * t - 2.0, -3.0 * t + 1.0, t);
}

float gridLine(vec2 fp) {
  vec2 g = fp / 40.0;
  vec2 w = fwidth(g) * 1.2;
  vec2 a = abs(fract(g - 0.5) - 0.5) / max(w, 1e-4);
  return 1.0 - min(min(a.x, a.y), 1.0);
}

void main() {
  vec2 q = gl_FragCoord.xy * vec2(N) / res - 0.5;
  ivec2 b = ivec2(floor(q)) - 1;
  vec2 t = fract(q);
  vec4 wx, dx, ddx, wy, dy, ddy;
  bsp(t.x, wx, dx, ddx);
  bsp(t.y, wy, dy, ddy);
  float hp = 0.0, h = 0.0, hx = 0.0, hy = 0.0, hxx = 0.0, hyy = 0.0, hxy = 0.0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 sv = texelFetch(state, clamp(b + ivec2(i, j), ivec2(0), N - 1), 0).xy;
      float v = sv.x;
      hp += wx[i] * wy[j] * sv.y;
      h += wx[i] * wy[j] * v;
      hx += dx[i] * wy[j] * v;
      hy += wx[i] * dy[j] * v;
      hxx += ddx[i] * wy[j] * v;
      hyy += wx[i] * ddy[j] * v;
      hxy += dx[i] * dy[j] * v;
    }
  }
  vec2 g = vec2(hx, hy) * gain;

  // Caustics: the lamp's light through a curved surface lands squeezed or
  // spread; its intensity on the floor is 1/det of that mapping. Only the
  // squeeze (the bright filaments) shows on black.
  float K = causK * gain;
  float det = (1.0 + K * hxx) * (1.0 + K * hyy) - K * K * hxy * hxy;
  float I = 1.0 / max(abs(det), 0.035);
  float caus = max(I - 1.0, 0.0);

  // The floor seen through the water, displaced by refraction: a faint
  // engraved grid, which only bends where a ripple passes.
  vec2 fp = (q + g * 6.0) * cellU;
  float grid = gridLine(fp) * gridK * smoothstep(0.02, 0.2, length(g));

  // Rim lamps: slopes facing a lamp catch it. Flat water reflects neither.
  // A lamp is a strip light, so its reflection is a line on each crest
  // flank. Its width is set by the wave's phase and its brightness by the
  // wave's amplitude: A = sqrt(h^2 + (h_t/omega)^2) is the local amplitude
  // of a wave at the dippers' frequency whatever its phase, and slope/(A k)
  // is then the phase alone. Without this split, the 1/sqrt(r) fall-off
  // left strong lines near the sources and a grey murk beyond; with it every
  // fringe is equally crisp, and the nodal lines, where A vanishes, are
  // truly black.
  float vel = h - hp;
  float A = sqrt(h * h + vel * vel / (omega * omega));
  vec2 sn = vec2(hx, hy) / (A * waveK + 0.004);
  float sa = max(dot(-sn, lampA), 0.0);
  float sb = max(dot(sn, lampA), 0.0);
  float bright = 1.0 - exp(-A * expo);
  float la = pow(sa, lineP), lb = pow(sb, lineP);
  vec3 spec = bright * (colA * (0.12 * sa + 1.3 * la) + colB * lampB * (0.12 * sb + 1.3 * lb));

  vec3 dark = causCol * (caus * causGain + grid * (0.35 + 0.65 * min(I, 3.0)));
  dark += spec;
  dark = 1.0 - exp(-dark);                   // soft shoulder, never clips hard

  // Paper screen: what the tank projects onto a sheet beneath it, the view
  // in the textbook photographs. Bright where the light is squeezed, ink
  // where it is spread, paper where the water is flat.
  // Same phase/amplitude split as the lamps, so the far fringes print as
  // firmly as the near ones: crests focus (bright), troughs spread (ink).
  float u = clamp(h / (A + 0.004), -1.0, 1.0) * bright;
  float pv = 0.62 + 0.5 * u + 0.15 * clamp(caus, 0.0, 2.0);
  vec3 pap = mix(inkCol, paperCol, smoothstep(0.0, 0.75, pv));
  pap += vec3(0.28, 0.26, 0.22) * smoothstep(0.75, 1.15, pv);
  pap *= 1.0 - grid * 0.25;
  pap *= mix(vec3(1.0), vec3(1.0, 0.86, 0.68), lampB * 0.5 * lb);   // the warm lamp tints the bright bands
  vec3 col = mix(dark, pap, paper);
  o = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }
  const COOL = lin('#a9d4e3');      // cold key lamp
  const WARM = lin('#ff9f45').map((c) => c * 1.8);      // sodium lamp, the drop's second colour
  const CAUS = lin('#dfeef2');
  const PAPER = lin('#e9e3d4');
  const INK = lin('#26313a');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  const PRESETS = {
    // A near-still tank: faint dippers, a drip, a little drizzle, one lamp.
    calm: { dippers: 0.14, spread: 105, pitch: 0.9, third: 0, lens: 0.35, drizzle: 0.2, lamp: 0.08, walls: 0.15 },
    // The dippers in earnest, wide apart: the tank fills with hyperbolas
    // under a second, warm lamp.
    drop: { dippers: 1, spread: 165, pitch: 1.05, third: 0, lens: 0.55, drizzle: 0.4, lamp: 1, walls: 0.05 },
    // Three dippers: a hexagonal lattice of still points.
    lattice: { dippers: 0.8, spread: 200, pitch: 1.2, third: 1, lens: 0.2, drizzle: 0.3, lamp: 0.7, walls: 0.2 },
    // The textbook photograph: the projection on a paper screen.
    screen: { ground: 1, dippers: 0.7, spread: 180, pitch: 1, third: 0, lens: 0.7, drizzle: 0.3, lamp: 0.3, walls: 0.2 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['dippers', 'spread', 'pitch', 'third', 'lens', 'drizzle', 'lamp', 'walls'];

  VIZ.register({
    id: 'rippletank',
    name: 'Ripple Tank',
    order: 824,

    params: [
      { key: 'dippers', label: 'Dippers', type: 'range', min: 0, max: 1, default: PRESETS.calm.dippers, step: 0.01 },
      { key: 'spread', label: 'Dipper spacing', type: 'range', min: 40, max: 320, default: PRESETS.calm.spread, step: 1 },
      { key: 'pitch', label: 'Dipper pitch', type: 'range', min: 0.5, max: 1.6, default: PRESETS.calm.pitch, step: 0.01 },
      { key: 'third', label: 'Third dipper', type: 'range', min: 0, max: 1, default: PRESETS.calm.third, step: 0.01 },
      { key: 'lens', label: 'Glass plate', type: 'range', min: 0, max: 1, default: PRESETS.calm.lens, step: 0.01 },
      { key: 'drizzle', label: 'Drizzle', type: 'range', min: 0, max: 1, default: PRESETS.calm.drizzle, step: 0.01 },
      { key: 'lamp', label: 'Warm lamp', type: 'range', min: 0, max: 1, default: PRESETS.calm.lamp, step: 0.01 },
      { key: 'walls', label: 'Wall echo', type: 'range', min: 0, max: 1, default: PRESETS.calm.walls, step: 0.01 },
      { key: 'ground', label: 'View', type: 'select', options: ['Black water', 'Paper screen'], default: 0 },
      { key: 'react', label: 'Drop size', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'still', label: 'Still the water', run() { this.clearWater = true; } },
    ],

    gallery: {
      title: 'Ripple Tank',
      technique: 'WebGL2: the 2D wave equation leapfrog-integrated in float32 on a 240-cell-high grid (sponge walls, a slow-water glass plate that refracts, point dippers and drop impulses), rendered at screen resolution through a cubic B-spline whose Hessian gives caustic intensity 1/det(I + kH) and whose slopes catch two rim lamps',
      brief: 'Black water seen from straight above, lit so only the ripples show: a flat tank is black, every wave carries a thin cool edge from one lamp, and curving water focuses the light into filaments on the floor, over a faint grid that bends only where a ripple passes. Each kick lets one drop fall from a drip that wanders over the tank, so successive rings cross; each snare drops two at once at the dippers, and the in-step pair draws hyperbolic nodal lines as they cross. The bass swells the dippers; hats scatter drizzle that glints. The drop sets the two dippers vibrating in earnest: the textbook two-source figure of still black hyperbolas fanning between racing fringes fills the tank and sweeps as the pair slowly turns, a warm lamp comes up opposite the cool one, and a hidden glass plate bends the fronts like a lens. The breakdown lets the dippers fall quiet and the tank drains back to black.',
      lineage: [
        'Batch 06 idea 24 (Curator): Koi, Interference, Chladni. Koi already drops rain into a daylit pond with fish; Interference draws moiré analytically. This one is the physics bench: a real wave simulation in the dark, where every figure (rings, nodal hyperbolas, reflections off the walls, refraction through a shallow plate) is emergent rather than drawn.',
        'From the physics classroom ripple tank: a lamp above, dippers, a glass plate for refraction, sponge beaches at the walls, and the paper-screen projection as a second view. From Chladni: nodal lines as the subject; the stillness is what is drawn.',
        'Process (640x360 sheets): v1 lit the surface by slope alone, which gave a grey target pattern: strong lines near the sources, murk beyond, a floor grid that showed everywhere, and caustic folds (white) swamping both lamps, so the warm lamp read as brown. The fix was to split each point into amplitude and phase (A = sqrt(h^2 + (h_t/omega)^2)): the phase sets a thin lamp line on each flank, a compressed amplitude sets its brightness, so every fringe is equally crisp and the nodal hyperbolas are true black. Caustics were cut to a highlight on the strongest folds, the grid now shows only where a ripple bends it, the drop\'s dippers moved closer (fewer, broader hyperbolas) and its wall echo came down so the drop is a figure, not reverb.',
        'Jolt (640x360, seed 1): calm, kickArea 0.25, kickMean 0.047, ratio 1.07 (build 0.20, 0.95). The heat map puts each kick on one ring at the drip; the rest is the dippers\' own travelling fringes.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.acc = 0;
      this.phase = 0;
      this.turn = Math.random() * Math.PI * 2;
      this.env = { kick: 0, prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0, bass: 0,
        lvl: 0, floor: 0.12, ceil: 0.55, auto: 0, ground: null };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.pending = [];
      this.clearWater = true;
      this.seed = { a: Math.random() * 100, b: Math.random() * 100, c: Math.random() * 100 };
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const program = (fs, names) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'pos');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const u = {};
        for (const n of names) u[n] = gl.getUniformLocation(pr, n);
        return { pr, u };
      };
      this.sim = program(SIM, ['state', 'N', 'c2', 'lens', 'lensRot', 'lensK', 'damp', 'sponge',
        'dip', 'dip3', 'dipAmp', 'dipPhase', 'drops', 'dropN']);
      this.ren = program(RENDER, ['state', 'N', 'res', 'cellU', 'gain', 'causK', 'causGain', 'lampA',
        'colA', 'colB', 'lampB', 'causCol', 'paper', 'paperCol', 'inkCol', 'gridK', 'omega', 'waveK', 'expo', 'lineP']);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.gl = gl;
      this.glCanvas = c;
      this.tex = [null, null];
      this.fbo = [null, null];
      this.dropBuf = new Float32Array(MAX_DROPS * 4);
    },

    allocSim(nx, ny) {
      const gl = this.gl;
      for (let i = 0; i < 2; i++) {
        if (this.tex[i]) gl.deleteTexture(this.tex[i]);
        if (this.fbo[i]) gl.deleteFramebuffer(this.fbo[i]);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, nx, ny, 0, gl.RGBA, gl.FLOAT, null);
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        this.tex[i] = t;
        this.fbo[i] = f;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.nx = nx; this.ny = ny;
      this.cur = 0;
      this.clearWater = true;
    },

    // Onsets against slow baselines: only a jump is a hit.
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kickHit = false, snareHit = false, hatHit = false;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kickHit = true; }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snareHit = true; }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hatHit = true; }
      e.prevH = hRaw;

      // Bass without the kick band, slow: a bass that pumped with each kick
      // would throb the whole figure on the beat.
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 1.2, dt);

      // Track follower: a slow level on the low bands, ranged against a
      // floor and ceiling that adapt to the track.
      e.lvl = ease(e.lvl, (s[0] + s[1]) / 200, 0.9, dt);
      e.ceil = Math.max(e.lvl, e.ceil - dt * 0.008);
      e.floor = Math.min(e.lvl, e.floor + dt * 0.006);
      return { kickHit, snareHit, hatHit, kAmp: kRaw };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke();
        p.fill(220);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text('Ripple Tank needs WebGL2 float targets', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      const hits = this.listen(signals, dt);
      const e = this.env;
      const react = params.react;
      this.T += dt;
      const T = this.T;

      const follow = Math.round(params.follow) === 1;
      const span = Math.max(0.18, e.ceil - e.floor);
      const want = follow ? smooth(0.35, 0.8, (e.lvl - e.floor) / span) : 0;
      e.auto = ease(e.auto, want, want > e.auto ? 1.4 : 0.35, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const groundT = Math.round(params.ground) === 1 ? 1 : 0;
      e.ground = e.ground === null ? groundT : ease(e.ground, groundT, 2, dt);

      // ---- sim grid, capped: the cost does not grow with the screen
      const W = ctx.width, H = ctx.height;
      const cellU = 600 / SIM_SHORT;
      const nx = Math.max(8, Math.round(W / cellU)), ny = Math.max(8, Math.round(H / cellU));
      if (nx !== this.nx || ny !== this.ny) this.allocSim(nx, ny);
      const toSim = (x, y) => [x / cellU, (H - y) / cellU];

      // ---- geometry that wanders: the dipper pair turns and drifts, the
      // plate slides, the drip walks. Incommensurate rates, so it never loops.
      const sd = this.seed;
      this.turn += dt * (0.045 + 0.05 * e.bass * react);
      const cx = W / 2 + 0.12 * W * Math.sin(T * 0.037 + sd.a);
      const cy = H / 2 + 0.1 * H * Math.sin(T * 0.029 + sd.b);
      const half = P.spread / 2;
      const ax = Math.cos(this.turn), ay = Math.sin(this.turn);
      const d1 = toSim(cx - ax * half, cy - ay * half);
      const d2 = toSim(cx + ax * half, cy + ay * half);
      // The third makes an equilateral triangle with the pair.
      const d3 = toSim(cx - ay * half * 1.732, cy + ax * half * 1.732);

      const lx = W / 2 + 0.28 * W * Math.sin(T * 0.021 + sd.c);
      const ly = H / 2 + 0.22 * H * Math.sin(T * 0.017 + sd.a * 2);
      const lc = toSim(lx, ly);
      const lang = T * 0.03 + sd.b;

      // ---- events
      const drops = this.pending;
      if (hits.kickHit) {
        // The drip walks a slow Lissajous over the tank; each kick falls
        // from wherever it is, so rings land apart and cross.
        const tx = W / 2 + 0.36 * W * Math.sin(T * 0.23 + sd.b);
        const ty = H / 2 + 0.32 * H * Math.sin(T * 0.31 + sd.c);
        const [x, y] = toSim(tx, ty);
        drops.push([x, y, 1.6 * react * (0.75 + 0.5 * hits.kAmp), 2.6]);
      }
      if (hits.snareHit) {
        drops.push([d1[0], d1[1], 1.1 * react, 2.2]);
        drops.push([d2[0], d2[1], 1.1 * react, 2.2]);
      }
      if (hits.hatHit) {
        const n = Math.round(P.drizzle * 3);
        for (let i = 0; i < n; i++) {
          drops.push([Math.random() * nx, Math.random() * ny, 0.22 * react, 1.7]);
        }
      }
      // Ambient drizzle keeps a quiet tank alive.
      if (Math.random() < dt * (0.4 + 2.5 * P.drizzle)) {
        drops.push([Math.random() * nx, Math.random() * ny, 0.14 + 0.1 * Math.random(), 1.7]);
      }
      while (drops.length > MAX_DROPS) drops.shift();

      // ---- simulate
      this.acc += dt * STEPS_PER_S;
      const steps = Math.min(6, Math.floor(this.acc));
      this.acc -= Math.floor(this.acc);
      const S = this.sim;
      gl.useProgram(S.pr);
      gl.viewport(0, 0, nx, ny);
      if (this.clearWater) {
        for (let i = 0; i < 2; i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i]);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        this.clearWater = false;
      }
      gl.uniform2i(S.u.N, nx, ny);
      gl.uniform1f(S.u.c2, C * C);
      gl.uniform4f(S.u.lens, lc[0], lc[1], 0.2 * 600 / cellU, 0.11 * 600 / cellU);
      gl.uniform2f(S.u.lensRot, Math.cos(lang), Math.sin(lang));
      gl.uniform1f(S.u.lensK, 0.62 * P.lens);
      gl.uniform1f(S.u.damp, 0.9991);
      gl.uniform1f(S.u.sponge, 1 - 0.97 * P.walls);
      gl.uniform4f(S.u.dip, d1[0], d1[1], d2[0], d2[1]);
      gl.uniform2f(S.u.dip3, d3[0], d3[1]);
      const amp = 0.065 * P.dippers * (0.6 + 0.8 * e.bass * react);
      gl.uniform3f(S.u.dipAmp, amp, amp, amp * P.third);
      gl.uniform1i(S.u.state, 0);
      gl.activeTexture(gl.TEXTURE0);
      const omega = 2 * Math.PI * 7.5 * P.pitch / STEPS_PER_S;
      // Drops go in on the first step of the frame only; with no step this
      // frame they wait for the next.
      const nDrops = steps > 0 ? drops.length : 0;
      if (nDrops) {
        this.dropBuf.fill(0);
        drops.forEach((d, i) => this.dropBuf.set(d, i * 4));
        gl.uniform4fv(S.u.drops, this.dropBuf);
        drops.length = 0;
      }
      for (let s = 0; s < steps; s++) {
        this.phase = (this.phase + omega) % (2 * Math.PI);
        gl.uniform1f(S.u.dipPhase, this.phase);
        gl.uniform1i(S.u.dropN, s === 0 ? nDrops : 0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1 - this.cur]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.cur = 1 - this.cur;
      }
      gl.uniform1i(S.u.dropN, 0);

      // ---- render at screen resolution (capped)
      let w = Math.round(p.width * p.pixelDensity());
      let h = Math.round(p.height * p.pixelDensity());
      const sc = Math.min(1, RENDER_LONG_CAP / Math.max(w, h));
      w = Math.round(w * sc); h = Math.round(h * sc);
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const R = this.ren;
      gl.useProgram(R.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
      gl.uniform1i(R.u.state, 0);
      gl.uniform2i(R.u.N, nx, ny);
      gl.uniform2f(R.u.res, w, h);
      gl.uniform1f(R.u.cellU, cellU);
      gl.uniform1f(R.u.gain, 1.8);
      gl.uniform1f(R.u.causK, 5.0);
      gl.uniform1f(R.u.causGain, 0.25);
      // The cool lamp hangs upper left; it turns very slowly with the pair.
      const la = 2.3 + 0.2 * Math.sin(T * 0.013);
      gl.uniform2f(R.u.lampA, Math.cos(la), Math.sin(la));
      gl.uniform3fv(R.u.colA, COOL);
      gl.uniform3fv(R.u.colB, WARM);
      gl.uniform1f(R.u.lampB, P.lamp);
      gl.uniform3fv(R.u.causCol, CAUS);
      gl.uniform1f(R.u.paper, e.ground);
      gl.uniform3fv(R.u.paperCol, PAPER);
      gl.uniform3fv(R.u.inkCol, INK);
      gl.uniform1f(R.u.gridK, 0.12);
      gl.uniform1f(R.u.omega, omega);
      gl.uniform1f(R.u.waveK, omega / C);
      gl.uniform1f(R.u.expo, 25.0);
      gl.uniform1f(R.u.lineP, 4.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, W, H);
    },
  });
})();
