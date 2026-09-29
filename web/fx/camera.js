// Camera: a virtual camera over any 2D scene, so a stationary picture feels
// filmed (LEXSAN 3, 4 and 10 in docs/research/2026-09-28-lexsan-takeaways.md).
// It pans, orbits (turns about a drifting centre), dollies and now and then
// banks, each on its own eased path: the paths are keyframes joined by
// ease-in-out, so moves start and settle like a camera operator's rather than
// wandering at a constant rate. Tilt adds a keystone, as if the picture were a
// plane receding from the lens.
//
// Edges never show: the four screen corners are mapped through the whole
// transform, the zoom is raised to whatever the turn and the keystone need,
// and the pan is confined to the margin that is left. The zoom never drops
// below 1.1.
//
// Music: the path clock runs on the beat as well as on time, so the camera
// moves faster when the track is dense and drifts in the silence; each bar
// eases in a small push that releases over the rest of the bar (TASTE.md:
// held to a few percent and eased, never a zoom punch). Drop moves more:
// wider, faster, with more banks.
VIZ_FX.register({
  id: 'camera',
  name: 'Camera',
  group: 'space',
  params: [
    { key: 'move', label: 'Move', min: 0, max: 1, default: 0.55 },
    { key: 'speed', label: 'Speed', min: 0, max: 1, default: 0.4 },
    { key: 'zoom', label: 'Zoom', min: 1.1, max: 2, default: 1.2 },
    { key: 'orbit', label: 'Orbit', min: 0, max: 1, default: 0.4 },
    { key: 'bank', label: 'Banks', min: 0, max: 1, default: 0.35 },
    { key: 'tilt', label: 'Tilt', min: 0, max: 1, default: 0.25 },
    { key: 'push', label: 'Bar push', min: 0, max: 1, default: 0.35 },
    { key: 'drop', label: 'Drop', min: 0, max: 1, default: 0 }
  ],
  passes: [{ frag: `
float ease(float x) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }
// An eased keyframe path in [-1, 1]: a new target each unit of t.
float path(float t, float seed) {
  float k = floor(t);
  return mix(hash12(vec2(k, seed)), hash12(vec2(k + 1.0, seed)), ease(fract(t))) * 2.0 - 1.0;
}
// Two paths at unrelated rates, so a long move and a short one overlap and
// no two stretches repeat.
float path2(float t, float seed) { return 0.7 * path(t, seed) + 0.3 * path(t * 2.3 + 17.0, seed + 51.0); }
mat2 rot(float a) { return mat2(cos(a), sin(a), -sin(a), cos(a)); }
vec2 keystone(vec2 q, vec2 half_, vec2 n, float k) {
  return q / (1.0 - k * dot(q / half_, n));
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 half_ = vec2(0.5 * aspect, 0.5);
  float drop = p_drop;
  float beats = uBeatIndex + uBeat;
  // Seconds and beats both advance the path clock (one keyframe every few
  // seconds at the default speed).
  float spd = mix(0.04, 0.3, p_speed) * (1.0 + 0.8 * drop);
  float t = uTime * spd * 0.6 + beats * spd * 0.2;
  float mv = p_move * (1.0 + 0.6 * drop);

  // Orbit and banks: the turn. A bank is an occasional deeper roll held for
  // one slow keyframe, eased in and out.
  float ang = p_orbit * (0.07 + 0.05 * drop) * path2(t * 0.7, 3.0);
  float bk = floor(t * 0.5);
  float bf = fract(t * 0.5);
  float hb = hash12(vec2(bk, 91.0));
  float banks = step(hb, 0.3 + 0.4 * drop) * (hash12(vec2(bk, 37.0)) < 0.5 ? -1.0 : 1.0);
  ang += p_bank * 0.1 * (1.0 + 0.5 * drop) * banks * pow(sin(3.14159 * bf), 2.0);

  // Tilt: a keystone whose axis wanders, so the plane recedes toward one side
  // and then another.
  float na = 1.5708 + 1.2 * path(t * 0.35, 7.0);
  vec2 n = vec2(cos(na), sin(na));
  float kk = p_tilt * 0.3 * (0.6 + 0.4 * path(t * 0.5, 11.0));

  // Dolly and the bar push.
  float z = p_zoom * (1.0 + mv * 0.18 * (0.5 + 0.5 * path2(t * 0.8, 5.0)));
  float ph = fract(beats / 4.0);
  float env = ph < 0.25 ? 1.0 - pow(1.0 - ph / 0.25, 3.0) : 1.0 - smoothstep(0.25, 1.0, ph);
  z *= 1.0 + p_push * (0.035 + 0.03 * drop) * env;

  // Map the four corners; the zoom must cover their furthest reach.
  mat2 R = rot(ang);
  vec2 c0 = R * keystone(vec2(-half_.x, -half_.y), half_, n, kk);
  vec2 c1 = R * keystone(vec2(half_.x, -half_.y), half_, n, kk);
  vec2 c2 = R * keystone(vec2(-half_.x, half_.y), half_, n, kk);
  vec2 c3 = R * keystone(vec2(half_.x, half_.y), half_, n, kk);
  vec2 lo = min(min(c0, c1), min(c2, c3)), hi = max(max(c0, c1), max(c2, c3));
  float need = max(max(-lo.x, hi.x) / half_.x, max(-lo.y, hi.y) / half_.y);
  z = max(max(z, 1.1), need * 1.004);
  // Pan inside whatever margin is left, on eased paths.
  vec2 cmin = -half_ - lo / z, cmax = half_ - hi / z;
  vec2 pan = vec2(path2(t, 1.0), path2(t * 0.9, 2.0)) * (0.3 + 0.7 * min(mv, 1.0));
  vec2 c = mix(cmin, cmax, 0.5 + 0.5 * pan);

  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 s = c + R * keystone(q, half_, n, kk) / z;
  vec2 uv = s / vec2(aspect, 1.0) + 0.5;
  // Four taps over the pixel's footprint: the far side of the keystone is
  // minified, and a single bilinear tap there shimmers as it moves.
  vec2 dx = dFdx(uv) * 0.25, dy = dFdy(uv) * 0.25;
  vec3 col = texture(uSrc, clamp(uv + dx + dy, 0.0, 1.0)).rgb + texture(uSrc, clamp(uv - dx + dy, 0.0, 1.0)).rgb
           + texture(uSrc, clamp(uv + dx - dy, 0.0, 1.0)).rgb + texture(uSrc, clamp(uv - dx - dy, 0.0, 1.0)).rgb;
  fragColor = vec4(col * 0.25, 1.0);
}` }]
});
