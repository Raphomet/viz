# "vj set LEXSAN": a scene-by-scene study (research, 2026-09-28)

Source: YouTube, "vj set LEXSAN" by LEX B (`WBaJ7fbi8vg`), 58:00, uploaded
about ten years ago, sampled at 720p. This studies technique only. None of the
footage is to be copied.

**Method.** The whole set was seeked every 2 s (1,739 frames), and each frame
was reduced to a 48×27 thumbnail kept in page memory. Boundaries came from a
windowed colour-histogram distance: 5 frames before a point against 5 frames
after, 64-bin RGB, with peaks above 0.35 that are local maxima within ±16 s.
Plain frame-to-frame mean absolute difference was useless here, because its
median is ~40/255 and it has no bimodal gap: every loop is fast-moving and the
2 s sampling is coarser than any of them. Segments were then clustered
agglomeratively on their mean histograms (L1/2 < 0.30). The automatic
clustering over-merged by palette. It put the three "white thing on black"
scenes (silhouettes, wireframe mask, goggle character) into one cluster and
the two cream-background scenes into another. So I corrected the clusters by
eye against a full-set timeline mosaic (15 thumbnails per 30 s row). Each
scene then got an 8-frame sheet spread across its span, a 12-frame dense strip
at 0.1–0.125 s spacing, and for the richer ones a single frame at 1024 px.
Every transition got a 10-frame strip at 0.5 s spacing.

## Overview: how the set is built

**Few scenes, played long.** The set contains **17 distinct scenes** (15
content loops plus black at the head and tail) and **no scene returns**. Each
loop is on screen for 1.5–10 minutes (median about 2.5 min), and the longest
are at the end: the psychedelic mirror runs 8 min, the diamond tunnel 7.8 min
and the neon city 10 min. This is a DJ-support set, not a fast-cut show. The VJ
picks a clip and lets it ride, changing things *inside* the clip (colour, echo,
flashes) rather than between clips.

**Transitions.** Most changes are **short crossfades of 0.5–2 s** (11 of 15).
Only four are hard cuts: intro→silhouettes, silhouettes→sprite dancers,
orange kaleido→HUD, and city→black at the end. The longer dissolves (2 s at
23:05, 41:44 and 47:51) are the ones where a figure is laid over a patterned
background, so the ghost of the outgoing figure reads as a deliberate double
exposure. There is no layering of two sources for long stretches. The only
lasting "two sources" look is baked into a clip, like the collage heads or the
old man keyed over bokeh.

**Loop lengths are discoverable.** The histogram peaks repeat periodically
inside the long scenes: **~29.5 s** for the diamond/stripes clip and
**~36.5 s** for the neon city. The VJ let a single rendered loop repeat 16
times without touching it.

**Recurring effects applied across different loops:**

- **Echo / trails.** A grey or dimmer offset copy lags the figure by a few
  frames on the silhouettes, the sprite dancers and the goggle character, and
  as RGB-separated stacked copies in the diamond build. It appears to be a mixer
  effect: a frame-delay blend at ~50%, offset by a few pixels.
- **Mirror / kaleidoscope.** Quad-mirror on the cosmic triangles, 4/8-fold
  kaleido on the orange ink, bilateral mirror on the psy shards, and radial
  symmetry on the iris. Four of the fifteen loops are symmetric, and the
  symmetry is what turns arbitrary motion into "designed" motion.
- **Beat flashes to black and colour swaps.** The wireframe mask is mostly
  black between hits. The HUD target swaps red↔white every few frames. The old
  DJ footage alternates a magenta grade with a neutral one. Collage backgrounds
  hard-cut between four pastel flats every ~4 s.
- **Flat, limited palettes.** Nearly every loop sits in 3–5 flat colours: navy,
  cyan, salmon and white; red, green and blue; orange and black. Gradients
  appear only as linear fills inside shapes.
- **Soft finish.** Most loops carry mild bloom and a dark vignette, some a
  round porthole vignette. There is little grain. The softness partly comes
  from the 2016 upload's compression.

## Segments (automatic cuts, corrected clustering)

