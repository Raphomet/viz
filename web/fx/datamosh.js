// Datamosh: the motion of the new frame applied to the surface of the old one.
// A codec that loses its keyframes keeps moving the previous picture's pixels
// by the new motion vectors, so a scene melts and drags; LEXSAN's "keep the
// motion, swap the surface" (docs/research/2026-09-28-lexsan-set.md).
//
// Motion is estimated by block matching at 1/8 size: for each point, the
// offset (within three texels, 24 px at full size) whose 3x3 patch in the last
// frame best matches this frame's, with a small bias toward no motion so flat
// areas, where every offset matches, stay put instead of jittering. The
// vectors are smoothed and then read in blocks (the codec's macroblocks) and
// used to drag last frame's output. A trickle of the live frame keeps the
// picture from rotting forever, and a keyframe on the bar, eased in over a
// few frames rather than cut, brings it back to clean and lets it melt again.
VIZ_FX.register({
  id: 'datamosh',
  name: 'Datamosh',
  group: 'time',
  params: [
    { key: 'amount', label: 'Drag', min: 0, max: 3, default: 1.4 },
    { key: 'block', label: 'Block size', min: 0, max: 1, default: 0.35 },
    { key: 'leak', label: 'Live leak', min: 0, max: 0.3, default: 0.05 },
    { key: 'keyframe', label: 'Keyframe every n beats (0 = never)', min: 0, max: 16, step: 1, default: 4 },
    { key: 'kick', label: 'Kick drag', min: 0, max: 1, default: 0.5 },
    { key: 'bleed', label: 'Colour bleed', min: 0, max: 1, default: 0.3 }
  ],
  history: 2,
  historyScale: 1 / 8,
  passes: [
    // 0: motion vectors (xy, in uv) and match confidence (z).
    { scale: 1 / 8, frag: `
float lum(vec2 uv, int n) { return luma(histFrame(uv, n).rgb); }
void main() {
  vec2 t = 1.0 / vec2(textureSize(uHist, 0).xy);
  float cur[9];
  for (int j = 0; j < 9; j++) cur[j] = lum(vUv + vec2(float(j % 3 - 1), float(j / 3 - 1)) * t, 0);
  float best = 1e9, zero = 0.0;
  vec2 bestO = vec2(0.0);
  for (int oy = -3; oy <= 3; oy++) for (int ox = -3; ox <= 3; ox++) {
    vec2 o = vec2(float(ox), float(oy));
    float sad = 0.0;
    for (int j = 0; j < 9; j++) sad += abs(cur[j] - lum(vUv + (o + vec2(float(j % 3 - 1), float(j / 3 - 1))) * t, 1));
    if (ox == 0 && oy == 0) zero = sad;
    sad += 0.02 * length(o);
    if (sad < best) { best = sad; bestO = o; }
  }
  // How much better than standing still the match is: little gain, no motion.
  float conf = smoothstep(0.05, 0.25, zero - best);
  fragColor = vec4(bestO * t * conf, conf, 1.0);
}` },
    // 1: smoothed vectors.
    { scale: 1 / 8, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uPass0, 0));
  vec3 s = vec3(0.0);
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    float w = 1.0 / (1.0 + float(x * x + y * y));
    s += vec3(texture(uPass0, vUv + vec2(float(x), float(y)) * t).xy, 1.0) * w;
  }
  fragColor = vec4(s.xy / s.z, 0.0, 1.0);
}` },
    { frag: `
void main() {
  vec3 live = texture(uInput, vUv).rgb;
  // Macroblocks from 8 to 64 px at 1080 lines; zero reads the smooth field.
  float bpx = mix(8.0, 64.0, p_block) * uRes.y / 1080.0;
  vec2 q = p_block > 0.02 ? (floor(vUv * uRes / bpx) + 0.5) * bpx / uRes : vUv;
  vec2 mv = texture(uPass1, q).xy;
  float drag = p_amount * (1.0 + p_kick * 1.5 * uKick);
  // Whole pixels only: a fractional shift re-filters the surface every frame,
  // and on the first try that blurred a slow smoke scene to mush within a
  // second. Integer moves keep the dragged surface crisp, as a codec's do.
  vec2 from = vUv + floor(mv * drag * uRes + 0.5) / uRes;
  vec3 moshed = texture(uPrev, from).rgb;
  // Colour bleed: the dragged surface smears its own chroma a little further
  // along the motion, the way mosh colour runs ahead of the luma.
  vec3 ahead = texture(uPrev, from + floor(mv * drag * uRes + 0.5) / uRes).rgb;
  moshed = mix(moshed, vec3(luma(moshed)) + (ahead - vec3(luma(ahead))), p_bleed * 0.5);
  // Keyframe: the live frame eased back in over a fifth of a beat, then let go.
  float every = floor(p_keyframe + 0.5);
  float key = 0.0;
  if (every > 0.5) {
    float local = mod(uBeatIndex, every) + uBeat;
    key = smoothstep(0.0, 0.1, local) * (1.0 - smoothstep(0.1, 0.25, local));
  }
  float keep = pow(1.0 - p_leak, uDt * 60.0);
  float r = max(1.0 - keep, key * 0.5);
  // Before anything has been drawn uPrev is black; start from the frame.
  if (uTime < 0.1) r = 1.0;
  fragColor = vec4(mix(moshed, live, r), 1.0);
}` }
  ]
});
