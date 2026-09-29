# The effects rack

Raph (2026-09-28): "I'm interested in seeing the full range of effects we can
render." After studying a professional VJ set (docs/research/2026-09-28-lexsan-set.md)
we saw that most of its richness comes from a small vocabulary of mixer effects
applied to any source: mirror, kaleidoscope, slice displacement, feedback,
colour ramps, lens finish. viz is an instrument (live code, music as input, the
VJ in control, in the browser), so every effect is live GPU code with knobs and
music inputs, never baked footage.

## The interface

An effect is one file, `web/fx/<id>.js`, that registers itself:

```js
VIZ_FX.register({
  id: 'kaleido',
  name: 'Kaleidoscope',
  group: 'space',            // space | time | colour | texture | lens
  params: [                  // same shape as scene params (range only)
    { key: 'segments', label: 'Segments', min: 2, max: 16, step: 1, default: 6 },
    { key: 'spin', label: 'Spin', min: -1, max: 1, default: 0.1 }
  ],
  history: 0,                // frames of past output this effect needs (0-32)
  passes: [                  // run in order; each is one full-screen fragment shader
    { frag: `...GLSL ES 3.00 fragment body...`, scale: 1 }
  ]
});
```

Every pass's fragment shader gets these uniforms (the runner declares them; the
effect's `frag` is the body after the declarations, with `void main()`):

- `sampler2D uSrc` — the previous pass's output (the effect's input for pass 0)
- `sampler2D uScene` — the untouched scene frame
- `sampler2D uPrev` — this effect's own final output from the last frame (feedback)
- `sampler2DArray uHist; int uHistLen; int uHistHead` — the last `history`
  frames of the effect's input, newest at `uHistHead` (time effects)
- `vec2 uRes`, `float uTime`, `float uDt`
- `float uBands[9]` (0-1), `float uKick`, `float uSnare`, `float uHat`
  (0-1 envelopes, from core's detectors for now), `float uBeat` (beat phase 0-1)
- `float p_<key>` for every param
- `in vec2 vUv; out vec4 fragColor;`

### Additions to the interface (2026-09-28, while building the runner)

The runner is `web/fx.js` (`window.VIZ_FX`); `web/fx/kaleido.js`,
`feedback.js` and `slice.js` are the reference effects to copy, and
`bloom.js` shows a many-pass effect. These were added to what is above;
nothing above changed:

- `sampler2D uInput` — this effect's input, in every pass (in pass 0 it is
  the same as `uSrc`).
- `sampler2D uPass0 … uPass11` — this frame's output of the effect's earlier
  passes, by index, so a later pass can combine several (bloom adds each mip
  level on the way up).
- `float uBeatIndex` — whole beats so far, so an effect can change on a beat
  (`slice` seeds its layout from it). `uBeat` is the phase within the beat.
- `uRes` is the size of the pass being drawn, in pixels. Use
  `textureSize(uSrc, 0)` for a texel of the input.
- The **last pass always renders at full size**; its `scale` is ignored.
- Colour convention: every effect's input and output are ordinary
  display-encoded (sRGB) colours, stored in half-float targets, so values may
  go above 1. Work in linear light inside an effect if it matters
  (`toLinear` / `toSrgb`).
- Helpers declared for every pass: `luma(vec3)`, `hash12(vec2)`,
  `toLinear(vec3)`, `toSrgb(vec3)`, `mirrorUv(vec2)` (mirrored repeat, for
  warps that sample outside the frame) and `histFrame(uv, n)` (n frames ago,
  0 = this frame, clamped to what is kept).
- `history` frames are kept at `historyScale` of full size (default 0.5, 8-bit),
  because 32 full-size frames at 3024×1890 would be 730 MB.
- `settle: N` (optional) — for an effect that uses `uPrev` but forgets within N
  frames. The harness then runs the rack only on the N frames before each
  capture instead of on every frame. Without it, an effect using `uPrev` or
  `history` runs every frame in the harness.
- A pass whose shader fails to compile logs once and the effect is skipped
  (passed through), never a black screen.
