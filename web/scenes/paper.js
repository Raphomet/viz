// Paper — a cut-paper theatre you travel into.
//
// A diorama of paper flats in the tradition of Lotte Reiniger's silhouette
// films and kirigami: a painted paper sky with pin-prick stars and a paper
// moon, far mountains, then eight flats of forest (firs, lollipop trees with
// leaf cutouts, meadows, canopy arches) standing at different depths. The
// camera walks into the forest: each flat grows as it approaches, passes
// overhead and is recycled to the back, so the flats read as a tunnel of paper
// you keep falling into.
//
// Craft notes:
// - Every flat is a set of Path2D shapes in world units, projected with one
//   transform (scale F/z about the horizon), so edges stay crisp at any
//   distance and the grain pattern scales with the sheet. Each flat is one
//   nonzero fill (union of ground, trees and arch; kirigami holes are wound
//   backwards so they cut through), one grain fill and one edge stroke.
// - The shadow slot does double duty: at rest it is a dark offset drop shadow
//   (the flats stand in front of each other), in the drop it becomes a warm
//   glow with no offset, so the same silhouettes are lit from behind and every
//   edge rims with light. That is the drop's "backlight".
// - Music is found as onsets against slow baselines (the Aurora listener) and
//   handed to characters rather than to the frame: kicks make one paper rabbit
//   leap (the only thing a kick moves), claps flush a flock of paper birds out
//   of the trees, hats re-deal which fireflies and pin-prick stars flash, the
//   bass sways the trees on their rods, and the drop lights the theatre from
//   behind and speeds the walk.
// - Creatures are animated on twos (12 poses a second) like stop-motion
//   puppets; the camera and the flats move smoothly, because stepping the
//   travel made the whole frame judder.

