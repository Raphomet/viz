// Futurist: a parole-in-liberta sheet after Marinetti's word-explosions and
// Depero's bolted typography, letterpress in black and red on cream stock.
// A sound burst sits left of centre and the whole page explodes out of it:
// words in every face and size fly outward along its rays and grow as they
// go, Balla's lines of force fan across the sheet, arcs of sound travel
// outward, and a long onomatopoeia runs out of the burst as a line of type
// whose letters swell with the bass, so the drone is literally drawn in
// letters. The headline sits top right in mixed faces, each letter its own
// size and tilt.
//
// Music, each in its own place:
//   kick   the burst stamps a red onomatopoeia (BUMM, TUMB...) at its centre,
//          letters growing across the word, and its spikes jab out; the
//          stamp then leaves along a ray and joins the explosion
//   snare  a black shout (TRAK!, PAM!) slams in at the edge of the sheet
//          with a zig-zag bolt, at a new spot each time
//   hats   typographic noise: small + x = ! t s letters prick the sheet
//          around the burst
//   bass   the drone line's letters swell, the swelling travelling outward
//          from the burst along the line; speed of the whole explosion
//   drop   the red plate comes in: red wedges of force, red words in the
//          flight, the headline turns red letter by letter and its letters
//          burst apart; more words fly. The breakdown sets the headline
//          back in black and thins the flight to a drift.
// Printed look: inks multiply onto a generated paper, red sits a hair out
// of register, paper shows through the ink as worn specks. No glow.

