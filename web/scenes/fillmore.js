// Psychedelic Fillmore: a 1966-67 San Francisco dance-concert poster, alive.
//
// The sheet is two inks of equal brightness, a vibrating complementary pair
// (red on green, orange on blue, magenta on teal): the one tradition where
// colours that fight each other are the point. In the middle, a silhouette
// (a flame, a lamp, an urn) is filled edge to edge with lettering that has
// melted to fit it, Wes Wilson's trick: every line of words is stretched to
// the width of the shape at that height, so letters balloon where it is wide
// and squeeze to slivers at its tips. The words rise slowly through the shape
// like heat. Around it, Victor Moscoso's concentric outlines ripple outward.
// Arched lettered ribbons at head and foot hold the bill. All wording is
// invented; no real venue, artist, promoter or poster is reproduced.
//
// Music, each in its own place:
//   kick   a swell climbs the silhouette from its base: the letters in one
//          band fatten as it passes, and nothing else moves
//   snare  swaps the pair: the new inks spread outward from the silhouette
//          along the ripple lines (figure and ground trade places; every
//          second swap moves to the next pair). Rate-limited so a snare roll
//          can never strobe.
//   bass   the letters swell and the silhouette breathes
//   hats   small four-point spangles flick on in the ground
//   drop   concentric outlines bloom round every letter and fill the ground
//          with rings, a third ink keylines everything, the melt deepens and
//          the words rise faster; the breakdown drains back to two flat inks
//
// Technique: the lettering is drawn once per typeface into a Canvas 2D atlas
// (one stretched word per row), turned into a signed distance field on the
// CPU (Felzenszwalb EDT), and sampled by a WebGL2 shader through the
// silhouette's row-span mapping; so swelling, melting and Moscoso outlines are
// all thresholds and contours of one field. The silhouette itself is a
// per-frame row table (centre and half-width per height) plus a coarse
// distance grid from the same table, whose contours are the rings. Flat inks
// and paper grain; no glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

  // Pairs chosen at near-equal luma so they vibrate (and so a swap barely
  // moves the brightness of the frame). The third ink is the keyline.
  const PAIRS = [
    { a: '#F0402E', b: '#178040', ink: '#1C1226' }, // red / green
    { a: '#F07820', b: '#3F7CF0', ink: '#1A1430' }, // orange / blue
    { a: '#E83898', b: '#11806A', ink: '#1E1024' }, // magenta / teal
  ];
  const INK_NAMES = ['Fillmore cycle', 'Red / green', 'Orange / blue', 'Magenta / teal'];

  const SHAPES = ['Flame', 'Lamp', 'Urn'];
  const FACES = [
    { name: 'Block', css: '"Archivo Black", "Arial Black", sans-serif', family: 'Archivo Black', weight: 400 },
    { name: 'Victorian', css: '"Rye", Georgia, serif', family: 'Rye', weight: 400 },
    { name: 'Slab', css: '"Alfa Slab One", Georgia, serif', family: 'Alfa Slab One', weight: 400 },
  ];

  // Invented bill. The silhouette words cycle upward; the two ribbons hold.
  const WORDS = ['DANCE', 'INTO', 'THE', 'LIGHT', 'HEAR', 'THE', 'COLOUR', 'MOVE', 'UNTIL', 'DAWN'];
  const HEAD = 'AN EVENING OF SOUND & LIGHT';
  const FOOT = 'DANCING ALL NIGHT · COME AS YOU ARE';
  const NW = WORDS.length;
  const ATLAS_W = 1024, ROW_H = 112, ATLAS_ROWS = NW + 2;
  const ATLAS_H = ROW_H * ATLAS_ROWS;
  const SDF_CLAMP = 60;

  const ROWS = 256;          // silhouette row table
  const GRID = 112;          // silhouette distance grid: cells on the short side
  const LINES = 4.6;         // word lines visible in the silhouette

  const PRESETS = {
    calm: { outlines: 0.3, melt: 0.5, flow: 0.55, third: 0.0 },
    drop: { outlines: 1.0, melt: 1.35, flow: 1.5, third: 1.0 },
    moscoso: { shape: 1, inks: 2, outlines: 1.0, melt: 0.25, flow: 0.8, third: 1.0 },
    molten: { shape: 2, inks: 3, outlines: 0.45, melt: 2.0, flow: 1.0, third: 0.3 },
  };
  const DRIVE = ['outlines', 'melt', 'flow', 'third'];

  // ---- Distance transform (Felzenszwalb & Huttenlocher) ----
  const INF = 1e20;
  function edt1d(f, n, d, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const r = q - v[k];
      d[q] = r * r + f[v[k]];
    }
  }
  // grid: 0 where the feature is, INF elsewhere; returns squared distances in place.
  function edt2d(grid, w, h) {
    const n = Math.max(w, h);
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
      edt1d(f, h, d, v, z);
      for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
      edt1d(f, w, d, v, z);
      for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
  }
  // Signed distance (negative inside) from a boolean-ish mask.
  function signedField(mask, w, h, out) {
    const n = w * h;
    const a = new Float64Array(n), b = new Float64Array(n);
    for (let i = 0; i < n; i++) { const on = mask[i] > 0.5; a[i] = on ? 0 : INF; b[i] = on ? INF : 0; }
    edt2d(a, w, h); edt2d(b, w, h);
    for (let i = 0; i < n; i++) out[i] = Math.sqrt(a[i]) - Math.sqrt(b[i]);
    return out;
  }

  // ---- Silhouettes: half-width (in units of the shape's max half-width) and
  // sideways sway, for t from 0 (top) to 1 (base). ----
  function shapeHW(kind, t) {
    if (kind === 0) {
      // Flame: a point at the top, a round belly low down.
      const tt = clamp01(t);
      return Math.pow(tt, 1.05) * Math.pow(Math.max(0, 1 - Math.pow(tt, 3)), 0.55) * 1.78;
    }
    if (kind === 1) {
      // Lamp: a round globe on a neck with a foot.
      const c = 0.37, r = 0.37;
      const glob = Math.sqrt(Math.max(0, r * r - (t - c) * (t - c))) / r;
      let neck = 0;
      if (t > 0.6 && t <= 1) {
        neck = 0.42 + 0.14 * Math.max(0, (t - 0.86) / 0.14);
        if (t > 0.95) neck *= Math.sqrt(Math.max(0, 1 - ((t - 0.95) / 0.05) ** 2));
      }
      return Math.max(glob, neck);
    }
    // Urn: flared lip, narrow neck, full belly, small foot.
    if (t < 0 || t > 1) return 0;
    let w = 0.62 - 0.36 * Math.exp(-(((t - 0.2) / 0.09) ** 2)) + 0.42 * Math.exp(-(((t - 0.62) / 0.19) ** 2));
    w -= 0.2 * Math.exp(-(((t - 0.92) / 0.05) ** 2));
    w *= Math.sqrt(clamp01(t / 0.025)) * Math.sqrt(clamp01((1 - t) / 0.02));
    return w;
  }

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;        // device px
uniform vec2 uStage;      // virtual units
uniform sampler2D uAtlas; // letter SDF, atlas px
uniform sampler2D uRow;   // rg = centre x, half-width (virtual)
uniform sampler2D uSil;   // silhouette SDF (virtual units), stage-mapped
uniform vec4 uSilBox;     // top, height, centre x, max half-width
uniform float uTime, uScroll, uMelt, uSwell, uOutlines, uThird, uRingPhase;
uniform vec3 uKick[3];    // t position, amplitude, unused
uniform vec3 uFig, uGrd, uInk, uFigP, uGrdP, uInkP;
uniform float uWipe;      // wipe front, virtual distance from the silhouette edge
uniform float uHat; uniform float uHatSeed;
uniform vec4 uHead;       // y centre, band height, arch, margin
uniform vec4 uFoot;
out vec4 outColor;

