// Stargate — the slit-scan corridor from 2001, flown at speed.
//
// Two walls of streaming light run past on either side, converging on a
// vanishing point where the corridor glows; above and below them is deep
// space, stars racing outward and a nebula streaming past. In the drop a
// floor and a ceiling of light fade in, so the view becomes the four-plane
// gate, and the colour fields turn hot.
//
// Craft notes:
// - Everything is a ray cast against flat planes in one fragment shader. A
//   wall at x = ±W is hit at depth z = F·W/|x|, so a wall pixel has a height
//   h and a world position zw = z + camZ along the flight. The slit-scan look
//   is a pattern that varies fast across h and slowly along zw: light smeared
//   along the direction of travel.
// - Anti-aliasing is analytic. Each filament is widened to the pixel's
//   footprint in h (fwidth) and dimmed by the same factor, so energy is
//   conserved and the far end melts into a glow instead of shimmering.
// - The music is found as onsets in JS (the same detectors as Aurora) and
//   handed to the shader as things that live in the corridor's world: a
//   flared panel on a wall for a kick, a pattern front for a snare. They are
//   born some way down the corridor, so they start small and then rush past
//   with the flight: the beat is legible without moving the whole frame.
// - Light is accumulated in linear and tone-mapped with 1 - e^-x.

