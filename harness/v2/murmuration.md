# Murmuration V2

## The piece in one sentence

A black flock of thousands pouring across a dusk sky over a marsh: one
silhouette with a line of action, the music bending its shape.

## Scope: a focused revision, not a rebuild

Ranked #10 of 72; every judge who saw it named the same thing as its soul
(the black flock at dusk) and the same thing as its failure (the drop). The
ribbon engine, the travelling kick and clap waves, the marsh and the camera
travel are right. What is wrong is how the drop gets "bigger": it adds light
and colour (rays, whiteout, a teal-magenta flock) and so loses the one image
that makes the piece. V2 keeps the engine and re-stages the drop as *contrast
and form* instead of *light and colour*, and adds one idea of my own so the
sky remembers the flock.

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| The black flock is poetry / sublime / one of the best images in the set | Floor, Psychonaut, Curator | **Keep** | This is the piece. V2 never colours a bird. |
| Drop: the rainbow/iridescent/teal-magenta flock is cheap and loses the flock | Psychonaut, Curator, Floor, Purist | **Act** | Iridescence removed entirely (and its control). The clap's turn stays a travelling band, but of *darkness* (banking birds show more wing), as it is in the sky. |
| Drop: sun rays wash the frame to white at 36/60/84 s | Floor, theme 5 "drops clip" | **Act** | Rays gone as a sheet of light; sun and glow tone-mapped so the brightest pixel rolls off below white. |
| Highlight roll-off transplant (never 100% white) | Floor | **Act** | Sun disc capped at warm ~90%, glow alpha capped, additive stacking reduced. |
| Single accent: keep the flock black, let only the sun's rim flare red | Curator | **Reinterpret** | The kick's sun-rim flare becomes a red-orange rim, the only saturated accent in the frame; the drop's escalation is the sky deepening to ember, not an added hue. |
| The drop is where scenes lose their nerve; bigger ≠ more; drop as change of state | Curator theme 1 | **Act** | Drop = the sky darkens and deepens while the flock grows larger, denser and folds harder: contrast is the escalation (Curator's Seascape idea, applied here). |
| Not boids: a deformed 3D ribbon, clever animation passing as emergence | Purist | **Reject** | The ribbon is what makes the shapes legible and steerable by the music; nobody watching can tell, and boids would cost the drop its line of action. |
| Long-exposure record of the flock's path (Stamps → Murmuration, 19th-c. starling photographs) | Purist | **Act, my way** | A persistent low-res "exposure" layer: the flock's heavy birds leave a faint smoky trace in the sky that fades over ~10 s, so the drop paints its folds across the sky and the breakdown shows the ghost of them. |
| Flock should veer around the sun flare (cause and effect) | Director | **Reject** | The kick already travels head to tail through the flock; adding a flee reaction would put a second kick response on the same subject and jerk the line of action the Director praised. |
| Same thing every drop (longevity theme) | Floor, Director | **Act** | Each drop gets its own form: alternating a single giant ribbon and a flock that splits into two sheets curling past each other, rejoining in the breakdown; the dusk sky also advances one scheme per drop. |
| Keep it in the breakdown so the sun never whites out (set-list note) | Floor | **Reinterpret** | Fix the cause instead: the drop no longer whites out, so the scene works through a whole track. |
| Pink/violet kitsch gradient, glow as default finish (TASTE "range, not a house style") | TASTE | **Act** | Skies re-toned toward real dusk (apricot, smoke-grey, rose-ash, ember), no acid push, bokeh removed, motes kept as small specks. |

## The plan

1. **The flock is always black.** Remove iridescence, glint pairs and the
   `sheen` control. Clap turns stay a travelling band made of darker, heavier
   birds. Replace the control with **Exposure** (how long the sky remembers
   the flock).
2. **Drop by contrast, not light.** No ray sheet, no acid push. The drop pulls
   the sky from pale dusk toward a deep ember/afterglow, the sun sinks a little
   and its glow is capped; the flock grows (as V1), gets denser (more birds
   drawn) and folds harder. The kick's sun rim flares red-orange: the single
   accent. Nothing reaches flat white.
3. **Long exposure.** A third-resolution persistent layer the heavy birds are
   stroked into every frame at low alpha, faded continuously, composited
   between sky and treeline.
4. **A form per drop.** Drop 1, 3…: one giant ribbon. Drop 2, 4…: the flock
   splits into two sheets that curl around each other. The split amount rises
   with the energy level and relaxes in the breakdown, so it is smooth.
5. **Re-toned skies**, bokeh removed.

Not touched: the ribbon engine and its lags, the kick ripple, the clap turn
mechanics, the marsh travel, reeds, glitter, reflection, far flock.

## What changed

- **The flock never changes colour.** Iridescence, glint pairs, the IRIS
  palette and the Iridescence control are gone. A clap's turn is still a band
  travelling through the flock, drawn as darker, heavier banking birds.
- **The drop is an afterglow.** Two new skies, *fire* and *crimson*, that the
  drop burns into (85% at full energy), alternating by drop. The lit band of
  the gradient climbs toward the zenith as the energy rises: a first pass left
  the zenith near-black, and at 60 s the flock flew up into it and went
  black-on-black, the opposite of the idea. The flock's centre rides 5% lower
  in the drop for the same reason.
- **No whiteout.** The ray sheet is removed. The sun glow is capped at 1 (V1
  reached 1.5+), its core alpha drops from 0.55 to 0.4 and falls further in the
  drop. The sun disc is warm cream, the water column and the brightest glitter
  are lower. Nothing in the 96 s run reaches flat white.
- **The kick's single accent.** A red-orange flare ring just outside the sun's
  disc, and the drop's halo rings are in the same red. Everything else in the
  frame is dusk tones and black.
- **A form per drop.** On even drops the flock splits into two sheets (by slot
  on the lens, so each is a whole ribbon). They orbit a shared centre, fold on
  offset clocks and twist and bend opposite ways, so they read as two flocks
  curling past each other, and rejoin as the energy falls. Controls: *Drop
  form* (Alternate / One ribbon / Split) and *Drop sky* (Alternate / Fire /
  Crimson / None).
- **Long exposure.** A persistent sixth-resolution canvas the two heavier ink
  buckets stroke into each frame, faded in 8% steps with a time constant set
  by *Long exposure (s)* (default 7; 0 is off), laid over the sky at 30%. At a
  third resolution it showed as grainy brown smog around the flock at
  1280×720, so it went coarser and lighter: now it is a soft shadow where the
  flock has just been, strongest after the drop.
- **Re-toned skies and fewer glows.** Apricot, Ash rose and Smoke replace
  Gold, Rose, Violet hour, Ember and Acid; the drop's acid push and the bokeh
  discs are gone; the reed catch-lights are smaller and cream.

Jolt (640×360, seed 1): **calm**, kickArea 0.178, kickMean 0.032, ratio 0.97;
build kick 0.143 (V1: calm, 0.172 / 0.99). The kick lands on the flock and the
sun only.

Harness renderTime at 1280×720 on a busy machine: p95 22.4 ms (V1's b2 run:
17.1 ms). The added cost is the exposure strokes; the rays, bokeh and
iridescent paths it replaced were cheaper than expected. It needs checking with
`fps.mjs`, since this harness overstates Canvas cost.

## Before / after

- **Drop colour**: V1 `harness/renders/b2/murmuration-full/sheet.png` tiles
  12.0–12.4 s (teal/violet/magenta flock) against V2
  `harness/renders/v2/murmuration-720/frame-12s.png` and `frame-14s.png`: a
  black flock on a burning sky.
- **Whiteout**: V1 `harness/renders/b2/murmuration-96/sheet.png` at 36, 60 and
  84 s against V2 `harness/renders/v2/murmuration-96/sheet.png` at the same
  times: afterglow, sun intact, no rays.
- **Per-drop variation**: V2 96 s sheet at 12/60 s (fire, one ribbon) against
  36/84/86/90 s (crimson, two sheets curling past each other); also
  `harness/renders/v2/murmuration-split/sheet.png` (form forced to Split) at
  15–17 s, where the two sheets make a ring and then a figure-eight.
- **Breakdown**: `harness/renders/v2/murmuration-720/frame-24s.png`: the calm
  dusk returns, one black crescent, a faint far flock.

## What I'd still do

- The drop sky shift is energy-driven and takes about a bar to arrive. That
  is right for a VJ set, but a snap on the downbeat (the sky catching fire in
  one beat) might land harder. I'd try it in the room before adding it.
- The flock can still sink toward the reeds when its wander and the ribbon's
  bend line up (V1 did this too). It reads as a roosting dive, and I left it.
- The long exposure is subtle by design. If Raph wants the Marey look
  literally, a mode that stamps crisp, thin traces every half-second would be
  the next step.
