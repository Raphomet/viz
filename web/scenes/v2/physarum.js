// Physarum V2 — the same Jones (2010) slime-mould model as V1, restaged after
// the six-judge panel. The organism is unchanged; its finish, its kick and its
// drop are not.
//
// One ink, no bloom. V1's two-species drop added a magenta colony, and its
// quarter-res bloom fogged the filaments (curator: "a second idea it doesn't
// need"; purist: "slime mould looks best as sharp filaments"). Here there is
// one species, and the sharp trail goes through a three-stop tone curve per
// palette (ground -> ink -> pale core), so the busiest trunks read brighter
// and bolder rather than hazier. The only blur left is the deep stratum below
// the network, which is there for parallax, not glow.
//
// The drop is a change of state, not a second colour: food nodes laid in the
// drop persist and pour scent into the trail, the unfed lace decays faster,
// and the colony contracts into thick transport trunks between the amber nodes
// (what real Physarum does between oat flakes). The breakdown lets the nodes be
// eaten and the lace regrows. A slow second channel (trail G) records where the
// drop's roads were; it fades over ~30 s and the agents lightly prefer it, so
// the breakdown's lace grows along the ghost of the last drop.
//
// Trail texture: RGBA16F at the virtual stage size. R = live trail, G = road
// memory. G fades by subtraction, not multiplication: a x0.9995 per-frame decay
// rounds back to the same half-float value near 1 and never falls.
//
// Kick: amber node + a ring that runs outward along the veins only (the floor
// judge could not find V1's kick from the back of the room). In the drop, once
// the constellation is built, kicks land on existing nodes in turn instead of
// adding new ones, so the beat hops around the network it has made. Snare: a
// pale pulse from every living node at once, which in the drop runs down the
// roads between them.

