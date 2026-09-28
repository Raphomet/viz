# Current V2: redesign note

V1: `web/scenes/current.js` (ranked #8 of 72, mean 7.2 from five judges; the
designer did not see it). V2: `web/scenes/v2/current.js`, id `currentv2`.

## The piece in one sentence

Silk smoke braiding into slow whirlpools, drawn by tens of thousands of
particles into an ink buffer that never clips: a flow field you can breathe
with.

## Scope: one new idea, carried by three changes

The judges agree on what the soul is (single-hue silk, the curl-plus-gradient
drains, the Float32 ink that never clips, still alive at 96 s) and agree on
what is missing: you cannot find the kick, the drop turns silk into
"tangled wire", and the thing floats in place. That last point is Raph's own
batch-01 verdict: generative art, not music visualization. A few tweaks to
envelopes would not change that; the scene needs a musical *event* that lives
inside the medium. So one new idea, and the idea is the scene's own title:
**marbling on a moving current**. The kick drops dye into the water; the snare
drags a comb line through it; the bass sets how fast the river runs. The silk,
the drains and the ink buffer stay exactly as they are.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| Single-hue silk, dark-room perfect, restraint beats spectrum (floor, psychonaut, curator) | **Keep** | The ground stays one deep hue; the new colour only ever arrives as a dye and washes back out. |
| Curl-plus-gradient drains, Float32 ink, never clips; the purest flow field in the set (purist) | **Keep** | Untouched: same field maths, same buffer, same tone curve. |
| Drop tangles tight, breakdown loosens into long strands: a genuine exhale (director) | **Keep, re-cause** | The exhale stays; what makes the drop bigger changes (below). |
| The kick itself is hard to pick out (floor, purist); Raph: batch 01 unreadable musically | **Act** | The kick injects a drop of dye (a second ink) at one place; the flow grabs it and stretches it into coloured filaments within a second. Every kick visible, confined to one bloom. |
| The drop turns scribbly / tangled wire at full size (psychonaut, curator) | **Act** | V1's drop pumped high noise octaves and tightened the drains with the bass, and shortened the trails, which is what collapsed silk into wire. V2 leaves the field's shape nearly alone and makes the drop bigger by speed and dye instead. |
| Floats in a void, no camera; a simulation you fly *through* (psychonaut) | **Reinterpret** | Not a camera: a current. The whole field now runs downstream (the eddies are carried with it, so the whirlpools travel intact), and the bass sets how fast the river runs. Movement across the frame, and it only changes speed. |
| Monochrome and flat (psychonaut); light-age colouring, white leading edge (psychonaut, curator) | **Reinterpret** | Age colouring would add a glow-edged look to every strand. The dye does the same job only where the music put it: a coloured strand shows direction of flow as it is drawn out, and the ground stays one hue. |
| Three-depth parallax motes from Abyss (psychonaut) | **Reject** | Glowing dots on silk; the current itself supplies the motion. |
| Centroid sets the curl/gradient ratio (purist) | **Reject** | A timbre-to-texture mapping is exactly the "music felt, not read" that failed Raph in batch 01. |
| Silk Corridor, Plotter, Rave's advected smoke (psychonaut, purist) | **Reject** | Other scenes. |
| Highlight roll-off as a strength (floor) | **Keep** | The dye is tone-mapped through the same soft shoulder. |

## The plan

1. **A real current.** A mean flow (default left to right, heading wandering
   slowly within about ±12°) added to the particles, with the noise
   potential translated at the same speed, so eddies drift downstream intact.
   Particles that leave downstream re-enter upstream, off screen. Bass sets
   the river's speed (continuous swell); the drop surges, the breakdown slows
   to a drift. New `Current` control.
