# Dot Matrix V2

**The piece in one sentence:** a dot-matrix machine that transcribes the track
as it plays, typing it letter by letter onto an endless LED page that rolls
away from you into the dark, so the whole frame is the music's recent history
set as text, in a script nobody can read and everybody tries to.

## Scope: a reconception that keeps Raph's grammar

Dot Matrix ranked in the bottom 12 (mean 2.8, five judges; the designer did
not see it). Every verdict is some version of "a sign": *an LED sign, signs are
for reading* (Psychonaut), *a display, not a drawing* (Purist), *a sign that
says VIZ, nothing to say* (Curator), *it only ever says three letters* (Floor),
*an LED scroller, the drop only adds ghosting* (Director).

They are right about what they saw, and what they saw was the Marquee: V1's
default programme, a scrolling "VIZ". Nobody saw Raph's own idea, which V1 kept
as its first programme but did not open on. `DotMatrix.pde` reads a grid of
cells in *reading order*: each frame the oldest cell falls off the top left and
the bass becomes a new cell at the bottom right, a stack of dots with the sixth
one red. That is not a sign. It is a page being written by the music, in lines,
left to right, with the peaks marked in red ink. I rendered V1's Ticker
(`{"mode":0}`) to check: it is already a record (bar-graph humps in rows), and
it already looks better than the Marquee, but it is a bar chart on a flat
panel and still reads as a meter.

So the reconception takes the sketch literally and finishes the thought. The
cells stop being bars and become **letters**: every slot of time is typed as
the 5×7 character whose silhouette best matches the spectrum at that moment,
so the page fills with pronounceable nonsense, the track transcribed. And the
page stops being a panel on a wall: it lies in perspective like a floor of
LEDs, the newest line typed nearest you, the older lines rolling away to the
horizon. That keeps the three things the sketch had (the grid of dots, reading
order, a red mark for the peaks) and adds what the judges found missing:
something to say, depth and travel, and an arc.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| "An LED sign. Signs are for reading" (Psychonaut); "a sign that says VIZ, nothing to say" (Curator) | **Act** | No sign. The piece is a record being written, not a message being shown. |
| "Only ever says three letters" (Floor) | **Act, my way** | It now says something new eight times a second, and never the same thing twice. Legible letters, illegible words: the room will try to read it. |
| "A display, not a drawing" (Purist) | **Reinterpret** | It stays a display; that is its material, and TASTE.md asks for range. But the image is now made by a rule (letter matching against the spectrum, pronounceable spelling), so the picture is a process, not a playback. |
| "The drop only adds ghosting"; "a meter with no arc" (Director) | **Act** | The drop is a flight: the camera comes down from reading height to skim low over the page, typing speeds up so the page rushes away, and a second and third ink come in. The breakdown lifts back up, slows, and you watch the drop's heavy lines roll off into the distance: the exhale is visible as history. |
| Ticker at rest, colour LED-wall flight on the drop (Floor, transplant 4) | **Act** | Almost exactly the plan above, but it is the *same* page in both states, so the drop is a change of place, not a change of programme. |
| Honest amber on a dark ground, reads across the room (Floor, theme 2) | **Keep** | Amber on black stays the default; the unlit LEDs stay faintly visible as hardware. |
| Retire the originals or fold them into richer scenes (Floor, Psychonaut, Curator "cut outright") | **Reject** | The brief is to give Raph's sketch a proper stage. |
| Fold Text into Dot Matrix as a mode; a line the DJ types, set big (Floor) | **Reinterpret** | The performer's words survive as an *event*: at each drop the machine prints the next word from the list as a double-height banner line, which then rolls away with everything else. The sign becomes a headline, once per section (the designer's praised pattern), not the piece. |
| Headlines that change with the section (Designer theme 4) | **Act** | Words are a `/`-separated list; each drop prints the next one. |
| Keep V1's Equaliser and Marquee programmes | **Reject** | V1 stays in the app for those. An equaliser is exactly what TASTE.md rules out, and three programmes was coverage, not a piece. |
| Anticipation is the under-used tool (Director theme 2) | **Act (small)** | The build's snare roll types itself as a run of full stops, an ellipsis: the page literally says "…" before the drop. |

## The plan

1. **The music typed as text.** A letter every 1/rate seconds. Its five
   columns are matched to five band groups (bass, low-mid, mid, high-mid,
   treble), and the letter chosen is the nearest glyph in the 5×7 font by
   column ink, with a little chance among near ties and a spelling rule (no
   more than two consonants or two vowels running) so words are pronounceable.
   Quiet makes a space; a word never runs past seven letters.
2. **A vocabulary of events, each in its own place.** Kick: the letter is
   struck bold (double strike, as dot-matrix printers did) in red, Raph's red
   dot; the print head flares, lighting the few LEDs around it. Clap: a full
   stop and a space, so claps end sentences and a snare roll is an ellipsis.
   Hats: a diacritic dot above the letter. Every letter is typed white-hot
   and cools to its ink in about a second, so the leading edge of the record
   is always the brightest thing on screen.
