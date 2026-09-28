// Thresholds V2 — flying forward through a tunnel of successively opening
// doors, where the drop is the door that opens onto light.
//
// V2 (2026-09-28, after the six-judge panel ranked V1 first of 72) keeps V1's
// world and line engine untouched and changes two things; see
// harness/v2/thresholds.md:
// - The held door. V1's doors opened by distance, so the drop landing on a
//   door was luck. Now the build brings the flight to a halt before one shut
//   door, kicks trip its latches one at a time, and the drop blows it open
//   and surges through; the ink inversion starts at that door.
// - The chiaroscuro drop. V1's drop printed black on bare cream, a floodlight
//   in a dark room (the floor judge's one complaint). The drop now prints a
//   coloured tone block under the black, cut back to paper only on lit faces
//   and at the far end of the tunnel, in a different earth ink each drop.
//
// V1's notes follow.
//
// Raph's own sketch (2026-09-28): "flying forward through a tunnel of
// successively opening doors. Gears, machinery, steam. Many different kinds of
// doors mechanically opening before you. ... a black and white drawing, or
// maybe an 'animated woodcut'."
//
// Craft notes:
// - One fragment shader ray-casts an analytic world: a cylinder of radius 1
//   (the tunnel wall) and, every SEG units, a bulkhead plate at z = dz with an
//   aperture in it and a door mechanism behind it. In-plane doors (iris,
//   portcullis, sliding leaves, shutters, segments, a rolling gear) are read
//   straight off the plate's plane; hinged doors (vault, bascule, clamshell)
//   intersect the ray with their rotated leaf plane, so they swing away into
//   real depth. Doors are walked near to far and the first solid thing wins.
// - Every surface reports a TONE (0 paper .. 1 ink), two HATCH COORDINATES in
//   its own object space (radius for concentric cuts, angle for radial cuts on
//   hubs and discs, the across-coordinate for cuts running the length of bars,
//   pistons and pipes) and an EDGE distance. The woodcut is then one function:
//   lines at those coordinates whose width follows tone, a second cut across
//   them in the darks, and outlines from the edge distance. Nothing is ever
//   grey except the anti-aliased edge of a line.
// - Lines are fixed to the objects (no swimming as we fly) but must stay a
//   constant width on screen, so the spacing is chosen per pixel from
//   fwidth(s) in octaves: as a surface recedes, every other line thins away
//   (and its neighbours thicken to keep the tone) before the octave drops.
//   The same trick as an infinite-zoom texture, applied to engraving.
// - Doors are sequenced in JS by distance: latch dogs release (kicks trip them
//   one at a time, distance forces any that are left), a pause, then the
//   main motion with a heavy smootherstep, a 6% overshoot and a damped
//   settle. The plate's drive gear turns with the door's progress, so the
//   motion is visibly driven. In the drop some doors get a second, different
//   mechanism just behind the first, opening a beat later.
// - The music lives in places, never in the whole frame: kick = the next
//   latch snaps out with a starburst and the nearest plate's ratchet advances a
//   tooth; snare = a jet of woodcut steam (metaball puffs with scalloped
//   outlines and contour cuts) from one wall; bass = flight, gear and crank
//   speed, the gauge needles; hats = glints on rivets; the drop = a second
//   stage on doors, more speed, and (by default) the print inverts to white
//   ink on black paper, arriving as a wave that rushes up the tunnel at us.