2. **Kick = a drop of dye.** On each kick onset, particles within a small disc
   (about a tenth of the short side, placed somewhere different each time,
   upstream-biased) are tagged with dye A; they ink a second buffer with a
   little extra weight, and the tag fades over about a second and a half. The
   flow shears the bloom into filaments that wash downstream and back into
   the ground hue. New `Dye` control (0 = V1's pure silk).
3. **Snare = a comb line.** On each clap/snare onset a thin line across the
   flow is tagged with dye B (a pale second ink), which the current bends into
   a marbled wave. A shape and colour visibly unlike the kick.
4. **The drop by speed, not wire.** Bass no longer adds turbulence octaves or
   shortens the trails; it moves the river and (a little) evolves the field
   faster. Drop = faster current + a bloom on every beat + comb lines;
   breakdown = no dye, slow drift, long strands.
5. **Tone.** A 3D LUT (density × dye A × dye B) keeps the V1 tone curve for
   every mix, so dye never clips and never glows; it is ink in water.

Not touched: noise, curl-plus-gradient field, the ink-per-distance splat, the
LUT's shape, the warm-up, the margin domain. Controls trimmed to eight
(turbulence fixed at V1's default, particle count fixed at 30k).

## What changed

Built as planned except for two things the renders forced, marked below.

1. **The river.** Bass sets its speed (0.42 → about 1.7 of V1's swirl speed at
   default `Current`, smoothed over about a second, so it surges and never
   lurches). **Changed in the build:** my first version carried the
   particles and the potential on a mean flow over a *still* ink buffer. Every
   sharp feature of the moving field then drew itself as a straight vertical
   front sweeping across the frame (a noise-lattice artifact that V1's still
   field hides). Now the ink, the particles and the potential all slide
   downstream together by whole buffer pixels, with a hidden upstream pad so
   columns enter the frame with ink already in them. In the river's own frame
   this is exactly V1's field, so the whirlpools stay V1's, and the whole
   picture travels. The heading is straight left to right (no wander), which
   keeps the pad to one edge.
2. **Kick = a flash of coral dye.** The nearest ~650 particles to one spot
   (chosen from five golden-ratio candidates: on ink, and away from earlier
   dye) take the dye and ink about 30 times harder for about a tenth of a
   second, splatted soft. Then they carry the colour for a few seconds while
   the eddies draw it out. A fixed disc was tried first and caught anywhere
   from 30 to 1,100 particles, so half the kicks were invisible; ink by
   distance alone barely showed, because particles sit nearly still in the
   drains. Kick detection uses band 0 only (band 1 caught the bass line).
3. **Snare = a whirlpool. Changed in the build:** the comb line was
   invisible within a beat (the drains swallow any line), and with a strike
   flash it read as a hairy barcode. Each clap now spins up a vortex in one
   place for most of a second, and the water it catches takes the pale ink,
   so it leaves a pale spiral. That makes it a motion event in its own
   colour, where the kick is a colour event in one place.
4. **Drop without wire.** The bass adds 0.08 turbulence (V1: 0.45), tightens
   the drains by 20% (V1: 60%), and evolves the field at about half V1's
   rate. Energy lengthens the trails a little less in the drop, and no longer
   cuts them short.
5. **Tone.** A 3D LUT (1024 densities × 12 × 12 dye fractions) runs every mix
   through V1's curve. Dye shows only above a density floor, so faint haze
   stays in the water's hue (the first build washed the darks muddy brown).
   The dye fraction is square-rooted so a strand of dye in a busy river still
   reads, and dyed rivers keep their colour instead of going white-hot.

Controls: Current, Dye, Whirlpools, Swirl speed, Trail length, Eddy size,
Inks (Tide, Ember, Iris, Bone: ground + kick dye + clap ink), Music response.
`Dye` 0 (or Current 0) gets you back close to V1.

Cost: in the harness, 1280×720 renderTime is 7.9 ms mean (V1 3.7 ms,
measured on a quieter day), so about 2x V1. Advect is most of it: the
particles on the dye path and inside whirlpools, and the extra pad. Mitigated
with per-particle whirlpool substeps, a contiguous plain-water LUT, per-row
dye flags and an unmark threshold. **Check with `harness/fps.mjs` at full
screen** before trusting it at 1080p.

## Before/after

- V1 sheet `harness/renders/final/current/sheet.png` vs V2
  `harness/renders/v2/current/sheet.png`: V1's intro, drop and breakdown are
  all one teal, and the drop differs mainly by being scribblier. In V2 the
  intro and build are teal silk; coral blooms arrive at the first kicks
  (8 s); the drop (10–16 s) is teal silk full of coral and pale strands; and
  the breakdown (18–24 s) visibly washes back to one hue.
- Kick legibility: `harness/renders/v2/current-720/frame-14s.png`: a fresh
  bloom (centre-left, bright coral knot) beside older blooms already drawn
  into strands, and last beat's whirlpool spiral.
- Drop texture: V1 `final/current/frame-14s.png` (tangled wire) vs V2
  `v2/current-720/frame-14s.png` (silk with dye).
- 96 s: `harness/renders/v2/current-96/sheet.png`: every drop differs in
  where its dye lands, every quiet section returns to clean teal silk, and
  nothing saturates.
- Jolt: **calm**. Drop kickArea 0.213, kickMean 0.044, drift 0.034, ratio
  1.30; build kick area 0.126, ratio 1.19. (V1: area 0.03, ratio 1.21.) The
  area is larger mostly because the river slides the whole picture a pixel at
  a time, which the meter counts as drift as well as kick.

## What I'd still do

- The fresh bloom is a slightly mottled knot at 720p for its first tenth of
  a second (particles bunch in the drains). A resolution-scaled splat would
  smooth it, at some cost.
- Let the river's direction change at section boundaries (a quarter turn
  for the drop), which needs the ink pad on all four edges.
- Run fps.mjs and, if 1080p misses 60, drop the default particle count to
  about 24k.
