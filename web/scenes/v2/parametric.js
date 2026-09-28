// Parametric Lines V2 — Raph's 2016 string art (../../viz/parametric.js,
// ../../../ParametricLines.pde) restaged as an engraved plate. Notes in
// harness/v2/parametric.md.
//
// The rule is untouched: two points trace Raph's four functions x1, y1, x2,
// y2 (same constants, same Curve ratio x0), a line is ruled between them, and
// the trail walks forward in t. What V1 got wrong was staging: its trail
// length was band0 × 50, so outside a kick there was nothing on screen, and
// every judge saw a black frame. Here the trail is always long, and each chord
// is laid once into a ring buffer and kept, so the figure morphs as new lines
// replace old ones instead of being recomputed from frameCount. That is what
// lets speed, curve ratio and amplitude follow the music without the figure
// jumping, and it makes the ribbon a record: the gaps between strands are the
// tempo of the last few seconds.
//
// Finish: one ink on security paper with a faint guilloché ground, the
// banknote register string-art envelopes belong to. No rainbow, no glow.
//
// Music, each in its own place:
// - kick: the chord ruled at that instant is struck in the vermilion accent
//   and stays where it was laid; the pen surges forward, so the strands after
//   each kick spread apart. One line and a gap, nothing else moves.
// - clap: a swell of ink runs down the ribbon from head to tail.
// - hats: pinpricks around the two pen points (V1's Dots mode as sparkle).
// - bass: the curves' amplitude breathes, recorded in the chords as laid.
// - drop: a longer, faster, heavier ruling, and a second plate in a second
//   ink, mirrored so the pair registers into a symmetric rosette.

