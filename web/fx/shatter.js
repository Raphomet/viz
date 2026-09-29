// Shatter: LEXSAN scene 6 (docs/research/2026-09-28-lexsan-takeaways.md) in
// image space, so it works over any scene. The frame is cut into an irregular
// triangle mesh (a jittered grid with a random diagonal per cell, which reads
// as Delaunay) that drifts slowly. On each bar a sweep crosses the frame, left
// to right and then back, and as it passes each facet tears: one corner flies
// out along the facet's own outward direction, so the facet's texture
// stretches into a long thin shard, then it collapses back onto the picture
// behind the front. The kick tears the facets nearest a point that moves on
// every beat, so each kick lands in one place (TASTE.md: confined, not global).
//
// Built as a real mesh (the runner's `mesh` pass option, harness/briefs/fx.md):
// one draw of 4096 triangles with displaced vertices, each carrying the texture
// coordinate of where it came from. A fragment-shader inversion would have had
// to search every facet that could reach a pixel, dozens per pixel at
// 3024x1890 for shards this long; the rasteriser does it for free.
VIZ_FX.register({
  id: 'shatter',
  name: 'Shatter',
  group: 'space',
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.75 },
    { key: 'stretch', label: 'Shard length', min: 0, max: 1, default: 0.5 },
    { key: 'facets', label: 'Facets', min: 4, max: 24, step: 1, default: 9 },
    { key: 'every', label: 'Sweep every n bars', min: 1, max: 4, step: 1, default: 1 },
    { key: 'kick', label: 'Kick tear', min: 0, max: 1, default: 0.5 },
    { key: 'ghost', label: 'Ghost behind', min: 0, max: 1, default: 0.3 },
    { key: 'edges', label: 'Edge lines', min: 0, max: 1, default: 0.3 },
    { key: 'drift', label: 'Mesh drift', min: 0, max: 1, default: 0.3 }
  ],
  passes: [
    // What shows through the gaps the shards leave: the picture, dimmed.
    { scale: 1 / 2, frag: `
void main() {
  fragColor = vec4(texture(uInput, vUv).rgb * mix(0.04, 0.8, p_ghost), 1.0);
}` },
    { mesh: 4096, vert: `
out vec3 vBary;
out float vW;
out float vApex;
out float vShade;
// A grid corner, jittered and drifting. Border corners slide only along the
// border so the mesh always covers the frame.
vec2 corner(float i, float j, float cols, float rows) {
  float h1 = hash12(vec2(i, j) + 11.3), h2 = hash12(vec2(j, i) * 1.7 + 3.1);
  float t = uTime * (0.08 + 0.5 * p_drift);
  vec2 jit = vec2(sin(t * (0.7 + 0.6 * h2) + h1 * 6.2832), cos(t * (0.6 + 0.5 * h1) + h2 * 6.2832));
  jit = jit * 0.34 + (vec2(h1, h2) - 0.5) * 0.2;
  if (i < 0.5 || i > cols - 0.5) jit.x = 0.0;
  if (j < 0.5 || j > rows - 0.5) jit.y = 0.0;
  return (vec2(i, j) + jit) / vec2(cols, rows);
}
float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main() {
  float aspect = uRes.x / uRes.y;
  float rows = floor(p_facets + 0.5);
  float cols = max(1.0, floor(rows * aspect + 0.5));
  int tri = gl_VertexID / 3, k = gl_VertexID - tri * 3;
  float cell = float(tri / 2);
  vBary = vec3(0.0); vW = 0.0; vApex = 0.0; vShade = 0.0; vUv = vec2(0.0);
  if (cell >= cols * rows) { gl_Position = vec4(-2.0, -2.0, 0.0, 1.0); return; }

  // The sweep: one per n bars, alternating direction.
  float every = max(1.0, floor(p_every + 0.5));
  float beats = uBeatIndex + uBeat;
  float sweepIdx = floor(beats / (4.0 * every));
  float s = (beats - sweepIdx * 4.0 * every) / (3.0 * every);
  float dir = mod(sweepIdx, 2.0) < 0.5 ? 1.0 : -1.0;

  // Draw order runs against the sweep, so facets the front has reached lie
  // over those still waiting for it.
  float col = floor(cell / rows), row = cell - col * rows;
  if (dir > 0.0) col = cols - 1.0 - col;
  float half_ = float(tri - (tri / 2) * 2);
  vec2 p00 = corner(col, row, cols, rows), p10 = corner(col + 1.0, row, cols, rows);
  vec2 p01 = corner(col, row + 1.0, cols, rows), p11 = corner(col + 1.0, row + 1.0, cols, rows);
  vec2 a, b, c;
  if (hash12(vec2(col, row) + 7.7) > 0.5) {
    if (half_ < 0.5) { a = p00; b = p10; c = p11; } else { a = p00; b = p11; c = p01; }
  } else {
    if (half_ < 0.5) { a = p00; b = p10; c = p01; } else { a = p10; b = p11; c = p01; }
  }
  vec2 A = vec2(aspect, 1.0);
  vec2 qa = a * A, qb = b * A, qc = c * A;
  vec2 g = (qa + qb + qc) / 3.0;
  float th = hash12(vec2(col, row) * 3.3 + half_ * 17.0);
  float th2 = hash12(vec2(row, col) * 5.1 + half_ * 9.0);

  // Activation: a bump that rises as the front arrives and falls behind it.
  // The front is ragged (per-facet offset, a slow bend) rather than a ruler.
  float W = 0.55;
  // Half eased: a fully eased front lingers offscreen at each end and rushes
  // the middle, which read as a flash rather than a sweep.
  float front = mix(-W, aspect + W, mix(clamp(s, 0.0, 1.0), ease(s), 0.5));
  float x = dir > 0.0 ? g.x : aspect - g.x;
  float d = front - x + (th - 0.5) * 0.22 + 0.08 * sin(g.y * 4.0 + sweepIdx * 1.9);
  float w = ease(smoothstep(-0.12, 0.08, d) * (1.0 - smoothstep(0.1, W, d)));
  w *= p_amount * step(s, 1.2);
  // Kick: facets near a point that moves each beat tear briefly.
  vec2 K = vec2(hash12(vec2(uBeatIndex, 1.3)) * aspect, 0.15 + 0.7 * hash12(vec2(uBeatIndex, 7.9)));
  float kd = length(g - K);
  w = max(w, uKick * p_kick * 0.85 * exp(-kd * kd / 0.045));

  // The facet flies along its outward direction (away from the frame's
  // centre, leaning with the sweep, turned a little at random). Its corner
  // furthest along that direction is the apex that stretches into a spike;
  // the other two barely move, so the facet becomes a long thin shard.
  vec2 out_ = normalize(g - vec2(0.5 * aspect, 0.5) + vec2(0.0001));
  vec2 fly = normalize(out_ + vec2(dir * 0.9, 0.0));
  float ang = (th - 0.5) * 1.4;
  fly = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * fly;
  float da = dot(qa - g, fly), db = dot(qb - g, fly), dc = dot(qc - g, fly);
  int apex = da >= db && da >= dc ? 0 : (db >= dc ? 1 : 2);
  vec2 q = k == 0 ? qa : (k == 1 ? qb : qc);
  vec2 uv = k == 0 ? a : (k == 1 ? b : c);
  float L = mix(0.12, 1.1, p_stretch) * (0.55 + 0.9 * th2);
  vec2 disp = normalize(q - g) * 0.05 + fly * (k == apex ? L : 0.04);
  q += disp * w;

  vUv = uv;
  vBary = vec3(k == 0 ? 1.0 : 0.0, k == 1 ? 1.0 : 0.0, k == 2 ? 1.0 : 0.0);
  vW = w;
  vApex = k == apex ? 1.0 : 0.0;
  vShade = dot(fly, normalize(vec2(-0.6, 0.8)));
  gl_Position = vec4((q / A) * 2.0 - 1.0, 0.0, 1.0);
}`, frag: `
in vec3 vBary;
in float vW;
in float vApex;
in float vShade;
void main() {
  vec3 col = texture(uInput, vUv).rgb;
  float w = clamp(vW, 0.0, 1.0);
  // Shards catch a light from the upper left by the way they point, and the
  // spike darkens toward its tip, so they read as facets, not a smear.
  col *= 1.0 + w * (0.28 * vShade - 0.3 * vApex);
  float e = min(vBary.x, min(vBary.y, vBary.z));
  float fw = fwidth(e);
  if (p_edges > 0.0) {
    float line = 1.0 - smoothstep(fw * 0.8, fw * 2.2, e);
    float ink = 1.0 - smoothstep(0.3, 0.6, luma(col));
    col = mix(col, vec3(ink), line * p_edges * 0.8 * smoothstep(0.0, 0.25, w));
  }
  // Edges soften only while a facet is torn: at rest neighbours share exact
  // edges, and half-covered pixels there would draw the mesh as dark seams.
  float a = mix(1.0, smoothstep(0.0, fw * 1.2, e), smoothstep(0.0, 0.1, w));
  fragColor = vec4(col, a);
}` }
  ]
});