(function () {
  const RES = 0.7;      // GL layer at this fraction of device resolution
  const F = 1.15;       // focal length in short-half-side units
  const W = 1.0;        // wall distance from the axis
  const HC = 1.0;       // floor / ceiling distance
  const WC = 0.42;      // floor / ceiling half-width
  const LP = 2.0;       // panel length along the flight
  const MAXB = 3;       // pattern fronts in flight

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;
uniform float T, camZ, starPh, Hw, planes, roll, lp;
uniform vec2  vp;
uniform float bass, drop, hat, hatSeed, speed, starK, coreK;
uniform float bz[3];      // pattern fronts, depth relative to camera
uniform float bA[3];      // their seam brightness
uniform float bseed[4];   // pattern seeds: nearest region first
uniform vec4  kp[4];      // kick panels: plane, rel z start, c0, c1 (fractions)
uniform float kA[4];      // their brightness
uniform vec3  c0, c1, c2, h0, h1, h2, cAcc, cCore;
out vec4 outColor;
const float F = ${F.toFixed(3)}, W = ${W.toFixed(3)}, HC = ${HC.toFixed(3)}, WC = ${WC.toFixed(3)};

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

// The colour fields: three calm colours that the drop shifts to three hot
// ones, read cyclically.
vec3 field(float k) {
  k = fract(k / 3.0) * 3.0;
  vec3 a0 = mix(c0, h0, drop), a1 = mix(c1, h1, drop), a2 = mix(c2, h2, drop);
  if (k < 1.0) return mix(a0, a1, smoothstep(0.0, 1.0, k));
  if (k < 2.0) return mix(a1, a2, smoothstep(1.0, 2.0, k));
  return mix(a2, a0, smoothstep(2.0, 3.0, k));
}

// One surface's light. c runs across the plane, zw along the flight; fc and
// fz are the pixel's footprint in each.
vec3 surface(float c, float zw, float z, float fc, float fz, float seed) {
  float s = seed * 17.31;
  // Along-travel detail fades out where many world units share a pixel.
  float zk = clamp(1.0 - fz * 0.35, 0.0, 1.0);
  float wv = (n2(vec2(c * 1.1 + s, zw * 0.06)) - 0.5) * 0.8;
  float I = 0.0;
  float Fq = 5.0 + 3.0 * fract(seed * 0.618);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = (c + wv * (1.0 - 0.3 * fi)) * Fq + s * (fi + 1.0);
    float id = floor(x);
    float on = h21(vec2(id, s + fi * 31.0));
    on = smoothstep(0.35, 0.95, on);
    // Each filament fades in and out along the flight: streaks, not rails.
    float run = n2(vec2(id * 3.1 + fi * 11.0, zw * (0.045 + 0.03 * fi) + s));
    run = mix(0.5, smoothstep(0.3, 0.8, run), zk);
    float d = abs(fract(x) - 0.5) / Fq;
    float w = 0.02 / (1.0 + fi);
    float aw = max(w, fc * 0.8);
    I += on * run * exp(-(d * d) / (aw * aw)) * (w / aw) * (1.3 - 0.3 * fi);
    Fq *= 2.3;
  }
  // Broad bands of coloured glow behind the filaments.
  float broad = n2(vec2(c * 2.0 + s * 1.7, zw * 0.035));
  broad = mix(0.5, broad, zk);
  broad = smoothstep(0.3, 1.0, broad);
  vec3 col = field(n2(vec2(c * 0.8 + s * 2.3, zw * 0.02 - T * 0.05)) * 3.0 + seed * 1.37);
  vec3 col2 = field(n2(vec2(c * 1.7 - s, zw * 0.03 + 4.0)) * 3.0 + seed * 1.37 + 1.2);
  vec3 L = col * (0.04 + 0.38 * broad * broad) + col2 * I * 2.0;

  // Hats: glints scattered on the plane, re-dealt on every hat, each a short
  // streak along the flight.
  if (hat > 0.01) {
    vec2 g = vec2(c * 10.0, zw * 0.6);
    vec2 id = floor(g);
    float gp = step(0.86, h21(id + vec2(hatSeed * 13.0, hatSeed * 7.0 + seed)));
    vec2 sp = 0.2 + 0.6 * h22(id + 9.0);
    vec2 dd = (fract(g) - sp) / vec2(10.0, 0.6);
    float wc = max(0.02, fc * 0.8);
    float g2 = (dd.x * dd.x) / (wc * wc) + (dd.y * dd.y) / 0.05;
    L += vec3(1.0, 0.95, 0.9) * gp * hat * exp(-g2) * (0.02 / wc) * 4.0 * zk * smoothstep(1.2, 3.0, z);
  }
  return L;
}

// A panel flare: plane p, box from rel depth z0 over one panel length, across
// [a, b] of the plane's half-extent.
float flare(float plane, float z, float cf, float fz, float fc) {
  float acc = 0.0;
  for (int j = 0; j < 4; j++) {
    if (kA[j] <= 0.0 || abs(kp[j].x - plane) > 0.5) continue;
    vec4 K = kp[j];
    float dz = max(max(K.y - z, z - (K.y + lp)), 0.0);
    float dc = max(max(K.z - cf, cf - K.w), 0.0);
    float inZ = clamp(1.0 - dz / max(fz, 0.02), 0.0, 1.0);
    float inC = clamp(1.0 - dc / max(fc, 0.01), 0.0, 1.0);
    // Hot box plus a short halo on the plane around it.
    float halo = exp(-dz * 1.6 - dc * 9.0);
    acc += kA[j] * (inZ * inC + 0.35 * halo);
  }
  return acc;
}

vec3 space(vec2 q, float r) {
  float rr = max(r, 1e-3);
  float lr = log(rr);
  vec2 dir = q / rr;
  vec3 acc = vec3(0.0);
  // Nebula streaming outward past the planes.
  float tz = starPh * 0.12;
  float nb = n2(dir * 1.7 + vec2(lr * 1.3 - tz)) * 0.6 + n2(dir * 3.9 + vec2(lr * 2.1 - tz * 1.6) + 5.0) * 0.4;
  nb = smoothstep(0.4, 1.0, nb);
  acc += field(nb * 3.0 + T * 0.02 + 1.5) * nb * nb * (0.025 + 0.14 * drop + 0.04 * bass) * smoothstep(0.02, 0.5, r);

  // Stars on a polar grid that scrolls outward in log radius, streaked
  // radially by the speed.
  float a = atan(q.y, q.x);
  float pxs = 0.5 * min(res.x, res.y);
  float sl = clamp(speed * 0.02, 0.02, 0.55);
  for (int l = 0; l < 2; l++) {
    float NA = l == 0 ? 60.0 : 110.0;
    float kr = l == 0 ? 5.0 : 8.0;
    vec2 g = vec2((a / 6.2831853 + 0.5) * NA, lr * kr - starPh * (l == 0 ? 0.8 : 1.25));
    vec2 id = floor(g);
    id.x = mod(id.x, NA);
    float h = h21(id + float(l) * 57.0);
    float thr = l == 0 ? 0.84 - 0.08 * drop : 0.9 - 0.06 * drop;
    if (h < thr) continue;
    vec2 sp = h22(id + 3.0);
    sp.x = 0.2 + 0.6 * sp.x;
    sp.y = sl + (0.9 - sl) * sp.y;
    vec2 d = fract(g) - sp;
    float dr = d.y > 0.0 ? d.y : (d.y < -sl ? -(d.y + sl) : 0.0);
    float tail = d.y < 0.0 ? clamp(1.0 + d.y / max(sl, 1e-3), 0.0, 1.0) : 1.0;
    float dxp = d.x * (6.2831853 / NA) * r * pxs;
    float dyp = dr / kr * r * pxs;
    float mag = fract(h * 37.1);
    float b = 0.3 + 1.6 * mag * mag;
    vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), fract(h * 71.3));
    acc += tint * b * tail * exp(-(dxp * dxp + dyp * dyp) / 0.6) * smoothstep(0.15, 0.7, r) * starK;
  }
  return acc;
}

