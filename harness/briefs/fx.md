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
