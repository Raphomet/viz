// Fold: one sheet of heavy white paper under a low lamp, folding itself into
// an origami form, one crease per kick. The breakdown unfolds it, leaving the
// ridges of everything it has been.
//
// Batch 06 idea 25 (the Curator's). Lineage: Letterpress's blind relief (the
// drama is shadow, not ink), Mobile's cast shadow as the second layer, Paper's
// cut sheets.
//
// How it is built:
// - The paper is real geometry, folded exactly. The sheet is a set of convex
//   facets in sheet coordinates, each carrying the chain of folds that moved
//   it. A fold is a line on the table: every facet (or, for a flap fold, every
//   facet of one earlier flap) on its far side is split along the line and the
//   far piece is rotated about it. The hinge sits just above the layers the
//   flap will land on, so a flap lands one paper thickness above them, and
//   layers never interpenetrate. Composing each facet's chain every frame
//   with the folds' current angles gives the rigid 3D pose of every piece,
//   so a flap that is half-folded really stands up off the sheet.
// - Every crease has a rolled hinge: the edge where a piece was cut sweeps a
//   half-cylinder round the fold axis, so a folded edge is a rounded roll of
//   paper, and a thick stack's outer layers wrap round its inner ones.
// - Every crease is also stamped, in sheet coordinates, into a height field
//   (valley or mountain from the front face). It perturbs the paper normal,
//   so an unfolded sheet keeps a ridge for every fold it has made and a low
//   lamp picks the ridges out as light and shadow. Old ridges fade a little
//   with each new form, so minute five is not a grey mat of creases.
// - One low spot lamp with a PCF shadow map is the key light (it rakes the
//   sheet, so a flap standing up casts a shadow across the table); paper is
//   lit through from behind when the lamp is on its far side. The drop adds a
//   cool second lamp from the opposite side, so shadows turn blue against the
//   warm key. Dust motes drift in the beam.
//
// Music:
//   kick   one crease: the next fold of the recipe, a flap rising, standing in
//          the raking light with its shadow sweeping, and landing with a
//          small settle. Once the form is finished, each kick lifts one of
//          its free flaps and lets it fall; after a while the kicks unfold it
//          and it begins a new form.
//   snare  a breath across the paper: every free flap lifts together.
//   pad    swings the lamp slowly, so every shadow on the table moves, and
//          lifts the next fold part-way before its kick arrives.
//   bass   the turntable and the camera's drift go faster.
//   hats   dust glints in the beam.
//   drop   lamp lower and warmer (longer shadows), second lamp on, the
//          coloured side of the paper comes up, the finished form opens its
//          flaps and turns once on the table while the camera comes down to
//          it. The breakdown unfolds the sheet flat, one fold at a time.

