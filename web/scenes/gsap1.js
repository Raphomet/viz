// Metamorph (GSAP 1 of 5): MorphSVG as the subject. One flat emblem changes
// shape on the beat, circle to twelve-point burst to clover to arch to
// crescent and on, and a stack of its own past selves trails behind it like
// After Effects' Echo: each layer of the stack is the *same* paused timeline
// scrubbed a fraction of a beat earlier, so while the front shape springs
// into its next form the stack fans out behind it like an accordion and then
// folds back into a clean extrusion. No other tool here can do this: GSAP's
// MorphSVG matches any two outlines, whatever their point counts (a crescent
// into a twelve-point star), and a paused timeline can be evaluated at any
// number of times in one frame.
//
// Music, each in its own place:
//   kick   the hole in the emblem's centre morphs to its next small shape
//          with a spring (a hand's width of the frame, nothing else moves)
//   clap   the orbiting satellites hop outward in a stagger around the ring
//   bass   the emblem breathes; the stack's fan widens
//   hats   the confetti ring sparkles
//   drop   the emblem morphs every beat instead of every bar, the stack
//          deepens, satellites fly in, the whole thing spins harder
//
// How it is made: GSAP 3.14.2 (web/gsap-kit.js). A hidden <svg> holds three
// <path>s that MorphSVG writes into (the emblem, its centre hole, the big
// ghost behind); each frame the sketch sets a timeline's time from the beat
// clock, reads the path's `d` back and fills it on the p5 canvas as a Path2D.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const PALETTES = [
    { name: 'Tomato & cobalt', ground: '#EEE5D2', tint: '#E6D6B6', line: '#C9B48E', front: '#E2472F', stack: '#1F3A93', spark: '#E9A92B' },
    { name: 'Mint print', ground: '#DCE7DC', tint: '#C6D8C8', line: '#8FB3A3', front: '#113F40', stack: '#EE6A4D', spark: '#D9A21C' },
    { name: 'Pink & black', ground: '#F3D8CE', tint: '#EDC4B6', line: '#D39A8C', front: '#1A1A1A', stack: '#C9353B', spark: '#1A1A1A' },
    { name: 'Night paper', ground: '#1D1C2F', tint: '#2A2944', line: '#46446A', front: '#F1E6CC', stack: '#E4583B', spark: '#79BCAD' },
  ];

  // ------------------------------------------------------------------ shapes
  // Radius-100 outlines centred on the origin. Some are smooth, some sharp,
  // so the morphs alternate between melting and snapping.
  const K = () => window.VIZ_GSAP;
  function polar(n, r) { const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * TAU; const rr = r(a, i); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return pts; }
  function shapes() {
    const k = K();
    const star = (pts, ri) => polar(pts * 2, (a, i) => (i % 2 ? ri : 100));
    const crescent = () => {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const a = lerp(0.62, TAU - 0.62, i / 40) + Math.PI; pts.push([Math.cos(a) * 100, Math.sin(a) * 100]); }
      for (let i = 0; i <= 40; i++) {
        const a = lerp(TAU - 0.95, 0.95, i / 40) + Math.PI;
        pts.push([34 + Math.cos(a) * 80 * 1.0, Math.sin(a) * 86]);
      }
      return k.polyD(pts.map(([x, y]) => [x * 0.9 + 12, y]), true);
    };
    const arch = () => {
      const pts = [[-68, 100], [-68, 0]];
      for (let i = 1; i < 24; i++) { const a = Math.PI + i / 24 * Math.PI; pts.push([Math.cos(a) * 68, Math.sin(a) * 68 - 10]); }
      pts.push([68, 0], [68, 100]);
      return k.polyD(pts.map(([x, y]) => [x, y - 6]), true);
    };
    const tri = () => k.polyD(polar(3, () => 108).map(([x, y]) => [x, y + 16]), true);
    return [
      k.smoothD(polar(24, () => 96), true),                                   // circle
      k.polyD(star(12, 70), true),                                            // burst
      k.smoothD(polar(64, (a) => 100 * (0.7 + 0.3 * Math.pow(Math.abs(Math.cos(2 * a)), 0.6))), true), // clover
      arch(),
      k.smoothD(polar(96, (a) => 100 * (0.8 + 0.2 * Math.cos(8 * a))), true),  // flower
      k.polyD(star(6, 50), true),                                             // star
      k.smoothD(polar(48, (a) => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return 94 / Math.pow(Math.pow(c, 4) + Math.pow(s, 4), 0.25); }), true), // squircle
      crescent(),
      k.smoothD(polar(40, (a) => { const u = a + Math.PI / 2; return 100 * (0.55 + 0.45 * Math.pow(Math.abs(Math.sin(u / 2)), 1.2)); }), true), // drop
      tri(),
    ];
  }
  // The centre hole's vocabulary: small, simple, readable at a glance.
  function eyes() {
    const k = K();
    const cross = [[-30, -100], [30, -100], [30, -30], [100, -30], [100, 30], [30, 30], [30, 100], [-30, 100], [-30, 30], [-100, 30], [-100, -30], [-30, -30]];
    return [
      k.smoothD(polar(16, () => 90), true),
      k.polyD(polar(4, () => 105), true),
      k.polyD(cross, true),
      k.polyD(polar(8, (a, i) => (i % 2 ? 42 : 105)), true),
      k.polyD(polar(3, () => 100).map(([x, y]) => [x, y + 14]), true),
      k.polyD(polar(6, () => 95), true),
    ];
  }
  // One ease per morph, so each change of shape has its own gesture.
  const MORPH_EASES = ['elastic.out(1,0.42)', 'back.out(2.4)', 'expo.inOut', 'elastic.out(1.1,0.5)', 'back.inOut(2)',
    'power4.out', 'elastic.out(1,0.35)', 'back.out(3)', 'expo.out', 'elastic.out(1,0.5)'];

  const PRESETS = {
    calm: { energy: 0, echoes: 0.35, spin: 0.6 },
    drop: { energy: 1, echoes: 1, spin: 1.5 },
    // The stack alone, deep and slow, for a long breakdown.
    tower: { energy: 0.2, echoes: 1, spin: 0.3, palette: 3 },
  };
  const DRIVE = ['energy', 'echoes', 'spin'];

  function bootGsap(p) {
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_GSAP ? Promise.resolve() : new Promise((res) => {
      const s = document.createElement('script'); s.src = 'gsap-kit.js'; s.onload = s.onerror = res; document.head.appendChild(s);
    });
    kit.then(() => (window.VIZ_GSAP ? window.VIZ_GSAP.load() : null)).then(() => { if (hold) p._decrementPreload(); });
  }

  VIZ.register({
    id: 'gsap1',
    name: 'Metamorph',
    order: 1106,
    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'energy', label: 'Drop', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'echoes', label: 'Echo depth', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'reaction', label: 'Kick spring', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    gallery: {
      title: 'Metamorph',
      technique: 'GSAP 3.14.2 MorphSVG: paused timelines of shape morphs (one ease per morph: elastic, back, expo) scrubbed by a phase-locked beat clock, each evaluated at a dozen delayed times per frame to build an After Effects-style echo stack; a staggered satellite timeline; morphed SVG path data read back from a hidden <svg> and filled on the p5 canvas as Path2D',
      brief: 'A flat printed emblem that keeps becoming something else: circle, twelve-point burst, clover, arch, flower, star, squircle, crescent, drop, triangle, each change with its own spring. Behind it a stack of its own past selves, in stripes of a second ink, fans out while it morphs and folds back into a clean extrusion when it lands. The kick morphs only the small hole at its heart; claps send the satellites hopping round the ring in a stagger; bass breathes; hats sparkle the confetti. In the calm it changes once a bar; in the drop every beat, deeper and spinning harder.',
      lineage: 'After Effects title design (shape-layer morphs, the Echo effect) and Swiss poster emblems; GSAP\'s MorphSVG, which matches outlines of any point count, is the medium, and the echo stack is only possible because a paused GSAP timeline can be sampled at many times in one frame.',
    },

    preload(p) { bootGsap(p); },
    setup() {},
    enter() {},

    build() {
      const gsap = window.gsap, k = K();
      const SH = shapes(), EY = eyes();
      this.el = k.path(SH[0]);
      this.spin = { r: 0 };
      const tl = gsap.timeline({ paused: true, repeat: -1 });
      for (let i = 0; i < SH.length; i++) {
        const ease = MORPH_EASES[i % MORPH_EASES.length];
        tl.to(this.el, { morphSVG: { shape: SH[(i + 1) % SH.length], shapeIndex: 'auto' }, duration: 1, ease }, i);
        tl.to(this.spin, { r: (i + 1) * 108, duration: 1, ease }, i);
      }
      // Render every morph once in order, so each records its true start shape
      // before the clock starts jumping around in it.
      tl.progress(1).progress(0);
      this.tl = tl;

      this.eye = k.path(EY[0]);
      this.eyeS = { s: 1, r: 0 };
      const et = gsap.timeline({ paused: true, repeat: -1 });
      for (let i = 0; i < EY.length; i++) {
        et.to(this.eye, { morphSVG: { shape: EY[(i + 1) % EY.length], shapeIndex: 'auto' }, duration: 1, ease: 'back.out(3)' }, i);
        et.fromTo(this.eyeS, { s: 1.45 }, { s: 1, duration: 1, ease: 'elastic.out(1,0.35)', immediateRender: false }, i);
        et.to(this.eyeS, { r: (i + 1) * 60, duration: 1, ease: 'back.out(2)' }, i);
      }
      et.progress(1).progress(0);
      this.et = et;

      // Satellites: a stagger around the ring, up and down again.
      this.sats = [];
      for (let i = 0; i < 8; i++) this.sats.push({ lift: 0, sq: 1 });
      const st = gsap.timeline({ paused: true });
      st.to(this.sats, { lift: 1, sq: 0.8, duration: 0.4, ease: 'power3.out', stagger: { each: 0.07 } }, 0)
        .to(this.sats, { lift: 0, sq: 1, duration: 1.1, ease: 'bounce.out', stagger: { each: 0.07 } }, 0.4);
      st.progress(1).progress(0);
      this.st = st;

      this.clock = k.createClock();
      this.stepIdx = 0; this.stepStart = 0; this.stepDur = 1.6; this.lastBeat = null;
      this.eyeIdx = 0; this.lastSnare = -99; this.satIn = 0;
      this.built = true;
    },

    evalMorph(u) {
      this.tl.totalTime(Math.max(0, u));
      return { d: this.el.getAttribute('d'), r: this.spin.r * Math.PI / 180 };
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]);
      g.fillStyle = pal.ground; g.fillRect(0, 0, W, H);
      if (!window.VIZ_GSAP || !window.VIZ_GSAP.ready) { g.restore(); return; }
      if (!this.built) this.build();

      const t = p.millis() / 1000;
      const follow = Math.round(params.follow) === 1;
      const c = this.clock.update(signals, t, follow);
      const P = K().drive(params, PRESETS.drop, DRIVE, follow ? c.auto : 0);
      const E = clamp(P.energy, 0, 1);

      // Steps start on the beat grid: every bar in the calm, every two beats
      // halfway, every beat in the drop.
      const pos = c.pos, bi = Math.floor(pos);
      if (this.lastBeat === null) { this.lastBeat = bi; this.stepStart = bi; }
      const stepBeats = E > 0.66 ? 1 : E > 0.33 ? 2 : 4;
      if (bi !== this.lastBeat) {
        this.lastBeat = bi;
        if (((bi % stepBeats) + stepBeats) % stepBeats === 0) {
          this.stepIdx++; this.stepStart = bi;
          this.stepDur = stepBeats === 4 ? 1.7 : stepBeats === 2 ? 1.3 : 0.85;
        }
      }
      const b = pos - this.stepStart;
      if (c.kick) this.eyeIdx++;
      if (c.snare) this.lastSnare = t;

      const S = Math.min(W, H);
      const R = S * 0.3 * (1 + 0.05 * c.bass);
      const cx = W * 0.5, cy = H * 0.5;
      const baseRot = pos * 0.025 * P.spin;

      // ---- contour ripples: the emblem's past shapes travel outward, older
      // the further out, so each morph spreads across the page like a wave
      {
        const N = 11, drift = (pos / 2) % 1;
        const u0 = this.stepIdx + clamp(b / this.stepDur, 0, 1);
        const ringBase = Math.floor(pos / 2);
        for (let j = N; j >= 1; j--) {
          const ph = j + drift - 1;
          const m = this.evalMorph(u0 - Math.max(0, ph) * 0.22);
          const sc = R / 100 * (1.1 + Math.max(0, ph) * 0.42);
          g.save();
          g.translate(cx, cy);
          g.rotate(baseRot + m.r * 0.35 * (0.35 + 0.65 * clamp(P.spin, 0, 2) / 1.5));
          g.scale(sc, sc);
          // Parity by the ring's own identity, so a band keeps its ink as it
          // travels outward.
          g.fillStyle = ((j - ringBase) & 1) ? pal.tint : pal.ground;
          g.fill(new Path2D(m.d));
          g.restore();
        }
        g.globalAlpha = 1;
      }

      // ---- confetti ring (hats)
      {
        const n = 36, rr = R * 2.05;
        g.fillStyle = pal.spark;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU - pos * 0.02;
          const flick = hash(i * 13.1 + Math.floor(t * 12));
          const sz = 0.9 + 3.2 * c.hat * flick * flick + 0.7 * c.pad;
          g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92, sz, 0, TAU); g.fill();
        }
      }

      // ---- the echo stack, back to front
      const M = Math.round(lerp(3, 14, clamp(P.echoes, 0, 1)));
      const lag = lerp(0.05, 0.075, E);
      const off = S * lerp(0.009, 0.014, E) * (1 + 0.4 * c.bass);
      const dir = 0.9 + Math.sin(pos * 0.03) * 0.5;
      const ox = Math.cos(dir) * off, oy = Math.sin(dir) * off;
      const spinK = 0.35 + 0.65 * clamp(P.spin, 0, 2) / 1.5;
      for (let k = M; k >= 0; k--) {
        const u = this.stepIdx + clamp((b - k * lag) / this.stepDur, 0, 1);
        const m = this.evalMorph(u);
        g.save();
        g.translate(cx + ox * k, cy + oy * k);
        g.rotate(baseRot + m.r * spinK);
        const sc = R / 100 * (1 - k * 0.012);
        g.scale(sc, sc);
        const path = new Path2D(m.d);
        if (k === 0) {
          g.fillStyle = pal.front; g.fill(path);
          g.save(); g.clip(path);
        } else {
          g.fillStyle = k % 2 ? pal.stack : pal.ground; g.fill(path);
        }
        if (k === 0) {
          // ---- the centre hole: the kick's one reaction
          const sk = c.sinceKick(t);
          const eu = this.eyeIdx === 0 ? 0 : this.eyeIdx - 1 + clamp(sk / 0.9, 0, 1);
          this.et.totalTime(eu);
          const pop = 1 + (this.eyeS.s - 1) * clamp(params.reaction, 0, 2);
          g.save();
          g.rotate(-m.r * spinK + this.eyeS.r * Math.PI / 180);
          const es = 0.27 * pop;
          g.scale(es, es);
          g.fillStyle = pal.ground;
          g.fill(new Path2D(this.eye.getAttribute('d')));
          g.restore();
          g.restore();
        }
        g.restore();
      }

      // ---- satellites: tiny copies of the emblem on the orbit, the clap's hop
      this.satIn += ((E > 0.25 ? 1 : 0) - this.satIn) * (1 - Math.exp(-c.dt / 0.5));
      if (this.satIn > 0.01) {
        this.st.time(clamp((t - this.lastSnare) * c.bpm / 60, 0, this.st.duration()));
        const n = this.sats.length;
        for (let i = 0; i < n; i++) {
          const appear = clamp(this.satIn * n - i, 0, 1);
          if (appear <= 0) continue;
          const s = this.sats[i];
          const a = i / n * TAU - pos * 0.06 * P.spin;
          const rr = R * (1.55 + 0.35 * s.lift);
          const u = this.stepIdx + clamp((b - 0.25 - i * 0.05) / this.stepDur, 0, 1);
          const m = this.evalMorph(u);
          g.save();
          g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          g.rotate(a + m.r);
          const sc = R / 100 * 0.14 * appear;
          g.scale(sc * s.sq, sc / s.sq);
          g.fillStyle = i % 2 ? pal.front : pal.stack;
          g.fill(new Path2D(m.d));
          g.restore();
        }
      }
      g.restore();
    },
  });
})();
