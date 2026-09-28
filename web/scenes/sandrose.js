// Sand Rose: a raked garden mirrored six ways, whose rake lines are Chladni
// nodal lines.
//
// Batch 06 idea 13 (the Psychonaut's, with the Floor's variants): Chladni
// crossed with Zen and Mandala. Chosen form: the Psychonaut's top-down,
// daylight, matte garden. The Floor's low stage view with side spotlights is
// what Chladni V2 already is (a tilted plate and a flying camera), and dancers'
// footprints would fill the kaleidoscope with twelve copies of every step,
// so the one un-mirrored thing here is the kick's pebble instead.
//
// How it is built:
// - One field f, a sum of real Chladni modes (as in chladni.js) plus a
//   "rose" term cos(pi k (r + a cos(N j theta)) - psi), rings scalloped into
//   nested flower outlines that breathe outward as psi advances, is evaluated
//   in kaleidoscope folded coordinates (N mirrored wedges, six by default).
//   The rose's scallop has zero slope on both mirrors, so its petals meet
//   them without a crease; the Chladni modes do crease, and that V is the
//   kaleidoscope seam.
// - The rake grooves are level sets of asin(f). asin turns each cosine into a
//   triangle wave, so the grooves keep an even spacing from node to antinode,
//   and around each extremum (1 - c r^2) they become evenly spaced rings,
//   which is exactly how a real rake rings a stone. The stones sit on the
//   antinodes found along the mirror lines, so each is one stone mirrored
//   into a ring of N.
// - Grains of dark sand (two populations, two inks) live in the fundamental
//   wedge on the CPU and descend the gradient of f^2 onto the nodal lines,
//   like the Chladni scenes, then are drawn 2N times by instancing, one per
//   mirror image. When the figure changes, every grain visibly flows.
// - The ground is one height field (grooves, ripples, stones, pebbles) whose
//   normal comes from screen-space derivatives, lit by a low sun in daylight,
//   with stone shadows marched toward the sun and slow cloud shadows.
//
// Music:
//   kick   one pebble drops into the next petal (a clock hand round the rose)
//          and its ripple rakes outward through the grooves; after N kicks
//          the symmetry is whole again.
//   snare  the Chladni figure changes (at most every ~3.5 s): every grain
//          flows to a new rose and the stones slide to the new antinodes.
//   bass   the flow of the lattice under the mirrors, the rose's outward
//          breathing and the garden's turn.
//   hats   mica glints in the sand.
//   drop   bold rose instead of fine lattice, more modes, a second ink of
//          sand, hard low sun; the breakdown returns to a fine lattice under
//          a veiled sun.

