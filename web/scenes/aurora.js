// Aurora — northern lights over a still mountain lake.
//
// Layers, back to front: a slowly wheeling star field, two or three aurora
// curtains, three silhouetted ranges with parallax (a far snow ridge, a mid
// range, a pine treeline on the far shore), mist on the water, and the lake,
// which is the same sky evaluated at the mirrored point after the water's
// ripples have displaced it. Because the lake re-uses the sky, every musical
// event above the horizon lands twice: once in the sky and once, broken up by
// the water, in the reflection.
//
// Craft notes:
// - The curtains are ribbons seen side on. Each one's position along the
//   ribbon is a warp of screen x; where the warp's slope falls toward zero the
//   ribbon is folding back on itself, so the eye looks along more of it and it
//   brightens (brightness ∝ 1 / |dw/dx|). That one term is what makes the
//   folds read as folds rather than as a noise texture.
// - Everything that depends only on x (each curtain's lower edge, fold
//   brightness, rays and kick pulses; the three ridge lines) is computed once
//   per column in JS into a small float texture. The first version evaluated
//   that noise per pixel and cost ~4x the WebGL budget; the shader now does a
//   handful of texel fetches, stars, and the water.
// - The music is detected as onsets in JS against slow baselines and handed
//   over as travelling things: pulses racing along the curtains and rings on
//   the water for kicks, shooting stars for snares, a re-dealt set of glinting
//   stars and water sparks for hats. Events travel instead of flashing the
//   frame, so a kick is unmistakable without a full-screen strobe.
// - Light is accumulated in linear and tone-mapped (1 - e^-x), so a pulse over
//   an already bright fold blooms instead of clipping to flat white.

(function () {
  const ROWS = 5;          // texture rows: 3 curtains, terrain, extras
  const TEX_STEP = 0.75;   // virtual units per texel
  const HZ = -95;          // horizon, virtual units from centre, y up
  // The GL layer renders at this fraction of device resolution and is
  // upscaled: the imagery is soft light, and full resolution cost ~2.5x the
  // harness's WebGL budget on SwiftShader.
  const RES = 0.65;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D cols;   // per-column data, see ROWS
uniform vec2  texX;       // x of texel 0's centre, 1 / span
uniform vec2  res;
uniform float unitPx;
uniform float tw;
uniform float camX;
uniform float starAng;
uniform float hz;
uniform float bass, kick, snare, hat, hatSeed, drop;
uniform float starK, waterK, halfW;
uniform vec3  cLow, cMid, cTop, cDropTop, cAccent, aLight;
uniform vec4  rip[4];     // lake X, lake Z, age s, amp
uniform vec4  met[3];     // start x, y, angle, age
uniform float metA[3];
out vec4 outColor;

// Integer hashes: sin-based ones cost several times more on SwiftShader.
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
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}

vec4 col4(float x, float row) {
  return texture(cols, vec2((x - texX.x) * texX.y, (row + 0.5) / 5.0));
}

// One curtain at this pixel: C = (lower edge y, intensity, rays, height).
vec3 curtain(vec2 q, vec4 C, float pulse, vec3 top) {
  float d = q.y - C.x;
  if (C.y <= 0.001 || d < -40.0 || d > C.w * 4.0) return vec3(0.0);
  float H = C.w;
  float body = smoothstep(-5.0, 4.0, d) * exp(-max(d, 0.0) / H);
  float upper = smoothstep(0.0, H, d) * exp(-max(d, 0.0) / (H * 2.2)) * 0.22;
  float edge = exp(-abs(d - 3.0) / 5.0);
  float below = exp(-max(-d, 0.0) / 9.0) * 0.1 * step(d, 0.0);
  // Rays thin and fade with height, as the real ones do.
  float I = ((body + upper) * (0.15 + C.z) + edge * (0.4 + C.z) * 1.1 + below) * C.y;
  float hy = clamp(d / (H * 1.5), 0.0, 1.0);
  vec3 col = mix(cLow, cMid, smoothstep(0.03, 0.4, hy));
  col = mix(col, top, smoothstep(0.3, 1.0, hy));
  // Snare: the curtain flips toward the accent, strongest in its crown.
  col = mix(col, cAccent, clamp(snare * (0.3 + 0.7 * hy), 0.0, 0.85));
  // A kick pulse runs hot and nearly white along the lower edge.
  col += vec3(0.5, 0.65, 0.6) * pulse * edge;
  return col * I;
}

vec3 stars(vec2 q, float alt) {
  vec2 pole = vec2(-halfW * 0.7, 430.0);
  vec2 v = q - pole;
  float c = cos(starAng), s = sin(starAng);
  vec2 r = vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  vec3 acc = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float cs = l == 0 ? 30.0 : 13.0;
    vec2 gr = r / cs;
    vec2 id = floor(gr) + float(l) * 91.0;
    float h = h21(id);
    if (h < (l == 0 ? 0.5 : 0.72)) continue;
    vec2 sp = 0.15 + 0.7 * h22(id + 5.0);
    float dpx = length(fract(gr) - sp) * cs * unitPx;
    float mag = pow(fract(h * 13.7), l == 0 ? 4.0 : 9.0);
    float twk = 0.7 + 0.3 * sin(tw * (1.5 + 3.0 * h) + h * 60.0);
    // Hats: each hat re-deals which stars glint.
    float glint = step(0.72, h21(id + vec2(hatSeed * 17.0, hatSeed * 5.0))) * hat;
    float b = (0.07 + 1.5 * mag) * twk + glint * (0.9 + 2.0 * mag);
    float sz = 0.7 + 0.8 * mag + glint * 1.0;
    vec3 tint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.86, 0.7), fract(h * 71.3));
    acc += tint * exp(-dpx * dpx / (sz * sz)) * b;
  }
  return acc * starK * smoothstep(0.0, 80.0, alt);
}

