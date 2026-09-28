# Arcs V2 — redesign note

**Scope: restage the system Raph already wrote.** This falls between a tweak
and a reconception. V1 ranked in the bottom 12 (mean 2.00). Every judge saw
the same frame: one small white crescent in the middle of a black field, a
"loading spinner". The purist saw what the others missed. The 2016 sketch is
already a Whitney-style *grid* of concentric arcs whose sweeps are staggered
by ring, row and column (X1, Z0, Z1). At its defaults that grid is 1×1 with one
arc and no stagger, so the piece was hidden behind four sliders. So V2 keeps
Raph's rule exactly: each arc draws itself closed from twelve o'clock, then its
tail chases the head round and erases it. What changes is the stage, and the
music gets a way into the phase. The phase field is the instrument: the kicks
write into it, so the grid of clocks drifts in and out of alignment with the
track.

## The piece in one sentence

A Müller-Brockmann concert poster that keeps time: an all-over grid of
concentric arcs, each ring drawing itself closed and erasing itself again, in
Raph's 2016 rhythm. The phase runs in a slow diagonal wave across the sheet.
Each kick sends a ripple through it that whips the arcs a quarter turn forward
as it passes, and the drop brings in more rings, a second and third ink, and
counter-rotation.

## Feedback triage

| Point (who) | Verdict | Why |
|---|---|---|
| "One small crescent", fills ~1% of the frame (all six) | **Act** | This is the whole failure. The grid fills the stage edge to edge at every aspect, and a Grid rows control runs from one frame-high set (the Floor's "span most of the frame height") to a dense 8-row field. |
| The real piece is the phase-staggered grid hidden behind the sliders; restage it at 6×6 with staggers on (purist) | **Act** | This is the spine of V2. The ring stagger and the diagonal row/column wave are Raph's X1, Z0 and Z1 folded into one Phase spread control and on by default. |
| The sweep collapses to nothing once a second and reads as a dropout; keep a trail (floor) | **Act, my way** | The per-arc collapse is Raph's gesture, and it stays. The frame never empties, for two reasons. The phase spread means half the arc length on the sheet is always drawn. And every ring keeps a hairline ghost circle, its engraved groove, so the grid holds even where the ink has just been erased. |
| Drop adds more concentric arcs in a second colour, not just thicker (floor); drop adds a second colour and a counter-rotating ring set (designer) | **Act** | The drop goes from 3 to 6 rings per cell and from 1 ink to 3, and odd rings sweep anticlockwise. All of these are params, so snapshots capture them. |
| Phase offset by distance from a point that wanders with each kick, a wave of closing and opening like a stadium card stunt (director) | **Act, my way** | The kick sends a ripple outward from a wandering origin. As the wavefront passes a cell, it advances that cell's phase by a quarter turn and briefly thickens and reddens its outer ring. The advance persists and relaxes slowly, so kicks leave interference in the phase field and minute ten is not minute one. The kick lands in a travelling ring, not the whole frame. |
| Breakdown slows the sweep to two bars (director) | **Act** | Sweep speed is a param: calm 0.5 (a two-second sweep, about a bar), drop 1.0 (Raph's original one second). |
| Drop doubles grid density (director) | **Reinterpret** | Three rows to four, not doubled. The grid scales continuously about the centre, so the drop reads as the sheet opening out, not a cut. |
| Swiss poster: grid of several concentric sets, a beat draws a quadrant in a different weight (designer) | **Reinterpret** | The grid is taken. The quadrant becomes the clap: a flat quarter-disc of the second ink, stamped into one cell, which then sweeps itself closed the way the arcs do. The backbeat becomes a separate, graphic event from the kick. |
| One line of type to anchor the page (designer); chapter captions (director) | **Reject** | Decoration. An all-over grid does not need an anchor, and type would make it a poster *of* a scene rather than the scene. |
| Retire it, or make it a layer inside Stargate or Orphism (psychonaut) | **Reject** | The judges' own reading (purist, curator) is that this grammar is the collection's seed. Orphism already grew it into painting; V2 grows it into a system. |
| "The purest gesture in the set, at a tenth of the size it needs" (curator); Rings + Arcs + Jags as one pencil "Line" scene | **Keep the purity, reject the merge** | The calm look stays one ink on one ground. Pencil lines on parchment are a different piece. |
| Cream grounds are floodlights (floor) | **Act** | The default ground is near-black with a bone ink and one vermilion. A cream "Plakat" daytime palette and the ColorLisa rows are one control away. |
| TASTE: no default rainbow or glow | **Act** | Flat inks, no additive light, no hue cycling. The V1 "Ring gradient" and "Cell gradient" HSB modes are dropped. |

## The plan

1. **Stage.** An all-over grid of cells that drifts slowly sideways and tiles
   beyond the frame. Each cell holds 1–8 concentric rings with the outer ring
   at 88% of the cell. Every ring has a hairline ghost circle under its sweep.
2. **Raph's sweep, unchanged, on a phase field.** The draw-then-erase rule
   from `Arcs.pde`, with phase integrated over time, so speed can glide
   without jumps. Phase offset = ring stagger + diagonal wave (X1/Z0/Z1) +
   kick ripples.
3. **Music vocabulary.**
   - *Kick*: a ripple from a wandering origin, confined to its travelling
     band. It whips a quarter-turn phase advance and briefly thickens the
     outer ring in vermilion.
   - *Clap*: a flat quarter-disc stamped into one cell, which sweeps itself
     closed.
   - *Bass*: line weight swells.
   - *Hats*: a small bead grows at each arc's leading tip.
4. **Drop as params**: Grid rows, Arcs per cell, Line weight, Sweep speed,
   Kick ripple, Inks, Counter-rotate. Plus `presets: { calm, drop }` and a
   `follow` param ("Follow the track", default on).

Not touched: the arc rule itself (twelve o'clock start, clockwise, round caps,
draw then erase), the ColorLisa palettes, and the Shuffle palette action.

## What changed (after building)

- **Stage**: an all-over grid, 3 rows in calm and 4 in the drop, drifting
  slowly left. Cells tile past every edge, so there is no centred emblem at
  any aspect ratio. Each ring keeps a hairline ghost circle.
- **The sweep is Raph's**, run on an integrated phase. The first build kept
  V1's small stagger (0.19 cycles a column), and the whole sheet still
  emptied together every other second (4.5 s and 20.5 s were near-bare). The
  diagonal wave now spans about one full draw-and-erase period across the
  visible sheet, so some cells are always drawing while others erase.
- **Colour per cell** (Raph's `(i*141+j) % 4` mode 0, now the default) with
  the first ink on two of the four slots. The first build coloured each ring
  in turn, and the drop turned into a field of identical bullseyes. Per cell
  reads as a printed poster: whole sets in bone, ochre or vermilion. Colour
  per arc stays as the Mode option.
- **Kick** is a ripple from a wandering origin. Cells whip a quarter turn
  forward as the front passes (the advance relaxes over ~7 s), and the outer
  ring flares thick in vermilion (or in bone, if the cell is already
  vermilion). **Clap** stamps a quarter-disc in an ink that is never the
  cell's own, which sweeps itself closed. **Bass** swells the weight. **Hats**
  grow beads at the arcs' moving ends; they show clearly in the build.
- **Palettes**: Tonhalle (near-black, bone, ochre, vermilion; the default),
  Plakat (cream, black, blue, red), then the 23 ColorLisa rows. V1's HSB
  gradient modes are dropped.
- **Performer**: params Grid rows, Arcs per cell, Line weight, Sweep speed,
  Phase spread, Kick ripple, Inks, Mode, Counter-rotate and Follow the track.
  Presets are `calm`, `drop`, `solo` (one frame-high set of 8 rings) and
  `field` (7 dense rows).

## Before / after

- V1: `harness/renders/orig/arcs-offset/sheet.png`, one crescent at 1% of the
  frame in every tile.
- V2: `harness/renders/v2/arcs/sheet.png` (same x.5 s frames). Intro and
  breakdown are a one-ink bone grid half drawn. The drop tiles (12.5, 14.5,
  16.5) are a three-ink poster of 6-ring sets with red kick flares and ochre
  or red clap quarters. The best single frame is
  `harness/renders/v2/arcs-720/frame-16.5s.png`.
- 96 s: `harness/renders/v2/arcs-96/sheet.png`. Each loop's drop and quiet
  look alike but never repeat exactly, because the kick ripples keep
  re-scrambling the phase field. Nothing saturates or dies.
- Jolt: calm. Drop kickArea 0.41, ratio 1.27 (the sweep itself moves a lot of
  the frame at Raph's one-second rate, so area is high while the ratio stays
  low). Build kick area 0.23, ratio 1.19.
- Cost: `renderTime` 4.6 ms mean at 1280×720 in software raster.

## Still to do

- The kick is legible mainly through the red flare. The quarter-turn whip is
  clear in motion but gets lost in the drop's constant sweep. A stronger
  ripple (Kick ripple > 1) or a slower drop sweep would make it read more
  like the director's card stunt.
- The 1-row Solo look with Plakat is striking (a giant black set and a blue
  one, with a blue clap quarter). It could become a third palette-bound
  preset if Raph likes it.
