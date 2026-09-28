// Oil — a 1960s liquid light show: coloured oil and water pressed between two
// clock glasses on an overhead projector, the Joshua Light Show look.
//
// Everything is one WebGL2 fragment shader, analytic per pixel, with no
// feedback buffer. A feedback fluid sim was the obvious alternative, but
// semi-Lagrangian advection smears immiscible dyes into brown within a minute
// and needs a decay term that fights the look; an analytic field is the same at
// minute five as at minute one, and costs one pass.
//
// Layers, back to front:
//   1. the projector's light pool: warm, falling off to a vignette;
//   2. water dyed in two pale colours, marbled by a two-level domain warp with
//      faint veins where the dyes meet;
//   3. dye drops (the snare): each blooms from an impact flash into a disc of
//      vivid dye that the swirl smears as it ages;
//   4. oil: three immiscible colour groups of metaballs. Each pixel belongs to
//      whichever group's field is strongest, so groups never blend; where two
//      meet there is a dark interface line, and every edge has a thin-film
//      iridescent rim and a dark meniscus;
//   5. air bubbles in the oil: clear lenses with rainbow rims and specular
//      glints that sparkle on the hats;
//   6. lens: bloom halo around the oil, and the thumb-press hot spot on the kick.
//
// Music:
//   kick   a thumb presses the glass at one point, moving round the dish
//          by the golden angle each beat: the oil there squashes and spreads,
//          the thinned film lights up with a rainbow ring. The rest of the
//          dish does not move (jolt meter: calm). Gone in ~300 ms.
//   snare  drops a new drop of dye with a white splash, and lights the water
//          round it in the dye's colour for a moment.
//   bass   sets the speed of the stir: the whole dish turns continuously,
//          and the blobs and warp travel faster.
//   hats   shimmer the thin-film colours and fire glints on the bubbles.
//   drop   "heat" (a slow level) raises saturation, the number of blobs, the
//          bubbles and the bloom; the breakdown exhales into pale marbling.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const NB = 18;   // oil blobs: 14 large, 4 small droplets
  const ND = 8;    // dye drop slots
  const DROP_LIFE = 7;   // seconds a dye drop lasts
  // Largest GL canvas, in pixels: the image is soft liquid with no
  // hairlines, and the shader is the whole cost, so it renders below device
  // resolution and is scaled up.
  const MAX_PIXELS = 300000;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 res;
uniform sampler2D noiseTex;
uniform float T;          // warp clock (bass-driven)
uniform float press;      // kick envelope, 0-1
uniform vec2 thumb;       // where the kick presses, stage coords
uniform float stir;       // the dish's slow rotation, radians
uniform vec2 flashPos;    // the latest dye drop, dish coords
uniform float twist;      // swirl angle at the centre, radians
uniform float hatPh;      // thin-film phase, advanced by hats
uniform float hatEnv;     // hat envelope 0-1
uniform float hatCount;   // integer count of hat onsets, reseeds glints
uniform float heat;       // slow section level 0-1
uniform float mode;       // 0 projector, 1 blacklight
uniform float bubbleAmt;
uniform vec2 bubbleOff;
uniform vec4 blobs[${NB}];   // x, y, radius, group
uniform vec4 drops[${ND}];   // x, y, age, size (size 0 = empty)
uniform vec3 dropCol[${ND}];
uniform vec3 oilCol[3];
uniform vec3 waterA;
uniform vec3 waterB;
uniform vec3 lamp;
uniform vec3 flashCol;    // the latest dye's colour
uniform float flash;      // snare envelope 0-1
out vec4 outColor;

