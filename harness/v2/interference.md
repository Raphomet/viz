# Interference V2

**The piece in one sentence:** two near-twin sheets of lines stacked like
transparencies, where the music only ever nudges a phase and the moiré does the
amplifying, so a pixel of movement becomes a fringe sweeping the stage.

## Scope: precise tweaks, not a rethink

Ranked #9 of 72, with the two judges who look hardest at systems (Purist,
Curator) both at 9. The system is the soul and it is right. What the lower
scores are really about is the *carrier*: the lines are fine enough to buzz on
the eye and to alias on a projector, and the half-weight lines leave a
mid-grey field that lights the room. Plus one real opportunity the Curator
named: the drop adds, it doesn't restructure. So: three changes to the
material and the drop, nothing to the idea.

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| The system, near-twin sheets, kick as phase echo, no illustration | Purist, Curator | Keep | This is the piece. |
| Drop bubbles into cells, breakdown snaps clean: a legible exhale | Director | Keep | The reset is the best breakdown device in the scene; protect it. |
| Fine black-and-white lines at full screen buzz on the eye | Psychonaut | Act | Coarser, heavier carrier: the fringes grow with the period, so it gets bolder, not busier. |
| On a projector moiré turns to shimmer and aliasing | Floor | Act (partly) | A wider period survives a rescaler; the moiré itself is the subject and stays. |
| Mid-grey dulls the room | Floor | Reinterpret | Not a dark ground or inverted lines (that loses the stacked-transparency logic): heavier lines, so out-of-step troughs go truly black and the room darkens by itself. |
| Sheets could swing from diagonal to vertical on the drop (structural change) | Curator | Reinterpret | Not a rotation of the picture (a global move), but the moiré lever: turning one sheet by about a degree swings the *fringes* by up to a quarter turn. The drop turns the fringes across the lines; the breakdown lets them fall back into line. |
| Loom: knitted indigo and cream sheets | Psychonaut | Reject | A different scene; two inks would soften the black-and-white-plus-one-red that is the point. |
| Moiré Weave: sheets of Jags polylines from the spectrum | Purist | Reject | Draws the music with the lines; this piece's virtue is that it never does. Worth its own scene. |
| One red accent is the right colour strategy | Curator | Keep, and make it read | The threads are hairline; at the back of the room they vanish. Widen the cores a little so the kick's red reads, still only where the echo passes. |

## The plan

1. **Carrier for the room.** Default spacing 7 → 10 units (range 6–18), line
   weight 0.5 → 0.6. Darker mean, black troughs, fringes 1.4× larger, less
   buzz. Raise the anti-strobe floor slightly (period never under 6 device px).
2. **The drop turns the fringes.** A section-level envelope (slow attack over
   the drop, slower release) adds a relative turn between the two sheets; with
   the sheets near-parallel, a degree of turn swings the fringe field from
   running with the lines to cutting across them. Each clap adds a small eased
   nudge to the turn, so the snare has its own event (the fringes lean) distinct
   from the kick (a ripple travelling out). Continuous, never a cut; the
   breakdown's relaxation is the snap-clean the Director liked.
3. **Accent that reads.** Wider fringe cores for the vermilion (still gated by
   the passing echo and the phase-gradient guard), so each kick leaves a red
   thread visible at contact-sheet scale.

Not touched: the geometry (currents → arcs → rings over ~170 s), the echo, the
multiply/exclusion blends, the no-glow, one-accent finish, the controls other
than defaults and one new "Drop turn" control.

## What changed (after building)

1. **Carrier.** Spacing 10, weight 0.6, anti-strobe floor at a 6-px period.
   Out-of-step troughs are now true black and the fringes are 1.4× wider;
   the field reads as bold black-and-white bands instead of fine grey texture.
2. **Drop turn** (new control, "Drop turn", 0–2). A doubly smoothed bass level
   turns sheet 2 by up to 0.034 rad; it arrives between about 10.5 and 13.5 s
   and is gone by 20.5 s. Checked in isolation (push 0, waviness 0): with no
   turn the frame is one broad fringe; at full turn the fringes cross the lines
   at right angles. In the full scene it crosses the kick's ripples and turns
   the drop into a lattice of cells; as rings it multiplies the fringes fanning
   from the knot (96 s run, 60 s vs 72 s).
3. **Clap wave.** Claps (fast-minus-slow envelope on bands 3–5, 0.8 s
   refractory so a snare roll doesn't shiver) send a wave of phase through
   sheet 1 that sweeps *along* the lines from alternating sides, at twice the
   kick echo's speed. The kick and clap histories share one `vec3 hist[96]`
   uniform, so it costs no more uniform space than V1.
4. **Accent.** Cores widened (smoothstep 0.84–0.99, echo gain 1.8) and
   default 0.6: the red threads now read at contact-sheet scale.

Dead end, kept as a lesson: my first clap idea rocked the drop turn a little
on each clap. Turning a sheet swings the *whole* fringe field, so it measured
jarring (build kick area 0.75, drop 0.54). The same happened when raw bass fed
the turn, because each build kick nudged it. The rule: anything that moves a
sheet globally has to move at section speed, and beat events have to travel.

## Before/after

- Jolt (640×360, seed 1): V1 drop kickArea 0.38 / ratio 1.16, build 0.10 /
  1.12. V2 drop 0.48 / **1.10 (calm)**, build 0.27 / 1.13. The larger area is
  the wider fringes; the ratio, i.e. how much the kick stands out from drift,
  is unchanged.
- Room: V1 `harness/renders/final2/interference/frame-12s.png` vs V2
  `harness/renders/v2/interference-720/frame-14s.png`: same system, darker
  mean, blacker troughs, heavier lines, red that reads.
- Drop and reset: `harness/renders/v2/interference-720/sheet.png`, 12–18 s
  cells, 20–24 s clean diagonals.
- Arc: `harness/renders/v2/interference-96/sheet.png`; best frame
  `harness/renders/v2/interference-96/frame-60s.png` (rings in the drop, a fan
  of fringes with red threads).

## What I'd still do

- The drop turn is legible in isolation but in the default drop it shares the
  frame with the kick ripples and waviness, so it reads as "cells" rather than
  as a clean quarter turn. A performer can push it (Drop turn 2, Waviness
  0.3) for a crisp crosshatch; I left the default busy because it moves
  better.
- Nine controls, one over TASTE's 4–8. Drop turn earns its place; if one
  goes, it should be Accent, which could be tied to Music push.
- The clap wave is subtle at contact-sheet scale. It is a motion event, so it
  needs a real screen (`harness/fps.mjs` / the app) to judge.
