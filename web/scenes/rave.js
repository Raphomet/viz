// Rave — lasers over a crowd, seen from the middle of the floor.
//
// Layers, back to front:
//   1. Haze: a slow, domain-warped smoke field. It is not a backdrop but the
//      medium: every light below is multiplied by its density, so beams go
//      streaky where the smoke is thick, exactly as real lasers only exist
//      where there is something to scatter off.
//   2. Stage wash and two moving-head cones from the truss (soft, wide).
//   3. Laser heads along the back of the stage: fans of thin saturated beams,
//      plus a full-circle "tunnel" head and a "liquid sky" sheet.
//   4. Glints: dust in the beams, and a fresh constellation on every hat.
//   5. The crowd (Canvas 2D): three rows of silhouettes with a rim of stage
//      light, back rows tinted by the haze in front of them.
//
// Lasers are rendered analytically. Seen from its source, a fan of evenly
// spaced beams is periodic in angle, so each pixel finds its two nearest
// beams from atan() alone: a fan of 40 beams costs the same as a fan of 4,
// and every beam is a true perpendicular-distance Gaussian, antialiased at
// any width.
//
// Music vocabulary (each lands somewhere different):
//   kick   -> the crowd drops on the beat (with a little human lag), fists
//             pump, the haze and stage wash bloom, every fan punches open
//   clap   -> a lighting cue: the laser look and its colour pair cut to the
//             next one, with a brief flare of the heads
//   hats   -> sparkle: a new scatter of glints in the smoke on every hat
//   bass   -> fills the haze with the look's colour
//   energy -> (the drop) opens the fans from bundled single beams into full
//             fans, switches on the outer heads and raises the hands; in the
//             breakdown only one head stays on, a slow liquid-sky ceiling
//             undulates with the pad, and the crowd sways instead of bouncing.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const MAX_FANS = 6;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;
uniform float unitPx;
uniform int   nFans;
uniform vec4  fA[${MAX_FANS}];   // source xy, aim angle, spacing (rad)
uniform vec4  fB[${MAX_FANS}];   // count, intensity, kind (0 fan, 1 full circle), rotation
uniform vec3  fC[${MAX_FANS}];   // linear colour
uniform float beamW;             // core sigma, virtual units
uniform vec4  hz;                // haze drift offsets
uniform float hazeAmt;
uniform vec3  hazeCol;
uniform float ambGain;
uniform vec3  washCol;
uniform float washY;
uniform float washAmt;
uniform float washPh;
uniform vec4  cA[2];             // cone source xy, aim, half-angle
uniform vec3  cC[2];
uniform float cI[2];
uniform vec4  sheet;             // source x, y, intensity, line count
uniform vec3  sheetCol;
uniform vec2  sheetWave;         // K, phase
uniform float hatSeed;
uniform float hatAmt;
uniform float moteT;
uniform vec4  kickW;             // shockwave: origin xy, radius, strength
uniform vec3  kickCol;
out vec4 outColor;

const float PI = 3.14159265;
const float TAU = 6.28318531;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float wrapPi(float x) { return x - TAU * floor((x + PI) / TAU); }

// Smoke: a warped three-octave field drifting upward.
float haze(vec2 p) {
  vec2 q = p / 190.0;
  vec2 w = vec2(vnoise(q * 0.6 + hz.xy), vnoise(q * 0.6 + hz.yx + 5.2));
  q += (w - 0.5) * 1.8;
  float f = 0.55 * vnoise(q + hz.zw) + 0.3 * vnoise(q * 2.1 - hz.zw * 1.3)
          + 0.15 * vnoise(q * 4.7 + hz.xy * 2.0);
  return f;
}