(function () {
  const STEP = 0.35;        // t between ruled chords
  const V0 = 50;            // t per second at Speed 1 (V1 ran at 60, one per frame)
  const MAXC = 1500;        // ring buffer size, chords
  const EXT = 285;          // the curves' reach in Raph's units (scale 250 + wobble)
  const LEVELS = 14;        // alpha buckets for batching strokes

  const INKS = [
    // Banknote: security green on grey-green paper, aubergine second plate.
    { paper: '#dde2d0', ground: '#2c5a48', ink: '#123f33', ink2: '#6a2c4c', accent: '#d2432a', dark: false },
    // Intaglio: black on cream, blue-black second plate.
    { paper: '#ebe3d1', ground: '#5a4a38', ink: '#1a181c', ink2: '#1f4f86', accent: '#cc3a1e', dark: false },
    // Night plate: pale ink on a green-black plate, for dark rooms. Still flat.
    { paper: '#0e1815', ground: '#6f8f80', ink: '#d6dfca', ink2: '#caa05a', accent: '#e8583a', dark: true },
  ];

  const PRESETS = {
    calm: { inks: 2, speed: 0.45, trail: 0.35, weight: 0.8, second: 0 },
    drop: { inks: 2, speed: 0.8, trail: 0.62, weight: 1.25, second: 1 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['speed', 'trail', 'weight', 'second'];

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }
  function trailCount(trail) { return Math.round(160 + trail * 1100); }

  VIZ.register({
    id: 'parametricv2',
    name: 'Parametric Lines',
    versionOf: 'parametric',
    version: 'V2',
    order: 728,

    params: [
      { key: 'inks', label: 'Inks', type: 'select',
        options: ['Banknote', 'Intaglio', 'Night plate'], default: 2 },
      // V1's modes: Lines, Triangle strip (stroked, so the diagonals show),
      // Dots. Full figure is what the long trail now always is.
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['Ruled', 'Woven', 'Pinned'], default: 0 },
      { key: 'speed', label: 'Pen speed', type: 'range', min: 0.05, max: 2.5,
        default: PRESETS.calm.speed, step: 0.01 },
      { key: 'trail', legacy: 'SIZE0', label: 'Trail length', type: 'range', min: 0, max: 1.2,
        default: PRESETS.calm.trail, step: 0.01 },
      { key: 'weight', legacy: 'SIZE1', label: 'Line weight', type: 'range', min: 0.3, max: 3,
        default: PRESETS.calm.weight, step: 0.01 },
      { key: 'second', label: 'Second plate', type: 'range', min: 0, max: 1,
        default: PRESETS.calm.second, step: 0.01 },
      { key: 'x0', legacy: 'X0', label: 'Curve ratio', type: 'range', min: 1, max: 30,
        default: 13, step: 0.01 },
      { key: 'reaction', label: 'Reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Parametric Lines V2',
      technique: 'Canvas 2D: Raph\'s four parametric functions driven by integrated phases, a chord laid every 0.35 t into a 1500-chord ring buffer; the trail stroked oldest-faintest in alpha-bucketed paths (Ruled, Woven or Pinned), a mirrored second plate, kick chords re-struck in an accent ink, a travelling clap swell, hat pinpricks; a cached guilloché paper ground; onset detection against slow baselines and a section follower easing between calm and drop presets',
      brief: 'Raph\'s 2016 string art as a banknote engraving. Two pen points trace his Lissajous curves and a straightedge between them rules a line every instant; hundreds of those lines, kept where they were laid and fading toward the tail, make a ruled surface whose envelopes and moiré read as guilloché: by default pale ink on a green-black Night plate, with Banknote (security green on paper) and Intaglio (black on cream) as the other inks. The figure never goes dark; it morphs as the head rules new strands and the tail lets old ones go. Kick: the line ruled on the beat is struck in vermilion and stays, and the pen surges so the strands after it spread apart, leaving the rhythm in the ribbon. Clap: a swell of ink runs down the ribbon. Hats: pinpricks around the pen points. Bass breathes the curves\' amplitude. The drop rules longer, faster and heavier, and prints a second plate (gold on the Night plate), mirrored so the two register into a rosette; the breakdown unthreads the tail strand by strand.',
      lineage: [
        'V1: Parametric Lines (web/viz/parametric.js), a port of Raph\'s ParametricLines.pde (2016): chords between two parametric curves, rainbow hue from frameCount, trail length from band 0, weight from band 5.',
        'Six-judge panel (2026-09-28): bottom 12 of 72, mean 2.33; every judge: "most frames are black". Scope chosen: restaging with one new idea, the rule and its constants untouched.',
        'Purist (longer trail and thicker lines at the defaults) and Floor (thicker, a stable figure that morphs, two inks and a third on the drop): the always-present long trail, laid once into a buffer so it morphs rather than redraws.',
        'Director (a faint figure alive all the time, strands added through the build, full density at the drop, unthreading in the breakdown): trail length eases with the section, and shrinking it lets strands go from the tail.',
        'Designer (Guilloché: engraved lines in security green, a second ink in register on the drop): the finish, and the mirrored second plate.',
        'Curator and Purist\'s Pen on paper, lightly: the pen points are marked, and hats prick the paper around them.',
        'Rejected: the intaglio turntable portrait (a vignette would frame the ruling rather than be it), retiring the original (Floor, Psychonaut, Curator), any rainbow or neon.',
      ].join(' '),
    },

    enter() {
      this.buf = null;
      this.lastT = null;
    },

    init() {
      this.buf = new Float32Array(MAXC * 4);
      this.kick = new Float32Array(MAXC);
      this.kickT = new Float32Array(MAXC);   // seconds since enter, when struck
      this.clock = 0;
      this.head = 0;             // index of the next chord to write
      this.count = 0;            // chords written, capped at MAXC
      this.t = 0;                // Raph's t
      this.ph0 = 0;              // integral of dt / x0, so x0 can glide
      this.next = 0;             // t at which the next chord is ruled
      this.surge = 0;
      this.amp = 0.95;
      this.len = trailCount(PRESETS.calm.trail);
      this.pendKick = 0;
      this.pulses = [];
      this.pricks = [];
      this.env = { kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0, hf: 0, hs: 0, hWait: 0,
        bass: 0, low: 0, dropOn: false, auto: 0 };
      // Rule a quiet figure before the first frame, so it never opens empty.
      for (let i = 0; i < this.len + 10; i++) this.advance(STEP, 13);
    },

    // Advance Raph's t by dtT and rule every chord it passes.
    advance(dtT, x0) {
      const t0 = this.t, t1 = t0 + dtT;
      const w0 = 1 / x0;
      while (this.next <= t1) {
        const t = this.next;
        const ph = this.ph0 + (t - t0) * w0;
        const S = 250 * this.amp;
        const j = this.head * 4;
        const cos = Math.cos, sin = Math.sin;
        this.buf[j] = cos(ph) * S + sin(t / 80) * 30;
        this.buf[j + 1] = sin(t / 10) * S;
        this.buf[j + 2] = cos(t / 5) * S + cos(t / 7) * 2;
        this.buf[j + 3] = sin(t / 20) * S + cos(t / 9) * 30;
        this.kick[this.head] = this.pendKick;
        this.kickT[this.head] = this.clock;
        this.pendKick = 0;
        this.head = (this.head + 1) % MAXC;
        if (this.count < MAXC) this.count++;
        this.next += STEP;
      }
      this.ph0 += dtT * w0;
      this.t = t1;
    },

    listen(signals, dt) {
      const e = this.env;
      const kick = signals[0] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      e.ks = ease(e.ks, kick, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      let k = 0;
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        k = clamp((e.kf - e.ks) * 3, 0.4, 1);
        e.kWait = 0.2;
      }
      // Clap: fast minus slow on the clap bands, so the breakdown's sustained
      // pad in the same bands never fires it.
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      let c = 0;
      if (e.cf - e.cs > 0.08 && e.cWait === 0) { c = 1; e.cWait = 0.35; }
      const hat = (signals[6] + signals[7] + signals[8]) / 300;
      e.hf = ease(e.hf, hat, 45, dt);
      e.hs = ease(e.hs, hat, 4, dt);
      e.hWait = Math.max(0, e.hWait - dt);
      let h = 0;
      if (e.hf - e.hs > 0.05 && e.hWait === 0) { h = clamp((e.hf - e.hs) * 6, 0.3, 1); e.hWait = 0.09; }
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 2.5, dt);
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { k, c, h };
    },

    // The guilloché ground: two families of fine sine lines crossing into a
    // lattice of lenses, drawn once per size into its own canvas. It does not
    // move: the paper is the one still thing, the ruling moves over it.
    paperFor(p, W, H, pal, key) {
      const dens = p.pixelDensity();
      const pw = Math.round(p.width * dens), ph = Math.round(p.height * dens);
      const k = key + ':' + pw + 'x' + ph;
      if (this.paperKey === k) return this.paper;
      if (!this.paper) this.paper = document.createElement('canvas');
      const c = this.paper;
      c.width = pw; c.height = ph;
      const g = c.getContext('2d');
      g.setTransform(pw / W, 0, 0, ph / H, 0, 0);
      g.fillStyle = pal.paper;
      g.fillRect(0, 0, W, H);
      g.lineWidth = 0.5;
      g.lineJoin = 'round';
      const gap = 9, A = 5.5, f = (2 * Math.PI) / 70;
      for (let fam = 0; fam < 2; fam++) {
        g.strokeStyle = rgba(pal.ground, pal.dark ? 0.16 : 0.13);
        g.beginPath();
        for (let y0 = -gap; y0 < H + gap; y0 += gap) {
          const phs = (fam ? -1 : 1) * y0 * 0.09;
          for (let x = 0; x <= W + 4; x += 3) {
            // A slow second wave bends the lattice into bands, as security
            // grounds do, so it is not a plain crosshatch.
            const y = y0 + A * Math.sin(x * f + phs) + 3 * Math.sin(x * 0.009 + y0 * 0.02);
            if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
        }
        g.stroke();
      }
      // A plain margin and a single ruled frame, as on a note.
      const m = 14;
      g.strokeStyle = rgba(pal.ground, pal.dark ? 0.35 : 0.3);
      g.lineWidth = 0.8;
      g.strokeRect(m, m, W - 2 * m, H - 2 * m);
      // Soft edge darkening so the plate sits in the frame.
      const r = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      r.addColorStop(0, 'rgba(0,0,0,0)');
      r.addColorStop(1, pal.dark ? 'rgba(0,0,0,0.45)' : 'rgba(60,50,30,0.18)');
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
      this.paperKey = k;
      return c;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(now - this.lastT, 0, 0.1);
      this.lastT = now;
      if (!this.buf) this.init();
      this.clock += dt;
      const e = this.env;
      const react = params.reaction;
      const ev = this.listen(signals, dt);

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.5, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // Kick: mark the next chord and surge the pen.
      if (ev.k) {
        this.pendKick = Math.max(this.pendKick, ev.k * Math.min(1, react));
        this.surge = Math.max(this.surge, ev.k * react);
      }
      this.surge = ease(this.surge, 0, 7, dt);
      if (ev.c && react > 0) this.pulses.push({ pos: 0, a: Math.min(1.5, react) });
      this.amp = 0.9 + 0.12 * e.bass;
      this.advance(V0 * P.speed * (1 + 2.2 * this.surge) * dt, params.x0);

      // Trail length eases, so the build accumulates strands and the
      // breakdown unthreads them from the tail rather than cutting.
      const target = Math.min(trailCount(P.trail), this.count);
      this.len = ease(this.len, target, target > this.len ? 1.5 : 0.8, dt);
      const L = Math.max(2, Math.min(this.count, Math.floor(this.len)));

      // Fit Raph's 600-unit figure to the stage: height to height, and width
      // stretched to fill 16:9 (the curves are Lissajous; they stay themselves
      // under an affine stretch).
      const sy = (H / 2 - 26) / EXT;
      const sx = Math.min((W / 2 - 40) / EXT, sy * 1.6);

      const pal = INKS[Math.round(params.inks)] || INKS[0];
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(this.paperFor(p, W, H, pal, Math.round(params.inks)), 0, 0, W, H);
      g.translate(W / 2, H / 2);
      g.lineCap = 'butt';
      g.lineJoin = 'round';

      const buf = this.buf, head = this.head;
      const mode = Math.round(params.mode);
      const wBase = P.weight * (pal.dark ? 0.8 : 0.9);
      // Alpha along the trail: the head is full ink, the tail thins to
      // nothing over its last third, so shortening it reads as unthreading.
      const alphaAt = (u) => {
        const tail = clamp((1 - u) / 0.35, 0, 1);
        return (0.28 + 0.62 * Math.pow(1 - u, 1.4)) * tail * tail * (3 - 2 * tail);
      };
      const idx = (i) => ((head - 1 - i) % MAXC + MAXC) % MAXC;

      const plate = (ink, mirror, strength) => {
        if (strength <= 0.01) return;
        const mx = mirror ? -sx : sx;
        for (let b = 0; b < LEVELS; b++) {
          const i0 = Math.floor((b * L) / LEVELS), i1 = Math.floor(((b + 1) * L) / LEVELS);
          if (i1 <= i0) continue;
          const u = (i0 + i1) / 2 / L;
          const a = alphaAt(u) * strength;
          if (a < 0.01) continue;
          const w = wBase * (1 - 0.4 * u);
          g.beginPath();
          if (mode === 2) {
            // Pinned: the two pen points only, as V1's Dots.
            g.fillStyle = rgba(ink, Math.min(1, a * 1.2));
            const r = 0.7 + 1.1 * w;
            for (let i = i0; i < i1; i++) {
              const j = idx(i) * 4;
              g.rect(buf[j] * mx - r / 2, buf[j + 1] * sy - r / 2, r, r);
              g.rect(buf[j + 2] * mx - r / 2, buf[j + 3] * sy - r / 2, r, r);
            }
            g.fill();
            continue;
          }
          for (let i = i0; i < i1; i++) {
            const j = idx(i) * 4;
            g.moveTo(buf[j] * mx, buf[j + 1] * sy);
            g.lineTo(buf[j + 2] * mx, buf[j + 3] * sy);
            if (mode === 1 && i + 1 < L) {
              // Woven: V1's stroked triangle strip, the diagonal to the next
              // chord's first point.
              const k2 = idx(i + 1) * 4;
              g.lineTo(buf[k2] * mx, buf[k2 + 1] * sy);
            }
          }
          g.strokeStyle = rgba(ink, a);
          g.lineWidth = w;
          g.stroke();
        }
      };

      // Second plate under the first, mirrored so the two register.
      plate(pal.ink2, true, P.second * 0.7);
      plate(pal.ink, false, 1);

      // Clap swells: a band of chords re-inked heavier, running head to tail.
      for (const s of this.pulses) s.pos += dt * 700;
      this.pulses = this.pulses.filter((s) => s.pos < L + 40);
      for (const s of this.pulses) {
        const lo = Math.max(0, Math.floor(s.pos - 40)), hi = Math.min(L, Math.ceil(s.pos + 40));
        g.strokeStyle = rgba(pal.ink, 1);
        for (let i = lo; i < hi; i++) {
          const d = (i - s.pos) / 16;
          const k = Math.exp(-d * d) * s.a * alphaAt(i / L);
          if (k < 0.04) continue;
          const j = idx(i) * 4;
          g.globalAlpha = Math.min(1, 0.7 * k);
          g.lineWidth = wBase * (1 + 2.2 * k);
          g.beginPath();
          g.moveTo(buf[j] * sx, buf[j + 1] * sy);
          g.lineTo(buf[j + 2] * sx, buf[j + 3] * sy);
          g.stroke();
        }
        g.globalAlpha = 1;
      }

      // Kick strands: struck hard in the accent for a moment, then kept as a
      // thin vermilion record where they were laid, fading as the ribbon
      // leaves them behind.
      g.strokeStyle = pal.accent;
      for (let i = 0; i < L; i++) {
        const n = idx(i);
        const kv = this.kick[n];
        if (!(kv > 0)) continue;
        const u = i / L;
        const age = this.clock - this.kickT[n];
        const hot = Math.exp(-age / 0.35);
        const a = kv * (0.45 + 0.55 * hot) * alphaAt(u) * Math.max(0, 1 - u * 1.2);
        if (a < 0.02) continue;
        const j = n * 4;
        g.globalAlpha = Math.min(1, a * 1.3);
        g.lineWidth = wBase * 1.3 + (0.8 + 5.5 * hot) * kv;
        g.beginPath();
        g.moveTo(buf[j] * sx, buf[j + 1] * sy);
        g.lineTo(buf[j + 2] * sx, buf[j + 3] * sy);
        g.stroke();
      }
      g.globalAlpha = 1;

      // The straightedge now, and its two pen points.
      const jh = idx(0) * 4;
      const ax = buf[jh] * sx, ay = buf[jh + 1] * sy, bx = buf[jh + 2] * sx, by = buf[jh + 3] * sy;
      g.strokeStyle = rgba(pal.ink, 0.95);
      g.lineWidth = wBase * 1.5;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      g.fillStyle = pal.ink;
      g.beginPath();
      g.arc(ax, ay, 2.4 + wBase, 0, Math.PI * 2);
      g.moveTo(bx + 2.4 + wBase, by);
      g.arc(bx, by, 2.4 + wBase, 0, Math.PI * 2);
      g.fill();

      // Hats: pinpricks scattered around the pen points.
      if (ev.h && react > 0) {
        const n = Math.round(3 + 5 * ev.h * Math.min(react, 1.5));
        for (let q = 0; q < n; q++) {
          const which = q % 2;
          const ang = Math.random() * Math.PI * 2, rad = 6 + Math.random() * 26;
          this.pricks.push({
            x: (which ? bx : ax) + Math.cos(ang) * rad,
            y: (which ? by : ay) + Math.sin(ang) * rad,
            r: 0.8 + Math.random() * 1.1, life: 1,
          });
        }
      }
      for (const d of this.pricks) d.life -= dt / 0.6;
      this.pricks = this.pricks.filter((d) => d.life > 0);
      if (this.pricks.length > 300) this.pricks.splice(0, this.pricks.length - 300);
      for (const d of this.pricks) {
        g.fillStyle = rgba(pal.ink, 0.85 * d.life);
        g.beginPath();
        g.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        g.fill();
      }

      g.restore();
    },
  });
})();
