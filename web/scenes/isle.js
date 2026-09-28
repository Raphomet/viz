// Isle: a toy island diorama, seen from above at an isometric-ish angle and
// turning slowly on its plinth. Flat-shaded low-poly geometry in pastel
// colours, lit by one sun with real shadow-mapped shadows (clouds shade the
// fields and the sea), no glow anywhere. The music lives in separate places:
//   kick   -> the big windmill on the hill clicks round one notch, the gulls
//             round the lighthouse ripple out and back, and a ring runs out
//             across the water from the lighthouse point
//   snare  -> the next boat in the harbour hoists sail and leaves; in the
//             festival a burst of paper confetti goes up over the village
//   bass   -> the wind: the other windmills, the swell, cloud drift, boats
//   hats   -> glints on the sea facets
//   drop   -> the village festival: bunting, lanterns, a turning maypole, lit
//             windows, confetti; the breakdown lets it all go quiet again
//
// Rendering: one WebGL2 context on an offscreen canvas. Every triangle carries
// its own flat normal and colour; a 1024^2 depth pass from the sun gives the
// shadows. The static island is built once (per seed and season) and the
// moving parts (water, sails, boats, birds, clouds, festival) are rebuilt
// into a growable Float32Array every frame. The island turns through the
// model matrix while the sun stays put, so shadows sweep as it turns.