// Nearest two beams of a fan: returns (core, glow). aim is the fan's centre,
// sp the angle between beams, n the count; full = 1 wraps around the circle.
vec2 fan(vec2 p, vec4 A, vec4 B, float w) {
  vec2 v = p - A.xy;
  float r = length(v);
  float a = atan(v.y, v.x);
  float n = B.x, sp = A.w;
  float local = wrapPi(a - A.z) / sp + 0.5 * (n - 1.0);
  float core = 0.0, glow = 0.0;
  float i0 = floor(local);
  for (int k = 0; k < 2; k++) {
    float i = i0 + float(k);
    if (B.z > 0.5) i = mod(i, n);
    else if (i < 0.0 || i > n - 1.0) continue;
    float ba = A.z + (i - 0.5 * (n - 1.0)) * sp;
    float da = abs(wrapPi(a - ba));
    if (da > 1.3) continue;
    float d = r * sin(da);
    float m = 1.0;
    // The tunnel head: brightness rolls around the circle, so a flat ring of
    // beams reads as a cone turning toward you.
    if (B.z > 0.5) m = 0.18 + 0.82 * pow(0.5 + 0.5 * cos(ba * 2.0 - B.w), 3.0);
    // Per-beam shimmer, so a fan is a set of lasers, not a comb.
    m *= 0.75 + 0.25 * hash12(vec2(i, A.x));
    core += m * exp(-d * d / (w * w));
    glow += m * (0.22 * exp(-d / 5.0) + 0.05 * exp(-d / 30.0));
  }
  // Aperture: the hot spot where the fan leaves the head.
  glow += 2.0 * exp(-r / 7.0) + 0.3 * exp(-r / 40.0);
  return vec2(core, glow);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  float w = max(beamW, 0.75 / unitPx);

  float h = haze(p);
  float dens = hazeAmt * (0.06 + 1.35 * smoothstep(0.3, 0.85, h));

  vec3 col = vec3(0.0015, 0.001, 0.004);

  // Ambient haze lit by the room: brightest at stage height, falling off
  // toward the ceiling.
  float lift = exp(-max(0.0, p.y - washY) / 230.0);
  col += hazeCol * dens * ambGain * (0.06 + 0.94 * lift * lift);

  // Stage wash: a band of light behind the crowd, pooled into spots.
  float band = exp(-pow((p.y - washY) / 34.0, 2.0));
  float spots = 0.55 + 0.45 * cos(p.x / 55.0 + washPh);
  col += washCol * band * spots * washAmt * (0.6 + 0.6 * dens);

  // Moving heads from the truss: wide soft cones.
  for (int k = 0; k < 2; k++) {
    vec2 v = p - cA[k].xy;
    float r = length(v);
    float da = wrapPi(atan(v.y, v.x) - cA[k].z);
    float c = exp(-pow(da / cA[k].w, 2.0)) * (1.0 - exp(-r / 70.0));
    col += cC[k] * c * cI[k] * (0.15 + 0.9 * dens);
  }

  // The kick: a soft ring of light that leaves the stage through the smoke,
  // over a bloom at its origin. Coloured and partial, never a flash.
  {
    float r = length((p - kickW.xy) * vec2(0.75, 1.0));
    float ring = exp(-pow((r - kickW.z) / (40.0 + 0.25 * kickW.z), 2.0));
    float core = exp(-r / 140.0);
    col += kickCol * kickW.w * (ring * (0.2 + 1.4 * dens) + core * (0.35 + 0.8 * dens));
  }

  // Lasers.
  vec3 light = vec3(0.0);
  for (int k = 0; k < ${MAX_FANS}; k++) {
    if (k >= nFans) break;
    if (fB[k].y <= 0.001) continue;
    vec2 cg = fan(p, fA[k], fB[k], w);
    vec3 c = fC[k] * fB[k].y;
    // Cores are visible in thin smoke too; the halo is only the smoke.
    col += c * cg.x * (0.45 + 1.1 * dens);
    col += mix(c, vec3(fB[k].y), 0.6) * cg.x * cg.x * 0.35; // white-hot centre
    light += c * cg.y;
  }
  col += light * (0.25 + 1.3 * dens);

  // Liquid sky: a plane of beams fanned flat from the stage. Radial lines in
  // screen space are what a plane of beams projects to; the undulation is
  // bands of 1/dy, which crowd toward the horizon like perspective does.
  if (sheet.z > 0.001) {
    vec2 v = p - sheet.xy;
    float dy = max(v.y, 0.0);
    float ph = sheetWave.x / (dy + 16.0) - sheetWave.y;
    float fw = fwidth(ph);
    float wave = mix(pow(0.5 + 0.5 * sin(ph * TAU), 3.0), 0.31, smoothstep(0.12, 0.45, fw));
    vec2 cg = fan(p, vec4(sheet.xy, PI * 0.5, PI / sheet.w), vec4(sheet.w + 1.0, 1.0, 0.0, 0.0), w * 1.1);
    float above = smoothstep(0.0, 25.0, v.y) * exp(-dy / 520.0);
    float s = above * (0.2 + 0.8 * wave) * sheet.z;
    col += sheetCol * s * (cg.x * (0.35 + 0.9 * dens) + 0.18 * dens + wave * 0.12 * dens);
    light += sheetCol * s * 0.2;
  }

  // Glints. Hats throw a fresh scatter of sparks into the smoke each hit;
  // they are brightest where the beams are, as dust lit by lasers would be.
  float lum = dot(light, vec3(0.3, 0.5, 0.2));
  float sz = max(0.9, 0.9 / unitPx);
  {
    vec2 g = p / 7.0;
    vec2 id = floor(g);
    float r = hash12(id + hatSeed * 13.7);
    if (r > 0.935) {
      vec2 pt = hash22(id + hatSeed * 7.1);
      float d = length((fract(g) - pt) * 7.0);
      float s = exp(-d * d / (sz * sz)) * hatAmt * (0.35 + 3.0 * lum + ambGain * dens);
      col += mix(vec3(1.0), normalize(light + 0.001) * 1.4, 0.35) * s;
    }
  }
  // Motes: dust drifting through the beams all the time, faint.
  {
    vec2 q = p + vec2(sin(moteT * 0.13) * 40.0, moteT * 6.0);
    vec2 g = q / 11.0;
    vec2 id = floor(g);
    if (hash12(id + 71.3) > 0.9) {
      vec2 pt = hash22(id + 3.3);
      float d = length((fract(g) - pt) * 11.0);
      col += light * exp(-d * d / (sz * sz)) * 0.8;
    }
  }

  // Vignette, then a soft shoulder so additive light saturates like film
  // instead of clipping.
  vec2 uv = gl_FragCoord.xy / res - 0.5;
  col *= 1.0 - 0.35 * dot(uv, uv) * 2.0;
  col = 1.0 - exp(-col * 1.15);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  // ---------------------------------------------------------------- colour

  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function toSrgb(c) { return c.map((v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2))); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  // Laser pairs: a primary and a partner that is either complementary or an
  // analogous neighbour. Real laser diodes are pure; so are these.
  // The third colour is what the bass floods the smoke with: chosen per pair,
  // because a dim mix of two laser colours goes muddy (red + amber smoke read
  // as brown).
  const PAIRS = {
    acidGreen: [lin('#28ff3c'), lin('#00e1ff'), lin('#00a6b8')],
    magentaBlue: [lin('#ff1ccf'), lin('#3348ff'), lin('#5a1cff')],
    redAmber: [lin('#ff1414'), lin('#ffa600'), lin('#ff1438')],
    violetCyan: [lin('#8f2bff'), lin('#00f0ff'), lin('#6a1aff')],
    greenMagenta: [lin('#48ff1f'), lin('#ff26b0'), lin('#ff1aa0')],
    redBlue: [lin('#ff1830'), lin('#2f5bff'), lin('#3a1cff')],
    limeYellow: [lin('#9dff00'), lin('#1dff9a'), lin('#00c080')],
    pinkViolet: [lin('#ff2a6d'), lin('#a31dff'), lin('#8a10ff')],
  };
  const SCHEMES = [
    ['acidGreen', 'magentaBlue', 'redAmber', 'violetCyan', 'greenMagenta'],   // Mixed
    ['acidGreen', 'limeYellow', 'greenMagenta'],                              // Acid
    ['redAmber', 'redBlue', 'pinkViolet'],                                    // Inferno
    ['violetCyan', 'magentaBlue', 'pinkViolet'],                              // Ultraviolet
  ];
  const NIGHT = lin('#12062e');
  const WARM = lin('#ffd2a0');

  const LOOKS = ['Fans', 'Scissors', 'Crossfire', 'Tunnel', 'Liquid sky', 'Scanners'];

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  // A transient detector: fires when a value jumps above its own recent
  // level. Relative, so it works on the scripted track and on a real mix
  // whose bands sit high all night.
  function onset(state, v, t, jump, floor, refractory) {
    const fire = v - state.prev > jump && v > state.avg + floor && t - state.last > refractory;
    state.avg += (v - state.avg) * 0.04;
    state.prev = v;
    if (fire) state.last = t;
    return fire;
  }

  VIZ.register({
    id: 'rave',
    name: 'Rave',
    order: 204,

    params: [
      { key: 'show', label: 'Laser show', type: 'select',
        options: ['Clap cuts the look'].concat(LOOKS.map((l) => 'Hold: ' + l)), default: 0 },
      { key: 'scheme', label: 'Colours', type: 'select',
        options: ['Mixed', 'Acid', 'Inferno', 'Ultraviolet'], default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'beams', label: 'Beams per head', type: 'range', min: 3, max: 24, default: 11, step: 1 },
      { key: 'haze', label: 'Smoke', type: 'range', min: 0.2, max: 1.6, default: 1, step: 0.01 },
      { key: 'crowd', label: 'Crowd', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'sweep', label: 'Sweep speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'cue', label: 'Next look', run() { this.nextLook(); } },
    ],

    gallery: {
      title: 'Rave',
      technique: 'WebGL2 fragment shader (warped fBm smoke; analytic laser fans resolved per pixel from the angle to each head; moving-head cones; a liquid-sky plane; hashed glints) under a Canvas 2D crowd of rim-lit silhouettes',
      brief: 'Inside a club, from the middle of the floor. Smoke drifts through the room and the lasers only exist where it is thick. Four heads on the stage and a tunnel head fan thin saturated beams over a three-row crowd whose back rows fade into the haze. The kick drops the whole crowd on the beat, pumps fists, blooms the smoke and punches every fan open; the clap is a lighting cue that cuts to the next look (fans, scissors, crossfire, tunnel, liquid sky, scanners) and colour pair; hats throw fresh glitter into the beams; bass floods the smoke with colour. The drop opens every head and raises the hands; the breakdown folds the lasers back to one bundled beam under a slow undulating liquid-sky ceiling while the crowd sways.',
      lineage: [
        'Brief 04 (batch 02): lasers over a crowd; layers of haze, beams, wash and silhouettes.',
        'Design choice: the smoke is the medium, not a backdrop. Every beam and cone is multiplied by the haze density, which is what makes real lasers look like lasers.',
        'Beams are analytic: a fan is periodic in angle from its source, so each pixel tests only its two nearest beams. Constant cost per head at any beam count, and each beam is a true perpendicular-distance Gaussian with a floor of ~0.75 device px so it stays antialiased.',
        'Music: onset detectors (relative to each band\'s own recent level) turn kick, clap and hat into events; bass and a slow kick average become continuous levels. The drop "opens" the fans literally: at low energy each head\'s beams are bundled into one, and the spacing opens with energy.',
        'Seizure safety: the kick blooms the smoke and wash by a fraction and moves the crowd; no full-screen flashes. The clap cut changes thin lines only.',
        'Render 1 (640x360): layering worked first time and drop vs breakdown was obvious, but the whole frame was milky (haze too dense everywhere) and the back crowd rows were a flat grey wall.',
        'Render 2 (kick strip): darker smoke with real holes, but the kick was only a slight brightening; 12.0 s barely differed from 11.9 s. (The 11.935 and 12.419 s frames round to just before the onsets, so the strip is read at 11.95 and 12.0.)',
        'Revision: a soft coloured shockwave leaves the stage through the smoke on each kick, over a bloom at its origin; the crowd drop went from 9 to 22 units at full size; rim light on the crowd tracks the kick. Bass now floods the smoke with a per-pair flood colour, because a dim mix of red and amber lasers made brown smoke.',
        'Render 3: kick unmistakable (bloom, ring, fans punch open, crowd drops). Mid-crowd still slate grey, raised arms too long (antennae), truss cones grey; all fixed.',
        'Render 6 (1280x720): mid-crowd bodies showed pale pillars between them (row fog unequal), heads too small for the shoulders, hands stayed up well into the breakdown; fixed. Render 7: 96 s longevity.',
        'Render 4: the build (4-8 s) was indistinguishable from the intro. The riser and hats now speed the liquid-sky roll, lift the stage wash and raise the first hands, and the snare roll cuts looks into the drop.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() { this.enter(); },

    enter() {
      this.lastMs = null;
      this.t = 0;
      this.T = 0;                 // sweep clock
      this.kick = 0; this.snare = 0; this.hat = 0; this.kickAt = -10; this.kickPeak = 0;
      this.kickHist = new Float32Array(12);
      this.bass = 0; this.pad = 0; this.kickSlow = 0; this.highSlow = 0;
      this.energy = 0; this.raise = 0;
      this.hatCount = 0;
      this.det = {
        kick: { prev: 0, avg: 0, last: -1 },
        snare: { prev: 0, avg: 0, last: -1 },
        hat: { prev: 0, avg: 0, last: -1 },
      };
      this.look = 0;
      this.pairIdx = 0;
      this.lookSeed = Math.random() * 100;
      this.lastCue = 0;
      this.hazeCol = NIGHT.slice();
      this.hazeT = [Math.random() * 50, Math.random() * 50];
      this.buildCrowd();
    },

    nextLook() {
      this.look = (this.look + 1 + (Math.random() < 0.3 ? 1 : 0)) % LOOKS.length;
      this.pairIdx++;
      this.lookSeed = Math.random() * 100;
      this.lastCue = this.t;
      this.snare = 1;
    },

    // Rows of people at fixed stage positions in virtual units, generated
    // wider than any sane aspect ratio and culled at draw time, so a square
    // stage shows the middle of the same crowd rather than a squeezed one.
    buildCrowd() {
      const r = Math.random;
      const rows = [
        { y: -64, s: 0.42, gap: 24 },
        { y: -118, s: 0.68, gap: 38 },
        { y: -212, s: 1.12, gap: 66 },
      ];
      this.rows = rows.map((row, ri) => {
        const people = [];
        for (let x = -1000; x < 1000; x += row.gap * (0.75 + 0.5 * r())) {
          people.push({
            x: x + (r() - 0.5) * row.gap * 0.3,
            dy: (r() - 0.5) * 10 * row.s,
            s: row.s * (0.88 + 0.24 * r()),
            lag: Math.floor(r() * 5),
            ph: r() * Math.PI * 2,
            style: r() < 0.08 ? 3 : Math.floor(r() * 3), // 0 V, 1 pump, 2 wave, 3 phone
            eager: r(),            // how early in the energy ramp the hands go up
            keep: r(),
            side: r() < 0.5 ? -1 : 1,
          });
        }
        return { y: row.y, s: row.s, people, ri };
      });
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
      for (const n of ['res', 'unitPx', 'nFans', 'fA', 'fB', 'fC', 'beamW', 'hz', 'hazeAmt', 'hazeCol',
        'ambGain', 'washCol', 'washY', 'washAmt', 'washPh', 'cA', 'cC', 'cI', 'sheet', 'sheetCol',
        'sheetWave', 'hatSeed', 'hatAmt', 'moteT', 'kickW', 'kickCol']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      this.gl = gl; this.glCanvas = c; this.u = u;
      this.fA = new Float32Array(MAX_FANS * 4);
      this.fB = new Float32Array(MAX_FANS * 4);
      this.fC = new Float32Array(MAX_FANS * 3);
    },

    listen(sg, dt, react) {
      const t = this.t, d = this.det;
      // Kick: band 0 transients. Clap: the low mids. Hats: the top two bands.
      if (onset(d.kick, sg[0], t, 12, 12, 0.2)) { this.kick = Math.min(1, sg[0] / 85); this.kickAt = t; this.kickPeak = this.kick; }
      const sn = (sg[3] + sg[4] + sg[5]) / 3;
      if (onset(d.snare, sn, t, 11, 14, 0.22)) this.snareHit = true;
      const hh = (sg[7] + sg[8]) / 2;
      if (onset(d.hat, hh, t, 9, 8, 0.07)) { this.hatCount++; this.hat = Math.min(1, 0.35 + hh / 90); }

      this.kick *= Math.exp(-dt / 0.15);
      this.snare *= Math.exp(-dt / 0.18);
      this.hat *= Math.exp(-dt / 0.075);
      this.kickHist.copyWithin(1, 0, this.kickHist.length - 1);
      this.kickHist[0] = this.kick;

      this.bass = ease(this.bass, (sg[1] + sg[2]) / 170, 5, dt);
      this.pad = ease(this.pad, (sg[2] + sg[3] + sg[4]) / 240, 1.2, dt);
      this.kickSlow = ease(this.kickSlow, sg[0] / 100, 0.9, dt);
      this.highSlow = ease(this.highSlow, (sg[6] + sg[7] + sg[8]) / 300, 1, dt);
      // Energy: the drop is kick density; the build's hats and riser lift it
      // part way so the room anticipates.
      const target = clamp01(this.kickSlow * 3.2 + this.highSlow * 0.6);
      this.energy = ease(this.energy, target, target > this.energy ? 1.4 : 0.7, dt);
      this.raise = ease(this.raise, clamp01(Math.max(this.energy * 1.1, this.highSlow * 1.6)), 1.6, dt);
    },

    // The fans for the current look. Each head is {x, y, aim, sp, n, I, kind, rot, col}.
    buildFans(W, open, kp, params) {
      const T = this.T, s = this.lookSeed;
      const pair = PAIRS[SCHEMES[params.scheme | 0][this.pairIdx % SCHEMES[params.scheme | 0].length]];
      const nMax = Math.round(params.beams);
      const hx = [-0.38, -0.13, 0.13, 0.38].map((f) => Math.max(-W / 2 + 50, Math.min(W / 2 - 50, f * W)));
      const hy = -22;
      const fans = [];
      const look = (params.show | 0) === 0 ? this.look : (params.show | 0) - 1;
      // Heads come on in order of rank as the energy rises; rank 0 is always on.
      const on = (rank) => smooth(rank * 0.28 - 0.05, rank * 0.28 + 0.2, open);
      // At low energy a head's beams are bundled into one; the drop opens it.
      const spread = (sp) => sp * (0.08 + 0.92 * open) * (1 + 0.45 * kp);
      const bundle = (n) => 1 / (1 + (n - 1) * (1 - open) * 0.85);
      const head = (i, aim, sp, n, rank, colIdx) => {
        fans.push({ x: hx[i], y: hy, aim, sp: spread(sp), n, I: on(rank) * bundle(n), kind: 0, rot: 0,
          col: pair[colIdx % 2] });
      };
      let sheet = 0;
      const side = [-1, -1, 1, 1];
      const rankOuter = [2, 1, 1, 2];
      if (look === 0) {          // Fans: all heads sweep in unison
        const a = Math.PI / 2 + 0.62 * Math.sin(T * 0.8 + s);
        for (let i = 0; i < 4; i++) head(i, a + 0.05 * side[i], 0.085, nMax, [3, 0, 1, 2][i], i);
      } else if (look === 1) {   // Scissors: mirrored pairs that cross in the middle
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 2 - side[i] * (0.15 + 0.7 * Math.sin(T * 0.9 + s + (i === 0 || i === 3 ? 0.6 : 0)));
          head(i, a, 0.07, nMax, rankOuter[i], i < 2 ? 0 : 1);
        }
      } else if (look === 2) {   // Crossfire: tight bundles firing across the room
        for (let i = 0; i < 4; i++) {
          const outer = i === 0 || i === 3;
          const a = outer
            ? Math.PI / 2 - side[i] * (0.8 + 0.22 * Math.sin(T * 1.1 + s))
            : Math.PI / 2 + side[i] * (0.3 + 0.3 * Math.sin(T * 1.3 + s + 1));
          head(i, a, outer ? 0.03 : 0.055, Math.max(3, Math.round(nMax * 0.6)), outer ? 0 : 1, outer ? 0 : 1);
        }
      } else if (look === 3) {   // Tunnel: a full circle of beams turning toward you
        const n = Math.max(12, nMax * 2);
        fans.push({ x: 0, y: hy + 4, aim: T * 0.35 + s, sp: Math.PI * 2 / n, n,
          I: 0.9 * (0.5 + 0.5 * on(0)), kind: 1, rot: T * 1.1 + s, col: pair[0] });
        head(0, Math.PI / 2 - 0.25 + 0.3 * Math.sin(T * 0.6), 0.05, 3, 2, 1);
        head(3, Math.PI / 2 + 0.25 - 0.3 * Math.sin(T * 0.6), 0.05, 3, 2, 1);
      } else if (look === 4) {   // Liquid sky: a plane of light over the crowd
        sheet = 1;
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 2 - side[i] * (1.05 + 0.25 * Math.sin(T * 0.7 + i + s));
          head(i, a, 0.06, Math.max(3, Math.round(nMax * 0.5)), rankOuter[i], 1);
        }
      } else {                    // Scanners: each head a bundle on its own path
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 2 + 0.9 * Math.sin(T * (0.9 + 0.23 * i) + s + i * 2.1);
          head(i, a, 0.022, Math.max(3, Math.round(nMax * 0.45)), [1, 0, 0, 1][i], i);
        }
      }
      return { fans, sheet, pair, look };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.t === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.t += dt;
      const react = params.react;
      this.listen(signals, dt, react);
      if (this.snareHit) {
        this.snareHit = false;
        if ((params.show | 0) === 0) this.nextLook(); else this.snare = 1;
      }
      // Without claps (a breakdown, a clap-less track) the show still moves on.
      if (this.t - this.lastCue > 14) this.nextLook();

      const e = this.energy;
      const kp = this.kick * react;
      this.T += dt * params.sweep * (0.35 + 0.9 * e);
      const W = ctx.width, H = ctx.height;

      const { fans, sheet, pair } = this.buildFans(W, e, kp, params);

      // Haze colour: night indigo, flooded with the look's partner colour by
      // the bass. Eased, so the clap cuts the lasers and the room follows.
      const flood = clamp01(0.25 + 0.95 * this.bass * react + 0.2 * this.pad);
      const hazeTarget = mix3(NIGHT, pair[2], flood * 0.8);
      this.hazeCol = mix3(this.hazeCol, hazeTarget, 1 - Math.exp(-2.5 * dt));
      this.hazeT[0] += dt * 0.018; this.hazeT[1] += dt * (0.05 + 0.03 * e);

      // ---- render the light
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Rave needs WebGL2', W / 2, H / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const unitPx = Math.min(w, h) / 600;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, unitPx);

      const flare = 1 + 0.9 * this.snare;
      const beamGain = (0.55 + 0.45 * e) * (1 + 0.8 * kp) * flare;
      const n = Math.min(MAX_FANS, fans.length);
      for (let i = 0; i < n; i++) {
        const f = fans[i];
        this.fA.set([f.x, f.y, f.aim, f.sp], i * 4);
        this.fB.set([f.n, f.I * beamGain, f.kind, f.rot], i * 4);
        this.fC.set(f.col, i * 3);
      }
      gl.uniform1i(u.nFans, n);
      gl.uniform4fv(u.fA, this.fA);
      gl.uniform4fv(u.fB, this.fB);
      gl.uniform3fv(u.fC, this.fC);
      gl.uniform1f(u.beamW, 0.7 * (1 + 0.7 * kp));
      gl.uniform4f(u.hz, this.hazeT[0], this.hazeT[0] * 0.7 + 3, -this.hazeT[0] * 0.4, -this.hazeT[1]);
      gl.uniform1f(u.hazeAmt, params.haze);
      gl.uniform3fv(u.hazeCol, this.hazeCol);
      gl.uniform1f(u.ambGain, 0.1 + 0.35 * this.bass * react + 0.2 * this.pad + 0.8 * kp);
      const washY = -46;
      gl.uniform3fv(u.washCol, mix3(pair[0], pair[2], 0.5));
      gl.uniform1f(u.washY, washY);
      gl.uniform1f(u.washAmt, 0.18 + 0.25 * e + 0.6 * this.highSlow + 1.1 * kp + 0.3 * this.snare);
      gl.uniform1f(u.washPh, this.T * 0.7);

      // Moving heads on the truss: they carry the breakdown, breathing with
      // the pad, and pick up the kick in the drop.
      const coneCol = mix3(pair[1], WARM, 0.2);
      const cones = [];
      for (let k = 0; k < 2; k++) {
        const sx = (k ? 1 : -1) * Math.min(0.3 * W, W / 2 - 40);
        const aim = -Math.PI / 2 - (k ? -1 : 1) * (0.28 + 0.22 * Math.sin(this.T * 0.4 + k * 2.4 + 1));
        cones.push(sx, H / 2 + 30, aim, 0.1 + 0.03 * this.pad);
      }
      gl.uniform4fv(u.cA, cones);
      gl.uniform3fv(u.cC, coneCol.concat(coneCol));
      const cI = 0.08 + 0.35 * this.pad + 0.12 * (1 - e) + 0.5 * kp;
      gl.uniform1fv(u.cI, [cI, cI]);

      // Liquid sky: its own look, and the breakdown's ceiling.
      const sheetI = Math.max(sheet * (0.5 + 0.5 * e), (1 - e) * 0.5) * (1 + 0.5 * kp);
      if (this.sheetPh === undefined) this.sheetPh = 0;
      // The build's riser and hats speed the ceiling's roll, so the room
      // visibly winds up before the drop.
      this.sheetPh += dt * (0.25 + 0.5 * this.pad + 0.6 * e + 2.2 * this.highSlow);
      gl.uniform4f(u.sheet, 0, -20, sheetI, 34 + Math.round(params.beams) * 2);
      gl.uniform3fv(u.sheetCol, sheet ? pair[0] : mix3(pair[1], pair[0], 0.3));
      gl.uniform2f(u.sheetWave, 1400, this.sheetPh);

      gl.uniform1f(u.hatSeed, this.hatCount % 997);
      gl.uniform1f(u.hatAmt, this.hat * Math.min(1.6, react) * 1.4);
      gl.uniform1f(u.moteT, this.t);
      const age = this.t - this.kickAt;
      gl.uniform4f(u.kickW, 0, -40, 30 + 1300 * age * (1 - 0.3 * Math.min(1, age)),
        this.kickPeak * react * 0.55 * Math.exp(-age / 0.22));
      gl.uniform3fv(u.kickCol, mix3(pair[0], [1, 1, 1], 0.15));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, W, H);

      this.drawCrowd(p, params, W, H, pair);
    },

    // ---------------------------------------------------------------- crowd

    drawCrowd(p, params, W, H, pair) {
      if (params.crowd <= 0.001) return;
      const g = p.drawingContext;
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const e = this.energy, react = params.react;
      const t = this.t;
      const rim = toSrgb(mix3(mix3(pair[0], pair[1], 0.5), [1, 1, 1], 0.3).map((v) => v * (0.3 + 0.45 * e + 1.6 * this.kick * react)));
      const hz = this.hazeCol;

      for (const row of this.rows) {
        const depth = row.ri;                  // 0 back .. 2 front
        // Kept nearly equal: gaps between one row's bodies show the row
        // behind, and a lighter back row reads as a colonnade of pillars.
        const fog = [0.018, 0.01, 0.0][depth];  // atmosphere in front of the row
        const body = toSrgb(mix3([0.0015, 0.001, 0.003], hz, fog * (0.8 + 0.8 * this.kick * react)));
        const cy = H / 2 - row.y;
        for (const pp of row.people) {
          if (pp.keep > params.crowd) continue;
          const x = W / 2 + pp.x;
          if (x < -80 * pp.s || x > W + 80 * pp.s) continue;
          const k = this.kickHist[pp.lag] * react;
          // Bounce: down on the beat, more in the drop; sway in the breakdown.
          const bob = pp.s * (22 * k * (0.4 + 0.6 * e) + 3 * Math.sin(t * 1.1 + pp.ph) * (1 - e));
          const sway = pp.s * 6 * Math.sin(t * 0.7 + pp.ph) * (1 - 0.6 * e);
          const hx = x + sway, hy = cy + pp.dy + bob;
          const up = clamp01((this.raise - pp.eager * 0.55) / 0.45);
          const pose = this.pose(pp, hx, hy, up, k, t);
          if (depth > 0) {
            // Rim light from the stage behind: the same silhouette, nudged up.
            this.person(g, pp.s, hx, hy - 1.6 * pp.s, pose, 0, -1.6 * pp.s, rgba(rim, depth === 2 ? 0.9 : 0.6), H);
          }
          this.person(g, pp.s, hx, hy, pose, 0, 0, rgba(body, 1), H);
          if (pp.style === 3 && up > 0.3) {
            // A phone held up: the one cold white point in the room.
            const hand = pose.raised;
            g.fillStyle = rgba([200, 220, 255], 0.85 * up);
            g.fillRect(hand[0] - 3 * pp.s, hand[1] - 11 * pp.s, 6 * pp.s, 9 * pp.s);
          }
        }
        if (depth < 2) {
          // Haze between rows, lit a little by the kick.
          const y0 = H / 2 - row.y - 60 * row.s, y1 = H;
          const grad = g.createLinearGradient(0, y0, 0, y1);
          const hc = toSrgb(hz.map((v) => v * (0.6 + 0.8 * this.kick * react)));
          grad.addColorStop(0, rgba(hc, 0));
          grad.addColorStop(0.35, rgba(hc, 0.07));
          grad.addColorStop(1, rgba(hc, 0.02));
          g.fillStyle = grad;
          g.fillRect(0, y0, W, y1 - y0);
        }
      }
      g.restore();
    },

    // Arm geometry in screen units: each arm is [elbow, hand].
    pose(pp, hx, hy, up, k, t) {
      const s = pp.s;
      const arm = (dir, lift) => {
        let ex = hx + dir * 34 * s, ey = hy + 55 * s;           // arms down
        let hxx = hx + dir * 36 * s, hyy = hy + 110 * s;
        const uex = hx + dir * 40 * s, uey = hy - 6 * s;        // arms up, a V
        let uhx = hx + dir * 44 * s, uhy = hy - 60 * s;
        if (pp.style === 1) uhy -= 18 * s * k;                   // fist pump on the kick
        if (pp.style === 2) uhx += 14 * s * Math.sin(t * 3.2 + pp.ph);
        ex += (uex - ex) * lift; ey += (uey - ey) * lift;
        hxx += (uhx - hxx) * lift; hyy += (uhy - hyy) * lift;
        return [[ex, ey], [hxx, hyy]];
      };
      // Pumpers and phone-holders raise one arm; everyone else both.
      const one = pp.style === 1 || pp.style === 3;
      const la = arm(-1, one && pp.side > 0 ? up * 0.15 : up);
      const ra = arm(1, one && pp.side < 0 ? up * 0.15 : up);
      return { l: la, r: ra, raised: pp.side > 0 ? ra[1] : la[1] };
    },

    person(g, s, hx, hy, pose, ox, oy, fill, H) {
      g.fillStyle = fill;
      g.strokeStyle = fill;
      // Shoulders and torso, running off the bottom of the stage.
      g.beginPath();
      g.moveTo(hx - 30 * s, H + 10);
      g.lineTo(hx - 31 * s, hy + 38 * s);
      g.quadraticCurveTo(hx - 29 * s, hy + 22 * s, hx - 9 * s, hy + 19 * s);
      g.lineTo(hx + 9 * s, hy + 19 * s);
      g.quadraticCurveTo(hx + 29 * s, hy + 22 * s, hx + 31 * s, hy + 38 * s);
      g.lineTo(hx + 30 * s, H + 10);
      g.closePath();
      g.fill();
      // Head and neck.
      g.beginPath();
      g.ellipse(hx, hy + 1 * s, 13 * s, 15 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(hx - 6 * s, hy + 8 * s, 12 * s, 13 * s);
      // Arms.
      g.lineWidth = 12 * s;
      for (const [a, dir] of [[pose.l, -1], [pose.r, 1]]) {
        const sx = hx + dir * 24 * s, sy = hy + 28 * s;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(a[0][0] + ox, a[0][1] + oy);
        g.lineTo(a[1][0] + ox, a[1][1] + oy);
        g.stroke();
        g.beginPath();
        g.arc(a[1][0] + ox, a[1][1] + oy, 6.5 * s, 0, Math.PI * 2);
        g.fill();
      }
    },
  });
})();
