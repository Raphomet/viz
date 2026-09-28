# Vorticism — V2

## The piece in one sentence

A BLAST-pink broadside that is all vortex: the whole sheet is cut into hard
angular planes that spiral forever into one still black eye, and the headline
is stencilled out of a black slab so the vortex pours through its letters.

## Scope: a reconception that keeps the sheet

Vorticism ranked in the bottom 12 (mean 4.0, spread 4). The judges agree on
the diagnosis from different angles: a pink wall with type on top (Psychonaut,
Director), a vortex that does not read as one because the shards are sparse
and scattered (Designer), a composition that never moves and looks the same at
96 s as at 24 s (Director, Purist, Curator), and a card nobody can read
(Floor). The V1's parts were individually right (the ink, the slab type,
HAIL/SCORN) but its central idea, the vortex, was drawn as confetti. So I keep
the poster, its inks and its words, and rebuild the one thing the movement is
named after. Pound's vortex is "the point of maximum energy": in V2 it is not
an object on the page, it *is* the page.

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| Shards too sparse; the vortex should consume the page | Designer | Act | The core change. The sheet becomes a full tessellation of angular planes on a logarithmic spiral grid, jittered at the nodes so the cells are Lewis's blades and wedges, not a dartboard. No pink wall anywhere. |
| ROAR sits on top of the vortex instead of being part of it | Designer | Act, my way | The word is knocked out of a black diagonal slab and the vortex continues through the letters in inverted inks. It is cut from the vortex rather than laid on it. |
| No depth; flat pink | Director | Act | The planes stream endlessly inward toward the eye (an infinite log-spiral zoom in flat print). Depth comes from scale and flow, not glow. |
| ROAR never moves | Director | Act | The slab swings steeper and thicker into the drop, and the headline changes word per section with a wipe along the slab. The vortex moves inside the letters at all times. |
| Headline per section (transplant from WPA and Cubist) | Designer | Act | A quiet word (HUSH) in the intro and breakdown, ROAR in the drop. It gives the track a legible arc without a global flash. |
| A loud pink wall / static and shouting | Psychonaut, Curator | Act | The spiral tunnel gives the altered viewer somewhere to fall into, and the calm state is mostly keylines on pink (a whisper), so the drop's full inking is a real change. |
| Nearly identical at 96 s; needs a clock slower than the song | Purist | Act | The eye wanders slowly over the upper sheet on a ~3 minute path, so the whole spiral re-composes itself; the manifesto cycles its lines. |
| Set-list card nobody can read | Floor | Act | The slip now carries two lines at a size you can read across a room: HAIL + one thing, SCORN + one thing, turning over every bar. |
| Onomatopoeia stamped on the kick (transplant from Futurist) | Floor | Reject | That is Futurism's device; the Curator already finds these four red manifestos alike. Vorticism's kick should be the vortex doing its one job: drawing energy in. |
| Four loud manifestos; keep one (merge into Constructivist) | Curator | Reject | Not a design fix. V2 answers it by being unlike Constructivist: spiral not diagonal bars, pink not red, a whole-sheet texture not a layout of pieces. |
| Illustration with a beat; find the process | Purist | Reinterpret | The process here is the ink plates: calm is one keyline plate, the drop lays the black, steel and ochre plates, a hair out of register. |

## The plan

1. **The vortex is the sheet.** A log-spiral grid (about 11 arms, rings
   shrinking by ~0.8) with jittered nodes and some cells split into two
   wedges, covering the whole frame, streaming inward continuously; speed
   follows the bass. Cells keep their identity (hash of ring and arm) as they
   travel, so nothing flickers. A few arms are biased dark so the spiral reads.
2. **The stencilled headline.** A full-width black slab on a diagonal below
   the eye; the word is cut out of it and filled with the vortex in inverted
   inks (drawn to an offscreen layer and masked by the letters).
