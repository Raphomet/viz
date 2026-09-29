// Patent Drawing: a machine for keeping time to the music, drawn as the
// figure sheet of a patent application. A toothed flywheel drives a train of
// gears; a drop hammer strikes an anvil; a bell swings on its yoke; a
// ratchet clicks round under its pawl; a flyball governor spreads its arms
// as the machine speeds up; a belt runs to a second pulley. Section lining
// on the cut parts, a ground line with its hatching, reference numerals on
// leader lines, FIG. 1.
//
// The medium: a Rough.js drawable is a fixed set of strokes once generated.
// Every part here is generated once in its own local frame (gears as
// rough.path from SVG data: the toothed outline plus the bore as arc
// commands, so the hachure fill leaves the hole open) and then moved only by
// the canvas transform: the gears really turn, and each keeps its own
// hand-drawn wobble as it turns, like a cel. The boil is separate and slow,
// a new seed for the whole sheet a few times a second, so the drawing lives
// without the machine losing its shape.
//
// Music, each in its own place:
//   kick   the drop hammer comes down on the anvil (it rises again through
//          the beat), with the dashed arc of its swing and strike lines
//   clap   the bell swings on its yoke; its ring goes out as arcs
//   hats   the ratchet advances one tooth, the pawl clicking over
//   bass   the flywheel drives harder; the governor's balls fly out
//   drop   the view pulls back from the detail to the whole sheet, the belt
//          drive and second pulley are drawn in, the machine runs faster
//          and the sheet boils quicker

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
  // fill, 2 fill sketch).
  function bake(d) {
    const out = [];
    // Rough's own renderer fills curves, polygons and paths even-odd and
    // everything else non-zero; a sketchy ellipse overlaps itself.
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
  const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
  const seedOf = (a, b, c) => ((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 1) % 2147483000 + 1;

  const SHEETS = [
    { name: 'Bristol board', paper: '#F3F1EA', ink: '#161616', soft: '#6A6864', fill: '#F3F1EA' },
    { name: 'Blue linen', paper: '#DDE5EA', ink: '#1C2E52', soft: '#61718E', fill: '#DDE5EA' },
    { name: 'Reversed', paper: '#141414', ink: '#EDEBE4', soft: '#8D8B86', fill: '#141414' },
  ];

  const PRESETS = {
    calm: { speed: 0.3, view: 0, modules: 0.15, boil: 2 },
    drop: { speed: 1.3, view: 1, modules: 1, boil: 7 },
    // The whole sheet, still, the machine ticking over.
    exhibit: { speed: 0.15, view: 1, modules: 1, boil: 0, follow: 0 },
  };
  const DRIVE = ['speed', 'view', 'modules', 'boil'];

  // The machine, in sheet units (the sheet is about 1000 x 600).
  const M = 5.2;                              // gear module: tooth pitch diameter per tooth
  const GF = { x: -250, y: 60, n: 56 };        // flywheel
  const GB = { n: 28 };                        // intermediate gear
  const GC = { n: 16 };                        // pinion (carries the ratchet)
  const rP = (n) => n * M / 2;
  GB.x = GF.x + (rP(GF.n) + rP(GB.n)) * Math.cos(-0.35); GB.y = GF.y + (rP(GF.n) + rP(GB.n)) * Math.sin(-0.35);
  GC.x = GB.x + (rP(GB.n) + rP(GC.n)) * Math.cos(0.5); GC.y = GB.y + (rP(GB.n) + rP(GC.n)) * Math.sin(0.5);
  const GROUND = 250;
  const HAM = { x: 190, y: -40, len: 185 };    // hammer pivot and arm length
  const ANVIL = { x: 190 + 185, y: -40 + 24 };  // its face just under the head at rest
  const BELL = { x: 360, y: -190 };
  const PUL = { x: 20, y: 190, r: 34 };        // second pulley (drop)
  const RAT = { n: 18, r: 30 };

  function gearPath(n, bore) {
    const r = rP(n), ra = r + M * 0.9, rd = r - M * 1.1;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, s = TAU / n;
      const pts = [[rd, a], [rd, a + s * 0.12], [ra, a + s * 0.3], [ra, a + s * 0.55], [rd, a + s * 0.73]];
      for (let k = 0; k < pts.length; k++) {
        const [rr, aa] = pts[k];
        d += (i === 0 && k === 0 ? 'M' : 'L') + (Math.cos(aa) * rr).toFixed(2) + ' ' + (Math.sin(aa) * rr).toFixed(2) + ' ';
      }
    }
    d += 'Z ';
    // The bore, as two arcs, so the fill leaves it open.
    d += 'M' + bore + ' 0 A' + bore + ' ' + bore + ' 0 1 0 ' + -bore + ' 0 A' + bore + ' ' + bore + ' 0 1 0 ' + bore + ' 0 Z';
    return d;
  }
  function ratchetPts(n, r) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, s = TAU / n;
      pts.push([Math.cos(a) * (r - 7), Math.sin(a) * (r - 7)]);
      pts.push([Math.cos(a + s * 0.9) * r, Math.sin(a + s * 0.9) * r]);
    }
    return pts;
  }

  VIZ.register({
    id: 'rough5',
    name: 'Patent Drawing',
    order: 1105,

    params: [
      { key: 'speed', label: 'Flywheel speed', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'view', label: 'Detail / whole sheet', type: 'range', min: 0, max: 1, default: PRESETS.calm.view, step: 0.01 },
      { key: 'modules', label: 'Belt drive', type: 'range', min: 0, max: 1, default: PRESETS.calm.modules, step: 0.01 },
      { key: 'boil', label: 'Boil (redraws a second)', type: 'range', min: 0, max: 12, default: PRESETS.calm.boil, step: 0.1 },
      { key: 'hand', label: 'Roughness', type: 'range', min: 0.1, max: 3, default: 0.9, step: 0.01 },
      { key: 'sheet', label: 'Sheet', type: 'select', options: SHEETS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Hammer strength', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Patent Drawing',
      technique: 'Rough.js 4.6.6 (loaded from jsDelivr) through its generator, on the p5 Canvas 2D context. Gears are rough.path from generated SVG data (toothed outline plus a bore of two arc commands, hachure-filled as section lining with the bore left open), the ratchet a Rough polygon, the bell an SVG path, the governor balls cross-hatched circles, springs zigzag linear paths, the ground line a line with a hachure-filled strip. Every part is generated once per boil in its own local frame, cached as Path2D and moved by the canvas transform, so rotating parts keep their drawn wobble; the whole sheet re-seeds at the boil rate. The belt is a dashed stroke with a running dash offset; reference numerals ride Rough curve leaders.',
      brief: 'A music machine drawn as a patent figure sheet in ink on Bristol board: a toothed flywheel driving a gear train, a drop hammer, a bell on a yoke, a ratchet and pawl, a flyball governor, section lining, a hatched ground line, reference numerals, FIG. 1. Each kick brings the hammer down on the anvil with the dashed arc of its swing; each clap swings the bell and sends its ring out in arcs; hats click the ratchet round a tooth at a time; the bass drives the flywheel and throws the governor\'s balls out. The calm is a close detail of the flywheel and hammer, barely boiling; the drop pulls back to the whole sheet, draws in a belt drive to a second pulley, runs the machine faster and boils the drawing quicker.',
      lineage: [
        'Batch 08 (2026-09-29), Rough.js sketch 5 of 5: rigid hand-drawn parts in motion, and the library\'s fills as drafting conventions (section lining, ground hatching).',
        'Nineteenth-century patent drawings and their conventions (reference numerals, leader lines, shade lines, FIG. numbers); Rowland Emett, Heath Robinson and Rube Goldberg machines; the kinetic drawings of Jean Tinguely.',
      ],
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      loadRough().catch((e) => console.warn('rough5: ' + e.message)).then(() => { if (hold) p._decrementPreload(); });
    },

    setup() {},
    enter() { loadRough().catch(() => {}); this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, hf: 0, hs: 0, hArm: true,
        bass: 0, low: 0, dropOn: false, auto: 0, lastK: -9, lastC: -9, lastH: -9 };
      this.thF = 0;
      this.spin = 0;
      this.belt = 0;
      this.lastKick = -9;
      this.kickAmp = 0;
      this.bellA = 0; this.bellV = 0;
      this.rings = [];
      this.rat = 0; this.ratT = 0; this.lastHat = -9;
      this.parts = null;
      this.spread = 0.3;
      this.camX = null;
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

    // Every part, in its own local frame, for one boil.
    makeParts(gen, hand, boil) {
      const o = (n, extra) => Object.assign({ roughness: hand, bowing: 1, seed: seedOf(n, boil, 11) }, extra || {});
      const hatch = (n, gap, ang) => o(n, { fill: '#000', fillStyle: 'hachure', hachureGap: gap || 5, hachureAngle: ang === undefined ? 45 : ang, fillWeight: 0.8 });
      const P = {};
      const gear = (g, n, bore, spokes, id) => {
        const r = rP(g.n);
        const parts = [bake(gen.path(gearPath(g.n, bore), hatch(id, 6)))];
        parts.push(bake(gen.circle(0, 0, bore * 2 - 8, o(id + 1, { fill: '#000', fillStyle: 'solid' }))));
        // Pitch circle, dash-dot in a real drawing: kept as a light line.
        parts.push(bake(gen.circle(0, 0, r * 2, o(id + 2))));
        if (spokes) {
          const rim = r - M * 3.2;
          const web = [];
          for (let k = 0; k < spokes; k++) {
            const a = (k / spokes) * TAU;
            web.push(bake(gen.line(Math.cos(a) * bore, Math.sin(a) * bore, Math.cos(a) * rim, Math.sin(a) * rim, o(id + 10 + k))));
          }
          parts.push(...web);
          parts.push(bake(gen.circle(0, 0, rim * 2, o(id + 3))));
        }
        return parts;
      };
      P.F = gear(GF, GF.n, 26, 6, 100);
      P.B = gear(GB, GB.n, 16, 0, 200);
      P.C = gear(GC, GC.n, 10, 0, 300);
      P.rat = [bake(gen.polygon(ratchetPts(RAT.n, RAT.r), o(400, { fill: '#000', fillStyle: 'cross-hatch', hachureGap: 5 })))];
      P.pawl = [bake(gen.polygon([[0, -4], [34, -2], [40, 6], [0, 4]], o(410)))];
      // Hammer: arm along +x from the pivot, head at the end.
      P.arm = [bake(gen.rectangle(0, -5, HAM.len - 18, 10, o(500)))];
      P.head = [bake(gen.rectangle(-18, -22, 36, 44, hatch(501, 4.5, -45)))];
      P.pivot = [bake(gen.circle(0, 0, 18, o(502))), bake(gen.circle(0, 0, 6, o(503, { fill: '#000', fillStyle: 'solid' })))];
      // Anvil block on its stand, section-lined.
      P.anvil = [bake(gen.polygon([[-44, 0], [44, 0], [34, 22], [22, 26], [22, 70], [-22, 70], [-22, 26], [-34, 22]], hatch(510, 5, 45))),
        bake(gen.rectangle(-30, 70, 60, GROUND - ANVIL.y - 70, o(511, { fill: '#000', fillStyle: 'dashed', hachureGap: 8, hachureAngle: 90, dashOffset: 6, dashGap: 5 })))];
      P.post = [bake(gen.rectangle(-9, 0, 18, GROUND - HAM.y, hatch(520, 6, -45)))];
      // Bell: an SVG path hung from its yoke, with a clapper.
      P.bell = [bake(gen.path('M-10 0 C -12 18, -30 30, -34 58 L -40 64 L 40 64 L 34 58 C 30 30, 12 18, 10 0 Z', hatch(530, 5.5, 60)))];
      P.clapper = [bake(gen.line(0, 0, 0, 58, o(531))), bake(gen.circle(0, 62, 11, o(532, { fill: '#000', fillStyle: 'solid' })))];
      // The bell's standard: a bracket arm from a post that stands on the ground.
      const postH = GROUND - (BELL.y - 120);
      P.yoke = [bake(gen.line(-12, 0, 100, 0, o(540))), bake(gen.rectangle(92, -6, 16, postH + 6, hatch(541, 6, -45))), bake(gen.line(100, 34, 40, 0, o(542))),
        bake(gen.circle(0, 0, 10, o(543)))];
      // Governor: spindle, collar, and a ball (reused on both arms).
      P.spindle = [bake(gen.line(0, 0, 0, -150, o(550))), bake(gen.rectangle(-8, -6, 16, 12, o(551)))];
      P.ball = [bake(gen.circle(0, 0, 26, o(552, { fill: '#000', fillStyle: 'cross-hatch', hachureGap: 3.6 })))];
      // Ground line with its hatching.
      P.ground = [bake(gen.line(-820, 0, 820, 0, o(560))), bake(gen.rectangle(-820, 0, 1640, 14, o(561, { stroke: 'none', fill: '#000', fillStyle: 'hachure', hachureAngle: 45, hachureGap: 7 })))];
      // Frame: bearing standards under each axle.
      P.stand = [];
      for (const [x, y, id] of [[GF.x, GF.y, 600], [GB.x, GB.y, 610], [GC.x, GC.y, 620]]) {
        P.stand.push(bake(gen.polygon([[x - 18, y], [x + 18, y], [x + 34, GROUND], [x - 34, GROUND]], o(id, { fill: '#000', fillStyle: 'dashed', hachureGap: 7, hachureAngle: 0, dashOffset: 5, dashGap: 4 }))));
      }
      P.pulleyA = [bake(gen.circle(0, 0, 44, o(700))), bake(gen.circle(0, 0, 12, o(701, { fill: '#000', fillStyle: 'solid' })))];
      P.pulleyB = [bake(gen.circle(0, 0, PUL.r * 2, hatch(710, 5, -30))), bake(gen.circle(0, 0, 14, o(711, { fill: '#000', fillStyle: 'solid' })))];
      P.pulStand = [bake(gen.polygon([[PUL.x - 14, PUL.y], [PUL.x + 14, PUL.y], [PUL.x + 26, GROUND], [PUL.x - 26, GROUND]], o(720)))];
      // Leaders for the reference numerals: [target, label, number].
      P.refs = [];
      const refs = [
        [[GF.x + 60, GF.y + 90], [GF.x + 40, GF.y + 200], '10'],
        [[GB.x + 20, GB.y - 40], [GB.x + 80, GB.y - 150], '12'],
        [[GC.x + 10, GC.y + 30], [GC.x + 90, GC.y + 110], '14'],
        [[ANVIL.x + 20, ANVIL.y + 10], [ANVIL.x + 110, ANVIL.y + 60], '22'],
        [[HAM.x + 6, HAM.y + 10], [HAM.x - 60, HAM.y + 120], '20'],
        [[BELL.x - 30, BELL.y + 40], [BELL.x - 150, BELL.y + 10], '30'],
        [[PUL.x + 20, PUL.y - 20], [PUL.x + 110, PUL.y - 80], '40'],
      ];
      for (let i = 0; i < refs.length; i++) {
        const [t, l, n] = refs[i];
        const m = [(t[0] + l[0]) / 2 + (t[1] - l[1]) * 0.15, (t[1] + l[1]) / 2 - (t[0] - l[0]) * 0.15];
        P.refs.push({ d: bake(gen.curve([l, m, t], o(800 + i, { roughness: Math.min(hand, 1) }))), l, n, drop: n === '40' });
      }
      return P;
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
      const pal = SHEETS[clamp(Math.round(params.sheet), 0, SHEETS.length - 1)];

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.1 : 0.4, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      p.background(pal.paper);
      const R = window.rough;
      if (!R) return;
      if (!this.gen) this.gen = R.generator();
      const gen = this.gen;
      const hand = Math.round(params.hand * 10) / 10;
      const boil = P.boil > 0.2 ? Math.floor(T * P.boil) : 0;
      const pkey = hand + '|' + boil;
      if (!this.parts || this.parts.key !== pkey) { this.parts = this.makeParts(gen, hand, boil); this.parts.key = pkey; }
      const S = this.parts;

      // ---- mechanism state
      const w = 0.25 + 0.9 * P.speed + 0.9 * e.bass * P.speed;
      this.thF += w * dt;
      const thF = this.thF;
      const thB = -thF * GF.n / GB.n + Math.PI / GB.n;
      const thC = -thB * GB.n / GC.n + Math.PI / GC.n;
      this.spin += (1.5 + 3 * w) * dt;
      const spreadT = 0.25 + 0.55 * clamp01(w / 2.4) + 0.25 * e.bass;
      this.spread = ease(this.spread, spreadT, 3, dt);
      this.belt += w * 22 * dt;
      if (hit.kick) { this.lastKick = T; this.kickAmp = clamp01(0.5 + hit.kick) * params.react; }
      // The hammer rises through the beat after a strike and falls on the kick.
      const since = T - this.lastKick;
      const lift = smooth(since / (BEAT * 0.85));
      const up = -0.95 * clamp01(this.kickAmp + 0.15);
      const hamA = since < 4 ? lerp(0.02, up, lift) : lerp(0.02, up, 1);
      if (hit.clap) {
        this.bellV += (this.bellA > 0 ? -1 : 1) * (2.6 + 2 * hit.clap);
        this.rings.push({ t: T, side: this.bellV > 0 ? 1 : -1 });
        if (this.rings.length > 6) this.rings.shift();
      }
      // A damped pendulum.
      this.bellV += (-24 * this.bellA - 2.2 * this.bellV) * dt;
      this.bellA += this.bellV * dt;
      if (hit.hat) { this.rat += TAU / RAT.n; this.lastHat = T; }
      this.ratT = ease(this.ratT, this.rat, 30, dt);

      // ---- view: detail of the flywheel and hammer, or the whole sheet
      const v = smooth(P.view);
      const zoom = lerp(1.45, 0.92, v) * (H / 600);
      const cx = lerp(-60, 10, v), cy = lerp(20, -10, v);
      const drift = 18 * Math.sin(T * 0.07);
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.setLineDash([]);
      g.translate(W / 2, H / 2);
      g.scale(zoom / (H / 600), zoom / (H / 600));
      g.translate(-cx - drift, -cy);
      const lw = 1.6;
      const INK = pal.ink;
      const at = (x, y, a, fn) => { g.save(); g.translate(x, y); if (a) g.rotate(a); fn(); g.restore(); };

      at(0, GROUND, 0, () => { ink(g, S.ground[0], INK, lw * 1.3, null, 0); ink(g, S.ground[1], null, 0, INK, 0.9); });
      g.globalAlpha = 1;
      for (const b of S.stand) ink(g, b, INK, lw, INK, 0.8);
      at(HAM.x, HAM.y, 0, () => ink(g, S.post[0], INK, lw, INK, 0.8));

      // Belt drive (drop): pulley on the flywheel's axle to a second pulley.
      const mod = smooth((P.modules - 0.35) / 0.4);
      if (mod > 0.01) {
        g.globalAlpha = mod;
        for (const b of S.pulStand) ink(g, b, INK, lw, null, 0);
        const ra = 22, rb = PUL.r;
        const dx = PUL.x - GF.x, dy = PUL.y - GF.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const b1 = Math.acos((ra - rb) / L);
        g.strokeStyle = INK;
        g.lineWidth = 1.4;
        g.setLineDash([10, 5]);
        g.lineDashOffset = -this.belt;
        g.beginPath();
        for (const s of [1, -1]) {
          const aa = a + s * b1;
          g.moveTo(GF.x + Math.cos(aa) * ra, GF.y + Math.sin(aa) * ra);
          g.lineTo(PUL.x + Math.cos(aa) * rb, PUL.y + Math.sin(aa) * rb);
        }
        g.stroke();
        g.setLineDash([]);
        at(PUL.x, PUL.y, thF * 22 / rb, () => ink(g, S.pulleyB[0], INK, lw, INK, 0.8));
        at(PUL.x, PUL.y, 0, () => ink(g, S.pulleyB[1], null, 0, INK, 0));
        g.globalAlpha = 1;
      }

      // Gears, each keeping its drawn wobble as it turns.
      const drawGear = (Gd, parts, th) => at(Gd.x, Gd.y, th, () => {
        // Knock out what is behind the gear (its standard), as ink on a
        // real sheet would not cross it.
        g.fillStyle = pal.paper;
        g.beginPath(); g.arc(0, 0, rP(Gd.n) - M * 0.6, 0, TAU); g.fill();
        ink(g, parts[0], INK, lw, INK, 0.8);
        ink(g, parts[1], null, 0, INK, 0);
        g.globalAlpha = 0.35; ink(g, parts[2], INK, 1, null, 0); g.globalAlpha = 1;
        for (let k = 3; k < parts.length; k++) ink(g, parts[k], INK, lw * 1.2, null, 0);
      });
      drawGear(GF, S.F, thF);
      drawGear(GB, S.B, thB);
      drawGear(GC, S.C, thC);
      if (mod > 0.01) { g.globalAlpha = mod; at(GF.x, GF.y, thF, () => ink(g, S.pulleyA[0], INK, lw, null, 0)); g.globalAlpha = 1; }
      // Ratchet on the pinion's axle, stepped by the hats; the pawl rides it.
      at(GC.x + 0, GC.y + 0, this.ratT, () => { g.scale(0.9, 0.9); ink(g, S.rat[0], INK, lw, INK, 0.7); });
      const click = Math.exp(-(T - this.lastHat) / 0.05);
      at(GC.x + RAT.r + 30, GC.y - RAT.r * 0.9, Math.PI * 0.86 - click * 0.25, () => ink(g, S.pawl[0], INK, lw, null, 0));

      // Governor on the intermediate gear's axle.
      const gx = GB.x, gy = GB.y - rP(GB.n) - 14;
      at(gx, gy + 14, 0, () => ink(g, S.spindle[0], INK, lw, null, 0));
      const topY = gy - 150 + 14;
      at(gx, topY, 0, () => ink(g, S.spindle[1], INK, lw, null, 0));
      const armL = 88;
      for (const s of [0, Math.PI]) {
        // Seen from the side, the spinning arms swing across each other.
        const c = Math.cos(this.spin + s);
        const bx = gx + Math.sin(this.spread) * armL * c;
        const by = topY + Math.cos(this.spread) * armL;
        g.strokeStyle = INK; g.lineWidth = lw * 1.2;
        g.beginPath(); g.moveTo(gx, topY); g.lineTo(bx, by); g.stroke();
        at(bx, by, this.spin, () => ink(g, S.ball[0], INK, lw, INK, 0.8));
      }

      // Hammer: arm from the pivot; its swing arc dashed for a moment after a strike.
      at(HAM.x, HAM.y, hamA, () => {
        ink(g, S.arm[0], INK, lw, null, 0);
        at(HAM.len, 0, Math.PI / 2, () => ink(g, S.head[0], INK, lw * 1.2, INK, 0.9));
      });
      at(HAM.x, HAM.y, 0, () => { ink(g, S.pivot[0], INK, lw, null, 0); ink(g, S.pivot[1], null, 0, INK, 0); });
      at(ANVIL.x, ANVIL.y, 0, () => { ink(g, S.anvil[0], INK, lw * 1.2, INK, 0.8); ink(g, S.anvil[1], INK, lw, INK, 0.7); });
      if (since < 0.45) {
        const f = 1 - since / 0.45;
        g.globalAlpha = f;
        g.strokeStyle = INK;
        g.lineWidth = 1.2;
        g.setLineDash([7, 6]);
        g.beginPath();
        g.arc(HAM.x, HAM.y, HAM.len + 26, up, 0.02);
        g.stroke();
        g.setLineDash([]);
        // Strike lines off the anvil face.
        g.lineWidth = 1.6;
        g.beginPath();
        for (let k = -2; k <= 2; k++) {
          const a = k * 0.35 - Math.PI / 2 + Math.PI, r0 = 36, r1 = 36 + 34 * this.kickAmp * (1 - f * 0.3);
          const ox = ANVIL.x + 44, oy = ANVIL.y - 4;
          g.moveTo(ox + Math.cos(a + Math.PI) * -r0, oy + Math.sin(a) * r0 * 0.6);
          g.lineTo(ox + Math.cos(a + Math.PI) * -r1, oy + Math.sin(a) * r1 * 0.6);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
      // Spring from the post to the arm, stretched as the hammer rises.
      {
        const ax = HAM.x + Math.cos(hamA) * 70, ay = HAM.y + Math.sin(hamA) * 70;
        const bx = HAM.x + 40, by = HAM.y + 120;
        const n = 14, pts = [];
        const dx = ax - bx, dy = ay - by, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        for (let k = 0; k <= n; k++) {
          const u = k / n, s = k === 0 || k === n ? 0 : (k % 2 ? 1 : -1) * 8;
          pts.push([bx + dx * u + nx * s, by + dy * u + ny * s]);
        }
        ink(g, bake(gen.linearPath(pts, { roughness: hand * 0.6, seed: seedOf(900, boil, 1) })), INK, lw * 0.9, null, 0);
      }
      // Bell on its yoke; rings go out as arcs on the side it swung to.
      at(BELL.x, BELL.y - 120, 0, () => { ink(g, S.yoke[0], INK, lw, null, 0); ink(g, S.yoke[1], INK, lw, INK, 0.8); ink(g, S.yoke[2], INK, lw, null, 0); });
      at(BELL.x, BELL.y - 120, this.bellA * 0.5, () => {
        ink(g, S.yoke[3], INK, lw, null, 0);
        at(0, 30, 0, () => {
          ink(g, S.bell[0], INK, lw * 1.2, INK, 0.8);
          at(0, 4, -this.bellA * 0.8, () => { ink(g, S.clapper[0], INK, lw, null, 0); ink(g, S.clapper[1], null, 0, INK, 0); });
        });
      });
      g.lineWidth = 1.3;
      g.strokeStyle = INK;
      for (const r of this.rings) {
        const age = T - r.t;
        if (age > 1.4) continue;
        const rad = 70 + age * 170;
        g.globalAlpha = 1 - age / 1.4;
        for (const s of [-1, 1]) {
          g.beginPath();
          const c = s > 0 ? 0 : Math.PI;
          g.arc(BELL.x, BELL.y - 50, rad, c - 0.45, c + 0.45);
          g.stroke();
        }
      }
      g.globalAlpha = 1;

      // Reference numerals.
      g.fillStyle = INK;
      g.font = 'italic 700 22px "Libre Baskerville", Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const rf of S.refs) {
        const a = rf.drop ? mod : 1;
        if (a < 0.02) continue;
        g.globalAlpha = a;
        ink(g, rf.d, INK, 1.1, null, 0);
        g.fillText(rf.n, rf.l[0] + (rf.l[0] > 0 ? 14 : -14), rf.l[1] + 10);
      }
      g.globalAlpha = 1;
      g.font = 'italic 700 34px "Libre Baskerville", Georgia, serif';
      g.fillText('FIG. 1', GF.x - 150, -170);
      g.restore();

      // The sheet's own furniture, in screen space.
      g.save();
      g.fillStyle = pal.ink;
      g.globalAlpha = 0.8;
      g.font = '14px "Libre Baskerville", Georgia, serif';
      g.textAlign = 'right';
      g.textBaseline = 'alphabetic';
      g.fillText('Sheet 1 of 3', W - 28, 34);
      g.textAlign = 'left';
      g.fillText('Rhythm Engine', 28, 34);
      g.restore();
    },
  });
})();
