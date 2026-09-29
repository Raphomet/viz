// Turbulence: noise-field displacement, after After Effects' Turbulent
// Displace. Pass 0 builds the displacement field at quarter size (it is
// smooth, so a quarter of the pixels lose nothing and make five octaves of
// noise nearly free at 3024x1890); pass 1 pushes the frame's pixels along it.
// Twist swaps the field for its curl, so the image swirls in eddies instead
// of bulging and pinching. Bass swells the amount; hats rough up the finest
// octave, so the texture shivers on the hi-hats while the big shapes roll.
VIZ_FX.register({
  id: 'turbulence',
  name: 'Turbulence',
  group: 'space',
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.4 },
    { key: 'size', label: 'Size', min: 0.1, max: 1, default: 0.45 },
    { key: 'complexity', label: 'Complexity', min: 1, max: 5, step: 1, default: 3 },
    { key: 'speed', label: 'Evolution', min: 0, max: 1, default: 0.3 },
    { key: 'twist', label: 'Twist', min: 0, max: 1, default: 0.5 },
    { key: 'swell', label: 'Bass swell', min: 0, max: 1, default: 0.5 },
    { key: 'hat', label: 'Hat shiver', min: 0, max: 1, default: 0.5 }
  ],
  passes: [
    { scale: 1 / 4, frag: `
vec2 grad(vec2 i) { float h = hash12(i) * 6.2831853; return vec2(cos(h), sin(h)); }
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dot(grad(i), f), dot(grad(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(grad(i + vec2(0, 1)), f - vec2(0, 1)), dot(grad(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p, float t) {
  float n = floor(p_complexity + 0.5), s = 0.0, a = 0.5;
  for (int o = 0; o < 5; o++) {
    if (float(o) >= n) break;
    // Each octave drifts its own way, so the field evolves rather than slides.
    float fo = float(o);
    vec2 d = vec2(cos(fo * 2.4 + 0.3), sin(fo * 2.4 + 0.3)) * t * (0.6 + 0.3 * fo);
    float amp = a * (fo == n - 1.0 && n > 1.0 ? 1.0 + p_hat * 1.5 * uHat : 1.0);
    s += amp * gnoise(p + d + fo * 17.3);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s;
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vUv * vec2(aspect, 1.0) * mix(9.0, 1.2, p_size);
  float t = uTime * p_speed * 0.6;
  vec2 bulge = vec2(fbm(p, t), fbm(p + vec2(41.7, 13.1), t));
  vec2 curl = vec2(0.0);
  if (p_twist > 0.0) {
    float e = 0.08;
    float n0 = fbm(p + vec2(0.0, e), t) - fbm(p - vec2(0.0, e), t);
    float n1 = fbm(p + vec2(e, 0.0), t) - fbm(p - vec2(e, 0.0), t);
    curl = vec2(n0, -n1) / (2.0 * e) * 0.35;
  }
  fragColor = vec4(mix(bulge, curl, p_twist), 0.0, 1.0);
}` },
    { frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  vec2 d = texture(uPass0, vUv).rg;
  float amt = p_amount * (1.0 - 0.4 * p_swell + 0.8 * p_swell * bass);
  vec2 uv = vUv + d * amt * 0.2 / vec2(aspect, 1.0);
  fragColor = vec4(texture(uInput, mirrorUv(uv)).rgb, 1.0);
}` }
  ]
});