(function () {
  const TAU = Math.PI * 2;
  const MAXM = 3;
  const PLATE = 300;          // virtual units per plate unit
  const MAX_PEB = 12;
  const MAX_RIP = 4;
  // The rose: rings whose radius is scalloped by cos(N j theta), so their
  // level sets are nested flower outlines. A product cos(k r) cos(N theta)
  // was tried first and gave a polar checkerboard, not a rose.
  const ROSE_A = 0.09;        // petal depth, plate units
  const ROSE_B = 0.25;        // the scallop fades in over this radius, so the centre is not a star of creases

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (x) => clamp(x, 0, 1);
  const smooth = (a, b, v) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // Gardens: sand, ink A (the nodal sand), ink B (the drop's second sand),
  // two stone tones, sun and sky light.
  const GARDENS = [
    { name: 'Daylight', sand: rgb('#eadcc2'), inkA: rgb('#2e3238'), inkB: rgb('#b0452a'),
      stoneA: rgb('#5b5f66'), stoneB: rgb('#3c4047'), sun: [1.0, 0.94, 0.82], sky: [0.50, 0.54, 0.62] },
    { name: 'Slate', sand: rgb('#3a3f47'), inkA: rgb('#ece3d0'), inkB: rgb('#e0a040'),
      stoneA: rgb('#9a958c'), stoneB: rgb('#6f6b65'), sun: [1.0, 0.92, 0.80], sky: [0.46, 0.50, 0.60] },
    { name: 'Desert rose', sand: rgb('#e6c3ad'), inkA: rgb('#5a2420'), inkB: rgb('#2f5866'),
      stoneA: rgb('#8c6a5c'), stoneB: rgb('#5e463e'), sun: [1.05, 0.90, 0.76], sky: [0.52, 0.50, 0.60] },
  ];

  // Figure sequence: (m - n, sign). The snare steps through it.
  const FIGS = [[1, 1], [2, -1], [3, 1], [1, -1], [2, 1], [4, -1], [3, -1], [5, 1]];

  const PRESETS = {
    // Fine lattice under a veiled sun: the intro and the breakdown.
    calm: { fine: 5.6, rose: 0.2, complexity: 0.15, accent: 0, sun: 0.45, turn: 0.2, flow: 0.5 },
    // A bold rose, more modes, a second ink, hard low sun, faster turn.
    drop: { fine: 3.4, rose: 1, complexity: 0.45, accent: 1, sun: 1, turn: 0.5, flow: 1.2 },
    // Twelve mirrors, a snowflake of dark sand on pale.
    star: { folds: 12, fine: 4.2, rose: 0.6, complexity: 0.5, accent: 0.4, sun: 0.8, turn: 0.3, flow: 0.8 },
    // White sand on slate at dusk.
    night: { garden: 1, fine: 4.5, rose: 0.5, complexity: 0.4, accent: 0.6, sun: 0.7, turn: 0.35, flow: 0.9 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['fine', 'rose', 'complexity', 'accent', 'sun', 'turn', 'flow'];

  const VS_QUAD = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  // Grains live in the fundamental wedge and are splatted into a density
  // texture of the wedge itself, which the composite reads at the folded
  // coordinate: one splat serves all 2N mirror images. (Splatting each image
  // separately cost 12x the points.) Instance 1 is the grain's reflection in
  // the far mirror, so lines touching that mirror are not half as dense.
  const VS_SPLAT = `#version 300 es
in vec4 g;              // wedge x, y (garden units), weight A, weight B
uniform float uN, uPs;
uniform vec2 uExt;      // texture extent, garden units
out vec2 vW;
void main() {
  vec2 F = g.xy;
  if (gl_InstanceID == 1) {
    float a = 6.2831853 / uN;
    float c = cos(a), s = sin(a);
    F = vec2(c * F.x + s * F.y, s * F.x - c * F.y);
  }
  gl_Position = vec4(F / uExt * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = uPs;
  vW = g.zw;
}`;

  const FS_SPLAT = `#version 300 es
precision mediump float;
in vec2 vW;
uniform float w;
out vec4 o;
void main() { o = vec4(vW * w, 0.0, 0.0); }`;

  const FS_COMP = `#version 300 es
precision highp float;
uniform vec2 uRes, uCentre, uOff;
uniform float uUnitPx, uRot, uZoom, uN, uL, uNorm, uNg, uAmp, uTime;
uniform vec4 uModes[3];     // n, m, s, a
uniform vec4 uRose;         // k, j, weight, phase
uniform vec4 uStone;        // r, mirror line (0 or 1), radius, size
uniform vec4 uPeb[${MAX_PEB}];     // Q x, y, radius, visibility
uniform vec4 uPebDrop[${MAX_PEB}]; // height above sand (0 = landed), seed
uniform vec4 uRip[${MAX_RIP}];     // Q x, y, ring radius, strength
uniform float uRipW[${MAX_RIP}];   // ring width
uniform int uPebN, uRipN;
uniform sampler2D uDens;
uniform vec2 uExt, uTexel;
uniform float uGain, uAccent, uSun, uHat, uHatSeed;
uniform vec3 uSand, uInkA, uInkB, uStoneA, uStoneB, uSunCol, uSkyCol, uSunDir;
out vec4 o;

const float PI = 3.14159265;
const float ROSE_A = ${ROSE_A.toFixed(3)};
const float ROSE_B = ${ROSE_B.toFixed(3)};

vec2 toQ(vec2 P) {
  vec2 d = (P - uCentre) / uZoom;
  float c = cos(uRot), s = sin(uRot);
  return vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
}
vec2 fold(vec2 Q) {
  float r = length(Q);
  float w = 6.2831853 / uN;
  float th = mod(atan(Q.y, Q.x), w);
  if (th > 0.5 * w) th = w - th;
  return r * vec2(cos(th), sin(th));
}
float field(vec2 F) {
  vec2 u = F / uL + uOff;
  float f = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 m = uModes[i];
    if (m.w < 0.001) continue;
    vec2 a = PI * m.x * u, b = PI * m.y * u;
    f += m.w * (cos(a.x) * cos(b.y) + m.z * cos(b.x) * cos(a.y));
  }
  if (uRose.z > 0.001) {
    float r = length(F) / uL;
    float th = atan(F.y, F.x);
    f += uRose.z * cos(PI * uRose.x * (r + ROSE_A * cos(uN * uRose.y * th) * r / (r + ROSE_B)) - uRose.w);
  }
  return clamp(f * uNorm, -1.0, 1.0);
}
// One stone on a mirror line; its outline only uses cos(k phi) about the
// line, so it is its own reflection and the kaleidoscope never cuts it.
float stoneSd(vec2 F) {
  float ang = uStone.y * PI / uN;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 q = F - dir * uStone.x;
  float along = dot(q, dir);
  float perp = abs(dot(q, vec2(-dir.y, dir.x)));
  float phi = atan(perp, along);
  float R = uStone.z * uStone.w * (1.0 + 0.10 * cos(2.0 * phi) + 0.05 * cos(3.0 * phi) + 0.025 * cos(5.0 * phi));
  return (length(q) - R) * 0.9;
}
float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 2; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s * 1.33;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 P = (gl_FragCoord.xy - 0.5 * uRes) / uUnitPx;   // virtual units, y up
  vec2 Q = toQ(P);
  vec2 F = fold(Q);

  // ---- rake grooves: level sets of asin(f)
  float f = field(F);
  float g = uNg * asin(f) * 0.6366198;
  // Pebble ripples push the grooves outward as they pass: the rake re-raked.
  float hRip = 0.0, press = 0.0;
  for (int i = 0; i < ${MAX_RIP}; i++) {
    if (i >= uRipN) break;
    vec4 r = uRip[i];
    if (r.w < 0.002) continue;
    float d = length(Q - r.xy);
    float x = (d - r.z) / uRipW[i];
    float e = exp(-x * x);
    g += r.w * 0.45 * e * sign(x + 0.0001) * (1.0 - e * 0.5);
    hRip += r.w * uAmp * (-1.6 * e + 0.8 * exp(-(x - 1.4) * (x - 1.4) * 2.0));
    press = max(press, r.w * e);
  }
  float gw = fwidth(g);
  float grooveK = 1.0 - smoothstep(0.2, 0.45, gw);   // fade grooves finer than a pixel
  float h = uAmp * (0.5 + 0.5 * cos(6.2831853 * g)) * grooveK + hRip;

  // ---- stones
  float sd = stoneSd(F);
  float sR = uStone.z * uStone.w;
  float inStone = 1.0 - smoothstep(-0.6, 0.6, sd);
  float hs = sR * 0.55 * sqrt(clamp(1.0 - pow(1.0 + min(sd, 0.0) / max(sR, 1.0), 2.0), 0.0, 1.0));
  h = mix(h, uAmp + hs, inStone);

  // ---- pebbles, in the garden's own frame (not mirrored)
  float inPeb = 0.0;
  vec4 pebHit = vec4(0.0);
  for (int i = 0; i < ${MAX_PEB}; i++) {
    if (i >= uPebN) break;
    vec4 pb = uPeb[i];
    if (pb.w < 0.002) continue;
    vec4 dr = uPebDrop[i];
    vec2 q = Q - pb.xy;
    float an = dr.y * 6.28;
    q = mat2(cos(an), sin(an), -sin(an), cos(an)) * q;
    q.y /= 0.78;
    float d = length(q) - pb.z;
    float k = (1.0 - smoothstep(-0.5, 0.5, d)) * pb.w * step(dr.x, 0.5);
    float ph = pb.z * 0.6 * sqrt(clamp(1.0 - pow(1.0 + min(d, 0.0) / pb.z, 2.0), 0.0, 1.0));
    if (k > inPeb) { inPeb = k; pebHit = vec4(float(i), dr.y, 0.0, 0.0); }
    h = mix(h, uAmp + ph, k);
  }

  vec2 dh = vec2(dFdx(h), dFdy(h)) * uUnitPx;
  vec3 N = normalize(vec3(-dh, 1.0));
  vec3 L = normalize(uSunDir);

  // ---- shadows: march toward the sun, testing the stone and the pebbles
  float shLen = sqrt(1.0 - L.z * L.z) / L.z;
  float vis = 1.0;
  for (int i = 1; i <= 2; i++) {
    float t = float(i) / 2.0;
    vec2 Ps = P + L.xy / length(L.xy) * t * sR * 0.55 * shLen;
    float s = stoneSd(fold(toQ(Ps)));
    vis = min(vis, mix(1.0, smoothstep(-2.0, 3.0 + 4.0 * t, s), step(0.01, uStone.w)));
  }
  for (int i = 0; i < ${MAX_PEB}; i++) {
    if (i >= uPebN) break;
    vec4 pb = uPeb[i];
    if (pb.w < 0.002) continue;
    float lift = uPebDrop[i].x;
    vec2 off = L.xy / length(L.xy) * (pb.z * 0.6 + lift) * shLen / uZoom;
    vec2 offQ = vec2(cos(uRot) * off.x + sin(uRot) * off.y, -sin(uRot) * off.x + cos(uRot) * off.y);
    float d = length(Q + offQ - pb.xy) - pb.z * (1.0 + lift * 0.01);
    vis = min(vis, mix(1.0, smoothstep(-2.0, 3.0 + lift * 0.1, d), pb.w * (1.0 - smoothstep(10.0, 60.0, lift) * 0.6)));
  }
  // Slow cloud shadows drift over the garden; the drop's hard sun burns them off.
  float cloud = smoothstep(0.42, 0.68, fbm(P * 0.0032 + vec2(uTime * 0.018, uTime * 0.007)));
  float sunI = mix(0.22, 1.15, uSun) * (1.0 - 0.5 * cloud * (1.0 - 0.8 * uSun));
  vec3 sky = uSkyCol * mix(1.35, 0.62, uSun);

  // ---- grains
  vec2 wv = F / uExt;
  vec2 px = uTexel;
  vec2 D = texture(uDens, wv).rg * 0.4;
  D += (texture(uDens, wv + vec2(px.x, 0.0)).rg + texture(uDens, wv - vec2(px.x, 0.0)).rg
      + texture(uDens, wv + vec2(0.0, px.y)).rg + texture(uDens, wv - vec2(0.0, px.y)).rg) * 0.15;
  D *= uGain;
  float covA = 1.0 - exp(-D.r * 2.2);
  float covB = (1.0 - exp(-D.g * 3.0)) * uAccent;
  vec2 Fs = fold(toQ(P + L.xy / length(L.xy) * 1.4));
  vec2 Ds = texture(uDens, Fs / uExt).rg * uGain;
  float grainShadow = 1.0 - exp(-(Ds.r + Ds.g * uAccent) * 1.0);

  // ---- light
  float diff = max(dot(N, L), 0.0);
  float ao = 0.8 + 0.2 * clamp(h / max(uAmp, 0.01), 0.0, 1.0);
  vec2 gc = floor(P * uZoom / 1.6);
  float gv = 0.93 + 0.1 * hash(gc) + 0.05 * (vnoise(P * 0.2) - 0.5);
  vec3 sandAlb = uSand * gv * (1.0 - 0.12 * press);
  vec3 col = sandAlb * (uSunCol * diff * vis * sunI * (1.0 - 0.35 * grainShadow * uSun) + sky * ao * 0.9);

  vec3 grainLight = uSunCol * max(L.z, 0.0) * vis * sunI * 1.1 + sky * 0.9;
  col = mix(col, uInkA * grainLight, covA * (1.0 - inStone) * (1.0 - inPeb));
  col = mix(col, uInkB * grainLight, covB * (1.0 - inStone) * (1.0 - inPeb));

  // Stone and pebble albedo, speckled.
  if (inStone > 0.001) {
    float sn = fbm(F * 0.08 + 3.0);
    vec3 stAlb = mix(uStoneA, uStoneB, smoothstep(0.3, 0.75, sn)) * (0.92 + 0.16 * vnoise(F * 0.7));
    vec3 stoneCol = stAlb * (uSunCol * diff * sunI * 1.1 + sky * (0.55 + 0.35 * N.z));
    col = mix(col, stoneCol, inStone);
  }
  if (inPeb > 0.001) {
    vec3 pbAlb = mix(uStoneB, uStoneA, 0.3 + 0.6 * hash(vec2(pebHit.x, 7.0))) * 0.85;
    vec3 pebCol = pbAlb * (uSunCol * diff * sunI * 1.1 + sky * (0.5 + 0.4 * N.z));
    col = mix(col, pebCol, inPeb);
  }

  // ---- hats: mica glints on the sunlit crests
  vec2 mc = floor(P / 2.8);
  vec2 mf = fract(P / 2.8) - 0.5;
  float cell = step(1.0 - 0.02 * uHat, hash(mc + uHatSeed * 7.31)) * smoothstep(0.5, 0.1, length(mf));
  col += vec3(1.0, 0.97, 0.88) * cell * smoothstep(0.3, 0.9, diff * vis) * (1.0 - covA) * (1.0 - inStone) * 0.9;

  float vig = 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.0, 0.85)) * 1.3, 2.4);
  o = vec4(clamp(col * vig, 0.0, 1.0), 1.0);
}`;

  VIZ.register({
    id: 'sandrose',
    name: 'Sand Rose',
    order: 813,

    params: [
      { key: 'fine', label: 'Lattice fineness', type: 'range', min: 2, max: 8, default: PRESETS.calm.fine, step: 0.01 },
      { key: 'rose', label: 'Rose', type: 'range', min: 0, max: 1, default: PRESETS.calm.rose, step: 0.01 },
      { key: 'complexity', label: 'Complexity', type: 'range', min: 0, max: 1, default: PRESETS.calm.complexity, step: 0.01 },
      { key: 'accent', label: 'Second sand', type: 'range', min: 0, max: 1, default: PRESETS.calm.accent, step: 0.01 },
      { key: 'sun', label: 'Sun', type: 'range', min: 0, max: 1, default: PRESETS.calm.sun, step: 0.01 },
      { key: 'turn', label: 'Turn', type: 'range', min: -1, max: 1, default: PRESETS.calm.turn, step: 0.01 },
      { key: 'flow', label: 'Flow', type: 'range', min: 0, max: 3, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'folds', label: 'Mirrors', type: 'range', min: 3, max: 12, default: 6, step: 1 },
      { key: 'garden', label: 'Garden', type: 'select', options: GARDENS.map((g) => g.name), default: 0 },
      { key: 'spacing', label: 'Groove spacing', type: 'range', min: 6, max: 16, default: 10, step: 0.1 },
      { key: 'sand', label: 'Sand', type: 'range', min: 3000, max: 16000, default: 10000, step: 500 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'figure', label: 'New figure', run() { this.nextFigure = true; } },
    ],

    gallery: {
      title: 'Sand Rose',
      technique: 'WebGL2: a sum of real Chladni modes plus a radial rose term, evaluated in six-fold kaleidoscope coordinates; rake grooves are level sets of asin(f) lit by a low sun through screen-space derivatives of one height field (grooves, ripples, stones, pebbles), stones marched for cast shadows; two populations of CPU grains descend the gradient of f² in the fundamental wedge and are splatted 2N times by instancing into a density buffer',
      brief: 'A karesansui garden of pale sand seen from above in daylight, mirrored six ways and turning slowly. Its rake grooves are the contours of a Chladni figure, so they run parallel to lines of dark sand lying on the nodal lines and ring evenly round a circle of slate stones sitting on the antinodes, while the underlying lattice flows through the mirrors like a kaleidoscope. Each kick drops one pebble into the next petal, a clock hand round the rose, and its ripple rakes outward through the grooves; after six kicks the symmetry is whole. Each snare (at most every few seconds) changes the figure: every grain flows to a new rose and the stones slide to the new antinodes. Bass drives the flow and the rose\'s outward breathing, hats glint mica in the sand. The drop turns a fine lattice under a veiled sun into a bold rose with more modes, a second, terracotta sand and a hard low sun; the breakdown sifts back to a fine lattice.',
      lineage: [
        'Batch 06 idea 13 (Psychonaut; Floor variants): Chladni crossed with Zen and Mandala. Chose the Psychonaut\'s top-down daylight garden; the Floor\'s low stage view is what Chladni V2 already does, and twelve mirrored copies of dancers\' footprints would clutter the figure, so the pebble is the one un-mirrored thing.',
        'From Chladni (V1): real mode sums, grains descending the gradient of f², Newton-settled respawns, the snare as a figure change. From Zen: grooves as level sets of a rake coordinate, lit by a low sun, stones ringed by the rake. From Mandala: the fold, and a radial term whose rings breathe outward.',
        'v1 (640x360): the calm fine lattice read well, but the drop was chaos: the rose term was cos(k r) cos(6 theta), which is a polar checkerboard, not a rose, and its rings raced outward faster than the grains could follow; nodal sand was too faint. v2: the rose became scalloped rings cos(pi k (r + a cos(N theta))), nested flower outlines, dominant in the drop and breathing out at walking pace; the second ink follows the rose alone so the drop draws the rose in terracotta; bolder sand lines. Splatting every grain into all twelve mirror images cost twelve times the points in SwiftShader, so grains now splat once into a wedge-space density texture that the composite reads at the folded coordinate. Stones that flipped between two equally strong antinodes in the breakdown now commit to a line change once they start to sink.',
        'Jolt (640x360): calm, kickArea 0.40, kickMean 0.058, ratio 1.16 (build 0.08, ratio 1.37). The heat map shows the kick as one ripple ring; the area is the garden\'s own flow and turn, which runs as strongly between kicks.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); this.lastMs = null; },

    init() {
      this.lastMs = null;
      this.T = 0;
      this.flowT = 0;
      this.turnA = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0,
        lvl: 0, floor: 0.12, ceil: 0.55, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, fig: 0 };
      this.hatSeed = 0;
      this.figIdx = 0;
      this.nextFigure = false;
      this.modes = null;
      this.rose = null;
      this.count = 0;
      this.stone = { r: 150, line: 0, size: 0, tr: 150, tline: 0, check: 0 };
      this.pebbles = [];
      this.ripples = [];
      this.kicks = 0;
      this.fv = new Float64Array(3);
    },

    alloc(nA) {
      const nB = Math.round(nA * 0.5);
      const n = nA + nB;
      this.nA = nA;
      this.count = n;
      this.gx = new Float32Array(n);
      this.gy = new Float32Array(n);
      this.buf = new Float32Array(n * 4);
      this.fresh = true;
    },

    // ---- onsets against slow baselines (as in Chladni): only a jump is a hit
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kickHit = false, snareHit = false;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kickHit = true; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snareHit = true; }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.12));

      // Bass without the kick band, slow: it sets speeds, and a bass that
      // pumped with each kick would surge the whole kaleidoscope on the beat.
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 1.2, dt);

      // Track follower: a slow level on the low bands, ranged against a
      // floor and ceiling that adapt to the track.
      e.lvl = ease(e.lvl, (s[0] + s[1]) / 200, 0.9, dt);
      e.ceil = Math.max(e.lvl, e.ceil - dt * 0.008);
      e.floor = Math.min(e.lvl, e.floor + dt * 0.006);
      return { kickHit, snareHit, kAmp: kRaw };
    },

    targets(P) {
      const fig = FIGS[this.figIdx % FIGS.length];
      const fig2 = FIGS[(this.figIdx * 3 + 2) % FIGS.length];
      const fig3 = FIGS[(this.figIdx * 5 + 5) % FIGS.length];
      const n0 = P.fine;
      const cx = P.complexity;
      return [
        { n: n0, m: n0 + fig[0], s: fig[1], a: 1 - 0.8 * P.rose },
        { n: n0 + 1, m: n0 + 1 + fig2[0], s: fig2[1], a: 0.05 + 0.5 * cx },
        { n: Math.max(1, n0 - 1), m: n0 + 2 + fig3[0], s: fig3[1], a: 0.3 * cx * cx },
      ];
    },

    // f and grad f (per virtual unit) at wedge point (x, y). Population B
    // (useA false), the drop's second ink, hears only the rose, so the rose
    // is drawn in its own colour over the full figure; with no rose it hears
    // the drop's extra modes. Either is normalised on its own.
    sample(x, y, useA) {
      const L = PLATE;
      const ux = x / L + this.off[0], uy = y / L + this.off[1];
      let f = 0, fx = 0, fy = 0, asum = 0;
      const M = this.modes;
      const R = this.rose;
      const roseOnly = !useA && R.w > 0.05;
      for (let i = useA ? 0 : 1; i < (roseOnly ? 0 : MAXM); i++) {
        const m = M[i];
        if (m.a < 0.001) continue;
        const pn = Math.PI * m.n, pm = Math.PI * m.m;
        const cxn = Math.cos(pn * ux), sxn = Math.sin(pn * ux);
        const cym = Math.cos(pm * uy), sym = Math.sin(pm * uy);
        const cxm = Math.cos(pm * ux), sxm = Math.sin(pm * ux);
        const cyn = Math.cos(pn * uy), syn = Math.sin(pn * uy);
        f += m.a * (cxn * cym + m.s * cxm * cyn);
        fx -= m.a * (pn * sxn * cym + m.s * pm * sxm * cyn);
        fy -= m.a * (pm * cxn * sym + m.s * pn * cxm * syn);
        asum += m.a;
      }
      if (R.w > 0.001) {
        const r = Math.hypot(x, y) / L + 1e-6;
        const th = Math.atan2(y, x);
        const k = R.k, nj = this.N * R.j;
        const q = r / (r + ROSE_B), dq = ROSE_B / ((r + ROSE_B) * (r + ROSE_B));
        const ca = Math.cos(nj * th), sa = Math.sin(nj * th);
        const ph = Math.PI * k * (r + ROSE_A * ca * q) - R.psi;
        const sp = Math.sin(ph);
        f += R.w * Math.cos(ph);
        const dr = -R.w * sp * Math.PI * k * (1 + ROSE_A * ca * dq);
        const dth = R.w * sp * Math.PI * k * ROSE_A * nj * sa * q;
        const c = Math.cos(th), s = Math.sin(th);
        fx += dr * c - (dth / r) * s;
        fy += dr * s + (dth / r) * c;
        asum += R.w;
      }
      const norm = 1 / Math.max(useA ? 0.5 : 0.08, asum);
      this.fv[0] = f * norm; this.fv[1] = (fx * norm) / L; this.fv[2] = (fy * norm) / L;
    },

    // Fold a point into the fundamental wedge [0, pi / N].
    foldInto(i) {
      const x = this.gx[i], y = this.gy[i];
      const w = TAU / this.N;
      let th = Math.atan2(y, x);
      th = ((th % w) + w) % w;
      if (th > 0.5 * w) th = w - th;
      const r = Math.hypot(x, y);
      this.gx[i] = r * Math.cos(th);
      this.gy[i] = r * Math.sin(th);
      return r;
    },

    spawn(i, Rmax) {
      const r = Rmax * Math.sqrt(Math.random());
      const th = Math.random() * Math.PI / this.N;
      let x = r * Math.cos(th), y = r * Math.sin(th);
      const useA = i < this.nA;
      // Arrive already settled: Newton steps onto the nearest node.
      for (let it = 0; it < 5; it++) {
        this.sample(x, y, useA);
        const fv = this.fv;
        const g2 = fv[1] * fv[1] + fv[2] * fv[2] + 1e-9;
        let k = fv[0] / g2;
        const st = Math.abs(k) * Math.sqrt(g2);
        if (st > 20) k *= 20 / st;
        x -= k * fv[1]; y -= k * fv[2];
      }
      this.gx[i] = x; this.gy[i] = y;
      this.foldInto(i);
    },

    // Stones sit on the strongest antinode along either mirror line, within
    // the part of the garden that is surely on screen.
    placeStone(Rvis, qw) {
      const S = this.stone;
      let best = 0, bestR = S.tr, bestLine = S.tline;
      const w = Math.PI / this.N;
      const at = (r, line) => {
        const a = line * w;
        this.sample(r * Math.cos(a), r * Math.sin(a), true);
        return Math.abs(this.fv[0]);
      };
      for (let line = 0; line < 2; line++) {
        for (let i = 0; i <= 48; i++) {
          const r = Rvis * (0.36 + 0.46 * (i / 48));
          const v = at(r, line);
          if (v > best) { best = v; bestR = r; bestLine = line; }
        }
      }
      // Hysteresis: track the current antinode unless a much stronger one exists.
      let curBest = 0, curR = S.tr;
      for (let i = -8; i <= 8; i++) {
        const r = S.tr + (i / 8) * qw;
        if (r < Rvis * 0.32 || r > Rvis * 0.85) continue;
        const v = at(r, S.tline);
        if (v > curBest) { curBest = v; curR = r; }
      }
      if (curBest > 0.4 && curBest * 1.5 > best) { S.tr = curR; }
      else { S.tr = bestR; S.tline = bestLine; }
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
      const link = (vs, fs) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
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
      this.pSplat = link(VS_SPLAT, FS_SPLAT);
      this.pComp = link(VS_QUAD, FS_COMP);

      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.vaoQuad = gl.createVertexArray();
      gl.bindVertexArray(this.vaoQuad);
      const lq = gl.getAttribLocation(this.pComp.prog, 'pos');
      gl.enableVertexAttribArray(lq);
      gl.vertexAttribPointer(lq, 2, gl.FLOAT, false, 0, 0);

      this.grainBuf = gl.createBuffer();
      this.vaoGrain = gl.createVertexArray();
      gl.bindVertexArray(this.vaoGrain);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.grainBuf);
      const lg = gl.getAttribLocation(this.pSplat.prog, 'g');
      gl.enableVertexAttribArray(lg);
      gl.vertexAttribPointer(lg, 4, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.half = !!gl.getExtension('EXT_color_buffer_float');
      this.gl = gl;
      this.glCanvas = c;
      this.fbW = 0; this.fbH = 0;
    },

    resize(w, h) {
      const gl = this.gl;
      if (this.tDens) { gl.deleteTexture(this.tDens.tex); gl.deleteFramebuffer(this.tDens.fb); }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.tDens = { tex, fb };
      this.fbW = w; this.fbH = h;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.env) this.init();

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      const hits = this.listen(signals, dt);
      const e = this.env;
      const react = params.react;
      this.T += dt;
      const T = this.T;

      const follow = Math.round(params.follow) === 1;
      const span = Math.max(0.18, e.ceil - e.floor);
      const want = follow ? smooth(0.35, 0.8, (e.lvl - e.floor) / span) : 0;
      e.auto = ease(e.auto, want, want > e.auto ? 1.4 : 0.35, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      const W = ctx.width, H = ctx.height;
      this.N = clamp(Math.round(params.folds), 3, 12);
      const garden = GARDENS[clamp(Math.round(params.garden), 0, GARDENS.length - 1)];

      // ---- the garden's motion: it turns, its centre wanders a little off
      // the middle, and the lattice flows through the mirrors. The bass sets
      // the speeds; nothing moves on the beat.
      const bassK = 1 + 0.9 * e.bass * react;
      this.turnA += dt * P.turn * 0.07 * bassK;
      this.flowT += dt * P.flow * bassK;
      const ft = this.flowT;
      this.off = [0.9 * Math.sin(ft * 0.031 + 0.4) + 0.25 * ft * 0.01, 0.7 * Math.sin(ft * 0.023 + 1.1)];
      const centre = [0.1 * W * Math.sin(T * 0.017 + 0.5), 0.07 * H * Math.sin(T * 0.023)];
      const zoom = 1 + 0.05 * Math.sin(T * 0.011);

      // ---- figure
      if (!this.modes) {
        this.modes = this.targets(P).map((m) => ({ ...m }));
        this.rose = { k: P.fine * 0.9, j: 1, w: P.rose * 1.3, psi: 0 };
      }
      this.since.fig += dt;
      let changed = false;
      if (hits.snareHit && this.since.fig > 3.5 && react > 0) changed = true;
      if (this.since.fig > 11 || this.nextFigure) changed = true;
      if (changed) {
        this.figIdx++;
        this.since.fig = 0;
        this.nextFigure = false;
        // The pebbles are swept away with the old figure.
        for (const pb of this.pebbles) pb.fade = true;
      }
      const tg = this.targets(P);
      for (let i = 0; i < MAXM; i++) {
        const m = this.modes[i], t = tg[i];
        m.n = ease(m.n, t.n, 1.5, dt);
        m.m = ease(m.m, t.m, 1.5, dt);
        m.s = ease(m.s, t.s, 1.5, dt);
        m.a = ease(m.a, t.a, 1.2, dt);
      }
      const R = this.rose;
      R.k = ease(R.k, P.fine * 0.9, 1.5, dt);
      R.j = ease(R.j, this.figIdx % 3 === 2 ? 2 : 1, 1.2, dt);
      R.w = ease(R.w, P.rose * 1.3, 1.5, dt);
      // The rose breathes outward: its rings travel from the centre.
      R.psi += dt * (0.15 + 0.45 * P.flow * (0.5 + 0.8 * e.bass * react));
      let asum = 0;
      for (const m of this.modes) asum += m.a;
      asum += R.w;
      const norm = 1 / Math.max(0.5, asum);

      // Groove count from the dominant mode's quarter wavelength.
      const m0 = this.modes[0];
      const nAvg = Math.max(1.5, 0.5 * (m0.n + m0.m));
      const quarter = (0.5 / nAvg) * PLATE;
      const Ng = clamp(quarter / params.spacing, 1.2, 10);

      // ---- visible radius in wedge space
      const cx = Math.abs(centre[0]) + W / 2, cy = Math.abs(centre[1]) + H / 2;
      const Rmax = (Math.hypot(cx, cy) + 20) / zoom;
      const Rvis = (Math.min(W, H) / 2) / zoom;

      // ---- grains
      const wantA = Math.round(params.sand);
      if (wantA !== this.nA) this.alloc(wantA);
      const n = this.count, nA = this.nA;
      if (this.fresh) {
        for (let i = 0; i < n; i++) this.spawn(i, Rmax);
        this.fresh = false;
      }
      const vib = 0.35 + 0.5 * e.bass * react + 0.3 * P.complexity;
      const gRate = 4.5 * vib;                     // 1/s toward a node
      const gTyp = (Math.PI * nAvg / PLATE) * (Math.PI * nAvg / PLATE) * 0.5;
      const pull = gRate / gTyp;
      const j0 = 0.35 * Math.sqrt(dt * 60) * 0.6;
      const j1 = 5.5 * vib * Math.sqrt(dt);
      const fv = this.fv;
      const gx = this.gx, gy = this.gy, buf = this.buf;
      const Rn = Math.random;
      for (let i = 0; i < n; i++) {
        const useA = i < nA;
        let x = gx[i], y = gy[i];
        this.sample(x, y, useA);
        const f = fv[0];
        let sx = -pull * f * fv[1] * dt, sy = -pull * f * fv[2] * dt;
        const sl = sx * sx + sy * sy;
        if (sl > 9) { const k = 3 / Math.sqrt(sl); sx *= k; sy *= k; }
        const af = f < 0 ? -f : f;
        const j = j0 + j1 * af * af;
        x += sx + j * (Rn() + Rn() - 1);
        y += sy + j * (Rn() + Rn() - 1);
        gx[i] = x; gy[i] = y;
        const r = this.foldInto(i);
        if (r > Rmax) this.spawn(i, Rmax);
        // Grains still dancing on an antinode are drawn faint, so the
        // figure reads and loose sand does not speckle the whole garden.
        const wgt = 1 - 0.8 * smooth(0.08, 0.4, af);
        const k4 = i * 4;
        buf[k4] = gx[i]; buf[k4 + 1] = gy[i];
        buf[k4 + 2] = useA ? wgt : 0;
        buf[k4 + 3] = useA ? 0 : wgt;
      }

      // ---- stones
      const S = this.stone;
      S.check -= dt;
      // While a stone is sinking to change line it is committed: re-picking
      // mid-sink left the breakdown's fine lattice with stones forever
      // half-sunk, flipping between two equally strong antinodes.
      if ((S.check <= 0 || changed) && S.line === S.tline) { this.placeStone(Rvis, quarter); S.check = 0.5; }
      const sRad = clamp(quarter * 0.62, 11, 34);
      if (S.tline !== S.line) {
        // Changing mirror line would split the stone in two as it slid off
        // the mirror, so it sinks into the sand and rises on the other line.
        S.size = ease(S.size, 0, 5, dt);
        if (S.size < 0.05) { S.line = S.tline; S.r = S.tr; }
      } else {
        S.size = ease(S.size, 1, 1.5, dt);
        S.r = ease(S.r, S.tr, 1.3, dt);
      }

      // ---- kick: one pebble into the next petal, and its ripple
      if (hits.kickHit && react > 0) {
        const k = this.kicks++;
        const petal = k % this.N;
        const lap = Math.floor(k / this.N) % 3;
        const a = petal * (TAU / this.N) + Math.PI / (2 * this.N);
        const rr = Rvis * (0.5 + 0.17 * lap);
        const q = [rr * Math.cos(a), rr * Math.sin(a)];
        this.pebbles.push({ x: q[0], y: q[1], age: 0, rad: 5 + 2.5 * Math.random(), seed: Math.random(), vis: 1, fade: false });
        while (this.pebbles.length > MAX_PEB) this.pebbles.shift();
        this.ripples.unshift({ x: q[0], y: q[1], age: -0.12, amp: Math.min(1.3, (0.6 + 0.6 * hits.kAmp) * react) });
        this.ripples.length = Math.min(this.ripples.length, MAX_RIP);
      }
      for (const pb of this.pebbles) {
        pb.age += dt;
        if (pb.fade) pb.vis = ease(pb.vis, 0, 1.6, dt);
      }
      this.pebbles = this.pebbles.filter((pb) => pb.vis > 0.01);
      for (const r of this.ripples) r.age += dt;
      this.ripples = this.ripples.filter((r) => r.age < 2.5);

      // ---- render
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(200, 190, 175);
        p.noStroke(); p.fill(40);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Sand Rose needs WebGL2', W / 2, H / 2);
        return;
      }
      const gl = this.gl;
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      const unitPx0 = Math.min(w, h) / 600;
      // The wedge texture: one texel per device pixel at the widest zoom.
      const extX = (Math.hypot(0.6 * W, 0.57 * H) + 30) / 0.95;
      const extY = extX * Math.sin(Math.PI / this.N) + 4;
      const tw = Math.ceil(extX * unitPx0 * 1.05), th = Math.ceil(extY * unitPx0 * 1.05);
      if (this.fbW !== tw || this.fbH !== th) this.resize(tw, th);
      const unitPx = Math.min(w, h) / 600;
      gl.disable(gl.DEPTH_TEST);

      // Splat every grain into all 2N mirror images.
      const wgt = this.half ? 0.35 : 0.12;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.tDens.fb);
      gl.viewport(0, 0, tw, th);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.pSplat.prog);
      let u = this.pSplat.u;
      gl.uniform1f(u.uN, this.N);
      gl.uniform1f(u.uPs, Math.max(1.2, 1.8 * unitPx * 1.05));
      gl.uniform2f(u.uExt, extX, extY);
      gl.uniform1f(u.w, wgt);
      gl.bindVertexArray(this.vaoGrain);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.grainBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.POINTS, 0, n, 2);
      gl.disable(gl.BLEND);

      // Composite.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.pComp.prog);
      u = this.pComp.u;
      gl.bindVertexArray(this.vaoQuad);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tDens.tex);
      gl.uniform1i(u.uDens, 0);
      gl.uniform2f(u.uExt, extX, extY);
      gl.uniform2f(u.uTexel, 1 / tw, 1 / th);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform2f(u.uCentre, centre[0], centre[1]);
      gl.uniform2f(u.uOff, this.off[0], this.off[1]);
      gl.uniform1f(u.uUnitPx, unitPx);
      gl.uniform1f(u.uRot, this.turnA);
      gl.uniform1f(u.uZoom, zoom);
      gl.uniform1f(u.uN, this.N);
      gl.uniform1f(u.uL, PLATE);
      gl.uniform1f(u.uNorm, norm);
      gl.uniform1f(u.uNg, Ng);
      gl.uniform1f(u.uAmp, params.spacing * 0.22);
      gl.uniform1f(u.uTime, T);
      const mv = new Float32Array(12);
      this.modes.forEach((m, i) => { mv[i * 4] = m.n; mv[i * 4 + 1] = m.m; mv[i * 4 + 2] = m.s; mv[i * 4 + 3] = m.a; });
      gl.uniform4fv(u.uModes, mv);
      gl.uniform4f(u.uRose, R.k, R.j, R.w, R.psi);
      gl.uniform4f(u.uStone, S.r, S.line, sRad, S.size);
      const pv = new Float32Array(MAX_PEB * 4), pd = new Float32Array(MAX_PEB * 4);
      this.pebbles.forEach((pb, i) => {
        // It falls for a tenth of a second: its shadow closes in under it.
        const lift = pb.age < 0.12 ? 60 * (1 - pb.age / 0.12) : 0;
        pv.set([pb.x, pb.y, pb.rad, pb.vis], i * 4);
        pd.set([lift, pb.seed, 0, 0], i * 4);
      });
      gl.uniform4fv(u.uPeb, pv);
      gl.uniform1i(u.uPebN, this.pebbles.length);
      gl.uniform1i(u.uRipN, this.ripples.length);
      gl.uniform4fv(u.uPebDrop, pd);
      const rv = new Float32Array(MAX_RIP * 4), rw = new Float32Array(MAX_RIP).fill(9);
      this.ripples.forEach((r, i) => {
        if (r.age < 0) return;
        const radius = 8 + 150 * (1 - Math.exp(-r.age / 0.7));
        const str = r.amp * Math.min(1, r.age / 0.05) * Math.exp(-r.age / 0.9);
        rv.set([r.x, r.y, radius, str], i * 4);
        // The ring spreads as it travels, so at the end it is a swell in
        // the grooves rather than a thin drawn circle.
        rw[i] = 7 + 16 * Math.min(1, r.age / 1.2);
      });
      gl.uniform4fv(u.uRip, rv);
      gl.uniform1fv(u.uRipW, rw);
      gl.uniform1f(u.uGain, (1 / wgt) * 0.35);
      gl.uniform1f(u.uAccent, clamp01(P.accent));
      gl.uniform1f(u.uSun, clamp01(P.sun));
      gl.uniform1f(u.uHat, Math.min(1, e.hat * 1.5 * react));
      gl.uniform1f(u.uHatSeed, this.hatSeed);
      gl.uniform3fv(u.uSand, garden.sand);
      gl.uniform3fv(u.uInkA, garden.inkA);
      gl.uniform3fv(u.uInkB, garden.inkB);
      gl.uniform3fv(u.uStoneA, garden.stoneA);
      gl.uniform3fv(u.uStoneB, garden.stoneB);
      gl.uniform3fv(u.uSunCol, garden.sun);
      gl.uniform3fv(u.uSkyCol, garden.sky);
      // A low sun from the upper left; it climbs a little as it gets harder.
      const elev = 0.5 - 0.12 * clamp01(P.sun);
      gl.uniform3f(u.uSunDir, -0.72 * Math.cos(elev), 0.69 * Math.cos(elev), Math.sin(elev));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, W, H);
    },
  });
})();
