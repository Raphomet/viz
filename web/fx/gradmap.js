// Gradient map: the frame's luminance read through a designed colour ramp,
// the look of LEXSAN's orange ink kaleidoscope (docs/research/
// 2026-09-28-lexsan-set.md, #9), which is fluid footage mapped through an
// amber ramp. Eight five-stop ramps, each running dark to light so a dark
// scene stays dark and a paper-white poster lands on the ramp's palest stop.
//
// Ramp shift slides the whole image along the ramp. The bass pushes the lit
// parts continuously and the kick adds an eased nudge (the detector's envelope
// already decays), so the music reads as the colour breathing rather than as
// a flash. Cycle folds the ramp back on itself (a mirrored repeat, so there
// is no seam) and lets the shift roll colours through the image instead of
// just brightening it.
VIZ_FX.register({
  id: 'gradmap',
  name: 'Gradient map',
  group: 'colour',
  params: [
    { key: 'ramp', label: 'Ramp (0 Ember, 1 Ice, 2 Oxide, 3 Forest, 4 Sodium, 5 Mono ink, 6 Synth, 7 Bone)', min: 0, max: 7, step: 1, default: 0 },
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 1 },
    { key: 'contrast', label: 'Contrast', min: 0.5, max: 2, default: 1.1 },
    { key: 'shift', label: 'Ramp shift', min: -0.5, max: 0.5, default: 0 },
    { key: 'drive', label: 'Bass drive', min: 0, max: 1, default: 0.4 },
    { key: 'cycle', label: 'Cycle', min: 0, max: 1, default: 0 }
  ],
  passes: [{ frag: `
// Five sRGB stops per ramp, dark to light.
const vec3 R[40] = vec3[40](
  // Ember: black through oxblood and orange to a pale flame.
  vec3(0.02, 0.01, 0.01), vec3(0.28, 0.03, 0.02), vec3(0.82, 0.26, 0.03), vec3(1.0, 0.64, 0.16), vec3(1.0, 0.93, 0.74),
  // Ice: night blue to glacier white.
  vec3(0.01, 0.02, 0.06), vec3(0.05, 0.13, 0.32), vec3(0.18, 0.44, 0.70), vec3(0.62, 0.86, 0.95), vec3(0.96, 1.0, 1.0),
  // Oxide: rust in the shadows, verdigris in the lights.
  vec3(0.05, 0.03, 0.03), vec3(0.36, 0.12, 0.06), vec3(0.62, 0.36, 0.22), vec3(0.38, 0.62, 0.56), vec3(0.86, 0.95, 0.88),
  // Forest: deep pine to lichen and straw.
  vec3(0.02, 0.04, 0.03), vec3(0.06, 0.20, 0.13), vec3(0.26, 0.42, 0.20), vec3(0.70, 0.72, 0.40), vec3(0.96, 0.93, 0.80),
  // Sodium: violet night under orange street light.
  vec3(0.03, 0.02, 0.06), vec3(0.26, 0.07, 0.22), vec3(0.80, 0.34, 0.10), vec3(1.0, 0.71, 0.30), vec3(1.0, 0.94, 0.72),
  // Mono ink: blue-black to warm paper.
  vec3(0.07, 0.07, 0.10), vec3(0.20, 0.20, 0.25), vec3(0.48, 0.48, 0.50), vec3(0.79, 0.78, 0.75), vec3(0.96, 0.94, 0.89),
  // Synth: indigo, magenta, cyan.
  vec3(0.03, 0.01, 0.09), vec3(0.34, 0.04, 0.45), vec3(0.90, 0.17, 0.50), vec3(0.24, 0.78, 0.94), vec3(0.90, 1.0, 1.0),
  // Bone: sepia print.
  vec3(0.05, 0.03, 0.02), vec3(0.25, 0.15, 0.08), vec3(0.55, 0.40, 0.26), vec3(0.85, 0.75, 0.60), vec3(1.0, 0.97, 0.90)
);
vec3 ramp(int r, float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  int i = int(min(floor(t), 3.0));
  // Interpolate in linear light so the mid-stops do not go muddy.
  return toSrgb(mix(toLinear(R[r * 5 + i]), toLinear(R[r * 5 + i + 1]), t - float(i)));
}
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  int r = int(clamp(floor(p_ramp + 0.5), 0.0, 7.0));
  float l = clamp(luma(clamp(c, 0.0, 1.0)), 0.0, 1.0);
  l = clamp((l - 0.5) * p_contrast + 0.5, 0.0, 1.0);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  // The music moves the lit parts along the ramp but leaves black alone: on
  // a dark scene a drive applied everywhere lifted the whole floor to oxblood
  // on every bass swell, a full-frame pulse (TASTE.md).
  float t = l + p_shift + p_drive * (0.22 * bass + 0.12 * uKick) * smoothstep(0.02, 0.3, l);
  // Cycle: fold the ramp into a mirrored repeat, scaled so more of it is seen.
  float tc = 1.0 - abs(1.0 - mod(t * (1.0 + p_cycle), 2.0));
  t = mix(clamp(t, 0.0, 1.0), tc, p_cycle);
  fragColor = vec4(mix(c, ramp(r, t), p_amount), 1.0);
}` }]
});
