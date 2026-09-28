# Batch 01

Six briefs, each a technique plus a constraint. A brief is a starting point, not
a spec: the maker is expected to find its own take and may depart from the
brief if the departure is better (and says why).

## 01 · Fault lines (`faultlines`)
**Technique:** crack growth in the manner of a substrate: straight cracks grow
until they hit another crack, and new cracks start perpendicular from existing
ones, with a soft band of "sand" grains painted along one side of each crack so
regions fill with watercolour-like tone. Never clears the background.
**Constraint:** paper-coloured ground, graphite lines, sand in a palette of at
most three earthy colours.
**Music:** kicks seed new cracks; the treble thickens the sand. The drop should
fracture visibly faster than the breakdown.
**Renewal:** when the plane is mostly subdivided, dissolve slowly (a very
low-alpha wash) and begin again, so it never stops growing.

## 02 · Current (`current`)
**Technique:** a flow field of tens of thousands of particles following curl
noise, drawn as short low-alpha strokes that accumulate into silky streamlines.
**Constraint:** a single hue on near-black, with tone coming entirely from
accumulation.
**Music:** the bass bends and strengthens the field (turbulence), the hats
lift particle speed; the field's time evolves faster in the drop.
**Renewal:** slow fade of the accumulation buffer; particles respawn at random
when they age out.

## 03 · Coral (`coral`)
**Technique:** Gray-Scott reaction–diffusion on the GPU (WebGL2 ping-pong
textures, many iterations per frame), rendered with a considered colour map
and a little lighting from the gradient so it reads as a surface, not a heat map.
**Constraint:** at most two hues plus a neutral.
**Music:** feed/kill rates drift through the pattern regimes (spots, worms,
mazes) with the track; kicks inject new seed blots.
**Renewal:** it must never settle to a static pattern or die out; keep it in
motion.

## 04 · Attractor (`attractor`)
**Technique:** a strange attractor (Clifford / de Jong / or your own family)
rendered by density: hundreds of thousands of iterated points per frame into a
float accumulation buffer, tone-mapped with a log curve so the thin filaments
glow. Consider a GPU approach if the CPU can't keep up.
**Constraint:** looks like a long-exposure photograph of something physical.
**Music:** the attractor's coefficients wander slowly, and the bands nudge them,
so the form morphs continuously; never jumps.
**Renewal:** the density buffer decays so the form can change.

## 05 · Magnetosphere (`magnetosphere`)
**Technique:** a cloud of charged particles orbiting a few moving attractors
with magnetic (perpendicular) forces, additive blending, a soft bloom. In the
spirit of Hodgin's work, not a copy of it.
**Constraint:** additive light on black; one cool and one warm hue.
**Music:** kicks give the cloud a radial impulse that it then settles from;
snares briefly flip the field's handedness; the breakdown should be calm and
slow.
**Renewal:** particles that escape are recaptured smoothly.

## 06 · Interference (`interference`)
**Technique:** moiré and op-art: two or three families of fine lines (concentric
rings, parallel lines, radial spokes) overlaid so their interference produces
large, slow, shimmering secondary patterns. Think Bridget Riley and Vera Molnár
more than a screensaver.
**Constraint:** black and white only (one optional accent colour, used
sparingly). Lines must be crisp at projector resolution.
**Music:** the bands shift the phase, spacing, or centre of one family, so
the music moves the *interference pattern* rather than the lines themselves.
**Renewal:** slow drift ensures the pattern never repeats exactly.
