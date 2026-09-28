// Dot Matrix V2 — Raph's 2016 DotMatrix.pde (../../viz/dotmatrix.js is V1)
// finished as the thing it was reaching for: a dot-matrix record of the music.
// Notes in harness/v2/dotmatrix.md.
//
// The sketch read a grid of cells in reading order: each frame the oldest
// cell fell off the top left and the bass became a new cell at the bottom
// right, a stack of dots with the sixth one red. The judges only ever saw V1's
// Marquee ("a sign that says VIZ"). V2 takes the reading order literally: the
// cells become letters. Every slot of time is typed as the 5×7 character whose
// column silhouette best matches the spectrum at that moment, spelled so the
// words are pronounceable, onto an endless LED page that lies in perspective
// and rolls away from you, newest line nearest. The frame is the track's
// recent history set as text in a script nobody can read.
//
// Music, each in its own place:
// - every letter: its shape is the spectrum (five band groups, five columns);
//   it is typed white-hot and cools to its ink in about a second;
// - kick: the letter is struck bold (double strike) in the accent ink, Raph's
//   red dot, and the print head flares, lighting a few LEDs around it;
// - clap: a full stop and a space, so claps end sentences and a snare roll
//   types an ellipsis before the drop;
// - hats: a diacritic dot over the letter;
// - quiet: spaces; a word never runs past seven letters;
// - drop (as params, eased by "Follow the track"): typing speeds up so the
//   page rushes away, the camera comes down from reading height to skim the
//   page with a horizon, and a three-ink chord comes in by each letter's
//   register; the performer's next word is printed as a double-height banner.
//
// Rendering: a WebGL2 fragment shader draws the LED floor (lens, hot core,
// halo from the 3×3 neighbourhood, averaged by mip level where an LED is
// smaller than a pixel so the far grid never moirés), sampling a 96×256 data
// texture: one texel per LED, a ring of page rows.
(function () {
  const CELL = 6;              // columns per letter: 5 + the inter-letter gap
  const PER_LINE = 16;         // letters per line
  const COLS = CELL * PER_LINE;
  const ROWS = 256;            // ring of page rows kept in the data texture
  const LINE_H = 10;           // 2 diacritic rows, 7 glyph rows, 1 lead
  const BANNER_H = 18;         // 2 + 14 (double-height glyph) + 2
  const GLYPH_TOP = 2;
  const MARGIN = 3;            // rows below the line being typed
  const HOT = 0.38;            // seconds for a typed letter to cool

  const PRESETS = {
    calm: { rate: 5, flight: 0.12, inks: 0, glow: 0.45 },
    drop: { rate: 9, flight: 0.85, inks: 1, glow: 0.7 },
    // Straight down onto the page, slow: the record to be read.
    reader: { rate: 3, flight: 0, inks: 0, glow: 0.35 },
  };
  const DRIVE = ['rate', 'flight', 'inks', 'glow'];

  // [ink, accent, mid chord ink, high chord ink]. The ink is also the chord's
  // low voice, so a letter only changes colour in the drop if it leans high.
  const COLOURS = [
    { name: 'Amber', c: [[255, 170, 18], [255, 40, 34], [255, 206, 120], [140, 200, 255]] },
    { name: 'Red', c: [[255, 46, 28], [255, 236, 214], [255, 140, 50], [255, 190, 200]] },
    { name: 'Green', c: [[60, 255, 110], [255, 170, 20], [200, 255, 120], [140, 220, 255]] },
    { name: 'Ice', c: [[90, 170, 255], [255, 80, 120], [196, 160, 255], [224, 244, 255]] },
    { name: 'White', c: [[232, 234, 242], [255, 50, 36], [255, 190, 90], [150, 205, 255]] },
  ];
  const HOT_WHITE = [255, 250, 236];

  // 5×7 font, as V1: rows top to bottom, columns left to right.
  const FONT_SRC = {
    A: '01110 10001 10001 11111 10001 10001 10001',
    B: '11110 10001 10001 11110 10001 10001 11110',
    C: '01110 10001 10000 10000 10000 10001 01110',
    D: '11110 10001 10001 10001 10001 10001 11110',
    E: '11111 10000 10000 11110 10000 10000 11111',
    F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111',
    H: '10001 10001 10001 11111 10001 10001 10001',
    I: '01110 00100 00100 00100 00100 00100 01110',
    J: '00111 00010 00010 00010 00010 10010 01100',
    K: '10001 10010 10100 11000 10100 10010 10001',
    L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001',
    N: '10001 10001 11001 10101 10011 10001 10001',
    O: '01110 10001 10001 10001 10001 10001 01110',
    P: '11110 10001 10001 11110 10000 10000 10000',
    Q: '01110 10001 10001 10001 10101 10010 01101',
    R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110',
    T: '11111 00100 00100 00100 00100 00100 00100',
    U: '10001 10001 10001 10001 10001 10001 01110',
    V: '10001 10001 10001 10001 10001 01010 00100',
    W: '10001 10001 10001 10101 10101 10101 01010',
    X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 10001 01010 00100 00100 00100',
    Z: '11111 00001 00010 00100 01000 10000 11111',
    0: '01110 10001 10011 10101 11001 10001 01110',
    1: '00100 01100 00100 00100 00100 00100 01110',
    2: '01110 10001 00001 00010 00100 01000 11111',
    3: '11111 00010 00100 00010 00001 10001 01110',
    4: '00010 00110 01010 10010 11111 00010 00010',
    5: '11111 10000 11110 00001 00001 10001 01110',
    6: '00110 01000 10000 11110 10001 10001 01110',
    7: '11111 00001 00010 00100 01000 01000 01000',
    8: '01110 10001 10001 01110 10001 10001 01110',
    9: '01110 10001 10001 01111 00001 00010 01100',
    '.': '00000 00000 00000 00000 00000 01100 01100',
    ',': '00000 00000 00000 00000 01100 00100 01000',
    '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100',
    '-': '00000 00000 00000 11111 00000 00000 00000',
    ':': '00000 01100 01100 00000 01100 01100 00000',
    "'": '01100 00100 01000 00000 00000 00000 00000',
    '&': '01100 10010 10100 01000 10101 10010 01101',
    '+': '00000 00100 00100 11111 00100 00100 00000',
    '*': '00000 00100 10101 01110 10101 00100 00000',
    '♥': '00000 01010 11111 11111 01110 00100 00000',
  };
  // Column bitmasks, bit y = row y from the top.
  const FONT = {};
  for (const ch of Object.keys(FONT_SRC)) {
    const rows = FONT_SRC[ch].split(' ');
    const cols = [];
    for (let x = 0; x < 5; x++) {
      let m = 0;
      for (let y = 0; y < 7; y++) if (rows[y][x] === '1') m |= 1 << y;
      cols.push(m);
    }
    FONT[ch] = cols;
  }
  const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
  // Each letter's silhouette: how many LEDs each of its five columns lights.
  // The spectrum is matched against these, bass on the left, treble on the
  // right, so a kick-heavy moment types a letter with a full left stem.
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch) => ({
    ch, vowel: 'AEIOU'.includes(ch), prof: FONT[ch].map(bits),
  }));

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uData;
uniform vec2 uRes;        // device px
uniform float uYH;        // horizon, px from the top (negative: above the frame)
uniform float uFH;        // Z0 * (H - yH): screen y to depth
uniform float uF;         // px per LED at depth 1, across
uniform float uZ0;        // depth of the bottom edge, in LEDs
uniform float uNear;      // page row at the bottom edge (mod ROWS)
uniform float uLive;      // rows behind the bottom edge that still hold history
uniform float uPan;       // page column at the centre of the frame
uniform float uRad;       // LED radius, in LED pitches
uniform vec3 uDim;        // an unlit lens
uniform vec3 uHaze;       // far-field and horizon
uniform vec3 uSky;
uniform float uGlow;
uniform float uFog;       // rows
uniform vec4 uHead;       // column, rows behind the edge, radius, strength
uniform vec3 uHeadCol;
out vec4 o;
const float COLS = ${COLS}.0;
const float ROWS = ${ROWS}.0;

