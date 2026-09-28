// Orphism / simultanism: a Sonia and Robert Delaunay poster that turns.
// A big "simultaneous disc" (concentric rings, each cut into quarters of
// contrasting colour) sits on a ground of huge circular forms swung from a
// centre off the sheet; a small disc beside it; and a column of poster-poem
// type, each letter on its own painted block with a quarter-disc in it.
// Everything is painted and matte: gouache edges that wobble with the paint,
// a few brush strokes that turn with each ring, paper grain over the lot.
//
// Music, each in its own place:
//   bass   all the rings turn, alternate ones against each other, faster with
//          the bass and the energy, so the contrasts keep sliding past
//   kick   one ring of the big disc clicks a quarter turn, and the click
//          climbs outward ring by ring, beat by beat; the small disc clicks too
//   clap   the colours of the letter blocks step one place along the headline
//   hats   a rim of small segments round the big disc re-colours one at a time,
//          a chaser that runs faster when the hats are busy
//   drop   the rings warm from blues and greens into reds, oranges and pinks
//          (an angular wipe, ring by ring), a flight of discs rolls in from the
//          edges, the ground saturates and a new headline sets itself; the
//          breakdown lets the discs roll away and the colour cool.
// Plain Canvas 2D. No glow: a full palette, but as paint.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
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

  // A value that tweens from wherever it is now; a retarget mid-flight never jumps.
  function Tw(v) { return { from: v, to: v, t0: 0, dur: 0, delay: 0, ease: easeInOut }; }
  function twGet(tw, t) {
    if (tw.dur <= 0) return tw.to;
    const u = clamp((t - tw.t0 - tw.delay) / tw.dur, 0, 1);
    return lerp(tw.from, tw.to, tw.ease(u));
  }
  function twSet(tw, v, t, dur, delay, ease) {
    tw.from = twGet(tw, t);
    tw.to = v; tw.t0 = t; tw.dur = dur; tw.delay = delay || 0; tw.ease = ease || easeInOut;
  }

  // The Delaunays' paint box: earthy, matte versions of the prism, not screen
  // primaries. Complementary pairs sit side by side (simultaneous contrast).
  const INK = {
    red: '#CF3F2C', orange: '#E7862F', yellow: '#EEC03E', lemon: '#EFDB7C',
    green: '#3C9159', teal: '#1E7470', blue: '#2F69AE', ultra: '#27357A',
    violet: '#66408A', pink: '#D86A8C', black: '#1D1A20', white: '#F2EADA',
  };
  const WARM_PAIRS = [['red', 'green'], ['orange', 'blue'], ['yellow', 'violet'], ['pink', 'teal'], ['lemon', 'ultra'], ['red', 'teal'], ['orange', 'ultra']];
  const COOL = ['ultra', 'blue', 'teal', 'green', 'violet', 'lemon', 'white', 'black'];
  // Letter-block colours in contrast order.
  const SEQ = ['red', 'blue', 'yellow', 'green', 'pink', 'ultra', 'orange', 'violet', 'teal', 'lemon'];

  const PRINTS = [
    { name: 'Robert', paper: '#ECE2CB', ink: '#1D1A20', bgMix: [0.46, 0.22] },
    { name: 'Sonia', paper: '#E6D2B6', ink: '#1D1A20', bgMix: [0.34, 0.12] },
    // Bal de nuit: the same inks on a dark board, the ground sunk toward it.
    { name: 'Night', paper: '#1A181E', ink: '#EFE6D4', bgMix: [0.62, 0.4] },
  ];

  const LUM = {};
  for (const k in INK) {
    const h = INK[k];
    LUM[k] = (0.2126 * parseInt(h.slice(1, 3), 16) + 0.7152 * parseInt(h.slice(3, 5), 16) + 0.0722 * parseInt(h.slice(5, 7), 16)) / 255;
  }
  const dark = (c) => LUM[c] < 0.5;
  // The quarter-disc's colour: a hue contrast at the same value as the block,
  // so the letter over both stays legible (the Delaunays' pairs work this way).
  const partner = (k) => {
    const a = SEQ[k % SEQ.length];
    for (const m of [5, 3, 7, 4, 6, 2, 8]) { const b = SEQ[(k + m) % SEQ.length]; if (dark(b) === dark(a)) return b; }
    return SEQ[(k + 5) % SEQ.length];
  };

  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

  // Headlines in French, the movement's own language, all original.
  const HEADS = [
    { w: ['LA', 'NUIT', 'TOURNE'], top: 'grand bal simultané', sub: 'musique · couleur · lumière' },
    { w: ['RYTHME', 'SANS', 'FIN'], top: 'disques en mouvement', sub: 'on danse jusqu’à l’aube' },
    { w: ['DANSEZ', 'EN', 'ROND'], top: 'couleurs simultanées', sub: 'le son tourne avec vous' },
    { w: ['LE SON', 'EN', 'COULEUR'], top: 'nuit des contrastes', sub: 'orchestre · disques · soleil' },
  ];
  const SANS = '"Josefin Sans", "Futura", "Century Gothic", sans-serif';

  VIZ.register({
    id: 'orphism',
    name: 'Orphism',
    order: 508,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'spin', label: 'Rotation speed', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'flight', label: 'Discs in the drop', type: 'range', min: 0, max: 6, default: 5, step: 1 },
      { key: 'paint', label: 'Paint texture', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'print', label: 'Print', type: 'select', options: ['Robert (cream)', 'Sonia (warm)', 'Bal de nuit'], default: 0 },
      { key: 'words', label: 'Headline (blank cycles)', type: 'text', default: '' },
    ],

    actions: [
      { id: 'repaint', label: 'Repaint the discs', run() { this.wantRepaint = true; } },
    ],

    gallery: {
      title: 'Orphism',
      technique: 'Canvas 2D: concentric rings drawn as pie wedges from the outside in, with a wobble tied to each ring\'s own angle so the painted edge turns with it; per-quadrant cool and warm colours crossfaded by an angular wipe; brush strokes as low-alpha arcs in each ring\'s frame; letter blocks with quarter-discs; a seeded grain tile multiplied over the sheet; onset detection against the previous frame',
      brief: 'A Delaunay poster that turns. On cream board a large simultaneous disc of concentric rings, each cut into quarters of contrasting colour, sits over a ground of huge circular forms swung from a centre off the sheet; a small disc beside it; and a column of French poster-poem type, each letter on its own painted block with a quarter-disc in it. Everything is matte gouache: wobbling edges that travel with the paint, brush strokes that turn with each ring, paper grain. The rings turn against each other, faster with the bass, so the contrasts keep sliding past one another. Each kick clicks one ring a quarter turn and the click climbs outward ring by ring, beat by beat; the small disc clicks with it. Each clap steps the letter-block colours one place along the headline, cell by cell. Hats re-colour a rim of small segments one at a time, a chaser. Before the drop the disc is blues, greens, black and white; the drop sweeps it into reds, oranges and pinks ring by ring, a flight of smaller discs rolls in from the edges, the ground saturates and a new headline sets itself letter by letter. The breakdown lets the discs roll away and the colour cool.',
      lineage: [
        'Robert Delaunay\'s Disque simultané (1912-13) and Formes circulaires, soleil et lune (1912-13); Sonia Delaunay\'s Prismes électriques (1914) and Bal Bullier (1913), her simultaneous book covers and poster-poems with lettering on coloured grounds (1913-22). Chevreul\'s law of simultaneous contrast (1839) is the theory under it: complementary pairs set side by side. Batch 05 brief entry "08 · Orphism / simultanism".',
        'Built as pie wedges drawn from the outside in, so rings never gap; the wobble of each edge is a function of the ring\'s own angle, so the painted edge turns with the paint instead of shimmering. Each wedge has a cool and a warm colour, crossfaded by an angular wipe. The drop is a follower of band 1 with hysteresis, as in De Stijl.',
        'Process: the first render already read as Delaunay; the fixes were the top caption running off the column, letters vanishing where they crossed a quarter-disc of opposite value (the quarter-disc now takes a hue contrast at the same value as its block, and the letter ink follows the block\'s value), and uniform ring widths looking mechanical (now uneven, broad beside narrow). Jolt at 640x360 went from noticeable (area 0.14, ratio 3.45: the clap re-coloured the whole headline block on one frame, and the build kick had clicked the widest ring) to calm (area 0.11, ratio 1.6) by making the clap step travel cell by cell and varying ring widths. Later drops swap in fresh warm pairings and a fresh flight while the rings are cool, so the set keeps finding new harmonies.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.main) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.hatCount = 0; this.snareCount = 0;
      this.low = 0; this.drop = false; this.hadDrop = false;
      this.bassEnv = 0; this.hatSlow = 0; this.energy = 0; this.padEnv = 0;
      this.spinClock = 0; this.bgClock = 0; this.rimClock = 0;
      this.dropT = Tw(0);
      this.head = { i: 0, t0: -10 }; this.prevHead = null; this.headSince = 0;
      this.carousel = 0; this.carouselT0 = -10;
      this.colCache = new Map();
      this.grainPat = null;
      this.wantRepaint = false;
      this.paint(0);
    },

    // ---- composition ------------------------------------------------------

    // One disc: n rings, each cut into `parts` wedges, with cool and warm
    // colours per wedge. Adjacent wedges and the wedge inside it differ.
    makeDisc(n, parts, warmOnly) {
      const rng = this.rng;
      const rings = [];
      let prevCols = null;
      for (let i = 0; i < n; i++) {
        const k = typeof parts === 'function' ? parts(i) : parts;
        const q = [];
        const pa = WARM_PAIRS[Math.floor(rng() * WARM_PAIRS.length)];
        let pb = WARM_PAIRS[Math.floor(rng() * WARM_PAIRS.length)];
        if (pb === pa) pb = WARM_PAIRS[(WARM_PAIRS.indexOf(pa) + 2) % WARM_PAIRS.length];
        const warmSeq = [pa[0], pb[0], pa[1], pb[1]];
        const off = Math.floor(rng() * 4);
        for (let j = 0; j < k; j++) {
          let warm = warmSeq[(j + off) % 4];
          if (prevCols && prevCols[j % prevCols.length] === warm) warm = warmSeq[(j + off + 1) % 4];
          let cool = COOL[Math.floor(rng() * COOL.length)];
          if (j > 0 && cool === q[j - 1].cool) cool = COOL[(COOL.indexOf(cool) + 3) % COOL.length];
          if (j === k - 1 && k > 1 && cool === q[0].cool) cool = COOL[(COOL.indexOf(cool) + 2) % COOL.length];
          q.push({ cool: warmOnly ? warm : cool, warm, j: (rng() - 0.5) * 0.1 });
        }
        prevCols = q.map((o) => o.warm);
        const strokes = [];
        for (let s = 0; s < 3; s++) {
          strokes.push({ f: 0.25 + rng() * 0.6, a: rng() * TAU, len: 0.5 + rng() * 1.4, w: 0.12 + rng() * 0.25, light: rng() < 0.5 });
        }
        rings.push({
          q, strokes,
          dir: i % 2 === 0 ? 1 : -1,
          spd: 0.55 + rng() * 0.9,
          base: rng() * TAU,
          step: Tw(0),
          warm: Tw(warmOnly ? 1 : 0),
          seed: rng() * 100,
        });
      }
      // Uneven ring widths, as painted: a broad band beside two narrow ones.
      const wts = rings.map(() => 0.55 + rng() * 0.9);
      const tot = wts.reduce((a, b) => a + b, 0);
      const edges = [0.16];
      let acc = 0.16;
      for (const w of wts) { acc += (0.84 * w) / tot; edges.push(acc); }
      return { rings, edges, core: SEQ[Math.floor(rng() * SEQ.length)] };
    },

    paint(t) {
      const rng = this.rng;
      const warmNow = this.main ? this.main.rings.map((r) => r.warm) : null;
      this.main = this.makeDisc(7, 4, false);
      if (warmNow) this.main.rings.forEach((r, i) => { r.warm = warmNow[i] || Tw(0); });
      this.small = this.makeDisc(4, 4, false);
      // The drop's flight: each disc its own cut (halves, thirds, quarters, sixths).
      this.flightDiscs = [];
      for (let i = 0; i < 6; i++) {
        const parts = [2, 3, 4, 6, 4, 3][i];
        const d = this.makeDisc(3 + Math.floor(rng() * 3), (k) => (k % 2 ? parts : Math.max(2, parts - 1)), true);
        d.roll = rng() * TAU;
        this.flightDiscs.push(d);
      }
      // Rim chaser: 24 small segments.
      this.rim = [];
      for (let i = 0; i < 24; i++) this.rim.push({ c: SEQ[Math.floor(rng() * SEQ.length)], prev: null, t0: -10 });
      this.rimIdx = 0;
      // The ground: Robert's circular forms, swung from a centre off the sheet.
      this.bg = [];
      for (let i = 0; i < 9; i++) {
        const n = 3 + Math.floor(rng() * 3);
        const cuts = [];
        let a = 0;
        for (let j = 0; j < n; j++) { cuts.push(a); a += (TAU / n) * (0.6 + rng() * 0.8); }
        const scale = TAU / a;
        const segs = cuts.map((c, j) => ({ a0: c * scale, c: SEQ[Math.floor(rng() * SEQ.length)], j: (rng() - 0.5) * 0.08 }));
        for (let j = 1; j < segs.length; j++) if (segs[j].c === segs[j - 1].c) segs[j].c = SEQ[(SEQ.indexOf(segs[j].c) + 3) % SEQ.length];
        this.bg.push({ segs, dir: i % 2 ? -1 : 1, spd: 0.6 + rng() * 0.8, seed: rng() * 100 });
      }
    },

    // ---- colour -------------------------------------------------------------

    // name + tone jitter + mix toward the paper, as an rgb() string, cached.
    col(name, j, mix, pr) {
      const key = name + '|' + j.toFixed(3) + '|' + mix.toFixed(2) + '|' + pr.name;
      let s = this.colCache.get(key);
      if (s) return s;
      const c = hexRgb(INK[name]), pp = hexRgb(pr.paper);
      const out = [0, 1, 2].map((i) => {
        let v = c[i] * (1 + j);
        v = lerp(v, pp[i], mix);
        return Math.round(clamp(v, 0, 255));
      });
      s = `rgb(${out[0]},${out[1]},${out[2]})`;
      if (this.colCache.size > 4000) this.colCache.clear();
      this.colCache.set(key, s);
      return s;
    },

    // ---- drawing primitives -------------------------------------------------

    // A pie wedge of radius r from local angle la0 to la1, turned by rot; the
    // outer edge wobbles as a function of the *local* angle so the brush edge
    // travels with the paint instead of shimmering.
    wedge(g, cx, cy, r, la0, la1, rot, seed, amp, stepLen) {
      const n = Math.max(2, Math.ceil(((la1 - la0) * r) / stepLen));
      g.beginPath();
      g.moveTo(cx, cy);
      for (let k = 0; k <= n; k++) {
        const la = la0 + ((la1 - la0) * k) / n;
        const w = amp * (0.5 * Math.sin(3 * la + seed) + 0.3 * Math.sin(7 * la + seed * 2.3) + 0.2 * Math.sin(17 * la + seed * 5.1));
        const a = la + rot, rr = r + w;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    },

    // A disc drawn from the outside in; each ring's radius is its outer edge.
    drawDisc(g, d, cx, cy, R, rotOf, pr, t, paintAmt, extraRot) {
      const n = d.rings.length;
      const amp = R * 0.012 * paintAmt + 0.3;
      for (let i = n - 1; i >= 0; i--) {
        const ring = d.rings[i];
        const r = R * d.edges[i + 1];
        const rin = R * d.edges[i];
        const rot = rotOf(ring, i) + (extraRot || 0);
        const k = ring.q.length;
        const warm = twGet(ring.warm, t);
        for (let j = 0; j < k; j++) {
          const q = ring.q[j];
          const la0 = (j / k) * TAU, la1 = ((j + 1) / k) * TAU + 0.004;
          if (warm < 0.999) {
            g.fillStyle = this.col(q.cool, q.j, 0, pr);
            this.wedge(g, cx, cy, r, la0, la1, rot, ring.seed, amp, 7);
          }
          if (warm > 0.001) {
            // The warm colour sweeps round each wedge like a loaded brush.
            g.fillStyle = this.col(q.warm, q.j, 0, pr);
            this.wedge(g, cx, cy, r, la0, lerp(la0, la1, warm), rot, ring.seed, amp, 7);
          }
        }
        // Brush strokes in the ring's own frame, so they turn with it.
        if (paintAmt > 0.01) {
          g.lineCap = 'round';
          for (const s of ring.strokes) {
            g.strokeStyle = s.light ? `rgba(255,248,235,${0.09 * paintAmt})` : `rgba(20,10,30,${0.07 * paintAmt})`;
            g.lineWidth = Math.max(0.6, (r - rin) * s.w);
            g.beginPath();
            g.arc(cx, cy, lerp(rin, r, s.f), s.a + rot, s.a + rot + s.len);
            g.stroke();
          }
        }
      }
      // The centre: a disc split in two, turning against the first ring.
      const cr = -rotOf(d.rings[0], 0) * 0.7 + (extraRot || 0);
      g.fillStyle = this.col(d.core, 0, 0, pr);
      this.wedge(g, cx, cy, R * d.edges[0] + 0.5, 0, Math.PI + 0.01, cr, 7.7, amp * 0.5, 6);
      g.fillStyle = this.col(partner(SEQ.indexOf(d.core)), 0, 0, pr);
      this.wedge(g, cx, cy, R * d.edges[0] + 0.5, Math.PI, TAU + 0.01, cr, 7.7, amp * 0.5, 6);
    },

    grain(g) {
      if (this.grainPat && this.grainCtx === g) return this.grainPat;
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const x = c.getContext('2d');
      const img = x.createImageData(256, 256);
      const rnd = mulberry(4242);
      // Fibre noise plus soft blotches and faint horizontal drag, like gouache
      // on board reproduced by a flat lithographic plate.
      const blot = new Float32Array(16 * 16);
      for (let i = 0; i < blot.length; i++) blot[i] = rnd();
      const row = new Float32Array(256);
      for (let i = 0; i < 256; i++) row[i] = rnd();
      for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
        const bx = xx / 16, by = y / 16, ix = Math.floor(bx), iy = Math.floor(by);
        const fx = bx - ix, fy = by - iy;
        const q = (a, b) => blot[((b & 15) * 16) + (a & 15)];
        const sm = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
        const v = 255 - rnd() * 30 - sm * 18 - row[y] * 6;
        const o = (y * 256 + xx) * 4;
        img.data[o] = v; img.data[o + 1] = v - 2; img.data[o + 2] = v - 7; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.grainPat = g.createPattern(c, 'repeat');
      this.grainCtx = g;
      return this.grainPat;
    },

    // ---- music ----------------------------------------------------------------

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; this.kickCount++; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; this.snareCount++; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; this.hatCount++; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.05) : k(0.35));
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(1.2);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.2);
      this.padEnv += ((s[2] + s[3]) / 200 - this.padEnv) * k(0.8);
      return { kick, snare, hat };
    },

    onDrop(t, into) {
      const rings = this.main.rings;
      if (into) {
        // Each drop after the first brings fresh warm pairings (invisible to
        // swap while the rings are cool), so minute five is not minute one.
        if (this.hadDrop) {
          const fresh = this.makeDisc(this.main.rings.length, 4, false);
          rings.forEach((r, i) => r.q.forEach((q, j) => { q.warm = fresh.rings[i].q[j].warm; }));
          if (twGet(this.dropT, t) < 0.01) {
            this.flightDiscs = this.flightDiscs.map((d, i) => {
              const parts = [2, 3, 4, 6, 4, 3][(i + this.kickCount) % 6];
              const nd = this.makeDisc(3 + Math.floor(this.rng() * 3), (k) => (k % 2 ? parts : Math.max(2, parts - 1)), true);
              nd.roll = this.rng() * TAU;
              return nd;
            });
          }
        }
        this.hadDrop = true;
        twSet(this.dropT, 1, t, 1.6, 0, easeInOut);
        rings.forEach((r, i) => twSet(r.warm, 1, t, 0.55, 0.05 + i * 0.11, easeInOut));
        this.small.rings.forEach((r, i) => twSet(r.warm, 1, t, 0.5, 0.3 + i * 0.1, easeInOut));
        if (this.kickCount - this.headSince > 4) { this.headSince = this.kickCount; this.setHead((this.head.i + 1) % HEADS.length, t); }
      } else {
        twSet(this.dropT, 0, t, 3.2, 0.3, easeInOut);
        rings.forEach((r, i) => twSet(r.warm, 0, t, 1.2, 0.4 + (rings.length - 1 - i) * 0.25, easeInOut));
        this.small.rings.forEach((r, i) => twSet(r.warm, 0, t, 1.0, 1.2 + i * 0.2, easeInOut));
      }
    },

    setHead(i, t) {
      this.prevHead = { i: this.head.i, custom: this.head.custom };
      this.head = { i: i, t0: t };
    },

    // ---- frame ------------------------------------------------------------------

    draw(p, signals, params, ctx) {
      if (!this.main) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const pr = PRINTS[clamp(Math.round(params.print), 0, PRINTS.length - 1)];
      const paintAmt = params.paint;
      const react = params.reaction;

      if (this.wantRepaint) { this.wantRepaint = false; this.paint(t); }

      // ---- music
      const ev = this.analyse(signals, t, dt);
      if (!this.drop && this.low > 30) { this.drop = true; this.onDrop(t, true); }
      else if (this.drop && this.low < 16) { this.drop = false; this.onDrop(t, false); }
      const dropAmt = twGet(this.dropT, t);

      if (ev.kick && react > 0.01) {
        // The click climbs outward through the rings, one per beat.
        const n = this.main.rings.length;
        const ring = this.main.rings[(this.kickCount - 1) % n];
        twSet(ring.step, ring.step.to + ring.dir * (Math.PI / 2) * Math.min(1, react), t, 0.2 + 0.12 / (0.5 + react), 0, easeOut);
        if (this.kickCount % 2 === 0 || this.drop) {
          const sr = this.small.rings;
          for (let i = 0; i < sr.length; i++) twSet(sr[i].step, sr[i].step.to + (i % 2 ? -1 : 1) * (Math.PI / 2) * Math.min(1, react), t, 0.3, i * 0.03, easeOut);
        }
      }
      if (ev.snare) {
        this.carousel++;
        this.carouselT0 = t;
      }
      if (ev.hat) {
        const seg = this.rim[this.rimIdx % this.rim.length];
        this.rimIdx++;
        seg.prev = seg.c;
        let c = SEQ[Math.floor(this.rng() * SEQ.length)];
        if (c === seg.c) c = SEQ[(SEQ.indexOf(c) + 4) % SEQ.length];
        seg.c = c; seg.t0 = t;
      }
      // Headline: a new one every 32 kicks of a drop.
      if (this.drop && this.kickCount - this.headSince >= 32) { this.headSince = this.kickCount; this.setHead((this.head.i + 1) % HEADS.length, t); }

      // Rotation: the bass and the energy change the speed, never jerk it.
      const rate = (0.07 + 0.26 * this.energy + 0.22 * this.bassEnv + 0.08 * this.padEnv + 0.12 * dropAmt) * params.spin;
      this.spinClock += dt * rate;
      this.bgClock += dt * (0.012 + 0.03 * this.energy + 0.02 * this.padEnv) * params.spin;
      this.rimClock += dt * (0.03 + 0.08 * this.hatSlow) * params.spin;

      // ---- layout
      const land = W / H >= 1.3;
      const L = land ? {
        mx: W * 0.335, my: H * 0.5, mR: S * 0.43,
        sx: W * 0.64, sy: H * 0.2, sR: S * 0.1,
        bx: -W * 0.02, by: H * 1.1,
        col: { x: W * 0.725, y: S * 0.07, w: W * 0.975 - W * 0.725, h: H - S * 0.14 },
        fl: [[0.07, 0.86, 0.17, -1, 0.3], [0.6, 0.87, 0.13, 0, 1], [0.1, 0.11, 0.1, 0, -1], [0.62, 0.52, 0.07, 0, 1], [0.44, 0.05, 0.06, 0, -1], [0.3, 0.97, 0.08, 0, 1]],
      } : {
        mx: W * 0.42, my: H * 0.36, mR: S * 0.31,
        sx: W * 0.84, sy: H * 0.13, sR: S * 0.085,
        bx: -W * 0.05, by: H * 0.95,
        col: { x: W * 0.05, y: H * 0.74, w: W * 0.9, h: H * 0.23 },
        fl: [[0.08, 0.66, 0.12, -1, 0], [0.86, 0.5, 0.1, 1, 0], [0.1, 0.08, 0.08, 0, -1], [0.8, 0.7, 0.06, 1, 0], [0.55, 0.04, 0.05, 0, -1], [0.95, 0.32, 0.07, 1, 0]],
      };
      // The big disc drifts on a slow Lissajous, so the sheet is never static.
      const mx = L.mx + S * 0.012 * Math.sin(t * 0.13), my = L.my + S * 0.01 * Math.sin(t * 0.17 + 1);

      // ---- paint
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = pr.paper;
      g.fillRect(-2, -2, W + 4, H + 4);

      // Sheet margin: a poster printed with a narrow paper border.
      const bm = S * 0.025;
      g.save();
      g.beginPath(); g.rect(bm, bm, W - 2 * bm, H - 2 * bm); g.clip();

      // Ground: circular forms from an off-sheet centre, pale in the quiet and
      // saturating in the drop.
      const bgMix = lerp(pr.bgMix[0], pr.bgMix[1], dropAmt);
      const far = Math.hypot(W - L.bx, L.by) + 20;
      const bw = S * 0.21;
      const nb = Math.min(this.bg.length, Math.ceil(far / bw));
      for (let i = nb - 1; i >= 0; i--) {
        const b = this.bg[i];
        const r = bw * (i + 1.2);
        const rot = this.bgClock * b.dir * b.spd + b.seed;
        for (let j = 0; j < b.segs.length; j++) {
          const sg = b.segs[j];
          const a1 = j + 1 < b.segs.length ? b.segs[j + 1].a0 : TAU;
          g.fillStyle = this.col(sg.c, sg.j, bgMix, pr);
          this.wedge(g, L.bx, L.by, r, sg.a0, a1 + 0.003, rot, b.seed, S * 0.008 * paintAmt, 22);
        }
      }

      // Flight: discs that roll in from the edges in the drop and away after.
      const nFlight = Math.round(clamp(params.flight, 0, 6));
      for (let i = 0; i < nFlight; i++) {
        const f = L.fl[i], d = this.flightDiscs[i];
        const u = easeInOut(clamp(dropAmt * 1.6 - i * 0.12, 0, 1));
        if (u <= 0) continue;
        const R = S * f[2];
        const hx = f[3] || (f[0] < 0.5 ? -1 : 1) * (f[4] ? 0 : 1), hy = f[4];
        const dist = (1 - u) * (S * 0.5 + R * 2);
        const cx = W * f[0] + hx * dist, cy = H * f[1] + hy * dist;
        const roll = -dist / R * (hx || hy || 1);
        this.drawDisc(g, d, cx, cy, R, (ring, k) => d.roll + ring.base + ring.dir * ring.spd * this.spinClock * 1.4 + roll * (k % 2 ? 0.6 : 1), pr, t, paintAmt, 0);
      }

      // Main disc: a rim of small segments, then the rings.
      const R = L.mR;
      const rimR = R * 1.075;
      const rimRot = this.rimClock;
      for (let i = 0; i < this.rim.length; i++) {
        const sg = this.rim[i];
        const la0 = (i / this.rim.length) * TAU, la1 = ((i + 1) / this.rim.length) * TAU + 0.004;
        const u = clamp((t - sg.t0) / 0.12, 0, 1);
        if (u < 1 && sg.prev) {
          g.fillStyle = this.col(sg.prev, 0, 0, pr);
          this.wedge(g, mx, my, rimR, la0, la1, rimRot, 3.3, R * 0.01 * paintAmt, 6);
        }
        g.fillStyle = this.col(sg.c, 0, 0, pr);
        this.wedge(g, mx, my, rimR, la0, lerp(la0, la1, u), rimRot, 3.3, R * 0.01 * paintAmt, 6);
      }
      // A thin paper ring separates rim from disc, as Robert left bare canvas.
      g.fillStyle = pr.paper;
      g.beginPath(); g.arc(mx, my, R * 1.012, 0, TAU); g.fill();

      const spin = this.spinClock;
      this.drawDisc(g, this.main, mx, my, R, (ring) => ring.base + ring.dir * ring.spd * spin + twGet(ring.step, t), pr, t, paintAmt, 0);

      // Small disc
      this.drawDisc(g, this.small, L.sx, L.sy, L.sR, (ring) => ring.base - ring.dir * ring.spd * spin * 1.3 + twGet(ring.step, t), pr, t, paintAmt, 0);

      // ---- type column
      this.drawType(g, L.col, land, pr, t, params, S);

      g.restore();

      // Grain over everything, multiplied.
      if (paintAmt > 0.01) {
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = clamp(0.35 + 0.3 * paintAmt, 0, 1);
        g.fillStyle = this.grain(g);
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }
      g.restore();
    },

    headWords(i, custom) {
      if (custom) {
        const parts = custom.split(/\s+/).filter(Boolean);
        return { w: parts.slice(0, 3), top: HEADS[i].top, sub: HEADS[i].sub };
      }
      return HEADS[i];
    },

    drawType(g, box, land, pr, t, params, S) {
      const custom = (params.words || '').toUpperCase().trim();
      const head = this.headWords(this.head.i, custom);
      const old = this.prevHead ? this.headWords(this.prevHead.i, custom) : null;
      const lines = land ? head.w : [head.w.join(' ')];
      const oldLines = old ? (land ? old.w : [old.w.join(' ')]) : null;
      const small = S * 0.026;
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillStyle = pr.ink;

      // Top line: small caps spaced out, rule under it.
      let y = box.y;
      g.font = `700 ${small.toFixed(1)}px ${SANS}`;
      const top = head.top.toUpperCase();
      if (land) {
        this.spaced(g, top, box.x, y + small, small * 0.28, box.w);
        y += small * 1.9;
        g.fillRect(box.x, y, box.w, Math.max(1, S * 0.004));
        y += S * 0.02;
      }

      // Headline blocks.
      const hh = land ? (box.h * 0.62) / lines.length : box.h * 0.66;
      const car = this.carousel;
      let cellIdx = 0;
      const tHead = t - this.head.t0;
      for (let li = 0; li < lines.length; li++) {
        const word = lines[li];
        const oldWord = oldLines ? oldLines[li] || '' : '';
        const n = Math.max(word.length, 1);
        const cw = box.w / n;
        for (let ci = 0; ci < n; ci++) {
          const x = box.x + ci * cw, yy = y;
          const k = cellIdx++;
          const cA = SEQ[(k + car) % SEQ.length], cB = partner(k + car);
          const pA = SEQ[(k + car - 1 + SEQ.length) % SEQ.length], pB = partner(k + car - 1 + SEQ.length);
          // The clap's colour step travels along the headline cell by cell.
          const cu = clamp((t - this.carouselT0 - k * 0.03) / 0.16, 0, 1);
          const shape = (k * 7 + li * 3) % 6;
          // Old colours, then the new ones wiped in from the left on the clap.
          this.cell(g, x, yy, cw, hh, pA, pB, shape, pr);
          if (cu < 1) {
            g.save(); g.beginPath(); g.rect(x, yy, cw * cu + 0.5, hh); g.clip();
            this.cell(g, x, yy, cw, hh, cA, cB, shape, pr);
            g.restore();
          } else this.cell(g, x, yy, cw, hh, cA, cB, shape, pr);
          // Letters re-set one by one when the headline changes.
          const lu = clamp((tHead - ci * 0.06 - li * 0.18) / 0.25, 0, 1);
          const ch = word[ci] || ' ', och = oldWord[ci] || ' ';
          g.fillStyle = dark(cu > 0.5 ? cA : pA) ? INK.white : INK.black;
          const fs = Math.min(hh * 0.78, cw * 1.25);
          g.font = `700 ${fs.toFixed(1)}px ${SANS}`;
          g.textAlign = 'center';
          const base = yy + hh * 0.5 + fs * 0.36;
          if (lu < 1 && och !== ' ' && och !== ch) {
            g.globalAlpha = 1 - lu;
            g.fillText(och, x + cw / 2, base + lu * hh * 0.25);
          }
          if (ch !== ' ') {
            g.globalAlpha = och === ch ? 1 : lu;
            g.fillText(ch, x + cw / 2, base - (1 - lu) * hh * 0.25 * (och === ch ? 0 : 1));
          }
          g.globalAlpha = 1;
        }
        y += hh + S * 0.008;
      }

      // Captions.
      g.fillStyle = pr.ink;
      g.textAlign = 'left';
      if (land) {
        y += S * 0.03;
        g.font = `300 ${(small * 1.25).toFixed(1)}px ${SANS}`;
        g.fillText(head.sub, box.x, y + small);
        y += small * 2.2;
        g.fillRect(box.x, y, box.w, Math.max(1, S * 0.004));
        y += small * 1.6;
        g.font = `700 ${small.toFixed(1)}px ${SANS}`;
        this.spaced(g, 'SAMEDI · MINUIT', box.x, y, small * 0.2);
        g.textAlign = 'right';
        g.font = `300 ${small.toFixed(1)}px ${SANS}`;
        g.fillText('entrée libre', box.x + box.w, y);
        g.textAlign = 'left';
      } else {
        g.font = `700 ${small.toFixed(1)}px ${SANS}`;
        this.spaced(g, head.top.toUpperCase(), box.x, box.y + hh + small * 1.7, small * 0.2);
        g.textAlign = 'right';
        g.font = `300 ${small.toFixed(1)}px ${SANS}`;
        g.fillText(head.sub, box.x + box.w, box.y + hh + small * 1.7);
        g.textAlign = 'left';
      }
    },

    // A letter block: flat colour with a quarter-disc, semicircle or disc in it.
    cell(g, x, y, w, h, a, b, shape, pr) {
      g.fillStyle = this.col(a, 0, 0, pr);
      g.fillRect(x - 0.3, y, w + 0.6, h);
      g.fillStyle = this.col(b, 0, 0, pr);
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.beginPath();
      const r = Math.min(w, h);
      if (shape < 4) {
        const cx = shape % 2 ? x + w : x, cy = shape < 2 ? y : y + h;
        g.moveTo(cx, cy); g.arc(cx, cy, r * 0.95, 0, TAU);
      } else if (shape === 4) {
        g.arc(x + w / 2, y + h, Math.min(w / 2, h) * 0.95, Math.PI, TAU);
      } else {
        g.arc(x + w / 2, y + h / 2, r * 0.42, 0, TAU);
      }
      g.fill();
      g.restore();
    },

    // Letter-spaced caps, squeezed to fit `maxW` if one is given.
    spaced(g, s, x, y, track, maxW) {
      let wsum = 0;
      for (const ch of s) wsum += g.measureText(ch).width;
      if (maxW) track = Math.min(track, (maxW - wsum) / Math.max(1, s.length - 1));
      const sx = maxW && wsum > maxW ? maxW / wsum : 1;
      let cx = x;
      for (const ch of s) {
        if (sx < 1) { g.save(); g.translate(cx, y); g.scale(sx, 1); g.fillText(ch, 0, 0); g.restore(); }
        else g.fillText(ch, cx, y);
        cx += g.measureText(ch).width * sx + (sx < 1 ? 0 : track);
      }
    },
  });
})();
