// Tile: the frame repeated in an n x n grid (each tile keeps the frame's
// aspect), after LEXSAN's tiled eyes, where the count stepped between about
// 4x3 and 6x5 while the clip played on. Here the count re-picks every n beats
// and cross-dissolves over the first quarter of the step rather than
// snapping, and each tile can look at a slightly different part of the
// picture, nudged apart by the kick, so the grid breathes tile by tile
// instead of as one block.
VIZ_FX.register({
  id: 'tile',
  name: 'Tile',
  group: 'space',
  params: [
    { key: 'count', label: 'Tiles', min: 1, max: 8, step: 1, default: 3 },
    { key: 'animate', label: 'Count steps', min: 0, max: 4, step: 1, default: 2 },
    { key: 'every', label: 'Every n beats', min: 1, max: 16, step: 1, default: 4 },
    { key: 'offset', label: 'Per-tile offset', min: 0, max: 1, default: 0.35 },
    { key: 'kick', label: 'Kick nudge', min: 0, max: 1, default: 0.5 },
    { key: 'zoom', label: 'Zoom in tile', min: 1, max: 3, default: 1.2 },
    { key: 'mirror', label: 'Mirror tiles', min: 0, max: 1, step: 1, default: 0 }
  ],
  passes: [{ frag: `
float countFor(float step_) {
  float extra = floor(p_animate + 0.5);
  return floor(p_count + 0.5) + floor(hash12(vec2(step_ * 1.71, 3.3)) * (extra + 0.999));
}
vec3 grid(float n) {
  vec2 g = vUv * n;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  if (p_mirror > 0.5) f = mix(f, 1.0 - f, mod(cell, 2.0));
  vec2 h = vec2(hash12(cell + 0.37), hash12(cell.yx + 7.9)) - 0.5;
  float ph = hash12(cell + 11.1) * 6.2831;
  vec2 o = p_offset * (0.35 * h + 0.06 * vec2(sin(uTime * 0.37 + ph), cos(uTime * 0.29 + ph)));
  o += p_kick * 0.06 * uKick * normalize(h + 1e-4);
  vec2 uv = 0.5 + (f - 0.5) / p_zoom + o;
  // Minified n times with no mips: four taps a quarter-tile-texel apart keep
  // fine detail from sparkling at six or eight tiles.
  vec2 t = 0.35 * n / vec2(textureSize(uSrc, 0)) / p_zoom;
  vec3 c = texture(uSrc, mirrorUv(uv + vec2(-t.x, -t.y))).rgb + texture(uSrc, mirrorUv(uv + vec2(t.x, -t.y))).rgb +
           texture(uSrc, mirrorUv(uv + vec2(-t.x, t.y))).rgb + texture(uSrc, mirrorUv(uv + vec2(t.x, t.y))).rgb;
  return c * 0.25;
}
void main() {
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  float n0 = countFor(stepNow - 1.0), n1 = countFor(stepNow);
  float k = smoothstep(0.0, 0.25, phase);
  vec3 c = n0 == n1 || k >= 1.0 ? grid(n1) : mix(grid(n0), grid(n1), k);
  fragColor = vec4(c, 1.0);
}` }]
});
