// Impasto — a Van Gogh wheat field painted in thick, directional oil strokes:
// a swirling sky, blue hills, cypresses like dark flames, wheat bending in
// the wind, and crows.
//
// Two WebGL2 passes, no feedback buffer:
//   1. The "motif" at quarter resolution: what the painter is looking at.
//      Per point it stores the local colour and the direction a brush would
//      follow there (the sky's stream function, the hills' slope, the flame
//      of a cypress, the lean of the wheat in the wind), plus which layer
//      (sky, far, field) the point belongs to.
//   2. The paint. Three stroke grids, one per layer, each anchored to its own
//      layer so the strokes travel with it (sky 0.1x, far 0.35x, the field in
//      true ground-plane perspective, so near wheat slides faster and strokes
//      shrink toward the horizon). Every grid cell holds two strokes; each
//      stroke reads the motif at its centre for its colour and direction and
//      is drawn as a capsule with ragged bristle ends, grooves along its
//      length and a ridge of paint where the brush lifted. The two topmost
//      strokes at a pixel are composited, the top one lit from its own height
//      field (lit edge, shadowed edge, a matte sheen) and casting a short
//      shadow on whatever lies beneath. Gaps show a thin underpainting on
//      canvas. Crows are painted on top as black two-stroke marks.
//
// The strokes never re-sample a moving picture beneath a fixed grid (which
// would shimmer): each stroke is rigid and anchored; only its colour and
// angle change as the wind and the sky move through it, so the wheat visibly
// bends stroke by stroke and the sky's swirls turn.
//
// Music:
//   kick   a gust flattens one patch of wheat: the strokes there lean hard and
//          turn pale (the undersides of the ears), then stand back up. The
//          patch moves round the field by the golden ratio each beat.
//   snare  a flock of crows lifts out of the wheat and flies off into the sky.
//   bass   the wind: how far the wheat waves bend, how fast they roll, the
//          cypresses' sway, and how fast the sky's bands wind into its swirls.
//   hats   wet glints: a few strokes catch the light on their ridges.
//   drop   the sun comes out (a disc of chrome yellow in rings of strokes),
//          the colour deepens, the light rakes harder so the paint stands up,
//          the travel quickens and the crows come in flocks; the breakdown
//          goes overcast and still.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  // Ground-plane perspective for the field: a point d units below the horizon
  // is drawn at scale (d + D0N) / D1N. d0 keeps the far strokes from going
  // sub-pixel (aliasing shimmer as they slide).
  const D0N = 90.0, D1N = 200.0;

  const COMMON = `
precision highp float;
uniform vec2 res;
uniform float unitPx;
uniform float Hy;       // horizon, virtual units (y up, origin at centre)
uniform vec3 pan;       // sky, far, field
const float d0 = ${D0N.toFixed(1)};
const float D1 = ${D1N.toFixed(1)};

float h11(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
vec2 h22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fb(vec2 p) {
  float s = 0.5 * n2(p); p = p * 2.03 + 1.7;
  s += 0.25 * n2(p); p = p * 2.01 + 3.1;
  s += 0.125 * n2(p);
  return s / 0.875;
}
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
float fb1(float x) { return (0.5 * n1(x) + 0.25 * n1(x * 2.1 + 1.3) + 0.125 * n1(x * 4.3 + 2.9)) / 0.875; }

// Field ground coordinates from the screen, and back.
vec2 toField(vec2 q) {
  float d = Hy - q.y;
  float s = (d + d0) / D1;
  return vec2(q.x / s + pan.z, D1 * log(max(d + d0, 1.0) / d0));
}
vec2 fromField(vec2 Q) {
  float d = d0 * (exp(Q.y / D1) - 1.0);
  float s = (d + d0) / D1;
  return vec2((Q.x - pan.z) * s, Hy - d);
}

// Cypress k (in far-layer x cells of 380): x, base height, width, and
// whether it exists (w < 0 means no tree).
vec4 cypress(float cell) {
  float a = h11(cell * 1.37 + 4.1), b = h11(cell * 2.71 + 9.3), c = h11(cell * 0.93 + 1.9);
  if (a < 0.4) return vec4(0.0, 0.0, 0.0, -1.0);
  return vec4(cell * 380.0 + 60.0 + 260.0 * b, 170.0 + 120.0 * c, 0.0, 26.0 + 16.0 * h11(cell + 7.7));
}
`;

  // ---------------------------------------------------------------- motif
  const MOTIF = `#version 300 es
${COMMON}
uniform float T;        // wind clock
uniform float SW;       // swirl clock
uniform float tw;       // plain time
uniform float windAmp;
uniform float sat;      // colour depth
uniform float cloudK;   // overcast
uniform vec3 sun;       // x, y, radius (screen, virtual)
uniform float sunK;
uniform vec4 gust[3];   // field Q x, y, amp, radius in Q
uniform vec3 pal[16];
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;

float psiAt(vec2 p) {
  float psi = 0.45 * p.y;
  float c0 = floor(p.x / 360.0);
  for (int k = -1; k <= 1; k++) {
    float cell = c0 + float(k);
    vec2 h = h22(vec2(cell, 3.7));
    float h3 = h11(cell * 5.3 + 0.7);
    vec2 c = vec2(cell * 360.0 + 180.0 + 110.0 * (h.x - 0.5), Hy + 150.0 + 100.0 * h.y);
    float r = 60.0 + 55.0 * h3;
    float S = (h.x > 0.5 ? 1.0 : -1.0) * (45.0 + 40.0 * h3);
    vec2 v = p - c;
    psi += S * exp(-dot(v, v) / (r * r));
  }
  return psi;
}

vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, sat), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize0());
  vec2 q = (uv - 0.5) * res / unitPx;
  vec3 col; vec2 dir; float lay; float lenF = 1.0;
  float d = Hy - q.y;
  if (d > 0.0) {
    // ---- the wheat field
    vec2 Q = toField(q);
    float n = fb(Q * 0.012);
    float wave = sin(0.026 * Q.x + 0.012 * Q.y + 3.0 * n - T * 1.6);
    float wave2 = sin(0.05 * Q.x - 0.02 * Q.y + 2.0 * n - T * 2.3 + 1.3);
    float w = 0.7 * wave + 0.3 * wave2;
    float lean = 0.22 + windAmp * (0.2 + 0.32 * w) + 0.25 * (n - 0.5);
    float g = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 dv = (Q - gust[i].xy) / max(gust[i].w, 1.0);
      dv.x *= 0.8;
      g += gust[i].z * exp(-dot(dv, dv) * 1.6);
    }
    g = min(g, 1.2);
    lean += 1.3 * g;
    dir = vec2(sin(lean), cos(lean));
    float t = 0.5 + 0.5 * w * min(windAmp * 1.3, 1.0);
    col = mix(pal[11], pal[12], smoothstep(0.05, 0.95, 0.3 + 0.5 * t + 0.4 * (n - 0.5)));
    float gr = smoothstep(0.6, 0.72, fb(Q * 0.005 + 7.3));
    col = mix(col, pal[14], gr * 0.75);
    // A furrow of darker earth now and then, running into the distance.
    float fur = smoothstep(0.93, 0.99, n1(Q.x * 0.012 + 40.0));
    col = mix(col, pal[11] * 0.7, fur * 0.6);
    float pn = n2(Q * 0.08 + 3.1);
    col = mix(col, pal[15], smoothstep(0.8, 0.86, pn) * smoothstep(15.0, 70.0, d));
    // Aerial perspective: the far field pales toward the hills.
    col = mix(col, mix(pal[7], pal[12], 0.55), smoothstep(45.0, 0.0, d) * 0.4);
    col = mix(col, pal[13] * 1.08, clamp(g * 1.2, 0.0, 1.0));
    lenF = 1.0 + 0.35 * g;
    lay = 1.0;
  } else {
    float xf = q.x + pan.y;
    float y = q.y;
    // ---- cypresses
    float cyp = 0.0; vec2 cdir = vec2(0.0, 1.0); float side = 0.0; float ct = 0.0;
    float cc = floor(xf / 380.0);
    for (int k = -1; k <= 1; k++) {
      vec4 C = cypress(cc + float(k));
      if (C.w < 0.0) continue;
      float t = (y - (Hy - 4.0)) / C.y;
      if (t < 0.0 || t > 1.0) continue;
      float sway = windAmp * 16.0 * t * t * sin(T * 0.8 + cc + float(k)) + 4.0 * t * sin(tw * 0.7 + float(k));
      float dx = xf - C.x - sway;
      float wdt = C.w * pow(sin(3.1416 * pow(t, 0.62)), 0.85);
      wdt *= 0.8 + 0.4 * n2(vec2(t * 10.0, sign(dx) * 3.0 + cc + float(k)));
      if (abs(dx) < wdt) {
        cyp = 1.0; side = dx / wdt; ct = t;
        float a = 1.5708 + 0.8 * sin(t * 13.0 + side * 1.8 + T * 0.3);
        cdir = vec2(cos(a), sin(a));
      }
    }
    float bushTop = Hy + 8.0 + 20.0 * fb(vec2(xf * 0.018, 1.3)) * smoothstep(0.3, 0.6, n1(xf * 0.004 + 2.0));
    float hill = Hy + 26.0 + 80.0 * fb1(xf * 0.0032) + 10.0 * n1(xf * 0.02);
    if (cyp > 0.5) {
      float lit = smoothstep(0.2, -0.8, side) * (0.5 + 0.5 * n2(vec2(ct * 20.0, side * 3.0)));
      col = mix(pal[9], pal[10], lit * 0.7);
      col *= 0.85 + 0.3 * n2(vec2(ct * 30.0, side * 5.0));
      dir = cdir; lenF = 0.8;
      lay = 0.5;
    } else if (y < bushTop) {
      float b = fb(vec2(xf * 0.05, y * 0.08));
      col = mix(pal[8] * 0.75, pal[8] * 1.2, b);
      float a = 6.2832 * fb(vec2(xf * 0.03, y * 0.05) + 5.0);
      dir = vec2(cos(a), sin(a)); lenF = 0.6;
      lay = 0.5;
    } else if (y < hill) {
      float slope = (80.0 * (fb1((xf + 2.0) * 0.0032) - fb1((xf - 2.0) * 0.0032))) / 4.0;
      float bands = 0.5 + 0.5 * sin((hill - y) * 0.12 + 3.0 * n1(xf * 0.01));
      col = mix(pal[6], pal[7], bands * 0.8 * smoothstep(0.0, 30.0, hill - y) + 0.2);
      col = mix(col, pal[1], 0.2 * smoothstep(20.0, 0.0, hill - y));
      dir = normalize(vec2(1.0, slope * (0.6 + 0.4 * bands)));
      lay = 0.5;
    } else {
      // ---- the sky: strokes follow the stream function
      vec2 p = vec2(q.x + pan.x, y);
      float psi = psiAt(p);
      float gx = psiAt(p + vec2(2.0, 0.0)) - psiAt(p - vec2(2.0, 0.0));
      float gy = psiAt(p + vec2(0.0, 2.0)) - psiAt(p - vec2(0.0, 2.0));
      vec2 fl = vec2(gy, -gx);
      dir = length(fl) > 1e-4 ? normalize(fl) : vec2(1.0, 0.0);
      float hgt = clamp((y - Hy) / 360.0, 0.0, 1.0);
      col = mix(pal[1], pal[0], pow(hgt, 0.7));
      // Bands along the streamlines winding in toward the swirls' eyes.
      float band = 0.5 + 0.5 * sin(psi * 0.13 - SW * 2.2);
      col = mix(col, pal[2], band * 0.5);
      // Clouds, turned by the swirls.
      vec2 pr = p;
      float c0 = floor(p.x / 360.0);
      for (int k = -1; k <= 1; k++) {
        float cell = c0 + float(k);
        vec2 h = h22(vec2(cell, 3.7));
        vec2 c = vec2(cell * 360.0 + 180.0 + 110.0 * (h.x - 0.5), Hy + 150.0 + 100.0 * h.y);
        vec2 v = p - c;
        float r = 60.0 + 55.0 * h11(cell * 5.3 + 0.7);
        float a = (h.x > 0.5 ? -1.0 : 1.0) * SW * 1.6 * exp(-dot(v, v) / (r * r * 2.0));
        float cs = cos(a), sn = sin(a);
        pr += (mat2(cs, sn, -sn, cs) * v) - v;
      }
      float cl = fb(pr * vec2(0.008, 0.014) + vec2(SW * 0.2, 0.0));
      float cloud = smoothstep(0.62 - 0.2 * cloudK, 0.8 - 0.15 * cloudK, cl);
      col = mix(col, pal[3], cloud * 0.9);
      col = mix(col, pal[3] * vec3(0.78, 0.8, 0.84), cloudK * 0.35 * smoothstep(0.3, 0.7, cl));
      // The sun: a disc in rings of strokes.
      vec2 sv = q - sun.xy;
      float r = length(sv);
      float R = sun.z;
      float halo = sunK * smoothstep(3.4 * R, 1.1 * R, r);
      float rings = 0.5 + 0.5 * cos((r - R) * 0.22 - tw * 0.9);
      col = mix(col, mix(pal[5], pal[4], rings * 0.55), halo * 0.92);
      float disc = sunK * smoothstep(R + 1.5, R - 1.5, r);
      col = mix(col, pal[4] * (1.0 + 0.1 * rings), disc);
      vec2 tang = r > 1e-3 ? vec2(-sv.y, sv.x) / r : vec2(1.0, 0.0);
      if (dot(tang, dir) < 0.0) tang = -tang;
      dir = normalize(mix(dir, tang, clamp(halo * 1.4, 0.0, 1.0)) + 1e-5);
      lenF = mix(1.15, 0.8, halo);
      lay = 0.0;
    }
  }
  o0 = vec4(dir * 0.5 + 0.5, lay, lenF * 0.5);
  o1 = vec4(grade(col), 1.0);
}`.replace('vec2(textureSize0())', 'mres');

  // ---------------------------------------------------------------- paint
  const PAINT = `#version 300 es
${COMMON}
uniform sampler2D motifA;
uniform sampler2D motifB;
uniform vec3 cellS;     // cell size per layer (sky, far, field Q)
uniform float reveal;
uniform float relief;   // impasto height
uniform float key;      // raking light
uniform float amb;
uniform float hatSeed;
uniform float hatK;
uniform vec3 canvasC;
uniform vec3 crowC;
uniform vec4 crow[24];  // x, y, size, flap phase
uniform float crowA[24];
out vec4 outColor;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
vec4 hash4(ivec2 c, int k) {
  uint a = pcg(uint(c.x + 1048576) + pcg(uint(c.y + 1048576) + pcg(uint(k))));
  uint b = pcg(a ^ 0x9e3779b9u);
  return vec4(float(a & 0xffffu), float(a >> 16u), float(b & 0xffffu), float(b >> 16u)) / 65535.0;
}

// One brush stroke in its own frame: capsule with ragged bristle ends,
// grooves along its length and a ridge where the brush lifted.
float strokeH(vec2 d, vec2 dir, float L, float W, float curv, float seed, out float m) {
  float u = dot(d, dir) / L;
  float v = dot(d, vec2(-dir.y, dir.x)) / W;
  v -= curv * (u * u - 0.3);
  float br = h11(floor((v + 1.0) * 3.5) + seed * 17.0);
  float u0 = -1.0 + 0.4 * br;
  float tp = 0.32;
  float e = max(max(u0 + tp - u, u - (1.0 - tp)), 0.0) / tp;
  float r = sqrt(e * e + v * v);
  m = 1.0 - smoothstep(0.8, 1.0, r);
  float prof = sqrt(max(1.0 - v * v, 0.0));
  float groove = 0.5 + 0.5 * sin(v * 10.0 + seed * 40.0);
  float ridge = exp(-pow((u - 0.72) / 0.13, 2.0));
  return (prof * (0.45 + 0.3 * smoothstep(-1.0, 0.6, u)) + 0.2 * groove * prof + 0.5 * ridge * prof) * m;
}

vec2 toScreen(int lay, vec2 c) {
  if (lay == 0) return vec2(c.x - pan.x, c.y);
  if (lay == 1) return vec2(c.x - pan.y, c.y);
  return fromField(c);
}
vec2 uvOf(vec2 s) { return (s * unitPx + 0.5 * res) / res; }

// The two topmost strokes at this pixel.
float o1 = -1.0, o2 = -1.0, m1 = 0.0, m2 = 0.0;
vec2 c1, c2, P1, P2, dir1, dir2;
vec4 g1, g2;   // L, W, curv, seed
int lay1 = 0, lay2 = 0;

void layerStrokes(int lay, vec2 P, float cs) {
  vec2 cellF = floor(P / cs);
  float code = float(lay) * 0.5;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++)
  for (int k = 0; k < 2; k++) {
    ivec2 cid = ivec2(cellF) + ivec2(i, j);
    vec4 h = hash4(cid + ivec2(lay * 7919, 0), k);
    if (h.w > reveal) continue;
    vec2 c = (vec2(cid) + h.xy) * cs;
    vec2 d = P - c;
    if (dot(d, d) > 4.8 * cs * cs) continue;
    vec4 A = texture(motifA, uvOf(toScreen(lay, c)));
    if (abs(A.b - code) > 0.26) continue;
    vec2 dir = A.xy * 2.0 - 1.0;
    float dl = length(dir);
    dir = dl > 1e-3 ? dir / dl : vec2(1.0, 0.0);
    float ja = (h.z - 0.5) * 0.35;
    dir = vec2(dir.x * cos(ja) - dir.y * sin(ja), dir.x * sin(ja) + dir.y * cos(ja));
    float L = cs * (0.8 + 0.45 * h.z) * A.a * 2.0;
    float W = cs * (0.24 + 0.1 * fract(h.w * 7.3));
    float curv = (fract(h.x * 13.7) - 0.5) * 0.5;
    float m;
    strokeH(d, dir, L, W, curv, h.w, m);
    if (m < 0.03) continue;
    float o = float(lay) + 0.9 * fract(h.y * 5.1 + h.z);
    if (o > o1) {
      o2 = o1; m2 = m1; c2 = c1; P2 = P1; dir2 = dir1; g2 = g1; lay2 = lay1;
      o1 = o; m1 = m; c1 = c; P1 = P; dir1 = dir; g1 = vec4(L, W, curv, h.w); lay1 = lay;
    } else if (o > o2) {
      o2 = o; m2 = m; c2 = c; P2 = P; dir2 = dir; g2 = vec4(L, W, curv, h.w); lay2 = lay;
    }
  }
}

vec3 strokeCol(int lay, vec2 c, vec2 P, vec2 dir, vec4 g) {
  vec2 uvc = uvOf(toScreen(lay, c));
  vec3 base = texture(motifB, uvc).rgb;
  // Streaks of a neighbouring colour in some bristles, the way the brush
  // carries two paints at once.
  float v = dot(P - c, vec2(-dir.y, dir.x)) / g.y;
  vec2 off = vec2(-dir.y, dir.x) * g.x * 1.6 * (fract(g.w * 31.0) > 0.5 ? 1.0 : -1.0);
  vec3 nb = texture(motifB, uvOf(toScreen(lay, c + off))).rgb;
  float st = step(0.6, h11(floor(v * 2.6 + 3.0) + g.w * 91.0));
  base = mix(base, nb, st * 0.7);
  base *= 0.9 + 0.2 * fract(g.w * 57.1);
  return base;
}

// Crow: two tapered wings from the body, flapping.
float seg(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}
float crowR(vec2 p, vec4 C) {
  vec2 d = (p - C.xy) / C.z;
  if (dot(d, d) > 2.6) return 9.0;
  float fl = sin(C.w);
  vec2 dd = vec2(abs(d.x), d.y);
  vec2 el = vec2(0.45, 0.2 + 0.28 * fl);
  vec2 tip = vec2(1.0, 0.02 + 0.62 * fl);
  float t1, t2;
  float s1 = seg(dd, vec2(0.0), el, t1) / mix(0.2, 0.12, t1);
  float s2 = seg(dd, el, tip, t2) / mix(0.12, 0.05, t2);
  float bd = length((d - vec2(0.0, -0.05)) / vec2(0.13, 0.2));
  float tl = length((d - vec2(0.0, -0.27)) / vec2(0.08, 0.14));
  return min(min(s1, s2), min(bd, tl));
}

void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec2 uv = gl_FragCoord.xy / res;
  float d = Hy - q.y;
  vec2 Pq = toField(q);
  if (d > -14.0 && d > -d0 + 5.0) layerStrokes(2, Pq, cellS.z);
  if (d < 14.0) {
    vec2 Pf = vec2(q.x + pan.y, q.y);
    bool far = q.y < Hy + 128.0;
    if (!far) {
      float cc = floor(Pf.x / 380.0);
      for (int k = -1; k <= 1; k++) {
        vec4 C = cypress(cc + float(k));
        if (C.w >= 0.0 && abs(Pf.x - C.x) < C.w + 40.0 && q.y < Hy + C.y + 20.0) far = true;
      }
    }
    if (far) layerStrokes(1, Pf, cellS.y);
    layerStrokes(0, vec2(q.x + pan.x, q.y), cellS.x);
  }

  vec3 L = normalize(vec3(-0.55, 0.5, 0.67));
  // Underpainting: a thin wash of the motif over primed canvas.
  vec3 motif = texture(motifB, uv).rgb;
  float weave = 0.5 + 0.25 * (sin(gl_FragCoord.x * 1.7) + sin(gl_FragCoord.y * 1.7));
  vec3 col = mix(canvasC * (0.92 + 0.08 * weave), motif * 0.82, 0.62 * reveal);

  float shadow = 0.0;
  if (o1 >= 0.0) {
    float hm;
    float h0 = strokeH(P1 - c1, dir1, g1.x, g1.y, g1.z, g1.w, hm);
    float e = 0.1 * g1.y;
    float hx = strokeH(P1 + vec2(e, 0.0) - c1, dir1, g1.x, g1.y, g1.z, g1.w, hm);
    float hy = strokeH(P1 + vec2(0.0, e) - c1, dir1, g1.x, g1.y, g1.z, g1.w, hm);
    vec2 grad = vec2(hx - h0, hy - h0) / e * g1.y;
    // Shadow the top stroke throws on what lies beneath it.
    float sm;
    strokeH(P1 + L.xy * g1.y * 0.9 - c1, dir1, g1.x, g1.y, g1.z, g1.w, sm);
    shadow = sm * (1.0 - m1);

    if (o2 >= 0.0) {
      vec3 cb = strokeCol(lay2, c2, P2, dir2, g2);
      float hb = strokeH(P2 - c2, dir2, g2.x, g2.y, g2.z, g2.w, hm);
      cb *= amb + key * 0.62 * 1.25 * (0.9 + 0.2 * hb);
      col = mix(col, cb, m2);
    }
    col *= 1.0 - 0.35 * relief * shadow;

    vec3 N = normalize(vec3(-grad * 0.55 * relief, 1.0));
    float dif = max(dot(N, L), 0.0);
    vec3 ct = strokeCol(lay1, c1, P1, dir1, g1);
    float glint = step(fract(g1.w * 97.0 + hatSeed * 0.618), 0.05 * hatK) * step(1.0, float(lay1));
    vec3 R = reflect(-L, N);
    float spec = pow(max(R.z, 0.0), 16.0) * (0.14 + 1.1 * glint) * relief * (0.5 + key);
    ct = ct * (amb + key * dif * 1.25) + spec * vec3(1.0, 0.97, 0.88);
    col = mix(col, ct, m1);
  }

  // Crows, on top of everything.
  for (int i = 0; i < 24; i++) {
    if (crowA[i] <= 0.0) continue;
    vec4 C = crow[i];
    float r = crowR(q, C);
    if (r > 1.2) continue;
    float px = 1.0 / (unitPx * C.z * 0.12);
    float m = (1.0 - smoothstep(1.0 - px, 1.0, r)) * crowA[i];
    float e = 0.25;
    float rx = crowR(q + vec2(e, 0.0), C), ry = crowR(q + vec2(0.0, e), C);
    float hh = sqrt(max(1.0 - r * r, 0.0));
    vec2 gr = vec2(sqrt(max(1.0 - rx * rx, 0.0)) - hh, sqrt(max(1.0 - ry * ry, 0.0)) - hh) / e * C.z * 0.08;
    vec3 N = normalize(vec3(-gr * relief, 1.0));
    float dif = max(dot(N, L), 0.0);
    vec3 cc = crowC * (0.6 + 1.1 * dif) + pow(max(reflect(-L, N).z, 0.0), 12.0) * 0.12;
    col = mix(col, cc, m);
  }

  // Varnish and a gentle darkening toward the frame.
  vec2 ee = uv * (1.0 - uv);
  col *= mix(0.84, 1.0, smoothstep(0.0, 0.08, ee.x * ee.y * 4.0));
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  };
  // skyDeep, skyLight, skyBand, cloud, sun, sunHalo, hillA, hillB, bush,
  // cypress, cypressLit, wheatDark, wheatLight, wheatPale, green, poppy;
  // then canvas, crow.
  const LOOKS = [
    { name: 'Cypresses (day)', c: ['#2f5fae', '#8fbad6', '#bcd8dc', '#f1efdc', '#f2bf22', '#f4e08c', '#5a63a8', '#9ea2d2', '#5b7d38',
      '#1a3526', '#62843a', '#a8701f', '#e0b23c', '#f5e6a0', '#86993a', '#cc3e24', '#e8dcc0', '#14151b'] },
    { name: 'Crows (storm)', c: ['#141f55', '#35529a', '#4f74ba', '#b9c7c8', '#f0c02c', '#dcd48c', '#29315e', '#48528a', '#3f6a2e',
      '#0e1e17', '#3f6030', '#b87a14', '#e8b21e', '#f3d56c', '#4e8a34', '#b3321a', '#d9ccae', '#0c0d12'] },
    { name: 'Starry (night)', c: ['#0b1640', '#20397a', '#4a6cb0', '#9fb6cc', '#f2cf45', '#e6d98a', '#1a2350', '#2f3c72', '#1f3a24',
      '#0a1510', '#2c4a2c', '#5e4c20', '#9c8436', '#d6c476', '#3b5a30', '#7e2e1e', '#3a3a40', '#08090c'] },
  ].map((l) => ({ name: l.name, c: l.c.map(lin) }));

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const HY = -40;
  const GOLD = 0.6180339887;

  VIZ.register({
    id: 'impasto',
    name: 'Impasto',
    order: 406,

    params: [
      { key: 'look', label: 'Painting', type: 'select', options: LOOKS.map((l) => l.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'wind', label: 'Wind', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'brush', label: 'Brush size', type: 'range', min: 0.6, max: 1.8, default: 1, step: 0.01 },
      { key: 'thick', label: 'Paint thickness', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'crows', label: 'Crows', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Impasto',
      technique: 'Two WebGL2 passes: a quarter-resolution "motif" (colour, brush direction and layer per point, from a stream-function sky, fbm hills, SDF cypresses and a perspective wheat field) and a paint pass that lays three anchored stroke grids over it, each stroke a lit height field with bristle grooves and a knife ridge, composited two deep with cast shadows; crows as lit SDF marks',
      brief: 'A Van Gogh wheat field painted in thick oil, travelling slowly sideways: a sky of swirling bands and clouds, blue hills, cypresses like dark flames, and wheat whose strokes bend stroke by stroke as waves of wind roll through. Raked daylight makes every stroke stand up off the canvas; no glow. Kick: a gust flattens one patch of wheat, pale and leaning, somewhere different each beat. Snare: a flock of crows lifts from the wheat and flies away. Bass: the wind, the sway of the cypresses and the winding of the sky. Hats: wet glints on a few ridges of paint. Drop: the sun comes out in rings of chrome yellow, the colour deepens, the light rakes harder and the crows come in flocks; the breakdown is overcast and still.',
      lineage: [
        'Brief 06 (batch 04): Van Gogh\'s late fields (Wheat Field with Cypresses, Wheatfield with Crows) as a live painting; batch 04 leaves glow and rainbow palettes behind, so the finish here is material: raked light on relief, cast shadows, matte sheen.',
        'Onset detection (kick against band 1, snare and hats above slow floors, a "drop" level from the kick average) is borrowed from Sumi.',
        'Design choice: strokes are anchored to their layer (sky, far, field) rather than to the screen, so the travel does not make the paint shimmer; only each stroke\'s colour and angle follow the motif, which is what makes the wind visible stroke by stroke. The field grid lives in ground-plane coordinates so the near wheat slides faster and the strokes shrink toward the horizon.',
        'v1 render (640x360): read as Van Gogh at once (swirl sky, chrome-yellow sun in rings, lavender hills, cypress flames, raked relief), drop clearly bigger than the breakdown. But the crows were specks on the horizon (size 10, lifting from the far field) and the gust was a faint patch: jolt calm, kickArea 0.10, ratio 1.32, hot spot visible but weak.',
        'v2: crows doubled in size and lift from the middle distance, climbing faster, so a snare flock reads across the room; the gust leans the wheat ~40% harder, turns it the pale cream of the ears\' undersides and covers a slightly wider patch; the sun fades faster in the breakdown. Jolt: calm, kickArea 0.14, ratio 1.41 (build 0.11 / 1.6), one bright blob in the field per kick and nothing in the sky but the crows.',
        'Looks checked: Crows (storm) is ultramarine sky over hot yellow wheat; Starry (night) is the dark variant, its sun a moon in rings (black crows are harder to see there).',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0; this.SW = 0; this.tw = 0;
      this.pan = 0; this.speed = 10;
      this.reveal = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0, sun: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.gusts = [];
      this.gustN = 0;
      this.crowsL = [];
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (fs) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(prog, 0, 'pos');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        const u = {};
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
          u[name] = gl.getUniformLocation(prog, name);
        }
        return { prog, u };
      };
      this.pm = link(MOTIF.replace('uniform vec3 pal[16];', 'uniform vec3 pal[16];\nuniform vec2 mres;'));
      this.pp = link(PAINT);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const mk = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      this.texA = mk(); this.texB = mk();
      this.fbo = gl.createFramebuffer();
      this.mw = 0; this.mh = 0;
      this.gl = gl; this.glCanvas = c;
    },

    listen(s, dt, push, halfW, crowK) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        if (push > 0.01) {
          // A gust somewhere new in the middle distance of the field.
          this.gustN++;
          const x = ((this.gustN * GOLD) % 1 * 1.5 - 0.75) * halfW;
          const y = HY - 90 - 120 * ((this.gustN * 0.381966) % 1);
          const d = HY - y, sc = (d + D0N) / D1N;
          this.gusts.unshift({ x: x / sc + this.pan, y: D1N * Math.log((d + D0N) / D0N), age: 0, amp: (0.7 + 0.3 * kRaw) * Math.min(push, 1.6) });
          this.gusts.length = Math.min(this.gusts.length, 3);
        }
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.14));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.6, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22 && push > 0.02 && crowK > 0.01) {
        since.snare = 0;
        this.flock(halfW, crowK, push);
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
        e.hat = Math.max(e.hat, hRaw);
      }
      e.prevH = hRaw;
      e.hat *= Math.exp(-dt / 0.25);
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.0, dt);
    },

    flock(halfW, crowK, push) {
      const r = Math.random;
      const x0 = (r() * 1.4 - 0.7) * halfW;
      const y0 = HY - 70 - r() * 90;
      const dirX = r() < 0.5 ? -1 : 1;
      const n = Math.round((4 + 4 * this.env.drop) * Math.min(crowK, 1.5) * Math.min(push, 1.3));
      for (let i = 0; i < n; i++) {
        this.crowsL.unshift({
          x: x0 + (r() - 0.5) * 110, y: y0 + (r() - 0.5) * 40,
          vx: dirX * (45 + 55 * r()), vy: 85 + 55 * r(),
          size: 20 + 9 * r(), ph: r() * 6.28, f: 9 + 3 * r(), age: -0.15 * r(),
        });
      }
      this.crowsL.length = Math.min(this.crowsL.length, 24);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const halfW = ctx.width / 2;
      this.listen(signals, dt, push, halfW, params.crows);
      const e = this.env;
      const drop = e.drop;
      this.reveal = Math.min(1, this.reveal + dt / 1.6);

      const windAmp = params.wind * (0.35 + 0.9 * e.bass * push + 0.35 * drop);
      this.T += dt * (0.5 + 1.2 * e.bass * push + 0.5 * drop) * (0.4 + 0.6 * params.wind);
      this.SW += dt * (0.12 + 0.3 * e.bass * push + 0.18 * drop);
      this.tw += dt;
      this.speed = ease(this.speed, params.drift * (9 + 16 * e.bass * push + 26 * drop), 0.6, dt);
      this.pan += dt * this.speed;
      e.sun = ease(e.sun, drop, drop > e.sun ? 0.9 : 0.55, dt);

      for (const G of this.gusts) { G.age += dt; G.x += dt * 50; }
      for (const C of this.crowsL) {
        C.age += dt;
        if (C.age < 0) continue;
        const k = Math.exp(-C.age * 0.14);
        C.x += dt * C.vx * (0.6 + 0.4 * k) - dt * this.speed * 0.2;
        C.y += dt * C.vy * k;
        C.ph += dt * C.f * (0.6 + 0.4 * k);
      }
      this.crowsL = this.crowsL.filter((C) => C.age < 9 && C.y < 340 && Math.abs(C.x) < halfW + 60);

      const RESK = 1;
      let w = Math.round(p.width * p.pixelDensity() * RESK);
      let h = Math.round(p.height * p.pixelDensity() * RESK);
      const MAXP = 2400000;
      if (w * h > MAXP) { const f = Math.sqrt(MAXP / (w * h)); w = Math.round(w * f); h = Math.round(h * f); }
      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (err) { this.glFailed = true; console.warn('Impasto GL:', err.message); }
      }
      if (!this.gl) {
        p.background(232, 220, 190);
        p.noStroke(); p.fill(40);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Impasto needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      const mw = Math.max(8, Math.round(w / 4)), mh = Math.max(8, Math.round(h / 4));
      if (mw !== this.mw || mh !== this.mh) {
        for (const t of [this.texA, this.texB]) {
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, mw, mh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texA, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.texB, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        this.mw = mw; this.mh = mh;
      }

      const look = LOOKS[(params.look | 0) % LOOKS.length].c;
      const unitPx = Math.min(w, h) / 600;
      const panV = [this.pan * 0.1, this.pan * 0.35, this.pan];
      const common = (u) => {
        gl.uniform2f(u.res, w, h);
        gl.uniform1f(u.unitPx, unitPx);
        gl.uniform1f(u.Hy, HY);
        gl.uniform3f(u.pan, panV[0] % 100000, panV[1] % 100000, panV[2]);
      };

      // Pass 1: the motif.
      const M = this.pm;
      gl.useProgram(M.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, mw, mh);
      common(M.u);
      gl.uniform2f(M.u.mres, mw, mh);
      gl.uniform1f(M.u.T, this.T % 10000);
      gl.uniform1f(M.u.SW, this.SW % 10000);
      gl.uniform1f(M.u.tw, this.tw % 10000);
      gl.uniform1f(M.u.windAmp, windAmp);
      gl.uniform1f(M.u.sat, 0.72 + 0.5 * drop);
      gl.uniform1f(M.u.cloudK, clamp01(1 - 1.4 * e.sun) * (0.4 + 0.6 * clamp01(1 - e.bass)));
      gl.uniform3f(M.u.sun, -0.42 * halfW, HY + 235, 34 + 8 * e.sun);
      gl.uniform1f(M.u.sunK, clamp01(e.sun * 1.3));
      const gu = new Float32Array(12);
      this.gusts.forEach((G, i) => {
        const env = G.amp * Math.min(1, G.age / 0.05) * Math.exp(-G.age / 0.4);
        gu.set([G.x, G.y, env, 62 + 45 * Math.min(1, G.age / 0.3)], i * 4);
      });
      gl.uniform4fv(M.u.gust, gu);
      const pal = new Float32Array(48);
      for (let i = 0; i < 16; i++) pal.set(look[i], i * 3);
      gl.uniform3fv(M.u.pal, pal);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 2: the paint.
      const P = this.pp;
      gl.useProgram(P.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      common(P.u);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texB);
      gl.uniform1i(P.u.motifA, 0);
      gl.uniform1i(P.u.motifB, 1);
      const bs = params.brush;
      gl.uniform3f(P.u.cellS, 19 * bs, 12 * bs, 15 * bs);
      gl.uniform1f(P.u.reveal, this.reveal);
      gl.uniform1f(P.u.relief, params.thick);
      gl.uniform1f(P.u.key, 0.34 + 0.3 * e.sun);
      gl.uniform1f(P.u.amb, 0.66 - 0.14 * e.sun);
      gl.uniform1f(P.u.hatSeed, this.hatSeed);
      gl.uniform1f(P.u.hatK, clamp01(e.hat * push));
      gl.uniform3fv(P.u.canvasC, look[16]);
      gl.uniform3fv(P.u.crowC, look[17]);
      const cr = new Float32Array(96), ca = new Float32Array(24);
      this.crowsL.forEach((C, i) => {
        if (C.age < 0) return;
        const sz = C.size * Math.exp(-C.age * 0.16);
        cr.set([C.x, C.y, sz, C.ph], i * 4);
        ca[i] = Math.min(1, C.age / 0.12) * clamp01((9 - C.age) / 1.5);
      });
      gl.uniform4fv(P.u.crow, cr);
      gl.uniform1fv(P.u.crowA, ca);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