(function () {
  const PI = Math.PI;
  const S = 150;            // half the sheet's side, virtual units
  const LAYER = 0.8;        // gap between stacked layers
  const LIFT = 0.45;        // the sheet rests just above the table
  const HT = 512;           // crease height field, texels per sheet side
  const SHADOW = 2048;
  const DUST = 380;
  const HOLD = 12;          // kicks the finished form is played before it unfolds
  const EPS = 0.02;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (x) => clamp(x, 0, 1);
  const smooth = (a, b, v) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const inOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };

  const PAPERS = [
    { name: 'Vermilion on slate', front: lin('#f3f0e8'), back: lin('#c23b25'), table: lin('#202328'), grain: 0 },
    { name: 'Indigo on walnut', front: lin('#f2eee4'), back: lin('#2a4478'), table: lin('#2e1e14'), grain: 1 },
    { name: 'Black on green felt', front: lin('#f1efe9'), back: lin('#1d1d20'), table: lin('#15241d'), grain: 0 },
  ];

  // Recipes: fold lines in sheet units (the sheet is [-1, 1]^2). A step
  // moves everything where n.x > c over the line, valley up; `only` limits
  // it to the pieces an earlier step moved (a flap folded on a flap).
  const c22 = Math.cos(PI / 8), s22 = Math.sin(PI / 8);
  const RECIPES = [
    { name: 'Double blintz', steps: [
      { n: [1, 1], c: 1 }, { n: [-1, 1], c: 1 }, { n: [-1, -1], c: 1 }, { n: [1, -1], c: 1 },
      { n: [1, 0], c: 0.5 }, { n: [0, 1], c: 0.5 }, { n: [-1, 0], c: 0.5 }, { n: [0, -1], c: 0.5 },
    ] },
    { name: 'Cupboard boat', steps: [
      { n: [1, 0], c: 0.5 }, { n: [-1, 0], c: 0.5 }, { n: [0, 1], c: 0.5 }, { n: [0, -1], c: 0.5 },
      { n: [1, 1], c: 0.5 }, { n: [-1, -1], c: 0.5 }, { n: [1, -1], c: 0 },
    ] },
    { name: 'Pinwheel', steps: [
      { n: [1, 1], c: 1 }, { n: [-1, 1], c: 1 }, { n: [-1, -1], c: 1 }, { n: [1, -1], c: 1 },
      { n: [-1, -1], c: -0.5, only: 0 }, { n: [1, -1], c: -0.5, only: 1 },
      { n: [1, 1], c: -0.5, only: 2 }, { n: [-1, 1], c: -0.5, only: 3 },
    ] },
    { name: 'Kite', steps: [
      { n: [s22, -c22], c: c22 - s22 }, { n: [-c22, s22], c: c22 - s22 },
      { n: [1, 1], c: 1.1 }, { n: [1, -1], c: 0 }, { n: [-1, -1], c: 1.2 },
    ] },
  ];

  const PRESETS = {
    calm: { lamp: 17, fill: 0, ink: 0.12, bloom: 0.15, spin: 0.08, camera: 0.2, dust: 0.35 },
    drop: { lamp: 8, fill: 0.85, ink: 1, bloom: 0.85, spin: 0.55, camera: 0.7, dust: 0.9 },
    blind: { lamp: 6, fill: 0, ink: 0, bloom: 0.35, spin: 0.12, camera: 0.1, dust: 0.25 },
  };
  const DRIVE = ['lamp', 'fill', 'ink', 'bloom', 'spin', 'camera', 'dust'];

  // ---- rigid transforms {R: row-major 3x3, t}
  const ident = () => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
  function mul(A, B) {
    const a = A.R, b = B.R, R = new Array(9), t = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) R[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      t[i] = a[i * 3] * B.t[0] + a[i * 3 + 1] * B.t[1] + a[i * 3 + 2] * B.t[2] + A.t[i];
    }
    return { R, t };
  }
  const ap = (M, x, y, z) => [
    M.R[0] * x + M.R[1] * y + M.R[2] * z + M.t[0],
    M.R[3] * x + M.R[4] * y + M.R[5] * z + M.t[1],
    M.R[6] * x + M.R[7] * y + M.R[8] * z + M.t[2]];
  const apR = (M, x, y, z) => [
    M.R[0] * x + M.R[1] * y + M.R[2] * z,
    M.R[3] * x + M.R[4] * y + M.R[5] * z,
    M.R[6] * x + M.R[7] * y + M.R[8] * z];
  // Rotation by th about the line through c with unit direction d.
  function rotAbout(c, d, th) {
    const co = Math.cos(th), si = Math.sin(th), k = 1 - co;
    const [x, y, z] = d;
    const R = [
      co + x * x * k, x * y * k - z * si, x * z * k + y * si,
      y * x * k + z * si, co + y * y * k, y * z * k - x * si,
      z * x * k - y * si, z * y * k + x * si, co + z * z * k];
    const rc = [R[0] * c[0] + R[1] * c[1] + R[2] * c[2], R[3] * c[0] + R[4] * c[1] + R[5] * c[2], R[6] * c[0] + R[7] * c[1] + R[8] * c[2]];
    return { R, t: [c[0] - rc[0], c[1] - rc[1], c[2] - rc[2]] };
  }
  const foldRot = (f, th) => rotAbout([f.n[0] * f.c, f.n[1] * f.c, f.h], f.d, th);

  // Clip a convex polygon to the side where side * s >= 0. Edge i runs from
  // vertex i to i+1 and carries tags[i]; the new cut edge gets cutTag.
  function clip(poly, tags, s, side, cutTag) {
    const P = [], T = [];
    let cut = null;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const sc = s[i] * side, sn = s[j] * side;
      if (sc >= 0) {
        P.push(poly[i]);
        T.push(sc === 0 && sn < 0 ? cutTag : tags[i]);
        if (sc === 0 && sn < 0) cut = cut || [];
      }
      if ((sc > 0 && sn < 0) || (sc < 0 && sn > 0)) {
        const u = sc / (sc - sn);
        const X = [poly[i][0] + (poly[j][0] - poly[i][0]) * u, poly[i][1] + (poly[j][1] - poly[i][1]) * u];
        P.push(X);
        T.push(sc > 0 ? cutTag : tags[i]);
      }
    }
    if (P.length < 3) return null;
    let area = 0;
    for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; area += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
    if (Math.abs(area) < 1) return null;
    for (let i = 0; i < P.length; i++) if (T[i] === cutTag) cut = [P[i], P[(i + 1) % P.length]];
    return { poly: P, tags: T, cut };
  }

  // Convex polygons in the plane overlap by more than a sliver.
  function overlap(A, B) {
    for (const Q of [A, B]) {
      for (let i = 0; i < Q.length; i++) {
        const j = (i + 1) % Q.length;
        const nx = Q[j][1] - Q[i][1], ny = Q[i][0] - Q[j][0];
        const l = Math.hypot(nx, ny) || 1;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const v of A) { const d = (v[0] * nx + v[1] * ny) / l; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
        for (const v of B) { const d = (v[0] * nx + v[1] * ny) / l; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
        if (a1 < b0 + 0.5 || b1 < a0 + 0.5) return false;
      }
    }
    return true;
  }

  // ---- 4x4 column-major for the GL cameras
  function perspective(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]);
  }
  function lookAt(e, c, up) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
    let l = Math.hypot(...z); z = z.map((v) => v / l);
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
    l = Math.hypot(...x); x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  }
  function mat4mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }

  // ---- shaders
  const VS_MAIN = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aN;
layout(location=2) in vec3 aT;
layout(location=3) in vec2 aUV;
layout(location=4) in float aKind;
uniform mat4 uVP;
out vec3 vPos; out vec3 vN; out vec3 vT; out vec2 vUV; out float vKind;
void main() {
  vPos = aPos; vN = aN; vT = aT; vUV = aUV; vKind = aKind;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

  const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPos, 1.0); }`;

  const FS_DEPTH = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(1.0); }`;

  const FS_MAIN = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vPos; in vec3 vN; in vec3 vT; in vec2 vUV; in float vKind;
