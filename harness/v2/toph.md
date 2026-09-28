# Twinkle Toph — V2 redesign note

## The piece in one sentence

Toph, painted as Aladdin Sane, is a constellation: the music gathers him out of
a slowly turning night sky around the red lightning bolt, the bolt strikes on
every kick, and in the breakdown he comes apart into stars again.

## What the 2016 sketch was reaching for

`TwinkleToph.pde` is a friend's photo re-drawn as one mark per pixel, with six
ways of making the marks move (random "twinkle" sizes every tenth frame, band
halftones, hatching). The name is a nursery rhyme ("twinkle, twinkle, little
star"); the photo is a Bowie tribute, a red Aladdin Sane bolt across closed
eyes. So the sketch was already halfway to a star picture. It stayed on a white
page, which made it a print rather than a sky. V2 finishes the joke the title
started: Toph becomes a Starman.

## Feedback triage

| Point (who) | Verdict | Why |
|---|---|---|
| Pure white field is a floodlight in a dark room (Floor, Psychonaut) | **Act** | Night ground by default. A warm Paper option keeps V1's print reading for daylight, and even then it is paper (#e6dfcc), not projector white. |
| Invert: pale dots on black, one warm ink (Floor) | **Act, my way** | Stars are sized by *brightness* (a positive image on black, not a photographic negative), in warm starlight fading to cool dim blue, with the photo's own reds as the single accent. The background of the photo is cut away so no grey box floats in the sky. |
| Static; nothing happens across 24 s; no arc (Director, Designer, Purist) | **Act** | This is the core problem. The face now has an arc: it assembles, holds, and dissolves. |
| Dots as a crowd with a job: drift loose, gather in the build, blow apart on the drop, spring back (Director) | **Reinterpret** | I keep "the audience watches the face assemble" but invert the drop: the face *arrives* for the drop (the build's pay-off) and disperses in the breakdown. Blowing it apart on the drop would hide the only picture exactly when the room is looking. |
| Dots drift away and re-form, a face-in-the-stars you catch rather than one that catches you (Psychonaut) | **Act** | This is the concept. In calm passages only the bolt and a few stars hang in the sky; when following the track the face also surfaces briefly every half minute and sinks again. The eyes in the photo are closed, so even assembled he is not staring. |
| Blink on the snare (Director) | **Reject** | The eyes are closed in the photo; there is nothing to blink. The snare gets its own event instead (shooting stars). |
| Warhol grid of four or nine panels (Designer) | **Reject** | Makes it a poster and quarters the one subject. One large face in a deep sky is stronger. |
| Make it a template that takes any image (Floor) | **Reject** | A different product. The piece is about *this* photo and this friend. |
| A private portrait; keep it off the stage (Curator) | **Reject** | It is Raph's 2016 piece and the reason it exists. As a constellation that appears only when the music earns it, it reads as a figure in the sky, not a family snapshot. |
| Affectionate and personal, static as a system (Purist) | **Act** | Keep the affection (the photo, the bolt, the red braces), give it a system: a galaxy with differential rotation that the face is spun out of and back into. |

## The plan

1. **Night sky, positive stars.** Mask out the photo's pale background by a
   flood fill from the border; every remaining pixel is a star sized and
   coloured by its brightness; reds (bolt, braces, tie) keep a vermilion ink.
   Behind it, two more layers: a faint distant star field and a halo of loose
   stars orbiting the face.
2. **Gather / scatter.** Each star has a home in the portrait and a place in a
   slowly turning galaxy (differential rotation, so the sky shears into arms).
   One `Face` control (0–1) moves stars home in order: the bolt first, then
   outward across the face, then the shoulders. Stars travel on a curl so the
   face spirals in rather than sliding in.
3. **A vocabulary of reactions.** Kick: the bolt's stars swell and heat (the
   only thing the kick touches). Clap: a shooting star crosses the sky. Hats:
   the twinkle (smooth, per-star, faster and deeper with the hats) and a few
   four-point glints. Bass: the galaxy's spin.
4. **Performer model.** Params for everything the drop changes (face, spin,
   loose stars, twinkle, bolt strength, shooting stars) plus sky ink and the
   bolt's band; `presets: { calm, drop, paper }`; `follow` default on, which
   moves between calm and drop from the track (build hats lift it part way, the
   bass line takes it all the way).

Not touched: the photo, its framing (height-constrained, centred, cut at the
shoulders as in the .pde), one mark per pixel.

## What changed

- **Ground.** V1's white page is now a night sky by default: a deep indigo radial
  ground (matte, no bloom), about 420 distant stars drifting slowly for
  parallax, and a halo of up to 1,800 loose stars in a two-armed galaxy centred
  on the bolt. "Blue hour" is a lighter indigo. "Paper" is V1's reading
  (dot size by darkness, ink on warm cream) with the same motion.
- **Positive starlight.** The photo's ground is cut away by a flood fill from
  the border (light, near-neutral, slightly blue pixels; stray specks under 40
  pixels are dropped too, since they hung over his head as a dotted line). That
  leaves about 6,100 stars, each nudged a fraction of a pixel off the grid so
  the face reads as stars and not as an LED panel. Size and colour follow
  brightness (cool dim blue up to warm starlight), and pixels that are strongly
  red become vermilion, so the bolt, braces and tie are the only colour.
- **The arc.** `Face` sends stars home in order: the bolt first, then outward
  across the face, then the shoulders. They travel on a curl, so the face
  spirals in. With Follow on, the intro is the red bolt hanging alone in a
  turning galaxy. The build integrates the hats, so sustained hats pull the
  face in (half-formed by 9.5 s). The drop's bass line completes it, with the
  halo spinning faster and shooting stars on the claps. In the breakdown he
  scatters back into the sky. After 20 s of calm, the face surfaces for about
  ten seconds in every 32 and then sinks again.
- **Reactions.** Kick: the stars of the bolt, braces and tie swell and heat, but
  only once they are home. Out in the sky they read as confetti. Clap: a
  shooting star. Hats: smooth per-star twinkle plus four-point glints on bright
  stars. Bass: galaxy spin. The kick onset uses a trough-following slow
  envelope, because a plain slow average sat high on the drop's sidechained
  bass and missed every other kick.
- **Cost.** Stars are batched into one Path2D per ink bucket (ten fills a
  frame), not a fill per dot as in V1. At 1280×720 the harness measured
  renderTime p95 at 8.9 ms and draw() JavaScript at 1.1 ms.

## Before / after

- V1 `harness/renders/orig/toph/sheet.png`: the same portrait on a white page in
  all twelve tiles.
- V2 `harness/renders/v2/toph/sheet.png` (and `toph-720/sheet.png`): 2–6 s show
  the bolt alone in the galaxy, 8–10 s the face spiralling in, 12–18 s Toph
  whole with the bolt and braces struck on kicks, and 22–24 s the breakdown
  scattering him. Best frame: `harness/renders/v2/toph-720/frame-12s.png`.
- Jolt (640×360): **calm**, with kickArea 0.045 and ratio 1.6 in the drop. The
  heat map (`toph-jolt/heat.png`) lights only the bolt, braces and tie.
- 96 s (`toph-96/sheet.png`): each loop repeats the arc. Nothing saturates or
  dies.

## Still to do

- The bolt constellation in calm is small (the photo's bolt is only about 40
  pixels). Faint constellation lines joining its stars, in the manner of a
  star chart, would make it read from across a room.
- The face surfacing every 32 s is a guess at a phrase. With a tempo clock it
  should land on a phrase downbeat.
- The build only half-forms the face before the drop, which I think is right
  (the drop is the reveal). A VJ who wants more can push `Face`.
