# Flyover V2

**The piece in one sentence:** a night flight up a winding river valley whose
banks are the music's recent past, lit from ahead by a low sun: the kick lights
the water, and the drop takes you down into a canyon and brings you back out
over open country for the breakdown.

## Scope: reconception, keeping the spark

Flyover ranked in the bottom 12 (mean 4.2 from five judges; the designer did
not see it). The judges agree on the diagnosis, even where they disagree on the
cure: the default is a bare 1983 wireframe with "nothing to look at"
(director), and the one good thing in it is **Night drive**, the mode Raph
himself liked (floor, psychonaut). Meanwhile Scanlines has become the
collection's "flying over a field of lines" piece (curator, purist), and its V2
now owns the phosphor raster and the dive between ridges. A tuned wireframe
would still lose to its own grandchild, so V1 cannot be fixed by tweaks.

What I keep is the 2016 spark: **every row of the land is one moment of the
spectrum, and you fly over the music's history.** I keep Night drive's layered
world (sky, stars, sun, moving ground), which is what Raph pointed at. I drop
the wireframe entirely: the land becomes solid, matte, fogged, rim-lit terrain,
and the flight gets a *place* (a river valley that winds) and a *place change*
(the canyon). That separates it from Scanlines: Scanlines is a signal on a
monitor; Flyover V2 is a landscape with weather and light.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| The default wireframe is bare; Night drive should be the default (psychonaut, floor) | **Act, harder** | Night drive's layers become the only world. There is no wireframe mode at all. |
| A clear arc (flat, ridges, mountains, flat) but a bare wireframe with nothing to look at (director) | **Act** | Keep the arc; give it a subject: river, sun, sky, fog, canyon walls. |
| Honest spectrogram-as-terrain, Unknown Pleasures lineage (purist) | **Keep** | Rows are still spectrum snapshots; the music still sculpts the land. |
| It is 1983; Scanlines has moved in; merge Flyover into Scanlines (curator) | **Reinterpret** | Right that two raster flyovers is one too many, wrong that the answer is deletion. V2 abandons the raster look and the synthwave grid so the two no longer overlap. |
| Flyover should drop into a canyon, the place change (floor transplant 3) | **Act** | This is the drop: walls rise, the camera descends between them, speed rises; the breakdown climbs out onto open plain. |
| Scanlines' rotating hidden image for longevity (psychonaut transplant 3) | **Reinterpret** | Not a swapped picture; the river *meanders*, so the valley ahead is always a new S-bend, and the plain/canyon alternation gives each section its own place. |
| Night drive's synthwave grid floor and coral sun (implied by purist on Expressway: "a genre costume") | **Reject the grid, keep the sun** | The flat grid lines to the screen edges are the 1983 costume; the low sun is the light source the whole scene is lit by. |

## The plan

1. **Solid land, lit from ahead.** Rows are filled far to near (hidden-surface
   by painting), each with one thin rim line in the light's colour that is
   brightest toward the sun and fades into horizon haze. No longitudinal wires.
   Four hand-made Lights instead of the shared 23 palettes: Ember dusk
   (default, Night drive's coral sun), Moonlight, Verdigris, and a matte
   daylight Desert with dark ink rims.
2. **A winding river.** The land is built around a river whose course meanders
   with the flight; the camera follows it and banks slightly into the bends.
   The water reflects the sun as a column of light. The spectrum sculpts the
   banks (bass nearest the water, treble on the far ridges).
3. **Music vocabulary.** Kick: a glint of sunlight laid on the water a third of
   the way out, which then rides the river toward and under you (confined,
   travelling). Clap: a meteor across the upper sky. Hats: stars and sparkles on
   the water. Bass: sun swell and bank height.
4. **Drop = the canyon.** One `canyon` axis raises stratified walls on both
   banks; with `altitude` and `speed` it is the drop. Exposed as params, with
   `presets: { calm, drop }` and a **Follow the track** switch (default on)
   that eases toward the drop preset from a kick-and-bass section detector.

Not carried over: the three modes, direction, rows, layout, valley width,
line weight, sun band. Kept as controls: flight speed, terrain height, camera
altitude, the light, the sun.

## What changed

Built as planned, with these specifics:

- **The world.** Night drive's layers only, made solid: 128 rows (spectrum
  snapshots) through a hand-rolled pinhole camera, painted far to near. Each
  row is filled with a vertical gradient keyed to world height (tops of hills
  and canyon walls catch the low sun, the feet stay in shadow), fogged into the
  horizon haze, and traced with one rim line that is brightest toward the sun
  and brighter on louder rows. No wireframe, no grid floor.