| # | Start–end | Scene | In → out |
|---|---|---|---|
| 0 | 0:00–0:05 | black | (fade in) |
| 1 | 0:05–0:20 | Speaker-box city (intro) | → hard cut |
| 2 | 0:20–2:30 | White silhouettes | → hard cut |
| 3 | 2:30–5:14 | Style-swap rotoscope dancer | → 1 s crossfade |
| 4 | 5:14–7:30 | Cosmic pinwheel (quad mirror) | → 0.5–1 s crossfade |
| 5 | 7:30–10:00 | Cut-out portrait collage (colour cuts at 8:38 and 9:08 are inside the clip) | → 1 s crossfade |
| 6 | 10:00–12:00 | Wireframe mask with streaks | → 0.5 s crossfade |
| 7 | 12:00–13:28 | Tiled eyes | → 0.5 s crossfade |
| 8 | 13:28–16:14 | Hexagon tunnel with bubbles | → 0.5 s crossfade |
| 9 | 16:14–17:46 | Orange ink kaleidoscope | → hard cut |
| 10 | 17:46–19:48 | Lens/target HUD | → 1 s crossfade |
| 11 | 19:48–23:08 | Old DJ on bokeh | → 2 s crossfade |
| 12 | 23:08–25:54 | Goggle character in spiral | → 1.5 s crossfade |
| 13 | 25:54–33:45 | Psychedelic mirror shards | → crossfade |
| 14 | 33:45–41:44 | Diamond tunnel / diagonal stripes (29.5 s internal cycle) | → 2 s crossfade |
| 15 | 41:44–47:52 | Orange iris / speaker dome | → 1 s crossfade |
| 16 | 47:52–57:49 | Neon cylinder city (36.5 s loop) | → hard cut |
| 17 | 57:49–58:00 | black | end |

The automatic boundary detector also fired every ~30 s inside #14 and every
~36 s inside #16. Those peaks are the clips' own loop points and internal
sections, not VJ cuts.

## Catalogue

