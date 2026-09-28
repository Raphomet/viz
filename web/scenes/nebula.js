// Nebula — a slow flight down a corridor carved through an emission nebula.
//
// Layers, back to front: a far star field that only turns with the camera; the
// gas, raymarched through a baked 3D noise texture (filaments and billows of
// glowing hydrogen and oxygen, crossed by dark dust lanes that eat the light
// behind them); the young stars embedded in the corridor walls, which ionise
// the gas around them; and dust motes drifting past the lens, sharp at the
// focal distance and opening into soft bokeh discs up close (the depth of
// field).
//
// Craft notes:
// - The gas is rendered into a small canvas (about 0.4x device resolution,
//   capped by pixel count) and upscaled with smoothing: it is soft light, so
//   the upscale costs nothing visible, and everything that must stay crisp
//   (star cores, spikes, motes) is drawn in 2D at full resolution on top.
// - Noise is one 64³ RG8 texture baked once in JS (two octaves of tileable
//   gradient noise per channel) and read at three non-integer scales, so a
//   step is four texel fetches instead of dozens of hash evaluations. Steps
//   grow with distance (40 of them reach ~20 units) and start on a fixed
//   interleaved-gradient offset per pixel: a per-frame jitter would crawl.
// - The corridor is carved along the camera's own path function, which the
//   shader and the JS share, so the flight never pushes through a wall.
// - The kick never touches the whole frame. It ignites one star in view: its
//   light floods only the gas within a unit or so of it, and its diffraction
//   spikes stretch. The snare sends a spherical shock shell out through the
//   gas around a different star. The bass lifts the emission on a slow ease,
//   so its sidechain pump does not blink the frame on every beat.

