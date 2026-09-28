// Engraved Deep — a descent through an ocean drawn as a Victorian engraving.
//
// Batch 06, idea 10 (the Floor and the Psychonaut): Thresholds crossed with
// Abyss. Two versions were proposed. The Psychonaut's flips the whole ground
// from dark to cream on the drop, as Thresholds does; the Floor's keeps the
// dark ground and sends a whale's hatched flank past instead. This is the
// Floor's drop with the Psychonaut's kick and snare: the Floor docked
// Thresholds a point because its cream drop "brightens the room a lot", and a
// whale sliding past is an event the whole room can name, where an inversion
// is only a change of level.
//
// Craft notes:
// - One WebGL2 fragment shader paints every layer back to front: the water
//   (horizontal engraved lines whose width follows the light, so god rays are
//   hatching, not glow), far marine snow, the jellies sorted far to near with
//   the whale slotted in at its depth, then near snow. Nothing is ever lit
//   additively; every tone is a line of a certain width.
// - Jellies are cream plates with dark hatching (two cuts: contour lines that
//   follow the dome, and meridians across them in the darks), so a bell is
//   the lightest thing on screen without ever being white. Far jellies sink
//   into the dark ground as the aerial perspective.
// - The kick contracts ONE bell: it squeezes narrow and tall, strokes upward,
//   and its hatching thickens and cross-cuts, so it goes darker rather than
//   whiter (the panel's fix for Abyss's bells blowing out to white). The
//   snare prints one other jelly in negative, a wave running down the bell
//   and back. Hats glint the marine snow. Bass is sink speed and the sway of
//   the light. The drop: a whale slides past, close, a second ink (sepia)
//   comes into the gonads, pleats and light, more jellies rise into view, the
//   snow thickens and the descent speeds. The breakdown lets the extra
//   jellies drift up and out one at a time rather than fading them together.

