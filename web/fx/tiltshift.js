// Tilt-shift: the miniature look. A band of the frame stays sharp and
// everything away from it goes out of focus, blur growing with distance as
// with a tilted lens plane; colour gets a small lift in saturation and
// contrast, as toy-town photographs usually do. The blur is a 32-tap
// golden-angle disc at half size in linear light, with bright points
// weighted up a little so highlights open into soft discs (bokeh) instead of
// greying out.
//
// Music: Rack focus moves the band to a new place every four beats, gliding
// over the first beat of the four, like a focus puller following the music.
VIZ_FX.register({
  id: 'tiltshift',
  name: 'Tilt-shift',
  group: 'lens',
  params: [
    { key: 'position', label: 'Focus position', min: 0, max: 1, default: 0.45 },
    { key: 'width', label: 'Focus width', min: 0, max: 1, default: 0.25 },
    { key: 'angle', label: 'Angle', min: -90, max: 90, default: 0 },
    { key: 'blur', label: 'Blur', min: 0, max: 1, default: 0.5 },
    { key: 'saturation', label: 'Toy colour', min: 0, max: 1, default: 0.35 },
    { key: 'rack', label: 'Rack focus', min: 0, max: 1, default: 0.3 }
  ],
  passes: [
    // 0: half size, linear light.
    { scale: 1 / 2, frag: `
void main() {
  vec2 t = 0.5 / vec2(textureSize(uInput, 0));
  vec3 c = toLinear(texture(uInput, vUv + vec2(-t.x, -t.y)).rgb) + toLinear(texture(uInput, vUv + vec2(t.x, -t.y)).rgb) +
           toLinear(texture(uInput, vUv + vec2(-t.x,  t.y)).rgb) + toLinear(texture(uInput, vUv + vec2(t.x,  t.y)).rgb);
  fragColor = vec4(c * 0.25, 1.0);
}` },
    // 1: half size, the variable disc blur. Circle of confusion in alpha.
    { scale: 1 / 2, frag: `
float coc(vec2 uv) {
  float aspect = uRes.x / uRes.y;
  float stepN = floor(uBeatIndex / 4.0);
  float phase = (mod(uBeatIndex, 4.0) + uBeat) / 4.0;
  float g = smoothstep(0.0, 0.25, phase);
  float from_ = hash12(vec2(stepN - 1.0, 4.2)) - 0.5, to_ = hash12(vec2(stepN, 4.2)) - 0.5;
  float pos = p_position + p_rack * 0.5 * mix(from_, to_, g);
  float a = radians(p_angle);
  vec2 n = vec2(-sin(a), cos(a));
  float d = abs(dot((uv - vec2(0.5, pos)) * vec2(aspect, 1.0), n));
  return clamp((d - p_width * 0.5) / 0.4, 0.0, 1.0);
}
void main() {
  float k = coc(vUv);
  // Radius in pixels of this half-size pass: up to ~2.4% of the height.
  float R = k * p_blur * 0.024 * uRes.y;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 32; i++) {
    float r = sqrt((float(i) + 0.5) / 32.0) * R;
    float th = float(i) * 2.39996323;
    vec2 uv = vUv + vec2(cos(th), sin(th)) * r / uRes;
    vec3 c = texture(uSrc, uv).rgb;
    // Bright points count for more, so highlights bloom into discs.
    float w = 1.0 + 3.0 * smoothstep(0.6, 1.0, luma(c));
    acc += c * w;
    wsum += w;
  }
  fragColor = vec4(acc / wsum, k);
}` },
    { frag: `
void main() {
  vec3 sharp = toLinear(texture(uInput, vUv).rgb);
  vec4 b = texture(uSrc, vUv);
  float R = b.a * p_blur * 0.048 * uRes.y;
  vec3 c = mix(sharp, b.rgb, smoothstep(0.5, 3.0, R));
  vec3 g = toSrgb(c);
  // Toy colour: a little more saturation and an S-curve.
  float l = luma(g);
  g = l + (g - l) * (1.0 + 0.6 * p_saturation);
  g = mix(g, g * g * (3.0 - 2.0 * g), 0.35 * p_saturation);
  fragColor = vec4(max(g, 0.0), 1.0);
}` }
  ]
});