3. **The page in perspective.** A WebGL2 fragment shader draws an endless LED
   floor (round LEDs with lens cores and a halo, antialiased and averaged with
   distance so the far grid never moirés), sampling a small data texture of
   the page (one texel per LED, a ring of 256 rows). Carriage returns glide
   the page back a line; the camera drifts gently after the print head.
4. **Drop = flight, as params.** `Typing speed`, `Flight` (reading view to a
   low skim with a visible horizon), `Drop inks` (one ink to a three-ink chord
   by each letter's dominant register), `Glow`. `presets: { calm, drop }` and
   `follow` ("Follow the track", default on) easing between them on a
   hysteretic section follower, as in Jags V2.
5. **Headline per drop.** The words list, printed double height in the accent
   ink when the drop arrives (and by an action when the VJ wants it).

Not touched: the LED colours, amber default, lit-over-unlit hardware look,
the 5×7 font, the red mark for peaks, and V1 itself.

## What changed

All five planned changes went in, with these decisions made while looking:

1. **Letters.** Matching the spectrum straight against glyph silhouettes typed
   nothing but I, J, T and Y in quiet passages (only the mid bands are
   awake, and those are the letters with a heavy middle column). A penalty on
   the last four letters typed, plus the tie window, gives a varied but
   still recognisably *quiet* vocabulary ("JITJO TKIJTO FCI") against the
   drop's heavy, stemmy one ("GYABÖQ", "ÁSREQY"). The two registers really
   do read as two moods of the same language.
2. **Drop inks.** I first gave the chord four voices (amber, red, gold, ice)
   and the drop read as red, orange, gold and blue: a rainbow by committee.
   Now the ink leans only toward pale gold or ice for letters that sit
   higher than the recent average, the red is kept for kicks and the banner,
   and the base amber was pushed yellower (255,170,18) so the red kick
   letters separate from it at a distance.
3. **The flight.** The first drop camera (horizon at 30% of the frame, near
   rows foreshortened to 40%) left the top half of the frame empty and the
   text small, so the drop looked *smaller* than the calm. The final drop
   brings the horizon to the top edge, foreshortens less, and zooms in
   (74 columns across the near edge instead of 100), with the camera leaning
   after the print head (0.12 of its offset at rest, 0.42 in the drop), so
   each carriage return becomes a lateral sweep across a page too wide for
   the frame. Big red letters rushing under the camera is the drop.
4. Everything else as planned: the kick is a bold red letter plus a small
   flare of the print head's lamp; claps type full stops (the build's snare
   roll types "GÖZX........", a literal ellipsis before the drop); hats put
   dots over letters; words cycle one per drop (LOUDER, AGAIN, HIGHER, ONE
   MORE TIME) as a double-height banner; `follow` eases rate, flight, inks
   and glow between `calm` and `drop`, with a third preset, `reader`
   (straight down, slow).

Controls (8): LED colour, Typing speed, Flight, Drop inks, Glow, Kick
strike, Words, Follow the track. Actions: Print the next words, Clear the
page (the original's space bar).

## Before/after

- V1 `harness/renders/orig/dotmatrix/sheet.png`: "VIZ" scrolling across a
  flat amber panel in every tile; the drop tiles differ only by a ghost
  smear. (V1's Ticker, which nobody saw, is at
  `{"mode":0}`: bar-graph humps in rows, a record but a meter.)
- V2 `harness/renders/v2/dotmatrix/sheet.png`: 2–8 s a page being typed in
  amber, seen nearly square-on; 10 s the ellipsis; 12–16 s the camera down
  low, LOUDER in red, red bold kick letters every few letters, a few ice
  letters; 18–24 s the camera lifting and the drop's lines rolling away up
  the frame while quiet amber lines are typed under them.
- Best frame: `harness/renders/v2/dotmatrix-720/frame-16s.png` (the drop)
  for the drop, and `harness/renders/v2/dotmatrix-96/frame-48s.png` at rest
  (a full page of receding history, AGAIN in red among it).
- 96 s: `harness/renders/v2/dotmatrix-96/sheet.png`. It never repeats and
  never saturates: the ring holds about 25 lines and the fog takes the
  oldest before they are overwritten; each drop prints the next word.
- Jolt (640×360, seed 1): **calm**, drop kickArea 0.09, kickMean 0.017,
  ratio 1.52; build kick area 0.14, ratio 0.94. The heat map shows the kick
  confined to the newest letters and the head's lamp.

## What I'd still do

- (Fixed after review.) The first drop used to fly toward empty sky, because
  a fresh page had no history. On enter, a blank page now arrives already
  written: about 21 quiet-language lines from the same matcher and spelling
  rule, cooled to the ink. The first drop (12–16 s in
  `harness/renders/v2/dotmatrix-720/sheet.png`) shows text receding to near
  the top of the frame. "Clear the page" stays honestly blank.
- Nothing is measured on a GPU yet: the shader does ten texture reads a
  pixel, which should be comfortable, but `harness/fps.mjs` should confirm.
- The Equaliser and Marquee programmes are V1-only by design.