3. **Music in separate places.** Kick: a charge of cream runs down one arm into
   the eye, which ratchets a notch (arm advances by the golden angle). Snare:
   one ring of planes inverts its inks and is carried inward. Hats: cream
   needles along the spiral. Bar: the manifesto turns over. Bass: drain speed
   and eye size.
4. **The drop as plates and params.** Ink coverage, drain speed, twist, the
   ochre plate and the headline (quiet ↔ loud, which also swings the slab) are
   ordinary params with calm/drop presets; `follow` ("Follow the track",
   default on) lets the audio push them toward the drop.
5. **A slow clock.** The eye wanders on a slow Lissajous in the upper sheet.

Not touched: the pink/puce/raw-paper grounds, the flood and wear textures, the
nested-square eye, HAIL/SCORN copy, the small print.

## What changed

- **The vortex is the whole sheet.** 11 arms × ~23 rings of jittered, partly
  split planes, streaming inward on one continuous log-radius phase; three dark
  arms keep ink even in the calm so the spiral always reads. No pink wall is
  left anywhere (V1 frames were ~60% bare ground).
- **The headline is stencilled.** A full-width black slab hung from the word's
  lower left corner; the word is a mask on an offscreen layer with the vortex
  repainted into it in inverse inks (no black, so the letters never erode into
  the slab). The subline and small print ride on the slab in paper.
- **HUSH → ROAR per section**, the letters dropping out and in one at a time
  like sorts changed in a forme, while the slab swings from ~9° to ~13° and
  thickens.
- **The manifesto slip** now carries one HAIL and one SCORN at a readable size,
  rolling over every bar.
- **Kick** = a paper charge down one arm into the eye (inner half only), plus
  the eye's ratchet. **Snare** = one ring turns to inverse inks and drains in.
  **Hats** = paper needles along the spiral.
- **Performer model**: `follow` (default On), `ink`, `speed`, `twist`, `ochre`,
  `shout`, `reaction`, ground; presets `calm`, `drop` and `plates` (a dense,
  tightly twisted look under the quiet word).
- **Slow clock**: the eye wanders on 171 s / 113 s periods.

Tuning after the first look: the first cut hung the slab from its centre, so a
steep ROAR ran off the bottom-left corner; the slab is now hung from the word's
foot. Calm ink went from 0.3 to 0.15 so the breakdown truly exhales. Jolt was
first "noticeable" (area 0.30): the charge started in the huge outer cells and
the drain's speed took the bass with a fast attack, so the whole sheet surged
on every kick. The charge now starts halfway in, the drain follows a slow bass
envelope, and the drop's speed boost is smaller.

Jolt (640×360, seed 1): **calm**, drop kickArea 0.24, kickMean 0.071, drift
0.028, ratio 2.47; build kick 0.23, ratio 1.81. Almost all of the measured area
is the continuous drain of the big outer planes rather than the kick itself; it
sits just under the 0.25 line, so turning `speed` up in a set will read as
"noticeable" motion, which is the flow, not a pulse.

## Before/after

- V1 `harness/renders/b5/vorticism-720/frame-14s.png` vs V2
  `harness/renders/v2/vorticism-720/frame-14s.png`: V1 is pink ground with
  shards and a word on top; V2 is a sheet entirely made of the vortex with the
  word cut out of it.
- Calm vs drop: V2 `frame-04s` / `frame-22s` (keylines, HUSH) against
  `frame-12s` / `frame-16s` (plates, ROAR, steeper slab). V1's intro and drop
  tiles differed mostly in shard count.
- 96 s (rendered at 640×360 for machine load): `harness/renders/v2/vorticism-96/sheet.png`, where the eye has moved
  and the spiral has recomposed; V1's 96 s tiles are near-identical.

## What I'd still do

- Letter interiors can be busy when a plane edge crosses a thin stroke; a
  simplified two-ink palette just for the stencil would read even more cleanly
  from the back of a room.
- Check `harness/fps.mjs` at full screen: the offscreen stencil repaints the
  vortex a second time each frame (a few hundred paths, plus two full-canvas
  blits); JavaScript is ~1 ms a frame, so the raster is the only question.
