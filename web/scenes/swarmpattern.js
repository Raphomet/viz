// Pivot Field: density of pattern from thousands of tiny louvred blades.
//
// The principle (LEXSAN scene 15, Raph: "a lot moving on screen that makes
// really cool patterns"): no single mover is interesting. Every blade is the
// same small tilted fin, pinned at its base and turning about it. Each one is
// lit like a louvre, so its brightness depends only on which way it points;
// a field of them is therefore a picture of an angle field, and any smooth
// angle field (a spiral, a pair of vortices, crossing waves) shows up as big
// light-and-dark figures made of nothing but small things turning.
//
// How patterns come and go: every blade's angle is
//   figure(p) - phase   the big figure; phase travels, so its bands move
//   + swing             a travelling wave through the pivots (bass: how far)
//   + (1 - lock(p)) * own wobble   each blade's own slow wander
//   + hat shimmer + kick waves
// lock(p) is highest at the figure's centre and spreads outward as the
// Alignment rises, so the figure crystallises from the middle and melts back
// into texture from the rim. Alignment breathes on its own in calm passages;
// the drop drives it to 1 and the figure locks. The figure itself changes
// every ~14 s (and on the drop) by blending two angle fields, which passes
// through defects that tear and heal. A counter-rotating dot lattice under
// the blades beats against their lattice for a slow moire.
//
// Music:
//   kick   a ring wave from one point: blades lift (longer shadow), flip
//          past and blush the accent ink as it passes, then settle
//   bass   the swing wave's amplitude: how far every pivot swings
//   hats   fine shimmer in each blade's angle
//   drop   (Follow the track) Alignment to 1, faster travel, bigger swing,
//          and a new figure clicks in
// Look: flat ground, two-tone blades with a curved-blade gradient, a soft
// cast shadow per blade, paper grain. Four inks per palette.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

  // ground, dark ink, light ink, accent
  const INKS = [
    { name: 'Salmon, soot & bone', ground: hex('#e4816a'), dark: hex('#1f1716'), light: hex('#f6ebdc'), accent: hex('#ffd35c') },
    { name: 'Navy on paper', ground: hex('#ebe3d2'), dark: hex('#1a2848'), light: hex('#fbf7ee'), accent: hex('#d9432a') },
    { name: 'Teal night', ground: hex('#123236'), dark: hex('#071618'), light: hex('#e9dcbf'), accent: hex('#f08a4b') },
    { name: 'Mustard & cobalt', ground: hex('#e0ad3a'), dark: hex('#261c12'), light: hex('#f8f0e0'), accent: hex('#2f5fb0') },
  ];

  const COMMON = `
uniform vec2 uHalf;       // half the stage, virtual units
uniform vec2 uCam;        // camera centre, world
uniform float uCamRot, uZoom;
vec2 rot2(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec2 toScreen(vec2 w) { return rot2(w - uCam, -uCamRot) * uZoom; }
vec2 toWorld(vec2 s) { return rot2(s / uZoom, uCamRot) + uCam; }
`;

  const BLADE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aQ;   // quad corner, 0..1
layout(location = 1) in vec4 aI;   // world x, y, rand, rand
${COMMON}
uniform float uT, uPhase, uLock, uFree, uSwing, uSwingPh, uHat, uS, uRview;
uniform vec2 uC;                   // figure centre, world
uniform int uFA, uFB; uniform vec4 uPA, uPB; uniform float uFM;
uniform vec4 uW[4];                // kick waves: x, y (world), radius, amp
uniform float uWw;
uniform vec2 uShOff;               // shadow offset, screen virtual units
out vec2 vL; flat out vec4 vDir; flat out vec4 vGeo; out float vG;

float figAng(int id, vec2 q, vec4 P) {
  float r = length(q), ph = atan(q.y, q.x);
  if (id == 0) return P.x * ph + P.y * 6.2831853 * r + P.z;                 // spiral rosette
  if (id == 1) {                                                            // vortex / dipole pair
    vec2 c = rot2(vec2(P.w, 0.0), P.z);
    vec2 a = q - c, b = q + c;
    return atan(a.y, a.x) + P.x * atan(b.y, b.x) + P.y * 6.2831853 * (length(a) - length(b));
  }
  if (id == 2) {                                                            // crossing waves
    vec2 u = rot2(q, P.z);
    return P.y * 6.2831853 * u.x + P.x * sin(P.y * 4.4 * u.y) + 0.6 * sin(P.w * 6.2831853 * u.y);
  }
  if (id == 3) {                                                            // ring of vortices
    float a = P.z * 0.0, sgn = 1.0;
    int n = int(P.x + 0.5);
    for (int j = 0; j < 8; j++) {
      if (j >= n) break;
      vec2 c = P.w * vec2(cos(6.2831853 * float(j) / float(n) + P.z), sin(6.2831853 * float(j) / float(n) + P.z));
      vec2 d = q - c;
      a += sgn * atan(d.y, d.x);
      sgn = -sgn;
    }
    return a + P.y * 6.2831853 * r;
  }
  return P.x * ph + P.w * sin(P.y * 6.2831853 * r) + P.z;                   // sunflower ripple
}

