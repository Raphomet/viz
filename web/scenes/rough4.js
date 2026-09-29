// Chalk Garden: vines drawn in chalk climb a blackboard, and we climb with
// them. Stems are Rough.js curves through the points each tip has grown,
// leaves and petals are SVG paths handed to rough.path and hatched the way
// chalk is shaded, and the flowers open on the kick. The board keeps the
// ghosts of old lessons in its eraser smears; chalk dust falls from the tips.
//
// The medium: Rough.js draws curves (Catmull-Rom through points, with its
// curveTightness and curveFitting) and arbitrary SVG path data, including
// cubic and arc commands, with the same hand as its boxes and lines. So a
// garden, which is all curves, can be drawn entirely in its hand: stems, leaf
// silhouettes, petals and spiral tendrils, each filled in one of its fill
// styles (hachure leaves, zigzag petals, dots in the flower hearts,
// cross-hatch buds). A stroke broken by an irregular dash pattern stands in
// for chalk catching on the board.
//
// Music, each in its own place:
//   kick   a flower blooms on one stem near the tips (daisy, tulip or star,
//          each a different fill), springing open
//   clap   a tendril curls out from a stem as a spiral, drawn on as it grows
//   hats   chalk dust puffs from a growing tip and drifts down
//   bass   the chalk presses harder and the stems grow faster
//   drop   coloured chalks come out, more stems climb, the climb speeds up
//          and the flowers open bigger

