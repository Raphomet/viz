// Zen V2 — a karesansui garden from above, where the music presses into the
// gravel and the rake combs it away again.
//
// V1 (web/scenes/zen.js) had the garden, the rake and a kick ring that faded
// in two seconds, so the gravel forgot the music at once while the maple
// leaves remembered it and nothing cleared them. V2 closes that loop with the
// scene's own logic:
// - The kick presses a ring round a stone (marching outward, five per stone,
//   the three large stones in turn). A fresh press is deep and dark, then
//   relaxes to a lasting impression that stays until a rake passes over it.
//   Each row remembers when a rake crossed it (start, end, direction), so the
//   shader can tell per pixel whether the ring came before or after the rake;
//   a rake therefore cuts rings off along a hard straight row edge, as a real
//   one would. The drop writes a record into the garden; the breakdown's one
//   slow rake combs it out. Leaves are swept the same way.
// - The drop brings more rakers instead of V1's instant re-raking wave (a
//   pattern swapped, not drawn): helpers walk in from the edges, each takes
//   the stalest row, and all rake the garden's next pattern at the bass's
//   pace. They finish their rows and walk off when the bass goes.
// - The sun travels: a slow azimuth swing (a clock slower than the song), so
//   stone shadows turn and grooves gain or lose relief. It sits lower and the
//   gravel is darker than V1, because the pale ground was reading as a lamp on
//   a projector. The drop is still the sun coming out, the breakdown a cloud.
// - The drone descends towards the stone being pressed on the drop and rises
//   again in the breakdown, eased over seconds so it never jolts.
//
// Craft notes carried from V1: the ground is one WebGL2 fragment shader; the
// grooves are level sets of a per-pattern "rake coordinate" with analytic
// gradients, lit by a low sun; nothing accumulates in textures, so minute ten
// is as clean as minute one. Music is handed to things in the garden, never
// to the frame: kick -> a pressed ring; snare -> a maple leaf falls; bass ->
// the rakes' pace and the sun; hats -> mica glints; drop -> the crew arrives.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_ROWS = 16;
  const MAX_RAKES = 4;       // the main rake and up to three helpers in the drop
  const RING_SLOTS = 15;     // five rings round each of the three large stones
  const RAKE_MARGIN = 60;    // a pass starts and ends this far off stage
  const TINES = 6;           // grooves per rake width
  const PATTERN_COUNT = 7;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;          // device pixels
uniform float uVpp;         // virtual units per device pixel
uniform vec2 uStage;        // virtual stage size
uniform float uTime;
uniform float uD;           // groove spacing
uniform float uRowH;
uniform int uRows;
uniform vec4 uRowInfo[${MAX_ROWS}];  // last finished pass: start t, end t, dir, pattern
uniform float uRakeSpan;             // x at which a pass starts (-margin) and its length
uniform vec4 uRake[${MAX_RAKES}];    // row, x, dir, pattern
uniform vec2 uRakeT[${MAX_RAKES}];   // start t, start x
uniform int uRakes;
uniform vec4 uStone[6];     // x, y, r, seed
uniform int uStones;
uniform vec4 uRing[${RING_SLOTS}];   // stone index, ring distance, fresh press, width
uniform float uRingT[${RING_SLOTS}]; // when it was pressed (< 0: never)
uniform vec3 uSunDir;       // towards the sun
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform float uSun;         // 0 overcast .. 1 full sun
uniform float uHat;
uniform vec2 uMaple;        // centre of the maple's crown (off stage)
uniform float uMapleR;
uniform float uShade;       // maple shade strength
uniform vec2 uSway;
uniform vec3 uGravel;
uniform vec3 uStoneA;
uniform vec3 uStoneB;
uniform vec3 uMossA;
uniform vec3 uMossB;
uniform vec4 uCam;           // centre x, y, rotation, zoom
uniform vec2 uCamOff;

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// The rake coordinate of pattern id at p: (f, df/dx, df/dy).
vec3 pattern(float id, vec2 p) {
  int k = int(id + 0.5);
  if (k == 1) {                         // waves
    float kx = 6.2831853 / (uStage.x * 0.42);
    float a = uD * 1.9;
    return vec3(p.y + a * sin(p.x * kx + 1.3), a * kx * cos(p.x * kx + 1.3), 1.0);
  }
  if (k == 2) {                         // great arcs from a centre far below
    vec2 c = vec2(uStage.x * 0.35, uStage.y * 1.9);
    vec2 q = p - c; float r = length(q);
    return vec3(r, q / r);
  }
  if (k == 3) {                         // ichimatsu checkerboard
    vec2 cell = floor(p / (uRowH * 1.5));
    if (mod(cell.x + cell.y, 2.0) < 0.5) return vec3(p.y, 0.0, 1.0);
    return vec3(p.x, 1.0, 0.0);
  }
  if (k == 4) {                         // one-armed spiral
    vec2 c = vec2(uStage.x * 0.62, uStage.y * 0.55);
    vec2 q = p - c; float r = max(length(q), 1.0);
    float th = atan(q.y, q.x);
    vec2 g = q / r + uD / 6.2831853 * vec2(-q.y, q.x) / (r * r);
    return vec3(r + uD * th / 6.2831853, g);
  }
  if (k == 5) {                         // overlapping ripples
    vec2 c1 = vec2(uStage.x * 0.18, uStage.y * 0.22);
    vec2 c2 = vec2(uStage.x * 0.84, uStage.y * 0.80);
    vec2 c3 = vec2(uStage.x * 0.55, uStage.y * 0.08);
    float d1 = length(p - c1), d2 = length(p - c2), d3 = length(p - c3) * 1.25;
    if (d1 < d2 && d1 < d3) return vec3(d1, normalize(p - c1));
    if (d2 < d3) return vec3(d2, normalize(p - c2));
    return vec3(d3, normalize(p - c3) * 1.25);
  }
  if (k == 6) {                         // long diagonal swells
    vec2 n = normalize(vec2(0.45, 1.0));
    float kx = 6.2831853 / (uStage.x * 0.8);
    float a = uD * 3.2;
    float s = dot(p, vec2(n.y, -n.x));
    return vec3(dot(p, n) + a * sin(s * kx), n + a * kx * cos(s * kx) * vec2(n.y, -n.x));
  }
  return vec3(p.y, 0.0, 1.0);           // 0: straight lines
}

