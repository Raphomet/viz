// Whirligig: a folded-paper pinwheel over a carved frame that nests into
// itself, with thin luminous frames flying out over both.
//
// Built from a principle, not a copy: LEXSAN's "cosmic pinwheel" (scene 4 in
// docs/research/2026-09-28-lexsan-set.md) looked "not javascript" to Raph
// because it was several planes each moving its own way, shaded rather than
// filled, with a texture on it and a camera that never stops. So:
// - Background: a Droste nest of lacquered square frames, each a moulding
//   lit from one side, each level twisted a little from the one outside it.
//   It zooms in slowly and also breathes in and out (expands and collapses),
//   and the bass swells it. Farther levels sink into shade.
// - Foreground: a compass-rose pinwheel of folded paper blades. Each blade is
//   two facets either side of a crease, lit by one lamp, with paper fibre in
//   the blade's own coordinates and real soft shadows on the blades beneath
//   and, farther down, on the frames. The kick turns it one notch with a
//   small overshoot and opens or closes the blades a step (aligned star to
//   pinwheel and back), as a mechanical toy would.
// - Overlay: thin luminous square frames and corner brackets centred on the
//   pinwheel, streaming outward at their own rate and counter-rotating.
//   Hats flicker a random handful of them; a snare runs a light out through
//   them. The glow is a narrow core and a tight halo, never a wash.
// - Drop planes: a smaller counter-rotating pinwheel in a second ink and
//   dashed radial rays, both on the "Extra planes" control.
// - Camera: each plane is seen through its own parallax, so the pan shows
//   depth, and the pinwheel orbits the frame centre rather than sitting in it.
// Colour is mixed in OKLab between a few inks per palette (no hue cycling).

