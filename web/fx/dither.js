// Dither: the frame reduced to a few tones, the steps between them rendered
// as ordered Bayer crosshatch or as noise (interleaved gradient noise, which
// is blue-ish: no clumps, the texture of an old Mac or a Game Boy). Steps is
// the number of steps above black per channel (1 = one-bit). Palettes: RGB per
// channel, one ink on paper, Game Boy greens, and a two-ink riso ramp.
// Music: the bass lifts the tone (more of the frame crosses into the lighter
// step, so the pattern visibly shifts on the low end), and hats make the
// pattern fizz: while they play, the threshold map moves on every 1/20 s.
VIZ_FX.register({
  id: 'dither',
  name: 'Dither',
  group: 'texture',
  params: [
    { key: 'levels', label: 'Steps', min: 1, max: 4, step: 1, default: 2 },
    { key: 'pattern', label: 'Bayer / noise', min: 0, max: 1, step: 1, default: 0 },
    { key: 'palette', label: 'RGB / ink / GB / riso', min: 0, max: 3, step: 1, default: 3 },
    { key: 'size', label: 'Pixel size', min: 1, max: 8, default: 3 },
    { key: 'contrast', label: 'Contrast', min: 0.5, max: 2, default: 1.1 },
    { key: 'swell', label: 'Bass lift', min: 0, max: 1, default: 0.5 },
    { key: 'fizz', label: 'Hat fizz', min: 0, max: 1, default: 0.5 }
  ],
  passes: [{ frag: `
float bayer8(ivec2 p) {
  int x = p.x & 7, y = p.y & 7, z = x ^ y;
  int v = ((z & 1) << 5) | ((y & 1) << 4) | ((z & 2) << 2) | ((y & 2) << 1) | ((z & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 ramp4(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  return t < 1.0 ? mix(a, b, t) : t < 2.0 ? mix(b, c, t - 1.0) : mix(c, d, t - 2.0);
}

void main() {
  // Pixel size is in 720p pixels, so the grain looks the same on any screen.
  float px = max(1.0, floor(p_size * uRes.y / 720.0 + 0.5));
  vec2 cell = floor(vUv * uRes / px);
  vec3 c = clamp(texture(uInput, (cell + 0.5) * px / uRes).rgb, 0.0, 1.0);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  c = clamp((c - 0.5) * p_contrast + 0.5 + p_swell * 0.22 * (bass - 0.3), 0.0, 1.0);

  float seed = floor(uTime * 20.0) * step(0.12, uHat * p_fizz);
  int pat = int(floor(p_pattern + 0.5));
  float th = pat == 0 ? bayer8(ivec2(cell) + ivec2(int(seed) * 3, int(seed) * 5))
                      : ign(cell + seed * vec2(5.3, 11.7));
  float n = floor(p_levels + 0.5);
  int pal = int(floor(p_palette + 0.5));
  vec3 outc;
  if (pal == 0) {
    outc = clamp(floor(c * n + th) / n, 0.0, 1.0);
  } else {
    float q = clamp(floor(luma(c) * n + th) / n, 0.0, 1.0);
    if (pal == 1) outc = mix(vec3(0.1, 0.1, 0.13), vec3(0.95, 0.93, 0.88), q);
    else if (pal == 2) outc = ramp4(q, vec3(0.06, 0.22, 0.06), vec3(0.19, 0.38, 0.19), vec3(0.55, 0.67, 0.06), vec3(0.61, 0.74, 0.06));
    else outc = ramp4(q, vec3(0.1, 0.12, 0.32), vec3(0.45, 0.2, 0.5), vec3(1.0, 0.36, 0.56), vec3(0.97, 0.94, 0.86));
  }
  fragColor = vec4(outc, 1.0);
}` }]
});