vec4 cellAt(float cu, float cr) {
  if (cu < 0.0 || cu >= COLS) return vec4(0.0);
  return texelFetch(uData, ivec2(int(cu), int(mod(cr, ROWS))), 0);
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float dy = fc.y - uYH;
  float up = clamp(-dy / (uRes.y * 0.45), 0.0, 1.0);
  vec3 sky = mix(uHaze, uSky, sqrt(up));
  if (dy <= 0.5) { o = vec4(sky, 1.0); return; }

  float Z = uFH / dy;
  float back = Z - uZ0;                    // rows behind the bottom edge
  float pr = uNear - back;                 // page row (increasing toward us)
  float u = (fc.x - uRes.x * 0.5) * Z / uF + uPan;

  float fx = Z / uF;                       // LEDs per pixel, across
  float fy = Z * Z / uFH;                  // LEDs per pixel, in depth
  float fp = max(fx, fy);
  float live = step(back, uLive);

  float cu = floor(u), cr = floor(pr);
  vec2 loc = vec2(u - cu - 0.5, pr - cr - 0.5);
  float d = length(loc);
  float aa = 0.6 * fp + 0.015;
  float dotM = smoothstep(uRad + aa, uRad - aa, d);
  float core = smoothstep(uRad * 0.5 + aa, uRad * 0.5 - aa, d);

  vec3 nearC = vec3(0.0);
  if (fp < 1.2) {
    vec4 c = cellAt(cu, cr) * live;
    vec3 lens = uDim * (1.0 - c.a) + c.rgb;
    nearC = lens * dotM + mix(c.rgb, vec3(1.0, 0.98, 0.94), 0.35) * core * c.a * 0.45;
    // Halo: each lit neighbour spills a soft disc over the dark board.
    vec3 halo = vec3(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec4 n = cellAt(cu + float(i), cr + float(j)) * live;
        vec2 q = loc - vec2(float(i), float(j));
        halo += n.rgb * exp(-dot(q, q) * 3.2);
      }
    }
    nearC += halo * uGlow * 0.32;
  }
  // Far: the mean of the LEDs this pixel covers.
  float inside = smoothstep(-1.0, 0.0, u) * smoothstep(COLS + 1.0, COLS, u);
  vec4 avg = textureLod(uData, vec2(u / COLS, pr / ROWS), log2(max(fp, 1.0))) * inside * live;
  float cover = 3.14159 * uRad * uRad;
  vec3 farC = (uDim * (1.0 - avg.a) + avg.rgb) * cover + avg.rgb * uGlow * 0.3;
  vec3 col = mix(nearC, farC, smoothstep(0.35, 1.2, fp));

  // The print head's lamp, on the lenses around it.
  vec2 dh = vec2(u - uHead.x, (back - uHead.y) * 1.2);
  float lamp = uHead.w * exp(-dot(dh, dh) / (uHead.z * uHead.z));
  col += uHeadCol * lamp * (mix(dotM, cover, smoothstep(0.35, 1.2, fp)) * 0.9 + 0.05);

  float fog = exp(-back / uFog);
  col = mix(uHaze, col, fog);
  o = vec4(col, 1.0);
}`;

  VIZ.register({
    id: 'dotmatrixv2',
    name: 'Dot Matrix',
    versionOf: 'dotmatrix',
    version: 'V2',
    order: 727,

    params: [
      { key: 'colour', label: 'LED colour', type: 'select',
        options: COLOURS.map((c) => c.name), default: 0 },
      { key: 'rate', legacy: 'SPEED', label: 'Typing speed (letters per second)', type: 'range',
        min: 1, max: 14, default: PRESETS.calm.rate, step: 0.1 },
      { key: 'flight', label: 'Flight (reading view to low skim)', type: 'range',
        min: 0, max: 1, default: PRESETS.calm.flight, step: 0.01 },
      { key: 'inks', label: 'Drop inks', type: 'range', min: 0, max: 1, default: PRESETS.calm.inks, step: 0.01 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, default: PRESETS.calm.glow, step: 0.01 },
      { key: 'kick', label: 'Kick strike', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'displayText', legacy: 'DISPLAYTEXT', label: 'Words printed at each drop (split with /)',
        type: 'text', default: 'LOUDER/AGAIN/HIGHER/ONE MORE TIME' },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'words', label: 'Print the next words', run(params) { this.queueBanner(params); } },
      // The original's space bar emptied the matrix.
      { id: 'clear', label: 'Clear the page', run() { this.clearPage(); } },
    ],

    gallery: {
      title: 'Dot Matrix',
      technique: 'WebGL2 fragment shader over a 96×256 RGBA data texture (one texel per LED, a ring of page rows): a perspective LED floor with round lenses, hot cores and a 3×3 halo, mip-averaged where an LED is smaller than a pixel; letters chosen by L1 match of five band groups against 5×7 glyph column silhouettes with a pronounceable-spelling rule; onset detection against slow baselines; a hysteretic section follower easing between calm and drop presets',
      brief: 'A dot-matrix machine transcribing the track as it plays. Every eighth of a second or so it types a letter whose shape is the spectrum at that moment (bass on the left stem, treble on the right), spelled into pronounceable nonsense words, onto an endless amber LED page lying in perspective; the newest line is typed nearest you and older lines roll away into the dark, so the frame is the music\'s recent history set as text. Letters are typed white-hot and cool to their ink. Kicks are struck bold in red, Raph\'s red dot; claps end sentences with a full stop, so the build\'s snare roll types an ellipsis; hats put a diacritic over the letter; quiet leaves spaces. In the drop the typing speeds up, the camera comes down from reading height to skim low over the page toward a horizon, a second and third ink come in by each letter\'s register, and the performer\'s next word is printed as a double-height red banner that then rolls away with the rest. The breakdown lifts back up and slows, and the drop\'s heavy lines recede into the distance.',
      lineage: 'V2 of Dot Matrix (web/viz/dotmatrix.js), itself grown from Raph\'s unfinished 2016 DotMatrix.pde: its reading-order grid of cells, each a stack of dots from the bass with a red sixth dot, becomes a page of letters typed in reading order, with red bold letters for the kicks. Acts on the panel: "a sign, nothing to say" (Curator, Psychonaut) and "only ever says three letters" (Floor) by making it a record that never repeats; "the drop only adds ghosting, no arc" (Director) and the Floor\'s ticker-at-rest, flight-on-the-drop transplant by making the drop a camera move and a speed change over the same page; the Floor\'s "fold Text in as a line the DJ types" and the Designer\'s section headlines as a banner word per drop. Letterforms from V1\'s 5×7 LED font; the perspective page from the crawl titles of film.',
    },

    setup() {
      this.lastT = null;
      this.base = new Uint8Array(COLS * ROWS * 4);
      this.buf = new Uint8Array(COLS * ROWS * 4);
      this.env = { kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0, hf: 0, hs: 0, hWait: 0,
        low: 0, dropOn: false, auto: 0, flare: 0, centroid: 2 };
      this.wordIdx = 0;
      this.clearPage();
    },

    enter() {
      this.lastT = null;
      // A fresh page left the first drop flying toward empty sky for the
      // minutes it took to type enough history. So a blank page arrives
      // already written: quiet-language lines from the same matcher and
      // spelling rule, cooled to the ink. Clear the page stays honestly blank.
      // (Done on the next draw, where the LED colour is known.)
      if (this.B === 0 && this.col === 0) this.needPrefill = true;
    },

    prefill(lines, ink) {
      const R = Math.random;
      for (let n = 0; n < lines; n++) {
        this.col = 0;
        let word = 0, maxWord = 3 + Math.floor(R() * 5);
        while (this.col <= COLS - CELL) {
          if (word >= maxWord || (word > 0 && R() < 0.08)) {
            // Now and then a sentence ends, as a clap would end it.
            if (R() < 0.3) { this.stamp(FONT['.'], this.col, this.B + GLYPH_TOP, 1, ink, false); this.col += CELL; }
            this.col += CELL;
            word = 0;
            maxWord = 3 + Math.floor(R() * 5);
            this.run.vowel = this.run.cons = 0;
            if (this.col > COLS - CELL * 3) break;
            continue;
          }
          const target = [R() * 1.5, R() * 2, 2 + R() * 4, 1.5 + R() * 4, R() * 2.5];
          const L = this.pickLetter(target);
          this.stamp(FONT[L.ch], this.col, this.B + GLYPH_TOP, 1, ink, false);
          if (R() < 0.12) this.paint([this.col + 2, this.B], ink, 1);
          this.col += CELL;
          word++;
        }
        this.newLine(LINE_H);
      }
      this.hot = [];
      this.near = this.B + this.lineH + MARGIN;
    },

    clearPage() {
      if (!this.base) return;
      this.base.fill(0);
      this.B = 0;                 // absolute page row where the current line starts
      this.lineH = LINE_H;
      this.col = 0;               // next column on the current line
      this.near = LINE_H + MARGIN;
      this.acc = 0;
      this.slot = new Float32Array(5);
      this.hot = [];
      this.word = 0;
      this.maxWord = 5;
      this.run = { vowel: 0, cons: 0 };
      this.recent = [];
      this.kickPend = 0;
      this.hatPend = false;
      this.clapPend = false;
      this.stopNext = false;
      this.banner = null;         // { text, i } while printing a banner line
      this.bannerQueue = [];
      this.pan = COLS / 2;
    },

    queueBanner(params) {
      const words = String(params.displayText == null ? '' : params.displayText)
        .toUpperCase().split('/').map((w) => w.trim()).filter(Boolean);
      if (!words.length || !this.bannerQueue) return;
      const word = words[this.wordIdx++ % words.length];
      // Wrap on spaces into lines of at most PER_LINE / 2 double-width letters.
      const lines = [];
      let cur = '';
      for (const w of word.split(/\s+/)) {
        const next = cur ? cur + ' ' + w : w;
        if (next.length <= PER_LINE / 2) cur = next;
        else { if (cur) lines.push(cur); cur = w.slice(0, PER_LINE / 2); }
      }
      if (cur) lines.push(cur);
      this.bannerQueue = lines;
    },

    // Start a new line of height h: the rows it and the margin under it will
    // occupy still hold the page from ROWS rows ago, so they are wiped.
    newLine(h) {
      this.B += this.lineH;
      this.lineH = h;
      this.col = 0;
      this.word = 0;
      for (let r = 0; r < h + MARGIN + 2; r++) {
        const row = (this.B + r) % ROWS;
        this.base.fill(0, row * COLS * 4, (row + 1) * COLS * 4);
      }
    },

    // Stamp a glyph into the page and remember it as hot.
    stamp(cols, col0, row0, scale, ink, bold) {
      const cells = [];
      const w = cols.length;
      for (let x = 0; x < w; x++) {
        let m = cols[x];
        // Double strike: the head fires again one column over.
        if (bold && x > 0) m |= cols[x - 1];
        for (let y = 0; y < 7; y++) {
          if (!(m & (1 << y))) continue;
          for (let dx = 0; dx < scale; dx++) {
            for (let dy = 0; dy < scale; dy++) cells.push(col0 + x * scale + dx, row0 + y * scale + dy);
          }
        }
      }
      if (bold && w === 5 && cols[4]) {
        for (let y = 0; y < 7; y++) {
          if (!(cols[4] & (1 << y))) continue;
          for (let dx = 0; dx < scale; dx++) {
            for (let dy = 0; dy < scale; dy++) cells.push(col0 + 5 * scale + dx, row0 + y * scale + dy);
          }
        }
      }
      this.paint(cells, ink, 1);
      this.hot.push({ cells, ink, t: 0 });
    },

    paint(cells, rgb, a, target) {
      const d = target || this.base;
      for (let k = 0; k < cells.length; k += 2) {
        const c = cells[k];
        if (c < 0 || c >= COLS) continue;
        const o = (((cells[k + 1] % ROWS) + ROWS) % ROWS * COLS + c) * 4;
        d[o] = rgb[0] * a; d[o + 1] = rgb[1] * a; d[o + 2] = rgb[2] * a; d[o + 3] = 255 * a;
      }
    },

    pickLetter(target) {
      const r = this.run;
      // Pronounceable: never three consonants or three vowels running.
      const need = r.cons >= 2 ? 'v' : r.vowel >= 2 ? 'c' : '';
      let best = Infinity;
      const scored = [];
      for (const L of LETTERS) {
        if (need === 'v' && !L.vowel) continue;
        if (need === 'c' && L.vowel) continue;
        let dist = 0;
        for (let k = 0; k < 5; k++) dist += Math.abs(L.prof[k] - target[k]);
        // Recently typed letters cost more, so a steady sound still spells.
        const seen = this.recent.lastIndexOf(L.ch);
        if (seen >= 0) dist += 1 + seen * 0.5;
        scored.push([dist, L]);
        if (dist < best) best = dist;
      }
      // A little chance among near ties, so a steady note is not one letter.
      const near = scored.filter((s) => s[0] <= best + 2);
      const L = near[Math.floor(Math.random() * near.length)][1];
      if (L.vowel) { r.vowel++; r.cons = 0; } else { r.cons++; r.vowel = 0; }
      this.recent.push(L.ch);
      if (this.recent.length > 4) this.recent.shift();
      return L;
    },

    typeSlot(P, pal) {
      const s = this.slot;
      const e = this.env;

      if (this.banner) {
        const { text } = this.banner;
        const ch = text[this.banner.i++];
        const g = ch === ' ' ? null : FONT[ch];
        if (g) this.stamp(g, this.col, this.B + GLYPH_TOP, 2, pal[1], false);
        this.col += CELL * 2;
        if (this.banner.i >= text.length) {
          this.banner = null;
          this.newLine(this.bannerQueue.length ? BANNER_H : LINE_H);
        }
        s.fill(0);
        return;
      }
      if (this.bannerQueue.length) {
        if (this.col > 0 || this.lineH !== BANNER_H) this.newLine(BANNER_H);
        this.banner = { text: this.bannerQueue.shift(), i: 0 };
        s.fill(0);
        return;
      }

      const target = new Array(5);
      let sum = 0;
      for (let k = 0; k < 5; k++) {
        target[k] = 7 * Math.pow(clamp(s[k] / 80, 0, 1), 0.8);
        sum += target[k];
      }
      s.fill(0);

      let space = false;
      let glyph = null, bold = false, ink = pal[0];
      if (this.clapPend) {
        this.clapPend = false;
        glyph = FONT['.'];
        ink = mix(pal[0], HOT_WHITE, 0.4);
        this.stopNext = true;
      } else if (this.stopNext || sum < 1.4 || this.word >= this.maxWord) {
        space = true;
        this.stopNext = false;
      } else {
        const L = this.pickLetter(target);
        glyph = FONT[L.ch];
        // Register: the letter's spectral centroid against the recent mean.
        let cw = 0;
        for (let k = 0; k < 5; k++) cw += k * target[k];
        const cen = cw / Math.max(sum, 1e-3);
        const dc = cen - e.centroid;
        e.centroid += (cen - e.centroid) * 0.08;
        const voice = dc > 0.2 ? pal[3] : dc > 0.05 ? pal[2] : pal[0];
        ink = mix(pal[0], voice, P.inks);
        if (this.kickPend > 0) { bold = true; ink = pal[1]; this.kickPend = 0; }
      }

      if (space) {
        if (this.word > 0 || this.col > 0) this.col += CELL;
        this.word = 0;
        this.maxWord = 3 + Math.floor(Math.random() * 5);
        this.run.vowel = this.run.cons = 0;
        // Nothing starts a word on the last few cells of a line.
        if (this.col > COLS - CELL * 3) this.newLine(LINE_H);
        return;
      }

      this.stamp(glyph, this.col, this.B + GLYPH_TOP, 1, ink, bold);
      if (this.hatPend && glyph !== FONT['.']) {
        const cells = [this.col + 2, this.B];
        this.paint(cells, mix(ink, HOT_WHITE, 0.6), 1);
        this.hot.push({ cells, ink: mix(ink, HOT_WHITE, 0.6), t: 0 });
      }
      this.hatPend = false;
      this.word++;
      this.col += CELL;
      if (this.col > COLS - CELL) this.newLine(LINE_H);
    },

    listen(signals, dt) {
      const e = this.env;
      const kick = signals[0] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      e.ks = ease(e.ks, kick, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      let kickNow = false;
      if (e.kf - e.ks > 0.12 && e.kWait === 0) { kickNow = true; e.kWait = 0.2; }
      // Clap: fast minus slow on the clap bands, so the breakdown's sustained
      // pad in the same bands never fires it. The refractory gap is short so
      // a snare roll becomes an ellipsis rather than one stop.
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      let clapNow = false;
      if (e.cf - e.cs > 0.07 && e.cWait === 0) { clapNow = true; e.cWait = 0.14; }
      const hat = (signals[7] + signals[8]) / 200;
      e.hf = ease(e.hf, hat, 40, dt);
      e.hs = ease(e.hs, hat, 4, dt);
      e.hWait = Math.max(0, e.hWait - dt);
      let hatNow = false;
      if (e.hf - e.hs > 0.06 && e.hWait === 0) { hatNow = true; e.hWait = 0.1; }
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      let dropStart = false;
      if (!e.dropOn && e.low > 27) { e.dropOn = true; dropStart = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kickNow, clapNow, hatNow, dropStart };
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const u = {};
      for (const name of ['uData', 'uRes', 'uYH', 'uFH', 'uF', 'uZ0', 'uNear', 'uLive', 'uPan', 'uRad',
        'uDim', 'uHaze', 'uSky', 'uGlow', 'uFog', 'uHead', 'uHeadCol']) {
        u[name] = gl.getUniformLocation(prog, name);
      }
      gl.uniform1i(u.uData, 0);
      this.gl = gl;
      this.glCanvas = c;
      this.tex = tex;
      this.u = u;
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const e = this.env;

      const ev = this.listen(signals, dt);
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.5, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      if (ev.dropStart && follow) this.queueBanner(params);

      const pal = COLOURS[clamp(Math.round(params.colour) || 0, 0, COLOURS.length - 1)].c;
      if (this.needPrefill) {
        this.needPrefill = false;
        this.prefill(Math.floor((ROWS - 40) / LINE_H), pal[0]);
      }

      // The loudest moment of each band group since the last letter, so a
      // kick between two slots still shapes the letter.
      const g = [signals[0], signals[1], Math.max(signals[2], signals[3]),
        Math.max(signals[4], signals[5]), Math.max(signals[6], signals[7], signals[8])];
      for (let k = 0; k < 5; k++) this.slot[k] = Math.max(this.slot[k], g[k]);
      if (ev.kickNow) { this.kickPend = 0.35; e.flare = 1; }
      else this.kickPend = Math.max(0, this.kickPend - dt);
      if (ev.clapNow) this.clapPend = true;
      if (ev.hatNow) this.hatPend = true;
      e.flare *= Math.exp(-dt / 0.16);

      this.acc += dt * P.rate * (this.banner ? 0.7 : 1);
      let guard = 0;
      while (this.acc >= 1 && guard++ < 8) { this.acc -= 1; this.typeSlot(P, pal); }

      // Carriage return: the page glides back one line.
      const nearTarget = this.B + this.lineH + MARGIN;
      this.near = ease(this.near, nearTarget, 3.2, dt);
      // The camera leans after the print head, more when it flies low and
      // close, so the drop's carriage returns become a sweep across the page.
      const fl = clamp(P.flight, 0, 1);
      const panTarget = COLS / 2 + (this.col + 2.5 - COLS / 2) * (0.12 + 0.3 * fl) + 2.2 * Math.sin(t * 0.11);
      this.pan = ease(this.pan, panTarget, 1.1, dt);

      // Compose the upload: the page, hot letters, the cursor.
      const buf = this.buf;
      buf.set(this.base);
      const keep = [];
      for (const h of this.hot) {
        h.t += dt;
        const heat = Math.exp(-h.t / HOT);
        if (heat > 0.02) {
          this.paint(h.cells, mix(h.ink, HOT_WHITE, heat), 1, buf);
          keep.push(h);
        }
      }
      this.hot = keep;
      const cw = this.banner ? 2 : 1;
      const cursor = [];
      for (let x = 0; x < 5 * cw; x++) {
        for (let y = 0; y < 7 * cw; y++) cursor.push(this.col + x, this.B + GLYPH_TOP + y);
      }
      const strike = e.flare * params.kick;
      const cursA = clamp(0.16 + 0.5 * strike, 0, 1);
      // Only where the cursor sits on empty page.
      for (let k = 0; k < cursor.length; k += 2) {
        const c = cursor[k];
        if (c >= COLS) continue;
        const o = ((cursor[k + 1] % ROWS) * COLS + c) * 4;
        if (buf[o + 3] > 0) continue;
        const col = mix(pal[0], HOT_WHITE, clamp(strike, 0, 1) * 0.6);
        buf[o] = col[0] * cursA; buf[o + 1] = col[1] * cursA; buf[o + 2] = col[2] * cursA; buf[o + 3] = 255 * cursA;
      }

      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke();
        p.fill(236);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text('Dot Matrix V2 needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLS, ROWS, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      gl.generateMipmap(gl.TEXTURE_2D);

      // Camera. The near edge always shows about VIEW columns across, so the
      // LEDs at the bottom of the frame stay one size; Flight moves the
      // horizon down into the frame and foreshortens the near rows, from a
      // page seen nearly square-on to a low skim over it.
      const f = clamp(P.flight, 0, 1);
      const fs = f * f * (3 - 2 * f);
      const view = (100 - 26 * fs) * clamp(w / h / 1.78, 0.62, 1.2);
      const cellPx = w / view;
      const yH = h * (-0.95 + 1.05 * fs);
      const k = 0.9 - 0.36 * fs;
      const Z0 = (h - yH) / (k * cellPx);
      // Rows behind the bottom edge that still hold this pass of the ring.
      const oldest = Math.max(0, this.B + this.lineH + MARGIN + 3 - ROWS);
      const live = this.near - oldest;

      const ink = pal[0].map((v) => v / 255);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uYH, yH);
      gl.uniform1f(u.uFH, Z0 * (h - yH));
      gl.uniform1f(u.uF, cellPx * Z0);
      gl.uniform1f(u.uZ0, Z0);
      gl.uniform1f(u.uNear, this.near % ROWS);
      gl.uniform1f(u.uLive, live);
      gl.uniform1f(u.uPan, this.pan);
      gl.uniform1f(u.uRad, 0.4);
      gl.uniform3f(u.uDim, 0.055 + ink[0] * 0.03, 0.055 + ink[1] * 0.03, 0.058 + ink[2] * 0.03);
      gl.uniform3f(u.uHaze, 0.012 + ink[0] * 0.03 * (0.4 + fs), 0.012 + ink[1] * 0.03 * (0.4 + fs), 0.016 + ink[2] * 0.03 * (0.4 + fs));
      gl.uniform3f(u.uSky, 0.004, 0.004, 0.008);
      gl.uniform1f(u.uGlow, P.glow);
      gl.uniform1f(u.uFog, 110 + 40 * fs);
      const headBack = this.near - (this.B + GLYPH_TOP + 3.5 * cw);
      gl.uniform4f(u.uHead, this.col + 2.5 * cw, headBack, 5 + 2 * strike, 0.05 + 0.3 * strike);
      gl.uniform3f(u.uHeadCol, ...mix(pal[0], HOT_WHITE, 0.5).map((v) => v / 255));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
