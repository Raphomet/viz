// Expressway — a night drive on an elevated city expressway.
//
// Layers, back to front: a sky with the city's glow on the horizon and a
// distant skyline that slides as the road turns; two ranks of towers on each
// side with lit windows and neon signs; the parallel deck on the left with
// oncoming headlights; our own carriageway (wet asphalt, lane dashes,
// barriers, sodium lamps, tail lights ahead); tunnels that the road runs into;
// and the windscreen, with rain beads that refract the view and a wiper.
//
// Everything is one analytic world evaluated per pixel in a WebGL2 shader:
// the road bends by offsetting world x by C·z², so every plane parallel to the
// road is a quadratic in depth and the curve is exact, not a screen warp. The
// wet road reflects the same world from a mirrored camera, with its lights'
// glows stretched vertically into the long streaks a wet road makes.
//
// The music:
//   bass   sets the speed; the drive eases between a glide and a rush.
//   kick   a pulse of light is fired down one row of lights: the LED strip on
//          the right-hand barrier in the open, the ceiling row in a tunnel. It
//          blooms hot on the near section and races off toward the vanishing
//          point. Nothing else moves on the kick.
//   snare  the wiper sweeps once across the lower right of the windscreen,
//          wiping the beads it crosses; they grow back.
//   hats   re-deal which rain beads catch a star-shaped glint.
//   drop   the road dives into a tunnel of colour: arches of neon in a
//          flowing gradient, and the speed surges. The breakdown drives out
//          of it into the open night again.

(function () {
  const RES = 0.6;         // GL layer at this fraction of device resolution
  const F = 330;           // focal length, virtual units (short side is 600)
  const HZ = 18;           // horizon height above the centre, virtual units
  const CAM_H = 1.4;       // eye height above the deck, metres
  const WIPE_T = 0.6;      // one wiper stroke, up and back, seconds

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;
uniform float unitPx;
uniform float camZ, C, yaw, heading, T;
uniform vec4  tun;        // two tunnels: entry, exit (relative depth)
uniform vec4  pul[4];     // kick pulses: age, amp
uniform float bass, drop, hat, hatSeed, tunGlow;
uniform float rainK, trafficK, halfW;
uniform vec2  wipe;       // start times (T) of the latest and previous strokes
uniform vec3  pal[5];
uniform vec3  cLamp, cKick, cGlow;
out vec4 outColor;

const float F = ${F}.0;
const float HZ = ${HZ}.0;
const float H = ${CAM_H};
const float TW = ${WIPE_T};
const float TUN_X = 8.6;       // tunnel half width
const float TUN_Y = -H + 6.6;  // tunnel ceiling
const float PI = 3.14159265;
const float ARCH = 12.0;     // arch spacing in the tunnel, metres

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
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h21(vec2(i, 7.0)), h21(vec2(i + 1.0, 7.0)), f); }

float px;   // virtual units per GL pixel

// Smallest positive depth where the ray x = u t meets the bent plane
// x = X0 + C t^2; 1e9 if none. Stable form of the quadratic's roots.
float solveX(float X0, float u) {
  float disc = u * u - 4.0 * C * X0;
  if (disc < 0.0) return 1e9;
  float s = sqrt(disc);
  float q = 0.5 * (u + (u >= 0.0 ? s : -s));
  float t = 1e9;
  if (abs(C) > 1e-9) { float t1 = q / C; if (t1 > 0.0) t = t1; }
  if (abs(q) > 1e-7) { float t2 = X0 / q; if (t2 > 0.0) t = min(t, t2); }
  return t;
}

bool inTun(float t) {
  return (t > tun.x && t < tun.y) || (t > tun.z && t < tun.w);
}

// A box of width w centred on 0, box-filtered over a footprint fw: stripes
// that would shimmer at distance fade to their average instead.
float band(float x, float w, float fw) {
  fw = max(fw, 1e-4);
  float a = clamp((x + 0.5 * w + 0.5 * fw) / fw, 0.0, 1.0) - clamp((x - 0.5 * w + 0.5 * fw) / fw, 0.0, 1.0);
  return a;
}
// A repeating box of duty d, period 1, filtered over fw (in periods).
float stripes(float x, float d, float fw) {
  if (fw > 0.5) return d;
  float f = fract(x);
  return band(f - 0.5 * d, d, fw) + band(f - 1.0 - 0.5 * d, d, fw);
}

float glow(vec2 d, float r) {
  float dd = dot(d, d), rr = r * r;
  return exp(-dd / rr) + 0.06 * rr / (dd + rr);
}

vec3 cyc(float x) {
  x = fract(x) * 5.0;
  float i = floor(x), f = smoothstep(0.15, 0.85, fract(x));
  int a = int(i), b = int(mod(i + 1.0, 5.0));
  return mix(pal[a], pal[b], f);
}
vec3 archCol(float n) { return cyc(n * 0.061 - T * 0.07); }

