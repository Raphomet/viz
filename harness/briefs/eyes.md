# The signature eye

Raph (2026-09-28): "I want to put a signature motif into some of these. My idea
is: we're going to see eyes a lot. Whenever we see eyes, it should be a specific
style of eye. Something weird happening in the pupil or iris or something,
totally unique. Can you make me a gallery of eyes."

The gallery is for choosing: many distinct candidates, each a strong single
idea, so Raph can pick the one (or two) that become viz's signature. After that,
any scene that shows an eye (Ophanim, Iris, the Congregation window, Chomper's
creatures, future scenes) draws it with the chosen style.

## What makes a candidate good

- **One weird idea, in the pupil or the iris**, that reads at a glance and
  rewards staring. The rest of the eye (sclera, lids, lashes, catchlight) is
  well drawn but quiet, so the weird part is the event.
- **Alive and musical**: it blinks, glances, dilates; the idea itself moves
  with the music (kick, bass, hats, beat phase), confined to the eye.
- **Warm or wondrous, never menacing** (harness/TASTE.md: the altered viewer).
  Serene attention, not surveillance; no gore, no bloodshot horror.
- **Ownable**: not a reference to someone else's famous eye (no Eye of
  Sauron, no Illuminati pyramid, no HAL). Our own.
- Works at any size: a 40 px eye in a crowd and a full-screen eye.

Starting points (take, combine or ignore): a pupil that is a window into
another place (a night sky, a tiny Droste of the whole scene); an iris of
concentric record grooves with a tone arm; an iris made of slowly turning
gears or an orrery; a pupil that is a spinning Solid; an iris that blooms like a
flower on the drop; a pupil shaped like a cuttlefish W or a goat's slot that
morphs; two pupils that drift apart and merge (polycoria); an iris of moving
type; an eclipse, with the pupil as the moon and the iris as the corona; a
ferrofluid pupil that spikes with the bass; an iris of Moiré rings; a pupil
that is a keyhole; an iris of pixel-sorted stripes; a pupil with a tiny
dancing figure; a pupil that is a clock.

## The interface

Styles are small files `web/motifs/eyes/<id>.js`:

```js
VIZ_EYES.register({
  id: 'orrery',
  name: 'Orrery',
  idea: 'one sentence: what is weird about it',
  // Draw one eye centred at (x, y), radius r (the eyeball), in p5 2D.
  // t: seconds; a: { bands: Float32Array(9) 0-100, kick, snare, hat (0-1
  // envelopes, the gallery supplies them) }; state: a per-eye object the style
  // may keep anything in (blink timers, particles); look: { x, y } -1..1 gaze.
  draw(p, x, y, r, t, a, state, look) {}
});
```

`web/motifs/eyes.js` defines `window.VIZ_EYES` (register, list, get) and a
shared `blink(state, t)` helper. Styles must set every piece of p5 drawing
state they use and restore it (push/pop). p5 2D only, so any scene can embed
them; a style may use its own offscreen p5.Graphics for effects.

## The gallery scene

`web/scenes/eyes.js`, id `eyes`, name "Eye Gallery", order 609: every
registered style in a grid, each labelled with its name, plus a param to show
one style full-screen. Eyes glance around independently and blink at their own
times. Kicks and bass go to all of them.
