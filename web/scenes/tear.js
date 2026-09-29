// Kintsugi Muse: a sleeping porcelain head whose skin tears into shards and
// heals, in sweeps.
//
// The principle (from LEXSAN's wireframe mask, scene 6 of the 2026-09-28 set):
// a closed surface whose facets lift off along their normals, stretch into long
// thin triangles and fall back onto the form as a wave passes across it, left
// to right and back. Here the form is our own: an ovoid head with closed eyes,
// a long nose and quiet lips, tipped a little to one side, built in code from a
// displaced icosphere (no model file). The inside of the skin is gold, so each
// torn shard shows a gold back and the seams it leaves glint like kintsugi, the
// repair that makes the break the ornament. Under the skin is the same head as
// a wireframe; wherever the skin tears, the wire shows through.
//
// How a shard moves (all in the vertex shader, one draw): every vertex carries
// its whole triangle, so each corner can deform the triangle and take a flat
// normal from the result. A face's tear amount a comes from the sweeps, the
// kick point and the Open level. One corner per face (chosen by hash) is the
// apex: it flies out along the face normal, bent by a wind that follows the
// sweep's direction, while the other two pinch toward the centroid. So a facet
// becomes a long thin shard still rooted to the head, and folds back as a falls.
//
// Music, each in its own place:
//   bars     the first kick of every four starts a sweep across the head,
//            alternating left-to-right and right-to-left; with no kick for a
//            while, a gentle sweep still comes every two bars or so
//   kick     tears the facets nearest a point that wanders over the face
//   snare    a thin streak of light shoots through the scene
//   hats     glints running along the wireframe
//   bass     how far the shards fly
//   drop     (Follow the track) sweeps run back and forth without pause, the
//            skin is torn fully open around the gold wire head, more streaks,
//            the orbit quickens; the breakdown heals it
// Look: porcelain under a warm key, a cool fill and a rim light, with a real
// cast shadow on the wall behind. Three inks, no spectrum.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

  const INKS = [
    { name: 'Porcelain on terracotta', bgIn: '#d98a62', bgOut: '#7c3a26', shadow: [70, 24, 12, 0.34],
      skin: hex('#efe6d6'), skin2: hex('#d9cbb5'), gold: hex('#e0a63a'), wire: hex('#1d2a66'), wireA: 0.85,
      key: hex('#fff1dc'), fill: hex('#8fa6d8'), rim: hex('#ffe2b0'), sky: hex('#f6ead8'), ground: hex('#7a4632'),
      streak: hex('#fff6e6'), spec: 0.35, shine: 36 },
    { name: 'Bronze at dusk', bgIn: '#3a2440', bgOut: '#0d0911', shadow: [0, 0, 0, 0.5],
      skin: hex('#b88652'), skin2: hex('#7d5634'), gold: hex('#f4c877'), wire: hex('#8fe6d4'), wireA: 0.9,
      key: hex('#ffd9a8'), fill: hex('#5d6fb0'), rim: hex('#9ff0e0'), sky: hex('#8a7aa0'), ground: hex('#24141a'),
      streak: hex('#c8fff2'), spec: 0.6, shine: 48 },
    { name: 'Celadon & vermilion', bgIn: '#efe9dc', bgOut: '#b8ad9a', shadow: [60, 50, 40, 0.28],
      skin: hex('#a9c7b0'), skin2: hex('#7ea38d'), gold: hex('#d8412a'), wire: hex('#16181f'), wireA: 0.8,
      key: hex('#ffffff'), fill: hex('#c6d6ef'), rim: hex('#fff4e0'), sky: hex('#ffffff'), ground: hex('#6f685c'),
      streak: hex('#ffffff'), spec: 0.3, shine: 30 },
  ];

  // ---- the head ---------------------------------------------------------------
  // Icosphere directions displaced into an ovoid face. +z is the face, +y up,
  // +x the head's left-right axis (the sweep axis).
  function icosphere(level) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => { const m = Math.hypot(...v); return v.map((x) => x / m); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let l = 0; l < level; l++) {
      const cache = new Map();
      const mid = (a, b) => {
        const k = a < b ? a + ',' + b : b + ',' + a;
        if (cache.has(k)) return cache.get(k);
        const v = [0, 1, 2].map((i) => V[a][i] + V[b][i]); const m = Math.hypot(...v);
        V.push(v.map((x) => x / m)); cache.set(k, V.length - 1); return V.length - 1;
      };
      const NF = [];
      for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = NF;
    }
    return { V, F };
  }

  const g2 = (x, y, sx, sy) => Math.exp(-(x * x) / (2 * sx * sx) - (y * y) / (2 * sy * sy));
  function headPoint(u) {
    let [x, y, z] = u;
    // ovoid: taller than wide, the crown fuller than the jaw
    const jaw = 1 - 0.2 * clamp(-y, 0, 1) ** 1.4;
    x *= 0.74 * jaw; z *= 0.84 * (1 - 0.08 * clamp(-y, 0, 1)); y *= 1.02;
    y += 0.04 * (u[1] > 0 ? u[1] * u[1] : 0);
    const front = clamp((u[2] - 0.05) / 0.45, 0, 1);
    const f = front * front * (3 - 2 * front);
    let dz = 0;
    dz += 0.2 * g2(x, 0, 0.075, 1) * clamp((0.2 - y) / 0.38, 0, 1) * clamp((y + 0.26) / 0.1, 0, 1); // nose ridge
    dz += 0.05 * g2(x, y + 0.2, 0.09, 0.05);                                  // nose tip
    dz += 0.05 * g2(Math.abs(x) - 0.26, y - 0.3, 0.16, 0.05);                 // brow
    dz -= 0.075 * g2(Math.abs(x) - 0.27, y - 0.14, 0.12, 0.08);               // eye sockets
    dz += 0.03 * g2(Math.abs(x) - 0.27, y - 0.12, 0.1, 0.028);                // closed lids
    dz += 0.05 * g2(x, y + 0.44, 0.14, 0.035) - 0.025 * g2(x, y + 0.465, 0.12, 0.01); // lips
    dz += 0.05 * g2(x, y + 0.7, 0.14, 0.08);                                  // chin
    dz += 0.035 * g2(Math.abs(x) - 0.36, y + 0.18, 0.12, 0.12);               // cheeks
    z += dz * f;
    // tipped to one side, chin a little down: asleep, not watching
    const roll = -0.2, pitch = 0.12;
    let cx = x * Math.cos(roll) - y * Math.sin(roll), cy = x * Math.sin(roll) + y * Math.cos(roll);
    const py = cy * Math.cos(pitch) - z * Math.sin(pitch), pz = cy * Math.sin(pitch) + z * Math.cos(pitch);
    return [cx, py, pz];
  }

  function buildHead(level) {
    const { V, F } = icosphere(level);
    const P = V.map(headPoint);
    const d = new Float32Array(F.length * 3 * 12);
    let o = 0;
    F.forEach((f, fi) => {
      let [a, b, c] = f.map((i) => P[i]);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      if (n[0] * cen[0] + n[1] * cen[1] + n[2] * cen[2] < 0) { const s = b; b = c; c = s; } // outward, CCW
      const r = hash(fi * 1.713 + 0.37);
      const apex = Math.floor(hash(fi * 3.17 + 9.1) * 3);
      for (let k = 0; k < 3; k++) {
        d.set(a, o); d.set(b, o + 3); d.set(c, o + 6);
        d[o + 9] = k; d[o + 10] = r; d[o + 11] = apex;
        o += 12;
      }
    });
    return { data: d, count: F.length * 3 };
  }

  // ---- shaders --------------------------------------------------------------
  const HEAD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aP0;
