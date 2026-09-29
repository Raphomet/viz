// Kaleidoscope: folds the frame into n mirrored wedges around a slowly
// drifting centre. A reference effect for the rack (harness/briefs/fx.md):
// one pass, params as p_<key>, time from uTime, music from uBands / uKick.
VIZ_FX.register({
  id: 'kaleido',
  name: 'Kaleidoscope',
  group: 'space',
  params: [
    { key: 'segments', label: 'Segments', min: 2, max: 16, step: 1, default: 6 },
    { key: 'spin', label: 'Spin', min: -1, max: 1, default: 0.1 },
    { key: 'drift', label: 'Centre drift', min: 0, max: 1, default: 0.3 },
    { key: 'zoom', label: 'Zoom', min: 0.5, max: 2, default: 1 },
    { key: 'swell', label: 'Bass swell', min: 0, max: 1, default: 0.3 }
  ],
  passes: [{ frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float n = floor(p_segments + 0.5);
  float wedge = 6.28318530718 / n;
  float a = atan(p.y, p.x) + uTime * p_spin * 0.5;
  // Fold into one wedge, mirrored, so neighbouring wedges meet seamlessly.
  a = mod(a, wedge);
  a = abs(a - wedge * 0.5);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float r = length(p) / (p_zoom * (1.0 + p_swell * 0.12 * bass));
  vec2 centre = 0.5 + p_drift * 0.18 * vec2(sin(uTime * 0.13), cos(uTime * 0.097));
  vec2 uv = centre + vec2(cos(a), sin(a)) * r / vec2(aspect, 1.0);
  fragColor = vec4(texture(uSrc, mirrorUv(uv)).rgb, 1.0);
}` }]
});
