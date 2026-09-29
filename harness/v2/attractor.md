# Attractor V2 — redesign note

**Scope: three precise changes.** V1 ranked #2 of 72; it is nearly there. The
image is right. What is missing is the music you can *see* and a little depth
and craft at minute two. So this is a tune-up, not a reconception.

## The piece in one sentence

A strange attractor photographed on a long exposure: champagne filaments on
black, coloured by the age of their own light, morphing without ever jumping.

## Feedback triage

Scores: floor 6, psychonaut 8, designer not seen, purist 8, director 7,
curator 9. (The first draft of this table was written from the curator's row
alone after a tool-permission block; it was completed from all six files
after the build, and the last two rows record what that changed.)

| Point (who) | Verdict | Why |
|---|---|---|
| One orbit, long exposure, champagne and steel; floats on black "and it doesn't need" a backdrop; breakdown thins to countable threads (curator 9) | **Keep** | The soul. Nothing below may dilute it. |
| Breathes wider in the drop, thins to hairlines in the breakdown: "a lovely diminuendo" (director 7) | **Keep, and make surer** | This seed's forms didn't thin on their own, so V2 adds push/pull development by section energy. |
| Light-age colour makes motion itself visible (psychonaut, curator, purist; transplanted by two of them) | **Keep** | The piece's best idea; the lamps are built in the same two inks. |
| Lyapunov guard is exactly the right algorithmic care (purist) | **Keep, tune** | Released faster after a 96 s run spent a drop dimmed after the orbit had already recovered. |
| The kick is invisible: V1 jolt ratio 1.17; TASTE "every beat must be seen" (jolt run; no judge said it in so many words) | **Act** | Kick and clap lamps: one stretch of wire, hot ink / cool ink, opposite sides. |
| "Floats in a void with no depth"; give it motes or a far haze (psychonaut 8) | **Reinterpret** | Depth from the orbit itself (the delay-embedded 3D turn, far points dimmed), not added motes: the curator's point that it needs no backdrop is the stronger one, and motes would be a second subject. |
| "A centred object" (floor 6); "an object that stays centred" (director 7) | **Reject, after trying it** | A bass-driven camera push-in with drift was built and rendered: the form overfilled into a muddy field and the breakdown exhale was lost (640 render, 12-24 s). Centred is right for one object on black. |
| Bass sets flight speed / gentle push toward the centre (psychonaut transplant) | **Reject** | Same experiment as above. The bass sets the turn's speed instead. |
| Clifford/de Jong is "a quotation" of a first-week exercise (purist 8) | **Reinterpret** | Not by changing maps (the forms are the draw) but by rendering the orbit as a 3D sculpture, which the textbook plate is not. |
| Map band energy to one coefficient axis, guard as safety rail (purist transplant) | **Already there** | V1's integrated bass sweep with Lyapunov look-ahead does this. |
| Blocky orange/blue sand after ~50 s (V1 96 s run, 60 and 84 s; no judge named it) | **Act** | Light age blurred and bilinearly upsampled. |
| More hues, more glow, a backdrop (generic pressure; "Strange Aurora" crossover) | **Reject** | Two inks on black is the piece; the Aurora crossover is a different scene. |

## The plan

1. **Kick = a flash on part of the wire.** A "lamp" (a soft disc in attractor
   space, drifting slowly round the form) collects the points that pass
   through it into a separate, fast-decaying flash buffer. On a kick the lamp
   fires: the filaments inside it burn white-hot for a fifth of a second and
   subside. One region, never the frame. **Clap = the steel lamp**: a second
   lamp at the opposite side of the form fires in the palette's cool stop.
   Two events, two places, two inks — both already in the picture's language.
2. **Depth: the orbit as a sculpture.** Each point gets a third coordinate
   from the orbit itself (a delay embedding: the previous x), and the view
   yaws and pitches that 3D cloud a little. At rest it is exactly V1's plate;
   the bass-driven sweep swings it, so the drop turns the sculpture and the
   breakdown lets it settle flat. Far points are dimmed slightly for depth.
3. **Smooth the light-age field.** Blur the half-resolution freshness ratio
   before it picks a colour, so a diffuse form reads as smooth tone, not
   speckled 2x2 blocks.

Not touched: the Clifford / de Jong presets and crossfades, the chaos guard,
the palettes and light-age colour LUT, the halo, the auto-exposure.