void main() {
  vec2 p = aI.xy;
  vec2 q = (p - uC) / 300.0;
  float r = length(q);
  float A = figAng(uFA, q, uPA), B = figAng(uFB, q, uPB);
  vec2 fv = mix(vec2(cos(A), sin(A)), vec2(cos(B), sin(B)), uFM);
  float th = atan(fv.y, fv.x) - uPhase;
  // the figure crystallises from its centre outward as the lock rises
  float lp = smoothstep(0.0, 1.0, uLock * 2.2 - length(p - uC) / uRview * 1.2);
  float own = sin(uT * (0.25 + 0.7 * aI.z) + aI.w * 6.2831853)
            + 0.8 * sin(q.x * 2.3 + uT * 0.19 + 1.7 * sin(q.y * 1.9 - uT * 0.13 + aI.z));
  th += (1.0 - lp) * uFree * own;
  th += uSwing * sin(uSwingPh - r * 5.5 + 0.8 * sin(3.0 * atan(q.y, q.x)));
  th += uHat * sin(uT * 23.0 + aI.w * 40.0) * (0.6 + 0.4 * aI.z);
  float g = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = (length(p - uW[i].xy) - uW[i].z) / uWw;
    g += uW[i].w * exp(-d * d);
  }
  g = min(g, 1.2);
  th += g * 3.0;

  vec2 dir = vec2(cos(th), sin(th));
  vec2 dS = rot2(dir, -uCamRot);                  // blade axis on screen
  vec2 nS = vec2(-dS.y, dS.x);
  float len = uS * 0.92 * (1.0 + 0.3 * g);
  float wid = uS * 0.2;
  vec2 off = uShOff * (1.0 + 1.6 * g);             // lifted blades throw longer shadows
  vec2 oL = vec2(dot(off, dS), dot(off, nS)) / uZoom;
  float pad = 1.5 + uS * 0.12;
  float a0 = min(-wid, oL.x - wid) - pad, a1 = max(len, len + oL.x) + pad;
  float b0 = min(-wid, oL.y - wid) - pad, b1 = max(wid, oL.y + wid) + pad;
  vec2 l = vec2(mix(a0, a1, aQ.x), mix(b0, b1, aQ.y));
  vec2 s = toScreen(p) + (dS * l.x + nS * l.y) * uZoom;
  vL = l; vDir = vec4(dS, nS); vGeo = vec4(len, wid, oL); vG = g;
  gl_Position = vec4(s.x / uHalf.x, -s.y / uHalf.y, 0.0, 1.0);
}`;

  const BLADE_FS = `#version 300 es
