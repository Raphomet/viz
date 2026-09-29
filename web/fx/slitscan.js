// Slit-scan: time smeared across space, row by row or column by column.
// Two ways of doing it, both on uPrev so the record reaches as far back as the
// frame is wide (a 32-frame history would give half a second):
//
// Scan: a slit sweeps across the frame, once every few beats, and only where
// it passes is the picture brought up to date; everything else keeps the
// moment the slit last crossed it. Still things look still; anything that
// moves is sheared and stretched by the sweep (the "time warp scan"). The
// sweep never jumps back to a live frame, so there is no full-frame cut.
//
// Stream: a fixed slit, and the record flows away from it a whole number of
// pixels a frame (fractional shifts would re-filter, and so blur, the record
// every frame). The side before the slit stays live; after it, one line of the
// picture is drawn out over time, the photo-finish camera. The kick surges the
// flow, so the beat shows as a burst of speed in the streaks.
VIZ_FX.register({
  id: 'slitscan',
  name: 'Slit-scan',
  group: 'time',
  params: [
    { key: 'mode', label: 'Mode (scan, stream)', min: 0, max: 1, step: 1, default: 0 },
    { key: 'direction', label: 'Direction (right, left, down, up, out)', min: 0, max: 4, step: 1, default: 0 },
    { key: 'sweep', label: 'Beats per sweep', min: 1, max: 16, step: 1, default: 4 },
    { key: 'width', label: 'Slit width', min: 0, max: 1, default: 0.15 },
    { key: 'speed', label: 'Stream speed', min: 0.02, max: 1, default: 0.25 },
    { key: 'position', label: 'Slit position', min: 0, max: 1, default: 0.5 },
    { key: 'line', label: 'Slit line', min: 0, max: 1, default: 0.4 },
    { key: 'live', label: 'Live leak', min: 0, max: 1, default: 0 },
    { key: 'kick', label: 'Kick surge', min: 0, max: 1, default: 0.5 }
  ],
  passes: [{ frag: `
void main() {
  int dir = int(floor(p_direction + 0.5));
  bool vertical = dir == 2 || dir == 3;
  // a: position along the scan (0 where it starts, 1 where it ends).
  float a = vertical ? 1.0 - vUv.y : vUv.x;          // down is decreasing uv.y
  if (dir == 1 || dir == 3) a = 1.0 - a;
  if (dir == 4) a = abs(vUv.x - 0.5) * 2.0;
  vec3 live = texture(uInput, vUv).rgb;
  vec3 outc;
  float lineMask = 0.0;
  float px = 1.0 / (vertical ? uRes.y : uRes.x) * (dir == 4 ? 2.0 : 1.0);

  if (p_mode < 0.5) {
    float beats = floor(p_sweep + 0.5);
    float L = fract((uBeatIndex + uBeat) / beats);
    // At least two frames' travel wide, so the slit leaves no unwritten gaps.
    float w = max(p_width * 0.25, 2.2 / (beats * 30.0));
    float behind = L - a;
    if (behind < 0.0) behind += 1.0;                  // the wrap back to the start
    float write = 1.0 - smoothstep(w * 0.6, w, behind);
    vec3 rec = texture(uPrev, vUv).rgb;
    rec = mix(rec, live, p_live * 0.08);
    outc = mix(rec, live, write);
    // Only on the side the slit overwrites, so the line never enters the record.
    lineMask = 1.0 - smoothstep(0.0, 3.0 * px, behind);
  } else {
    // Whole pixels a frame, per 60 Hz frame.
    float shiftPx = floor(p_speed * 0.02 * (1.0 + p_kick * 2.0 * uKick) * (vertical ? uRes.y : uRes.x) * uDt * 60.0 + 0.5);
    shiftPx = max(shiftPx, 1.0);
    float s0 = dir == 4 ? 0.0 : p_position;
    if (a < s0) {
      outc = live;
    } else {
      float along = (a - s0) / px;                     // pixels past the slit
      if (along < shiftPx) {
        // The newest strip: the picture at the slit, stretched over the shift.
        vec2 uv = vUv;
        float slitA = s0 + 0.5 * px;
        if (dir == 4) uv.x = 0.5 + sign(vUv.x - 0.5) * slitA * 0.5;
        else {
          float c = (dir == 1 || dir == 3) ? 1.0 - slitA : slitA;
          if (vertical) uv.y = 1.0 - c; else uv.x = c;
        }
        outc = texture(uInput, uv).rgb;
      } else {
        vec2 back = vec2(0.0);
        vec2 texel = 1.0 / uRes;
        if (dir == 0) back.x = -shiftPx * texel.x;
        else if (dir == 1) back.x = shiftPx * texel.x;
        else if (dir == 2) back.y = shiftPx * texel.y;
        else if (dir == 3) back.y = -shiftPx * texel.y;
        else back.x = -sign(vUv.x - 0.5) * shiftPx * texel.x;
        outc = texture(uPrev, vUv + back).rgb;
      }
      outc = mix(outc, live, p_live * 0.08);
    }
    // On the live side only: drawn on the record side it would stream away.
    lineMask = dir == 4 ? 0.0 : (1.0 - smoothstep(0.0, 3.0 * px, s0 - a)) * step(a, s0);
  }
  // The slit drawn as a thin inverted line, visible on black and on paper.
  outc = mix(outc, 1.0 - clamp(outc, 0.0, 1.0), lineMask * p_line * 0.8);
  fragColor = vec4(outc, 1.0);
}` }]
});
