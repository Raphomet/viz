# Thresholds V2 — redesign note

**Scope: two structural changes and one tune-up.** V1 ranked #1 of 72 (47/60:
floor 8, psychonaut 8, designer 8, purist 7, director 9, curator 7). The
world, the woodcut and the doors are right and stay exactly as they are; the
shader's machinery is not touched. What V2 changes is *dramaturgy* (the drop
happens by accident in V1) and *the light of the drop* (it floods the room).
Everything else is the same scene.

## The piece in one sentence

An animated woodcut of a flight down an iron tunnel where door after door
unlatches, pauses and swings open before you, and the drop is the door that
finally opens onto light.

## Feedback triage

| Point (who) | Verdict | Why |
|---|---|---|
| "The door is the drop: steam bursts as it unlatches, the woodcut inverts to daylight" (director, 9) | **Act: make it true** | The director read this into V1, but it is a coincidence: doors open by distance, and the inversion is a separate wave from the vanishing point. V2 makes one door *be* the drop, every time. |
| The drop as a place you enter, "driving into a tunnel on the drop and out at the breakdown" (curator transplant, Expressway → Thresholds) | **Reinterpret** | We are always in the tunnel; the equivalent is a threshold. The build brings us to a halt before one shut door; the drop blows it open and we are through into the lit print. |
| "The drop's light cream fill brightens the room a lot" (floor, docked a point) | **Act** | Correct, and the only real complaint. A projector throwing ~0.75 luminance cream over a dark room for eight bars is the scene's biggest real-world flaw. |
| "Flip to a warm sepia ink on the drop instead of brightening the ground" (floor transplant) | **Reinterpret** | Losing the inversion would lose the release the director and psychonaut prize. Instead the drop prints as a **chiaroscuro woodcut**: a second, coloured tone block under the black key block, with only the highlights cut back to paper. The drop is still the light, but it is a warm, dim, coloured light, and the brightest paper sits at the end of the tunnel. |
| Per-drop variation keeps it alive at 96 s (floor) | **Act, lightly** | The tone block's ink changes each drop (ochre, verdigris, red oxide, slate), as Ugo da Carpi changed tone blocks between prints. Cheap longevity, still only two or three inks at once. |
| "Two inks", "no colour needed", "restraint beats spectrum" (psychonaut, designer) | **Keep** | Outside the drop V2 is exactly V1's two inks. The tone block is one muted earth colour, only in the drop, which is where TASTE asks for "more colour". |
| "Highlight roll-off: they never clip" (floor, as a source) | **Keep** | The tone block lowers the peak further; nothing new goes to flat white. |
| "Line density occasionally buzzes" (psychonaut); "Dense" (designer, curator) | **Reinterpret, minimally** | V1's jolt drift is high (0.154 mean over 72% of the frame per 0.15 s), which is the flight itself, not a flaw. The hold gives the eye its rest: a few seconds of near-stillness before every drop, which is a better answer to density than thinning the engraving. Line spacing unchanged. |
| "The gears flirt with Terry Gilliam machinery" (psychonaut) | **Reject** | Gears, machinery and steam are Raph's own brief for this piece. |
| "Eight ways to fly down a tube … Thresholds is the only tunnel with a material and a reason" (curator) | **Keep** | No action; this is the tunnel that stays. |
| "Opening Night" theatre, "Engraved Deep" ocean (director, floor, psychonaut) | **Reject here** | Good new scenes, not this one. |
| Purist 7: "Recursive, monochrome and strange" (no criticism given) | **Keep** | Nothing to act on. |

## The plan