(function () {
  const TAU = Math.PI * 2;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // A notch with a little overshoot, like a ratchet settling.
  const easeOutBack = (t) => { const c = 1.5; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function hexLin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  }
  // Linear sRGB to OKLab (Ottosson 2020), so the shader can mix inks
  // perceptually: the midpoint of brass and pale gold stays golden rather
  // than going muddy, and the drop's accent slides in without a grey band.
  function oklab(hex) {
    const [r, g, b] = hexLin(hex);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
  }

  // g0 deep ground, g1/g2 the two frame lacquers, b0/b1 blade base and tip,
  // s0/s1 the second pinwheel, line the luminous frames, warm the drop's
  // accent that the frames take on.
  const INKS = [
    { name: 'Lapis & brass', g0: '#060d18', g1: '#17324a', g2: '#23575a', b0: '#b36a2e', b1: '#f3d7a2',
      s0: '#9c3b30', s1: '#f0a27a', line: '#bff2e6', warm: '#c0703a' },
    { name: 'Oxblood & bone', g0: '#0e0508', g1: '#3a1420', g2: '#5e2a2a', b0: '#b9a282', b1: '#f4ead6',
      s0: '#274e58', s1: '#8cc2c0', line: '#ffd9ae', warm: '#8a3a2a' },
    { name: 'Verdigris', g0: '#050d0b', g1: '#153a31', g2: '#2e5f52', b0: '#c46a3a', b1: '#f2dcae',
      s0: '#4a2d52', s1: '#c49ad0', line: '#f4f1d8', warm: '#6c7a3a' },
    { name: 'Dusk', g0: '#0b0718', g1: '#2a1c50', g2: '#1a4a66', b0: '#5fb3b0', b1: '#eef2f0',
      s0: '#c0506a', s1: '#f6c0b0', line: '#e6d8ff', warm: '#6a2e70' },
  ].map((k) => ({ name: k.name, lab: ['g0', 'g1', 'g2', 'b0', 'b1', 's0', 's1', 'line', 'warm'].map((f) => oklab(k[f])) }));
  const INK_U = ['g0', 'g1', 'g2', 'b0', 'b1', 's0', 's1', 'lineC', 'warmC'];

  const PRESETS = {
    calm: { spin: 0.55, breath: 0.7, lines: 0.55, planes: 0, camera: 0.7 },
    drop: { spin: 1.5, breath: 1.35, lines: 1.15, planes: 1, camera: 1.35 },
    // Eight blades and a lot of line work, slow: a drawing instrument.
    lattice: { blades: 8, spin: 0.35, breath: 0.45, lines: 1.4, planes: 1, camera: 0.5 },
    // Only the toy and its shadow over a quiet, almost still nest.
    toy: { inks: 1, blades: 4, spin: 0.9, breath: 0.25, lines: 0.15, planes: 0, camera: 1 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['spin', 'breath', 'lines', 'planes', 'camera'];

  const VS = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 res;
uniform float T;
uniform vec2 camFg, camBg, camOl;  // per-plane camera offsets (parallax)
uniform float camRot, zoom;
uniform float bgPhase, bgTwist, bgSpin;
uniform vec2 bgCentre;
uniform float wheel, beta, nBl, alt;
uniform float wheel2, beta2, plane2;
uniform vec2 Ldir;
uniform float olPhase, olRot, olGain, hat, hatSeed, snareR, snareA, rays, rayPhase, warmMix, depthLift;
uniform vec3 g0, g1, g2, b0, b1, s0, s1, lineC, warmC;

const float PI = 3.14159265;
const float TAU = 6.28318531;

vec3 lab2lin(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 mixLab(vec3 a, vec3 b, float t) { return lab2lin(mix(a, b, t)); }

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float h11(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float h21(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float sdBox(vec2 p, float s) { vec2 d = abs(p) - vec2(s); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// Isosceles triangle, tip at the origin, base at y = q.y, half-width q.x (iq).
float sdTri(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)), vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

// One blade of a wheel, in the wheel's own frame. Returns the distance;
// pb is the blade frame: x from the pivot along the blade, y across it.
const float R0 = 0.05;
float blade(vec2 w, float i, float wh, float bt, float n, float len, float hw, out vec2 pb, out float L) {
  float th = wh + i * TAU / n;
  vec2 pl = rot(-th) * w;
  pb = rot(-bt) * (pl - vec2(R0, 0.0));
  // Even wheels alternate long and short blades: a compass rose.
  L = len * (alt > 0.5 && mod(i, 2.0) > 0.5 ? 0.66 : 1.0);
  return sdTri(vec2(pb.y, L - pb.x), vec2(hw * L / len, L));
}

// Nearest-sector candidates: a blade opened by beta swings its tip up to
// ~1.5 sectors round, so five candidates always cover the pixel.
float wheelDist(vec2 w, float wh, float bt, float n, float len, float hw) {
  float a = atan(w.y, w.x) - wh;
  float s0 = floor(a * n / TAU + 0.5);
  float d = 1e9; vec2 pb; float L;
  for (int k = -2; k <= 2; k++) d = min(d, blade(w, s0 + float(k), wh, bt, n, len, hw, pb, L));
  return d;
}

// Shade the top blade under w. Returns coverage in a; colour in col.
// Lower relative index is on top: with beta > 0 each blade swings over its
// successor, as the sails of a paper pinwheel lap.
float wheelShade(vec2 w, float wh, float bt, float n, float len, float hw, vec3 inkA, vec3 inkB,
                 vec3 Lw, float px, float seed, out vec3 col) {
  float a = atan(w.y, w.x) - wh;
  float s0 = floor(a * n / TAU + 0.5);
  float cover = 0.0; col = vec3(0.0);
  float topK = 99.0; vec2 tpb; float td = 1e9, tL = 1.0, ti = 0.0;
  for (int k = 2; k >= -2; k--) {
    vec2 pb; float L;
    float i = s0 + float(k);
    float d = blade(w, i, wh, bt, n, len, hw, pb, L);
    float c = smoothstep(px, -px, d);
    if (c > 0.0) {
      // Composite back to front as we go, so antialiased edges over the
      // blade beneath stay clean.
      float t = clamp(pb.x / L, 0.0, 1.0);
      float side = pb.y >= 0.0 ? 1.0 : -1.0;
      // Two facets either side of the crease; the crease is the ridge.
      float th = wh + i * TAU / n + bt;
      vec3 N = normalize(vec3(rot(th) * vec2(0.0, side * 0.62), 1.0));
      float dif = max(dot(N, Lw), 0.0);
      vec3 alb = mixLab(inkA, inkB, clamp(0.15 + 0.75 * t + 0.1 * side, 0.0, 1.0));
      // Paper fibre along the blade, and a fine speckle.
      float fib = vnoise(vec2(pb.x * 70.0 + i * 13.1 + seed, pb.y * 260.0));
      float spk = vnoise(pb * 520.0 + i * 7.0);
      alb *= 0.88 + 0.12 * fib + 0.06 * (spk - 0.5);
      float crease = exp(-abs(pb.y) / (px * 1.2)) * (dif > 0.7 ? 0.35 : -0.12);
      // Occlusion where blades gather at the hub.
      float ao = mix(0.55, 1.0, smoothstep(0.0, 0.09, pb.x));
      // A thin lit rim on the sun side of each cut edge.
      float rim = smoothstep(px * 2.5, 0.0, abs(d)) * 0.25 * max(dif - 0.5, 0.0);
      vec3 cc = alb * (0.22 + 0.95 * dif) * ao + crease + rim;
      // Shadow of the blades lapped over this one (the ones with lower k).
      float sh = 0.0;
      if (k > -2) {
        vec2 ws = w - Lw.xy * 0.012;
        for (int j = -2; j < 2; j++) {
          if (j >= k) break;
          vec2 q; float Lq;
          float ds = blade(ws, s0 + float(j), wh, bt, n, len, hw, q, Lq);
          sh = max(sh, smoothstep(0.012, -0.004, ds));
        }
      }
      cc *= 1.0 - 0.45 * sh;
      col = mix(col, cc, c);
      cover = max(cover, c);
    }
  }
  return cover;
}

void main() {
  float sh_ = min(res.x, res.y);
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / sh_;
  float px = 1.5 / sh_;                  // a pixel and a half, short-side units
  vec3 Lw = normalize(vec3(Ldir * 0.78, 0.62));

  // ---- camera: one rotation and zoom, a different offset per plane
  vec2 view = rot(camRot) * q / zoom;
  vec2 wf = view + camFg;                // pinwheel plane
  vec2 wb = view * 0.82 + camBg;         // the nest is farther: less pan
  vec2 wo = view * 1.08 + camOl;         // the lines are nearest

  // ---- background: the nest
  vec2 b = wb - bgCentre;
  float fz = fract(bgPhase), base = floor(bgPhase);
  const float S = 1.7;
  const float KI = 0.6;                  // each level is this much of the one outside
  float dOut = 1.0, dIn = 0.0, cL = 0.0, aL = 0.0;
  vec2 lpL = b;
  bool found = false, deepest = true;
  for (int k = 0; k < 12; k++) {
    float c = float(k) - fz;
    float sz = S * pow(KI, c);
    float al = bgTwist * c + bgSpin;
    vec2 lp = rot(-al) * b;
    float d = sdBox(lp, sz);
    if (d < 0.0) { dOut = -d; cL = c; aL = al; lpL = lp; found = true; }
    else { dIn = d; deepest = false; break; }
  }
  float lvl = cL + base + fz;            // stable level identity
  float szL = S * pow(KI, cL);
  float bandW = szL * (1.0 - KI);
  float u = deepest ? 1.0 : clamp(dOut / max(dOut + dIn, 1e-5), 0.0, 1.0);
  // Moulding profile: rises from the outer edge, falls to the inner one.
  vec2 sideL = abs(lpL.x) > abs(lpL.y) ? vec2(sign(lpL.x), 0.0) : vec2(0.0, sign(lpL.y));
  vec2 sideW = rot(aL) * sideL;
  float slope = 0.9 * cos(PI * u);
  vec3 Nb = normalize(vec3(sideW * slope, 1.0));
  float difB = max(dot(Nb, Lw), 0.0);
  float pick = h11(lvl * 1.37 + 0.5);
  vec3 lac = mixLab(g1, g2, smoothstep(0.25, 0.75, pick));
  lac = mix(lac, lab2lin(mix(g1, warmC, 0.6)), warmMix * step(0.62, pick));
  // Depth: farther (smaller) levels sink into the ground ink.
  float depth = clamp(cL / 8.0, 0.0, 1.0);
  vec3 bg = lac * (0.1 + 1.15 * pow(difB, 1.6));
  // A gilt bead just inside each frame's outer lip, catching the lamp.
  float bead = smoothstep(0.035, 0.05, u) * (1.0 - smoothstep(0.085, 0.1, u));
  float beadSlope = cos(PI * (u - 0.035) / 0.065);
  vec3 Nbd = normalize(vec3(sideW * beadSlope * 1.2, 1.0));
  float spec = pow(max(dot(reflect(-Lw, Nbd), vec3(0, 0, 1)), 0.0), 12.0);
  vec3 gilt = mixLab(b0, b1, 0.35) * (0.15 + 0.7 * max(dot(Nbd, Lw), 0.0)) + spec * 0.35;
  // Grain that zooms with its level, and a brushed direction along the side.
  vec2 gl = lpL / szL;
  float grain = vnoise(gl * 38.0 + lvl * 3.1) * 0.6 + vnoise(vec2(dot(gl, sideL.yx) * 9.0, dot(gl, sideL) * 160.0) + lvl) * 0.4;
  bg *= 0.84 + 0.3 * grain;
  bg = mix(bg, gilt * (0.9 + 0.2 * grain), bead * (1.0 - depth));
  // The outer frame shades the start of each band: a recess.
  float rec = smoothstep(0.0, 0.3, u);
  bg *= mix(0.45, 1.0, rec);
  bg = mix(bg, lab2lin(g0) * 0.6, depth * depth * (0.85 - 0.35 * depthLift));
  if (deepest) bg = lab2lin(g0) * 0.5;
  // Hairline where two levels meet, to crisp the mitre.
  bg *= 1.0 - 0.35 * smoothstep(px * 1.5, 0.0, min(dOut, dIn + (deepest ? 1.0 : 0.0)));

  vec3 col = bg;

  // ---- pinwheel shadow on the far nest: large offset, soft
  const float LEN = 0.34, HW = 0.115, HW2 = 0.16;
  float dsh = wheelDist(wf - Lw.xy * 0.06, wheel, beta, nBl, LEN, HW);
  float shadow = smoothstep(0.035, -0.02, dsh) * 0.55;
  if (plane2 > 0.001) {
    float d2 = wheelDist((wf - Lw.xy * 0.075) / 0.58, wheel2, beta2, nBl, LEN, HW2) * 0.58;
    shadow = max(shadow, smoothstep(0.03, -0.02, d2) * 0.45 * plane2);
  }
  col *= 1.0 - shadow;

  // ---- the pinwheel
  vec3 wc;
  float cov = wheelShade(wf, wheel, beta, nBl, LEN, HW, b0, b1, Lw, px, 0.0, wc);
  col = mix(col, wc, cov);

  // ---- the second, smaller wheel in front (drop plane)
  if (plane2 > 0.001) {
    vec2 w2 = wf / 0.58;
    float d2s = wheelDist(w2 - Lw.xy * 0.03, wheel2, beta2, nBl, LEN, HW2);
    col *= 1.0 - smoothstep(0.03, -0.01, d2s) * 0.4 * plane2 * cov;
    vec3 wc2;
    float cov2 = wheelShade(w2, wheel2, beta2, nBl, LEN, HW2, s0, s1, Lw, px / 0.58, 5.0, wc2);
    col = mix(col, wc2, cov2 * plane2);
  }

  // ---- hub: a brass pin with a domed highlight
  float r = length(wf);
  float hubR = 0.03;
  if (r < hubR + px * 2.0) {
    vec2 hn = wf / hubR;
    float z = sqrt(max(1.0 - dot(hn, hn), 0.0));
    vec3 Nh = normalize(vec3(hn, z + 0.1));
    float dh = max(dot(Nh, Lw), 0.0);
    vec3 hc = mixLab(b0, b1, 0.5) * (0.2 + 0.9 * dh) + pow(max(dot(reflect(-Lw, Nh), vec3(0, 0, 1)), 0.0), 24.0) * 0.8;
    col = mix(col, hc, smoothstep(hubR, hubR - px, r));
  }

  // ---- overlay: luminous star outlines flying out from the pinwheel.
  // They echo the toy's own geometry at larger scales, so the lines read
  // as its wake rather than as a second tunnel over the nest. A star gauge
  // (homogeneous of degree one) gives every nested outline in O(1).
  vec2 ov = rot(-olRot) * wo;
  float nS = nBl;
  float half_ = PI / nS;
  float an = mod(atan(ov.y, ov.x), 2.0 * half_);
  an = abs(an - half_);
  an = half_ - an;                        // 0 at a tip, half_ at a valley
  vec2 pf = length(ov) * vec2(cos(an), sin(an));
  const float VAL = 0.42;
  vec2 A = vec2(1.0, 0.0), B = VAL * vec2(cos(half_), sin(half_));
  vec2 nrm = normalize(vec2(B.y - A.y, A.x - B.x));
  float cOff = dot(A, nrm);
  float g = max(dot(pf, nrm) / cOff, 1e-4);
  const float S2 = 1.5, K2 = 0.62;
  float fo = fract(olPhase), bo = floor(olPhase);
  float js = log(g / S2) / log(K2) + fo;
  float jn = floor(js + 0.5);
  float sz2 = S2 * pow(K2, jn - fo);
  float dl = abs(dot(pf, nrm) - sz2 * cOff);
  float id = jn + bo;
  // Some outlines are whole, some only tip marks: structure, not a tunnel.
  float tipOnly = h11(id * 3.7 + 1.0) < 0.5 ? 1.0 : 0.0;
  float brk = mix(1.0, 1.0 - smoothstep(0.18, 0.26, an / half_), tipOnly);
  float hb = h11(id * 1.91);
  float lb = 0.06 + 0.5 * hb * hb * hb;
  lb += hat * 1.5 * step(0.55, h11(id * 1.3 + hatSeed * 0.731));
  lb += snareA * 2.0 * exp(-pow((log(sz2) - log(max(snareR, 1e-3))) / 0.12, 2.0));
  lb *= smoothstep(0.12, 0.3, sz2) * (1.0 - smoothstep(1.0, 1.45, sz2));
  float core = smoothstep(px * 0.9, 0.0, dl);
  float halo = exp(-dl / (px * 3.5)) * 0.3 + exp(-dl / (px * 12.0)) * 0.035;
  vec3 lcol = lab2lin(mix(lineC, mix(lineC, warmC, 0.45), warmMix * step(0.5, h11(id * 2.3))));
  vec3 glow = lcol * (core + halo) * lb * brk * olGain;

  // ---- drop plane: dashed rays running outward along the blade axes
  if (rays > 0.001) {
    // One ray between each pair of blades; long dashes run outward.
    float ra = atan(wo.y, wo.x) - wheel2 * 0.35;
    float nr = nBl;
    float sect = ra * nr / TAU;
    float si = floor(sect + 0.5);
    float rl = length(wo);
    float fr = abs(fract(sect + 0.5) - 0.5) * TAU / nr * rl;
    float dp = fract(rl * 3.2 - rayPhase * 0.6 + h11(si) * 5.0);
    float dash = smoothstep(0.0, 0.08, dp) * (1.0 - smoothstep(0.3, 0.55, dp));
    float ray = (smoothstep(px * 1.0, 0.0, fr) + exp(-fr / (px * 4.0)) * 0.3) * dash
              * smoothstep(0.12, 0.3, rl) * (1.0 - smoothstep(0.8, 1.2, rl));
    glow += lcol * ray * rays * 0.7 * olGain;
  }
  // The lines pass over the toy but are fainter on it, so the paper stays paper.
  col += glow * (1.0 - 0.45 * cov);

  // ---- film of the surface: a little fine grain so flats never band
  col += (h21(gl_FragCoord.xy + fract(T * 7.13) * 97.0) - 0.5) * 0.012;
  col = max(col, 0.0);
  col = col / (1.0 + max(col - 0.85, 0.0));      // soft shoulder on the glow
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  VIZ.register({
    id: 'pinwheel',
    name: 'Whirligig',
    order: 830,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      { key: 'blades', label: 'Blades', type: 'range', min: 4, max: 10, default: 6, step: 1 },
      { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 2, default: PRESETS.calm.spin, step: 0.01 },
      { key: 'breath', label: 'Nest breathing', type: 'range', min: 0, max: 2, default: PRESETS.calm.breath, step: 0.01 },
      { key: 'lines', label: 'Glow lines', type: 'range', min: 0, max: 1.5, default: PRESETS.calm.lines, step: 0.01 },
      { key: 'planes', label: 'Extra planes', type: 'range', min: 0, max: 1, default: PRESETS.calm.planes, step: 0.01 },
      { key: 'camera', label: 'Camera drift', type: 'range', min: 0, max: 2, default: PRESETS.calm.camera, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    finish: { bloom: 0.7 },

    gallery: {
      title: 'Whirligig',
      technique: 'One WebGL2 fragment shader, three planes under a shared camera with per-plane parallax: a Droste nest of rotated square SDFs (eleven levels, each twisted from the last) shaded as lit mouldings with level-scaled grain; a pinwheel of isosceles-triangle SDFs evaluated over five nearest sectors, two lit facets per blade, fibre noise in blade space and offset-SDF soft shadows on the blades beneath and on the nest; log-spaced L-infinity outlines with narrow-core glow. Inks mixed in OKLab.',
      brief: 'A folded-paper pinwheel turns over a carved frame that nests into itself forever, while thin luminous frames stream out past it, and the camera drifts so the toy orbits the frame instead of sitting in it. The kick turns the pinwheel one notch with a small ratchet overshoot and opens or closes its blades a step, aligned star to swirl and back; the bass makes the nest breathe, expanding and collapsing its recursion; hats flicker a random handful of the glowing frames; a snare runs a light outward through them. The drop adds a second counter-rotating pinwheel in another ink and dashed rays along the blade axes, spins faster, warms some of the frames and pushes the camera further; the breakdown steps slowly on its own.',
      lineage: 'After the principles, not the look, of scene 4 ("cosmic pinwheel") of a professional VJ set Raph studied on 2026-09-28 (docs/research/2026-09-28-lexsan-takeaways.md): several planes each moving differently, shading and texture rather than flat fills, a fractally breathing background, an overlay of glowing lines, and a camera that pans. Droste recursion after M. C. Escher\'s Print Gallery; the paper pinwheel after the folk toy. Jolt at 640x360: calm (kickArea 0.39, ratio 1.09) once the overlay\'s rotation was decoupled from the kick notch (it had swung every line on each kick: 0.52, jarring). 60 fps at 3024x1890 on an M4 Pro with the Finish on.',
    },

    glCanvas: null,
    gl: null,
    glFailed: false,

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, energy: 0, low: 0, dropOn: false, auto: 0,
        b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, auto: 0 };
      this.hatSeed = 0;
      this.step = 0;
      this.wheelBase = 0;
      this.notch = { from: 0, to: 0, t: 1, dur: 0.3 };
      this.open = { from: 0.6, to: 0.6, t: 1, dur: 0.3 };
      this.wheel2 = 0;
      this.plane2 = 0;
      this.bgPhase = 0;
      this.olPhase = 0;
      this.rayPhase = 0;
      this.camT = 0;
      this.snareAge = 9;
      this.warm = 0;
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('pinwheel shader: ' + gl.getShaderInfoLog(s));
        return s;
      };
      const pr = gl.createProgram();
      gl.attachShader(pr, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('pinwheel link: ' + gl.getProgramInfoLog(pr));
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      const u = {};
      const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(pr, i);
        u[info.name] = gl.getUniformLocation(pr, info.name);
      }
      this.glCanvas = c; this.gl = gl; this.prog = pr; this.vao = vao; this.u = u;
    },

    // Onsets against slow baselines (as in Chladni V2): only a jump is a hit.
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kickHit = false, snareHit = false, hatHit = false;
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
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hatHit = true; }
      e.prevH = hRaw;
      e.hat = Math.max(hatHit ? Math.max(hRaw, 0.6) : 0, e.hat * Math.exp(-dt / 0.09));

      // The sidechained bass ducks on every kick in the drop; a slow
      // follower keeps the nest's breath from becoming a second kick.
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 150), 1.3, dt);
      let tot = 0;
      for (let i = 0; i < 9; i++) tot += s[i];
      e.energy = ease(e.energy, tot / 900, 0.8, dt);
      // Section follower on band 1, with hysteresis (as in Aurora, re-inked).
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kickHit, snareHit, hatHit };
    },

    // Move the ratchet one notch: turn by half a blade spacing, and step the
    // blades' opening along 0 → ½ → 1 → ½ → 0, aligned star to swirl and back.
    advance(n, dur) {
      this.step++;
      const cur = this.valueOf(this.notch), curB = this.valueOf(this.open);
      this.notch = { from: cur, to: this.notch.to + Math.PI / n, t: 0, dur, back: true };
      const OPEN = [0, 0.5, 1, 0.5];
      this.open = { from: curB, to: 0.15 + 0.85 * OPEN[this.step % 4], t: 0, dur: dur * 1.3, back: false };
    },
    valueOf(a) {
      const k = clamp01(a.t / a.dur);
      return a.from + (a.to - a.from) * (a.back ? easeOutBack(k) : easeInOut(k));
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      if (!this.gl && !this.glFailed) this.initGL();
      if (this.glFailed) { p.background(10, 14, 24); return; }

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const hits = this.listen(signals, dt);
      const e = this.env;
      const push = params.push;
      this.T += dt;
      const T = this.T;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const n = Math.round(params.blades);
      const ink = INKS[Math.round(params.inks) % INKS.length];

      // ---- foreground: the ratchet
      const quick = clamp01(P.spin / 1.5);
      if (hits.kickHit && push > 0.05) {
        this.advance(n, 0.34 - 0.1 * quick);
        this.since.auto = 0;
      } else {
        // With no kick the toy still steps, slowly: the breakdown exhales.
        this.since.auto += dt;
        if (this.since.kick > 2 && this.since.auto > 2.6) { this.advance(n, 1.4); this.since.auto = 0; }
      }
      this.notch.t += dt; this.open.t += dt;
      this.wheelBase += dt * P.spin * 0.12;
      const wheel = this.wheelBase + this.valueOf(this.notch);
      const beta = 1.05 * this.valueOf(this.open) * Math.min(1.3, 0.5 + 0.5 * push);
      this.plane2 = P.planes;
      this.wheel2 -= dt * (0.25 + 0.5 * P.spin) * (0.6 + e.energy);
      const wheel2 = this.wheel2 - 0.6 * this.valueOf(this.notch);
      const beta2 = 1.05 - beta * 0.7;

      // ---- background: the nest drifts inward and breathes in and out
      const br = P.breath;
      this.bgPhase += dt * (0.05 + 0.05 * br);
      const breathe = br * (0.55 * Math.sin(T * 0.23) + 0.3 * Math.sin(T * 0.091 + 1.3))
        + 0.9 * e.bass * push * Math.min(1.5, br + 0.3);
      const twist = 0.22 + 0.14 * br * Math.sin(T * 0.13 + 0.4) + 0.08 * e.bass * push;

      // ---- overlay
      this.olPhase += dt * (0.18 + 0.3 * P.spin + 0.25 * e.energy);
      this.rayPhase += dt * (1.2 + 1.5 * e.energy);
      if (hits.snareHit) this.snareAge = 0;
      this.snareAge += dt;
      const snareR = 0.06 + this.snareAge * 1.6;
      const snareA = Math.exp(-this.snareAge / 0.45) * Math.min(1.5, push);
      this.warm = ease(this.warm, e.dropOn ? 1 : 0, 0.5, dt);

      // ---- camera: the pinwheel orbits the frame centre, never in it
      this.camT += dt * P.camera * (0.7 + 0.6 * e.energy);
      const ct = this.camT;
      const orb = 0.3 + 0.07 * Math.sin(ct * 0.13);
      const cx = orb * 1.35 * Math.cos(ct * 0.11 + 0.8) + 0.05 * Math.sin(ct * 0.37);
      const cy = orb * 0.55 * Math.sin(ct * 0.11 + 0.8) + 0.04 * Math.sin(ct * 0.29 + 2);
      const camRot = 0.22 * Math.sin(ct * 0.07) + 0.08 * Math.sin(ct * 0.19);
      const zoom = 1.08 + 0.12 * Math.sin(ct * 0.09 + 1);
      const la = 2.3 + 0.35 * Math.sin(T * 0.05);

      // ---- GL
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      const c = this.glCanvas, gl = this.gl, u = this.u;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.T, T);
      gl.uniform2f(u.camFg, cx, cy);
      gl.uniform2f(u.camBg, cx * 0.45 + 0.03 * Math.sin(ct * 0.05), cy * 0.45);
      gl.uniform2f(u.camOl, cx * 1.12, cy * 1.12);
      gl.uniform1f(u.camRot, camRot);
      gl.uniform1f(u.zoom, zoom);
      gl.uniform1f(u.bgPhase, this.bgPhase + breathe);
      gl.uniform1f(u.bgTwist, twist);
      gl.uniform1f(u.bgSpin, -0.03 * T);
      gl.uniform2f(u.bgCentre, 0.12 * Math.sin(T * 0.03), -0.08 + 0.06 * Math.cos(T * 0.041));
      gl.uniform1f(u.wheel, wheel);
      gl.uniform1f(u.beta, beta);
      gl.uniform1f(u.nBl, n);
      gl.uniform1f(u.alt, n % 2 === 0 ? 1 : 0);
      gl.uniform1f(u.wheel2, wheel2);
      gl.uniform1f(u.beta2, beta2);
      gl.uniform1f(u.plane2, this.plane2);
      gl.uniform2f(u.Ldir, Math.cos(la), Math.sin(la));
      gl.uniform1f(u.olPhase, this.olPhase);
      gl.uniform1f(u.olRot, -0.35 * this.wheelBase + 0.02 * T);   // not the notch: a kick must not swing every line
      gl.uniform1f(u.olGain, P.lines);
      gl.uniform1f(u.hat, e.hat * Math.min(1.5, push));
      gl.uniform1f(u.hatSeed, this.hatSeed = hits.hatHit ? (this.hatSeed + 1) % 997 : this.hatSeed);
      gl.uniform1f(u.snareR, snareR);
      gl.uniform1f(u.snareA, snareA);
      gl.uniform1f(u.rays, P.planes);
      gl.uniform1f(u.rayPhase, this.rayPhase);
      gl.uniform1f(u.warmMix, this.warm);
      gl.uniform1f(u.depthLift, e.bass);
      INK_U.forEach((name, i) => gl.uniform3fv(u[name], ink.lab[i]));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      p.drawingContext.drawImage(c, 0, 0, ctx.width, ctx.height);
    },
  });
})();
