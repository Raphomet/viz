// Ripple: liquid rings that refract the frame. A ring drops on each kick (the
// beat grid: in four-to-the-floor the kick is the beat, and the grid is
// steady where the envelope is not), from the centre or from a new random
// spot each time like rain, and spreads and fades over the following beats,
// so the kick lands in one place and travels rather than shaking the frame
// (TASTE.md). The bass keeps a slow standing swell running from the centre.
// Shine lights the wave's slopes from the top left, lighter on one flank and
// darker on the other, so the water reads on white paper as well as on black.
VIZ_FX.register({
  id: 'ripple',
  name: 'Ripple',
  group: 'space',
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.5 },
    { key: 'wavelength', label: 'Wavelength', min: 0.1, max: 1, default: 0.35 },
    { key: 'speed', label: 'Ring speed', min: 0.1, max: 1, default: 0.45 },
    { key: 'every', label: 'Every n beats', min: 1, max: 4, step: 1, default: 1 },
    { key: 'scatter', label: 'Centre / scattered', min: 0, max: 1, default: 0.6 },
    { key: 'swell', label: 'Bass swell', min: 0, max: 1, default: 0.3 },
    { key: 'shine', label: 'Shine', min: 0, max: 1, default: 0.4 }
  ],
  passes: [{ frag: `
const int RINGS = 5;
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float every = max(1.0, floor(p_every + 0.5));
  float stepNow = floor(uBeatIndex / every);
  float phase = (mod(uBeatIndex, every) + uBeat) / every;
  float k = mix(90.0, 18.0, p_wavelength);    // radians per height unit
  float width = 3.5 / k * 3.0;                // each ring is a short wave packet
  vec2 g = vec2(0.0);
  for (int i = 0; i < RINGS; i++) {
    float s = stepNow - float(i);
    float age = float(i) + phase;                        // in steps
    vec2 c = p_scatter * (vec2(hash12(vec2(s, 1.7)), hash12(vec2(s, 8.3))) - 0.5) * vec2(aspect, 1.0) * 0.8;
    vec2 dv = p - c;
    float d = length(dv);
    float rad = age * p_speed * 0.55;
    float x = d - rad;
    // Rings rise over the first moment of their beat, then thin with age and
    // distance the way a real ring's energy spreads over its circumference.
    float amp = smoothstep(0.0, 0.06, age) * exp(-age * 0.9) / (1.0 + 3.0 * rad);
    float env = exp(-(x * x) / (width * width));
    float slope = (k * cos(k * x) - 2.0 * x / (width * width) * sin(k * x)) * env;
    g += amp * slope * dv / max(d, 1e-4);
  }
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float d0 = length(p);
  g += p_swell * bass * 0.5 * cos(d0 * k * 0.5 - uTime * 2.4) * (k * 0.5) * p / max(d0, 1e-4) / (1.0 + 4.0 * d0);
  vec2 off = g / k * p_amount * 0.09;
  vec3 col = texture(uSrc, mirrorUv(vUv + off / vec2(aspect, 1.0))).rgb;
  float light = dot(g / k, normalize(vec2(-1.0, 1.0)));
  col *= 1.0 + p_shine * clamp(light, -1.5, 1.5) * 0.5;
  fragColor = vec4(col, 1.0);
}` }]
});
