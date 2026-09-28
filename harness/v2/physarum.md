# Physarum V2

**Scope: a restaging, not a reconceptualization.** The simulation is the best
musical mapping in the collection (bass bends the sensor angle; kicks drop food
that is reached for) and nobody asked for it to change. What the judges
disliked is everything laid *on top* of it: a heavy bloom that fogs the
filaments, a second magenta species that makes the drop "more" instead of
"different", and a kick that is hard to see from the back. So V2 keeps the
organism and changes its finish, its drop and its kick.

## The piece in one sentence

A living teal lace, seen from above as we drift over it, that reaches for every
kick's food and, on the drop, stops exploring and builds roads between what it
has found.

## Feedback triage

| Point | Who | Verdict | Why |
|---|---|---|---|
| The teal lace is beautiful on its own | Curator | **Keep** | It is the soul. Default palette stays teal on black. |
| Magenta invader in the drop is a second idea it doesn't need | Curator | **Act** | One ink. The drop becomes a change of state, not a second colour. |
| Drop with an antagonist is its strength | Director | **Reject** | The antagonist is just a colour-swap; the real drama in slime mould is it *finding food and committing to it*, which V2 stages instead. |
| Bloom too heavy, fogs the veins; sharp filaments on black | Purist | **Act** | Bloom removed. Veins go through a tone curve (ground → ink → pale core) so dense trunks read brighter and sharper, not hazier. |
| Float buffer + single-hue LUT instead of bloom | Purist | **Act** | That is exactly the new finish. |
| Lines are thin at distance | Floor | **Act** | Tone curve pushed so a vein's edge is solid, and a vein-weight control for big rooms. |
| No identifiable kick | Floor | **Act** | Each kick's amber node now sends a ring that runs outward *along the veins* (Scanlines transplant), lit only where there is mould. Confined to ~150 px around the node. |
| Drop as change of state, not quantity (theme 1) | Curator | **Act** | The drop's food nodes persist and pour scent: the lace starves and contracts into thick transport trunks linking the amber nodes (what real Physarum does: Tero et al.'s Tokyo rail network). The breakdown releases them and the lace regrows. |
| A lasting trace of the drop (Knit transplant) | Curator | **Act** | A slow "trunk memory" channel: roads laid in the drop fade over ~40 s and are lightly preferred by the agents, so the breakdown's lace grows along the ghost of the last drop's roads. |
| Single accent: teal, amber food as only accent | Curator | **Act** | Amber is reserved for food and the kick ring. |
| No depth; simulation you fly *through* | Psychonaut | **Reinterpret** | Keep the deep, defocused lower stratum at slower parallax, and let the bass set drift speed. No 3D flight: it would cost the flat, graphic clarity that makes the lace beautiful. |
| White leading edge (light-age colouring) | Psychonaut | **Reject** | Every vein is occupied all the time, so age is uniform; the tone curve's pale core already marks where the traffic is. |
| Parallax motes | Psychonaut | **Keep, reduced** | V1 already has spores; kept, dimmer, because they now sit over a sharp image instead of a haze. |
| Cause and effect (Koi) | Director | **Keep** | Already the scene's premise; the drop's roads make it stronger. |
| Glow as default finish; reach for daylight/matte | TASTE, Purist | **Act (my idea)** | A second palette, **Agar**: pale cream agar with yellow Physarum, the colour it really is in a petri dish. Daylight, no glow at all. |

## The plan

1. **One ink, no bloom.** Single species. Sharp trail through a three-stop tone
   curve per palette (ground, ink, pale core). Remove the quarter-res halo;
   keep only the deep stratum (blurred, half scale, slow parallax) for depth.
2. **Kick as a travelling ring along the veins.** Amber node lands, a ring
   runs out ~150 px lighting only the veins, then the node settles to a warm
   nucleus the network reaches for. Snare becomes a pale pulse from *every*
   living node at once, so in the drop it runs down the roads between them.
3. **The drop builds roads.** Food lives as long as the drop lasts and leaks
   much more scent; decay rises so the unfed lace thins; the network contracts
   into trunks between the amber constellation. A slow memory channel keeps
   those roads as a ghost into the breakdown.
4. **Palettes with intent**: Abyssal (teal/amber, default), Agar (daylight
   yellow on cream), Ember (copper on soot, cyan food), Ice (blue-white on
   ink, rose food).
5. **Bass sets drift speed**, modestly.

Not touched: the Jones agent update, the linearised food gradient, the seven-
spoke kick spawn, the food walk across the frame, the fixed virtual-size trail.

## What changed

(completed after building)
