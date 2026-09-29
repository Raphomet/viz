// Monoline: a small geometric capital alphabet drawn as strokes (lines and
// circular arcs on a 100-unit cap height), and a builder that typesets words
// into Bodymovin JSON for the lottie5 scene. Original to viz; public domain
// (CC0), like everything under assets/lottie.
//
// Why strokes, not a font: kinetic type in After Effects is at its best when
// letters are shape layers you can write on with a trim path, so the glyphs
// here are open paths from the start. lottie-web's own text layers render
// glyph outlines as fills and take no trim paths.
//
// Glyph syntax: `M x y` starts a stroke, `L x y` draws a line, `C cx cy r a0
// a1` an arc round (cx, cy) from angle a0 to a1 in degrees (0 = +x, 90 = down;
// a1 < a0 runs anticlockwise), `;` ends a stroke. `w` is the advance width
// before letter spacing.
(function (root) {
  'use strict';
  const L = root.VIZ_LOTTIE = root.VIZ_LOTTIE || {};

  const G = {
    A: [70, 'M0 100 L35 0 L70 100 ; M13 64 L57 64'],
    B: [60, 'M0 100 L0 0 L28 0 C28 24 24 -90 90 L0 48 ; M0 48 L32 48 C32 74 26 -90 90 L0 100'],
    C: [92, 'C50 50 50 -42 -318'],
    D: [76, 'M0 0 L0 100 L26 100 C26 50 50 90 -90 L0 0'],
    E: [54, 'M54 0 L0 0 L0 100 L54 100 ; M0 50 L44 50'],
    F: [54, 'M54 0 L0 0 L0 100 ; M0 50 L44 50'],
    G: [100, 'C50 50 50 -42 -360 L58 50'],
    H: [66, 'M0 0 L0 100 ; M66 0 L66 100 ; M0 50 L66 50'],
    I: [0, 'M0 0 L0 100'],
    J: [50, 'M50 0 L50 72 C25 72 25 0 180'],
    K: [62, 'M0 0 L0 100 ; M62 0 L0 60 ; M22 42 L62 100'],
    L: [50, 'M0 0 L0 100 L50 100'],
    M: [82, 'M0 100 L0 0 L41 72 L82 0 L82 100'],
    N: [66, 'M0 100 L0 0 L66 100 L66 0'],
    O: [100, 'C50 50 50 -90 270'],
    P: [58, 'M0 100 L0 0 L30 0 C30 26 26 -90 90 L0 52'],
    Q: [100, 'C50 50 50 -90 270 ; M62 62 L100 100'],
    R: [60, 'M0 100 L0 0 L30 0 C30 26 26 -90 90 L0 52 ; M26 52 L60 100'],
    S: [60, 'C30 25 25 -30 -270 C30 75 25 -90 150'],
    T: [64, 'M0 0 L64 0 ; M32 0 L32 100'],
    U: [64, 'M0 0 L0 68 C32 68 32 180 0 L64 0'],
    V: [70, 'M0 0 L35 100 L70 0'],
    W: [104, 'M0 0 L26 100 L52 26 L78 100 L104 0'],
    X: [64, 'M0 0 L64 100 ; M64 0 L0 100'],
    Y: [66, 'M0 0 L33 52 L66 0 ; M33 52 L33 100'],
    Z: [60, 'M0 0 L60 0 L0 100 L60 100'],
    0: [72, 'M0 36 C36 36 36 180 360 L72 64 C36 64 36 0 180 L0 36'],
    1: [30, 'M4 20 L30 0 L30 100'],
    2: [60, 'C30 28 28 -165 20 L0 100 L60 100'],
    3: [58, 'C28 26 26 -150 90 C28 75 25 -90 150'],
    4: [64, 'M46 100 L46 0 L0 70 L64 70'],
    5: [60, 'M56 0 L8 0 L4 44 C30 68 32 -140 150'],
    6: [62, 'M50 0 L8 52 ; C31 70 30 -180 180'],
    7: [60, 'M0 0 L60 0 L22 100'],
    8: [60, 'C30 24 24 -90 270 ; C30 74 26 -90 270'],
    9: [62, 'C31 30 30 0 360 ; M58 44 L14 100'],
    '!': [0, 'M0 0 L0 68 ; M0 98 L0 100'],
    '?': [54, 'C27 26 27 -165 60 L27 64 ; M27 98 L27 100'],
    '.': [0, 'M0 98 L0 100'],
    ',': [6, 'M6 94 L0 110'],
    '-': [40, 'M0 56 L40 56'],
    "'": [0, 'M0 0 L0 24'],
    '&': [70, 'M70 100 L10 30 C28 20 18 150 30 L8 70 C32 74 26 180 0 L66 60'],
    ' ': [36, ''],
  };
  const D = Math.PI / 180;

  // Glyph string -> open bezier paths in Bodymovin form, scaled and moved.
  function glyphPaths(d, sc, ox, oy) {
    const toks = d.replace(/([MLC;])/g, ' $1 ').trim().split(/[\s,]+/).filter(Boolean);
    const paths = [];
    let cur = null, k = 0;
    const pt = (x, y) => [+(ox + x * sc).toFixed(2), +(oy + y * sc).toFixed(2)];
    const fresh = () => { cur = { c: false, v: [], i: [], o: [] }; paths.push(cur); };
    const add = (p, inT) => { cur.v.push(p); cur.i.push(inT || [0, 0]); cur.o.push([0, 0]); };
    while (k < toks.length) {
      const c = toks[k++];
      if (c === ';') { cur = null; continue; }
      if (c === 'M') { fresh(); add(pt(+toks[k++], +toks[k++])); }
      else if (c === 'L') { if (!cur) fresh(); add(pt(+toks[k++], +toks[k++])); }
      else if (c === 'C') {
        const cx = +toks[k++], cy = +toks[k++], r = +toks[k++], a0 = +toks[k++], a1 = +toks[k++];
        const P = (a) => pt(cx + r * Math.cos(a * D), cy + r * Math.sin(a * D));
        const start = P(a0);
        if (!cur) { fresh(); add(start); }
        else {
          const last = cur.v[cur.v.length - 1];
          if (Math.hypot(last[0] - start[0], last[1] - start[1]) > 0.5) add(start);
        }
        const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90));
        const da = (a1 - a0) / n;
        const kk = (4 / 3) * Math.tan((da * D) / 4) * r * sc;
        for (let s = 0; s < n; s++) {
          const aA = a0 + da * s, aB = aA + da;
          cur.o[cur.o.length - 1] = [+(-Math.sin(aA * D) * kk).toFixed(2), +(Math.cos(aA * D) * kk).toFixed(2)];
          add(P(aB), [+(Math.sin(aB * D) * kk).toFixed(2), +(-Math.cos(aB * D) * kk).toFixed(2)]);
        }
      }
    }
    return paths;
  }

  // Word timeline, in frames at 60 fps: letters write on from 0 (staggered),
  // hold from about 1 s, and write off from OUT. The scene plays the three
  // parts as segments by setting each word's time remap.
  const OUT = 120, END = 170, HOLD = 60;

  // words: array of strings. Returns { data, meta } where data is a Bodymovin
  // comp with one precomp per word, placed twice (hero, giant).
  function build(words, o = {}) {
    const a = L.author;
    const { S, A, T, gr, sh, st, tm, rp, zz, sr, ks, shapeLayer, compLayer, comp, path } = a;
    const W = 1920, H = 1920, CX = W / 2, CY = H / 2;
    const EXT = o.ext || 6;
    const SP = 30;                         // letter spacing, in cap units
    const assets = [], meta = [];
    words.forEach((word, wi) => {
      const chars = [...word.toUpperCase()].filter((ch) => G[ch]);
      let adv = 0;
      const pos = chars.map((ch) => { const x = adv; adv += G[ch][0] + SP; return x; });
      const width = Math.max(1, adv - SP);
      const sc = Math.min(o.maxCap || 3.1, (o.maxWidth || 1560) / width);
      const cap = 100 * sc;
      const x0 = CX - (width * sc) / 2, y0 = CY - cap / 2;
      let li = 0;
      const letters = [];
      chars.forEach((ch, n) => {
        if (ch === ' ' || !G[ch][1]) return;
        const j = li++;
        const gx = x0 + pos[n] * sc, gw = G[ch][0] * sc;
        const cx = +(gx + gw / 2).toFixed(1), cy = +(y0 + cap / 2).toFixed(1);
        const d0 = 3 * j, o0 = OUT + 2 * j;
        const p = A([[d0, [cx, cy + 0.45 * cap], 'back'], [d0 + 26, [cx, cy], 'hold'], [o0, [cx, cy], 'in'], [o0 + 18, [cx, cy - 0.35 * cap]]]);
        p.vz = 'L.p.' + j;
        const s = A([[d0, [35, 35], 'back'], [d0 + 26, [100, 100], 'hold'], [o0, [100, 100], 'in'], [o0 + 18, [70, 70]]]);
        s.vz = 'L.s.' + j;
        letters.push(gr(ch + ' ' + j, glyphPaths(G[ch][1], sc, gx, y0).map((pp) => sh(pp)).concat([
          tm(A([[o0, 0, 'in'], [o0 + 16, 100]]), A([[d0, 0, 'out'], [d0 + 24, 100]]), 0, 1),
          st(T('ink.stroke', [1, 1, 1, 1]), T('weight', 14)),
        ]), { a: [cx, cy], p, s, r: T('L.r.' + j, 0) }));
      });
      // The extrusion: the whole word repeated behind itself. The group is
      // moved back by the full depth so the top copy sits at home.
      const wordGroup = gr('word', letters.concat([
        rp(EXT, 0, { p: T('ext.p', [0, 0]), so: T('ext.so', 30), eo: 100 }),
      ]), { p: T('ext.home', [0, 0]) });
      assets.push({ id: 'w' + wi, layers: [shapeLayer('word ' + wi, [wordGroup])] });
      meta.push({ word, letters: li, width: width * sc, cap, x0, y0 });
    });
    const layers = [];
    // Glints (hats).
    const glints = [];
    for (let j = 0; j < 6; j++) glints.push(gr('glint ' + j, [sr({ sy: 1, pt: 4, ir: 7, or: 30 }), a.fl(T('ink.glint', [1, 1, 1, 1]))],
      { p: T('glint.p.' + j, [CX, CY]), s: T('glint.s.' + j, [0, 0]) }));
    layers.push(shapeLayer('glints', glints));
    // Underline swoosh (snare): a smooth zig-zag, written on and off.
    layers.push(shapeLayer('underline', [gr('swoosh', [
      sh(path([[-500, 0], [500, 0]], null, null, false)),
      zz(T('under.zz', 18), 7, 2),
      tm(T('under.s', 0), T('under.e', 0), 0, 1),
      st(T('ink.under', [1, 1, 1, 1]), T('under.w', 12)),
    ], { p: T('under.p', [CX, CY + 200]), s: T('under.sc', [100, 100]) })]));
    words.forEach((_, wi) => layers.push(compLayer('hero ' + wi, 'w' + wi, W, H, { tm: T('hero.tm.' + wi, -1) })));
    words.forEach((_, wi) => layers.push(compLayer('giant ' + wi, 'w' + wi, W, H, {
      tm: T('giant.tm.' + wi, -1),
      ks: Object.assign(ks(), { a: S([CX, CY, 0]), p: T('giant.p.' + wi, [CX, CY, 0]), s: T('giant.s.' + wi, [300, 300, 100]), o: T('giant.o.' + wi, 100) }),
    })));
    const data = comp({ nm: 'Kinetic', w: W, h: H, fr: 60, op: 60, assets, layers });
    data.vizMeta = { words: meta, out: OUT / 60, end: END / 60, hold: HOLD / 60, ext: EXT };
    return data;
  }

  L.type = { glyphs: G, glyphPaths, build, OUT, END, HOLD };
})(typeof globalThis !== 'undefined' ? globalThis : this);
