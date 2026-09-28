# Chomper V2 — redesign note

## The piece in one sentence

An arcade maze that plays itself, then comes loose from the plane on the drop
and folds into a new world, while the board keeps a garden of everything eaten.

## Scope: a few precise changes

Chomper is #4 of 72 (mean 7.5; floor 9, director 9, purist 8). Its soul, the
real game underneath and the fold as the drop, is the thing four judges named
as the collection's best idea and three proposed transplanting elsewhere. A
reconception would throw that away. What the panel found missing is structural,
not visual: the calm sections are "just a game", nothing announces the fold,
and the garden only ever grows. So: two changes to the song-level structure, one
to the build, and nothing touched in the fold, the creatures or the kick.

## Feedback triage

| Point | Who | Verdict | Why |
|---|---|---|---|
| The fold into a torus is a genuine trip moment / the collection's best surprise | psychonaut, curator, designer, floor | Keep | It is the piece. Untouched. |
| A new chapter every drop; variety over 96 s is the benchmark | director, floor, purist | Keep | Chapters stay; V2 adds more variety on top of them, not instead. |
| "The rest is a game" | psychonaut | Reinterpret | The game is the arcade grammar Raph asked to start from and then break. Don't make the calm less of a game; make the calm *end* somewhere strange (the dive) and *begin* to break before the drop (the lift). |
| Accumulation without erasure; give the breakdown a reset ("the maze is re-laid with pellets") | curator, director (theme 7) | Act, my way | Not a re-lay: every breakdown the chomper eats the portal and dives into the next maze. The garden is left behind inside the old world. Erasure, recursion and a new world in one move. |
| Anticipation: the build has no signal that the drop is coming | director (theme 2) | Act | The board starts to lift off the plane through the build, tilting toward the chapter it is about to fold into. |
| Chapter caption per section ("Morning tide") | director (transplant 6) | Reject | Small type is dead type at 3 m (floor's theme 3); the chapters already read as shapes. |
| Cream corridors are bright in a dark room | floor | Reject for the opener, act by rotation | Riso's cream-and-teal is the identity and floor says it's "broken up enough". Diving every breakdown brings Night arcade and Blueprint (dark grounds) into rotation within a minute instead of never. |
| Palette per section is hue cycling by other means | curator (theme 7) | Reject here | The inks change with a *place* (a new maze at a new scale, entered by a visible dive), not with a section clock. |
| The camera is locked | director (theme 6) | Mostly already solved | The fold is the camera move; the build lift adds a slow tilt into perspective before it. |
| Kick ripple + mandibles | (jolt calm in V1) | Keep | Confined and legible. Untouched. |

## The plan

1. **Every breakdown dives into a new maze.** V1 opened the portal only after
   55-110 s of a level, so the dive (the most psychedelic move in the piece,
   and the brief's "eating its way into a new maze at a different scale")
   happened once in 96 s. V2 opens the portal pellet a few tiles ahead of the
   chomper as soon as a drop has spent itself and the board has unfolded; the
   chomper goes for it and the dive follows. The old garden stays behind; the new
   maze arrives clean, at a new scale, in new inks. A floor on level age stops
   short gaps between drops from churning levels; the V1 age fallback remains
   for music with no drops.
2. **The build lifts the board.** A riser detector (treble energy rising while
   the kick average is still low) leans the flat board toward the next
   chapter's camera by up to about a fifth of the way: it tilts into
   perspective and draws back, so the room sees the maze start to come loose
   before the drop. The drop then commits the fold as in V1.
3. Nothing else. The fold, chapters, creatures, garden growth, kick, snare and
   hats stay exactly as V1 had them.

## What changed (after building)

1. **Every breakdown dives into a new maze.** The portal now opens about four
   tiles ahead of the chomper once a drop has peaked (drop energy > 0.6) and
   fallen back below 0.5, provided the level is at least 14 s old; if the
   level is too young the chance is dropped rather than carried into the
   next build. A chomper caught while the portal is open reappears three
   tiles from it, so a catch can't push the dive into the intro. The 110 s
   fallback and the "Dive into a new maze" action are unchanged.
2. **The build lifts the board.** A first attempt leaned toward each
   chapter's own camera and was invisible (the staged mix barely moves at a
   fifth). It is now its own pose (`liftCfg`): pitch 0.62, walls 0.5 tall,
   gentle perspective, a slow sway. It is driven by a slow treble "rise"
   envelope, only while a drop is armed. The drop then mixes from that pose
   into the chapter.
3. Everything else is V1: the game, chapters, creatures, garden, kick, snare,
   hats and inversion.

## Before/after

- **Build** (`harness/renders/v2/chomper/frame-08s.png` against V1
  `harness/renders/sk/chomper-720/frame-08s.png`): V1 is the same flat top-down
  view as its intro. In V2 the maze tilts into perspective and its walls stand
  up out of the print two seconds before the drop, which says "something is
  coming". At 10 s the fold arrives from the tilt.
- **Breakdown** (V2 sheet, 20–24 s): the flowered board unfolds at 20 s with
  the portal disc already in view. At 22 s the chomper is at the portal, and at
  24 s it dives into the terracotta maze. In V1 the whole breakdown was the same
  flowered maze.
- **96 s** (`harness/renders/v2/chomper-96/sheet.png` against V1's): V1 spent
  84 s in one Riso maze, its garden growing until the single dive at about
  80 s. V2 goes through four worlds: Riso torus (12 s), terracotta tabletop
  (36 s), a terracotta maze with the next portal open (48 s), a Night arcade
  tunnel (60 s, the first dark ground), a dive into Blueprint (72 s), a
  Blueprint drum (84 s) and a clean Blueprint maze (96 s). Every intro starts
  on a garden no more than one cycle old. This sheet was rendered just before
  the last small tweak (portal four tiles away instead of six, and the
  respawn near the portal). It shows the second and third dives running a few
  seconds into the next intro, which is what that tweak addresses. The
  1280x720 run was rendered after the tweak.
- **Jolt** (640x360, seed 1): calm. kickArea 0.213, kickMean 0.049, drift
  0.046, ratio 1.05 (V1: 0.211 / 0.048 / 1.04). The build kick is area 0.35 and
  ratio 1.25, because the lift is moving at 9.5 s; V1 reported area 0.69 there
  because its torus was folding.
- Clean runs at 640x360 (24 s and 96 s) and 1280x720: no console errors, no
  exceptions.

## What I'd still do

- Check the dive timing against real tracks with long breakdowns. On the
  harness track's 6 s breakdown the dive only just fits.
- The dive's outer ring upscales the old board and goes soft (24 s). This is
  inherited from V1. Redrawing the outer board from the vector cache at the
  zoom scale would keep it crisp.
- Verify the tweaked portal timing with one more 96 s run when the machine is
  free.

