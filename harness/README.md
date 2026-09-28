# viz render harness

A headless way to *see* a viz scene move. It steps one scene through a scripted
24-second test track at a simulated 60 fps and writes a contact sheet, full-size
frames and a report. Built so model agents writing new scenes into
`web/scenes/` can check their work without a person watching a projector.

## Running it

Once, inside `harness/`:

```sh
npm install        # Playwright 1.63.0, pinned to the cached chromium_headless_shell-1243
```

Then, from the repo root:

```sh
node harness/render.mjs web/scenes/_selftest.js
node harness/render.mjs web/scenes/foo.js --size 1920x1080 --seed 7 \
  --params '{"ringSize":250}' --frames 3,10.5,12,20
```

| Option | Default | Meaning |
|---|---|---|
| `--out DIR` | `harness/renders/<file name>` | where the outputs go |
| `--size WxH` | `1280x720` | canvas size in pixels |
| `--seed N` | `1` | seeds `p.randomSeed`, `p.noiseSeed` and `Math.random` |
| `--params JSON` | the scene's defaults | overrides, clamped exactly as the app's panel would clamp them |
| `--seconds S` | 24 | how much track to step; without `--frames`, the 12 tiles are spread evenly up to S |
| `--frames a,b,…` | `2,4,…,24` | times in seconds to capture (rounded to the nearest frame) |
| `--density D` | 1 | p5 `pixelDensity` |

It needs network access for p5.js (loaded from the same cdnjs URL as
`web/index.html`). The exit code is non-zero if the page logged an error, threw,
failed a request, or the scene's `draw` threw on any frame.

To watch a scene in a real browser instead, serve the repo root (for example
`python3 -m http.server` from the repo root) and open
`/harness/stage.html?scene=../web/scenes/foo.js`, then run `HARNESS.play()` in the
console.

## Outputs

- **`sheet.png`** — the contact sheet. One tile per captured time (4 columns),
  in time order. Under each tile: the time and the track section
  (`10.0s · drop`), and a strip of nine bars showing the band values 0–100 the
  scene received on that frame, bass (red, 0) to treble (violet, 8). Read the
  tile against its strip: a scene that responds to music should look different
  in the drop tiles than in the intro and breakdown tiles.
- **`frame-XXs.png`** — each captured frame at full size (`frame-02s.png`,
  `frame-10.5s.png`).
- **`report.json`** — scene id, name and `gallery` metadata, the params and seed
  used, WebGL availability and renderer, console errors and warnings, uncaught
  exceptions, failed requests, the number of frames where `draw` threw, a
  SHA-256 prefix of every PNG, and timing:
  - `renderTime` — per frame, `draw()` plus forcing the canvas to finish
    (a one-pixel readback). **This is the number to judge performance by.**
    Chromium records canvas and WebGL commands and rasterises them later, so
    timing `draw()` alone measures only the JavaScript.
  - `drawTime` — `draw()`'s JavaScript alone.
  - `frameTime` — the whole p5 redraw as the harness drives it.
  - `wall` — how long the stepping and the whole run took.

  Each timing has mean, p50, p95 and max in milliseconds. The max is usually the
  first frame (shader compilation, first raster), so read p95.
- A one-paragraph summary on stdout with the paths, errors and timings.

The track, `track.js`, is 124 BPM with its beat grid anchored so the drop starts
on a downbeat at 10.0 s:

| Time | Section | What is in it |
|---|---|---|
| 0–4 s | intro | near-silence; a soft pad in bands 2–4 |
| 4–10 s | build | eighth-note hats in 6–8 growing louder, kick fading in, a riser through the top bands, a snare roll in the last bars |
| 10–18 s | drop | kick on every beat (0–1), clap on 2 and 4 (3–5), hats, a sidechained bass line (1–2) |
| 18–24 s | breakdown | kick out, a sustained pad in 2–4, sparse hats |

Values are the final 0–100 band values a scene receives (after the app's boost
and clamping), with percussive fast-attack exponential-decay envelopes. Past 24 s
the track loops. `VIZ_TRACK.bands(t)` and `VIZ_TRACK.section(t)` are globals in
the stage page if a tool needs them.

## Determinism

The same scene file, size, seed, params and density produce byte-identical
PNGs (verified by rendering `_selftest` twice and comparing every file):

- p5 runs under `noLoop()`; the harness draws each frame with `p.redraw()`. Every
  frame from 1 to the last requested one is drawn, in order, because scenes
  accumulate state and some never clear the canvas.
- Frame *n* is drawn at simulated time *n*/60 s. `p.millis()`, `performance.now()`
  and `Date.now()` return simulated time; `p.frameCount` is *n*; `p.deltaTime`
  is 16.67.
- `Math.random` is replaced by a seeded PRNG before the scene file loads (so
  randomness at load time is seeded too); `p.randomSeed` and `p.noiseSeed` get
  the same seed before the scene's `setup`.
