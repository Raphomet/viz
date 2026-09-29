// Invert: inversion confined to a region that moves on the beat, never the
// whole frame (TASTE.md: no full-frame flashes). The region is a band, a
// bar, a circle, a diamond or a ring; 1-4 of them, each placed afresh every
// n beats and gliding there over the first part of the beat, the way slice
// eases its bands. The kick swells each region a little with its envelope.
// Mode 0 inverts RGB (red becomes cyan); mode 1 inverts only lightness
// (Oklab), keeping each colour's hue, which reads as a negative print of the
// same picture rather than a colour change.
VIZ_FX.register({
  id: 'invert',
  name: 'Invert region',
  group: 'colour',
  params: [
    { key: 'shape', label: 'Shape (0 Band, 1 Bar, 2 Circle, 3 Diamond, 4 Ring)', min: 0, max: 4, step: 1, default: 2 },
    { key: 'count', label: 'Regions', min: 1, max: 4, step: 1, default: 1 },
    { key: 'size', label: 'Size', min: 0.03, max: 0.5, default: 0.22 },
    { key: 'every', label: 'Move every n beats', min: 1, max: 8, step: 1, default: 1 },
    { key: 'glide', label: 'Glide (fraction of a beat)', min: 0.02, max: 1, default: 0.25 },
    { key: 'edge', label: 'Edge softness', min: 0, max: 1, default: 0.15 },
    { key: 'mode', label: 'Mode (0 RGB, 1 Lightness)', min: 0, max: 1, step: 1, default: 1 },
    { key: 'swell', label: 'Kick swell', min: 0, max: 1, default: 0.4 }
  ],
  passes: [{ frag: `
vec3 cbrt3(vec3 x) { return sign(x) * pow(abs(x), vec3(1.0 / 3.0)); }
vec3 toOklab(vec3 c) {
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * cbrt3(lms);
}
vec3 fromOklab(vec3 L) {
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * L;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * (lms * lms * lms);
}
// Where region i sits for a given step, in aspect-corrected units about the centre.
vec2 place(float i, float s, float aspect) {
  vec2 h = vec2(hash12(vec2(s * 1.31 + i * 7.7, 3.1)), hash12(vec2(s * 2.17 + i * 5.3, 9.4)));
  return (h - 0.5) * vec2(aspect, 1.0) * 0.75;
}
// Signed distance to the region (negative inside); r is its size.
float regionSd(vec2 p, vec2 c, float r, int shape) {
  vec2 d = p - c;
  if (shape == 0) return abs(d.y) - r * 0.5;
  if (shape == 1) return abs(d.x) - r * 0.5;
  if (shape == 3) return (abs(d.x) + abs(d.y)) * 0.7071068 - r;
  if (shape == 4) return abs(length(d) - r) - r * 0.18;
  return length(d) - r;
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  int shape = int(clamp(floor(p_shape + 0.5), 0.0, 4.0));
  int n = int(clamp(floor(p_count + 0.5), 1.0, 4.0));
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  float g = smoothstep(0.0, p_glide, phase * every);
  float r = p_size * (1.0 + p_swell * 0.25 * uKick);
  float soft = mix(0.5, 30.0, p_edge * p_edge) / uRes.y;
  float m = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = mix(place(fi, stepNow - 1.0, aspect), place(fi, stepNow, aspect), g);
    // Overlapping regions cancel, as two negatives would.
    m = abs(m - (1.0 - smoothstep(-soft, soft, regionSd(p, c, r, shape))));
  }
  vec3 col = clamp(texture(uInput, vUv).rgb, 0.0, 1.0);
  vec3 inv;
  if (p_mode > 0.5) {
    vec3 lab = toOklab(toLinear(col));
    lab.x = 1.0 - lab.x;
    inv = toSrgb(max(fromOklab(lab), 0.0));
  } else inv = 1.0 - col;
  fragColor = vec4(mix(col, inv, m), 1.0);
}` }]
});
