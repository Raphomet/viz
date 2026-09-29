// VHS: a worn tape on a tired deck. Luma is softened along the line with a
// little edge ringing; chroma (YIQ) is bandwidth-starved, so colour bleeds to
// the right of what it belongs to. Lines wobble sideways (tracking), a
// tracking band drifts slowly up the frame, the bottom few lines tear where
// the heads switch, and dropouts (short white streaks where the oxide is
// gone) scatter across a few lines.
//
// Music: bass widens the wobble; dropouts land on the kick, a new set of
// lines each beat, fading with the envelope; the snare kicks the tracking
// band. All of it is confined to lines and bands, never the whole frame.
VIZ_FX.register({
  id: 'vhs',
  name: 'VHS',
  group: 'texture',
  params: [
    { key: 'tracking', label: 'Tracking', min: 0, max: 1, default: 0.35 },
    { key: 'bleed', label: 'Chroma bleed', min: 0, max: 1, default: 0.55 },
    { key: 'soft', label: 'Softness', min: 0, max: 1, default: 0.45 },
    { key: 'headswitch', label: 'Head switch', min: 0, max: 1, default: 0.6 },
    { key: 'dropouts', label: 'Dropouts', min: 0, max: 1, default: 0.5 },
    { key: 'tape', label: 'Tape wear', min: 0, max: 1, default: 0.4 }
  ],
  passes: [{ frag: `
vec3 toYiq(vec3 c) { return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c; }
vec3 fromYiq(vec3 y) { return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * y; }
float vnoise(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash12(vec2(i, 1.3)), hash12(vec2(i + 1.0, 1.3)), f) * 2.0 - 1.0; }

void main() {
  // About 480 lines, whatever the output size.
  float lineH = max(1.0, uRes.y / 480.0);
  float line = floor(gl_FragCoord.y / lineH);
  float frame = floor(uTime * 30.0);
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float y = vUv.y;

  // Tracking: slow per-line wobble plus a band that drifts up the frame.
  float wob = vnoise(line * 0.045 + uTime * 1.3) * 0.0012 + (hash12(vec2(line, frame)) - 0.5) * 0.0006;
  float bandY = fract(uTime * 0.035 + 0.3);
  float bandW = 0.05 + 0.03 * uSnare;
  float inBand = smoothstep(bandW, 0.0, abs(y - bandY));
  float xo = p_tracking * (wob * (1.0 + 2.5 * bass) + inBand * (0.004 + 0.02 * uSnare) * (hash12(vec2(line, frame + 3.0)) - 0.3));

  // Head switching: the bottom lines tear sideways, worst at the very bottom.
  float hs = smoothstep(0.035, 0.0, y);
  xo += p_headswitch * hs * hs * (0.03 + 0.02 * vnoise(line * 0.3 + frame));

  vec2 uv = vec2(vUv.x + xo, vUv.y);
  float px = 1.0 / uRes.x;

  // Luma: a soft horizontal kernel, and a hint of ringing (the deck's sharpening).
  float s = 1.0 + 3.0 * p_soft;
  float Y0 = toYiq(texture(uInput, uv).rgb).x;
  float Yb = 0.0;
  for (int i = -2; i <= 2; i++) Yb += toYiq(texture(uInput, uv + vec2(float(i) * s * px * lineH, 0.0)).rgb).x * (i == 0 ? 0.3 : (abs(i) == 1 ? 0.2 : 0.15));
  float Yw = toYiq(texture(uInput, uv + vec2(-s * 3.0 * px * lineH, 0.0)).rgb).x;
  float Y = mix(Y0, Yb, p_soft) + (Yb - Yw) * 0.18 * p_soft;

  // Chroma: a wide kernel, trailing to the right.
  vec2 iq = vec2(0.0);
  float wsum = 0.0;
  float span = (2.0 + 10.0 * p_bleed) * px * lineH;
  for (int i = 0; i < 8; i++) {
    float w = 1.0 - float(i) / 8.0;
    iq += toYiq(texture(uInput, uv - vec2((float(i) - 1.5) * span, 0.0)).rgb).yz * w;
    wsum += w;
  }
  iq /= wsum;
  vec3 yiq = vec3(Y, mix(toYiq(texture(uInput, uv).rgb).yz, iq, min(1.0, p_bleed * 1.4)));

  // Tape wear: chroma fades a little, blacks lift, fine noise in the lines.
  yiq.yz *= 1.0 - 0.3 * p_tape;
  yiq.x = mix(yiq.x, 0.06 + yiq.x * 0.9, p_tape);
  yiq.x += (hash12(vec2(gl_FragCoord.x * 0.5, line + frame * 7.0)) - 0.5) * 0.06 * p_tape;
  yiq.x += hs * p_headswitch * (hash12(vec2(floor(gl_FragCoord.x / 3.0), line + frame)) - 0.5) * 0.25;

  vec3 c = fromYiq(yiq);

  // Dropouts: a new set of lines each beat, lit by the kick; a few stray
  // ones always. Each is a short white streak with a ragged tail.
  float beat = uBeatIndex;
  float dropLine = floor(line / 2.0);
  float hLine = hash12(vec2(dropLine, beat * 1.9 + 0.7));
  float x0 = hash12(vec2(dropLine, beat + 4.0));
  float len = 0.04 + 0.2 * hash12(vec2(dropLine, beat + 8.0));
  float along = (vUv.x - x0) / len;
  float on = step(0.0, along) * step(along, 1.0) * (1.0 - along * along);
  on *= 0.55 + 0.45 * hash12(vec2(floor(gl_FragCoord.x / (3.0 * lineH)), dropLine + frame));
  float lit = step(hLine, 0.02 * p_dropouts) * uKick + step(hash12(vec2(dropLine, frame)), 0.0015 * p_dropouts);
  c = mix(c, vec3(0.92 + 0.08 * hash12(gl_FragCoord.xy + frame)), clamp(on * lit, 0.0, 1.0) * 0.9);

  fragColor = vec4(max(c, 0.0), 1.0);
}` }]
});
