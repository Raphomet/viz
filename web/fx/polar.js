// Polar: three coordinate remaps. Tunnel is log-polar: angle across, log of
// the radius along, so the frame wraps into a tube that flows toward or away
// from the eye forever (a log scale makes each ring the same shape as the
// last). Rect to polar bends the frame's rows into rings (After Effects'
// Polar Coordinates); polar to rect unrolls the rings back into rows. Flow
// runs continuously, and each beat adds an eased push forward, so the music
// sets the travel speed without ever running it backward (TASTE.md: music
// changes the speed of motion, never jerks it).
VIZ_FX.register({
  id: 'polar',
  name: 'Polar',
  group: 'space',
  params: [
    { key: 'mode', label: 'Tunnel / to polar / to rect', min: 0, max: 2, step: 1, default: 0 },
    { key: 'flow', label: 'Zoom flow', min: -1, max: 1, default: 0.3 },
    { key: 'push', label: 'Beat push', min: 0, max: 1, default: 0.4 },
    { key: 'spin', label: 'Spin', min: -1, max: 1, default: 0.1 },
    { key: 'repeat', label: 'Repeats around', min: 1, max: 8, step: 1, default: 2 },
    { key: 'depth', label: 'Depth scale', min: 0.2, max: 2, default: 0.6 }
  ],
  passes: [{ frag: `
float easeOut(float x) { return 1.0 - pow(1.0 - x, 3.0); }
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float mode = floor(p_mode + 0.5);
  float rep = floor(p_repeat + 0.5);
  float dir = p_flow < 0.0 ? -1.0 : 1.0;
  float travel = uTime * p_flow * 0.25 + dir * p_push * 0.2 * (uBeatIndex + easeOut(uBeat));
  float turn = uTime * p_spin * 0.04;
  vec2 uv;
  float fade = 1.0;
  if (mode == 0.0) {
    uv = vec2(a / 6.28318530718 * rep + turn, p_depth * log(max(r, 1e-4)) + travel);
    // The centre is where every ring converges below a pixel; it fades to the
    // frame's average colour, which reads as distance on dark and on paper.
    fade = smoothstep(0.015, 0.16, r);
  } else if (mode == 1.0) {
    float rmax = 0.5 * sqrt(aspect * aspect + 1.0);
    uv = vec2(a / 6.28318530718 * rep + 0.5 + turn, r / rmax * (0.5 + 0.5 * p_depth) + travel * 0.5);
    fade = smoothstep(0.0, 0.05, r);
  } else {
    float ang = (vUv.x - 0.5) * 6.28318530718 / rep + turn * 6.28318530718;
    // Rows are radii from the centre out to the corners; flow scrolls them,
    // bouncing at both ends so the unrolled strip never tears.
    float rad = vUv.y * (0.5 + 0.5 * p_depth) + travel * 0.5;
    rad = (1.0 - abs(1.0 - mod(rad, 2.0))) * 0.5 * sqrt(aspect * aspect + 1.0);
    uv = 0.5 + vec2(cos(ang), sin(ang)) * rad / vec2(aspect, 1.0);
  }
  vec3 c = texture(uSrc, mirrorUv(uv)).rgb;
  if (fade < 1.0) {
    vec3 avg = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      vec2 q = vec2(float(i % 3), float(i / 3)) * 0.33 + 0.17;
      avg += texture(uSrc, q).rgb;
    }
    c = mix(avg / 9.0, c, fade);
  }
  fragColor = vec4(c, 1.0);
}` }]
});
