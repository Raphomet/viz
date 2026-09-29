// Patchwork: a slow flight over farmland, drawn as a hand-coloured map. Every
// field is one of Rough.js's fill styles, chosen for what it looks like from
// the air: hachure for ploughed furrows and wheat (the angle is the direction
// of the rows, the gap how close they are drilled), zigzag for rape in
// flower, zigzag-line for vines and lavender, dots for an orchard, dashed for
// stubble, cross-hatch for a village, solid for a pond. The lanes between the
// fields are just the paper left showing. Clouds pass underneath the plane,
// nearer than the ground, with their cross-hatched shadows on the fields.
//
// The medium: Rough.js's fillers are its most distinctive feature (a hand
// filling a shape with strokes, not a flat colour), and on a map they are a
// whole legend. The angle and gap of the hatching are free per field, so the
// landscape is patterned the way real field systems are.
//
// Music, each in its own place:
//   kick   one field ahead of the plane is re-ploughed: its rows swing to a
//          new angle, drawn over in red pencil that fades back
//   clap   a crop circle is pressed into a wheat field near the middle and
//          stays as the map scrolls away
//   hats   an orchard redraws its trees (the dots re-seed), a sparkle in the
//          green
//   bass   the pencils press harder: the hatching thickens
//   drop   the map is coloured in (it starts as a graphite survey), the
//          plane speeds up and banks, more cloud comes over
// The whole map boils gently: a few fields a second are redrawn with a new
// seed, so the drawing is alive without flickering.

