// Koi — a clear, shallow pond seen from straight above on a sunny day.
//
// Three layers, bottom to top, the way the light actually stacks:
//   1. the pond floor (sand, pebbles, algae mottling) with moving sunlight
//      caustics and the soft shadows of everything above it — one WebGL2
//      fragment shader;
//   2. the koi, drawn with Canvas 2D into an offscreen canvas and handed to
//      the same shader as a texture, so the surface ripples refract them too;
//   3. things floating on the surface — lily pads, a lotus, fallen petals —
//      drawn with Canvas 2D on top of the composite, where refraction would
//      be wrong.
// The shadows are a separate low-resolution canvas (fish and pads drawn as
// black silhouettes, each offset by its height above the floor). Upscaling it
// in the shader is the blur: a penumbra for free, and the shadow of a deep
// fish is sharper and closer than that of a pad on the surface.
//
// Music: a kick drops a raindrop at one wandering point (a ripple travels out
// from it, bending the caustics and the fish beneath); a snare makes one koi
// C-start and dart; the bass sets how fast they swim; hats glint on the wind
// chop; the drop brings a shoal of small koi circling the pond, and they swim
// off again in the breakdown.

(function () {
  const MAX_RIP = 32;

  const VERT = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform vec2 res;          // virtual stage size
uniform float time;
uniform vec4 rip[${MAX_RIP}];      // x, y, age (s), amplitude
uniform int ripN;
uniform float hats;
uniform float clarity;
uniform float chop;        // wind on the surface
uniform vec3 sunCol;
uniform vec3 sandCol;
uniform vec3 waterTint;
uniform vec3 skyCol;
uniform float causticGain;
uniform float shadowGain;
uniform float glintGain;
uniform vec2 sunDir2;      // horizontal direction the light travels
uniform sampler2D shadowTex;
uniform sampler2D fishTex;
out vec4 color;

float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 h2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.15 * vnoise(p * 4.1 - 3.7);
}

// Surface height in virtual units: a gentle wind chop plus every raindrop.
float height(vec2 q) {
  float h = chop * (0.55 * sin(q.x * 0.045 + q.y * 0.021 + time * 1.3)
                  + 0.40 * sin(q.x * -0.027 + q.y * 0.052 + time * 1.05)
                  + 0.35 * sin(q.x * 0.071 - q.y * 0.038 - time * 1.7)
                  + 0.8 * (vnoise(q * 0.03 + vec2(time * 0.25, time * 0.11)) - 0.5));
  for (int i = 0; i < ${MAX_RIP}; i++) {
    if (i >= ripN) break;
    vec4 r = rip[i];
    float d = length(q - r.xy);
    float front = r.z * 150.0;
    float w = 10.0 + r.z * 26.0;               // the packet disperses as it travels
    float x = d - front;
    float env = exp(-x * x / (w * w)) * exp(-r.z * 1.1) / sqrt(1.0 + d * 0.05);
    h += r.w * env * cos(x * 0.33);
    // The impact itself: a dimple that springs back, so the first instant of
    // a drop reads as a hit at one point before the rings carry it outward.
    h -= r.w * 2.6 * exp(-r.z * 5.0) * exp(-d * d / 260.0) * cos(r.z * 30.0);
  }
  return h;
}

// Animated Voronoi web: bright where two cells meet, which is what sunlight
// focused by a wavy surface looks like on a flat floor.
float causticLayer(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = h2(i + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  float e = sqrt(f2) - sqrt(f1);
  return exp(-e * e * 38.0);
}

vec3 pebbleCol(float k) {
  if (k < 0.18) return vec3(0.40, 0.42, 0.43);
  if (k < 0.34) return vec3(0.62, 0.58, 0.52);
  if (k < 0.48) return vec3(0.56, 0.38, 0.27);
  if (k < 0.62) return vec3(0.83, 0.79, 0.70);
  if (k < 0.76) return vec3(0.24, 0.24, 0.25);
  if (k < 0.88) return vec3(0.44, 0.47, 0.38);
  return vec3(0.70, 0.52, 0.40);
}

// One scale of stones. Returns colour in rgb and coverage in a; the sand's
// contact shadow comes back through sh.
vec4 stones(vec2 q, float S, float dens, float seed, inout float sh) {
  vec2 p = q / S;
  vec2 i = floor(p), f = fract(p);
  vec4 best = vec4(0.0);
  float bestH = 0.0;
  vec2 so = -sunDir2 * 0.18;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 id = i + g + seed;
    vec2 hh = h2(id);
    float k = h1(id * 1.7 + 3.1);
    if (k > dens) continue;
    float rad = 0.28 + 0.2 * hh.y;
    float a = hh.x * 6.2831;
    vec2 r = g + 0.5 + 0.3 * (hh - 0.5) - f;
    mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 e = R * r; e.y /= 0.68;
    float d = length(e) / rad;
    vec2 es = R * (r - so); es.y /= 0.68;
    sh = max(sh, smoothstep(1.25, 0.7, length(es) / rad) * 0.55);
    if (d < 1.0) {
      float hgt = sqrt(1.0 - d * d);
      if (hgt > bestH) {
        bestH = hgt;
        vec3 n = normalize(vec3(-e * 1.3 / rad, hgt + 0.2));
        float lam = clamp(dot(n, normalize(vec3(-sunDir2, 0.9))), 0.0, 1.0);
        vec3 c = pebbleCol(fract(k * 13.7));
        c *= 0.85 + 0.3 * vnoise(q * 0.9 + id * 5.0);
        c *= 0.45 + 0.75 * lam;
        c += 0.10 * pow(lam, 12.0);          // a small matte sheen, not a highlight
        best = vec4(c, smoothstep(1.0, 0.9, d));
      }
    }
  }
  return best;
}

void main() {
  vec2 q = vec2(uv.x * res.x, (1.0 - uv.y) * res.y);

  // Surface slope and curvature by finite differences.
  float e = 1.5;
  float hc = height(q);
  float hx1 = height(q + vec2(e, 0.0)), hx0 = height(q - vec2(e, 0.0));
  float hy1 = height(q + vec2(0.0, e)), hy0 = height(q - vec2(0.0, e));
  vec2 grad = vec2(hx1 - hx0, hy1 - hy0) / (2.0 * e);
  float lap = (hx1 + hx0 + hy1 + hy0 - 4.0 * hc) / (e * e);

  // Depth of the floor varies across the pond.
  float depth = 0.5 + 1.3 * smoothstep(0.3, 0.75, fbm(q * 0.003 + 11.0));

  // Refraction: the floor is seen through the slope, further for deep water.
  vec2 qb = q - grad * 26.0 * depth;
  vec2 qf = q - grad * 9.0;

  // --- floor
  float sh = 0.0;
  float grain = vnoise(qb * 1.3) * 0.5 + vnoise(qb * 3.1) * 0.5;
  float ridges = sin(dot(qb, vec2(0.11, 0.05)) + 3.0 * fbm(qb * 0.01)) * 0.5 + 0.5;
  vec3 floorC = sandCol * (0.86 + 0.14 * grain) * (0.93 + 0.07 * ridges);
  float algae = smoothstep(0.45, 0.8, fbm(qb * 0.006 + 3.0));
  floorC = mix(floorC, vec3(0.42, 0.45, 0.28), algae * 0.5);
  float dens = smoothstep(0.42, 0.75, fbm(qb * 0.0045 + 5.0));
  vec4 big = stones(qb, 36.0, dens * 0.8, 0.0, sh);
  vec4 small = stones(qb, 14.0, dens * 0.45, 17.0, sh);
  floorC *= 1.0 - sh * 0.5;
  floorC = mix(floorC, small.rgb, small.a);
  floorC = mix(floorC, big.rgb, big.a);

  // --- light on the floor: sun, caustics, shadows
  vec2 uvS = qb / res;
  float shadow = texture(shadowTex, uvS).a * shadowGain;
  float t = time;
  vec2 cq = qb + 12.0 * vec2(sin(qb.y * 0.02 + t * 0.4), cos(qb.x * 0.02 - t * 0.3));
  float c1 = causticLayer(cq / 58.0, t * 0.55);
  float c2 = causticLayer(cq / 41.0 + 3.7, -t * 0.47 + 1.3);
  float caus = c1 * 0.55 + c2 * 0.45 + c1 * c2 * 1.4;
  caus *= mix(1.0, 0.55, clamp(depth - 0.6, 0.0, 1.0));
  caus += clamp(-lap * 5.0, -0.6, 2.0);        // ripples focus and defocus light
  caus = max(caus, 0.0);
  float lit = 1.0 - shadow;
  vec3 light = mix(skyCol, sunCol, lit) + sunCol * caus * causticGain * lit;
  vec3 col = floorC * light;

  // Water between us and the floor.
  float absorb = (1.0 - clarity) * 0.5 + 0.45;
  col *= mix(vec3(1.0), waterTint, clamp(depth * absorb, 0.0, 1.0));
  col += waterTint * 0.05 * depth;

  // --- fish (premultiplied), lit a little by the caustics too
  vec4 fish = texture(fishTex, qf / res);
  vec3 fc = fish.rgb * (0.88 + 0.12 * light) * mix(vec3(1.0), waterTint, 0.18)
          + fish.a * sunCol * caus * causticGain * 0.12;
  col = col * (1.0 - fish.a) + fc;

  // --- surface: sky sheen on slopes, glints of the sun on the chop
  vec3 n = normalize(vec3(-grad * 1.6, 1.0));
  float sheen = 1.0 - n.z;
  col += skyCol * sheen * 0.9;
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 L = normalize(vec3(-sunDir2 * 0.35, 1.0));
  float g = pow(max(dot(r, L), 0.0), 600.0);
  float spark = step(0.965 - hats * 0.035, vnoise(q * 0.35 + vec2(t * 3.1, -t * 2.3)));
  float gl = glintGain * (g * (0.6 + 1.2 * hats) + spark * sheen * 18.0 * hats);
  col += sunCol * min(gl, 1.2);

  color = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  // Light presets. Colours are linear-ish 0-1 triples for the shader, and
  // CSS colours for the 2D layers.
  const LIGHTS = [
    { name: 'Noon', sun: [1.08, 1.04, 0.96], sky: [0.46, 0.52, 0.55], sand: [0.80, 0.72, 0.57],
      tint: [0.42, 0.68, 0.64], caustic: 0.42, shadow: 0.78, glint: 1.0, dir: [0.55, 0.62],
      padShade: 1.0, dark: false },
    { name: 'Golden hour', sun: [1.18, 0.88, 0.62], sky: [0.40, 0.40, 0.46], sand: [0.78, 0.66, 0.50],
      tint: [0.55, 0.70, 0.60], caustic: 0.6, shadow: 0.7, glint: 1.2, dir: [0.9, 0.35],
      padShade: 0.92, dark: false },
    { name: 'Overcast', sun: [0.88, 0.9, 0.92], sky: [0.74, 0.78, 0.80], sand: [0.74, 0.70, 0.60],
      tint: [0.55, 0.70, 0.66], caustic: 0.1, shadow: 0.35, glint: 0.35, dir: [0.2, 0.25],
      padShade: 0.95, dark: false },
    { name: 'Night', sun: [0.62, 0.70, 0.86], sky: [0.07, 0.09, 0.15], sand: [0.50, 0.48, 0.46],
      tint: [0.30, 0.42, 0.55], caustic: 0.45, shadow: 0.55, glint: 1.4, dir: [-0.4, 0.6],
      padShade: 0.45, dark: true },
  ];

  // Koi varieties, from above: base colour and patches (s along the body,
  // lateral offset -1..1, radius as a fraction of body width, colour key).
  const COL = {
    white: [246, 242, 233], red: [214, 62, 30], orange: [236, 118, 34], black: [28, 27, 28],
    gold: [226, 176, 70], bronze: [150, 110, 72], blue: [118, 138, 150], cream: [240, 226, 196],
  };
  const VARIETIES = [
    { base: 'white', patches: [[0.12, 0, 0.9, 'red'], [0.42, 0.2, 1.0, 'red'], [0.7, -0.3, 0.8, 'red']] }, // kohaku
    { base: 'white', patches: [[0.1, 0.1, 0.9, 'red'], [0.4, -0.2, 0.9, 'red'], [0.3, 0.55, 0.35, 'black'], [0.62, -0.5, 0.3, 'black'], [0.78, 0.3, 0.3, 'black']] }, // sanke
    { base: 'black', patches: [[0.1, 0, 0.8, 'red'], [0.45, 0.4, 0.7, 'white'], [0.55, -0.3, 0.8, 'red'], [0.75, 0.2, 0.5, 'white']] }, // showa
    { base: 'gold', patches: [] },                                   // ogon
    { base: 'white', patches: [[0.07, 0, 0.55, 'red']] },            // tancho
    { base: 'orange', patches: [[0.5, 0, 0.6, 'cream']] },
    { base: 'blue', patches: [[0.55, 0.9, 0.55, 'orange'], [0.55, -0.9, 0.55, 'orange'], [0.1, 0, 0.45, 'cream']] }, // asagi
    { base: 'bronze', patches: [] },                                 // chagoi
    { base: 'white', patches: [[0.25, 0.3, 0.9, 'orange'], [0.6, -0.2, 0.8, 'orange']] },
    { base: 'black', patches: [[0.2, 0, 0.5, 'gold'], [0.6, 0, 0.4, 'gold']] },
  ];

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const wrapAng = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : a})`;

  VIZ.register({
    id: 'koi',
    name: 'Koi',
    order: 404,
    gallery: {
      title: 'Koi',
      technique: 'WebGL2 pond floor (Voronoi pebbles, animated caustic web, ripple height field with refraction) compositing Canvas 2D koi and a low-res shadow canvas as textures; Canvas 2D lily pads, lotus and petals floating on top',
      brief: 'Looking down into a clear, shallow pond on a sunny day. Koi in white, red, black and gold swim and circle with real body undulation over sand and pebbles, sunlight caustics crawl across the floor under their soft shadows, lily pads and a lotus drift, petals float. Kicks drop raindrops at one wandering spot and the rings travel out, bending the light underneath; a snare makes one koi snap into a C and dart; the bass sets their pace; hats glint on the chop; the drop brings a shoal of small koi circling the pond, and they leave in the breakdown.',
      lineage: 'Batch 04 brief 04 (daylight, matte, no glow). Built from observation of real koi ponds rather than a prior scene. The floor, caustics and ripples live in one fragment shader so the refraction is physical: every raindrop bends the caustic web, the pebbles and the fish beneath it. Koi are Canvas 2D vector bodies (12-segment spine bent by turn rate plus a tail-growing travelling wave, varieties as clipped patches) drawn to an offscreen canvas the shader samples through the ripples; shadows are a 1/6-resolution silhouette canvas whose bilinear upscale is the penumbra. Process, at 640x360 on contact sheets and the jolt meter: v1 read as a busy yellow gravel bed with tiny fish, so the koi grew by half, the stones thinned into patches over sand, and the water went jade with deeper holes. The kick ripple alone barely registered on the heat map (fish motion outweighed it), so the impact got a springing dimple and a crown of splash droplets. The shoal first arrived late and lingered into the breakdown (a shrinking orbit it could not catch), so it became a fixed orbit whose targets are pushed out past the bank by (1 - drive): the drop pulls it in within a bar or two and the breakdown lets it swim away. Final jolt: calm, kickArea 0.115, ratio 1.26.',
    },

    params: [
      { key: 'count', label: 'Koi', type: 'range', min: 3, max: 14, default: 8, step: 1 },
      { key: 'speed', label: 'Swim speed', type: 'range', min: 0.3, max: 2, default: 1 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1 },
      { key: 'light', label: 'Light', type: 'select', options: LIGHTS.map((l) => l.name), default: 0 },
      { key: 'pads', label: 'Lily pads', type: 'range', min: 0, max: 10, default: 6, step: 1 },
      { key: 'petals', label: 'Petals', type: 'range', min: 0, max: 1, default: 0.5 },
      { key: 'clarity', label: 'Water clarity', type: 'range', min: 0, max: 1, default: 0.7 },
      { key: 'shoal', label: 'Shoal', type: 'select', options: ['On the drop', 'Always', 'Never'], default: 0 },
    ],

    actions: [
      { id: 'scatter', label: 'Scatter the koi', run() { this.scatterReq = true; } },
      { id: 'stone', label: 'Drop a stone', run() { this.stoneReq = true; } },
    ],

    setup(p, ctx) { this.init(ctx); },
    enter(p, ctx) { if (!this.fish) this.init(ctx); },

    init(ctx) {
      const R = Math.random;
      this.W = ctx.width; this.H = ctx.height;
      this.fish = [];
      for (let i = 0; i < 14; i++) this.fish.push(this.makeFish(i, false, R));
      this.shoal = [];
      for (let i = 0; i < 16; i++) { const f = this.makeFish(i, true, R); f.x = -900; f.y = -900; this.shoal.push(f); }
      this.leader = { ang: 0, rx: 2, x: 0, y: 0, h: 0 };
      this.ripples = [];
      this.splash = [];
      this.petals = [];
      for (let i = 0; i < 14; i++) {
        this.petals.push(this.makePetal(R() * ctx.width, R() * ctx.height, R));
        this.petals[i].fall = 0;
      }
      this.pads = [];
      for (let i = 0; i < 10; i++) {
        const big = i === 0;
        this.pads.push({
          u: R(), v: R(), r: big ? 64 : 30 + R() * 34, rot: R() * 6.28, vr: (R() - 0.5) * 0.03,
          shade: R(), lotus: i === 0 ? 2 : i === 3 ? 1 : 0, bob: R() * 6.28,
        });
      }
      // Lay the pads out so they cluster along one side rather than evenly.
      this.pads.forEach((pd, i) => {
        const a = (i / 10) * 6.28 + R() * 0.5;
        pd.x = ctx.width * (0.5 + 0.42 * Math.cos(a) + 0.1 * (R() - 0.5));
        pd.y = ctx.height * (0.5 + 0.40 * Math.sin(a) + 0.1 * (R() - 0.5));
      });
      this.env = new Float32Array(9);
      this.prev = [];
      this.lastKick = -9; this.lastSnare = -9; this.kicks = 0;
      this.bassSlow = 0; this.drive = 0; this.swimT = 0;
      this.dropPt = { x: ctx.width * 0.6, y: ctx.height * 0.45 };
      this.dartIdx = 0;
      this.t = 0;
    },

    makeFish(i, small, R) {
      const v = small ? (i % 3 === 0 ? 4 : i % 3 === 1 ? 5 : 3) : i % VARIETIES.length;
      return {
        x: R() * this.W, y: R() * this.H, h: R() * 6.28, turn: 0, turnS: 0,
        len: small ? 50 + R() * 16 : 118 + R() * 50, depth: small ? 0.3 + R() * 0.3 : 0.2 + R() * 0.75,
        variety: v, phase: R() * 6.28, dart: 0, dartTurn: 0, dartT: 0,
        ox: R() * 6.28, oy: R() * 6.28, wx: 0.07 + R() * 0.07, wy: 0.05 + R() * 0.08,
        butterfly: !small && R() < 0.35,
        slot: small ? [-(1 + (i >> 2)) * 44 + (R() - 0.5) * 22, ((i % 4) - 1.5) * 32 + (R() - 0.5) * 14] : null,
        spd: 1,
      };
    },

    makePetal(x, y, R) {
      return {
        x, y, rot: R() * 6.28, vr: (R() - 0.5) * 0.4, s: 7 + R() * 5,
        tone: R(), fall: 1, age: 0, vx: 0, vy: 0,
      };
    },

    // ---- GL ---------------------------------------------------------------
    initGL() {
      this.glFailed = true;
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
      if (!gl) return;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (n) => gl.getUniformLocation(prog, n);
      this.u = {};
      ['res', 'time', 'rip', 'ripN', 'hats', 'clarity', 'chop', 'sunCol', 'sandCol', 'waterTint', 'skyCol',
        'causticGain', 'shadowGain', 'glintGain', 'sunDir2', 'shadowTex', 'fishTex'].forEach((n) => { this.u[n] = U(n); });
      const tex = (unit) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      this.texShadow = tex(0);
      this.texFish = tex(1);
      gl.uniform1i(this.u.shadowTex, 0);
      gl.uniform1i(this.u.fishTex, 1);
      this.ripBuf = new Float32Array(MAX_RIP * 4);
      this.gl = gl; this.glCanvas = c; this.glFailed = false;
    },

    // ---- behaviour --------------------------------------------------------
    steer(f, tx, ty, speed, dt, maxTurn) {
      const want = Math.atan2(ty - f.y, tx - f.x);
      let turn = Math.max(-maxTurn, Math.min(maxTurn, wrapAng(want - f.h) * 1.6));
      if (f.dartT > 0) turn = f.dartTurn;          // the C-start overrides steering
      f.turn += (turn - f.turn) * Math.min(1, dt * 6);
      f.h = wrapAng(f.h + f.turn * dt);
      f.turnS += (f.turn - f.turnS) * Math.min(1, dt * 4);
      const v = speed * (1 + f.dart);
      f.x += Math.cos(f.h) * v * dt;
      f.y += Math.sin(f.h) * v * dt;
      f.spd = v;
      f.phase += dt * (2.2 + v * 0.07);
      f.dart *= Math.exp(-dt * 2.6);
      f.dartT -= dt;
    },

    dartFish(f, strength) {
      f.dartT = 0.22;
      f.dartTurn = (Math.random() < 0.5 ? -1 : 1) * (7 + 4 * Math.random());
      f.dart = 3.2 * strength;
    },

    // Spine from head to tail base: heading, bent by the turn (the body
    // follows its path) and a travelling wave growing toward the tail.
    spine(f) {
      const N = 12, seg = f.len / N, pts = [];
      let x = f.x, y = f.y;
      const amp = 0.13 + 0.1 * Math.min(1, f.dart);
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        pts.push([x, y]);
        const a = f.h + Math.PI - f.turnS * 0.55 * s * (f.len / 60) * 0.9
          + amp * s * s * 2.2 * Math.sin(f.phase * 2.2 - s * 4.2) - amp * 0.25 * Math.sin(f.phase * 2.2);
        x += Math.cos(a) * seg; y += Math.sin(a) * seg;
      }
      return pts;
    },

    outline(f, pts) {
      const N = pts.length - 1, L = [], Rr = [], W = f.len * 0.135, nrm = [];
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const a = pts[Math.min(N, i + 1)], b = pts[Math.max(0, i - 1)];
        let nx = -(a[1] - b[1]), ny = a[0] - b[0];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        nrm.push([nx, ny]);
        // Blunt rounded head, widest a third along, a slim peduncle.
        let w = s < 0.3 ? Math.sqrt(Math.sin((s + 0.04) / 0.34 * Math.PI / 2)) : 1 - 0.78 * Math.pow((s - 0.3) / 0.7, 1.3);
        w *= W;
        L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
        Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
      }
      return { L, R: Rr, nrm, W };
    },

    bodyPath(g, o, pts) {
      const P = o.L.concat(o.R.slice().reverse());
      g.beginPath();
      // Round the snout with an arc across the head.
      const head = pts[0], h2 = o.L[0];
      g.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length - 1; i++) {
        const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
        g.quadraticCurveTo(P[i][0], P[i][1], mx, my);
      }
      const last = P[P.length - 1];
      g.lineTo(last[0], last[1]);
      // Snout: bulge forward of the head point.
      const d = pts[0][0] - pts[1][0], e = pts[0][1] - pts[1][1], l = Math.hypot(d, e) || 1;
      g.quadraticCurveTo(head[0] + d / l * o.W * 1.1, head[1] + e / l * o.W * 1.1, h2[0], h2[1]);
      g.closePath();
    },

    fins(g, f, pts, o, fill) {
      const N = pts.length - 1;
      const flap = Math.sin(f.phase * 1.6) * 0.25;
      // Pectorals: two fans a fifth of the way back.
      const i = Math.round(N * 0.2);
      const bx = pts[i][0], by = pts[i][1], n = o.nrm[i];
      const ax = pts[i + 1][0] - pts[i][0], ay = pts[i + 1][1] - pts[i][1];
      const al = Math.hypot(ax, ay) || 1;
      const fl = f.len * (f.butterfly ? 0.3 : 0.22);
      g.fillStyle = fill;
      for (const side of [1, -1]) {
        const sx = bx + n[0] * o.W * 0.8 * side, sy = by + n[1] * o.W * 0.8 * side;
        const ang = Math.atan2(n[1] * side, n[0] * side) + (Math.atan2(ay, ax) - Math.atan2(n[1] * side, n[0] * side)) * (0.45 + flap * side * 0.5);
        const tx = sx + Math.cos(ang) * fl, ty = sy + Math.sin(ang) * fl;
        g.beginPath();
        g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + Math.cos(ang - 0.6) * fl * 0.9, sy + Math.sin(ang - 0.6) * fl * 0.9, tx, ty);
        g.quadraticCurveTo(sx + Math.cos(ang + 0.5) * fl * 0.6, sy + Math.sin(ang + 0.5) * fl * 0.6, sx + ax / al * fl * 0.2, sy + ay / al * fl * 0.2);
        g.closePath();
        g.fill();
      }
      // Caudal fin: two lobes trailing the last segment, lagging the wave.
      const t0 = pts[N], t1 = pts[N - 1];
      const ta = Math.atan2(t0[1] - t1[1], t0[0] - t1[0]) + 0.35 * Math.sin(f.phase * 2.2 - 5.0);
      const cl = f.len * (f.butterfly ? 0.42 : 0.3);
      g.beginPath();
      g.moveTo(t0[0] - Math.cos(ta) * 3, t0[1] - Math.sin(ta) * 3);
      for (const sgn of [1, -1]) {
        const la = ta + sgn * 0.42;
        g.quadraticCurveTo(t0[0] + Math.cos(ta + sgn * 0.15) * cl * 0.5, t0[1] + Math.sin(ta + sgn * 0.15) * cl * 0.5,
          t0[0] + Math.cos(la) * cl, t0[1] + Math.sin(la) * cl);
        g.lineTo(t0[0] + Math.cos(ta) * cl * 0.62, t0[1] + Math.sin(ta) * cl * 0.62);
      }
      g.closePath();
      g.fill();
    },

    drawFish(g, f, light, clarity) {
      const pts = this.spine(f);
      const o = this.outline(f, pts);
      const V = VARIETIES[f.variety];
      // Deeper fish sit behind more water: pull their colours toward the tint.
      const tintRGB = light.tint.map((c) => c * 255 * (light.dark ? 0.5 : 0.9));
      const k = f.depth * (0.35 - 0.15 * clarity) + (light.dark ? 0.25 : 0);
      const dim = light.dark ? 0.55 : 1;
      const col = (key) => mixRGB(COL[key], tintRGB, k).map((c) => c * dim);
      const base = col(V.base);
      this.fins(g, f, pts, o, css(mixRGB(base, [255, 255, 255], 0.25), 0.55));
      g.save();
      this.bodyPath(g, o, pts);
      g.fillStyle = css(base);
      g.fill();
      g.clip();
      const N = pts.length - 1;
      for (const pa of V.patches) {
        const fi = pa[0] * N, i0 = Math.floor(fi), i1 = Math.min(N, i0 + 1), fr = fi - i0;
        const px = pts[i0][0] + (pts[i1][0] - pts[i0][0]) * fr, py = pts[i0][1] + (pts[i1][1] - pts[i0][1]) * fr;
        const n = o.nrm[i0];
        const wob = 0.85 + 0.15 * Math.sin(f.ox * 3 + pa[0] * 17);
        const cx = px + n[0] * pa[1] * o.W * 0.6, cy = py + n[1] * pa[1] * o.W * 0.6;
        g.fillStyle = css(col(pa[3]));
        g.beginPath();
        const ang = Math.atan2(pts[i1][1] - pts[i0][1], pts[i1][0] - pts[i0][0]);
        g.ellipse(cx, cy, pa[2] * o.W * 1.4 * wob, pa[2] * o.W * 0.95, ang, 0, Math.PI * 2);
        g.fill();
      }
      // Matte form shading: a lit ridge along the back, darker flanks.
      g.lineCap = 'round';
      g.strokeStyle = light.dark ? 'rgba(200,215,240,0.10)' : 'rgba(255,250,235,0.20)';
      g.lineWidth = o.W * 0.7;
      g.beginPath();
      g.moveTo(pts[1][0], pts[1][1]);
      for (let i = 2; i <= Math.round(N * 0.75); i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
      g.restore();
      g.lineWidth = o.W * 0.22;
      g.strokeStyle = 'rgba(20,30,28,0.22)';
      this.bodyPath(g, o, pts);
      g.stroke();
      // Eyes, just at the edge of the head.
      g.fillStyle = 'rgba(15,15,15,0.85)';
      const n0 = o.nrm[1];
      for (const side of [1, -1]) {
        g.beginPath();
        g.arc(pts[1][0] - (pts[1][0] - pts[0][0]) * 0.2 + n0[0] * o.W * 0.62 * side,
          pts[1][1] - (pts[1][1] - pts[0][1]) * 0.2 + n0[1] * o.W * 0.62 * side, o.W * 0.12, 0, Math.PI * 2);
        g.fill();
      }
      f._pts = pts; f._o = o;
    },

    silhouette(g, f, dx, dy) {
      const pts = f._pts.map((q) => [q[0] + dx, q[1] + dy]);
      const o = { L: f._o.L.map((q) => [q[0] + dx, q[1] + dy]), R: f._o.R.map((q) => [q[0] + dx, q[1] + dy]), nrm: f._o.nrm, W: f._o.W };
      this.fins(g, f, pts, o, 'rgba(0,0,0,0.7)');
      g.fillStyle = '#000';
      this.bodyPath(g, o, pts);
      g.fill();
    },

    padPath(g, pd) {
      g.beginPath();
      g.moveTo(pd.x, pd.y);
      g.arc(pd.x, pd.y, pd.r, pd.rot + 0.2, pd.rot + Math.PI * 2 - 0.2);
      g.closePath();
    },

    // ---- draw -------------------------------------------------------------
    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.fish || this.W !== ctx.width || this.H !== ctx.height) {
        const keep = this.fish;
        this.init(ctx);
        if (keep) this.fish = keep;
      }
      const W = ctx.width, H = ctx.height;
      const dt = 1 / 60;
      this.t += dt;
      const t = this.t;
      const react = params.react;
      const light = LIGHTS[Math.round(params.light)] || LIGHTS[0];

      // ---- listen
      const env = this.env;
      for (let b = 0; b < 9; b++) {
        const s = signals[b] / 100;
        env[b] += (s - env[b]) * (s > env[b] ? 0.3 : 0.06);
      }
      const prev = this.prev;
      const minPrev = (b) => { let m = 999; for (const f of prev) m = Math.min(m, f[b]); return prev.length ? m : 0; };
      const s0 = signals[0], s1 = signals[1], s4 = signals[4];
      // Kick: band 0 jumps and leads band 1 (a bass note sits under band 1).
      const kick = s0 >= 36 && s0 >= s1 - 4 && s0 - minPrev(0) >= 25 && t - this.lastKick > 0.25;
      const snare = s4 >= 50 && s4 - minPrev(4) >= 20 && t - this.lastSnare > 0.18;
      // Hats: in the drop only, each open hat is a fine raindrop somewhere on
      // the pond — a light shower that stops when the breakdown exhales.
      const s8 = signals[8];
      if (this.drive > 0.5 && s8 >= 45 && s8 - minPrev(3) >= 25 && t - (this.lastHat || 0) > 0.12 && react > 0) {
        this.lastHat = t;
        this.ripples.push({ x: Math.random() * W, y: Math.random() * H, age: 0, amp: 0.9 * react * this.drive, rain: true });
      }
      prev.push([s0, s1, s4, s8]); if (prev.length > 3) prev.shift();
      this.bassSlow += ((s0 + s1) / 200 - this.bassSlow) * 0.035;
      const bass = Math.max(env[1], env[2] * 0.8);
      const hats = clamp01((env[6] + env[7] + env[8]) / 3 * 1.6);
      const shoalMode = Math.round(params.shoal);
      const driveT = shoalMode === 1 ? 1 : shoalMode === 2 ? 0 : smooth(0.2, 0.36, this.bassSlow);
      this.drive += (driveT - this.drive) * (driveT > this.drive ? 0.05 : 0.012);
      const drive = this.drive;

      // The drop point wanders slowly so consecutive drops land near each
      // other and their rings interfere, then the cluster moves on.
      const dp = this.dropPt;
      dp.x = W * (0.5 + 0.33 * Math.sin(t * 0.071 + 1.0) + 0.08 * Math.sin(t * 0.23));
      dp.y = H * (0.5 + 0.3 * Math.sin(t * 0.093 + 2.3) + 0.08 * Math.cos(t * 0.19));

      if (kick) {
        this.lastKick = t; this.kicks++;
        const a = Math.random() * 6.28, r = Math.random() * 45;
        const x = dp.x + Math.cos(a) * r, y = dp.y + Math.sin(a) * r;
        this.ripples.push({ x, y, age: 0, amp: (1.8 + 2.0 * s0 / 100) * react });
        // The splash: a crown of droplets thrown out from the impact point.
        if (react > 0) {
          const nd = 14 + Math.floor(Math.random() * 5);
          for (let k = 0; k < nd; k++) {
            const a2 = (k / nd) * 6.28 + Math.random() * 0.5, v = (90 + Math.random() * 110) * Math.min(1.5, react);
            this.splash.push({ x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, z: 0, vz: 90 + Math.random() * 70, s: 2.4 + Math.random() * 2.4 });
          }
        }
        if (this.kicks % 4 === 0 && params.petals > 0) {
          const pt = this.makePetal(x, y, Math.random);
          pt.fall = 1;
          this.petals.push(pt);
        }
      }
      if (this.stoneReq) {
        this.stoneReq = false;
        this.ripples.push({ x: W / 2, y: H / 2, age: 0, amp: 5 });
      }
      if (snare && react > 0) {
        this.lastSnare = t;
        const n = Math.round(params.count);
        const f = this.fish[this.dartIdx++ % n];
        this.dartFish(f, react);
        const tail = f._pts ? f._pts[f._pts.length - 1] : [f.x, f.y];
        this.ripples.push({ x: tail[0], y: tail[1], age: 0, amp: 0.8 * react });
      }
      if (this.scatterReq) {
        this.scatterReq = false;
        this.fish.forEach((f) => this.dartFish(f, 1.2));
      }
      for (const r of this.ripples) r.age += dt;
      this.ripples = this.ripples.filter((r) => r.age < (r.rain ? 1.6 : 4.5));
      while (this.ripples.length > MAX_RIP) this.ripples.shift();

      // ---- swim
      const pace = params.speed * (22 + 70 * bass * (0.4 + 0.6 * react) + 12 * drive);
      this.swimT += dt * (0.5 + pace / 45);
      const n = Math.round(params.count);
      for (let i = 0; i < n; i++) {
        const f = this.fish[i];
        const st = this.swimT;
        // Each fish follows its own slow Lissajous target, so they circle
        // and cross rather than wander at random.
        const tx = W * (0.5 + 0.4 * Math.sin(st * f.wx + f.ox));
        const ty = H * (0.5 + 0.38 * Math.sin(st * f.wy + f.oy));
        this.steer(f, tx, ty, pace * (0.8 + 0.25 * Math.sin(f.ox + st * 0.3)), dt, 1.4);
      }
      // Shoal: a leader circles the pond on a fixed orbit all the time; the
      // shoal's targets are that formation pushed radially out past the edge
      // by (1 - drive), so the drop pulls them in from the nearest bank and
      // the breakdown lets them swim back out, circling as they go.
      const Ld = this.leader;
      const rx = W * 0.34, ry = H * 0.3;
      const lsp = params.speed * (105 + 90 * bass);
      Ld.ang += dt * lsp / ((rx + ry) / 2);
      Ld.x = W / 2 + Math.cos(Ld.ang) * rx; Ld.y = H / 2 + Math.sin(Ld.ang) * ry;
      Ld.h = Math.atan2(Math.cos(Ld.ang) * ry, -Math.sin(Ld.ang) * rx);
      const shoalOn = drive > 0.01 || this.shoal.some((f) => f.x > -80 && f.x < W + 80 && f.y > -80 && f.y < H + 80);
      const push = Math.max(W, H) * 0.75 * (1 - smooth(0.05, 0.8, drive));
      const ch = Math.cos(Ld.h), sh = Math.sin(Ld.h);
      for (const f of this.shoal) {
        let tx = Ld.x + ch * f.slot[0] - sh * f.slot[1] + 10 * Math.sin(t * 0.7 + f.ox);
        let ty = Ld.y + sh * f.slot[0] + ch * f.slot[1] + 10 * Math.cos(t * 0.6 + f.oy);
        const ox = tx - W / 2, oy = ty - H / 2, ol = Math.hypot(ox, oy) || 1;
        tx += ox / ol * push; ty += oy / ol * push;
        if (!shoalOn) { f.x = tx; f.y = ty; f.h = Ld.h; continue; }
        const d = Math.hypot(tx - f.x, ty - f.y);
        this.steer(f, tx, ty, lsp * (0.8 + clamp01(d / 90) * 1.8), dt, 3.2);
      }

      // ---- surface drift
      const cur = { x: 4 + 3 * Math.sin(t * 0.05), y: 1.5 * Math.cos(t * 0.07) };
      const nPads = Math.round(params.pads);
      const mg = 90;
      for (let i = 0; i < nPads; i++) {
        const pd = this.pads[i];
        pd.x += cur.x * dt * 0.6; pd.y += cur.y * dt * 0.6; pd.rot += pd.vr * dt;
        if (pd.x > W + mg) pd.x -= W + 2 * mg;
        if (pd.y > H + mg) pd.y -= H + 2 * mg; if (pd.y < -mg) pd.y += H + 2 * mg;
      }
      const maxPetals = Math.round(8 + 50 * params.petals);
      for (const pt of this.petals) {
        pt.age += dt;
        pt.fall = Math.max(0, pt.fall - dt * 1.6);
        let px = cur.x, py = cur.y;
        // A passing ripple front nudges a petal outward.
        for (const r of this.ripples) {
          const dx = pt.x - r.x, dy = pt.y - r.y, d = Math.hypot(dx, dy) || 1;
          const x = d - r.age * 150;
          if (Math.abs(x) < 30) { const k = r.amp * 14 * Math.exp(-r.age) * (1 - Math.abs(x) / 30); px += dx / d * k; py += dy / d * k; }
        }
        pt.vx += (px - pt.vx) * 0.08; pt.vy += (py - pt.vy) * 0.08;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
        if (pt.x > W + 20) pt.x -= W + 40; if (pt.x < -20) pt.x += W + 40;
        if (pt.y > H + 20) pt.y -= H + 40; if (pt.y < -20) pt.y += H + 40;
      }
      while (this.petals.length > maxPetals) this.petals.shift();

      // ---- offscreen layers
      const dpr = p.pixelDensity();
      let dw = Math.round(p.width * dpr), dh = Math.round(p.height * dpr);
      const cap = 2560 / Math.max(dw, dh);
      if (cap < 1) { dw = Math.round(dw * cap); dh = Math.round(dh * cap); }
      if (!this.fishCanvas) {
        this.fishCanvas = document.createElement('canvas');
        this.shadowCanvas = document.createElement('canvas');
      }
      const fc = this.fishCanvas, sc = this.shadowCanvas;
      if (fc.width !== dw || fc.height !== dh) { fc.width = dw; fc.height = dh; }
      const sw = Math.max(16, Math.round(dw / 6)), shh = Math.max(16, Math.round(dh / 6));
      if (sc.width !== sw || sc.height !== shh) { sc.width = sw; sc.height = shh; }
      const g = fc.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, dw, dh);
      g.setTransform(dw / W, 0, 0, dh / H, 0, 0);
      const all = this.fish.slice(0, n).concat(shoalOn ? this.shoal : []);
      all.sort((a, b) => b.depth - a.depth);
      for (const f of all) this.drawFish(g, f, light, params.clarity);

      const s = sc.getContext('2d');
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, sw, shh);
      s.setTransform(sw / W, 0, 0, shh / H, 0, 0);
      const sd = light.dir;
      for (const f of all) {
        const off = 14 + 30 * (1 - f.depth);
        this.silhouette(s, f, sd[0] * off, sd[1] * off);
      }
      s.fillStyle = '#000';
      for (let i = 0; i < nPads; i++) {
        const pd = this.pads[i];
        this.padPath(s, { x: pd.x + sd[0] * 60, y: pd.y + sd[1] * 60, r: pd.r, rot: pd.rot });
        s.fill();
      }
      s.globalAlpha = 0.8;
      for (const pt of this.petals) {
        const off = 60 + pt.fall * 70;
        s.beginPath(); s.ellipse(pt.x + sd[0] * off, pt.y + sd[1] * off, pt.s, pt.s * 0.7, pt.rot, 0, 6.29); s.fill();
      }
      s.globalAlpha = 1;

      // ---- the pond
      if (!this.gl && !this.glFailed) this.initGL();
      const dc = p.drawingContext;
      if (this.gl) {
        const gl = this.gl;
        if (this.glCanvas.width !== dw || this.glCanvas.height !== dh) { this.glCanvas.width = dw; this.glCanvas.height = dh; }
        gl.viewport(0, 0, dw, dh);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texShadow);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texFish);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fc);
        const u = this.u, rb = this.ripBuf;
        rb.fill(0);
        const rs = this.ripples.slice(-MAX_RIP);
        rs.forEach((r, i) => { rb[i * 4] = r.x; rb[i * 4 + 1] = r.y; rb[i * 4 + 2] = r.age; rb[i * 4 + 3] = r.amp; });
        gl.uniform4fv(u.rip, rb);
        gl.uniform1i(u.ripN, rs.length);
        gl.uniform2f(u.res, W, H);
        gl.uniform1f(u.time, t);
        gl.uniform1f(u.hats, hats * Math.min(1, react));
        gl.uniform1f(u.clarity, params.clarity);
        gl.uniform1f(u.chop, 0.35 + 0.25 * drive);
        gl.uniform3fv(u.sunCol, light.sun);
        gl.uniform3fv(u.sandCol, light.sand);
        gl.uniform3fv(u.waterTint, light.tint);
        gl.uniform3fv(u.skyCol, light.sky);
        gl.uniform1f(u.causticGain, light.caustic);
        gl.uniform1f(u.shadowGain, light.shadow);
        gl.uniform1f(u.glintGain, light.glint);
        gl.uniform2f(u.sunDir2, light.dir[0], light.dir[1]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        dc.drawImage(this.glCanvas, 0, 0, W, H);
      } else {
        // No WebGL2: a flat pond with the fish on it rather than nothing.
        dc.fillStyle = light.dark ? '#16222c' : '#8fae9c';
        dc.fillRect(0, 0, W, H);
        dc.drawImage(fc, 0, 0, W, H);
      }

      // ---- the surface: pads, lotus, petals
      dc.save();
      dc.globalCompositeOperation = 'source-over';
      dc.globalAlpha = 1;
      const ps = light.padShade;
      for (let i = 0; i < nPads; i++) {
        const pd = this.pads[i];
        const gcol = mixRGB([62, 104, 52], [104, 132, 58], pd.shade).map((c) => c * ps);
        this.padPath(dc, pd);
        dc.fillStyle = css(gcol);
        dc.fill();
        // Veins radiate from the notch point; the rim turns up and catches light.
        dc.strokeStyle = css(mixRGB(gcol, [200, 220, 150], 0.25), 0.55);
        dc.lineWidth = 0.9;
        dc.beginPath();
        for (let k = 1; k < 14; k++) {
          const a = pd.rot + 0.2 + (k / 14) * (Math.PI * 2 - 0.4);
          dc.moveTo(pd.x + Math.cos(a) * pd.r * 0.08, pd.y + Math.sin(a) * pd.r * 0.08);
          dc.lineTo(pd.x + Math.cos(a) * pd.r * 0.9, pd.y + Math.sin(a) * pd.r * 0.9);
        }
        dc.stroke();
        dc.strokeStyle = css(mixRGB(gcol, [20, 40, 20], 0.4), 0.9);
        dc.lineWidth = 2.2;
        this.padPath(dc, pd);
        dc.stroke();
        if (pd.lotus) this.drawLotus(dc, pd, t, env, light, pd.lotus === 2);
      }
      // Splash droplets: they rise and fall back in a quarter second, lit on
      // top and shaded underneath like beads of water rather than sparks.
      for (const d of this.splash) {
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 900 * dt;
        const r = d.s * (1 + d.z * 0.02);
        dc.fillStyle = light.dark ? 'rgba(150,170,200,0.55)' : 'rgba(40,70,70,0.25)';
        dc.beginPath(); dc.arc(d.x + light.dir[0] * d.z * 0.6, d.y + light.dir[1] * d.z * 0.6, r, 0, 6.29); dc.fill();
        dc.fillStyle = light.dark ? 'rgba(210,225,245,0.85)' : 'rgba(250,252,245,0.92)';
        dc.beginPath(); dc.arc(d.x, d.y - d.z * 0.3, r, 0, 6.29); dc.fill();
      }
      this.splash = this.splash.filter((d) => d.z >= 0);
      for (const pt of this.petals) {
        const sc2 = 1 + pt.fall * 0.9;
        dc.save();
        dc.translate(pt.x, pt.y);
        dc.rotate(pt.rot);
        dc.scale(sc2, sc2);
        const pc = mixRGB([248, 226, 230], [236, 176, 192], pt.tone).map((c) => c * (light.dark ? 0.6 : 1));
        dc.fillStyle = css(pc);
        dc.beginPath();
        dc.moveTo(-pt.s, 0);
        dc.quadraticCurveTo(-pt.s * 0.3, -pt.s * 0.9, pt.s * 0.8, -pt.s * 0.35);
        dc.lineTo(pt.s * 0.55, 0);
        dc.lineTo(pt.s * 0.8, pt.s * 0.35);
        dc.quadraticCurveTo(-pt.s * 0.3, pt.s * 0.9, -pt.s, 0);
        dc.fill();
        dc.fillStyle = 'rgba(200,110,130,0.35)';
        dc.beginPath(); dc.ellipse(-pt.s * 0.65, 0, pt.s * 0.3, pt.s * 0.2, 0, 0, 6.29); dc.fill();
        dc.restore();
      }
      dc.restore();
    },

    drawLotus(dc, pd, t, env, light, open) {
      const cx = pd.x + Math.cos(pd.rot + Math.PI) * pd.r * 0.15, cy = pd.y + Math.sin(pd.rot + Math.PI) * pd.r * 0.15;
      const R = open ? 30 : 12;
      const breathe = 1 + 0.05 * Math.sin(t * 0.8) + 0.08 * env[3];
      const dim = light.dark ? 0.6 : 1;
      const layers = open ? [[10, 1.0, 0], [9, 0.78, 0.3], [7, 0.55, 0.1]] : [[5, 1, 0]];
      for (const [cnt, rs, off] of layers) {
        for (let k = 0; k < cnt; k++) {
          const a = pd.rot * 0.3 + off + (k / cnt) * Math.PI * 2;
          const len = R * rs * breathe;
          const tip = mixRGB([246, 214, 222], [218, 104, 140], rs * 0.8).map((c) => c * dim);
          dc.save();
          dc.translate(cx, cy); dc.rotate(a);
          dc.fillStyle = css(tip);
          dc.beginPath();
          dc.moveTo(0, 0);
          dc.quadraticCurveTo(len * 0.5, -len * 0.33, len, 0);
          dc.quadraticCurveTo(len * 0.5, len * 0.33, 0, 0);
          dc.fill();
          dc.strokeStyle = css(mixRGB(tip, [120, 40, 70], 0.4), 0.5);
          dc.lineWidth = 0.7;
          dc.stroke();
          dc.restore();
        }
      }
      if (open) {
        dc.fillStyle = css([232 * dim, 196 * dim, 70 * dim]);
        dc.beginPath(); dc.arc(cx, cy, R * 0.2, 0, 6.29); dc.fill();
        dc.fillStyle = css([150 * dim, 150 * dim, 60 * dim]);
        for (let k = 0; k < 7; k++) { const a = k * 0.9; dc.beginPath(); dc.arc(cx + Math.cos(a) * R * 0.1, cy + Math.sin(a) * R * 0.1, 1.1, 0, 6.29); dc.fill(); }
      }
    },
  });
})();
