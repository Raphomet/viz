// Supply Depot: the stock room of an invented audio-goods maker, OKTAVO Sound
// Supply, drifting past on a slow dolly. Speaker cabinets, crates, amp boxes,
// cartons, drums and tins stand in stacks on a studio floor, and every face
// is printed from one design system, the way a real maker's packaging is:
//   type    Archivo Black for the wordmark, product names and big numerals;
//           Space Mono for the technical copy (lot numbers, ratings, legends)
//   marks   the OKTAVO roundel (a disc cut by a band, with a centre dot), a
//           triple stripe, hazard hatching, a perforated grille, and a set of
//           twelve geometric pictograms on a 100-unit grid
//   inks    each colourway is a ground, a figure ink, three accents, a panel
//           dark and a light dial face; a design uses ground + figure + one
//           or two accents, never more
// The principle (from the LEXSAN set's speaker-box city, 2026-09-28): objects
// that wear designed graphics. What makes it more than a still life is that
// the graphics are instruments: VU needles, knobs, LED ladders, scrolling
// bands and pictogram cards are small canvas windows inside each design,
// redrawn and re-uploaded only where they animate (texSubImage3D into one
// texture array), so a face costs nothing until it moves.
//
// Music, each in its own place:
//   kick   the speaker nearest the middle of the view pumps its cone (a radial
//          magnification of the cone in the shader, per object) and its ON AIR
//          lamp lights; only that one object
//   snare  one pictogram card somewhere in the stock turns over to the next
//          pictogram
//   hats   tweeters shimmer and LED ladders flicker
//   bass   needles, knobs, tuning dials, bars and scrolling bands
//   drop   (with Follow) every window comes alive, the stacks start pulling
//          boxes out and re-stacking them, a wave of re-stacking runs down the
//          row as the drop lands, and the camera sweeps wider and lower
//
// Rendering: raw WebGL2 like fourd.js. Boxes and cylinders are two static
// meshes drawn per object with a model matrix; faces sample a 512px texture
// array with textureGrad (so a cylinder's wrap seam keeps its mip level).
// Light: hemisphere fill, a point key light that follows the dolly (so faces
// carry a lit gradient), contact darkening at the foot of every object and
// under anything stacked on it, soft edge darkening, and floor decals that
// multiply in contact occlusion plus a penumbral cast shadow per stack.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => t * t * (3 - 2 * t);
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  function h2(i, j) {
    let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + 1013904223;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---- the design system ----------------------------------------------------
  const COLORWAYS = [
    { name: 'Depot: cream, vermilion, cobalt',
      gr: '#efe6d2', fg: '#1e1d22', a1: '#e2462c', a2: '#2848a6', a3: '#ecb43a', dk: '#26262b', lt: '#f7f1e3', kr: '#c9a779',
      roomTop: '#cfc8bb', roomLow: '#e6e0d4', floor: '#d6cebf', sky: '#f4f1ea', gnd: '#8e826f', key: '#fff1da', fog: '#e2dcd0', shade: 0.5 },
    { name: 'Night shift: navy, tomato, mint',
      gr: '#27334f', fg: '#f1e8d6', a1: '#ff6a45', a2: '#4fc2a0', a3: '#f3c04f', dk: '#12151f', lt: '#efe6d3', kr: '#7d6448',
      roomTop: '#10141f', roomLow: '#252c3d', floor: '#2a3040', sky: '#8c98bc', gnd: '#241f22', key: '#ffe0b8', fog: '#222939', shade: 0.62 },
    { name: 'Riso: pink, teal, yellow',
      gr: '#f8f5ef', fg: '#2b2c6c', a1: '#ff4fae', a2: '#00a2a6', a3: '#ffdc3c', dk: '#2b2c6c', lt: '#fdfaf4', kr: '#ecc9a6',
      roomTop: '#e9e1dc', roomLow: '#f6f0ea', floor: '#e6dcd4', sky: '#ffffff', gnd: '#a4948c', key: '#fff6ec', fog: '#efe8e2', shade: 0.45 },
  ];

  const DISPLAY = 'Archivo Black', MONO = 'Space Mono';
  const hasFont = (f) => typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(f);
  const fontsReady = () => hasFont(DISPLAY) && hasFont(MONO);
  const fDisp = (px) => px.toFixed(1) + 'px ' + (hasFont(DISPLAY) ? '"' + DISPLAY + '", ' : '') + 'Impact, "Arial Black", sans-serif';
  const fMono = (px, w) => (w || 400) + ' ' + px.toFixed(1) + 'px ' + (hasFont(MONO) ? '"' + MONO + '", ' : '') + 'Menlo, monospace';

  function text(g, s, x, y, font, col, align, track, maxW) {
    g.font = font; g.fillStyle = col; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = (track || 0) + 'px';
    if (maxW) {
      const w = g.measureText(s).width;
      if (w > maxW) { g.save(); g.translate(x, y); g.scale(maxW / w, 1); g.fillText(s, 0, 0); g.restore(); if ('letterSpacing' in g) g.letterSpacing = '0px'; return; }
    }
    g.fillText(s, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function rrect(g, x, y, w, h, r, col) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = col; g.fill();
  }
  function disc(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill(); }
  function ring(g, x, y, r, lw, col) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); }
  // The roundel: a disc cut by a band, with a centre dot. OKTAVO's mark.
  function roundel(g, x, y, r, a, b) {
    disc(g, x, y, r, a);
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    rect(g, x - r, y - r * 0.2, r * 2, r * 0.4, b); g.restore();
    disc(g, x, y, r * 0.3, a);
    disc(g, x, y, r * 0.12, b);
  }
  function wordmark(g, x, y, px, col, align) { text(g, 'OKTAVO', x, y, fDisp(px), col, align || 'left', px * 0.08); }
  function hatch(g, x, y, w, h, n, a, b, flip) {
    rect(g, x, y, w, h, b);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = a;
    const p = (w + h) / n;
    for (let i = -2; i < n + 2; i++) {
      const x0 = x + i * p; g.beginPath();
      if (flip) { g.moveTo(x0, y + h); g.lineTo(x0 + p / 2, y + h); g.lineTo(x0 + p / 2 + h, y); g.lineTo(x0 + h, y); }
      else { g.moveTo(x0, y); g.lineTo(x0 + p / 2, y); g.lineTo(x0 + p / 2 + h, y + h); g.lineTo(x0 + h, y + h); }
      g.fill();
    }
    g.restore();
  }
  function stripes3(g, x, y, w, h, cols, vertical) {
    const n = cols.length, gap = (vertical ? w : h) * 0.12;
    const s = ((vertical ? w : h) - gap * (n - 1)) / n;
    cols.forEach((c, i) => vertical ? rect(g, x + i * (s + gap), y, s, h, c) : rect(g, x, y + i * (s + gap), w, s, c));
  }
  function grille(g, x, y, w, h, pitch, r, col) {
    g.fillStyle = col;
    const nx = Math.floor(w / pitch), ny = Math.floor(h / pitch);
    const ox = x + (w - (nx - 1) * pitch) / 2, oy = y + (h - (ny - 1) * pitch) / 2;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      g.beginPath(); g.arc(ox + i * pitch + (j % 2 ? pitch / 2 : 0) * (i < nx - 1 ? 1 : 0), oy + j * pitch, r, 0, TAU); g.fill();
    }
  }
  function slots(g, x, y, w, h, n, col) {
    const p = h / n;
    for (let i = 0; i < n; i++) rrect(g, x, y + i * p + p * 0.25, w, p * 0.5, p * 0.25, col);
  }
  // A loudspeaker cone, lit from the upper left, printed flat.
  function cone(g, cx, cy, r, C, rim) {
    disc(g, cx, cy, r, rim);
    disc(g, cx, cy, r * 0.93, C.fg === '#f1e8d6' ? '#0b0d14' : '#141418');
    const gr = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 0.86);
    gr.addColorStop(0, '#5a5a60'); gr.addColorStop(0.55, '#2b2b30'); gr.addColorStop(1, '#101014');
    disc(g, cx, cy, r * 0.84, gr);
    for (let i = 1; i < 5; i++) ring(g, cx, cy, r * (0.36 + i * 0.12), r * 0.012, 'rgba(255,255,255,0.07)');
    const dg = g.createRadialGradient(cx - r * 0.1, cy - r * 0.12, r * 0.02, cx, cy, r * 0.3);
    dg.addColorStop(0, '#8a8a90'); dg.addColorStop(1, '#1d1d22');
    disc(g, cx, cy, r * 0.3, dg);
    ring(g, cx, cy, r * 0.965, r * 0.035, 'rgba(0,0,0,0.35)');
    // four mounting bolts
    for (let k = 0; k < 4; k++) { const a = TAU * (k + 0.5) / 4; disc(g, cx + Math.cos(a) * r * 0.965, cy + Math.sin(a) * r * 0.965, r * 0.035, '#8d8d92'); }
  }
  function lamp(g, x, y, r, C, label) {
    disc(g, x, y, r * 1.35, C.fg === '#f1e8d6' ? '#3a3f4f' : '#4a4a50');
    disc(g, x, y, r, '#5b1d16');
    disc(g, x - r * 0.3, y - r * 0.3, r * 0.3, 'rgba(255,255,255,0.25)');
    if (label) text(g, label, x + r * 2, y + r * 0.45, fMono(r * 1.2, 700), C.lt, 'left', 1);
  }

  // Twelve pictograms on a 100-unit grid, all fills, one weight of stroke.
  const PICTOS = [
    (g) => { // this side up
      for (const x of [30, 70]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 18, 34); g.lineTo(x + 7, 34); g.lineTo(x + 7, 76); g.lineTo(x - 7, 76); g.lineTo(x - 7, 34); g.lineTo(x - 18, 34); g.closePath(); g.fill(); }
      g.fillRect(10, 84, 80, 8);
    },
    (g) => { // keep dry
      g.beginPath(); g.moveTo(8, 50); g.arc(50, 50, 42, Math.PI, 0);
      for (let i = 3; i >= 0; i--) g.arc(18.5 + i * 21, 50, 10.5, 0, Math.PI, true);
      g.fill(); g.fillRect(46, 50, 8, 30);
      g.beginPath(); g.arc(38, 80, 12, 0, Math.PI); g.lineWidth = 8; g.stroke();
    },
    (g) => { // fragile
      g.beginPath(); g.moveTo(24, 8); g.lineTo(76, 8); g.bezierCurveTo(78, 44, 64, 56, 54, 58); g.lineTo(54, 82); g.lineTo(70, 88); g.lineTo(70, 94);
      g.lineTo(30, 94); g.lineTo(30, 88); g.lineTo(46, 82); g.lineTo(46, 58); g.bezierCurveTo(36, 56, 22, 44, 24, 8); g.fill();
    },
    (g) => { g.beginPath(); g.moveTo(58, 4); g.lineTo(20, 56); g.lineTo(46, 56); g.lineTo(38, 96); g.lineTo(80, 40); g.lineTo(54, 40); g.closePath(); g.fill(); }, // bolt
    (g) => { // note
      g.beginPath(); g.ellipse(36, 78, 16, 12, -0.4, 0, TAU); g.fill(); g.fillRect(46, 10, 8, 68);
      g.beginPath(); g.moveTo(54, 10); g.bezierCurveTo(70, 24, 84, 30, 76, 56); g.bezierCurveTo(76, 38, 66, 32, 54, 30); g.fill();
    },
    (g) => { // eye
      g.beginPath(); g.moveTo(4, 50); g.quadraticCurveTo(50, 4, 96, 50); g.quadraticCurveTo(50, 96, 4, 50); g.fill();
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(50, 50, 20, 0, TAU); g.fill(); g.restore();
      g.beginPath(); g.arc(50, 50, 11, 0, TAU); g.fill();
    },
    (g) => { // sun
      g.beginPath(); g.arc(50, 50, 20, 0, TAU); g.fill();
      for (let i = 0; i < 8; i++) { g.save(); g.translate(50, 50); g.rotate(i * TAU / 8); g.fillRect(-4, -46, 8, 16); g.restore(); }
    },
    (g) => { // speaker
      g.beginPath(); g.moveTo(8, 36); g.lineTo(26, 36); g.lineTo(50, 14); g.lineTo(50, 86); g.lineTo(26, 64); g.lineTo(8, 64); g.closePath(); g.fill();
      g.lineWidth = 8; for (const r of [16, 30]) { g.beginPath(); g.arc(52, 50, r, -0.8, 0.8); g.stroke(); }
    },
    (g) => { // wave
      g.lineWidth = 9; g.lineCap = 'round';
      for (const y of [32, 58]) { g.beginPath(); for (let x = 8; x <= 92; x += 2) { const yy = y + Math.sin((x - 8) / 84 * TAU * 1.5) * 10; x === 8 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke(); }
      g.lineCap = 'butt';
    },
    (g) => { // star
      g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 19 : 46; g.lineTo(50 + Math.cos(a) * r, 54 + Math.sin(a) * r); } g.closePath(); g.fill();
    },
    (g) => { // drop
      g.beginPath(); g.moveTo(50, 6); g.bezierCurveTo(62, 30, 80, 46, 80, 64); g.arc(50, 64, 30, 0, Math.PI); g.bezierCurveTo(20, 46, 38, 30, 50, 6); g.fill();
    },
    (g) => { // heart
      g.beginPath(); g.moveTo(50, 88); g.bezierCurveTo(10, 60, 4, 36, 18, 22); g.bezierCurveTo(30, 10, 46, 16, 50, 30);
      g.bezierCurveTo(54, 16, 70, 10, 82, 22); g.bezierCurveTo(96, 36, 90, 60, 50, 88); g.fill();
    },
  ];
  function picto(g, i, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
    g.fillStyle = col; g.strokeStyle = col; PICTOS[((i % PICTOS.length) + PICTOS.length) % PICTOS.length](g); g.restore();
  }

  // ---- animated windows ------------------------------------------------------
  // A window draws its moving part over a copy of the static art beneath it.
  function vu(g, w, h, v, C, face, ink, red) {
    rrect(g, 0, 0, w, h, h * 0.06, C.dk);
    rrect(g, w * 0.05, h * 0.07, w * 0.9, h * 0.86, h * 0.04, face);
    const cx = w / 2, cy = h * 1.02, R = h * 0.78;
    const a0 = -Math.PI / 2 - 0.8, a1 = -Math.PI / 2 + 0.8;
    g.lineWidth = h * 0.025; g.strokeStyle = ink;
    g.beginPath(); g.arc(cx, cy, R * 0.86, a0, lerp(a0, a1, 0.72)); g.stroke();
    g.strokeStyle = red; g.lineWidth = h * 0.07;
    g.beginPath(); g.arc(cx, cy, R * 0.83, lerp(a0, a1, 0.72), a1); g.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = lerp(a0, a1, i / 10), l = i % 5 ? 0.06 : 0.12;
      g.strokeStyle = i > 7 ? red : ink; g.lineWidth = h * 0.02;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); g.lineTo(cx + Math.cos(a) * R * (0.9 + l), cy + Math.sin(a) * R * (0.9 + l)); g.stroke();
    }
    text(g, 'VU', cx, h * 0.72, fMono(h * 0.13, 700), ink, 'center', 2);
    const a = lerp(a0, a1, clamp01(v));
    g.strokeStyle = ink; g.lineWidth = h * 0.022; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02); g.stroke(); g.lineCap = 'butt';
    rect(g, w * 0.05, h * 0.84, w * 0.9, h * 0.09, C.dk);
  }
  function knob(g, cx, cy, r, ang, C, cap, mark) {
    g.strokeStyle = mark; g.lineWidth = r * 0.07;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + i / 10 * Math.PI * 1.5;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 1.18); g.lineTo(cx + Math.cos(a) * r * 1.34, cy + Math.sin(a) * r * 1.34); g.stroke();
    }
    disc(g, cx + r * 0.08, cy + r * 0.1, r, 'rgba(0,0,0,0.3)');
    disc(g, cx, cy, r, cap);
    const kg = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
    kg.addColorStop(0, 'rgba(255,255,255,0.28)'); kg.addColorStop(1, 'rgba(255,255,255,0)');
    disc(g, cx, cy, r, kg);
    ring(g, cx, cy, r * 0.8, r * 0.05, 'rgba(0,0,0,0.18)');
    const a = Math.PI * 0.75 + clamp01(ang) * Math.PI * 1.5;
    g.strokeStyle = mark === C.lt ? C.lt : C.gr; g.lineWidth = r * 0.16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25); g.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); g.stroke();
    g.lineCap = 'butt';
  }
  function ladder(g, x, y, w, h, n, v, on, hot, off) {
    const p = h / n;
    for (let i = 0; i < n; i++) {
      const lit = (i + 0.5) / n < v;
      rrect(g, x, y + h - (i + 1) * p + p * 0.14, w, p * 0.72, p * 0.2, lit ? (i >= n - 2 ? hot : on) : off);
    }
  }
  function chevrons(g, w, h, off, a, b, dir) {
    rect(g, 0, 0, w, h, b);
    const p = h * 1.2; g.fillStyle = a;
    const o = ((off % p) + p) % p;
    for (let x = -2 * p + o; x < w + p; x += p) {
      g.beginPath();
      const s = dir || 1;
      g.moveTo(x, 0); g.lineTo(x + p * 0.45, 0); g.lineTo(x + p * 0.45 + s * h * 0.5, h / 2); g.lineTo(x + p * 0.45, h); g.lineTo(x, h); g.lineTo(x + s * h * 0.5, h / 2); g.closePath(); g.fill();
    }
  }
  function checks(g, w, h, off, a, b) {
    rect(g, 0, 0, w, h, b);
    const s = h / 2; g.fillStyle = a;
    const o = ((off % (2 * s)) + 2 * s) % (2 * s);
    for (let x = -2 * s + o, i = 0; x < w + s; x += s, i++) {
      g.fillRect(x, (i % 2) * s, s, s);
    }
  }

  // ---- object kinds and their faces ----------------------------------------
  // box: w (x) by h (y) by d (z); cyl: w is the diameter. Face aspects follow.
  const KINDS = {
    S: { shape: 'box', w: 1.0, h: 1.35, d: 0.85, name: 'speaker' },
    C: { shape: 'box', w: 1.35, h: 0.9, d: 1.0, name: 'crate' },
    A: { shape: 'box', w: 1.25, h: 0.62, d: 0.8, name: 'amp' },
    B: { shape: 'box', w: 0.85, h: 0.85, d: 0.85, name: 'carton' },
    D: { shape: 'cyl', w: 0.96, h: 1.05, name: 'drum' },
    T: { shape: 'cyl', w: 0.72, h: 0.5, name: 'tin' },
  };
  function faceDims(K, face) {
    if (K.shape === 'cyl') return face === 2 ? [K.w, K.w] : [Math.PI * K.w / 2, K.h];
    return face === 0 ? [K.w, K.h] : face === 1 ? [K.d, K.h] : [K.w, K.d];
  }

  // Each design: kind, face (0 front / wrap, 1 side, 2 top / lid), draw(g, W, H, C, win).
  // win(x, y, w, h, rank, fn, opts) registers an animated window; rank is how
  // early it comes alive as the Alive control rises (0 = always).
  const DESIGNS = [];
  const D = (kind, face, draw, extra) => DESIGNS.push(Object.assign({ kind, face, draw }, extra || {}));

  // Shared chrome: the header strip with roundel, wordmark and a code.
  function header(g, W, H, C, bg, fg, acc, code) {
    const hh = Math.round(H * 0.13);
    rect(g, 0, 0, W, hh, bg);
    roundel(g, hh * 0.62, hh * 0.5, hh * 0.32, fg, acc);
    wordmark(g, hh * 1.1, hh * 0.72, hh * 0.52, fg);
    if (code) text(g, code, W - hh * 0.35, hh * 0.64, fMono(hh * 0.3, 700), fg, 'right', 1);
    return hh;
  }
  function techline(g, W, y, px, col, s) { text(g, s, W / 2, y, fMono(px, 400), col, 'center', px * 0.12, W * 0.9); }

  // Speakers: fronts. `cone` records where the pumping cone sits (uv, radius in face widths).
  D('S', 0, (g, W, H, C, win, d) => { // SUBBOX 12
    rect(g, 0, 0, W, H, C.dk);
    const hh = header(g, W, H, C, C.a1, C.lt, C.a1, 'SB-12');
    grille(g, W * 0.06, hh + H * 0.03, W * 0.88, H * 0.84 - hh, W * 0.035, W * 0.006, 'rgba(255,255,255,0.10)');
    const r = W * 0.36, cx = W / 2, cy = H * 0.64;
    cone(g, cx, cy, r, C, C.a1);
    d.cone = [cx / W, cy / H, r * 0.84 / W];
    cone(g, W * 0.3, hh + H * 0.1, W * 0.075, C, '#77777c');
    lamp(g, W * 0.64, hh + H * 0.1, W * 0.035, C, 'ON AIR');
    d.lamp = [W * 0.64 / W, (hh + H * 0.1) / H, W * 0.035 / W];
    win(W * 0.3 - W * 0.09, hh + H * 0.1 - W * 0.09, W * 0.18, W * 0.18, 0.5, (g2, w, h, st) => {
      const k = st.hat;
      ring(g2, w / 2, h / 2, w * (0.36 + 0.08 * k), w * 0.04, 'rgba(255,255,255,' + (0.1 + 0.5 * k).toFixed(3) + ')');
    });
    techline(g, W, H * 0.965, H * 0.022, C.lt, 'LOW FREQUENCY GOODS · 400 W · 8 Ω');
  });
  D('S', 0, (g, W, H, C, win, d) => { // LOWLAND 2x8
    rect(g, 0, 0, W, H, C.a2);
    rect(g, W * 0.07, H * 0.05, W * 0.86, H * 0.9, C.dk);
    const r1 = W * 0.26, r2 = W * 0.3;
    cone(g, W / 2, H * 0.3, r1, C, C.a3);
    cone(g, W / 2, H * 0.68, r2, C, C.a3);
    d.cone = [0.5, 0.68, r2 * 0.84 / W];
    text(g, 'LOWLAND', W * 0.13, H * 0.11, fDisp(H * 0.045), C.lt, 'left', 1);
    text(g, '2×8', W * 0.87, H * 0.11, fMono(H * 0.035, 700), C.a3, 'right');
    lamp(g, W * 0.82, H * 0.9, W * 0.03, C, '');
    d.lamp = [0.82, 0.9, 0.03];
    roundel(g, W * 0.17, H * 0.9, W * 0.045, C.lt, C.dk);
    win(W * 0.28, H * 0.875, W * 0.46, H * 0.05, 0.6, (g2, w, h, st) => {
      rect(g2, 0, 0, w, h, C.dk);
      const n = 10, v = st.bass;
      for (let i = 0; i < n; i++) rrect(g2, i * w / n + w * 0.01, h * 0.25, w / n * 0.8, h * 0.5, h * 0.2, (i + 0.5) / n < v ? (i > 7 ? C.a1 : C.a3) : 'rgba(255,255,255,0.12)');
    });
  });
  D('S', 0, (g, W, H, C, win, d) => { // MONITOR 7 with a VU
    rect(g, 0, 0, W, H, C.gr);
    const hh = header(g, W, H, C, C.gr, C.fg, C.a1, 'M-7');
    rect(g, W * 0.06, hh, W * 0.88, H * 0.005, C.fg);
    rrect(g, W * 0.08, hh + H * 0.03, W * 0.84, H * 0.82 - hh, W * 0.03, C.dk);
    const r = W * 0.33;
    cone(g, W / 2, H * 0.6, r, C, C.a2);
    d.cone = [0.5, 0.6, r * 0.84 / W];
    lamp(g, W * 0.8, hh + H * 0.08, W * 0.03, C, '');
    d.lamp = [0.8, (hh + H * 0.08) / H, 0.03];
    win(W * 0.18, hh + H * 0.055, W * 0.44, W * 0.22, 0.3, (g2, w, h, st) => vu(g2, w, h, st.vu, C, C.lt, C.dk, C.a1));
    text(g, 'MONITOR SEVEN', W / 2, H * 0.935, fDisp(H * 0.04), C.fg, 'center', 1, W * 0.86);
    techline(g, W, H * 0.975, H * 0.02, C.fg, 'NEAR-FIELD · MADE TO BE HEARD');
  });
  D('S', 1, (g, W, H, C) => { // speaker side
    rect(g, 0, 0, W, H, C.gr);
    stripes3(g, W * 0.1, 0, W * 0.24, H, [C.a1, C.a3, C.a2], true);
    rrect(g, W * 0.46, H * 0.18, W * 0.42, H * 0.09, H * 0.045, C.dk);
    rrect(g, W * 0.49, H * 0.2, W * 0.36, H * 0.05, H * 0.025, '#000000');
    g.save(); g.translate(W * 0.6, H * 0.88); g.rotate(-Math.PI / 2);
    text(g, 'HANDLE WITH RHYTHM', 0, 0, fDisp(W * 0.1), C.fg, 'left', 1, H * 0.54); g.restore();
    picto(g, 2, W * 0.66, H * 0.5, W * 0.24, C.fg);
    text(g, 'LOT 0412', W * 0.9, H * 0.97, fMono(W * 0.055, 700), C.fg, 'right');
  });
  D('S', 2, (g, W, H, C) => { // speaker top
    rect(g, 0, 0, W, H, C.dk);
    roundel(g, W / 2, H / 2, H * 0.3, C.lt, C.dk);
    text(g, 'THIS SIDE UP', W / 2, H * 0.92, fMono(H * 0.07, 700), C.lt, 'center', 2);
    picto(g, 0, W * 0.06, H * 0.08, H * 0.2, C.a1);
  });

  // Crates
  D('C', 0, (g, W, H, C, win) => { // BASS RATIONS
    rect(g, 0, 0, W, H, C.a3);
    for (let i = 1; i < 4; i++) rect(g, 0, H * i / 4 - H * 0.004, W, H * 0.008, 'rgba(0,0,0,0.18)');
    text(g, '07', W * 0.05, H * 0.62, fDisp(H * 0.62), C.fg, 'left', -2);
    text(g, 'BASS', W * 0.5, H * 0.24, fDisp(H * 0.16), C.fg, 'left', 1);
    text(g, 'RATIONS', W * 0.5, H * 0.4, fDisp(H * 0.16), C.fg, 'left', 1, W * 0.46);
    text(g, 'NET WT 124 BPM', W * 0.5, H * 0.48, fMono(H * 0.045, 700), C.fg, 'left', 1);
    hatch(g, 0, H * 0.82, W, H * 0.18, 10, C.fg, C.a3);
    rect(g, W * 0.58, H * 0.53, H * 0.25, H * 0.25, C.fg);
    win(W * 0.58 + H * 0.02, H * 0.55, H * 0.21, H * 0.21, 0, (g2, w, h, st, wn) => flipCard(g2, w, h, st, wn, C.lt, C.fg), { picto: 3 });
    roundel(g, W * 0.9, H * 0.66, H * 0.09, C.fg, C.a3);
  });
  D('C', 0, (g, W, H, C, win) => { // SNARE CO.
    rect(g, 0, 0, W, H, C.gr);
    const hh = header(g, W, H, C, C.fg, C.gr, C.a1, 'CRATE 3/9');
    text(g, 'SNARE CO.', W * 0.06, hh + H * 0.23, fDisp(H * 0.2), C.a1, 'left', 1, W * 0.88);
    rect(g, W * 0.06, hh + H * 0.28, W * 0.88, H * 0.006, C.fg);
    const s = H * 0.24, y = hh + H * 0.33;
    for (let i = 0; i < 4; i++) {
      const x = W * 0.06 + i * (W * 0.88 - s) / 3;
      rect(g, x, y, s, s, i === 2 ? C.a2 : C.fg);
      if (i !== 2) picto(g, [6, 4, 0, 1][i], x + s * 0.15, y + s * 0.15, s * 0.7, C.gr);
      else win(x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, 0, (g2, w, h, st, wn) => flipCard(g2, w, h, st, wn, C.lt, C.a2), { picto: 8 });
    }
    techline(g, W, H * 0.95, H * 0.04, C.fg, 'CRISP · DRY · ON THE TWO AND FOUR');
  });
  D('C', 0, (g, W, H, C, win) => { // B-12 with a chevron band
    rect(g, 0, 0, W, H, C.a2);
    text(g, 'B-12', W * 0.06, H * 0.44, fDisp(H * 0.38), C.lt, 'left', 0, W * 0.62);
    roundel(g, W * 0.82, H * 0.24, H * 0.15, C.lt, C.a2);
    text(g, 'SUB-HARMONIC SUPPLY', W * 0.06, H * 0.58, fMono(H * 0.05, 700), C.lt, 'left', 1);
    rect(g, 0, H * 0.66, W, H * 0.2, C.dk);
    win(0, H * 0.68, W, H * 0.16, 0.4, (g2, w, h, st) => chevrons(g2, w, h, st.scroll * 0.9, C.a3, C.dk, 1));
    picto(g, 0, W * 0.82, H * 0.38, H * 0.2, C.lt);
    techline(g, W, H * 0.95, H * 0.04, C.lt, 'KEEP DRY · KEEP LOUD');
  });
  D('C', 1, (g, W, H, C) => { // crate side: FRAGILE LOUD
    rect(g, 0, 0, W, H, C.kr);
    for (let i = 1; i < 4; i++) rect(g, 0, H * i / 4 - H * 0.004, W, H * 0.008, 'rgba(0,0,0,0.16)');
    text(g, 'FRAGILE', W / 2, H * 0.3, fDisp(H * 0.2), C.a1, 'center', 2, W * 0.86);
    text(g, '— LOUD —', W / 2, H * 0.44, fMono(H * 0.08, 700), C.a1, 'center', 3);
    picto(g, 2, W * 0.14, H * 0.5, H * 0.34, C.fg);
    picto(g, 0, W * 0.44, H * 0.5, H * 0.34, C.fg);
    picto(g, 1, W * 0.72, H * 0.5, H * 0.34, C.fg);
  });
  D('C', 1, (g, W, H, C) => { // crate side: lot plate + stripes
    rect(g, 0, 0, W, H, C.gr);
    stripes3(g, 0, H * 0.08, W, H * 0.2, [C.a1, C.a3, C.a2]);
    rect(g, W * 0.08, H * 0.38, W * 0.84, H * 0.44, C.fg);
    text(g, 'LOT', W * 0.13, H * 0.5, fMono(H * 0.06, 700), C.gr, 'left', 2);
    text(g, '0412-B', W * 0.13, H * 0.7, fDisp(H * 0.17), C.gr, 'left', 1, W * 0.74);
    text(g, 'ORIGIN: THE BASEMENT', W * 0.13, H * 0.78, fMono(H * 0.045, 400), C.gr, 'left', 1, W * 0.74);
    grille(g, W * 0.08, H * 0.86, W * 0.84, H * 0.1, H * 0.05, H * 0.012, C.fg);
  });
  D('C', 2, (g, W, H, C) => { // crate lid: planks + tape
    rect(g, 0, 0, W, H, C.kr);
    for (let i = 1; i < 5; i++) rect(g, W * i / 5 - W * 0.003, 0, W * 0.006, H, 'rgba(0,0,0,0.16)');
    rect(g, 0, H * 0.4, W, H * 0.2, C.a1);
    text(g, 'OKTAVO SOUND SUPPLY · OKTAVO SOUND SUPPLY', W / 2, H * 0.53, fMono(H * 0.07, 700), C.lt, 'center', 2, W * 0.96);
  });

  // Amps
  D('A', 0, (g, W, H, C, win) => { // twin VU
    rect(g, 0, 0, W, H, C.dk);
    rect(g, 0, 0, W, H * 0.04, C.a1);
    wordmark(g, W * 0.05, H * 0.2, H * 0.1, C.lt);
    text(g, 'A-40 STEREO', W * 0.95, H * 0.19, fMono(H * 0.07, 700), C.lt, 'right', 1);
    const vw = W * 0.28, vh = H * 0.46;
    win(W * 0.05, H * 0.28, vw, vh, 0.1, (g2, w, h, st) => vu(g2, w, h, st.vu, C, C.lt, C.dk, C.a1));
    win(W * 0.36, H * 0.28, vw, vh, 0.45, (g2, w, h, st) => vu(g2, w, h, st.vu2, C, C.lt, C.dk, C.a1));
    win(W * 0.66, H * 0.26, W * 0.31, H * 0.5, 0.7, (g2, w, h, st) => {
      g2.drawImage(st.bgCanvas, 0, 0);
      knob(g2, w * 0.27, h * 0.35, h * 0.2, st.knob1, C, C.a3, C.lt);
      knob(g2, w * 0.73, h * 0.35, h * 0.2, st.knob2, C, C.lt, C.lt);
      knob(g2, w * 0.5, h * 0.78, h * 0.14, st.knob3, C, C.a1, C.lt);
    });
    text(g, 'GAIN      TONE', W * 0.815, H * 0.84, fMono(H * 0.055, 700), C.lt, 'center', 1);
    lamp(g, W * 0.06, H * 0.88, H * 0.035, C, 'POWER');
  });
  D('A', 0, (g, W, H, C, win) => { // tuning dial + ladder
    rect(g, 0, 0, W, H, C.gr);
    const hh = header(g, W, H, C, C.gr, C.fg, C.a1, 'T-88');
    rect(g, W * 0.04, hh + H * 0.02, W * 0.92, H * 0.005, C.fg);
    win(W * 0.05, H * 0.24, W * 0.62, H * 0.44, 0.2, (g2, w, h, st) => {
      rect(g2, 0, 0, w, h, C.dk);
      rect(g2, w * 0.03, h * 0.1, w * 0.94, h * 0.8, C.lt);
      for (let i = 0; i <= 40; i++) {
        const x = w * 0.06 + i / 40 * w * 0.88;
        rect(g2, x, h * 0.14, w * 0.004, i % 5 ? h * 0.12 : h * 0.24, C.fg);
        if (i % 10 === 0) text(g2, String(88 + i / 2), x, h * 0.55, fMono(h * 0.14, 700), C.fg, 'center');
      }
      text(g2, 'MHz', w * 0.94, h * 0.82, fMono(h * 0.1, 700), C.fg, 'right');
      const x = w * (0.08 + 0.84 * st.tune);
      rect(g2, x - w * 0.006, h * 0.1, w * 0.012, h * 0.8, C.a1);
    });
    win(W * 0.72, H * 0.24, W * 0.1, H * 0.62, 0.55, (g2, w, h, st) => { rect(g2, 0, 0, w, h, C.dk); ladder(g2, w * 0.18, h * 0.04, w * 0.64, h * 0.92, 8, st.hat * 0.7 + st.bass * 0.4, C.a3, C.a1, 'rgba(255,255,255,0.1)'); });
    knob(g, W * 0.9, H * 0.5, H * 0.1, 0.3, C, C.fg, C.fg);
    text(g, 'SEEK THE LOW BAND', W * 0.05, H * 0.84, fDisp(H * 0.08), C.fg, 'left', 1);
    techline(g, W, H * 0.95, H * 0.05, C.fg, '88—108 · FM · MONO/STEREO');
  });
  D('A', 0, (g, W, H, C, win) => { // five bars + big knob
    rect(g, 0, 0, W, H, C.a1);
    text(g, 'PUMP', W * 0.05, H * 0.34, fDisp(H * 0.28), C.lt, 'left', 1);
    text(g, 'COMPRESSOR · 5 BAND', W * 0.05, H * 0.46, fMono(H * 0.06, 700), C.lt, 'left', 1);
    win(W * 0.05, H * 0.52, W * 0.5, H * 0.38, 0.15, (g2, w, h, st) => {
      rect(g2, 0, 0, w, h, C.dk);
      for (let i = 0; i < 5; i++) {
        const v = st.bars[i];
        const x = w * 0.05 + i * w * 0.185;
        rect(g2, x, h * 0.1, w * 0.14, h * 0.8, 'rgba(255,255,255,0.1)');
        rect(g2, x, h * 0.1 + h * 0.8 * (1 - v), w * 0.14, h * 0.8 * v, i === 0 ? C.a3 : C.lt);
      }
    });
    win(W * 0.62, H * 0.12, W * 0.34, H * 0.76, 0.65, (g2, w, h, st) => { g2.drawImage(st.bgCanvas, 0, 0); knob(g2, w / 2, h * 0.52, w * 0.3, st.knob1, C, C.dk, C.lt); });
  });
  D('A', 1, (g, W, H, C) => { // amp side vent
    rect(g, 0, 0, W, H, C.gr);
    slots(g, W * 0.1, H * 0.12, W * 0.5, H * 0.76, 7, C.dk);
    rect(g, W * 0.68, H * 0.16, W * 0.24, H * 0.68, C.fg);
    text(g, 'SER', W * 0.8, H * 0.34, fMono(H * 0.08, 700), C.gr, 'center');
    text(g, '0412', W * 0.8, H * 0.52, fMono(H * 0.1, 700), C.gr, 'center');
    roundel(g, W * 0.8, H * 0.7, H * 0.08, C.gr, C.fg);
  });
  D('A', 2, (g, W, H, C) => { // amp top
    rect(g, 0, 0, W, H, C.dk);
    for (let i = 0; i < 3; i++) slots(g, W * (0.08 + i * 0.3), H * 0.15, W * 0.24, H * 0.7, 6, 'rgba(255,255,255,0.1)');
  });

  // Cartons
  D('B', 0, (g, W, H, C, win) => { // pictogram grid
    rect(g, 0, 0, W, H, C.gr);
    const hh = header(g, W, H, C, C.gr, C.fg, C.a1, 'No.9');
    const m = W * 0.07, s = (W - 2 * m) / 3, y0 = hh + H * 0.03;
    const cols = [C.fg, C.a1, C.fg, C.a2, null, C.a3, C.fg, C.a1, C.fg];
    const ids = [3, 5, 9, 7, -1, 10, 11, 6, 4];
    for (let i = 0; i < 9; i++) {
      const x = m + (i % 3) * s, y = y0 + Math.floor(i / 3) * s * 0.92;
      if (i === 4) { rect(g, x + s * 0.04, y + s * 0.02, s * 0.92, s * 0.88, C.fg); win(x + s * 0.08, y + s * 0.06, s * 0.84, s * 0.8, 0, (g2, w, h, st, wn) => flipCard(g2, w, h, st, wn, C.gr, C.fg), { picto: 1 }); continue; }
      rect(g, x + s * 0.04, y + s * 0.02, s * 0.92, s * 0.88, cols[i]);
      picto(g, ids[i], x + s * 0.2, y + s * 0.16, s * 0.6, cols[i] === C.a3 ? C.fg : C.gr);
    }
    techline(g, W, H * 0.965, H * 0.035, C.fg, 'ASSORTED SIGNS · 9 PCS');
  });
  D('B', 0, (g, W, H, C, win) => { // roundel porthole with scrolling stripes
    rect(g, 0, 0, W, H, C.a3);
    text(g, 'SPIN', W * 0.07, H * 0.17, fDisp(H * 0.14), C.fg, 'left', 1);
    text(g, '33⅓', W * 0.93, H * 0.16, fMono(H * 0.09, 700), C.fg, 'right');
    const r = W * 0.34, cx = W / 2, cy = H * 0.56;
    disc(g, cx, cy, r * 1.06, C.fg);
    win(cx - r, cy - r, 2 * r, 2 * r, 0.35, (g2, w, h, st) => {
      g2.drawImage(st.bgCanvas, 0, 0);
      g2.save(); g2.beginPath(); g2.arc(w / 2, h / 2, w / 2, 0, TAU); g2.clip();
      g2.translate(w / 2, h / 2); g2.rotate(st.spin); g2.translate(-w / 2, -h / 2);
      rect(g2, -w, -h, 3 * w, 3 * h, C.gr);
      const p = w / 7;
      for (let i = -8; i < 16; i++) rect(g2, -w + i * p, -h, p / 2, 3 * h, C.a1);
      disc(g2, w / 2, h / 2, w * 0.18, C.fg); disc(g2, w / 2, h / 2, w * 0.05, C.gr);
      g2.restore();
    });
    techline(g, W, H * 0.96, H * 0.04, C.fg, 'OKTAVO · ROTARY GOODS');
  });
  D('B', 0, (g, W, H, C, win) => { // metronome dial
    rect(g, 0, 0, W, H, C.dk);
    text(g, '124', W * 0.07, H * 0.2, fDisp(H * 0.17), C.a3, 'left', 0);
    text(g, 'BEATS / MIN', W * 0.93, H * 0.17, fMono(H * 0.045, 700), C.lt, 'right', 1);
    const r = W * 0.36, cx = W / 2, cy = H * 0.6;
    disc(g, cx, cy, r * 1.08, C.a3);
    win(cx - r, cy - r, 2 * r, 2 * r, 0.25, (g2, w, h, st) => {
      g2.drawImage(st.bgCanvas, 0, 0);
      const R = w / 2;
      disc(g2, R, R, R, C.lt);
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * TAU, l = i % 5 ? 0.06 : 0.14;
        g2.strokeStyle = C.dk; g2.lineWidth = i % 5 ? R * 0.015 : R * 0.035;
        g2.beginPath(); g2.moveTo(R + Math.sin(a) * R * 0.92, R - Math.cos(a) * R * 0.92); g2.lineTo(R + Math.sin(a) * R * (0.92 - l), R - Math.cos(a) * R * (0.92 - l)); g2.stroke();
      }
      g2.fillStyle = C.a1; g2.beginPath(); g2.moveTo(R, R); g2.arc(R, R, R * 0.7, -Math.PI / 2, -Math.PI / 2 + st.sweep % TAU); g2.closePath(); g2.globalAlpha = 0.25; g2.fill(); g2.globalAlpha = 1;
      const a = st.sweep;
      g2.strokeStyle = C.a1; g2.lineWidth = R * 0.05; g2.lineCap = 'round';
      g2.beginPath(); g2.moveTo(R - Math.sin(a) * R * 0.15, R + Math.cos(a) * R * 0.15); g2.lineTo(R + Math.sin(a) * R * 0.82, R - Math.cos(a) * R * 0.82); g2.stroke(); g2.lineCap = 'butt';
      disc(g2, R, R, R * 0.07, C.dk);
    });
  });
  D('B', 1, (g, W, H, C) => { // carton side
    rect(g, 0, 0, W, H, C.kr);
    rect(g, W * 0.08, H * 0.08, W * 0.84, H * 0.5, C.lt);
    text(g, 'CONTENTS', W * 0.13, H * 0.18, fMono(H * 0.05, 700), C.fg, 'left', 2);
    const lines = ['1 × LOW END', '2 × MID RANGE', '4 × HIGH HAT', '∞ × GROOVE'];
    lines.forEach((l, i) => text(g, l, W * 0.13, H * (0.28 + i * 0.08), fMono(H * 0.055, 400), C.fg, 'left', 0));
    picto(g, 0, W * 0.1, H * 0.64, H * 0.28, C.fg);
    picto(g, 1, W * 0.38, H * 0.64, H * 0.28, C.fg);
    roundel(g, W * 0.8, H * 0.78, H * 0.14, C.a1, C.kr);
  });
  D('B', 2, (g, W, H, C) => { // carton top: tape
    rect(g, 0, 0, W, H, C.kr);
    rect(g, W * 0.38, 0, W * 0.24, H, C.a2);
    g.save(); g.translate(W * 0.5, H * 0.5); g.rotate(-Math.PI / 2);
    text(g, 'OKTAVO  OKTAVO  OKTAVO', 0, H * 0.035, fDisp(W * 0.1), C.lt, 'center', 2, H * 0.94); g.restore();
  });

  // Drums (wraps repeat twice around)
  D('D', 0, (g, W, H, C, win) => { // KICK POWDER
    rect(g, 0, 0, W, H, C.a1);
    for (const y of [0.06, 0.9]) rect(g, 0, H * y, W, H * 0.04, C.dk);
    rect(g, W * 0.1, H * 0.2, W * 0.8, H * 0.4, C.lt);
    text(g, 'KICK POWDER', W * 0.5, H * 0.42, fDisp(H * 0.15), C.a1, 'center', 1, W * 0.74);
    text(g, 'OKTAVO · 55 GAL · HANDLE ON THE ONE', W * 0.5, H * 0.54, fMono(H * 0.04, 700), C.fg, 'center', 1, W * 0.74);
    rect(g, 0, H * 0.66, W, H * 0.18, C.dk);
    win(0, H * 0.68, W, H * 0.14, 0.5, (g2, w, h, st) => chevrons(g2, w, h, -st.scroll * 0.7, C.a3, C.dk, -1));
  });
  D('D', 0, (g, W, H, C) => { // LOW END
    rect(g, 0, 0, W, H, C.a2);
    for (const y of [0.1, 0.5, 0.86]) rect(g, 0, H * y, W, H * 0.035, C.dk);
    roundel(g, W * 0.2, H * 0.32, H * 0.15, C.lt, C.a2);
    text(g, 'LOW END', W * 0.34, H * 0.4, fDisp(H * 0.17), C.lt, 'left', 1, W * 0.56);
    for (let i = 0; i < 6; i++) picto(g, 3, W * (0.1 + i * 0.14), H * 0.6, H * 0.2, i % 2 ? C.a3 : C.lt);
  });
  D('D', 0, (g, W, H, C, win) => { // checker band
    rect(g, 0, 0, W, H, C.gr);
    rect(g, 0, H * 0.08, W, H * 0.035, C.fg); rect(g, 0, H * 0.88, W, H * 0.035, C.fg);
    g.font = fDisp(H * 0.3);
    const sw = g.measureText('SUB ').width;
    text(g, 'SUB', W * 0.08, H * 0.46, fDisp(H * 0.3), C.fg, 'left', 0);
    text(g, 'OIL', W * 0.08 + sw, H * 0.46, fDisp(H * 0.3), C.a1, 'left', 0);
    text(g, 'VISCOSITY 40 HZ', W * 0.9, H * 0.54, fMono(H * 0.045, 700), C.fg, 'right', 1);
    win(0, H * 0.6, W, H * 0.2, 0.8, (g2, w, h, st) => checks(g2, w, h, st.scroll * 0.5, C.fg, C.gr));
  });
  D('D', 2, (g, W, H, C) => { // drum lid
    disc(g, W / 2, H / 2, W * 0.5, C.dk);
    for (let i = 0; i < 3; i++) ring(g, W / 2, H / 2, W * (0.46 - i * 0.03), W * 0.008, 'rgba(255,255,255,0.18)');
    disc(g, W * 0.3, H * 0.3, W * 0.07, C.a3); disc(g, W * 0.3, H * 0.3, W * 0.035, C.dk);
    disc(g, W * 0.72, H * 0.66, W * 0.045, C.a3);
    roundel(g, W * 0.55, H * 0.42, W * 0.12, C.lt, C.dk);
  });
  // Tins
  D('T', 0, (g, W, H, C, win) => { // HI-HAT OIL
    rect(g, 0, 0, W, H, C.a3);
    rect(g, 0, 0, W, H * 0.12, C.fg); rect(g, 0, H * 0.88, W, H * 0.12, C.fg);
    text(g, 'HI-HAT OIL', W * 0.06, H * 0.52, fDisp(H * 0.26), C.fg, 'left', 1, W * 0.6);
    text(g, 'FOR BRIGHT TOPS', W * 0.06, H * 0.72, fMono(H * 0.1, 700), C.fg, 'left', 1);
    win(W * 0.7, H * 0.18, W * 0.26, H * 0.64, 0.6, (g2, w, h, st) => {
      rect(g2, 0, 0, w, h, C.fg);
      for (let i = 0; i < 8; i++) disc(g2, w * (0.12 + (i % 4) * 0.25), h * (0.3 + Math.floor(i / 4) * 0.4), h * 0.1, st.sparkle[i] > 0.5 ? C.lt : 'rgba(255,255,255,0.15)');
    });
  });
  D('T', 0, (g, W, H, C) => { // TREBLE TINS
    rect(g, 0, 0, W, H, C.dk);
    hatch(g, 0, 0, W, H * 0.16, 16, C.a1, C.dk);
    hatch(g, 0, H * 0.84, W, H * 0.16, 16, C.a1, C.dk, true);
    text(g, 'TREBLE', W * 0.06, H * 0.62, fDisp(H * 0.34), C.lt, 'left', 1);
    roundel(g, W * 0.82, H * 0.5, H * 0.24, C.a1, C.dk);
  });
  D('T', 0, (g, W, H, C, win) => { // SNARE WAX
    rect(g, 0, 0, W, H, C.a2);
    stripes3(g, 0, 0, W, H * 0.2, [C.lt, C.a3, C.lt]);
    text(g, 'SNARE WAX', W * 0.06, H * 0.64, fDisp(H * 0.28), C.lt, 'left', 1, W * 0.62);
    rect(g, W * 0.72, H * 0.28, H * 0.56, H * 0.56, C.lt);
    win(W * 0.72 + H * 0.04, H * 0.32, H * 0.48, H * 0.48, 0, (g2, w, h, st, wn) => flipCard(g2, w, h, st, wn, C.a2, C.lt), { picto: 9 });
    text(g, 'NET 4 BARS', W * 0.06, H * 0.84, fMono(H * 0.09, 700), C.lt, 'left', 1);
  });
  D('T', 2, (g, W, H, C) => { // tin lid
    disc(g, W / 2, H / 2, W * 0.5, '#a7a39b');
    disc(g, W / 2, H / 2, W * 0.46, '#c9c5bc');
    ring(g, W / 2, H / 2, W * 0.4, W * 0.02, '#a7a39b');
    roundel(g, W / 2, H / 2, W * 0.22, C.fg, '#c9c5bc');
  });

  // A pictogram card that turns over on the snare (scaleX through zero).
  function flipCard(g, w, h, st, wn, ink, bg) {
    rect(g, 0, 0, w, h, bg);
    let ph = 1;
    if (wn.flipT0 !== undefined) ph = clamp01((st.t - wn.flipT0) / 0.32);
    const shown = ph < 0.5 ? wn.pictoFrom : wn.picto;
    const sx = Math.abs(Math.cos(ph * Math.PI));
    g.save(); g.translate(w / 2, h / 2); g.scale(Math.max(sx, 0.02), 1);
    rect(g, -w * 0.46, -h * 0.46, w * 0.92, h * 0.92, ph < 1 && ph > 0 ? ink : bg);
    picto(g, shown, -w * 0.38, -h * 0.38, w * 0.76, ph < 1 && ph > 0 ? bg : ink);
    g.restore();
  }

  const BY = {};
  DESIGNS.forEach((d, i) => { d.layer = i; const k = d.kind + d.face; (BY[k] = BY[k] || []).push(i); });
  const NL = DESIGNS.length;
  const LS = 512;
  DESIGNS.forEach((d) => {
    const [fw, fh] = faceDims(KINDS[d.kind], d.face);
    const a = fw / fh;
    d.W = a >= 1 ? LS : Math.round(LS * a);
    d.H = a >= 1 ? Math.round(LS / a) : LS;
  });

  // ---- shaders --------------------------------------------------------------
  const OBJ_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aN;
