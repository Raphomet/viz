// Ease Garden (GSAP 5 of 5): the ease itself as the subject. A row of lanes,
// each owning one GSAP ease (a CustomBounce with squash, an elastic, a back,
// expo, steps, a hand-drawn CustomEase, a RoughEase, a CustomWiggle laid on
// a power curve), each drawn as its own graph, like GSAP's ease visualiser.
// When a lane fires, a playhead runs along its curve, tracing it in ink, and
// a ball beside the graph travels between floor and ceiling by exactly that
// curve, squashing and stretching with its speed. The same two beats of
// music become eight different gestures: the difference between eases,
// which is the thing GSAP gives motion designers, is the picture.
//
// Music, each in its own place:
//   kick   the next lane fires, left to right, so the kicks walk along the
//          row (one lane moves; the rest wait)
//   clap   the pendulums along the top rail swing on a CustomWiggle, in a
//          stagger out from the centre
//   hats   the ruler ticks on the floor glint
//   bass   the balls swell; the hero curve behind breathes
//   drop   every lane fires on every beat, staggered from the centre or the
//          edges by gsap.utils.distribute, balls leave stroboscopic trails
//          (the ease sampled at earlier times), the elastic loosens
//
// How it is made: GSAP 3.14.2 (web/gsap-kit.js): eases from gsap.parseEase,
// CustomEase.create, CustomBounce.create (with its -squash twin),
// CustomWiggle.create and EasePack's RoughEase, evaluated at beat-clock time;
// a paused, staggered pendulum timeline; gsap.utils.distribute for the drop's
// stagger. Everything is drawn on the p5 canvas.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + (b || 0) * 311.7 + 5.3) * 43758.5453; return x - Math.floor(x); };

  const PALETTES = [
    { name: 'Studio', ground: '#EFE8DA', panel: '#E6DDCB', line: '#1C1B19', faint: '#CFC3AA', balls: ['#E0492F', '#1F4E9E', '#F0B22E', '#2A8C7E'] },
    { name: 'Graphite', ground: '#23252A', panel: '#2B2E34', line: '#ECE6D8', faint: '#3E434C', balls: ['#F06A4A', '#7FB2E5', '#F2C552', '#9CD3B8'] },
    { name: 'Blush', ground: '#F4DCD3', panel: '#EDCFC4', line: '#2A2338', faint: '#DDB7A9', balls: ['#2A2338', '#D8413A', '#3E7CB1', '#F2A541'] },
    { name: 'Mint', ground: '#D7E9DF', panel: '#CADFD3', line: '#123C3A', faint: '#A8C9B8', balls: ['#123C3A', '#EE6B4D', '#F2C14E', '#5A4E9E'] },
  ];

  // The lanes: [label, ease]. Built after GSAP is in.
  function lanes(elastic) {
    const gsap = window.gsap;
    if (!window.CustomEase.get('vizBall')) {
      window.CustomBounce.create('vizBall', { strength: 0.62, squash: 3 });
      window.CustomEase.create('vizStair', 'M0,0 C0.12,0 0.16,0.58 0.32,0.58 0.46,0.58 0.5,0.26 0.6,0.26 0.76,0.26 0.8,1 1,1');
      window.CustomWiggle.create('vizWig', { wiggles: 6, type: 'easeOut' });
      window.CustomWiggle.create('vizSwing', { wiggles: 5, type: 'easeOut' });
    }
    const wig = gsap.parseEase('vizWig'), p2 = gsap.parseEase('power2.out');
    const rough = gsap.parseEase('rough({ strength: 1.4, points: 26, template: power2.inOut, taper: out, randomize: false, clamp: false })');
    return [
      { label: 'bounce', ease: gsap.parseEase('vizBall'), squash: gsap.parseEase('vizBall-squash') },
      { label: 'elastic', ease: gsap.parseEase('elastic.out(1,' + elastic.toFixed(2) + ')') },
      { label: 'back', ease: gsap.parseEase('back.inOut(3)') },
      { label: 'expo', ease: gsap.parseEase('expo.inOut') },
      { label: 'steps', ease: gsap.parseEase('steps(5)') },
      { label: 'custom', ease: gsap.parseEase('vizStair') },
      { label: 'rough', ease: rough },
      { label: 'wiggle', ease: (p) => p2(p) + 0.3 * wig(p) },
    ];
  }

  const PRESETS = {
    calm: { energy: 0, trails: 0, loose: 0.35 },
    drop: { energy: 1, trails: 1, loose: 0.22 },
    // Trails on, one lane at a time: a slow study of each curve.
    study: { energy: 0.2, trails: 1, loose: 0.3, palette: 1 },
  };
  const DRIVE = ['energy', 'trails', 'loose'];

  function bootGsap(p) {
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_GSAP ? Promise.resolve() : new Promise((res) => {
      const s = document.createElement('script'); s.src = 'gsap-kit.js'; s.onload = s.onerror = res; document.head.appendChild(s);
    });
    kit.then(() => (window.VIZ_GSAP ? window.VIZ_GSAP.load() : null)).then(() => { if (hold) p._decrementPreload(); });
  }

  const DUR = 1.7;   // beats a lane's move takes

  VIZ.register({
    id: 'gsap5',
    name: 'Ease Garden',
    order: 1110,
    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'energy', label: 'Drop', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'trails', label: 'Strobe trails', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'loose', label: 'Elastic period', type: 'range', min: 0.15, max: 0.6, default: 0.35, step: 0.01 },
      { key: 'reaction', label: 'Squash', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    gallery: {
      title: 'Ease Garden',
      technique: 'GSAP 3.14.2 eases as the subject: gsap.parseEase, CustomEase (a hand-drawn stair curve), CustomBounce with its paired squash ease, CustomWiggle, EasePack RoughEase, steps, elastic, back and expo, each drawn as a live graph with a playhead and driving a ball by the same curve at beat-clock time; a paused staggered pendulum timeline on a CustomWiggle; gsap.utils.distribute for the drop\'s centre-out stagger; stroboscopic trails from sampling each ease at earlier times',
      brief: 'GSAP\'s ease visualiser turned into an instrument. A row of lanes, each owning one ease, each showing its curve as a graph. When a lane fires, a playhead runs along the curve, tracing it in ink, and a ball beside it travels between floor and ceiling by exactly that curve, squashing and stretching with its speed: bounce, spring, overshoot, snap, stairs, jitter, wobble. Kicks fire the lanes one by one, walking along the row; claps set the pendulums on the top rail swinging from the centre out; hats glint the floor\'s ruler. In the drop every lane fires on every beat in a centre-out stagger and the balls leave stroboscopic trails.',
      lineage: 'GSAP\'s own ease visualiser, Disney\'s squash and stretch, and the motion-graph editor of After Effects; here the ease curve, the one thing a timing library is for, is both the diagram and the dance.',
    },

    preload(p) { bootGsap(p); },
    setup() {},
    enter() {},

    build() {
      const gsap = window.gsap;
      this.clock = window.VIZ_GSAP.createClock();
      this.loose = 0.35;
      this.L = lanes(this.loose);
      this.state = this.L.map(() => ({ from: 0, to: 0, start: -1e9 }));
      this.pends = this.L.map(() => ({ a: 0 }));
      const pt = gsap.timeline({ paused: true });
      pt.to(this.pends, { a: 1, duration: 2.6, ease: 'vizSwing', stagger: { each: 0.08, from: 'center' } });
      pt.progress(1).progress(0);
      this.pt = pt;
      this.lastSnare = -1e9;
      this.lastBeat = null;
      this.hero = { i: 0, prev: 0, t0: -1e9 };
      this.built = true;
    },

    value(i, pos) {
      const s = this.state[i];
      const lt = (pos - s.start) / DUR;
      if (lt <= 0) return { v: s.from, p: -1 };
      if (lt >= 1) return { v: s.to, p: -1 };
      return { v: s.from + (s.to - s.from) * this.L[i].ease(lt), p: lt };
    },

    fire(i, at) {
      const s = this.state[i];
      const cur = this.value(i, at).v;
      s.from = cur;
      s.to = s.to > 0.5 ? 0 : 1;
      s.start = at;
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
      const gsap = window.gsap;

      const t = p.millis() / 1000;
      const follow = Math.round(params.follow) === 1;
      const c = this.clock.update(signals, t, follow);
      const P = window.VIZ_GSAP.drive(params, PRESETS.drop, DRIVE, follow ? c.auto : 0);
      const E = clamp(P.energy, 0, 1);
      const pos = c.pos;
      const N = this.L.length;

      // The elastic lane's period is a live param: rebuild that one ease
      // when it moves (parseEase caches, so this is cheap).
      const loose = Math.round(clamp(P.loose, 0.15, 0.6) * 50) / 50;
      if (loose !== this.loose) { this.loose = loose; this.L[1].ease = gsap.parseEase('elastic.out(1,' + loose.toFixed(2) + ')'); }

      // ---- events
      if (c.kick) {
        const i = (c.kickCount - 1) % N;
        this.fire(i, pos);
        this.hero = { i, prev: this.hero.i, t0: pos };
      }
      if (c.snare) this.lastSnare = pos;
      const bi = Math.floor(pos);
      if (this.lastBeat === null) this.lastBeat = bi;
      if (bi !== this.lastBeat) {
        this.lastBeat = bi;
        // With no kick to walk the row (an intro, a breakdown), the clock
        // walks it instead, one lane every other beat.
        if (bi % 2 === 0 && c.sinceKick(t) > 2.5) {
          this.idle = ((this.idle || 0) + 1) % N;
          this.fire(this.idle, bi);
          this.hero = { i: this.idle, prev: this.hero.i, t0: bi };
        }
        if (E > 0.5) {
          // Every lane, on the beat, staggered by GSAP's own distributor.
          const from = bi % 8 < 4 ? 'center' : 'edges';
          const off = gsap.utils.distribute({ base: 0.25, amount: 0.55, from });
          this.pendingWave = this.L.map((_, i) => bi + off(i, null, this.L));
        }
      }
      if (this.pendingWave) {
        let left = 0;
        for (let i = 0; i < N; i++) {
          const at = this.pendingWave[i];
          if (at === null) continue;
          if (pos >= at) { this.fire(i, at); this.pendingWave[i] = null; } else left++;
        }
        if (!left) this.pendingWave = null;
      }
      this.pt.time(clamp(pos - this.lastSnare, 0, this.pt.duration()));

      // ---- layout
      const S = Math.min(W, H);
      const mx = W * 0.05, lw = (W - mx * 2) / N;
      const top = H * 0.3, bot = H * 0.82;
      const br = Math.min(lw * 0.16, S * 0.04) * (1 + 0.18 * c.bass);

      // ---- the hero curve: the last fired lane's ease, huge and faint
      {
        const h = this.hero;
        const k = clamp((pos - h.t0) / 0.6, 0, 1);
        const drawCurve = (ease, a) => {
          if (a <= 0.01) return;
          g.globalAlpha = a;
          g.beginPath();
          for (let j = 0; j <= 120; j++) {
            const u = j / 120, v = ease(u);
            const x = W * 0.04 + u * W * 0.92, y = H * 0.9 - v * H * 0.72 * (1 + 0.04 * c.bass);
            if (j) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.stroke();
        };
        g.strokeStyle = pal.panel; g.lineWidth = S * 0.035; g.lineCap = 'round'; g.lineJoin = 'round';
        drawCurve(this.L[h.prev].ease, 1 - k);
        drawCurve(this.L[h.i].ease, k);
        g.globalAlpha = 1;
      }

      // ---- the top rail and its pendulums (the clap)
      const railY = H * 0.06;
      g.strokeStyle = pal.line; g.lineWidth = Math.max(1, S * 0.003);
      g.beginPath(); g.moveTo(mx, railY); g.lineTo(W - mx, railY); g.stroke();
      for (let i = 0; i < N; i++) {
        const cx = mx + (i + 0.5) * lw;
        const a = this.pends[i].a * 0.55;
        const len = H * 0.085;
        const x = cx + Math.sin(a) * len, y = railY + Math.cos(a) * len;
        g.beginPath(); g.moveTo(cx, railY); g.lineTo(x, y); g.stroke();
        g.fillStyle = pal.balls[i % 4];
        g.beginPath(); g.arc(x, y, S * 0.012, 0, TAU); g.fill();
      }

      // ---- the floor, a ruler whose ticks glint with the hats
      g.fillStyle = pal.line;
      g.fillRect(mx, bot + br, W - mx * 2, Math.max(1.5, S * 0.004));
      for (let j = 0; j <= 80; j++) {
        const x = mx + j / 80 * (W - mx * 2);
        const tw = hash(j, Math.floor(t * 12));
        const h = S * (j % 10 === 0 ? 0.02 : j % 5 === 0 ? 0.013 : 0.007) * (1 + 1.6 * c.hat * tw * tw);
        g.fillRect(x - 0.6, bot + br, 1.2, h + S * 0.004);
      }

      // ---- lanes
      const trails = clamp(P.trails, 0, 1);
      g.font = '400 ' + Math.max(9, S * 0.022).toFixed(1) + 'px "Space Mono", monospace';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      for (let i = 0; i < N; i++) {
        const x0 = mx + i * lw;
        const gx0 = x0 + lw * 0.08, gx1 = x0 + lw * 0.6, bx = x0 + lw * 0.8;
        const col = pal.balls[i % 4];
        const gy = (v) => bot - v * (bot - top);
        const L = this.L[i], s = this.state[i];
        const cur = this.value(i, pos);

        // Graph axes and the curve.
        g.strokeStyle = pal.line; g.globalAlpha = 0.35; g.lineWidth = 1;
        g.beginPath(); g.moveTo(gx0, top); g.lineTo(gx0, bot); g.lineTo(gx1, bot); g.stroke();
        g.globalAlpha = 1;
        g.strokeStyle = pal.faint; g.lineWidth = Math.max(1, S * 0.004);
        const flip = s.to < s.from;
        const curveY = (u) => { const v = L.ease(u); return gy(flip ? 1 - v : v); };
        g.beginPath();
        for (let j = 0; j <= 60; j++) { const u = j / 60, x = lerp(gx0, gx1, u), y = curveY(u); if (j) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        if (cur.p >= 0) {
          // The trace: the curve inked up to the playhead.
          g.strokeStyle = col; g.lineWidth = Math.max(1.5, S * 0.006);
          g.beginPath();
          const n = Math.max(1, Math.ceil(cur.p * 60));
          for (let j = 0; j <= n; j++) { const u = Math.min(cur.p, j / 60), x = lerp(gx0, gx1, u), y = curveY(u); if (j) g.lineTo(x, y); else g.moveTo(x, y); }
          g.stroke();
          const hx = lerp(gx0, gx1, cur.p), hy = gy(cur.v);
          g.setLineDash([S * 0.006, S * 0.008]);
          g.strokeStyle = pal.line; g.lineWidth = 1;
          g.beginPath(); g.moveTo(hx, hy); g.lineTo(bx, hy); g.stroke();
          g.setLineDash([]);
          g.fillStyle = pal.line;
          g.beginPath(); g.arc(hx, hy, S * 0.008, 0, TAU); g.fill();
        }
        g.fillStyle = pal.line;
        g.globalAlpha = 0.55;
        g.fillText(L.label, gx0, top - (bot - top) * 0.15);
        g.globalAlpha = 1;

        // Strobe trail: the same ease, sampled a little earlier each time.
        if (trails > 0.01 && cur.p >= 0) {
          for (let j = 6; j >= 1; j--) {
            const tp = cur.p - j * 0.045;
            if (tp < 0) continue;
            const v = s.from + (s.to - s.from) * L.ease(tp);
            g.globalAlpha = trails * (0.5 - j * 0.07);
            g.fillStyle = col;
            g.beginPath(); g.arc(bx, gy(v), br * 0.92, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        }

        // The ball, squashed and stretched by its speed (and on the bounce
        // lane by CustomBounce's own squash ease).
        const eps = 0.012;
        let sx = 1, sy = 1;
        const react = clamp(params.reaction, 0, 2);
        if (cur.p >= 0) {
          const v2 = s.from + (s.to - s.from) * L.ease(Math.min(1, cur.p + eps));
          const speed = Math.abs(v2 - cur.v) / eps;
          const st = Math.min(0.45, speed * 0.09) * react;
          sy = 1 + st; sx = 1 / Math.sqrt(sy);
          if (L.squash) { const q = L.squash(cur.p) * react * 0.5; sx *= 1 + q; sy *= 1 - q * 0.6; }
        }
        const by = gy(cur.v);
        // Shadow on the floor, closer and darker as the ball comes down.
        g.fillStyle = pal.faint;
        const sh = 1 - cur.v;
        g.beginPath(); g.ellipse(bx, bot + br * 1.02, br * (0.5 + 0.6 * sh), br * 0.18, 0, 0, TAU); g.fill();
        g.save();
        g.translate(bx, by);
        g.scale(sx, sy);
        g.fillStyle = col;
        g.beginPath(); g.arc(0, 0, br, 0, TAU); g.fill();
        g.restore();
      }
      g.restore();
    },
  });
})();
