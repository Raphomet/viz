// Posterize: the frame cut into a few flat levels, the screen-print look.
// Smoothing first runs a small bilateral filter (it blurs within a region
// but not across an edge), so gradients and grain collapse into clean flats
// instead of the ragged, noisy contours a plain posterize leaves.
//
// Levels are cut on lightness only, keeping each pixel's hue and chroma
// (Oklab), or per channel (RGB). Lightness is the default: per-channel cuts
// at 4-5 levels turned De Stijl's cream paper lemon yellow and the dark
// scene's smoke teal (2026-09-28). Drift moves the thresholds between levels
// with the bass, so on a swell the contour lines creep across every gradient
// while the flats stay put: the music is seen at the edges, not as the
// whole frame changing. Outline draws a dark ink line where levels meet.
VIZ_FX.register({
  id: 'posterize',
  name: 'Posterize',
  group: 'colour',
  params: [
    { key: 'levels', label: 'Levels', min: 2, max: 12, step: 1, default: 5 },
    { key: 'smooth', label: 'Smoothing', min: 0, max: 1, default: 0.5 },
    { key: 'mode', label: 'Mode (0 Lightness, 1 RGB)', min: 0, max: 1, step: 1, default: 0 },
    { key: 'drift', label: 'Bass drift', min: 0, max: 1, default: 0.4 },
    { key: 'outline', label: 'Outline', min: 0, max: 1, default: 0 }
  ],
  passes: [
    // 0: edge-preserving smoothing. A 5x5 bilateral at a stride that grows
    // with the knob; the range weight keeps colour edges sharp.
    { frag: `
void main() {
  vec3 c0 = texture(uInput, vUv).rgb;
  if (p_smooth <= 0.0) { fragColor = vec4(c0, 1.0); return; }
  vec2 texel = 1.0 / vec2(textureSize(uInput, 0));
  float stride = p_smooth * 2.4 * max(1.0, uRes.y / 1080.0);
  float sc = mix(0.06, 0.16, p_smooth);
  vec3 sum = vec3(0.0); float wsum = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 o = vec2(x, y);
    vec3 c = texture(uInput, vUv + o * stride * texel).rgb;
    vec3 dc = c - c0;
    float w = exp(-dot(o, o) / 4.5 - dot(dc, dc) / (2.0 * sc * sc));
    sum += c * w; wsum += w;
  }
  fragColor = vec4(sum / wsum, 1.0);
}` },
    { frag: `
vec3 cbrt3(vec3 x) { return sign(x) * pow(abs(x), vec3(1.0 / 3.0)); }
vec3 toOklab(vec3 c) {
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = cbrt3(lms);
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}
vec3 fromOklab(vec3 L) {
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * L;
  lms = lms * lms * lms;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * lms;
}
float N, OFF;
// Level index with the thresholds moved by OFF (a fraction of one step).
// Floor-style bins (black stays black, white stays white); rounding to the
// nearest level lifted the dark scene's near-black ground a whole level.
vec3 levelIdx(vec3 x) { return clamp(floor(x * N + OFF), 0.0, N - 1.0); }
vec3 quant(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  if (p_mode > 0.5) return levelIdx(c) / (N - 1.0);
  vec3 lab = toOklab(toLinear(c));
  lab.x = levelIdx(vec3(lab.x)).x / (N - 1.0);
  return toSrgb(fromOklab(lab));
}
float key(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 k = p_mode > 0.5 ? levelIdx(c) : levelIdx(vec3(toOklab(toLinear(c)).x));
  return dot(k, vec3(1.0, 16.0, 256.0));
}
void main() {
  N = floor(p_levels + 0.5);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  vec3 c = texture(uSrc, vUv).rgb;
  // Drift only where the picture has a gradient: a flat ground sitting near
  // a threshold would otherwise flip level all at once on a bass swell.
  vec2 g = 2.0 * max(1.0, uRes.y / 1080.0) / vec2(textureSize(uSrc, 0));
  float grad = abs(luma(texture(uSrc, vUv + vec2(g.x, 0.0)).rgb) - luma(texture(uSrc, vUv - vec2(g.x, 0.0)).rgb)) +
               abs(luma(texture(uSrc, vUv + vec2(0.0, g.y)).rgb) - luma(texture(uSrc, vUv - vec2(0.0, g.y)).rgb));
  OFF = p_drift * 0.7 * bass * smoothstep(0.01, 0.05, grad);
  vec3 q = quant(c);
  if (p_outline > 0.0) {
    // A line where the level changes within about a pixel (at 1080 lines).
    vec2 t = max(1.0, uRes.y / 1080.0) * 1.2 / vec2(textureSize(uSrc, 0));
    float k = key(c);
    float edge = 0.0;
    edge += step(0.5, abs(key(texture(uSrc, vUv + vec2(t.x, 0.0)).rgb) - k));
    edge += step(0.5, abs(key(texture(uSrc, vUv + vec2(0.0, t.y)).rgb) - k));
    q = mix(q, q * 0.12 + vec3(0.02, 0.02, 0.03), min(edge, 1.0) * p_outline);
  }
  fragColor = vec4(q, 1.0);
}` }
  ]
});
