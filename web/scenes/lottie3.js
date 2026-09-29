// Title Sequence: track mattes, the After Effects way of cutting between
// worlds.
//
// Five flat pattern plates (stripes, dots, rings, zig-zag, sunburst; see
// assets/lottie/gen-lottie3.mjs) sit in four slots, and three of the slots are
// seen only through track mattes: circles that open like irises (alpha matte),
// a venetian blind that travels across the frame (alpha matte of a repeated
// slat), and a card-shaped window whose outside shows a fourth plate (inverted
// alpha matte). lottie-web's canvas renderer composites each matte with
// offscreen buffers, exactly as After Effects' track matte does, so a plate can
// be cut to any shape at any moment. The scene only decides when: the matte
// shapes' scales and positions, which plate is in which slot, and the plates'
// own motion (repeater offsets, a zig-zag modifier, a spin) are bound to the
// music; the window card morphs once a bar on the root timeline.
//
// Music:
//   kick   an iris opens somewhere inside the window onto the next plate, then
//          slowly closes (irises take turns, so a few are always open)
//   snare  a venetian blind sweeps across onto a third plate
//   bass   the plates move faster: stripes and dots slide, rings thicken, the
//          zig-zag deepens, the sunburst turns
//   hats   small four-point glints pop inside the window
//   drop   the scene floods through a giant iris into the next plate (the one
//          the irises were showing becomes the ground), the window tightens so
//          the outer plate takes more of the frame, and irises open in pairs
(function () {
  'use strict';

  const FILES = ['assets/lottie/lottie3.json'];
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
  // Colours by role: 0 light, 1 hot, 2 dark, 3 cool, 4 second warm.
  const PALETTES = [
    { name: 'Bass', c: ['#f1e4c8', '#e2531d', '#1c1815', '#2c5ba3', '#e9b43c'] },
    { name: 'Pool', c: ['#f4ecdc', '#2a7ab8', '#173550', '#7cc6d9', '#f0a35a'] },
    { name: 'Olive and rose', c: ['#efe3cf', '#d9776a', '#2c2a24', '#6b7a3a', '#e8c26a'] },
    { name: 'Newsprint and red', c: ['#eeeae0', '#c8321f', '#141414', '#9a978f', '#d8d2c4'] },
  ].map((pl) => Object.assign(pl, { rgb: pl.c.map(hexA) }));
  const PLATE_INKS = { stripes: [0, 1], dots: [2, 0], rings: [1, 2], zigzag: [3, 0], sunburst: [4, 2] };

  const PRESETS = {
    calm: { windowSize: 1, iris: 0.6, speed: 0.5, lines: 1 },
    drop: { windowSize: 0.74, iris: 1, speed: 1.5, lines: 1 },
  };
  const DRIVE = ['windowSize', 'iris', 'speed', 'lines'];
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const easeIO = (u) => { u = Math.min(1, Math.max(0, u)); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };

  VIZ.register({
    id: 'lottie3',
    name: 'Title Sequence',
    order: 1113,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((pl) => pl.name), default: 0 },
      { key: 'windowSize', label: 'Window size', type: 'range', min: 0.35, max: 1.6, default: PRESETS.calm.windowSize, step: 0.01 },
      { key: 'iris', label: 'Iris size', type: 'range', min: 0, max: 1.6, default: PRESETS.calm.iris, step: 0.01 },
      { key: 'speed', label: 'Plate motion', type: 'range', min: 0, max: 3, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'lines', label: 'Outline weight', type: 'range', min: 0, max: 2, default: PRESETS.calm.lines, step: 0.01 },
      { key: 'flood', label: 'Cut to the next plate', type: 'select', options: ['On each drop', 'Every 8 bars', 'Every 4 bars', 'Never'], default: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.2, halation: 0.3 },

    gallery: {
      title: 'Title Sequence',
      technique: 'Lottie (lottie-web 5.13.0, canvas renderer) playing original Bodymovin JSON written by a Node generator: five pattern plates as precomps (repeater stripes and a two-level repeater dot grid with sliding offsets, concentric ellipses, a zig-zag modifier on repeated lines, a repeater sunburst), nested in four slot precomps, three of them under track mattes (alpha: six iris circles and a repeated slat blind; inverted alpha: a card path morphing circle, rounded square, lozenge, oval). lottie-web composites the mattes with its offscreen buffers; the scene binds matte scales and positions, slot visibility and the plates\' motion through lottie-web\'s per-property effect chain and scrubs the card morph with the beat clock.',
      brief: 'A Saul Bass title sequence that never ends: flat graphic worlds (stripes, polka dots, target rings, zig-zags, a sunburst) in a few strong inks, cut into one another by moving shapes. Each kick opens an iris onto the next world, which slowly closes again; the snare sweeps a venetian blind across onto a third; around it all a card-shaped window, changing shape each bar, is cut into a fourth. The bass drives the patterns (sliding, thickening, deepening, turning) and the hats swell the dots. On the drop the whole screen floods through a giant iris into the world the irises were showing, the window tightens and irises open in pairs; every eight bars it cuts to the next.',
      lineage: 'Batch 08, Lottie (working with the medium). Track mattes are how After Effects composites one layer through the shape of another, and lottie-web supports them (alpha and inverted) in the canvas renderer with offscreen buffers. Descends from Saul Bass\'s title sequences (Vertigo, Anatomy of a Murder), the iris and wipe transitions of silent film, and op-art pattern plates.',
    },

    preload(p) { this.load = boot(p, FILES); },
    setup() { this.init(); },
    enter() { if (!this.M) this.init(); },
    leave() { if (this.player) { this.player.destroy(); this.player = null; } },

    init() { this.M = null; this.player = null; this.S = null; },

    makeState(meta) {
      const n = meta.iris;
      return {
        t: 0, plates: meta.plates,
        slot: { base: 0, iris: 1, blind: 3, frame: 4 }, spare: 2,
        irisAt: new Float64Array(n).fill(-99), irisP: Array.from({ length: n }, () => [960, 960]), irisK: new Float32Array(n).fill(0.6), nextIris: 0,
        floodAt: -99, swapped: true, blindAt: -99, blindDir: 1, lastFloodBar: 0,
        off: { stripes: 0, dots: 0, zigzag: 0 }, spin: 0, ringsW: 30, zzAmp: 30, ringsP: [960, 960],
        windowS: 100, windowR: 0, lineW: 7, winLine: 9, rgb: null,
        glintAt: new Float64Array(meta.glints).fill(-99), glintP: Array.from({ length: meta.glints }, () => [960, 960]), glintS: new Float32Array(meta.glints), nextGlint: 0,
      };
    },

    binder(tag) {
      const self = this;
      const S = () => self.S;
      let m;
      if ((m = /^glint\.(p|s)\.(\d)$/.exec(tag))) {
        const j = +m[2];
        if (m[1] === 'p') return () => S().glintP[j];
        return () => { const k = S().glintS[j]; return [k, k]; };
      }
      if ((m = /^(base|iris|blind|frame)\.show\.(\w+)$/.exec(tag))) {
        const slot = m[1], pl = m[2];
        return () => (S().plates[S().slot[slot]] === pl ? 100 : 0);
      }
      if ((m = /^(base|iris|blind|frame)\.tm\.(\w+)$/.exec(tag))) {
        const slot = m[1], pl = m[2];
        return () => (S().plates[S().slot[slot]] === pl && (slot === 'base' || slot === 'frame' || (slot === 'iris' ? S().irisOn : S().blindOn)) ? 0 : -1);
      }
      if ((m = /^(base|iris|blind|frame)\.on$/.exec(tag))) {
        const slot = m[1];
        if (slot === 'iris') return () => (S().irisOn ? 100 : 0);
        if (slot === 'blind') return () => (S().blindOn ? 100 : 0);
        return () => 100;
      }
      if ((m = /^iris\.(p|s)\.(\d)$/.exec(tag))) {
        const j = +m[2];
        if (m[1] === 'p') return () => S().irisP[j];
        return () => { const k = S().irisScale[j]; return [k, k]; };
      }
      switch (tag) {
        case 'iris.line': return () => S().lineW;
        case 'window.line': return () => S().winLine;
        case 'window.s': return () => [S().windowS, S().windowS];
        case 'window.r': return () => S().windowR;
        case 'blind.p': return () => [S().blindX, 960];
        case 'blind.w': return () => [S().blindW, 3000];
        case 'stripes.off': return () => S().off.stripes % 1;
        case 'dots.off': return () => S().off.dots % 1;
        case 'zigzag.off': return () => S().off.zigzag % 1;
        case 'zigzag.amp': return () => S().zzAmp;
        case 'rings.w': return () => S().ringsW;
        case 'rings.p': return () => S().ringsP;
        case 'sunburst.r': return () => S().spin;
      }
      return null;
    },

    draw(p, signals, params, ctx) {
      if (!this.M) this.init();
      const L = window.VIZ_LOTTIE;
      const pal = PALETTES[Math.round(params.palette)] || PALETTES[0];
      p.background(pal.c[0]);
      if (!this.load || !this.load.ready || !L) return;
      const t = p.millis() / 1000;
      if (!this.M) this.M = L.listener();
      const M = this.M.update(signals, t);
      const dt = M.dt;
      const follow = Math.round(params.follow) === 1;
      const P = {};
      for (const k of DRIVE) P[k] = follow ? lerp(params[k], PRESETS.drop[k], M.auto) : params[k];

      if (!this.S) this.S = this.makeState(this.load.data[0].vizMeta);
      const S = this.S;
      if (!this.player) {
        // Inks are baked into the JSON (the plates repeat them hundreds of
        // times); a palette change rebuilds.
        this.player = new L.Player(this.load.data[0], {
          bind: (tag) => this.binder(tag),
          bake: (tag) => {
            const m = /^(\w+)\.(a|b)$/.exec(tag);
            if (m && PLATE_INKS[m[1]]) return S.rgb[PLATE_INKS[m[1]][m[2] === 'a' ? 0 : 1]];
            if (tag === 'line') return S.rgb[2];
            if (tag === 'glint') return S.rgb[0];
            return undefined;
          },
        });
      }
      if (S.rgb !== pal.rgb) { S.rgb = pal.rgb; this.player.rebake(); }
      S.t = t;
      const n = S.irisAt.length, FLOOD = n - 1;

      // The window: tightens on the drop, breathes a little with the bass.
      const visH = 1920 * Math.min(1, ctx.height / ctx.width);
      S.windowS = 100 * P.windowSize * (visH / 1080) * (1 + 0.035 * M.bass);
      S.windowR = 3 * Math.sin(t * 0.13);
      const inner = 470 * S.windowS / 100;          // room for irises inside the card

      // Kick: an iris opens inside the window.
      if (M.kick && P.iris > 0.01) {
        const pairs = M.auto > 0.5 ? 2 : 1;
        for (let q = 0; q < pairs; q++) {
          const j = S.nextIris; S.nextIris = (S.nextIris + 1) % FLOOD;
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * inner * 0.72;
          S.irisAt[j] = t;
          S.irisP[j] = [960 + Math.cos(a) * r * 1.2, 960 + Math.sin(a) * r * 0.8];
          S.irisK[j] = (0.62 + 0.5 * Math.random()) * P.iris;
        }
      }
      // Cut to the next plate through a giant iris: on a drop, or every N bars.
      const mode = Math.round(params.flood);
      const bar = Math.floor(M.phase / 4);
      const every = mode === 1 ? 8 : mode === 2 ? 4 : 0;
      const dropStart = M.drop && !this.wasDrop;
      this.wasDrop = M.drop;
      if (t - S.floodAt > 2 && ((mode !== 3 && dropStart) || (every && bar - S.lastFloodBar >= every && M.kick))) {
        S.floodAt = t; S.swapped = false; S.lastFloodBar = bar;
        S.irisAt[FLOOD] = t; S.irisP[FLOOD] = [960, 960];
      }
      if (!S.swapped && t - S.floodAt > 1.25) {
        // The flooded plate becomes the ground; the irises' plate moves on.
        const old = S.slot.base;
        S.slot.base = S.slot.iris;
        S.slot.iris = S.spare;
        S.spare = old;
        if (t - S.blindAt > 1.4) { const b = S.slot.blind; S.slot.blind = S.spare; S.spare = b; }
        S.irisAt.fill(-99);
        S.swapped = true;
      }
      S.irisScale = S.irisScale || new Float32Array(n);
      let open = false;
      for (let j = 0; j < n; j++) {
        const a = t - S.irisAt[j];
        let k = 0;
        if (j === FLOOD) k = a >= 0 && a < 1.3 ? 1000 * easeIO(a / 1.2) : 0;
        else if (a >= 0 && a < 2.2) k = 100 * S.irisK[j] * easeOut(a / 0.28) * (1 - easeIO((a - 0.5) / 1.7));
        S.irisScale[j] = k;
        if (k > 0.5) open = true;
      }
      S.irisOn = open;

      // Snare: the blind sweeps across (alternating direction).
      if (M.snare) { S.blindAt = t; S.blindDir = -S.blindDir; }
      const ba = (t - S.blindAt) / 1.3;
      S.blindOn = ba >= 0 && ba < 1;
      const u = easeIO(ba);
      S.blindX = S.blindDir > 0 ? lerp(-900, 2820, u) : lerp(2820, -900, u);
      S.blindW = S.blindOn ? 110 * Math.sin(Math.PI * Math.min(1, ba)) : 0;

      // The plates' own motion.
      const drive = dt * P.speed * (0.4 + 1.2 * M.bass);
      S.off.stripes += drive * 0.9;
      S.off.dots += drive * 0.6;
      S.off.zigzag += drive * 0.7;
      S.spin += drive * 14;
      S.ringsW = 22 + 34 * M.bass;
      S.ringsP = [960 + 60 * Math.sin(t * 0.3), 960 + 40 * Math.cos(t * 0.23)];
      S.zzAmp = 16 + 44 * M.bass;
      // Hats: glints pop inside the window.
      if (M.hat) {
        const j = S.nextGlint; S.nextGlint = (j + 1) % S.glintAt.length;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * inner * 1.1;
        S.glintAt[j] = t; S.glintP[j] = [960 + Math.cos(a) * r * 1.3, 960 + Math.sin(a) * r * 0.85];
      }
      for (let j = 0; j < S.glintAt.length; j++) {
        const a = (t - S.glintAt[j]) / 0.35;
        S.glintS[j] = a >= 0 && a < 1 ? 100 * (0.5 + M.hatLvl) * Math.sin(Math.PI * a) : 0;
      }
      S.lineW = 7 * P.lines;
      S.winLine = 10 * P.lines;

      // The card morphs once a bar, scrubbed by the beat clock.
      const f = ((M.phase / 16) % 1 + 1) % 1;
      if (this.player.render(p, f * 479.99)) this.player.draw(p, ctx);
    },
  });
})();
