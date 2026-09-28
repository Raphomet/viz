// Dot Matrix — grown from the unfinished ../DotMatrix.pde.
//
// The sketch was a 30×6 grid of cells read in reading order: every frame the
// oldest cell fell off the top-left, and the bass level became a new cell at
// the bottom-right, drawn as a stack of 1–6 small dots with the sixth one red.
// It was never registered in the menu, and it left a TODO to slow the scroll.
// Here that idea becomes a physical LED sign: a board of round LEDs where the
// unlit ones stay faintly visible, with the original ticker as one of three
// programmes it can run.
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const LEVELS = 8;          // brightness buckets; each is filled as one path
  const MAX_SLOTS = 6;       // colours per frame (a palette plus white)
  const HISTORY = 16384;     // ticker samples kept, independent of board size

  const COLOURS = [
    { name: 'Amber', rgb: [255, 150, 0] },
    { name: 'Red', rgb: [255, 40, 24] },
    { name: 'Green', rgb: [40, 255, 70] },
    { name: 'Blue', rgb: [60, 150, 255] },
    { name: 'White', rgb: [240, 242, 255] },
  ];
  const RED = [255, 40, 24];
  const AMBER = [255, 176, 0];
  const WHITE = [255, 255, 255];

  // 5×7 LED font, one string of 7 rows × 5 columns per glyph. Letters and
  // digits keep their full 5 columns so words sit on an even rhythm, as on a
  // real sign; punctuation is trimmed to its inked columns.
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
    ';': '00000 01100 01100 00000 01100 00100 01000',
    "'": '01100 00100 01000 00000 00000 00000 00000',
    '"': '01010 01010 01010 00000 00000 00000 00000',
    '/': '00000 00001 00010 00100 01000 10000 00000',
    '+': '00000 00100 00100 11111 00100 00100 00000',
    '=': '00000 00000 11111 00000 11111 00000 00000',
    '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000',
    '<': '00010 00100 01000 10000 01000 00100 00010',
    '>': '01000 00100 00010 00001 00010 00100 01000',
    '&': '01100 10010 10100 01000 10101 10010 01101',
    '#': '01010 01010 11111 01010 11111 01010 01010',
    '*': '00000 00100 10101 01110 10101 00100 00000',
    '%': '11000 11001 00010 00100 01000 10011 00011',
    '_': '00000 00000 00000 00000 00000 00000 11111',
    '@': '01110 10001 00001 01101 10101 10101 01110',
    '$': '00100 01111 10100 01110 00101 11110 00100',
    '♥': '00000 01010 11111 11111 01110 00100 00000',
  };

  // Each glyph becomes an array of column bitmasks (bit 0 = top row).
  const FONT = {};
  for (const ch of Object.keys(FONT_SRC)) {
    const rows = FONT_SRC[ch].split(' ');
    let colsArr = [];
    for (let x = 0; x < 5; x++) {
      let m = 0;
      for (let y = 0; y < 7; y++) if (rows[y][x] === '1') m |= 1 << y;
      colsArr.push(m);
    }
    if (!/[A-Z0-9]/.test(ch)) {
      while (colsArr.length > 1 && colsArr[0] === 0) colsArr.shift();
      while (colsArr.length > 1 && colsArr[colsArr.length - 1] === 0) colsArr.pop();
    }
    FONT[ch] = colsArr;
  }
  const SPACE = [0, 0, 0];

  const mix = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  ];
  const css = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  const hexRgb = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  VIZ.register({
    id: 'dotmatrix',
    name: 'Dot Matrix',
    order: 9,

    params: [
      { key: 'mode', legacy: 'MODE', label: 'Programme', type: 'select',
        options: ['Ticker', 'Equaliser', 'Marquee'], default: 2 },
      { key: 'colour', label: 'LED colour', type: 'select',
        options: ['Amber', 'Red', 'Green', 'Blue', 'White', 'Palette'], default: 0 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette (Palette colour only)',
        type: 'palette', palettes: window.VIZ_PALETTES || [], default: 0 },
      { key: 'pitch', legacy: 'SIZE0', label: 'LED pitch', type: 'range',
        min: 8, max: 40, default: 11, step: 0.5 },
      { key: 'ledSize', legacy: 'SIZE1', label: 'LED size', type: 'range',
        min: 0.2, max: 0.5, default: 0.38, step: 0.01 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, default: 0.5 },
      // The original advanced one cell per frame and wanted to go slower.
      { key: 'speed', legacy: 'SPEED', label: 'Scroll speed (LEDs per second)', type: 'range',
        min: 1, max: 120, default: 24, step: 1 },
      { key: 'band', label: 'Ticker height and marquee bounce follow', type: 'band', default: 0 },
      { key: 'stack', label: 'Ticker stack height', type: 'range',
        min: 3, max: 32, default: 6, step: 1 },
      { key: 'displayText', legacy: 'DISPLAYTEXT', label: 'Marquee words', type: 'text',
        default: 'VIZ' },
    ],

    actions: [
      // The original's space bar emptied the matrix.
      { id: 'clear', label: 'Clear board', run() { this.clearHistory(); } },
    ],

    setup() {
      this.clearHistory();
      this.lastMs = null;
      this.cols = 0;
      this.rows = 0;
      this.scroll = 0;
      this.tickAcc = 0;
      this.tickMax = 0;
      this.bars = new Float32Array(9);
      this.peaks = new Float32Array(9);
      this.peakHold = new Float32Array(9);
      this.peakVel = new Float32Array(9);
      this.flash = 0;
      this.armed = true;
      this.textKey = null;
    },

    clearHistory() {
      this.history = new Uint8Array(HISTORY);   // stack heights; 0 = empty cell
      this.histHead = 0;                         // index of the next write
    },

    enter() {
      this.lastMs = null;
    },

    resize(cols, rows) {
      if (cols === this.cols && rows === this.rows) return;
      this.cols = cols;
      this.rows = rows;
      const n = cols * rows;
      this.level = new Float32Array(n);
      this.slot = new Uint8Array(n);
      this.disp = new Float32Array(n);
      this.dispSlot = new Uint8Array(n);
    },

    // Column bitmasks and the character each column belongs to, rebuilt only
    // when the words change.
    textColumns(text) {
      if (text === this.textKey) return this.textCols;
      const masks = [];
      const owner = [];
      const str = text.replace(/[\r\n]+/g, '   ').toUpperCase();
      let ci = 0;
      for (const ch of str) {
        const g = ch === ' ' ? SPACE : FONT[ch] || SPACE; // unknown → blank
        for (const m of g) { masks.push(m); owner.push(ci); }
        masks.push(0); owner.push(ci);                    // inter-letter gap
        if (ch !== ' ') ci++;
      }
      this.textKey = text;
      this.textCols = { masks, owner };
      return this.textCols;
    },

    draw(p, signals, params, ctx) {
      const now = p.millis();
      const dt = this.lastMs == null ? 1 / 60 : Math.min(0.1, Math.max(0, (now - this.lastMs) / 1000));
      this.lastMs = now;

      p.colorMode(p.RGB, 255);
      p.background(0);

      const W = ctx.width, H = ctx.height;
      const pitch = params.pitch;
      const margin = 34;
      const cols = Math.max(9, Math.floor((W - 2 * margin) / pitch));
      const rows = Math.max(7, Math.floor((H - 2 * margin) / pitch));
      this.resize(cols, rows);
      const x0 = (W - (cols - 1) * pitch) / 2;
      const y0 = (H - (rows - 1) * pitch) / 2;

      // Colour slots for this frame.
      const colourIdx = Math.round(params.colour) || 0;
      const usePalette = colourIdx === 5;
      let slots, dim;
      if (usePalette) {
        const pal = (window.VIZ_PALETTES || [])[Math.round(params.colorPalette) || 0];
        // The palette's swatches, then white for peaks and full stacks.
        slots = (pal && pal.colors.length ? pal.colors.map(hexRgb) : [AMBER]).slice(0, 5);
        slots.push(WHITE);
        dim = [30, 28, 26];
      } else {
        const main = COLOURS[colourIdx].rgb;
        // Slot 0 lit colour, 1 warning, 2 caution (only Green gets a middle zone).
        const warn = colourIdx === 1 ? WHITE : RED;
        const caution = colourIdx === 2 ? AMBER : main;
        slots = [main, warn, caution, WHITE];
        // An unlit LED is a tinted lens over a dark die: a little of its own
        // colour over a neutral grey, so the board reads as hardware.
        dim = mix([22, 22, 22], main, 0.1);
      }
      const nSlots = Math.min(MAX_SLOTS, slots.length);
      // Palette mode: swatches are slots 0..nPal-1, white is the last.
      const nPal = usePalette ? nSlots - 1 : 1;

      const level = this.level, slot = this.slot;
      level.fill(0);
      slot.fill(0);

      const mode = Math.round(params.mode) || 0;
      const band = (Math.round(params.band) || 0) % 9;
      if (mode === 0) this.ticker(signals, params, dt, band, usePalette, nPal);
      else if (mode === 1) this.equaliser(signals, dt, usePalette, nPal);
      else this.marquee(p, signals, params, dt, band, usePalette, nPal);

      // A few milliseconds of afterglow, like a multiplexed sign filmed at
      // speed: scroll steps smear by one frame instead of popping.
      const decay = Math.exp(-dt / 0.012);
      const disp = this.disp, dispSlot = this.dispSlot;
      for (let i = 0; i < disp.length; i++) {
        const faded = disp[i] * decay;
        if (level[i] >= faded) { disp[i] = level[i]; dispSlot[i] = slot[i]; }
        else disp[i] = faded;
      }

      this.render(p.drawingContext, params, x0, y0, pitch, slots, nSlots, dim);
    },

    // Raph's original: reading-order cells, each a stack of LEDs.
    ticker(signals, params, dt, band, usePalette, nPal) {
      const cols = this.cols, rows = this.rows;
      const stack = Math.max(1, Math.min(rows, Math.round(params.stack)));
      const sig = signals[band];
      this.tickMax = Math.max(this.tickMax, sig);
      this.tickAcc += dt * params.speed;
      // The loudest moment since the last step, so slow scrolling still
      // catches every kick.
      while (this.tickAcc >= 1) {
        this.tickAcc -= 1;
        const n = Math.round(1 + (stack - 1) * Math.min(100, this.tickMax) / 100);
        this.history[this.histHead] = n;
        this.histHead = (this.histHead + 1) % HISTORY;
        this.tickMax = sig;
      }

      // Strips of `stack` rows with one blank row between, centred.
      const stripH = stack + 1;
      const lines = Math.max(1, Math.floor((rows + 1) / stripH));
      const top = Math.floor((rows - (lines * stripH - 1)) / 2);
      const total = Math.min(lines * cols, HISTORY);
      const level = this.level, slot = this.slot;
      for (let cell = 0; cell < total; cell++) {
        const age = total - 1 - cell;   // 0 = newest, at the bottom right
        const n = this.history[(this.histHead - 1 - age + HISTORY * 2) % HISTORY];
        if (!n) continue;
        const line = Math.floor(cell / cols);
        const col = cell % cols;
        const base = top + line * stripH + stack - 1;
        for (let k = 0; k < n; k++) {
          const r = base - k;
          if (r < 0 || r >= rows) continue;
          const i = r * cols + col;
          level[i] = 1;
          // His k == 5: the top dot of a full stack lights red.
          if (k === stack - 1 && stack > 1) slot[i] = usePalette ? nPal : 1;
          else slot[i] = usePalette ? Math.floor(k / stack * nPal) : 0;
        }
      }
    },

    equaliser(signals, dt, usePalette, nPal) {
      const cols = this.cols, rows = this.rows;
      const gap = cols >= 27 ? 1 : 0;
      const bw = Math.max(1, Math.floor((cols - gap * 8) / 9));
      const left = Math.floor((cols - (bw * 9 + gap * 8)) / 2);
      const level = this.level, slot = this.slot;

      for (let b = 0; b < 9; b++) {
        // Instant attack, steady release: the ballistics of a hi-fi meter.
        const target = signals[b] / 100 * rows;
        this.bars[b] = Math.max(target, this.bars[b] - rows * 1.6 * dt);
        const h = this.bars[b];
        if (h >= this.peaks[b]) {
          this.peaks[b] = h;
          this.peakHold[b] = 0.7;
          this.peakVel[b] = 0;
        } else if (this.peakHold[b] > 0) {
          this.peakHold[b] -= dt;
        } else {
          this.peakVel[b] += rows * 0.6 * dt;
          this.peaks[b] = Math.max(0, this.peaks[b] - this.peakVel[b] * dt);
        }

        const full = Math.floor(h);
        const frac = h - full;
        const peakRow = this.peaks[b] > 0.5 ? Math.min(rows - 1, Math.ceil(this.peaks[b]) - 1) : -1;
        const c0 = left + b * (bw + gap);
        for (let r = 0; r < rows; r++) {     // r counted up from the bottom
          let lv = r < full ? 1 : r === full ? frac : 0;
          const isPeak = r === peakRow;
          if (isPeak) lv = 1;
          if (lv <= 0) continue;
          const z = (r + 0.5) / rows;
          let s;
          if (usePalette) s = isPeak && r >= full ? nPal : b % nPal;
          else s = z > 0.82 ? 1 : z > 0.62 ? 2 : 0;
          const row = rows - 1 - r;
          for (let c = c0; c < c0 + bw && c < cols; c++) {
            const i = row * cols + c;
            level[i] = lv;
            slot[i] = s;
          }
        }
      }
    },

    marquee(p, signals, params, dt, band, usePalette, nPal) {
      const cols = this.cols, rows = this.rows;
      const text = params.displayText == null ? '' : String(params.displayText);
      const { masks, owner } = this.textColumns(text);
      const level = this.level, slot = this.slot;

      // Kick: a rising edge on the chosen band drives the words to full
      // brightness, over the per-column pulse. (Washing the whole board on
      // each kick was tried and read as a screen, not a sign.)
      const bass = signals[band];
      if (this.armed && bass > 70) { this.flash = 1; this.armed = false; }
      else if (bass < 45) this.armed = true;
      this.flash *= Math.exp(-dt / 0.1);

      // Letters grow in whole LEDs, so a big board shows a big sign rather
      // than a thin line of text in a sea of dark LEDs.
      const s = Math.max(1, Math.min(Math.floor(rows / 10), Math.floor(cols / 18)));
      const textW = masks.length * s;
      this.scroll += dt * params.speed;
      const period = textW + cols;
      if (this.scroll >= period) this.scroll %= period;
      const start = cols - Math.floor(this.scroll);   // board column of text column 0

      // The words ride a wave whose height follows the band.
      const spare = Math.floor((rows - 7 * s) / 2);
      const amp = Math.min(spare, 2 * s) * Math.min(1, bass / 100);
      const t = p.millis() / 1000;
      const top = spare;

      for (let c = 0; c < cols; c++) {
        const tc = c - start;
        if (tc < 0 || tc >= textW) continue;
        const fc = Math.floor(tc / s);
        const m = masks[fc];
        if (!m) continue;
        const ch = owner[fc];
        const bob = Math.round(Math.sin(t * 5 - ch * 0.8) * amp);
        // Each column's brightness pulses with the band beneath it.
        const lv = 0.45 + 0.55 * Math.min(1, signals[Math.min(8, Math.floor(c / cols * 9))] / 100);
        const sl = usePalette ? ch % nPal : 0;
        for (let fy = 0; fy < 7; fy++) {
          if (!(m & (1 << fy))) continue;
          for (let dy = 0; dy < s; dy++) {
            const r = top + fy * s + dy - bob;
            if (r < 0 || r >= rows) continue;
            const i = r * cols + c;
            level[i] = Math.max(lv, this.flash);
            slot[i] = sl;
          }
        }
      }
    },

    glowCanvas(w, h) {
      if (!this.glowCv || this.glowCv.width !== w || this.glowCv.height !== h) {
        this.glowCv = document.createElement('canvas');
        this.glowCv.width = w;
        this.glowCv.height = h;
        this.glowImage = new ImageData(w, h);
      }
      return this.glowCv;
    },

    drawBoard(g, x0, y0, pitch, rad, dim) {
      const cols = this.cols, rows = this.rows;
      const m = g.getTransform();
      const cw = g.canvas.width, ch = g.canvas.height;
      const key = [cw, ch, m.a, m.b, m.c, m.d, m.e, m.f, cols, rows, x0, y0, pitch, rad, dim.join()].join('|');
      if (key !== this.boardKey) {
        this.boardKey = key;
        const cv = this.boardCv || (this.boardCv = document.createElement('canvas'));
        cv.width = cw;
        cv.height = ch;
        const b = cv.getContext('2d');
        b.setTransform(m);
        const pad = pitch * 0.9;
        b.fillStyle = '#0b0b0c';
        b.strokeStyle = '#1c1c1f';
        b.lineWidth = 1.5;
        b.beginPath();
        const bx = x0 - pad, by = y0 - pad;
        const bw = (cols - 1) * pitch + pad * 2, bh = (rows - 1) * pitch + pad * 2;
        if (b.roundRect) b.roundRect(bx, by, bw, bh, pitch * 0.5);
        else b.rect(bx, by, bw, bh);
        b.fill();
        b.stroke();
        const path = new Path2D();
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = x0 + c * pitch, y = y0 + r * pitch;
            path.moveTo(x + rad, y);
            path.arc(x, y, rad, 0, TAU);
          }
        }
        b.fillStyle = css(dim);
        b.fill(path);
      }
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.boardCv, 0, 0);
      g.restore();
    },

    render(g, params, x0, y0, pitch, slots, nSlots, dim) {
      const cols = this.cols, rows = this.rows;
      const disp = this.disp, dispSlot = this.dispSlot;
      const rad = pitch * params.ledSize;
      const glow = params.glow;

      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // The panel and its unlit LEDs only change with the geometry, and were
      // half the frame's fill work at a fine pitch, so they are drawn once
      // into a device-resolution cache and copied in.
      this.drawBoard(g, x0, y0, pitch, rad, dim);

      // One Path2D per (colour, brightness) bucket: a few dozen fills a frame
      // however many LEDs are lit, instead of one fill per LED.
      const nb = nSlots * LEVELS;
      const lit = new Array(nb);
      const cores = new Array(nSlots);
      const coreR = rad * 0.5;

      for (let r = 0; r < rows; r++) {
        const y = y0 + r * pitch;
        for (let c = 0; c < cols; c++) {
          const x = x0 + c * pitch;
          const i = r * cols + c;
          const q = Math.min(LEVELS, Math.round(disp[i] * LEVELS));
          if (q <= 0) continue;
          const b = Math.min(dispSlot[i], nSlots - 1) * LEVELS + q - 1;
          const path = lit[b] || (lit[b] = new Path2D());
          path.moveTo(x + rad, y);
          path.arc(x, y, rad, 0, TAU);
          if (q === LEVELS) {
            const s = Math.min(dispSlot[i], nSlots - 1);
            const cp = cores[s] || (cores[s] = new Path2D());
            cp.moveTo(x + coreR, y);
            cp.arc(x, y, coreR, 0, TAU);
          }
        }
      }

      for (let b = 0; b < nb; b++) {
        if (!lit[b]) continue;
        const s = Math.floor(b / LEVELS), q = (b % LEVELS) + 1;
        const t = q / LEVELS;
        // Perceived brightness climbs faster than the drive level.
        g.fillStyle = css(mix(dim, slots[s], Math.pow(t, 0.7)));
        g.fill(lit[b]);
      }

      // A hot centre on fully driven LEDs, where the die shows through the lens.
      for (let s = 0; s < nSlots; s++) {
        if (!cores[s]) continue;
        g.fillStyle = css(mix(slots[s], WHITE, 0.3));
        g.fill(cores[s]);
      }

      // Halo last and additive, so light spills over neighbouring dark LEDs.
      // A halo disc per LED filled as one path cost ~7 ms a frame on a dense
      // equaliser (overlapping subpaths are slow to fill); instead the board is
      // written one pixel per LED and scaled up with smoothing, which spreads
      // each lit LED over its neighbours for the price of one drawImage.
      if (glow > 0) {
        const gc = this.glowCanvas(cols + 2, rows + 2);
        const img = this.glowImage;
        const px = img.data;
        px.fill(0);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const v = disp[i];
            if (v <= 0.05) continue;
            const col = slots[Math.min(dispSlot[i], nSlots - 1)];
            const o = ((r + 1) * (cols + 2) + c + 1) * 4;
            px[o] = col[0] * v; px[o + 1] = col[1] * v; px[o + 2] = col[2] * v; px[o + 3] = 255;
          }
        }
        gc.getContext('2d').putImageData(img, 0, 0);
        g.globalCompositeOperation = 'lighter';
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        const dx = x0 - 1.5 * pitch, dy = y0 - 1.5 * pitch;
        const dw = (cols + 2) * pitch, dh = (rows + 2) * pitch;
        // One pixel per LED lands exactly on the LED centres; any second,
        // enlarged copy for a wider bloom drifts off-centre towards the edges.
        g.globalAlpha = glow * 0.55;
        g.drawImage(gc, dx, dy, dw, dh);
      }

      g.restore();
    },
  });
})();
