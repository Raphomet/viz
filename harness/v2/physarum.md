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

- **Finish.** One species, one ink. Bloom is gone: the sharp trail goes through
  a steep ground → ink → pale-core ramp, so veins have a solid edge and the
  busiest trunks turn pale mint. The deep stratum (defocused, half scale, slow
  parallax) is the only blur left. Amber is used only for food and the kick.
- **Kick.** The amber node lands as a hard disc and outline, with no halo, and a ring
  runs ~200 px outward lighting *only the veins* amber. In the drop, once five
  nodes exist, kicks hop between existing nodes instead of adding new ones.
  Snare: a pale wavefront from every living node at once.
- **Drop = roads.** While the drop detector is up, food barely ages, pours
  more scent, reaches further, and the unfed trail decays faster: the lace
  contracts into branching trunks and ganglia around the amber constellation.
  When the drop ends a stronger respawn trickle reseeds the empty ground (the
  first build left the breakdown as bare trunks on black), and a road-memory
  channel keeps the drop's trunks as a faint sheath the agents lightly prefer.
- **Drift** speed follows a 0.7 s-smoothed bass.
- **Palettes:** Abyssal (default), **Agar** (yellow mould on a cream plate with rust
  food, and no glow at all), Ember, Ice. The `Species` and `Glow` controls are
  replaced by `Drop builds roads` (0 gives V1's lace-only behaviour without the
  magenta) and `Vein weight` (for big rooms).
- Jolt: **calm**. Drop kickArea 0.164, kickMean 0.027, ratio 1.17; build
  kick 0.133, ratio 1.17. V1 was 0.237 / 0.044 / 1.33: a smaller share of the
  frame moves, yet the kick is easier to see because it is a colour change on
  the veins and not a bloom.

## Before / after

- V1 `harness/renders/b3/physarum-720/frame-14s.png` (teal + magenta, fogged)
  vs V2 `harness/renders/v2/physarum-720/frame-16s.png` (one ink, trunks and
  ganglia, the kick's amber running down two veins).
- V2 sheet `harness/renders/v2/physarum/sheet.png`: lace in the intro and build →
  contracting branching network with amber nodes in the drop → feathery regrowth
  in the breakdown. Agar: `harness/renders/v2/physarum-agar/sheet.png`.
- 96 s `harness/renders/v2/physarum-96/sheet.png`: every drop re-forms its
  constellation and every quiet section regrows. There is no saturation or die-off.

## What I'd still do

- After the first loop, the quiet sections are fan-shaped branching growth
  (the road ghost plus regrowth fronts) instead of the very fine cellular lace of
  the first intro. I like it, and it is a history, but the first 4 s are never
  quite seen again. A slow, section-length rise in respawn rate would bring
  the fine lace back if Raph misses it.
- The drop's contraction is a change of texture (loops → branching trunks), not
  a dramatic emptying. I pulled back from the stronger version: it left the
  frame mostly black and did not recover in the breakdown.
