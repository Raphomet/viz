// Laser Congregation: a cathedral nave full of people, the rose window at the
// far end, lasers through the incense.
//
// Batch 06, idea 18 (the Floor): Rave crossed with Ophanim. The camera walks
// slowly down the centre aisle between the pews. Pointed transverse arches
// pass overhead and the side arcades slide by; at the end of the nave the
// rose window hangs in the haze. Its middle ring is Ophanim's ring of eyes,
// but these eyes are closed in calm and, when they open, they all look in at
// the fire at the window's heart, never out at the room: the Psychonaut
// warned that being stared at is the edge of paranoia, and a congregation
// looking at the same light together is the warm version of the image.
//
// Layers, back to front:
//   1. WebGL2 light: warped incense smoke drifting upward; shafts of window
//      light through the smoke (cut by the tracery's spokes, so they turn
//      with the window); laser fans from the window's heart; a warm band of
//      candlelight low in the room; glints of dust.
//   2. Canvas 2D: the rose window (stone tracery, petals, the ring of eyes,
//      an outer ring of roundels, a white-gold heart), the floor and its
//      reflection of the window down the aisle.
//   3. Canvas 2D, painter-sorted by depth: transverse arches, side arcades
//      with clerestory lancets, and rows of people in the pews, fogged by the
//      lit haze in front of them, rim-lit from the window. Candles on stands
//      line the aisle and some people hold them.
//
// Music, each landing in its own place:
//   kick   one laser fan leaves the window's heart over one side of the nave
//          and sweeps as it fades (sides alternate); in the drop a small wave
//          of heads also rolls across the pews from where it lands
//   clap   the window's outer ring of roundels ratchets one notch, and one
//          patch of the congregation claps overhead
//   hats   dust glints in the beams; candle flames flicker
//   bass   the heart of the window and the smoke's colour swell
//   drop   (all params, see PRESETS) the eyes open, the window turns and its
//          spokes extend as a full circle of beams, two standing fans sweep,
//          hands go up, the smoke floods with the lasers' colour and the walk
//          quickens; the breakdown is candlelight in haze: lasers out, eyes
//          closed, the aisle candles and the held candles carry the room.
// Movement: an endless nave (bays and pews recycle), a slow sideways drift so
// the arches parallax against the far window, the smoke rising.

