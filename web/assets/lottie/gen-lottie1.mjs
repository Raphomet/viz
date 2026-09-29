// Generator for lottie1.json ("Line Work"): trim paths.
//   node web/assets/lottie/gen-lottie1.mjs
// Writes Bodymovin JSON beside itself. Every visible stroke here is a trim
// path: the ribbon's dashes are trimmed segments of sixteen parallel strands of
// one trefoil; the snake is the same strands trimmed "individually" (one trim
// running through all of them as a single path); and the three accents (burst,
// pop, tick) are the stock motion-graphics hit animations, drawn on and off by
// trims. The scene binds the strand offsets, dash lengths, stroke weights,
// inks and the accent slots' time remaps to the music (see lottie1.js).
import { writeFileSync } from 'node:fs';
import './kit.js';

const { S, A, T, gr, el, rc, sr, sh, path, st, fl, tm, rp, ks, shapeLayer, compLayer, nullLayer, comp, smoothPath } = globalThis.VIZ_LOTTIE.author;

const W = 1920, H = 1920, CX = W / 2, CY = H / 2;
const STRANDS = 16, GAP = 13;
const LOOP = 120;                      // the root timeline: one bar of dash breathing

// Trefoil centreline, fitted to 1640 x 980 so it fills a 16:9 stage.
function trefoil(n) {
  const pts = [];
  for (let j = 0; j < n; j++) {
    const t = (j / n) * Math.PI * 2;
    pts.push([Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t)]);
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const sx = 1640 / (x1 - x0), sy = 980 / (y1 - y0);
  return pts.map(([x, y]) => [CX + (x - (x0 + x1) / 2) * sx, CY + (y - (y0 + y1) / 2) * sy]);
}
const N = 960;
const centre = trefoil(N);
function offsetCurve(d) {
  return centre.map((p, j) => {
    const a = centre[(j - 1 + N) % N], b = centre[(j + 1) % N];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [p[0] - (ty / l) * d, p[1] + (tx / l) * d];
  });
}
const strandPaths = [];
for (let k = 0; k < STRANDS; k++) {
  const d = (k - (STRANDS - 1) / 2) * GAP;
  const pts = offsetCurve(d).filter((_, j) => j % 6 === 0);   // 160 vertices
  strandPaths.push(smoothPath(pts.map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]), true));
}

const INK = (n) => T('ink' + n, [1, 1, 1, 1]);
const inkOf = (k) => [0, 1, 0, 2][k % 4];

// Dash breathing: each strand's dash swells and shrinks once a bar, the
// strands a little out of step so a wave rolls across the bundle.
function breath(k) {
  const keys = [];
  const shift = (k / STRANDS) * LOOP * 0.75;
  for (let c = -2; c <= 2; c++) {
    const lo = c * LOOP + shift, hi = lo + LOOP / 2;
    keys.push([lo, 22, 'io'], [hi, 100, 'io']);
  }
  keys.sort((a, b) => a[0] - b[0]);
  const k2 = A(keys.map(([t, v, e]) => [+t.toFixed(2), v, e]));
  k2.vz = 'dash.' + k;
  return k2;
}

const track = shapeLayer('track', [
  gr('strands', strandPaths.map((pth) => sh(pth)).concat([st(T('ink3', [1, 1, 1, 1]), T('trackW', 1.5), T('trackO', 30))])),
], { parent: 1 });

const dashes = shapeLayer('dashes', strandPaths.map((pth, k) => gr('strand ' + k, [
  sh(pth),
  tm(0, breath(k), T('off.' + k, 0), 1),
  st(INK(inkOf(k)), T('w.' + k, 9)),
])), { parent: 1 });

// The snake: one trim, mode 2 ("individually"), running through every strand
// as one continuous path, so a single line winds out through the bundle.
const snake = shapeLayer('snake', [
  gr('all', strandPaths.map((pth) => sh(pth)).concat([
    tm(0, T('snakeE', 4), T('snakeOff', 0), 2),
    st(T('ink2', [1, 1, 1, 1]), T('snakeW', 11)),
  ])),
], { parent: 1, ks: Object.assign(ks(), { o: T('snakeO', 0) }) });

