// Time displacement: every pixel shows the frame from a different moment,
// chosen by a map (a gradient, rings from the centre, or drifting noise), so
// motion shears, bends and ripples across the frame while anything still
// stays put. The map value picks a depth into the history and the two nearest
// frames are blended, so the time surface is smooth rather than 32 visible
// layers; Steps posterises it into distinct bands of time instead.
//
// Music: bass deepens the displacement (a louder low end reaches further into
// the past), and the map rolls one notch on each beat with a short glide, so
// the shear visibly steps with the track without the frame jumping.
VIZ_FX.register({
  id: 'timedisp',
  name: 'Time displace',
  group: 'time',
  params: [
    { key: 'map', label: 'Map (gradient, radial, noise)', min: 0, max: 2, step: 1, default: 1 },
    { key: 'depth', label: 'Depth (frames)', min: 2, max: 31, step: 1, default: 24 },
    { key: 'angle', label: 'Gradient angle', min: 0, max: 1, default: 0.25 },
    { key: 'scale', label: 'Map scale', min: 0.5, max: 6, default: 1.5 },
    { key: 'drift', label: 'Drift', min: 0, max: 1, default: 0.25 },
    { key: 'steps', label: 'Steps (0 = smooth)', min: 0, max: 12, step: 1, default: 0 },
    { key: 'beat', label: 'Beat roll', min: 0, max: 1, default: 0.5 },
    { key: 'bass', label: 'Bass depth', min: 0, max: 1, default: 0.5 }
  ],
  history: 32,
  passes: [{ frag: `
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 frameAt(float f) {
  // f frames ago, blended between the two kept frames either side. The kept
  // frames are half size, so rather than show them directly, the change they
  // record (past minus now, both half size) is added to the full-size input:
  // whatever has not moved stays sharp, and only moving parts go soft.
  float f0 = floor(f);
  vec3 past = mix(histFrame(vUv, int(f0)).rgb, histFrame(vUv, int(f0) + 1).rgb, f - f0);
  vec3 now = histFrame(vUv, 0).rgb;
  return max(texture(uInput, vUv).rgb + past - now, 0.0);
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  int map = int(floor(p_map + 0.5));
  // Beat roll: one notch per beat, gliding over the first fifth of it.
  float roll = p_beat * 0.25 * (uBeatIndex + smoothstep(0.0, 0.2, uBeat));
  float t = uTime * p_drift * 0.15 + roll;
  float m;
  if (map == 0) {
    float a = p_angle * 6.28318530718;
    m = dot(p, vec2(cos(a), sin(a))) * p_scale * 0.5 + 0.5 - t;
  } else if (map == 1) {
    m = length(p) * p_scale - t;
  } else {
    vec2 q = p * p_scale * 1.5;
    m = vnoise(q + vec2(t * 0.7, -t * 0.4)) * 0.65 + vnoise(q * 2.3 - vec2(t * 0.3, t * 0.9)) * 0.35;
    m = m * 1.6 - t * 0.5;
  }
  // A triangle wave, so a rolling map never shows a seam where the newest
  // frame meets the oldest.
  m = abs(fract(m) * 2.0 - 1.0);
  float steps = floor(p_steps + 0.5);
  if (steps > 0.5) m = floor(m * steps + 0.5) / steps;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float depth = min(31.0, p_depth * (1.0 - 0.4 * p_bass + 0.4 * p_bass * 2.0 * bass));
  fragColor = vec4(frameAt(m * max(depth - 1.0, 0.0)), 1.0);
}` }]
});
