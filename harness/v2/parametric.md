# Parametric Lines — V2

## The piece in one sentence

A straightedge held between two points that each trace a Lissajous curve,
ruling a line every instant, so the lines add up to a ruled surface whose
envelopes and moiré are an engraving no one drew: Raph's string art, printed
as a banknote plate.

## Scope: a restaging with one new idea, keeping the rule untouched

Parametric Lines ranked in the bottom 12 (mean 2.33, spread 1). Every judge
said the same thing in different words: *most frames are black*. That is not a
taste problem, it is one line of code: V1 sets the trail length to
`band0 × 50`, so outside a kick there is almost no trail, and at the kick
there are fifty lines for one frame. The Director called the result "all
punch, no phrasing"; the Purist called the rule itself "a lovely old idea"
that needs only staging. I agree with both, and so the rule is the one thing I
do not touch: the same four functions `x1, y1, x2, y2` with Raph's constants,
the same chord from one point to the other, the trail walking forward in `t`,
and his Curve ratio (`x0`) and modes.

What changes is everything around the rule:

- The trail is **always there and long** (hundreds of chords), so the ruled
  surface, its envelopes and its moiré are the picture. The music changes how
  long, how fast and how heavy, never whether.
- Each chord is **laid down once and kept** (a ring buffer of endpoints), so
  the figure morphs as new lines replace old ones instead of being recomputed
  from `frameCount`. That is what lets speed, curve ratio and amplitude move
  with the music without the figure jumping, and it makes the ribbon a record:
  the spacing of the strands is the tempo of the last few seconds.
- The **finish** changes from neon rainbow on black to one ink on paper: the
  guilloché register of a banknote, which is the tradition string-art
  envelopes actually belong to. Rainbow `hue = frameCount` is gone entirely
  (TASTE: "chosen, not `hue = frameCount`").

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| Invisible most of the time, most frames black | All six | **Act** | The core fix: a long trail that is always drawn; the music sets its length between ~300 and ~1000 chords, never zero. |
| "All punch, no phrasing": keep a faint figure alive, let the build add strands per beat, the drop ink it at full density, the breakdown unthread | Director | **Act, my way** | The trail length eases with the section, so the build accumulates strands, the drop is dense and heavy, and the breakdown literally unthreads from the tail end, strand by strand. The kick adds strands by surging the pen forward (see below). |
| Guilloché: engraved rosette lines in security green, drop adds a second ink in register | Designer | **Act (the new idea)** | One deep-green ink on pale security paper with a faint engraved guilloché ground. The drop prints a second plate in a second ink, the same ruling mirrored about the centre so the pair registers into a symmetric rosette, as a banknote's two plates do. |
| …and "a second-colour intaglio portrait of a turntable" on the drop | Designer | **Reject** | A pictorial vignette would turn the ruled surface into a frame around something else. The second plate is the drop. |
| Thicker and brighter at base level; a stable figure that morphs slowly; two-ink palette, drop adds the third | Floor | **Act** | Heavier base weight, the buffer-of-chords makes it morph rather than redraw, two inks plus one accent. |
| Longer trail and thicker lines at the defaults, "fine minimalist pieces" | Purist | **Act** | That is the base of the whole redesign. |
| Neon green on black | Designer, Curator | **Act** | No neon, no rainbow, no glow. A Night plate look (pale ink on a green-black plate) remains for dark rooms, still flat. |
| "Invisible most of the time. Nothing to rescue" | Curator | **Reject** | The one frame the whole panel saw at 10 s was the proof there is: the rule is good, only the staging was missing. |
| Retire the originals or fold them into richer scenes | Floor, Psychonaut | **Reject** | The brief is to give Raph's sketch a stage, not to bury it. |
| Pen on paper (a pen visibly drawing one continuous line) | Curator, Purist idea | **Reinterpret, lightly** | The two pen points are marked as the ruling's live head: small ink dots where the straightedge is now, and the hats prick the paper around them. It stays a ruling, not a plotter. |

Overlap checked: Planets V2 paints Sand-Traveler envelopes between planets on
a warm star chart with a vermilion clap chord. This is different in medium
(engraved line, not sand), palette (security green on grey-green paper) and
subject (one straightedge, not a system of bodies); the vermilion accent is
the common print convention, used here only on the kick.

## The plan

1. **The ruling.** Raph's four functions, unchanged, driven by integrated
   phases instead of `frameCount` (so speed and `x0` can glide), laying a
   chord every half unit of `t` into a ring buffer. The trail (up to ~1100
   chords) is drawn oldest-faintest, tapered at the tail end, stretched to fill
   16:9 as well as a square.
2. **Ink on paper.** Deep green hairlines on pale grey-green security paper
   with a faint guilloché ground of fine wavy lines. Two alternative inks:
   Intaglio (black on cream, vermilion accent) and Night plate (pale ink on a
   dark green-black plate). No additive blending anywhere.
