// Mirror: folds the frame about one axis (horizontal or vertical) or two
// (quad), the symmetry that turned arbitrary motion into "designed" motion in
// four of LEXSAN's fifteen loops. The axis can tilt and drift, so the seam
// wanders through the picture and the reflection keeps finding new shapes;
// the bass leans it a little. Only the fold moves, never the whole frame.
VIZ_FX.register({
  id: 'mirror',
  name: 'Mirror',
  group: 'space',
  params: [
    { key: 'mode', label: 'Horizontal / vertical / quad', min: 0, max: 2, step: 1, default: 0 },
    { key: 'side', label: 'Source side', min: 0, max: 1, step: 1, default: 0 },
    { key: 'position', label: 'Axis position', min: -0.4, max: 0.4, default: 0 },
    { key: 'angle', label: 'Axis tilt', min: -45, max: 45, default: 0 },
    { key: 'drift', label: 'Axis drift', min: 0, max: 1, default: 0.25 },
    { key: 'swell', label: 'Bass lean', min: 0, max: 1, default: 0.3 }
  ],
  passes: [{ frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  float mode = floor(p_mode + 0.5);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  // The drift is two slow incommensurate sines, so the seam never retraces
  // a loop the room can learn.
  vec2 wander = vec2(sin(uTime * 0.21) + 0.4 * sin(uTime * 0.53 + 1.3),
                     cos(uTime * 0.17) + 0.4 * sin(uTime * 0.41 + 2.1)) / 1.4;
  vec2 c = vec2(0.5) + p_position + p_drift * 0.14 * wander;
  c += p_swell * 0.03 * bass * vec2(1.0, -1.0);
  float ang = radians(p_angle) + p_drift * 0.12 * sin(uTime * 0.11);
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 p = R * ((vUv - c) * vec2(aspect, 1.0));
  float s = p_side > 0.5 ? 1.0 : -1.0;
  if (mode != 1.0) p.x = s * abs(p.x);
  if (mode != 0.0) p.y = s * abs(p.y);
  vec2 uv = c + (transpose(R) * p) / vec2(aspect, 1.0);
  fragColor = vec4(texture(uSrc, mirrorUv(uv)).rgb, 1.0);
}` }]
});
