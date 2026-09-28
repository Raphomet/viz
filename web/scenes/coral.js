// Coral — Gray-Scott reaction–diffusion on the GPU, lit as a wet surface.
//
// The simulation is a WebGL2 ping-pong pair of float textures at a lower
// resolution than the screen ("Detail" cells on the short side). Each cell holds
//   r = u (substrate), g = v (the growing tissue),
//   b = a slow running average of v (so "v − avg" tells growing from receding),
//   a = the local position on the regime path (see PATH below).
// Per frame: one advect pass (a slow curl current shears the pattern, kicks
// splat seed blots, the regime map is refreshed), N Gray-Scott steps, one prep
// pass (gradient + cast-shadow blur at sim resolution), then a full-resolution
// display pass that B-spline-interpolates the field and thresholds it with
// fwidth antialiasing, so the tissue edges are resolved at screen resolution
// instead of showing the sim grid.
//
// Why a spatial regime map: a single (feed, kill) pair settles into one
// texture and then freezes. Letting the pair vary slowly across the stage puts
// coral, labyrinth and dividing spots side by side, and the fronts between them
// migrate — the eye always has a border to watch.

(function () {
  const TAU = Math.PI * 2;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  // Shared GLSL: the periodic regime map. Integer frequencies in uv on both
  // axes so the map has no seam where the sim wraps; the x frequencies mix
  // 1, 2 and 3 so the stage never shows the same form twice side by side (an
  // earlier version scaled x by the aspect and tiled the reef in two).
  const REGION = `
const float TAU = 6.2831853;
uniform float ax;
float regionMap(vec2 uv, float t) {
  float m = 0.55 * sin(TAU * (uv.x + uv.y) + 1.4 * sin(TAU * (2.0 * uv.x - uv.y) + t * 0.61) + t * 0.37)
          + 0.45 * sin(TAU * (uv.y - 2.0 * uv.x) + 1.2 * sin(TAU * (uv.x + 2.0 * uv.y) + t * 0.43) - t * 0.29)
          + 0.25 * sin(TAU * (3.0 * uv.x + 2.0 * uv.y) + 0.9 * sin(TAU * (uv.x - 2.0 * uv.y) - t * 0.5) + t * 0.21);
  return m / 1.25;
}`;

  // Advect + splat + bookkeeping. Also used (flow 0, no blots) to resample the
  // state into a new grid when Detail changes, so that is not a visible reset.
  const ADVECT = `#version 300 es
precision highp float;
uniform sampler2D sim;
uniform vec2 srcSize;
uniform vec2 dstSize;
uniform float flow;      // cells per frame
uniform float flowT;
uniform float zRate;
uniform float regime;
uniform float spread;
uniform float mapT;
uniform vec4 blots[8];   // x, y (dst cells), radius, crater strength
uniform int nBlots;
out vec4 o;
${REGION}
vec4 at(ivec2 c) {
  ivec2 n = ivec2(srcSize);
  return texelFetch(sim, (c % n + n) % n, 0);
}
vec4 bilinear(vec2 p) {
  p -= 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  return mix(mix(at(i), at(i + ivec2(1, 0)), f.x),
             mix(at(i + ivec2(0, 1)), at(i + ivec2(1, 1)), f.x), f.y);
}
// Divergence-free current: the curl of a sum of drifting periodic waves.
vec2 current(vec2 uv, float t) {
  vec2 q = uv;
  vec2 n1 = vec2(1.0, 1.0), n2 = vec2(-1.0, 2.0), n3 = vec2(2.0, -1.0), n4 = vec2(1.0, -2.0);
  vec2 g = n1 * cos(TAU * dot(n1, q) + t * 0.90) * 1.0
         + n2 * cos(TAU * dot(n2, q) - t * 0.70 + 1.3) * 0.7
         + n3 * cos(TAU * dot(n3, q) + t * 0.55 + 2.1) * 0.6
         + n4 * cos(TAU * dot(n4, q) - t * 0.40 + 4.0) * 0.5;
  return vec2(g.y, -g.x) / 2.2;
}
void main() {
  vec2 uv = gl_FragCoord.xy / dstSize;
  vec2 vel = current(uv, flowT) * flow;
  vec4 s = bilinear(uv * srcSize - vel * (srcSize / dstSize));
  for (int i = 0; i < 8; i++) {
    if (i >= nBlots) break;
    vec2 d = gl_FragCoord.xy - blots[i].xy;
    d -= dstSize * floor(d / dstSize + 0.5);          // nearest wrapped image
    // A kick clears a crater and drops a seed in its middle: the beat reads
    // as a hole that blooms shut again, not as a flash.
    float r = length(d), R = blots[i].z;
    float crater = (1.0 - smoothstep(R * 0.75, R, r)) * blots[i].w;
    float seed = 1.0 - smoothstep(R * 0.12, R * 0.28, r);
    s.xy = mix(s.xy, vec2(1.0, 0.0), crater);
    s.xy = mix(s.xy, vec2(0.25, 0.5), seed);
  }
  s.z += (s.y - s.z) * zRate;
  s.w = clamp(regime + spread * regionMap(uv, mapT), 0.0, 1.0);
  o = s;
}`;

  // One Gray-Scott step (Du = 1, Dv = 0.5, dt = 1, 3x3 Laplacian).
  // PATH: s = 0 dying (kill past the spot band: tissue fades to bare ground),
  // 1/4 sparse dividing spots, 1/2 labyrinth, 3/4 branching coral, 1 back to
  // labyrinth. (The churning-worm corner that used to end the path melted into
  // flat, muddy puddles once the drop pushed regions past it.) The dying end is what gives the reef negative space: dark voids
  // drift with the regime map, and the reef retreats from them and re-invades.
  // Neighbours come from textureOffset on a REPEAT/NEAREST texture, which
  // wraps for free; the modulo arithmetic it replaced was a measurable share of
  // software-GL time at 18 steps a frame.
  const STEP = `#version 300 es
precision highp float;
uniform sampler2D sim;
uniform vec2 size;
out vec4 o;
vec2 path(float s) {
  const vec2 P0 = vec2(0.0300, 0.0710);
  const vec2 P1 = vec2(0.0367, 0.0649);
  const vec2 P2 = vec2(0.0290, 0.0570);
  const vec2 P3 = vec2(0.0545, 0.0620);
  const vec2 P4 = vec2(0.0290, 0.0570);
  s *= 4.0;
  if (s < 1.0) return mix(P0, P1, s);
  if (s < 2.0) return mix(P1, P2, s - 1.0);
  if (s < 3.0) return mix(P2, P3, s - 2.0);
  return mix(P3, P4, min(s - 3.0, 1.0));
}
#define AT(dx, dy) textureOffset(sim, uv, ivec2(dx, dy)).xy
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec4 s = texture(sim, uv);
  vec2 lap = -s.xy
    + 0.2 * (AT(1, 0) + AT(-1, 0) + AT(0, 1) + AT(0, -1))
    + 0.05 * (AT(1, 1) + AT(-1, 1) + AT(1, -1) + AT(-1, -1));
  vec2 fk = path(s.w);
  float u = s.x, v = s.y, uvv = u * v * v;
  u += lap.x - uvv + fk.x * (1.0 - u);
  v += 0.5 * lap.y + uvv - (fk.x + fk.y) * v;
  o = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), s.zw);
}`;

  // Sim-resolution prep, two targets:
  //   0: v, dv/dx, dv/dy, v blurred around a point toward the light (cast shadow)
  //   1: v − running average (growth > 0, recession < 0), regime value
  const PREP = `#version 300 es
precision highp float;
uniform sampler2D sim;
uniform vec2 size;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
float v(ivec2 c) {
  ivec2 n = ivec2(size);
  return texelFetch(sim, (c % n + n) % n, 0).y;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(sim, c, 0);
  float gx = (v(c + ivec2(1, 0)) - v(c - ivec2(1, 0))) * 0.5;
  float gy = (v(c + ivec2(0, 1)) - v(c - ivec2(0, 1))) * 0.5;
  ivec2 k = c + ivec2(-2, 2);   // light comes from the upper left
  float sh = (v(k) * 2.0 + v(k + ivec2(-2, 1)) + v(k + ivec2(1, 2)) + v(k + ivec2(2, -1)) + v(k + ivec2(-1, -2))) / 6.0;
  o0 = vec4(s.y, gx, gy, sh);
  o1 = vec4(s.y - s.z, s.w, 0.0, 1.0);
}`;

  const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D prepA;
uniform sampler2D prepB;
uniform vec2 simSize;
uniform vec2 res;
uniform float relief;
uniform vec3 cGround, cGhost, cDeep, cMain, cFresh, cSpec;
out vec4 o;
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
// Cubic B-spline from four bilinear taps: C2-smooth, so the lighting derived
// from it shows no grid, however far the sim is upscaled.
vec4 bicubic(sampler2D t, vec2 uv, vec2 ts) {
  uv = uv * ts - 0.5;
  vec2 f = fract(uv);
  uv -= f;
  vec4 xc = cubic(f.x), yc = cubic(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) / ts.xxyy;
  vec4 s0 = texture(t, off.xz), s1 = texture(t, off.yz), s2 = texture(t, off.xw), s3 = texture(t, off.yw);
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
float hash(vec2 p) { vec3 q = fract(p.xyx * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec4 a = bicubic(prepA, uv, simSize);
  vec4 b = texture(prepB, uv);
  float v = a.x;

  // Tissue coverage, antialiased at screen resolution.
  const float T = 0.17;
  float w = max(fwidth(v) * 0.9, 1e-4);
  float mask = smoothstep(T - w, T + w, v);

  // A rounded height profile; the chain rule turns the stored gradient of v
  // into the gradient of the height.
  const float H0 = 0.12, H1 = 0.36;
  float t = clamp((v - H0) / (H1 - H0), 0.0, 1.0);
  float H = t * t * (3.0 - 2.0 * t);
  vec2 dH = (6.0 * t * (1.0 - t) / (H1 - H0)) * a.yz;
  vec3 N = normalize(vec3(-dH * relief * 2.6, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.6, 0.65));
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = max(dot(N, L), 0.0);
  // x^32 by squaring: pow() is costly on software GL and this runs per pixel.
  float spec = max(dot(N, Hv), 0.0);
  spec *= spec; spec *= spec; spec *= spec; spec *= spec; spec *= spec;

  float grow = clamp(b.x * 7.0, 0.0, 1.0);
  float recede = clamp(-b.x * 7.0, 0.0, 1.0);

  // Tissue: deep in the crevices, full colour on the crowns, translucent glow
  // on thin edges (subsurface), paling to the fresh tone where it is growing.
  // Tone follows the regime map a little, so regions read as different
  // growths of one species rather than one flat fill.
  vec3 tissue = mix(cDeep, cMain * (1.12 - 0.3 * b.y), H);
  tissue *= 0.30 + 0.95 * diff;
  tissue += cMain * 0.22 * (1.0 - H) * mask;
  tissue = mix(tissue, cFresh * (0.6 + 0.6 * diff), grow * 0.85);

  // Ground: neutral, faintly lighter where the regime map is high, shadowed
  // by nearby tissue, and haunted by a ghost of what just receded.
  vec3 ground = cGround * (0.85 + 0.3 * b.y);
  ground *= 1.0 - 0.6 * smoothstep(0.1, 0.3, a.w);
  ground += cGhost * recede * 0.9;

  vec3 col = mix(ground, tissue, mask) + cSpec * spec * 0.25 * mask * relief;

  vec2 vc = uv - 0.5;
  col *= 1.0 - 0.35 * dot(vc, vc);
  col = sqrt(max(col, 0.0));   // gamma 2.0: palettes are squared in JS to match
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;   // dither: no banding in the dark ground
  o = vec4(col, 1.0);
}`;

  // Palettes: [ground, ghost, deep, main, fresh, spec], sRGB. Each is two
  // hues plus a neutral ground: the tissue's hue family and the ghost's.
  const PALETTES = [
    ['#0b1920', '#1d7a80', '#7a221f', '#ef7458', '#ffd8bd', '#fff1e6'],   // Coral: coral on teal ink
    ['#141519', '#50667a', '#5d5243', '#dcd2bf', '#fff7e4', '#ffffff'],   // Bone: ivory on graphite, slate ghost
    ['#03060b', '#4a2f8a', '#0a4552', '#33c9c0', '#d4fff5', '#e6ffff'],   // Abyss: cyan on black, violet ghost
  ];
  const hexToLinear = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2);

  VIZ.register({
    id: 'coral',
    name: 'Coral',
    order: 103,
    gallery: {
      title: 'Coral',
      technique: 'WebGL2 Gray-Scott reaction–diffusion on float ping-pong textures, with a spatially varying feed/kill map, a curl current, and a B-spline-upscaled lit display pass',
      brief: 'A living reef seen from above: coral, labyrinth and dividing spots grow side by side, their borders migrating on a slow current. The kick drops seed blots that bloom pale and age into colour; the drop pushes the whole reef toward splitting and churning, the breakdown lets it knit back into mazes.',
      lineage: [
        'Brief 03: Gray-Scott on the GPU, two hues plus a neutral, regimes drift with the track, kicks seed blots.',
        'Departure: a periodic feed/kill map instead of one global pair, so several regimes coexist and their fronts migrate — one pair alone freezes into a single texture.',
        'Added a divergence-free curl current (advect pass) so even the frozen labyrinth regime keeps shearing and re-healing.',
        'A third channel keeps a running average of v: growth reads pale, recession leaves a ghost of the second hue — motion is visible in a still frame.',
        'Display: cubic B-spline upscale, threshold with fwidth AA, height from smoothstep with chain-rule normals, cast shadow blurred at sim resolution.',
        'Render 1: beautiful but the drop barely differed from the breakdown and kick blots vanished into the maze. Doubled the regime push so the drop breaks labyrinth into dividing spots and the breakdown knits them back.',
        'Kicks became craters with a seed at the centre: a hole that blooms shut in pale new growth, instead of a dot lost in the pattern.',
        'Checked 96 s (alive, cycling, no saturation) and 900x900; cut per-pixel cost (squared gamma, spec by squaring, cheap hash) for the software-GL ceiling.',
        'Critic: wallpaper, candy sheen, music too quiet. Regime spread 0.4 to 0.7 and a dying end on the path, so dark voids drift and the reef invades and retreats; Detail 200 to 260, specular halved.',
        'Kicks now one crater of 12% of the short side each, stepping along a slow Lissajous walk; the drop drives steps per frame to the 18 cap so fronts race. Neighbour reads moved to textureOffset to pay for it.',
        'Extremes checked (Pattern 0 in Bone: islands in the dark; Pattern 1 in Abyss: dense). Removed the churning-worm end of the path (it melted into flat puddles in the drop) and a map that tiled the reef twice across 16:9.',
      ],
    },

    params: [
      { key: 'regime', label: 'Pattern', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'growth', label: 'Growth rate', type: 'range', min: 0.3, max: 2, default: 1, step: 0.01 },
      { key: 'current', label: 'Current', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'detail', label: 'Detail', type: 'range', min: 120, max: 320, default: 260, step: 1 },
      { key: 'music', label: 'Music depth', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'relief', label: 'Relief', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'palette', label: 'Palette', type: 'select', options: ['Coral', 'Bone', 'Abyss'], default: 0 },
    ],

    actions: [
      { id: 'reseed', label: 'Re-seed', run() { this.needSeed = true; } },
      { id: 'scatter', label: 'Scatter', run() { this.scatter = 10; } },
    ],

    gl: null,
    glFailed: false,

    setup() {},

    enter() {
      this.needSeed = true;
      this.scatter = 0;
      this.energy = 0;
      this.treble = 0;
      this.prevBass = 0;
      this.lastKick = -1;
      this.kickPhase = Math.random() * 20;
      this.flowT = 0;
      this.mapT = Math.random() * 100;   // a different regime layout each time
      this.lastMs = null;
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
      if (!gl) { this.glFailed = 'WebGL2 unavailable'; return; }
      // Full float is needed for the sim: half floats lose Gray-Scott's small
      // per-step increments near u = 1. Half float is a degraded fallback.
      const f32 = gl.getExtension('EXT_color_buffer_float');
      const f16 = f32 || gl.getExtension('EXT_color_buffer_half_float');
      if (!f16) { this.glFailed = 'no float render targets'; return; }
      this.simFormat = f32 ? gl.RGBA32F : gl.RGBA16F;

      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('coral shader: ' + gl.getShaderInfoLog(s));
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const program = (src, uniforms) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, src));
        gl.bindAttribLocation(prog, 0, 'pos');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('coral link: ' + gl.getProgramInfoLog(prog));
        const u = {};
        for (const n of uniforms) u[n] = gl.getUniformLocation(prog, n);
        return { prog, u };
      };
      this.pAdvect = program(ADVECT, ['sim', 'srcSize', 'dstSize', 'flow', 'flowT', 'zRate', 'regime', 'spread', 'mapT', 'blots', 'nBlots', 'ax']);
      this.pStep = program(STEP, ['sim', 'size']);
      this.pPrep = program(PREP, ['sim', 'size']);
      this.pDisplay = program(DISPLAY, ['prepA', 'prepB', 'simSize', 'res', 'relief', 'cGround', 'cGhost', 'cDeep', 'cMain', 'cFresh', 'cSpec']);

      const vao = gl.createVertexArray();
      this.vao = vao;
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.gl = gl;
      this.glCanvas = c;
      this.sim = null;
    },

    makeTarget(w, h, format, filter, data) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return tex;
    },

    fbo(texs) {
      const gl = this.gl;
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('coral: framebuffer incomplete');
      return fb;
    },

    // (Re)allocate the sim at w×h. If a sim exists, its state is resampled
    // into the new grid so changing Detail mid-set morphs rather than resets.
    allocSim(w, h) {
      const gl = this.gl;
      const old = this.sim;
      const init = new Float32Array(w * h * 4);
      for (let i = 0; i < w * h; i++) init[i * 4] = 1;
      const texs = [0, 1].map(() => this.makeTarget(w, h, this.simFormat, gl.NEAREST, init));
      const sim = { w, h, texs, fbs: texs.map((t) => this.fbo([t])), cur: 0 };
      const prep = [0, 1].map(() => this.makeTarget(w, h, gl.RGBA16F, gl.LINEAR));
      sim.prep = prep;
      sim.prepFb = this.fbo(prep);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sim.prepFb);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.sim = sim;
      if (old) {
        this.advect(old.texs[old.cur], old.w, old.h, 0, [], 0, 0.3, 0.3);
        old.texs.concat(old.prep).forEach((t) => gl.deleteTexture(t));
        old.fbs.concat([old.prepFb]).forEach((f) => gl.deleteFramebuffer(f));
      } else {
        this.needSeed = true;
      }
    },

    // Fresh start: an empty substrate with a scatter of seed blots, so the
    // first seconds are the reef blooming out of them.
    seed() {
      const gl = this.gl, { w, h } = this.sim;
      const data = new Float32Array(w * h * 4);
      for (let i = 0; i < w * h; i++) data[i * 4] = 1;
      const n = Math.round((w * h) / 900);
      for (let k = 0; k < n; k++) {
        const cx = Math.random() * w, cy = Math.random() * h, r = 1.5 + Math.random() * 4;
        const R = Math.ceil(r);
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const x = ((Math.floor(cx) + dx) % w + w) % w, y = ((Math.floor(cy) + dy) % h + h) % h;
            const j = (y * w + x) * 4;
            data[j] = 0.25; data[j + 1] = 0.5 + 0.1 * Math.random();
          }
        }
      }
      for (const t of this.sim.texs) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.simFormat, w, h, 0, gl.RGBA, gl.FLOAT, data);
      }
      this.sim.cur = 0;
    },

    advect(srcTex, sw, sh, flow, blots, zRate, regime, spread) {
      const gl = this.gl, sim = this.sim, P = this.pAdvect;
      const dst = 1 - sim.cur;
      gl.useProgram(P.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sim.fbs[dst]);
      gl.viewport(0, 0, sim.w, sim.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(P.u.sim, 0);
      gl.uniform2f(P.u.srcSize, sw, sh);
      gl.uniform2f(P.u.dstSize, sim.w, sim.h);
      gl.uniform1f(P.u.flow, flow);
      gl.uniform1f(P.u.flowT, this.flowT);
      gl.uniform1f(P.u.zRate, zRate);
      gl.uniform1f(P.u.regime, regime);
      gl.uniform1f(P.u.spread, spread);
      gl.uniform1f(P.u.mapT, this.mapT);
      gl.uniform1f(P.u.ax, Math.max(1, Math.round(sim.w / sim.h)));
      const arr = new Float32Array(32);
      blots.slice(0, 8).forEach((b, i) => arr.set(b, i * 4));
      gl.uniform4fv(P.u.blots, arr);
      gl.uniform1i(P.u.nBlots, Math.min(8, blots.length));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      sim.cur = dst;
    },

    draw(p, signals, params, ctx) {
      const dc = p.drawingContext;
      dc.globalAlpha = 1;
      dc.globalCompositeOperation = 'source-over';

      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (e) { this.glFailed = e.message; console.warn(e); }
      }
      if (!this.gl) {
        p.colorMode(p.RGB, 255);
        p.background(11, 25, 32);
        p.noStroke();
        p.fill(239, 116, 88);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text('Coral needs WebGL2 with float render targets (' + this.glFailed + ')', ctx.width / 2, ctx.height / 2);
        return;
      }
      if (this.energy === undefined) this.enter();
      const gl = this.gl;

      // Output canvas in device pixels; sim grid sized from Detail with the
      // stage's aspect, so cells stay square.
      const W = Math.round(p.width * p.pixelDensity());
      const Hh = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== W || this.glCanvas.height !== Hh) {
        this.glCanvas.width = W; this.glCanvas.height = Hh;
      }
      const detail = Math.round(params.detail);
      const sw = W >= Hh ? Math.round(detail * W / Hh) : detail;
      const sh = W >= Hh ? detail : Math.round(detail * Hh / W);
      if (!this.sim || this.sim.w !== sw || this.sim.h !== sh) this.allocSim(sw, sh);
      if (this.needSeed) { this.seed(); this.needSeed = false; }

      // Time step from the host clock (simulated in the harness), clamped so
      // a stall doesn't lurch the current.
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const fr = dt * 60;

      // Music. Bass feeds a slow envelope (the drop's weight) that moves the
      // regime; its onsets are kicks that seed blots. Hats speed the current.
      const bass = Math.max(signals[0], signals[1]) / 100;
      const hats = (signals[6] + signals[7] + signals[8]) / 300;
      const depth = params.music;
      const up = bass > this.energy ? 0.012 : 0.004;
      this.energy += (bass - this.energy) * up * fr;
      this.treble += (hats - this.treble) * 0.03 * fr;

      const blots = [];
      const t = ms / 1000;
      if (bass - this.prevBass > 0.22 && bass > 0.45 && t - this.lastKick > 0.18) {
        this.lastKick = t;
        // One large crater per kick, stepping along a slow Lissajous walk so
        // successive beats land as a trail of footprints across the reef
        // rather than as scattered noise.
        if (depth > 0.02) {
          this.kickPhase += 0.33;
          const a = this.kickPhase;
          const x = (0.5 + 0.42 * Math.sin(a * 1.0 + 0.7 * Math.sin(a * 0.31))) * sw;
          const y = (0.5 + 0.40 * Math.sin(a * 1.37 + 1.9)) * sh;
          const r = 0.12 * Math.min(sw, sh) * (0.6 + 0.4 * depth);
          blots.push([x, y, r, 1]);
        }
      }
      this.prevBass = bass;
      if (this.scatter > 0) {
        for (let k = 0; k < 5 && this.scatter > 0; k++, this.scatter--) {
          blots.push([Math.random() * sw, Math.random() * sh, 4 + Math.random() * 6, 0.6]);
        }
      }

      this.flowT += dt * (0.05 + 0.25 * this.treble * depth);
      this.mapT += dt * 0.025;
      const flow = params.current * (0.06 + 0.18 * this.treble * depth);
      const regime = params.regime + 0.8 * depth * this.energy;
      // The drop should be the most intense section: at default depth the
      // step count reaches the cap there, so growth fronts visibly race.
      const drive = Math.min(1, (depth / 0.7) * this.energy / 0.45);
      const iters = Math.max(1, Math.min(18, Math.round(params.growth * (6 + 12 * drive))));

      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.vao);

      const sim = this.sim;
      this.advect(sim.texs[sim.cur], sw, sh, flow, blots, 0.008 * fr, regime, 0.7);

      gl.useProgram(this.pStep.prog);
      gl.uniform1i(this.pStep.u.sim, 0);
      gl.uniform2f(this.pStep.u.size, sw, sh);
      gl.activeTexture(gl.TEXTURE0);
      for (let i = 0; i < iters; i++) {
        const dst = 1 - sim.cur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, sim.fbs[dst]);
        gl.bindTexture(gl.TEXTURE_2D, sim.texs[sim.cur]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        sim.cur = dst;
      }

      gl.useProgram(this.pPrep.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sim.prepFb);
      gl.bindTexture(gl.TEXTURE_2D, sim.texs[sim.cur]);
      gl.uniform1i(this.pPrep.u.sim, 0);
      gl.uniform2f(this.pPrep.u.size, sw, sh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const D = this.pDisplay;
      gl.useProgram(D.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, Hh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sim.prep[0]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, sim.prep[1]);
      gl.uniform1i(D.u.prepA, 0);
      gl.uniform1i(D.u.prepB, 1);
      gl.uniform2f(D.u.simSize, sw, sh);
      gl.uniform2f(D.u.res, W, Hh);
      gl.uniform1f(D.u.relief, params.relief);
      const pal = PALETTES[Math.round(params.palette) % PALETTES.length].map(hexToLinear);
      ['cGround', 'cGhost', 'cDeep', 'cMain', 'cFresh', 'cSpec'].forEach((n, i) => gl.uniform3fv(D.u[n], pal[i]));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0);

      dc.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
