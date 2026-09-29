// Fourth dimension: the regular 4-polytopes as stereographic sculpture.
//
// The reading: every regular polytope's vertices lie on the unit 3-sphere in
// R^4, and its edges are great arcs of that sphere. Stereographic projection
// from the pole (0,0,0,1) maps the 3-sphere conformally onto all of R^3, so
// great arcs become circular arcs, cells become curved "soap bubble" cells
// nested one inside another (the cell at the antipode is the small one in the
// middle, the cells near the pole are huge and wrap around everything), and a
// tube of constant 4D thickness becomes a tube whose 3D thickness is
// 1/(1 - w) times it: thin at the core, fat at the rim. Rotating the polytope
// in 4D (a plane containing W) carries cells through the pole: they bloom out
// of the core, swell, sweep past and come back from the other side, turning
// inside out. That flow never repeats, which is the thing to stare into.
// Bathsheba Grossman's printed 120-cell and the Jenn3d viewer are this view.
//
// Maths, all exact:
//   polytopes  5-cell, 16-cell and 600-cell from their standard coordinates;
//              the tesseract, 120-cell and the 5-cell's dual are their duals,
//              built by finding every tetrahedral cell (4-clique of the edge
//              graph) of the simplicial one, taking the normalised cell centre
//              as a dual vertex and joining two cells that share a triangle.
//              The 24-cell is (+-1,+-1,0,0)/sqrt2 and its dual the other
//              24-cell. So every polytope comes with its dual, aligned, which is
//              the drop's second lattice and the source of the snare's cells.
//   rotation   a 4x4 orthogonal matrix advanced every frame by Givens
//              rotations in fixed planes: XW (the flow), ZW (added by the
//              build), YZ (with XW an honest double rotation; isoclinic, a
//              Clifford rotation, when the rates are equal), YW (the kick's
//              notch). Re-orthonormalised each frame.
//   projection in the vertex shader: slerp along each edge's great arc,
//              rotate, p = xyz / (1 - w), analytic tangent, tube frame from the
//              arc's own (constant) circle plane so tubes never twist, radius
//              r / (1 - w). Tubes taper to nothing past radius ~3 so the cells
//              that swell toward infinity dissolve rather than fill the screen.
//
// Music, each reaction in its own place:
//   kick     a notch of YW rotation (eased, small), and a travelling wave: a
//            2-sphere wavefront expanding through S^3 from one vertex, drawn
//            as a band of accent ink that swells the tubes as it passes (a
//            peristaltic pulse moving through the curved cells)
//   snare    one whole cell (a dodecahedron in the 120-cell) inks itself in a
//            second colour and fades
//   hats     beads that run along single edges
//   bass     tube thickness swells
//   build    a second rotation plane (ZW) joins the flow, so it tumbles
//   drop     with Follow the track: the double rotation, faster flow, and the
//            dual polytope threads itself through the cells; the breakdown
//            settles back to one slow plane
// Look: matte glazed ceramic under a key light and a soft cast shadow on a
// plaster ground, two inks mapped to 4D depth (w) so you can see which way is
// into the fourth dimension. No glow, no spectrum.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---- polytopes ------------------------------------------------------------
  const nrm4 = (v) => { const m = Math.hypot(v[0], v[1], v[2], v[3]); return [v[0] / m, v[1] / m, v[2] / m, v[3] / m]; };
  const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

  function signs(v) {
    let out = [[]];
    for (const x of v) {
      const nx = [];
      for (const o of out) { nx.push(o.concat([x])); if (x !== 0) nx.push(o.concat([-x])); }
      out = nx;
    }
    return out;
  }
  function perms(v, evenOnly) {
    const out = [];
    const idx = [0, 1, 2, 3];
    const rec = (k) => {
      if (k === 4) {
        let inv = 0;
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (idx[i] > idx[j]) inv++;
        if (!evenOnly || inv % 2 === 0) out.push(idx.map((i) => v[i]));
        return;
      }
      for (let i = k; i < 4; i++) {
        [idx[k], idx[i]] = [idx[i], idx[k]];
        rec(k + 1);
        [idx[k], idx[i]] = [idx[i], idx[k]];
      }
    };
    rec(0);
    return out;
  }
  function uniq(vs) {
    const seen = new Map();
    for (const v of vs) {
      const u = nrm4(v);
      const key = u.map((x) => Math.round(x * 1e5)).join(',');
      if (!seen.has(key)) seen.set(key, u);
    }
    return [...seen.values()];
  }
  // Edges are the pairs at the smallest angle (true for every regular polytope).
  function edgesOf(V) {
    let best = -2;
    for (let i = 1; i < V.length; i++) best = Math.max(best, dot4(V[0], V[i]));
    const E = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (dot4(V[i], V[j]) > best - 1e-6) E.push([i, j]);
    return E;
  }
  // Dual of a simplicial polytope: its tetrahedral cells are the 4-cliques.
  function dualOfSimplicial(V, E) {
    const N = V.map(() => new Set());
    for (const [a, b] of E) { N[a].add(b); N[b].add(a); }
    const cells = [];
    for (let i = 0; i < V.length; i++) for (const j of N[i]) {
      if (j <= i) continue;
      for (const k of N[i]) {
        if (k <= j || !N[j].has(k)) continue;
        for (const l of N[i]) if (l > k && N[j].has(l) && N[k].has(l)) cells.push([i, j, k, l]);
      }
    }
    const DV = cells.map((c) => nrm4([0, 1, 2, 3].map((d) => V[c[0]][d] + V[c[1]][d] + V[c[2]][d] + V[c[3]][d])));
    const faces = new Map();
    cells.forEach((c, ci) => {
      for (let skip = 0; skip < 4; skip++) {
        const key = c.filter((_, q) => q !== skip).join(',');
        if (!faces.has(key)) faces.set(key, []);
        faces.get(key).push(ci);
      }
    });
    const DE = [];
    for (const f of faces.values()) if (f.length === 2) DE.push(f);
    return { V: DV, E: DE };
  }

  function buildPolytopes() {
    const s5 = 1 / Math.sqrt(5);
    const c5V = [[1, 1, 1, -s5], [1, -1, -1, -s5], [-1, 1, -1, -s5], [-1, -1, 1, -s5], [0, 0, 0, 4 * s5]].map(nrm4);
    const c5E = edgesOf(c5V);
    const c5D = dualOfSimplicial(c5V, c5E);

    const c16V = uniq(perms([1, 0, 0, 0]).flatMap(signs));
    const c16E = edgesOf(c16V);
    const tess = dualOfSimplicial(c16V, c16E);

    const c24V = uniq(perms([1, 1, 0, 0]).flatMap(signs));
    const c24E = edgesOf(c24V);
    const c24dV = uniq(perms([1, 0, 0, 0]).flatMap(signs).concat(signs([0.5, 0.5, 0.5, 0.5])));
    const c24dE = edgesOf(c24dV);

    const c600V = uniq(perms([1, 0, 0, 0]).flatMap(signs)
      .concat(signs([0.5, 0.5, 0.5, 0.5]))
      .concat(signs([PHI / 2, 0.5, 1 / (2 * PHI), 0]).flatMap((v) => perms(v, true))));
    const c600E = edgesOf(c600V);
    const c120 = dualOfSimplicial(c600V, c600E);

    const P = (name, V, E, DV, DE) => {
      // cos of the angle from a cell centre (a dual vertex) to the cell's vertices
      let cellDot = -2;
      for (const v of V) cellDot = Math.max(cellDot, dot4(v, DV[0]));
      return { name, V, E, DV, DE, cellDot, edgeAng: Math.acos(clamp(dot4(V[E[0][0]], V[E[0][1]]), -1, 1)),
        dualAng: Math.acos(clamp(dot4(DV[DE[0][0]], DV[DE[0][1]]), -1, 1)) };
    };
    return [
      P('5-cell', c5V, c5E, c5D.V, c5D.E),
      P('Tesseract', tess.V, tess.E, c16V, c16E),
      P('16-cell', c16V, c16E, tess.V, tess.E),
      P('24-cell', c24V, c24E, c24dV, c24dE),
      P('600-cell', c600V, c600E, c120.V, c120.E),
      P('120-cell', c120.V, c120.E, c600V, c600E),
    ];
  }

  // ---- inks -----------------------------------------------------------------
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const INKS = [
    { name: 'Plaster: cobalt & terracotta', bgIn: '#ece6da', bgOut: '#cfc6b6', shadow: [96, 72, 50, 0.26],
      inner: hex('#1f3a86'), mid: hex('#e8dcc4'), outer: hex('#c2603c'), ripple: hex('#2c5cd6'), cell: hex('#16141a'), dual: hex('#3b3733'),
      bead: hex('#f0b12c'), sky: hex('#f4eee2'), ground: hex('#8a7a66'), key: hex('#fff4e0'), spec: 0.22, shine: 28, fog: 0.55 },
    { name: 'Bronze on slate', bgIn: '#23282c', bgOut: '#0b0d0f', shadow: [0, 0, 0, 0.45],
      inner: hex('#3f8a7c'), mid: hex('#c9b48a'), outer: hex('#8a5a26'), ripple: hex('#ffd98a'), cell: hex('#e8e4da'), dual: hex('#8c8575'),
      bead: hex('#ffe2a0'), sky: hex('#6f7c86'), ground: hex('#1a1612'), key: hex('#ffe6c4'), spec: 0.55, shine: 40, fog: 0.6 },
    { name: 'Ink on paper', bgIn: '#f4f1ea', bgOut: '#dcd6ca', shadow: [60, 50, 40, 0.24],
      inner: hex('#15151a'), mid: hex('#8d8a84'), outer: hex('#1d1d22'), ripple: hex('#d8321e'), cell: hex('#2a4fa8'), dual: hex('#b9b2a6'),
      bead: hex('#d8321e'), sky: hex('#ffffff'), ground: hex('#6b645a'), key: hex('#ffffff'), spec: 0.1, shine: 18, fog: 0.5 },
  ];

  // ---- shaders --------------------------------------------------------------
  const COMMON = `
uniform mat4 uR;       // 4D rotation, applied as uR * v
uniform mat4 uVP;
uniform float uRad;    // tube radius in 4D (radians)
uniform vec2 uTaper;   // 3D radii where tubes start / finish vanishing
uniform vec4 uRip[4];  // wave sources (object space)
uniform vec4 uRipP[4]; // phase (radians), amplitude
uniform vec4 uCell;    // snare cell centre (object space)
uniform vec2 uCellP;   // cos threshold, amount
uniform float uSwell;  // how much a passing wave fattens the tube
vec3 stereo(vec4 q) { return q.xyz / max(1.0 - q.w, 1e-3); }
float taper(vec3 p) { return 1.0 - smoothstep(uTaper.x, uTaper.y, length(p)); }
float ripple(vec4 q0) {
  float r = 0.0;
  for (int i = 0; i < 4; i++) {
    float a = acos(clamp(dot(q0, uRip[i]), -1.0, 1.0));
    float d = (a - uRipP[i].x) / 0.14;
    r = max(r, uRipP[i].y * exp(-d * d));
  }
  return r;
}
float cellAmt(vec4 q0) { return uCellP.y * smoothstep(uCellP.x - 0.012, uCellP.x - 0.001, dot(q0, uCell)); }
`;

  const TUBE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aA;
