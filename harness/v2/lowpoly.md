# Low Poly V2

**The piece in one sentence:** a moonlit night poster of a humpback flying over
a sea, rendered live as a triangulation whose polygon count *is* the music: the
room watches the picture come into focus on the drop and fall back into shards
in the breakdown.

## Scope: reconceptualization, keeping the whale and the title

Low Poly ranked in the bottom 12 (mean 4.0, spread 4). Two complaints run
through all six verdicts and they are both right: it is **static** (director:
"the whale is practically frozen for 24 s"; curator and floor: "nearly
static") and it is **a look rather than an idea** (purist: "the 2014 low-poly
cliché"; designer: "a generic desktop wallpaper"; curator: "2014 stock art").
Tweaks to V1 would give a moving wallpaper. The low-poly look only earns its
place if the triangulation is doing something, so V2 makes the triangulation
the process: the image is a smooth painting nobody sees, and what you see is
a live Delaunay mesh of moving points sampling it. More points, more
resolution. That is also what low-poly originally *was* (90s real-time 3D
spending a polygon budget), which is the thread back to V1.

Kept: the whale in the sky (the psychonaut's "dreamlike", and the scene's one
image anyone remembered), flat facets and hard edges, crisp poster type, the
Bebas title and tracked captions, the calves as the drop's company.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| Triangulation as a live mesh: points in a flow, kick adds points, breakdown removes them, the image coarsens and refines with the music (purist, 2) | **Act, as the spine** | This is the idea the scene lacked. I take the mechanism, not the "whale as a density of points": the whale stays a drawn body so the image still reads from the back. |
| The whale is frozen; give it a readable swim cycle, a tail stroke on the kick, and bank across the frame over 16 bars (director, 4) | **Act** | A 2D side-view body with a travelling wave, a long pectoral wing, and a slow path across the frame that crosses in front of the moon. |
| Camera never moves; the "flight along the valley" can't be seen (psychonaut, director) | **Reinterpret** | V1's forward flight was too slow to read. V2 trucks sideways: three ridgelines and the sea scroll at parallax speeds, and the mesh points travel with the layer they sit on, so the facets themselves move past. |
| Calves should follow the mother's wake on the drop and peel off in the breakdown (director) | **Act** | They enter from behind, on her line, and drift away and up when the drop ends. |
| The gradient is generic; a desktop wallpaper (designer, curator) | **Act** | Default is now a night palette (indigo, slate, a cream moon) with one vermilion second ink. The pink sunset stays as an option. |
| SONG turning yellow is a weak drop; the drop should be an event, not a level (designer, director theme 1) | **Act** | The drop is a nameable event: the picture snaps into focus. The second ink goes into the image (a halo and the moon's glade), not the headline. |
| Kitsch that doesn't change between sections (curator) | **Act** | Intro and breakdown are coarse shards, the build visibly gains facets, the drop is full resolution. The sections look different from across the room. |
| Headline per section (designer transplant) | **Reinterpret** | The title stays; a chapter line and a live polygon count change per section, like a spec sheet. The count is information design, not a meter: it names what the image is doing. |
| The title never leaves (psychonaut) | **Reject** | The title is the poster. Made smaller and moved to the foot instead, so the image has the frame. |
| Koi Sky: look up through a pond at the whale (psychonaut new idea) | **Reject here** | A different scene. |
| Accumulation / a clock slower than the song (purist themes 3, 4) | **Partly** | The whale's 32 s path and the parallax give a slow clock; the mesh itself is never the same twice. No memory layer: it would fight the refine/coarsen story. |

## The plan

1. **The live mesh.** A hidden low-res painting (sky, moon, three ridgelines,
   sea and glade, the whale and calves) is redrawn every frame. Visible frame:
   a Delaunay triangulation of a few hundred to ~1,600 points, each triangle
   flat-filled from the painting at its centroid with a little relief shading
   from the painting's own gradient. Points are particles that ride their
   layer's parallax, are importance-sampled toward edges, and live and die, so
   the facets crawl slowly. Structural points hug the whale, the moon's rim
   and the frame edge so the image reads even at 150 points.
2. **Polygons follow the music.** A `Polygons` param sets the budget; with
   Follow on the build's riser creeps it up (anticipation) and the drop takes
   it to full resolution in about a bar. The breakdown drains it back to
   shards over a few seconds.
3. **The kick is a tail stroke.** Each kick flicks the flukes and sheds a wake
   of fresh points behind the whale; the facets there catch the light and
   fade as the points drift away. Confined to the whale's wake.
   Clap: the moon's facets re-deal their shades. Hats: single sky facets
   catch starlight. Bass: swim depth and flight speed.
4. **The swimming whale.** Side view, a travelling body wave, a long flapping
   pectoral, a 32 s path that banks across the frame and past the moon.
5. **Poster layer.** Crisp title at the foot, tracked captions, a chapter
   line and the live polygon count.

Not carried over: V1's forward heightfield flight, the 3D lofted whale, the
faceted title, the sun.

## What changed

- **The image is a live Delaunay mesh.** A ~110 px painting (sky with four
  cloud banks, moon, far and mid ridgelines, sea with a soft glade, a
  headland, the whales) is redrawn and read back each frame; a sweep-hull
  Delaunay of 300 to ~1,800 points is flat-filled from it, with relief shading
  from the painting's own slope and a stable per-facet cut (hashed from the
  three vertex ids, so a facet keeps its shade as long as it exists). About
  1 ms for the triangulation.
- **Polygons are the music.** `Polygons` (default 560) is the calm budget;
  with Follow on the build's riser creeps it to ~1,200 and the drop takes it
  to ~3,300 in about a bar; the breakdown drains it a few points a frame, so
  you watch it coarsen. Chapter line: I · THE SEA ASLEEP, II · SOMETHING
  SURFACING, III · FULL RESOLUTION, IV · FALLING BACK TO SHARDS, read from
  the budget's trend, so a performer's fader moves it through the same words.
- **The whale swims.** A side-view humpback with a travelling body wave,
  flukes that pitch with the stroke, a long pale pectoral flapping like a
  wing, on a 32 s banking figure of eight that crosses in front of the moon.
  Structural points pin its outline, so it reads as a crisp silhouette even at
  300 polygons; free points are kept off it and are pushed aside as it passes.
- **Kick = tail stroke plus a wake of light.** The flick deepens the tail
  wave, and 30-odd fresh points are shed behind the flukes; only facets cut
  wholly from fresh points glint, so the kick lights small new facets and
  never a coarse one. Hats cut a tiny four-point star of five fresh points
  into the sky (V1's stars, rebuilt so they cannot light a huge shard). Clap
  re-deals the moon's facets. Bass sets swim depth, glade brightness and
  flight speed.
- **Parallax truck.** Sky, far ridge, mid ridge, sea (speeding up toward the
  viewer) and headland slide at five speeds, and every free point rides the
  speed of the layer it sits on, so the facets themselves travel.
- **The drop is an event.** The picture snaps into focus, the calves swim in
  on their mother's line within about a second, and the second ink prints as
  a vermilion halo round the moon (which begins as a faint creeping ring in
  the build: anticipation) and the rule under the title. Breakdown: the halo
  fades, the calves peel off up and away, the mesh falls back to shards.
- **Palette.** Moonrise (indigo, slate, cream moon, a dusty-rose horizon and
  one vermilion ink) is the default; Dusk keeps V1's colours; Glacier is a
  daylight version; Ember is red with a teal second ink.
- **Poster layer.** Crisp Bebas title at the foot (unfaceted, the one layer
  the mesh doesn't touch), tracked Josefin captions, the chapter line and a
  live Space Mono polygon count, like a render spec sheet.
- **Performer model.** Everything the drop changes is a param (`polys`,
  `calves`, `ink`, `flight`); `follow` (Follow the track, default On);
  presets `calm`, `drop`, plus `shards` (140 polygons, full relief) and
  `glass` (3,600 polygons, fast, low relief).

Jolt (640x360, seed 1): **calm**, drop kickArea 0.065, ratio 1.15; build
kick area 0.044, ratio 1.15 (V1 was calm too, with kickArea 0.06). The heat
map puts the kick on the whale's tail and the wake behind it. Harness
`renderTime` at 1280x720: mean 15 ms, p95 23 ms (V1 measured 425 ms mean
on its run, a busy machine, but V2 is certainly no heavier).

## Before/after

- V1 `harness/renders/b5/lowpoly-720/sheet.png`: twelve near-identical
  tiles; the drop is SONG turning yellow and two calves.
- V2 `harness/renders/v2/lowpoly-720/sheet.png`: 2 s (538 polygons, coarse
  shards, the whale a silhouette), 10 s (the halo arriving in shards,
  "something surfacing"), 14 s (3,533 polygons, halo, calves, wake glint:
  `frame-14s.png` is the best single frame), 22 to 24 s (visibly draining back
  to shards). Every section looks different from across the room.
- 96 s `harness/renders/v2/lowpoly-96/sheet.png`: every drop brings the
  calves and the halo, and the whale is at a different point of its path, so
  no two drops are the same picture; the loop-boundary tiles read IV,
  correctly (the end of a breakdown).

## What I'd still do

- The whale is a flat silhouette; a second tone on the flank (a lit plane
  along the back) would give the facets more to cut at high resolution.
- The calm state is a monochrome violet sky of big shards: handsome, but the
  least interesting third of the set. A slow colour clock (the horizon
  warming toward dawn over several minutes) would help minute five.
- The kick is legible but modest (ratio 1.15); a performer can push
  Reaction strength. I kept it there rather than risk a pulsey whale.
- Not checked at square aspect beyond the layout branch.