(function () {
  'use strict';

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
uniform vec4  fB[${MAX_FANS}];   // count, intensity, kind (0 fan, 1 full circle), unused
uniform vec3  fC[${MAX_FANS}];   // linear colour
uniform vec4  win;               // window centre xy, radius, turn
uniform vec3  wC[3];             // glass colours for the shafts
uniform float winI;
uniform float spokes;
uniform vec4  hz;
uniform float hazeAmt;
uniform vec3  hazeCol;
uniform float ambGain;
uniform vec3  warm;              // candlelight colour * amount
uniform float floorY;
uniform float hatSeed;
uniform float hatAmt;
uniform float moteT;
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

// Incense: a warped field drifting upward, stretched vertically a little so
// it reads as rising smoke rather than fog.
float haze(vec2 p) {
  vec2 q = p / vec2(210.0, 150.0);
  vec2 w = vec2(vnoise(q * 0.6 + hz.xy), vnoise(q * 0.6 + hz.yx + 5.2));
  q += (w - 0.5) * 1.9;
  return 0.55 * vnoise(q + hz.zw) + 0.3 * vnoise(q * 2.1 - hz.zw * 1.3)
       + 0.15 * vnoise(q * 4.7 + hz.xy * 2.0);
}

// Nearest two beams of a fan (Rave's analytic fan): returns (core, glow).
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
    float m = 0.75 + 0.25 * hash12(vec2(i, A.x + B.z));
    // Beams thicken a little with distance from the window: they are
    // travelling toward the camera.
    float ww = w * (1.0 + r / 260.0);
    core += m * exp(-d * d / (ww * ww));
    glow += m * (0.2 * exp(-d / (5.0 + r / 60.0)) + 0.04 * exp(-d / 30.0));
  }
  return vec2(core, glow);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  float w = max(0.8, 0.75 / unitPx);

  float h = haze(p);
  float dens = hazeAmt * (0.08 + 1.3 * smoothstep(0.3, 0.85, h));

  vec3 col = vec3(0.002, 0.0015, 0.004);

  // Ambient: the smoke lit by the room, brightest near the window's height.
  float nearWin = exp(-abs(p.y - win.y) / 320.0);
  col += hazeCol * dens * ambGain * (0.25 + 0.75 * nearWin);

  // Window light through the smoke: shafts between the tracery's spokes,
  // each in the colour of its glass, turning with the window.
  vec2 v = p - win.xy;
  float r = length(v);
  float th = atan(v.y, v.x);
  float seg = (th - win.w) / TAU * spokes;
  float e = abs(fract(seg) - 0.5);
  float shaft = smoothstep(0.02, 0.32, e);
  int idx = int(mod(floor(seg), 3.0));
  vec3 gc = idx == 0 ? wC[0] : (idx == 1 ? wC[1] : wC[2]);
  float R = win.z;
  float fall = R * R / (R * R + 0.35 * max(0.0, r - R * 0.6) * max(0.0, r - R * 0.6));
  // Shafts vary in strength, as light through panes of different glass does.
  shaft *= 0.3 + 0.7 * hash12(vec2(mod(floor(seg), spokes), 4.1));
  col += gc * winI * shaft * fall * (0.03 + 0.8 * dens);
  // A soft halo right around the window.
  col += mix(wC[0], wC[2], 0.5) * winI * 0.5 * exp(-max(0.0, r - R) / 45.0) * (0.3 + dens);

  // Candlelight: a warm band low in the room, only where there is smoke.
  col += warm * (0.25 + dens) * exp(-max(0.0, p.y - floorY) / 70.0) * smoothstep(floorY - 260.0, floorY - 40.0, p.y);

  // Lasers.
  vec3 light = vec3(0.0);
  for (int k = 0; k < ${MAX_FANS}; k++) {
    if (k >= nFans) break;
    if (fB[k].y <= 0.001) continue;
    vec2 cg = fan(p, fA[k], fB[k], w);
    vec3 c = fC[k] * fB[k].y;
    col += c * cg.x * (0.4 + 1.1 * dens);
    col += mix(c, vec3(fB[k].y), 0.5) * cg.x * cg.x * 0.3;
    light += c * cg.y;
  }
  col += light * (0.25 + 1.3 * dens);

  // Glints: hats scatter dust sparks, brightest in the beams and the shafts.
  float lum = dot(light, vec3(0.3, 0.5, 0.2)) + 0.4 * winI * shaft * fall;
  float sz = max(0.9, 0.9 / unitPx);
  {
    vec2 g = p / 7.0;
    vec2 id = floor(g);
    if (hash12(id + hatSeed * 13.7) > 0.94) {
      vec2 pt = hash22(id + hatSeed * 7.1);
      float d = length((fract(g) - pt) * 7.0);
      col += mix(vec3(1.0, 0.9, 0.7), normalize(light + gc * 0.3 + 0.001) * 1.4, 0.35)
           * exp(-d * d / (sz * sz)) * hatAmt * (0.2 + 3.0 * lum);
    }
  }
  // Motes drifting up through the light, always.
  {
    vec2 q = p + vec2(sin(moteT * 0.11) * 30.0, -moteT * 7.0);
    vec2 g = q / 11.0;
    vec2 id = floor(g);
    if (hash12(id + 71.3) > 0.9) {
      vec2 pt = hash22(id + 3.3);
      float d = length((fract(g) - pt) * 11.0);
      col += (light + gc * winI * shaft * fall * 0.6) * exp(-d * d / (sz * sz)) * 0.9;
    }
  }

  vec2 uv = gl_FragCoord.xy / res - 0.5;
  col *= 1.0 - 0.3 * dot(uv, uv) * 2.0;
  col = 1.0 - exp(-col * 1.1);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  // ---------------------------------------------------------------- colour

  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function toSrgb(c) { return c.map((v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2))); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a).toFixed(3) + ')'; }
  function css(linC, a) { return rgba(toSrgb(linC), a); }

  // Stained glass: the window keeps its own jewel palette whatever the
  // lasers do, like a real window under a real light show.
  const GLASS = {
    lapis: lin('#2346c8'), lapisDk: lin('#0d1c5e'), ruby: lin('#c8142e'), gold: lin('#f0b43a'),
    pale: lin('#f6e2b0'), emerald: lin('#18a068'), heart: lin('#fff1cf'),
  };
  // Laser pairs, chosen to sit with the glass rather than fight it; the
  // third colour is what the bass floods the smoke with.
  const PAIRS = [
    { name: 'Gold & ruby', a: lin('#ffb000'), b: lin('#ff1c3c'), flood: lin('#ff4a1a') },
    { name: 'Lapis & emerald', a: lin('#3a5cff'), b: lin('#12ff8a'), flood: lin('#1a4cff') },
    { name: 'Rose & violet', a: lin('#ff3d8e'), b: lin('#9a3cff'), flood: lin('#8a1cff') },
  ];
  const NIGHT = lin('#0e0a2a');
  const AMBER = lin('#ff9a3c');
  const CANDLE = lin('#ffb866');
  const SHAFT = lin('#ffe2b4');
  const FLAME = [255, 236, 190];

  // What the drop changes, and so what "Follow the track" eases.
  const PRESETS = {
    calm: { open: 0.2, turn: 0.15, lasers: 0.04, hands: 0.12, candles: 0.9, incense: 1, walk: 0.35 },
    drop: { open: 1, turn: 1, lasers: 1, hands: 0.95, candles: 0.3, incense: 1.2, walk: 1 },
    // Vespers: candlelight only, the window asleep, for a long breakdown.
    vespers: { open: 0, turn: 0.05, lasers: 0, hands: 0, candles: 1, incense: 1.4, walk: 0.12, follow: 0 },
    // High mass: the window wide open and turning, lasers, but the room
    // still holding its candles.
    mass: { open: 1, turn: 0.6, lasers: 0.7, hands: 0.6, candles: 1, incense: 1.1, walk: 0.6, follow: 0 },
  };
  const DRIVE = ['open', 'turn', 'lasers', 'hands', 'candles', 'incense', 'walk'];

  // World: metres. Camera in the centre aisle, eye above the crowd's heads.
  const F = 540;              // focal length in virtual units
  const EYE = 2.2;
  const NAVE = 10;            // half-width of the nave, to the pillars' inner face
  const PILLAR = 1.3;
  const SPRING = 14, ARCH_R = 16, ARCH_C = 6;   // pointed arch: arcs of radius R centred ±C at the springing
  const BAY = 5, NBAY = 8, BAY_NEAR = 1.4;
  const WIN_Z = 40, WIN_Y = 17, WIN_R = 7.5;
  const ROW = 1.1, NROW = 20, ROW_NEAR = 1.2;
  const AISLE = 0.85;
  const KICK_HIST = 40;

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(x) { return clamp(x, 0, 1); }
  function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  VIZ.register({
    id: 'congregation',
    name: 'Laser Congregation',
    order: 818,

    params: [
      { key: 'open', label: 'Window opens', type: 'range', min: 0, max: 1, default: PRESETS.calm.open, step: 0.01 },
      { key: 'turn', label: 'Window turns', type: 'range', min: 0, max: 2, default: PRESETS.calm.turn, step: 0.01 },
      { key: 'lasers', label: 'Standing lasers', type: 'range', min: 0, max: 1, default: PRESETS.calm.lasers, step: 0.01 },
      { key: 'hands', label: 'Hands up', type: 'range', min: 0, max: 1, default: PRESETS.calm.hands, step: 0.01 },
      { key: 'candles', label: 'Candlelight', type: 'range', min: 0, max: 1, default: PRESETS.calm.candles, step: 0.01 },
      { key: 'incense', label: 'Incense', type: 'range', min: 0.3, max: 1.8, default: PRESETS.calm.incense, step: 0.01 },
      { key: 'walk', label: 'Walk down the nave', type: 'range', min: 0, max: 2, default: PRESETS.calm.walk, step: 0.01 },
      { key: 'colours', label: 'Laser colours', type: 'select',
        options: ['New pair each drop'].concat(PAIRS.map((q) => q.name)), default: 0 },
      { key: 'react', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Laser Congregation',
      technique: 'WebGL2 fragment shader for the light (warped incense fBm; window shafts cut by the tracery\'s spokes and coloured per pane; Rave\'s analytic laser fans from the window\'s heart; a candlelit band; hashed glints and motes) under Canvas 2D: a rose window of petals, a ring of eyes and roundels in stone tracery, and a painter-sorted endless nave of pointed arches, arcades with clerestory lancets and pews of rim-lit people with candles, projected in one-point perspective',
      brief: 'Walking slowly down the centre aisle of a cathedral full of people. Pointed arches pass overhead, candles on stands line the aisle, and at the far end a rose window hangs in the incense, its ring of eyes closed. Kick: one laser fan leaves the window\'s heart over one side of the nave and sweeps as it fades. Clap: the window\'s outer ring ratchets one notch and one patch of the congregation claps overhead. Hats: dust glints in the light and the candles flicker. Bass: the window\'s heart and the smoke\'s colour swell. The drop: the eyes open, all looking in at the light at the window\'s heart, the window turns and its spokes extend as a full circle of beams, two standing fans sweep, hands go up and the smoke floods with the lasers\' colour. The breakdown is candlelight in haze.',
      lineage: [
        'Batch 06, idea 18 (the Floor): "Laser Congregation", Rave crossed with Ophanim.',
        'Rave (web/scenes/rave.js): analytic laser fans resolved per pixel from the angle to the source, smoke as the medium the light needs, rim-lit crowd rows recycling under a dollying camera, and its batch-02 lesson that the kick must stay local.',
        'Ophanim (web/scenes/ophanim.js): the ring of calm almond eyes and the white-gold fire at its centre, rebuilt as stained glass. The Psychonaut\'s warning that being stared at is the edge of paranoia decided the gaze: every eye looks in at the heart, never at the room.',
        'Gothic rose windows (Chartres, Notre-Dame\'s north rose) and the nave as a one-point perspective of pointed arches: the "somewhere to fall into" is the light at the end of it.',
        'The Floor\'s wider notes: per-drop palette rotation (from Rave) so the third drop is not the first; the Director\'s coiled pose, so hands rise through the build and release on the drop.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},
    enter() { this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, hf: 0, hs: 0, hArm: true,
        bass: 0, pad: 0, high: 0, low: 0, dropOn: false, auto: 0, lastK: -9, lastC: -9, lastH: -9 };
      this.kick = 0;
      this.kickHist = new Float32Array(KICK_HIST);
      this.fans = [];          // kick fans: { t0, aim, dir, col, I }
      this.kickSide = 1;
      this.clapX = 0; this.clapT = -9;
      this.hat = 0; this.hatCount = 0;
      this.camZ = 0; this.camX = 0;
      this.turnA = 0; this.ratchet = 0; this.ratchetShown = 0;
      this.fanT = 0;
      this.pairIdx = 0; this.hot = false;
      this.hazeCol = NIGHT.slice();
      this.hazeT = [Math.random() * 50, Math.random() * 50];
      this.rows = [];
      for (let i = 0; i < NROW; i++) this.rows.push(this.makeRow(ROW_NEAR + 0.4 + i * ROW));
      this.bays = [];
      for (let i = 0; i < NBAY; i++) this.bays.push({ z: BAY_NEAR + 1 + i * BAY, seed: Math.random() });
    },

    makeRow(z) {
      const r = Math.random;
      const people = [];
      for (const side of [-1, 1]) {
        for (let x = AISLE + 0.3; x < NAVE - 0.4; x += 0.52 * (0.85 + 0.35 * r())) {
          const u = r();
          people.push({
            X: side * (x + (r() - 0.5) * 0.08),
            dy: (r() - 0.5) * 0.16,
            sz: 0.9 + 0.2 * r(),
            ph: r() * Math.PI * 2,
            // 0 V, 1 pump, 2 wave, 3 candle, 4 arm round a neighbour
            style: u < 0.16 ? 3 : u < 0.3 ? 4 : Math.floor(r() * 3),
            eager: r(),
            side: r() < 0.5 ? -1 : 1,
          });
        }
      }
      return { z, people };
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
      for (const n of ['res', 'unitPx', 'nFans', 'fA', 'fB', 'fC', 'win', 'wC', 'winI', 'spokes', 'hz',
        'hazeAmt', 'hazeCol', 'ambGain', 'warm', 'floorY', 'hatSeed', 'hatAmt', 'moteT']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      this.gl = gl; this.glCanvas = c; this.u = u;
      this.fA = new Float32Array(MAX_FANS * 4);
      this.fB = new Float32Array(MAX_FANS * 4);
      this.fC = new Float32Array(MAX_FANS * 3);
    },

    // Onsets as fast-minus-slow envelopes (Engraved Deep's detector), so the
    // drop's sidechained bass and the breakdown's pad never read as beats.
    listen(sg, dt, T) {
      const e = this.env;
      const k = sg[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp01((e.kf - e.ks) * 2.2);
      let kick = 0;
      if (e.kArm && kOn > 0.22 && T - e.lastK > 0.22) { kick = kOn; e.kArm = false; e.lastK = T; }
      if (kOn < 0.1) e.kArm = true;
      const cl = (sg[3] + sg[4] + sg[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp01((e.cf - e.cs) * 3);
      let clap = 0;
      if (e.cArm && cOn > 0.25 && T - e.lastC > 0.3) { clap = cOn; e.cArm = false; e.lastC = T; }
      if (cOn < 0.1) e.cArm = true;
      const hh = (sg[7] + sg[8]) / 200;
      e.hf = ease(e.hf, hh, 45, dt);
      e.hs = ease(e.hs, hh, 4, dt);
      const hOn = clamp01((e.hf - e.hs) * 3);
      let hat = 0;
      if (e.hArm && hOn > 0.12 && T - e.lastH > 0.07) { hat = 0.4 + hOn; e.hArm = false; e.lastH = T; }
      if (hOn < 0.05) e.hArm = true;
      e.bass = ease(e.bass, (sg[0] + sg[1] + sg[2]) / 300, 3, dt);
      e.pad = ease(e.pad, (sg[2] + sg[3] + sg[4]) / 300, 1.2, dt);
      e.high = ease(e.high, (sg[5] + sg[6] + sg[7]) / 300, 0.9, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, sg[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap, hat };
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.reset();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const T = this.clock;
      const e = this.env;
      const hit = this.listen(signals, dt, T);
      const react = params.react;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.5 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // Laser colours: a new pair each time the standing lasers come up, so
      // every drop wears a different outfit.
      const hotNow = P.lasers > (this.hot ? 0.35 : 0.6);
      if (hotNow && !this.hot) this.pairIdx++;
      this.hot = hotNow;
      const choice = Math.round(params.colours);
      const pair = PAIRS[choice === 0 ? this.pairIdx % PAIRS.length : choice - 1];

      // ---- events
      if (hit.kick) {
        this.kick = Math.min(1, hit.kick * 1.6);
        this.kickSide = -this.kickSide;
        this.fans.push({ t0: T, aim: -Math.PI / 2 + this.kickSide * (0.3 + 0.35 * Math.random()),
          dir: -this.kickSide * (0.5 + 0.5 * Math.random()),
          // Paler than the standing fans, so the beat reads against them.
          col: mix3(this.fans.length % 2 ? pair.a : pair.b, GLASS.pale, 0.45),
          I: clamp01(0.5 + hit.kick) });
        if (this.fans.length > 2) this.fans.shift();
      }
      if (hit.clap) {
        this.ratchet++;
        this.clapT = T;
        this.clapX = (Math.random() - 0.5) * ctx.width * 0.7;
      }
      if (hit.hat) { this.hatCount++; this.hat = Math.min(1, hit.hat); }
      this.kick *= Math.exp(-dt / 0.15);
      this.hat *= Math.exp(-dt / 0.08);
      this.kickHist.copyWithin(1, 0, KICK_HIST - 1);
      this.kickHist[0] = this.kick;

      // ---- motion
      const W = ctx.width, H = ctx.height;
      this.camZ += dt * (0.08 + 0.55 * P.walk) * (0.85 + 0.3 * e.bass);
      this.camX = 0.45 * Math.sin(T * 0.047 + 1) + 0.2 * Math.sin(T * 0.113);
      this.turnA += dt * P.turn * (0.12 + 0.06 * e.bass);
      this.ratchetShown = ease(this.ratchetShown, this.ratchet, 9, dt);
      this.fanT += dt * (0.25 + 0.75 * P.lasers);
      this.hazeT[0] += dt * 0.015;
      this.hazeT[1] += dt * (0.05 + 0.03 * P.incense);

      const cx = W / 2, hY = H * 0.66;
      this.view = { cx, hY, W, H };
      const win = this.proj(0, WIN_Y, WIN_Z);
      const winR = WIN_R * F / WIN_Z;

      // Smoke colour: night indigo, warmed by the candles, flooded with the
      // lasers' colour by the bass once they are up.
      let hz = mix3(NIGHT, scale3(AMBER, 0.32), P.candles * 0.5);
      hz = mix3(hz, pair.flood, clamp01(P.lasers * (0.35 + 0.8 * e.bass * react)) * 0.75);
      this.hazeCol = mix3(this.hazeCol, hz, 1 - Math.exp(-2 * dt));
      const glassLum = 0.35 + 0.65 * P.open + 0.25 * e.bass;
      const winI = (0.22 + 0.5 * P.open + 0.25 * e.bass * react) * (0.7 + 0.3 * P.incense);

      // ---- light (WebGL)
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Laser Congregation needs WebGL2', W / 2, H / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, Math.min(w, h) / 600);
      // Shader space: virtual units, origin at centre, y up.
      const sx = win[0] - W / 2, sy = H / 2 - win[1];

      const fans = [];
      // Kick fans: each leaves the heart, sweeps across its side and fades.
      for (const f of this.fans) {
        const age = T - f.t0;
        const I = f.I * react * smooth(0, 0.04, age) * Math.exp(-age / 0.33);
        if (I < 0.01) continue;
        fans.push([sx, sy, f.aim + f.dir * 0.45 * age, 0.05, 7, I * 1.25, 0, f.col]);
      }
      // Standing fans (the drop): two sweeping fans, mirrored.
      if (P.lasers > 0.01) {
        const a = 0.55 * Math.sin(this.fanT * 0.9) + 0.15 * Math.sin(this.fanT * 2.3);
        const nB = 5 + Math.round(8 * P.lasers);
        fans.push([sx, sy, -Math.PI / 2 - 0.5 + a, 0.07 * P.lasers + 0.01, nB, 0.7 * P.lasers, 0, pair.a]);
        fans.push([sx, sy, -Math.PI / 2 + 0.5 - a, 0.07 * P.lasers + 0.01, nB, 0.7 * P.lasers, 0, pair.b]);
      }
      // The window's spokes as a full circle of beams: only when it is open
      // and the lasers are up.
      const ringI = P.lasers * smooth(0.4, 1, P.open) * 0.55;
      if (ringI > 0.01) fans.push([sx, sy, this.turnA * 2 + Math.PI / 16, Math.PI * 2 / 16, 16, ringI, 1, mix3(pair.a, GLASS.pale, 0.3)]);
      const n = Math.min(MAX_FANS, fans.length);
      for (let i = 0; i < n; i++) {
        const f = fans[i];
        this.fA.set([f[0], f[1], f[2], f[3]], i * 4);
        this.fB.set([f[4], f[5], f[6], 0], i * 4);
        this.fC.set(f[7], i * 3);
      }
      gl.uniform1i(u.nFans, n);
      gl.uniform4fv(u.fA, this.fA);
      gl.uniform4fv(u.fB, this.fB);
      gl.uniform3fv(u.fC, this.fC);
      gl.uniform4f(u.win, sx, sy, winR, this.turnA * 2);
      // Calm shafts are one warm pale light; the glass only tints them as the
      // window opens, so the resting room is not a spoked rainbow.
      const tint = 0.12 + 0.45 * P.open;
      const gcol = [GLASS.lapis, GLASS.gold, GLASS.ruby].map((c) => scale3(mix3(SHAFT, c, tint), 0.8));
      gl.uniform3fv(u.wC, gcol[0].concat(gcol[1], gcol[2]));
      gl.uniform1f(u.winI, winI);
      gl.uniform1f(u.spokes, 16);
      gl.uniform4f(u.hz, this.hazeT[0], this.hazeT[0] * 0.7 + 3, -this.hazeT[0] * 0.3, -this.hazeT[1]);
      gl.uniform1f(u.hazeAmt, P.incense);
      gl.uniform3fv(u.hazeCol, this.hazeCol);
      gl.uniform1f(u.ambGain, 0.08 + 0.3 * e.bass * react + 0.1 * e.pad);
      gl.uniform3fv(u.warm, scale3(CANDLE, 0.16 * P.candles * (0.85 + 0.15 * Math.sin(T * 7.3) * this.hat)));
      gl.uniform1f(u.floorY, H / 2 - hY);
      gl.uniform1f(u.hatSeed, this.hatCount % 997);
      gl.uniform1f(u.hatAmt, this.hat * Math.min(1.6, react) * 1.2);
      gl.uniform1f(u.moteT, T);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, W, H);

      // ---- the room (Canvas 2D)
      const g = p.drawingContext;
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      this.drawWindow(g, win[0], win[1], winR, P, glassLum, e, T);
      this.drawFloor(g, win, winR, P, winI);
      // What the smoke in front of a far arch or row looks like: dim, so near
      // stone and people stay silhouettes and only distance lifts them.
      const fogLin = mix3(scale3(this.hazeCol, 0.06 + 0.12 * e.bass), scale3(SHAFT, 0.025 * winI), 0.35);
      const S = { P, e, T, react, pair, winI, glassLum, fogLin };
      this.drawNave(g, S);
      g.restore();
    },

    proj(X, Y, z) {
      const v = this.view;
      return [v.cx + (X - this.camX) * F / z, v.hY - (Y - EYE) * F / z];
    },

    // ---------------------------------------------------------------- window

    drawWindow(g, x, y, R, P, L, e, T) {
      const TAU = Math.PI * 2;
      const glass = (c, k) => css(scale3(c, L * (k || 1)));
      const stone = css([0.012, 0.01, 0.014]);
      const lead = 'rgba(10,8,12,0.9)';
      g.save();
      g.translate(x, y);
      // Stone frame.
      g.beginPath(); g.arc(0, 0, R * 1.1, 0, TAU); g.fillStyle = stone; g.fill();
      // Ground glass: deep lapis.
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = glass(GLASS.lapisDk, 1.1); g.fill();

      // Outer ring: roundels (quatrefoils), stepped by the clap.
      const aC = -this.turnA * 0.5 + this.ratchetShown * (TAU / 24);
      g.lineWidth = R * 0.018;
      for (let i = 0; i < 24; i++) {
        const a = aC + i * TAU / 24;
        const px = Math.cos(a) * R * 0.915, py = Math.sin(a) * R * 0.915;
        const rr = R * 0.068;
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const b = a + k * Math.PI / 2;
          g.moveTo(px + Math.cos(b) * rr * 0.55 + rr * 0.48, py + Math.sin(b) * rr * 0.55);
          g.arc(px + Math.cos(b) * rr * 0.55, py + Math.sin(b) * rr * 0.55, rr * 0.48, 0, TAU);
        }
        g.fillStyle = glass(i % 2 ? GLASS.ruby : GLASS.gold, i % 2 ? 1.25 : 0.95);
        g.fill();
        g.strokeStyle = lead; g.stroke();
      }
      // Band of the eyes: lapis glass.
      g.beginPath(); g.arc(0, 0, R * 0.83, 0, TAU); g.fillStyle = stone; g.fill();
      g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.fillStyle = glass(GLASS.lapis, 0.9); g.fill();
      const aB = -this.turnA * 0.7;
      const nE = 12;
      for (let i = 0; i < nE; i++) {
        const a = aB + (i + 0.5) * TAU / nE;
        // Each eye opens a little after its neighbour, so the drop opens
        // the ring as a wave rather than all at once.
        const o = clamp01((P.open - 0.15) / 0.75 * 1.25 - ((i * 5) % nE) / nE * 0.25);
        const blink = 1 - 0.9 * smooth(0.96, 1, Math.sin(T * 0.37 + i * 1.7) * 0.5 + 0.5);
        g.save();
        g.rotate(a);
        g.translate(R * 0.685, 0);
        g.rotate(Math.PI / 2);
        g.scale(R * 0.105, R * 0.105);
        this.eye(g, o * blink, L);
        g.restore();
      }
      // Petal ring: eight lancet petals, ruby and gold, that lengthen as the
      // window opens.
      g.beginPath(); g.arc(0, 0, R * 0.57, 0, TAU); g.fillStyle = stone; g.fill();
      g.beginPath(); g.arc(0, 0, R * 0.545, 0, TAU); g.fillStyle = glass(GLASS.lapisDk, 1.4); g.fill();
      const aA = this.turnA;
      const len = 0.42 + 0.1 * P.open;
      g.lineWidth = R * 0.02;
      for (let i = 0; i < 8; i++) {
        const a = aA + i * TAU / 8;
        g.save();
        g.rotate(a);
        g.beginPath();
        const r0 = R * 0.2, r1 = R * (0.2 + len * 0.8), hw = R * 0.105;
        g.moveTo(r0, 0);
        g.quadraticCurveTo(r0 + (r1 - r0) * 0.25, -hw * 1.2, r0 + (r1 - r0) * 0.62, -hw * 0.9);
        g.quadraticCurveTo(r1 - (r1 - r0) * 0.12, -hw * 0.5, r1, 0);
        g.quadraticCurveTo(r1 - (r1 - r0) * 0.12, hw * 0.5, r0 + (r1 - r0) * 0.62, hw * 0.9);
        g.quadraticCurveTo(r0 + (r1 - r0) * 0.25, hw * 1.2, r0, 0);
        g.fillStyle = glass(i % 2 ? GLASS.gold : GLASS.ruby, i % 2 ? 1 : 1.3);
        g.fill();
        g.strokeStyle = stone; g.stroke();
        // A small trefoil of emerald in each petal.
        g.beginPath(); g.arc(r0 + (r1 - r0) * 0.6, 0, hw * 0.38, 0, TAU);
        g.fillStyle = glass(GLASS.emerald, 1.3); g.fill();
        g.lineWidth = R * 0.012; g.strokeStyle = lead; g.stroke();
        g.lineWidth = R * 0.02;
        g.restore();
      }
      // Tracery spokes between the petals, continuing through the ring of
      // eyes to the rim: sixteen, as the shafts in the smoke.
      g.strokeStyle = stone;
      g.lineWidth = R * 0.028;
      for (let i = 0; i < 16; i++) {
        const a = aA + (i + 0.5) * TAU / 16;
        g.beginPath();
        g.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
        g.lineTo(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56);
        g.stroke();
      }
      // The heart: white-gold glass with an eight-point star, swelling with
      // the bass.
      const hr = R * 0.19;
      g.beginPath(); g.arc(0, 0, hr * 1.08, 0, TAU); g.fillStyle = stone; g.fill();
      g.beginPath(); g.arc(0, 0, hr, 0, TAU); g.fillStyle = glass(GLASS.gold, 1.2); g.fill();
      g.beginPath();
      const sp = 0.55 + 0.25 * e.bass;
      for (let i = 0; i < 16; i++) {
        const a = aA * 1.5 + i * Math.PI / 8;
        const rr = hr * (i % 2 ? 0.38 : 0.95 * sp + 0.3);
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = css(scale3(GLASS.heart, Math.min(1.2, L * 1.1 + 0.3 * e.bass)));
      g.fill();
      // A soft bloom over the heart, held small: the window is a light
      // source, not a flare.
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.7);
      gr.addColorStop(0, css(scale3(GLASS.heart, 0.35 * L * (0.4 + e.bass)), 1));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, R * 0.7, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.restore();
    },

    // One eye of stained glass, long axis along x, half-width 1. Closed it is
    // a gold lid line; open, its iris sits toward -y, which after the ring's
    // rotation is always toward the window's heart.
    eye(g, open, L) {
      const stone = 'rgb(4,3,5)';
      g.beginPath();
      g.moveTo(-1.35, 0);
      g.bezierCurveTo(-0.6, -1.05, 0.6, -1.05, 1.35, 0);
      g.bezierCurveTo(0.6, 1.05, -0.6, 1.05, -1.35, 0);
      g.fillStyle = css(scale3(GLASS.ruby, 0.7 * L)); g.fill();
      g.lineWidth = 0.14; g.strokeStyle = stone; g.stroke();
      if (open < 0.06) {
        g.beginPath(); g.moveTo(-0.95, -0.05); g.quadraticCurveTo(0, 0.4, 0.95, -0.05);
        g.lineWidth = 0.16; g.strokeStyle = css(scale3(GLASS.gold, 0.6 + 0.6 * L)); g.stroke();
        return;
      }
      const hh = 0.62 * open;
      g.save();
      g.beginPath();
      g.moveTo(-1, 0); g.bezierCurveTo(-0.45, -hh * 1.3, 0.45, -hh * 1.3, 1, 0);
      g.bezierCurveTo(0.45, hh * 1.05, -0.45, hh * 1.05, -1, 0);
      g.fillStyle = css(scale3(GLASS.pale, L)); g.fill();
      g.clip();
      g.beginPath(); g.arc(0, -0.12, 0.48, 0, Math.PI * 2); g.fillStyle = css(scale3(GLASS.emerald, 1.1 * L)); g.fill();
      g.beginPath(); g.arc(0, -0.16, 0.2, 0, Math.PI * 2); g.fillStyle = stone; g.fill();
      g.restore();
      g.beginPath(); g.moveTo(-1, 0); g.bezierCurveTo(-0.45, -hh * 1.3, 0.45, -hh * 1.3, 1, 0);
      g.lineWidth = 0.15; g.strokeStyle = css(scale3(GLASS.gold, 0.6 + 0.6 * L)); g.stroke();
      g.beginPath(); g.moveTo(1, 0); g.bezierCurveTo(0.45, hh * 1.05, -0.45, hh * 1.05, -1, 0);
      g.lineWidth = 0.08; g.strokeStyle = stone; g.stroke();
    },

    // ---------------------------------------------------------------- floor

    drawFloor(g, win, winR, P, winI) {
      const { W, H, hY } = this.view;
      const gr = g.createLinearGradient(0, hY, 0, H);
      const far = toSrgb(scale3(this.hazeCol, 0.35));
      gr.addColorStop(0, rgba(far, 0.85));
      gr.addColorStop(0.25, 'rgba(4,3,6,0.97)');
      gr.addColorStop(1, 'rgba(2,2,3,1)');
      g.fillStyle = gr;
      g.fillRect(0, hY - 2, W, H - hY + 4);
      // The window's reflection in the polished aisle: a long soft streak
      // straight toward the camera, and candle warmth either side.
      g.globalCompositeOperation = 'lighter';
      const rx = win[0];
      const rg = g.createLinearGradient(0, hY, 0, H);
      const rc = toSrgb(mix3(GLASS.gold, GLASS.lapis, 0.4).map((v) => v * (0.06 + 0.1 * winI)));
      rg.addColorStop(0, rgba(rc, 0.9));
      rg.addColorStop(1, rgba(rc, 0.1));
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(rx - 3, hY);
      g.lineTo(rx + 3, hY);
      g.lineTo(rx + 40, H);
      g.lineTo(rx - 40, H);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'source-over';
    },

    // ---------------------------------------------------------------- nave

    drawNave(g, S) {
      // Recycle bays and rows the camera has walked past.
      for (const b of this.bays) {
        if (b.z - this.camZ < BAY_NEAR) { b.z += NBAY * BAY; b.seed = Math.random(); }
      }
      for (const r of this.rows) {
        if (r.z - this.camZ < ROW_NEAR) { const nr = this.makeRow(r.z + NROW * ROW); r.z = nr.z; r.people = nr.people; }
      }
      const items = [];
      for (const b of this.bays) items.push({ z: b.z - this.camZ, bay: b });
      for (const r of this.rows) items.push({ z: r.z - this.camZ, row: r });
      items.sort((a, b) => b.z - a.z);
      for (const it of items) {
        if (it.bay) this.drawBay(g, it.z, S);
        else this.drawRow(g, it.row, it.z, S);
      }
    },

    fog(z) { return 1 - Math.exp(-z / 16); },

    stoneAt(z, S) {
      const f = this.fog(z);
      return mix3([0.0016, 0.0014, 0.0022], S.fogLin, f * f * 0.9);
    },

    // One bay at depth z: the transverse arch and its two pillars, and the
    // side walls back to the next bay (arcade opening, clerestory lancet).
    drawBay(g, z, S) {
      if (z < 0.6) return;
      const farZ = BAY_NEAR + NBAY * BAY;
      const fadeIn = smooth(farZ, farZ - 4, z);
      const stone = this.stoneAt(z, S);
      const P = (X, Y, zz) => this.proj(X, Y, zz === undefined ? z : zz);
      g.globalAlpha = fadeIn;

      // Side walls first (they run away from this arch into the distance).
      const z2 = z + BAY;
      const wallCol = this.stoneAt(z + BAY * 0.5, S);
      for (const s of [-1, 1]) {
        const X = s * (NAVE + PILLAR * 0.5);
        const q = (Y, zz) => P(X, Y, zz);
        g.beginPath();
        // outer: the wall panel from floor to springing
        let a = q(0, z), b = q(SPRING, z), c = q(SPRING, z2), d = q(0, z2);
        g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
        // hole: the arcade's pointed opening onto the aisle
        const za = z + BAY * 0.14, zb = z + BAY * 0.86, zm = (za + zb) / 2;
        const spring = 7.2, apex = 10.4;
        g.moveTo(...q(0, za));
        g.lineTo(...q(spring, za));
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const zz = za + (zm - za) * t;
          const yy = spring + (apex - spring) * Math.sin(t * Math.PI / 2);
          g.lineTo(...q(yy, zz));
        }
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const zz = zm + (zb - zm) * t;
          const yy = spring + (apex - spring) * Math.cos(t * Math.PI / 2);
          g.lineTo(...q(yy, zz));
        }
        g.lineTo(...q(0, zb));
        g.closePath();
        g.fillStyle = css(wallCol);
        g.fill('evenodd');
        // Clerestory lancet: stained glass lit dimly from outside.
        const la = z + BAY * 0.38, lb = z + BAY * 0.62, lm = (la + lb) / 2;
        g.beginPath();
        g.moveTo(...q(11.2, la)); g.lineTo(...q(12.8, la)); g.lineTo(...q(13.6, lm)); g.lineTo(...q(12.8, lb));
        g.lineTo(...q(11.2, lb)); g.closePath();
        const lc = mix3(S.pair.b, GLASS.lapis, 0.6);
        g.fillStyle = css(mix3(scale3(lc, 0.03 + 0.07 * S.P.open), S.fogLin, this.fog(z) * 0.6));
        g.fill();
      }

      // The transverse arch: a pointed rib on two pillars, cut by even-odd
      // from its outer silhouette.
      const t = 1.4;
      const hw = NAVE;
      g.beginPath();
      const outer = [];
      outer.push(P(-hw - PILLAR, 0));
      outer.push(P(-hw - PILLAR, SPRING));
      const arc = (R, pts, inner) => {
        // left half: centred at (+C, SPRING) from angle PI to the apex
        const apexAng = Math.acos(ARCH_C / R);
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const a = Math.PI - (Math.PI - apexAng) * (i / n);
          pts.push(P(ARCH_C + Math.cos(a) * R, SPRING + Math.sin(a) * R));
        }
        for (let i = n; i >= 0; i--) {
          const a = Math.PI - (Math.PI - apexAng) * (i / n);
          pts.push(P(-ARCH_C - Math.cos(a) * R, SPRING + Math.sin(a) * R));
        }
      };
      arc(ARCH_R + t, outer);
      outer.push(P(hw + PILLAR, SPRING));
      outer.push(P(hw + PILLAR, 0));
      g.moveTo(outer[0][0], outer[0][1]);
      for (const q of outer) g.lineTo(q[0], q[1]);
      g.closePath();
      const inner = [];
      inner.push(P(-hw, 0));
      inner.push(P(-hw, SPRING));
      arc(ARCH_R, inner);
      inner.push(P(hw, SPRING));
      inner.push(P(hw, 0));
      g.moveTo(inner[0][0], inner[0][1]);
      for (const q of inner) g.lineTo(q[0], q[1]);
      g.closePath();
      g.fillStyle = css(stone);
      g.fill('evenodd');
      // Rim: the inner edge catches the window's light.
      const rim = mix3(mix3(GLASS.gold, GLASS.lapis, 0.35), S.pair.a, 0.25 * S.P.lasers);
      g.beginPath();
      for (let i = 1; i < inner.length - 1; i++) g.lineTo(inner[i][0], inner[i][1]);
      g.lineWidth = Math.max(0.6, 0.06 * F / z);
      g.strokeStyle = css(scale3(rim, (0.1 + 0.25 * S.winI) * (1 - 0.7 * this.fog(z))));
      g.stroke();
      g.globalAlpha = 1;
    },

    // ---------------------------------------------------------------- people

    drawRow(g, row, z, S) {
      if (z < 0.5) return;
      const { W, H } = this.view;
      const { P, e, T, react } = S;
      const farZ = ROW_NEAR + NROW * ROW;
      g.globalAlpha = smooth(farZ, farZ - 2, z);
      const f = this.fog(z);
      const body = css(mix3([0.002, 0.0017, 0.0028], S.fogLin, f * 0.85));
      const s0 = F / (108 * z);
      const rimLin = mix3(mix3(GLASS.gold, GLASS.lapis, 0.3), S.pair.a, 0.4 * P.lasers);
      const rimCol = css(scale3(rimLin, (0.18 + 0.4 * S.winI) * (1 - 0.6 * f)));
      const warmRim = css(scale3(CANDLE, 0.35 * P.candles * (1 - 0.5 * f)));
      const raise = clamp01(Math.max(P.hands, e.high * 1.4 - 0.1));
      const clapAge = T - this.clapT;
      const clapEnv = clapAge < 0.6 ? Math.exp(-clapAge / 0.22) : 0;

      for (const pp of row.people) {
        const s = s0 * pp.sz;
        const [x0, y0] = this.proj(pp.X, 1.62 + pp.dy, z);
        if (x0 < -90 * s || x0 > W + 90 * s) continue;
        if (y0 - 80 * s > H) continue;
        // The kick in the drop: a small wave of heads from where the fan
        // landed, never the whole room.
        const lag = Math.min(KICK_HIST - 1, Math.floor(Math.abs(x0 - W / 2 - this.kickSide * 180) / 30));
        const k = this.kickHist[lag] * react * P.lasers;
        // Everyone sways together, a slow wave travelling across the room.
        const sway = s * 7 * Math.sin(T * 1.25 - x0 * 0.004 + pp.ph * 0.25) * (1 - 0.5 * e.auto);
        const bob = s * (9 * k + 2.5 * Math.sin(T * 1.25 * 2 + pp.ph));
        const hx = x0 + sway, hy = y0 + bob;
        let up = clamp01((raise - pp.eager * 0.55) / 0.45);
        let clap = 0;
        if (clapEnv > 0.02 && Math.abs(x0 - W / 2 - this.clapX) < 150) { clap = clapEnv; up = Math.max(up, clapEnv); }
        if (pp.style === 3) up = Math.max(up, 0.55 * P.candles);
        const pose = this.pose(pp, s, hx, hy, up, clap, k, T);
        if (s > 0.28) {
          this.person(g, s, hx, hy - 1.7 * s, pose, 0, -1.7 * s, rimCol, H);
          if (P.candles > 0.05) this.person(g, s, hx + pp.side * 1.2 * s, hy + 0.5 * s, pose, pp.side * 1.2 * s, 0.5 * s, warmRim, H);
        }
        this.person(g, s, hx, hy, pose, 0, 0, body, H);
        if (pp.style === 3 && P.candles > 0.03) {
          const hand = pose.raised;
          this.flame(g, hand[0], hand[1] - 6 * s, s, P.candles * g.globalAlpha, T + pp.ph * 3, f);
        }
      }
      // Candle stands along the aisle, both sides.
      if (P.candles > 0.03) {
        for (const sd of [-1, 1]) {
          const base = this.proj(sd * (AISLE - 0.1), 0, z);
          const top = this.proj(sd * (AISLE - 0.1), 1.05, z);
          g.strokeStyle = body;
          g.lineWidth = Math.max(0.5, 0.025 * F / z);
          g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(top[0], top[1]); g.stroke();
          this.flame(g, top[0], top[1] - 0.5 * s0, s0 * 0.9, P.candles * g.globalAlpha, T * 1.1 + row.z * 7 + sd, f);
        }
      }
      g.globalAlpha = 1;
    },

    flame(g, x, y, s, amt, ph, f) {
      const flick = 0.85 + 0.15 * Math.sin(ph * 9.1) * Math.sin(ph * 5.3 + 1) + 0.25 * this.hat * Math.sin(ph * 17);
      const a = amt * (1 - 0.55 * f);
      if (a < 0.02) return;
      g.globalCompositeOperation = 'lighter';
      const R = 34 * s * flick;
      if (R > 1) {
        const gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, css(scale3(CANDLE, 0.4 * a)));
        gr.addColorStop(0.35, css(scale3(CANDLE, 0.1 * a)));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(FLAME, Math.min(1, a * 1.3));
      g.beginPath();
      const fh = 9 * s * flick, fw = 2.6 * s;
      g.moveTo(x, y - fh);
      g.quadraticCurveTo(x + fw * 1.6, y - fh * 0.2, x, y + fw);
      g.quadraticCurveTo(x - fw * 1.6, y - fh * 0.2, x, y - fh);
      g.fill();
    },

    // Arm geometry in screen units: each arm is [elbow, hand].
    pose(pp, s, hx, hy, up, clap, k, t) {
      const arm = (dir, lift) => {
        let ex = hx + dir * 34 * s, ey = hy + 55 * s;
        let hxx = hx + dir * 36 * s, hyy = hy + 110 * s;
        const uex = hx + dir * 38 * s, uey = hy - 6 * s;
        let uhx = hx + dir * 42 * s, uhy = hy - 60 * s;
        if (pp.style === 1) uhy -= 12 * s * k;
        if (pp.style === 2) uhx += 12 * s * Math.sin(t * 2.5 + pp.ph);
        // Clap: hands meet over the head.
        uhx += (hx + dir * 5 * s - uhx) * clap;
        ex += (uex - ex) * lift; ey += (uey - ey) * lift;
        hxx += (uhx - hxx) * lift; hyy += (uhy - hyy) * lift;
        return [[ex, ey], [hxx, hyy]];
      };
      const around = (dir) => [[hx + dir * 36 * s, hy + 26 * s], [hx + dir * 62 * s, hy + 22 * s]];
      let la, ra;
      if (pp.style === 4 && clap < 0.3) {
        // An arm round a neighbour's shoulders; the other goes up with the room.
        la = pp.side < 0 ? around(-1) : arm(-1, up);
        ra = pp.side > 0 ? around(1) : arm(1, up);
      } else {
        const one = pp.style === 1 || pp.style === 3;
        la = arm(-1, one && pp.side > 0 && clap < 0.3 ? up * 0.12 : up);
        ra = arm(1, one && pp.side < 0 && clap < 0.3 ? up * 0.12 : up);
      }
      return { l: la, r: ra, raised: pp.side > 0 ? ra[1] : la[1] };
    },

    person(g, s, hx, hy, pose, ox, oy, fill, H) {
      g.fillStyle = fill;
      g.strokeStyle = fill;
      g.beginPath();
      g.moveTo(hx - 30 * s, H + 10);
      g.lineTo(hx - 31 * s, hy + 38 * s);
      g.quadraticCurveTo(hx - 29 * s, hy + 22 * s, hx - 9 * s, hy + 19 * s);
      g.lineTo(hx + 9 * s, hy + 19 * s);
      g.quadraticCurveTo(hx + 29 * s, hy + 22 * s, hx + 31 * s, hy + 38 * s);
      g.lineTo(hx + 30 * s, H + 10);
      g.closePath();
      g.fill();
      g.beginPath();
      g.ellipse(hx, hy + 1 * s, 13 * s, 15 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(hx - 6 * s, hy + 8 * s, 12 * s, 13 * s);
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
