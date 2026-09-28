// Material Tunnel — a living reef you fly down.
//
// Batch 06 idea 9 (Psychonaut): "a feedback tunnel whose walls are
// reaction-diffusion reef, curl-noise smoke, or matte Delaunay discs with no
// glow at all". This is the reef, fused with the Delaunay tunnel: Gray-Scott
// tissue grows on the tunnel wall, and every kick lays a new ring of flat,
// matte ink at the vanishing point that the flight carries outward, so the
// walls become Sonia Delaunay's concentric colour rings with coral growing
// through them. Why the reef over smoke or discs: it is the only one of the
// three that is a process you fly *through* (the judge's own wish, "a
// simulation you fly through"); the discs alone would be Orphism in a tube,
// and smoke would be Current in a tube. The Delaunay rings are kept as the
// colour structure, because a single-ink reef read as wallpaper in Coral.
//
// Geometry: the wall is a log-polar map. A screen point at radius r and angle
// a reads the simulation at (a / 2pi, K ln r - z), with K = cells / 2pi so the
// cells are square everywhere (the map is conformal). Flight is just z
// increasing: every ring of the wall grows outward exponentially, like
// Mandala's feedback zoom, but the wall is a real persistent surface, so the
// reef keeps its shape as it approaches and keeps growing on the way. The sim
// wraps in both directions; rows that leave past the corners are re-inked
// while hidden, and come back in at the vanishing point.
//
// Passes (WebGL2, all at sim resolution except the last):
//   stamp   kick rings (a crater band with a dotted seed line), regime map
//           (a drifting feed/kill field plus per-row snare offsets), the
//           running average used to tell growth from recession;
//   step    N Gray-Scott steps (Coral's regime path);
//   prep    gradient + a cast shadow toward the light;
//   display full resolution: B-spline upscale, fwidth threshold, matte
//           Lambert relief lit from the tunnel's far opening, per-row ink,
//           daylight fog at the vanishing point, and a layer of drifting
//           marine-snow motes on a faster parallax.
//
// The music:
//   kick  -> one ring is born at the vanishing point: a crater band that
//            blooms shut in pale fresh tissue and a new ink, then flies out.
//            Confined to a thin annulus near the centre at birth.
//   snare -> one ring at mid-radius is re-inked in the palette's accent and
//            its regime is pushed toward dividing spots, so it visibly turns
//            to beads and slowly heals.
//   bass  -> flight speed (continuous; the music never jerks the camera).
//   hats  -> the marine-snow motes twinkle.
//   drop  -> faster flight, a frenzied growth rate, spiral twist, full ink
//            colour, more relief and more motes; each new drop and breakdown
//            moves the quiet base ink to a new one, so minute five differs.

