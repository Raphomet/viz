// Sumi V2 — an ink-wash handscroll unrolling past a boat on a river.
//
// What V2 changes from V1 (web/scenes/sumi.js), after the six-judge panel:
// - The lantern is flat red, like the sun and the seal. V1's additive glow was
//   the one light-on-paper effect in a matte scene and read as a rendering
//   error (curator, purist); the kick now swells a hard-edged paper lantern
//   and lays a broken red streak of its reflection on the water.
// - The boat is nearer and each kick's ring travels far across the river,
//   bending the reflections it passes through, so the beat reads from the back
//   of the room (floor) without anything flashing.
// - The drop is a place (director): the boat enters a gorge of sheer karst
//   pillars that come out of the mist peak-first, in the heaviest ink on the
//   scroll, and the breakdown lets the mist take them back. The frame's weight
//   changes with the track, which answers "too pale for a room" without
//   giving up the paper.
//
// We travel with a small sampan poling downriver (leftward), so the boat holds
// its place on screen and the world unrolls past it with parallax: four
// receding washes of mountains, each dissolving into paper-white mist at its
// base, a low far shore, the river in perspective, and dark pines on the near
// bank sweeping through the foreground. A red sun sits behind the far peaks;
// a red lantern hangs at the boat's prow; a red seal is stamped in the corner.
// Red is the only colour.
//
// Music, each in its own place:
// - kick: the lantern flares and a pair of rings spreads out of the boat's
//   hull across the water, drifting back into its wake. Nothing else moves.
// - snare / clap: a drop of ink lands on the river and spreads as
//   suminagashi (floating-ink marbling): concentric rings that the current
//   slowly warps and diffuses over several seconds.
// - hats: rain. Each hat pocks the river with a fresh scatter of tiny rings.
// - bass: the mist thickens and rises up the mountains, and flows faster.
// - drop: the ink deepens, the sun grows and reddens, the scroll surges
//   forward, a flight of geese crosses the sky, and the seal is re-stamped.
//   The breakdown exhales into thick slow mist.
//
// Craft notes:
// - Ridge lines depend only on x, so they are computed per column in JS into
//   a small float texture (as in Aurora); the shader does the brushwork: a
//   ragged edge whose character varies along the ridge between wet (soft,
//   bled, a dark rim where pigment pooled as it dried) and dry (crisp, with
//   broken texture strokes), and a fade into mist that occludes whatever is
//   behind, the way a painter leaves paper between washes.
// - Ink is density, not colour: the shader accumulates one ink value and maps
//   it between a paper and an ink colour at the end, so the three looks are
//   just three pairs of colours, and a wash over a wash reads as a wash.

