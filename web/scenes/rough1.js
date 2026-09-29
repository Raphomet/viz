// Pencil Test: the animator's first exercise, the bouncing ball, shot as a
// pencil test on the peg bar. Everything on the page is redrawn by hand for
// every drawing, so every line boils; the drawings are shot on twos (twelve a
// second), and the last few stay on the light table as blue onion skins, so
// the spacing of the bounce (tight at the top, wide at the bottom) is laid
// out on the paper like a textbook plate.
//
// The medium: Rough.js has no memory. Given the same seed it draws the same
// wobbly line; given a new seed it draws the same shape again by a slightly
// different hand. That is exactly the "boil" of hand-drawn animation, so the
// piece is built on it: every drawing is a new seed, the onion skins keep the
// seed they were drawn with, and the frame rate of the drawings (on ones,
// twos, threes, or smooth) is a control.
//
// Music, each in its own place:
//   kick   the ball lands: contact is locked to the kick, and the squash on
//          the contact drawing is the kick's weight
//   clap   a red-pencil "ding" (a four-point star) is drawn over the ball
//          and stays on the path of action as it scrolls away
//   hats   the animator ticks the timing chart in the corner, one tick a hat
//   bass   the pencil presses harder: line weight and the hatching darken
//   drop   the cast grows (a heavy ball on the half-bar, a rubber ball on the
//          half-beat), the bounces go higher and faster, the coloured pencils
//          (blue col-erase and red) come in, more onion skins stay down, and
//          the hand gets looser
// Movement: the troupe travels left to right past a layout drawing (hills,
// trees, a fence) panned in three planes of parallax.

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
  // A drawable's op sets as cached Path2D objects, so a drawing made once can
  // be stroked every frame (and moved by the canvas transform) without asking
  // Rough.js again. kind: 0 outline, 1 solid fill, 2 fill sketch (hatching).
  function bake(d) {
    const out = [];
    // Rough's own canvas renderer fills curves, polygons and paths even-odd
    // and everything else non-zero; an ellipse's sketchy outline overlaps
    // itself, so even-odd would punch holes in it.
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
  // Rough.js treats seed 0 as "use Math.random", so seeds are kept positive.
  const seedOf = (a, b, c) => ((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 1) % 2147483000 + 1;

  const PAPERS = [
    { name: 'Animation bond', paper: '#F1ECE0', tooth: 0.05, graphite: '#34343A', blue: '#4F7FC4', red: '#D24A36', guide: '#AFC2DE' },
    { name: 'Newsprint pad', paper: '#E4DAC3', tooth: 0.08, graphite: '#2B2926', blue: '#4A6FA3', red: '#BF4228', guide: '#BDB49B' },
    { name: 'Storyboard grey', paper: '#D8D6D0', tooth: 0.06, graphite: '#26272B', blue: '#3F6DB0', red: '#C2402E', guide: '#A9B1BF' },
  ];
  const RATES = [
    { name: 'Smooth', hz: 0 },
    { name: 'On ones', hz: 24 },
    { name: 'On twos', hz: 12 },
    { name: 'On threes', hz: 8 },
  ];

  // The drop look, and so what "Follow the track" eases towards.
  const PRESETS = {
    calm: { cast: 0, bounce: 0.6, pace: 0, onion: 5, colour: 0.3, hand: 0.9 },
    drop: { cast: 1, bounce: 1.1, pace: 1, onion: 10, colour: 1, hand: 1.8 },
    // Held on threes, one ball, a long trail of skins: the textbook plate.
    plate: { cast: 0, bounce: 1, pace: 0, onion: 14, colour: 1, hand: 0.6, rate: 3, follow: 0 },
  };
  const DRIVE = ['cast', 'bounce', 'pace', 'onion', 'colour', 'hand'];

  // The troupe. off: place in the line (world units, relative to the camera
  // target); per: beats per bounce (main follows the pace control); h: bounce
  // height; r: radius; style: how the ball is drawn.
  const BALLS = [
    { off: 0, per: 0, h: 330, r: 44, style: 'shade', gate: -1 },
    { off: -270, per: 2, h: 150, r: 58, style: 'heavy', gate: 0.33 },
    { off: 250, per: 0.5, h: 170, r: 22, style: 'rubber', gate: 0.66 },
  ];
  const MAX_SKINS = 14;
  const GROUND = 0.85;          // ground line, fraction of the stage height

  VIZ.register({
    id: 'rough1',
    name: 'Pencil Test',
    order: 1101,

    params: [
      { key: 'cast', label: 'Balls on the page', type: 'range', min: 0, max: 1, default: PRESETS.calm.cast, step: 0.01 },
      { key: 'bounce', label: 'Bounce height', type: 'range', min: 0.3, max: 1.4, default: PRESETS.calm.bounce, step: 0.01 },
      { key: 'pace', label: 'Half time / on the beat', type: 'range', min: 0, max: 1, default: PRESETS.calm.pace, step: 0.01 },
      { key: 'onion', label: 'Onion skins', type: 'range', min: 0, max: MAX_SKINS, default: PRESETS.calm.onion, step: 1 },
      { key: 'colour', label: 'Coloured pencils', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'hand', label: 'Looseness of the hand', type: 'range', min: 0.2, max: 3, default: PRESETS.calm.hand, step: 0.01 },
      { key: 'rate', label: 'Drawings per second', type: 'select', options: RATES.map((r) => r.name), default: 2 },
      { key: 'paper', label: 'Paper', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'squash', label: 'Squash on the kick', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Pencil Test',
      technique: 'Rough.js 4.6.6 (loaded from jsDelivr) through its generator, on the p5 Canvas 2D context: every drawing on the page is regenerated with a new seed at the drawing rate (24, 12 or 8 a second, or every frame), which is the boil of hand-drawn animation; onion skins keep the seed they were drawn with and are cached as Path2D, so an old drawing stays exactly as it was drawn while the page scrolls. Balls are Rough ellipses squashed and stretched per drawing, shaded with a hachure-filled crescent polygon, a cross-hatch ball and a zigzag-filled ball; ground shadows are cross-hatched ellipses; the path of action is a dashed Rough curve; the layout is Rough curves, circles with zigzag-line fill and lines in three parallax planes.',
      brief: 'The bouncing-ball exercise shot as a pencil test on animation bond, graphite with blue col-erase and red pencil. The ball lands on every kick, squashing by how hard it hit; the last drawings stay down as blue onion skins so the spacing of the arc reads like a textbook plate. Claps draw a red "ding" star over the ball; hats tick the timing chart in the corner; the bass presses the pencil harder. On the drop a heavy cross-hatched ball and a small red rubber ball join, the bounces speed up to the beat and climb, the colours come in and the hand loosens, so every line boils harder. The troupe travels past a panned layout drawing of hills, trees and a fence.',
      lineage: [
        'Batch 08 (2026-09-29), Rough.js sketch 1 of 5: the boil as the subject.',
        'The bouncing ball, first exercise of every animation course (Richard Williams, The Animator\'s Survival Kit; Preston Blair), with its spacing charts, onion skins, field guide and peg holes.',
        'Pencil tests shot on twos on a line tester; the boiling line of hand-drawn animation (Bill Plympton, Frédéric Back, the "Squigglevision" of Dr. Katz).',
      ],
    },

    preload(p) {
      // In the app, fetch early but never hold the page for it; under the
      // harness hold p5's preload so captured frames show the drawing.
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      loadRough().catch((e) => console.warn('rough1: ' + e.message)).then(() => { if (hold) p._decrementPreload(); });
    },

    setup() {},
    enter() { loadRough().catch(() => {}); this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, hf: 0, hs: 0, hArm: true,
        bass: 0, low: 0, dropOn: false, auto: 0, lastK: -9, lastC: -9, lastH: -9 };
      this.x = 0;               // troupe position, world units
      this.cam = 0;
      this.balls = BALLS.map((b, i) => ({ ph: i * 0.37, tc: -9, amp: 0, vis: i === 0 ? 1 : 0, skins: [], paths: [] }));
      this.tick = -1;           // drawing number
      this.snap = null;
      this.dings = [];
      this.ticks = [];          // timing chart ticks this bar
      this.bar = 0;
      this.chunks = new Map();
      this.grain = null;
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
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, sg[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap, hat };
    },

    // A ball's pose at the current moment: centre, radii and height above
    // the ground, with squash on contact and stretch when moving fast.
    pose(i, P, groundY, react) {
      const B = BALLS[i], b = this.balls[i];
      const hMax = B.h * P.bounce;
      const u = b.ph;
      const hgt = 4 * u * (1 - u) * hMax;
      const since = this.clock - b.tc;
      const sq = b.amp * Math.exp(-since / 0.085) * react;
      // Stretch grows with vertical speed, which peaks at the ground.
      const speed = Math.abs(1 - 2 * u) * clamp01(hMax / 160);
      const st = 0.22 * speed * speed * (1 - clamp01(sq * 3));
      const rw = B.r * (1 + 0.5 * sq - 0.35 * st);
      const rh = B.r * (1 - 0.42 * sq + st);
      return { x: this.x + B.off, y: groundY - rh - hgt, rw, rh, hgt, hMax };
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
      const pal = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      p.background(pal.paper);
      this.paperTooth(g, W, H, pal);
      const R = window.rough;
      if (!R) return;
      if (!this.gen) this.gen = R.generator();
      const gen = this.gen;

      const groundY = H * GROUND;
      this.groundY = groundY;
      const react = params.squash;
      const onBeat = P.pace >= 0.5;
      const beatsMain = onBeat ? 1 : 2;
      const speed = lerp(150, 320, P.pace);   // world units a second
      this.x += speed * dt;

      // ---- the bounce clocks; contact is snapped to the kick
      for (let i = 0; i < BALLS.length; i++) {
        const B = BALLS[i], b = this.balls[i];
        const want = B.gate < 0 ? 1 : P.cast > B.gate ? 1 : 0;
        b.vis = ease(b.vis, want, want ? 3 : 2, dt);
        const per = (B.per || beatsMain) * BEAT;
        b.ph += dt / per;
        let contact = 0;
        if (hit.kick && b.ph > 0.55) { contact = 0.55 + 0.6 * hit.kick; b.ph = 0; }
        else if (b.ph >= 1) { b.ph -= 1; contact = 0.45; }
        if (contact) {
          b.tc = T; b.amp = contact * (B.style === 'heavy' ? 1.25 : 1);
          b.pathDue = true;
        }
      }
      // Hats tick the chart; a new bar clears it.
      const bar = Math.floor(T / (4 * BEAT));
      if (bar !== this.bar) { this.bar = bar; this.ticks.length = 0; }
      if (hit.hat && this.ticks.length < 16) this.ticks.push(this.ticks.length);

      // ---- drawing clock: a new drawing (and so a new seed everywhere)
      const rate = RATES[clamp(Math.round(params.rate), 0, RATES.length - 1)].hz;
      const boilHz = rate || 12;
      const boil = Math.floor(T * boilHz);
      const drawingTick = rate ? boil : Math.floor(T * 60);
      const newDrawing = drawingTick !== this.tick;
      const newBoil = boil !== this.boilIdx;
      this.boilIdx = boil;
      const hand = P.hand;
      const press = 1 + 0.9 * e.bass;

      const camTarget = this.x - W * 0.5;
      if (newDrawing || !this.snap) {
        this.tick = drawingTick;
        this.cam = camTarget;
        const poses = [];
        for (let i = 0; i < BALLS.length; i++) poses.push(this.pose(i, P, groundY, react));
        this.snap = { cam: this.cam, poses, boil };
        this.makeBallDrawings(gen, poses, boil, hand, pal);
      }
      if (newBoil) {
        // An onion skin is a drawing left on the light table: it keeps the
        // pose and the seed it was drawn with.
        const nSkin = Math.round(P.onion);
        for (let i = 0; i < BALLS.length; i++) {
          const b = this.balls[i];
          if (b.vis < 0.05) { b.skins.length = 0; continue; }
          const q = this.pose(i, P, groundY, react);
          b.skins.unshift({ x: q.x, y: q.y, rw: q.rw, rh: q.rh, baked: bake(gen.ellipse(0, 0, q.rw * 2, q.rh * 2,
            { roughness: hand * 0.8, bowing: 1, seed: seedOf(i, boil, 5) })) });
          if (b.skins.length > MAX_SKINS) b.skins.length = MAX_SKINS;
          b.skinN = nSkin;
        }
      }
      // Paths of action: one dashed arc per bounce, laid down at contact.
      for (let i = 0; i < BALLS.length; i++) {
        const B = BALLS[i], b = this.balls[i];
        if (!b.pathDue) continue;
        b.pathDue = false;
        if (b.vis < 0.3) continue;
        const per = (B.per || beatsMain) * BEAT;
        const stride = speed * per;
        const x0 = this.x + B.off, hMax = B.h * P.bounce;
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const u = k / 8;
          pts.push([x0 + stride * u, groundY - B.r - 4 * u * (1 - u) * hMax]);
        }
        b.paths.unshift({ pts, seed: seedOf(i, T * 100, 9), baked: null, boil: -1 });
        if (b.paths.length > 6) b.paths.length = 6;
      }
      if (hit.clap) {
        const q = this.pose(0, P, groundY, react);
        const s = 16 + 14 * hit.clap;
        this.dings.unshift({ x: q.x + 30, y: q.y - q.rh - 34, s, t: T, seed: seedOf(7, T * 100, 3), boil: -1, baked: null });
        if (this.dings.length > 10) this.dings.length = 10;
      }

      const S = this.snap;
      const col = P.colour;
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;

      // ---- the fixed page: field guide, peg holes, timing chart, slate
      this.drawPage(g, gen, W, H, pal, boil, hand, col, T);

      // ---- the layout, three planes of parallax
      const PLANES = [
        { par: 0.3, span: 640, kind: 'hills' },
        { par: 0.6, span: 380, kind: 'trees' },
        { par: 1.0, span: 300, kind: 'fence' },
      ];
      for (let li = 0; li < PLANES.length; li++) {
        const L = PLANES[li];
        const off = S.cam * L.par;
        const i0 = Math.floor(off / L.span) - 1, i1 = Math.floor((off + W) / L.span) + 1;
        g.save();
        g.translate(-off, 0);
        for (let ci = i0; ci <= i1; ci++) {
          const c = this.chunk(gen, li, L, ci, boil, hand, groundY, H);
          this.drawChunk(g, c, L, pal, col, press);
        }
        g.restore();
      }
      // Forget chunks well off the left edge.
      if (this.chunks.size > 60) {
        for (const [key, c] of this.chunks) if (c.boil < boil - 2) this.chunks.delete(key);
      }

      g.save();
      g.translate(-S.cam, 0);
      // Paths of action (blue, dashed), then red dings, then onion skins.
      g.setLineDash([5, 7]);
      for (let i = 0; i < BALLS.length; i++) {
        const b = this.balls[i];
        for (let k = 0; k < b.paths.length; k++) {
          const pa = b.paths[k];
          if (pa.boil !== boil) { pa.boil = boil; pa.baked = bake(gen.curve(pa.pts, { roughness: hand * 0.6, bowing: 0.5, seed: pa.seed + boil })); }
          g.globalAlpha = (0.25 + 0.55 * col) * (1 - k / 7) * b.vis;
          ink(g, pa.baked, pal.blue, 1.1, null, 0);
        }
      }
      g.setLineDash([]);
      for (let k = 0; k < this.dings.length; k++) {
        const d = this.dings[k];
        if (d.boil !== boil) {
          d.boil = boil;
          const s = d.s, a = 0.35 * s;
          const star = [[0, -s], [a, -a], [s, 0], [a, a], [0, s], [-a, a], [-s, 0], [-a, -a]];
          d.baked = bake(gen.polygon(star.map((q) => [d.x + q[0], d.y + q[1]]),
            { roughness: hand, seed: d.seed + boil, fill: '#000', fillStyle: 'zigzag', hachureGap: 3.5, hachureAngle: 30 }));
        }
        const age = T - d.t;
        g.globalAlpha = clamp01(age * 8) * (0.35 + 0.65 * col) * (1 - k / 11);
        ink(g, d.baked, pal.red, 1.4 * press, pal.red, 0.9);
      }
      for (let i = 0; i < BALLS.length; i++) {
        const b = this.balls[i];
        const n = Math.min(b.skins.length, Math.round(P.onion) + 1);
        for (let k = 1; k < n; k++) {
          const sk = b.skins[k];
          g.globalAlpha = (0.2 + 0.6 * col) * (1 - (k - 1) / (n + 1)) * b.vis;
          g.save();
          g.translate(sk.x, sk.y);
          ink(g, sk.baked, pal.blue, 1.1, null, 0);
          g.restore();
        }
      }
      // The current drawing: shadows, then balls.
      for (let i = 0; i < BALLS.length; i++) {
        const b = this.balls[i], d = this.ballDrw[i];
        if (!d || b.vis < 0.02) continue;
        const q = S.poses[i];
        g.globalAlpha = b.vis * clamp01(1.05 - q.hgt / (q.hMax + 60));
        ink(g, d.shadow, null, 0, pal.graphite, 0.7 * press);
      }
      for (let i = 0; i < BALLS.length; i++) {
        const b = this.balls[i], d = this.ballDrw[i];
        if (!d || b.vis < 0.02) continue;
        const B = BALLS[i];
        g.globalAlpha = b.vis;
        if (B.style === 'rubber') {
          const red = col > 0.15 ? pal.red : pal.graphite;
          ink(g, d.body, red, 1.5 * press, red, 1.0 * press);
        } else if (B.style === 'heavy') {
          ink(g, d.body, pal.graphite, 1.8 * press, pal.graphite, 0.8 * press);
        } else {
          ink(g, d.body, pal.graphite, 1.7 * press, null, 0);
          ink(g, d.shade, null, 0, pal.graphite, 0.85 * press);
          ink(g, d.hi, pal.graphite, 1.1, null, 0);
        }
      }
      g.restore();

      // Drawing number on the slate.
      g.globalAlpha = 0.75;
      g.fillStyle = pal.graphite;
      g.font = '15px "Special Elite", "Courier New", monospace';
      g.textAlign = 'right';
      g.textBaseline = 'alphabetic';
      g.fillText('SC 08   DWG ' + String(this.tick % 1000).padStart(3, '0'), W - 34, H - 22);
      g.restore();
    },

    // The current ball drawings, regenerated for every drawing.
    makeBallDrawings(gen, poses, boil, hand, pal) {
      this.ballDrw = [];
      for (let i = 0; i < BALLS.length; i++) {
        const B = BALLS[i], q = poses[i];
        const o = { roughness: hand, bowing: 1.2, seed: seedOf(i, boil, 1) };
        const d = {};
        if (B.style === 'heavy') {
          d.body = bake(gen.ellipse(q.x, q.y, q.rw * 2, q.rh * 2, Object.assign({ fill: '#000', fillStyle: 'cross-hatch', hachureGap: 5.5, hachureAngle: -35 }, o)));
        } else if (B.style === 'rubber') {
          d.body = bake(gen.ellipse(q.x, q.y, q.rw * 2, q.rh * 2, Object.assign({ fill: '#000', fillStyle: 'zigzag', hachureGap: 3.2, hachureAngle: 60 }, o)));
        } else {
          d.body = bake(gen.ellipse(q.x, q.y, q.rw * 2, q.rh * 2, o));
          // Shading: a crescent on the lower right, between the ball and a
          // copy of it nudged towards the light.
          const pts = [];
          const a0 = -0.55, a1 = a0 + Math.PI * 1.1;
          for (let k = 0; k <= 10; k++) {
            const a = lerp(a0, a1, k / 10);
            pts.push([q.x + Math.cos(a) * q.rw * 0.96, q.y + Math.sin(a) * q.rh * 0.96]);
          }
          const ox = -q.rw * 0.3, oy = -q.rh * 0.3;
          for (let k = 10; k >= 0; k--) {
            const a = lerp(a0 + 0.35, a1 - 0.35, k / 10);
            pts.push([q.x + ox + Math.cos(a) * q.rw * 0.95, q.y + oy + Math.sin(a) * q.rh * 0.95]);
          }
          d.shade = bake(gen.polygon(pts, { roughness: hand * 0.7, seed: seedOf(i, boil, 2), stroke: 'none',
            fill: '#000', fillStyle: 'hachure', hachureAngle: -48, hachureGap: 3.4 }));
          d.hi = bake(gen.arc(q.x - q.rw * 0.2, q.y - q.rh * 0.2, q.rw * 1.1, q.rh * 1.1, Math.PI * 1.05, Math.PI * 1.45, false,
            { roughness: hand * 0.6, seed: seedOf(i, boil, 3) }));
        }
        const sw = (B.r * 2.3) * (1.1 - 0.5 * clamp01(q.hgt / 260));
        d.shadow = bake(gen.ellipse(q.x, this.groundY || 0, sw, 9 + B.r * 0.12,
          { roughness: hand * 0.7, seed: seedOf(i, boil, 4), stroke: 'none', fill: '#000', fillStyle: 'cross-hatch', hachureGap: 2.6 }));
        this.ballDrw.push(d);
      }
    },

    // One chunk of one plane of the layout, redrawn when the boil ticks.
    chunk(gen, li, L, ci, boil, hand, groundY, H) {
      const key = li + ':' + ci;
      let c = this.chunks.get(key);
      if (c && c.boil === boil) return c;
      if (!c) {
        const rng = mulberry(seedOf(li, ci, 77));
        c = { boil: -1, items: [], def: null };
        const x0 = ci * L.span;
        if (L.kind === 'hills') {
          const pts = [];
          const base = groundY - 70;
          for (let k = 0; k <= 6; k++) {
            const x = x0 + (k / 6) * L.span;
            const hx = x / 170;
            pts.push([x, base - 60 - 45 * Math.sin(hx) - 25 * Math.sin(hx * 2.3 + 1)]);
          }
          c.def = { pts, cloud: rng() < 0.7 ? [x0 + rng() * L.span, H * (0.12 + 0.14 * rng()), 60 + 50 * rng()] : null };
        } else if (L.kind === 'trees') {
          const trees = [];
          const n = rng() < 0.5 ? 1 : 2;
          for (let k = 0; k < n; k++) trees.push([x0 + (k + 0.2 + 0.6 * rng()) * L.span / n, 38 + 26 * rng(), 50 + 40 * rng()]);
          c.def = { trees };
        } else {
          const posts = [];
          for (let x = 0; x < L.span; x += 75) posts.push(x0 + x + 6 * (rng() - 0.5));
          const tufts = [];
          for (let k = 0; k < 4; k++) tufts.push(x0 + rng() * L.span);
          c.def = { posts, tufts, x0 };
        }
        this.chunks.set(key, c);
      }
      c.boil = boil;
      const o = (id) => ({ roughness: hand, bowing: 1.4, seed: seedOf(ci * 5 + li, boil, id) });
      const D = c.def;
      c.items = [];
      if (L.kind === 'hills') {
        c.items.push({ ink: 'blue', w: 1.2, b: bake(gen.curve(D.pts, o(1))) });
        if (D.cloud) {
          const [cx, cy, cw] = D.cloud;
          c.items.push({ ink: 'blue', w: 1.0, b: bake(gen.ellipse(cx, cy, cw, cw * 0.32, o(2))) });
          c.items.push({ ink: 'blue', w: 1.0, b: bake(gen.ellipse(cx + cw * 0.28, cy - cw * 0.12, cw * 0.55, cw * 0.3, o(3))) });
        }
      } else if (L.kind === 'trees') {
        const gy = groundY - 26;
        for (let k = 0; k < D.trees.length; k++) {
          const [tx, tr, th] = D.trees[k];
          c.items.push({ ink: 'blue', w: 1.3, b: bake(gen.line(tx, gy, tx, gy - th, o(10 + k))) });
          c.items.push({ ink: 'blueFill', w: 1.2, b: bake(gen.circle(tx, gy - th - tr * 0.6, tr * 2,
            Object.assign(o(20 + k), { fill: '#000', fillStyle: 'zigzag-line', hachureGap: 7, hachureAngle: -20, zigzagOffset: 3 }))) });
        }
      } else {
        const x0 = D.x0;
        c.items.push({ ink: 'graphite', w: 1.6, b: bake(gen.line(x0 - 6, groundY, x0 + L.span + 6, groundY, o(1))) });
        const top = groundY - 58, rail = groundY - 42;
        c.items.push({ ink: 'soft', w: 1.1, b: bake(gen.line(x0, rail, x0 + L.span, rail, o(2))) });
        for (let k = 0; k < D.posts.length; k++) {
          const px = D.posts[k];
          c.items.push({ ink: 'soft', w: 1.2, b: bake(gen.line(px, groundY + 2, px, top, o(30 + k))) });
        }
        for (let k = 0; k < D.tufts.length; k++) {
          const tx = D.tufts[k];
          c.items.push({ ink: 'soft', w: 1, b: bake(gen.linearPath([[tx - 8, groundY + 1], [tx - 3, groundY - 11], [tx, groundY + 1], [tx + 4, groundY - 9], [tx + 8, groundY + 1]], o(50 + k))) });
        }
      }
      return c;
    },

    drawChunk(g, c, L, pal, col, press) {
      for (const it of c.items) {
        if (it.ink === 'graphite') { g.globalAlpha = 0.9; ink(g, it.b, pal.graphite, it.w * press, null, 0); }
        else if (it.ink === 'soft') { g.globalAlpha = 0.55; ink(g, it.b, pal.graphite, it.w, null, 0); }
        // The layout stays in soft graphite, so the blue belongs to the
        // onion skins and the paths of action.
        else if (it.ink === 'blueFill') { g.globalAlpha = 0.34; ink(g, it.b, pal.graphite, it.w, pal.graphite, 0.6); }
        else { g.globalAlpha = 0.38; ink(g, it.b, pal.graphite, it.w, null, 0); }
      }
    },

    // Field guide, peg holes and the timing chart: fixed to the paper, but
    // redrawn (and so boiling) with everything else.
    drawPage(g, gen, W, H, pal, boil, hand, col, T) {
      this.groundY = H * GROUND;
      if (!this.page || this.page.boil !== boil || this.page.W !== W) {
        const o = (id, extra) => Object.assign({ roughness: hand * 0.7, bowing: 0.8, seed: seedOf(900, boil, id) }, extra || {});
        const cx = W / 2, cy = H * 0.47;
        const guide = [];
        for (let k = 1; k <= 3; k++) {
          const fw = W * 0.32 * k, fh = H * 0.28 * k;
          guide.push(bake(gen.rectangle(cx - fw / 2, cy - fh / 2, fw, fh, o(k))));
        }
        guide.push(bake(gen.line(cx - 14, cy, cx + 14, cy, o(8))));
        guide.push(bake(gen.line(cx, cy - 14, cx, cy + 14, o(9))));
        const pegs = [];
        pegs.push(bake(gen.circle(cx - 150, 26, 16, o(20))));
        pegs.push(bake(gen.rectangle(cx - 22, 20, 44, 12, o(21))));
        pegs.push(bake(gen.circle(cx + 150, 26, 16, o(22))));
        // Timing chart: a bracket with a tick per hat.
        const tx = W - 250, ty = 64;
        const chart = [bake(gen.line(tx, ty, tx + 200, ty, o(30))), bake(gen.line(tx, ty - 9, tx, ty + 9, o(31))), bake(gen.line(tx + 200, ty - 9, tx + 200, ty + 9, o(32)))];
        this.page = { boil, W, guide, pegs, chart, ticks: [], tx, ty, nt: -1 };
      }
      const pg = this.page;
      if (pg.nt !== this.ticks.length || pg.tb !== boil) {
        pg.nt = this.ticks.length; pg.tb = boil;
        pg.ticks = [];
        for (let k = 0; k < this.ticks.length; k++) {
          // Spacing eases in towards the key, like a real chart.
          const u = 1 - Math.pow(1 - (k + 1) / 16, 1.6);
          const x = pg.tx + 200 * u;
          pg.ticks.push(bake(gen.line(x, pg.ty - 6, x, pg.ty + 6, { roughness: hand * 0.6, seed: seedOf(901, boil, k) })));
        }
      }
      g.globalAlpha = 0.5;
      for (const b of pg.guide) ink(g, b, pal.guide, 1, null, 0);
      g.globalAlpha = 0.55;
      for (const b of pg.pegs) ink(g, b, pal.graphite, 1.1, null, 0);
      g.globalAlpha = 0.35 + 0.55 * col;
      for (const b of pg.chart) ink(g, b, pal.red, 1.2, null, 0);
      for (const b of pg.ticks) ink(g, b, pal.red, 1.3, null, 0);
    },

    // Paper tooth: a small seeded noise tile laid as a pattern.
    paperTooth(g, W, H, pal) {
      if (!this.grain) {
        const c = document.createElement('canvas');
        c.width = c.height = 160;
        const t = c.getContext('2d');
        const img = t.createImageData(160, 160);
        const rng = mulberry(4242);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = rng() < 0.5 ? 0 : 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = Math.floor(rng() * 70);
        }
        t.putImageData(img, 0, 0);
        this.grain = g.createPattern(c, 'repeat');
      }
      g.save();
      g.globalAlpha = pal.tooth;
      g.fillStyle = this.grain;
      g.fillRect(0, 0, W, H);
      g.restore();
    },
  });
})();
