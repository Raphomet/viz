# Planets V2 — redesign note

**Scope: a reconception.** V1 ranked in the bottom 12 (mean 4.0). Every judge
said the same two words, *tiny* and *monochrome*, and the purist put the
deeper problem in one line: "a clockwork, not a system." Enlarging and
colouring V1 would get a 5 or 6 (the floor judge said as much); it would still
be a diagram seen from far off, in the glow-on-black house style TASTE now asks
us to leave. So V2 keeps the orrery and changes where we stand: **inside it**,
flying through the system, with the planets big, inked and lit by the sun.

The thread back to 2016: Raph's to-do list at the top of `Planets.pde` is the
spec, read literally for the first time at a size where it shows: "must
actually make this respond to music", "finish more planet types" (all seven of
the sketch's types: plain, one moon, two moons, a moon with its own moon,
ringed, binary, trinary), "draw orbit trails, alpha it in", "orbit size pulses
with music", "starfield background", "color planets", "prettify sun".

### Why not the Sand Traveler idea (a pivot, recorded honestly)

The first plan for this note was the purist's "Sand Traveler Orbits": keep the
orrery, paint the relations between bodies as sand on paper. I built it far
enough to see it work, and then found `web/scenes/sandtraveler.js`, a
batch-06 scene built from exactly that idea, with the same technique (a float
absorbance buffer), the same papers and nearly the same inks. Two versions of
one idea in one collection is worse than either, and that idea already has its
own scene. So Planets V2 answers the same criticism the other way round. Sand
Traveler removes the planets and shows the relations. Planets V2 moves the
camera in until the planets fill the frame.

## The piece in one sentence

A slow flight through a hand-printed orrery: flat-inked planets, moons and
ringed giants, lit hard by a warm sun, swing past the camera on their orbits
over a star chart, and every kick sends a ripple out across the orbital plane
that swells each orbit it passes.

## Feedback triage