(function () {
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ground, ink, core: the tone ramp. food: the one accent (nodes and kick
  // ring). pulse: snare light. deep: what the lower stratum mixes toward.
  // sheath: the road-memory tint. light: daylight palettes darken for glints.
  const PALETTES = [
    { name: 'Abyssal', ground: [0.006, 0.014, 0.03], ink: [0.05, 0.62, 0.58], core: [0.72, 1.0, 0.92], food: [1.0, 0.62, 0.2], pulse: [0.85, 1.0, 0.95], deep: [0.03, 0.10, 0.16], sheath: [0.02, 0.16, 0.18], light: 0 },
    { name: 'Agar', ground: [0.86, 0.80, 0.64], ink: [0.96, 0.72, 0.04], core: [0.70, 0.36, 0.02], food: [0.62, 0.12, 0.08], pulse: [1.0, 0.95, 0.6], deep: [0.74, 0.66, 0.50], sheath: [0.80, 0.68, 0.42], light: 1 },
    { name: 'Ember', ground: [0.025, 0.012, 0.01], ink: [0.72, 0.30, 0.10], core: [1.0, 0.80, 0.52], food: [0.45, 0.92, 1.0], pulse: [1.0, 0.92, 0.78], deep: [0.14, 0.04, 0.03], sheath: [0.18, 0.06, 0.03], light: 0 },
    { name: 'Ice', ground: [0.008, 0.012, 0.03], ink: [0.28, 0.46, 0.85], core: [0.88, 0.95, 1.0], food: [1.0, 0.40, 0.48], pulse: [0.9, 0.97, 1.0], deep: [0.05, 0.07, 0.18], sheath: [0.06, 0.09, 0.22], light: 0 },
  ];

  const COLS = 1024;          // agent texture width
  const NFOOD = 8;
  const NRING = 4;            // kick rings
  const NPULSE = 8;           // snare pulses (one per living node)
  const ROAD_NODES = 5;       // size of the drop's constellation

  const VS_QUAD = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const COMMON = `
uint hashU(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float hash3(uvec3 v) { return float(hashU(v.x ^ hashU(v.y ^ hashU(v.z)))) / 4294967295.0; }
vec2 wrapD(vec2 d, vec2 sim) { return d - sim * floor(d / sim + 0.5); }
`;

  // Agent step: Jones's sense / turn / step, plus a linearised food field and a
  // light preference for remembered roads.
  const FS_UPDATE = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform sampler2D uTrail;
uniform vec2 uSim;
uniform float uSA, uRA, uSD, uSpeed, uJitter, uMemW;
uniform uint uFrame;
uniform vec4 uFood[${NFOOD}];   // x, y, radius, pull
uniform vec4 uSpawn;             // x, y, fraction, spoke phase
uniform float uRespawn;
out vec4 o;
${COMMON}
float sense(vec2 p) {
  vec4 t = texture(uTrail, p / uSim);
  return t.r + uMemW * t.g;
}
// Food attraction, linearised: the value at each sensor is taken from the
// field's gradient at the agent, so the food exps run once per agent, not once
// per sensor (the sensors are ~10 px apart; the food blobs ~100 px wide).
vec2 foodGrad(vec2 p) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${NFOOD}; i++) {
    vec4 f = uFood[i];
    if (f.w <= 0.0) continue;
    vec2 d = wrapD(f.xy - p, uSim);
    float r2 = f.z * f.z;
    g += d * (2.0 * f.w / r2) * exp(-dot(d, d) / r2);
  }
  return g;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uState, c, 0);
  vec2 pos = s.xy; float ang = s.z;
  uvec3 key = uvec3(uint(c.x), uint(c.y), uFrame);
  float r0 = hash3(key);
  float r1 = hash3(key + uvec3(17u, 91u, 7u));
  float r2 = hash3(key + uvec3(3u, 5u, 101u));

  // Kick: a small fraction of agents is thrown into the new node along seven
  // spokes (a full ring closes into a persistent loop; spokes sprout).
  if (uSpawn.z > 0.0 && r0 < uSpawn.z) {
    float a = (floor(r1 * 7.0) + uSpawn.w) * 0.8975979 + (r2 - 0.5) * 0.12;
    pos = uSpawn.xy + vec2(cos(a), sin(a)) * (2.0 + 6.0 * r2);
    o = vec4(mod(pos, uSim), a, 0.0);
    return;
  }
  // A trickle of respawns keeps unexplored ground from staying dead.
  if (r2 < uRespawn) {
    o = vec4(vec2(r0, r1) * uSim, r0 * 40.0, 0.0);
    return;
  }

  vec2 df = vec2(cos(ang), sin(ang));
  vec2 dl = vec2(cos(ang + uSA), sin(ang + uSA));
  vec2 dr = vec2(cos(ang - uSA), sin(ang - uSA));
  vec2 fg = foodGrad(pos) * uSD;
  float F = sense(pos + df * uSD) + dot(fg, df);
  float L = sense(pos + dl * uSD) + dot(fg, dl);
  float R = sense(pos + dr * uSD) + dot(fg, dr);
  if (F > L && F > R) {
  } else if (F < L && F < R) {
    ang += (r0 < 0.5 ? uRA : -uRA);
  } else if (L > R) {
    ang += uRA;
  } else if (R > L) {
    ang -= uRA;
  }
  ang += (r1 - 0.5) * uJitter;
  pos += vec2(cos(ang), sin(ang)) * uSpeed;
  o = vec4(mod(pos, uSim), mod(ang, 6.2831853), 0.0);
}`;

  const VS_DEPOSIT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform vec2 uSim;
void main() {
  ivec2 c = ivec2(gl_VertexID % ${COLS}, gl_VertexID / ${COLS});
  vec4 s = texelFetch(uState, c, 0);
  gl_Position = vec4(s.xy / uSim * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

  const FS_DEPOSIT = `#version 300 es
precision highp float;
uniform float uDep;
out vec4 o;
void main() { o = vec4(uDep, 0.0, 0.0, 0.0); }`;

  // Diffuse + decay the live trail; food nodes leak scent into it. The road
  // memory (G) is written where the live trail is dense while uRoad is up,
  // barely diffuses, and fades linearly.
  const FS_DIFFUSE = `#version 300 es
precision highp float;
uniform sampler2D uTrail;
uniform vec2 uSim;
uniform float uDecay, uDiffuse, uRoad, uMemFade;
uniform vec4 uFood[${NFOOD}];
uniform float uFoodScent;
out vec4 o;
${COMMON}
void main() {
  vec2 px = 1.0 / uSim;
  vec2 uv = gl_FragCoord.xy * px;
  vec4 c = texture(uTrail, uv);
  vec4 b = c * 4.0;
  b += 2.0 * (texture(uTrail, uv + vec2(px.x, 0.0)) + texture(uTrail, uv - vec2(px.x, 0.0))
            + texture(uTrail, uv + vec2(0.0, px.y)) + texture(uTrail, uv - vec2(0.0, px.y)));
  b += texture(uTrail, uv + px) + texture(uTrail, uv - px)
     + texture(uTrail, uv + vec2(px.x, -px.y)) + texture(uTrail, uv + vec2(-px.x, px.y));
  b /= 16.0;
  float r = mix(c.r, b.r, uDiffuse) * uDecay;
  float food = 0.0;
  for (int i = 0; i < ${NFOOD}; i++) {
    vec4 f = uFood[i];
    if (f.w <= 0.0) continue;
    vec2 d = wrapD(gl_FragCoord.xy - f.xy, uSim);
    food += f.w * exp(-dot(d, d) / 64.0);
  }
  r += food * uFoodScent;
  float g = mix(c.g, b.g, 0.12);
  g += uRoad * smoothstep(3.0, 9.0, r) * 0.012;
  g = max(0.0, g - uMemFade);
  o = vec4(clamp(r, 0.0, 400.0), min(g, 1.0), 0.0, 0.0);
}`;

  // Quarter-res blur, used only for the deep stratum.
  const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcSize;
uniform vec2 uDstSize;
uniform float uStep;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uDstSize;
  vec2 s = uStep / uSrcSize;
  vec4 a = texture(uSrc, uv) * 4.0;
  a += 2.0 * (texture(uSrc, uv + vec2(s.x, 0.0)) + texture(uSrc, uv - vec2(s.x, 0.0))
            + texture(uSrc, uv + vec2(0.0, s.y)) + texture(uSrc, uv - vec2(0.0, s.y)));
  a += texture(uSrc, uv + s) + texture(uSrc, uv - s)
     + texture(uSrc, uv + vec2(s.x, -s.y)) + texture(uSrc, uv + vec2(-s.x, s.y));
  o = a / 16.0;
}`;

  const FS_DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D uTrail;
