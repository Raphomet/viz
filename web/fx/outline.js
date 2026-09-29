// Outline: edges found on colour difference, not luminance alone, so two
// poster colours of equal brightness still get a line between them. Ink draws
// the lines on paper; Lit shows nothing but the lines, in the scene's colour
// on black; Over inks them onto the image, like a comic. The edge map is made
// at half size (a Sobel with its taps spaced by the line weight) and read back
// bilinearly, which makes the lines smooth and cheap. Music: the bass swells
// the line weight; hats drop the threshold so fine detail sparkles in.
VIZ_FX.register({
  id: 'outline',
  name: 'Outline',
  group: 'texture',
  params: [
    { key: 'mode', label: 'Ink / lit / over', min: 0, max: 2, step: 1, default: 0 },
    { key: 'weight', label: 'Line weight', min: 0.5, max: 4, default: 1.2 },
    { key: 'threshold', label: 'Threshold', min: 0.02, max: 0.6, default: 0.14 },
    { key: 'colour', label: 'Colour', min: 0, max: 1, default: 0.3 },
    { key: 'swell', label: 'Bass weight', min: 0, max: 1, default: 0.5 },
    { key: 'hat', label: 'Hat detail', min: 0, max: 1, default: 0.5 }
  ],
  passes: [
    // 0: half size. rgb: the local colour, a: edge strength.
    { scale: 1 / 2, frag: `
void main() {
  float aspect = uRes.x / uRes.y;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float s = p_weight * (1.0 + p_swell * 0.8 * bass) / 720.0;
  vec2 d = vec2(s / aspect, s);
  vec3 tl = texture(uInput, vUv + vec2(-d.x,  d.y)).rgb, tc = texture(uInput, vUv + vec2(0.0, d.y)).rgb, tr = texture(uInput, vUv + d).rgb;
  vec3 ml = texture(uInput, vUv + vec2(-d.x, 0.0)).rgb, mc = texture(uInput, vUv).rgb, mr = texture(uInput, vUv + vec2(d.x, 0.0)).rgb;
  vec3 bl = texture(uInput, vUv - d).rgb, bc = texture(uInput, vUv + vec2(0.0, -d.y)).rgb, br = texture(uInput, vUv + vec2(d.x, -d.y)).rgb;
  // sqrt lifts dark detail: on a dark scene the sRGB differences are tiny.
  tl = sqrt(max(tl, 0.0)); tc = sqrt(max(tc, 0.0)); tr = sqrt(max(tr, 0.0)); ml = sqrt(max(ml, 0.0)); mr = sqrt(max(mr, 0.0));
  bl = sqrt(max(bl, 0.0)); bc = sqrt(max(bc, 0.0)); br = sqrt(max(br, 0.0));
  vec3 gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  vec3 gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  float e = sqrt(dot(gx, gx) + dot(gy, gy)) * 0.25;
  vec3 c = (tl + tc + tr + ml + mr + bl + bc + br) / 8.0;
  c = mix(c * c, mc, 0.5);
  fragColor = vec4(c, e);
}` },
    { frag: `
void main() {
  vec4 E = texture(uPass0, vUv);
  vec3 c = clamp(E.rgb, 0.0, 1.0);
  float th = p_threshold * (1.0 - 0.45 * uHat * p_hat);
  float line = smoothstep(th, th * 1.6 + 0.02, E.a);
  int mode = int(floor(p_mode + 0.5));
  float mx = max(c.r, max(c.g, c.b));
  vec3 hue = c / max(mx, 0.05);
  vec3 outc;
  if (mode == 0) {
    vec3 paper = vec3(0.95, 0.93, 0.88);
    vec3 ink = mix(vec3(0.09, 0.09, 0.11), hue * 0.55, p_colour);
    outc = mix(paper, ink, line);
  } else if (mode == 1) {
    vec3 lit = mix(vec3(0.95, 0.96, 0.92), hue, p_colour);
    outc = lit * line;
  } else {
    vec3 src = texture(uInput, vUv).rgb;
    vec3 ink = mix(vec3(0.05, 0.05, 0.07), hue * 0.3, p_colour);
    outc = mix(src, ink, line);
  }
  fragColor = vec4(outc, 1.0);
}` }
  ]
});
