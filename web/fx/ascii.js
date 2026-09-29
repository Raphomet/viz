// ASCII / glyph mosaic: each cell of the frame becomes one glyph, chosen by
// the cell's tone from a set ordered by how much ink each glyph carries.
// The rack has no effect-owned textures, so the glyph atlas is drawn in-page
// at load (a 2D canvas: the system monospace font for ASCII, canvas paths for
// the others), read back as 16x16 one-bit bitmaps, and baked into the shader
// as a constant array. Sets: ASCII, blocks (Bayer-ordered 4x4 tiles), invented
// katakana-like stroke glyphs, dots. Light draws glyphs in the scene's colour
// on black; Ink draws them on paper; Auto crossfades between the two by the
// frame's mean brightness (a bright poster as light-on-black was a white
// field of '@', 2026-09-28). Music: the bass thickens every cell's
// glyph; hats flip scattered cells to random glyphs for a moment (sparkle
// confined to single cells, never the frame).
(function () {
  var G = 16;           // glyphs per set
  var SETS = 4;

  function canvas() {
    var c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    return c;
  }
  // 16x16 alpha -> 8 words, two rows per word, top row first.
  function bits(ctx) {
    var d = ctx.getImageData(0, 0, 16, 16).data, words = [], cov = 0;
    for (var r = 0; r < 16; r += 2) {
      var w = 0;
      for (var k = 0; k < 2; k++) for (var x = 0; x < 16; x++) {
        if (d[((r + k) * 16 + x) * 4 + 3] > 110) { w |= (1 << (k * 16 + x)); cov++; }
      }
      words.push(w >>> 0);
    }
    return { words: words, cov: cov };
  }
  function glyphFrom(draw) {
    var c = canvas(), ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    draw(ctx);
    return bits(ctx);
  }
  var BLANK = { words: [0, 0, 0, 0, 0, 0, 0, 0], cov: 0 };
  // Pick 15 candidates spread evenly across the coverage range, after blank.
  function spread(cands) {
    cands = cands.filter(function (g) { return g.cov > 0; }).sort(function (a, b) { return a.cov - b.cov; });
    var out = [BLANK], used = {}, max = cands.length ? cands[cands.length - 1].cov : 1;
    for (var i = 1; i < G; i++) {
      var target = max * Math.pow(i / (G - 1), 1.15), best = -1, bd = 1e9;
      cands.forEach(function (g, j) { var dd = Math.abs(g.cov - target); if (!used[j] && dd < bd) { bd = dd; best = j; } });
      if (best < 0) best = cands.length - 1;
      used[best] = true;
      out.push(cands[best]);
    }
    return out.sort(function (a, b) { return a.cov - b.cov; });
  }

  var sets = [];
  // ASCII from the system monospace font.
  var chars = ".,'`:;-~_^\"=+*!?/\\|()[]{}<>1ilrcvxzsoaekhbdpqwmXYZ#%&@$8BMWN0";
  sets.push(spread(chars.split('').map(function (ch) {
    return glyphFrom(function (ctx) {
      ctx.font = 'bold 15px Menlo, "DejaVu Sans Mono", Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, 8, 8.5);
    });
  })));
  // Blocks: a 4x4 grid of 4px tiles filled in Bayer order, 0..15 tiles.
  var B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var blocks = [];
  for (var i = 0; i < G; i++) blocks.push(glyphFrom(function (ctx) {
    for (var t = 0; t < 16; t++) if (B4[t] < i) ctx.fillRect((t % 4) * 4, Math.floor(t / 4) * 4, 4, 4);
  }));
  blocks[0] = BLANK;
  sets.push(blocks);
  // Invented katakana-like glyphs: 1-5 short strokes between points of a
  // 4x4 anchor grid, seeded so the set is the same on every load.
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var A = [3, 6.5, 9.5, 13], kana = [];
  for (var n = 0; n < 60; n++) {
    var strokes = 1 + Math.floor(rnd() * 5);
    kana.push(glyphFrom(function (ctx) {
      ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      for (var s = 0; s < strokes; s++) {
        var ax = Math.floor(rnd() * 4), ay = Math.floor(rnd() * 4);
        var bx = Math.max(0, Math.min(3, ax + Math.floor(rnd() * 5) - 2));
        var by = Math.max(0, Math.min(3, ay + Math.floor(rnd() * 5) - 2));
        if (ax === bx && ay === by) by = ay < 2 ? ay + 2 : ay - 2;
        ctx.beginPath(); ctx.moveTo(A[ax], A[ay]);
        if (rnd() < 0.25) ctx.quadraticCurveTo(A[bx], A[ay], A[bx], A[by]);
        else ctx.lineTo(A[bx], A[by]);
        ctx.stroke();
      }
    }));
  }
  sets.push(spread(kana));
  // Dots of growing area.
  var dots = [];
  for (var d = 0; d < G; d++) dots.push(glyphFrom(function (ctx) {
    ctx.beginPath(); ctx.arc(8, 8, Math.sqrt(d / (G - 1)) * 8.6, 0, Math.PI * 2); ctx.fill();
  }));
  dots[0] = BLANK;
  sets.push(dots);

  var words = [];
  sets.forEach(function (set) { set.forEach(function (g) { words = words.concat(g.words); }); });
  var N = words.length;   // SETS * G * 8
  var table = 'const uint GLYPHS[' + N + '] = uint[' + N + '](' +
    words.map(function (w) { return '0x' + w.toString(16) + 'u'; }).join(',') + ');\n';

  VIZ_FX.register({
    id: 'ascii',
    name: 'ASCII',
    group: 'texture',
    params: [
      { key: 'rows', label: 'Rows', min: 16, max: 160, step: 1, default: 48 },
      { key: 'set', label: 'ASCII / blocks / kana / dots', min: 0, max: SETS - 1, step: 1, default: 0 },
      { key: 'style', label: 'Auto / light / ink', min: 0, max: 2, step: 1, default: 0 },
      { key: 'colour', label: 'Colour', min: 0, max: 1, default: 1 },
      { key: 'backing', label: 'Backing', min: 0, max: 1, default: 0.15 },
      { key: 'swell', label: 'Bass weight', min: 0, max: 1, default: 0.4 },
      { key: 'sparkle', label: 'Hat sparkle', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      { scale: 1 / 4, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = texture(uInput, vUv + vec2(-t.x, -t.y)).rgb + texture(uInput, vUv + vec2(t.x, -t.y)).rgb +
           texture(uInput, vUv + vec2(-t.x,  t.y)).rgb + texture(uInput, vUv + vec2(t.x,  t.y)).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}` },
      // 1: the frame's mean brightness, for Auto (an 8x8 grid of taps).
      { scale: 1 / 64, frag: `
void main() {
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++)
    m += luma(clamp(texture(uPass0, (vec2(float(x), float(y)) + 0.5) / 8.0).rgb, 0.0, 1.0));
  fragColor = vec4(vec3(m / 64.0), 1.0);
}` },
      { frag: table + `
float bitAt(int g, ivec2 p) {
  if (p.x < 0 || p.y < 0 || p.x > 15 || p.y > 15) return 0.0;
  int row = 15 - p.y;
  uint w = GLYPHS[g * 8 + row / 2];
  return float((w >> uint((row & 1) * 16 + p.x)) & 1u);
}
float glyph(int g, vec2 f) {
  vec2 q = f * 16.0 - 0.5;
  vec2 i = floor(q), t = q - i;
  ivec2 ii = ivec2(i);
  float a = bitAt(g, ii), b = bitAt(g, ii + ivec2(1, 0)), c = bitAt(g, ii + ivec2(0, 1)), d = bitAt(g, ii + ivec2(1, 1));
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
void main() {
  float cell = uRes.y / floor(p_rows + 0.5);
  vec2 px = vUv * uRes;
  vec2 cid = floor(px / cell), f = fract(px / cell);
  vec2 cuv = (cid + 0.5) * cell / uRes;
  vec2 o = vec2(cell * 0.25) / uRes;
  vec3 c = 0.25 * (texture(uPass0, cuv + vec2(-o.x, -o.y)).rgb + texture(uPass0, cuv + vec2(o.x, -o.y)).rgb +
                   texture(uPass0, cuv + vec2(-o.x,  o.y)).rgb + texture(uPass0, cuv + vec2(o.x,  o.y)).rgb);
  c = clamp(c, 0.0, 1.0);
  float l = luma(c);
  int style = int(floor(p_style + 0.5));
  float inkW = style == 0 ? smoothstep(0.3, 0.5, texture(uPass1, vec2(0.5)).r) : float(style == 2);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float lift = 1.0 / (1.0 + p_swell * 1.2 * bass);
  // Hats: a scattering of cells shows a random glyph for 1/12 s.
  float slot = floor(uTime * 12.0);
  bool flip = hash12(cid + slot * 0.731) < uHat * p_sparkle * 0.3;
  int flipTo = 1 + int(hash12(cid * 1.3 + slot) * 14.99);
  int set = int(clamp(floor(p_set + 0.5), 0.0, ${SETS - 1}.0)) * 16;
  // Sharp edges once a glyph is larger than its bitmap; soft when minified.
  float sharp = clamp(cell / 16.0 - 0.5, 0.0, 1.0);
  vec3 outc = vec3(0.0);
  if (inkW < 1.0) {
    // A black floor keeps a dark ground empty; the curve opens the mids.
    int gi = int(floor(pow(clamp((l - 0.04) / 0.85, 0.0, 1.0), 0.7 * lift) * 15.99));
    if (flip && gi > 0) gi = flipTo;
    float m = glyph(set + gi, f);
    m = mix(m, smoothstep(0.3, 0.7, m), sharp);
    float mx = max(c.r, max(c.g, c.b));
    vec3 lit = mix(vec3(0.92, 0.95, 0.9), c / max(mx, 0.05), p_colour) * (0.45 + 0.55 * sqrt(mx));
    outc += (1.0 - inkW) * mix(c * p_backing * 0.5, lit, m);
  }
  if (inkW > 0.0) {
    int gi = int(floor(clamp(pow(1.0 - l, lift), 0.0, 1.0) * 15.99));
    if (flip && gi > 0) gi = flipTo;
    float m = glyph(set + gi, f);
    m = mix(m, smoothstep(0.3, 0.7, m), sharp);
    vec3 paper = mix(vec3(0.95, 0.93, 0.88), c, p_backing * 0.35);
    float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    vec3 inkc = mix(vec3(0.08, 0.08, 0.1), c * 0.8, p_colour * smoothstep(0.02, 0.2, chroma));
    outc += inkW * mix(paper, inkc, m);
  }
  fragColor = vec4(outc, 1.0);
}` }
    ]
  });
})();
