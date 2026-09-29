# Koi V2

**The piece in one sentence:** a clear, shallow pond in real sunlight, where
the music arrives as weather (a drop of rain, a sun-shower) and the koi, as
real koi do, come to see what fell in.

## Scope: refinement, four precise changes

Koi ranked #7 of 72 (mean 7.33, spread 3). Every judge named the same soul:
daylight not bloom, a kick that travels as rain rings, characters with cause
and effect. Nobody wants it to be something else. What is actually wrong is
visible in the sheets rather than in the reviews: **the drop is not obviously
bigger** (the 2 s intro and the 12 s drop tiles are the same pond with a few
fry added; TASTE's "the drop is obviously bigger" fails), **the 96 s sheet is
eight copies of one frame**, and the fish and pads are clean vector clip art
(the purist's "a little decorative" is right, for the wrong reason). So:
refine, don't reconceive.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| Rain rings are the best confined kick; it travels (psychonaut, floor, designer, curator) | **Keep** | This is the soul. Untouched. |
| Cause and effect: fry swim to the rings (director, 9) | **Act, extend** | It is half-true by accident in V1 (the shoal's orbit happens to cross the rings). Make it real and give it to the big koi too: the nearest koi turns to each drop, as koi rise to anything that lands on the water. |
| Breakdown empties the pond, rain stops (director) | **Act, deepen** | Keep the exit and add the physical exhale: the wind drops, the surface goes to glass, the caustics slow to a crawl and the koi sink. |
| Calm, a great opener, reads at low volume (floor, 7) | **Keep** | No new global flash; the jolt stays calm. |
| "Honest agents, a little decorative" (purist, 6) | **Reinterpret** | The agents are fine; the decoration is the rendering: polka-dot patches, opaque fins, flat Pac-Man pads. Fix the craft, not the concept. |
| Persistent silt trails on the floor (purist transplant) | **Reject** | A clear pond is the point; trails would muddy the one image that reads as clean daylight. |
| Chomper's world-folds-into-an-object drop (psychonaut transplant) | **Reject** | A torus pond is a stunt that breaks the calm that makes this the opener. |
| Koi Sky: look up from the bottom (psychonaut new idea) | **Reject here** | A lovely different scene, not a V2 of this one. |
| Travelling kick ring from Scanlines (floor transplant) | **Already true** | Koi's rings already travel; I make them move the pads so the travel is seen in objects, not only in light. |
| Longevity: 96 s looks the same everywhere (implicit in director/floor themes 6/8) | **Act** | Slow cloud shadows crossing the pond, and each drop's shower arrives from a new direction. |

## The plan

1. **The drop is a sun-shower** (*kitsune no yomeiri*, the fox's wedding: rain
   while the sun shines). A procedural field of fine rain rings covers the pond,
   its density set by the hats and the drop, cheap in the shader (a hashed
   grid, no uniforms). The sun stays out, so it is still daylight; the drop is
   a nameable event you can see from the back of the room. It stops at the
   breakdown.
2. **The koi rise and come to the rain.** In the drop the koi swim shallower
   (colours clear and saturate, bodies grow slightly, shadows fall further
   away), and each kick's drop pulls the nearest koi toward it. In the
   breakdown they sink back, tinted and slower.
3. **The breakdown is glass.** Wind chop falls to near zero and the caustic web
   slows, so the floor lies still and sharp: the pond exhales, it doesn't just
   dim.
4. **Craft.** Organic koi patterns (lobed blobs, not ellipses), translucent
   fins with rays, lily pads with a lit rim and vein tone that rock and bob
   when a ring passes under them.
5. **Minute five.** Slow soft cloud shadows drift across the floor over tens of
   seconds.

Not touched: the floor shader's stones and caustic look, the kick's wandering
drop point and splash crown, the snare C-start, the shoal's arrival, the light
presets, the params.

## What changed

- **Sun-shower on the drop.** A procedural rain field in the shader (a 40-unit
  hashed grid, one fine drop per cell per 0.9 s, density = drive x hats). It
  sweeps in across the pond from one side over a bar or two, and each drop
  picks a new side. The hats in the drop now shape the shower's density;
  V1's per-hat ripple uniforms are gone, which leaves every ripple slot for
  the kick and the feeding rings. Rain beads collect on the lily pads in the
  shower and dry off afterwards.
- **Koi come to the rain.** On each kick the nearest free koi (within 320
  units, at most two at once, with an 11 s rest after) swims to the drop and,
  when its head reaches it, raises a small second ring and turns away. My
  first pass let every koi answer every kick, and the whole pond piled into
  one knot at the drop point (the first 14 s render). The throttle fixed that.
- **Rise and sink.** Each fish's effective depth falls in the drop and rises
  in the quiet: colour clears, and the shadow falls further from the body.
- **Glass breakdown.** Chop is now a smoothed 0.07 + hats + drive (it was a
  constant 0.35 + drive), so the intro and breakdown surface is flat, the
  build roughens it, and the caustic web runs on its own clock that slows to
  about a third in the calm.
- **Craft.** Lobed pattern patches, rayed translucent fins, pads with a
  sun-side gradient, a wine-red curled rim on some, and spring-rocking when a
  ring passes under them. Slow fbm cloud shadows cross the floor.

## Before/after

- Drop vs intro: V1 `b4/koi-720` 2 s and 12 s are the same pond. V2
  `v2/koi-720/frame-14s.png` shows the whole surface stippled with rain
  rings, two koi at the kick ring with a feeding ring, and the shoal. The 2 s
  tile is glassy and clean. The drop is now a different weather, not a level.
- Cause and effect: `v2/koi-720` 12 s (a gold koi at the ring's centre) and
  18 s (koi gathered under the last rings as the shoal leaves).
- Longevity: `v2/koi-96/frame-60s.png` (rain from the lower left, cloud shadow
  over the upper right) vs `frame-72s.png` (glass, beads on the pads) vs
  `frame-84s.png`. The 96 s run was cut off at 84 s by an interruption, so it
  has no sheet; the seven frames were enough to judge.
- Jolt (640x360, seed 1): **calm**, kickArea 0.110, kickMean 0.027, drift
  0.023, ratio 1.15 (V1: calm, 0.115, ratio 1.26). The build kick scored
  area 0.065 and ratio 1.33 on the earlier pass. The shower raises drift, not
  the kick.

## What I'd still do

- The kohaku patches still read as round spots at 720p; the lobes are too
  timid. A real pattern texture per fish (noise-thresholded) would finish the
  purist's point.
- Performance (fixed): the rain inside height() ran five times per pixel and
  measured 49 fps (p95 33 ms) on the M4 Pro at 3024x1890. It now returns its
  slope and Laplacian analytically in one pass: 60.1 fps, p95 16.7 ms, with
  the look unchanged (`v2/koi-720/frame-14s.png`).
