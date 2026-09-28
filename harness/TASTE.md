# Taste

What we're making, and what good looks like. Read it before making a scene.
It is guidance for taste, not a scoring rubric: the question is always whether
a room full of people at a party would be captivated.

## The goal

**Extremely hard to look away from, for someone who is very high.** That is
Raph's bar, in his words. Everything below serves it.

**A music visualizer that mesmerizes a room.** Someone glances at the
projection while their friend is DJing, and a minute later they're still
watching, and they can *see the music in it*. Two things have to be true at
once:

1. **It is captivating to look at.** Rich, layered, often psychedelic imagery
   with depth and atmosphere, whether it is abstract or figurative (a jellyfish,
   an aurora over mountains, a crowd under lasers are all fair game).
2. **The music is obvious.** Anyone in the room can tell it is dancing to the
   track, without being told.

History (2026-09-27): batch 01 was judged on "music felt, not read", and Raph's
verdict was that apart from Interference you couldn't tell how the pieces
reacted to the music: gen-art, not music visualization. That rule is retired.
He also asked for more psychedelic imagery and more layering, pointing at
Flyover's Night drive (stars + sun + moving ground) as the kind of combination
he likes.

## Music the room can see

Give each scene a small vocabulary of distinct, legible reactions:

- **Kick → a punch that lands.** A flash, a bloom, a pulse outward, a zoom
  kick, a launch, a bell contraction: something unmistakable on every beat
  that *decays* back (a few hundred milliseconds) rather than wrecking the
  structure. At 124 BPM a kick lands every 0.48 s, so the punch must be quick
  to rise and quick to fall, and the underlying scene must survive it.
- **Snare / clap → a different event.** A colour flip, a burst, a camera cut,
  a flock turning. Visibly not the same as the kick.
- **Bass and pad → continuous swell.** Size, glow, height, density, speed.
- **Hats → sparkle.** Glints, twinkles, fine particles, flicker in the detail.
- **The drop is obviously bigger.** More layers switch on, more colour, more
  motion. The breakdown clearly exhales.

Legible does not mean literal: no spectrum bars and no meters. The reaction
lives inside the imagery.

## What makes it captivating

- **Layers.** Three or more planes working together: a sky or backdrop, a main
  subject, foreground particles or light, atmosphere (haze, glow, fog,
  reflections, bloom). Layers are also where the music can land in different
  places at once.
- **Depth and light.** Glow, additive light, soft bloom, parallax, fog,
  reflections. Light on black reads beautifully on a projector.
- **Colour with intent.** Psychedelic is welcome: saturated, shifting palettes,
  complementary pops, iridescence. But it is chosen, not `hue = frameCount`.
- **Motion that never stops being interesting.** Something is always
  evolving, and minute five is as good as minute one: no saturation, no
  stasis, no death.
- **Composition at every aspect ratio.** It fills a 16:9 stage and a square.
- **Craft.** Smooth, antialiased where it matters, no seams, no accidental
  jitter, 60 fps on a laptop.

## For the altered viewer

Someone very high is exquisitely sensitive to motion, depth, colour and
rhythm, and gets pulled into things that unfold, breathe and recurse:
tunnels, fractal zooms, slow morphs, colour that keeps finding new harmonies,
detail inside detail, symmetry that shifts. Give them somewhere to fall into.
Avoid what feels bad in that state: harsh full-screen strobing, jittery
noise, sudden ugly cuts, and anything menacing. Rapid high-contrast flashing
of large areas (roughly 3 to 30 flashes a second) can also trigger seizures, so
kick punches use glow, bloom, scale and colour, never hard full-screen
black/white strobes.

## Things that fall flat

- A centred shape pulsing to the kick with nothing else going on.
- A spectrum analyser in disguise.
- One effect alone (a lone particle fountain, a lone plasma).
- Rainbow cycling as a substitute for a palette.
- Reactions so subtle that you need the band strip to notice them.

## Controls

4–8 params a performer would want to turn mid-set, with plain labels, and at
least one that changes the character dramatically. A "reaction strength" style
control is welcome. Every default must already look great.

## Performance

The target is a steady 60 fps on a laptop at full screen. Measure it with
`harness/fps.mjs`, which runs the real app in Chrome on the GPU. The render
harness's `renderTime` is useful for comparing versions of one scene, but it
rasterises in software (SwiftShader) and overstated batch 02's costs three to
ten times over: scenes it timed at 80-160 ms ran at 60 fps at 3024x1890 on an
M4 Pro.