- WebGL runs on SwiftShader (CPU), which renders identically run to run.

Not covered: `new Date()`, `crypto.getRandomValues`, and anything asynchronous
(timers, image loads after `preload`) — keep scenes synchronous per frame.

## How the stage hosts a scene

`stage.js` implements `VIZ.register` and hosts the one scene the file
registers. Its per-frame wrapper mirrors `web/core.js`: `push`; `scale` so the
short side is 600 virtual units; `draw(p, signals, params, ctx)` with
`ctx = { width, height }` in virtual units and a fresh `Float32Array(9)` of
signals; unwind p5's style stack to the depth before the draw; `pop`. If `draw`
throws, the error is logged once and the frame is painted black, as in the app.
It calls `preload(p)`, then `setup(p, ctx)` and `enter(p, ctx)` once, after
the same `pixelDensity`/`createCanvas`/`smooth`/`background(0)` the app does.
`actions` are ignored. The page has `<base href="../web/">`, so a scene's
relative asset URLs (`p.loadImage('assets/toph.jpg')`) resolve as they do in
the app.

## Writing a scene for the harness

Everything in `web/CONTRACT.md` applies. In addition:

- **Where**: one file per scene, `web/scenes/<id>.js`, calling `VIZ.register`
  once. Use `order` ≥ 100 so new scenes sort after the 2016 set.
- **Metadata**: add a `gallery` object:

  ```js
  gallery: {
    title: 'Harness self-test',        // display title
    technique: 'Canvas 2D over a WebGL2 shader layer',  // how it is made
    brief: 'What it should look and feel like, and how it responds to music.',
    lineage: 'What it descends from: an original .pde, an artist, a technique.'
  }
  ```

- **Set all your own drawing state every frame**: `colorMode`, `rectMode`,
  `ellipseMode`, `strokeCap`, stroke, fill, `strokeWeight`, `textAlign`,
  `blendMode`, and `drawingContext.globalCompositeOperation` / `globalAlpha` if
  you touch them. Other visuals share the p5 instance in the app, and nothing
  resets these for you.
- **Time**: use `p.millis()` and `p.frameCount`, never a wall clock, and no
  `setTimeout`/`requestAnimationFrame` of your own.
- **WebGL**: the p5 canvas stays 2D. Render WebGL into your own offscreen
  canvas and composite it:

  ```js
  const w = Math.round(p.width * p.pixelDensity());
  const h = Math.round(p.height * p.pixelDensity());
  if (!this.glCanvas) {
    this.glCanvas = document.createElement('canvas');
    this.gl = this.glCanvas.getContext('webgl2');   // compile shaders once, here
  }
  if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
    this.glCanvas.width = w; this.glCanvas.height = h;
  }
  // … gl.viewport(0, 0, w, h); set uniforms from p.millis() and signals; draw …
  // The virtual-stage scale is already applied, so this covers the stage:
  p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
  ```

  Size the canvas in device pixels (as above) so it is as sharp as the p5
  canvas, check for a missing context and show something rather than throwing,
  and create the context lazily or in `setup` — once, not per frame. A p5
  `createGraphics(w, h, p.WEBGL)` buffer drawn with `p.image(g, 0, 0, ctx.width, ctx.height)`
  works too (call `g.reset()` each frame: a graphics buffer's transforms are not
  reset by the main redraw).
  `web/scenes/_selftest.js` is a complete example.
- **Check it**: `node harness/render.mjs web/scenes/<id>.js`, then look at
  `sheet.png` and `report.json`. A clean run has no console errors, no
  exceptions, no failed requests, and `drawErrors: 0`.

## Speed and limits

Measured on the laptop (Apple Silicon, headless Chromium 153, 1280×720, full
24 s = 1,440 frames):

| Scene | Stepping time | `renderTime` mean / p95 |
|---|---|---|
| `web/viz/rings.js` (2D) | 1.7 s | 1.2 / 1.4 ms |
| `_selftest` 2D only (`{"glLayer":1}`, 12 s) | 0.2 s | 0.7 / 0.3 ms |
| `_selftest` with its full-screen WebGL2 shader | 15.6 s | 11 / 19 ms |

- WebGL runs on SwiftShader, a CPU rasteriser. A full-screen fragment shader
  costs roughly 10 ms a frame at 1280×720, far more than on a GPU, so
  `renderTime` for WebGL scenes overstates what the app will cost on real
  hardware. Compare WebGL scenes with each other, not with 2D ones; use a
  smaller `--size` for faster iteration.
- Timings from a busy machine are noisy; determinism of the pixels is not
  affected.
- The harness hosts one scene at a time, so state leaking *between* visuals
  (the reason to set all drawing state every frame) is not tested here.
- Fonts: the page loads no web fonts; `p.text` uses the browser default
  sans-serif unless the scene loads a font in `preload`.
