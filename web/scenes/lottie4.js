// Riso Jelly: shape morphing and path modifiers, the After Effects way of
// making vectors wet.
//
// Six blobs of riso ink on paper (assets/lottie/lottie4.json, written by
// gen-lottie4.mjs). Each blob is one eight-vertex bezier path keyframed
// through six organic shapes; After Effects (and lottie-web) interpolate
// matching vertices and tangents, which is what makes a vector morph read as
// liquid. The same animated path feeds four groups under different path
// modifiers: the ink body under a pucker-and-bloat, two contour lines under
// offset paths (tide marks that follow it at two distances) and
// a ripple line whose offset the kick throws outward. The layers multiply, so
// where blobs cross the inks overprint. Each blob is a precomp instance whose
// time remap the scene runs at its own music-driven pace, so the six morph
// independently from three animations.
//
// Music:
//   kick   a ripple rings out from one blob and its outer contour flares
//          (blobs take turns)
//   snare  one blob skips ahead a whole shape with a springy lurch
//   bass   everything morphs faster and the bodies puff up
//   hats   the outer contours flick heavier
//   drop   the bodies pucker into star-like splashes, the outer contours
//          come in, the blobs grow and the morph races; the breakdown lets
//          them settle and slow
(function () {
  'use strict';

  const FILES = ['assets/lottie/lottie4.json'];
  function boot(p, files) {
    const st = { ready: false, data: null, error: null };
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_LOTTIE && window.VIZ_LOTTIE.Player ? Promise.resolve()
      : (window.VIZ_LOTTIE_KIT = window.VIZ_LOTTIE_KIT || new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'assets/lottie/kit.js'; s.onload = res;
        s.onerror = () => rej(new Error('assets/lottie/kit.js did not load'));
        document.head.appendChild(s);
      }));
    kit.then(() => Promise.all([window.VIZ_LOTTIE.ready()].concat(files.map(window.VIZ_LOTTIE.fetchJSON))))
      .then((r) => { st.data = r.slice(1); st.ready = true; })
      .catch((e) => { st.error = String(e && e.message || e); console.warn('lottie: ' + st.error); })
      .then(() => { if (hold) p._decrementPreload(); });
    return st;
  }

  const hexA = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; };
  // Light grounds only: the blobs multiply, like ink on paper.
  const PALETTES = [
    { name: 'Riso', ground: '#f3ecdc', line: '#2b3350', blobs: ['#f0607e', '#3f72d9', '#f5c342', '#1e9a7c', '#f0607e', '#3f72d9'] },
    { name: 'Sorbet', ground: '#fbf2e7', line: '#5a4868', blobs: ['#f59d7e', '#9cc4e9', '#f6d77c', '#b8a2e4', '#f59d7e', '#9cc4e9'] },
    { name: 'Earth', ground: '#eee4d2', line: '#2e2a24', blobs: ['#c9653c', '#6f8d4f', '#dca645', '#4e7090', '#c9653c', '#6f8d4f'] },
    { name: 'Blue ink', ground: '#eef1f4', line: '#0f1b33', blobs: ['#2152bd', '#7a9ce0', '#28407a', '#a9c0ec', '#2152bd', '#7a9ce0'] },
  ].map((pl) => Object.assign(pl, { lineRGB: hexA(pl.line), blobRGB: pl.blobs.map(hexA) }));

  const PRESETS = {
    calm: { morph: 0.6, bloat: 3, contours: 0.3, size: 1, ripple: 0.9 },
    drop: { morph: 1.8, bloat: -22, contours: 1, size: 1.15, ripple: 1.3 },
  };
  const DRIVE = ['morph', 'bloat', 'contours', 'size', 'ripple'];
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp01 = (u) => Math.min(1, Math.max(0, u));
  const easeOut = (u) => 1 - Math.pow(1 - clamp01(u), 3);
  // Where each blob lives (comp coordinates of a 1920 square; the 16:9 stage
  // sees y 420..1500) and how it wanders.
  const HOME = [[600, 850], [1340, 800], [980, 1120], [400, 1230], [1530, 1240], [1000, 700]];
  const SIZE = [1.0, 0.95, 1.05, 0.82, 0.86, 0.72];

  VIZ.register({
    id: 'lottie4',
    name: 'Riso Jelly',
    order: 1114,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((pl) => pl.name), default: 0 },
      { key: 'morph', label: 'Morph speed', type: 'range', min: 0, max: 3, default: PRESETS.calm.morph, step: 0.01 },
      { key: 'bloat', label: 'Pucker ↔ bloat', type: 'range', min: -60, max: 60, default: PRESETS.calm.bloat, step: 0.1 },
      { key: 'contours', label: 'Outer contours', type: 'range', min: 0, max: 1, default: PRESETS.calm.contours, step: 0.01 },
      { key: 'size', label: 'Blob size', type: 'range', min: 0.5, max: 1.6, default: PRESETS.calm.size, step: 0.01 },
      { key: 'ripple', label: 'Kick ripples', type: 'range', min: 0, max: 2, default: PRESETS.calm.ripple, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.15, halation: 0.3 },

    gallery: {
      title: 'Riso Jelly',
      technique: 'Lottie (lottie-web 5.13.0, canvas renderer) playing original Bodymovin JSON written by a Node generator: three blob precomps, each an eight-vertex bezier path keyframed through six seeded organic shapes, feeding four groups under different path modifiers (pucker-and-bloat on the filled body; two offset-path contours; an offset-path ripple line), on multiply-blended shape layers. Six time-remapped instances in the root comp; the scene runs each instance\'s time remap at its own music-driven rate and binds positions, modifiers and inks per instance through lottie-web\'s per-property effect chain. Rendered into an offscreen canvas composited onto the p5 stage.',
      brief: 'Six soft blobs of riso ink on paper, pink, blue, yellow and green, drifting and endlessly changing shape like jelly or lava-lamp wax, each outlined by a contour line that follows it like a tide mark. Where they overlap the inks overprint into new colours. Each kick throws a ripple ring out from one blob and flares its outer contour; the snare makes one blob lurch a whole shape ahead; the bass speeds the morphing and puffs the bodies up; hats flick the outer contours heavier. On the drop the blobs pucker into star-like splashes, grow, race, and a second contour appears round each; the breakdown lets them settle.',
      lineage: 'Batch 08, Lottie (working with the medium). Path morphing between keyframed bezier shapes, and the path operators that ride on it (pucker and bloat, offset paths), are core After Effects shape-layer craft that lottie-web evaluates live. Descends from risograph overprinting, Matisse cut-outs, lava lamps, topographic contour lines and the liquid-blob motion graphics of 2010s app design.',
    },

    preload(p) { this.load = boot(p, FILES); },
    setup() { this.init(); },
    enter() { if (!this.M) this.init(); },
    leave() { if (this.player) { this.player.destroy(); this.player = null; } },

    init() { this.M = null; this.player = null; this.S = null; },

    makeState(meta) {
      const n = meta.blobs;
      return {
        t: 0, n, cycle: meta.cycle,
        clock: Float64Array.from({ length: n }, (_, k) => k * 1.37),
        rate: Float32Array.from({ length: n }, (_, k) => 0.8 + 0.08 * ((k * 5) % 7)),
        jump: new Float32Array(n), jumpT: new Float32Array(n),
        rippleAt: new Float64Array(n).fill(-99), pos: HOME.map((h) => [h[0], h[1], 0]), rot: new Float32Array(n), scale: new Float32Array(n).fill(100),
        bloat: 0, outerO: 30, innerA: 38, flare: new Float32Array(n), pal: PALETTES[0],
        nextRipple: 0, nextJump: 0, shimmer: 0,
      };
    },

    binder(tag, prop) {
      const self = this;
      const S = () => self.S;
      let m;
      if ((m = /^b\.(tm|p|r|s)\.(\d)$/.exec(tag))) {
        const k = +m[2];
        if (m[1] === 'tm') return () => { const c = S().cycle; const v = (S().clock[k] + S().jump[k]) % c; return v < 0 ? v + c : v; };
        if (m[1] === 'p') return () => S().pos[k];
        if (m[1] === 'r') return () => S().rot[k];
        return () => [S().scale[k], S().scale[k], 100];
      }
      // Inside the shared blob assets: tell the instances apart by the name
      // of the precomp layer they are playing in ("blob 3").
      const inst = window.VIZ_LOTTIE.instanceOf(prop);
      const k = +(/(\d+)$/.exec(inst) || [0, 0])[1];
      switch (tag) {
        case 'ink.blob': return () => S().pal.blobRGB[k % S().pal.blobRGB.length];
        case 'ink.line': return () => S().pal.lineRGB;
        case 'bloat': return () => S().bloat;
        case 'inner.a': return () => S().innerA;
        case 'outer.a': return () => S().innerA + 44;
        case 'outer.o': return () => Math.min(100, S().outerO + 45 * S().flare[k]);
        case 'outer.w': return () => 3.2 * (1 + 0.8 * S().shimmer + 1.2 * S().flare[k]);
        case 'ripple.a': return () => 20 + 300 * easeOut((S().t - S().rippleAt[k]) / 1.3);
        case 'ripple.o': return () => { const a = (S().t - S().rippleAt[k]) / 1.3; return a >= 0 && a < 1 ? 100 * (1 - a) * S().rippleK : 0; };
        case 'ripple.w': return () => 3 + 6 * Math.max(0, 1 - (S().t - S().rippleAt[k]) / 1.3);
      }
      return null;
    },

    draw(p, signals, params, ctx) {
      if (!this.M) this.init();
      const L = window.VIZ_LOTTIE;
      const pal = PALETTES[Math.round(params.palette)] || PALETTES[0];
      p.background(pal.ground);
      if (!this.load || !this.load.ready || !L) return;
      const t = p.millis() / 1000;
      if (!this.M) this.M = L.listener();
      const M = this.M.update(signals, t);
      const dt = M.dt;
      const follow = Math.round(params.follow) === 1;
      const P = {};
      for (const k of DRIVE) P[k] = follow ? lerp(params[k], PRESETS.drop[k], M.auto) : params[k];

      if (!this.S) this.S = this.makeState(this.load.data[0].vizMeta);
      if (!this.player) this.player = new L.Player(this.load.data[0], { bind: (tag, prop) => this.binder(tag, prop) });
      const S = this.S;
      S.t = t;
      S.pal = pal;

      const quiet = L.smooth(0.25, 0.05, M.energy);
      const pace = P.morph * (0.35 + 1.1 * M.bass) * (1 - 0.5 * quiet);
      if (M.snare) { const k = S.nextJump; S.nextJump = (k + 2) % S.n; S.jumpT[k] += 1; }
      if (M.kick && P.ripple > 0.01) {
        const k = S.nextRipple; S.nextRipple = (k + 1) % S.n;
        S.rippleAt[k] = t; S.flare[k] = 1;
      }
      S.rippleK = Math.min(1, P.ripple);
      if (M.hat) S.shimmer = 1;
      S.shimmer *= Math.exp(-8 * dt);
      // Fit: the 16:9 stage sees 1080 of the comp's 1920; a square sees it all,
      // so the blobs grow to keep the same share of the frame.
      const fit = Math.max(1, Math.min(1.5, (ctx.height / ctx.width) * 1920 / 1080 * 0.8));
      for (let k = 0; k < S.n; k++) {
        S.clock[k] += dt * pace * S.rate[k];
        // The snare's lurch: a fast ease to the next shape, a small overshoot.
        const d = S.jumpT[k] - S.jump[k];
        S.jump[k] += d * (1 - Math.exp(-7 * dt));
        S.flare[k] *= Math.exp(-4 * dt);
        const h = HOME[k];
        const w = 0.05 + 0.013 * k;
        S.pos[k] = [960 + (h[0] - 960) * fit + 110 * Math.sin(t * w + k * 1.9), 960 + (h[1] - 960) * fit + 70 * Math.cos(t * w * 1.3 + k)];
        S.rot[k] = 20 * Math.sin(t * 0.03 * (1 + k * 0.2) + k);
        S.scale[k] = 100 * SIZE[k] * P.size * fit * (1 + 0.04 * M.bass);
      }
      S.bloat = P.bloat + 9 * M.bass;
      S.innerA = 30 + 12 * M.bass;
      S.outerO = 100 * P.contours;

      if (this.player.render(p, 0)) this.player.draw(p, ctx);
    },
  });
})();
