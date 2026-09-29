// Generator for lottie3.json ("Title Sequence"): track mattes.
//   node web/assets/lottie/gen-lottie3.mjs
// Five full-frame pattern plates (stripes, dots, rings, zig-zag, sunburst),
// each a precomp animated by its own repeater offset or modifier, stacked in
// four slots. Every slot but the bottom one is seen only through a track
// matte, which is how a title sequence cuts from one graphic world to the
// next: irises (alpha matte of circles), a travelling venetian blind (alpha
// matte of a repeated slat), and a window whose outside shows another plate
// (inverted alpha matte of a morphing card). A stroke layer on top outlines
// the irises and the window. The scene binds which plate each slot shows, the
// irises, the blind, the window and the plates' own motion.
import { writeFileSync } from 'node:fs';
import './kit.js';

const { S, A, T, gr, el, rc, sr, sh, path, st, fl, rp, zz, ks, shapeLayer, compLayer, comp, circlePath } = globalThis.VIZ_LOTTIE.author;

const W = 1920, H = 1920, CX = W / 2, CY = H / 2;
const PLATES = ['stripes', 'dots', 'rings', 'zigzag', 'sunburst'];
const IRIS = 6;
const LOOP = 480;              // the window morphs through four cards, 120 frames apart

const ink = (tag) => T(tag, [1, 1, 1, 1]);
const bg = (p) => gr('ground', [rc([3400, 3400], [CX, CY]), fl(ink(p + '.a'))]);

// ---- plates --------------------------------------------------------------
const plates = {
  stripes: [shapeLayer('stripes', [
    gr('stripes', [
      gr('stripe', [rc([66, 3600]), fl(ink('stripes.b'))], { p: [-1400, 0] }),
      rp(22, T('stripes.off', 0), { p: [132, 0] }),
    ], { p: [CX, CY], r: 32 }),
    bg('stripes'),
  ])],
  // A row of explicit dots, repeated down the frame: the row repeater's
  // offset slides the whole field diagonally and wraps seamlessly. (A dot
  // repeated by a repeater inside a repeater would clone 961 dots' worth of
  // properties; see gen-lottie2.mjs.)
  dots: [shapeLayer('dots', [
    gr('field', [
      gr('row', Array.from({ length: 34 }, (_, j) => el([58, 58], [-1700 + j * 100, -1500])).concat([fl(ink('dots.b'))])),
      rp(32, T('dots.off', 0), { p: [50, 100] }),
    ], { p: [CX, CY], r: -12 }),
    bg('dots'),
  ])],
  rings: [shapeLayer('rings', [
    gr('rings', Array.from({ length: 22 }, (_, k) => el([90 + k * 124, 90 + k * 124])).concat([
      st(ink('rings.b'), T('rings.w', 34)),
    ]), { p: T('rings.p', [CX, CY]) }),
    bg('rings'),
  ])],
  zigzag: [shapeLayer('zigzag', [
    gr('zigzag', [
      gr('line', [
        sh(path([[-1700, 0], [1700, 0]], null, null, false)),
        zz(T('zigzag.amp', 34), 34, 1),
        st(ink('zigzag.b'), 24, 100, 2, 1),
      ], { p: [0, -1300] }),
      rp(30, T('zigzag.off', 0), { p: [0, 96] }),
    ], { p: [CX, CY], r: -8 }),
    bg('zigzag'),
  ])],
  sunburst: [shapeLayer('sunburst', [
    gr('burst', [
      gr('wedge', [sh(path([[0, 0], [-140, -2200], [140, -2200]])), fl(ink('sunburst.b'))]),
      rp(24, 0, { r: 15 }),
    ], { p: [CX, CY], r: T('sunburst.r', 0) }),
    gr('hub', [el([150, 150]), fl(ink('sunburst.a'))], { p: [CX, CY] }),
    bg('sunburst'),
  ])],
};

