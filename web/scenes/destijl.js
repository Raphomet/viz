// De Stijl: a Mondrian / van Doesburg poster that keeps re-composing itself.
// The left of the sheet is a painted panel: black bars on white dividing the
// square into rectangles, a few of them printed in the primaries. The right is
// the poster's type: a headline in square, orthogonal block letters (van
// Doesburg's 1919 alphabet was drawn this way, every stroke on one grid), a
// primary-colour bar, and captions in a geometric sans.
//
// Music, each in its own place:
//   kick   one white cell is printed in a primary, wiped in from one edge;
//          older colour drains out on the off-beat, so the count stays low
//   snare  a different event: the grid re-divides (a bar slides, a new bar
//          draws itself across a cell, or two cells merge as a bar retracts)
//   bass   Boogie-Woogie traffic: in the drop some bars turn yellow and carry
//          small squares, whose flow and big blocks swell with the bass line
//   hats   one square in five along the yellow streets changes colour per hat
//   drop   the whole panel turns 45 degrees into a counter-composition, more
//          cells, yellow and blue join red and black, the streets switch on and
//          the headline re-sets itself letter by letter; the breakdown turns
//          back upright, merges cells and drains the colour to one or two.
// Plain Canvas 2D: flat fills, a slight misregistration of the colour plate
// against the black, and paper grain printed over everything. No glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

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
  function twDone(tw, t) { return tw.dur <= 0 || t >= tw.t0 + tw.delay + tw.dur; }
  function twSet(tw, v, t, dur, delay, ease) {
    tw.from = twGet(tw, t);
    tw.to = v; tw.t0 = t; tw.dur = dur; tw.delay = delay || 0; tw.ease = ease || easeInOut;
  }

  // Inks. Index 0-3 are the colours a kick can print; the tier decides which
  // are in play (red and black always; blue from the build; yellow in the drop).
  const RED = 0, BLACK = 1, BLUE = 2, YELLOW = 3, GREY = 4;
  const PRINTS = [
    { paper: '#E2D8C0', panel: '#F5F2EA', line: '#141414', text: '#141414',
      inks: ['#D0271D', '#161616', '#1E3F96', '#F0BF1A', '#B8B4AA'] },
    // Night: the same poster printed on black stock with a cream key plate.
    { paper: '#131316', panel: '#1B1B20', line: '#ECE4D2', text: '#ECE4D2',
      inks: ['#D8301F', '#ECE4D2', '#2F57C8', '#F2C21C', '#56545C'] },
  ];

  // Block letters on a five-row grid of square cells. Widths vary (I is one
  // cell wide) like van Doesburg's alphabet; strokes are always one cell.
  const GLYPHS = {
    A: ['#####', '#...#', '#####', '#...#', '#...#'],
    B: ['####.', '#...#', '#####', '#...#', '#####'],
    C: ['#####', '#....', '#....', '#....', '#####'],
    D: ['####.', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '####.', '#....', '#####'],
    G: ['#####', '#....', '#.###', '#...#', '#####'],
    H: ['#...#', '#...#', '#####', '#...#', '#...#'],
    I: ['#', '#', '#', '#', '#'],
    K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#####'],
    M: ['#####', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
    N: ['##..#', '#.#.#', '#.#.#', '#.#.#', '#..##'],
    O: ['#####', '#...#', '#...#', '#...#', '#####'],
    P: ['#####', '#...#', '#####', '#....', '#....'],
    R: ['#####', '#...#', '#####', '#..#.', '#...#'],
    S: ['#####', '#....', '#####', '....#', '#####'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#####'],
    V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '#####'],
    Z: ['#####', '...#.', '..#..', '.#...', '#####'],
    ' ': ['..', '..', '..', '..', '..'],
  };
  // Headline pairs (Dutch, the movement's language): the word pair, which
  // letter is printed red (word, letter), and a sub-line.
  const HEADS = [
    { w: ['NACHT', 'RITME'], red: [1, 1], sub: 'muziek · licht · beweging' },
    { w: ['KLANK', 'LICHT'], red: [1, 1], sub: 'geluid in rechte lijnen' },
    { w: ['DANS', 'NU'], red: [1, 1], sub: 'tot het ochtendlicht' },
    { w: ['BAS', 'EN LICHT'], red: [0, 0], sub: 'een avond van ritme en kleur' },
  ];
  const wordUnits = (w) => {
    let n = 0;
    for (let i = 0; i < w.length; i++) n += (GLYPHS[w[i]] || GLYPHS[' '])[0].length + (i ? 1 : 0);
    return n;
  };

  // The night's running order; the row for the current section is marked.
  const PROGRAMME = [
    ['23.00', 'opening: de eerste lijn'],
    ['00.30', 'blauw komt binnen'],
    ['01.30', 'tegencompositie'],
    ['04.00', 'wit, en het ochtendlicht'],
  ];
  const SANS = '"Josefin Sans", "Futura", "Century Gothic", sans-serif';

  VIZ.register({
    id: 'destijl',
    name: 'De Stijl',
    order: 501,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'motion', label: 'Re-division speed', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'density', label: 'Grid density', type: 'range', min: 0.5, max: 2, default: 1, step: 0.01 },
      { key: 'tilt', label: 'Counter-composition', type: 'select',
        options: ['Drop tilts 45°', 'Always upright', 'Always tilted'], default: 0 },
      { key: 'traffic', label: 'Boogie-Woogie traffic', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'print', label: 'Print', type: 'select', options: ['Paper', 'Night'], default: 0 },
      { key: 'words', label: 'Headline (blank cycles)', type: 'text', default: '' },
    ],

    actions: [
      { id: 'recompose', label: 'Recompose', run() { this.wantReset = true; } },
    ],

    gallery: {
      title: 'De Stijl',
      technique: 'Canvas 2D: a binary space partition of a square whose split positions, line growth and cell fills are all tweens, drawn inside a clipped panel that rotates; block letters built cell by cell on a grid; a seeded grain tile multiplied over the sheet; onset detection against the previous frame',
      brief: 'A De Stijl poster alive. On cream stock a painted panel of black bars and white cells, a few printed red and black; beside it a headline in square block letters, a bar of primaries and small geometric-sans captions in Dutch about night, sound and dancing. Each kick prints one cell in a primary, wiped in from an edge, and older colour drains away on the off-beat. Each snare re-divides the grid: a bar slides, a new bar draws itself across a cell, or a bar retracts and two cells merge. The drop turns the whole panel 45° into a van Doesburg counter-composition with more cells, blue and yellow joining red, and Boogie-Woogie streets: bars turn yellow and carry small red, blue and grey squares that flow with the bass and flicker with the hats. The headline re-sets itself letter by letter. The breakdown turns back upright and exhales to a sparse sheet.',
      lineage: [
        'Piet Mondrian\'s compositions with red, yellow and blue (1920s-30s) and Broadway Boogie Woogie (1943); Theo van Doesburg\'s counter-compositions (1924-25), which tilted the grid 45°, and his orthogonal alphabet (1919); Vilmos Huszár and Bart van der Leck\'s printed matter. Batch 05 brief entry "01 · De Stijl".',
        'Built as a partition tree in unit coordinates mapped onto a square of side S(|cos θ|+|sin θ|), so at any tilt the rotated composition still covers the upright panel. Kick cells are chosen among visible white cells of moderate size, so one kick moves a few percent of the frame. The drop is a fast follower of band 1 (the bass line), with hysteresis.',
        'Process: the first render read as De Stijl at once, but at 45° the tree doubles every cell\'s area, so the counter-composition showed three huge planes and a flooded blue half. The cell target now counts only visible cells, large coloured cells are split or drained, and colour past a sixth of the panel goes home. The right column was half empty, so a programme of the night was added whose current row is marked (intro, blue arriving, counter-composition, dawn). Jolt at 640x360 went from noticeable (area 0.10, ratio 4.6: the panel was so still between beats that one cell was a big relative change, and the clap\'s re-division landed with the second kick) to calm (area 0.075, ratio 2.1; after the drop flurry below, area 0.105, ratio 1.6) by slowing the kick into a visible 0.25 s roller-wipe, softening the clap slide, and letting every bar breathe on its own slow sine whose speed follows the energy. A 96 s run showed a later drop arriving nearly empty after a long quiet had merged the cells, so the drop now splits cells against the tilted geometry until the counter-composition has its fifteen visible cells.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.root) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.hatCount = 0; this.snareCount = 0;
      this.low = 0; this.drop = false; this.tier = 0;
      this.bassEnv = 0; this.hatSlow = 0; this.energy = 0;
      this.flow = 0; this.breath = 0; this.structClock = 0; this.driftClock = 0;
      this.angle = Tw(0);
      this.head = { i: 0, t0: -10 }; this.prevHead = null; this.headSince = 0;
      this.bar = [Tw(1), Tw(0), Tw(0)];   // red / blue / yellow shares of the colour bar
      this.wantReset = false;
      this.rowHl = [Tw(1), Tw(0), Tw(0), Tw(0)]; this.phase = 0; this.hadDrop = false;
      this.lastColour = -1;
      this.grainPat = null;
      this.S = 500; this.L = 500; this.th = 10; this.cosA = 1; this.sinA = 0;
      this.build(0, 7, true);
    },

    newLeaf(col) { return { leaf: true, col: col, fill: Tw(col >= 0 ? 1 : 0), fillDir: 0, born: 0, draining: false }; },

    // A fresh composition: split the square until it has n cells.
    build(t, n, animate) {
      this.root = this.newLeaf(-1);
      let k = 0;
      while (this.leaves().length < n && k++ < 60) {
        this.lay(this.root, 0, 0, 1, 1, t, true);
        const ls = this.leaves().sort((a, b) => this.area(b) - this.area(a));
        const l = ls[Math.floor(this.rng() * Math.min(2, ls.length))];
        this.split(l, t, animate ? 0.55 : 0, animate ? 0.1 + k * 0.12 : 0);
      }
      this.lay(this.root, 0, 0, 1, 1, t, true);
      const ls = this.leaves().filter((l) => this.area(l) < 0.12).sort(() => this.rng() - 0.5);
      if (ls[0]) { ls[0].col = RED; twSet(ls[0].fill, 1, t, 0.5, animate ? 1.2 : 0, easeOut); ls[0].fill.from = 0; }
      if (ls[1]) { ls[1].col = BLACK; twSet(ls[1].fill, 1, t, 0.5, animate ? 1.5 : 0, easeOut); ls[1].fill.from = 0; }
    },

    leaves(node, out) {
      node = node || this.root; out = out || [];
      if (node.leaf) out.push(node); else { this.leaves(node.a, out); this.leaves(node.b, out); }
      return out;
    },
    splits(node, out) {
      node = node || this.root; out = out || [];
      if (!node.leaf) { out.push(node); this.splits(node.a, out); this.splits(node.b, out); }
      return out;
    },
    // Unit-square rectangles, from the tweens (now) or their targets (planning).
    lay(node, x0, y0, x1, y1, t, target) {
      node.r = [x0, y0, x1, y1];
      if (node.leaf) return;
      // Bars breathe: each creeps on its own slow sine, whose speed (never its
      // size) follows the energy, so the grid is never quite still.
      const pp = target ? node.pos.to
        : twGet(node.pos, t) + 0.016 * Math.sin(this.breath * (0.6 + 0.8 * hash(node.seed)) + node.seed) * twGet(node.grow, t);
      if (node.dir === 0) {
        const xs = lerp(x0, x1, pp);
        this.lay(node.a, x0, y0, xs, y1, t, target); this.lay(node.b, xs, y0, x1, y1, t, target);
      } else {
        const ys = lerp(y0, y1, pp);
        this.lay(node.a, x0, y0, x1, ys, t, target); this.lay(node.b, x0, ys, x1, y1, t, target);
      }
    },
    area(n) { return n.r ? (n.r[2] - n.r[0]) * (n.r[3] - n.r[1]) : 1; },

    split(l, t, dur, delay) {
      const w = l.r ? l.r[2] - l.r[0] : 1, h = l.r ? l.r[3] - l.r[1] : 1;
      const dir = w > h * 1.15 ? 0 : h > w * 1.15 ? 1 : (this.rng() < 0.5 ? 0 : 1);
      const choices = [0.3, 0.36, 0.62, 0.66, 0.72, 0.4];
      const pos = choices[Math.floor(this.rng() * choices.length)] + (this.rng() - 0.5) * 0.05;
      const col = l.col, fill = l.fill, fillDir = l.fillDir, born = l.born, draining = l.draining;
      l.leaf = false; l.dir = dir; l.pos = Tw(pos);
      l.grow = Tw(dur > 0 ? 0 : 1); if (dur > 0) twSet(l.grow, 1, t, dur, delay || 0, easeOut);
      l.growFrom = this.rng() < 0.5 ? 0 : 1;
      l.th = this.rng() < 0.22 ? 0.6 : 1;
      l.street = Tw(0); l.flowSign = this.rng() < 0.5 ? -1 : 1; l.dying = false;
      l.seed = Math.floor(this.rng() * 1000);
      // Colour stays with the half nearer where it was, so a split never
      // repaints a large area at once.
      const keep = this.newLeaf(col); keep.fill = fill; keep.fillDir = fillDir; keep.born = born; keep.draining = draining;
      const fresh = this.newLeaf(-1);
      if (this.rng() < 0.5) { l.a = keep; l.b = fresh; } else { l.a = fresh; l.b = keep; }
      delete l.col;
    },

    // Unit coords to panel-centred screen coords at the current tilt.
    toScreen(u, v) {
      const L = this.L, c = this.cosA, s = this.sinA;
      const x = (u - 0.5) * L, y = (v - 0.5) * L;
      return [x * c - y * s, x * s + y * c];
    },
    visible(u, v, margin) {
      const q = this.toScreen(u, v), h = this.S / 2 - (margin || 0);
      return Math.abs(q[0]) < h && Math.abs(q[1]) < h;
    },
    vis(l, margin) { return this.visible((l.r[0] + l.r[2]) / 2, (l.r[1] + l.r[3]) / 2, margin); },
    // Smallest cell side (screen units) if every tween landed now.
    minSide() {
      this.lay(this.root, 0, 0, 1, 1, 0, true);
      let m = 1e9;
      for (const l of this.leaves()) {
        if (!this.visible((l.r[0] + l.r[2]) / 2, (l.r[1] + l.r[3]) / 2, -this.S * 0.3)) continue;
        m = Math.min(m, (l.r[2] - l.r[0]) * this.L, (l.r[3] - l.r[1]) * this.L);
      }
      return m;
    },

    // ---- events -----------------------------------------------------------

    onKick(t, params) {
      this.lay(this.root, 0, 0, 1, 1, t, false);
      const react = params.reaction;
      const S2 = this.S * this.S, L2 = this.L * this.L;
      const maxA = (0.05 + 0.06 * react) * S2, minA = 0.006 * S2;
      const all = this.leaves();
      const cand = all.filter((l) => l.col < 0 && this.visible((l.r[0] + l.r[2]) / 2, (l.r[1] + l.r[3]) / 2, this.th)
        && this.area(l) * L2 < maxA && this.area(l) * L2 > minA);
      let pick = cand.length ? cand[Math.floor(this.rng() * cand.length)] : null;
      if (!pick) {
        const w = all.filter((l) => l.col < 0 && this.visible((l.r[0] + l.r[2]) / 2, (l.r[1] + l.r[3]) / 2, this.th))
          .sort((a, b) => this.area(a) - this.area(b));
        pick = w[0] && this.area(w[0]) * L2 < 0.2 * S2 ? w[0] : null;
      }
      if (!pick) return;
      const palette = this.tier >= 2 ? [RED, RED, BLUE, YELLOW, YELLOW, BLACK] : this.tier === 1 ? [RED, RED, BLUE, BLACK] : [RED, RED, BLACK, GREY];
      let c = palette[Math.floor(this.rng() * palette.length)];
      if (c === this.lastColour) c = palette[Math.floor(this.rng() * palette.length)];
      this.lastColour = c;
      pick.col = c; pick.fill = Tw(0); pick.draining = false; pick.born = this.kickCount;
      pick.fillDir = Math.floor(this.rng() * 4);
      // A wipe you can watch travel across the cell, like a roller passing,
      // rather than a flash: it lands on the beat and finishes on the off-beat.
      twSet(pick.fill, 1, t, 0.2 + 0.1 / (0.5 + react), 0, (u) => 1 - Math.pow(1 - u, 1.6));
      // Keep the count of coloured cells low: the oldest drains on the off-beat.
      const maxCol = Math.round((this.tier >= 2 ? 5 : this.tier === 1 ? 3 : 2) * (0.7 + 0.3 * params.density));
      const coloured = all.filter((l) => l.col >= 0 && !l.draining && l !== pick).sort((a, b) => a.born - b.born);
      for (let i = 0; i < coloured.length - (maxCol - 1); i++) this.drain(coloured[i], t, 0.24);
    },

    drain(l, t, delay) {
      l.draining = true;
      twSet(l.fill, 0, t, 0.45, delay, easeInOut);
    },

    // One act of re-division: keep the cell count near its target, else slide.
    restructure(t, params, snappy) {
      this.lay(this.root, 0, 0, 1, 1, t, false);
      const target = Math.round((this.tier >= 2 ? 15 : this.tier === 1 ? 10 : 7) * params.density);
      const ls = this.leaves();
      // Count what the viewer can see: at 45° a third of the tree is off the panel.
      const n = ls.filter((l) => this.vis(l, -this.S * 0.04)).length;
      const r = this.rng();
      if (n < target && r < 0.8) {
        const cand = ls.filter((l) => !l.draining && this.vis(l, -this.S * 0.1)
          && Math.min(l.r[2] - l.r[0], l.r[3] - l.r[1]) * this.L > this.S * 0.1)
          .sort((a, b) => this.area(b) - this.area(a));
        if (cand.length) {
          const l = cand[Math.floor(this.rng() * Math.min(2, cand.length))];
          this.split(l, t, snappy ? 0.22 : 0.5, 0);
          if (this.minSide() < this.th * 2.2) { this.unsplit(l); } else return;
        }
      }
      if (n > target + 1 && r < 0.8) {
        const cand = this.splits().filter((s) => !s.dying && s.a.leaf && s.b.leaf && s.a.col < 0 && s.b.col < 0 && twDone(s.grow, t));
        if (cand.length) {
          const s = cand[Math.floor(this.rng() * cand.length)];
          s.dying = true; twSet(s.grow, 0, t, snappy ? 0.25 : 0.55, 0, easeInOut);
          return;
        }
      }
      this.slide(t, snappy ? 0.34 : 1.1, snappy ? 0.07 : 0.06);
    },
    unsplit(l) {
      const keep = l.a.col >= 0 ? l.a : l.b;
      l.leaf = true; l.col = keep.col; l.fill = keep.fill; l.fillDir = keep.fillDir; l.born = keep.born; l.draining = keep.draining;
      delete l.a; delete l.b;
    },
    slide(t, dur, amount) {
      const cand = this.splits().filter((s) => !s.dying && twDone(s.grow, t));
      for (let tries = 0; tries < 6 && cand.length; tries++) {
        const s = cand[Math.floor(this.rng() * cand.length)];
        const cur = s.pos.to;
        const d = (this.rng() < 0.5 ? -1 : 1) * amount * (0.6 + 0.8 * this.rng());
        const nv = clamp(cur + d, 0.18, 0.82);
        s.pos.to = nv;
        const ok = this.minSide() > this.th * 2.2;
        s.pos.to = cur;
        if (ok) { twSet(s.pos, nv, t, dur, 0, easeInOut); return; }
      }
    },

    reap(t) {
      for (const s of this.splits()) {
        if (s.dying && twDone(s.grow, t)) this.unsplit(s);
      }
      for (const l of this.leaves()) {
        if (l.draining && twDone(l.fill, t)) { l.col = -1; l.draining = false; l.fill = Tw(0); }
      }
    },

    analyse(s, t, dt, params) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; this.kickCount++; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; this.snareCount++; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { this.lastHat = t; this.hatCount++; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.03) : k(0.2));
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(1.2);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.0);
      return { kick, snare };
    },

    setHead(i, t) {
      if (i === this.head.i && t - this.head.t0 < 1) return;
      this.prevHead = { i: this.head.i, t0: t, custom: this.head.custom };
      this.head = { i: i, t0: t + 0.35 };
    },

    // ---- drawing ------------------------------------------------------------

    grain(g) {
      if (this.grainPat && this.grainCtx === g) return this.grainPat;
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const x = c.getContext('2d');
      const img = x.createImageData(256, 256);
      const rnd = mulberry(1234);
      // Fine fibre noise plus soft blotches, like uncoated stock under a flat plate.
      const blot = new Float32Array(16 * 16);
      for (let i = 0; i < blot.length; i++) blot[i] = rnd();
      for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
        const bx = xx / 16, by = y / 16, ix = Math.floor(bx), iy = Math.floor(by);
        const fx = bx - ix, fy = by - iy;
        const q = (a, b) => blot[((b & 15) * 16) + (a & 15)];
        const sm = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
        const v = 255 - rnd() * 34 - sm * 16;
        const o = (y * 256 + xx) * 4;
        img.data[o] = v; img.data[o + 1] = v - 2; img.data[o + 2] = v - 6; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.grainPat = g.createPattern(c, 'repeat');
      this.grainCtx = g;
      return this.grainPat;
    },

    drawGlyphWord(g, word, x, y, u, t0, t, out, redLetter, colText, colRed, wordIdx) {
      let cx = x;
      for (let li = 0; li < word.length; li++) {
        const gl = GLYPHS[word[li]] || GLYPHS[' '];
        const gw = gl[0].length;
        g.fillStyle = li === redLetter ? colRed : colText;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < gw; c++) {
            if (gl[r][c] !== '#') continue;
            const delay = li * 0.07 + wordIdx * 0.18 + r * 0.03 + c * 0.015;
            let e = clamp((t - t0 - delay) / 0.2, 0, 1);
            e = easeOut(e);
            if (out) e = 1 - e;
            if (e <= 0.001) continue;
            // Cells drop in from above like type being set; they leave downward.
            const hh = u * e;
            const yy = out ? y + r * u + (u - hh) : y + r * u;
            g.fillRect(cx + c * u - 0.3, yy - 0.3, u + 0.6, hh + 0.6);
          }
        }
        cx += (gw + 1) * u;
      }
    },

    draw(p, signals, params, ctx) {
      if (!this.root) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height;
      const pr = PRINTS[clamp(Math.round(params.print), 0, PRINTS.length - 1)];
      const inks = pr.inks;

      // ---- layout: panel square plus type block, landscape or stacked
      const m = Math.min(W, H) * 0.06;
      const land = W / H >= 1.3;
      let S, px, py, tx, ty, tw, th_;
      if (land) {
        S = H - 2 * m; px = m; py = m;
        tx = px + S + m * 1.1; ty = m; tw = W - tx - m; th_ = H - 2 * m;
      } else {
        S = Math.min(W - 2 * m, H * 0.64); px = (W - S) / 2; py = m;
        tx = m; ty = py + S + m * 0.8; tw = W - 2 * m; th_ = H - ty - m;
      }
      this.S = S;
      this.th = S * 0.021;

      // ---- music
      const ev = this.analyse(signals, t, dt, params);
      const kicksRecent = t - this.lastKick < 2.2;
      if (!this.drop && this.low > 30) { this.drop = true; this.onDrop(t, params, true); }
      else if (this.drop && this.low < 16) { this.drop = false; this.onDrop(t, params, false); }
      this.tier = this.drop ? 2 : kicksRecent ? 1 : 0;
      if (this.drop) this.hadDrop = true;
      const phase = this.drop ? 2 : kicksRecent ? 1 : this.hadDrop ? 3 : 0;
      if (phase !== this.phase) {
        this.phase = phase;
        for (let i = 0; i < 4; i++) twSet(this.rowHl[i], i === phase ? 1 : 0, t, 0.6, i === phase ? 0.2 : 0, easeInOut);
      }

      const tiltMode = Math.round(params.tilt);
      const want = tiltMode === 1 ? 0 : tiltMode === 2 ? Math.PI / 4 : (this.drop ? Math.PI / 4 : 0);
      if (Math.abs(this.angle.to - want) > 1e-3) twSet(this.angle, want, t, want > this.angle.to ? 1.25 : 2.2, 0, easeInOut);
      const ang = twGet(this.angle, t);
      this.cosA = Math.cos(ang); this.sinA = Math.sin(ang);
      this.L = S * (Math.abs(this.cosA) + Math.abs(this.sinA));

      if (this.wantReset) {
        this.wantReset = false;
        this.build(t, Math.round((this.tier >= 2 ? 14 : 8) * params.density), true);
      }

      this.lay(this.root, 0, 0, 1, 1, t, false);
      if (ev.kick) {
        this.onKick(t, params);
        if (params.reaction > 1.5 && this.kickCount % 4 === 1) this.onKick(t, params);
      }
      if (ev.snare) this.restructure(t, params, true);
      const motion = params.motion;
      const tgt = Math.round((this.tier >= 2 ? 15 : this.tier === 1 ? 10 : 7) * params.density);
      const nVis = this.leaves().filter((l) => this.vis(l, -S * 0.04)).length;
      const off = Math.abs(nVis - tgt) > 2 ? 0.9 : 0;
      this.structClock += dt * motion * (0.35 + 0.5 * this.energy + off);
      if (this.structClock > 1) { this.structClock = 0; this.restructure(t, params, false); }
      this.padEnv = (this.padEnv || 0) + (((signals[2] + signals[3]) / 200) - (this.padEnv || 0)) * (1 - Math.exp(-dt / 0.8));
      this.driftClock += dt * motion * (0.3 + 0.6 * this.padEnv + 0.3 * this.energy);
      if (this.driftClock > 1) { this.driftClock = 0; this.slide(t, 3.0, 0.07); }
      // In the quiet, colour goes home: down to two cells briskly, then to one.
      if (this.tier === 0) {
        const col = this.leaves().filter((q) => q.col >= 0 && !q.draining).sort((a, b) => a.born - b.born);
        this.quietClock = (this.quietClock || 0) + dt;
        if (col.length > 2 && this.quietClock > 1.3) { this.quietClock = 0; this.drain(col[0], t, 0); }
        else if (col.length > 1 && this.quietClock > 7) { this.quietClock = 0; this.drain(col[0], t, 0); }
      } else this.quietClock = 0;
      this.reap(t);
      this.lay(this.root, 0, 0, 1, 1, t, false);
      // A tilt doubles every cell's area; colour that has grown past a poster's
      // proportion (a sixth of the panel) goes home rather than dominating.
      for (const l of this.leaves()) {
        if (l.col >= 0 && !l.draining && twDone(l.fill, t) && this.area(l) * this.L * this.L > 0.16 * S * S) this.drain(l, t, 0.3);
      }

      // Streets: the drop turns up to three long bars into Boogie-Woogie lanes.
      const nStreets = this.tier >= 2 && params.traffic > 0.01 ? (params.traffic > 1.4 ? 4 : 3) : 0;
      const splitsNow = this.splits();
      const streets = splitsNow.filter((s) => s.street.to > 0.5 && !s.dying);
      for (const s of splitsNow) if (s.dying && s.street.to > 0) twSet(s.street, 0, t, 0.3);
      if (streets.length > nStreets) twSet(streets[0].street, 0, t, 1.0);
      else if (streets.length < nStreets) {
        const cand = splitsNow.filter((s) => !s.dying && s.street.to < 0.5 && twDone(s.grow, t) && s.th === 1)
          .map((s) => ({ s, len: s.dir === 0 ? s.r[3] - s.r[1] : s.r[2] - s.r[0] }))
          .filter((o) => o.len * this.L > S * 0.45)
          .sort((a, b) => b.len - a.len);
        if (cand.length) twSet(cand[Math.floor(this.rng() * Math.min(3, cand.length))].s.street, 1, t, 0.8);
      }
      const speed = S * (0.035 + 0.11 * this.energy + 0.05 * this.hatSlow + 0.06 * this.bassEnv) * (0.4 + 0.6 * motion) * (0.5 + 0.5 * params.traffic);
      this.flow += dt * speed;
      this.breath += dt * motion * (0.5 + 1.4 * this.energy + 0.5 * this.padEnv);

      // Headline cycling: re-set on section changes and every 32 kicks in a drop.
      const custom = (params.words || '').toUpperCase().trim();
      if (this.drop && this.kickCount - this.headSince >= 32) {
        this.headSince = this.kickCount; this.setHead((this.head.i + 1) % HEADS.length, t);
      }

      // Colour bar: shares of red, blue and yellow follow what's in play.
      const want3 = this.tier >= 2 ? [0.42, 0.22, 0.36] : this.tier === 1 ? [0.7, 0.3, 0] : [1, 0, 0];
      for (let i = 0; i < 3; i++) if (Math.abs(this.bar[i].to - want3[i]) > 1e-3) twSet(this.bar[i], want3[i], t, 1.1, i * 0.12, easeInOut);

      // ---- paint
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = pr.paper;
      g.fillRect(-2, -2, W + 4, H + 4);

      // Panel
      g.save();
      g.beginPath(); g.rect(px, py, S, S); g.clip();
      g.fillStyle = pr.panel; g.fillRect(px, py, S, S);
      g.translate(px + S / 2, py + S / 2);
      const L = this.L, th = this.th;
      const X = (u) => (u - 0.5) * L;

      // Colour plate, slightly out of register with the key plate.
      g.save();
      g.translate(1.5, -1.0);
      g.rotate(ang);
      const ins = th * 0.5 - 0.6;
      for (const l of this.leaves()) {
        if (l.col < 0) continue;
        const f = twGet(l.fill, t);
        if (f <= 0.001) continue;
        let x0 = X(l.r[0]) + ins, y0 = X(l.r[1]) + ins, x1 = X(l.r[2]) - ins, y1 = X(l.r[3]) - ins;
        if (x1 <= x0 || y1 <= y0) continue;
        const d = l.fillDir, dr = l.draining;
        // Fill wipes in from one edge; draining carries on out of the far edge.
        if (!dr) {
          if (d === 0) x1 = x0 + (x1 - x0) * f; else if (d === 1) x0 = x1 - (x1 - x0) * f;
          else if (d === 2) y1 = y0 + (y1 - y0) * f; else y0 = y1 - (y1 - y0) * f;
        } else {
          if (d === 0) x0 = x1 - (x1 - x0) * f; else if (d === 1) x1 = x0 + (x1 - x0) * f;
          else if (d === 2) y0 = y1 - (y1 - y0) * f; else y1 = y0 + (y1 - y0) * f;
        }
        g.fillStyle = inks[l.col];
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      g.restore();

      // Key plate: the bars.
      g.save();
      g.rotate(ang);
      const yellow = inks[YELLOW];
      const lineOf = (s) => {
        const r = s.r, pp = twGet(s.pos, t), gr = twGet(s.grow, t);
        const w = th * s.th;
        if (s.dir === 0) {
          const xs = X(lerp(r[0], r[2], pp));
          const a = X(r[1]) - th / 2, b = X(r[3]) + th / 2, len = (b - a) * gr;
          return { x: xs - w / 2, y: s.growFrom ? b - len : a, w: w, h: len, vert: true, a, b };
        }
        const ys = X(lerp(r[1], r[3], pp));
        const a = X(r[0]) - th / 2, b = X(r[2]) + th / 2, len = (b - a) * gr;
        return { x: s.growFrom ? b - len : a, y: ys - w / 2, w: len, h: w, vert: false, a, b };
      };
      const streetList = [];
      for (const s of splitsNow) {
        if (s.leaf) continue;
        const q = lineOf(s);
        const st = twGet(s.street, t);
        if (st > 0.01) streetList.push({ s, q, st });
        g.fillStyle = pr.line;
        g.fillRect(q.x, q.y, q.w, q.h);
      }
      // Streets over the black: yellow bars with traffic.
      const trafficInks = [inks[RED], inks[BLUE], inks[GREY], inks[RED], pr.panel];
      for (const o of streetList) {
        const { s, q, st } = o;
        g.globalAlpha = 1;
        g.fillStyle = yellow;
        // The yellow grows along the bar from one end as the street opens.
        if (q.vert) g.fillRect(q.x, q.y, q.w, q.h * st); else g.fillRect(q.x, q.y, q.w * st, q.h);
        const w = th * s.th;
        const sp = w * 2.3;
        const off = (this.flow * s.flowSign) + s.seed * 7.3;
        const len = (q.vert ? q.h : q.w) * st;
        const base = Math.floor(off / sp);
        const frac = off - base * sp;
        const n = Math.ceil(len / sp) + 2;
        for (let i = -1; i < n; i++) {
          const gi = i - base;                     // identity travels with the square
          const hsh = hash(gi * 1.37 + s.seed);
          if (hsh < 0.3) continue;                 // gaps: the rhythm of the lane
          const epoch = Math.floor((this.hatCount + Math.floor(hash(gi * 3.1 + s.seed) * 5)) / 5);
          const ci = Math.floor(hash(gi * 5.7 + epoch * 1.91 + s.seed) * 4);
          const big = hsh > 0.93;
          const sz = big ? w * (1.7 + 0.5 * this.bassEnv) : w * 0.92;
          const along = i * sp + frac;
          if (along < -sz || along > len + sz) continue;
          const pos0 = (q.vert ? q.y : q.x) + along;
          const lo = (q.vert ? q.y : q.x), hi = lo + len;
          const c0 = clamp(pos0 - sz / 2, lo, hi), c1 = clamp(pos0 + sz / 2, lo, hi);
          if (c1 - c0 <= 0.2) continue;
          const mid = q.vert ? q.x + w / 2 : q.y + w / 2;
          g.fillStyle = big ? (ci % 2 ? inks[BLUE] : inks[RED]) : trafficInks[ci];
          if (q.vert) g.fillRect(mid - sz / 2, c0, sz, c1 - c0); else g.fillRect(c0, mid - sz / 2, c1 - c0, sz);
          if (big) {
            // Broadway Boogie Woogie's nested blocks: a square inside the square.
            const s2 = sz * 0.42;
            const cc = (c0 + c1) / 2;
            g.fillStyle = ci % 2 ? yellow : pr.panel;
            if (q.vert) g.fillRect(mid - s2 / 2, cc - s2 / 2, s2, s2); else g.fillRect(cc - s2 / 2, mid - s2 / 2, s2, s2);
          }
        }
      }
      g.restore();
      g.restore();

      // ---- type block
      const colText = pr.text, colRed = inks[RED];
      const words = (h) => {
        if (h && h.custom) return h.custom;
        return HEADS[h.i].w;
      };
      let pair = HEADS[this.head.i], redL = pair.red;
      let W1 = words(this.head);
      if (custom) {
        const parts = custom.split(/\s+/).slice(0, 2);
        W1 = parts.length === 1 ? [parts[0]] : parts; redL = [-1, -1];
      }
      const maxUnits = Math.max(29, ...(custom ? W1 : HEADS.flatMap((h) => h.w)).map(wordUnits));
      const small = Math.max(9, tw * 0.028);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      try { g.letterSpacing = (small * 0.18).toFixed(1) + 'px'; } catch (e) { /* older canvas */ }
      g.fillStyle = colText;
      g.font = `700 ${small.toFixed(1)}px ${SANS}`;
      if (land) {
        const u = Math.min(tw / maxUnits, th_ / 26);
        let y = ty;
        // Masthead line: an invented periodical.
        g.fillText('No. 7', tx, y + small);
        g.textAlign = 'right';
        g.fillText('BLAD VOOR KLANK EN BEELD', tx + tw, y + small);
        g.textAlign = 'left';
        y += small * 1.7;
        g.fillRect(tx, y, tw, Math.max(2, u * 0.35));
        y += u * 1.7;
        const headY = y;
        if (this.prevHead && !custom) {
          const ph = this.prevHead.custom ? this.prevHead.custom : HEADS[this.prevHead.i].w;
          const pred = this.prevHead.custom ? [-1, -1] : HEADS[this.prevHead.i].red;
          ph.forEach((w, wi) => this.drawGlyphWord(g, w, tx, headY + wi * u * 6.4, u, this.prevHead.t0, t, true, pred[wi], colText, colRed, wi));
          if (t > this.prevHead.t0 + 1.5) this.prevHead = null;
        }
        W1.forEach((w, wi) => this.drawGlyphWord(g, w, tx, headY + wi * u * 6.4, u, this.head.t0, t, false, redL[wi], colText, colRed, wi));
        y = headY + u * 12.4;
        // The bar of primaries, re-dividing with what's in play.
        const bh = u * 1.25;
        let bx = tx;
        const shares = this.bar.map((b) => twGet(b, t));
        const tot = shares[0] + shares[1] + shares[2];
        const barCols = [inks[RED], inks[BLUE], inks[YELLOW]];
        for (let i = 0; i < 3; i++) {
          const bw = tw * shares[i] / tot;
          if (bw > 0.5) { g.fillStyle = barCols[i]; g.fillRect(bx, y, bw, bh); }
          bx += bw;
        }
        g.fillStyle = pr.line;
        bx = tx;
        for (let i = 0; i < 2; i++) { bx += tw * shares[i] / tot; if (shares[i] > 0.01 && shares[i + 1] > 0.01) g.fillRect(bx - u * 0.18, y, u * 0.36, bh); }
        y += bh + u * 1.6;
        g.fillStyle = colText;
        const mid = Math.max(12, tw * 0.052);
        g.font = `300 ${mid.toFixed(1)}px ${SANS}`;
        try { g.letterSpacing = (mid * 0.06).toFixed(1) + 'px'; } catch (e) { /* */ }
        g.fillText(custom ? 'muziek · licht · beweging' : pair.sub, tx, y + mid);
        // Foot: time and place, set flush to the bottom margin.
        const fy = ty + th_;
        // The programme: four rows, the current part of the night marked.
        const py0 = y + mid * 2.4, py1 = fy - small * 4.2;
        const rh = (py1 - py0) / PROGRAMME.length;
        if (rh > small * 1.9) {
          const rowInk = [pr.line, inks[BLUE], inks[RED], inks[YELLOW]];
          for (let i = 0; i < PROGRAMME.length; i++) {
            const ry = py0 + i * rh;
            const hl = twGet(this.rowHl[i], t);
            g.fillStyle = colText;
            g.fillRect(tx, ry, tw, Math.max(1, u * 0.12));
            const sq = rh * 0.42;
            const sy = ry + (rh - sq) / 2 + u * 0.06;
            // The marker square: a hairline box that fills and widens when its hour comes.
            g.fillStyle = rowInk[i];
            const wsq = sq * (1 + 1.6 * hl);
            g.fillRect(tx, sy, wsq, sq);
            if (hl < 0.999) {
              const inset = Math.max(1, u * 0.14);
              g.fillStyle = pr.paper;
              const k2 = 1 - hl;
              g.fillRect(tx + inset, sy + inset, (wsq - 2 * inset), (sq - 2 * inset) * k2);
            }
            g.fillStyle = colText;
            const base = sy + sq * 0.82;
            g.font = `700 ${small.toFixed(1)}px ${SANS}`;
            try { g.letterSpacing = (small * 0.18).toFixed(1) + 'px'; } catch (e) { /* */ }
            g.fillText(PROGRAMME[i][0], tx + sq * 2.6 + small * 0.8, base);
            g.font = `${hl > 0.5 ? 700 : 300} ${(small * 1.25).toFixed(1)}px ${SANS}`;
            try { g.letterSpacing = (small * 0.08).toFixed(1) + 'px'; } catch (e) { /* */ }
            g.fillText(PROGRAMME[i][1], tx + sq * 2.6 + small * 5.6, base);
          }
          g.fillStyle = colText;
          g.fillRect(tx, py1, tw, Math.max(1, u * 0.12));
        }
        g.font = `700 ${small.toFixed(1)}px ${SANS}`;
        try { g.letterSpacing = (small * 0.18).toFixed(1) + 'px'; } catch (e) { /* */ }
        g.fillText('ZATERDAG  23.00 — 06.00', tx, fy - small * 1.9);
        g.font = `300 ${small.toFixed(1)}px ${SANS}`;
        g.fillText('een avond van ritme, kleur en rechte lijnen', tx, fy);
        g.fillRect(tx + tw - u * 2.2, fy - u * 2.2 - small * 0.2, u * 2.2, u * 2.2);
      } else {
        // Stacked: headline words side by side under the panel.
        const u = Math.min(tw / (W1.reduce((a, w) => a + wordUnits(w), 0) + 3 * (W1.length - 1)), th_ / 12);
        let y = ty;
        let x = tx;
        W1.forEach((w, wi) => { this.drawGlyphWord(g, w, x, y, u, this.head.t0, t, false, redL[wi], colText, colRed, wi); x += (wordUnits(w) + 3) * u; });
        y += u * 6.3;
        const bh = u * 0.9;
        let bx = tx;
        const shares = this.bar.map((b) => twGet(b, t));
        const tot = shares[0] + shares[1] + shares[2];
        const barCols = [inks[RED], inks[BLUE], inks[YELLOW]];
        for (let i = 0; i < 3; i++) { const bw = tw * shares[i] / tot; if (bw > 0.5) { g.fillStyle = barCols[i]; g.fillRect(bx, y, bw, bh); } bx += bw; }
        y += bh + small * 1.6;
        g.fillStyle = colText;
        g.fillText('ZATERDAG  23.00 — 06.00', tx, y);
        g.textAlign = 'right';
        g.fillText(custom ? 'NO. 7' : pair.sub.toUpperCase(), tx + tw, y);
        g.textAlign = 'left';
      }
      try { g.letterSpacing = '0px'; } catch (e) { /* */ }

      // Paper grain printed over everything.
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = pr === PRINTS[0] ? 0.55 : 0.25;
      g.fillStyle = this.grain(g);
      g.fillRect(0, 0, W, H);
      g.restore();
    },

    onDrop(t, params, into) {
      if (into) {
        this.headSince = this.kickCount;
        this.setHead((this.head.i + 1) % HEADS.length, t);
        // A flurry of new bars as the panel turns.
        // A flurry of new bars while the panel turns, planned against the
        // tilted geometry (where every cell is twice the size) so the
        // counter-composition arrives busy rather than as three huge planes.
        const keep = [this.L, this.cosA, this.sinA];
        if (Math.round(params.tilt) !== 1) { this.cosA = this.sinA = Math.SQRT1_2; this.L = this.S * Math.SQRT2; }
        const target = Math.round(15 * params.density);
        for (let i = 0; i < 12; i++) {
          this.lay(this.root, 0, 0, 1, 1, t, true);
          const ls = this.leaves();
          if (ls.filter((l) => this.vis(l, -this.S * 0.04)).length >= target) break;
          const cand = ls.filter((l) => !l.draining && this.vis(l, -this.S * 0.1)
            && Math.min(l.r[2] - l.r[0], l.r[3] - l.r[1]) * this.L > this.S * 0.12)
            .sort((a, b) => this.area(b) - this.area(a));
          if (!cand.length) break;
          const l = cand[Math.floor(this.rng() * Math.min(2, cand.length))];
          this.split(l, t, 0.45, 0.15 + i * 0.09);
          if (this.minSide() < this.th * 2.2) this.unsplit(l);
        }
        [this.L, this.cosA, this.sinA] = keep;
      } else {
        this.setHead((this.head.i + 1) % HEADS.length, t);
      }
    },
  });
})();
