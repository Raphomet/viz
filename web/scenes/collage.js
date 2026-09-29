// Marble Hours: a cut-paper portrait collage, animated like an After Effects
// cut-out music video. Twelve ancient marble heads from the Met's Open Access
// collection (web/assets/collage/CREDITS.md), keyed off their photo
// backdrops, re-screened as coarse black-and-white halftone and trimmed with a
// thin paper margin, sit on flat discs over a pastel board. They are cut into
// vertical strips that slide, split and hinge open on grey card, shatter into
// paper chips that tumble and fly home, and trail a stepped echo; the board
// hard-cuts between four pastels on the bar. The eyes are the one accent: they
// glow yellow.
//
// Music, each in its own place:
//   kick   one head's strip set slides a notch (heads take turns); four notches
//          and the strips click back into line
//   snare  one head either splits down the face and its halves hinge open on
//          grey card, revealing the next portrait behind, or shatters into
//          paper chips that tumble (white backs flashing) and fly back together
//   bars   the board hard-cuts to the next pastel, and the discs with it; the
//          pastels share one lightness, so a cut changes hue, not brightness
//   hats   the eyes glint, one head at a time
//   bass   the discs swell
//   drop   more heads slide onto the board, the cuts come every bar instead of
//          every two, the strips get finer, and the main head grows a stepped
//          echo that fans sideways. A script title card is pasted on at the drop
//          and every sixteen bars.
//
// Masking: each photograph is keyed once at load. A region grown from the
// frame edge through dark, near-neutral backdrop pixels is the background,
// everything below a per-image cut line (the plinth) is removed, the largest
// remaining piece is the head, and a blur-and-threshold smooths the edge like
// a scissor cut. A dilated copy of the mask becomes the white paper margin.
//
// Technique: Canvas 2D. Every head is baked once into a halftone sprite at a
// size matched to the canvas (so the dots stay print-sized at any resolution),
// plus a blurred low-resolution shadow; strips, doors and chips are sub-rects
// of those sprites, so a frame is a few dozen drawImage calls.