(function () {
  const TAU = Math.PI * 2;
  const NA = 512;                 // cells around the tunnel
  const NH = 448;                 // cells along it (wraps; ~200 are on screen)
  // Rows per unit of ln r. NA / TAU would make the cells square (a conformal
  // map); 0.55 of that stretches the reef along the flight, so tissue streams
  // past in braids. Square cells read as a flat reef with a hole in it.
  const K = 0.55 * NA / TAU;
  const R_BIRTH = 58;             // virtual units: where a kick ring is born
  const R_SNARE = 150;            // where the snare re-inks a ring
  const LN_HIDE = Math.log(700);  // rows beyond this radius are off stage
  const LN_MIN = Math.log(2);

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  // Stamp: kick crater + seeds, regime map, running average. uv.x is the
  // angle, uv.y the row; integer frequencies keep the map seamless on the
  // torus.
  const STAMP = `#version 300 es
precision highp float;
uniform sampler2D sim;
uniform sampler2D rows;     // per row: rgb ink, a regime offset
uniform vec2 size;
uniform float pattern;
uniform float spread;
uniform float mapT;
uniform float zRate;
uniform vec4 ring;          // centre row, half width (rows), strength, seed phase
out vec4 o;
const float TAU = 6.2831853;
float hash1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
float regionMap(vec2 uv, float t) {
  float m = 0.55 * sin(TAU * (2.0 * uv.x + uv.y) + 1.4 * sin(TAU * (3.0 * uv.x - uv.y) + t * 0.61) + t * 0.37)
          + 0.45 * sin(TAU * (uv.y * 2.0 - 3.0 * uv.x) + 1.2 * sin(TAU * (uv.x + 2.0 * uv.y) + t * 0.43) - t * 0.29)
          + 0.25 * sin(TAU * (5.0 * uv.x + 3.0 * uv.y) + 0.9 * sin(TAU * (uv.x - 2.0 * uv.y) - t * 0.5) + t * 0.21);
  return m / 1.25;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(sim, c, 0);
  vec2 uv = gl_FragCoord.xy / size;
  if (ring.z > 0.0) {
    float d = gl_FragCoord.y - ring.x;
    d -= size.y * floor(d / size.y + 0.5);
    float ad = abs(d);
    // Clear a band to bare substrate, then a dotted seed line in the middle:
    // the beat is a dark ring that blooms shut, not a flash.
    float crater = (1.0 - smoothstep(ring.y * 0.7, ring.y, ad)) * ring.z;
    s.xy = mix(s.xy, vec2(1.0, 0.0), crater);
    float bead = step(0.45, hash1(floor(gl_FragCoord.x / 3.0) + ring.w));
    float seed = (1.0 - smoothstep(0.8, 1.8, ad)) * bead * ring.z;
    s.xy = mix(s.xy, vec2(0.25, 0.5), seed);
  }
  float off = texelFetch(rows, ivec2(0, c.y), 0).a;
  s.z += (s.y - s.z) * zRate;
  s.w = clamp(pattern + spread * regionMap(uv, mapT) + off, 0.0, 1.0);
  o = s;
}`;

  // Coral's Gray-Scott step and regime path (0 dying, 1/4 spots, 1/2
  // labyrinth, 3/4 branching coral, 1 labyrinth again).
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

  // Prep: v, gradient (x = around, y = outward), cast shadow sampled toward
  // the light (which comes from the far opening, so "toward" is inward: -y).
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
  ivec2 k = c + ivec2(1, -2);
  float sh = (v(k) * 2.0 + v(k + ivec2(-2, -1)) + v(k + ivec2(2, -1)) + v(k + ivec2(0, -2)) + v(k + ivec2(1, 1))) / 6.0;
  o0 = vec4(s.y, gx, gy, sh);
  o1 = vec4(s.y - s.z, s.w, 0.0, 1.0);
}`;

  const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D prepA;
uniform sampler2D prepB;
uniform sampler2D rows;
uniform vec2 simSize;
uniform vec2 res;
uniform float unitPx;
uniform vec2 centre;       // vanishing point offset, virtual units
uniform float z;           // flight, rows
uniform float twist;       // radians per unit ln r
uniform float spin;        // radians
uniform float relief;
uniform float fogR;
uniform vec3 cGround, cFog, cFresh, cGhost, cMote, cAccent;
uniform float moteOn;      // layer strength
uniform float hat;
uniform float zm;          // motes' own flight, rows of the mote grid
uniform float time;
uniform float K;
out vec4 o;
const float TAU = 6.2831853;
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
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
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx - centre;
  float r = max(length(p), 0.5);
  float lr = log(r);
  float a = atan(p.y, p.x);
  float ang = a + twist * lr + spin;
  float row = K * lr - z;
  vec2 uv = vec2(ang / TAU, row / simSize.y);
  // The atan seam: fract keeps uv.x continuous for fwidth except on one
  // line, where the tissue threshold would otherwise widen to a visible
  // stitch.
  uv.x = fract(uv.x);

  vec4 A = bicubic(prepA, uv, simSize);
  vec4 B = texture(prepB, uv);
  vec4 ink = texture(rows, vec2(0.25, uv.y));
  float inv = texture(rows, vec2(0.75, uv.y)).r;
  float v = A.x;

  const float T = 0.17;
  float w = clamp(fwidth(v), 1e-4, 0.2);
  float mask = smoothstep(T - w, T + w, v);

  const float H0 = 0.12, H1 = 0.36;
  float t = clamp((v - H0) / (H1 - H0), 0.0, 1.0);
  float H = t * t * (3.0 - 2.0 * t);
  vec2 dH = (6.0 * t * (1.0 - t) / (H1 - H0)) * A.yz;
  // Normal and light in the wall's own (around, outward) frame: the light
  // comes from the far opening, so ridges facing the centre are lit all the
  // way round, and the relief reads the same at every angle.
  vec3 N = normalize(vec3(-dH * relief * 2.4, 1.0));
  vec3 L = normalize(vec3(0.3, -0.7, 0.65));
  float diff = max(dot(N, L), 0.0);

  float grow = clamp(B.x * 7.0, 0.0, 1.0);
  float recede = clamp(-B.x * 7.0, 0.0, 1.0);

  vec3 deep = ink.rgb * 0.28 + cGround * 0.25;
  vec3 tissue = mix(deep, ink.rgb, H) * (0.52 + 0.66 * diff);
  tissue = mix(tissue, cFresh * (0.65 + 0.45 * diff), grow * 0.45);

  vec3 ground = cGround;
  ground *= 1.0 - 0.55 * smoothstep(0.1, 0.3, A.w);
  ground += cGhost * recede * 0.7;

  vec3 col = mix(ground, tissue, mask);
  vec3 neg = mix(cAccent * (0.8 + 0.25 * (1.0 - A.w)), cGround * (0.7 + 0.5 * diff), mask);
  // A hard switch, not a fade: fading a negative passes through grey. The
  // band narrows from its edges instead, as each row's mark decays.
  col = mix(col, neg, smoothstep(0.42, 0.5, inv));

  // Distance shading: the near wall sits in the tunnel's shade, the far wall
  // in the light of the opening. Matte, no bloom: the opening is a flat
  // daylight colour, not a glow.
  col *= mix(1.08, 0.62, smoothstep(120.0, 620.0, r));
  float fog = 1.0 - smoothstep(fogR * 0.12, fogR, r);
  col = mix(col, cFog, fog * fog * (3.0 - 2.0 * fog));

  // Marine snow on a faster grid: parallax says we are moving.
  if (moteOn > 0.01) {
    float Nm = 44.0;
    vec2 g = vec2(fract((a + spin * 0.6) / TAU) * Nm, Nm / TAU * lr - zm);
    vec2 cell = floor(g);
    cell.x = mod(cell.x, Nm);
    float h = hash(cell + 17.0);
    vec2 sp = floor(g) + 0.25 + 0.5 * vec2(hash(cell + 3.1), hash(cell + 7.7));
    vec2 dv = g - sp;
    float rad = 0.05 + 0.05 * hash(cell + 11.3);
    float dd = length(dv);
    float px = fwidth(g.y) * 0.8;
    float disc = 1.0 - smoothstep(rad - px, rad + px, dd);
    float tw = 0.5 + 0.5 * sin(time * (5.0 + 7.0 * h) + h * 40.0);
    float on = step(0.55, h) * moteOn * (0.45 + 0.75 * hat * tw) * smoothstep(40.0, 110.0, r);
    col = mix(col, cMote, clamp(disc * on, 0.0, 1.0));
  }

  vec2 vc = gl_FragCoord.xy / res - 0.5;
  col *= 1.0 - 0.3 * dot(vc, vc);
  col = sqrt(max(col, 0.0));
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

  // Palettes (sRGB): ground, fog (the far opening), fresh growth, ghost of
  // receding tissue, motes, accent (snare), then the inks.
  // Each section (a drop, a breakdown) takes the next chord: the quiet ink
  // of the bare wall, then the two inks the kick rings alternate.
  const PALETTES = [
    { name: 'Delaunay', ground: '#16202b', fog: '#eadfc6', fresh: '#fbf1dc', ghost: '#3d5a78', mote: '#f4ecdb', accent: '#f3ead6',
      inks: ['#d8432c', '#e9a93b', '#4a80cf', '#3f8d68', '#d77b98', '#e8dcc2'],
      chords: [[0, 1, 5], [5, 0, 2], [4, 5, 1], [1, 2, 0], [5, 3, 1], [0, 5, 2]] },
    { name: 'Reef', ground: '#0b1a21', fog: '#a9d8d0', fresh: '#ffe0c8', ghost: '#1d7a80', mote: '#e8fff8', accent: '#56c7bf',
      inks: ['#ef7458', '#f4a27c', '#c9504a', '#f3c49c', '#e46f80'],
      chords: [[0, 3, 2], [1, 4, 0], [3, 0, 2], [4, 1, 3]] },
    { name: 'Bone', ground: '#131417', fog: '#d9d3c5', fresh: '#fff8e8', ghost: '#50667a', mote: '#ffffff', accent: '#8aa3b8',
      inks: ['#dcd2bf', '#bdb3a0', '#ece3cf', '#a69c89'],
      chords: [[0, 2, 3], [1, 2, 0], [3, 0, 2]] },
    { name: 'Riso', ground: '#efe7d4', fog: '#f7f1e3', fresh: '#fffaf0', ghost: '#b9b0d8', mote: '#2b2a33', accent: '#1f1d2b',
      inks: ['#ff4f86', '#3a5bd9', '#ffc93c', '#00a19f', '#ff7a3d'],
      chords: [[1, 0, 2], [3, 4, 1], [0, 2, 3], [4, 1, 3]] },
  ];
  const lin = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2);
  const LIN = PALETTES.map((P) => ({
    ground: lin(P.ground), fog: lin(P.fog), fresh: lin(P.fresh), ghost: lin(P.ghost),
    mote: lin(P.mote), accent: lin(P.accent), inks: P.inks.map(lin), chords: P.chords,
  }));

  const PRESETS = {
    calm: { speed: 0.45, growth: 0.8, pattern: 0.5, twist: 0.12, colour: 0.45, relief: 1.0, snow: 0.35 },
    drop: { speed: 1.4, growth: 1.7, pattern: 0.72, twist: 0.4, colour: 1, relief: 1.35, snow: 1 },
    // Bone and slow: the reef as carved ivory, for a breakdown or 5 a.m.
    ivory: { speed: 0.3, growth: 0.6, pattern: 0.45, twist: 0.05, colour: 0.3, relief: 1.5, snow: 0.2, palette: 2 },
    // A hard spiral on paper: the drop printed in riso inks.
    vortex: { speed: 1.3, growth: 1.5, pattern: 0.3, twist: 1.1, colour: 1, relief: 1.1, snow: 0.8, palette: 3 },
  };
  const DRIVE = ['speed', 'growth', 'pattern', 'twist', 'colour', 'relief', 'snow'];

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mod = (a, n) => ((a % n) + n) % n;

  VIZ.register({
    id: 'materialtunnel',
    name: 'Material Tunnel',
    order: 809,

    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'growth', label: 'Growth rate', type: 'range', min: 0.2, max: 2, default: PRESETS.calm.growth, step: 0.01 },
      { key: 'pattern', label: 'Spots to maze to coral', type: 'range', min: 0.15, max: 0.9, default: PRESETS.calm.pattern, step: 0.01 },
      { key: 'twist', label: 'Spiral twist', type: 'range', min: -1.5, max: 1.5, default: PRESETS.calm.twist, step: 0.01 },
      { key: 'colour', label: 'Ring colour', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'relief', label: 'Relief', type: 'range', min: 0, max: 2, default: PRESETS.calm.relief, step: 0.01 },
      { key: 'snow', label: 'Marine snow', type: 'range', min: 0, max: 1, default: PRESETS.calm.snow, step: 0.01 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((P) => P.name), default: 0 },
      { key: 'music', label: 'Reaction', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Material Tunnel',
      technique: 'WebGL2 Gray-Scott reaction–diffusion on a wrapping float texture read through a conformal log-polar map, so flight is a scroll of the map and the wall is a persistent, growing surface; kick rings stamped into the sim as crater bands; per-row ink texture; B-spline upscale, fwidth threshold and matte Lambert relief lit from the far opening; a parallax layer of marine snow; a section follower easing between calm and drop presets',
      brief: 'A flight down a tunnel whose walls are living coral, lit matte from the daylight at its far end. Every kick lays a new ring at the vanishing point, a band cleared to bare wall and seeded, which blooms shut in pale new tissue and a fresh Delaunay ink while the flight carries it outward, so the walls become concentric rings of colour with reef growing through them. The snare re-inks one ring at mid-radius in the accent and turns it to beads; bass sets the flight speed; hats twinkle the marine snow drifting past on a faster plane. The drop speeds the flight, sends the growth into a frenzy, twists the tunnel into a spiral and brings full colour; each new section picks a new quiet ink.',
      lineage: [
        'Batch 06, idea 9 (Psychonaut): Material tunnels, Mandala crossed with Coral, Current and Orphism; walls of reaction-diffusion reef, curl-noise smoke or matte Delaunay discs, no glow; the kick seeds a ring at the vanishing point; bass sets flight speed.',
        'Chose the reef, fused with the Delaunay tunnel: the reef is the only option that is a process you fly through (the Psychonaut: "a simulation you fly through"), and the kick rings carry Orphism\'s flat concentric inks, so colour has structure instead of a single-ink wallpaper.',
        'Coral (web/scenes/coral.js): the Gray-Scott step, regime path, growth/recession channel, B-spline display and relief lighting, re-lit from the tunnel\'s opening and without the specular sheen.',
        'Mandala (web/scenes/mandala.js): each beat\'s ring born at the centre and watched as it flies outward; here it is a surface that persists and grows rather than a fading echo.',
        'Distinct from Stargate (slit-scan walls, light on black) and Thresholds (engraved doors): matte material, daylight at the end, and the wall itself alive.',
        'Render notes: square (conformal) cells read as a flat reef with a hole in it, so the map is stretched 1.8x along the flight and the reef streams past in braids. Every-ink rings read as confetti, and blending ring inks toward the base made mud, so each section takes a three-ink chord, rings run a bar of first ink, quiet ink, second ink, quiet ink, and Ring colour is the chance a ring is inked at all.',
        'The snare first re-inked a ring in cream and, over a snare roll, painted half the tunnel; it now prints one ring in negative that narrows from its edges and heals, at a varying radius. Jolt: calm (the drop\'s kick is a thin annulus near the centre; the rest of the change is the flight itself).',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.z = 0;
      this.zm = 0;
      this.spin = 0;
      this.mapT = Math.random() * 50;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kick: 0, cf: 0, cs: 0, clap: 0, level: 0, bass: 0, hat: 0,
        low: 0, dropOn: false, auto: 0, kArmed: true, cArmed: true, lastK: -9, lastC: -9 };
      this.section = 0;         // which chord of the palette
      this.nextInk = 0;
      this.ringSeed = 0;
      this.prevRing = -1;
      this.rowInk = new Int8Array(NH).fill(-1);   // -1 base, >= 0 ink, 99 accent
      this.rowBase = new Int8Array(NH);            // the chord a row was inked under
      this.rowInv = new Float32Array(NH);          // snare: printed in negative
      this.rowOff = new Float32Array(NH);          // regime offset (snare)
      this.rowData = new Float32Array(NH * 8);   // two texels a row
      this.needSeed = true;
      this.pendingRing = null;
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
      if (!gl) { this.glFailed = 'WebGL2 unavailable'; return; }
      const f32 = gl.getExtension('EXT_color_buffer_float');
      const f16 = f32 || gl.getExtension('EXT_color_buffer_half_float');
      if (!f16) { this.glFailed = 'no float render targets'; return; }
      this.simFormat = f32 ? gl.RGBA32F : gl.RGBA16F;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('materialtunnel shader: ' + gl.getShaderInfoLog(s));
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const program = (src, uniforms) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, src));
        gl.bindAttribLocation(prog, 0, 'pos');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('materialtunnel link: ' + gl.getProgramInfoLog(prog));
        const u = {};
        for (const n of uniforms) u[n] = gl.getUniformLocation(prog, n);
        return { prog, u };
      };
      this.pStamp = program(STAMP, ['sim', 'rows', 'size', 'pattern', 'spread', 'mapT', 'zRate', 'ring']);
      this.pStep = program(STEP, ['sim', 'size']);
      this.pPrep = program(PREP, ['sim', 'size']);
      this.pDisplay = program(DISPLAY, ['prepA', 'prepB', 'rows', 'simSize', 'res', 'unitPx', 'centre', 'z', 'twist', 'spin',
        'relief', 'fogR', 'cGround', 'cFog', 'cFresh', 'cGhost', 'cMote', 'cAccent', 'moteOn', 'hat', 'zm', 'time', 'K']);

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const tex = (w, h, fmt, filter, data) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return t;
      };
      const fbo = (texs) => {
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('materialtunnel: framebuffer incomplete');
        return f;
      };
      this.tex = tex;
      this.simTex = [0, 1].map(() => tex(NA, NH, this.simFormat, gl.NEAREST));
      this.simFb = this.simTex.map((t) => fbo([t]));
      this.prepTex = [0, 1].map(() => tex(NA, NH, gl.RGBA16F, gl.LINEAR));
      this.prepFb = fbo(this.prepTex);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.rowTex = tex(2, NH, gl.RGBA16F, gl.LINEAR);
      this.cur = 0;
      this.gl = gl;
      this.glCanvas = c;
    },

    // A dense scatter of seeds so the walls are reef within a few seconds.
    seed() {
      const gl = this.gl;
      const data = new Float32Array(NA * NH * 4);
      for (let i = 0; i < NA * NH; i++) { data[i * 4] = 1; data[i * 4 + 3] = 0.5; }
      const n = Math.round((NA * NH) / 260);
      for (let k = 0; k < n; k++) {
        const cx = Math.floor(Math.random() * NA), cy = Math.floor(Math.random() * NH);
        const r = 1.5 + Math.random() * 2.5, R = Math.ceil(r);
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const j = (mod(cy + dy, NH) * NA + mod(cx + dx, NA)) * 4;
            data[j] = 0.25; data[j + 1] = 0.5 + 0.1 * Math.random();
          }
        }
      }
      for (const t of this.simTex) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.simFormat, NA, NH, 0, gl.RGBA, gl.FLOAT, data);
      }
      this.cur = 0;
    },

    listen(signals, dt, t) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp((e.kf - e.ks) * 2.2, 0, 1);
      e.kick = ease(e.kick, kOn, kOn > e.kick ? 30 : 7, dt);
      const cl = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp((e.cf - e.cs) * 3, 0, 1);
      e.level = ease(e.level, (signals[0] + signals[1] + signals[2] + signals[3]) / 400, 2, dt);
      e.bass = ease(e.bass, (signals[0] + signals[1] + signals[2]) / 300, 1.2, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 8, dt);
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; this.newSection(); }
      else if (e.dropOn && e.low < 19) { e.dropOn = false; this.newSection(); }
      // Discrete onsets with hysteresis and a refractory gap.
      let kick = false, snare = false;
      if (e.kArmed && kOn > 0.3 && t - e.lastK > 0.2) { kick = true; e.kArmed = false; e.lastK = t; }
      else if (!e.kArmed && kOn < 0.12) e.kArmed = true;
      if (e.cArmed && cOn > 0.3 && t - e.lastC > 0.8) { snare = true; e.cArmed = false; e.lastC = t; }
      else if (!e.cArmed && cOn < 0.1) e.cArmed = true;
      return { kick, snare };
    },

    // A new drop or breakdown moves the quiet ink on, so sections differ.
    newSection() {
      this.section += 1;
    },

    // Where a row currently sits, as ln r, choosing the image of the wrapped
    // row that lies in [LN_MIN, LN_MIN + NH / K).
    rowLn(i) {
      return LN_MIN + mod(i + this.z - K * LN_MIN, NH) / K;
    },

    draw(p, signals, params, ctx) {
      const dc = p.drawingContext;
      dc.globalAlpha = 1;
      dc.globalCompositeOperation = 'source-over';
      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (err) { this.glFailed = err.message; console.warn(err); }
      }
      if (!this.gl) {
        p.colorMode(p.RGB, 255);
        p.background(21, 32, 44);
        p.noStroke();
        p.fill(234, 223, 198);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(18);
        p.text('Material Tunnel needs WebGL2 with float render targets (' + this.glFailed + ')', ctx.width / 2, ctx.height / 2);
        return;
      }
      if (this.env === undefined) this.enter();
      const gl = this.gl;

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const t = this.clock;
      const hits = this.listen(signals, dt, t);
      const e = this.env;
      const depth = params.music;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const pal = LIN[Math.round(params.palette) % LIN.length];

      // Flight: ln r per second. Bass swells it; it only ever eases.
      const vLn = P.speed * (0.12 + 0.22 * clamp(e.bass * depth, 0, 1.5));
      this.z += dt * K * vLn;
      this.zm += dt * 44 / TAU * vLn * 1.9;
      this.spin += dt * P.twist * 0.22;
      this.mapT += dt * 0.03;

      // Rows: re-ink those hidden past the corners so they come back in at
      // the vanishing point as plain wall, and let snare marks heal.
      const heal = Math.exp(-dt / 2.5);
      const unink = Math.exp(-dt / 1.6);
      for (let i = 0; i < NH; i++) {
        if (this.rowLn(i) > LN_HIDE) { this.rowInk[i] = -1; this.rowBase[i] = this.section; this.rowOff[i] = 0; this.rowInv[i] = 0; }
        this.rowOff[i] *= heal;
        // Snap off below the display's threshold: a row decaying through it
        // drew a faint hairline circle.
        this.rowInv[i] = this.rowInv[i] * unink < 0.5 ? 0 : this.rowInv[i] * unink;
      }
      const rowAt = (r) => mod(Math.round(K * Math.log(r) - this.z), NH);

      let ring = [0, 0, 0, 0];
      if (hits.kick && depth > 0.02) {
        const c = rowAt(R_BIRTH);
        const hw = 3;
        // Two ring inks per section over the quiet base: a three-ink chord
        // (every ink in turn read as confetti). Ring colour
        // is the chance a ring is inked at all, decided at birth: blending
        // inks toward the base by a fraction made mud.
        // A bar of rings: first ink, quiet ink, second ink, quiet ink.
        let ink = -1;
        const chord = pal.chords[this.section % pal.chords.length];
        this.nextInk = (this.nextInk + 1) % 4;
        if (Math.random() < P.colour) ink = chord[[1, 0, 2, 0][this.nextInk]];
        for (let d = -hw; d <= hw; d++) {
          const i = mod(c + d, NH);
          this.rowInk[i] = ink;
          this.rowBase[i] = this.section;
        }
        // The wall between this ring and the last takes this section's quiet
        // ink, so a drop's own ground shows between its rings at once.
        const gap = mod(this.prevRing - c, NH);
        if (this.prevRing >= 0 && gap < 80) {
          for (let d = hw + 1; d < gap - hw; d++) {
            const i = mod(c + d, NH);
            this.rowInk[i] = -1;
            this.rowBase[i] = this.section;
          }
        }
        this.prevRing = c;
        this.ringSeed += 13.7;
        ring = [c + 0.5, hw, clamp(depth, 0, 1), this.ringSeed];
      }
      // The snare prints one ring in negative (ground in the accent, tissue
      // in the ground's dark) and pushes it toward beads; both fade as it
      // flies out.
      if (hits.snare && depth > 0.02) {
        const c = rowAt(R_SNARE * (0.75 + 0.5 * Math.random()));
        const hw = 4;
        for (let d = -hw; d <= hw; d++) {
          const i = mod(c + d, NH);
          const edge = 1 - Math.abs(d) / (hw + 1);
          this.rowInv[i] = Math.max(this.rowInv[i], clamp(depth, 0, 1) * (0.6 + 0.6 * edge));
          this.rowOff[i] = -0.28 * clamp(depth, 0, 1.2);
        }
      }

      for (let i = 0; i < NH; i++) {
        const k = this.rowInk[i];
        // A new section's quiet ink enters from the vanishing point with the
        // rows re-inked off stage, rather than cutting the whole wall over.
        const col = k >= 0 ? pal.inks[k % pal.inks.length] : pal.inks[pal.chords[this.rowBase[i] % pal.chords.length][0]];
        const j = i * 8;
        this.rowData[j] = col[0];
        this.rowData[j + 1] = col[1];
        this.rowData[j + 2] = col[2];
        this.rowData[j + 3] = this.rowOff[i];
        this.rowData[j + 4] = this.rowInv[i];
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.rowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 2, NH, 0, gl.RGBA, gl.FLOAT, this.rowData);

      if (this.needSeed) { this.seed(); this.needSeed = false; }

      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.vao);
      gl.viewport(0, 0, NA, NH);

      // Stamp.
      const S = this.pStamp;
      gl.useProgram(S.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFb[1 - this.cur]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.simTex[this.cur]);
      gl.uniform1i(S.u.sim, 0);
      gl.uniform1i(S.u.rows, 1);
      gl.uniform2f(S.u.size, NA, NH);
      gl.uniform1f(S.u.pattern, P.pattern);
      gl.uniform1f(S.u.spread, 0.32);
      gl.uniform1f(S.u.mapT, this.mapT);
      gl.uniform1f(S.u.zRate, 2 * dt);
      gl.uniform4f(S.u.ring, ring[0], ring[1], ring[2], ring[3]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.cur = 1 - this.cur;

      // Growth: the drop is a frenzy of fronts.
      const iters = clamp(Math.round(P.growth * (5 + 7 * clamp(e.level * depth, 0, 1))), 1, 18) + (this.warm === undefined ? 40 : 0);
      this.warm = true;
      gl.useProgram(this.pStep.prog);
      gl.uniform1i(this.pStep.u.sim, 0);
      gl.uniform2f(this.pStep.u.size, NA, NH);
      for (let i = 0; i < iters; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFb[1 - this.cur]);
        gl.bindTexture(gl.TEXTURE_2D, this.simTex[this.cur]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.cur = 1 - this.cur;
      }

      gl.useProgram(this.pPrep.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.prepFb);
      gl.bindTexture(gl.TEXTURE_2D, this.simTex[this.cur]);
      gl.uniform1i(this.pPrep.u.sim, 0);
      gl.uniform2f(this.pPrep.u.size, NA, NH);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Display.
      const W = Math.round(p.width * p.pixelDensity());
      const Hh = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== W || this.glCanvas.height !== Hh) { this.glCanvas.width = W; this.glCanvas.height = Hh; }
      const D = this.pDisplay;
      gl.useProgram(D.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, Hh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.prepTex[0]);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.prepTex[1]);
      gl.uniform1i(D.u.prepA, 0);
      gl.uniform1i(D.u.rows, 1);
      gl.uniform1i(D.u.prepB, 2);
      gl.uniform2f(D.u.simSize, NA, NH);
      gl.uniform2f(D.u.res, W, Hh);
      gl.uniform1f(D.u.unitPx, W / ctx.width);
      // The vanishing point wanders a little, so the flight feels steered.
      const cx = 34 * Math.sin(t * 0.071 + 1.3) + 14 * Math.sin(t * 0.163);
      const cy = 22 * Math.sin(t * 0.093 + 0.4);
      gl.uniform2f(D.u.centre, cx, -cy);
      gl.uniform1f(D.u.z, this.z);
      gl.uniform1f(D.u.twist, P.twist);
      gl.uniform1f(D.u.spin, this.spin);
      gl.uniform1f(D.u.relief, P.relief);
      gl.uniform1f(D.u.fogR, 70);
      gl.uniform3fv(D.u.cGround, pal.ground);
      gl.uniform3fv(D.u.cFog, pal.fog);
      gl.uniform3fv(D.u.cFresh, pal.fresh);
      gl.uniform3fv(D.u.cGhost, pal.ghost);
      gl.uniform3fv(D.u.cMote, pal.mote);
      gl.uniform3fv(D.u.cAccent, pal.accent);
      gl.uniform1f(D.u.moteOn, P.snow);
      gl.uniform1f(D.u.hat, clamp(e.hat * 1.6 * depth, 0, 1));
      gl.uniform1f(D.u.zm, this.zm);
      gl.uniform1f(D.u.time, t);
      gl.uniform1f(D.u.K, K);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0);

      dc.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
