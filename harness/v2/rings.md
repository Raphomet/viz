# Rings — V2

## The piece in one sentence

Raph's rings of radial dashes, each dash the length of one of the nine bands,
become a printed op-art tunnel that runs past every edge of the stage: the
music is struck at the centre like a speaker cone and travels outward through
the rings, so every kick is one vermilion ring rolling out to the corners.

## Scope: a restaging, keeping the whole 2016 grammar

Rings ranked in the bottom twelve (mean 2.17, spread 1). All six judges said
the same thing, and it is true: the picture is a coin in the middle of a black
field. Nobody said the *idea* was weak; the Purist calls the segmented ring
"the grammar Orphism later inherits", and the Curator calls Arcs, Jags and
Rings "the only truly minimal work here … they failed on scale and
legibility, not on idea". So this is not a new concept. It is the same sketch
given a stage, a direction of travel, and a second reading of time.

Everything in Rings.pde stays: rings of radial dashes; dash length from
`signals[rectId % 9]`, so every ring is made of the spectrum; rings turning
at their own speeds from {±1, ±2, ±4}; the "Partial arcs" mode (`i /
ringRotationSpeed`), which gathers a ring's dashes into a half or a quarter
arc; "Missing rings"; the X0 dash spacing. Three of Raph's own 2016 notes at
the top of the file get taken literally: *"different circles rotate at
different rates, including opposite directions"* (now the default), *"ring
zoom"* (the rings travel outward forever), *"color palettes obviously"* /
*"black white"* (two-ink print palettes, black on paper first).

## Feedback triage

