// Write On: kinetic type, the After Effects title card that writes itself.
//
// The letters are Monoline, a geometric capital alphabet drawn as strokes
// (assets/lottie/type.js), so every letter is a shape layer group that a trim
// path can write on and off. type.js typesets the "Words" parameter into
// Bodymovin JSON in the browser: per word, a precomp in which each letter
// writes on with a staggered trim, springs up into place on an overshooting
// ("back") ease, holds, and writes off, with the whole word under a repeater
// that stacks copies of it behind itself for an extruded, shadowed look. Each
// word is placed twice: a hero, and a giant slow outline of the same word
// drifting behind it. The scene plays the words' in, hold and out as segments
// by setting their time remaps from the beat clock, and edits the authored
// keyframes live (a kick adds a bounce on top of a letter's own keyframed
// scale and position).
//
// Music:
//   kick   one letter jumps and settles (letters take turns)
//   snare  an underline swooshes on and off beneath the word
//   bass   the extrusion deepens a little and the strokes thicken
//   hats   four-point glints pop round the word
//   bar    a new word writes on every couple of bars, on a downbeat
//   drop   words change every bar, the extrusion goes deep, the strokes go
//          heavy and the bounce doubles; the breakdown slows to one word
//          every three bars, thin and flat
(function () {
  'use strict';

  function script(src) {
    const all = window.VIZ_LOTTIE_SCRIPTS = window.VIZ_LOTTIE_SCRIPTS || {};
    return all[src] || (all[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error(src + ' did not load'));
      document.head.appendChild(s);
    }));
  }
  function boot(p) {
    const st = { ready: false, error: null };
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_LOTTIE && window.VIZ_LOTTIE.Player ? Promise.resolve()
      : (window.VIZ_LOTTIE_KIT = window.VIZ_LOTTIE_KIT || new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'assets/lottie/kit.js'; s.onload = res;
        s.onerror = () => rej(new Error('assets/lottie/kit.js did not load'));
        document.head.appendChild(s);
      }));
    kit.then(() => (window.VIZ_LOTTIE.type ? null : script('assets/lottie/type.js')))
      .then(() => window.VIZ_LOTTIE.ready())
      .then(() => { st.ready = true; })
      .catch((e) => { st.error = String(e && e.message || e); console.warn('lottie: ' + st.error); })
      .then(() => { if (hold) p._decrementPreload(); });
    return st;
  }

  const hexA = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; };
  const PALETTES = [
    { name: 'Poster', ground: '#f1e9d6', stroke: '#1b1b1b', giant: '#e0d2b3', under: '#e2462c', glint: '#e2462c' },
    { name: 'Night', ground: '#101217', stroke: '#f3eee2', giant: '#262b37', under: '#f0b43c', glint: '#f0b43c' },
    { name: 'Tomato', ground: '#e5533a', stroke: '#fff3e2', giant: '#d24a32', under: '#1c1c1c', glint: '#fff3e2' },
    { name: 'Cobalt', ground: '#2042b3', stroke: '#f6f1e6', giant: '#2d51c6', under: '#f3c13a', glint: '#f6f1e6' },
  ].map((pl) => Object.assign(pl, { rgb: { stroke: hexA(pl.stroke), giant: hexA(pl.giant), under: hexA(pl.under), glint: hexA(pl.glint) } }));

  const PRESETS = {
    calm: { pace: 2, weight: 12, depth: 0.35, bounce: 0.8, giant: 0.7 },
    drop: { pace: 1, weight: 20, depth: 1.5, bounce: 1.4, giant: 1 },
  };
  const DRIVE = ['pace', 'weight', 'depth', 'bounce', 'giant'];
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp01 = (u) => Math.min(1, Math.max(0, u));
  const easeOut = (u) => 1 - Math.pow(1 - clamp01(u), 3);
  const easeIn = (u) => Math.pow(clamp01(u), 2);
  const OUT_DUR = 0.85;       // seconds of the write-off segment

  VIZ.register({
    id: 'lottie5',
    name: 'Write On',
    order: 1115,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((pl) => pl.name), default: 0 },
      { key: 'text', label: 'Words (separate with /)', type: 'text', default: 'LOUDER / ONE MORE TIME / TOGETHER / ALL NIGHT / AGAIN' },
      { key: 'pace', label: 'Bars per word', type: 'range', min: 0.5, max: 4, default: PRESETS.calm.pace, step: 0.5 },
      { key: 'weight', label: 'Stroke weight', type: 'range', min: 4, max: 34, default: PRESETS.calm.weight, step: 0.1 },
      { key: 'depth', label: 'Extrusion depth', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.depth, step: 0.01 },
      { key: 'bounce', label: 'Letter bounce', type: 'range', min: 0, max: 2, default: PRESETS.calm.bounce, step: 0.01 },
      { key: 'giant', label: 'Giant outline behind', type: 'range', min: 0, max: 1, default: PRESETS.calm.giant, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.2, halation: 0.3 },

    gallery: {
      title: 'Write On',
      technique: 'Lottie (lottie-web 5.13.0, canvas renderer) playing Bodymovin JSON typeset in the browser (and by a Node generator for the file on disk) from Monoline, an original stroke alphabet of lines and arcs: per word, a precomp of letter groups, each with a staggered trim-path write-on and write-off and back-eased position and scale keyframes, under a repeater that stacks the word behind itself with an opacity ramp for extrusion; each word placed as a hero and a giant outline layer. The scene plays in, hold and out as segments by setting the precomps\' time remaps from the beat clock, and adds kick bounces on top of the authored keyframes through lottie-web\'s per-property effect chain.',
      brief: 'A title card that keeps writing itself to the beat: words in a clean geometric line alphabet draw on letter by letter, spring up into place and stack into a shadowed, extruded block, hold, then write themselves off as the next word arrives on a downbeat. Behind, the same word crawls past as a giant faint outline. Each kick makes one letter jump and settle, letters taking turns; the snare swooshes an underline on and off; hats pop small glints round the word; the bass deepens the extrusion. On the drop the words change every bar, the strokes go heavy and the extrusion deep; the breakdown slows to one thin word every three bars. The words are a text parameter.',
      lineage: 'Batch 08, Lottie (working with the medium). Kinetic typography is After Effects\' home ground, and the write-on (a trim path running along a letter\'s stroke) its signature; lottie-web plays it live, including repeaters over whole words and eases that overshoot. Descends from Saul Bass and Pablo Ferro title sequences, sign painters\' single-stroke lettering, neon script and the plotter; the alphabet is original.',
    },

    preload(p) { this.load = boot(p); },
    setup() { this.init(); },
    enter() { if (!this.M) this.init(); },
    leave() { if (this.player) { this.player.destroy(); this.player = null; } },

    init() { this.M = null; this.player = null; this.S = null; this.text = null; },

    words(text) {
      const w = String(text || '').split('/').map((x) => x.trim()).filter((x) => [...x.toUpperCase()].some((c) => /[A-Z0-9!?&]/.test(c)));
      return (w.length ? w : ['VIZ']).slice(0, 12);
    },

    binder(tag, prop) {
      const self = this;
      const S = () => self.S;
      const L = window.VIZ_LOTTIE;
      let m;
      if ((m = /^(hero|giant)\.tm\.(\d+)$/.exec(tag))) {
        const which = m[1], k = +m[2];
        return () => S()[which + 'Tm'][k];
      }
      if ((m = /^giant\.(p|s|o)\.(\d+)$/.exec(tag))) {
        const k = +m[2];
        if (m[1] === 'p') return () => S().giantP;
        if (m[1] === 's') return () => [S().giantS, S().giantS, 100];
        return () => S().giantO;
      }
      if ((m = /^glint\.(p|s)\.(\d)$/.exec(tag))) {
        const j = +m[2];
        if (m[1] === 'p') return () => S().glintP[j];
        return () => { const k = S().glintS[j]; return [k, k]; };
      }
      switch (tag) {
        case 'ink.under': return () => S().pal.rgb.under;
        case 'ink.glint': return () => S().pal.rgb.glint;
        case 'under.s': return () => S().underS;
        case 'under.e': return () => S().underE;
        case 'under.p': return () => S().underP;
        case 'under.sc': return () => [S().underSc, 100];
        case 'under.zz': return () => S().underZZ;
        case 'under.w': return () => S().weight * 0.8;
      }
      // Inside a word: hero or giant, and which word, from the precomp layer
      // the property is playing in.
      const inst = L.instanceOf(prop);
      const giant = inst.indexOf('giant') === 0;
      const k = +(/(\d+)$/.exec(inst) || [0, 0])[1];
      if (tag === 'ink.stroke') return () => (giant ? S().pal.rgb.giant : S().pal.rgb.stroke);
      if (tag === 'weight') return () => (giant ? S().weight * 0.3 : S().weight);
      if (tag === 'ext.p') return () => (giant ? [0, 0] : S().ext);
      if (tag === 'ext.home') return () => (giant ? [0, 0] : [-S().ext[0] * (S().extN - 1), -S().ext[1] * (S().extN - 1)]);
      if (tag === 'ext.so') return () => (giant ? 100 : 22);
      if ((m = /^L\.(p|s|r)\.(\d+)$/.exec(tag))) {
        const j = +m[2];
        if (giant) return null;
        const env = () => (S().word === k ? S().bounce[j] || 0 : 0);
        if (m[1] === 's') return (v) => { const e = env(); return [v[0] * (1 + 0.22 * e), v[1] * (1 + 0.22 * e)]; };
        if (m[1] === 'p') return (v) => [v[0], v[1] - S().cap * 0.3 * env()];
        return () => (j % 2 ? 9 : -9) * env();
      }
      return null;
    },

    draw(p, signals, params, ctx) {
      if (!this.M) this.init();
      const L = window.VIZ_LOTTIE;
      const pal = PALETTES[Math.round(params.palette)] || PALETTES[0];
      p.background(pal.ground);
      if (!this.load || !this.load.ready || !L || !L.type) return;
      const t = p.millis() / 1000;
      if (!this.M) this.M = L.listener();
      const M = this.M.update(signals, t);
      const dt = M.dt;
      const follow = Math.round(params.follow) === 1;
      const P = {};
      for (const k of DRIVE) P[k] = follow ? lerp(params[k], PRESETS.drop[k], M.auto) : params[k];

      // (Re)typeset when the words change; the JSON is built here, in the
      // browser, by the same code the generator runs.
      if (this.text !== params.text || !this.player) {
        this.text = params.text;
        const words = this.words(params.text);
        const data = L.type.build(words);
        this.meta = data.vizMeta;
        if (this.player) this.player.setData(data);
        else this.player = new L.Player(data, { bind: (tag, prop) => this.binder(tag, prop) });
        const n = words.length;
        this.S = {
          t, pal, n, word: 0, wordAt: t, outAt: Infinity, prev: -1, prevOutAt: -99,
          heroTm: new Float32Array(n).fill(-1), giantTm: new Float32Array(n).fill(-1),
          giantP: [960, 960, 0], giantS: 300, giantO: 100, giantDrift: 0,
          bounce: new Float32Array(40), bounceAt: new Float64Array(40).fill(-99),
          ext: [0, 0], extN: this.meta.ext, weight: 12, cap: 200,
          underS: 0, underE: 0, underP: [960, 1200], underSc: 100, underZZ: 18, snareAt: -99,
          glintAt: new Float64Array(6).fill(-99), glintP: Array.from({ length: 6 }, () => [960, 960]), glintS: new Float32Array(6), nextGlint: 0,
        };
      }
      const S = this.S;
      S.t = t;
      S.pal = pal;
      const quiet = L.smooth(0.25, 0.05, M.energy);
      const beat = M.period;
      // Words: a new one on the first kick after its time is up (so it lands
      // on a beat), or on time alone when there are no kicks.
      const life = Math.max(0.5, P.pace * (1 + 0.5 * quiet)) * 4 * beat;
      const wm = this.meta.words[S.word];
      if (S.outAt === Infinity && t - S.wordAt > life - OUT_DUR - 0.2 && (M.kick || t - S.wordAt > life)) {
        S.outAt = t;
      }
      if (S.outAt !== Infinity && t - S.outAt > 0.3) {
        S.prev = S.word; S.prevOutAt = S.outAt;
        S.word = (S.word + 1) % S.n;
        S.wordAt = t; S.outAt = Infinity;
        S.bounceAt.fill(-99);
      }
      const hold = Math.min(1.9, (3 * Math.max(0, this.meta.words[S.word].letters - 1) + 30) / 60);
      S.heroTm.fill(-1); S.giantTm.fill(-1);
      const a = t - S.wordAt;
      S.heroTm[S.word] = S.outAt === Infinity ? Math.min(a, hold) : 2 + (t - S.outAt);
      S.giantTm[S.word] = S.outAt === Infinity ? Math.min(a * 0.42, hold) : 2 + (t - S.outAt) * 0.6;
      if (S.prev >= 0 && S.prev !== S.word) {
        const b = t - S.prevOutAt;
        if (b < OUT_DUR + 0.2) S.heroTm[S.prev] = 2 + b;
        if (b * 0.6 < OUT_DUR + 0.2) S.giantTm[S.prev] = 2 + b * 0.6;
      }
      const cw = this.meta.words[S.word];
      S.cap = cw.cap;

      // Kick: one letter jumps (letters take turns).
      if (M.kick && P.bounce > 0.01 && S.outAt === Infinity && a > 0.3) {
        const j = M.kicks % Math.max(1, cw.letters);
        S.bounceAt[j] = t;
      }
      for (let j = 0; j < S.bounce.length; j++) {
        const u = t - S.bounceAt[j];
        S.bounce[j] = u < 0 || u > 1.2 ? 0 : P.bounce * Math.sin(Math.min(1, u / 0.09) * Math.PI / 2) * Math.exp(-5.5 * Math.max(0, u - 0.09)) * Math.cos(Math.max(0, u - 0.09) * 9);
      }
      // Extrusion and weight: the drop goes deep and heavy.
      const d = P.depth * (1 + 0.25 * M.bass) * (1 - 0.6 * quiet);
      S.ext = [6 * d, 8 * d];
      S.weight = P.weight * (0.9 + 0.2 * M.bass) * (1 - 0.35 * quiet);
      // Giant: drifts slowly behind.
      S.giantDrift += dt * (0.4 + M.bass);
      S.giantP = [960 + 380 * Math.sin(S.giantDrift * 0.09), 960 + 120 * Math.sin(S.giantDrift * 0.061 + 1), 0];
      S.giantS = 290 + 30 * Math.sin(t * 0.05);
      S.giantO = 100 * P.giant;
      // Snare: the underline.
      if (M.snare) S.snareAt = t;
      const sa = t - S.snareAt;
      S.underE = 100 * easeOut(sa / 0.28);
      S.underS = 100 * easeIn((sa - 0.22) / 0.4);
      S.underP = [960, cw.y0 + cw.cap * 1.28];
      S.underSc = (cw.width / 1000) * 100;
      S.underZZ = cw.cap * 0.07;
      // Hats: glints round the word.
      if (M.hat && M.hats % 2 === 0) {
        const j = S.nextGlint; S.nextGlint = (j + 1) % 6;
        const side = Math.random() < 0.5 ? -1 : 1;
        S.glintAt[j] = t;
        S.glintP[j] = [cw.x0 + Math.random() * cw.width, cw.y0 + cw.cap / 2 + side * cw.cap * (0.75 + 0.3 * Math.random())];
      }
      for (let j = 0; j < 6; j++) {
        const u = (t - S.glintAt[j]) / 0.32;
        S.glintS[j] = u >= 0 && u < 1 ? 100 * (0.4 + 0.8 * M.hatLvl) * Math.sin(Math.PI * u) : 0;
      }

      if (this.player.render(p, 0)) this.player.draw(p, ctx);
    },
  });
})();
