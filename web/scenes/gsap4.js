// Linework (GSAP 4 of 5): DrawSVG and MotionPath as the subject. A single
// pen line draws a large figure (a spirograph, a Lissajous knot, a rose, a
// spiral) across the page and then undraws it from the start, as the next
// figure begins; loop-the-loop ribbons run the width of the frame above and
// below with short dashes chasing round their loops; and small paper
// darts fly along the ribbons, each dragging a comet of drawn line behind
// it. Every line is revealed, never faded: the look of an animated diagram
// or a title drawn with a pen, which is what DrawSVG exists for.
//
// Music, each in its own place:
//   kick   a dart launches along a ribbon and flies it end to end with a
//          comet trail (MotionPath + DrawSVG on the same ease, so the trail's
//          head is always at the dart)
//   clap   a curl flourish draws itself on somewhere free and undraws
//   hats   pinpricks along the drawn figure glint
//   bass   the chasers speed up; the lines thicken
//   drop   figures come twice as fast, the previous one stays drawn in the
//          second ink spinning the other way, more chasers, darts on the
//          off-beats too
//
// How it is made: GSAP 3.14.2 (web/gsap-kit.js). The lines are <path>s in a
// hidden <svg>; DrawSVG tweens their dash, and the sketch copies the dash to
// the canvas (setLineDash on a cached Path2D of the same data). Darts are
// plain objects moved by MotionPath (with autoRotate) along the same path
// data. Timelines are in beats, scrubbed by the beat clock.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + (b || 0) * 311.7 + 3.1) * 43758.5453; return x - Math.floor(x); };

  const PALETTES = [
    { name: 'Blueprint', ground: '#1A2947', line: '#F0E5CC', acc: '#F0643E', faint: '#2F4470', dart: '#F4C04E' },
    { name: 'Chalkboard', ground: '#26302A', line: '#EAE6D8', acc: '#F2B84B', faint: '#35433A', dart: '#E07A5F' },
    { name: 'Ink on paper', ground: '#F1EADB', line: '#1B1A19', acc: '#D13B30', faint: '#DDD1B8', dart: '#2F5D8C' },
    { name: 'Terracotta', ground: '#C8583A', line: '#F6EBD6', acc: '#1E2A3A', faint: '#B84E33', dart: '#F2C14E' },
  ];

  // Big figures, centred on the origin, radius about 1.
  function figure(kind) {
    const pts = [];
    if (kind === 0) { // hypotrochoid
      const R = 5, r = 3, d = 4.2;
      for (let i = 0; i <= 900; i++) { const t = i / 900 * 6 * Math.PI; pts.push([((R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t)) / 6.2, ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t)) / 6.2]); }
    } else if (kind === 1) { // Lissajous 3:2
      for (let i = 0; i <= 600; i++) { const t = i / 600 * TAU; pts.push([Math.sin(3 * t + Math.PI / 2) * 1.35, Math.sin(2 * t) * 0.95]); }
    } else if (kind === 2) { // rose k = 5/4
      for (let i = 0; i <= 1100; i++) { const t = i / 1100 * 8 * Math.PI; const r = Math.cos(1.25 * t); pts.push([r * Math.cos(t), r * Math.sin(t)]); }
    } else if (kind === 3) { // spiral out and a loop back
      for (let i = 0; i <= 700; i++) { const u = i / 700, t = u * 5 * TAU; const r = 0.08 + 0.92 * u; pts.push([r * Math.cos(t) * 1.15, r * Math.sin(t)]); }
    } else { // cardioid chain: epitrochoid
      const R = 3, r = 1, d = 1.6;
      for (let i = 0; i <= 700; i++) { const t = i / 700 * TAU; pts.push([((R + r) * Math.cos(t) - d * Math.cos((R + r) / r * t)) / 5.2, ((R + r) * Math.sin(t) - d * Math.sin((R + r) / r * t)) / 5.2]); }
    }
    return pts;
  }
  const NFIG = 5;

  const PRESETS = {
    calm: { energy: 0, chasers: 0.3, weight: 1 },
    drop: { energy: 1, chasers: 1, weight: 1.8 },
    // Heavy line, one figure at a time, no chasers: a pen demonstration.
    plotter: { energy: 0.2, chasers: 0, weight: 2.6, palette: 2 },
  };
  const DRIVE = ['energy', 'chasers', 'weight'];

  function bootGsap(p) {
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_GSAP ? Promise.resolve() : new Promise((res) => {
      const s = document.createElement('script'); s.src = 'gsap-kit.js'; s.onload = s.onerror = res; document.head.appendChild(s);
    });
    kit.then(() => (window.VIZ_GSAP ? window.VIZ_GSAP.load() : null)).then(() => { if (hold) p._decrementPreload(); });
  }

  VIZ.register({
    id: 'gsap4',
    name: 'Linework',
    order: 1109,
    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'energy', label: 'Drop', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'chasers', label: 'Chasers', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.5, max: 3, default: 1, step: 0.01 },
      { key: 'reaction', label: 'Dart speed', type: 'range', min: 0.5, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    gallery: {
      title: 'Linework',
      technique: 'GSAP 3.14.2 DrawSVG and MotionPath: hidden SVG paths whose dash DrawSVG tweens (draw on "0% 0%" to "0% 100%", draw off to "100% 100%", moving "a% b%" segments), copied to the canvas as setLineDash on cached Path2Ds; darts moved along the same path data by MotionPath with autoRotate, their comet trail a DrawSVG segment on the same ease; timelines in beats, scrubbed by a phase-locked beat clock',
      brief: 'An animated pen diagram. One continuous line draws a large figure across the page (spirograph, Lissajous knot, rose, spiral, epicycle) and undraws it from its start as the next one begins; loop-the-loop ribbons run the width of the frame with short dashes chasing round them. Each kick launches a paper dart along a ribbon, dragging a comet of drawn line; each clap draws a curl flourish somewhere free and takes it away again; hats glint pinpricks along the figure. In the drop the figures come twice as fast, the last one stays up in the second ink turning the other way, more dashes chase and darts fly on the off-beats too.',
      lineage: 'Pen plotters, spirograph toys and the drawn-line title sequences of After Effects\' Trim Paths; GSAP\'s DrawSVG (dash as a range of the path\'s length) and MotionPath are the medium, and the dart and its trail share one ease so the line appears exactly where the dart has been.',
    },

    preload(p) { bootGsap(p); },
    setup() {},
    enter() {},

    build(W, H) {
      const k = window.VIZ_GSAP, gsap = window.gsap;
      if (this.all) this.all.forEach((x) => x.kill());
      if (this.els) this.els.forEach((e) => e.remove());
      this.all = []; this.els = [];
      const mk = (d) => { const el = k.path(d); this.els.push(el); return el; };
      const S = Math.min(W, H);

      // Figures: path data at stage scale, cached Path2D, and glint points.
      this.figs = [];
      for (let i = 0; i < NFIG; i++) {
        const pts = figure(i).map(([x, y]) => [x * S * 0.4, y * S * 0.4]);
        const d = k.polyD(pts, false);
        const glints = [];
        for (let j = 0; j < 36; j++) { const q = pts[Math.floor((j + 0.5) / 36 * (pts.length - 1))]; glints.push({ x: q[0], y: q[1], u: (j + 0.5) / 36 }); }
        this.figs.push({ d, p2: new Path2D(d), glints });
      }

      // Ribbons: prolate trochoids across the width, one each way.
      this.ribbons = [];
      for (let r = 0; r < 2; r++) {
        const n = Math.max(5, Math.round(W / S * 4.2)), pts = [];
        const L = W * 1.16, step = L / n, rr = step / TAU, dd = rr * 1.8;
        for (let i = 0; i <= n * 48; i++) {
          const th = i / 48 * TAU;
          const x = -W * 0.08 + rr * th - dd * Math.sin(th);
          const y = (r === 0 ? H * 0.19 : H * 0.81) + dd * Math.cos(th) * (r === 0 ? 1 : -1);
          pts.push([x, y]);
        }
        if (r === 1) pts.reverse();
        const d = k.polyD(pts, false);
        const chase = mk(d);
        const ct = gsap.timeline({ paused: true, repeat: -1 });
        ct.fromTo(chase, { drawSVG: '0% 4%' }, { drawSVG: '96% 100%', duration: 1, ease: 'none' });
        ct.progress(1).progress(0);
        this.all.push(ct);
        this.ribbons.push({ d, p2: new Path2D(d), chase, ct });
      }

      // Darts: a pool, each with its own trail element and timeline.
      this.darts = [];
      for (let i = 0; i < 8; i++) {
        const rb = this.ribbons[i % 2];
        const obj = { x: -999, y: -999, rotation: 0 };
        const trail = mk(rb.d);
        const tl = gsap.timeline({ paused: true });
        const ease = 'power2.inOut';
        tl.to(obj, { motionPath: { path: rb.d, autoRotate: true }, duration: 2.4, ease }, 0);
        tl.fromTo(trail, { drawSVG: '0% 0%' }, { drawSVG: '88% 100%', duration: 2.4, ease }, 0);
        tl.to(trail, { drawSVG: '100% 100%', duration: 0.6, ease: 'power2.in' }, 2.4);
        tl.progress(1).progress(0);
        this.all.push(tl);
        this.darts.push({ obj, trail, tl, rb, start: -1e9 });
      }

      // Curl flourishes for the clap.
      this.curls = [];
      for (let i = 0; i < 3; i++) {
        const pts = [];
        const sz = S * 0.07, turns = 2.2 + i * 0.4;
        for (let j = 0; j <= 160; j++) { const u = j / 160, th = u * turns * TAU; const r = sz * (1 - u * 0.85); pts.push([Math.cos(th) * r - sz * 2.2 * (1 - u), Math.sin(th) * r + sz * 0.6 * (1 - u) * (1 - u)]); }
        const d = k.smoothD(pts.filter((_, j) => j % 2 === 0), false);
        const el = mk(d);
        const tl = gsap.timeline({ paused: true });
        tl.fromTo(el, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'expo.out' }, 0)
          .to(el, { drawSVG: '100% 100%', duration: 0.9, ease: 'power2.in' }, 2.2);
        tl.progress(1).progress(0);
        this.all.push(tl);
        this.curls.push({ el, tl, p2: new Path2D(d), start: -1e9, x: 0, y: 0, r: 0 });
      }

      this.figEls = [mk(this.figs[0].d), mk(this.figs[0].d)];
      this.figures = [];
      this.figN = 0; this.nextFig = null; this.dartN = 0; this.curlN = 0; this.lastHalf = null;
      this.chaseU = 0;
      this.key = Math.round(W) + 'x' + Math.round(H);
    },

    startFigure(pos, len) {
      const gsap = window.gsap;
      const i = this.figN++;
      const fig = this.figs[i % NFIG];
      const el = this.figEls[i % 2];
      el.setAttribute('d', fig.d);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(el, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: len * 0.55, ease: 'power2.inOut' }, 0)
        .to(el, { drawSVG: '100% 100%', duration: len * 0.4, ease: 'power2.inOut' }, len * 0.75);
      tl.progress(1).progress(0);
      this.figures.push({ fig, el, tl, start: pos, len, n: i });
      if (this.figures.length > 2) this.figures.shift().tl.kill();
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]); g.lineDashOffset = 0;
      g.fillStyle = pal.ground; g.fillRect(0, 0, W, H);
      if (!window.VIZ_GSAP || !window.VIZ_GSAP.ready) { g.restore(); return; }
      const k = window.VIZ_GSAP;
      if (!this.clock) this.clock = k.createClock();
      if (this.key !== Math.round(W) + 'x' + Math.round(H)) this.build(W, H);

      const t = p.millis() / 1000;
      const follow = Math.round(params.follow) === 1;
      const c = this.clock.update(signals, t, follow);
      const P = k.drive(params, PRESETS.drop, DRIVE, follow ? c.auto : 0);
      const E = clamp(P.energy, 0, 1);
      const pos = c.pos;
      const S = Math.min(W, H);
      const lw = S * 0.0045 * P.weight * (1 + 0.35 * c.bass);
      g.lineCap = 'round'; g.lineJoin = 'round';

      // ---- scheduling on the beat grid
      if (this.nextFig === null) this.nextFig = Math.ceil(pos / 4) * 4;
      if (pos >= this.nextFig) {
        const len = E > 0.5 ? 8 : 16;
        this.startFigure(this.nextFig, len);
        this.nextFig += len * 0.75;
      }
      const launch = () => {
        const d = this.darts[this.dartN++ % this.darts.length];
        d.start = pos;
        d.speed = clamp(params.reaction, 0.5, 2);
      };
      if (c.kick) launch();
      const half = Math.floor(pos * 2);
      if (this.lastHalf === null) this.lastHalf = half;
      if (half !== this.lastHalf) { this.lastHalf = half; if (half % 2 && E > 0.6) launch(); }
      if (c.snare) {
        const q = this.curls[this.curlN++ % this.curls.length];
        q.start = pos;
        const a = hash(this.curlN, 1.3);
        q.x = W * (a < 0.5 ? 0.1 + 0.15 * hash(this.curlN, 2) : 0.75 + 0.15 * hash(this.curlN, 2));
        q.y = H * (0.36 + 0.28 * hash(this.curlN, 3.3));
        q.r = (hash(this.curlN, 5) - 0.5) * 2;
        q.flip = a < 0.5 ? 1 : -1;
      }

      // ---- a drafting grid of small crosses, drifting slowly (the page moves
      // under the pen)
      {
        const step = S / 9, drift = (pos * 0.05 * step) % step, a = S * 0.008;
        g.strokeStyle = pal.faint; g.lineWidth = Math.max(1, lw * 0.5);
        g.beginPath();
        for (let x = -step + drift; x < W + step; x += step) {
          for (let y = (H / 2) % step - step; y < H + step; y += step) {
            g.moveTo(x - a, y); g.lineTo(x + a, y); g.moveTo(x, y - a); g.lineTo(x, y + a);
          }
        }
        g.stroke();
      }

      // ---- ribbons: a faint full line, and dashes chasing round it
      this.chaseU += c.dt * (0.02 + 0.05 * c.bass + 0.03 * E);
      const nCh = Math.round(lerp(0, 6, clamp(P.chasers, 0, 1)));
      for (const rb of this.ribbons) {
        g.setLineDash([]);
        g.strokeStyle = pal.faint; g.lineWidth = lw * 0.8;
        g.stroke(rb.p2);
        g.strokeStyle = pal.line; g.lineWidth = lw * 0.9;
        for (let j = 0; j < nCh; j++) {
          rb.ct.totalTime(this.chaseU + j / nCh + 10);
          if (k.applyDash(g, rb.chase)) g.stroke(rb.p2);
        }
      }

      // ---- figures, in the middle
      g.save();
      g.translate(W / 2, H / 2);
      for (let i = 0; i < this.figures.length; i++) {
        const f = this.figures[i];
        const lt = pos - f.start;
        f.tl.time(clamp(lt, 0, f.tl.duration()));
        const older = i < this.figures.length - 1;
        g.save();
        const rot = (lt * 0.012 + f.n * 0.9) * (older && E > 0.5 ? -1.6 : 1);
        g.rotate(rot);
        if (older && E > 0.5) g.scale(1.18, 1.18);
        // The construction line: the whole figure, faint, under the pen.
        if (!older) {
          g.setLineDash([]);
          g.globalAlpha = clamp(lt / 1.5, 0, 1) * clamp((f.len * 1.1 - lt) / 2, 0, 1);
          g.strokeStyle = pal.faint; g.lineWidth = lw * 0.9;
          g.stroke(f.fig.p2);
          g.globalAlpha = 1;
        }
        if (k.applyDash(g, f.el)) {
          g.strokeStyle = older && E > 0.5 ? pal.acc : pal.line;
          g.lineWidth = lw * (older && E > 0.5 ? 0.8 : 1.1);
          g.stroke(f.fig.p2);
        }
        g.setLineDash([]);
        // Glints along what is drawn.
        if (!older || E > 0.5) {
          const da = f.el.style.strokeDasharray, off = parseFloat(f.el.style.strokeDashoffset) || 0;
          const parts = (da || '').split(/[ ,]+/).map(parseFloat);
          const len = parts.length > 1 ? parts[0] + parts[1] : 1;
          const u0 = -off / len, u1 = u0 + (parts[0] || 0) / len;
          g.fillStyle = pal.dart;
          for (let j = 0; j < f.fig.glints.length; j++) {
            const q = f.fig.glints[j];
            if (q.u < u0 || q.u > u1) continue;
            const tw = hash(j + f.n * 40, Math.floor(t * 12));
            const r = lw * (0.4 + 2.6 * c.hat * tw * tw);
            if (r < lw * 0.5) continue;
            g.beginPath(); g.arc(q.x, q.y, r, 0, TAU); g.fill();
          }
        }
        g.restore();
      }
      g.restore();

      // ---- curls
      g.strokeStyle = pal.acc;
      for (const q of this.curls) {
        const lt = pos - q.start;
        if (lt < 0 || lt > q.tl.duration()) continue;
        q.tl.time(lt);
        g.save();
        g.translate(q.x, q.y); g.rotate(q.r); g.scale(q.flip, 1);
        g.lineWidth = lw * 1.3;
        if (k.applyDash(g, q.el)) g.stroke(q.p2);
        g.restore();
      }

      // ---- darts and their comets
      for (const d of this.darts) {
        const lt = (pos - d.start) * d.speed;
        if (lt < 0 || lt > d.tl.duration()) continue;
        d.tl.time(lt);
        g.strokeStyle = pal.dart; g.lineWidth = lw * 1.2;
        if (k.applyDash(g, d.trail)) g.stroke(d.rb.p2);
        g.setLineDash([]);
        if (lt < 2.4) {
          const o = d.obj;
          g.save();
          g.translate(o.x, o.y); g.rotate(o.rotation * Math.PI / 180);
          const s = S * 0.022;
          g.fillStyle = pal.line;
          g.beginPath(); g.moveTo(s * 1.4, 0); g.lineTo(-s, -s * 0.75); g.lineTo(-s * 0.45, 0); g.lineTo(-s, s * 0.75); g.closePath(); g.fill();
          g.restore();
        }
      }
      g.setLineDash([]);
      g.restore();
    },
  });
})();