// A slot shows one plate: all five are in it, and the scene sets which one
// has opacity.
const SLOTS = ['base', 'iris', 'blind', 'frame'];
const slotAssets = SLOTS.map((s) => ({
  id: 'slot-' + s,
  // The unshown plates are also sent out of range by their time remap
  // (-1 s is before their first frame): lottie-web still evaluates a layer at
  // zero opacity, and the dot plate's 1,088 repeated dots cost ~5 ms a frame
  // even when invisible.
  layers: PLATES.map((pl) => compLayer(pl, pl, W, H, {
    tm: T(s + '.tm.' + pl, 0),
    ks: Object.assign(ks(), { o: T(s + '.show.' + pl, 0) }),
  })),
}));
const slotLayer = (s, o = {}) => compLayer(s, 'slot-' + s, W, H, Object.assign({
  ks: Object.assign(ks(), { o: T(s + '.on', 100) }),
}, o));

// ---- mattes --------------------------------------------------------------
const irisGroups = (style) => Array.from({ length: IRIS }, (_, j) => gr('iris ' + j, [
  el([400, 400]), style(),
], { p: T('iris.p.' + j, [CX, CY]), s: T('iris.s.' + j, [0, 0]) }));
const irisMatte = shapeLayer('iris matte', irisGroups(() => fl([1, 1, 1, 1])), { td: 1 });

const blindMatte = shapeLayer('blind matte', [
  gr('blind', [
    gr('slat', [rc(T('blind.w', [0, 3000])), fl([1, 1, 1, 1])], { p: [-560, 0] }),
    rp(9, 0, { p: [140, 0] }),
  ], { p: T('blind.p', [-1200, CY]), r: 14 }),
], { td: 1 });

// The window: a card that morphs circle, rounded square, lozenge, tall oval.
function card(kind) {
  const R = 520;
  if (kind === 'circle') return circlePath(R, CX, CY);
  const K = 0.5523;
  let rx = R, ry = R, k = K;
  if (kind === 'square') { rx = R * 0.92; ry = R * 0.92; k = 0.95; }
  if (kind === 'lozenge') { rx = R * 1.25; ry = R * 0.8; k = 0.05; }
  if (kind === 'oval') { rx = R * 0.72; ry = R * 1.05; k = K; }
  const v = [[CX, CY - ry], [CX + rx, CY], [CX, CY + ry], [CX - rx, CY]];
  const i = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
  const o = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
  return path(v, i, o, true);
}
const CARDS = ['circle', 'square', 'lozenge', 'oval', 'circle'];
const cardPath = A(CARDS.map((c, n) => [n * (LOOP / 4), [card(c)], [0.7, 0, 0.2, 1]]));
const windowTr = { a: [CX, CY], p: [CX, CY], s: T('window.s', [100, 100]), r: T('window.r', 0) };
const windowMatte = shapeLayer('window matte', [gr('card', [sh(cardPath), fl([1, 1, 1, 1])], windowTr)], { td: 1 });

// Glints (hats): small four-point stars that pop over everything.
const GLINTS = 8;
const glints = Array.from({ length: GLINTS }, (_, j) => gr('glint ' + j, [
  sr({ sy: 1, pt: 4, ir: 11, or: 52 }), fl(ink('glint')),
], { p: T('glint.p.' + j, [CX, CY]), s: T('glint.s.' + j, [0, 0]), r: 45 * (j % 2) }));
const outlines = shapeLayer('outlines', glints.concat(irisGroups(() => st(ink('line'), T('iris.line', 7))))
  .concat([gr('card', [sh(cardPath), st(ink('line'), T('window.line', 9))], windowTr)]));

const data = comp({
  nm: 'Title Sequence', w: W, h: H, fr: 60, op: LOOP,
  assets: PLATES.map((pl) => ({ id: pl, layers: plates[pl] })).concat(slotAssets),
  layers: [
    outlines,
    windowMatte, slotLayer('frame', { tt: 2 }),
    blindMatte, slotLayer('blind', { tt: 1 }),
    irisMatte, slotLayer('iris', { tt: 1 }),
    slotLayer('base'),
  ],
});
data.vizMeta = { plates: PLATES, slots: SLOTS, iris: IRIS, glints: GLINTS };
const out = new URL('./lottie3.json', import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log('wrote', out.pathname, (JSON.stringify(data).length / 1024).toFixed(0) + ' KB');
