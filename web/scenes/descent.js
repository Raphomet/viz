// Descent — a slow flight down a tunnel bored through an Apollonian fractal.
//
// The structure is the classic inversion fractal (fold space into a cell,
// invert in a sphere, repeat), infinite in every direction. A winding tunnel
// is carved through it along a smooth path so the camera can fly forever
// without hitting anything, and the walls of that tunnel are the fractal's
// foam of spheres-inside-spheres: somewhere to fall into.
//
// Layers, back to front:
//  1. fog and a core light at the far end of the tunnel (the "vanishing sun");
//  2. the fractal walls, coloured by orbit traps, lit by a headlight, with
//     step-count ambient occlusion;
//  3. volumetric glow accumulated from near misses, and the kick shells;
//  4. a cheap bloom (the GL frame shrunk twice and laid back on additively);
//  5. drifting 3D motes in the tunnel, projected with the same camera and
//     drawn as motion streaks on the full-resolution canvas.
//
// The raymarch runs at a fraction of the canvas resolution and is upscaled
// with smoothing; the fog, glow and bloom hide the softness, and the motes on
// top are drawn at full resolution so the frame still reads as sharp.
//
// Music:
//  - kick: an expanding shell of light leaves the camera and races down the
//    tunnel, lighting every wall it passes; the camera lurches forward (a
//    zoom punch and a speed surge) and the core light and bloom swell.
//  - snare/clap: the fractal refolds (its inversion radius jolts and relaxes)
//    and the whole palette turns a step round the colour wheel.
//  - bass/pad: the tunnel breathes wider, the fold slowly morphs, glow deepens.
//  - hats: specular glints wink on the walls and the motes twinkle.
//  - section energy: the drop speeds the flight, saturates the colour and
//    brings in more motes; the breakdown slows, cools and exhales.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;
uniform float time;
uniform vec3  ro, fw, rt, up;
uniform float focal;
uniform float fold;      // inversion constant of the Apollonian fold
uniform float tunR;      // tunnel radius
uniform vec4  shellD;    // distances of the last four kick shells
uniform vec4  shellA;    // their amplitudes
uniform float punch, hat, energy, glowAmt, palPhase, sat, bright;
uniform vec3  cDeep, cMid, cHot, cGlow, cCore, cFog;
uniform vec3  coreDir;
uniform float hatSeed;
uniform float filmShift, jolt, box;
out vec4 outColor;

vec2 path(float z) {
  return vec2(1.7 * sin(z * 0.21) + 0.9 * sin(z * 0.093 + 1.3),
              1.25 * cos(z * 0.17) + 0.75 * sin(z * 0.071 + 2.0));
}

const float FS = 3.6;   // fractal cells per world unit: sets the grain of the walls

float gF, gT;   // the fractal and tunnel terms of the last map() call

float map(vec3 p, out vec4 trap) {
  vec3 q = p * FS;
  float sc = 1.0;
  trap = vec4(1e3);
  for (int i = 0; i < 6; i++) {
    // The fold cell's size drifts: a few percent changes which spheres
    // exist at all, so the foam slowly becomes a different structure.
    q = -box + 2.0 * box * fract(0.5 * q / box + 0.5);
    float r2 = dot(q, q);
    trap = min(trap, vec4(abs(q), r2));
    float k = fold / r2;
    q *= k;
    sc *= k;
  }
  float dF = 0.25 * abs(q.y) / sc / FS;
  // Intersect with the outside of a cylinder around the flight path: the
  // tunnel. Without it the camera would fly straight into a wall within a
  // few seconds, since the fractal fills space.
  float dT = tunR - length(p.xy - path(p.z));
  gF = dF; gT = dT;
  return max(dF, dT);
}

float mapD(vec3 p) { vec4 t; return map(p, t); }

vec3 calcNormal(vec3 p, float e) {
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) +
                   k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