uniform sampler2D uDeepTex;
uniform vec2 uRes, uSim, uCam;
uniform float uTime, uGain, uHats, uPad, uLight, uSheathW;
uniform vec3 uGround, uInk, uCore, uFoodCol, uPulseCol, uDeep, uSheath;
uniform vec4 uFoodV[${NFOOD}];   // x, y, age (s), life (0..1)
uniform vec4 uRing[${NRING}];    // x, y, age (s), strength
uniform vec4 uPulse[${NPULSE}];  // x, y, age (s), strength
uniform vec2 uSpore;
uniform uint uSparkFrame;
out vec4 o;
${COMMON}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 simP = frag / uRes * uSim;
  vec2 sp = simP + uCam;
  vec2 uv = sp / uSim;

  vec2 cn = frag / uRes - 0.5;
  cn.x *= uRes.x / uRes.y;
  float vig = 1.0 - smoothstep(0.4, 1.1, length(cn));

  // Deep stratum: the same network, defocused, at half scale and 0.45x the
  // camera speed, far below. Parallax against it is where depth comes from.
  vec2 dq = (simP - 0.5 * uSim) * 0.5 + 0.5 * uSim + uCam * 0.45 + vec2(311.0, 173.0);
  float dg = texture(uDeepTex, dq / uSim).r;
  float deep = 1.0 - exp(-dg * uGain * 0.5);
  vec3 col = mix(uGround, uDeep, deep * (0.55 + 0.25 * uPad));

  vec2 t = texture(uTrail, uv).rg;

  // Road memory: a faint sheath under where the last drop's trunks ran.
  col = mix(col, uSheath, smoothstep(0.05, 0.8, t.g) * uSheathW);

  // The tone ramp: ground -> ink across a vein's edge, ink -> pale core in the
  // densest trunks. Steep at the edge so a vein reads as a solid line from
  // across a room, not a gaussian.
  float v = 1.0 - exp(-t.r * uGain);
  float edge = smoothstep(0.10, 0.42, v);
  float hot = smoothstep(0.62, 0.97, v);
  col = mix(col, uInk, edge);
  col = mix(col, uCore, hot * 0.85);

  // Kick ring: runs outward along the veins only, in the accent colour.
  float ring = 0.0;
  for (int i = 0; i < ${NRING}; i++) {
    vec4 q = uRing[i];
    if (q.w <= 0.0) continue;
    float d = length(wrapD(sp - q.xy, uSim));
    float rad = 10.0 + 240.0 * q.z;
    float w = 11.0 + 16.0 * q.z;
    ring += q.w * 1.6 * exp(-pow((d - rad) / w, 2.0)) * exp(-q.z * 2.6);
  }
  // Snare: a pale wavefront from every node, also only on veins.
  float pulse = 0.0;
  for (int i = 0; i < ${NPULSE}; i++) {
    vec4 q = uPulse[i];
    if (q.w <= 0.0) continue;
    float d = length(wrapD(sp - q.xy, uSim));
    float rad = q.z * 380.0;
    float w = 12.0 + 18.0 * q.z;
    pulse += q.w * exp(-pow((d - rad) / w, 2.0)) * exp(-q.z * 2.6);
  }
  float onVein = smoothstep(0.05, 0.35, v);
  col = mix(col, uFoodCol, clamp(ring * onVein, 0.0, 1.0));
  col = mix(col, uPulseCol, clamp(pulse * onVein * 0.9, 0.0, 0.9));

  // Food nodes: a hard-edged nucleus that swells as it lands and shrinks as it
  // is eaten, with a thin outline, no halo.
  for (int i = 0; i < ${NFOOD}; i++) {
    vec4 f = uFoodV[i];
    if (f.w <= 0.0) continue;
    float d = length(wrapD(sp - f.xy, uSim));
    float land = exp(-f.z * 6.0);
    float r = 2.5 + 5.0 * f.w + 10.0 * land;
    float disk = 1.0 - smoothstep(r - 1.2, r + 0.6, d);
    float rim = exp(-pow((d - r - 4.0) / 1.4, 2.0)) * (0.35 + 0.65 * land) * f.w;
    col = mix(col, uFoodCol, clamp(disk * min(1.0, 0.4 + f.w + land) + rim, 0.0, 1.0));
    col = mix(col, mix(uFoodCol, vec3(1.0 - uLight), 0.6), disk * land * 0.8);
  }

  // Hats: sparse glints on the veins, reshuffled 20 times a second.
  uvec2 cell = uvec2(floor(sp / 2.0));
  float h = hash3(uvec3(cell, uSparkFrame));
  float spark = step(1.0 - 0.03 * uHats, h) * smoothstep(0.4, 0.75, v);
  col = mix(col, mix(uCore, vec3(1.0), 0.6), spark * 0.9);

  // Foreground spores: out-of-focus motes above the network, faster than it.
  vec2 fp = simP + uSpore;
  vec2 id = floor(fp / 90.0);
  vec2 lc = fract(fp / 90.0);
  uvec3 ik = uvec3(uvec2(ivec2(id) + 4096), 7u);
  float has = hash3(ik);
  if (has < 0.4) {
    vec2 c0 = vec2(hash3(ik + uvec3(0u, 0u, 1u)), hash3(ik + uvec3(0u, 0u, 2u))) * 0.7 + 0.15;
    float rad = mix(0.018, 0.045, hash3(ik + uvec3(0u, 0u, 3u)));
    float d = length(lc - c0);
    float disk = smoothstep(rad, rad * 0.5, d);
    float tw = 0.5 + 0.5 * sin(uTime * (1.3 + 2.0 * has) + has * 40.0);
    float b = (0.05 + 0.04 * tw) * (1.0 + 2.0 * uHats * tw);
    col = mix(col, mix(uCore, vec3(1.0 - uLight * 0.7), 0.4), disk * b);
  }

  col *= mix(0.8 + 0.2 * vig, 0.9 + 0.1 * vig, uLight);
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  VIZ.register({
    id: 'physarumv2',
    name: 'Physarum',
    versionOf: 'physarum',
    version: 'V2',
    order: 711,
    gallery: {
      title: 'Physarum',
      technique: 'WebGL2 agent simulation (Jones 2010): agent state in an RGBA32F texture stepped by a fragment shader, 1-px point deposits into an RGBA16F trail (R live trail, G road memory), 3x3 diffuse/decay, a three-stop tone ramp instead of bloom, one quarter-res blur for the deep parallax stratum, composited with drawImage',
      brief: 'A living lace of slime mould seen from above as we drift over it, in one ink with one accent. The bass bends the sensor angle (fine lace to coarse cells) and sets the drift speed; each kick lands an amber food node whose ring runs outward along the veins; the snare sends pale light from every node at once; hats glint on the veins. On the drop the mould stops exploring and commits: the drop\'s nodes persist and the lace contracts into thick transport trunks between them, and the breakdown lets it regrow along the ghost of those roads.',
      lineage: [
        'V1: Physarum (physarum, batch 03), unchanged at heart: Jones\'s sense/turn/step model, the linearised food field, the seven-spoke kick spawn, the food walk across the frame, the fixed virtual-size trail.',
        'Acted on the six-judge panel (2026-09-28): the curator\'s "the teal lace is beautiful on its own; the magenta invader is a second idea it doesn\'t need" (one species, one ink, amber food as the only accent); the purist\'s "the bloom is too heavy" and float-buffer-with-a-LUT transplant (bloom removed, tone ramp in its place); the floor\'s "no identifiable kick" and "lines thin at distance" (a kick ring that runs along the veins, a steep vein edge, a vein-weight control); the curator\'s drop-as-change-of-state theme and Knit\'s lasting trace (the drop builds transport roads that fade as a ghost through the breakdown); the psychonaut\'s bass-sets-speed transplant. Rejected: the director\'s love of the antagonist species, and light-age colouring (every vein is occupied, so age is uniform).',
        'Own idea: an Agar palette, yellow Physarum on a cream plate with rust food, the colour it really is in a petri dish: daylight, no glow at all.',
      ],
    },

    params: [
      { key: 'character', label: 'Vein character (lace ↔ cells)', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'roads', label: 'Drop builds roads', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'weight', label: 'Vein weight', type: 'range', min: 0.5, max: 2, default: 1, step: 0.01 },
      { key: 'memory', label: 'Trail memory', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'drift', label: 'Drift speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'agents', label: 'Agents (thousands)', type: 'range', min: 50, max: 1000, default: 300, step: 10 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'response', label: 'Music response', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'Regrow', run() { this.needSeed = true; } },
    ],

    gl: null,
    glCanvas: null,
    glFailed: false,
    needSeed: true,

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.env = new Float32Array(9);
      this.prev = new Float32Array(9);
      this.level = 0;          // slow drop detector
      this.road = 0;           // 0 exploring lace, 1 building roads
      this.afterRoad = 0;      // how recently roads were built: drives regrowth
      this.pad = 0;
      this.bassSlow = 0;
      this.cam = [0, 0];
      this.camAng = 0.6;
      this.spore = [0, 0];
      this.foods = [];
      this.rings = [];
      this.pulses = [];
      this.lastKick = -10;
      this.lastSnare = -10;
      this.kickN = 0;
      this.walk = null;
      this.spawn = null;
      this.frame = 0;
      this.needSeed = true;
    },

    // ---------------------------------------------------------------- GL
    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const program = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'pos');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const cache = {};
        return { pr, u: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(pr, n))) };
      };
      this.P = {
        update: program(VS_QUAD, FS_UPDATE),
        deposit: program(VS_DEPOSIT, FS_DEPOSIT),
        diffuse: program(VS_QUAD, FS_DIFFUSE),
        blur: program(VS_QUAD, FS_BLUR),
        display: program(VS_QUAD, FS_DISPLAY),
      };
      this.quadVao = gl.createVertexArray();
      gl.bindVertexArray(this.quadVao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.pointVao = gl.createVertexArray();
      gl.bindVertexArray(null);
      this.gl = gl;
      this.glCanvas = c;
    },

    makeTex(w, h, internal, format, type, filter, wrap, data) {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data || null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('physarum v2: framebuffer incomplete');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { t, fb, w, h };
    },

    freeTex(x) {
      if (!x) return;
      this.gl.deleteTexture(x.t);
      this.gl.deleteFramebuffer(x.fb);
    },

    // Trail textures follow the virtual stage size so the network's scale is
    // independent of the display's pixel count.
    ensureTrail(sw, sh) {
      const gl = this.gl;
      if (this.trail && this.trail[0].w === sw && this.trail[0].h === sh) return false;
      if (this.trail) this.trail.forEach((x) => this.freeTex(x));
      if (this.glow) this.glow.forEach((x) => this.freeTex(x));
      this.trail = [0, 1].map(() => this.makeTex(sw, sh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR, gl.REPEAT));
      const gw = Math.max(1, Math.round(sw / 4)), gh = Math.max(1, Math.round(sh / 4));
      this.glow = [0, 1].map(() => this.makeTex(gw, gh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR, gl.REPEAT));
      return true;
    },

    ensureAgents(count) {
      const gl = this.gl;
      const rows = Math.ceil(count / COLS);
      if (this.agents && this.agentRows === rows && !this.needSeed) return;
      if (this.agents) this.agents.forEach((x) => this.freeTex(x));
      const [sw, sh] = this.simSize;
      const data = new Float32Array(rows * COLS * 4);
      for (let i = 0; i < rows * COLS; i++) {
        data[i * 4] = Math.random() * sw;
        data[i * 4 + 1] = Math.random() * sh;
        data[i * 4 + 2] = Math.random() * TAU;
        data[i * 4 + 3] = 0;
      }
      this.agents = [0, 1].map((k) => this.makeTex(COLS, rows, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST, gl.CLAMP_TO_EDGE, k === 0 ? data : null));
      this.agentRows = rows;
      for (const tr of this.trail) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, tr.fb);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      this.needSeed = false;
    },

    // --------------------------------------------------------------- music
    listen(signals, t, dt) {
      for (let b = 0; b < 9; b++) {
        const s = signals[b] / 100;
        const e = this.env[b];
        this.env[b] = s > e ? e + (s - e) * 0.6 : e * Math.exp(-dt / 0.25);
      }
      const kickBand = signals[0], snareBand = signals[4];
      const kickRise = kickBand - this.prev[0], snareRise = snareBand - this.prev[4];
      const kick = kickBand > 32 && kickRise > 12 && t - this.lastKick > 0.2;
      const snare = snareBand > 30 && snareRise > 12 && t - this.lastSnare > 0.14;
      this.prev.set(signals);

      // The drop detector: slow in, slower out, on the low end.
      const low = Math.max(signals[0], signals[1]) / 100;
      const tau = low > this.level ? 1.0 : 3.0;
      this.level += (low - this.level) * (1 - Math.exp(-dt / tau));
      const padNow = (this.env[2] + this.env[3] + this.env[4]) / 3;
      this.pad += (padNow - this.pad) * (1 - Math.exp(-dt / 0.8));
      return { kick, snare };
    },

    // A food walk: each new node is a step on from the last in screen space, so
    // over a phrase the network is led on a winding path across the frame.
    newFood(t, sw, sh) {
      let x, y, h;
      if (!this.walk) {
        x = sw * (0.3 + 0.4 * Math.random()); y = sh * (0.3 + 0.4 * Math.random()); h = Math.random() * TAU;
      } else {
        h = this.walk.h + (Math.random() - 0.5) * 2.2;
        const step = 120 + 120 * Math.random();
        x = this.walk.x + Math.cos(h) * step; y = this.walk.y + Math.sin(h) * step;
        const mx = sw * 0.14, my = sh * 0.18;
        if (x < mx || x > sw - mx) { h = Math.PI - h; x = Math.max(mx, Math.min(sw - mx, x)); }
        if (y < my || y > sh - my) { h = -h; y = Math.max(my, Math.min(sh - my, y)); }
      }
      this.walk = { x, y, h };
      const simX = ((x + this.cam[0]) % sw + sw) % sw;
      const simY = ((y + this.cam[1]) % sh + sh) % sh;
      const f = { x: simX, y: simY, t0: t, eaten: 0, lastHit: t };
      this.foods.push(f);
      if (this.foods.length > NFOOD) this.foods.shift();
      this.spawn = [simX, simY, Math.random() * 7];
      return f;
    },

    kickAt(t, f, r) {
      this.rings.push({ x: f.x, y: f.y, t0: t, s: Math.min(1.3, 0.7 + 0.4 * r) });
      if (this.rings.length > NRING) this.rings.shift();
      f.lastHit = t;
    },

    // ---------------------------------------------------------------- draw
    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (e) { this.glFailed = true; console.error(e); }
      }
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(255, 80, 80);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(24);
        p.text('Physarum needs WebGL2 with float render targets', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      const t = p.millis() / 1000;
      const dt = Math.min(0.05, Math.max(0.001, (p.deltaTime || 16.67) / 1000));
      this.frame++;
      const r = params.response;

      const sw = Math.round(ctx.width), sh = Math.round(ctx.height);
      if (this.ensureTrail(sw, sh)) this.needSeed = true;
      this.simSize = [sw, sh];
      const count = Math.round(params.agents) * 1000;
      this.ensureAgents(count);

      // ---- music
      const { kick, snare } = this.listen(signals, t, dt);
      const bass = Math.max(this.env[0] * 0.6, this.env[1], this.env[2] * 0.7);
      this.bassSlow += (bass - this.bassSlow) * (1 - Math.exp(-dt / 0.7));
      const hats = (this.env[6] + this.env[7] + this.env[8]) / 3;
      const energy = smooth(0.08, 0.5, this.level);
      const roadTarget = params.roads * smooth(0.16, 0.36, this.level * Math.min(1, r * 1.2));
      this.road += (roadTarget - this.road) * (1 - Math.exp(-dt / (roadTarget > this.road ? 0.8 : 2.5)));
      const building = this.road > 0.5;
      this.afterRoad = Math.max(this.road, this.afterRoad * Math.exp(-dt / 8));
      // Regrowth: a Jones network is stable once it has contracted, so without
      // help the breakdown stayed a few bare trunks on black (render 1). Once
      // the roads are released, a stronger respawn trickle reseeds the empty
      // ground and the lace grows back over ~6 s.
      const regrow = this.afterRoad * (1 - this.road);

      // Food ages at full speed while exploring, and hardly at all while the
      // colony is building roads, so the drop's constellation lasts the drop.
      for (const f of this.foods) f.eaten += dt * (1 - 0.94 * this.road);
      this.foods = this.foods.filter((f) => f.eaten < 7);

      if (kick) {
        this.lastKick = t;
        this.kickN++;
        // While building, kicks light existing nodes in turn once the
        // constellation is full; a new node only every eighth kick.
        const live = this.foods.filter((f) => f.eaten < 3);
        if (building && live.length >= ROAD_NODES && this.kickN % 8 !== 0) {
          const cand = live.filter((f) => f !== this.lastHitFood);
          const f = cand[Math.floor(Math.random() * cand.length)] || live[0];
          this.lastHitFood = f;
          this.kickAt(t, f, r);
        } else {
          if (building) {
            // Keep the constellation to ROAD_NODES by retiring the oldest.
            const liveNow = this.foods.filter((f) => f.eaten < 3);
            if (liveNow.length >= ROAD_NODES) liveNow[0].eaten = Math.max(liveNow[0].eaten, 3);
          }
          const f = this.newFood(t, sw, sh);
          this.lastHitFood = f;
          this.kickAt(t, f, r);
        }
      }
      if (snare) {
        this.lastSnare = t;
        const src = this.foods.filter((f) => f.eaten < 3.5).slice(-NPULSE);
        if (!src.length) src.push({ x: sw / 2 + this.cam[0], y: sh / 2 + this.cam[1] });
        const s = Math.min(1.2, 0.5 + 0.5 * r);
        for (const f of src) this.pulses.push({ x: f.x, y: f.y, t0: t, s });
        while (this.pulses.length > NPULSE) this.pulses.shift();
      }
      this.rings = this.rings.filter((q) => t - q.t0 < 0.9);
      this.pulses = this.pulses.filter((q) => t - q.t0 < 1.3);

      // ---- camera: a slow drift whose heading meanders; the bass (smoothed)
      // and the drop set its speed, never a single beat.
      this.camAng += dt * 0.05 * Math.sin(t * 0.031 + 1.3);
      const camSpeed = params.drift * (9 + 14 * this.bassSlow * Math.min(1.5, r) + 8 * energy);
      this.cam[0] = (this.cam[0] + Math.cos(this.camAng) * camSpeed * dt) % sw;
      this.cam[1] = (this.cam[1] + Math.sin(this.camAng) * camSpeed * dt) % sh;
      if (this.cam[0] < 0) this.cam[0] += sw;
      if (this.cam[1] < 0) this.cam[1] += sh;
      this.spore[0] += Math.cos(this.camAng) * camSpeed * dt * 1.8 + dt * 4;
      this.spore[1] += Math.sin(this.camAng) * camSpeed * dt * 1.8 + dt * 2;

      // ---- sim parameters
      const deg = Math.PI / 180;
      const SA = (16 + 44 * params.character + 22 * bass * r) * deg;
      const RA = (38 + 14 * params.character) * deg;
      const SD = 8 + 6 * params.character + 3 * bass * r + 4 * this.road;
      const speed = 0.9 + 0.45 * energy * r + 0.25 * hats * r;
      const density = count / (sw * sh);
      const dep = 0.05 * Math.sqrt(0.5 / density);
      const decay = 0.90 + 0.085 * params.memory - 0.012 * (1 - energy) * (1 - params.memory) - 0.024 * this.road;

      const foodU = new Float32Array(NFOOD * 4);
      const foodV = new Float32Array(NFOOD * 4);
      this.foods.forEach((f, i) => {
        const age = t - f.t0;
        const life = Math.exp(-f.eaten / 2.6) * smooth(0, 0.08, age + 0.02);
        const reach = 95 + 50 * this.road;
        foodU.set([f.x, f.y, reach, (2.2 + 1.2 * this.road) * life], i * 4);
        foodV.set([f.x, f.y, t - f.lastHit, Math.exp(-f.eaten / 2.2)], i * 4);
      });
      const ringU = new Float32Array(NRING * 4);
      this.rings.forEach((q, i) => ringU.set([q.x, q.y, t - q.t0, q.s], i * 4));
      const pulseU = new Float32Array(NPULSE * 4);
      this.pulses.forEach((q, i) => pulseU.set([q.x, q.y, t - q.t0, q.s], i * 4));

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      // ---- 1. agents step
      const A = this.agents, T = this.trail;
      let P = this.P.update;
      gl.useProgram(P.pr);
      gl.bindVertexArray(this.quadVao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, A[1].fb);
      gl.viewport(0, 0, COLS, this.agentRows);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A[0].t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T[0].t);
      gl.uniform1i(P.u('uState'), 0);
      gl.uniform1i(P.u('uTrail'), 1);
      gl.uniform2f(P.u('uSim'), sw, sh);
      gl.uniform1f(P.u('uSA'), SA);
      gl.uniform1f(P.u('uRA'), RA);
      gl.uniform1f(P.u('uSD'), SD);
      gl.uniform1f(P.u('uSpeed'), speed);
      gl.uniform1f(P.u('uJitter'), 0.2);
      gl.uniform1f(P.u('uMemW'), 0.5 * (1 - this.road));
      gl.uniform1ui(P.u('uFrame'), this.frame >>> 0);
      gl.uniform4fv(P.u('uFood'), foodU);
      gl.uniform4f(P.u('uSpawn'), this.spawn ? this.spawn[0] : 0, this.spawn ? this.spawn[1] : 0, this.spawn ? 0.012 * Math.min(1.6, r) : 0, this.spawn ? this.spawn[2] : 0);
      gl.uniform1f(P.u('uRespawn'), 0.001 + 0.004 * this.road + 0.006 * regrow);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.spawn = null;
      this.agents = [A[1], A[0]];

      // ---- 2. deposit into trail[0]
      P = this.P.deposit;
      gl.useProgram(P.pr);
      gl.bindVertexArray(this.pointVao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[0].fb);
      gl.viewport(0, 0, sw, sh);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.agents[0].t);
      gl.uniform1i(P.u('uState'), 0);
      gl.uniform2f(P.u('uSim'), sw, sh);
      gl.uniform1f(P.u('uDep'), dep);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);

      // ---- 3. diffuse + decay trail[0] -> trail[1]
      P = this.P.diffuse;
      gl.useProgram(P.pr);
      gl.bindVertexArray(this.quadVao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[1].fb);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T[0].t);
      gl.uniform1i(P.u('uTrail'), 0);
      gl.uniform2f(P.u('uSim'), sw, sh);
      gl.uniform1f(P.u('uDecay'), decay);
      gl.uniform1f(P.u('uDiffuse'), 0.55);
      gl.uniform1f(P.u('uRoad'), this.road);
      gl.uniform1f(P.u('uMemFade'), 0.0006);
      gl.uniform4fv(P.u('uFood'), foodU);
      gl.uniform1f(P.u('uFoodScent'), 0.05 + 0.22 * this.road);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.trail = [T[1], T[0]];
      const trail = this.trail[0];

      // ---- 4. deep stratum: trail -> quarter -> wider (both quarter-res)
      const G = this.glow;
      P = this.P.blur;
      gl.useProgram(P.pr);
      gl.uniform1i(P.u('uSrc'), 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, G[0].fb);
      gl.viewport(0, 0, G[0].w, G[0].h);
      gl.bindTexture(gl.TEXTURE_2D, trail.t);
      gl.uniform2f(P.u('uSrcSize'), sw, sh);
      gl.uniform2f(P.u('uDstSize'), G[0].w, G[0].h);
      gl.uniform1f(P.u('uStep'), 2.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, G[1].fb);
      gl.bindTexture(gl.TEXTURE_2D, G[0].t);
      gl.uniform2f(P.u('uSrcSize'), G[0].w, G[0].h);
      gl.uniform2f(P.u('uDstSize'), G[1].w, G[1].h);
      gl.uniform1f(P.u('uStep'), 2.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ---- 5. display
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const pal = PALETTES[Math.max(0, Math.min(PALETTES.length - 1, Math.round(params.palette)))];

      P = this.P.display;
      gl.useProgram(P.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, trail.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G[1].t);
      gl.uniform1i(P.u('uTrail'), 0);
      gl.uniform1i(P.u('uDeepTex'), 1);
      gl.uniform2f(P.u('uRes'), w, h);
      gl.uniform2f(P.u('uSim'), sw, sh);
      gl.uniform2f(P.u('uCam'), this.cam[0], this.cam[1]);
      gl.uniform1f(P.u('uTime'), t);
      gl.uniform1f(P.u('uGain'), (0.22 + 0.06 * energy) * params.weight);
      gl.uniform1f(P.u('uHats'), clamp01(hats * 1.6 * r));
      gl.uniform1f(P.u('uPad'), clamp01(this.pad * 2.5 * r));
      gl.uniform1f(P.u('uLight'), pal.light);
      gl.uniform1f(P.u('uSheathW'), 0.6);
      gl.uniform3fv(P.u('uGround'), pal.ground);
      gl.uniform3fv(P.u('uInk'), pal.ink);
      gl.uniform3fv(P.u('uCore'), pal.core);
      gl.uniform3fv(P.u('uFoodCol'), pal.food);
      gl.uniform3fv(P.u('uPulseCol'), pal.pulse);
      gl.uniform3fv(P.u('uDeep'), pal.deep);
      gl.uniform3fv(P.u('uSheath'), pal.sheath);
      gl.uniform4fv(P.u('uFoodV'), foodV);
      gl.uniform4fv(P.u('uRing'), ringU);
      gl.uniform4fv(P.u('uPulse'), pulseU);
      gl.uniform2f(P.u('uSpore'), this.spore[0], this.spore[1]);
      gl.uniform1ui(P.u('uSparkFrame'), Math.floor(t * 20) >>> 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);

      const dc = p.drawingContext;
      dc.save();
      dc.globalAlpha = 1;
      dc.globalCompositeOperation = 'source-over';
      dc.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
      dc.restore();
    },
  });
})();