// Kick pulse along a row of lights, by depth: a bloom on the near section
// that decays in ~0.15 s, and a front racing away down the row.
float pulse(float t) {
  float s = 0.0;
  for (int j = 0; j < 4; j++) {
    vec4 P = pul[j];
    if (P.y <= 0.0) continue;
    float zf = 4.0 + P.x * 120.0;
    float wf = 6.0 + P.x * 30.0;
    float dz = (t - zf) / wf;
    s += P.y * (exp(-dz * dz) * exp(-P.x * 1.8) * 1.3 + 1.2 * exp(-P.x / 0.1) * exp(-t / 10.0));
  }
  return s;
}

float fog(float t) { return exp(-t / 300.0); }

// ---------- the world: returns colour; kind 1 = wet road
vec3 world(float y0, vec2 uv, bool refl, float tmin, out float tHit, out int kind, out vec2 fp) {
  float u = uv.x, v = uv.y;
  tHit = 1e9; kind = 0; fp = vec2(0.0);
  vec3 col = vec3(0.0);
  float fpk = 1.0 / (F * unitPx);   // metres per GL pixel per metre of depth

  // Candidate surfaces; keep the nearest.
  int mat = 0;          // 0 sky, 1 road, 2 barrier, 3 building, 4 tunnel wall, 5 ceiling, 6 portal
  float matA = 0.0, matB = 0.0;

  // Road deck.
  if (v < 0.0) {
    float t = (-H - y0) / v;
    float xw = u * t - C * t * t;
    if (t > tmin && xw > -24.5 && xw < 8.0) { tHit = t; mat = 1; matA = xw; }
  }
  // Barriers: right edge, median, far edge of the other deck.
  for (int i = 0; i < 3; i++) {
    float X = i == 0 ? 7.6 : (i == 1 ? -7.6 : -24.5);
    float t = solveX(X, u);
    if (t < tHit && t > tmin) {
      float y = y0 + v * t;
      if (y > -H && y < -H + 0.9) { tHit = t; mat = 2; matA = y; }
    }
  }
  // Towers: two ranks each side.
  for (int i = 0; i < 4; i++) {
    float X = i == 0 ? 30.0 : (i == 1 ? 56.0 : (i == 2 ? -36.0 : -62.0));
    float t = solveX(X, u);
    if (t >= tHit || t <= tmin) continue;
    float zw = camZ + t;
    float bl = 24.0 + 9.0 * float(i);
    float id = floor(zw / bl);
    float f = fract(zw / bl);
    float hb = h21(vec2(id, float(i) * 13.0 + 1.0));
    if (f > 0.84 - 0.25 * hb * hb) continue;       // gap between buildings
    float top = -H + 4.0 + 75.0 * pow(h21(vec2(id, float(i) * 13.0 + 2.0)), 1.6);
    float y = y0 + v * t;
    if (y > top) continue;
    tHit = t; mat = 3; matA = float(i); matB = top;
  }
  // Tunnels.
  for (int k = 0; k < 2; k++) {
    float a = k == 0 ? tun.x : tun.z, b = k == 0 ? tun.y : tun.w;
    if (b <= max(tmin, 0.0)) continue;
    // Portal face at the entry.
    if (a > tmin && a < tHit) {
      float xw = u * a - C * a * a;   // world x relative to the road at that depth
      float y = y0 + v * a;
      bool opening = abs(xw) < TUN_X && y < TUN_Y && y > -H - 0.5;
      if (!opening && y < -H + 26.0 && y > -H - 6.0 && abs(xw) < 220.0) {
        tHit = a; mat = 6; matA = xw; matB = y;
      }
    }
    for (int s = 0; s < 2; s++) {
      float t = solveX(s == 0 ? TUN_X : -TUN_X, u);
      if (t > max(a, tmin) && t < b && t < tHit) {
        float y = y0 + v * t;
        if (y > -H && y < TUN_Y) { tHit = t; mat = 4; matA = y; }
      }
    }
    if (v > 0.0 || refl) {
      float t = (TUN_Y - y0) / v;
      if (t > 0.0 && t > max(a, tmin) && t < b && t < tHit) {
        float xw = u * t - C * t * t;
        if (abs(xw) < TUN_X) { tHit = t; mat = 5; matA = xw; }
      }
    }
  }

  // Sign gantries across the road: something big to pass under, now and then.
  {
    float gz = 260.0;
    float k0 = ceil((camZ + max(tmin, 0.5)) / gz);
    for (int j = 0; j < 2; j++) {
      float tg = (k0 + float(j)) * gz - camZ;
      if (tg <= tmin || tg >= tHit || inTun(tg)) continue;
      float x = u * tg - C * tg * tg, y = y0 + v * tg;
      bool beam = abs(x) < 8.6 && y > -H + 6.7 && y < -H + 7.3;
      bool leg = abs(abs(x) - 8.3) < 0.22 && y > -H && y < -H + 7.3;
      bool board = x > 0.6 && x < 6.6 && y > -H + 4.4 && y < -H + 6.9;
      if (beam || leg || board) { tHit = tg; mat = board ? 8 : 7; matA = x; matB = y; }
    }
  }

  float t = tHit;
  float zw = camZ + t;
  float foot = t * fpk;   // metres per GL pixel across the view at this depth
  bool tunHere = inTun(t);

  if (mat == 0) {
    // Sky: city glow on the horizon, a distant skyline, a few stars.
    float alt = v;
    col = mix(cGlow * (0.55 + 0.5 * bass), vec3(0.0015, 0.0015, 0.005), smoothstep(-0.02, 0.35, alt));
    float az = u * 0.9 + heading;
    float cell = floor(az / 0.018);
    float hh = h21(vec2(cell, 3.0));
    float gate = smoothstep(0.3, 0.6, n1(az * 3.0 + 11.0));
    float th = (0.012 + 0.09 * hh * hh * hh) * (0.35 + 0.65 * gate);
    if (alt < th) {
      col = vec3(0.004, 0.004, 0.008) + cGlow * 0.12;
      vec2 wc = vec2(az / 0.0035, alt / 0.0035);
      float lit = step(0.8, h21(floor(wc) + cell * 3.1));
      col += mix(vec3(1.0, 0.7, 0.4), vec3(0.6, 0.8, 1.0), h21(floor(wc) + 9.0)) * lit * 0.25 * fog(120.0);
      if (hh > 0.8) {
        vec2 bd = vec2((fract(az / 0.018) - 0.5) * 0.018, alt - th) * F;
        col += vec3(1.0, 0.1, 0.05) * glow(bd, 0.9 * px) * 2.0 * step(0.5, fract(T * 0.5 + hh * 7.0));
      }
    } else if (alt > 0.06) {
      vec2 sc = vec2(az, alt) * 40.0;
      vec2 sid = floor(sc);
      float sh = h21(sid + 41.0);
      if (sh > 0.95) {
        vec2 sp = sid + 0.2 + 0.6 * h22(sid);
        float d = length(sc - sp) / 40.0 * F / px;
        col += vec3(0.8, 0.85, 1.0) * exp(-d * d) * pow(fract(sh * 37.0), 3.0) * 0.8;
      }
    }
  } else if (mat == 1) {
    float xw = matA;
    kind = 1; fp = vec2(xw, zw);
    col = vec3(0.0025, 0.0025, 0.003);
    // Lane markings: dashes between lanes, solid edge lines.
    float fx = foot;
    float fz = foot * t / max(H, 0.1);
    float dash = stripes(zw / 12.0, 0.35, fz / 12.0);
    float m = (band(abs(xw) - 1.8, 0.14, fx) * dash + band(abs(xw) - 5.4, 0.16, fx) + band(xw + 11.0, 0.14, fx) * dash
      + band(xw + 17.0, 0.14, fx) * dash) * 0.1;
    if (!tunHere) {
      float lz = zw - floor(zw / 34.0 + 0.5) * 34.0;
      float pool = exp(-((xw - 7.2) * (xw - 7.2) + lz * lz) / 40.0) + exp(-((xw + 8.4) * (xw + 8.4) + lz * lz) / 50.0);
      col += cLamp * (0.012 * pool + 0.0008);
      col += vec3(m) * (0.15 + 0.6 * pool);
    } else {
      float n = floor(zw / ARCH + 0.5);
      float dz = zw - n * ARCH;
      col += archCol(n) * exp(-abs(dz) / 2.5) * 0.12 * tunGlow * smoothstep(6.0, 34.0, t);
      col += vec3(m) * 0.5;
    }
  } else if (mat == 2) {
    float y = matA;
    col = vec3(0.003, 0.003, 0.0035);
    float lz = zw - floor(zw / 34.0 + 0.5) * 34.0;
    if (!tunHere) col += cLamp * 0.012 * exp(-lz * lz / 120.0);
    else col += archCol(floor(zw / ARCH + 0.5)) * 0.05 * tunGlow * smoothstep(6.0, 34.0, t);
    col *= 0.6 + 0.4 * smoothstep(-H, -H + 0.9, y);
  } else if (mat == 3) {
    int i = int(matA);
    float top = matB;
    float y = y0 + v * t;
    float X = abs(u * t - C * t * t);
    float fzp = foot * t / max(X, 1.0);   // metres per pixel along the facade
    col = vec3(0.002, 0.002, 0.004) + cGlow * 0.015;
    float bl = 24.0 + 9.0 * matA;
    float id = floor(zw / bl);
    float style = h21(vec2(id, 5.0 + matA));
    // Windows.
    vec2 wc = vec2(zw / 2.6, (y + 80.0) / 3.3);
    vec2 wid = floor(wc);
    float lit = step(0.5 + 0.25 * style, h21(wid + vec2(id * 7.0, matA * 3.0)));
    float wx = stripes(wc.x, 0.45, fzp / 2.6);
    float wy = stripes(wc.y, 0.4, foot / 3.3);
    vec3 wcol = mix(vec3(1.0, 0.62, 0.3), vec3(0.5, 0.72, 1.0), step(0.62, style));
    wcol = mix(wcol, pal[int(mod(id, 5.0))], 0.25 * step(0.8, style));
    float wb = 0.12 + 0.6 * pow(h21(wid + 3.0), 2.0);
    col += wcol * lit * wx * wy * wb * 0.3;
    // Neon signs down the front edge of some towers.
    float sh = h21(vec2(id, 9.0 + matA));
    if (sh < 0.5) {
      float f = fract(zw / bl);
      float sy = top - 3.0 - 16.0 * fract(sh * 5.3);
      float sgn = band(f * bl - 1.2, 1.6, fzp) * band(y - sy + 5.0, 10.0, foot);
      vec3 sc = pal[int(mod(id + matA, 5.0))];
      float flick = 0.85 + 0.15 * sin(T * 3.0 + sh * 50.0);
      col += sc * sgn * 2.2 * flick;
      col += sc * 0.12 * exp(-abs(f * bl - 1.2) / 3.0) * exp(-abs(y - sy + 5.0) / 8.0);
    }
    // Billboards: big fields of neon high on some towers.
    float bb = h21(vec2(id, 21.0 + matA));
    if (bb < 0.3) {
      float f = fract(zw / bl) * bl;
      float by0 = top - 20.0, by1 = top - 6.0;
      if (f > 3.0 && f < bl * 0.7 && y > by0 && y < by1) {
        vec3 c1 = pal[int(mod(id, 5.0))], c2 = pal[int(mod(id + 2.0, 5.0))];
        float g = (y - by0) / (by1 - by0);
        vec3 bcol = mix(c1, c2, smoothstep(0.2, 0.8, g + 0.2 * sin(f * 0.3 + T * 0.8 + bb * 40.0)));
        float scan = 0.8 + 0.2 * stripes((y - by0) / 0.6, 0.5, foot / 0.6);
        col = bcol * 0.55 * scan;
      }
    }
    // Rooftop red lights.
    if (style > 0.7) {
      float dy = (y - top) / foot;
      col += vec3(1.0, 0.08, 0.04) * exp(-dy * dy / 3.0) * band(fract(zw / bl) - 0.2, 0.05, fzp / bl) * 3.0;
    }
  } else if (mat == 4 || mat == 5) {
    float n = floor(zw / ARCH + 0.5);
    float dz = zw - n * ARCH;
    float fz = mat == 4 ? foot * t / TUN_X : foot * t / max(TUN_Y - y0, 0.5);
    vec3 ac = archCol(n);
    // Arches fade as they come close: a big rectangle of neon sweeping out
    // past the frame edge five times a second read as a full-frame strobe.
    float near = smoothstep(6.0, 34.0, t);
    ac *= near;
    col = vec3(0.004, 0.0045, 0.006);
    // Tiles.
    float tl = stripes(zw / 1.2, 0.93, fz / 1.2);
    col *= 0.7 + 0.3 * tl;
    col += ac * band(dz, 0.7, fz) * 1.3 * tunGlow;
    col += ac * 0.09 * exp(-abs(dz) / 1.8) * tunGlow;
    col += archCol(n + sign(dz)) * near * 0.04 * exp(-(ARCH - abs(dz)) / 1.8) * tunGlow;
    // Neon lines running the length of the tunnel. Lines along the direction
    // of travel stand still on screen, so they carry colour without flicker;
    // the colour itself flows along them, slower than the road.
    float ly = mat == 4 ? matA + H : abs(matA);
    float lf = mat == 4 ? foot * 1.0 : foot;
    for (int i = 0; i < 3; i++) {
      float at = mat == 4 ? 1.7 + 1.5 * float(i) : 1.6 + 2.2 * float(i);
      float ln = band(ly - at, 0.12, lf);
      vec3 lc = cyc(zw * 0.011 - T * 0.12 + float(i) * 0.21 + (mat == 4 ? 0.0 : 0.5));
      col += lc * ln * 0.9 * tunGlow;
      col += lc * exp(-abs(ly - at) / 0.35) * 0.05 * tunGlow;
    }
  } else if (mat == 7) {
    col = vec3(0.002, 0.002, 0.003);
  } else if (mat == 8) {
    // A lit sign board: a neon field with rows of bright lettering.
    float x = matA, y = matB;
    float gi = floor(zw / 260.0 + 0.5);
    vec3 bc = pal[int(mod(gi, 5.0))];
    col = bc * 0.05;
    vec2 lc = vec2((x - 0.6) / 0.35, (y + H - 4.4) / 0.42);
    float row = floor(lc.y);
    float on = step(0.35, h21(vec2(floor(lc.x), row + gi * 7.0))) * step(0.5, mod(row, 2.0)) * step(row, 4.0);
    col += vec3(0.9, 0.95, 1.0) * on * stripes(lc.x, 0.7, foot / 0.35) * 0.6;
    float e = min(min(x - 0.6, 6.6 - x), min(y + H - 4.4, -H + 6.9 - y));
    col += bc * band(e - 0.08, 0.12, foot) * 1.5;
  } else if (mat == 6) {
    // Portal: a dark concrete face with a neon rim around the opening.
    col = vec3(0.003, 0.003, 0.004);
    float xw = matA, y = matB;
    float e = max(abs(xw) - TUN_X, y - TUN_Y);
    col += archCol(floor((camZ + t) / 9.0 + 0.5)) * (band(e - 0.5, 0.6, foot) * 3.0 + exp(-e / 3.0) * 0.2) * tunGlow;
  }
  if (mat != 0) col *= fog(t) * 0.85 + 0.15;
  if (mat != 0) col = mix(cGlow * 0.05, col, fog(t));

  // ---------- lights, with their glows (occluded by depth only)
  vec3 L = vec3(0.0);
  float sq = refl ? 0.22 : 1.0;   // a wet road stretches reflected lights into streaks
  // Street lamps on the right edge and the median.
  for (int s = 0; s < 2; s++) {
    float X = s == 0 ? 7.9 : -8.4;
    float Y = -H + 10.0;
    float t0 = solveX(X, u);
    if (t0 > 900.0) continue;
    float k0 = floor((camZ + t0) / 34.0 + 0.5);
    for (int j = -1; j <= 1; j++) {
      float tk = (k0 + float(j)) * 34.0 - camZ;
      if (tk < 1.0 || tk > tHit + 1.0 || inTun(tk)) continue;
      vec2 d = (uv - vec2((X + C * tk * tk) / tk, (Y - y0) / tk)) * F;
      d.y *= sq;
      float r = max(0.45 * F / tk, 1.3 * px);
      L += cLamp * glow(d, r) * 1.6 * fog(tk);
    }
  }
  // Traffic: tail lights in our two outer lanes, headlights on the other deck.
  for (int ln = 0; ln < 4; ln++) {
    float X = ln == 0 ? -3.6 : (ln == 1 ? 3.6 : (ln == 2 ? -14.0 : -18.5));
    float dir = ln < 2 ? 1.0 : -1.0;
    float V = ln == 0 ? 24.0 : (ln == 1 ? 19.0 : (ln == 2 ? 26.0 : 31.0));
    float sp = ln < 2 ? 55.0 : 40.0;
    float t0 = solveX(X, u);
    if (t0 > 900.0) continue;
    float base = (camZ + t0 - dir * V * T) / sp;
    float k0 = floor(base);
    for (int j = -1; j <= 1; j++) {
      float k = k0 + float(j);
      float hk = h21(vec2(k, float(ln) * 17.0 + 3.0));
      if (hk > 0.3 + 0.45 * trafficK) continue;
      float tk = (k + 0.7 * fract(hk * 13.1)) * sp + dir * V * T - camZ;
      if (tk < 2.0 || tk > tHit + 2.0) continue;
      if (ln >= 2 && inTun(tk)) continue;
      for (int s = -1; s <= 1; s += 2) {
        float Xl = X + float(s) * 0.78;
        float Yl = -H + (dir > 0.0 ? 0.85 : 0.7);
        vec2 d = (uv - vec2((Xl + C * tk * tk) / tk, (Yl - y0) / tk)) * F;
        d.y *= sq;
        if (dir > 0.0) {
          float r = max(0.14 * F / tk, 1.1 * px);
          L += vec3(1.0, 0.06, 0.03) * glow(d, r) * 1.6 * fog(tk);
        } else {
          float r = max(0.22 * F / tk, 1.2 * px);
          L += vec3(1.0, 0.93, 0.8) * glow(d, r) * 2.2 * fog(tk);
        }
      }
    }
  }
  // The kick row, outside: an LED strip along the top of the right barrier.
  {
    float X = 7.5, Y = -H + 0.95;
    float tb = solveX(X, u);
    if (tb < 900.0 && tb < tHit + 1.0) {
      float vy = (Y - y0) / tb;
      float d = (v - vy) * F * sq;
      float r = max(0.07 * F / tb, 0.9 * px);
      float zb = camZ + tb;
      float dots = stripes(zb / 2.5, 0.4, tb * fpk * tb / X / 2.5);
      float p = pulse(tb) * (refl ? 0.5 : 1.0);
      float g = exp(-d * d / (r * r));
      float halo = exp(-abs(d) / (r * 2.0 + 2.0));
      L += vec3(1.0, 0.55, 0.2) * g * dots * 0.35 * fog(tb);
      L += cKick * p * (g * (0.6 + dots) * 1.6 + halo * 0.1) * fog(tb);
    }
  }
  // The kick row in a tunnel: the ceiling lamps.
  if (v > 0.0 || refl) {
    float tc = (TUN_Y - 0.05 - y0) / v;
    if (tc > 0.0 && inTun(tc) && tc < tHit + 1.0) {
      float xw = u * tc - C * tc * tc;
      float d = xw / tc * F * sq;
      float r = max(0.25 * F / tc, 1.0 * px);
      float zc = camZ + tc;
      float lamps = stripes(zc / 5.0, 0.55, tc * fpk * tc / 6.6 / 5.0);
      float p = pulse(tc) * (refl ? 0.5 : 1.0);
      float g = exp(-d * d / (r * r));
      L += vec3(0.8, 0.9, 1.0) * g * lamps * 0.5 * fog(tc);
      L += cKick * p * (g * (0.5 + lamps) * 1.4 + exp(-abs(d) / (r * 1.5 + 2.0)) * 0.08) * fog(tc);
    }
  }
  return col + L;
}

