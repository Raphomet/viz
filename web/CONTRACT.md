# viz web port — shared contract

A browser port of the 2016 Processing VJ tool in the parent directory (`../*.pde`,
`../VizBase.java`, `../VizControlFrame.java`, `../viz.pde`). Fidelity to the
original look is the goal; the MIDI controller is dropped; the controlP5 panel
becomes an HTML side panel.

Plain static files, no build step, no modules (classic `<script>` tags, globals).
Rendering is **p5.js 1.11.13 in instance mode** loaded from
`https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.13/p5.min.js`.
The page is published as a claude.ai Artifact: CSP allows scripts only from
cdnjs/jsdelivr/unpkg, stylesheets only from Google Fonts, and `fetch` only of
files published alongside the page (relative URLs). Microphone is refused inside
the Artifact frame, but must still work when the folder is served locally.

## Files

```
web/
  index.html        page, CSS, panel markup, <script> tags          (core task)
  core.js           registry, audio, band analysis, panel, p5 host  (core task)
  palettes.js       window.VIZ_PALETTES                             (core task)
  viz/text.js       Text                                            (task: text+toph)
  viz/toph.js       Twinkle Toph                                    (task: text+toph)
  viz/arcs.js       Arcs                                            (task: arcs+jags)
  viz/jags.js       Jags                                            (task: arcs+jags)
  viz/rings.js      Rings                                           (task: rings+parametric)
  viz/parametric.js Parametric Lines                                (task: rings+parametric)
  assets/FreeSans.ttf, assets/toph.jpg, assets/igor.png
```