(function () {
  const NOISE = 64;
  const STEPS = 40;
  const MAX_PIX = 720000;   // gas canvas pixel budget
  const RES = 0.42;         // gas canvas scale at most
  const CELL = 1.7;         // star cell length along the flight path
  const NL = 8;             // lights passed to the shader
  const FOCUS = 4.2;        // focal distance, world units

  // Shared with the shader's path(): the corridor's axis.
  const pathX = (z) => 2.2 * Math.sin(z * 0.11) + 1.1 * Math.sin(z * 0.043 + 1.3);
  const pathY = (z) => 1.3 * Math.sin(z * 0.083 + 0.7) + 0.6 * Math.sin(z * 0.037 + 2.1);

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D nz;
uniform vec2 res;
uniform vec3 ro;
uniform mat3 cam;
uniform float tanF, T, bass, drop, dens, dustK, form, expo;
uniform vec4 L[${NL}];
uniform vec3 Lc[${NL}];
uniform float Lf[${NL}];
uniform vec4 shk[2];
uniform float shkA[2];
uniform vec3 cH, cM, cO, cAcc, cDeep, ahead, cGlow;
out vec4 o;

vec2 path(float z) {
  return vec2(2.2 * sin(z * 0.11) + 1.1 * sin(z * 0.043 + 1.3),
              1.3 * sin(z * 0.083 + 0.7) + 0.6 * sin(z * 0.037 + 2.1));
}

uvec2 hu(vec2 p) {
  uvec2 v = uvec2(ivec2(floor(p)) + 32768) * uvec2(1664525u, 1013904223u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}

void field(vec3 p, out float d, out float de, out float du, out float n) {
  vec3 q = p * 0.075 + vec3(T * 0.004, T * 0.002, 0.0);
  vec2 A = texture(nz, q).rg;
  vec3 w = q + (A.r - 0.5) * 0.2;
  float b = texture(nz, w * 2.31).r;
  float c = texture(nz, w * 5.37 + 0.37).r;
  n = A.r * 0.55 + b * 0.3 + c * 0.15;
  // Ridged noise makes the sheets and filaments; the smooth sum the billows.
  float rg = 1.0 - abs(2.0 * (b * 0.6 + c * 0.4) - 1.0);
  float fil = rg * rg * rg;
  float cloud = smoothstep(0.44, 0.74, n);
  float r = length(p.xy - path(p.z));
  float rad = 1.5 + 1.6 * A.r;
  float carve = smoothstep(rad * 0.6, rad * 1.25, r) * dens;
  // The cloud bodies absorb; mostly their filaments glow. Emission that
  // followed the absorbing density filled the frame with even fog.
  d = cloud * (0.3 + 0.9 * fil) * carve;
  de = cloud * mix(0.02 + 1.9 * fil, 0.12 + 0.5 * n, form) * carve;
  float lane = 1.0 - abs(2.0 * texture(nz, w * 1.63 + 0.61).g - 1.0);
  du = smoothstep(0.8, 0.95, lane) * smoothstep(0.3, 0.55, n) * carve * dustK;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
  vec3 rd = normalize(cam * vec3(uv * tanF, 1.0));
  // Interleaved gradient noise for the start offset: white noise, fixed to
  // the screen while the gas streams past, crawled like sand; this one's
  // crosshatch dissolves in the blur pass.
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float t = 0.12 + 0.08 * jit;
  vec3 acc = vec3(0.0);
  float tr = 1.0;
  for (int i = 0; i < ${STEPS}; i++) {
    float dt = 0.13 + t * 0.08;
    vec3 p = ro + rd * t;
    float d, de, du, n;
    field(p, d, de, du, n);
    // Gas within a couple of units of the lens thins out: it streams past
    // fastest, and at full strength it churned the frame edges so much that
    // the flight alone read as a jolt. It also opens the view down the corridor.
    float nearK = smoothstep(0.8, 3.6, t);
    d *= nearK; de *= nearK; du *= nearK;
    if (d + du > 0.002) {
      vec3 lit = vec3(0.0), fl = vec3(0.0);
      float ion = 0.0;
      for (int k = 0; k < ${NL}; k++) {
        vec3 v = p - L[k].xyz;
        float dd = dot(v, v);
        float a = L[k].w / (1.0 + dd * 0.5);
        ion += a;
        lit += Lc[k] * a;
        fl += Lc[k] * (Lf[k] * exp(-dd * 1.1));
      }
      float sh = 0.0;
      for (int j = 0; j < 2; j++) {
        float e = (length(p - shk[j].xyz) - shk[j].w) / 0.22;
        sh += shkA[j] * exp(-e * e);
      }
      // Oxygen glows teal where the starlight is hard, hydrogen red further out.
      // Through a third colour, not straight across: red and teal are
      // complements, and a straight mix passes through grey.
      float x = clamp(ion * 0.45 + drop * 0.8 - 0.15, 0.0, 1.0) * 2.0;
      vec3 gas = x < 1.0 ? mix(cH, cM, x) : mix(cM, cO, x - 1.0);
      vec3 em = de * (gas * (0.3 + 0.7 * bass + 0.4 * drop) + lit * 0.3) + (de + 0.6 * d + 0.03) * fl * 6.0
              + (de + 0.1 * d + 0.03) * sh * cAcc * 3.0
              + du * lit * vec3(1.0, 0.7, 0.45) * 0.1;
      float sig = d * 1.4 + du * 5.0;
      float at = exp(-sig * dt);
      acc += tr * em * (sig > 1e-4 ? (1.0 - at) / sig : dt);
      tr *= at;
      if (tr < 0.03) break;
    }
    t += dt;
  }
  // A cluster far down the corridor that the flight never reaches: without
  // it the vanishing point was a black hole in the middle of the frame.
  float a = max(0.0, 1.0 - dot(rd, ahead));
  // Whatever the march did not reach is more gas, far off: left empty it read
  // as a hard-edged disc at the end of the corridor.
  vec3 far = mix(cH, cO, clamp(drop * 0.9, 0.0, 1.0)) * (0.1 + 0.12 * bass);
  acc += tr * (far + cDeep + cGlow * (1.4 * exp(-a / 0.0012) + 0.18 * exp(-a / 0.02)));
  vec3 col = 1.0 - exp(-acc * expo);
  col = pow(col, vec3(1.55));
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  // The dither of the march's start offset reads as a crosshatch once
  // upscaled; eight bilinear taps (a diagonal ring at 0.8
  // texel, an axial one at 1.7) make a small soft filter that dissolves it at the gas canvas's own resolution.
  const BLUR = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform vec2 texel;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * texel;
  vec2 k = texel * 0.8, j = texel * 1.7;
  o = 0.16 * (texture(src, uv + vec2(k.x, k.y)) + texture(src, uv + vec2(-k.x, k.y))
            + texture(src, uv + vec2(k.x, -k.y)) + texture(src, uv + vec2(-k.x, -k.y)))
    + 0.09 * (texture(src, uv + vec2(j.x, 0.0)) + texture(src, uv - vec2(j.x, 0.0))
            + texture(src, uv + vec2(0.0, j.y)) + texture(src, uv - vec2(0.0, j.y)));
  // A soft vignette: the corridor walls stream fastest at the frame's edges,
  // and dimming them keeps the eye down the corridor.
  vec2 v = (uv - 0.5) * 2.0;
  o.rgb *= 1.0 - 0.38 * smoothstep(0.35, 1.6, dot(v, v));
}`;

  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };
  // hydrogen, the colour between, oxygen, shock accent, deep background, mote tint
  const PALETTES = [
    { name: 'Hubble', c: ['#ff2448', '#9b3bff', '#18e6cf', '#ffd27a', '#030106', '#bfe6ff'] },
    { name: 'Veil', c: ['#c23cff', '#3f6bff', '#4dff9a', '#fff1a8', '#020208', '#e2d4ff'] },
    { name: 'Ember', c: ['#ff5a14', '#ff2d8a', '#3a7dff', '#ffe08a', '#050103', '#ffe2c4'] },
    { name: 'Pillars', c: ['#ffae2a', '#ff4f7a', '#12c8ff', '#ff6fd0', '#020304', '#fff4d8'] },
  ].map((p) => ({ name: p.name, hex: p.c, c: p.c.map(lin) }));

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const h11 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // Seeded PRNG for the baked noise, so the nebula is the same on every load.
  function mulberry(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tileable 3D gradient noise, period P lattice cells across N texels.
  function gradNoise(N, P, rnd) {
    const g = new Float32Array(P * P * P * 3);
    for (let i = 0; i < P * P * P; i++) {
      let x, y, z, l;
      do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01);
      l = Math.sqrt(l); g[i * 3] = x / l; g[i * 3 + 1] = y / l; g[i * 3 + 2] = z / l;
    }
    const out = new Float32Array(N * N * N);
    const s = P / N;
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    let o = 0;
    for (let k = 0; k < N; k++) {
      const fz = k * s, iz = Math.floor(fz), tz = fz - iz, wz = fade(tz);
      for (let j = 0; j < N; j++) {
        const fy = j * s, iy = Math.floor(fy), ty = fy - iy, wy = fade(ty);
        for (let i = 0; i < N; i++, o++) {
          const fx = i * s, ix = Math.floor(fx), tx = fx - ix, wx = fade(tx);
          let acc = 0;
          for (let c = 0; c < 8; c++) {
            const dx = c & 1, dy = (c >> 1) & 1, dz = c >> 2;
            const gi = (((ix + dx) % P) + ((iy + dy) % P) * P + ((iz + dz) % P) * P * P) * 3;
            const v = g[gi] * (tx - dx) + g[gi + 1] * (ty - dy) + g[gi + 2] * (tz - dz);
            acc += v * (dx ? wx : 1 - wx) * (dy ? wy : 1 - wy) * (dz ? wz : 1 - wz);
          }
          out[o] = acc;
        }
      }
    }
    return out;
  }

  function bakeNoise() {
    const N = NOISE, rnd = mulberry(90210);
    const chans = [[8, 16], [4, 8]].map(([a, b]) => {
      const n1 = gradNoise(N, a, rnd), n2 = gradNoise(N, b, rnd);
      const v = new Float32Array(N * N * N);
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < v.length; i++) {
        v[i] = n1[i] * 0.68 + n2[i] * 0.32;
        if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i];
      }
      for (let i = 0; i < v.length; i++) v[i] = (v[i] - lo) / (hi - lo);
      return v;
    });
    const data = new Uint8Array(N * N * N * 2);
    for (let i = 0; i < N * N * N; i++) {
      data[i * 2] = Math.round(chans[0][i] * 255);
      data[i * 2 + 1] = Math.round(chans[1][i] * 255);
    }
    return data;
  }

  // A star in the corridor wall, one chance per cell along the path.
  function starOf(c) {
    const h = h11(c * 1.7 + 3);
    if (h < 0.15) return null;
    const ang = h11(c * 3.1 + 9) * Math.PI * 2;
    const r = 1.7 + 1.9 * h11(c * 5.3 + 1);
    const z = c * CELL + h11(c * 7.9 + 4) * CELL * 0.8;
    const hot = h11(c * 2.3 + 8) < 0.72;
    return {
      id: c,
      x: pathX(z) + r * Math.cos(ang), y: pathY(z) + r * Math.sin(ang), z,
      w: 0.35 + 1.0 * Math.pow(h11(c * 4.4 + 2), 2),
      col: hot ? [0.7, 0.85, 1.0] : [1.0, 0.78, 0.5],
    };
  }

  VIZ.register({
    id: 'nebula',
    name: 'Nebula',
    order: 308,

    params: [
      { key: 'palette', label: 'Gas', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'dens', label: 'Gas density', type: 'range', min: 0.3, max: 2.5, default: 1, step: 0.01 },
      { key: 'form', label: 'Filaments ↔ billows', type: 'range', min: 0, max: 1, default: 0.25, step: 0.01 },
      { key: 'dust', label: 'Dust lanes', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'dof', label: 'Depth of field', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'bank', label: 'Banking', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Nebula',
      technique: 'WebGL2 volumetric raymarch (40 growing steps, emission-absorption, analytic per-step integration) through a baked 64³ tileable gradient-noise texture, rendered at ~0.4x and upscaled; embedded point lights ionise the gas; Canvas 2D on top for star cores with diffraction spikes, a far star field and depth-of-field bokeh motes',
      brief: 'A slow flight down a corridor carved through an emission nebula, banking through the turns: walls of red hydrogen filaments turning teal where young stars ionise them, crossed by dark dust lanes, with dust motes drifting past the lens as out-of-focus bokeh. Each kick ignites one star in view: its gas floods with white-blue light and its diffraction spikes stretch, then settle, in one place only. Each snare or clap sends a gold shock shell rippling out through the gas around another star. The bass lifts the glow on a slow ease; hats make the motes and far stars glint. The drop speeds the flight up (motes become streaks) and shifts the gas from hydrogen red to oxygen teal; the breakdown slows to a drift and falls back to red.',
      lineage: [
        'Brief 08 (batch 03): volumetric flight through a nebula; kicks ignite a single star, the snare a shock front in one region, the drop accelerates and shifts red to teal.',
        'Built on Aurora\'s pattern (batch 02): onsets detected in JS against slow baselines and handed to the shader as localised events, never as global gain.',
        'v1: one-pass raymarch at 0.42x. Milky: the gas filled every pixel, emission followed the absorbing density so the whole frame was an even pink fog, and the interleaved-gradient start offset showed as a diagonal halftone once upscaled. Red to teal lerped through grey in the transition.',
        'v2: a second pass blurs the gas at its own resolution before upscaling; gas colour now travels hydrogen red -> a violet midpoint -> oxygen teal, so the drop transition stays saturated.',
        'v3: split density into what absorbs (cloud bodies) and what glows (mostly the ridged filaments), wider corridor, contrast curve. Now light on dark with dust silhouettes. Jolt showed the kick invisible: the flare was faint and often picked stars off screen.',
        'v4: star cores and diffraction spikes brighter; the ignition adds a wide bloom and floods gas within ~1 unit of the star; more stars (cell 1.7) and a tiered search that prefers stars 3.5-9 units away inside the frame, so the ignition is a similar size on every beat. Jolt heat: one hot spot per kick.',
        'v5: the vanishing point was a black hole where the march ran out: marched further (40 steps to ~30 units), filled the remainder with far gas, and put a distant cluster (shader glow plus a knot of sharp 2D stars) at the end of the corridor. Vignette and a fade of gas within ~3 units of the lens, since the walls streaming past the frame edges were most of the measured motion.',
        'Jolt (640x360, seed 1): drop kickArea ~0.35, ratio ~1.35, verdict calm, but driftArea alone is ~0.27: the flight moves a quarter of the frame every 0.15 s with or without a kick. The kick\'s own hot spot is ~5-8% of the frame. Drop flight speed was cut from +1.5 to +0.65 units/s to bring drift down; slowing further would cost the sense of travel.',
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
      this.camZ = 0;
      this.speed = 0.5;
      this.roll = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.flares = new Map();
      this.shocks = [];
      this.recent = [];
      this.motes = null;
      this.far = null;
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
      for (const n of ['nz', 'res', 'ro', 'cam', 'tanF', 'T', 'bass', 'drop', 'dens', 'dustK', 'form', 'expo',
        'L', 'Lc', 'Lf', 'shk', 'shkA', 'cH', 'cM', 'cO', 'cAcc', 'cDeep', 'ahead', 'cGlow']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, NOISE, NOISE, NOISE, 0, gl.RG, gl.UNSIGNED_BYTE, bakeNoise());
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
        gl.texParameteri(gl.TEXTURE_3D, wrap, gl.REPEAT);
      }
      gl.uniform1i(u.nz, 0);
      const bprog = gl.createProgram();
      gl.attachShader(bprog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(bprog, compile(gl.FRAGMENT_SHADER, BLUR));
      gl.bindAttribLocation(bprog, loc, 'pos');
      gl.linkProgram(bprog);
      if (!gl.getProgramParameter(bprog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(bprog));
      gl.useProgram(bprog);
      this.ub = { src: gl.getUniformLocation(bprog, 'src'), texel: gl.getUniformLocation(bprog, 'texel') };
      gl.uniform1i(this.ub.src, 1);
      this.rt = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.rt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      this.fbo = gl.createFramebuffer();
      this.rtW = 0; this.rtH = 0;
      this.prog = prog; this.bprog = bprog;
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Onsets against slow baselines, as in Aurora: a pad or riser that lifts
    // a whole band does not read as a hit; only a jump does.
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kickHit = false, snareHit = false;
      // Kick: band 0 leading band 1, which rejects the bass line's notes.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kickHit = true; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.6, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snareHit = true; }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw, e.snare * Math.exp(-dt / 0.16));

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      // Slow ease: the bass line is sidechained to the kick, and a fast
      // follower would blink the whole cloud on every beat.
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 1.1, dt);
      return { kickHit, kRaw, snareHit, sRaw };
    },

    // Camera frame at path distance z: position, basis, with banking roll.
    frame(z, roll) {
      const px = pathX(z), py = pathY(z);
      const la = 2.5;
      let fx = pathX(z + la) - px, fy = pathY(z + la) - py, fz = la;
      let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
      // right = up0 x f with up0 = (0,1,0) -> (fz, 0, -fx)
      let rx = fz, ry = 0, rz = -fx;
      l = Math.hypot(rx, ry, rz); rx /= l; ry /= l; rz /= l;
      // up = f x right
      let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
      const c = Math.cos(roll), s = Math.sin(roll);
      const R = [rx * c + ux * s, ry * c + uy * s, rz * c + uz * s];
      const U = [ux * c - rx * s, uy * c - ry * s, uz * c - rz * s];
      return { pos: [px, py, z], R, U, F: [fx, fy, fz] };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const e = this.env;
      const hit = this.listen(signals, dt);
      const pal = PALETTES[(params.palette | 0) % PALETTES.length];

      // Flight: the music sets the speed on a ~1.5 s ease, never a jerk.
      const cruise = params.speed * (0.45 + 0.3 * e.bass * push + 0.65 * e.drop);
      this.speed = ease(this.speed, cruise, 0.6, dt);
      this.camZ += this.speed * dt;
      this.T += dt * (0.6 + 0.8 * e.drop);
      this.tw += dt;
      // Bank into the turns: roll follows the path's lateral curvature.
      const z = this.camZ;
      const ax = pathX(z + 3) - 2 * pathX(z) + pathX(z - 3);
      const targetRoll = params.bank * (-ax * 0.9 + 0.12 * Math.sin(this.tw * 0.05));
      this.roll = ease(this.roll, targetRoll, 0.5, dt);
      const F = this.frame(z, this.roll);
      const tanF = 0.68;
      const halfW = ctx.width / 2, halfH = ctx.height / 2;
      const proj = (x, y, zz) => {
        const dx = x - F.pos[0], dy = y - F.pos[1], dz = zz - F.pos[2];
        const cz = dx * F.F[0] + dy * F.F[1] + dz * F.F[2];
        if (cz < 0.05) return null;
        const cx = dx * F.R[0] + dy * F.R[1] + dz * F.R[2];
        const cy = dx * F.U[0] + dy * F.U[1] + dz * F.U[2];
        return { x: halfW + (cx / cz) * 300 / tanF, y: halfH - (cy / cz) * 300 / tanF, z: cz };
      };

      // Stars in the corridor walls near the camera.
      const stars = [];
      const c0 = Math.floor((z - 1.5) / CELL), c1 = Math.floor((z + 17) / CELL);
      for (let c = c0; c <= c1 && stars.length < NL; c++) {
        const S = starOf(c);
        if (!S) continue;
        const dz = S.z - z;
        if (dz < -1.2 || dz > 17) continue;
        S.fade = clamp01((17 - dz) / 4) * clamp01((dz + 1.2) / 1.2);
        S.flare = this.flares.get(c) || 0;
        stars.push(S);
      }
      for (const [k, v] of this.flares) {
        const nv = v * Math.exp(-dt / 0.42);
        if (nv < 0.01) this.flares.delete(k); else this.flares.set(k, nv);
      }

      // Kick: ignite one star in view, not one of the last two.
      // Prefer a mid-distance star well inside the frame; widen the search
      // rather than let a beat pass with nothing lit.
      const pick = (exclude) => {
        const tiers = [[3.5, 9, 0.8, true], [2.5, 13, 0.92, true], [1.5, 16, 0.95, false]];
        for (const [zn, zf, m, ex] of tiers) {
          const cand = [];
          for (const S of stars) {
            const q = proj(S.x, S.y, S.z);
            if (!q || q.z < zn || q.z > zf) continue;
            if (Math.abs(q.x - halfW) > halfW * m || Math.abs(q.y - halfH) > halfH * m) continue;
            if (ex && exclude.includes(S.id)) continue;
            cand.push(S);
          }
          if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
        }
        return null;
      };
      if (hit.kickHit) {
        const S = pick(this.recent);
        if (S) {
          this.flares.set(S.id, Math.min(1.5, (this.flares.get(S.id) || 0) + hit.kRaw * push));
          this.recent.unshift(S.id); this.recent.length = Math.min(this.recent.length, 2);
        }
      }
      if (hit.snareHit) {
        const S = pick(this.recent.slice(0, 1));
        if (S) {
          this.shocks.unshift({ x: S.x, y: S.y, z: S.z, age: 0, amp: (0.6 + 0.4 * hit.sRaw) * Math.min(1.5, push) });
          this.shocks.length = Math.min(this.shocks.length, 2);
        }
      }
      for (const K of this.shocks) K.age += dt;
      this.shocks = this.shocks.filter((K) => K.age < 1.4);

      // ---- gas
      const W = p.width * p.pixelDensity(), H = p.height * p.pixelDensity();
      const sc = Math.min(RES, Math.sqrt(MAX_PIX / (W * H)));
      const w = Math.max(16, Math.round(W * sc)), h = Math.max(16, Math.round(H * sc));
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Nebula needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      if (this.rtW !== w || this.rtH !== h) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.rt);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.rt, 0);
        this.rtW = w; this.rtH = h;
      }
      gl.useProgram(this.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform3f(u.ro, F.pos[0], F.pos[1], F.pos[2]);
      gl.uniformMatrix3fv(u.cam, false, new Float32Array([...F.R, ...F.U, ...F.F]));
      gl.uniform1f(u.tanF, tanF);
      gl.uniform1f(u.T, this.T % 2000);
      gl.uniform1f(u.bass, e.bass * push);
      gl.uniform1f(u.drop, e.drop);
      gl.uniform1f(u.dens, params.dens);
      gl.uniform1f(u.dustK, params.dust);
      gl.uniform1f(u.form, params.form);
      gl.uniform1f(u.expo, 1.9);
      {
        const za = z + 45;
        let ax2 = pathX(za) - F.pos[0], ay2 = pathY(za) - F.pos[1], az2 = za - z;
        const l2 = Math.hypot(ax2, ay2, az2);
        gl.uniform3f(u.ahead, ax2 / l2, ay2 / l2, az2 / l2);
        const g = pal.c[1], k = 0.6 + 0.4 * e.bass * push;
        gl.uniform3f(u.cGlow, (g[0] * 0.35 + 0.65) * k, (g[1] * 0.35 + 0.62) * k, (g[2] * 0.35 + 0.7) * k);
        this.ahead = [ax2 / l2, ay2 / l2, az2 / l2];
      }
      const Lv = new Float32Array(NL * 4), Lc = new Float32Array(NL * 3), Lf = new Float32Array(NL);
      stars.forEach((S, i) => {
        Lv.set([S.x, S.y, S.z, S.w * S.fade * (1 + 0.3 * e.drop)], i * 4);
        Lc.set(S.col, i * 3);
        Lf[i] = S.flare * S.fade;
      });
      gl.uniform4fv(u.L, Lv);
      gl.uniform3fv(u.Lc, Lc);
      gl.uniform1fv(u.Lf, Lf);
      const Sv = new Float32Array(8), Sa = new Float32Array(2);
      this.shocks.forEach((K, i) => {
        Sv.set([K.x, K.y, K.z, 0.25 + K.age * 2.6], i * 4);
        const f = 1 - K.age / 1.4;
        Sa[i] = K.amp * f * f * Math.min(1, K.age / 0.04);
      });
      gl.uniform4fv(u.shk, Sv);
      gl.uniform1fv(u.shkA, Sa);
      gl.uniform3fv(u.cH, pal.c[0]);
      gl.uniform3fv(u.cM, pal.c[1]);
      gl.uniform3fv(u.cO, pal.c[2]);
      gl.uniform3fv(u.cAcc, pal.c[3]);
      gl.uniform3fv(u.cDeep, pal.c[4]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(this.bprog);
      gl.uniform2f(this.ub.texel, 1 / w, 1 / h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const g2 = p.drawingContext;
      g2.save();
      g2.globalAlpha = 1;
      g2.globalCompositeOperation = 'source-over';
      g2.imageSmoothingEnabled = true;
      g2.imageSmoothingQuality = 'high';
      g2.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
      g2.globalCompositeOperation = 'lighter';
      this.drawFar(g2, F, proj, halfW, halfH, tanF, e, push);
      this.drawStars(g2, stars, proj, e, push);
      this.drawMotes(g2, F, proj, dt, e, params, pal);
      g2.restore();
    },

    // Far stars: directions only, so they turn with the camera but never
    // parallax. Hats re-deal which of them glint.
    drawFar(g2, F, proj, halfW, halfH, tanF, e, push) {
      if (!this.far) {
        this.far = [];
        for (let i = 0; i < 420; i++) {
          const zz = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - zz * zz);
          this.far.push({ d: [r * Math.cos(a), r * Math.sin(a), zz], m: Math.pow(Math.random(), 3), h: Math.random() });
        }
      }
      const k = 300 / tanF;
      for (const s of this.far) {
        const d = s.d;
        const cz = d[0] * F.F[0] + d[1] * F.F[1] + d[2] * F.F[2];
        if (cz < 0.2) continue;
        const x = halfW + ((d[0] * F.R[0] + d[1] * F.R[1] + d[2] * F.R[2]) / cz) * k;
        const y = halfH - ((d[0] * F.U[0] + d[1] * F.U[1] + d[2] * F.U[2]) / cz) * k;
        if (x < -4 || y < -4 || x > 2 * halfW + 4 || y > 2 * halfH + 4) continue;
        const glint = h11(s.h * 91 + this.hatSeed * 7.3) > 0.8 ? e.hat * push : 0;
        const a = 0.12 + 0.5 * s.m + 0.8 * glint;
        const r = 0.5 + 0.9 * s.m + 0.8 * glint;
        g2.fillStyle = `rgba(210,225,255,${Math.min(1, a).toFixed(3)})`;
        g2.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // The cluster at the end of the corridor: a knot of sharp stars around
      // the glow the shader puts there, so the vanishing point has detail.
      if (!this.cluster) {
        this.cluster = [];
        for (let i = 0; i < 46; i++) {
          const a = Math.random() * Math.PI * 2, r = 0.075 * Math.pow(Math.random(), 1.7);
          this.cluster.push({ ox: r * Math.cos(a), oy: r * Math.sin(a), m: Math.pow(Math.random(), 2.5), h: Math.random() });
        }
      }
      const A = this.ahead;
      if (!A) return;
      // A tangent frame around the cluster's direction.
      let t1 = [A[2], 0, -A[0]];
      const l1 = Math.hypot(t1[0], t1[2]) || 1; t1 = [t1[0] / l1, 0, t1[2] / l1];
      const t2 = [A[1] * t1[2] - A[2] * t1[1], A[2] * t1[0] - A[0] * t1[2], A[0] * t1[1] - A[1] * t1[0]];
      for (const s of this.cluster) {
        const d = [A[0] + s.ox * t1[0] + s.oy * t2[0], A[1] + s.ox * t1[1] + s.oy * t2[1], A[2] + s.ox * t1[2] + s.oy * t2[2]];
        const cz = d[0] * F.F[0] + d[1] * F.F[1] + d[2] * F.F[2];
        if (cz < 0.2) continue;
        const x = halfW + ((d[0] * F.R[0] + d[1] * F.R[1] + d[2] * F.R[2]) / cz) * k;
        const y = halfH - ((d[0] * F.U[0] + d[1] * F.U[1] + d[2] * F.U[2]) / cz) * k;
        const tw = 0.75 + 0.25 * Math.sin(this.tw * (1.3 + 2 * s.h) + s.h * 40);
        const glint = h11(s.h * 53 + this.hatSeed * 5.1) > 0.7 ? e.hat * push : 0;
        const a = (0.3 + 0.7 * s.m) * tw + glint;
        const r = 0.6 + 1.1 * s.m + glint;
        g2.fillStyle = `rgba(235,240,255,${Math.min(1, a).toFixed(3)})`;
        g2.beginPath(); g2.arc(x, y, r, 0, Math.PI * 2); g2.fill();
      }
    },

    sprite(kind) {
      this.sprites = this.sprites || {};
      if (this.sprites[kind]) return this.sprites[kind];
      const S = 128, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      if (kind === 'glow') {
        const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.08, 'rgba(255,255,255,0.8)');
        gr.addColorStop(0.25, 'rgba(255,255,255,0.18)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
      } else if (kind === 'bokeh') {
        // A lens disc: nearly flat, a little brighter at the rim.
        const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)');
        gr.addColorStop(0.78, 'rgba(255,255,255,0.7)');
        gr.addColorStop(0.9, 'rgba(255,255,255,0.9)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
      } else {
        // Diffraction spikes: four thin rays fading out from the centre.
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const gr = g.createLinearGradient(S / 2 - dx * S / 2, S / 2 - dy * S / 2, S / 2 + dx * S / 2, S / 2 + dy * S / 2);
          gr.addColorStop(0, 'rgba(255,255,255,0)');
          gr.addColorStop(0.5, 'rgba(255,255,255,1)');
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr;
          if (dx) g.fillRect(0, S / 2 - 0.8, S, 1.6); else g.fillRect(S / 2 - 0.8, 0, 1.6, S);
        }
      }
      this.sprites[kind] = c;
      return c;
    },

    // The embedded stars' cores, sharp at full resolution. The ignited one
    // blooms and its spikes stretch: the kick's only place in the frame.
    drawStars(g2, stars, proj, e, push) {
      const glow = this.sprite('glow'), spk = this.sprite('spikes');
      for (const S of stars) {
        const q = proj(S.x, S.y, S.z);
        if (!q || q.z < 0.4) continue;
        const f = S.flare;
        const b = S.w * S.fade * Math.min(1, 2.5 / q.z + 0.35);
        const col = S.col;
        const r = (12 + 20 * S.w) / Math.sqrt(q.z) * (1 + 2.2 * f);
        g2.globalAlpha = Math.min(1, 0.7 * b + 0.8 * f);
        g2.drawImage(glow, q.x - r, q.y - r, r * 2, r * 2);
        if (f > 0.02) {
          // The ignition: a second, wider bloom in the star's own colour.
          const R2 = r * 2.4;
          g2.globalAlpha = Math.min(1, 0.55 * f);
          g2.drawImage(glow, q.x - R2, q.y - R2, R2 * 2, R2 * 2);
        }
        const L = (18 + 34 * S.w) / Math.sqrt(q.z) * (1 + 3 * f);
        g2.globalAlpha = Math.min(1, 0.5 * b + 0.9 * f);
        g2.drawImage(spk, q.x - L, q.y - L, L * 2, L * 2);
        g2.globalAlpha = 1;
        const cr = (1.1 + 1.0 * S.w) * (1 + 0.6 * f);
        g2.fillStyle = `rgba(${(200 + 55 * col[0]) | 0},${(200 + 55 * col[1]) | 0},255,${Math.min(1, 0.6 + b).toFixed(3)})`;
        g2.beginPath(); g2.arc(q.x, q.y, cr, 0, Math.PI * 2); g2.fill();
      }
      g2.globalAlpha = 1;
    },

    // Dust motes flying past the lens. Depth of field: in focus at FOCUS,
    // opening into bokeh discs up close; the drop stretches them into streaks.
    drawMotes(g2, F, proj, dt, e, params, pal) {
      const N = 170;
      const spawn = (m, far) => {
        const zc = far ? 9 + Math.random() * 6 : 0.4 + Math.random() * 14;
        const a = Math.random() * Math.PI * 2, r = (0.15 + Math.random() * 1.1) * zc * 0.75;
        const R = F.R, U = F.U, Fw = F.F;
        const cx = r * Math.cos(a), cy = r * Math.sin(a) * 0.7;
        m.x = F.pos[0] + R[0] * cx + U[0] * cy + Fw[0] * zc;
        m.y = F.pos[1] + R[1] * cx + U[1] * cy + Fw[1] * zc;
        m.z = F.pos[2] + R[2] * cx + U[2] * cy + Fw[2] * zc;
        m.h = Math.random(); m.px = null;
        m.warm = Math.random() < 0.35;
      };
      if (!this.motes) {
        this.motes = [];
        for (let i = 0; i < N; i++) { const m = {}; spawn(m, false); this.motes.push(m); }
      }
      const bokeh = this.sprite('bokeh');
      const tint = pal.hex[5];
      const warm = pal.hex[3];
      const dofK = 36 * params.dof;
      const streak = 0.4 + 2.2 * e.drop;
      g2.lineCap = 'round';
      for (const m of this.motes) {
        const q = proj(m.x, m.y, m.z);
        if (!q || q.z < 0.35 || q.z > 16) { spawn(m, true); continue; }
        const coc = dofK * Math.abs(1 / q.z - 1 / FOCUS);
        const glint = h11(m.h * 57 + this.hatSeed * 3.1) > 0.82 ? e.hat * params.push : 0;
        const near = Math.min(1, 1.6 / q.z);
        const base = 0.25 + 0.5 * near;
        g2.fillStyle = m.warm ? warm : tint;
        g2.strokeStyle = m.warm ? warm : tint;
        if (coc > 2.2) {
          const r = coc;
          g2.globalAlpha = Math.min(0.5, (base * 9) / (r * r) + 0.03) * (1 + glint);
          g2.drawImage(bokeh, q.x - r, q.y - r, r * 2, r * 2);
        } else {
          const r = 0.6 + 0.8 * near + 1.2 * glint;
          g2.globalAlpha = Math.min(1, base + glint);
          if (m.px !== null && streak > 0.5) {
            const sx = (q.x - m.px) * streak * 6, sy = (q.y - m.py) * streak * 6;
            g2.lineWidth = r * 1.4;
            g2.beginPath(); g2.moveTo(q.x - sx, q.y - sy); g2.lineTo(q.x, q.y); g2.stroke();
          } else {
            g2.beginPath(); g2.arc(q.x, q.y, r, 0, Math.PI * 2); g2.fill();
          }
        }
        m.px = q.x; m.py = q.y;
      }
      g2.globalAlpha = 1;
    },
  });
})();