layout(location = 2) in vec2 aUV;
layout(location = 3) in float aKind;
uniform mat4 uVP, uM;
uniform float uYaw;
out vec3 vP; out vec3 vN; out vec3 vL; out vec2 vUV; flat out int vKind;
void main() {
  vec4 w = uM * vec4(aPos, 1.0);
  vP = w.xyz;
  float c = cos(uYaw), s = sin(uYaw);
  vN = vec3(c * aN.x + s * aN.z, aN.y, -s * aN.x + c * aN.z);
  vL = aPos; vUV = aUV; vKind = int(aKind + 0.5);
  gl_Position = uVP * w;
}`;
  const OBJ_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 vP; in vec3 vN; in vec3 vL; in vec2 vUV; flat in int vKind;
uniform sampler2DArray uTex;
uniform sampler2D uDyn;
uniform vec4 uWinR[4]; // animated windows on face 0: rect in face uv
uniform vec4 uWinA[4]; // and where each lives in the dynamic atlas
uniform int uWinN;
uniform vec3 uLayer;
uniform vec2 uUVS[3];
uniform vec2 uFace[3];
uniform vec4 uCone;   // uv centre, radius in face widths, pump
uniform vec4 uLamp;   // uv centre, radius in face widths, glow
uniform vec3 uLampC;
uniform vec3 uSize;
uniform float uTopAO, uCyl;
uniform vec3 uCam, uKeyPos, uKey, uSky, uGnd, uFog;
uniform vec2 uFogR;
out vec4 o;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  int k = vKind;
  float layer = k == 0 ? uLayer.x : (k == 1 ? uLayer.y : uLayer.z);
  vec2 sc = k == 0 ? uUVS[0] : (k == 1 ? uUVS[1] : uUVS[2]);
  vec2 fs = k == 0 ? uFace[0] : (k == 1 ? uFace[1] : uFace[2]);
  vec2 fu = vec2(fract(vUV.x), vUV.y);
  float asp = fs.y / fs.x;
  float coneLit = 0.0;
  if (k == 0 && uCone.w > 0.001) {
    vec2 d = (fu - uCone.xy) * vec2(1.0, asp);
    float r = length(d) / uCone.z;
    if (r < 1.0) {
      // the cone pushes out: its middle swells toward the viewer
      float m = 1.0 - uCone.w * 0.34 * (1.0 - r * r);
      fu = uCone.xy + (fu - uCone.xy) * m;
      // and tilts its upper-left slope into the key light
      vec2 dn = d / max(length(d), 1e-4);
      coneLit = uCone.w * (0.35 + 0.65 * max(dot(dn, vec2(-0.6, -0.8)), 0.0)) * (1.0 - r * 0.6);
    }
    // the rubber surround catches a highlight as it stretches
    coneLit += uCone.w * 0.9 * exp(-pow((r - 1.07) / 0.05, 2.0));
  }
  vec2 gd = vUV * sc;
  vec3 alb;
  int wi = -1;
  if (k == 0) for (int i = 0; i < 4; i++) {
    if (i >= uWinN) break;
    vec4 r = uWinR[i];
    if (fu.x >= r.x && fu.y >= r.y && fu.x < r.x + r.z && fu.y < r.y + r.w) { wi = i; break; }
  }
  if (wi >= 0) {
    vec4 r = uWinR[wi], a = uWinA[wi];
    vec2 s2 = a.zw / r.zw;
    alb = lin(textureGrad(uDyn, a.xy + (fu - r.xy) * s2, dFdx(vUV) * s2, dFdy(vUV) * s2).rgb);
  } else {
    alb = lin(textureGrad(uTex, vec3(fu * sc, layer), dFdx(gd), dFdy(gd)).rgb);
  }
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vP);
  vec3 Lv = uKeyPos - vP; float ld = length(Lv); vec3 L = Lv / ld;
  float nl = dot(N, L);
  float dif = max(nl, 0.0), wrap = max((nl + 0.45) / 1.45, 0.0);
  float att = 1.0 / (1.0 + ld * ld * 0.0035);
  vec3 hemi = mix(lin(uGnd), lin(uSky), N.y * 0.5 + 0.5);
  float hy = vL.y * uSize.y;
  float side = 1.0 - abs(N.y);
  float ao = 1.0 - 0.45 * exp(-hy / 0.08) * side;
  ao *= 1.0 - 0.3 * exp(-(uSize.y - hy) / 0.07) * side * uTopAO;
  vec2 e = min(fu, 1.0 - fu) * fs;
  float edge = uCyl > 0.5 && k == 0 ? e.y : min(e.x, e.y);
  ao *= 1.0 - 0.14 * exp(-edge / 0.02);
  vec3 key = lin(uKey);
  vec3 col = alb * (hemi * 0.52 * ao + key * (0.72 * dif + 0.16 * wrap) * att * mix(0.7, 1.0, ao));
  vec3 H = normalize(L + V);
  col += key * 0.045 * pow(max(dot(N, H), 0.0), 28.0) * att * ao;
  col += (alb * 0.6 + lin(uSky) * 0.12) * coneLit;
  if (k == 0 && uLamp.w > 0.001) {
    float r = length((fu - uLamp.xy) * vec2(1.0, asp)) / uLamp.z;
    vec3 lc = lin(uLampC);
    col = mix(col, lc * 1.25, uLamp.w * (1.0 - smoothstep(0.75, 1.0, r)));
    col += lc * uLamp.w * 0.5 * exp(-max(r - 1.0, 0.0) * 0.9) * step(1.0, r);
  }
  float dist = length(uCam - vP);
  col = mix(col, lin(uFog), smoothstep(uFogR.x, uFogR.y, dist) * 0.8);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;
  const FLOOR_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aXZ;
uniform mat4 uVP;
uniform vec4 uRect; // x0 z0 x1 z1
out vec3 vP;
void main() {
  vec3 p = vec3(mix(uRect.x, uRect.z, aXZ.x), 0.0, mix(uRect.y, uRect.w, aXZ.y));
  vP = p; gl_Position = uVP * vec4(p, 1.0);
}`;
  const FLOOR_FS = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec3 uCam, uKeyPos, uKey, uFloor, uSky;