- `hidden: true` keeps an effect out of the panel's Add list.
- Params may carry `step` (1 for integers); read them as floats and
  `floor(p_x + 0.5)` where you need an integer.
- `mesh: N` on a pass (added with `shatter`) makes it a triangle-mesh pass:
  the runner copies the pass's input (`uSrc`) into its target, then draws `N`
  triangles over it (`gl.drawArrays(TRIANGLES, 0, N * 3)`, no buffers) with
  the pass's `vert` as the vertex shader. `vert` gets the same uniforms and
  helpers as a fragment pass, derives its vertex from `gl_VertexID`, writes
  `gl_Position` and `vUv`, and may declare its own `out` varyings (matched by
  `in` in `frag`). Blending is on for the draw, `fragColor.a` being coverage
  (edge antialiasing); triangles draw in index order, later over earlier, and
  a triangle not wanted this frame is collapsed to a point. Passes without
  `mesh` are unchanged.

Adding an effect: write `web/fx/<id>.js`, add its `<script>` tag to
`web/index.html` in the effects block (alphabetical, after the Finish's three),
and check it with `node harness/render.mjs web/scenes/<scene>.js --fx <id>`
(add `--finish off` to see the effect alone, `--fxparams '{"<id>":{"k":v}}'` to
set params). Try one dark scene and one poster scene.

Effects chain: the rack is an ordered list of effects; each effect's input is
the previous effect's output. The Finish (tone curve, grade, bloom, grain,
vignette, motion blur) is the last stage and is itself built on this interface.

Rules: 60 fps at 3024×1890 for any single effect (render at reduced `scale`
where a pass is soft anyway); no full-frame strobing (TASTE.md), so anything
flash-like is confined to regions or eased; effects must look good on both a
dark scene and a bright poster scene.

## The vocabulary (about 40)

**Space** — mirror (horizontal / vertical / quad), kaleidoscope (n-fold, spin,
centre drift), tile / repeat, polar and log-polar (tunnel), fisheye / lens
warp, turbulent displacement (noise warp), liquid ripple displacement, slice
displacement (bands of the image slide sideways, stepped on the beat), pixel
stretch (edge rows smeared out), infinite zoom (Droste-style recursion of the
frame into itself).

**Time** — feedback (zoom, rotate and fade the last frame under the new one),
echo trails, time displacement (each pixel shows a different past frame, from a
gradient or noise map), slit-scan, stutter / frame hold on the beat, datamosh
(drag the previous frame's pixels along the current frame's motion).

**Colour** — gradient map (luminance through a colour ramp: the ember look),
duotone / riso two-ink, posterize, threshold ink, hue shift by band, invert in a
region on the beat, curves / grade presets, channel swap.

**Texture** — halftone dots, ordered dither (Bayer), ASCII / glyph mosaic,
pixelate, Voronoi mosaic, edge detect / outline, emboss (fake raking light),
Kuwahara (painterly), pixel sort, glitch blocks (JPEG-ish macroblocks),
scanlines / CRT, VHS (tracking wobble, chroma bleed).

**Lens** — RGB split / chromatic aberration, radial blur, zoom blur,
directional (motion) blur, tilt-shift, bloom, halation, grain, vignette,
anamorphic streaks.

## Runner backlog (from the builders, 2026-09-28)

- Effect-owned textures (a 2D canvas, noise, a LUT): `ascii` bakes its glyph
  atlas into a shader constant array as a workaround; `dither` would use real
  blue noise.
- A shared frame-average-brightness uniform (ASCII's Auto style adds its own pass).
- Per-effect GPU timing: `fps.mjs` caps at 60, so it can't show headroom.
- Kick onset history for effects (ripple drops on the beat grid, not actual kicks).
- A budget: all eight space effects plus the Finish chained ran at ~48 fps.
- Per-frame state and tempo for effects (`uBpm`, a small state slot): `stutter`
  keeps its step counter in the output's alpha and reads it back from `uPrev`.
- `render.mjs` should print (or fail on) shader compile errors: a failed effect
  passes the frame through silently, which looks plausible in a sheet.
- Datamosh and slit-scan stream must move pixels by whole pixels; fractional
  moves blur a slow scene to mush.
