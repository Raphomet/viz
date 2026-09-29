// Feedback: last frame's output, zoomed, turned and faded, laid under the new
// frame. A reference effect for uPrev (this effect's own output from the last
// frame; black on the first). The kick pushes the zoom, so each beat sends a
// ring of echoes outward rather than flashing the frame.
VIZ_FX.register({
  id: 'feedback',
  name: 'Feedback',
  group: 'time',
  params: [
    { key: 'zoom', label: 'Zoom', min: -0.05, max: 0.05, default: 0.012 },
    { key: 'rotate', label: 'Rotate', min: -1, max: 1, default: 0.15 },
    { key: 'persist', label: 'Persistence', min: 0, max: 0.98, default: 0.86 },
    { key: 'kick', label: 'Kick push', min: 0, max: 1, default: 0.5 },
    { key: 'under', label: 'Under / over', min: 0, max: 1, default: 0 }
  ],
  passes: [{ frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  vec3 now = texture(uInput, vUv).rgb;
  float z = 1.0 + p_zoom + p_kick * 0.03 * uKick;
  float ang = radians(p_rotate) * uDt * 60.0;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) / z;
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  vec2 uv = p / vec2(aspect, 1.0) + 0.5;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  // Persistence is per 60 Hz frame.
  vec3 echo = texture(uPrev, uv).rgb * pow(p_persist, uDt * 60.0) * inside;
  // Under: echoes show only where the new frame is darker (lighten), which
  // suits light on black. Over: echoes veil the new frame, for bright scenes.
  vec3 under = max(now, echo);
  vec3 over = mix(now, echo, 0.5 * p_persist);
  fragColor = vec4(mix(under, over, p_under), 1.0);
}` }]
});
