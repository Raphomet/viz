// Stutter: the picture holds on the beat. Every few beats the dice are rolled
// (seeded by the beat, so the same beat always makes the same call); a hit
// freezes the frame for Hold beats, and with Steps above zero it is re-taken
// that many times a beat, so the scene drops to a stop-motion frame rate
// locked to the grid: a frame hold and repeat, the video cousin of a DJ's beat
// repeat. The release back to live lands on the grid too.
//
// The hold is uPrev (last frame's output kept as it is), so it can last as
// long as the performer likes. Re-taking on a step needs to know that a new
// step began since the last frame, which a stateless shader cannot tell from
// the beat phase without the tempo; so the step count is written into the
// output's alpha and read back from uPrev next frame. Nothing downstream reads
// alpha (the canvas copy forces it to 1), and k/64 survives 8-bit targets.
VIZ_FX.register({
  id: 'stutter',
  name: 'Stutter',
  group: 'time',
  params: [
    { key: 'every', label: 'Every n beats', min: 1, max: 8, step: 1, default: 2 },
    { key: 'hold', label: 'Hold (beats)', min: 0.25, max: 8, default: 1 },
    { key: 'chance', label: 'Probability', min: 0, max: 1, default: 0.6 },
    { key: 'steps', label: 'Steps a beat (0 = freeze)', min: 0, max: 8, step: 1, default: 4 },
    { key: 'offset', label: 'Offset beats', min: 0, max: 1, default: 0 }
  ],
  passes: [{ frag: `
void main() {
  vec3 live = texture(uInput, vUv).rgb;
  vec4 prev = texture(uPrev, vUv);
  float every = floor(p_every + 0.5);
  float pos = uBeatIndex + uBeat - p_offset;
  float group = floor(pos / every);
  float local = pos - group * every;
  bool holding = hash12(vec2(group * 1.618, 7.31)) < p_chance && local < min(p_hold, every);
  float steps = floor(p_steps + 0.5);
  // The step counter: a new code each step, cycling through 64.
  float code = mod(floor(pos * max(steps, 1.0)), 64.0);
  float prevCode = floor(prev.a * 64.0 + 0.5);
  vec3 outc = live;
  if (holding) {
    bool retake = steps > 0.5 && abs(prevCode - code) > 0.5;
    outc = retake ? live : prev.rgb;
  }
  fragColor = vec4(outc, code / 64.0);
}` }]
});