// ---- accents -------------------------------------------------------------
const BW = 600, BC = BW / 2;
// Burst: a repeater fan of rays drawn on then off, a ring flying out, a dot.
const burst = [
  shapeLayer('rays', [gr('ray', [
    sh(path([[0, -70], [0, -200]], null, null, false)),
    tm(A([[0, 0, 'out'], [16, 100]]), A([[0, 0], [6, 0, 'io'], [26, 100]]), 0, 1),
    st(T('ink0', [1, 1, 1, 1]), A([[0, 16, 'io'], [26, 6]])),
    rp(10, 0, { r: 36 }),
  ], { p: [BC, BC] })]),
  shapeLayer('ring', [gr('ring', [
    el(A([[0, [30, 30], 'out'], [24, [330, 330]]])),
    tm(0, A([[0, 0, 'out'], [14, 100]]), A([[0, -90, 'out'], [24, 90]]), 1),
    st(T('ink1', [1, 1, 1, 1]), A([[0, 18, 'io'], [24, 0]])),
  ], { p: [BC, BC] })]),
  shapeLayer('dot', [gr('dot', [
    el([46, 46]), fl(T('ink2', [1, 1, 1, 1])),
  ], { p: [BC, BC], s: A([[0, [0, 0], 'back'], [8, [100, 100], 'in'], [20, [0, 0]]]) })]),
];
// Pop (snare): a rounded square drawn round and unwound while it turns, and
// four triangles thrown to the corners.
const pop = [
  shapeLayer('square', [gr('sq', [
    rc([240, 240], [0, 0], 36),
    tm(A([[8, 0, 'io'], [30, 100]]), A([[0, 0, 'out'], [14, 100]]), 45, 1),
    st(T('ink2', [1, 1, 1, 1]), 14),
  ], { p: [BC, BC], r: A([[0, -30, 'out'], [30, 90]]), s: A([[0, [70, 70], 'out'], [30, [135, 135]]]) })]),
  shapeLayer('tris', [gr('tri', [
    gr('one', [
      sr({ sy: 2, pt: 3, or: 22, os: 0 }), fl(T('ink1', [1, 1, 1, 1])),
    ], { p: A([[0, [0, -60], 'out'], [26, [0, -250]]]), r: A([[0, 0, 'out'], [26, 180]]), s: A([[0, [100, 100], 'in'], [26, [0, 0]]]) }),
    rp(4, 0, { r: 90 }),
  ], { p: [BC, BC], r: 45 })]),
];
// Tick (hat): a small plus that pops and turns.
const tick = [
  shapeLayer('plus', [gr('plus', [
    sh(path([[-18, 0], [18, 0]], null, null, false)),
    sh(path([[0, -18], [0, 18]], null, null, false)),
    tm(0, A([[0, 0, 'out'], [8, 100]]), 0, 1),
    st(T('ink3', [1, 1, 1, 1]), 5),
  ], { p: [BC, BC], r: A([[0, 0, 'out'], [22, 90]]), s: A([[0, [60, 60], 'back'], [10, [100, 100], 'in'], [22, [0, 0]]]) })]),
];

// Slots: each accent can fire several times at once, so it is placed as N
// precomp layers whose time remap, position, rotation and scale the scene
// sets when it fires one.
function slots(kind, n) {
  const out = [];
  for (let j = 0; j < n; j++) {
    out.push(compLayer(kind + ' ' + j, kind, BW, BW, {
      parent: 1,
      tm: T(kind + '.tm.' + j, -1),
      ks: Object.assign(ks(), {
        a: S([BC, BC, 0]),
        p: T(kind + '.p.' + j, [CX, CY, 0]),
        r: T(kind + '.r.' + j, 0),
        s: T(kind + '.s.' + j, [100, 100, 100]),
      }),
    }));
  }
  return out;
}

// The rig null carries the whole drawing's slow drift (rotation, scale), and
// everything else is parented to it, so accents stay pinned to the ribbon.
const rig = nullLayer('rig', {
  ks: Object.assign(ks(), {
    a: S([CX, CY, 0]), p: S([CX, CY, 0]),
    r: T('rig.r', 0), s: T('rig.s', [100, 100, 100]),
  }),
});

const data = comp({
  nm: 'Line Work', w: W, h: H, fr: 60, op: LOOP,
  assets: [
    { id: 'burst', layers: burst },
    { id: 'pop', layers: pop },
    { id: 'tick', layers: tick },
  ],
  layers: [rig].concat(slots('tick', 12), slots('pop', 3), slots('burst', 8), [snake, dashes, track]),
});
// Arc-length samples of the centreline (the scene finds a dash's head on it).
data.vizMeta = { strands: STRANDS, loop: LOOP, centre: centre.filter((_, j) => j % 4 === 0).map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]) };

const out = new URL('./lottie1.json', import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log('wrote', out.pathname, (JSON.stringify(data).length / 1024).toFixed(0) + ' KB');
