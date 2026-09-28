// Text V2 — Raph's 2016 dotted word (../../viz/text.js, ../../../Text.pde)
// as stipple type at stage scale. Notes in harness/v2/text.md.
//
// V1 put a dot on every point of the word's outline and sized each dot by one
// band, so the only thing the music did was inflate a small logo until it went
// to mush. V2 keeps the dots as the letters' only material and keeps them
// fusing when the bass swells (the metaball moment that was the best of V1),
// but fills the letters with a stipple, sets the word across the stage, prints
// every dot in two flat inks that drift out of register, and gives the music
// separate places to land: one letter per kick, a spray per clap, dust for the
// hats, and a drop that streams the dots into the next word.
(function () {
  'use strict';

  const shared = window.VIZ_PALETTES || [];
  // A bar at the track's tempo, as core assumes when it has no tempo (60/124 s
  // a beat); only used to count bars between words.
  const BAR = 4 * 60 / 124;
  const MASK = 0.5;          // mask pixels per virtual unit
  const DUST = 420;

  // [family, weight, fallback]. Heavy faces only: a stipple needs thick stems.
  const FACES = [
    ['Archivo Black', '400', '"Arial Black", Impact, sans-serif'],
    ['Anton', '400', 'Impact, "Arial Narrow", sans-serif'],
    ['Abril Fatface', '400', 'Georgia, serif'],
    ['Rubik Mono One', '400', '"Arial Black", sans-serif'],
    ['Alfa Slab One', '400', 'Rockwell, Georgia, serif'],
  ];

  const PRESETS = {
    calm: { swarm: 0.12, dotSize: 0.9, register: 0.6, bars: 8, flow: 0.35 },
    drop: { swarm: 1, dotSize: 1.12, register: 0.8, bars: 2, flow: 1.4 },
    // A dark ColorLisa row printed with light inks (screen instead of
    // multiply), for rooms where a light ground is too much.
    night: { colorPalette: 20, swarm: 0.12, dotSize: 0.9, register: 0.6, bars: 8, flow: 0.35 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['swarm', 'dotSize', 'register', 'bars', 'flow'];

  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luma(hex) {
    const c = rgbOf(hex);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function mix(a, b, t) {
    const x = rgbOf(a), y = rgbOf(b);
    const c = (i) => Math.round(x[i] + (y[i] - x[i]) * t);
    return 'rgb(' + c(0) + ',' + c(1) + ',' + c(2) + ')';
  }
  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(u) { return u * u * (3 - 2 * u); }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function hash2(i, j) {
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // One smooth swirl shared by the dust and the swarm, so both run in the
  // same rivers instead of each dot wandering on its own.
  function swirl(x, y, t) {
    return 1.9 * Math.sin(x * 0.0055 + t * 0.21) + 1.6 * Math.cos(y * 0.0075 - t * 0.17) + 0.6 * Math.sin((x + y) * 0.003);
  }

  function parseWords(s) {
    const w = String(s == null ? '' : s).split(/\s*[\/\n\r]\s*/).map((x) => x.trim()).filter(Boolean);
    return w.length ? w.map((x) => x.slice(0, 24)) : ['VIZ'];
  }

  VIZ.register({
    id: 'textv2',
    name: 'Text',
    versionOf: 'text',
    version: 'V2',
    order: 732,

    params: [
      { key: 'displayText', legacy: 'DISPLAYTEXT', label: 'Words (split with /)', type: 'text',
        default: 'VIZ / MOVE / TOGETHER' },
      { key: 'face', label: 'Typeface', type: 'select',
        options: FACES.map((f) => f[0]), default: 0 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() })),
        default: 0 },
      { key: 'swarm', label: 'Swarm', type: 'range', min: 0, max: 1, default: PRESETS.calm.swarm, step: 0.01 },
      { key: 'dotSize', legacy: 'SIZE1', label: 'Dot size', type: 'range', min: 0.5, max: 1.6, default: PRESETS.calm.dotSize, step: 0.01 },
      { key: 'register', label: 'Misregistration', type: 'range', min: 0, max: 1, default: PRESETS.calm.register, step: 0.01 },
      { key: 'bars', label: 'Bars per word', type: 'range', min: 1, max: 32, default: PRESETS.calm.bars, step: 1 },
      { key: 'flow', label: 'Dust flow', type: 'range', min: 0, max: 2, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'dots', label: 'Dots', type: 'range', min: 1200, max: 4000, default: 2600, step: 100 },
      { key: 'sensitivity', legacy: 'SENSITIVITY', label: 'Reaction', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      {
        id: 'shuffle',
        label: 'Shuffle palette',
        // The original's shuffleCurrentColors, ground and inks included.
        run(params) {
          const ar = this.palettes && this.palettes[Math.round(params.colorPalette)];
          if (!ar) return;
          for (let i = ar.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const a = ar[j];
            ar[j] = ar[i];
            ar[i] = a;
          }
        },
      },
      { id: 'next', label: 'Next word', run() { this.forceNext = true; } },
    ],

    gallery: {
      title: 'Text V2',
      technique: 'Canvas 2D: each word rasterised once in a web poster face to an offscreen mask, filled with a fixed count of dots on a jittered hex lattice (dots shrink toward the edges by a sampled edge distance); dots split between two overprinted ink plates, each drawn as one unioned path (multiply on light grounds, screen on dark), the second offset by a turning registration vector; dots reassigned to the next word by rank and carried along a shared swirl field as velocity-stretched ellipses; onset detection against slow baselines; a section follower easing between calm and drop presets',
      brief: 'Raph\'s dotted word, grown into stipple type the size of the stage and printed like a riso poster: thousands of dots split between two flat inks on the palette\'s ground, side by side in the stipple and dark only where they touch. The pad slides the second plate out of register so the breakdown floats in coloured fringes; the bass swell pulls it back and fattens the dots until they fuse into solid letters, the metaball of the 2016 sketch. Each kick presses the next letter in reading order, which squashes flat and wide and prints in the third ink; each clap makes that letter shed a spray of dots into the dust that drifts across the stage in slow rivers and sparkles with the hats. The drop breaks the word: its dots leave in a wave from left to right, stream along curling paths as short streaks, and settle into the next word of the phrase, again every two bars while the drop lasts. The performer types the phrase.',
      lineage: [
        'V1: Text (web/viz/text.js), a port of Raph\'s Text.pde (2016): FreeSans outline sampled every 11 units, a dot per point sized by one band, the dots fusing when loud; five modes, 23 ColorLisa palettes, a shuffle.',
        'Six-judge panel (2026-09-28): 72nd of 72, mean 1.83, "a logo, not a work" (Curator), "an ident" (Floor), "a watermark" (Psychonaut). Scope chosen: reconception, keeping dots as the only mark, the typed word, the palettes, Sensitivity and the fusing on the bass.',
        'Director ("make the letters actors": one letter per beat in sequence; the drop breaks them into dots that swarm into a new word; slow reassembly): the spine of V2.',
        'Designer (a real word in a real face at poster scale; the kick spreads the ink instead of inflating the letter): heavy poster faces fitted to the stage; the kicked letter squashes flat and wide like a platen.',
        'Curator and Director ("white mush", "blobs balloon"): dot size follows a slow bass swell, not every band per dot, and the dots stay inside the letter.',
        'Purist (centred emblems): the word fills the stage; dust and swarm use the whole frame. Psychonaut (nothing to fall into): two sliding plates and a continuous river of dust.',
        'TASTE (range, not glow): flat inks overprinted on a ground, no bloom; a night preset for dark rooms.',
        'Rejected: folding it into Dot Matrix or retiring it (Floor, Psychonaut, Curator); paper and impressions (Letterpress already owns them).',
      ],
    },

    setup() {
      this.palettes = shared.map((pal) => pal.colors.slice());
    },

    enter() {
      this.st = null;
      this.lastT = null;
    },

    // Ground and three inks. Inks are taken in the palette's own order (so the
    // shuffle changes them) but skip colours too close to the ground to read.
    inksOf(pal) {
      const ground = pal[0];
      const gL = luma(ground);
      const seen = new Set([ground.toLowerCase()]);
      const rest = [];
      for (let i = 1; i < pal.length; i++) {
        const c = pal[i];
        if (seen.has(c.toLowerCase())) continue;
        seen.add(c.toLowerCase());
        rest.push(c);
      }
      const contrast = (c) => Math.abs(luma(c) - gL);
      const byContrast = rest.slice().sort((a, b) => contrast(b) - contrast(a));
      const key = rest.find((c) => contrast(c) >= 60) || byContrast[0] || '#222222';
      const others = rest.filter((c) => c !== key);
      const readable = others.filter((c) => contrast(c) >= 40);
      const pool = readable.concat(others.filter((c) => readable.indexOf(c) < 0));
      const second = pool[0] || key;
      const accent = pool[1] || second;
      return { ground, key, second, accent, light: gL > 110 };
    },

    // Rasterise one word and fill it with exactly N dots. Returns target
    // positions in virtual units about the stage centre.
    buildTargets(word, face, W, H, N, salt) {
      const cw = Math.ceil(W * MASK), ch = Math.ceil(H * MASK);
      if (!this.mask) this.mask = document.createElement('canvas');
      const c = this.mask;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      const f = FACES[face] || FACES[0];
      const ready = window.VIZ_FONTS && window.VIZ_FONTS.has(f[0]);
      const fam = ready ? '"' + f[0] + '", ' + f[2] : f[2];
      g.font = f[1] + ' 100px ' + fam;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      const m = g.measureText(word);
      const left = m.actualBoundingBoxLeft || 0, right = m.actualBoundingBoxRight || m.width;
      const asc = m.actualBoundingBoxAscent || 72, desc = m.actualBoundingBoxDescent || 0;
      // Fit to the stage: wide enough to feel like a wall, with room for the
      // squash and the registration fringes.
      const sc = Math.min(cw * 0.86 / (left + right), ch * 0.6 / (asc + desc));
      g.font = f[1] + ' ' + (100 * sc).toFixed(2) + 'px ' + fam;
      const x0 = cw / 2 - (right - left) * sc / 2;
      const y0 = ch / 2 + (asc - desc) * sc / 2;
      g.fillStyle = '#fff';
      g.fillText(word, x0, y0);
      // Letter boundaries from the advance of each prefix.
      const bounds = [];
      for (let i = 1; i < word.length; i++) bounds.push(x0 + g.measureText(word.slice(0, i)).width);

      const alpha = g.getImageData(0, 0, cw, ch).data;
      const inside = (x, y) => {
        const xi = x | 0, yi = y | 0;
        if (xi < 0 || yi < 0 || xi >= cw || yi >= ch) return false;
        return alpha[(yi * cw + xi) * 4 + 3] > 127;
      };
      let area = 0;
      for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 127) area++;
      area = Math.max(area, 1);

      const rand = rng(hashStr(word) ^ (salt * 7919) ^ (face * 104729));
      // Hex lattice spacing for N dots over the area, in mask pixels.
      let s = Math.sqrt(area / N * 2 / Math.sqrt(3));
      let pts = [];
      for (let pass = 0; pass < 3; pass++) {
        pts = [];
        const rowH = s * Math.sqrt(3) / 2;
        const ox = rand() * s, oy = rand() * rowH;
        for (let row = 0, y = oy; y < ch; row++, y += rowH) {
          for (let x = ox + (row & 1 ? s / 2 : 0); x < cw; x += s) {
            const jx = x + (rand() - 0.5) * 0.55 * s;
            const jy = y + (rand() - 0.5) * 0.55 * s;
            if (inside(jx, jy)) pts.push(jx, jy);
          }
        }
        const n = pts.length / 2;
        if (Math.abs(n - N) < N * 0.02) break;
        s *= Math.sqrt(n / N);
      }
      // Trim or pad to exactly N; padding doubles up random dots, which only
      // makes a few spots a touch denser.
      let n = pts.length / 2;
      while (n > N) {
        const k = Math.floor(rand() * n);
        pts[2 * k] = pts[2 * n - 2]; pts[2 * k + 1] = pts[2 * n - 1];
        pts.length -= 2; n--;
      }
      while (n < N && n > 0) {
        const k = Math.floor(rand() * n);
        pts.push(pts[2 * k] + (rand() - 0.5) * s * 0.5, pts[2 * k + 1] + (rand() - 0.5) * s * 0.5);
        n++;
      }
      if (n === 0) for (let i = 0; i < N; i++) pts.push(cw / 2 + (rand() - 0.5) * cw * 0.5, ch / 2 + (rand() - 0.5) * 20);

      const T = {
        x: new Float32Array(N), y: new Float32Array(N), r: new Float32Array(N),
        letter: new Int16Array(N), s: s / MASK,
      };
      const dirs = 8;
      const nL = word.length;
      const lsum = new Float32Array(nL * 2), lcount = new Int32Array(nL), lbot = new Float32Array(nL).fill(-1e9);
      for (let i = 0; i < N; i++) {
        const px = pts[2 * i], py = pts[2 * i + 1];
        // Edge distance, sampled: dots near the edge shrink, so the letter's
        // contour stays crisp instead of beading like V1's outline.
        let hit = 0, tot = 0;
        for (let d = 1; d <= 3; d++) {
          for (let a = 0; a < dirs; a++) {
            const an = a / dirs * 2 * Math.PI;
            tot++;
            if (inside(px + Math.cos(an) * d * 0.55 * s, py + Math.sin(an) * d * 0.55 * s)) hit++;
          }
        }
        const ef = hit / tot;
        let L = 0;
        while (L < bounds.length && px > bounds[L]) L++;
        T.x[i] = px / MASK - W / 2;
        T.y[i] = py / MASK - H / 2;
        T.r[i] = (s / MASK) * 0.47 * (0.42 + 0.58 * ef * ef);
        T.letter[i] = L;
        lsum[2 * L] += T.x[i]; lsum[2 * L + 1] += T.y[i]; lcount[L]++;
        if (T.y[i] > lbot[L]) lbot[L] = T.y[i];
      }
      T.letters = [];
      T.lx = new Float32Array(nL); T.lbase = new Float32Array(nL);
      for (let L = 0; L < nL; L++) {
        if (lcount[L] > N * 0.01) T.letters.push(L);
        T.lx[L] = lcount[L] ? lsum[2 * L] / lcount[L] : 0;
        T.lbase[L] = lbot[L];
      }
      if (!T.letters.length) T.letters.push(0);
      // Rank order for assignment: particles keep their rank across words, so
      // the leftmost dots of one word become the leftmost of the next.
      const idx = Array.from({ length: N }, (_, i) => i);
      idx.sort((a, b) => (T.x[a] + 0.2 * T.y[a]) - (T.x[b] + 0.2 * T.y[b]));
      T.order = idx;
      return T;
    },

    targets(word, face, W, H, N, salt) {
      const f = FACES[face] || FACES[0];
      const ready = !!(window.VIZ_FONTS && window.VIZ_FONTS.has(f[0]));
      const key = [word, face, W.toFixed(1), H.toFixed(1), N, salt, ready].join('|');
      if (!this.cache) this.cache = new Map();
      let T = this.cache.get(key);
      if (!T) {
        T = this.buildTargets(word, face, W, H, N, salt);
        if (this.cache.size > 16) this.cache.clear();
        this.cache.set(key, T);
      }
      T.key = key;
      return T;
    },

    init(W, H, N) {
      const st = {
        N,
        x: new Float32Array(N), y: new Float32Array(N),
        px: new Float32Array(N), py: new Float32Array(N),
        fx: new Float32Array(N), fy: new Float32Array(N), fr: new Float32Array(N),
        tx: new Float32Array(N), ty: new Float32Array(N), tr: new Float32Array(N),
        letter: new Int16Array(N), delay: new Float32Array(N), ph: new Float32Array(N * 2),
        bulge: new Float32Array(N), plate: new Uint8Array(N),
        qx: new Float32Array(N), qy: new Float32Array(N),
        T: null, wordIdx: 0, changes: 0, timer: 0,
        transT: 99, dur: 1, amp: 0, rot0: 0,
        kickL: -1, kick: 0, kickSlot: 0,
        dust: new Float32Array(DUST * 3), spray: [],
      };
      const rand = rng(1234);
      for (let i = 0; i < N; i++) {
        st.ph[2 * i] = rand() * 6.283; st.ph[2 * i + 1] = rand() * 6.283;
        st.bulge[i] = 0.4 + rand();
        st.plate[i] = rand() < 0.5 ? 1 : 0;
      }
      for (let i = 0; i < DUST; i++) {
        st.dust[3 * i] = (rand() - 0.5) * W;
        st.dust[3 * i + 1] = (rand() - 0.5) * H;
        st.dust[3 * i + 2] = 0.6 + 1.4 * rand() * rand();
      }
      this.env = { bass: 0, pad: 0, hat: 0, kf: 0, ks: 0, cf: 0, cs: 0, kWait: 0, cWait: 0,
        low: 0, dropOn: false, auto: 0 };
      this.st = st;
    },

    // Move every dot toward a new set of targets, as a wave from left to right.
    retarget(T, amp, dur, W) {
      const st = this.st, N = st.N;
      // Current particles ranked the same way as the targets.
      const idx = Array.from({ length: N }, (_, i) => i);
      idx.sort((a, b) => (st.x[a] + 0.2 * st.y[a]) - (st.x[b] + 0.2 * st.y[b]));
      const rand = rng(st.changes * 31 + 7);
      for (let k = 0; k < N; k++) {
        const i = idx[k], j = T.order[k];
        st.fx[i] = st.x[i]; st.fy[i] = st.y[i]; st.fr[i] = st.tr[i];
        st.tx[i] = T.x[j]; st.ty[i] = T.y[j]; st.tr[i] = T.r[j];
        st.letter[i] = T.letter[j];
        st.delay[i] = 0.5 * clamp((T.x[j] + W / 2) / W, 0, 1) + 0.18 * rand();
      }
      st.T = T;
      st.transT = 0;
      st.amp = amp;
      st.dur = dur;
      st.rot0 = rand() * 6.283;
      st.kickL = -1;
      st.kickSlot = 0;
    },

    listen(signals, dt) {
      const e = this.env;
      // Slow bass swell: the sidechained line pumps every beat, so a slow
      // follower keeps the fusing a swell, not a per-beat inflation.
      e.bass = ease(e.bass, (signals[1] + signals[2]) / 200, 1.4, dt);
      e.pad = ease(e.pad, (signals[2] + signals[3] + signals[4]) / 300, 0.9, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 6, dt);
      const kick = signals[0] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      e.ks = ease(e.ks, kick, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      let kickNow = 0;
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        kickNow = clamp((e.kf - e.ks) * 3, 0.4, 1);
        e.kWait = 0.2;
      }
      // Clap: fast minus slow on the clap bands, so the breakdown pad in the
      // same bands never fires it.
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      let clapNow = false;
      if (e.cf - e.cs > 0.08 && e.cWait === 0) { clapNow = true; e.cWait = 0.35; }
      // Section follower on the bass line, with hysteresis.
      e.low = ease(e.low, signals[1], 1.2, dt);
      let dropStart = false;
      if (!e.dropOn && e.low > 27) { e.dropOn = true; dropStart = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kickNow, clapNow, dropStart };
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const N = Math.round(params.dots);
      if (!this.st || this.st.N !== N) this.init(W, H, N);
      const st = this.st, e = this.env;
      const sens = params.sensitivity;

      const ev = this.listen(signals, dt);
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 2.2 : 0.5, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // ---- words
      const words = parseWords(params.displayText);
      const face = Math.round(params.face) || 0;
      st.timer += dt;
      let change = false, big = false;
      if (this.forceNext) { change = true; big = true; this.forceNext = false; }
      if (follow && ev.dropStart) { change = true; big = true; }
      if (st.timer >= Math.round(P.bars) * BAR) change = true;
      if (change || !st.T) {
        if (st.T) { st.wordIdx = (st.wordIdx + 1) % words.length; st.changes++; }
        st.timer = 0;
      }
      st.wordIdx %= words.length;
      const salt = st.changes & 1;
      const T = this.targets(words[st.wordIdx], face, W, H, N, words.length > 1 ? 0 : salt);
      if (!st.T) {
        this.retarget(T, 0, 0.001, W);
        for (let i = 0; i < N; i++) {
          st.x[i] = st.fx[i] = st.tx[i]; st.y[i] = st.fy[i] = st.ty[i]; st.fr[i] = st.tr[i];
        }
        st.transT = 99;
      } else if (T !== st.T || change) {
        // A drop or a hand on "Next word" always breaks the word wide open;
        // a timed change in the calm reforms it gently.
        const sw = big ? Math.max(P.swarm, 0.85) : P.swarm;
        this.retarget(T, 30 + 210 * sw, 2.6 - 1.2 * sw, W);
      }
      st.transT += dt;

      // ---- kick and clap
      if (ev.kickNow && sens > 0) {
        const Ls = st.T.letters;
        st.kickSlot = (st.kickSlot + 1) % Ls.length;
        st.kickL = Ls[st.kickSlot];
        st.kick = ev.kickNow;
      }
      st.kick = Math.max(0, st.kick - dt * 3.2);
      const k = st.kick * Math.min(sens, 1.2);
      if (ev.clapNow && st.kickL >= 0 && sens > 0) {
        // The pressed letter sheds a spray into the dust.
        const rand = rng(Math.floor(t * 60));
        const Lx = st.T.lx[st.kickL];
        let made = 0;
        for (let tries = 0; tries < 400 && made < 34; tries++) {
          const i = Math.floor(rand() * N);
          if (st.letter[i] !== st.kickL) continue;
          const a = Math.atan2(st.y[i], st.x[i] - Lx) + (rand() - 0.5) * 1.2;
          const v = (60 + 120 * rand()) * sens;
          st.spray.push({ x: st.x[i], y: st.y[i], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
            r: st.tr[i] * (0.6 + 0.4 * rand()), life: 1 });
          made++;
        }
        if (st.spray.length > 300) st.spray.splice(0, st.spray.length - 300);
      }

      // ---- move the dots
      const size = P.dotSize * (1 + 0.5 * sens * e.bass);
      // A slow orbit about home even in the calm, so a held word breathes.
      const jig = (1 + P.swarm * 4) * Math.min(sens, 1.2);
      const T0 = st.T;
      for (let i = 0; i < N; i++) {
        st.px[i] = st.x[i]; st.py[i] = st.y[i];
        const u = clamp((st.transT - st.delay[i]) / st.dur, 0, 1);
        const s = smooth(u);
        let x = st.fx[i] + (st.tx[i] - st.fx[i]) * s;
        let y = st.fy[i] + (st.ty[i] - st.fy[i]) * s;
        if (u > 0 && u < 1) {
          const b = Math.sin(Math.PI * u) * st.amp * st.bulge[i];
          const a = swirl(x, y, t) + st.rot0;
          x += Math.cos(a) * b;
          y += Math.sin(a) * b * 0.8;
        }
        const ph = st.ph;
        x += Math.sin(t * 1.3 + ph[2 * i]) * jig;
        y += Math.cos(t * 1.1 + ph[2 * i + 1]) * jig;
        st.x[i] = x; st.y[i] = y;
        // The press is drawn where it lands but kept out of x/y, so the
        // squash does not read as motion and smear the letter into streaks.
        const L = st.letter[i];
        if (L === st.kickL && k > 0.001 && u >= 1) {
          // Platen: pressed down onto the letter's baseline and spread wide.
          const base = T0.lbase[L], cx = T0.lx[L];
          y = base + (y - base) * (1 - 0.14 * k);
          x = cx + (x - cx) * (1 + 0.07 * k);
        }
        st.qx[i] = x; st.qy[i] = y;
      }

      // ---- dust and sprays
      const flowV = P.flow * 38;
      const d = st.dust;
      const hx = W / 2 + 10, hy = H / 2 + 10;
      for (let i = 0; i < DUST; i++) {
        const a = swirl(d[3 * i], d[3 * i + 1], t);
        // A steady drift to the right under the swirl, so the dust reads as a
        // river crossing the stage rather than a stir in place.
        d[3 * i] += (Math.cos(a) * 0.6 + 0.8) * flowV * dt * (0.5 + d[3 * i + 2] * 0.4);
        d[3 * i + 1] += Math.sin(a) * 0.6 * flowV * dt;
        if (d[3 * i] > hx) d[3 * i] -= 2 * hx;
        if (d[3 * i] < -hx) d[3 * i] += 2 * hx;
        if (d[3 * i + 1] > hy) d[3 * i + 1] -= 2 * hy;
        if (d[3 * i + 1] < -hy) d[3 * i + 1] += 2 * hy;
      }
      for (let j = st.spray.length - 1; j >= 0; j--) {
        const q = st.spray[j];
        q.vx *= Math.exp(-2.2 * dt); q.vy *= Math.exp(-2.2 * dt);
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.life -= dt / 1.8;
        if (q.life <= 0) st.spray.splice(j, 1);
      }

      // ---- print
      const pal = this.palettes[Math.round(params.colorPalette)] || this.palettes[0];
      const ink = this.inksOf(pal);
      p.colorMode(p.RGB, 255);
      p.background(ink.ground);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = ink.light ? 'multiply' : 'screen';
      g.translate(W / 2, H / 2);

      // Registration: the pad pushes the second plate out; the bass swell
      // pulls it back in, so the drop prints tight and the breakdown floats.
      const reg = (1 + P.register * (6 + 60 * e.pad * sens)) * (1 - 0.6 * clamp(e.bass * sens, 0, 1));
      const ra = t * 0.23 + 0.6 * Math.sin(t * 0.11);
      const ox = Math.cos(ra) * reg, oy = Math.sin(ra) * reg;

      const dot = (x, y, r, vx, vy) => {
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0.4) {
          const rx = r + Math.min(len * 0.9, 4 * r);
          const ry = r * Math.max(0.55, 1 - len * 0.015);
          const a = Math.atan2(vy, vx);
          g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx);
          g.ellipse(x, y, rx, ry, a, 0, 2 * Math.PI);
        } else {
          g.moveTo(x + r, y);
          g.arc(x, y, r, 0, 2 * Math.PI);
        }
      };
      const radius = (i) => {
        const u = clamp((st.transT - st.delay[i]) / st.dur, 0, 1);
        let r = st.fr[i] + (st.tr[i] - st.fr[i]) * u;
        if (st.letter[i] === st.kickL && u >= 1) r *= 1 + 0.12 * k;
        return r * size;
      };

      // Each dot sits on one plate (a fixed half of them each), so the two
      // inks lie side by side in the stipple and mix only where dots touch;
      // pushing the second plate out of register doubles the word.
      const plate = st.plate;
      const pressed = (i) => st.letter[i] === st.kickL && k > 0.001;
      const plateOf = (which, dx, dy) => {
        g.beginPath();
        for (let i = 0; i < N; i++) {
          if (plate[i] !== which || pressed(i)) continue;
          dot(st.qx[i] + dx, st.qy[i] + dy, radius(i), st.x[i] - st.px[i], st.y[i] - st.py[i]);
        }
      };
      plateOf(1, ox, oy);
      const hat = clamp(e.hat * sens * 1.6, 0, 1.5);
      const tick = Math.floor(t * 14);
      for (let i = 0; i < DUST; i++) {
        let r = d[3 * i + 2];
        // Hats: a few grains flare on each tick.
        if (hash2(i, tick) > 0.86) r *= 1 + 2.2 * hat;
        g.moveTo(d[3 * i] + r, d[3 * i + 1]);
        g.arc(d[3 * i], d[3 * i + 1], r, 0, 2 * Math.PI);
      }
      g.fillStyle = ink.second;
      g.fill();
      plateOf(0, 0, 0);
      g.fillStyle = ink.key;
      g.fill();

      // The pressed letter snaps into register and prints in the third ink
      // on both plates, easing back as the press lifts.
      if (st.kickL >= 0 && k > 0.001) {
        const kk = clamp(k * 1.5, 0, 1);
        for (let which = 0; which < 2; which++) {
          const dx = which ? ox * (1 - kk) : 0, dy = which ? oy * (1 - kk) : 0;
          g.beginPath();
          for (let i = 0; i < N; i++) {
            if (plate[i] !== which || !pressed(i)) continue;
            dot(st.qx[i] + dx, st.qy[i] + dy, radius(i), st.x[i] - st.px[i], st.y[i] - st.py[i]);
          }
          g.fillStyle = mix(which ? ink.second : ink.key, ink.accent, kk);
          g.fill();
        }
      }
      if (st.spray.length) {
        g.beginPath();
        for (const q of st.spray) dot(q.x, q.y, q.r * Math.sqrt(q.life), q.vx * dt, q.vy * dt);
        g.fillStyle = ink.accent;
        g.fill();
      }
      g.restore();
    },
  });
})();
