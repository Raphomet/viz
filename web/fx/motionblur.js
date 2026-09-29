// Motion blur: the Finish's first stage. Each frame keeps a fraction of the
// last finished frame (an exponential shutter), blended in linear light so a
// moving highlight leaves a light trail rather than a grey smear.
//
// Kicks must stay crisp (the brief: "never smear kicks into mush"). Two guards:
// where a whole region changes at once (a flash, a cut, a colour flip), pass 0
// sees it in a 1/16-scale comparison and the blur lets go there; and anything
// getting brighter passes through at half the blur, so onsets land on the
// frame and only their decay trails.
VIZ_FX.register({
  id: 'motionblur',
  name: 'Motion blur',
  group: 'time',
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.4 }
  ],
  history: 0,
  // Frames the harness must run before a capture for the trail to be right.
  settle: 16,
  passes: [
    // Region brightness now (r) and in the last output (g), a 16x16 box each.
    { scale: 1 / 16, frag: `
void main() {
  vec2 px = 1.0 / vec2(textureSize(uInput, 0));
  float cur = 0.0, prev = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    vec2 uv = vUv + (vec2(float(x), float(y)) * 4.0 - 6.0) * px;
    cur += luma(texture(uInput, uv).rgb);
    prev += luma(texture(uPrev, uv).rgb);
  }
  fragColor = vec4(cur / 16.0, prev / 16.0, 0.0, 1.0);
}` },
    { frag: `
void main() {
  vec3 cur = toLinear(texture(uInput, vUv).rgb);
  // The history is softened a little every frame, so the discrete copies a
  // fast edge leaves behind run together into a smear instead of a row of
  // ghosts (a real shutter integrates the motion; one sample a frame cannot).
  vec2 o = 1.5 * max(1.0, uRes.y / 720.0) / uRes;
  vec3 prev = toLinear(texture(uPrev, vUv).rgb) * 0.36 +
    (toLinear(texture(uPrev, vUv + vec2(o.x, 0.0)).rgb) + toLinear(texture(uPrev, vUv - vec2(o.x, 0.0)).rgb) +
     toLinear(texture(uPrev, vUv + vec2(0.0, o.y)).rgb) + toLinear(texture(uPrev, vUv - vec2(0.0, o.y)).rgb)) * 0.16;
  vec2 region = texture(uPass0, vUv).rg;
  float k = 0.62 * p_amount;
  k *= 1.0 - smoothstep(0.05, 0.2, abs(region.x - region.y));
  k *= mix(1.0, 0.5, smoothstep(0.0, 0.08, luma(cur) - luma(prev)));
  // Tuned at 60 fps; the same trail length in seconds at other rates.
  k = pow(k, uDt * 60.0);
  fragColor = vec4(toSrgb(mix(cur, prev, k)), 1.0);
}` }
  ]
});
