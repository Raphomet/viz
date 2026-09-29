// Generator for lottie2.json ("Rosette"): repeaters.
//   node web/assets/lottie/gen-lottie2.mjs
// A tunnel of layered paper-cut rosettes from one repeater: a polystar ring,
// repeated outward with a scale and a twist per copy. Sliding the repeater's
// offset through 0..1 moves every ring outward to where its neighbour was,
// which is the After Effects repeater's infinite zoom; it loops seamlessly
// because the copies are identical. The ring morphs through four shapes on the
// root timeline. The scene binds the offset (the flight), the points, the
// twist and the bloat, and bakes the inks in.
//
// A first version nested a petal repeater inside the ring repeater. lottie-web
// implements a repeater by cloning its items, properties and all, so 22 x 12
// petals x 3 sets built 14,000 animated properties and took 9 s to load; one
// polystar per ring draws the same rosette from 44 paths.
import { writeFileSync } from 'node:fs';
import './kit.js';

const { S, A, T, gr, el, sr, st, fl, rp, pb, ks, shapeLayer, compLayer, comp } = globalThis.VIZ_LOTTIE.author;

const W = 1920, H = 1920, CX = W / 2, CY = H / 2;
const COPIES = 22;              // rings in the tunnel
const MORPH = 480;              // root timeline: four petal shapes, 120 frames apart

// The ring is one polystar, so a ring of petals is one path: its points, its
// radii and its roundness are all keyframed, which is how it morphs between
// a daisy, a star, a scallop and a cog (four shapes on the root timeline).
function starKeys(prop, vals) {
  return A(vals.map((v, n) => [n * (MORPH / 4), v, [0.6, 0, 0.2, 1]]));
}
//            daisy  star  scallop  cog   daisy
const IR = [   92,    64,   128,    118,   92];
const IS = [    0,     0,   -30,      0,    0];
const OS = [  110,     0,    80,      0,  110];
const star = () => ({
  ty: 'sr', d: 1, sy: 1, pt: T('points', 12), p: S([0, 0]), r: S(0),
  ir: starKeys('ir', IR), is: starKeys('is', IS), or: S(150), os: starKeys('os', OS),
});

// One copy of the tunnel is two bands: A, and B on top of it, a little
// smaller and turned half a point, so the rings alternate inks. The outer
// repeater stacks each copy so that the small, far rings end up on top (in lottie-web that is mode 1, "above"; mode 2 put the largest ring over everything), so the small, far
// rings are on top and each ring shows as a band round the next.
const tunnel = shapeLayer('tunnel', [gr('tunnel', [
  gr('copy', [
    gr('bandB', [star(), pb(T('bloat', 0)), fl(T('ink2', [1, 1, 1, 1])), st(T('ink0', [1, 1, 1, 1]), T('lineW', 2))],
      { s: T('bandB.s', [93, 93]), r: T('bandB.r', 15) }),
    gr('bandA', [star(), pb(T('bloat', 0)), fl(T('ink1', [1, 1, 1, 1])), st(T('ink0', [1, 1, 1, 1]), T('lineW', 2))]),
  ]),
  rp(COPIES, T('off', 0), { s: T('ringScale', [116, 116]), r: T('twist', 6), m: 1 }),
], { p: [CX, CY] })]);

// The medallion: a star under a pucker-bloat, a disc, a small star; the kick
// lands here, and it hides the tunnel's innermost ring being born.
const medallion = shapeLayer('medallion', [
  gr('star', [sr({ sy: 1, pt: 12, ir: 118, or: 168 }), pb(T('medBloat', 8)), fl(T('ink0', [1, 1, 1, 1]))], { r: T('medR', 0) }),
  gr('pips', [
    gr('pip', [el([18, 18]), fl(T('ink3', [1, 1, 1, 1]))], { p: [0, -128] }),
    rp(16, 0, { r: 22.5 }),
  ], { s: T('pips.s', [100, 100]), r: T('pips.r', 0) }),
  gr('disc', [el([200, 200]), fl(T('ink3', [1, 1, 1, 1]))]),
  gr('inner', [sr({ sy: 1, pt: 6, ir: 34, or: 86 }), pb(T('innerBloat', 20)), fl(T('ink2', [1, 1, 1, 1]))], { r: T('innerR', 0) }),
  gr('pip', [el([34, 34]), fl(T('ink0', [1, 1, 1, 1]))]),
], { ks: Object.assign(ks(), { p: S([CX, CY, 0]), s: T('medS', [100, 100, 100]) }) });

// Ripple (snare): a ring that runs out through the tunnel on the same
// exponential as the rings, drawn as a precomp so several can overlap.
const RW = 1920, RC = RW / 2;
const ripple = [shapeLayer('ripple', [gr('ring', [
  el([330, 330]),
  st(T('ink3', [1, 1, 1, 1]), A([[0, 10, 'lin'], [60, 3]])),
], { p: [RC, RC], s: A([[0, [100, 100], 'in'], [60, [1100, 1100]]]), o: A([[0, 100, 'lin'], [50, 100, 'lin'], [60, 0]]) })])];
function slots(n) {
  const out = [];
  for (let j = 0; j < n; j++) out.push(compLayer('ripple ' + j, 'ripple', RW, RW, {
    tm: T('ripple.tm.' + j, -1),
    ks: Object.assign(ks(), { a: S([RC, RC, 0]), p: S([CX, CY, 0]), r: T('ripple.r.' + j, 0) }),
  }));
  return out;
}

const data = comp({
  nm: 'Rosette', w: W, h: H, fr: 60, op: MORPH,
  assets: [{ id: 'ripple', layers: ripple }],
  layers: [medallion].concat(slots(4), [tunnel]),
});
const out = new URL('./lottie2.json', import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log('wrote', out.pathname, (JSON.stringify(data).length / 1024).toFixed(0) + ' KB');