Script order in index.html: p5, palettes.js, core.js, then every viz/*.js.
core.js must not start p5 until `window` `load`, so all registrations are in.

## Palettes

`palettes.js` defines `window.VIZ_PALETTES`: an array of 23 entries
`{ name: string, colors: ['#DCD6B2', ...5 hex strings] }`, in exactly the order
of the `palettes` array in `../Text.pde` / `../Jags.pde`. Names: index 0
"Picasso · The Dream", 1 "Chagall" (the ColorLisa credits in the source); the
rest are named "Palette 3" … "Palette 23" (1-based display numbers).

## Registering a visual

Each viz file calls `VIZ.register(def)` once. `def` is a plain object; core calls
its methods with `this === def`, so a viz keeps its own state on `this`.

```js
VIZ.register({
  id: 'arcs',                 // stable, used for storage keys
  name: 'Arcs',               // menu label, same as the original getName()
  order: 2,                   // menu order: Text 1, Arcs 2, Rings 3, Jags 4,
                              //   Parametric Lines 5, Twinkle Toph 6 (original order)
  params: [ /* ParamSpec, see below; panel shows them in this order */ ],
  actions: [ { id: 'shuffle', label: 'Shuffle palette', run(params) {} } ], // optional
  preload(p) {},              // optional: p5 preload phase — p.loadFont / p.loadImage here
  setup(p, ctx) {},           // optional: once, after p5 setup, for every viz
  enter(p, ctx) {},           // optional: when switched to
  leave(p) {},                // optional: when switched away from
  draw(p, signals, params, ctx) {} // every frame while selected
});
```

### Versions

A redesign of an existing scene lives in its own file under `scenes/v2/` and
registers a separate def with `id: '<v1 id>v2'`, the same `name` as the
original, `versionOf: '<v1 id>'` and `version: 'V2'`. The Visual list shows the
scene once, at the original's position, with a small V2 tag (filled while V2 is
live); a Version control at the top of Controls and the `V` key switch between
the two defs (with the usual `leave` / `enter`). Each def keeps its own params
under its own id. The chosen version is remembered per scene in `localStorage`
(`viz.version.<v1 id>`). A def whose `versionOf` names an id that never
registered is listed as its own entry. The harness hosts one def and ignores
both fields.

### Suggested snapshots (optional)

A scene MAY suggest looks for the performer controls (see "Performer
controls" below):

```js
presets: {
  calm: { speed: 0.4, trail: 0.9 },     // goes into slot A
  drop: { speed: 2.5, mode: 2 },        // goes into slot B; also the default Drop slot
  shimmer: { hue: 3 }                   // any other names fill C, then D
}
```

Keys are param keys; values use the param's own units (select/palette index,
band 0–8, text string). Keys a preset leaves out take the param's default, so
each suggestion is a complete look. Unknown keys are ignored and values are
sanitized like stored params. Core copies the presets into a scene's slots only
while all four slots are empty and the performer has not pressed "Clear
snapshots"; after that the slots are the performer's. A scene without
`presets` simply starts with empty slots. A V2 def carries its own `presets`.

### draw arguments

- `p` — the p5 instance. **Every** Processing call becomes `p.xxx(...)`:
  `p.background`, `p.stroke`, `p.arc`, `p.map`, `p.constrain`, `p.random`,
  `p.millis()`, `p.frameCount`, `p.TWO_PI`, `p.HALF_PI`, `p.PI`, `p.HSB`,
  `p.RGB`, `p.CENTER`, `p.SQUARE`, `p.TRIANGLE_STRIP`, etc.
- `signals` — `Float32Array(9)`, the nine octave bands, each already boosted and
  clamped to **0–100**, exactly like `getAdjustedFftSignals()` in `../viz.pde`.
  Index 0 is bass, 8 is treble. Code that did `% 9` keeps doing `% 9`.
- `params` — plain object of the current value of every param, keyed by `key`.
- `ctx` — `{ width, height }`: the **virtual** stage size. Use these instead of
  `p.width` / `p.height` everywhere.

### Virtual stage (important)

The originals were tuned for a 600×600 window with hard-coded pixel constants
(ring spacing 20, curve scale 250, …). Core scales the drawing so the stage's
shorter side is always 600 virtual units: before calling `draw` it does
`p.push(); p.scale(s)` and after it `p.pop()`, with `ctx.width = p.width / s`
and `ctx.height = p.height / s`. So write the port as if the window were
`ctx.width × ctx.height` with the short side 600. `p.background()` still fills
the whole canvas. Core resets `p.resetMatrix()`-level state per frame via
push/pop; **each viz must set every piece of drawing state it relies on each
frame** — `colorMode`, `rectMode`, `ellipseMode`, `strokeCap`, stroke/fill,
`strokeWeight` — because other visuals run on the same p5 instance. In
Processing all `init()`s ran at startup and the last `colorMode(HSB, 256)` from
ParametricLines leaked into everything; do not reproduce that leak, just set the
mode each visual meant at the top of its `draw` (e.g. Arcs and Rings:
`p.colorMode(p.HSB, 255)`; ParametricLines: `p.colorMode(p.HSB, 256)`; visuals
that only use hex colours / greys: `p.colorMode(p.RGB, 255)`).

The p5 canvas is not cleared between frames (same as Processing), so a `draw`
that returns early (Twinkle Toph mode 0) leaves the previous frame showing.

Time: use `p.millis()` and `p.frameCount` wherever the original used
`millis()` / `frameCount`, so animation behaves the same.

Performance: you may drop to `p.drawingContext` (Canvas 2D) inside a hot loop
if p5 calls are too slow, as long as the result looks the same.

### ParamSpec

The original's generic knob names (SIZE0, X1, …) are kept as `legacy` but the
panel shows a label saying what the control actually does in this visual.

```js
{ key: 'size0', legacy: 'SIZE0', label: 'Arc count', type: 'range',
  min: 1, max: 40, default: 1, step: 0.01 }          // step optional; core picks one
{ key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
  options: ['Solid rings', 'Rainbow rings'], default: 0 }   // value is the index
{ key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
  palettes: [ { name, colors: [hex…] } ], default: 0 }      // value is the index;
                                          // colors: [] is allowed for special
                                          // generated palettes (panel shows the name only)
{ key: 'alphaSignal', legacy: 'ALPHA CHANNEL', label: 'Opacity follows band',
  type: 'band', default: 0 }                                 // value 0–8
{ key: 'displayText', legacy: 'DISPLAYTEXT', label: 'Words', type: 'text',
  default: 'VIZ' }
