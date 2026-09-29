// Zoom blur: the frame streaked outwards from a wandering centre, the rush of
// a dolly through the picture. Same two-pass shape as the spin blur (sixteen
// taps at half size, eight at full size across one step). Rays turns it from
// a blur into light shafts: only the bright parts are streaked, and they are
// added over the sharp frame instead of replacing it, which suits light on
// black; on a light poster it stays close to a plain blur.
//
// Music: bass lengthens the streaks as it swells; the kick adds a short push.
(function () {
  var common = `
vec2 centre() {
  return vec2(p_x, p_y) + p_drift * 0.2 * vec2(sin(uTime * 0.19) + 0.5 * sin(uTime * 0.47), cos(uTime * 0.23) + 0.5 * cos(uTime * 0.37));
}
float zlen() {
  float bass = 0.5 * (uBands[0] + uBands[1]);
  return p_amount * 0.35 * (1.0 + p_react * (0.7 * bass + 0.7 * uKick));
}
`;
  VIZ_FX.register({
    id: 'zoomblur',
    name: 'Zoom blur',
    group: 'lens',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.2 },
      { key: 'x', label: 'Centre x', min: 0, max: 1, default: 0.5 },
      { key: 'y', label: 'Centre y', min: 0, max: 1, default: 0.5 },
      { key: 'drift', label: 'Centre drift', min: 0, max: 1, default: 0.4 },
      { key: 'rays', label: 'Rays (light only)', min: 0, max: 1, default: 0 },
      { key: 'react', label: 'Reaction', min: 0, max: 1, default: 0.5 }
    ],
    passes: [
      { scale: 1 / 2, frag: common + `
void main() {
  vec2 c = centre();
  float L = zlen();
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float s = 1.0 - L * float(i) / 15.0;
    vec3 v = texture(uInput, mirrorUv(c + (vUv - c) * s)).rgb;
    // Rays: keep only the light, in linear terms, fading with distance.
    vec3 lin = toLinear(v);
    vec3 ray = lin * smoothstep(0.35, 0.9, luma(v)) * (1.0 - float(i) / 16.0);
    acc += mix(v, ray, p_rays);
  }
  fragColor = vec4(acc / 16.0, 1.0);
}` },
      { frag: common + `
void main() {
  vec2 c = centre();
  float L = zlen();
  float stepL = L / 15.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float s = 1.0 - stepL * float(i) / 7.0;
    acc += texture(uSrc, mirrorUv(c + (vUv - c) * s)).rgb;
  }
  acc /= 8.0;
  vec3 src = texture(uInput, vUv).rgb;
  float aspect = uRes.x / uRes.y;
  float lenPx = length((vUv - c) * vec2(aspect, 1.0)) * L * uRes.y;
  vec3 blurred = mix(src, acc, smoothstep(1.0, 4.0, lenPx));
  vec3 rays = toSrgb(toLinear(src) + acc * 2.2);
  fragColor = vec4(mix(blurred, rays, p_rays), 1.0);
}` }
    ]
  });
})();
