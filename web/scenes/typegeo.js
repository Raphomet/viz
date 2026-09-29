// Contour Type (spike) — type as real geometry.
//
// A capability spike for two libraries canvas fillText cannot stand in for:
// fontkit 2.0.4 reads the glyph outlines of a variable font at any point on
// its axes, and clipper2-ts 2.0.1 offsets and booleans those outlines
// robustly. The word becomes a landmass: offset outward into a topographic
// stack of contour lines, offset inward into an inline, merged with its
// neighbours into one shape, XORed with a travelling sun, sliced by the clap,
// and ridden by runners that follow the sampled contour polylines.
//
// Neither library is the one the research doc led with (2026-09-28):
// - clipper2-js 1.2.4's ClipperOffset is broken: a 100-unit square inflated
//   by 20 with miter joins comes back as a six-point zig-zag, and round joins
//   leave fans of spokes on every curve. clipper2-ts is a maintained port of
//   the same library and gets both right.
// - opentype.js 2.0.0 applies gvar wrongly away from the default width: 60 of
//   900 glyph/axis samples of Anybody (A-Z, 0-9 over 5 weights x 5 widths)
//   came back displaced, "I" at 850/120 sat a whole cap height below the
//   baseline and "M" at 900/62 was 5,400 units off. fontkit matched the
//   expected metrics everywhere and lays out a word in ~0.6 ms.
//
// Loading: both are ES modules bundled by jsDelivr's +esm and pulled in with
// dynamic import() (fontkit's bundle imports its own dependencies, all from
// jsDelivr); the font is fetched from assets/ beside the page. Preload is held
// open with p5's own counter until all three arrive, capped at 15 s so a dead
// CDN never hangs the app; without them the scene prints the word with
// fillText and says why.
(function () {
  'use strict';

  const FK_URL = 'https://cdn.jsdelivr.net/npm/fontkit@2.0.4/+esm';
  const CL_URL = 'https://cdn.jsdelivr.net/npm/clipper2-ts@2.0.1/+esm';
  const FONT_URL = 'assets/Anybody-Variable.ttf';

  const BAR = 4 * 60 / 124;
  const Q = 8;                 // clipper works in integers: 1/8 virtual unit
  const NW = 13;               // cached wght levels, 100..900
  const WD = [62, 81, 100, 119, 138];  // cached wdth levels
  const MAX_RINGS = 48;
  const INNER = 3;             // inline rings inside the letters
  const INNER_SP = 3.2;
  // Offsets computed per frame. The stack for a new word or axis level is
  // built a few rings a frame, nearest ring first, so a word change never
  // stalls a frame; the reveal grows outward no faster than the build.
  const BUDGET = 8;
  // Ring k sits at ringD(k): tight at the letters and opening outward, like
  // the height lines of a steep island, so the first rings keep the
  // letterforms and the outer ones reach the edges of the stage.
  function ringD(k, sp) { return sp * (k + 1) * (0.5 + 0.012 * (k + 1)); }

  const INKS = [
    { name: 'Riso · blue + fluoro pink', colors: ['#F1ECE1', '#2A4D9A', '#F0527C'] },
    { name: 'Survey · green + ochre', colors: ['#ECE6D2', '#2E5B4E', '#D8962A'] },
    { name: 'Newsprint · black + red', colors: ['#E8E3D6', '#222222', '#D5352C'] },
    { name: 'Night · cream + orange', colors: ['#14161B', '#D8D0BA', '#FF7A33'] },
  ];

  const PRESETS = {
    calm: { rings: 9, runners: 130, bassWeight: 330, flow: 0.55 },
    drop: { rings: 48, runners: 460, bassWeight: 520, flow: 1.5 },
  };
  const DRIVE = ['rings', 'runners', 'bassWeight', 'flow'];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function rgbOf(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const x = rgbOf(a), y = rgbOf(b);
    const c = (i) => Math.round(x[i] + (y[i] - x[i]) * t);
    return 'rgb(' + c(0) + ',' + c(1) + ',' + c(2) + ')';
  }
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
  function parseWords(s) {
    const w = String(s == null ? '' : s).split(/\s*[\/\n\r]\s*/).map((x) => x.trim()).filter(Boolean);
    return w.length ? w.map((x) => x.slice(0, 16)) : ['VIZ'];
  }
  // ---------------------------------------------------------------- geometry

  // Path commands ({type, x, y, x1, y1, x2, y2}, y down) -> clipper paths
  // (integer, Q per unit), shifted.
  function flatten(C, cmds, tol, dx, dy) {
    const out = [];
    let cur = null, x = 0, y = 0;
    const P = (a, b) => cur.push(({ x: Math.round((a + dx) * Q), y: Math.round((b + dy) * Q) }));
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      if (c.type === 'M') { cur = []; out.push(cur); x = c.x; y = c.y; P(x, y); }
      else if (c.type === 'L') { x = c.x; y = c.y; P(x, y); }
      else if (c.type === 'Q') {
        const n = Math.max(1, Math.ceil((Math.hypot(c.x1 - x, c.y1 - y) + Math.hypot(c.x - c.x1, c.y - c.y1)) / tol));
        for (let j = 1; j <= n; j++) {
          const t = j / n, u = 1 - t;
          P(u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y);
        }
        x = c.x; y = c.y;
      } else if (c.type === 'C') {
        const n = Math.max(1, Math.ceil((Math.hypot(c.x1 - x, c.y1 - y) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2)) / tol));
        for (let j = 1; j <= n; j++) {
          const t = j / n, u = 1 - t;
          P(u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
        }
        x = c.x; y = c.y;
      }
    }
    return out.filter((p) => p.length > 2);
  }

  function offset(C, paths, d) {
    const co = new C.ClipperOffset(2, 0.3 * Q);
    co.addPaths(paths, C.JoinType.Round, C.EndType.Polygon);
    const s = [];
    co.execute(d * Q, s);
    return s;
  }

  function toPath2D(paths, into) {
    const g = into || new Path2D();
    for (const p of paths) {
      if (p.length < 3) continue;
      g.moveTo(p[0].x / Q, p[0].y / Q);
      for (let i = 1; i < p.length; i++) g.lineTo(p[i].x / Q, p[i].y / Q);
      g.closePath();
    }
    return g;
  }

  // Closed polylines with cumulative arc length, for runners to ride.
  function toTracks(paths) {
    const subs = [];
    let total = 0;
    for (const p of paths) {
      const n = p.length;
      if (n < 3) continue;
      const xs = new Float32Array(n + 1), ys = new Float32Array(n + 1), cum = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const q = p[i % n];
        xs[i] = q.x / Q; ys[i] = q.y / Q;
        if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
      }
      const len = cum[n];
      if (len < 8) continue;
      subs.push({ xs, ys, cum, len, start: total });
      total += len;
    }
    return { subs, total };
  }

  function pointOn(sub, s, out) {
    s = ((s % sub.len) + sub.len) % sub.len;
    const cum = sub.cum;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1;
    const f = (s - cum[lo]) / seg;
    out.x = sub.xs[lo] + (sub.xs[hi] - sub.xs[lo]) * f;
    out.y = sub.ys[lo] + (sub.ys[hi] - sub.ys[lo]) * f;
    return out;
  }

  // A half-plane as a big quad on one side of a line through (cx, cy).
  function halfPlane(C, cx, cy, ang, side) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy * side, ny = dx * side, R = 3000;
    const pts = [[cx - dx * R, cy - dy * R], [cx + dx * R, cy + dy * R],
      [cx + dx * R + nx * R, cy + dy * R + ny * R], [cx - dx * R + nx * R, cy - dy * R + ny * R]];
    return [pts.map((q) => ({ x: Math.round(q[0] * Q), y: Math.round(q[1] * Q) }))];
  }

  VIZ.register({
    id: 'typegeo',
    name: 'Contour Type (spike)',
    order: 991,

    params: [
      { key: 'displayText', label: 'Words (split with /)', type: 'text', default: 'DEEP / VIZ / FIELD' },
      { key: 'colorPalette', label: 'Inks', type: 'palette', palettes: INKS, default: 0 },
      { key: 'rings', label: 'Contour lines', type: 'range', min: 2, max: MAX_RINGS, default: PRESETS.calm.rings, step: 1 },
      { key: 'spacing', label: 'Line spacing', type: 'range', min: 5, max: 14, default: 8, step: 1 },
      { key: 'weight', label: 'Weight', type: 'range', min: 100, max: 900, default: 280, step: 1 },
      { key: 'bassWeight', label: 'Bass → weight', type: 'range', min: 0, max: 700, default: PRESETS.calm.bassWeight, step: 1 },
      { key: 'width', label: 'Width', type: 'range', min: 62, max: 138, default: 92, step: 1 },
      { key: 'widthBand', label: 'Width follows band', type: 'band', default: 3 },
      { key: 'cut', label: 'Cut', type: 'select', options: ['Sun disc (XOR)', 'Horizon band (XOR)', 'Knife only'], default: 0 },
      { key: 'runners', label: 'Runners', type: 'range', min: 0, max: 600, default: PRESETS.calm.runners, step: 1 },
      { key: 'flow', label: 'Flow', type: 'range', min: 0, max: 2, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'bars', label: 'Bars per word', type: 'range', min: 1, max: 32, default: 8, step: 1 },
      { key: 'sensitivity', label: 'Reaction', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [{ id: 'next', label: 'Next word', run() { this.forceNext = true; } }],

    gallery: {
      title: 'Contour Type (spike)',
      technique: 'fontkit 2.0.4 reads glyph outlines from a bundled variable font (Anybody, wdth + wght) at any axis position; the outlines are flattened and unioned with clipper2-ts 2.0.1 so tight letters merge into one landmass, then offset outward into up to 48 round-joined contour rings and inward into a three-line inline. Stacks are cached per word, spacing and quantised axis level (13 weights x 5 widths), built a few rings a frame, and crossfaded between neighbouring levels; the solid letters are re-cut from the exact axis values every frame. The fill is an even-odd XOR of the unioned word with a travelling sun disc or horizon band; the clap slices the word with two half-plane intersections that slide apart and heal. Runners ride the contour polylines by arc length. Two riso inks, multiplied on paper (screen on the night ground).',
      brief: 'A word as a topographic map of itself, printed in two riso inks. Contour lines ring the letters like the height lines of an island; in the calm there are a handful, and the drop reveals the full stack sweeping out to the edges of the stage, the index contours turning to the second ink. The bass swells the weight axis so the letters fatten and the whole map shoulders outward with them; the band chosen for width (the pad and clap by default) stretches or condenses the word. Each kick sends one contour ring out from the letters across the map, a single line in the second ink; each clap slices the word with a knife at a new angle, the halves sliding apart and healing. A sun disc drifts across, knocking the letters out where it overlaps them, and runners travel the contour lines like traffic, more and faster in the drop, glinting with the hats.',
      lineage: [
        'Capability spike, 2026-09-28, for docs/research/2026-09-28-js-libraries.md item 7 ("Letterpress Contours"): glyph outlines + variable axes + robust offsetting.',
        'Topographic maps and contour typography (the offset-outline posters of the 1970s wood-type revival, inline display faces), riso two-ink printing.',
        'Kin to Text V2 (web/scenes/v2/text.js), which samples a rasterised word; here the outline itself is the material.',
      ],
    },

    preload(p) {
      if (this.lib || this.loading) return;
      this.loading = true;
      const self = this;
      const hold = typeof p._incrementPreload === 'function';
      let released = false;
      if (hold) p._incrementPreload();
      const release = () => { if (!released) { released = true; if (hold) p._decrementPreload(); } };
      const timer = setTimeout(() => { if (!self.lib) self.loadError = 'libraries timed out'; release(); }, 15000);
      Promise.all([
        import(FK_URL),
        import(CL_URL),
        fetch(FONT_URL).then((r) => { if (!r.ok) throw new Error(FONT_URL + ' ' + r.status); return r.arrayBuffer(); }),
      ]).then(([fk, C, buf]) => {
        const create = fk.create || (fk.default && fk.default.create);
        const font = create(new Uint8Array(buf));
        const os2 = font['OS/2'] || {};
        self.lib = { C, font, upm: font.unitsPerEm, cap: (os2.capHeight || font.unitsPerEm * 0.7) / font.unitsPerEm };
      }).catch((err) => {
        self.loadError = String(err && err.message || err);
        console.warn('typegeo: ' + self.loadError);
      }).then(() => { clearTimeout(timer); release(); });
    },

    enter() {
      this.lastT = null;
    },

    init(W, H) {
      const rand = rng(991);
      this.cache = new Map();
      this.wordIdx = 0;
      this.timer = 0;
      this.word = null;
      this.prev = null;
      this.pulses = [];
      this.slice = null;
      this.run = [];
      this.rand = rand;
      this.env = { bass: 0, wd: 0.3, hat: 0, energy: 0, kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0,
        low: 0, dropOn: false, auto: 0, reveal: 0, clock: 0, di: 2, prevDi: 2, dTr: 1, sliceN: 0 };
      this.W = W; this.H = H;
      // Paper grain: a small seeded noise tile, laid as a pattern.
      const tile = document.createElement('canvas');
      tile.width = tile.height = 192;
      const tg = tile.getContext('2d');
      const img = tg.createImageData(192, 192);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 200 + Math.floor(55 * rand() * rand() + 30 * rand());
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
        img.data[i + 3] = 255;
      }
      tg.putImageData(img, 0, 0);
      this.grainTile = tile;
      this.grain = null;
    },

    listen(signals, dt) {
      const e = this.env;
      // Slow swell: the drop's bass is sidechained to the kick, so a fast
      // follower would pump the weight (and every ring) on each beat.
      e.bass = ease(e.bass, (signals[1] + signals[2]) / 200, 1.3, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 8, dt);
      e.energy = ease(e.energy, (signals[0] + signals[1] + signals[2] + signals[6]) / 400, 0.8, dt);
      const kick = signals[0] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      e.ks = ease(e.ks, kick, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      let kickNow = 0;
      if (e.kf - e.ks > 0.12 && e.kWait === 0) { kickNow = clamp((e.kf - e.ks) * 3, 0.4, 1); e.kWait = 0.2; }
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      let clapNow = false;
      if (e.cf - e.cs > 0.08 && e.cWait === 0) { clapNow = true; e.cWait = 0.35; }
      e.low = ease(e.low, signals[1], 1.2, dt);
      let dropStart = false;
      if (!e.dropOn && e.low > 27) { e.dropOn = true; dropStart = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kickNow, clapNow, dropStart };
    },

    // Font size for a word: the widest cached version fills ~84% of the stage
    // width and caps stay under ~40% of its height.
    sizeFor(word, W, H) {
      const L = this.lib, key = word + '|' + Math.round(W) + 'x' + Math.round(H);
      if (this.sizeKey === key) return this.size;
      const w100 = Math.max(1, this.glyphRun(word, 900, WD[WD.length - 1], 100).width);
      this.size = Math.min(100 * W * 0.84 / w100, H * 0.4 / L.cap);
      this.sizeKey = key;
      return this.size;
    },

    // Tight tracking that tightens with weight, so heavy letters touch and
    // the union merges them into one shape.
    track(wght) { return -0.012 - 0.03 * (wght - 100) / 800; },

    // The word at one axis position as path commands in stage units (y down,
    // baseline at 0), laid out by fontkit with kerning and our tracking.
    glyphRun(word, wght, wdth, size) {
      const L = this.lib, f = L.font.getVariation({ wght, wdth });
      const run = f.layout(word);
      const s = size / L.upm, track = this.track(wght) * L.upm;
      const cmds = [];
      let pen = 0;
      for (let i = 0; i < run.glyphs.length; i++) {
        const ox = pen + (run.positions[i].xOffset || 0), oy = run.positions[i].yOffset || 0;
        const X = (v) => (ox + v) * s, Y = (v) => -(oy + v) * s;
        for (const c of run.glyphs[i].path.commands) {
          const a = c.args;
          if (c.command === 'moveTo') cmds.push({ type: 'M', x: X(a[0]), y: Y(a[1]) });
          else if (c.command === 'lineTo') cmds.push({ type: 'L', x: X(a[0]), y: Y(a[1]) });
          else if (c.command === 'quadraticCurveTo') cmds.push({ type: 'Q', x1: X(a[0]), y1: Y(a[1]), x: X(a[2]), y: Y(a[3]) });
          else if (c.command === 'bezierCurveTo') cmds.push({ type: 'C', x1: X(a[0]), y1: Y(a[1]), x2: X(a[2]), y2: Y(a[3]), x: X(a[4]), y: Y(a[5]) });
        }
        pen += run.positions[i].xAdvance + (i < run.glyphs.length - 1 ? track : 0);
      }
      return { cmds, width: pen * s };
    },

    outline(word, wght, wdth, size) {
      const L = this.lib;
      const g = this.glyphRun(word, wght, wdth, size);
      const dx = -g.width / 2, dy = size * L.cap / 2;
      return L.C.union(flatten(L.C, g.cmds, 3, dx, dy), L.C.FillRule.NonZero);
    },

    stackFor(word, wi, di, size, spacing) {
      const key = word + '|' + wi + '|' + di + '|' + spacing + '|' + size.toFixed(2);
      let st = this.cache.get(key);
      if (!st) {
        st = { key, wi, di, spacing, base: null, word, size, rings: [], tracks: [], inner: null, used: 0 };
        this.cache.set(key, st);
      }
      return st;
    },

    // One unit of build work on a stack; returns false when it is complete.
    build(st) {
      const C = this.lib.C;
      if (!st.base) {
        // Simplified first: offsetting cost is almost all round joins at
        // vertices, and a 0.35-unit simplification cut it from ~4.5 ms to
        // ~0.3 ms a ring (node, 'FIELD') with no visible change to the rings.
        st.base = C.simplifyPaths(this.outline(st.word, 100 + 800 * st.wi / (NW - 1), WD[st.di], st.size), 0.35 * Q, true);
        return true;
      }
      if (!st.inner) {
        const g = new Path2D();
        for (let i = 1; i <= INNER; i++) toPath2D(offset(C, st.base, -INNER_SP * i), g);
        st.inner = g;
        return true;
      }
      const k = st.rings.length;
      if (k >= MAX_RINGS) return false;
      const paths = offset(C, st.base, ringD(k, st.spacing));
      st.rings.push(toPath2D(paths));
      st.tracks.push(toTracks(paths));
      return true;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT == null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.env || this.W !== W || this.H !== H) this.init(W, H);
      const e = this.env;
      const pal = (INKS[Math.round(params.colorPalette)] || INKS[0]).colors;
      const ground = pal[0], inkA = pal[1], inkB = pal[2];
      const lightGround = rgbOf(ground).reduce((a, b) => a + b, 0) > 380;
      const g = p.drawingContext;

      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = ground;
      g.fillRect(0, 0, W, H);

      if (!this.lib) {
        // No libraries: say so plainly rather than draw black.
        g.fillStyle = inkA;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '700 110px sans-serif';
        g.fillText(parseWords(params.displayText)[0], W / 2, H / 2);
        g.font = '14px sans-serif';
        g.fillText(this.loadError ? 'type geometry unavailable: ' + this.loadError : 'loading type geometry…', W / 2, H / 2 + 90);
        g.restore();
        return;
      }
      const C = this.lib.C;
      const sens = params.sensitivity;
      const ev = this.listen(signals, dt);
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 2.2 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      // How far into the drop look we are: the follower when it drives,
      // otherwise read off the ring count the performer has set.
      const dropAmt = Math.max(follow ? e.auto : 0, clamp((params.rings - 12) / (MAX_RINGS - 12), 0, 1));

      // ---- words
      const words = parseWords(params.displayText);
      this.timer += dt;
      let change = false;
      if (this.forceNext) { change = true; this.forceNext = false; }
      if (follow && ev.dropStart) change = true;
      if (this.timer >= Math.round(params.bars) * BAR) change = true;
      if (change && this.word) {
        this.wordIdx = (this.wordIdx + 1) % words.length;
        this.timer = 0;
      }
      this.wordIdx %= words.length;
      const word = words[this.wordIdx];
      const spacing = Math.round(params.spacing);
      const size = this.sizeFor(word, W, H);
      if (word !== this.word || size !== this.wordSize || spacing !== this.spacing) {
        if (this.word && this.lastLetters) this.prev = { letters: this.lastLetters, stack: this.lastStack, reveal: e.reveal, a: 1 };
        this.word = word; this.wordSize = size; this.spacing = spacing;
        e.reveal = 0;
        for (const r of this.run) r.k = -1;
        // Keep the old word's stacks only while they fade out.
        for (const [k, st] of this.cache) if (st.word !== word || st.size !== size || st.spacing !== spacing) {
          if (!this.prev || st !== this.prev.stack) this.cache.delete(k);
        }
      }

      // ---- axes. Weight: slow bass swell. Width: the chosen band, slowly,
      // quantised to a cached level with hysteresis and a glide between.
      const wght = clamp(params.weight + P.bassWeight * clamp(e.bass * 1.25, 0, 1) * Math.min(sens, 1.3), 100, 900);
      e.wd = ease(e.wd, signals[Math.round(params.widthBand)] / 100, 0.7, dt);
      const wdthWant = clamp(params.width + (e.wd - 0.3) * 70 * Math.min(sens, 1.3), WD[0], WD[WD.length - 1]);
      const dPos = (wdthWant - WD[0]) / (WD[1] - WD[0]);
      if (Math.abs(dPos - e.di) > 0.72 && e.dTr >= 1) {
        e.prevDi = e.di; e.di = clamp(Math.round(dPos), 0, WD.length - 1); e.dTr = 0;
      }
      e.dTr = Math.min(1, e.dTr + dt / 0.7);
      const dMix = smooth(e.dTr);
      const wdth = WD[e.prevDi] + (WD[e.di] - WD[e.prevDi]) * dMix;
      const wf = (wght - 100) / 800 * (NW - 1);
      const wlo = Math.min(NW - 2, Math.floor(wf)), wa = wf - wlo;
      const layers = [];
      const addL = (wi, di, a) => { if (a > 0.02) layers.push({ st: this.stackFor(word, wi, di, size, spacing), a }); };
      addL(wlo, e.di, (1 - wa) * dMix); addL(wlo + 1, e.di, wa * dMix);
      if (dMix < 1) { addL(wlo, e.prevDi, (1 - wa) * (1 - dMix)); addL(wlo + 1, e.prevDi, wa * (1 - dMix)); }
      layers.sort((a, b) => b.a - a.a);

      // ---- build: nearest ring first across the stacks on screen, then
      // warm the neighbouring weights so a bass swell finds them ready.
      let budget = BUDGET;
      const need = Math.min(MAX_RINGS, Math.ceil(e.reveal) + 3);
      for (let pass = 0; pass < MAX_RINGS + 2 && budget > 0; pass++) {
        let any = false;
        for (const L of layers) {
          const st = L.st;
          const have = (st.base ? 1 : 0) + (st.inner ? 1 : 0) + st.rings.length;
          if (have <= pass && st.rings.length < need && budget > 0) { this.build(st); budget--; any = true; }
        }
        if (!any) break;
      }
      if (budget > 0) {
        for (const dw of [1, -1, 2, -2, 3, -3]) {
          const wi = wlo + (dw > 0 ? dw : dw + 1);
          if (wi < 0 || wi >= NW) continue;
          const st = this.stackFor(word, wi, e.di, size, spacing);
          while (budget > 0 && this.build(st)) budget--;
          if (budget <= 0) break;
        }
      }
      const main = layers[0].st;

      // ---- reveal: calm shows a handful of rings, the drop sweeps out to all.
      const revealWant = clamp(P.rings, 0, MAX_RINGS);
      e.reveal = Math.min(ease(e.reveal, revealWant, e.reveal < revealWant ? 2.2 : 1.1, dt) + (e.reveal < revealWant ? 3 * dt : 0), revealWant + 0.5, main.rings.length);
      e.reveal = Math.max(0, e.reveal);
      e.clock += dt * (0.35 + 0.9 * P.flow * (0.4 + e.energy));

      // ---- events
      if (ev.kickNow && sens > 0) this.pulses.push({ d: 0, a: ev.kickNow });
      if (this.pulses.length > 3) this.pulses.splice(0, this.pulses.length - 3);
      if (ev.clapNow && sens > 0) {
        e.sliceN++;
        const r = this.rand;
        this.slice = { ang: -0.5 + (e.sliceN * 0.618 % 1) * 1.0 + (r() - 0.5) * 0.3, off: (r() - 0.5) * 0.35, t: 0 };
      }

      // ---- camera: a slow drift and sway over the map
      g.globalCompositeOperation = 'source-over';
      if (!this.grain) this.grain = g.createPattern(this.grainTile, 'repeat');
      g.globalAlpha = lightGround ? 0.5 : 0.07;
      g.globalCompositeOperation = lightGround ? 'multiply' : 'screen';
      g.fillStyle = this.grain;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;

      const cam = e.clock;
      // Flying slowly over the map: a wide Lissajous pan, a sway and a slow
      // breathing zoom, all on the energy clock so the music sets the speed.
      g.translate(W / 2 + 42 * Math.sin(cam * 0.11), H / 2 + 24 * Math.sin(cam * 0.083 + 1));
      g.rotate(0.05 * Math.sin(cam * 0.047));
      const zoom = 1 + 0.06 * Math.sin(cam * 0.061 + 2);
      g.scale(zoom, zoom);
      const blend = lightGround ? 'multiply' : 'screen';
      g.globalCompositeOperation = blend;
      g.lineJoin = 'round';
      g.lineCap = 'round';

      // ---- the previous word, fading
      if (this.prev) {
        const pv = this.prev;
        pv.a -= dt / 0.6;
        if (pv.a <= 0) { this.cache.delete(pv.stack.key); this.prev = null; }
        else {
          g.globalAlpha = pv.a * pv.a;
          g.strokeStyle = inkA;
          g.lineWidth = 0.8;
          const n = Math.min(pv.stack.rings.length, Math.ceil(pv.reveal));
          for (let k = 0; k < n; k++) g.stroke(pv.stack.rings[k]);
          g.fillStyle = inkB;
          g.fill(pv.letters, 'evenodd');
        }
      }

      // ---- contour rings
      const idxCol = mix(inkA, inkB, dropAmt);
      for (let k = 0; k < MAX_RINGS; k++) {
        const vis = clamp(e.reveal - k, 0, 1) * (1 - 0.5 * k / MAX_RINGS);
        if (vis <= 0.01) break;
        const index = (k + 1) % 5 === 0;
        g.strokeStyle = index ? idxCol : inkA;
        g.lineWidth = index ? 1.5 - 0.3 * dropAmt : 0.75;
        let tot = 0;
        for (const L of layers) if (L.st.rings.length > k) tot += L.a;
        if (tot <= 0) continue;
        for (const L of layers) {
          if (L.st.rings.length <= k) continue;
          g.globalAlpha = vis * L.a / tot;
          g.stroke(L.st.rings[k]);
        }
      }

      // ---- kick pulses: one ring travelling out through the map
      const maxD = ringD(Math.max(e.reveal, 4) + 2, spacing);
      for (let i = this.pulses.length - 1; i >= 0; i--) {
        const q = this.pulses[i];
        q.d += dt * (150 + 60 * P.flow);
        const f = q.d / maxD;
        if (f >= 1 || !main.base) { this.pulses.splice(i, 1); continue; }
        const ring = toPath2D(offset(C, main.base, q.d + 1.5));
        g.globalAlpha = clamp(q.a * Math.min(sens, 1.2), 0, 1) * (1 - f) * Math.min(1, q.d / 6);
        g.strokeStyle = inkB;
        g.lineWidth = 3.4;
        g.stroke(ring);
      }

      // ---- letters: exact axes, unioned, cut, XORed with the sun
      let letters = this.outline(word, wght, wdth, size);
      const cut = Math.round(params.cut);
      const extra = [];
      let sliceShift = null;
      if (this.slice) {
        const s = this.slice;
        s.t += dt;
        const env = s.t < 0.07 ? smooth(s.t / 0.07) : s.t < 0.3 ? 1 : 1 - smooth((s.t - 0.3) / 0.6);
        if (s.t > 0.9) this.slice = null;
        else {
          const amp = 16 * env * Math.min(sens, 1.2);
          const cx = s.off * W * 0.3, cy = 0;
          const dx = Math.cos(s.ang), dy = Math.sin(s.ang);
          const A = C.intersect(letters, halfPlane(C, cx, cy, s.ang, 1), C.FillRule.NonZero);
          const B = C.intersect(letters, halfPlane(C, cx, cy, s.ang, -1), C.FillRule.NonZero);
          const sep = 0.25;
          const tA = { x: dx * amp - dy * amp * sep, y: dy * amp + dx * amp * sep };
          const tB = { x: -dx * amp + dy * amp * sep, y: -dy * amp - dx * amp * sep };
          const mv = (paths, tr) => paths.map((pp) => pp.map((q) => ({ x: q.x + Math.round(tr.x * Q), y: q.y + Math.round(tr.y * Q) })));
          letters = mv(A, tA).concat(mv(B, tB));
          sliceShift = { cx, cy, ang: s.ang, tA, tB };
        }
      }
      const lp = toPath2D(letters);
      this.lastLetters = lp;
      this.lastStack = main;
      const fillPath = new Path2D();
      fillPath.addPath(lp);
      if (cut === 0) {
        const r = 92 + 18 * dropAmt;
        const sx = W * 0.22 * Math.sin(cam * 0.13), sy = H * 0.14 * Math.sin(cam * 0.19 + 0.8);
        fillPath.moveTo(sx + r, sy);
        fillPath.arc(sx, sy, r, 0, Math.PI * 2);
        fillPath.closePath();
      } else if (cut === 1) {
        const hh = 26 + 16 * dropAmt, yy = H * 0.2 * Math.sin(cam * 0.17);
        fillPath.rect(-W, yy - hh, 2 * W, 2 * hh);
      }
      g.globalAlpha = 1;
      g.fillStyle = inkB;
      g.fill(fillPath, 'evenodd');

      // ---- inline: inner offsets from the cached stack, cut with the letters
      const inl = (st, a) => {
        if (!st.inner) return;
        g.globalAlpha = a;
        if (!sliceShift) { g.stroke(st.inner); return; }
        for (const [side, tr] of [[1, sliceShift.tA], [-1, sliceShift.tB]]) {
          g.save();
          g.translate(tr.x, tr.y);
          const hp = toPath2D(halfPlane(C, sliceShift.cx, sliceShift.cy, sliceShift.ang, side));
          g.clip(hp);
          g.stroke(st.inner);
          g.restore();
        }
      };
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = ground;
      g.lineWidth = 0.9;
      for (const L of layers) inl(L.st, L.a);
      g.globalCompositeOperation = blend;

      // ---- runners along the contour polylines
      const nRun = Math.round(P.runners);
      while (this.run.length < nRun) this.run.push({ k: -1, s: 0, v: 0, ph: this.rand() * 6.283, len: 0 });
      if (this.run.length > nRun) this.run.length = nRun;
      const visRings = Math.max(1, Math.min(Math.floor(e.reveal), main.tracks.length));
      const pt = { x: 0, y: 0 }, pt2 = { x: 0, y: 0 };
      const speed = (18 + 40 * P.flow) * (0.6 + 0.8 * e.energy);
      g.strokeStyle = lightGround ? inkA : inkB;
      g.lineWidth = 1.6;
      const glints = [];
      if (main.tracks.length) {
        g.beginPath();
        for (let i = 0; i < this.run.length; i++) {
          const r = this.run[i];
          if (r.k < 0 || r.k >= visRings || !main.tracks[r.k] || !main.tracks[r.k].subs.length) {
            r.k = Math.floor(Math.pow(this.rand(), 0.8) * visRings);
            const tr = main.tracks[r.k];
            if (!tr || !tr.subs.length) { r.k = -1; continue; }
            r.u = this.rand();
            r.v = (r.k % 2 ? 1 : -1) * (0.7 + 0.6 * this.rand());
            r.len = 5 + 9 * this.rand();
          }
          const tr = main.tracks[r.k];
          r.u += r.v * speed * dt / Math.max(1, tr.total);
          r.u -= Math.floor(r.u);
          const at = r.u * tr.total;
          let sub = tr.subs[0];
          for (const sb of tr.subs) if (at >= sb.start) sub = sb;
          const s = at - sub.start;
          pointOn(sub, s, pt);
          pointOn(sub, s - Math.sign(r.v) * r.len * (0.8 + 0.6 * P.flow), pt2);
          const ringVis = clamp(e.reveal - r.k, 0, 1);
          if (ringVis < 0.5) continue;
          g.moveTo(pt2.x, pt2.y);
          g.lineTo(pt.x, pt.y);
          const flick = Math.sin(t * 9.1 + r.ph * 7) * 0.5 + 0.5;
          if (e.hat * sens > 0.12 && flick > 0.9 - 0.25 * e.hat) glints.push(pt.x, pt.y);
        }
        g.globalAlpha = 0.85;
        g.stroke();
      }
      if (glints.length) {
        g.fillStyle = inkB;
        g.globalAlpha = clamp(e.hat * 1.6 * sens, 0, 1);
        g.beginPath();
        for (let i = 0; i < glints.length; i += 2) {
          g.moveTo(glints[i] + 2.2, glints[i + 1]);
          g.arc(glints[i], glints[i + 1], 2.2, 0, Math.PI * 2);
        }
        g.fill();
      }
      g.restore();
    },
  });
})();
