// Rosette: repeaters, the After Effects way of making many from one.
//
// One ring, one repeater, and a tunnel of layered paper-cut rosettes
// (assets/lottie/lottie2.json, written by gen-lottie2.mjs). The ring is a
// polystar in two inks (a band, and a second band turned half a point and set
// a little inside it); the repeater copies it outward with a scale and a twist
// per copy, so the rings spiral. The flight into the tunnel is the repeater's
// offset sliding from 0 to 1 and wrapping, the stock AE infinite-zoom trick:
// at 1 every ring sits exactly where its neighbour was, so the loop has no
// seam. A medallion in the middle hides the innermost ring being born. The
// ring morphs daisy, star, scallop, cog on the root timeline (its radii and
// roundness are keyframed), which the beat clock scrubs two bars per shape.
//
// Music:
//   kick   the medallion punches and its inner star turns a step (only the
//          centre moves)
//   snare  a ring of light runs out through the tunnel
//   bass   the flight speeds up and the rings bloat
//   hats   the ring of pips round the medallion glints and ticks round
//   drop   more points per ring, a harder twist, wider spacing, faster
//          flight, and the rings pucker to blades; the breakdown slows to a
//          drift
(function () {
  'use strict';

  const FILES = ['assets/lottie/lottie2.json'];
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
  // ground, then ink0 (outline, medallion), ink1 (ring set A), ink2 (set B), ink3 (dots, disc)
  const PALETTES = [
    { name: 'Saffron and ultramarine', ground: '#f0e6d2', inks: ['#1b2a5c', '#2456b8', '#e3a42a', '#d4492f'] },
    { name: 'Night garden', ground: '#0f1828', inks: ['#0a0f1a', '#2f7a74', '#e7b35e', '#efe3c8'] },
    { name: 'Terracotta', ground: '#ead8c2', inks: ['#3a2920', '#b5532f', '#3e6b5a', '#f6eddd'] },
    { name: 'Plum and peach', ground: '#26182a', inks: ['#170d19', '#8c3b5e', '#f09a74', '#f4e4d0'] },
  ].map((pl) => Object.assign(pl, { inkRGB: pl.inks.map(hexA) }));

  const PRESETS = {
    calm: { flight: 0.5, petals: 12, twist: 6, bloat: 12, spacing: 1.16, punch: 0.8 },
    drop: { flight: 1.6, petals: 20, twist: 13, bloat: -14, spacing: 1.2, punch: 1.3 },
  };
  const DRIVE = ['flight', 'petals', 'twist', 'bloat', 'spacing', 'punch'];
  const lerp = (a, b, u) => a + (b - a) * u;

  VIZ.register({
    id: 'lottie2',
    name: 'Rosette',
    order: 1112,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((pl) => pl.name), default: 0 },
      { key: 'flight', label: 'Flight speed', type: 'range', min: 0, max: 3, default: PRESETS.calm.flight, step: 0.01 },
      { key: 'petals', label: 'Points per ring', type: 'range', min: 5, max: 28, default: PRESETS.calm.petals, step: 1 },
      { key: 'twist', label: 'Twist per ring (°)', type: 'range', min: -30, max: 30, default: PRESETS.calm.twist, step: 0.1 },
      { key: 'bloat', label: 'Pucker ↔ bloat', type: 'range', min: -40, max: 60, default: PRESETS.calm.bloat, step: 0.1 },
      { key: 'spacing', label: 'Ring spacing', type: 'range', min: 1.08, max: 1.35, default: PRESETS.calm.spacing, step: 0.001 },
      { key: 'punch', label: 'Kick strength', type: 'range', min: 0, max: 2, default: PRESETS.calm.punch, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.3, halation: 0.4 },

    gallery: {
      title: 'Rosette',
      technique: 'Lottie (lottie-web 5.13.0, canvas renderer) playing original Bodymovin JSON written by a Node generator: a two-band polystar ring (radii and roundness keyframed daisy, star, scallop, cog on the root timeline; points bound) under a pucker-and-bloat, repeated out through a tunnel by a repeater with a scale and twist per copy whose offset the music slides and wraps: the AE infinite-zoom trick. A star medallion with a repeated ring of pips and time-remapped ripple precomps sit on top. Rendered into an offscreen canvas composited onto the p5 stage; driven through lottie-web\'s per-property effect chain, inks baked into the JSON (a repeater clones its items, so a palette change rebuilds instead of binding every copy).',
      brief: 'A tunnel of layered paper-cut rosettes you fall into forever: rings in two inks, each a little bigger and a little turned so they spiral, flowing outward from a medallion in the centre. Every two bars the rings change shape (daisy, star, scallop, cog). The kick punches only the medallion; the snare sends one ring of light out through the tunnel; the bass speeds the fall and puffs the rings; the hats make the pips round the medallion glint. On the drop the rings take more points, pucker into blades, twist harder and rush; the breakdown slows to a drift.',
      lineage: 'Batch 08, Lottie (working with the medium). The repeater is After Effects\' generative core and lottie-web evaluates it live, including the offset that makes an endless zoom from a finite number of copies. Descends from rangoli and rosette ornament, Islamic star patterns, Indian block prints, paper-cut folk art and the kaleidoscopic tunnel of motion-graphics loops.',
    },

    preload(p) { this.load = boot(p, FILES); },
    setup() { this.init(); },
    enter() { if (!this.M) this.init(); },
    leave() { if (this.player) { this.player.destroy(); this.player = null; } },

    init() { this.M = null; this.player = null; this.S = null; },

    binder(tag) {
      const self = this;
      const S = () => self.S;
      switch (tag) {
        case 'off': return () => S().off;
        case 'points': return () => S().petals;
        case 'bandB.s': { return () => { const k = 100 / Math.sqrt(S().spacing); return [k, k]; }; }
        case 'bandB.r': return () => 180 / S().petals;
        case 'ringScale': return () => [S().spacing * 100, S().spacing * 100];
        case 'twist': return () => S().twist;
        case 'bloat': return () => S().bloat;
        case 'lineW': return () => S().lineW;
        case 'medS': return () => [S().medS, S().medS, 100];
        case 'medR': return () => S().medR;
        case 'medBloat': return () => S().medBloat;
        case 'innerR': return () => S().innerR;
        case 'innerBloat': return () => S().innerBloat;
        case 'pips.s': return () => [S().pips, S().pips];
        case 'pips.r': return () => S().pipsR;
      }
      const m = /^ripple\.(tm|r)\.(\d)$/.exec(tag);
      if (m) {
        const j = +m[2];
        if (m[1] === 'tm') return () => { const a = S().t - S().ripples[j]; return a > 1.2 ? -1 : a; };
        return () => j * 37;
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

      if (!this.S) this.S = { t: 0, off: 0, flight: 0, petals: 12, twist: 6, spacing: 1.16, bloat: 0, lineW: 2, dot: 11,
        medS: 100, kickAt: -9, hatAt: -9, pips: 100, pipsR: 0, pipsRT: 0, medR: 0, medBloat: 8, innerR: 0, innerRT: 0, innerBloat: 20, ripples: new Float64Array(4).fill(-99), nextRipple: 0, inks: pal.inkRGB, hat: 0 };
      if (!this.player) {
        this.player = new L.Player(this.load.data[0], {
          bind: (tag) => this.binder(tag),
          bake: (tag) => (/^ink\d$/.test(tag) ? this.S.inks[+tag[3]] : undefined),
        });
      }
      if (this.S.inks !== pal.inkRGB) { this.S.inks = pal.inkRGB; this.player.rebake(); }
      const S = this.S;
      S.t = t;

      const quiet = L.smooth(0.25, 0.05, M.energy);
      // Flight: rings per second outward; the bass pushes it, it never stops.
      S.off = (S.off + dt * P.flight * (0.35 + 0.8 * M.bass) * (1 - 0.6 * quiet)) % 1;
      S.petals = Math.round(P.petals);
      S.twist = P.twist;
      S.spacing = P.spacing;
      S.bloat = P.bloat + 26 * M.bass - 10 * quiet;
      S.lineW = 2.4 * (1 - 0.4 * quiet);

      // Kick: the medallion takes it (a spring), its inner star steps round.
      // A damped spring, written out rather than simulated so it is the same
      // at any frame rate.
      if (M.kick) { S.kickAt = t; S.innerRT += 30; }
      const ka = t - S.kickAt;
      S.medS = 100 + 15 * P.punch * Math.exp(-6.5 * ka) * Math.cos(12 * ka);
      S.innerR += (S.innerRT - S.innerR) * (1 - Math.exp(-10 * dt));
      S.medR = t * 6;
      S.medBloat = 8 - 30 * M.auto;
      S.innerBloat = 20 + 30 * M.bass;
      // Hats: the ring of pips round the medallion glints and ticks round.
      if (M.hat) { S.hatAt = t; S.pipsRT += 22.5 / 2; }
      S.pipsR += (S.pipsRT - S.pipsR) * (1 - Math.exp(-14 * dt));
      S.pips = 100 + 55 * Math.exp(-9 * (t - S.hatAt)) * (0.4 + M.hatLvl);
      if (M.snare) { S.ripples[S.nextRipple] = t; S.nextRipple = (S.nextRipple + 1) % 4; }

      // Petal shapes: two bars each, scrubbed by the beat clock.
      const f = ((M.phase / 32) % 1 + 1) % 1;
      if (this.player.render(p, f * 479.99)) this.player.draw(p, ctx);
    },
  });
})();
