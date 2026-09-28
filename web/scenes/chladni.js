// Chladni: cymatic sand on a vibrating plate of black glass, flown over.
//
// The plate is infinite and the camera drifts across it, so the figures pass
// beneath like dunes under a slow aircraft. The vibration is a sum of up to
// three real Chladni modes,
//   f = cos(n pi x) cos(m pi y) + s cos(m pi x) cos(n pi y),
// and thousands of grains on the CPU do what sand does on a plate: they are
// kicked about in proportion to the local amplitude |f| and settle where it
// vanishes, so they drift down the gradient of f^2 onto the nodal lines. When
// the mode changes the whole figure dissolves and the sand flows to the new
// one; that flow is most of the movement.
//
// Rendering (WebGL2):
// - Grains are splatted as points into a density buffer (settled sand in R,
//   airborne sand in G), blurred at half resolution into a height field, and
//   lit by two low raking lights of different colour, so every ridge has a
//   bright flank and a dark one.
// - The glass shows the standing wave itself as a faint iridescent sheen on
//   the antinodes (the same f, evaluated per pixel), under a soft reflection
//   of the key light, with the sand's shadow cast across it.
// - A few out-of-focus motes float above the plate on a faster parallax.
//
// Music:
// - Dominant frequency (the band centroid) picks the mode number, so the
//   music literally sets how fine the figure is.
// - Kick: the plate is struck at one point. Sand within a hand's width leaps
//   and sprays outward, glowing, and a small light at the strike rakes the
//   nearby ridges. Nothing else moves on the kick.
// - Snare / clap: the mode changes and the sand flows to a new figure.
// - Bass: vibration amplitude, so faster flow and a stronger sheen; travel
//   speed.
// - Hats: glints on individual grains.
// - Drop: a second and third mode join, so the figures become intricate, the
//   cool light rises and the sheen blooms. The breakdown falls back to one
//   simple mode under a single warm light.

(function () {
  const TAU = Math.PI * 2;
  const LUT_N = 4096;                  // cos table; power of two for & masking
  const LUT = new Float32Array(LUT_N);
  for (let i = 0; i < LUT_N; i++) LUT[i] = Math.cos((i / LUT_N) * TAU);
  const LS = LUT_N / TAU;              // table index per radian
  const QUARTER = LUT_N / 4;           // sin(a) = cos(a - pi/2)
  const MAXM = 3;                      // mode slots
  const MARGIN = 70;                   // virtual units of simulated sand beyond the frame
  const STRIKES = 4;

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }

  // Plates: glass base, key light, fill light, sand albedo, strike glow.
  const PLATES = [
    { name: 'Black glass', base: lin('#050608'), key: lin('#ffb35c'), fill: lin('#35d6ff'),
      sand: lin('#efe6d6'), strike: lin('#ffd9a0'), refl: lin('#2a1d12'), sheen: 1, sA: lin('#6a2cff'), sB: lin('#ff2f9a') },
    { name: 'Brass', base: lin('#1c1206'), key: lin('#ffe2b0'), fill: lin('#ff5a7a'),
      sand: lin('#fff4e4'), strike: lin('#fff0d0'), refl: lin('#6a4a18'), sheen: 0.6, sA: lin('#ff7a2c'), sB: lin('#8a3cff') },
    { name: 'Nightshade', base: lin('#07040c'), key: lin('#ff4fd8'), fill: lin('#4cffb0'),
      sand: lin('#f2ecff'), strike: lin('#ffffff'), refl: lin('#2a1236'), sheen: 1.3, sA: lin('#2c6bff'), sB: lin('#ffd02c') },
  ];

  // Figure sequence: (m - n, sign). The snare steps through it.
  const FIGS = [[1, 1], [2, -1], [3, 1], [1, -1], [2, 1], [4, -1], [3, -1], [5, 1]];

  const VS_QUAD = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const VS_SPLAT = `#version 300 es
in vec3 g;              // world x, y (plate units), hop height
uniform vec2 cam;       // camera centre, plate units
uniform vec2 rot;       // cos, sin of the camera angle
uniform float U;        // virtual units per plate unit
uniform vec2 halfV;     // half the stage, virtual units
uniform float psize;    // device pixels
out float vAir, vW;
void main() {
  // z > 0 is height in the air; z < 0 marks a grain still dancing on an
  // antinode, drawn dimmer so the figure reads and loose sand does not
  // flicker across the whole plate.
  float hop = max(g.z, 0.0);
  vW = 1.0 - max(-g.z, 0.0);
  vec2 d = g.xy - cam;
  vec2 v = vec2(rot.x * d.x + rot.y * d.y, -rot.y * d.x + rot.x * d.y) * U;
  // A slightly oblique eye: sand in the air rises up the screen.
  v.y += hop * U * 0.8;
  vAir = clamp(hop * 30.0, 0.0, 1.0);
  gl_Position = vec4(v / halfV, 0.0, 1.0);
  gl_PointSize = max(1.0, psize * (1.0 + 1.2 * vAir));
}`;

  const FS_SPLAT = `#version 300 es
precision mediump float;
in float vAir, vW;
uniform float w;
out vec4 o;
void main() { o = vec4(w * vW * (1.0 - vAir), w * vAir, 0.0, 0.0); }`;

  const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform vec2 step;      // uv offset per tap
uniform vec2 res;       // target size
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec4 a = texture(src, uv) * 0.2270;
  a += (texture(src, uv + step) + texture(src, uv - step)) * 0.1945;
  a += (texture(src, uv + 2.0 * step) + texture(src, uv - 2.0 * step)) * 0.1216;
  a += (texture(src, uv + 3.0 * step) + texture(src, uv - 3.0 * step)) * 0.0540;
  a += (texture(src, uv + 4.0 * step) + texture(src, uv - 4.0 * step)) * 0.0162;
  o = a;
}`;

  const FS_COMP = `#version 300 es
