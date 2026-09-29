// Skyspace — lying on the bench of a Turrell skyspace, looking up.
//
// A plain square room: plaster walls, a ledge just under the ceiling that
// hides the cove light washing the ceiling in one flat colour, and a sharp,
// knife-edged square cut in the ceiling onto the sky. The sky is the sky:
// a real zenith-to-horizon gradient for the hour, drifting cirrus, stars
// after dusk. The ceiling's light slowly changes colour (a Turrell light
// programme) while the sky stays itself, so simultaneous contrast makes the
// sky seem to change as the ceiling pushes against it.
//
// Music, each in its own place:
// - kick: one swift darts into the aperture from behind the ceiling edge and
//   crosses it, never in the same place twice; every swift already in the
//   square beats its wings on the kick and glides between beats.
// - snare / clap: a pale gull, lower and larger, glides across on a curve.
// - hats: a star (or a high speck catching the sun) glints for a moment.
// - pad: the sky's hue and value, slowly. Bass: the wind in the cirrus and
//   the speed at which the room turns overhead.
// - drop: the cove light brings the ceiling to the sky's luminance, so the
//   edge of the aperture dissolves and the sky reads as a flat painted
//   square on the ceiling (the Turrell effect); the light's colour deepens,
//   the wind rises, the room turns faster, and a high flock of swifts wheels
//   through. The breakdown restores the edge.
//
// Craft notes:
// - One full-screen shader ray-casts the room from a slowly wandering eye:
//   ceiling plane, four walls with the ledge and its LED wash, and, through
//   the aperture, a sky whose clouds sit on a plane 100x further away than
//   the ceiling. So when the eye moves, the aperture slides across the sky
//   with real parallax, and the sky never sticks to the hole.
// - The aperture edge is anti-aliased with fwidth of the square's signed
//   distance, and has only a one-pixel sky-lit lip that fades in the drop:
//   Turrell bevels the edge to nothing so the edge itself never shows.
// - Birds, gulls and the high flock are drawn in Canvas 2D over the shader
//   with the same camera, clipped to the aperture's projected square.
// - Ceiling luminance is set from the sky's own luminance at the aperture's
//   centre, computed with the shader's sky formula in JS: brighter than a
//   dusk sky, darker than a day sky, equal in the drop. No glow anywhere.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const RM = 4.0;      // room half-width, m
  const HC = 5.0;      // ceiling height
  const AP = 1.45;      // aperture half-size
  const EYE = 1.15;    // eye height (lying on the bench)
  const FV = 470;      // focal length in virtual units (short side is 600)

  // Cove light programmes: the ceiling glides slowly through these.
  const PROGRAMMES = [
    { name: 'Dusk programme', c: ['#f0b497', '#d995ae', '#b3a3db', '#e9c37a', '#ecd5bf'] },
    { name: 'Chalk', c: ['#e9e4da', '#dcd9d2', '#e8ddcc', '#d8dbe0'] },
    { name: 'Ochre and violet', c: ['#dca448', '#8f6bbb', '#c86e3c', '#a58fd6'] },
    { name: 'Against the blue', c: ['#ec9a4c', '#e5794f', '#f0b65a', '#dc8a6a'] },
    { name: 'Roden rose', c: ['#e39aa2', '#c77fb0', '#eab2a0', '#b890c8'] },
  ];

  // Sky by hour: 0 midday, 0.35 late afternoon, 0.55 sunset, 0.75 blue hour, 1 night.
  const HOURS = [0, 0.35, 0.55, 0.75, 1];
  const ZEN = ['#3f7cc8', '#4f83c2', '#4668a6', '#25387a', '#0a1230'];
  const HOR = ['#a9cbe8', '#c4d3de', '#e3a888', '#5e5c96', '#1b2144'];
  const CLIT = ['#ffffff', '#fbf2e4', '#ffc9a0', '#c190b0', '#2b3152'];
  const CSHADE = ['#b7c2d0', '#a9b0bd', '#8a7890', '#3b3e68', '#111830'];

  const PRESETS = {
    calm: { match: 0.12, sat: 0.75, wind: 0.6, turn: 0.6, flock: 0, clouds: 0.35 },
    drop: { match: 0.96, sat: 0.95, wind: 1.9, turn: 1.4, flock: 1, clouds: 0.25 },
    // The classic night visit: a bright ceiling round a black-blue square.
    'blue hour': { hour: 0.8, light: 4, match: 0.1, sat: 0.55, wind: 0.5, turn: 0.5, flock: 0, clouds: 0.2 },
    'clear day': { hour: 0.1, light: 3, match: 0.5, sat: 0.8, wind: 0.8, turn: 0.7, flock: 0.6, clouds: 0.55 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['match', 'sat', 'wind', 'turn', 'flock', 'clouds'];

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 res;
uniform float F, pxs;
uniform vec3 camP, camR, camU, camF;
uniform vec3 ceilC, coveC;
uniform float edgeK;
uniform vec3 zen, hor, sunD, sunC, cLit, cShade;
uniform float cover, starK, T;
uniform vec2 cOff;
uniform vec4 gls[6];
out vec4 o;

const float HC = ${HC.toFixed(2)};
const float RM = ${RM.toFixed(2)};
const float AP = ${AP.toFixed(2)};

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    // Each octave drifts on its own, so the cirrus forms and frays as it goes.
    s += a * vnoise(p + vec2(T * 0.011 * float(i + 1), -T * 0.006 * float(i)));
    p = m * p;
    a *= 0.5;
  }
  return s;
}