layout(location = 1) in vec4 aB;
uniform int uSeg;
uniform int uSides;
${COMMON}
out vec3 vP; out vec3 vN; out float vW; out float vRip; out float vCell;
vec4 slerp4(vec4 a, vec4 b, float th, float s, float t) { return (sin((1.0 - t) * th) * a + sin(t * th) * b) / s; }
void main() {
  int quad = gl_VertexID / 6, corner = gl_VertexID - quad * 6;
  int seg = quad / uSides, side = quad - seg * uSides;
  int ds = (corner == 1 || corner == 3 || corner == 4) ? 1 : 0;
  int dr = (corner == 2 || corner == 4 || corner == 5) ? 1 : 0;
  float t = float(seg + ds) / float(uSeg);
  float ang = float(side + dr) / float(uSides) * 6.2831853;
  float th = acos(clamp(dot(aA, aB), -1.0, 1.0));
  float s = sin(th);
  vec4 q0 = slerp4(aA, aB, th, s, t);
  vec4 dq0 = th * (-cos((1.0 - t) * th) * aA + cos(t * th) * aB) / s;
  vec4 q = uR * q0, dq = uR * dq0;
  float om = max(1.0 - q.w, 1e-3);
  vec3 p = q.xyz / om;
  vec3 T = normalize((dq.xyz * om + q.xyz * dq.w) / (om * om));
  // The projected arc is a circle arc; its plane is constant along the edge,
  // so a frame built from it never twists between neighbouring rings.
  vec3 pa = stereo(uR * aA), pb = stereo(uR * aB), pm = stereo(uR * normalize(aA + aB));
  vec3 bn = cross(pm - pa, pb - pa);
  if (dot(bn, bn) < 1e-10) { bn = cross(T, abs(T.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)); }
  bn = normalize(bn - T * dot(bn, T));
  vec3 nn = cross(bn, T);
  vec3 n = cos(ang) * nn + sin(ang) * bn;
  float rip = ripple(q0);
  float lp = length(p);
  if (lp > uTaper.y * 1.3) p *= uTaper.y * 1.3 / lp;
  float r = uRad / om * taper(p) * (1.0 + uSwell * rip);
  vec3 pos = p + r * n;
  vP = pos; vN = n; vW = q.w; vRip = rip; vCell = cellAmt(q0);
  gl_Position = uVP * vec4(pos, 1.0);
}`;

  const SPH_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aC;
layout(location = 2) in vec2 aS; // size multiplier, kind (0 node, 1 bead)
${COMMON}
out vec3 vP; out vec3 vN; out float vW; out float vRip; out float vCell;
void main() {
  vec4 q = uR * aC;
  float om = max(1.0 - q.w, 1e-3);
  vec3 p = q.xyz / om;
  float rip = ripple(aC);
  float lp = length(p);
  if (lp > uTaper.y * 1.3) p *= uTaper.y * 1.3 / lp;
  float r = uRad * aS.x / om * taper(p) * (1.0 + uSwell * rip);
  vec3 pos = p + r * aPos;
  vP = pos; vN = aPos; vW = q.w;
  vRip = aS.y > 0.5 ? 2.0 : rip;
  vCell = cellAmt(aC);
  gl_Position = uVP * vec4(pos, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in float vW; in float vRip; in float vCell;
uniform vec3 uCam, uL;
uniform vec3 uInner, uMid, uOuter, uRipC, uCellC, uBead, uSky, uGround, uKey, uBg;
uniform float uSpec, uShine, uFog, uSolid; // uSolid: 1 = single ink (the dual)
uniform vec3 uSolidC;
out vec4 color;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vP);
  if (dot(N, V) < 0.0) N = -N;
  // three stops along 4D depth: the far side of the 3-sphere (the small core
  // cells), the equator, the near side (the big cells at the rim)
  vec3 base = vW < -0.3 ? mix(uInner, uMid, smoothstep(-0.95, -0.3, vW)) : mix(uMid, uOuter, smoothstep(0.05, 0.62, vW));
  base = mix(base, uSolidC, uSolid);
  float rip = min(vRip, 1.0);
  base = mix(base, uRipC, rip);
  base = mix(base, uCellC, vCell);
  if (vRip > 1.5) base = uBead;
  float hemi = N.y * 0.5 + 0.5;
  vec3 amb = mix(uGround, uSky, hemi) * 0.42;
  float dif = max(dot(N, uL), 0.0);
  float wrap = max((dot(N, uL) + 0.35) / 1.35, 0.0);
  vec3 col = base * (amb + uKey * (0.72 * dif + 0.18 * wrap));
  vec3 H = normalize(uL + V);
  col += uKey * uSpec * pow(max(dot(N, H), 0.0), uShine);
  // aerial perspective: deeper tubes sink toward the ground colour
  float depth = length(uCam - vP);
  float f = smoothstep(uFog - 2.5, uFog + 3.5, depth) * 0.55;
  col = mix(col, uBg, f);
  color = vec4(col, 1.0);
}`;

  // ---- small 4x4 helpers (row-major, M[r*4+c]) -----------------------------
  const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function givens(M, i, j, a) {
    if (a === 0) return;
    const c = Math.cos(a), s = Math.sin(a);
    for (let k = 0; k < 4; k++) {
      const x = M[i * 4 + k], y = M[j * 4 + k];
      M[i * 4 + k] = c * x - s * y;
      M[j * 4 + k] = s * x + c * y;
    }
  }
  function orthonormalize(M) {
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q < r; q++) {
        let d = 0;
        for (let k = 0; k < 4; k++) d += M[r * 4 + k] * M[q * 4 + k];
        for (let k = 0; k < 4; k++) M[r * 4 + k] -= d * M[q * 4 + k];
      }
      let m = 0;
      for (let k = 0; k < 4; k++) m += M[r * 4 + k] * M[r * 4 + k];
      m = Math.sqrt(m);
      for (let k = 0; k < 4; k++) M[r * 4 + k] /= m;
    }
  }
  const apply4 = (M, v) => [0, 1, 2, 3].map((r) => M[r * 4] * v[0] + M[r * 4 + 1] * v[1] + M[r * 4 + 2] * v[2] + M[r * 4 + 3] * v[3]);
  const colMajor = (M, out) => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = M[r * 4 + c]; return out; };
  const stereoR = (q) => { const om = Math.max(1 - q[3], 1e-3); return Math.hypot(q[0], q[1], q[2]) / om; };

  function viewProj(eye, aspect, fovY, out) {
    const f = [-eye[0], -eye[1], -eye[2]];
    const fl = Math.hypot(f[0], f[1], f[2]); f[0] /= fl; f[1] /= fl; f[2] /= fl;
    let s = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0];
    const sl = Math.hypot(s[0], s[1], s[2]); s = [s[0] / sl, s[1] / sl, s[2] / sl];
    const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const V = [s[0], s[1], s[2], -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]),
      u[0], u[1], u[2], -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
      -f[0], -f[1], -f[2], (f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2]),
      0, 0, 0, 1];
    const n = 0.3, fa = 40, t = 1 / Math.tan(fovY / 2);
    const P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), 2 * fa * n / (n - fa), 0, 0, -1, 0];
    const M = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      let x = 0;
      for (let k = 0; k < 4; k++) x += P[r * 4 + k] * V[k * 4 + c];
      M[r * 4 + c] = x;
    }
    return colMajor(M, out);
  }

  const PRESETS = {
    calm: { flow: 0.45, double: 0, dual: 0, thick: 1 },
    drop: { flow: 1.35, double: 1, dual: 1, thick: 1.15 },
  };
  const DRIVE = ['flow', 'double', 'dual', 'thick'];

  VIZ.register({
    id: 'fourd',
    name: 'Fourth Dimension',
    order: 608,
    gallery: {
      title: 'Fourth Dimension',
      technique: 'WebGL2 instanced tubes and spheres generated in the vertex shader: each instance is one polytope edge (two unit 4-vectors); the shader walks the great arc between them by slerp, applies a 4D rotation matrix, projects stereographically (xyz / (1 - w)), builds the tube frame from the projected arc\'s own circle plane and scales its radius by the conformal factor 1 / (1 - w), tapering to nothing past radius 3. Polytopes from standard coordinates, duals from 4-clique cell enumeration. Lambert, hemisphere and a soft glaze highlight; a downsampled silhouette makes the cast shadow on a Canvas 2D plaster ground.',
      brief: 'The regular 4D polytopes as a ceramic sculpture seen through stereographic projection: curved cells nested like soap bubbles, the small cell at the heart the far side of the 3-sphere and the huge ones at the rim the near side. A slow rotation through the fourth dimension carries cells out of the core, swells them, sweeps them past and brings them back turned inside out, endlessly. Two inks mark 4D depth. The kick sends a wavefront out through the 3-sphere from one vertex, a band of saffron that fattens the tubes as it passes, and nudges the rotation a notch; the snare inks one whole cell; hats run beads along single edges; the bass thickens the tubes. The build adds a second rotation plane so it tumbles; the drop throws it into a double (Clifford) rotation and threads the dual polytope through its cells; the breakdown settles back to a single slow turn.',
      lineage: 'Raph\'s sketch idea (2026-09-28): "Would love something inspired by 4D shapes too." Descends from Bathsheba Grossman\'s stereographic 120-cell sculptures, the Jenn3d viewer, Thomas Banchoff\'s rotating hypercube films, Coxeter\'s Regular Polytopes, and the Dimensions films (Leys, Ghys, Alvarez).',
    },

    params: [
      { key: 'shape', label: 'Polytope', type: 'select', options: ['5-cell', 'Tesseract', '16-cell', '24-cell', '600-cell', '120-cell'], default: 5 },
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      { key: 'flow', label: 'Flow through W', type: 'range', min: 0, max: 2.5, step: 0.01, default: PRESETS.calm.flow },
      { key: 'double', label: 'Double rotation', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.double },
      { key: 'dual', label: 'Dual lattice', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.dual },
      { key: 'thick', label: 'Tube thickness', type: 'range', min: 0.4, max: 2, step: 0.01, default: PRESETS.calm.thick },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      if (!this.polys) this.polys = buildPolytopes();
      this.R = ident();
      // start from a turned pose, so no axis lines up with the screen
      givens(this.R, 0, 3, 0.9); givens(this.R, 1, 2, 0.5); givens(this.R, 2, 3, 0.7); givens(this.R, 0, 1, 0.3);
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.kickCount = 0;
      this.lastSnare = -10; this.lastHat = -10; this.hatCount = 0;
      this.bassEnv = 0; this.low = 0; this.hatSlow = 0; this.energy = 0;
      this.dropOn = false; this.auto = 0; this.build = 0;
      this.notchT = 0; this.notch = 0;
      this.ripples = [];
      this.cell = null;
      this.beads = [];
      this.cam = 0;
    },

    initGL() {
      this.glCanvas = document.createElement('canvas');
      const gl = this.glCanvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
      if (!gl) { this.glFailed = true; return; }
      this.gl = gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const U = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(pr, nm); }
        return { pr, U };
      };
      this.tubeP = link(TUBE_VS, FS);
      this.sphP = link(SPH_VS, FS);

      // unit sphere mesh (lat-long), as a triangle list
      const la = 10, lo = 16, sv = [];
      const pt = (i, j) => { const th = Math.PI * i / la, ph = TAU * j / lo; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };
      for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
        sv.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
      this.sphN = sv.length / 3;
      this.sphBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sphBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sv), gl.STATIC_DRAW);

      // one VAO set per polytope, built lazily
      this.geo = [];
      this.beadBuf = gl.createBuffer();
      this.beadData = new Float32Array(64 * 6);
      this.beadVao = this.sphereVao(this.beadBuf);
    },

    sphereVao(instBuf) {
      const gl = this.gl;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sphBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
      return vao;
    },

    tubeVao(V, E) {
      const gl = this.gl;
      const d = new Float32Array(E.length * 8);
      E.forEach(([a, b], i) => { d.set(V[a], i * 8); d.set(V[b], i * 8 + 4); });
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
      gl.bindVertexArray(null);
      return vao;
    },

    nodeVao(V, size) {
      const gl = this.gl;
      const d = new Float32Array(V.length * 6);
      V.forEach((v, i) => { d.set(v, i * 6); d[i * 6 + 4] = size; d[i * 6 + 5] = 0; });
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      return this.sphereVao(buf);
    },

    geometry(i) {
      if (!this.geo[i]) {
        const P = this.polys[i];
        const seg = (a) => Math.max(6, Math.ceil(a / (3.5 * Math.PI / 180)));
        this.geo[i] = {
          tube: this.tubeVao(P.V, P.E), nE: P.E.length, seg: seg(P.edgeAng),
          dtube: this.tubeVao(P.DV, P.DE), nDE: P.DE.length, dseg: seg(P.dualAng),
          node: this.nodeVao(P.V, 1.45), nV: P.V.length,
          dnode: this.nodeVao(P.DV, 1.6), nDV: P.DV.length,
        };
      }
      return this.geo[i];
    },

    // Pick an element of list whose rotated position projects to a legible place.
    pickVisible(list, seed, lo, hi) {
      const n = list.length;
      const start = Math.floor(hash(seed) * n);
      for (let k = 0; k < n; k++) {
        const i = (start + k * 7919) % n;
        const r = stereoR(apply4(this.R, list[i]));
        if (r > lo && r < hi) return i;
      }
      return start;
    },

    listen(s, t, dt, P, react) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        this.notchT += (TAU / 90) * clamp(react, 0, 2) * (this.kickCount % 2 ? 1 : -0.6);
        const vi = this.pickVisible(P.V, this.kickCount * 3.7 + 0.5, 0.35, 1.5);
        this.ripples.push({ src: P.V[vi], t0: t, amp: clamp(b0 / 85, 0.5, 1) * clamp(react, 0, 1.3) });
        if (this.ripples.length > 4) this.ripples.shift();
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t;
        const ci = this.pickVisible(P.DV, this.lastSnare * 1.9 + 3.3, 0.5, 1.7);
        this.cell = { c: P.DV[ci], t0: t, amp: clamp(b4 / 80, 0.5, 1) * clamp(react, 0, 1.2) };
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t; this.hatCount++;
        const n = 1 + Math.floor(hash(this.hatCount * 1.37) * (1.5 + 2.5 * this.auto) * Math.min(1, react));
        for (let i = 0; i < n; i++) {
          const ei = this.pickVisible(P.E.map((e) => P.V[e[0]]), this.hatCount * 5.1 + i * 1.7, 0.3, 2.2);
          const e = P.E[ei];
          const fwd = hash(this.hatCount * 2.9 + i) < 0.5;
          this.beads.push({ a: P.V[fwd ? e[0] : e[1]], b: P.V[fwd ? e[1] : e[0]], t0: t, dur: 0.55 + 0.4 * hash(this.hatCount + i * 3.1) });
        }
        if (this.beads.length > 64) this.beads.splice(0, this.beads.length - 64);
      }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.45, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.12) : k(0.5));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.7);
      this.hatSlow += ((s[6] + s[7] + s[8]) / 300 - this.hatSlow) * k(0.8);
      const kicking = t - this.lastKick < 0.9;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.22 || t - this.lastKick > 1.6)) this.dropOn = false;
      // the build: hats climbing with no bass line under them yet
      const bt = this.dropOn ? 0 : clamp((this.hatSlow - 0.12) * 3.5, 0, 1);
      this.build += (bt - this.build) * k(bt > this.build ? 1.2 : 2.5);
      this.auto += ((this.dropOn ? 1 : 0) - this.auto) * k(this.dropOn ? 1.1 : 2.8);
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.polys) this.reset();
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const g = p.drawingContext;
      const I = INKS[clamp(Math.round(params.inks) || 0, 0, INKS.length - 1)];
      const shapeI = clamp(Math.round(params.shape), 0, 5);
      const P = this.polys[shapeI];
      if (this.shapeI !== shapeI) { this.shapeI = shapeI; this.ripples = []; this.beads = []; this.cell = null; }
      const react = params.react;
      this.listen(signals, t, dt, P, react);

      const follow = Math.round(params.follow) === 1;
      const Q = {};
      for (const key of DRIVE) Q[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? this.auto : 0);

      // ---- 4D motion ----------------------------------------------------------
      const wXW = Q.flow * 0.2;
      givens(this.R, 0, 3, wXW * dt);                                   // the flow
      givens(this.R, 1, 2, Q.double * wXW * dt);                        // with XW: a double rotation
      givens(this.R, 2, 3, this.build * (1 - this.auto) * 0.12 * dt);  // the build's second plane
      const dn = (this.notchT - this.notch) * (1 - Math.exp(-dt / 0.14));
      this.notch += dn;
      givens(this.R, 1, 3, dn);                                         // the kick's notch
      orthonormalize(this.R);
      this.cam += dt * (0.05 + 0.03 * Q.flow);

      // ---- background ---------------------------------------------------------
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.filter = 'none';
      const cx = W / 2, cy = H / 2;
      const bg = g.createRadialGradient(cx, cy * 0.9, 0, cx, cy, Math.hypot(W, H) * 0.6);
      bg.addColorStop(0, I.bgIn); bg.addColorStop(1, I.bgOut);
      g.fillStyle = bg; g.fillRect(-2, -2, W + 4, H + 4);

      if (!this.gl && !this.glFailed) { try { this.initGL(); } catch (e) { this.glFailed = true; console.error(e); } }
      if (this.glFailed) {
        g.fillStyle = '#a33'; g.font = '20px sans-serif'; g.textAlign = 'center';
        g.fillText('WebGL2 unavailable', cx, cy); g.restore(); return;
      }

      const gl = this.gl;
      const pw = Math.round(p.width * p.pixelDensity()), ph = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);

      const aspect = W / H;
      const fov0 = 34 * Math.PI / 180;
      const fovY = aspect >= 1 ? fov0 : 2 * Math.atan(Math.tan(fov0 / 2) / aspect);
      const D = 10.4;
      const yaw = 0.55 * Math.sin(this.cam * 0.7) + this.cam * 0.15, pitch = 0.28 + 0.16 * Math.sin(this.cam * 0.43 + 1);
      const eye = [D * Math.sin(yaw) * Math.cos(pitch), D * Math.sin(pitch), D * Math.cos(yaw) * Math.cos(pitch)];
      this.vp = viewProj(eye, aspect, fovY, this.vp || new Float32Array(16));
      this.rm = colMajor(this.R, this.rm || new Float32Array(16));
      // key light from the upper left, in front
      const L = [-0.5, 0.75, 0.45]; const ll = Math.hypot(L[0], L[1], L[2]);
      const Lr = [0, 1, 2].map((i) => L[i] / ll);
      // rotate the light with the camera yaw so the modelling stays constant on screen
      const cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const Lw = [Lr[0] * cyw + Lr[2] * syw, Lr[1], -Lr[0] * syw + Lr[2] * cyw];

      // tube radius in 4D, scaled to the edge length so every polytope reads alike
      const baseRad = 0.04 * Math.pow(P.edgeAng / 0.27, 0.3) * Q.thick * (1 + 0.28 * this.bassEnv * clamp(react, 0, 2));
      const rip = new Float32Array(16), ripP = new Float32Array(16);
      this.ripples = this.ripples.filter((r) => t - r.t0 < 1.8);
      this.ripples.forEach((r, i) => {
        const ph2 = (t - r.t0) * 1.0;
        rip.set(r.src, i * 4);
        ripP[i * 4] = ph2;
        // a bubble that grows out of one vertex and fades as it spreads, so the
        // kick stays in one region of the sculpture
        ripP[i * 4 + 1] = r.amp * (1 - clamp(ph2 / 1.75, 0, 1)) ** 1.2 * clamp(ph2 / 0.08, 0, 1);
      });
      let cellAmt = 0, cellC = [1, 0, 0, 0];
      if (this.cell) {
        const a = t - this.cell.t0;
        cellAmt = this.cell.amp * clamp(a / 0.05, 0, 1) * Math.exp(-Math.max(0, a - 0.05) / 0.45);
        cellC = this.cell.c;
        if (a > 3) this.cell = null;
      }

      const common = (pr, rad, solid) => {
        const U = pr.U;
        gl.useProgram(pr.pr);
        gl.uniformMatrix4fv(U.uR, false, this.rm);
        gl.uniformMatrix4fv(U.uVP, false, this.vp);
        gl.uniform1f(U.uRad, rad);
        gl.uniform2f(U.uTaper, 1.35, 3.7);
        gl.uniform4fv(U.uRip, rip); gl.uniform4fv(U.uRipP, ripP);
        gl.uniform4fv(U.uCell, cellC); gl.uniform2f(U.uCellP, P.cellDot, cellAmt);
        gl.uniform1f(U.uSwell, 0.3);
        gl.uniform3fv(U.uCam, eye); gl.uniform3fv(U.uL, Lw);
        gl.uniform3fv(U.uInner, I.inner); gl.uniform3fv(U.uMid, I.mid); gl.uniform3fv(U.uOuter, I.outer);
        gl.uniform3fv(U.uRipC, I.ripple); gl.uniform3fv(U.uCellC, I.cell); gl.uniform3fv(U.uBead, I.bead);
        gl.uniform3fv(U.uSky, I.sky); gl.uniform3fv(U.uGround, I.ground); gl.uniform3fv(U.uKey, I.key);
        gl.uniform3fv(U.uBg, hex(I.bgIn));
        gl.uniform1f(U.uSpec, I.spec); gl.uniform1f(U.uShine, I.shine); gl.uniform1f(U.uFog, D + I.fog);
        gl.uniform1f(U.uSolid, solid); gl.uniform3fv(U.uSolidC, I.dual);
      };

      const G = this.geometry(shapeI);
      const SIDES = 10;
      common(this.tubeP, baseRad, 0);
      gl.uniform1i(this.tubeP.U.uSeg, G.seg); gl.uniform1i(this.tubeP.U.uSides, SIDES);
      gl.bindVertexArray(G.tube);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, G.seg * SIDES * 6, G.nE);
      const dual = clamp(Q.dual, 0, 1);
      if (dual > 0.02) {
        common(this.tubeP, baseRad * 0.34 * dual, 1);
        gl.uniform1i(this.tubeP.U.uSeg, G.dseg); gl.uniform1i(this.tubeP.U.uSides, 8);
        gl.bindVertexArray(G.dtube);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, G.dseg * 8 * 6, G.nDE);
      }
      common(this.sphP, baseRad, 0);
      gl.bindVertexArray(G.node);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.sphN, G.nV);
      if (dual > 0.02) {
        common(this.sphP, baseRad * 0.34 * dual, 1);
        gl.bindVertexArray(G.dnode);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, this.sphN, G.nDV);
      }
      // hat beads, running along single edges
      this.beads = this.beads.filter((b) => t - b.t0 < b.dur);
      let nb = 0;
      for (const b of this.beads) {
        const u = (t - b.t0) / b.dur;
        const th = Math.acos(clamp(dot4(b.a, b.b), -1, 1)), s = Math.sin(th);
        const e = u * u * (3 - 2 * u);
        const wa = Math.sin((1 - e) * th) / s, wb = Math.sin(e * th) / s;
        for (let d = 0; d < 4; d++) this.beadData[nb * 6 + d] = wa * b.a[d] + wb * b.b[d];
        this.beadData[nb * 6 + 4] = 2.1 * Math.sin(Math.PI * clamp(u * 1.4, 0, 1)) ** 0.5;
        this.beadData[nb * 6 + 5] = 1;
        nb++;
      }
      if (nb) {
        common(this.sphP, baseRad, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.beadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, this.beadData.subarray(0, nb * 6), gl.DYNAMIC_DRAW);
        gl.bindVertexArray(this.beadVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, this.sphN, nb);
      }
      gl.bindVertexArray(null);

      // ---- compose: cast shadow, then the sculpture ---------------------------
      if (!this.shCanvas) { this.shCanvas = document.createElement('canvas'); this.sh = this.shCanvas.getContext('2d'); }
      const sw = Math.max(8, Math.round(W / 3)), shh = Math.max(8, Math.round(H / 3));
      if (this.shCanvas.width !== sw || this.shCanvas.height !== shh) { this.shCanvas.width = sw; this.shCanvas.height = shh; }
      const sh = this.sh;
      sh.globalCompositeOperation = 'source-over';
      sh.clearRect(0, 0, sw, shh);
      sh.filter = 'blur(1.2px)';
      sh.drawImage(this.glCanvas, 0, 0, sw, shh);
      sh.filter = 'none';
      sh.globalCompositeOperation = 'source-in';
      sh.fillStyle = 'rgb(' + I.shadow[0] + ',' + I.shadow[1] + ',' + I.shadow[2] + ')';
      sh.fillRect(0, 0, sw, shh);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.globalAlpha = I.shadow[3];
      // a lamp up and to the left throws a big soft shadow on the wall: the
      // shadow of the 3D shadow of the 4D object, filling the stage's wings
      const ss = 1.5, ox = cx + S * 0.2, oy = cy + S * 0.12;
      g.drawImage(this.shCanvas, ox - W * ss / 2, oy - H * ss / 2, W * ss, H * ss);
      g.globalAlpha = 1;
      g.drawImage(this.glCanvas, 0, 0, W, H);
      g.restore();
    },
  });
})();
