// Bloom, soft focus and halation: the Finish's lens. Only light above the
// threshold blooms (a soft knee, so nothing pops on or off), through a
// dual-filter mip chain at 1/4 to 1/64 scale, so a glow a sixth of the screen
// wide costs almost nothing at 3024x1890. Soft focus mixes in a
// two-pixel blur of the whole frame to take the mathematical edge off vector
// lines; halation warms the bloom the way light scattering back through film
// stock reddens the fringe of a highlight. Works in linear light throughout;
// the output may exceed 1 so the film stage can roll it off. Bloom fades out
// when the frame is bright overall: on De Stijl's white paper a plain
// threshold bloomed the whole sheet into a cream haze (2026-09-28).
(function () {
  var down = `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uSrc, 0));
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  c += texture(uSrc, vUv + vec2(-t.x, -t.y)).rgb;
  c += texture(uSrc, vUv + vec2( t.x, -t.y)).rgb;
  c += texture(uSrc, vUv + vec2(-t.x,  t.y)).rgb;
  c += texture(uSrc, vUv + vec2( t.x,  t.y)).rgb;
  fragColor = vec4(c / 8.0, 1.0);
}`;
  // Tent upsample of the smaller level, plus the matching level on the way down.
  var up = function (level) {
    return `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uSrc, 0));
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  c += (texture(uSrc, vUv + vec2(-t.x, 0.0)).rgb + texture(uSrc, vUv + vec2(t.x, 0.0)).rgb +
        texture(uSrc, vUv + vec2(0.0, -t.y)).rgb + texture(uSrc, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  c += texture(uSrc, vUv + vec2(-t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb +
       texture(uSrc, vUv + vec2(-t.x,  t.y)).rgb + texture(uSrc, vUv + vec2(t.x,  t.y)).rgb;
  fragColor = vec4(c / 16.0 + texture(uPass${level}, vUv).rgb, 1.0);
}`;
  };

  VIZ_FX.register({
    id: 'bloom',
    name: 'Bloom',
    group: 'lens',
    params: [
      { key: 'bloom', label: 'Bloom', min: 0, max: 1, default: 0.45 },
      { key: 'threshold', label: 'Threshold', min: 0.1, max: 1, default: 0.55 },
      { key: 'softness', label: 'Soft focus', min: 0, max: 1, default: 0.4 },
      { key: 'halation', label: 'Halation', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      // 0: half size, linear light (soft focus reads this).
      { scale: 1 / 2, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = toLinear(texture(uInput, vUv + vec2(-t.x, -t.y)).rgb) + toLinear(texture(uInput, vUv + vec2(t.x, -t.y)).rgb) +
           toLinear(texture(uInput, vUv + vec2(-t.x,  t.y)).rgb) + toLinear(texture(uInput, vUv + vec2(t.x,  t.y)).rgb);
  fragColor = vec4(c * 0.25, 1.0);
}` },
      // 1: quarter size, only the light above the threshold.
      { scale: 1 / 4, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uSrc, 0));
  vec3 c = (texture(uSrc, vUv + vec2(-t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb +
            texture(uSrc, vUv + vec2(-t.x,  t.y)).rgb + texture(uSrc, vUv + vec2(t.x,  t.y)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float knee = p_threshold * 0.5;
  float soft = clamp(br - p_threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float w = max(soft, br - p_threshold) / max(br, 1e-4);
  fragColor = vec4(c * w, 1.0);
}` },
      { scale: 1 / 8, frag: down },    // 2
      { scale: 1 / 16, frag: down },   // 3
      { scale: 1 / 32, frag: down },   // 4
      { scale: 1 / 64, frag: down },   // 5
      { scale: 1 / 32, frag: up(4) },  // 6
      { scale: 1 / 16, frag: up(3) },  // 7
      { scale: 1 / 8, frag: up(2) },   // 8
      { scale: 1 / 4, frag: up(1) },   // 9
      // 10: the broad brightness around each point (unthresholded, 1/32).
      { scale: 1 / 32, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uPass0, 0));
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++)
    m += luma(texture(uPass0, vUv + (vec2(float(x), float(y)) * 2.0 - 7.0) * t).rgb);
  fragColor = vec4(vec3(m / 64.0), 1.0);
}` },
      // 11: the frame's overall brightness, the same in every texel.
      { scale: 1 / 256, frag: `
void main() {
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++)
    m += texture(uPass10, (vec2(float(x), float(y)) + 0.5) / 8.0).r;
  fragColor = vec4(vec3(m / 64.0), 1.0);
}` },
      // 12: full size composite.
      { frag: `
void main() {
  vec3 base = toLinear(texture(uInput, vUv).rgb);
  vec2 h = 0.75 / vec2(textureSize(uPass0, 0));
  vec3 soft = (texture(uPass0, vUv + vec2(-h.x, -h.y)).rgb + texture(uPass0, vUv + vec2(h.x, -h.y)).rgb +
               texture(uPass0, vUv + vec2(-h.x,  h.y)).rgb + texture(uPass0, vUv + vec2(h.x,  h.y)).rgb) * 0.25;
  base = mix(base, soft, p_softness * 0.45);
  vec3 b = texture(uPass9, vUv).rgb / 5.0;
  // Bloom is light on dark: in a frame that is bright overall (paper, sky, a
  // poster) it fades out, so a light scene is not washed over. Judged on the
  // whole frame, not the neighbourhood: a local test left a dark moat between
  // white text and its glow.
  b *= 1.0 - smoothstep(0.08, 0.35, texture(uPass11, vec2(0.5)).r);
  // Halation: the bloom's fringe goes warm, at the same luminance.
  vec3 warm = vec3(1.0, 0.46, 0.24) / 0.5585;
  b = mix(b, luma(b) * warm, p_halation * 0.55);
  fragColor = vec4(toSrgb(base + b * p_bloom * 1.1), 1.0);
}` }
    ]
  });
})();