vec3 sky(vec3 d) {
  float e = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(hor, zen, pow(e, 0.6));
  c += sunC * pow(max(dot(d, sunD), 0.0), 6.0) * 0.16;
  vec2 uv = d.xz / max(d.y, 0.05);
  // Stars on the same far plane, visible after dusk.
  float cl = 0.0;
  vec2 cuv = vec2(uv.x * 2.4, uv.y * 5.5) + cOff;   // stretched along the wind: cirrus
  if (cover > 0.001) {
    float n = fbm(cuv);
    float th = mix(0.7, 0.3, cover);
    cl = smoothstep(th, th + 0.24, n);
    float n2 = fbm(cuv + sunD.xz * 0.12);
    float lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.0);
    c = mix(c, mix(cShade, cLit, lit), cl * 0.9);
  }
  if (starK > 0.001) {
    vec2 sv = uv * 22.0;
    vec2 cell = floor(sv);
    float r = h21(cell);
    vec2 off = vec2(h21(cell + 3.1), h21(cell + 7.7)) - 0.5;
    float dist = length(fract(sv) - 0.5 - off * 0.7) / 22.0;
    float px = fwidth(uv.x) + 1e-6;
    float st = step(r, 0.3) * smoothstep(1.3 * px, 0.2 * px, dist) * (0.35 + 0.65 * h21(cell + 1.3));
    c += vec3(0.95, 0.95, 1.0) * st * starK * (1.0 - cl);
  }
  // Hat glints: a star catching for a moment, a small four-point sparkle.
  for (int i = 0; i < 6; i++) {
    vec4 g = gls[i];
    if (g.w > 0.001) {
      vec3 v = d - g.xyz;
      float dx = dot(v, camR) * F / pxs, dy = dot(v, camU) * F / pxs;   // virtual units
      float core = exp(-(dx * dx + dy * dy) * 0.3);
      float spk = (exp(-abs(dx) * 0.3) * exp(-dy * dy * 1.5) + exp(-abs(dy) * 0.3) * exp(-dx * dx * 1.5)) * 0.45;
      c += vec3(1.0, 0.97, 0.9) * (core + spk) * g.w * (1.0 - 0.8 * cl);
    }
  }
  return c;
}