uniform sampler2D uCrease;
uniform sampler2DShadow uShadow;
uniform mat4 uLVP;
uniform vec3 uCam, uLamp, uAim, uKeyCol, uFillDir, uFillCol, uAmb;
uniform vec3 uFront, uBack, uTable;
uniform vec2 uSpot;
uniform vec2 uRes;
uniform float uLampDist, uSheet, uGrain, uExpo;
out vec4 o;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float shadowAt(vec3 P, vec3 Nl, vec3 L) {
  vec3 q = P + Nl * 0.45 + L * 0.35;
  vec4 c = uLVP * vec4(q, 1.0);
  if (c.w <= 0.0) return 1.0;
  vec3 s = c.xyz / c.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  vec2 tx = 1.25 / vec2(textureSize(uShadow, 0));
  float sum = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++)
      sum += texture(uShadow, vec3(s.xy + vec2(i, j) * tx, s.z - 0.00015));
  return sum / 9.0;
}

void main() {
  vec3 P = vPos;
  vec3 V = normalize(uCam - P);
  vec3 Lv = uLamp - P; float Ld = length(Lv); vec3 L = Lv / Ld;
  float spot = smoothstep(uSpot.y, uSpot.x, dot(-L, uAim));
  float fall = (uLampDist * uLampDist) / (Ld * Ld);
  vec3 key = uKeyCol * spot * fall;
  vec3 col;
  if (vKind > 1.5) {
    float g;
    if (uGrain > 0.5) g = 0.75 + 0.4 * vnoise(P.xy * vec2(0.01, 0.22)) + 0.12 * vnoise(P.xy * vec2(0.05, 0.9));
    else g = 0.88 + 0.22 * vnoise(P.xy * 0.8) + 0.08 * vnoise(P.xy * 0.05);
    vec3 alb = uTable * g;
    float sh = shadowAt(P, vec3(0.0, 0.0, 1.0), L);
    col = alb * (key * max(L.z, 0.0) * sh * 1.6 + uAmb + uFillCol * max(uFillDir.z, 0.0));
  } else {
    vec3 nF = normalize(vN);
    vec3 tU = normalize(vT - nF * dot(vT, nF));
    vec3 tV = cross(nF, tU);
    vec3 nP = nF;
    if (vKind < 0.5) {
      float e = 1.0 / 512.0;
      float hx = (texture(uCrease, vUV + vec2(e, 0.0)).r - texture(uCrease, vUV - vec2(e, 0.0)).r) / (2.0 * e * uSheet);
      float hy = (texture(uCrease, vUV + vec2(0.0, e)).r - texture(uCrease, vUV - vec2(0.0, e)).r) / (2.0 * e * uSheet);
      vec2 f = vUV * 700.0;
      hx += (vnoise(f + vec2(0.5, 0.0)) - vnoise(f - vec2(0.5, 0.0))) * 0.03;
      hy += (vnoise(f + vec2(0.0, 0.5)) - vnoise(f - vec2(0.0, 0.5))) * 0.03;
      nP = normalize(nF - hx * tU - hy * tV);
    }
    bool front = dot(nF, V) > 0.0;
    vec3 N = front ? nP : -nP;
    vec3 alb = (front ? uFront : uBack) * (0.97 + 0.05 * vnoise(vUV * 300.0));
    vec3 Nl = dot(nF, L) > 0.0 ? nF : -nF;
    float sh = shadowAt(P, Nl, L);
    float ndl = dot(N, L);
    // Paper is lit through from behind when the lamp is on its far side.
    float lit = ndl > 0.0 ? ndl : 0.28 * (-ndl);
    col = alb * (key * lit * sh + uAmb * (0.5 + 0.5 * max(N.z, 0.0)) + uFillCol * max(dot(N, uFillDir), 0.0));
  }
  col = 1.0 - exp(-col * uExpo);
  col = pow(col, vec3(1.0 / 2.2));
  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - 0.45 * dot(q, q);
  o = vec4(col, 1.0);
}`;

  const VS_DUST = `#version 300 es
layout(location=0) in vec4 aD;
uniform mat4 uVP;
uniform vec3 uLamp, uAim, uCam;
uniform vec2 uSpot;
uniform float uPx;
out float vB;
void main() {
  vec4 c = uVP * vec4(aD.xyz, 1.0);
  gl_Position = c;
  vec3 L = normalize(aD.xyz - uLamp);
  float sp = smoothstep(uSpot.y, uSpot.x, dot(L, uAim));
  vec3 V = normalize(aD.xyz - uCam);
  float fwd = 0.25 + 1.4 * pow(max(dot(L, -V), 0.0), 3.0);
  vB = sp * fwd * (0.35 + 2.2 * aD.w);
  gl_PointSize = max(1.0, uPx * (1.2 + 1.6 * aD.w) * 700.0 / c.w);
}`;

  const FS_DUST = `#version 300 es
