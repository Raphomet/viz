// Halftone: the frame re-screened as print dots. CMYK lays four rotated
// screens of subtractive ink over paper (the classic 15/75/0/45 degree set,
// turned together by Screen angle); Ink is one dark screen on paper; Light is
// dots of the scene's own colour on black, for dark scenes. Dot area follows
// tone and the bass breathes the whole screen's dot gain, which reads as the
// print getting heavier on the low end without anything flashing.
// Each dot is taken as the union of the four nearest cells, so heavy tones
// merge into round-cornered chains instead of being clipped to square cells.
VIZ_FX.register({
  id: 'halftone',
  name: 'Halftone',
  group: 'texture',
  params: [
    { key: 'cells', label: 'Cells', min: 20, max: 200, step: 1, default: 70 },
    { key: 'style', label: 'CMYK / ink / light', min: 0, max: 2, step: 1, default: 0 },
    { key: 'angle', label: 'Screen angle', min: 0, max: 90, default: 0 },
    { key: 'gain', label: 'Dot gain', min: 0.5, max: 2, default: 1 },
    { key: 'swell', label: 'Bass breath', min: 0, max: 1, default: 0.5 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 1 }
  ],
  passes: [
    // 0: quarter-size box average, so a cell's tone is its area, not one pixel.
    { scale: 1 / 4, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = texture(uInput, vUv + vec2(-t.x, -t.y)).rgb + texture(uInput, vUv + vec2(t.x, -t.y)).rgb +
           texture(uInput, vUv + vec2(-t.x,  t.y)).rgb + texture(uInput, vUv + vec2(t.x,  t.y)).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}` },
    { frag: `
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// Tone (0 = no ink, 1 = solid) of channel ch for a cell colour.
// ch 0-2: C, M, Y after black removal; 3: K; 4: darkness; 5: value (light).
float tone(vec3 c, int ch) {
  c = clamp(c, 0.0, 1.0);
  float mx = max(c.r, max(c.g, c.b));
  float k = 1.0 - mx;
  // A small floor keeps near-white paper clean of stray dots.
  float v;
  if (ch < 3) v = (1.0 - c[ch] - k) / max(1.0 - k, 1e-3);
  // Black gets a higher floor: tinted paper read as a field of grey dots.
  else if (ch == 3) return max(0.0, (k - 0.2) / 0.8);
  else if (ch == 4) v = 1.0 - luma(c);
  else return mx;
  return max(0.0, (v - 0.1) / 0.9);
}

// Coverage of one screen at angle a, and the colour of the cell that won.
float screen(vec2 px, float cell, float a, int ch, float gain, out vec3 cellCol) {
  vec2 q = rot(px - uRes * 0.5, -a) / cell;
  vec2 base = floor(q - 0.5);
  float cov = 0.0;
  cellCol = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 cid = base + vec2(float(i), float(j)) + 0.5;
    vec2 cpx = rot(cid * cell, a) + uRes * 0.5;
    vec3 c = texture(uPass0, cpx / uRes).rgb;
    float v = clamp(tone(c, ch) * gain, 0.0, 1.0);
    float r = sqrt(v) * cell * 0.72;
    float d = length(q - cid) * cell;
    float k = 1.0 - smoothstep(r - 0.75, r + 0.75, d);
    if (k > cov) { cov = k; cellCol = c; }
  }
  return cov;
}

void main() {
  vec2 px = vUv * uRes;
  float cell = uRes.y / p_cells;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float gain = p_gain * (1.0 + p_swell * 0.7 * (bass - 0.25));
  vec3 src = texture(uInput, vUv).rgb;
  int style = int(floor(p_style + 0.5));
  float a0 = radians(p_angle);
  vec3 paper = vec3(0.95, 0.93, 0.88);
  vec3 outc;
  vec3 cc;
  if (style == 0) {
    outc = paper;
    outc *= mix(vec3(1.0), vec3(0.0, 0.62, 0.88), screen(px, cell, a0 + radians(15.0), 0, gain, cc));
    outc *= mix(vec3(1.0), vec3(0.92, 0.14, 0.52), screen(px, cell, a0 + radians(75.0), 1, gain, cc));
    outc *= mix(vec3(1.0), vec3(1.0, 0.9, 0.06), screen(px, cell, a0, 2, gain, cc));
    outc *= mix(vec3(1.0), vec3(0.13, 0.12, 0.14), screen(px, cell, a0 + radians(45.0), 3, gain, cc));
  } else if (style == 1) {
    outc = mix(paper, vec3(0.1, 0.1, 0.13), screen(px, cell, a0 + radians(45.0), 4, gain, cc));
  } else {
    float k = screen(px, cell, a0 + radians(45.0), 5, gain, cc);
    // Area carries the brightness, so each dot is lit at full value.
    cc = clamp(cc, 0.0, 1.0);
    outc = cc / max(max(cc.r, max(cc.g, cc.b)), 0.05) * k;
  }
  fragColor = vec4(mix(src, outc, p_mix), 1.0);
}` }
  ]
});