vec3 meteors(vec2 q) {
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    if (metA[j] <= 0.0) continue;
    vec4 M = met[j];
    vec2 dir = vec2(cos(M.z), sin(M.z));
    float age = M.w;
    vec2 head = M.xy + dir * 700.0 * age;
    float L = min(700.0 * age, 210.0);
    vec2 v = q - head;
    float along = -dot(v, dir);
    if (along < -10.0 || along > L + 10.0) continue;
    float perp = abs(v.x * dir.y - v.y * dir.x) * unitPx;
    float t = clamp(1.0 - along / L, 0.0, 1.0);
    float line = exp(-perp * perp / 1.4) + 0.3 * exp(-perp * perp / 25.0);
    float fade = smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.35, 0.75, age));
    float hd = length(v) * unitPx;
    acc += (vec3(0.8, 0.93, 1.0) * line * t * t * 1.8 + vec3(1.0, 0.97, 0.9) * exp(-hd * hd / 12.0) * 4.0) * fade * metA[j];
  }
  return acc;
}

// Everything above the water line.
vec3 scene(vec2 q) {
  float alt = q.y - hz;
  vec4 Tr = col4(q.x, 3.0);   // pulse, treeline, mid ridge, far ridge (altitudes)
  float px = 1.0 / unitPx;
  float tree = 1.0 - smoothstep(Tr.y - px, Tr.y + px, alt);
  if (tree > 0.999) return vec3(0.0002, 0.0003, 0.0005);
  vec3 col;
  if (alt < Tr.z) {
    // Mid range: nearly black, a thin rim where the aurora catches the crest.
    col = vec3(0.0004, 0.0007, 0.0012) + aLight * (0.0015 + 0.03 * exp(-(Tr.z - alt) / 2.0));
  } else if (alt < Tr.w) {
    // Far range: a little haze, snow on the peaks faintly lit.
    float snow = smoothstep(Tr.w - 50.0, Tr.w - 6.0, alt) * col4(q.x, 4.0).x;
    col = vec3(0.001, 0.0017, 0.0035) + aLight * (0.0015 + 0.03 * snow + 0.05 * exp(-(Tr.w - alt) / 2.0));
  } else {
    col = mix(vec3(0.0035, 0.007, 0.016), vec3(0.001, 0.0015, 0.005), smoothstep(0.0, 380.0, alt));
    col += aLight * 0.035 * exp(-alt / 80.0);
    col += stars(q, alt);
    col += meteors(q);
    vec3 top = mix(cTop, cDropTop, drop);
    // Rays converge on a vanishing point high above the frame, as real
    // aurora rays do toward the magnetic zenith: the columns are read along
    // lines through it, so the curtains lean in and the sky gets depth.
    float k = (1300.0 - (hz + 150.0)) / (1300.0 - q.y);
    float xr = q.x * k;
    float pr = col4(xr, 3.0).x;
    col += curtain(q, col4(xr * 0.97, 0.0), pr, top);
    col += curtain(q, col4(xr, 1.0), pr, top);
    if (drop > 0.02) col += curtain(q, col4(xr * 1.04, 2.0), pr, mix(top, cDropTop, 0.7));
  }
  return mix(col, vec3(0.0002, 0.0003, 0.0005), tree);
}

