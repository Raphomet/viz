// Droste: the frame recursed into itself, a smaller copy inset at the centre,
// a copy inside that, forever, with a continuous zoom that carries each copy
// out to become the frame. Rotate turns each copy against its parent; the
// zoom and the turn are one motion (zooming one level also turns one step),
// so the loop is seamless at any speed. Flow runs continuously and each beat
// adds an eased push inward, never a reversal (TASTE.md). Edge draws a
// hairline at each copy's border in ink that contrasts with the picture
// beneath, so the nesting reads on black and on paper.
VIZ_FX.register({
  id: 'droste',
  name: 'Droste',
  group: 'space',
  params: [
    { key: 'inset', label: 'Inset', min: 0.25, max: 0.85, default: 0.55 },
    { key: 'rotate', label: 'Rotate per level', min: -1, max: 1, default: 0.12 },
    { key: 'flow', label: 'Zoom flow', min: -1, max: 1, default: 0.25 },
    { key: 'push', label: 'Beat push', min: 0, max: 1, default: 0.35 },
    { key: 'edge', label: 'Edge line', min: 0, max: 1, default: 0.35 },
    { key: 'drift', label: 'Centre drift', min: 0, max: 1, default: 0.15 }
  ],
  passes: [{ frag: `
float easeOut(float x) { return 1.0 - pow(1.0 - x, 3.0); }
float boxN(vec2 q, float aspect) { return max(abs(q.x) / (0.5 * aspect), abs(q.y) / 0.5); }
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
void main() {
  float aspect = uRes.x / uRes.y;
  float s = p_inset;
  float turn = p_rotate * 0.7854;   // up to 45 degrees per level
  vec2 c = vec2(0.5) + p_drift * 0.07 * vec2(sin(uTime * 0.23), cos(uTime * 0.18));
  vec2 p = (vUv - c) * vec2(aspect, 1.0);
  float dir = p_flow < 0.0 ? -1.0 : 1.0;
  float lv = fract(uTime * p_flow * 0.15 + dir * p_push * 0.12 * (uBeatIndex + easeOut(uBeat)));
  // Zooming in by one level (scale s) while turning one step lands exactly on
  // the next copy, so fract() of the level count is seamless.
  float sc = pow(s, lv);   // q units per p unit, tracked for the edge line
  vec2 q = rot(turn * lv) * p * sc;
  for (int i = 0; i < 24; i++) {
    if (boxN(q, aspect) >= s) break;
    q = rot(-turn) * q / s; sc /= s;
  }
  for (int i = 0; i < 4; i++) {
    if (boxN(q, aspect) < 1.0) break;
    q = rot(turn) * q * s; sc *= s;
  }
  vec2 uv = c + q / vec2(aspect, 1.0);
  vec3 col = texture(uSrc, mirrorUv(uv)).rgb;
  if (p_edge > 0.0) {
    // The footprint of a pixel in box-norm units comes from the tracked
    // scale, not fwidth(): fwidth jumps across each copy's border and drew
    // the line as dashes (2026-09-28).
    float b = boxN(q, aspect);
    bool side = abs(q.x) / (0.5 * aspect) > abs(q.y) / 0.5;
    float fw = sc / uRes.y / (side ? 0.5 * aspect : 0.5) * max(1.0, uRes.y / 720.0);
    float line = 1.0 - smoothstep(fw * 1.0, fw * 2.0, 1.0 - b);
    float ink = 1.0 - smoothstep(0.3, 0.6, luma(col));
    col = mix(col, vec3(ink), line * p_edge * 0.85);
  }
  fragColor = vec4(col, 1.0);
}` }]
});
