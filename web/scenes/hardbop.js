// Hard Bop Sleeve — batch 06, "Blue Note sleeve" (harness/briefs/batch-06-ideas.md).
//
// A 1950s–60s jazz record sleeve in the Reid Miles manner, invented from
// scratch: a tinted photograph bleeding off one side, a stack of huge condensed
// words cropped at the edges, three flat inks on cream. Type is the rhythm. The
// photograph is drawn, not loaded: a low, raking close-up of piano keys under
// one spotlight, tinted in a single ink (black → ink → paper), with film grain.
//
// Music, each in its own place:
//   kick   one key goes down in the photograph, and one row of the stack hops
//          forward a notch along its slide
//   bar    every fourth kick the stack re-sets like a drummer's fill: rows roll
//          over to a new word and ink one after another, a sixteenth apart
//   snare  one letter in the stack is knocked out of a block of the accent ink
//          (and the photo's pianist hits a three-key chord)
//   bass   the rows slide faster and the photograph pans along the keyboard
//   hats   a sixteen-step grid in the imprint ticks along
//   drop   the sleeve is reversed out of black by a wipe that crosses the
//          sheet; the inks swap (photo re-tinted in the type colour), more rows,
//          a narrower photo, a vertical type band; the breakdown exhales to two
//          big rows and a large photograph
// Plain Canvas 2D: flat fills, no glow, no gradients outside the photograph.

