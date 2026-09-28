# Jags — V2

## The piece in one sentence

Raph's zigzag lines, their height set by a band, become a record: each row is
cut as the music plays it at a seam through the middle of the stage, and the
rows flow outward from it as stacked strips of paper in the palette's inks, so
the whole frame is a flame-stitch chart of the last few seconds of the track.

## Scope: a reconception that keeps every part of the 2016 grammar

Jags ranked 66th of 72 (mean 3.0, spread 2). Every judge saw the same thing:
a pleasant palette on a buff ground, a band of lines in the middle of an empty
frame, and one reaction (every line thickens and heightens together with the
level). The Director's word is exact: an EQ in disguise. Tweaks cannot fix
that, because the problem is the rule itself: one number drives every line at
once, so the picture can only ever show *now*.

The reconception changes one thing about the rule. In V1 every line reads the
band at the same moment. In V2 each line reads it once, at birth, and keeps
it. Lines are born at a seam across the middle and travel outward both ways,
so the frame becomes the track's recent history: flat rows from the breakdown,
tall jagged rows from the drop, one taller row per kick. The height-follows-a-
band idea, the zigzag, the rotating stage and the ColorLisa palettes all stay;
what changes is that the image now has time in it.

Two things Raph's own sketch was already reaching for, I take literally:

- The commented-out lines in `Jags.pde` scale `yoff` by line index
  (`yoff *= (1 + 0.2 * l)`) and phase it per line (`frameCount / 10.0 + l *
  0.1`): lines that differ from each other. V2's rows differ because each
  remembers its own moment, and they widen as they travel out.
