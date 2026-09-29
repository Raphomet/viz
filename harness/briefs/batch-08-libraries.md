# Batch 08 · Working with the medium

Raph (2026-09-29): "using a library vs. raw js creates a very different
aesthetic, which is great" … "let's try 5 sketches per, intentionally trying to
'work with the medium' of each and showcase its properties."

A library carries a native look the way Flash, After Effects or a Rapidograph
did. Each maker takes one library and makes **five sketches that could only
have been made with it**: find what it does that nothing else does, then push
that property to where it becomes the subject of the piece. Don't hide the
medium or make it imitate our other scenes. Five sketches should span the
library's range, not five variations of one idea.

Rules that still hold (harness/TASTE.md, web/CONTRACT.md): music as input
(beat visible but confined, drop obviously bigger), the performer model
(drop params exposed, `presets: { calm, drop }`, a `follow` param), 60 fps at
3024×1890, no default rainbow or neon, nothing menacing, and loading only from
cdnjs / cdn.jsdelivr.net/npm / unpkg (one pinned version per library; bundle
any other files beside the page). Licences must be MIT/Apache/BSD/CC0 or
similar permissive, and any bundled asset must be CC0 or public domain,
credited in a CREDITS.md beside it.

## The five media

- **Rough.js** (`rough`, 1101–1105). Hand-drawn, sketchy rendering of shapes:
  hachure, cross-hatch, zigzag and dot fills, roughness and bowing, and a new
  wobble every frame (the "boil" of hand-drawn animation). The native look is
  a notebook, a whiteboard, an architect's pencil study.
- **GSAP** (`gsap`, 1106–1110). Motion-design timing: timelines, eases (elastic,
  back, expo, custom), staggers, and MorphSVG shape morphing, all free since
  GSAP 3.13. The native look is an After Effects title sequence: designed
  vector shapes and type that move with authored, springy, beat-locked timing.
- **Lottie** (`lottie`, 1111–1115). lottie-web plays After Effects animations
  exported as JSON: shape layers, trim paths, repeaters, masks, mattes and
  expressions. Author original Lottie JSON programmatically (it is just JSON),
  or use animations under a clearly permissive licence. The live-code angle:
  the music scrubs, re-times, loops and layers them, so they are played, not
  replayed.
- **three.js WebGPU compute** (`gpufluid`, 1116–1120). TSL compute shaders on
  WebGPU: the official MLS-MPM fluid example as a starting point for viscous
  paint and ink, plus other compute-native things (hundreds of thousands of
  particles, sand, snow, flocks). Use the same pinned three version as
  `web/three-kit.js` (its `/webgpu` build). Needs WebGPU (fine in Chrome on the
  M4 Pro); the render harness's software GL has no WebGPU, so test with the
  real-GPU path (`--gpu` once it exists, or a real-Chrome capture script).
- **MediaPipe** (`pose`, 1121–1125). Tasks-vision pose and segmentation. The
  native property is a real human body as data: 33 landmarks and a person
  mask. Source: a public-domain dance film (e.g. Prelinger or other archive.org
  public-domain footage, credited), trimmed and compressed to a few MB and
  bundled; plus live camera where available (not inside the artifact). Model
  files must be bundled (the default hosts aren't allowed). One sketch should
  be LEXSAN's style-swap idea: one continuous dance, redrawn in a different
  style on every beat.
