# Scenes under review

Every visual in the viz app, in menu order. Each row: name, id, source file, the best 24 s contact sheet (tiles at 2–24 s of the test track: intro 0–4, build 4–10, drop 10–18, breakdown 18–24), and a 96 s longevity sheet where one exists. Paths are relative to ~/Code/viz.

## Text (`text`)
- File: web/viz/text.js
- Sheet: harness/renders/orig/text/sheet.png
- 96 s: —

## Arcs (`arcs`)
- File: web/viz/arcs.js
- Sheet: harness/renders/orig/arcs-offset/sheet.png (frames at x.5 s: Arcs sweeps each arc over exactly 1 s, so frames on whole seconds catch every arc at zero length and look black — that is a sampling coincidence, not the scene)
- 96 s: —

## Rings (`rings`)
- File: web/viz/rings.js
- Sheet: harness/renders/orig/rings/sheet.png
- 96 s: —

## Jags (`jags`)
- File: web/viz/jags.js
- Sheet: harness/renders/orig/jags/sheet.png
- 96 s: —

## Parametric Lines (`parametric`)
- File: web/viz/parametric.js
- Sheet: harness/renders/orig/parametric/sheet.png
- 96 s: —

## Twinkle Toph (`toph`)
- File: web/viz/toph.js
- Sheet: harness/renders/orig/toph/sheet.png
- 96 s: —

## Planets (`planets`)
- File: web/viz/planets.js
- Sheet: harness/renders/orig/planets/sheet.png
- 96 s: —

## Flyover (`flyover`)
- File: web/viz/flyover.js
- Sheet: harness/renders/orig/flyover/sheet.png
- 96 s: —

## Dot Matrix (`dotmatrix`)
- File: web/viz/dotmatrix.js
- Sheet: harness/renders/orig/dotmatrix/sheet.png
- 96 s: —

## Current (`current`)
- File: web/scenes/current.js
- Sheet: harness/renders/final/current/sheet.png
- 96 s: harness/renders/current-96s/sheet.png
- Technique: Particles advected through curl-plus-gradient Perlin noise, deposited as ink-per-distance into a Float32 accumulation buffer, tone-mapped through a single-hue LUT
- Brief: Silk streamlines that braid into slow wandering whirlpools. The bass thickens the turbulence and tightens the drains; the hats quicken the flow; in the drop the field itself evolves faster, while the breakdown lets the strands lengthen and settle.

## Coral (`coral`)
- File: web/scenes/coral.js
- Sheet: harness/renders/final2/coral/sheet.png
- 96 s: harness/renders/final2/coral-96/sheet.png
- Technique: WebGL2 Gray-Scott reaction–diffusion on float ping-pong textures, with a spatially varying feed/kill map, a curl current, and a B-spline-upscaled lit display pass
- Brief: A living reef seen from above: coral, labyrinth and dividing spots grow side by side, their borders migrating on a slow current. The kick drops seed blots that bloom pale and age into colour; the drop pushes the whole reef toward splitting and churning, the breakdown lets it knit back into mazes.

## Attractor (`attractor`)
- File: web/scenes/attractor.js
- Sheet: harness/renders/final2/attractor/sheet.png
- 96 s: harness/renders/final2/attractor-96/sheet.png
- Technique: Clifford / de Jong maps, ~195k points a frame splatted bilinearly into a decaying Float32 exposure (0.75x resolution) plus half-resolution slow/fast light-age buffers, log tone-mapped through a 2D colour LUT into ImageData, with a 1/8-resolution blurred halo; crossfades between vetted forms, guarded by a running Lyapunov estimate
- Brief: A strange attractor as a long-exposure photograph: filaments that glow where the orbit lingers. Coefficients wander so the form morphs without ever jumping; the bass sweeps it continuously (the drop is the most mobile section), mids and hats lean on it and heat the light. Colour comes from the age of the light, so motion paints white leading edges and cool afterglow.

## Magnetosphere (`magnetosphere`)
- File: web/scenes/magnetosphere.js
- Sheet: harness/renders/final2/magnetosphere/sheet.png
- 96 s: harness/renders/final2/magnetosphere-96/sheet.png
- Technique: CPU Lorentz-force particle sim (gravity + perpendicular magnetic force + speed thermostat), drawn as additive line segments into a fading half-float WebGL2 buffer with quarter-res bloom and an exponential tonemap
- Brief: Two species of charged light, cool and warm, orbiting a few wandering poles whose magnetic polarity alternates. Opposite charges curl opposite ways, so the hues braid into rosettes and figure-eights. Kicks throw the cloud outward and it settles back through its orbits; claps flip every pole, so the swarm stalls and re-curls the other way; loudness sets the cruising speed, so the breakdown drifts.

## Interference (`interference`)
- File: web/scenes/interference.js
- Sheet: harness/renders/final2/interference/sheet.png
- 96 s: harness/renders/final2/interference-96/sheet.png
- Technique: WebGL2 fragment shader: two analytic line sheets (circles around centres that travel from 20,000 units away to on stage, so currents morph into rings), box-filtered per pixel and multiplied like stacked transparencies
- Brief: Black-and-white op-art moiré. Two near-identical sheets of wavy lines drift over each other and the large fringes where they fall in and out of step sweep, bloom and fold; over about a minute and a half the sheets' centres come in from far away, the current bends into great arcs and then rings, and goes back. The kick leaves one sheet as a ripple of phase, a pixel of line movement that the moiré m

## Abyss (`abyss`)
- File: web/scenes/abyss.js
- Sheet: harness/renders/b2/abyss-full/sheet.png
- 96 s: harness/renders/b2/abyss-96/sheet.png
- Technique: Canvas 2D, additive light: verlet-chain tentacles and oral arms, bells as bezier domes with gradient fill and rim strokes, all glow from pre-rendered per-hue radial sprites; parallax marine snow in three depths, god-ray wedges, plankton glints
- Brief: A deep-sea column. God rays fall from far above, marine snow drifts past at three depths, and a swarm of glowing jellies hangs in the dark, each bell a translucent dome with a lit rim and rows of iridescent comb light, trailing oral arms and fine tentacles. We sink slowly and continuously through the column, snow and plankton rising past, the swarm drifting up by us with parallax, the surface ligh

## Aurora (`aurora`)
- File: web/scenes/aurora.js
- Sheet: harness/renders/b2/aurora-full/sheet.png
- 96 s: harness/renders/b2/aurora-96/sheet.png
- Technique: WebGL2 fragment shader fed by a per-column float texture computed in JS (curtain edges, fold brightness from the warp slope, rays, kick pulses, ridge lines); rotating hashed star field; a lake that re-evaluates the sky at the rippled mirror point; music detected as onsets and passed in as travelling pulses, rings and meteors
- Brief: Night over a mountain lake, travelling slowly along the shore: the pine treeline, mid range and far snow ridge slide past at different speeds, the water and its reflections move with them, and the music sets the travel speed (a surge in the drop, a near-glide in the breakdown). Curtains of light fold and drift overhead, and stars wheel slowly. Each kick lights a white-hot spot on one curtain's low

