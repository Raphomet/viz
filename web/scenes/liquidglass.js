// Liquid Glass: a bold printed poster seen through thick, moving glass.
//
// The poster underneath is flat and graphic: a paper ground, a big accent
// disc, two lines of giant condensed type running as slow marquees in
// opposite directions, and small captions between hairline rules. Over it lie
// lozenges of clear glass (pills, lenses, a capsule) that drift and meet like
// drops of liquid, their outlines welded by a smooth minimum so two pieces
// that touch neck together and part again. Each one refracts the print below
// it through its own bevel: a full dome magnifies like a drop of water on a
// page, a flat-topped slab only bends the type at its rim. Rims carry a white
// highlight on the side facing the light, a fainter internal reflection on
// the far side, and a little chromatic dispersion; each piece casts a soft
// shadow on the paper with a caustic where the glass focuses light.
//
// Music, each in its own place:
//   kick   a droplet of glass lands beside one lozenge and is pulled into
//          it; the lozenge wobbles as it absorbs the drop
//   clap   a band of light sweeps across every rim, and one lozenge turns to
//          tinted glass, the next one on the next clap
//   bass   the glass thickens: stronger refraction, fatter lozenges
//   hats   glints on the rims
//   drop   three more pieces pour in, a word in solid glass grows out of
//          nothing over the type, a second ink disc overprints, the marquees
//          speed up and a new headline is set; the breakdown pools the glass
//          back together in the middle and melts the word away
//
// WebGL2 fragment shader: the poster is evaluated procedurally (disc, rules)
// plus Canvas 2D type uploaded as textures, so every refracted sample stays
// sharp; the glass is a signed distance field (rounded boxes, circles and a
// blurred-mask field for the word) combined by smooth minimum.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => u * u * (3 - 2 * u);

  const NS = 8;   // lozenge slots
  const NB = 6;   // droplet slots

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;
uniform float unitPx;
uniform vec2  stage;
uniform vec3  ground, ink, acc1, acc2, glassTint;
uniform vec4  disc1, disc2;           // x, y, r, amount
uniform sampler2D stripA, stripB, caps, word;
uniform vec4  layA, layB;             // period line 1, period line 2, texture width (units)
uniform float stripMix;
uniform vec4  lines;                  // y0 line 1, y0 line 2, scroll 1, scroll 2
uniform float lineH;
uniform vec4  wordXf;                 // x, y, angle, appear
uniform vec4  wordGeo;                // w, h (units), distance range R, wobble
uniform float wtime;
uniform vec4  shA[${NS}];             // cx, cy, hx, hy
uniform vec4  shB[${NS}];             // corner, angle, scale, bevel
uniform float shT[${NS}];             // tint
uniform vec4  beads[${NB}];           // x, y, r, -
uniform float smk, wk, refr, disp;
uniform vec3  sweep;                  // position along the diagonal, amount, width
uniform vec2  hat;                    // amount, seed
uniform vec3  shadow;                 // offset x, y, amount
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float sdRB(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float dShape(int i, vec2 p) {
  vec4 a = shA[i]; vec4 b = shB[i];
  if (b.z < 0.01) return 1e4;
  vec2 d = p - a.xy;
  float c = cos(b.y), s = sin(b.y);
  vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  vec2 hb = a.zw * b.z;
  return sdRB(q, hb, min(b.x * b.z, min(hb.x, hb.y)));
}
float dBead(int i, vec2 p) {
  vec4 b = beads[i];
  if (b.z < 0.5) return 1e4;
  return length(p - b.xy) - b.z;
}
// The word is a signed distance texture (exact, from a CPU distance
// transform of the set type), encoded over +-R.
float dWord(vec2 p) {
  if (wordXf.w < 0.01) return 1e4;
  vec2 d = p - wordXf.xy;
  float c = cos(wordXf.z), s = sin(wordXf.z);
  vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  q += wordGeo.w * vec2(sin(q.y * 0.021 + wtime * 1.1), sin(q.x * 0.013 + wtime * 0.8));
  vec2 uv = q / wordGeo.xy + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1e4;
  float m = textureLod(word, uv, 0.0).r;
  return (0.5 - m) * 2.0 * wordGeo.z + (1.0 - wordXf.w) * wordGeo.z;
}

// The word's field saturates at R outside its letters, so it joins the
// rest with a blend narrower than that, or everything would swell by it.
float field(vec2 p) {
  float d = 1e4;
  for (int i = 0; i < ${NS}; i++) d = smin(d, dShape(i, p), smk);
  for (int i = 0; i < ${NB}; i++) d = smin(d, dBead(i, p), smk);
  return smin(d, dWord(p), wk);
}

float fieldFull(vec2 p, out float bev, out float tint, out float frost) {
  float ds[${NS}]; float db[${NB}];
  float d = 1e4, dmin = 1e4;
  for (int i = 0; i < ${NS}; i++) { ds[i] = dShape(i, p); d = smin(d, ds[i], smk); dmin = min(dmin, ds[i]); }
  for (int i = 0; i < ${NB}; i++) { db[i] = dBead(i, p); d = smin(d, db[i], smk); dmin = min(dmin, db[i]); }
  float dw = dWord(p);
  d = smin(d, dw, wk); dmin = min(dmin, dw);
  // Bevel and tint blend by nearness, so a drop merging into a slab has no
  // seam where one's profile hands over to the other's.
  float fall = 0.3 * smk + 2.0;
  float ws = 0.0, bs = 0.0, ts = 0.0;
  for (int i = 0; i < ${NS}; i++) { float w = exp(-(ds[i] - dmin) / fall); ws += w; bs += w * shB[i].w; ts += w * shT[i]; }
  for (int i = 0; i < ${NB}; i++) { float w = exp(-(db[i] - dmin) / fall); ws += w; bs += w * beads[i].z; }
  float wW = exp(-(dw - dmin) / fall); ws += wW; bs += wW * wordGeo.z * 0.6;
  bev = bs / ws; tint = ts / ws; frost = wW / ws;
  return d;
}

float lineMask(sampler2D tex, vec4 lay, float li, vec2 q) {
  float y0 = li < 0.5 ? lines.x : lines.y;
  float v = (q.y - y0) / lineH;
  if (v < 0.0 || v > 1.0) return 0.0;
  float P = li < 0.5 ? lay.x : lay.y;
  float sc = li < 0.5 ? lines.z : -lines.w;
  float u = fract((q.x + sc) / P) * P / lay.z;
  return textureLod(tex, vec2(u, (v + li) * 0.5), 0.0).r;
}

vec3 poster(vec2 q, float aa) {
  vec3 c = ground;
  float a1 = (1.0 - smoothstep(-aa, aa, length(q - disc1.xy) - disc1.z)) * disc1.w;
  c = mix(c, acc1, a1);
  float a2 = (1.0 - smoothstep(-aa, aa, length(q - disc2.xy) - disc2.z)) * disc2.w;
  // Overprint: where the second ink crosses the first it prints darker.
  c = mix(c, mix(acc2, acc2 * acc1 * 1.15, a1), a2);
  float li = q.y < lines.y ? 0.0 : 1.0;
  float m = 0.0;
  if (stripMix < 0.999) m = lineMask(stripA, layA, li, q) * (1.0 - stripMix);
  if (stripMix > 0.001) m += lineMask(stripB, layB, li, q) * stripMix;
  c = mix(c, ink, clamp(m, 0.0, 1.0) * 0.97);
  float cm = textureLod(caps, q / stage, 0.0).r;
  return mix(c, ink, cm);
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 p = fc / unitPx;
  float px = 1.0 / unitPx;

  float bev, tint, frost;
  float d = fieldFull(p, bev, tint, frost);
  float e = max(0.6, px);
  vec2 grad = vec2(field(p + vec2(e, 0.0)) - d, field(p + vec2(0.0, e)) - d) / e;
  vec2 dir = grad / max(length(grad), 1e-4);          // outward
  float cov = clamp(0.5 - d * unitPx, 0.0, 1.0);

  // Rounded bevel: a quarter circle of radius bev from the rim inward.
  float x = clamp(-d / max(bev, 1.0), 0.0, 1.0);
  float slope = min((1.0 - x) / sqrt(max(x * (2.0 - x), 1e-4)), 2.4);
  vec3 n = normalize(vec3(dir * slope * 0.9, 1.0));
  vec2 off = -dir * slope * refr * bev * step(d, 1.0);
  float edge = smoothstep(0.5, 2.0, slope);
  vec2 qG = p + off;
  vec2 qR = p + off * (1.0 + disp * edge);
  vec2 qB = p + off * (1.0 - disp * edge);
  // Footprint of a refracted sample, so squeezed rims average instead of alias.
  float aaq = clamp(max(length(dFdx(qG)), length(dFdy(qG))), px, 6.0);

  vec3 col;
  vec3 base = poster(p, px);
  // Soft shadow of the glass on the paper, offset away from the light, with
  // a caustic just inside it where the glass focuses the light.
  float dS = field(p - shadow.xy);
  float soft = 16.0;
  float sh = 1.0 - smoothstep(-soft, soft * 1.5, dS);
  float contact = exp(-max(d, 0.0) / 4.0);
  float caus = exp(-pow((dS + 0.55 * soft) / (0.35 * soft), 2.0)) * step(0.0, d);
  base *= 1.0 - shadow.z * (0.32 * sh + 0.16 * contact);
  base += shadow.z * 0.16 * caus * (1.0 - sh * 0.5);
  col = base;

  if (cov > 0.0) {
    vec3 g = vec3(poster(qR, aaq).r, poster(qG, aaq).g, poster(qB, aaq).b);
    // Clear glass: a faint lift toward the tint, stronger where it curves.
    float curve = 1.0 - n.z;
    // The word is frosted a little, so its flat faces read over the type.
    g = mix(g, glassTint, 0.1 + 0.2 * curve + 0.3 * frost);
    // Tinted glass on the clap.
    g *= mix(vec3(1.0), acc2 * 0.85 + 0.15, clamp(tint, 0.0, 1.0) * 0.7);

    vec2 L2 = normalize(vec2(-0.6, -0.8));
    float f = dot(dir, L2);                     // + on the rim facing the light
    g *= 1.0 - 0.22 * curve * max(-f, 0.0);
    float hl = smoothstep(0.42, 0.62, curve) * pow(max(f, 0.0), 1.3);
    float hl2 = smoothstep(0.5, 0.64, curve) * pow(max(-f, 0.0), 2.0) * 0.5;
    vec3 Ld = normalize(vec3(-0.55, -0.75, 0.9));
    vec3 H = normalize(Ld + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, H), 0.0), 60.0) * 0.8;
    float s = p.x * 0.8 + p.y * 0.6;
    float glint = sweep.y * exp(-pow((s - sweep.x) / sweep.z, 2.0)) * (0.25 + 0.9 * curve);
    vec2 cell = floor(p / 6.0);
    float sp = step(hash(cell + hat.y), 0.05) * step(0.3, curve);
    float spark = hat.x * sp * (1.0 - smoothstep(0.6, 2.2, length(fract(p / 6.0) - 0.5) * 6.0));
    float light = clamp(hl * 0.9 + hl2 + spec + glint + spark, 0.0, 1.0);
    g = mix(g, vec3(1.0), light);
    col = mix(col, g, cov);
  }
  // The thinnest dark line at the very edge: glass on paper reads by it.
  float rimLine = exp(-pow(d * unitPx + 0.8, 2.0) / 1.2);
  col *= 1.0 - 0.14 * rimLine;

  float gr = hash(floor(fc)) * 0.6 + hash(floor(fc * 0.33)) * 0.4;
  col *= 1.0 - 0.035 * gr;
  outColor = vec4(col, 1.0);
}`;

  const INKS = [
    { name: 'Paper & tangerine', ground: '#EDE7DB', ink: '#161514', acc1: '#FF5A1F', acc2: '#2B4BD8', tint: '#FFFFFF' },
    { name: 'Cobalt', ground: '#2340C4', ink: '#F3EDE1', acc1: '#FF7B2E', acc2: '#F5C51C', tint: '#EEF2FF' },
    { name: 'Mint & red', ground: '#C3E4D2', ink: '#131313', acc1: '#EE4230', acc2: '#3A2DB0', tint: '#FFFFFF' },
    { name: 'Night', ground: '#121315', ink: '#ECE7DE', acc1: '#FF4B2B', acc2: '#7C9BFF', tint: '#DDE3EE' },
  ];
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

  const SETS = [
    { a: 'AFTER HOURS', b: 'LIQUID SOUND', g: 'FLOW' },
    { a: 'SLOW LIGHT', b: 'DEEP WATER', g: 'MELT' },
    { a: 'NIGHT SWIM', b: 'CLEAR SIGNAL', g: 'POUR' },
    { a: 'SOFT FOCUS', b: 'HEAVY BASS', g: 'DRIP' },
    { a: 'SURFACE', b: 'TENSION', g: 'LENS' },
  ];
  const TYPE_FONT = '"Anton", "Oswald", "Impact", sans-serif';
  const GLASS_FONT = '"Archivo Black", "Arial Black", sans-serif';
  const CAP_FONT = '"Josefin Sans", "Futura", sans-serif';
  const MONO_FONT = '"Space Mono", "Courier New", monospace';

  // Lozenges: home (fractions of the stage), wander amplitude and rates,
  // half size and corner (fractions of the short side; corner 1 = fully
  // round), bevel as a fraction of the smaller half size, tilt amplitude.
  // The last three only pour in for the drop.
  const SHAPES = [
    { x: 0.36, y: 0.56, ax: 0.16, ay: 0.13, f: [0.11, 0.16], ph: [0.0, 1.3], hx: 0.3, hy: 0.105, c: 1, bev: 0.75, rot: 0.12, drop: 0 },
    { x: 0.72, y: 0.34, ax: 0.12, ay: 0.14, f: [0.13, 0.09], ph: [2.0, 0.4], hx: 0.15, hy: 0.15, c: 1, bev: 1.0, rot: 0, drop: 0 },
    { x: 0.84, y: 0.7, ax: 0.07, ay: 0.12, f: [0.07, 0.12], ph: [4.0, 2.0], hx: 0.065, hy: 0.2, c: 1, bev: 1.0, rot: 0.35, drop: 0 },
    { x: 0.2, y: 0.24, ax: 0.1, ay: 0.08, f: [0.15, 0.1], ph: [1.0, 3.0], hx: 0.14, hy: 0.052, c: 1, bev: 1.0, rot: 0.25, drop: 0 },
    { x: 0.56, y: 0.2, ax: 0.22, ay: 0.07, f: [0.09, 0.17], ph: [3.0, 0.2], hx: 0.085, hy: 0.085, c: 1, bev: 1.0, rot: 0, drop: 1 },
    { x: 0.5, y: 0.83, ax: 0.2, ay: 0.05, f: [0.12, 0.14], ph: [5.0, 1.0], hx: 0.21, hy: 0.058, c: 1, bev: 1.0, rot: 0.1, drop: 2 },
    { x: 0.13, y: 0.64, ax: 0.07, ay: 0.14, f: [0.1, 0.13], ph: [0.5, 4.2], hx: 0.11, hy: 0.11, c: 0.05, bev: 0.45, rot: 0.3, drop: 3 },
  ];

  VIZ.register({
    id: 'liquidglass',
    name: 'Liquid Glass',
    order: 521,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'thickness', label: 'Glass thickness', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'liquid', label: 'Liquidity', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'flow', label: 'Flow speed', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'disp', label: 'Edge dispersion', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'glassWord', label: 'Glass word', type: 'select', options: ['In the drop', 'Always', 'Never'], default: 0 },
      { key: 'ink', label: 'Poster inks', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'words', label: 'Words (line / line / glass; blank cycles)', type: 'text', default: '' },
    ],

    actions: [
      { id: 'nexthead', label: 'Next headline', run() { this.wantSet = true; } },
    ],

    gallery: {
      title: 'Liquid Glass',
      technique: 'WebGL2 fragment shader. The poster is evaluated per sample (disc, overprinted second disc) with Canvas 2D type uploaded as textures: a two-line marquee strip wrapped at each line\'s own period, and full-frame captions and rules. The glass is a signed distance field of rounded boxes and droplet circles joined by a polynomial smooth minimum, plus an exact distance-transformed word (Felzenszwalb-Huttenlocher on the CPU, once per word). A quarter-circle bevel gives each pixel a slope; the poster is resampled along the field gradient by that slope (per-channel scale for dispersion only where the slope is steep), then lit with a light-side rim, a far-side internal reflection, a specular, a soft offset shadow and a caustic.',
      brief: 'The 2025 liquid-glass interface look made into a printed poster: flat paper, a tangerine disc, two lines of giant condensed type drifting as slow marquees, small captions between hairline rules, and over it thick clear lozenges that drift, neck together and part like mercury, magnifying and bending the type beneath them, with bright rims and real soft shadows. Each kick drops a bead of glass beside one lozenge; it is drawn in and the lozenge wobbles as it swallows it. Each clap sweeps a band of light over every rim and turns one lozenge to tinted glass. Bass thickens the glass; hats glint on the rims. The drop pours in three more pieces, the big pill melts into a frosted glass word over the type, a cobalt disc overprints the tangerine, the marquees quicken and a new headline is set. The breakdown drains the second ink, melts the word and pools the glass back together in the middle.',
      lineage: [
        'Batch 05 brief entry "21 · Liquid glass": the translucent, refracting interface material introduced in 2025, re-set as a Swiss-flavoured concert poster (giant condensed sans, one accent disc, hairline rules) so the glass has bold flat graphics to bend. No interface elements are copied: the glass forms are generic pills, lenses and a word. Technique descends from SDF rendering (Inigo Quilez\'s rounded box and smooth minimum) and screen-space refraction.',
        'Process. First render: the glass read well but full domes magnified the type so hard it became black-and-white cow patches, so refraction was roughly halved; the glass also got a slightly stronger white lift so it has a body on light paper. Jolt, first run: calm by ratio but kickArea 0.37, and heat.png showed the culprit was not the kick but the giant black type marquee moving several pixels per frame, plus glass drifting at over 100 units a second; both were slowed three to four times (area 0.18). The kick droplet was then enlarged so it shows as its own hot spot. The glass word was first a Gaussian-blurred mask used as a distance: the blur welded the letters and filled the counters, and the word read as one gooey blob sitting under the big pill; it became an exact distance transform set with open tracking, frosted slightly so its flat faces read over the type, and the big pill now pours itself into the word while it is up, and the other lozenges move outward to make room. Final jolt at 640x360: calm, kickArea 0.21, ratio 1.41, with the droplet and the clap\'s tinted lozenge as the local hot spots.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.prev) this.init(); },

    init() {
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.snareCount = 0; this.hatCount = 0;
      this.low = 0; this.drop = false; this.dropAmt = 0; this.energy = 0; this.bassSlow = 0;
      this.hatEnv = 0; this.hatSeed = 0;
      this.phase = 0; this.scroll1 = 0; this.scroll2 = 0; this.wt = 0; this.gather = 0.5;
      this.setIdx = 0; this.wantSet = false;
      this.stripKey = ['', '']; this.stripSlot = 0; this.stripT = -10; this.lay = [[1, 1, 1], [1, 1, 1]];
      this.capsKey = ''; this.wordKey = ''; this.wordShown = ''; this.melt = 1; this.wordGeo = [1, 1];
      this.beads = [];
      this.fed = new Float32Array(NS); this.wob = new Float32Array(NS); this.wobV = new Float32Array(NS);
      this.tints = new Float32Array(NS); this.tintIdx = -1;
      this.sweepT = -10;
      this.pos = SHAPES.map(() => [0, 0, 0]);
      this.uA = new Float32Array(NS * 4); this.uB = new Float32Array(NS * 4); this.uT = new Float32Array(NS);
      this.uBeads = new Float32Array(NB * 4);
    },

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; this.kickCount++; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; this.snareCount++; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; this.hatCount++; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      // Slow: the drop's bass is sidechained to the kick, and a fast follower
      // would make every piece of glass pump on the beat.
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      this.bassSlow += (bass - this.bassSlow) * k(0.5);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.2);
      return { kick, snare, hat };
    },

    currentSet(params) {
      const w = String(params.words || '').trim().toUpperCase();
      if (w) {
        const parts = w.split('/').map((x) => x.trim()).filter(Boolean);
        return { a: parts[0] || '', b: parts[1] || parts[0] || '', g: parts[2] || '' };
      }
      return SETS[this.setIdx % SETS.length];
    },

    // ---- GL ---------------------------------------------------------------

    gl0() {
      if (this.glTried) return this.gl;
      this.glTried = true;
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
      if (!gl) return null;
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('liquidglass shader: ' + gl.getShaderInfoLog(sh));
        return sh;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.bindAttribLocation(prog, 0, 'pos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('liquidglass link: ' + gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const U = {};
      for (const n of ['res', 'unitPx', 'stage', 'ground', 'ink', 'acc1', 'acc2', 'glassTint', 'disc1', 'disc2',
        'stripA', 'stripB', 'caps', 'word', 'layA', 'layB', 'stripMix', 'lines', 'lineH', 'wordXf', 'wordGeo', 'wtime',
        'shA', 'shB', 'shT', 'beads', 'smk', 'wk', 'refr', 'disp', 'sweep', 'hat', 'shadow']) {
        U[n] = gl.getUniformLocation(prog, n);
      }
      const mkTex = (wrap) => {
        const tx = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return tx;
      };
      this.tex = {
        strip: [mkTex(gl.CLAMP_TO_EDGE), mkTex(gl.CLAMP_TO_EDGE)],
        caps: mkTex(gl.CLAMP_TO_EDGE),
        word: mkTex(gl.CLAMP_TO_EDGE),
      };
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      this.glCanvas = cv; this.gl = gl; this.prog = prog; this.U = U; this.vao = vao;
      this.work = document.createElement('canvas');
      return gl;
    },

    upload(tex, canvas) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    },

    // Two marquee lines, white on black, stacked in one texture. Each line's
    // repeat period is the phrase plus a gap holding a dot, so the shader can
    // wrap each at its own period.
    buildStrip(slot, set, geo, unitPx) {
      const lh = geo.lineH;
      const c = this.work, g = c.getContext('2d');
      g.font = `400 100px ${TYPE_FONT}`;
      const asc = g.measureText('H').actualBoundingBoxAscent || 72;
      const size = (lh * 0.9) / asc * 100;
      g.font = `400 ${size.toFixed(2)}px ${TYPE_FONT}`;
      const track = -size * 0.005;
      if ('letterSpacing' in g) g.letterSpacing = `${track.toFixed(2)}px`;
      const gap = lh * 0.42;
      const wA = g.measureText(set.a).width, wB = g.measureText(set.b).width;
      const P1 = wA + gap, P2 = wB + gap;
      let r = Math.min(unitPx, 2);
      const texWu = Math.max(P1, P2);
      r = Math.min(r, (this.maxTex - 4) / texWu, (this.maxTex - 4) / (2 * lh));
      const tw = Math.ceil(texWu * r), th = Math.ceil(2 * lh * r);
      c.width = tw; c.height = th;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, tw, th);
      g.setTransform(r, 0, 0, r, 0, 0);
      g.font = `400 ${size.toFixed(2)}px ${TYPE_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${track.toFixed(2)}px`;
      g.fillStyle = '#fff';
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      const base = lh * 0.95;
      g.fillText(set.a, 0, base);
      g.fillText(set.b, 0, lh + base);
      const dotR = lh * 0.075;
      g.beginPath(); g.arc(wA + gap / 2, base - lh * 0.45, dotR, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(wB + gap / 2, lh + base - lh * 0.45, dotR, 0, Math.PI * 2); g.fill();
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      this.upload(this.tex.strip[slot], c);
      this.lay[slot] = [P1, P2, tw / r];
    },

    buildCaps(W, H, w, h, unitPx, geo) {
      const c = this.work, g = c.getContext('2d');
      c.width = w; c.height = h;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.setTransform(unitPx, 0, 0, unitPx, 0, 0);
      g.fillStyle = '#fff';
      const S = Math.min(W, H), m = geo.m;
      const big = S * 0.03, small = S * 0.021;
      const narrow = W < H * 1.2;
      g.textBaseline = 'alphabetic';
      // Top band
      const yT = m + big;
      g.textAlign = 'left';
      g.font = `700 ${big.toFixed(1)}px ${CAP_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(big * 0.2).toFixed(1)}px`;
      g.fillText('CLEAR NIGHTS', m, yT);
      g.textAlign = 'right';
      g.font = `400 ${small.toFixed(1)}px ${MONO_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillText(narrow ? '124 BPM' : '124 BPM — DUSK UNTIL FIRST LIGHT', W - m, yT);
      // Bottom band
      const yB = H - m;
      g.textAlign = 'left';
      g.font = `400 ${small.toFixed(1)}px ${MONO_FONT}`;
      g.fillText(narrow ? 'SOUND / LIGHT' : 'SOUND / LIGHT / SURFACE TENSION', m, yB);
      g.textAlign = 'right';
      g.font = `700 ${big.toFixed(1)}px ${CAP_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(big * 0.2).toFixed(1)}px`;
      g.fillText('NO. 21', W - m, yB);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      // Hairline rules framing the type
      const lw = Math.max(1 / unitPx, S * 0.0022);
      g.fillRect(m, geo.top - geo.gap * 0.5 - lw / 2, W - 2 * m, lw);
      g.fillRect(m, geo.bottom + geo.gap * 0.5 - lw / 2, W - 2 * m, lw);
    },

    // The glass word: a heavy face, set with open tracking so each letter is
    // its own piece of glass, turned into an exact signed distance field.
    // (A blurred mask was tried first: it welded the letters and filled the
    // counters, and the word read as one gooey blob.)
    buildWord(text, W, H) {
      const S = Math.min(W, H);
      const R = S * 0.05;
      const ts = 2; // texels per unit
      const c = this.work, g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.font = `400 100px ${GLASS_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = '9px';
      const mw = g.measureText(text || ' ').width;
      const asc = g.measureText('H').actualBoundingBoxAscent || 72;
      const size = Math.min((W * 0.66) / Math.max(mw, 1) * 100, (H * 0.36) / asc * 100);
      const pad = R * 1.2;
      const capH = asc * size / 100;
      g.font = `400 ${size.toFixed(2)}px ${GLASS_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.09).toFixed(2)}px`;
      const twU = g.measureText(text || ' ').width - size * 0.09;
      const wU = twU + 2 * pad, hU = capH + 2 * pad;
      const w = Math.ceil(wU * ts), h = Math.ceil(hU * ts);
      c.width = w; c.height = h;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.setTransform(ts, 0, 0, ts, 0, 0);
      g.font = `400 ${size.toFixed(2)}px ${GLASS_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.09).toFixed(2)}px`;
      g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText(text, pad, pad + capH);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      const img = g.getImageData(0, 0, w, h).data;
      // Felzenszwalb-Huttenlocher squared distance transform, both ways.
      const INF = 1e20;
      const n = Math.max(w, h);
      const f = new Float64Array(n), dd = new Float64Array(n), z = new Float64Array(n + 1);
      const v = new Int32Array(n);
      const edt1 = (len) => {
        let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
        for (let q = 1; q < len; q++) {
          let sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          while (sx <= z[k]) { k--; sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = sx; z[k + 1] = INF;
        }
        k = 0;
        for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; dd[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
      };
      const edt = (inside) => {
        const grid = new Float64Array(w * h);
        for (let i = 0; i < w * h; i++) grid[i] = (img[i * 4] >= 128) === inside ? 0 : INF;
        for (let x = 0; x < w; x++) {
          for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
          edt1(h);
          for (let y = 0; y < h; y++) grid[y * w + x] = dd[y];
        }
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
          edt1(w);
          for (let x = 0; x < w; x++) grid[y * w + x] = dd[x];
        }
        return grid;
      };
      const toIn = edt(true), toOut = edt(false);
      const out = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        // Half a texel either way puts the contour on the pixel boundary.
        const dU = ((Math.sqrt(toIn[i]) - 0.5 * (toIn[i] > 0)) - (Math.sqrt(toOut[i]) - 0.5 * (toOut[i] > 0))) / ts;
        out[i] = Math.round(clamp(0.5 - dU / (2 * R), 0, 1) * 255);
      }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex.word);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, out);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      this.wordGeo = [wU, hU, R];
    },

    // ---- frame ------------------------------------------------------------

    draw(p, signals, params, ctx) {
      if (!this.prev) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const inks = INKS[clamp(Math.round(params.ink), 0, INKS.length - 1)];
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const react = params.reaction;

      // ---- music
      const ev = this.analyse(signals, t, dt);
      if (!this.drop && this.low > 30) { this.drop = true; this.setIdx++; }
      else if (this.drop && this.low < 16) this.drop = false;
      if (this.wantSet) { this.wantSet = false; this.setIdx++; }
      this.dropAmt += ((this.drop ? 1 : 0) - this.dropAmt) * k(this.drop ? 0.8 : 2.2);
      const gatherWant = this.drop ? -(Math.round(params.glassWord) === 2 ? 0.15 : 0.4) : 0.5 * (1 - this.energy);
      this.gather += (gatherWant - this.gather) * k(2.5);
      if (ev.hat) { this.hatEnv = 1; this.hatSeed = (this.hatCount * 7.31) % 97; }
      this.hatEnv *= Math.exp(-dt / 0.1);

      // ---- motion
      const flow = params.flow;
      this.phase += dt * flow * (0.12 + 0.12 * this.energy + 0.1 * this.dropAmt);
      const mq = flow * S * (0.006 + 0.008 * this.energy + 0.01 * this.dropAmt);
      this.scroll1 += dt * mq; this.scroll2 += dt * mq * 0.8;
      this.wt += dt * (0.3 + 0.5 * flow);

      // ---- layout
      const m = S * 0.045;
      const gap = S * 0.03;
      const top = m + S * 0.07, bottom = H - m - S * 0.07;
      const lineH = (bottom - top - gap) / 2;
      const geo = { m, gap, top, bottom, lineH };

      // ---- lozenges
      const nAct = [];
      for (let i = 0; i < SHAPES.length; i++) {
        const sd = SHAPES[i];
        let act = sd.drop ? smooth(clamp(this.dropAmt * 1.8 - (sd.drop - 1) * 0.3, 0, 1)) : 1;
        // The big pill pours itself into the glass word while the word is up.
        if (i === 0) act *= 1 - 0.9 * smooth(clamp(this.wordVis || 0, 0, 1));
        let cx = W * (sd.x + sd.ax * Math.sin(this.phase * sd.f[0] * 6 + sd.ph[0]));
        let cy = H * (sd.y + sd.ay * Math.sin(this.phase * sd.f[1] * 6 + sd.ph[1]));
        cx = lerp(cx, W * 0.5, this.gather * 0.55);
        cy = lerp(cy, H * 0.52, this.gather * 0.55);
        // Absorbing a drop: swell a little, then a damped wobble.
        this.fed[i] *= Math.exp(-dt / 0.6);
        const wv = this.wobV[i], wp = this.wob[i];
        const acc = -wp * 380 - wv * 9;
        this.wobV[i] = wv + acc * dt; this.wob[i] = wp + this.wobV[i] * dt;
        const sc = act * (1 + this.fed[i] + 0.07 * this.bassSlow);
        const ang = sd.rot * Math.sin(this.phase * 0.7 + sd.ph[0]);
        const hx = S * sd.hx * (1 + 0.1 * this.wob[i]), hy = S * sd.hy * (1 - 0.1 * this.wob[i]);
        this.pos[i] = [cx, cy, ang, hx, hy, sc];
        this.uA.set([cx, cy, hx, hy], i * 4);
        this.uB.set([sd.c >= 1 ? 1e4 : sd.c * S, ang, sc, sd.bev * Math.min(hx, hy) * sc], i * 4);
        if (act > 0.6) nAct.push(i);
      }
      for (let i = SHAPES.length; i < NS; i++) { this.uA.set([0, 0, 1, 1], i * 4); this.uB.set([0, 0, 0, 1], i * 4); }

      // ---- kick: a droplet lands beside a lozenge and is drawn into it
      if (ev.kick && nAct.length) {
        const i = nAct[this.kickCount % nAct.length];
        const [cx, cy, ang, hx, hy, sc] = this.pos[i];
        const hsh = Math.sin(this.kickCount * 12.9898) * 43758.5453;
        let a = (hsh - Math.floor(hsh)) * Math.PI * 2;
        const r = S * (0.055 + 0.035 * Math.min(react, 1.5)) * (0.8 + 0.3 * this.dropAmt);
        // Start just clear of the rim, on the side facing the middle of the stage.
        let bx = 0, by = 0;
        for (let tries = 0; tries < 6; tries++) {
          const ex = hx * sc * Math.cos(a), ey = hy * sc * Math.sin(a);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const ox = ca * ex - sa * ey, oy = sa * ex + ca * ey;
          const ol = Math.hypot(ox, oy) || 1;
          bx = cx + ox + (ox / ol) * (r * 1.25 + S * 0.03);
          by = cy + oy + (oy / ol) * (r * 1.25 + S * 0.03);
          if (bx > r && bx < W - r && by > r && by < H - r) break;
          a += 1.1;
        }
        if (react > 0.01) {
          this.beads.push({ x0: bx, y0: by, r, t0: t, i, fedDone: false });
          if (this.beads.length > NB) this.beads.shift();
        }
      }
      this.uBeads.fill(0);
      this.beads = this.beads.filter((b) => t - b.t0 < 0.9);
      this.beads.forEach((b, j) => {
        const a = t - b.t0;
        const grow = smooth(clamp(a / 0.07, 0, 1));
        const u = clamp((a - 0.12) / 0.6, 0, 1);
        const e = u * u;
        const [cx, cy] = this.pos[b.i];
        const tx = lerp(cx, b.x0, 0.3), ty = lerp(cy, b.y0, 0.3);
        const x = lerp(b.x0, tx, e), y = lerp(b.y0, ty, e);
        const rr = b.r * grow * (1 - 0.85 * Math.pow(u, 1.4));
        if (!b.fedDone && u > 0.35) {
          b.fedDone = true;
          this.fed[b.i] += 0.05 * Math.min(react, 1.5);
          this.wobV[b.i] += 5 * Math.min(react, 1.5);
        }
        this.uBeads.set([x, y, rr, 0], j * 4);
      });

      // ---- clap: a light sweep over every rim, one lozenge turns tinted
      if (ev.snare) {
        this.sweepT = t;
        if (nAct.length) this.tintIdx = nAct[(this.snareCount * 3) % nAct.length];
      }
      for (let i = 0; i < NS; i++) {
        const want = i === this.tintIdx && t - this.lastSnare < 0.05 + 0.9 * this.dropAmt ? 1 : 0;
        this.tints[i] += (want - this.tints[i]) * k(want ? 0.03 : 0.35);
      }
      this.uT.set(this.tints);
      const sw = (t - this.sweepT) / 0.45;
      const diag = W * 0.8 + H * 0.6;
      const sweepPos = lerp(-S * 0.2, diag + S * 0.2, sw);
      const sweepAmt = sw < 1 ? clamp(react, 0, 1.5) * 0.85 * Math.sin(Math.PI * clamp(sw, 0, 1)) : 0;

      // ---- glass word
      const set = this.currentSet(params);
      const gw = Math.round(params.glassWord);
      const wantWord = gw === 2 || !set.g ? 0 : gw === 1 ? 1 : this.dropAmt > 0.5 && this.drop ? 1 : 0;
      this.wordAppear = (this.wordAppear || 0) + ((wantWord) - (this.wordAppear || 0)) * k(wantWord ? 0.9 : 0.7);
      const wordNeed = set.g || '';
      // A new word waits until the old one has melted away.
      if (wordNeed !== this.wordShown) this.melt = Math.max(0, this.melt - dt / 0.4);
      else this.melt = Math.min(1, this.melt + dt / 0.6);

      // ---- GL
      const pd = p.pixelDensity();
      const w = Math.round(p.width * pd), h = Math.round(p.height * pd);
      const unitPx = w / W;
      const gl = this.gl0();
      if (!gl) { p.background(inks.ground); return; }
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      const fontOk = !window.VIZ_FONTS || (VIZ_FONTS.has('Anton') && VIZ_FONTS.has('Archivo Black'));
      const sizeKey = w + 'x' + h + '|' + fontOk;

      const skey = set.a + '/' + set.b + '|' + sizeKey;
      if (skey !== this.stripKey[this.stripSlot]) {
        const prevText = this.stripKey[this.stripSlot].split('|')[0];
        if (prevText && prevText !== set.a + '/' + set.b) { this.stripSlot = 1 - this.stripSlot; this.stripT = t; }
        else if (!prevText) this.stripT = -10;
        this.buildStrip(this.stripSlot, set, geo, unitPx);
        this.stripKey[this.stripSlot] = skey;
      }
      const hm = smooth(clamp((t - this.stripT) / 1.2, 0, 1));
      const stripMix = this.stripSlot === 1 ? hm : 1 - hm;
      const ckey = sizeKey + '|' + (window.VIZ_FONTS ? VIZ_FONTS.has('Josefin Sans') : 1);
      if (ckey !== this.capsKey) { this.buildCaps(W, H, w, h, unitPx, geo); this.upload(this.tex.caps, this.work); this.capsKey = ckey; }
      const wkey = wordNeed + '|' + W.toFixed(0) + 'x' + H.toFixed(0) + '|' + fontOk;
      if ((this.melt <= 0 || this.wordAppear < 0.02 || !this.wordShown) && wkey !== this.wordKey) {
        if (wordNeed) this.buildWord(wordNeed, W, H);
        this.wordKey = wkey; this.wordShown = wordNeed;
      }

      const U = this.U;
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      const bind = (unit, tex, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
      bind(0, this.tex.strip[0], U.stripA);
      bind(1, this.tex.strip[1], U.stripB);
      bind(2, this.tex.caps, U.caps);
      bind(3, this.tex.word, U.word);
      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.unitPx, unitPx);
      gl.uniform2f(U.stage, W, H);
      gl.uniform3fv(U.ground, hex(inks.ground));
      gl.uniform3fv(U.ink, hex(inks.ink));
      gl.uniform3fv(U.acc1, hex(inks.acc1));
      gl.uniform3fv(U.acc2, hex(inks.acc2));
      gl.uniform3fv(U.glassTint, hex(inks.tint));
      const d1x = W * (0.63 + 0.05 * Math.sin(this.phase * 0.23)), d1y = H * (0.5 + 0.04 * Math.sin(this.phase * 0.31 + 1));
      gl.uniform4f(U.disc1, d1x, d1y, S * (0.33 + 0.025 * this.bassSlow), 1);
      const d2a = smooth(clamp(this.dropAmt * 1.3, 0, 1));
      gl.uniform4f(U.disc2, W * (0.3 + 0.04 * Math.sin(this.phase * 0.19 + 2)) - (1 - d2a) * S * 0.3, H * 0.46, S * 0.24, d2a);
      gl.uniform4f(U.layA, ...this.lay[0], 0);
      gl.uniform4f(U.layB, ...this.lay[1], 0);
      gl.uniform1f(U.stripMix, stripMix);
      gl.uniform4f(U.lines, top, top + lineH + gap, this.scroll1, this.scroll2);
      gl.uniform1f(U.lineH, lineH);
      const wAppear = this.wordShown ? this.wordAppear * smooth(this.melt) : 0;
      this.wordVis = wAppear;
      gl.uniform4f(U.wordXf, W * (0.5 + 0.06 * Math.sin(this.phase * 0.41)), H * (0.5 + 0.05 * Math.sin(this.phase * 0.53 + 1.7)),
        0.05 * Math.sin(this.phase * 0.29), wAppear);
      gl.uniform4f(U.wordGeo, this.wordGeo[0], this.wordGeo[1], this.wordGeo[2] || 12, 3 * params.liquid);
      gl.uniform1f(U.wtime, this.wt);
      gl.uniform4fv(U.shA, this.uA);
      gl.uniform4fv(U.shB, this.uB);
      gl.uniform1fv(U.shT, this.uT);
      gl.uniform4fv(U.beads, this.uBeads);
      const smk = Math.max(0.5, params.liquid * S * 0.085);
      gl.uniform1f(U.smk, smk);
      gl.uniform1f(U.wk, Math.max(0.5, Math.min(smk * 0.45, (this.wordGeo[2] || 30) * 0.9)));
      gl.uniform1f(U.refr, params.thickness * (0.17 + 0.06 * this.bassSlow + 0.02 * this.dropAmt));
      gl.uniform1f(U.disp, params.disp * 0.3);
      gl.uniform3f(U.sweep, sweepPos, sweepAmt, S * 0.09);
      gl.uniform2f(U.hat, this.hatEnv * clamp(0.3 + this.energy, 0, 1), this.hatSeed);
      gl.uniform3f(U.shadow, S * 0.018, S * 0.028, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(this.glCanvas, 0, 0, W, H);
      g.restore();
    },
  });
})();