(function () {
  'use strict';

  // Rough.js 4.6.6 (MIT, Preet Shihn), the IIFE build, which sets window.rough.
  const ROUGH_URL = 'https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js';
  function loadRough() {
    if (window.rough) return Promise.resolve(window.rough);
    if (!window.__vizRoughLoad) {
      window.__vizRoughLoad = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = ROUGH_URL;
        s.async = true;
        s.onload = () => (window.rough ? resolve(window.rough) : reject(new Error('rough.js loaded without a global')));
        s.onerror = () => { window.__vizRoughLoad = null; reject(new Error('could not load ' + ROUGH_URL)); };
        document.head.appendChild(s);
      });
    }
    return window.__vizRoughLoad;
  }
  // A drawable's op sets as cached Path2D objects (kind: 0 outline, 1 solid
  // fill, 2 fill sketch), so a field is generated once and stroked each frame.
  function bake(d) {
    const out = [];
    // Rough's own canvas renderer fills curves, polygons and paths even-odd
    // and everything else non-zero; an ellipse's sketchy outline overlaps
    // itself, so even-odd would punch holes in it.
    const rule = d.shape === 'curve' || d.shape === 'polygon' || d.shape === 'path' ? 'evenodd' : 'nonzero';
    for (const s of d.sets) {
      const path = new Path2D();
      for (const o of s.ops) {
        const a = o.data;
        if (o.op === 'move') path.moveTo(a[0], a[1]);
        else if (o.op === 'bcurveTo') path.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
        else path.lineTo(a[0], a[1]);
      }
      out.push({ path, rule, kind: s.type === 'fillSketch' ? 2 : s.type === 'fillPath' ? 1 : 0 });
    }
    return out;
  }
  function ink(g, baked, line, lw, fill, fw) {
    for (const b of baked) {
      if (b.kind === 0) { if (line) { g.strokeStyle = line; g.lineWidth = lw; g.stroke(b.path); } }
      else if (b.kind === 2) { if (fill) { g.strokeStyle = fill; g.lineWidth = fw; g.stroke(b.path); } }
      else if (fill) { g.fillStyle = fill; g.fill(b.path, b.rule); }
    }
  }

  const BEAT = 60 / 124;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedOf = (a, b, c) => ((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 1) % 2147483000 + 1;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, u) => 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';

  // What each crop is, as a Rough.js fill. gap and weight are in world units.
  // 'ink' names the palette entry it is coloured with.
  const CROPS = [
    { id: 'wheat', style: 'hachure', gap: 5.5, fw: 1.0, ink: 'wheat', w: 5 },
    { id: 'plough', style: 'hachure', gap: 3.4, fw: 1.1, ink: 'plough', w: 4 },
    { id: 'rape', style: 'zigzag', gap: 5, fw: 1.0, ink: 'rape', w: 2 },
    { id: 'vines', style: 'zigzag-line', gap: 8, fw: 1.0, ink: 'vine', w: 2, zig: 2.5 },
    { id: 'orchard', style: 'dots', gap: 11, fw: 2.4, ink: 'orchard', w: 2 },
    { id: 'stubble', style: 'dashed', gap: 6, fw: 1.0, ink: 'fallow', w: 2, dash: 7, dgap: 5 },
    { id: 'pasture', style: 'hachure', gap: 13, fw: 0.8, ink: 'pasture', w: 3 },
    { id: 'village', style: 'cross-hatch', gap: 4.2, fw: 0.9, ink: 'town', w: 1 },
    { id: 'pond', style: 'solid', gap: 0, fw: 0, ink: 'water', w: 0.6 },
  ];
  const CROP_W = CROPS.reduce((a, c) => a + c.w, 0);

  const PAPERS = [
    { name: 'Survey sheet', paper: '#EFE8D7', graphite: '#3C3934', accent: '#C63A28',
      wheat: '#C4952B', plough: '#7E5337', rape: '#D8B62E', vine: '#6E5E93', orchard: '#46704A',
      fallow: '#9B8E78', pasture: '#7F9C57', town: '#9E4636', water: '#5A87AA', cloud: '#F7F3EA' },
    { name: 'Kraft', paper: '#CDB38C', graphite: '#2E2821', accent: '#B32D1E',
      wheat: '#8F6516', plough: '#5A3A24', rape: '#A88414', vine: '#4F4474', orchard: '#2F5436',
      fallow: '#6F6250', pasture: '#556E34', town: '#7A2E22', water: '#355F80', cloud: '#E9DCC4' },
    { name: 'Blue pencil', paper: '#EEEEE9', graphite: '#2F4F86', accent: '#D04B35',
      wheat: '#3E64A6', plough: '#2B4679', rape: '#5B80BF', vine: '#3A5791', orchard: '#2E4E86',
      fallow: '#7A8FB3', pasture: '#6D8AC0', town: '#243D6A', water: '#4C73B4', cloud: '#F8F8F4' },
  ];

  const PRESETS = {
    calm: { speed: 0.45, colour: 0.15, clouds: 0.3, bank: 0.25, altitude: 1 },
    drop: { speed: 1.4, colour: 1, clouds: 0.85, bank: 1, altitude: 0.9 },
    // Low and slow over a fully coloured map, no clouds.
    postcard: { speed: 0.35, colour: 1, clouds: 0, bank: 0.1, altitude: 1.35, follow: 0 },
  };
  const DRIVE = ['speed', 'colour', 'clouds', 'bank', 'altitude'];

  const TILE = 260;             // world units per tile of fields
  const LANE = 4.5;             // half the width of a lane between fields
  const BAKE_BUDGET = 14;       // fields generated per frame at most

  VIZ.register({
    id: 'rough2',
    name: 'Patchwork',
    order: 1102,

    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'colour', label: 'Coloured in', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'clouds', label: 'Cloud cover', type: 'range', min: 0, max: 1, default: PRESETS.calm.clouds, step: 0.01 },
      { key: 'bank', label: 'Banking', type: 'range', min: 0, max: 1.5, default: PRESETS.calm.bank, step: 0.01 },
      { key: 'altitude', label: 'Low / high', type: 'range', min: 0.6, max: 1.6, default: PRESETS.calm.altitude, step: 0.01 },
      { key: 'boil', label: 'Boil', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'paper', label: 'Paper and pencils', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Kick re-ploughs', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Patchwork',
      technique: 'Rough.js 4.6.6 (loaded from jsDelivr) through its generator, on the p5 Canvas 2D context. Tiles of farmland are split recursively into inset, jittered quads, each a Rough polygon in one of the library\'s fill styles (hachure, zigzag, zigzag-line, dots, dashed, cross-hatch, solid) with its own hachureAngle, hachureGap and fillWeight; drawables are cached as Path2D in world space and drawn through one rotating camera transform, generated within a per-frame budget and re-seeded a few a second for a gentle boil. Colour is mixed per crop from graphite to the pencil at draw time. Clouds are overlapping Rough ellipses (thick outlines, then solid paper fills, leaving only the silhouette) in a nearer parallax plane over cross-hatched shadows.',
      brief: 'A flight over a patchwork of fields drawn as a hand-coloured map on survey paper. Each crop is a different Rough.js fill: furrows and wheat in hachure following the rows, rape in zigzag, vines in zigzag-line, orchards in dots, stubble in dashes, villages cross-hatched, ponds solid. The calm is a graphite survey; the drop colours it in with pencils, the plane speeds up and banks, and cloud comes over, casting cross-hatched shadows. Each kick re-ploughs one field ahead in red pencil; each clap presses a crop circle into the wheat; hats make orchards redraw their trees; the bass presses the pencils harder.',
      lineage: [
        'Batch 08 (2026-09-29), Rough.js sketch 2 of 5: the fill styles as a map legend.',
        'Aerial photographs of field systems (the patchwork of Midwestern and English farmland), Ordnance Survey and hand-coloured estate maps, the diagrammatic landscapes of children\'s atlases.',
        'Kin to Flyover (web/scenes/v2/flyover.js) as a continuous flight, turned to look straight down.',
      ],
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      loadRough().catch((e) => console.warn('rough2: ' + e.message)).then(() => { if (hold) p._decrementPreload(); });
    },

    setup() {},
    enter() { loadRough().catch(() => {}); this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, hf: 0, hs: 0, hArm: true,
        bass: 0, low: 0, dropOn: false, auto: 0, lastK: -9, lastC: -9, lastH: -9 };
      this.cx = 0; this.cy = 0;           // camera, world units
      this.head = -Math.PI / 2;           // flight heading (world angle)
      this.tiles = new Map();
      this.circles = [];
      this.clouds = [];
      this.cloudSeq = 0;
      this.boilAcc = 0;
      this.boilCursor = 0;
      this.visible = [];
      this.grain = null;
    },

    listen(sg, dt, T) {
      const e = this.env;
      const k = sg[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp01((e.kf - e.ks) * 2.2);
      let kick = 0;
      if (e.kArm && kOn > 0.2 && T - e.lastK > 0.22) { kick = kOn; e.kArm = false; e.lastK = T; }
      if (kOn < 0.1) e.kArm = true;
      const cl = (sg[3] + sg[4] + sg[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp01((e.cf - e.cs) * 3);
      let clap = 0;
      if (e.cArm && cOn > 0.25 && T - e.lastC > 0.3) { clap = cOn; e.cArm = false; e.lastC = T; }
      if (cOn < 0.1) e.cArm = true;
      const hh = (sg[7] + sg[8]) / 200;
      e.hf = ease(e.hf, hh, 45, dt);
      e.hs = ease(e.hs, hh, 4, dt);
      const hOn = clamp01((e.hf - e.hs) * 3);
      let hat = 0;
      if (e.hArm && hOn > 0.12 && T - e.lastH > 0.07) { hat = 1; e.hArm = false; e.lastH = T; }
      if (hOn < 0.05) e.hArm = true;
      e.bass = ease(e.bass, (sg[0] + sg[1] + sg[2]) / 300, 3, dt);
      e.low = ease(e.low, sg[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, clap, hat };
    },

    // A tile of fields: recursive splits of a square into quads, each inset
    // by a lane and jittered at the corners so nothing is ruled.
    tile(tx, ty) {
      const key = tx + ',' + ty;
      let t = this.tiles.get(key);
      if (t) return t;
      const rng = mulberry(seedOf(tx, ty, 11));
      const rects = [];
      const split = (x, y, w, h, depth) => {
        const big = w * h > 5200 && depth < 4;
        if (big && (depth < 2 || rng() < 0.7)) {
          const u = 0.32 + 0.36 * rng();
          if (w > h * (0.8 + 0.4 * rng())) { split(x, y, w * u, h, depth + 1); split(x + w * u, y, w * (1 - u), h, depth + 1); }
          else { split(x, y, w, h * u, depth + 1); split(x, y + h * u, w, h * (1 - u), depth + 1); }
        } else rects.push([x, y, w, h]);
      };
      split(tx * TILE, ty * TILE, TILE, TILE, 0);
      const fields = [];
      for (let i = 0; i < rects.length; i++) {
        const [x, y, w, h] = rects[i];
        const j = () => (rng() - 0.5) * 9;
        const pts = [[x + LANE + j(), y + LANE + j()], [x + w - LANE + j(), y + LANE + j()],
          [x + w - LANE + j(), y + h - LANE + j()], [x + LANE + j(), y + h - LANE + j()]];
        let r = rng() * CROP_W, c = 0;
        while (r > CROPS[c].w) { r -= CROPS[c].w; c++; }
        // Small plots are more often orchards and villages; ponds stay small.
        if (CROPS[c].id === 'pond' && w * h > 6000) c = 0;
        // Rows run along the long side, as a drill would go.
        const along = w > h ? 0 : 90;
        fields.push({ pts, crop: c, angle: along + (rng() - 0.5) * 16, cx: x + w / 2, cy: y + h / 2,
          seed: seedOf(tx * 31 + i, ty, 3), gen: 0, baked: null, flash: -9, trees: rng() < 0.35 });
      }
      t = { fields, used: 0 };
      this.tiles.set(key, t);
      return t;
    },

    bakeField(gen, f) {
      const C = CROPS[f.crop];
      const o = { roughness: 1.1, bowing: 1.3, seed: f.seed + f.gen * 7919, strokeWidth: 1.2,
        fill: '#000', fillStyle: C.style, hachureAngle: f.angle, hachureGap: C.gap, fillWeight: C.fw };
      if (C.zig) o.zigzagOffset = C.zig;
      if (C.dash) { o.dashOffset = C.dash; o.dashGap = C.dgap; }
      f.baked = bake(gen.polygon(f.pts, o));
      if (f.trees) {
        // A hedge tree or two on a corner of the field.
        const [x, y] = f.pts[f.seed % 4];
        const r = 7 + (f.seed % 5);
        f.tree = bake(gen.circle(x, y, r * 2, { roughness: 1.3, seed: f.seed + 5 + f.gen, fill: '#000',
          fillStyle: 'cross-hatch', hachureGap: 2.6, fillWeight: 0.8, strokeWidth: 1.2 }));
      }
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.reset();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const T = this.clock;
      const e = this.env;
      const hit = this.listen(signals, dt, T);
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const pal = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      p.background(pal.paper);
      this.paperTooth(g, W, H);
      const R = window.rough;
      if (!R) return;
      if (!this.gen) this.gen = R.generator();
      const gen = this.gen;

      // ---- flight: a slow weave of the heading, banking harder in the drop
      const turn = P.bank * (0.16 * Math.sin(T * 0.11) + 0.1 * Math.sin(T * 0.047 + 1.3));
      this.head += turn * dt;
      const v = 28 + 70 * P.speed;
      this.cx += Math.cos(this.head) * v * dt;
      this.cy += Math.sin(this.head) * v * dt;
      const zoom = 1 / P.altitude;
      // The view: the heading points up the screen, with a lean into the turn.
      const rot = -Math.PI / 2 - this.head + turn * 0.5;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const toWorld = (sx, sy) => {
        const x = (sx - W / 2) / zoom, y = (sy - H / 2) / zoom;
        return [this.cx + x * cosR + y * sinR, this.cy - x * sinR + y * cosR];
      };
      const rad = Math.hypot(W, H) / 2 / zoom + 30;

      // ---- gather visible fields (tiles within the view circle)
      const tx0 = Math.floor((this.cx - rad) / TILE), tx1 = Math.floor((this.cx + rad) / TILE);
      const ty0 = Math.floor((this.cy - rad) / TILE), ty1 = Math.floor((this.cy + rad) / TILE);
      const vis = [];
      let budget = BAKE_BUDGET;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const dx = clamp(this.cx, tx * TILE, tx * TILE + TILE) - this.cx;
          const dy = clamp(this.cy, ty * TILE, ty * TILE + TILE) - this.cy;
          if (dx * dx + dy * dy > rad * rad) continue;
          const t = this.tile(tx, ty);
          t.used = T;
          for (const f of t.fields) {
            if (!f.baked) { if (budget <= 0) continue; this.bakeField(gen, f); budget--; }
            vis.push(f);
          }
        }
      }
      if (this.tiles.size > 140) for (const [k, t] of this.tiles) if (T - t.used > 3) this.tiles.delete(k);

      // ---- events
      const ahead = toWorld(W / 2, H * 0.3);
      const mid = toWorld(W / 2, H * 0.48);
      const nearest = (pt, ok) => {
        let best = null, bd = 1e18;
        for (const f of vis) {
          if (!ok(f)) continue;
          const d = (f.cx - pt[0]) ** 2 + (f.cy - pt[1]) ** 2;
          if (d < bd) { bd = d; best = f; }
        }
        return best;
      };
      if (hit.kick && params.react > 0) {
        // Rotate the rows of the nearest arable field ahead not already turning.
        const f = nearest([ahead[0] + (Math.sin(T * 3.7) * 90), ahead[1] + Math.cos(T * 2.3) * 60],
          (q) => T - q.flash > 1 && CROPS[q.crop].style !== 'solid');
        if (f) {
          f.angle += 90 + (Math.sin(T * 13.1) * 25);
          f.gen++;
          this.bakeField(gen, f);
          f.flash = T; f.flashAmp = clamp01(hit.kick * 1.4) * params.react;
        }
      }
      if (hit.clap) {
        const f = nearest([mid[0] + Math.sin(T * 5.1) * 120, mid[1]], (q) => CROPS[q.crop].id === 'wheat' || CROPS[q.crop].id === 'pasture');
        if (f) {
          const xs = f.pts.map((q) => q[0]), ys = f.pts.map((q) => q[1]);
          const r = Math.max(14, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.3);
          const s = seedOf(T * 60, 5, 5);
          const d = [];
          d.push(bake(gen.circle(0, 0, r * 2, { roughness: 0.9, seed: s, fill: '#000', fillStyle: 'solid' })));
          d.push(bake(gen.circle(0, 0, r * 1.25, { roughness: 0.9, seed: s + 1, fill: '#000', fillStyle: 'hachure', hachureGap: 3, hachureAngle: f.angle + 60 })));
          const n = 3 + (s % 3);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU + s;
            const rr = r * (0.28 + 0.1 * (k % 2));
            d.push(bake(gen.circle(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55, rr * 2, { roughness: 0.9, seed: s + 3 + k, fill: '#000', fillStyle: 'solid' })));
          }
          d.push(bake(gen.circle(0, 0, r * 3.1, { roughness: 0.7, seed: s + 2 })));
          this.circles.push({ x: f.cx, y: f.cy, t: T, d });
          if (this.circles.length > 14) this.circles.shift();
        }
      }
      if (hit.hat) {
        let n = 0;
        for (const f of vis) {
          if (CROPS[f.crop].id !== 'orchard') continue;
          if (((f.seed + this.boilCursor) & 3) !== 0) continue;
          f.gen++; this.bakeField(gen, f);
          if (++n >= 3) break;
        }
        this.boilCursor++;
      }
      // Boil: a few fields a second redrawn with a new seed.
      this.boilAcc += dt * params.boil * 30;
      while (this.boilAcc >= 1 && vis.length) {
        this.boilAcc -= 1;
        const f = vis[(this.boilCursor = (this.boilCursor + 7) % vis.length)];
        f.gen++; this.bakeField(gen, f);
      }

      // ---- clouds: spawned ahead, in a nearer plane
      const cover = P.clouds;
      const want = Math.round(cover * 4);
      if (this.clouds.length < want && (this.cloudT === undefined || T - this.cloudT > 1.2)) {
        this.cloudT = T;
        const seq = ++this.cloudSeq;
        const rng = mulberry(seedOf(seq, 9, 1));
        const sx = W * (0.1 + 0.8 * rng());
        const pos = toWorld(sx, -H * 0.55);
        const blobs = [];
        const n = 3 + Math.floor(rng() * 3);
        const size = 50 + 45 * rng();
        for (let k = 0; k < n; k++) blobs.push([(k - n / 2) * size * 0.45 + (rng() - 0.5) * 20, (rng() - 0.5) * size * 0.4, size * (0.55 + 0.5 * rng())]);
        const s = seedOf(seq, 2, 2);
        const outline = blobs.map((b, k) => bake(gen.ellipse(b[0], b[1], b[2] * 1.3, b[2], { roughness: 1.4, bowing: 2, seed: s + k })));
        const fill = blobs.map((b, k) => bake(gen.ellipse(b[0], b[1], b[2] * 1.3, b[2], { roughness: 0.4, seed: s + k, stroke: 'none', fill: '#000', fillStyle: 'solid' })));
        const shade = blobs.map((b, k) => bake(gen.ellipse(b[0], b[1], b[2] * 1.3, b[2], { roughness: 1, seed: s + 40 + k, stroke: 'none', fill: '#000', fillStyle: 'hachure', hachureGap: 4, hachureAngle: -30, fillWeight: 0.8 })));
        const shadow = blobs.map((b, k) => bake(gen.ellipse(b[0], b[1], b[2] * 1.2, b[2] * 0.9, { roughness: 1, seed: s + 20 + k, stroke: 'none', fill: '#000', fillStyle: 'cross-hatch', hachureGap: 5, fillWeight: 0.8 })));
        // Clouds sit in a plane nearer the eye: they move faster than the
        // ground, so they are placed relative to the camera, not the map.
        this.clouds.push({ x: pos[0] - this.cx, y: pos[1] - this.cy, drift: 0, outline, fill, shade, shadow, t: T, heading: this.head });
      }

      // ---- draw
      const colour = P.colour;
      const press = 1 + 0.8 * e.bass;
      const inks = {};
      const gph = hex(pal.graphite);
      for (const C of CROPS) inks[C.ink] = mix(gph, hex(pal[C.ink]), colour);
      const acc = pal.accent;

      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.translate(W / 2, H / 2);
      g.scale(zoom, zoom);
      g.rotate(rot);
      g.translate(-this.cx, -this.cy);

      for (const f of vis) {
        const C = CROPS[f.crop];
        const col = inks[C.ink];
        g.globalAlpha = 0.9;
        if (C.style === 'solid') {
          g.globalAlpha = 0.35 + 0.5 * colour;
          ink(g, f.baked, pal.graphite, 1.1, col, 0);
        } else {
          ink(g, f.baked, pal.graphite, 0.9, col, C.fw * press * (0.8 + 0.3 * colour));
        }
        if (f.tree) { g.globalAlpha = 0.85; ink(g, f.tree, pal.graphite, 1.1, mix(gph, hex(pal.orchard), colour), 0.8); }
        const fa = T - f.flash;
        if (fa < 1.2) {
          // The red pencil goes over the new rows, then lets the crop show.
          g.globalAlpha = (1 - fa / 1.2) * f.flashAmp;
          ink(g, f.baked, acc, 1.5, acc, C.fw * 1.3 * press);
        }
      }
      // Crop circles: flattened crop, pressed in from the middle out.
      for (const c of this.circles) {
        const a = T - c.t;
        const grow = 1 - Math.pow(1 - clamp01(a / 0.5), 3);
        g.save();
        g.translate(c.x, c.y);
        g.scale(0.2 + 0.8 * grow, 0.2 + 0.8 * grow);
        g.globalAlpha = 1;
        ink(g, c.d[0], null, 0, pal.paper, 0);
        for (let k = 2; k < c.d.length - 1; k++) ink(g, c.d[k], null, 0, pal.paper, 0);
        g.globalAlpha = 0.5 + 0.4 * colour;
        const cc = mix(gph, hex(pal.accent), 0.3 + 0.5 * colour);
        ink(g, c.d[0], cc, 1.2, null, 0);
        ink(g, c.d[1], cc, 1.1, cc, 0.9);
        for (let k = 2; k < c.d.length - 1; k++) ink(g, c.d[k], cc, 1.1, null, 0);
        g.globalAlpha = 0.35 * (1 - grow * 0.4);
        ink(g, c.d[c.d.length - 1], cc, 1, null, 0);
        g.restore();
      }
      // Cloud shadows on the ground, offset down-sun.
      for (const cl of this.clouds) {
        g.save();
        g.translate(this.cx + cl.x * 1 + 60, this.cy + cl.y + 70);
        g.globalAlpha = 0.28 * clamp01((T - cl.t) * 0.7) * (cl.fade === undefined ? 1 : cl.fade);
        for (const b of cl.shadow) ink(g, b, null, 0, pal.graphite, 0.8);
        g.restore();
      }
      g.restore();

      // Clouds in their own plane: 1.8x the ground's motion (nearer), under
      // the same rotation.
      g.save();
      g.lineCap = 'round';
      g.translate(W / 2, H / 2);
      g.scale(zoom * 1.25, zoom * 1.25);
      g.rotate(rot);
      for (let i = this.clouds.length - 1; i >= 0; i--) {
        const cl = this.clouds[i];
        // Relative to the camera the ground slides by -v; the cloud plane by
        // 0.8 v more, so it passes quicker.
        cl.x -= Math.cos(this.head) * v * 0.8 * dt;
        cl.y -= Math.sin(this.head) * v * 0.8 * dt;
        const far = Math.hypot(cl.x, cl.y);
        if (far > rad * 1.4 && T - cl.t > 3) { this.clouds.splice(i, 1); continue; }
        cl.fade = this.clouds.length > want ? Math.max(0, (cl.fade === undefined ? 1 : cl.fade) - dt * 0.5) : Math.min(1, (cl.fade === undefined ? 1 : cl.fade) + dt);
        if (cl.fade <= 0) { this.clouds.splice(i, 1); continue; }
        g.save();
        g.translate(cl.x, cl.y);
        g.globalAlpha = clamp01((T - cl.t) * 0.7) * cl.fade;
        for (const b of cl.outline) ink(g, b, pal.graphite, 3.2, null, 0);
        for (const b of cl.fill) ink(g, b, null, 0, pal.cloud, 0);
        // Shade the underside: the same blobs nudged down-sun, hatched and
        // clipped to the cloud, so the hatching never leaves its silhouette.
        if (!cl.clip) { cl.clip = new Path2D(); for (const b of cl.fill) for (const q of b) cl.clip.addPath(q.path); }
        g.save();
        g.clip(cl.clip, 'nonzero');
        g.translate(10, 14);
        g.globalAlpha *= 0.22;
        for (const b of cl.shade) ink(g, b, null, 0, pal.graphite, 0.8);
        g.restore();
        g.restore();
      }
      g.restore();
    },

    paperTooth(g, W, H) {
      if (!this.grain) {
        const c = document.createElement('canvas');
        c.width = c.height = 160;
        const t = c.getContext('2d');
        const img = t.createImageData(160, 160);
        const rng = mulberry(777);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = rng() < 0.5 ? 0 : 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = Math.floor(rng() * 60);
        }
        t.putImageData(img, 0, 0);
        this.grain = g.createPattern(c, 'repeat');
      }
      g.save();
      g.globalAlpha = 0.06;
      g.fillStyle = this.grain;
      g.fillRect(0, 0, W, H);
      g.restore();
    },
  });
})();
