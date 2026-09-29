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

## Finish

Added 2026-09-28. Every scene is drawn through a shared post-process, the
Finish, so it reads as light through a lens rather than crisp vector maths:
motion blur (a short exponential shutter that lets go where a whole region
changes at once, so kicks stay crisp), soft focus, bloom above a threshold with
warm halation, a filmic tone curve (AgX on an inverse-mapped input: greys come
out where they went in, highlights roll off, very bright colour goes towards
white), a grade preset (Neutral, Film, Print, Night, Bleach), vignette,
optional chromatic aberration and animated grain. It runs in WebGL2 on a canvas
stacked over the p5 canvas (`web/fx.js`, `web/fx/motionblur.js`, `bloom.js`,
`film.js`); scenes draw exactly as before and need not know it exists.

The performer sets it globally (the Finish section; `L` toggles it for an A/B;
stored in `localStorage` under `viz.finish`). A scene may adjust it with an
optional `finish` field in its def:

```js
finish: false                         // opt out: this scene is shown as drawn
finish: { bloom: 0, grain: 0.5 }      // scale stages: 1 = as set, 0 = off
finish: { strength: 0.5, grade: 'neutral' }
```

Numeric keys scale the performer's setting for that stage: `strength` (all of
it), `motionBlur`, `bloom`, `softness`, `halation`, `tone`, `grade` (the grade
amount), `grain`, `vignette`, `aberration`. A string `grade` names the preset
used for this scene. Opt out when the scene's look depends on exact flat colour
or hard pixel edges, or when it already does its own lens work.

The effects rack (`web/fx/*.js`, interface in `harness/briefs/fx.md`) runs
before the Finish, in the order the performer sets in the Effects section.

## Scene browser

Added 2026-09-29. The Visual list groups scenes into collections by how they
were made (`web/collections.js`: an id map, then `order` ranges; anything
unmatched shows under New), with a filter (`/`), favourites (a star per scene,
`localStorage` `viz.favourites`; keys 1–9 play the first nine once any exist)
and a thumbnail grid (`G`, thumbnails from `harness/thumbs.mjs`). `web/browser.js`
owns all of it; core lends it the registry through `VIZ.scenes`. A new scene
needs nothing beyond an `order` in its batch's block; to file it elsewhere,
add its id to `collections.js`.

## three.js scenes

Added 2026-09-29, from the Rendered spike. A scene that wants physically lit
3D, reflections and a filmic lens is written against three.js through the
shared kit, `web/three-kit.js` (`window.VIZ_THREE`). Copy
`web/scenes/_three-skeleton.js` (about 60 lines, renders as is);
`web/scenes/rendered.js` is the full reference.

### Declaring it

```js
VIZ.register({
  id: 'foo', name: 'Foo', order: 1000,
  requires: 'three',                         // run on the kit
  three: { addons: ['RoundedBoxGeometry'],   // optional: extra addons by name
           pixelBudget: 2.3e6 },             // optional: this scene's render budget
  finish: false,                             // see "Finish" below
  setup(p, ctx) {},                          // once, with ctx.three ready
  enter(p, ctx) { return lens.compile(scene, camera); },   // may return a promise
  draw(p, signals, params, ctx) {},          // render, then ctx.three.composite()
  leave(p) {}
});
```

### Lifecycle

- Nothing three.js loads at page start-up. Core starts the download (~300 KB
  compressed: three 0.186.1 plus the lens addons) in the background three
  seconds after the app is up, and immediately when a three.js scene is
  picked.
- `setup` is **not** called at start-up for a three.js scene: it runs the
  first time the scene is picked, once the kit has loaded, with `ctx.three`
  set. Build the scene, materials, textures and lens there.
- `enter` runs after `setup` each time the scene is picked. If it returns a
  promise, core shows a small "Loading three.js…" line instead of the scene
  until it resolves. Return `lens.compile(scene, camera)` (or
  `ctx.three.compile(scene, camera)` without a lens): the shader programs
  compile asynchronously, so the first live frame does not hitch (~130 ms for
  Rendered). If the download fails, the stage says so and picking the scene
  again retries.
- `draw` is called only once `enter` has settled. Render, then call
  `ctx.three.composite()` to put the frame on the stage. You may draw p5 on top
  afterwards (a caption, a HUD).
- `leave` runs as usual; the kit then frees every render target it made for the
  scene (its lens and `ctx.three.target`s; ~300 MB at 3024×1890 without the
  budget) but keeps compiled programs, geometry and textures, so the next
  `enter` is quick. Targets reallocate on the next render.
- The render harness waits the same way: the stage loads the kit before p5
  starts and is not ready until `enter`'s promise resolves. No `preload` hacks.

### `ctx.three`

One handle per scene, the same object every call.

