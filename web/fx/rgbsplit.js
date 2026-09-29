// RGB split: chromatic aberration as an effect in its own right (the Finish's
// film stage has a faint radial one; this goes much further). Linear mode
// pulls the channels apart along an angle; radial mode scales them about a
// drifting centre, so the fringes grow towards the edges as in a cheap lens.
// Spread blends three hard copies into a continuous nine-tap spectrum, so
// fringes can be a crisp misregistration or a soft prism smear.
//
// Music: the kick opens the split for a moment. In radial mode the push is
// zero at the centre and grows outwards, so the beat reads at the edges
// without the middle of the picture moving.
VIZ_FX.register({
  id: 'rgbsplit',
  name: 'RGB split',
  group: 'lens',
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.25 },
    { key: 'mode', label: 'Radial', min: 0, max: 1, step: 1, default: 0 },
    { key: 'angle', label: 'Angle (linear)', min: 0, max: 360, default: 0 },
    { key: 'spread', label: 'Spread (hard to prism)', min: 0, max: 1, default: 0.3 },
    { key: 'kick', label: 'Kick push', min: 0, max: 1, default: 0.5 },
    { key: 'drift', label: 'Centre drift (radial)', min: 0, max: 1, default: 0.3 }
  ],
  passes: [{ frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  float amt = p_amount + p_kick * 0.8 * uKick;
  vec2 off;
  if (p_mode > 0.5) {
    vec2 c = 0.5 + p_drift * 0.15 * vec2(sin(uTime * 0.23), cos(uTime * 0.17));
    // Up to ~4% of the distance to the centre at full amount.
    off = (vUv - c) * amt * 0.045;
  } else {
    float a = radians(p_angle);
    // Up to ~1.5% of the frame height, in either direction.
    off = vec2(cos(a), sin(a)) / vec2(aspect, 1.0) * amt * 0.015;
  }
  // Nine taps from -1 to +1 along the offset. Red peaks at -1, green at 0,
  // blue at +1; Spread moves from those three spikes to overlapping lobes.
  vec3 acc = vec3(0.0), wsum = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float t = float(i) / 4.0 - 1.0;
    vec3 hard = vec3(i == 0 ? 1.0 : 0.0, i == 4 ? 1.0 : 0.0, i == 8 ? 1.0 : 0.0);
    vec3 d = t - vec3(-1.0, 0.0, 1.0);
    vec3 soft = exp(-d * d / 0.35);
    vec3 w = mix(hard, soft, p_spread);
    acc += texture(uInput, mirrorUv(vUv + off * t)).rgb * w;
    wsum += w;
  }
  fragColor = vec4(acc / max(wsum, 1e-4), 1.0);
}` }]
});
