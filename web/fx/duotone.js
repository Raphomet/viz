// Duotone: a two-ink risograph print. The frame is split into two
// separations, each printed in a flat ink on coloured paper and multiplied
// together as overprinting inks do, so where they overlap a third colour
// appears. Separation 0 splits by tone (ink A carries the shadows, ink B the
// mid-tones); 1 splits by colour (ink A from the red channel's absence, B
// from green and blue's), which keeps a poster's primaries apart.
//
// Each drum lands slightly off: ink A is offset from ink B by a few pixels,
// and the offset's direction is re-chosen every few beats, gliding to the new
// place over a quarter of a beat (the kick knocks it a little further, eased
// by the envelope). The ink itself is grainy and uneven, stochastic coverage
// over a slow blotch, the way riso ink sits on uncoated paper.
VIZ_FX.register({
  id: 'duotone',
  name: 'Duotone',
  group: 'colour',
  params: [
    { key: 'inkA', label: 'Ink A (0 Blue, 1 Fluo pink, 2 Black, 3 Red, 4 Teal, 5 Orange, 6 Yellow, 7 Purple, 8 Green)', min: 0, max: 8, step: 1, default: 0 },
    { key: 'inkB', label: 'Ink B (same list)', min: 0, max: 8, step: 1, default: 1 },
    { key: 'paper', label: 'Paper (0 White, 1 Cream, 2 Newsprint, 3 Kraft)', min: 0, max: 3, step: 1, default: 1 },
    { key: 'separation', label: 'Split by tone / colour', min: 0, max: 1, default: 0.5 },
    { key: 'negative', label: 'Negative (light prints)', min: 0, max: 1, step: 1, default: 0 },
    { key: 'misreg', label: 'Misregistration', min: 0, max: 1, default: 0.4 },
    { key: 'grain', label: 'Ink grain', min: 0, max: 1, default: 0.5 },
    { key: 'every', label: 'Re-register every n beats', min: 1, max: 16, step: 1, default: 4 },
    { key: 'kick', label: 'Kick knock', min: 0, max: 1, default: 0.5 }
  ],
  passes: [{ frag: `
const vec3 INK[9] = vec3[9](
  vec3(0.00, 0.47, 0.75), vec3(1.00, 0.28, 0.58), vec3(0.10, 0.10, 0.12), vec3(0.92, 0.18, 0.22),
  vec3(0.00, 0.52, 0.55), vec3(1.00, 0.43, 0.18), vec3(1.00, 0.89, 0.00), vec3(0.46, 0.33, 0.62),
  vec3(0.00, 0.60, 0.36));
const vec3 PAPER[4] = vec3[4](vec3(0.97, 0.96, 0.93), vec3(0.96, 0.92, 0.83), vec3(0.86, 0.85, 0.80), vec3(0.78, 0.66, 0.50));

float vnoise(vec2 q) {
  vec2 i = floor(q), f = q - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
vec2 dirFor(float s) {
  float a = hash12(vec2(s, 7.3)) * 6.28318530718;
  return vec2(cos(a), sin(a)) * (0.5 + 0.5 * hash12(vec2(s * 1.7, 2.9)));
}
vec3 src(vec2 uv) {
  vec3 c = clamp(texture(uInput, uv).rgb, 0.0, 1.0);
  return p_negative > 0.5 ? 1.0 - c : c;
}
// Ink densities (0 = bare paper) for ink A and ink B.
vec2 dens(vec3 c) {
  float d = 1.0 - luma(c);
  vec2 tone = vec2(smoothstep(0.42, 0.95, d), smoothstep(0.08, 0.7, d) * (1.0 - 0.45 * smoothstep(0.6, 1.0, d)));
  vec2 colr = vec2(1.0 - c.r, 1.0 - (0.6 * c.g + 0.4 * c.b));
  return mix(tone, colr, p_separation);
}
// Riso ink is never solid: coverage is decided per grain against the density,
// and a slow blotch makes some areas print lighter.
float cover(float d, vec2 px, float seed) {
  float g = vnoise(px / 1.3 + seed) * 0.65 + hash12(px + seed) * 0.35;
  float blotch = vnoise(px / 90.0 + seed * 3.0) - 0.5;
  d = clamp(d * (1.0 + 0.25 * p_grain * blotch), 0.0, 1.0);
  float soft = mix(0.5, 0.12, p_grain);
  float c = smoothstep(g - soft, g + soft, d * (1.0 + soft) - soft * 0.5);
  return mix(d, c, p_grain) * 0.94;
}
void main() {
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  vec2 dir = mix(dirFor(stepNow - 1.0), dirFor(stepNow), smoothstep(0.0, 0.25, phase * every));
  // A few pixels at 1080 lines, scaled with the frame.
  float px = uRes.y / 1080.0;
  vec2 off = dir * (p_misreg * 7.0 + p_kick * 6.0 * uKick) * px / uRes;

  vec2 da = dens(src(vUv + off * 0.5));
  vec2 db = dens(src(vUv - off * 0.5));
  // Grain is sized in 1080-line pixels, so it looks the same at any size.
  vec2 gp = gl_FragCoord.xy / max(1.0, px);
  float a = cover(da.x, gp, 11.0);
  float b = cover(db.y, gp, 47.0);

  int ia = int(clamp(floor(p_inkA + 0.5), 0.0, 8.0));
  int ib = int(clamp(floor(p_inkB + 0.5), 0.0, 8.0));
  int ip = int(clamp(floor(p_paper + 0.5), 0.0, 3.0));
  // Overprint: inks multiply in linear light, like transparent layers.
  vec3 c = toLinear(PAPER[ip]) * mix(vec3(1.0), toLinear(INK[ia]), a) * mix(vec3(1.0), toLinear(INK[ib]), b);
  // Paper tooth: a faint fibre texture in the bare stock.
  c *= 1.0 - 0.05 * (vnoise(gp * vec2(0.08, 0.5)) - 0.5);
  fragColor = vec4(toSrgb(c), 1.0);
}` }]
});
