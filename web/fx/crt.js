// CRT: the picture as a tube draws it. Each scanline is a beam with a
// Gaussian profile that widens as it gets brighter, so dark areas show clear
// lines and bright ones fill in (a white poster stays white, faintly lined,
// instead of going grey). An aperture-grille mask splits the light into RGB
// stripes, the glass bulges a little with rounded corners, and phosphor
// persistence lets bright light fade over a few frames rather than vanish.
// Everything is brightness-compensated, so the effect textures the image
// without dimming it. Kept subtle by default: it should read as a screen,
// not as a filter.
//
// Music: bass swells the beam (the lines bloom together as it rises), and the
// snare throws a brief horizontal sync tear in one thin band.
VIZ_FX.register({
  id: 'crt',
  name: 'CRT',
  group: 'texture',
  settle: 10,
  params: [
    { key: 'lines', label: 'Scanlines', min: 120, max: 540, step: 1, default: 300 },
    { key: 'scan', label: 'Scanline depth', min: 0, max: 1, default: 0.55 },
    { key: 'mask', label: 'Shadow mask', min: 0, max: 1, default: 0.3 },
    { key: 'curve', label: 'Curvature', min: 0, max: 1, default: 0.25 },
    { key: 'persist', label: 'Phosphor persistence', min: 0, max: 0.95, default: 0.45 },
    { key: 'react', label: 'Reaction', min: 0, max: 1, default: 0.5 }
  ],
  passes: [{ frag: `
vec3 beamSample(vec2 uv, float px) {
  // A touch of horizontal softness, as the beam is round.
  return toLinear(texture(uInput, uv).rgb) * 0.5 +
         toLinear(texture(uInput, uv + vec2(px, 0.0)).rgb) * 0.25 +
         toLinear(texture(uInput, uv - vec2(px, 0.0)).rgb) * 0.25;
}
// Beam profile, normalised so a flat field keeps its brightness.
vec3 beam(vec3 c, float dist, float swell) {
  vec3 sig = mix(vec3(0.16), vec3(0.42), clamp(sqrt(c) + swell, 0.0, 1.0));
  vec3 g = exp(-dist * dist / (2.0 * sig * sig));
  return c * g / (sig * 2.5066);
}
void main() {
  float aspect = uRes.x / uRes.y;
  // Barrel distortion of the glass.
  vec2 p = vUv - 0.5;
  float k = p_curve * 0.18;
  vec2 q = p * (1.0 + k * dot(p * vec2(aspect, 1.0), p * vec2(aspect, 1.0)) / aspect);
  q *= 1.0 - k * 0.12;
  vec2 uv = q + 0.5;

  // The rounded screen edge, antialiased.
  vec2 e = abs(q) - (0.5 - 0.02 * p_curve);
  float rad = 0.04 * p_curve;
  float sd = length(max(e + rad, 0.0)) - rad;
  float inside = 1.0 - smoothstep(-1.5 / uRes.y, 0.5 / uRes.y, sd);

  float bass = 0.5 * (uBands[0] + uBands[1]);
  float swell = p_react * 0.35 * bass;

  // Snare: a thin band tears sideways for a moment.
  float bandY = hash12(vec2(uBeatIndex, 2.3));
  float tear = uSnare * p_react * smoothstep(0.035, 0.0, abs(uv.y - bandY));
  uv.x += tear * 0.012 * sin(uv.y * 900.0 + uTime * 40.0);

  float lines = floor(p_lines + 0.5);
  float yl = uv.y * lines;
  float n0 = floor(yl - 0.5);
  float px = 0.6 / uRes.x;
  vec3 c0 = beamSample(vec2(uv.x, (n0 + 0.5) / lines), px);
  vec3 c1 = beamSample(vec2(uv.x, (n0 + 1.5) / lines), px);
  float d0 = yl - (n0 + 0.5);
  vec3 lit = beam(c0, d0, swell) + beam(c1, 1.0 - d0, swell);
  vec3 flat_ = toLinear(texture(uInput, uv).rgb);
  vec3 c = mix(flat_, lit, p_scan);

  // Aperture grille: RGB stripes, each about a CSS pixel wide.
  float triad = 3.0 * max(1.0, uRes.y / 1080.0);
  float ph = gl_FragCoord.x / triad * 6.28318;
  vec3 m = 0.5 + 0.5 * cos(ph - vec3(0.0, 2.0944, 4.1888));
  c *= mix(vec3(1.0), m * 2.0, p_mask * 0.6);

  // Edge falloff of the tube, and the glass edge.
  c *= mix(1.0, 1.0 - 0.35 * dot(q, q) * 2.0, p_curve);
  c *= inside;

  // Phosphor persistence: bright light lingers and fades over a few frames.
  vec3 prev = toLinear(texture(uPrev, vUv).rgb);
  c = max(c, prev * pow(p_persist, uDt * 60.0) * 0.9);
  fragColor = vec4(toSrgb(c), 1.0);
}` }]
});