3. **The music, each in its own place.**
   - *Kick*: the chord ruled at the kick is struck in the vermilion accent,
     heavier, and it stays where it was laid, fading as the ribbon moves on;
     the pen also surges forward for a moment, so the strands just after each
     kick are spread apart. The kick is one line plus a gap in the ribbon.
   - *Clap*: a swell of ink travels down the ribbon from head to tail (a band
     of chords re-inked heavier as it passes), a different motion from the
     kick's strike.
   - *Hats*: pinpricks: small ink dots scattered around the two pen points,
     V1's Dots mode as sparkle.
   - *Bass*: the curves' amplitude breathes (recorded in the chords as they
     are laid).
   - *Drop*: longer trail, faster pen, heavier line, and the second plate.
4. **Performer controls** for everything the drop changes (Speed, Trail,
   Weight, Second plate), plus Inks, Mode (Ruled, Woven, Pinned: V1's Lines,
   Triangle strip and Dots), Curve ratio, Reaction, and Follow the track.
   `presets: { calm, drop }`.

Not touched: the four curve functions and their constants, the chord between
them, the trail walking forward, the modes, the Curve ratio control.

## What changed

1. **The ruling, always present.** Raph's four functions and constants, driven
   by `t` plus an integrated `∫dt/x0` phase (so Curve ratio glides without the
   figure jumping), lay a chord every 0.35 `t` into a 1500-chord ring buffer.
   The trail is 545 chords in calm and ~840 in the drop (V1: 0 to 50,
   following band 0), stroked in 14 alpha buckets from full ink at the head to
   nothing at the tail. The figure is scaled height-to-height and stretched up
   to 1.6x in width, so it fills 16:9 as well as a square.
2. **Ink on paper.** Deep security green on grey-green paper, over a cached
   guilloché ground (two crossing families of fine sine lines bent into
   bands), a single ruled frame line, and a faint edge darkening. Intaglio
   (black on cream) and Night plate (pale ink on green-black) as alternates.
   No rainbow, no additive blending, no glow.
3. **Music.** Kick: the chord laid on the beat is struck in vermilion, thick
   for ~0.35 s, then kept as a thin vermilion record where it lies; the pen
   surges ~3x for a moment, so the strands after each kick spread apart.
   Clap: a heavier swell of ink runs from head to tail in ~1.3 s. Hats:
   pinpricks around the two pen points. Bass: the curves' amplitude breathes
   ±6%, recorded in the chords. Drop: longer trail, heavier line, and the
   aubergine second plate, mirrored about the centre. The breakdown lets the
   trail shrink slowly (rate 0.8/s), so the tail unthreads.
4. **Performer controls.** Inks, Mode (Ruled, Woven, Pinned = V1's Lines,
   Triangle strip, Dots), Pen speed, Trail length, Line weight, Second plate,
   Curve ratio, Reaction, Follow the track (on). `presets: { calm, drop }` over
   speed, trail, weight and second plate.

Tuning after the first look: the first drop (trail 0.85, second plate 0.85)
turned into a woven mat, so the drop trail went to 0.62 and the second plate
to 0.7 strength; the first kick strand was too thin to read (jolt ratio 1.0),
so it now strikes thick and cools, and the drop pen was slowed from 1.0 to
0.8 so the kick stands out against the ribbon's own motion (ratio 1.48).

## Before/after

- V1 `harness/renders/orig/parametric/sheet.png`: 11 of 12 tiles are black or
  one faint line; only 10 s shows the figure.
- V2 `harness/renders/v2/parametric/sheet.png`: every tile shows the figure;
  intro/build/breakdown are one-ink string art, the drop tiles (12-16 s) are
  visibly denser, heavier and two-inked with vermilion strikes.
- Best frames: `harness/renders/v2/parametric-720/frame-06s.png` (calm: the
  engraving at its cleanest) and `harness/renders/v2/parametric-720/frame-12s.png`
  (drop with a kick strike).
- 96 s: `harness/renders/v2/parametric-96/sheet.png`, no saturation or
  stasis; each drop and each calm passage is a different figure.
- Jolt: calm, drop kickArea 0.078, kickMean 0.017, drift 0.012, ratio 1.48;
  build kick area 0.066.
- Night plate: `harness/renders/v2/parametric-night/sheet.png`.

## Default changed to Night plate (coordinator, after the first report)

Party use is a dark room, and batch 06's Guilloché scene is now the dedicated
banknote-on-paper piece, so Parametric V2 leads with Night plate: pale ink on
a green-black plate, gold second plate, vermilion kick. Both presets set
`inks: 2`; Banknote and Intaglio stay as options. Re-rendered at 1280x720
(`harness/renders/v2/parametric-720/sheet.png`): calm is pale string art on
the dark plate, the drop adds the gold plate and density, and the vermilion
strike reads clearly (10 s, 12 s, 14 s). The paper frames cited above are now
the Banknote look; the 640 and 96 s sheets were rendered on paper and were
not re-run.

## What I would still do

- The drop at 16:9 settles into a boxy rectangle, because Raph's `x2` spends
  much of its time near its extremes; a slow rotation of the second plate (or
  a 180° register instead of a mirror) might give the drop a rosette rather
  than a box. I kept the mirror because it reads as two plates in register.
- The clap swell is honest but quiet at full density; it reads better in calm
  passages than in the drop.