vec4 nz(vec2 x) {
  // Hermite-smoothed lookup: hardware bilinear with a remapped fraction, so a
  // single texture read gives smooth value noise without grid creases.
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return texture(noiseTex, (i + f + 0.5) / 256.0);
}
vec4 fbm(vec2 x) {
  vec4 a = vec4(0.0);
  float amp = 0.5;
  for (int k = 0; k < 3; k++) {
    a += amp * nz(x);
    x = mat2(1.6, 1.2, -1.2, 1.6) * x + vec2(3.1, 1.7);
    amp *= 0.5;
  }
  return a / 0.875;
}
vec3 film(float t) {
  // Thin-film interference: a cosine palette in optical thickness.
  return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67)));
}
vec4 hash4(vec2 c) {
  c = mod(c, 1024.0);
  vec4 q = vec4(dot(c, vec2(127.1, 311.7)), dot(c, vec2(269.5, 183.3)),
                dot(c, vec2(419.2, 371.9)), dot(c, vec2(113.5, 271.9)));
  return fract(sin(q) * 43758.5453);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
  float r = length(p);

  // ---- the stir: the whole dish turns slowly, so colour flows across the
  // frame; the bass sets its speed on the JS side.
  float cs = cos(stir), ss = sin(stir);
  mat2 rotS = mat2(cs, ss, -ss, cs);
  // ---- the kick: a thumb pressing the glass at one point. Near it the oil
  // is squashed and spread (a local magnification) and the thinned film
  // lights up; the rest of the dish does not move. A global press moved
  // 79% of the frame on every beat (jolt meter, 2026-09-28): too pulsey.
  vec2 tp = p - thumb;
  float tg = press * exp(-dot(tp, tp) / 0.09);
  vec2 pp = rotS * (p - tp * 0.45 * tg);

  // ---- the swirl: a twist strongest at the centre of the dish
  float a = twist * exp(-dot(pp, pp) * 0.7);
  float ca = cos(a), sa = sin(a);
  pp = mat2(ca, sa, -sa, ca) * pp;

  // ---- domain warp, two levels
  vec4 w1 = fbm(pp * 1.05 + vec2(T * 0.61, -T * 0.37));
  vec2 q = pp + (w1.xy - 0.5) * 0.6;
  vec4 w2 = fbm(q * 1.6 + vec2(-T * 0.43, T * 0.71) + 4.0);
  vec2 s = pp + (w2.zw - 0.5) * 0.42 + (w1.zw - 0.5) * 0.3;

  // ---- layer 1+2: lamp and marbled water
  float pool = 1.1 - 0.55 * smoothstep(0.35, 1.7, r);
  float vig = smoothstep(2.25, 0.85, r);
  vec3 L = lamp * pool * vig * (1.0 + 0.02 * press + 0.7 * tg);
  // The snare lights the water round its new drop in the dye's colour for
  // a moment: a colour event in one place, where the kick is a squeeze.
  vec2 fp = pp - flashPos;
  L *= mix(vec3(1.0), 0.35 + 1.1 * flashCol, 0.55 * flash * exp(-dot(fp, fp) / 0.15));
  float mixw = smoothstep(0.3, 0.7, w2.x);
  vec3 water = mix(waterA, waterB, mixw);
  // A third, deeper pool of the first dye, so the water has three depths.
  water = mix(water, waterA * 0.45, smoothstep(0.55, 0.8, w1.z) * 0.8);
  // Schlieren: soft dark filaments where the warp folds, and pale ones
  // beside them. Ridges of the noise, not contour lines, which read as a map.
  float vein = pow(1.0 - abs(2.0 * w2.y - 1.0), 9.0);
  float pale = pow(1.0 - abs(2.0 * w1.w - 1.0), 14.0);
  water *= 1.0 - 0.55 * vein;
  water += pale * 0.35 * mix(waterB, vec3(1.0), 0.4);

  // ---- layer 3: dye drops, in the water under the oil
  vec3 dye = vec3(0.0);
  float dyeA = 0.0;
  float splash = 0.0;
  for (int i = 0; i < ${ND}; i++) {
    vec4 d = drops[i];
    if (d.w <= 0.0) continue;
    float age = d.z;
    // Cheap bound: the smear moves a drop by well under 0.5.
    if (length(pp - d.xy) > d.w * 1.3 + 0.5) continue;
    vec2 sp = mix(pp, s, clamp(age * 0.35, 0.0, 0.85));
    float R = d.w * (1.0 - exp(-age * 5.0));
    float dist = length(sp - d.xy) + (w1.y - 0.5) * 0.12 * R * 4.0;
    float fade = exp(-age / 3.0) * smoothstep(${DROP_LIFE.toFixed(1)}, ${(DROP_LIFE - 2).toFixed(1)}, age);
    float body = smoothstep(R, R * 0.78, dist) * fade;
    float fz = (dist - R) / (0.07 + 0.08 * R);
    float front = exp(-fz * fz) * fade;
    float a2 = clamp(body * 0.85 + front * 0.5, 0.0, 1.0);
    dye = mix(dye, dropCol[i] * (1.0 - 0.45 * front), a2);
    dyeA = max(dyeA, a2);
    splash += exp(-age * 9.0) * exp(-dot(pp - d.xy, pp - d.xy) / (0.03 + d.w * d.w * 0.6));
  }
  vec3 ground = mix(water, dye, dyeA);

  // ---- layer 4: oil, three immiscible groups
  vec2 so = mix(pp, s, 0.55);
  vec3 f = vec3(0.0);
  vec2 gr0 = vec2(0.0), gr1 = vec2(0.0), gr2 = vec2(0.0);
  for (int i = 0; i < ${NB}; i++) {
    vec4 b = blobs[i];
    vec2 d = so - b.xy;
    float R2 = 4.0 * b.z * b.z * (1.0 + 0.5 * tg);
    float dd2 = dot(d, d);
    // Compact kernel: most blobs are nowhere near most pixels.
    if (dd2 >= R2) continue;
    float v = 1.0 - dd2 / R2;
    vec3 m = vec3(equal(vec3(b.w), vec3(0.0, 1.0, 2.0)));
    f += v * v * v * m;
    // Analytic gradient per group, for shading each oil as a lens.
    vec2 gv = -6.0 * v * v * d / max(R2, 1e-5);
    gr0 += gv * m.x; gr1 += gv * m.y; gr2 += gv * m.z;
  }
  float T0 = 0.3;
  int g = 0;
  float f1 = f.x, f2 = max(f.y, f.z);
  vec2 gr = gr0;
  if (f.y > f1) { g = 1; f1 = f.y; f2 = max(f.x, f.z); gr = gr1; }
  if (f.z > f1) { g = 2; f1 = f.z; f2 = max(f.x, f.y); gr = gr2; }
  float aa = max(fwidth(f1), 1e-4);
  float oil = smoothstep(T0 - aa, T0 + aa, f1);
  vec3 oc = oilCol[g];
  // Thickness: the lens is thin at the rim, full in the middle; light
  // through it is concentrated to a bright core, the rim is deep dye.
  float thick = smoothstep(T0, T0 + 0.9, f1);
  vec3 nrm = normalize(vec3(-gr * 0.22, 1.0));
  float shade = 0.65 + 0.55 * dot(nrm, normalize(vec3(-0.5, 0.6, 0.65)));
  vec3 body = oc * mix(0.55, 1.25, thick) * shade * (0.8 + 0.4 * w2.x);
  // Nested isolines of the field: the growth rings a pressed drop of oil
  // shows where films of different thickness overlap.
  float iv = f1 * 5.0 + w2.x * 0.8;
  float ring = 1.0 - clamp(abs(fract(iv) - 0.5) / max(fwidth(iv) * 1.2, 0.03) - 0.2, 0.0, 1.0);
  body *= 1.0 - 0.25 * ring * thick;
  float hl = (f1 - T0);
  float rimBand = exp(-(hl / 0.07) * (hl / 0.07));
  vec3 filmC = film(f1 * 3.2 + w2.z * 1.4 + hatPh);
  body = mix(body, filmC * (0.8 + 0.5 * hatEnv), rimBand * (0.55 + 0.35 * hatEnv));
  body += filmC * ring * thick * 0.18 * (0.5 + hatEnv);
  // Glossy highlight on each drop.
  vec3 hv = normalize(vec3(-0.35, 0.45, 1.0));
  body += vec3(1.0, 0.97, 0.9) * pow(max(dot(nrm, hv), 0.0), 60.0) * 0.55;
  float meniscus = exp(-pow(hl / (aa * 1.6 + 0.012), 2.0));
  // The interface between two oils that will not mix.
  float fr = (f1 - f2) / max(f1 + f2, 1e-4);
  float iface = smoothstep(0.12, 0.0, fr) * smoothstep(T0 * 0.7, T0 * 1.1, f2);
  vec3 col = mix(ground, body, oil);
  col *= 1.0 - 0.8 * max(meniscus * oil, iface);

  // ---- layer 5: air bubbles in the oil
  vec2 bc = (pp + bubbleOff + (w1.xy - 0.5) * 0.18) / 0.16;
  // Each bubble stays within half a cell of its cell's centre, so only the
  // 2x2 cells nearest the pixel can reach it (a 3x3 search cost twice as
  // much in SwiftShader for nothing).
  vec2 cell = floor(bc - 0.5);
  vec3 bub = vec3(0.0);
  float lens = 0.0, bubDark = 0.0;
  // Bubbles gather in clusters, as they do under a pressed glass.
  float clump = smoothstep(0.35, 0.75, nz(bc * 0.21 + 11.0).x);
  float px = fwidth(bc.x) * 1.2;
  for (int j = 0; j <= 1; j++)
  for (int i = 0; i <= 1; i++) {
    vec2 c = cell + vec2(i, j);
    vec4 h = hash4(c);
    float hx = h.x, hy = h.y, hz = h.z, hw = h.w;
    if (hx > bubbleAmt * (0.25 + clump)) continue;
    vec2 ctr = c + 0.5 + (vec2(hy, hz) - 0.5) * 0.24
             + 0.05 * vec2(sin(T * 1.3 + hw * 20.0), cos(T * 1.1 + hy * 20.0));
    float br = (0.07 + 0.2 * hw * hw);
    vec2 dv = bc - ctr;
    float dd = length(dv);
    if (dd > br * 1.2 + 2.0 * px) continue;
    float inside = smoothstep(br + px, br - px, dd);
    float rg = (dd - br * 0.93) / (br * 0.09 + px);
    float ring = exp(-rg * rg);
    lens += inside * (0.12 + 0.18 * (1.0 - dd / br));
    float dk = (dd - br) / (px * 1.5 + br * 0.04);
    bubDark += exp(-dk * dk);
    bub += ring * film(dd / br * 1.7 + hy * 3.0 + hatPh * 1.7) * 0.9;
    // Specular highlight up and left, glinting on the hats.
    vec2 hp = dv - vec2(-0.38, 0.38) * br;
    float spec = exp(-dot(hp, hp) / (br * br * 0.035));
    float lucky = step(fract(hz * 5.0 + hatCount * 0.618), 0.4);
    float gl = hatEnv * lucky;
    float cross = exp(-abs(hp.x) / (br * 0.04)) * exp(-abs(hp.y) / (br * 1.3))
                + exp(-abs(hp.y) / (br * 0.04)) * exp(-abs(hp.x) / (br * 1.3));
    bub += vec3(1.0, 0.97, 0.9) * (spec * (0.35 + 1.4 * gl) + cross * gl * 0.9 * inside);
  }
  // Bubbles are trapped in the oil; the few in open water are faint.
  float inOil = 0.3 + 0.7 * oil;
  col = col * (1.0 + lens * inOil) * (1.0 - 0.55 * inOil * clamp(bubDark, 0.0, 1.0));
  bub *= inOil;

  // ---- composite: projector (light through the dyes) vs blacklight (glow)
  vec3 proj = L * col + L * bub * 0.8;
  // Lens bloom: light scattering off the oil into its surroundings.
  float halo = smoothstep(0.02, T0, f1) * (1.0 - oil);
  // Halo colour weighted by every group's field: the winner's colour alone
  // left a hard seam where two groups' halos met.
  vec3 hc = (oilCol[0] * f.x + oilCol[1] * f.y + oilCol[2] * f.z) / max(f.x + f.y + f.z, 1e-4);
  proj += L * hc * halo * (0.18 + 0.7 * tg + 0.15 * heat);
  // The pressed film: a rainbow ring where the thumb thins the oil.
  float tr = length(tp);
  proj += L * film(tr * 5.0 + hatPh) * 0.8 * tg * smoothstep(0.03, 0.2, tr);

  vec3 bl = vec3(0.0);
  {
    float glowEdge = rimBand * oil + 0.6 * meniscus * oil;
    vec3 wb = mix(waterA, waterB, mixw) * 0.05 + vein * 0.05 * waterB;
    bl = wb + dye * dyeA * 0.85;
    bl = mix(bl, oc * (0.35 + 0.9 * thick) , oil);
    bl += filmC * glowEdge * (0.9 + 0.6 * hatEnv);
    bl += hc * halo * (0.35 + 0.8 * tg);
    bl += film(length(tp) * 5.0 + hatPh) * 0.35 * tg;
    bl *= 1.0 - 0.8 * iface;
    bl += bub * 0.9;
    bl *= vig * (1.0 + 0.02 * press + 0.3 * tg);
  }
  vec3 c = mix(proj, bl, mode);
  c += splash * vec3(1.0, 0.95, 0.85) * 0.9 * vig;

  // Saturation follows the section: the drop is lurid, the breakdown pale.
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(lum), c, 0.78 + 0.45 * heat);
  // Soft shoulder so the kick's brightening blooms instead of clipping.
  c = 1.0 - exp(-max(c, 0.0) * 1.25);
  outColor = vec4(c, 1.0);
}`;

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // Each palette: five oils in hue order (three on stage at a time, every
  // other one, so the three on stage are always spread round the wheel), two
  // water dyes, the lamp's colour, and the dye drops the snare lets fall.
  const PALETTES = [
    { name: 'Fillmore',
      oil: ['#ffe100', '#2cff6a', '#18c8ff', '#3a4dff', '#ff2ee0'],
      water: ['#d0102e', '#ff8a00'], lamp: '#fff4e0',
      drops: ['#00ffd0', '#ffe600', '#ff2ee0', '#7a2cff', '#2cff6a'] },
    { name: 'Acid',
      oil: ['#ff6a00', '#9dff00', '#00e5ff', '#8a3bff', '#ff2ee6'],
      water: ['#4a10b0', '#0a8aa0'], lamp: '#fffbe8',
      drops: ['#ff0080', '#ffe600', '#00ffd0', '#ff5a00', '#9dff00'] },
    { name: 'Deep',
      oil: ['#ffc300', '#00ff9d', '#00d9ff', '#a040ff', '#ff3a6a'],
      water: ['#102a90', '#7a1080'], lamp: '#f2f0ff',
      drops: ['#ff2e63', '#fff000', '#00ffa2', '#ff7b00', '#d05cff'] },
  ].map((pl) => ({
    name: pl.name, oil: pl.oil.map(hex), water: pl.water.map(hex), lamp: hex(pl.lamp), drops: pl.drops.map(hex),
  }));

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  // Crossfade two dyes through hue, not RGB: an RGB lerp between
  // complementary oils passes through grey (seen as grey blobs at 22 s).
  function rgb2hsv([r, g, b]) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 0) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6; if (h < 0) h += 1;
    }
    return [h, mx > 0 ? d / mx : 0, mx];
  }
  function hsv2rgb([h, s, v]) {
    const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)];
  }
  function lerpHue(a, b, t) {
    const A = rgb2hsv(a), B = rgb2hsv(b);
    let dh = B[0] - A[0];
    if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
    return hsv2rgb([(A[0] + dh * t + 1) % 1, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }

  VIZ.register({
    id: 'oil',
    name: 'Oil',
    order: 205,

    params: [
      { key: 'palette', label: 'Dyes', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'mode', label: 'Light', type: 'select', options: ['Projector', 'Blacklight'], default: 0 },
      { key: 'reaction', label: 'Music reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'swirl', label: 'Swirl', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'oil', label: 'Oil amount', type: 'range', min: 0.4, max: 1.6, default: 1, step: 0.01 },
      { key: 'bubbles', label: 'Bubbles', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'speed', label: 'Flow speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'Re-seed', run() { this.reseed(); } },
    ],

    gallery: {
      title: 'Oil',
      technique: 'WebGL2 fragment shader, analytic per pixel: three immiscible groups of metaballs over domain-warped marbled water, dye-drop discs, a hashed grid of thin-film bubbles, a slowly rotating dish, and a local thumb-press; smoothed value noise from one texture read per octave',
      brief: 'A 1960s liquid light show: coloured oil and water pressed between glass on an overhead projector. Slow blobs of three oils that never mix drift, merge and split over marbled water, their edges ringed with thin-film rainbows, air bubbles glinting in them. The whole dish turns slowly, so colour flows across the frame; the bass sets how fast. Each kick is a thumb pressing the glass at one point, moving round the dish beat to beat: the oil there squashes and spreads and the thinned film lights up in a rainbow ring. Each snare lets fall a drop of new dye that splashes white, blooms, and lights the water round it in its colour. hats shimmer the iridescence and fire glints on the bubbles. The drop is lurid and fast; the breakdown exhales into pale, slow marbling.',
      lineage: [
        'Brief 05 (Joshua Light Show): oil and water between glass on an overhead projector; kick presses the glass, snare drops dye, bass swirls, hats shimmer the iridescence.',
        'Chose an analytic shader over a feedback fluid sim: advection muddies immiscible dyes toward brown and needs a decay that fights the look; analytic fields stay fresh at minute five and cost one pass.',
        'Pass 1 (640x360): pale beige water, flat stickers of oil, contour-line veins that read as a topographic map, and a uniform scatter of bubbles like dotted noise. Clip-art lava lamp.',
        'Pass 2: saturated two-dye water with schlieren ridges instead of contours; oils shaded as lenses from an analytic field gradient (bright core, deep rim, gloss highlight); nested isolines inside each drop for the growth rings of pressed oil; bubbles clustered by a noise mask and faint outside the oil; snare also tints the lamp toward the new dye for ~150 ms, so it is a colour event where the kick is a brightness/scale one.',
        'Kick strip: 11.90 vs 12.0 clearly different (spread outward, blobs swell and merge, lamp and halo brighten), relaxed by 12.25; 12.5 (kick + clap) adds the white splash and a new drop.',
        'Breakdown showed grey blobs: the slow oil rotation crossfaded complementary dyes in RGB. Now crossfades through hue, and each palette lists its oils in hue order so the three on stage (every other one) are always spread round the wheel.',
        'Square stage was over-crowded with oil (same blobs, 56% of the area); oil radius now scales with sqrt(aspect).',
        'Added four small fast droplets that skate between the pools, for a second scale of motion.',
        'Performance: first build was far over budget under SwiftShader. Render capped at 0.3 Mpx and scaled up (the image is soft liquid), fbm cut to 3 octaves, bubbles searched in 2x2 cells not 3x3, compact-kernel blobs and dye drops culled per pixel, drop lifetime 7 s.',
        'Longevity (96 s): palette rotation and incommensurate Lissajous paths keep every tile different; no saturation or drift.',
        'Halo coloured by all groups\' fields, removing a seam where two halos met.',
        'Raph on batch 02 (2026-09-28): too pulsey, and wants more movement. Jolt meter before: JARRING, kickArea 0.79, ratio 2.82 (build 0.71): the global press (22% spread, lamp +60%, ripple) moved almost the whole frame each beat.',
        'Kick made local: a thumb presses at one point (golden-angle walk round the dish), magnifying the oil there by up to ~1.8x, swelling blobs, and lighting a rainbow film ring; the lamp change is 2%. Snare lamp tint made local to its drop; its global twist removed. Flow, warp and stir take a slower bass so each kick does not surge the whole dish.',
        'Movement: the whole dish now rotates continuously, speed set by the bass (and Swirl), so colour flows across the frame. Jolt after: CALM, kickArea 0.235, ratio 1.71 (build 0.31).',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    reseed() {
      const r = Math.random;
      this.blobSeed = [];
      for (let i = 0; i < NB; i++) {
        this.blobSeed.push({
          fx: 0.11 + r() * 0.2, fy: 0.09 + r() * 0.2, px: r() * 6.28, py: r() * 6.28,
          ax: 0.55 + r() * 0.45, ay: 0.5 + r() * 0.4, r: 0.13 + r() * 0.14,
          br: 0.5 + r() * 0.8, bp: r() * 6.28, g: i % 3,
        });
        if (i >= 14) {
          // Small droplets: faster, like the loose beads that skate around
          // the big pools when the glass is tilted.
          const b = this.blobSeed[i];
          b.r = 0.045 + r() * 0.04; b.fx *= 1.7; b.fy *= 1.7;
        }
      }
      this.dropIdx = 0;
    },

    setup() {
      this.reseed();
    },

    enter() {
      if (!this.blobSeed) this.reseed();
      this.lastMs = null;
      this.clock = 0;        // plain seconds, for slow drifts
      this.flow = 0;         // blob travel, bass-driven
      this.warpT = 0;        // warp clock, bass-driven
      this.press = 0;
      this.kickAge = 10;
      this.sinceKick = 10;
      this.sinceClap = 10;
      this.thumbAng = 0.7;
      this.thumbR = 0.5;
      this.stir = 0;
      this.flashPos = [0, 0];
      this.hatPh = 0;
      this.hatEnv = 0;
      this.hatCount = 0;
      this.prev = new Float32Array(9);
      this.bass = 0;
      this.pad = 0;
      this.heat = 0;
      this.kickRate = 0;
      this.bubbleOff = [0, 0];
      this.drops = [];
      for (let i = 0; i < ND; i++) this.drops.push({ x: 0, y: 0, age: 99, size: 0, col: [1, 1, 1] });
      this.dropCount = 0;
      this.flash = 0;
      this.flashCol = [1, 1, 1];
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

      // Noise texture: random bytes, lightly blurred (wrapping) so that the
      // Hermite-remapped bilinear read gives soft value noise.
      const N = 256;
      const raw = new Float32Array(N * N * 4);
      for (let i = 0; i < raw.length; i++) raw[i] = Math.random();
      const px = new Uint8Array(N * N * 4);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const w = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
          sum += w * raw[((((y + dy) & 255) * N + ((x + dx) & 255)) * 4) + ch];
        }
        // The blur narrows the spread around 0.5; stretch it back out.
        px[(y * N + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round((0.5 + (sum / 16 - 0.5) * 2.2) * 255)));
      }
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

      const u = {};
      for (const name of ['res', 'noiseTex', 'flashCol', 'flash', 'flashPos', 'thumb', 'stir', 'T', 'press', 'twist', 'hatPh', 'hatEnv', 'hatCount',
        'heat', 'mode', 'bubbleAmt', 'bubbleOff', 'blobs', 'drops', 'dropCol', 'oilCol', 'waterA', 'waterB', 'lamp']) {
        u[name] = gl.getUniformLocation(prog, name);
      }
      gl.uniform1i(u.noiseTex, 0);
      this.gl = gl;
      this.glCanvas = c;
      this.u = u;
    },

    // Onsets, not levels: the bass line sits in the kick's bands, so the kick
    // is found as a sharp one-frame rise in band 0 and the clap as one in
    // band 4, each with a refractory period.
    listen(sig, dt, react) {
      const b0 = sig[0] / 100, b4 = sig[4] / 100, b3 = sig[3] / 100;
      const pr = this.prev;
      this.sinceKick += dt;
      this.sinceClap += dt;
      this.kickAge += dt;

      if (b0 - pr[0] / 100 > 0.2 && b0 > 0.42 && this.sinceKick > 0.18) {
        this.press = Math.min(1, 0.35 + b0 * 0.75);
        this.sinceKick = 0;
        this.kickAge = 0;
        // The thumb moves round the dish by the golden angle each beat, so
        // successive presses land in different places.
        this.thumbAng += 2.39996;
        this.thumbR = 0.3 + 0.45 * Math.random();
        this.kickRate += 1;
      } else {
        this.press *= Math.exp(-dt / 0.15);
      }
      this.kickRate *= Math.exp(-dt / 2.5);

      const clapRise = Math.max(b4 - pr[4] / 100, b3 - pr[3] / 100);
      if (clapRise > 0.16 && b4 > 0.26 && this.sinceClap > 0.1) {
        this.sinceClap = 0;
        this.snare(Math.min(1, b4));
      }

      const hat = (sig[6] + sig[7] + sig[8]) / 300;
      const hatRise = hat - (pr[6] + pr[7] + pr[8]) / 300;
      if (hatRise > 0.12 && hat > 0.3) this.hatCount = (this.hatCount + 1) % 1000;
      this.hatEnv = hat > this.hatEnv ? hat : this.hatEnv * Math.exp(-dt / 0.09);
      this.hatPh += dt * (0.05 + 2.2 * this.hatEnv * react);

      const bass = (sig[1] + sig[2]) / 200;
      this.bass = ease(this.bass, bass, 3, dt);
      // The flow and stir take a slower bass, so each kick's energy in bands
      // 1-2 does not surge the whole dish's motion (a global jolt) but the
      // drop still runs visibly faster than the breakdown.
      this.bassSlow = ease(this.bassSlow || 0, bass, 0.8, dt);
      this.pad = ease(this.pad, (sig[2] + sig[3] + sig[4]) / 300, 0.8, dt);
      // Heat: how much is going on, over a couple of seconds. Kicks per
      // second dominate so the drop is unmistakable and the breakdown falls.
      const heatT = Math.min(1, 0.32 * this.kickRate + 0.9 * this.bass + 0.35 * hat);
      this.heat = ease(this.heat, heatT, heatT > this.heat ? 0.9 : 0.35, dt);
      pr.set(sig);
    },

    snare(amp) {
      const ctx = this.ctxLast;
      const aspect = ctx ? ctx.width / ctx.height : 16 / 9;
      const pal = this.palNow;
      // Drop the dye where there is water: try a few spots and keep the one
      // with the least oil over it, preferring the middle of the stage.
      let best = null, bestScore = 1e9;
      for (let k = 0; k < 5; k++) {
        const x = (Math.random() * 2 - 1) * aspect * 0.72;
        const y = (Math.random() * 2 - 1) * 0.68;
        let fsum = 0;
        for (const b of this.blobState || []) {
          const d2 = (x - b[0]) ** 2 + (y - b[1]) ** 2;
          const v = Math.max(0, 1 - d2 / (4 * b[2] * b[2]));
          fsum += v * v * v;
        }
        const score = fsum + 0.08 * (x * x + y * y);
        if (score < bestScore) { bestScore = score; best = [x, y]; }
      }
      const d = this.drops[this.dropIdx];
      this.dropIdx = (this.dropIdx + 1) % ND;
      d.x = best[0]; d.y = best[1]; d.age = 0;
      d.size = (0.2 + 0.3 * amp) * (0.6 + 0.4 * Math.min(1.5, this.reactLast));
      d.col = pal ? pal.drops[this.dropCount % pal.drops.length] : [1, 1, 1];
      this.dropCount++;
      this.flash = 1;
      this.flashCol = d.col;
      this.flashPos = [d.x, d.y];
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();
      this.ctxLast = ctx;

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const react = params.reaction;
      this.reactLast = react;

      const pal = PALETTES[(params.palette | 0) % PALETTES.length];
      // Oils rotate through the palette's five, one step every ~26 s with a
      // slow crossfade, so the harmony keeps shifting without cycling hue.
      const rot = this.clock / 26;
      const k = Math.floor(rot), fr = rot - k;
      const xf = Math.max(0, Math.min(1, (fr - 0.7) / 0.3));
      const xs = xf * xf * (3 - 2 * xf);
      const oils = [0, 1, 2].map((g) => lerpHue(pal.oil[(k + g * 2) % 5], pal.oil[(k + 1 + g * 2) % 5], xs));
      this.palNow = pal;

      this.listen(signals, dt, react);
      const press = Math.min(1.4, this.press * react);
      const bass = this.bass * react;
      const bassSlow = this.bassSlow * react;
      const heat = this.heat;

      this.clock += dt;
      const spd = params.speed;
      this.flow += dt * spd * (0.22 + 0.9 * bassSlow + 0.25 * heat);
      this.warpT += dt * spd * (0.05 + 0.22 * bassSlow + 0.05 * heat);
      this.flash *= Math.exp(-dt / 0.14);
      const twist = params.swirl * (0.9 * Math.sin(this.clock * 0.041) + (0.4 + 1.3 * bass) * Math.sin(this.clock * 0.093 + 1.3));
      // The dish turns continuously; the bass sets how fast.
      this.stir += dt * spd * (0.3 + 0.7 * params.swirl) * (0.035 + 0.16 * bassSlow + 0.03 * heat);
      this.bubbleOff[0] += dt * spd * (0.03 + 0.1 * bass);
      this.bubbleOff[1] += dt * spd * (0.012 * Math.sin(this.clock * 0.07));

      // Blob positions: incommensurate Lissajous paths on the flow clock,
      // wide enough to fill 16:9. The last few oils fade in with heat, so the
      // drop crowds the glass and the breakdown thins it.
      const aspect = ctx.width / ctx.height;
      const fit = Math.max(0.7, Math.min(1.1, Math.sqrt(aspect / 1.78)));
      const blobData = new Float32Array(NB * 4);
      this.blobState = [];
      for (let i = 0; i < NB; i++) {
        const b = this.blobSeed[i];
        const t = this.flow;
        const x = aspect * 0.78 * b.ax * Math.sin(t * b.fx * 2.1 + b.px) + 0.2 * Math.sin(t * b.fy * 3.3 + b.py);
        const y = 0.72 * b.ay * Math.sin(t * b.fy * 2.4 + b.py) + 0.18 * Math.cos(t * b.fx * 2.7 + b.px);
        const extra = i >= 9 && i < 14 ? Math.max(0, Math.min(1, heat * 1.6 - (i - 9) * 0.15)) : 1;
        const breathe = 1 + 0.12 * Math.sin(this.clock * b.br + b.bp) + 0.25 * this.pad;
        // Narrow stages hold the same oil in less area; shrink it to match.
        const rr = b.r * params.oil * breathe * extra * (0.85 + 0.2 * heat) * fit;
        blobData.set([x, y, rr, b.g], i * 4);
        this.blobState.push([x, y, rr]);
      }

      const dropData = new Float32Array(ND * 4);
      const dropCol = new Float32Array(ND * 3);
      this.drops.forEach((d, i) => {
        d.age += dt;
        const live = d.age < DROP_LIFE && d.size > 0;
        dropData.set([d.x, d.y, d.age, live ? d.size : 0], i * 4);
        dropCol.set(d.col, i * 3);
      });

      // ---- render
      // Rendered below device resolution and scaled up: the image is soft
      // liquid with no hairlines, and the shader is the whole cost.
      const dw = p.width * p.pixelDensity(), dh = p.height * p.pixelDensity();
      const sc = Math.min(0.75, Math.sqrt(MAX_PIXELS / (dw * dh)));
      const w = Math.round(dw * sc);
      const h = Math.round(dh * sc);
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke();
        p.fill(236);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text('Oil needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.T, this.warpT);
      gl.uniform1f(u.press, press);
      const tx = Math.min(aspect, 1.7) * 0.8 * this.thumbR * Math.cos(this.thumbAng);
      const ty = 0.8 * this.thumbR * Math.sin(this.thumbAng);
      gl.uniform2f(u.thumb, tx, ty);
      gl.uniform1f(u.stir, this.stir % (Math.PI * 2));
      gl.uniform2f(u.flashPos, this.flashPos[0], this.flashPos[1]);
      gl.uniform1f(u.twist, twist);
      gl.uniform1f(u.hatPh, this.hatPh % 10);
      gl.uniform1f(u.hatEnv, Math.min(1, this.hatEnv * react));
      gl.uniform1f(u.hatCount, this.hatCount);
      gl.uniform1f(u.heat, heat);
      gl.uniform1f(u.mode, (params.mode | 0) === 1 ? 1 : 0);
      gl.uniform1f(u.bubbleAmt, params.bubbles * (0.55 + 0.6 * heat));
      gl.uniform2f(u.bubbleOff, this.bubbleOff[0] % 200, this.bubbleOff[1] % 200);
      gl.uniform4fv(u.blobs, blobData);
      gl.uniform4fv(u.drops, dropData);
      gl.uniform3fv(u.dropCol, dropCol);
      gl.uniform3fv(u.oilCol, new Float32Array([].concat(...oils)));
      gl.uniform3fv(u.waterA, pal.water[0]);
      gl.uniform3fv(u.waterB, pal.water[1]);
      gl.uniform3fv(u.lamp, pal.lamp);
      gl.uniform3fv(u.flashCol, this.flashCol);
      gl.uniform1f(u.flash, Math.min(1, this.flash * react));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
