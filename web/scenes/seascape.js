// Seascape — a horizon at half height, grey on grey, the swell tracking past.
//
// Batch 06, idea 23 (the Curator): Sugimoto's seascapes, Murmuration's
// horizon, Sumi's greys. The frame holds only sea and sky, split exactly at
// half height, printed as a silver-gelatin photograph. The camera tracks
// slowly sideways along the shore, so the swell rolls toward us while the
// whole sea slides past with parallax (near water fast, the horizon still).
//
// Music, each in its own place:
// - kick: ONE crest of white foam runs along a single wave, left to right,
//   and the foam then rides that wave in toward the camera and thins out.
//   Every kick picks a new crest, so in the drop the sea fills with lines of
//   foam at different depths, but each beat only ever lights one line.
// - clap: the sun breaks through for a moment onto one patch of sea, which
//   brightens and glitters and then goes grey again.
// - hats: glints twinkle in the light path under the hidden sun.
// - bass: swell height and the speed of the water.
// - drop: the light in the sky lifts, the haze lifts off the horizon so the
//   line goes razor-sharp, the sea darkens (contrast is the escalation, as
//   the Curator asked), the swell grows, whitecaps break across the sea, the
//   tracking shot speeds up and a faint dawn warms the band over the horizon.
// - breakdown: mist rolls in until the horizon is gone, then clears when the
//   kick comes back.
//
// Why these choices, against the two other sea scenes in the batch: The
// Lighthouse Keeper is a riso night bay with a story in it, Ripple Tank is
// black water seen from above. This one is the photograph: eye-level, no
// subject, no ink colours, a continuous tonal image with film grain, and its
// drama is all in light and weather. Sumi's river is a painted handscroll;
// here the water is a physical wave field.
//
// Craft notes:
// - One WebGL2 fragment shader. Below the horizon each pixel intersects the
//   sea plane from a camera 3 m up; the surface is a sum of nine directional
//   deep-water waves (dispersion w = sqrt(g k), so long swell outruns the
//   chop). Each wave is faded out once a pixel's footprint approaches its
//   wavelength, which is what keeps the far sea from shimmering into moire
//   and gives the natural sheen toward the horizon.
// - Shading is Fresnel between a dark water body and the reflected sky
//   gradient, plus a specular path under a sun hidden behind cloud. The sky
//   is a perspective cloud deck (a noise field on a plane overhead), so its
//   strata converge on the horizon and slide past with the tracking shot.
// - Everything is a single grey value until the end, then mapped through a
//   two-tone print curve (silver, selenium, steel, platinum), so the palette
//   is a darkroom choice rather than a colour scheme.
// - The kick's foam is anchored to a crest index of the dominant swell,
//   computed identically here and in the shader, so the line it lights keeps
//   travelling with its own wave.