| Point (who) | Verdict | Why |
|---|---|---|
| Tiny; "too small in the frame to swallow you" (floor, psychonaut, curator, director) | **Act** | The camera sits inside the outer orbits: near planets pass the lens many times larger than V1's discs, far ones recede. That gives depth and parallax, and something to fall into. |
| Monochrome (floor, director, curator, purist) | **Act, my way** | Colour as print, not light: a limited set of flat inks per plate (vermilion, ochre, teal, rose, slate on cream), each body shaded in two hard tones by the sun. No rainbow, no bloom. |
| "Double the scale and add a warm sun as a second light" (floor) | **Act** | The sun is now *the* light: every body has a terminator facing it, moons show phases, rings cast the eye round. |
| "A clockwork, not a system" (purist) | **Reinterpret** | The system reacts as one: a kick ripple travels outward through the plane and each orbit it crosses swells and lights. Cause and effect travel through the orrery, not a global pulse. |
| "Real follow-through: the drop flings comets out on long ellipses and the breakdown reels them back" (director) | **Keep** | V1's best moment. Orbit swing is a param the drop drives, with Kepler speed-up at perihelion; the camera dives lower and closer at the same time. |
| Sand Traveler Orbits (purist, new ideas) | **Reject for this scene** | It is its own batch-06 scene now (above). |
| Harmonograph on cream paper (curator's new idea) | **Reject** | A different scene. Its paper-and-ink sensibility is borrowed as the default plate. |
| The originals should become layers in richer scenes (psychonaut) | **Reject** | Out of scope for a V2; make this one rich on its own. |
| V1's glow halo and spiky corona | **Drop** | The glow-on-black finish TASTE warns against. The sun becomes a flat disc inside printed rings, which is the 2016 ring-sun, prettified. |

## The plan

1. **Stand inside the orrery.** A perspective camera circling the sun slowly
   at a low elevation, inside the outer orbits, with all nine planets of the
   2016 menagerie at readable sizes. Painter-sorted spheres, orbits as
   hairlines, trails alpha'd in behind each planet, a printed star chart
   behind (fixed to the sky, so it wheels with the camera).
2. **Print, not glow.** Three plates: *Plate* (cream paper, flat inks, indigo
   hairlines; the default), *Poster* (navy ground, sand/coral/teal inks) and
   *Night* (white on black: the 2016 sketch's own look). Each body is flat
   colour with a hard two-tone terminator facing the sun.
3. **A beat vocabulary that lives in the system.**
   - *Kick*: a ripple ring leaves the sun across the orbital plane; as it
     crosses each orbit, that orbit swells ("orbit size pulses with music")
     and the planet's lit rim flashes in the accent. Confined: a hairline
     travelling out, and one planet at a time.
   - *Clap*: a comet crosses the inner system, tail streaming away from the
     sun. A different shape and a different place.
   - *Hats*: an asteroid belt of fine dust between the fourth and fifth orbits
     glints, and the star chart twinkles.
   - *Bass*: sun and planets swell slightly and the orbits speed up.
4. **The drop is a dive.** Everything the drop changes is a param: Orbit
   speed, Orbit swing (comets on long ellipses), Trails, Camera height (dives
   toward the plane) and Camera distance (moves in). `presets: { calm, drop }`
   plus `poster` and `night`, and **Follow the track** (default on) lifts
   those params toward the drop look from a slow bass-energy follower.

Not touched: the orrery idea (bodies on ellipses round one sun), the seven
planet types, "New system".

## What changed

- **Where we stand.** V1 looked down on a small white diagram. V2 is a
  perspective camera circling inside the outer orbits (Camera height 21°,
  distance 690 at rest), so near planets pass the lens at five to ten times
  V1's size and far ones recede. The sun sits just below centre, with the far
  side of the system above it.
- **Print, not glow.** Flat inks on cream paper (the *Plate* default), with a
  fibre texture and a soft vignette. Every sphere is a dark disc, a mid-tone
  and a lit tone bounded by true terminators computed from the sun direction,
  so moons show phases and a giant between you and the sun is a crescent.
  *Poster* (navy) and *Night* (the 2016 white-on-black) are the other plates.
- **All seven 2016 types**, placed so each appears: plain, one moon, two
  moons, a moon with its own sub-moon (the sketch's "TODO: draw submoon"),
  two ringed giants (rings split behind and in front of the body), a binary
  and a trinary. Moon orbits are printed as faint hairlines.
- **Trails alpha'd in** as tapered ribbons in each planet's ink (edge-sharing
  quads: round-capped segments beaded where they overlapped).
- **Sun, prettified**: a flat disc holding the 2016 ring, inside a printed ring
  with spectrum ticks (V1's corona idea, bass at the crown, as ink).
- **Beat vocabulary**: kick = a vermilion ripple across the plane, swelling
  and lighting each orbit it crosses and flashing the rim of each body on it.
  Clap = a comet streak, tail away from the sun, kept to the inner system and
  faded near the lens (at first it swept the frame as a thick red bar). Hats =
  vermilion glints in the belt and twinkling chart stars. Bass = sun, planets
  and orbits swell, orbits hurry.
- **Drop = a dive**: Follow the track lifts Orbit speed 0.7 → 1.35, Orbit swing
  0.1 → 0.72 (comets on long ellipses, Kepler speed-up at perihelion), Trails
  0.35 → 0.85, Camera height 21° → 11°, Camera distance 690 → 590, Camera drift
  1 → 1.8. A param the performer has pushed past its drop value is left alone.
- **Params (9)**: Follow the track, Plate, Orbit speed, Orbit swing, Trails,
  Camera height, Camera distance, Camera drift, Beat strength. Presets `calm`,
  `drop`, `poster`, `night`.

## Before/after

- V1: `harness/renders/orig/planets/sheet.png`, a small white orrery in the
  middle third of a black frame at every time.
- V2: `harness/renders/v2/planets/sheet.png`. The intro (2–8 s) is a calm
  printed plate; the drop (12–16 s) is visibly a dive, with the camera low,
  eccentric orbits and long trails; the breakdown (20–24 s) reels the orbits
  back while a ringed giant swings past the lens.
- Best frame: `harness/renders/v2/planets-720/frame-18s.png` (a ringed giant
  in the foreground with a flashed rim, the sun's spectrum ticks, trails in
  three inks, a comet above).
- 96 s: `harness/renders/v2/planets-96/sheet.png`. Every sample is a
  different composition (the camera circles, the giants come and go) and there
  is no stasis.
- Jolt (`harness/renders/v2/planets-jolt/heat.png`): **calm**, drop kickArea
  0.088, kickMean 0.019, drift 0.016, ratio 1.16; build kick area 0.081, ratio
  0.98. The kick moves thin rings and rims, never the frame.
- Cost: draw() JavaScript 0.4–0.5 ms a frame; renderTime p95 12.9 ms at
  1280×720 in the harness's software rasteriser. No per-pixel work.

## What I'd still do

- The ripple itself is a thin hairline and reads best in motion; in stills the
  kick shows mainly as the flashed rims. If the room misses it, thicken the
  ripple where it crosses the belt (dust kicked up) rather than making it
  brighter.
- The comet reads as a streak more than a comet at 16:9 distance; a curved
  (hyperbolic) path round the sun would say "comet" more clearly.
- The intro is gentle by design. If it feels too still unattended, raise the
  calm Camera drift rather than the orbit speed, since moving the camera gives
  parallax as well as motion.