- `// TODO: modes: jags, sines...`: V2 has a Sharpness control that morphs the
  row from a sine to a jag, and the drop sharpens it.

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| "The bands just thicken with level. An EQ in disguise"; no arc | Director | Act | The core change: each row keeps the level it was born with, so the frame shows the build, drop and breakdown as a shape, not a meter. |
| A palette with no composition, "textile trim with nothing else on the page" | Designer | Act | The rows fill the whole stage, mirrored about a seam: a composition with a spine, edge to edge. |
| Turn it into a barkcloth border with margin and selvedge label | Designer | Reject | A printed label is decoration on the stage; the seam is the composition. |
| Thin zigzags on cream, "nothing to hold on to" | Floor, Psychonaut | Act | Filled bands of ink, not hairlines; the cream ground becomes one ink among several, so the frame stops being a floodlight. |
| Go dark | Floor | Reject as default | Flat daylight inks are the piece's one strength (Purist: "flat daylight years before TASTE.md asked for it"). The dark ColorLisa palettes are one click away. |
| Kick should send a spike along one line instead of thickening all | Floor | Reinterpret | The kick cuts one taller row with a thread of the palette's accent colour at the seam, which then travels outward. One row per beat, not all rows. |
| Stack the jags into parallax layers like a mountain range | Floor | Reinterpret | Real stacking instead of parallax: each strip lies over the one inside it and casts a hard shadow on it, like cut paper. |
| Needs density | Purist | Act | Forty-odd rows per side instead of ten lines. |
| Moiré Weave: two sheets a beat apart | Purist | Reject for this scene | It would make Jags a second Interference (which already owns moiré, and is V2'd). The "difference between now and a beat ago" idea survives as the row record itself. |
| Agnes Martin in waiting; "Line", hand-ruled lines on canvas | Curator | Keep as a mode | Thread mode draws the rows as V1's own lines on the ground, no fills: the quiet, ruled reading, with the same record. |
| Test pattern, nothing to follow | Psychonaut | Act | The outward flow, widening as it goes, is something to fall into; the rows are always moving. |
| Retire the originals or fold them into other scenes | Floor, Psychonaut | Reject | The brief is to give Raph's sketch a proper stage, not to bury it. |

Overlap I checked: Knit (batch 04) is also a record written row by row. It is
figurative (a panel on a table, needles, yarn balls, Fair Isle motifs); this
is a flat graphic of one rule, mirrored, with no objects. They share an idea,
not a look.

## The plan

1. **Rows are born and remember.** A seam across the middle of the (still
   rotating) stage cuts a new row every time the flow has moved one row
   spacing. The row records the height band, the sharpness, the ink and the
   phase at that instant; it then travels outward, accelerating and widening
   gently as it goes (Raph's `1 + 0.2 * l`), and is dropped past the corners.
   The same row is cut on both sides, so the stage is mirrored about the seam.
2. **Stacked paper strips.** Each row is a filled band of one ink from its
   zigzag outward, painted outer-over-inner with a hard shadow toward the
   seam. Crossing rows pinch the band between them, which gives the
   flame-stitch look for free. Thread mode keeps V1's lines instead.
3. **Music in three places.** Height band (default: the bass line) → the
   height of every new row, so the swell is visible as a shape. Kick → one
   taller row with a thread in the palette's most saturated colour, the only
   place that colour appears. Clap → the next rows are cut half a tooth out of
   phase, which leaves a herringbone break travelling outward.
4. **The drop, as params.** Flow speed, height, sharpness (sines → jags) and
   inks (two → all) are params; `presets: { calm, drop }` and Follow the track
   (default on) ease between them. Because every change is recorded at the
   seam, the drop visibly arrives in the middle and spreads to the edges, and
   the breakdown's flat, two-ink rows follow it out.

Not touched: the zigzag of 40-unit segments, the rotating stage and its speed
units, the 23 palettes and Shuffle, band params for height (and the
original's line-weight band, in Thread mode).

## What changed

Built as planned, with one idea replaced and two added after looking:

- **Rows as a record.** Done as planned: a row is cut at the seam every 12
  units of flow (sooner on a kick), keeps its height, sharpness, ink, phase and
  kick, and travels out on both sides, speeding up and widening with distance
  (`1 + d / 420`). Rows past the corners are dropped. At start-up the stage is
  pre-filled with a quiet record, so the first frame is already full.
- **Cut paper.** Filled bands, outer over inner, with a hard offset shadow
  toward the seam. The shadow is subtle at 720p (a thin darkening on the flat
  runs), which is right for flat daylight inks; it is not doing much depth
  work.
- **The clap changed.** The planned half-tooth phase flip looked like a
  herringbone on paper, but with teeth three times the row spacing the rows
  crossed everywhere and the drop shattered into cells (first render, 14 s).
  The clap now cuts a row twice as wide, in the ink furthest round the
  sequence: the backbeat becomes broad stripes between the kick threads.
  The kick's own height bump went from 16 to 5 units for the same reason.
- **Kick threads on top.** Under the next strip they were cut to red slivers
  wherever the teeth are steep; they are now drawn above every strip, thin
  (1-2.4 units, widening outward), in the palette's most saturated colour.
- **Added: hats sharpen.** Rows cut while the hats play are pointier, so the
  build turns sines to points before the drop's jags arrive.
- **Added: a night preset.** The Floor judge's dark room as a look (palette
  21: plum, slate, sea-green, cream saved for the drop), not the default.
- Params: Palette, Style (Cut paper / Ruled lines), Flow, Jag height, Sines to
  jags, Inks, Rotation speed (the original's units, default 0.3, about six
  minutes a turn), Zigzag height band (default band 1, the bass line; the
  original's hard-coded 5 is one click away), Follow the track. Presets calm,
  drop, ruled, night. Shuffle palette kept; the shuffled inks enter at the
  seam and travel out, as does any palette change.

Jolt (640×360, seed 1): **calm**, ratio 1.12 (build kick 1.33). The area
numbers are high (0.70-0.82) because the whole field is always flowing
outward, so any 0.15 s window changes most of the frame with or without a
kick; the heat map shows the kick itself only at the seam. renderTime at
1280×720 mean 8 ms, p95 11 ms in SwiftShader (JS 0.3 ms): about 100 filled
polylines a frame.

## Before/after

- V1 `harness/renders/orig/jags/sheet.png`: a band of ten lines in the middle
  of a buff field, every tile the same picture at a different level.
- V2 `harness/renders/v2/jags/sheet.png`. The arc is the thing to look at:
  2-6 s quiet two-ink sine stripes; 8-10 s red kick threads start streaming
  from the seam; **12 s** (`harness/renders/v2/jags-720/frame-12s.png`) the
  drop arriving in the middle as tall three-ink jags with a diamond spine
  while the edges are still the build; 14-16 s the whole stage in flame
  stitch; 20-24 s the breakdown's flat stripes pushing the drop out to the
  corners.
- `harness/renders/v2/jags-96/sheet.png`: the slow rotation turns the spine
  from diagonal to vertical over 96 s, so each drop lands in a different
  composition. `jags-ruled/` is Ruled lines on palette 8; `jags-p20/` the
  night palette.

## What I'd still do

- Make the seam more of a place: it reads in the drop (the diamond spine),
  but in quiet passages it is just a slightly different stripe.
- The shadow could carry real depth with a larger offset on the drop.
- In Ruled lines on palettes whose most saturated colour is also dark, the
  kick thread is hard to tell from the other lines.
