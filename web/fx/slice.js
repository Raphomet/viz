// Slice displacement: the frame cut into bands that slide sideways, with a
// new arrangement on each beat (or every 2 or 4). Each change glides over the
// first quarter of the beat instead of jumping, and only some bands move, so
// the beat is seen without the whole frame jerking (TASTE.md). A reference
// effect for uBeat / uBeatIndex.
VIZ_FX.register({
  id: 'slice',
  name: 'Slice',
  group: 'space',
  params: [
    { key: 'slices', label: 'Slices', min: 2, max: 48, step: 1, default: 14 },
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.3 },
    { key: 'every', label: 'Every n beats', min: 1, max: 8, step: 1, default: 1 },
    { key: 'share', label: 'Bands that move', min: 0, max: 1, default: 0.45 },
    { key: 'vertical', label: 'Vertical', min: 0, max: 1, step: 1, default: 0 }
  ],
  passes: [{ frag: `
float offsetFor(float band, float step_) {
  float moves = step(hash12(vec2(band, step_ * 1.37 + 5.1)), p_share);
  return moves * (hash12(vec2(band * 3.1 + 1.7, step_)) * 2.0 - 1.0);
}
void main() {
  bool vert = p_vertical > 0.5;
  float n = floor(p_slices + 0.5);
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  float along = vert ? vUv.x : vUv.y;
  float band = floor(along * n);
  float o = mix(offsetFor(band, stepNow - 1.0), offsetFor(band, stepNow), smoothstep(0.0, 0.25, phase * every));
  vec2 uv = vUv;
  if (vert) uv.y += o * p_amount * 0.5; else uv.x += o * p_amount * 0.5;
  fragColor = vec4(texture(uSrc, mirrorUv(uv)).rgb, 1.0);
}` }]
});