| Member | What it is |
|---|---|
| `THREE` | the three module (0.186.1); `addons` the loaded addons by name |
| `renderer` | the one shared `WebGLRenderer` (its own canvas, pixel ratio 1) |
| `width`, `height`, `aspect`, `scale` | the render size in pixels, and its fraction of the device-pixel canvas |
| `lens(opts)` | the standard lens chain (below) |
| `environment(spec, sigma)` | a PMREM texture for `scene.environment`: `'room'` (three's RoomEnvironment), a `function (THREE, envScene)` that fills an empty scene with emitters, or `{ background, room: [w,h,d], panels: [{ size, position, rotation, color, intensity }] }` (a dark box with glowing panels, Rendered's kind) |
| `target(scale, options)` | a `WebGLRenderTarget` at `scale` × the render size that follows resizes and is freed on leave (a mirror pass, a feedback buffer) |
| `fitCamera(camera)` | keep a perspective camera's aspect on the render size (the lens does it for you) |
| `render(scene, camera)` | render straight to the kit canvas with AgX and sRGB, no lens |
| `compile(scene, camera)` | async compile for `render` |
| `shaderPass(frag, uniforms, defines)` | a fullscreen `ShaderPass` (`vUv` in, `tDiffuse` the input) for `lens.insertPass` |
| `composite()` | draw the kit canvas over the whole stage; call inside `draw` |

**Render scale.** The kit renders at the pixel budget, 2.3 MP (1080p's count),
and the composite scales it up to the canvas: the spike measured 16 fps at
native 3024×1890 against 60 at the budget, and after depth of field, motion
blur and grain the upscale does not show. A scene may set its own
`three.pixelBudget`. `VIZ_THREE.setRenderScale(s)` forces a fraction of the
canvas for every three.js scene (`null` returns to the budget) and
`VIZ_THREE.setPixelBudget(px)` changes the default budget; a panel control or
a scene may call either. Never size the renderer yourself.

**The lens** (`const lens = ctx.three.lens({ msaa: 4, motionBlur: true, dof: true, bloom: true, grade: true, motionBlurSamples: 12, dofSamples: 36 })`,
every option optional). `lens.render(scene, camera, { worldMove })` renders
into a 4× MSAA half-float HDR target, then: camera motion blur by depth
reprojection → depth of field → `UnrealBloomPass` → grade → `OutputPass` (AgX
tone mapping, sRGB). Set per frame, in plain units:

- `lens.focus` metres to the sharp plane; `lens.blur` the largest blur radius
  as a fraction of the short side (0 = sharp; Rendered uses 0.004–0.018);
  `lens.farBlur` background blur relative to foreground (0.45).
- `lens.shutter` fraction of a frame the shutter is open (Rendered: up to 1.4);
  `lens.maxVelocity` longest streak as a fraction of the height. Motion blur
  is **camera** motion only. A scene that scrolls the world past a still
  camera passes `worldMove: [dx, dy, dz]` (how far the world moved this
  frame) so the world streaks too; objects moving on their own do not blur.
  Call `lens.cut()` on a camera jump.
- `lens.bloom.strength / .radius / .threshold`: bloom is only for HDR
  emitters. Keep `threshold` above 1 (Rendered: 2) and make emitters brighter
  than 1 (`MeshBasicMaterial` with `toneMapped: false` and a colour over 1).
  Lit surfaces should never bloom.
- `lens.exposure` (1); `lens.grade.*.value`: `split` (0 = no tint),
  `shadowTint` and `highlightTint` (Vector3 multipliers), `lift`, `vignette`,
  `grain`, `aberration`.
- `lens.insertPass(pass)` adds a pass of your own before the grade, in HDR.

### Rules for three.js scenes

- **Finish: `finish: false`.** The lens chain is the finish; the shared Finish
  would add a second motion blur, bloom, tone curve and grain. Opt in (`finish:
  { … }`) only for a scene that renders with `ctx.three.render` and no lens.
- **Shared renderer.** Every three.js scene uses the same `WebGLRenderer`. The
  kit resets tone mapping (AgX), exposure, output colour space (sRGB), shadow
  maps (off), `autoClear` and clear colour on every `enter`; anything else you
  change on the renderer (shadow maps on, a clear colour), set it each frame
  or in `enter`. Never create a `WebGLRenderer` or call `setSize` /
  `setPixelRatio`.
- **One copy of three.** Import nothing yourself: ask for addons through
  `three.addons` (names in `VIZ_THREE.addonPaths`, or a path under
  `examples/jsm` such as `'postprocessing/HalftonePass.js'`). Every addon
  there resolves to the same three URL; a module from another package would
  load a second three and its objects would fail three's type checks.
- **Determinism.** Randomness through `Math.random` or a hash, never
  `crypto`; time through `p.millis()`. Three uses `Math.random` for object ids,
  so placements that must not shift when object counts change should use a
  hash (Rendered's dust does).
- **Cost.** Budget ~8 ms a frame on the M4 Pro at the pixel budget (Rendered
  takes ~7 ms in `harness/render.mjs --gpu` at 1280×720, and holds 60 fps at
  3024×1890 in the app). Iterate with `--gpu` (harness/README.md, "GPU mode"),
  and check speed with `harness/fps.mjs`.
