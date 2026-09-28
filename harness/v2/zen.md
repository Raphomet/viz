# Zen — V2

## The piece in one sentence

A dry garden seen from above, where the music presses into the gravel and a
rake, always at work, slowly combs it away again.

## Scope: a focused revision, not a reconception

Zen ranked #12 (6.83) with a narrow, friendly spread: five of six judges named
the same soul (the rake as a character with a job, the kick confined to one
ring round one stone, matte daylight materials, patterns *drawn* rather than
swapped). Nothing about the idea is broken, so I keep all of it. What is weak
is the idea the V1 only half-had: the kick's ring vanishes in two seconds, so
the garden forgets the music at once, while the leaves are the one thing that
remembers and nothing clears them. The fix to both is the same move, and it
is the scene's own logic: **the kick presses the gravel, and the pressing
stays until a rake passes over it.** Everything else in V2 serves that loop or
the two weak judgements (too pale, too still).

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| The rake is a character with a job; keep it | Director, Designer | Keep | It is the soul of the piece. |
| Patterns are drawn by the tool, not swapped in | Purist | Keep, and extend | So the drop's instant "re-raking wave" (a magic swap) goes; the drop re-rakes by hand instead. |
| One pressed ring per kick, confined | Floor, Curator, Director | Keep | The confined kick is already exemplary (jolt 0.05 area). |
| Leaves pile up and are never swept; accumulation without erasure | Curator | Act | The rake becomes the eraser for everything: rings and leaves persist until a rake passes. |
| Breakdown should clear something; the rake smooths the rings flat | Director, Curator | Act, my way | Not a breakdown-only event: clearing is continuous, and the breakdown is when one slow rake catches up with the drop's record. |
| Persistent world-space record (from Stamps) | Purist | Reinterpret | The record is the pressed rings themselves, erased row by row, not a texture. |
| Floodlight-beige ground on a projector | Floor | Act, partly | Lower, warmer sun and darker gravel so the relief carries the image, not the albedo. Stays daylight: making it a night garden would trade its range for the house style. |
| Meditative, but almost still | Psychonaut | Act | A sun that travels (shadows and groove relief turn slowly), a push-in on the drop, and more hands raking in the drop. |
| Camera push-in on the drop | Director (transplant from Mobile) | Act | A slow descent onto the stone being pressed, rising again in the breakdown. Big drop, no jolt. |
| Every scene needs a clock slower than the song | Purist | Act | The sun's slow arc is that clock. |
| Sand Dancers: footprints and invisible dancers | Floor | Reinterpret | The drop's extra rakers are those dancers, with the same visible tool. |
| Sand Rose: mirror it six ways, Chladni modes | Psychonaut | Reject | Symmetry and nodal patterns would turn a garden into a kaleidoscope; its asymmetry is the point. |
| Better in daylight than at 2 a.m. | Floor | Reject as a change | That is a programming note, not a design flaw. Black sand stays as the night option. |

## The plan

1. **Pressed rings persist until raked.** Each kick presses a ring (marching
   outward, five per stone, round the three large stones in turn). A fresh
   press is deep and dark, then relaxes to a lasting impression. A ring stays
   wherever no rake has passed since it was pressed; each row remembers when
   the rake crossed it, so a rake cuts rings off along a hard, straight row
   edge. The drop builds a record; the breakdown slowly combs it out.
2. **The drop brings more rakers.** Up to three helpers walk in from the
   edges on the drop, each taking the stalest row, all raking the garden's
   next pattern at the bass's pace. They finish their rows and walk off when
   the bass goes. Replaces the instant re-raking wave. Leaves too are swept by
   any passing rake.
3. **The sun travels.** Azimuth swings slowly (a ~3 minute arc), so stone
   shadows turn and grooves gain or lose relief as their angle to the sun
   changes. Sun lower and gravel darker by default, so the ground stops being
   a lamp. The drop is still the sun coming out; the breakdown still a cloud.
