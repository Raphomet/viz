// Generator for lottie4.json ("Riso Jelly"): shape morphing and path modifiers.
//   node web/assets/lottie/gen-lottie4.mjs
// Three blob precomps, each one eight-vertex bezier path keyframed through
// six organic shapes and back (After Effects interpolates matching vertices,
// which is what makes a vector morph read as liquid). The same animated path
// feeds four groups, each under a different path modifier: the ink body under
// a pucker-and-bloat, two contour lines under offset paths, and a ripple line whose offset the
// scene throws outward on a kick. Six instances of the three blobs sit in the
// root comp, multiplied onto paper like riso inks. The scene binds each
// instance's time remap (so each morphs at its own, music-driven pace), its
// place, and the modifiers.
import { writeFileSync } from 'node:fs';
import './kit.js';

const { S, A, T, gr, sh, st, fl, op, pb, ks, shapeLayer, compLayer, comp, smoothPath } = globalThis.VIZ_LOTTIE.author;

const W = 1920, H = 1920, CX = W / 2, CY = H / 2;
const BW = 1500, BC = BW / 2;
const SHAPES = 6, STEP = 60, LEN = SHAPES * STEP;   // one morph cycle: 6 s at 60 fps

// A seeded generator so the blobs are the same every time the file is built.
let seed = 20260929;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function blobShape(R) {
  const n = 8, pts = [];
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    const r = R * (0.68 + rnd() * 0.55);
    pts.push([BC + Math.cos(a) * r, BC + Math.sin(a) * r * (0.8 + rnd() * 0.3)]);
  }
  return smoothPath(pts, true, 1.15);
}
function blobAsset(id, R) {
  const shapes = Array.from({ length: SHAPES }, () => blobShape(R));
  shapes.push(shapes[0]);
  const morph = () => A(shapes.map((s, n) => [n * STEP, [s], [0.45, 0, 0.55, 1]]));
  const line = () => T('ink.line', [0, 0, 0, 1]);
  return {
    id,
    layers: [shapeLayer(id, [
      gr('ripple', [sh(morph()), op(T('ripple.a', 0)), st(line(), T('ripple.w', 5))], { o: T('ripple.o', 0) }),
      // No zig-zag on the contours: after an offset path it ripples every one
      // of the many short segments the offset makes (fur), and before one the
      // offset of its tight ridges throws spikes across the frame.
      gr('outer', [sh(morph()), op(T('outer.a', 84)), st(line(), T('outer.w', 3.2))], { o: T('outer.o', 0) }),
      gr('inner', [sh(morph()), op(T('inner.a', 38)), st(line(), 3.6)]),
      gr('body', [sh(morph()), pb(T('bloat', 0)), fl(T('ink.blob', [1, 0, 0, 1]))]),
    ], { bm: 1 })],
  };
}

const assets = [blobAsset('blob-a', 250), blobAsset('blob-b', 210), blobAsset('blob-c', 290)];
const layers = [];
for (let k = 0; k < 6; k++) {
  layers.push(compLayer('blob ' + k, assets[k % 3].id, BW, BW, {
    tm: T('b.tm.' + k, 0),
    ks: Object.assign(ks(), {
      a: S([BC, BC, 0]),
      p: T('b.p.' + k, [CX, CY, 0]),
      r: T('b.r.' + k, 0),
      s: T('b.s.' + k, [100, 100, 100]),
    }),
  }));
}
const data = comp({ nm: 'Riso Jelly', w: W, h: H, fr: 60, op: 60, assets, layers });
data.vizMeta = { cycle: LEN / 60, blobs: 6 };
const out = new URL('./lottie4.json', import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log('wrote', out.pathname, (JSON.stringify(data).length / 1024).toFixed(0) + ' KB');
