// Film: the Finish's last stage, where light becomes a picture. In order:
// chromatic aberration (off by default), a filmic tone curve, a grade preset,
// vignette, then animated grain (which also dithers away 8-bit banding).
//
// The tone curve is filmic but hue-preserving. Scenes are display-referred
// sRGB, so the curve is applied to an inverse-mapped input: identity up to
// ~86% sRGB, then a smooth shoulder towards an asymptote, so highlights (and
// anything bloom pushed past white) roll off instead of clipping. It acts on
// the brightest channel only; light beyond white also bleaches towards white,
// AgX-style. A first version ran each channel through full AgX (Sobotka's
// minimal polynomial) after inverting its grey curve; greys survived but De
// Stijl's yellow came out peach and its red coral (2026-09-28), so flat colour
// is now left alone.
//
// Grades are lift / gamma / gain plus saturation and contrast, applied to the
// display-encoded image, the way a colourist's wheels work. Index order must
// match VIZ_FX.GRADE_NAMES: Neutral, Film, Print, Night, Bleach.
VIZ_FX.register({
  id: 'film',
  name: 'Film',
  group: 'lens',
  params: [
    { key: 'tone', label: 'Tone curve', min: 0, max: 1, default: 1 },
    { key: 'grade', label: 'Grade (0 Neutral, 1 Film, 2 Print, 3 Night, 4 Bleach)', min: 0, max: 4, step: 1, default: 1 },
    { key: 'look', label: 'Grade amount', min: 0, max: 1, default: 1 },
    { key: 'grain', label: 'Grain', min: 0, max: 1, default: 0.35 },
    { key: 'vignette', label: 'Vignette', min: 0, max: 1, default: 0.35 },
    { key: 'aberration', label: 'Aberration', min: 0, max: 1, default: 0 }
  ],
  passes: [{ frag: `
// Slope 1 at the knee, so there is no visible kink; paper white lands at 93%.
const float K = 0.72;
float shoulder(float x) { return x < K ? x : K + (1.0 - K) * tanh((x - K) / (1.0 - K)); }

// Neutral, Film, Print, Night, Bleach.
const vec3 LIFT[5] = vec3[5](vec3(0.0), vec3(0.008, 0.012, 0.022), vec3(0.034, 0.028, 0.020), vec3(0.004, 0.012, 0.032), vec3(0.006));
const vec3 GAMMA[5] = vec3[5](vec3(1.0), vec3(1.0, 1.0, 0.99), vec3(1.05, 1.04, 1.02), vec3(0.97, 0.98, 1.0), vec3(1.0));
const vec3 GAIN[5] = vec3[5](vec3(1.0), vec3(1.015, 1.0, 0.97), vec3(1.0, 0.985, 0.935), vec3(0.955, 0.99, 1.04), vec3(1.03));
const float SAT[5] = float[5](1.0, 0.96, 0.86, 0.88, 0.62);
const float CONTRAST[5] = float[5](1.0, 1.04, 0.93, 1.05, 1.16);

void main() {
  vec2 d = vUv - 0.5;
  vec3 src;
  if (p_aberration > 0.0) {
    float a = p_aberration * 0.012;
    src = vec3(texture(uInput, 0.5 + d * (1.0 - a)).r, texture(uInput, vUv).g, texture(uInput, 0.5 + d * (1.0 + a)).b);
  } else src = texture(uInput, vUv).rgb;
  vec3 c = toLinear(src);
  int gi = int(clamp(floor(p_grade + 0.5), 0.0, 4.0));

  if (p_tone > 0.0) {
    // The curve acts on the brightest channel and scales all three by the
    // same factor, so flat colour keeps its hue and saturation.
    float peak = max(c.r, max(c.g, c.b));
    float tp = shoulder(peak);
    vec3 t = c * (tp / max(peak, 1e-5));
    // Light past white (bloom, halation) bleaches towards white on its way
    // to the asymptote, the way an over-exposed negative does.
    t = mix(t, vec3(tp), smoothstep(1.0, 2.5, peak) * 0.7);
    c = mix(min(c, 1.0), t, p_tone);
  } else c = min(c, 1.0);

  // Vignette in linear light, measured to the corner at any aspect ratio.
  float aspect = uRes.x / uRes.y;
  float r = length(d * vec2(aspect, 1.0)) / length(vec2(aspect, 1.0) * 0.5);
  c *= 1.0 - p_vignette * 0.5 * smoothstep(0.25, 1.05, r);

  vec3 g = toSrgb(c);
  float L = p_look;
  g = (g - 0.45) * mix(1.0, CONTRAST[gi], L) + 0.45;
  g = mix(vec3(1.0), GAIN[gi], L) * (g + LIFT[gi] * L * (1.0 - g));
  g = pow(max(g, 0.0), 1.0 / mix(vec3(1.0), GAMMA[gi], L));
  float gl = luma(g);
  g = gl + mix(1.0, SAT[gi], L) * (g - gl);

  // Grain: value noise about a CSS pixel across, new every frame, strongest
  // in the mid-tones as in a negative, weak in deep black and paper white.
  float cell = max(1.0, uRes.y / 1100.0);
  vec2 q = gl_FragCoord.xy / cell + floor(uTime * 60.0) * vec2(37.17, 91.31);
  vec2 i = floor(q), f = q - i;
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
  float n2 = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 173.0);
  float grain = (n - 0.5) * 1.6 + (n2 - 0.5) * 0.5;
  float lg = clamp(luma(g), 0.0, 1.0);
  g += grain * p_grain * 0.075 * (0.3 + 2.8 * lg * (1.0 - lg));
  g += (hash12(gl_FragCoord.xy + 0.37 + fract(uTime) * 311.0) - 0.5) / 255.0;
  fragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}` }]
});