uniform vec2 uFogR;
out vec4 o;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  vec3 Lv = uKeyPos - vP; float ld = length(Lv);
  float dif = max(Lv.y / ld, 0.0);
  float att = 1.0 / (1.0 + ld * ld * 0.0035);
  vec3 col = lin(uFloor) * (lin(uSky) * 0.45 + lin(uKey) * dif * 0.75 * att);
  float a = 1.0 - smoothstep(uFogR.x, uFogR.y, length(uCam - vP));
  o = vec4(pow(col, vec3(1.0 / 2.2)) * a, a);
}`;
  const DECAL_FS = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec4 uBox;    // centre xz, half extents
uniform vec3 uSh;     // shadow direction xz * length, strength
uniform float uShade;
out vec4 o;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec2 p = vP.xz - uBox.xy;
  float d0 = sdBox(p, uBox.zw);
  float ao = exp(-max(d0, 0.0) / 0.14) * 0.55 + exp(-max(d0, 0.0) / 0.5) * 0.18;
  float csh = 0.0;
  for (int i = 1; i <= 8; i++) {
    float s = float(i) / 8.0;
    float pen = 0.06 + 0.5 * s;
    float d = sdBox(p - uSh.xy * s, uBox.zw);
    csh = max(csh, (1.0 - smoothstep(-pen, pen, d)) * (1.0 - 0.65 * s));
  }
  float k = 1.0 - uShade * clamp(max(ao, csh * uSh.z), 0.0, 0.85);
  o = vec4(k, k, k, 1.0);
}`;

  // ---- matrices -------------------------------------------------------------
  function viewProj(eye, tgt, aspect, fovY, out) {
    let f = [tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]];
    const fl = Math.hypot(...f); f = f.map((x) => x / fl);
    let s = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0];
    const sl = Math.hypot(...s); s = s.map((x) => x / sl);
    const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const V = [s[0], s[1], s[2], -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]),
      u[0], u[1], u[2], -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
      -f[0], -f[1], -f[2], (f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2]),
      0, 0, 0, 1];
    const n = 0.25, fa = 80, t = 1 / Math.tan(fovY / 2);
    const P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), 2 * fa * n / (n - fa), 0, 0, -1, 0];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      let x = 0;
      for (let k = 0; k < 4; k++) x += P[r * 4 + k] * V[k * 4 + c];
      out[c * 4 + r] = x;
    }
    return out;
  }

  // ---- stacks ---------------------------------------------------------------
  // Rows: 0 the main row, 1 a taller wall behind, 2 an occasional low stack
  // close to the lens for parallax.
  const ROWS = [
    { z: 0, pitch: 2.1, off: 0, min: 2, max: 3, kinds: 'SSCCAABDDT', speaker: true },
    { z: -3.3, pitch: 1.75, off: 0.8, min: 2, max: 4, kinds: 'CCCBBAASDT' },
    { z: 2.5, pitch: 6.1, off: 2.2, min: 1, max: 2, kinds: 'BBTTA', sparse: 0.45 },
  ];
  function makeStack(r, k) {
    const R = ROWS[r];
    const rnd = (n) => h2(k * 31 + n, r * 977 + 17);
    if (R.sparse && rnd(0) > R.sparse) return null;
    const n = R.min + Math.floor(rnd(1) * (R.max - R.min + 1));
    const objs = [];
    for (let i = 0; i < n; i++) {
      let kind = R.kinds[Math.floor(rnd(10 + i) * R.kinds.length)];
      if (R.speaker && k % 2 === 0 && i === (rnd(5) < 0.6 ? 0 : 1)) kind = 'S';
      if (i > 0 && (kind === 'S' || kind === 'D') && objs[i - 1].kind === 'T') kind = 'B';
      const K = KINDS[kind];
      const pick = (face) => { const L = BY[kind + face] || BY[kind + (face === 1 ? 0 : face)]; return L[Math.floor(rnd(20 + i * 3 + face) * L.length)]; };
      let q = 0;
      const qr = rnd(40 + i);
      if (kind !== 'S' && K.shape === 'box') q = r === 0 ? (qr < 0.78 ? 0 : qr < 0.89 ? 1 : 3) : (qr < 0.55 ? 0 : qr < 0.8 ? 1 : 3);
      objs.push({ kind, K, L: [pick(0), K.shape === 'cyl' ? pick(0) : pick(1), pick(2)],
        q, yawJ: (rnd(50 + i) - 0.5) * 0.14 + (K.shape === 'cyl' ? rnd(60 + i) * TAU : 0),
        jx: (rnd(70 + i) - 0.5) * 0.14, jz: (rnd(80 + i) - 0.5) * 0.14,
        y: 0, zo: 0, yaw: 0, spin: 0 });
    }
    const st = { r, k, x: k * R.pitch + R.off + (rnd(90) - 0.5) * 0.3, z: R.z + (rnd(91) - 0.5) * 0.4, objs, order: objs.map((_, i) => i), anim: null };
    settle(st);
    return st;
  }
  function stackYs(st, order) {
    const ys = new Array(st.objs.length);
    let y = 0;
    for (const i of order) { ys[i] = y; y += st.objs[i].K.h; }
    return ys;
  }
  function settle(st) {
    const ys = stackYs(st, st.order);
    st.objs.forEach((o, i) => { o.y = ys[i]; o.zo = 0; o.yaw = o.q * Math.PI / 2 + o.yawJ; });
  }
  // Pull one box out of the stack, let the rest settle, put it back on top.
  function shuffle(st, t, dur, turn) {
    if (st.anim || st.objs.length < 2) return false;
    const n = st.objs.length;
    const pos = Math.floor(hash(st.k * 3.1 + t * 7.7) * (n - 1));
    const mover = st.order[pos];
    const order = st.order.filter((i) => i !== mover).concat([mover]);
    const o = st.objs[mover];
    const q0 = o.q;
    if (turn && o.K.shape === 'box' && o.kind !== 'S') o.q = (o.q + (hash(t * 3.3 + st.k) < 0.5 ? 1 : 3)) % 4;
    else if (o.kind === 'S' && turn) o.q = (o.q + 2) % 4;
    let depth = 0;
    for (const b of st.objs) if (b !== o) depth = Math.max(depth, b.K.shape === 'cyl' ? b.K.w : Math.max(b.K.w, b.K.d));
    st.anim = { t0: t, dur, mover, y0: stackYs(st, st.order), y1: stackYs(st, order), q0, spin0: o.spin,
      out: depth * 0.5 + (o.K.shape === 'cyl' ? o.K.w : Math.max(o.K.w, o.K.d)) * 0.5 + 0.12 };
    st.order = order;
    return true;
  }
  function animate(st, t) {
    const A = st.anim;
    if (!A) return;
    const u = clamp01((t - A.t0) / A.dur);
    st.objs.forEach((o, i) => {
      const y0 = A.y0[i], y1 = A.y1[i];
      if (i === A.mover) {
        const outU = ease(clamp01(u / 0.26)), inU = ease(clamp01((u - 0.74) / 0.26));
        o.zo = A.out * (outU - inU);
        o.y = lerp(y0, y1, ease(clamp01((u - 0.3) / 0.42))) + Math.sin(Math.PI * clamp01((u - 0.3) / 0.42)) * 0.1;
        const yu = ease(clamp01((u - 0.3) / 0.42));
        let dq = o.q - A.q0; if (dq === 3) dq = -1; if (dq === -3) dq = 1;
        o.yaw = (A.q0 + dq * yu) * Math.PI / 2 + o.yawJ;
        if (o.K.shape === 'cyl') o.yaw += yu * Math.PI;
      } else {
        const fu = clamp01((u - 0.28) / 0.26);
        const bounce = fu >= 1 ? Math.max(0, Math.sin(Math.PI * clamp01((u - 0.54) / 0.12))) * 0.03 * (y0 > y1 ? 1 : 0) : 0;
        o.y = lerp(y0, y1, fu * fu) + bounce;
        o.zo = 0;
      }
    });
    if (u >= 1) {
      const m = st.objs[A.mover];
      if (m.K.shape === 'cyl') m.yawJ += Math.PI;
      st.anim = null; settle(st);
    }
  }

  // ---- presets / params -----------------------------------------------------
  const PRESETS = {
    calm: { travel: 0.45, alive: 0.35, shuffle: 0.12, sweep: 0.2 },
    drop: { travel: 0.9, alive: 1, shuffle: 0.75, sweep: 0.85 },
  };
  const DRIVE = ['travel', 'alive', 'shuffle', 'sweep'];

  VIZ.register({
    id: 'graphicobjects',
    name: 'Supply Depot',
    order: 833,
    gallery: {
      title: 'Supply Depot',
      technique: 'Raw WebGL2: box and cylinder meshes drawn per object, faces sampling a 512px texture array painted with Canvas 2D from one invented design system (Archivo Black and Space Mono, a roundel, stripes, hatching, grilles, twelve pictograms, five inks per colourway). The moving parts of each design are small canvas windows re-uploaded with texSubImage3D only while they animate. Hemisphere fill plus a point key light that travels with the dolly, contact darkening at every object\'s foot and under whatever sits on it, soft edge darkening, and floor decals that multiply in occlusion and a penumbral cast shadow per stack. The kick\'s cone pump is a per-object radial magnification in the fragment shader.',
      brief: 'The stock room of OKTAVO Sound Supply, an invented maker of audio goods, drifting past on a slow dolly: stacks of speaker cabinets, crates, amp boxes, cartons, drums and tins, every face printed as packaging from one design system, with a taller wall of stock behind and the odd low stack sliding past close to the lens. The graphics are instruments: VU needles swing and knobs turn with the bass, tuning cursors slide, LED ladders flicker with the hats, chevron and checker bands scroll, a porthole of stripes spins. The kick pumps the cone of one speaker, the one nearest the middle of the view, and lights its ON AIR lamp; the snare turns one pictogram card over. In the drop every window comes alive, a wave of re-stacking runs down the row (a box slides out, the stack settles, the box turns and goes back on top) and keeps going on the bars, and the camera sweeps wider and lower. The breakdown lets most of the dials rest.',
      lineage: 'The speaker-box city in the LEXSAN set (docs/research/2026-09-28-lexsan-takeaways.md, scene 1), which Raph singled out for "the graphic designs on the cubes"; taken as a principle, objects that wear designed graphics, rather than a look. Descends from Braun and Dieter Rams\'s instrument faces, Otl Aicher\'s pictograms, Swiss packaging systems, shipping-crate stencils and hazard marks, and the product-shot still lifes of hi-fi catalogues.',
    },
    params: [
      { key: 'colorway', label: 'Colourway', type: 'select', options: COLORWAYS.map((c) => c.name), default: 0 },
      { key: 'travel', label: 'Dolly speed', type: 'range', min: 0, max: 2, step: 0.01, default: PRESETS.calm.travel },
      { key: 'alive', label: 'Faces alive', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.alive },
      { key: 'shuffle', label: 'Re-stacking', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.shuffle },
      { key: 'sweep', label: 'Camera sweep', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.sweep },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.kickCount = 0; this.kickAmp = 0;
      this.lastSnare = -10; this.snareCount = 0;
      this.lastHat = -10; this.hatCount = 0;
      this.bassEnv = 0; this.midEnv = 0; this.hatEnv = 0; this.low = 0;
      this.dropOn = false; this.auto = 0;
      this.camX = 0; this.camT = 0;
      this.stacks = new Map();
      this.hero = null;
      this.waves = [];
      this.S = { t: 0, bass: 0, vu: 0, vu2: 0, vuV: 0, vu2V: 0, hat: 0, knob1: 0.3, knob2: 0.6, knob3: 0.5, tune: 0.4, scroll: 0, spin: 0, sweep: 0,
        bars: [0, 0, 0, 0, 0], sparkle: new Float32Array(8) };
      this.nextShuffle = 0;
    },

    initGL() {
      this.glCanvas = document.createElement('canvas');
      const gl = this.glCanvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
      if (!gl) { this.glFailed = true; return; }
      this.gl = gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const U = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(pr, nm); }
        return { pr, U };
      };
      this.objP = link(OBJ_VS, OBJ_FS);
      this.floorP = link(FLOOR_VS, FLOOR_FS);
      this.decalP = link(FLOOR_VS, DECAL_FS);

      const mesh = (data) => {
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        const st = 9 * 4;
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, st, 24);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, 32);
        gl.bindVertexArray(null);
        return { vao, n: data.length / 9 };
      };
      // box: bottom at y = 0; uv (0,0) top-left of each face as seen from outside
      const E = 0.0015, B = [];
      const quad = (p, n, kind) => {
        const uv = [[E, E], [1 - E, E], [1 - E, 1 - E], [E, 1 - E]];
        for (const i of [0, 1, 2, 0, 2, 3]) B.push(...p[i], ...n, ...uv[i], kind);
      };
      quad([[-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]], [0, 0, 1], 0);
      quad([[0.5, 1, -0.5], [-0.5, 1, -0.5], [-0.5, 0, -0.5], [0.5, 0, -0.5]], [0, 0, -1], 0);
      quad([[0.5, 1, 0.5], [0.5, 1, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5]], [1, 0, 0], 1);
      quad([[-0.5, 1, -0.5], [-0.5, 1, 0.5], [-0.5, 0, 0.5], [-0.5, 0, -0.5]], [-1, 0, 0], 1);
      quad([[-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]], [0, 1, 0], 2);
      this.box = mesh(B);
      const C = [], SEG = 56;
      for (let j = 0; j < SEG; j++) {
        const a0 = j / SEG * TAU, a1 = (j + 1) / SEG * TAU;
        const P = (a, y) => [0.5 * Math.sin(a), y, 0.5 * Math.cos(a)];
        const Nn = (a) => [Math.sin(a), 0, Math.cos(a)];
        const u0 = j / SEG * 2, u1 = (j + 1) / SEG * 2;
        const vs = [[a0, 1, u0, E], [a1, 1, u1, E], [a1, 0, u1, 1 - E], [a0, 1, u0, E], [a1, 0, u1, 1 - E], [a0, 0, u0, 1 - E]];
        for (const [a, y, u, v] of vs) C.push(...P(a, y), ...Nn(a), u, v, 0);
        for (const q of [[0, 1, 0], P(a0, 1), P(a1, 1)]) C.push(...q, 0, 1, 0, q[0] + 0.5, q[2] + 0.5, 2);
      }
      this.cyl = mesh(C);
      // floor quad
      this.quadVao = gl.createVertexArray(); gl.bindVertexArray(this.quadVao);
      const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);

      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(LS) + 1, gl.RGBA8, LS, LS, NL);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const an = gl.getExtension('EXT_texture_filter_anisotropic');
      if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.dyn = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.dyn);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      this.dynReady = false;
      this.painted = -1;
    },

    // Paint every design's static art and register its windows.
    paint(ci) {
      const gl = this.gl, C = COLORWAYS[ci];
      this.C = C;
      this.windows = [];
      this.pictoWins = [];
      const cv = this.statCv || (this.statCv = document.createElement('canvas'));
      cv.width = LS; cv.height = LS;
      const g = cv.getContext('2d');
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      DESIGNS.forEach((d, li) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, LS, LS);
        g.fillStyle = C.gr; g.fillRect(0, 0, LS, LS);
        const wins = [];
        const win = (x, y, w, h, rank, fn, opts) => wins.push(Object.assign({ x: Math.max(0, Math.floor(x)), y: Math.max(0, Math.floor(y)), w: Math.ceil(w), h: Math.ceil(h), rank, fn, d }, opts || {}));
        g.save(); d.draw(g, d.W, d.H, C, win, d); g.restore();
        // bleed the region's edge into the rest of the layer so mips don't pull in stray colour
        if (d.W < LS) g.drawImage(cv, d.W - 1, 0, 1, d.H, d.W, 0, LS - d.W, d.H);
        if (d.H < LS) g.drawImage(cv, 0, d.H - 1, LS, 1, 0, d.H, LS, LS - d.H);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, li, LS, LS, 1, gl.RGBA, gl.UNSIGNED_BYTE, cv);
        d.wins = [];
        for (const wn of wins.slice(0, 4)) {
          wn.w = Math.min(wn.w, d.W - wn.x); wn.h = Math.min(wn.h, d.H - wn.y);
          wn.bg = document.createElement('canvas'); wn.bg.width = wn.w; wn.bg.height = wn.h;
          wn.bg.getContext('2d').drawImage(cv, wn.x, wn.y, wn.w, wn.h, 0, 0, wn.w, wn.h);
          if (wn.picto !== undefined) { wn.pictoFrom = wn.picto; this.pictoWins.push(wn); }
          wn.fresh = true;
          d.wins.push(wn);
          this.windows.push(wn);
        }
      });
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      // Every animated window lives in one small atlas, uploaded once a frame:
      // twenty-odd uploads into the array plus regenerating its whole mip chain
      // held the drop to ~32 fps at 3024x1890 (2026-09-28).
      const P = 4, AW = 1024;
      let x = 0, y = 0, rowH = 0;
      for (const wn of [...this.windows].sort((a, b) => b.h - a.h)) {
        if (x + wn.w + 2 * P > AW) { x = 0; y += rowH; rowH = 0; }
        wn.ax = x + P; wn.ay = y + P;
        x += wn.w + 2 * P; rowH = Math.max(rowH, wn.h + 2 * P);
      }
      let AH = 64; while (AH < y + rowH) AH *= 2;
      const at = this.atlas || (this.atlas = document.createElement('canvas'));
      at.width = AW; at.height = AH;
      this.atlasG = at.getContext('2d');
      for (const d of DESIGNS) {
        d.winR = new Float32Array(16); d.winA = new Float32Array(16);
        d.wins.forEach((wn, i) => {
          d.winR.set([wn.x / d.W, wn.y / d.H, wn.w / d.W, wn.h / d.H], i * 4);
          d.winA.set([wn.ax / AW, wn.ay / AH, wn.w / AW, wn.h / AH], i * 4);
        });
      }
      this.painted = ci;
      this.paintedFonts = fontsReady();
    },

    updateWindows(t, alive) {
      const gl = this.gl, S = this.S, g = this.atlasG;
      S.t = t;
      let n = 0;
      for (const wn of this.windows) {
        const flipping = wn.flipT0 !== undefined && t - wn.flipT0 < 0.4;
        const on = wn.rank <= alive + 1e-4 || flipping;
        if (!on && !wn.fresh) continue;
        g.setTransform(1, 0, 0, 1, wn.ax, wn.ay);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (wn.fresh) g.drawImage(wn.bg, -4, -4, wn.w + 8, wn.h + 8);
        g.save(); g.beginPath(); g.rect(0, 0, wn.w, wn.h); g.clip();
        g.drawImage(wn.bg, 0, 0);
        S.bgCanvas = wn.bg;
        wn.fn(g, wn.w, wn.h, S, wn);
        g.restore();
        wn.fresh = false;
        n++;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (n || !this.dynReady) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.dyn);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.activeTexture(gl.TEXTURE0);
        this.dynReady = true;
      }
      return n;
    },

    listen(s, t, dt, react) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      const ev = {};
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++; this.kickAmp = clamp(b0 / 85, 0.55, 1); ev.kick = true;
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) { this.lastSnare = t; this.snareCount++; ev.snare = true; }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) { this.lastHat = t; this.hatCount++; ev.hat = true; }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.5, s[1], s[2] * 0.85) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.35));
      const mid = (s[3] + s[4] + s[5]) / 300;
      this.midEnv += (mid - this.midEnv) * (mid > this.midEnv ? k(0.05) : k(0.25));
      const hi = (s[6] + s[7] + s[8]) / 300;
      this.hatEnv += (hi - this.hatEnv) * (hi > this.hatEnv ? k(0.02) : k(0.12));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.7);
      const was = this.dropOn;
      const kicking = t - this.lastKick < 0.9;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.22 || t - this.lastKick > 1.6)) this.dropOn = false;
      ev.dropStart = this.dropOn && !was;
      this.auto += ((this.dropOn ? 1 : 0) - this.auto) * k(this.dropOn ? 1.0 : 2.8);
      return ev;
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.stacks) this.reset();
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const react = params.react;
      const ev = this.listen(signals, t, dt, react);
      const follow = Math.round(params.follow) === 1;
      const Q = {};
      for (const key of DRIVE) Q[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? this.auto : 0);
      const ci = clamp(Math.round(params.colorway) || 0, 0, COLORWAYS.length - 1);
      const C = COLORWAYS[ci];

      g.save();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, C.roomTop); bg.addColorStop(0.62, C.roomLow); bg.addColorStop(1, C.roomLow);
      g.fillStyle = bg; g.fillRect(-2, -2, W + 4, H + 4);
      const pool = g.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, Math.max(W, H) * 0.6);
      pool.addColorStop(0, 'rgba(255,248,236,' + (C === COLORWAYS[1] ? 0.1 : 0.35) + ')'); pool.addColorStop(1, 'rgba(255,248,236,0)');
      g.fillStyle = pool; g.fillRect(-2, -2, W + 4, H + 4);

      if (!this.gl && !this.glFailed) { try { this.initGL(); } catch (e) { this.glFailed = true; console.error(e); } }
      if (this.glFailed) {
        g.fillStyle = '#a33'; g.font = '20px sans-serif'; g.textAlign = 'center';
        g.fillText('WebGL2 unavailable', W / 2, H / 2); g.restore(); return;
      }
      const gl = this.gl;
      if (this.painted !== ci || (!this.paintedFonts && p.frameCount % 20 === 0 && fontsReady())) this.paint(ci);

      // ---- instruments --------------------------------------------------------
      const S = this.S, R = clamp(react, 0, 2);
      const spring = (x, v, target, w, z) => { const a = w * w * (target - x) - 2 * z * w * v; v += a * dt; x += v * dt; return [x, v]; };
      [S.vu, S.vuV] = spring(S.vu, S.vuV, clamp01(0.08 + this.bassEnv * 0.95 * Math.min(R, 1.3)), 16, 0.45);
      [S.vu2, S.vu2V] = spring(S.vu2, S.vu2V, clamp01(0.06 + this.midEnv * 1.3 * Math.min(R, 1.3)), 14, 0.4);
      S.bass = clamp01(this.bassEnv * 1.1 * Math.min(R, 1.5));
      S.hat = clamp01(this.hatEnv * 1.6 * R);
      S.knob1 = 0.5 + 0.45 * Math.sin(this.camT * 0.4 + this.bassEnv * 2.5);
      S.knob2 = clamp01(0.2 + this.bassEnv * 0.9);
      S.knob3 = 0.5 + 0.4 * Math.sin(this.camT * 0.23 + 1);
      S.tune = 0.5 + 0.42 * Math.sin(this.camT * 0.21) * (0.6 + 0.4 * this.bassEnv) + 0.05 * Math.sin(t * 7) * this.bassEnv;
      S.scroll += dt * (18 + 190 * this.bassEnv * R);
      S.spin += dt * (0.25 + 3.2 * this.bassEnv * R);
      S.sweep += dt * (0.4 + 5 * this.bassEnv * R);
      const bands = [signals[0], signals[1] * 0.9 + signals[2] * 0.1, signals[3], signals[5], signals[7]];
      for (let i = 0; i < 5; i++) { const v = clamp01(bands[i] / 100 * R); S.bars[i] += (v - S.bars[i]) * (v > S.bars[i] ? 0.5 : 1 - Math.exp(-dt / 0.2)); }
      if (ev.hat) S.sparkle[this.hatCount % 8] = 1, S.sparkle[(this.hatCount * 5 + 3) % 8] = 1;
      for (let i = 0; i < 8; i++) S.sparkle[i] *= Math.exp(-dt / 0.12);

      // ---- camera -------------------------------------------------------------
      const sw = Q.sweep;
      this.camT += dt;
      this.camX += dt * (0.12 + 0.55 * Q.travel) * (1 + 0.25 * this.bassEnv * R);
      const aspect = W / H;
      const fov0 = 36 * Math.PI / 180;
      const fovY = aspect >= 1 ? fov0 : 2 * Math.atan(Math.tan(fov0 / 2) / aspect);
      const orbit = (0.1 + 0.42 * sw) * Math.sin(this.camT * 0.11 + 0.6);
      const dist = 8.2 - 1.3 * sw * (0.5 + 0.5 * Math.sin(this.camT * 0.083));
      const ht = 2.3 + (0.4 - 1.0 * sw) * (0.5 + 0.5 * Math.sin(this.camT * 0.067 + 2)) + 0.3 * sw;
      const tgt = [this.camX, 1.25 - 0.15 * sw, -0.6];
      const eye = [tgt[0] + Math.sin(orbit) * dist, ht, tgt[2] + Math.cos(orbit) * dist];
      this.vp = viewProj(eye, tgt, aspect, fovY, this.vp || new Float32Array(16));
      const VP = this.vp;
      const proj = (x, y, z) => { const cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; return [(VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / cw, (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / cw, cw]; };

      // ---- stacks: keep the ones in reach, drop the rest ----------------------
      const reach = 13;
      const live = new Set();
      ROWS.forEach((Rw, r) => {
        const k0 = Math.floor((this.camX - reach - Rw.off) / Rw.pitch), k1 = Math.ceil((this.camX + reach - Rw.off) / Rw.pitch);
        for (let k = k0; k <= k1; k++) {
          const key = r * 100000 + k;
          live.add(key);
          if (!this.stacks.has(key)) this.stacks.set(key, makeStack(r, k));
        }
      });
      for (const key of [...this.stacks.keys()]) if (!live.has(key)) this.stacks.delete(key);
      const visible = [];
      for (const st of this.stacks.values()) {
        if (!st) continue;
        const sp = proj(st.x, 1, st.z);
        st.sx = sp[0]; st.vis = sp[2] > 0 && Math.abs(sp[0]) < 1.05;
        if (st.vis && st.r < 2) visible.push(st);
      }
      // re-stacking: a wave down the row as the drop lands, then on the bars
      if (ev.dropStart && R > 0 && follow) {
        const row = visible.filter((s) => s.r === 0).sort((a, b) => a.sx - b.sx);
        row.forEach((st, i) => this.waves.push({ st, at: t + 0.12 + i * 0.22 }));
        visible.filter((s) => s.r === 1 && hash(s.k) < 0.5).forEach((st) => this.waves.push({ st, at: t + 0.4 + (st.sx + 1) * 0.6 }));
      }
      this.waves = this.waves.filter((w) => { if (t >= w.at) { shuffle(w.st, t, 1.0, true); return false; } return true; });
      const rate = 0.03 + 0.9 * Q.shuffle * Q.shuffle;
      if (t >= this.nextShuffle) {
        const cands = visible.filter((s) => !s.anim && Math.abs(s.sx) < 0.85);
        if (cands.length) shuffle(cands[Math.floor(hash(t * 1.7) * cands.length)], t, lerp(1.25, 0.9, Q.shuffle), hash(t * 2.3) < 0.7);
        this.nextShuffle = t + (0.6 + 1.4 * hash(t * 5.1)) / rate;
      }
      if (ev.kick && Q.shuffle > 0.4 && this.kickCount % 4 === 0) {
        const cands = visible.filter((s) => !s.anim && Math.abs(s.sx) < 0.9);
        if (cands.length) shuffle(cands[Math.floor(hash(this.kickCount * 0.37) * cands.length)], t, 0.9, true);
      }
      for (const st of this.stacks.values()) if (st) animate(st, t);
      // snare: turn over a pictogram card that is actually in view (front row
      // first), taking turns so it walks around the stock
      if (ev.snare && this.pictoWins.length && R > 0) {
        const seen = new Set();
        for (const st of visible) if (st.r === 0 && Math.abs(st.sx) < 0.8) for (const o of st.objs) if (o.q % 2 === 0) seen.add(o.L[0]);
        let pool = this.pictoWins.filter((w) => seen.has(w.d.layer));
        if (!pool.length) pool = this.pictoWins;
        const wn = pool[this.snareCount % pool.length];
        wn.pictoFrom = wn.picto; wn.picto = (wn.picto + 1 + Math.floor(hash(this.snareCount) * 4)) % PICTOS.length; wn.flipT0 = t;
      }

      // ---- hero speaker for the kick ------------------------------------------
      let hero = this.hero && this.stacks.get(this.hero.key) === this.hero.st ? this.hero : null;
      if (hero && Math.abs(hero.st.sx) > 0.45) hero = null;
      if (hero && (hero.o.q % 2) !== 0) hero = null;
      if (!hero) {
        let best = null, bd = 1e9;
        for (const [key, st] of this.stacks) {
          if (!st || st.r !== 0 || !st.vis) continue;
          for (const o of st.objs) {
            if (o.kind !== 'S' || o.q % 2 !== 0 || o.y > 2) continue;
            const d = Math.abs(st.sx) + o.y * 0.05;
            if (d < bd) { bd = d; best = { key, st, o }; }
          }
        }
        hero = best;
      }
      this.hero = hero;
      const ka = t - this.lastKick;
      const pump = R * this.kickAmp * (ka < 0.03 ? ka / 0.03 : Math.exp(-(ka - 0.03) / 0.13));
      const lampGlow = clamp01(R * this.kickAmp * Math.exp(-ka / 0.15));

      this.updateWindows(t, Q.alive);

      // ---- render -------------------------------------------------------------
      const pw = Math.round(p.width * p.pixelDensity()), ph = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE);
      const keyPos = [this.camX - 5.5, 8.5, 6.5];
      const fogR = [dist + 1.5, dist + 22];

      // floor
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      let U = this.floorP.U;
      gl.useProgram(this.floorP.pr);
      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform4f(U.uRect, this.camX - 60, -45, this.camX + 60, 14);
      gl.uniform3fv(U.uCam, eye); gl.uniform3fv(U.uKeyPos, keyPos); gl.uniform3fv(U.uKey, hex(C.key));
      gl.uniform3fv(U.uFloor, hex(C.floor)); gl.uniform3fv(U.uSky, hex(C.sky));
      gl.uniform2f(U.uFogR, fogR[0] + 4, fogR[1] + 10);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // floor shadows: multiply
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
      U = this.decalP.U;
      gl.useProgram(this.decalP.pr);
      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform1f(U.uShade, C.shade);
      const shDir = [keyPos[0] - this.camX, keyPos[2]]; // light sits up-left-front; shadows fall right and back
      const sl = Math.hypot(shDir[0], shDir[1]);
      for (const st of this.stacks.values()) {
        if (!st || !st.vis) continue;
        let hx = 0, hz = 0, top = 0;
        for (const o of st.objs) {
          if (o.y > 0.05) { top = Math.max(top, o.y + o.K.h); continue; }
          top = Math.max(top, o.K.h);
          if (o.K.shape === 'cyl') { hx = Math.max(hx, o.K.w / 2); hz = Math.max(hz, o.K.w / 2); }
          else { const c = Math.abs(Math.cos(o.yaw)), s = Math.abs(Math.sin(o.yaw)); hx = Math.max(hx, c * o.K.w / 2 + s * o.K.d / 2); hz = Math.max(hz, s * o.K.w / 2 + c * o.K.d / 2); }
        }
        for (const o of st.objs) top = Math.max(top, o.y + o.K.h);
        const L = top * 0.75;
        const dx = -shDir[0] / sl * L, dz = -shDir[1] / sl * L;
        const cx = st.x, cz = st.z;
        gl.uniform4f(U.uBox, cx, cz, hx, hz);
        gl.uniform3f(U.uSh, dx, dz, 0.75);
        const m = 0.9;
        gl.uniform4f(U.uRect, Math.min(cx - hx, cx - hx + dx) - m, Math.min(cz - hz, cz - hz + dz) - m, Math.max(cx + hx, cx + hx + dx) + m, Math.max(cz + hz, cz + hz + dz) + m);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // objects
      gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      U = this.objP.U;
      gl.useProgram(this.objP.pr);
      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uDyn, 1);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.dyn);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.uniform3fv(U.uCam, eye); gl.uniform3fv(U.uKeyPos, keyPos);
      gl.uniform3fv(U.uKey, hex(C.key)); gl.uniform3fv(U.uSky, hex(C.sky)); gl.uniform3fv(U.uGnd, hex(C.gnd));
      gl.uniform3fv(U.uFog, hex(C.fog)); gl.uniform2f(U.uFogR, fogR[0], fogR[1]);
      gl.uniform3fv(U.uLampC, hex('#ff5a2a'));
      const M = this.mm || (this.mm = new Float32Array(16));
      const uvs = new Float32Array(6), fsz = new Float32Array(6);
      for (const st of this.stacks.values()) {
        if (!st) continue;
        const sp = st.sx;
        if (!(Math.abs(sp) < 1.6)) continue;
        for (let oi = 0; oi < st.objs.length; oi++) {
          const o = st.objs[oi], K = o.K;
          const cyl = K.shape === 'cyl';
          const w = K.w, h = K.h, d = cyl ? K.w : K.d;
          const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
          const x = st.x + o.jx, y = o.y, z = st.z + o.jz + o.zo;
          M[0] = c * w; M[1] = 0; M[2] = -s * w; M[3] = 0;
          M[4] = 0; M[5] = h; M[6] = 0; M[7] = 0;
          M[8] = s * d; M[9] = 0; M[10] = c * d; M[11] = 0;
          M[12] = x; M[13] = y; M[14] = z; M[15] = 1;
          gl.uniformMatrix4fv(U.uM, false, M);
          gl.uniform1f(U.uYaw, o.yaw);
          gl.uniform3f(U.uLayer, o.L[0], o.L[1], o.L[2]);
          for (let f = 0; f < 3; f++) {
            const dz = DESIGNS[o.L[f]];
            uvs[f * 2] = dz.W / LS; uvs[f * 2 + 1] = dz.H / LS;
            const fd = faceDims(K, f); fsz[f * 2] = fd[0]; fsz[f * 2 + 1] = fd[1];
          }
          gl.uniform2fv(U.uUVS, uvs); gl.uniform2fv(U.uFace, fsz);
          gl.uniform3f(U.uSize, w, h, d);
          // something sitting on it? (only when resting)
          let onTop = 0;
          if (!st.anim) { const idx = st.order.indexOf(oi); onTop = idx < st.order.length - 1 ? 1 : 0; }
          gl.uniform1f(U.uTopAO, onTop);
          gl.uniform1f(U.uCyl, cyl ? 1 : 0);
          const dw = DESIGNS[o.L[0]];
          gl.uniform1i(U.uWinN, dw.wins.length);
          if (dw.wins.length) { gl.uniform4fv(U.uWinR, dw.winR); gl.uniform4fv(U.uWinA, dw.winA); }
          const isHero = hero && hero.o === o;
          const dz0 = DESIGNS[o.L[0]];
          if (isHero && dz0.cone) gl.uniform4f(U.uCone, dz0.cone[0], dz0.cone[1], dz0.cone[2], pump);
          else gl.uniform4f(U.uCone, 0.5, 0.5, 0.1, 0);
          if (isHero && dz0.lamp) gl.uniform4f(U.uLamp, dz0.lamp[0], dz0.lamp[1], dz0.lamp[2], lampGlow);
          else gl.uniform4f(U.uLamp, 0.5, 0.5, 0.1, 0);
          const mesh = cyl ? this.cyl : this.box;
          gl.bindVertexArray(mesh.vao);
          gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
        }
      }
      gl.bindVertexArray(null);

      g.imageSmoothingEnabled = true;
      g.drawImage(this.glCanvas, 0, 0, W, H);
      g.restore();
    },
  });
})();
