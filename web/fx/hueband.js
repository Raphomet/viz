// Hue band: the frame's hue turned by one band of the spectrum. The rotation
// happens in Oklab, so lightness is untouched and a hue turn never reads as
// a brightness pulse. Range sets how far a full band can turn it (1 is half
// the wheel; the default reaches about a tenth), so it can be a faint warming
// on the bass rather than a rainbow (TASTE.md).
// Spread makes the turn uneven: highlights turn further than shadows, or,
// negative, shadows further than highlights, so the colours separate rather
// than moving in lockstep.
VIZ_FX.register({
  id: 'hueband',
  name: 'Hue by band',
  group: 'colour',
  params: [
    { key: 'band', label: 'Band (0 sub ... 8 air)', min: 0, max: 8, step: 1, default: 1 },
    { key: 'range', label: 'Range', min: 0, max: 1, default: 0.2 },
    { key: 'offset', label: 'Hue offset', min: -0.5, max: 0.5, default: 0 },
    { key: 'spread', label: 'Spread (shadows / highlights)', min: -1, max: 1, default: 0.2 },
    { key: 'chroma', label: 'Chroma', min: 0, max: 2, default: 1 }
  ],
  passes: [{ frag: `
vec3 cbrt3(vec3 x) { return sign(x) * pow(abs(x), vec3(1.0 / 3.0)); }
vec3 toOklab(vec3 c) {
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * cbrt3(lms);
}
vec3 fromOklab(vec3 L) {
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * L;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * (lms * lms * lms);
}
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  int b = int(clamp(floor(p_band + 0.5), 0.0, 8.0));
  float level = uBands[b];
  vec3 lab = toOklab(toLinear(c));
  float w = 1.0 + p_spread * (clamp(lab.x, 0.0, 1.0) - 0.5) * 2.0;
  float ang = 6.28318530718 * (p_offset + 0.5 * p_range * level * w);
  float cs = cos(ang), sn = sin(ang);
  lab.yz = mat2(cs, sn, -sn, cs) * lab.yz * p_chroma;
  fragColor = vec4(toSrgb(max(fromOklab(lab), 0.0)), 1.0);
}` }]
});
