# JavaScript libraries that add capability (research, 2026-09-28)

What could viz load that makes imagery we cannot reasonably hand-code inside one
scene file? We already hand-roll GLSL fragment shaders, feedback buffers,
reaction-diffusion, particles, wireframes and tubes, SDF text and Canvas type, so
anything that only wraps those (the reason Hydra was rejected) is out. The bar
is specialist work: solvers, path tracing, CSG, font outlines, captured 3D, ML
models, audio analysis.

Facts below were checked on 2026-09-28 against the npm registry and jsDelivr's
file listings (versions, dates, licences, file sizes), plus project pages where
noted. Nothing was installed.

## How a library gets into our page

- **Hosts.** Scripts only from cdnjs, `cdn.jsdelivr.net/npm/`, unpkg. Note that
  `cdn.jsdelivr.net/gh/` (GitHub mirroring) is **not** covered, so anything that
  lives only on GitHub must be bundled with the page.
- **UMD** loads with a classic `<script>` tag. **ESM-only** loads from our
  classic scripts with `await import('https://cdn.jsdelivr.net/npm/<pkg>@<ver>/+esm')`
  (jsDelivr bundles it and rewrites bare imports) or unpkg `?module`.
- **Version-skew trap (verified).** jsDelivr `+esm` resolves each package's
  `three` dependency independently: `three-gpu-pathtracer@0.0.26` imports
  `three@0.186.1`, but `@sparkjsdev/spark@2.2.0`, `three-mesh-bvh@0.9.15` and
  `postprocessing@6.39.5` import `three@0.186.0`, and `three-bvh-csg@0.0.18`
  imports `three@0.182.0` plus its own `three-mesh-bvh@0.9.8`. Mixing them gives
  several copies of three.js in one page (broken `instanceof`, duplicate
  renderers). Either pin every three-ecosystem package to versions that resolve
  to one `three@x/+esm` URL and load three from exactly that URL, or run esbuild
  once in `harness/` to produce one vendored ESM bundle published alongside the
  page. An inline `<script type="importmap">` would also solve it, if the
  Artifact CSP allows inline scripts (unverified).
- **WASM.** The Artifact contract says WASM served from the allowed CDNs or
  bundled alongside works. Libraries that inline WASM as base64 (Rapier
  `-compat`, Jolt `wasm-compat`) need no extra fetch at all.
