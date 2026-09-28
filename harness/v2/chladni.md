# Chladni V2: redesign note

V1: `web/scenes/chladni.js` (ranked #3 of 72, mean 7.6 from five judges; the
designer did not see it). V2: `web/scenes/v2/chladni.js`, id `chladniv2`.

## The piece in one sentence

Sand on a vibrating plate that finds a figure, loses it and finds a new one:
physics you can watch think, with the music setting the mode.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| Sand migrating between figures is the soul; mode number is one of the best musical mappings in the collection (purist, curator, director, psychonaut) | **Keep** | Untouched: the same grain physics, the same centroid-to-mode mapping, the same snare-driven figure change. |
| The breakdown re-settling is the best section change in the set (curator, director) | **Keep** | Untouched. |
| "Murky purple ground"; black glass or matte slate would serve better (purist) | **Act** | The iridescent violet/magenta sheen is exactly the glow-and-prism default TASTE.md retires. New default plate is matte slate; the standing wave shows only as a tonal shimmer. V1's black glass survives as an option. |
| "Gold sand on a violet plate" as a plus (floor); "a chosen palette" (psychonaut) | **Reject** | The violet is what makes the drop frames muddy; the amber/cyan raking light, which is the part they are really praising, stays. |
| Needs one more layer of depth, a camera drift or the plate's edge (psychonaut); the simulations "float" with no camera, a simulation you fly *through* (psychonaut) | **Reinterpret** | V1 did drift, but top-down the drift reads as nothing. Tilt the camera so the plate recedes in perspective into haze, and fly forward over it: sand streams toward you and new, already-settled figures arrive at the horizon. This is what V1's own brief ("dunes under a slow aircraft") was reaching for. A Tilt control goes back to top-down. |
| Travelling kick ring: sand jumps as the ring passes (floor); kick-as-phase-echo wavefront (purist) | **Act** | Both judges converge, and it is the physically true thing: a struck plate sends a flexural wave outward. The kick now strikes one point (a small splash) and a ring runs out across the plate; grains hop as the crest passes, and it fades within a hand-span or three. Confined at every instant, and far more legible than V1's blob of glowing sand. |
| Drop churn could be quieter; let the figure be legible more of the time (curator) | **Act** | In the drop the figure changes on at most every fourth clap (about every two bars), and the extra drop vibration now pulls sand to the nodes without adding jitter, so the drop's figures are intricate *and* crisp. |
| Structural change for the drop: the plate could turn a quarter (curator) | **Act, my way** | Each section change swings the flight heading an eighth-turn over about three seconds, so the drop arrives as the whole plate wheeling beneath you, a structural move with no flash. |
| Out-of-focus parallax motes (psychonaut, from Abyss) | **Reject** | V1 already had them and nobody saw them; in perspective the plate itself is the parallax, and they were additive glow blobs. Removed. |
| Plate curls into a sphere / topology change at the drop (psychonaut, purist) | **Reject** | Breaks the truth of sand on a flat plate, and the simulation with it. |
| Mandala feedback flight (psychonaut) | **Reject** | A glowing tunnel; wrong material. |
| Rotating hidden image (psychonaut) | **Reject** | The mode sequence already is the slow narrative; the 96 s sheet shows it unfolding. |
| Chladni Stage, low view under spotlights (floor); Sand Rose, mirrored six ways (psychonaut) | **Reject** | New scenes, not this one. The tilt borrows the low view's depth without the stage lighting. Mirroring would fake a symmetry the modes already have. |

## The plan

