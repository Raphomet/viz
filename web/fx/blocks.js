// Glitch blocks: a broken JPEG / MPEG stream. The frame is cut into
// macroblocks; each is rebuilt from a 4x4 DCT in YCbCr with its coefficients
// quantised (high frequencies hardest, chroma harder than luma), which gives
// the stepped gradients and ringing of a starved codec. Compression sets that
// everywhere. Glitched blocks come in horizontal runs, the way a corrupt
// slice breaks a decoded frame: inside a run, blocks are copied from the
// wrong place (a bad motion vector), smeared down from their top row, or
// flattened to their DC, and their chroma drifts sideways off the luma.
//
// Outside the glitched runs only the quantisation error is added to the
// sharp frame: a 4x4 rebuild on its own blurred the whole picture
// (2026-09-28). Broken blocks lose their detail, as real ones do.
//
// Cost: the DCT is done once per block, not per pixel. Pass 1 writes each
// block's 16 coefficients into a 4x4 patch of texels; the composite reads
// them back with texelFetch. Per pixel it cost ~6 ms at 3024x1890.
//
// Music: a few runs are always broken (Glitch); the snare bursts many more,
// in rows picked fresh on each beat, and they heal as the envelope decays
// (rows with the lowest hash hold on longest), so the hit lands in regions
// and never blanks the frame.
(function () {
  var common = `
// w(u) cos((2x + 1) u pi / 8), indexed [u * 4 + x].
const float CT[16] = float[16](1.0000000, 1.0000000, 1.0000000, 1.0000000, 1.3065630, 0.5411961, -0.5411961, -1.3065630, 1.0000000, -1.0000000, -1.0000000, 1.0000000, 0.5411961, -1.3065630, 1.3065630, -0.5411961);
const float PI = 3.14159265;
vec3 toYcc(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.1687, -0.3313, 0.5)), dot(c, vec3(0.5, -0.4187, -0.0813))); }
vec3 fromYcc(vec3 y) { return vec3(y.x + 1.402 * y.z, y.x - 0.34414 * y.y - 0.71414 * y.z, y.x + 1.772 * y.y); }
vec2 fullRes() { return vec2(textureSize(uInput, 0)); }
// Block size in full-size pixels; at least 8 so the coefficient patches
// (4x4 texels per block) fit in the half-size pass.
float blockPx() { return max(8.5, p_size * fullRes().y / 1080.0); }

// What happens to a block. kind: 0 clean, 1 smear, 2 moved, 3 flat.
struct Glitch { bool hit; int kind; vec2 src; float q; float drift; };
Glitch glitchAt(vec2 cell) {
  vec2 cells = ceil(fullRes() / blockPx());
  float seed = uBeatIndex;
  float share = min(0.9, p_glitch * 0.5 + p_burst * 0.8 * uSnare);
  float start = floor(hash12(vec2(cell.y + 11.0, seed)) * cells.x);
  float len = floor(cells.x * (0.12 + 0.6 * hash12(vec2(cell.y + 23.0, seed))));
  Glitch g;
  g.hit = hash12(vec2(cell.y, seed * 1.7 + 0.3)) < share && cell.x >= start && cell.x < start + len;
  g.kind = 0; g.src = cell; g.q = p_quality; g.drift = 0.0;
  if (g.hit) {
    float kind = hash12(vec2(cell.y, seed + 9.0));
    g.q = max(g.q, 0.6 + 0.4 * p_smear);
    if (kind < 0.45 * p_smear) g.kind = 1;
    else if (kind < 0.8 * p_smear) {
      g.kind = 2;
      g.src += floor(vec2(hash12(vec2(cell.y, seed + 4.0)) * 8.0 - 4.0, hash12(vec2(cell.y, seed + 5.0)) * 4.0 - 2.0));
    } else if (hash12(cell + seed * 3.1) < 0.5 * p_smear) { g.kind = 3; g.q = 1.6; }
    g.drift = p_drift * (2.0 + 3.0 * hash12(vec2(cell.y, seed + 7.0)));
  }
  return g;
}
`;

  VIZ_FX.register({
    id: 'blocks',
    name: 'Glitch blocks',
    group: 'texture',
    params: [
      { key: 'size', label: 'Block size', min: 6, max: 64, default: 24 },
      { key: 'quality', label: 'Compression', min: 0, max: 1, default: 0.2 },
      { key: 'glitch', label: 'Glitch', min: 0, max: 1, default: 0.15 },
      { key: 'burst', label: 'Snare burst', min: 0, max: 1, default: 0.6 },
      { key: 'smear', label: 'Smear', min: 0, max: 1, default: 0.6 },
      { key: 'drift', label: 'Chroma drift', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      // 0: quarter-size box average; the DCT reads its 4x4 samples from here.
      { scale: 1 / 4, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = texture(uInput, vUv + vec2(-t.x, -t.y)).rgb + texture(uInput, vUv + vec2(t.x, -t.y)).rgb +
           texture(uInput, vUv + vec2(-t.x,  t.y)).rgb + texture(uInput, vUv + vec2(t.x,  t.y)).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}` },
      // 1: half size, one quantised coefficient per texel, 4x4 texels per
      // block. Clean blocks store the quantisation error; glitched blocks
      // store the quantised coefficients themselves.
      { scale: 1 / 2, frag: common + `
void main() {
  vec2 tp = floor(gl_FragCoord.xy);
  vec2 cell = floor(tp / 4.0);
  ivec2 uv4 = ivec2(tp - cell * 4.0);
  float B = blockPx();
  vec2 cells = ceil(fullRes() / B);
  if (cell.x >= cells.x || cell.y >= cells.y) { fragColor = vec4(0.0); return; }
  Glitch g = glitchAt(cell);
  vec3 coef = vec3(0.0);
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    vec2 uv = (g.src * B + (vec2(float(x), float(y)) + 0.5) * B * 0.25) / fullRes();
    coef += toYcc(texture(uPass0, clamp(uv, 0.0, 1.0)).rgb) * CT[uv4.x * 4 + x] * CT[uv4.y * 4 + y];
  }
  coef /= 16.0;
  float fr = float(uv4.x + uv4.y);
  vec3 stepQ = g.q * vec3(0.05, 0.1, 0.1) * (fr == 0.0 ? vec3(0.25) : vec3(1.0 + 1.6 * fr));
  // Chroma loses its detail first, as in 4:2:0.
  if (fr > 0.0) stepQ.yz *= 1.0 + 3.0 * g.q;
  vec3 qc = g.q > 0.0 ? floor(coef / stepQ + 0.5) * stepQ : coef;
  fragColor = vec4(g.hit ? qc : qc - coef, 1.0);
}` },
      { frag: common + `
void main() {
  float B = blockPx();
  vec2 px = vUv * uRes;
  vec2 cell = floor(px / B);
  vec2 lp = (px - cell * B) / B;
  Glitch g = glitchAt(cell);
  vec3 src = texture(uInput, vUv).rgb;
  if (!g.hit && g.q <= 0.001) { fragColor = vec4(src, 1.0); return; }
  if (g.kind == 1) lp.y = 0.95;        // smear: the top row dragged down
  if (g.kind == 3) lp = vec2(0.5);     // flat: only the DC survived
  vec2 xy = lp * 4.0 - 0.5;
  float bx[4], by[4];
  for (int u = 0; u < 4; u++) {
    float w = u == 0 ? 1.0 : 1.41421356;
    bx[u] = w * cos((2.0 * xy.x + 1.0) * float(u) * PI / 8.0);
    by[u] = w * cos((2.0 * xy.y + 1.0) * float(u) * PI / 8.0);
  }
  ivec2 base = ivec2(cell) * 4;
  vec3 rec = vec3(0.0);
  for (int v = 0; v < 4; v++) for (int u = 0; u < 4; u++)
    rec += texelFetch(uPass1, base + ivec2(u, v), 0).rgb * bx[u] * by[v];
  vec3 ycc;
  if (g.hit) {
    ycc = rec;
    if (p_drift > 0.0) {
      // Chroma from blocks further along the row, blurry as if subsampled.
      vec2 cuv = ((g.src + vec2(g.drift, 0.0) + 0.5) * B) / uRes;
      vec3 cd = toYcc(texture(uPass0, clamp(cuv, 0.0, 1.0)).rgb);
      ycc.yz = mix(ycc.yz, cd.yz * 1.25, min(1.0, p_drift * 1.5));
    }
  } else ycc = toYcc(src) + rec;
  fragColor = vec4(max(fromYcc(ycc), 0.0), 1.0);
}` }
    ]
  });
})();
