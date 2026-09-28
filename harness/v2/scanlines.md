# Scanlines V2

**The piece in one sentence:** a single-phosphor Rutt/Etra raster flown low over
a hidden image, where each kick rolls one ring of light across the land and each
section of the track is a new landscape.

## Scope: refinement, four changes

Scanlines ranked #6 of 72 (mean 7.4, five judges; the designer did not see it).
Every judge who saw it named the same soul: the kick ring travelling across the
terrain, and the hidden image that keeps changing underneath. Both stay. What is
wrong is in the sheets rather than the reviews, and it is concentrated in one
place: **the drop is the weakest section.** The intro (2 s) and breakdown (22 s,
24 s, 72 s) are mono phosphor on black and are the best frames the scene makes.
The drop (10, 12, 36, 60 s) splits the phosphor into three hue-rotated channels
and weaves a column raster through it, which reads as a pink synthwave mesh
with rainbow fringes, flattens the relief, and at 36 s exposes a flat shelf and
a corner at the far edge of the terrain. So the drop is "bigger" only by being
busier and more spectral: exactly the default-glow-and-prism finish TASTE.md
retired. And the image switches on almost every snare past a 3.6 s hold, so a
single drop can go through two landscapes, which blurs the section cut that the
director liked.

That is a refinement, not a reconception.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| The travelling kick ring is excellent, a model of the confined kick (floor, curator, psychonaut, director) | **Keep** | The soul. Same mechanism; I only change its colour (below). |
| The rotating hidden image gives it longevity (psychonaut, floor, purist) | **Keep, make it structural** | It is the scene's narrative, so it should happen *at* the section change, not whenever a snare allows. |
| Palette-per-section is hue cycling by other means; keep one palette, change the image per section (curator, transplant 9) | **Reinterpret** | Half right. Swapping the phosphor with the landscape is a considered device (it is swapping the monitor), and three judges credit it for longevity, so it stays. What *is* hue-cycling is the drop's three-channel hue triad; that goes. Each phosphor gets one fixed accent instead, and a single-phosphor option is added for anyone who agrees with the curator. |
| Offer Flyover's white-on-black as a Scanlines palette (curator, merge 13) | **Act** | Cheap and right: a "White" phosphor with one red accent. |
| Change the hidden image at each section, like Chladni re-forming (curator transplant 9); a new chapter every drop (director transplant 7) | **Act** | The image now switches when the drop arrives and when it leaves, carried by the retrace wipe. One landscape per section. |
| The drop should change *place*, not brightness (floor theme 1; curator transplant 10, "the drop as a place you enter") | **Act, my way** | The drop is a dive: the camera comes down out of the sky to fly low and fast between the ridges, horizon high and relief towering; the breakdown climbs back up to the wide, slow view. Same world, different place. |
| Kick-as-phase-echo travelling through the raster (purist transplant 1) | **Reject** | The ring already travels as a wavefront through the land; a second travelling kick would compete with the one everybody praised. |
| The confined kick still clips to white (psychonaut theme 4) | **Act** | The ring's hot core becomes the phosphor's accent, pale but never pure white, and the bloom at its spot is dimmer. |
| "Joy Division terrain", dark and readable from anywhere (floor) | **Keep** | No ground, no glow wash; the occluded mono lines stay the look. |
| Flyover's second life / grandchild (curator, purist) | **Keep** | Lineage acknowledged, not a problem to solve. |

## The plan

1. **Drop = the dive.** Camera altitude and pitch become a section variable,
   eased from the drop envelope: high and slow at rest, low (pitch roughly
   halved, closer to the ground) and faster in the drop, with the relief lifted.
   It is continuous motion, a speed change and a place change, never a cut.
2. **Kill the three-channel split and the column weave.** Mono phosphor
   throughout: one glow stroke and one core stroke per line (half the V1 stroke
   count). In the drop the only chromatic device is a faint two-ink
   misconvergence (the accent ghosted a pixel or two below the phosphor), a
   real CRT fault, not a spectrum.
3. **One accent per phosphor.** Five fixed two-ink chords (green + gold, amber +
   ice, ice + rose, violet + amber, rose + teal), plus White + red. The accent
   is used for the planet, the kick ring's core and the ghost, and nothing else.
4. **Image changes at section changes, not on snares.** Entering the drop and
   leaving it each roll in a new landscape behind a retrace wipe (a snare still
   sends a plain retrace front, recolouring lines, as before). A long track
   without sections still gets a switch on a snare after 30 s.
   (Refined while building: drops and rest sections draw from separate
   lists; see What changed.)
