// Droste Garden — Iris's Droste pupil crossed with Bloom's mandala flowers,
// after the Psychonaut's proposal 3 (batch 06): "a slow zoom into a mandala
// flower whose pistil is a window onto another night garden, which contains
// another flower, forever".
//
// Each level is a round garden bed seen from above: matte ground, a rosette of
// leaves, a ring of small flowers, and a big mandala flower whose pistil is a
// circular window onto the next garden. The camera falls into the window
// forever; every garden is a fresh three-ink chord (Oil's rotating triads, the
// Psychonaut's cure for two-state longevity), so minute five keeps finding new
// harmonies. The fall is exponential zoom through nested clips, so it is the
// same image at every step and never seams: when a window has grown past the
// screen corners, its garden simply becomes the outermost one.
//
// Seen from above rather than in profile (Bloom's head-on flowers) because a
// top-down bed is radial all the way out, so the Droste twist (each level
// turned a little against its parent) reads as a spiral rather than a tilting
// horizon.
//
// Music, one place each:
// - kick: one petal ring on the flower in focus punches out and lightens,
//   the next ring each beat, so the beats walk outward through the flower;
// - clap: a puff of pollen sprays from the pistil and flies out at the viewer;
// - hats: the anthers glint and single grains drift off;
// - bass: petals breathe, leaves sway, the fall leans a little faster;
// - drop: the fall speeds up, more petal rings open until the flower fills its
//   bed, the chord goes from moonlit to full colour, the air fills with pollen
//   and the spiral twists harder. Every one of those is a param.
//
// Matte flat inks with real soft shadows (Mobile's lesson) rather than glow:
// the only light-on-dark is the pollen, which is small.
(function () {
  const TAU = Math.PI * 2;
  const P_WIN = 0.17;            // the pistil window's radius, in level units
  const Q = 1 / P_WIN;           // zoom per Droste step
  const LNQ = Math.log(Q);
  const PHRASE = 32 * 60 / 124;  // one phrase (8 bars) at 124 BPM, seconds

  // Chords: ground, leaf, outer petal, inner petal, accent (stamens, pollen).
  const NIGHT = [
    ['#0E1430', '#1F4A4A', '#E8745A', '#F6B77A', '#F2D35B'],
    ['#1A0F2A', '#2D4A36', '#D94F8C', '#F4A6C6', '#B8E05A'],
    ['#0A1F24', '#244238', '#F29A2E', '#FFD27A', '#5AD6C8'],
    ['#101634', '#2B3F5C', '#8C6CD9', '#D6C6F5', '#F5B04A'],
    ['#0F1A14', '#2E5234', '#E0605E', '#F7E6C4', '#F2A33A'],
    ['#0C1628', '#1E4450', '#3FB8C8', '#A6E8CE', '#FFB58A'],
    ['#1E1024', '#3A3048', '#C65A8E', '#F0B8A0', '#8FE0B0'],
    ['#14121E', '#3A4A2A', '#E3C23A', '#F6EFC8', '#E0564A'],
  ];
  const DAY = [
    ['#EAE2CE', '#6E9A5A', '#E0533A', '#F4A93A', '#2B3A7A'],
    ['#DDE6D2', '#4E8A6A', '#3A5FC8', '#A9C0F2', '#E8A81A'],
    ['#F0E6D8', '#7A9A48', '#D8467A', '#F7B8C8', '#1F6A5A'],
    ['#E4E8DA', '#5C8C7A', '#F28A2E', '#FFD8A0', '#6A3A8A'],
    ['#EFE8D2', '#557A3E', '#7A4AB8', '#D8C2F0', '#E0533A'],
    ['#E6E0D4', '#4F7F72', '#E8C21A', '#FFF0B0', '#C8452E'],
  ];
  const GARDENS = [
    { name: 'Night garden', chords: NIGHT, night: true },
    { name: 'Daylight', chords: DAY, night: false },
  ];

  const PRESETS = {
    calm: { fall: 0.8, rings: 3.4, colour: 0.5, pollen: 0.3, twist: 24, flare: 1 },
    drop: { fall: 2.2, rings: 5.6, colour: 1, pollen: 1, twist: 42, flare: 1 },
    // Falling fast through a full, daylight garden.
    daylight: { garden: 1, fall: 1.4, rings: 4.5, colour: 1, pollen: 0.5, twist: 30, flare: 1 },
    // A deep dive for staring into: fast, fully open, hard spiral, unattended.
    vortex: { fall: 3.4, rings: 6, colour: 1, pollen: 0.8, twist: 80, flare: 0.8, follow: 0 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['fall', 'rings', 'colour', 'pollen', 'twist'];

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixA(A, B, t) { return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; }
  function css(c, a) {
    const s = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
    return a === undefined ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + a + ')';
  }
  // Moonlight: a colour pulled toward a cool grey of its own brightness. The
  // Colour param runs a chord from this to its full inks.
  function moon(c, amt) {
    const l = 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2];
    return mixA(c, [l * 0.86, l * 0.93, l * 1.08 + 6], amt);
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // One petal along angle a, from radius r0, length L, half-width w, added to
  // the open path. pointy 0 is a round spoon, 1 a lance.
  function petal(g, a, r0, L, w, pointy) {
    const c = Math.cos(a), s = Math.sin(a);
    const X = (x, y) => c * x - s * y, Y = (x, y) => s * x + c * y;
    const x1 = r0 + L * 0.3, x2 = r0 + L * (0.98 - 0.25 * pointy), x3 = r0 + L;
    const w2 = w * (0.9 - 0.6 * pointy);
    g.moveTo(X(r0, 0), Y(r0, 0));
    g.bezierCurveTo(X(x1, w), Y(x1, w), X(x2, w2), Y(x2, w2), X(x3, 0), Y(x3, 0));
    g.bezierCurveTo(X(x2, -w2), Y(x2, -w2), X(x1, -w), Y(x1, -w), X(r0, 0), Y(r0, 0));
  }

  VIZ.register({
    id: 'droste',
    name: 'Droste Garden',
    order: 811,

    params: [
      { key: 'garden', label: 'Garden', type: 'select', options: GARDENS.map((q) => q.name), default: 0 },
      // Droste steps per phrase (8 bars at 124 BPM): 1 means each phrase falls
      // exactly one garden deeper.
      { key: 'fall', label: 'Fall speed', type: 'range', min: 0, max: 4, default: PRESETS.calm.fall, step: 0.01 },
      { key: 'rings', label: 'Petal rings', type: 'range', min: 1, max: 6, default: PRESETS.calm.rings, step: 0.01 },
      { key: 'colour', label: 'Colour', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'pollen', label: 'Pollen in the air', type: 'range', min: 0, max: 1, default: PRESETS.calm.pollen, step: 0.01 },
      // Degrees each garden is turned against its parent: the spiral.
      { key: 'twist', label: 'Spiral twist', type: 'range', min: -90, max: 90, default: PRESETS.calm.twist, step: 1 },
      // Reaction strength for the kick's petal flare.
      { key: 'flare', label: 'Kick flare', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Droste Garden',
      technique: 'Canvas 2D: nested circular clips drawn outside-in at exponential scales (one Droste step = x' + Q.toFixed(2) + ' zoom), each level a seeded garden bed (ground gradient, moss, leaf rosette, ring of small flowers, mandala flower of bezier petal rings with offset soft shadows and two-tone fills, stamens) turned by the spiral twist against its parent; pollen motes live in level coordinates so they zoom out past the viewer; onset detection against slow baselines and a section follower easing toward the drop preset',
      brief: 'A slow fall into a garden that is folded into itself. A round garden bed seen from above — dark matte ground, a rosette of broad leaves, a ring of small flowers — holds one big mandala flower, and the flower\'s pistil is a window onto another garden, in a new three-ink chord, whose flower\'s pistil is a window onto another, forever. Each garden turns a little against its parent, so the fall is a slow spiral. Every phrase falls one garden deeper. Each kick punches one petal ring outward and lightens it, the next ring on the next beat, so the beats walk out through the flower; each clap sprays a puff of pollen from the pistil that flies out past the viewer; hats glint the anthers and loose single grains; the bass makes the petals breathe and the leaves sway. The drop falls faster, opens more petal rings until the flower fills its bed, turns the moonlit chord to full colour, fills the air with pollen and twists the spiral harder; the breakdown slows to one garden a phrase with the flower half-closed.',
      lineage: [
        'Iris (web/scenes/iris.js): its "Iris tunnel" pupil, a Droste fall into ever smaller irises, which the Psychonaut called the strongest image for the altered viewer and "the purest somewhere to fall into".',
        'Bloom (web/scenes/bloom.js): mandala flowers of counter-rotating petal rings and the kick as a flare in one flower; here matte and shadowed rather than additive, after the Psychonaut\'s note that Bloom\'s flowers read as clip-art.',
        'Psychonaut judge (2026-09-28), proposal 3, Droste Garden: "each phrase completes one Droste step; the kick flares one petal ring; hats are pollen; the drop speeds the fall and opens more petal rings".',
        'Oil\'s rotating colour triads: every garden is a new chord, so the fall never repeats a look within eight gardens.',
        'M. C. Escher\'s Print Gallery and the Droste cocoa tin: the picture that contains itself; the per-level twist gives Escher\'s spiral.',
        'Presets: calm, drop, daylight (the same fall in a sunlit bed with real shadows on pale ground), vortex (fast, fully open, hard spiral, follow off).',
      ],
    },

    enter() {
      this.lastT = null;
      this.env = null;
    },

    init() {
      this.env = { kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0, hf: 0, hs: 0, hWait: 0,
        bass: 0, pad: 0, low: 0, dropOn: false, auto: 0 };
      this.depth = 0.35;
      this.rate = 0;
      this.spin = 0;
      this.kicks = 0;
      this.flares = [];
      this.motes = [];
      this.levels = new Map();
      this.rand = rng(4242);
      this.airAcc = 0;
    },

    // A garden's layout, seeded by its level index so it never changes while
    // it is on screen and every garden in the fall is different.
    level(k) {
      let L = this.levels.get(k);
      if (L) return L;
      const R = rng(k * 7919 + 101);
      const nBase = 9 + Math.floor(R() * 6);
      const stepN = 1 + Math.floor(R() * 2);
      const rings = [];
      // Rings overlap (each starts before the last one ends), so the head
      // reads as one layered dahlia rather than separate wreaths.
      for (let i = 0; i < 6; i++) {
        rings.push({
          n: Math.min(28, nBase + i * stepN),
          r0: P_WIN * 1.06 + i * 0.056,
          L: 0.105 + i * 0.03,
          wf: 0.36 + R() * 0.16,
          off: R() * TAU,
          w: (0.04 + R() * 0.08) * (i % 2 ? -1 : 1),
        });
      }
      const leaves = [];
      const nl = 7 + Math.floor(R() * 5);
      for (let i = 0; i < nl; i++) {
        leaves.push({ a: (i + R() * 0.4) / nl * TAU, len: 0.78 + R() * 0.2, w: 0.1 + R() * 0.07, ph: R() * TAU });
      }
      // A second, shorter tier of leaves between the first, lighter: foliage
      // with depth rather than one flat star.
      const leaves2 = [];
      for (let i = 0; i < nl; i++) {
        leaves2.push({ a: (i + 0.5 + R() * 0.3) / nl * TAU, len: 0.5 + R() * 0.16, w: 0.08 + R() * 0.05, ph: R() * TAU });
      }
      const sides = [];
      const ns = 5 + Math.floor(R() * 4);
      for (let i = 0; i < ns; i++) {
        sides.push({ a: (i + 0.5 + (R() - 0.5) * 0.3) / ns * TAU, r: 0.74 + R() * 0.13,
          size: 0.055 + R() * 0.04, n: 5 + Math.floor(R() * 4), ink: Math.floor(R() * 3), off: R() * TAU });
      }
      const moss = [];
      for (let i = 0; i < 160; i++) {
        const a = R() * TAU, r = 0.25 + Math.sqrt(R()) * 0.75;
        moss.push(Math.cos(a) * r, Math.sin(a) * r, 0.003 + R() * 0.009);
      }
      L = { rings, leaves, leaves2, sides, moss, pointy: R(), stamens: 22 + Math.floor(R() * 16),
        chordShift: Math.floor(R() * 1000) };
      this.levels.set(k, L);
      return L;
    },

    listen(signals, dt, t) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      const ev = { kick: 0, clap: 0, hat: 0 };
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        ev.kick = clamp((e.kf - e.ks) * 3, 0.6, 1);
        e.kWait = 0.2;
      }
      const c = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, c, 30, dt);
      e.cs = ease(e.cs, c, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        ev.clap = 1;
        e.cWait = 0.35;
      }
      const h = (signals[6] + signals[7] + signals[8]) / 300;
      e.hf = ease(e.hf, h, 45, dt);
      e.hs = ease(e.hs, h, 4, dt);
      e.hWait = Math.max(0, e.hWait - dt);
      if (e.hf - e.hs > 0.05 && e.hWait === 0) {
        ev.hat = clamp((e.hf - e.hs) * 6, 0.4, 1);
        e.hWait = 0.09;
      }
      e.bass = ease(e.bass, (signals[1] + signals[2]) / 200, 4, dt);
      e.pad = ease(e.pad, (signals[2] + signals[3] + signals[4]) / 300, 1.5, dt);
      // Section follower on the sidechained bass line, with hysteresis.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return ev;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.env) this.init();
      const e = this.env;
      const ev = this.listen(signals, dt, t);

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      P.flare = params.flare;
      const garden = GARDENS[Math.round(params.garden)] || GARDENS[0];
      const night = garden.night;

      // The fall: steps per phrase, leaning a little faster with the bass line.
      // Eased so a snapshot recall changes the speed, never the position.
      const target = (P.fall / PHRASE) * (0.85 + 0.4 * e.bass);
      this.rate = ease(this.rate, target, 1.5, dt);
      this.depth += this.rate * dt;
      this.spin += dt * 0.02;
      const n = Math.floor(this.depth), f = this.depth - n;
      const twist = (P.twist * Math.PI) / 180;

      // The vanishing point wanders a little, so the fall is never dead centre.
      const cx = W / 2 + W * 0.018 * Math.sin(t * 0.11);
      const cy = H / 2 + H * 0.022 * Math.sin(t * 0.083 + 1.3);
      // At f = 0 the outermost garden's own disc just covers the corners, so
      // the garden outside it is never visible and never needs drawing.
      const A = 1.03 * Math.hypot(W / 2 + W * 0.02, H / 2 + H * 0.025);
      const scaleOf = (k) => A * Math.exp((this.depth - k) * LNQ);
      const angleOf = (k) => twist * (this.depth - k) + this.spin;

      // The flower in focus: the deepest one whose head is big enough to read.
      // The kick walks outward through its rings, skipping rings that are off
      // screen (the outer flower's head is mostly beyond the corners).
      const R = P.rings;
      const nOpen = Math.max(1, Math.ceil(R - 0.25));
      const tipOf = (k) => { const g0 = this.level(k).rings[nOpen - 1]; return (g0.r0 + g0.L) * scaleOf(k); };
      const focal = tipOf(n + 1) >= 150 ? n + 1 : n;
      if (ev.kick) {
        const Lf = this.level(focal), sf = scaleOf(focal), reach = 0.8 * Math.hypot(W / 2, H / 2);
        const vis = [];
        for (let i = 0; i < nOpen; i++) if (Lf.rings[i].r0 * sf < reach) vis.push(i);
        if (!vis.length) vis.push(0);
        this.flares.push({ k: focal, ring: vis[this.kicks % vis.length], t0: t, amp: ev.kick });
        this.kicks++;
      }
      while (this.flares.length && (t - this.flares[0].t0 > 0.8 || this.flares.length > 6)) this.flares.shift();

      // Pollen, in level coordinates: it zooms with its garden, so it flies
      // out past the viewer as the fall carries on.
      const rnd = this.rand;
      if (ev.clap) {
        for (let i = 0; i < 48; i++) {
          const a = rnd() * TAU, sp = 0.22 + rnd() * 0.4, r = P_WIN * (1.05 + rnd() * 0.25);
          this.motes.push({ k: focal, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            t0: t, life: 1.2 + rnd() * 0.7, size: 2.2 + rnd() * 2.2, tw: rnd() * TAU, kind: 1 });
        }
      }
      if (ev.hat) {
        for (let i = 0; i < 2; i++) {
          const a = rnd() * TAU, r = P_WIN * (1.25 + rnd() * 0.12);
          this.motes.push({ k: focal, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(a) * 0.05, vy: Math.sin(a) * 0.05,
            t0: t, life: 0.7, size: 1.2 + rnd() * 0.8 * ev.hat, tw: rnd() * TAU, kind: 2 });
        }
      }
      this.airAcc += dt * P.pollen * 14;
      while (this.airAcc >= 1) {
        this.airAcc -= 1;
        const a = rnd() * TAU, r = 0.2 + rnd() * 0.8;
        const kk = rnd() < 0.5 ? n + 1 : n + 2;
        this.motes.push({ k: kk, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: (rnd() - 0.5) * 0.04, vy: (rnd() - 0.5) * 0.04,
          t0: t, life: 2.5 + rnd() * 2.5, size: 0.9 + rnd() * 1.2, tw: rnd() * TAU, kind: 0 });
      }
      for (let i = this.motes.length - 1; i >= 0; i--) {
        const m = this.motes[i];
        if (t - m.t0 > m.life || m.k < n - 1) { this.motes.splice(i, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 1 - 0.6 * dt; m.vy *= 1 - 0.6 * dt;
      }
      if (this.motes.length > 400) this.motes.splice(0, this.motes.length - 400);
      // Old gardens: forget their layouts once they are well behind us.
      if (this.levels.size > 12) for (const k of this.levels.keys()) if (k < n - 2) this.levels.delete(k);

      const hatGlint = e.hf - e.hs;
      const g = p.drawingContext;
      p.colorMode(p.RGB, 255);
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.setLineDash([]);
      g.fillStyle = night ? '#05060c' : '#d8d2c0';
      g.fillRect(0, 0, W, H);

      // Light from the upper left, fixed on screen, whatever the twist.
      const shX = 0.55, shY = 0.83;
      // Each garden is drawn in its own absolute frame, but inside every
      // ancestor's clip: its own disc (radius 1) is exactly its parent's
      // window, so the clips nest into the Droste without any extra geometry.
      const base = g.getTransform();
      let depthSaves = 0;
      for (let k = n; k < n + 7; k++) {
        const s = scaleOf(k);
        if (s < 1.6) break;
        const th = angleOf(k);
        g.save();
        depthSaves++;
        g.setTransform(base);
        g.translate(cx, cy);
        g.rotate(th);
        g.scale(s, s);
        g.beginPath();
        g.arc(0, 0, 1, 0, TAU);
        g.clip();
        // The shadow direction in this level's frame.
        const ct = Math.cos(-th), st = Math.sin(-th);
        const sdx = ct * shX - st * shY, sdy = st * shX + ct * shY;
        this.drawLevel(g, k, s, t, P, e, garden, sdx, sdy, hatGlint);
      }
      for (let i = 0; i < depthSaves; i++) g.restore();
      g.setTransform(base);

      // Pollen over everything, as small points of light (or of ink, by day).
      g.globalCompositeOperation = night ? 'lighter' : 'source-over';
      for (const m of this.motes) {
        const s = scaleOf(m.k), th = angleOf(m.k);
        if (s < 2) continue;
        const c = Math.cos(th), sn = Math.sin(th);
        const x = cx + s * (c * m.x - sn * m.y), y = cy + s * (sn * m.x + c * m.y);
        if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
        const age = (t - m.t0) / m.life;
        let a = Math.min(1, age * 8) * (1 - age) * (1 - age * 0.3);
        if (m.kind === 0) a *= 0.55 + 0.45 * Math.sin(t * 5 + m.tw);
        if (m.kind === 2) a *= 1.2;
        // Grains grow as their garden comes toward us, gently.
        const sz = m.size * clamp(Math.pow(s / 300, 0.3), 0.5, 2.2);
        const chord = this.chord(m.k, garden, P.colour);
        g.fillStyle = css(night ? mixA(chord.acc, [255, 250, 225], 0.35) : chord.accDay, clamp(a, 0, 1) * (night ? 0.9 : 0.8));
        g.beginPath();
        g.arc(x, y, sz, 0, TAU);
        g.fill();
        if (night && sz > 1.2) {
          g.fillStyle = css(chord.acc, clamp(a, 0, 1) * (m.kind === 1 ? 0.22 : 0.12));
          g.beginPath();
          g.arc(x, y, sz * 3, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    },

    // This garden's inks at the current Colour.
    chord(k, garden, colour) {
      const list = garden.chords;
      const idx = (((k * 3) % list.length) + list.length) % list.length;
      const C = list[idx].map(rgb);
      const m = 1 - colour;
      const amt = garden.night ? m * 0.85 : m * 0.6;
      return {
        ground: moon(C[0], amt * 0.6),
        leaf: moon(C[1], amt),
        pA: moon(C[2], amt),
        pB: moon(C[3], amt),
        acc: moon(C[4], amt * 0.7),
        accFull: moon(C[4], amt * 0.25),
        accDay: mixA(C[4], [40, 30, 20], 0.1),
      };
    },

    drawLevel(g, k, s, t, P, e, garden, sdx, sdy, hatGlint) {
      const L = this.level(k);
      const night = garden.night;
      const ch = this.chord(k, garden, P.colour);
      const px = 1 / s;                   // one virtual pixel in level units
      const big = s > 60, huge = s > 160;
      const shadowA = night ? 0.42 : 0.2;
      const sh = 0.014;                   // shadow offset, level units

      // Ground: lighter toward the flower, falling into dusk at the rim.
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      grd.addColorStop(0, css(mixA(ch.ground, ch.leaf, night ? 0.35 : 0.2)));
      grd.addColorStop(0.7, css(ch.ground));
      grd.addColorStop(1, css(mixA(ch.ground, [0, 0, 0], night ? 0.35 : 0.12)));
      g.fillStyle = grd;
      g.fillRect(-1, -1, 2, 2);

      // Moss and gravel: fine dots, detail inside detail.
      if (big) {
        g.fillStyle = css(mixA(ch.ground, ch.pB, 0.3), 0.5);
        g.beginPath();
        const M = L.moss;
        for (let i = 0; i < M.length; i += 3) {
          g.moveTo(M[i] + M[i + 2], M[i + 1]);
          g.arc(M[i], M[i + 1], M[i + 2], 0, TAU);
        }
        g.fill();
      }

      // The leaf rosette, swaying with the bass.
      const sway = 0.05 * Math.sin(t * 0.6) + 0.07 * e.bass;
      const leafPath = (set, dx, dy) => {
        g.beginPath();
        for (const lf of set) {
          const a = lf.a + sway * Math.sin(t * 0.9 + lf.ph);
          const c = Math.cos(a), sn = Math.sin(a);
          const r0 = 0.12, r1 = lf.len, w = lf.w;
          const X = (x, y) => c * x - sn * y + dx, Y = (x, y) => sn * x + c * y + dy;
          g.moveTo(X(r0, 0), Y(r0, 0));
          g.bezierCurveTo(X(r0 + 0.2, w * 1.1), Y(r0 + 0.2, w * 1.1), X(r1 - 0.12, w * 0.9), Y(r1 - 0.12, w * 0.9), X(r1, 0), Y(r1, 0));
          g.bezierCurveTo(X(r1 - 0.12, -w * 0.9), Y(r1 - 0.12, -w * 0.9), X(r0 + 0.2, -w * 1.1), Y(r0 + 0.2, -w * 1.1), X(r0, 0), Y(r0, 0));
        }
      };
      const tiers = [[L.leaves, ch.leaf], [L.leaves2, mixA(ch.leaf, ch.pB, night ? 0.16 : 0.12)]];
      for (const [set, col] of tiers) {
        leafPath(set, sdx * sh * 1.4, sdy * sh * 1.4);
        g.fillStyle = css([0, 0, 0], shadowA * 0.8);
        g.fill();
        leafPath(set, 0, 0);
        g.fillStyle = css(col);
        g.fill();
        if (big) {
          // Midribs, lighter than the leaf.
          g.strokeStyle = css(mixA(col, ch.pB, 0.25), 0.7);
          g.lineWidth = 1.1 * px;
          g.beginPath();
          for (const lf of set) {
            const a = lf.a + sway * Math.sin(t * 0.9 + lf.ph);
            g.moveTo(Math.cos(a) * 0.14, Math.sin(a) * 0.14);
            g.lineTo(Math.cos(a) * (lf.len - 0.03), Math.sin(a) * (lf.len - 0.03));
          }
          g.stroke();
        }
      }

      // The ring of small flowers round the bed, each with its shadow.
      const inks = [ch.pA, ch.pB, ch.acc];
      for (const sf of L.sides) {
        const x = Math.cos(sf.a) * sf.r, y = Math.sin(sf.a) * sf.r;
        const rot = sf.off + t * 0.08;
        const head = () => {
          g.beginPath();
          for (let i = 0; i < sf.n; i++) petal(g, rot + (i / sf.n) * TAU, 0, sf.size, sf.size * 0.42, 0.2);
        };
        g.save();
        g.translate(x + sdx * sh, y + sdy * sh);
        head();
        g.fillStyle = css([0, 0, 0], shadowA * 0.7);
        g.fill();
        g.setTransform(g.getTransform().translate(-sdx * sh, -sdy * sh));
        head();
        g.fillStyle = css(inks[sf.ink]);
        g.fill();
        g.beginPath();
        g.arc(0, 0, sf.size * 0.22, 0, TAU);
        g.fillStyle = css(sf.ink === 2 ? ch.pB : ch.acc);
        g.fill();
        g.restore();
      }

      // The mandala flower. A receptacle disc under the inner petals.
      g.beginPath();
      g.arc(0, 0, P_WIN * 1.2, 0, TAU);
      g.fillStyle = css(mixA(ch.ground, ch.pA, night ? 0.3 : 0.45));
      g.fill();

      const R = P.rings;
      const breathe = 1 + 0.05 * (e.bass - 0.3);
      // A flared ring lifts off the flower toward the viewer: it is drawn over
      // the rings inside it, longer, in the garden's accent ink, with its
      // shadow thrown further. Drawn in its place it would hide under the
      // inner rings and the kick would be lost.
      const order = [], lifted = [];
      for (let i = 5; i >= 0; i--) {
        if (R - i <= 0.001) continue;
        let fl = 0;
        for (const F of this.flares) {
          if (F.k !== k || F.ring !== i) continue;
          const age = t - F.t0;
          fl = Math.max(fl, F.amp * (1 - Math.exp(-age * 40)) * Math.exp(-age * 4.5));
        }
        fl *= P.flare;
        (fl > 0.03 ? lifted : order).push([i, fl]);
      }
      for (const [i, fl] of order.concat(lifted)) {
        const open = clamp(R - i, 0, 1);
        const rg = L.rings[i];
        const op = open * open * (3 - 2 * open);
        const Lp = rg.L * op * breathe * (1 + 0.32 * fl);
        const w = rg.L * rg.wf * (0.6 + 0.4 * op) * (1 + 0.12 * fl);
        const rot = rg.off + t * rg.w;
        let body = mixA(ch.pB, ch.pA, Math.pow(i / 5, 0.8));
        body = mixA(body, ch.accFull, clamp(1.3 * fl, 0, 1));
        const ringPath = (r0, L2, w2) => {
          g.beginPath();
          for (let j = 0; j < rg.n; j++) petal(g, rot + (j / rg.n) * TAU, r0, L2, w2, L.pointy);
        };
        const lift = 1 + fl * 2.2;
        g.save();
        g.translate(sdx * sh * lift, sdy * sh * lift);
        ringPath(rg.r0, Lp, w);
        g.fillStyle = css([0, 0, 0], shadowA * op * (1 - 0.25 * clamp(fl, 0, 1)));
        g.fill();
        g.restore();
        ringPath(rg.r0, Lp, w);
        g.fillStyle = css(body);
        g.fill();
        if (big) {
          // A darker base and lighter centre stroke: two-tone matte petals.
          ringPath(rg.r0, Lp * 0.34, w * 0.8);
          g.fillStyle = css(mixA(body, [0, 0, 0], 0.18), 0.8);
          g.fill();
          ringPath(rg.r0 + Lp * 0.18, Lp * 0.62, w * 0.34);
          g.fillStyle = css(mixA(body, [255, 255, 255], 0.28), 0.75);
          g.fill();
        }
      }

      // Stamens round the window, anthers glinting on the hats.
      const ns = L.stamens;
      const r0 = P_WIN * 1.02;
      if (big) {
        g.strokeStyle = css(mixA(ch.pB, ch.acc, 0.4), 0.85);
        g.lineWidth = 1.0 * px;
        g.beginPath();
        for (let i = 0; i < ns; i++) {
          const a = (i / ns) * TAU + t * 0.05;
          const r1 = P_WIN * (1.3 + 0.07 * Math.sin(i * 2.3 + t * 1.3));
          g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        }
        g.stroke();
      }
      g.beginPath();
      for (let i = 0; i < ns; i++) {
        const a = (i / ns) * TAU + t * 0.05;
        const r1 = P_WIN * (1.3 + 0.07 * Math.sin(i * 2.3 + t * 1.3));
        const x = Math.cos(a) * r1, y = Math.sin(a) * r1, rr = P_WIN * 0.036;
        g.moveTo(x + rr, y);
        g.arc(x, y, rr, 0, TAU);
      }
      g.fillStyle = css(ch.acc);
      g.fill();
      if (huge && hatGlint > 0.02) {
        // A few anthers catch the light on each hat.
        g.beginPath();
        const seed = Math.floor(t * 11);
        for (let i = 0; i < ns; i++) {
          if (((i * 7 + seed * 13) % 5) !== 0) continue;
          const a = (i / ns) * TAU + t * 0.05;
          const r1 = P_WIN * (1.3 + 0.07 * Math.sin(i * 2.3 + t * 1.3));
          const x = Math.cos(a) * r1, y = Math.sin(a) * r1, rr = P_WIN * 0.028;
          g.moveTo(x + rr, y);
          g.arc(x - rr * 0.3, y - rr * 0.3, rr, 0, TAU);
        }
        g.fillStyle = css([255, 252, 235], clamp(hatGlint * 8, 0, 0.9));
        g.fill();
      }

      // The window's lip, then the next garden goes inside it (the caller
      // clips to it); the lip's shadow falls into the window as the child's
      // rim vignette.
      g.strokeStyle = css(mixA(ch.pA, [0, 0, 0], 0.6));
      g.lineWidth = P_WIN * 0.05;
      g.beginPath();
      g.arc(0, 0, P_WIN * 1.0, 0, TAU);
      g.stroke();

      // This garden's own rim: dusk at its edge, the depth of its window.
      const vg = g.createRadialGradient(0, 0, 0.78, 0, 0, 1);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, night ? 'rgba(0,0,0,0.75)' : 'rgba(40,30,20,0.4)');
      g.fillStyle = vg;
      g.fillRect(-1, -1, 2, 2);
    },
  });
})();
