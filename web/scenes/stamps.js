// Stamps: rubber-stamp cubes rolling across an endless sheet of paper, seen in
// true isometric, each landing face printing its square of ink.
//
// The roll is real rigid-body geometry, not a sprite. Every cube carries an
// integer rotation matrix from its body frame to the world, so we always know
// which of its six faces is down. A roll is a rotation about the leading
// bottom edge (Rodrigues about that edge's line), and it is split in two so the
// music can own the moment of impact: the cube tips up onto its edge and waits
// there, balanced just short of the tipping point, and the kick lets it fall.
// It falls with gravity's ease-in, prints, and rocks back once off its new
// edge before it settles. The snare spins a cube a quarter turn in place about
// its vertical axis (and its heading with it).
//
// The ink lives in one persistent texture of the floor in world space, a torus
// 28 cells square, so trails accumulate for the cost of one blit a print, and
// the floor is drawn each frame as one pattern fill through the isometric
// affine. A print is built in a small scratch canvas: the landing face's motif,
// mapped through the cube's orientation (so a stamp prints mirrored and turned
// the way the face really met the paper), a darker rim where rubber squeezes
// ink to the edge, paper tooth knocked out of it, and an uneven pressure
// gradient; then it is multiplied onto the floor with each ink slightly
// misregistered, as a risograph drum would, so where trails cross the inks
// overprint and mix instead of covering. The floor never saturates: cells are
// re-papered a few percent at a time in random order, so every print fades
// with a half-life of the "Floor memory" setting and nothing sweeps visibly.
//
// Music:
//   kick   the cube that is poised on its edge falls and prints (the cubes take
//          turns round the herd, so the stamps walk round the floor)
//   snare  a resting cube spins a quarter turn in place, and rolls that way
//   bass   how firmly the ink prints: faint and broken in the breakdown, dense
//          and dark in the drop
//   hats   a few ink flecks spatter off a cube's face onto the paper
//   drop   every cube turns to one heading and they roll together on every
//          beat, turning left each bar, so the herd prints interlocking square
//          rings that overprint one another; the breakdown lets the poised
//          cubes topple one by one, slowly, and exhales
// Movement: the camera follows the herd as it wanders across the paper, and a
// low sun circles very slowly so the long shadows swing.