(function () {
  const BEAT = 60 / 124;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeInOut = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const easeOutBack = (u) => { u = clamp(u, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const approach = (cur, tgt, tau, dt) => cur + (tgt - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));

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

  // Eyes and cut lines were read off each photograph on a 5% grid. `cut` is
  // the height (fraction of the photo) where the plinth or mounting rod
  // starts; everything below it is scissored off. `face` is where the split
  // runs and the disc centres, when the eyes alone would put it wrong.
  const HEADS = [
    { file: 'augustus.jpg', eyes: [[0.37, 0.47], [0.59, 0.47]], cut: 0.78 },
    { file: 'epikouros.jpg', eyes: [[0.35, 0.41], [0.56, 0.41]], cut: 0.845 },
    { file: 'girl-fragment.jpg', eyes: [[0.58, 0.48]], cut: 0.875, face: [0.55, 0.52] },
    { file: 'caligula.jpg', eyes: [[0.365, 0.36], [0.49, 0.36]], cut: 0.925, face: [0.45, 0.42] },
    { file: 'general.jpg', eyes: [[0.39, 0.48], [0.565, 0.48]], cut: 0.9 },
    { file: 'chrysippos.jpg', eyes: [[0.38, 0.46], [0.56, 0.46]], cut: 0.83 },
    { file: 'caracalla.jpg', eyes: [[0.37, 0.39], [0.59, 0.39]], cut: 0.885 },
    { file: 'antinoos.jpg', eyes: [[0.40, 0.49], [0.58, 0.49]], cut: 0.76 },
    { file: 'severan-woman.jpg', eyes: [[0.37, 0.50], [0.60, 0.50]], cut: 0.82 },
    { file: 'trajanic-woman.jpg', eyes: [[0.36, 0.49], [0.56, 0.49]], cut: 0.86 },
    { file: 'elderly-woman.jpg', eyes: [[0.35, 0.47], [0.60, 0.47]], cut: 0.865 },
    { file: 'ptolemaic-queen.jpg', eyes: [[0.32, 0.40], [0.50, 0.40]], cut: 0.875, face: [0.43, 0.46] },
  ];

  // Four grounds per board, chosen to share one lightness (Rec.709 luma
  // within a few hundredths), so the bar cuts read as a change of hue rather
  // than a flash.
  const PALETTES = [
    { name: 'Pastel board', grounds: ['#F4C3C9', '#B8DECE', '#D2CAF0', '#E8D89C'],
      ink: [24, 21, 22], paper: [246, 242, 233], plane: '#9C9DA3', planeBack: '#7E7F86', accent: [255, 206, 26], shadow: '38,26,44' },
    { name: 'Sherbet', grounds: ['#FFBFA8', '#F0D58E', '#A6E0C8', '#B4D0F6'],
      ink: [30, 22, 26], paper: [250, 244, 234], plane: '#A7A2A0', planeBack: '#86817F', accent: [255, 214, 0], shadow: '60,30,30' },
    { name: 'Museum', grounds: ['#D8CFBF', '#BCC7CB', '#D3BDB5', '#C3CBB0'],
      ink: [20, 20, 22], paper: [244, 240, 230], plane: '#8F9193', planeBack: '#727476', accent: [255, 196, 30], shadow: '30,26,24' },
    { name: 'Night board', grounds: ['#34395A', '#4A3450', '#23474A', '#4B4632'],
      ink: [16, 14, 18], paper: [232, 228, 218], plane: '#6D6E78', planeBack: '#55565F', accent: [255, 214, 40], shadow: '0,0,0' },
  ];

  const TITLES = ['Marble Hours', 'Old Friends', 'Heads & Halves', 'Salve', 'Memento', 'Night Gallery', 'The Collection'];
  const CUT_BEATS = [16, 8, 4, 2];

  const PRESETS = {
    calm: { heads: 1, cadence: 1, echo: 0, strips: 7, jitter: 0.35 },
    drop: { heads: 3, cadence: 2, echo: 1, strips: 10, jitter: 0.7 },
    gallery: { heads: 4, cadence: 0, echo: 0, strips: 6, jitter: 0.25, events: 1 },
  };
  const DRIVE_RANGE = ['echo', 'jitter'];
  const DRIVE_STEP = ['heads', 'cadence', 'strips'];

  // ------------------------------------------------------------------ keying
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / n;
        acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  // Key one photograph. Returns luminance, the head mask, the paper-margin
  // mask, the crop box and tone levels, all at the photo's own resolution.
  function prep(img, spec) {
    const w = img.width, h = img.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    const L = new Float32Array(w * h), warm = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
      L[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      warm[i] = r - b;
    }
    // The backdrop's own level, from the top corners.
    let bl = 0, bw = 0, bn = 0;
    for (let y = 0; y < h * 0.15; y++) for (let x = 0; x < w; x += 3) {
      if (x > w * 0.2 && x < w * 0.8) continue;
      bl += L[y * w + x]; bw += warm[y * w + x]; bn++;
    }
    bl /= bn; bw /= bn;
    const thr = spec.thr || Math.min(0.42, bl + 0.17);
    const bgLike = (i) => L[i] < thr && warm[i] < bw + 0.09;
    const bg = new Uint8Array(w * h);
    const q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    const cutY = Math.round(spec.cut * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (y >= cutY) { bg[i] = 1; q[qt++] = i; }
      else if ((x === 0 || x === w - 1 || y === 0) && bgLike(i)) { bg[i] = 1; q[qt++] = i; }
    }
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      if (x > 0 && !bg[i - 1] && bgLike(i - 1)) { bg[i - 1] = 1; q[qt++] = i - 1; }
      if (x < w - 1 && !bg[i + 1] && bgLike(i + 1)) { bg[i + 1] = 1; q[qt++] = i + 1; }
      if (y > 0 && !bg[i - w] && bgLike(i - w)) { bg[i - w] = 1; q[qt++] = i - w; }
      if (y < h - 1 && !bg[i + w] && bgLike(i + w)) { bg[i + w] = 1; q[qt++] = i + w; }
    }
    // Keep only the largest foreground piece: stray specks and plinth corners go.
    const lab = new Int32Array(w * h);
    let best = 0, bestN = 0, cur = 0;
    for (let s = 0; s < w * h; s++) {
      if (bg[s] || lab[s]) continue;
      cur++; qh = 0; qt = 0; q[qt++] = s; lab[s] = cur;
      while (qh < qt) {
        const i = q[qh++], x = i % w, y = (i / w) | 0;
        if (x > 0 && !bg[i - 1] && !lab[i - 1]) { lab[i - 1] = cur; q[qt++] = i - 1; }
        if (x < w - 1 && !bg[i + 1] && !lab[i + 1]) { lab[i + 1] = cur; q[qt++] = i + 1; }
        if (y > 0 && !bg[i - w] && !lab[i - w]) { lab[i - w] = cur; q[qt++] = i - w; }
        if (y < h - 1 && !bg[i + w] && !lab[i + w]) { lab[i + w] = cur; q[qt++] = i + w; }
      }
      if (qt > bestN) { bestN = qt; best = cur; }
    }
    const fg = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) fg[i] = lab[i] === best ? 1 : 0;
    // Scissor-smooth edge, pulled in a touch so the backdrop's dark fringe goes.
    const sm = boxBlur(boxBlur(fg, w, h, 2), w, h, 2);
    const inner = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) inner[i] = clamp((sm[i] - 0.55) / 0.2, 0, 1);
    const wide = boxBlur(boxBlur(fg, w, h, 4), w, h, 3);
    const outer = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) outer[i] = clamp((wide[i] - 0.1) / 0.12, 0, 1);
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (outer[y * w + x] > 0.02) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    // Tone levels from inside the head, so every marble prints full range.
    const vals = [];
    for (let i = 0; i < w * h; i += 7) if (inner[i] > 0.95) vals.push(L[i]);
    vals.sort((a, b) => a - b);
    const lo = vals.length ? vals[Math.floor(vals.length * 0.04)] : 0.2;
    const hi = vals.length ? vals[Math.floor(vals.length * 0.985)] : 0.9;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const toU = (x) => (x * w - x0) / cw, toV = (y) => (y * h - y0) / ch;
    const eyes = spec.eyes.map((e) => [toU(e[0]), toV(e[1])]);
    let face;
    if (spec.face) face = [toU(spec.face[0]), toV(spec.face[1])];
    else {
      const ex = eyes.reduce((a, e) => a + e[0], 0) / eyes.length;
      const ey = eyes.reduce((a, e) => a + e[1], 0) / eyes.length;
      face = [ex, ey + 0.06];
    }
    return { w, h, L, inner, outer, x0, y0, cw, ch, lo, hi, eyes, face, aspect: cw / ch };
  }

  // Bake the halftone sprite (and its shadow and flat silhouette) at height H.
  // A bake at full-screen size costs ~50 ms of JavaScript, so it runs as a job
  // a few rows at a time between frames (bakeRows), and only the very first
  // head of a session is ever baked in one go.
  function bakeJob(P, H, ink, paper) {
    const Wd = Math.max(8, Math.round(H * P.aspect));
    const cv = document.createElement('canvas');
    cv.width = Wd; cv.height = H;
    const g = cv.getContext('2d');
    return { P, H, Wd, ink, paper, cv, g, id: g.createImageData(Wd, H), y: 0 };
  }
  function bakeRows(J, budgetMs) {
    const { P, H, Wd, ink, paper } = J;
    const o = J.id.data;
    const w = P.w, sc = P.ch / H;
    const pitch = Math.max(2.6, H / 128);
    const ca = Math.cos(0.785398), sa = Math.sin(0.785398);
    const aa = 1.1 / pitch;
    const span = Math.max(0.05, P.hi - P.lo);
    const samp = (A, fx, fy) => {
      const x = clamp(fx, 0, P.w - 1.001), y = clamp(fy, 0, P.h - 1.001);
      const xi = x | 0, yi = y | 0, tx = x - xi, ty = y - yi, i = yi * w + xi;
      return (A[i] * (1 - tx) + A[i + 1] * tx) * (1 - ty) + (A[i + w] * (1 - tx) + A[i + w + 1] * tx) * ty;
    };
    const t0 = performance.now();
    for (let y = J.y; y < H; y++) {
      const fy = P.y0 + (y + 0.5) * sc - 0.5;
      for (let x = 0; x < Wd; x++) {
        const fx = P.x0 + (x + 0.5) * sc - 0.5;
        const k = (y * Wd + x) * 4;
        const out = samp(P.outer, fx, fy);
        if (out <= 0.001) { o[k + 3] = 0; continue; }
        const inn = samp(P.inner, fx, fy);
        let cov = 0;
        if (inn > 0.001) {
          let t = clamp((samp(P.L, fx, fy) - P.lo) / span, 0, 1);
          t = Math.pow(t, 0.85);
          const c = clamp((1 - t) * 1.08 - 0.07, 0, 1);
          const u = (x * ca - y * sa) / pitch, v = (x * sa + y * ca) / pitch;
          const du = u - Math.floor(u) - 0.5, dv = v - Math.floor(v) - 0.5;
          const dist = Math.sqrt(du * du + dv * dv);
          const r = Math.sqrt(c) * 0.72;
          cov = clamp((r - dist) / aa + 0.5, 0, 1) * inn;
        }
        o[k] = lerp(paper[0], ink[0], cov);
        o[k + 1] = lerp(paper[1], ink[1], cov);
        o[k + 2] = lerp(paper[2], ink[2], cov);
        o[k + 3] = Math.round(out * 255);
      }
      J.y = y + 1;
      if ((y & 15) === 15 && performance.now() - t0 > budgetMs) break;
    }
    return J.y >= H;
  }
  function bakeFinish(J) {
    const { P, H, Wd, cv } = J;
    J.g.putImageData(J.id, 0, 0);
    // Low-resolution silhouette (white) and a soft shadow with room to blur.
    const sh = Math.max(24, Math.round(H / 4)), sw = Math.max(8, Math.round(sh * P.aspect));
    const sil = document.createElement('canvas');
    sil.width = sw; sil.height = sh;
    const sg = sil.getContext('2d');
    sg.drawImage(cv, 0, 0, sw, sh);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#fff';
    sg.fillRect(0, 0, sw, sh);
    const pad = Math.round(sh * 0.08);
    const shadow = document.createElement('canvas');
    shadow.width = sw + pad * 2; shadow.height = sh + pad * 2;
    const hg = shadow.getContext('2d');
    hg.filter = 'blur(' + Math.max(1, sh * 0.012).toFixed(1) + 'px)';
    hg.drawImage(sil, pad, pad);
    hg.filter = 'none';
    hg.globalCompositeOperation = 'source-in';
    hg.fillStyle = '#000';
    hg.fillRect(0, 0, shadow.width, shadow.height);
    return { cv, W: Wd, H, sil, shadow, padU: pad / sw, padV: pad / sh, tints: {} };
  }
  function bake(P, H, ink, paper) {
    const J = bakeJob(P, H, ink, paper);
    bakeRows(J, 1e9);
    return bakeFinish(J);
  }

  // A jittered grid of quads over the sprite, keeping those that touch the head.
  function makeChips(P, rng) {
    const cols = 6, rows = 8;
    const V = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        row.push([(i + (edge ? 0 : (rng() - 0.5) * 0.7)) / cols, (j + (edge ? 0 : (rng() - 0.5) * 0.7)) / rows]);
      }
      V.push(row);
    }
    const inside = (u, v) => {
      const x = P.x0 + u * P.cw, y = P.y0 + v * P.ch;
      const xi = clamp(Math.round(x), 0, P.w - 1), yi = clamp(Math.round(y), 0, P.h - 1);
      return P.outer[yi * P.w + xi] > 0.5;
    };
    const chips = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const q = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      let hit = inside(cx, cy);
      for (let k = 0; k < 4 && !hit; k++) hit = inside(lerp(q[k][0], cx, 0.3), lerp(q[k][1], cy, 0.3));
      if (!hit) continue;
      let u0 = 1, v0 = 1, u1 = 0, v1 = 0;
      for (const p of q) { u0 = Math.min(u0, p[0]); v0 = Math.min(v0, p[1]); u1 = Math.max(u1, p[0]); v1 = Math.max(v1, p[1]); }
      chips.push({ q, cx, cy, u0, v0, u1, v1 });
    }
    return chips;
  }

  // Slots for n heads: [x fraction of width, y fraction of height, height
  // fraction of height]. Slot 0 is always the main head (it carries the echo).
  function layout(n, W, H) {
    const wide = W / H;
    const sp = Math.min(0.34, 0.18 * wide);
    if (n <= 1) return [[0.5, 0.52, 0.8]];
    if (n === 2) return [[0.5 - sp * 0.55, 0.53, 0.68], [0.5 + sp * 0.62, 0.5, 0.6]];
    if (n === 3) return [[0.5, 0.53, 0.66], [0.5 + sp * 0.95, 0.47, 0.5], [0.5 - sp * 0.95, 0.57, 0.52]];
    return [[0.5 - sp * 0.35, 0.52, 0.56], [0.5 + sp * 0.45, 0.45, 0.46], [0.5 - sp * 1.15, 0.58, 0.46], [0.5 + sp * 1.2, 0.6, 0.44]];
  }

  const rgb = (c, a) => (a === undefined ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')');
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const darken = (h, k) => { const c = hexRgb(h); return 'rgb(' + c.map((v) => Math.round(v * k)).join(',') + ')'; };

  VIZ.register({
    id: 'collage',
    name: 'Marble Hours',
    order: 834,

    params: [
      { key: 'palette', label: 'Board', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'heads', label: 'Heads', type: 'range', min: 1, max: 4, default: PRESETS.calm.heads, step: 1 },
      { key: 'cadence', label: 'Ground cuts every', type: 'select', options: ['4 bars', '2 bars', '1 bar', '2 beats'], default: PRESETS.calm.cadence },
      { key: 'echo', label: 'Stepped echo', type: 'range', min: 0, max: 1, default: PRESETS.calm.echo, step: 0.01 },
      { key: 'strips', label: 'Strips per head', type: 'range', min: 3, max: 14, default: PRESETS.calm.strips, step: 1 },
      { key: 'events', label: 'Snare cuts', type: 'select', options: ['Hinge and shatter', 'Hinge only', 'Shatter only', 'None'], default: 0 },
      { key: 'jitter', label: 'Stop-motion jitter', type: 'range', min: 0, max: 1, default: PRESETS.calm.jitter, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'title', label: 'Title card (blank = rotate, "-" = none)', type: 'text', default: '' },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'next', label: 'Next heads', run() { if (this.heads) for (const hd of this.heads) if (!hd.leaving && !hd.ev) this.startHinge(hd, this.clock || 0); } },
    ],

    finish: { bloom: 0.25, halation: 0.4, motionBlur: 0.35, softness: 0.6 },

    gallery: {
      title: 'Marble Hours',
      technique: 'Canvas 2D cut-out collage: twelve public-domain Met marble heads keyed at load (edge-grown backdrop region, plinth cut line, largest component, blur-threshold scissor edge, dilated paper margin), baked into halftone sprites sized to the canvas with blurred shadows; strips, perspective door slices and clipped paper chips are sub-rects of those sprites',
      brief: 'A cut-paper portrait collage in the manner of a hand-made After Effects music video. Ancient marble heads, re-screened as coarse black-and-white halftone with a thin white paper margin, sit on flat discs over a pastel board, each casting a paper shadow; their eyes glow yellow, the only accent. Each kick slides one head\'s vertical strips a notch (four notches and they click back into line); each snare either splits a face down the middle and hinges the halves open on grey card, revealing the next portrait behind, or shatters a head into paper chips that tumble, flashing their white backs, and fly home. The board hard-cuts between four pastels of one lightness on the bar and the discs cut with it; hats glint the eyes; the bass swells the discs. The drop slides more heads onto the board, cuts the ground every bar, cuts finer strips and fans a stepped echo out of the main head; a script title card is pasted on at the drop and every sixteen bars.',
      lineage: 'Scene 5, "Portrait collage", of the LEXSAN set Raph studied on 2026-09-28 ("i love this one, i can barely look away"), rebuilt from its principles rather than its pictures: engraved B&W cut-outs, strips, hinges, shatter, stepped echo, pastel flats cut on a cadence, a disc behind each head, one accent colour, a script title. Also Hannah Höch and the Dada photomontage, Terry Gilliam\'s cut-out animation, and the halftone of newsprint. Images: The Metropolitan Museum of Art, Open Access (CC0), credited in web/assets/collage/CREDITS.md.',
    },

    preload(p) {
      this.imgs = HEADS.map((hd) => p.loadImage('assets/collage/' + hd.file));
    },

    enter() {
      this.clock = null;
      this.lastMs = null;
    },

    init(t) {
      this.rng = mulberry(834);
      this.prepped = this.prepped || [];
      this.baked = this.baked || [];
      this.want = []; this.job = null;
      this.chips = this.chips || [];
      this.bakeH = 0;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.prevKick = -10; this.kickAvg = 0; this.lastSnare = -10; this.lastHat = -10; this.lastEvent = t;
      this.beats = 0; this.cutIdx = 0; this.titleCount = 0;
      this.bassEnv = 0; this.low = 0; this.dropOn = false; this.auto = 0;
      this.ground = 0; this.cutBlock = 0;
      this.heads = [];
      this.deck = [];
      this.kickTurn = 0; this.hatTurn = 0; this.eventTurn = 0;
      this.title = null;
      this.pat = 0;
      this.clock = t;
      this.lastPal = -1;
    },

    nextImage() {
      const used = new Set(this.heads.map((h) => h.img).concat(this.heads.map((h) => h.nextImg)).filter((x) => x !== undefined && x !== null));
      for (let tries = 0; tries < 30; tries++) {
        if (!this.deck.length) {
          this.deck = HEADS.map((_, i) => i);
          for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); const tmp = this.deck[i]; this.deck[i] = this.deck[j]; this.deck[j] = tmp; }
        }
        // Prefer a head that is already baked, so the reveal never waits.
        let k = this.deck.length - 1;
        while (k >= 0 && (used.has(this.deck[k]) || !this.baked[this.deck[k]])) k--;
        if (k < 0) k = this.deck.length - 1;
        const c = this.deck.splice(k, 1)[0];
        if (!used.has(c)) return c;
      }
      return 0;
    },

    prepOne(i) {
      if (!this.imgs || !this.imgs[i] || !this.imgs[i].width) return false;
      if (!this.prepped[i]) {
        const im = this.imgs[i].canvas || this.imgs[i].elt;
        this.prepped[i] = prep(im, HEADS[i]);
        this.chips[i] = makeChips(this.prepped[i], mulberry(100 + i));
      }
      return true;
    },

    fresh(i, pal) {
      const b = this.baked[i];
      return !!b && b.H === this.bakeH && b.pal === pal;
    },

    // The sprite for image i: the current bake if there is one (queueing a
    // re-bake when the size or board changed), else a one-off synchronous bake.
    ensure(i, pal) {
      if (i === null || i === undefined || !this.prepOne(i)) return null;
      if (this.fresh(i, pal)) return this.baked[i];
      if (this.baked[i]) { this.queue(i, pal); return this.baked[i]; }
      const P = PALETTES[pal];
      this.baked[i] = bake(this.prepped[i], this.bakeH, P.ink, P.paper);
      this.baked[i].pal = pal;
      return this.baked[i];
    },

    queue(i, pal) {
      if (this.job && this.job.i === i) return;
      if (!this.want.some((w) => w === i)) this.want.push(i);
    },

    // Bake in the background, a few milliseconds a frame: first whatever was
    // asked for, then every other head, so a hinge never waits on a bake.
    pump(pal) {
      const t0 = performance.now();
      while (performance.now() - t0 < 4) {
        if (this.job && (this.job.H !== this.bakeH || this.job.pal !== pal)) this.job = null;
        if (!this.job) {
          let i = this.want.shift();
          if (i === undefined) {
            i = HEADS.findIndex((_, k) => !this.fresh(k, pal) && this.imgs[k] && this.imgs[k].width);
            if (i < 0) return;
          }
          if (this.fresh(i, pal) || !this.prepOne(i)) continue;
          const P = PALETTES[pal];
          this.job = bakeJob(this.prepped[i], this.bakeH, P.ink, P.paper);
          this.job.i = i; this.job.pal = pal;
          break;
        }
        const J = this.job;
        if (bakeRows(J, 4 - (performance.now() - t0))) {
          const b = bakeFinish(J);
          b.pal = J.pal;
          this.baked[J.i] = b;
          this.job = null;
        } else break;
      }
    },

    tint(b, colour) {
      if (!b.tints[colour]) {
        const c = document.createElement('canvas');
        c.width = b.sil.width; c.height = b.sil.height;
        const g = c.getContext('2d');
        g.drawImage(b.sil, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = colour;
        g.fillRect(0, 0, c.width, c.height);
        b.tints[colour] = c;
      }
      return b.tints[colour];
    },

    addHead(slot, W, H, fromSide) {
      const hd = {
        img: this.nextImage(), nextImg: null, slot,
        x: 0, y: 0, h: 0, init: false, fromSide,
        leaving: false, gone: false,
        n: 0, off: [], tgt: [], notch: 0, pattern: Math.floor(this.rng() * 4), phase: this.rng() * 6,
        ev: null, seed: this.rng() * 100, glint: 0, discDx: (this.rng() - 0.5) * 0.12, discDy: (this.rng() - 0.5) * 0.08,
        discK: Math.floor(this.rng() * 3), reveal: 0,
      };
      this.heads.push(hd);
      return hd;
    },

    stripTargets(hd) {
      const n = hd.n, k = hd.notch;
      for (let i = 0; i < n; i++) {
        let v;
        const c = i - (n - 1) / 2;
        if (hd.pattern === 0) v = (i % 2 ? -1.2 : 0) * k;
        else if (hd.pattern === 1) v = c / ((n - 1) / 2 || 1) * k;
        else if (hd.pattern === 2) v = Math.sin(i * 1.4 + hd.phase) * k;
        else v = (i % 3 === 1 ? -1.2 : 0.3) * k;
        hd.tgt[i] = v;
      }
    },

    startHinge(hd, t) {
      hd.ev = { type: 'hinge', t0: t };
      hd.nextImg = this.nextImage();
      hd.notch = 0; this.stripTargets(hd);
      this.lastEvent = t;
    },

    startShatter(hd, t, push) {
      const chips = this.chips[hd.img];
      if (!chips) return;
      const P = this.prepped[hd.img];
      const fl = chips.map((c) => {
        let dx = c.cx - P.face[0], dy = c.cy - P.face[1];
        const L = Math.hypot(dx, dy) || 1;
        const a = Math.atan2(dy / L, dx / L) + (this.rng() - 0.5) * 0.9;
        return {
          ax: Math.cos(a), ay: Math.sin(a) - 0.25,
          dist: (0.18 + 0.55 * this.rng() * this.rng() + 0.25 * L) * (0.6 + 0.4 * push),
          spin: (this.rng() - 0.5) * 2.6,
          tumble: this.rng() < 0.65 ? Math.PI * (0.7 + this.rng() * 1.6) : 0,
          lift: 0.5 + this.rng(), delay: this.rng() * 0.06,
        };
      });
      hd.ev = { type: 'shatter', t0: t, fl };
      hd.notch = 0; this.stripTargets(hd);
      this.lastEvent = t;
    },

    analyse(s, t, dt) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      const ev = { kick: false, snare: false, hat: false, hatAmp: 0 };
      if (b0 > 30 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.3) { this.lastKick = t; ev.kick = true; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) { this.lastSnare = t; ev.snare = true; }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.09) { this.lastHat = t; ev.hat = true; ev.hatAmp = clamp(bh / 85, 0.35, 1); }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.4, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.1) : k(0.45));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.8);
      const kicking = t - this.lastKick < 0.9;
      const was = this.dropOn;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.22 || t - this.lastKick > 1.8)) this.dropOn = false;
      ev.dropStart = this.dropOn && !was;
      // Beat clock: free-runs at 124 BPM and snaps to the kick, so bars fall on
      // kicks when there are kicks and keep time when there are none.
      this.beats += dt / BEAT;
      if (ev.kick) {
        // The first kick after a gap is taken as a downbeat, so the bar cuts
        // land on the one; later kicks only keep the phase honest.
        // So is a kick much harder than the ones before it: the drop landing.
        const accent = b0 > 60 && b0 > this.kickAvg * 1.35;
        this.kickAvg = lerp(this.kickAvg, b0, 0.3);
        if (t - this.prevKick > 1.5 || accent) this.beats = Math.ceil(this.beats / 4 - 0.1) * 4 + 1e-4;
        else {
          const r = Math.round(this.beats);
          if (Math.abs(this.beats - r) < 0.35) this.beats = r + 1e-4;
        }
        this.prevKick = t;
      }
      // A clap on a kick is a backbeat (2 or 4): if the clock calls it 1 or 3,
      // it is a beat out, so nudge it.
      if ((ev.snare || ev.kick) && Math.abs(this.lastSnare - this.lastKick) < 0.07 && this.backbeatAt !== this.lastKick) {
        this.backbeatAt = this.lastKick;
        const bi = Math.round(this.beats);
        if (Math.abs(this.beats - bi) < 0.3 && ((bi % 2) + 2) % 2 === 0) this.beats += 1;
      }
      return ev;
    },

    draw(p, signals, params, ctx) {
      const ms = p.millis();
      const t = ms / 1000;
      if (this.clock === null || this.clock === undefined || !this.heads) this.init(t);
      const dt = this.lastMs === null || this.lastMs === undefined ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
      // 'high' smoothing (mipmapped) halved the frame rate at 3024x1890; the
      // sprites are baked at display size and the shadows are blurry, so
      // bilinear loses nothing.
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';

      const push = params.push;
      const ev = this.analyse(signals, t, dt);
      const follow = Math.round(params.follow) === 1;
      this.auto = approach(this.auto, follow && this.dropOn ? 1 : 0, this.dropOn ? 0.5 : 0.9, dt);
      const P = {};
      for (const key of DRIVE_RANGE) P[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? this.auto : 0);
      for (const key of DRIVE_STEP) P[key] = follow ? Math.round(lerp(params[key], Math.max(params[key], PRESETS.drop[key]), this.auto)) : Math.round(params[key]);
      if (follow && this.auto > 0.5) P.cadence = Math.max(Math.round(params.cadence), PRESETS.drop.cadence);
      else P.cadence = Math.round(params.cadence);
      const palI = clamp(Math.round(params.palette), 0, PALETTES.length - 1);
      const pal = PALETTES[palI];

      // Sprite resolution follows the canvas, in 64 px steps.
      const devPerUnit = (p.height * p.pixelDensity()) / H;
      const want = clamp(Math.round((0.82 * H * devPerUnit) / 64) * 64, 256, 1280);
      if (want !== this.bakeH) this.bakeH = want;
      this.pump(palI);

      // ---- heads on the board
      const n = clamp(P.heads, 1, 4);
      const live = this.heads.filter((h) => !h.leaving);
      while (live.length < n) {
        const slot = live.length;
        const L = layout(n, W, H)[slot];
        live.push(this.addHead(slot, W, H, L[0] < 0.5 ? -1 : 1));
      }
      while (live.length > n) {
        const hd = live.pop();
        hd.leaving = true;
      }
      const slots = layout(n, W, H);
      live.forEach((hd, i) => { hd.slot = i; });

      // ---- ground cuts on the bar
      const every = CUT_BEATS[clamp(P.cadence, 0, 3)];
      // Cut when the clock crosses onto a multiple of the cadence, so changing
      // the cadence never throws in an extra cut.
      const beatNow = Math.floor(this.beats + 1e-6);
      if (beatNow !== this.cutBlock && beatNow % every === 0) {
        this.cutBlock = beatNow;
        this.ground = (this.ground + 1 + Math.floor(this.rng() * 3)) % 4;
        for (const hd of this.heads) hd.discK = (hd.discK + 1) % 3;
      }
      const barIdx = Math.floor(this.beats / 4 + 1e-6);
      if (barIdx !== this.lastBar) {
        this.lastBar = barIdx;
        for (const hd of this.heads) if (hd.notch === 0 && this.rng() < 0.5) hd.pattern = (hd.pattern + 1) % 4;
        if (barIdx % 16 === 0 && barIdx > 0) this.showTitle(t, params);
      }
      if (ev.dropStart) this.showTitle(t, params);

      // ---- kick: one head's strips a notch
      if (ev.kick) {
        const cand = live.filter((h) => !h.ev);
        if (cand.length) {
          const hd = cand[this.kickTurn++ % cand.length];
          hd.notch = (hd.notch + 1) % 4;
          hd.tau = 0.055; hd.idle = false;
          this.stripTargets(hd);
        }
      }
      // Without a kick the strips drift back into line, and every two beats of
      // the clock one head slides a single notch out and back, slowly, so the
      // quiet sections still breathe.
      const beatI = Math.floor(this.beats + 1e-6);
      if (t - this.lastKick > 1.2 && beatI !== this.lastBeatI) {
        for (const hd of live) if (hd.notch > 1 || (hd.notch === 1 && !hd.idle)) { hd.notch = 0; hd.tau = 0.35; this.stripTargets(hd); }
        if (beatI % 2 === 0) {
          const cand = live.filter((h) => !h.ev);
          if (cand.length) {
            const hd = cand[this.kickTurn++ % cand.length];
            hd.notch = hd.notch ? 0 : 1; hd.idle = hd.notch === 1; hd.tau = 0.3;
            this.stripTargets(hd);
          }
        }
      }
      this.lastBeatI = beatI;
      // ---- snare: hinge or shatter one head
      const mode = Math.round(params.events);
      const trigger = (ev.snare && mode !== 3) || (mode !== 3 && t - this.lastEvent > 7);
      if (trigger) {
        const cand = live.filter((h) => !h.ev && h.init && h.enterDone);
        if (cand.length) {
          const hd = cand[Math.floor(this.rng() * cand.length)];
          const kind = mode === 1 ? 'hinge' : mode === 2 ? 'shatter' : (this.eventTurn++ % 2 ? 'shatter' : 'hinge');
          if (kind === 'hinge') this.startHinge(hd, t);
          else if (this.baked[hd.img]) this.startShatter(hd, t, push);
        }
      }
      // ---- hats: glint the eyes, one head at a time
      if (ev.hat && live.length) {
        const hd = live[this.hatTurn++ % live.length];
        hd.glint = Math.max(hd.glint, ev.hatAmp * (0.6 + 0.4 * Math.min(2, push)));
      }

      // ---- update heads
      const step = 1 / 12;
      const tq = Math.floor(t / step) * step;
      for (const hd of this.heads) {
        const L = hd.leaving ? null : slots[hd.slot];
        let tx, ty, th;
        if (L) { tx = L[0] * W; ty = L[1] * H; th = L[2] * H; }
        else { th = hd.h; ty = hd.y; tx = hd.x < W / 2 ? -th * 0.8 : W + th * 0.8; }
        if (!hd.init) {
          hd.init = true; hd.h = th; hd.y = ty; hd.x = hd.fromSide < 0 ? -th * 0.8 : W + th * 0.8;
          if (this.heads.length === 1) hd.x = tx;
        }
        hd.x = approach(hd.x, tx, hd.leaving ? 0.25 : 0.22, dt);
        hd.y = approach(hd.y, ty, 0.3, dt);
        hd.h = approach(hd.h, th, 0.3, dt);
        hd.enterDone = Math.abs(hd.x - tx) < th * 0.05;
        if (hd.leaving && (hd.x < -th * 0.7 || hd.x > W + th * 0.7)) hd.gone = true;
        // Strip count only changes while the strips are in line.
        const ns = clamp(P.strips, 3, 14);
        if (hd.n !== ns && hd.notch === 0 && hd.off.every((v) => Math.abs(v) < 0.02)) {
          hd.n = ns; hd.off = new Array(ns).fill(0); hd.tgt = new Array(ns).fill(0);
        }
        for (let i = 0; i < hd.n; i++) hd.off[i] = approach(hd.off[i], hd.tgt[i] || 0, hd.tau || 0.055, dt);
        hd.glint *= Math.exp(-dt / 0.14);
        hd.reveal *= Math.exp(-dt / 0.4);
        // Stepped, stop-motion bob: a little drift that updates twelve times a second.
        const jit = P.jitter;
        const s = hd.seed;
        hd.bx = (Math.sin(tq * 0.7 + s) * 0.012 + (mulberry((tq * 12 + s * 1000) | 0)() - 0.5) * 0.006 * jit) * hd.h;
        hd.by = (Math.sin(tq * 0.9 + s * 1.7) * 0.01 + (mulberry((tq * 12 + s * 777) | 0)() - 0.5) * 0.006 * jit) * hd.h;
        hd.rot = (Math.sin(tq * 0.45 + s * 2.3) * 0.02 + (mulberry((tq * 12 + s * 555) | 0)() - 0.5) * 0.012 * jit);
        if (hd.ev && hd.ev.type === 'hinge' && t - hd.ev.t0 > 0.8) {
          hd.img = hd.nextImg; hd.nextImg = null; hd.ev = null; hd.reveal = 1;
        } else if (hd.ev && hd.ev.type === 'shatter' && t - hd.ev.t0 > 1.7) hd.ev = null;
      }
      this.heads = this.heads.filter((h) => !h.gone);

      // ---- draw: ground
      g.fillStyle = pal.grounds[this.ground];
      g.fillRect(-4, -4, W + 8, H + 8);
      this.paperGrain(g, W, H, palI === 3);

      // Draw back to front: side heads first, main head last; leavers first of all.
      const order = this.heads.slice().sort((a, b) => (b.leaving - a.leaving) || (b.slot - a.slot));
      // The echo sits behind every head, so it fans out under its neighbours.
      for (const hd of order) if (hd.slot === 0 && !hd.leaving) this.drawEcho(g, hd, t, P, pal);
      for (const hd of order) this.drawHead(g, hd, t, P, pal, push);
      // Chips in flight go over everything on the board.
      for (const hd of order) if (hd.ev && hd.ev.type === 'shatter') this.drawChips(g, hd, t, pal);
      this.drawTitle(g, t, W, H, pal);
      g.restore();
    },

    showTitle(t, params) {
      const txt = (params.title || '').trim();
      if (txt === '-') return;
      const word = txt || TITLES[this.titleCount++ % TITLES.length];
      this.title = { word, t0: t, dur: 8 * BEAT, tilt: (this.rng() - 0.5) * 0.08, side: this.rng() < 0.5 ? -1 : 1 };
    },

    paperGrain(g, W, H, dark) {
      if (!this.grain) {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const gg = c.getContext('2d');
        const id = gg.createImageData(256, 256);
        const r = mulberry(7);
        for (let i = 0; i < 256 * 256; i++) {
          const v = 128 + (r() - 0.5) * 34;
          id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
          id.data[i * 4 + 3] = 255;
        }
        gg.putImageData(id, 0, 0);
        // A few fibres.
        gg.lineWidth = 0.7;
        for (let i = 0; i < 160; i++) {
          const x = r() * 256, y = r() * 256, a = r() * TAU, l = 4 + r() * 14;
          gg.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
          gg.beginPath(); gg.moveTo(x, y); gg.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 2, y + Math.sin(a) * l * 0.5 - 2, x + Math.cos(a) * l, y + Math.sin(a) * l); gg.stroke();
        }
        this.grain = c;
      }
      if (!this.grainPat) this.grainPat = g.createPattern(this.grain, 'repeat');
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = dark ? 0.35 : 0.28;
      g.fillStyle = this.grainPat;
      g.scale(0.5, 0.5);
      g.fillRect(0, 0, W * 2, H * 2);
      g.restore();
    },

    // Geometry of a head in board units: top-left, size, rotation about centre.
    frame(hd, b) {
      const h = hd.h, w = h * (b.W / b.H);
      return { cx: hd.x + hd.bx, cy: hd.y + hd.by, w, h, x0: -w / 2, y0: -h / 2 };
    },

    drawShadow(g, b, x, y, w, h, off, alpha, u0, u1) {
      // u0..u1: the horizontal slice of the sprite to shadow (for strips).
      u0 = u0 === undefined ? 0 : u0; u1 = u1 === undefined ? 1 : u1;
      const sw = b.shadow.width, sh = b.shadow.height;
      const iw = sw / (1 + 2 * b.padU), ih = sh / (1 + 2 * b.padV);
      const padX = b.padU * iw, padY = b.padV * ih;
      const edgeL = u0 === 0 ? padX : 0, edgeR = u1 === 1 ? padX : 0;
      const sx = padX + u0 * iw - edgeL, sww = (u1 - u0) * iw + edgeL + edgeR;
      const kx = w / iw, ky = h / ih;
      g.globalAlpha = alpha;
      g.drawImage(b.shadow, sx, 0, sww, sh, x + u0 * w - edgeL * kx + off[0], y - padY * ky + off[1], sww * kx, sh * ky);
      g.globalAlpha = 1;
    },

    drawHead(g, hd, t, P, pal, push) {
      const b = this.ensure(hd.img, clamp(PALETTES.indexOf(pal), 0, 3));
      if (!b) return;
      const Pp = this.prepped[hd.img];
      const F = this.frame(hd, b);
      const unit = hd.h / 400;
      g.save();
      g.translate(F.cx, F.cy);
      g.rotate(hd.rot);

      // Disc behind the head, cut with the ground; the bass swells it.
      const discCol = pal.grounds[(this.ground + 1 + hd.discK) % 4];
      const dx = F.x0 + Pp.face[0] * F.w + hd.discDx * F.h, dy = F.y0 + Pp.face[1] * F.h + hd.discDy * F.h;
      const R = F.h * 0.4 * (1 + 0.07 * this.bassEnv * push);
      g.fillStyle = 'rgba(' + pal.shadow + ',0.16)';
      g.beginPath(); g.arc(dx + 5 * unit, dy + 7 * unit, R, 0, TAU); g.fill();
      g.fillStyle = discCol;
      g.beginPath(); g.arc(dx, dy, R, 0, TAU); g.fill();

      const ev = hd.ev;
      if (ev && ev.type === 'hinge') this.drawHinge(g, hd, b, F, t - ev.t0, pal, unit);
      else if (ev && ev.type === 'shatter') { /* chips drawn later, over the board */ }
      else this.drawStrips(g, hd, b, F, unit, push, pal);
      g.restore();
    },

    drawEcho(g, hd, t, P, pal) {
      if (P.echo <= 0.02 || (hd.ev && hd.ev.type === 'shatter')) return;
      const b = this.ensure(hd.img, clamp(PALETTES.indexOf(pal), 0, 3));
      if (!b) return;
      const F = this.frame(hd, b);
      const unit = hd.h / 400;
      g.save();
      g.translate(F.cx, F.cy);
      g.rotate(hd.rot);
      // Stepped echo: flat paper silhouettes fanned out sideways behind the
      // head in two alternating tones, their spacing stepping eight times a
      // second, so the head seems to have left copies of itself as it moved.
      {
        const nE = Math.max(1, Math.round(P.echo * 4));
        const tq = Math.floor(t * 8) / 8;
        const spread = 0.24 * Math.sin(tq * 0.33 + 0.9) * F.h;
        const lift = -0.015 * F.h;
        const toneA = darken(pal.grounds[(this.ground + 2) % 4], 0.7);
        const toneB = rgb(pal.paper);
        for (let k = nE; k >= 1; k--) {
          const ex = F.x0 + spread * k, ey = F.y0 + lift * k;
          const a = k === nE ? clamp(P.echo * 4 - (nE - 1), 0.15, 1) : 1;
          this.drawShadow(g, b, ex, ey, F.w, F.h, [5 * unit, 7 * unit], 0.3 * a);
          g.globalAlpha = a;
          g.drawImage(this.tint(b, k % 2 ? toneA : toneB), ex, ey, F.w, F.h);
          g.globalAlpha = 1;
        }
      }

      g.restore();
    },

    drawStrips(g, hd, b, F, unit, push, pal) {
      const Pp = this.prepped[hd.img];
      const notchU = 0.03 * F.h * (0.5 + 0.5 * Math.min(push, 2));
      const aligned = !hd.n || hd.off.every((v) => Math.abs(v * notchU) < 0.3 * unit);
      const shOff = [5 * unit, 7 * unit];
      if (aligned) {
        this.drawShadow(g, b, F.x0, F.y0, F.w, F.h, shOff, 0.34);
        g.drawImage(b.cv, F.x0, F.y0, F.w, F.h);
        this.drawEyes(g, hd, Pp, F, pal, null, 0);
        return;
      }
      const n = hd.n;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        this.drawShadow(g, b, F.x0, F.y0 + hd.off[i] * notchU, F.w, F.h, shOff, 0.3, u0, u1);
      }
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        const sx = u0 * b.W, sw = (u1 - u0) * b.W;
        // Overlap by a hair so the cut reads as a cut, not a seam.
        g.drawImage(b.cv, sx, 0, sw, b.H, F.x0 + u0 * F.w - 0.15, F.y0 + hd.off[i] * notchU, (u1 - u0) * F.w + 0.3, F.h);
      }
      this.drawEyes(g, hd, Pp, F, pal, hd.off, notchU);
    },

    drawEyes(g, hd, Pp, F, pal, offs, notchU) {
      const a = pal.accent;
      const gl = clamp(hd.glint + hd.reveal * 0.8, 0, 1.4);
      for (const e of Pp.eyes) {
        let ex = F.x0 + e[0] * F.w, ey = F.y0 + e[1] * F.h;
        if (offs && hd.n) ey += offs[clamp(Math.floor(e[0] * hd.n), 0, hd.n - 1)] * notchU;
        const r = F.h * 0.016;
        const R = F.h * (0.05 + 0.05 * gl);
        const grd = g.createRadialGradient(ex, ey, r * 0.5, ex, ey, R);
        grd.addColorStop(0, rgb(a, 0.75 + 0.2 * Math.min(1, gl)));
        grd.addColorStop(0.35, rgb(a, 0.28 + 0.3 * Math.min(1, gl)));
        grd.addColorStop(1, rgb(a, 0));
        g.fillStyle = grd;
        g.beginPath(); g.arc(ex, ey, R, 0, TAU); g.fill();
        g.fillStyle = rgb(a);
        g.beginPath(); g.ellipse(ex, ey, r * 1.25, r, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,240,' + (0.35 + 0.6 * Math.min(1, gl)).toFixed(3) + ')';
        g.beginPath(); g.arc(ex, ey, r * (0.35 + 0.35 * Math.min(1, gl)), 0, TAU); g.fill();
        if (gl > 0.25) {
          // A four-point glint on the hat.
          const s = F.h * 0.06 * gl;
          g.fillStyle = 'rgba(255,255,235,' + clamp(gl * 0.8, 0, 0.9).toFixed(3) + ')';
          g.beginPath();
          g.moveTo(ex - s, ey); g.lineTo(ex - r * 0.2, ey - r * 0.2); g.lineTo(ex, ey - s * 0.7); g.lineTo(ex + r * 0.2, ey - r * 0.2);
          g.lineTo(ex + s, ey); g.lineTo(ex + r * 0.2, ey + r * 0.2); g.lineTo(ex, ey + s * 0.7); g.lineTo(ex - r * 0.2, ey + r * 0.2);
          g.closePath(); g.fill();
        }
      }
    },

    // The face splits down the middle; each half, mounted on grey card, swings
    // open about its outer edge in perspective (drawn as thin vertical slices),
    // revealing the next head behind.
    drawHinge(g, hd, b, F, te, pal, unit) {
      const nb = this.ensure(hd.nextImg, clamp(PALETTES.indexOf(pal), 0, 3));
      if (nb) {
        const NF = { x0: -F.h * (nb.W / nb.H) / 2, y0: F.y0, w: F.h * (nb.W / nb.H), h: F.h };
        this.drawShadow(g, nb, NF.x0, NF.y0, NF.w, NF.h, [5 * unit, 7 * unit], 0.34 * clamp(te / 0.3, 0, 1));
        g.drawImage(nb.cv, NF.x0, NF.y0, NF.w, NF.h);
        const hd2 = { glint: clamp((te - 0.2) * 3, 0, 1) * 0.9, reveal: 0, n: 0 };
        this.drawEyes(g, hd2, this.prepped[hd.nextImg], NF, pal, null, 0);
      }
      let th;
      if (te < 0.26) th = easeOutBack(te / 0.26) * 1.12;
      else if (te < 0.58) th = 1.12 + Math.sin((te - 0.26) * 14) * 0.03 * (1 - (te - 0.26) / 0.32);
      else th = lerp(1.12, Math.PI / 2 + 0.02, easeInOut((te - 0.58) / 0.22));
      if (th >= Math.PI / 2) return;
      const split = this.prepped[hd.img].face[0];
      const focal = F.h * 2.2;
      const cy = 0;
      const slices = 24;
      for (const side of [-1, 1]) {
        const hingeX = side < 0 ? F.x0 : F.x0 + F.w;
        const uA = side < 0 ? 0 : 1, uB = split;
        const doorW = Math.abs(uB - uA) * F.w;
        const cs = Math.cos(th), sn = Math.sin(th);
        const proj = (d) => { const f = focal / (focal - d * sn); return [hingeX - side * d * cs * f, f]; };
        // Shadow of the swinging card, cast down and right.
        const [xe, fe] = proj(doorW);
        const lift = doorW * sn;
        g.fillStyle = 'rgba(' + pal.shadow + ',0.22)';
        g.beginPath();
        g.moveTo(hingeX + 5 * unit, F.y0 + 7 * unit);
        g.lineTo(xe + 5 * unit + lift * 0.25, cy + (F.y0 - cy) * fe + 7 * unit + lift * 0.35);
        g.lineTo(xe + 5 * unit + lift * 0.25, cy + (F.y0 + F.h - cy) * fe + 7 * unit + lift * 0.35);
        g.lineTo(hingeX + 5 * unit, F.y0 + F.h + 7 * unit);
        g.closePath(); g.fill();
        const shade = 1 - 0.25 * sn;
        for (let j = 0; j < slices; j++) {
          const d0 = (j / slices) * doorW, d1 = ((j + 1) / slices) * doorW;
          const [xa, fa] = proj(d0), [xb, fb] = proj(d1);
          const f = (fa + fb) / 2;
          const left = Math.min(xa, xb), wd = Math.abs(xb - xa) + 0.35;
          const top = cy + (F.y0 - cy) * f, hh = F.h * f;
          g.fillStyle = darken(pal.plane, shade);
          g.fillRect(left, top, wd, hh);
          const su0 = side < 0 ? d0 / F.w : 1 - d1 / F.w;
          const su1 = side < 0 ? d1 / F.w : 1 - d0 / F.w;
          g.drawImage(b.cv, su0 * b.W, 0, (su1 - su0) * b.W, b.H, left, top, wd, hh);
        }
        // Darken the half as it turns away from the light.
        if (sn > 0.05) {
          const [xs] = proj(0), [xf] = proj(doorW);
          const [, f1] = proj(doorW);
          g.fillStyle = 'rgba(0,0,0,' + (0.18 * sn).toFixed(3) + ')';
          g.beginPath();
          g.moveTo(xs, F.y0); g.lineTo(xf, cy + (F.y0 - cy) * f1); g.lineTo(xf, cy + (F.y0 + F.h - cy) * f1); g.lineTo(xs, F.y0 + F.h);
          g.closePath(); g.fill();
        }
      }
    },

    drawChips(g, hd, t, pal) {
      const b = this.baked[hd.img];
      const chips = this.chips[hd.img];
      if (!b || !chips) return;
      const F = this.frame(hd, b);
      const unit = hd.h / 400;
      const te = t - hd.ev.t0;
      const paper = PALETTES[clamp(PALETTES.indexOf(pal), 0, 3)].paper;
      g.save();
      g.translate(F.cx, F.cy);
      g.rotate(hd.rot);
      const env = (fl) => {
        const u = te - fl.delay;
        if (u <= 0) return 0;
        if (u < 0.34) return easeOut(u / 0.34);
        if (u < 0.8) return 1 + 0.08 * (u - 0.34) / 0.46;
        return 1.08 * (1 - easeInOut((u - 0.8) / 0.8));
      };
      const place = (c, fl) => {
        const e = env(fl);
        return {
          e,
          x: F.x0 + c.cx * F.w + fl.ax * fl.dist * F.h * e,
          y: F.y0 + c.cy * F.h + fl.ay * fl.dist * F.h * e + 0.08 * F.h * e * e,
          r: fl.spin * e, tu: fl.tumble * Math.min(1, e),
        };
      };
      const path = (c, sx) => {
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const px = (c.q[k][0] - c.cx) * F.w, py = (c.q[k][1] - c.cy) * F.h * sx;
          if (k) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.closePath();
      };
      // Shadows first, one pass: the chip's own silhouette, clipped to the
      // chip, so the empty corners of edge chips cast nothing.
      const dark = this.tint(b, 'rgb(' + pal.shadow + ')');
      g.globalAlpha = 0.24;
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i], fl = hd.ev.fl[i], s = place(c, fl);
        const lift = (4 + 26 * s.e * fl.lift) * unit;
        const sy = Math.max(0.08, Math.abs(Math.cos(s.tu)));
        g.save();
        g.translate(s.x + lift * 0.7, s.y + lift);
        g.rotate(s.r);
        path(c, sy);
        g.clip();
        g.scale(1, sy);
        const dw = dark.width, dh = dark.height;
        g.drawImage(dark, c.u0 * dw, c.v0 * dh, (c.u1 - c.u0) * dw, (c.v1 - c.v0) * dh, (c.u0 - c.cx) * F.w, (c.v0 - c.cy) * F.h, (c.u1 - c.u0) * F.w, (c.v1 - c.v0) * F.h);
        g.restore();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i], fl = hd.ev.fl[i], s = place(c, fl);
        const cs = Math.cos(s.tu);
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.r);
        const sy = Math.max(0.08, Math.abs(cs));
        path(c, sy);
        g.clip();
        g.scale(1, sy);
        if (cs < 0) {
          const back = this.tint(b, rgb(paper));
          const dw = back.width, dh = back.height;
          g.drawImage(back, c.u0 * dw, c.v0 * dh, (c.u1 - c.u0) * dw, (c.v1 - c.v0) * dh, (c.u0 - c.cx) * F.w, (c.v0 - c.cy) * F.h, (c.u1 - c.u0) * F.w, (c.v1 - c.v0) * F.h);
        } else {
          const sx0 = c.u0 * b.W, sy0 = c.v0 * b.H, sw = (c.u1 - c.u0) * b.W, sh = (c.v1 - c.v0) * b.H;
          g.drawImage(b.cv, sx0, sy0, sw, sh, (c.u0 - c.cx) * F.w, (c.v0 - c.cy) * F.h, (c.u1 - c.u0) * F.w, (c.v1 - c.v0) * F.h);
        }
        g.restore();
      }
      g.restore();
    },

    drawTitle(g, t, W, H, pal) {
      const T = this.title;
      if (!T) return;
      const age = t - T.t0;
      if (age > T.dur) { this.title = null; return; }
      const face = (window.VIZ_FONTS && window.VIZ_FONTS.has && window.VIZ_FONTS.has('Yellowtail')) ? '"Yellowtail", cursive' : 'cursive';
      const size = H * 0.1;
      g.save();
      g.font = size.toFixed(1) + 'px ' + face;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const tw = g.measureText(T.word).width;
      const cw = tw + size * 1.1, ch = size * 1.35;
      const cx = W * 0.5 + T.side * Math.max(0, W * 0.5 - cw * 0.5 - W * 0.07) * 0.6, cy = H * 0.84;
      g.translate(cx, cy);
      g.rotate(T.tilt);
      const u = H / 600;
      g.fillStyle = 'rgba(' + pal.shadow + ',0.3)';
      g.fillRect(-cw / 2 + 4 * u, -ch / 2 + 6 * u, cw, ch);
      g.fillStyle = rgb(pal.paper);
      g.fillRect(-cw / 2, -ch / 2, cw, ch);
      g.fillStyle = rgb(pal.ink);
      g.fillText(T.word, 0, size * 0.04);
      g.restore();
    },

    // Hooks for offline checks of the keying (not used by the app).
    _prep: prep, _bake: bake, _HEADS: HEADS, _PALETTES: PALETTES,
  });
})();