## Skyline (`skyline`)
- File: web/scenes/skyline.js
- Sheet: harness/renders/b2/skyline-full/sheet.png
- 96 s: harness/renders/b2/skyline-96/sheet.png
- Technique: Canvas 2D: three wrapping parallax skyline layers scrolled by a music-driven drift, particle fireworks on a persistence buffer composited additively, quarter-resolution sprite blooms, lit smoke and horizon glow, a procedurally built skyline, and a river rebuilt from those layers at half resolution and drawn back in rippled strips
- Brief: Fireworks over a city across a river. Shells are timed to the kick: each beat breaks every shell in flight with a white-hot core and a bloom of colour, and launches the next, which rises for exactly one beat; only that one place in the sky lights up. The clap fires a salute, a row of white strobe pops rippling across the sky with glints on the water; hats strobe the glitter, flicker the windows an

## Rave (`rave`)
- File: web/scenes/rave.js
- Sheet: harness/renders/b2/rave-full/sheet.png
- 96 s: harness/renders/b2/rave-96/sheet.png
- Technique: WebGL2 fragment shader (warped fBm smoke; analytic laser fans resolved per pixel from the angle to each head; moving-head cones; a liquid-sky plane; hashed glints) under a Canvas 2D crowd of rim-lit silhouettes
- Brief: Inside a club, drifting slowly forward through the crowd toward the stage. Smoke drifts through the room and the lasers only exist where it is thick. Four heads on the stage and a tunnel head fan thin saturated beams over rows of silhouettes that pass under the camera as it moves. The kick is confined: a wave of heads rolls across the crowd from a new place each beat, over a pool of stage light wh

## Oil (`oil`)
- File: web/scenes/oil.js
- Sheet: harness/renders/b2/oil-full/sheet.png
- 96 s: harness/renders/b2/oil-96/sheet.png
- Technique: WebGL2 fragment shader, analytic per pixel: three immiscible groups of metaballs over domain-warped marbled water, dye-drop discs, a hashed grid of thin-film bubbles, a slowly rotating dish, and a local thumb-press; smoothed value noise from one texture read per octave
- Brief: A 1960s liquid light show: coloured oil and water pressed between glass on an overhead projector. Slow blobs of three oils that never mix drift, merge and split over marbled water, their edges ringed with thin-film rainbows, air bubbles glinting in them. The whole dish turns slowly, so colour flows across the frame; the bass sets how fast. Each kick is a thumb pressing the glass at one point, movi

## Mandala (`mandala`)
- File: web/scenes/mandala.js
- Sheet: harness/renders/b2/mandala/sheet.png
- 96 s: harness/renders/b2/mandala-96/sheet.png
- Technique: WebGL2 ping-pong video feedback (half-float, half resolution) with a kaleidoscope-folded procedural source, then a full-resolution display pass with mip-chain bloom, a centre bloom, a snare shockwave and folded hat sparkles
- Brief: A tunnel of mandalas. Ring-petals and a sinuous thread, mirrored into N wedges, are painted into a feedback loop that zooms, spins, twists and melts, so every frame's mandala flies outward and ages from warm to cool. The flight through the tunnel is continuous and speeds up in the drop. Each kick stamps a bright new mandala into the centre that you watch fly outward; each snare fires a thin star-s

## Descent (`descent`)
- File: web/scenes/descent.js
- Sheet: harness/renders/b2/descent-full/sheet.png
- 96 s: harness/renders/b2/descent-96/sheet.png
- Technique: WebGL2 raymarch of an Apollonian (sphere-inversion) fractal with a tunnel carved along a winding path, orbit-trap colour, step-count AO, volumetric glow, rendered at reduced resolution and upscaled; 2D shrink-and-add bloom and projected 3D motes on top
- Brief: A slow flight down a winding tunnel through foam of spheres within spheres, toward a warm light at the far end. Each kick sends a shell of light racing away from you down the tunnel, lighting every wall it passes, while the camera lurches forward and the far light swells. Each clap refolds the fractal for a moment and flares the rainbow sheen on the bubble rims, turning it a step round the wheel. 

## Murmuration (`murmuration`)
- File: web/scenes/murmuration.js
- Sheet: harness/renders/b2/murmuration-full/sheet.png
- 96 s: harness/renders/b2/murmuration-96/sheet.png
- Technique: Canvas 2D: thousands of birds on a 3D ribbon (bent, twisted, undulated, yawed, perspective-projected, deformations lagged along the ribbon so they travel as waves), batched into a few Path2D strokes; soft sky, clouds, sun glow and rays on a third-resolution canvas; full-resolution sun, treeline, glitter, reeds and motes
- Brief: Starlings at dusk over a marsh. A flock of thousands folds and pours across a sunset sky, dark ribbons forming wherever the sheet of birds turns edge-on. A slow travel along the marsh slides reeds, ripples and treeline past in parallax while the flock keeps pace overhead. Each kick sends a ripple of dark density running through the flock and flares the sun's rim; the clap swings the whole flock in

## Bloom (`bloom`)
- File: web/scenes/bloom.js
- Sheet: harness/renders/b2/bloom-full/sheet.png
- 96 s: harness/renders/b2/bloom-96/sheet.png
- Technique: Canvas 2D, additive blending: gradient sky, star field, moon halo, parallax hills and grass, mandala flowers (three counter-rotating rings of petals, each ring one path filled and stroked under "lighter"), glow-sprite fireflies and pollen, optional frame persistence for trails
- Brief: A slow walk through a night garden beside a lake, under a moon that stays put. Mandala flowers on swaying stems at several depths slide past in parallax (near stems and reeds fastest), entering on the right and leaving on the left; fireflies drift; the lake reflects it all. Each kick starts a ripple of flaring on one flower (petals punch out, glow blooms, pollen puffs) that spreads both ways throu

## Iris (`iris`)
- File: web/scenes/iris.js
- Sheet: harness/renders/b2/iris-full/sheet.png
- 96 s: harness/renders/b2/iris-96/sheet.png
- Technique: WebGL2 fragment shader (tileable polar value-noise fibres, starfall or Droste tunnel in the pupil, mandorla lid lines, aura, specular) under a Canvas 2D layer of additive bokeh motes and glint sprites
- Brief: A giant eye of light fills the stage: a mandorla of luminous lid lines over deep night, a pearly sheen, an aura of rays, and an iris of fine flowing fibres with a golden collarette and dark crypts, its whole harmony slowly turning. The pupil is a window into another world: stars rushing out of a tunnel, or (Iris tunnel) a Droste fall into ever smaller irises. The whole eye drifts, rolls and swings

