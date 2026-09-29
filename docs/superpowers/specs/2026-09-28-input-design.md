# Input pass: listening like a VJ rig

Raph (2026-09-28), after asking how real VJ equipment handles music: "let's do
the input polish pass. think through what our requirements should be, from the
point of view of the bedroom VJ / club VJ / streamer."

Priority is the party (the club VJ, in a friend's living room or a small club),
then the bedroom VJ practising for it, then the streamer.

## Where we are

- Scenes receive `signals`, nine octave bands scaled 0–100 by a fixed treble
  boost and gain, and nothing else. There is no beat, tempo or section signal,
  so about ninety scenes each carry a private kick/section detector, all tuned
  against the harness's clean synthetic 124 BPM track.
- Snapshot glides measured in beats and bars assume 124 BPM (`ASSUMED_BPM`)
  for any real source.
- Follow the music is one slow energy follower on bands 0–1 (`stepDetector`).
- The mic is opened raw (echo cancellation, noise suppression and auto gain
  already off), from the default device only.
- The published artifact's sandbox refuses microphone and screen capture, so
  live input only works when the app is served from somewhere else.

## Who needs what

**Club VJ** — loud dark room, next to the DJ, driving a projector or TV.
- A clean signal: choose the input device (a USB interface on the mixer's booth
  or record out) and channel; see a level meter and a clipping warning; a mic
  fallback that survives crowd noise, reverb and a laptop mic's missing
  sub-bass.
- Tempo that is right: the mixer's MIDI clock when there is one; tap tempo,
  nudge earlier/later, "this is beat one", half/double time when there isn't;
  glides measured in the real tempo.
- Beats where the room sees them: projectors and TVs add 50–150 ms, so the
  beat must be predictable, not merely detected late.
- Never breaks: silence between tracks doesn't freeze or blank the stage; an
  unplugged interface recovers; no internet needed once loaded.
- The arc stays the VJ's (the performer model); automatic Follow is a backup
  that a better section signal makes trustworthy.

**Bedroom VJ** — practising at home, music on the same laptop.
- Pick a source and it looks right: no gain or treble fiddling.
- Hear the laptop's own audio: browser tab audio where Chrome offers it,
  otherwise a loopback device (BlackHole, VB-Cable) chosen as an input.
- Files dropped on the stage (already works).

**Streamer** — lowest priority; leave room, build little.
- A clean output: no panel, chosen scene and preset from the URL, so it can be
  an OBS browser source.
- Audio from a loopback device, with a delay so visuals match a delayed
  stream.

## Design

### 1. One analysis engine in core

An AudioWorklet analyses the input at audio rate (hop of about 5.8 ms,
256 samples at 44.1 kHz) instead of sampling the AnalyserNode once per video
frame, which is too coarse to time onsets. It produces:

- **Bands** — the same nine octave bands as today, for continuity.
- **Auto levels** — per band, a floor and ceiling that chase the signal (fast
  towards the extremes, slow back, as `stepDetector` does), mapping each band
  to 0–100. They are calibrated so a normal track lands in the same range the
  scenes were tuned on (the demo/harness track's per-band distribution), so
  existing scenes need no retuning. Treble boost and gain survive as an
  optional manual trim, off by default.
- **Onsets** — spectral flux with adaptive thresholds in three regions: kick
  (roughly 40–200 Hz, weighting the 100–200 Hz punch that small mics still
  hear), snare/clap (broadband mid), hat (above 6 kHz). Each is an event with a
  strength, plus a decaying envelope.
- **Tempo and phase** — a tempo estimate from the onset strength signal
  (autocorrelation over 70–180 BPM, preferring the previous estimate), and a
  phase-locked beat clock that keeps running through missed or ambiguous
  kicks. Outputs BPM, beat phase, bar phase, beat count and a confidence 0–1.
  Bar one comes from the strongest recurring kick, and the VJ can correct it.
- **Section** — `drop` 0–1 (sustained low-end energy relative to the track's
  own range, today's follower made robust) and `build` 0–1 (rising high-band
  energy and onset density while the low end thins or holds). Silence is its
  own state.

### 2. What scenes receive

`signals` is unchanged in shape and meaning, now auto-levelled, so every
existing scene keeps working. New, additive: `ctx.audio`, documented in
`web/CONTRACT.md`:

```js
ctx.audio = {
  kick, snare, hat,            // envelopes 0-1, peak at the onset
  kickHit, snareHit, hatHit,   // true on the frame an onset lands
  bpm, confidence,             // tempo and how sure we are, 0-1
  beat, bar,                   // phases 0-1; beat crosses 0 on each beat
  beatCount, barCount,
  drop, build,                 // section signals, 0-1
  silent,                      // no signal for a while
  source                       // 'demo' | 'file' | 'input' | 'tab' | 'midi-clock'
};
```

With a tempo lock, `kickHit` and `beat` are predicted: they can fire slightly
ahead of the audio to cancel display latency (see 4). Scenes move to
`ctx.audio` when we polish them; nothing forces a migration.

### 3. Sources and the panel

- **Source**: Demo · File · Input · Tab audio. Input lists every audio input
  by name, with a left/right/mono choice. It remembers the device and re-opens
  it after a reload, or after the device is unplugged and plugged back in.
- **Level meter** with clipping and "no signal" states, replacing the bare
  band monitor's role as the only sign of life.
- **Tempo row**: detected BPM with a confidence dot; Tap (key T; four taps set
  tempo and phase); nudge ← → (key , and .); "this is one" (key 1 is taken by
  scene picking, so B for bar); ×2 and ÷2. MIDI clock appears when a MIDI
  device sends one, and wins while it runs.
- **Latency** slider, −150 to +150 ms: negative fires beats early (projector
  lag, uses prediction); positive delays the visuals (a delayed stream).
- **Silence**: after two seconds of silence the scene coasts on its calm
  preset instead of freezing, and resumes on the next onset.
- Glides and Follow the music read the real tempo and section signals.

### 4. Latency, precisely

Audio analysis runs a few milliseconds behind the sound. Delaying visuals is
easy (buffer the analysis). Showing the beat early is only possible when the
beat is predicted, so negative offsets act on the beat clock, onset events
while locked, and section changes, not on raw bands. With a low confidence the
offset is clamped to zero rather than guessing.

### 5. Streamer mode (small)

`?scene=<id>&preset=<name>&panel=0` opens the stage without the panel.
A loopback device is just another Input. Nothing more for now.

### 6. Verifying it

- The render harness gains an audio mode: `--audio <file>` runs the real
  analysis engine on a recording instead of the scripted track, so any scene
  can be rendered, jolted and contact-sheeted against real music.
- **Room simulation**: a degrade step turns a clean file into "laptop mic in a
  loud room" (low cut below 100 Hz, room reverb, crowd noise, compression,
  occasional clipping). Every detector check runs on both clean and degraded
  audio.
- **Accuracy tests** (`npm test` style, in node): tempo within 1 BPM and phase
  within 30 ms on click tracks and on synthetic tracks at 90–174 BPM, clean and
  degraded; onset recall and precision against the scripted track's known hits;
  auto levels reproducing the demo distribution within tolerance.
- **Real recordings**: Raph records a few minutes at an actual party (mic and,
  if possible, line), kept out of git, and they become the acceptance test.
  Until then, a handful of his own tracks through the degrade step stand in.

## Not in this pass

Ableton Link (needs a native helper; browsers can't join it), Pioneer network
integration, pre-analysing files for phrase structure, the phone remote,
moving every scene to `ctx.audio`.

## Open question for Raph

Where the app lives. Live input needs it served outside the artifact:
GitHub Pages from Raphomet/viz (public; recommended, and it makes the
open-source plan real) or local only for now. Offline-after-load behaviour is
built either way.