(function () {
  const HZ = -112;          // the far shore's waterline, virtual units, y up
  const TEX_STEP = 0.75;    // virtual units per texel
  // The GL layer renders at this fraction of device resolution: ink edges
  // stay soft enough that 0.75 is indistinguishable from full resolution.
  const RES = 0.75;
  const PAR = [0.05, 0.13, 0.27, 0.5];   // mountain layers, far to near
  const PINE_PAR = 1.35;
  const PINE_GAP = 620;     // world units between pine slots on the near bank
  const BOAT_Y = -198;
  const BOAT_S = 2.1;       // boat scale (V1 1.55: a speck from the back of the room)
  // The gorge: karst pillars on their own layer, in front of the near bank.
  const ROWS = [
    { far: true, par: 0.42, gap: 170, empty: 0.35, w0: 18, w1: 26, h0: 120, h1: 150, salt: 500 },
    { far: false, par: 0.8, gap: 330, empty: 0.3, w0: 24, w1: 46, h0: 190, h1: 230, salt: 0 },
  ];
  const NPIL = 10;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D cols;      // row 0: ridge altitude of layers 0..3; row 1: mist-level wander
uniform vec2  texX;          // x of texel 0, 1 / span
uniform vec2  res;
uniform float unitPx, halfW;
uniform float T;             // animation clock (s, music-scaled)
uniform float tw;            // wall clock (s)
uniform float cam;           // camera travel, world units
uniform vec3  paper, paperTop, inkC, red, fgC;
uniform float inkK, drop, mist, rainK;
uniform vec4  layerPar;      // parallax per layer
uniform vec3  sun;           // x, y, radius
uniform float sunK;
uniform vec3  boat;          // x, y, lantern glow
uniform vec4  ring[4];       // screen x, y, age, amp
uniform vec4  bloom[5];      // screen x, y, age, seed
uniform float bloomA[5];
uniform vec4  pine[3];       // screen x, base y, height, seed
uniform float pineA[3];
uniform float hatSeed, hatAge, hat;
uniform vec4  pil[10];        // gorge pillars: screen x, half width, height, seed (height 0 = none)
uniform float gorge;         // 0..1, how far the mist has sunk to reveal the gorge
uniform float lant;          // lantern swell 0..1 (the kick)
uniform float silk;          // 1 on a dark ground: the pillars are painted as silhouettes
out vec4 outColor;

uvec2 hu(vec2 p) {
  uvec2 v = uvec2(ivec2(floor(p)) + 32768) * uvec2(1664525u, 1013904223u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
float h21(vec2 p) { return float(hu(p).x) * (1.0 / 4294967296.0); }
vec2  h22(vec2 p) { return vec2(hu(p)) * (1.0 / 4294967296.0); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fb(vec2 p) { return 0.55 * n2(p) + 0.3 * n2(p * 2.1 + 7.3) + 0.15 * n2(p * 4.3 + 3.1); }

vec4 colAt(float x, float row) {
  return texture(cols, vec2((x - texX.x) * texX.y, (row + 0.5) / 2.0));
}

// One mountain wash. Returns (coverage, ink). Coverage stays 1 where the
// wash has faded into mist, so mist hides the ranges behind it.
vec2 wash(vec2 q, float R, float i, float tone, float par, float mistY) {
  float wx = q.x - cam * par + i * 913.0;
  // Wet and dry passages alternate along the ridge.
  float wet = smoothstep(0.3, 0.7, n2(vec2(wx * 0.006, i * 3.7)));
  float rag = (fb(vec2(wx * 0.07, q.y * 0.05 + i * 5.0)) - 0.5) * mix(7.0, 3.0, wet)
            + (n2(vec2(wx * 0.45, q.y * 0.2 + i)) - 0.5) * mix(3.0, 0.6, wet);
  float d = R + rag - q.y;
  float soft = mix(0.5, 2.6, wet) / unitPx + 0.4;
  float m = smoothstep(-soft, soft, d);
  // Pigment pools at the rim of a wet wash as it dries: a dark edge line.
  float rim = exp(-max(d, 0.0) / mix(2.5, 6.0, wet)) * mix(0.45, 0.85, wet);
  // Texture strokes (cun): long, slightly slanted, broken by the dry brush.
  float cun = fb(vec2(wx * 0.09 + q.y * 0.035, q.y * 0.014 + i * 3.0));
  float dry = smoothstep(0.55, 0.75, n2(vec2(wx * 0.35 + q.y * 0.1, q.y * 0.04 + i * 9.0))) * (1.0 - wet);
  float body = 0.42 + 0.5 * cun - 0.25 * dry;
  // The base dissolves into mist along a wandering line.
  float my = mistY + 22.0 * (fb(vec2(wx * 0.008 - T * 0.03, i * 2.0)) - 0.5);
  float fade = smoothstep(my - 8.0, my + 55.0, q.y);
  float ink = tone * (body * fade + rim * (0.35 + 0.65 * fade));
  // A wet edge bleeds a little outward into the paper.
  float bleed = wet * 0.5 * exp(-max(-d, 0.0) / 4.0) * (1.0 - m) * n2(vec2(wx * 0.12, q.y * 0.12));
  return vec2(max(m, bleed), ink * max(m, bleed * 0.8) / max(max(m, bleed), 1e-3));
}

// The gorge: sheer karst pillars standing in the river, in two rows (a pale
// far row behind a dark near one), painted with slanting axe-cut strokes, a
// dark pooled rim, a shadowed right flank and moss dots (tai dian) along the
// crowns, the painter's shorthand for vegetation. Returns (coverage, ink).
// They are revealed from the top down: the mist line sinks as the gorge
// arrives, so peaks come out of the mist first, the way a painter lets forms
// appear from the paper.
vec2 cliffs(vec2 q) {
  float C = 0.0, I = 0.0;
  float my = mix(HZ + 470.0, HZ + 12.0, gorge);
  for (int j = 0; j < 10; j++) {
    vec4 P = pil[j];
    if (P.z <= 0.0) continue;
    // A negative half width marks the far row.
    float far = step(P.y, 0.0);
    float hw = abs(P.y), H = P.z, s = P.w;
    vec2 p = vec2(q.x - P.x, q.y - HZ);
    if (p.y < -4.0 || p.y > H + 14.0 || abs(p.x) > hw * 2.2 + 30.0) continue;
    float lean = (fract(s * 0.37) - 0.5) * 0.34;
    float x = p.x - lean * p.y * (0.4 + 0.6 * p.y / H);
    // Width: wider at the foot, with bulges and waists up the face.
    float t = clamp(p.y / H, 0.0, 1.0);
    float w = hw * (0.7 + 0.55 * n2(vec2(s, p.y * 0.009))) * (1.0 + 0.3 * (1.0 - t));
    // A rounded crown, off-centre and of varying fullness.
    float cap = hw * (0.7 + 0.8 * fract(s * 1.37));
    float k = clamp(max(p.y - (H - cap), 0.0) / cap, 0.0, 1.0);
    float dome = sqrt(max(1.0 - k * k, 0.0));
    float xo = x - hw * 0.35 * (fract(s * 2.71) - 0.5) * k;
    w *= dome;
    float d = w - abs(xo);
    // Ragged edge, which shrinks toward the crown so the apex stays a curve
    // and does not grow a hair.
    d += ((fb(vec2(p.y * 0.07, s + sign(xo))) - 0.5) * 7.0 + (n2(vec2(p.y * 0.35, s * 3.0 + sign(xo))) - 0.5) * 2.2) * dome;
    // Antialias by the edge's slope in screen space (no fwidth: this runs in
    // divergent control flow, where derivatives are undefined).
    float aa = (0.9 + 4.0 * k * k) / unitPx + 0.35;
    float m = smoothstep(-aa, aa, d);
    // Moss dots on and just outside the crown.
    vec2 dc = vec2(xo, p.y) / 5.5;
    vec2 di = floor(dc);
    vec2 dp = 0.25 + 0.5 * h22(di + s * 17.0);
    float dr = length((fract(dc) - dp) * 5.5);
    float dots = smoothstep(1.9, 1.2, dr) * step(0.62, h21(di + s * 5.0))
               * step(-3.0, d) * step(d, 5.0) * step(H * 0.55, p.y);
    float cover = max(m, dots);
    if (cover <= 0.0) continue;
    float xn = xo / max(w, 1.0);
    // Slanting axe-cut strokes, broken by the dry brush.
    float strokes = fb(vec2(xo * 0.075 + p.y * 0.03 + s, p.y * 0.02 + s * 1.7));
    float dry = smoothstep(0.55, 0.78, n2(vec2(xo * 0.22 + p.y * 0.05 + s, p.y * 0.025)));
    float shade = smoothstep(-0.3, 0.9, xn);
    float ledge = smoothstep(0.8, 0.92, n2(vec2(xo * 0.03 + s, p.y * 0.07 + s)));
    float body = 0.36 + 0.45 * strokes + 0.3 * shade - 0.16 * dry - 0.14 * ledge;
    float rim = exp(-max(d, 0.0) / 3.5) * 0.55 * m;
    float wander = 26.0 * (fb(vec2((q.x - cam * 0.6) * 0.006 - T * 0.03, s * 0.1)) - 0.5);
    float fTop = smoothstep(my + wander - 10.0, my + wander + 60.0, q.y);
    float fade = fTop * smoothstep(8.0, 70.0 + 30.0 * far, p.y);
    float ink = (clamp(body, 0.0, 1.0) * m + rim + dots * 0.95) * fade;
    ink = min(ink, 1.0) * mix(1.0, 0.48, far);
    // On dark silk the "ink" is pale, so dense ink made the pillars glow like
    // bone. There they are dark masses like the boat and pines, lit only at
    // the moonward rim and in faint strokes on the lit flank.
    float inkSilk = ((0.02 + 0.15 * strokes * (1.0 - shade) - 0.03 * dry) * m + rim * 0.8) * fade
                  * mix(1.0, 0.7, far);
    ink = mix(ink, clamp(inkSilk, 0.0, 1.0), silk);
    // Below the sinking mist line a pillar is only a veil over the ranges
    // behind: at full cover its unrevealed body cut crisp paper-white
    // pillar shapes out of the mountains.
    cover *= mix(0.35, 1.0, fTop);
    I = mix(I, ink, cover);
    C = max(C, cover);
  }
  return vec2(C, I);
}

// Land above the water line: returns (ink, sun coverage left visible).
vec2 land(vec2 q) {
  vec4 R = colAt(q.x, 0.0);
  vec4 M = colAt(q.x, 1.0);
  float D = 0.0;
  // Sky: a faint graded wash at the top of the scroll.
  D += 0.1 * smoothstep(60.0, 320.0, q.y) * (0.7 + 0.3 * n2(q * vec2(0.01, 0.03)));
  float S = sunK * smoothstep(sun.z + 1.5, sun.z - 1.5, length(q - sun.xy) + 2.0 * (n2(q * 0.3) - 0.5))
    * (0.82 + 0.18 * fb(q * vec2(0.05, 0.12)));
  float mr = 12.0 + 58.0 * mist;
  vec2 w;
  w = wash(q, R.x, 0.0, 0.26 * inkK, layerPar.x, -40.0 + mr * 1.2 + M.x);
  D = mix(D, w.y, w.x); S *= 1.0 - w.x;
  w = wash(q, R.y, 1.0, 0.46 * inkK, layerPar.y, -80.0 + mr + M.y);
  D = mix(D, w.y, w.x); S *= 1.0 - w.x;
  w = wash(q, R.z, 2.0, 0.7 * inkK, layerPar.z, -105.0 + mr * 0.7 + M.z);
  D = mix(D, w.y, w.x); S *= 1.0 - w.x;
  w = wash(q, R.w, 3.0, 0.95 * inkK, layerPar.w, HZ - 6.0 + mr * 0.1);
  D = mix(D, w.y, w.x); S *= 1.0 - w.x;
  if (gorge > 0.002) {
    // Coverage fades with presence too, or empty pillar shapes would stay
    // behind as paper-white holes in the ranges after the mist took them.
    vec2 g = cliffs(q);
    g.x *= smoothstep(0.0, 0.3, gorge);
    D = mix(D, g.y * 1.02 * inkK, g.x); S *= 1.0 - g.x;
  }
  // Drifting mist wisps lying between the ranges.
  float wx = q.x - cam * 0.2;
  float band = smoothstep(HZ - 5.0, HZ + 30.0, q.y) * (1.0 - smoothstep(40.0 + 60.0 * mist, 150.0 + 60.0 * mist, q.y));
  float wisp = smoothstep(0.4, 0.75, fb(vec2(wx * 0.0045 - T * 0.07, q.y * 0.013 + T * 0.012))) * band;
  D *= 1.0 - wisp * (0.5 + 0.45 * mist);
  return vec2(D, S);
}

// The sampan: hull, arched cover, boatman with a straw hat and pole, lantern.
float boatInk(vec2 q) {
  vec2 p = (q - boat.xy) / BS;
  if (abs(p.x) > 60.0 || p.y < -12.0 || p.y > 40.0) return 0.0;
  float px = 1.0 / (unitPx * BS);
  float u = p.x / 40.0;
  float D = 0.0;
  if (abs(u) < 1.0) {
    float top = 1.5 + 7.0 * pow(abs(u), 5.0) + (u < 0.0 ? 3.0 * u * u : 0.0);
    float bot = -6.5 * (1.0 - u * u) + 1.0;
    float inside = smoothstep(bot - px, bot + px, p.y) * smoothstep(top + px, top - px, p.y);
    D = max(D, inside * (0.8 + 0.15 * n2(p * 0.8)));
  }
  // Arched cover amidships.
  vec2 c = (p - vec2(-6.0, 1.0)) / vec2(15.0, 12.0);
  float cov = smoothstep(1.0 + 0.08, 1.0 - 0.08, length(c)) * step(0.0, c.y);
  D = max(D, cov * (0.55 + 0.25 * n2(p * vec2(1.4, 0.3))));
  // Boatman at the stern, leaning into the pole.
  vec2 b = p - vec2(22.0, 3.0);
  float body = smoothstep(2.6 + px, 2.6 - px, abs(b.x - b.y * 0.18)) * step(0.0, b.y) * step(b.y, 17.0);
  vec2 h = p - vec2(25.2, 22.0);
  float hatS = step(-2.5, h.y) * smoothstep(px, -px, h.y - 5.0 + abs(h.x) * 0.62);
  float pole = smoothstep(0.9 + px, 0.9 - px, abs(dot(p - vec2(24.0, 14.0), normalize(vec2(-0.9, 0.42)))))
             * step(-10.0, p.y) * step(p.y, 28.0) * step(p.x, 44.0);
  D = max(D, max(body, max(hatS, pole)) * 0.9);
  // Lantern post at the prow.
  float post = smoothstep(0.6 + px, 0.6 - px, abs(p.x + 37.0)) * step(4.0, p.y) * step(p.y, 16.0);
  D = max(D, post * 0.8);
  return D;
}

// A pine on the near bank, rising from below the frame.
float pineInk(vec2 q, vec4 P) {
  vec2 p = q - P.xy;
  float H = P.z, s = P.w;
  if (abs(p.x) > 230.0 || p.y > H + 40.0) return 0.0;
  float px = 1.0 / unitPx;
  float t = clamp(p.y / H, 0.0, 1.0);
  float lean = (h21(vec2(s, 1.0)) - 0.5) * 2.0;
  float xc = lean * t * t * H * 0.34 + 14.0 * sin(p.y * 0.017 + s) * t;
  float wT = 13.0 * (1.0 - 0.7 * t) + 1.5;
  float bark = n2(vec2(p.x * 0.6, p.y * 0.08 + s));
  float trunk = smoothstep(wT + px, wT - px, abs(p.x - xc)) * step(p.y, H * 0.97) * (0.72 + 0.28 * bark);
  float D = trunk;
  // Needle pads: flat-bottomed clouds of radiating strokes, alternating sides.
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float py = H * (0.5 + 0.15 * fk);
    float side = (mod(fk + floor(s * 3.0), 2.0) < 1.0 ? -1.0 : 1.0);
    if (k == 3) side = 0.25 * side;
    float tt = py / H;
    float xk = lean * tt * tt * H * 0.34 + 14.0 * sin(py * 0.017 + s) * tt;
    float reach = (45.0 + 45.0 * h21(vec2(s, fk))) * (1.0 - 0.18 * fk);
    vec2 cen = vec2(xk + side * reach, py + 4.0 + 10.0 * h21(vec2(fk, s + 2.0)));
    vec2 ab = vec2((55.0 + 25.0 * h21(vec2(fk, s))) * (1.0 - 0.12 * fk), 19.0 - 1.5 * fk);
    vec2 u = (p - cen) / ab;
    float rr = length(u * vec2(1.0, u.y < 0.0 ? 2.2 : 1.0));
    // A second, smaller clump riding on each pad breaks the disc outline.
    vec2 u2 = (u - vec2((side == 0.0 ? 0.3 : side * 0.4) * (h21(vec2(s, fk + 5.0)) - 0.3), 0.55)) / 0.58;
    rr = min(rr, length(u2 * vec2(1.0, u2.y < 0.0 ? 2.2 : 1.0)));
    float edge = 1.0 + 0.22 * (n2(vec2(atan(u.y, u.x) * 6.0, s + fk)) - 0.5);
    float pad = smoothstep(edge + 0.06, edge - 0.06, rr);
    float ang = atan(u.y + 1.2, u.x);
    float needles = n2(vec2(ang * 42.0, rr * 3.0 + fk * 7.0));
    D = max(D, pad * (0.55 + 0.4 * needles));
    // The branch out to the pad.
    vec2 a = vec2(xk, py - 4.0), bb = cen;
    vec2 pa = p - a, ba = bb - a;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float br = smoothstep(2.8 + px, 2.8 - px, length(pa - ba * hh) - (1.0 - hh) * 2.5);
    D = max(D, br * 0.85);
  }
  return D;
}

void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  float D = 0.0;
  float S = 0.0;          // red coverage
  if (q.y >= HZ) {
    vec2 L = land(q);
    D = L.x; S = L.y;
  } else {
    float d = HZ - q.y;
    float t = clamp(d / (HZ + 300.0), 0.0, 1.0);
    float par = 0.12 + 0.55 * t;
    float wX = q.x - cam * par;
    // Slow ambient chop, larger toward the viewer.
    float amb = (n2(vec2(wX * 0.025, d * 0.22 - tw * 0.35)) - 0.5) * (0.6 + 3.0 * t);
    float wave = 0.0, ringInk = 0.0;
    for (int j = 0; j < 4; j++) {
      vec4 Rg = ring[j];
      if (Rg.w <= 0.0) continue;
      vec2 v = (q - Rg.xy) * vec2(1.0, 3.4);
      float r = length(v);
      // Rings travel far across the river (V1 stopped at ~130 units and was
      // invisible from the back of the room); thin crests, slow fade.
      float rad = 34.0 * BS + 360.0 * (1.0 - exp(-Rg.z * 0.9));
      float fade = exp(-Rg.z * 1.15) * Rg.w * (1.0 + 1.0 * exp(-Rg.z * 5.0));
      float w1 = 2.2 + 1.4 * Rg.z;
      float l1 = exp(-(r - rad) * (r - rad) / (w1 * w1));
      // One echo ring behind the crest (V1 had two; at this travel they
      // stacked into a target).
      float r2 = rad * 0.76;
      float l2 = exp(-(r - r2) * (r - r2) / (w1 * w1 * 0.7)) * 0.55;
      ringInk += (l1 + l2) * fade;
      wave += sin((r - rad) * 0.45) * exp(-abs(r - rad) / 16.0) * fade;
    }
    // The rings bend the reflections they cross, so they read as water
    // moving, not as lines drawn on it.
    float disp = amb + wave * 3.6;
    // Reflection of the shore and ranges, broken by the chop.
    vec2 rq = vec2(q.x + disp * 1.2, HZ + d * 1.05 + disp);
    float Dr = land(rq).x;
    float fres = mix(0.5, 0.12, smoothstep(0.0, 150.0, d));
    D = Dr * fres;
    // Horizontal brush lines of current.
    float s = n2(vec2(wX * 0.01, d * (0.35 - 0.2 * t)));
    float streak = smoothstep(0.66, 0.7, s) * (1.0 - smoothstep(0.72, 0.8, s));
    D = max(D, streak * 0.2 * (0.5 + t) * n2(vec2(wX * 0.08, d)));
    D = max(D, min(ringInk, 1.0) * 0.85);
    // Suminagashi blooms.
    for (int j = 0; j < 5; j++) {
      if (bloomA[j] <= 0.0) continue;
      vec4 B = bloom[j];
      vec2 v = (q - B.xy) * vec2(1.0, 2.6);
      float age = B.z;
      if (abs(v.x) > 150.0 || abs(v.y) > 150.0) continue;
      // The current slowly swirls the rings.
      vec2 wv = v * 0.011 + B.w;
      float sw = 1.0 - exp(-age * 0.45);
      v += (vec2(fb(wv + tw * 0.05), fb(wv + 17.0 - tw * 0.04)) - 0.5) * 120.0 * sw;
      v += (vec2(n2(v * 0.05 + B.w), n2(v * 0.05 - B.w)) - 0.5) * 18.0 * sw;
      v.x /= 1.0 + 0.12 * age;
      float r = length(v);
      float rad = (40.0 + 35.0 * fract(B.w * 7.1)) * (1.0 - exp(-age / 0.45));
      rad *= 1.0 + 0.16 * (n2(normalize(v + 1e-4) * 2.4 + B.w * 3.0) - 0.5);
      float inside = smoothstep(rad + 2.5, rad - 2.5, r);
      float bw = max(rad / 4.5, 2.5);
      float bands = 0.5 + 0.5 * cos(6.2832 * (r - age * 4.0) / bw);
      float blur = smoothstep(0.8, 6.0, age);
      // Thin ink lines on clear water, softening as the ink diffuses.
      float line = mix(pow(bands, 5.0), bands * 0.4, blur);
      float rim = exp(-max(rad - r, 0.0) / 2.5) * inside;
      float ink = inside * (0.07 + 0.55 * line * (0.6 + 0.4 * n2(v * 0.2))) + rim * 0.4;
      ink *= bloomA[j] * exp(-age / 3.2);
      D = max(D, D + ink * (1.0 - D));
    }
    // Rain on the river, re-dealt on each hat.
    vec2 gc = vec2(q.x / 26.0, d / 9.0);
    vec2 gid = floor(gc);
    float on = step(0.78, h21(gid + vec2(hatSeed * 13.0, hatSeed * 7.0)));
    vec2 gp = 0.2 + 0.6 * h22(gid + 3.0);
    vec2 lv = (fract(gc) - gp) * vec2(26.0, 9.0) * vec2(1.0, 3.0);
    float sc = 0.35 + 1.1 * t;
    float rr = length(lv) / sc;
    float rad = 0.8 + 11.0 * hatAge;
    float drip = exp(-(rr - rad) * (rr - rad) / 1.2) * on * hat * (1.0 - smoothstep(0.1, 0.45, hatAge));
    D = max(D, drip * 0.5 * rainK);
    // The sun's reflection, a broken red streak.
    float sx = q.x + disp * 3.0 - sun.x;
    float sunRef = sunK * exp(-sx * sx / (sun.z * sun.z * 0.5)) * exp(-d / 70.0)
                 * smoothstep(0.45, 0.6, n2(vec2(q.x * 0.05, d * 0.5 - tw * 0.4)));
    S = max(S, sunRef * 0.45 * (1.0 - D));
    // The boat's own reflection.
    float bref = boatInk(vec2(q.x + disp, 2.0 * boat.y - q.y - 4.0 + disp * 0.5));
    D = max(D, bref * 0.28);
    // The lantern's reflection: a flat red streak broken by the chop, which
    // lengthens as the lantern swells.
    float lx = q.x + disp * 1.5 - (boat.x - 37.0 * BS);
    float ly = (boat.y - 6.0 * BS) - q.y;
    float lw = (2.2 + 2.6 * lant) * BS;
    float llen = (10.0 + 30.0 * lant) * BS;
    float dash = smoothstep(0.38, 0.5, n2(vec2(q.x * 0.09, ly * 0.55 - tw * 0.6)));
    float lref = smoothstep(lw + 0.8, lw - 0.8, abs(lx) * (1.0 + ly / llen * 0.6))
               * step(0.0, ly) * smoothstep(llen, llen * 0.4, ly) * dash;
    S = max(S, lref * (0.55 + 0.35 * lant));
  }
  // Paper grain modulates every wash.
  D *= 0.88 + 0.24 * n2(q * vec2(1.3, 1.1));
  // Boat and pines are painted in the silhouette colour: in the paper looks
  // that is the ink; on dark silk, pale ink would make them glow like ghosts.
  float F = boatInk(q) * 0.97;
  // Lantern: a flat paper lantern hanging from the prow post, which the kick
  // swells. No glow: V1's additive halo was the one light effect in a matte
  // scene. Flat red, like the sun and the seal, with ink caps and faint ribs.
  float lrad = (2.9 + 3.4 * lant) * BS;
  float lry = lrad / 0.82;
  vec2 lp = q - (boat.xy + vec2(-37.0 * BS, 17.0 * BS - lry - 1.2 * BS));
  float lpx = 0.8 / unitPx;
  float lanternA = smoothstep(lrad + lpx, lrad - lpx, length(lp * vec2(1.0, 0.82)));
  float rib = smoothstep(1.2 * lpx, 0.0, abs(abs(lp.y) - lry * 0.45)) * step(abs(lp.x), lrad * 0.85);
  S = max(S, lanternA * (1.0 - 0.3 * rib));
  float capH = 0.55 * BS;
  float caps = step(abs(lp.x), lrad * 0.45) * step(abs(abs(lp.y) - lry), capH);
  F = max(F, caps * 0.95);
  S *= 1.0 - caps;
  for (int j = 0; j < 3; j++) {
    if (pineA[j] <= 0.0) continue;
    float P = pineInk(q, pine[j]) * pineA[j];
    F = max(F, P);
    S *= 1.0 - P;
  }
  D = clamp(D, 0.0, 1.0);
  // Paper: fibres, and a gentle darkening at the scroll's edges.
  vec2 uv = gl_FragCoord.xy / res;
  vec3 pap = mix(paper, paperTop, smoothstep(-300.0, 300.0, q.y));
  float fib = n2(vec2(q.x * 0.8, q.y * 0.09)) * n2(vec2(q.x * 0.09, q.y * 0.9));
  pap *= 0.975 + 0.045 * fib;
  vec2 e = uv * (1.0 - uv);
  pap *= mix(0.86, 1.0, smoothstep(0.0, 0.06, e.x * e.y * 4.0));
  vec3 col = mix(pap, inkC, D);
  col = mix(col, fgC * (0.9 + 0.2 * n2(q * 0.7)), F);
  col = mix(col, red, clamp(S, 0.0, 1.0) * 0.92);
  outColor = vec4(col, 1.0);
}`;

  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  };
  // paper (bottom), paper (top), ink, accent red, silhouettes (boat, pines)
  const LOOKS = [
    { name: 'Warm paper', c: ['#e9dfc8', '#efe7d3', '#15141a', '#c8321f', '#201e24'] },
    { name: 'Moonlit silk', c: ['#0d1016', '#161b26', '#d7dbe2', '#e0452c', '#03040a'] },
    { name: 'Dusk', c: ['#e7b99a', '#d9d0c9', '#1b1830', '#b8211e', '#1f1b30'] },
  ].map((l) => ({ name: l.name, c: l.c.map(lin), dark: l.name === 'Moonlit silk' }));

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  const h11 = (n) => { const x = Math.sin(n * 127.1 + 17.3) * 43758.5453; return x - Math.floor(x); };
  const n1 = (x) => {
    const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f);
    const a = h11(i); return a + (h11(i + 1) - a) * f;
  };
  const fbm1 = (x) => (0.5 * n1(x) + 0.25 * n1(x * 2.03 + 1.7) + 0.125 * n1(x * 4.01 + 3.1) + 0.0625 * n1(x * 8.1 + 5.3)) / 0.9375;
  const ridge = (x) => { const a = 1 - Math.abs(2 * n1(x) - 1); return a * a; };

  VIZ.register({
    id: 'sumiv2',
    name: 'Sumi',
    versionOf: 'sumi',
    version: 'V2',
    order: 705,

    params: [
      { key: 'look', label: 'Paper', type: 'select', options: LOOKS.map((l) => l.name), default: 1 }, // silk: Raph's choice after seeing V1 (a cream stage floods a dark party room)
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'mist', label: 'Mist', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'ink', label: 'Ink depth', type: 'range', min: 0.5, max: 1.4, default: 1, step: 0.01 },
      { key: 'birds', label: 'Birds', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'rain', label: 'Rain', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'gorge', label: 'Gorge on the drop', type: 'select', options: ['Off', 'On the drop', 'Always'], default: 1 },
    ],

    actions: [],

    gallery: {
      title: 'Sumi',
      technique: 'WebGL2 fragment shader painting ink density (wet/dry-edged mountain washes from a per-column ridge texture, SDF karst pillars revealed by a sinking mist line, mist that occludes, a perspective river whose reflections the kick rings refract, suminagashi blooms, SDF boat, lantern and pines), mapped between a paper and an ink colour; Canvas 2D brush-stroke geese on top',
      brief: 'An ink-wash handscroll unrolling past a small boat poling downriver: four ranges of mountains recede in washes of grey and dissolve into mist, a low shore and dark pines slide by with parallax, a flat red sun sits behind the far peaks. Kick: the flat red paper lantern at the prow swells and its broken reflection lengthens, and a ring travels out from the hull across the river, bending the reflections. Snare: a drop of ink falls on the river and blooms as suminagashi marbling that the current swirls for seconds. Hats: rain pocks the water. Bass: the mist thickens and climbs. Drop: the boat enters a gorge: sheer karst pillars in the darkest ink come out of the mist peak-first and slide past, the sun swells between them, the scroll surges, geese cross and the seal is re-stamped; the breakdown lets the mist take the gorge back.',
      lineage: [
        'V2 of Sumi (web/scenes/sumi.js, batch 03), ranked #5 of 72 by the six-judge panel (2026-09-28). Everything V1 did stays: the scroll, the four washes, the mist, the suminagashi snare, the rain, the pines, geese and seal.',
        'Acted on the curator and purist: the lantern\'s additive glow was the one light effect in a matte scene ("a blurred blob"). It is now a flat red paper lantern with ink caps that the kick swells, and a flat broken streak of red on the water. No glow anywhere.',
        'Acted on the floor ("the kick is too small at distance") and the psychonaut\'s Koi transplant (travelling rings that refract): the boat is 1.35x larger and lower, and each ring now travels out to ~360 units over ~2.5 s and bends the reflections it crosses, instead of stopping at the hull.',
        'Acted on the director\'s "a drop that is a place" (Expressway\'s entry-interior-exit, "Sumi\'s boat could pass through a gorge"): on the drop the mist line sinks from the top of the frame and reveals a gorge of karst pillars peak-first; the breakdown lets it rise back over them. Because the pillars are world-space, every drop is a different stretch of cliffs.',
        'Moonlit silk stays the default (Raph\'s choice after V1, for a dark room; the panel was shown Warm paper, which remains an option). On silk the pillars are painted as dark moonlit silhouettes (near sky-dark bodies, a pale rim, faint strokes on the lit flank), because dense pale ink made them glow like bone.',
        'Rejected the purist\'s visible brush laying the washes: the unrolling scroll is already the gesture, and a brush agent would turn a landscape into a demo of its own making.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.tw = 0;
      this.cam = 0;
      this.speed = 18;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, mist: 0.3, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, flock: 99 };
      this.hatSeed = 0;
      this.rings = [];
      this.blooms = [];
      this.birds = [];
      this.stamp = 0;
      this.wasDrop = false;
      this.gorge = 0;
      this.inGorge = false;
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
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG.replace(/\bHZ\b/g, HZ.toFixed(1)).replace(/\bBS\b/g, BOAT_S.toFixed(2))));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      const u = {};
      for (const n of ['cols', 'texX', 'res', 'unitPx', 'halfW', 'T', 'tw', 'cam', 'paper', 'paperTop', 'inkC',
        'red', 'fgC', 'inkK', 'drop', 'mist', 'rainK', 'layerPar', 'sun', 'sunK', 'boat', 'ring', 'bloom', 'bloomA',
        'pine', 'pineA', 'hatSeed', 'hatAge', 'hat', 'pil', 'gorge', 'lant', 'silk']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      this.tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(u.cols, 0);
      this.texW = 0;
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Onsets against slow baselines, so a pad or riser lifting a whole band
    // does not read as a hit; only a jump does.
    listen(s, dt, push, halfW) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt; since.flock += dt;
      // Kick: band 0 leading band 1, which rejects the bass line's notes.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.rings.unshift({ x: this.boatX + 8, y: BOAT_Y - 4, age: 0, amp: (0.6 + 0.4 * kRaw) * Math.min(push, 1.5) });
        this.rings.length = Math.min(this.rings.length, 4);
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.14));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.6, dt);

      // Snare / clap: band 4 above its own slow floor.
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22 && push > 0.02) {
        since.snare = 0;
        const r = Math.random;
        // Land away from the boat and its wake, somewhere readable.
        let x = (r() * 1.6 - 0.8) * halfW;
        if (Math.abs(x - this.boatX) < 110) x = this.boatX - 150 - r() * 200;
        this.blooms.unshift({ x, y: HZ - 30 - r() * 120, age: 0, seed: r() * 50, amp: Math.min(1.3, (0.7 + 0.3 * sRaw) * push) });
        this.blooms.length = Math.min(this.blooms.length, 5);
      }
      e.prevS = sRaw;

      // Hats: the top band above its floor; each onset is a new scatter of rain.
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
        e.hat = hRaw;
      }
      e.prevH = hRaw;
      e.hat *= Math.exp(-dt / 0.6);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.0, dt);
      // Mist: the low end and the pad, slowly; breakdown pads keep it thick.
      e.mist = ease(e.mist, clamp01(0.15 + (s[1] + s[2] + s[3]) / 240), 0.8, dt);
    },

    ridges(halfW) {
      const margin = 60;
      const x0 = -halfW - margin;
      const N = Math.ceil((2 * (halfW + margin)) / TEX_STEP);
      if (!this.data || this.data.length !== N * 2 * 4) this.data = new Float32Array(N * 2 * 4);
      const D = this.data, cam = this.cam;
      for (let k = 0; k < N; k++) {
        const x = x0 + k * TEX_STEP;
        // Far: tall misty spires.
        const a = x - cam * PAR[0] + 3000;
        const r0 = -45 + 250 * Math.pow(0.62 * ridge(a * 0.0034) + 0.38 * ridge(a * 0.0081 + 2.2), 1.7);
        const b = x - cam * PAR[1] + 5000;
        const r1 = -80 + 185 * Math.pow(0.6 * ridge(b * 0.0048 + 7) + 0.4 * ridge(b * 0.0115 + 1.3), 1.6)
          + 6 * (n1(b * 0.06) - 0.5);
        const c = x - cam * PAR[2] + 9000;
        const r2 = -104 + 120 * Math.pow(0.55 * ridge(c * 0.0062 + 3) + 0.45 * fbm1(c * 0.013), 1.5)
          + 5 * (n1(c * 0.08) - 0.5);
        // Near shore: low banks with round tree clumps.
        const d = x - cam * PAR[3] + 700;
        const bank = 5 + 30 * Math.pow(fbm1(d * 0.006), 2.0);
        const trees = 17 * Math.pow(Math.max(0, n1(d * 0.09) * 2 - 0.9), 1.4) * (0.3 + fbm1(d * 0.004));
        const r3 = HZ + bank + trees;
        const o = k * 4;
        D[o] = r0; D[o + 1] = r1; D[o + 2] = r2; D[o + 3] = r3;
        const o2 = N * 4 + k * 4;
        D[o2] = 30 * (fbm1(a * 0.003 + 11) - 0.5);
        D[o2 + 1] = 30 * (fbm1(b * 0.004 + 21) - 0.5);
        D[o2 + 2] = 25 * (fbm1(c * 0.005 + 31) - 0.5);
        D[o2 + 3] = 0;
      }
      return { x0, N };
    },

    drawBirds(p, ctx, dt, params, inkRGB) {
      const e = this.env;
      const halfW = ctx.width / 2;
      if (e.drop > 0.45 && this.since.flock > 14 && params.birds > 0.01) {
        this.since.flock = 0;
        const r = Math.random;
        const n = Math.round((10 + 12 * r()) * params.birds);
        const lead = { x: halfW + 40, y: 150 + r() * 90 };
        for (let i = 0; i < n; i++) {
          // A loose skein: two arms trailing behind (to the right of) the lead.
          const arm = i % 2 ? 1 : -1;
          const k = Math.ceil(i / 2);
          this.birds.push({
            x: lead.x + k * (22 + 8 * r()), y: lead.y + arm * k * (9 + 5 * r()) + (r() - 0.5) * 8,
            v: 125 + 10 * r(), ph: r() * 6.28, fr: 5.2 + r() * 1.2, sz: 7 + 3 * r(), wob: r() * 6.28,
          });
        }
      }
      if (!this.birds.length) return;
      const g = p.drawingContext;
      g.save();
      g.fillStyle = `rgba(${inkRGB.map((c) => Math.round(c * 255)).join(',')},0.85)`;
      const cy = ctx.height / 2, cx = halfW;
      for (const B of this.birds) {
        B.x -= B.v * dt * (0.7 + 0.3 * params.drift);
        B.ph += B.fr * dt;
        const bx = cx + B.x;
        const by = cy - (B.y + 4 * Math.sin(this.tw * 0.8 + B.wob));
        const s = B.sz;
        const f = Math.sin(B.ph);            // wing beat: -1 down, 1 up
        const tipY = -f * s * 0.55;
        // Each wing is one tapering brush stroke: a thin crescent.
        for (const side of [-1, 1]) {
          const tx = bx + side * s, ty = by + tipY;
          g.beginPath();
          g.moveTo(bx, by);
          g.quadraticCurveTo(bx + side * s * 0.45, by - s * 0.35 - f * s * 0.25, tx, ty);
          g.quadraticCurveTo(bx + side * s * 0.5, by - s * 0.12 - f * s * 0.2, bx, by + s * 0.16);
          g.closePath();
          g.fill();
        }
        g.beginPath();
        g.ellipse(bx - s * 0.15, by + s * 0.02, s * 0.28, s * 0.11, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      this.birds = this.birds.filter((B) => B.x > -halfW - 60);
    },

    drawSeal(p, ctx, redRGB, dt) {
      const e = this.env;
      if (e.drop > 0.5 && !this.wasDrop) this.stamp = 1;
      this.wasDrop = e.drop > 0.5 ? true : e.drop < 0.2 ? false : this.wasDrop;
      this.stamp = Math.max(0, this.stamp - dt * 3);
      const g = p.drawingContext;
      const sz = 34 * (1 + 0.25 * this.stamp * this.stamp);
      const x = ctx.width - 62, y = 44;
      g.save();
      g.translate(x, y);
      g.rotate(-0.03);
      g.globalAlpha = 0.82 + 0.18 * this.stamp;
      g.fillStyle = `rgb(${redRGB.map((c) => Math.round(c * 255)).join(',')})`;
      g.fillRect(-sz / 2, -sz / 2, sz, sz);
      // Carved strokes: an abstract seal-script glyph in the paper's colour.
      g.strokeStyle = this.paperCss;
      g.lineWidth = sz * 0.07;
      g.lineCap = 'square';
      const k = sz / 34;
      g.beginPath();
      g.moveTo(-11 * k, -10 * k); g.lineTo(11 * k, -10 * k);
      g.moveTo(-11 * k, -10 * k); g.lineTo(-11 * k, 11 * k);
      g.moveTo(-4 * k, -4 * k); g.lineTo(11 * k, -4 * k); g.lineTo(11 * k, 11 * k);
      g.moveTo(-4 * k, 3 * k); g.lineTo(5 * k, 3 * k);
      g.moveTo(-4 * k, 11 * k); g.lineTo(5 * k, 11 * k); g.lineTo(5 * k, 3 * k);
      g.moveTo(1 * k, -4 * k); g.lineTo(1 * k, 11 * k);
      g.stroke();
      g.restore();
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const halfW = ctx.width / 2;
      this.boatX = 0.2 * halfW;
      this.listen(signals, dt, push, halfW);
      const e = this.env;

      this.T += dt * (0.5 + 0.8 * e.bass * push + 0.9 * e.drop);
      this.tw += dt;
      // Travel: the music sets the speed and never jerks it. Eased over ~1.5 s
      // so the drop surges and the breakdown glides.
      const cruise = params.drift * (16 + 30 * e.bass * push + 70 * e.drop);
      this.speed = ease(this.speed, cruise, 0.7, dt);
      this.cam += dt * this.speed;

      // The water under the boat moves with it (we drift with the current),
      // so wake rings slide back slowly; blooms drift at their row's rate.
      const waterPar = (y) => 0.12 + 0.55 * clamp01((HZ - y) / (HZ + 300));
      for (const R of this.rings) { R.age += dt; R.x += dt * this.speed * waterPar(R.y) * 0.8; }
      this.rings = this.rings.filter((R) => R.age < 3.5);
      for (const B of this.blooms) { B.age += dt; B.x += dt * this.speed * waterPar(B.y); }
      this.blooms = this.blooms.filter((B) => B.age < 12 && B.x < halfW + 200);

      const w = Math.round(p.width * p.pixelDensity() * RES);
      const h = Math.round(p.height * p.pixelDensity() * RES);
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(230, 222, 200);
        p.noStroke(); p.fill(30);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Sumi needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }

      const { x0, N } = this.ridges(halfW);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      if (this.texW !== N) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, N, 2, 0, gl.RGBA, gl.FLOAT, this.data);
        this.texW = N;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, 2, gl.RGBA, gl.FLOAT, this.data);
      }

      const look = LOOKS[(params.look | 0) % LOOKS.length].c;
      this.paperCss = `rgb(${look[1].map((c) => Math.round(c * 255)).join(',')})`;
      const drop = e.drop;

      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.texX, x0, 1 / (N * TEX_STEP));
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, Math.min(w, h) / 600);
      gl.uniform1f(u.halfW, halfW);
      gl.uniform1f(u.T, this.T % 5000);
      gl.uniform1f(u.tw, this.tw % 5000);
      gl.uniform1f(u.cam, this.cam % 400000);
      gl.uniform3fv(u.paper, look[0]);
      gl.uniform3fv(u.paperTop, look[1]);
      gl.uniform3fv(u.inkC, look[2]);
      gl.uniform3fv(u.red, look[3]);
      gl.uniform3fv(u.fgC, look[4]);
      gl.uniform1f(u.inkK, params.ink * (1 + 0.28 * drop));
      gl.uniform1f(u.drop, drop);
      gl.uniform1f(u.mist, clamp01(e.mist * params.mist * (1 - 0.35 * drop)) * (0.4 + 0.6 * Math.min(params.mist, 1)));
      gl.uniform1f(u.rainK, params.rain);
      gl.uniform4f(u.layerPar, PAR[0], PAR[1], PAR[2], PAR[3]);
      gl.uniform3f(u.sun, -0.42 * halfW - (this.cam * 0.01) % 40, 150, 38 * (1 + 0.3 * drop));
      gl.uniform1f(u.sunK, 0.55 + 0.45 * drop);
      const bob = 1.3 * Math.sin(this.tw * 1.4) + 1.2 * e.kick * push;
      gl.uniform3f(u.boat, this.boatX, BOAT_Y + bob, clamp01(Math.pow(e.kick, 0.7) * push));
      const ring = new Float32Array(16);
      this.rings.forEach((R, i) => ring.set([R.x, R.y, R.age, R.amp], i * 4));
      gl.uniform4fv(u.ring, ring);
      const bl = new Float32Array(20), blA = new Float32Array(5);
      this.blooms.forEach((B, i) => { bl.set([B.x, B.y, B.age, B.seed], i * 4); blA[i] = B.amp; });
      gl.uniform4fv(u.bloom, bl);
      gl.uniform1fv(u.bloomA, blA);
      // Pines: slots every PINE_GAP world units on the near bank; a hash
      // decides whether a slot holds a tree, so they come irregularly.
      const pine = new Float32Array(12), pineA = new Float32Array(3);
      const px0 = this.cam * PINE_PAR;
      const first = Math.floor((px0 - halfW - 200) / PINE_GAP);
      let pi = 0;
      for (let k = first; k <= first + 4 && pi < 3; k++) {
        if (h11(k * 3.7 + 1) < 0.35) continue;
        const sx = k * PINE_GAP + (h11(k * 9.1) - 0.5) * 260 - px0;
        const screenX = -sx;
        if (Math.abs(screenX) > halfW + 250) continue;
        pine.set([screenX, -318, 300 + 170 * h11(k * 5.3), (k % 97) + h11(k) * 10], pi * 4);
        pineA[pi] = 1;
        pi++;
      }
      gl.uniform4fv(u.pine, pine);
      gl.uniform1fv(u.pineA, pineA);
      gl.uniform1f(u.hatSeed, this.hatSeed);
      gl.uniform1f(u.hatAge, this.since.hat);
      gl.uniform1f(u.hat, clamp01(e.hat * push * 1.3));

      // The gorge: entered on the drop (with hysteresis, so a dip in the kick
      // does not let the mist in and out), left at the breakdown. The mist
      // sinks quickly to show it and rises slowly to take it back.
      const gMode = params.gorge | 0;
      if (e.drop > 0.45) this.inGorge = true;
      else if (e.drop < 0.2) this.inGorge = false;
      const gT = gMode === 2 ? 1 : gMode === 1 && this.inGorge ? 1 : 0;
      this.gorge = ease(this.gorge, gT, gT > this.gorge ? 0.9 : 0.35, dt);
      const pil = new Float32Array(4 * NPIL);
      if (this.gorge > 0.002) {
        let n = 0;
        // Far row first, so the near row paints over it. Each row's slots are
        // hashed: some empty, widths and heights varied, so the gorge has a
        // skyline and gaps to see the sun through, not a wall.
        for (const row of ROWS) {
          const gx = this.cam * row.par;
          const k0 = Math.floor((gx - halfW - 260) / row.gap);
          for (let k = k0; k <= k0 + 8 && n < NPIL; k++) {
            const kk = k + row.salt;
            if (h11(kk * 2.31 + 4) < row.empty) continue;
            const sx = gx - (k * row.gap + (h11(kk * 6.7) - 0.5) * row.gap * 0.5);
            const hw = row.w0 + row.w1 * Math.pow(h11(kk * 3.3 + 1), 1.5);
            if (Math.abs(sx) > halfW + hw * 2.2 + 40) continue;
            const H = row.h0 + row.h1 * h11(kk * 1.9 + 7);
            pil.set([sx, row.far ? -hw : hw, H, (kk % 89) + h11(kk * 4.1) * 10], n * 4);
            n++;
          }
        }
      }
      gl.uniform4fv(u.pil, pil);
      gl.uniform1f(u.gorge, this.gorge);
      gl.uniform1f(u.silk, LOOKS[(params.look | 0) % LOOKS.length].dark ? 1 : 0);
      gl.uniform1f(u.lant, clamp01(Math.pow(e.kick, 0.7) * push));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);

      this.drawBirds(p, ctx, dt, params, look[2]);
      this.drawSeal(p, ctx, look[3], dt);
    },
  });
})();
