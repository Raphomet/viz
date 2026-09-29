// Ink: the frame thresholded to a single ink on paper, like a linocut or a
// photocopy. Adapt moves the threshold from one global level towards the
// local mean (a blurred copy at an eighth of the size, which costs almost
// nothing), so detail survives in both the shadows and the lights. At the
// default the dark scene prints as a solid ground with its light strokes cut
// out, like a linocut; at full Adapt it becomes ink drawing at its edges.
//
// The paper has a tooth (fibre noise) that the ink breaks up on at its
// edges, and the kick makes the ink bleed: the threshold swells with the
// envelope, so strokes fatten on the hit and ease back.
VIZ_FX.register({
  id: 'ink',
  name: 'Ink',
  group: 'colour',
  params: [
    { key: 'ink', label: 'Ink (0 Black, 1 Indigo, 2 Red, 3 Sepia, 4 Silver, 5 Gold)', min: 0, max: 5, step: 1, default: 0 },
    { key: 'paper', label: 'Paper (0 White, 1 Cream, 2 Grey, 3 Black)', min: 0, max: 3, step: 1, default: 1 },
    { key: 'threshold', label: 'Threshold', min: 0, max: 1, default: 0.45 },
    { key: 'adapt', label: 'Adaptive', min: 0, max: 1, default: 0.6 },
    { key: 'soft', label: 'Edge softness', min: 0, max: 1, default: 0.3 },
    { key: 'texture', label: 'Paper texture', min: 0, max: 1, default: 0.5 },
    { key: 'negative', label: 'Ink the lights', min: 0, max: 1, step: 1, default: 0 },
    { key: 'bleed', label: 'Kick bleed', min: 0, max: 1, default: 0.4 }
  ],
  passes: [
    // 0: an eighth of the size; 16 bilinear taps average each 8x8 block.
    { scale: 1 / 8, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  float s = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++)
    s += luma(clamp(texture(uInput, vUv + (vec2(x, y) * 2.0 - 3.0) * t).rgb, 0.0, 1.0));
  fragColor = vec4(vec3(s / 16.0), 1.0);
}` },
    // 1: blur the small copy (3x3 at a two-texel stride), the local mean.
    { scale: 1 / 8, frag: `
void main() {
  vec2 t = 2.0 / vec2(textureSize(uSrc, 0));
  float s = 0.0, w = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    float k = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
    s += texture(uSrc, vUv + vec2(x, y) * t).r * k; w += k;
  }
  fragColor = vec4(vec3(s / w), 1.0);
}` },
    { frag: `
const vec3 INK[6] = vec3[6](vec3(0.07, 0.07, 0.08), vec3(0.13, 0.16, 0.40), vec3(0.78, 0.13, 0.11),
  vec3(0.30, 0.18, 0.10), vec3(0.88, 0.89, 0.90), vec3(0.86, 0.66, 0.28));
const vec3 PAPER[4] = vec3[4](vec3(0.96, 0.96, 0.94), vec3(0.95, 0.91, 0.82), vec3(0.72, 0.72, 0.70), vec3(0.06, 0.06, 0.07));
float vnoise(vec2 q) {
  vec2 i = floor(q), f = q - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float px = max(1.0, uRes.y / 1080.0);
  // A two-texel average takes the aliasing off the threshold edge.
  vec2 t = 0.5 * px / vec2(textureSize(uInput, 0));
  float l = 0.25 * (luma(clamp(texture(uInput, vUv + vec2(t.x, t.y)).rgb, 0.0, 1.0)) + luma(clamp(texture(uInput, vUv - vec2(t.x, t.y)).rgb, 0.0, 1.0)) +
                    luma(clamp(texture(uInput, vUv + vec2(t.x, -t.y)).rgb, 0.0, 1.0)) + luma(clamp(texture(uInput, vUv + vec2(-t.x, t.y)).rgb, 0.0, 1.0)));
  float local = texture(uPass1, vUv).r;
  bool neg = p_negative > 0.5;
  if (neg) { l = 1.0 - l; local = 1.0 - local; }
  // Adaptive: ink where the pixel is darker than its neighbourhood by a
  // margin that the threshold knob sets. Mixed with a global cut so large
  // dark areas can still print solid when Adapt is low.
  float thr = mix(p_threshold, local - (0.5 - p_threshold) * 0.25, p_adapt);
  thr += p_bleed * 0.12 * uKick;
  // Paper tooth: fibres (stretched value noise) plus fine grain, in 1080-line pixels.
  vec2 gp = gl_FragCoord.xy / px;
  float tooth = 0.6 * vnoise(gp * vec2(0.9, 0.18)) + 0.4 * hash12(gp);
  float soft = mix(0.004, 0.08, p_soft);
  float inked = 1.0 - smoothstep(thr - soft, thr + soft, l + (tooth - 0.5) * 0.12 * p_texture);
  int ii = int(clamp(floor(p_ink + 0.5), 0.0, 5.0));
  int ip = int(clamp(floor(p_paper + 0.5), 0.0, 3.0));
  vec3 paper = PAPER[ip] * (1.0 - 0.06 * p_texture * (vnoise(gp * 0.05) - 0.5 + 0.5 * (tooth - 0.5)));
  // Ink sits a little uneven: thinner where the tooth is high.
  vec3 ink = mix(INK[ii], paper, 0.12 * p_texture * tooth);
  fragColor = vec4(mix(paper, ink, inked), 1.0);
}` }
  ]
});