(function () {
  const SEG = 2.0;       // door spacing along the flight
  const F = 0.82;        // focal length in short-half-side units
  const MAXD = 12;       // doors (and second stages) handed to the shader
  const MAXJ = 6;        // steam jets in flight
  const FAR = 15.0;      // doors are kept out to this depth

  // Mechanisms, in the order the "Door variety" control admits them.
  // shape: 0 circle, 1 arch, 2 rect. hinged doors swing into depth.
  const TYPES = [
    { id: 0, name: 'iris', shape: 0, hinged: false },
    { id: 1, name: 'vault', shape: 0, hinged: true },
    { id: 2, name: 'portcullis', shape: 1, hinged: false },
    { id: 3, name: 'sliding', shape: 1, hinged: false },
    { id: 6, name: 'segments', shape: 0, hinged: false },
    { id: 7, name: 'clamshell', shape: 0, hinged: true },
    { id: 5, name: 'shutter', shape: 2, hinged: false },
    { id: 4, name: 'bascule', shape: 2, hinged: true },
    { id: 8, name: 'gear', shape: 0, hinged: false },
  ];
  const BY_ID = {};
  TYPES.forEach((t) => { BY_ID[t.id] = t; });

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime, uCamW, uLinePx, uGear, uChain, uCrank, uHat, uNeedle;
uniform vec3 uCam;          // camera offset x, y and roll
uniform int uN;
uniform vec4 uDA[${MAXD}];  // dz, type, open, latch
uniform vec4 uDB[${MAXD}];  // roll, seed, latch count (-1 = second stage), shape
uniform vec4 uDC[${MAXD}];  // snap index, snap age, ratchet angle, drive angle
uniform float uDD[${MAXD}]; // ratchet snap age
uniform vec4 uJet[${MAXJ}]; // wall angle, dz, age, strength
uniform vec3 uInk;          // invert front depth, near mode, far mode
uniform vec3 uTint;         // the chiaroscuro tone block's ink
uniform float uTintAmt;     // 0 = pure two-ink print, 1 = tone block printed
out vec4 outColor;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float SEG = ${SEG.toFixed(2)};
const float F = ${F.toFixed(3)};
const vec2 LDIR = vec2(-0.6, 0.8);

// The surface record every shading function fills in.
float gT, gS1, gS2, gE, gW, gB, gZ;

float h11(float x) { return fract(sin(x * 127.1 + 3.7) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

void setS(float T, float s1, float s2, float E) { gT = T; gS1 = s1; gS2 = s2; gE = E; gW = 0.0; gB = 0.0; }

// ---------------------------------------------------------------- parts
// A rivet: a dome lit from upper left, so each one carries a black crescent.
bool rivet(vec2 d, float r) {
  float l = length(d);
  if (l > r) return false;
  float sh = dot(d / r, normalize(LDIR));
  setS(0.45 - 0.55 * sh, l, atan(d.y, d.x) * r, r - l);
  if (sh > 0.25) gW = 1.0;
  return true;
}

// A glint on a rivet: a four-point star cut white, for hats.
float star(vec2 d, float s) {
  if (s <= 0.0) return 0.0;
  vec2 a = abs(d) / s;
  float k = max(1.0 - a.x / 0.1 - a.y, 1.0 - a.y / 0.1 - a.x);
  float k2 = 1.0 - length(d) / (0.28 * s);
  return step(0.0, max(k, k2));
}

// A spur gear centred at c (local), pitch radius r, n teeth, turned by ang.
// Spokes and solid black lightening holes; radial cuts on the web that turn
// with it, concentric cuts on rim and hub.
bool gear(vec2 c, float r, float n, float ang) {
  float rr = length(c);
  float td = r * 0.085 + 0.004;
  if (rr > r + td) return false;
  float a = atan(c.y, c.x) - ang;
  float ft = fract(a * n / TAU) - 0.5;
  float prof = clamp((0.3 - abs(ft)) * 6.0, 0.0, 1.0);
  float rEdge = r - td + 2.0 * td * prof;
  if (rr > rEdge) return false;
  float sh = dot(c / max(rr, 1e-4), normalize(LDIR));
  float E = rEdge - rr;
  if (rr < 0.12 * r) { setS(1.0, rr, 0.0, E); gB = 1.0; return true; }
  if (rr < 0.3 * r) { setS(0.2 - 0.25 * sh, rr, a * 0.1, min(0.3 * r - rr, rr - 0.12 * r)); return true; }
  float rimIn = r - 2.6 * td;
  if (rr < rimIn) {
    float sp = TAU / 5.0;
    float sa = mod(a, sp) - 0.5 * sp;
    float across = abs(sin(sa)) * rr;
    float wdt = 0.09 * r + 0.05 * (rr - 0.3 * r);
    if (across > wdt) { setS(1.0, rr, 0.0, min(across - wdt, min(rimIn - rr, rr - 0.3 * r))); gB = 1.0; return true; }
    setS(0.3 - 0.3 * sh, sin(sa) * rr, rr, min(wdt - across, min(rimIn - rr, rr - 0.3 * r)));
    return true;
  }
  setS(0.38 - 0.35 * sh, rr, a * r * 0.35, min(E, rr - rimIn));
  return true;
}

float meshRot(float rot1, float n1, float n2, float psi) {
  return psi + PI + (psi - rot1) * (n1 / n2) - PI / n2;
}

// The snap of a released mechanism: a white core and ten black rays that
// fly outward and thin away over 0.4 s. Returns true if it painted.
float gBurstScale = 1.0;
float gRatchetAge = 9.0;
bool burst(vec2 bd, float age) {
  if (age > 0.4 || age < 0.0) return false;
  float k = age / 0.4;
  float bl = length(bd) / gBurstScale;
  if (bl > 0.12 + 0.5 * sqrt(k)) return false;
  float ba = atan(bd.y, bd.x);
  float ray = abs(fract(ba * 10.0 / TAU) - 0.5) * bl * TAU / 10.0;
  if (bl < 0.1 * (1.0 - k)) { setS(0.0, bl, 0.0, 1.0); gW = 1.0; return true; }
  if (ray < 0.03 * (1.0 - k) + 0.005 && bl > 0.06 + 0.22 * k) { setS(1.0, 0.0, 0.0, 0.0); gB = 1.0; return true; }
  return false;
}

// ---------------------------------------------------------------- apertures
float apSDF(vec2 q, float shape) {
  if (shape < 0.5) return length(q) - 0.6;
  if (shape < 1.5) {
    if (q.y > 0.12) return length(q - vec2(0.0, 0.12)) - 0.5;
    return max(abs(q.x) - 0.5, -q.y - 0.62);
  }
  vec2 d = abs(q) - vec2(0.5, 0.42);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.08;
}

// ---------------------------------------------------------------- doors
bool iris(vec2 q, float o, float L) {
  float seg = TAU / 9.0;
  float r = length(q);
  float spin = o * 1.3 + L * 0.07;
  float th = atan(q.y, q.x) - spin;
  float ro = 0.66 * o;
  float m = mod(th, seg) - 0.5 * seg;
  float rEdge = ro * cos(0.5 * seg) / cos(m);
  if (r < rEdge) return false;
  float phi = th + 2.6 * (r - ro);
  float bc = phi / seg;
  float bf = fract(bc);
  float bi = mod(floor(bc), 9.0);
  float T = 0.14 + 0.62 * bf + 0.1 * h11(bi);
  float E = min(min(bf, 1.0 - bf) * seg * r * 0.4, (r - rEdge) * cos(m));
  setS(T, r, phi * 0.3, E);
  if (bf > 0.06 && bf < 0.1) gW = 1.0;          // the lit lip of each blade
  float pa = (floor(bc) + 0.5) * seg - 2.6 * (0.55 - ro) + spin;
  if (rivet(q - 0.55 * vec2(cos(pa), sin(pa)), 0.022)) return true;
  return true;
}

bool vaultFace(vec2 c, float o, float L, float nL, float phi) {
  float rr = length(c);
  if (rr > 0.635) return false;
  float ang = atan(c.y, c.x);
  float swing = 0.4 * sin(phi);
  float nb = max(nL, 2.0) * 2.0;
  float bw = TAU / nb;
  float bi = floor(ang / bw + 0.5);
  vec2 bl = rot(c, -bi * bw);
  float ret = clamp(L - mod(bi, max(nL, 1.0)), 0.0, 1.0);
  float b0 = 0.36 - 0.14 * ret, b1 = 0.6 - 0.14 * ret;
  if (abs(bl.y) < 0.036 && bl.x > b0 && bl.x < b1) {
    float yn = bl.y / 0.036;
    setS(0.15 + 0.6 * yn * yn + 0.3 * smoothstep(0.0, 1.0, -yn) + swing, bl.y, bl.x, min(0.036 - abs(bl.y), min(bl.x - b0, b1 - bl.x)));
    if (bl.x > b1 - 0.035) gB = 1.0;
    return true;
  }
  if (abs(bl.y) < 0.055 && bl.x > 0.3 && bl.x < 0.5) {
    setS(0.75 + swing, bl.x, bl.y, min(0.055 - abs(bl.y), min(bl.x - 0.3, 0.5 - bl.x)));
    return true;
  }
  if (rr < 0.075) { setS(1.0, rr, 0.0, 0.075 - rr); gB = 1.0; return true; }
  vec2 wc = rot(c, -(L * 0.9 + o * 1.2));
  float wa = atan(wc.y, wc.x);
  if (abs(rr - 0.25) < 0.024) {
    setS(0.22 + swing - 0.2 * dot(c / rr, normalize(LDIR)), wa * 0.25, rr, 0.024 - abs(rr - 0.25));
    return true;
  }
  float sa = mod(wa + PI / 4.0, PI / 2.0) - PI / 4.0;
  if (rr < 0.26 && abs(sin(sa)) * rr < 0.02) {
    setS(0.3 + swing, sin(sa) * rr, rr, 0.02 - abs(sin(sa)) * rr);
    return true;
  }
  if (rr > 0.55) {
    setS(0.55 + swing, rr, ang * 0.3, min(rr - 0.55, 0.635 - rr));
    float ri = floor(ang / (TAU / 24.0) + 0.5);
    vec2 rc = 0.593 * vec2(cos(ri * TAU / 24.0), sin(ri * TAU / 24.0));
    rivet(c - rc, 0.016);
    return true;
  }
  float sh = dot(c / max(rr, 1e-3), normalize(LDIR));
  setS(0.3 - 0.2 * sh + swing, rr, ang * 0.3, min(rr - 0.075, 0.55 - rr));
  return true;
}

bool portcullis(vec2 q, float o) {
  vec2 p = q - vec2(0.0, o * 1.45);
  float hw = 0.03;
  float xi = floor(p.x / 0.19 + 0.5);
  float dx = p.x - xi * 0.19;
  float tip = -0.66 - 0.1 * (1.0 - abs(dx) / hw);
  if (abs(dx) < hw && p.y > tip) {
    float xn = dx / hw;
    setS(0.1 + 0.6 * smoothstep(-0.3, 1.0, xn) + 0.15 * xn * xn, dx, p.y, min(hw - abs(dx), (p.y - tip) * 0.3));
    float yi = floor((p.y + 0.5) / 0.23 + 0.5);
    if (yi >= 0.0 && rivet(vec2(dx, p.y + 0.5 - yi * 0.23), 0.017)) return true;
    return true;
  }
  float yi = floor((p.y + 0.5) / 0.23 + 0.5);
  float dy = p.y + 0.5 - yi * 0.23;
  if (yi >= 0.0 && abs(dy) < 0.024) {
    float yn = dy / 0.024;
    setS(0.2 + 0.55 * smoothstep(-0.4, 1.0, -yn), dy, p.x, 0.024 - abs(dy));
    return true;
  }
  return false;
}

bool sliding(vec2 q, float o) {
  float off = o * 0.66;
  float seam = 0.045 * (abs(fract(q.y * 5.0) - 0.5) * 4.0 - 1.0);
  float xl = q.x + off, xr = q.x - off;
  bool lft = xl < seam, rgt = xr > seam;
  if (!lft && !rgt) return false;
  float x = lft ? xl : xr;
  float side = lft ? -1.0 : 1.0;
  float edge = abs(x - seam);
  float pf = fract((q.y + 0.7) / 0.125);
  float pi_ = floor((q.y + 0.7) / 0.125);
  float E = min(edge, min(pf, 1.0 - pf) * 0.125);
  if (edge < 0.07) { setS(0.62, x, q.y, E); return true; }       // toothed iron edge
  float sx = abs(x - side * 0.3);
  if (sx < 0.045) {                                                // iron strap
    setS(0.72, x, q.y, min(0.045 - sx, E));
    float ry = fract((q.y + 0.7) / 0.125 + 0.5) - 0.5;
    rivet(vec2(x - side * 0.3, ry * 0.125), 0.017);
    return true;
  }
  float br = abs((x - side * 0.3) * 0.9 - side * (q.y + 0.1) * 0.6);
  if (br < 0.035 && abs(x) > 0.07) { setS(0.55, br, q.y, min(0.035 - br, E)); return true; }
  setS(0.22 + 0.22 * h11(pi_ * 3.1 + side) + 0.4 * (1.0 - smoothstep(0.0, 0.25, pf)), q.y, x, E);
  return true;
}

bool shutter(vec2 q, float o) {
  float a1 = clamp(o * 1.7, 0.0, 1.0);
  float phi = a1 * 1.42;
  float a2 = clamp(o * 1.7 - 0.7, 0.0, 1.0);
  float h = 0.1;
  float i = floor((q.y + 0.5) / h);
  if (i < 0.0 || i > 9.0) return false;
  float dy = q.y - ((i + 0.5) * h - 0.5);
  float hh = 0.5 * h * cos(phi) + 0.003;
  if (abs(dy) > hh) return false;
  float dir = mod(i, 2.0) < 0.5 ? -1.0 : 1.0;
  float xs = q.x - dir * a2 * a2 * 1.3;
  if (abs(xs) > 0.62) return false;
  float yn = dy / hh;
  setS(0.12 + 0.55 * sin(phi) + 0.35 * smoothstep(0.0, 1.0, -yn), dy, xs, min(hh - abs(dy), 0.62 - abs(xs)));
  if (abs(xs - 0.36) < 0.014) { gB = 1.0; }                          // tilt rod
  if (abs(xs + 0.55) < 0.03) { gT = 0.8; }
  return true;
}

bool segments(vec2 q, float o, float L) {
  float seg = TAU / 6.0;
  vec2 p = rot(q, -(o * 0.9 + L * 0.09));
  float ang = atan(p.y, p.x);
  float i = floor(ang / seg);
  float bis = (i + 0.5) * seg;
  vec2 pl = p - vec2(cos(bis), sin(bis)) * o * 0.8;
  float r = length(pl);
  float da = atan(pl.y, pl.x) - bis;
  da = mod(da + PI, TAU) - PI;
  if (abs(da) > 0.5 * seg || r > 0.66) return false;
  float sideD = r * sin(0.5 * seg - abs(da)) - 0.007;
  if (sideD < 0.0) return false;
  float E = min(sideD, 0.66 - r);
  float odd = mod(i + 6.0, 2.0);
  if (r < 0.09 && o < 0.25) { setS(1.0, r, 0.0, E); gB = 1.0; return true; }
  if (r > 0.53) {
    setS(0.5 + 0.2 * odd, r, da * r, min(E, r - 0.53));
    float ri = floor(da / 0.12 + 0.5);
    vec2 rc = 0.595 * vec2(cos(ri * 0.12), sin(ri * 0.12));
    rivet(rot(pl, -bis) - rc, 0.016);
    return true;
  }
  setS(0.2 + 0.35 * odd + 0.25 * da / (0.5 * seg), da * 0.55, r, E);
  return true;
}

bool gearDoor(vec2 q, float o, float L) {
  float tx = o * 1.4;
  float ra = -tx / 0.62 + L * 0.1;
  vec2 c = rot(q - vec2(tx, 0.0), -ra);
  float r = length(c);
  float a = atan(c.y, c.x);
  float ft = fract(a * 24.0 / TAU) - 0.5;
  float rEdge = 0.6 + 0.07 * clamp((0.28 - abs(ft)) * 6.0, 0.0, 1.0);
  if (r > rEdge) return false;
  float hi = floor(a / (TAU / 5.0) + 0.5);
  vec2 hc = 0.35 * vec2(cos(hi * TAU / 5.0), sin(hi * TAU / 5.0));
  float hd = length(c - hc) - 0.12;
  if (hd < 0.0) return false;                                      // see-through holes
  float sh = dot(c / max(r, 1e-3), normalize(LDIR));
  if (r < 0.045) { setS(1.0, r, 0.0, 0.0); gB = 1.0; return true; }
  if (r < 0.13) { setS(0.18 - 0.2 * sh, r, a * 0.1, min(0.13 - r, r - 0.045)); return true; }
  if (r > 0.52) { setS(0.45 - 0.3 * sh, r, a * 0.3, min(rEdge - r, r - 0.52)); return true; }
  setS(0.32 - 0.3 * sh, a * 0.42, r, min(min(hd, r - 0.13), 0.52 - r));
  return true;
}

bool clamLeaf(vec2 uv, float phi, float side) {
  vec2 c = vec2(uv.x - 0.6, uv.y);
  if (length(c) > 0.635) return false;
  float g = 0.03 * sin(uv.y * 18.0);
  float lim = 0.6 + side * g;
  if (uv.x > lim) return false;
  float ang = atan(uv.y, uv.x + 0.08);
  float rib = cos(ang * 13.0);
  float E = min(0.635 - length(c), lim - uv.x);
  setS(0.42 - 0.32 * rib + 0.4 * sin(phi), ang * 0.45, length(uv), E);
  if (uv.x < 0.05) { gT = 0.9; gS1 = uv.x; }
  if (uv.x > lim - 0.04) { gT = 0.08 + 0.4 * sin(phi); gS1 = uv.x; }
  return true;
}

bool basLeaf(vec2 uv, float phi, float side) {
  float lim = 0.42 + 0.08 + side * 0.02 * (abs(fract(uv.y * 6.0) - 0.5) * 4.0 - 1.0);
  if (uv.x > lim || abs(uv.y) > 0.62) return false;
  float pf = fract((uv.y + 0.62) / 0.124);
  float E = min(min(pf, 1.0 - pf) * 0.124, lim - uv.x);
  float sw = 0.15 * sin(phi);
  if (abs(uv.x - 0.14) < 0.04 || abs(uv.x - 0.36) < 0.04) {
    float dx = uv.x < 0.25 ? uv.x - 0.14 : uv.x - 0.36;
    setS(0.75 + sw, dx, uv.y, min(0.04 - abs(dx), E));
    float ry = fract((uv.y + 0.62) / 0.124 + 0.5) - 0.5;
    rivet(vec2(dx, ry * 0.124), 0.017);
    return true;
  }
  setS(0.25 + 0.25 * h11(floor((uv.y + 0.62) / 0.124) + side * 5.0) + 0.35 * smoothstep(0.7, 1.0, pf) + sw, uv.y, uv.x, E);
  return true;
}

// A leaf hinged on the line x = h (or y = h if swap) of its plate, swung by
// phi away from us. Returns the hit depth and the leaf's own coordinates:
// u away from the hinge, v along it.
bool hinge(vec2 ol, vec2 rl, float dz, float h, float sx, float phi, bool swp, out vec2 uv, out float z) {
  if (swp) { ol = ol.yx; rl = rl.yx; }
  float ex = sx * cos(phi), ez = sin(phi);
  float den = ex - ez * rl.x;
  z = 0.0; uv = vec2(0.0);
  if (abs(den) < 1e-5) return false;
  z = (ex * dz + ez * (ol.x - h)) / den;
  if (z < 0.02) return false;
  vec2 X = ol + rl * z;
  uv = vec2(ex * (X.x - h) + ez * (z - dz), X.y);
  return uv.x >= 0.0;
}

// ---------------------------------------------------------------- plate
bool plate(vec2 q, float shape, float nL, vec4 C, float seed) {
  float r = length(q);
  float th = atan(q.y, q.x);
  float ap = apSDF(q, shape);
  if (nL >= 0.0) {
    // drive gear and pinion (turned by the door's progress), ratchet (by kicks)
    vec2 rc0 = 0.8 * vec2(cos(PI - 0.92), sin(PI - 0.92));
    if (burst(q - rc0 - vec2(0.0, 0.03), gRatchetAge)) return true;
    vec2 gc = 0.8 * vec2(cos(0.92), sin(0.92));
    if (gear(q - gc, 0.12, 12.0, C.w)) return true;
    float psi = 0.92 + PI * 0.5 + 0.35;
    vec2 pc = gc + 0.19 * vec2(cos(psi), sin(psi));
    if (gear(q - pc, 0.07, 7.0, meshRot(C.w, 12.0, 7.0, psi))) return true;
    vec2 rc = 0.8 * vec2(cos(PI - 0.92), sin(PI - 0.92));
    vec2 rq = q - rc;
    float rr = length(rq);
    if (rr < 0.135) {
      float a = atan(rq.y, rq.x) - C.z;
      float ft = fract(a * 10.0 / TAU);
      float rEdge = 0.1 + 0.035 * ft;
      // pawl: a black lever resting in the teeth from above
      vec2 pv = rq - vec2(0.03, 0.165);
      vec2 pd = rot(pv, 0.9);
      if (abs(pd.y) < 0.014 && pd.x > -0.1 && pd.x < 0.02) { setS(1.0, pd.y, 0.0, 0.0); gB = 1.0; return true; }
      if (rr < rEdge) {
        if (rr < 0.03) { setS(1.0, rr, 0.0, 0.0); gB = 1.0; return true; }
        setS(0.3 - 0.3 * dot(rq / rr, normalize(LDIR)), a * 0.12, rr, min(rEdge - rr, rr - 0.03));
        return true;
      }
    }
  }
  if (ap < 0.065) {
    setS(0.1 + 0.15 * dot(normalize(q), normalize(LDIR)), ap, th * 0.3, min(ap, 0.065 - ap));
    if (shape < 0.5) {
      float ri = floor(th / (TAU / 26.0) + 0.5);
      vec2 rc = 0.632 * vec2(cos(ri * TAU / 26.0), sin(ri * TAU / 26.0));
      if (rivet(q - rc, 0.014)) {
        float g = step(h21(vec2(ri + seed * 31.0, floor(uTime * 14.0))), uHat * 0.35);
        if (g > 0.0) { gW = 1.0; gB = 0.0; }
      }
    }
    return true;
  }
  if (r > 0.9) {
    setS(0.6, r, th * 0.3, min(r - 0.9, 1.0 - r));
    float ri = floor(th / (TAU / 34.0) + 0.5);
    vec2 d = q - 0.95 * vec2(cos(ri * TAU / 34.0), sin(ri * TAU / 34.0));
    float g = step(h21(vec2(ri + seed * 17.0, floor(uTime * 14.0))), uHat * 0.4);
    if (g > 0.0 && star(d, 0.07) > 0.0) { setS(0.0, r, 0.0, 1.0); gW = 1.0; return true; }
    rivet(d, 0.018);
    return true;
  }
  setS(0.26 - 0.12 * dot(q, normalize(LDIR)), r, th * 0.35, min(ap - 0.065, 0.9 - r));
  return true;
}

// Latch dogs: bars that clamp the leaf across the aperture edge and slide
// out into their housings on the plate when released.
bool dogs(vec2 q, float shape, float nL, float L, vec4 C) {
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    if (fj >= nL) break;
    vec2 P, n;
    if (shape < 0.5) {
      float a = -PI * 0.5 + (fj - (nL - 1.0) * 0.5) * 0.8;
      n = vec2(cos(a), sin(a)); P = 0.6 * n;
    } else {
      float sd = mod(fj, 2.0) < 0.5 ? -1.0 : 1.0;
      float hw = shape < 1.5 ? 0.5 : 0.58;
      P = vec2(sd * hw, -0.35 + 0.34 * floor(fj * 0.5));
      n = vec2(sd, 0.0);
    }
    vec2 d = q - P;
    float u = dot(d, n), v = dot(d, vec2(-n.y, n.x));
    float ret = clamp(L - fj, 0.0, 1.0);
    // the snap: a starburst where the dog has just let go
    if (abs(C.x - fj) < 0.5 && burst(vec2(u + 0.02, v), C.y)) return true;
    float b0 = -0.09 + 0.2 * ret, b1 = 0.14 + 0.2 * ret;
    if (abs(v) < 0.034 && u > b0 && u < b1) {
      float vn = v / 0.034;
      setS(0.12 + 0.6 * vn * vn + 0.25 * smoothstep(0.0, 1.0, vn), v, u, min(0.034 - abs(v), min(u - b0, b1 - u)));
      if (u < b0 + 0.03) gB = 1.0;
      return true;
    }
    if (abs(v) < 0.055 && u > 0.08 && u < 0.36) {
      setS(0.78, u, v, min(0.055 - abs(v), min(u - 0.08, 0.36 - u)));
      return true;
    }
  }
  return false;
}

// One door (plate + mechanism). z returns the hit depth.
bool door(int i, vec2 o, vec2 rd, out float z) {
  vec4 A = uDA[i], B = uDB[i], C = uDC[i];
  float dz = A.x, type = A.y, op = A.z, L = A.w;
  vec2 ol = rot(o, -B.x), rl = rot(rd, -B.x);
  vec2 q = ol + rl * dz;
  z = dz;
  // A snap far down the tunnel is cut larger, so every kick reads at a glance.
  gBurstScale = clamp(dz * 0.5, 1.0, 2.2);
  gRatchetAge = uDD[i];
  if (dz > 0.02) {
    // the vault's bolts are its latches; every other door has dogs on its plate
    if (B.z > 0.0 && abs(type - 1.0) > 0.5 && dogs(q, B.w, B.z, L, C)) return true;
    if (apSDF(q, B.w) > 0.0) return plate(q, B.w, B.z, C, B.y);
    if (type < 0.5) return iris(q, op, L);
    if (abs(type - 2.0) < 0.5) return portcullis(q, op);
    if (abs(type - 3.0) < 0.5) return sliding(q, op);
    if (abs(type - 5.0) < 0.5) return shutter(q, op);
    if (abs(type - 6.0) < 0.5) return segments(q, op, L);
    if (abs(type - 8.0) < 0.5) return gearDoor(q, op, L);
  }
  vec2 uv; float zz;
  if (abs(type - 1.0) < 0.5) {
    float phi = op * 1.75;
    if (hinge(ol, rl, dz + 0.02, -0.6, 1.0, phi, false, uv, zz) && vaultFace(vec2(uv.x - 0.6, uv.y), op, L, B.z, phi)) { z = zz; return true; }
    return false;
  }
  if (abs(type - 7.0) < 0.5) {
    float pL = op * 1.6, pR = clamp(op * 1.2 - 0.12, 0.0, 1.0) * 1.6;
    bool hit = false; float best = 1e9;
    float sT = gT, s1 = gS1, s2 = gS2, sE = gE, sW = gW, sB = gB;
    if (hinge(ol, rl, dz + 0.02, -0.6, 1.0, pL, false, uv, zz) && clamLeaf(uv, pL, 1.0)) { best = zz; hit = true; sT = gT; s1 = gS1; s2 = gS2; sE = gE; sW = gW; sB = gB; }
    if (hinge(ol, rl, dz + 0.02, 0.6, -1.0, pR, false, uv, zz) && zz < best && clamLeaf(uv, pR, -1.0)) { best = zz; hit = true; sT = gT; s1 = gS1; s2 = gS2; sE = gE; sW = gW; sB = gB; }
    gT = sT; gS1 = s1; gS2 = s2; gE = sE; gW = sW; gB = sB;
    z = best; return hit;
  }
  if (abs(type - 4.0) < 0.5) {
    float pT = op * 1.5, pB = clamp(op * 1.2 - 0.1, 0.0, 1.0) * 1.45;
    bool hit = false; float best = 1e9;
    float sT = gT, s1 = gS1, s2 = gS2, sE = gE, sW = gW, sB = gB;
    if (hinge(ol, rl, dz + 0.02, 0.5, -1.0, pT, true, uv, zz) && basLeaf(uv, pT, 1.0)) { best = zz; hit = true; sT = gT; s1 = gS1; s2 = gS2; sE = gE; sW = gW; sB = gB; }
    if (hinge(ol, rl, dz + 0.02, -0.5, 1.0, pB, true, uv, zz) && zz < best && basLeaf(uv, pB, -1.0)) { best = zz; hit = true; sT = gT; s1 = gS1; s2 = gS2; sE = gE; sW = gW; sB = gB; }
    gT = sT; gS1 = s1; gS2 = s2; gE = sE; gW = sW; gB = sB;
    z = best; return hit;
  }
  return false;
}

// ---------------------------------------------------------------- walls
bool wallGears(float a, float wl, float k, bool left) {
  float hk = h11(k * 3.7 + (left ? 1.0 : 2.0));
  if (hk > 0.85) return false;
  if (hk > 0.45) wl = SEG - wl;
  float ph = uGear * (left ? 1.0 : -1.0) + k * 0.7;
  vec2 c1 = left ? vec2(3.2, 0.72) : vec2(-0.08, 1.2);
  float r1 = left ? 0.45 : 0.5, n1 = left ? 16.0 : 18.0;
  float psi = left ? 0.95 : -2.0;
  float r2 = left ? 0.25 : 0.2, n2 = left ? 9.0 : 7.0;
  vec2 c2 = c1 + (r1 + r2) * vec2(cos(psi), sin(psi));
  float rot1 = ph / r1 * 0.3;
  float rot2 = meshRot(rot1, n1, n2, psi);
  vec2 p = vec2(a, wl);
  if (gear(p - c1, r1, n1, rot1)) return true;
  if (gear(p - c2, r2, n2, rot2)) return true;
  if (left) {
    float psi3 = -0.2;
    vec2 c3 = c2 + (0.25 + 0.17) * vec2(cos(psi3), sin(psi3));
    if (gear(p - c3, 0.17, 6.0, meshRot(rot2, 9.0, 6.0, psi3))) return true;
  }
  return false;
}

bool engine(float a, float wl, float k) {
  float a0 = 0.75;
  float ph = uCrank + k * 1.7;
  vec2 fc = vec2(a0, 1.5);
  float rc = 0.16, Lc = 0.52;
  vec2 pin = fc + rc * vec2(sin(ph), -cos(ph));
  float wc = pin.y - sqrt(Lc * Lc - pow(pin.x - a0, 2.0));
  vec2 p = vec2(a, wl);
  // connecting rod
  vec2 ab = pin - vec2(a0, wc);
  float t = clamp(dot(p - vec2(a0, wc), ab) / dot(ab, ab), 0.0, 1.0);
  vec2 dd = p - (vec2(a0, wc) + ab * t);
  float dl = length(dd);
  if (dl < 0.032) { setS(0.25 + 0.6 * smoothstep(-0.5, 1.0, dot(dd, vec2(1, 0)) / 0.032), dot(dd, normalize(vec2(-ab.y, ab.x))), t, 0.032 - dl); return true; }
  if (length(p - pin) < 0.04) { setS(1.0, 0.0, 0.0, 0.0); gB = 1.0; return true; }
  // crosshead
  if (abs(a - a0) < 0.075 && abs(wl - wc) < 0.055) { setS(0.55, wl, a, min(0.075 - abs(a - a0), 0.055 - abs(wl - wc))); return true; }
  // piston rod
  if (abs(a - a0) < 0.022 && wl > 0.7 && wl < wc) { float xn = (a - a0) / 0.022; setS(0.05 + 0.7 * xn * xn, a, wl, 0.022 - abs(a - a0)); return true; }
  // cylinder
  if (abs(a - a0) < 0.16 && wl > 0.12 && wl < 0.74) {
    float xn = (a - a0) / 0.16;
    float T = 0.12 + 0.65 * xn * xn + 0.2 * xn;
    float E = min(0.16 - abs(a - a0), min(wl - 0.12, 0.74 - wl));
    if (wl < 0.18 || wl > 0.68) { setS(0.8, a, wl, E); return true; }
    setS(T, a, wl, E);
    if (abs(xn + 0.45) < 0.07) gW = 1.0;
    return true;
  }
  // flywheel
  vec2 c = p - fc;
  float rr = length(c);
  if (rr < 0.3) {
    float ang = atan(c.y, c.x) - ph;
    if (rr < 0.05) { setS(1.0, rr, 0.0, 0.0); gB = 1.0; return true; }
    if (rr > 0.24) { setS(0.35 - 0.35 * dot(c / rr, normalize(LDIR)), rr, ang, min(rr - 0.24, 0.3 - rr)); return true; }
    float sa = mod(ang, TAU / 6.0) - TAU / 12.0;
    float ac = abs(sin(sa)) * rr;
    if (ac < 0.024) { setS(0.3, sin(sa) * rr, rr, 0.024 - ac); return true; }
    setS(1.0, rr, 0.0, ac - 0.024); gB = 1.0; return true;
  }
  return false;
}

bool gauge(float a, float wl, float k) {
  if (h11(k * 5.3) > 0.8) return false;
  vec2 c = vec2(a - 2.38, wl - 1.0);
  float rr = length(c);
  if (rr > 0.2) return false;
  if (rr > 0.17) { setS(0.72, rr, 0.0, min(rr - 0.17, 0.2 - rr)); return true; }
  float ang = atan(c.x, c.y);
  float need = -2.3 + 4.6 * clamp(uNeedle + 0.08 * sin(uTime * 1.3 + k * 2.0), 0.0, 1.0);
  vec2 nv = vec2(sin(need), cos(need));
  float along = dot(c, nv), across = abs(dot(c, vec2(nv.y, -nv.x)));
  setS(0.02, rr, 0.0, 0.17 - rr);
  if (along > -0.03 && along < 0.14 && across < 0.012 * (1.0 - along / 0.16)) { gB = 1.0; return true; }
  if (rr < 0.022) { gB = 1.0; return true; }
  if (rr > 0.125 && abs(ang) < 2.4) {
    float tk = abs(fract(ang / 0.48 + 0.5) - 0.5) * 0.48 * rr;
    if (tk < 0.006) gB = 1.0;
  }
  if (rr > 0.1 && ang > 1.5 && ang < 2.4) gT = 0.9;           // the red line, cut black
  return true;
}

void wall(vec3 P) {
  float th = atan(P.y, P.x);
  float a2 = mod(th + TAU, TAU);
  float w = uCamW + P.z;
  float k = floor(w / SEG);
  float wl = w - k * SEG;
  float cw = TAU / 20.0;
  vec2 pc = vec2(a2 / cw, w / 0.5);
  vec2 pf = fract(pc), pid = floor(pc);
  float E = min(min(pf.x, 1.0 - pf.x) * cw, min(pf.y, 1.0 - pf.y) * 0.5);
  float ao = 0.4 * exp(-wl * 4.0) + 0.3 * exp(-(SEG - wl) * 3.0);
  float lit = -(cos(th) * 0.6 + sin(th) * 0.8);
  ao += 0.22 * -lit;
  setS(0.2 + 0.12 * (h21(pid) - 0.5) + ao, w, th * 0.5, E);
  vec2 cd = (pf - floor(pf + 0.5)) * vec2(cw, 0.5);
  if (length(cd) < 0.03) {
    vec2 cid = pid + floor(pf + 0.5);
    float g = step(h21(cid + floor(uTime * 14.0) * 0.37), uHat * 0.22);
    if (g > 0.0 && star(cd, 0.09) > 0.0) { gW = 1.0; return; }
    rivet(cd, 0.02);
    gT += ao * 0.5;
  } else {
    vec2 cid = pid + floor(pf + 0.5);
    float g = step(h21(cid + floor(uTime * 14.0) * 0.37), uHat * 0.22);
    if (g > 0.0 && star(cd, 0.09) > 0.0) { gW = 1.0; gB = 0.0; return; }
  }

  bool hit = false;
  if (th > -0.72 && th < 0.46) hit = wallGears(th, wl, k, false);
  else if (a2 > 2.62 && a2 < 3.78) hit = wallGears(a2, wl, k, true);
  else if (th > 0.46 && th < 1.06) hit = engine(th, wl, k);
  else if (a2 > 2.16 && a2 < 2.62) hit = gauge(a2, wl, k);
  if (hit) { gT += ao * 0.6; return; }

  // pipes along the ceiling and down the lower walls
  float pa[6] = float[6](1.22, 1.43, 1.7, 1.96, 4.0, 5.45);
  float pw[6] = float[6](0.07, 0.05, 0.1, 0.06, 0.09, 0.08);
  for (int i = 0; i < 6; i++) {
    float d = a2 - pa[i];
    float fl = fract(w / 0.8 + float(i) * 0.37);
    float flw = pw[i] + (fl < 0.05 ? 0.025 : 0.0);
    if (abs(d) < flw) {
      float xn = d / flw;
      float T = 0.08 + 0.7 * xn * xn + 0.2 * xn + ao;
      if (fl < 0.05) { setS(0.72 + ao, w, d, min(flw - abs(d), min(fl, 0.05 - fl) * 0.8)); return; }
      setS(T, d, w, flw - abs(d));
      if (abs(xn + 0.45) < 0.1) gW = 1.0;
      return;
    }
  }
  // the floor: two rails, sleepers, and a drive chain running between them
  float fd = a2 - 4.712;
  if (abs(fd) < 0.45) {
    float ch = w + uChain;
    float lf = fract(ch / 0.16) - 0.5;
    float li = floor(ch / 0.16);
    float cd = fd - 0.0;
    if (mod(li, 2.0) < 0.5) {
      float e = length(vec2(lf * 0.16 / 0.1, cd / 0.045));
      if (abs(e - 0.78) < 0.26) { setS(0.85, e, 0.0, 0.0); gB = 1.0; if (cd > 0.0 && abs(e - 0.78) < 0.08) { gB = 0.0; gW = 1.0; } return; }
    } else if (abs(cd) < 0.012 && abs(lf) < 0.42) { setS(1.0, 0.0, 0.0, 0.0); gB = 1.0; return; }
    if (abs(abs(fd) - 0.3) < 0.035) { float xn = (abs(fd) - 0.3) / 0.035; setS(0.2 + 0.6 * xn * xn + ao, fd, w, 0.035 - abs(abs(fd) - 0.3)); return; }
    float sl = fract(w / 0.3);
    if (sl < 0.3 && abs(fd) < 0.4) { setS(0.75 + ao, w, fd, min(sl, 0.3 - sl) * 0.3); return; }
  }
}

// ---------------------------------------------------------------- steam
float sT, sS1, sS2, sEdge, sZ, sF, sCurl; vec2 sDir;
bool steam(vec2 uv, vec2 o, float zLimit) {
  float Fsum = 0.0; float bestC = 0.0; vec2 bestD = vec2(0.0); float bestR = 1.0; float bestZ = 0.0;
  for (int j = 0; j < ${MAXJ}; j++) {
    vec4 J = uJet[j];
    if (J.w <= 0.0) continue;
    vec3 S = vec3(0.92 * cos(J.x), 0.92 * sin(J.x), J.y);
    vec3 D = normalize(vec3(-cos(J.x), -sin(J.x) + 0.35, -0.15));
    vec3 side = normalize(cross(D, vec3(0.0, 0.0, 1.0)));
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float pa = J.z - fi * 0.055;
      if (pa < 0.0) continue;
      float dist = J.w * 0.42 * (1.0 - exp(-pa * 3.0)) + 0.04 * fi;
      vec3 Cn = S + D * dist + side * (h11(fi * 7.3 + J.x) - 0.5) * 0.16 * J.w * (0.3 + pa) + vec3(0.0, 0.1 * pa * pa, 0.0);
      if (Cn.z < 0.12 || Cn.z > zLimit) continue;
      float rad = J.w * (0.035 + 0.12 * (1.0 - exp(-pa * 2.2))) * (0.6 + 0.8 * h11(fi + J.x));
      vec2 sc = (Cn.xy - o) / Cn.z * F;
      float rs = rad / Cn.z * F;
      vec2 d = uv - sc;
      if (dot(d, d) > 4.0 * rs * rs) continue;   // beyond e^-8: skip the trig
      float ang = atan(d.y, d.x);
      float sc2 = 1.0 + 0.12 * sin(ang * 5.0 + fi * 1.9 + J.x * 3.0 + pa * 1.5) + 0.06 * sin(ang * 11.0 - fi);
      float dd = length(d) * sc2;
      float life = smoothstep(1.5, 0.5, pa) * smoothstep(0.3, 0.8, Cn.z);
      float c = life * exp(-2.0 * dd * dd / max(rs * rs, 1e-8));
      Fsum += c;
      if (c > bestC) { bestC = c; bestD = d / rs; bestR = rad; bestZ = Cn.z; }
    }
  }
  sF = Fsum;
  if (Fsum < 0.14) return false;
  float Fl = log(Fsum);
  sEdge = Fl;
  sZ = bestZ;
  sT = 0.6 * smoothstep(0.3, 0.9, -bestD.y) * smoothstep(0.9, 0.2, Fl - log(0.14));
  sS1 = uv.y; sS2 = uv.x;
  sCurl = length(bestD); sDir = bestD / max(sCurl, 1e-4);
  return true;
}

// ---------------------------------------------------------------- woodcut
float cutLines(float s, float tone, float upp, float lp) {
  if (tone < 0.03) return 0.0;
  float fw = clamp(fwidth(s), upp * 0.5, upp * 5.0);
  float target = lp * fw;
  float Lg = log2(target);
  float n = floor(Lg), fr = Lg - n;
  float sp = exp2(n);
  float x = s / sp;
  float de = abs(fract(x * 0.5 + 0.5) - 0.5) * 2.0;
  float dO = abs(fract(x * 0.5) - 0.5) * 2.0;
  float hw = 0.5 * pow(clamp(tone, 0.0, 1.0), 1.15);
  float fs = smoothstep(0.0, 1.0, fr);
  float hwE = hw * (1.0 + fs), hwO = hw * (1.0 - fs);
  float aa = clamp(fw / sp, 0.02, 0.5) * 0.7;
  float cE = 1.0 - smoothstep(hwE - aa, hwE + aa, de);
  float cO = 1.0 - smoothstep(hwO - aa, hwO + aa, dO);
  return max(cE, cO);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  uv = rot(uv, uCam.z);
  vec2 rd = uv / F;
  vec2 o = uCam.xy;
  float qa = dot(rd, rd), qb = dot(o, rd), qc = dot(o, o) - 1.0;
  float zWall = qa > 1e-7 ? (-qb + sqrt(max(qb * qb - qa * qc, 0.0))) / qa : 1e4;

  bool hit = false;
  float z = zWall;
  for (int i = 0; i < ${MAXD}; i++) {
    if (i >= uN) break;
    float dz = uDA[i].x;
    if (dz > zWall) break;
    float zz;
    if (door(i, o, rd, zz)) {
      if (zz < zWall) { hit = true; z = zz; break; }
    }
  }
  if (!hit) {
    if (zWall < 40.0) wall(vec3(o + rd * zWall, zWall));
    else setS(1.0, 0.0, 0.0, 1.0);
    z = zWall;
  }

  float upp = z * 2.0 / (F * uRes.y);
  float lp = uLinePx;
  float fog = smoothstep(4.0, 13.5, z);
  float mode = z > uInk.x ? uInk.z : uInk.y;
  float rawT = gT, rawW = gW;
  // With the tone block printed, the light comes from beyond the door: the
  // far end of the black print fades to bare paper instead of closing to a
  // black hole, so the brightest paper in the drop is the vanishing point.
  float tb = mode > 0.5 ? 0.0 : uTintAmt;
  float farLit = smoothstep(3.0, 11.0, z) * tb;
  // White ink on black cuts fewer lines than the black print, so it reads as
  // a dark block with light carved out, while the far end still glows.
  float T = mix(gT * (mode > 0.5 ? 0.55 : 0.85), 1.0 - tb, fog);
  float S1 = gS1, S2 = gS2, E = gE, W = gW * (1.0 - fog), B = gB;

  bool st = steam(uv, o, z);
  float sEdgePx = 1e3;
  if (st) {
    float sf = smoothstep(4.0, 13.5, sZ) * 0.8;
    T = mix(sT, 1.0, sf); S1 = sS1; S2 = sS2; E = 1.0; W = 0.0; B = 0.0;
    upp = 2.0 / uRes.y;
    float fl = sEdge - log(0.14);
    sEdgePx = fl / max(fwidth(sEdge), 1e-4);
    float inner = abs(fract(fl * 1.1 + 0.5) - 0.5) / max(fwidth(fl * 1.1), 1e-4);
    if (fl > 0.5 && fl < 1.9) B = max(B, 1.0 - smoothstep(0.35, 1.1, inner));
    // a curl cut into the upper side of the nearest puff, as in Hokusai's steam
    float cw = abs(sCurl - 0.5) / max(fwidth(sCurl), 1e-4);
    float arc = dot(sDir, normalize(vec2(-0.5, 0.85)));
    if (arc > 0.1) B = max(B, (1.0 - smoothstep(0.4, 1.2, cw)) * smoothstep(0.1, 0.4, arc));
  }

  float t1 = clamp(T * 0.95, 0.0, 0.75);
  float t2 = clamp((T - 0.58) * 2.2, 0.0, 1.0);
  float ink = max(cutLines(S1, t1, upp, lp), cutLines(S2, t2, upp, lp * 1.1));
  if (T > 0.97) ink = 1.0;
  float ow = max(0.8, lp * 0.18) * (1.0 + clamp(1.4 / max(z, 0.1) - 0.3, 0.0, 1.2));
  float oe = E / max(upp, 1e-6);
  if (!st) ink = max(ink, 1.0 - smoothstep(ow - 0.6, ow + 0.6, oe));
  else ink = max(ink, 1.0 - smoothstep(ow - 0.6, ow + 0.6, sEdgePx));
  ink = max(ink, B);
  ink *= 1.0 - W;
  if (!st) ink *= 1.0 - 0.85 * farLit;

  // paper grain: a faint tooth in the white, a few worn specks in the black
  vec2 gp = gl_FragCoord.xy;
  float grain = h21(floor(gp / 2.0));
  ink = clamp(ink + (grain - 0.5) * 0.06, 0.0, 1.0);

  if (st) mode = 0.0;
  vec3 paper = vec3(0.935, 0.912, 0.855);
  vec3 blk = vec3(0.075, 0.068, 0.06);
  vec3 col;
  if (mode > 0.5) col = mix(blk, paper * 0.97, ink);
  else {
    // Chiaroscuro woodcut (Ugo da Carpi): a coloured tone block printed under
    // the black key block, cut back to paper only on lit faces and glints.
    // V1's drop printed black on bare cream, which threw a floodlight over a
    // dark room; the tone block keeps the release but at about half the light.
    float hc = mix(0.13, 1.15, farLit);
    float aa = fwidth(rawT) * 0.75 + 0.008;
    float cov = st ? 0.0 : smoothstep(hc - aa, hc + aa, rawT) * (1.0 - rawW) * tb;
    // a faint wood grain in the block, as a real tone block prints
    float wg = 0.035 * sin(gp.y * 0.09 + 3.0 * sin(gp.x * 0.004) + 1.7 * sin(gp.y * 0.013));
    vec3 ground = mix(paper, uTint * (1.0 + wg), cov);
    col = mix(ground, blk, ink);
  }
  outColor = vec4(col, 1.0);
}`;

  // ------------------------------------------------------------------ JS side

  function mech(x) {
    // unlock-pause is handled by the caller; this is the heavy swing: a slow
    // start, a 6% overshoot at 72% of the way, then a damped settle.
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (x < 0.72) {
      const u = x / 0.72;
      return 1.06 * u * u * u * (u * (6 * u - 15) + 10);
    }
    const u = (x - 0.72) / 0.28;
    return 1 + 0.06 * Math.cos(u * Math.PI * 1.5) * Math.exp(-2 * u);
  }
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth01 = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

  // Tone-block inks, one per drop: earths a 16th-century chiaroscuro cutter
  // would have mixed, all dim enough that the drop no longer floods the room.
  const TINTS = [
    { name: 'Ochre', rgb: [0.62, 0.47, 0.29] },
    { name: 'Verdigris', rgb: [0.33, 0.49, 0.43] },
    { name: 'Red oxide', rgb: [0.6, 0.29, 0.21] },
    { name: 'Slate', rgb: [0.33, 0.4, 0.51] },
  ];

  VIZ.register({
    id: 'thresholdsv2',
    name: 'Thresholds',
    versionOf: 'thresholds',
    version: 'V2',
    order: 701,
    gallery: {
      title: 'Thresholds V2',
      technique: 'One WebGL2 fragment shader ray-casting a cylinder and analytic door planes (hinged leaves intersect their rotated planes); every surface returns a tone, object-space hatch coordinates and an edge distance, turned into octave-LOD carved lines with fwidth anti-aliasing; door sequencing, latches and steam jets in JS',
      brief: 'Flying forward through a tunnel of successively opening doors, drawn as an animated woodcut: every tone is a carved line. Nine mechanisms (iris, vault with bolts and wheel, portcullis, toothed sliding leaves, radial segments, scalloped clamshell, rotating shutter slats, bascule, rolling gear) unlock, pause and swing with weight while gears, a steam engine, gauges and a chain run on the walls. The build brings the flight to a halt before one shut door: kicks trip its latches one at a time, the gauges climb to the red line and steam leaks at its seams. The drop blows it open with twin steam jets, the flight surges through, and the print turns over from white-on-black to a chiaroscuro woodcut, black line over a coloured tone block, lit from the far end of the tunnel, in a new earth ink each drop. Kick: a latch snaps out with a starburst and the nearest ratchet steps a tooth. Snare: a jet of steam from one wall. Bass: flight, gear and crank speed. Hats: glints on rivets.',
      lineage: 'V2 of Thresholds (V1: web/scenes/thresholds.js, Raph\'s own sketch of 2026-09-28, "flying forward through a tunnel of successively opening doors ... an animated woodcut"; ranked first of 72 by the six-judge panel). Acted on: the director\'s reading that "the door is the drop" (true in V1 only by luck; now a held door in the build is blown open by the drop), the curator\'s "the drop as a place you enter" transplant, and the floor\'s complaint that the cream drop floods a dark room, reinterpreted from his "sepia ink" suggestion as a chiaroscuro tone block after Ugo da Carpi, with the floor\'s per-drop variation as a new ink each drop. Kept: the two-ink print outside the drop, the woodcut line engine and every mechanism (the psychonaut\'s Gilliam worry is Raph\'s brief). V1 lineage: white-line wood engraving (Vallotton, Dor\u00e9), Hokusai\'s steam, Stargate\'s analytic ray-cast.',
    },

    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0.2, max: 2.5, default: 1, step: 0.01 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'density', label: 'Line density', type: 'range', min: 0.5, max: 2, default: 1, step: 0.01 },
      { key: 'ink', label: 'Ink', type: 'select', options: ['Black on white', 'White on black', 'Invert on the drop'], default: 2 },
      { key: 'steam', label: 'Steam', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'variety', label: 'Door variety', type: 'range', min: 2, max: 9, default: 9, step: 1 },
      { key: 'complexity', label: 'Second stages', type: 'range', min: 0, max: 1, default: 0.15, step: 0.01 },
      { key: 'tone', label: 'Drop tone block', type: 'select', options: ['Off (bare paper)', 'New ink each drop'].concat(TINTS.map((c) => c.name)), default: 1 },
    ],

    actions: [
      { id: 'vent', label: 'Vent steam', run() { this.ventReq = true; } },
    ],

    gl: null, glCanvas: null, glFailed: false,

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.camW = 0;
      this.doors = [];
      this.nextW = SEG;
      this.lastType = -1;
      this.bag = [];
      this.jets = [];
      this.t = null;
      this.gear = 0; this.chain = 0; this.crank = 0; this.crankT = 0; this.crankK = 0;
      this.bass = 0; this.hat = 0; this.needle = 0.3;
      this.prevKick = 0; this.lastKick = -1; this.prevSn = 0; this.lastSn = -1;
      this.dropLevel = 0; this.drop = false; this.dropness = 0;
      this.front = -1; this.nearMode = -1; this.farMode = -1;
      this.side = 1; this.nextAmbient = 1.5;
      this.speedSm = 0.9;
      this.seedN = 1;
      // V2: the held door and the breach
      this.tens = 0; this.tensSlow = 0; this.calmT = 0;
      this.held = null; this.holdT = 0; this.brake = 1; this.pull = 1;
      this.armed = false; this.lit = false; this.surgeT = -99;
      this.dropCount = 0; this.tint = TINTS[0].rgb.slice(); this.tintAmt = 0;
      this.nextLeak = 0;
    },

    rnd() {
      // deterministic per scene run (harness seeds Math.random too)
      return Math.random();
    },

    pickType(variety) {
      const pool = TYPES.slice(0, Math.max(2, Math.min(TYPES.length, Math.round(variety))));
      if (!this.bag.length) {
        this.bag = pool.map((t) => t.id);
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.rnd() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
        if (this.bag[this.bag.length - 1] === this.lastType && this.bag.length > 1) {
          [this.bag[0], this.bag[this.bag.length - 1]] = [this.bag[this.bag.length - 1], this.bag[0]];
        }
      }
      let id = this.bag.pop();
      if (!pool.some((t) => t.id === id)) id = pool[0].id;
      this.lastType = id;
      return id;
    },

    spawn(params) {
      const w = this.nextW;
      this.nextW += SEG;
      let type = this.pickType(params.variety);
      let second = -1;
      const chance = params.complexity + 0.6 * this.dropness;
      if (this.rnd() < chance) {
        const planar = TYPES.filter((t) => !t.hinged && t.id !== type).map((t) => t.id);
        if (BY_ID[type].hinged) { second = type; type = planar[Math.floor(this.rnd() * planar.length)]; }
        else {
          const others = TYPES.filter((t) => t.id !== type).map((t) => t.id);
          second = others[Math.floor(this.rnd() * others.length)];
        }
      }
      const mk = (id, ww, isSecond) => {
        const t = BY_ID[id];
        let roll = 0;
        if (t.shape === 0 && !t.hinged) roll = this.rnd() * Math.PI * 2;
        else if (t.shape === 0) roll = (this.rnd() - 0.5) * 0.6;
        else roll = (this.rnd() - 0.5) * 0.12;
        return {
          w: ww, type: id, shape: t.shape, roll, seed: this.seedN++ * 0.137 % 1,
          nL: isSecond ? -1 : 3 + Math.floor(this.rnd() * 2),
          latch: 0, latchT: 0, snapIdx: -9, snapT: -9, ratchet: 0, ratchetT: 0, rsnapT: -9,
          second: isSecond, open: 0, held: false, timed: false, openT0: 0, openDur: 1,
        };
      };
      this.doors.push(mk(type, w, false));
      if (second >= 0) this.doors.push(mk(second, w + 0.42, true));
    },

    initGL(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
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
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      this.gl = gl; this.glCanvas = c;
      const U = {};
      ['uDD', 'uRes', 'uTime', 'uCamW', 'uLinePx', 'uGear', 'uChain', 'uCrank', 'uHat', 'uNeedle', 'uCam', 'uN', 'uDA', 'uDB', 'uDC', 'uJet', 'uInk', 'uTint', 'uTintAmt']
        .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
      this.u = U;
      this.bufA = new Float32Array(MAXD * 4);
      this.bufB = new Float32Array(MAXD * 4);
      this.bufC = new Float32Array(MAXD * 4);
      this.bufJ = new Float32Array(MAXJ * 4);
      this.bufD = new Float32Array(MAXD);
    },

    step(signals, params, t, dt) {
      const react = params.react;
      // --- listening
      const k = signals[0];
      const kRise = k - this.prevKick;
      this.prevKick = k;
      let kick = 0;
      if (k > 12 && kRise > 7 && t - this.lastKick > 0.3) { kick = k / 100; this.lastKick = t; }
      const sn = (signals[3] + signals[4]) * 0.5;
      const snRise = sn - this.prevSn;
      this.prevSn = sn;
      let snare = 0;
      if (sn > 35 && snRise > 14 && t - this.lastSn > 0.2) { snare = sn / 100; this.lastSn = t; }
      const b = (signals[0] + signals[1]) / 200;
      this.bass += (b - this.bass) * (1 - Math.exp(-dt / 0.7));
      const hat = Math.max(signals[6], signals[7], signals[8]) / 100;
      this.hat += (hat - this.hat) * (1 - Math.exp(-dt / 0.06));

      // Tension: the top bands against their own slow average. Risers, hat
      // crescendos and snare rolls all push it up; a steady drop's hats do
      // not, because by then the slow average has caught up.
      const hi = (signals[5] + signals[6] + signals[7] + signals[8]) / 400;
      this.tens += (hi - this.tens) * (1 - Math.exp(-dt / 1.0));
      this.tensSlow += (hi - this.tensSlow) * (1 - Math.exp(-dt / 6));
      const building = !this.drop && this.tens > 0.1 && this.tens > 1.4 * this.tensSlow + 0.02;
      const strain = this.held ? clamp01((this.tens - 0.08) / 0.35) : 0;

      const nd = clamp01(0.15 + (signals[0] + signals[1] + signals[2]) / 200 + 0.75 * strain);
      this.needle += (nd - this.needle) * (1 - Math.exp(-dt / 0.07));

      this.dropLevel *= Math.exp(-dt / 1.2);
      if (kick) this.dropLevel += 0.3 * kick;
      const wasDrop = this.drop;
      if (!this.drop && this.dropLevel > 0.55) this.drop = true;
      else if (this.drop && (this.dropLevel < 0.15 || t - this.lastKick > 1.5)) this.drop = false;
      this.dropness += ((this.drop ? 1 : 0) - this.dropness) * (1 - Math.exp(-dt / 0.8));
      // The detector fires on the kick that tips the level over, usually the
      // build's last; the breach waits for the next strong kick, the downbeat.
      let breachNow = false;
      if (this.drop && !wasDrop) { this.armed = true; if (kick >= 0.92) breachNow = true; }
      else if (this.armed && kick) breachNow = true;
      if (!this.drop) { this.armed = false; this.lit = false; }

      // --- the held door: the build brings us to a halt before one shut door
      if (building && !this.held && !this.lit && react > 0) {
        // Never park beside a hinged leaf: a door that swung open just behind
        // the stopping point lies along the tunnel beside us, and held still
        // it fills the sides of the frame with one flat panel.
        let cand = null;
        for (const d of this.doors) {
          const dist = d.w - this.camW;
          if (d.second || d.timed || dist < 2.4 || d.open > 0) continue;
          const leafBeside = this.doors.some((e) => BY_ID[e.type].hinged && e.w < d.w - 0.5 && e.w > d.w - SEG - 0.6);
          if (leafBeside) continue;
          if (!cand || d.w < cand.w) cand = d;
        }
        if (cand) { cand.held = true; this.held = cand; this.holdT = t; }
      }
      this.calmT = building ? 0 : this.calmT + dt;
      if (this.held && !breachNow && (this.calmT > 1.5 || t - this.holdT > 9)) {
        // the build fizzled: the door gives way by itself, slowly
        const d = this.held;
        d.held = false; d.timed = true; d.openT0 = t; d.openDur = 1.6; d.latchT = d.nL;
        this.held = null;
      }
      if (breachNow && react > 0) this.breach(params, t);
      else if (breachNow) this.lit = true;

      // --- flight: the bass sets the speed, smoothly
      const target = 0.9 * params.speed * (0.7 + 1.1 * this.bass * (0.4 + 0.6 * react) + 0.3 * this.dropness);
      this.speedSm += (target - this.speedSm) * (1 - Math.exp(-dt / 0.6));
      // Braking is set by position so we coast to a stop 1.15 short of the
      // held door; letting go is eased so the flight never jerks forward.
      const brakeT = this.held ? smooth01((this.held.w - this.camW - 1.15) / 0.9) : 1;
      if (brakeT < this.brake) this.brake = brakeT;
      else this.brake += (brakeT - this.brake) * (1 - Math.exp(-dt / 0.35));
      // The breach surge: held a beat while the leaves swing, then through.
      const su = t - this.surgeT;
      const surge = su < 0.12 ? 0 : su < 0.5 ? smooth01((su - 0.12) / 0.38) : Math.exp(-(su - 0.5) / 0.9);
      // A held door far ahead draws the flight on faster, so a short build
      // still arrives: the build is felt as being pulled towards the door.
      const pullT = this.held ? 1 + 1.6 * smooth01((this.held.w - this.camW - 2.0) / 1.5) : 1;
      this.pull += (pullT - this.pull) * (1 - Math.exp(-dt / 0.5));
      const v = this.speedSm * this.pull * this.brake + 1.9 * params.speed * surge;
      this.camW += v * dt;
      this.gear += dt * (0.5 + 2.6 * this.bass * react + 0.8 * this.dropness + 2.5 * strain) * params.speed;
      this.chain += v * dt * 0.8;
      // The wall engines idle round slowly; each kick throws the crank half a
      // turn, so the pistons slam a full stroke on the beat.
      this.crank += dt * (0.9 + 1.5 * this.bass * react + 1.5 * strain) * params.speed;
      if (kick && react > 0) this.crankT += Math.PI * Math.min(1, react);
      this.crankK += (this.crankT - this.crankK) * (1 - Math.exp(-dt / 0.05));

      while (this.nextW < this.camW + FAR) this.spawn(params);
      this.doors = this.doors.filter((d) => d.w - this.camW > -1.6);
      if (this.held && this.doors.indexOf(this.held) < 0) this.held = null;

      // --- doors: latches by kick (or by distance), then the heavy swing
      for (const d of this.doors) {
        const dist = d.w - this.camW;
        if (d.timed) {
          d.open = mech((t - d.openT0) / d.openDur);
        } else if (d.held) {
          d.open = 0;
        } else if (!d.second) {
          const forced = d.nL * clamp01((3.1 - dist) / (3.1 - 2.2));
          // any latch the kicks have not tripped is released quietly by distance
          if (forced > d.latchT) d.latchT = forced;
          d.open = mech((2.1 - dist) / (2.1 - 0.72));
        } else {
          d.open = mech((1.6 - dist) / (1.6 - 0.5));
        }
        d.latch += (d.latchT - d.latch) * (1 - Math.exp(-dt * 16));
        d.ratchet += (d.ratchetT - d.ratchet) * (1 - Math.exp(-dt * 22));
      }
      if (kick && react > 0) {
        // The kick trips one mechanism on the nearest door still shut (the
        // held door while there is one): its next latch dog if it has one.
        let act = this.held;
        if (!act) {
          for (const d of this.doors) {
            const dist = d.w - this.camW;
            if (d.second || d.timed || dist < 1.2 || d.open > 0.3) continue;
            if (!act || d.w < act.w) act = d;
          }
        }
        if (act) {
          const idx = Math.floor(act.latchT + 1e-6);
          if (idx < act.nL) { act.latchT = idx + 1; act.snapIdx = idx; act.snapT = t; }
        }
        // ...and the ratchet on the nearest plate we can see advances a tooth.
        let near = this.held;
        if (!near) {
          for (const d of this.doors) {
            if (d.second || d.w - this.camW < 1.5) continue;
            if (!near || d.w < near.w) near = d;
          }
        }
        if (near) { near.ratchetT += 1; near.rsnapT = t; }
      }

      // --- steam: the snare vents a jet from one wall; a little ambient hiss
      const steamAmt = params.steam;
      if (snare && steamAmt > 0 && react > 0) {
        this.side = -this.side;
        const a = this.side > 0 ? -0.35 + (this.rnd() - 0.5) * 0.4 : Math.PI + 0.35 + (this.rnd() - 0.5) * 0.4;
        this.jets.push({ a, w: this.camW + 0.85 + v * 0.3, t0: t, s: (0.8 + 0.5 * snare) * Math.min(1.4, 0.55 + 0.45 * steamAmt) * Math.min(1.3, 0.5 + 0.5 * react) });
      }
      if (this.ventReq) {
        this.ventReq = false;
        this.side = -this.side;
        this.jets.push({ a: this.side > 0 ? -0.35 : Math.PI + 0.35, w: this.camW + 1.6, t0: t, s: 1.3 });
      }
      // The held door leaks steam at its seams, faster as the build winds up.
      if (this.held && steamAmt > 0 && strain > 0.1 && t > this.nextLeak) {
        this.nextLeak = t + (0.9 - 0.55 * strain) / Math.max(0.5, steamAmt);
        this.side = -this.side;
        const a = (this.side > 0 ? -0.2 : Math.PI + 0.2) + (this.rnd() - 0.5) * 0.9;
        this.jets.push({ a, w: this.held.w - 0.12, t0: t, s: (0.22 + 0.3 * strain) * Math.min(1.3, 0.6 + 0.4 * steamAmt) });
      } else if (!this.held && steamAmt > 0 && t > this.nextAmbient) {
        this.nextAmbient = t + (2.2 + this.rnd() * 2.5) / steamAmt;
        const opts = [4.0, 5.45, 1.43, 1.96];
        this.jets.push({ a: opts[Math.floor(this.rnd() * opts.length)], w: this.camW + 2.2 + this.rnd() * 2, t0: t, s: 0.5 + 0.2 * steamAmt });
      }
      this.jets = this.jets.filter((j) => t - j.t0 < 2.3 && j.w - this.camW > -0.5);
      if (this.jets.length > MAXJ) this.jets = this.jets.slice(this.jets.length - MAXJ);

      // --- ink: the drop turns the print over, as a wave coming up the tunnel
      const want = params.ink === 0 ? 0 : params.ink === 1 ? 1 : (this.lit ? 0 : 1);
      if (this.nearMode < 0) { this.nearMode = want; this.farMode = want; this.front = -1; }
      // The front runs from its start to the lens, slowing as it nears so the
      // sweep across the big near surfaces can be seen. It starts at the
      // vanishing point, or at the breached door (see breach).
      if (want !== this.farMode && this.front < 0) this.startFront(want, 24);
      if (this.front >= 0) {
        this.frontU += dt / this.frontDur;
        this.front = 0.35 + (this.front0 - 0.35) * Math.pow(Math.max(0, 1 - this.frontU), 2.5);
        if (this.frontU >= 1) { this.front = -1; this.nearMode = this.farMode; }
      }

      // --- the tone block eases in with the lit print and out after it
      const tone = Math.round(params.tone);
      const tintOn = tone > 0 && (this.lit || this.front >= 0 || params.ink === 0 && this.dropness > 0.5) ? 1 : 0;
      if (tone >= 2) this.tint = TINTS[Math.min(TINTS.length - 1, tone - 2)].rgb.slice();
      this.tintAmt += (tintOn - this.tintAmt) * (1 - Math.exp(-dt / (tintOn ? 0.25 : 0.9)));
    },

    startFront(mode, from) {
      if (this.front >= 0) this.nearMode = this.farMode;   // finish any wave in flight
      this.farMode = mode;
      this.front0 = from; this.front = from; this.frontU = 0;
      this.frontDur = 0.45 + 0.85 * Math.min(1, from / 24);
    },

    // The drop: the held door (or the nearest shut one) is blown open, all its
    // latches snap at once, steam jets from both walls, and we surge through.
    breach(params, t) {
      this.armed = false;
      this.lit = true;
      let d = this.held;
      if (!d) {
        for (const e of this.doors) {
          const dist = e.w - this.camW;
          if (e.second || e.timed || dist < 1.3 || dist > 5 || e.open > 0.1) continue;
          if (!d || e.w < d.w) d = e;
        }
      }
      this.dropCount++;
      if (Math.round(params.tone) === 1) this.tint = TINTS[(this.dropCount - 1) % TINTS.length].rgb.slice();
      if (!d) return;
      d.held = false; d.timed = true; d.openT0 = t; d.openDur = 0.7;
      const idx = Math.floor(d.latchT + 1e-6);
      d.latchT = d.nL; d.snapIdx = Math.min(idx, d.nL - 1); d.snapT = t;
      d.ratchetT += 3; d.rsnapT = t;
      this.held = null;
      this.surgeT = t;
      this.crankT += Math.PI;
      if (params.steam > 0) {
        const s = 1.25 * Math.min(1.3, 0.6 + 0.4 * params.steam);
        this.jets.push({ a: -0.3, w: d.w - 0.1, t0: t, s });
        this.jets.push({ a: Math.PI + 0.3, w: d.w - 0.1, t0: t, s });
      }
      if (params.ink === 2) this.startFront(0, Math.max(0.5, d.w - this.camW + 0.05));
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.t === null ? 1 / 60 : Math.min(0.1, Math.max(0, t - this.t));
      this.t = t;
      if (!this.doors) this.reset();
      this.step(signals, params, t, dt);

      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) {
        try { this.initGL(w, h); } catch (e) { this.glFailed = true; console.error(e); }
      }
      if (!this.gl) {
        p.background(236, 232, 218);
        p.fill(20); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(24);
        p.text('Thresholds needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      gl.viewport(0, 0, w, h);

      const U = this.u;
      const list = this.doors.slice(0, MAXD);
      list.sort((a, b) => a.w - b.w);
      for (let i = 0; i < MAXD; i++) {
        const d = list[i];
        if (!d) continue;
        const o = i * 4;
        this.bufA[o] = d.w - this.camW; this.bufA[o + 1] = d.type; this.bufA[o + 2] = d.open; this.bufA[o + 3] = d.latch;
        this.bufB[o] = d.roll; this.bufB[o + 1] = d.seed; this.bufB[o + 2] = d.nL; this.bufB[o + 3] = d.shape;
        this.bufD[o / 4] = t - d.rsnapT;
        this.bufC[o] = d.snapIdx; this.bufC[o + 1] = t - d.snapT; this.bufC[o + 2] = -d.ratchet * Math.PI * 2 / 10; this.bufC[o + 3] = d.open * 6.5;
      }
      this.bufJ.fill(0);
      this.jets.forEach((j, i) => {
        const o = i * 4;
        this.bufJ[o] = j.a; this.bufJ[o + 1] = j.w - this.camW; this.bufJ[o + 2] = t - j.t0; this.bufJ[o + 3] = j.s;
      });

      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uCamW, this.camW);
      gl.uniform1f(U.uLinePx, (h / 105) / params.density);
      gl.uniform1f(U.uGear, this.gear);
      gl.uniform1f(U.uChain, this.chain);
      gl.uniform1f(U.uCrank, this.crank + this.crankK);
      gl.uniform1f(U.uHat, this.hat * params.react);
      gl.uniform1f(U.uNeedle, this.needle);
      gl.uniform3f(U.uCam, 0.11 * Math.sin(t * 0.23), 0.07 * Math.sin(t * 0.31 + 1), 0.16 * Math.sin(t * 0.071));
      gl.uniform1i(U.uN, list.length);
      gl.uniform4fv(U.uDA, this.bufA);
      gl.uniform4fv(U.uDB, this.bufB);
      gl.uniform4fv(U.uDC, this.bufC);
      gl.uniform1fv(U.uDD, this.bufD);
      gl.uniform4fv(U.uJet, this.bufJ);
      gl.uniform3f(U.uInk, this.front < 0 ? -1 : this.front, this.nearMode, this.farMode);
      gl.uniform3f(U.uTint, this.tint[0], this.tint[1], this.tint[2]);
      gl.uniform1f(U.uTintAmt, this.tintAmt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