(function () {
  'use strict';

  const TAU = Math.PI * 2;

  // Each palette is one lit backdrop and one family of paper for the flats.
  // `glow` is the backlight colour in the drop, chosen against the sky.
  const PALETTES = [
    { name: 'Moonlit',
      skyTop: '#060920', skyMid: '#1b2a58', horizon: '#6d9ac4', horizonAlt: '#8e88c9',
      dropHorizon: '#ffb46e', dropSky: '#9c3f86',
      near: '#0b0e22', far: '#3a5888', mountain: '#4a6a98',
      glow: '#ffc27a', moon: '#f6eed6', rabbit: '#f3e8cf', bird: '#0a0c1b', firefly: '#ffe79a', star: '#fff6dc' },
    { name: 'Reiniger',
      skyTop: '#2a0806', skyMid: '#8c2c14', horizon: '#f0a040', horizonAlt: '#f5c060',
      dropHorizon: '#fff2b8', dropSky: '#d23c52',
      near: '#040202', far: '#3a130a', mountain: '#6e2610',
      glow: '#ffe2a0', moon: '#fff2d2', rabbit: '#f8e2b6', bird: '#050202', firefly: '#fff0b0', star: '#ffe6bc' },
    { name: 'Dusk',
      skyTop: '#16061f', skyMid: '#521a56', horizon: '#dc6e8a', horizonAlt: '#ee9868',
      dropHorizon: '#86f2e2', dropSky: '#3452c8',
      near: '#0b0411', far: '#673876', mountain: '#874684',
      glow: '#86f6e6', moon: '#ffe8da', rabbit: '#fbe6da', bird: '#10041a', firefly: '#bafff2', star: '#ffe2f2' },
    { name: 'Emerald',
      skyTop: '#021210', skyMid: '#0b3834', horizon: '#56b698', horizonAlt: '#8cc6a0',
      dropHorizon: '#ffe072', dropSky: '#a446b8',
      near: '#010705', far: '#1e5848', mountain: '#2c7862',
      glow: '#ffe07a', moon: '#f2f6d8', rabbit: '#eef0dc', bird: '#020f0b', firefly: '#e4ff8a', star: '#f0ffe8' },
  ];

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const PAL = PALETTES.map((src) => {
    const o = { name: src.name };
    for (const k in src) if (k !== 'name') o[k] = hex(src[k]);
    return o;
  });
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // World: 1 unit = the short side at depth 1. The camera stands CAM_H above
  // the ground plane looking level at the horizon.
  const F = 600;
  const CAM_H = 0.3;
  const NL = 8;          // flats in flight
  const DZ = 0.5;        // spacing between flats
  const ZNEAR = 0.2;
  const ZFAR = ZNEAR + NL * DZ;
  const ZR = 1.05;       // the rabbit's depth
  const NFLY = 90;

  // --- Paper shapes. All outlines wind clockwise on screen (y down) and all
  // cutouts anticlockwise, so one nonzero fill unions the solids and punches
  // the holes.

  function ellipseSub(P, cx, cy, rx, ry, rot, hole) {
    P.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot));
    P.ellipse(cx, cy, rx, ry, rot, 0, TAU, !!hole);
    P.closePath();
  }

  function firPath(r, h) {
    const P = new Path2D();
    const tw = h * 0.03, n = 3 + ((r() * 3) | 0), base = -h * 0.12;
    const W = h * (0.19 + r() * 0.09);
    const left = [[-tw, 0], [-tw, base]];
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const yb = base + (-h - base) * f;
      const yt = base + (-h - base) * (i + 1) / n;
      const w = W * (1 - f * 0.82) * (0.9 + r() * 0.2);
      left.push([-w, yb + (yb - yt) * 0.12]);                 // drooping tier tip
      left.push([-w * 0.5, yb - (yb - yt) * 0.5]);            // notch
    }
    P.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) P.lineTo(left[i][0], left[i][1]);
    P.lineTo(0, -h);
    for (let i = left.length - 1; i >= 0; i--) P.lineTo(-left[i][0] * (0.94 + 0.12 * ((i * 7919) % 5) / 5), left[i][1]);
    P.closePath();
    // Kirigami: small diamonds cut down the spine.
    for (let i = 1; i < n - 1; i++) {
      if (r() < 0.45) continue;
      const yc = base + (-h - base) * (i + 0.45) / n;
      const s = h * 0.012 * (1 - i / n + 0.3);
      P.moveTo(0, yc - s * 1.6);
      P.lineTo(-s, yc);
      P.lineTo(0, yc + s * 1.6);
      P.lineTo(s, yc);
      P.closePath();
    }
    return P;
  }

  function roundPath(r, h, tall) {
    const P = new Path2D();
    const tw = h * 0.035;
    const R = h * (tall ? 0.13 + r() * 0.04 : 0.2 + r() * 0.08);
    const ys = tall ? 2.6 : 1.08;
    const cy = -h + R * ys;
    P.moveTo(-tw * 1.4, 0);
    P.lineTo(-tw * 0.8, cy + R * 0.4);
    P.lineTo(-tw * 0.5, cy);
    P.lineTo(tw * 0.5, cy);
    P.lineTo(tw * 0.8, cy + R * 0.4);
    P.lineTo(tw * 1.4, 0);
    P.closePath();
    // Crown: a scalloped blob, like leaves cut with scissors.
    const k = 10 + ((r() * 8) | 0), a = r() * TAU, b = r() * TAU;
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU;
      const rr = R * (0.9 + 0.1 * Math.abs(Math.sin(th * k * 0.5 + a)) + 0.05 * Math.sin(th * 3 + b));
      const x = Math.cos(th) * rr, y = cy + Math.sin(th) * rr * ys;
      if (i === 0) P.moveTo(x, y); else P.lineTo(x, y);
    }
    P.closePath();
    // Leaf cutouts in rings, the kirigami detail that rewards a close look.
    const rings = tall ? [[0.45, 5]] : [[0.36, 5 + ((r() * 3) | 0)], [0.68, 9 + ((r() * 4) | 0)]];
    for (const [rf, cnt] of rings) {
      const off = r() * TAU;
      for (let j = 0; j < cnt; j++) {
        const th = off + (j / cnt) * TAU;
        const x = Math.cos(th) * R * rf, y = cy + Math.sin(th) * R * rf * ys;
        ellipseSub(P, x, y, R * 0.11, R * 0.045, th, true);
      }
    }
    return P;
  }

  function mushroomPath(r, h) {
    const P = new Path2D();
    const w = h * 0.12, hs = h * 0.6, cw = h * (0.35 + r() * 0.2), ch = h * 0.42;
    P.moveTo(-w, 0);
    P.lineTo(-w, -hs);
    P.lineTo(-cw, -hs);
    for (let i = 1; i < 16; i++) {
      const th = Math.PI + (i / 16) * Math.PI;
      P.lineTo(Math.cos(th) * cw, -hs + Math.sin(th) * ch);
    }
    P.lineTo(cw, -hs);
    P.lineTo(w, -hs);
    P.lineTo(w, 0);
    P.closePath();
    ellipseSub(P, -cw * 0.35, -hs - ch * 0.45, h * 0.06, h * 0.06, 0, true);
    ellipseSub(P, cw * 0.3, -hs - ch * 0.3, h * 0.045, h * 0.045, 0, true);
    return P;
  }

  // A canopy spanning the top of the flat: a scalloped lower edge with vines,
  // high in the middle, so a run of them reads as a tunnel of branches.
  function archPath(r, HW) {
    const P = new Path2D();
    const peak = 0.95 + r() * 0.3, side = 0.5 + r() * 0.18, span = 0.7 + r() * 0.5;
    const top = 5;
    const edge = (x) => {
      const q = x / span;
      return side + (peak - side) * Math.max(0, 1 - q * q) - 0.03 * Math.abs(Math.sin(x * 23));
    };
    P.moveTo(-HW, -top);
    P.lineTo(HW, -top);
    const step = 0.012;
    for (let x = HW; x >= -HW; x -= step) {
      const y = edge(x);
      P.lineTo(x, -y);
      if (Math.abs(x) < span * 1.3 && r() < 0.06) {
        const L = 0.08 + r() * 0.22, w = 0.004;
        P.lineTo(x - w, -y + L);
        // a leaf at the end of the vine
        P.lineTo(x - w - 0.012, -y + L + 0.02);
        P.lineTo(x - w, -y + L + 0.045);
        P.lineTo(x - 2 * w, -y);
      }
    }
    P.lineTo(-HW, -top);
    P.closePath();
    // Leaf cutouts along the underside of the canopy.
    for (let i = 0; i < 40; i++) {
      const x = (r() * 2 - 1) * span * 1.4;
      const y = edge(x) + 0.05 + r() * 0.2;
      ellipseSub(P, x, -y, 0.022, 0.009, r() * TAU, true);
    }
    return P;
  }

  function buildLayer(seed, HW) {
    const r = rng(seed);
    const kindR = r();
    const kind = kindR < 0.4 ? 'firs' : kindR < 0.78 ? 'grove' : 'meadow';
    const L = { seed, kind, trees: [], xoff: (r() * 2 - 1) * 0.06, tint: r() * 2 - 1, arch: null };
    const clear = (kind === 'meadow' ? 0.45 : 0.34) + r() * 0.14;
    const hillAmp = (kind === 'meadow' ? 0.14 : 0.05) + r() * 0.16;
    const ph1 = r() * 100, ph2 = r() * 100;
    const gy = (x) => {
      const e = smooth(clear * 0.6, clear + 0.35, Math.abs(x));
      return e * hillAmp * (0.6 + 0.4 * Math.sin(x * 1.7 + ph1)) + 0.02 * Math.sin(x * 9 + ph2) * (0.3 + e);
    };
    const G = new Path2D();
    G.moveTo(-HW, 5);
    const step = 0.015;
    for (let x = -HW; x <= HW + 1e-6; x += step) {
      const y = gy(x);
      G.lineTo(x, -y);
      // Grass tufts, thicker at the edges of the clearing.
      const d = Math.abs(x);
      const pr = d < clear * 0.4 ? 0.02 : d < clear + 0.5 ? 0.16 : 0.05;
      if (r() < pr) {
        const hb = 0.02 + r() * 0.045, n = 2 + ((r() * 3) | 0);
        for (let j = 0; j < n; j++) {
          const bx = x + j * 0.006, lean = (r() - 0.5) * 0.03;
          G.lineTo(bx + lean, -y - hb * (0.6 + r() * 0.4));
          G.lineTo(bx + 0.005, -y);
        }
      }
    }
    G.lineTo(HW, 5);
    G.closePath();
    L.ground = G;

    for (const side of [-1, 1]) {
      let x = clear + r() * 0.08;
      while (x < HW) {
        const X = side * x;
        let h, path, flex;
        if (kind === 'meadow' && x < clear + 0.6 && r() < 0.7) {
          h = 0.12 + r() * 0.2;
          path = r() < 0.5 ? roundPath(r, h, false) : firPath(r, h);
          flex = 0.6;
        } else if (kind === 'firs' || (kind === 'grove' && r() < 0.25)) {
          h = r() < 0.15 ? 0.9 + r() * 0.35 : 0.35 + r() * 0.5;
          path = firPath(r, h);
          flex = 1;
        } else {
          const tall = r() < 0.3;
          h = (tall ? 0.55 : 0.3) + r() * 0.45;
          path = roundPath(r, h, tall);
          flex = 1;
        }
        L.trees.push({ x: X, y: -gy(X), path, flex, phase: r() * TAU });
        x += (0.14 + r() * 0.24) * (1 + x * 0.45) * (kind === 'meadow' ? 1.5 : 1);
      }
      // Mushrooms at the edge of the path.
      if (r() < 0.7) {
        const X = side * (clear * (0.55 + r() * 0.5));
        L.trees.push({ x: X, y: -gy(X), path: mushroomPath(r, 0.025 + r() * 0.03), flex: 0, phase: 0 });
      }
    }
    if (kind !== 'meadow' && r() < 0.55) L.arch = archPath(r, HW);
    return L;
  }

  // Paper grain: fibres, specks and a soft mottle, light and dark on
  // transparent, laid over every sheet as a pattern.
  function makeGrain() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const r = rng(77);
    // Low-frequency mottle from a coarse random grid, bilinear.
    const M = 8, grid = [];
    for (let i = 0; i < M * M; i++) grid.push(r() * 2 - 1);
    const at = (i, j) => grid[((j + M) % M) * M + ((i + M) % M)];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const gx = (x / S) * M, gyy = (y / S) * M;
        const i = Math.floor(gx), j = Math.floor(gyy), fx = gx - i, fy = gyy - j;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const m = (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
        const v = (r() * 2 - 1) * 0.6 + m * 0.25;
        const k = (y * S + x) * 4;
        const w = v > 0 ? 255 : 0;
        img.data[k] = w; img.data[k + 1] = w; img.data[k + 2] = w;
        img.data[k + 3] = Math.min(255, Math.abs(v) * 90);
      }
    }
    g.putImageData(img, 0, 0);
    // Fibres.
    g.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = r() * S, y = r() * S, a = r() * TAU, l = 4 + r() * 14;
      g.strokeStyle = r() < 0.7 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)';
      g.lineWidth = 0.6 + r() * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 4,
        x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return c;
  }

  function makeSprite(col) {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.12, rgba(mix(col, [255, 255, 255], 0.5), 0.95));
    grd.addColorStop(0.35, rgba(col, 0.35));
    grd.addColorStop(1, rgba(col, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return c;
  }

  VIZ.register({
    id: 'paper',
    name: 'Paper',
    order: 309,

    params: [
      { key: 'palette', label: 'Paper', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Walk speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'wind', label: 'Wind', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'backlight', label: 'Backlight', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'life', label: 'Creatures', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'grain', label: 'Paper grain', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Paper',
      technique: 'Canvas 2D cut-paper theatre: eight Path2D forest flats projected by depth (one nonzero fill each, kirigami holes wound backwards), a shared paper-grain pattern, drop shadows that turn into backlight glow, stop-motion creatures animated on twos, onset detection against slow baselines',
      brief: 'A cut-paper theatre you walk into: a painted paper sky with pin-prick stars and a paper moon, torn-paper mountains, and eight forest flats (firs with diamond cutouts, lollipop trees with rings of leaf cutouts, meadows, canopy arches hung with vines) that grow as you approach, pass overhead and are recycled to the back, so the forest never ends. Every sheet has grain and a soft drop shadow. A cream paper rabbit runs with you along the path: each kick makes it leap (the only thing a kick moves), animated on twos like a stop-motion puppet. Each clap flushes a flock of paper birds out of one side of the forest; hats re-deal which fireflies and stars flash; the bass sways the trees on their rods and quickens the walk. The drop lights the theatre from behind: the sky warms to amber and rose, the shadows turn into glowing rims around every silhouette, fireflies multiply and the walk speeds up. The breakdown goes back to a cool, moonlit blue.',
      lineage: [
        'Brief 09 (batch 03): Lotte Reiniger silhouettes and kirigami, layered flats with drop shadows and grain, a camera travelling into the forest, one creature hopping to the kick.',
        'Approach: Canvas 2D rather than WebGL, because paper is flat shapes with crisp edges. Each flat is Path2D in world units projected by one transform (scale F/z about the horizon), so edges stay sharp at any depth and the grain pattern scales with the sheet. Kirigami holes are wound anticlockwise so one nonzero fill unions the solids and cuts the holes.',
        'v1: forest far too dense (clearing 0.17-0.29, trees up to 1.25 tall), so the sky and moon were hidden and near trees swept across half the frame as dark slabs; the drop edge-stroke drew every internal subpath outline (tree bases buried in the ground) as glowing boxes, and the diamond cutouts were huge up close.',
        'v2: clearing widened to 0.34-0.48, trees lowered and spaced out, edge stroke removed (the backlight is now only the shadow slot turned into a glow, which follows the outer silhouette), cutouts shrunk, birds changed from dark to cream paper and drawn in front so a clap reads. It became a diorama: moonlit tunnel at rest, amber-backlit in the drop.',
        'Jolt: kickArea 0.27 with ratio 1.1; the rabbit was already the only kick hot spot, and runs with wind 0, grain 0 and speed 0 showed the area was the walk itself (speed 0: area 0.056, all rabbit). Trimmed the drop walk speed (0.2 to 0.12 z/s extra) and the bass sway; rabbit made larger (0.19 world) with a higher leap. Final: kickArea 0.24, verdict calm, build kick 0.13.',
        '1280x720 check: the rabbit\'s outline stroke drew the seams between its overlapping ellipses, the same buried-subpath problem as v1; removed, it is now one clean sheet with a cut-out eye.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.z0 = 0;          // distance walked
      this.layers = null;
      this.seedN = 1;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.hop = { t0: -9, amp: 0 };
      this.facing = 1;
      this.birds = [];
      this.flies = null;
      this.spriteFor = -1;
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      // Kick: band 0 leading band 1, so the bass line's own notes don't hop.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        const u = (this.T - this.hop.t0) / 0.36;
        if (u > 0.75) this.hop = { t0: this.T, amp: kRaw };
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.7, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.snareHit = 0.6 + 0.4 * sRaw;
      }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw * Math.min(1, push), e.snare * Math.exp(-dt / 0.16));

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.2, dt);
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      this.T += dt;
      const T = this.T;
      const push = params.push;
      const pal = PAL[Math.max(0, Math.min(PAL.length - 1, Math.round(params.palette)))];
      const pxs = (p.width * p.pixelDensity()) / W;

      if (!this.grainCanvas) this.grainCanvas = makeGrain();
      if (!this.pattern) this.pattern = g.createPattern(this.grainCanvas, 'repeat');
      const pat = this.pattern;
      const palIdx = PAL.indexOf(pal);
      if (this.spriteFor !== palIdx) { this.sprite = makeSprite(pal.firefly); this.spriteFor = palIdx; }

      this.snareHit = 0;
      this.listen(signals, dt, push);
      const e = this.env;
      const dropB = clamp01(e.drop * params.backlight);
      const light = clamp01(dropB + Math.max(0, params.backlight - 1) * 0.35);

      // --- Travel. The music changes the walking pace, never jerks it.
      const vTarget = (0.06 + 0.05 * e.bass + 0.12 * e.drop) * params.speed;
      this.v = this.v === undefined ? vTarget : ease(this.v, vTarget, 0.8, dt);
      const camX = 0.08 * Math.sin(T * 0.071) + 0.04 * Math.sin(T * 0.023 + 1);
      const cx = W / 2, hy = H * 0.52;
      const HW = ((W / 2) / F) * ZFAR * 1.1 + 0.6;

      if (!this.layers || Math.abs(this.layersHW - HW) > 0.3) {
        this.layers = [];
        this.layersHW = HW;
        for (let i = 0; i < NL; i++) {
          const L = buildLayer(this.seedN++, HW);
          L.z = ZNEAR + DZ * (i + 0.5);
          this.layers.push(L);
        }
      }
      for (const L of this.layers) {
        L.z -= this.v * dt;
        if (L.z < ZNEAR) {
          const z = L.z + NL * DZ;
          const nL = buildLayer(this.seedN++, HW);
          Object.assign(L, nL);
          L.z = z;
        }
      }
      if (!this.flies) {
        const r = rng(4242);
        this.flies = [];
        for (let i = 0; i < NFLY; i++) {
          this.flies.push({ z: ZNEAR + r() * (ZFAR - ZNEAR), u: r() * 2 - 1, Y: 0.03 + r() * 0.5, ph: r() * TAU, sp: 0.5 + r() });
        }
      }
      for (const f of this.flies) {
        f.z -= this.v * dt;
        if (f.z < ZNEAR + 0.05) { f.z += ZFAR - ZNEAR - 0.1; f.u = Math.random() * 2 - 1; }
      }

      // --- Birds: a clap flushes a flock out of one side of the forest.
      if (this.snareHit > 0 && params.life > 0) {
        const r = Math.random;
        const side = r() < 0.5 ? -1 : 1;
        const n = Math.round((4 + r() * 5) * Math.min(1.5, params.life) * this.snareHit);
        const bx = cx + side * W * (0.16 + r() * 0.2), by = hy - 30 - r() * 90;
        for (let i = 0; i < n; i++) {
          this.birds.push({
            x: bx + (r() - 0.5) * 60, y: by + (r() - 0.5) * 40,
            vx: -side * (20 + r() * 60) + (r() - 0.5) * 40, vy: -(50 + r() * 70),
            size: 14 + r() * 8, ph: (r() * 4) | 0, age: 0,
          });
        }
        if (this.birds.length > 70) this.birds.splice(0, this.birds.length - 70);
      }
      for (const b of this.birds) {
        b.age += dt;
        b.vy -= 25 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
      }
      this.birds = this.birds.filter((b) => b.age < 3.4 && b.y > -40);

      // --- Colours for this moment.
      const horizon = mix(mix(pal.horizon, pal.horizonAlt, 0.5 + 0.5 * Math.sin(T / 41)), pal.dropHorizon, light * 0.8);
      const skyMid = mix(pal.skyMid, pal.dropSky, light * 0.65);

      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.shadowColor = 'rgba(0,0,0,0)';
      g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
      g.lineJoin = 'round';
      g.lineCap = 'round';

      // --- Sky.
      const sky = g.createLinearGradient(0, 0, 0, hy + 40);
      sky.addColorStop(0, rgba(pal.skyTop, 1));
      sky.addColorStop(0.55, rgba(skyMid, 1));
      sky.addColorStop(1, rgba(horizon, 1));
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      const moonX = cx + W * 0.13 - camX * 12, moonY = hy * 0.42, moonR = 34;
      // The lamp behind the theatre: a broad warm light rising in the drop.
      const lampA = 0.12 + 0.55 * light;
      const lamp = g.createRadialGradient(cx, hy, 0, cx, hy, W * 0.6);
      lamp.addColorStop(0, rgba(pal.glow, lampA));
      lamp.addColorStop(0.5, rgba(pal.glow, lampA * 0.3));
      lamp.addColorStop(1, rgba(pal.glow, 0));
      g.fillStyle = lamp;
      g.fillRect(0, 0, W, H);

      // Pin-prick stars; hats re-deal which of them flash.
      if (!this.stars) {
        const r = rng(99);
        this.stars = [];
        for (let i = 0; i < 160; i++) this.stars.push({ x: r(), y: Math.pow(r(), 1.3), s: 0.5 + r() * 1.1, ph: r() * TAU });
      }
      g.fillStyle = rgba(pal.star, 1);
      for (let i = 0; i < this.stars.length; i++) {
        const st = this.stars[i];
        const x = st.x * W, y = st.y * hy * 0.95;
        const glint = hash2(i, this.hatSeed) > 0.82 ? e.hat * Math.min(1.5, push) : 0;
        const a = (0.25 + 0.25 * Math.sin(T * 1.3 + st.ph)) * (1 - 0.5 * light) + glint;
        if (a <= 0.02) continue;
        g.globalAlpha = clamp01(a);
        const sz = st.s * (1 + glint * 1.6);
        g.beginPath();
        g.arc(x, y, sz, 0, TAU);
        g.fill();
        if (glint > 0.3) { g.fillRect(x - sz * 3, y - 0.3, sz * 6, 0.6); g.fillRect(x - 0.3, y - sz * 3, 0.6, sz * 6); }
      }
      g.globalAlpha = 1;

      // Paper moon with halo sheets.
      for (let i = 3; i >= 1; i--) {
        g.fillStyle = rgba(mix(pal.moon, pal.glow, light * 0.6), 0.05 + 0.03 * light + 0.02 * e.bass);
        g.beginPath();
        g.arc(moonX, moonY, moonR * (1 + i * (0.55 + 0.15 * light)), 0, TAU);
        g.fill();
      }
      g.shadowColor = rgba(mix(pal.moon, pal.glow, light), 0.7);
      g.shadowBlur = (18 + 30 * light) * pxs;
      g.fillStyle = rgba(pal.moon, 1);
      g.beginPath();
      g.arc(moonX, moonY, moonR, 0, TAU);
      g.fill();
      g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0;

      // Far mountains, two ranges of torn paper.
      if (!this.mount || this.mountW !== W) {
        this.mountW = W;
        const r = rng(7);
        this.mount = [0, 1].map((k) => {
          const P = new Path2D();
          const x0 = -200, x1 = W + 200, amp = k === 0 ? 85 : 50, ph = r() * 10;
          P.moveTo(x0, H);
          for (let x = x0; x <= x1; x += 6) {
            const q = x / W;
            const y = -amp * (0.55 + 0.3 * Math.sin(q * 5.1 + ph) + 0.18 * Math.sin(q * 13.7 + ph * 2) + 0.06 * Math.sin(q * 41 + ph));
            P.lineTo(x, y + (r() - 0.5) * 1.5);
          }
          P.lineTo(x1, H);
          P.closePath();
          return P;
        });
      }
      for (let k = 0; k < 2; k++) {
        const col = mix(mix(horizon, pal.mountain, k === 0 ? 0.45 : 0.8), pal.far, k * 0.3);
        g.save();
        g.translate(-camX * (k === 0 ? 15 : 35), hy + 12 + k * 14);
        g.fillStyle = rgba(col, 1);
        g.shadowColor = light > 0.3 ? rgba(pal.glow, 0.8 * (light - 0.3) / 0.7) : 'rgba(0,0,0,0)';
        g.shadowBlur = 16 * pxs;
        g.fill(this.mount[k]);
        g.restore();
      }
      if (params.grain > 0) {
        pat.setTransform(new DOMMatrix().scale(0.6));
        g.globalAlpha = clamp01(0.28 * params.grain);
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }

      // --- Flats, far to near, with the rabbit, fireflies and birds slotted in
      // at their depths.
      const layers = this.layers.slice().sort((a, b) => b.z - a.z);
      const swayK = params.wind * (0.014 + 0.045 * e.bass + 0.012 * e.drop);
      const nFly = Math.round((20 + 55 * e.drop) * params.life);
      let rabbitDrawn = false;
      let flyZ = ZFAR + 1;

      const drawFlies = (zHi, zLo) => {
        if (nFly <= 0) return;
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < nFly && i < NFLY; i++) {
          const f = this.flies[i];
          if (!(f.z <= zHi && f.z > zLo)) continue;
          const s = F / f.z;
          const X = f.u * 2.2 + 0.05 * Math.sin(T * 0.4 * f.sp + f.ph);
          const Y = f.Y + 0.03 * Math.sin(T * 0.9 * f.sp + f.ph * 2);
          const x = cx + (X - camX) * s, y = hy + (CAM_H - Y) * s;
          const fog = clamp01((f.z - 0.5) / (ZFAR - 0.5));
          const glint = hash2(i + 500, this.hatSeed) > 0.7 ? e.hat * Math.min(1.5, push) : 0;
          const a = (0.45 + 0.35 * Math.sin(T * 2.1 * f.sp + f.ph)) * (1 - 0.5 * fog) * smooth(ZNEAR, ZNEAR + 0.25, f.z) + glint;
          if (a < 0.02) continue;
          const rad = (0.026 * s) * (1 + glint * 1.2);
          g.globalAlpha = clamp01(a);
          g.drawImage(this.sprite, x - rad, y - rad, rad * 2, rad * 2);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      };

      for (const L of layers) {
        drawFlies(flyZ, L.z);
        flyZ = L.z;
        if (!rabbitDrawn && L.z < ZR) {
          this.drawRabbit(g, pal, light, pxs, T, camX, cx, hy, push, params, pat);
          rabbitDrawn = true;
        }
        this.drawLayer(g, L, pal, horizon, light, pxs, T, camX, cx, hy, swayK, params, pat);
      }
      drawFlies(flyZ, 0);
      this.drawBirds(g, pal, light, pxs, T);
      if (!rabbitDrawn) this.drawRabbit(g, pal, light, pxs, T, camX, cx, hy, push, params, pat);

      // Proscenium: the dark edge of the box the theatre stands in.
      const vig = g.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.45, cx, H * 0.5, Math.hypot(W, H) * 0.62);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = vig;
      g.fillRect(0, 0, W, H);

      g.restore();
    },

    drawLayer(g, L, pal, horizon, light, pxs, T, camX, cx, hy, swayK, params, pat) {
      const z = L.z;
      const s = F / z;
      const alpha = smooth(ZFAR, ZFAR - DZ * 0.9, z) * smooth(ZNEAR, ZNEAR + 0.24, z);
      if (alpha <= 0.003) return;
      const fog = Math.pow(clamp01((z - 0.45) / (ZFAR - 0.45)), 0.8);
      let col = mix(pal.near, pal.far, fog);
      col = mix(col, horizon, fog * fog * 0.35);
      col = mix(col, L.tint > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(L.tint) * 0.05);
      col = mix(col, pal.glow, 0.1 * light * (1 - fog * 0.5));

      const P = new Path2D();
      P.addPath(L.ground);
      for (const t of L.trees) {
        if (t.flex === 0) { P.addPath(t.path, new DOMMatrix([1, 0, 0, 1, t.x, t.y])); continue; }
        const a = t.flex * swayK * (Math.sin(T * 0.75 + t.phase) + 0.35 * Math.sin(T * 1.6 + t.phase * 1.7));
        const c = Math.cos(a), sn = Math.sin(a);
        P.addPath(t.path, new DOMMatrix([c, sn, -sn, c, t.x, t.y]));
      }
      if (L.arch) P.addPath(L.arch, new DOMMatrix([1, 0, 0, 1, 0.02 * swayK * 20 * Math.sin(T * 0.6 + L.seed), 0]));

      g.save();
      g.globalAlpha = alpha;
      g.translate(cx + (L.xoff - camX) * s, hy + CAM_H * s);
      g.scale(s, s);
      // Shadow at rest, backlight glow in the drop.
      const sh = 0.006 * s * pxs;
      if (light < 0.35) {
        g.shadowColor = rgba([0, 0, 0], 0.5 * (1 - light / 0.35) * (1 - fog * 0.6));
        g.shadowOffsetX = sh; g.shadowOffsetY = sh * 0.6;
        g.shadowBlur = Math.min(40, 0.012 * s * pxs);
      } else {
        const k = (light - 0.35) / 0.65;
        g.shadowColor = rgba(pal.glow, (0.35 + 0.6 * k) * (1 - fog * 0.4));
        g.shadowOffsetX = 0; g.shadowOffsetY = 0;
        g.shadowBlur = Math.min(60, (8 + 0.02 * s) * pxs);
      }
      g.fillStyle = rgba(col, 1);
      g.fill(P);
      g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
      if (params.grain > 0) {
        pat.setTransform(new DOMMatrix().scale((0.55 * Math.pow(1 / z, 0.45)) / s));
        g.fillStyle = pat;
        g.globalAlpha = alpha * clamp01(0.34 * params.grain);
        g.fill(P);
      }
      g.restore();
    },

    drawBirds(g, pal, light, pxs, T) {
      if (!this.birds.length) return;
      const q = Math.floor(T * 12);
      const FLAP = [-1, -0.25, 0.7, -0.25];
      g.save();
      g.fillStyle = rgba(mix(pal.rabbit, pal.glow, 0.2 * light), 1);
      if (light > 0.2) {
        g.shadowColor = rgba(pal.glow, 0.9 * light);
        g.shadowBlur = 8 * pxs;
      }
      for (const b of this.birds) {
        const sz = b.size * (1 - 0.18 * b.age);
        const wy = FLAP[(q + b.ph) % 4] * 0.8;
        const dir = b.vx >= 0 ? 1 : -1;
        g.globalAlpha = smooth(3.4, 2.6, b.age) * smooth(0, 0.08, b.age);
        g.save();
        g.translate(b.x, b.y);
        g.scale(dir * sz, sz);
        g.beginPath();
        g.moveTo(-0.55, 0.02);
        g.lineTo(-0.2, -0.08);
        g.lineTo(0.05, wy - 0.05);    // far wing
        g.lineTo(0.2, -0.1);
        g.lineTo(0.45, -0.14);
        g.lineTo(0.62, -0.1);         // head
        g.lineTo(0.45, 0.02);
        g.lineTo(0.15, 0.1);
        g.lineTo(-0.05, wy + 0.06);   // near wing
        g.lineTo(-0.25, 0.1);
        g.lineTo(-0.6, 0.16);         // tail
        g.closePath();
        g.fill();
        g.restore();
      }
      g.restore();
    },

    drawRabbit(g, pal, light, pxs, T, camX, cx, hy, push, params, pat) {
      const s = F / ZR;
      const X = 0.1 * Math.sin(T * 0.045) + 0.04 * Math.sin(T * 0.13);
      const x = cx + (X - camX) * s, gy = hy + CAM_H * s;
      const size = 0.19 * s;
      // Animated on twos, counted from the kick so the leap starts at once.
      const since = T - this.hop.t0;
      const uq = (Math.floor(since * 12) + 1) / 12 / 0.36;
      let air = 0, st = 0, sq = 0, tilt = 0;
      if (uq < 1) {
        air = 4 * uq * (1 - uq);
        st = Math.sin(Math.PI * uq);
        tilt = -0.35 * (1 - 2 * uq);
      } else if (uq < 1.4) {
        sq = Math.sin(Math.PI * (uq - 1) / 0.4);
      }
      if (uq > 1.5) {
        const want = Math.cos(T * 0.045) >= 0 ? 1 : -1;
        this.facing = want;
      }
      const hopH = 0.15 * s * Math.min(1.4, Math.max(0.3, this.hop.amp * push)) * air;
      const tq = Math.floor(T * 12) / 12;
      const earA = -0.18 - 0.55 * st + 0.08 * Math.sin(tq * 0.9) + 0.25 * sq;

      // Shadow on the path.
      g.save();
      g.fillStyle = rgba([0, 0, 0], 0.4 * (1 - 0.5 * air));
      g.beginPath();
      g.ellipse(x, gy + 1, size * 0.42 * (1 - 0.35 * air), size * 0.06, 0, 0, TAU);
      g.fill();
      g.restore();

      const P = new Path2D();
      ellipseSub(P, -0.18 - 0.08 * st, -0.28, 0.3, 0.27, 0);
      ellipseSub(P, 0.02, -0.36, 0.34 + 0.08 * st, 0.24, -0.35);
      ellipseSub(P, 0.2 + 0.05 * st, -0.42, 0.17, 0.2, 0);
      ellipseSub(P, 0.34 + 0.06 * st, -0.64, 0.2, 0.15, 0.25);
      for (const [bx, by, da, len] of [[0.27, -0.74, 0, 0.26], [0.33, -0.72, 0.28, 0.23]]) {
        const a = earA + da;
        ellipseSub(P, bx + 0.06 * st + Math.sin(a) * len * 0.9, by - Math.cos(a) * len * 0.9, 0.065, len, a);
      }
      ellipseSub(P, -0.49 - 0.06 * st, -0.36, 0.1, 0.09, 0);
      ellipseSub(P, -0.06 - 0.38 * st, -0.04 - 0.06 * st, 0.2, 0.05, 0.4 * st);
      ellipseSub(P, 0.28 + 0.14 * st, -0.08 - 0.12 * st, 0.07, 0.06, 0);
      ellipseSub(P, 0.41 + 0.06 * st, -0.67, 0.028, 0.028, 0, true);   // cut-out eye

      g.save();
      g.translate(x, gy - hopH);
      g.rotate(tilt * this.facing);
      g.scale(size * this.facing * (1 + 0.14 * st + 0.12 * sq), size * (1 - 0.06 * st - 0.18 * sq));
      if (light > 0.2) {
        g.shadowColor = rgba(pal.glow, 0.9 * light);
        g.shadowBlur = 14 * pxs;
      }
      g.fillStyle = rgba(mix(pal.rabbit, pal.glow, 0.15 * light), 1);
      g.fill(P);
      g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0;
      if (params.grain > 0) {
        pat.setTransform(new DOMMatrix().scale(0.5 / size));
        g.fillStyle = pat;
        g.globalAlpha = clamp01(0.5 * params.grain);
        g.fill(P);
        g.globalAlpha = 1;
      }
      g.restore();
    },
  });
})();
