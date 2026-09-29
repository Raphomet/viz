// Palette: the frame reduced to 3-5 flat colours, the way nearly every LEXSAN
// loop sits in a handful of flats (docs/research/2026-09-28-lexsan-set.md).
// Each pixel's luminance picks a palette slot; with Rings above 0, the index
// of a ring streaming out of the centre is added to it, so the image breaks
// into concentric bands that cycle through the palette like the hexagon
// tunnel (#8).
//
// On the beat (every n beats) the palette rotates one slot. The new rotation
// spreads out from the centre as a ring over the first part of the beat
// rather than switching the whole frame at once, so each step is seen as a
// wave passing through the picture, not a full-frame flash (TASTE.md).
VIZ_FX.register({
  id: 'palette',
  name: 'Palette',
  group: 'colour',
  params: [
    { key: 'palette', label: 'Palette (0 Tunnel, 1 RGB, 2 Orange, 3 Pastel, 4 Synth, 5 De Stijl, 6 Moss, 7 Ice)', min: 0, max: 7, step: 1, default: 0 },
    { key: 'colours', label: 'Colours', min: 3, max: 5, step: 1, default: 5 },
    { key: 'bias', label: 'Tone bias', min: -1, max: 1, default: 0.25 },
    { key: 'smooth', label: 'Smooth', min: 0, max: 1, default: 0.5 },
    { key: 'rings', label: 'Rings', min: 0, max: 24, step: 1, default: 0 },
    { key: 'shape', label: 'Ring shape (0 Circle, 1 Hexagon, 2 Diamond)', min: 0, max: 2, step: 1, default: 1 },
    { key: 'speed', label: 'Ring speed', min: -2, max: 2, default: 0.5 },
    { key: 'every', label: 'Step every n beats (0 hold)', min: 0, max: 8, step: 1, default: 4 },
    { key: 'wipe', label: 'Step wipe (beats)', min: 0.05, max: 1, default: 0.5 }
  ],
  passes: [{ frag: `
// Five sRGB colours per palette, dark to light, so luminance keeps its order.
const vec3 P[40] = vec3[40](
  vec3(0.06, 0.08, 0.24), vec3(0.14, 0.30, 0.68), vec3(0.94, 0.47, 0.43), vec3(0.24, 0.82, 0.90), vec3(0.97, 0.95, 0.90),
  vec3(0.02, 0.02, 0.03), vec3(0.12, 0.22, 0.85), vec3(0.90, 0.13, 0.16), vec3(0.14, 0.78, 0.36), vec3(0.95, 0.95, 0.95),
  vec3(0.02, 0.01, 0.01), vec3(0.36, 0.08, 0.02), vec3(0.95, 0.40, 0.05), vec3(1.00, 0.70, 0.25), vec3(1.00, 0.95, 0.85),
  vec3(0.26, 0.23, 0.31), vec3(0.55, 0.60, 0.86), vec3(0.95, 0.62, 0.66), vec3(0.62, 0.88, 0.76), vec3(0.99, 0.93, 0.72),
  vec3(0.05, 0.02, 0.12), vec3(0.40, 0.05, 0.50), vec3(0.95, 0.22, 0.55), vec3(0.22, 0.76, 0.95), vec3(0.95, 0.95, 1.00),
  vec3(0.04, 0.04, 0.05), vec3(0.10, 0.25, 0.65), vec3(0.86, 0.13, 0.10), vec3(0.98, 0.82, 0.10), vec3(0.96, 0.95, 0.92),
  vec3(0.04, 0.07, 0.05), vec3(0.10, 0.28, 0.20), vec3(0.46, 0.56, 0.26), vec3(0.86, 0.70, 0.36), vec3(0.95, 0.92, 0.82),
  vec3(0.03, 0.04, 0.08), vec3(0.15, 0.22, 0.36), vec3(0.40, 0.56, 0.72), vec3(0.70, 0.86, 0.93), vec3(0.98, 0.99, 1.00)
);
float ringDist(vec2 p, int shape) {
  p = abs(p);
  if (shape == 1) return max(p.x * 0.8660254 + p.y * 0.5, p.y);
  if (shape == 2) return (p.x + p.y) * 0.7071068;
  return length(p);
}
void main() {
  // Luminance is read through a small blur: on De Stijl's paper the fibre
  // texture straddled a slot boundary and the flat sheet came out as
  // two-colour static (2026-09-28). Four bilinear taps average 16 texels.
  vec2 t = p_smooth * 1.5 * max(1.0, uRes.y / 1080.0) / vec2(textureSize(uInput, 0));
  vec3 c = 0.25 * (texture(uInput, vUv + vec2(-t.x, -t.y)).rgb + texture(uInput, vUv + vec2(t.x, -t.y)).rgb +
                   texture(uInput, vUv + vec2(-t.x, t.y)).rgb + texture(uInput, vUv + vec2(t.x, t.y)).rgb);
  c = clamp(c, 0.0, 1.0);
  int pal = int(clamp(floor(p_palette + 0.5), 0.0, 7.0));
  int n = int(clamp(floor(p_colours + 0.5), 3.0, 5.0));
  float l = pow(luma(c), exp2(-p_bias * 1.5));
  int idx = min(int(l * float(n)), n - 1);

  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float d = ringDist(p, int(floor(p_shape + 0.5)));
  float rings = floor(p_rings + 0.5);
  if (rings > 0.0) {
    // Log-spaced, so rings stream out of the centre at a steady visual rate;
    // the bass hurries them a little.
    float bass = 0.5 * (uBands[0] + uBands[1]);
    float k = floor(log(max(d, 1e-3)) * rings / 2.3 - uTime * p_speed * (1.0 + bass));
    idx += int(mod(k, float(n)));
  }

  float every = floor(p_every + 0.5);
  float rot = 0.0;
  if (every > 0.0) {
    float stepNow = floor(uBeatIndex / every);
    float phase = (mod(uBeatIndex, every) + uBeat) / every;
    // The new rotation grows from the centre; ease-out, reaching the corners
    // by the end of the wipe.
    float w = clamp(phase * every / p_wipe, 0.0, 1.0);
    float front = (1.0 - (1.0 - w) * (1.0 - w)) * 1.05 * length(vec2(aspect, 1.0) * 0.5);
    rot = d * (p_shape > 1.5 ? 1.4142 : 1.0) < front ? stepNow : stepNow - 1.0;
  }
  idx = int(mod(float(idx) + rot, float(n)));
  // Spread n slots evenly over the five, keeping the darkest and lightest.
  int slot = int(floor(float(idx) * 4.0 / float(n - 1) + 0.5));
  fragColor = vec4(P[pal * 5 + slot], 1.0);
}` }]
});