1. **The held door (build → drop).** When the music is building (high-band
   energy rising well above its slow average, and not already in a drop), the
   next shut door ahead is marked as *the threshold*. Its distance-driven
   unlatching is suspended; the flight coasts to a halt about 1.2 units in
   front of it, so it fills the frame. Kicks in the build trip its latch dogs
   one by one (V1's latch machinery, now with a purpose), the gauge needles
   climb towards the red line with the tension, the wall gears wind faster and
   steam leaks from the walls at the door's plane. The rest of the frame goes
   nearly still: the scene's first real exhale-before-the-inhale.
2. **The breach (the drop).** When the drop is detected, the next strong kick
   blows the held door (or, with no build, the nearest shut door) open in
   0.6 s with a heavy overshoot, all remaining latches snap at once, twin steam
   jets fire from both walls at the door, and the flight surges through.
   The ink inversion now starts *at that door*: everything beyond it is lit at
   the instant it opens, and the light rushes up the tunnel at us. If the
   build fizzles (tension falls, or nine seconds pass), the door opens slowly
   by itself and the flight resumes.
3. **Chiaroscuro drop.** In the lit (black-on-paper) print, a coloured tone
   block covers every surface except its lit faces and glints, and the far
   end of the tunnel fades to bare paper, so the light comes from beyond the
   door and the near frame is a dim warm colour under black line. The ink of
   the tone block steps through four earth colours, one per drop.

**Not touched:** the ray-cast world, the nine mechanisms, the octave-LOD line
engine, the walls, steam rendering, the kick (latch snap and ratchet), hats,
the controls (one added: *Drop tone block*, to choose or switch off the drop ink).

## What changed

All three planned changes landed, in JS plus about twenty lines at the end of
the fragment shader; the world, the mechanisms and the line engine are V1's.

1. **The held door.** A tension signal (bands 5–8 over 1 s against their own
   6 s average) marks a build. The next shut door at least 2.4 ahead becomes
   the threshold, skipping any door that would park us beside a swung hinged
   leaf (the first render parked beside an open clamshell leaf and filled both
   sides of the frame with one flat panel). A held door far away pulls the
   flight on faster, then a position-based brake coasts it to a stop 1.15
   short. Build kicks trip its latch dogs, the gauges climb with the tension,
   the wall gears and cranks wind faster, and steam leaks from alternate
   walls at its plane. A build that fizzles (1.5 s calm, or 9 s) lets the
   door open slowly by itself.
2. **The breach.** The drop detector arms on the kick that tips it (in the
   test track the build's last kick, 9.52 s); the next kick (the 10.0 s
   downbeat) blows the door open in 0.7 s, snaps all its latches, steps its
   ratchet three teeth, throws the crank, fires twin steam jets from both
   walls at the door and surges the flight through. The inversion front now
   starts at the door's depth, so the room beyond is lit the instant it opens.
   On the 96 s run it fires on every drop (10, 34, 58, 82 s) on a different
   door each time (shutter, gear, sliding, segments).
3. **The chiaroscuro drop.** In the black-on-paper print a tone block covers
   every surface whose tone is above 0.13 (so lit faces, rivet highlights and
   glints stay paper), rising with depth so the far end of the tunnel is bare
   paper. Hatching and outlines fade out there too, so the vanishing point is
   the light. A faint wood grain runs through the block. Inks, one per drop:
   ochre, verdigris, red oxide, slate. New control *Drop tone block*: Off
   (V1's bare paper), New ink each drop (default), or one fixed ink.

Measured:

- **Room light in the drop:** mean luma of the drop frames fell from
  0.645 / 0.537 / 0.571 (V1 at 12, 14, 16 s) to 0.41 / 0.38 / 0.37 (V2 at 12,
  14, 17 s), about a third less, and close to the dark print's 0.32–0.36.
- **Jolt:** calm. Drop kickArea 0.61, kickMean 0.171, driftMean 0.143,
  ratio 1.20 (V1: 0.68 / 0.149 / 0.154 / 0.97); build kick ratio 1.04. The
  kick reads slightly more against the drift than before, and still in
  places (latch, ratchet, pistons), not the frame.
- **Cost:** a handful of ALU ops per pixel and no new loops; the harness
  timings are dominated by the busy machine (all redesigners share it).

## Before / after

- V1 sheet `harness/renders/b3/thresholds-hd/sheet.png`, V2 sheet
  `harness/renders/v2/thresholds-720/sheet.png`.
- **The door is the drop:** V2 720 at 9.5 s (the shutter held, steam leaking,
  gauges up), 10.2 s (the shutter leaves flying open, latches snapping, the
  lit print arriving from beyond it), 10.5 s (through the portcullis beyond
  between twin steam jets, the best single frame:
  `harness/renders/v2/thresholds-720/frame-10.5s.png`). In V1 the 10 s and 12 s
  frames show a door and an inversion that are unrelated.
- **The drop no longer floods the room:** V1 12 s (bare cream) against V2
  12 s and 14 s (ochre block, black line, paper only on lit faces and far away).
- **A new ink each drop:** V2 96 s sheet `harness/renders/v2/thresholds-96/sheet.png`,
  12 s ochre, 36 s verdigris, 60 s red oxide, 84 s slate. V1's 96 s drops are
  identical in colour.
- 640×360 iteration sheet: `harness/renders/v2/thresholds/sheet.png`.

## What I'd still do

- The test track's build is short (6 s), so the flight is only near-still for
  about half a second before the breach; with a real 16- or 32-bar build the
  hold is the long exhale it was designed as. Worth watching on a real set.
- The drop detector fires on kicks, so a drop without a kick (a bass-only drop)
  still gets no breach, as in V1.
- The tone block's cut level (0.13) was set by eye on the lit tunnel walls;
  a higher value would bring back more paper and more light if Raph misses it.
