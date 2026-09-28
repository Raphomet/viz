# Taste

The standard every scene is made and judged against. The maker reads it before
starting; the critic scores against it. It is deliberately opinionated.

## The goal

**Mesmerizing.** Someone at a party glances at the projection, and a minute later
they are still looking. That happens when a piece has structure that keeps
emerging, so the eye keeps finding something new, and when its motion is
continuous enough to be hypnotic rather than busy.

The reference point is the golden age of Processing, roughly 2004–2014:
Jared Tarbell's Complexification (Substrate, Sand Traveler, Happy Place),
Robert Hodgin's Magnetosphere and flocking work, Casey Reas's Process
series, Marius Watz, Erik Natzke, Glenn Marshall, Memo Akten, early
OpenProcessing. Take their *techniques and seriousness*, never their pieces:
nothing that would read as a copy of a named work.

## What makes a piece good

1. **Emergence over animation.** The best pieces are systems (agents, fields,
   growth, simulation) whose look arises from simple rules running for a long
   time. A thing that is merely keyframed or rotated is rarely mesmerizing.
2. **Density and accumulation.** Golden-age work often never cleared the
   background, or cleared it at a low alpha: thousands of faint marks building
   into tone. Detail should reward a closer look on a big screen.
3. **A restrained palette.** One or two hues plus a neutral usually beats a
   rainbow. Colour is a decision, not `hue = frameCount % 360`. HSB cycling is
   allowed only when the piece is about colour and it is earned.
4. **Music you feel, not music you read.** The audio should change the
   system's physics (force, growth rate, spawn rate, turbulence, a phase) so
   the piece breathes with the track. Avoid literal meters: no bars, no
   spectrum strips, no shapes that simply scale with the kick. A good test:
   with the sound off it is still beautiful; with the sound on it is alive.
   The drop should look different from the breakdown.
5. **Continuity.** No popping, strobing, or jitter unless it is deliberate and
   rare. Changes ease. Nothing resets visibly.
6. **It holds for minutes.** The piece must not saturate to a white or black
   mess, freeze into stasis, or run out of particles after 30 seconds. Build in
   renewal (fade, respawn, re-seeding) so minute five is as good as minute one.
7. **Composition at every aspect ratio.** It fills the stage in 16:9 and in a
   square; nothing important is cropped or huddled in a corner.
8. **Craft.** Antialiased where it matters, no banding in gradients where it
   shows, no visible seams, legible at projector resolution.

## Instant rejections

- A centred shape spinning or pulsing to the kick.
- A generic particle fountain, starfield warp, or plasma with nothing else.
- Rainbow everything.
- A spectrum analyser in disguise.
- Visible frame-to-frame jitter from randomness that should have been noise.
- Blows out to a flat colour, or dies to black, within the 24-second test.
- Too slow for 60 fps. Read `renderTime` p95 in `report.json` at 1280×720.
  Canvas 2D scenes: at most ~12 ms. WebGL scenes: the harness emulates the GPU
  on the CPU (SwiftShader), which overstates cost several times over, so the
  ceiling there is ~30 ms; keep shaders and iteration counts modest anyway.

## Controls

Each scene declares 4–8 params that a performer would actually want to turn
mid-set: the ones that change the character of the piece, not its plumbing.
Plain labels ("Turbulence", "Trail fade", "Growth rate"). At least one control
should produce a dramatic, satisfying change. Every default must already look
good. Include a band picker only where choosing the band matters. An action
button ("Re-seed", "Clear") is welcome when the piece has a natural reset.

## How the critic scores

Score 1–5 on each: **Mesmerizing** (would you keep watching?), **Originality**
(does it avoid the defaults above and have a point of view?), **Music**
(felt, not read; drop vs breakdown visible in the contact sheet), **Longevity**
(frame 24 s as good as frame 6 s; no saturation or death), **Craft**
(composition, palette, smoothness, performance).

A scene ships at 4+ on Mesmerizing and no score below 3. The critic's notes
must be specific and actionable ("the trails saturate to white by 14 s: fade
at 3% per frame instead of 1%"), never generic praise.
