// Pixelate: the frame as flat blocks. Each block's colour is the average of
// its area (four taps into a quarter-size copy), not one pixel, so moving
// detail does not sparkle. Jitter lets each block sample a slowly wandering
// spot nearby, so the grid swims. The kick coarsens one region only: each
// beat picks a rectangle, snapped to the coarsest grid, whose blocks grow up
// to 4x on the kick and step back down as the envelope decays (TASTE.md: the
// kick lands in part of the image). Grout draws the gaps of a tile mosaic.
VIZ_FX.register({
  id: 'pixelate',
  name: 'Pixelate',
  group: 'texture',
  params: [
    { key: 'blocks', label: 'Blocks', min: 8, max: 180, step: 1, default: 54 },
    { key: 'jitter', label: 'Jitter', min: 0, max: 1, default: 0.2 },
    { key: 'kick', label: 'Kick coarsen', min: 0, max: 1, default: 0.7 },
    { key: 'grout', label: 'Grout', min: 0, max: 1, default: 0 }
  ],
  passes: [
    { scale: 1 / 4, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = texture(uInput, vUv + vec2(-t.x, -t.y)).rgb + texture(uInput, vUv + vec2(t.x, -t.y)).rgb +
           texture(uInput, vUv + vec2(-t.x,  t.y)).rgb + texture(uInput, vUv + vec2(t.x,  t.y)).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}` },
    { frag: `
void main() {
  vec2 px = vUv * uRes;
  float bs = uRes.y / floor(p_blocks + 0.5);
  // This beat's region, in whole 4x blocks.
  float b = uBeatIndex;
  vec2 rc = vec2(0.15, 0.2) + vec2(0.7, 0.6) * vec2(hash12(vec2(b, 1.3)), hash12(vec2(b, 7.9)));
  vec2 rs = (0.12 + 0.16 * vec2(hash12(vec2(b, 3.1)), hash12(vec2(b, 5.3)))) * uRes.y;
  float big = bs * 4.0;
  vec2 lo = floor((rc * uRes - rs) / big) * big, hi = ceil((rc * uRes + rs) / big) * big;
  float inR = step(lo.x, px.x) * step(px.x, hi.x) * step(lo.y, px.y) * step(px.y, hi.y);
  float f = 1.0 + floor(p_kick * 3.0 * uKick + 0.5) * inR;
  float s = bs * f;
  vec2 bid = floor(px / s);
  vec2 centre = (bid + 0.5) * s;
  vec2 h = vec2(hash12(bid * 1.7 + f), hash12(bid * 2.3 + 9.1 + f));
  centre += p_jitter * s * 1.2 * vec2(sin(uTime * 0.8 + h.x * 6.283), cos(uTime * 0.7 + h.y * 6.283));
  vec2 o = vec2(s * 0.25) / uRes, cu = centre / uRes;
  vec3 c = 0.25 * (texture(uPass0, mirrorUv(cu + vec2(-o.x, -o.y))).rgb + texture(uPass0, mirrorUv(cu + vec2(o.x, -o.y))).rgb +
                   texture(uPass0, mirrorUv(cu + vec2(-o.x,  o.y))).rgb + texture(uPass0, mirrorUv(cu + vec2(o.x,  o.y))).rgb);
  vec2 g = fract(px / s);
  float e = min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y)) * s;
  float gw = p_grout * s * 0.1;
  float grout = step(0.01, p_grout) * (1.0 - smoothstep(gw - 0.6, gw + 0.6, e));
  // Grout darkens light tiles and lightens dark ones, so it shows on both.
  vec3 gc = luma(c) > 0.35 ? c * 0.35 : c * 0.4 + 0.18;
  fragColor = vec4(mix(c, gc, grout), 1.0);
}` }
  ]
});