1. **Perspective flight.** The plate is seen at an angle (default about 34°
   from straight down), receding into a haze of the plate's own colour; the
   camera flies forward along a slowly curving heading. Grains are simulated
   over the trapezoidal footprint of the view and wrap far-to-near, arriving
   at the horizon already settled. New `Tilt` control (0 = V1's top-down).
2. **Matte slate plate.** Default ground is a dark blue-grey slate, chalk sand,
   a warm low key light and a cool faint fill. The standing wave appears as a
   tonal lift on the antinodes, not a hue ramp. Plates: Slate, Brass (a
   mid-tone warm ground with real shadows), Black glass (V1's sheen, kept).
   Airborne sand is pale, not glowing.
3. **Kick = a travelling wave.** Small splash at the strike, then a ring runs
   outward; grains hop as the crest passes and a thin crest of light rides
   the plate. The ring dies within about 0.7 s.
4. **Drop legible, and swung.** Figure changes at most every ~3.8 s in the
   drop; drop vibration strengthens the pull, not the jitter. Every section
   change swings the heading by 45°.

Not touched: the grain physics, mode formulas, centroid-to-mode mapping, the
snare-to-figure event, the Newton projection of wrapped grains, hat glints on
single grains, the raking two-light relief.

## What changed

All four planned changes landed. Tuning after the first render:

- **Perspective flight.** Default tilt 0.72 rad (about 41°); the far edge sits
  about 1.45 times further away than the centre, so figures shrink toward
  a horizon haze. The camera flies forward at 0.1 plate units a second, and
  bass and the drop speed it up. Grains wrap far-to-near across the trapezoid
  and arrive Newton-settled. Far grains splat with less weight so the horizon
  does not silt up.
- **Slate.** The first render's antinode lift was far too strong (grey pools
  dominated), so it was cut to a quarter. What remains reads as sand sitting in
  grooves on matte stone, with a real cast shadow on the side away from the
  key light. Brass (a mid-tone daylight bench) and Black glass (V1's sheen)
  are the other plates.
- **Kick wave.** The first version shoved grains outward and ran 0.75 s, so
  overlapping rings stirred the whole drop, which was V1's churn by another
  route. The ring now runs 0.55 s (to about 300 virtual units), the grains
  mostly hop straight up, and the crest light is thin and fades to nothing by
  the end of its run. The splash radius is less than half of V1's.
- **Drop.** The figure changes at most every 3.8 s in the drop, and a snare
  that comes too early swings the key light a notch instead. Drop vibration
  raises the pull and not the jitter. Entering or leaving the drop swings the
  heading 45° and starts a new figure.
- **Removed:** V1's additive motes.

Jolt (640×360, seed 1): **calm**. Drop kickArea 0.283, kickMean 0.047, drift
0.039, ratio 1.19; build kick area 0.365, ratio 1.01. (V1: 0.26 / 0.044 /
ratio 1.40.) The area is about the same as V1's because the flight's drift fills
the window; the heat map shows the kick as one ring-shaped hot patch.

## Before/after

- V1 `harness/renders/b3/chladni-720/frame-14s.png` against V2
  `harness/renders/v2/chladni-720/frame-14s.png`. V1 is violet pools under
  cyan-rimmed lines with a glowing blob of sand. V2 is a slate plate receding
  in depth, with a ring of hopping sand crossing the figure.
- V1 `frame-22s.png` against V2 `harness/renders/v2/chladni-720/frame-22s.png`
  (the best V2 frame): the breakdown figure as raked sand in grooves on stone,
  with no hue wash.
- `harness/renders/v2/chladni-jolt/heat.png`: each drop kick is one ring, and
  nothing else moves.
- `harness/renders/v2/chladni-96/sheet.png`: every section arrives on a new
  heading and figure. The intro lattices at 72 s and 96 s differ, and the drops
  stay legible.
- `harness/renders/v2/chladni-brass/sheet.png`: the daylight plate.

## What I'd still do

- The strike's small glow at the splash still reads a touch "light-bloom".
  It could become only lit grit.
- The drop's added cool fill light is subtle at the default. A bolder second
  light colour in the drop would make the drop/breakdown contrast stronger
  without flashing.
- Measure with `harness/fps.mjs`. The CPU cost is V1's plus the ring
  annulus checks (about 3.2 ms of JavaScript a frame here). The GPU passes
  are V1's, with a few more ALU in the composite.