precision highp float;
uniform sampler2D dens, blur;
uniform vec2 res;
uniform float unitPx, gain, relief, time;
uniform vec2 cam, rot;
uniform float U;
uniform vec4 modes[3];  // n, m, s, weight
uniform float fnorm;
uniform vec3 L1, L2;    // light directions, screen space, z up
uniform vec3 c1, c2, albedo, base, refl, strikeCol, sheenA, sheenB;
uniform float sheenK, bass, drop, hat, hatSeed;
uniform vec4 strikes[4]; // x, y virtual (y up, centred), intensity, radius
out vec4 o;

float field(vec2 w) {
  float f = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 m = modes[i];
    if (m.w < 0.001) continue;
    vec2 a = 3.14159265 * m.x * w, b = 3.14159265 * m.y * w;
    f += m.w * (cos(a.x) * cos(b.y) + m.z * cos(b.x) * cos(a.y));
  }
  return f * fnorm;
}

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 v = (gl_FragCoord.xy - 0.5 * res) / unitPx;   // virtual units, y up
  vec2 texel = 1.0 / res;

  vec2 dd = texture(dens, uv).rg * gain;
  float D = dd.r, air = dd.g;
  float B = texture(blur, uv).r * gain;
  float bx = texture(blur, uv + vec2(2.0 * texel.x, 0.0)).r - texture(blur, uv - vec2(2.0 * texel.x, 0.0)).r;
  float by = texture(blur, uv + vec2(0.0, 2.0 * texel.y)).r - texture(blur, uv - vec2(0.0, 2.0 * texel.y)).r;
  vec3 N = normalize(vec3(-bx * gain * relief, -by * gain * relief, 1.0));

  float cov = 1.0 - exp(-D * 0.9);
  float ridge = 1.0 - exp(-B * 1.4);
  float sand = clamp(max(cov, ridge * 0.55), 0.0, 1.0);

  // ---- glass
  vec2 wpos = cam + vec2(rot.x * v.x - rot.y * v.y, rot.y * v.x + rot.x * v.y) / U;
  float f = field(wpos);
  // The key light's reflection: a broad soft glow on the side it comes from.
  vec2 half_ = 0.5 * res / unitPx;
  float along = dot(v / max(half_.x, half_.y), normalize(L1.xy));
  vec3 plate = base + refl * 0.5 * smoothstep(-0.2, 1.4, along) * (0.6 + 0.4 * bass);
  // The standing wave on the glass: iridescent where it moves most.
  float anti = smoothstep(0.45, 1.0, abs(f));
  vec3 irid = mix(sheenA, sheenB, 0.5 + 0.5 * cos(6.2831853 * (f * 0.6 + time * 0.02)));
  plate += irid * anti * sheenK * (0.01 + 0.035 * bass + 0.06 * drop);
  // Sand shadows fall away from the key light.
  float sh = texture(blur, uv - L1.xy * 5.0 * texel * unitPx).r * gain;
  plate *= 1.0 - 0.7 * (1.0 - exp(-sh * 1.4));

  // ---- strikes: a small light a hand above the plate
  vec3 strikeLight = vec3(0.0);
  float strikeGlow = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 s = strikes[i];
    if (s.z < 0.003) continue;
    vec2 d = s.xy - v;
    float r2 = dot(d, d) / (s.w * s.w);
    float fall = s.z * exp(-r2 * 2.2);
    vec3 Ls = normalize(vec3(d, s.w * 0.25));
    strikeLight += strikeCol * fall * (0.4 + 2.2 * max(dot(N, Ls), 0.0));
    strikeGlow += s.z * exp(-r2 * 7.0);
  }

  // ---- sand, raked
  float d1 = max(dot(N, L1), 0.0), d2 = max(dot(N, L2), 0.0);
  vec3 lit = albedo * (c1 * d1 * 1.6 + c2 * d2 * (0.25 + 1.3 * drop) + strikeLight + 0.02);
  // Crests catch a thin specular line from the key light.
  vec3 Hh = normalize(L1 + vec3(0.0, 0.0, 1.0));
  lit += c1 * pow(max(dot(N, Hh), 0.0), 40.0) * 0.5 * ridge;
  vec3 col = mix(plate, lit, sand);

  // ---- hats: single grains flash
  vec2 cell = floor(gl_FragCoord.xy / max(1.0, unitPx * 1.4));
  float hsh = hash(cell + hatSeed * 13.17);
  col += vec3(1.0, 0.95, 0.85) * step(1.0 - hat * 0.035, hsh) * cov * 2.5;

  // ---- airborne sand glows, and the struck point on the glass
  col += strikeCol * air * 2.2;
  col += strikeCol * strikeGlow * 0.08;

  // Vignette, then a soft shoulder instead of clipping.
  float vig = 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(1.0, 0.8)) * 1.3, 2.5);
  col *= vig;
  col = 1.0 - exp(-col * 1.25);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  VIZ.register({
    id: 'chladni',
    name: 'Chladni',
    order: 305,

    params: [
      { key: 'plate', label: 'Plate', type: 'select', options: PLATES.map((p) => p.name), default: 0 },
      { key: 'grains', label: 'Sand', type: 'range', min: 20000, max: 90000, default: 55000, step: 1000 },
      { key: 'scale', label: 'Figure size', type: 'range', min: 0.6, max: 1.8, default: 1, step: 0.01 },
      { key: 'complexity', label: 'Complexity', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'travel', label: 'Travel', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'relief', label: 'Relief', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'push', label: 'Music push', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'figure', label: 'New figure', run() { this.nextFigure = true; } },
    ],

    gallery: {
      title: 'Chladni',
      technique: 'CPU grain simulation (tens of thousands of grains descending the gradient of f² with amplitude-scaled random kicks, f a sum of real Chladni modes read from a cosine table) splatted as WebGL2 points into a density buffer, blurred into a height field and raked by two coloured lights over a black-glass plate that shows the standing wave as an iridescent sheen',
      brief: 'Sand on a vibrating black-glass plate, flown over slowly: the figures pass beneath like dunes, every ridge lit amber on one flank and cyan on the other. The band centroid picks the mode number, so the music sets how fine the figure is; each snare changes the mode and the whole plate of sand flows to a new figure; each kick strikes the plate at one spot, where sand leaps and sprays outward glowing and a small light rakes the nearby ridges; bass drives the vibration (faster flow, stronger sheen on the antinodes) and the travel speed; hats flash single grains. The drop adds a second and third mode for intricate figures and raises the cyan light; the breakdown settles to one simple figure under warm light.',
      lineage: [
        'Brief 05 (batch 03): Chladni figures, real mode formulas, thousands of grains, raking light; kicks hop grains in one region.',
        'Design: the plate is infinite (modes with real-valued n, m are quasi-periodic, so the flight never tiles), grains are simulated only over the frame plus a margin and wrap across it, and a wrapped grain is Newton-projected onto the nearest nodal line so sand arriving at the leading edge is already a figure.',
        'v1 (640x360): worked first time but muddy: loose sand covered the whole plate, figures too fine (n up to 9), and a rainbow sheen made green and red blobs in every cell. Snare changed the mode about every second, so the drop never settled into a figure.',
        'v2: pull to the nodes about 3x stronger, base jitter lower (thinner lines), mode numbers lowered, figure changes at most every 1.8 s, sheen restricted to a two-colour ramp per plate (indigo to magenta on black glass, complementary to the amber/cyan lights). Figures read clearly; drop intricate and cyan-lit, breakdown a calm warm lattice.',
        'Jolt v2: kickArea 0.35, ratio 1.28 (calm by ratio). With travel off it was 0.18 and the heat map showed one hot splash and nothing else, so the area was the flight, not the kick. Travel speed was cut back (base 0.65, drop surge +0.55 rather than +1.8) and grains still dancing on antinodes are drawn dimmer, which cleaned the figures and removed plate-wide flicker.',
        'Jolt v3: kickArea 0.26 (build 0.24), kickMean 0.044, ratio 1.40, calm. The kick is a single hot spot in the heat map: the splash of leaping sand and the strike light raking nearby ridges.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.camT = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0,
        prevK: 0, prevS: 0, prevH: 0, cent: 3, mid: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, fig: 0 };
      this.hatSeed = 0;
      this.figIdx = 0;
      this.n0 = 3;
      this.strikes = [];
      this.nextFigure = false;
      this.modes = null;      // [{n, m, s, a}] current
      this.count = 0;
      this.motes = null;
      this.lightA = 0.6;
      this.hueStep = 0;
    },

    alloc(n) {
      this.count = n;
      this.gx = new Float32Array(n);
      this.gy = new Float32Array(n);
      this.gz = new Float32Array(n);
      this.vx = new Float32Array(n);
      this.vy = new Float32Array(n);
      this.vz = new Float32Array(n);
      this.buf = new Float32Array(n * 3);
      this.loose = new Float32Array(n);
      this.fresh = true;
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
      const link = (vs, fs, names) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        const u = {};
        for (const n of names) u[n] = gl.getUniformLocation(prog, n);
        return { prog, u };
      };
      this.pSplat = link(VS_SPLAT, FS_SPLAT, ['cam', 'rot', 'U', 'halfV', 'psize', 'w']);
      this.pBlur = link(VS_QUAD, FS_BLUR, ['src', 'step', 'res']);
      this.pComp = link(VS_QUAD, FS_COMP, ['dens', 'blur', 'res', 'unitPx', 'gain', 'relief', 'time', 'cam',
        'rot', 'U', 'modes', 'fnorm', 'L1', 'L2', 'c1', 'c2', 'albedo', 'base', 'refl', 'strikeCol',
        'sheenK', 'sheenA', 'sheenB', 'bass', 'drop', 'hat', 'hatSeed', 'strikes']);

      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.grainBuf = gl.createBuffer();

      this.vaoQuad = gl.createVertexArray();
      gl.bindVertexArray(this.vaoQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      for (const p of [this.pBlur, this.pComp]) {
        const loc = gl.getAttribLocation(p.prog, 'pos');
        if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); }
      }
      this.vaoGrain = gl.createVertexArray();
      gl.bindVertexArray(this.vaoGrain);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.grainBuf);
      const gl_ = gl.getAttribLocation(this.pSplat.prog, 'g');
      gl.enableVertexAttribArray(gl_);
      gl.vertexAttribPointer(gl_, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      // Half floats let the density accumulate without saturating; RGBA8
      // works too with a smaller per-grain weight.
      this.half = !!gl.getExtension('EXT_color_buffer_float');
      this.gl = gl;
      this.glCanvas = c;
      this.fbW = 0;
    },

    target(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb, w, h };
    },

    resize(w, h) {
      const gl = this.gl;
      for (const t of [this.tDens, this.tA, this.tB]) {
        if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
      }
      this.tDens = this.target(w, h);
      const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      this.tA = this.target(hw, hh);
      this.tB = this.target(hw, hh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.fbW = w; this.fbH = h;
    },

    // Onsets against slow baselines, as in Aurora: only a jump is a hit.
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kickHit = false, snareHit = false;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kickHit = true; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.6, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snareHit = true; }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw, e.snare * Math.exp(-dt / 0.16));

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.mid = ease(e.mid, clamp01((s[2] + s[3] + s[4]) / 240), 1, dt);

      // Spectral centroid over the bands, heavily smoothed: where the music's
      // weight sits, which sets how fine the figure is.
      let sum = 0, wsum = 0;
      for (let i = 0; i < 9; i++) { sum += s[i]; wsum += s[i] * i; }
      if (sum > 20) e.cent = ease(e.cent, wsum / sum, 0.6, dt);
      return { kickHit, snareHit, kAmp: kRaw };
    },

    // Target mode set from the figure index, the centroid and how full the
    // music is. Slot 0 is always on; 1 and 2 are what the drop adds.
    targets(params) {
      const e = this.env;
      const cx = params.complexity;
      const fig = FIGS[this.figIdx % FIGS.length];
      const fig2 = FIGS[(this.figIdx * 3 + 2) % FIGS.length];
      const fig3 = FIGS[(this.figIdx * 5 + 5) % FIGS.length];
      const n0 = this.n0;
      const full = clamp01(e.drop * params.push);
      return [
        { n: n0, m: n0 + fig[0], s: fig[1], a: 1 },
        { n: n0 + 1, m: n0 + 1 + fig2[0], s: fig2[1], a: clamp01(0.15 * cx + 0.75 * full) },
        { n: Math.max(1, n0 - 1), m: n0 + 2 + fig3[0], s: fig3[1], a: clamp01(0.5 * full * (0.4 + cx)) },
      ];
    },

    // f and grad f at (x, y), into this.fv.
    sample(x, y, K) {
      let f = 0, fx = 0, fy = 0;
      for (let k = 0; k < K.length; k += 5) {
        const kn = K[k], km = K[k + 1], s = K[k + 2], a = K[k + 3];
        const ixn = (x * kn) | 0, iym = (y * km) | 0, ixm = (x * km) | 0, iyn = (y * kn) | 0;
        const cxn = LUT[ixn & 4095], cym = LUT[iym & 4095], cxm = LUT[ixm & 4095], cyn = LUT[iyn & 4095];
        const sxn = LUT[(ixn - QUARTER) & 4095], sym = LUT[(iym - QUARTER) & 4095];
        const sxm = LUT[(ixm - QUARTER) & 4095], syn = LUT[(iyn - QUARTER) & 4095];
        const pn = K[k + 4] * kn, pm = K[k + 4] * km;   // n pi, m pi
        f += a * (cxn * cym + s * cxm * cyn);
        fx -= a * (pn * sxn * cym + s * pm * sxm * cyn);
        fy -= a * (pm * cxn * sym + s * pn * cxm * syn);
      }
      this.fv[0] = f; this.fv[1] = fx; this.fv[2] = fy;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const hits = this.listen(signals, dt);
      const e = this.env;
      const push = params.push;
      this.T += dt;
      const T = this.T;

      const halfW = ctx.width / 2, halfH = ctx.height / 2;
      const U = 300 * params.scale;          // virtual units per plate unit

      // ---- camera: a slow Lissajous over a bounded stretch of plate, so
      // coordinates stay small; the music sets its speed, never jerks it.
      const speed = params.travel * (0.65 + push * (0.25 * e.bass + 0.3 * e.drop));
      this.camT += dt * speed;
      const ct = this.camT;
      const cam = [2.6 * Math.sin(ct * 0.041 + 0.7), 2.1 * Math.sin(ct * 0.029)];
      const ang = 0.35 * Math.sin(ct * 0.011) + ct * 0.006;
      const cs = Math.cos(ang), sn = Math.sin(ang);

      // ---- modes
      if (!this.modes) {
        this.n0 = 3;
        this.modes = this.targets(params).map((m) => ({ ...m }));
      }
      // Centroid to mode number, with hysteresis so it does not dither.
      const nT = 1.2 + e.cent * 0.4 + params.complexity * 1.2;
      if (Math.abs(nT - this.n0) > 0.8) this.n0 = Math.max(2, Math.min(7, Math.round(nT)));
      this.since.fig += dt;
      if (hits.snareHit && this.since.fig > 1.8) { this.figIdx++; this.since.fig = 0; this.hueStep++; }
      // Without a snare the figure still changes, slowly.
      if (this.since.fig > 8 || this.nextFigure) { this.figIdx++; this.since.fig = 0; this.nextFigure = false; }
      const tg = this.targets(params);
      const mr = 1.8;
      for (let i = 0; i < MAXM; i++) {
        const m = this.modes[i], t = tg[i];
        m.n = ease(m.n, t.n, mr, dt);
        m.m = ease(m.m, t.m, mr, dt);
        m.s = ease(m.s, t.s, mr, dt);
        m.a = ease(m.a, t.a, 1.2, dt);
      }
      let asum = 0;
      for (const m of this.modes) asum += m.a;
      const fnorm = 1 / Math.max(0.5, asum);
      // Packed for the grain loop: kn, km (table index per plate unit),
      // s, a (normalised), 1/LS (radian per index, for the gradient).
      const K = [];
      for (const m of this.modes) {
        if (m.a < 0.01) continue;
        K.push(m.n * Math.PI * LS, m.m * Math.PI * LS, m.s, m.a * fnorm, 1 / LS);
      }
      this.fv = this.fv || new Float32Array(3);

      // ---- grains
      const want = Math.round(params.grains);
      if (want !== this.count) this.alloc(want);
      const n = this.count;
      const gx = this.gx, gy = this.gy, gz = this.gz, vx = this.vx, vy = this.vy, vz = this.vz;
      const exW = (halfW + MARGIN) / U, exH = (halfH + MARGIN) / U;   // half-extent, plate units
      const R = Math.random;
      if (this.fresh) {
        for (let i = 0; i < n; i++) {
          const a = (R() * 2 - 1) * exW, b = (R() * 2 - 1) * exH;
          gx[i] = cam[0] + cs * a - sn * b;
          gy[i] = cam[1] + sn * a + cs * b;
          gz[i] = 0; vx[i] = 0; vy[i] = 0; vz[i] = 0;
        }
        this.fresh = false;
      }

      // Kick: strike the plate at one spot, somewhere new each time.
      if (hits.kickHit && push > 0) {
        const sx = (R() * 1.3 - 0.65) * halfW, sy = (R() * 1.2 - 0.6) * halfH;
        const amp = Math.min(1.3, (0.55 + 0.6 * hits.kAmp) * push);
        this.strikes.unshift({ x: sx, y: sy, age: 0, amp });
        this.strikes.length = Math.min(this.strikes.length, STRIKES);
        const wx = cam[0] + (cs * sx - sn * sy) / U, wy = cam[1] + (sn * sx + cs * sy) / U;
        const rad = 95 / U, rad2 = rad * rad;
        for (let i = 0; i < n; i++) {
          const dx = gx[i] - wx, dy = gy[i] - wy;
          const d2 = dx * dx + dy * dy;
          if (d2 > rad2) continue;
          const q = 1 - Math.sqrt(d2 / rad2);
          const up = amp * q * (0.6 + 0.8 * R());
          vz[i] = Math.max(vz[i], 1.1 * up);
          if (gz[i] <= 0) gz[i] = 1e-4;
          const d = Math.sqrt(d2) + 1e-4, out = amp * q * (0.25 + 0.5 * R()) * 0.9;
          vx[i] += (dx / d) * out + (R() - 0.5) * 0.25 * up;
          vy[i] += (dy / d) * out + (R() - 0.5) * 0.25 * up;
        }
      }
      for (const s of this.strikes) s.age += dt;

      // Vibration: amplitude sets both the pull to the nodes and the dance
      // on the antinodes. nk normalises the pull so fine and coarse modes
      // settle in about the same time.
      const vib = 0.35 + push * (0.8 * e.bass + 0.4 * e.drop);
      const nAvg = Math.max(1.5, 0.5 * (this.modes[0].n + this.modes[0].m));
      const pull = (7 * vib) / (Math.PI * nAvg * Math.PI * nAvg);
      const kick0 = 0.02 * Math.sqrt(dt);
      const kick1 = 0.32 * vib * Math.sqrt(dt);
      const fv = this.fv;
      const G = 9;
      for (let i = 0; i < n; i++) {
        let x = gx[i], y = gy[i];
        if (gz[i] > 0) {
          // In the air: ballistic, then land wherever it lands.
          x += vx[i] * dt; y += vy[i] * dt;
          vz[i] -= G * dt;
          gz[i] += vz[i] * dt;
          if (gz[i] <= 0) { gz[i] = 0; vz[i] = 0; vx[i] = 0; vy[i] = 0; }
        } else {
          this.sample(x, y, K);
          const f = fv[0];
          const af = f < 0 ? -f : f;
          this.loose[i] = af > 0.45 ? 0.7 : af * 1.55;
          let step = -pull * f * dt;
          // Cap the step: near a coarse antinode the pull can overshoot.
          let sx = step * fv[1], sy = step * fv[2];
          const sl = sx * sx + sy * sy;
          if (sl > 0.0004) { const k = 0.02 / Math.sqrt(sl); sx *= k; sy *= k; }
          const j = kick0 + kick1 * Math.abs(f);
          x += sx + j * (R() + R() - 1) * 1.7;
          y += sy + j * (R() + R() - 1) * 1.7;
        }
        // Wrap across the simulated window, in view space.
        const dx = x - cam[0], dy = y - cam[1];
        let a = cs * dx + sn * dy, b = -sn * dx + cs * dy;
        let wrapped = false;
        if (a > exW) { a -= 2 * exW; wrapped = true; } else if (a < -exW) { a += 2 * exW; wrapped = true; }
        if (b > exH) { b -= 2 * exH; wrapped = true; } else if (b < -exH) { b += 2 * exH; wrapped = true; }
        if (wrapped) {
          a += (R() - 0.5) * 0.05; b += (R() - 0.5) * 0.05;
          x = cam[0] + cs * a - sn * b;
          y = cam[1] + sn * a + cs * b;
          // Arrive already settled: Newton steps onto the nearest node.
          for (let it = 0; it < 4; it++) {
            this.sample(x, y, K);
            const g2 = fv[1] * fv[1] + fv[2] * fv[2] + 1e-6;
            let k = fv[0] / g2;
            const st = Math.abs(k) * Math.sqrt(g2);
            if (st > 0.15) k *= 0.15 / st;
            x -= k * fv[1]; y -= k * fv[2];
          }
          gz[i] = 0; vz[i] = 0; vx[i] = 0; vy[i] = 0;
          this.loose[i] = 0;
        }
        gx[i] = x; gy[i] = y;
      }

      // ---- render
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Chladni needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      if (this.fbW !== w || this.fbH !== h) this.resize(w, h);
      const unitPx = Math.min(w, h) / 600;

      const buf = this.buf, loose = this.loose;
      for (let i = 0, k = 0; i < n; i++, k += 3) {
        buf[k] = gx[i]; buf[k + 1] = gy[i]; buf[k + 2] = gz[i] > 0 ? gz[i] : -loose[i];
      }
      gl.disable(gl.DEPTH_TEST);

      // Splat.
      const wgt = this.half ? 0.35 : 0.1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.tDens.fb);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.pSplat.prog);
      let u = this.pSplat.u;
      gl.uniform2f(u.cam, cam[0], cam[1]);
      gl.uniform2f(u.rot, cs, sn);
      gl.uniform1f(u.U, U);
      gl.uniform2f(u.halfV, halfW, halfH);
      gl.uniform1f(u.psize, 1.4 * unitPx);
      gl.uniform1f(u.w, wgt);
      gl.bindVertexArray(this.vaoGrain);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.grainBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STREAM_DRAW);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.disable(gl.BLEND);

      // Blur into a height field at half resolution.
      gl.bindVertexArray(this.vaoQuad);
      gl.useProgram(this.pBlur.prog);
      u = this.pBlur.u;
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.src, 0);
      const bw = this.tA.w, bh = this.tA.h;
      const reach = 1.1 * unitPx;           // tap spacing, device px, scales with the stage
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.tA.fb);
      gl.viewport(0, 0, bw, bh);
      gl.bindTexture(gl.TEXTURE_2D, this.tDens.tex);
      gl.uniform2f(u.step, reach / w, 0);
      gl.uniform2f(u.res, bw, bh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.tB.fb);
      gl.bindTexture(gl.TEXTURE_2D, this.tA.tex);
      gl.uniform2f(u.step, 0, reach / h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Composite.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.pComp.prog);
      u = this.pComp.u;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tDens.tex);
      gl.uniform1i(u.dens, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tB.tex);
      gl.uniform1i(u.blur, 1);
      const pl = PLATES[params.plate | 0] || PLATES[0];
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, unitPx);
      gl.uniform1f(u.gain, 1 / wgt * 0.35);
      gl.uniform1f(u.relief, 3.2 * params.relief / Math.max(0.5, unitPx));
      gl.uniform1f(u.time, T);
      gl.uniform2f(u.cam, cam[0], cam[1]);
      gl.uniform2f(u.rot, cs, sn);
      gl.uniform1f(u.U, U);
      const mv = new Float32Array(12);
      this.modes.forEach((m, i) => { mv[i * 4] = m.n; mv[i * 4 + 1] = m.m; mv[i * 4 + 2] = m.s; mv[i * 4 + 3] = m.a; });
      gl.uniform4fv(u.modes, mv);
      gl.uniform1f(u.fnorm, fnorm);
      // Two raking lights low on opposite sides, wheeling slowly. Each snare
      // nudges the key light round a little, so shadows swing with the figure.
      this.lightA = ease(this.lightA, 0.6 + T * 0.05 + this.hueStep * 0.35, 2, dt);
      const la = this.lightA - ang;
      const el = 0.32;
      gl.uniform3f(u.L1, Math.cos(la), Math.sin(la), el);
      gl.uniform3f(u.L2, Math.cos(la + 2.6), Math.sin(la + 2.6), el * 0.8);
      gl.uniform3fv(u.c1, pl.key);
      gl.uniform3fv(u.c2, pl.fill);
      gl.uniform3fv(u.albedo, pl.sand);
      gl.uniform3fv(u.base, pl.base);
      gl.uniform3fv(u.refl, pl.refl);
      gl.uniform3fv(u.strikeCol, pl.strike);
      gl.uniform1f(u.sheenK, pl.sheen);
      gl.uniform3fv(u.sheenA, pl.sA);
      gl.uniform3fv(u.sheenB, pl.sB);
      gl.uniform1f(u.bass, e.bass * Math.min(1.5, push));
      gl.uniform1f(u.drop, e.drop * Math.min(1.5, push));
      gl.uniform1f(u.hat, e.hat * Math.min(1.5, push));
      gl.uniform1f(u.hatSeed, this.hatSeed);
      const sv = new Float32Array(16);
      this.strikes.forEach((s, i) => {
        const life = Math.exp(-s.age / 0.28);
        sv[i * 4] = s.x; sv[i * 4 + 1] = s.y;
        sv[i * 4 + 2] = s.amp * life * 1.6; sv[i * 4 + 3] = 110 + 60 * (1 - life);
      });
      gl.uniform4fv(u.strikes, sv);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);

      this.drawMotes(p, ctx, cam, ang, U, params, pl);
    },

    // Out-of-focus dust above the plate, on a faster parallax: the depth cue
    // that makes the flight feel like flight.
    drawMotes(p, ctx, cam, ang, U, params, pl) {
      const e = this.env;
      if (!this.motes) {
        const R = Math.random;
        this.motes = [];
        for (let i = 0; i < 26; i++) {
          this.motes.push({ x: R(), y: R(), r: 6 + 22 * R() * R(), par: 1.5 + 1.5 * R(), tw: R() * 6.28 });
        }
      }
      const g = p.drawingContext;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const W = ctx.width + 120, H = ctx.height + 120;
      const cs = Math.cos(-ang), sn = Math.sin(-ang);
      const k = pl.key.map((c) => Math.round(255 * Math.pow(c, 1 / 2.2)));
      for (const m of this.motes) {
        const wx = cam[0] * U * m.par, wy = cam[1] * U * m.par;
        const vx = cs * wx - sn * wy, vy = sn * wx + cs * wy;
        let x = ((m.x * W - vx) % W + W) % W - 60;
        let y = ((m.y * H + vy) % H + H) % H - 60;
        const a = 0.07 + 0.06 * e.bass + 0.1 * e.hat * (0.5 + 0.5 * Math.sin(m.tw + this.hatSeed));
        const rr = m.r * (m.par / 2);
        const grd = g.createRadialGradient(x, y, 0, x, y, rr);
        grd.addColorStop(0, `rgba(${k[0]},${k[1]},${k[2]},${a})`);
        grd.addColorStop(0.6, `rgba(${k[0]},${k[1]},${k[2]},${a * 0.5})`);
        grd.addColorStop(1, `rgba(${k[0]},${k[1]},${k[2]},0)`);
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, rr, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    },
  });
})();