| # | Name | Times | Motion | Effects / finish | Technique | Rebuild route | Difficulty |
|---|---|---|---|---|---|---|---|
| 1 | Speaker-box city | 0:05–0:20 | Slow camera truck across stacked isometric cabinets; cones pulse | None visible; flat navy/cyan, white vertical bars | C4D / AE flat-shaded motion-graphics pack | three.js instanced boxes with canvas-texture faces; orthographic-ish camera | easy |
| 2 | White silhouettes | 0:20–2:30 | Slow dancer sway; clip/scale changes every few seconds (close-up, full body, left/right placement) | Grey offset echo trail; pure white matte on black; occasional blackouts | Keyed/rotoscoped live footage as a luma matte | Needs footage or a pose/segmentation mask; echo is an easy feedback pass | medium (needs source) |
| 3 | Style-swap rotoscope dancer | 2:30–5:14 | One continuous dance; the character's *drawing* changes every 2–3 frames (Batman, Mickey, wrestler, sketch…) | Occasional grey echo; cream paper ground | Frame-by-frame illustrated rotoscope (hand-drawn, many styles) | Offline only for the real thing; approximate with a pose-driven figure whose fill texture swaps per beat | hard |
| 4 | Cosmic pinwheel | 5:14–7:30 | Gradient triangles rotate around the centre in eased steps (aligned ↔ pinwheel); nested glowing frames breathe in scale | Quad mirror; bloom on outlined frames; dark teal vignette; hue sweep purple→cyan across the frame | AE shape layers + glow + mirror | Fragment shader: polar repeat of triangle SDFs with gradient fill, nested box outlines, symmetry fold, bloom | easy |
| 5 | Portrait collage | 7:30–10:00 | Small jittery 2.5D moves: heads split into vertical strips that slide, halves hinge open on grey planes, heads shatter into flying paper chips, a stepped echo of the head drifts sideways | Background hard-cuts between four pastel flats every ~4 s; flat disc behind the head; glowing yellow eyes; script title card | AE cut-out collage of engraved/B&W portraits (a music-video style) | Canvas/WebGL quads with strip-sliced textures of our own imagery; the pastel cut cadence is trivial | medium |
| 6 | Wireframe mask | 10:00–12:00 | Low-poly face wireframe sits high in frame; its surfaces expand into stretched-out triangles and collapse back onto the mask, sweeping left to right then right to left (corrected by Raph; the sampling read it as a wipe); thin light streaks shoot through | Mostly black between hits (beat flashes); streak colour cycles green/orange/red | C4D wireframe + sketch/toon render | three.js `WireframeGeometry` on a low-poly head, second shaded pass revealed by a clip plane; line particles | easy–medium |
| 7 | Tiled eyes | 12:00–13:28 | Eye footage looks around and blinks; tile count changes (about 4×3 up to 6×5) with a slow zoom | Hard grid tiling, no mirroring; warm skin tone | Mixer tile effect over a macro eye clip | Shader `fract(uv*n)` over any video or texture; animate n | easy (tile) / needs source |
| 8 | Hexagon tunnel | 13:28–16:14 | Concentric hex rings stream outward from the centre at a steady rate; ring colours cycle; navy dots drift in the foreground; small X glyphs and barcodes flicker | Flat colour, no blur; slight bloom on white | AE/C4D flat motion graphics (same pack family as #1) | Fragment shader: hex distance, `fract(log(d) - t)` ring index into a 5-colour palette, plus sprite dots | easy |
| 9 | Orange ink kaleido | 16:14–17:46 | Slow organic flow of glowing orange ink or fire | 4- to 8-fold kaleidoscope with side repeats; strong glow; black vignette | Macro fluid/fire footage through a kaleidoscope | Kaleido fold over domain-warped fbm with an amber ramp, plus bloom | easy |
| 10 | Lens / target HUD | 17:46–19:48 | Concentric lens rings pulse in scale on the beat; crosshair (+ or X) overlays pop on and off; red↔white/lavender colour swaps every few frames | Radial zoom blur; bloom on crosshair lines; monochrome tint | Macro camera-lens footage + AE crosshair overlays + tint | Shader rings (or our lens texture) with beat-driven scale, SDF crosshairs, tint LUT swap on hits | easy |
| 11 | Old DJ on bokeh | 19:48–23:08 | Short dance loop (seconds) of an elderly man in headphones | Grade alternates magenta-tinted ↔ neutral; soft pastel bokeh background | Green-screen stock footage keyed over bokeh | Bokeh is an easy shader; the figure needs footage | needs source |
| 12 | Goggle character | 23:08–25:54 | Headphone-eared white character bobs; yellow pupils pulse; purple/green spiral rotates behind | Horizontal scanline tearing on the spiral; echo halo round the figure; eye glow | 2D cartoon (AE/Flash) over a displaced spiral | Spiral shader + row-wise noise displacement; character as SVG or sprite with echo | medium |
| 13 | Psychedelic mirror shards | 25:54–33:45 | Fly-through: flat-coloured extruded planes and shards stream past the camera and burst outward; thin black wire lines | Left–right mirror; translucent overlaps that mix colour; starfield with chromatic-aberration streaks; round porthole vignette | C4D fly-through + mirror + CA | three.js random extruded quads toward the camera, additive/transparent materials, mirror + RGB-split + vignette post | medium |
| 14 | Diamond tunnel / stripes | 33:45–41:44 | 29.5 s cycle: diamond tunnel of RGB bands breathes and zooms (~18 s); a dark polygon wipe; diagonal red/green bevelled bars scroll slowly (~10 s); the diamond rebuilds from a point as stacked red/green/blue chevron copies sweeping out over ~1.4 s (eased) | RGB-offset layered copies; soft bevel shading on the bars; no grain | AE shape layers with echo + RGB split | Shader: L1-norm rings (`abs(x)+abs(y)`) with a 3-channel offset; stripes are `fract(x+y)` with a bevel ramp; the build is an eased mask radius | easy |
| 15 | Orange iris / speaker dome | 41:44–47:52 | Mesh-grille dome at centre; radial white fins pulse in length; scalloped black petals round a salmon field; periodic zooms into a white dotted cross pattern | Radial symmetry/kaleido; mild glow; flat salmon/black/white | C4D (dome + cloner fins) or AE polar-coordinates effect | Polar shader: fin length from noise(angle)+beat, petals as a polar sin; dome as a lit sphere with a hex normal map | medium |
| 16 | Neon cylinder city | 47:52–57:49 | 36.5 s loop: camera glides low looking up at cylindrical towers, then banks 30–45° and sweeps close past them; smooth, eased spline | Cyan/magenta emissive ring bands, lit windows, purple atmospheric haze, strong bloom, depth fog | C4D render (synthwave city) | three.js instanced cylinders with emissive ring textures, box towers with window textures, exponential fog, UnrealBloom, CatmullRom camera path with roll | medium |
| 0/17 | Black | 0:00–0:05, 57:49–58:00 | n/a | n/a | n/a | n/a | n/a |

## Fuller notes on the most instructive scenes

### #14 Diamond tunnel / stripes: one clip, three sections, and a build-in

This is the most instructive loop for us, because it shows how a single short
clip carries eight minutes. It has **internal structure**: a tunnel section, a
contrasting stripe section, and a wipe between them. So even a single repeated
loop has a verse/chorus shape.

- **Diamond tunnel:** concentric diamonds in blue, green, red and purple bands.
  The bands are not solid. Each is three offset copies (R, G, B) of the same
  outline, which gives a vibrating edge. The whole tunnel breathes (scale
  ±5–10%) and bands roll inward.
- **Build-in:** from black, a thin chevron appears at one point, and stacked
  copies of it (red, green, blue, each a few px apart) sweep outward and fill the
  frame in about 1.4 s with an ease-out. It reads as a wipe that is also a
  drawing.
- **Wipe-out:** dark navy polygons slide in as hard-edged shapes and cover the
  tunnel.
- **Stripes:** 45° bars in red and green with a soft bevel ramp (lighter on one
  edge), scrolling very slowly. It is a rest from the tunnel.

Rebuild: one fragment shader with a `section` uniform. Rings use
`fract(k*(abs(p.x)+abs(p.y)) - t)` sampled three times with small offsets per
channel. The build uses a mask `smoothstep(r(t), r(t)-w, L1(p))`, with `r(t)`
eased. Stripes use `fract((p.x+p.y)*n + t*0.05)` through a bevel ramp.

### #16 Neon city: long loop, camera does the work

The rendered content is just cylinders with bright ring bands and boxes with
windows. It looks rich because of (1) haze and fog that give depth layering,
(2) bloom that turns thin emissive bands into light, and (3) **a camera that
banks**. The roll into a 30–45° dutch angle while skimming a tower is what makes
it feel like flight. The move is eased, not linear. The loop is ~36.5 s and it
ran 16 times in a row without anyone minding, because the camera path has two
contrasting halves (a look-up glide and a banking dive).

### #13 Psychedelic mirror shards: mirror as a generator

The raw clip is a fly-through of flat extruded shards. A left–right mirror down
the centre line turns it into insect or mask figures (the eye reads faces and
bodies into bilateral symmetry). The finish adds (a) semi-transparent overlaps,
so pink over cyan makes lilac, (b) a starfield whose points are RGB-split into
short streaks, and (c) a circular porthole vignette that darkens the corners
into a round frame. This was the longest content scene in the set (8 min),
which says the mirror kept it fresh.

### #3 Style-swap rotoscope: continuity of motion, discontinuity of surface

A single dance performance is kept, but every 2–3 frames the dancer is redrawn
as a different character in a different drawing style. The eye tracks the
continuous motion while the surface flickers. That is a strong idea to borrow
generatively: keep one motion signal (a figure, a path, a shape) and swap the
*renderer* (fill, stroke style, palette, texture) on every beat or every few
frames.

### #5 Portrait collage: small motion, big cuts

Almost nothing moves much. Heads bob a few px, strips slide, a head hinges
open. The energy comes from the **background colour hard-cutting every ~4 s**
between four pastels, plus occasional shatter events. Flat pastel grounds, B&W
halftone cut-outs and a single accent colour (yellow eyes) make a very clean
graphic language, quite unlike the rest of the set.

### #6 and #10: beat-gated visibility

Both use the frame as a strobe. The wireframe mask spends much of its time on
black and appears in hits. The HUD target swaps colour and pops crosshairs on
and off every few frames. Neither animates much inside the hit. The rhythm is
**presence/absence and palette swap**, which reads as music-locked from across
a room.

## Top 10 techniques to take into viz (ranked)

1. **Symmetry folds as a post pass (mirror, quad mirror, N-fold kaleido)**
   that any scene can switch on. Four of fifteen loops here depend on it, and it
   turns arbitrary motion into figures.
2. **Echo trails, i.e. a frame-delay blend with offset**, including an
   RGB-split variant where the R, G and B copies lag by different amounts. It
   was used on figures and geometry alike, and it is one feedback buffer.
3. **Beat-gated visibility and palette swaps.** Flash to black between hits,
   and swap to an alternate palette or LUT on hits. This is the most legible
   music reaction in the set.
4. **Scenes with internal sections** (tunnel → wipe → stripes → build-in, as in
   #14), so one scene can run for minutes with a verse/chorus shape instead of
   one steady state.
5. **Shape-build reveals and hard polygon wipes** as scene-internal
   transitions: stacked copies sweeping out from a point with an ease-out, and
   dark geometric panels sliding in.
6. **A banking camera on a spline** for 3D scenes: eased roll into a dutch
   angle while skimming geometry, with two contrasting halves per loop, plus
   fog and bloom (#16).
7. **Flat 3–5 colour palettes with a ring or band index driving colour**
   (hex and diamond tunnels): `palette[floor(fract(log(d)-t)*n)]` instead of
   smooth hue ramps.
8. **Motion continuity with surface swaps.** Keep one motion and change the
   renderer, fill or style every few frames (#3).
9. **A tiling pass with animated tile count** (`fract(uv*n)`, n eased between
   integers) over any scene or texture (#7).
10. **Short crossfades (0.5–2 s) as the default scene change, with long
    dissolves reserved for figure-over-pattern moments**, where the double
    exposure is itself the effect. Hold scenes for minutes rather than seconds.
