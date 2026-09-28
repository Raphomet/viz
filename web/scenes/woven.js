// Rule Runner — kilim runners woven live by cellular automata.
//
// Batch 06, "Woven rules" (Knit, Stamps, Chomper; Wolfram automata). Of the
// three alternatives in the brief this builds the cellular-automaton runner
// carpet, borrowing the frontier idea from the wave-function-collapse one:
// the drop opens more looms, each a new frontier starting from one knot.
// The moiré option is Moiré Weave's scene, built in parallel.
//
// Why the carpet: it is the only alternative that travels. The loom beam sits
// near the bottom of the frame; every row it weaves is one generation of a
// symmetric elementary automaton (rules 90, 22, 126, 54, 150, ...), and the
// finished runner slides away from us across a sand floor into the haze, so
// the image is the recent history of the set receding towards the horizon.
// That also gives the accumulation its erasure for free (the judges' complaint
// about Knit and Stamps): nothing saturates, it just leaves.
//
// Craft notes:
// - Symmetric rules on a palindromic row stay palindromic, which is exactly
//   what makes a kilim read as a kilim; kicks flip a mirrored pair of knots so
//   the symmetry survives them. In the Lace family each band grows from one
//   centre knot until the Sierpinski-style triangle reaches the selvedges, then
//   a stripe row closes the band and a new one starts, as real runners are
//   banded. Storm and Stripes run continuously from dense seeds.
// - A kick's knots carry a dye cone: the scene keeps an unperturbed shadow
//   copy of the automaton from the moment of the kick, and every later cell
//   that differs from it is dyed in the accent. That is the true light cone of
//   the perturbation, so with rule 90 each kick weaves its own small red
//   Sierpinski triangle that then travels away up the runner.
// - The runners are real geometry in WebGL2 (one triangle strip per runner,
//   one vertex pair per row), so the perspective, the travelling lift wave and
//   the soft cast shadow on the floor are all correct; each runner's colours
//   live in a 51 x 512 ring texture, one texel per knot, written a row at a
//   time and mipmapped, and the fragment shader adds the weft ribs and heather
//   near the camera and fades to the filtered average in the distance.
// - The loom beams, warp threads and fibres are Canvas 2D over the GL layer.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INNER = 45;                  // automaton width, odd so it has a centre knot
  const BORDER = 3;
  const COLS = INNER + BORDER * 2;   // knots across, selvedge included
  const MID = (INNER - 1) / 2;
  const RING = 512;                  // texture rows; divides 4096 (see rowBase)
  const VIS = 440;                   // rows drawn behind the beam
  const GAP = 7;                     // world units between runners
  const FOV = 56 * Math.PI / 180;
  const DIST = 70;                   // camera to the beam, world units (a knot is 1)
  const LIFE = 16;                   // rows a kick's dye cone lasts
  const FRINGE = 2.2;                // fringe length in rows
  const LOOM_X = [0, -1, 1, -2, 2];
  const RUG_ROWS = 38;

  const FAMILIES = [
    { name: 'Lace', rules: [90, 22, 126, 18, 150], banded: true },
    { name: 'Storm', rules: [54, 150, 182, 126, 22], banded: false },
    { name: 'Stripes', rules: [108, 178, 94, 50], banded: false },
  ];

  const WOOLS = [
    { name: 'Madder', ground: '#eadcbf', ink: '#8c2a22', dye2: '#2a3d63', dye3: '#c68b2b',
      accent: '#ef5a1c', accent2: '#f0a92c', border: '#3b2620', stripe: '#2a3d63', warp: '#efe5d0' },
    { name: 'Indigo', ground: '#1f2e4c', ink: '#e7dbc0', dye2: '#b2542e', dye3: '#89a27e',
      accent: '#f3b62f', accent2: '#ef6a2a', border: '#e7dbc0', stripe: '#b2542e', warp: '#e9e1cd' },
    { name: 'Kilim', ground: '#983325', ink: '#221815', dye2: '#e9dbbb', dye3: '#d29b37',
      accent: '#35a39a', accent2: '#8fd0c4', border: '#221815', stripe: '#d29b37', warp: '#efe5d0' },
  ];

  const PRESETS = {
    calm: { family: 0, speed: 0.8, looms: 1, dyes: 0.2, wave: 0.35, tilt: 0.3, push: 1 },
    drop: { family: 1, speed: 1.6, looms: 3, dyes: 0.85, wave: 1.5, tilt: 0.72, push: 1.3 },
    // Five runners in the air, low over the dunes: the peak of a set.
    flying: { family: 1, speed: 1.3, looms: 5, dyes: 1, wave: 2.3, tilt: 0.86, push: 1.2 },
    // Class-2 rules, one runner, overhead: the long exhale.
    stripes: { family: 2, speed: 0.5, looms: 1, dyes: 0.55, wave: 0.15, tilt: 0.12, push: 0.8 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['speed', 'looms', 'dyes', 'wave', 'tilt', 'push'];

  const WORLD = {
    skyTop: '#aebfc6', skyHor: '#e9dfcc', haze: '#e6dcc8', dune: '#cfb48c',
    sand: '#d4b98f', sandDark: '#b08e64', shadow: '#4a3322',
  };

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function glc(c) { return [c[0] / 255, c[1] / 255, c[2] / 255]; }

  function stepCA(src, dst, rule) {
    const N = src.length;
    for (let i = 0; i < N; i++) {
      const l = src[i === 0 ? N - 1 : i - 1], c = src[i], r = src[i === N - 1 ? 0 : i + 1];
      dst[i] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
    }
  }

  // ---- Shaders ---------------------------------------------------------------

  const VS_FULL = `#version 300 es
in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // Sky, distant dunes and the sand floor, by casting each pixel's ray.
  const FS_WORLD = `#version 300 es
precision highp float;
in vec2 vNdc;
out vec4 o;
uniform float uTh, uH, uTan, uAsp, uTravel, uTime;
uniform vec3 uSkyTop, uSkyHor, uHaze, uDune, uSand, uSandDark;
void main() {
  float yc = vNdc.y * uTan;
  vec3 dir = vec3(vNdc.x * uTan * uAsp, yc * cos(uTh) - sin(uTh), yc * sin(uTh) + cos(uTh));
  float len = length(dir);
  vec3 col;
  if (dir.y < -1e-5) {
    float t = uH / -dir.y;
    vec3 P = vec3(0.0, uH, 0.0) + t * dir;
    float dist = t * len;
    float z = P.z + uTravel;
    float ph = z * 0.42 + 1.7 * sin(P.x * 0.043 + z * 0.0123) + 0.9 * sin(P.x * 0.11 - z * 0.0215);
    float aa = fwidth(ph);
    float rip = pow(0.5 + 0.5 * sin(ph), 3.0) * (1.0 - smoothstep(0.5, 2.0, aa));
    float broad = 0.5 + 0.5 * sin(P.x * 0.017 + z * 0.0049) * sin(z * 0.0071 - P.x * 0.006);
    col = mix(uSand, uSandDark, 0.3 * rip + 0.16 * broad);
    float fog = smoothstep(80.0, 620.0, dist);
    col = mix(col, uHaze, fog);
  } else {
    float e = dir.y / len;
    float a = atan(dir.x, dir.z);
    float px = fwidth(e);
    col = mix(uSkyHor, uSkyTop, smoothstep(0.0, 0.4, e));
    // Thin high cirrus, drifting.
    float band = smoothstep(0.03, 0.09, e) * (1.0 - smoothstep(0.16, 0.42, e));
    float streak = smoothstep(0.55, 1.0, sin(e * 150.0 + 2.5 * sin(a * 3.0 + uTime * 0.021) + sin(a * 7.0 - uTime * 0.013)));
    float cpatch = smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(a * 2.3 + uTime * 0.017) * sin(a * 5.1 - e * 20.0 + 1.0));
    col = mix(col, vec3(0.97, 0.95, 0.9), 0.45 * band * streak * cpatch);
    // Two ranges of dunes: a far one in the haze, a nearer one with a lit
    // and a shadowed face, low sun behind us.
    float d1 = 0.034 + 0.014 * sin(a * 4.0 + 1.3) + 0.006 * sin(a * 11.0 + 0.4) + 0.003 * sin(a * 27.0 + 2.0);
    float d2 = 0.017 + 0.011 * sin(a * 6.0 + 2.1) + 0.005 * sin(a * 15.0 + 1.0);
    float s2 = cos(a * 6.0 + 2.1) * 6.0 * 0.011 + cos(a * 15.0 + 1.0) * 15.0 * 0.005;
    float in1 = 1.0 - smoothstep(d1 - px, d1 + px, e);
    float in2 = 1.0 - smoothstep(d2 - px, d2 + px, e);
    col = mix(col, mix(uDune, uHaze, 0.62), in1);
    vec3 face = uDune * mix(0.84, 1.08, smoothstep(-0.04, 0.04, s2));
    col = mix(col, mix(face, uHaze, 0.3), in2);
  }
  o = vec4(col, 1.0);
}`;

  const VS_STRIP = `#version 300 es
in vec3 aPos;
in vec3 aAttr;
uniform float uTh, uH, uTan, uAsp;
out float vU, vRow, vShade, vDist;
void main() {
  vec3 d = aPos - vec3(0.0, uH, 0.0);
  float yc = d.y * cos(uTh) + d.z * sin(uTh);
  float zc = d.y * sin(uTh) - d.z * cos(uTh);
  vU = aAttr.x; vRow = aAttr.y; vShade = aAttr.z;
  vDist = length(d);
  // A real near plane (1 unit) so rugs passing under the camera clip cleanly.
  gl_Position = vec4(d.x / (uTan * uAsp), yc / uTan, (-zc) * 1.0004 - 2.0004, -zc);
}`;

  const FS_STRIP = `#version 300 es
precision highp float;
precision highp sampler2D;
in float vU, vRow, vShade, vDist;
out vec4 o;
uniform sampler2D uTex;
uniform int uMode;
uniform float uFirst, uLast, uHead, uTime, uGlint, uM;
uniform vec3 uHaze, uWarp, uShadow;
const float COLS = ${COLS}.0;
const float RING = ${RING}.0;
const float VIS = ${VIS}.0;
const float TAU = 6.2831853;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float fog = smoothstep(80.0, 620.0, vDist);
  float tail = 1.0 - smoothstep(VIS - 90.0, VIS, uHead - vRow);
  if (uMode == 0) {
    float m = uM;
    float e = smoothstep(-m, m, vU) * smoothstep(1.0 + m, 1.0 - m, vU);
    float ends = smoothstep(uFirst - 2.0, uFirst + 1.5, vRow) * smoothstep(uLast + 2.0, uLast - 1.5, vRow);
    float a = 0.36 * e * ends / (1.0 + vShade * 0.22) * (1.0 - fog) * tail;
    o = vec4(uShadow * a, a);
    return;
  }
  float cx = vU * COLS;
  vec3 col;
  if (vRow < uFirst || vRow > uLast) {
    float over = vRow < uFirst ? uFirst - vRow : vRow - uLast;
    float th = cx * 1.5;
    float id = floor(th);
    float fx = fract(th);
    float len = 0.9 + 1.2 * hash(vec2(id, vRow < uFirst ? 1.0 : 2.0));
    float wob = 0.08 * sin(over * 3.0 + id);
    if (abs(fx - 0.5 - wob) > 0.2 || over > len) discard;
    col = uWarp * (0.82 + 0.18 * hash(vec2(id, 3.0)));
  } else {
    float r = floor(vRow);
    ivec2 cell = ivec2(clamp(floor(cx), 0.0, COLS - 1.0), int(mod(r, RING)));
    vec4 nearC = texelFetch(uTex, cell, 0);
    vec2 uv = vec2(vU, vRow / RING);
    vec4 farC = textureGrad(uTex, uv, dFdx(uv), dFdy(uv));
    float fw = max(fwidth(cx), fwidth(vRow));
    float det = 1.0 - smoothstep(0.3, 0.9, fw);
    col = mix(farC.rgb, nearC.rgb, det);
    vec2 l = vec2(fract(cx), fract(vRow));
    float h = hash(vec2(floor(cx), r));
    // Two weft picks per knot, slanting a little, and the warp showing
    // between knots: a flat-woven kilim rather than a pile carpet.
    float weft = 0.5 + 0.5 * cos((l.y + 0.18 * l.x) * TAU * 2.0);
    float edge = smoothstep(0.0, 0.16, l.x) * smoothstep(1.0, 0.84, l.x);
    float t = (0.88 + 0.12 * weft) * mix(0.8, 1.0, edge) * (0.94 + 0.12 * h);
    col *= mix(1.0, t, det);
    if (nearC.a < 0.9) {
      float sh = 0.5 + 0.5 * sin(uTime * 6.0 + h * 50.0);
      col = mix(col, vec3(1.0, 0.93, 0.7), det * uGlint * sh * 0.8);
    }
  }
  col *= vShade;
  col = mix(col, uHaze, fog);
  o = vec4(col * tail, tail);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const u = {};
    const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(pr, i);
      u[info.name] = gl.getUniformLocation(pr, info.name);
    }
    return { pr, u };
  }

  VIZ.register({
    id: 'woven',
    name: 'Rule Runner',
    order: 807,

    params: [
      { key: 'wool', label: 'Wool', type: 'select', options: WOOLS.map((w) => w.name), default: 0 },
      { key: 'family', label: 'Rules', type: 'select', options: FAMILIES.map((f) => f.name), default: PRESETS.calm.family },
      { key: 'speed', label: 'Weaving speed', type: 'range', min: 0.2, max: 3, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'looms', label: 'Looms', type: 'range', min: 1, max: 5, default: PRESETS.calm.looms, step: 0.01 },
      { key: 'dyes', label: 'Dyes', type: 'range', min: 0, max: 1, default: PRESETS.calm.dyes, step: 0.01 },
      { key: 'wave', label: 'Carpet wave', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.wave, step: 0.01 },
      { key: 'tilt', label: 'Camera: overhead to horizon', type: 'range', min: 0, max: 1, default: PRESETS.calm.tilt, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: PRESETS.calm.push, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],

    presets: PRESETS,

    gallery: {
      title: 'Rule Runner',
      technique: 'WebGL2: runners as perspective triangle strips (one vertex pair per woven row) textured from per-runner 51 x 512 ring textures written one automaton generation at a time and mipmapped, weft ribs and heather in the fragment shader, a ray-cast sand floor, dunes and haze, soft cast shadows as widened strips; symmetric elementary cellular automata with an unperturbed shadow copy per kick for the dye cone; Canvas 2D loom beams, warp threads and fibres on top',
      brief: 'Kilim runners woven live by cellular automata on a sand floor in late daylight. A loom beam near the bottom of the frame weaves one automaton generation per row, and the finished runner slides away from us into the haze, so the image is the recent history of the set receding to the horizon. In quiet passages one runner weaves Lace: each band grows from a single centre knot into a symmetric Sierpinski triangle, madder on undyed wool, closed by an indigo stripe. The kick beats the loom: the beam thumps, a mirrored pair of vermilion knots is woven in and fibres fly, and the knots dye their light cone, so a small red triangle opens inside the pattern and travels away. The snare swaps one loom\'s rule and weaves a stripe row. Hats sparkle as gold threads that glint as they pass. Bass sets the weaving speed (so the travel) and the height of a slow wave running along the runners. The drop opens two more looms, each a new frontier starting from one knot, turns the rules to Storm (54, 150, 182), adds two more dyes by knot ancestry, lifts the runners off the sand in waves with their shadows sliding beneath, and lowers the camera until the dunes and the sky appear. The breakdown closes the side looms: their fringed ends travel away to the horizon.',
      lineage: [
        'Batch 06 idea 7, "Woven rules" (Purist and Psychonaut): Knit, Stamps, Chomper; wave function collapse; Wolfram automata; Interference. Chose the cellular-automaton runner carpet (the Purist\'s Cellular Carpet) over the WFC tapestry and the moiré sheets: it is the only one of the three that travels, its scroll gives Knit\'s accumulation the erasure the judges asked for, and Moiré Weave takes the moiré. From the WFC idea it keeps "the drop opens several frontiers at once", as new looms that each start from one knot.',
        'Symmetric rules (f(abc) = f(cba)) on a palindromic row stay palindromic, which is what makes the automaton read as a kilim; kicks flip mirrored pairs so they never break it. The dye cone is the true light cone of the kick: an unperturbed shadow automaton is stepped alongside for 30 rows and every differing knot is dyed.',
        'Built for the performer model: every drop change is a param (Rules, Weaving speed, Looms, Dyes, Carpet wave, Camera, Reaction strength), presets calm, drop, flying and stripes, and Follow the track eases between the calm and drop looks from a hysteretic follower on the bass line.',
      ],
    },

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.built = false;
      this.env = { kick: 0, hat: 0, bass: 0, prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0,
        low: 0, dropOn: false, auto: 0, thump: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
    },

    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kick = 0, snare = 0, hat = 0;
      // Kick: band 0 leading band 1, so the bass line's own notes don't count.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kick = kRaw; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snare = sRaw; }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hat = hRaw; }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.25));

      e.bass = ease(e.bass, clamp01((s[1] + 0.3 * s[2]) / 110), 2.2, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, snare, hat };
    },

    // ---- GL ---------------------------------------------------------------

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      try {
        this.pWorld = program(gl, VS_FULL, FS_WORLD);
        this.pStrip = program(gl, VS_STRIP, FS_STRIP);
      } catch (err) {
        console.error('woven: shader', err && err.message);
        this.glFailed = true;
        return;
      }
      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vbo = gl.createBuffer();
      this.verts = new Float32Array((VIS + 16) * 2 * 6 * 2);
      this.texs = [];
      for (let i = 0; i <= LOOM_X.length; i++) {   // one more: the drying rugs
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1 + Math.floor(Math.log2(RING)), gl.RGBA8, COLS, RING);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this.texs.push(t);
      }
      this.gl = gl;
      this.glCanvas = c;
    },

    // ---- Weaving ------------------------------------------------------------

    build(params) {
      const W = WOOLS[clamp(Math.round(params.wool), 0, WOOLS.length - 1)];
      this.woolIdx = Math.round(params.wool);
      const pal = {};
      for (const k in W) if (k !== 'name') pal[k] = hex(W[k]);
      this.pal = pal;
      this.rowBuf = new Uint8Array(COLS * 4);
      this.looms = LOOM_X.map((x, idx) => ({
        idx, x, active: false, segs: [], state: new Uint8Array(INNER), next: new Uint8Array(INNER),
        shadows: [], flips: [], glints: 0, stripe: 0, family: -1, ruleI: idx % 3, rule: 90,
        bandRow: 0, still: 0, pres: 0, dirty: false,
      }));
      this.written = 0;
      this.head = 0;
      this.fibres = [];
      this.pops = [];
      this.snareTurn = 0;
      this.wavePhase = 0;
      this.rand = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
      // Pre-weave a stretch of runner so the intro is not bare, with a few
      // earlier kicks and rule changes in it, as if the set had been going.
      const P = Object.assign({}, PRESETS.calm);
      for (let n = 0; n < 380; n++) {
        this.head = n;
        if (n % 17 === 4) this.kickLoom(this.looms[0], 0.7);
        if (n % 61 === 30) this.snareLoom(this.looms[0]);
        this.weave(P);
      }
      this.head = this.written;
      this.buildRugs();
      this.built = true;
    },

    // Finished rugs laid out on the sand to dry, woven once at build into a
    // sixth texture (six rugs of RUG_ROWS rows) by the same automaton. The
    // floor travels with the runners, so they drift past and away: parallax,
    // and something in the empty sand beside a single calm runner.
    buildRugs() {
      const R = { idx: LOOM_X.length, x: 0, active: true, segs: [], state: new Uint8Array(INNER), next: new Uint8Array(INNER),
        shadows: [], flips: [], glints: 0, stripe: 0, family: 0, ruleI: 0, rule: 90, bandRow: 0, still: 0, band: 0 };
      for (let k = 0; k < 6; k++) {
        const fam = [0, 1, 0, 2, 1, 0][k];
        R.family = fam;
        R.ruleI = Math.floor(this.rand() * FAMILIES[fam].rules.length);
        R.rule = FAMILIES[fam].rules[R.ruleI];
        this.seed(R, fam);
        R.band = k;
        const P = { dyes: [0.2, 0.9, 0.5, 0.8, 0.95, 0.4][k] };
        for (let r = 0; r < RUG_ROWS; r++) {
          if (r === 0 || r === RUG_ROWS - 2) R.stripe = 2;
          if (fam !== 0 && r % 11 === 10) { R.band++; }
          this.weaveRow(R, k * (RUG_ROWS + 4) + r, P);
        }
      }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texs[LOOM_X.length]);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.rugs = [];
      this.rugSide = 1;
      for (let z = -10; z < 700; z += 70 + this.rand() * 70) this.spawnRug(z);
      this.nextRug = this.head + 30;
    },

    spawnRug(Z) {
      const side = (this.rugSide = -this.rugSide);
      const k = Math.floor(this.rand() * 6);
      this.rugs.push({ X: side * (78 + this.rand() * 70), base: Z - this.head, ang: (this.rand() - 0.5) * 0.6,
        row0: k * (RUG_ROWS + 4), len: RUG_ROWS * (0.8 + this.rand() * 0.2) | 0 });
    },

    seed(L, fam) {
      L.state.fill(0);
      if (FAMILIES[fam].banded) {
        L.state[MID] = 1;
      } else {
        for (let i = 0; i <= MID; i++) {
          const v = this.rand() < 0.3 ? 1 : 0;
          L.state[i] = v; L.state[INNER - 1 - i] = v;
        }
      }
      L.bandRow = 0;
      L.band = (L.band || 0) + 1;
      L.shadows.length = 0;
    },

    kickLoom(L, strength) {
      if (!L.active) return;
      L.shadows.push({ s: L.state.slice(), age: 0 });
      if (L.shadows.length > 3) L.shadows.shift();
      const i = Math.floor(this.rand() * (MID + 1));
      L.flips.push(i);
      if (strength > 0.9 && i > 0) L.flips.push(i - 1);
      return i;
    },

    snareLoom(L) {
      const F = FAMILIES[Math.max(0, L.family)];
      L.ruleI = (L.ruleI + 1) % F.rules.length;
      L.rule = F.rules[L.ruleI];
      L.stripe = Math.max(L.stripe, 1);
      if (!F.banded) L.band++;
    },

    // Write row `this.written` on every active loom.
    weave(P) {
      const n = this.written;
      const fam = clamp(Math.round(P.family), 0, FAMILIES.length - 1);
      const count = clamp(1 + 2 * Math.round((P.looms - 1) / 2), 1, LOOM_X.length);
      for (const L of this.looms) {
        const want = L.idx < count;
        if (want && !L.active) {
          L.active = true;
          L.segs.push({ first: n, last: 1e9, off: 0, v: 0 });
          L.family = fam;
          L.rule = FAMILIES[fam].rules[L.ruleI % FAMILIES[fam].rules.length];
          this.seed(L, fam);
        } else if (!want && L.active) {
          L.active = false;
          L.segs[L.segs.length - 1].last = n;
        }
        while (L.segs.length && L.segs[0].last + VIS + 8 - L.segs[0].off < this.head) L.segs.shift();
        if (!L.active) continue;
        if (L.family !== fam) {
          const wasBanded = FAMILIES[Math.max(0, L.family)].banded;
          L.family = fam;
          L.ruleI = L.ruleI % FAMILIES[fam].rules.length;
          L.rule = FAMILIES[fam].rules[L.ruleI];
          if (wasBanded !== FAMILIES[fam].banded) { this.seed(L, fam); L.stripe = 2; }
        }
        this.weaveRow(L, n, P);
        L.dirty = true;
      }
      this.written++;
    },

    weaveRow(L, n, P) {
      const pal = this.pal, buf = this.rowBuf, F = FAMILIES[L.family];
      const put = (i, c, glint) => {
        const o = i * 4;
        buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = glint ? 200 : 255;
      };
      const putM = (i, c, glint) => { put(BORDER + i, c, glint); put(BORDER + INNER - 1 - i, c, glint); };
      // Selvedge: a dark edge, a ground cord and a running tooth.
      const tooth = ((n >> 1) & 1) ? pal.ink : pal.ground;
      put(0, pal.border); put(COLS - 1, pal.border);
      put(1, mix(pal.ground, pal.border, 0.15)); put(COLS - 2, mix(pal.ground, pal.border, 0.15));
      put(2, tooth); put(COLS - 3, tooth);

      if (L.stripe > 0) {
        // A stripe row closes a band: solid stripe dye with a lazy-line tooth.
        L.stripe--;
        for (let i = 0; i <= MID; i++) putM(i, ((i + n) % 6 === 0) ? pal.ground : pal.stripe);
        this.upload(L, n);
        return;
      }

      stepCA(L.state, L.next, L.rule);
      for (const f of L.flips) { L.next[f] = 1; L.next[INNER - 1 - f] = 1; }
      L.flips.length = 0;
      for (const sh of L.shadows) {
        const tmp = new Uint8Array(INNER);
        stepCA(sh.s, tmp, L.rule);
        sh.s = tmp;
        sh.age++;
      }
      while (L.shadows.length && L.shadows[0].age > LIFE) L.shadows.shift();

      const dyes = P.dyes;
      const glintAt = new Set();
      for (let g = 0; g < L.glints; g++) {
        const i = Math.floor(this.rand() * (MID + 1));
        glintAt.add(i);
      }
      L.glints = 0;
      const prev = L.state, next = L.next;
      // Band colours: with Dyes up each band (a Lace band, or the stretch
      // between two snares) takes the next dye, and alternate bands reverse
      // to a dark ground, as runners are banded.
      const bi = L.band % 4;
      let fig = pal.ink, gnd = pal.ground;
      if (dyes > 0.3) fig = [pal.ink, pal.dye2, pal.ink, pal.dye2][bi];
      if (dyes > 0.7 && bi === 1) { gnd = pal.dye2; fig = pal.ground; }
      if (dyes > 0.7 && bi === 3) { gnd = pal.dye3; fig = pal.dye2; }
      const dye3 = bi === 3 && dyes > 0.7 ? pal.ink : pal.dye3;
      for (let i = 0; i <= MID; i++) {
        const on = next[i];
        const l = prev[i === 0 ? INNER - 1 : i - 1], c = prev[i], r = prev[i + 1];
        let age = -1;
        for (let k = L.shadows.length - 1; k >= 0; k--) {
          if (L.shadows[k].s[i] !== on) { age = L.shadows[k].age; break; }
        }
        let col = on ? fig : gnd;
        if (dyes > 0.45 && on && l && r && !c) col = dye3;
        if (age >= 0) {
          // The dye cone: fresh knots in the accent, fading back to the
          // band's own colours before the cone would fill the runner.
          const t = age / LIFE;
          col = on ? mix(pal.accent, col, smooth(0.35, 1, t)) : mix(gnd, pal.accent, 0.25 * (1 - t));
        }
        putM(i, col, on && glintAt.has(i));
      }
      this.upload(L, n);

      // Swap buffers, then keep the pattern alive.
      L.state = next; L.next = prev;
      L.bandRow++;
      let any = 0, same = true;
      for (let i = 0; i < INNER; i++) { any |= L.state[i]; if (L.state[i] !== prev[i]) same = false; }
      L.still = same ? L.still + 1 : 0;
      if (F.banded && L.bandRow >= MID + 1) {
        this.seed(L, L.family);
        L.stripe = 2;
      } else if (!any || (!F.banded && L.family !== 2 && L.still > 20)) {
        this.seed(L, L.family);
      }
    },

    upload(L, n) {
      if (!this.gl) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texs[L.idx]);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, n % RING, COLS, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.rowBuf);
    },

    // ---- Camera -------------------------------------------------------------

    camera(tilt, ctx) {
      const th = (46 - 32 * tilt) * Math.PI / 180;      // pitch below the horizon
      const half = FOV / 2;
      // The beam sits at ndc y = -0.8 whatever the tilt, DIST units away.
      const a2 = th + Math.atan(Math.tan(half) * 0.8);
      this.cam = { th, h: DIST * Math.sin(a2), zBar: DIST * Math.cos(a2), tan: Math.tan(half),
        asp: ctx.width / ctx.height, W: ctx.width, H: ctx.height };
    },

    project(X, Y, Z) {
      const c = this.cam;
      const dy = Y - c.h;
      const yc = dy * Math.cos(c.th) + Z * Math.sin(c.th);
      const zc = dy * Math.sin(c.th) - Z * Math.cos(c.th);
      const w = -zc;
      const nx = X / (c.tan * c.asp) / w, ny = yc / c.tan / w;
      return [c.W / 2 + nx * c.W / 2, c.H / 2 - ny * c.H / 2, (c.H / 2) / (c.tan * w)];
    },

    lift(d, idx, P) {
      const e = this.env;
      const A = P.wave * (1.4 + 2.6 * e.bass);
      const taper = smooth(1, 18, d);
      const ph = d * 0.075 - this.wavePhase + idx * 1.1;
      return A * taper * (0.62 + 0.38 * Math.sin(ph) + 0.12 * Math.sin(ph * 2.3 + 1.0));
    },

    bend(d) {
      const T = this.T;
      const b = 0.75 * Math.sin(T * 0.037 + 1.0) + 0.3 * Math.sin(T * 0.091 + 2.0);
      return b * 22 * (d / 200) * (d / 200);
    },

    // ---- Draw ---------------------------------------------------------------

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.env) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.T += dt;
      const ev = this.listen(signals, dt);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 1.0, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      P.family = follow ? (e.auto > 0.5 ? PRESETS.drop.family : params.family) : params.family;

      const pxs = p.pixelDensity();
      const w = Math.round(p.width * pxs), h = Math.round(p.height * pxs);
      if (!this.gl && !this.glFailed) this.initGL();
      if (this.glFailed) {
        p.background(40, 30, 25);
        p.fill(230, 80, 60); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Rule Runner needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      if (!this.built || this.woolIdx !== Math.round(params.wool)) this.build(params);
      const gl = this.gl;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }

      // Music events land on the looms.
      const push = P.push;
      const act = this.looms.filter((L) => L.active);
      if (ev.kick && push > 0.02) {
        e.thump = 1;
        // The centre loom always takes the kick; in the drop a side loom too.
        const targets = [act[0]];
        if (act.length > 1) targets.push(act[1 + Math.floor(this.rand() * (act.length - 1))]);
        for (const L of targets) {
          const i = this.kickLoom(L, ev.kick * push);
          if (i === undefined) continue;
          const nf = Math.round(3 + 4 * push);
          // The kick is a pick: the shuttle darts across this loom, and the
          // knots it lays pop up off the runner before settling in.
          L.shutDir = -(L.shutDir || 1);
          L.shut = { age: 0, dir: L.shutDir, k: clamp01(0.5 + 0.5 * push) };
          for (const side of [-1, 1]) {
            const X = L.x * (COLS + GAP) + side * (INNER / 2 - i - 0.5);
            this.pops.push({ X, age: 0, delay: 0.22 * (L.shutDir * side > 0 ? 1 - (i + 0.5) / INNER : (i + 0.5) / INNER), k: clamp01(push) });
            for (let f = 0; f < nf; f++) {
              this.fibres.push({ X, Y: 0.4, Z: this.cam ? this.cam.zBar + 0.6 : 20,
                vx: (this.rand() - 0.5) * 5, vy: 3 + this.rand() * 5, vz: 1 + this.rand() * 4,
                age: 0, life: 0.5 + this.rand() * 0.5, L: L.idx, rot: this.rand() * TAU });
            }
          }
        }
      }
      if (ev.snare && push > 0.02 && act.length) {
        const L = act[this.snareTurn++ % act.length];
        this.snareLoom(L);
      }
      if (ev.hat && push > 0.02) {
        for (const L of act) L.glints += Math.round(1 + 2 * ev.hat * push);
      }
      e.thump *= Math.exp(-dt / 0.12);

      // Weave: bass sets the speed, so bass sets the travel.
      const rate = 7 * P.speed * (0.55 + 0.9 * e.bass);
      this.head += rate * dt;
      let guard = 0;
      while (this.written <= this.head && guard++ < 8) this.weave(P);
      if (this.written <= this.head) this.head = this.written - 0.001;
      this.wavePhase += dt * (0.9 + 1.6 * e.bass) * (0.6 + 0.4 * P.speed);
      for (const L of this.looms) {
        L.pres = ease(L.pres, L.active ? 1 : 0, 3, dt);
        if (L.dirty) {
          gl.bindTexture(gl.TEXTURE_2D, this.texs[L.idx]);
          gl.generateMipmap(gl.TEXTURE_2D);
          L.dirty = false;
        }
      }

      this.camera(P.tilt, ctx);
      const cam = this.cam;
      const rowBase = Math.floor(this.head / 4096) * 4096;
      const travel = (this.head % 4096);

      // ---- GL pass
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      const W = this.pWorld;
      gl.useProgram(W.pr);
      gl.uniform1f(W.u.uTh, cam.th); gl.uniform1f(W.u.uH, cam.h);
      gl.uniform1f(W.u.uTan, cam.tan); gl.uniform1f(W.u.uAsp, cam.asp);
      gl.uniform1f(W.u.uTravel, travel);
      gl.uniform1f(W.u.uTime, this.T);
      gl.uniform3fv(W.u.uSkyTop, glc(hex(WORLD.skyTop)));
      gl.uniform3fv(W.u.uSkyHor, glc(hex(WORLD.skyHor)));
      gl.uniform3fv(W.u.uHaze, glc(hex(WORLD.haze)));
      gl.uniform3fv(W.u.uDune, glc(hex(WORLD.dune)));
      gl.uniform3fv(W.u.uSand, glc(hex(WORLD.sand)));
      gl.uniform3fv(W.u.uSandDark, glc(hex(WORLD.sandDark)));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      const aw = gl.getAttribLocation(W.pr, 'aPos');
      gl.enableVertexAttribArray(aw);
      gl.vertexAttribPointer(aw, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(aw);

      const S = this.pStrip;
      gl.useProgram(S.pr);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(S.u.uTh, cam.th); gl.uniform1f(S.u.uH, cam.h);
      gl.uniform1f(S.u.uTan, cam.tan); gl.uniform1f(S.u.uAsp, cam.asp);
      gl.uniform1f(S.u.uHead, this.head - rowBase);
      gl.uniform1f(S.u.uTime, this.T);
      gl.uniform1f(S.u.uGlint, clamp01(0.35 + 0.9 * e.hat));
      gl.uniform3fv(S.u.uHaze, glc(hex(WORLD.haze)));
      gl.uniform3fv(S.u.uWarp, glc(this.pal.warp));
      gl.uniform3fv(S.u.uShadow, glc(hex(WORLD.shadow)));
      gl.uniform1i(S.u.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const aP = gl.getAttribLocation(S.pr, 'aPos'), aA = gl.getAttribLocation(S.pr, 'aAttr');
      gl.enableVertexAttribArray(aP); gl.enableVertexAttribArray(aA);
      gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(aA, 3, gl.FLOAT, false, 24, 12);

      const half = COLS / 2;
      // Rugs on the sand, drawn before any shadow so the runners' fall on them.
      if (this.head > this.nextRug) { this.spawnRug(-12); this.nextRug = this.head + 70 + this.rand() * 70; }
      this.rugs = this.rugs.filter((r) => r.base + this.head < 760);
      gl.uniform1i(S.u.uMode, 1);
      gl.uniform1f(S.u.uM, 0);
      gl.bindTexture(gl.TEXTURE_2D, this.texs[LOOM_X.length]);
      for (const rug of this.rugs) {
        const Zc = rug.base + this.head;
        const ca = Math.cos(rug.ang), sa = Math.sin(rug.ang);
        const V = this.verts;
        let nv = 0;
        const n0 = -FRINGE, n1 = rug.len + FRINGE;
        for (let r = n0; r <= n1 + 1e-6; r += (r < 0 || r >= rug.len ? FRINGE : 1)) {
          const along = r - rug.len / 2;
          const cxr = rug.X + sa * along, czr = Zc + ca * along;
          V[nv++] = cxr - ca * half; V[nv++] = 0.03; V[nv++] = czr + sa * half; V[nv++] = 0; V[nv++] = rug.row0 + r; V[nv++] = 0.97;
          V[nv++] = cxr + ca * half; V[nv++] = 0.03; V[nv++] = czr - sa * half; V[nv++] = 1; V[nv++] = rug.row0 + r; V[nv++] = 0.97;
        }
        gl.uniform1f(S.u.uFirst, rug.row0);
        gl.uniform1f(S.u.uLast, rug.row0 + rug.len);
        gl.uniform1f(S.u.uHead, rug.row0 + rug.len);
        gl.bufferData(gl.ARRAY_BUFFER, V.subarray(0, nv), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, nv / 6);
      }
      gl.uniform1f(S.u.uHead, this.head - rowBase);
      const strips = [];
      for (const L of this.looms) {
        for (const sg of L.segs) {
          // A runner cut from its loom is dragged off towards the horizon,
          // so the breakdown visibly clears instead of leaving it for minutes.
          if (sg.last < 1e9) { sg.v = Math.min(sg.v + dt * 5, 28); sg.off += sg.v * dt; }
          const hi = Math.min(this.head + sg.off, sg.last + FRINGE);
          const lo = Math.max(sg.first - FRINGE, this.head + sg.off - VIS);
          if (hi <= lo) continue;
          strips.push({ L, sg, hi, lo });
        }
      }
      // Two passes: every shadow first, so no runner is darkened by another's.
      for (let pass = 0; pass < 2; pass++) {
        gl.uniform1i(S.u.uMode, pass);
        for (const st of strips) {
          const { L, sg, hi, lo } = st;
          const cx = L.x * (COLS + GAP);
          const m = pass === 0 ? 2.4 / COLS : 0;
          let nv = 0;
          const V = this.verts;
          const pushRow = (rowF) => {
            const d = this.head + sg.off - rowF;
            const Z = cam.zBar + d;
            const lf = this.lift(d, L.idx, P);
            const bx = this.bend(d) + cx;
            let shade, X0, X1, Y, Zs;
            if (pass === 0) {
              X0 = bx - half * (1 + 2 * m) + lf * 0.8; X1 = bx + half * (1 + 2 * m) + lf * 0.8;
              Y = 0.02; Zs = Z + lf * 1.3; shade = lf;
            } else {
              const sl = (this.lift(d + 1, L.idx, P) - this.lift(d - 1, L.idx, P)) / 2;
              shade = clamp(1 + 0.9 * sl, 0.72, 1.22);
              X0 = bx - half; X1 = bx + half; Y = lf + 0.05; Zs = Z;
            }
            const r = rowF - rowBase;
            V[nv++] = X0; V[nv++] = Y; V[nv++] = Zs; V[nv++] = -m; V[nv++] = r; V[nv++] = shade;
            V[nv++] = X1; V[nv++] = Y; V[nv++] = Zs; V[nv++] = 1 + m; V[nv++] = r; V[nv++] = shade;
          };
          // Far to near, so a lifted crest overdraws what lies behind it.
          pushRow(lo);
          for (let r = Math.floor(lo) + 1; r < hi; r++) pushRow(r);
          pushRow(hi);
          gl.uniform1f(S.u.uFirst, sg.first - rowBase);
          gl.uniform1f(S.u.uHead, this.head + sg.off - rowBase);
          gl.uniform1f(S.u.uLast, Math.min(sg.last, 1e7) - rowBase);
          gl.uniform1f(S.u.uM, m);
          gl.bindTexture(gl.TEXTURE_2D, this.texs[L.idx]);
          gl.bufferData(gl.ARRAY_BUFFER, V.subarray(0, nv), gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, nv / 6);
        }
      }
      gl.disableVertexAttribArray(aP); gl.disableVertexAttribArray(aA);

      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
      this.drawLooms(g, dt, P, rate);
      g.restore();
    },

    // Loom beams across the live end of each runner, the warp running from
    // them towards us, and the fibres a kick throws up.
    drawLooms(g, dt, P, rate) {
      const cam = this.cam, e = this.env, pal = this.pal;
      const wood = hex('#7d5233'), woodLite = hex('#b9855a'), woodDark = hex('#3b2416');
      for (const L of this.looms) {
        if (L.pres < 0.02) continue;
        const cx = L.x * (COLS + GAP);
        const hw = COLS / 2 + 1.6;
        const th = (L.active && L.idx === 0 ? e.thump : e.thump * 0.6) * P.push;
        const z = cam.zBar - 0.4 + th * 0.9;
        const slide = (1 - L.pres) * 6;
        // Warp threads: from under the beam, towards the camera.
        g.lineCap = 'round';
        g.strokeStyle = rgba(pal.warp, 0.75 * L.pres);
        for (let k = 0; k <= COLS; k += 2) {
          const X = cx - COLS / 2 + k;
          const a = this.project(X, 0.2, z + 0.4);
          const wob = th * 0.6 * Math.sin(k * 1.7 + this.T * 40);
          const b = this.project(X * 1.0 + wob, 0.2, z - 24);
          g.lineWidth = Math.max(0.5, a[2] * 0.16);
          g.beginPath(); g.moveTo(a[0], a[1] + slide); g.lineTo(b[0], b[1] + slide); g.stroke();
        }
        // Beam shadow on the runner, then the beam as a turned cylinder.
        const s0 = this.project(cx - hw, 0, z + 1.2), s1 = this.project(cx + hw, 0, z + 1.2);
        const t0 = this.project(cx - hw, 3.0, z), t1 = this.project(cx + hw, 3.0, z);
        const b0 = this.project(cx - hw, 0.4, z - 0.6);
        const sg = g.createLinearGradient(0, s0[1] - s0[2] * 1.5, 0, s0[1] + s0[2] * 0.5);
        sg.addColorStop(0, rgba([40, 25, 15], 0));
        sg.addColorStop(0.6, rgba([40, 25, 15], 0.28 * L.pres));
        sg.addColorStop(1, rgba([40, 25, 15], 0));
        g.fillStyle = sg;
        g.fillRect(s0[0], s0[1] - s0[2] * 1.5 + slide, s1[0] - s0[0], s0[2] * 2);
        const top = t0[1] + slide, bot = b0[1] + slide;
        const bg = g.createLinearGradient(0, top, 0, bot);
        bg.addColorStop(0, rgba(mix(woodDark, wood, 0.6), L.pres));
        bg.addColorStop(0.3, rgba(mix(woodLite, [255, 235, 200], th * 0.25), L.pres));
        bg.addColorStop(0.62, rgba(wood, L.pres));
        bg.addColorStop(1, rgba(woodDark, L.pres));
        g.fillStyle = bg;
        const rr = (bot - top) / 2;
        g.beginPath();
        g.moveTo(t0[0] + rr * 0.5, top);
        g.lineTo(t1[0] - rr * 0.5, top);
        g.quadraticCurveTo(t1[0], top, t1[0], top + rr);
        g.quadraticCurveTo(t1[0], bot, t1[0] - rr * 0.5, bot);
        g.lineTo(t0[0] + rr * 0.5, bot);
        g.quadraticCurveTo(t0[0], bot, t0[0], top + rr);
        g.quadraticCurveTo(t0[0], top, t0[0] + rr * 0.5, top);
        g.fill();
        // Grain on the beam.
        g.strokeStyle = rgba(woodDark, 0.25 * L.pres);
        g.lineWidth = 0.6;
        for (let k = 0; k < 4; k++) {
          const y = top + (bot - top) * (0.22 + k * 0.19);
          g.beginPath();
          g.moveTo(t0[0] + rr, y);
          g.bezierCurveTo(t0[0] + (t1[0] - t0[0]) * 0.3, y + 1.2 * Math.sin(k * 3 + L.idx),
            t0[0] + (t1[0] - t0[0]) * 0.7, y - 1.2 * Math.cos(k * 2), t1[0] - rr, y);
          g.stroke();
        }
      }
      // Popped knots: squares of accent wool that jump off the new row and
      // fall back into it as the row slides away from the beam.
      const keepP = [];
      for (const k of this.pops) {
        k.age += dt;
        const t = (k.age - k.delay) / 0.45;
        if (t > 1) continue;
        keepP.push(k);
        if (t < 0) continue;
        const up = Math.sin(Math.PI * Math.min(1, t * 1.3)) * 3.4 * k.k;
        const z = cam.zBar + 0.6 + Math.max(0, k.age - k.delay) * rate;
        const a = this.project(k.X, up + 0.2, z), gnd = this.project(k.X, 0, z);
        const sz = a[2] * (1.2 + 1.4 * (1 - t) * k.k);
        g.fillStyle = rgba([40, 25, 15], 0.3 * (1 - t));
        g.fillRect(gnd[0] - sz * 0.5 + up * a[2] * 0.3, gnd[1] - sz * 0.3, sz, sz * 0.6);
        g.fillStyle = rgba(mix(pal.accent, [255, 240, 220], 0.15 * (1 - t)), 1 - t * t);
        g.fillRect(a[0] - sz / 2, a[1] - sz / 2, sz, sz * 0.85);
        g.fillStyle = rgba([60, 20, 10], 0.25 * (1 - t));
        g.fillRect(a[0] - sz / 2, a[1] + sz * 0.2, sz, sz * 0.15);
      }
      this.pops = keepP;
      // Shuttles, drawn last so they pass over the beams.
      for (const L of this.looms) {
        const S = L.shut;
        if (!S) continue;
        S.age += dt;
        if (S.age > 0.8) { L.shut = null; continue; }
        const cx = L.x * (COLS + GAP);
        const hw = COLS / 2 + 5;
        const u = clamp01(S.age / 0.3);
        const s = u * u * (3 - 2 * u);
        const x0 = cx - S.dir * hw, x1 = cx + S.dir * hw;
        const X = x0 + (x1 - x0) * s;
        const Y = 2.6 + 1.8 * Math.sin(Math.PI * s);
        const z = cam.zBar + 0.9;
        const fade = S.age < 0.3 ? 1 : 1 - (S.age - 0.3) / 0.5;
        const a = this.project(X, Y, z), st = this.project(x0, 0.6, z);
        // The weft it trails, laid across the loom.
        g.strokeStyle = rgba(pal.accent, 0.9 * fade * S.k);
        g.lineWidth = Math.max(0.8, a[2] * 0.3);
        g.beginPath(); g.moveTo(st[0], st[1]);
        g.quadraticCurveTo((st[0] + a[0]) / 2, Math.max(st[1], a[1]) + a[2] * 0.6, a[0], a[1]);
        g.stroke();
        if (S.age > 0.3 + 0.35) continue;
        const L2 = a[2] * 6.5, W2 = a[2] * 1.7;
        const sh = this.project(X + Y * 0.8, 0, z + Y * 1.3);
        g.fillStyle = rgba([40, 25, 15], 0.25 * fade);
        g.beginPath(); g.ellipse(sh[0], sh[1], L2, W2 * 0.6, 0, 0, TAU); g.fill();
        g.save();
        g.translate(a[0], a[1]);
        g.globalAlpha = fade;
        const bg = g.createLinearGradient(0, -W2, 0, W2);
        bg.addColorStop(0, rgba(woodLite, 1)); bg.addColorStop(0.5, rgba(wood, 1)); bg.addColorStop(1, rgba(woodDark, 1));
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(-L2, 0);
        g.quadraticCurveTo(-L2 * 0.5, -W2 * 1.3, 0, -W2);
        g.quadraticCurveTo(L2 * 0.5, -W2 * 1.3, L2, 0);
        g.quadraticCurveTo(L2 * 0.5, W2 * 1.3, 0, W2);
        g.quadraticCurveTo(-L2 * 0.5, W2 * 1.3, -L2, 0);
        g.fill();
        g.fillStyle = rgba(pal.accent, 1);
        g.fillRect(-L2 * 0.35, -W2 * 0.45, L2 * 0.7, W2 * 0.9);
        g.strokeStyle = rgba(mix(pal.accent, [60, 20, 10], 0.4), 0.8);
        g.lineWidth = Math.max(0.4, a[2] * 0.08);
        for (let q = -3; q <= 3; q++) { g.beginPath(); g.moveTo(q * L2 * 0.1, -W2 * 0.45); g.lineTo(q * L2 * 0.1 + L2 * 0.05, W2 * 0.45); g.stroke(); }
        g.restore();
      }
      // Fibres: short curls of accent wool, thrown up by the beam.
      const keep = [];
      g.lineWidth = 1.1;
      for (const f of this.fibres) {
        f.age += dt;
        if (f.age > f.life) continue;
        keep.push(f);
        f.vy -= 9 * dt;
        f.X += f.vx * dt; f.Y = Math.max(0.1, f.Y + f.vy * dt); f.Z += f.vz * dt;
        f.rot += dt * 6;
        const a = this.project(f.X, f.Y, f.Z);
        const k = 1 - f.age / f.life;
        const len = a[2] * 0.9;
        g.strokeStyle = rgba(f.age < 0.25 ? pal.accent : pal.accent2, k * 0.9);
        g.beginPath();
        g.moveTo(a[0] - Math.cos(f.rot) * len, a[1] - Math.sin(f.rot) * len);
        g.quadraticCurveTo(a[0] + Math.sin(f.rot) * len * 0.6, a[1] - Math.cos(f.rot) * len * 0.6,
          a[0] + Math.cos(f.rot) * len, a[1] + Math.sin(f.rot) * len);
        g.stroke();
      }
      this.fibres = keep;
    },
  });
})();
