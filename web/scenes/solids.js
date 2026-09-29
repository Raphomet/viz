// Solids: a white wireframe polyhedron on black that climbs, springily, from a
// tetrahedron to a truncated icosidodecahedron with the music and relaxes back.
//
// The morph is never a crossfade: every frame draws the true edges of a real
// convex polyhedron. The ladder of forms is one continuous path through three
// families of solids, joined only at shapes the families have in common:
//
//   0 tetrahedron  --K--> 1 cube --O--> 2 cuboctahedron --O--> 3 octahedron
//   --J--> 4 icosahedron --I--> 5 dodecahedron --> 6 icosidodecahedron
//   --> 7 truncated icosahedron --> 8 rhombicosidodecahedron
//   --> 9 truncated icosidodecahedron
//
// K  "dual growing out": the convex hull of a tetrahedron and its dual scaled
//    by s. At s = 1/3 the dual's vertices sit on the tetrahedron's faces (flat
//    pyramids); between, a triakis tetrahedron; at s = 1 the pyramid pairs go
//    coplanar and the hull is the cube.
// O, I  Wythoff's kaleidoscope. A generator point P inside one chamber of the
//    octahedral (48) or icosahedral (120) reflection group; the solid is the
//    hull of P's orbit, and its edges are exactly the segments g.P -> g.r_i.P
//    for the three chamber mirrors r_i. P is fixed by d, its distances to the
//    three mirrors (which are the half edge lengths): d = (1,0,0), (0,1,0),
//    (0,0,1) are the two regular solids and the rectified one, two nonzero
//    equal entries the truncations and the expansion, all three the
//    omnitruncation. Any d >= 0 is a genuine polyhedron, so the in-betweens
//    are simply straight lines in d; an edge whose mirror distance is zero has
//    zero length, which is how vertices split apart and merge back.
// J  Fuller's jitterbug: the twelve points (0, +-1, +-t) cyclically permuted.
//    t = 0 is the octahedron (the points meet in pairs), t = 1/phi the
//    icosahedron, and between them the eight octant triangles twist open.
//
// The families share one frame (all circumradius 1), so each join is exact:
// K's cube is O's cube, O's octahedron is J at t = 0, and the icosahedral
// group is built from J's icosahedron. Edges of the triangulated families (K,
// J) are drawn as bright as they are sharp: an edge between two faces going
// coplanar fades out, as it stops being an edge.
//
// Music: the build and the drop move a target rung up the ladder, and each
// kick takes one step toward it (a kick with nowhere to go gives the spring a
// nudge instead: a glimpse of the next form, then back). A spring carries the
// position, so every step overshoots into the next form and settles. The
// clap boings the size, hats light single vertices, bass speeds the turning.
// The drop nests smaller solids inside (Kepler's cosmographic shells); with no
// kick the solid relaxes rung by rung back to the tetrahedron.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (x) => clamp(x, 0, 1);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---- small vector helpers --------------------------------------------------
  const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

  // ---- Wythoff families ------------------------------------------------------
  // Chamber vertices A, B, C; mirror i is the side opposite vertex i, with its
  // normal pointing into the chamber.
  function wythoff(A, B, C) {
    A = norm(A); B = norm(B); C = norm(C);
    const orient = (n, inside) => (dot(n, inside) < 0 ? n.map((x) => -x) : n);
    const N = [orient(norm(cross(B, C)), A), orient(norm(cross(A, C)), B), orient(norm(cross(A, B)), C)];
    const refl = (n) => [
      1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[2],
      -2 * n[1] * n[0], 1 - 2 * n[1] * n[1], -2 * n[1] * n[2],
      -2 * n[2] * n[0], -2 * n[2] * n[1], 1 - 2 * n[2] * n[2]];
    const mul = (a, b) => {
      const o = new Array(9);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      }
      return o;
    };
    const key = (m) => m.map((x) => Math.round(x * 1e4)).join(',');
    const R = N.map(refl);
    const G = [[1, 0, 0, 0, 1, 0, 0, 0, 1]];
    const index = new Map([[key(G[0]), 0]]);
    const right = [];                       // right[g][i] = index of g . r_i
    for (let q = 0; q < G.length; q++) {
      right[q] = [];
      for (let i = 0; i < 3; i++) {
        const m = mul(G[q], R[i]);
        const k = key(m);
        let j = index.get(k);
        if (j === undefined) { j = G.length; G.push(m); index.set(k, j); }
        right[q][i] = j;
      }
    }
    const edges = [];
    for (let g = 0; g < G.length; g++) for (let i = 0; i < 3; i++) {
      const h = right[g][i];
      if (g < h) edges.push([g, h, i]);
    }
    // Solve n_i . P = d_i: rows of M are the normals, so P = M^-1 d.
    const M = N;
    const det = dot(M[0], cross(M[1], M[2]));
    const inv = [cross(M[1], M[2]), cross(M[2], M[0]), cross(M[0], M[1])].map((c) => c.map((x) => x / det));
    return { G, edges, inv, n: G.length };
  }

  const FAM_O = wythoff([1, 0, 0], [1, 1, 1], [1, 1, 0]);
  const IA = [0, PHI, 1], IB = add(add([0, PHI, 1], [1, 0, PHI]), [PHI, 1, 0]), IC = add([0, PHI, 1], [1, 0, PHI]);
  const FAM_I = wythoff(IA, IB, IC);

  // ---- triangulated families (fixed topology, edges fade by sharpness) --------
  function topology(tris) {
    const map = new Map();
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3], w = t[(k + 2) % 3];
        const key = a < b ? a + ':' + b : b + ':' + a;
        const e = map.get(key);
        if (e) e.push(w); else map.set(key, [Math.min(a, b), Math.max(a, b), w]);
      }
    }
    return [...map.values()];               // [a, b, wing1, wing2]
  }

  // K: tetrahedron vertices 0-3, dual apexes 4-7 (apex 4+l sits over the face
  // opposite vertex l).
  const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm);
  const K_TRIS = [];
  for (let l = 0; l < 4; l++) {
    const f = [0, 1, 2, 3].filter((v) => v !== l);
    for (let k = 0; k < 3; k++) K_TRIS.push([4 + l, f[k], f[(k + 1) % 3]]);
  }
  const K_EDGES = topology(K_TRIS);

  // J: vertex (0, b, c t) cyclically permuted; index = perm*4 + (b<0)*2 + (c<0).
  const jIdx = (perm, b, c) => perm * 4 + (b < 0 ? 2 : 0) + (c < 0 ? 1 : 0);
  const J_TRIS = [];
  for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) {
    // Octant triangle: (0, b, c t), (a t, 0, c), (a, b t, 0).
    J_TRIS.push([jIdx(0, b, c), jIdx(1, c, a), jIdx(2, a, b)]);
  }
  for (let perm = 0; perm < 3; perm++) for (const b of [1, -1]) {
    // The short edge (0, b, +-t) and the two points either side of it.
    const nextPerm = (perm + 2) % 3;         // the (a, b t, 0)-type in this frame
    for (const a of [1, -1]) J_TRIS.push([jIdx(perm, b, 1), jIdx(perm, b, -1), jIdx(nextPerm, a, b)]);
  }
  const J_EDGES = topology(J_TRIS);

  function jVerts(t) {
    const out = new Array(12);
    for (let perm = 0; perm < 3; perm++) for (const b of [1, -1]) for (const c of [1, -1]) {
      const base = [0, b, c * t];
      const v = perm === 0 ? base : perm === 1 ? [base[2], base[0], base[1]] : [base[1], base[2], base[0]];
      out[jIdx(perm, b, c)] = norm(v);
    }
    return out;
  }

  // ---- the ladder -------------------------------------------------------------
  const STATIONS = [
    { name: 'Tetrahedron', fam: 'K', s: 1 / 3 },
    { name: 'Cube', fam: 'O', d: [0, 1, 0] },
    { name: 'Cuboctahedron', fam: 'O', d: [0, 0, 1] },
    { name: 'Octahedron', fam: 'O', d: [1, 0, 0] },
    { name: 'Icosahedron', fam: 'I', d: [1, 0, 0] },
    { name: 'Dodecahedron', fam: 'I', d: [0, 1, 0] },
    { name: 'Icosidodecahedron', fam: 'I', d: [0, 0, 1] },
    { name: 'Truncated icosahedron', fam: 'I', d: [1, 0, 1] },
    { name: 'Rhombicosidodecahedron', fam: 'I', d: [1, 1, 0] },
    { name: 'Truncated icosidodecahedron', fam: 'I', d: [1, 1, 1] },
  ];
  const TOP = STATIONS.length - 1;
  // Which family carries each segment (station i -> i + 1).
  const SEG = ['K', 'O', 'O', 'J', 'I', 'I', 'I', 'I', 'I'];

  // Geometry at ladder position x: { V: [[x,y,z]...], E: [[i, j, alpha]...] }.
  // Below 0 the position reflects (the dual's apexes can't sink inside the
  // tetrahedron and still be a hull); above the top it extrapolates along the
  // last segment, still a real (non-uniform) omnitruncation.
  function solidAt(x) {
    x = Math.abs(x);
    let seg = Math.min(Math.floor(x), TOP - 1);
    let u = x - seg;
    // Exactly on a rung, use the segment that ends there: J at t = 0 has its
    // vertices meeting in pairs, and its degenerate triangles have no normal.
    if (u < 1e-6 && seg > 0) { seg--; u = 1; }
    const fam = SEG[seg];
    if (fam === 'K') {
      const s = 1 / 3 + (2 / 3) * u;
      const V = TET.concat(TET.map((v) => [-v[0] * s, -v[1] * s, -v[2] * s]));
      return { V, E: bentEdges(V, K_EDGES) };
    }
    if (fam === 'J') {
      const V = jVerts(u / PHI);
      return { V, E: bentEdges(V, J_EDGES) };
    }
    const F = fam === 'O' ? FAM_O : FAM_I;
    const d0 = STATIONS[seg].d, d1 = STATIONS[seg + 1].d;
    // |d|: a point pushed through a mirror has the same orbit as its
    // reflection, so a spring overshoot there bounces instead of breaking.
    const d = [0, 1, 2].map((k) => Math.abs(d0[k] + (d1[k] - d0[k]) * u));
    const P = norm([dot(F.inv.map((r) => r[0]), d), dot(F.inv.map((r) => r[1]), d), dot(F.inv.map((r) => r[2]), d)]);
    const V = F.G.map((m) => [
      m[0] * P[0] + m[1] * P[1] + m[2] * P[2],
      m[3] * P[0] + m[4] * P[1] + m[5] * P[2],
      m[6] * P[0] + m[7] * P[1] + m[8] * P[2]]);
    return mergeWythoff(V, F.edges);
  }

  // Many group images of P coincide when P lies on a mirror; merge them so
  // each edge is drawn once, and drop the zero-length ones.
  function mergeWythoff(V, edges) {
    const canon = new Map(), idx = new Array(V.length), U = [];
    for (let i = 0; i < V.length; i++) {
      const v = V[i];
      const k = Math.round(v[0] * 2e4) + ',' + Math.round(v[1] * 2e4) + ',' + Math.round(v[2] * 2e4);
      let j = canon.get(k);
      if (j === undefined) { j = U.length; U.push(v); canon.set(k, j); }
      idx[i] = j;
    }
    const seen = new Set(), E = [];
    for (const [a0, b0] of edges) {
      const a = idx[a0], b = idx[b0];
      if (a === b) continue;
      const k = a < b ? a * 4096 + b : b * 4096 + a;
      if (seen.has(k)) continue;
      seen.add(k);
      const L = Math.hypot(U[a][0] - U[b][0], U[a][1] - U[b][1], U[a][2] - U[b][2]);
      E.push([a, b, smooth(0, 0.03, L)]);
    }
    return { V: U, E };
  }

  // Edge brightness from its bend (pi minus the dihedral angle): full for any
  // real crease, zero as the two faces go flat.
  function bentEdges(V, edges) {
    const E = [];
    for (const [a, b, w1, w2] of edges) {
      const A = V[a], B = V[b];
      const n1 = faceNormal(A, B, V[w1]), n2 = faceNormal(A, B, V[w2]);
      const bend = Math.acos(clamp(dot(n1, n2), -1, 1));
      const L = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      E.push([a, b, smooth(0.02, 0.2, bend) * smooth(0, 0.03, L)]);
    }
    return E;
  }
  function faceNormal(a, b, c) {
    let n = norm(cross(sub(b, a), sub(c, a)));
    const m = add(add(a, b), c);
    if (dot(n, m) < 0) n = n.map((x) => -x);   // outward: the solids are centred
    return n;
  }

  const PRESETS = {
    calm: { ceiling: 4, nest: 0, spin: 0.55, weight: 1, spring: 0.6 },
    drop: { ceiling: 9, nest: 2, spin: 1.25, weight: 1.3, spring: 0.75 },
  };
  const DRIVE = ['ceiling', 'nest', 'spin', 'weight'];

  VIZ.register({
    id: 'solids',
    name: 'Solids',
    order: 606,
    gallery: {
      title: 'Solids',
      technique: 'Canvas 2D wireframe in hand-rolled perspective. One continuous ladder of real convex polyhedra: a tetrahedron grows its dual into a cube (hull of the pair), Wythoff\'s kaleidoscope for the octahedral and icosahedral groups (a generator point in one reflection chamber, edges g.P to g.r.P, moved in mirror-distance space so vertices split and merge), and Fuller\'s jitterbug joining the octahedron to the icosahedron. Families meet only at shared shapes; a damped spring carries the position along the ladder; edges fade by depth and by facing, and triangulated-family edges by their sharpness.',
      brief: 'White lines on black: one solid turning slowly in the middle of the screen. With the music it morphs, springily, into more complex solids, and every in-between is itself a real polyhedron: the cube truncates to a cuboctahedron, the octahedron\'s vertices split and twist open into the icosahedron, the dodecahedron expands into the rhombicosidodecahedron. Each kick takes one step up the ladder (overshooting into the next form and settling back) or, with nowhere to go, gives the spring a nudge; the clap boings its size; hats light single vertices; bass turns it faster. The drop reaches the truncated icosidodecahedron with smaller solids nested inside; the breakdown relaxes rung by rung back to the tetrahedron.',
      lineage: 'Raph\'s own long-held idea (2026-09-28), one he says he never managed to code: "Imagine drawing a platonic solid shape in the center of the screen. It\'s just white lines, 3D, on a black background. In reaction to the music, it morphs into more complicated platonic solids... The morph is a little sproingy." '
        + 'Descends from Wythoff\'s kaleidoscopic construction of the uniform polyhedra (1918) and Coxeter\'s Regular Polytopes, Buckminster Fuller\'s jitterbug transformation, Kepler\'s nested solids in the Mysterium Cosmographicum (the drop\'s shells), and the vector wireframes of early computer graphics.',
    },

    params: [
      { key: 'ceiling', label: 'Climbs as far as', type: 'select', options: STATIONS.map((s) => s.name), default: 6 },
      { key: 'nest', label: 'Nested solids', type: 'range', min: 0, max: 2, step: 1, default: 0 },
      { key: 'spin', label: 'Turning speed', type: 'range', min: 0, max: 2.5, step: 0.01, default: 0.7 },
      { key: 'spring', label: 'Sproing', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.4, max: 3, step: 0.01, default: 1 },
      { key: 'hidden', label: 'Hidden-line fade', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
      { key: 'caption', label: 'Name the solid', type: 'select', options: ['Off', 'On'], default: 0 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    solidAt,                                  // exposed for checking the geometry offline

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.lastT = null;
      this.env = { kf: 0, ks: 0, kArm: true, lastK: -9, cf: 0, cs: 0, cArm: true, lastC: -9,
        hf: 0, hs: 0, hArm: true, lastH: -9, bass: 0, low: 0, drive: 0, high: 0, dropOn: false, auto: 0 };
      this.x = 0; this.v = 0; this.rung = 0; this.lastStep = -9;
      this.size = 1; this.sizeV = 0;
      this.yaw = 0.6; this.phase = 0;
      this.sparks = []; this.hatN = 0;
      this.inner = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
    },

    // Onsets as fast-minus-slow envelopes, so a sidechained bass line or a
    // swelling pad never reads as a beat.
    listen(sg, dt, T) {
      const e = this.env;
      const k = sg[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp01((e.kf - e.ks) * 2.2);
      let kick = 0;
      if (e.kArm && kOn > 0.2 && T - e.lastK > 0.22) { kick = kOn; e.kArm = false; e.lastK = T; }
      if (kOn < 0.1) e.kArm = true;
      const cl = (sg[3] + sg[4] + sg[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp01((e.cf - e.cs) * 3);
      let clap = 0;
      if (e.cArm && cOn > 0.25 && T - e.lastC > 0.3) { clap = cOn; e.cArm = false; e.lastC = T; }
      if (cOn < 0.1) e.cArm = true;
      const hh = (sg[7] + sg[8]) / 200;
      e.hf = ease(e.hf, hh, 45, dt);
      e.hs = ease(e.hs, hh, 4, dt);
      const hOn = clamp01((e.hf - e.hs) * 3);
      let hat = 0;
      if (e.hArm && hOn > 0.12 && T - e.lastH > 0.07) { hat = 0.4 + hOn; e.hArm = false; e.lastH = T; }
      if (hOn < 0.05) e.hArm = true;
      e.bass = ease(e.bass, (sg[0] + sg[1] + sg[2]) / 300, 3, dt);
      e.high = ease(e.high, (sg[6] + sg[7] + sg[8]) / 300, 0.5, dt);
      // Drive: how far up the ladder the music wants the solid. Kicks build it
      // and it drains in a few seconds without them; the hats and riser of a
      // build add a little on their own.
      e.drive = Math.min(1.2, e.drive * Math.exp(-dt / 2.0) + (kick ? 0.1 + 0.2 * kick : 0));
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, sg[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap, hat };
    },

    draw(p, signals, params, ctx) {
      const T = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(T - this.lastT, 0, 0.1);
      this.lastT = T;
      const e = this.env;
      const ev = this.listen(signals, dt, T);
      const react = params.react;

      // Follow the track: the drop pulls the driven params toward the drop look.
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.5 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * e.auto;

      // ---- the ladder: pick a rung, step toward it on the kicks ---------------
      const lvl = clamp01(e.drive * 0.85 + e.high * 0.5);
      const want = Math.round(clamp(P.ceiling, 0, TOP) * lvl);
      const zeta = 0.62 - 0.5 * clamp01(params.spring);
      const w0 = TAU * 1.05;
      if (ev.kick) {
        if (want > this.rung) { this.rung++; this.lastStep = T; }
        else {
          // Nowhere to climb: the kick plucks the spring instead, alternately
          // toward the next form and the last, and the nested shells with it.
          this.pluck = (this.pluck || 0) + 1;
          const dir = this.pluck % 2 ? 1 : -1;
          this.v += 2.4 * dir * ev.kick * react;
          for (const s of this.inner) s.v -= 1.6 * dir * ev.kick * react;
        }
      } else if (want > this.rung && T - this.lastStep > 1.4 && T - e.lastK > 1.4) {
        this.rung++; this.lastStep = T;             // music with no kick still climbs
      } else if (want < this.rung && T - this.lastStep > 0.62) {
        this.rung--; this.lastStep = T;             // relax, rung by rung
      }
      const stepSpring = (s, target, dt2) => {
        // Semi-implicit Euler in small substeps: stable for any frame time.
        const n = Math.ceil(dt2 / 0.005);
        const h = dt2 / n;
        for (let i = 0; i < n; i++) {
          s.v += (w0 * w0 * (target - s.x) - 2 * zeta * w0 * s.v) * h;
          s.x += s.v * h;
        }
      };
      const main = { x: this.x, v: this.v };
      // The pad breathes the form a little way toward the next rung: in a quiet
      // intro the tetrahedron's faces rise into shallow pyramids and sink back.
      e.pad = ease(e.pad || 0, (signals[2] + signals[3] + signals[4]) / 300, 1.5, dt);
      stepSpring(main, this.rung + 0.3 * e.pad * Math.min(1.5, react) * (1 - 0.6 * e.auto), dt);
      this.x = main.x; this.v = main.v;
      for (let i = 0; i < 2; i++) stepSpring(this.inner[i], Math.max(0, this.rung - 3 * (i + 1)), dt);

      // Clap: the size boings on its own stiffer spring.
      if (ev.clap) this.sizeV += 0.55 * ev.clap * react;
      {
        const n = Math.ceil(dt / 0.005), h = dt / n, ws = TAU * 2.2;
        for (let i = 0; i < n; i++) {
          this.sizeV += (ws * ws * (1 - this.size) - 2 * 0.22 * ws * this.sizeV) * h;
          this.size += this.sizeV * h;
        }
      }

      // Turning: slow, bass makes it faster, never jerks.
      const spin = P.spin * (0.55 + 1.1 * e.bass * react);
      this.yaw += dt * 0.32 * spin;
      this.phase += dt * 0.11 * (0.4 + spin);

      if (ev.hat) {
        this.hatN++;
        const n = 1 + Math.floor(hash(this.hatN * 3.7) * (1 + 2 * Math.min(1, react)));
        for (let i = 0; i < n; i++) this.sparks.push({ t0: T, r: hash(this.hatN * 9.1 + i * 2.3), a: ev.hat });
        if (this.sparks.length > 16) this.sparks.splice(0, this.sparks.length - 16);
      }

      // ---- draw ------------------------------------------------------------------
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const g = p.drawingContext;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.restore();
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';

      const cx = W / 2, cy = H / 2;
      const D = 3.4;                                  // camera distance in circumradii
      const R = S * 0.37 * this.size;
      const pitch = 0.38 + 0.22 * Math.sin(this.phase * 1.3);
      const roll = 0.12 * Math.sin(this.phase * 0.7 + 1);
      const rot = rotation(this.yaw, pitch, roll);
      const hidden = clamp01(params.hidden);
      const lw = 1.7 * P.weight;

      const nest = clamp(P.nest, 0, 2);
      const drawList = [];
      const shells = [{ x: this.x, scale: 1, rot, dim: 1 }];
      for (let i = 0; i < 2; i++) {
        const a = clamp01(nest - i);
        if (a <= 0.002) continue;
        const sc = i === 0 ? 0.5 : 0.25;
        shells.push({ x: this.inner[i].x, scale: sc * (0.85 + 0.15 * a), rot: rotation(-this.yaw * (1.4 + i * 0.5) + i, pitch * 0.6 + 0.5 * i, -roll), dim: a * (i === 0 ? 0.8 : 0.65) });
      }
      let mainScreen = null;
      for (let si = 0; si < shells.length; si++) {
        const sh = shells[si];
        const solid = solidAt(sh.x);
        const scr = project(solid.V, sh.rot, sh.scale, D, R, cx, cy);
        if (si === 0) mainScreen = scr;
        for (const [a, b, alpha] of solid.E) {
          if (alpha <= 0.004) continue;
          const A = scr[a], B = scr[b];
          // Facing: the edge midpoint's outward direction against the eye.
          const mx = (A.wx + B.wx) / 2, my = (A.wy + B.wy) / 2, mz = (A.wz + B.wz) / 2;
          const ml = Math.hypot(mx, my, mz) || 1;
          const vx = -mx, vy = -my, vz = D - mz;
          const vl = Math.hypot(vx, vy, vz);
          const facing = (mx * vx + my * vy + mz * vz) / (ml * vl);
          const vis = 1 - hidden * (1 - smooth(-0.22, 0.18, facing));
          const depth = clamp01((mz / sh.scale + 1) / 2);   // 0 back .. 1 front
          const lum = alpha * sh.dim * vis * (0.62 + 0.38 * depth);
          if (lum < 0.01) continue;
          const width = lw * (0.55 + 0.45 * vis) * (0.8 + 0.35 * depth) * (0.75 + 0.25 * sh.scale) * (0.5 + 0.5 * Math.min(1, alpha * 1.5));
          drawList.push(lum, width, A.x, A.y, B.x, B.y);
        }
      }
      // Dim first, bright last, so a front edge always crosses over a back one.
      const order = [];
      for (let i = 0; i < drawList.length; i += 6) order.push(i);
      order.sort((i, j) => drawList[i] - drawList[j]);
      for (const i of order) {
        const L = Math.round(255 * Math.min(1, drawList[i]));
        g.strokeStyle = 'rgb(' + L + ',' + L + ',' + L + ')';
        g.lineWidth = drawList[i + 1];
        g.beginPath();
        g.moveTo(drawList[i + 2], drawList[i + 3]);
        g.lineTo(drawList[i + 4], drawList[i + 5]);
        g.stroke();
      }

      // Hats: single front vertices light as small crisp points.
      if (mainScreen && mainScreen.length) {
        const front = [];
        for (let i = 0; i < mainScreen.length; i++) if (mainScreen[i].wz > 0.05) front.push(i);
        if (front.length) {
          g.fillStyle = '#fff';
          for (const s of this.sparks) {
            const age = T - s.t0;
            if (age > 0.35) continue;
            const q = mainScreen[front[Math.floor(s.r * front.length) % front.length]];
            const f = Math.exp(-age / 0.1) * Math.min(1.2, s.a) * Math.min(1.5, react);
            const r = lw * (1.1 + 2.2 * f);
            g.globalAlpha = clamp01(f * 1.1);
            g.beginPath(); g.arc(q.x, q.y, r, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        }
      }

      if (Math.round(params.caption) === 1) {
        const nearest = clamp(Math.round(this.x), 0, TOP);
        const a = smooth(0.35, 0.08, Math.abs(this.x - nearest));
        if (a > 0.01) {
          g.globalAlpha = a * 0.7;
          g.fillStyle = '#fff';
          g.font = Math.round(S * 0.022) + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'alphabetic';
          g.fillText(STATIONS[nearest].name.toLowerCase(), cx, H - S * 0.05);
          g.globalAlpha = 1;
        }
      }
      g.restore();
    },
  });

  function rotation(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // Rz(roll) . Rx(pitch) . Ry(yaw)
    const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    const rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
    const m = (a, b) => {
      const o = new Array(9);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      return o;
    };
    return m(rz, m(rx, ry));
  }

  function project(V, m, scale, D, R, cx, cy) {
    const out = new Array(V.length);
    const f = R * D;
    for (let i = 0; i < V.length; i++) {
      const v = V[i];
      const x = (m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) * scale;
      const y = (m[3] * v[0] + m[4] * v[1] + m[5] * v[2]) * scale;
      const z = (m[6] * v[0] + m[7] * v[1] + m[8] * v[2]) * scale;
      const k = f / (D - z);
      out[i] = { x: cx + x * k, y: cy - y * k, wx: x, wy: y, wz: z };
    }
    return out;
  }
})();