void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
  q -= vp;
  float cr = cos(roll), sr = sin(roll);
  q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y);
  float r = length(q);
  vec3 col = space(q, r);

  float zf = 11.0 + 5.0 * drop;
  vec3 fogC = mix(field(T * 0.07 + 0.5), cCore, 0.4);

  // ---- walls
  float ax = max(abs(q.x), 1e-4);
  float sW = W / ax;
  float zW = F * sW, hW = q.y * sW;
  float fh = fwidth(hW), fzW = fwidth(zW);
  float mW = clamp((Hw - abs(hW)) / max(fh, 1e-4) + 0.5, 0.0, 1.0) * clamp(2.0 - 2.0 * fh / Hw, 0.0, 1.0);
  // ---- floor and ceiling
  float ay = max(abs(q.y), 1e-4);
  float sC = HC / ay;
  float zC = F * sC, xC = q.x * sC;
  float fx = fwidth(xC), fzC = fwidth(zC);
  float mC = clamp((WC - abs(xC)) / max(fx, 1e-4) + 0.5, 0.0, 1.0) * clamp(2.0 - 2.0 * fx / WC, 0.0, 1.0) * planes;
  mC *= zC < zW ? 1.0 : 1.0 - mW;

  for (int pl = 0; pl < 2; pl++) {
    float m = pl == 0 ? mW : mC;
    if (m <= 0.001) continue;
    float z = pl == 0 ? zW : zC;
    float c = pl == 0 ? hW : xC;
    float fc = pl == 0 ? fh : fx;
    float fz = pl == 0 ? fzW : fzC;
    float ext = pl == 0 ? Hw : WC;
    float plane = pl == 0 ? (q.x < 0.0 ? 0.0 : 1.0) : (q.y < 0.0 ? 2.0 : 3.0);
    // Which pattern region: fronts are sorted nearest first.
    // The new pattern blends in over a few units behind its front, so as
    // the front rushes past the camera the near wall changes as a wipe.
    float seed = bseed[0], prev = seed, bt = 1.0;
    for (int i = 0; i < 3; i++) {
      if (z > bz[i]) { prev = seed; seed = bseed[i + 1]; bt = smoothstep(0.0, 3.5, z - bz[i]); }
    }
    // The floor and ceiling carry the same patterns, turned a little.
    float zw = z + camZ;
    float ps = pl == 0 ? 0.0 : 0.5;
    vec3 L = surface(c + plane * 3.7, zw, z, fc, fz, seed + ps);
    if (bt < 0.999) L = mix(surface(c + plane * 3.7, zw, z, fc, fz, prev + ps), L, bt);
    // Faint panel seams: they make the flight's speed legible.
    float dzs = abs(fract(zw / lp + 0.5) - 0.5) * lp;
    float sw = max(0.03, fz);
    L += fogC * exp(-(dzs * dzs) / (sw * sw)) * (0.03 / sw) * 0.5 * smoothstep(1.0, 3.0, z);
    // Snare fronts: a bright seam across the plane, and a wash of the
    // accent colour in the new pattern just behind it.
    for (int i = 0; i < 3; i++) {
      if (bA[i] <= 0.0) continue;
      float dz = z - bz[i];
      float bw = max(0.06, fz * 1.2);
      L += cAcc * bA[i] * smoothstep(1.5, 6.0, dz + bz[i]) * (exp(-(dz * dz) / (bw * bw)) * (0.06 / bw) * 3.0
        + step(0.0, dz) * exp(-dz / 2.5) * 0.35);
    }
    // A flare dims as it nears the camera: close up a panel fills a third
    // of the frame, and the beat should stay a spot, not a wipe.
    float fl = flare(plane, z, c / ext, fz, fc / ext) * smoothstep(0.8, 3.2, z);
    L = L * (1.0 + 3.0 * fl) + mix(vec3(1.0), mix(c0, h0, drop), 0.4) * fl * 1.3;
    float fog = exp(-z / zf);
    L = L * fog + fogC * (1.0 - fog) * 0.55;
    // The edge of a plane is a slit of light: brighter there.
    float edge = exp(-(ext - abs(c)) / (0.03 + fc));
    L *= 1.0 + 0.8 * edge;
    col = col * (1.0 - 0.9 * m) + L * m;
  }

  // Slow shafts of light fanning out of the gate into the open space.
  vec2 dq = q / max(r, 1e-3);
  float sh = n2(dq * 2.6 + vec2(T * 0.15, 20.0)) * n2(dq * 5.3 + vec2(3.0, -T * 0.05));
  col += mix(cCore, field(dq.x + dq.y * 0.7 + T * 0.03), 0.5) * sh * sh * exp(-r * 1.3) * (0.05 + 0.25 * drop + 0.1 * bass) * (1.0 - 0.8 * mW) * (1.0 - 0.8 * mC);
  // The gate: a glow at the vanishing point, swelling with the bass.
  col += cCore * (coreK * exp(-r * 9.0) + 0.05 * (0.4 + drop) * exp(-r * 2.2));

  col = 1.0 - exp(-col * 1.25);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };

  // calm fields ×3, hot fields ×3 (the drop), snare accent, gate core
  const PALETTES = [
    { name: 'Jupiter', c: ['#1d3cff', '#1fd0ff', '#7a2cff', '#ff2a9a', '#ff7a1a', '#ffd040', '#e8fbff', '#ffe2b8'] },
    { name: 'Infrared', c: ['#ff3a24', '#ff9a1c', '#9a1040', '#18ffd0', '#2a6aff', '#e4ff3a', '#fff4d8', '#ffd0a0'] },
    { name: 'Opal', c: ['#28ffb0', '#a64aff', '#2a5cff', '#ff46cc', '#3ae0ff', '#fff05a', '#ffffff', '#e8d8ff'] },
  ].map((p) => ({ name: p.name, c: p.c.map(lin) }));

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  VIZ.register({
    id: 'stargate',
    name: 'Stargate',
    order: 303,

    params: [
      { key: 'palette', label: 'Colours', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'slit', label: 'Wall height', type: 'range', min: 0.15, max: 1.4, default: 0.55, step: 0.01 },
      { key: 'planes', label: 'Floor and ceiling', type: 'select', options: ['With the drop', 'Always', 'Never'], default: 0 },
      { key: 'stars', label: 'Stars', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'sway', label: 'Sway', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Stargate',
      technique: 'WebGL2 fragment shader ray-casting flat light planes (walls, floor, ceiling) with a slit-scan pattern (fast across the plane, slow along the flight) anti-aliased by pixel footprint; polar log-radius star field and streaming nebula; music detected as onsets in JS and placed in the corridor as panel flares and pattern fronts',
      brief: 'Constant high-speed flight down the 2001 slit-scan corridor: two walls of smeared light filaments stream past on either side and converge on a glowing gate at the vanishing point, with deep space, outward-racing stars, a streaming nebula and slow shafts of light in the open wedges above and below. The corridor banks and its vanishing point wanders, so it seems to curve. Bass sets the flight speed and swells the walls and the gate glow. Each kick flares one panel of the corridor white-hot a little way ahead, alternating sides, and the flare rushes past with the flight. Each snare or clap sends a new pattern down the walls: a bright seam born far down the corridor with fresh filaments and colours behind it, wiping toward the camera. Hats scatter short glints along the walls. The drop shifts the colour fields from cool blues and violets to magenta, orange and gold, fades in a floor and ceiling of light so the corridor becomes the four-plane gate, fills the space with stars, nebula and shafts, and speeds up; the breakdown folds back to two cool walls and slows to a glide.',
      lineage: [
        'Brief 03 (batch 03): the Stargate sequence from 2001 (Douglas Trumbull\'s slit-scan: artwork smeared along the direction of travel), with Raph\'s batch 02 notes: the beat visible but confined to part of the frame, and more sense of movement.',
        'v1: ray-cast planes in one shader; a pattern of thin filaments across the wall, varying slowly along the flight, anti-aliased by widening each filament to its pixel footprint (energy-conserving) so the far end melts into a glow. Onset detectors from Aurora. Kicks flare one grid-aligned panel down the corridor; snares spawn a pattern front far away that rushes in. Looked right first time on the sheet, but jolt said kickArea 0.39: a bright seam line down the centre (walls at x→0), snowy stars re-dealt on every hat, a snare front sweeping a whole near wall at once, and the previous kick\'s panel filling a third of the frame as it passed the camera.',
        'v2: planes fade where a pixel spans more than the plane (no centre line); fewer, finer stars, no hat flicker on them; filament runs twice as long along the flight (more slit-scan, less churn near the camera); the new pattern blends in over 3.5 units behind its front and fronts travel only a little faster than the flight; panel flares and glints dim as they near the camera. kickArea 0.30 with the kick now a clear hot panel.',
        'v3: hat glints made thick enough to see (they were 0.3 px wide); shafts of light from the gate in the open space; less wash in the planes. The last big contributor was the bank: thin filaments at the frame edge rotating by ~2 px per 0.15 s. Slowed the bank and wander to about half, and the drop\'s speed boost by a fifth. Jolt: kickArea 0.21, verdict calm, the kick a white panel ~8% of the frame.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.T = 0;
      this.camZ = 0;
      this.starPh = 0;
      this.speed = 2;
      this.planesK = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.panels = [];
      this.fronts = [];
      this.baseSeed = 1;
      this.nextSeed = 2;
      this.side = 0;
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
      for (const n of ['res', 'T', 'camZ', 'starPh', 'Hw', 'planes', 'roll', 'lp', 'vp', 'bass', 'drop', 'hat',
        'hatSeed', 'speed', 'starK', 'coreK', 'bz', 'bA', 'bseed', 'kp', 'kA',
        'c0', 'c1', 'c2', 'h0', 'h1', 'h2', 'cAcc', 'cCore']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Onsets against slow baselines (as in Aurora): a pad or riser lifting a
    // whole band does not read as a hit, only a jump does.
    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      // Kick: band 0 leading band 1, which rejects the bass line's notes.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.spawnPanel(kRaw);
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
        this.spawnFront(sRaw * Math.min(1, push));
      }
      e.prevS = sRaw;

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

    // A kick lights one panel some way down the corridor, alternating sides,
    // so it lands small and then rushes past with the flight.
    spawnPanel(amp) {
      const r = Math.random;
      let plane = this.side;
      this.side = 1 - this.side;
      if (this.planesK > 0.6 && r() < 0.35) plane = 2 + (r() < 0.5 ? 0 : 1);
      const d = 2.2 + r() * 1.2;
      const z0 = Math.ceil((this.camZ + d) / LP) * LP;
      const band = Math.floor(r() * 3);
      const a = -1 + band * (2 / 3);
      this.panels.unshift({ plane, z0, a, b: a + 2 / 3, age: 0, amp });
      this.panels.length = Math.min(this.panels.length, 4);
    },

    // A snare sends a new pattern down the walls: a front born far down the
    // corridor that rushes toward the camera faster than the flight.
    spawnFront(amp) {
      const seed = this.nextSeed++;
      const z = this.camZ + 20;
      if (this.fronts.length >= MAXB) {
        // Re-seed the farthest instead of dropping the hit.
        const last = this.fronts[this.fronts.length - 1];
        last.seed = seed; last.age = 0; last.amp = amp;
        return;
      }
      this.fronts.push({ z, seed, age: 0, amp });
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.T === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      // Flight: the bass and the drop set the speed, eased over ~1.5 s so
      // the music changes the speed and never jerks it.
      const cruise = params.speed * (1.6 + 5 * e.bass * push + 5.5 * e.drop);
      this.speed = ease(this.speed, cruise, 0.7, dt);
      this.camZ += dt * this.speed;
      this.starPh += dt * (0.25 + this.speed * 0.3);
      this.T += dt;

      const mode = params.planes | 0;
      const pTarget = mode === 1 ? 1 : mode === 2 ? 0 : clamp01((e.drop - 0.25) / 0.5);
      this.planesK = ease(this.planesK, pTarget, 1.2, dt);

      for (const P of this.panels) P.age += dt;
      this.panels = this.panels.filter((P) => P.age < 1.5 && P.z0 + LP > this.camZ);
      for (const B of this.fronts) { B.age += dt; B.z -= dt * 4; }
      while (this.fronts.length && this.fronts[0].z < this.camZ) {
        this.baseSeed = this.fronts.shift().seed;
      }

      const w = Math.round(p.width * p.pixelDensity() * RES);
      const h = Math.round(p.height * p.pixelDensity() * RES);
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Stargate needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }

      const pal = PALETTES[(params.palette | 0) % PALETTES.length].c;
      const T = this.T;
      const sway = params.sway;
      // A slow bank and a wandering vanishing point: the corridor seems to
      // curve, which keeps the eye travelling. The drop banks a little more.
      const roll = sway * (0.1 + 0.08 * e.drop) * (Math.sin(T * 0.07) + 0.6 * Math.sin(T * 0.041 + 1.3));
      const vpx = sway * 0.1 * Math.sin(T * 0.05 + 0.4);
      const vpy = sway * 0.05 * Math.sin(T * 0.063 + 2.1);

      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.T, T % 2000);
      gl.uniform1f(u.camZ, this.camZ % 4000);
      gl.uniform1f(u.starPh, this.starPh % 2000);
      gl.uniform1f(u.Hw, params.slit * (1 + 0.22 * e.bass * push + 0.15 * e.drop));
      gl.uniform1f(u.planes, this.planesK);
      gl.uniform1f(u.roll, roll);
      gl.uniform1f(u.lp, LP);
      gl.uniform2f(u.vp, vpx, vpy);
      gl.uniform1f(u.bass, e.bass * push);
      gl.uniform1f(u.drop, e.drop);
      gl.uniform1f(u.hat, e.hat * push);
      gl.uniform1f(u.hatSeed, this.hatSeed);
      gl.uniform1f(u.speed, this.speed);
      gl.uniform1f(u.starK, params.stars);
      gl.uniform1f(u.coreK, 0.12 + 0.35 * e.bass * push + 0.25 * e.drop);

      const bz = new Float32Array([1e4, 1e4, 1e4]), bA = new Float32Array(3);
      const bseed = new Float32Array(4);
      bseed[0] = this.baseSeed;
      // Camera-relative positions wrap with camZ in the shader; keep the
      // patterns' world coordinate consistent by passing relative depths.
      this.fronts.forEach((B, i) => {
        bz[i] = B.z - this.camZ;
        bA[i] = B.amp * (0.4 + 0.6 * Math.exp(-B.age * 1.5));
        bseed[i + 1] = B.seed;
      });
      for (let i = this.fronts.length; i < 3; i++) bseed[i + 1] = bseed[i];
      gl.uniform1fv(u.bz, bz);
      gl.uniform1fv(u.bA, bA);
      gl.uniform1fv(u.bseed, bseed.map((s) => (s * 0.7131) % 97));

      const kp = new Float32Array(16), kA = new Float32Array(4);
      this.panels.forEach((P, i) => {
        kp.set([P.plane, P.z0 - this.camZ, P.a, P.b], i * 4);
        const rise = Math.min(1, P.age / 0.03);
        kA[i] = P.amp * push * rise * Math.exp(-P.age / 0.4);
      });
      gl.uniform4fv(u.kp, kp);
      gl.uniform1fv(u.kA, kA);

      gl.uniform3fv(u.c0, pal[0]); gl.uniform3fv(u.c1, pal[1]); gl.uniform3fv(u.c2, pal[2]);
      gl.uniform3fv(u.h0, pal[3]); gl.uniform3fv(u.h1, pal[4]); gl.uniform3fv(u.h2, pal[5]);
      gl.uniform3fv(u.cAcc, pal[6]); gl.uniform3fv(u.cCore, pal[7]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
