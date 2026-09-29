# Batch 07 · Rendered

Raph (2026-09-29), after the three.js spike (`web/scenes/rendered.js`): "wow!
yes, this looks very un-javascript - totally different aesthetic" … "10 new
scenes for three.js please." And: "using a library vs. raw js creates a very
different aesthetic, which is great."

## What "rendered" means here

The spike's lesson (docs/research/2026-09-28-js-libraries.md and the chat that
followed): the javascript look was never about JavaScript. It came from picking
a colour per shape. These scenes **simulate light** and let colour fall out of it:

1. **Light decides colour.** Physically based materials (roughness, metalness,
   clearcoat, sheen, transmission where affordable) under real lights (area,
   spot, environment). Gradients, highlights and reflections nobody drew.
2. **HDR and a tone curve.** Values above white; bloom only on things that are
   light sources; AgX tone mapping.
3. **A real camera.** Depth of field and motion blur from actual depth and
   velocity; eased camera paths; banks; parallax.
4. **A world, not a drawing.** Fog, atmosphere, depth, scale.
5. **Materials against materials.** Chrome by concrete by wet stone by paper.

Build every scene on the shared kit (`web/three-kit.js`, "three.js scenes" in
web/CONTRACT.md; `rendered.js` is the reference). Keep to a render budget
(default ~2.3 MP) and 60 fps at 3024×1890. harness/TASTE.md still applies: the
beat visible but confined, the drop obviously bigger, movement, and no default
neon. The spike's drop leaned neon-tunnel; avoid that as a default. Nothing
menacing. From Raph's LEXSAN notes he loves: morphing shapes, layering, a
moving camera, designed surface detail, and density of motion
(docs/research/2026-09-28-lexsan-takeaways.md).

## The ten

1. **Shardfall** (`shardfall`, 1001). LEXSAN #13 re-thought: a flight through
   translucent extruded shards (glass, transmission and dispersion if affordable,
   otherwise tinted clearcoat) that morph as they pass, mirrored left-right into
   figures, over a deep starfield. Kicks send a shard wave; the drop mirrors
   four ways and speeds the flight.
2. **Concrete City** (`concretecity`, 1002). LEXSAN #16 re-thought, not
   synthwave: a dusk city of brutalist towers in sodium haze and fog, lit
   windows, rooftop water tanks, a banking spline flight low between towers.
   Kicks light floors of windows; the drop banks into a dive.
3. **Glass Canyon** (`glasscanyon`, 1003). Daylight: flight through a canyon of
   tall glass fins that refract the sky and each other, with caustic light on
   a pale sand floor. Kicks ring a fin like a bell (a shiver of refraction).
4. **Chrome Bloom** (`chromebloom`, 1004). Liquid chrome metaballs (marching
   cubes) in a soft studio, reflecting a warm environment; they bud, merge and
   split. Kicks bud a new form; bass swells them; the drop splits into a swarm.
5. **Clay Orchestra** (`clayorchestra`, 1005). Matte pastel clay forms under
   soft daylight with real soft shadows and ambient occlusion, each an
   "instrument": cylinders that squash on the kick, spheres that bounce on the
   snare, rings that wobble to hats. Rapier physics is allowed if it earns its
   place (see the library research).
6. **Silk** (`silk`, 1006). Long silk banners hung in a dark hall, moving in
   wind (cloth simulated in a shader or Verlet), with sheen material and a
   single warm light raking across the folds. Kicks send a gust down the row.
7. **Clockwork** (`clockwork`, 1007). A macro view into a brass and steel
   mechanism: gears, escapement, jewels, shallow depth of field racking
   between planes. Kicks tick the escapement; the drop opens the view out to
   the whole movement.
8. **Sunroom** (`sunroom`, 1008). An empty room with tall windows: light
   through blinds sweeps slowly across walls and floor, volumetric dust in the
   beams, plants casting moving shadows. Kicks shift the blinds; the drop brings
   the sun round and the beams sharpen.
9. **Mirror Wall** (`mirrorwall`, 1009). A kinetic sculpture: thousands of small
   mirrored facets on a wall that tilt in waves, reflecting a few moving
   coloured lights and the room. Kicks send a flip wave; bass sets the swell;
   the drop throws a figure across the wall.
10. **Lanterns** (`lanterns`, 1010). Paper lanterns rising over dark still
    water at night, translucent paper glowing from within (subsurface-like),
    reflections on the water, a slow drifting camera. Kicks launch a lantern;
    the drop releases a flock.
