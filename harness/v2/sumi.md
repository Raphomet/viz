# Sumi V2

**The piece in one sentence:** an ink handscroll unrolling past one small boat,
where the paper, the mist and a single red are the whole palette, and the music
lives in the boat, the water and the weather, never in the frame.

## Scope: refinement, three changes and one new idea

Sumi ranked #5 of 72 (mean 7.4, spread 3). The two judges who scored it 9 named
its soul exactly: a small figure in a big world, and the most confined kick in
the set. The three who scored it 6 or 7 had three complaints, and two of them
are right: the lantern is a blurred additive blob in a scene where nothing else
glows (curator, purist), and the kick is too small to see from the back of the
room (floor). The third, "cream ground in a dark room", is really a complaint
that the frame never changes its weight: the drop in V1 is the same pale scroll
with a bigger sun and some geese. The director named the fix: *a drop that is a
place.* So: keep the scroll, fix the lantern, make the kick travel, and let the
drop take the boat somewhere.

## Feedback triage

| Point (who) | Call | Why |
|---|---|---|
| Lantern glow is "a blurred blob in a scene with no other glow"; "replace it with a flat red dot that grows" (curator 9; purist 6: "breaks the ink") | **Act** | Right, and the single biggest flaw. The lantern becomes a flat, hard-edged paper lantern of the same red as the sun and seal; the kick swells it and lays a flat red streak of reflection on the water. No additive light anywhere. |
| Kick is "too small to see from the back" (floor 6) | **Act, my way** | Not by flashing: the boat comes nearer (larger, lower), and each kick's ring *travels* out across the river for two seconds, bending the reflections it passes through, so a thin line crosses a lot of water rather than a blob covering some. |
| Koi's travelling rings that refract the world beneath → Sumi (psychonaut transplant) | **Act** (same change) | It is the same fix as the floor's, from the other side. |
| The drop is a place: "Sumi's boat could pass under a bridge or through a gorge" (director transplant) | **Act, as the new idea** | On the drop the boat enters a gorge of sheer karst pillars that emerge top-first out of the mist, in the heaviest ink in the scroll, and scroll past close; the breakdown lets the mist swallow them again. Ink painting's own device for arrival, and it changes the frame's weight, not its brightness. |
| "Cream ground in a dark room"; "cream is the new rainbow" (floor); "maybe too pale for a room" (psychonaut) | **Act (Raph's call)** | Moonlit silk stays the default: Raph chose it after seeing V1, for exactly this dark-room reason. The judges were shown Warm paper, which remains an option. The gorge pillars are painted as dark moonlit silhouettes on silk (see What changed). |
| "Most confined, most poetic hit"; "small figure in a big world" (director, curator) | **Keep** | The kick stays in the boat and its water. Nothing else moves on the kick. |
| Composes off-centre, leaves two thirds to paper and mist (curator) | **Keep** | The gorge pillars are spaced with gaps; the sun is still seen between them. |
| Single accent red (psychonaut, curator themes) | **Keep, tighten** | Red is now strictly flat: sun, lantern, its reflection, seal. |
| Brush that visibly lays the washes (purist transplant from Zen) | **Reject** | The unrolling scroll is already the tool's gesture; a brush agent would turn a landscape into a demo of its own making. |
| Save it for a daytime set (floor) | **Reject** | Not a design change; the gorge makes the night version heavier anyway. |
| Two-state longevity (psychonaut, floor themes) | **Covered** | The gorge is world-space: every drop is a different stretch of cliffs. |

## The plan

1. **Flat lantern.** Delete the additive glow (both the lantern halo and the
   pool on the water). The lantern is a flat red oval on its post that the kick
   swells to about twice its size, plus a flat, broken red streak reflected on
   the water under it. Same red as the sun.
2. **Nearer boat, travelling rings.** Boat scale 1.55 → 2.1, sitting lower on
   the water. Kick rings expand far across the river (out to ~350 units) over
   about 2.5 s, thin and ink-dark at the crest, and their wave refracts the
   reflections as it passes.
3. **The gorge.** A new ink layer between the far shore and the river: tall
   sheer karst pillars (domed crowns, dry-brush axe-cut texture), moving
   faster than the nearest mountain layer. Its presence follows the drop: the mist line sinks from the top of the
   frame to the water over ~1.5 s, so the pillars appear peak-first out of mist,
   and at the breakdown the mist rises back over them. Reflected in the river.
4. **Keep Moonlit silk the default** (Raph's choice; Warm paper stays an option).

Not touched: the four mountain washes, the mist, the suminagashi snare blooms,
the hat rain, the pines, the geese, the seal, the sun, the travel speed logic,
the params.

## What changed

1. **Flat lantern.** The additive halo and the glow pool on the water are gone;
   there is no additive light left in the scene. The lantern is a flat red
   paper lantern with ink caps and two faint ribs, hanging from the prow post;
   the kick swells it from ~6 to ~13 units across, and a flat red streak of its
   reflection, broken by the chop, lengthens under it. Red is now the same flat
   ink everywhere: sun, lantern, reflection, seal.
2. **Nearer boat, travelling rings.** Boat scale 1.55 → 2.1, sitting 16 units
   lower. Each kick ring now travels out to ~360 units (V1 stopped at ~130) over
   ~2.5 s, with one echo ring instead of two (with this travel two echoes
   stacked into a target), and its wave displaces the reflections 1.8x harder,
   so you see the far shore's reflection bend as the ring crosses it.
3. **The gorge (new).** Two rows of karst pillars in SDF, uniform arrays like
   the pines: a pale far row (parallax 0.42) behind a dark near row (0.8), each
   slot hashed for existence, width, height, lean and an off-centre domed crown.
   Painted with slanting axe-cut strokes, a dry brush, a shadowed right flank, a
   pooled dark rim and moss dots (tai dian) along the crowns. The drop (with
   hysteresis) sets a target; a mist line sinks from above the frame to the
   water in ~2 s, so the crowns come out first; at the breakdown it rises back
   over ~5 s, so the peaks are the last thing to go. Below the mist line a
   pillar is only a 35% veil over the ranges; at full cover the unrevealed
   bodies cut crisp paper-white pillar holes out of the mountains (seen in the
   first build, fixed). The pillars go through `land()`, so they are reflected
   in the river for free. A new select, *Gorge on the drop* (Off / On the drop /
   Always), lets a performer hold the gorge or keep V1's open river.
4. **Silk stays the default, and the gorge is made for it.** Moonlit silk is
   the default (Raph's call after V1; I briefly switched V2 to Warm paper
   because the panel was shown paper, and reverted). On silk the pillars first
   came out as pale, glowing bone-white towers, because "ink" is pale there. A
   `silk` uniform now paints them as dark masses like the boat and pines: near
   sky-dark bodies, faint strokes on the moonward flank, and a pale rim at the
   edge. The frame still reads as a different place on the drop, and the flat
   lantern and travelling rings read better on silk than on paper. Warm paper
   keeps the dark-ink pillars. The scene has no presets, so none were changed.

Jolt (640×360, seed 1): **calm**. Drop kicks: kickArea 0.148, kickMean 0.037,
driftMean 0.029, ratio 1.26; build kick area 0.064, ratio 0.94. V1 was kickArea
0.039, ratio 1.47. The heat map shows why the area rose: it is the gorge
scrolling past (dark pillars against paper), which is drift, not the kick, and
the ratio fell. The kick itself sits in the boat, lantern and the thin
travelling rings.

## Before/after

- V1 sheet `harness/renders/b3/sumi-720/sheet.png` against V2
  `harness/renders/v2/sumi-720/sheet.png` (Moonlit silk, the default; the paper
  version is `harness/renders/v2/sumi/sheet.png` at 640, rendered before the default was
  reverted): the intro and build (2–8 s) are the
  same scroll with a bigger boat and a flat lantern; from 10 s the V1 drop is
  the same pale scroll plus a red blob, and the V2 drop is a different place.
- The lantern: V1 `harness/renders/b3/sumi-720/frame-12s.png` (the blurred
  red halo over the boat) against V2 `harness/renders/v2/sumi-720/frame-14s.png`
  (a flat lantern with caps and a broken red reflection).
- The gorge arriving and leaving: V2 640 sheet
  `harness/renders/v2/sumi/sheet.png`, 10 s (crowns out of the mist, no holes
  in the ranges), 14 s (full gorge, sun between pillars), 20–24 s (the mist
  taking it back, one crown last).
- Best frame: `harness/renders/v2/sumi-720/frame-14s.png`.
- 96 s: `harness/renders/v2/sumi-96/sheet.png` (each drop a different stretch
  of cliffs).

## What I'd still do

- The gorge arrives a beat early on the test track (its mist starts sinking in
  the last bar of the build, ~9.5 s). I kept it: it reads as the build
  promising the drop. A track with a long snare-roll build might want it later.
- Measure with `harness/fps.mjs`: the pillar loop adds work above the horizon
  and in the reflection (bounding-box rejected per pillar), so expect it to
  cost somewhat more than V1 on the GPU. The SwiftShader numbers during this
  session were taken on a heavily loaded machine and are not comparable.
- A slow bridge or a village on the bank as a second kind of place, alternated
  across drops, if the gorge alone gets familiar across a long set.
