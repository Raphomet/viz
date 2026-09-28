// Physarum — the Jones (2010) slime-mould model on the GPU. A few hundred
// thousand agents each sense a shared trail map ahead-left, ahead and
// ahead-right, turn toward the strongest scent, step, and deposit; the trail
// diffuses and decays. Veins emerge because every agent reinforces the path it
// is on. Rendered as bioluminescent mycelium seen from above while we drift
// across it.
//
// Everything that scales with the agent count lives in textures:
//   agents  RGBA32F, one texel per agent: x, y (trail px), heading, species.
//           Updated by a fragment shader (ping-pong).
//   trail   RGBA16F at the virtual stage size (short side 600), R = species A,
//           G = species B. Agents are splatted into it as 1-px points with
//           additive blending, then a 3x3 diffuse + decay pass ping-pongs it.
//   glow    two quarter-res blurs of the trail, for halo and a deep parallax
//           layer, so the bloom costs a fraction of a full-res pass.
// The trail is fixed at the virtual size (not device pixels) so vein width and
// network scale look the same on a 640-px preview and a 4K projector.
//
// Why the kick does not touch the whole frame: Raph's batch-02 feedback was
// that full-frame reactions on every beat are jarring. So the kick lands in one
// place: a food node appears there, flares, and throws a starburst of agents
// (a small fraction teleported to it) that then gets reabsorbed as the network
// reaches for the food. The snare is a different thing in a different place:
// a wavefront of light that travels outward *along the veins only* from the
// newest node. Bass bends the sensor angle (fine lace ↔ coarse cells), which
// changes the network's character slowly, not its brightness.

(function () {
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // Palettes: species A, species B, food, snare pulse, background, deep layer.
  const PALETTES = [
    { name: 'Abyssal', a: [0.08, 0.85, 0.78], b: [0.98, 0.22, 0.66], food: [1.0, 0.62, 0.22], pulse: [1.0, 0.93, 0.72], bg: [0.006, 0.012, 0.035], deep: [0.10, 0.16, 0.55] },
    { name: 'Ember delta', a: [1.0, 0.50, 0.12], b: [0.50, 0.30, 1.0], food: [0.55, 0.95, 1.0], pulse: [1.0, 0.95, 0.85], bg: [0.03, 0.008, 0.015], deep: [0.45, 0.08, 0.20] },
    { name: 'Spore', a: [0.55, 1.0, 0.28], b: [0.50, 0.22, 1.0], food: [1.0, 0.40, 0.65], pulse: [0.95, 1.0, 0.85], bg: [0.006, 0.025, 0.02], deep: [0.06, 0.32, 0.30] },
    { name: 'Ice and rose', a: [0.45, 0.72, 1.0], b: [1.0, 0.42, 0.52], food: [1.0, 0.82, 0.35], pulse: [0.9, 0.97, 1.0], bg: [0.008, 0.012, 0.03], deep: [0.22, 0.20, 0.50] },
  ];

  // Rotate a colour's hue by `a` radians in YIQ space: used for a slow,
  // bounded drift inside the chosen palette, never a rainbow cycle.
  function hueRotate(c, a) {
    const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const i = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2];
    const q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2];
    const cs = Math.cos(a), sn = Math.sin(a);
    const i2 = i * cs - q * sn, q2 = i * sn + q * cs;
    return [
      Math.max(0, y + 0.956 * i2 + 0.621 * q2),
      Math.max(0, y - 0.272 * i2 - 0.647 * q2),
      Math.max(0, y - 1.106 * i2 + 1.703 * q2),
    ];
  }

  const COLS = 1024;          // agent texture width
  const NFOOD = 8;
  const NPULSE = 4;

  const VS_QUAD = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const COMMON = `
uint hashU(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float hash3(uvec3 v) { return float(hashU(v.x ^ hashU(v.y ^ hashU(v.z)))) / 4294967295.0; }
vec2 wrapD(vec2 d, vec2 sim) { return d - sim * floor(d / sim + 0.5); }
`;

  // Agent step. Sensing merges both species' trails while uSplit is 0; as
  // uSplit rises each species follows its own trail and is repelled by the
  // other's, so the network separates into two interlocking colours.
  const FS_UPDATE = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform sampler2D uTrail;