4. **Drone push-in on the drop** towards the stone being pressed, out again
   in the breakdown, eased over seconds.

Not touched: the height-field shader and its seven patterns, stones and moss,
maple dapple, the leaf shape and snare leaf-fall, hats as mica glints, the
serpentine main rake, the three light presets.

## What changed

All four planned changes landed, plus two small tunings the renders asked for.

1. **Pressed rings persist until raked.** 15 ring slots (five per large
   stone); the kick presses the next one outward, ten kicks per stone. Each
   row stores its last pass (start, end, direction, pattern) and each working
   rake its start time and x, so the shader interpolates *when the tines went
   over this pixel* and draws a ring only if it was pressed later. A fresh
   press is deep and dark (the beat), then relaxes to a lasting 0.7-depth
   trench with compacted, darker gravel so it still reads under cloud.
2. **The crew replaces the re-raking wave.** On the drop the garden's next
   pattern is chosen and up to three helpers (param *Rakers in the drop*, 0-3)
   walk in on the stalest free rows; the main rake's serpentine skips rows they
   hold. Helpers keep the drop's pace after the bass goes and hurry off once
   dismissed, so the breakdown is back to one slow rake within a few seconds.
   Any rake sweeps resting leaves; leaves otherwise stay (up to 24, the oldest
   fading when the cap is hit) instead of V1's 30-40 s timed fade.
3. **The sun travels** (*Sun travel* param, a ~190 s arc of plus or minus
   0.8 rad, lower at the ends). Afternoon is lower (elev 0.46 vs 0.62) with
   darker, less yellow gravel.
4. **Drone push-in** on the drop: zoom 1.07 to 1.27 towards the stone being
   pressed, eased over seconds, drift damped while pushed in.
5. Tuning: rake handles shortened (250 to 190) and helpers' tilt reduced,
   because four long handles read as pick-up sticks; groove amplitude 0.21 to
   0.18, because under the lower sun the dark flanks went to black stripes.

Jolt (640x360, seed 1): **calm**, kickArea 0.133, kickMean 0.034, drift
0.028, ratio 1.22 (V1: area 0.052, ratio 1.53). The heat map shows the kick
confined to the ring being pressed; the extra area is the push-in and the
crew moving, which is drift, not beat.

## Before/after

- V1 `harness/renders/b4/zen-720/sheet.png` vs V2
  `harness/renders/v2/zen-720/sheet.png`: V1's 12-16 s drop has one faint
  ring that is gone by the next tile; V2's drop tiles carry nested rings round
  two stones, three extra rakers and a visible descent.
- `harness/renders/v2/zen-720/frame-16s.png` (best frame): the upper-right
  stone's pressed rings sliced off by freshly raked rows along hard straight
  edges, the record and its erasure in one image.
- `harness/renders/v2/zen/sheet.png` 18-24 s: the crew leaves, the zoom
  eases out, and ring fragments remain in unraked rows under the cloud.
- `harness/renders/v2/zen-96/sheet.png` vs V1's 96 s sheet: shadows point a
  different way at 12, 60 and 96 s (the sun has moved); ring remnants survive
  into the 48 s and 72 s intros; each drop brings a new pattern
  (checkerboard, ripples, arcs) laid by hand. (The 96 s run predates the final
  groove-amplitude tweak, a small contrast change.)

## What I'd still do

- The overcast intro is honest but plain grey; a faint cool/warm split
  between shade and open gravel would make the cloud feel like weather.
- Rakes are still drawn as flat Canvas 2D sticks over the lit ground; giving
  the tines a trough they visibly drag (a local groove highlight just behind
  the head) would sell the tool writing the field.
- Software-rasterised renderTime rose (p95 293 to 442 ms at 720p) but the
  machine was heavily loaded by parallel renders; confirm with
  `harness/fps.mjs` on the GPU. The ring loop early-outs on pass time and
  indexes the stone distances directly.
