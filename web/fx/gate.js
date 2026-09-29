// Gate: the picture appears on the hit and falls away between hits, LEXSAN's
// beat-gated visibility (#3 in docs/research/2026-09-28-lexsan-set.md, "the
// most legible music reaction in the set"). Between hits it sinks to black or
// to an alternate grade (the frame's light run through a two-ink ramp), so the
// hit also reads as a palette swap.
//
// TASTE.md forbids full-frame strobing at 3-30 Hz, so the whole-frame gate
// never runs faster than once a beat (about 2 Hz at 124 BPM), rises over a
// short eased pre-roll into the downbeat rather than switching, and decays.
// Faster rates are only allowed when the gate is confined to cells or bands,
// where each hit changes a scattered part of the frame, and even there no
// faster than twice a beat.
VIZ_FX.register({
  id: 'gate',
  name: 'Gate',
  group: 'time',
  params: [
    { key: 'rate', label: 'Rate (bar, 2 beats, beat, half beat)', min: 0, max: 3, step: 1, default: 2 },
    { key: 'release', label: 'Release', min: 0.05, max: 1, default: 0.45 },
    { key: 'floor', label: 'Floor', min: 0, max: 1, default: 0.1 },
    { key: 'alt', label: 'Fall to grade (0 = black)', min: 0, max: 1, default: 0.6 },
    { key: 'hue', label: 'Grade hue', min: 0, max: 1, default: 0.72 },
    { key: 'confine', label: 'Confine (full, cells, bands)', min: 0, max: 2, step: 1, default: 0 },
    { key: 'cells', label: 'Cells across', min: 2, max: 16, step: 1, default: 6 },
    { key: 'share', label: 'Share that gates', min: 0, max: 1, default: 0.5 },
    { key: 'kick', label: 'Kick opens', min: 0, max: 1, default: 0.3 }
  ],
  passes: [{ frag: `
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  int confine = int(floor(p_confine + 0.5));
  int rate = int(floor(p_rate + 0.5));
  if (confine == 0) rate = min(rate, 2);                // whole frame: a beat at most
  float period = rate == 0 ? 4.0 : rate == 1 ? 2.0 : rate == 2 ? 1.0 : 0.5;
  float pos = uBeatIndex + uBeat;
  float idx = floor(pos / period);
  float ph = (pos - idx * period) / period;             // 0 on the hit, 1 at the next

  // Rise over the last few hundredths before the hit, decay after it: eased
  // both ways, and the peak lands on the grid.
  float rel = p_release * p_release * 3.0 + 0.02;
  float env = exp(-ph / rel);
  env = max(env, smoothstep(1.0 - 0.06 / period, 1.0, ph));
  float kickCap = confine == 0 ? 0.35 : 1.0;
  env = max(env, uKick * p_kick * kickCap);
  float lvl = mix(p_floor, 1.0, env);

  // Where the gate applies: everywhere, or a fresh random set of cells or
  // bands chosen on each hit.
  float gated = 1.0;
  if (confine > 0) {
    float aspect = uRes.x / uRes.y;
    float n = floor(p_cells + 0.5);
    vec2 cell = confine == 1 ? floor(vUv * vec2(n, max(1.0, floor(n / aspect + 0.5))))
                             : vec2(0.0, floor(vUv.y * n * 1.5));
    gated = step(hash12(cell * 1.37 + idx * 7.13 + 0.5), p_share);
  }

  // The fallen state: black, or the frame's light through two inks.
  float l = luma(c);
  vec3 inkA = hsv(p_hue, 0.8, 0.12), inkB = hsv(p_hue + 0.12, 0.65, 0.75);
  vec3 dim = mix(vec3(0.0), mix(inkA, inkB, smoothstep(0.05, 0.95, l)), p_alt);
  vec3 outc = mix(dim, c, lvl);
  fragColor = vec4(mix(c, outc, gated), 1.0);
}` }]
});
