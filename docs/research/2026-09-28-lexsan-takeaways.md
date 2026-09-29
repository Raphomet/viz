# LEXSAN takeaways: Raph's notes and ours (2026-09-28)

Purpose, in Raph's words: reflect on aesthetics (what do I like) and on
possibilities (what can't we do now that we should, with software or the library
we're building), then use them as inspiration. Scene numbers refer to
`2026-09-28-lexsan-set.md`.

## Raph's notes, per scene

1. **Speaker-box city.** Fully in our wheelhouse. Likes the graphic designs on the cubes.
2. **White silhouettes.** Doesn't care.
3. **Style-swap dancer.** A super cool effect, and very much not in our wheelhouse:
   it relies on preselected art strung together. The camera pans around to keep it
   interesting, which our more stationary scenes should consider.
4. **Cosmic pinwheel.** A case study in what we can't do today despite a pure-code
   approach. Interesting shading, and a texture. The camera pans. The foreground
   spins while the background expands and collapses fractally, and the glowing-line
   overlay makes a multi-layered effect. It looks "not javascript" in a way he
   really likes.
5. **Portrait collage.** Pre-made and probably designed by hand. He loves it and
   can barely look away.
6. **Wireframe mask.** (The agent's description missed this.) The mask's surfaces
   expand into stretched-out triangles, then collapse back onto the mask, left to
   right and then right to left. Easy with a 3D library.
7. **Tiled eyes.** Interesting because it's eyes, and we love eyes. It seems to be
   a video or gif on repeat. We should be able to use video this way.
8. **Hexagon tunnel.** Not so different from Thresholds, but graphic styling and
   multi-layering make it look extra interesting. A good case study.
9. **Orange ink kaleido.** Basic, and not very interesting to him, but the way the
   colours morph into each other is interesting and looks non-javascript, very
   After Effects-y.
10. **Lens/target HUD.** Like 4 and 8: we could do it, but theirs has a panache and
    movement worth studying.
11. **Old DJ.** A nice use of stock art.
12. **Goggle character.** Doesn't care for it, though the background is interesting.
13. **Psychedelic mirror shards.** One of his favourites. The way the shapes morph
    is interesting and mesmerizing, and the layers work well: rings flying in, the
    glow, the starfield background. Great palette. "If we applied some of these
    layerings to our angel it would be amazing to behold."
14. **Diamond tunnel.** Doesn't care.
15. **Orange iris.** We could have made it. What's interesting is its sense of
    complexity and movement: a lot moving on screen that makes cool patterns.
16. **Neon city.** The most like some of our concepts; we could have done it. The
    notable thing is the lighting, which looks very un-javascript.

## What he likes (aesthetics)

- **Layering.** Several planes, each moving differently: a spinning foreground, a
  fractally breathing background, an overlay of glowing lines, rings flying in, a
  starfield behind (4, 8, 10, 13, 15). This is the strongest single theme.
- **Morphing.** Shapes that transform continuously (13) and surfaces that tear
  open and re-form (6). The same pleasure as Solids.
- **Movement from the camera.** Even simple content feels alive when the view pans,
  orbits or dollies (3, 4, 10).
- **The "not javascript" finish.** Shading and lighting (4, 16), texture (4), and
  colours that melt into each other rather than switching (9).
- **Density of pattern.** Many things moving at once, adding up to patterns (15).
- **Designed surface detail.** Graphic design printed on objects (1).
- **Handmade art in motion.** Collage and illustrated sequences (3, 5): the ones
  he can't look away from.
- **Eyes** (7).

Not for him: dancer footage for its own sake (2), the cartoon character (12), the
diamond/stripe clip (14), and plain kaleidoscoped footage (9, apart from its colour).

## What we can't do yet (possibilities)

Each gap names what would close it: a piece of our own library, a library we
adopt, or a production route. In keeping with the instrument principle, all of
them are live code played by music and the VJ.

1. **Layers inside a scene.** Today a scene is one drawing. We need scenes built
   from planes, each with its own motion, blend mode and music mapping (background
   field, mid shapes, foreground spinners, overlay lines, particles, starfield),
   plus the effects rack between them. *Library piece: a layer compositor.*
2. **A camera for every scene.** Pan, orbit, dolly, zoom and bank on eased paths,
   usable by 2D scenes (drawing onto a larger virtual plate) as well as 3D.
   *Library piece: a camera rig with presets and music hooks.*
3. **Light, shade and texture.** Lit gradients, ambient occlusion, specular and
   emissive light with bloom and fog (16), surface textures and grain (4).
   *three.js (spike running) plus the Finish, and texture helpers.*
4. **Colour that melts.** Interpolating and cycling colour in a perceptual space
   (OKLab/OKLCH) instead of HSB, gradient maps and palette morphs (9).
   *Library piece: a colour module; the `gradmap` effect.*
5. **Mesh morphing and deformation.** Faces exploding along their normals and
   stretching into long triangles, then collapsing back as a wave passes (6);
   shapes that morph between forms (13). *three.js with morph targets and vertex
   shaders; Solids' geometry work.*
6. **Fractal backgrounds.** Recursive zooms that expand and collapse behind the
   foreground (4). *The `droste` and `feedback` effects, as a layer.*
7. **Video and images as material.** A clip or gif on repeat that code tiles,
   warps, masks and times to the beat (7, 11). *Library piece: media textures
   (video, image sequences) plus an openly licensed source list; files dropped in
   by the VJ.*
8. **Handmade art sequences.** Style-swap and collage (3, 5) depend on drawn art.
   Routes: generative approximations (one continuous motion, the renderer swapped
   on the beat; collage from cut-up public-domain engravings); art Raph draws or
   commissions; or an image model, if we get one. The lowest-cost first step is
   the public-domain collage.

## First moves

- **Ophanim, layered**, as Raph asked: the angel with #13's treatment. Rings
  flying in, glow, a starfield behind, shapes that morph, and a palette as good
  as #13's.
- **Library pieces**, in order of reach: layer compositor, camera rig, colour
  module, media textures.
- **Inspiration sketches** that take a principle rather than a look: a pinwheel
  over a fractally breathing field with a glowing-line overlay (4); a mesh that
  tears into triangles and heals in sweeps (6); a dense field of many small
  movers making larger patterns (15); objects wearing designed graphics (1);
  a collage from public-domain engravings that slice, hinge and hard-cut pastel
  grounds (5).