precision mediump float;
in float vB;
uniform vec3 uKeyCol;
uniform float uDust;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(d));
  o = vec4(uKeyCol * vB * a * uDust * 0.7, 1.0);
}`;

  VIZ.register({
    id: 'fold',
    name: 'Fold',
    order: 825,

    params: [
      { key: 'lamp', label: 'Lamp height', type: 'range', min: 4, max: 40, default: PRESETS.calm.lamp, step: 0.1 },
      { key: 'fill', label: 'Second lamp', type: 'range', min: 0, max: 1, default: PRESETS.calm.fill, step: 0.01 },
      { key: 'ink', label: 'Coloured side', type: 'range', min: 0, max: 1, default: PRESETS.calm.ink, step: 0.01 },
      { key: 'bloom', label: 'Open the form', type: 'range', min: 0, max: 1, default: PRESETS.calm.bloom, step: 0.01 },
      { key: 'spin', label: 'Turntable', type: 'range', min: 0, max: 1, default: PRESETS.calm.spin, step: 0.01 },
      { key: 'camera', label: 'Camera down close', type: 'range', min: 0, max: 1, default: PRESETS.calm.camera, step: 0.01 },
      { key: 'dust', label: 'Dust in the beam', type: 'range', min: 0, max: 1, default: PRESETS.calm.dust, step: 0.01 },
      { key: 'swing', label: 'Lamp swing', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'speed', label: 'Fold speed', type: 'range', min: 0.5, max: 2, default: 1, step: 0.01 },
      { key: 'paper', label: 'Paper', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'unfold', label: 'Unfold', run() { this.forceUnfold = true; } },
    ],

    gallery: {
      title: 'Fold',
      technique: 'WebGL2: exact rigid origami on the CPU (convex facets split along each fold line, each posed by composing its chain of hinge rotations every frame, rolled half-cylinder hinges at every cut edge), a crease height field stamped in sheet space for the ridges an unfolded sheet keeps, one low spot lamp with a 2048 PCF shadow map, through-light on the paper, a cool unshadowed fill, and dust points scattering in the beam',
      brief: 'One sheet of heavy white paper on a dark table under a single low lamp, folding itself into an origami form: a double blintz, a cupboard boat, a pinwheel, a kite. The next fold hovers part-way up with the pad; each kick completes it: a flap rises, stands in the raking light with its shadow swinging across the table, and lands with a small settle. Once the form is finished each kick lifts one of its free flaps and lets it fall, and after a dozen the kicks take it apart again. The snare is a breath that lifts every free flap at once; the pad swings the lamp so every shadow moves; hats glint in the dust in the beam. The drop drops the lamp and warms it, switches on a cool second lamp so the shadows go blue, brings up the coloured side of the paper, opens the finished form\'s flaps and turns it once on the table as the camera comes down to it. The breakdown unfolds it flat, one fold at a time, and every crease it ever made stays in the sheet as a ridge the low lamp picks out.',
      lineage: [
        'Batch 06 idea 25 (Curator): Letterpress\'s blind relief, Mobile\'s cast shadow as the second layer, Paper\'s cut sheets. A white-on-white scene where the drama is shadow.',
        'Chose flat-foldable recipes (blintz, cupboard, pinwheel, kite) over a crane: they fold exactly, one crease per kick, and every intermediate state is a real piece of folded paper; the drop\'s opening of the free flaps is what makes the finished form three-dimensional.',
        'v1 (640x360): the lamp sat behind the form, so the drop\'s opened flaps were backlit maroon; moved it to the side, which gives a lit face and a shadowed face on every flap. The intro and build were seven seconds of a motionless flat sheet, so the next fold now exists before its kick and hovers part-way up with the pad; the kick carries it on from there.',
        'Jolt (640x360): calm, kickArea 0.046, kickMean 0.012, ratio 1.77 (build 0.026, ratio 1.81). The kick moves one flap and its shadow and nothing else.',
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
      this.env = { kick: 0, prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0, bass: 0, pad: 0,
        lvl: 0, floor: 0.12, ceil: 0.55, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.recipeIdx = 0;
      this.unfolding = false;
      this.forceUnfold = false;
      this.formedKicks = 0;
      this.flapIdx = 0;
      this.lastStep = -9;
      this.flutT = -9;
      this.yaw = 0;
      this.camAz = 0;
      this.swingPh = 0;
      this.extent = S * 1.2;
      this.hf = new Float32Array(HT * HT);
      this.hfDirty = true;
      this.resetSheet();
      // Dust: x, y, z, glint.
      this.dust = new Float32Array(DUST * 4);
      this.dustV = new Float32Array(DUST * 3);
      for (let i = 0; i < DUST; i++) {
        this.dust[i * 4] = (Math.random() - 0.5) * 900;
        this.dust[i * 4 + 1] = (Math.random() - 0.5) * 700;
        this.dust[i * 4 + 2] = 10 + Math.random() * 260;
        this.dustV[i * 3] = Math.random() * 100;
        this.dustV[i * 3 + 1] = 0.6 + Math.random() * 0.8;
        this.dustV[i * 3 + 2] = Math.random();
      }
    },

    resetSheet() {
      this.facets = [{ poly: [[-S, -S], [S, -S], [S, S], [-S, S]], tags: [-1, -1, -1, -1], chain: [], F: ident() }];
      this.folds = [];
      this.done = 0;
    },

    recipe() { return RECIPES[this.recipeIdx % RECIPES.length]; },

    // ---- a crease into the height field, in sheet coordinates. sign is the
    // height seen from the front face: a valley fold made face-up dips.
    stamp(a, b, sign) {
      const k = HT / (2 * S);
      const ax = (a[0] + S) * k, ay = (a[1] + S) * k, bx = (b[0] + S) * k, by = (b[1] + S) * k;
      const w = 13 * k, w2 = 2.2 * k;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - w)), x1 = Math.min(HT - 1, Math.ceil(Math.max(ax, bx) + w));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - w)), y1 = Math.min(HT - 1, Math.ceil(Math.max(ay, by) + w));
      const hf = this.hf;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
          const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
          if (d >= w) continue;
          const q = 1 - d / w;
          let hgt = 0.9 * q * q;
          if (d < w2) hgt += 0.35 * (1 - d / w2);
          const i = y * HT + x;
          hf[i] = clamp(hf[i] + sign * hgt, -2.4, 2.4);
        }
      }
      this.hfDirty = true;
    },

    // ---- make fold number k of the recipe, from the flat folded state
    // A kick completes the next fold. It usually exists already as the
    // pending fold, hovering part-way up with the pad, so the kick carries
    // it on from where it is rather than starting a new flap from flat.
    foldNext(now, speed) {
      for (const f of this.folds) if (f.anim) f.anim.t0 = -1e9;   // finish anything still moving
      if (this.folds.length === this.done) this.createFold();
      const f = this.folds[this.done];
      f.anim = { kind: 'fold', t0: now, dur: 0.4 / speed, from: f.p };
      this.done++;
      this.lastStep = now;
    },

    createFold() {
      const k = this.folds.length;
      const step = this.recipe().steps[k];
      const nl = Math.hypot(step.n[0], step.n[1]);
      const n = [step.n[0] / nl, step.n[1] / nl];
      const c = (step.c / nl) * S;
      const moving = [], staying = [];
      const segs = [];
      for (const f of this.facets) {
        const elig = step.only === undefined || f.chain.includes(step.only);
        if (!elig) { staying.push(f); continue; }
        const s = f.poly.map(([u, v]) => {
          const w = ap(f.F, u, v, 0);
          const d = n[0] * w[0] + n[1] * w[1] - c;
          return Math.abs(d) < EPS ? 0 : d;
        });
        const hasP = s.some((x) => x > 0), hasN = s.some((x) => x < 0);
        const sign = -f.F.R[8];
        if (!hasP) { staying.push(f); continue; }
        if (!hasN) {
          const tags = f.tags.slice();
          for (let i = 0; i < s.length; i++) {
            const j = (i + 1) % s.length;
            if (s[i] === 0 && s[j] === 0) { tags[i] = k; segs.push([f.poly[i], f.poly[j], sign]); }
          }
          moving.push({ poly: f.poly, tags, chain: f.chain, F: f.F });
          continue;
        }
        const A = clip(f.poly, f.tags, s, 1, k);
        const B = clip(f.poly, f.tags, s, -1, -1);
        if (A) { moving.push({ poly: A.poly, tags: A.tags, chain: f.chain, F: f.F }); if (A.cut) segs.push([A.cut[0], A.cut[1], sign]); }
        if (B) staying.push({ poly: B.poly, tags: B.tags, chain: f.chain, F: f.F });
      }
      // Hinge height: just above what the flap will land on, and above the
      // flap's own layers, so it lands one thickness clear.
      const flat = (f) => f.poly.map(([u, v]) => { const w = ap(f.F, u, v, 0); return [w[0], w[1]]; });
      let zm = -Infinity, zl = -Infinity;
      const refl = [];
      for (const f of moving) {
        zm = Math.max(zm, f.F.t[2]);
        refl.push(flat(f).map(([x, y]) => { const d = n[0] * x + n[1] * y - c; return [x - 2 * d * n[0], y - 2 * d * n[1]]; }));
      }
      if (moving.length) {
        for (const f of staying) {
          const fp = flat(f);
          if (refl.some((r) => overlap(r, fp))) zl = Math.max(zl, f.F.t[2]);
        }
      } else zm = 0;
      const h = Math.max(zm + LAYER / 2, (zl + zm + LAYER) / 2);
      const fold = { n, c, h, d: [n[1], -n[0], 0], p: 0, open: 0, flapT: -9, anim: null, hover: 0, ang: 0 };
      this.folds.push(fold);
      const Rpi = foldRot(fold, PI);
      for (const f of moving) { f.chain = f.chain.concat(k); f.F = mul(Rpi, f.F); }
      this.facets = staying.concat(moving);
      for (const sg of segs) this.stamp(sg[0], sg[1], sg[2]);
    },

    unfoldOne(now, speed) {
      if (this.done === 0) return;
      for (const f of this.folds) if (f.anim) f.anim.t0 = -1e9;
      const f = this.folds[this.done - 1];
      f.anim = { kind: 'unfold', t0: now, dur: 0.55 / speed };
      this.done--;
      this.unfolding = true;
      this.lastStep = now;
    },

    leaves() {
      const leaf = new Array(this.folds.length).fill(false);
      for (let k = 0; k < this.done; k++) leaf[k] = true;
      for (const f of this.facets) {
        const ch = f.chain.filter((k) => k < this.done);
        for (let i = 0; i < ch.length - 1; i++) leaf[ch[i]] = false;
      }
      return leaf;
    },

    onKick(now, speed) {
      const steps = this.recipe().steps.length;
      if (this.unfolding) {
        if (this.done > 0) this.unfoldOne(now, speed);
        return;
      }
      if (this.done < steps) { this.foldNext(now, speed); return; }
      const leaf = this.leaves();
      const ids = [];
      leaf.forEach((l, i) => { if (l) ids.push(i); });
      if (ids.length) this.folds[ids[this.flapIdx++ % ids.length]].flapT = now;
      if (++this.formedKicks >= HOLD) this.unfolding = true;
    },

    // ---- onsets against slow baselines: only a jump is a hit
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kickHit = false, snareHit = false, hatHit = false;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kickHit = true; }
      e.prevK = kRaw;
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snareHit = true; }
      e.prevS = sRaw;
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hatHit = true; }
      e.prevH = hRaw;
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 1.2, dt);
      e.pad = ease(e.pad, clamp01((s[2] + s[3] + s[4]) / 180), 0.8, dt);
      e.lvl = ease(e.lvl, (s[0] + s[1]) / 200, 0.9, dt);
      e.ceil = Math.max(e.lvl, e.ceil - dt * 0.008);
      e.floor = Math.min(e.lvl, e.floor + dt * 0.006);
      return { kickHit, snareHit, hatHit };
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: true, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        return sh;
      };
      const link = (vs, fs) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        const u = {};
        const nu = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < nu; i++) {
          const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
          u[name] = gl.getUniformLocation(prog, name);
        }
        return { prog, u };
      };
      this.pMain = link(VS_MAIN, FS_MAIN);
      this.pDepth = link(VS_DEPTH, FS_DEPTH);
      this.pDust = link(VS_DUST, FS_DUST);

      this.buf = gl.createBuffer();
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const st = 12 * 4;
      [[0, 3, 0], [1, 3, 3], [2, 3, 6], [3, 2, 9], [4, 1, 11]].forEach(([loc, n, off]) => {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, n, gl.FLOAT, false, st, off * 4);
      });
      this.dustBuf = gl.createBuffer();
      this.vaoDust = gl.createVertexArray();
      gl.bindVertexArray(this.vaoDust);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      // Crease height field.
      this.texH = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texH);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Shadow map.
      this.texS = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texS);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      this.fbS = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbS);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.texS, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      this.gl = gl;
      this.glCanvas = c;
      this.hfDirty = true;
    },

    // ---- geometry: the table quad, then paper facets and hinge rolls
    build(model) {
      const out = [];
      const push = (p, nrm, t, u, v, kind) => { out.push(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], t[0], t[1], t[2], u, v, kind); };
      const T = 1600;
      const tq = [[-T, -T], [T, -T], [T, T], [-T, -T], [T, T], [-T, T]];
      for (const [x, y] of tq) push([x, y, 0], [0, 0, 1], [1, 0, 0], 0, 0, 2);
      const tableVerts = 6;

      const rots = this.folds.map((f) => foldRot(f, f.ang));
      const chainM = (ch, a, b) => { let M = ident(); for (let i = a; i < b; i++) M = mul(rots[ch[i]], M); return M; };
      const uv = (u, v) => [u / (2 * S) + 0.5, v / (2 * S) + 0.5];
      let ext = 0;
      for (const f of this.facets) {
        const M = mul(model, chainM(f.chain, 0, f.chain.length));
        const nrm = apR(M, 0, 0, 1), tu = apR(M, 1, 0, 0);
        const P = f.poly.map(([u, v]) => ap(M, u, v, 0));
        for (const q of P) ext = Math.max(ext, Math.hypot(q[0], q[1]));
        for (let i = 1; i < P.length - 1; i++) {
          for (const j of [0, i, i + 1]) { const [a, b] = uv(f.poly[j][0], f.poly[j][1]); push(P[j], nrm, tu, a, b, 0); }
        }
        // Hinge rolls on this piece's cut edges.
        for (let i = 0; i < f.poly.length; i++) {
          const k = f.tags[i];
          if (k < 0) continue;
          const pos = f.chain.indexOf(k);
          const fk = this.folds[k];
          if (pos < 0 || fk.ang < 0.02) continue;
          const Mb = chainM(f.chain, 0, pos);
          const Ma = mul(model, chainM(f.chain, pos + 1, f.chain.length));
          const A = f.poly[i], B = f.poly[(i + 1) % f.poly.length];
          const nb = apR(Mb, 0, 0, 1);
          const segN = 6;
          let prev = null;
          for (let sI = 0; sI <= segN; sI++) {
            const phi = fk.ang * sI / segN;
            const Mi = mul(Ma, mul(foldRot(fk, phi), Mb));
            const Rm = mul(Ma, foldRot(fk, phi));
            const nn = apR(Rm, nb[0], nb[1], nb[2]);
            const pa = ap(Mi, A[0], A[1], 0), pb = ap(Mi, B[0], B[1], 0);
            const tt = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
            const cur = { pa, pb, nn, tt };
            if (prev) {
              const [ua, va] = uv(A[0], A[1]), [ub, vb] = uv(B[0], B[1]);
              push(prev.pa, prev.nn, tt, ua, va, 1); push(prev.pb, prev.nn, tt, ub, vb, 1); push(cur.pb, cur.nn, tt, ub, vb, 1);
              push(prev.pa, prev.nn, tt, ua, va, 1); push(cur.pb, cur.nn, tt, ub, vb, 1); push(cur.pa, cur.nn, tt, ua, va, 1);
            }
            prev = cur;
          }
        }
      }
      this.ext = ext;
      return { data: new Float32Array(out), tableVerts, count: out.length / 12 };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.env) this.init();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.T += dt;
      const now = this.T;
      const e = this.env;
      const hits = this.listen(signals, dt);
      const react = params.react;
      const speed = params.speed;

      // ---- follow the track: calm <-> drop
      const follow = Math.round(params.follow) === 1;
      const span = Math.max(0.18, e.ceil - e.floor);
      const rel = (e.lvl - e.floor) / span;
      const want = follow ? smooth(0.35, 0.8, rel) : 0;
      e.auto = ease(e.auto, want, want > e.auto ? 1.4 : 0.35, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const paper = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];

      // ---- the folding
      if (hits.kickHit && react > 0.05) this.onKick(now, speed);
      if (hits.snareHit && react > 0.05) this.flutT = now;
      const quiet = rel < 0.3 && this.since.kick > 1.6;
      if ((quiet || this.forceUnfold) && this.done > 0 && now - this.lastStep > 0.62 / speed) this.unfoldOne(now, speed);
      const moving = this.folds.some((f) => f.anim && now - f.anim.t0 < f.anim.dur);
      if (this.unfolding && this.done === 0 && !moving) {
        this.resetSheet();
        this.recipeIdx++;
        this.unfolding = false;
        this.forceUnfold = false;
        this.formedKicks = 0;
        // Old ridges soften with each new form, so the sheet never silts up.
        for (let i = 0; i < this.hf.length; i++) this.hf[i] *= 0.72;
        this.hfDirty = true;
      }
      if (this.done === 0) this.forceUnfold = false;

      const steps = this.recipe().steps.length;
      const formed = this.done === steps && !this.unfolding;
      // The pending fold: once the last crease has landed, the next one
      // starts to lift with the pad, as if the paper were considering it.
      const settled = !this.folds.some((f) => f.anim && now - f.anim.t0 < f.anim.dur);
      if (!this.unfolding && settled && this.done < steps && this.folds.length === this.done && now - this.lastStep > 0.25) this.createFold();
      if (this.folds.length > this.done) {
        const pf = this.folds[this.done];
        const hv = this.unfolding ? 0 : Math.min(react, 1.5) * (0.04 + 0.2 * e.pad);
        pf.hover = ease(pf.hover, hv, 1.2, dt);
      }
      const leaf = this.leaves();
      const flutU = (now - this.flutT) / 0.4;
      const flut = flutU >= 0 && flutU < 1 ? Math.sin(PI * flutU) * (1 - flutU) * 1.6 : 0;
      this.folds.forEach((f, k) => {
        const a = f.anim;
        const u = a ? (now - a.t0) / a.dur : 1;
        if (!a) f.p = f.hover;
        else if (u >= 1) f.p = a.kind === 'unfold' ? 0 : 1;
        else if (a.kind === 'unfold') f.p = 1 - inOut(u);
        else f.p = a.from + (1 - a.from) * (u < 0.78 ? inOut(u / 0.78) : 1 - 0.05 * Math.sin(PI * (u - 0.78) / 0.22));
        const openT = leaf[k] ? (formed ? P.bloom * 1.45 : 0.06) : 0;
        f.open = ease(f.open, openT, 2.2, dt);
        const fu = (now - f.flapT) / 0.55;
        let flap = 0;
        if (fu >= 0 && fu < 1) flap = fu < 0.3 ? Math.sin((fu / 0.3) * PI / 2) : 1 - inOut((fu - 0.3) / 0.7);
        const extra = leaf[k] ? (flap * 0.95 + flut * 0.16) * Math.min(react, 1.5) : 0;
        f.ang = Math.max(0, f.p * (PI - f.open) - extra * f.p);
      });

      // ---- motion: the turntable, the camera's drift, the swinging lamp
      const bassK = 1 + 0.8 * e.bass * react;
      this.yaw += dt * P.spin * 0.8 * bassK;
      this.camAz += dt * 0.025 * bassK;
      this.swingPh += dt * (0.35 + 0.5 * e.pad);
      const model = mul({ R: [Math.cos(this.yaw), -Math.sin(this.yaw), 0, Math.sin(this.yaw), Math.cos(this.yaw), 0, 0, 0, 1], t: [0, 0, LIFT] }, ident());

      const geo = this.build(model);
      this.extent = ease(this.extent, Math.max(this.ext, S * 0.55), 0.6, dt);

      // Dust drifts in slow curls; hats set a few motes glinting.
      const dd = this.dust, dv = this.dustV;
      for (let i = 0; i < DUST; i++) {
        const ph = dv[i * 3], sp = dv[i * 3 + 1];
        dd[i * 4] += dt * sp * (6 + 5 * Math.sin(now * 0.13 + ph));
        dd[i * 4 + 1] += dt * sp * 4 * Math.cos(now * 0.11 + ph * 1.3);
        dd[i * 4 + 2] += dt * sp * 3 * Math.sin(now * 0.09 + ph * 0.7);
        if (dd[i * 4] > 450) dd[i * 4] -= 900;
        if (dd[i * 4 + 1] > 350) dd[i * 4 + 1] -= 700;
        if (dd[i * 4 + 1] < -350) dd[i * 4 + 1] += 700;
        if (dd[i * 4 + 2] > 280) dd[i * 4 + 2] = 10;
        if (dd[i * 4 + 2] < 8) dd[i * 4 + 2] = 280;
        dd[i * 4 + 3] *= Math.exp(-dt / 0.18);
      }
      if (hits.hatHit && react > 0.05) {
        for (let j = 0; j < 22; j++) {
          const i = Math.floor(Math.random() * DUST);
          dd[i * 4 + 3] = Math.min(1, 0.6 * react + Math.random() * 0.4);
        }
      }

      // ---- render
      if (!this.gl && !this.glFailed) { try { this.initGL(); } catch (err) { this.glFailed = true; console.warn(err); } }
      const W = ctx.width, H = ctx.height;
      if (!this.gl) {
        p.background(20);
        p.noStroke(); p.fill(220);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Fold needs WebGL2', W / 2, H / 2);
        return;
      }
      const gl = this.gl;
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }

      if (this.hfDirty) {
        gl.bindTexture(gl.TEXTURE_2D, this.texH);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, HT, HT, 0, gl.RED, gl.FLOAT, this.hf);
        this.hfDirty = false;
      }

      // Lamp: low, off to one side, swinging with the pad.
      const lampEl = clamp(P.lamp, 3, 60) * PI / 180;
      const lampAz = 0.4 + params.swing * (0.25 + 0.5 * e.pad) * Math.sin(this.swingPh) * 0.9;
      const LD = 600;
      const lamp = [LD * Math.cos(lampEl) * Math.cos(lampAz), LD * Math.cos(lampEl) * Math.sin(lampAz), LD * Math.sin(lampEl)];
      const aim = lamp.map((v) => -v / LD);
      const lampV = lookAt(lamp, [0, 0, 0], [0, 0, 1]);
      const lampP = perspective(2 * Math.atan(340 / LD), 1, 60, LD + 560);
      const LVP = mat4mul(lampP, lampV);

      // Camera: high and far in the calm, down close to the form in the drop,
      // always drifting round.
      const cm = clamp01(P.camera);
      const camEl = (62 - 30 * cm) * PI / 180;
      const camDist = (980 - 400 * cm) * (0.5 + 0.5 * this.extent / (S * 1.35));
      const camAz = -1.35 + 0.35 * Math.sin(this.camAz) + 0.1 * Math.sin(this.camAz * 2.3 + 1);
      const tz = 10 * cm;
      const cam = [camDist * Math.cos(camEl) * Math.cos(camAz), camDist * Math.cos(camEl) * Math.sin(camAz), tz + camDist * Math.sin(camEl)];
      const VP = mat4mul(perspective(30 * PI / 180, w / h, 60, 4000), lookAt(cam, [0, 0, tz], [0, 0, 1]));

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, geo.data, gl.DYNAMIC_DRAW);

      // Shadow pass: the paper only.
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbS);
      gl.viewport(0, 0, SHADOW, SHADOW);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.5, 3);
      gl.useProgram(this.pDepth.prog);
      gl.uniformMatrix4fv(this.pDepth.u.uVP, false, LVP);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, geo.tableVerts, geo.count - geo.tableVerts);
      gl.disable(gl.POLYGON_OFFSET_FILL);

      // Main pass.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const u = this.pMain.u;
      gl.useProgram(this.pMain.prog);
      gl.uniformMatrix4fv(u.uVP, false, VP);
      gl.uniformMatrix4fv(u.uLVP, false, LVP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texH); gl.uniform1i(u.uCrease, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texS); gl.uniform1i(u.uShadow, 1);
      gl.uniform3fv(u.uCam, cam);
      gl.uniform3fv(u.uLamp, lamp);
      gl.uniform3fv(u.uAim, aim);
      // Warmer as it drops; the intensity rises as the lamp lowers so the
      // flat sheet keeps about the same brightness and only the relief and
      // shadows grow.
      const warm = clamp01(P.fill);
      const kI = 0.3 / Math.max(Math.sin(lampEl), 0.09);
      gl.uniform3f(u.uKeyCol, kI * 1.0, kI * (0.93 - 0.14 * warm), kI * (0.82 - 0.28 * warm));
      const fillAz = lampAz + PI + 0.6, fillEl = 0.45;
      gl.uniform3f(u.uFillDir, Math.cos(fillEl) * Math.cos(fillAz), Math.cos(fillEl) * Math.sin(fillAz), Math.sin(fillEl));
      const fI = 0.3 * P.fill;
      gl.uniform3f(u.uFillCol, 0.28 * fI, 0.45 * fI, 1.0 * fI);
      gl.uniform3f(u.uAmb, 0.018, 0.019, 0.022);
      const ink = clamp01(P.ink);
      const back = paper.front.map((v, i) => v + (paper.back[i] - v) * ink);
      gl.uniform3fv(u.uFront, paper.front);
      gl.uniform3fv(u.uBack, back);
      gl.uniform3fv(u.uTable, paper.table);
      gl.uniform1f(u.uGrain, paper.grain);
      gl.uniform2f(u.uSpot, Math.cos(8 * PI / 180), Math.cos(40 * PI / 180));
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uLampDist, LD);
      gl.uniform1f(u.uSheet, 2 * S);
      gl.uniform1f(u.uExpo, 1.25);
      gl.drawArrays(gl.TRIANGLES, 0, geo.count);

      // Dust in the beam.
      if (P.dust > 0.01) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBuf);
        gl.bufferData(gl.ARRAY_BUFFER, dd, gl.DYNAMIC_DRAW);
        gl.useProgram(this.pDust.prog);
        const ud = this.pDust.u;
        gl.uniformMatrix4fv(ud.uVP, false, VP);
        gl.uniform3fv(ud.uLamp, lamp);
        gl.uniform3fv(ud.uAim, aim);
        gl.uniform3fv(ud.uCam, cam);
        gl.uniform2f(ud.uSpot, Math.cos(8 * PI / 180), Math.cos(40 * PI / 180));
        gl.uniform1f(ud.uPx, Math.min(w, h) / 600 * 1.4);
        gl.uniform3f(ud.uKeyCol, 1.0, 0.9 - 0.12 * warm, 0.75 - 0.2 * warm);
        gl.uniform1f(ud.uDust, P.dust);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);
        gl.bindVertexArray(this.vaoDust);
        gl.drawArrays(gl.POINTS, 0, DUST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      gl.bindVertexArray(null);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, W, H);
    },
  });
})();