| Point | Who | Call | Why |
|---|---|---|---|
| Occupies a coin / 4–5% of the frame; "nobody past row three will know it's on" | all six | Act | The rings run past the corners at every aspect ratio. This is the fix that matters most. |
| Scale up and treat them like record grooves, two inks offset like Riley's circles | Designer | Act | Black ink on paper; the drop brings a second ink printed off-register, multiplied, so the overlap is real overprint and the two systems shimmer. |
| Kick sends a ring out from the centre to the edges and fades | Floor | Act, my way | Not a separate ring sprite: the rings read the music at a delay that grows with radius, so the kick *is* a ring of long bass spokes in vermilion that travels out. Confined, legible, and it falls out of the rule. |
| Put a fog or haze plane behind it | Floor | Reject | The rings fill the frame now; haze would be glow by the back door (TASTE). |
| Kicks emit rings from new points that interfere, like Koi | Director | Reject | Off-centre ripples that interfere are Koi, Interference and the Ripple Tank idea. Rings' identity is the concentric system. |
| Dots ride the circumference like beads, speed from the hats | Director | Reinterpret | The rings already turn at their own speeds; the drop speeds the spin. Hats flicker their own dashes (bands 6–8), which is sparkle where it belongs. |
| Breakdown freezes the rings and dissolves them dot by dot | Director | Act | A Dissolve control drops dashes (and whole rings, V1's Missing rings) by hash; the calm look is partly dissolved, the drop fills it in. |
| Centred emblem | Purist | Reinterpret | The centre is a vanishing point, not an object: the frame is an all-over field moving through it. |
| Orphism is Rings grown up | Purist | Keep distinct | Orphism owns colour discs. Rings stays monochrome print and dash texture. |
| Fold into "Line" / Swiss Grid with Arcs and Jags | Curator, Designer | Reject | The brief is to give the sketch its own stage; Jags V2 already went its own way. |
| Retire the originals into layers of richer scenes | Psychonaut | Reject | Same reason. What the Psychonaut wants, "somewhere to fall into", the tunnel gives. |
| "A tiny dotted target that jitters on the drop" | Director | Act | V1 punches every bass dash in every ring on every kick. In V2 the kick reaches each ring only as the wave passes it. |

## The plan

1. **The stage.** Rings on an exponential radius, r = r₀·e^z, from a pin-prick
   at the centre to past the corners; a constant number of dashes per ring, so
   dash size and weight grow with radius like a tunnel seen head-on. Rings are
   born at the centre and travel outward (Raph's "ring zoom") at a speed the
   performer sets and the drop raises.
2. **The music travels.** A short history of the nine bands; each ring reads
   it at a delay proportional to its depth (about 0.9 s centre to corners).
   Dash lengths follow the bands exactly as V1 does, so a kick becomes a
   ring of long spokes rolling outward. The kick's ring is also struck in the
   accent ink (vermilion); the clap's ring gathers into arcs (V1's Partial
   arcs) in the second ink as it passes — a different shape and colour, not
   a second kick.
3. **The drop, as params.** Travel, Spin, Dash length, Gather (full rings →
   V1's partial arcs), Second ink (off-register overprint) and Dissolve are
   params; `presets: { calm, drop }` plus a couple of looks; Follow the track
   (default on) eases between calm and drop from the bass line.
4. **Print palettes.** Three or four hand-picked sets of ground, ink, second
   ink and accent: black on newsprint by default, riso blue and pink, bone on
   ink-black for a dark room. No hue cycling; V1's Cycling hues is gone.

Not touching: the dash-as-band rule, the six rotation speeds, the geometry of
Partial arcs, flat drawing (no glow, no blur).

## What changed

Built as planned, with three corrections found by looking:

- **The stage.** 60-odd rings on r = 1.2·e^z (1.11× per ring), 126 dashes each
  (V1's X0 still sets the count), born at the centre and travelling outward;
  the calm look is black on newsprint, a third of the dashes dissolved. The
  frame is full at every tile, at 640×360 and 1280×720.
- **The music travels.** A 256-frame history of the nine bands; each ring
  reads it 1.3 s × (depth / max depth) late, and dash i is still
  `band[(i + offset) % 9]`, so every ring is made of the spectrum and a kick's
  long bass spokes leave the centre and roll to the corners.
- **Kick = one vermilion ring, clap = blue crescents.** First build stored the
  kick as an envelope in the history, which struck five or six neighbouring
  rings (outer rings are only ~20 ms apart in delay) and filled the drop with
  a thick red band that muddied to maroon under the overprint. Now each onset
  is a front moving at the wave's rate, and only the ring it is passing wears
  it (Gaussian ~1 ring wide), printed last in the accent so it stays clean.
  The struck ring also opens back to a full circle, so in the drop's field of
  arcs the kick is the one whole ring travelling out. A clap's ring gathers
  to a quarter arc in the second ink as it passes.
- **The drop** (Follow the track, from the bass line): travel ×4, spin ×3,
  longer dashes, two rings in three gathered into half and quarter arcs,
  the blue second ink printed off-register (multiply; screen on Night), no
  dissolve. Drop Dash length pulled from 1.35 to 1.2 after the first sheet:
  the frame was losing its paper.
- Params: Inks (Newsprint, Riso, Oxide, Night), Travel, Spin, Dash length,
  Rings to arcs, Second ink, Dissolve, Dash spacing, Follow the track.
  Presets: calm, drop, riley, night. Reshuffle rings kept from V1.

## Before/after

- V1 `harness/renders/orig/rings/sheet.png`: a 90 px target in a black frame
  at every tile; drop and breakdown differ only in dash jitter.
- V2 `harness/renders/v2/rings/sheet.png`: 2–8 s a dotted print tunnel edge
  to edge; 10–16 s the dense two-ink arc field with a vermilion ring at a
  different radius in each tile (the kick caught in flight); 20–24 s back to
  the sparse one-ink field.
- Best frame: `harness/renders/v2/rings-720/frame-14s.png`.
- The 96 s sheet (`harness/renders/v2/rings-96/sheet.png`) alternates cleanly
  between the two looks; Night palette in `harness/renders/v2/rings-night/`.
- Jolt (640×360, seed 1): **calm**, ratio 1.01 (build 1.08). kickArea is
  0.79, but drift is the same size (0.283): that is the field's own rotation
  and travel, not the kick, which moves one ring.

## What I'd still do

- Every drop looks like every other drop. A slow long-period change (the
  gather pattern or the second ink's register angle re-dealt each drop, or
  Reshuffle fired automatically on the breakdown) would give the third drop
  somewhere new to go.
- Drift is high by the meter's standard (0.28): a lot of high-contrast
  texture moves at once in the drop. It reads as op-art shimmer in stills;
  worth a look at full speed on the projector before deciding to calm it.
- Check `harness/fps.mjs` at full screen; the harness's 8.7 ms mean at
  1280×720 is software rasterisation of ~16k stroked dashes.