## Night Train (`nighttrain`)
- File: web/scenes/nighttrain.js
- Sheet: harness/renders/b3/nighttrain-720/sheet.png
- 96 s: harness/renders/b3/nighttrain-96/sheet.png
- Technique: JS pixel renderer into a 180-line 32-bit buffer (Bayer-dithered gradients, dithered smoke transparency, four-step additive light), eight parallax layers with whole-pixel scrolling, uploaded as a texture to one WebGL2 CRT pass (curvature, brightness-dependent scanline beam, sharp-bilinear columns, mip-chain bloom, aperture mask, vignette); music detected as onsets against slow baselines
- Brief: A steam train crossing a sleeping country at night, in 16-bit pixel art on a CRT. The camera rides alongside, so the world streams past in parallax: stars, moon and moonlit cloud, a far ridge with village lights, mist, hills with pines, farms and towns, trackside signals and station lamps, the embankment or a truss bridge over a river that mirrors the sky, and telegraph poles whipping by in front 

## Sumi (`sumi`)
- File: web/scenes/sumi.js
- Sheet: harness/renders/b3/sumi-720/sheet.png
- 96 s: harness/renders/b3/sumi-96/sheet.png
- Technique: WebGL2 fragment shader painting ink density (wet/dry-edged mountain washes from a per-column ridge texture, mist that occludes, a perspective river with reflections, suminagashi blooms, SDF boat and pines), mapped between a paper and an ink colour; Canvas 2D brush-stroke geese on top
- Brief: An ink-wash handscroll unrolling past a small boat poling downriver: four ranges of mountains recede in washes of grey and dissolve into mist, a low shore and dark pines slide by with parallax, a red sun sits behind the far peaks. Kick: the prow lantern flares red and rings spread from the hull into the wake. Snare: a drop of ink falls on the river and blooms as suminagashi marbling that the curre

## Stargate (`stargate`)
- File: web/scenes/stargate.js
- Sheet: harness/renders/b3/stargate-720/sheet.png
- 96 s: harness/renders/b3/stargate-96/sheet.png
- Technique: WebGL2 fragment shader ray-casting flat light planes (walls, floor, ceiling) with a slit-scan pattern (fast across the plane, slow along the flight) anti-aliased by pixel footprint; polar log-radius star field and streaming nebula; music detected as onsets in JS and placed in the corridor as panel flares and pattern fronts
- Brief: Constant high-speed flight down the 2001 slit-scan corridor: two walls of smeared light filaments stream past on either side and converge on a glowing gate at the vanishing point, with deep space, outward-racing stars, a streaming nebula and slow shafts of light in the open wedges above and below. The corridor banks and its vanishing point wanders, so it seems to curve. Bass sets the flight speed 

## Scanlines (`scanlines`)
- File: web/scenes/scanlines.js
- Sheet: harness/renders/b3/scanlines-720/sheet.png
- 96 s: harness/renders/b3/scanlines-96/sheet.png
- Technique: Canvas 2D: a Rutt/Etra raster (scan lines displaced by a procedural hidden image) projected in perspective by hand, painter-ordered with translucent occluders, three additive colour channels with separation, phosphor persistence
- Brief: An analogue video synthesiser flown like a landscape. Glowing phosphor scan lines lie over a hidden image (mountains, a raindrop pond, a lattice of bubbles, dunes, whirlpools) and rise over its shapes, and the camera flies over it so the lines stream toward you while the whole raster slowly turns and tilts; a scanned planet turns in the sky. Each kick drops a ripple ring at one spot of the terrain

## Chladni (`chladni`)
- File: web/scenes/chladni.js
- Sheet: harness/renders/b3/chladni-720/sheet.png
- 96 s: harness/renders/b3/chladni-96/sheet.png
- Technique: CPU grain simulation (tens of thousands of grains descending the gradient of f² with amplitude-scaled random kicks, f a sum of real Chladni modes read from a cosine table) splatted as WebGL2 points into a density buffer, blurred into a height field and raked by two coloured lights over a black-glass plate that shows the standing wave as an iridescent sheen
- Brief: Sand on a vibrating black-glass plate, flown over slowly: the figures pass beneath like dunes, every ridge lit amber on one flank and cyan on the other. The band centroid picks the mode number, so the music sets how fine the figure is; each snare changes the mode and the whole plate of sand flows to a new figure; each kick strikes the plate at one spot, where sand leaps and sprays outward glowing 

## Physarum (`physarum`)
- File: web/scenes/physarum.js
- Sheet: harness/renders/b3/physarum-720/sheet.png
- 96 s: harness/renders/b3/physarum-96s/sheet.png
- Technique: WebGL2 agent simulation (Jones 2010): agent state in an RGBA32F texture stepped by a fragment shader, 1-px point deposits into an RGBA16F two-species trail map, 3x3 diffuse/decay, quarter-res bloom, composited with drawImage
- Brief: Bioluminescent slime mould seen from above as we drift across it: living vein networks that grow, reroute and reach for food. The bass bends the sensor angle so the network turns from fine lace to coarse cells; each kick drops a food node in one place that flares, bursts and is reached for; the snare sends a wave of light running outward along the veins; hats glint on the veins and in foreground s