```

Rules for choosing params:
- Include every control the original visual declared `uses…` for, with its
  original min / max / default. Where the original setter for a legacy slot
  mapped 0–127 from MIDI, ignore that — the panel sets real values directly
  (the `normalized === true` path).
- Integer-valued things (mode, palette, counts the original cast with `(int)`
  or `round`) keep that casting inside `draw`, as in the original.
- Where the original hard-coded a band (e.g. `signals[5]` in Jags and
  ParametricLines) or had a channel dropdown that was never wired up
  (`size0Signal`, `size1Signal`), expose it as a `band` param whose default is
  the original hard-coded value. This fixes a known bug in the old panel.
- The original SENSITIVITY knob never reached the sketch from the GUI (a missing
  case in `controlEvent`); here it is just a normal range param.

## Core responsibilities (for reference by viz authors)

- Keeps each viz's param values across switches, persists them in
  `localStorage` (guarded), offers "Reset to defaults" per viz.
- Calls `action.run(params)` with `this === def` when an action button is clicked.
- Signals come from one of: **Demo** (default at load; synthetic 120 BPM pulse,
  needs no audio permission), **Audio file** (picker or drag-and-drop onto the
  stage, plays out loud and loops), **Microphone** (works when served locally;
  in the Artifact frame it fails and says so).
- Global controls: `expBase` 0–3 (default 1.75) and `signalScale` 0.5–8
  (default 4) exactly as in `../viz.pde`.

## Performer controls

Added 2026-09-28. The performer shapes a scene across all its params at once
rather than along a single Intensity axis. Core owns all of this; a scene only
declares params (and, optionally, `presets`). Everything is per def id, so a V1
and its V2 each have their own snapshots and settings.

- **Snapshots.** Four slots, A–D, at the top of Controls. Tapping an empty slot
  stores the current value of every param in it; tapping a filled slot recalls
  it. To overwrite a filled slot, arm **Store** and tap it, or Shift+click it.
  The × on a filled slot clears it. "Clear snapshots" empties all four;
  "Reset to defaults" leaves them alone.
- **Glide.** Cut, 1 beat, 1 bar or 4 bars (default 1 bar). Core detects no
  tempo, so a beat is 0.5 s under Demo (its 120 BPM) and 60/124 s otherwise. On
  recall, `range` params travel with an ease-in-out; `select`, `palette`, `band`
  and `text` params switch at the halfway point.
- **Morph fader.** A horizontal fader between two chosen slots (default A ↔ B).
  Moving it sets every param to the blend at that position, by the same rules:
  ranges interpolate linearly along the fader, discrete params switch at the
  middle. Recalling a slot that is one of the fader's ends parks the fader at
  that end, so grabbing it next does not jump.
- **Override rule.** A control touched by hand stays where the performer put
  it: a running glide stops moving it, a held Drop will not pull it back on
  release, and Follow the music skips it. The next hand on the fader, or the
  next recall, releases every such hold and moves the whole look again.
- **Drop button (option, off by default).** Momentary: while held (mouse, touch,
  or Space held down) params glide to the drop slot at the chosen glide time; on
  release they glide back to where they were (or to where a running glide was
  heading). The drop slot is choosable: default D, or the slot holding the
  scene's `drop` preset.
- **Follow the music (option, off by default).** A slow energy follower on bands
  0–1, ranged against a floor and ceiling that adapt to the track, drives the
  fader between its two ends (left = calm, right = drop). It pauses while a
  glide or drop runs. Any hand on the fader or a slot turns it off and the panel
  says so; a "Following" tag shows while it is driving.
- **Switching away** mid-glide or mid-drop finishes the glide (or returns from
  the drop) instantly, so a scene is never left half-way.
- **Keys.** Q W E R recall A–D (storing if empty); Shift+Q–R store; Space held is
  the Drop, only while that option is on.
- **Persistence.** Slots, glide, fader ends and position, drop slot and the two
  option toggles live in `localStorage` under `viz.perform.<def id>` (guarded).
  Stored snapshot values are sanitized against the current params on load, so a
  scene may add or retune params without breaking existing snapshots; a param a
  snapshot does not know keeps its current value on recall.
