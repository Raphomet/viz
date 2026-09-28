// Pen on Paper — batch 06, idea 8 (harness/briefs/batch-06-ideas.md).
//
// A pen plotter on a dark desk, its pen hung from pendulums: a harmonograph
// drawn by a machine you can see. One cream sheet under a lamp, a gantry rail
// riding up and down it with a carriage and a pen, and one continuous line
// being drawn in real time. The idea offered two drawings (the Purist's TSP /
// stipple plotter, the Curator's harmonograph); this is the harmonograph, built
// as the Purist's plotter. The harmonograph wins because it can hear: a nudge
// visibly bends the figure from that point on, bass can hold the swing up or
// let it spiral in, and a decaying spiral is exactly the thing to fall into.
// A TSP rendering of a field would draw the same picture whatever the music.
// From the Purist it keeps the visible tool (Zen's rake), ink pooling where the
// pen slows, and the pen swap on the snare.
//
// The pendulums are complex phasors (x = Re z, z *= e^{(iw - d)dt}), so a kick
// can add a velocity impulse without moving the pen: z += -i dv / w. The figure
// bends from where the kick lands, and nothing jumps.
//
// Music, each in its own place:
//   kick   nudges one pendulum (the figure bends from there on) and presses the
//          pen down: a small ink blot bleeds into the paper where the beat
//          landed, so the drop's line is beaded with its own beats
//   snare  swaps the pen: the turret on the carriage turns and the line
//          changes ink
//   bass   holds the swing (damping): loud passages sustain the figure, quiet
//          ones let it spiral in
//   hats   the pen chatters (a fine tremor in the line) and the carriage LED
//          blinks
//   drop   the pendulums are pumped back up, they swing faster, the pen
//          thickens, a rotary pendulum turns the figure into rosettes, and a
//          second rail slides in carrying a vermilion pen with its own figure;
//          the breakdown lifts the pens and slides a fresh vellum sheet over
//          the drawing, which stays faintly visible beneath
//
// The sheet never saturates: it turns over when the swing has died, when the
// sheet's ink coverage passes a limit, after Sheet life seconds, or when the
// drop ends. Each vellum lays the old drawing to a 16% ghost, so ghosts of
// ghosts fade geometrically. The drawing accumulates in a device-pixel
// offscreen canvas; per frame the scene composites the desk, the sheet and the
// machine, and strokes one short polyline per pen into the buffer.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const SQRT2 = Math.SQRT2;

  const STOCK = [
    {
      name: 'Cream and iron-gall',
      desk: '#231e1a', grainHi: 'rgba(255,220,180,0.035)', grainLo: 'rgba(0,0,0,0.18)',
      paper: '#ede5d2', fibre: 'rgba(120,95,60,0.06)',
      inks: ['#1c1a1f', '#233f7c', '#6a3b1f'], accent: '#d63a1c',
      rail: '#8a8e95', railHi: '#c4c8ce', railLo: '#4b4e54', carriage: '#26282d',
    },
    {
      name: 'Blueprint',
      desk: '#17191d', grainHi: 'rgba(200,220,255,0.03)', grainLo: 'rgba(0,0,0,0.2)',
      paper: '#1f3b6b', fibre: 'rgba(170,200,255,0.05)',
      inks: ['#e8edf1', '#f0d47a', '#9ed2e6'], accent: '#ff8e5e',
      rail: '#9aa0a8', railHi: '#d7dbe0', railLo: '#555a61', carriage: '#2a2d33',
    },
    {
      name: 'Black card, gel pens',
      desk: '#4a3d31', grainHi: 'rgba(255,225,190,0.05)', grainLo: 'rgba(0,0,0,0.16)',
      paper: '#161618', fibre: 'rgba(255,255,255,0.025)',
      inks: ['#d3d5d9', '#d9b35a', '#e58ea3'], accent: '#5fc8b5',
      rail: '#8a8e95', railHi: '#c4c8ce', railLo: '#4b4e54', carriage: '#1c1d21',
    },
  ];

  // Frequency ratios for the four lateral pendulums (x1, x2, y1, y2). Small
  // integer ratios, then detuned a hair each, which is what makes a
  // harmonograph precess instead of retracing one Lissajous.
  const RATIOS = [
    [2, 3, 3, 2], [1, 3, 3, 1], [2, 1, 1, 3], [3, 4, 4, 3],
    [1, 2, 3, 1], [3, 2, 2, 1], [2, 3, 1, 2], [3, 1, 2, 3],
  ];
  const BASE_HZ = 0.5;          // x speed param x ratio: about a loop a second
  const AMAX = 0.5;              // per lateral pendulum, in half-sheets
  const GHOST = 0.16;            // how much of the old drawing shows through the vellum
  const TURN_S = 1.6;            // sheet slide time
  const MIN_SHEET_S = 8;
  const SOFT = Math.tanh(1.15);

  const PRESETS = {
    calm: { speed: 0.7, sustain: 0.35, weight: 1.3, rotary: 0.12, pen2: 0, nudge: 0.8 },
    drop: { speed: 1.25, sustain: 0.9, weight: 2.0, rotary: 0.45, pen2: 1, nudge: 1.5 },
    // White and yellow ink on blueprint, rosettes turning slowly.
    blueprint: { inks: 1, speed: 0.55, sustain: 0.7, weight: 1.2, rotary: 0.85, pen2: 0.0, nudge: 1 },
    // Gel pens on black card, both pens, a long sheet: the late-night look.
    nightcard: { inks: 2, speed: 1.0, sustain: 0.8, weight: 1.3, rotary: 0.3, pen2: 1, nudge: 1.2, life: 90 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['speed', 'sustain', 'weight', 'rotary', 'pen2', 'nudge'];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    return c;
  }

  // One pendulum: phasor z = (re, im), angular rate w (rad per unit speed-second).
  function osc(amp, ratio, detune) {
    const ph = Math.random() * TAU;
    return { re: amp * Math.cos(ph), im: amp * Math.sin(ph), ratio: ratio * (1 + detune) };
  }
  function step(o, w, decay, dt) {
    const th = w * dt, k = Math.exp(-decay * dt);
    const c = Math.cos(th) * k, s = Math.sin(th) * k;
    const re = o.re * c - o.im * s;
    o.im = o.re * s + o.im * c;
    o.re = re;
  }
  function mag(o) { return Math.hypot(o.re, o.im); }
  function capTo(o, m) { const a = mag(o); if (a > m) { o.re *= m / a; o.im *= m / a; } }

  function newPen(which) {
    const r = RATIOS[Math.floor(Math.random() * RATIOS.length)];
    const dt = () => (Math.random() < 0.5 ? -1 : 1) * (0.0012 + Math.random() * 0.0035);
    const s = 0.4 + Math.random() * 0.2;    // how the swing splits between each pair
    const a = (which === 0 ? 0.98 : 0.85) * 2 * AMAX;
    return {
      p: [osc(a * s, r[0], dt()), osc(a * (1 - s), r[1], dt()),
        osc(a * (1 - s), r[2], dt()), osc(a * s, r[3], dt())],
      rot: osc(0.9, r[Math.floor(Math.random() * 2)] * (Math.random() < 0.5 ? 1 : -1), dt()),
      release: 0,
    };
  }

  VIZ.register({
    id: 'plotter',
    name: 'Pen on Paper',
    order: 808,

    params: [
      { key: 'speed', label: 'Pendulum speed', type: 'range', min: 0.2, max: 2.5, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'sustain', label: 'Sustain (bass holds the swing)', type: 'range', min: 0, max: 1, default: PRESETS.calm.sustain, step: 0.01 },
      { key: 'weight', label: 'Pen weight', type: 'range', min: 0.4, max: 3, default: PRESETS.calm.weight, step: 0.01 },
      { key: 'rotary', label: 'Rotary pendulum', type: 'range', min: 0, max: 1, default: PRESETS.calm.rotary, step: 0.01 },
      { key: 'pen2', label: 'Second pen', type: 'range', min: 0, max: 1, default: PRESETS.calm.pen2, step: 0.01 },
      { key: 'nudge', label: 'Kick nudge', type: 'range', min: 0, max: 2, default: PRESETS.calm.nudge, step: 0.01 },
      { key: 'inks', label: 'Paper and inks', type: 'select', options: STOCK.map((s) => s.name), default: 0 },
      { key: 'life', label: 'Sheet life (s)', type: 'range', min: 15, max: 180, default: 50, step: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    actions: [
      { id: 'sheet', label: 'New sheet', run() { this.wantSheet = true; } },
    ],

    gallery: {
      title: 'Pen on Paper',
      technique: 'Canvas 2D: a harmonograph (four damped lateral pendulums plus a rotary one, as complex phasors) drives a drawn pen plotter; the line is stroked each frame into a device-pixel offscreen sheet with pooling where the pen slows; sheets turn over under a translucent vellum that bakes the old drawing to a ghost; a section follower easing between calm and drop presets',
      brief: 'A pen plotter on a dark desk under a lamp: a cream sheet, an aluminium rail riding up and down it, and a pen hung from pendulums drawing one continuous harmonograph line in real time, thickening where it slows at the turns. Each kick nudges one pendulum, so the figure bends from that point on, and presses the pen down into a small bleeding ink blot, beading the line with the beat. Each snare turns the pen turret and the line changes ink. Bass holds the swing up; in quiet passages the figure spirals in. Hats make the pen chatter and blink the carriage LED. The drop pumps the pendulums back to full swing, speeds and thickens them, turns the figure toward rosettes, and slides in a second rail with a vermilion pen drawing its own figure across the first. The breakdown lifts the pens and slides a fresh vellum sheet over the drawing, which stays faintly beneath.',
      lineage: [
        'Batch 06, idea 8 (Purist, Curator): "Pen on paper": plotter and harmonograph; Thresholds, Zen, Attractor.',
        'The Curator\'s Harmonograph: kick nudges a pendulum, bass sets the damping, a second pen in red on the drop, a fresh sheet on the breakdown with the last drawing faint beneath.',
        'The Purist\'s Plotter: the pen always visible, one continuous path, ink pooling where the pen slows, the pen swap on the snare.',
        'Zen (web/scenes/zen.js): the visible tool that writes the image; Attractor: one orbit as the subject; Thresholds: line work, no glow.',
      ],
    },

    setup() {},

    enter() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kOn: 0, kArm: true, kLast: -9, cf: 0, cs: 0, cArm: true, cLast: -9,
        bass: 0, hat: 0, low: 0, dropOn: false, auto: 0, wasDrop: false };
      this.pens = [newPen(0), newPen(1)];
      this.inkIdx = [0, 0];
      this.turret = [0, 0];
      this.last = [null, null];
      this.chatter = [0, 0];
      this.lift = [0, 0];       // 0 = down on the paper, 1 = lifted
      this.dip = [0, 0];        // kick press, for the pen's shadow
      this.blots = [];
      this.rings = [];
      this.kicks = 0;
      this.led = 0;
      this.sheetAge = 0;
      this.coverage = 0;
      this.turn = null;
      this.wantSheet = false;
      this.buf = null;
      this.stockIdx = -1;
      this.seed = [Math.random() * 100, Math.random() * 100, Math.random() * 100];
    },

    // ---- offscreen sheets -------------------------------------------------
    paperTexture(w, h, st) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      g.fillStyle = st.paper;
      g.fillRect(0, 0, w, h);
      // Fibres: short faint strokes, a laid texture you only see up close.
      g.strokeStyle = st.fibre;
      g.lineWidth = Math.max(1, w / 1400);
      const n = Math.round((w * h) / 900);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const a = Math.random() * TAU, l = (2 + Math.random() * 6) * (w / 900);
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      g.stroke();
      return c;
    },

    deskTexture(w, h, st) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      g.fillStyle = st.desk;
      g.fillRect(0, 0, w, h);
      // Wood grain: long, slightly wavy horizontal streaks.
      for (let i = 0; i < 180; i++) {
        const y0 = Math.random() * h, amp = 2 + Math.random() * 10, fr = 0.5 + Math.random() * 2;
        g.strokeStyle = Math.random() < 0.5 ? st.grainHi : st.grainLo;
        g.lineWidth = (0.5 + Math.random() * 2.5) * (h / 720);
        g.beginPath();
        for (let x = -10; x <= w + 10; x += 16) {
          const y = y0 + amp * Math.sin((x / w) * TAU * fr + i);
          if (x < 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      // The lamp: warm pool, upper left, falling off to the corners.
      const gr = g.createRadialGradient(w * 0.42, h * 0.38, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.62);
      gr.addColorStop(0, 'rgba(255,230,190,0.07)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      return c;
    },

    ensureBuffers(p, ctx, sw, sh, st, stockIdx) {
      const pd = p.pixelDensity();
      const unitPx = (p.width * pd) / ctx.width;
      const bw = Math.round(sw * unitPx), bh = Math.round(sh * unitPx);
      if (!this.buf || this.buf.width !== bw || this.buf.height !== bh || this.stockIdx !== stockIdx) {
        const paper = this.paperTexture(bw, bh, st);
        const nb = makeCanvas(bw, bh);
        const g = nb.getContext('2d');
        g.drawImage(paper, 0, 0);
        if (this.buf && this.stockIdx === stockIdx) g.drawImage(this.buf, 0, 0, bw, bh);
        else if (this.buf) { g.globalAlpha = GHOST; g.drawImage(this.buf, 0, 0, bw, bh); g.globalAlpha = 1; }
        const first = !this.buf;
        this.buf = nb;
        this.paper = paper;
        this.stockIdx = stockIdx;
        this.last = [null, null];
        if (first) this.prime(st, sw, sh, unitPx);
      }
      const dw = Math.round(p.width * pd), dh = Math.round(p.height * pd);
      if (!this.desk || this.desk.width !== dw || this.desk.height !== dh || this.deskStock !== stockIdx) {
        this.desk = this.deskTexture(dw, dh, st);
        this.deskStock = stockIdx;
      }
      this.unitPx = unitPx;
    },

    // The first sheet is laid over an earlier drawing, so the desk never
    // opens on a blank page: a whole figure simulated at once, then vellum.
    prime(st, sw, sh, unitPx) {
      const g = this.buf.getContext('2d');
      g.setTransform(unitPx, 0, 0, unitPx, this.buf.width / 2, this.buf.height / 2);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = st.inks[0];
      g.lineWidth = 1.4;
      const pen = newPen(0), P = { rotary: 0.2 };
      const hx = sw * 0.5 * 0.9, hy = sh * 0.5 * 0.88;
      const w0 = TAU * BASE_HZ * 0.8, decay = Math.LN2 / 16, h = 1 / 120;
      g.beginPath();
      for (let i = 0; i < 120 * 45; i++) {
        for (const o of pen.p) step(o, w0 * o.ratio, decay, h);
        step(pen.rot, w0 * pen.rot.ratio, decay, h);
        const q = this.penPos(pen, P, hx, hy, false);
        if (i === 0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]);
      }
      g.stroke();
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.bakeSheet();
    },

    // Lay the vellum: the old drawing under translucent fresh paper.
    bakeSheet() {
      const g = this.buf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1 - GHOST;
      g.drawImage(this.paper, 0, 0);
      g.globalAlpha = 1;
      this.coverage = 0;
      this.sheetAge = 0;
      this.last = [null, null];
    },

    // ---- music ------------------------------------------------------------
    listen(signals, dt, T) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp((e.kf - e.ks) * 2.2, 0, 1);
      let kick = 0;
      if (e.kArm && kOn > 0.3 && T - e.kLast > 0.2) { kick = clamp(kOn * 1.6, 0.4, 1); e.kLast = T; e.kArm = false; }
      if (kOn < 0.12) e.kArm = true;
      const cl = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp((e.cf - e.cs) * 3, 0, 1);
      let clap = 0;
      if (e.cArm && cOn > 0.3 && T - e.cLast > 0.35) { clap = 1; e.cLast = T; e.cArm = false; }
      if (cOn < 0.1) e.cArm = true;
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 1.2, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 8, dt);
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap };
    },

    // Pen position in sheet units (origin at the sheet centre).
    penPos(pen, P, hx, hy, flip) {
      const kL = 1 - 0.6 * P.rotary, kR = 0.6 * P.rotary;
      const o = pen.p;
      let x = kL * (o[0].re + o[1].re) + kR * pen.rot.re;
      let y = kL * (o[2].re + o[3].re) + kR * pen.rot.im;
      if (flip) { const t = x; x = -y; y = t; }
      // A soft edge instead of the sheet's: the swing fills the page and
      // flattens as it nears the margin, like a pen arm reaching its stop.
      return [hx * Math.tanh(1.15 * x) / SOFT, hy * Math.tanh(1.15 * y) / SOFT];
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const T = this.clock;
      const ev = this.listen(signals, dt, T);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.6, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      const stockIdx = clamp(Math.round(params.inks), 0, STOCK.length - 1);
      const st = STOCK[stockIdx];

      // ---- layout: a landscape sheet on the desk, whatever the stage shape.
      const W = ctx.width, H = ctx.height;
      const sh = Math.min(H * 0.86, (W * 0.84) / SQRT2);
      const sw = sh * SQRT2;
      this.ensureBuffers(p, ctx, sw, sh, st, stockIdx);
      const unitPx = this.unitPx;
      const hx = sw * 0.5 * 0.9, hy = sh * 0.5 * 0.88;

      // ---- sheet turnover
      this.sheetAge += dt;
      const dropEnded = follow && e.wasDrop && !e.dropOn;
      e.wasDrop = e.dropOn;
      if (dropEnded && this.sheetAge > 4) this.wantSheet = true;
      const swing = mag(this.pens[0].p[0]) + mag(this.pens[0].p[1]) + mag(this.pens[0].p[2]) + mag(this.pens[0].p[3]);
      if (!this.turn && (this.wantSheet || (this.sheetAge > MIN_SHEET_S &&
          (swing < 0.16 || this.sheetAge > params.life || this.coverage > 0.5)))) {
        this.turn = { t: 0 };
        this.wantSheet = false;
      }
      let slide = 0;
      if (this.turn) {
        this.turn.t += dt / TURN_S;
        slide = easeInOut(clamp(this.turn.t, 0, 1));
        if (this.turn.t >= 0.5 && !this.turn.released) {
          // Pendulums pulled back and let go while the vellum covers the sheet.
          this.turn.released = true;
          const from = this.pens.map((q) => q.pos || [0, 0]);
          this.pens = [newPen(0), newPen(1)];
          this.pens.forEach((q, i) => { q.from = from[i]; q.blend = 0; });
        }
        if (this.turn.t >= 1) { this.bakeSheet(); this.turn = null; slide = 0; }
      }
      const lifted = !!this.turn;

      // ---- pendulums
      const w0 = TAU * BASE_HZ * P.speed;
      // Bass holds the swing: half-life from ~10 s (quiet, no sustain) to ~80 s.
      const half = 10 + 70 * P.sustain * (0.3 + 0.7 * clamp(e.bass * 1.4, 0, 1));
      const decay = Math.LN2 / half;
      // Above sustain 0.6 a motor pumps the swing back up: the drop's swell.
      const pump = Math.max(0, P.sustain - 0.6) * 1.2;
      const activeP2 = P.pen2 > 0.02;

      // Kicks: a pendulum nudged along its own velocity (mostly a push, now and
      // then a check), alternating pens when both are down.
      if (ev.kick) {
        this.kicks++;
        const pi = activeP2 && P.pen2 > 0.9 && (this.kicks & 1) ? 1 : 0;
        const pen = this.pens[pi];
        const which = (this.kicks >> 1) % 5;
        const o = which < 4 ? pen.p[which] : pen.rot;
        const m = 0.07 * P.nudge * ev.kick;
        if (which < 4) {
          const sgn = (o.im > 0 ? 1 : -1) * (Math.random() < 0.85 ? 1 : -1);
          o.im += sgn * m * 1.4;
          capTo(o, AMAX);
        } else {
          const a = mag(o) || 1e-3;
          o.re *= 1 + m / a; o.im *= 1 + m / a;
          capTo(o, 1);
        }
        this.dip[pi] = 1;
        this.rings.push({ pi, age: 0, k: ev.kick });
        if (!lifted) this.blotFor = { pi, k: ev.kick };
      }
      if (ev.clap) {
        this.inkIdx[0] = (this.inkIdx[0] + 1) % 3;
      }
      this.led = Math.max(this.led * Math.exp(-dt * 14), e.hat > 0.18 ? e.hat : 0);

      // ---- draw the line into the sheet
      const g = this.buf.getContext('2d');
      const bw = this.buf.width, bh = this.buf.height;
      g.setTransform(unitPx, 0, 0, unitPx, bw / 2, bh / 2);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';

      const inkOf = (pi) => (pi === 0 ? st.inks[this.inkIdx[0]] : st.accent);
      const hatAmp = 0.6 * clamp(e.hat * 1.5, 0, 1);

      for (let pi = 0; pi < 2; pi++) {
        const pen = this.pens[pi];
        const flip = pi === 1;
        const wantDown = !lifted && (pi === 0 || P.pen2 > 0.96);
        this.lift[pi] = ease(this.lift[pi], wantDown ? 0 : 1, wantDown ? 10 : 14, dt);
        this.dip[pi] = Math.max(0, this.dip[pi] - dt * 5);
        this.turret[pi] = ease(this.turret[pi], pi === 0 ? this.inkIdx[0] : 0, 18, dt);

        // Estimate path length this frame to pick the substep count.
        const before = this.penPos(pen, P, hx, hy, flip);
        const v0 = w0 * 3 * Math.max(hx, hy) * 0.5;
        const n = clamp(Math.ceil((v0 * dt) / 2) + 2, 3, 80);
        const pts = [];
        let len = 0, px = before[0], py = before[1];
        for (let i = 0; i < n; i++) {
          const h = dt / n;
          for (const o of pen.p) {
            step(o, w0 * o.ratio, decay, h);
            if (pump > 0) { const a = mag(o); const tgt = AMAX * 0.8; if (a < tgt) { const f = 1 + pump * h * (tgt - a) / Math.max(a, 0.05); o.re *= f; o.im *= f; } }
          }
          step(pen.rot, w0 * pen.rot.ratio, decay * 0.8, h);
          if (pump > 0) { const a = mag(pen.rot); if (a < 0.8) { const f = 1 + pump * h * (0.8 - a) / Math.max(a, 0.05); pen.rot.re *= f; pen.rot.im *= f; } }
          const q = this.penPos(pen, P, hx, hy, flip);
          const dx = q[0] - px, dy = q[1] - py, l = Math.hypot(dx, dy);
          len += l;
          // Chatter: a fine tremor across the direction of travel, on the hats.
          this.chatter[pi] += l * 0.5;
          const c = hatAmp * Math.sin(this.chatter[pi]);
          const nx = l > 1e-6 ? -dy / l : 0, ny = l > 1e-6 ? dx / l : 0;
          pts.push(q[0] + nx * c, q[1] + ny * c);
          px = q[0]; py = q[1];
        }
        pen.pos = [px, py];
        const vel = len / dt;

        if (this.lift[pi] < 0.15 && wantDown) {
          // Ink pools where the pen slows (at the turns of the swing).
          const wgt = P.weight * (0.75 + 1.3 * Math.exp(-vel / 70)) * (pi === 1 ? 0.9 : 1);
          g.strokeStyle = inkOf(pi);
          g.lineWidth = wgt;
          g.beginPath();
          if (this.last[pi]) g.moveTo(this.last[pi][0], this.last[pi][1]);
          else g.moveTo(pts[0], pts[1]);
          for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.stroke();
          this.coverage += (len * wgt) / (sw * sh);
          this.last[pi] = [pts[pts.length - 2], pts[pts.length - 1]];
        } else {
          this.last[pi] = null;
        }
      }

      // Kick blot: the pen pressed down, ink bleeding out over a quarter second.
      if (this.blotFor) {
        const b = this.blotFor;
        const pos = this.pens[b.pi].pos;
        if (this.lift[b.pi] < 0.15) {
          const r = (2 + 3.2 * b.k) * (0.7 + 0.3 * P.weight) * (0.6 + 0.4 * P.nudge);
          const lobes = [];
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * TAU, d = Math.random() * r * 0.35;
            lobes.push([Math.cos(a) * d, Math.sin(a) * d, 0.55 + Math.random() * 0.45]);
          }
          this.blots.push({ x: pos[0], y: pos[1], r, age: 0, ink: inkOf(b.pi), lobes });
        }
        this.blotFor = null;
      }
      for (let i = this.blots.length - 1; i >= 0; i--) {
        const b = this.blots[i];
        b.age += dt;
        const u = 1 - Math.pow(1 - clamp(b.age / 0.28, 0, 1), 2);
        g.fillStyle = b.ink;
        g.beginPath();
        for (const lb of b.lobes) {
          const rr = b.r * lb[2] * u;
          g.moveTo(b.x + lb[0] * u + rr, b.y + lb[1] * u);
          g.arc(b.x + lb[0] * u, b.y + lb[1] * u, rr, 0, TAU);
        }
        g.fill();
        if (b.age > 0.28) this.blots.splice(i, 1);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);

      // ---- composite: desk, sheet, vellum, machine
      const d2 = p.drawingContext;
      d2.save();
      d2.globalCompositeOperation = 'source-over';
      d2.globalAlpha = 1;
      d2.drawImage(this.desk, 0, 0, W, H);

      // A slow drift of the view, as if the desk were being walked round.
      const sd = this.seed;
      const ang = -0.018 + 0.012 * Math.sin(T * 0.041 + sd[0]);
      const cx = W / 2 + 7 * Math.sin(T * 0.033 + sd[1]);
      const cy = H / 2 + 5 * Math.sin(T * 0.029 + sd[2]);
      d2.translate(cx, cy);
      d2.rotate(ang);

      const shadowRect = (x, y, w, h, k) => {
        for (let i = 0; i < 4; i++) {
          const o = (i + 1) * 2.2 * k;
          d2.fillStyle = `rgba(0,0,0,${0.13 - i * 0.025})`;
          d2.fillRect(x + o * 0.6 - i, y + o - i, w + 2 * i, h + 2 * i);
        }
      };
      shadowRect(-sw / 2, -sh / 2, sw, sh, 1.4);
      d2.drawImage(this.buf, -sw / 2, -sh / 2, sw, sh);

      // Incoming vellum: translucent fresh paper sliding in from the right.
      if (this.turn) {
        const off = (1 - slide) * (sw + W * 0.3);
        d2.save();
        d2.globalAlpha = 0.35;
        shadowRect(-sw / 2 + off, -sh / 2, sw, sh, 0.8);
        d2.globalAlpha = 1 - GHOST;
        d2.drawImage(this.paper, -sw / 2 + off, -sh / 2, sw, sh);
        d2.restore();
        // The vellum's edge catches the lamp.
        d2.fillStyle = 'rgba(255,255,255,0.12)';
        d2.fillRect(-sw / 2 + off, -sh / 2, 1.2, sh);
      }

      // The lamp across the sheet.
      const lg = d2.createRadialGradient(-sw * 0.12, -sh * 0.2, 0, 0, 0, Math.hypot(sw, sh) * 0.62);
      lg.addColorStop(0, 'rgba(255,240,215,0.05)');
      lg.addColorStop(0.6, 'rgba(0,0,0,0)');
      lg.addColorStop(1, 'rgba(0,0,0,0.22)');
      d2.fillStyle = lg;
      d2.fillRect(-sw / 2, -sh / 2, sw, sh);

      // ---- the machine
      const span = Math.hypot(W, H);
      const railBar = (horizontal, at, height, k) => {
        // Shadow first, offset down and right from the lamp.
        d2.fillStyle = 'rgba(0,0,0,0.28)';
        if (horizontal) d2.fillRect(-span, at - height / 2 + 7 * k, span * 2, height);
        else d2.fillRect(at - height / 2 + 5 * k, -span, height, span * 2);
        d2.fillStyle = 'rgba(0,0,0,0.14)';
        if (horizontal) d2.fillRect(-span, at - height / 2 + 11 * k, span * 2, height + 3);
        else d2.fillRect(at - height / 2 + 8 * k, -span, height + 3, span * 2);
        d2.fillStyle = st.rail;
        if (horizontal) d2.fillRect(-span, at - height / 2, span * 2, height);
        else d2.fillRect(at - height / 2, -span, height, span * 2);
        d2.fillStyle = st.railHi;
        if (horizontal) d2.fillRect(-span, at - height / 2, span * 2, 1.6);
        else d2.fillRect(at - height / 2, -span, 1.6, span * 2);
        d2.fillStyle = st.railLo;
        if (horizontal) {
          d2.fillRect(-span, at + height / 2 - 1.6, span * 2, 1.6);
          d2.fillRect(-span, at - 1, span * 2, 2);   // the slot the belt runs in
        } else {
          d2.fillRect(at + height / 2 - 1.6, -span, 1.6, span * 2);
          d2.fillRect(at - 1, -span, 2, span * 2);
        }
      };

      const carriage = (x, y, pi, k) => {
        const lift = this.lift[pi];
        const cw = 44, ch = 34;
        d2.fillStyle = 'rgba(0,0,0,0.32)';
        d2.fillRect(x - cw / 2 + 8 * k, y - ch / 2 + 11 * k, cw, ch);
        d2.fillStyle = st.carriage;
        d2.fillRect(x - cw / 2, y - ch / 2, cw, ch);
        d2.fillStyle = 'rgba(255,255,255,0.08)';
        d2.fillRect(x - cw / 2, y - ch / 2, cw, 2);
        // Status LED, blinking on the hats.
        const ledA = pi === 0 ? this.led : this.led * 0.6;
        d2.fillStyle = `rgba(${stockIdx === 1 ? '255,170,90' : '120,230,140'},${0.25 + 0.75 * clamp(ledA * 2, 0, 1)})`;
        d2.fillRect(x + cw / 2 - 7, y - ch / 2 + 4, 3, 3);
        // Pen turret: three pens in a ring, the live one over the paper.
        const inks = pi === 0 ? st.inks : [st.accent, st.accent, st.accent];
        const rot = (-this.turret[pi] / 3) * TAU;
        for (let i = 0; i < 3; i++) {
          const a = rot + (i / 3) * TAU + Math.PI / 2;
          const r = 9;
          const px = x + Math.cos(a) * r * 0.9, py = y + Math.sin(a) * r * 0.55 - 2;
          const front = Math.sin(a) > 0.6;
          if (front) continue;
          d2.fillStyle = inks[i];
          d2.beginPath(); d2.arc(px, py, 4.2, 0, TAU); d2.fill();
          d2.strokeStyle = 'rgba(0,0,0,0.5)'; d2.lineWidth = 1; d2.stroke();
        }
        // The kick's press: a thin ring out of the pen tip across the paper.
        for (const rg of this.rings) {
          if (rg.pi !== pi) continue;
          const u = rg.age / 0.45;
          d2.strokeStyle = pi === 0 ? st.inks[this.inkIdx[0]] : st.accent;
          d2.globalAlpha = 0.7 * (1 - u) * rg.k;
          d2.lineWidth = 1.6 * (1 - u) + 0.4;
          d2.beginPath(); d2.arc(x, y, 9 + 26 * Math.sqrt(u), 0, TAU); d2.stroke();
          d2.globalAlpha = 1;
        }
        // The live pen, drawn at the tip, its shadow showing the lift.
        const tx = x, ty = y;
        const sh2 = 1.5 + 9 * lift - 1.2 * this.dip[pi];
        d2.fillStyle = 'rgba(0,0,0,0.35)';
        d2.beginPath(); d2.arc(tx + sh2 * 0.6, ty + sh2, 6.5, 0, TAU); d2.fill();
        d2.fillStyle = pi === 0 ? st.inks[this.inkIdx[0]] : st.accent;
        const pr = 6 + 1.5 * lift - 0.6 * this.dip[pi];
        d2.beginPath(); d2.arc(tx, ty, pr, 0, TAU); d2.fill();
        d2.strokeStyle = 'rgba(240,240,240,0.85)'; d2.lineWidth = 1.4;
        d2.beginPath(); d2.arc(tx, ty, pr + 1.6, 0, TAU); d2.stroke();
      };

      for (let i = this.rings.length - 1; i >= 0; i--) {
        this.rings[i].age += dt;
        if (this.rings[i].age > 0.45) this.rings.splice(i, 1);
      }
      // Pen 1 rides a horizontal rail; pen 2's rail runs across it, higher.
      // After a release the carriages travel to the new swing instead of jumping.
      const shown = (pen) => {
        if (pen.from && pen.blend < 1) {
          pen.blend = Math.min(1, pen.blend + dt / 0.7);
          const u = easeInOut(pen.blend);
          return [lerp(pen.from[0], pen.pos[0], u), lerp(pen.from[1], pen.pos[1], u)];
        }
        return pen.pos;
      };
      const p1 = shown(this.pens[0]);
      const p1x = p1[0], p1y = p1[1];
      railBar(true, p1y, 16, 1);
      carriage(p1x, p1y, 0, 1);
      if (P.pen2 > 0.005) {
        const pres = smooth(0, 0.96, P.pen2);
        const p2 = shown(this.pens[1]);
        const park = W / 2 + 140;
        const rx = lerp(park, p2[0], pres);
        railBar(false, rx, 16, 1.5);
        carriage(rx, p2[1], 1, 1.5);
      }
      d2.restore();
    },
  });
})();