## What changed

1. **Kick and clap lamps** (as planned). Tuning found that an even additive
   flash, or even one proportional to tone, burnt a flat white disc wherever
   the lamp caught a diffuse sheet; the flash is now scaled by the *square* of
   the exposure's tone and uses an exponential (not log) curve, so it lights
   the brightest wire and leaves the haze between it dark. Each kick walks the
   lamp 0.9 rad on round the form; the clap lamp sits opposite, in the
   palette's cool stop brightened to full value.
2. **3D turn** (as planned): delay-embedded depth, yaw and pitch amplitude and
   speed both follow the bass, far points dimmed slightly. With depth at 0 it
   is V1's flat plate (checked: a depth-0 render shows the same fill, so the
   fuller sheets in some forms are the form, not the turn).
3. **Light age blurred and bilinearly upsampled.** The blur alone removed the
   orange/blue sand; the upsampling removed 2x2 colour steps along a fresh
   form's edge that the blur left (720p, 18 s).
4. **Added during the build: push/pull development.** The breakdown had not
   visibly exhaled for the forms this seed reached, so the tone gain now
   follows a slow section-energy envelope (x0.4 quiet to x1.15 drop): quiet
   passages lose their haze and thin to threads, the drop develops the sheets.
   This replaces "the drop sweeps harder" as the main drop/breakdown contrast.
5. **Guard release** 0.02 → 0.05 a frame, stuck limit 3 s → 2 s: a 96 s run
   showed the orbit recover from a periodic window within a second while the
   slow release kept it dimmed for three more, a drop spent as dark
   afterglow with dotted spirals (debug log: lyap back to +0.16 at 84 s,
   guard still 0.87).

6. **Performance fix (2026-09-28):** full screen at DPR 2 (3024x1890) ran ~24 fps because the per-pixel CPU tone pass took ~35 ms on a 3.2 MP buffer; the buffer is now capped at 1.3 MP and the tone map (log curve, bilinear light age, LUT, flash) runs in a WebGL2 shader with the old loop as fallback, giving 60 fps / p95 16.8 ms with the 720p sheet unchanged (`harness/renders/v2/attractor-perf/sheet.png`, max 5-level pixel difference).

Params added: **Kick flash** (0–2) and **Turn in space** (0–2).

## Before / after

- Kick: V1 jolt ratio 1.17, area 0.09 (the kick was not there). V2 **calm**,
  drop ratio 1.38, area 0.105; build kick 1.52 / 0.14.
  `harness/renders/v2/attractor-jolt/heat.png` row 3 shows it best: white wire
  on the right (kick), steel wire on the left (clap), the rest untouched.
- Drop vs breakdown: `harness/renders/v2/attractor-720/sheet.png` — drop tiles
  10–16 s are full, bright, turned; 18–24 s thin to single threads with the
  drop's form fading to steel behind. V1's sheet has the same-looking oval
  from 2 s to 16 s.
- Depth: compare V1 `harness/renders/attractor/frame-12s.png` (a flat plate)
  with `harness/renders/v2/attractor-720/frame-12s.png` and `frame-04s.png`
  (sheets folding in space).
- Longevity: V1 `harness/renders/attractor-96/frame-60s.png` (blocky sand
  donut) vs `harness/renders/v2/attractor-96/sheet.png` (no sand; 84 s is a
  bright drop). The 96 s run predates the bilinear upsampling, which changes
  only colour lookup, not the dynamics.
- Best frame: `harness/renders/v2/attractor-720/frame-18s.png`.

Cost: harness renderTime at 1280x720 p95 ~17 ms vs V1's 10 ms (machine busy
with parallel renders, so the gap is overstated, but the extra full-res lamp
buffers and bilinear light-age lookup are real). Needs an `fps.mjs` check.

## What I'd still do

- Diffuse forms (one Clifford preset wanders into a torus) still show fine
  pixel grain when the drop pushes development; curating the presets by a
  diffuseness scan would fix it at the source.
- The jolt ratio is at the calm edge (1.38). On a projector the lamp reads
  clearly; if the room wants more, Kick flash 1.5 is the knob, not the
  defaults.
- After the full feedback, a camera push-in toward the form (for "centred
  object") was tried and reverted; see the triage. A version that crops in
  only for a bar at the drop's start might still be worth one experiment.