(function () {
  'use strict';

  // Rough.js 4.6.6 (MIT, Preet Shihn), the IIFE build, which sets window.rough.
  const ROUGH_URL = 'https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js';
  function loadRough() {
    if (window.rough) return Promise.resolve(window.rough);
    if (!window.__vizRoughLoad) {
      window.__vizRoughLoad = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = ROUGH_URL;
        s.async = true;
        s.onload = () => (window.rough ? resolve(window.rough) : reject(new Error('rough.js loaded without a global')));
        s.onerror = () => { window.__vizRoughLoad = null; reject(new Error('could not load ' + ROUGH_URL)); };
        document.head.appendChild(s);
      });
    }
    return window.__vizRoughLoad;
  }
  // A drawable's op sets as cached Path2D objects (kind: 0 outline, 1 solid
  // fill, 2 fill sketch).
  function bake(d) {
    const out = [];
    // Rough's own renderer fills curves, polygons and paths even-odd and
    // everything else non-zero; a sketchy ellipse overlaps itself.
    const rule = d.shape === 'curve' || d.shape === 'polygon' || d.shape === 'path' ? 'evenodd' : 'nonzero';
    for (const s of d.sets) {
      const path = new Path2D();
      for (const o of s.ops) {
        const a = o.data;
        if (o.op === 'move') path.moveTo(a[0], a[1]);
        else if (o.op === 'bcurveTo') path.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
        else path.lineTo(a[0], a[1]);
      }
      out.push({ path, rule, kind: s.type === 'fillSketch' ? 2 : s.type === 'fillPath' ? 1 : 0 });
    }
    return out;
  }
  function ink(g, baked, line, lw, fill, fw) {
    for (const b of baked) {
      if (b.kind === 0) { if (line) { g.strokeStyle = line; g.lineWidth = lw; g.stroke(b.path); } }
      else if (b.kind === 2) { if (fill) { g.strokeStyle = fill; g.lineWidth = fw; g.stroke(b.path); } }
      else if (fill) { g.fillStyle = fill; g.fill(b.path, b.rule); }
    }
  }

  const BEAT = 60 / 124;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const backOut = (u) => { u = clamp01(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
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
  const seedOf = (a, b, c) => ((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 1) % 2147483000 + 1;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, u) => 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';

  const BOARDS = [
    { name: 'Slate green', board: '#26302B', smear: '#3A463F', chalk: '#ECEAE1', stem: '#A8D49A', leaf: '#8FC98A',
      petals: ['#F0A3B5', '#F2D774', '#9CC6E6', '#F4B07C', '#C9A8E4'], heart: '#F2D774' },
    { name: 'Black board', board: '#1D1F22', smear: '#2E3134', chalk: '#EDEDE8', stem: '#B6D9A6', leaf: '#9CCF94',
      petals: ['#F29BB0', '#F4DB7A', '#8FC0EA', '#F2A77A', '#BFA2EA'], heart: '#F4DB7A' },
    { name: 'Blue board', board: '#223244', smear: '#33465A', chalk: '#EEF1F2', stem: '#B1DDB0', leaf: '#9ED3A3',
      petals: ['#F6A6BD', '#F7E08A', '#FFFFFF', '#F7B585', '#D4B4F0'], heart: '#F7E08A' },
  ];

  // SVG path data, in local units: a leaf pointing along +x, and petals.
  const LEAF = 'M0 0 C 7 -9, 22 -11, 34 0 C 22 11, 7 9, 0 0 Z';
  const TULIP = 'M-14 0 C -16 -14, -10 -26, -6 -30 L -2 -20 L 3 -31 L 8 -20 L 12 -30 C 17 -24, 17 -10, 14 0 C 8 6, -8 6, -14 0 Z';
  const PETAL = 'M0 0 C 6 -5, 18 -7, 24 0 C 18 7, 6 5, 0 0 Z';

  const PRESETS = {
    calm: { colour: 0.15, stems: 3, climb: 0.45, bloom: 0.8, leaves: 0.6 },
    drop: { colour: 1, stems: 7, climb: 1.3, bloom: 1.35, leaves: 1 },
    // All white chalk, a thicket of stems, slow.
    lesson: { colour: 0, stems: 8, climb: 0.3, bloom: 1, leaves: 1, follow: 0 },
  };
  const DRIVE = ['colour', 'stems', 'climb', 'bloom', 'leaves'];

  const NODE = 22;              // stem point spacing, virtual units
  const CHUNK = 10;             // stem points per cached curve
  const MAX_STEMS = 9;
  const CHALK_DASH = [14, 1.6, 6, 1.1, 22, 2.2, 9, 0.9];

  VIZ.register({
    id: 'rough4',
    name: 'Chalk Garden',
    order: 1104,

    params: [
      { key: 'colour', label: 'Coloured chalk', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'stems', label: 'Stems climbing', type: 'range', min: 1, max: MAX_STEMS, default: PRESETS.calm.stems, step: 1 },
      { key: 'climb', label: 'Climb speed', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.climb, step: 0.01 },
      { key: 'bloom', label: 'Flower size', type: 'range', min: 0.4, max: 2, default: PRESETS.calm.bloom, step: 0.01 },
      { key: 'leaves', label: 'Leafiness', type: 'range', min: 0, max: 1, default: PRESETS.calm.leaves, step: 0.01 },
      { key: 'hand', label: 'Roughness', type: 'range', min: 0.2, max: 3, default: 1.1, step: 0.01 },
      { key: 'board', label: 'Board', type: 'select', options: BOARDS.map((q) => q.name), default: 0 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Chalk Garden',
      technique: 'Rough.js 4.6.6 (loaded from jsDelivr) through its generator, on the p5 Canvas 2D context. Stems are rough.curve through each growing tip\'s points, cached in ten-point chunks as Path2D and re-seeded now and then; leaves, tulips and petals are SVG path data (cubic and line commands) given to rough.path with hachure, zigzag and cross-hatch fills, drawn in local space and placed by the canvas transform with a spring-open scale; flower hearts use the dots fill; clap tendrils are Rough spiral curves revealed by an animated line-dash offset. Chalk breaks are an irregular dash pattern on every stroke; the board\'s eraser smears are a generated tile that scrolls with the climb.',
      brief: 'A garden drawn in chalk climbing a blackboard, with the view rising alongside the growing tips. Stems wander up, leaves hatch themselves in, and every kick opens a flower on a stem near the tips: a daisy of hachured petals, a zigzag tulip, a cross-hatched star, each with a dotted heart, springing open. Claps curl a spiral tendril off a stem, drawn on as it grows; hats knock a puff of chalk dust off a tip that drifts down the board; the bass presses the chalk harder and speeds the growth. In the calm it is white chalk and a few stems; on the drop the coloured chalks come out, more stems climb, faster, and the flowers open bigger.',
      lineage: [
        'Batch 08 (2026-09-29), Rough.js sketch 4 of 5: curves and SVG paths in the library\'s hand.',
        'Classroom blackboard drawing and chalk-talk botany (the wall charts of 19th-century botany lessons), café chalkboards, and the growing-vine algorithms of generative art.',
      ],
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      loadRough().catch((e) => console.warn('rough4: ' + e.message)).then(() => { if (hold) p._decrementPreload(); });
    },

    setup() {},
    enter() { loadRough().catch(() => {}); this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, hf: 0, hs: 0, hArm: true,
        bass: 0, low: 0, dropOn: false, auto: 0, lastK: -9, lastC: -9, lastH: -9 };
      this.camY = 0;
      this.stems = [];
      this.flowers = [];
      this.tendrils = [];
      this.dust = [];
      this.seq = 0;
      this.shapes = null;
      this.smear = null;
      this.warm = false;
    },

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
      if (e.hArm && hOn > 0.12 && T - e.lastH > 0.07) { hat = 1; e.hArm = false; e.lastH = T; }
      if (hOn < 0.05) e.hArm = true;
      e.bass = ease(e.bass, (sg[0] + sg[1] + sg[2]) / 300, 3, dt);
      e.low = ease(e.low, sg[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap, hat };
    },

    // Leaf, petal and bud shapes: a few seeds of each, re-seeded slowly.
    makeShapes(gen, hand, gen2) {
      const S = { leaf: [], petal: [], tulip: [], star: [], bud: [] };
      for (let k = 0; k < 6; k++) {
        const s = seedOf(k, gen2, 1);
        S.leaf.push(bake(gen.path(LEAF, { roughness: hand * 0.8, seed: s, fill: '#000', fillStyle: 'hachure', hachureAngle: 20 + k * 25, hachureGap: 3.2, fillWeight: 1 })));
        S.petal.push(bake(gen.path(PETAL, { roughness: hand * 0.8, seed: s + 1, fill: '#000', fillStyle: 'hachure', hachureAngle: 0, hachureGap: 3 })));
        S.tulip.push(bake(gen.path(TULIP, { roughness: hand * 0.8, seed: s + 2, fill: '#000', fillStyle: 'zigzag', hachureAngle: 80, hachureGap: 3.6 })));
      }
      for (let k = 0; k < 4; k++) {
        const s = seedOf(k, gen2, 2);
        const star = [];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 11 : 27;
          star.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        S.star.push(bake(gen.polygon(star, { roughness: hand * 0.7, seed: s, fill: '#000', fillStyle: 'cross-hatch', hachureGap: 3.4 })));
        S.bud.push(bake(gen.circle(0, 0, 16, { roughness: hand * 0.7, seed: s + 1, fill: '#000', fillStyle: 'dots', hachureGap: 3.2, fillWeight: 1.4 })));
      }
      return S;
    },

    newStem(T, x, y, heading, parent) {
      const id = ++this.seq;
      const rng = mulberry(seedOf(id, 3, 3));
      return { id, rng, pts: [[x, y]], tip: [x, y], head: heading, ph: rng() * TAU, wig: 0.5 + 0.8 * rng(),
        chunks: [], dist: 0, live: true, born: T, leaves: [], nodes: 0, parent: !!parent, speedMul: 0.8 + 0.4 * rng(), side: rng() < 0.5 ? -1 : 1 };
    },

    growStems(T, dt, P, W, H, climb, grow) {
      const top = this.camY, bottom = this.camY + H;
      // ---- stems: keep the wanted number growing
      const want = Math.round(P.stems);
      let live = this.stems.filter((s) => s.live);
      while (live.length < want) {
        // Plant where the board is emptiest.
        let x = W / 2, best = -1;
        for (let k = 0; k < 12; k++) {
          const cx = W * (0.14 + 0.72 * ((this.seq * 0.618 + k * 0.083) % 1));
          let dmin = W * 0.5;
          for (const q of live) dmin = Math.min(dmin, Math.abs(q.tip[0] - cx));
          // Prefer the middle of the board a little, so the edges do not
          // collect every new stem.
          const score = dmin - Math.abs(cx - W / 2) * 0.25;
          if (score > best) { best = score; x = cx; }
        }
        const s = this.newStem(T, x, bottom + 20, -Math.PI / 2 + (Math.sin(this.seq * 2.1) * 0.25), null);
        this.stems.push(s);
        live.push(s);
      }
      if (live.length > want) {
        // Retire the lowest tip: it finishes in a bud.
        live.sort((a, b) => b.tip[1] - a.tip[1]);
        const s = live[0];
        s.live = false;
        s.bud = { x: s.tip[0], y: s.tip[1], t: T, k: s.id % 4 };
      }
      for (const s of this.stems) {
        if (!s.live) continue;
        const sy = s.tip[1] - top;
        // Steer speed so tips gather around 32% from the top of the view.
        const lag = (sy - H * 0.32) / H;
        const v = climb * s.speedMul * grow * clamp(1 + 2.2 * lag, 0.25, 3.2) + 6;
        s.ph += dt * (0.7 + 0.5 * s.wig);
        let want = -Math.PI / 2 + Math.sin(s.ph) * 0.55 * s.wig + Math.sin(s.ph * 0.37 + s.id) * 0.3;
        // Keep off the edges.
        if (s.tip[0] < W * 0.1) want += 0.5;
        if (s.tip[0] > W * 0.9) want -= 0.5;
        // A branch leans away from its parent for a while.
        want += s.bias || 0;
        if (s.bias) s.bias *= 1 - 0.15 * dt;
        s.head = ease(s.head, want, 2.2, dt);
        s.tip[0] += Math.cos(s.head) * v * dt;
        s.tip[1] += Math.sin(s.head) * v * dt;
        s.dist += v * dt;
        if (s.dist >= NODE) {
          s.dist -= NODE;
          s.pts.push([s.tip[0], s.tip[1]]);
          s.nodes++;
          // Leaves at every other node, alternating sides.
          if (s.nodes % 2 === 0 && s.rng() < 0.4 + 0.6 * P.leaves) {
            s.side = -s.side;
            const a = s.head + s.side * (0.9 + 0.5 * s.rng());
            s.leaves.push({ x: s.tip[0], y: s.tip[1], a, sc: 1.05 + 0.6 * s.rng(), k: Math.floor(s.rng() * 6), t: T });
          }
          // Now and then a branch.
          if (s.nodes > 6 && s.rng() < 0.02 && this.stems.filter((q) => q.live).length < MAX_STEMS + 2) {
            const b = this.newStem(T, s.tip[0], s.tip[1], s.head + (s.rng() < 0.5 ? -0.8 : 0.8), s);
            b.speedMul *= 0.8;
          b.bias = (b.head > s.head ? 1 : -1) * 0.45;
            this.stems.push(b);
          }
          // Close a chunk when it is full: cache it; the open chunk is
          // regenerated as points arrive.
          if (s.pts.length - s.chunks.length * (CHUNK - 1) > CHUNK) {
            const i0 = s.chunks.length * (CHUNK - 1);
            s.chunks.push({ pts: s.pts.slice(i0, i0 + CHUNK), baked: null, gen: -1 });
          }
          s.open = null;
        }
      }
      // Stems wholly below the view are dropped; stems that never started are
      // cleaned up too.
      this.stems = this.stems.filter((s) => {
        const hi = Math.min(s.tip[1], s.pts.length ? Math.min(...s.pts.slice(-3).map((q) => q[1])) : s.tip[1]);
        return !(!s.live && hi > bottom + 60) && !(s.live && s.tip[1] > bottom + 400);
      });
      for (const s of this.stems) {
        if (s.pts.length > 400) { s.pts.splice(0, (CHUNK - 1) * 20); s.chunks.splice(0, 20); s.open = null; }
        s.leaves = s.leaves.filter((l) => l.y < bottom + 40);
      }
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.reset();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const T = this.clock;
      const e = this.env;
      const hit = this.listen(signals, dt, T);
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const pal = BOARDS[clamp(Math.round(params.board), 0, BOARDS.length - 1)];

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.3 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      p.background(pal.board);
      const R = window.rough;
      // The climb: the view rises steadily; stems are steered to keep their
      // tips in a band in the upper middle.
      const climb = 14 + 46 * P.climb;
      this.camY -= climb * dt;
      this.drawBoard(g, W, H, pal);
      if (!R) return;
      if (!this.gen) this.gen = R.generator();
      const gen = this.gen;
      const hand = params.hand;
      const shapeGen = Math.floor(T / 0.5);
      if (!this.shapes || this.shapes.g !== shapeGen || this.shapes.hand !== hand) {
        this.shapes = this.makeShapes(gen, hand, shapeGen);
        this.shapes.g = shapeGen; this.shapes.hand = hand;
      }
      const SH = this.shapes;
      const press = 1 + 0.8 * e.bass;
      if (!this.warm) {
        // Start with a garden already half way up the board.
        this.warm = true;
        for (let k = 0; k < 150; k++) { this.camY -= climb / 30; this.growStems(T, 1 / 30, P, W, H, climb, 1); }
      }
      this.growStems(T, dt, P, W, H, climb, 1 + 0.9 * e.bass);
      const top = this.camY, bottom = this.camY + H;

      // ---- events
      const tipsInView = this.stems.filter((s) => s.live && s.tip[1] > top + 20 && s.tip[1] < top + H * 0.75);
      if (hit.kick && tipsInView.length) {
        const s = tipsInView[Math.floor(((T * 7.7) % 1) * tipsInView.length)];
        // Bloom a little behind the tip, on the stem.
        const q = s.pts[Math.max(0, s.pts.length - 2)];
        const kind = (this.flowers.length + s.id) % 3;
        const petals = pal.petals;
        this.flowers.push({ x: q[0], y: q[1], t: T, kind, col: (this.flowers.length * 3 + s.id) % petals.length,
          n: 6 + (s.id % 4), rot: T * 1.7, size: P.bloom * (0.8 + 0.5 * hit.kick), k: s.id % 6 });
        if (this.flowers.length > 40) this.flowers.shift();
      }
      if (hit.clap) {
        const cands = this.stems.filter((s) => s.pts.length > 4);
        const vis = cands.filter((s) => { const q = s.pts[s.pts.length - 3]; return q[1] > top + H * 0.2 && q[1] < top + H * 0.8; });
        const pool = vis.length ? vis : cands;
        if (pool.length) {
          const s = pool[Math.floor(((T * 3.3) % 1) * pool.length)];
          const q = s.pts[s.pts.length - 3];
          const dir = (this.tendrils.length % 2) ? 1 : -1;
          const pts = [];
          const turns = 2.1, r0 = 40 + 14 * hit.clap;
          const a0 = s.head + dir * Math.PI / 2;
          // A spiral winding inwards, starting along the stem's normal.
          for (let i = 0; i <= 26; i++) {
            const u = i / 26;
            const a = a0 + dir * u * turns * TAU;
            const r = r0 * (1 - 0.85 * u);
            const cxs = q[0] + Math.cos(a0) * r0, cys = q[1] + Math.sin(a0) * r0;
            pts.push([cxs - Math.cos(a) * r, cys - Math.sin(a) * r]);
          }
          const d = gen.curve(pts, { roughness: hand * 0.7, seed: seedOf(this.tendrils.length, T * 60, 7), curveTightness: 0.1 });
          let len = 0;
          for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          this.tendrils.push({ baked: bake(d), len: len * 1.05, t: T, y: q[1] });
          if (this.tendrils.length > 16) this.tendrils.shift();
        }
      }
      if (hit.hat) {
        const s = tipsInView.length ? tipsInView[Math.floor(((T * 13.1) % 1) * tipsInView.length)] : null;
        if (s) {
          for (let k = 0; k < 7; k++) {
            const r = mulberry(seedOf(T * 100, k, 5));
            this.dust.push({ x: s.tip[0] + (r() - 0.5) * 14, y: s.tip[1] + (r() - 0.5) * 10, vx: (r() - 0.5) * 30, vy: -10 - r() * 25, t: T, s: 0.8 + r() * 1.6 });
          }
          if (this.dust.length > 220) this.dust.splice(0, this.dust.length - 220);
        }
      }

      // ---- draw
      const colour = P.colour;
      const chalk = hex(pal.chalk);
      const stemCol = mix(chalk, hex(pal.stem), colour * 0.9);
      const leafCol = mix(chalk, hex(pal.leaf), colour);
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalCompositeOperation = 'source-over';
      g.translate(0, -top);
      g.setLineDash(CHALK_DASH);

      // Stems: cached chunks, re-seeded every few seconds, plus the open
      // chunk and the last reach to the tip.
      const reseed = Math.floor(T / 1.5);
      g.globalAlpha = 0.85;
      for (const s of this.stems) {
        for (let ci = 0; ci < s.chunks.length; ci++) {
          const c = s.chunks[ci];
          const cy = c.pts[0][1];
          if (cy > bottom + 200 || c.pts[c.pts.length - 1][1] < top - 200) continue;
          const gi = reseed + ((ci * 7 + s.id) % 5 === 0 ? 1 : 0);
          if (c.gen !== gi) { c.gen = gi; c.baked = bake(gen.curve(c.pts, { roughness: hand, bowing: 1, seed: seedOf(s.id, ci, gi), curveFitting: 0.95 })); }
          ink(g, c.baked, stemCol, 3 * press, null, 0);
        }
        const i0 = s.chunks.length * (CHUNK - 1);
        const tail = s.pts.slice(i0);
        if (s.live) tail.push([s.tip[0], s.tip[1]]);
        if (tail.length >= 2) {
          if (!s.open || s.open.n !== tail.length) {
            s.open = { n: tail.length, baked: bake(tail.length > 2 ? gen.curve(tail, { roughness: hand, seed: seedOf(s.id, 999, s.chunks.length) })
              : gen.line(tail[0][0], tail[0][1], tail[1][0], tail[1][1], { roughness: hand, seed: seedOf(s.id, 998, s.nodes) })) };
          }
          ink(g, s.open.baked, stemCol, 3 * press, null, 0);
          if (s.live) {
            // The last reach from the cached curve to the moving tip.
            const q = tail[tail.length - 2];
            g.strokeStyle = stemCol;
            g.lineWidth = 3 * press;
            g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(s.tip[0], s.tip[1]); g.stroke();
          }
        }
      }
      g.setLineDash([]);

      // Leaves, growing in.
      for (const s of this.stems) {
        for (const l of s.leaves) {
          if (l.y < top - 40) continue;
          const gr = backOut((T - l.t) / 0.7);
          g.save();
          g.translate(l.x, l.y);
          g.rotate(l.a);
          g.scale(l.sc * gr, l.sc * gr);
          g.globalAlpha = 0.9;
          ink(g, SH.leaf[l.k], leafCol, 1.6, leafCol, 1.1 * press);
          g.restore();
        }
        if (s.bud && s.bud.y > top - 30) {
          g.save();
          g.translate(s.bud.x, s.bud.y);
          const gr = 1.4 * backOut((T - s.bud.t) / 0.6);
          g.scale(gr, gr);
          g.globalAlpha = 0.9;
          ink(g, SH.bud[s.bud.k], stemCol, 1.6, mix(chalk, hex(pal.heart), colour), 1.4);
          g.restore();
        }
      }
      // Tendrils: drawn on along their length.
      g.setLineDash([]);
      for (const td of this.tendrils) {
        if (td.y < top - 80 || td.y > bottom + 80) continue;
        const u = clamp01((T - td.t) / 0.9);
        const shown = td.len * (1 - Math.pow(1 - u, 2));
        g.setLineDash([shown, td.len * 2]);
        g.lineDashOffset = 0;
        g.globalAlpha = 0.85;
        ink(g, td.baked, stemCol, 1.8 * press, null, 0);
      }
      g.setLineDash([]);
      // Flowers: petals round a dotted heart, springing open.
      for (const f of this.flowers) {
        if (f.y < top - 80 || f.y > bottom + 80) continue;
        const gr = backOut((T - f.t) / 0.55) * f.size * 1.5;
        const pc = mix(chalk, hex(pal.petals[f.col]), colour);
        const hc = mix(chalk, hex(pal.heart), colour);
        g.save();
        g.translate(f.x, f.y);
        g.rotate(f.rot);
        g.scale(gr, gr);
        g.globalAlpha = 0.95;
        if (f.kind === 0) {
          for (let i = 0; i < f.n; i++) {
            g.save();
            g.rotate((i / f.n) * TAU);
            g.translate(6, 0);
            ink(g, SH.petal[(f.k + i) % 6], pc, 1.5, pc, 1.1);
            g.restore();
          }
          ink(g, SH.bud[f.k % 4], hc, 1.4, hc, 1.5);
        } else if (f.kind === 1) {
          g.rotate(-f.rot);
          ink(g, SH.tulip[f.k], pc, 1.6, pc, 1.1);
        } else {
          ink(g, SH.star[f.k % 4], pc, 1.6, pc, 1.0);
          g.scale(0.7, 0.7);
          ink(g, SH.bud[(f.k + 1) % 4], hc, 1.4, hc, 1.5);
        }
        g.restore();
      }
      // Chalk dust, drifting down the board.
      g.fillStyle = pal.chalk;
      for (let i = this.dust.length - 1; i >= 0; i--) {
        const d = this.dust[i];
        const age = T - d.t;
        if (age > 3.5) { this.dust.splice(i, 1); continue; }
        d.vy += 26 * dt;
        d.vx *= 1 - 1.5 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        g.globalAlpha = 0.75 * (1 - age / 3.5);
        g.fillRect(d.x, d.y, d.s, d.s);
      }
      g.restore();
    },

    // Eraser smears and old ghosts on the board: a generated tile scrolled
    // with the climb.
    drawBoard(g, W, H, pal) {
      if (!this.smear || this.smear.pal !== pal) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const t = c.getContext('2d');
        const rng = mulberry(2024);
        t.lineCap = 'round';
        t.filter = 'blur(7px)';
        for (let k = 0; k < 34; k++) {
          // A sweep of the eraser: a wide, soft, wandering stroke.
          let x = rng() * 512, y = rng() * 512, a = rng() * TAU;
          const n = 5 + Math.floor(rng() * 6), step = 18 + rng() * 22;
          const pts = [[x, y]];
          for (let i = 0; i < n; i++) { a += (rng() - 0.5) * 1.1; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); }
          t.strokeStyle = pal.smear;
          t.globalAlpha = 0.1 + 0.22 * rng();
          t.lineWidth = 14 + rng() * 46;
          for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
            t.beginPath();
            t.moveTo(pts[0][0] + ox, pts[0][1] + oy);
            for (const q of pts) t.lineTo(q[0] + ox, q[1] + oy);
            t.stroke();
          }
        }
        t.filter = 'none';
        // Chalk dust on the board: fine speckle.
        const img = t.getImageData(0, 0, 512, 512);
        for (let i = 0; i < img.data.length; i += 4) {
          if (rng() < 0.05) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 20 + rng() * 30; }
        }
        t.putImageData(img, 0, 0);
        this.smear = { pal, pat: g.createPattern(c, 'repeat') };
      }
      g.save();
      g.globalAlpha = 1;
      const off = ((-this.camY) % 512 + 512) % 512;
      g.translate(0, off - 512);
      g.fillStyle = this.smear.pat;
      g.fillRect(0, 0, W, H + 512);
      g.restore();
    },
  });
})();
