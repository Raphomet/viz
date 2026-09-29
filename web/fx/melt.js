// Melt: colour that melts, after LEXSAN scene 9 (docs/research/2026-09-28-
// lexsan-takeaways.md: "the way the colours morph into each other ... looks
// non-javascript, very After Effects-y"). The frame keeps its light and its
// hue structure, but its colours are drawn from a palette that is always on
// its way to the next one. Everything is blended in OKLab / OKLCH, where equal
// steps look equal, so one colour flows into the next through believable
// in-betweens instead of the muddy greys and neon detours of RGB or HSB.
//
// Not a gradient map (that is `gradmap`, a fixed ramp by luminance): here the
// palette is a loop of four inks that slides through the image's tones, and
// the loop itself morphs from one designed palette to another. Each bar (or
// every n bars) picks the next target and the glide to it takes the whole
// step, so something is always changing and nothing ever switches. The flow
// runs on time and on the beat, surging on each beat and easing off, so a
// busy track melts faster. Keep lets the source's own hues through.
(function () {
  // Designed palettes, four inks each, a loop in the order given. Limited
  // palettes rather than a spectrum (TASTE.md: range, not a house style).
  var PALETTES = [
    ['#2a0a05', '#c2410c', '#ff9f1c', '#ffe3b3'],   // tangerine ink (LEXSAN 9)
    ['#04293a', '#0f7c80', '#7fd1b9', '#f4e9cd'],   // lagoon
    ['#1f2a6b', '#ff4fa3', '#ffd23f', '#f3efe6'],   // riso: blue, fluoro pink, yellow, paper
    ['#2d3a1f', '#7a8b3a', '#d9a441', '#b5543a'],   // moss and clay
    ['#2b1b3f', '#7b3f8c', '#e0777d', '#f7c59f'],   // dusk
    ['#0d1b3e', '#3552a3', '#c9a227', '#efe6d0'],   // indigo and gold
    ['#3b0d2e', '#a4133c', '#ff758f', '#ffd6e0'],   // rose madder
    ['#10302b', '#e76f51', '#f4a261', '#2a9d8f']    // teal and terracotta
  ];

  // sRGB hex to OKLab (Björn Ottosson's matrices), done once here so the
  // shader carries constants instead of converting 64 colours per pixel.
  function oklab(hex) {
    var v = [1, 3, 5].map(function (i) {
      var c = parseInt(hex.substr(i, 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var l = Math.cbrt(0.4122214708 * v[0] + 0.5363325363 * v[1] + 0.0514459929 * v[2]);
    var m = Math.cbrt(0.2119034982 * v[0] + 0.6806995451 * v[1] + 0.1073969566 * v[2]);
    var s = Math.cbrt(0.0883024619 * v[0] + 0.2817188376 * v[1] + 0.6299787005 * v[2]);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  var N = PALETTES.length;
  var table = [];
  PALETTES.forEach(function (p) { p.forEach(function (h) {
    table.push('vec3(' + oklab(h).map(function (x) { return x.toFixed(5); }).join(', ') + ')');
  }); });

  VIZ_FX.register({
    id: 'melt',
    name: 'Melt',
    group: 'colour',
    params: [
      { key: 'amount', label: 'Amount', min: 0, max: 1, default: 1 },
      { key: 'flow', label: 'Flow', min: 0, max: 1, default: 0.4 },
      { key: 'every', label: 'New palette every n bars', min: 1, max: 8, step: 1, default: 2 },
      { key: 'keep', label: 'Keep source hue', min: 0, max: 1, default: 0.2 },
      { key: 'spread', label: 'Bands', min: 0.25, max: 3, default: 1 },
      { key: 'tone', label: 'Palette tone', min: 0, max: 1, default: 0.45 }
    ],
    passes: [{ frag: `
const int NPAL = ${N};
const vec3 PAL[${N * 4}] = vec3[](${table.join(', ')});
vec3 linToOklab(vec3 c) {
  float l = pow(max(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 0.0), 1.0 / 3.0);
  float m = pow(max(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 0.0), 1.0 / 3.0);
  float s = pow(max(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 0.0), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
float ease(float x) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }
// Blend two OKLab colours through OKLCH (hue the short way round), falling
// back to a straight OKLab line when either is nearly grey and has no hue to
// travel along.
vec3 morph(vec3 a, vec3 b, float t) {
  float ca = length(a.yz), cb = length(b.yz);
  float ha = atan(a.z, a.y), hb = atan(b.z, b.y);
  float dh = mod(hb - ha + 3.14159265, 6.2831853) - 3.14159265;
  float h = ha + dh * t, c = mix(ca, cb, t);
  vec3 lch = vec3(mix(a.x, b.x, t), c * cos(h), c * sin(h));
  return mix(mix(a, b, t), lch, smoothstep(0.02, 0.07, min(ca, cb)));
}
int pick(float stepIdx) { return int(floor(hash12(vec2(stepIdx, 4.7)) * float(NPAL) * 0.999)); }
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  vec3 lab = linToOklab(toLinear(src));
  float Ls = lab.x, Cs = length(lab.yz), hs = atan(lab.z, lab.y);

  // Palette targets step every n bars; the glide to the next fills the step.
  float beats = uBeatIndex + uBeat;
  float every = max(1.0, floor(p_every + 0.5)) * 4.0;
  float stepIdx = floor(beats / every);
  float m = ease(fract(beats / every));
  int pa = pick(stepIdx), pb = pick(stepIdx + 1.0);
  // A repeat pick would stall the melt for a whole step; step past it.
  if (pb == pa) pb = (pa + 1 + int(mod(stepIdx, 3.0))) % NPAL;

  // Flow: where in the loop each tone sits. Time keeps it moving; each beat
  // adds a surge that eases off; bass swells it.
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float surge = uBeatIndex + 1.0 - pow(1.0 - uBeat, 3.0);
  float phase = p_flow * (uTime * 0.035 + surge * 0.05) + 0.04 * p_flow * bass;
  float hueWeight = smoothstep(0.02, 0.1, Cs);
  float x = fract(Ls * p_spread + hs / 6.2831853 * 0.35 * hueWeight + phase) * 4.0;
  int i0 = int(floor(x)) % 4, i1 = (i0 + 1) % 4;
  float f = smoothstep(0.0, 1.0, fract(x));
  vec3 A = mix(PAL[pa * 4 + i0], PAL[pa * 4 + i1], f);
  vec3 B = mix(PAL[pb * 4 + i0], PAL[pb * 4 + i1], f);
  vec3 P = morph(A, B, m);

  // Light comes mostly from the source, so the picture stays legible; the
  // palette's own tone joins in only where there is light to recolour, so
  // blacks stay black and light on black keeps its ground.
  float Lp = P.x;
  float Lo = mix(Ls, Lp, p_tone * smoothstep(0.1, 0.45, Ls));
  float Cp = length(P.yz), hp = atan(P.z, P.y);
  float dh = mod(hs - hp + 3.14159265, 6.2831853) - 3.14159265;
  float k = p_keep * hueWeight;
  float h = hp + dh * k;
  float C = mix(Cp, Cs, k) * clamp(Lo / max(Lp, 0.05), 0.0, 1.2);
  vec3 lin = oklabToLin(vec3(Lo, C * cos(h), C * sin(h)));
  vec3 outc = toSrgb(max(lin, 0.0));
  fragColor = vec4(mix(src, outc, p_amount), 1.0);
}` }]
  });
})();