layout(location = 1) in vec3 aP1;
layout(location = 2) in vec3 aP2;
layout(location = 3) in vec3 aK;   // corner, rand, apex corner
uniform mat4 uVP;
uniform vec4 uSw[3];   // sweep: front position, direction (+1/-1), amplitude, tail length
uniform vec4 uKick;    // xyz: point direction, w: amount
uniform float uKickR;
uniform float uOpen, uReach, uTime, uWire;
uniform vec3 uWind;
out vec3 vP; out vec3 vN; out vec3 vB; out float vA; out float vR;
// x: the stretch (sweeps and the kick), y: how far open the skin is (Open)
vec2 tearAt(vec3 c, float r) {
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 s = uSw[i];
    if (s.z <= 0.0) continue;
    // a ragged front: each face crosses a little early or late
    float x = c.x * s.y + (r - 0.5) * 0.26;
    float d = s.x - x;
    a = max(a, s.z * smoothstep(-0.12, 0.03, d) * exp(-max(d, 0.0) / s.w));
  }
  vec3 dirc = normalize(c);
  float kd = distance(dirc, uKick.xyz);
  a = max(a, uKick.w * exp(-kd * kd / (uKickR * uKickR)) * (0.75 + 0.5 * r));
  float o = uOpen * (0.72 + 0.28 * sin(uTime * 0.9 + r * 6.2831));
  return vec2(a, o);
}
vec3 deform(vec3 p, float corner, float apex, vec3 c, vec3 n, float e, float o, float r) {
  float isApex = abs(corner - apex) < 0.5 ? 1.0 : 0.0;
  // Open: the skin comes apart as a floating shell of plates, each lifted off
  // along its own normal and shrunk, so the face still reads while the wire
  // shows through every gap
  vec3 q = mix(p, c, o * 0.3) + n * uReach * o * (0.1 + 0.22 * r);
  vec3 co = c + n * uReach * o * (0.1 + 0.22 * r);
  // The stretch streams with the sweep more than it bristles outward (torn
  // paper in a wind, not an urchin): the apex pulls on ahead and the base
  // pinches, so a facet leaves as a long triangle and folds back
  vec3 dir = normalize(n * 0.75 + uWind * (0.6 + 1.1 * r));
  // the base widens a little as it lifts, so a small facet leaves as a
  // broad flake, not a needle (at this mesh density a pinched base read as fur)
  q = mix(q, co, -e * 0.45 * (1.0 - isApex));
  q += dir * uReach * e * (0.05 + 0.07 * r + isApex * (0.15 + 0.28 * r));
  return q;
}
void main() {
  vec3 c = (aP0 + aP1 + aP2) / 3.0;
  vec3 n = normalize(cross(aP1 - aP0, aP2 - aP0));
  float r = aK.y, corner = aK.x, apex = aK.z;
  vec2 ta = tearAt(c, r);
  vec3 own = corner < 0.5 ? aP0 : corner < 1.5 ? aP1 : aP2;
  vB = corner < 0.5 ? vec3(1, 0, 0) : corner < 1.5 ? vec3(0, 1, 0) : vec3(0, 0, 1);
  // gold seams belong to the stretch; the open shell stays porcelain, so in
  // the drop the face still reads as tiles over the wire
  vA = uWire > 0.5 ? max(ta.x, ta.y * 0.6) : ta.x; vR = r;
  vec3 pos;
  if (uWire > 0.5) {
    pos = own * 0.972;
    vN = n;
  } else {
    float e = clamp(ta.x, 0.0, 1.3);
    e = e * e * (3.0 - 2.0 * min(e, 1.0));
    float o = clamp(ta.y, 0.0, 1.0);
    vec3 q0 = deform(aP0, 0.0, apex, c, n, e, o, r);
    vec3 q1 = deform(aP1, 1.0, apex, c, n, e, o, r);
    vec3 q2 = deform(aP2, 2.0, apex, c, n, e, o, r);
    vec3 nn = cross(q1 - q0, q2 - q0);
    vN = dot(nn, nn) > 1e-12 ? normalize(nn) : n;
    pos = corner < 0.5 ? q0 : corner < 1.5 ? q1 : q2;
  }
  vP = pos;
  gl_Position = uVP * vec4(pos, 1.0);
}`;

  const SKIN_FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec3 vB; in float vA; in float vR;
uniform vec3 uCam, uKeyL, uFillL, uRimL;
uniform vec3 uSkin, uSkin2, uGold, uKey, uFill, uRim, uSky, uGround;
uniform float uSpec, uShine;
out vec4 color;
void main() {
  vec3 N = normalize(vN);
  bool inside = !gl_FrontFacing;
  if (inside) N = -N;
  vec3 V = normalize(uCam - vP);
  vec3 base = mix(uSkin, uSkin2, 0.35 * vR + 0.25 * smoothstep(0.1, 0.8, vA));
  if (inside) base = uGold;
  // the seam: a torn facet's edges are gold, like a mended break
  float edge = min(vB.x, min(vB.y, vB.z));
  float w = fwidth(edge);
  float seam = (1.0 - smoothstep(w * 0.6, w * 2.2, edge)) * smoothstep(0.04, 0.25, vA);
  base = mix(base, uGold, seam);
  float hemi = N.y * 0.5 + 0.5;
  vec3 col = base * mix(uGround, uSky, hemi) * 0.34;
  float kd = dot(N, uKeyL);
  col += base * uKey * (0.78 * max(kd, 0.0) + 0.14 * max((kd + 0.4) / 1.4, 0.0));
  col += base * uFill * 0.22 * max(dot(N, uFillL), 0.0);
  vec3 H = normalize(uKeyL + V);
  float sp = pow(max(dot(N, H), 0.0), uShine);
  col += uKey * sp * (inside ? 0.9 : uSpec);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  col += uRim * fres * (0.25 + 0.75 * max(dot(N, uRimL), 0.0)) * 0.9;
  color = vec4(col, 1.0);
}`;

  const WIRE_FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec3 vB; in float vA; in float vR;