(function () {
  const INKS = [
    { name: 'Red & black on cream', paper: '#EDE2C8', fleck: [120, 96, 60], black: '#1B1713', red: '#D2291D', third: null },
    { name: 'Depero: red, black, cobalt', paper: '#EFE6CF', fleck: [110, 96, 70], black: '#1A1714', red: '#D8321E', third: '#1F4F9E' },
    { name: 'Black & ochre on newsprint', paper: '#DAD3C2', fleck: [90, 86, 78], black: '#191715', red: '#D08A1C', third: null },
  ];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixHex(a, b, u) {
    const A = hexRgb(a), B = hexRgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], u)) + ',' + Math.round(lerp(A[1], B[1], u)) + ',' + Math.round(lerp(A[2], B[2], u)) + ')';
  }

  // The faces a futurist compositor would have pulled from the case: fat
  // didones, grotesques, slab wood type, a typewriter for the small noise.
  const FACES = [
    ['Anton', 'Impact, sans-serif', ''],
    ['Abril Fatface', 'Georgia, serif', ''],
    ['Alfa Slab One', 'Rockwell, serif', ''],
    ['Archivo Black', 'Arial Black, sans-serif', ''],
    ['Playfair Display', 'Georgia, serif', '900 '],
    ['Bebas Neue', 'Impact, sans-serif', ''],
    ['Rubik Mono One', 'Arial Black, sans-serif', ''],
    ['Oswald', 'Arial Narrow, sans-serif', '700 '],
    ['Libre Baskerville', 'Georgia, serif', 'italic 700 '],
  ];
  const fontOf = (i, size) => {
    const f = FACES[i % FACES.length];
    return f[2] + size.toFixed(2) + 'px ' + face(f[0], f[1]);
  };

  VIZ.register({
    id: 'futurist',
    name: 'Futurist',
    order: 514,

    params: [
      { key: 'headline', label: 'Headline', type: 'text', default: 'BALLO ELETTRICO' },
      { key: 'kicks', label: 'Kick noises', type: 'text', default: 'BUMM TUMB DOOM BRUMM TUNN BOMM' },
      { key: 'claps', label: 'Clap noises', type: 'text', default: 'TRAK! PAM! CIAK! ZAC! TAC!' },
      { key: 'words', label: 'Flying words', type: 'text', default: 'LUCE NOTTE RITMO SUONO CORPI VELOCITÀ FOLLA ALBA VOCI TAMBURI SCINTILLE DANZA FUOCO ARIA' },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Explosion speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'density', label: 'Words in flight', type: 'range', min: 8, max: 80, default: 36, step: 1 },
      { key: 'swirl', label: 'Swirl', type: 'range', min: -1.5, max: 1.5, default: 0.25, step: 0.01 },
      { key: 'scatter', label: 'Scatter (angle chaos)', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'ink', label: 'Inks', type: 'select', options: INKS.map((i) => i.name), default: 0 },
    ],

    actions: [
      { id: 'reset', label: 'Reset the headline', run() { this.headKey = ''; this.headSeed = (this.headSeed || 1) + 1; } },
    ],

    gallery: {
      title: 'Futurist',
      technique: 'Canvas 2D letterpress in multiplied inks on a generated paper: a pool of words flying outward from a burst in polar coordinates with perspective growth and swirl, per-letter headline layout in nine mixed faces, a bass-history ring buffer driving a line of onomatopoeia letters as a travelling waveform, onset detection per band',
      brief: 'An Italian futurist parole-in-liberta poster that is literally making the noise. A sound burst left of centre explodes the page: words in every face and size fly outward along its rays and grow as they come at you, Balla-style lines of force fan across the sheet, arcs of sound travel out, and a long TRRRRUUUMMM runs out of the burst as a line of type whose letters swell with the bass, the swell travelling down the line like a waveform. Each kick stamps a red onomatopoeia (BUMM, TUMB) in the burst, its letters growing across the word, then flings it out into the flight; each clap slams a black TRAK! or PAM! in at the edge of the sheet with a zig-zag bolt; hats prick the sheet with small + x = ! letters. The drop brings in the red plate: red wedges of force, red words in flight, the headline turning red letter by letter and bursting apart; the breakdown sets it back in black and slows the explosion to a drift.',
      lineage: [
        'Marinetti\'s parole in liberta (words detonating across the page at every size and angle, onomatopoeia, mathematical signs as sound), Depero\'s mixed-case bolted typography and letter-by-letter headlines, Balla\'s lines of force and the Russolo-era idea of a serata of noises; the batch-05 "Italian futurist typography" entry. All wording original and about noise, night and dancing (BALLO ELETTRICO, SERATA DI RUMORI, onomatopoeia invented per kick and clap). Faces from web/fonts.js: Anton, Abril Fatface, Alfa Slab One, Archivo Black, Playfair Display, Bebas Neue, Rubik Mono One, Oswald and Libre Baskerville mixed in the headline and the flight, Special Elite for the compositor\'s small print, Space Mono for the hat noise.',
        'Built around one sound burst: flying words live in polar coordinates about it and grow with distance, so the explosion reads as coming towards you (the movement a very high viewer can fall into); a Swirl control curls the rays into a vortex and Scatter unlocks their angles. The drone line is a ring buffer of bass at 40 Hz, letter i reading i steps back, so the kick and bass swell travel out of the burst along a line of TRRRUUUMMM. Letterpress look: inks multiply onto generated paper, the red plate sits out of register, paper-coloured wear specks over everything.',
        'Process: the first render already read as the style, but it jolted (kickArea 0.49): the flight speed followed a fast bass envelope, so every kick surged the whole sheet, and kick stamps flew out and grew huge over the headline. Speeds were moved onto a slow bass follower, the flight slowed, and stamps now hold in the burst for a beat behind a paper knockout (red vanished into the black star) and fade a short way out, never towards the headline; in the drop every other spent stamp joins the flight as a big red word, which keeps the drop full without putting it on the kick. Words were also kept upright after a mirrored-looking SCINTILLE turned up in the breakdown. Speed: on the real GPU at Retina full screen it ran 36-46 fps; skipping sections one at a time showed the flight (and the drone) as the cost, because text whose size changes every frame is re-rasterised every frame. Those words are now cached bitmaps per half-octave size bucket, drawn scaled, which holds 60 fps with the look unchanged.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.flight) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickPtr = 0; this.clapPtr = 0; this.clapSpot = 0;
      this.low = 0; this.dense = false; this.dropPres = 0;
      this.bassEnv = 0; this.bassSlow = 0; this.padEnv = 0; this.energy = 0; this.kickEnv = 0;
      this.hist = new Float32Array(96); this.histHead = 0; this.histAcc = 0;
      this.spin = 0; this.drift = 0; this.fanSpin = 0;
      this.flight = []; this.stamps = []; this.claps = []; this.sparks = []; this.arcs = [];
      this.paperKey = ''; this.headKey = ''; this.headSeed = this.headSeed || 1;
      this.wordPtr = 0;
      const r = this.rng;
      for (let i = 0; i < 7; i++) this.arcs.push(this.newArc(r() * 700));
    },

    newArc(r0) {
      const r = this.rng;
      return { r: r0 === undefined ? 70 : r0, a0: r() * Math.PI * 2, span: 0.35 + r() * 0.9, w: 1.5 + r() * 3.5, red: r() < 0.25 };
    },

    // A word leaving the burst. `r` is distance from the burst in 600-unit
    // space; the word grows with it, which reads as coming towards you.
    newWord(params, r0) {
      const r = this.rng;
      const list = String(params.words || '').trim().split(/\s+/).filter(Boolean);
      let text = list.length ? list[Math.floor(r() * list.length)] : 'LUCE';
      const kind = r();
      if (kind < 0.16) {
        // a stretched noise: zzzzz, uuuuu, the typographic sound of speed
        const stems = ['Z', 'U', 'R', 'S', 'O', 'M', 'I'];
        const s = stems[Math.floor(r() * stems.length)];
        text = (r() < 0.5 ? 'T' : 'B') + s.repeat(3 + Math.floor(r() * 6));
      } else if (kind < 0.26) {
        text = ['+', '×', '=', '−', '+++', '÷', '%'][Math.floor(r() * 7)];
      } else if (r() < 0.35) text = text.toLowerCase();
      const big = r() < 0.06 + 0.06 * this.dropPres;
      const redChance = 0.08 + 0.42 * this.dropPres;
      const ink = r() < redChance ? 1 : 0;
      return {
        text,
        font: Math.floor(r() * FACES.length),
        theta: r() * Math.PI * 2,
        r: r0 === undefined ? 20 + r() * 30 : r0,
        spd: 0.7 + r() * 0.7,
        base: big ? 60 + r() * 40 : 14 + r() * r() * 44,
        mode: r() < 0.55 ? 0 : r() < 0.6 ? 1 : 2,
        tilt: (r() - 0.5) * Math.PI,
        spin: (r() - 0.5) * 0.5,
        ink,
        third: r() < 0.3,
      };
    },

    analyse(s, t, dt, params) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickEnv = 1;
        const list = String(params.kicks || '').trim().split(/\s+/).filter(Boolean);
        const word = list.length ? list[this.kickPtr % list.length] : 'BUMM';
        this.kickPtr++;
        const r = this.rng;
        // Stamps leave down-right, left, or down-left: never up into the headline.
        // The headline sits up-right of the burst (about -0.6 rad): any ray
        // in the other 280 degrees.
        this.stamps.push({ keep: this.kickPtr % 2 === 0, text: word, born: t, theta: 0.15 + r() * 4.9, tilt: (r() - 0.5) * 0.5, font: [0, 1, 2, 3, 6][this.kickPtr % 5], r: 0 });
        if (this.stamps.length > 5) this.stamps.shift();
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t;
        const list = String(params.claps || '').trim().split(/\s+/).filter(Boolean);
        const word = list.length ? list[this.clapPtr % list.length] : 'TRAK!';
        this.clapPtr++;
        this.clapSpot = (this.clapSpot + 1 + Math.floor(this.rng() * 2)) % 5;
        this.claps.push({ text: word, born: t, spot: this.clapSpot, tilt: (this.rng() - 0.5) * 0.7, font: [6, 3, 2][this.clapPtr % 3] });
        if (this.claps.length > 3) this.claps.shift();
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.09) {
        this.lastHat = t;
        const r = this.rng;
        const n = 2 + Math.floor(r() * 3 * clamp(bh / 60, 0.4, 1.4));
        for (let i = 0; i < n; i++) {
          this.sparks.push({ born: t, a: r() * Math.PI * 2, r: 90 + r() * 330, ch: '+×=−!·tsz?%'[Math.floor(r() * 11)], size: 9 + r() * 14, rot: (r() - 0.5) * 1.5, red: r() < 0.3 });
        }
        while (this.sparks.length > 40) this.sparks.shift();
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.04) : k(0.25));
      // Speeds follow a slow bass, so the kick never surges the whole sheet.
      this.bassSlow += (bass - this.bassSlow) * k(0.8);
      this.padEnv += ((s[2] + s[3]) / 200 - this.padEnv) * k(0.6);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
      this.kickEnv *= Math.exp(-dt / 0.13);
      // Bass history at 40 Hz for the drone line: letter i reads i steps back,
      // so a swell leaves the burst and travels down the line.
      this.histAcc += dt;
      while (this.histAcc >= 1 / 40) {
        this.histAcc -= 1 / 40;
        this.histHead = (this.histHead + 1) % this.hist.length;
        this.hist[this.histHead] = clamp(0.6 * bass + 0.4 * (s[0] / 100), 0, 1);
      }
    },

    makePaper(p, ink) {
      const w = p.width * p.pixelDensity(), h = p.height * p.pixelDensity();
      const key = w + 'x' + h + ':' + ink.name;
      if (this.paperKey === key) return;
      this.paperKey = key;
      const r = mulberry(11);
      const paper = document.createElement('canvas');
      paper.width = w; paper.height = h;
      const g = paper.getContext('2d');
      g.fillStyle = ink.paper; g.fillRect(0, 0, w, h);
      const sc = Math.min(w, h) / 600;
      // Soft mottling drawn at 1/16 scale and smoothed up (a canvas blur
      // filter is far too slow under SwiftShader).
      const lw = Math.max(8, Math.round(w / 16)), lh = Math.max(8, Math.round(h / 16));
      const lo = document.createElement('canvas');
      lo.width = lw; lo.height = lh;
      const lg = lo.getContext('2d');
      for (let i = 0; i < 300; i++) {
        const x = r() * lw, y = r() * lh, rad = (30 + r() * 110) * sc / 16;
        lg.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.035)' : 'rgba(255,250,235,0.05)';
        lg.beginPath(); lg.ellipse(x, y, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); lg.fill();
      }
      // Age: the sheet browns towards its edges.
      const vg = lg.createRadialGradient(lw / 2, lh / 2, Math.min(lw, lh) * 0.35, lw / 2, lh / 2, Math.hypot(lw, lh) * 0.6);
      vg.addColorStop(0, 'rgba(120,85,40,0)'); vg.addColorStop(1, 'rgba(120,85,40,0.16)');
      lg.fillStyle = vg; lg.fillRect(0, 0, lw, lh);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(lo, 0, 0, w, h);
      const f = ink.fleck;
      g.lineWidth = Math.max(0.6, 0.5 * sc);
      for (let i = 0; i < 900; i++) {
        const x = r() * w, y = r() * h, a = r() * Math.PI, l = (2 + r() * 7) * sc;
        g.strokeStyle = 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',' + (0.08 + r() * 0.15).toFixed(3) + ')';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',' + (0.1 + r() * 0.25).toFixed(3) + ')';
        g.fillRect(r() * w, r() * h, Math.max(1, sc * r() * 1.4), Math.max(1, sc * r() * 1.4));
      }
      // Wear: letterpress ink never quite covers; paper shows through as
      // specks, and faint horizontal starvation streaks from the rollers.
      const wear = document.createElement('canvas');
      wear.width = w; wear.height = h;
      const q = wear.getContext('2d');
      q.fillStyle = ink.paper;
      for (let i = 0; i < 6000; i++) {
        q.globalAlpha = 0.25 + r() * 0.55;
        const s = sc * (0.5 + r() * r() * 2.2);
        q.fillRect(r() * w, r() * h, s, s);
      }
      q.globalAlpha = 0.08;
      q.lineWidth = Math.max(1, sc * 0.9);
      q.strokeStyle = ink.paper;
      for (let i = 0; i < 120; i++) {
        const y = r() * h, x = r() * w, l = (40 + r() * 240) * sc;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + l, y + (r() - 0.5) * 3 * sc); q.stroke();
      }
      q.globalAlpha = 1;
      this.paper = paper; this.wear = wear;
    },

    // Headline set letter by letter: each letter drawn from a different case,
    // its own size, baseline and tilt, as the futurists set their titles.
    // Laid out once per text and stage size; widths measured at 100 px.
    layoutHead(c, params, W, H, u) {
      const txt = String(params.headline || '').trim().toUpperCase() || 'BALLO';
      const fontsKey = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has('Anton') ? 1 : 0;
      const key = txt + '|' + W.toFixed(1) + '|' + H.toFixed(1) + '|' + fontsKey + '|' + this.headSeed;
      if (this.headKey === key) return;
      this.headKey = key;
      const r = mulberry(97 + this.headSeed * 131);
      const words = txt.split(/\s+/);
      const lines = [words[0], words.slice(1).join(' ')].filter((l) => l.length);
      const specs = [
        { cx: 0.675 * W, cy: 0.2 * H, rot: -0.14, maxW: 0.5 * W, maxS: 165 * u },
        { cx: 0.73 * W, cy: 0.37 * H, rot: 0.06, maxW: 0.42 * W, maxS: 64 * u },
      ];
      const out = [];
      lines.forEach((line, li) => {
        const sp = specs[li];
        const letters = [];
        let tw = 0;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          const fi = Math.floor(r() * 6);
          const rel = ch === ' ' ? 0.5 : 0.82 + r() * 0.36;
          c.font = fontOf(fi, 100 * rel);
          const wdt = ch === ' ' ? 30 : c.measureText(ch).width;
          letters.push({ ch, fi, rel, wdt, dy: (r() - 0.5) * 0.14, rot: (r() - 0.5) * 0.22, ex: (r() - 0.5), ey: (r() - 0.5), er: (r() - 0.5), ph: r() * 6.28, redAt: r() });
          tw += wdt * 1.02;
        }
        const s = Math.min(sp.maxW / tw, sp.maxS / 100);
        let x = -tw * s / 2;
        letters.forEach((L) => { L.x = x + L.wdt * s * 0.51; x += L.wdt * 1.02 * s; L.size = 100 * L.rel * s; });
        out.push({ ...sp, letters, s });
      });
      // One letter of the big word is always red: the accent.
      if (out[0] && out[0].letters.length) out[0].letters[Math.floor(r() * out[0].letters.length)].accent = true;
      this.head = out;
    },

    // A word whose letters grow across it (tumb -> TUMB), the futurist way of
    // setting a sound that swells. Drawn centred on (0, 0).
    stretched(c, text, size, grow, fi, knock, paper) {
      const sizes = [], widths = [];
      let tw = 0;
      for (let i = 0; i < text.length; i++) {
        const sz = size * Math.pow(grow, i - (text.length - 1) / 2);
        c.font = fontOf(fi, sz);
        const w = c.measureText(text[i]).width;
        sizes.push(sz); widths.push(w); tw += w;
      }
      let x = -tw / 2;
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      if (knock) {
        // Knock the word out of whatever is under it first (the burst is
        // black, and red would vanish into it), as a compositor would mask.
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = paper; c.lineWidth = knock; c.lineJoin = 'round';
        for (let i = 0; i < text.length; i++) {
          c.font = fontOf(fi, sizes[i]);
          c.strokeText(text[i], x, size * 0.35);
          c.fillStyle = paper; c.fillText(text[i], x, size * 0.35);
          x += widths[i];
        }
        c.restore();
        x = -tw / 2;
      }
      for (let i = 0; i < text.length; i++) {
        c.font = fontOf(fi, sizes[i]);
        c.fillText(text[i], x, size * 0.35);
        x += widths[i];
      }
      return tw;
    },

    // Type as cached bitmaps. The flight words and the drone letters change
    // size every frame, and canvas text at a new size is re-rasterised from
    // the outlines each time: forty-odd words in nine faces held Retina
    // full screen to 36-46 fps (2026-09-28, harness/fps.mjs). So each word is
    // rasterised once per half-octave size bucket, in device pixels, and
    // drawn scaled; a growing word re-rasterises about six times in its life.
    // Buckets round up, so a bitmap is only ever scaled down (at most 1.41x).
    glyph(text, fi, color, devPx, base) {
      let b = Math.pow(2, Math.ceil(Math.log2(Math.max(devPx, 8)) * 2) / 2);
      b = Math.round(Math.min(b, 1024));
      const key = text + '|' + fi + '|' + color + '|' + b + '|' + base + '|' + this.fontsKey;
      const cache = this.glyphs || (this.glyphs = new Map());
      let g = cache.get(key);
      if (g) { cache.delete(key); cache.set(key, g); return g; }
      const cv = document.createElement('canvas');
      const m = cv.getContext('2d');
      m.font = fontOf(fi, b);
      const w = Math.ceil(m.measureText(text).width + b * 0.4) + 4, h = Math.ceil(b * 1.9) + 4;
      cv.width = w; cv.height = h;
      m.font = fontOf(fi, b);
      m.fillStyle = color;
      m.textAlign = 'center';
      // 'middle' words are drawn centred on their origin, 'alphabetic' ones
      // stand on it; ay is where the origin falls in the bitmap.
      const ay = base === 'alphabetic' ? Math.round(h * 0.7) : h / 2;
      m.textBaseline = base;
      m.fillText(text, w / 2, ay);
      g = { cv, w, h, b, ay };
      cache.set(key, g);
      this.glyphPx = (this.glyphPx || 0) + w * h;
      // Least recently used out first, to about 25 Mpx of bitmaps.
      while (this.glyphPx > 25e6 && cache.size > 1) {
        const [k0, g0] = cache.entries().next().value;
        cache.delete(k0); this.glyphPx -= g0.w * g0.h;
      }
      return g;
    },

    // Draws cached type at the current origin: size in virtual units.
    blit(c, text, fi, color, size, base) {
      const g = this.glyph(text, fi, color, size * this.dev, base);
      const k = size / g.b;
      c.drawImage(g.cv, -g.w / 2 * k, -g.ay * k, g.w * k, g.h * k);
    },

    draw(p, signals, params, ctx) {
      if (!this.flight) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const u = S / 600;
      const ink = INKS[clamp(Math.round(params.ink), 0, INKS.length - 1)];
      const BLACK = ink.black, RED = ink.red, THIRD = ink.third;
      const react = params.reaction, speed = params.speed;
      const k = (tau) => 1 - Math.exp(-dt / tau);

      this.analyse(signals, t, dt, params);
      if (!this.dense && this.low > 27) this.dense = true;
      else if (this.dense && this.low < 19) this.dense = false;
      this.dropPres += ((this.dense ? 1 : 0) - this.dropPres) * k(this.dense ? 0.5 : 1.3);
      const D = this.dropPres;

      // Continuous motion; the music changes its speed, never jerks it.
      const drive = 0.35 + 0.55 * this.energy + 0.45 * this.bassSlow;
      this.spin += dt * (0.08 + 0.35 * this.energy) * (0.3 + 0.7 * speed);
      this.fanSpin += dt * (0.02 + 0.04 * this.bassSlow + 0.02 * D) * (0.3 + 0.7 * speed);
      this.drift += dt;

      const cx = W * 0.33, cy = H * 0.57;
      const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) / u + 60;

      // --- flight bookkeeping
      const want = Math.round(params.density * (0.65 + 0.55 * D));
      while (this.flight.length < want) {
        // Fill at random depths at first so the page starts mid-explosion.
        this.flight.push(this.newWord(params, this.flight.length < 4 || t < 0.1 ? this.rng() * far * 0.9 : undefined));
      }
      for (let i = this.flight.length - 1; i >= 0; i--) {
        const w = this.flight[i];
        w.r += dt * speed * drive * w.spd * (11 + w.r * 0.19);
        if (w.r > far + w.base * 3) {
          if (this.flight.length > want) this.flight.splice(i, 1);
          else this.flight[i] = this.newWord(params);
        }
      }
      for (const st of this.stamps) {
        const age = t - st.born;
        // Held in the burst for about a beat, then thrown a little way out as
        // it fades: one stamp readable at a time, the kick confined to the burst.
        st.r = age > 0.3 ? (age - 0.3) * 200 : 0;
      }
      // In the drop a spent stamp is not lost: it joins the flight, big and
      // red, so the sheet fills with the noises the kick has made.
      for (const st of this.stamps) {
        if (t - st.born >= 0.55 && D > 0.4 && st.keep && this.flight.length < want + 5) {
          const w = this.newWord(params, 70);
          Object.assign(w, { text: st.text, font: st.font, theta: st.theta, base: 45 + 25 * this.rng(), spd: 1.25, ink: 1, third: false, mode: 2, tilt: st.tilt, spin: 0.1 });
          this.flight.push(w);
        }
      }
      this.stamps = this.stamps.filter((st) => t - st.born < 0.55);
      this.claps = this.claps.filter((cl) => t - cl.born < 0.7);
      this.sparks = this.sparks.filter((s) => t - s.born < 0.4);
      for (let i = 0; i < this.arcs.length; i++) {
        const a = this.arcs[i];
        a.r += dt * speed * (30 + 60 * this.energy + 40 * this.bassSlow);
        if (a.r > far) this.arcs[i] = this.newArc();
      }

      const ang = (w) => {
        return w.theta + params.swirl * (w.r / 300);
      };

      this.makePaper(p, ink);
      this.layoutHead(p.drawingContext, params, W, H, u);
      const c = p.drawingContext;
      { const m = c.getTransform(); this.dev = Math.hypot(m.a, m.b) || 1; }
      this.fontsKey = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has('Anton') && VIZ_FONTS.has('Abril Fatface') ? 1 : 0;
      c.save();
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(this.paper, 0, 0);
      c.restore();

      c.globalAlpha = 1;
      c.lineCap = 'butt'; c.lineJoin = 'miter';
      c.globalCompositeOperation = 'multiply';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const mrx = (1.2 + 0.6 * Math.sin(this.drift * 0.23)) * u;
      const mry = (-0.8 + 0.5 * Math.cos(this.drift * 0.17)) * u;
      const reach = far * u;

      // --- Lines of force: red wedges from the burst (the drop's red plate),
      // with fans of hairlines turning slowly over them.
      {
        const nW = 3 + Math.round(5 * D);
        c.save(); c.translate(mrx, mry);
        c.fillStyle = RED;
        for (let i = 0; i < nW; i++) {
          const a0 = this.fanSpin * (i % 2 ? 1 : -0.7) + i * 2.39996;
          const half = (0.035 + 0.05 * ((i * 0.618) % 1)) * (i < 3 ? 1 : easeOut(clamp(D * 1.6 - (i - 3) * 0.12, 0, 1)));
          const al = i < 3 ? 0.22 + 0.55 * D : 0.8;
          if (half <= 0.001) continue;
          c.globalAlpha = al;
          c.beginPath(); c.moveTo(cx, cy);
          c.lineTo(cx + Math.cos(a0 - half) * reach, cy + Math.sin(a0 - half) * reach);
          c.lineTo(cx + Math.cos(a0 + half) * reach, cy + Math.sin(a0 + half) * reach);
          c.closePath(); c.fill();
        }
        c.restore();
        c.globalAlpha = 1;
        // Black wedges in the drop only: thin, sharp, fast.
        if (D > 0.02) {
          c.fillStyle = BLACK;
          for (let i = 0; i < 4; i++) {
            const a0 = -this.fanSpin * 1.6 + i * 1.7 + 0.5;
            const half = 0.012 * easeOut(clamp(D * 1.3 - i * 0.1, 0, 1));
            c.beginPath(); c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(a0 - half) * reach, cy + Math.sin(a0 - half) * reach);
            c.lineTo(cx + Math.cos(a0 + half) * reach, cy + Math.sin(a0 + half) * reach);
            c.closePath(); c.fill();
          }
        }
        c.strokeStyle = BLACK;
        c.lineWidth = 0.9 * u;
        for (let b = 0; b < 3; b++) {
          const base = this.fanSpin * (b === 1 ? -1.3 : 1) + b * 2.1 + 0.8;
          c.globalAlpha = 0.55;
          c.beginPath();
          for (let j = 0; j < 11; j++) {
            const a = base + j * 0.018 * (1 + b * 0.3);
            const r0 = (70 + j * 9) * u;
            c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            c.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
          }
          c.stroke();
        }
        c.globalAlpha = 1;
      }

      // --- Arcs of sound travelling outward.
      for (const a of this.arcs) {
        const fade = clamp(a.r / 60, 0, 1) * clamp((far - a.r) / 150, 0, 1);
        if (fade <= 0) continue;
        c.globalAlpha = fade * 0.9;
        c.strokeStyle = a.red ? RED : BLACK;
        c.lineWidth = a.w * u * (0.6 + a.r / 300);
        c.beginPath(); c.arc(cx, cy, a.r * u, a.a0 + this.spin * 0.3, a.a0 + this.spin * 0.3 + a.span); c.stroke();
      }
      c.globalAlpha = 1;

      // --- The drone: a long onomatopoeia running out of the burst, each
      // letter sized from the bass a little further back in time, so a swell
      // travels outward along the line like a waveform set in type.
      {
        const N = 30;
        const x0 = cx + 70 * u, y0 = cy + 42 * u;
        const x2 = W - 26 * u, y2 = H - 58 * u;
        const x1 = lerp(x0, x2, 0.45), y1 = y2 + 20 * u;
        const drone = 'T' + 'R'.repeat(11) + 'U'.repeat(10) + 'M'.repeat(8);
        const amp = 0.4 + 0.6 * react;
        c.fillStyle = BLACK;
        for (let i = 0; i < N; i++) {
          const q = i / (N - 1);
          const e = this.hist[(this.histHead - i * 2 + this.hist.length * 4) % this.hist.length];
          const bx = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * x1 + q * q * x2;
          const by = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * y1 + q * q * y2;
          const tx = 2 * (1 - q) * (x1 - x0) + 2 * q * (x2 - x1);
          const ty = 2 * (1 - q) * (y1 - y0) + 2 * q * (y2 - y1);
          const sz = (13 + 8 * q + 62 * e * amp * (0.55 + 0.45 * Math.sin(q * 3.1))) * u;
          c.save(); c.translate(bx, by); c.rotate(Math.atan2(ty, tx));
          const dfi = i % 3 === 0 ? 2 : 0;
          // letters stand on the line, so the swell reads as height
          if (D > 0.3 && i % 7 === 3) { c.save(); c.translate(mrx, mry); this.blit(c, drone[i], dfi, RED, sz, 'alphabetic'); c.restore(); }
          else this.blit(c, drone[i], dfi, BLACK, sz, 'alphabetic');
          c.restore();
        }
        c.textBaseline = 'middle';
      }

      // --- The flight of words.
      for (const w of this.flight) {
        const a = ang(w);
        const x = cx + Math.cos(a) * w.r * u, y = cy + Math.sin(a) * w.r * u;
        const size = w.base * (0.3 + w.r / 320) * u;
        if (size < 3 * u) continue;
        const fade = clamp((w.r - 30) / 70, 0, 1);
        if (fade <= 0) continue;
        let rot;
        if (w.mode === 0) { rot = a; if (Math.cos(a) < 0) rot += Math.PI; }
        else if (w.mode === 1) rot = a + Math.PI / 2;
        else rot = w.tilt + w.spin * w.r / 100;
        rot = lerp(rot, w.tilt + w.spin * w.r / 60, params.scatter * 0.8);
        // Every angle, but never upside down: a room has to be able to read it.
        if (Math.cos(rot) < -0.2) rot += Math.PI;
        c.globalAlpha = fade;
        c.save();
        let col = BLACK;
        if (w.ink === 1) { col = THIRD && w.third ? THIRD : RED; c.translate(mrx, mry); }
        c.translate(x, y); c.rotate(rot);
        this.blit(c, w.text, w.font, col, size, 'middle');
        c.restore();
      }
      c.globalAlpha = 1;

      // --- The burst: a black star of spikes that jab out on the kick,
      // paper in its eye where the stamp is printed.
      {
        const nS = 18;
        const jab = this.kickEnv * (0.4 + 0.6 * react);
        c.fillStyle = BLACK;
        c.beginPath();
        for (let i = 0; i < nS * 2; i++) {
          const a = this.spin + (i / (nS * 2)) * Math.PI * 2;
          const long = i % 2 === 0;
          const rr = long ? (i % 4 === 0 ? 92 : 70) * (1 + 0.45 * jab * (i % 4 === 0 ? 1 : 0.5)) : 40;
          const xx = cx + Math.cos(a) * rr * u, yy = cy + Math.sin(a) * rr * u;
          if (i === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
        }
        c.closePath(); c.fill();
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = ink.paper;
        c.beginPath(); c.arc(cx, cy, 34 * u, 0, Math.PI * 2); c.fill();
        c.restore();
        c.strokeStyle = BLACK; c.lineWidth = 2 * u;
        c.beginPath(); c.arc(cx, cy, 27 * u, 0, Math.PI * 2); c.stroke();
      }

      // --- Kick stamps: printed in the burst, then flung out along a ray.
      for (const st of this.stamps) {
        const age = t - st.born;
        const slam = age < 0.09 ? 1 + 0.35 * (1 - age / 0.09) : 1;
        const x = cx + Math.cos(st.theta) * st.r * u, y = cy + Math.sin(st.theta) * st.r * u;
        const size = (48 + 30 * react) * (1 + st.r / 500) * slam * u;
        const fade = age < 0.3 ? 1 : clamp(1 - (age - 0.3) / 0.25, 0, 1);
        c.globalAlpha = fade;
        c.save();
        c.translate(x + mrx, y + mry); c.rotate(st.tilt + (st.r / 400) * (st.theta > 0 ? 1 : -1));
        c.fillStyle = RED;
        this.stretched(c, st.text, size, 1.16, st.font, 7 * u, ink.paper);
        c.restore();
      }
      c.globalAlpha = 1;
      c.textAlign = 'center'; c.textBaseline = 'middle';

      // --- Headline: letters in mixed faces; in the drop they turn red one by
      // one and burst apart, and set back in black for the breakdown.
      if (this.head) {
        const burst = D * (0.55 + 0.45 * react);
        this.head.forEach((ln, li) => {
          c.save();
          c.translate(ln.cx, ln.cy); c.rotate(ln.rot);
          for (const L of ln.letters) {
            if (L.ch === ' ') continue;
            const bob = Math.sin(this.drift * 0.7 + L.ph) * (0.02 + 0.04 * this.padEnv);
            const ex = L.ex * burst * 22 * u * (li ? 0.6 : 1), ey = L.ey * burst * 30 * u * (li ? 0.6 : 1);
            const redU = li === 0 ? clamp((D - L.redAt * 0.7) * 3.5, 0, 1) : 0;
            c.save();
            c.translate(L.x + ex, L.dy * L.size + ey);
            c.rotate(L.rot + bob + L.er * burst * 0.3);
            c.font = fontOf(L.fi, L.size);
            if (L.accent || redU > 0) {
              c.translate(mrx, mry);
              c.fillStyle = L.accent ? RED : mixHex(BLACK, RED, redU);
            } else c.fillStyle = BLACK;
            c.fillText(L.ch, 0, 0);
            c.restore();
          }
          c.restore();
        });
      }

      // --- Small print: the compositor's asides.
      {
        const SM = face('Special Elite', '"Courier New", monospace');
        c.fillStyle = BLACK;
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.save(); c.translate(22 * u, 34 * u); c.rotate(-0.04);
        c.font = (13 * u).toFixed(2) + 'px ' + SM;
        c.fillText('SERATA DI RUMORI', 0, 0);
        c.font = (10.5 * u).toFixed(2) + 'px ' + SM;
        c.fillText('ore 23 — fino all\'alba', 0, 15 * u);
        c.fillText('ingresso: un fischio', 0, 29 * u);
        c.restore();
        c.save(); c.translate(W - 20 * u, H - 22 * u); c.rotate(-Math.PI / 2);
        c.font = (10 * u).toFixed(2) + 'px ' + SM;
        c.fillText('+ luce + ritmo + velocità +', 0, 0);
        c.restore();
        // a heavy rule under the headline, the only straight thing on the sheet
        c.save(); c.translate(W * 0.7, H * 0.29); c.rotate(-0.14);
        c.fillRect(-W * 0.25, 0, W * 0.5, 5 * u);
        c.restore();
      }

      // --- Clap shouts: slammed in at the edges, with a zig-zag bolt.
      {
        const spots = [[0.13, 0.2], [0.1, 0.86], [0.9, 0.5], [0.56, 0.52], [0.45, 0.92]];
        for (const cl of this.claps) {
          const age = t - cl.born;
          const [sx, sy] = spots[cl.spot];
          const x = sx * W, y = sy * H;
          const slam = age < 0.07 ? 1.3 - 0.3 * age / 0.07 : 1;
          const fade = age < 0.45 ? 1 : 1 - (age - 0.45) / 0.25;
          c.globalAlpha = clamp(fade, 0, 1);
          c.save(); c.translate(x, y); c.rotate(cl.tilt);
          c.fillStyle = BLACK;
          const tw = this.stretched(c, cl.text, (30 + 16 * react) * slam * u, 0.9, cl.font);
          // the bolt
          c.strokeStyle = D > 0.4 ? RED : BLACK; c.lineWidth = 4 * u; c.lineJoin = 'miter';
          c.beginPath();
          const bx = -tw / 2 - 10 * u, by = -30 * u;
          c.moveTo(bx, by); c.lineTo(bx + 16 * u, by + 14 * u); c.lineTo(bx + 4 * u, by + 20 * u); c.lineTo(bx + 22 * u, by + 40 * u);
          c.stroke();
          c.restore();
        }
        c.globalAlpha = 1;
      }

      // --- Hat noise: tiny typewriter marks pricking the sheet.
      {
        const SM = face('Space Mono', '"Courier New", monospace');
        c.textAlign = 'center'; c.textBaseline = 'middle';
        for (const s of this.sparks) {
          const age = t - s.born;
          c.globalAlpha = 1 - age / 0.4;
          c.save();
          const x = cx + Math.cos(s.a) * s.r * u, y = cy + Math.sin(s.a) * s.r * u;
          c.translate(x, y); c.rotate(s.rot);
          c.fillStyle = s.red ? RED : BLACK;
          c.font = '700 ' + (s.size * u).toFixed(2) + 'px ' + SM;
          c.fillText(s.ch, 0, 0);
          c.restore();
        }
        c.globalAlpha = 1;
      }

      // --- Wear over everything.
      c.globalCompositeOperation = 'source-over';
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.wear, 0, 0);
      c.restore();
      c.restore();
    },
  });
})();
