// Fisheye: a radial lens warp. Positive is barrel (the centre bulges toward
// the eye, the edges crowd in), negative is pincushion (the centre recedes,
// the frame's mirrored surround creeps in at the corners). The bass breathes
// the strength and the kick adds a brief extra bulge; a touch of lateral
// colour fringing, strongest at the rim, sells it as glass rather than a
// warp. The breath is held to a few percent of the lens so it reads as a
// lens breathing, not the frame punching (TASTE.md).
VIZ_FX.register({
  id: 'fisheye',
  name: 'Fisheye',
  group: 'space',
  params: [
    { key: 'amount', label: 'Barrel / pincushion', min: -1, max: 1, default: 0.55 },
    { key: 'breathe', label: 'Bass breath', min: 0, max: 1, default: 0.5 },
    { key: 'kick', label: 'Kick bulge', min: 0, max: 1, default: 0.3 },
    { key: 'zoom', label: 'Zoom', min: 0.6, max: 1.6, default: 1 },
    { key: 'fringe', label: 'Colour fringe', min: 0, max: 1, default: 0.3 },
    { key: 'drift', label: 'Centre drift', min: 0, max: 1, default: 0.2 }
  ],
  passes: [{ frag: `
vec2 lens(vec2 q, float e) {
  float r = length(q);
  return r > 0.0 ? q * pow(r, e - 1.0) : q;
}
void main() {
  float aspect = uRes.x / uRes.y;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  vec2 c = vec2(0.5) + p_drift * 0.08 * vec2(sin(uTime * 0.19), cos(uTime * 0.15));
  float R = 0.5 * sqrt(aspect * aspect + 1.0);   // centre-to-corner, in height units
  vec2 q = (vUv - c) * vec2(aspect, 1.0) / R;
  float k = p_amount * (1.0 + p_breathe * 0.35 * bass) + sign(p_amount) * p_kick * 0.18 * uKick;
  // An exponent on the radius keeps the centre and the rim fixed (r = 0 and
  // r = 1 map to themselves) while the strength moves everything between,
  // so the breath never slides the frame's edges around.
  float e = exp(k * 0.9);
  float spread = p_fringe * 0.06 * abs(k);
  vec2 qr = lens(q, e * (1.0 + spread)), qg = lens(q, e), qb = lens(q, e * (1.0 - spread));
  vec2 s = R / vec2(aspect, 1.0) / p_zoom;
  vec3 col = vec3(texture(uSrc, mirrorUv(c + qr * s)).r,
                  texture(uSrc, mirrorUv(c + qg * s)).g,
                  texture(uSrc, mirrorUv(c + qb * s)).b);
  fragColor = vec4(col, 1.0);
}` }]
});