(function () {
  const INKS = [
    { name: 'Blue photo, tangerine type', tint: '#2F66AE', acc: '#EC7424' },
    { name: 'Green photo, lemon type', tint: '#2F8458', acc: '#E9C519' },
    { name: 'Orange photo, blue type', tint: '#E0691E', acc: '#2A55A3' },
    { name: 'Teal photo, red type', tint: '#1E7F86', acc: '#D23A2A' },
    { name: 'Plum photo, pink type', tint: '#6E3C82', acc: '#E0679A' },
  ];
  const PAPER = '#ECE5D2';
  const BLACK = '#141312';

  const PRESETS = {
    calm: { rows: 4, travel: 0.35, photo: 0.5, reverse: 0, band: 0, fill: 0.5 },
    drop: { rows: 7, travel: 1.1, photo: 0.36, reverse: 1, band: 1, fill: 1 },
    // Reversed but unhurried: a late-night sleeve for the quiet hour.
    midnight: { rows: 3, travel: 0.25, photo: 0.56, reverse: 1, band: 0, fill: 0.35 },
    // The printed sleeve, barely moving: something to leave up.
    sleeve: { rows: 5, travel: 0.05, photo: 0.46, reverse: 0, band: 0.6, fill: 0.15 },
  };
  // The breakdown's exhale, eased toward while following.
  const BREATH = { rows: 2, travel: 0.2, photo: 0.6, reverse: 0, band: 0, fill: 0.3 };
  const DRIVE = ['rows', 'travel', 'photo', 'reverse', 'band', 'fill'];
  const MAXR = 8;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  function hash(a, b, salt) {
    let h = (a * 374761393 + b * 668265263 + salt * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
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
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, u) {
    return 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';
  }

  // Row styles. Weight and ink contrast between rows is the Reid Miles move:
  // one fat black word over a thin one over one in colour.
  //   0 heavy ink · 1 heavy accent · 2 light ink · 3 heavy outline · 4 accent block, knocked out
  const STYLES = 5;

  VIZ.register({
    id: 'hardbop',
    name: 'Hard Bop Sleeve',
    order: 815,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'rows', label: 'Rows of type', type: 'range', min: 2, max: MAXR, default: PRESETS.calm.rows, step: 0.01 },
      { key: 'travel', label: 'Slide', type: 'range', min: 0, max: 2, default: PRESETS.calm.travel, step: 0.01 },
      { key: 'photo', label: 'Photo share', type: 'range', min: 0.25, max: 0.65, default: PRESETS.calm.photo, step: 0.01 },
      { key: 'reverse', label: 'Reversed out of black', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'band', label: 'Vertical type band', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'fill', label: 'Drum fill (rows re-set per bar)', type: 'range', min: 0, max: 1, default: PRESETS.calm.fill, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'words', label: 'Words', type: 'text', default: 'SWING BLOW DIG LATE' },
      { key: 'title', label: 'Sleeve title', type: 'text', default: 'the late set' },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Hard Bop Sleeve',
      technique: 'Canvas 2D: a stack of marquee rows of condensed type (Anton, Oswald from web/fonts.js), each clipped to its row and sliding at its own speed and direction, rolling over to a new word and style one row per sixteenth on the bar; a procedurally drawn "photograph" of piano keys in true 3D perspective (painter\'s order, spotlight falloff, a black→ink→paper duotone lookup and a tiled film-grain pattern); the drop\'s reversal is the whole sleeve drawn twice in two ink schemes and split by a travelling wipe; onset detection against the previous frame and a section follower easing params toward the drop and breakdown looks',
      brief: 'An invented hard bop record sleeve that keeps re-setting itself. Cream stock, black and two flat inks. On the left a tinted photograph, a low raking close-up of piano keys under one spotlight, pans slowly along the keyboard; on the right a stack of huge condensed words (SWING, BLOW, DIG, LATE) cropped at both edges, each row sliding at its own speed, fat over thin, black over colour, the way the type on those sleeves was the rhythm. Each kick sends one key down in the photograph and hops one row forward a notch; every bar the stack re-sets like a drummer\'s fill, row after row rolling over to a new word and ink a sixteenth apart; a snare knocks one letter out of a block of colour; the hats tick a sixteen-step grid in the imprint; the bass speeds the slide and the pan. The drop reverses the whole sleeve out of black with a wipe that crosses it, swaps the inks so the photograph turns to the type colour, packs in more rows, narrows the photo and runs a vertical band of type up its edge. The breakdown exhales to two big rows and a large photograph.',
      lineage: [
        'Batch 06 idea 15, "Blue Note sleeve" (the Designer). The idea has no real alternatives (the Polish, Japanese modernist and Secession posters it mentions are separate gaps in the series, not versions of this one), so this builds the sleeve itself, and fuses in the Designer\'s other praise for the Posters series: a headline stack that changes on the beat, a small imprint whose grid lights with the hats, and a layout that re-sets instead of shaking.',
        'Reid Miles\'s sleeve typography of the late 1950s and 1960s in general (condensed grotesques at enormous size, words repeated and cropped at the edge, weight contrast, a monochrome photograph printed in one ink, three flat colours, reversing out of black); no real label, logo, artist, title or cover is used or copied. The label, catalogue number, title and wording are invented.',
        'Posters series (batch 05): the marquee band of Poster and TDR, the per-section headline of WPA and Cubist.',
        'Presets: calm, drop, midnight (reversed, unhurried), sleeve (printed, nearly still).',
      ].join(' '),
    },

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        low: 0, dropOn: false, auto: 0, breath: 0, hadDrop: false,
        bass: 0, pad: 0, lastKick: -10, lastSnare: -10, lastHat: -10,
      };
      this.kicks = 0;
      this.kickTimes = [];
      this.hatStep = 0;
      this.hatT = -10;
      this.camX = 3;
      this.spot = 0;
      this.presses = new Map();
      this.flips = [];
      this.rows = [];
      for (let i = 0; i < MAXR; i++) this.rows.push(this.newRow(i));
      this.weights = this.newWeights();
      this.wFrom = this.weights.slice();
      this.wT0 = -10;
      this.heights = new Float32Array(MAXR);
      this.fillQ = [];
      this.bandOff = 0;
      this.grain = null;
      this.wm = new Map();
    },

    newRow(i) {
      const r = this.rng;
      return {
        style: [0, 1, 2, 4, 0, 3, 1, 2][i],
        word: Math.floor(r() * 16),
        dir: i % 2 ? -1 : 1,
        speed: 0.6 + 0.8 * r(),
        off: r() * 1000,
        pend: 0,
        roll: null,
      };
    },

    // Row heights: one or two big rows and some thin ones, never evenly spaced.
    newWeights() {
      const w = [];
      for (let i = 0; i < MAXR; i++) w.push(0.35 + Math.pow(this.rng(), 2) * 1.6);
      w[Math.floor(this.rng() * 3)] += 1.1;
      return w;
    },

    words(params) {
      const list = String(params.words || '').trim().split(/\s+/).filter(Boolean);
      return list.length ? list : ['SWING'];
    },

    beat() {
      const kt = this.kickTimes;
      if (kt.length < 4) return 60 / 124;
      const iv = [];
      for (let i = 1; i < kt.length; i++) iv.push(kt[i] - kt[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[iv.length >> 1];
      return med > 0.25 && med < 1.2 ? med : 60 / 124;
    },

    listen(s, t, dt, react, P, nRows) {
      const e = this.env;
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - e.lastKick > 0.22) {
        e.lastKick = t;
        this.onKick(t, P, nRows);
      }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - e.lastSnare > 0.28) {
        e.lastSnare = t;
        this.onSnare(t, nRows);
      }
      if (s[8] - this.prev[8] > 12 && t - e.lastHat > 0.07) {
        e.lastHat = t;
        this.hatStep = (this.hatStep + 1) % 16;
        this.hatT = t;
      }
      this.prev.set(s);
      const bass = Math.max(s[0], s[1]) / 100;
      // A slow attack keeps the slide from lurching on every kick.
      e.bass = ease(e.bass, bass, bass > e.bass ? 5 : 2, dt);
      e.pad = ease(e.pad, (s[2] + s[3]) / 200, 1.2, dt);
      // Section follower on the sidechained bass line (band 1), with hysteresis.
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; e.hadDrop = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    onKick(t, P, nRows) {
      this.kicks++;
      this.kickTimes.push(t);
      if (this.kickTimes.length > 9) this.kickTimes.shift();
      // The photograph: one key goes down, somewhere in the lit middle distance.
      const k = Math.floor(this.camX + 5 + this.rng() * 4);
      this.presses.set(k, t);
      const bar = this.kicks % 4 === 1;
      if (bar && P.fill > 0.02) {
        // The fill: rows roll over a sixteenth apart, top to bottom.
        const n = Math.max(1, Math.round(P.fill * nRows));
        const six = this.beat() / 4;
        const start = Math.floor(this.rng() * nRows);
        for (let j = 0; j < n; j++) this.fillQ.push({ i: (start + j) % nRows, at: t + j * six });
        // Every other bar the proportions of the stack re-divide too, slowly.
        if (this.kicks % 8 === 1) {
          this.wFrom = this.curWeights(t);
          this.weights = this.newWeights();
          this.wT0 = t;
        }
      } else {
        // The rest of the bar: one row hops a notch along its slide.
        const i = (this.kicks * 3) % nRows;
        const r = this.rows[i];
        r.pend += r.dir * 0.22;
      }
    },

    onSnare(t, nRows) {
      const i = Math.floor(this.rng() * nRows);
      this.flips.push({ i, slot: this.rng(), j: this.rng(), t0: t, word: this.rows[i].word, style: this.rows[i].style });
      if (this.flips.length > 6) this.flips.shift();
      // A three-key chord in the photograph.
      const k = Math.floor(this.camX + 8 + this.rng() * 3);
      this.presses.set(k, t); this.presses.set(k + 2, t); this.presses.set(k + 4, t);
    },

    curWeights(t) {
      const u = easeInOut(clamp((t - this.wT0) / 0.9, 0, 1));
      return this.weights.map((w, i) => lerp(this.wFrom[i], w, u));
    },

    rollRow(i, t) {
      const r = this.rows[i];
      const old = { style: r.style, word: r.word };
      // Never the same style as before or as either neighbour: the contrast
      // between adjacent rows is what makes the stack read as rhythm.
      const ban = [r.style, i > 0 ? this.rows[i - 1].style : -1, i < MAXR - 1 ? this.rows[i + 1].style : -1];
      let st = Math.floor(this.rng() * STYLES);
      for (let n = 0; n < STYLES && ban.includes(st); n++) st = (st + 1) % STYLES;
      r.style = st;
      r.word = r.word + 1 + Math.floor(this.rng() * 3);
      r.roll = { t0: t, dur: 0.2, old, up: this.rng() < 0.5 };
      // A roll starts a clean slate for that row's knocked-out letters.
      this.flips = this.flips.filter((f) => f.i !== i);
    },

    // Width of a string in a font, cached: fillText is cheap, measureText is not.
    measure(c2, font, str) {
      const key = font + '|' + str;
      let w = this.wm.get(key);
      if (w === undefined) {
        c2.font = font;
        w = c2.measureText(str).width;
        if (this.wm.size > 4000) this.wm.clear();
        this.wm.set(key, w);
      }
      return w;
    },
    capRatio(c2, fam) {
      const key = 'cap|' + fam;
      let v = this.wm.get(key);
      if (v === undefined) {
        c2.font = '100px ' + fam;
        const m = c2.measureText('H');
        v = (m.actualBoundingBoxAscent || 72) / 100;
        this.wm.set(key, v);
      }
      return v;
    },

    makeGrain() {
      const n = 128;
      const cv = document.createElement('canvas');
      cv.width = n; cv.height = n;
      const g = cv.getContext('2d');
      const img = g.createImageData(n, n);
      for (let i = 0; i < n * n; i++) {
        const v = this.rng();
        const dark = v < 0.5;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = dark ? 0 : 255;
        img.data[i * 4 + 3] = Math.floor(Math.pow(Math.abs(v - 0.5) * 2, 3) * 150);
      }
      g.putImageData(img, 0, 0);
      this.grain = cv;
    },

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      const W = ctx.width, H = ctx.height;
      const S = Math.min(W, H);
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const e = this.env;
      const react = params.reaction;
      const follow = Math.round(params.follow) === 1;

      const P = {};
      for (const k of DRIVE) {
        let v = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
        v += (BREATH[k] - v) * (follow ? e.breath : 0);
        P[k] = v;
      }
      const nF = clamp(P.rows, 2, MAXR);
      const nRows = Math.ceil(nF - 1e-3);
      this.listen(signals, t, dt, react, P, nRows);
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.3 : 0.45, dt);
      const quiet = t - e.lastKick > 1.2;
      e.breath = ease(e.breath, follow && e.hadDrop && !e.dropOn && quiet ? 1 : 0, 0.5, dt);

      for (let q = this.fillQ.length - 1; q >= 0; q--) {
        const f = this.fillQ[q];
        if (t >= f.at) { if (f.i < nRows) this.rollRow(f.i, t); this.fillQ.splice(q, 1); }
      }

      const inks = INKS[clamp(Math.round(params.inks), 0, INKS.length - 1)];
      const words = this.words(params);
      if (!this.grain) this.makeGrain();

      // ---- motion shared by both ink schemes ----------------------------------
      const slide = P.travel * (0.35 + 1.1 * e.bass * react);
      this.camX += dt * (0.25 + 0.9 * P.travel * (0.4 + e.bass * react));
      this.spot += dt * (0.08 + 0.2 * e.pad);
      this.bandOff += dt * S * 0.05 * (0.3 + slide);
      for (let i = 0; i < MAXR; i++) {
        const r = this.rows[i];
        // Thin rows run fast and the big ones slow, like parallax: letting the
        // huge words race churned half the sleeve every frame of the drop.
        const size = clamp(0.1 / Math.max(this.heights[i], 0.02), 0.3, 1.7);
        r.off += r.dir * r.speed * size * slide * dt * 0.35;
        const mv = r.pend * (1 - Math.exp(-16 * dt));
        r.off += mv; r.pend -= mv;
      }
      for (const [k, t0] of this.presses) if (t - t0 > 1.5) this.presses.delete(k);
      this.flips = this.flips.filter((f) => t - f.t0 < 2.6);

      // Row heights: eased toward the current weights, the last row growing in
      // with the fractional row count so the morph fader never pops a row.
      const wts = this.curWeights(t);
      let sumW = 0;
      const tgt = new Float32Array(MAXR);
      for (let i = 0; i < MAXR; i++) {
        const on = clamp(nF - i, 0, 1);
        tgt[i] = wts[i] * on;
        sumW += tgt[i];
      }
      for (let i = 0; i < MAXR; i++) this.heights[i] = ease(this.heights[i], tgt[i] / sumW, 5, dt);

      // ---- layout -------------------------------------------------------------
      const land = W / H >= 1.2;
      const L = {};
      if (land) {
        L.ph = { x: 0, y: 0, w: W * P.photo, h: H };
        L.ty = { x: W * P.photo, y: 0, w: W * (1 - P.photo), h: H };
      } else {
        const ph = H * P.photo * 0.8;
        L.ph = { x: 0, y: 0, w: W, h: ph };
        L.ty = { x: 0, y: ph, w: W, h: H - ph };
      }
      L.m = S * 0.045;

      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.setLineDash([]);
      c2.lineJoin = 'miter';
      c2.textBaseline = 'alphabetic';
      c2.textAlign = 'left';

      const normal = { ground: PAPER, ink: BLACK, acc: inks.acc, tint: inks.tint };
      const rev = { ground: BLACK, ink: PAPER, acc: inks.tint, tint: inks.acc };
      const rv = clamp(P.reverse, 0, 1);
      // The reversal crosses the sheet as a wipe, eased so it lands softly.
      const edge = easeInOut(rv) * (W + S * 0.2) - S * 0.1;
      if (edge <= 0) this.drawSleeve(c2, W, H, S, t, normal, L, P, words, params, react, nRows);
      else if (edge >= W) this.drawSleeve(c2, W, H, S, t, rev, L, P, words, params, react, nRows);
      else {
        c2.save();
        c2.beginPath(); c2.rect(edge, -2, W - edge + 4, H + 4); c2.clip();
        this.drawSleeve(c2, W, H, S, t, normal, L, P, words, params, react, nRows);
        c2.restore();
        c2.save();
        c2.beginPath(); c2.rect(-2, -2, edge + 2, H + 4); c2.clip();
        this.drawSleeve(c2, W, H, S, t, rev, L, P, words, params, react, nRows);
        c2.restore();
        c2.fillStyle = inks.acc;
        c2.fillRect(edge - S * 0.004, 0, S * 0.008, H);
      }
      c2.restore();
    },

    drawSleeve(c2, W, H, S, t, sc, L, P, words, params, react, nRows) {
      c2.fillStyle = sc.ground;
      c2.fillRect(-2, -2, W + 4, H + 4);
      this.drawPhoto(c2, S, t, sc, L.ph, react);
      this.drawStack(c2, S, t, sc, L, words, nRows);
      this.drawBand(c2, S, sc, L, P, words);
      this.drawImprint(c2, S, t, sc, L, params);
    },

    // ---- the photograph: piano keys, one spotlight, one ink ---------------------
    drawPhoto(c2, S, t, sc, R, react) {
      const K = hex(BLACK), A = hex(sc.tint), Pp = hex(PAPER);
      const tone = (v) => (v < 0.55 ? mix(K, A, clamp(v / 0.55, 0, 1)) : mix(A, Pp, clamp((v - 0.55) / 0.45, 0, 1)));
      c2.save();
      c2.beginPath(); c2.rect(R.x, R.y, R.w, R.h); c2.clip();
      c2.fillStyle = tone(0.04);
      c2.fillRect(R.x, R.y, R.w, R.h);

      const cam = { x: this.camX, y: 2.9, z: -2.4 };
      const psi = 0.92, th = 0.42;
      const sp = Math.sin(psi), cp = Math.cos(psi), st = Math.sin(th), ct = Math.cos(th);
      const F = Math.max(R.w, R.h) * 0.8;
      const ox = R.x + R.w * 0.3, oy = R.y + R.h * 0.5;
      const proj = (x, y, z, out) => {
        const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
        const zv = dx * sp * ct - dy * st + dz * cp * ct;
        const xv = dx * cp - dz * sp;
        const yv = dx * sp * st + dy * ct + dz * cp * st;
        out[0] = ox + (F * xv) / zv; out[1] = oy - (F * yv) / zv; out[2] = zv;
        return zv > 0.25;
      };
      const q = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const quad = (pts, fill) => {
        for (let i = 0; i < 4; i++) if (!proj(pts[i][0], pts[i][1], pts[i][2], q[i])) return;
        c2.fillStyle = fill;
        c2.beginPath();
        c2.moveTo(q[0][0], q[0][1]);
        c2.lineTo(q[1][0], q[1][1]); c2.lineTo(q[2][0], q[2][1]); c2.lineTo(q[3][0], q[3][1]);
        c2.closePath();
        c2.fill();
      };
      // One spotlight wandering along the keyboard; the pad brightens it.
      const spotX = this.camX + 7 + 3.5 * Math.sin(this.spot);
      const lit = (x) => 0.18 + (0.82 + 0.15 * this.env.pad) * Math.exp(-Math.pow((x - spotX) / 5.5, 2));
      const KL = 6, KH = 0.9, GAP = 0.07;
      const x0 = Math.floor(this.camX) - 1, x1 = Math.floor(this.camX) + 34;

      // The fallboard behind the keys, with a lit edge along its lip.
      for (let i = x1; i >= x0; i -= 2) {
        const l = lit(i + 1);
        quad([[i, 0.5, KL + 0.2], [i + 2, 0.5, KL + 0.2], [i + 2, 3.6, KL + 0.5], [i, 3.6, KL + 0.5]], tone(0.05 + 0.1 * l));
        quad([[i, 0.44, KL], [i + 2, 0.44, KL], [i + 2, 0.56, KL + 0.2], [i, 0.56, KL + 0.2]], tone(0.2 + 0.5 * l));
      }
      const pressOf = (i) => {
        const t0 = this.presses.get(i);
        if (t0 === undefined) return 0;
        const a = t - t0;
        const dn = 0.05;
        return a < dn ? a / dn : Math.max(0, 1 - (a - dn - 0.12) / 0.35);
      };
      for (let i = x1; i >= x0; i--) {
        const pr = clamp(pressOf(i), 0, 1) * clamp(0.6 + 0.4 * react, 0, 1.4);
        const l = lit(i + 0.5);
        const a = i + GAP / 2, b = i + 1 - GAP / 2;
        const dy = -0.42 * pr;
        // Top face: a pressed key tips away from the light and darkens.
        quad([[a, dy, 0], [b, dy, 0], [b, 0, KL], [a, 0, KL]], tone((0.9 - 0.45 * pr) * l + 0.03));
        quad([[a, -KH + dy, 0], [b, -KH + dy, 0], [b, dy, 0], [a, dy, 0]], tone(0.42 * l));
        // The black key to its right, raised over the back of both whites.
        const n = ((i % 7) + 7) % 7;
        if (n === 0 || n === 1 || n === 3 || n === 4 || n === 5) {
          const c = i + 1, hw = 0.29, z0 = 2.3, top = 0.5;
          quad([[c - hw, 0, z0], [c - hw, top, z0], [c - hw, top, KL], [c - hw, 0, KL]], tone(0.02));
          quad([[c - hw, 0, z0], [c + hw, 0, z0], [c + hw, top, z0], [c - hw, top, z0]], tone(0.05 + 0.12 * l));
          quad([[c - hw, top, z0], [c + hw, top, z0], [c + hw, top, KL], [c - hw, top, KL]], tone(0.06 + 0.2 * l));
          // A sliver of reflected light along the black key's front edge.
          quad([[c - hw, top - 0.02, z0], [c + hw, top - 0.02, z0], [c + hw, top, z0 + 0.25], [c - hw, top, z0 + 0.25]], tone(0.2 + 0.6 * l));
        }
      }
      // Film grain and a vignette so it reads as a photograph, not a diagram.
      c2.globalAlpha = 0.32;
      const pat = c2.createPattern(this.grain, 'repeat');
      c2.fillStyle = pat;
      c2.fillRect(R.x, R.y, R.w, R.h);
      c2.globalAlpha = 1;
      const vg = c2.createRadialGradient(ox + R.w * 0.1, oy + R.h * 0.2, S * 0.15, ox + R.w * 0.1, oy + R.h * 0.2, Math.max(R.w, R.h) * 0.85);
      vg.addColorStop(0, 'rgba(20,19,18,0)');
      vg.addColorStop(1, 'rgba(20,19,18,0.55)');
      c2.fillStyle = vg;
      c2.fillRect(R.x, R.y, R.w, R.h);
      c2.restore();
    },

    // ---- the word stack ---------------------------------------------------------
    rowFont(c2, style, h) {
      const heavy = face('Anton', 'Impact, "Arial Narrow Bold", sans-serif');
      const light = face('Oswald', '"Arial Narrow", Arial, sans-serif');
      const fam = style === 2 ? light : heavy;
      const cap = this.capRatio(c2, fam);
      const size = h / cap;
      return { font: '400 ' + size.toFixed(1) + 'px ' + fam, size };
    },

    drawRowText(c2, S, sc, x, y, w, h, off, style, word) {
      const f = this.rowFont(c2, style, h);
      const gapW = f.size * (style === 2 ? 0.28 : 0.2);
      const ww = this.measure(c2, f.font, word);
      const adv = ww + gapW;
      c2.font = f.font;
      const k0 = Math.floor(-off / adv) - 1;
      if (style === 4) {
        c2.fillStyle = sc.acc;
        c2.fillRect(x, y, w, h);
      }
      if (style === 3) {
        c2.strokeStyle = sc.ink;
        c2.lineWidth = Math.max(1, h * 0.028);
      } else {
        c2.fillStyle = style === 1 ? sc.acc : style === 4 ? sc.ground : sc.ink;
      }
      for (let k = k0; ; k++) {
        const px = x + off + k * adv;
        if (px > x + w) break;
        if (px + ww < x) continue;
        if (style === 3) c2.strokeText(word, px, y + h);
        else c2.fillText(word, px, y + h);
      }
      return { f, adv, ww };
    },

    drawStack(c2, S, t, sc, L, words, nRows) {
      const T = L.ty;
      const head = S * 0.085, foot = S * 0.13;
      const sx = T.x, sy = T.y + head, sw = T.w, sh = T.h - head - foot;
      const gap = S * 0.012;
      let y = sy;
      for (let i = 0; i < MAXR; i++) {
        const hh = this.heights[i] * sh;
        if (hh < 1) { continue; }
        const r = this.rows[i];
        const h = Math.max(1, hh - gap);
        c2.save();
        c2.beginPath(); c2.rect(sx, y, sw, h + 0.5); c2.clip();
        const wordOf = (n) => words[((n % words.length) + words.length) % words.length];
        const off = r.off * S;
        if (r.roll && t - r.roll.t0 < r.roll.dur) {
          // The roll: old word slides out of its row as the new one slides in,
          // like one drum in a fill.
          const u = easeInOut(clamp((t - r.roll.t0) / r.roll.dur, 0, 1));
          const d = (r.roll.up ? -1 : 1) * (h + gap);
          this.drawRowText(c2, S, sc, sx, y + d * u, sw, h, off, r.roll.old.style, wordOf(r.roll.old.word));
          this.drawRowText(c2, S, sc, sx, y + d * (u - 1), sw, h, off, r.style, wordOf(r.word));
        } else {
          r.roll = null;
          const m = this.drawRowText(c2, S, sc, sx, y, sw, h, off, r.style, wordOf(r.word));
          // Snare: one letter knocked out of a block of the accent ink.
          for (const fl of this.flips) {
            if (fl.i !== i || fl.style !== r.style || fl.word !== r.word) continue;
            const age = t - fl.t0;
            const a = age < 0.05 ? age / 0.05 : clamp(1 - (age - 1.2) / 1.2, 0, 1);
            if (a <= 0) continue;
            const word = wordOf(r.word);
            const j = Math.floor(fl.j * word.length);
            // Pin the letter to one repeat of the word, so it slides with the row.
            if (fl.k === undefined) fl.k = Math.floor((sw * (0.2 + 0.6 * fl.slot) - off) / m.adv);
            const px = sx + off + fl.k * m.adv + this.measure(c2, m.f.font, word.slice(0, j));
            const lw = this.measure(c2, m.f.font, word[j]);
            const blk = r.style === 1 || r.style === 4 ? sc.ink : sc.acc;
            c2.globalAlpha = a;
            c2.fillStyle = blk;
            c2.fillRect(px - h * 0.03, y, lw + h * 0.06, h);
            c2.fillStyle = sc.ground;
            c2.font = m.f.font;
            c2.fillText(word[j], px, y + h);
            c2.globalAlpha = 1;
          }
        }
        c2.restore();
        y += hh;
      }
    },

    // ---- the drop's vertical band of type up the photograph's inner edge --------
    drawBand(c2, S, sc, L, P, words) {
      const b = clamp(P.band, 0, 1);
      if (b < 0.01) return;
      const R = L.ph;
      const land = L.ty.x > 0;
      const bw = S * 0.085 * easeOut(b);
      c2.save();
      c2.fillStyle = sc.ink;
      if (land) {
        c2.fillRect(R.x + R.w - bw, 0, bw, R.h);
        c2.beginPath(); c2.rect(R.x + R.w - bw, 0, bw, R.h); c2.clip();
        c2.translate(R.x + R.w - bw * 0.14, R.h);
        c2.rotate(-Math.PI / 2);
      } else {
        c2.fillRect(0, R.y + R.h - bw, R.w, bw);
        c2.beginPath(); c2.rect(0, R.y + R.h - bw, R.w, bw); c2.clip();
        c2.translate(0, R.y + R.h - bw * 0.14);
      }
      const fam = face('Anton', 'Impact, sans-serif');
      const hh = S * 0.085 * 0.72;
      const f = '400 ' + (hh / this.capRatio(c2, fam)).toFixed(1) + 'px ' + fam;
      const str = words.join(' · ') + ' · ';
      const ww = this.measure(c2, f, str);
      c2.font = f;
      c2.fillStyle = sc.ground;
      const len = land ? R.h : R.w;
      for (let x = -(this.bandOff % ww); x < len; x += ww) c2.fillText(str, x, 0);
      c2.restore();
    },

    // ---- imprint: label, catalogue, title, the hat grid -------------------------
    drawImprint(c2, S, t, sc, L, params) {
      const T = L.ty;
      const m = L.m * 0.6;
      const head = S * 0.085, foot = S * 0.13;
      const cond = face('Oswald', '"Arial Narrow", Arial, sans-serif');
      const x0 = T.x + m, x1 = T.x + T.w - m;
      // Header: an invented label and catalogue line over a rule.
      c2.fillStyle = sc.ink;
      const hy = T.y + head * 0.62;
      c2.font = '700 ' + (S * 0.028).toFixed(1) + 'px ' + cond;
      c2.textAlign = 'left';
      // The label's mark: a disc with a notch, nothing borrowed.
      c2.beginPath(); c2.arc(x0 + S * 0.012, hy - S * 0.01, S * 0.012, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = sc.ground;
      c2.fillRect(x0 + S * 0.012, hy - S * 0.022, S * 0.013, S * 0.009);
      c2.fillStyle = sc.ink;
      c2.fillText('NIGHTSIDE', x0 + S * 0.032, hy);
      c2.textAlign = 'right';
      c2.font = '400 ' + (S * 0.022).toFixed(1) + 'px ' + cond;
      c2.fillText('NS 4124  ·  LONG PLAYING  ·  33⅓', x1, hy);
      c2.fillRect(T.x + m, T.y + head * 0.8, T.w - 2 * m, Math.max(1, S * 0.003));

      // Footer: the title large and light, personnel, and sixteen hat steps.
      const fy = T.y + T.h - foot;
      c2.fillRect(T.x + m, fy + foot * 0.12, T.w - 2 * m, Math.max(1, S * 0.003));
      const title = String(params.title || '').trim();
      c2.textAlign = 'left';
      c2.font = '400 ' + (S * 0.058).toFixed(1) + 'px ' + cond;
      if (title) c2.fillText(title, x0, fy + foot * 0.62);
      c2.font = '400 ' + (S * 0.019).toFixed(1) + 'px ' + cond;
      c2.fillText('tenor saxophone  ·  trumpet  ·  piano  ·  bass  ·  drums', x0, fy + foot * 0.88);
      const cell = S * 0.016, gp = S * 0.006;
      const gx = x1 - 16 * (cell + gp) + gp, gy = fy + foot * 0.62 - cell;
      c2.lineWidth = Math.max(1, S * 0.0022);
      c2.strokeStyle = sc.ink;
      const lastHat = t - this.env.lastHat;
      for (let i = 0; i < 16; i++) {
        const x = gx + i * (cell + gp);
        const on = i === this.hatStep && lastHat < 0.4;
        if (on) { c2.fillStyle = sc.acc; c2.fillRect(x, gy, cell, cell); }
        else if (i % 4 === 0) { c2.fillStyle = sc.ink; c2.fillRect(x + cell * 0.3, gy + cell * 0.3, cell * 0.4, cell * 0.4); }
        c2.strokeRect(x, gy, cell, cell);
      }
      c2.textAlign = 'left';
    },
  });
})();
