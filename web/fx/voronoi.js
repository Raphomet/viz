// Voronoi mosaic: the frame broken into drifting cells, each filled with the
// colour under its seed (Flat 1) or showing the image through (Flat 0), with
// optional edge lines in a tone that contrasts with each cell. Seeds wander on
// their own slow orbits; the bass widens the orbits. On each beat a ring
// travels out from a new point and thickens the edges it crosses, so the beat
// is a wave through part of the mosaic, not a flash of all of it.
VIZ_FX.register({
  id: 'voronoi',
  name: 'Voronoi',
  group: 'texture',
  params: [
    { key: 'cells', label: 'Cells', min: 4, max: 80, step: 1, default: 22 },
    { key: 'drift', label: 'Drift', min: 0, max: 2, default: 0.5 },
    { key: 'edges', label: 'Edges', min: 0, max: 1, default: 0.3 },
    { key: 'flat', label: 'Flat', min: 0, max: 1, default: 1 },
    { key: 'swell', label: 'Bass wander', min: 0, max: 1, default: 0.5 },
    { key: 'ring', label: 'Beat ring', min: 0, max: 1, default: 0.6 }
  ],
  passes: [
    { scale: 1 / 8, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = vec3(0.0);
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++)
    c += texture(uInput, vUv + (vec2(float(x), float(y)) - 1.5) * t * 2.0).rgb;
  fragColor = vec4(c / 16.0, 1.0);
}` },
    { frag: `
float amp;
vec2 seedAt(vec2 g) {
  vec2 h = vec2(hash12(g), hash12(g + 17.31));
  float t = uTime * p_drift;
  return g + 0.5 + amp * vec2(sin(t * (0.6 + h.x) + h.y * 6.283), cos(t * (0.5 + h.y) + h.x * 6.283));
}
void main() {
  float aspect = uRes.x / uRes.y;
  float n = floor(p_cells + 0.5);
  vec2 p = vUv * vec2(aspect, 1.0) * n;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  amp = 0.3 + 0.15 * p_swell * bass;
  vec2 g = floor(p), f = p - g;
  // Nearest seed, then distance to the nearest edge (Quilez's two-pass method).
  vec2 mg, mr; float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 r = seedAt(g + o) - p;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = o; }
  }
  float ed = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 o = mg + vec2(float(i), float(j));
    vec2 r = seedAt(g + o) - p;
    if (dot(mr - r, mr - r) > 1e-5) ed = min(ed, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  vec2 seedUv = (p + mr) / (vec2(aspect, 1.0) * n);
  vec3 cell = texture(uPass0, clamp(seedUv, 0.0, 1.0)).rgb;
  vec3 src = texture(uInput, vUv).rgb;
  vec3 c = mix(src, cell, p_flat);
  // The beat ring: out from a new point each beat, fading over the beat.
  vec2 rc = vec2(hash12(vec2(uBeatIndex, 2.7)), hash12(vec2(uBeatIndex, 8.1))) * vec2(aspect, 1.0);
  float rd = length(vUv * vec2(aspect, 1.0) - rc);
  float ring = p_ring * (1.0 - uBeat) * exp(-pow((rd - uBeat * 0.9) / 0.07, 2.0));
  float w = p_edges * 0.06 + ring * 0.09;
  float aa = n / uRes.y;
  float line = (1.0 - smoothstep(w - aa, w + aa, ed)) * step(0.001, w);
  vec3 lc = luma(clamp(cell, 0.0, 1.0)) > 0.4 ? vec3(0.07, 0.07, 0.09) : vec3(0.93, 0.92, 0.88);
  fragColor = vec4(mix(c, lc, line * clamp(p_edges * 2.0 + ring, 0.0, 1.0)), 1.0);
}` }
  ]
});
