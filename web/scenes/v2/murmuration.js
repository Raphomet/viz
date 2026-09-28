// Murmuration V2 — a black flock over a marsh at dusk.
//
// V1 (web/scenes/murmuration.js) with the same flock engine and a different
// idea of what the drop is. Six judges agreed the black flock at dusk was the
// piece and the drop was where it lost it: rays washed the frame to white and
// the birds turned teal and magenta, so the one image that mattered vanished
// at the loudest moment. Here the flock is always black and the drop gets
// bigger by contrast and form instead of light and colour: the sky deepens
// into an afterglow (the sky "on fire" after the sun has set), the flock grows
// and folds harder, and every other drop it splits into two sheets that curl
// past each other. A long-exposure layer lets the sky remember where the flock
// has been, after the 19th-century photographs of starlings.
//
// The flock is not a boids simulation. A real murmuration reads as a sheet of
// birds folding in three dimensions: where the sheet turns edge-on to you the
// birds pile up in projection and a dark ribbon appears, where it faces you it
// thins to a haze. So every bird owns a fixed slot (u, v, w) on a ribbon, and
// the ribbon is bent, twisted, undulated and yawed in 3D and projected with
// perspective. Deformations are evaluated at a time lagged along the ribbon,
// so every change travels down the flock as a wave.
//
// Layers, back to front: sky gradient, lit clouds and sun glow (third-res
// canvas); the long-exposure trace (third-res, persistent); the sun's disc and
// rim; a far treeline; the marsh water with the sun's glitter path; the far
// flock and the flock; foreground reeds with backlit plumes; drifting motes.
//
// Music:
//   kick   a ripple of dark density runs head to tail through the flock, and
//          the sun's rim flares red: the one saturated accent in the frame.
//   snare  the flock turns: a yaw swing that travels along the ribbon, birds
//          banking as it passes, so a band of darker, heavier birds sweeps
//          through it. Successive claps swing it back and forth.
//   bass   the flock's size and the sun's glow swell.
//   hats   reed plumes, water glitter and motes sparkle.
//   drop   the sky burns into afterglow, the flock grows, folds harder and
//          flies faster; alternate drops split it in two. The breakdown lets
//          the sky cool and the sheets rejoin, and the exposure shows the
//          ghost of the drop's folds for a while after.

