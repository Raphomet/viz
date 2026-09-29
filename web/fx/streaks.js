// Anamorphic streaks: long thin horizontal flares from the brightest points
// only, as an anamorphic lens draws them. Restrained on purpose: a high
// threshold, and points count only when they are much brighter than their
// surroundings, so a white poster or a bright sky does not flare across the
// frame (bloom learned this on De Stijl's paper, 2026-09-28). The streak is
// three widening horizontal blurs at quarter size (reach grows 1, 5, 25
// texels per tap), an exponential profile, tinted towards the cyan-blue of
// the classic lens flare.
//
// Music: bass stretches the streaks; hats make them glint.
(function () {
  // Horizontal blur with taps `spacing` texels apart, exponential falloff.
  var hblur = function (spacing) {
    return `
void main() {
  float tx = 1.0 / float(textureSize(uSrc, 0).x);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float sp = ${spacing.toFixed(1)} * p_length * (1.0 + 0.6 * p_react * bass);
  vec3 acc = texture(uSrc, vUv).rgb;
  float wsum = 1.0;
  for (int i = 1; i <= 4; i++) {
    float w = exp(-float(i) * 0.55);
    acc += (texture(uSrc, vUv + vec2(float(i) * sp * tx, 0.0)).rgb + texture(uSrc, vUv - vec2(float(i) * sp * tx, 0.0)).rgb) * w;
    wsum += 2.0 * w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}`;
  };

  VIZ_FX.register({
    id: 'streaks',
    name: 'Anamorphic streaks',
    group: 'lens',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.4 },
      { key: 'threshold', label: 'Threshold', min: 0.3, max: 1, default: 0.75 },
      { key: 'length', label: 'Length', min: 0.2, max: 2, default: 1 },
      { key: 'tint', label: 'Blue tint', min: 0, max: 1, default: 0.6 },
      { key: 'react', label: 'Reaction', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      // 0: quarter size, linear light.
      { scale: 1 / 4, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = toLinear(texture(uInput, vUv + vec2(-t.x, -t.y)).rgb) + toLinear(texture(uInput, vUv + vec2(t.x, -t.y)).rgb) +
           toLinear(texture(uInput, vUv + vec2(-t.x,  t.y)).rgb) + toLinear(texture(uInput, vUv + vec2(t.x,  t.y)).rgb);
  fragColor = vec4(c * 0.25, 1.0);
}` },
      // 1: 1/32 size, the broad brightness of the surroundings.
      { scale: 1 / 32, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uPass0, 0));
  float m = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++)
    m += luma(texture(uPass0, vUv + (vec2(float(x), float(y)) * 2.0 - 3.0) * t).rgb);
  fragColor = vec4(vec3(m / 16.0), 1.0);
}` },
      // 2: quarter size, only points well above threshold and their surroundings.
      { scale: 1 / 4, frag: `
void main() {
  vec3 c = texture(uPass0, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float thr = toLinear(vec3(p_threshold)).r;
  float w = smoothstep(thr, thr * 1.6 + 0.05, br);
  float around = texture(uPass1, vUv).r;
  w *= 1.0 - smoothstep(0.1, 0.4, around);
  w *= smoothstep(0.0, 0.3, br - around * 1.5);
  fragColor = vec4(c * w, 1.0);
}` },
      { scale: 1 / 4, frag: hblur(1) },   // 3
      { scale: 1 / 4, frag: hblur(5) },   // 4
      { scale: 1 / 4, frag: hblur(25) },  // 5
      { frag: `
void main() {
  vec3 base = toLinear(texture(uInput, vUv).rgb);
  vec3 s = texture(uSrc, vUv).rgb * 0.6 + texture(uPass4, vUv).rgb * 0.4;
  vec3 tint = vec3(0.35, 0.65, 1.0) / 0.6115;
  s = mix(s, luma(s) * tint, p_tint);
  float glint = 1.0 + p_react * 1.5 * uHat;
  fragColor = vec4(toSrgb(base + s * p_amount * 3.0 * glint), 1.0);
}` }
    ]
  });
})();
