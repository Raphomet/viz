// Poster: Swiss kinetic typography. A white poster on a strict modular grid,
// printed in one black and one accent ink: a grotesque headline, a disc, rings
// of arcs, a field of small geometric tokens, rules, a halftone panel and a
// full-bleed ticker band. Everything lives in grid units and tweens between
// hand-built compositions, so a re-set is always animated, never cut.
//
// Music, each in its own place:
//   kick   one token snaps (slides along a grid line, turns a quarter) to a new cell
//   snare  the next token flips ink: black to accent, accent to black
//   bass   the disc swells; the pad turns the rings of arcs
//   hats   the halftone panel's dots grow in a travelling diagonal wave
//   drop   the whole poster re-sets into a new, busier composition (ticker,
//          arcs, eight tokens, halftone); the breakdown re-sets into a sparse one
// Plain Canvas 2D throughout: flat fills, no gradients, no glow.

(function () {
  const ACCENTS = [
    { name: 'Signal red', hex: '#E23A1E' },
    { name: 'Ultramarine', hex: '#2340C4' },
    { name: 'Orange', hex: '#F2661B' },
    { name: 'Racing green', hex: '#0E7248' },
  ];
  const PAPER = '#EEEAE0';
  const INK = '#161616';
  const FONT = '"Helvetica Neue", Helvetica, Arial, "Nimbus Sans", sans-serif';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 4);

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

  // A value that tweens from wherever it is now to a target. Re-sets retarget
  // mid-flight from the current value, so an interrupted move never jumps.
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

  // Compositions, in grid units (C columns by R rows). Written as fractions so
  // the same poster holds together at 16:9, square and portrait. `dense`
  // switches on the layers the drop adds.
  const TEMPLATES = [
    // Musica viva: disc and its rings upper right, headline along the foot.
    (C, R) => ({
      disc: { cx: 0.70 * C, cy: 0.40 * R, r: 0.25 * R },
      arcs: { cx: 0.70 * C, cy: 0.40 * R, r0: 0.30 * R, r1: 0.52 * R },
      head: { x: 0, y: R, len: 0.60 * C, hgt: 2.3, rot: 0 },
      ticker: { y: R - 3.4, h: 0.8 },
      field: { c0: 0, r0: 1.4, c1: Math.round(0.50 * C), r1: R - 3.5 },
      tone: { c: Math.round(0.66 * C), r: R - 2.3, w: C - Math.round(0.66 * C), h: 2.3 },
      rules: [{ x: 0, y: 1.1, len: C, w: 0 }, { x: Math.round(0.62 * C), y: R - 2.5, len: C - Math.round(0.62 * C), w: 1 }],
      capA: { x: 0, y: 0 }, capB: { x: C, y: 0 },
    }),
    // Vertical headline up the left edge; the disc sinks off the bottom right.
    (C, R) => ({
      disc: { cx: 0.76 * C, cy: 0.78 * R, r: 0.36 * R },
      arcs: { cx: 0.76 * C, cy: 0.78 * R, r0: 0.42 * R, r1: 0.68 * R },
      head: { x: 2.2, y: R, len: R, hgt: 2.2, rot: -Math.PI / 2 },
      ticker: { y: 0.15, h: 0.85 },
      field: { c0: 3, r0: 2.4, c1: Math.max(4, Math.round(0.52 * C)), r1: R },
      tone: { c: Math.round(0.56 * C), r: 1.6, w: Math.max(2, Math.round(0.28 * C)), h: 2 },
      rules: [{ x: 2.6, y: 1.6, len: C - 2.6, w: 0 }, { x: 2.6, y: R - 0.02, len: Math.round(0.5 * C) - 2.6, w: 1 }],
      capA: { x: 2.6, y: 1.7 }, capB: { x: C, y: 4.2 },
    }),
    // Headline across the top at full measure; disc low left; tokens to the right.
    (C, R) => ({
      disc: { cx: 0.24 * C, cy: 0.64 * R, r: 0.22 * R },
      arcs: { cx: 0.24 * C, cy: 0.64 * R, r0: 0.27 * R, r1: 0.44 * R },
      head: { x: 0, y: 2.6, len: C, hgt: 2.6, rot: 0 },
      ticker: { y: R - 1.0, h: 1.0 },
      field: { c0: Math.round(0.46 * C), r0: 3.3, c1: C, r1: R - 1.0 },
      tone: { c: Math.round(0.46 * C) - 3, r: 3.4, w: 3, h: 2.4 },
      rules: [{ x: 0, y: 3.0, len: C, w: 1 }, { x: Math.round(0.48 * C), y: R - 1.3, len: C - Math.round(0.48 * C), w: 0 }],
      capA: { x: 0, y: 3.2 }, capB: { x: C, y: 3.2 },
    }),
    // Big disc high centre, the headline set low across it; tokens and
    // halftone share the upper corners so nothing sits on the type.
    (C, R) => ({
      disc: { cx: 0.5 * C, cy: 0.42 * R, r: 0.30 * R },
      arcs: { cx: 0.5 * C, cy: 0.42 * R, r0: 0.35 * R, r1: 0.54 * R },
      head: { x: Math.round(0.06 * C), y: R - 1.25, len: C - 2 * Math.round(0.06 * C), hgt: 1.9, rot: 0 },
      ticker: { y: R - 0.95, h: 0.95 },
      field: { c0: 0, r0: 1.3, c1: Math.max(3, Math.round(0.3 * C)), r1: R - 3.5 },
      tone: { c: C - Math.max(2, Math.round(0.24 * C)), r: 1.4, w: Math.max(2, Math.round(0.24 * C)), h: 2.6 },
      rules: [{ x: 0, y: 1.1, len: C, w: 0 }, { x: Math.round(0.7 * C), y: R - 3.7, len: C - Math.round(0.7 * C), w: 1 }],
      capA: { x: 0, y: 0 }, capB: { x: C, y: 0 },
    }),
  ];

  const SHAPES = ['sq', 'disc', 'quarter', 'half', 'sq', 'ring', 'quarter', 'tri'];
  const N_TOKENS = 8;

  VIZ.register({
    id: 'poster',
    name: 'Poster',
    order: 401,

    params: [
      { key: 'words', label: 'Headline words', type: 'text', default: 'KLANG LICHT NACHT TANZ' },
      { key: 'accent', label: 'Second ink', type: 'select', options: ACCENTS.map((a) => a.name), default: 0 },
      { key: 'ground', label: 'Paper', type: 'select', options: ['White poster', 'Black poster', 'Accent poster'], default: 0 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'motion', label: 'Ticker & ring speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'tokens', label: 'Tokens in play', type: 'range', min: 2, max: 8, default: 8, step: 1 },
    ],

    actions: [
      { id: 'reset', label: 'Re-set the layout', run() { this.wantReset = true; } },
    ],

    gallery: {
      title: 'Poster',
      technique: 'Canvas 2D on a modular grid: every element stored in grid units and tweened between hand-built compositions; flat fills in two inks, fitted grotesque type with negative tracking, onset detection against the previous frame',
      brief: 'An International Typographic Style concert poster that keeps re-setting itself. Off-white paper, black and one red: a huge grotesque headline, a red disc ringed by Musica-Viva arcs that turn with the pad, a field of small squares, quarter-circles and half-discs, hairline rules, a halftone panel, and a full-bleed black ticker band of type sliding past. Each kick snaps one token to a new cell along a grid line; each snare flips the next token between black and red, so the build\'s snare roll ripples red across the field; the bass swells the disc; the hats run a diagonal wave through the halftone dots. The drop re-sets the whole poster into a new composition with the ticker, the rings and all eight tokens in play; the breakdown re-sets to a sparse sheet with just the headline, the disc and the captions. A small caption measures the tempo and counts bars.',
      lineage: [
        'Josef Müller-Brockmann\'s Musica Viva and Tonhalle posters (concentric arcs, a strict grid, grotesque type), Armin Hofmann, Wim Crouwel; the batch-04 brief\'s "Poster" entry.',
        'Built grid-first: a module from the short side, columns filling the long side, so every composition is written in grid fractions and holds at 16:9 and square. Four compositions, mirrored at random, cycled on every re-set (drop, breakdown, every 32 kicks in a long drop, every 20 s of quiet).',
        'Process: first render already read as a poster, but the drop crammed all tokens into two rows and the breakdown set tokens on the headline, so fields were widened, the second 2x2 token dropped and the centred composition rebuilt with the type low. Kick slides were biased to 2-5 cells along a line and the bar downbeat moves a second token, to read from across a room. Jolt at 640x360: calm, kickArea 0.10-0.11, ratio 1.48 (build 0.07).',
        'The kick is deliberately one small thing: a single one-module token snapping one to three cells along its row or column, with a quarter turn. The drop/breakdown switch is a slow follower of band 1 (the bass line exists only in the drop), with hysteresis.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.els) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastReset = 0;
      this.kickCount = 0; this.kickTimes = [];
      this.low = 0; this.dense = false; this.kd = 0;
      this.bassEnv = 0; this.padEnv = 0; this.hatEnv = 0; this.hatSlow = 0;
      this.tick = 0; this.ringAngle = 0;
      this.tplIndex = Math.floor(this.rng() * TEMPLATES.length);
      this.mirror = false; this.wordIndex = 0;
      this.flipPtr = 0; this.movePtr = 0; this.kicksSinceReset = 0;
      this.grid = null; this.wantReset = false;

      const T = (v) => Tw(v);
      const el = {
        disc: { cx: T(0), cy: T(0), r: T(0), pres: T(0) },
        arcs: { cx: T(0), cy: T(0), r0: T(0), r1: T(0), pres: T(0) },
        head: { x: T(0), y: T(0), len: T(0), hgt: T(0), rot: T(0), pres: T(0), word: '', next: '', swapAt: 0, wipe0: 0, wipeDur: 0 },
        ticker: { y: T(0), h: T(1), pres: T(0) },
        tone: { c: T(0), r: T(0), w: T(1), h: T(1), pres: T(0) },
        rules: [0, 1].map(() => ({ x: T(0), y: T(0), len: T(0), pres: T(0), w: 0 })),
        capA: { x: T(0), y: T(0), pres: T(0) },
        capB: { x: T(0), y: T(0), pres: T(0) },
        tokens: [],
      };
      for (let i = 0; i < N_TOKENS; i++) {
        el.tokens.push({
          shape: SHAPES[i], size: i === 0 ? 2 : 1,
          c: 0, r: 0, x: T(0), y: T(0), rot: T(0), pres: T(0),
          accent: i === 2 || i === 5, flipAt: -10,
        });
      }
      this.els = el;
      this.field = { c0: 0, r0: 0, c1: 4, r1: 4 };
    },

    words(params) {
      const w = String(params.words || '').trim().split(/[\s,]+/).filter(Boolean);
      return w.length ? w : ['KLANG'];
    },

    // Grid: a module from the short side, the long side filled with whole
    // modules and the slack split into the margins, so the columns always land
    // on whole cells whatever the aspect.
    makeGrid(W, H) {
      const S = Math.min(W, H);
      const margin = S * 0.06;
      const m = (S - 2 * margin) / 8;
      const C = Math.max(4, Math.floor((W - 2 * margin) / m + 1e-6));
      const R = Math.max(4, Math.floor((H - 2 * margin) / m + 1e-6));
      return { m, C, R, ox: (W - C * m) / 2, oy: (H - R * m) / 2, W, H };
    },

    reset(t, params, firstTime) {
      const { C, R } = this.grid;
      const L = TEMPLATES[this.tplIndex](C, R);
      const mir = this.mirror;
      const mx = (x) => (mir ? C - x : x);
      const e = this.els;
      const dense = this.dense;
      const dur = firstTime ? 0 : dense ? 1.1 : 1.6;
      const st = dense ? 0.05 : 0.08;
      let k = 0;
      const go = (tw, v, extra) => twSet(tw, v, t, dur, (k++ % 12) * st + (extra || 0));

      go(e.disc.cx, mx(L.disc.cx)); go(e.disc.cy, L.disc.cy); go(e.disc.r, L.disc.r * (dense ? 1 : 1.12)); go(e.disc.pres, 1);
      go(e.arcs.cx, mx(L.arcs.cx)); go(e.arcs.cy, L.arcs.cy); go(e.arcs.r0, L.arcs.r0); go(e.arcs.r1, L.arcs.r1);
      go(e.arcs.pres, dense ? 1 : 0.28);

      // The headline wipes out, changes word at the midpoint, wipes back in
      // at its new place, so the words never morph into each other.
      const h = e.head;
      const hx = mir ? (L.head.rot ? C - L.head.x + L.head.hgt : C - L.head.x - L.head.len) : L.head.x;
      const words = this.words(params);
      h.next = words[this.wordIndex % words.length];
      if (firstTime || !h.word) { h.word = h.next; }
      h.wipe0 = t; h.wipeDur = dur; h.swapAt = t + dur * 0.5;
      go(h.x, hx); go(h.y, L.head.y); go(h.len, L.head.len); go(h.hgt, L.head.hgt * (dense ? 1 : 1.15));
      go(h.rot, L.head.rot); go(h.pres, 1);

      go(e.ticker.y, L.ticker.y); go(e.ticker.h, L.ticker.h); go(e.ticker.pres, dense ? 1 : 0);
      const tc = mir ? C - L.tone.c - L.tone.w : L.tone.c;
      go(e.tone.c, tc); go(e.tone.r, L.tone.r); go(e.tone.w, L.tone.w); go(e.tone.h, L.tone.h);
      L.rules.forEach((rl, i) => {
        const r = e.rules[i];
        go(r.x, mir ? C - rl.x - rl.len : rl.x); go(r.y, rl.y); go(r.len, rl.len);
        go(r.pres, dense || i === 0 ? 1 : 0); r.w = rl.w;
      });
      go(e.capA.x, mir ? C - L.capA.x : L.capA.x); go(e.capA.y, L.capA.y); go(e.capA.pres, 1);
      go(e.capB.x, mir ? C - L.capB.x : L.capB.x); go(e.capB.y, L.capB.y); go(e.capB.pres, 1);
      this.capAlignA = mir ? 'right' : 'left';
      this.capAlignB = mir ? 'left' : 'right';

      // Tokens: redeal them into the new field on free cells.
      const f = L.field;
      let c0 = Math.round(mir ? C - f.c1 : f.c0), c1 = Math.round(mir ? C - f.c0 : f.c1);
      this.field = { c0, c1: Math.max(c0 + 2, c1), r0: Math.ceil(f.r0), r1: Math.max(Math.ceil(f.r0) + 2, Math.floor(f.r1)) };
      const taken = new Set();
      e.tokens.forEach((tok) => {
        const cell = this.freeCell(tok, taken, null);
        tok.c = cell.c; tok.r = cell.r;
        this.mark(tok, taken);
        go(tok.x, tok.c); go(tok.y, tok.r);
      });
      this.lastReset = t; this.kicksSinceReset = 0;
    },

    mark(tok, taken) {
      for (let i = 0; i < tok.size; i++) for (let j = 0; j < tok.size; j++) taken.add((tok.c + i) + ',' + (tok.r + j));
    },

    fits(tok, c, r, taken) {
      const f = this.field;
      if (c < f.c0 || r < f.r0 || c + tok.size > f.c1 || r + tok.size > f.r1) return false;
      for (let i = 0; i < tok.size; i++) for (let j = 0; j < tok.size; j++) if (taken.has((c + i) + ',' + (r + j))) return false;
      return true;
    },

    // A free cell for a token: near `from` (sliding along its row or column
    // when possible, which reads as a deliberate grid move) or anywhere.
    freeCell(tok, taken, from) {
      const f = this.field;
      const cands = [];
      for (let c = f.c0; c <= f.c1 - tok.size; c++) {
        for (let r = f.r0; r <= f.r1 - tok.size; r++) {
          if (!this.fits(tok, c, r, taken)) continue;
          let w = 1;
          if (from) {
            const dc = Math.abs(c - from.c), dr = Math.abs(r - from.r);
            if (dc + dr === 0) continue;
            const d = dc + dr;
            // Long slides along a grid line read best from across a room.
            w = (dc === 0 || dr === 0) ? 4 : 0.5;
            if (d === 1) w *= 0.3;
            if (d > 5) w *= 0.2;
          }
          cands.push({ c, r, w });
        }
      }
      if (!cands.length) return from ? { c: from.c, r: from.r } : { c: f.c0, r: f.r0 };
      let tot = 0; for (const q of cands) tot += q.w;
      let x = this.rng() * tot;
      for (const q of cands) { x -= q.w; if (x <= 0) return q; }
      return cands[cands.length - 1];
    },

    activeCount(params) {
      // The build brings tokens in as the kick arrives; the drop has them all.
      const maxN = Math.round(clamp(params.tokens, 2, N_TOKENS));
      const n = this.dense ? maxN : 2 + Math.round(this.kd * 3);
      return Math.min(maxN, n);
    },

    onKick(t, params) {
      const e = this.els;
      const n = this.activeCount(params);
      const tok = e.tokens[this.movePtr % n];
      this.movePtr = (this.movePtr + 1 + (this.rng() < 0.3 ? 1 : 0)) % Math.max(1, n);
      const taken = new Set();
      e.tokens.forEach((o, i) => { if (o !== tok && i < n) this.mark(o, taken); });
      const cell = this.freeCell(tok, taken, { c: tok.c, r: tok.r });
      tok.c = cell.c; tok.r = cell.r;
      const snap = 0.07 + 0.08 / (0.5 + params.reaction);
      twSet(tok.x, cell.c, t, snap, 0, easeOut);
      twSet(tok.y, cell.r, t, snap, 0, easeOut);
      if (tok.shape !== 'sq' && tok.shape !== 'disc' && tok.shape !== 'ring') {
        twSet(tok.rot, tok.rot.to + Math.PI / 2, t, snap * 1.3, 0, easeOut);
      }
    },

    onSnare(t, params) {
      const n = this.activeCount(params);
      const tok = this.els.tokens[this.flipPtr % n];
      this.flipPtr = (this.flipPtr + 1) % Math.max(1, n);
      tok.accent = !tok.accent; tok.flipAt = t;
    },

    analyse(s, t, dt, params) {
      const b0 = s[0], b1 = s[1], b4 = s[4];
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++; this.kicksSinceReset++;
        this.kickTimes.push(t); if (this.kickTimes.length > 9) this.kickTimes.shift();
        this.kd = Math.min(1, this.kd + 0.18);
        this.onKick(t, params);
        // The first beat of each bar moves a second token, so the bar is felt.
        if (this.dense && this.kickCount % 4 === 1) this.onKick(t, params);
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.09) {
        this.lastSnare = t; this.onSnare(t, params);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.kd *= Math.exp(-dt / 2.5);
      this.low += (b1 - this.low) * k(0.9);
      const bass = Math.max(b0, b1) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.03) : k(0.22));
      const pad = (s[2] + s[3]) / 200;
      this.padEnv += (pad - this.padEnv) * k(0.6);
      const hat = s[8] / 100;
      this.hatEnv += (hat - this.hatEnv) * (hat > this.hatEnv ? k(0.01) : k(0.07));
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(1.5);
    },

    bpm(t) {
      const kt = this.kickTimes;
      if (kt.length < 4 || t - kt[kt.length - 1] > 3) return null;
      const iv = [];
      for (let i = 1; i < kt.length; i++) iv.push(kt[i] - kt[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[iv.length >> 1];
      return med > 0.2 && med < 1.5 ? Math.round(60 / med) : null;
    },

    draw(p, signals, params, ctx) {
      if (!this.els) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height;

      const g0 = this.grid;
      if (!g0 || Math.abs(g0.W - W) > 0.5 || Math.abs(g0.H - H) > 0.5) {
        const g = this.makeGrid(W, H);
        const changed = !g0 || g0.C !== g.C || g0.R !== g.R;
        this.grid = g;
        if (changed) this.reset(t, params, true);
      }

      this.analyse(signals, t, dt, params);

      // Section changes and the slow clock of re-sets.
      let resetNow = false;
      if (!this.dense && this.low > 27) { this.dense = true; resetNow = true; }
      else if (this.dense && this.low < 19) { this.dense = false; resetNow = true; }
      else if (this.dense && this.kicksSinceReset >= 32) resetNow = true;
      else if (!this.dense && t - this.lastReset > 20 && t - this.lastKick > 4) resetNow = true;
      if (this.wantReset) { this.wantReset = false; resetNow = true; }
      if (resetNow) {
        this.tplIndex = (this.tplIndex + 1 + (this.rng() < 0.3 ? 1 : 0)) % TEMPLATES.length;
        this.mirror = this.rng() < 0.5;
        this.wordIndex++;
        this.reset(t, params, false);
      }

      const react = params.reaction;
      const motion = params.motion;
      const energy = clamp(this.low / 45, 0, 1);
      this.tick += dt * motion * (0.35 + 1.4 * energy + 0.3 * this.hatSlow);
      this.ringAngle += dt * motion * (0.05 + 0.35 * this.padEnv + 0.15 * energy);

      const acc = ACCENTS[clamp(Math.round(params.accent), 0, ACCENTS.length - 1)].hex;
      const mode = Math.round(params.ground);
      const col = mode === 1 ? { ground: '#121212', ink: PAPER, hi: acc, rev: '#121212' }
        : mode === 2 ? { ground: acc, ink: INK, hi: PAPER, rev: acc }
          : { ground: PAPER, ink: INK, hi: acc, rev: PAPER };

      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.fillStyle = col.ground;
      c2.fillRect(-2, -2, W + 4, H + 4);

      const { m, ox, oy } = this.grid;
      const X = (c) => ox + c * m;
      const Y = (r) => oy + r * m;
      const e = this.els;
      const V = (tw) => twGet(tw, t);

      // Halftone panel, clipped to its rectangle; the hats send a diagonal
      // wave of larger dots through it.
      {
        const tone = e.tone;
        const pres = clamp(0.25 + this.hatSlow * 3, 0, 1);
        const x0 = X(V(tone.c)), y0 = Y(V(tone.r)), w = V(tone.w) * m, h = V(tone.h) * m;
        if (pres > 0.01 && w > 2 && h > 2) {
          c2.save();
          c2.beginPath(); c2.rect(x0, y0, w, h * pres); c2.clip();
          c2.fillStyle = col.ink;
          const sp = m / 4;
          const nx = Math.ceil(w / sp), ny = Math.ceil(h / sp);
          const hat = clamp(this.hatEnv * (0.6 + 0.6 * react), 0, 1.2);
          const ph = t * 2.2;
          c2.beginPath();
          for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
              const d = (i + j) / (nx + ny);
              const wave = 0.5 + 0.5 * Math.sin(d * 9 - ph * 3);
              const rr = sp * 0.5 * clamp(0.12 + 0.1 * this.padEnv + 0.95 * hat * wave, 0.05, 1.0);
              const cx = x0 + (i + 0.5) * sp, cy = y0 + (j + 0.5) * sp;
              c2.moveTo(cx + rr, cy); c2.arc(cx, cy, rr, 0, Math.PI * 2);
            }
          }
          c2.fill();
          c2.restore();
        }
      }

      // Rings of arcs around the disc; each ring its own length and speed.
      {
        const a = e.arcs;
        const pres = V(a.pres);
        if (pres > 0.01) {
          const cx = X(V(a.cx)), cy = Y(V(a.cy));
          const r0 = V(a.r0) * m, r1 = V(a.r1) * m;
          const n = 6;
          const step = (r1 - r0) / (n - 1);
          c2.lineCap = 'butt';
          c2.lineWidth = step * 0.5;
          for (let i = 0; i < n; i++) {
            const span = (0.55 + 0.35 * ((i * 0.618) % 1)) * Math.PI * pres;
            const dir = i % 2 ? -1 : 1;
            const a0 = i * 1.9 + dir * this.ringAngle * (0.6 + 0.25 * i);
            c2.strokeStyle = i === 3 ? col.hi : col.ink;
            c2.beginPath();
            c2.arc(cx, cy, r0 + i * step, a0, a0 + span);
            c2.stroke();
          }
        }
      }

      // The disc: the bass swells it.
      {
        const d = e.disc;
        const r = V(d.r) * m * V(d.pres) * (1 + (0.1 * this.bassEnv + 0.08 * this.padEnv) * react);
        c2.fillStyle = col.hi;
        c2.beginPath(); c2.arc(X(V(d.cx)), Y(V(d.cy)), Math.max(0, r), 0, Math.PI * 2); c2.fill();
      }

      // Rules: hairlines and one heavy bar, drawn on from their left end.
      e.rules.forEach((r) => {
        const len = V(r.len) * m * V(r.pres);
        if (len < 1) return;
        const hgt = r.w ? m * 0.16 : Math.max(1.2, m * 0.025);
        c2.fillStyle = r.w ? col.hi : col.ink;
        c2.fillRect(X(V(r.x)), Y(V(r.y)) - hgt / 2, len, hgt);
      });

      // Tokens.
      const nAct = this.activeCount(params);
      e.tokens.forEach((tok, i) => {
        const want = i < nAct ? 1 : 0;
        if (tok.presTarget !== want) {
          tok.presTarget = want;
          twSet(tok.pres, want, t, 0.5, i * 0.04, easeInOut);
        }
      });
      e.tokens.forEach((tok) => {
        const pres = V(tok.pres);
        if (pres < 0.01) return;
        const s = tok.size * m;
        const gap = m * 0.07;
        const x = X(V(tok.x)), y = Y(V(tok.y));
        const size = (s - 2 * gap) * pres;
        c2.save();
        c2.translate(x + s / 2, y + s / 2);
        c2.rotate(V(tok.rot));
        c2.fillStyle = tok.accent ? col.hi : col.ink;
        c2.strokeStyle = c2.fillStyle;
        const hs = size / 2;
        c2.beginPath();
        switch (tok.shape) {
          case 'sq': c2.rect(-hs, -hs, size, size); c2.fill(); break;
          case 'disc': c2.arc(0, 0, hs, 0, Math.PI * 2); c2.fill(); break;
          case 'quarter': c2.moveTo(-hs, hs); c2.arc(-hs, hs, size, -Math.PI / 2, 0); c2.closePath(); c2.fill(); break;
          case 'half': c2.moveTo(-hs, hs); c2.arc(0, hs, hs, Math.PI, 0); c2.closePath(); c2.fill();
            c2.fillRect(-hs, hs - size * 0.12, size, size * 0.12); break;
          case 'ring': c2.lineWidth = size * 0.2; c2.arc(0, 0, hs * 0.9, 0, Math.PI * 2); c2.stroke(); break;
          case 'tri': c2.moveTo(-hs, -hs); c2.lineTo(hs, hs); c2.lineTo(-hs, hs); c2.closePath(); c2.fill(); break;
        }
        c2.restore();
      });

      // Headline: fitted to its measure, tracked tight, wiped in and out.
      {
        const h = e.head;
        if (t >= h.swapAt && h.word !== h.next) h.word = h.next;
        const len = V(h.len) * m, hgt = V(h.hgt) * m;
        c2.font = '700 100px ' + FONT;
        try { c2.letterSpacing = '-4px'; } catch (err) { /* older canvas */ }
        const w100 = Math.max(1, c2.measureText(h.word).width);
        const fs = Math.max(4, Math.min((len / w100) * 100, hgt / 0.72));
        c2.font = '700 ' + fs.toFixed(1) + 'px ' + FONT;
        try { c2.letterSpacing = (-0.04 * fs).toFixed(1) + 'px'; } catch (err) { /* older canvas */ }
        const tw = c2.measureText(h.word).width;
        let wipe = 1;
        if (h.wipeDur > 0) {
          const u = clamp((t - h.wipe0) / h.wipeDur, 0, 1);
          wipe = u >= 1 ? 1 : Math.abs(1 - 2 * easeInOut(u));
        }
        wipe *= V(h.pres);
        if (wipe > 0.005) {
          c2.save();
          c2.translate(X(V(h.x)), Y(V(h.y)));
          c2.rotate(V(h.rot));
          c2.beginPath(); c2.rect(-2, -fs * 1.1, (tw + 4) * wipe, fs * 1.4); c2.clip();
          c2.fillStyle = col.ink;
          c2.textAlign = 'left'; c2.textBaseline = 'alphabetic';
          c2.fillText(h.word, 0, 0);
          c2.restore();
        }
        try { c2.letterSpacing = '0px'; } catch (err) { /* older canvas */ }
      }

      // Ticker: a full-bleed ink band with type sliding through it; its
      // speed follows the energy of the track, never a kick.
      {
        const tk = e.ticker;
        const pres = V(tk.pres);
        if (pres > 0.005) {
          const bh = V(tk.h) * m;
          const y = Y(V(tk.y));
          c2.fillStyle = col.ink;
          const bw = (W + 4) * pres;
          c2.fillRect(-2, y, bw, bh);
          c2.save();
          c2.beginPath(); c2.rect(-2, y, bw, bh); c2.clip();
          const fs = bh * 0.78;
          c2.font = '700 ' + fs.toFixed(1) + 'px ' + FONT;
          try { c2.letterSpacing = (-0.02 * fs).toFixed(1) + 'px'; } catch (err) { /* older canvas */ }
          const words = this.words(params);
          const str = words.join(' — ') + ' — ';
          const sw = Math.max(10, c2.measureText(str).width);
          const off = (this.tick * m * 1.2) % sw;
          c2.fillStyle = col.rev;
          c2.textAlign = 'left'; c2.textBaseline = 'alphabetic';
          for (let x = -off; x < W + 2; x += sw) c2.fillText(str, x, y + bh * 0.5 + fs * 0.36);
          c2.restore();
          try { c2.letterSpacing = '0px'; } catch (err) { /* older canvas */ }
        }
      }

      // Captions: small print. Tempo measured from the kicks; a bar count.
      {
        const fs = m * 0.21;
        c2.fillStyle = col.ink;
        c2.textBaseline = 'top';
        c2.font = '700 ' + fs.toFixed(1) + 'px ' + FONT;
        const a = e.capA, b = e.capB;
        const lines = ['Konzert', 'für Licht', 'und Klang'];
        c2.textAlign = this.capAlignA || 'left';
        lines.forEach((l, i) => c2.fillText(l, X(V(a.x)), Y(V(a.y)) + i * fs * 1.15));
        const bpm = this.bpm(t);
        const bar = Math.floor(this.kickCount / 4) + 1;
        c2.textAlign = this.capAlignB || 'right';
        c2.font = '400 ' + fs.toFixed(1) + 'px ' + FONT;
        c2.fillText((bpm ? bpm : '—') + ' BPM', X(V(b.x)), Y(V(b.y)));
        c2.fillText('Takt ' + String(bar).padStart(3, '0'), X(V(b.x)), Y(V(b.y)) + fs * 1.15);
        c2.fillText(this.dense ? 'Tutti' : 'Solo', X(V(b.x)), Y(V(b.y)) + fs * 2.3);
      }

      c2.restore();
    },
  });
})();
