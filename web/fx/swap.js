// Swap: the picture's colour changes on the hit and eases there, LEXSAN's
// third technique (docs/research/2026-09-28-lexsan-set.md: the old DJ
// footage alternating a magenta grade with a neutral one, the HUD swapping
// red and white). Four modes:
//   0 Grade: neutral <-> a split-tone grade (shadows and lights tinted).
//   1 Channel swap: RGB <-> BGR (red and blue trade places).
//   2 Channel rotate: RGB -> GBR -> BRG, one step per hit.
//   3 Mono flip: the frame as one tinted monochrome, flipping between two
//     tints (the HUD's red <-> white).
// On Beat, the state changes every n beats and eases over the first part of
// the period, so a change is a quick dissolve, never a cut. On Kick, the
// swap follows the kick envelope instead: it springs in with the hit and
// decays with it. Depth scales how far either goes.
VIZ_FX.register({
  id: 'swap',
  name: 'Swap',
  group: 'colour',
  params: [
    { key: 'mode', label: 'Mode (0 Grade, 1 Channel swap, 2 Channel rotate, 3 Mono flip)', min: 0, max: 3, step: 1, default: 0 },
    { key: 'tint', label: 'Tint (0 Magenta, 1 Cyan, 2 Amber, 3 Red / white)', min: 0, max: 3, step: 1, default: 0 },
    { key: 'trigger', label: 'Trigger (0 Beat, 1 Kick)', min: 0, max: 1, step: 1, default: 0 },
    { key: 'every', label: 'Every n beats', min: 1, max: 16, step: 1, default: 2 },
    { key: 'ease', label: 'Ease (fraction of the period)', min: 0.02, max: 1, default: 0.25 },
    { key: 'depth', label: 'Depth', min: 0, max: 1, default: 0.8 }
  ],
  passes: [{ frag: `
// Shadow and light tint per preset (sRGB); Mono flip uses them as its two inks.
const vec3 SH[4] = vec3[4](vec3(0.30, 0.02, 0.28), vec3(0.00, 0.16, 0.26), vec3(0.28, 0.10, 0.00), vec3(0.45, 0.02, 0.04));
const vec3 HI[4] = vec3[4](vec3(1.00, 0.78, 0.95), vec3(0.80, 1.00, 1.00), vec3(1.00, 0.90, 0.70), vec3(1.00, 0.35, 0.30));
const vec3 ALT[4] = vec3[4](vec3(0.72, 1.00, 0.86), vec3(1.00, 0.72, 0.80), vec3(0.72, 0.84, 1.00), vec3(0.94, 0.92, 1.00));

vec3 perm(vec3 c, int k) { return k == 0 ? c : (k == 1 ? c.gbr : c.brg); }
vec3 grade(vec3 c, int ti) {
  vec3 lin = toLinear(c);
  float l = luma(lin);
  vec3 tone = mix(toLinear(SH[ti]), toLinear(HI[ti]), sqrt(clamp(l, 0.0, 1.0)));
  // Keep each pixel's luminance, so the grade never reads as a flash.
  vec3 t = tone * (l / max(luma(tone), 1e-4));
  return toSrgb(mix(lin, t, 0.7));
}
vec3 mono(vec3 c, vec3 ink) {
  float l = luma(clamp(c, 0.0, 1.0));
  return toSrgb(toLinear(ink) * l * 1.1);
}
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  int mode = int(clamp(floor(p_mode + 0.5), 0.0, 3.0));
  int ti = int(clamp(floor(p_tint + 0.5), 0.0, 3.0));
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  float e = smoothstep(0.0, p_ease, phase);
  bool kick = p_trigger > 0.5;
  // s: how far into the swapped state, 0-1.
  float s;
  if (kick) s = uKick;
  else s = mix(mod(stepNow - 1.0, 2.0), mod(stepNow, 2.0), e);
  s *= p_depth;
  vec3 o;
  if (mode == 0) o = mix(c, grade(c, ti), s);
  else if (mode == 1) o = mix(c, c.bgr, s);
  else if (mode == 2) {
    if (kick) o = mix(c, c.gbr, s);
    else {
      int a = int(mod(stepNow - 1.0, 3.0)), b = int(mod(stepNow, 3.0));
      // Depth pulls the rotation back towards the untouched frame.
      o = mix(c, mix(perm(c, a), perm(c, b), e), p_depth);
    }
  } else {
    // Mono flip always shows one of the two inks; depth mixes the original back.
    vec3 ink = mix(HI[ti], ALT[ti], kick ? s : mix(mod(stepNow - 1.0, 2.0), mod(stepNow, 2.0), e));
    o = mix(c, mono(c, ink), kick ? 1.0 : p_depth);
  }
  fragColor = vec4(o, 1.0);
}` }]
});