- **The river** meanders on three incommensurate sines; the camera sits over
  it, yaws into the bend and banks up to 3.4° with its curvature. Far water
  mirrors the haze, near water is dark, and the sun lays a column down it.
- **Kick** (jolt: calm, 4.5% of the frame): a flare of sunlight lands on the
  water about 7 units out, with a scatter of short glitter dashes, and the rim
  lines of those rows brighten; it is stored in the rows, so it rides the river
  toward you and fades within a beat. The first version laid full-width bands
  across the water and read as road markings; dashes read as light on water.
- **Clap**: a meteor across the upper sky. **Hats**: a handful of stars
  twinkle and glitter scatters across the near water. **Bass**: sun size and
  glow, flight speed, and the banks (bass sits nearest the water).
- **The canyon.** Stratified (soft-terraced) walls whose onset wanders per row
  and per side, so they come in buttresses and bays, then a mesa top. The drop
  preset is canyon 1, altitude 0.5, speed 1.8, taller terrain, stronger glint.
  **Follow the track** (default on) eases toward it in about a bar when a
  kick-plus-bass detector sees the drop, back out over about four seconds, and
  lets hats and early kicks raise low bluffs during the build (up to 0.3) so the
  canyon is anticipated rather than switched on.
- **Lights**: Ember dusk (default), Moonlight, Verdigris, and Desert noon, a
  matte daylight version in dark ink on ochre with a pale-blue river. Presets:
  calm, drop, noon, moonlit.
- **Params** (8): Light, Canyon, Flight speed, Altitude, Terrain height, Kick on
  the water, Sun, Follow the track.
- **Cost**: each row's fill stops at the next nearer row's water line instead
  of the screen bottom, which cut SwiftShader render time from 72 ms to 24 ms at
  640×360 (73 ms at 1280×720) with identical frames.

## Before/after

- V1 default (harness/renders/orig/flyover/sheet.png): a white trapezoid of
  mesh on black; the drop is taller mesh.
- V1 Night drive: a synthwave grid under a coral sun.
- V2 (harness/renders/v2/flyover/sheet.png): 2–8 s a dusk river plain with
  low bluffs rising through the build; 10 s the first meteor and the first
  glint; 12–16 s inside the canyon with the kick flare on the water; 20–24 s the
  climb out. harness/renders/v2/flyover-720/frame-22s.png (breakdown, the
  canyon falling away toward the sun) and frame-12s.png (the drop) are the best
  frames. harness/renders/v2/flyover-96/sheet.png holds up over 96 s: no
  saturation or drift, and each section is its own place.
- Jolt (harness/renders/v2/flyover-jolt/heat.png): calm, kickArea 0.045,
  ratio 1.03 (the flight's drift is high, so the ratio is low); the heat map
  shows the kick as one hot spot on the water.

## What I'd still do

- Every drop in one set is the same canyon in the same light. A long set would
  benefit from the light drifting slowly (dusk deepening to night over
  minutes), which I held back to avoid anything like hue cycling.
- The kick sits a little small at full screen in the plain sections; a
  performer can raise "Kick on the water". A second, bank-lighting reaction
  might make it bigger without widening it.
- Near canyon walls at sharp bends can fill a third of the frame with dark rock
  for a second or two. It reads as speed, but a camera that steered away from
  the outside wall would be kinder.
- Faint seams between the per-row water quads are visible at 1280×720.
