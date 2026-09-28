# Grunge V2

**The piece in one sentence:** one enormous word, sliced into strips like a
headline run through a broken copier, that the music pulls apart and lets
fall back together: legible in the calm, shattered into sliding bands in the
drop, whole again in the breakdown.

## Scope: reconceptualization that keeps the print

Grunge ranked in the bottom 12 (mean 3.67; curator 2, psychonaut 2, designer
6). Every judge said the same thing in different words: *murk, no hierarchy,
nothing to watch, recombination without a rule.* The designer put it best:
"murky where Carson was precise even when illegible." V1 has ten kinds of
element (mixed-face headline, typewriter column, three to five bands, passers,
show-through, stamps, cone, tape, marks, second-ink block) all at partial
alpha on grey paper, so they average to grey. No tweak fixes that; the fix is
a new idea about what the type *does*.

What V1 got right, and I keep: the print process (generated newsprint, the
photocopy wear mask, inks multiplied so overlaps darken, second ink out of
register), the halftone speaker cone whose dust cap the bass pushes, the
rubber stamp, the original wording.

The new idea is a rule you can feel. Carson's most famous move is the
*sliced* headline: a word cut into horizontal strips that slip against each
other. Here that is the whole piece. The word is the anchor (the director's
"one big word per section"), and its strips *are* the bands that slide past
at different speeds (his parallax), so the two things he asked for become one
object. Legibility is the parameter: the calm aligns the strips into a word
you can read; the drop sets them crawling in opposite directions so copies of
the word stream past, legible only in part; the breakdown brings them back
into register. That is "legible in part" done on purpose.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| Murk, "mid-grey mud" (floor 4, psychonaut 2, director 4, designer 6) | **Act** | Solid ink only, no partial-alpha layers; lighter paper and dirt; a coarser, crisper halftone. Black, paper and one hot ink. |
| "No single thing to watch"; mirrored STATIC loses hierarchy (director) | **Act** | One word, one face, no flipped or swapped letters. Three levels of scale: the word, the cone, tiny furniture. |
| "Recombination without a rule you can feel" (purist) | **Act, as the new idea** | The rule is the slice: music shears the word; its legibility tracks the track. |
| "Pick one big word per section; bands slide past it at different speeds" (director) | **Reinterpret** | The bands are the word's own strips, so parallax and anchor are one object rather than type over type. |
| "Kick rips one band sideways and lets it settle back with overshoot" (director) | **Act** | Exactly this, on one strip of the word: a spring with overshoot. Confined to about a tenth of the frame. |
| "Drop flips the ink to one hot second colour" (director) | **Act, my way** | A torn slab of the hot second ink slides in behind the word and the strips are knocked out of it, reversed to paper. A change of state (curator theme 1), not more stuff. |
| "Breakdown strips back to a single band and the speaker cone" (director) | **Act** | Breakdown: the word reassembles, one small band, the cone. |
| FEEDBACK/STATIC/HUM should be hits stamped on the kick (floor transplant 5) | **Reinterpret** | The kick already has its verb (the rip). The clap gets the stamp: a rubber-stamped onomatopoeia (SNAP, CRACK) in one place, a different verb from the kick. |
| Body copy nobody will read; "the poster has eaten the collection" (curator theme 2) | **Act** | The typewriter column, the passers and the show-through are cut. Type is a shape and the word changes at section boundaries only. |
| "Carson without the eye. Cacophony." (curator 2) | **Act** | Negative space: about a third of the page is left as paper. |
| Words kill trance; "a murk of layered type" (psychonaut) | **Reject, partly** | It is a typography poster; with no word it is not Grunge. But the drop's streaming strips are a slit-scan you can stare into rather than read. |
| Designer's scale contrast and precision | **Keep** | Huge word cropped by the frame against 8-unit captions. |

## The plan

1. **The sliced word.** One word per page, in one heavy face (Anton, Archivo
   Black, Abril Fatface or Bebas, rotating per page), cap height about half
   the stage, cropped by the frame edge. Rendered once to a mask and drawn as
   5-14 irregular horizontal strips. Each strip sways, and with `shatter`
   crawls at its own speed and direction, the word repeating along it; as
   shatter falls the strips ease back into register.