float shell(float t) {
  vec4 d = (vec4(t) - shellD) / 0.32;
  return dot(shellA, exp(-d * d));
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  vec3 rd = normalize(fw * focal + rt * uv.x + up * uv.y);

  // Fog colour with the core light ahead.
  float cd = max(dot(rd, coreDir), 0.0);
  vec3 fogNear = cFog * (0.5 + 0.5 * energy);
  // Rays that escape through a bubble's open interior end in this far haze.
  // It stays nearly black except toward the core: a bright far haze turned
  // every open bubble into a flat pink disc with its rim cut out.
  vec3 fogFar = cMid * (0.015 + 0.02 * energy + (0.04 + 0.2 * energy + 0.35 * punch) * pow(cd, 12.0));
  vec3 core = cCore * pow(cd, 160.0) * (0.9 + 2.4 * punch)
            + mix(cMid, cHot, 0.4) * pow(cd, 10.0) * (0.017 + 0.14 * punch + 0.06 * energy);

  float t = 0.02;
  float glow = 0.0, sglow = 0.0;
  vec4 trap;
  float d = 1.0;
  int steps = 0;
  bool hit = false;
  const float TMAX = 6.0;
  for (int i = 0; i < 56; i++) {
    vec3 p = ro + rd * t;
    d = map(p, trap);
    // Weighted by the step taken, so the glow is a line integral and does
    // not depend on how many steps a ray happens to need.
    float ds = max(d * 0.9, 0.004);
    glow += exp(-d * 60.0) * ds;
    sglow += exp(-d * 30.0) * shell(t) * ds;
    if (d < 0.0018 * t) { hit = true; break; }
    t += d * 0.9;
    steps = i;
    if (t > TMAX) break;
  }

  vec3 col;
  if (hit) {
    // Where the tunnel wall, not the fractal, is the surface hit, the
    // cylinder has sliced through foam too dense to resolve. Its normal is
    // radial, so it faces across the view and a rim term lit it fully:
    // that was the flat disc in every frame of rounds 1-2. Cut faces stay
    // dark; only the fractal's own sheets carry rims.
    float cut = smoothstep(-0.002, 0.002, gT - gF);
    // The fractal's surfaces are |y| sheets: a gradient taken across one
    // cancels to noise, so every normal came out random and the rim term
    // lit whole shells as flat discs (rounds 1-3). Back off the hit along
    // the ray and sample well inside that margin, so the taps stay on one
    // side of the sheet.
    vec3 p = ro + rd * (t - 0.006 * t - 0.002);
    vec3 n = calcNormal(p, 0.0015 * t + 0.0005);
    float ao = 1.0 - float(steps) / 56.0;
    ao *= clamp(sqrt(trap.w) * 1.4, 0.15, 1.0);

    // Orbit-trap colouring, smooth and periodic so there are no seams.
    float tc = 0.5 + 0.5 * sin(3.1 * trap.x + 2.3 * trap.z + 1.6 * log(trap.w + 1e-3) + palPhase);
    vec3 base = tc < 0.5 ? mix(cDeep, cMid, tc * 2.0) : mix(cMid, cHot, tc * 2.0 - 1.0);

    // Headlight: a point light riding with the camera.
    float dif = max(dot(n, -rd), 0.0);
    float att = 1.0 / (1.0 + t * t * 0.45);
    vec3 h = normalize(-rd + normalize(vec3(0.3, 0.6, -0.2)));
    float spec = pow(max(dot(n, -rd), 0.0), 24.0);
    float rim = pow(1.0 - dif, 4.0);
    // Bodies near black, light only on the rims and in the embers: luminous
    // edges on a black void. A diffuse fill (round 1) made every open bubble
    // a muted mauve disc, and those discs' hard dark cut-outs were what showed
    // the upscale's staircase.
    vec3 edge = mix(cMid, cHot, smoothstep(0.3, 1.0, tc));
    col = base * 0.012 * ao;
    col += edge * rim * (0.5 + 2.8 * att) * ao * (1.0 - cut);
    // No orbit-trap emission: an "ember" term on small trap.w (round 2) lit
    // whole big shells evenly and was the source of the flat discs. The
    // small bubbles glow through their rims instead.
    // Thin-film sheen at grazing angles: every bubble gets an iridescent
    // rim, which is what draws the eye into the foam instead of reading its
    // shells as flat grey discs.
    float fres = pow(1.0 - dif, 2.0);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (1.6 * fres + 0.8 * tc + filmShift) + vec3(0.0, 2.1, 4.2));
    col += film * rim * (0.3 + 1.6 * jolt) * ao * (0.25 + att) * (1.0 - cut);
    col += cHot * spec * att * 0.12;

    // Hats: sparse glints on the walls, a fresh set on every hat.
    float g = hash13(floor(p * 150.0) + hatSeed);
    float glint = smoothstep(1.0 - 0.025 * hat, 1.0, g) * hat;
    col += (cHot + 0.6) * glint * 3.0 * att * (0.3 + fres);

    // Kick shells light the walls they pass through.
    col += cGlow * shell(t) * (0.3 + 2.2 * fres * (1.0 - cut)) * (0.4 + 0.6 * ao);
  } else {
    t = TMAX;
    col = vec3(0.0);
  }

  // Fog toward the core; the core itself shines through the far end.
  float fogAmt = 1.0 - exp(-t * (0.26 - 0.08 * energy));
  // Fog deepens from the palette's deep colour near to its mid colour far
  // away, so depth itself is a gradient toward the core.
  vec3 fogC = mix(fogNear, fogFar, smoothstep(1.5, 6.0, t));
  col = mix(col, fogC, fogAmt);
  // The core is behind the walls: it shines through only as far as the fog
  // does, or near surfaces read as ghostly beige discs lit from inside.
  col += core * (hit ? fogAmt * fogAmt * fogAmt : 1.0);

  // Volumetric glow of near misses, and the shells as rings of light in the air.
  col += mix(cMid, cHot, 0.3) * glow * glowAmt * 0.035;
  col += cGlow * sglow * 0.35;

  // Breakdown desaturates a little.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, sat) * bright;

  // Vignette, then a soft shoulder so peaks bloom instead of clipping flat.
  float v = 1.0 - 0.45 * dot(uv, uv);
  col *= v;
  // A gentle toe: pushes the murky mid-purples of the far foam down toward
  // black so the lit rims and the core carry the frame.
  col = col * col / (col + 0.02);
  col = 1.0 - exp(-col * 1.1);
  outColor = vec4(pow(col, vec3(0.4545)), 1.0);
}`;

  // Pass 2: B-spline bicubic upscale of the march buffer to twice its size
  // (four bilinear taps). Canvas drawImage is bilinear, which kept every
  // low-res step of a dark edge; the B-spline is a smooth reconstruction,
  // slightly soft, which suits fog and glow.
  const UPFRAG = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform vec2 srcRes, outRes;
out vec4 outColor;
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) / 6.0;
}
void main() {
  vec2 tc = gl_FragCoord.xy / outRes * srcRes - 0.5;
  vec2 f = fract(tc); tc -= f;
  vec4 xc = cubic(f.x), yc = cubic(f.y);
  vec4 c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) / srcRes.xxyy;
  vec4 s0 = texture(src, o.xz), s1 = texture(src, o.yz), s2 = texture(src, o.xw), s3 = texture(src, o.yw);
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  outColor = mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}`;

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => Math.pow(c, 2.2));
  }

  // Each palette is a deep → mid → hot gradient for the walls, a glow colour
  // chosen as the walls' complement (the kick shells and rim light), the
  // core light, and the fog. Complement on glow is what makes the kick shell
  // read against the walls instead of merely brightening them.
  const PALETTES = [
    { name: 'Nebula coral', deep: '#14052e', mid: '#ff2f7e', hot: '#ffb14a', glow: '#1fe3ff', core: '#ffe2b8', fog: '#06020f' },
    { name: 'Abyssal', deep: '#021a24', mid: '#14d2c0', hot: '#c8fff0', glow: '#b05cff', core: '#c4f2ff', fog: '#010509' },
    { name: 'Acid', deep: '#081a06', mid: '#7cf022', hot: '#fff05a', glow: '#ff2fc8', core: '#fff6e0', fog: '#030503' },
    { name: 'Ember', deep: '#240402', mid: '#ff4a12', hot: '#ffd27a', glow: '#2f86ff', core: '#ffe4b8', fog: '#070201' },
  ].map((p) => ({ name: p.name, deep: hex(p.deep), mid: hex(p.mid), hot: hex(p.hot), glow: hex(p.glow), core: hex(p.core), fog: hex(p.fog) }));

  // Same path as the shader.
  function path(z) {
    return [1.7 * Math.sin(z * 0.21) + 0.9 * Math.sin(z * 0.093 + 1.3),
      1.25 * Math.cos(z * 0.17) + 0.75 * Math.sin(z * 0.071 + 2.0)];
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  const MOTES = 180;

  VIZ.register({
    id: 'descent',
    name: 'Descent',
    order: 207,

    params: [
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'react', label: 'Music reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'fold', label: 'Fold', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'width', label: 'Tunnel width', type: 'range', min: 0.5, max: 1.6, default: 1, step: 0.01 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'detail', label: 'Render lines', type: 'range', min: 120, max: 480, default: 180, step: 1 },
    ],

    gallery: {
      title: 'Descent',
      technique: 'WebGL2 raymarch of an Apollonian (sphere-inversion) fractal with a tunnel carved along a winding path, orbit-trap colour, step-count AO, volumetric glow, rendered at reduced resolution and upscaled; 2D shrink-and-add bloom and projected 3D motes on top',
      brief: 'A slow flight down a winding tunnel through foam of spheres within spheres, toward a warm light at the far end. Each kick sends a shell of light racing away from you down the tunnel, lighting every wall it passes, while the camera lurches forward and the far light swells. Each clap refolds the fractal for a moment and flares the rainbow sheen on the bubble rims, turning it a step round the wheel. Bass breathes the tunnel wider; hats wink glints on the walls and twinkle the motes. The drop speeds the flight and floods it with colour; the breakdown slows, cools and exhales.',
      lineage: [
        'Brief 07 (Descent): raymarched fractal fly-through, kicks pulse glow, snare shifts the fold, bass morphs, hats glint, drop accelerates.',
        'Apollonian fractal after Inigo Quilez; a tunnel is carved along a sum-of-sines path so the flight never collides and there is always a far end to fall toward.',
        'Kick as a travelling shell (from Interference, the one batch-01 scene whose music Raph could see): the beat moves through the space instead of flashing on it.',
        'Render 1: whiteout. Glow was summed per step (so it scaled with step count) and the drop saturated to white; the fractal was so coarse the camera sat inside one giant bubble. Glow became a line integral weighted by step length, and the fractal was scaled up so the tunnel runs through foam.',
        'Render 2-3: kick landed clearly, but the palette-wide hue turn on the snare took curated colours to olive. The snare now turns only the thin-film iridescence on the bubble rims (and refolds the fractal), which reads as a separate event and keeps the palette.',
        'Render 4-7: big open bubbles read as flat grey, then beige, then pink discs. Traced to rays escaping through bubble interiors into a bright far haze, and to core light added through the fog onto near walls. Walls are now rim-lit (face-on shells dark, edges bright), the core is occluded by the walls, the far haze stays near black except toward the core, and a gentle toe pulls the murky mids down.',
        'Raymarch renders a fixed number of lines (Render lines, default 180) whatever the canvas size, upscaled with smoothing under a shrink-and-add bloom whose source is squared twice as a soft threshold; the motes on top are full resolution.',
        'Lead review: resting state was mauve mud with staircased cut-outs, the core always centred, minute to minute alike. Round 2: bodies near black with light on the rims only; a second GL pass upscales the march 2x with a B-spline bicubic (the staircase softened visibly at 1280x720); the gaze wanders off the path and the path swings wider, so the core travels the frame; fold and fold-cell size drift on ~65 s and ~95 s cycles (the 96 s run passes through red foam, gold lattice and cyan-lit halls). All four palettes rendered side by side; Nebula coral (coral and amber walls, cyan kick shells) kept as default for its drop.',
        'Two false leads on the flat discs, each ruled out by a render: an orbit-trap ember term, and the tunnel cylinder cut faces (now kept dark anyway). The real cause was normals: the surfaces are |y| sheets, and a gradient sampled across one is noise, so the rim term lit whole shells. The hit is now backed off along the ray before the normal is sampled; the discs dimmed but a red glow through the open voids remains (core halo and far in-scatter).',
      ],
    },

    gl: null, glCanvas: null, glFailed: false,

    enter() {
      this.lastMs = null;
      this.z = 0;
      this.clock = 0;
      this.shells = [];            // { t, a }
      this.punch = 0;
      this.jolt = 0;
      this.hueRot = 0;
      this.hueTarget = 0;
      this.prev = new Float32Array(9);
      this.lastKick = -1;
      this.lastClap = -1;
      this.lastHat = -1;
      this.hatSeed = 0;
      this.env = { bass: 0, hat: 0, energy: 0, thump: 0 };
      this.motes = [];
      for (let i = 0; i < MOTES; i++) this.motes.push(this.spawnMote(Math.random() * 6 + 0.3, i));
    },

    spawnMote(ahead, i) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.4;
      return { dz: ahead, ox: Math.cos(a) * r, oy: Math.sin(a) * r, seed: Math.random(), tw: 0, i, prev: null };
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
      const link = (fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'pos');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        return pr;
      };
      const prog = link(FRAG);
      const up = link(UPFRAG);
      this.prog = prog; this.upProg = up;
      this.uUp = { src: gl.getUniformLocation(up, 'src'), srcRes: gl.getUniformLocation(up, 'srcRes'), outRes: gl.getUniformLocation(up, 'outRes') };
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fbo = gl.createFramebuffer();
      this.fboW = 0; this.fboH = 0;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      const u = {};
      for (const n of ['res', 'time', 'ro', 'fw', 'rt', 'up', 'focal', 'fold', 'tunR', 'shellD', 'shellA',
        'punch', 'hat', 'energy', 'glowAmt', 'palPhase', 'filmShift', 'jolt', 'sat', 'bright',
        'cDeep', 'cMid', 'cHot', 'cGlow', 'cCore', 'cFog', 'coreDir', 'hatSeed', 'box']) u[n] = gl.getUniformLocation(prog, n);
      this.gl = gl; this.glCanvas = c; this.u = u;
      this.bloomA = document.createElement('canvas');
      this.bloomB = document.createElement('canvas');
    },

    // Onsets from band rises: a percussive hit jumps a band in one frame,
    // while pads and bass lines swell or step by less.
    listen(s, dt, now, react) {
      const e = this.env;
      const k = s[0] / 100, kRise = k - this.prev[0] / 100;
      const c = s[4] / 100, cRise = c - this.prev[4] / 100;
      const h = s[8] / 100, hRise = h - this.prev[8] / 100;
      this.prev.set(s);

      if (kRise > 0.45 && now - this.lastKick > 0.2) {
        this.lastKick = now;
        const a = Math.min(1, kRise * 1.15);
        this.shells.unshift({ t: now, a });
        if (this.shells.length > 4) this.shells.length = 4;
        this.punch = Math.max(this.punch, a);
      }
      if (cRise > 0.3 && now - this.lastClap > 0.1) {
        this.lastClap = now;
        const a = Math.min(1, cRise * 1.3);
        this.jolt = Math.max(this.jolt, a);
        this.hueTarget += 0.3 * a * Math.min(react, 1.5);
      }
      if (hRise > 0.2 && now - this.lastHat > 0.05) {
        this.lastHat = now;
        this.hatSeed = (this.hatSeed + 17.31) % 1000;
      }

      // Punch and jolt decay fast so each beat is its own event.
      this.punch *= Math.exp(-dt / 0.16);
      this.jolt *= Math.exp(-dt / 0.3);
      e.hat = ease(e.hat, h, h > e.hat ? 30 : 7, dt);
      const bass = (s[1] + s[2] + s[3]) / 300;
      e.bass = ease(e.bass, bass, 1.5, dt);
      e.thump = ease(e.thump, k, k > e.thump ? 30 : 5, dt);
      const en = Math.min(1, ((s[0] + s[1]) / 200 * 1.6 + (s[6] + s[7] + s[8]) / 300 * 1.2));
      e.energy = ease(e.energy, en, en > e.energy ? 1.2 : 0.35, dt);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.lastMs === undefined) this.enter();
      const ms = p.millis();
      const now = ms / 1000;
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const react = params.react;
      this.listen(signals, dt, now, react);
      const e = this.env;
      const E = e.energy;
      const pal = PALETTES[(params.palette | 0) % PALETTES.length];

      // ---- flight
      const punch = this.punch * react;
      const speed = params.speed * (0.45 + 0.6 * E + 0.9 * punch);
      this.z += speed * dt;
      this.clock += dt;
      const T = this.clock;
      const z = this.z;
      const pc = path(z);
      const ro = [pc[0], pc[1], z];
      // Look only a short way down the path, and let the gaze wander off it:
      // the tunnel's far end (and the core with it) then swings round the
      // frame instead of sitting dead centre.
      const la = path(z + 0.9);
      const wx = 0.28 * Math.sin(T * 0.061 + 0.7) + 0.12 * Math.sin(T * 0.137);
      const wy = 0.2 * Math.sin(T * 0.047 + 2.1) + 0.1 * Math.sin(T * 0.113 + 1);
      const fw = norm(sub([la[0] + wx, la[1] + wy, z + 0.9], ro));
      // Bank into the curve, plus a slow roll so the view never settles.
      const ahead = path(z + 3);
      const bank = 0.25 * (ahead[0] - la[0]) + 0.5 * Math.sin(T * 0.037) + 0.25 * Math.sin(T * 0.071 + 1);
      const upRef = [Math.sin(bank), Math.cos(bank), 0];
      const rt = norm(cross(upRef, fw));
      const up = cross(fw, rt);
      const focal = 1.1 * (1 + 0.16 * punch);
      const cp = path(z + 5);
      const coreDir = norm(sub([cp[0], cp[1], z + 5], ro));

      // ---- structure
      // Fold and cell size drift on incommensurate ~65 s and ~95 s cycles, so
      // over a minute the foam passes through visibly different structures.
      const fold = 1.08 + 0.2 * params.fold + 0.07 * Math.sin(T * 2 * Math.PI / 65) + 0.025 * Math.sin(T * 0.19)
        + 0.05 * react * e.bass + 0.09 * react * this.jolt;
      const tunR = params.width * (0.36 + 0.06 * Math.sin(T * 0.05) + 0.07 * react * e.bass + 0.03 * react * e.thump);

      // Each clap turns the iridescence a step round the wheel. Turning the
      // whole palette instead (tried first) took curated colours to olive.
      this.hueRot = ease(this.hueRot, this.hueTarget, 9, dt);

      const shellSpeed = 5.5;
      const sD = [99, 99, 99, 99], sA = [0, 0, 0, 0];
      this.shells.forEach((s, i) => {
        const age = now - s.t;
        sD[i] = 0.15 + age * shellSpeed;
        sA[i] = s.a * react * Math.exp(-age / 0.9);
      });

      // ---- render
      const W = Math.round(p.width * p.pixelDensity());
      const H = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0); p.noStroke(); p.fill(236); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Descent needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      // The raymarch renders a fixed number of lines whatever the canvas
      // size, so its cost is set by the performer, not by the projector.
      const gh = Math.max(36, Math.min(H, Math.round(params.detail)));
      const gw = Math.max(64, Math.round(gh * W / H));
      const gl = this.gl, u = this.u;
      const ow = Math.min(W, gw * 2), oh = Math.min(H, gh * 2);
      if (this.glCanvas.width !== ow || this.glCanvas.height !== oh) {
        this.glCanvas.width = ow; this.glCanvas.height = oh;
      }
      if (this.fboW !== gw || this.fboH !== gh) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gw, gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
        this.fboW = gw; this.fboH = gh;
      }
      gl.useProgram(this.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, gw, gh);
      gl.uniform1f(u.box, 1.0 + 0.09 * Math.sin(T * 2 * Math.PI / 95 + 1.0));
      gl.uniform2f(u.res, gw, gh);
      gl.uniform1f(u.time, T);
      gl.uniform3fv(u.ro, ro); gl.uniform3fv(u.fw, fw); gl.uniform3fv(u.rt, rt); gl.uniform3fv(u.up, up);
      gl.uniform1f(u.focal, focal);
      gl.uniform1f(u.fold, fold);
      gl.uniform1f(u.tunR, tunR);
      gl.uniform4fv(u.shellD, sD);
      gl.uniform4fv(u.shellA, sA);
      gl.uniform1f(u.punch, punch);
      gl.uniform1f(u.hat, Math.min(1, e.hat * react * 1.3));
      gl.uniform1f(u.energy, E);
      gl.uniform1f(u.glowAmt, params.glow * (0.5 + 0.8 * E + 0.6 * react * e.bass));
      gl.uniform1f(u.palPhase, T * 0.05);
      gl.uniform1f(u.filmShift, this.hueRot + T * 0.02);
      gl.uniform1f(u.jolt, this.jolt * react);
      gl.uniform1f(u.sat, 1.1 + 0.15 * E);
      gl.uniform1f(u.bright, 0.85 + 0.4 * E);
      gl.uniform3fv(u.cDeep, pal.deep); gl.uniform3fv(u.cMid, pal.mid); gl.uniform3fv(u.cHot, pal.hot);
      gl.uniform3fv(u.cGlow, pal.glow); gl.uniform3fv(u.cCore, pal.core); gl.uniform3fv(u.cFog, pal.fog);
      gl.uniform3fv(u.coreDir, coreDir);
      gl.uniform1f(u.hatSeed, this.hatSeed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(this.upProg);
      gl.viewport(0, 0, ow, oh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(this.uUp.src, 0);
      gl.uniform2f(this.uUp.srcRes, gw, gh);
      gl.uniform2f(this.uUp.outRes, ow, oh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const g2 = p.drawingContext;
      g2.save();
      g2.globalCompositeOperation = 'source-over';
      g2.globalAlpha = 1;
      g2.imageSmoothingEnabled = true;
      g2.imageSmoothingQuality = 'high';
      g2.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);

      // ---- bloom: shrink twice with smoothing, lay back additively.
      const bw = Math.max(8, Math.round(gw / 4)), bh = Math.max(4, Math.round(gh / 4)); // quarter of the march buffer
      const A = this.bloomA, B = this.bloomB;
      if (A.width !== bw || A.height !== bh) { A.width = bw; A.height = bh; }
      const cw = Math.max(4, Math.round(bw / 3)), ch = Math.max(2, Math.round(bh / 3));
      if (B.width !== cw || B.height !== ch) { B.width = cw; B.height = ch; }
      const ac = A.getContext('2d'), bc = B.getContext('2d');
      ac.imageSmoothingEnabled = true; bc.imageSmoothingEnabled = true;
      ac.globalCompositeOperation = 'source-over';
      ac.drawImage(this.glCanvas, 0, 0, bw, bh);
      // Multiplying the small image by itself twice is a soft threshold
      // (x^4): only the bright cores bloom, the midtones do not fog over.
      ac.globalCompositeOperation = 'multiply';
      ac.drawImage(A, 0, 0);
      ac.drawImage(A, 0, 0);
      ac.globalCompositeOperation = 'source-over';
      bc.drawImage(A, 0, 0, cw, ch);
      g2.globalCompositeOperation = 'lighter';
      // Bloom follows the section: calm passages get almost none, so they
      // stay rims in a dark void; the drop's bloom level is as before.
      g2.globalAlpha = Math.min(1, 0.06 + 0.55 * E + 0.5 * punch);
      g2.drawImage(A, 0, 0, ctx.width, ctx.height);
      g2.globalAlpha = Math.min(1, 0.08 + 0.75 * E + 0.55 * punch);
      g2.drawImage(B, 0, 0, ctx.width, ctx.height);

      // ---- motes: points in the tunnel, projected with the shader's camera.
      const Hs = ctx.height, Ws = ctx.width;
      const project = (P) => {
        const v = sub(P, ro);
        const zc = dot(v, fw);
        if (zc < 0.05) return null;
        return [Ws / 2 + (dot(v, rt) / zc) * focal * Hs, Hs / 2 - (dot(v, up) / zc) * focal * Hs, zc];
      };
      const live = Math.round(MOTES * (0.25 + 0.75 * E));
      const glowC = pal.glow.map((c) => Math.round(255 * Math.pow(c, 0.4545)));
      const hotC = pal.hot.map((c) => Math.round(255 * Math.pow(c, 0.4545)));
      g2.lineCap = 'round';
      for (const m of this.motes) {
        const wz = z + m.dz;
        if (m.dz < 0.08) {
          Object.assign(m, this.spawnMote(5 + Math.random() * 2, m.i));
          continue;
        }
        m.dz -= speed * dt * 0.999;
        const pp = path(wz);
        const P = [pp[0] + m.ox * tunR / 0.36, pp[1] + m.oy * tunR / 0.36, wz];
        const s = project(P);
        const prev = m.prev;
        m.prev = s;
        if (m.i >= live || !s || !prev) continue;
        // Twinkle: each hat flips a random half of the motes bright.
        const tw = ((Math.sin(m.seed * 991 + this.hatSeed * 3.7) * 43758.5) % 1 + 1) % 1;
        const spark = tw > 0.5 ? e.hat * react : 0;
        const near = Math.min(1, 1.2 / s[2]);
        const a = Math.min(1, (0.15 + 0.6 * near) * (0.5 + 0.5 * E) + 1.4 * spark * near);
        const col = m.seed < 0.5 ? glowC : hotC;
        g2.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
        g2.lineWidth = Math.max(0.6, 2.4 * near * (1 + 1.5 * spark));
        g2.beginPath();
        g2.moveTo(prev[0], prev[1]);
        g2.lineTo(s[0] + 0.01, s[1]);
        g2.stroke();
      }
      g2.restore();
    },
  });
})();