uniform vec2 uSim;
uniform float uSA, uRA, uSD, uSpeed, uSplit, uJitter;
uniform uint uFrame;
uniform vec4 uFood[${NFOOD}];   // x, y, radius, pull
uniform vec4 uSpawn;             // x, y, fraction, spoke phase
uniform float uRespawn;
out vec4 o;
${COMMON}
float sense(vec2 p, float sp) {
  vec4 t = texture(uTrail, p / uSim);
  float own = sp < 0.5 ? t.r : t.g;
  float oth = sp < 0.5 ? t.g : t.r;
  return mix(own + oth, own - 0.8 * oth, uSplit);
}
// Food attraction, linearised: the value at each sensor is taken from the
// field's gradient at the agent, so the 8 food exps run once per agent, not
// once per sensor (the sensors are ~10 px apart; the food blobs ~95 px wide).
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
  vec2 pos = s.xy; float ang = s.z; float sp = s.w;
  uvec3 key = uvec3(uint(c.x), uint(c.y), uFrame);
  float r0 = hash3(key);
  float r1 = hash3(key + uvec3(17u, 91u, 7u));
  float r2 = hash3(key + uvec3(3u, 5u, 101u));

  // Kick: a small random fraction of agents is thrown into the new food node,
  // leaving it as a starburst.
  if (uSpawn.z > 0.0 && r0 < uSpawn.z) {
    // Seven spokes, not a full circle: an even ring of outward agents closes
    // into a persistent loop, spokes sprout as filaments.
    float a = (floor(r1 * 7.0) + uSpawn.w) * 0.8975979 + (r2 - 0.5) * 0.12;
    pos = uSpawn.xy + vec2(cos(a), sin(a)) * (2.0 + 6.0 * r2);
    o = vec4(mod(pos, uSim), a, sp);
    return;
  }
  // A trickle of respawns keeps unexplored ground from staying dead.
  if (r2 < uRespawn) {
    o = vec4(vec2(r0, r1) * uSim, r0 * 40.0, sp);
    return;
  }

  // Species B has a wider, faster gait once the populations split, so the two
  // networks differ in texture as well as colour.
  float k = uSplit * sp;
  float sa = uSA * (1.0 + 0.45 * k);
  float ra = uRA * (1.0 + 0.45 * k);
  float sd = uSD * (1.0 + 0.5 * k);
  float spd = uSpeed * (1.0 + 0.2 * k);

  vec2 df = vec2(cos(ang), sin(ang));
  vec2 dl = vec2(cos(ang + sa), sin(ang + sa));
  vec2 dr = vec2(cos(ang - sa), sin(ang - sa));
  vec2 fg = foodGrad(pos) * sd;
  float F = sense(pos + df * sd, sp) + dot(fg, df);
  float L = sense(pos + dl * sd, sp) + dot(fg, dl);
  float R = sense(pos + dr * sd, sp) + dot(fg, dr);
  if (F > L && F > R) {
  } else if (F < L && F < R) {
    ang += (r0 < 0.5 ? ra : -ra);
  } else if (L > R) {
    ang += ra;
  } else if (R > L) {
    ang -= ra;
  }
  ang += (r1 - 0.5) * uJitter;
  pos += vec2(cos(ang), sin(ang)) * spd;
  o = vec4(mod(pos, uSim), mod(ang, 6.2831853), sp);
}`;

  const VS_DEPOSIT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform vec2 uSim;
out float vSp;
void main() {
  ivec2 c = ivec2(gl_VertexID % ${COLS}, gl_VertexID / ${COLS});
  vec4 s = texelFetch(uState, c, 0);
  vSp = s.w;
  gl_Position = vec4(s.xy / uSim * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

  const FS_DEPOSIT = `#version 300 es
precision highp float;
in float vSp;
uniform float uDep;
out vec4 o;
void main() { o = vec4(uDep * (1.0 - vSp), uDep * vSp, 0.0, 0.0); }`;

  // Diffuse + decay; food nodes also leak scent into the trail so the veins
  // that reach them are reinforced and stay lit while the node lives.
  const FS_DIFFUSE = `#version 300 es