void main() {
  px = 1.0 / unitPx;
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec2 uv = vec2(q.x / F + yaw, (q.y - HZ) / F);

  // ---------- the windscreen: rain beads, wiped by the wiper
  vec2 piv = vec2(halfW * 0.5, -335.0);
  float thR = PI - 0.04, thM = 0.62;
  float bladeL = 430.0;
  float bead = 0.0;
  vec2 lensUV = uv;
  vec3 beadAdd = vec3(0.0);
  if (rainK > 0.0) {
    float cs = 30.0;
    vec2 gc = q / cs;
    vec2 id = floor(gc);
    vec2 hh = h22(id + 11.0);
    if (hh.x < 0.32 * rainK) {
      vec2 c = (id + 0.25 + 0.5 * h22(id + 3.0)) * cs;
      float R = 2.5 + 8.0 * hh.y * hh.y;
      vec2 o = q - c;
      float r = length(o) / R;
      if (r < 1.2) {
        float P = 3.0 + 5.0 * fract(hh.x * 31.0);
        float ph = fract(hh.y * 17.0) * P;
        float born = floor((T + ph) / P) * P - ph;
        // When did the wiper last cross this bead?
        vec2 dv = c - piv;
        float clearT = -1e9;
        float a = (atan(dv.y, dv.x) - thR) / (thM - thR);
        if (a >= 0.0 && a <= 1.0 && length(dv) < bladeL) {
          float s1 = TW / PI * asin(a), s2 = TW - s1;
          for (int w = 0; w < 2; w++) {
            float ws = w == 0 ? wipe.x : wipe.y;
            if (T >= ws + s2) clearT = max(clearT, ws + s2);
            else if (T >= ws + s1) clearT = max(clearT, ws + s1);
          }
        }
        float grow = smoothstep(0.0, 0.8, T - max(born, clearT));
        float life = 1.0 - smoothstep(P - 0.6, P, T - born);
        float R2 = R * (0.4 + 0.6 * grow);
        r = length(o) / R2;
        bead = (1.0 - smoothstep(0.85, 1.0 + px / R2, r)) * grow * life;
        if (bead > 0.0) {
          // A bead is a tiny lens: an inverted, wider view of the world.
          vec2 ql = c - o * 5.0 / max(0.4 + 0.6 * grow, 0.1);
          lensUV = vec2(ql.x / F + yaw, (ql.y - HZ) / F);
          // Rim and highlight.
          float rim = smoothstep(0.55, 1.0, r);
          vec2 hl = o / R2 - vec2(-0.35, 0.4);
          beadAdd += vec3(0.9, 0.95, 1.0) * exp(-dot(hl, hl) * 30.0) * 0.12;
          beadAdd -= vec3(0.003) * rim;
          // Hats: a re-dealt set of beads flare with a star glint.
          float pick = step(0.62, h21(id + vec2(hatSeed * 13.0, hatSeed * 7.0)));
          vec2 g = (o - vec2(-0.3, 0.35) * R2) / R2;
          float star = exp(-dot(g, g) * 25.0) + 0.5 * exp(-abs(g.x) * 30.0 - abs(g.y) * 3.0) + 0.5 * exp(-abs(g.y) * 30.0 - abs(g.x) * 3.0);
          beadAdd += vec3(1.0, 0.95, 0.9) * star * pick * hat * 1.4;
        }
      }
    }
  }

  float tHit; int kind; vec2 fp;
  vec3 col = world(0.0, uv, false, 0.0, tHit, kind, fp);
  if (kind == 1) {
    // Wet road: patchy puddles, more mirror-like toward the horizon.
    float pud = 0.55 + 0.45 * n1(fp.x * 0.35 + 3.1 * n1(fp.y * 0.05));
    float fres = mix(0.35, 0.8, smoothstep(0.0, 0.06, -uv.y + 0.0));
    fres = mix(0.8, 0.35, smoothstep(0.02, 0.25, -uv.y)) * pud;
    float th2; int k2; vec2 f2;
    vec3 rc = world(-2.0 * H, vec2(uv.x, -uv.y), true, tHit, th2, k2, f2);
    col += rc * fres * 0.7;
  }
  if (bead > 0.0) {
    float th3; int k3; vec2 f3;
    vec3 lc = world(0.0, lensUV, false, 0.0, th3, k3, f3);
    col = mix(col, lc * 1.4 + 0.004, bead) + beadAdd * bead;
  }

  // ---------- the wiper blade
  float ws = T - wipe.x;
  if (ws >= 0.0 && ws < TW) {
    float th = thR + (thM - thR) * sin(PI * ws / TW);
    float thp = thR + (thM - thR) * sin(PI * max(ws - 1.0 / 60.0, 0.0) / TW);
    vec2 dv = q - piv;
    float rr = length(dv);
    if (rr > 60.0 && rr < bladeL) {
      float ang = atan(dv.y, dv.x);
      float lo = min(th, thp), hi = max(th, thp);
      float dAng = abs(ang - th) * rr;
      float blade = 1.0 - smoothstep(2.0, 2.0 + 1.5 * px, dAng);
      float smear = (ang > lo && ang < hi) ? min(1.0, 5.0 / max((hi - lo) * rr, 1.0)) * 0.7 : 0.0;
      float k = max(blade, smear);
      col = mix(col, vec3(0.002), k * 0.92);
      col += vec3(0.6, 0.65, 0.75) * exp(-pow((ang - th) * rr + 2.2, 2.0) / 0.5) * 0.25 * (1.0 - smoothstep(0.0, 1.0, abs(ws / TW - 0.5) * 2.0 - 0.6));
    }
  }

  // Vignette, tone map.
  vec2 vq = q / vec2(halfW, 300.0);
  col *= 1.0 - 0.25 * dot(vq, vq) * 0.5;
  col = 1.0 - exp(-col * 1.3);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };

  // five neon colours (signs, tunnel arches), street lamps, kick row, sky glow
  const PALETTES = [
    { name: 'Neon', c: ['#ff2d95', '#28e0ff', '#9b5cff', '#ff8a2a', '#40ffb0'], lamp: '#ffa04a', kick: '#8ff4ff', glow: '#5a2a78' },
    { name: 'Sodium', c: ['#ff6a1a', '#ffd04a', '#ff2a3a', '#2ad7c8', '#ff9ad8'], lamp: '#ff8a2a', kick: '#ffe6a0', glow: '#6a3418' },
    { name: 'Ultraviolet', c: ['#7a3cff', '#ff3ad0', '#3a7aff', '#40f0ff', '#ff5a7a'], lamp: '#b8a8ff', kick: '#e8c8ff', glow: '#2a2470' },
  ].map((p) => ({ name: p.name, c: p.c.map(lin), lamp: lin(p.lamp), kick: lin(p.kick), glow: lin(p.glow) }));

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  VIZ.register({
    id: 'expressway',
    name: 'Expressway',
    order: 307,

    params: [
      { key: 'palette', label: 'City', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 2.5, default: 1, step: 0.01 },
      { key: 'tunnel', label: 'Tunnels', type: 'select', options: ['With the drop', 'Always', 'Never'], default: 0 },
      { key: 'rain', label: 'Rain', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'curves', label: 'Curves', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'traffic', label: 'Traffic', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Expressway',
      technique: 'WebGL2 fragment shader: one analytic night city evaluated per pixel (road bent by x += C·z², so every plane beside it is a quadratic in depth), a wet-road reflection from a mirrored camera with lights stretched into streaks, windscreen rain beads that re-evaluate the world as tiny inverted lenses, and an analytic wiper whose crossing time clears the beads; onsets detected in JS against slow baselines',
      brief: 'A night drive on an elevated expressway through a neon city: towers with lit windows and neon signs stream past on both sides, tail lights ahead and oncoming headlights on the other deck, sodium lamps, lane dashes and their streaked reflections on the wet road, rain beads on the windscreen. The bass sets the speed. Each kick fires a pulse of light down one row of lights (the barrier LED strip, or the ceiling row in a tunnel) that blooms near and races to the vanishing point. Each snare or clap sends the wiper once across the lower right of the screen, wiping the beads it crosses. Hats re-deal which beads catch a star glint. The drop dives into a tunnel of flowing neon arches and the speed surges; the breakdown drives out into the open night.',
      lineage: [
        'Brief 07 (batch 03): a night drive, after Raph singled out Flyover\'s Night drive and asked for more movement and a confined kick. Structure borrowed from Aurora: onsets against slow baselines in JS, events handed to the shader as travelling things rather than flashes.',
        'v1: one analytic world per pixel; the road bends by x += C·z², so the barriers, towers and tunnel walls are exact quadratics in depth and the curves are real, not a screen warp. Tunnels are real stretches of road opened ahead of the car when the drop registers, so the portal approaches and swallows the view; the exit is placed ahead when the drop ends. First sheet: structure worked, but the road glowed flat brown (lamp pools ~6 m wide at 8% gain), stars read as snow, and the tunnel walls washed out pastel. Jolt: kickArea 0.57, jarring: the ceiling-row halo, the barrier strip halo and its stretched reflection lit a third of the frame, and the near arches swept out past the frame edges five times a second.',
        'v2: asphalt, barriers and tunnel walls taken down to near-black so the wet reflections carry the road; kick halos narrowed and halved in the reflection; the near-bloom of the pulse shortened to ~10 m. Near arches fade out inside ~30 m, since a big neon rectangle sweeping past the edge is a full-frame strobe. That darkened the tunnel, so neon lines were run the length of the walls and ceiling instead: lines parallel to travel stand still on screen, carry colour with no flicker, and the colour flows along them. Jolt: kickArea 0.20, ratio 1.31, calm, with the kick a white-hot slug on the ceiling row and the barrier strip.',
        'v3: sign gantries to pass under, billboards on the towers, denser neon and warmer windows for the open road; the wiper blade got a lit edge so it reads against the dark as well as against the neon.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.camZ = 0;
      this.heading = 0;
      this.speed = 14;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.pulses = [];
      this.wipes = [-100, -100];
      this.tunnels = [];
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
      for (const n of ['res', 'unitPx', 'camZ', 'C', 'yaw', 'heading', 'T', 'tun', 'pul', 'bass', 'drop', 'hat',
        'hatSeed', 'tunGlow', 'rainK', 'trafficK', 'halfW', 'wipe', 'pal', 'cLamp', 'cKick', 'cGlow']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Onsets against slow baselines (as in Aurora), so a pad or riser that
    // lifts a whole band does not read as a hit; only a jump does.
    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      // Kick: band 0 leading band 1, which rejects the bass line's notes.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.pulses.unshift({ age: 0, amp: kRaw });
        this.pulses.length = Math.min(this.pulses.length, 4);
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.5 : 0.8, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      // One stroke at a time: a snare roll does not stack strokes.
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > WIPE_T && push > 0.05) {
        since.snare = 0;
        this.wipes = [this.T, this.wipes[0]];
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.0, dt);
    },

    // Tunnels are real stretches of road: one is opened some way ahead when
    // the drop arrives, so the portal approaches and swallows the car, and its
    // exit is placed ahead when the drop ends.
    tunnelsFor(mode) {
      const e = this.env;
      const ahead = Math.max(70, this.speed * 1.4);
      const open = this.tunnels.find((t) => t.b === Infinity);
      const want = mode === 1 || (mode === 0 && (open ? e.drop > 0.3 : e.drop > 0.55));
      if (want && !open) {
        this.tunnels.push({ a: this.camZ + ahead, b: Infinity });
      } else if (!want && open) {
        open.b = Math.max(open.a + 120, this.camZ + ahead);
      }
      this.tunnels = this.tunnels.filter((t) => t.b > this.camZ - 5);
      while (this.tunnels.length > 2) this.tunnels.shift();
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const halfW = ctx.width / 2;
      this.listen(signals, dt, push);
      const e = this.env;
      this.T += dt;
      for (const P of this.pulses) P.age += dt;
      this.pulses = this.pulses.filter((P) => P.age < 1.6);

      // The bass sets the speed; it eases, so the drive surges, never jerks.
      const cruise = params.speed * (14 + 26 * e.bass * Math.min(push, 1.5) + 30 * e.drop);
      this.speed = ease(this.speed, cruise, 0.6, dt);
      this.camZ += this.speed * dt;
      // Curves belong to the road, so they come round as fast as you drive.
      const z = this.camZ;
      const C = params.curves * 0.0012 * (0.7 * Math.sin(z * 0.0042) + 0.3 * Math.sin(z * 0.0017 + 1.3));
      this.heading += 2 * C * this.speed * dt * 0.5;
      this.tunnelsFor(params.tunnel | 0);

      const w = Math.round(p.width * p.pixelDensity() * RES);
      const h = Math.round(p.height * p.pixelDensity() * RES);
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Expressway needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const pal = PALETTES[(params.palette | 0) % PALETTES.length];
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, Math.min(w, h) / 600);
      gl.uniform1f(u.camZ, this.camZ);
      gl.uniform1f(u.C, C);
      gl.uniform1f(u.yaw, C * 28);
      gl.uniform1f(u.heading, this.heading % 1000);
      gl.uniform1f(u.T, this.T % 3600);
      const tun = new Float32Array([-1e6, -1e6, -1e6, -1e6]);
      this.tunnels.forEach((t, i) => {
        tun[i * 2] = t.a - this.camZ;
        tun[i * 2 + 1] = t.b === Infinity ? 1e6 : t.b - this.camZ;
      });
      gl.uniform4fv(u.tun, tun);
      const pul = new Float32Array(16);
      this.pulses.forEach((P, i) => pul.set([P.age, P.amp * push, 0, 0], i * 4));
      gl.uniform4fv(u.pul, pul);
      gl.uniform1f(u.bass, e.bass * push);
      gl.uniform1f(u.drop, e.drop);
      gl.uniform1f(u.hat, e.hat * push);
      gl.uniform1f(u.hatSeed, this.hatSeed);
      gl.uniform1f(u.tunGlow, 0.45 + 0.5 * e.drop + 0.4 * e.bass * push);
      gl.uniform1f(u.rainK, params.rain);
      gl.uniform1f(u.trafficK, params.traffic);
      gl.uniform1f(u.halfW, halfW);
      gl.uniform2f(u.wipe, this.wipes[0] % 3600, this.wipes[1] % 3600);
      gl.uniform3fv(u.pal, new Float32Array(pal.c.flat()));
      gl.uniform3fv(u.cLamp, pal.lamp);
      gl.uniform3fv(u.cKick, pal.kick);
      gl.uniform3fv(u.cGlow, pal.glow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