2. **Kick rips one strip** sideways with a damped spring. Clap stamps one
   onomatopoeia. Hats: copier dust. Bass: the cone's dust cap and the strips'
   sway.
3. **The drop is a change of state**: a slab of second ink slides in behind
   the word with the strips knocked out of it; one to three small type bands
   (one a reversed bar); the word re-sets (strips fly out, new ones slot in)
   whenever the page crosses between calm and drop.
4. **Clean up the print**: solid inks, a coarser screen on the cone, lighter
   dirt, two layouts (word low with the cone up one side, word high with the
   cone below) mirrored.
5. **Performer model**: params `shatter`, `slab`, `bands`, `speed` are what
   the drop changes; `presets: { calm, drop }`; `follow` ("Follow the track",
   on by default) eases between them from the bass.

Not touched: the newsprint and wear textures, the cone's drawing, the palettes,
the stamp's inking, the out-of-register second ink.

## What changed

- **The sliced word** is the piece. One face per word, cap height 0.44 of the
  short side, cropped by the frame, drawn as 4-14 irregular strips from a
  cached mask. Most strips ride one long travelling wave (a third of a cycle
  over the word), so the drop shears the word into a curve you can still half
  read; every fourth strip slips on its own, and the whole word drifts like a
  slow marquee, settling on the nearest copy when the shatter falls.
  *Iteration:* the first build let every strip crawl independently, and the
  drop was a black-and-red checkerboard (V1's cacophony by another route). The
  long wave fixed it.
- **Kick** rips one strip (never the same or a neighbour twice running) with
  a damped spring through one overshoot. **Clap** stamps SNAP / CRACK / KRAK in
  the free corner, max three alive, red in the drop. **Hats**: copier dust.
  **Bass**: the dust cap and the ripple's width. **Build**: rising hats set the
  word trembling (a small shatter).
- **Drop = second ink as a state**: a torn slab slides in from the side away
  from the cone, the word knocked out of it to paper; bands 1-3 wipe on (the
  third a reversed bar in the second ink). Crossing into the drop re-sets the
  word (strips fly out, new ones slot in a beat later from alternating sides);
  crossing out re-sets the whole page to a new layout.
- **Cut**: typewriter column, passers, show-through, per-letter mixed faces,
  flipped letters, tape (it floated over the word). **Cleaned**: solid ink
  only, lighter paper and dirt, 9-unit halftone screen, lighter baffle.
- **Performer model**: `shatter`, `slab`, `bands`, `speed` are the drop;
  `slices`, `reaction`, inks and headline are character; presets `calm`,
  `drop` and `wreck` (shattered but one ink); `follow` default on, easing into
  the drop in about half a second and out in about a second and a half.

Jolt (640x360, seed 1): **calm**, drop kickArea 0.16, ratio 1.04 (build 0.17,
1.28). V1 was calm at 0.19 / 1.29.

## Before / after

- V1 `harness/renders/b5/grunge-720/sheet.png` vs V2
  `harness/renders/v2/grunge-720/sheet.png`. Intro (2 s): V1 is FEEDBACK in
  mixed faces over a grey column and grey cone; V2 is one black word, one band,
  a crisp cone and a third of the page left as paper. Drop (14 s): V1 is
  STATIC with a flipped S, a red block, ROAR, bands and stamps all at once; V2
  is STATIC knocked out of a red slab and shearing into black on the right,
  legible in part. Breakdown (22-24 s): V2's HUM, whole again, with the cone
  above it: the clearest exhale in the piece.
- 96 s (`harness/renders/v2/grunge-96/sheet.png`): eight different words, all
  four layouts, the four faces in turn; every drop is a different word knocked
  out of the slab (STATIC, LOUDER, REVERB, SUBSONIC) and every calm reads.
- Harness raster at 1280x720 (software, so relative only): p95 522 ms against
  V1's 1130 ms. The word is a handful of blits, and the column is gone.
- Best frame: `harness/renders/v2/grunge-720/frame-14s.png`.

## What I'd still do

- The intro and build are nearly the same picture (the tremor is small at
  distance). A build that visibly loads the drop, say strips beginning to
  slip one at a time, would give the arc a third act.
- The word swap at the drop is a busy half second while two words cross.