(function () {
  'use strict';

  // ------------------------------------------------------------ small helpers
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(i, j, s) { const h = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, s) { return 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 13); }

  // ------------------------------------------------------------ mesh builder
  // 10 floats a vertex: position, flat normal, rgb, unlit flag.
  function Mesh(cap) { this.d = new Float32Array(cap * 10); this.n = 0; this.at(0, 0, 0, 0, 1); }
  Mesh.prototype.reset = function () { this.n = 0; };
  Mesh.prototype.at = function (x, y, z, ang, k) {
    this.ox = x; this.oy = y; this.oz = z; this.c = Math.cos(ang); this.s = Math.sin(ang); this.k = k || 1; return this;
  };
  Mesh.prototype.W = function (ax, ay, az, bx, by, bz, cx, cy, cz, col, u) {
    if ((this.n + 3) * 10 > this.d.length) { const nd = new Float32Array(this.d.length * 2); nd.set(this.d); this.d = nd; }
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    const d = this.d; let o = this.n * 10;
    const r = col[0], g = col[1], b = col[2], f = u ? 1 : 0;
    d[o++] = ax; d[o++] = ay; d[o++] = az; d[o++] = nx; d[o++] = ny; d[o++] = nz; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = f;
    d[o++] = bx; d[o++] = by; d[o++] = bz; d[o++] = nx; d[o++] = ny; d[o++] = nz; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = f;
    d[o++] = cx; d[o++] = cy; d[o++] = cz; d[o++] = nx; d[o++] = ny; d[o++] = nz; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = f;
    this.n += 3;
  };
  // Local-frame triangle: rotated by the current heading about y, scaled, moved.
  Mesh.prototype.L = function (ax, ay, az, bx, by, bz, cx, cy, cz, col, u) {
    const c = this.c, s = this.s, k = this.k, ox = this.ox, oy = this.oy, oz = this.oz;
    this.W(ox + k * (c * ax - s * az), oy + k * ay, oz + k * (s * ax + c * az),
      ox + k * (c * bx - s * bz), oy + k * by, oz + k * (s * bx + c * bz),
      ox + k * (c * cx - s * cz), oy + k * cy, oz + k * (s * cx + c * cz), col, u);
  };
  Mesh.prototype.LQ = function (a, b, c, d, col, u) {
    this.L(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col, u);
    this.L(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col, u);
  };
  // n-sided (tapered) prism, in local coords, from y to y+h.
  Mesh.prototype.prism = function (x, y, z, r0, r1, h, n, col, cap, a0) {
    a0 = a0 || 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, b = a0 + ((i + 1) / n) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      this.LQ([x + ca * r0, y, z + sa * r0], [x + cb * r0, y, z + sb * r0], [x + cb * r1, y + h, z + sb * r1], [x + ca * r1, y + h, z + sa * r1], col);
      if (cap) this.L(x, y + h, z, x + ca * r1, y + h, z + sa * r1, x + cb * r1, y + h, z + sb * r1, cap);
    }
  };
  Mesh.prototype.cone = function (x, y, z, r, h, n, col, a0) {
    a0 = a0 || 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, b = a0 + ((i + 1) / n) * TAU;
      this.L(x + Math.cos(a) * r, y, z + Math.sin(a) * r, x + Math.cos(b) * r, y, z + Math.sin(b) * r, x, y + h, z, col);
    }
  };
  Mesh.prototype.box = function (x, y, z, sx, sy, sz, top, side, bottom) {
    const x0 = x - sx, x1 = x + sx, z0 = z - sz, z1 = z + sz, y1 = y + sy;
    this.LQ([x0, y, z0], [x1, y, z0], [x1, y1, z0], [x0, y1, z0], side);
    this.LQ([x1, y, z0], [x1, y, z1], [x1, y1, z1], [x1, y1, z0], side);
    this.LQ([x1, y, z1], [x0, y, z1], [x0, y1, z1], [x1, y1, z1], side);
    this.LQ([x0, y, z1], [x0, y, z0], [x0, y1, z0], [x0, y1, z1], side);
    this.LQ([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
    if (bottom) this.LQ([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], bottom);
  };
  // Gable roof over a sx*sz half-extent footprint, ridge along local x.
  Mesh.prototype.roof = function (y, sx, sz, h, ov, col, gable) {
    const X = sx + ov, Z = sz + ov;
    this.LQ([-X, y, -Z], [X, y, -Z], [X, y + h, 0], [-X, y + h, 0], col);
    this.LQ([X, y, Z], [-X, y, Z], [-X, y + h, 0], [X, y + h, 0], shade(col, 0.97));
    this.L(-sx, y, -sz, -sx, y, sz, -sx, y + h * (sz / Z), 0, gable);
    this.L(sx, y, sz, sx, y, -sz, sx, y + h * (sz / Z), 0, gable);
  };
  const ICO = (function () {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map((a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; });
    const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    return { v, f };
  })();
  Mesh.prototype.blob = function (x, y, z, sx, sy, sz, col, u) {
    const v = ICO.v;
    for (const f of ICO.f) {
      const a = v[f[0]], b = v[f[1]], c = v[f[2]];
      this.L(x + a[0] * sx, y + a[1] * sy, z + a[2] * sz, x + b[0] * sx, y + b[1] * sy, z + b[2] * sz, x + c[0] * sx, y + c[1] * sy, z + c[2] * sz, col, u);
    }
  };

  // ------------------------------------------------------------ palettes
  const SEASONS = [
    { // summer
      sand: '#f0dcaa', wet: '#dcc79a', grassA: '#b3d692', grassB: '#93c47f', high: '#7fb27a', rock: '#bdb3c4',
      pine: ['#5f9f6b', '#4d8a61'], round: ['#8cc46e', '#a4cf74', '#79b467'], trunk: '#9b7653',
      shallow: '#a8e2d4', deep: '#6ab5c4', foam: '#f1f8f1', wall: '#4f9cb2', wallDeep: '#3b7996'
    },
    { // autumn
      sand: '#ecd5a4', wet: '#d6bc8e', grassA: '#d9c27c', grassB: '#c8a962', high: '#b38e55', rock: '#b8a9a6',
      pine: ['#5f7f5a', '#4e6e50'], round: ['#e0843f', '#e9a948', '#c8573a'], trunk: '#8a6446',
      shallow: '#a2d4cc', deep: '#5c98ae', foam: '#f3f1e6', wall: '#4d879e', wallDeep: '#39677f'
    },
    { // winter
      sand: '#e6e1da', wet: '#cfcac4', grassA: '#f7f8fa', grassB: '#e9eef4', high: '#ffffff', rock: '#a5abc0',
      pine: ['#3f6b5c', '#35594f'], round: ['#eef2f6', '#dfe7ee', '#cfdbe6'], trunk: '#7a6150',
      shallow: '#bcdfe6', deep: '#6d9fbf', foam: '#ffffff', wall: '#5e8fae', wallDeep: '#476f8e'
    }
  ].map((s) => { const o = {}; for (const k in s) o[k] = Array.isArray(s[k]) ? s[k].map(hex) : hex(s[k]); return o; });

  const C = {
    wallW: ['#fbf5ea', '#f6dccb', '#dde9f1', '#f3e7c4'].map(hex),
    roofs: ['#df7c62', '#6f8fbd', '#d8a25a', '#b86a74'].map(hex),
    door: hex('#6b4f45'), winDark: hex('#56647a'), winLit: hex('#ffd27a'),
    lhWhite: hex('#fbf7f0'), lhRed: hex('#d9544f'), lhDark: hex('#3e4556'), glass: hex('#c9d8e0'), lamp: hex('#fff0b0'),
    millBody: hex('#f3ead8'), millCap: hex('#9a6b52'), sail: hex('#fbf7ee'), spar: hex('#7d5e4c'),
    wood: hex('#b58a63'), woodDark: hex('#8c6a4c'), plinth: hex('#eadcc4'), plinthDark: hex('#c9b491'),
    hulls: ['#3d5a80', '#df7c62', '#e9c46a', '#f7f3ea', '#5f8f7d'].map(hex),
    sails: ['#fdf8ee', '#f4d7a1', '#fdf8ee', '#e8ecef'].map(hex),
    inks: ['#e2574c', '#f2b53a', '#2f69b0'].map(hex),
    cloud: hex('#ffffff'), foamRing: hex('#f6fbf8'), gull: hex('#fbfbf8'), gullTip: hex('#4a4f5c'), glint: hex('#ffffff'),
  };

  // ------------------------------------------------------------ shaders
  const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec4 aCol;
uniform mat4 uMVP; uniform mat4 uLMVP;
out vec3 vN; out vec4 vCol; out vec4 vL;
void main() { vN = aNor; vCol = aCol; vL = uLMVP * vec4(aPos, 1.0); gl_Position = uMVP * vec4(aPos, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vN; in vec4 vCol; in vec4 vL;
uniform vec3 uSun; uniform vec3 uView; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uGround;
uniform sampler2DShadow uShadow; uniform float uTexel;
out vec4 o;
void main() {
  if (vCol.a > 0.5) { o = vec4(vCol.rgb, 1.0); return; }
  vec3 n = normalize(vN);
  if (dot(n, uView) < 0.0) n = -n;
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  float ndl = dot(n, uSun);
  float bias = 0.0012 + 0.002 * (1.0 - clamp(ndl, 0.0, 1.0));
  float s = 0.0;
  s += texture(uShadow, vec3(p.xy + vec2(-0.5, -0.5) * uTexel, p.z - bias));
  s += texture(uShadow, vec3(p.xy + vec2( 0.5, -0.5) * uTexel, p.z - bias));
  s += texture(uShadow, vec3(p.xy + vec2(-0.5,  0.5) * uTexel, p.z - bias));
  s += texture(uShadow, vec3(p.xy + vec2( 0.5,  0.5) * uTexel, p.z - bias));
  s *= 0.25;
  float d = max(ndl, 0.0) * s;
  float hemi = 0.5 + 0.5 * n.y;
  vec3 amb = mix(uGround, uAmb, hemi);
  o = vec4(vCol.rgb * (amb + uSunCol * d), 1.0);
}`;
  const VS_D = `#version 300 es
in vec3 aPos; uniform mat4 uLMVP;
void main() { gl_Position = uLMVP * vec4(aPos, 1.0); }`;
  const FS_D = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }`;

  // ortho "look along -e" matrix, pre-multiplied by the island's turn about y.
  function rotY(v, a) { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function orthoMat(e, hw, hh, D, offY, turn, out) {
    const f = [-e[0], -e[1], -e[2]];
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    // island point p is turned by R(turn) into the world; row . (R p) = (R^T row) . p
    const R = rotY(r, -turn), U = rotY(u, -turn), E = rotY(e, -turn);
    const m = out || new Float32Array(16);
    m[0] = R[0] / hw; m[4] = R[1] / hw; m[8] = R[2] / hw; m[12] = 0;
    m[1] = U[0] / hh; m[5] = U[1] / hh; m[9] = U[2] / hh; m[13] = -offY / hh;
    m[2] = -E[0] / D; m[6] = -E[1] / D; m[10] = -E[2] / D; m[14] = 0;
    m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
    return m;
  }

  // ------------------------------------------------------------ constants
  const RS = 1.5;          // sea disc radius
  const WALL = -0.30;       // bottom of the water cut
  const PL0 = -0.30, PL1 = -0.44; // plinth
  const ELEV = 0.58;        // camera elevation (rad), a little steeper than 2:1 dimetric
  const YAW = Math.PI / 4;
  const VIEW = [Math.sin(YAW) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(YAW) * Math.cos(ELEV)];
  const NB = 7;             // boats
  const NG = 16;            // gulls
  const NGL = 70;           // glint slots
  const NCF = 90;           // confetti pieces

  VIZ.register({
    id: 'isle',
    name: 'Isle',
    order: 407,

    params: [
      { key: 'turn', label: 'Island turn', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'wind', label: 'Wind from bass', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'beat', label: 'Beat reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'festival', label: 'Festival', type: 'select', options: ['With the drop', 'Always on', 'Off'], default: 0 },
      { key: 'light', label: 'Time of day', type: 'select', options: ['Day into dusk', 'Bright day', 'Golden dusk', 'Night'], default: 0 },
      { key: 'season', label: 'Season', type: 'select', options: ['Summer', 'Autumn', 'Winter'], default: 0 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 0.7, max: 1.6, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'newisle', label: 'New island', run() { this.seed = (this.seed || 1) + 1; this.builtKey = null; this.resetState(); } },
    ],

    gallery: {
      title: 'Isle',
      technique: 'WebGL2 flat-shaded low-poly diorama with a sun shadow map (depth texture + sampler2DShadow PCF); static island mesh built once per seed/season, moving parts (faceted polar-grid sea, sails, boats, gulls, clouds, festival) rebuilt into a growable Float32Array each frame; orthographic camera with the island turning on its plinth under a fixed sun',
      brief: 'A toy island on a round plinth of sea, turning slowly in daylight that drifts into dusk and back: lighthouse on a point, a village by the harbour, windmills, trees, boats sailing loops, clouds whose shadows cross the fields. Pastel, matte, crisp, with real shadows instead of glow. Kick: the big windmill on the hill clicks one notch, the gulls round the lighthouse ripple out and back, and a ring runs across the water from the lighthouse point. Snare: the next boat hoists sail and leaves harbour (and in the festival, a confetti burst over the village). Bass is the wind: the small windmills, the swell, cloud drift and boat speed. Hats glint on the sea facets. The drop lights the village festival (bunting in three inks, lanterns, a turning maypole, lit windows, confetti) and empties the harbour; the breakdown lets the festival go dark and the boats drift home.',
      lineage: 'Batch 04 brief 07 (toy isometric island), after the low-poly diorama tradition of Monument Valley and Townscaper-style toy towns, and turntable product shots. Process: first pass was a Canvas-2D painter\'s sort, rejected on paper because objects behind the hill would draw over it, so it went to WebGL2 with a depth buffer and a real shadow map instead of glow. Render 1 (640x360): pastel and legible but the island was small in a big sea and the kick (a 45-degree notch on an ordinary-sized windmill, plus a faint displacement ring) measured kickArea 0.014: too subtle. Render 2: shrank the sea disc, raised the clouds that had hidden the windmill, made the hill windmill 1.45x with vermilion/cream sails, added a white foam bell-ring that runs out from the lighthouse point and a lamp flash; but the sails were sometimes edge-on as the island turned. Render 3: every mill cap now turns into a fixed world wind so the sails always face the room (kick becomes a clear local hot spot on the jolt heat map, kickArea 0.04, calm); added hot-air balloons in the three festival inks that inflate and rise over the village in the drop, and bass whitecaps; whitecaps read as pale ice slabs on the big outer facets, so render 4 toned them to a 35% tint and kept the balloons low and larger so they stay in frame. Palette: pastel matte with three festival inks (vermilion, marigold, blue); no spectrum, no bloom.',
    },

    // ------------------------------------------------------------ state
    seed: 1,

    resetState() {
      this.boats = [];
      for (let i = 0; i < NB; i++) this.boats.push({ state: 0, u: 0, hoist: 0, heading: 0, x: 0, z: 0, dir: i % 2 ? -1 : 1, ring: 1.2 + 0.07 * (i % 3), launch: -9 });
      this.gullPulse = 0;
      this.kicks = [];         // times of recent kicks, for the gull ripple
      this.ripples = [];       // {t}
      this.bladeTarget = 0; this.blade = 0;
      this.millAngle = 0;
      this.wind = 0.1; this.festival = 0; this.kc = 0;
      this.prev = new Float32Array(9);
      this.lastKick = -9; this.lastSnare = -9; this.lastT = null;
      this.turnAngle = 0.7; this.cloudT = 0; this.boatClock = 0;
      this.glints = []; for (let i = 0; i < NGL; i++) this.glints.push({ x: 0, z: 0, t: -9, s: 1 });
      this.glintNext = 0;
      this.confetti = []; for (let i = 0; i < NCF; i++) this.confetti.push({ t: -9, life: 0 });
      this.cfNext = 0; this.pole = 0;
    },

    setup(p) { this.resetState(); },
    enter(p) { if (!this.boats) this.resetState(); },

    // ------------------------------------------------------------ island layout
    H(x, z) {
      const L = this.lay;
      const a = Math.atan2(z, x), r = Math.hypot(x, z);
      const R = 0.9 * (0.86 + 0.34 * fbm(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + 5, L.seed));
      const u = r / R;
      let h = 0.2 * (1 - u * u) + 0.012;
      const dh = (x - L.hill[0]) ** 2 + (z - L.hill[1]) ** 2;
      h += 0.17 * Math.exp(-dh / 0.07);
      const dp = (x - L.prom[0]) ** 2 + (z - L.prom[1]) ** 2;
      h += 0.16 * Math.exp(-dp / 0.022);
      h += 0.05 * (fbm(x * 2.6 + 11, z * 2.6 + 3, L.seed + 3) - 0.5);
      return Math.max(h, -0.26);
    },

    layout() {
      const rnd = mulberry(this.seed * 7919 + 17);
      const L = { seed: this.seed * 3.1 };
      L.aH = rnd() * TAU;
      L.hill = [0.2 * Math.cos(L.aH + Math.PI), 0.2 * Math.sin(L.aH + Math.PI)];
      L.aL = L.aH + 2.2 + rnd() * 0.5;
      L.prom = [0.9 * Math.cos(L.aL), 0.9 * Math.sin(L.aL)];
      this.lay = L;
      const H = (x, z) => this.H(x, z);
      // shoreline radius along the harbour bearing
      const dH = [Math.cos(L.aH), Math.sin(L.aH)], pH = [-dH[1], dH[0]];
      let rs = 0.3; while (rs < 1.5 && H(dH[0] * rs, dH[1] * rs) > 0.0) rs += 0.01;
      L.rShore = rs; L.dH = dH; L.pH = pH;
      // pier and dock slots
      L.pier0 = rs - 0.12; L.pier1 = rs + 0.34;
      L.slots = [];
      for (let k = 0; k < NB; k++) {
        const along = rs + 0.06 + 0.075 * (k >> 1) + (k % 2 ? 0.035 : 0);
        const side = (k % 2 ? 1 : -1) * 0.065;
        L.slots.push([dH[0] * along + pH[0] * side, dH[1] * along + pH[1] * side]);
      }
      // village square and houses, along a street running inland from the pier
      const vc = [dH[0] * (rs - 0.36), dH[1] * (rs - 0.36)];
      L.square = vc;
      L.houses = [];
      const taken = [];
      const free = (x, z, d) => taken.every((t) => (t[0] - x) ** 2 + (t[1] - z) ** 2 > (d + t[2]) ** 2);
      taken.push([vc[0], vc[1], 0.07]);
      taken.push([L.hill[0], L.hill[1], 0.17]);
      taken.push([L.prom[0], L.prom[1], 0.12]);
      let tries = 0;
      while (L.houses.length < 10 && tries++ < 400) {
        const along = (rnd() - 0.5) * 0.62, side = (rnd() - 0.5) * 0.62;
        const x = vc[0] + dH[0] * along + pH[0] * side, z = vc[1] + dH[1] * along + pH[1] * side;
        const h = H(x, z);
        if (h < 0.035 || h > 0.2) continue;
        if (!free(x, z, 0.075)) continue;
        taken.push([x, z, 0.075]);
        const face = Math.atan2(vc[1] - z, vc[0] - x);
        L.houses.push({ x, z, y: h, ang: Math.round(face / (Math.PI / 2)) * (Math.PI / 2) + L.aH + (rnd() - 0.5) * 0.3,
          sx: 0.042 + rnd() * 0.02, sz: 0.032 + rnd() * 0.01, sy: 0.045 + rnd() * 0.03, wall: Math.floor(rnd() * 4), roof: Math.floor(rnd() * 4) });
      }
      // windmills: the hero on the hill, two small ones out on the fields
      L.mills = [{ x: L.hill[0], z: L.hill[1], k: 1.45, face: L.aH + 0.6 }];
      for (let k = 0; k < 2; k++) {
        for (let t = 0; t < 60; t++) {
          const a = L.aH + (k ? -1.7 : 1.5) + (rnd() - 0.5) * 0.6, r = 0.45 + rnd() * 0.25;
          const x = r * Math.cos(a), z = r * Math.sin(a);
          if (H(x, z) < 0.05 || !free(x, z, 0.1)) continue;
          taken.push([x, z, 0.1]); L.mills.push({ x, z, k: 0.62, face: a + 0.4 }); break;
        }
      }
      for (const m of L.mills) {
        m.y = Math.min(H(m.x, m.z), H(m.x + 0.05, m.z), H(m.x - 0.05, m.z), H(m.x, m.z + 0.05), H(m.x, m.z - 0.05));
      }
      // trees, in small clumps
      L.trees = [];
      tries = 0;
      while (L.trees.length < 60 && tries++ < 3000) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * 1.05;
        const x = r * Math.cos(a), z = r * Math.sin(a);
        const h = H(x, z);
        if (h < 0.045) continue;
        if (!free(x, z, 0.03)) continue;
        const cl = fbm(x * 3 + 40, z * 3 + 40, L.seed + 9);
        if (cl < 0.5 && rnd() > 0.15) continue;
        taken.push([x, z, 0.03]);
        L.trees.push({ x, z, y: h, pine: rnd() < 0.45, s: 0.8 + rnd() * 0.5, c: Math.floor(rnd() * 3) });
      }
      // bunting strings between near pairs of houses, via the square
      L.strings = [];
      const hs = L.houses;
      for (let i = 0; i < hs.length; i++) {
        const top = (h) => [h.x, h.y + h.sy + 0.012, h.z];
        const toSq = [vc[0], 0, vc[1]];
        const d = Math.hypot(hs[i].x - vc[0], hs[i].z - vc[1]);
        if (d < 0.36) L.strings.push([top(hs[i]), [toSq[0], H(vc[0], vc[1]) + 0.13, toSq[2]]]);
      }
      L.squareY = H(vc[0], vc[1]);
      // lighthouse
      L.lhY = Math.min(H(L.prom[0], L.prom[1]), H(L.prom[0] + 0.06, L.prom[1]), H(L.prom[0] - 0.06, L.prom[1]), H(L.prom[0], L.prom[1] + 0.06), H(L.prom[0], L.prom[1] - 0.06));
      L.lhTop = L.lhY + 0.44;
      // the sea mesh (polar lattice) and which of its triangles the island hides
      this.buildSea();
    },

    buildSea() {
      const NR = 16, NS = 84;
      const pts = [];     // ring k -> array of [x,z]
      for (let k = 0; k <= NR; k++) {
        const r = RS * Math.pow(k / NR, 0.85);
        const n = k === 0 ? 1 : NS;
        const ring = [];
        for (let i = 0; i < n; i++) {
          const a = ((i + (k % 2) * 0.5) / NS) * TAU;
          ring.push([r * Math.cos(a), r * Math.sin(a)]);
        }
        pts.push(ring);
      }
      const idx = [];
      const vid = []; let nv = 0; const P = [];
      for (let k = 0; k <= NR; k++) { vid.push([]); for (const q of pts[k]) { vid[k].push(nv++); P.push(q); } }
      for (let i = 0; i < NS; i++) idx.push([vid[0][0], vid[1][i], vid[1][(i + 1) % NS]]);
      for (let k = 1; k < NR; k++) {
        for (let i = 0; i < NS; i++) {
          const a = vid[k][i], b = vid[k][(i + 1) % NS];
          const odd = k % 2 === 1;
          const c = vid[k + 1][i], d = vid[k + 1][(i + 1) % NS];
          if (odd) { idx.push([a, c, d]); idx.push([a, d, b]); } else { idx.push([a, c, b]); idx.push([b, c, d]); }
        }
      }
      const tris = [];
      for (const t of idx) {
        const cx = (P[t[0]][0] + P[t[1]][0] + P[t[2]][0]) / 3, cz = (P[t[0]][1] + P[t[1]][1] + P[t[2]][1]) / 3;
        const hmin = Math.min(this.H(P[t[0]][0], P[t[0]][1]), this.H(P[t[1]][0], P[t[1]][1]), this.H(P[t[2]][0], P[t[2]][1]));
        if (hmin > 0.07) continue;
        const hc = this.H(cx, cz);
        tris.push({ i: t, depth: clamp((hc + 0.24) / 0.24, 0, 1), foam: hc > -0.018 ? 1 : 0, j: hash2(t[0], t[1], 3) });
      }
      this.sea = { P, tris, rim: vid[NR], nv };
      this.seaY = new Float32Array(nv);
    },

    // ------------------------------------------------------------ static mesh
    buildStatic(season) {
      const S = SEASONS[season];
      const L = this.lay;
      const m = new Mesh(20000);
      const H = (x, z) => this.H(x, z);
      // terrain: jittered grid
      const N = 38, ext = 1.3, st = (2 * ext) / N;
      const V = [];
      for (let i = 0; i <= N; i++) {
        V.push([]);
        for (let j = 0; j <= N; j++) {
          const edge = i === 0 || j === 0 || i === N || j === N;
          const jx = edge ? 0 : (hash2(i, j, 1) - 0.5) * st * 0.7, jz = edge ? 0 : (hash2(i, j, 2) - 0.5) * st * 0.7;
          const x = -ext + i * st + jx, z = -ext + j * st + jz;
          V[i].push([x, H(x, z), z]);
        }
      }
      m.at(0, 0, 0, 0, 1);
      const tri = (a, b, c) => {
        if (a[1] < -0.07 && b[1] < -0.07 && c[1] < -0.07) return;
        const hc = (a[1] + b[1] + c[1]) / 3;
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const slope = Math.abs(ny) / Math.hypot(nx, ny, nz);
        const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
        let col;
        if (hc < 0.0) col = S.wet;
        else if (hc < 0.032) col = S.sand;
        else if (slope < 0.8) col = S.rock;
        else {
          const g = fbm(cx * 4 + 1, cz * 4 + 2, L.seed + 21);
          col = mixc(S.grassA, S.grassB, sstep(0.4, 0.62, g));
          col = mixc(col, S.high, sstep(0.16, 0.3, hc) * 0.7);
          // field strips near the village: a patchwork of two tones
          const fx = Math.floor((cx * L.dH[0] + cz * L.dH[1]) * 9), fz = Math.floor((-cx * L.dH[1] + cz * L.dH[0]) * 7);
          if (hc < 0.16 && hash2(fx, fz, 5) > 0.72 && season !== 2) col = mixc(col, season === 1 ? hex('#d8b25e') : hex('#e7d98c'), 0.55);
        }
        col = shade(col, 0.97 + 0.06 * hash2(Math.floor(cx * 97), Math.floor(cz * 97), 9));
        m.W(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col);
      };
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1];
        if ((i + j) % 2) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
      }
      // plinth: a lip ring and the wooden drum
      m.at(0, 0, 0, 0, 1);
      const NP = 72;
      for (let i = 0; i < NP; i++) {
        const a = (i / NP) * TAU, b = ((i + 1) / NP) * TAU;
        const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const r0 = RS, r1 = RS + 0.07;
        m.LQ([ca * r0, PL0, sa * r0], [ca * r1, PL0, sa * r1], [cb * r1, PL0, sb * r1], [cb * r0, PL0, sb * r0], C.plinth);
        m.LQ([ca * r1, PL0, sa * r1], [ca * r1, PL1, sa * r1], [cb * r1, PL1, sb * r1], [cb * r1, PL0, sb * r1], i % 2 ? C.plinth : shade(C.plinth, 0.985));
        m.LQ([ca * r1, PL1, sa * r1], [ca * (r1 - 0.03), PL1 - 0.03, sa * (r1 - 0.03)], [cb * (r1 - 0.03), PL1 - 0.03, sb * (r1 - 0.03)], [cb * r1, PL1, sb * r1], C.plinthDark);
      }
      // pier: posts and planks
      const dH = L.dH;
      const pa = Math.atan2(dH[1], dH[0]);
      m.at(0, 0, 0, pa, 1);
      m.box((L.pier0 + L.pier1) / 2, 0.035, 0, (L.pier1 - L.pier0) / 2, 0.012, 0.028, C.wood, C.woodDark);
      for (let x = L.pier0 + 0.04; x < L.pier1; x += 0.07) {
        m.box(x, -0.06, 0.03, 0.006, 0.1, 0.006, C.woodDark, C.woodDark);
        m.box(x, -0.06, -0.03, 0.006, 0.1, 0.006, C.woodDark, C.woodDark);
      }
      // houses
      for (const h of L.houses) {
        const wall = C.wallW[h.wall], roof = C.roofs[h.roof];
        m.at(h.x, h.y - 0.03, h.z, h.ang, 1);
        m.box(0, 0, 0, h.sx, h.sy + 0.03, h.sz, wall, wall);
        m.roof(h.sy + 0.03, h.sx, h.sz, 0.04, 0.008, roof, wall);
        // chimney
        m.box(h.sx * 0.5, h.sy + 0.04, -h.sz * 0.35, 0.007, 0.035, 0.007, shade(roof, 0.8), shade(roof, 0.8));
        // door on the +z face
        m.LQ([-0.008, 0.03, h.sz + 0.001], [0.008, 0.03, h.sz + 0.001], [0.008, 0.058, h.sz + 0.001], [-0.008, 0.058, h.sz + 0.001], C.door);
      }
      // trees
      for (const t of L.trees) {
        m.at(t.x, t.y - 0.01, t.z, t.x * 13, t.s);
        m.prism(0, 0, 0, 0.007, 0.006, 0.03, 5, S.trunk);
        if (t.pine) {
          const c = S.pine[t.c % 2];
          m.cone(0, 0.02, 0, 0.038, 0.07, 6, c);
          m.cone(0, 0.055, 0, 0.028, 0.06, 6, shade(c, 1.06));
          if (this.seasonIdx === 2) m.cone(0, 0.09, 0, 0.015, 0.03, 6, hex('#ffffff'));
        } else {
          m.blob(0, 0.06, 0, 0.034, 0.036, 0.034, S.round[t.c]);
        }
      }
      // windmill bodies (their sails are dynamic)
      for (const w of L.mills) {
        m.at(w.x, w.y - 0.02, w.z, w.face, w.k);
        m.prism(0, 0, 0, 0.068, 0.048, 0.28, 8, C.millBody, null, Math.PI / 8);
        m.prism(0, 0.28, 0, 0.056, 0.056, 0.012, 8, C.millCap, C.millCap, Math.PI / 8);
        m.cone(0, 0.292, 0, 0.058, 0.07, 8, C.millCap, Math.PI / 8);
      }
      // lighthouse
      m.at(L.prom[0], L.lhY - 0.02, L.prom[1], 0.3, 1);
      m.box(0.085, 0, 0.0, 0.045, 0.06, 0.035, C.wallW[0], C.wallW[0]);
      m.at(L.prom[0] + 0.085 * Math.cos(0.3), L.lhY - 0.02 + 0.06, L.prom[1] + 0.085 * Math.sin(0.3), 0.3, 1);
      m.roof(0, 0.045, 0.035, 0.03, 0.006, C.lhRed, C.wallW[0]);
      m.at(L.prom[0], L.lhY - 0.02, L.prom[1], 0, 1);
      const segs = 5, hgt = 0.36, r0 = 0.07, r1 = 0.048;
      for (let s = 0; s < segs; s++) {
        const a = r0 + (r1 - r0) * (s / segs), b = r0 + (r1 - r0) * ((s + 1) / segs);
        m.prism(0, (s / segs) * hgt, 0, a, b, hgt / segs, 12, s % 2 ? C.lhRed : C.lhWhite);
      }
      m.prism(0, hgt, 0, 0.068, 0.068, 0.014, 12, C.lhDark, C.lhDark);
      m.prism(0, hgt + 0.064, 0, 0.05, 0.05, 0.008, 12, C.lhDark, C.lhDark);
      m.cone(0, hgt + 0.072, 0, 0.052, 0.05, 12, C.lhRed);
      this.staticMesh = m;
    },

    // ------------------------------------------------------------ GL
    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'aPos'); gl.bindAttribLocation(pr, 1, 'aNor'); gl.bindAttribLocation(pr, 2, 'aCol');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        return pr;
      };
      this.prog = link(VS, FS);
      this.progD = link(VS_D, FS_D);
      const U = (pr, n) => gl.getUniformLocation(pr, n);
      this.u = {};
      for (const n of ['uMVP', 'uLMVP', 'uSun', 'uView', 'uSunCol', 'uAmb', 'uGround', 'uShadow', 'uTexel']) this.u[n] = U(this.prog, n);
      this.uD = U(this.progD, 'uLMVP');
      this.SM = 1024;
      this.shadowTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.SM, this.SM);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const mkVao = (buf) => {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
        gl.bindVertexArray(null);
        return vao;
      };
      this.sBuf = gl.createBuffer(); this.sVao = mkVao(this.sBuf);
      this.dBuf = gl.createBuffer(); this.dVao = mkVao(this.dBuf);
      this.dyn = new Mesh(40000);
      this.gl = gl; this.glCanvas = c;
      this.mvp = new Float32Array(16); this.lmvp = new Float32Array(16);
    },

    uploadStatic() {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.staticMesh.d.subarray(0, this.staticMesh.n * 10), gl.STATIC_DRAW);
      this.sCount = this.staticMesh.n;
    },

    // ------------------------------------------------------------ music
    listen(sig, t, dt, params) {
      const pr = this.prev;
      const kick = sig[0] - pr[0] > 26 && sig[0] > 55 && t - this.lastKick > 0.22;
      const snare = sig[4] - pr[4] > 22 && sig[4] > 45 && t - this.lastSnare > 0.8;
      const hatOn = sig[8] - pr[8] > 18 && sig[8] > 30;
      for (let i = 0; i < 9; i++) pr[i] = sig[i];
      const bass = (sig[1] + sig[2]) / 200;
      this.wind += (bass - this.wind) * (1 - Math.exp(-dt * 1.6));
      this.kc *= Math.exp(-dt / 1.5);
      if (kick) { this.lastKick = t; this.kc += 1; this.onKick(t, params); }
      if (snare) { this.lastSnare = t; this.onSnare(t); }
      if (hatOn) this.onHat(t, sig[8] / 100);
      // a quieter trickle of glints from the hat level between onsets
      this.hat = Math.max(sig[7], sig[8]) / 100;
      let ft = clamp((this.kc - 2.2) / 1.2, 0, 1);
      if (params.festival === 1) ft = 1; else if (params.festival === 2) ft = 0;
      const k = ft > this.festival ? 1.8 : 0.6;
      this.festival += (ft - this.festival) * (1 - Math.exp(-dt * k));
    },

    onKick(t, params) {
      this.bladeTarget += Math.PI / 4;
      this.kicks.push(t); if (this.kicks.length > 6) this.kicks.shift();
      this.ripples.push(t); if (this.ripples.length > 5) this.ripples.shift();
    },

    onSnare(t) {
      // the next docked boat leaves
      for (let i = 0; i < NB; i++) {
        const b = this.boats[i];
        if (b.state === 0) { b.state = 1; b.u = 0; b.launch = t; break; }
      }
      if (this.festival > 0.25) {
        const L = this.lay;
        const rnd = mulberry(Math.floor(t * 1000));
        const n = Math.round(22 + 22 * this.festival);
        for (let k = 0; k < n; k++) {
          const c = this.confetti[this.cfNext]; this.cfNext = (this.cfNext + 1) % NCF;
          const a = rnd() * TAU, sp = 0.25 + rnd() * 0.35;
          c.t = t; c.x = L.square[0]; c.z = L.square[1]; c.y = L.squareY + 0.2;
          c.vx = Math.cos(a) * sp; c.vz = Math.sin(a) * sp; c.vy = 0.7 + rnd() * 0.6;
          c.ax = rnd() * TAU; c.av = (rnd() - 0.5) * 18; c.col = C.inks[k % 3]; c.life = 1.6 + rnd() * 0.9;
        }
      }
    },

    onHat(t, lvl) {
      const n = Math.round(4 + 14 * lvl);
      for (let k = 0; k < n; k++) this.spawnGlint(t);
    },
    spawnGlint(t) {
      const g = this.glints[this.glintNext]; this.glintNext = (this.glintNext + 1) % NGL;
      const h = hash2(t * 37.1, this.glintNext, 4), h2 = hash2(this.glintNext, t * 11.3, 6);
      const a = h * TAU, r = 1.0 + Math.sqrt(h2) * (RS - 1.06);
      g.x = r * Math.cos(a); g.z = r * Math.sin(a); g.t = t; g.s = 0.7 + h2 * 0.6;
    },

    // ------------------------------------------------------------ dynamic geometry
    waveY(x, z, t, amp) {
      let y = amp * (0.011 * Math.sin(x * 4.1 + t * 1.3) + 0.009 * Math.sin(z * 5.3 - t * 1.1 + x * 1.7) + 0.006 * Math.sin((x + z) * 8.7 + t * 2.3));
      const L = this.lay;
      for (const t0 of this.ripples) {
        const age = t - t0; if (age > 1.6) continue;
        const d = Math.hypot(x - L.prom[0], z - L.prom[1]);
        const R = 0.08 + age * 0.55;
        const w = (d - R) / 0.06;
        if (w > -2.5 && w < 2.5) y += this.rippleAmp * 0.02 * Math.exp(-age * 1.6) * Math.exp(-w * w) * Math.cos(w * 1.6);
      }
      return y;
    },

    buildDynamic(t, S, params) {
      const m = this.dyn; m.reset();
      const L = this.lay;
      const wind = clamp(this.wind * params.wind, 0, 1.4);
      const amp = 0.9 + 2.2 * wind;
      this.rippleAmp = params.beat;
      // ---- sea
      const sea = this.sea, P = sea.P, Y = this.seaY;
      for (let i = 0; i < sea.nv; i++) Y[i] = this.waveY(P[i][0], P[i][1], t, amp);
      m.at(0, 0, 0, 0, 1);
      for (const tr of sea.tris) {
        const a = tr.i[0], b = tr.i[1], c = tr.i[2];
        let col = tr.foam ? S.foam : mixc(S.deep, S.shallow, tr.depth * tr.depth);
        // whitecaps on the crests when the bass wind is up
        const yc = (Y[a] + Y[b] + Y[c]) / 3;
        if (yc > 0.03 + 0.01 * tr.j) col = mixc(col, S.foam, 0.35);
        col = shade(col, 0.985 + 0.03 * tr.j);
        m.W(P[a][0], Y[a], P[a][1], P[b][0], Y[b], P[b][1], P[c][0], Y[c], P[c][1], col);
      }
      // ---- the cut side of the water block
      const rim = sea.rim;
      for (let i = 0; i < rim.length; i++) {
        const a = rim[i], b = rim[(i + 1) % rim.length];
        const ax = P[a][0], az = P[a][1], bx = P[b][0], bz = P[b][1];
        m.W(ax, Y[a], az, bx, Y[b], bz, bx, -0.1, bz, S.wall);
        m.W(ax, Y[a], az, bx, -0.1, bz, ax, -0.1, az, S.wall);
        m.W(ax, -0.1, az, bx, -0.1, bz, bx, WALL, bz, S.wallDeep);
        m.W(ax, -0.1, az, bx, WALL, bz, ax, WALL, az, S.wallDeep);
      }
      // ---- windmill sails
      const bladeK = 1 - Math.exp(-this.dt * 16);
      this.blade += (this.bladeTarget - this.blade) * bladeK;
      this.millAngle += this.dt * (0.4 + 5.0 * wind);
      L.mills.forEach((w, wi) => {
        const ang = wi === 0 ? this.blade + this.millAngle * 0.08 : this.millAngle * (wi === 1 ? 1 : 0.83) + wi;
        this.sails(m, w, ang, wi === 0);
      });
      // ---- lighthouse lamp room glass
      m.at(L.prom[0], L.lhY - 0.02, L.prom[1], 0, 1);
      const bell = Math.exp(-(t - this.lastKick) / 0.18) * Math.min(1, params.beat);
      const lampOn = Math.max(this.lampOn, bell);
      const glass = mixc(C.glass, C.lamp, lampOn);
      m.prism(0, 0.374, 0, 0.042, 0.042, 0.05, 12, glass, null);
      // the bell's ring: a white foam circle running out over the water from the point
      this.bellRings(m, t);
      // ---- gulls
      this.gulls(m, t);
      // ---- boats
      this.sailBoats(m, t, wind);
      // ---- clouds
      this.clouds(m, t, wind);
      // ---- festival
      this.fest(m, t, wind);
      // ---- glints
      m.at(0, 0, 0, 0, 1);
      for (const g of this.glints) {
        const age = t - g.t; if (age > 0.35 || age < 0) continue;
        const e = Math.exp(-age / 0.12) * g.s;
        const s = 0.03 * e;
        const y = this.waveY(g.x, g.z, t, amp) + 0.012;
        m.W(g.x - s, y, g.z, g.x, y, g.z - s * 0.25, g.x + s, y, g.z, C.glint, 1);
        m.W(g.x - s, y, g.z, g.x + s, y, g.z, g.x, y, g.z + s * 0.25, C.glint, 1);
        m.W(g.x, y, g.z - s, g.x + s * 0.25, y, g.z, g.x, y, g.z + s, C.glint, 1);
        m.W(g.x, y, g.z - s, g.x, y, g.z + s, g.x - s * 0.25, y, g.z, C.glint, 1);
      }
    },

    bellRings(m, t) {
      const L = this.lay;
      m.at(0, 0, 0, 0, 1);
      const amp = 0.9 + 2.2 * clamp(this.wind, 0, 1.4);
      for (const t0 of this.ripples) {
        const age = t - t0; if (age < 0 || age > 1.3) continue;
        const R = 0.13 + age * 0.62;
        const w = 0.02 * (1 - age / 1.3) * Math.min(1.5, this.rippleAmp);
        if (w < 0.002) continue;
        const n = 56;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
          const ax = L.prom[0] + Math.cos(a) * R, az = L.prom[1] + Math.sin(a) * R;
          const bx = L.prom[0] + Math.cos(b) * R, bz = L.prom[1] + Math.sin(b) * R;
          if (this.H(ax, az) > -0.01 || this.H(bx, bz) > -0.01) continue;
          if (ax * ax + az * az > (RS - 0.02) ** 2 || bx * bx + bz * bz > (RS - 0.02) ** 2) continue;
          const ya = this.waveY(ax, az, t, amp) + 0.01, yb = this.waveY(bx, bz, t, amp) + 0.01;
          const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
          m.W(ax - ca * w, ya, az - sa * w, bx - cb * w, yb, bz - sb * w, bx + cb * w, yb, bz + sb * w, C.foamRing, 1);
          m.W(ax - ca * w, ya, az - sa * w, bx + cb * w, yb, bz + sb * w, ax + ca * w, ya, az + sa * w, C.foamRing, 1);
        }
      }
    },

    sails(m, w, ang, hero) {
      // windmill local frame: +x is the sail face; hub at (0.07, 0.29, 0)
      // every cap turns into the same world wind, so the sails always show
      // their faces to the room however the island is turned
      m.at(w.x, w.y - 0.02, w.z, this.windFace, w.k);
      m.box(0.05, 0.28, 0, 0.022, 0.02, 0.012, C.millCap, C.millCap);
      const hx = 0.072, hy = 0.29, len = hero ? 0.24 : 0.2;
      for (let b = 0; b < 4; b++) {
        const a = ang + b * (Math.PI / 2);
        const dy = Math.cos(a), dz = Math.sin(a);   // blade direction in the local y-z plane
        const py = -dz, pz = dy;                    // perpendicular in that plane
        const r0 = 0.03, r1 = len, w0 = 0.004, w1 = 0.05;
        // spar
        m.LQ([hx, hy + dy * 0.0 - py * 0.005, dz * 0.0 - pz * 0.005], [hx, hy + dy * r1 - py * 0.005, dz * r1 - pz * 0.005],
          [hx, hy + dy * r1 + py * 0.005, dz * r1 + pz * 0.005], [hx, hy + py * 0.005, pz * 0.005], C.spar);
        // cloth, offset to one side of the spar (sails trail)
        const cloth = hero && b % 2 === 0 ? C.inks[0] : C.sail;
        m.LQ([hx + 0.002, hy + dy * r0 + py * w0, dz * r0 + pz * w0], [hx + 0.002, hy + dy * r1 + py * w0, dz * r1 + pz * w0],
          [hx + 0.002, hy + dy * r1 + py * w1, dz * r1 + pz * w1], [hx + 0.002, hy + dy * r0 + py * (w1 * 0.8), dz * r0 + pz * (w1 * 0.8)], cloth);
      }
    },

    gulls(m, t) {
      const L = this.lay;
      const cx = L.prom[0], cz = L.prom[1], cy = L.lhTop + 0.08;
      for (let i = 0; i < NG; i++) {
        const ph = hash2(i, 1, 8), ph2 = hash2(i, 2, 8);
        const a0 = (i / NG) * TAU + t * (0.35 + 0.1 * ph) * (i % 3 === 0 ? -1 : 1) + ph * 2;
        // kick ripple: a push outward that travels round the flock
        let push = 0, flap = 0;
        for (const k of this.kicks) {
          const age = t - k - ((((a0 % TAU) + TAU) % TAU) / TAU) * 0.18;
          if (age > 0 && age < 0.9) { const e = Math.sin(Math.min(age / 0.9, 1) * Math.PI) * Math.exp(-age * 2.0); push += e; flap += e; }
        }
        push *= this.rippleAmp;
        const r = 0.22 + 0.2 * ph2 + 0.24 * push;
        const x = cx + Math.cos(a0) * r, z = cz + Math.sin(a0) * r;
        const y = cy + 0.1 * ph + 0.03 * Math.sin(t * 0.9 + i) + 0.07 * push;
        const heading = a0 + (i % 3 === 0 ? -Math.PI / 2 : Math.PI / 2);
        const f = Math.sin(t * (5 + 3 * ph) + i * 1.7 + flap * 3) * (0.5 + 0.6 * Math.min(flap, 1));
        const s = 0.045;
        m.at(x, y, z, heading, 1);
        const wy = f * s * 0.9;
        m.L(0.012, 0, 0, -0.01, 0, 0, 0, wy, s, C.gull);
        m.L(0.012, 0, 0, -0.01, 0, 0, 0, wy, -s, C.gull);
        m.L(0, wy, s, -0.004, wy, s * 1.1, -0.002, wy * 0.8, s * 0.7, C.gullTip);
        m.L(0, wy, -s, -0.004, wy, -s * 1.1, -0.002, wy * 0.8, -s * 0.7, C.gullTip);
      }
    },

    boatPath(b, i) {
      const L = this.lay;
      const slot = L.slots[i];
      const aH = L.aH;
      const out = [Math.cos(aH) * (b.ring + 0.02) + L.pH[0] * (i % 2 ? 0.1 : -0.1), Math.sin(aH) * (b.ring + 0.02) + L.pH[1] * (i % 2 ? 0.1 : -0.1)];
      const u = b.u;
      const T1 = 0.08, T2 = 0.92;
      if (u < T1) { const s = sstep(0, 1, u / T1); return [slot[0] + (out[0] - slot[0]) * s, slot[1] + (out[1] - slot[1]) * s]; }
      if (u > T2) { const s = sstep(0, 1, (u - T2) / (1 - T2)); return [out[0] + (slot[0] - out[0]) * s, out[1] + (slot[1] - out[1]) * s]; }
      const v = (u - T1) / (T2 - T1);
      const a = Math.atan2(out[1], out[0]) + b.dir * v * TAU;
      const r = Math.hypot(out[0], out[1]) + 0.07 * Math.sin(v * TAU * 2 + i);
      return [Math.cos(a) * r, Math.sin(a) * r];
    },

    sailBoats(m, t, wind) {
      const L = this.lay;
      const amp = 0.9 + 2.2 * wind;
      for (let i = 0; i < NB; i++) {
        const b = this.boats[i];
        if (b.state === 1) {
          b.u += this.dt * (0.055 + 0.06 * wind);
          b.hoist = Math.min(1, b.hoist + this.dt * 5);
          if (b.u >= 1) { b.state = 0; b.u = 0; }
        } else {
          b.hoist = Math.max(0.12, b.hoist - this.dt * 0.8);
        }
        const pos = b.state === 1 ? this.boatPath(b, i) : L.slots[i];
        let hd;
        if (b.state === 1) {
          const u0 = b.u; b.u = Math.min(1, u0 + 0.004); const q = this.boatPath(b, i); b.u = u0;
          hd = Math.atan2(q[1] - pos[1], q[0] - pos[0]);
          if (!isFinite(hd) || (q[0] === pos[0] && q[1] === pos[1])) hd = b.heading;
        } else hd = Math.atan2(L.dH[1], L.dH[0]);
        let dh = hd - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        b.heading += dh * (1 - Math.exp(-this.dt * 6));
        const y = this.waveY(pos[0], pos[1], t, amp);
        this.boat(m, pos[0], y, pos[1], b.heading, i, b.hoist, b.state === 1 ? wind : 0, t);
      }
    },

    boat(m, x, y, z, hd, i, hoist, wind, t) {
      m.at(x, y, z, hd, 1.1);
      const hull = C.hulls[i % C.hulls.length], deck = C.wood;
      const Lh = 0.065, W = 0.022, Hh = 0.02;
      const top = [[-Lh, Hh, -W], [Lh * 0.45, Hh, -W], [Lh, Hh + 0.004, 0], [Lh * 0.45, Hh, W], [-Lh, Hh, W]];
      const bot = [[-Lh * 0.8, -0.006, -W * 0.5], [Lh * 0.4, -0.006, -W * 0.5], [Lh * 0.85, -0.004, 0], [Lh * 0.4, -0.006, W * 0.5], [-Lh * 0.8, -0.006, W * 0.5]];
      for (let k = 0; k < 5; k++) { const n = (k + 1) % 5; m.LQ(top[k], top[n], bot[n], bot[k], k === 4 ? shade(hull, 0.9) : hull); }
      m.L(top[0][0], top[0][1], top[0][2], top[1][0], top[1][1], top[1][2], top[3][0], top[3][1], top[3][2], deck);
      m.L(top[0][0], top[0][1], top[0][2], top[3][0], top[3][1], top[3][2], top[4][0], top[4][1], top[4][2], deck);
      m.L(top[1][0], top[1][1], top[1][2], top[2][0], top[2][1], top[2][2], top[3][0], top[3][1], top[3][2], deck);
      // mast and sail; the sail bellies to leeward with the wind
      const mh = 0.1;
      m.box(0.008, Hh, 0, 0.0025, mh, 0.0025, C.spar, C.spar);
      const sh = mh * (0.15 + 0.85 * hoist);
      const belly = (0.008 + 0.02 * wind) * hoist;
      const sc = C.sails[i % C.sails.length];
      const foot = -0.05;
      m.L(0.01, Hh + 0.012, 0, 0.01, Hh + 0.012 + sh, 0, (0.01 + foot) * 0.5, Hh + 0.012 + sh * 0.3, belly, sc);
      m.L(0.01, Hh + 0.012, 0, (0.01 + foot) * 0.5, Hh + 0.012 + sh * 0.3, belly, foot * hoist + 0.01 * (1 - hoist), Hh + 0.014, belly * 0.5, shade(sc, 0.96));
      if (hoist > 0.5) m.L(0.01, Hh + 0.01 + sh, 0, 0.01, Hh + 0.01 + sh - 0.012, 0, 0.034, Hh + 0.01 + sh - 0.006, 0, C.inks[i % 3]);
      if (wind > 0 || hoist > 0.5) {
        // wake
        const wl = 0.05 + 0.08 * hoist;
        m.L(-Lh, 0.004, -W * 0.7, -Lh - wl, 0.004, -W * 2.2, -Lh - wl * 0.7, 0.004, -W * 1.3, C.glint, 1);
        m.L(-Lh, 0.004, W * 0.7, -Lh - wl * 0.7, 0.004, W * 1.3, -Lh - wl, 0.004, W * 2.2, C.glint, 1);
      }
    },

    clouds(m, t, wind) {
      this.cloudT += this.dt * (0.035 + 0.1 * wind);
      const dir = [Math.cos(0.4), Math.sin(0.4)];
      const inv = -this.turnAngle;
      for (let k = 0; k < 4; k++) {
        const span = 5.2;
        let s = ((this.cloudT + k * (span / 4) + hash2(k, 3, 1) * 0.4) % span) - span / 2;
        const lat = (hash2(k, 4, 1) - 0.5) * 2.4;
        const wx = dir[0] * s - dir[1] * lat, wz = dir[1] * s + dir[0] * lat;
        const fade = sstep(2.6, 1.9, Math.abs(s));
        if (fade < 0.02) continue;
        // world -> island coordinates (the island is turned; clouds are not)
        const c = Math.cos(inv), sn = Math.sin(inv);
        const x = c * wx + sn * wz, z = -sn * wx + c * wz;
        const y = 0.95 + 0.12 * hash2(k, 5, 1);
        const sc = (0.65 + 0.4 * hash2(k, 6, 1)) * fade;
        m.at(x, y, z, k * 1.3, sc);
        m.blob(0, 0, 0, 0.16, 0.08, 0.12, C.cloud);
        m.blob(0.13, -0.015, 0.03, 0.11, 0.06, 0.09, C.cloud);
        m.blob(-0.12, -0.02, -0.02, 0.1, 0.055, 0.08, C.cloud);
        if (k % 2) m.blob(0.03, 0.04, -0.06, 0.09, 0.06, 0.08, C.cloud);
      }
    },

    fest(m, t, wind) {
      const F = this.festival;
      const L = this.lay;
      // lit windows: dusk or festival
      const lit = clamp(Math.max(F, this.windowsDusk), 0, 1);
      for (const h of L.houses) {
        m.at(h.x, h.y - 0.03, h.z, h.ang, 1);
        const col = mixc(C.winDark, C.winLit, lit);
        const wy0 = 0.042, wy1 = 0.058;
        for (const sx of [-0.55, 0.55]) {
          const cx = sx * h.sx;
          if (Math.abs(cx) < 0.014) continue;
          m.LQ([cx - 0.007, wy0, h.sz + 0.0015], [cx + 0.007, wy0, h.sz + 0.0015], [cx + 0.007, wy1, h.sz + 0.0015], [cx - 0.007, wy1, h.sz + 0.0015], col, 1);
          m.LQ([cx + 0.007, wy0, -h.sz - 0.0015], [cx - 0.007, wy0, -h.sz - 0.0015], [cx - 0.007, wy1, -h.sz - 0.0015], [cx + 0.007, wy1, -h.sz - 0.0015], col, 1);
        }
      }
      if (F < 0.02) return;
      const sq = L.square, sy = L.squareY;
      // a painted dance floor opens in the square
      const fr = 0.12 * sstep(0, 0.6, F);
      m.at(sq[0], sy + 0.012, sq[1], this.pole * 0.25, 1);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU, b = ((k + 1) / 12) * TAU;
        m.L(0, 0, 0, Math.cos(a) * fr, 0, Math.sin(a) * fr, Math.cos(b) * fr, 0, Math.sin(b) * fr, k % 2 ? C.lhWhite : C.inks[(k >> 1) % 3]);
      }
      // pennants on every roof
      L.houses.forEach((h, hi) => {
        const gr = sstep(0.1 + 0.05 * (hi % 5), 0.45 + 0.05 * (hi % 5), F);
        if (gr < 0.01) return;
        m.at(h.x, h.y - 0.03, h.z, h.ang, 1);
        const px = h.sx * 0.75, y0 = h.sy + 0.03 + 0.03, ph2 = 0.055 * gr;
        m.box(px, y0, 0, 0.0018, ph2, 0.0018, C.lhDark, C.lhDark);
        const fl = Math.sin(t * 6 + hi) * (0.006 + 0.012 * wind);
        m.L(px, y0 + ph2, 0, px, y0 + ph2 - 0.022 * gr, 0, px - 0.04 * gr, y0 + ph2 - 0.011 * gr, fl, C.inks[hi % 3]);
      });
      // maypole in the square
      this.pole += this.dt * (0.4 + 1.6 * F);
      m.at(sq[0], sy - 0.01, sq[1], 0, 1);
      const ph = 0.16 * sstep(0, 0.5, F);
      m.prism(0, 0, 0, 0.006, 0.004, ph, 6, C.lhWhite, C.inks[1]);
      if (ph > 0.02) {
        m.at(sq[0], sy - 0.01, sq[1], this.pole, 1);
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU, a2 = a + 0.12;
          const R = 0.085 * F;
          m.L(0, ph, 0, Math.cos(a) * R, 0.006, Math.sin(a) * R, Math.cos(a2) * R, 0.006, Math.sin(a2) * R, C.inks[k % 3]);
        }
      }
      this.balloons(m, t, F, wind);
      // bunting from roofs to the pole top, flags in three inks
      m.at(0, 0, 0, 0, 1);
      for (let si = 0; si < L.strings.length; si++) {
        const [A, B0] = L.strings[si];
        const B = [B0[0], sy - 0.01 + ph, B0[2]];
        const len = Math.hypot(B[0] - A[0], B[2] - A[2]);
        const n = Math.max(3, Math.round(len / 0.022));
        let px = A[0], py = A[1], pz = A[2];
        const perp = [-(B[2] - A[2]) / len, (B[0] - A[0]) / len];
        for (let k = 1; k <= n; k++) {
          const u = k / n;
          const x = A[0] + (B[0] - A[0]) * u, z = A[2] + (B[2] - A[2]) * u;
          const y = A[1] + (B[1] - A[1]) * u - 0.03 * 4 * u * (1 - u);
          m.W(px, py, pz, x, y, z, x, y - 0.0025, z, C.lhDark);
          m.W(px, py, pz, x, y - 0.0025, z, px, py - 0.0025, pz, C.lhDark);
          const grow = sstep((si * 0.07 + u * 0.3), (si * 0.07 + u * 0.3) + 0.35, F);
          if (grow > 0.01) {
            const fl = 0.03 * grow;
            const flap = (0.004 + 0.01 * wind) * Math.sin(t * 7 + k * 1.3 + si);
            const mx = (px + x) / 2, mz = (pz + z) / 2, my = (py + y) / 2;
            m.W(px, py, pz, x, y, z, mx + perp[0] * flap, my - fl, mz + perp[1] * flap, C.inks[(k + si) % 3]);
            if (k % 3 === 0 && grow > 0.5) {
              // paper lanterns hang between the flags
              m.at(x, y - 0.012, z, k, 1);
              m.box(0, 0, 0, 0.006, 0.012, 0.006, C.inks[1], shade(C.inks[(k + 1) % 2 ? 0 : 1], 1.0), C.inks[1]);
              m.at(0, 0, 0, 0, 1);
            }
          }
          px = x; py = y; pz = z;
        }
      }
      // confetti
      for (const c of this.confetti) {
        const age = t - c.t; if (age < 0 || age > c.life) continue;
        const x = c.x + c.vx * age, z = c.z + c.vz * age;
        const y = c.y + c.vy * age - 0.9 * age * age;
        const a = c.ax + c.av * age;
        const s = 0.011 * (1 - sstep(c.life - 0.4, c.life, age));
        m.at(x, y, z, a, 1);
        m.L(-s, 0, 0, s, Math.sin(a) * s, 0, 0, Math.cos(a * 1.3) * s * 0.8, s, c.col);
      }
    },

    balloons(m, t, F, wind) {
      const L = this.lay, sq = L.square;
      const prof = [[0.018, 0], [0.05, 0.03], [0.074, 0.07], [0.08, 0.11], [0.066, 0.15], [0.036, 0.176], [0, 0.186]];
      for (let k = 0; k < 4; k++) {
        const lift = sstep(0.15 + 0.12 * k, 0.55 + 0.12 * k, F);
        if (lift < 0.01) continue;
        const inflate = sstep(0, 0.35, lift);
        const a = L.aH + Math.PI + (k - 1.5) * 0.9 + t * 0.03;
        const out = 0.12 + 0.2 * lift;
        const hx = sq[0] + L.dH[0] * 0.05 * (k - 1.5) + Math.cos(a) * out * lift;
        const hz = sq[1] + L.dH[1] * 0.05 * (k - 1.5) + Math.sin(a) * out * lift;
        const y = L.squareY + 0.02 + lift * (0.2 + 0.07 * k) + 0.015 * Math.sin(t * 0.8 + k * 2);
        const sc = 1.2 + 0.25 * (k % 2);
        m.at(hx, y, hz, t * 0.15 + k, sc * (0.35 + 0.65 * inflate));
        const inkA = C.inks[k % 3], inkB = k === 1 ? C.lhWhite : C.inks[(k + 1) % 3];
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
          const col = i % 2 ? inkA : inkB;
          for (let j = 0; j < prof.length - 1; j++) {
            const [r0, y0] = prof[j], [r1, y1] = prof[j + 1];
            const yb = 0.04 + y0, yt = 0.04 + y1;
            m.LQ([Math.cos(a0) * r0, yb, Math.sin(a0) * r0], [Math.cos(a1) * r0, yb, Math.sin(a1) * r0],
              [Math.cos(a1) * r1, yt, Math.sin(a1) * r1], [Math.cos(a0) * r1, yt, Math.sin(a0) * r1], col);
          }
        }
        m.box(0, 0, 0, 0.014, 0.018, 0.014, C.wood, C.woodDark, C.woodDark);
        for (const q of [[0.012, 0.012], [-0.012, 0.012], [0.012, -0.012], [-0.012, -0.012]])
          m.box(q[0], 0.018, q[1], 0.0012, 0.024, 0.0012, C.lhDark, C.lhDark);
      }
    },

    // ------------------------------------------------------------ light
    lighting(params, t) {
      let d; // 0 = day, 1 = dusk
      if (params.light === 0) d = 0.5 - 0.5 * Math.cos((t / 110) * TAU);
      else if (params.light === 1) d = 0;
      else d = 1;
      const night = params.light === 3;
      const az = -0.5 + 0.9 * d + 0.1 * Math.sin(t * 0.01);
      const el = (58 - 44 * d) * Math.PI / 180;
      let sun = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      let sunCol = mixc([0.52, 0.49, 0.44], [0.62, 0.43, 0.3], d);
      let amb = mixc([0.62, 0.66, 0.72], [0.52, 0.47, 0.6], d);
      let ground = mixc([0.5, 0.5, 0.52], [0.45, 0.38, 0.45], d);
      let skyTop = mixc(hex('#cfe5ea'), hex('#a9a0cc'), d), skyBot = mixc(hex('#f7efdd'), hex('#f5c5a4'), d);
      let bg = mixc(hex('#e9e3d3'), hex('#e3b89f'), d);
      if (night) {
        sun = norm([0.4, 0.75, -0.3]);
        sunCol = [0.26, 0.3, 0.42]; amb = [0.26, 0.29, 0.44]; ground = [0.2, 0.2, 0.3];
        skyTop = hex('#1c2447'); skyBot = hex('#3d4474'); bg = hex('#2a3058');
      }
      this.windowsDusk = night ? 1 : sstep(0.6, 0.9, d);
      this.lampOn = night ? 1 : sstep(0.65, 0.9, d);
      return { sun: norm(sun), sunCol, amb, ground, skyTop, skyBot, bg };
    },

    // ------------------------------------------------------------ draw
    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t; this.dt = dt;
      if (!this.boats) this.resetState();

      const season = params.season | 0;
      const key = this.seed + ':' + season;
      if (this.builtKey !== key) {
        this.seasonIdx = season;
        this.layout();
        this.buildStatic(season);
        this.builtKey = key;
        this.needUpload = true;
      }
      this.listen(signals, t, dt, params);
      this.turnAngle += dt * params.turn * 0.18;
      const lt = this.lighting(params, t);

      // backdrop: a flat two-tone sky wash
      const g = p.drawingContext;
      const W = ctx.width, Hh = ctx.height;
      const grd = g.createLinearGradient(0, 0, 0, Hh);
      const css = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
      grd.addColorStop(0, css(lt.skyTop)); grd.addColorStop(1, css(lt.skyBot));
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = grd; g.fillRect(0, 0, W, Hh);

      // GL
      const pw = Math.round(p.width * p.pixelDensity()), ph = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) { try { this.initGL(); } catch (e) { this.glFailed = true; console.warn(e); } }
      if (!this.gl) {
        g.fillStyle = '#c0392b'; g.font = '24px sans-serif'; g.textAlign = 'center';
        g.fillText('Isle needs WebGL2', W / 2, Hh / 2); g.restore(); return;
      }
      const gl = this.gl;
      if (this.needUpload) { this.uploadStatic(); this.needUpload = false; }
      if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }

      // framing: fit the sea disc and the lighthouse at any aspect
      const aspect = W / Hh;
      let hh = Math.max(1.26, 1.78 / aspect) / params.zoom;
      const hw = hh * aspect;
      const offY = -0.1;
      orthoMat(VIEW, hw, hh, 6, offY, this.turnAngle, this.mvp);
      orthoMat(lt.sun, 2.35, 2.35, 4, 0, this.turnAngle, this.lmvp);

      // table shadow under the plinth: a soft flat ellipse, drawn in 2D
      const sc = Hh / (2 * hh);
      const cy = Hh / 2 + offY * sc - (PL1 * Math.cos(ELEV)) * sc;
      g.fillStyle = 'rgba(40,40,70,0.13)';
      g.beginPath(); g.ellipse(W / 2 + 0.12 * sc, cy + 0.08 * sc, (RS + 0.12) * sc, (RS + 0.12) * Math.sin(ELEV) * sc, 0, 0, TAU); g.fill();

      const E = rotY(VIEW, -this.turnAngle);
      this.windFace = Math.atan2(E[2], E[0]) + 0.4;
      this.buildDynamic(t, SEASONS[season], params);
      const dm = this.dyn;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dBuf);
      gl.bufferData(gl.ARRAY_BUFFER, dm.d.subarray(0, dm.n * 10), gl.DYNAMIC_DRAW);

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      // shadow pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.SM, this.SM);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.progD);
      gl.uniformMatrix4fv(this.uD, false, this.lmvp);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
      gl.bindVertexArray(this.sVao); gl.drawArrays(gl.TRIANGLES, 0, this.sCount);
      gl.bindVertexArray(this.dVao); gl.drawArrays(gl.TRIANGLES, 0, dm.n);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      // colour pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.prog);
      gl.uniformMatrix4fv(this.u.uMVP, false, this.mvp);
      gl.uniformMatrix4fv(this.u.uLMVP, false, this.lmvp);
      gl.uniform3fv(this.u.uSun, rotY(lt.sun, -this.turnAngle));
      gl.uniform3fv(this.u.uView, rotY(VIEW, -this.turnAngle));
      gl.uniform3fv(this.u.uSunCol, lt.sunCol);
      gl.uniform3fv(this.u.uAmb, lt.amb);
      gl.uniform3fv(this.u.uGround, lt.ground);
      gl.uniform1f(this.u.uTexel, 1 / this.SM);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.uniform1i(this.u.uShadow, 0);
      gl.bindVertexArray(this.sVao); gl.drawArrays(gl.TRIANGLES, 0, this.sCount);
      gl.bindVertexArray(this.dVao); gl.drawArrays(gl.TRIANGLES, 0, dm.n);
      gl.bindVertexArray(null);

      g.drawImage(this.glCanvas, 0, 0, W, Hh);
      g.restore();
    },
  });
})();
