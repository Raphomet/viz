// Directional blur: motion blur along one angle, as if the picture were
// panned past a slow shutter. Two passes: sixteen taps across the whole
// length at half size, eight across one of those steps at full size. Trail
// moves the kernel from centred (a smear both ways) to one-sided (a streak
// left behind, like a speed line). The angle can turn slowly on its own.
//
// Music: bass lengthens the smear as it swells; the kick adds a short push.
(function () {
  var common = `
vec2 blurVec() {
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float a = radians(p_angle) + uTime * p_turn * 0.4;
  float len = p_length * 0.08 * (1.0 + p_react * (0.8 * bass + 0.8 * uKick));
  float aspect = uRes.x / uRes.y;
  return vec2(cos(a), sin(a)) / vec2(aspect, 1.0) * len;
}
`;
  VIZ_FX.register({
    id: 'dirblur',
    name: 'Directional blur',
    group: 'lens',
    params: [
      { key: 'length', label: 'Length', min: 0, max: 1, default: 0.3 },
      { key: 'angle', label: 'Angle', min: 0, max: 360, default: 0 },
      { key: 'turn', label: 'Turn', min: -1, max: 1, default: 0 },
      { key: 'trail', label: 'Trail (one-sided)', min: 0, max: 1, default: 0 },
      { key: 'react', label: 'Reaction', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      { scale: 1 / 2, frag: common + `
void main() {
  vec2 v = blurVec();
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 16; i++) {
    float t = float(i) / 15.0;
    // Centred: -0.5..0.5; trail: 0..1 behind, fading.
    float o = mix(t - 0.5, t, p_trail);
    float w = mix(1.0, 1.0 - t * 0.85, p_trail);
    acc += texture(uInput, mirrorUv(vUv - v * o)).rgb * w;
    wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}` },
      { frag: common + `
void main() {
  vec2 v = blurVec();
  vec2 st = v / 15.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) acc += texture(uSrc, vUv - st * (float(i) / 7.0 - 0.5)).rgb;
  acc /= 8.0;
  float lenPx = length(v * vec2(uRes.x / uRes.y, 1.0)) * uRes.y;
  fragColor = vec4(mix(texture(uInput, vUv).rgb, acc, smoothstep(1.0, 4.0, lenPx)), 1.0);
}` }
    ]
  });
})();
