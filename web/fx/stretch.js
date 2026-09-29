// Stretch: pixel stretch. One row (or column) of the frame is smeared out
// toward the edge, the datamosh-poster look where the picture above a line is
// replaced by long streaks of that line's colours. The line wanders to a new
// place every n beats, gliding over the first third of the step rather than
// jumping, and the kick lengthens the streak for a moment, so the beat lands
// in the smeared region only. Melt lets the streak drift a little into the
// picture as it goes, so it carries a gradient instead of a flat bar.
VIZ_FX.register({
  id: 'stretch',
  name: 'Stretch',
  group: 'space',
  params: [
    { key: 'vertical', label: 'Rows / columns', min: 0, max: 1, step: 1, default: 0 },
    { key: 'position', label: 'Position', min: 0, max: 1, default: 0.55 },
    { key: 'length', label: 'Length', min: 0, max: 1, default: 0.7 },
    { key: 'both', label: 'Both sides', min: 0, max: 1, step: 1, default: 0 },
    { key: 'wander', label: 'Beat wander', min: 0, max: 1, default: 0.5 },
    { key: 'every', label: 'Every n beats', min: 1, max: 16, step: 1, default: 4 },
    { key: 'kick', label: 'Kick reach', min: 0, max: 1, default: 0.4 },
    { key: 'melt', label: 'Melt', min: 0, max: 1, default: 0.25 }
  ],
  passes: [{ frag: `
float posFor(float step_) {
  return mix(p_position, 0.15 + 0.7 * hash12(vec2(step_ * 2.13, 5.7)), p_wander);
}
void main() {
  bool vert = p_vertical > 0.5;
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  float pos = mix(posFor(stepNow - 1.0), posFor(stepNow), smoothstep(0.0, 0.33, phase));
  float along = vert ? vUv.x : vUv.y;
  float across = vert ? vUv.y : vUv.x;
  float side = along >= pos ? 1.0 : -1.0;
  if (p_both < 0.5) side = 1.0;
  float d = (along - pos) * side;                     // distance into the smear
  float room = side > 0.0 ? 1.0 - pos : pos;          // how far the edge is
  float reach = room * min(1.0, p_length * (1.0 + p_kick * 0.5 * uKick));
  vec2 uv = vUv;
  if (d > 0.0) {
    // Hats shimmer the melt per streak, so the smear has grain in it.
    float wob = 1.0 + 0.3 * uHat * (hash12(vec2(floor(across * 400.0), uBeatIndex)) - 0.5);
    float src = pos + side * d * p_melt * 0.12 * wob;
    float a = vert ? uv.x : uv.y;
    a = mix(src, a, smoothstep(reach - 0.004, reach + 0.004, d));
    if (vert) uv.x = a; else uv.y = a;
  }
  fragColor = vec4(texture(uSrc, uv).rgb, 1.0);
}` }]
});