(function () {
  const MAX_BIRDS = 14000;

  // Dusk schemes, re-toned from V1's pink and violet toward real dusk: warm
  // horizons under smoky upper skies. Sky stops run zenith to horizon.
  const SCHEMES = {
    apricot: { sky: ['#283049', '#6a6379', '#d4978a', '#f4cd9c'], sun: '#fff0d4', lit: '#f2b28a', dark: '#39323f' },
    rose:    { sky: ['#252842', '#5c5070', '#c78086', '#efb79c'], sun: '#ffecd8', lit: '#e89e98', dark: '#372c3f' },
    smoke:   { sky: ['#1e2432', '#4e5465', '#a48d8b', '#e7c39c'], sun: '#fff0d2', lit: '#d8a888', dark: '#2d2d35' },
    // Afterglows the drop burns into. The mid sky, where the flock flies, is
    // the brightest and most saturated part, so a black flock on it is the
    // strongest contrast the scene has; the zenith darkens around it.
    fire:    { sky: ['#1a1022', '#8a2e2c', '#e0602c', '#ffae4c'], sun: '#ffe2b0', lit: '#ff7a3c', dark: '#1e0e16' },
    crimson: { sky: ['#160c20', '#7a1c3a', '#cc3c48', '#f89c6c'], sun: '#ffdcc0', lit: '#ff6a5a', dark: '#1c0c18' },
  };
  const SKY_OPTIONS = ['Dusk cycle', 'Apricot', 'Ash rose', 'Smoke'];
  const CYCLE = ['apricot', 'rose', 'smoke'];
  const FIXED = [null, 'apricot', 'rose', 'smoke'];
  const DROP_SKY_OPTIONS = ['Alternate', 'Fire', 'Crimson', 'None'];
  const FORM_OPTIONS = ['Alternate', 'One ribbon', 'Split'];
  // The kick's rim flare: the only saturated colour that ever touches the sun.
  const FLARE = [255, 84, 40];

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  function scheme(name) {
    const s = SCHEMES[name];
    return { sky: s.sky.map(hex), sun: hex(s.sun), lit: hex(s.lit), dark: hex(s.dark) };
  }
  function mixScheme(a, b, t) {
    return {
      sky: a.sky.map((c, i) => mixc(c, b.sky[i], t)),
      sun: mixc(a.sun, b.sun, t), lit: mixc(a.lit, b.lit, t), dark: mixc(a.dark, b.dark, t),
    };
  }
  const SCH = {};
  for (const k of Object.keys(SCHEMES)) SCH[k] = scheme(k);

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth01(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }

  VIZ.register({
    id: 'murmurationv2',
    name: 'Murmuration',
    versionOf: 'murmuration',
    version: 'V2',
    order: 710,

    params: [
      { key: 'push', label: 'Music push', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'birds', label: 'Birds', type: 'range', min: 2000, max: MAX_BIRDS, default: 5500, step: 100 },
      { key: 'fold', label: 'Fold', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0.2, max: 2.5, default: 1, step: 0.01 },
      { key: 'sky', label: 'Sky', type: 'select', options: SKY_OPTIONS, default: 0 },
      { key: 'dropSky', label: 'Drop sky', type: 'select', options: DROP_SKY_OPTIONS, default: 0 },
      { key: 'form', label: 'Drop form', type: 'select', options: FORM_OPTIONS, default: 0 },
      { key: 'exposure', label: 'Long exposure (s)', type: 'range', min: 0, max: 20, default: 7, step: 0.1 },
      { key: 'reeds', label: 'Reeds', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'New flock', run() { this.seedFlock(); this.layoutFor = null; } },
    ],

    gallery: {
      title: 'Murmuration',
      technique: 'Canvas 2D: thousands of birds on a 3D ribbon (bent, twisted, undulated, yawed, perspective-projected, deformations lagged along the ribbon so they travel as waves), batched into a few Path2D strokes; a persistent third-resolution long-exposure canvas the heaviest birds are stroked into and that fades continuously; soft sky, clouds and sun glow on a third-resolution canvas; full-resolution sun, treeline, glitter, reeds and motes',
      brief: 'Starlings at dusk over a marsh: one black flock of thousands folding and pouring across the sky, dark ribbons forming wherever the sheet turns edge-on, while a slow travel along the marsh slides reeds, ripples and treeline past. The flock never changes colour. Each kick sends a ripple of dark density head to tail through it and flares the sun\'s rim red; the clap swings the flock into a turn that travels through it as a band of banking birds; bass swells the flock and the sun; hats sparkle reed plumes, the glitter path and motes. The drop is bigger by contrast, not light: the sky burns into an afterglow behind a larger, harder-folding flock, and every other drop the flock splits into two sheets that curl past each other. A long exposure lets the sky keep a smoky trace of where the flock has been, so the breakdown shows the ghost of the drop\'s folds as the sky cools.',
      lineage: [
        'V2 of Murmuration (web/scenes/murmuration.js, batch 02), ranked #10 of 72 by the six-judge panel. The ribbon flock, kick ripple, clap turn, marsh travel, reeds, glitter and reflection are V1\'s.',
        'Acted on: the black flock is the piece (Floor, Psychonaut, Curator), so iridescence, glint colours and the Iridescence control are gone; the clap band is darker banking birds, not colour.',
        'Acted on: drops blew out to white at 36, 60 and 84 s (Floor; highlight roll-off transplant). The ray sheet is gone and the sun, glow and water column are capped below white.',
        'Acted on, reinterpreted: Curator\'s single-accent transplant. The kick flares the sun\'s rim red-orange, the only saturated accent; the drop\'s escalation is the sky deepening to afterglow around a black flock (contrast as escalation, after Curator\'s Seascape).',
        'Acted on: same drop every time (Floor, Director longevity themes). Drops alternate a single giant ribbon with a flock split into two counter-twisting sheets, and alternate fire and crimson afterglows.',
        'Acted on, my way: Purist\'s persistent-record transplant (Stamps → Murmuration). A long-exposure layer keeps a fading smoky trace of the flock\'s edge-on folds.',
        'Rejected: Purist\'s "not boids" (the steerable ribbon is what makes the shapes legible and music-driven); Director\'s flock veering from the sun flare (a second kick reaction on the same subject would jerk its line of action).',
        'Skies re-toned toward real dusk (apricot, ash rose, smoke) per TASTE "range, not a house style"; the acid push and bokeh removed.',
      ],
    },

    setup() {
      this.seedFlock();
    },

    enter() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kick: 0, kickSm: 0, kickAvg: 0, bass: 0, energy: 0, hat: 0, s8slow: 0, hatArmed: true,
        snPrev: 0, snLast: -10, lastHatT: -10 };
      this.turns = [];
      this.yawBase = 0;
      this.turnSign = 1;
      this.ringT = [];
      this.kicks = [];
      this.kickArmed = true;
      this.cam = 0;
      this.sparkT = 0;
      this.sparkSeed = 0;
      this.dropN = 0;         // drops so far; picks each drop's form and sky
      this.dropArmed = true;
      this.split = 0;         // 0 one sheet, 1 fully split
      this.exFade = 0;
      if (this.exc) this.exc.clearRect(0, 0, this.ex.width, this.ex.height);
    },

    seedFlock() {
      const r = Math.random;
      const n = MAX_BIRDS;
      this.U = new Float32Array(n); this.V = new Float32Array(n); this.Wd = new Float32Array(n);
      this.Ph = new Float32Array(n); this.Fq = new Float32Array(n); this.Jt = new Float32Array(n);
      this.Gs = new Int8Array(n);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const rad = Math.pow(r(), 1.1) * (r() < 0.05 ? 1.25 : 1);
        this.U[i] = Math.cos(a) * rad;
        this.V[i] = Math.sin(a) * rad;
        this.Wd[i] = (r() + r() + r() - 1.5) / 1.5;
        this.Ph[i] = r() * Math.PI * 2;
        this.Fq[i] = 9 + r() * 7;
        this.Jt[i] = 2 + r() * 5;
        // Which sheet the bird joins when the flock splits: by slot, not at
        // random, so each sheet is itself a coherent ribbon (one side of the
        // lens each) rather than two interleaved hazes.
        this.Gs[i] = this.V[i] + 0.35 * (r() - 0.5) > 0 ? 1 : -1;
      }
      this.seed = { a: r() * 50, b: r() * 50, c: r() * 50, d: r() * 50, e: r() * 50, f: r() * 50 };
    },

    layout(W, H) {
      const r = Math.random;
      const hy = H * 0.74;
      this.hy = hy;
      const steps = 260;
      const hs = [];
      let hgt = 6;
      for (let i = 0; i <= steps; i++) {
        hgt = Math.max(2, Math.min(18, hgt + (r() - 0.5) * 3));
        hs.push(hgt);
      }
      const base = hs.slice();
      for (let i = 0; i <= steps; i++) {
        if (r() < 0.08) {
          const top = 4 + r() * 9, wd = 2 + (r() * 4 | 0);
          for (let k = -wd; k <= wd; k++) {
            const j = i + k;
            if (j >= 0 && j <= steps) hs[j] = Math.max(hs[j], base[i] + top * Math.sqrt(1 - (k / (wd + 1)) ** 2));
          }
        }
      }
      hs.length = steps;
      for (let pass = 0; pass < 3; pass++) {
        const c = hs.slice();
        for (let i = 0; i < steps; i++) hs[i] = (c[(i + steps - 1) % steps] + 2 * c[i] + c[(i + 1) % steps]) / 4;
      }
      this.treeH = hs;

      const reeds = [];
      const span = W * 1.6;
      this.reedSpan = span;
      const clumps = [];
      for (let k = 0; k < 4; k++) clumps.push((k + 0.35 * r()) / 4 * span);
      for (let i = 0; i < 150; i++) {
        const inClump = r() < 0.75;
        const x = inClump ? clumps[(r() * clumps.length) | 0] + (r() + r() - 1) * 110 : r() * span;
        const h = inClump ? H * (0.1 + Math.pow(r(), 1.2) * 0.36) : H * (0.04 + r() * 0.07);
        reeds.push({
          x, h, depth: 0.45 + 2.2 * h / H, lean: (r() - 0.5) * 0.35,
          w: 2 + r() * 3, ph: r() * 10, plume: r() < 0.45 && h > H * 0.15, cat: r() < 0.12,
          glint: r(),
        });
      }
      reeds.sort((a, b) => a.h - b.h);
      this.reedList = reeds;

      const clouds = [];
      for (let band = 0; band < 6; band++) {
        const y = hy * (0.12 + band * 0.13 + r() * 0.05);
        const cx = r() * W;
        const puffs = 5 + (r() * 6 | 0);
        const len = W * (0.25 + r() * 0.45);
        for (let k = 0; k < puffs; k++) {
          clouds.push({
            x: cx + (k / puffs - 0.5) * len + (r() - 0.5) * 40,
            y: y + (r() - 0.5) * 16,
            rx: 60 + r() * 120, ry: 7 + r() * 12,
            sp: 1.2 + band * 0.6 + r(), band,
          });
        }
      }
      this.clouds = clouds;

      const rip = [];
      for (let i = 0; i < 70; i++) {
        const d = Math.pow(r(), 0.9);
        rip.push({ d, x: r() * (W + 200), len: 6 + d * 40 * r() + 6 });
      }
      this.rip = rip;

      const glit = [];
      for (let i = 0; i < 160; i++) {
        const d = Math.pow(r(), 0.8);
        glit.push({ d, off: (r() - 0.5) * 2, len: 3 + r() * 10 * (0.3 + d), ph: r() * 10, f: 2 + r() * 4, k: r() });
      }
      this.glit = glit;

      // Midges catching the low sun. V1's out-of-focus bokeh discs are gone:
      // soft glowing blobs were the house finish this version steps away from.
      const motes = [];
      for (let i = 0; i < 70; i++) {
        motes.push({ x: r() * W, y: r() * H, z: 0.8 + r() * 2.2, ph: r() * 10, k: r(),
          vx: 4 + r() * 8, vy: -2 - r() * 5 });
      }
      this.motes = motes;
      this.layoutFor = W + 'x' + H;
    },

    listen(sg, dt, t) {
      const e = this.env;
      const kickness = sg[0] - 0.6 * sg[1];
      e.kick = Math.max(e.kick * Math.exp(-dt / 0.14), Math.min(1, Math.max(0, (kickness - 4) / 42)));
      e.kickSm = ease(e.kickSm, e.kick, 40, dt);
      if (this.kickArmed && e.kick > 0.45) {
        this.kickArmed = false;
        this.kicks.push({ t0: t, s: Math.min(1, e.kick) });
      } else if (e.kick < 0.25) this.kickArmed = true;
      while (this.kicks.length && t - this.kicks[0].t0 > 1) this.kicks.shift();
      e.kickAvg = ease(e.kickAvg, e.kick, 0.8, dt);
      const target = Math.min(1, e.kickAvg / 0.22);
      e.energy = ease(e.energy, target, target > e.energy ? 1.6 : 0.3, dt);
      e.bass = ease(e.bass, (sg[1] + sg[2]) / 200, 2.2, dt);

      // A drop is the energy level rising through a half; it re-arms only
      // once the energy has really fallen, so one drop counts once.
      if (this.dropArmed && e.energy > 0.5) { this.dropArmed = false; this.dropN++; }
      else if (e.energy < 0.2) this.dropArmed = true;

      const sn = sg[4] - 0.75 * sg[3];
      if (sn > 14 && e.snPrev <= 14 && t - e.snLast > 0.18) {
        e.snLast = t;
        const strength = Math.min(1, sn / 30);
        this.turnSign = -this.turnSign;
        this.turns.push({ t0: t, amt: this.turnSign * 0.62 * strength, s: strength });
      }
      e.snPrev = sn;

      e.s8slow = ease(e.s8slow, sg[8], 6, dt);
      if (e.hatArmed && sg[8] > e.s8slow + 14) {
        e.hatArmed = false;
        this.sparkT = t;
        this.sparkSeed = (this.sparkSeed + 7.31) % 1000;
        e.hat = Math.min(1, sg[8] / 70);
      } else if (sg[8] < e.s8slow + 5) e.hatArmed = true;
      e.hatLvl = ease(e.hatLvl || 0, (sg[6] + sg[7] + sg[8]) / 300, 3, dt);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();
      const W = ctx.width, H = ctx.height;
      if (this.layoutFor !== W + 'x' + H) this.layout(W, H);

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const t = ms / 1000;
      this.listen(signals, dt, t);
      const e = this.env;
      const push = params.push;
      const E = e.energy * Math.min(1, push);
      const kick = e.kickSm * push;
      const s = this.seed;

      this.clock += dt * params.speed * (0.7 + 0.9 * E);
      const T = this.clock;
      this.travelV = 38 * params.speed * (0.6 + 1.1 * E);
      this.cam += dt * this.travelV;

      // This drop's form. dropN is 0 before the first drop, 1 during it; the
      // first drop is one giant ribbon, the second splits, and so on.
      const formSel = params.form | 0;
      const splitting = formSel === 2 || (formSel === 0 && this.dropN > 0 && this.dropN % 2 === 0);
      // Follows the energy, so it opens with the drop and the sheets rejoin
      // over the breakdown's slow exhale; eased again so it never snaps when
      // the next drop changes form.
      this.split = ease(this.split, splitting ? smooth01((e.energy - 0.15) / 0.6) : 0, 0.8, dt);

      // ---- palette: a calm dusk, burning into this drop's afterglow.
      let sch;
      const fixed = FIXED[params.sky | 0];
      if (fixed) sch = SCH[fixed];
      else {
        const pos = (T / 38) % CYCLE.length;
        const i0 = Math.floor(pos);
        sch = mixScheme(SCH[CYCLE[i0]], SCH[CYCLE[(i0 + 1) % CYCLE.length]], smooth01((pos - i0 - 0.6) / 0.4));
      }
      const ds = params.dropSky | 0;
      if (ds !== 3) {
        const after = ds === 1 ? 'fire' : ds === 2 ? 'crimson' : (Math.max(1, this.dropN) % 2 ? 'fire' : 'crimson');
        sch = mixScheme(sch, SCH[after], 0.85 * smooth01(E * 1.15));
      }

      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      g.lineJoin = 'round';

      const hy = this.hy;
      const sunX = W * (0.5 + 0.14 * Math.sin(T * 0.021 + s.a));
      const sunR = 34 + 6 * e.bass;
      // The drop sinks the sun a little: afterglow is the light after sunset.
      const sunY = hy - sunR * 0.55 - 14 * (0.5 + 0.5 * Math.sin(T * 0.017 + s.b)) + 12 * E;
      // Capped: V1's glow reached 1.5+ in the drop and, stacked additively
      // with the rays, flattened a third of the frame to white.
      const glow = Math.min(1, 0.55 + 0.35 * e.bass + 0.1 * kick);
      const flare = Math.min(1.3, e.kick * push);
      this.drawBackdrop(p, g, W, H, sch, sunX, sunY, sunR, glow, E, T);

      // ---- long exposure: the sky's memory of the flock.
      this.drawExposure(p, g, W, H, sch, dt, params);

      // ---- sun disc, a warm cream that stops short of white, then a soft
      // additive rim, then the kick's red flare as a ring just outside it.
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(mixc(sch.sun, [255, 244, 222], 0.5));
      g.save();
      g.beginPath(); g.rect(0, 0, W, hy); g.clip();
      g.beginPath(); g.arc(sunX, sunY, sunR, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'lighter';
      const rimR = sunR * 1.9;
      let grd = g.createRadialGradient(sunX, sunY, sunR * 0.9, sunX, sunY, rimR);
      grd.addColorStop(0, rgba(sch.sun, 0.22));
      grd.addColorStop(1, rgba(sch.sun, 0));
      g.fillStyle = grd;
      g.beginPath(); g.arc(sunX, sunY, rimR, 0, Math.PI * 2); g.fill();
      if (flare > 0.02) {
        // Red is added, not white: the flare saturates the rim instead of
        // brightening it, so the beat is seen as colour on the one light.
        const fr = sunR * (2.2 + 0.8 * flare);
        grd = g.createRadialGradient(sunX, sunY, sunR * 0.95, sunX, sunY, fr);
        grd.addColorStop(0, rgba(FLARE, 0));
        grd.addColorStop(0.18, rgba(FLARE, 0.55 * flare));
        grd.addColorStop(0.5, rgba(FLARE, 0.16 * flare));
        grd.addColorStop(1, rgba(FLARE, 0));
        g.fillStyle = grd;
        g.beginPath(); g.arc(sunX, sunY, fr, 0, Math.PI * 2); g.fill();
      }
      g.restore();

      // Kick rings: a thin red halo leaving the sun on each beat of the drop.
      if (e.kick > 0.85 && (this.ringT.length === 0 || t - this.ringT[this.ringT.length - 1] > 0.3)) this.ringT.push(t);
      this.ringT = this.ringT.filter((r0) => t - r0 < 1.1);
      g.globalCompositeOperation = 'lighter';
      for (const r0 of this.ringT) {
        const a = (t - r0) / 1.1;
        const rr = sunR * 1.6 + a * 150;
        g.strokeStyle = rgba(FLARE, 0.2 * (1 - a) * (1 - a) * Math.min(1, push) * (0.3 + 0.7 * E));
        g.lineWidth = 4 * (1 - a) + 1.2;
        g.beginPath(); g.arc(sunX, sunY, rr, Math.PI, Math.PI * 2); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';

      // ---- treeline
      const treeCol = mixc(sch.dark, [8, 4, 14], 0.6);
      g.fillStyle = rgba(treeCol);
      g.beginPath();
      g.moveTo(0, hy + 1);
      {
        const hs = this.treeH, n = hs.length, px = 0.06;
        const off = (this.cam * px) / W * n;
        for (let i = 0; i <= 200; i++) {
          const f = i / 200 * n + off;
          const i0 = Math.floor(f), fr = f - i0;
          const h = hs[i0 % n] * (1 - fr) + hs[(i0 + 1) % n] * fr;
          g.lineTo(W * i / 200, hy - h);
        }
      }
      g.lineTo(W, hy + 1);
      g.closePath();
      g.fill();

      this.drawGlitter(g, W, H, sch, sunX, t);

      this.drawFlock(g, W, H, params, sch, e, E, kick, T, t, true);
      this.drawFlock(g, W, H, params, sch, e, E, kick, T, t, false);

      if (params.reeds > 0.01) this.drawReeds(g, W, H, params, sch, e, E, t);
      this.drawMotes(g, W, H, sch, e, E, t, dt);

      g.restore();
    },

    drawBackdrop(p, g, W, H, sch, sunX, sunY, sunR, glow, E, T) {
      const dw = Math.max(64, Math.round(p.width / 3));
      const dh = Math.max(36, Math.round(p.height / 3));
      if (!this.bg) {
        this.bg = document.createElement('canvas');
        // willReadFrequently keeps this canvas in CPU memory. Without it the
        // low-res layer lives on the GPU and every drawImage onto the p5
        // canvas forces a readback: 300+ ms a frame in the harness (V1).
        this.bgc = this.bg.getContext('2d', { willReadFrequently: true });
      }
      if (this.bg.width !== dw || this.bg.height !== dh) { this.bg.width = dw; this.bg.height = dh; }
      const b = this.bgc;
      b.setTransform(dw / W, 0, 0, dh / H, 0, 0);
      b.globalCompositeOperation = 'source-over';
      b.globalAlpha = 1;
      const hy = this.hy;

      let grd = b.createLinearGradient(0, 0, 0, hy);
      grd.addColorStop(0, rgba(sch.sky[0]));
      // In the drop the afterglow climbs: the lit band rises toward the
      // zenith so the flock stays on bright sky wherever it wanders. Without
      // it, a flock high in the frame went black-on-black at 60 s.
      grd.addColorStop(0.45 - 0.2 * E, rgba(sch.sky[1]));
      grd.addColorStop(0.8 - 0.25 * E, rgba(sch.sky[2]));
      grd.addColorStop(1, rgba(sch.sky[3]));
      b.fillStyle = grd;
      b.fillRect(0, 0, W, hy + 1);

      const deep = (c, k) => mixc(c, [10, 12, 30], k);
      grd = b.createLinearGradient(0, hy, 0, H);
      grd.addColorStop(0, rgba(deep(sch.sky[3], 0.35)));
      grd.addColorStop(0.3, rgba(deep(sch.sky[2], 0.5)));
      grd.addColorStop(1, rgba(deep(sch.sky[1], 0.7)));
      b.fillStyle = grd;
      b.fillRect(0, hy, W, H - hy);

      for (const c of this.clouds) {
        const span = W + 500;
        let x = ((c.x + T * c.sp) % span + span) % span - 250;
        const near = c.y / hy;
        const toSun = Math.max(0, 1 - Math.abs(x - sunX) / (W * 0.6));
        const body = mixc(sch.dark, sch.sky[1], 0.2 + 0.4 * near);
        const lit = mixc(body, sch.lit, 0.35 + 0.55 * near * (0.5 + 0.5 * toSun));
        this.puff(b, x, c.y, c.rx, c.ry, body, 0.55);
        this.puff(b, x + (sunX - x) * 0.03, c.y + c.ry * 0.45, c.rx * 0.8, c.ry * 0.6, lit, 0.5 + 0.35 * toSun);
      }

      // Sun glow, additive but held well under white: the core adds at most
      // ~0.4, so even on the brightest horizon the frame keeps its gradient.
      // V1's ray sheet is gone; the drop's light is the afterglow in the sky
      // gradient itself.
      b.globalCompositeOperation = 'lighter';
      const gr = sunR * (5 + 2.5 * glow);
      grd = b.createRadialGradient(sunX, sunY, 0, sunX, sunY, gr);
      grd.addColorStop(0, rgba(sch.sun, 0.4 * glow * (1 - 0.35 * E)));
      grd.addColorStop(0.25, rgba(mixc(sch.sun, sch.sky[3], 0.5), 0.18 * glow));
      grd.addColorStop(1, rgba(sch.sky[3], 0));
      b.fillStyle = grd;
      b.fillRect(sunX - gr, sunY - gr, gr * 2, gr * 2);

      grd = b.createLinearGradient(0, hy, 0, H);
      grd.addColorStop(0, rgba(sch.sun, 0.28 * glow));
      grd.addColorStop(1, rgba(sch.sun, 0));
      b.fillStyle = grd;
      b.beginPath();
      b.moveTo(sunX - sunR * 1.5, hy);
      b.lineTo(sunX + sunR * 1.5, hy);
      b.lineTo(sunX + sunR * 4, H);
      b.lineTo(sunX - sunR * 4, H);
      b.closePath();
      b.fill();
      b.globalCompositeOperation = 'source-over';

      g.imageSmoothingEnabled = true;
      g.drawImage(this.bg, 0, 0, W, H);
    },

    // The long exposure: a third-resolution canvas that keeps what the flock's
    // heaviest birds (its edge-on folds) have drawn, fading with a time
    // constant of params.exposure seconds. The flock strokes itself into it in
    // drawFlock; here it is faded and laid over the sky.
    drawExposure(p, g, W, H, sch, dt, params) {
      // Sixth resolution: at a third, single birds landed as separate texels
      // and the upscale showed a grainy brown smog around the flock at
      // 1280x720. Coarser texels average them into a smooth shadow.
      const dw = Math.max(48, Math.round(p.width / 6));
      const dh = Math.max(27, Math.round(p.height / 6));
      if (!this.ex) {
        this.ex = document.createElement('canvas');
        this.exc = this.ex.getContext('2d', { willReadFrequently: true });
      }
      if (this.ex.width !== dw || this.ex.height !== dh) { this.ex.width = dw; this.ex.height = dh; }
      const x = this.exc;
      x.setTransform(1, 0, 0, 1, 0, 0);
      const tau = params.exposure;
      if (tau < 0.2) { x.clearRect(0, 0, dw, dh); this.exOn = false; return; }
      this.exOn = true;
      // Fade in 8% steps rather than a sliver every frame: an 8-bit alpha
      // channel rounds a per-frame 0.2% fade to nothing, and the trace would
      // never leave. The steps are on a faint layer, far below visible.
      this.exFade += dt / tau;
      const step = 0.0834;    // -ln(1 - 0.08)
      if (this.exFade >= step) {
        this.exFade -= step;
        x.globalCompositeOperation = 'destination-out';
        x.fillStyle = 'rgba(0,0,0,0.08)';
        x.fillRect(0, 0, dw, dh);
        x.globalCompositeOperation = 'source-over';
      }
      g.save();
      g.globalAlpha = 0.3;
      g.imageSmoothingEnabled = true;
      g.drawImage(this.ex, 0, 0, W, this.hy);
      g.restore();
    },

    puff(b, x, y, rx, ry, col, a) {
      b.save();
      b.translate(x, y);
      b.scale(1, ry / rx);
      const grd = b.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, rgba(col, a));
      grd.addColorStop(0.6, rgba(col, a * 0.5));
      grd.addColorStop(1, rgba(col, 0));
      b.fillStyle = grd;
      b.fillRect(-rx, -rx, rx * 2, rx * 2);
      b.restore();
    },

    spark(k, t) {
      const age = t - this.sparkT;
      if (age > 0.4) return 0;
      const pick = (Math.sin(k * 91.7 + this.sparkSeed * 13.1) * 43758.5) % 1;
      if (Math.abs(pick) > 0.45) return 0;
      return this.env.hat * Math.exp(-age / 0.09);
    },

    drawGlitter(g, W, H, sch, sunX, t) {
      const hy = this.hy;
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = 1.4;
      const hl = this.env.hatLvl || 0;
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      const ripP = new Path2D();
      const wrapW = W + 200;
      for (const q of this.rip) {
        const y = hy + 3 + q.d * (H - hy);
        const x = ((q.x - this.cam * (0.12 + 1.3 * q.d)) % wrapW + wrapW) % wrapW - 100;
        ripP.moveTo(x, y); ripP.lineTo(x + q.len, y);
      }
      g.strokeStyle = rgba(mixc(sch.sky[2], sch.sun, 0.4), 0.16);
      g.stroke(ripP);
      for (const q of this.glit) {
        const y = hy + 2 + q.d * (H - hy);
        const spread = 30 + q.d * 150;
        const x = sunX + q.off * spread * (0.6 + 0.4 * Math.sin(t * 0.3 + q.ph));
        const tw = 0.5 + 0.5 * Math.sin(t * q.f + q.ph);
        const a = (0.1 + 0.3 * tw * tw) * (1 - 0.5 * q.d) + 0.9 * this.spark(q.k, t) + 0.15 * hl;
        if (a < 0.03) continue;
        const k = a < 0.2 ? 0 : a < 0.45 ? 1 : 2;
        paths[k].moveTo(x - q.len, y); paths[k].lineTo(x + q.len, y);
      }
      const lv = [0.12, 0.28, 0.6];
      for (let k = 0; k < 3; k++) { g.strokeStyle = rgba(sch.sun, lv[k]); g.stroke(paths[k]); }
      g.globalCompositeOperation = 'source-over';
    },

    drawFlock(g, W, H, params, sch, e, E, kick, T, t, far) {
      const n = far ? Math.min(800, (params.birds * 0.12) | 0) : Math.min(MAX_BIRDS, params.birds | 0);
      if (far) T = T * 0.8 + 41;
      const s = this.seed;
      const fold = params.fold;
      const push = params.push;
      const split = far ? 0 : this.split;

      const cxAt = far
        ? (tt) => W * (0.5 + 0.34 * Math.sin(0.07 * tt + s.f))
        : (tt) => W * (0.5 + 0.13 * Math.sin(0.11 * tt + s.a) + 0.05 * Math.sin(0.27 * tt + s.b));
      const cyAt = far
        ? (tt) => this.hy - H * (0.17 + 0.04 * Math.sin(0.2 * tt + s.a))
        : (tt) => H * (0.32 + 0.05 * E + 0.05 * Math.sin(0.15 * tt + s.c) + 0.03 * Math.sin(0.37 * tt + s.d));
      // A split flock's two halves are each smaller, so the whole is shrunk a
      // little to keep both sheets in the sky.
      const R = (far ? 38 : 150) * (1 + (far ? 0.35 : 0.85) * E + 0.25 * e.bass * push) * (1 + 0.12 * Math.sin(0.19 * T + s.e)) * (1 - 0.05 * Math.min(1.3, kick)) * (1 - 0.18 * split);
      const L = R * (1.8 + 0.5 * Math.sin(0.1 * T + s.f));
      const Hh = R * (far ? 0.6 : 0.42 + 0.18 * Math.sin(0.14 * T + 1));
      const A2 = R * (0.25 + 0.45 * fold * (0.35 + 0.65 * E));
      const twistAmp = fold * (0.9 + 1.0 * E) * (0.55 + 0.45 * Math.sin(0.083 * T + s.b));
      const bend = fold * (0.7 + 0.8 * E) * Math.sin(0.061 * T + s.c);
      const undul = R * (0.25 + 0.25 * E);
      const pitch = 0.35 * Math.sin(0.05 * T + s.d);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const F = far ? 900 : 1500;
      const lag = 0.9;
      const turnDelay = 0.7;
      const turnDur = 0.32;

      // The split: the two sheets orbit a shared centre, one each side, while
      // their folds run on different clocks and twist opposite ways, so they
      // curl past each other like two flocks passing through.
      const orb = 0.33 * T + s.e;
      // The vertical swing is kept short: at 0.5 R the lower sheet sank below
      // the horizon into the reeds in the drop, when R is at its largest.
      const sox = R * 0.95 * split * Math.cos(orb), soy = R * 0.34 * split * Math.sin(orb);

      while (!far && this.turns.length && t - this.turns[0].t0 > turnDelay + turnDur) {
        this.yawBase += this.turns[0].amt;
        this.turns.shift();
      }
      const yaw0 = this.yawBase + 0.9 * Math.sin(0.043 * T + s.e) + 0.05 * T;
      const turns = this.turns;
      const kicks = this.kicks;

      const P = [new Path2D(), new Path2D(), new Path2D()];
      const Rf = new Path2D();
      const mirrorMin = 2 * this.hy - H;
      let refl = 0;

      const jit = far ? 0.4 : 1.8, fs = far ? 0.6 : 1.6;
      const U = this.U, V = this.V, Wd = this.Wd, Ph = this.Ph, Fq = this.Fq, Jt = this.Jt, Gs = this.Gs;
      for (let i = 0; i < n; i++) {
        const gs = split > 0.001 ? Gs[i] : 0;
        const u = U[i];
        let v = V[i];
        // Each sheet re-centres on its own half of the lens so it becomes a
        // whole ribbon, not half of one.
        if (gs) v = v - gs * 0.5 * split;
        const tl = T - lag * (u + 1) + gs * split * 3.1;
        let X = u * L + jit * Jt[i] * Math.sin(t * 0.7 + Ph[i]);
        let Y = v * Hh * (1 - 0.35 * u * u) + undul * Math.sin(2.1 * u + 0.9 * tl) + jit * Jt[i] * Math.cos(t * 0.53 + Ph[i] * 1.3);
        let Z = Wd[i] * R * (far ? 0.22 : 0.13) + A2 * Math.sin(1.6 * u + 1.1 * v + 0.6 * tl);
        const other = gs < 0 ? split : 0;
        const tw = twistAmp * u * (1 - 1.6 * other) + 0.6 * Math.sin(0.31 * tl + s.a);
        const ct = Math.cos(tw), st = Math.sin(tw);
        let y2 = Y * ct - Z * st; Z = Y * st + Z * ct; Y = y2;
        const be = bend * u * (1 - 2 * other);
        const cb = Math.cos(be), sb = Math.sin(be);
        let x2 = X * cb - Z * sb; Z = X * sb + Z * cb; X = x2;
        let kr = 0;
        if (!far) {
          const kd = (u + 1.2) * 0.14;
          for (let k = 0; k < kicks.length; k++) {
            const q = (t - kicks[k].t0 - kd) / 0.2;
            if (q > 0 && q < 1) kr = Math.max(kr, kicks[k].s * Math.sin(Math.PI * q));
          }
          if (kr > 0) { const c = 1 - 0.3 * kr * push; X *= c; Y *= c; Z *= c; }
        }
        let yaw = yaw0 + gs * split * 0.5, bank = 0;
        const delay = (u + 1.25) * 0.5 * turnDelay;
        for (let k = 0; k < turns.length; k++) {
          const q = (t - turns[k].t0 - delay) / turnDur;
          if (q <= 0) continue;
          if (q >= 1) { yaw += turns[k].amt; continue; }
          const sq = q * q * (3 - 2 * q);
          yaw += turns[k].amt * sq;
          const bq = Math.sin(Math.PI * q);
          const bk = turns[k].s * bq * bq * bq;
          if (bk > bank) bank = bk;
        }
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        x2 = X * cy - Z * sy; Z = X * sy + Z * cy; X = x2;
        y2 = Y * cp - Z * sp; Z = Y * sp + Z * cp; Y = y2;

        const ps = F / (F + Z);
        const tc = T - 1.2 * (u + 1) * 0.5;
        const sx = cxAt(tc) + X * ps + gs * sox;
        const sy2 = cyAt(tc) + Y * ps + gs * soy;
        if (sx < -10 || sx > W + 10 || sy2 < -10 || sy2 > H + 10) continue;

        // Banking birds show more wing, so a clap's turn is a band of darker,
        // heavier birds sweeping through: V1 coloured it, the sky does not.
        const face = Math.abs(ct);
        const ink = ps * (0.45 + 0.9 * (1 - face) + 1.5 * bank + 1.8 * kr * push);
        const flap = Math.sin(t * Fq[i] + Ph[i]);
        const len = fs * (1.15 * ink * (0.75 + 0.25 * flap) + 0.35);
        const ang = 0.9 * flap + 0.3 * sy + 0.4 * Math.sin(Ph[i] * 3);
        const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;

        const b = ink < 0.75 ? 0 : ink < 1.2 ? 1 : 2;
        P[b].moveTo(sx - dx, sy2 - dy); P[b].lineTo(sx + dx, sy2 + dy);
        if (b > 0 && !far && sy2 > mirrorMin) { Rf.moveTo(sx - dx, sy2 - dy); Rf.lineTo(sx + dx, sy2 + dy); refl++; }
      }

      // Near-black whatever the sky: the drop's afterglow is what changes,
      // so the flock only gets more contrast as the music gets bigger.
      const bird = far ? mixc([12, 6, 16], sch.sky[1], 0.45) : mixc([10, 5, 12], sch.dark, 0.12);
      const widths = far ? [0.9, 1.1, 1.4] : [1.3, 1.9, 2.7];
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'butt';
      for (let b = 0; b < 3; b++) {
        g.strokeStyle = rgba(bird, 0.62 + 0.18 * b);
        g.lineWidth = widths[b];
        g.stroke(P[b]);
      }

      // Into the long exposure: only the heavier buckets (the edge-on folds,
      // the lines that give the flock its shape), thick and faint, so it
      // accumulates into smoky streaks rather than a copy of the flock.
      if (!far && this.exOn) {
        const x = this.exc;
        x.setTransform(this.ex.width / W, 0, 0, this.ex.height / this.hy, 0, 0);
        x.globalCompositeOperation = 'source-over';
        x.lineCap = 'butt';
        const smoke = mixc([14, 6, 14], sch.dark, 0.3);
        x.lineWidth = 4;
        x.strokeStyle = rgba(smoke, 0.05);
        x.stroke(P[2]);
        x.strokeStyle = rgba(smoke, 0.018);
        x.stroke(P[1]);
      }

      if (!far && refl) {
        const hy = this.hy;
        g.save();
        g.beginPath(); g.rect(0, hy + 1, W, H - hy); g.clip();
        g.translate(0, 2 * hy);
        g.scale(1, -1);
        const wet = mixc(bird, sch.sky[1], 0.25);
        g.strokeStyle = rgba(wet, 0.32);
        g.lineWidth = widths[1];
        g.stroke(Rf);
        g.restore();
      }
    },

    drawReeds(g, W, H, params, sch, e, E, t) {
      g.lineCap = 'round';
      const dens = params.reeds;
      const reeds = this.reedList;
      const col = [6, 3, 10];
      const rim = mixc(sch.sun, sch.lit, 0.4);
      const plumeCol = mixc(sch.sun, sch.lit, 0.3);
      const hl = e.hatLvl || 0;
      const body = new Path2D();
      const rimP = new Path2D();
      const tips = [];
      for (let i = 0; i < reeds.length; i++) {
        const r = reeds[i];
        if (r.glint > dens) continue;
        const wind = 0.05 * Math.sin(t * 0.8 + r.ph) + 0.03 * Math.sin(t * 1.9 + r.ph * 2.3) + 0.04 * e.bass * Math.sin(t * 3 + r.ph);
        const lean = r.lean + wind;
        const sp0 = this.reedSpan;
        const bx = ((r.x - this.cam * r.depth) % sp0 + sp0) % sp0 - (sp0 - W) / 2;
        if (bx < -r.h * 0.6 - 20 || bx > W + r.h * 0.6 + 20) continue;
        const by = H + 4;
        const tx = bx + lean * r.h, ty = H - r.h;
        const mx = bx + lean * r.h * 0.35, my = H - r.h * 0.5;
        const w = r.w;
        body.moveTo(bx - w, by);
        body.quadraticCurveTo(mx - w * 0.6, my, tx, ty);
        body.quadraticCurveTo(mx + w * 0.6, my, bx + w, by);
        body.closePath();
        rimP.moveTo(mx + w * 0.3 + (tx - mx) * 0.1, my + (ty - my) * 0.1);
        rimP.quadraticCurveTo(mx + w * 0.4, my - r.h * 0.1, tx, ty);
        if (r.cat) {
          body.ellipse(tx - lean * 12, ty + 12, 3.2, 12, Math.atan(lean), 0, Math.PI * 2);
        }
        if (r.plume) tips.push([tx, ty, lean, r.glint, r.h]);
      }
      g.fillStyle = rgba(col);
      g.fill(body);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(rim, 0.18 + 0.25 * hl);
      g.lineWidth = 1;
      g.stroke(rimP);

      for (const [tx, ty, lean, k, h] of tips) {
        const sp = this.spark(k, t);
        const a = 0.14 + 0.2 * hl + 0.7 * sp;
        g.strokeStyle = rgba(plumeCol, a);
        g.lineWidth = 1.1;
        const size = 10 + h * 0.05;
        g.beginPath();
        for (let j = 0; j < 7; j++) {
          const aa = -Math.PI / 2 + lean * 1.5 + (j - 3) * 0.28 + 0.12 * Math.sin(t * 2 + j + k * 10);
          const l = size * (0.6 + 0.4 * Math.cos((j - 3) * 0.5));
          g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(aa) * l * 0.6, ty + Math.sin(aa) * l * 0.6,
            tx + Math.cos(aa + 0.5 + lean) * l, ty + Math.sin(aa + 0.5 + lean) * l);
        }
        g.stroke();
        if (sp > 0.1) {
          // A tight catch-light on the plume, warm cream rather than white.
          const rr = 2 + 4 * sp;
          const grd = g.createRadialGradient(tx, ty, 0, tx, ty, rr * 2);
          grd.addColorStop(0, rgba([255, 238, 205], 0.65 * sp));
          grd.addColorStop(1, rgba(plumeCol, 0));
          g.fillStyle = grd;
          g.beginPath(); g.arc(tx, ty, rr * 2, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    },

    drawMotes(g, W, H, sch, e, E, t, dt) {
      g.globalCompositeOperation = 'lighter';
      const col = mixc(sch.sun, sch.lit, 0.35);
      for (const m of this.motes) {
        m.x += (-this.travelV * (0.6 + 0.3 * m.z) + 0.3 * m.vx + 6 * Math.sin(t * 0.4 + m.ph)) * dt;
        m.y += (m.vy + 4 * Math.cos(t * 0.5 + m.ph)) * dt;
        if (m.x > W + 30) m.x -= W + 60;
        if (m.x < -30) m.x += W + 60;
        if (m.y < -30) m.y += H + 60;
        const sp = this.spark(m.k, t);
        const a = 0.12 + 0.18 * Math.sin(t * 1.3 + m.ph) ** 2 + 0.8 * sp;
        g.fillStyle = rgba(col, a);
        g.beginPath(); g.arc(m.x, m.y, m.z * (0.6 + 0.8 * sp), 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    },
  });
})();