5. **Horizon mist over the far edge**, drawn after the terrain, so the land
   dissolves into sky instead of ending in a shelf.

Not touched: the flight, the five hidden images, the ring mechanism, the band
wiggles by depth, the hat glints, the scanned planet, the occluders, the snare
retrace front.

Controls: the Colour select becomes **Phosphor** (follows the image / green /
amber / ice / white); a new **Drop dive** (0–1.5) replaces Phosphor persistence
(fixed at V1's default), so there are still eight.

## What changed

All five planned changes went in, with two decisions made while looking:

1. **The dive.** The drop eases the camera down (pitch 0.44 to 0.24, distance
   2.3 to 1.75, frame centre raised) and the relief up 45%, in over about a
   bar and back out over several seconds after the kicks stop. Flying speed
   gains only a little (+0.1): at that altitude the ground already rushes, and
   a bigger boost made the drop frantic. The nearest rows now fade by their own
   distance, because in the dive they cross the near plane and were being cut
   into stubs.
2. **Mono phosphor.** The three-channel split and the column weave are gone;
   each row is one glow stroke and one core stroke. The drop's only colour
   device is the accent ghosted 1–4 px under each line. Cheaper as a side
   effect: 1280x720 SwiftShader `renderTime` p95 118 ms (V1) to 79 ms.
3. **Two-ink chords.** Each image has a fixed phosphor and accent; the accent
   is the planet, the kick ring, the snare front's recolouring, the glints'
   halo and the drop sky. The ring core is the accent mixed 45% toward white,
   never white. Phosphor control: follows the image, Green, Amber, Ice, White
   (Flyover's white with a red accent).
4. **One landscape per section.** A section detector (four kicks in 2.5 s
   *and* the bass line, since the build's kicks alone had V1's envelope high by
   8 s) switches on the first clap of the drop, landing about 0.5–1 s in, and
   switches again 1.1 s after the kicks stop. Decided after the first render:
   the drop draws from its own list (**Ridges, Vortex**), rest sections from
   theirs (**Lattice, Dunes, Pond**). The dive into the ridges was plainly the
   best thing the scene makes, and flying low over the flat pond or lattice
   wastes it. So the scene now opens on V1's most-praised frame, the ice
   lattice under a rose planet. A snare after 30 s with no section still
   switches, for tracks without clear sections.
5. **Horizon mist** in the sky colour laid over the far rows, and the strip
   widened with distance (1.7 to 2.4) so the side edges stay off screen under
   the lower pitch and extra roll.

Also: the Vortex field's calm centre was widened (0.15 to 0.32), because seen
low the undersampled spiral centre read as a crown of spikes.

## Before/after

- **The drop.** V1 `harness/renders/b3/scanlines-720/frame-12s.png` (pink mesh,
  rainbow fringes, flat shelf) against V2
  `harness/renders/v2/scanlines-720/frame-14s.png`: low among green peaks
  under a gold sky, the kick ring a pale-gold crest on one ridge. Across the
  96 s sheets, V1's drops (12, 36, 60 s) are its weakest tiles and V2's
  (12, 60 s Ridges; 36, 84 s Vortex) are its strongest.
- **Section cuts.** V2 24 s sheet: ice lattice (2–10 s), green ridges from
  the drop (12–18 s), violet dunes as the camera climbs out (20–24 s). V1
  changed image mid-drop (pink pond at 10–12 s, green ridges at 14–16 s).
- **Longevity.** `harness/renders/v2/scanlines-96/sheet.png`: no two tiles
  share a landscape and phosphor pair unless one is a drop and one a rest.
- **Jolt.** V1: calm, kickArea 0.21, ratio 1.07. V2: calm, kickArea 0.40,
  kickMean 0.077, drift 0.068, ratio 1.13 (build kick 0.24, ratio 1.09). The
  area rose, but the heat map shows why: it is the low flight moving the whole
  foreground every 0.15 s with or without a kick (ratio about 1). The kick
  itself is still one pale crest in one place.

## What I'd still do

- The dive's foreground is coarse: near rows are far apart at that altitude,
  so the nearest ridges read as big facets. More rows near the camera (a
  depth-graded row spacing) would fix it, at some cost.
- Dunes is the plainest rest landscape; it could use a second wavelength.
- If Raph sides with the curator, the Phosphor control already gives the
  single-palette version; I'd not make it the default.
