# Text — V2

## The piece in one sentence

A word the size of the stage, stippled in thousands of dots and printed in two
riso inks that drift out of register with the pad, where each kick prints one
letter in a third ink and the drop breaks the word into a stream of dots that
settles into the next word.

## Scope: a reconception that keeps the 2016 spark

Text came last of 72 (mean 1.83). Six judges used the same word: a logo. A
dotted "VIZ" the size of a postage stamp, white on black, one reaction (every
dot inflates with its band), so the drop is only the logo getting fatter until
it goes to "white mush". Tweaks cannot fix that: the problem is that the word
is an emblem, and the only thing the music does to it is scale it.

What Raph's sketch was reaching for is worth keeping whole: **live type made of
dots, which the music deforms until the dots fuse** (the Purist's "at least a
rule"; the metaball on the drop is the one moment in V1 that is a picture). V2
keeps: dots as the material of the letters, a performer-typed word, the
ColorLisa palettes and their shuffle, a Sensitivity control, dots that fuse
when the bass swells. It changes what the letters are made of (a filled
stipple, not an outline), what they are printed in (flat inks on a ground, not
white on black), how big they are (the stage), and what the music does (four
different reactions in four different places, and a drop that changes the word).

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| "A logo, not a work"; "an ident"; "a watermark"; "a test pattern" | all six | Act | The word becomes a material (stipple in two inks) set at stage scale, not an emblem floating in black. |
| The drop turns it to white mush / blobs balloon: "a meter with a logo" | Curator, Director, Designer | Act | Dot size follows a slow bass swell, not every band per dot, so the dots fuse into solid ink on the drop without ballooning on each beat; the per-dot band sizes are gone. |
| Make the letters actors: each takes a beat in sequence; on the drop they break into dots and swarm into a new word; they reassemble slowly in the breakdown | Director | Act | The spine of V2. Each kick prints the next letter in reading order (it squashes like a platen and takes the third ink). A drop, and every few bars inside it, sends the dots streaming across the stage into the next word of the phrase. |
| Set a real word in a real face at poster scale; let the kick spread the ink, not inflate the letters | Designer | Act (face, scale); Reinterpret (ink) | A heavy grotesque from the poster faces, fitted to the stage. The kick squashes one letter flat and wide, which is the ink-spread gesture, done with dots. Letterpress already owns paper and impression, so no paper texture here. |
| Centred emblems persist | Purist | Act | The word fills the stage edge to edge; the dust and the swarm use the whole frame. |
| Fold it into Dot Matrix / retire the originals / make it a layer | Floor, Psychonaut, Curator | Reject | Dot Matrix is a grid of LEDs; this is a hand-feeling stipple. Burying Raph's first sketch is not a redesign. |
| A "message" scene that sets a DJ-typed line big | Floor | Act, lightly | The Words param takes a phrase (words split by "/"), and the drop walks through it. The default leads with VIZ, for the lineage. |
| Nothing to fall into | Psychonaut | Act | Two inks sliding over each other, a continuous dust flow, and dots that stream in curling rivers between words. |
| Letterpress is a better title card | Curator | Noted | So V2 does not try to be one: no paper, no ornaments, no second typeface. |

## The plan

1. **Stipple type at stage scale.** The word is rasterised once in a heavy
   poster face (Archivo Black by default), fitted to the stage, and filled with
   a fixed number of dots on a jittered hex lattice. Dots shrink toward the
   letter edges, so the edges stay crisp like a stipple engraving. Every word
   gets the same number of dots, so a change of word is the same dots moving.
2. **Two inks, one ground.** Each dot is printed twice, in a key ink and a
   second ink, overprinted (multiply on a light ground, screen on a dark one),
   so the letters read in the dark mix of the two. The second ink's plate is
   offset by a slowly turning registration vector whose size follows the pad
   (bands 2–4): the breakdown floats out of register in coloured fringes; the
   drop's bass swell pulls it back and fuses the dots (Raph's metaball).
3. **Four reactions, four places.** Kick → the next letter in reading order is
   pressed: it squashes flat and wide and prints in the palette's third ink,
   then relaxes. Clap → that letter sheds a spray of dots that drift off into
   the dust. Hats → the dust sparkles. Bass (slow) → dot size, so the letters
   go from open stipple to solid ink.
4. **The drop changes the word.** At the drop (and every few bars inside it)
   the dots leave their letters in a left-to-right wave, stream along curling
   paths drawn as short streaks, and settle into the next word. In the drop the
   settled dots keep swimming slightly; in the calm they sit still.
5. **Performer model.** Swarm, Dot size, Misregistration, Bars per word and
   Dust flow are params; `presets: { calm, drop }` plus `night` (a dark
   palette, screen inks); Follow the track (default on) eases between calm and
   drop; a Next word action.

Not touching: the dots as the only mark; the typed word; the palettes and
their shuffle; Sensitivity. Not adding: glow, a spectrum, a dark default.

## What changed

Built as planned, with three revisions after looking:

- **One plate per dot, not every dot on both plates.** The first build printed
  each dot twice, and the teal × red overprint read as near-black with thin
  fringes: two inks you could not see. Now each dot sits on one plate, so the
  stipple is visibly teal and red side by side, dark only where dots touch,
  and misregistration shifts half the dots, which reads as the word doubling.
- **The press is shape, not motion.** The kicked letter's squash was first
  written into the dots' positions, so the velocity streaks smeared it into
  vertical fur. The press is now applied at draw time only; the kicked letter
  squashes cleanly and snaps into register in the third ink. Its dot growth
  was cut from 30% to 12% and the squash from 20% to 14%, because on the first
  drop kick the Z went to a solid slab (the "mush" the judges hated).
- **The calm breathes.** A slow orbit of about one unit about each dot's home
  even at Swarm 0, and misregistration pushed harder by the pad (up to ~17
  units in the breakdown), so a held word is never a still.

Params: Words (split with /), Typeface (five heavy poster faces), Palette,
Swarm, Dot size, Misregistration, Bars per word, Dust flow, Dots, Reaction
(V1's Sensitivity), Follow the track. Presets: calm, drop, night (palette 21,
screen inks on plum). Actions: Shuffle palette (Raph's), Next word.

Dropped from V1: the five modes (white/palette dots and rings, Igor heads) and
Band drift. They were variations of one mark; the palette and the two plates
now do that job.

## Before/after

- V1 `harness/renders/orig/text/sheet.png`: a small white outline "VIZ" in the
  middle of black; the drop inflates it to blobs.
- V2 `harness/renders/v2/text-720/sheet.png`: the word fills the stage in two
  inks from the first frame; at 10 s the first drop kick presses the Z green;
  12 s (`frame-12s.png`, the best frame) the dots stream out of VIZ into MOVE;
  14–16 s MOVE and TOGETHER, lively; 20–24 s VIZ again, out of register.
- `harness/renders/v2/text-jolt/heat.png`: each kick lights exactly one letter.
  CALM: drop kickArea 0.157, kickMean 0.042, drift 0.022, ratio 1.98; build
  kick area 0.064, ratio 1.44. The first drop kick's window overlaps a word
  change, so part of its area is the swarm, not the kick.
- `harness/renders/v2/text-96/sheet.png`: 96 s, a different word or phase in
  every tile, no saturation. `harness/renders/v2/text-night/sheet.png`: the
  night palette.

## What I'd still do

- The hat sparkle in the dust is faint at 640×360; it reads at 720p but could
  be bolder.
- A longer default phrase would let the drop walk further before it returns
  to VIZ; the right words are Raph's to choose.
