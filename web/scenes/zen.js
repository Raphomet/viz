// Zen — a karesansui (dry landscape) garden seen from directly above.
//
// Pale raked gravel in parallel grooves, grey stones in moss collars with the
// gravel raked in rings around them, a maple somewhere off to the upper right
// whose dappled shade lies across one corner and whose leaves fall into the
// garden. A wooden rake is always at work, pulling new grooves row by row, so
// over a few minutes the whole garden is re-raked into a new pattern (straight
// lines, waves, sweeping arcs, a checkerboard, a spiral, overlapping ripples).
//
// Craft notes:
// - Everything on the ground is one WebGL2 fragment shader. The grooves are
//   level sets of a "rake coordinate" f(x, y) per pattern; the gravel height is
//   cos(2 pi f / spacing) and its slope is taken analytically (each pattern
//   returns its own gradient), so the grooves are lit by a real low sun and
//   no screen-space derivatives smear the seams. Seams between patterns are
//   deliberately left hard, as they are in a real raked garden.
// - Which pattern a point shows is decided by rows: the rake works the garden
//   in serpentine rows one rake-width tall, and the JS keeps one pattern id
//   per row plus the rake's position, so the new pattern appears exactly
//   behind the tines. No texture state, nothing accumulates, minute ten is as
//   clean as minute one.
// - Light, not glow: a warm low sun, cool sky ambient, stones casting capsule
//   shadows, dappled maple shade. The only "effect" is the sun itself going
//   in and out: the drop is full afternoon sun with hard shadows, the
//   breakdown is a cloud passing, flat and cool.
// - Music is handed to things in the garden, never to the frame:
//   kick   -> one ring is pressed into the gravel around one stone (marching
//             outward ring by ring, moving to another stone every 16 kicks);
//   snare  -> a maple leaf lets go and spirals down onto the gravel;
//   bass   -> the rake's pace;
//   hats   -> mica glints on the ridges of the gravel;
//   drop   -> a re-raking wave sweeps out from a stone and turns the whole
//             garden to a new pattern, and the sun comes out.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_ROWS = 16;
  const TINES = 6;           // grooves per rake width
  const PATTERN_COUNT = 7;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;          // device pixels
uniform float uVpp;         // virtual units per device pixel
uniform vec2 uStage;        // virtual stage size
uniform float uTime;
uniform float uD;           // groove spacing
uniform float uRowH;
uniform int uRows;
uniform float uRowPat[${MAX_ROWS}];
uniform int uRakeRow;
uniform float uRakeX;
uniform float uRakeDir;
uniform float uRakePat;
uniform vec4 uStone[6];     // x, y, r, seed
uniform int uStones;
uniform vec4 uRing[4];      // stone index, ring distance, strength, width
uniform vec3 uFront;        // x, y, radius (radius < 0 = off)
uniform float uFrontPat;
uniform vec3 uSunDir;       // towards the sun
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform float uSun;         // 0 overcast .. 1 full sun
uniform float uHat;
uniform vec2 uMaple;        // centre of the maple's crown (off stage)
uniform float uMapleR;
uniform float uShade;       // maple shade strength
uniform vec2 uSway;
uniform vec3 uGravel;
uniform vec3 uStoneA;
uniform vec3 uStoneB;
uniform vec3 uMossA;
uniform vec3 uMossB;
uniform vec4 uCam;           // centre x, y, rotation, zoom
uniform vec2 uCamOff;

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// The rake coordinate of pattern id at p: (f, df/dx, df/dy).
vec3 pattern(float id, vec2 p) {
  int k = int(id + 0.5);
  if (k == 1) {                         // waves
    float kx = 6.2831853 / (uStage.x * 0.42);
    float a = uD * 1.9;
    return vec3(p.y + a * sin(p.x * kx + 1.3), a * kx * cos(p.x * kx + 1.3), 1.0);
  }
  if (k == 2) {                         // great arcs from a centre far below
    vec2 c = vec2(uStage.x * 0.35, uStage.y * 1.9);
    vec2 q = p - c; float r = length(q);
    return vec3(r, q / r);
  }
  if (k == 3) {                         // ichimatsu checkerboard
    vec2 cell = floor(p / (uRowH * 1.5));
    if (mod(cell.x + cell.y, 2.0) < 0.5) return vec3(p.y, 0.0, 1.0);
    return vec3(p.x, 1.0, 0.0);
  }
  if (k == 4) {                         // one-armed spiral
    vec2 c = vec2(uStage.x * 0.62, uStage.y * 0.55);
    vec2 q = p - c; float r = max(length(q), 1.0);
    float th = atan(q.y, q.x);
    vec2 g = q / r + uD / 6.2831853 * vec2(-q.y, q.x) / (r * r);
    return vec3(r + uD * th / 6.2831853, g);
  }
  if (k == 5) {                         // overlapping ripples
    vec2 c1 = vec2(uStage.x * 0.18, uStage.y * 0.22);
    vec2 c2 = vec2(uStage.x * 0.84, uStage.y * 0.80);
    vec2 c3 = vec2(uStage.x * 0.55, uStage.y * 0.08);
    float d1 = length(p - c1), d2 = length(p - c2), d3 = length(p - c3) * 1.25;
    if (d1 < d2 && d1 < d3) return vec3(d1, normalize(p - c1));
    if (d2 < d3) return vec3(d2, normalize(p - c2));
    return vec3(d3, normalize(p - c3) * 1.25);
  }
  if (k == 6) {                         // long diagonal swells
    vec2 n = normalize(vec2(0.45, 1.0));
    float kx = 6.2831853 / (uStage.x * 0.8);
    float a = uD * 3.2;
    float s = dot(p, vec2(n.y, -n.x));
    return vec3(dot(p, n) + a * sin(s * kx), n + a * kx * cos(s * kx) * vec2(n.y, -n.x));
  }
  return vec3(p.y, 0.0, 1.0);           // 0: straight lines
}

