// Pixel sort: runs of pixels brighter (or darker) than a threshold are sorted
// by brightness along a direction, the Kim Asendorf look. A true sort of
// every run is not a GPU shape, so each line along the direction is cut into
// cells a "run length" long (staggered per line so the cuts do not form a
// grid), each cell is read as 24 samples, and the run of qualifying samples
// that holds the pixel is ranked by counting: the pixel shows the sample
// whose rank matches its place in the run, blended with the next so a sorted
// run is a smooth gradient rather than 24 steps. Done at quarter size: the
// ranking is O(n^2) per pixel, and at half size it cost ~7 ms at 3024x1890
// on a half-white frame (2026-09-28); the composite keeps the untouched
// input sharp outside the runs.
//
// Music: bass lowers the threshold a little (runs grow as it swells), and the
// snare melts one or two horizontal bands (a new choice each beat), so the
// hit lands in part of the frame rather than everywhere.
VIZ_FX.register({
  id: 'pixelsort',
  name: 'Pixel sort',
  group: 'texture',
  params: [
    { key: 'angle', label: 'Direction (deg, 90 = down)', min: 0, max: 360, default: 90 },
    { key: 'threshold', label: 'Threshold', min: 0, max: 1, default: 0.32 },
    { key: 'darks', label: 'Sort darks instead', min: 0, max: 1, step: 1, default: 0 },
    { key: 'length', label: 'Run length', min: 0.03, max: 1, default: 0.35 },
    { key: 'reverse', label: 'Reverse order', min: 0, max: 1, step: 1, default: 0 },
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 1 },
    { key: 'melt', label: 'Snare melt', min: 0, max: 1, default: 0.5 }
  ],
  passes: [
    { scale: 1 / 4, frag: `
const int K = 24;
// Threshold at a point: the knob, lowered by bass everywhere and by the
// snare inside the bands chosen for this beat.
float thresholdAt(vec2 uv) {
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float band = floor(uv.y * 6.0);
  float hit = step(hash12(vec2(band, uBeatIndex * 1.13 + 3.7)), 0.3);
  float t = p_threshold - 0.08 * bass - hit * uSnare * p_melt * 0.45;
  // Sorting darks: the threshold works the other way.
  return p_darks > 0.5 ? 1.0 - t : t;
}
bool qualifies(vec2 uv, out float l) {
  l = luma(texture(uInput, uv).rgb);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return false;
  float t = thresholdAt(uv);
  return p_darks > 0.5 ? l < t : l > t;
}
void main() {
  float ang = radians(p_angle);
  vec2 d = vec2(cos(ang), -sin(ang));
  vec2 n = vec2(-d.y, d.x);
  vec2 px = vUv * uRes;
  float t = dot(px, d);
  float row = floor(dot(px, n));
  float L = max(4.0, p_length * uRes.y);
  float stride = L / float(K);
  float jit = hash12(vec2(row, 7.1)) * L;
  float c0 = floor((t + jit) / L) * L - jit;
  float fi = (t - c0) / stride;
  int i0 = clamp(int(floor(fi)), 0, K - 1);

  float lum[K];
  bool ok[K];
  for (int j = 0; j < K; j++) {
    vec2 uv = vUv + d * (c0 + (float(j) + 0.5) * stride - t) / uRes;
    float l;
    ok[j] = qualifies(uv, l);
    lum[j] = l;
  }
  vec3 src = texture(uInput, vUv).rgb;
  if (!ok[i0]) { fragColor = vec4(src, 0.0); return; }
  int a = i0, b = i0;
  for (int j = 0; j < K; j++) { if (a > 0 && ok[a - 1]) a--; else break; }
  for (int j = 0; j < K; j++) { if (b < K - 1 && ok[b + 1]) b++; else break; }
  int cnt = b - a + 1;
  if (cnt < 2) { fragColor = vec4(src, 0.0); return; }

  // Place within the run, between sample centres; reversed runs count down.
  float u = clamp(fi - float(a) - 0.5, 0.0, float(cnt - 1));
  if (p_reverse > 0.5) u = float(cnt - 1) - u;
  int k0 = int(floor(u));
  int k1 = min(k0 + 1, cnt - 1);
  float f = u - float(k0);
  int j0 = -1, j1 = -1;
  for (int j = a; j <= b; j++) {
    int r = 0;
    for (int m = a; m <= b; m++) r += (lum[m] < lum[j] || (lum[m] == lum[j] && m < j)) ? 1 : 0;
    if (r == k0) j0 = j;
    if (r == k1) j1 = j;
    if (j0 >= 0 && j1 >= 0) break;
  }
  j0 = max(j0, a); j1 = max(j1, a);
  vec3 s0 = texture(uInput, vUv + d * (c0 + (float(j0) + 0.5) * stride - t) / uRes).rgb;
  vec3 s1 = texture(uInput, vUv + d * (c0 + (float(j1) + 0.5) * stride - t) / uRes).rgb;
  fragColor = vec4(mix(s0, s1, f), 1.0);
}` },
    { frag: `
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  vec4 s = texture(uSrc, vUv);
  fragColor = vec4(mix(src, s.rgb, s.a * p_amount), 1.0);
}` }
  ]
});
