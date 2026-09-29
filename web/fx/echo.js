// Echo: copies of the frame from a few frames ago, laid under the new one with
// an offset, the #2 technique in the LEXSAN set (docs/research/2026-09-28-lexsan-set.md):
// "a frame-delay blend at ~50%, offset by a few pixels". RGB split lags the
// three channels by different amounts, so anything moving sheds a red, a green
// and a blue copy (the set's diamond build) while still parts stay whole.
//
// Built on `history` rather than uPrev: a true delay line gives discrete,
// evenly spaced copies (the set's look) where feedback gives a smear, and it
// forgets on its own so nothing can run away. The copies come from the
// half-size history and are soft; the frame itself stays full size.
//
// Light on black wants the copies to lighten (they glow behind the figure),
// but on a white poster a lighten trail is invisible, so Auto picks darken
// there from the frame's own brightness (a 4x4 probe).
VIZ_FX.register({
  id: 'echo',
  name: 'Echo',
  group: 'time',
  params: [
    { key: 'delay', label: 'Delay (frames)', min: 1, max: 8, step: 1, default: 4 },
    { key: 'copies', label: 'Copies', min: 1, max: 4, step: 1, default: 3 },
    { key: 'fade', label: 'Copy strength', min: 0.1, max: 1, default: 0.65 },
    { key: 'offset', label: 'Offset', min: 0, max: 1, default: 0.3 },
    { key: 'angle', label: 'Offset angle', min: 0, max: 1, default: 0.08 },
    { key: 'split', label: 'RGB split', min: 0, max: 1, default: 0 },
    { key: 'grey', label: 'Grey copies', min: 0, max: 1, default: 0 },
    { key: 'mode', label: 'Blend (auto, lighten, mix, darken)', min: 0, max: 3, step: 1, default: 0 },
    { key: 'kick', label: 'Kick spread', min: 0, max: 1, default: 0.5 }
  ],
  history: 32,
  passes: [{ frag: `
vec3 copyAt(vec2 uv, int lag, int chLag) {
  // Each channel of a copy may come from a different past frame.
  vec3 c;
  c.r = histFrame(uv, lag).r;
  c.g = histFrame(uv, lag + chLag).g;
  c.b = histFrame(uv, lag + 2 * chLag).b;
  return c;
}
void main() {
  int d = int(floor(p_delay + 0.5));
  int n = int(floor(p_copies + 0.5));
  int s = int(floor(p_split * 6.0 + 0.5));   // extra frames of lag per channel
  float aspect = uRes.x / uRes.y;
  float ang = p_angle * 6.28318530718;
  // The kick throws the copies further out, so each beat visibly spreads the
  // trail and it gathers back as the envelope decays; the frame itself holds.
  float reach = p_offset * 0.035 * (1.0 + p_kick * 1.5 * uKick);
  vec2 step_ = vec2(cos(ang), sin(ang)) * reach / vec2(aspect, 1.0);

  vec3 now = texture(uInput, vUv).rgb;
  if (s > 0) {
    // With the split on, the frame itself separates too: red is live, green
    // and blue trail behind it.
    now.g = histFrame(vUv, s).g;
    now.b = histFrame(vUv, 2 * s).b;
  }

  int mode = int(floor(p_mode + 0.5));
  if (mode == 0) {
    float m = 0.0;
    for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++)
      m += luma(texture(uInput, (vec2(float(x), float(y)) + 0.5) / 4.0).rgb);
    mode = m / 16.0 > 0.5 ? 3 : 1;
  }

  vec3 lighten = now, darken = now, over = now;
  float w = 1.0;
  for (int k = 1; k <= 4; k++) {
    if (k > n) break;
    w *= p_fade;
    vec3 c = copyAt(vUv - step_ * float(k), k * d, s);
    c = mix(c, vec3(luma(c)) * 0.85, p_grey);
    lighten = max(lighten, c * w);
    darken = min(darken, 1.0 - (1.0 - c) * w);
    over = mix(over, c, w * 0.5);
  }
  vec3 outc = mode == 1 ? lighten : mode == 2 ? over : darken;
  fragColor = vec4(outc, 1.0);
}` }]
});
