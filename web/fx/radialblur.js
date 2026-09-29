// Radial (spin) blur: the frame smeared along arcs about a centre that
// wanders, as if the camera spun on its axis. Two passes: sixteen taps
// across the whole arc at half size, then eight taps across one of those
// steps at full size, which smooths the steps into a continuous smear for
// the price of 24 reads. Near the centre, where the arc is shorter than a
// couple of pixels, the untouched input shows through, so the centre stays
// sharp.
//
// Music: bass widens the arc as it swells; the kick adds a short push.
(function () {
  var common = `
vec2 centre() {
  return vec2(p_x, p_y) + p_drift * 0.2 * vec2(sin(uTime * 0.21) + 0.5 * sin(uTime * 0.53), cos(uTime * 0.17) + 0.5 * cos(uTime * 0.41));
}
float arc() {
  float bass = 0.5 * (uBands[0] + uBands[1]);
  return radians(p_amount * 24.0) * (1.0 + p_react * (0.8 * bass + 0.8 * uKick));
}
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c) * p; }
`;
  VIZ_FX.register({
    id: 'radialblur',
    name: 'Spin blur',
    group: 'lens',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.3 },
      { key: 'x', label: 'Centre x', min: 0, max: 1, default: 0.5 },
      { key: 'y', label: 'Centre y', min: 0, max: 1, default: 0.5 },
      { key: 'drift', label: 'Centre drift', min: 0, max: 1, default: 0.4 },
      { key: 'react', label: 'Reaction', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      { scale: 1 / 2, frag: common + `
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 c = centre();
  vec2 p = (vUv - c) * vec2(aspect, 1.0);
  float A = arc();
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float a = A * (float(i) / 15.0 - 0.5);
    acc += texture(uInput, mirrorUv(c + rot(p, a) / vec2(aspect, 1.0))).rgb;
  }
  fragColor = vec4(acc / 16.0, 1.0);
}` },
      { frag: common + `
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 c = centre();
  vec2 p = (vUv - c) * vec2(aspect, 1.0);
  float A = arc();
  float stepA = A / 15.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = stepA * (float(i) / 7.0 - 0.5);
    acc += texture(uSrc, mirrorUv(c + rot(p, a) / vec2(aspect, 1.0))).rgb;
  }
  acc /= 8.0;
  // Arc length in pixels decides how much of the sharp input survives.
  float lenPx = length(p) * A * uRes.y;
  fragColor = vec4(mix(texture(uInput, vUv).rgb, acc, smoothstep(1.0, 4.0, lenPx)), 1.0);
}` }
    ]
  });
})();