## Expressway (`expressway`)
- File: web/scenes/expressway.js
- Sheet: harness/renders/b3/expressway-1280/sheet.png
- 96 s: harness/renders/b3/expressway-96/sheet.png
- Technique: WebGL2 fragment shader: one analytic night city evaluated per pixel (road bent by x += C·z², so every plane beside it is a quadratic in depth), a wet-road reflection from a mirrored camera with lights stretched into streaks, windscreen rain beads that re-evaluate the world as tiny inverted lenses, and an analytic wiper whose crossing time clears the beads; onsets detected in JS against slow baseli
- Brief: A night drive on an elevated expressway through a neon city: towers with lit windows and neon signs stream past on both sides, tail lights ahead and oncoming headlights on the other deck, sodium lamps, lane dashes and their streaked reflections on the wet road, rain beads on the windscreen. The bass sets the speed. Each kick fires a pulse of light down one row of lights (the barrier LED strip, or 

## Nebula (`nebula`)
- File: web/scenes/nebula.js
- Sheet: harness/renders/b3/nebula-720/sheet.png
- 96 s: harness/renders/b3/nebula-96/sheet.png
- Technique: WebGL2 volumetric raymarch (40 growing steps, emission-absorption, analytic per-step integration) through a baked 64³ tileable gradient-noise texture, rendered at ~0.4x and upscaled; embedded point lights ionise the gas; Canvas 2D on top for star cores with diffraction spikes, a far star field and depth-of-field bokeh motes
- Brief: A slow flight down a corridor carved through an emission nebula, banking through the turns: walls of red hydrogen filaments turning teal where young stars ionise them, crossed by dark dust lanes, with dust motes drifting past the lens as out-of-focus bokeh. Each kick ignites one star in view: its gas floods with white-blue light and its diffraction spikes stretch, then settle, in one place only. E

## Paper (`paper`)
- File: web/scenes/paper.js
- Sheet: harness/renders/b3/paper-720/sheet.png
- 96 s: harness/renders/b3/paper-96/sheet.png
- Technique: Canvas 2D cut-paper theatre: eight Path2D forest flats projected by depth (one nonzero fill each, kirigami holes wound backwards), a shared paper-grain pattern, drop shadows that turn into backlight glow, stop-motion creatures animated on twos, onset detection against slow baselines
- Brief: A cut-paper theatre you walk into: a painted paper sky with pin-prick stars and a paper moon, torn-paper mountains, and eight forest flats (firs with diamond cutouts, lollipop trees with rings of leaf cutouts, meadows, canopy arches hung with vines) that grow as you approach, pass overhead and are recycled to the back, so the forest never ends. Every sheet has grain and a soft drop shadow. A cream

## Terminal (`terminal`)
- File: web/scenes/terminal.js
- Sheet: harness/renders/b3/terminal-720/sheet.png
- 96 s: harness/renders/b3/terminal-96/sheet.png
- Technique: CPU ray-sampled tunnel, heightfield canyon and torus into a character grid; glyphs blitted from a per-colour atlas onto a fading phosphor canvas with downscaled bloom, scanlines and vignette
- Brief: A phosphor terminal flying through a 3D world drawn in text. A twisting tunnel whose cross-section morphs chases an ASCII torus in the vanishing point; in the drop a canyon of contour-lined mountains rises through the characters under stars, the torus becomes the moon and the amber turns to colour. The kick flares the torus and sends one ring of light down the tunnel or across the canyon floor; th

## Poster (`poster`)
- File: web/scenes/poster.js
- Sheet: harness/renders/b4/poster-720/sheet.png
- 96 s: harness/renders/b4/poster-96/sheet.png
- Technique: Canvas 2D on a modular grid: every element stored in grid units and tweened between hand-built compositions; flat fills in two inks, fitted grotesque type with negative tracking, onset detection against the previous frame
- Brief: An International Typographic Style concert poster that keeps re-setting itself. Off-white paper, black and one red: a huge grotesque headline, a red disc ringed by Musica-Viva arcs that turn with the pad, a field of small squares, quarter-circles and half-discs, hairline rules, a halftone panel, and a full-bleed black ticker band of type sliding past. Each kick snaps one token to a new cell along 

## Zen (`zen`)
- File: web/scenes/zen.js
- Sheet: harness/renders/b4/zen-720/sheet.png
- 96 s: harness/renders/b4/zen-96/sheet.png
- Technique: WebGL2 height-field shader (analytic groove gradients, low-sun lighting, capsule stone shadows, fbm maple shade) under Canvas 2D rake and falling maple leaves
- Brief: A karesansui garden from above in afternoon light: raked gravel curving around moss-collared stones, a wooden rake always pulling new grooves row by row, maple shade in one corner. The kick presses one ring into the gravel around one stone, the snare drops a maple leaf, the bass sets the rake's pace, hats glint in the gravel, and the drop sends a re-raking wave across the whole garden while the su

## Pop (`pop`)
- File: web/scenes/pop.js
- Sheet: harness/renders/b4/pop-720/sheet.png
- 96 s: harness/renders/b4/pop-96/sheet.png
- Technique: Canvas 2D comic page: tiers of clipped quadrilateral panels sliding sideways, cached Ben-Day dot patterns that travel with the print, nine hand-built panel drawings, union-stroked balloons, onset detection against slow baselines
- Brief: An endless pop-art comic page sliding past on a slight tilt: newsprint, Ben-Day dots, heavy keylines, flat red, yellow and blue. Panels of speakers that talk, a spinning record, a light bulb with an idea, a city at night, a close-up eye, a dancing crowd under spotlights, a rolling wave, a quiet moon, and pure sound-effect panels, each with its own caption or balloon about sound and light. Each kic

## De Stijl (`destijl`)
- File: web/scenes/destijl.js
- Sheet: harness/renders/b5/destijl-720/sheet.png
- 96 s: harness/renders/b5/destijl-96/sheet.png
- Technique: Canvas 2D: a binary space partition of a square whose split positions, line growth and cell fills are all tweens, drawn inside a clipped panel that rotates; block letters built cell by cell on a grid; a seeded grain tile multiplied over the sheet; onset detection against the previous frame
- Brief: A De Stijl poster alive. On cream stock a painted panel of black bars and white cells, a few printed red and black; beside it a headline in square block letters, a bar of primaries and small geometric-sans captions in Dutch about night, sound and dancing. Each kick prints one cell in a primary, wiped in from an edge, and older colour drains away on the off-beat. Each snare re-divides the grid: a b

## Op Art (`opart`)
- File: web/scenes/opart.js
- Sheet: harness/renders/b5/opart-720/sheet.png
- 96 s: harness/renders/b5/opart-96/sheet.png
- Technique: WebGL2 fragment shader: an analytically box-filtered checkerboard sampled through a sum of smooth sphere warps, a travelling sine shear and a rotation; the headline is Canvas 2D text uploaded as a mask texture that turns the checks to stripes and is warped by the same spheres; captions in Canvas 2D; onset detection against the previous frame
- Brief: A 1960s op-art exhibition poster alive. Inside a white border a field of black and white checks swells into Vasarely spheres, and the headline is cut into the field as Riley stripes through the checkerboard, so the letters swell when a sphere rolls under them. The sheet drifts slowly under the spheres like cloth over marbles. Each kick inflates a small sphere somewhere in the field, printed in the

## Cube (`cube`)
- File: web/scenes/cube.js
- Sheet: harness/renders/sk/cube-720/sheet.png
- 96 s: harness/renders/sk/cube-96/sheet.png
- Technique: Canvas 2D in true isometric (35.26 degree elevation, orthographic). Every face is a flat 200-unit instrument panel drawn through an affine canvas transform built from three projected corners; parts that stand proud of a face re-issue that transform shifted along the projected normal, so buttons, gaskets, levers, windows and recesses have real parallax, and a cylinder side is the round-capped strok
- Brief: A machine-cube on a turntable, drawn like an industrial-design illustration: Braun-white enamel with one orange (or bottle-green enamel and brass, pastel works, night shift). Each face is its own instrument panel and each answers a different part of the music, so a room can read the mix on the cube. The kick slams the big orange plunger on the top deck into its rubber boot, which squashes and bulg

## Knit (`knit`)
- File: web/scenes/knit.js
- Sheet: harness/renders/b4/knit-720/sheet.png
- 96 s: harness/renders/b4/knit-96/sheet.png
- Technique: Canvas 2D: pre-shaded stitch sprites stamped into per-row offscreen strips as they are knitted, strips blitted with a travelling ripple, procedural Fair Isle band charts with row-by-row colour shading, wound-yarn ball sprites that roll, a window-shadow layer drawn at 64 px and upscaled for soft edges, onset detection against slow baselines
- Brief: A Fair Isle panel being knitted on a wooden table in daylight, seen from above. The working point shuttles back and forth along the live row on a pair of birch needles, each finished row pushes the fabric up the screen, and the pattern works through Fair Isle bands: lice, peerie diamonds, zigzags and fir trees in two colours on oatmeal in quiet passages, and dark-ground yoke bands of eight-point s

## Impasto (`impasto`)
- File: web/scenes/impasto.js
- Sheet: harness/renders/b4/impasto-720/sheet.png
- 96 s: harness/renders/b4/impasto-96/sheet.png
- Technique: Two WebGL2 passes: a quarter-resolution "motif" (colour, brush direction and layer per point, from a stream-function sky, fbm hills, SDF cypresses and a perspective wheat field) and a paint pass that lays three anchored stroke grids over it, each stroke a lit height field with bristle grooves and a knife ridge, composited two deep with cast shadows; crows as lit SDF marks
- Brief: A Van Gogh wheat field painted in thick oil, travelling slowly sideways: a sky of swirling bands and clouds, blue hills, cypresses like dark flames, and wheat whose strokes bend stroke by stroke as waves of wind roll through. Raked daylight makes every stroke stand up off the canvas; no glow. Kick: a gust flattens one patch of wheat, pale and leaning, somewhere different each beat. Snare: a flock 

## Isle (`isle`)
- File: web/scenes/isle.js
- Sheet: harness/renders/b4/isle-720/sheet.png
- 96 s: harness/renders/b4/isle-96/sheet.png
- Technique: WebGL2 flat-shaded low-poly diorama with a sun shadow map (depth texture + sampler2DShadow PCF); static island mesh built once per seed/season, moving parts (faceted polar-grid sea, sails, boats, gulls, clouds, festival) rebuilt into a growable Float32Array each frame; orthographic camera with the island turning on its plinth under a fixed sun
- Brief: A toy island on a round plinth of sea, turning slowly in daylight that drifts into dusk and back: lighthouse on a point, a village by the harbour, windmills, trees, boats sailing loops, clouds whose shadows cross the fields. Pastel, matte, crisp, with real shadows instead of glow. Kick: the big windmill on the hill clicks one notch, the gulls round the lighthouse ripple out and back, and a ring ru

## Plate (`plate`)
- File: web/scenes/plate.js
- Sheet: harness/renders/b4/plate-720/sheet.png
- 96 s: harness/renders/b4/plate-96/sheet.png
- Technique: Canvas 2D chromolithograph: cached unit Path2D engraving detail (lattice pores, diatom striae, areolae) drawn scaled, flat tint plates offset from the line plate for misregistration, a pre-rendered aged paper with foxing, plate-mark, ruled border and lettering, onset detection against slow baselines
- Brief: A living natural-history colour plate: aged cream paper, a ruled border, a plate number and a Latin caption, and sea organisms drawn in fine sepia line with flat printed tints of rose, ochre, slate and sage laid slightly out of register. A large medusa seen from above (or a radiolarian) sits in a ring of six radiolaria and diatoms that slowly turn; pale medusae and siphonophores swim behind them, 

## Constructivist (`constructivist`)
- File: web/scenes/constructivist.js
- Sheet: harness/renders/b5/constructivist-720/sheet.png
- 96 s: harness/renders/b5/constructivist-96/sheet.png
- Technique: Canvas 2D in two multiplied litho inks on a generated paper texture: every element placed along one rotating diagonal axis, bars tweened in with a locking overshoot, knockout type clipped to the beam, a halftone photo fragment drawn dot by dot, geometric figures posed from the measured beat phase; onset detection per band
- Brief: A Rodchenko/Lissitzky poster for a night of dancing, in red, black and cream. A red loudspeaker horn in the lower left throws a black diagonal beam across the sheet and the headline streams out of it in huge cream capitals. Above the beam a construction of red and black bars assembles: each kick fires one bar in along its own axis to lock into place with a hard little bounce, while the oldest bar 

## Cubist (`cubist`)
- File: web/scenes/cubist.js
- Sheet: harness/renders/b5/cubist-720/sheet.png
- 96 s: harness/renders/b5/cubist-96/sheet.png
- Technique: Canvas 2D: the still life is drawn once a frame into an offscreen layer, then composited through every plane of a binary space partition of the oval, each clipped plane with its own rotation, parallax offset and passage-shaded gradient; split lines drift and are stroked as broken charcoal edges; stencil letters are Abril Fatface cut with bridges on an offscreen canvas; papiers collés are pre-rende
- Brief: An analytic-cubist poster alive. An oval canvas on cream stock: a guitar, a bottle, a glass and a folded newspaper on a table, broken into faceted planes of ochre, grey, umber and cream, each plane a slightly different viewpoint, so the objects break at the edges and re-join rotated. The viewpoint slowly orbits the table and the planes slide past each other with parallax. Each kick turns one plane

## Vorticism (`vorticism`)
- File: web/scenes/vorticism.js
- Sheet: harness/renders/b5/vorticism-720/sheet.png
- 96 s: harness/renders/b5/vorticism-96/sheet.png
- Technique: Canvas 2D in flat letterpress inks on a generated flood texture: a few hundred hand-cut quadrilateral shards placed on an area-preserving logarithmic drain (radius = R·√u, angle = twist·ln(R/r)), so the centre spins fastest and the edges barely move; per-letter slab headline with a knockout trap and clipped snare inversions; onset detection per band
- Brief: A Vorticist broadside in hot pink, black and puce. A vortex of hard-edged machine shards (blades, sheared slabs, wedges, some hatched, some only keylines) drains into a still black eye on the right of the sheet, the outer shards barely drifting and the inner ones whirling. An enormous black slab word rises across the lower left on an aggressive diagonal, and a pasted-on manifesto page of heavy rul

## Suprematism (`suprematism`)
- File: web/scenes/suprematism.js
- Sheet: harness/renders/b5/suprematism-720/sheet.png
- 96 s: harness/renders/b5/suprematism-96/sheet.png
- Technique: Canvas 2D: hand-skewed polygons in a composed layer that recomposes by tweens, a toroidal parallax field of distant forms, and a spawned squadron of forms flying in depth along one diagonal; everything is drawn into an offscreen ink layer that loses specks through a crayon-litho noise pattern before it is laid on grained paper; onset detection against the previous frame
- Brief: A Malevich lithograph poster alive. On warm white stock a black square, a red quadrilateral, a circle, bars and a cross float weightless, turning and drifting very slowly, with small forms far away in white space moving past with parallax. The headline sits along a black bar in a wide geometric grotesque. Each kick turns and swells the red square, which then coasts like something in orbit; each cl

## Orphism (`orphism`)
- File: web/scenes/orphism.js
- Sheet: harness/renders/b5/orphism-720/sheet.png
- 96 s: harness/renders/b5/orphism-96/sheet.png
- Technique: Canvas 2D: concentric rings drawn as pie wedges from the outside in, with a wobble tied to each ring's own angle so the painted edge turns with it; per-quadrant cool and warm colours crossfaded by an angular wipe; brush strokes as low-alpha arcs in each ring's frame; letter blocks with quarter-discs; a seeded grain tile multiplied over the sheet; onset detection against the previous frame
- Brief: A Delaunay poster that turns. On cream board a large simultaneous disc of concentric rings, each cut into quarters of contrasting colour, sits over a ground of huge circular forms swung from a centre off the sheet; a small disc beside it; and a column of French poster-poem type, each letter on its own painted block with a quarter-disc in it. Everything is matte gouache: wobbling edges that travel 

## Zagreb (`zagreb`)
- File: web/scenes/zagreb.js
- Sheet: harness/renders/b5/zagreb-720/sheet.png
- 96 s: harness/renders/b5/zagreb-96/sheet.png
- Technique: Canvas 2D: a jointed stick-and-shape character driven by pose tables (walk held on twos, dance poses snapped on onsets), three procedurally generated parallax planes of flat houses and silhouettes, a timed tram, pop-up neighbours, all flat fills multiplied by a paper-grain pattern
- Brief: A 1960s Zagreb-school cartoon poster that plays its own little film. Under a paper header with a quirky wide lowercase title, a small man with a huge nose and a top hat walks through a flat night town that pans past in three planes, his walk held on twos like limited animation. Each kick snaps him into his next dance pose and pops his hat off his head; each clap brings a neighbour out of a window 

## Thresholds (`thresholds`)
- File: web/scenes/thresholds.js
- Sheet: harness/renders/b3/thresholds-hd/sheet.png
- 96 s: harness/renders/b3/thresholds-96/sheet.png
- Technique: One WebGL2 fragment shader ray-casting a cylinder and analytic door planes (hinged leaves intersect their rotated planes); every surface returns a tone, object-space hatch coordinates and an edge distance, turned into octave-LOD carved lines with fwidth anti-aliasing; door sequencing, latches and steam jets in JS
- Brief: Flying forward through a tunnel of successively opening doors, drawn as an animated woodcut: every tone is a carved line. Nine mechanisms (iris, vault with bolts and wheel, portcullis, toothed sliding leaves, radial segments, scalloped clamshell, rotating shutter slats, bascule, rolling gear) unlock, pause and swing with weight while gears, a steam engine, gauges and a chain run on the walls. Kick

## WPA (`wpa`)
- File: web/scenes/wpa.js
- Sheet: harness/renders/b5/wpa-720/sheet.png
- 96 s: harness/renders/b5/wpa-96/sheet.png
- Technique: Canvas 2D: flat screen-print ink layers, each offset by its own breathing registration vector; multiply overprint for rays; a pre-rendered paper-and-salt grain pass
- Brief: A silkscreened 1930s public-works travel poster for an invented lake resort at dusk: a stepped five-ink sky, a moon with a stepped halo, streamline clouds, a faceted snow range, a lake of broken horizontal strokes, a lodge with lit windows and chimney smoke, framing pines and a crossing flock, in flat inks slightly out of register on cream paper. Kicks spread rings on the lake and, in the drop, bu

## Penny Dreadful (`pennydreadful`)
- File: web/scenes/pennydreadful.js
- Sheet: harness/renders/b5/pennydreadful-720/sheet.png
- 96 s: harness/renders/b5/pennydreadful-96/sheet.png
- Technique: Canvas 2D: a cached sheet (paper, foxing, justified Baskerville columns, rules) under live wood-type headlines set letter by letter; a white-line woodcut built from variable-width cut lines (each sky line a filled polygon whose thickness is a function of the moon and horizon), parallax card flats on separate grooves, procedural houses, cobbles in perspective, figures as silhouettes with white-line
- Brief: A Victorian penny serial cover come alive. Under a masthead of mixed wood type (THE PHANTOM FIDDLER) and a subtitle in condensed grotesque, a white-line woodcut of a moonlit street moves like a toy theatre: the sky, the far rooftops and church clock, the near houses, the cobbles and the gas lamps slide past at their own speeds, a cloaked phantom fiddles under the moon, and waltzing couples are pus

## Direct Address (`actup`)
- File: web/scenes/actup.js
- Sheet: harness/renders/b5/actup-720/sheet.png
- 96 s: harness/renders/b5/actup-96/sheet.png
- Technique: Canvas 2D in flat offset inks: a flush-left grotesque headline fitted to the sheet from measured cap heights and re-pasted line by line behind a clip wipe; a crowd of words in parallax rows on an endless march whose speed follows the bass; per-kick Gaussian "jump" of one knot of the crowd; a snare-driven underline that slides between measured word boxes; a generated ink-void and mottle layer over 
- Brief: A black street poster speaking straight to the room. Under an address line (TO EVERYONE ON THIS FLOOR:) an enormous white stack of type says one thing at a time, WE KEEP EACH OTHER ALIVE, THIS FLOOR HOLDS ALL OF US, LOOK AT THE PERSON NEXT TO YOU, with one line in hot pink, and every phrase the message is torn down and a new one pasted up line by line. Along the foot of the sheet a crowd made of w

## Republic (`tdr`)
- File: web/scenes/tdr.js
- Sheet: harness/renders/b5/tdr-720/sheet.png
- 96 s: harness/renders/b5/tdr-96/sheet.png
- Technique: Canvas 2D on a strict 12 x 12 module grid. Wide monospaced headline (Rubik Mono One) re-set with a per-letter split-flap scramble; Space Mono data type; system Japanese gothic; invented pictograms and corporate marks drawn as paths; a clip-rect wipe inverts the headline panel for the drop with a multiply-overprinted second ink; transient detection on bands 0, 4 and 7 with re-arm hysteresis drives 
- Brief: A cool grey techno-consumerist poster running like a machine display. Two enormous wide words (LOW END, BUY NIGHT, MORE KICK, FEEL INC.) with a Japanese line beneath, an acid panel carrying an invented corporate mark (LOWEND KOGYO 低音工業, NOCTO SYSTEMS, HZ+ SUPPLY) with katakana streaming down its edge, a black strip of numbered pictograms, a data table and barcode, a registration roundel, a catalog

## Futurist (`futurist`)
- File: web/scenes/futurist.js
- Sheet: harness/renders/b5/futurist-720/sheet.png
- 96 s: harness/renders/b5/futurist-96/sheet.png
- Technique: Canvas 2D letterpress in multiplied inks on a generated paper: a pool of words flying outward from a burst in polar coordinates with perspective growth and swirl, per-letter headline layout in nine mixed faces, a bass-history ring buffer driving a line of onomatopoeia letters as a travelling waveform, onset detection per band
- Brief: An Italian futurist parole-in-liberta poster that is literally making the noise. A sound burst left of centre explodes the page: words in every face and size fly outward along its rays and grow as they come at you, Balla-style lines of force fan across the sheet, arcs of sound travel out, and a long TRRRRUUUMMM runs out of the burst as a line of type whose letters swell with the bass, the swell tr

## Mass Poster (`soviet`)
- File: web/scenes/soviet.js
- Sheet: harness/renders/b5/soviet-720/sheet.png
- 96 s: harness/renders/b5/soviet-96/sheet.png
- Technique: Canvas 2D in two multiplied inks on a generated paper texture: giant silhouettes built as one clockwise-wound Path2D each (a profile head, a three-quarter torso and two-bone arms reaching for targets), a fixed halftone screen clipped to them, a rotating sunburst of wedges, parallax ranks of crowd silhouettes, sheared and rotated display type; onset detection per band and a beat clock locked to the
- Brief: A mass poster for a night of dancing, in red, black and cream. Two colossal figures, a woman and a man seen from far below, tower in black over a massed crowd, with a red sunburst radiating from low between them and huge slanted type up the left of the sheet. The crowd marches across the bottom in parallax ranks: every kick makes the front ranks hop in a ripple that spreads out from the centre, ev

## Magazine Cover (`newyorker`)
- File: web/scenes/newyorker.js
- Sheet: harness/renders/b5/newyorker-720/sheet.png
- 96 s: harness/renders/b5/newyorker-96/sheet.png
- Technique: Canvas 2D: flat gouache shapes with fixed hand-wobbled edges, cached skyline layers with parallax, articulated painted figures posed per frame, a pre-rendered soft-light brushwork and paper pass
- Brief: The painted cover of an invented city weekly, "The Borough": a rooftop party at night in gouache, with a DJ at a card table under strands of bulbs, neighbours dancing on the tar roof, a wooden water tower with pigeons, the brick block across the street with a fire escape and an unimpressed cat, a skyline and a big moon, and a seasonal detail (a pumpkin on the parapet and falling leaves; a snowman 

## Liquid Glass (`liquidglass`)
- File: web/scenes/liquidglass.js
- Sheet: harness/renders/b5/liquidglass-720/sheet.png
- 96 s: harness/renders/b5/liquidglass-96/sheet.png
- Technique: WebGL2 fragment shader. The poster is evaluated per sample (disc, overprinted second disc) with Canvas 2D type uploaded as textures: a two-line marquee strip wrapped at each line's own period, and full-frame captions and rules. The glass is a signed distance field of rounded boxes and droplet circles joined by a polynomial smooth minimum, plus an exact distance-transformed word (Felzenszwalb-Hutte
- Brief: The 2025 liquid-glass interface look made into a printed poster: flat paper, a tangerine disc, two lines of giant condensed type drifting as slow marquees, small captions between hairline rules, and over it thick clear lozenges that drift, neck together and part like mercury, magnifying and bending the type beneath them, with bright rims and real soft shadows. Each kick drops a bead of glass besid

## Iso City (`isocity`)
- File: web/scenes/isocity.js
- Sheet: harness/renders/sk/isocity-720/sheet.png
- 96 s: harness/renders/sk/isocity-96/sheet.png
- Technique: Canvas 2D isometric painter: an endless procedural grid of boxes sorted by x + y, window grids as canvas patterns mapped onto each wall by a per-face transform, one path of sun-swept hexagons for the cast shadows, a lighting table recomputed per colour per frame from a moving sun, and a recorded drop envelope read back with a distance delay so the growth travels as a wave
- Brief: A dense isometric city drawn like a printed poster, drifting past on the diagonal: blocks of brick, limestone and glass, rooftop water tanks and gardens, parks, a river with boats and bridges, elevated viaducts, cars on every street and people on the pavements. The sun crosses the sky on its own, so shadows swing and lengthen, the light turns gold, and at dusk the city switches on building by buil

## Mobile (`mobile`)
- File: web/scenes/mobile.js
- Sheet: harness/renders/b4/mobile-720/sheet.png
- 96 s: harness/renders/b4/mobile-96/sheet.png
- Technique: Canvas 2D 3D scene: a tree of balanced arms, each with damped yaw, seesaw and pendulum-sway oscillators, projected through an orbiting pinhole camera; leaves are planar polygons that foreshorten as they turn; shadows are the same points projected from one or two lamps onto the wall and floor planes, drawn at quarter resolution, blurred once and clipped per surface
- Brief: A Calder mobile hanging in a white gallery: flat, matte painted leaves in red, black, yellow and blue on thin black wires, a cascade of balanced arms that turn on their threads and sway like pendulums, throwing soft grey shadows on the wall and the floor. The camera circles gently, so the shadows and leaves slide against each other in parallax, and leaves go edge-on and open again as they turn. Ea

## Diner (`diner`)
- File: web/scenes/diner.js
- Sheet: harness/renders/b5/diner-720/sheet.png
- 96 s: harness/renders/b5/diner-96/sheet.png
- Technique: Canvas 2D. Every neon tube is drawn twice: flat gas colour into a half-resolution light buffer, and on the stage as glass (cold) or gas colour with a near-white core (lit). The glow is that buffer's mip chain (1/4 to 1/32) summed back additively, so the halo comes from the tubes, not a frame bloom. The wet car park is the same buffer flipped in 64 rippled strips (sharp level plus a soft level), sh
- Brief: A roadside diner at night, and the poster is its sign: a skewed Googie cabinet with the name in pink script, blue channel letters on an oxblood panel, two starbursts, a chasing arrow that swoops down to the door, a red EAT blade out front, a streamlined stainless diner with warm windows, and all of it doubled in a wet car park under light rain. The sign strikes tube by tube as it starts. Each kick

## Low Poly (`lowpoly`)
- File: web/scenes/lowpoly.js
- Sheet: harness/renders/b5/lowpoly-720/sheet.png
- 96 s: harness/renders/b5/lowpoly-96/sheet.png
- Technique: Canvas 2D: a flat-shaded heightfield flown over on a world-fixed jittered grid, a lofted low-poly whale lit and depth-sorted per facet, a triangulated gradient sky, faceted type masked from an offscreen canvas
- Brief: A 2010s low-poly poster: a faceted humpback swims through a triangulated dusk sky above a flat-shaded valley that the viewer flies along towards a faceted sun, under a big faceted Bebas title and small tracked Josefin captions. Kicks make the whale's facets catch the light, head first, in one place; claps re-deal the sun's facet shades; the bass sets the whale's stroke and the flight speed and lif

## Koi (`koi`)
- File: web/scenes/koi.js
- Sheet: harness/renders/b4/koi-720/sheet.png
- 96 s: harness/renders/b4/koi-96/sheet.png
- Technique: WebGL2 pond floor (Voronoi pebbles, animated caustic web, ripple height field with refraction) compositing Canvas 2D koi and a low-res shadow canvas as textures; Canvas 2D lily pads, lotus and petals floating on top
- Brief: Looking down into a clear, shallow pond on a sunny day. Koi in white, red, black and gold swim and circle with real body undulation over sand and pebbles, sunlight caustics crawl across the floor under their soft shadows, lily pads and a lotus drift, petals float. Kicks drop raindrops at one wandering spot and the rings travel out, bending the light underneath; a snare makes one koi snap into a C 

## Glitch (`glitch`)
- File: web/scenes/glitch.js
- Sheet: harness/renders/b5/glitch-720/sheet.png
- 96 s: harness/renders/b5/glitch-96/sheet.png
- Technique: Canvas 2D, two canvases: a crisp poster redrawn each frame and a persistent display healed towards it by an exponential blend, then corrupted in place by region operations (slice shifts with red/cyan channel separation via multiply-and-add, macroblock downsampling behind a clip path, block-wise self-copies along a motion-vector field for datamosh, stretched source strips for pixel sorting); onset 
- Brief: A graphic poster (a vermilion disc, a huge condensed headline, a data block, a test strip) being corrupted by the music. Kicks tear one local slab sideways with channel split; claps tear a thin scanline across the sheet; the bass drags a wandering datamosh patch; the disc melts in pixel-sorted streaks with the bass and pad; hats flip single dead blocks. The drop re-sets the headline bigger with a 

## Letterpress (`letterpress`)
- File: web/scenes/letterpress.js
- Sheet: harness/renders/b5/letterpress-720/sheet.png
- 96 s: harness/renders/b5/letterpress-96/sheet.png
- Technique: Canvas 2D with four device-pixel layers: impression walls computed per line as the glyph minus itself shifted away from a moving point lamp (shadow) and toward it (highlight), two ink layers with edge squeeze and a salty wear mask multiplied onto a generated cotton-paper texture, the red run offset out of register; type set glyph by glyph in Web Fonts from web/fonts.js, each line fitted to the mea
- Brief: A two-colour letterpress broadside for a night of dancing on thick cotton stock, lit by one low lamp that circles the press so the deep impressions throw shadows that slowly sweep round. The hats set the type: sorts arrive one at a time as blind impressions and the forme builds itself line by line in the paper. Each kick is the platen: one line takes ink, sinks a little deeper and shines wet for a

## Zine (`zine`)
- File: web/scenes/zine.js
- Sheet: harness/renders/b5/zine-720/sheet.png
- 96 s: harness/renders/b5/zine-96/sheet.png
- Technique: Canvas 2D paste-up drawn as a coded image (tone / halftone flag / coloured-stock flag), run through a WebGL2 "copier" shader: toner spread and noisy threshold, rotated halftone screen, wear dropouts, drum streaks, lid shadow, dust and a scan-light wipe between pages
- Brief: A punk photocopy fanzine page that comes to life. Ransom-note headline letters cut from different magazines on scraps of card, a coarse halftone photo (a pogoing crowd, a spinning record, tower blocks at night) torn out and taped down, safety pins, a typewritten column that keeps typing, marker scrawls, toner streaks and copier dust, black toner on one colour of stock. Each kick re-cuts one headli

## Grunge (`grunge`)
- File: web/scenes/grunge.js
- Sheet: harness/renders/b5/grunge-720/sheet.png
- 96 s: harness/renders/b5/grunge-96/sheet.png
- Technique: Canvas 2D: ink and second-ink layers drawn separately, eroded by a generated photocopy wear mask and multiplied onto a generated newsprint texture; per-letter mixed-face headline, parallax type bands, a procedural halftone speaker cone, onset detection against the previous frame
- Brief: A mid-90s music-magazine spread in the David Carson / Ray Gun manner that will not sit still. A huge cropped headline built letter by letter from clashing faces, a typewriter column with the leading set too tight, bands of type sliding past each other at different speeds and angles, a halftone scan of a speaker cone, show-through from the other side of the sheet, tape, stamps and registration mark

## Clay (`clay`)
- File: web/scenes/clay.js
- Sheet: harness/renders/b4/clay-720/sheet.png
- 96 s: harness/renders/b4/clay-96/sheet.png
- Technique: WebGL2 raymarched SDF diorama with a matte clay shader: wrapped diffuse, soft shadows, AO, fingerprint and lump normal detail; puppets posed on twos
- Brief: A plasticine meadow in daylight: a snail crosses a lumpy green field past flowers, toadstools, gumdrop critters, a smoking terracotta volcano and a sun with a face. The kick squashes the snail, claps pop things out of the ground, hats send the bees zipping, the bass swells the smoke, and in the drop everyone dances and the sun wakes up.

## Ophanim (`ophanim`)
- File: web/scenes/ophanim.js
- Sheet: harness/renders/sk/ophanim-720/sheet.png
- 96 s: harness/renders/sk/ophanim-96/sheet.png
- Technique: Canvas 2D with hand-rolled perspective: a gimbal of cylindrical gold bands cut into quads and painter-sorted with the core fire and axles; icon eyes drawn in each band's plane through an affine transform built from the projected tangent and axis, irises offset by the camera direction so they all look at the viewer; six screen-space wings of layered feather leaves; vesica mandorla, gold rays and fi
- Brief: A biblically accurate angel as a Byzantine icon come alive: wheels within wheels of gold leaf turning on independent axes in true perspective, their rims set with calm almond eyes in lapis enamel that all turn to look at you, a white-gold fire at the centre, six vermilion wings full of eyes, all in a lapis mandorla under a vault of gold stars. Each kick ratchets one wheel round by one eye and wide

## Chomper (`chomper`)
- File: web/scenes/chomper.js
- Sheet: harness/renders/sk/chomper-720/sheet.png
- 96 s: harness/renders/sk/chomper-96/sheet.png
- Technique: A real self-playing maze game (generated wrapping maze, BFS chomper AI, four pursuer target rules) painted flat into a board canvas each frame, then uploaded as a texture onto a WebGL2 mesh folded in the vertex shader (tube, torus, drum, tilted table) with instanced extruded wall blocks; nested live mazes inside pellets and an exponential dive between levels in Canvas 2D
- Brief: An arcade maze game playing itself, then coming loose from the plane. A vermilion many-legged chomper with snapping mandibles eats through a wrapping maze, leaving a garden of flowers where the pellets were, chased by soft googly-eyed pursuers that keep changing species. Kicks snap the mandibles and send one ripple through the nearby pellets; snares turn the pursuers round and morph them; hats gli

## Stamps (`stamps`)
- File: web/scenes/stamps.js
- Sheet: harness/renders/sk/stamps-720/sheet.png
- 96 s: harness/renders/sk/stamps-96/sheet.png
- Technique: Canvas 2D in true isometric. Rigid cubes with integer body-to-world rotation matrices roll by Rodrigues rotation about the leading bottom edge; a persistent 1792 px torus texture of the floor in world space takes each print (scratch canvas: motif mapped through the landing orientation, rim, paper-tooth knockout, pressure gradient) by multiply with per-ink misregistration, and is drawn each frame a
- Brief: A dream of rubber-stamp dice on an endless sheet of paper. Pale cubes whose six faces are inked stamps (squares, frames, checkers, a grid) roll across the page one edge at a time, tipping up onto an edge where they hang, balanced, until the kick lets them fall; the face that lands prints its square in pink, blue or yellow riso ink, textured and a little off register, and where the herd crosses its