(function () {
  const H = 3.0;          // camera height, metres
  const F = 1.6;          // focal length, in half-heights
  const SWELL_L = 15;     // dominant swell wavelength, metres
  const SWELL_A = 0.12;   // its direction, radians off straight at the camera
  const SWELL_SEED = 0.7;
  const G = 9.8;
  const NF = 8;           // foam events in flight
  const NP = 3;           // sun-break patches in flight

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uT, uWT, uCamX, uCloudX, uMistX;
uniform float uSwell, uChopAmp, uLight, uHaze, uMist, uChop, uDawn, uGlit, uHat, uFrontSpd, uGrain;
uniform vec4 uFoam[${NF}];   // crest index, age, strength, lace seed
uniform vec4 uPatch[${NP}];  // world x, world z, envelope, radius
uniform vec3 uShadow, uHigh, uWarm;
out vec4 outColor;

const float PI = 3.14159265;
const float H = ${H.toFixed(3)};
const float F = ${F.toFixed(3)};

// wave table: direction (radians from 'toward the camera'), wavelength, amplitude
const int NW = 9;
const float WA[9] = float[9](${SWELL_A.toFixed(3)}, -0.55, 0.62, -0.28, 1.05, -0.92, 0.33, -0.66, 1.30);
const float WL[9] = float[9](${SWELL_L.toFixed(3)}, 11.0, 7.3, 4.7, 3.1, 2.05, 1.3, 0.82, 0.52);
const float WAMP[9] = float[9](0.34, 0.13, 0.08, 0.034, 0.022, 0.0147, 0.0093, 0.0059, 0.0037);
const float WS[9] = float[9](${SWELL_SEED.toFixed(3)}, 2.1, 4.4, 1.3, 5.9, 3.7, 0.4, 2.9, 5.1);

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
// fbm whose finer octaves give way to their mean as the footprint grows
float fbm(vec2 p, float fp) {
  float a = 0.5, s = 0.0, f = 1.0;
  for (int i = 0; i < 5; i++) {
    float keep = 1.0 - smoothstep(0.25, 0.7, fp * f);
    s += a * mix(0.5, vnoise(p * f + float(i) * 17.3), keep);
    f *= 2.03; a *= 0.5;
  }
  return s / 0.96875;
}

// foam: a ridged network of veins, not blobs; octaves fade to their mean
// as the footprint grows so far foam is a soft line rather than sparkle
float lace(vec2 p, float fp) {
  float s = 0.0, a = 0.55, f = 1.0;
  for (int i = 0; i < 3; i++) {
    float keep = 1.0 - smoothstep(0.25, 0.7, fp * f);
    float r = 1.0 - abs(2.0 * vnoise(p * f + float(i) * 7.1) - 1.0);
    s += a * mix(0.55, r * r, keep);
    f *= 2.2; a *= 0.5;
  }
  return s / 0.9625;
}

// the sky's brightness at elevation e (0 at the horizon)
float skyGrad(float e) {
  float hor = 0.50 + 0.36 * uLight;
  float zen = 0.20 + 0.20 * uLight;
  return mix(hor, zen, smoothstep(0.0, 0.75, e));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float asp = uRes.x / uRes.y;
  float px = 2.0 / uRes.y;
  float horL = skyGrad(0.0);
  float L;
  float warmW = 0.0;
  float mistD = uMist * (0.55 + 0.45 * fbm(vec2(uv.x * 0.9 + uMistX, uv.y * 3.2 - uT * 0.02), 0.0));
  float mistL = mix(horL, 0.6, 0.35);

  // hidden sun, a little right of centre, just behind the cloud deck
  vec3 Ls = normalize(vec3(0.42, 0.11, 1.0));

  if (uv.y > 0.0) {
    // ---------------------------------------------------------- the sky
    vec3 r = normalize(vec3(uv, F));
    float e = r.y;
    L = skyGrad(e);
    // a perspective cloud deck overhead: strata converge on the horizon
    float dist = 1.0 / max(uv.y, 1e-3);
    vec2 cp = vec2((uCamX * 0.03 + uCloudX) + uv.x * dist * 0.55, dist * 0.9);
    float fp = px * dist * dist * 0.9;
    float c = fbm(cp * vec2(0.55, 1.6), fp * 1.6);
    float thick = smoothstep(0.38, 0.8, c) * (1.0 - 0.55 * uLight);
    // the sun's diffuse light through the deck, thinning the cloud around it
    float sun = pow(max(dot(r, Ls), 0.0), 18.0);
    L += 0.16 * sun * (0.4 + uLight) - 0.10 * thick * (1.0 - 0.6 * sun);
    // lit cloud edges on the sun's side
    L += 0.05 * smoothstep(0.5, 0.62, c) * (1.0 - smoothstep(0.62, 0.78, c)) * (0.3 + sun);
    // sun breaks (clap): the cloud gap over each patch glows a little
    for (int i = 0; i < ${NP}; i++) {
      vec4 P = uPatch[i];
      if (P.z < 0.002) continue;
      float sx = (P.x - uCamX) * F / P.y;
      float d = (uv.x - sx) / 0.18;
      L += 0.06 * P.z * exp(-d * d) * smoothstep(0.45, 0.0, uv.y);
    }
    warmW = exp(-e * 7.0);
    // mist: thickest at the horizon
    float m = clamp(mistD * (1.35 - 1.1 * smoothstep(0.0, 0.7, uv.y)), 0.0, 1.0);
    L = mix(L, mistL, m);
  } else {
    // ---------------------------------------------------------- the sea
    float z = F * H / max(-uv.y, 1e-4);
    vec2 p = vec2(uCamX + uv.x * H / max(-uv.y, 1e-4), z);
    float fpz = z * z / (F * H) * px;
    float fpx = z / F * px;
    float hsum = 0.0, hmax = 0.0;
    vec2 grad = vec2(0.0);
    float swellPh = 0.0;
    for (int i = 0; i < NW; i++) {
      float a = WA[i];
      vec2 d = vec2(sin(a), -cos(a));
      float k = 2.0 * PI / WL[i];
      float w = sqrt(9.8 * k);
      float fpa = mix(fpx, fpz, abs(d.y));
      float att = 1.0 - smoothstep(WL[i] * 0.18, WL[i] * 0.55, fpa);
      float amp = WAMP[i] * (i < 3 ? uSwell : uChopAmp) * att;
      float ph = k * dot(p, d) - w * uWT + WS[i];
      if (i == 0) swellPh = ph;
      hsum += amp * cos(ph);
      hmax += amp;
      grad += -amp * k * sin(ph) * d;
    }
    vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
    vec3 r = normalize(vec3(uv, F));
    vec3 R = reflect(r, n);
    R.y = abs(R.y);
    float cosI = max(dot(-r, n), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - cosI, 5.0);
    // water body: darker in the drop, a little lighter through the crests
    float body = (0.075 - 0.035 * uLight) + 0.035 * clamp(hsum / max(hmax, 1e-3), -1.0, 1.0);
    float refl = skyGrad(R.y) * (0.82 - 0.3 * uLight);
    L = mix(body, refl, fres);
    warmW = fres * exp(-R.y * 6.0) * 0.8;

    // the light path under the hidden sun, and glints that twinkle with the hats
    float spec = pow(max(dot(R, Ls), 0.0), 220.0);
    float broad = pow(max(dot(R, Ls), 0.0), 40.0);
    vec2 gc = floor(gl_FragCoord.xy / max(1.5, uRes.y / 360.0));
    float g1 = h21(gc), g2 = h21(gc + 7.7);
    float tw = pow(max(0.0, sin(uT * (3.0 + 5.0 * g2) + g1 * 6.283)), 10.0) * step(0.93 - 0.1 * uHat, g1);
    float glint = spec * 0.35 + broad * tw * (0.35 + 1.4 * uHat);

    // sun breaks (clap): one patch of sea lights up and glitters
    float patchL = 0.0;
    for (int i = 0; i < ${NP}; i++) {
      vec4 P = uPatch[i];
      if (P.z < 0.002) continue;
      vec2 q = (p - P.xy) / vec2(P.w, P.w * 0.7);
      float pl = P.z * exp(-dot(q, q));
      patchL += pl;
      glint += pl * step(0.9, g1) * pow(max(0.0, sin(uT * 7.0 + g2 * 6.283)), 6.0) * 0.9;
    }
    L += patchL * (0.10 + 0.25 * fres);
    L += uGlit * glint;

    // whitecaps (drop): foam on the tallest crests, cell by cell, as the wind picks up
    if (uChop > 0.01) {
      // whitecaps ride the swell: short lengths of a crest break and stay
      // broken as that crest rolls in, so they travel with their wave
      float cr = floor(swellPh / (2.0 * PI) + 0.5);
      float dc = swellPh - 2.0 * PI * cr;
      float seg = floor(p.x / 9.0 + h21(vec2(cr, 1.3)) * 9.0);
      float hc = h21(vec2(cr, seg) + 3.1);
      float u = fract(p.x / 9.0 + h21(vec2(cr, 1.3)) * 9.0);
      float len = 0.25 + 0.5 * h21(vec2(cr, seg) + 8.4);
      float along = smoothstep(0.0, 0.15, u - (0.5 - 0.5 * len)) * smoothstep(0.0, 0.15, (0.5 + 0.5 * len) - u);
      float on = step(hc, uChop * 0.55) * (0.6 + 0.4 * sin(uT * 0.7 + hc * 30.0));
      float bandW = smoothstep(-0.5, -0.1, dc) * (1.0 - smoothstep(0.2, 1.1, dc));
      float lw = lace(p * vec2(1.4, 2.6) + hc * 40.0, max(fpx * 1.4, fpz * 2.6));
      float wc = on * along * bandW * smoothstep(0.5, 0.62, lw + 0.2 * along) * smoothstep(2.5, 6.5, z);
      L = mix(L, 0.86, wc * 0.85);
    }

    // kick: one crest of foam runs left to right along one wave
    float k0 = 2.0 * PI / WL[0];
    float crest = floor(swellPh / (2.0 * PI) + 0.5);
    float dl = swellPh - 2.0 * PI * crest;
    for (int i = 0; i < ${NF}; i++) {
      vec4 Fo = uFoam[i];
      if (Fo.z < 0.002) continue;
      if (abs(crest - Fo.x) > 0.5) continue;
      // the front is ragged, so the foam arrives as a spill, not a wipe
      float front = -asp - 0.08 + Fo.y * uFrontSpd + 0.18 * (vnoise(p * vec2(0.8, 1.5) + Fo.w * 9.0) - 0.5);
      float behind = front - uv.x;
      if (behind < 0.0) continue;
      float ageL = behind / uFrontSpd;
      // the breaking lip, then the spill down the front face
      float band = smoothstep(-0.7, -0.2, dl) * (1.0 - smoothstep(0.35, 1.7 - 0.5 * min(ageL, 1.0), dl));
      float I = Fo.z * exp(-ageL * 0.75) * (1.0 + 0.8 * exp(-behind * 10.0)) * smoothstep(0.0, 0.12, behind);
      vec2 fq = p * vec2(1.4, 2.6) + vec2(Fo.w * 31.0, 0.0);
      float lc = lace(fq, max(fpx * 1.4, fpz * 2.6));
      float thr = 0.62 - 0.3 * clamp(I, 0.0, 1.0);
      // the breaking lip is solid; the spill behind it is veined
      float lip = exp(-pow((dl + 0.1) / 0.22, 2.0));
      float foam = smoothstep(thr, thr + 0.1, lc + 0.35 * lip);
      // fade as the crest passes under the camera, so it never floods the bottom
      float nearF = smoothstep(3.0, 7.5, z);
      L = mix(L, 0.93, clamp(foam * band * min(I, 1.0) * nearF, 0.0, 1.0));
    }

    // distance haze and the breakdown's mist
    float m = clamp(1.0 - exp(-z * mistD * 0.06), 0.0, 1.0) + mistD * 0.25;
    L = mix(L, mistL, clamp(m, 0.0, 1.0));
  }

  // the horizon's own haze band: wide and soft in the calm, a hairline in the drop
  float hw = 0.004 + 0.09 * uHaze;
  float hz = exp(-abs(uv.y) / hw);
  L = mix(L, horL * 0.93, hz * (0.55 + 0.4 * uHaze));

  // a faint vignette, and the grain of the print
  float vig = 1.0 - 0.12 * dot(uv / vec2(asp, 1.0), uv / vec2(asp, 1.0));
  L *= vig;
  float gr = h21(gl_FragCoord.xy + fract(uT * 7.13) * vec2(137.0, 71.0)) - 0.5;
  L += gr * uGrain;
  L = clamp(L, 0.0, 1.1);
  // a gentle print curve, then the two-tone paper
  float Lc = smoothstep(0.0, 1.0, L * 0.92 + 0.04) * 0.6 + L * 0.4;
  vec3 col = mix(uShadow, uHigh, clamp(Lc, 0.0, 1.0));
  col = mix(col, col * uWarm, clamp(warmW * uDawn, 0.0, 1.0) * (1.0 - uMist * 0.7));
  outColor = vec4(col, 1.0);
}`;

  const TONES = [
    { name: 'Silver', shadow: [0.03, 0.033, 0.037], high: [0.93, 0.93, 0.915] },
    { name: 'Selenium', shadow: [0.055, 0.035, 0.045], high: [0.95, 0.925, 0.87] },
    { name: 'Steel', shadow: [0.018, 0.034, 0.05], high: [0.85, 0.9, 0.94] },
    { name: 'Platinum', shadow: [0.07, 0.05, 0.03], high: [0.97, 0.91, 0.8] },
  ];
  const WARM = [1.18, 0.9, 0.78];

  const PRESETS = {
    calm: { swell: 0.7, track: 0.55, light: 0.25, haze: 0.65, mist: 0.12, chop: 0, dawn: 0, glitter: 0.5 },
    drop: { swell: 1.35, track: 1.5, light: 0.9, haze: 0.06, mist: 0, chop: 0.75, dawn: 0.55, glitter: 1.1 },
    // The breakdown: the horizon gone in mist, the camera barely moving.
    mist: { swell: 0.55, track: 0.25, light: 0.3, haze: 1, mist: 0.95, chop: 0, dawn: 0, glitter: 0.2, follow: 0 },
    // A hard, dark sea under bright sky, as a still.
    storm: { swell: 1.9, track: 0.9, light: 1, haze: 0, mist: 0, chop: 1, dawn: 0, glitter: 0.6, tone: 2, follow: 0 },
  };
  const DRIVE = ['swell', 'track', 'light', 'haze', 'mist', 'chop', 'dawn', 'glitter'];
  const MISTED = ['mist', 'haze', 'track', 'glitter'];

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  VIZ.register({
    id: 'seascape',
    name: 'Seascape',
    order: 823,

    params: [
      { key: 'swell', label: 'Swell height', type: 'range', min: 0.2, max: 2.2, default: PRESETS.calm.swell, step: 0.01 },
      { key: 'track', label: 'Tracking speed', type: 'range', min: 0, max: 3, default: PRESETS.calm.track, step: 0.01 },
      { key: 'light', label: 'Light in the sky', type: 'range', min: 0, max: 1, default: PRESETS.calm.light, step: 0.01 },
      { key: 'haze', label: 'Horizon haze', type: 'range', min: 0, max: 1, default: PRESETS.calm.haze, step: 0.01 },
      { key: 'mist', label: 'Mist', type: 'range', min: 0, max: 1, default: PRESETS.calm.mist, step: 0.01 },
      { key: 'chop', label: 'Whitecaps', type: 'range', min: 0, max: 1, default: PRESETS.calm.chop, step: 0.01 },
      { key: 'dawn', label: 'Dawn warmth', type: 'range', min: 0, max: 1, default: PRESETS.calm.dawn, step: 0.01 },
      { key: 'glitter', label: 'Glitter on the water', type: 'range', min: 0, max: 1.6, default: PRESETS.calm.glitter, step: 0.01 },
      { key: 'react', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'tone', label: 'Print tone', type: 'select', options: TONES.map((t) => t.name), default: 0 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Seascape',
      technique: 'One WebGL2 fragment shader: the sea plane seen from 3 m up as a sum of nine dispersive deep-water waves, each faded out as the pixel footprint nears its wavelength; Fresnel between a dark water body and the reflected sky gradient; a perspective cloud deck of footprint-filtered noise; a specular light path with twinkling glints; kick foam bound to a crest index of the dominant swell; everything one grey value mapped through a two-tone print curve with film grain.',
      brief: 'A horizon exactly at half height, grey sea and grey sky, the only thing in the frame, filmed as a slow tracking shot along the shore so the swell rolls in and the sea slides past. Kick: one crest of white foam runs along a single wave, left to right, then rides it in. Clap: the sun breaks through onto one patch of sea for a moment. Hats: glints twinkle in the light path. Bass: swell height and the speed of the water. Drop: the light lifts in the sky, the horizon sharpens to a hairline, the sea darkens, whitecaps break, the camera speeds up and a faint dawn warms the horizon. Breakdown: mist rolls in until the horizon is gone.',
      lineage: [
        'Batch 06, idea 23 (the Curator): Seascape.',
        'Hiroshi Sugimoto, Seascapes (1980 on): the horizon at half height, long-exposure calm, silver-gelatin greys, contrast as the only escalation.',
        'Murmuration (web/scenes/murmuration.js): its low horizon and the reflection of the sky in flat water.',
        'Sumi (web/scenes/sumi.js): greys chosen as ink densities mapped at the end between a paper and an ink colour; the breakdown as mist.',
        'Kept distinct from the batch\'s other sea scenes: no subject and no ink colours (unlike The Lighthouse Keeper), eye level rather than from above (unlike Ripple Tank).',
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
      this.camX = 0;
      this.wt = 0;
      this.cloudX = 0;
      this.mistX = 0;
      this.swellS = null;
      this.foam = [];
      this.patches = [];
      this.fi = 0;
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, bass: 0, hat: 0,
        low: 0, dropOn: false, auto: 0, mistAuto: 0, lastK: -99, lastC: -99, lastDrop: -99 };
    },

    listen(signals, dt, T) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp((e.kf - e.ks) * 2.2, 0, 1);
      let kick = 0;
      if (e.kArm && kOn > 0.22 && T - e.lastK > 0.22) { kick = kOn; e.kArm = false; e.lastK = T; }
      if (kOn < 0.1) e.kArm = true;
      const cl = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp((e.cf - e.cs) * 3, 0, 1);
      let clap = 0;
      if (e.cArm && cOn > 0.25 && T - e.lastC > 0.3) { clap = cOn; e.cArm = false; e.lastC = T; }
      if (cOn < 0.1) e.cArm = true;
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 1.2, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 6, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      if (e.dropOn) e.lastDrop = T;
      return { kick, clap };
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
      for (const n of ['uRes', 'uT', 'uWT', 'uCamX', 'uCloudX', 'uMistX', 'uSwell', 'uChopAmp', 'uLight', 'uHaze',
        'uMist', 'uChop', 'uDawn', 'uGlit', 'uHat', 'uFrontSpd', 'uGrain', 'uFoam', 'uPatch', 'uShadow', 'uHigh', 'uWarm']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      this.u = u;
      this.gl = gl;
      this.glCanvas = c;
      this.bF = new Float32Array(NF * 4);
      this.bP = new Float32Array(NP * 4);
    },

    // The crest index of the dominant swell at a point, exactly as the shader
    // computes it, so a kick can name the wave it lights.
    crestAt(x, z) {
      const k = (2 * Math.PI) / SWELL_L;
      const w = Math.sqrt(G * k);
      const ph = k * (Math.sin(SWELL_A) * x - Math.cos(SWELL_A) * z) - w * this.wt + SWELL_SEED;
      return Math.floor(ph / (2 * Math.PI) + 0.5);
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

      // Follow the track: ease toward the drop look in the drop, and toward
      // the mist once the kick has gone quiet after a drop (the breakdown).
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.5, dt);
      const breakdown = follow && !e.dropOn && T - e.lastK > 1.4 && T - e.lastDrop < 40;
      e.mistAuto = ease(e.mistAuto, breakdown ? 1 : 0, breakdown ? 0.45 : 0.9, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      for (const k of MISTED) P[k] += (PRESETS.mist[k] - P[k]) * e.mistAuto;
      const react = params.react;
      const aspect = ctx.width / ctx.height;

      // --- continuous: the tracking shot, the water, the weather
      this.camX += dt * (0.25 + 2.4 * P.track) * (0.85 + 0.3 * e.bass);
      this.wt += dt * 0.62 * (0.85 + 0.35 * e.bass + 0.15 * P.swell);
      this.cloudX += dt * 0.01 * (0.5 + P.track);
      this.mistX += dt * (0.03 + 0.05 * P.mist);
      const swellT = P.swell * (0.8 + 0.45 * e.bass);
      this.swellS = this.swellS === null ? swellT : ease(this.swellS, swellT, 1.5, dt);

      // --- kick: one crest of foam, on a wave in the near half of the sea
      if (hit.kick && react > 0) {
        // the nearest crest to a random depth in the near half of the sea;
        // if the last kick lit that one, the next one out, so each beat
        // lights a fresh line (lower index = farther out)
        let n = this.crestAt(this.camX, 6 + 6 * Math.random());
        const last = this.foam[this.foam.length - 1];
        if (last && last.n === n && last.age < 1.2) n -= 1;
        this.foam.push({ n, age: 0, s: Math.min(1.4, (0.55 + 0.6 * hit.kick) * react), seed: Math.random() });
        if (this.foam.length > NF) this.foam.shift();
      }
      const frontSpd = 2.1 + 0.6 * e.auto;
      for (const f of this.foam) f.age += dt;
      this.foam = this.foam.filter((f) => f.age < (2 * aspect + 0.2) / frontSpd + 4.5);

      // --- clap: the sun breaks through onto one patch of sea
      if (hit.clap && react > 0) {
        const z = 14 + 22 * Math.random();
        const sx = (Math.random() * 1.3 - 0.65) * aspect;
        this.patches.push({ x: this.camX + sx * z / F, z, t0: T, s: Math.min(1.2, (0.6 + 0.5 * hit.clap) * react), r: 5 + 3 * Math.random() });
        if (this.patches.length > NP) this.patches.shift();
      }
      this.patches = this.patches.filter((q) => T - q.t0 < 3);

      // --- GL
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (err) { this.glFailed = true; console.error(err); }
      }
      if (!this.gl) {
        p.background(120);
        p.noStroke(); p.fill(40); p.rectMode(p.CORNER);
        p.rect(0, ctx.height / 2, ctx.width, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      gl.viewport(0, 0, w, h);

      this.bF.fill(0);
      this.foam.forEach((f, i) => {
        const o = i * 4;
        this.bF[o] = f.n; this.bF[o + 1] = f.age; this.bF[o + 2] = f.s; this.bF[o + 3] = f.seed;
      });
      this.bP.fill(0);
      this.patches.forEach((q, i) => {
        const o = i * 4;
        const a = T - q.t0;
        this.bP[o] = q.x; this.bP[o + 1] = q.z;
        this.bP[o + 2] = q.s * (1 - Math.exp(-a / 0.09)) * Math.exp(-a / 0.8);
        this.bP[o + 3] = q.r;
      });

      const tone = TONES[clamp(Math.round(params.tone), 0, TONES.length - 1)];
      const U = this.u;
      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uT, T);
      gl.uniform1f(U.uWT, this.wt);
      gl.uniform1f(U.uCamX, this.camX);
      gl.uniform1f(U.uCloudX, this.cloudX);
      gl.uniform1f(U.uMistX, this.mistX);
      gl.uniform1f(U.uSwell, this.swellS);
      gl.uniform1f(U.uChopAmp, 0.8 + 0.7 * P.chop + 0.15 * this.swellS);
      gl.uniform1f(U.uLight, clamp(P.light, 0, 1));
      gl.uniform1f(U.uHaze, clamp(P.haze, 0, 1));
      gl.uniform1f(U.uMist, clamp(P.mist, 0, 1));
      gl.uniform1f(U.uChop, clamp(P.chop, 0, 1));
      gl.uniform1f(U.uDawn, clamp(P.dawn, 0, 1));
      gl.uniform1f(U.uGlit, P.glitter);
      gl.uniform1f(U.uHat, clamp(e.hat * 1.8, 0, 1) * Math.min(1, react + 0.2));
      gl.uniform1f(U.uFrontSpd, frontSpd);
      gl.uniform1f(U.uGrain, 0.028);
      gl.uniform4fv(U.uFoam, this.bF);
      gl.uniform4fv(U.uPatch, this.bP);
      gl.uniform3fv(U.uShadow, tone.shadow);
      gl.uniform3fv(U.uHigh, tone.high);
      gl.uniform3fv(U.uWarm, WARM);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
