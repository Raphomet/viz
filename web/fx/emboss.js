// Emboss: the frame's luminance read as a height field and lit by a low,
// raking light, so the picture becomes a relief. Stone shows the relief alone
// in a pale grey; Colour keeps the image and only shades it. The light turns
// by a set angle on every beat, easing round over the first part of the beat,
// so the shadows swing with the music the way a lamp walked round a carving
// would; the bass deepens the relief. Softness blurs the height field first,
// which turns hard poster edges into bevels.
VIZ_FX.register({
  id: 'emboss',
  name: 'Emboss',
  group: 'texture',
  params: [
    { key: 'depth', label: 'Depth', min: 0, max: 1, default: 0.5 },
    { key: 'angle', label: 'Light angle', min: 0, max: 360, default: 135 },
    { key: 'turn', label: 'Turn per beat', min: 0, max: 90, default: 30 },
    { key: 'soft', label: 'Softness', min: 0, max: 1, default: 0.35 },
    { key: 'colour', label: 'Stone / colour', min: 0, max: 1, default: 0.6 },
    { key: 'gloss', label: 'Gloss', min: 0, max: 1, default: 0.35 },
    { key: 'swell', label: 'Bass depth', min: 0, max: 1, default: 0.5 }
  ],
  passes: [
    // 0: half-size height field (blurred luminance).
    { scale: 1 / 2, frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  float s = (0.5 + p_soft * 3.0) / 720.0;
  vec2 d = vec2(s / aspect, s);
  float h = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    float w = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
    h += w * sqrt(luma(clamp(texture(uInput, vUv + vec2(float(x), float(y)) * d).rgb, 0.0, 1.0)));
  }
  fragColor = vec4(vec3(h / 16.0), 1.0);
}` },
    { frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  float s = (0.75 + p_soft * 1.5) / 720.0;
  vec2 d = vec2(s / aspect, s);
  float hx = texture(uPass0, vUv + vec2(d.x, 0.0)).r - texture(uPass0, vUv - vec2(d.x, 0.0)).r;
  float hy = texture(uPass0, vUv + vec2(0.0, d.y)).r - texture(uPass0, vUv - vec2(0.0, d.y)).r;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float k = p_depth * (1.0 + p_swell * bass) * 9.0 / (0.75 + p_soft * 1.5);
  vec3 n = normalize(vec3(-hx * k, -hy * k, 1.0));
  float a = radians(p_angle + p_turn * (uBeatIndex + smoothstep(0.0, 0.4, uBeat)));
  float el = radians(28.0);
  vec3 L = vec3(cos(a) * cos(el), sin(a) * cos(el), sin(el));
  float shade = max(dot(n, L), 0.0) / sin(el);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  vec3 src = texture(uInput, vUv).rgb;
  vec3 base = mix(vec3(0.64, 0.62, 0.58), src, p_colour);
  // Shade is 1 on flat ground; lift the floor so shadows stay readable.
  vec3 outc = base * (0.22 + 0.78 * shade) + spec * p_gloss * 0.6;
  fragColor = vec4(outc, 1.0);
}` }
  ]
});