void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec3 col;
  if (q.y >= hz) {
    col = scene(q);
  } else {
    // ---- the lake, in its own plane: Z is distance across the water.
    float d = hz - q.y;
    float Z = 900.0 / (d + 2.0);
    float X = q.x * Z / 300.0;
    float amb = n2(vec2(X * 0.06 + camX * 0.002, Z * 0.4 - tw * 0.3)) - 0.5;
    float wave = 0.0, crest = 0.0;
    for (int j = 0; j < 4; j++) {
      vec4 R = rip[j];
      if (R.w <= 0.0) continue;
      vec2 dv = vec2(X - R.x, (Z - R.y) * 2.0);
      float front = length(dv) - R.z * 16.0;
      float env = exp(-front * front / 6.0) * exp(-R.z * 1.1) * R.w;
      float s = sin(front * 2.6);
      wave += s * env;
      crest += max(s, 0.0) * env;
    }
    float persp = 1.0 + d * 0.04;
    float disp = (amb * 0.8 * waterK + wave * 0.45) * persp;
    vec3 refl = scene(vec2(q.x + disp * 1.5, hz + d + disp * 2.5));
    float fres = mix(0.6, 0.22, smoothstep(0.0, 190.0, d));
    col = refl * fres * vec3(0.8, 0.92, 1.0);
    // Kick rings catch the aurora on their crests.
    col += aLight * crest * 0.06;
    // Hat sparks on the water, re-dealt on each hat.
    vec2 gc = vec2(X * 0.4, Z * 1.3);
    vec2 gid = floor(gc);
    float gp = step(0.86, h21(gid + vec2(hatSeed * 7.0, hatSeed * 3.0)));
    vec2 gpos = 0.2 + 0.6 * h22(gid + 4.0);
    float gdx = length((fract(gc) - gpos) * vec2(1.0, 2.5)) * 9.0;
    col += aLight * 1.6 * gp * hat * exp(-gdx * gdx) * smoothstep(6.0, 50.0, d);
    // Mist lying on the water, lit from above.
    float mist = (0.5 + 0.5 * sin(X * 0.03 + tw * 0.12 + 2.0 * sin(Z * 0.05 - tw * 0.07))) * exp(-d / 30.0);
    col += aLight * mist * 0.05;
  }
  col += aLight * 0.012 * exp(-abs(q.y - hz) / 8.0);
  col = 1.0 - exp(-col * 1.2);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };

  // lower edge, body, calm crown, drop crown, snare accent
  const PALETTES = [
    { name: 'Borealis', c: ['#2bff7a', '#12d8a0', '#1f5cff', '#b23cff', '#ff3fc8'] },
    { name: 'Blood moon', c: ['#ff4a3a', '#ff2a70', '#6a24ff', '#ff38d8', '#ffb640'] },
    { name: 'Ultraviolet', c: ['#34e8ff', '#5d7bff', '#7a2cff', '#ff3fb8', '#c8ff4a'] },
  ].map((p) => ({ name: p.name, c: p.c.map(lin) }));

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // 1D value noise for the per-column pass. Deterministic in x.
  const h11 = (n) => { const x = Math.sin(n * 127.1 + 17.3) * 43758.5453; return x - Math.floor(x); };
  const n1 = (x) => {
    const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f);
    const a = h11(i); return a + (h11(i + 1) - a) * f;
  };
  const fbm1 = (x) => (0.5 * n1(x) + 0.25 * n1(x * 2.03 + 1.7) + 0.125 * n1(x * 4.01 + 3.1) + 0.0625 * n1(x * 8.1 + 5.3)) / 0.9375;
  const ridge = (x) => { const a = 1 - Math.abs(2 * n1(x) - 1); return a * a; };

  // Curtains: depth scale of x, pan parallax, x offset, lower-edge altitude,
  // its wander, fold amount (calm, extra in the drop), height, gain.
  const CURTAINS = [
    { sc: 0.75, par: 0.06, off: 0, base: 225, amp: 40, fold: 0.8, foldDrop: 0.7, H: 80, gain: 0.5 },
    { sc: 1.0, par: 0.1, off: 700, base: 160, amp: 60, fold: 1.1, foldDrop: 1.0, H: 110, gain: 0.8 },
    { sc: 1.25, par: 0.14, off: 1500, base: 110, amp: 40, fold: 1.5, foldDrop: 0.6, H: 150, gain: 0.9 },
  ];

  VIZ.register({
    id: 'aurora',
    name: 'Aurora',
    order: 202,

    params: [
      { key: 'palette', label: 'Sky', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'height', label: 'Curtain height', type: 'range', min: 0.5, max: 1.8, default: 1, step: 0.01 },
      { key: 'dance', label: 'Dance', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'stars', label: 'Stars', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'water', label: 'Water', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Aurora',
      technique: 'WebGL2 fragment shader fed by a per-column float texture computed in JS (curtain edges, fold brightness from the warp slope, rays, kick pulses, ridge lines); rotating hashed star field; a lake that re-evaluates the sky at the rippled mirror point; music detected as onsets and passed in as travelling pulses, rings and meteors',
      brief: 'Night over a mountain lake. Curtains of light fold and drift above silhouetted ranges and a pine shore, stars wheel slowly, and the still water mirrors all of it. Each kick sends a white-hot pulse racing both ways along the curtains from a new spot and throws a ring across the lake; each snare or clap fires a shooting star and flips the curtain crowns to magenta; hats re-deal which stars glint and scatter sparks on the water; bass lifts and brightens the curtains. The drop adds a third, nearer curtain, turns the crowns violet-magenta and makes the ribbons fold faster; the breakdown exhales to a slow green veil.',
      lineage: [
        'Brief 02 (batch 02): aurora over a lake, layered like Flyover\'s Night drive, with a legible reaction per drum.',
        'v1: everything per pixel in one shader (noise for curtain folds, rays, ridges). The whole sky was a saturated barcode of vertical stripes, the mountains glowed grey-green like fog, the kick rings melted the lake, and it cost ~4x the WebGL budget.',
        'v2: moved everything that depends only on x into a per-column RGBA16F texture computed in JS each frame; land darkened to silhouettes; ripples halved. Curtains now had darkness around them, but read as a picket fence, the stars as snow, and the breakdown stayed violet too long.',
        'v3: sparser, smaller stars on integer hashes; softer rays; faster exhale after the drop. Kick strip checked: the frame 65 ms after a kick shows a white-cyan bloom and a hot lower edge, 170 ms after it the pulse is visibly racing outward, and kick plus clap flips the crowns pink with a shooting star.',
        'v4: the drop was a wall because the curtains\' bright lower edges sat behind the mountains. Raised the curtains, lowered the ranges, and made the rays converge on a vanishing point above the frame (real aurora rays converge on the magnetic zenith): the biggest single gain, it turns the drop into a cathedral of light with depth.',
        'v5: fold brightness box-filtered over ~35 units and the gaps between curtains laid out in screen space with a wider gate, to remove hard vertical cut-offs; GL layer rendered at 0.65x and upscaled to fit the budget, since the imagery is soft light.',
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
      this.camX = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.pulses = [];
      this.meteors = [];
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
      for (const n of ['cols', 'texX', 'res', 'unitPx', 'tw', 'camX', 'starAng', 'hz', 'bass', 'kick', 'snare',
        'hat', 'hatSeed', 'drop', 'starK', 'waterK', 'halfW', 'cLow', 'cMid', 'cTop', 'cDropTop', 'cAccent',
        'aLight', 'rip', 'met', 'metA']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      // RGBA16F is filterable in core WebGL2; 32F would need an extension.
      this.tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(u.cols, 0);
      this.texW = 0;
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Onsets are found against slow baselines, so a pad or a riser that
    // lifts a whole band does not read as a hit; only a jump does.
    listen(s, dt, push, halfW) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      // Kick: band 0 leading band 1. A bass note fills band 1 as much as band
      // 0 and a kick fills band 0 more, so this rejects the bass line's
      // off-beat notes, which otherwise doubled the pulses.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        const r = Math.random;
        this.pulses.unshift({ x: (r() * 1.4 - 0.7) * halfW, age: 0, amp: kRaw,
          lx: (r() * 2 - 1) * 22, lz: 7 + r() * 10 });
        this.pulses.length = Math.min(this.pulses.length, 4);
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.8, dt);

      // Snare / clap: band 4 above its own slow floor.
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        const r = Math.random;
        const leftward = r() < 0.5;
        this.meteors.unshift({
          x: (leftward ? 0.1 + r() * 0.8 : -0.9 + r() * 0.8) * halfW,
          y: 150 + r() * 130,
          ang: leftward ? Math.PI + 0.3 + r() * 0.35 : -0.3 - r() * 0.35,
          age: 0, amp: (0.6 + 0.4 * sRaw) * Math.min(1, push),
        });
        this.meteors.length = Math.min(this.meteors.length, 3);
      }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw * Math.min(1, push), e.snare * Math.exp(-dt / 0.16));

      // Hats: the top band above its floor; each onset re-deals the glints.
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
    },

    // The per-column pass: everything that depends only on x.
    columns(halfW, params) {
      const e = this.env, push = params.push;
      // Past the stage edge: the converging rays read the columns up to
      // ~1.25x wider at the top of the frame, and the water displaces a bit.
      const margin = 0.3 * halfW + 45;
      const x0 = -halfW - margin;
      const N = Math.ceil((2 * (halfW + margin)) / TEX_STEP);
      if (!this.data || this.data.length !== N * ROWS * 4) this.data = new Float32Array(N * ROWS * 4);
      const D = this.data, T = this.T, camX = this.camX;
      const bass = e.bass * push, kick = e.kick * push, drop = e.drop;
      const g = 0.35 + 0.45 * bass + 0.4 * kick + 0.25 * drop;
      const bassH = (1 + 0.8 * bass) * params.height;
      const pulses = this.pulses;
      const nCurt = drop > 0.02 ? 3 : 2;

      for (let ci = 0; ci < nCurt; ci++) {
        const C = CURTAINS[ci];
        const tt = T * (0.9 + 0.25 * ci);
        const fold = C.fold + C.foldDrop * drop;
        const gain = C.gain * g * (ci === 2 ? drop : 1);
        const row = ci * N * 4;
        let wPrev = null;
        if (!this.fg || this.fg.length !== N) this.fg = new Float32Array(N);
        const fg = this.fg;
        for (let k = 0; k < N; k++) {
          const x = x0 + k * TEX_STEP;
          const xs = x * C.sc + camX * C.par + C.off;
          const y0 = HZ + C.base + C.amp * (fbm1(xs * 0.0034 + tt * 0.06 + ci * 7) - 0.5) * 2.4;
          const w = xs + fold * (fbm1(xs * 0.0032 + tt * 0.09 + ci * 3.3) - 0.5) * 180;
          if (wPrev === null) {
            const xp = xs - TEX_STEP * C.sc;
            wPrev = xp + fold * (fbm1(xp * 0.0032 + tt * 0.09 + ci * 3.3) - 0.5) * 180;
          }
          const slope = Math.abs(w - wPrev) / (TEX_STEP * C.sc);
          wPrev = w;
          const foldGain = Math.min(3.5, Math.max(0.45, Math.pow(1 / Math.max(slope, 0.15), 0.7)));
          // Gaps are laid out in screen space, not along the ribbon: along the
          // ribbon a fold compresses them into hard vertical cut-offs.
          const lit = smooth(0.22, 0.8, n1(xs * 0.0019 + tt * 0.03 + ci * 13));
          const r1 = n1(w * 0.075 + tt * 0.6 + ci * 5);
          const r2 = n1(w * 0.19 - tt * 1.1);
          const rays = 0.25 + Math.pow(0.55 * r1 + 0.45 * r2, 1.8) * 1.4;
          // Kick pulses: a front racing outward both ways from each origin,
          // and a bloom at the origin itself that fades in ~0.15 s.
          let pulse = 0;
          for (let j = 0; j < pulses.length; j++) {
            const P = pulses[j];
            const dx = Math.abs(x - P.x);
            const front = dx - P.age * 800;
            pulse += P.amp * (Math.exp(-front * front / 2400 - P.age * 1.1)
              + 1.1 * Math.exp(-dx * dx / 18000 - P.age / 0.15));
          }
          pulse *= push;
          const o = row + k * 4;
          D[o] = y0;
          fg[k] = foldGain;
          D[o + 1] = lit * gain * (1 + 2.2 * pulse);
          D[o + 2] = rays;
          D[o + 3] = C.H * bassH * (1 + 0.6 * pulse);
          if (ci === 0) D[3 * N * 4 + k * 4] = pulse;
        }
        // A fold's brightness spike, taken raw, reads as a hard vertical
        // cut in the curtain; spread over ~35 units it reads as a fold.
        const R = 24;
        let acc = 0;
        for (let k = 0; k < Math.min(N, R); k++) acc += fg[k];
        for (let k = 0; k < N; k++) {
          if (k + R < N) acc += fg[k + R];
          if (k - R - 1 >= 0) acc -= fg[k - R - 1];
          const n = Math.min(N - 1, k + R) - Math.max(0, k - R) + 1;
          D[row + k * 4 + 1] *= acc / n;
        }
      }
      if (nCurt < 3) for (let k = 0; k < N; k++) D[2 * N * 4 + k * 4 + 1] = 0;

      // Terrain rows: treeline, mid and far ridge altitudes, far snow.
      const cw = 6.5;
      for (let k = 0; k < N; k++) {
        const x = x0 + k * TEX_STEP;
        const xt = x + camX;
        const bank = 3 + 4 * n1(xt * 0.02);
        const id = Math.floor(xt / cw);
        let top = bank;
        for (let c = id - 1; c <= id + 1; c++) {
          const hh = h11(c * 1.31 + 2);
          const grove = smooth(0.25, 0.6, n1(c * 0.07 + 5));
          const th = (6 + 22 * hh * hh) * grove;
          if (th < 2) continue;
          const cx = (c + 0.2 + 0.6 * h11(c * 7.7)) * cw;
          const dx = Math.abs(xt - cx);
          // A pine: a narrow cone with tiered branches.
          let t = th - dx * th / (cw * 0.5);
          t -= 1.6 * ((th - t) / 4 % 1);
          if (t > 0) top = Math.max(top, bank + t);
        }
        const sm = (x + camX * 0.45) * 0.0065 + 23;
        const mid = 14 + 50 * (0.6 * fbm1(sm) + 0.4 * ridge(sm * 1.7 + 9)) * (0.55 + 0.45 * n1(sm * 0.31));
        const sf = (x + camX * 0.2) * 0.0042 + 11;
        const far = 40 + 72 * (0.55 * ridge(sf) + 0.3 * ridge(sf * 2.1 + 4) + 0.15 * n1(sf * 6));
        const o = 3 * N * 4 + k * 4;
        D[o + 1] = top; D[o + 2] = mid; D[o + 3] = far;
        D[4 * N * 4 + k * 4] = 0.4 + 0.6 * n1((x + camX * 0.2) * 0.08);
      }
      return { x0, N };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const halfW = ctx.width / 2;
      this.listen(signals, dt, push, halfW);
      const e = this.env;

      for (const P of this.pulses) P.age += dt;
      this.pulses = this.pulses.filter((P) => P.age < 2.5);
      for (const M of this.meteors) M.age += dt;
      this.meteors = this.meteors.filter((M) => M.age < 0.8);

      this.T += dt * (0.3 + 0.9 * e.bass * push + 0.9 * e.drop) * params.dance;
      this.tw += dt;
      this.camX += dt * 7 * params.drift;

      const w = Math.round(p.width * p.pixelDensity() * RES);
      const h = Math.round(p.height * p.pixelDensity() * RES);
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Aurora needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }

      const { x0, N } = this.columns(halfW, params);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      if (this.texW !== N) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, N, ROWS, 0, gl.RGBA, gl.FLOAT, this.data);
        this.texW = N;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, ROWS, gl.RGBA, gl.FLOAT, this.data);
      }

      const pal = PALETTES[(params.palette | 0) % PALETTES.length].c;
      const lightK = 0.35 + 0.5 * e.bass * push + 0.4 * e.kick * push + 0.4 * e.drop;
      const aLight = pal[0].map((c, i) => (c * (1 - 0.35 * e.drop) + pal[3][i] * 0.35 * e.drop) * lightK);

      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.texX, x0, 1 / (N * TEX_STEP));
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, Math.min(w, h) / 600);
      gl.uniform1f(u.tw, this.tw % 3000);
      gl.uniform1f(u.camX, this.camX % 20000);
      gl.uniform1f(u.starAng, (this.tw * 0.006 * params.drift) % (Math.PI * 2));
      gl.uniform1f(u.hz, HZ);
      gl.uniform1f(u.halfW, halfW);
      gl.uniform1f(u.bass, e.bass * push);
      gl.uniform1f(u.kick, e.kick * push);
      gl.uniform1f(u.snare, e.snare);
      gl.uniform1f(u.hat, e.hat * push);
      gl.uniform1f(u.hatSeed, this.hatSeed);
      gl.uniform1f(u.drop, e.drop);
      gl.uniform1f(u.starK, params.stars);
      gl.uniform1f(u.waterK, params.water);
      gl.uniform3fv(u.cLow, pal[0]);
      gl.uniform3fv(u.cMid, pal[1]);
      gl.uniform3fv(u.cTop, pal[2]);
      gl.uniform3fv(u.cDropTop, pal[3]);
      gl.uniform3fv(u.cAccent, pal[4]);
      gl.uniform3fv(u.aLight, aLight);
      const rip = new Float32Array(16);
      this.pulses.forEach((P, i) => rip.set([P.lx, P.lz, P.age, P.amp * push * params.water], i * 4));
      gl.uniform4fv(u.rip, rip);
      const met = new Float32Array(12), metA = new Float32Array(3);
      this.meteors.forEach((M, i) => { met.set([M.x, M.y, M.ang, M.age], i * 4); metA[i] = M.amp; });
      gl.uniform4fv(u.met, met);
      gl.uniform1fv(u.metA, metA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