precision highp float;
in vec2 vL; flat in vec4 vDir; flat in vec4 vGeo; in float vG;
uniform vec3 uDark, uLight, uAccent;
uniform vec3 uL3;
uniform float uSoft, uInk3;
out vec4 color;
float blade(vec2 l, float len, float wid) {
  float u = l.x / len;
  float w = wid * 2.6 * sqrt(max(u, 0.0)) * max(1.0 - u, 0.0);
  float d = max(abs(l.y) - w, max(-l.x, l.x - len));
  return min(d, length(l) - wid * 0.55);           // the pivot cap
}
float h12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float len = vGeo.x, wid = vGeo.y;
  float d = blade(vL, len, wid);
  float aa = max(fwidth(d), 1e-3);
  float a = clamp(0.5 - d / aa, 0.0, 1.0);
  float ds = blade(vL - vGeo.zw, len, wid);
  float sh = (1.0 - smoothstep(-uSoft, uSoft * 1.6, ds)) * 0.42;
  if (a <= 0.0 && sh <= 0.0) discard;
  // a slightly curved blade tilted about its own axis, like a louvre: which
  // way it points decides how it meets the light
  float u = clamp(vL.x / len, 0.0, 1.0);
  float w = max(wid * 2.6 * sqrt(u) * (1.0 - u), 1e-3);
  float t = clamp(vL.y / w, -1.0, 1.0);
  vec2 dS = vDir.xy, nS = vDir.zw;
  vec3 n = normalize(vec3(nS * (0.75 + 0.55 * t) + dS * (0.35 * u - 0.1), 0.7));
  float lam = max(dot(n, uL3), 0.0);
  float tone = smoothstep(0.08, 0.92, lam);
  vec3 col = mix(uDark, uLight, tone);
  // the drop's third ink: blades turned half toward the light take the accent,
  // so the figure's bands gain an edge of colour
  col = mix(col, uAccent, uInk3 * smoothstep(0.3, 0.45, tone) * (1.0 - smoothstep(0.55, 0.7, tone)));
  col += uLight * 0.18 * pow(lam, 14.0);
  col *= 0.78 + 0.22 * smoothstep(0.0, 0.3, u);      // occluded at the pivot
  col = mix(col, uAccent, clamp(vG * 1.3, 0.0, 1.0));
  col = mix(col, uDark * 0.85, smoothstep(-2.2 * aa, 0.0, d) * 0.55);  // inked edge
  col += (h12(gl_FragCoord.xy) - 0.5) * 0.05;
  vec3 shc = uDark * 0.35;
  float sa = sh * (1.0 - a);
  color = vec4(col * a + shc * sa, a + sa);
}`;

  const BG_VS = `#version 300 es
layout(location = 0) in vec2 aQ;
void main() { gl_Position = vec4(aQ * 2.0 - 1.0, 0.0, 1.0); }`;

  const BG_FS = `#version 300 es