(function () {
  'use strict';

  const TAU = Math.PI * 2, HALF = Math.PI / 2;
  const N = 28;                  // the floor is an N x N torus of cells
  const PX = 64;                 // texture pixels per cell
  const TEX = N * PX;
  const OFF = 18;                // scratch margin round a print, for jitter and squeeze
  const TMP = PX + 2 * OFF;
  const C30 = Math.cos(Math.PI / 6);
  // Poised just short of the balance point (45 degrees), so a waiting cube
  // looks as though a breath would tip it.
  const HANG = 0.7;

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const mod = (a, n) => ((a % n) + n) % n;
  const rgba = (c, a = 1) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a.toFixed(3) + ')';
  const rnd = () => Math.random();

  const PALETTES = [
    { name: 'Riso: pink, blue, yellow',
      paper: [243, 237, 224], body: [249, 246, 238], key: [58, 48, 78], shade: [64, 56, 112], shadow: [120, 112, 170],
      inks: [[255, 72, 176], [0, 120, 191], [255, 222, 0]] },
    { name: 'Indigo & vermilion',
      paper: [238, 233, 220], body: [244, 240, 230], key: [26, 30, 56], shade: [28, 36, 78], shadow: [110, 122, 160],
      inks: [[40, 56, 118], [230, 70, 42], [206, 164, 64]] },
    { name: 'Seal & sumi',
      paper: [241, 235, 221], body: [222, 199, 160], key: [44, 34, 28], shade: [70, 46, 34], shadow: [150, 132, 112],
      inks: [[204, 40, 36], [40, 36, 34], [146, 138, 128]] },
    { name: 'Green & fluoro orange',
      paper: [240, 238, 230], body: [248, 247, 242], key: [30, 46, 44], shade: [24, 60, 64], shadow: [110, 140, 140],
      inks: [[0, 150, 96], [255, 102, 64], [60, 70, 150]] },
  ];
  // Riso misregistration: each drum sits a little off the others, always the
  // same way, so overprints show the characteristic offset fringe.
  const REG = [[0, 0], [1.8, -1.1], [-1.3, 1.5]];

  // Body faces, each with outward normal n and in-face axes u, v (u x v = n),
  // corner c0 at (u, v) = (0, 0), in a body frame centred on the cube.
  const FACES = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
    { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  ].map((f) => ({ ...f, c0: [0, 1, 2].map((k) => 0.5 * f.n[k] - 0.5 * f.u[k] - 0.5 * f.v[k]) }));
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // ---- small linear algebra (3x3 row-major) --------------------------------
  function rod(a, th) {
    const c = Math.cos(th), s = Math.sin(th), k = 1 - c, [x, y, z] = a;
    return [c + x * x * k, x * y * k - z * s, x * z * k + y * s,
      y * x * k + z * s, c + y * y * k, y * z * k - x * s,
      z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  }
  function mm(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  // A roll's axis and pivot for direction d from a cube resting in cell (i, j).
  function rollFrame(i, j, d) {
    const D = DIRS[d];
    return { axis: [-D[1], D[0], 0], pivot: [i + 0.5 + D[0] * 0.5, j + 0.5 + D[1] * 0.5, 0] };
  }

  // ---- stamp motifs, drawn as paths in the unit square ---------------------
  const M = 0.085, W = 1 - 2 * M;
  function motifPath(g, set, id) {
    g.beginPath();
    const rect = (x, y, w, h) => g.rect(x, y, w, h);
    const disc = (x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
    if (set === 2) { rect(M, M, W, W); return 'nonzero'; }
    if (set === 0) {
      switch (id) {
        case 0: rect(M, M, W, W); return 'nonzero';
        case 1: rect(M, M, W, W); rect(M + 0.2, M + 0.2, W - 0.4, W - 0.4); return 'evenodd';
        case 2: rect(M, M, W, W); rect(M + 0.12, M + 0.12, W - 0.24, W - 0.24); rect(0.36, 0.36, 0.28, 0.28); return 'evenodd';
        case 3: rect(M, M, W / 2 - 0.01, W / 2 - 0.01); rect(0.5 + 0.01, 0.5 + 0.01, W / 2 - 0.01, W / 2 - 0.01); return 'nonzero';
        case 4: rect(M, M, W, W * 0.46); rect(M, M + W * 0.62, W * 0.46, W * 0.38); return 'nonzero';
        default: for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) rect(M + a * 0.31, M + b * 0.31, 0.2, 0.2); return 'nonzero';
      }
    }
    switch (id) {
      case 0: disc(0.5, 0.5, W / 2); return 'nonzero';
      case 1: g.moveTo(M, M); g.lineTo(1 - M, M); g.lineTo(M, 1 - M); g.closePath(); return 'nonzero';
      case 2: g.moveTo(M, M); g.arc(M, M, W, 0, HALF); g.closePath(); return 'nonzero';
      case 3: for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) disc(M + 0.14 + a * 0.27, M + 0.14 + b * 0.27, 0.11); return 'nonzero';
      case 4: for (let a = 0; a < 3; a++) rect(M, M + a * 0.3, W, 0.19); return 'nonzero';
      default: rect(M, 0.5 - 0.13, W, 0.26); rect(0.5 - 0.13, M, 0.26, W); return 'nonzero';
    }
  }

  // ---- textures ------------------------------------------------------------
  // Periodic value noise on a g x g lattice, for mottling that tiles.
  function lattice(gsz) { const a = new Float32Array(gsz * gsz); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; }
  function vnoise(L, gsz, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const i0 = mod(xi, gsz), j0 = mod(yi, gsz), i1 = (i0 + 1) % gsz, j1 = (j0 + 1) % gsz;
    const a = L[j0 * gsz + i0], b = L[j0 * gsz + i1], c = L[j1 * gsz + i0], d = L[j1 * gsz + i1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Paper tooth: where the rubber did not quite meet the paper. Fine specks
  // everywhere, and coarse blotches that open into bigger bald patches.
  function makeTooth() {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const id = g.createImageData(S, S), d = id.data;
    const L1 = lattice(8), L2 = lattice(32);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const coarse = vnoise(L1, 8, x / 32, y / 32), mid = vnoise(L2, 32, x / 8, y / 8), f = rnd();
      let a = 0;
      const v = coarse * 0.55 + mid * 0.3 + f * 0.35;
      if (v > 0.78) a = 1; else if (v > 0.62) a = (v - 0.62) / 0.16 * 0.55;
      const o = (y * S + x) * 4; d[o] = d[o + 1] = d[o + 2] = 0; d[o + 3] = Math.round(a * 255);
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  // The clean sheet: paper colour, a little mottling and fibre, and a faint
  // dot at every cell corner so the lattice reads before anything is printed.
  function makePaper(P) {
    const c = makeCanvas(TEX, TEX), g = c.getContext('2d');
    g.fillStyle = rgba(P.paper); g.fillRect(0, 0, TEX, TEX);
    // Grain from one small tile (a per-pixel pass over the whole sheet cost a
    // visible hitch on a palette change), mottling from soft blotches drawn
    // wrapped so the torus has no seam.
    const T = 256, tile = makeCanvas(T, T), tg = tile.getContext('2d');
    const id = tg.createImageData(T, T), d = id.data;
    for (let k = 0; k < T * T; k++) {
      const v = rnd(), o = k * 4;
      const light = v > 0.5;
      d[o] = d[o + 1] = d[o + 2] = light ? 255 : 40;
      d[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * 14);
    }
    tg.putImageData(id, 0, 0);
    g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, TEX, TEX);
    for (let k = 0; k < 60; k++) {
      const x = rnd() * TEX, y = rnd() * TEX, r = PX * (1.5 + rnd() * 5);
      const col = rnd() < 0.5 ? '255,255,250' : '120,100,80';
      for (const dx of [-TEX, 0, TEX]) for (const dy of [-TEX, 0, TEX]) {
        if (x + dx + r < 0 || x + dx - r > TEX || y + dy + r < 0 || y + dy - r > TEX) continue;
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, 'rgba(' + col + ',0.05)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
    g.lineCap = 'round';
    for (let k = 0; k < 900; k++) {
      const x = rnd() * TEX, y = rnd() * TEX, a = rnd() * TAU, l = 3 + rnd() * 9;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : rgba(P.key, 0.05);
      g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.fillStyle = rgba(P.key, 0.2);
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { g.beginPath(); g.arc(i * PX, j * PX, 1.5, 0, TAU); g.fill(); }
    return c;
  }

  // ---- the scene -----------------------------------------------------------
  VIZ.register({
    id: 'stamps',
    name: 'Stamps',
    order: 604,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'faces', label: 'Stamp faces', type: 'select', options: ['Squares', 'Shapes', 'Plain squares'], default: 0 },
      { key: 'cubes', label: 'Cubes', type: 'range', min: 1, max: 12, default: 7, step: 1 },
      { key: 'press', label: 'Ink pressure', type: 'range', min: 0.3, max: 1.6, default: 1, step: 0.01 },
      { key: 'memory', label: 'Floor memory (s)', type: 'range', min: 8, max: 180, default: 20, step: 1 },
      { key: 'sun', label: 'Sun height', type: 'range', min: 12, max: 75, default: 31, step: 1 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 0.55, max: 1.6, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'wipe', label: 'Fresh sheet of paper', run() { this.wipeRequest = true; } },
      { id: 'scatter', label: 'Re-ink the cubes', run() { this.reinkRequest = true; } },
    ],

    gallery: {
      title: 'Stamps',
      technique: 'Canvas 2D in true isometric. Rigid cubes with integer body-to-world rotation matrices roll by Rodrigues rotation about the leading bottom edge; a persistent 1792 px torus texture of the floor in world space takes each print (scratch canvas: motif mapped through the landing orientation, rim, paper-tooth knockout, pressure gradient) by multiply with per-ink misregistration, and is drawn each frame as one pattern fill through the isometric affine. Random-order per-cell re-papering fades the record. Long shadows are cube vertices cast along a low sun, filled at quarter resolution for a soft penumbra and multiplied onto the paper.',
      brief: 'A dream of rubber-stamp dice on an endless sheet of paper. Pale cubes whose six faces are inked stamps (squares, frames, checkers, a grid) roll across the page one edge at a time, tipping up onto an edge where they hang, balanced, until the kick lets them fall; the face that lands prints its square in pink, blue or yellow riso ink, textured and a little off register, and where the herd crosses its own trails the inks overprint into violets, greens and reds. The cubes take turns round the herd so the stamps walk round the floor; the snare spins a cube a quarter turn in place; the bass sets how firmly the ink bites; hats flick flecks of ink off the faces. On the drop every cube turns to one heading and they roll together on every beat, turning each bar, printing interlocking square rings; in the breakdown the poised cubes topple one by one, slowly, faintly. A low sun circles so the long shadows swing, and the camera follows the herd across the paper while old paths fade.',
      lineage: 'Raph\'s sketch (2026-09-28), seen in a dream: "as an isometric view, a cube that\'s rolling, leaving squares of ink behind it. maybe a bunch of cubes at the same time that are doing this and stepping over each others\' trails." Descends from rubber stamps and hanko seals, risograph overprinting, de Chirico\'s long afternoon shadows, and the rolling-die puzzles of isometric games. Process: v1 built the roll (Rodrigues about the leading edge, split into raise, poise, fall, rock-back so the kick owns the impact), the world-space ink torus with random-order cell fading, and the herd scheduler (turns round the centroid; lockstep with left turns each bar on the drop). First look: the quiet sections barely moved (the kick detector missed the build\'s fading-in kicks and one slow cube at a time was too still), so the kick threshold came down, the minimum kick gap went up to 0.3 s so a clap\'s bleed into the bass band is not a second kick, and free time poises two cubes at once, staggered. The first jolt read was calm by area (0.19) but ratio 3.6, the drop being seven cubes slamming with their long shadows; the drop poise was raised (less to fall), the settle shortened and the lift made a quick shove that decelerates into the poise, so the between-beat motion carries more of the energy: kickArea 0.16, ratio 2, calm. At 720p the quarter-resolution shadows stair-stepped (now blurred at low res, resolution scaled to the canvas), airborne flecks showed on top of cubes (now depth-sorted with them), and the two shaded sides read alike (a skylight from the upper left now parts them). A 96-second run showed the floor becoming a pastel carpet because the herd lingered, so the wander bias was tripled and the default memory shortened from 55 s to 20 s. Added a wet sheen that starts drying only when the stamp lifts off its print, and a warm soft-light pool on the sun\'s side.',
    },

    setup() { this.init(); },
    enter() { if (!this.cubes) this.init(); },

    init() {
      this.tooth = makeTooth();
      this.tmp = makeCanvas(TMP, TMP); this.tctx = this.tmp.getContext('2d');
      this.palIdx = 0; this.P = PALETTES[0];
      this.paper = makePaper(this.P);
      this.ink = makeCanvas(TEX, TEX); this.ictx = this.ink.getContext('2d');
      this.ictx.drawImage(this.paper, 0, 0);
      this.fadeOrder = new Uint16Array(N * N);
      for (let i = 0; i < N * N; i++) this.fadeOrder[i] = i;
      for (let i = N * N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = this.fadeOrder[i]; this.fadeOrder[i] = this.fadeOrder[j]; this.fadeOrder[j] = x; }
      this.fadePtr = 0; this.fadeAcc = 0;
      this.prev = new Float32Array(9);
      this.lastT = null;
      this.lastKick = -10; this.kickAmp = 0.8; this.lastSnare = -10; this.lastHat = -10; this.clapCount = 0;
      this.bassEnv = 0; this.low = 0; this.dropOn = false;
      this.faceSet = 0;
      this.cubes = [];
      this.drops = [];
      this.wet = [];
      this.cam = null;
      this.wind = rnd() * TAU;
      this.lastActive = null;
      this.setCount(7);
      this.seedHistory();
    },

    newCube(i, j) {
      const perm = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5);
      const inks = [0, 0, 1, 1, 2, 2].sort(() => rnd() - 0.5);
      let R = I3;
      for (let k = 0; k < 4; k++) R = mm(rod(k % 2 ? [1, 0, 0] : [0, 1, 0], HALF * Math.floor(rnd() * 4)), R).map(Math.round);
      return { i, j, R, motifs: perm, inks, st: 'rest', t0: 0, dur: 1, dir: 0, th: 0, th0: 0, phi: 0,
        heading: Math.floor(rnd() * 4), pend: 0, forced: false, lastSpin: -9, hold: 0.5, bounce: 0, phase: rnd() * TAU, restAt: 0 };
    },

    setCount(n) {
      while (this.cubes.length > n) this.cubes.pop();
      let tries = 0;
      const c0 = this.cam ? [Math.round(this.cam[0]), Math.round(this.cam[1])] : [0, 0];
      while (this.cubes.length < n && tries++ < 500) {
        const r = 2 + Math.sqrt(n) * 1.6;
        const i = c0[0] + Math.round((rnd() - 0.5) * 2 * r), j = c0[1] + Math.round((rnd() - 0.5) * 2 * r);
        if (this.cubes.some((c) => Math.max(Math.abs(c.i - i), Math.abs(c.j - j)) < 2)) continue;
        this.cubes.push(this.newCube(i, j));
      }
    },

    // A faint palimpsest of earlier walks, so the sheet starts as a used one.
    seedHistory() {
      const ghost = this.newCube(0, 0);
      for (let w = 0; w < 9; w++) {
        let i = Math.round((rnd() - 0.5) * 16), j = Math.round((rnd() - 0.5) * 16), R = ghost.R, h = Math.floor(rnd() * 4);
        ghost.inks = ghost.inks.sort(() => rnd() - 0.5);
        for (let s = 0; s < 18; s++) {
          if (rnd() < 0.3) h = (h + (rnd() < 0.5 ? 1 : 3)) % 4;
          const { axis } = rollFrame(i, j, h);
          R = mm(rod(axis, HALF), R).map(Math.round);
          i += DIRS[h][0]; j += DIRS[h][1];
          this.print(ghost, R, [i + 0.5, j + 0.5, 0.5], 0.12 + 0.2 * rnd(), 0.25 + 0.3 * (s / 18));
        }
      }
    },

    bottomFace(R) {
      for (let f = 0; f < 6; f++) if (mv(R, FACES[f].n)[2] < -0.5) return f;
      return 1;
    },

    blit(img, x, y, size) {
      const g = this.ictx;
      for (const dx of [-TEX, 0, TEX]) for (const dy of [-TEX, 0, TEX]) {
        const X = x + dx, Y = y + dy;
        if (X + size > 0 && X < TEX && Y + size > 0 && Y < TEX) g.drawImage(img, X, Y);
      }
    },

    // Press the landing face of cube c (orientation R, centre cn) into the floor.
    print(c, R, cn, pressure, strength = 1) {
      const P = this.P;
      const f = this.bottomFace(R), F = FACES[f];
      const inkI = c.inks[f], ink = P.inks[inkI];
      const i = Math.floor(cn[0]), j = Math.floor(cn[1]);
      const A = [0, 1, 2].map((k) => cn[k] + mv(R, F.c0)[k]), U = mv(R, F.u), V = mv(R, F.v);
      const t = this.tctx;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1;
      t.clearRect(0, 0, TMP, TMP);
      t.translate(TMP / 2 + (rnd() - 0.5) * 1.6, TMP / 2 + (rnd() - 0.5) * 1.6);
      t.rotate((rnd() - 0.5) * 0.035);
      // A hard press squeezes the stamp a touch wider.
      const sq = 1 + 0.035 * clamp(pressure - 0.5, 0, 1);
      t.scale(sq, sq);
      t.translate(-TMP / 2, -TMP / 2);
      t.transform(U[0] * PX, U[1] * PX, V[0] * PX, V[1] * PX, OFF + (A[0] - i) * PX, OFF + (A[1] - j) * PX);
      const rule = motifPath(t, this.faceSet, c.motifs[f]);
      t.fillStyle = rgba(ink, 0.8);
      t.fill(rule);
      t.lineWidth = 0.028; t.lineJoin = 'round';
      t.strokeStyle = rgba(ink, 1);
      t.stroke();
      t.setTransform(1, 0, 0, 1, 0, 0);
      // Paper tooth: the lighter the press, the more paper shows through.
      t.globalCompositeOperation = 'destination-out';
      t.globalAlpha = clamp(1.05 - 0.6 * pressure, 0.3, 0.95);
      t.drawImage(this.tooth, -rnd() * (256 - TMP), -rnd() * (256 - TMP));
      // Uneven pressure: one side of the stamp always bites harder.
      t.globalCompositeOperation = 'destination-in'; t.globalAlpha = 1;
      const a = rnd() * TAU, ca = Math.cos(a) * TMP * 0.45, sa = Math.sin(a) * TMP * 0.45;
      const gr = t.createLinearGradient(TMP / 2 - ca, TMP / 2 - sa, TMP / 2 + ca, TMP / 2 + sa);
      gr.addColorStop(0, 'rgba(0,0,0,' + clamp(0.3 + 0.55 * pressure, 0.25, 1).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,1)');
      t.fillStyle = gr; t.fillRect(0, 0, TMP, TMP);
      t.globalCompositeOperation = 'source-over';
      const g = this.ictx;
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = clamp((0.42 + 0.5 * pressure) * strength, 0.08, 0.96);
      this.blit(this.tmp, mod(i, N) * PX - OFF + REG[inkI][0], mod(j, N) * PX - OFF + REG[inkI][1], TMP);
      g.restore();
    },

    fleck(x, y, inkI, r) {
      const g = this.ictx, ink = this.P.inks[inkI];
      const X = mod(x, N) * PX + REG[inkI][0], Y = mod(y, N) * PX + REG[inkI][1];
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = rgba(ink, 0.85);
      g.beginPath(); g.ellipse(X, Y, r, r * (0.7 + rnd() * 0.3), rnd() * TAU, 0, TAU); g.fill();
      if (rnd() < 0.5) { g.beginPath(); g.arc(X + (rnd() - 0.5) * r * 4, Y + (rnd() - 0.5) * r * 4, r * 0.35, 0, TAU); g.fill(); }
      g.restore();
    },

    // ---- herd bookkeeping ----------------------------------------------------
    moving(c) { return c.st === 'raise' || c.st === 'hang' || c.st === 'fall' || c.st === 'settle' || c.st === 'ret'; },
    target(c) { const D = DIRS[c.dir]; return [c.i + D[0], c.j + D[1]]; },
    physCell(c) { return c.st === 'settle' ? this.target(c) : [c.i, c.j]; },
    blocked(me, ti, tj) {
      for (const c of this.cubes) {
        if (c === me) continue;
        const p = this.physCell(c);
        if (p[0] === ti && p[1] === tj) return true;
        if (this.moving(c) && c.st !== 'ret') { const q = this.target(c); if (q[0] === ti && q[1] === tj) return true; }
      }
      return false;
    },
    centroid() {
      let x = 0, y = 0;
      for (const c of this.cubes) { x += c.i + 0.5; y += c.j + 0.5; }
      const n = Math.max(1, this.cubes.length);
      return [x / n, y / n];
    },
    chooseDir(c) {
      const cen = this.centroid(), R = 2.2 + Math.sqrt(this.cubes.length) * 1.1;
      const dx = cen[0] - (c.i + 0.5), dy = cen[1] - (c.j + 0.5), dist = Math.hypot(dx, dy) || 1;
      const wx = Math.cos(this.wind), wy = Math.sin(this.wind);
      let best = -1, bs = -1e9;
      for (let k = 0; k < 4; k++) {
        const D = DIRS[k];
        if (this.blocked(c, c.i + D[0], c.j + D[1])) continue;
        let s = rnd() * 0.9;
        if (k === c.heading) s += c.forced ? 6 : 0.8; else if ((k + 2) % 4 === c.heading) s -= 1.3;
        if (dist > R) s += (D[0] * dx + D[1] * dy) / dist * (dist - R) * 0.9;
        s += 1.4 * (D[0] * wx + D[1] * wy);
        // Keep a little air between cubes, so the herd reads as separate
        // dice rather than a heap.
        for (const o of this.cubes) if (o !== c && Math.max(Math.abs(o.i - c.i - D[0]), Math.abs(o.j - c.j - D[1])) <= 1) s -= 0.8;
        if (s > bs) { bs = s; best = k; }
      }
      return best;
    },
    raise(c, d, dur, t, hang = HANG) {
      c.hang = hang; c.dir = d; c.st = 'raise'; c.t0 = t; c.dur = dur; c.th = 0; c.forced = false;
    },
    fall(c, dur, t) {
      c.th0 = c.th; c.st = 'fall'; c.t0 = t;
      c.dur = dur * Math.sqrt(clamp((HALF - c.th) / (HALF - HANG), 0.3, 2.2));
    },
    // Several cubes may be asked to fall at once: one whose target is held by
    // a cube that is staying put tips back instead.
    release(list, dur, t) {
      const go = new Set(list);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of go) {
          const q = this.target(c);
          for (const o of this.cubes) {
            if (o === c || go.has(o)) continue;
            const p = this.physCell(o);
            if (p[0] === q[0] && p[1] === q[1]) { go.delete(c); changed = true; break; }
          }
        }
      }
      for (const c of list) {
        if (go.has(c)) this.fall(c, dur, t);
        else { c.st = 'ret'; c.th0 = c.th; c.t0 = t; c.dur = 0.35; }
      }
    },
    startSpin(c, t, dur) { c.st = 'spin'; c.t0 = t; c.dur = Math.abs(c.pend) === 2 ? dur * 1.6 : dur; c.phi = 0; c.lastSpin = t; },

    // The next cube to go is the one after the last, going round the herd.
    nextCube(t) {
      const cen = this.centroid();
      const ang = (c) => Math.atan2(c.j + 0.5 - cen[1], c.i + 0.5 - cen[0]);
      const a0 = this.lastActive ? ang(this.lastActive) : 0;
      let best = null, bd = 1e9;
      for (const c of this.cubes) {
        if (c.st !== 'rest' || c.pend || c === this.lastActive || t < c.restAt) continue;
        const d = mod(ang(c) - a0 - 1e-3, TAU);
        if (d < bd) { bd = d; best = c; }
      }
      if (!best && this.lastActive && this.lastActive.st === 'rest' && !this.lastActive.pend && t >= this.lastActive.restAt) best = this.lastActive;
      return best;
    },

    analyse(s, t, dt, P) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      const ev = { kick: false, snare: false, hat: false };
      if (b0 > 30 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.3) { this.lastKick = t; this.kickAmp = clamp(b0 / 90, 0.55, 1.1); ev.kick = true; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.1) { this.lastSnare = t; ev.snare = true; }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) { this.lastHat = t; ev.hat = true; ev.hatAmp = clamp(bh / 85, 0.3, 1); }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.5, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.5));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.8);
      const kicking = t - this.lastKick < 0.9;
      const was = this.dropOn;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.25 || t - this.lastKick > 1.6)) this.dropOn = false;
      ev.dropStart = this.dropOn && !was;
      return ev;
    },

    step(ev, t, params) {
      const mode = this.dropOn ? 'drop' : t - this.lastKick < 1.3 ? 'kick' : 'free';
      this.mode = mode;
      const press = params.press;
      const pressure = () => clamp((0.28 + 0.85 * this.bassEnv) * press * (mode === 'free' ? 0.85 : 1), 0.1, 1.25);

      if (ev.dropStart) {
        // Every cube turns to one heading: the herd falls into step.
        const counts = [0, 0, 0, 0];
        for (const c of this.cubes) counts[c.heading]++;
        const H = counts.indexOf(Math.max(...counts));
        for (const c of this.cubes) {
          const d = mod(H - c.heading, 4);
          c.pend = d === 3 ? -1 : d;
          if (c.pend && c.st === 'rest') this.startSpin(c, t, 0.34);
        }
        this.clapCount = 0;
      }

      if (ev.kick) {
        const armed = this.cubes.filter((c) => c.st === 'raise' || c.st === 'hang');
        if (armed.length) this.release(armed, mode === 'drop' ? 0.1 : 0.13, t);
      }
      if (ev.snare) {
        if (mode === 'drop') {
          this.clapCount++;
          if (this.clapCount % 2 === 0) for (const c of this.cubes) if (!c.pend) { c.pend = 1; if (c.st === 'rest') this.startSpin(c, t, 0.3); }
        } else {
          const cand = this.cubes.filter((c) => c.st === 'rest' && !c.pend && t - c.lastSpin > 0.8);
          if (cand.length) { const c = cand[Math.floor(rnd() * cand.length)]; c.pend = rnd() < 0.5 ? 1 : -1; this.startSpin(c, t, 0.3); }
        }
      }
      if (ev.hat && this.cubes.length) {
        const c = this.cubes[Math.floor(rnd() * this.cubes.length)];
        const n = 1 + Math.floor(ev.hatAmp * 3);
        for (let q = 0; q < n; q++) this.spray(c, 0.9 + rnd() * 0.8, 2.2 + rnd() * 1.4, 0.7);
      }

      // Advance every cube.
      for (const c of this.cubes) {
        const u = (t - c.t0) / c.dur;
        if (c.st === 'raise') {
          // Quiet sections ease up onto the edge; on the beat the lift is a quick
          // shove that decelerates into the poise.
          const v = Math.min(u, 1);
          c.th = c.hang * (c.dur < 0.5 ? 1 - (1 - v) * (1 - v) * (1 - v) : smooth(v));
          if (u >= 1) { c.st = 'hang'; c.t0 = t; c.hold = 0.35 + rnd() * 0.9; }
        } else if (c.st === 'hang') {
          const w = t - c.t0;
          c.th = c.hang + 0.03 * Math.sin(w * 3.6 + c.phase) * Math.min(1, w * 2);
          if ((mode === 'free' && w > c.hold) || w > 2.2) this.release([c], 0.3, t);
        } else if (c.st === 'fall') {
          c.th = c.th0 + (HALF - c.th0) * Math.min(u, 1) * Math.min(u, 1);
          if (u >= 1) this.impact(c, t, mode, pressure());
        } else if (c.st === 'settle') {
          const v = Math.min(u, 1);
          c.th = HALF - c.bounce * Math.abs(Math.sin(v * Math.PI * 2)) * (1 - v) * (1 - v);
          if (u >= 1) {
            c.R = c.R1; c.i += DIRS[c.dir][0]; c.j += DIRS[c.dir][1]; c.heading = c.dir; c.th = 0;
            c.st = 'rest'; c.restAt = t + (mode === 'free' ? 0.4 : 0);
            if (c.pend) this.startSpin(c, t, mode === 'drop' ? 0.3 : 0.34);
          }
        } else if (c.st === 'ret') {
          c.th = c.th0 * (1 - smooth(u));
          if (u >= 1) { c.th = 0; c.st = 'rest'; c.restAt = t + 0.3; }
        } else if (c.st === 'spin') {
          const v = Math.min(u, 1);
          // Weighty: slow to start, a small overshoot, back onto the grid.
          const e = smooth(v) + 0.09 * Math.sin(Math.PI * v) * v;
          c.phi = c.pend * HALF * e;
          if (u >= 1) {
            c.R = mm(rod([0, 0, 1], c.pend * HALF), c.R).map(Math.round);
            c.heading = mod(c.heading + c.pend, 4); c.pend = 0; c.phi = 0; c.forced = true; c.st = 'rest';
          }
        }
      }

      // Arm the next move.
      if (mode === 'drop') {
        for (const c of this.cubes) {
          if (c.st !== 'rest' || c.pend) continue;
          const D = DIRS[c.heading];
          if (!this.blocked(c, c.i + D[0], c.j + D[1])) this.raise(c, c.heading, 0.26, t, 0.62);
        }
      } else {
        // Kick: one cube poised at a time, waiting for the beat. Free: two at
        // once, staggered, so the quiet sections still breathe.
        const raising = this.cubes.some((c) => c.st === 'raise');
        const armed = this.cubes.filter((c) => c.st === 'raise' || c.st === 'hang' || (mode === 'free' && c.st === 'fall')).length;
        if (!raising && armed < (mode === 'free' ? 2 : 1)) {
          const c = this.nextCube(t);
          if (c) {
            const d = this.chooseDir(c);
            if (d >= 0) { this.raise(c, d, mode === 'free' ? 0.8 : 0.3, t); this.lastActive = c; }
            else c.restAt = t + 0.5;
          }
        }
      }
    },

    impact(c, t, mode, pr) {
      const { axis, pivot } = rollFrame(c.i, c.j, c.dir);
      const Rr = rod(axis, HALF);
      c.R1 = mm(Rr, c.R).map(Math.round);
      const D = DIRS[c.dir];
      const cn = [c.i + 0.5 + D[0], c.j + 0.5 + D[1], 0.5];
      const hit = pr * (mode === 'free' ? 0.8 : this.kickAmp);
      this.print(c, c.R1, cn, hit);
      this.wet.push({ i: c.i + D[0], j: c.j + D[1], t });
      if (this.wet.length > 48) this.wet.shift();
      c.st = 'settle'; c.t0 = t; c.dur = mode === 'drop' ? 0.1 : mode === 'kick' ? 0.28 : 0.45;
      c.bounce = 0.05 + 0.07 * clamp(hit, 0, 1.2);
      // The slam squirts a few beads of ink out from under the face.
      const n = Math.floor(clamp(hit - 0.35, 0, 1) * 7);
      const f = this.bottomFace(c.R1);
      for (let k = 0; k < n; k++) {
        const a = rnd() * TAU, sp = 0.8 + rnd() * 1.4;
        this.drops.push({ x: cn[0] + Math.cos(a) * 0.5, y: cn[1] + Math.sin(a) * 0.5, z: 0.02, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.8 + rnd() * 1.2, ink: c.inks[f], r: 1 + rnd() * 1.6 });
      }
    },

    // Hat flecks: ink flicked off one of the cube's lower faces.
    spray(c, sp, vz, r) {
      const fs = [2, 3, 4, 5].map((k) => k);
      let f = fs[Math.floor(rnd() * 4)];
      const nW = mv(c.R, FACES[f].n);
      const a = Math.atan2(nW[1], nW[0]) + (rnd() - 0.5) * 1.2;
      this.drops.push({ x: c.i + 0.5 + Math.cos(a) * 0.5, y: c.j + 0.5 + Math.sin(a) * 0.5, z: 0.3 + rnd() * 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz, ink: c.inks[f], r: r * (0.8 + rnd() * 1.2) });
      if (this.drops.length > 120) this.drops.splice(0, this.drops.length - 120);
    },

    pose(c) {
      const c0 = [c.i + 0.5, c.j + 0.5, 0.5];
      if (c.st === 'spin') return { R: mm(rod([0, 0, 1], c.phi), c.R), c: c0 };
      if (c.th !== 0 && c.st !== 'rest') {
        const { axis, pivot } = rollFrame(c.i, c.j, c.dir);
        const Rr = rod(axis, c.th);
        const rel = mv(Rr, [c0[0] - pivot[0], c0[1] - pivot[1], c0[2] - pivot[2]]);
        return { R: mm(Rr, c.R), c: [pivot[0] + rel[0], pivot[1] + rel[1], pivot[2] + rel[2]] };
      }
      return { R: c.R, c: c0 };
    },

    draw(p, signals, params, ctx) {
      if (!this.cubes) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const g = p.drawingContext;
      const Wd = ctx.width, Hd = ctx.height;

      const pi = clamp(Math.round(params.palette), 0, PALETTES.length - 1);
      if (pi !== this.palIdx) {
        this.palIdx = pi; this.P = PALETTES[pi];
        this.paper = makePaper(this.P);
        this.ictx.save(); this.ictx.globalAlpha = 0.85; this.ictx.drawImage(this.paper, 0, 0); this.ictx.restore();
      }
      const P = this.P;
      this.faceSet = clamp(Math.round(params.faces), 0, 2);
      if (this.wipeRequest) { this.wipeRequest = false; this.ictx.save(); this.ictx.globalAlpha = 1; this.ictx.globalCompositeOperation = 'source-over'; this.ictx.drawImage(this.paper, 0, 0); this.ictx.restore(); }
      if (this.reinkRequest) {
        this.reinkRequest = false;
        for (const c of this.cubes) { c.inks.sort(() => rnd() - 0.5); c.motifs.sort(() => rnd() - 0.5); }
      }
      const want = clamp(Math.round(params.cubes), 1, 12);
      if (want !== this.cubes.length) this.setCount(want);

      const ev = this.analyse(signals, t, dt, P);
      this.step(ev, t, params);
      this.wind += dt * 0.021;

      // Floor memory: re-paper cells a few percent at a time, in a fixed random
      // order, so the fade has no sweep and no global step.
      const a = 0.07, period = params.memory * Math.log(1 - a) / Math.log(0.5);
      this.fadeAcc += dt * N * N / Math.max(0.5, period);
      {
        const ic = this.ictx;
        ic.save(); ic.globalCompositeOperation = 'source-over'; ic.globalAlpha = a;
        while (this.fadeAcc >= 1) {
          this.fadeAcc -= 1;
          const k = this.fadeOrder[this.fadePtr]; this.fadePtr = (this.fadePtr + 1) % (N * N);
          const x = (k % N) * PX, y = Math.floor(k / N) * PX;
          ic.drawImage(this.paper, x, y, PX, PX, x, y, PX, PX);
        }
        ic.restore();
      }

      // Ink droplets in flight; they print where they land.
      const grav = 16;
      for (let k = this.drops.length - 1; k >= 0; k--) {
        const d = this.drops[k];
        d.vz -= grav * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.z <= 0) { this.fleck(d.x, d.y, d.ink, d.r); this.drops.splice(k, 1); }
      }

      // Camera: follows the herd, slowly.
      const poses = this.cubes.map((c) => ({ cube: c, ...this.pose(c) }));
      let mx = 0, my = 0;
      for (const q of poses) { mx += q.c[0]; my += q.c[1]; }
      mx /= Math.max(1, poses.length); my /= Math.max(1, poses.length);
      if (!this.cam) this.cam = [mx, my];
      const kc = 1 - Math.exp(-dt / 3.2);
      this.cam[0] += (mx - this.cam[0]) * kc; this.cam[1] += (my - this.cam[1]) * kc;

      const S = 50 * params.zoom * Math.min(1.25, Math.max(Wd, Hd) / 1067 * 1.05 + 0.1);
      const ox = Wd / 2 - (this.cam[0] - this.cam[1]) * C30 * S;
      const oy = Hd * 0.5 - (this.cam[0] + this.cam[1]) * 0.5 * S;
      const proj = (x, y, z) => [(x - y) * C30 * S + ox, (x + y) * 0.5 * S - z * S + oy];

      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(P.paper); g.fillRect(0, 0, Wd, Hd);

      // ---- floor: the ink torus as one pattern fill through the iso affine
      {
        const A = (X, Y) => { const u = (X - ox) / (C30 * S), v = (Y - oy) / (0.5 * S); return [(u + v) / 2, (v - u) / 2]; };
        const cs = [A(0, 0), A(Wd, 0), A(0, Hd), A(Wd, Hd)];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const q of cs) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        const pat = g.createPattern(this.ink, 'repeat');
        g.save();
        g.transform(C30 * S / PX, 0.5 * S / PX, -C30 * S / PX, 0.5 * S / PX, ox, oy);
        g.imageSmoothingEnabled = true;
        g.fillStyle = pat;
        g.fillRect(x0 * PX - 4, y0 * PX - 4, (x1 - x0) * PX + 8, (y1 - y0) * PX + 8);
        g.restore();
      }

      // ---- sun and long shadows
      const el = params.sun * Math.PI / 180;
      const az = 0.35 + t * 0.018;
      const Ls = [-Math.cos(el) * Math.cos(az), -Math.cos(el) * Math.sin(az), Math.sin(el)];
      {
        const M0 = g.getTransform();
        const cw = p.width * p.pixelDensity(), chh = p.height * p.pixelDensity();
        const q = Math.max(2, Math.round(cw / 400)), sw = Math.ceil(cw / q), sh = Math.ceil(chh / q);
        if (!this.sh || this.sh.width !== sw || this.sh.height !== sh) { this.sh = makeCanvas(sw, sh); this.shx = this.sh.getContext('2d'); }
        const s = this.shx;
        s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, sw, sh);
        s.setTransform(M0.a / q, M0.b / q, M0.c / q, M0.d / q, M0.e / q, M0.f / q);
        s.fillStyle = rgba(P.shadow);
        s.beginPath();
        for (const qd of poses) {
          const pts = [];
          for (let a1 = -0.5; a1 <= 0.5; a1 += 1) for (let b1 = -0.5; b1 <= 0.5; b1 += 1) for (let c1 = -0.5; c1 <= 0.5; c1 += 1) {
            const w = mv(qd.R, [a1, b1, c1]);
            const X = qd.c[0] + w[0], Y = qd.c[1] + w[1], Z = qd.c[2] + w[2];
            const k = Z / Ls[2];
            pts.push(proj(X - Ls[0] * k, Y - Ls[1] * k, 0));
          }
          const h = hull(pts);
          s.moveTo(h[0][0], h[0][1]);
          for (let k = 1; k < h.length; k++) s.lineTo(h[k][0], h[k][1]);
          s.closePath();
        }
        // Filled at quarter resolution and softened there: a penumbra for
        // almost nothing, and no stair-steps when it is scaled back up.
        s.filter = 'blur(1.2px)';
        s.fill('nonzero');
        s.filter = 'none';
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = 0.5;
        g.imageSmoothingEnabled = true;
        g.drawImage(this.sh, 0, 0, sw * q, sh * q);
        g.restore();
      }

      // ---- wet ink: a fresh print keeps a sheen for a moment after the cube
      // lifts off it, then dries into the paper.
      for (let k = this.wet.length - 1; k >= 0; k--) {
        const w = this.wet[k];
        // The sheen starts drying only once the stamp has lifted off it.
        for (const c of this.cubes) { const pc = this.physCell(c); if (pc[0] === w.i && pc[1] === w.j && c.th < 1.0) { w.t = t; break; } }
        const age = t - w.t;
        if (age > 3.5) { this.wet.splice(k, 1); continue; }
        const al = 0.3 * Math.exp(-age / 1.1);
        const a0 = proj(w.i + 0.1, w.j + 0.1, 0), a1 = proj(w.i + 0.9, w.j + 0.1, 0), a2 = proj(w.i + 0.9, w.j + 0.9, 0), a3 = proj(w.i + 0.1, w.j + 0.9, 0);
        const gl = g.createLinearGradient(a1[0], a1[1], a3[0], a3[1]);
        gl.addColorStop(0, 'rgba(255,255,255,0)');
        gl.addColorStop(0.45, 'rgba(255,255,255,' + al.toFixed(3) + ')');
        gl.addColorStop(0.6, 'rgba(255,255,255,0)');
        g.fillStyle = gl;
        g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.lineTo(a3[0], a3[1]); g.closePath(); g.fill();
      }

      // ---- cubes and droplets in the air, far to near
      const items = poses.map((q) => ({ z: q.c[0] + q.c[1] + q.c[2], q }));
      for (const d of this.drops) items.push({ z: d.x + d.y + d.z, d });
      items.sort((u, v) => u.z - v.z);
      g.lineJoin = 'round';
      for (const it of items) {
        if (it.d) {
          const d = it.d, s0 = proj(d.x, d.y, d.z);
          g.fillStyle = rgba(P.inks[d.ink], 0.95);
          g.beginPath(); g.arc(s0[0], s0[1], d.r * S / 64 + 0.6, 0, TAU); g.fill();
          continue;
        }
        const qd = it.q, cb = qd.c;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          const nW = mv(qd.R, F.n);
          if (nW[0] + nW[1] + nW[2] <= 1e-4) continue;
          const c0 = mv(qd.R, F.c0), U = mv(qd.R, F.u), V = mv(qd.R, F.v);
          const Aw = [cb[0] + c0[0], cb[1] + c0[1], cb[2] + c0[2]];
          const pa = proj(Aw[0], Aw[1], Aw[2]);
          const pb = proj(Aw[0] + U[0], Aw[1] + U[1], Aw[2] + U[2]);
          const pd = proj(Aw[0] + V[0], Aw[1] + V[1], Aw[2] + V[2]);
          const pc = [pb[0] + pd[0] - pa[0], pb[1] + pd[1] - pa[1]];
          const lit = Math.max(0, nW[0] * Ls[0] + nW[1] * Ls[1] + nW[2] * Ls[2]);
          // Sun, plus a skylight from the upper left so the two shaded sides
          // still part: top light, left mid, right dark.
          const b = clamp(0.5 + 0.38 * lit + 0.12 * Math.max(0, nW[2]) + 0.16 * Math.max(0, nW[1]) - 0.04 * Math.max(0, nW[0]), 0, 1);
          g.save();
          g.transform(pb[0] - pa[0], pb[1] - pa[1], pd[0] - pa[0], pd[1] - pa[1], pa[0], pa[1]);
          g.fillStyle = rgba(P.body); g.fillRect(0, 0, 1, 1);
          const rule = motifPath(g, this.faceSet, qd.cube.motifs[f]);
          g.fillStyle = rgba(P.inks[qd.cube.inks[f]], 0.92); g.fill(rule);
          g.fillStyle = rgba(P.shade, (1 - b) * 0.8); g.fillRect(-0.01, -0.01, 1.02, 1.02);
          g.restore();
          g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.lineTo(pc[0], pc[1]); g.lineTo(pd[0], pd[1]); g.closePath();
          g.strokeStyle = rgba(P.key, 0.5); g.lineWidth = 0.9; g.stroke();
        }
      }

      // ---- late light: a warm pool on the sun's side of the sheet
      {
        const sx = (Ls[0] - Ls[1]) * C30, sy = (Ls[0] + Ls[1]) * 0.5, sm = Math.hypot(sx, sy) || 1;
        const cx = Wd / 2 + sx / sm * Wd * 0.45, cy = Hd / 2 + sy / sm * Hd * 0.6;
        const rl = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(Wd, Hd) * 0.9);
        rl.addColorStop(0, 'rgba(255,214,150,0.28)'); rl.addColorStop(1, 'rgba(255,214,150,0)');
        g.globalCompositeOperation = 'soft-light';
        g.fillStyle = rl; g.fillRect(0, 0, Wd, Hd);
        g.globalCompositeOperation = 'source-over';
      }

      // ---- haze: the far edge of the sheet dissolves into the afternoon
      {
        const hz = g.createLinearGradient(0, 0, 0, Hd * 0.34);
        hz.addColorStop(0, rgba(P.paper, 0.75)); hz.addColorStop(1, rgba(P.paper, 0));
        g.fillStyle = hz; g.fillRect(0, 0, Wd, Hd * 0.34);
        const hb = g.createLinearGradient(0, Hd, 0, Hd * 0.8);
        hb.addColorStop(0, rgba(P.paper, 0.35)); hb.addColorStop(1, rgba(P.paper, 0));
        g.fillStyle = hb; g.fillRect(0, Hd * 0.8, Wd, Hd * 0.2);
      }
      g.restore();
    },
  });

  function hull(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
})();