// Irregular stone outline: signed distance and outward direction.
vec3 stoneSd(vec4 s, vec2 p) {
  vec2 q = p - s.xy;
  float ca = cos(s.w * 3.0), sa = sin(s.w * 3.0);
  vec2 qr = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
  qr.y /= 0.78;
  float th = atan(qr.y, qr.x);
  float R = s.z * (1.0 + 0.09 * sin(3.0 * th + s.w * 7.0) + 0.05 * sin(5.0 * th + s.w * 13.0)
                        + 0.03 * sin(9.0 * th + s.w * 3.0));
  float l = length(qr);
  float sd = (l - R) * 0.86;
  vec2 dir = length(q) > 0.001 ? q / length(q) : vec2(0.0, 1.0);
  return vec3(sd, dir);
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uVpp - uCam.xy;
  float cr = cos(-uCam.z), sr = sin(-uCam.z);
  vec2 p = uCam.xy + uCamOff + vec2(cr * sp.x - sr * sp.y, sr * sp.x + cr * sp.y) / uCam.w;

  // Nearest stone.
  float sdMin = 1e5; vec2 sdDir = vec2(0.0, 1.0); int si = -1;
  float shadow = 1.0;
  vec2 sunXY = normalize(uSunDir.xy);
  float shLen = uSunDir.z > 0.0 ? sqrt(1.0 - uSunDir.z * uSunDir.z) / uSunDir.z : 2.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uStones) break;
    vec4 s = uStone[i];
    vec3 r = stoneSd(s, p);
    if (r.x < sdMin) { sdMin = r.x; sdDir = r.yz; si = i; }
    // Cast shadow: the stone swept away from the sun, as a capsule.
    vec2 a = s.xy, b = s.xy - sunXY * s.z * 0.8 * shLen;
    vec2 pa = p - a, ba = b - a;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float cd = length(pa - ba * hh) - s.z * (0.92 - 0.35 * hh);
    shadow *= mix(1.0, smoothstep(-5.0, 7.0 + hh * 10.0, cd), 1.0);
  }
  vec4 st = uStone[si < 0 ? 0 : si];
  float mossW = 7.0 + 15.0 * fbm(sdDir * 2.5 + st.w * 11.0);
  float ringZone = mossW + uD * 5.0;

  vec3 L = normalize(uSunDir);
  vec3 col;

  // Maple shade: leaf clumps inside the crown's shadow, swaying with the breeze.
  vec2 mp = p + uSway;
  float crown = 1.0 - smoothstep(uMapleR * 0.55, uMapleR, length(p - uMaple) + 60.0 * (fbm(p * 0.006) - 0.5));
  float clump = smoothstep(0.40, 0.62, fbm(mp * 0.008 + 3.0) + 0.18 * (fbm(mp * 0.035 + 9.0) - 0.5));
  clump *= 1.0 - 0.85 * smoothstep(0.58, 0.68, fbm(mp * 0.03 + 2.0));   // sun flecks through the leaves
  float shade = crown * clump * uShade;
  float sunVis = shadow * (1.0 - 0.85 * shade);

  if (sdMin < 0.0) {
    // ---- stone: a low dome with granular bumps.
    float u = clamp(-sdMin / (st.z * 0.75), 0.0, 1.0);
    float n1 = fbm(p * 0.09 + st.w * 5.0);
    float n2 = vnoise(p * 0.6);
    vec2 bump = vec2(vnoise(p * 0.07 + 1.3) - vnoise(p * 0.07 + 7.7), vnoise(p * 0.07 + 3.1) - vnoise(p * 0.07 + 5.5));
    vec3 n = normalize(vec3(sdDir * (1.0 - u) * 1.6 + bump * 0.9, 0.35 + u * 1.2));
    vec3 alb = mix(uStoneA, uStoneB, smoothstep(0.3, 0.75, n1)) * (0.9 + 0.2 * n2);
    // lichen freckles and a little moss creeping up the lower edge
    float lichen = smoothstep(0.72, 0.78, fbm(p * 0.05 + st.w * 3.0));
    alb = mix(alb, vec3(0.70, 0.72, 0.62), lichen * 0.45);
    float creep = smoothstep(0.35, 0.0, u) * smoothstep(0.5, 0.7, fbm(p * 0.08 + 4.0));
    alb = mix(alb, uMossA, creep * 0.8);
    float diff = max(dot(n, L), 0.0);
    // the stone does not shadow itself with its own capsule
    float selfSun = 1.0 - 0.85 * shade;
    col = alb * (uSunCol * diff * selfSun * mix(0.25, 1.25, uSun) + uSkyCol * (0.45 + 0.35 * n.z) * mix(1.6, 1.0, uSun));
  } else if (sdMin < mossW) {
    // ---- moss collar: a soft cushion, fine-grained.
    float u = sdMin / mossW;
    float g = fbm(p * 0.35 + 2.0);
    float fine = vnoise(p * 1.4);
    vec2 bump = vec2(vnoise(p * 0.5) - vnoise(p * 0.5 + 3.3), vnoise(p * 0.5 + 6.1) - vnoise(p * 0.5 + 9.2));
    vec3 n = normalize(vec3(-sdDir * 0.2 + sdDir * u * 0.9 + bump * 0.8, 1.0));
    vec3 alb = mix(uMossA, uMossB, smoothstep(0.35, 0.7, g)) * (0.8 + 0.35 * fine);
    float diff = max(dot(n, L), 0.0);
    float ao = mix(0.55, 1.0, smoothstep(0.0, 0.5, u));
    col = alb * (uSunCol * diff * sunVis * mix(0.25, 1.25, uSun) + uSkyCol * ao * mix(1.1, 0.55, uSun));
  } else {
    // ---- gravel.
    vec3 f;
    bool rings = sdMin < ringZone;
    if (rings) {
      f = vec3(sdMin - mossW, sdDir);
    } else {
      int row = int(clamp(floor(p.y / uRowH), 0.0, float(uRows - 1)));
      float pid = uRowPat[row];
      if (row == uRakeRow && (uRakeDir > 0.0 ? p.x < uRakeX : p.x > uRakeX)) pid = uRakePat;
      if (uFront.z > 0.0 && length(p - uFront.xy) < uFront.z) pid = uFrontPat;
      f = pattern(pid, p);
    }
    float w = 6.2831853 / uD;
    float amp = uD * 0.21;
    float hgt = 0.5 + 0.5 * cos(f.x * w);
    vec2 grad = -amp * 0.5 * w * sin(f.x * w) * f.yz;
    // The ring pressed by the kick: a trench with a lip, around one stone.
    float press = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uRing[i];
      if (r.z <= 0.001) continue;
      int idx = int(r.x + 0.5);
      if (idx >= uStones) continue;
      vec3 s = stoneSd(uStone[idx], p);
      float x = (s.x - r.y) / r.w;
      float e = exp(-x * x);
      float depth = uD * 1.5 * r.z;
      grad += depth * 2.0 * x / r.w * e * s.yz;             // d/dsd of -depth*e
      float lip = exp(-(x - 1.6) * (x - 1.6) * 1.5);
      grad += -depth * 0.35 * 3.0 * (x - 1.6) / r.w * lip * s.yz;
      press = max(press, e * r.z);
    }
    // The wake of the drop's re-raking wave.
    if (uFront.z > 0.0) {
      float x = (length(p - uFront.xy) - uFront.z) / 5.0;
      float e = exp(-x * x);
      grad += uD * 0.8 * 2.0 * x / 5.0 * e * normalize(p - uFront.xy + 0.001);
    }
    vec3 n = normalize(vec3(-grad, 1.0));
    // grain
    vec2 gc = floor(p / 1.7);
    float gh = h21(gc);
    float gv = 0.86 + 0.2 * gh + 0.08 * (vnoise(p * 0.25) - 0.5);
    vec3 alb = uGravel * gv;
    alb *= mix(vec3(1.0), vec3(0.93, 0.95, 1.0), step(0.8, h21(gc + 7.0)));
    alb *= 1.0 - 0.28 * press;                                // compacted gravel reads darker
    float ao = mix(0.72, 1.0, hgt) * mix(0.55, 1.0, smoothstep(0.0, 26.0, sdMin - mossW));
    float diff = max(dot(n, L), 0.0);
    col = alb * (uSunCol * diff * sunVis * mix(0.22, 1.2, uSun) + uSkyCol * ao * mix(1.25, 0.52, uSun));
    // mica glints on sunlit ridges, dealt by the hats
    vec2 mc = floor(p / 3.4);
    vec2 mf = fract(p / 3.4) - 0.5;
    float glintCell = step(0.986, h21(mc + 3.0)) * smoothstep(0.5, 0.15, length(mf));
    float tw = 0.5 + 0.5 * sin(uTime * 7.0 + h21(mc + 11.0) * 60.0);
    float glint = glintCell * smoothstep(0.5, 1.0, tw) * smoothstep(0.2, 0.9, diff * sunVis) * uHat;
    col += vec3(1.0, 0.97, 0.9) * glint * 1.1;
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  // --- Light presets. `ground` is the gravel albedo.
  const LIGHTS = [
    { name: 'Afternoon', az: -2.35, elev: 0.62, sun: [1.0, 0.93, 0.80], sky: [0.50, 0.55, 0.64],
      gravel: [0.86, 0.83, 0.76], stoneA: [0.50, 0.49, 0.47], stoneB: [0.36, 0.35, 0.35],
      mossA: [0.20, 0.33, 0.13], mossB: [0.36, 0.48, 0.18], rake: '#76502f', rakeHi: '#b88a58' },
    { name: 'Dusk', az: -2.75, elev: 0.30, sun: [1.15, 0.72, 0.46], sky: [0.34, 0.36, 0.52],
      gravel: [0.84, 0.79, 0.72], stoneA: [0.47, 0.44, 0.44], stoneB: [0.32, 0.30, 0.32],
      mossA: [0.17, 0.28, 0.12], mossB: [0.32, 0.42, 0.16], rake: '#6a4629', rakeHi: '#b07a48' },
    { name: 'Black sand', az: -2.2, elev: 0.55, sun: [1.0, 0.95, 0.88], sky: [0.42, 0.46, 0.55],
      gravel: [0.20, 0.20, 0.21], stoneA: [0.72, 0.70, 0.66], stoneB: [0.56, 0.54, 0.51],
      mossA: [0.22, 0.38, 0.14], mossB: [0.42, 0.56, 0.20], rake: '#a47a4c', rakeHi: '#d2a470' },
  ];

  const LEAF_COLS = ['#c8452a', '#d8672a', '#a8302b', '#e08a2e', '#b73a24', '#8f2a2a'];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  // Default stone layout, in fractions of the stage (x, y) and virtual radius:
  // a group of three and a pair, the classic odd-numbered asymmetric setting.
  const LAYOUT = [
    [0.30, 0.44, 58, 0.31], [0.385, 0.64, 27, 0.77], [0.215, 0.66, 20, 0.53],
    [0.735, 0.30, 42, 0.12], [0.80, 0.47, 22, 0.91],
  ];

  function leafPath(ctx, size) {
    // A seven-lobed Japanese maple leaf, stem towards +y. Lobes are broad
    // near the base and pointed at the tip; the sinuses cut about halfway in,
    // because thinner lobes read as starbursts at projector distance.
    ctx.beginPath();
    const lobes = 7, step = 0.5, sinus = 0.46;
    for (let i = 0; i < lobes; i++) {
      const a = -Math.PI / 2 + (i - (lobes - 1) / 2) * step;
      const len = size * (1 - Math.abs(i - 3) * 0.12);
      const a0 = a - step / 2, a1 = a + step / 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * size * sinus * 0.7, Math.sin(a0) * size * sinus * 0.7);
      ctx.bezierCurveTo(Math.cos(a - 0.2) * len * 0.62, Math.sin(a - 0.2) * len * 0.62,
        Math.cos(a - 0.07) * len * 0.9, Math.sin(a - 0.07) * len * 0.9, Math.cos(a) * len, Math.sin(a) * len);
      const r1 = (i === lobes - 1 ? 0.7 : 1) * size * sinus;
      ctx.bezierCurveTo(Math.cos(a + 0.07) * len * 0.9, Math.sin(a + 0.07) * len * 0.9,
        Math.cos(a + 0.2) * len * 0.62, Math.sin(a + 0.2) * len * 0.62, Math.cos(a1) * r1, Math.sin(a1) * r1);
    }
    ctx.lineTo(0, size * 0.18);
    ctx.closePath();
  }

  VIZ.register({
    id: 'zen',
    name: 'Zen',
    order: 405,
    gallery: {
      title: 'Zen',
      technique: 'WebGL2 height-field shader (analytic groove gradients, low-sun lighting, capsule stone shadows, fbm maple shade) under Canvas 2D rake and falling maple leaves',
      brief: 'A karesansui garden from above in afternoon light: raked gravel curving around moss-collared stones, a wooden rake always pulling new grooves row by row, maple shade in one corner. The kick presses one ring into the gravel around one stone, the snare drops a maple leaf, the bass sets the rake\'s pace, hats glint in the gravel, and the drop sends a re-raking wave across the whole garden while the sun comes out; the breakdown is a cloud passing.',
      lineage: 'Batch 04 brief 05. Karesansui gardens (Ryoan-ji; Tofuku-ji\'s ichimatsu checkerboard) and the hard seams a real rake leaves between passes. Process: planned the gravel as level sets of a per-row "rake coordinate" with analytic gradients, so re-raking needs no texture state and stays clean for hours. Render 1: good bones, but a grey overcast intro, a matchstick rake, starburst leaves, decal-like maple shade and a faint kick ring (jolt area 0.03). Then: whiter, flatter overcast light so the breakdown exhales without going grey; a heavier rake with teeth and a rising handle shadow; a deeper, wider pressed trench (area 0.05, still calm); organic maple dapple with sun flecks; a slow drone drift (a few degrees over 97 s) and leaves that sometimes fall on their own so the intro is never still; broad-lobed leaves and round mica glints. A 96 s run cycled straight lines, waves, checkerboard, ripples and arcs.',
    },

    params: [
      { key: 'pace', label: 'Rake pace', type: 'range', min: 0.2, max: 3, default: 1, step: 0.01 },
      { key: 'spacing', label: 'Groove spacing', type: 'range', min: 7, max: 18, default: 10, step: 0.1 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'light', label: 'Light', type: 'select', options: LIGHTS.map((l) => l.name), default: 0 },
      { key: 'leaves', label: 'Leaf fall', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'shade', label: 'Maple shade', type: 'range', min: 0, max: 1, default: 0.75, step: 0.01 },
    ],

    actions: [
      { id: 'rerake', label: 'Re-rake now', run() { this.forceFront = true; } },
      { id: 'stones', label: 'New stones', run() { this.layoutSeed = (this.layoutSeed || 0) + 1; this.stones = null; } },
    ],

    setup(p, ctx) { this.reset(ctx); },
    enter(p, ctx) { if (!this.state) this.reset(ctx); },

    reset(ctx) {
      this.state = {
        lastT: null, prev: new Float32Array(9),
        bassSm: 0, lowFor: 3, armed: true, lastDrop: -99,
        sun: 0.5, hat: 0, pad: 0,
        lastKick: -1, kickCount: 0, lastClap: -1,
        rings: [], leaves: [], front: null,
        rows: null, rake: null, patSeq: 1, breeze: 0, nextAmbient: 1.5,
      };
      this.stones = null;
    },

    nextPattern(avoid) {
      const S = this.state;
      let id = (S.patSeq++) % PATTERN_COUNT;
      if (id === avoid) id = (S.patSeq++) % PATTERN_COUNT;
      return id;
    },

    makeStones(W, H) {
      const seed = this.layoutSeed || 0;
      let r = Math.sin(seed * 91.7 + 3.1) * 1e4;
      const rnd = () => { r = Math.sin(r * 12.9898 + 78.233) * 43758.5453; return r - Math.floor(r); };
      this.stones = LAYOUT.map(([fx, fy, rad, s]) => {
        if (seed === 0) return { x: fx * W, y: fy * H, r: rad, s };
        return { x: (0.15 + 0.7 * rnd()) * W, y: (0.18 + 0.64 * rnd()) * H, r: rad * (0.8 + 0.4 * rnd()), s: rnd() };
      });
      this.stonesFor = W + 'x' + H;
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
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
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
        u[name] = gl.getUniformLocation(prog, name);
      }
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // ---- music -> events
    listen(sig, t, dt, params) {
      const S = this.state;
      const prev = S.prev;
      const react = params.react;

      // Kick: a sharp rise in band 0.
      if (sig[0] > 58 && sig[0] - prev[0] > 22 && t - S.lastKick > 0.22) {
        S.lastKick = t;
        const k = S.kickCount++;
        const ring = k % 5;
        const big = this.stones.map((s, i) => [s.r, i]).sort((a, b) => b[0] - a[0]);
        const stone = big[Math.floor(k / 16) % 3][1];
        S.rings.push({ stone, ring, t0: t, amp: Math.min(1.2, sig[0] / 85) });
        if (S.rings.length > 4) S.rings.shift();
      }
      // Snare / clap: a sharp rise in bands 3-5.
      const clapNow = (sig[3] + sig[4] + sig[5]) / 3;
      const clapPrev = (prev[3] + prev[4] + prev[5]) / 3;
      if (clapNow > 36 && clapNow - clapPrev > 16 && t - S.lastClap > 0.3) {
        S.lastClap = t;
        if (params.leaves > 0 && Math.random() < Math.min(1, params.leaves)) this.dropLeaf(t, params);
        if (params.leaves > 1 && Math.random() < params.leaves - 1) this.dropLeaf(t, params);
      }
      for (let i = 0; i < 9; i++) prev[i] = sig[i];

      // Bass: slow follower on band 1 (the bass line), which also marks the drop.
      S.bassSm = ease(S.bassSm, sig[1], 1.0, dt);
      if (S.bassSm < 14) S.lowFor += dt; else S.lowFor = 0;
      if (S.lowFor > 3) S.armed = true;
      if ((S.armed && S.bassSm > 27 && t - S.lastDrop > 12) || this.forceFront) {
        this.forceFront = false;
        S.armed = false; S.lastDrop = t;
        this.startFront();
      }

      const hats = (sig[6] + sig[7] + sig[8]) / 300;
      S.hat = Math.max(hats, S.hat * Math.exp(-dt / 0.12));
      S.pad = ease(S.pad, (sig[2] + sig[3] + sig[4]) / 300, 0.8, dt);
      const sunTarget = 0.25 + 0.75 * clamp01((S.bassSm - 8) / 28);
      S.sun = ease(S.sun, sunTarget, S.sun < sunTarget ? 0.9 : 0.45, dt);
      // Leaves also let go on their own now and then, so the intro is not still.
      if (params.leaves > 0 && t > S.nextAmbient) {
        this.dropLeaf(t, params);
        S.nextAmbient = t + (4 + 6 * Math.random()) / params.leaves;
      }
      S.breeze += dt * (0.25 + 1.2 * S.pad + 0.02 * S.bassSm) * (0.5 + 0.5 * react);
    },

    startFront() {
      const S = this.state;
      const big = this.stones.reduce((a, s) => (s.r > a.r ? s : a), this.stones[0]);
      const cur = S.rows ? S.rows[S.rake.row] : 0;
      S.front = { x: big.x, y: big.y, r: 0, pat: this.nextPattern(cur) };
    },

    dropLeaf(t, params) {
      const S = this.state;
      const W = this.W, H = this.H;
      // Most leaves fall under the maple (upper right), some drift further.
      const under = Math.random() < 0.7;
      const x = under ? W * (0.55 + 0.45 * Math.random()) : W * Math.random();
      const y = under ? H * (0.05 + 0.5 * Math.random()) : H * (0.1 + 0.8 * Math.random());
      S.leaves.push({
        x, y, t0: t, fall: 1.7 + Math.random() * 0.8,
        rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 5,
        size: 17 + Math.random() * 9, col: LEAF_COLS[(Math.random() * LEAF_COLS.length) | 0],
        swayA: 30 + Math.random() * 40, swayP: Math.random() * TAU, dx: 0, gone: -1,
      });
      if (S.leaves.length > 28) S.leaves.shift();
    },

    // ---- the rake's serpentine walk
    stepRake(dt, params, W, H) {
      const S = this.state;
      const d = params.spacing;
      const rowH0 = d * TINES;
      const nRows = Math.max(3, Math.min(MAX_ROWS, Math.round(H / rowH0)));
      if (!S.rows || S.rows.length !== nRows) {
        S.rows = new Array(nRows).fill(0);
        S.rake = { row: Math.min(2, nRows - 1), x: W * 0.28, dir: 1, step: 1, pat: 1 };
      }
      const R = S.rake;
      const v = params.pace * (42 + 3.2 * S.bassSm);
      R.x += R.dir * v * dt;
      const margin = 60;
      if ((R.dir > 0 && R.x > W + margin) || (R.dir < 0 && R.x < -margin)) {
        S.rows[R.row] = R.pat;
        let next = R.row + R.step;
        if (next < 0 || next >= nRows) {
          R.step = -R.step;
          next = R.row + R.step;
          R.pat = this.nextPattern(R.pat);
        }
        R.row = next;
        R.dir = -R.dir;
        R.x = R.dir > 0 ? -margin : W + margin;
      }
      this.rowH = H / nRows;
      this.speed = v;

      // The drop's wave.
      const F = S.front;
      if (F) {
        F.r += dt * (260 + 180 * params.react);
        const far = Math.hypot(Math.max(F.x, W - F.x), Math.max(F.y, H - F.y));
        if (F.r > far + 20) {
          S.rows.fill(F.pat);
          R.pat = this.nextPattern(F.pat);
          S.front = null;
        }
      }
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      this.W = W; this.H = H;
      if (!this.state) this.reset(ctx);
      if (!this.stones || this.stonesFor !== W + 'x' + H) this.makeStones(W, H);
      const S = this.state;
      const t = p.millis() / 1000;
      const dt = S.lastT === null ? 1 / 60 : Math.max(0, Math.min(0.1, t - S.lastT));
      S.lastT = t;
      const light = LIGHTS[Math.max(0, Math.min(LIGHTS.length - 1, Math.round(params.light)))];

      this.listen(signals, t, dt, params);
      // A very slow drone drift, turning a few degrees over a minute and a
      // half, so the garden is never a still photograph; it never reacts to
      // the music, which keeps the kick local.
      const cam = {
        cx: W / 2, cy: H / 2, zoom: 1.07,
        rot: 0.055 * Math.sin(t * TAU / 97) + 0.02 * Math.sin(t * TAU / 41 + 1),
        ox: 18 * Math.sin(t * TAU / 71 + 2), oy: 10 * Math.sin(t * TAU / 53),
      };
      this.stepRake(dt, params, W, H);

      // Sun direction: azimuth in screen space (y down), light arriving from
      // the upper left.
      const sx = Math.cos(light.az), sy = Math.sin(light.az);
      const ce = Math.cos(light.elev), se = Math.sin(light.elev);
      const sunDir = [sx * ce, sy * ce, se];
      const shLen = ce / se;

      p.colorMode(p.RGB, 255);
      p.background(0);

      // ---- ground
      const pw = Math.round(p.width * p.pixelDensity());
      const ph = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      const g2 = p.drawingContext;
      if (this.gl) {
        const gl = this.gl, u = this.u;
        if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }
        gl.viewport(0, 0, pw, ph);
        gl.uniform2f(u.uRes, pw, ph);
        gl.uniform1f(u.uVpp, W / pw);
        gl.uniform2f(u.uStage, W, H);
        gl.uniform1f(u.uTime, t);
        gl.uniform1f(u.uD, params.spacing);
        gl.uniform1f(u.uRowH, this.rowH);
        gl.uniform1i(u.uRows, S.rows.length);
        const rp = new Float32Array(MAX_ROWS);
        for (let i = 0; i < S.rows.length; i++) rp[i] = S.rows[i];
        gl.uniform1fv(u.uRowPat, rp);
        gl.uniform1i(u.uRakeRow, S.rake.row);
        gl.uniform1f(u.uRakeX, S.rake.x);
        gl.uniform1f(u.uRakeDir, S.rake.dir);
        gl.uniform1f(u.uRakePat, S.rake.pat);
        const st = new Float32Array(24);
        this.stones.forEach((s, i) => { st.set([s.x, s.y, s.r, s.s], i * 4); });
        gl.uniform4fv(u.uStone, st);
        gl.uniform1i(u.uStones, this.stones.length);
        const rings = new Float32Array(16);
        const react = params.react;
        S.rings.forEach((r, i) => {
          const age = t - r.t0;
          const env = Math.min(1, age / 0.03) * Math.exp(-age / 0.7);
          const dist = 10 + params.spacing * (1.2 + r.ring * 1.6) + 10 * (1 - Math.exp(-age / 0.25));
          rings.set([r.stone, dist, env * r.amp * react, 6 + 3 * Math.min(1, age / 0.4)], i * 4);
        });
        gl.uniform4fv(u.uRing, rings);
        const F = S.front;
        gl.uniform3f(u.uFront, F ? F.x : 0, F ? F.y : 0, F ? F.r : -1);
        gl.uniform1f(u.uFrontPat, F ? F.pat : 0);
        gl.uniform3f(u.uSunDir, sunDir[0], sunDir[1], sunDir[2]);
        gl.uniform3fv(u.uSunCol, light.sun);
        // Overcast light is whiter and flatter than the blue sky fill of a sunny afternoon.
        const sk = light.sky, lum = (sk[0] + sk[1] + sk[2]) / 3 * 1.1, k = S.sun;
        gl.uniform3f(u.uSkyCol, lum + (sk[0] - lum) * k, lum * 0.995 + (sk[1] - lum * 0.995) * k, lum * 0.97 + (sk[2] - lum * 0.97) * k);
        gl.uniform4f(u.uCam, cam.cx, cam.cy, cam.rot, cam.zoom);
        gl.uniform2f(u.uCamOff, cam.ox, cam.oy);
        gl.uniform1f(u.uSun, S.sun);
        gl.uniform1f(u.uHat, Math.min(1, S.hat * 1.6 * (0.4 + 0.6 * react)));
        gl.uniform2f(u.uMaple, W + 40, -40);
        gl.uniform1f(u.uMapleR, Math.max(W, H) * 0.62);
        gl.uniform1f(u.uShade, params.shade * (0.45 + 0.55 * S.sun));
        gl.uniform2f(u.uSway, Math.sin(S.breeze * 0.9) * 9 + Math.sin(S.breeze * 2.3) * 3, Math.cos(S.breeze * 0.7) * 6);
        gl.uniform3fv(u.uGravel, light.gravel);
        gl.uniform3fv(u.uStoneA, light.stoneA);
        gl.uniform3fv(u.uStoneB, light.stoneB);
        gl.uniform3fv(u.uMossA, light.mossA);
        gl.uniform3fv(u.uMossB, light.mossB);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        g2.drawImage(this.glCanvas, 0, 0, W, H);
      } else {
        p.background(214, 208, 194);
        p.noStroke(); p.fill(120);
        for (const s of this.stones) p.circle(s.x, s.y, s.r * 2);
      }

      g2.save();
      // The same slow drone drift as the ground.
      g2.translate(cam.cx, cam.cy);
      g2.scale(cam.zoom, cam.zoom);
      g2.rotate(cam.rot);
      g2.translate(-cam.cx - cam.ox, -cam.cy - cam.oy);
      g2.globalCompositeOperation = 'source-over';
      g2.globalAlpha = 1;
      g2.lineCap = 'round';
      g2.lineJoin = 'round';
      const shadowCol = `rgba(40,38,48,${(0.18 + 0.2 * S.sun).toFixed(3)})`;
      const shX = -sx * shLen, shY = -sy * shLen;

      // ---- leaves resting on the gravel (drawn under the rake)
      const R = S.rake;
      const rowTop = R.row * this.rowH, rowBot = rowTop + this.rowH;
      S.leaves = S.leaves.filter((L) => t - L.t0 < 40 && !(L.gone >= 0 && t - L.gone > 1.2));
      for (const L of S.leaves) {
        const age = t - L.t0;
        if (age < L.fall) continue;
        // The rake sweeps leaves along ahead of the tines.
        if (L.gone < 0 && L.y > rowTop - 6 && L.y < rowBot + 6) {
          const ahead = (L.x + L.dx - R.x) * R.dir;
          if (ahead < 16 && ahead > -4) L.gone = t;
        }
        let a = clamp01(1 - (age - 30) / 10);
        if (L.gone >= 0) {
          L.dx = R.x + R.dir * 14 - L.x;
          a *= clamp01(1 - (t - L.gone) / 1.2);
        }
        this.drawLeaf(g2, L.x + L.dx, L.y, L.rot + L.spin * L.fall, L.size, L.col, a, 2.2, shX, shY, shadowCol);
      }

      // ---- the rake
      this.drawRake(g2, R, this.rowH, light, shX, shY, shadowCol, W);

      // ---- leaves still falling
      for (const L of S.leaves) {
        const age = t - L.t0;
        if (age >= L.fall) continue;
        const k = age / L.fall;              // 0 at the branch, 1 on the ground
        const z = 1 - k * k * (3 - 2 * k) * 0.3 - 0.7 * k;
        const sway = Math.sin(age * 3.1 + L.swayP) * L.swayA * z;
        const x = L.x + sway, y = L.y - 40 * z;
        const scale = 1 + 0.9 * z;
        const a = clamp01(age / 0.25);
        this.drawLeaf(g2, x, y, L.rot + L.spin * age, L.size * scale, L.col, a,
          2.2 + 70 * z, shX, shY, `rgba(40,38,48,${((0.1 + 0.18 * S.sun) * (1 - 0.6 * z)).toFixed(3)})`,
          Math.cos(age * 4.3 + L.swayP));
      }
      g2.restore();
    },

    drawLeaf(g, x, y, rot, size, col, alpha, h, shX, shY, shadowCol, tilt) {
      if (alpha <= 0.001) return;
      const squash = tilt === undefined ? 1 : 0.35 + 0.65 * Math.abs(tilt);
      g.globalAlpha = alpha;
      // shadow
      g.save();
      g.translate(x + shX * h, y + shY * h);
      g.rotate(rot);
      g.scale(1, squash);
      g.fillStyle = shadowCol;
      leafPath(g, size);
      g.fill();
      g.restore();
      // leaf
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(1, squash);
      g.fillStyle = col;
      leafPath(g, size);
      g.fill();
      g.strokeStyle = 'rgba(70,20,10,0.28)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.5;
        const len = size * (1 - Math.abs(i - 3) * 0.12) * 0.78;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      }
      g.moveTo(0, 0); g.lineTo(0, size * 0.55);
      g.stroke();
      g.restore();
      g.globalAlpha = 1;
    },

    drawRake(g, R, rowH, light, shX, shY, shadowCol, W) {
      const x = R.x, cy = (R.row + 0.5) * rowH;
      const half = rowH * 0.5 + 4;
      const dir = R.dir;
      // Handle: forward along the pull and tilted up across the rows it will
      // work next, so the shape reads as a tool being walked, not a cursor.
      const hx = x + dir * 250, hy = cy - R.step * 90;
      const d = rowH / TINES;
      const shape = (ox, oy, hOx, hOy, col) => {
        g.strokeStyle = col;
        g.fillStyle = col;
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(x + ox, cy + oy);
        g.lineTo(hx + hOx, hy + hOy);
        g.stroke();
        g.fillRect(x - 6 + ox, cy - half + oy, 12, half * 2);
        // teeth trail behind the head, in the fresh grooves
        for (let i = 0; i < TINES; i++) {
          const ty = cy - rowH / 2 + (i + 0.5) * d;
          g.fillRect(x - (dir > 0 ? 17 : -5) + ox, ty - 2.2 + oy, 12, 4.4);
        }
      };
      // shadows: the head sits low, the handle rises to hand height
      shape(shX * 7, shY * 7, shX * 80, shY * 80, shadowCol);
      shape(0, 0, 0, 0, light.rake);
      // a lit edge along the wood, on the sun side
      g.strokeStyle = light.rakeHi;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 4.5, cy - half + 1.5); g.lineTo(x - 4.5, cy + half - 1.5);
      g.moveTo(x, cy - 2.5); g.lineTo(hx, hy - 2.5);
      g.stroke();
    },
  });
})();
