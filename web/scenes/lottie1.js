// Line Work: trim paths, the After Effects way of drawing a line.
//
// One trefoil knot, offset into sixteen parallel strands, is the whole
// drawing (assets/lottie/lottie1.json, written by gen-lottie1.mjs). Nothing is
// drawn by this file: every mark on screen is lottie-web's canvas renderer
// evaluating a trim path. The dashes are each strand trimmed to a segment
// whose offset the music runs round the knot; their lengths breathe once a
// bar from keyframes on the root timeline, which the beat clock scrubs; the
// snake is the same sixteen strands under one trim in "individually" mode, so
// a single line winds out through the whole bundle strand after strand; and
// the accents are the stock motion-graphics hits (a repeater fan of rays drawn
// on and off, a ring, a pop, a tick), played by setting their precomp time
// remaps, not by lottie's own clock.
//
// Music:
//   kick   a burst fires at the head of one strand's dash, and that strand
//          thickens for a moment (strands take turns)
//   snare  a rounded square is drawn round, unwound and thrown open elsewhere
//   bass   the dashes run faster and heavier
//   hats   small plus-ticks pop beside the ribbon
//   bar    the dash lengths swell and ebb across the bundle, once a bar
//   drop   the dashes lengthen towards whole strands, the snake comes in and
//          the bursts double; the breakdown thins the dashes to stitches and
//          lets the pencilled track show through
(function () {
  'use strict';

  const FILES = ['assets/lottie/lottie1.json'];
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
  const PALETTES = [
    { name: 'Navy and vermilion', ground: '#14233a', inks: ['#efe6d2', '#e2583e', '#5fb3a6', '#efe6d2'] },
    { name: 'Blue pencil on paper', ground: '#efe8d8', inks: ['#1f3fb4', '#e0433a', '#1c1c1c', '#1c1c1c'] },
    { name: 'Chalk and ochre', ground: '#101012', inks: ['#f4efe4', '#d7a13b', '#7a97d6', '#f4efe4'] },
    { name: 'Mint and tomato', ground: '#cfe4d6', inks: ['#113d35', '#ee6440', '#fdf6e8', '#113d35'] },
  ].map((pl) => Object.assign(pl, { inkRGB: pl.inks.map(hexA) }));

  const PRESETS = {
    calm: { flow: 0.55, dash: 0.2, weight: 0.8, twist: 14, snake: 0, bursts: 0.8 },
    drop: { flow: 1.5, dash: 0.62, weight: 1.35, twist: 30, snake: 1, bursts: 1.3 },
  };
  const DRIVE = ['flow', 'dash', 'weight', 'twist', 'snake', 'bursts'];
  const lerp = (a, b, u) => a + (b - a) * u;
  const TAU = Math.PI * 2;

  VIZ.register({
    id: 'lottie1',
    name: 'Line Work',
    order: 1111,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((pl) => pl.name), default: 0 },
      { key: 'flow', label: 'Line speed', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'dash', label: 'Dash length', type: 'range', min: 0.04, max: 1, default: PRESETS.calm.dash, step: 0.01 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.3, max: 2, default: PRESETS.calm.weight, step: 0.01 },
      { key: 'twist', label: 'Stagger across strands (°)', type: 'range', min: 0, max: 60, default: PRESETS.calm.twist, step: 0.1 },
      { key: 'snake', label: 'Snake (one trim through all)', type: 'range', min: 0, max: 1, default: PRESETS.calm.snake, step: 0.01 },
      { key: 'bursts', label: 'Hit size', type: 'range', min: 0, max: 2, default: PRESETS.calm.bursts, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.35, halation: 0.5 },

    gallery: {
      title: 'Line Work',
      technique: 'Lottie (lottie-web 5.13.0, canvas renderer) playing original Bodymovin JSON written by a Node generator: sixteen parallel offset strands of a trefoil, each a shape group with its own trim path, one more group trimming all sixteen in "individually" mode, and three precomp hit animations (repeater ray fan, ring, pop, tick) placed as time-remapped slot layers parented to a null. lottie-web renders into an offscreen canvas composited onto the p5 stage; the music drives it through lottie-web\'s per-property effect chain (trim offsets and lengths, stroke widths, inks, slot time remaps, positions) and scrubs the root timeline with the beat clock via renderFrame.',
      brief: 'The After Effects line: a trefoil knot drawn as a flat ribbon of sixteen parallel strands, with coloured dashes running round it like signals along a cable. The dashes swell and ebb across the bundle once a bar; each kick fires a little burst of rays and a ring off the head of one dash, strands taking turns; the snare draws a rounded square round and throws it open; hats pop small plus-ticks beside the ribbon; the bass runs the lines faster and heavier. On the drop the dashes grow towards whole strands, a single line snakes out through the entire bundle and the bursts double; the breakdown thins everything to stitches over the pencilled track. Flat inks on a flat ground, motion-design timing.',
      lineage: 'Batch 08, Lottie (working with the medium). Trim paths are the signature After Effects move (the write-on, the line that draws itself, the UI micro-animation burst), and lottie-web evaluates them live, including the "individually" trim mode that treats many paths as one. Descends from motion-graphics title lines, cable-and-signal diagrams, and Bridget Riley\'s parallel-line paintings.',
    },

    preload(p) { this.load = boot(p, FILES); },
    setup() { this.init(); },
    enter() { if (!this.M) this.init(); },
    leave() { if (this.player) { this.player.destroy(); this.player = null; } },

    init() {
      this.M = null;
      this.player = null;
      this.S = null;
    },

    makeState(meta) {
      const n = meta.strands;
      // Centreline, by arc length, for finding a dash's head.
      const c = meta.centre, cum = [0];
      for (let j = 1; j <= c.length; j++) {
        const a = c[j - 1], b = c[j % c.length];
        cum.push(cum[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      const slot = (k) => ({ at: new Float64Array(k).fill(-99), p: Array.from({ length: k }, () => [960, 960, 0]), r: new Float32Array(k), s: new Float32Array(k).fill(100), next: 0 });
      return {
        n, centre: c, cum, len: cum[cum.length - 1],
        off: new Float32Array(n), dashK: 0.2, w: new Float32Array(n).fill(1), flash: new Float32Array(n),
        flowPos: 0, snakePos: 0, snakeO: 0, snakeLen: 4, trackW: 1.5, trackO: 30,
        rigR: 0, rigS: 1, t: 0, weight: 1, inks: PALETTES[0].inkRGB,
        burst: slot(8), pop: slot(3), tick: slot(12),
      };
    },

    // Where the dash of strand k currently ends, in comp coordinates.
    along(u) {
      const S = this.S;
      u = ((u % 1) + 1) % 1;
      const d = u * S.len, cum = S.cum, c = S.centre;
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
      const a = c[lo], b = c[(lo + 1) % c.length];
      const f = (d - cum[lo]) / Math.max(1e-6, cum[lo + 1] - cum[lo]);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
    },

    fire(kind, x, y, rot, scale) {
      const sl = this.S[kind], j = sl.next;
      sl.next = (j + 1) % sl.at.length;
      sl.at[j] = this.S.t; sl.p[j] = [x, y, 0]; sl.r[j] = rot; sl.s[j] = scale;
    },

    binder(tag) {
      const self = this;
      const S = () => self.S;
      const parts = tag.split('.');
      if (/^ink\d$/.test(tag)) { const n = +tag[3]; return () => S().inks[n]; }
      if (parts[0] === 'dash') { const k = +parts[1]; return (v) => Math.min(100, v * S().dashK); }
      if (parts[0] === 'off') { const k = +parts[1]; return () => S().off[k]; }
      if (parts[0] === 'w') { const k = +parts[1]; return (v) => v * S().weight * (1 + 1.4 * S().flash[k]); }
      if (tag === 'trackW') return () => S().trackW;
      if (tag === 'trackO') return () => S().trackO;
      if (tag === 'snakeE') return () => S().snakeLen;
      if (tag === 'snakeOff') return () => S().snakeO;
      if (tag === 'snakeO') return () => S().snakeOp;
      if (tag === 'snakeW') return (v) => v * S().weight;
      if (tag === 'rig.r') return () => S().rigR;
      if (tag === 'rig.s') return () => [S().rigS * 100, S().rigS * 100, 100];
      if (parts.length === 3 && (parts[0] === 'burst' || parts[0] === 'pop' || parts[0] === 'tick')) {
        const j = +parts[2];
        const sl = () => S()[parts[0]];
        if (parts[1] === 'tm') return () => { const a = S().t - sl().at[j]; return a > 1.5 ? -1 : a; };
        if (parts[1] === 'p') return () => sl().p[j];
        if (parts[1] === 'r') return () => sl().r[j];
        if (parts[1] === 's') return () => [sl().s[j], sl().s[j], 100];
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
      if (!this.player) this.player = new L.Player(this.load.data[0], { bind: (tag) => this.binder(tag) });
      const S = this.S;
      S.t = t;
      S.inks = pal.inkRGB;

      // Travel: the bass runs the line; it never stops.
      S.flowPos += dt * P.flow * 0.045 * (0.55 + 0.9 * M.bass);
      for (let k = 0; k < S.n; k++) {
        S.off[k] = (S.flowPos * 360 + k * P.twist) % 360;
        S.flash[k] *= Math.exp(-6 * dt);
      }
      // Breakdown: the dashes thin to stitches, the pencilled track comes up.
      const quiet = L.smooth(0.25, 0.05, M.energy);
      S.dashK = P.dash * (1 - 0.55 * quiet);
      S.weight = P.weight * (0.85 + 0.35 * M.bass) * (1 - 0.35 * quiet);
      S.trackW = 1.2 + 0.8 * P.weight;
      S.trackO = 16 + 34 * quiet;
      S.snakeOp = 100 * P.snake;
      S.snakePos += dt * P.flow * 0.02 * (0.6 + M.bass);
      S.snakeO = (S.snakePos * 360) % 360;
      S.snakeLen = 2.2 + 3 * P.snake;
      S.rigR = 4 * Math.sin(t * 0.07) + 2 * Math.sin(t * 0.031 + 1);
      // Fit the ribbon (1640 x 980 of a 1920 square comp, plus the bundle's
      // width either side) to the stage.
      const visH = 1920 * Math.min(1, ctx.height / ctx.width), visW = 1920 * Math.min(1, ctx.width / ctx.height);
      S.rigS = Math.min(visW * 0.95 / 1850, visH * 0.95 / 1190) * (1 + 0.012 * Math.sin(t * 0.21));

      const react = P.bursts;
      if (M.kick && react > 0.01) {
        const n = M.auto > 0.5 ? 2 : 1;
        for (let q = 0; q < n; q++) {
          const k = (M.kicks * 5 + q * 8) % S.n;
          const e = Math.min(100, 100 * S.dashK) / 100;
          const [x, y, a] = this.along(S.off[k] / 360 + e * 0.8);
          S.flash[k] = 1;
          this.fire('burst', x, y, (a * 180) / Math.PI + 90, 100 * react * (0.5 + 0.2 * M.auto));
        }
      }
      if (M.snare && react > 0.01) {
        const [x, y] = this.along((M.snares * 0.382 + 0.1) % 1);
        this.fire('pop', x, y, (M.snares % 4) * 22, 100 * react * (0.6 + 0.25 * M.auto));
      }
      if (M.hat && M.hats % 2 === 0) {
        const r = Math.random();
        const [x, y, a] = this.along(r);
        const side = (Math.random() < 0.5 ? -1 : 1) * (130 + 90 * Math.random());
        this.fire('tick', x - Math.sin(a) * side, y + Math.cos(a) * side, 0, 55 + 60 * M.hatLvl);
      }

      // The root timeline is one bar of dash breathing; the beat clock scrubs it.
      const bar = ((M.phase / 4) % 1 + 1) % 1;
      if (this.player.render(p, bar * 119.99)) this.player.draw(p, ctx);
    },
  });
})();