- **Workers and worklets from `blob:` URLs** (Spark's sorter, realtime-bpm-analyzer's
  worklet, web-audio-beat-detector's worker) depend on the CSP allowing `blob:`
  for workers. Unverified; a one-file probe artifact should settle it before
  anyone builds on these.
- **No cross-origin isolation**, so no `SharedArrayBuffer`: threaded builds
  (Jolt multithread, ONNX Runtime threads) fall back to one thread, and
  GaussianSplats3D needs `sharedMemoryForWorkers: false`.
- **Files published alongside are capped at about 15 MB each** (binary; 16 MB
  text) and 256 MB per version. This rules out bundling many ML models and raw
  splat PLYs as-is (numbers in the tables).
- **Camera.** The microphone is already refused inside the Artifact frame;
  expect the camera to be refused the same way. Live-camera scenes work only when
  served locally; a dropped-in *video file* works everywhere.
- **Compositing.** three.js, Babylon, Spark and friends render into their own
  WebGL/WebGPU context. A scene using them draws its own canvas and core
  composites it (a stacked canvas, or `drawImage` onto the p5 canvas per frame).
  That is a small core change, needed once for the whole category.

Licence column: MIT/Apache/BSD/ISC/Zlib/Unlicense/CC0/BSL-1.0 are fine. Flags
are in bold.

## 1. Rendering

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| **three.js** 0.186.1 | Real lighting we do not have: PBR materials, shadow maps, image-based light from HDRIs, glTF with skinning/morph animation, GTAO, SSR, depth of field, instancing at scale. The route to the daylight / matte / real-shadow look TASTE.md now asks for. | MIT | ESM only (`build/three.module.js` + `three.core.js`); `+esm` import. Addons via `examples/jsm/...js/+esm`. | ~2.1 MB core (unminified) | Very active (2026-09-24) | WebGL2 by default. Heed the version-skew trap above. |
| three.js **WebGPURenderer + TSL** | Compute shaders: millions of particles with real neighbour interaction, MLS-MPM fluid/sand/snow (official example `webgpu_compute_particles_fluid`), GPU sorting, storage buffers. Things our texture-ping-pong GPGPU cannot do (scatter writes, atomics). | MIT | `build/three.webgpu.js` + `three.tsl.js` via `+esm` | ~2.3 MB | Very active | **WebGPU** (fine in Chrome on the M4 Pro; falls back to WebGL2 for non-compute). TSL post nodes (bloom, GTAO, DoF, godrays, motion blur, denoise) included. |
| postprocessing 6.39.5 | Mature effect chain (SMAA, SSAO/N8AO-style AO, DoF, tone mapping, LUTs) for WebGLRenderer | **Zlib** (permissive) | ESM, `+esm` (imports three 0.186.0) | ~0.5 MB | Active (2026-09-09) | Mostly convenience next to three's own passes; worth it only for its AO/DoF quality. |
| three-gpu-pathtracer 0.0.26 | Physically based path tracing: caustics-free but true GI, soft shadows, glass, area lights, depth of field | MIT | ESM, `+esm` (pulls three-mesh-bvh) | ~230 KB | Active (2026-09) | **Progressive, not real time.** At 3024×1890 it needs dozens of frames to converge; any camera move resets it. Viable only for a near-static tableau rendered at ¼ resolution and upscaled. |
| Babylon.js 9.28 | Same class as three (PBR, physics plugins, node materials, WebGPU) | Apache-2.0 | UMD `babylonjs/babylon.js` from jsDelivr; or ESM `@babylonjs/core` | ~7 MB UMD | Very active | Pick one engine. Babylon's all-in-one size and its own scene graph buy nothing over three for us. |
| OGL 1.0.11 | Thin WebGL wrapper | Unlicense | ESM `+esm` | ~0.4 MB | Slow (last 2025-01) | Convenience only; we already do raw WebGL2. Avoid. |
| **Spark** (`@sparkjsdev/spark`) 2.2.0 | Gaussian splats: photoreal captured places and objects, and its "dyno" graph for procedurally editing splats per frame (dissolve, displace, recolour, morph between captures) | MIT | ESM, `+esm` (imports three 0.186.0). Sorter runs in a **worker created from a `blob:` URL** with WASM inlined | ~2.7 MB | Very active (2026-09-11; World Labs) | WebGL2. Reads PLY, SPLAT, KSPLAT, SPZ (and SOG). The `blob:` worker is the one CSP question to probe. |
| @mkkellogg/gaussian-splats-3d 0.4.7 | Older splat viewer | MIT | ESM/UMD from jsDelivr | ~0.6 MB | **Abandoned** (last 2025-01; README points to Spark) | Default shared-memory sorter needs cross-origin isolation. Use Spark. |

**Openly licensed splat captures.** None are on an allowed CDN, so they must be
bundled, and must fit under ~15 MB: use SPZ (about 10× smaller than PLY, MIT
format by Niantic). Sources: capture our own with Scaniverse or Polycam on an
iPhone (we own them; Scaniverse exports SPZ); the CC0 sample splats published by
3D Scan Studio iris (note.com/steam_studio); the free section of SplatMart
(licence per item). Research datasets (Mip-NeRF 360 etc.) have unclear
redistribution terms; skip them.

## 2. Physics

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| **Rapier** (`@dimforge/rapier3d-compat`, `rapier2d-compat`) 0.21.0 | Robust rigid bodies with stacking, joints, CCD, character controllers; thousands of bodies at 60 fps. Things that fall, pile, topple and shatter believably. | Apache-2.0 | ESM `dist/rapier.mjs` via jsDelivr; WASM **inlined as base64**, no extra fetch | 4.3 MB (3D) | Very active (2026-09-25) | Deterministic. three.js ships a `RapierPhysics` addon. Best pick for rigid bodies. |
| **Jolt Physics** (`jolt-physics`) 1.1.0 | Rigid bodies plus **soft bodies and cloth** (official cloth and soft-sphere demos), ragdolls, vehicles | MIT | ESM; `dist/jolt-physics.wasm-compat.js` inlines WASM (3.2 MB) | 3.2 MB | Active (2026-07-11) | Use the single-thread build: the multithread one needs `SharedArrayBuffer`. three.js has a `JoltPhysics` addon. The only credible browser cloth/soft-body solver. |
| cannon-es 0.20.0 | Rigid bodies, pure JS | MIT | ESM `+esm` | 0.8 MB | **Stale** (2022-08) | Slower and less stable than Rapier. Avoid. |
| planck.js 1.5.0 | Box2D in JS: 2D rigid bodies, joints, ropes | MIT | UMD `dist/planck.min.js` | ~0.3 MB min | Active (2026-04) | Good if a 2D flat-colour, paper-cutout physics scene is wanted; Rapier2D does the same faster. |
| matter.js 0.20.0 | 2D rigid bodies | MIT | UMD `build/matter.min.js` | ~0.1 MB min | Slow (2024-06) | Easier API, weaker solver. Prefer planck or Rapier2D. |
| PavelDoGreat WebGL-Fluid-Simulation (npm `webgl-fluid` 0.4.0 wrapper) | Stable-fluids dye advection with vorticity and bloom | MIT | UMD/ESM from jsDelivr | ~0.2 MB | Wrapper updated 2026-05 | A classic we could hand-code in one scene (we already ping-pong); useful as a reference, not a dependency. Its default look is the glow/rainbow look TASTE.md retired. |
| MLS-MPM on WebGPU (three.js `webgpu_compute_particles_fluid` example; holtsetio/flow) | Viscous fluid, sand, snow, jelly with 100k+ particles | MIT (three) | Copy the example's TSL into a scene; runs on three's WebGPURenderer | small | Active | **WebGPU**. This is where browser fluids that look like real paint or honey come from; SPH tops out near 100k particles. |

## 3. Geometry

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| **manifold-3d** 3.5.4 | Guaranteed-manifold mesh booleans (union/subtract/intersect), extrude, revolve, warp, hull, smoothing; fast enough to re-carve a few-thousand-triangle model per beat | Apache-2.0 | ES module `manifold.js` + `manifold.wasm` (541 KB) from jsDelivr | ~0.6 MB | Very active (2026-09-25) | Single-threaded; fine. The strongest CSG option. |
| three-bvh-csg 0.0.18 | Mesh booleans on three geometries, keeps UVs/groups | MIT | ESM `+esm` (but pins three 0.182 and three-mesh-bvh 0.9.8) | ~0.2 MB | Active-ish (2026-02) | Slower than manifold on complex inputs and triggers the version-skew trap. Prefer manifold. |
| **three-mesh-bvh** 0.9.15 | Fast raycasts, closest-point and SDF generation from any mesh, shapecasts. Lets particles crawl over, collide with or flow around a real model | MIT | ESM `+esm` | ~0.3 MB | Very active | Also the engine under the path tracer and the CSG lib. |
| d3-delaunay 6.0.4 / delaunator 5.1.0 | Robust Delaunay/Voronoi at 60 fps for 10k+ points (cracked glaze, cells, stained glass, Lloyd relaxation) | ISC | UMD `dist/d3-delaunay.min.js` | ~0.02 MB | Stable / delaunator 2026-03 | Robust Delaunay is genuinely hard to hand-code; tiny. |
| **clipper2-js** 1.2.4 | Polygon offsetting (inset/outset with round/miter joins) and polygon booleans with holes. Contour lines around letters, topographic stacks, riso-style trapping | BSL-1.0 | ESM `fesm2015/clipper2-js.mjs` via jsDelivr | ~0.2 MB | Stable (2024-01) | Offsetting is the specialist bit; nothing else does it robustly. |
| **opentype.js** 2.0.0 | Glyph outlines as Bézier paths from TTF/OTF/WOFF: extrude letters to 3D, morph glyph to glyph, run particles along strokes, feed clipper2 | MIT | UMD `dist/opentype.min.js` | ~0.2 MB min | Active (2026-05) | We have Canvas text and SDF text, but not the outline geometry. |
| fontkit 2.0.4 | Everything opentype.js does plus **variable-font axes** (outlines at any weight/width), OpenType shaping, colour fonts | MIT | ESM `+esm` (browser module) | ~1 MB bundled | Slow (2024-08) | The way to get outlines of a variable font breathing on the bass; Canvas 2D cannot set arbitrary axes per draw. |
| paper.js 0.12.18 | Vector boolean ops on curves (not polygons), path smoothing/simplify, hit testing | MIT | UMD `dist/paper-core.min.js` | ~0.2 MB min | Slow (2024-07) | Overlaps clipper2 for us; clipper2 is faster, paper keeps true curves. Take one. |
| meshoptimizer 1.3.0 | Mesh simplification, decoding of compressed glTF (`EXT_meshopt_compression`) | MIT | ESM + inlined WASM | ~0.3 MB | Very active | Needed only if we ship compressed glTF. |
| Marching cubes (three `MarchingCubes` addon; `isosurface` 2014) | Metaballs/isosurfaces as real meshes (shadowed, lit) | MIT | addon via `+esm` | 40 KB | three: active | We can already raymarch SDFs; the mesh version matters only when it must cast shadows in a three scene. |
| Procedural modelling (`lindenmayer` 1.5.4, `@thi.ng/geom` 8.3) | L-systems; a large computational-geometry toolkit | MIT / Apache-2.0 | ESM `+esm` | small | lindenmayer stale (2020); thi.ng active | L-systems are a page of code; thi.ng is broad but mostly things we can write. Low value. |

## 4. Shader libraries

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| LYGIA 1.4.1 | Hundreds of GLSL/WGSL functions: noise families, PBR, SDFs, colour spaces, blend modes, dithering, filters | **Prosperity License (noncommercial) + Patron License** | Raw `.glsl` files fetched from jsDelivr (`lygia@1.4.1/generative/snoise.glsl` etc.) and `#include`-resolved by `lygia.main.js` | 4 MB package, per-file KB | Active (2026-02) | Not open source: noncommercial use only (30-day commercial trial). Fine for the parties, **incompatible with publishing viz as an open-source VJ kit**. It is also convenience (we write our own noise). Copy an idea, not the file. |
| glsl-noise / webgl-noise (Ashima/McEwan) | Simplex/Perlin/cellular noise | MIT | Paste into shaders | tiny | Stale (2013/2017), but finished | We already have noise. Only relevant if a scene lacks one. |

## 5. Animation and asset runtimes

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| lottie-web 5.13.0 | Plays After Effects exports (Bodymovin JSON) as SVG/Canvas vector animation; frame-scrubbable, so playback speed can follow tempo | MIT | UMD `build/player/lottie.min.js` | ~0.3 MB min | Slow (2025-05) | Content: LottieFiles free animations under the Lottie Simple License (check per file); bundle the JSON. Canvas renderer can draw straight into a 2D canvas. |
| dotlottie-web 0.80.0 | Same content, Rust/ThorVG renderer (Canvas, WebGL or WebGPU), state machines, theming | MIT | ESM `+esm`; WASM fetched from jsDelivr (default URL already jsDelivr, unpkg fallback) | 165 KB JS + 1.2 MB WASM | Very active (2026-08) | Faster than lottie-web at large sizes. |
| Rive (`@rive-app/webgl2`, `@rive-app/canvas`) 2.43.1 | State-machine vector animation with bones and meshes; inputs driven by our signals (kick → trigger, bass → number) | MIT (runtime) | UMD `rive.js`; WASM from unpkg by default (allowed) | 0.46 MB JS + 2.2 MB WASM | Very active (2026-09-23) | `.riv` files need the Rive editor (free tier) or community files with their own licences. |
| glTF animated characters (three `GLTFLoader` + `AnimationMixer`) | Figurative dancers, creatures, crowds, with blendable clips whose speed can lock to tempo | MIT | addon via `+esm` | small | Active | Asset sources below. Quaternius (CC0) has rigged animated characters and an animation library; Kenney (CC0) mini characters. |
| Mixamo | Auto-rig and a big mocap library | **Adobe terms**: free incl. commercial, but raw character/animation files may not be redistributed | n/a | n/a | n/a | A `.glb` published beside a public page is a downloadable raw file. Avoid, or only bake into something that is not the raw asset. Quaternius's CC0 animations cover most needs. |

## 6. ML in the browser

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| **MediaPipe tasks-vision** 1.0.1 | Pose (33 landmarks), selfie/person segmentation, hands, face mesh (478 points + blendshapes), all real time on GPU | Apache-2.0 | ESM `vision_bundle.mjs` via `+esm`; `FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm')` | 11.7 MB WASM | Active (2026-07-31) | Models live on `storage.googleapis.com` (blocked): bundle them and point `modelAssetPath` at a relative URL. Sizes: selfie_segmenter 0.25 MB, face_landmarker 3.8 MB, pose_lite 5.8 MB, pose_full 9.4 MB, hand 7.8 MB (all fit); pose_heavy 30.7 MB and selfie_multiclass 16.4 MB **exceed the 15 MB file cap**. Input: camera only when served locally; a video file anywhere. |
| @mediapipe/tasks-audio 1.0.1 | YAMNet audio classifier (521 classes: singing, speech, cheering, instruments) | Apache-2.0 | Same pattern | ~20 MB package | Active | A "vocals are in" or "crowd cheering" signal no band analysis gives. Model ~4 MB, bundle it. |
| transformers.js (`@huggingface/transformers`) 4.3.0 | Depth estimation (Depth Anything V2), segmentation, background removal, CLIP, on WebGPU | Apache-2.0 | UMD/ESM `dist/transformers.min.js`; ONNX Runtime WASM fetched from jsDelivr by default (allowed) | 0.58 MB JS + ORT | Very active (2026-09-16) | Models default to `huggingface.co` (**blocked**): set `env.allowRemoteModels = false` and `env.localModelPath` to bundled files. Depth Anything V2 small is ~18 MB even at q4f16, **over the 15 MB cap**, so it would need ONNX external-data splitting. Real-time depth at full-screen quality is not realistic; **bake depth offline** (run transformers.js in node in `harness/`) and ship a PNG depth map instead. |
| onnxruntime-web 1.30.0 | Run any ONNX model (WebGPU or WASM backends) | MIT | UMD `dist/ort.min.js` / `ort.webgpu.min.js`; WASM (14–28 MB) from jsDelivr | 0.37 MB JS | Very active (2026-09-14) | Single-threaded without cross-origin isolation. The WASM binaries stay on jsDelivr, so the file cap doesn't apply to them. |
| Style transfer (`@magenta/image` 0.2.1, ml5) | Arbitrary style transfer | Apache-2.0 / MIT | UMD | 2 MB+ | **Stale** (2018) / ml5 active but models on remote hosts | Too slow for 60 fps full screen; models not on allowed hosts. Avoid. |
| TensorFlow.js 4.22 + pose-detection | Older route to MoveNet/BlazePose | Apache-2.0 | UMD | 1.4 MB+ | Slow (2024-10 / 2023-08) | Superseded by MediaPipe tasks. Avoid. |

## 7. Audio analysis

Our input spec (`docs/superpowers/specs/2026-09-28-input-design.md`) plans an
AudioWorklet with spectral-flux onsets, autocorrelation tempo and a
phase-locked beat clock, written by us. Measured against that:

| Library | What it unlocks for us | License | Loads under our CSP? how | Size | Maintained | Notes |
|---|---|---|---|---|---|---|
| Essentia.js 0.1.3 | The Essentia C++ MIR toolkit in WASM: RhythmExtractor2013, BeatTrackerMultiFeature, onset detection, key and chord estimation, loudness; TensorFlow models (TempoCNN, mood, genre) | **AGPL-3.0** | UMD/ES `dist/essentia.js-core.*` + `essentia-wasm.web.wasm` (2 MB) from jsDelivr | ~2.3 MB | **Stale** (2021-06) | Best-in-class algorithms, but AGPL would bind any open-source release of viz, and it has not shipped in four years. Use its papers as reference; do not ship it. |
| aubiojs 0.2.1 | aubio (tempo, onset, pitch) in WASM | **GPL-3.0** (aubio's licence; the npm package declares none) | `build/aubio.js` + `.wasm` from jsDelivr | ~0.2 MB + WASM | **Stale** (2022-11) | Same licence problem; basic algorithms we plan to write anyway. Avoid. |
| Meyda 5.6.3 | Feature extractors: chroma, MFCC, spectral flux/centroid/flatness, loudness | MIT | UMD `dist/web/meyda.min.js` | ~0.05 MB | Slow (2024-04) | Uses `ScriptProcessorNode`; all features are a few lines on our own FFT. Only chroma (key-aware colour) is mildly interesting. Convenience. |
| web-audio-beat-detector 8.2.39 | `guess(audioBuffer)` → BPM **and offset of the first beat** for a whole decoded file | MIT | ESM `+esm`; runs in a worker from an inline/`blob:` source | ~17 KB | Active (2026-08) | Offline only, fine for Audio-file mode as a seed for our beat clock. Check the `blob:` worker under CSP. |
| realtime-bpm-analyzer 5.0.15 | Live BPM from peak intervals, in an AudioWorklet | Apache-2.0 | ESM; worklet added from a **`blob:` URL** | ~35 KB | Active (2026-06) | BPM only, no phase or downbeat; less than our spec already asks of our own worklet. Avoid. |
| **Beat This!** (CPJKU, ISMIR 2024) via onnxruntime-web | State-of-the-art **beats and downbeats** for a whole track, genre-robust, no DBN post-processing | MIT (code and weights) | Not on npm: export the `small0` checkpoint (~8 MB) to ONNX once, bundle it, run with onnxruntime-web; log-mel frontend in JS | ~8 MB model | Active research code | Offline (non-causal), so for Audio-file mode: a bar-accurate map of the track (bar 1, phrase starts, where the drop lands) before playback. A community ONNX of `final0` exists (82 MB, over the cap). |

## 8. Asset sources (openly licensed)

None of these hosts are allowed, so every asset is bundled beside the page
(under ~15 MB per file) unless noted.

| Source | What | License | On an allowed CDN? | Notes |
|---|---|---|---|---|
| **@pmndrs/assets** 1.7.0 (npm) | 12+ Poly Haven HDRIs (EXR, ~130–420 KB each), 280 matcaps, 29 normal maps, bunny/suzanne models, Inter fonts, as base64 ES modules | CC0 | **Yes**: `https://cdn.jsdelivr.net/npm/@pmndrs/assets@1.7.0/hdri/dawn.exr.js` (`+esm`) | The one ready-made way to get CC0 image-based light with no bundling. |
| Poly Haven | HDRIs, PBR textures, models | CC0 | No (`dl.polyhaven.org`) | 2k HDR ≈ 5.5 MB; 1k ≈ 1.5 MB. Bundle. |
| ambientCG | PBR materials (paper, clay, fabric, plaster: the matte look) | CC0 | No | Bundle 1k/2k JPG sets. |
| Quaternius | Low-poly rigged and animated characters, animals, nature packs; universal animation library | CC0 | No (site, itch.io, poly.pizza) | glTF, small. |
| Kenney | Toy/blocky models, textures, 2D sprites | CC0 | No | Pairs well with Rapier. |
| NASA | Planet textures, 3D models of spacecraft/asteroids, imagery | Public domain (mostly; check logo/credit rules) | No (`nasa3d.arc.nasa.gov`, GitHub `nasa/NASA-3D-Resources`; `jsdelivr/gh` not allowed) | Bundle. |
| Museum open access: Smithsonian (images + 3D scans), The Met, Rijksmuseum, Art Institute of Chicago, Cleveland | Paintings, prints, textiles, 3D scans of objects | CC0 for the open-access sets | No | Perfect raw material for 2.5D parallax, collage and texture; bundle downsized JPGs. |
| Splat captures | See section 1 | varies | No | SPZ to fit the cap. |

## Ranked shortlist: imagery we cannot make now

1. **three.js (WebGL2) with PBR, shadows and HDRI light** (+ @pmndrs/assets CC0 HDRIs).
   The foundation for everything below and the direct route to TASTE.md's
   "daylight, matte materials, real shadows instead of glow".
   *Scene: "Clay Orchestra"* — a sunlit table of matte clay objects under a
   Poly Haven dawn sky; the kick drops a shadow-casting bead onto one of them,
   the bass swells the light's warmth, the snare turns the sun a few degrees so
   every shadow swings at once.
2. **three.js WebGPURenderer + TSL compute, MLS-MPM** (WebGPU).
   Real viscous fluid with 100k+ interacting particles.
   *Scene: "Paint Pour"* — two or three thick inks (a riso palette) poured into
   a tray and folding over each other like acrylic pour art; each kick injects a
   jet of one ink at one spot, bass sets viscosity, the drop tilts the tray.
3. **Spark (Gaussian splats)**.
   Photoreal captured places, editable per frame through dyno.
   *Scene: "Greenhouse"* — a slow dolly through our own Scaniverse capture of a
   greenhouse or forest; hats make individual splats glint, the snare sends a
   ripple through the captured world, and on the drop the far end dissolves into
   drifting pollen made of its own splats.
4. **Rapier**.
   Stacking, toppling, shattering rigid bodies at scale.
   *Scene: "Toy Box"* — Kenney CC0 blocks raining in daylight onto a growing
   tower; the kick drops a handful in one place, the snare knocks a side of the
   tower over, the breakdown lets it settle and the drop brings a wave of new
   colours.
5. **Jolt Physics (soft bodies and cloth)**.
   The only credible browser cloth.
   *Scene: "Banners"* — rows of printed silk banners (textile patterns from
   museum open access) in a courtyard wind; bass is wind strength, a kick is a
   gust that travels down one row, the snare snaps one banner loose.
6. **manifold-3d**.
   Robust booleans fast enough to carve on the beat.
   *Scene: "Carver"* — a slowly turning block of marble; each kick subtracts a
   sphere or a letter from the lyrics text param where a light hits it, chips
   fall away (Rapier), and after 16 bars the carved form is revealed and a new
   block rolls in.
7. **opentype.js / fontkit + clipper2-js**.
   Glyph outlines, variable-font axes and robust offsetting.
   *Scene: "Letterpress Contours"* — the Words param set as outline type,
   offset outward into 30 concentric contour lines in two riso inks; bass
   breathes the variable weight axis, the kick pushes one new contour out from
   one letter, the snare swaps which ink is on top.
8. **MediaPipe tasks-vision (pose + segmentation)**.
   The body as input: from the room camera when served locally, from any
   dropped-in dance video everywhere.
   *Scene: "Paper Dancers"* — the segmented dancer repeated as a trail of flat
   paper cut-outs in three colours, each echo a beat behind; pose landmarks
   (wrists, ankles) trail ribbons whose width follows the bass.
9. **glTF animated characters (three AnimationMixer + Quaternius CC0)**.
   Figurative motion we cannot hand-animate.
   *Scene: "Chorus Line"* — forty low-poly dancers on a lit stage, animation
   speed locked to tempo, the snare switches the whole line to a new move, the
   drop adds a second row and spotlights.
10. **Offline depth (transformers.js Depth Anything, run in node) on CC0 museum
    paintings**.
    No runtime cost and no CSP issue: bake a depth map, ship a PNG.
    *Scene: "Into the Painting"* — a slow parallax dolly into a Met or
    Rijksmuseum landscape split into depth layers; birds or boats in the middle
    ground move on the kick, the far sky shifts colour with the bass.

Honourable mention for the upcoming input pass (not imagery): **Beat This!
`small0` on onnxruntime-web** for an offline beat and downbeat map of
Audio-file tracks, and **web-audio-beat-detector** `guess()` as a quick tempo +
first-beat seed. Neither replaces the live worklet in the input spec.

## Avoid, and why

- **Hydra-likes and Milkdrop (butterchurn 2.6.7, last stable 2019)**: wrap
  feedback and shader tricks we already do, and butterchurn's presets are the
  glow/rainbow house style TASTE.md retired.
- **Thin wrappers**: OGL, regl, gl-matrix, tsParticles, lil-gui, simplex-noise,
  lindenmayer. Conveniences over things we write in a page.
- **LYGIA**: noncommercial licence; blocks an open-source release of viz.
- **Essentia.js (AGPL, stale since 2021) and aubiojs (GPL via aubio)**: licence
  contamination for an open-source kit, and nothing our planned worklet can't do.
- **realtime-bpm-analyzer, Meyda**: less than the input spec already asks of our
  own analysis; Meyda relies on the deprecated ScriptProcessorNode.
- **@mkkellogg/gaussian-splats-3d**: abandoned in favour of Spark; needs shared
  memory by default.
- **cannon-es, ammo.js, matter.js**: stale or weaker than Rapier/planck.
- **Babylon.js alongside three.js**: one engine is enough; Babylon adds size and
  a second scene graph.
- **three-gpu-pathtracer for live scenes**: progressive; it cannot hold 60 fps
  at 3024×1890 with a moving camera.
- **Live ML style transfer, TensorFlow.js, ml5**: too slow at full screen,
  stale, or models only on blocked hosts.
- **Mixamo files in a published page**: redistributing raw character/animation
  files is against Adobe's terms.
- **Anything whose data comes from another host at runtime**: Google
  Photorealistic 3D Tiles, Cesium ion, Hugging Face model hub,
  `storage.googleapis.com` models, Poly Haven's API. All blocked by the CSP.

## Open questions to settle with a probe artifact

1. Does the Artifact CSP allow `blob:` workers and worklets? (Spark, the two
   beat detectors.)
2. Does it allow an inline `<script type="importmap">`? (Would fix the three.js
   version skew without a vendored bundle.)
3. Is `getUserMedia({ video })` refused in the frame like the microphone?
4. WebGPU availability inside the frame (it should be; confirm).

## Correction after the type spike (2026-09-28)

Use **clipper2-ts 2.0.1** (BSL-1.0), not clipper2-js: clipper2-js 1.2.4's
offsetting is broken (miter offsets zig-zag, round joins grow spokes). Use
**fontkit 2.0.4** (MIT), not opentype.js: opentype.js 2.0.0 misplaces
variable-font outlines away from the default width (60 of 900 samples wrong).
Both load as `+esm` bundles from jsDelivr (107 KB and 235 KB).