void main() {
  vec2 fc = gl_FragCoord.xy - res * 0.5;
  vec3 d = normalize(camF * F + camR * fc.x + camU * fc.y);
  vec3 P = camP;
  float tc = d.y > 1e-4 ? (HC - P.y) / d.y : 1e9;
  // Not sign(): it is 0 for an exactly vertical component, which sent the
  // odd ceiling pixel to a wall behind the eye as a black speck.
  float sx = d.x >= 0.0 ? 1.0 : -1.0, sz = d.z >= 0.0 ? 1.0 : -1.0;
  float tx = (sx * RM - P.x) / (sx * max(abs(d.x), 1e-5));
  float tz = (sz * RM - P.z) / (sz * max(abs(d.z), 1e-5));
  float tw = min(tx, tz);
  vec3 Q = P + d * min(tc, 1e3);
  float sdf = max(abs(Q.x), abs(Q.z)) - AP;
  float aa = max(fwidth(sdf), 1e-5);
  vec3 col;
  if (tc < tw) {
    float dEdge = RM - max(abs(Q.x), abs(Q.z));
    // The cove washes the ceiling from its edges in the light's own colour;
    // across the middle the ceiling is even, at ceilC by the aperture.
    float light = 0.97 + 0.1 * exp(-dEdge / 2.0);
    // Plaster: a very low-frequency unevenness, never grain that could shimmer.
    light *= 1.0 + 0.012 * (vnoise(Q.xz * 1.3) - 0.5);
    col = mix(ceilC * light, coveC, clamp(1.15 * exp(-dEdge / 0.75), 0.0, 1.0));
    if (sdf < aa * 3.0) {
      float inside = smoothstep(aa, -aa, sdf);
      vec3 s = sky(d);
      // The knife edge: a single sky-lit pixel of lip on the ceiling side.
      float lip = edgeK * smoothstep(aa * 2.2, 0.0, sdf) * (1.0 - inside);
      col = mix(col, col * 1.1 + 0.035, lip);
      col = mix(col, s, inside);
    }
  } else {
    vec3 Wp = P + d * tw;
    float y = Wp.y;
    float face = tx < tz ? 0.9 : 1.0;
    float aw = max(fwidth(y), 1e-5);
    float ledge = HC - 0.5;
    // Below the ledge: the wall in the room's indirect light.
    vec3 below = mix(ceilC, coveC, 0.5) * face * (0.5 + 0.1 * smoothstep(0.0, ledge, y));
    // Above it: the hidden LEDs wash the wall up into the ceiling.
    vec3 above = coveC * face * (0.95 + 0.3 * exp(-(y - ledge) / 0.14));
    col = mix(below, above, smoothstep(ledge - aw, ledge + aw, y));
    // The ledge's underside: a dark band seen from below.
    float lip = smoothstep(ledge - 0.08 - aw, ledge - 0.08 + aw, y) * (1.0 - smoothstep(ledge - aw, ledge + aw, y));
    col = mix(col, coveC * face * 0.3, lip);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const Z = ZEN.map(hex), HR = HOR.map(hex), CL = CLIT.map(hex), CS = CSHADE.map(hex);
  const PROG = PROGRAMMES.map((q) => q.c.map(hex));

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function lin(x) { return Math.pow(Math.max(0, x), 2.2); }
  // Relative luminance from linear light: sRGB luma rates a saturated blue
  // sky far brighter than it looks, and the match would miss.
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function byHour(tab, h) {
    for (let i = 0; i < HOURS.length - 1; i++) {
      if (h <= HOURS[i + 1]) return mix3(tab[i], tab[i + 1], smooth(0, 1, (h - HOURS[i]) / (HOURS[i + 1] - HOURS[i])));
    }
    return tab[tab.length - 1];
  }
  function css(c, a) {
    return 'rgba(' + Math.round(clamp01(c[0]) * 255) + ',' + Math.round(clamp01(c[1]) * 255) + ',' + Math.round(clamp01(c[2]) * 255) + ',' + (a === undefined ? 1 : a).toFixed(3) + ')';
  }
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  VIZ.register({
    id: 'skyspace',
    name: 'Skyspace',
    order: 822,

    params: [
      // The sky's hour: midday blue through sunset to blue hour and night.
      { key: 'hour', label: 'Hour of the sky', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'light', label: 'Light programme', type: 'select', options: PROGRAMMES.map((q) => q.name), default: 0 },
      { key: 'sat', label: 'Colour of the light', type: 'range', min: 0, max: 1, default: PRESETS.calm.sat, step: 0.01 },
      // 0: the ceiling at its own level, the aperture a sharp hole; 1: the
      // ceiling at the sky's luminance, the edge dissolved.
      { key: 'match', label: 'Dissolve the edge', type: 'range', min: 0, max: 1, default: PRESETS.calm.match, step: 0.01 },
      { key: 'clouds', label: 'Cirrus', type: 'range', min: 0, max: 1, default: PRESETS.calm.clouds, step: 0.01 },
      { key: 'wind', label: 'Wind', type: 'range', min: 0, max: 3, default: PRESETS.calm.wind, step: 0.01 },
      { key: 'turn', label: 'Room turning', type: 'range', min: 0, max: 3, default: PRESETS.calm.turn, step: 0.01 },
      { key: 'flock', label: 'Swifts high up', type: 'range', min: 0, max: 1, default: PRESETS.calm.flock, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Skyspace',
      technique: 'WebGL2 ray-cast room (ceiling plane, walls, ledge and LED wash) with a knife-edged square aperture onto a physical sky: hour-dependent zenith gradient, stretched fbm cirrus lit toward the sun on a far plane (real parallax against the aperture as the eye wanders), a star field and hat glints; swifts, gulls and a high wheeling flock drawn in Canvas 2D with the same camera and clipped to the projected aperture; ceiling luminance set from the sky\'s own luminance so the drop brings them level',
      brief: 'Lying on the bench of a James Turrell skyspace, looking up: a plain plaster room, a cove light washing the ceiling in one slowly changing colour, and a razor-edged square cut in the ceiling onto the sky, which drifts with thin cirrus and deepens with the hour. The room turns very slowly overhead as the eye wanders, and the aperture slides across the sky with real parallax. Each kick sends one swift darting in from behind the ceiling edge and across the square, never in the same place twice, and every swift already there beats its wings on the beat; each clap sends a pale gull gliding across on a curve; hats make a star glint; the pad moves the sky\'s hue and value. The drop brings the ceiling to the sky\'s luminance so the edge of the aperture dissolves and the sky becomes a flat painted square, the light\'s colour deepens, the wind and the turning quicken and a high flock of swifts wheels through; the breakdown gives the edge back.',
      lineage: [
        'Batch 06, idea "Skyspace" (the Curator): Turrell\'s Skyspaces; Mobile\'s white room used as a material; Sumi\'s single confined event. A ceiling with a square aperture onto drifting sky; the kick sends one bird across; the drop brings sky and ceiling to equal luminance so the edge dissolves.',
        'Approach: a ray-cast room in one WebGL2 shader rather than a flat square on a flat field, because the architecture (walls, the ledge that hides the cove light, the wash up the wall) and the parallax of a far sky against a near hole are what make it a skyspace and not a gradient. Birds in Canvas 2D with the same camera, clipped to the projected aperture.',
        'v1: the room worked first time, but the aperture was small and low in a box of walls, the swifts were specks, and the drop\'s luminance match left a saturated blue square on peach: equal luminance by sRGB luma was not equal to the eye, and equal luminance alone still read as a hole.',
        'v2-v4: closer, more overhead eye and a larger aperture; luminance matched in linear light; in the drop the middle of the ceiling also leans to the sky\'s hue while the rim keeps the light programme\'s colour, so the drop is a gradient from rose or amber at the walls into sky at the aperture and the edge has nothing to hold. Fixed black specks where sign(0) sent a ceiling ray to a wall behind the eye. Jolt: calm, kickArea 0.013, kickMean 0.003, drift 0.003, ratio 1.0; build kick 0.01.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.phi = 0.8;
      this.cOff = [0, 0];
      this.progPhase = 0;
      this.env = { kick: 0, prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, pad: 0.2, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.birds = [];
      this.gulls = [];
      this.glints = [];
      this.kickCount = 0;
      this.snareCount = 0;
      this.flap = 0;
      this.R = rng(822);
      this.flockBirds = [];
      const r = rng(5);
      for (let i = 0; i < 34; i++) {
        this.flockBirds.push({ rad: 5 + r() * 16, a: r() * TAU, w: (0.28 + r() * 0.3) * (r() < 0.2 ? -1 : 1), alt: 55 + r() * 30, ph: r() * TAU, bob: r() * TAU });
      }
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
      for (const n of ['res', 'F', 'pxs', 'camP', 'camR', 'camU', 'camF', 'ceilC', 'coveC', 'edgeK', 'zen', 'hor', 'sunD', 'sunC',
        'cLit', 'cShade', 'cover', 'starK', 'T', 'cOff', 'gls']) u[n] = gl.getUniformLocation(prog, n);
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Onsets against slow baselines (as in Mobile and Sumi), so a pad or a
    // riser lifting a whole band does not read as a hit; only a jump does.
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kick = 0, snare = 0, hat = 0;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kick = kRaw; }
      e.prevK = kRaw;
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snare = 0.6 + 0.4 * sRaw; }
      e.prevS = sRaw;
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hat = 0.5 + 0.5 * hRaw; }
      e.prevH = hRaw;
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 150), 1.2, dt);
      // The pad moves the sky slowly: bands 2–4, eased over seconds.
      e.pad = ease(e.pad, clamp01((s[2] + s[3] + s[4]) / 180), 0.35, dt);
      // Section follower on the sidechained bass line, with hysteresis.
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, snare, hat };
    },

    // A bird path through the aperture's view cone at altitude `alt` above the
    // ceiling, entering at the square's edge now. `k` walks a low-discrepancy
    // sequence so crossings never repeat a place.
    spawnPath(cam, k, alt, speedDur, curve) {
      const R = this.R;
      const u = ((k * 0.6180339887) % 1) * 2 - 1, v = ((k * 0.7548776662 + 0.31) % 1) * 2 - 1;
      const kk = (HC + alt - cam[1]) / (HC - cam[1]);
      // The aperture's square at this altitude, as seen from the eye.
      const cx = cam[0] + (0 - cam[0]) * kk, cz = cam[2] + (0 - cam[2]) * kk, half = AP * kk;
      const through = [cx + u * half * 0.75, cz + v * half * 0.75];
      const th = R() * TAU;
      const hx = Math.cos(th), hz = Math.sin(th);
      // Walk back from the chosen point to the square's edge.
      let s = 1e9;
      if (Math.abs(hx) > 1e-4) s = Math.min(s, ((hx > 0 ? through[0] - (cx - half) : (cx + half) - through[0])) / Math.abs(hx));
      if (Math.abs(hz) > 1e-4) s = Math.min(s, ((hz > 0 ? through[1] - (cz - half) : (cz + half) - through[1])) / Math.abs(hz));
      const cross = 2 * half;
      const speed = cross / speedDur;
      // Start a hair inside the edge, so the bird is there on the beat.
      const back = Math.max(0, s - half * 0.06);
      return {
        x: through[0] - hx * back, z: through[1] - hz * back, y: HC + alt, th,
        speed, turn: curve ? (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.25) : 0,
        age: 0, life: (back + cross * 1.6) / speed, flap: 1, ph: R() * TAU,
      };
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(now - this.lastT, 0, 0.1);
      this.lastT = now;
      if (!this.env) this.enter();
      this.T += dt;
      const T = this.T;
      const e = this.env;
      const hits = this.listen(signals, dt);
      const push = params.push;

      const follow = Math.round(params.follow) === 1;
      // Slow both ways: Turrell light changes over seconds, never at once.
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 0.75 : 0.4, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // ---- the eye: wanders on the bench, gaze drifting round the aperture,
      // the room turning slowly overhead. The bass hurries it, never jerks it.
      this.phi += dt * P.turn * 0.035 * (1 + 0.6 * e.bass);
      const phi = this.phi;
      const cam = [0.7 * Math.sin(phi * 0.71 + 1.3), EYE + 0.15 * Math.sin(phi * 0.9), 0.7 * Math.cos(phi * 0.53) - 0.2];
      const tgt = [1.05 * Math.cos(phi), HC, 1.05 * Math.sin(phi * 0.83 + 0.4)];
      const cf = norm(sub(tgt, cam));
      const ha = phi * 0.8 + 0.4;
      const hv = [Math.cos(ha), 0, Math.sin(ha)];
      const d0 = dot(hv, cf);
      const cu = norm([hv[0] - cf[0] * d0, hv[1] - cf[1] * d0, hv[2] - cf[2] * d0]);
      const cr = cross(cf, cu);
      const proj = (q) => {
        const v = sub(q, cam);
        const z = Math.max(0.05, dot(v, cf));
        return [W / 2 + FV * dot(v, cr) / z, H / 2 - FV * dot(v, cu) / z, z];
      };

      // ---- the sky for the hour; the pad nudges its hue and value.
      const hour = clamp01(params.hour + 0.07 * (e.pad - 0.3));
      const val = 1 + 0.1 * (e.pad - 0.3);
      const zen = byHour(Z, hour).map((x) => x * val), hor = byHour(HR, hour).map((x) => x * val);
      const cLit = byHour(CL, hour), cShade = byHour(CS, hour);
      const sunEl = (60 - 75 * hour) * Math.PI / 180;
      const sunAz = 0.6 + T * 0.004;
      const sunD = [Math.cos(sunEl) * Math.cos(sunAz), Math.sin(sunEl), Math.cos(sunEl) * Math.sin(sunAz)];
      const sunC = mix3([1, 0.96, 0.88], [1, 0.62, 0.38], smooth(0.3, 0.6, hour)).map((x) => x * (1 - smooth(0.6, 0.8, hour)));
      const skyAt = (d) => {
        const el = clamp01(d[1]);
        const c = mix3(hor, zen, Math.pow(el, 0.6));
        const sd = Math.pow(Math.max(0, dot(d, sunD)), 6) * 0.16;
        return [c[0] + sunC[0] * sd, c[1] + sunC[1] * sd, c[2] + sunC[2] * sd];
      };
      const dc = norm(sub([0, HC, 0], cam));
      const skyC = skyAt(dc);
      const skyL = lum(skyC);
      // Cirrus in the aperture lifts its apparent luminance a little by day.
      const skyLm = skyL + P.clouds * 0.12 * (lum(cLit) - skyL) * 0.5;

      // ---- the cove light: glides through its programme; the drop hurries it.
      this.progPhase += dt / (14 - 6 * e.auto);
      const prog = PROG[Math.max(0, Math.min(PROG.length - 1, Math.round(params.light)))];
      const pi = Math.floor(this.progPhase), pf = smooth(0.55, 1, this.progPhase - pi);
      let lc = mix3(prog[pi % prog.length], prog[(pi + 1) % prog.length], pf);
      const grey = Math.pow(lum(lc), 1 / 2.2);
      lc = mix3([grey, grey, grey], lc, P.sat);
      const atLum = (c, L) => { const k = Math.pow(L / Math.max(0.002, lum(c)), 1 / 2.2); return c.map((x) => x * k); };
      // Its own level: brighter than a dusk sky, darker than a day sky.
      const tDay = smooth(0.06, 0.13, skyLm);
      const own = Math.min(0.42, skyLm * 3.5 + 0.12) * (1 - tDay) + skyLm * 0.7 * tDay;
      const target = own + (skyLm - own) * P.match;
      // The middle of the ceiling matches luminance first, then leans toward
      // the sky's own hue: equal luminance alone left a blue square on
      // lavender that still read as a hole. The rim keeps the programme's
      // colour, so the drop is a gradient from the light's colour at the
      // walls into sky at the aperture, and the edge has nothing to hold.
      const ceilC = atLum(mix3(lc, skyC, 0.97 * smooth(0.3, 1, P.match)), target);
      const coveC = atLum(lc, Math.min(0.75, target * 1.9 + 0.02));
      const edgeK = 1 - smooth(0.5, 0.95, P.match);

      // ---- clouds and wind
      this.cOff[0] += dt * P.wind * 0.07 * (1 + 0.8 * e.bass);
      this.cOff[1] += dt * P.wind * 0.012;

      // ---- events
      if (hits.kick > 0 && push > 0.01) {
        for (const b of this.birds) b.flap = Math.min(1.4, b.flap + 1);
        if (this.birds.length < 10) {
          const b = this.spawnPath(cam, this.kickCount + 1, 5 + this.R() * 5, 1.3 + this.R() * 0.6, false);
          b.kind = 'swift';
          this.birds.push(b);
        }
        this.kickCount++;
      }
      if (hits.snare > 0 && push > 0.01 && this.gulls.length < 3) {
        const b = this.spawnPath(cam, this.snareCount * 3 + 7, 4.5 + this.R() * 2, 2.4 + this.R() * 0.8, true);
        b.kind = 'gull';
        this.gulls.push(b);
        this.snareCount++;
      }
      if (hits.hat > 0 && push > 0.01) {
        const a = [(this.R() * 2 - 1) * AP * 0.95, HC, (this.R() * 2 - 1) * AP * 0.95];
        const gd = norm(sub(a, cam));
        this.glints.push({ d: gd, age: 0, amp: Math.min(1.3, hits.hat * push) });
        if (this.glints.length > 6) this.glints.shift();
      }
      for (const arr of [this.birds, this.gulls]) {
        for (const b of arr) {
          b.age += dt;
          b.th += b.turn * dt;
          b.x += Math.cos(b.th) * b.speed * dt;
          b.z += Math.sin(b.th) * b.speed * dt;
          b.flap = b.flap * Math.exp(-dt / 0.35);
          // Wings beat fast while the flap lasts, and glide between.
          b.ph += dt * (b.kind === 'gull' ? 3.2 : 9 + 26 * Math.min(1, b.flap));
        }
      }
      this.birds = this.birds.filter((b) => b.age < b.life);
      this.gulls = this.gulls.filter((b) => b.age < b.life);
      for (const q of this.glints) q.age += dt;
      this.glints = this.glints.filter((q) => q.age < 0.45);

      // ---- the room, the sky
      if (!this.gl && !this.glFailed) this.initGL();
      const pd = p.pixelDensity();
      const w = Math.round(p.width * pd), h = Math.round(p.height * pd);
      const pxs = w / W;
      p.colorMode(p.RGB, 255);
      p.blendMode(p.BLEND);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (this.gl) {
        const gl = this.gl, u = this.u;
        if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.res, w, h);
        gl.uniform1f(u.F, FV * pxs);
        gl.uniform1f(u.pxs, pxs);
        gl.uniform3fv(u.camP, cam);
        gl.uniform3fv(u.camR, cr);
        gl.uniform3fv(u.camU, cu);
        gl.uniform3fv(u.camF, cf);
        gl.uniform3fv(u.ceilC, ceilC);
        gl.uniform3fv(u.coveC, coveC);
        gl.uniform1f(u.edgeK, edgeK);
        gl.uniform3fv(u.zen, zen);
        gl.uniform3fv(u.hor, hor);
        gl.uniform3fv(u.sunD, sunD);
        gl.uniform3fv(u.sunC, sunC);
        gl.uniform3fv(u.cLit, cLit);
        gl.uniform3fv(u.cShade, cShade);
        gl.uniform1f(u.cover, P.clouds);
        gl.uniform1f(u.starK, smooth(0.62, 0.95, hour));
        gl.uniform1f(u.T, T);
        gl.uniform2f(u.cOff, this.cOff[0], this.cOff[1]);
        const gv = new Float32Array(24);
        this.glints.forEach((q, i) => {
          const a = q.age < 0.04 ? q.age / 0.04 : Math.exp(-(q.age - 0.04) / 0.12);
          gv[i * 4] = q.d[0]; gv[i * 4 + 1] = q.d[1]; gv[i * 4 + 2] = q.d[2]; gv[i * 4 + 3] = a * q.amp * 0.9;
        });
        gl.uniform4fv(u.gls, gv);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        g.drawImage(this.glCanvas, 0, 0, W, H);
      } else {
        g.fillStyle = css(ceilC);
        g.fillRect(-2, -2, W + 4, H + 4);
      }

      // ---- the aperture on screen, for clipping what flies through it
      const corners = [[-AP, HC, -AP], [AP, HC, -AP], [AP, HC, AP], [-AP, HC, AP]].map(proj);
      g.save();
      g.beginPath();
      corners.forEach((c, i) => (i ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1])));
      g.closePath();
      if (!this.gl) { g.fillStyle = css(skyC); g.fill(); }
      g.clip();
      g.lineJoin = 'round';

      // Silhouettes read against whatever sky they cross: dark on a day sky,
      // pale (lit from the town below) on a night one.
      const birdCol = (d) => {
        const s = skyAt(d), L = lum(s);
        const t = smooth(0.05, 0.09, L);
        const dark = mix3(s, [0.07, 0.07, 0.09], 0.82), pale = mix3(s, [0.93, 0.9, 0.86], 0.7);
        return mix3(pale, dark, t);
      };

      // The high flock: tiny swifts wheeling round a wandering centre.
      if (P.flock > 0.01) {
        const fc = [0.8 * Math.sin(T * 0.05) * 10, 0, 0.8 * Math.cos(T * 0.037) * 10];
        const rise = smooth(0, 0.6, P.flock);
        const n = Math.round(this.flockBirds.length * smooth(0, 1, P.flock));
        for (let i = 0; i < n; i++) {
          const f = this.flockBirds[i];
          const a = f.a + T * f.w;
          const k2 = (HC + f.alt - cam[1]) / (HC - cam[1]);
          const q = [cam[0] * (1 - k2) + fc[0] + f.rad * Math.cos(a), HC + f.alt, cam[2] * (1 - k2) + fc[2] + f.rad * Math.sin(a) * 0.7];
          const s0 = proj(q);
          const hd = [-Math.sin(a) * Math.sign(f.w), 0, Math.cos(a) * 0.7 * Math.sign(f.w)];
          const s1 = proj([q[0] + hd[0], q[1], q[2] + hd[2]]);
          const size = FV * 0.45 / s0[2];
          drawSwift(g, s0[0], s0[1], Math.atan2(s1[1] - s0[1], s1[0] - s0[0]), size, 0.6 + 0.4 * Math.cos(T * 14 * (0.8 + 0.3 * Math.sin(f.ph)) + f.ph), css(birdCol(norm(sub(q, cam))), rise));
        }
      }

      // Swifts on the kick.
      const react = Math.min(1.5, push);
      for (const b of this.birds) {
        const q = [b.x, b.y, b.z];
        const s0 = proj(q);
        const s1 = proj([b.x + Math.cos(b.th), b.y, b.z + Math.sin(b.th)]);
        const size = FV * 0.62 / s0[2] * (0.8 + 0.2 * react);
        const f = 0.62 + 0.38 * Math.cos(b.ph);
        drawSwift(g, s0[0], s0[1], Math.atan2(s1[1] - s0[1], s1[0] - s0[0]), size, f, css(birdCol(norm(sub(q, cam)))));
      }
      // Gulls on the clap.
      for (const b of this.gulls) {
        const q = [b.x, b.y, b.z];
        const s0 = proj(q);
        const s1 = proj([b.x + Math.cos(b.th), b.y, b.z + Math.sin(b.th)]);
        const size = FV * 0.75 / s0[2];
        const f = 0.8 + 0.2 * Math.cos(b.ph);
        const sc = skyAt(norm(sub(q, cam)));
        const body = mix3(sc, [0.96, 0.94, 0.9], 0.78 - 0.25 * smooth(0.6, 0.95, hour));
        const tip = mix3(sc, [0.1, 0.1, 0.12], 0.75);
        drawGull(g, s0[0], s0[1], Math.atan2(s1[1] - s0[1], s1[0] - s0[0]), size, f, css(body), css(tip));
      }
      g.restore();
    },
  });

  // A swift from below: crescent wings swept back, a short forked tail.
  // Heading along +x; `s` is the half-span; `f` folds the span as the wings beat.
  function drawSwift(g, x, y, ang, s, f, fill) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0.3 * s, 0);
    g.lineTo(0.1 * s, -0.07 * s);
    g.quadraticCurveTo(0.06 * s, -0.72 * f * s, -0.34 * s, -1.0 * f * s);
    g.quadraticCurveTo(-0.1 * s, -0.42 * f * s, -0.14 * s, -0.07 * s);
    g.lineTo(-0.46 * s, -0.14 * s);
    g.lineTo(-0.33 * s, 0);
    g.lineTo(-0.46 * s, 0.14 * s);
    g.lineTo(-0.14 * s, 0.07 * s);
    g.quadraticCurveTo(-0.1 * s, 0.42 * f * s, -0.34 * s, 1.0 * f * s);
    g.quadraticCurveTo(0.06 * s, 0.72 * f * s, 0.1 * s, 0.07 * s);
    g.closePath();
    g.fill();
    g.restore();
  }

  // A gull from below: long wings bent at the wrist, pale, with dark tips.
  function drawGull(g, x, y, ang, s, f, body, tip) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    for (const side of [-1, 1]) {
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(0.1 * s, 0.06 * side * s);
      g.lineTo(0.16 * s, 0.48 * f * side * s);
      g.lineTo(-0.16 * s, 1.0 * f * side * s);
      g.lineTo(-0.1 * s, 0.5 * f * side * s);
      g.lineTo(-0.16 * s, 0.07 * side * s);
      g.closePath();
      g.fill();
      g.fillStyle = tip;
      g.beginPath();
      g.moveTo(0.02 * s, 0.76 * f * side * s);
      g.lineTo(-0.16 * s, 1.0 * f * side * s);
      g.lineTo(-0.12 * s, 0.72 * f * side * s);
      g.closePath();
      g.fill();
    }
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(-0.05 * s, 0, 0.36 * s, 0.075 * s, 0, 0, TAU);
    g.fill();
    g.restore();
  }
})();