const float NW = ${NW.toFixed(1)};
const float ROWS_ALL = ${ATLAS_ROWS.toFixed(1)};
const float LINES = ${LINES.toFixed(2)};

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float letterD(vec2 uv, float row) {
  // uv.x in [0,1] across the row, uv.y in [0,1] down the row.
  vec2 a = vec2(uv.x, (row + clamp(uv.y, 0.0, 1.0)) / ROWS_ALL);
  return texture(uAtlas, a).r;
}

// Colour indices: 0 ground, 1 figure, 2 third ink.
vec3 inkOf(float k, bool fresh) {
  if (fresh) return k < 0.5 ? uGrd : (k < 1.5 ? uFig : uInk);
  return k < 0.5 ? uGrdP : (k < 1.5 ? uFigP : uInkP);
}

// Coverage of a band [lo, hi] of d, antialiased with width aa.
float band(float d, float lo, float hi, float aa) {
  return clamp((d - lo) / aa + 0.5, 0.0, 1.0) * clamp((hi - d) / aa + 0.5, 0.0, 1.0);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 P = vec2(fc.x, uRes.y - fc.y) * (uStage / uRes);
  float px = uStage.y / uRes.y; // virtual units per device pixel

  float top = uSilBox.x, H = uSilBox.y;
  float t = (P.y - top) / H;
  float dS = texture(uSil, P / uStage).r;  // < 0 inside
  // The grid is coarse, so near the side edges use the exact edge from the
  // row table (corrected for its slope); the grid carries the far field.
  if (t > 0.02 && t < 0.98) {
    float dt = 1.5 / ${ROWS}.0;
    vec2 r0 = texture(uRow, vec2(t, 0.5)).rg;
    vec2 ra = texture(uRow, vec2(t - dt, 0.5)).rg;
    vec2 rb = texture(uRow, vec2(t + dt, 0.5)).rg;
    float side = sign(P.x - r0.x);
    float slope = ((rb.x + side * rb.y) - (ra.x + side * ra.y)) / (2.0 * dt * H);
    float edgeD = (abs(P.x - r0.x) - r0.y) / sqrt(1.0 + slope * slope);
    dS = mix(edgeD, dS, smoothstep(8.0, 18.0, abs(dS)));
  }
  // Coverage mix per ink index: accumulate a small palette mix.
  float kIdx = 0.0;  // chosen ink index for this pixel (with AA via mix below)
  vec3 colNew, colOld;

  // ---------- Ground: Moscoso rings round the silhouette ----------
  float spacing = 13.0;
  float nRings = mix(2.0, 44.0, uOutlines * uOutlines);
  float reach = nRings * spacing;
  float dr = dS - 4.0;
  float ringU = dr / spacing - uRingPhase;
  float fr = fract(ringU);
  float ringAA = px / spacing * 1.5;
  float ringOn = smoothstep(0.52 - ringAA, 0.52 + ringAA, fr) * (1.0 - smoothstep(0.96 - ringAA, 0.96 + ringAA, fr));
  ringOn *= clamp((reach - dr) / (px * 1.5), 0.0, 1.0) * step(0.0, dr);
  // Alternate ring colours in the drop: figure, then third ink.
  float ringIdx = floor(ringU);
  float ringInk = (uThird > 0.5 && mod(ringIdx, 3.0) == 2.0) ? 2.0 : 1.0;
  // Keyline hugging the silhouette.
  float key = band(dS, 0.0, 4.0 + 2.0 * uThird, px * 1.2);
  float keyInk = uThird > 0.5 ? 2.0 : 1.0;

  // Hat spangles: little four-point stars in the ground.
  float cell = 46.0;
  vec2 ci = floor(P / cell);
  vec2 cf = fract(P / cell) - 0.5;
  float hr = hash(ci + uHatSeed * 0.713);
  vec2 jitter = vec2(hash(ci + 3.1), hash(ci + 7.7)) - 0.5;
  vec2 q = abs(cf - jitter * 0.4) * cell;
  float star = max(q.x, q.y) / 8.0 + min(q.x, q.y) / 1.6;
  float starOn = step(hr, 0.14 * uHat) * clamp((1.0 - star) * 1.6 / (px * 1.2) + 0.5, 0.0, 1.0) * step(10.0, dr);

  // ---------- Silhouette lettering ----------
  float figCov = 0.0, outCov = 0.0, outInk = 1.0;
  if (t > -0.02 && t < 1.02) {
    vec2 row = texture(uRow, vec2(clamp(t, 0.0, 1.0), 0.5)).rg;
    float hw = max(row.y, 1.0);
    float u = (P.x - (row.x - hw)) / (2.0 * hw);
    // Melt: the rows sag and the columns wander, slowly.
    float m = uMelt;
    float tv = t + m * 0.018 * sin(u * 6.2831 * 1.5 + uTime * 0.9 + t * 7.0)
                 + m * 0.012 * sin(u * 6.2831 * 3.0 - uTime * 0.6);
    u += m * 0.035 * sin(t * 17.0 - uTime * 1.1) * (1.0 - abs(2.0 * u - 1.0));
    float lineF = tv * LINES + uScroll;
    float rowI = mod(floor(lineF), NW);
    float rowF = fract(lineF);
    float L = letterD(vec2(clamp(u, 0.0, 1.0), rowF), rowI);
    // Swell: bass everywhere, the kick in a travelling band.
    float sw = uSwell;
    for (int i = 0; i < 3; i++) {
      float g = (t - uKick[i].x) / 0.085;
      sw += uKick[i].y * exp(-g * g);
    }
    float d = L - sw;
    // Atlas px per device px: u spans 1024 px across 2*hw virtual units.
    float aa = max(fwidth(d), 0.5);
    figCov = clamp(0.5 - d / aa, 0.0, 1.0);
    // Moscoso outlines round each letter.
    float gap = 13.0;
    float nOut = floor(uOutlines * 3.0 + 0.5);
    if (nOut > 0.5 && d > 0.0) {
      float k = floor(d / gap);
      float f = d / gap - k;
      float lineCov = smoothstep(0.5 - aa / gap, 0.5 + aa / gap, f) * (1.0 - smoothstep(0.85 - aa / gap, 0.85 + aa / gap, f));
      outCov = lineCov * step(k, nOut - 1.0);
      outInk = (uThird > 0.5 && mod(k, 2.0) == 0.0) ? 2.0 : 1.0;
    }
  }
  float silCov = clamp(0.5 - dS / (px * 1.2), 0.0, 1.0);

  // ---------- Ribbons (head and foot) ----------
  float ribCov = 0.0, ribText = 0.0, ribKey = 0.0;
  for (int r = 0; r < 2; r++) {
    vec4 B = r == 0 ? uHead : uFoot;
    float x0 = B.w, x1 = uStage.x - B.w;
    float uu = (P.x - x0) / (x1 - x0);
    float bend = B.z * (1.0 - sin(3.14159 * clamp(uu, 0.0, 1.0)));
    float yc = B.x + (r == 0 ? bend : -bend);
    float vv = (P.y - yc) / B.y + 0.5;
    float inX = min(P.x - x0, x1 - P.x);
    float inY = min(P.y - (yc - B.y * 0.5), (yc + B.y * 0.5) - P.y);
    float inside = min(inX, inY);
    float cov = clamp(inside / px + 0.5, 0.0, 1.0);
    if (cov > 0.0) {
      ribCov = max(ribCov, cov);
      ribKey = max(ribKey, cov * (1.0 - clamp((inside - 3.0) / px + 0.5, 0.0, 1.0)));
      float pad = 0.16;
      vec2 tu = vec2((uu - 0.03) / 0.94, (vv - pad) / (1.0 - 2.0 * pad));
      if (tu.x > 0.0 && tu.x < 1.0 && tu.y > 0.0 && tu.y < 1.0) {
        float Lr = letterD(tu, NW + float(r));
        float aa = max(fwidth(Lr), 0.5);
        ribText = max(ribText, clamp(0.5 - (Lr - uSwell * 0.3) / aa, 0.0, 1.0));
      }
    }
  }

  // ---------- Compose, twice: the old inks and the new, split by the wipe ----------
  vec3 outc[2];
  for (int w = 0; w < 2; w++) {
    bool fresh = w == 1;
    vec3 g = inkOf(0.0, fresh), f = inkOf(1.0, fresh), k = inkOf(2.0, fresh);
    vec3 c = g;
    c = mix(c, ringInk > 1.5 ? k : f, ringOn);
    c = mix(c, vec3(0.965, 0.925, 0.83), starOn);
    // Silhouette interior: ground with letters in the figure ink.
    vec3 s = g;
    s = mix(s, outInk > 1.5 ? k : f, outCov);
    s = mix(s, f, figCov);
    c = mix(c, s, silCov);
    c = mix(c, keyInk > 1.5 ? k : f, key * (1.0 - silCov * 0.0));
    // Ribbons sit on top: a ground plate, a keyline, figure lettering.
    vec3 rb = mix(g, f, ribText);
    rb = mix(rb, uThird > 0.5 ? k : f, ribKey);
    c = mix(c, rb, ribCov);
    outc[w] = c;
  }
  float front = clamp((uWipe - dS) / (px * 1.5) + 0.5, 0.0, 1.0);
  vec3 col = mix(outc[0], outc[1], front);
  // The wipe front is printed as a thin third-ink line.
  float frontLine = band(dS, uWipe - 3.0, uWipe, px * 1.2) * step(uWipe, 2000.0);
  col = mix(col, uInk, frontLine * 0.9);

  // Paper grain and ink starvation.
  float n = hash(floor(fc)) * 0.6 + hash(floor(fc * 0.25) + 11.0) * 0.4;
  col *= 1.0 - 0.05 * n;
  outColor = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('fillmore shader: ' + log);
    }
    return sh;
  }

  VIZ.register({
    id: 'fillmore',
    name: 'Psychedelic Fillmore',
    order: 814,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INK_NAMES, default: 0 },
      { key: 'shape', label: 'Silhouette', type: 'select', options: SHAPES, default: 0 },
      { key: 'face', label: 'Lettering', type: 'select', options: FACES.map((f) => f.name), default: 0 },
      { key: 'outlines', label: 'Moscoso outlines', type: 'range', min: 0, max: 1, default: PRESETS.calm.outlines, step: 0.01 },
      { key: 'melt', label: 'Melt', type: 'range', min: 0, max: 2, default: PRESETS.calm.melt, step: 0.01 },
      { key: 'flow', label: 'Rising words', type: 'range', min: 0, max: 3, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'third', label: 'Third ink', type: 'range', min: 0, max: 1, default: PRESETS.calm.third, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Psychedelic Fillmore',
      technique: 'WebGL2 over Canvas 2D: invented wording set one word per row in a text atlas, converted to a signed distance field on the CPU (Felzenszwalb EDT) and sampled through a per-frame silhouette row table (Wes Wilson\'s row-span stretch), so swelling, melting and concentric outlines are thresholds and contours of one field; a coarse per-frame distance grid of the silhouette gives the Moscoso rings and the ink-swap wipe. Flat inks at matched brightness, paper grain, no glow.',
      brief: 'A San Francisco dance-concert poster of 1966-67, alive. Two inks of equal brightness vibrate against each other; a flame (or lamp, or urn) is filled edge to edge with lettering melted to fit it, the words rising slowly through it like heat, while concentric outlines ripple out into the ground and arched ribbons carry the bill. The kick is a swell that climbs the silhouette, fattening the letters in one band as it passes. The snare swaps the pair: the new inks spread outward from the silhouette along the ripple lines (figure and ground trade places, and every second swap moves on to the next pair: red and green, orange and blue, magenta and teal). Bass swells all the letters; hats flick small spangles on in the ground. The drop blooms Moscoso outlines round every letter (and, following the track, each later drop moves on to the next silhouette), fills the ground with rings, keylines everything in a third dark ink, deepens the melt and speeds the rising words; the breakdown drains back to two flat inks.',
      lineage: [
        'Batch 06, idea 14 (Designer): Psychedelic Fillmore, after Wes Wilson and Victor Moscoso. Took the idea whole, fusing its two halves: Wilson\'s letters melting to fill a silhouette carry the figure, and Moscoso\'s concentric outlines and vibrating pairs carry the ground and the drop. The Designer\'s mapping is kept: bass swells the letters, the snare swaps the pair, the drop brings the outlines.',
        'Op Art (web/scenes/opart.js): text as a mask texture sampled by a WebGL2 field, flat inks and static paper grain.',
        'Batch 05 posters series rules: evoke the movement, invent every word, no names or copies of real posters.',
      ],
    },

    gl: null, glCanvas: null, glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.time = 0;
      this.scroll = 0;
      this.ringPhase = 0;
      this.env = { kick: 0, prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0, bass: 0, energy: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.kicks = [];
      this.hatSeed = 0; this.hat = 0;
      this.pairIdx = 0; this.flip = false;   // current pair and whether figure/ground are swapped
      this.prevCols = null; this.wipe = 1e4;
      this.shapeFrom = null; this.shapeMix = 1; this.shapeKind = -1;
      this.rowTable = new Float32Array(ROWS * 2);
      this.dropCount = 0;
    },

    // ---- Atlas: one word per row, stretched to fill it; then its SDF. ----
    buildAtlas(faceIdx) {
      const face = FACES[faceIdx];
      const c = document.createElement('canvas');
      c.width = ATLAS_W; c.height = ATLAS_H;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, ATLAS_W, ATLAS_H);
      g.fillStyle = '#fff';
      g.textBaseline = 'alphabetic';
      const lines = WORDS.concat([HEAD, FOOT]);
      for (let i = 0; i < lines.length; i++) {
        const word = lines[i];
        const ribbon = i >= NW;
        g.font = `${face.weight} 100px ${face.css}`;
        const m = g.measureText(word);
        const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
        const left = m.actualBoundingBoxLeft, wid = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        // Word rows leave a gutter for the swell and the outlines; ribbon rows
        // fill their band (the shader pads them).
        const padX = ribbon ? 6 : 14, padY = ribbon ? 6 : 17;
        const sx = (ATLAS_W - 2 * padX) / Math.max(1, wid);
        const sy = (ROW_H - 2 * padY) / Math.max(1, asc + desc);
        g.save();
        g.translate(padX, i * ROW_H + padY);
        g.scale(sx, sy);
        g.fillText(word, left, asc);
        g.restore();
      }
      const img = g.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
      const n = ATLAS_W * ATLAS_H;
      const mask = new Float32Array(n);
      for (let i = 0; i < n; i++) mask[i] = img[i * 4] / 255;
      const sdf = new Float32Array(n);
      signedField(mask, ATLAS_W, ATLAS_H, sdf);
      for (let i = 0; i < n; i++) sdf[i] = clamp(sdf[i], -SDF_CLAMP, SDF_CLAMP);
      return sdf;
    },

    initGL() {
      this.glCanvas = document.createElement('canvas');
      const gl = this.glCanvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
      if (!gl) { this.glFailed = true; return; }
      try {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.bindAttribLocation(prog, 0, 'pos');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        this.prog = prog;
      } catch (err) {
        console.warn(String(err));
        this.glFailed = true;
        return;
      }
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const mk = () => {
        const tx = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tx;
      };
      this.texAtlas = mk(); this.texRow = mk(); this.texSil = mk();
      this.atlasKey = '';
      const U = {};
      for (const name of ['uRes', 'uStage', 'uAtlas', 'uRow', 'uSil', 'uSilBox', 'uTime', 'uScroll', 'uMelt', 'uSwell',
        'uOutlines', 'uThird', 'uRingPhase', 'uKick', 'uFig', 'uGrd', 'uInk', 'uFigP', 'uGrdP', 'uInkP', 'uWipe',
        'uHat', 'uHatSeed', 'uHead', 'uFoot']) U[name] = gl.getUniformLocation(this.prog, name);
      this.U = U;
      this.gl = gl;
    },

    ensureAtlas(faceIdx) {
      const face = FACES[faceIdx];
      const ok = !window.VIZ_FONTS || VIZ_FONTS.has(face.family);
      const key = faceIdx + '|' + ok;
      if (key === this.atlasKey) return;
      // While a face is still loading, re-check about once a second rather
      // than rebuilding the atlas (tens of ms) on every frame.
      if (!ok && this.atlasKey && this.atlasKey.startsWith(faceIdx + '|') && (this.time - (this.atlasTry || 0)) < 1) return;
      this.atlasTry = this.time;
      this.atlasCache = this.atlasCache || {};
      let sdf = this.atlasCache[key];
      if (!sdf) { sdf = this.buildAtlas(faceIdx); if (ok) this.atlasCache[key] = sdf; }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texAtlas);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, ATLAS_W, ATLAS_H, 0, gl.RED, gl.FLOAT, sdf);
      this.atlasKey = key;
    },

    // Row table (centre, half-width) for the current shape, breathing and swaying.
    buildRows(kind, box, bass, melt) {
      const T = this.time;
      const tab = this.rowTable;
      const from = this.shapeFrom;
      const mixS = this.shapeMix * this.shapeMix * (3 - 2 * this.shapeMix);
      for (let i = 0; i < ROWS; i++) {
        const t = i / (ROWS - 1);
        let hw = shapeHW(kind, t);
        if (from !== null && mixS < 1) hw = lerp(shapeHW(from, t), hw, mixS);
        // Breathing with the bass; slow ripples down the edge (the melt).
        hw *= 1 + 0.05 * bass;
        const edge = 0.025 * (0.4 + melt) * Math.sin(t * 13 - T * 1.3) + 0.015 * melt * Math.sin(t * 29 + T * 0.8);
        hw = hw > 0.01 ? hw + edge * Math.min(1, hw * 4) : hw;
        // Sway grows toward the top, like a flame in a draught.
        const sway = (kind === 0 ? 0.16 : 0.05) * (0.6 + 0.4 * melt) * (1 - t) * (1 - t) * Math.sin(T * 0.7 + t * 4.5)
          + 0.02 * melt * Math.sin(T * 1.9 + t * 9);
        tab[i * 2] = box.cx + sway * box.W;
        tab[i * 2 + 1] = Math.max(0, hw) * box.W;
      }
    },

    // Coarse signed distance of the silhouette on a stage-covering grid.
    buildSil(ctx, box) {
      const cs = 600 / GRID;
      const gw = Math.ceil(ctx.width / cs) + 1, gh = Math.ceil(ctx.height / cs) + 1;
      if (!this.silMask || this.silW !== gw || this.silH !== gh) {
        this.silW = gw; this.silH = gh;
        this.silMask = new Float32Array(gw * gh);
        this.silOut = new Float32Array(gw * gh);
      }
      const tab = this.rowTable, mask = this.silMask;
      for (let y = 0; y < gh; y++) {
        const vy = (y + 0.5) * (ctx.height / gh);
        const t = (vy - box.top) / box.H;
        let cx = 0, hw = -1;
        if (t >= 0 && t <= 1) {
          const fi = t * (ROWS - 1), i0 = Math.floor(fi), i1 = Math.min(ROWS - 1, i0 + 1), f = fi - i0;
          cx = lerp(tab[i0 * 2], tab[i1 * 2], f);
          hw = lerp(tab[i0 * 2 + 1], tab[i1 * 2 + 1], f);
        }
        for (let x = 0; x < gw; x++) {
          const vx = (x + 0.5) * (ctx.width / gw);
          mask[y * gw + x] = hw > 0 && Math.abs(vx - cx) < hw ? 1 : 0;
        }
      }
      signedField(mask, gw, gh, this.silOut);
      // Grid cells to virtual units; and half a cell so the edge sits on the boundary.
      const sc = ctx.width / gw;
      const out = this.silOut;
      for (let i = 0; i < out.length; i++) out[i] = (out[i] > 0 ? out[i] - 0.5 : out[i] + 0.5) * sc;
      return out;
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.kicks.unshift({ age: 0, amp: (0.55 + 0.45 * kRaw) * push });
        this.kicks.length = Math.min(this.kicks.length, 3);
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      // A swap needs the last wipe to have travelled; a snare roll cannot strobe.
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.6 && push > 0.05) {
        since.snare = 0;
        this.swap();
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
        this.hat = Math.max(this.hat, (0.5 + 0.5 * hRaw) * Math.min(1, push));
      }
      e.prevH = hRaw;
      this.hat *= Math.exp(-dt / 0.12);

      e.bass = ease(e.bass, clamp01((s[0] * 0.3 + s[1] + s[2]) / 190), 3, dt);
      let tot = 0;
      for (let i = 0; i < 9; i++) tot += s[i];
      e.energy = ease(e.energy, tot / 900, 0.8, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; this.dropCount++; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    inksNow(params) {
      const mode = Math.round(params.inks);
      const pi = mode === 0 ? this.pairIdx % PAIRS.length : mode - 1;
      const pr = PAIRS[pi];
      const fig = this.flip ? pr.b : pr.a, grd = this.flip ? pr.a : pr.b;
      return { fig: hex(fig), grd: hex(grd), ink: hex(pr.ink) };
    },

    swap() {
      this.prevCols = this.inksNow(this.lastParams);
      if (this.flip && Math.round(this.lastParams.inks) === 0) this.pairIdx++;
      this.flip = !this.flip;
      this.wipe = -400;
    },

    draw(p, signals, params, ctx) {
      if (!this.env) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.time += dt;
      this.lastParams = params;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      if (this.glFailed) { p.background(20); return; }
      if (!this.gl) { this.initGL(); if (this.glFailed) { p.background(20); return; } }
      const gl = this.gl;
      const faceIdx = clamp(Math.round(params.face), 0, FACES.length - 1);
      this.ensureAtlas(faceIdx);

      // Shape changes morph over a second instead of cutting.
      // Following the track, each drop after the first moves on to the next
      // silhouette, so a long set does not sit on one shape; off, the param rules.
      const shapeStep = follow ? Math.max(0, this.dropCount - 1) : 0;
      const kind = (clamp(Math.round(params.shape), 0, SHAPES.length - 1) + shapeStep) % SHAPES.length;
      if (this.shapeKind < 0) this.shapeKind = kind;
      if (kind !== this.shapeKind) { this.shapeFrom = this.shapeKind; this.shapeKind = kind; this.shapeMix = 0; }
      this.shapeMix = Math.min(1, this.shapeMix + dt / 1.2);

      // Layout: silhouette in the middle, ribbons at head and foot.
      const W = ctx.width, H = ctx.height;
      // A flame is tall and narrow; the lamp and urn carry more width.
      const box = { top: H * 0.125, H: H * 0.725, cx: W / 2, W: 0 };
      const wTarget = Math.min(H * [0.3, 0.36, 0.38][kind], W * 0.44);
      this.boxW = this.boxW ? ease(this.boxW, wTarget, 2.5, dt) : wTarget;
      box.W = this.boxW;
      this.buildRows(kind, box, e.bass * push, P.melt);
      const sil = this.buildSil(ctx, box);

      // Motion: words rise, rings travel outward; speeds follow the energy.
      this.scroll += dt * P.flow * (0.12 + 0.5 * e.energy);
      this.ringPhase += dt * (0.12 + 0.9 * e.energy) * (0.35 + 0.65 * P.flow);
      for (const k of this.kicks) k.age += dt;
      this.kicks = this.kicks.filter((k) => k.age < 1.1);
      this.wipe += dt * 1400;

      const dw = Math.round(p.width * p.pixelDensity()), dh = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== dw || this.glCanvas.height !== dh) { this.glCanvas.width = dw; this.glCanvas.height = dh; }
      gl.viewport(0, 0, dw, dh);
      gl.useProgram(this.prog);

      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texRow);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, ROWS, 1, 0, gl.RG, gl.FLOAT, this.rowTable);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texSil);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, this.silW, this.silH, 0, gl.RED, gl.FLOAT, sil);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texAtlas);

      const U = this.U;
      gl.uniform1i(U.uAtlas, 0); gl.uniform1i(U.uRow, 1); gl.uniform1i(U.uSil, 2);
      gl.uniform2f(U.uRes, dw, dh);
      gl.uniform2f(U.uStage, W, H);
      gl.uniform4f(U.uSilBox, box.top, box.H, box.cx, box.W);
      gl.uniform1f(U.uTime, this.time);
      gl.uniform1f(U.uScroll, this.scroll);
      gl.uniform1f(U.uMelt, P.melt);
      gl.uniform1f(U.uSwell, (-2 + 9 * e.bass) * Math.min(push, 1.5));
      gl.uniform1f(U.uOutlines, clamp01(P.outlines));
      gl.uniform1f(U.uThird, P.third);
      gl.uniform1f(U.uRingPhase, this.ringPhase);
      const kk = new Float32Array(9);
      for (let i = 0; i < 3; i++) {
        const k = this.kicks[i];
        if (!k) continue;
        const u = k.age / 1.1;
        kk[i * 3] = 1.05 - 1.2 * u;                       // climbs base to top
        kk[i * 3 + 1] = 26 * k.amp * Math.sin(Math.PI * Math.min(1, u * 3)) * (1 - u); // quick rise, long fade
      }
      gl.uniform3fv(U.uKick, kk);
      const cur = this.inksNow(params);
      const prev = this.prevCols || cur;
      gl.uniform3fv(U.uFig, cur.fig); gl.uniform3fv(U.uGrd, cur.grd); gl.uniform3fv(U.uInk, cur.ink);
      gl.uniform3fv(U.uFigP, prev.fig); gl.uniform3fv(U.uGrdP, prev.grd); gl.uniform3fv(U.uInkP, prev.ink);
      gl.uniform1f(U.uWipe, this.wipe);
      gl.uniform1f(U.uHat, this.hat);
      gl.uniform1f(U.uHatSeed, this.hatSeed);
      const bh = H * 0.075, margin = W * 0.05;
      gl.uniform4f(U.uHead, H * 0.075, bh, H * 0.018, margin);
      gl.uniform4f(U.uFoot, H * 0.925, bh, H * 0.018, margin);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, W, H);
    },
  });
})();