uniform vec3 uWireC, uGold;
uniform float uLW, uWireA, uHat, uTime, uGlint;
out vec4 color;
void main() {
  float edge = min(vB.x, min(vB.y, vB.z));
  float w = fwidth(edge);
  float line = 1.0 - smoothstep(w * uLW * 0.5, w * (uLW * 0.5 + 1.0), edge);
  if (line < 0.01) discard;
  float facing = gl_FrontFacing ? 1.0 : 0.3;
  // hats: glints that run over the wire, a few facets at a time
  float g = fract(sin(vR * 91.7 + floor(uTime * 14.0) * 13.1) * 4375.5);
  float glint = step(1.0 - uHat * 0.09, g) * uGlint;
  vec3 c = mix(uWireC, uGold, clamp(glint + 0.35 * smoothstep(0.2, 1.0, vA), 0.0, 1.0));
  float a = line * facing * uWireA * (0.55 + 0.45 * smoothstep(0.02, 0.4, vA) + glint);
  color = vec4(c * min(a, 1.0), min(a, 1.0));
}`;

  const STREAK_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aA;  // head xyz, alpha
layout(location = 1) in vec4 aB;  // tail xyz, width (px)
uniform mat4 uVP;
uniform vec2 uRes;
out vec2 vUV; out float vAl;
void main() {
  int k = gl_VertexID;
  float u = (k == 1 || k == 2 || k == 4) ? 1.0 : 0.0;
  float v = (k == 2 || k == 4 || k == 5) ? 1.0 : -1.0;
  vec4 ca = uVP * vec4(aA.xyz, 1.0), cb = uVP * vec4(aB.xyz, 1.0);
  vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w;
  vec2 d = (sa - sb) * uRes;
  d = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
  vec2 perp = vec2(-d.y, d.x);
  vec4 c = mix(cb, ca, u);
  c.xy += perp * v * aB.w / uRes * c.w * (0.35 + 0.65 * u);
  vUV = vec2(u, v); vAl = aA.w;
  gl_Position = c;
}`;

  const STREAK_FS = `#version 300 es
precision highp float;
in vec2 vUV; in float vAl;
uniform vec3 uStreak;
out vec4 color;
void main() {
  float a = vAl * 1.4 * pow(vUV.x, 1.8) * (1.0 - vUV.y * vUV.y);
  color = vec4(uStreak * a, a);
}`;

  // ---- camera ---------------------------------------------------------------
  function viewProj(eye, target, aspect, fovY, out) {
    let f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(...f); f = f.map((x) => x / fl);
    let s = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0];
    const sl = Math.hypot(...s); s = s.map((x) => x / sl);
    const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const V = [s[0], s[1], s[2], -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]),
      u[0], u[1], u[2], -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
      -f[0], -f[1], -f[2], (f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2]),
      0, 0, 0, 1];
    const n = 0.2, fa = 40, t = 1 / Math.tan(fovY / 2);
    const P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), 2 * fa * n / (n - fa), 0, 0, -1, 0];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      let x = 0;
      for (let k = 0; k < 4; k++) x += P[r * 4 + k] * V[k * 4 + c];
      out[c * 4 + r] = x;
    }
    return out;
  }
  const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; };

  const PRESETS = {
    calm: { open: 0, reach: 0.8, pingpong: 0, streaks: 0.35, orbit: 0.5 },
    drop: { open: 1, reach: 1.25, pingpong: 1, streaks: 1, orbit: 1.1 },
  };
  const DRIVE = ['open', 'reach', 'pingpong', 'streaks', 'orbit'];
  const MAX_STREAKS = 12;

  VIZ.register({
    id: 'tear',
    name: 'Kintsugi Muse',
    order: 832,
    gallery: {
      title: 'Kintsugi Muse',
      technique: 'Raw WebGL2. A head built in code from a level-4 icosphere displaced into an ovoid face (nose, brow, closed lids, lips, chin), drawn as 5,120 flat facets. Each vertex carries its whole triangle, so the vertex shader tears a face (apex corner flung along the normal and a sweep-following wind, the other two pinched to the centroid) and takes a flat normal from the deformed triangle. Sweeps, a kick point and an Open level set the tear per face. The same mesh, inset, is drawn as an antialiased barycentric wireframe behind the skin; light streaks are screen-space ribbons in 3D. Key, fill, hemisphere and fresnel rim light; a blurred silhouette makes the cast shadow on a Canvas 2D wall.',
      brief: 'A sleeping porcelain head, eyes closed, turning slowly as the camera orbits. Its skin tears: facets lift off along their normals and stretch into long thin shards with gold backs, then fold back onto the face, the tear travelling across the head left to right and then right to left. Where the skin opens, a wireframe of the same head shows through, and the healed seams glint gold like kintsugi. Each bar sends a sweep across; each kick tears the facets around a point that wanders over the face; the snare shoots a thin streak of light through; hats run glints over the wire; the bass flings the shards further. In the drop the sweeps run back and forth without pause and the skin stays torn open, a cloud of shards breathing around the wire head; the breakdown heals it.',
      lineage: 'Raph\'s note on LEXSAN\'s wireframe mask (scene 6, 2026-09-28): surfaces expanding into stretched-out triangles, then collapsing back onto the mask, left to right and back. The head owes something to Brancusi\'s sleeping heads; the gold seams to kintsugi.',
    },

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      { key: 'open', label: 'Torn open', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.open },
      { key: 'reach', label: 'Shard reach', type: 'range', min: 0.2, max: 2.5, step: 0.01, default: PRESETS.calm.reach },
      { key: 'pingpong', label: 'Continuous sweeps', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.pingpong },
      { key: 'sweep', label: 'Sweep time (s)', type: 'range', min: 0.6, max: 4, step: 0.01, default: 1.7 },
      { key: 'streaks', label: 'Light streaks', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.streaks },
      { key: 'orbit', label: 'Orbit speed', type: 'range', min: 0, max: 2, step: 0.01, default: PRESETS.calm.orbit },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.kickCount = 0; this.kickEnv = 0;
      this.lastSnare = -10; this.lastHat = -10; this.hatEnv = 0;
      this.bassEnv = 0; this.low = 0;
      this.dropOn = false; this.auto = 0;
      this.sweeps = []; this.sweepDir = 1; this.lastSweep = -10;
      this.wind = 0;
      this.streakList = []; this.streakN = 0; this.nextAmbient = 1.5;
      this.cam = 0;
    },

    initGL() {
      this.glCanvas = document.createElement('canvas');
      const gl = this.glCanvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
      if (!gl) { this.glFailed = true; return; }
      this.gl = gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const U = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(pr, nm); }
        return { pr, U };
      };
      this.skinP = link(HEAD_VS, SKIN_FS);
      this.wireP = link(HEAD_VS, WIRE_FS);
      this.streakP = link(STREAK_VS, STREAK_FS);

      // The skin is fine enough to carry the face; the wire under it is one
      // level coarser, because at the skin's density it fills in to a solid
      // blot at 640 px wide (seen 2026-09-28)
      const mesh = (level) => {
        const h = buildHead(level);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, h.data, gl.STATIC_DRAW);
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 48, i * 12); }
        return { vao, n: h.count };
      };
      this.skinMesh = mesh(4);
      this.wireMesh = mesh(3);

      this.streakBuf = gl.createBuffer();
      this.streakData = new Float32Array(MAX_STREAKS * 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.streakBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.streakData.byteLength, gl.DYNAMIC_DRAW);
      this.streakVao = gl.createVertexArray();
      gl.bindVertexArray(this.streakVao);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
      gl.bindVertexArray(null);
    },

    startSweep(t, amp, dur) {
      this.sweeps.push({ t0: t, dir: this.sweepDir, amp, dur });
      this.sweepDir = -this.sweepDir;
      this.lastSweep = t;
      if (this.sweeps.length > 3) this.sweeps.shift();
    },

    shootStreak(t, strength) {
      this.streakN++;
      const h = (k) => hash(this.streakN * 7.31 + k * 1.93);
      // a line through the head's neighbourhood, from well off one side
      const ang = (h(1) - 0.5) * 1.3 + (h(2) < 0.5 ? 0 : Math.PI);
      const d = [Math.cos(ang), Math.sin(ang) * 0.6, (h(3) - 0.5) * 0.5];
      const m = Math.hypot(...d); d[0] /= m; d[1] /= m; d[2] /= m;
      const c = [(h(4) - 0.5) * 1.4, (h(5) - 0.5) * 1.6, (h(6) - 0.5) * 1.6];
      this.streakList.push({ t0: t, c, d, len: 1.6 + 1.8 * h(7), dur: 0.5 + 0.35 * h(8), a: strength, w: 2 + 2.2 * h(9) });
      if (this.streakList.length > MAX_STREAKS) this.streakList.shift();
    },

    listen(s, t, dt, Q, react, sweepDur) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        this.kickEnv = Math.max(this.kickEnv, clamp(b0 / 85, 0.5, 1));
        // bars: the first kick of every four
        if (this.kickCount % 4 === 1 && t - this.lastSweep > 0.8) this.startSweep(t, 1, sweepDur);
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t;
        if (Q.streaks > 0.02) this.shootStreak(t, clamp(0.5 + 0.5 * Q.streaks, 0, 1) * clamp(react, 0.3, 1.5));
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) {
        this.lastHat = t; this.hatEnv = 1;
      }
      this.prev.set(s);
      this.kickEnv *= Math.exp(-dt / 0.42);
      this.hatEnv *= Math.exp(-dt / 0.18);
      const bass = Math.max(s[0] * 0.45, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.15) : k(0.6));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.7);
      const kicking = t - this.lastKick < 0.9;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.22 || t - this.lastKick > 1.6)) this.dropOn = false;
      this.auto += ((this.dropOn ? 1 : 0) - this.auto) * k(this.dropOn ? 0.9 : 2.4);
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.prev) this.reset();
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const g = p.drawingContext;
      const I = INKS[clamp(Math.round(params.inks) || 0, 0, INKS.length - 1)];
      const react = params.react;
      const follow = Math.round(params.follow) === 1;
      const Q = {};
      for (const key of DRIVE) Q[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? this.auto : 0);
      const sweepDur = params.sweep * (1 - 0.3 * Q.pingpong);
      this.listen(signals, t, dt, Q, react, sweepDur);

      // ---- sweeps ---------------------------------------------------------------
      this.sweeps = this.sweeps.filter((s) => t - s.t0 < s.dur * 1.6);
      const newest = this.sweeps[this.sweeps.length - 1];
      if (Q.pingpong > 0.5) {
        // back and forth without pause: the next leg leaves as this one lands
        if (!newest || t - newest.t0 > newest.dur * 0.82) this.startSweep(t, 1, sweepDur);
      } else if (t - this.lastKick > 3 && t - this.lastSweep > 4.2) {
        this.startSweep(t, 0.7, sweepDur * 1.3);   // no beat: a slow, gentle pass
      }
      const sw = new Float32Array(12);
      let windT = 0;
      this.sweeps.forEach((s, i) => {
        const u = (t - s.t0) / s.dur;
        sw[i * 4] = -1.25 + 2.9 * clamp(u, 0, 1.6) / 1.0;
        sw[i * 4 + 1] = s.dir;
        sw[i * 4 + 2] = s.amp * clamp(1.35 - u * 0.75, 0, 1) * clamp(react, 0, 1.5);
        sw[i * 4 + 3] = 0.3 - 0.1 * Q.pingpong;
        windT += s.dir * clamp(1.4 - u, 0, 1);
      });
      this.wind += (clamp(windT, -1, 1) - this.wind) * (1 - Math.exp(-dt / 0.35));

      // ---- streaks: snares, plus a few of their own in the drop -----------------
      this.nextAmbient -= dt * (0.15 + 1.4 * Q.streaks * this.auto);
      if (this.nextAmbient <= 0) { this.nextAmbient = 1 + hash(t * 3.1); if (Q.streaks > 0.02) this.shootStreak(t, 0.45 + 0.4 * Q.streaks); }

      this.cam += dt * (0.05 + 0.1 * Q.orbit);

      // ---- background wall --------------------------------------------------------
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.filter = 'none';
      const cx = W / 2, cy = H / 2;
      const bg = g.createRadialGradient(cx - S * 0.12, cy - S * 0.2, 0, cx, cy, Math.hypot(W, H) * 0.62);
      bg.addColorStop(0, I.bgIn); bg.addColorStop(1, I.bgOut);
      g.fillStyle = bg; g.fillRect(-2, -2, W + 4, H + 4);

      if (!this.gl && !this.glFailed) { try { this.initGL(); } catch (e) { this.glFailed = true; console.error(e); } }
      if (this.glFailed) {
        g.fillStyle = '#a33'; g.font = '20px sans-serif'; g.textAlign = 'center';
        g.fillText('WebGL2 unavailable', cx, cy); g.restore(); return;
      }

      const gl = this.gl;
      const pw = Math.round(p.width * p.pixelDensity()), ph = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.depthMask(true);

      // ---- camera: a slow orbit, swinging round the sleeper -----------------------
      const aspect = W / H;
      const fov0 = 32 * Math.PI / 180;
      const fovY = aspect >= 1 ? fov0 : 2 * Math.atan(Math.tan(fov0 / 2) / aspect);
      const D = 4.7 - 0.2 * Math.sin(this.cam * 0.37);
      const yaw = -0.12 + 0.45 * Math.sin(this.cam * 0.9) + 0.12 * Math.sin(this.cam * 0.31 + 2);
      const pitch = 0.12 + 0.14 * Math.sin(this.cam * 0.53 + 1);
      const eye = [D * Math.sin(yaw) * Math.cos(pitch), D * Math.sin(pitch), D * Math.cos(yaw) * Math.cos(pitch)];
      this.vp = viewProj(eye, [0, -0.02, 0], aspect, fovY, this.vp || new Float32Array(16));
      // lights live in the world: as the camera swings the modelling changes
      const keyL = norm3([-0.55, 0.62, 0.6]), fillL = norm3([0.8, -0.1, 0.35]), rimL = norm3([0.35, 0.5, -0.8]);

      // the kick point wanders over the face
      const kp = norm3([0.75 * Math.sin(t * 0.41), 0.55 * Math.sin(t * 0.29 + 1.3), 0.75 + 0.25 * Math.cos(t * 0.23)]);
      const kickAmt = this.kickEnv * clamp(react, 0, 2) * 1.05;
      const reach = Q.reach * (0.7 + 0.55 * this.bassEnv * clamp(react, 0, 2));
      const wind = [this.wind, 0.12, 0.0];

      const head = (pr, wire) => {
        const U = pr.U;
        gl.useProgram(pr.pr);
        gl.uniformMatrix4fv(U.uVP, false, this.vp);
        gl.uniform4fv(U.uSw, sw);
        gl.uniform4f(U.uKick, kp[0], kp[1], kp[2], kickAmt);
        gl.uniform1f(U.uKickR, 0.3);
        gl.uniform1f(U.uOpen, clamp(Q.open, 0, 1));
        gl.uniform1f(U.uReach, reach);
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uWire, wire ? 1 : 0);
        gl.uniform3fv(U.uWind, wind);
        gl.bindVertexArray(wire ? this.wireMesh.vao : this.skinMesh.vao);
      };

      head(this.skinP, false);
      const U = this.skinP.U;
      gl.uniform3fv(U.uCam, eye);
      gl.uniform3fv(U.uKeyL, keyL); gl.uniform3fv(U.uFillL, fillL); gl.uniform3fv(U.uRimL, rimL);
      gl.uniform3fv(U.uSkin, I.skin); gl.uniform3fv(U.uSkin2, I.skin2); gl.uniform3fv(U.uGold, I.gold);
      gl.uniform3fv(U.uKey, I.key); gl.uniform3fv(U.uFill, I.fill); gl.uniform3fv(U.uRim, I.rim);
      gl.uniform3fv(U.uSky, I.sky); gl.uniform3fv(U.uGround, I.ground);
      gl.uniform1f(U.uSpec, I.spec); gl.uniform1f(U.uShine, I.shine);
      gl.drawArrays(gl.TRIANGLES, 0, this.skinMesh.n);

      // the wire head under the skin, seen wherever the skin has torn
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      head(this.wireP, true);
      const WU = this.wireP.U;
      gl.uniform3fv(WU.uWireC, I.wire); gl.uniform3fv(WU.uGold, I.gold);
      gl.uniform1f(WU.uLW, 1.1 * Math.max(1, ph / 720));
      gl.uniform1f(WU.uWireA, I.wireA);
      gl.uniform1f(WU.uHat, this.hatEnv * clamp(react, 0, 2));
      gl.uniform1f(WU.uGlint, 1);
      gl.drawArrays(gl.TRIANGLES, 0, this.wireMesh.n);

      // light streaks
      this.streakList = this.streakList.filter((s) => t - s.t0 < s.dur);
      let n = 0;
      for (const s of this.streakList) {
        const u = (t - s.t0) / s.dur;
        const travel = -4.5 + 9 * u;
        const hd = s.c.map((c, i) => c + s.d[i] * travel);
        const tl = s.c.map((c, i) => c + s.d[i] * (travel - s.len * Math.min(1, u * 3)));
        const o = n * 8;
        this.streakData[o] = hd[0]; this.streakData[o + 1] = hd[1]; this.streakData[o + 2] = hd[2];
        this.streakData[o + 3] = s.a * Math.sin(Math.PI * u) ** 0.6;
        this.streakData[o + 4] = tl[0]; this.streakData[o + 5] = tl[1]; this.streakData[o + 6] = tl[2];
        this.streakData[o + 7] = s.w * Math.max(1, ph / 720);
        n++;
      }
      if (n) {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.streakP.pr);
        gl.uniformMatrix4fv(this.streakP.U.uVP, false, this.vp);
        gl.uniform2f(this.streakP.U.uRes, pw, ph);
        gl.uniform3fv(this.streakP.U.uStreak, I.streak);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.streakBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.streakData.subarray(0, n * 8));
        gl.bindVertexArray(this.streakVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
      }
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      // ---- compose: the cast shadow on the wall, then the head ---------------------
      if (!this.shCanvas) { this.shCanvas = document.createElement('canvas'); this.sh = this.shCanvas.getContext('2d'); }
      const sws = Math.max(8, Math.round(W / 3)), shh = Math.max(8, Math.round(H / 3));
      if (this.shCanvas.width !== sws || this.shCanvas.height !== shh) { this.shCanvas.width = sws; this.shCanvas.height = shh; }
      const sh = this.sh;
      sh.globalCompositeOperation = 'source-over';
      sh.clearRect(0, 0, sws, shh);
      sh.filter = 'blur(2px)';
      sh.drawImage(this.glCanvas, 0, 0, sws, shh);
      sh.filter = 'none';
      sh.globalCompositeOperation = 'source-in';
      sh.fillStyle = 'rgb(' + I.shadow[0] + ',' + I.shadow[1] + ',' + I.shadow[2] + ')';
      sh.fillRect(0, 0, sws, shh);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.globalAlpha = I.shadow[3];
      // the key is up and to the left, so the shadow falls down and right
      const ss = 1.22, ox = cx + S * 0.16 - Math.sin(yaw) * S * 0.05, oy = cy + S * 0.09;
      g.drawImage(this.shCanvas, ox - W * ss / 2, oy - H * ss / 2, W * ss, H * ss);
      g.globalAlpha = 1;
      g.drawImage(this.glCanvas, 0, 0, W, H);
      g.restore();
    },
  });
})();