(function () {
  const MAXJ = 10;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime, uLine, uLineW, uHat, uRays, uInk2, uSnow, uCamY, uSway;
uniform int uN, uWhaleAt;
uniform vec4 uJA[${MAXJ}]; // x, y, R, contraction
uniform vec4 uJB[${MAXJ}]; // darkening, fog, seed, bell height
uniform vec4 uJC[${MAXJ}]; // negative front on, negative front off, tentacle length, arm length
uniform vec4 uJD[${MAXJ}]; // tilt, species, tentacle phase, presence
uniform vec4 uWh;          // snout x, y, scale, direction of travel
uniform vec4 uWh2;         // active, swim phase, fog, pleat ink
out vec4 outColor;

const vec3 GROUND = vec3(0.043, 0.047, 0.055);
const vec3 CREAM = vec3(0.925, 0.885, 0.79);
const vec3 SEPIA = vec3(0.76, 0.48, 0.27);
const float PI = 3.14159265;

float h11(float x) { return fract(sin(x * 127.1 + 3.7) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

float pxU;

// Engraved lines at the integers of s, half-width w (in periods, 0..0.5).
// When lines crowd below a couple of pixels they settle to their average
// tone instead of aliasing into moire.
float lines(float s, float w) {
  if (w <= 0.002) return 0.0;
  float fw = clamp(fwidth(s), 1e-4, 1.0);
  float d = abs(fract(s + 0.5) - 0.5);
  // exact box filter of the pixel footprint over the line, so hairlines
  // stay faint instead of smearing to half-tone, and nothing beats into moire
  float lo = max(d - 0.5 * fw, -w), hi = min(d + 0.5 * fw, w);
  float c = max(0.0, hi - lo) / fw;
  float d2 = 1.0 - d;   // the neighbouring line, for wide footprints
  float lo2 = max(d2 - 0.5 * fw, -w), hi2 = min(d2 + 0.5 * fw, w);
  c += max(0.0, hi2 - lo2) / fw;
  return min(c, 1.0);
}

// Tone (0 none .. 1 solid) to the two cuts of an engraving.
float engrave(float s1, float s2, float tone) {
  float w1 = 0.5 * pow(clamp(tone, 0.0, 0.9), 1.15);
  float w2 = 0.5 * clamp((tone - 0.48) * 1.7, 0.0, 0.8);
  return max(lines(s1, w1), lines(s2, w2));
}

// ------------------------------------------------------------ the water
float rays(vec2 uv) {
  float acc = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float c = -2.2 + 0.85 * fi + 0.35 * sin(uTime * (0.07 + 0.02 * fi) + fi * 1.7) + uSway * sin(uTime * 0.23 + fi);
    float x = uv.x + (1.0 - uv.y) * 0.32;
    float wd = 0.07 + 0.09 * h11(fi + 2.0);
    float k = (x - c) / wd;
    acc += exp(-k * k) * (0.45 + 0.55 * h11(fi + 9.0));
  }
  return acc * (0.25 + 0.75 * smoothstep(-1.3, 1.0, uv.y));
}

vec3 water(vec2 uv) {
  float r = rays(uv) * uRays;
  float tone = 0.035 + 0.42 * r + 0.07 * smoothstep(0.3, 1.0, uv.y) * uRays;
  // lines tied to the water at a far parallax, so sinking lifts them past us
  float y = uv.y + uCamY * 0.3;
  float s = (y + 0.008 * sin(uv.x * 2.6 + uTime * 0.35 + y * 4.0) + 0.003 * sin(uv.x * 9.0 - uTime * 0.6)) / (uLineW * pxU);
  float c = lines(s, 0.5 * pow(clamp(tone, 0.0, 0.8), 1.1));
  vec3 ink = mix(CREAM, SEPIA, uInk2 * 0.55 * smoothstep(0.1, 0.5, r));
  return mix(GROUND, ink * 0.92, c);
}

// ------------------------------------------------------------ marine snow
void snow(vec2 uv, inout vec3 col, float cell, float par, float rad, float dens, float seed, float bright) {
  vec2 p = vec2(uv.x + 0.02 * sin(uTime * 0.2 + seed), uv.y + uCamY * par - uTime * 0.01) / cell;
  vec2 ci = floor(p);
  float h = h21(ci + seed);
  if (h > dens) return;
  vec2 c = vec2(0.2 + 0.6 * h21(ci + 7.1 + seed), 0.2 + 0.6 * h21(ci + 3.3 + seed));
  c.x += 0.12 * sin(uTime * (0.3 + 0.4 * h) + h * 40.0);
  vec2 d = (fract(p) - c) * cell / pxU;
  float r = rad * max(1.0, uRes.y / 400.0) * (0.55 + 0.9 * h21(ci + 9.9 + seed));
  // a flake, a little longer than wide, turned its own way
  vec2 dr = rot(d, h * 6.0 + uTime * 0.2);
  float a = 1.0 - smoothstep(r - 0.6, r + 0.6, length(dr * vec2(0.75, 1.25)));
  // hats: a few flakes catch the light as four-point stars
  float g = 0.0;
  float gh = h21(ci + 5.5 + seed);
  float tw = uHat * step(gh, 0.3) * (0.5 + 0.5 * sin(uTime * 9.0 + gh * 60.0));
  if (tw > 0.05) {
    vec2 ad = abs(d) / (r * (2.0 + 5.0 * tw));
    float st = max(1.0 - ad.x / 0.12 - ad.y, 1.0 - ad.y / 0.12 - ad.x);
    g = clamp(st * 3.0, 0.0, 1.0) * tw;
  }
  col = mix(col, CREAM, clamp(max(a * bright, g), 0.0, 1.0));
}

// ------------------------------------------------------------ jellies
void jelly(int i, vec2 uv, inout vec3 col) {
  vec4 A = uJA[i], B = uJB[i], C = uJC[i], D = uJD[i];
  if (D.w <= 0.002) return;
  float R = A.z;
  vec2 q = rot((uv - A.xy) / R, D.x);
  float tl = C.z, al = C.w;
  if (q.y > 1.5 || q.y < -max(tl, al) - 0.2 || abs(q.x) > 1.3 + 0.35 * tl) return;
  float Rpx = R / pxU;
  float c = A.w;
  float a = 1.0 - 0.26 * c;
  float b = B.w * (1.0 + 0.32 * c);
  float dark = B.x, fog = B.y, seed = B.z;
  float sp = D.y;
  float ph = D.z;
  float e = 0.2 * a;                  // the rim's ellipse, seen from a little below
  vec3 inkC = mix(GROUND, SEPIA * 0.6, uInk2 * 0.25);
  vec3 creamF = mix(CREAM, GROUND, fog);
  float presence = D.w;

  // the negative print: a wave down the bell (on), and another back (off)
  float hN = clamp((b - q.y) / (b + e), 0.0, 1.0);
  float neg = smoothstep(hN - 0.1, hN + 0.1, C.x) * (1.0 - smoothstep(hN - 0.1, hN + 0.1, C.y));

  float tt = -q.y;
  // tentacles: fine cream threads trailing from the rim
  if (tt > -e && tt < tl) {
    float nT = sp < 0.5 ? 12.0 : 8.0;
    for (int k = 0; k < 12; k++) {
      float fk = float(k);
      if (fk >= nT) break;
      float u = fk / (nT - 1.0);
      float x0 = a * 0.94 * (u * 2.0 - 1.0);
      float ta = max(tt, 0.0);
      float wob = (0.08 + 0.2 * (1.0 - c)) * ta;
      float p0 = ph + fk * 1.9 + seed * 7.0;
      float fx = x0 * (1.0 - 0.22 * min(ta, 1.5)) + wob * sin(ta * 1.7 - p0);
      float fx2 = x0 * (1.0 - 0.22 * min(ta + 0.02, 1.5)) + (0.08 + 0.2 * (1.0 - c)) * (ta + 0.02) * sin((ta + 0.02) * 1.7 - p0);
      float sl = (fx2 - fx) / 0.02;
      float dpx = abs(q.x - fx) * Rpx / sqrt(1.0 + sl * sl);
      float w = (sp < 0.5 ? 0.45 : 0.65) * max(0.6, Rpx / 90.0);
      float along = tt / tl;
      float lc = (1.0 - smoothstep(w - 0.55, w + 0.55, dpx)) * (1.0 - along) * (1.0 - 0.5 * along);
      col = mix(col, creamF, lc * 0.8 * presence);
    }
  }
  // oral arms: frilled ribbons, cream with cross-cut hatching
  if (tt > 0.0 && tt < al) {
    for (int k = 0; k < 4; k++) {
      float fk = float(k) / 3.0;
      float cx = (fk - 0.5) * 0.3 * a + (0.12 + 0.1 * (1.0 - c)) * tt * sin(tt * 1.15 - ph * 0.7 - fk * 2.3 - seed * 4.0);
      float wd = (0.075 + 0.035 * sin(tt * 10.0 + fk * 5.0 + uTime * 1.1)) * (1.0 - 0.7 * tt / al) * (sp < 0.5 ? 0.8 : 1.15);
      float dx = abs(q.x - cx);
      if (dx < wd) {
        float u = dx / wd;
        float tone = 0.3 + 0.45 * u * u + 0.25 * tt / al + 0.5 * dark;
        float s1 = tt * Rpx / uLine * 0.7;
        float s2 = (q.x - cx) * Rpx / uLine;
        float ink = engrave(s1, s2, tone);
        float edge = 1.0 - smoothstep(0.6, 1.6, (wd - dx) * Rpx);
        vec3 body = mix(creamF, inkC, max(ink, edge));
        body = mix(body, mix(inkC, mix(creamF, SEPIA, 0.75 * (1.0 - fog)), ink), neg);
        col = mix(col, body, presence * (1.0 - 0.35 * tt / al));
      }
    }
  }
  // the bell: dome above the rim, the underside ellipse below it
  vec2 n2;
  float r;
  bool under = q.y < 0.0;
  if (!under) { n2 = vec2(q.x / a, q.y / b); }
  else { n2 = vec2(q.x / a, q.y / e); }
  r = length(n2);
  float scal = under ? 1.0 + 0.05 * (1.0 - abs(sin(atan(n2.y, n2.x) * 8.0))) : 1.0;
  if (r > scal) return;
  float nz = sqrt(max(0.0, 1.0 - r * r));
  float lam = clamp(dot(normalize(vec3(n2, nz)), normalize(vec3(-0.45, 0.72, 0.52))), 0.0, 1.0);
  float tone;
  float s1, s2;
  if (!under) {
    // translucent: the engraver draws the edge dense and leaves the middle open
    tone = 0.1 + 0.42 * smoothstep(0.5, 1.0, r) + 0.28 * (1.0 - lam) + 0.5 * dark;
    s1 = r * b * Rpx / uLine * 0.95;
    float th = atan(n2.x, n2.y);
    s2 = th * a * Rpx / uLine * 0.8;
    tone = mix(tone, tone * 0.6, smoothstep(0.35, 0.0, r));
  } else {
    tone = 0.5 + 0.2 * r + 0.4 * dark;
    s1 = r * e * Rpx / uLine * 2.2;
    s2 = q.x * Rpx / uLine;
  }
  float ink = engrave(s1, s2, tone);
  // the margin: a dark engraved outline, so overlapping bells stay separate
  float edgePx = (scal - r) * Rpx * (under ? e : min(a, b));
  float edge = 1.0 - smoothstep(0.7, 1.7, edgePx);
  ink = max(ink, edge);
  vec3 gonC = mix(inkC, SEPIA, uInk2);
  vec3 bell = mix(creamF, inkC, ink);
  // the negative is printed in the second ink, so a clap reads warm where
  // a kick reads dark
  vec3 negInk = mix(creamF, mix(creamF, SEPIA * 1.05, 0.75), 1.0 - fog);
  vec3 bellN = mix(inkC, negInk, ink * (1.0 - edge));
  // moon jellies carry four gonads; two show from the side as horseshoes
  float gon = 0.0;
  if (sp < 0.5 && !under) {
    for (int k = 0; k < 2; k++) {
      float sx = k == 0 ? -1.0 : 1.0;
      vec2 gc = vec2(sx * 0.34 * a, 0.3 * b);
      vec2 gd = (q - gc) / vec2(a, b);
      float gl = abs(length(gd) - 0.17) - 0.04;
      float gpx = gl * Rpx * min(a, b);
      float hs = smoothstep(-0.2, 0.3, gd.y + 0.1);   // open at the bottom: a horseshoe
      gon = max(gon, (1.0 - smoothstep(-0.5, 0.8, gpx)) * hs);
    }
  }
  bell = mix(bell, gonC, gon * 0.9);
  bellN = mix(bellN, mix(CREAM, SEPIA, uInk2), gon * 0.9);
  vec3 outc = mix(bell, bellN, neg);
  float cov = 1.0 - smoothstep(scal - 1.2 / (Rpx * (under ? e : min(a, b))), scal, r);
  col = mix(col, outc, cov * 0.94 * presence);
}

// ------------------------------------------------------------ the whale
void whale(vec2 uv, inout vec3 col) {
  if (uWh2.x <= 0.0) return;
  float sc = uWh.z;
  float x = -uWh.w * (uv.x - uWh.x) / sc;
  float y = (uv.y - uWh.y) / sc;
  if (x < -0.1 || x > 9.6) return;
  float scPx = sc / pxU;
  float swim = uWh2.y;
  float und = 0.16 * pow(x / 8.0, 2.0) * sin(swim - x * 0.55);
  float yc = 0.07 * sin(x * 0.4 + 0.3) + und;
  // a blunt, heavy head, the body fullest behind the flipper, a long taper
  float head = pow(clamp(x / 1.5, 0.0, 1.0), 0.42);
  float taper = 1.0 - 0.9 * smoothstep(2.4, 7.8, x);
  float hh = 0.74 * head * taper + 0.015;
  float top = yc + hh * (0.78 + 0.22 * smoothstep(0.0, 2.4, x));
  float bot = yc - hh * 1.08;
  vec3 wcol = col;
  float cov = 0.0;
  vec3 wg = GROUND * 1.2;
  vec3 pleatC = mix(CREAM, SEPIA, 0.6 * uWh2.w);
  if (x < 7.9 && y < top && y > bot) {
    float mid = 0.5 * (top + bot), half_ = 0.5 * (top - bot);
    float v = (y - mid) / half_;
    float halfPx = half_ * scPx;
    // lit from above: the back is dense with cream lines, the flank falls to dark
    float tone = 0.05 + 0.52 * smoothstep(-0.3, 0.95, v);
    // scars and pale patches, as a humpback carries them
    float mot = sin(x * 3.1 + 1.3) * sin(y * 7.0 + x * 1.7) * sin(x * 1.1 - y * 3.0);
    tone += 0.12 * smoothstep(0.35, 0.8, mot);
    float s = v * halfPx / uLine * 0.85;
    float s2 = (x * 0.8 - y * 0.6) * scPx / uLine * 0.55;
    float ink = engrave(s, s2, tone * (1.0 - 0.3 * smoothstep(0.2, -0.6, v)));
    vec3 lc = CREAM * 0.94;
    // throat pleats: long pale grooves running back from the jaw
    float jaw = yc - 0.12 - 0.07 * x;
    if (x < 5.0 && y < jaw) {
      float pl = smoothstep(0.0, 0.08, jaw - y) * (1.0 - smoothstep(3.6, 5.0, x));
      float pv = (y - bot) / max(jaw - bot, 1e-3);
      float sp = pv * 11.0;
      float pc = lines(sp, 0.09 + 0.05 * pv);
      ink = mix(ink, pc, pl);
      lc = mix(lc, pleatC, pl);
    }
    // the mouth line, lit along the lip, curving up to the eye
    float my = yc - 0.1 - 0.06 * x + 0.05 * smoothstep(1.2, 1.9, x);
    if (x > 0.08 && x < 1.9) ink = max(ink, (1.0 - smoothstep(0.5, 1.4, abs(y - my) * scPx)) * 0.9);
    // the dorsal rim catches the light; the belly edge is cut dark
    float tp = (top - y) * scPx;
    ink = max(ink, 1.0 - smoothstep(0.8, 2.0, tp));
    float bp = (y - bot) * scPx;
    ink *= smoothstep(0.5, 1.5, bp);
    wcol = mix(wg, lc, ink);
    // knobbed tubercles scattered along the head and jaw, each a small lit bump
    for (int k = 0; k < 7; k++) {
      float fk = float(k);
      float tx = 0.2 + fk * 0.2 + 0.08 * h11(fk + 4.0);
      float hx = 0.74 * pow(clamp(tx / 1.5, 0.0, 1.0), 0.42);
      float ty = k < 4 ? 0.07 * sin(tx * 0.4 + 0.3) + hx * 0.8 - 0.05 - 0.07 * h11(fk)
                       : yc - 0.1 - 0.06 * tx - 0.06 - 0.05 * h11(fk + 1.0);
      vec2 dd = vec2(x, y) - vec2(tx, ty);
      float rr = 0.018 + 0.014 * h11(fk + 7.0);
      float dl = (length(dd) - rr) * scPx;
      float lit = step(0.0, dot(dd, vec2(-0.5, 0.85)));
      wcol = mix(wcol, mix(GROUND, CREAM, 0.35 + 0.6 * lit), 1.0 - smoothstep(-0.5, 0.8, dl));
    }
    // the eye, low and far back, with creases around it
    vec2 ec = vec2(1.7, yc - 0.13);
    float ed = length((vec2(x, y) - ec) * vec2(1.0, 1.5));
    float er = abs(ed - 0.045) * scPx;
    float cr = abs(fract(ed * 18.0) - 0.5) * scPx / 18.0;
    if (ed > 0.06 && ed < 0.17) wcol = mix(wcol, wg, 0.7 * (1.0 - smoothstep(0.06, 0.17, ed)));
    if (ed > 0.06 && ed < 0.17) wcol = mix(wcol, CREAM * 0.8, (1.0 - smoothstep(0.3, 1.0, cr)) * (1.0 - smoothstep(0.06, 0.17, ed)));
    wcol = mix(wcol, CREAM, 1.0 - smoothstep(0.7, 1.6, er));
    if (ed < 0.032) wcol = GROUND;
    cov = 1.0 - smoothstep(-1.0, 0.5, -min(tp, bp));
  }
  // flukes, seen a little from above: a swept crescent beyond the peduncle
  if (x > 7.3 && x < 9.6) {
    float fy = 0.07 * sin(x * 0.4 + 0.3) + und;
    float u = (x - 7.6) / 1.9;
    float span = 0.02 + 0.4 * smoothstep(0.0, 0.9, u) * (1.0 - smoothstep(0.75, 1.0, u)) * (0.5 + 0.5 * cos(swim * 0.6));
    float notch = 0.12 * smoothstep(0.2, 1.0, u) * (1.0 - smoothstep(0.03, 0.2, abs(y - fy) / max(span, 0.02)));
    float bladeX = x - notch;
    float d = (abs(y - fy) - span) * scPx;
    if (d < 1.0 && bladeX > 7.3 && bladeX < 9.5 - 0.6 * abs(y - fy)) {
      float v = (y - fy) / max(span, 0.02);
      float tone = 0.1 + 0.45 * smoothstep(-0.2, 1.0, v) + 0.2 * u;
      float ink = engrave((y - fy) * scPx / uLine * 0.8, (x + 0.5 * (y - fy)) * scPx / uLine * 0.6, tone);
      float edgeX = (9.5 - 0.6 * abs(y - fy) - bladeX) * scPx;
      ink = max(ink, 1.0 - smoothstep(0.6, 1.6, min(-d, edgeX)));
      vec3 fc = mix(wg, CREAM * 0.92, ink);
      float fcv = (1.0 - smoothstep(-0.5, 0.8, d)) * smoothstep(-0.5, 0.8, edgeX);
      wcol = mix(wcol, fc, fcv);
      cov = max(cov, fcv);
    }
  }
  // the pectoral fin: long, pale, curved, knobbed along its leading edge
  vec2 A = vec2(2.0, yc - 0.3), Bf = vec2(4.7, yc - 1.45);
  vec2 P = vec2(x, y);
  vec2 Df = Bf - A;
  float t = clamp(dot(P - A, Df) / dot(Df, Df), 0.0, 1.0);
  vec2 nrm = normalize(vec2(-Df.y, Df.x));
  float across = dot(P - (A + Df * t), nrm) - 0.5 * t * (1.0 - t);
  float hwF = mix(0.2, 0.025, pow(t, 0.75)) * smoothstep(-0.02, 0.1, t + 0.02);
  float lead = across > 0.0 ? 0.03 * pow(0.5 + 0.5 * sin(t * 40.0), 2.0) * (1.0 - t) : 0.0;
  float fd = (abs(across) - hwF - lead) * scPx;
  // the clamp above makes a capsule's side, not its ends: cut the root flat
  // (it is inside the flank) and round the tip
  float al = dot(P - A, Df) / dot(Df, Df);
  if (al < 0.0) fd = max(fd, -al * length(Df) * scPx);
  if (al > 1.0) fd = (length(P - Bf) - 0.025) * scPx;
  if (fd < 1.0) {
    float u = across / (hwF + 1e-3);
    // pale fin, shaded toward its trailing edge and its tip
    float tone = 0.12 + 0.4 * smoothstep(0.3, -1.0, u) + 0.25 * t;
    float s1 = across * scPx / uLine * 0.9;
    float s2 = (t * length(Df) + across * 0.4) * scPx / uLine * 0.7;
    float ink = engrave(s1, s2, tone);
    ink = max(ink, 1.0 - smoothstep(0.6, 1.6, -fd));
    vec3 fc = mix(mix(CREAM, pleatC, 0.3), wg, ink);
    float fcv = 1.0 - smoothstep(-0.5, 0.8, fd);
    wcol = mix(wcol, fc, fcv);
    cov = max(cov, fcv);
  }
  wcol = mix(wcol, GROUND, uWh2.z);
  col = mix(col, wcol, cov * uWh2.x);
}

void main() {
  pxU = 2.0 / uRes.y;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 col = water(uv);
  snow(uv, col, 0.075, 0.18, 0.9, 0.18 * uSnow, 1.0, 0.4);
  snow(uv, col, 0.11, 0.45, 1.2, 0.3 * uSnow, 17.0, 0.7);
  bool wd = false;
  for (int i = 0; i < ${MAXJ}; i++) {
    if (i >= uN) break;
    if (i == uWhaleAt) { whale(uv, col); wd = true; }
    jelly(i, uv, col);
  }
  if (!wd) whale(uv, col);
  snow(uv, col, 0.23, 1.3, 2.0, 0.22 * uSnow, 31.0, 0.85);
  // paper tooth: a faint grain so the black reads as printed, not as a screen
  float grain = h21(floor(gl_FragCoord.xy / 2.0));
  col += (grain - 0.5) * 0.018;
  outColor = vec4(col, 1.0);
}`;

  const PRESETS = {
    calm: { sink: 0.55, jellies: 5, ink2: 0.1, rays: 0.6, whale: 0, snow: 0.8, sway: 0.25 },
    drop: { sink: 1.5, jellies: 8, ink2: 1, rays: 1.15, whale: 1, snow: 1.3, sway: 0.7 },
    // The trench: almost no light, a few far bells and falling snow, for a
    // long breakdown.
    trench: { sink: 0.3, jellies: 3, ink2: 0.4, rays: 0.15, whale: 0, snow: 1.4, sway: 0.1, follow: 0 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['sink', 'jellies', 'ink2', 'rays', 'whale', 'snow', 'sway'];

  // Species: a moon jelly (low dome, horseshoe gonads, a fringe of short
  // threads) and a sea nettle (tall bell, long arms and tentacles).
  const SPECIES = [
    { flat: 0.58, tent: [0.8, 1.2], arm: [0.8, 1.1] },
    { flat: 0.88, tent: [2.4, 3.4], arm: [1.6, 2.4] },
  ];

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  VIZ.register({
    id: 'engraveddeep',
    name: 'Engraved Deep',
    order: 810,

    params: [
      { key: 'sink', label: 'Sink speed', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.sink, step: 0.01 },
      { key: 'jellies', label: 'Jellies', type: 'range', min: 1, max: 10, default: PRESETS.calm.jellies, step: 1 },
      { key: 'rays', label: 'Light from above', type: 'range', min: 0, max: 1.6, default: PRESETS.calm.rays, step: 0.01 },
      { key: 'ink2', label: 'Sepia ink', type: 'range', min: 0, max: 1, default: PRESETS.calm.ink2, step: 0.01 },
      { key: 'whale', label: 'Whale (over half: it swims past)', type: 'range', min: 0, max: 1, default: PRESETS.calm.whale, step: 0.01 },
      { key: 'snow', label: 'Marine snow', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.snow, step: 0.01 },
      { key: 'sway', label: 'Light sway', type: 'range', min: 0, max: 1.2, default: PRESETS.calm.sway, step: 0.01 },
      { key: 'react', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'density', label: 'Line density', type: 'range', min: 0.6, max: 1.8, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'whale', label: 'Call the whale', run() { this.whaleReq = true; } },
    ],

    gallery: {
      title: 'Engraved Deep',
      technique: 'One WebGL2 fragment shader compositing back to front: water as horizontal engraved lines whose width follows analytic god rays, hashed-grid marine snow at three parallax depths, jellies (dome and rim-ellipse bells shaded by a 3D normal and cut as two-direction hatching, sinuous tentacles, frilled oral arms, horseshoe gonads) sorted far to near, and an analytic whale (contour-line flank, throat pleats, tubercles, eye, knobbed pectoral fin, edge-on flukes) slotted in at its depth; onset detection and a section follower in JS',
      brief: 'A slow descent through an ocean drawn as a Victorian engraving, cream and a little sepia on black. Jellies drift at several depths; every tone is a line, the light from above is hatching and the snow falls past as flecks. Kick: one bell contracts and strokes upward, its hatching thickening and cross-cutting, so it goes darker, never whiter. Clap: another jelly prints in negative, the wave running down its bell and back. Hats: a few flakes of snow glint. Bass: sink speed and the sway of the light. Drop: a humpback slides past close enough to fill the frame, the sepia second ink comes into the gonads, pleats and light, more jellies rise into view and the snow thickens. Breakdown: the extra jellies drift up and out one at a time, leaving empty water and falling snow.',
      lineage: [
        'Batch 06, idea 10 (the Floor and the Psychonaut): Thresholds crossed with Abyss.',
        'Thresholds (web/scenes/thresholds.js): tone turned into engraved line width per pixel in a fragment shader, two cuts with the cross-cut only in the darks, white on black as the dark-room print.',
        'Abyss (web/scenes/abyss.js): jellies drifting at three depths through marine snow and god rays; the panel\'s fixes for it are built in: one bell contracting instead of halo rings, and no bell ever blowing out to white.',
        'Of the two proposals, the Floor\'s drop (a whale\'s flank slides past, dark ground kept) over the Psychonaut\'s (the ground flips to cream), because the Floor docked Thresholds for how much its cream drop lights the room and a passing whale is an event anyone can name; the Psychonaut\'s kick (darker, not whiter) and snare (one jelly in negative) are kept.',
        'Victorian natural-history engraving: Haeckel\'s medusae plates and the wood-engraved whales of 19th-century sea books.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},
    enter() { this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.camY = 0;
      this.jel = null;
      this.env = { kf: 0, ks: 0, kOn: 0, kArm: true, cf: 0, cs: 0, cOn: 0, cArm: true, bass: 0, hat: 0, rise: 0,
        low: 0, dropOn: false, auto: 0, lastK: -9, lastC: -9 };
      this.whaleSt = null;
      this.whaleReq = false;
      this.whaleWasHigh = false;
      this.whaleNext = 0;
      this.whaleN = 0;
      this.sway = 0;
      this.spawnT = 0;
      this.lastKicked = null;
    },

    newJelly(aspect, below, taken) {
      const r = Math.random;
      const sp = r() < 0.55 ? 0 : 1;
      const S = SPECIES[sp];
      // while the whale is about, half the newcomers swim in front of it, so
      // the kick still has bells to land on when the flank fills the frame
      const d = this.nearBias && r() < 0.5 ? 0.95 + 0.4 * r() : 1.0 + Math.pow(r(), 1.4) * 2.6;
      const Rw = (sp === 0 ? 0.36 : 0.3) + 0.08 * r();
      // pick the free-est column from a few tries
      let best = 0, bestScore = -1;
      for (let k = 0; k < 6; k++) {
        const sx = (r() * 2 - 1) * aspect * 0.85;
        let score = 9;
        for (const j of taken) score = Math.min(score, Math.abs(j.x / j.d - sx) + 0.3 * Math.abs(j.d - d));
        if (score > bestScore) { bestScore = score; best = sx; }
      }
      const R = Rw / d;
      const tent = S.tent[0] + r() * (S.tent[1] - S.tent[0]);
      const sy = below ? -1 - 1.35 * R : -1 + r() * 2;
      return {
        sp, d, Rw, x: best * d, y: this.camY + sy * d, flat: S.flat * (0.9 + 0.2 * r()),
        tent, arm: S.arm[0] + r() * (S.arm[1] - S.arm[0]),
        seed: r(), ph: r() * 10, idlePh: r() * 6.28, idleW: 1.1 + 0.6 * r(),
        kick: 0, dark: 0, negOn: 0, negOff: 0, negT: -9, lastKick: -9 - r(), lastNeg: -9 - r(),
        vy: 0, presence: below ? 1 : 0, leaving: false,
      };
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
      const u = {};
      for (const n of ['uRes', 'uTime', 'uLine', 'uLineW', 'uHat', 'uRays', 'uInk2', 'uSnow', 'uCamY', 'uSway', 'uN',
        'uWhaleAt', 'uJA', 'uJB', 'uJC', 'uJD', 'uWh', 'uWh2']) u[n] = gl.getUniformLocation(prog, n);
      this.u = u;
      this.gl = gl;
      this.glCanvas = c;
      this.bA = new Float32Array(MAXJ * 4);
      this.bB = new Float32Array(MAXJ * 4);
      this.bC = new Float32Array(MAXJ * 4);
      this.bD = new Float32Array(MAXJ * 4);
    },

    // Envelopes. Kick and clap are onsets (fast minus slow), so the drop's
    // sidechained bass and the breakdown's pad never read as beats.
    listen(signals, dt, T) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp((e.kf - e.ks) * 2.2, 0, 1);
      let kick = 0;
      if (e.kArm && kOn > 0.22 && T - e.lastK > 0.22) { kick = kOn; e.kArm = false; e.lastK = T; }
      if (kOn < 0.1) e.kArm = true;
      const cl = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp((e.cf - e.cs) * 3, 0, 1);
      let clap = 0;
      if (e.cArm && cOn > 0.25 && T - e.lastC > 0.3) { clap = cOn; e.cArm = false; e.lastC = T; }
      if (cOn < 0.1) e.cArm = true;
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 1.2, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 6, dt);
      e.rise = ease(e.rise, (signals[5] + signals[6] + signals[7]) / 300, 0.8, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.reset();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const T = this.clock;
      const e = this.env;
      const hit = this.listen(signals, dt, T);

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const react = params.react;
      const aspect = ctx.width / ctx.height;

      // --- the descent
      this.camY -= dt * (0.05 + 0.2 * P.sink * (0.6 + 0.9 * e.bass));
      this.sway = ease(this.sway, P.sway * (0.5 + e.bass), 1, dt);

      // --- the jellies
      this.nearBias = P.whale > 0.5 || !!this.whaleSt;
      if (!this.jel) {
        this.jel = [];
        const n0 = Math.round(P.jellies);
        for (let i = 0; i < n0; i++) {
          const j = this.newJelly(aspect, false, this.jel);
          j.presence = 1;
          this.jel.push(j);
        }
      }
      const want = clamp(Math.round(P.jellies), 1, MAXJ);
      const staying = this.jel.filter((j) => !j.leaving).length;
      // Too many: the lowest-on-screen extra is marked to leave, and simply is
      // not replaced when it drifts out of the top, so exits are one at a time.
      if (staying > want) {
        let pick = null;
        for (const j of this.jel) if (!j.leaving && (!pick || j.y - this.camY > pick.y - this.camY)) pick = j;
        if (pick) pick.leaving = true;
      }
      if (staying < want && this.jel.length < MAXJ && T - this.spawnT > 0.35) {
        this.jel.push(this.newJelly(aspect, true, this.jel));
        this.spawnT = T;
      }
      for (const j of this.jel) {
        j.kick = ease(j.kick, 0, 3.2, dt);
        j.dark = ease(j.dark, 0, 1.6, dt);
        j.vy = ease(j.vy, 0, 1.5, dt);
        j.y += dt * (0.025 + j.vy);
        j.x += dt * 0.02 * Math.sin(T * 0.11 + j.seed * 20);
        j.ph += dt * (0.8 + 0.6 * e.bass);
        if (j.negT > -9) {
          const a = T - j.negT;
          j.negOn = clamp(a / 0.35, 0, 1.2);
          j.negOff = clamp((a - 0.9) / 0.45, 0, 1.2);
          if (a > 1.4) { j.negT = -9; j.negOn = 0; j.negOff = 0; }
        }
      }
      const sy = (j) => (j.y - this.camY) / j.d;
      // off the top: recycle below, unless it was leaving
      for (let i = this.jel.length - 1; i >= 0; i--) {
        const j = this.jel[i];
        const R = j.Rw / j.d;
        if (sy(j) - Math.max(j.tent, j.arm) * R - 0.1 > 1) {
          this.jel.splice(i, 1);
          if (!j.leaving && this.jel.length < want) this.jel.push(this.newJelly(aspect, true, this.jel));
        }
      }
      const Wn = this.whaleSt;
      const hidden = (j) => {
        if (!Wn || j.d < Wn.d) return false;
        const lx = -Wn.dir * (j.x / j.d - Wn.x) / Wn.sc;
        const ly = (sy(j) - Wn.y) / Wn.sc;
        return lx > -0.2 && lx < 7.5 && ly > -0.95 && ly < 0.75;
      };
      const visible = this.jel.filter((j) => Math.abs(sy(j)) < 0.78 && Math.abs(j.x / j.d) < aspect * 0.92 && !hidden(j));

      // kick: ONE bell, the one least recently kicked among those in view
      if (hit.kick && react > 0 && visible.length) {
        let pick = null;
        for (const j of visible) if (!pick || j.lastKick + 0.4 * j.d < pick.lastKick + 0.4 * pick.d) pick = j;
        pick.lastKick = T;
        const s = Math.min(1, 0.55 + 0.6 * hit.kick) * Math.min(1.3, react);
        pick.kick = Math.max(pick.kick, s);
        pick.dark = Math.max(pick.dark, s);
        pick.vy += 0.16 * s;
        this.lastKicked = pick;
      }
      // clap: another jelly prints in negative
      if (hit.clap && react > 0 && visible.length) {
        let pick = null;
        for (const j of visible) {
          if (j === this.lastKicked && visible.length > 1) continue;
          if (j.negT > -9) continue;
          if (!pick || j.lastNeg < pick.lastNeg) pick = j;
        }
        if (pick) { pick.lastNeg = T; pick.negT = T; }
      }

      // --- the whale
      const high = P.whale > 0.5;
      if ((high && !this.whaleWasHigh && !this.whaleSt) || (high && !this.whaleSt && T > this.whaleNext) || (this.whaleReq && !this.whaleSt)) {
        this.whaleReq = false;
        const dir = this.whaleN % 2 === 0 ? -1 : 1;
        const sc = 0.82 + 0.12 * Math.random();
        // depth is only draw order to the eye, so slot the whale just behind
        // the two nearest bells in view: the kick keeps somewhere to land
        const inView = this.jel.filter((j) => Math.abs(sy(j)) < 0.85).map((j) => j.d).sort((x, y) => x - y);
        const wd = inView.length ? inView[Math.min(1, inView.length - 1)] + 0.01 : 1.5;
        this.whaleSt = { dir, sc, x: -dir * (aspect + 0.15), y: 0.02 + 0.2 * Math.random(), swim: 0, d: Math.max(0.9, Math.min(2.4, wd)) };
        this.whaleN++;
      }
      this.whaleReq = false;
      this.whaleWasHigh = high;
      const W = this.whaleSt;
      if (W) {
        W.x += W.dir * dt * (0.95 + 0.25 * P.sink);
        W.swim += dt * 1.4;
        W.y += dt * 0.012 * Math.sin(W.swim * 0.3);
        // gone once the flukes have cleared the far edge
        if (W.dir * W.x > aspect + 9.4 * W.sc) { this.whaleSt = null; this.whaleNext = T + 12; }
      }

      // --- GL
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (err) { this.glFailed = true; console.error(err); }
      }
      if (!this.gl) {
        p.background(11, 12, 14);
        p.fill(236, 226, 202); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(22);
        p.text('Engraved Deep needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      gl.viewport(0, 0, w, h);

      const list = this.jel.slice().sort((a, b) => b.d - a.d).slice(0, MAXJ);
      let whaleAt = list.length;
      if (W) { for (let i = 0; i < list.length; i++) if (list[i].d < W.d) { whaleAt = i; break; } }
      this.bA.fill(0); this.bB.fill(0); this.bC.fill(0); this.bD.fill(0);
      list.forEach((j, i) => {
        const o = i * 4;
        const R = j.Rw / j.d;
        // idle swimming: a soft pulse of its own between beats
        const idle = 0.14 * Math.pow(Math.max(0, Math.sin(T * j.idleW + j.idlePh)), 3);
        const c = clamp(idle + j.kick, 0, 1);
        this.bA[o] = j.x / j.d; this.bA[o + 1] = sy(j); this.bA[o + 2] = R; this.bA[o + 3] = c;
        this.bB[o] = clamp(j.dark, 0, 1); this.bB[o + 1] = 0.72 * clamp((j.d - 1.3) / 2.3, 0, 1); this.bB[o + 2] = j.seed; this.bB[o + 3] = j.flat;
        this.bC[o] = j.negOn; this.bC[o + 1] = j.negOff; this.bC[o + 2] = j.tent; this.bC[o + 3] = j.arm;
        this.bD[o] = 0.1 * Math.sin(T * 0.27 + j.seed * 30) + 0.05 * Math.sin(T * 0.6 + j.seed * 9);
        this.bD[o + 1] = j.sp; this.bD[o + 2] = j.ph; this.bD[o + 3] = j.presence;
      });

      const U = this.u;
      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uTime, T);
      gl.uniform1f(U.uLine, Math.max(2.8, h / 150) / params.density);
      gl.uniform1f(U.uLineW, Math.max(4.2, h / 105) / params.density);
      gl.uniform1f(U.uHat, clamp(e.hat * 1.6, 0, 1) * Math.min(1, react + 0.2));
      gl.uniform1f(U.uRays, P.rays * (1 + 0.35 * e.rise));
      gl.uniform1f(U.uInk2, clamp(P.ink2, 0, 1));
      gl.uniform1f(U.uSnow, P.snow);
      gl.uniform1f(U.uCamY, this.camY);
      gl.uniform1f(U.uSway, this.sway * 0.25);
      gl.uniform1i(U.uN, list.length);
      gl.uniform1i(U.uWhaleAt, whaleAt);
      gl.uniform4fv(U.uJA, this.bA);
      gl.uniform4fv(U.uJB, this.bB);
      gl.uniform4fv(U.uJC, this.bC);
      gl.uniform4fv(U.uJD, this.bD);
      if (W) {
        gl.uniform4f(U.uWh, W.x, W.y, W.sc, W.dir);
        gl.uniform4f(U.uWh2, 1, W.swim, 0.12 * clamp((W.d - 1.4) / 0.3, 0, 1), clamp(P.ink2, 0, 1));
      } else {
        gl.uniform4f(U.uWh, 0, 0, 1, 1);
        gl.uniform4f(U.uWh2, 0, 0, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
