// Wipe: hard-edged transitions on the bar, after the LEXSAN diamond loop
// (docs/research/2026-09-28-lexsan-set.md, #14): dark polygon panels slide in
// and cover the picture just before the downbeat, then on the downbeat it is
// revealed again, either by the panels sliding on out of the frame or by a
// shape building out from a point as stacked red, green and blue copies
// sweeping outward with an ease-out.
//
// Everything is a function of the beat clock, so the wipe is a transition the
// performer times with the Every knob, not a flash: the frame is fully
// covered for an instant at most, once every bar by default.
VIZ_FX.register({
  id: 'wipe',
  name: 'Wipe',
  group: 'time',
  params: [
    { key: 'every', label: 'Every n beats', min: 1, max: 16, step: 1, default: 4 },
    { key: 'length', label: 'Wipe length (beats)', min: 0.25, max: 2, default: 0.75 },
    { key: 'reveal', label: 'Reveal (panels, build, alternate)', min: 0, max: 2, step: 1, default: 2 },
    { key: 'panels', label: 'Panels', min: 1, max: 12, step: 1, default: 5 },
    { key: 'angle', label: 'Panel angle', min: 0, max: 1, default: 0.1 },
    { key: 'amount', label: 'Panels that move', min: 0, max: 1, default: 1 },
    { key: 'sides', label: 'Build sides', min: 3, max: 8, step: 1, default: 4 },
    { key: 'copies', label: 'Build copies spread', min: 0, max: 1, default: 0.5 },
    { key: 'cover', label: 'Cover (navy to graded frame)', min: 0, max: 1, default: 0.3 }
  ],
  passes: [{ frag: `
float easeOut(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
float easeIn(float x) { x = clamp(x, 0.0, 1.0); return x * x * x; }
float polyDist(vec2 p, float n, float rot) {
  // Distance to a regular n-gon's edge, in units of its apothem.
  float a = atan(p.y, p.x) + rot;
  float seg = 6.28318530718 / n;
  return cos(floor(0.5 + a / seg) * seg - a) * length(p);
}
// Panel coverage for progress t (0 to 1): slides in from alternate ends when
// entering, then carries on out the far side when leaving.
float panels(vec2 uv, float t, bool leaving, float g) {
  float aspect = uRes.x / uRes.y;
  float ang = (p_angle + (hash12(vec2(g, 3.1)) - 0.5) * 0.08) * 3.14159265;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 d = vec2(cos(ang), sin(ang));
  float along = dot(p, d), across = dot(p, vec2(-d.y, d.x));
  float span = 0.5 * (aspect * abs(d.x) + abs(d.y)) + 0.05;   // half the frame, along d
  float spanX = 0.5 * (aspect * abs(d.y) + abs(d.x)) + 0.05;
  float n = floor(p_panels + 0.5);
  float i = floor((across / spanX * 0.5 + 0.5) * n);
  if (hash12(vec2(i, g * 1.7 + 0.3)) > p_amount) return 0.0;
  // Staggered starts, so the panels arrive one after another.
  float lag = hash12(vec2(i * 2.3, g)) * 0.35;
  float k = clamp((t - lag) / (1.0 - 0.35), 0.0, 1.0);
  float fromLeft = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
  float x = along * fromLeft / span * 0.5 + 0.5;              // 0 at the entry edge
  float aa = 1.5 / uRes.y / span;
  if (!leaving) return 1.0 - smoothstep(easeIn(k) - aa, easeIn(k) + aa, x);
  return smoothstep(easeOut(k) - aa, easeOut(k) + aa, x);
}
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  float every = floor(p_every + 0.5);
  float pos = uBeatIndex + uBeat;
  float g = floor(pos / every);
  float local = pos - g * every;                                // beats into this period
  float len = min(p_length, every * 0.5);
  float aspect = uRes.x / uRes.y;

  // The cover: flat navy, or the frame itself pressed dark into navy.
  vec3 navy = vec3(0.035, 0.05, 0.16);
  vec3 cover = mix(navy, navy + vec3(0.1, 0.12, 0.35) * luma(c), p_cover);
  vec3 outc = c;

  if (local > every - len) {
    // Panels slide in, covering fully on the downbeat.
    float cov = panels(vUv, (local - (every - len)) / len, false, g + 1.0);
    outc = mix(c, cover, cov);
  } else if (local < len) {
    int mode = int(floor(p_reveal + 0.5));
    if (mode == 2) mode = mod(g, 2.0) < 0.5 ? 0 : 1;
    float t = local / len;
    if (mode == 0) {
      outc = mix(c, cover, panels(vUv, t, true, g));
    } else {
      // Build: from a point chosen per bar, an n-gon grows out with an
      // ease-out; the two copies ahead of it show only the red, then the green
      // of a slightly larger copy of the frame, so the edge sweeps as a stack.
      vec2 pt = vec2(0.25 + 0.5 * hash12(vec2(g, 9.2)), 0.3 + 0.4 * hash12(vec2(g, 4.7)));
      vec2 p = (vUv - pt) * vec2(aspect, 1.0);
      float rot = hash12(vec2(g, 1.9)) * 6.28318;
      float dist = polyDist(p, floor(p_sides + 0.5), rot);
      float r = easeOut(t) * (aspect + 0.6);
      float gap = (0.02 + 0.08 * p_copies) * (1.0 - t * 0.5);
      float aa = 1.5 / uRes.y;
      float inner = 1.0 - smoothstep(r - 2.0 * gap - aa, r - 2.0 * gap + aa, dist);
      float midB = 1.0 - smoothstep(r - gap - aa, r - gap + aa, dist);
      float outer = 1.0 - smoothstep(r - aa, r + aa, dist);
      vec3 c1 = texture(uInput, pt + (vUv - pt) / (1.0 + gap)).rgb;
      vec3 c2 = texture(uInput, pt + (vUv - pt) / (1.0 + 2.0 * gap)).rgb;
      // A floor of colour, so the copies read on a dark frame as well as on paper.
      vec3 red = cover + vec3(0.3 + c2.r * 0.7, 0.0, 0.05);
      vec3 green = cover + vec3(0.0, 0.25 + c1.g * 0.7, 0.1 + c1.b * 0.25);
      // Only what the panels covered is built back (Panels that move < 1).
      float was = panels(vUv, 1.0, false, g);
      vec3 base = mix(c, cover, was);
      red = mix(c, red, was);
      green = mix(c, green, was);
      outc = mix(base, red, outer);
      outc = mix(outc, green, midB);
      outc = mix(outc, c, inner);
    }
  }
  fragColor = vec4(outc, 1.0);
}` }]
});