precision highp float;
uniform sampler2D uTrail;
uniform vec2 uSim;
uniform float uDecay, uDiffuse;
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
  vec4 n = mix(c, b, uDiffuse) * uDecay;
  float food = 0.0;
  for (int i = 0; i < ${NFOOD}; i++) {
    vec4 f = uFood[i];
    if (f.w <= 0.0) continue;
    vec2 d = wrapD(gl_FragCoord.xy - f.xy, uSim);
    food += f.w * exp(-dot(d, d) / 64.0);
  }
  n.rg += food * uFoodScent;
  o = clamp(n, 0.0, 400.0);
}`;

  // Quarter-res blur: tap spacing in source texels.
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
uniform sampler2D uGlow1;
uniform sampler2D uGlow2;
uniform vec2 uRes, uSim, uCam;
uniform float uTime, uSplit, uGain, uGlow, uHats, uPad, uEnergy;
uniform vec3 uColA, uColB, uFoodCol, uPulseCol, uBg, uDeep;
uniform vec4 uFoodV[${NFOOD}];   // x, y, age (s), life (0..1)
uniform vec4 uPulse[${NPULSE}];  // x, y, age (s), strength
uniform vec2 uSpore;             // spore layer offset
uniform uint uSparkFrame;
out vec4 o;
${COMMON}
vec3 speciesCol(vec2 t) {
  float I = t.r + t.g;
  float r = I > 1e-4 ? t.g / I : 0.0;
  return mix(uColA, uColB, r * uSplit);
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 simP = frag / uRes * uSim;              // sim px under this pixel, before the camera
  vec2 sp = simP + uCam;
  vec2 uv = sp / uSim;
  float px = uSim.y / uRes.y;                  // sim px per device px

  // Deep layer: the same network, blurred, at half scale and 0.45x the camera
  // speed, far below the main one. Parallax against it is where depth comes from.
  vec2 dq = (simP - 0.5 * uSim) * 0.5 + 0.5 * uSim + uCam * 0.45 + vec2(311.0, 173.0);
  vec2 dg = texture(uGlow2, dq / uSim).rg;
  float deep = 1.0 - exp(-(dg.r + dg.g) * uGain * 0.55);
  vec2 cn = frag / uRes - 0.5;
  cn.x *= uRes.x / uRes.y;
  float vig = 1.0 - smoothstep(0.35, 1.05, length(cn));
  vec3 col = uBg * (0.7 + 0.6 * vig);
  col += uDeep * deep * (0.16 + 0.06 * uPad) * (0.5 + 0.5 * vig);

  // Main network.
  vec2 t = texture(uTrail, uv).rg;
  float I = t.r + t.g;
  float vein = 1.0 - exp(-I * uGain);
  vec3 sc = speciesCol(t);

  // Kick: food nodes. Each flares when it lands (a bright core, a halo, a
  // short ring) and lights the veins within ~140 px of itself; afterwards it
  // settles to a small warm nucleus that fades over its life.
  float veinBoost = 0.0;
  vec3 food = vec3(0.0);
  for (int i = 0; i < ${NFOOD}; i++) {
    vec4 f = uFoodV[i];
    if (f.w <= 0.0) continue;
    vec2 d = wrapD(sp - f.xy, uSim);
    float dd = dot(d, d);
    float flash = exp(-f.z * 5.0);
    float coreR = 5.0 + 9.0 * flash;
    food += uFoodCol * (exp(-dd / (coreR * coreR)) * (0.55 * f.w + 1.6 * flash)
                       + exp(-dd / (2600.0)) * 0.55 * flash
                       + exp(-dd / (900.0)) * 0.10 * f.w);
    float rr = 14.0 + 170.0 * f.z;
    float ring = exp(-pow((sqrt(dd) - rr) / 7.0, 2.0)) * exp(-f.z * 6.0);
    food += uFoodCol * ring * 0.55;
    veinBoost += flash * 1.6 * exp(-dd / 19600.0);
  }

  // Snare: a wavefront that travels outward from the newest node, lit only
  // where there are veins, so it reads as light running through the network.
  float pulse = 0.0;
  for (int i = 0; i < ${NPULSE}; i++) {
    vec4 q = uPulse[i];
    if (q.w <= 0.0) continue;
    float dist = length(wrapD(sp - q.xy, uSim));
    float rad = q.z * 430.0;
    float w = 16.0 + 26.0 * q.z;
    pulse += q.w * exp(-pow((dist - rad) / w, 2.0)) * exp(-q.z * 2.2);
  }

  col += sc * vein * (0.95 + veinBoost) ;
  col += mix(sc, vec3(1.0), 0.6) * pow(vein, 3.0) * (0.35 + 0.5 * veinBoost);
  col += uPulseCol * pulse * (vein * 1.3 + pow(vein, 2.0) * 0.8);

  // Bloom from the two blur levels, tinted by species.
  vec2 g1 = texture(uGlow1, uv).rg;
  vec2 g2 = texture(uGlow2, uv).rg;
  float gl1 = 1.0 - exp(-(g1.r + g1.g) * uGain * 0.9);
  float gl2 = 1.0 - exp(-(g2.r + g2.g) * uGain * 0.9);
  col += speciesCol(g1) * gl1 * (0.22 + 0.12 * uEnergy) * uGlow;
  col += speciesCol(g2) * gl2 * (0.16 + 0.10 * uPad + 0.10 * uEnergy) * uGlow;
  col += uPulseCol * pulse * gl2 * 0.35 * uGlow;
  col += food;

  // Hats: sparse glints on the veins, reshuffled 20 times a second.
  uvec2 cell = uvec2(floor(sp / 2.0));
  float h = hash3(uvec3(cell, uSparkFrame));
  float spark = step(1.0 - 0.035 * uHats, h) * smoothstep(0.35, 0.7, vein);
  col += mix(sc, vec3(1.0), 0.7) * spark * 1.1;

  // Foreground spores: soft out-of-focus motes above the network, moving
  // faster than it (parallax), twinkling with the hats.
  vec2 fp = simP + uSpore;
  vec2 id = floor(fp / 90.0);
  vec2 lc = fract(fp / 90.0);
  uvec3 ik = uvec3(uvec2(ivec2(id) + 4096), 7u);
  float has = hash3(ik);
  if (has < 0.45) {
    vec2 c0 = vec2(hash3(ik + uvec3(0u, 0u, 1u)), hash3(ik + uvec3(0u, 0u, 2u))) * 0.7 + 0.15;
    float rad = mix(0.018, 0.05, hash3(ik + uvec3(0u, 0u, 3u)));
    float d = length(lc - c0);
    float disk = smoothstep(rad, rad * 0.55, d);
    float tw = 0.5 + 0.5 * sin(uTime * (1.3 + 2.0 * has) + has * 40.0);
    float b = (0.05 + 0.05 * tw) * (1.0 + 2.2 * uHats * tw);
    col += mix(uColA, vec3(1.0), 0.55) * disk * b;
  }

  col *= 0.75 + 0.25 * vig;
  col = 1.0 - exp(-col * 1.25);                  // soft shoulder
  o = vec4(pow(col, vec3(0.92)), 1.0);
}`;

  VIZ.register({
    id: 'physarum',
    name: 'Physarum',
    order: 306,
    gallery: {
      title: 'Physarum',
      technique: 'WebGL2 agent simulation (Jones 2010): agent state in an RGBA32F texture stepped by a fragment shader, 1-px point deposits into an RGBA16F two-species trail map, 3x3 diffuse/decay, quarter-res bloom, composited with drawImage',
      brief: 'Bioluminescent slime mould seen from above as we drift across it: living vein networks that grow, reroute and reach for food. The bass bends the sensor angle so the network turns from fine lace to coarse cells; each kick drops a food node in one place that flares, bursts and is reached for; the snare sends a wave of light running outward along the veins; hats glint on the veins and in foreground spores; the drop splits the colony into two coloured species that repel each other, and the breakdown lets them merge back and dim.',
      lineage: [
        'Brief 06 (batch 03): Jeff Jones\'s 2010 Physarum transport-network model (sense ahead/left/right, turn, step, deposit; diffuse and decay the trail), as popularised by Sage Jenson\'s GPU renderings; bass bends the sensor angle, kicks drop food, the snare runs light down the veins, the drop splits the colony into two species.',
        'v1 (render 1): seeded as a centred disc heading outward. The rim became a permanent glowing ring for the whole build, each kick\'s radial spawn closed into another ring, rotation angle tied to sensor angle gave long wormy tubes, and the network coarsened so the breakdown ended up thicker and brighter than the drop. 512 ms/frame in SwiftShader.',
        'v2: uniform seeding; rotation angle decoupled (38-52 deg, Jones\'s RA > SA regime) for the classic cellular lace; kick spawns thrown along seven spokes so they sprout filaments; more jitter and a 0.1%/frame respawn trickle against coarsening; vein gain eased down with the drop detector so the breakdown exhales. Food attraction linearised to one gradient per agent (292 ms/frame in SwiftShader, from 512). Jolt: kickArea 0.36, ratio 1.25 - calm by ratio, but most of that area was ordinary motion: the camera drift and a long snare wavefront.',
        'v3: drop camera boost halved (drift 10 -> ~22 units/s instead of ~45), snare wavefront shortened to 1.6 s. Jolt: kickArea 0.237, kickMean 0.044, ratio 1.33, calm; the heat map shows one hot blob at the new food node with the rest of the frame at drift level.',
        'Checked at 1280x720 (identical composition; the trail is fixed at the virtual stage size) and over 96 s (four loops): no saturation or die-off, every drop splits into two species with a warm food node, every quiet section merges back to a dimmer single-colour lace. After the first loop the quiet network is loopier and less fine than the very first intro.',
      ],
    },

    params: [
      { key: 'character', label: 'Vein character (lace ↔ cells)', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'agents', label: 'Agents (thousands)', type: 'range', min: 50, max: 1000, default: 300, step: 10 },
      { key: 'memory', label: 'Trail memory', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'drift', label: 'Drift speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'species', label: 'Species', type: 'select', options: ['Split on the drop', 'Always one', 'Always two'], default: 0 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
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
      this.split = 0;
      this.pad = 0;
      this.cam = [0, 0];
      this.camAng = 0.6;
      this.spore = [0, 0];
      this.foods = [];
      this.pulses = [];
      this.lastKick = -10;
      this.lastSnare = -10;
      this.walk = null;        // last food position in screen (pre-camera) coords, plus heading
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
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('physarum: framebuffer incomplete');
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
      // Seeded uniformly: a centred disc of outward-heading agents grew
      // nicely but left its rim as a permanent ring (render 1).
      const data = new Float32Array(rows * COLS * 4);
      for (let i = 0; i < rows * COLS; i++) {
        data[i * 4] = Math.random() * sw;
        data[i * 4 + 1] = Math.random() * sh;
        data[i * 4 + 2] = Math.random() * TAU;
        data[i * 4 + 3] = i & 1;
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
    listen(signals, params, t, dt) {
      const r = params.response;
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

      // The drop detector: slow in, slower out, on the low end, so it only
      // rises when kicks and bass have been going for a while.
      const low = Math.max(signals[0], signals[1]) / 100;
      const tau = low > this.level ? 1.0 : 3.0;
      this.level += (low - this.level) * (1 - Math.exp(-dt / tau));
      const padNow = (this.env[2] + this.env[3] + this.env[4]) / 3;
      this.pad += (padNow - this.pad) * (1 - Math.exp(-dt / 0.8));
      return { kick, snare, r };
    },

    dropFood(t, sw, sh, strength) {
      // A food walk: each node is a step on from the last in screen space, so
      // over a phrase the network is led on a winding path across the frame.
      let x, y, h;
      if (!this.walk) {
        x = sw * (0.3 + 0.4 * Math.random()); y = sh * (0.3 + 0.4 * Math.random()); h = Math.random() * TAU;
      } else {
        h = this.walk.h + (Math.random() - 0.5) * 2.2;
        const step = 110 + 110 * Math.random();
        x = this.walk.x + Math.cos(h) * step; y = this.walk.y + Math.sin(h) * step;
        const mx = sw * 0.14, my = sh * 0.18;
        if (x < mx || x > sw - mx) { h = Math.PI - h; x = Math.max(mx, Math.min(sw - mx, x)); }
        if (y < my || y > sh - my) { h = -h; y = Math.max(my, Math.min(sh - my, y)); }
      }
      this.walk = { x, y, h };
      const simX = ((x + this.cam[0]) % sw + sw) % sw;
      const simY = ((y + this.cam[1]) % sh + sh) % sh;
      this.foods.push({ x: simX, y: simY, t0: t, s: strength });
      if (this.foods.length > NFOOD) this.foods.shift();
      this.spawn = [simX, simY, Math.random() * 7];
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

      const sw = Math.round(ctx.width), sh = Math.round(ctx.height);
      if (this.ensureTrail(sw, sh)) this.needSeed = true;
      this.simSize = [sw, sh];
      const count = Math.round(params.agents) * 1000;
      this.ensureAgents(count);

      // ---- music
      const { kick, snare, r } = this.listen(signals, params, t, dt);
      const bass = Math.max(this.env[0] * 0.6, this.env[1], this.env[2] * 0.7);
      const hats = (this.env[6] + this.env[7] + this.env[8]) / 3;
      const energy = smooth(0.08, 0.5, this.level);
      const mode = Math.round(params.species);
      const splitTarget = mode === 1 ? 0 : mode === 2 ? 1 : smooth(0.14, 0.38, this.level * Math.min(1, r * 1.2));
      this.split += (splitTarget - this.split) * (1 - Math.exp(-dt / (splitTarget > this.split ? 0.7 : 2.2)));

      if (kick) {
        this.lastKick = t;
        this.dropFood(t, sw, sh, 1);
      }
      if (snare) {
        this.lastSnare = t;
        const src = this.foods.length ? this.foods[this.foods.length - 1] : { x: sw / 2 + this.cam[0], y: sh / 2 + this.cam[1] };
        this.pulses.push({ x: src.x, y: src.y, t0: t, s: Math.min(1.4, 0.6 + 0.6 * r) });
        if (this.pulses.length > NPULSE) this.pulses.shift();
      }
      this.foods = this.foods.filter((f) => t - f.t0 < 7);
      this.pulses = this.pulses.filter((q) => t - q.t0 < 1.6);

      // ---- camera: a slow drift whose heading meanders, sped up by the drop
      // and the bass (never jerked by a single beat).
      this.camAng += dt * 0.05 * Math.sin(t * 0.031 + 1.3);
      const camSpeed = params.drift * (10 + 12 * energy + 8 * this.pad) ;
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
      const SD = 8 + 6 * params.character + 3 * bass * r;
      const speed = 0.9 + 0.55 * energy * r + 0.25 * hats * r;
      const density = count / (sw * sh);
      const dep = 0.05 * Math.sqrt(0.5 / density) * (1 + 0.35 * energy);
      const decay = 0.90 + 0.085 * params.memory - 0.012 * (1 - energy) * (1 - params.memory);

      const foodU = new Float32Array(NFOOD * 4);
      const foodV = new Float32Array(NFOOD * 4);
      this.foods.forEach((f, i) => {
        const age = t - f.t0;
        const life = Math.exp(-age / 2.6) * smooth(0, 0.08, age + 0.02);
        foodU.set([f.x, f.y, 95, 2.2 * life * f.s], i * 4);
        foodV.set([f.x, f.y, age, Math.exp(-age / 2.2) * f.s], i * 4);
      });
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
      gl.uniform1f(P.u('uSplit'), this.split);
      gl.uniform1f(P.u('uJitter'), 0.2);
      gl.uniform1ui(P.u('uFrame'), this.frame >>> 0);
      gl.uniform4fv(P.u('uFood'), foodU);
      gl.uniform4f(P.u('uSpawn'), this.spawn ? this.spawn[0] : 0, this.spawn ? this.spawn[1] : 0, this.spawn ? 0.012 * Math.min(1.6, r) : 0, this.spawn ? this.spawn[2] : 0);
      gl.uniform1f(P.u('uRespawn'), 0.001);
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
      gl.uniform4fv(P.u('uFood'), foodU);
      gl.uniform1f(P.u('uFoodScent'), 0.05);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.trail = [T[1], T[0]];
      const trail = this.trail[0];

      // ---- 4. bloom: trail -> glow0 (quarter) -> glow1 (wider)
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
      const drift = 0.22 * Math.sin(t * 0.019) + 0.1 * Math.sin(t * 0.047 + 2);
      const colA = hueRotate(pal.a, drift);
      const colB = hueRotate(pal.b, -drift * 0.8);

      P = this.P.display;
      gl.useProgram(P.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, trail.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G[0].t);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, G[1].t);
      gl.uniform1i(P.u('uTrail'), 0);
      gl.uniform1i(P.u('uGlow1'), 1);
      gl.uniform1i(P.u('uGlow2'), 2);
      gl.uniform2f(P.u('uRes'), w, h);
      gl.uniform2f(P.u('uSim'), sw, sh);
      gl.uniform2f(P.u('uCam'), this.cam[0], this.cam[1]);
      gl.uniform1f(P.u('uTime'), t);
      gl.uniform1f(P.u('uSplit'), this.split);
      gl.uniform1f(P.u('uGain'), 0.2 + 0.1 * energy);
      gl.uniform1f(P.u('uGlow'), params.glow);
      gl.uniform1f(P.u('uHats'), clamp01(hats * 1.6 * r));
      gl.uniform1f(P.u('uPad'), clamp01(this.pad * 2.5 * r));
      gl.uniform1f(P.u('uEnergy'), energy * Math.min(1, r));
      gl.uniform3fv(P.u('uColA'), colA);
      gl.uniform3fv(P.u('uColB'), colB);
      gl.uniform3fv(P.u('uFoodCol'), pal.food);
      gl.uniform3fv(P.u('uPulseCol'), pal.pulse);
      gl.uniform3fv(P.u('uBg'), pal.bg);
      gl.uniform3fv(P.u('uDeep'), pal.deep);
      gl.uniform4fv(P.u('uFoodV'), foodV);
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
