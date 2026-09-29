# viz, in the browser

A port of the 2016 Processing VJ tool in the parent directory to plain HTML and
[p5.js](https://p5js.org). The six finished visuals (Text, Arcs, Rings, Jags,
Parametric Lines, Twinkle Toph) are drawn the way the originals drew them, and
the controlP5 window becomes the panel on the right. There's no build step: it's
static files.

## Run it locally

```sh
cd web
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` straight from disk
doesn't work, because the fonts and images load over HTTP. Serving it this way
is also what makes the microphone work: browsers only grant it to `localhost`
or HTTPS pages, and never inside an embedded frame.

## Sources

- **Demo** is selected at load: a synthetic 120 BPM groove (kick, snare on 2 and
  4, eighth-note hats) so the visuals move before you've given the page any
  audio.
- **Audio file**: choose a file or drop one on the stage. It plays out loud and
  loops.
- **Microphone** listens to the room, like the original on a laptop's built-in
  mic. Echo cancellation, noise suppression and auto-gain are switched off so
  the levels aren't pumped.

The signal monitor, EXPBASE (treble boost) and SIGNALSCALE (gain) work as they
did in 2016: nine octave bands from a 512-point FFT, each boosted by
`expBase^band × signalScale` and capped at the red line (100). Raise treble
boost until every bar can reach the line, then set overall loudness with gain.

## Keys

| Key | Does |
|---|---|
| 1–6 | Pick a visual |
| H | Hide or show the panel |
| F | Fullscreen the stage (for the projector) |
| L | Finish on or off, to compare the scene with and without it |

The Finish (lens, light and grade over every scene) and the Effects rack are
in the panel; see `CONTRACT.md` and `../harness/briefs/fx.md`.

Settings for each visual, the selected visual, the two signal sliders, the
Finish and the effects rack are remembered in the browser.

## What changed from the original

Dropped:

- The Korg nanoKONTROL2 MIDI mapping. Everything is on the panel instead.
- The unfinished sketches that were never switched on: Planets, Diamonds,
  DotMatrix, Flyover and Video.

Fixed:

- The SENSITIVITY knob now reaches the visuals. In the original panel it was
  never passed through.
- The "channel" pickers for SIZE0 and SIZE1 are wired up, and bands that were
  hard-coded (Jags and Parametric Lines read band 5) can be chosen.
- Each visual sets its own colour mode. In Processing, Parametric Lines' HSB
  mode leaked into every other visual.

The generic knob names (SIZE0, X1, …) are still shown next to each control, but
every control is labelled with what it actually does in the current visual.