precision highp float;
${COMMON}
uniform vec2 uRes;
uniform vec3 uGround, uDark;
uniform float uDotS, uDotRot, uDotR, uSwing, uSwingPh, uT;
uniform vec2 uC;
out vec4 color;
float h12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 s = (gl_FragCoord.xy / uRes * 2.0 - 1.0) * uHalf; s.y = -s.y;
  vec2 w = toWorld(s);
  float rr = length(s) / length(uHalf);
  vec3 col = uGround * mix(1.06, 0.84, rr * rr);
  // a hex dot lattice turning against the blades: the two lattices beat
  vec2 dp = rot2(w - uC, uDotRot) / uDotS;
  vec2 b1 = vec2(1.0, 0.0), b2 = vec2(0.5, 0.8660254);
  vec2 f = vec2(dp.x - dp.y / 1.7320508, dp.y / 0.8660254);
  vec2 i0 = floor(f);
  float best = 1e9; vec2 bc = vec2(0.0);
  for (int y = 0; y <= 1; y++) for (int x = 0; x <= 1; x++) {
    vec2 c = (i0 + vec2(x, y)).x * b1 + (i0 + vec2(x, y)).y * b2;
    float dd = length(dp - c);
    if (dd < best) { best = dd; bc = c; }
  }
  vec2 cw = rot2(bc * uDotS, -uDotRot);
  float sw = 0.5 + 0.5 * sin(uSwingPh - length(cw) / 300.0 * 5.5 + 1.2);
  float rad = uDotR * (0.55 + 0.9 * sw * (0.4 + uSwing));
  float px = uDotS / uZoom * 0.0 + fwidth(best);
  float dot = 1.0 - smoothstep(rad - px, rad + px, best);
  col = mix(col, uDark, dot * 0.32);
  col += (h12(gl_FragCoord.xy + fract(uT) * 97.0) - 0.5) * 0.045;
  color = vec4(col, 1.0);
}`;

  const PRESETS = {
    calm: { lock: 0.25, swing: 0.45, travel: 0.35, accent: 0 },
    drop: { lock: 1, swing: 1.0, travel: 1.1, accent: 0.85 },
  };
  const DRIVE = ['lock', 'swing', 'travel', 'accent'];
  const FIG_ORDER = [0, 3, 1, 4, 2];

  function newFigure(n) {
    const id = FIG_ORDER[n % FIG_ORDER.length];
    const h = (k) => hash(n * 13.7 + k * 3.1);
    const sg = h(9) < 0.5 ? -1 : 1;
    if (id === 0) return { id, P: [[3, 4, 5, 6, 8][Math.floor(h(1) * 5)], sg * (0.5 + 1.1 * h(2)), h(3) * TAU, 0] };
    if (id === 1) return { id, P: [h(1) < 0.5 ? -1 : 1, sg * (0.3 + 0.8 * h(2)), h(3) * TAU, 0.35 + 0.3 * h(4)] };
    if (id === 2) return { id, P: [1 + 1.6 * h(1), 0.8 + 1.2 * h(2), h(3) * TAU, 0.3 + 0.8 * h(4)] };
    if (id === 3) return { id, P: [[4, 6, 8][Math.floor(h(1) * 3)], sg * (0.2 + 0.6 * h(2)), h(3) * TAU, 0.45 + 0.3 * h(4)] };
    return { id, P: [[1, 2, 3, 5][Math.floor(h(1) * 4)], 1 + 2 * h(2), h(3) * TAU, 1 + 1.5 * h(4)] };
  }

  VIZ.register({
    id: 'swarmpattern',
    name: 'Pivot Field',
    order: 831,
    gallery: {
      title: 'Pivot Field',
      technique: 'WebGL2: one instanced draw of ~5-10k quads; the vertex shader computes each blade\'s angle from a blended pair of analytic angle fields (spiral rosette, vortex pair, crossing waves, vortex ring, sunflower ripple), a travelling swing wave, a per-blade wobble gated by a radial lock mask, hat shimmer and up to four kick ring waves. The fragment shader draws a leaf SDF with its own offset soft shadow, louvre lighting from a tilted curved-blade normal, an inked edge and grain. A full-screen pass draws the ground and a counter-rotating hex dot lattice for moire.',
      brief: 'Thousands of small louvred blades pinned at their bases, each lit by which way it points, so the field is a picture of an angle field. When the blades align, a big figure (a many-armed spiral, a vortex pair, crossing waves, a ring of vortices) clicks into place from the centre outward; when they drift, it melts into shimmering texture from the rim. Every kick sends a ring wave out from one point that lifts, flips and blushes the blades as it passes. The bass sets how far a travelling swing wave throws the pivots, hats add a fine shimmer, and the drop pulls every blade into alignment so the figure locks and a new one clicks in.',
      lineage: 'Raph on LEXSAN scene 15 (orange iris / speaker dome, 2026-09-28): "its sense of complexity and movement, there\'s a lot moving on screen that makes really cool patterns." Descends from op-art louvre and fin fields (Soto, Cruz-Diez), Reynolds-style emergent swarms without the flocking, liquid-crystal textures and nematic defects, and moire.',
    },

    params: [
      { key: 'lattice', label: 'Lattice', type: 'select', options: ['Hex field', 'Iris rings'], default: 0 },
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      { key: 'density', label: 'Blade spacing', type: 'range', min: 9, max: 26, step: 0.5, default: 14 },
      { key: 'lock', label: 'Alignment', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.lock },
      { key: 'swing', label: 'Swing', type: 'range', min: 0, max: 1.6, step: 0.01, default: PRESETS.calm.swing },
      { key: 'travel', label: 'Wave travel', type: 'range', min: 0, max: 2.5, step: 0.01, default: PRESETS.calm.travel },
      { key: 'accent', label: 'Third ink', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.accent },
      { key: 'jitter', label: 'Hat shimmer', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
      { key: 'react', label: 'Kick waves', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.kickCount = 0;
      this.bassEnv = 0; this.hatEnv = 0; this.low = 0; this.energy = 0;
      this.dropOn = false; this.auto = 0;
      this.waves = [];
      this.phase = 0; this.swingPh = 0; this.cam = 0;
      this.figN = 0;
      this.figA = newFigure(0); this.figB = newFigure(0); this.figT0 = 0; this.figDur = 3; this.figNext = 14;
      this.lockBreath = 0;
    },

    advanceFigure(t, dur) {
      this.figA = this.figB;
      this.figN++;
      this.figB = newFigure(this.figN);
      this.figT0 = t; this.figDur = dur; this.figNext = t + 14;
    },

    initGL() {
      this.glCanvas = document.createElement('canvas');
      const gl = this.glCanvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: false });
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
      this.bladeP = link(BLADE_VS, BLADE_FS);
      this.bgP = link(BG_VS, BG_FS);
      this.quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      this.instBuf = gl.createBuffer();
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(1, 1);
      gl.bindVertexArray(null);
      this.bgVao = gl.createVertexArray();
      gl.bindVertexArray(this.bgVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);
      this.latKey = '';
    },

    // The lattice covers a disc big enough for the widest stage at the
    // camera's furthest drift and smallest zoom, so no edge ever shows.
    buildLattice(kind, s, R) {
      const pts = [];
      if (kind === 0) {
        const dy = s * 0.8660254, nj = Math.ceil(R / dy), ni = Math.ceil(R / s) + 1;
        for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
          const x = (i + (j & 1) * 0.5) * s, y = j * dy;
          if (x * x + y * y < R * R) pts.push(x, y);
        }
      } else {
        pts.push(0, 0);
        for (let k = 1; k * s * 0.9 < R; k++) {
          const r = k * s * 0.9, n = Math.max(6, Math.round(TAU * r / s)), o = hash(k * 1.3) * TAU;
          for (let i = 0; i < n; i++) pts.push(r * Math.cos(o + TAU * i / n), r * Math.sin(o + TAU * i / n));
        }
      }
      const n = pts.length / 2, d = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        d[i * 4] = pts[i * 2]; d[i * 4 + 1] = pts[i * 2 + 1];
        d[i * 4 + 2] = hash(i * 0.731 + 1.3); d[i * 4 + 3] = hash(i * 1.917 + 7.1);
      }
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      this.nInst = n;
    },

    listen(s, t, dt, react, view) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0];
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        // a source somewhere in the inner part of the view, never the same twice
        const sx = (hash(this.kickCount * 3.7) - 0.5) * view.W * 0.7;
        const sy = (hash(this.kickCount * 5.3 + 1) - 0.5) * view.H * 0.7;
        this.waves.push({ sx, sy, t0: t, amp: clamp(b0 / 85, 0.5, 1) * clamp(react, 0, 2) });
        if (this.waves.length > 4) this.waves.shift();
      }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.4, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.1) : k(0.45));
      const hat = Math.max(s[6], s[7], s[8]) / 100;
      this.hatEnv += (hat - this.hatEnv) * (hat > this.hatEnv ? k(0.02) : k(0.18));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.7);
      const kicking = t - this.lastKick < 0.9;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.22 || t - this.lastKick > 1.6)) this.dropOn = false;
      this.auto += ((this.dropOn ? 1 : 0) - this.auto) * k(this.dropOn ? 0.8 : 2.8);
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.prev) this.reset();
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const I = INKS[clamp(Math.round(params.inks) || 0, 0, INKS.length - 1)];
      const react = params.react;
      const wasDrop = this.dropOn;
      this.listen(signals, t, dt, react, { W, H });

      const follow = Math.round(params.follow) === 1;
      const Q = {};
      for (const key of DRIVE) Q[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? this.auto : 0);

      // figures: a new one every ~14 s, and one that clicks in on the drop
      if (follow && this.dropOn && !wasDrop) this.advanceFigure(t, 1.2);
      else if (t > this.figNext) this.advanceFigure(t, 3.5);
      const fm = clamp((t - this.figT0) / this.figDur, 0, 1);
      const figMix = fm * fm * (3 - 2 * fm);

      // alignment breathes on its own, so calm passages drift in and out of
      // the figure; at full lock there is nothing left to breathe
      this.lockBreath += dt * TAU / 19;
      const breath = 0.5 - 0.5 * Math.cos(this.lockBreath);
      const lock = clamp(Q.lock + (1 - Q.lock) * 0.4 * breath * breath, 0, 1);

      this.phase += dt * Q.travel * 1.1;
      this.swingPh += dt * (0.9 + 1.4 * Q.travel);
      this.cam += dt;
      const cam = this.cam;

      if (!this.gl && !this.glFailed) { try { this.initGL(); } catch (e) { this.glFailed = true; console.error(e); } }
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.filter = 'none';
      if (this.glFailed) {
        g.fillStyle = '#222'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#a33'; g.font = '20px sans-serif'; g.textAlign = 'center';
        g.fillText('WebGL2 unavailable', W / 2, H / 2); g.restore(); return;
      }
      const gl = this.gl;
      const pw = Math.round(p.width * p.pixelDensity()), ph = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) { this.glCanvas.width = pw; this.glCanvas.height = ph; }

      const S = clamp(params.density, 9, 26);
      const kind = Math.round(params.lattice) === 1 ? 1 : 0;
      const halfDiag = Math.hypot(W, H) / 2;
      const zoom = 1.04 + 0.07 * Math.sin(cam * 0.029);
      const Rcov = (halfDiag + 90) / 0.95 + S * 2;
      const key = kind + ':' + S + ':' + Math.ceil(Rcov / 50);
      if (key !== this.latKey) { this.latKey = key; this.buildLattice(kind, S, Math.ceil(Rcov / 50) * 50); }

      // camera: a slow pan, a slow turn and a gentle breathing zoom
      const camX = 70 * Math.sin(cam * 0.031 + 1), camY = 45 * Math.sin(cam * 0.043);
      const camRot = 0.012 * cam + 0.1 * Math.sin(cam * 0.021);
      const cX = 35 * Math.sin(cam * 0.05), cY = 25 * Math.sin(cam * 0.037 + 2);

      gl.viewport(0, 0, pw, ph);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);

      const setCam = (U) => {
        gl.uniform2f(U.uHalf, W / 2, H / 2);
        gl.uniform2f(U.uCam, camX, camY);
        gl.uniform1f(U.uCamRot, camRot);
        gl.uniform1f(U.uZoom, zoom);
      };

      // ground and dot lattice
      const swing = Q.swing * (0.25 + 1.1 * this.bassEnv);
      let U = this.bgP.U;
      gl.useProgram(this.bgP.pr);
      setCam(U);
      gl.uniform2f(U.uRes, pw, ph);
      gl.uniform3fv(U.uGround, I.ground); gl.uniform3fv(U.uDark, I.dark);
      gl.uniform1f(U.uDotS, S * 0.37);
      gl.uniform1f(U.uDotRot, -0.02 * cam);
      gl.uniform1f(U.uDotR, S * 0.055);
      gl.uniform1f(U.uSwing, swing);
      gl.uniform1f(U.uSwingPh, this.swingPh);
      gl.uniform1f(U.uT, t);
      gl.uniform2f(U.uC, cX, cY);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.bgVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // blades
      U = this.bladeP.U;
      gl.useProgram(this.bladeP.pr);
      setCam(U);
      gl.uniform1f(U.uT, t);
      gl.uniform1f(U.uPhase, this.phase);
      gl.uniform1f(U.uLock, lock);
      gl.uniform1f(U.uFree, 2.6);
      gl.uniform1f(U.uSwing, swing);
      gl.uniform1f(U.uSwingPh, this.swingPh);
      gl.uniform1f(U.uHat, this.hatEnv * params.jitter * 0.22);
      gl.uniform1f(U.uS, S);
      gl.uniform1f(U.uRview, halfDiag / zoom);
      gl.uniform2f(U.uC, cX, cY);
      gl.uniform1i(U.uFA, this.figA.id); gl.uniform4fv(U.uPA, this.figA.P);
      gl.uniform1i(U.uFB, this.figB.id); gl.uniform4fv(U.uPB, this.figB.P);
      gl.uniform1f(U.uFM, figMix);
      const wv = new Float32Array(16);
      this.waves = this.waves.filter((w) => t - w.t0 < 1.8);
      const speed = 430;
      this.waves.forEach((w, i) => {
        const age = t - w.t0;
        // source picked in screen space, so it is always somewhere you can see
        const c = Math.cos(camRot), s = Math.sin(camRot);
        const sx = w.sx / zoom, sy = w.sy / zoom;
        wv[i * 4] = c * sx - s * sy + camX; wv[i * 4 + 1] = s * sx + c * sy + camY;
        wv[i * 4 + 2] = speed * age;
        wv[i * 4 + 3] = w.amp * Math.pow(1 - age / 1.8, 1.4) * clamp(age / 0.04, 0, 1);
      });
      gl.uniform4fv(U.uW, wv);
      gl.uniform1f(U.uWw, S * 2.3);
      gl.uniform2f(U.uShOff, S * 0.13, S * 0.18);
      gl.uniform3fv(U.uDark, I.dark); gl.uniform3fv(U.uLight, I.light); gl.uniform3fv(U.uAccent, I.accent);
      const L = [-0.55, -0.62, 0.56], ll = Math.hypot(...L);
      gl.uniform3f(U.uL3, L[0] / ll, L[1] / ll, L[2] / ll);
      gl.uniform1f(U.uSoft, S * 0.09);
      gl.uniform1f(U.uInk3, clamp(Q.accent, 0, 1));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.nInst);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);

      g.imageSmoothingEnabled = true;
      g.drawImage(this.glCanvas, 0, 0, W, H);
      g.restore();
    },
  });
})();