// Irregular stone outline: signed distance and outward direction.
vec3 stoneSd(vec4 s, vec2 p) {
  vec2 q = p - s.xy;
  float ca = cos(s.w * 3.0), sa = sin(s.w * 3.0);
  vec2 qr = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
  qr.y /= 0.78;
  float th = atan(qr.y, qr.x);
  float R = s.z * (1.0 + 0.09 * sin(3.0 * th + s.w * 7.0) + 0.05 * sin(5.0 * th + s.w * 13.0)
                        + 0.03 * sin(9.0 * th + s.w * 3.0));
  float l = length(qr);
  float sd = (l - R) * 0.86;
  vec2 dir = length(q) > 0.001 ? q / length(q) : vec2(0.0, 1.0);
  return vec3(sd, dir);
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uVpp - uCam.xy;
  float cr = cos(-uCam.z), sr = sin(-uCam.z);
  vec2 p = uCam.xy + uCamOff + vec2(cr * sp.x - sr * sp.y, sr * sp.x + cr * sp.y) / uCam.w;

  // Nearest stone.
  float sdMin = 1e5; vec2 sdDir = vec2(0.0, 1.0); int si = -1;
  float sdS[6]; vec2 dirS[6];
  float shadow = 1.0;
  vec2 sunXY = normalize(uSunDir.xy);
  float shLen = uSunDir.z > 0.0 ? sqrt(1.0 - uSunDir.z * uSunDir.z) / uSunDir.z : 2.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uStones) break;
    vec4 s = uStone[i];
    vec3 r = stoneSd(s, p);
    sdS[i] = r.x; dirS[i] = r.yz;
    if (r.x < sdMin) { sdMin = r.x; sdDir = r.yz; si = i; }
    // Cast shadow: the stone swept away from the sun, as a capsule.
    vec2 a = s.xy, b = s.xy - sunXY * s.z * 0.8 * shLen;
    vec2 pa = p - a, ba = b - a;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float cd = length(pa - ba * hh) - s.z * (0.92 - 0.35 * hh);
    shadow *= mix(1.0, smoothstep(-5.0, 7.0 + hh * 10.0, cd), 1.0);
  }
  vec4 st = uStone[si < 0 ? 0 : si];
  float mossW = 7.0 + 15.0 * fbm(sdDir * 2.5 + st.w * 11.0);
  float ringZone = mossW + uD * 5.0;

  vec3 L = normalize(uSunDir);
  vec3 col;

  // Maple shade: leaf clumps inside the crown's shadow, swaying with the breeze.
  vec2 mp = p + uSway;
  float crown = 1.0 - smoothstep(uMapleR * 0.55, uMapleR, length(p - uMaple) + 60.0 * (fbm(p * 0.006) - 0.5));
  float clump = smoothstep(0.40, 0.62, fbm(mp * 0.008 + 3.0) + 0.18 * (fbm(mp * 0.035 + 9.0) - 0.5));
  clump *= 1.0 - 0.85 * smoothstep(0.58, 0.68, fbm(mp * 0.03 + 2.0));   // sun flecks through the leaves
  float shade = crown * clump * uShade;
  float sunVis = shadow * (1.0 - 0.85 * shade);

  if (sdMin < 0.0) {
    // ---- stone: a low dome with granular bumps.
    float u = clamp(-sdMin / (st.z * 0.75), 0.0, 1.0);
    float n1 = fbm(p * 0.09 + st.w * 5.0);
    float n2 = vnoise(p * 0.6);
    vec2 bump = vec2(vnoise(p * 0.07 + 1.3) - vnoise(p * 0.07 + 7.7), vnoise(p * 0.07 + 3.1) - vnoise(p * 0.07 + 5.5));
    vec3 n = normalize(vec3(sdDir * (1.0 - u) * 1.6 + bump * 0.9, 0.35 + u * 1.2));
    vec3 alb = mix(uStoneA, uStoneB, smoothstep(0.3, 0.75, n1)) * (0.9 + 0.2 * n2);
    // lichen freckles and a little moss creeping up the lower edge
    float lichen = smoothstep(0.72, 0.78, fbm(p * 0.05 + st.w * 3.0));
    alb = mix(alb, vec3(0.70, 0.72, 0.62), lichen * 0.45);
    float creep = smoothstep(0.35, 0.0, u) * smoothstep(0.5, 0.7, fbm(p * 0.08 + 4.0));
    alb = mix(alb, uMossA, creep * 0.8);
    float diff = max(dot(n, L), 0.0);
    // the stone does not shadow itself with its own capsule
    float selfSun = 1.0 - 0.85 * shade;
    col = alb * (uSunCol * diff * selfSun * mix(0.25, 1.25, uSun) + uSkyCol * (0.45 + 0.35 * n.z) * mix(1.6, 1.0, uSun));
  } else if (sdMin < mossW) {
    // ---- moss collar: a soft cushion, fine-grained.
    float u = sdMin / mossW;
    float g = fbm(p * 0.35 + 2.0);
    float fine = vnoise(p * 1.4);
    vec2 bump = vec2(vnoise(p * 0.5) - vnoise(p * 0.5 + 3.3), vnoise(p * 0.5 + 6.1) - vnoise(p * 0.5 + 9.2));
    vec3 n = normalize(vec3(-sdDir * 0.2 + sdDir * u * 0.9 + bump * 0.8, 1.0));
    vec3 alb = mix(uMossA, uMossB, smoothstep(0.35, 0.7, g)) * (0.8 + 0.35 * fine);
    float diff = max(dot(n, L), 0.0);
    float ao = mix(0.55, 1.0, smoothstep(0.0, 0.5, u));
    col = alb * (uSunCol * diff * sunVis * mix(0.25, 1.25, uSun) + uSkyCol * ao * mix(1.1, 0.55, uSun));
  } else {
    // ---- gravel.
    // Which pass of the rake this point last received: the finished pass
    // stored for its row, or a rake working the row right now if the point
    // lies behind its tines. passT is when the tines went over this point.
    int row = int(clamp(floor(p.y / uRowH), 0.0, float(uRows - 1)));
    vec4 ri = uRowInfo[row];
    float pid = ri.w;
    float fr = clamp(ri.z > 0.0 ? (p.x + uRakeSpan) / (uStage.x + 2.0 * uRakeSpan)
                                : (uStage.x + uRakeSpan - p.x) / (uStage.x + 2.0 * uRakeSpan), 0.0, 1.0);
    float passT = mix(ri.x, ri.y, fr);
    for (int k = 0; k < ${MAX_RAKES}; k++) {
      if (k >= uRakes) break;
      vec4 rk = uRake[k];
      if (int(rk.x + 0.5) != row) continue;
      if (rk.z > 0.0 ? p.x < rk.y : p.x > rk.y) {
        pid = rk.w;
        vec2 rt = uRakeT[k];
        float span = rk.y - rt.y;
        float q = abs(span) > 0.5 ? clamp((p.x - rt.y) / span, 0.0, 1.0) : 1.0;
        passT = mix(rt.x, uTime, q);
      }
    }
    vec3 f;
    bool rings = sdMin < ringZone;
    if (rings) f = vec3(sdMin - mossW, sdDir);
    else f = pattern(pid, p);
    float w = 6.2831853 / uD;
    float amp = uD * 0.18;   // V1 0.21: under the lower sun the dark flanks went to black stripes
    float hgt = 0.5 + 0.5 * cos(f.x * w);
    vec2 grad = -amp * 0.5 * w * sin(f.x * w) * f.yz;
    // Rings pressed by the kick: a trench with a lip, around one stone. They
    // last until a rake has passed over the point since they were pressed.
    float press = 0.0;
    for (int i = 0; i < ${RING_SLOTS}; i++) {
      float t0 = uRingT[i];
      if (t0 < 0.0 || t0 < passT) continue;
      vec4 r = uRing[i];
      int idx = clamp(int(r.x + 0.5), 0, 5);
      float sdv = sdS[idx]; vec2 sdd = dirS[idx];
      float x = (sdv - r.y) / r.w;
      if (abs(x) > 4.0) continue;
      float e = exp(-x * x);
      float str = 0.7 + r.z;                                  // lasting impression + fresh press
      float depth = uD * 1.1 * str;
      grad += depth * 2.0 * x / r.w * e * sdd;                // d/dsd of -depth*e
      float lip = exp(-(x - 1.6) * (x - 1.6) * 1.5);
      grad += -depth * 0.35 * 3.0 * (x - 1.6) / r.w * lip * sdd;
      press = max(press, e * (0.5 + 0.5 * min(1.0, r.z)));
    }
    vec3 n = normalize(vec3(-grad, 1.0));
    // grain
    vec2 gc = floor(p / 1.7);
    float gh = h21(gc);
    float gv = 0.86 + 0.2 * gh + 0.08 * (vnoise(p * 0.25) - 0.5);
    vec3 alb = uGravel * gv;
    alb *= mix(vec3(1.0), vec3(0.93, 0.95, 1.0), step(0.8, h21(gc + 7.0)));
    alb *= 1.0 - 0.36 * press;                                // compacted gravel reads darker
    float ao = mix(0.72, 1.0, hgt) * mix(0.55, 1.0, smoothstep(0.0, 26.0, sdMin - mossW));
    float diff = max(dot(n, L), 0.0);
    col = alb * (uSunCol * diff * sunVis * mix(0.22, 1.2, uSun) + uSkyCol * ao * mix(1.25, 0.52, uSun));
    // mica glints on sunlit ridges, dealt by the hats
    vec2 mc = floor(p / 3.4);
    vec2 mf = fract(p / 3.4) - 0.5;
    float glintCell = step(0.986, h21(mc + 3.0)) * smoothstep(0.5, 0.15, length(mf));
    float tw = 0.5 + 0.5 * sin(uTime * 7.0 + h21(mc + 11.0) * 60.0);
    float glint = glintCell * smoothstep(0.5, 1.0, tw) * smoothstep(0.2, 0.9, diff * sunVis) * uHat;
    col += vec3(1.0, 0.97, 0.9) * glint * 1.1;
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  // --- Light presets. `ground` is the gravel albedo.
  const LIGHTS = [
    // Lower and darker than V1's afternoon: on a projector the pale flat
    // gravel read as a floodlight; a low sun lets the relief carry the image.
    { name: 'Afternoon', az: -2.35, elev: 0.46, sun: [1.05, 0.92, 0.76], sky: [0.44, 0.50, 0.62],
      gravel: [0.80, 0.77, 0.71], stoneA: [0.50, 0.49, 0.47], stoneB: [0.36, 0.35, 0.35],
      mossA: [0.20, 0.33, 0.13], mossB: [0.36, 0.48, 0.18], rake: '#76502f', rakeHi: '#b88a58' },
    { name: 'Dusk', az: -2.75, elev: 0.30, sun: [1.15, 0.72, 0.46], sky: [0.34, 0.36, 0.52],
      gravel: [0.84, 0.79, 0.72], stoneA: [0.47, 0.44, 0.44], stoneB: [0.32, 0.30, 0.32],
      mossA: [0.17, 0.28, 0.12], mossB: [0.32, 0.42, 0.16], rake: '#6a4629', rakeHi: '#b07a48' },
    { name: 'Black sand', az: -2.2, elev: 0.55, sun: [1.0, 0.95, 0.88], sky: [0.42, 0.46, 0.55],
      gravel: [0.20, 0.20, 0.21], stoneA: [0.72, 0.70, 0.66], stoneB: [0.56, 0.54, 0.51],
      mossA: [0.22, 0.38, 0.14], mossB: [0.42, 0.56, 0.20], rake: '#a47a4c', rakeHi: '#d2a470' },
  ];

  const LEAF_COLS = ['#c8452a', '#d8672a', '#a8302b', '#e08a2e', '#b73a24', '#8f2a2a'];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  // Default stone layout, in fractions of the stage (x, y) and virtual radius:
  // a group of three and a pair, the classic odd-numbered asymmetric setting.
  const LAYOUT = [
    [0.30, 0.44, 58, 0.31], [0.385, 0.64, 27, 0.77], [0.215, 0.66, 20, 0.53],
    [0.735, 0.30, 42, 0.12], [0.80, 0.47, 22, 0.91],
  ];

  function leafPath(ctx, size) {
    // A seven-lobed Japanese maple leaf, stem towards +y. Lobes are broad
    // near the base and pointed at the tip; the sinuses cut about halfway in,
    // because thinner lobes read as starbursts at projector distance.
    ctx.beginPath();
    const lobes = 7, step = 0.5, sinus = 0.46;
    for (let i = 0; i < lobes; i++) {
      const a = -Math.PI / 2 + (i - (lobes - 1) / 2) * step;
      const len = size * (1 - Math.abs(i - 3) * 0.12);
      const a0 = a - step / 2, a1 = a + step / 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * size * sinus * 0.7, Math.sin(a0) * size * sinus * 0.7);
      ctx.bezierCurveTo(Math.cos(a - 0.2) * len * 0.62, Math.sin(a - 0.2) * len * 0.62,
        Math.cos(a - 0.07) * len * 0.9, Math.sin(a - 0.07) * len * 0.9, Math.cos(a) * len, Math.sin(a) * len);
      const r1 = (i === lobes - 1 ? 0.7 : 1) * size * sinus;
      ctx.bezierCurveTo(Math.cos(a + 0.07) * len * 0.9, Math.sin(a + 0.07) * len * 0.9,
        Math.cos(a + 0.2) * len * 0.62, Math.sin(a + 0.2) * len * 0.62, Math.cos(a1) * r1, Math.sin(a1) * r1);
    }
    ctx.lineTo(0, size * 0.18);
    ctx.closePath();
  }

  VIZ.register({
    id: 'zenv2',
    name: 'Zen',
    versionOf: 'zen',
    version: 'V2',
    order: 712,
    gallery: {
      title: 'Zen',
      technique: 'WebGL2 height-field shader (analytic groove gradients, per-row rake pass times deciding per pixel whether a pressed ring survives, travelling low sun, capsule stone shadows, fbm maple shade) under Canvas 2D rakes and falling maple leaves',
      brief: 'A karesansui garden from above in low, travelling sunlight. The kick presses rings into the gravel round one stone at a time, and they stay until a rake passes over them, so the drop leaves a record in the garden that a lone rake combs out through the breakdown. The drop brings a crew of rakers who re-rake the garden in a new pattern while the sun comes out and the view descends towards the stone being pressed; the snare drops a maple leaf, the bass sets the rakes\' pace, hats glint in the gravel, and the sun\'s slow arc turns every shadow.',
      lineage: 'V2 of Zen (zen, batch 04). Acted on: the curator\'s "leaves pile up and are never swept" and the curator\'s and director\'s call for memory with erasure (pressed rings now persist until a rake passes, and every rake sweeps leaves); the purist\'s "patterns are drawn, not swapped" (the drop\'s instant re-raking wave became a crew of rakers, which also reinterprets the floor judge\'s Sand Dancers); the floor judge\'s floodlight-beige ground (lower sun, darker gravel); the psychonaut\'s "almost still" and the purist\'s clock slower than the song (a travelling sun); the director\'s push-in on the drop. Rejected: the psychonaut\'s six-way mirrored Sand Rose (a kaleidoscope would undo the garden\'s asymmetry) and turning it into a night piece.',
    },

    params: [
      { key: 'pace', label: 'Rake pace', type: 'range', min: 0.2, max: 3, default: 1, step: 0.01 },
      { key: 'crew', label: 'Rakers in the drop', type: 'range', min: 0, max: 3, default: 3, step: 1 },
      { key: 'spacing', label: 'Groove spacing', type: 'range', min: 7, max: 18, default: 10, step: 0.1 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'light', label: 'Light', type: 'select', options: LIGHTS.map((l) => l.name), default: 0 },
      { key: 'sunTravel', label: 'Sun travel', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'leaves', label: 'Leaf fall', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'shade', label: 'Maple shade', type: 'range', min: 0, max: 1, default: 0.75, step: 0.01 },
    ],

    actions: [
      { id: 'rerake', label: 'Call the crew', run() { this.forceCrew = true; } },
      { id: 'stones', label: 'New stones', run() { this.layoutSeed = (this.layoutSeed || 0) + 1; this.stones = null; } },
    ],

    setup(p, ctx) { this.reset(ctx); },
    enter(p, ctx) { if (!this.state) this.reset(ctx); },

    reset(ctx) {
      this.state = {
        lastT: null, prev: new Float32Array(9),
        bassSm: 0, lowFor: 3, armed: true, lastDrop: -99,
        sun: 0.5, hat: 0, pad: 0, sunPhase: 0,
        lastKick: -1, kickCount: 0, lastClap: -1,
        rings: new Array(RING_SLOTS).fill(null), leaves: [],
        crewOn: false, crewUntil: -1, quietFor: 0,
        rows: null, rakes: null, patSeq: 1, gardenPat: 1, breeze: 0, nextAmbient: 1.5,
        zoom: 1.07, camX: 0, camY: 0,
      };
      this.stones = null;
    },

    nextPattern(avoid) {
      const S = this.state;
      let id = (S.patSeq++) % PATTERN_COUNT;
      if (id === avoid) id = (S.patSeq++) % PATTERN_COUNT;
      return id;
    },

    makeStones(W, H) {
      const seed = this.layoutSeed || 0;
      let r = Math.sin(seed * 91.7 + 3.1) * 1e4;
      const rnd = () => { r = Math.sin(r * 12.9898 + 78.233) * 43758.5453; return r - Math.floor(r); };
      this.stones = LAYOUT.map(([fx, fy, rad, s]) => {
        if (seed === 0) return { x: fx * W, y: fy * H, r: rad, s };
        return { x: (0.15 + 0.7 * rnd()) * W, y: (0.18 + 0.64 * rnd()) * H, r: rad * (0.8 + 0.4 * rnd()), s: rnd() };
      });
      // The three large stones take the kick's rings, in size order.
      this.bigStones = this.stones.map((s, i) => [s.r, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((e) => e[1]);
      this.stonesFor = W + 'x' + H;
      // Rings belong to stones; a new layout starts with clean gravel.
      if (this.state) this.state.rings.fill(null);
    },

    initGL() {
      const c = document.createElement('canvas');
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
      const u = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
        u[name] = gl.getUniformLocation(prog, name);
      }
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // ---- music -> events
    listen(sig, t, dt, params) {
      const S = this.state;
      const prev = S.prev;
      const react = params.react;

      // Kick: a sharp rise in band 0 presses the next ring outward round the
      // current stone. Ten kicks per stone (the second five re-press the
      // first, deepening them) before moving on, so the camera has one place
      // to descend towards for a few bars rather than chasing every beat.
      if (sig[0] > 58 && sig[0] - prev[0] > 22 && t - S.lastKick > 0.22) {
        S.lastKick = t;
        const k = S.kickCount++;
        const rank = Math.floor(k / 10) % 3;
        const ring = k % 5;
        const slot = rank * 5 + ring;
        S.rings[slot] = { stone: this.bigStones[rank], ring, t0: t, amp: Math.min(1.2, sig[0] / 85) };
        S.pressRank = rank;
      }
      // Snare / clap: a sharp rise in bands 3-5.
      const clapNow = (sig[3] + sig[4] + sig[5]) / 3;
      const clapPrev = (prev[3] + prev[4] + prev[5]) / 3;
      if (clapNow > 36 && clapNow - clapPrev > 16 && t - S.lastClap > 0.3) {
        S.lastClap = t;
        if (params.leaves > 0 && Math.random() < Math.min(1, params.leaves)) this.dropLeaf(t, params);
        if (params.leaves > 1 && Math.random() < params.leaves - 1) this.dropLeaf(t, params);
      }
      for (let i = 0; i < 9; i++) prev[i] = sig[i];

      // Bass: slow follower on band 1 (the bass line), which also marks the
      // drop. The crew stays while the bass does and leaves when it goes.
      S.bassSm = ease(S.bassSm, sig[1], 1.0, dt);
      if (S.bassSm < 14) S.lowFor += dt; else S.lowFor = 0;
      if (S.lowFor > 3) S.armed = true;
      if ((S.armed && S.bassSm > 27 && t - S.lastDrop > 12) || this.forceCrew) {
        if (this.forceCrew) S.crewUntil = t + 14;
        this.forceCrew = false;
        S.armed = false; S.lastDrop = t;
        this.callCrew();
      }
      if (S.bassSm < 16 && t > S.crewUntil) S.quietFor += dt; else S.quietFor = 0;
      if (S.crewOn && S.quietFor > 1.2) S.crewOn = false;

      const hats = (sig[6] + sig[7] + sig[8]) / 300;
      S.hat = Math.max(hats, S.hat * Math.exp(-dt / 0.12));
      S.pad = ease(S.pad, (sig[2] + sig[3] + sig[4]) / 300, 0.8, dt);
      const sunTarget = 0.25 + 0.75 * clamp01((S.bassSm - 8) / 28);
      S.sun = ease(S.sun, sunTarget, S.sun < sunTarget ? 0.9 : 0.45, dt);
      // Leaves also let go on their own now and then, so the intro is not still.
      if (params.leaves > 0 && t > S.nextAmbient) {
        this.dropLeaf(t, params);
        S.nextAmbient = t + (5 + 7 * Math.random()) / params.leaves;
      }
      S.breeze += dt * (0.25 + 1.2 * S.pad + 0.02 * S.bassSm) * (0.5 + 0.5 * react);
      S.sunPhase += dt * TAU / 190 * params.sunTravel;
    },

    // The drop: the garden's next pattern is chosen and helpers walk in.
    callCrew() {
      const S = this.state;
      S.gardenPat = this.nextPattern(S.gardenPat);
      S.crewOn = true;
    },

    dropLeaf(t, params) {
      const S = this.state;
      const W = this.W, H = this.H;
      // Most leaves fall under the maple (upper right), some drift further.
      const under = Math.random() < 0.7;
      const x = under ? W * (0.55 + 0.45 * Math.random()) : W * Math.random();
      const y = under ? H * (0.05 + 0.5 * Math.random()) : H * (0.1 + 0.8 * Math.random());
      S.leaves.push({
        x, y, t0: t, fall: 1.7 + Math.random() * 0.8,
        rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 5,
        size: 17 + Math.random() * 9, col: LEAF_COLS[(Math.random() * LEAF_COLS.length) | 0],
        swayA: 30 + Math.random() * 40, swayP: Math.random() * TAU, dx: 0, gone: -1, by: null,
      });
      if (S.leaves.length > 24) {
        // Too many: the oldest resting leaf starts to fade rather than vanishing.
        const old = S.leaves.find((L) => L.gone < 0);
        if (old) { old.gone = t; old.by = null; }
      }
    },

    newRake(row, dir, t, main, W) {
      return { row, dir, x: dir > 0 ? -RAKE_MARGIN : W + RAKE_MARGIN, x0: dir > 0 ? -RAKE_MARGIN : W + RAKE_MARGIN,
        start: t, pat: this.state.gardenPat, main, step: main ? 1 : (Math.random() < 0.5 ? -1 : 1),
        tilt: main ? 1 : 0.3 + 0.5 * Math.random(), lag: main ? 0 : Math.random() * 0.5 };
    },

    // The stalest row nobody is working.
    freeRow(exclude) {
      const S = this.state;
      const busy = new Set(S.rakes.map((r) => r.row));
      if (exclude !== undefined) busy.add(exclude);
      let best = -1, bestT = Infinity;
      for (let i = 0; i < S.rows.length; i++) {
        if (busy.has(i)) continue;
        if (S.rows[i].end < bestT) { bestT = S.rows[i].end; best = i; }
      }
      return best;
    },

    // ---- the rakes' walks: the main rake's serpentine and the drop's crew
    stepRakes(t, dt, params, W, H) {
      const S = this.state;
      const d = params.spacing;
      const rowH0 = d * TINES;
      const nRows = Math.max(3, Math.min(MAX_ROWS, Math.round(H / rowH0)));
      if (!S.rows || S.rows.length !== nRows) {
        // Before the first pass the garden reads as raked long ago, in straight lines.
        S.rows = Array.from({ length: nRows }, () => ({ start: -1e4, end: -1e4, dir: 1, pat: 0 }));
        S.rakes = [this.newRake(Math.min(2, nRows - 1), 1, t, true, W)];
        S.rakes[0].x = W * 0.28; S.rakes[0].x0 = -RAKE_MARGIN; S.rakes[0].pat = 1;
      }
      const v = params.pace * (42 + 3.2 * S.bassSm);
      const helpers = S.rakes.filter((r) => !r.main).length;
      const want = S.crewOn ? Math.round(params.crew) : 0;
      if (helpers < want && S.rakes.length < MAX_RAKES && t - (S.lastHelper || -9) > 0.6) {
        const row = this.freeRow();
        if (row >= 0) {
          S.rakes.push(this.newRake(row, Math.random() < 0.5 ? 1 : -1, t, false, W));
          S.lastHelper = t;
        }
      }
      for (const R of S.rakes) {
        // Helpers keep the drop's pace after the bass goes (and hurry once
        // dismissed), so the breakdown is left to the one slow rake quickly.
        const hv = Math.max(v, params.pace * 190) * (S.crewOn ? 1.1 : 1.7);
        R.x += R.dir * (R.main ? v : hv) * dt;
        if ((R.dir > 0 && R.x > W + RAKE_MARGIN) || (R.dir < 0 && R.x < -RAKE_MARGIN)) {
          S.rows[R.row] = { start: R.start, end: t, dir: R.dir, pat: R.pat };
          if (!R.main) {
            if (!S.crewOn || S.rakes.filter((r) => !r.main).length > want) { R.done = true; continue; }
            const row = this.freeRow(R.row);
            if (row < 0) { R.done = true; continue; }
            R.row = row;
          } else {
            // Serpentine, skipping rows a helper is working.
            let next = R.row, tries = 0;
            do {
              next += R.step;
              if (next < 0 || next >= nRows) {
                R.step = -R.step;
                next = R.row + R.step;
                // A full sweep of the garden: the next one is in a new pattern.
                if (!S.crewOn) S.gardenPat = this.nextPattern(S.gardenPat);
              }
            } while (S.rakes.some((o) => o !== R && o.row === next) && ++tries < nRows);
            R.row = next;
          }
          R.dir = -R.dir;
          R.x = R.x0 = R.dir > 0 ? -RAKE_MARGIN : W + RAKE_MARGIN;
          R.start = t;
          R.pat = S.gardenPat;
        }
      }
      S.rakes = S.rakes.filter((r) => !r.done);
      this.rowH = H / nRows;
      this.speed = v;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      this.W = W; this.H = H;
      if (!this.state) this.reset(ctx);
      if (!this.stones || this.stonesFor !== W + 'x' + H) this.makeStones(W, H);
      const S = this.state;
      const t = p.millis() / 1000;
      const dt = S.lastT === null ? 1 / 60 : Math.max(0, Math.min(0.1, t - S.lastT));
      S.lastT = t;
      const light = LIGHTS[Math.max(0, Math.min(LIGHTS.length - 1, Math.round(params.light)))];

      this.listen(signals, t, dt, params);
      this.stepRakes(t, dt, params, W, H);

      // The drone: a very slow drift that never reacts to single beats, plus a
      // descent towards the stone being pressed while the drop lasts. Eased
      // over seconds, so it makes the drop bigger without shaking the frame.
      const drop = S.crewOn ? 1 : 0;
      S.zoom = ease(S.zoom, 1.07 + 0.2 * drop, drop ? 0.45 : 0.22, dt);
      const push = (S.zoom - 1.07) / 0.2;
      const tgt = this.stones[this.bigStones[S.pressRank || 0]];
      const room = (W / 2) * (1 - 1.12 / S.zoom);
      const roomY = (H / 2) * (1 - 1.12 / S.zoom);
      const want = drop ? [Math.max(-room, Math.min(room, (tgt.x - W / 2) * 0.55)), Math.max(-roomY, Math.min(roomY, (tgt.y - H / 2) * 0.55))] : [0, 0];
      S.camX = ease(S.camX, want[0], 0.5, dt);
      S.camY = ease(S.camY, want[1], 0.5, dt);
      const cam = {
        cx: W / 2, cy: H / 2, zoom: S.zoom,
        rot: 0.055 * Math.sin(t * TAU / 97) + 0.02 * Math.sin(t * TAU / 41 + 1),
        ox: 18 * (1 - push) * Math.sin(t * TAU / 71 + 2) + S.camX,
        oy: 10 * (1 - push) * Math.sin(t * TAU / 53) + S.camY,
      };

      // The sun travels: its azimuth swings slowly about the preset's, lower
      // at the ends of the arc. Light arrives from the upper left (y down).
      const az = light.az + 0.8 * Math.sin(S.sunPhase);
      const elev = light.elev * (0.82 + 0.18 * Math.cos(S.sunPhase));
      const sx = Math.cos(az), sy = Math.sin(az);
      const ce = Math.cos(elev), se = Math.sin(elev);
      const sunDir = [sx * ce, sy * ce, se];
      const shLen = ce / se;

      p.colorMode(p.RGB, 255);
      p.background(0);

      // ---- ground
      const pw = Math.round(p.width * p.pixelDensity());
      const ph = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      const g2 = p.drawingContext;
      if (this.gl) {
        const gl = this.gl, u = this.u;
        if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }
        gl.viewport(0, 0, pw, ph);
        gl.uniform2f(u.uRes, pw, ph);
        gl.uniform1f(u.uVpp, W / pw);
        gl.uniform2f(u.uStage, W, H);
        gl.uniform1f(u.uTime, t);
        gl.uniform1f(u.uD, params.spacing);
        gl.uniform1f(u.uRowH, this.rowH);
        gl.uniform1i(u.uRows, S.rows.length);
        const ri = new Float32Array(MAX_ROWS * 4);
        S.rows.forEach((r, i) => ri.set([r.start, r.end, r.dir, r.pat], i * 4));
        gl.uniform4fv(u.uRowInfo, ri);
        gl.uniform1f(u.uRakeSpan, RAKE_MARGIN);
        const rk = new Float32Array(MAX_RAKES * 4), rt = new Float32Array(MAX_RAKES * 2);
        S.rakes.forEach((R, i) => { rk.set([R.row, R.x, R.dir, R.pat], i * 4); rt.set([R.start, R.x0], i * 2); });
        gl.uniform4fv(u.uRake, rk);
        gl.uniform2fv(u.uRakeT, rt);
        gl.uniform1i(u.uRakes, S.rakes.length);
        const st = new Float32Array(24);
        this.stones.forEach((s, i) => { st.set([s.x, s.y, s.r, s.s], i * 4); });
        gl.uniform4fv(u.uStone, st);
        gl.uniform1i(u.uStones, this.stones.length);
        const rings = new Float32Array(RING_SLOTS * 4), ringT = new Float32Array(RING_SLOTS).fill(-1);
        const react = params.react;
        S.rings.forEach((r, i) => {
          if (!r) return;
          const age = t - r.t0;
          const fresh = Math.min(1, age / 0.03) * Math.exp(-age / 0.6);
          const dist = 10 + params.spacing * (1.2 + r.ring * 1.6) + 10 * (1 - Math.exp(-age / 0.25));
          rings.set([r.stone, dist, fresh * r.amp * react * 1.3, 6 + 3 * Math.min(1, age / 0.4)], i * 4);
          ringT[i] = r.t0;
        });
        gl.uniform4fv(u.uRing, rings);
        gl.uniform1fv(u.uRingT, ringT);
        gl.uniform3f(u.uSunDir, sunDir[0], sunDir[1], sunDir[2]);
        gl.uniform3fv(u.uSunCol, light.sun);
        // Overcast light is whiter and flatter than the blue sky fill of a sunny afternoon.
        const sk = light.sky, lum = (sk[0] + sk[1] + sk[2]) / 3 * 1.05, k = S.sun;
        gl.uniform3f(u.uSkyCol, lum + (sk[0] - lum) * k, lum * 0.99 + (sk[1] - lum * 0.99) * k, lum * 0.96 + (sk[2] - lum * 0.96) * k);
        gl.uniform4f(u.uCam, cam.cx, cam.cy, cam.rot, cam.zoom);
        gl.uniform2f(u.uCamOff, cam.ox, cam.oy);
        gl.uniform1f(u.uSun, S.sun);
        gl.uniform1f(u.uHat, Math.min(1, S.hat * 1.6 * (0.4 + 0.6 * react)));
        gl.uniform2f(u.uMaple, W + 40, -40);
        gl.uniform1f(u.uMapleR, Math.max(W, H) * 0.62);
        gl.uniform1f(u.uShade, params.shade * (0.45 + 0.55 * S.sun));
        gl.uniform2f(u.uSway, Math.sin(S.breeze * 0.9) * 9 + Math.sin(S.breeze * 2.3) * 3, Math.cos(S.breeze * 0.7) * 6);
        gl.uniform3fv(u.uGravel, light.gravel);
        gl.uniform3fv(u.uStoneA, light.stoneA);
        gl.uniform3fv(u.uStoneB, light.stoneB);
        gl.uniform3fv(u.uMossA, light.mossA);
        gl.uniform3fv(u.uMossB, light.mossB);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        g2.drawImage(this.glCanvas, 0, 0, W, H);
      } else {
        p.background(190, 182, 166);
        p.noStroke(); p.fill(120);
        for (const s of this.stones) p.circle(s.x, s.y, s.r * 2);
      }

      g2.save();
      // The same drone as the ground.
      g2.translate(cam.cx, cam.cy);
      g2.scale(cam.zoom, cam.zoom);
      g2.rotate(cam.rot);
      g2.translate(-cam.cx - cam.ox, -cam.cy - cam.oy);
      g2.globalCompositeOperation = 'source-over';
      g2.globalAlpha = 1;
      g2.lineCap = 'round';
      g2.lineJoin = 'round';
      const shadowCol = `rgba(40,38,48,${(0.18 + 0.2 * S.sun).toFixed(3)})`;
      const shX = -sx * shLen, shY = -sy * shLen;

      // ---- leaves resting on the gravel (drawn under the rakes). They stay
      // until a rake sweeps them, then ride ahead of its tines and fade.
      const rowH = this.rowH;
      S.leaves = S.leaves.filter((L) => t - L.t0 < 120 && !(L.gone >= 0 && t - L.gone > 1.2));
      for (const L of S.leaves) {
        const age = t - L.t0;
        if (age < L.fall) continue;
        if (L.gone < 0) {
          for (const R of S.rakes) {
            const top = R.row * rowH;
            if (L.y > top - 6 && L.y < top + rowH + 6) {
              const ahead = (L.x - R.x) * R.dir;
              if (ahead < 16 && ahead > -4) { L.gone = t; L.by = R; break; }
            }
          }
        }
        let a = clamp01(1 - (age - 100) / 20);
        let lx = L.x;
        if (L.gone >= 0) {
          if (L.by) {
            // A rake that has walked off to its next row lets the leaf go.
            const nd = L.by.x + L.by.dir * 14 - L.x;
            if (Math.abs(nd - L.dx) > 60) L.by = null; else L.dx = nd;
          }
          lx = L.x + L.dx;
          a *= clamp01(1 - (t - L.gone) / 1.2);
        }
        this.drawLeaf(g2, lx, L.y, L.rot + L.spin * L.fall, L.size, L.col, a, 2.2, shX, shY, shadowCol);
      }

      // ---- the rakes
      for (const R of S.rakes) this.drawRake(g2, R, rowH, light, shX, shY, shadowCol, W);

      // ---- leaves still falling
      for (const L of S.leaves) {
        const age = t - L.t0;
        if (age >= L.fall) continue;
        const k = age / L.fall;              // 0 at the branch, 1 on the ground
        const z = 1 - k * k * (3 - 2 * k) * 0.3 - 0.7 * k;
        const sway = Math.sin(age * 3.1 + L.swayP) * L.swayA * z;
        const x = L.x + sway, y = L.y - 40 * z;
        const scale = 1 + 0.9 * z;
        const a = clamp01(age / 0.25);
        this.drawLeaf(g2, x, y, L.rot + L.spin * age, L.size * scale, L.col, a,
          2.2 + 70 * z, shX, shY, `rgba(40,38,48,${((0.1 + 0.18 * S.sun) * (1 - 0.6 * z)).toFixed(3)})`,
          Math.cos(age * 4.3 + L.swayP));
      }
      g2.restore();
    },

    drawLeaf(g, x, y, rot, size, col, alpha, h, shX, shY, shadowCol, tilt) {
      if (alpha <= 0.001) return;
      const squash = tilt === undefined ? 1 : 0.35 + 0.65 * Math.abs(tilt);
      g.globalAlpha = alpha;
      // shadow
      g.save();
      g.translate(x + shX * h, y + shY * h);
      g.rotate(rot);
      g.scale(1, squash);
      g.fillStyle = shadowCol;
      leafPath(g, size);
      g.fill();
      g.restore();
      // leaf
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(1, squash);
      g.fillStyle = col;
      leafPath(g, size);
      g.fill();
      g.strokeStyle = 'rgba(70,20,10,0.28)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.5;
        const len = size * (1 - Math.abs(i - 3) * 0.12) * 0.78;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      }
      g.moveTo(0, 0); g.lineTo(0, size * 0.55);
      g.stroke();
      g.restore();
      g.globalAlpha = 1;
    },

    drawRake(g, R, rowH, light, shX, shY, shadowCol, W) {
      const x = R.x, cy = (R.row + 0.5) * rowH;
      const half = rowH * 0.5 + 4;
      const dir = R.dir;
      // Handle: forward along the pull and tilted up across the rows it will
      // work next, so the shape reads as a tool being walked, not a cursor.
      const hx = x + dir * 190, hy = cy - R.step * 70 * (R.tilt || 1);
      const d = rowH / TINES;
      const shape = (ox, oy, hOx, hOy, col) => {
        g.strokeStyle = col;
        g.fillStyle = col;
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(x + ox, cy + oy);
        g.lineTo(hx + hOx, hy + hOy);
        g.stroke();
        g.fillRect(x - 6 + ox, cy - half + oy, 12, half * 2);
        // teeth trail behind the head, in the fresh grooves
        for (let i = 0; i < TINES; i++) {
          const ty = cy - rowH / 2 + (i + 0.5) * d;
          g.fillRect(x - (dir > 0 ? 17 : -5) + ox, ty - 2.2 + oy, 12, 4.4);
        }
      };
      // shadows: the head sits low, the handle rises to hand height
      shape(shX * 7, shY * 7, shX * 80, shY * 80, shadowCol);
      shape(0, 0, 0, 0, light.rake);
      // a lit edge along the wood, on the sun side
      g.strokeStyle = light.rakeHi;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 4.5, cy - half + 1.5); g.lineTo(x - 4.5, cy + half - 1.5);
      g.moveTo(x, cy - 2.5); g.lineTo(hx, hy - 2.5);
      g.stroke();
    },
  });
})();
