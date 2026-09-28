// Cubist: an analytic-cubist still life as a poster. An oval canvas on cream
// stock holds a guitar, a bottle, a glass and a folded newspaper on a table,
// seen through a shattered crystal of planes: each plane is a separate
// viewpoint, so the objects break at its edges and re-join a little rotated,
// shifted and re-shaded, in ochre, grey, umber and cream. Stencilled letters are
// sprayed across the canvas, as Braque did from 1911; the poster's headline is
// cut stencil type beside it, with typewritten lines under it.
//
// Music, each in its own place:
//   kick   one plane near the guitar turns: its view of the still life rotates
//          a step, its light swings round and it catches the light for a
//          moment; the guitar strings twang with it
//   snare  a different event: the next stencilled letter of a word is sprayed
//          onto the canvas, so the clap spells words across the picture
//   bass   the fracture itself: how far the planes' viewpoints diverge, so the
//          still life is nearly whole in the quiet and shatters in the drop;
//          the strings hum with the bass line
//   hats   small brush dabs catch the light across the picture
//   drop   more planes, a second colour (a muted green, a brick red), and three
//          papiers collés slide in (faux-bois, newsprint, a scrap of sheet
//          music); the headline re-sets. The breakdown merges the planes back
//          and the still life reassembles.
// Movement: the viewpoint slowly orbits the table, and each plane has its own
// depth, so the planes slide past each other with parallax.
// Plain Canvas 2D: flat fills with passage shading, broken charcoal edges,
// paper grain multiplied over everything. No glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);

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

  // A value that tweens from wherever it is now; a retarget mid-flight never jumps.
  function Tw(v) { return { from: v, to: v, t0: 0, dur: 0, ease: easeInOut }; }
  function twGet(tw, t) {
    if (tw.dur <= 0) return tw.to;
    const u = clamp((t - tw.t0) / tw.dur, 0, 1);
    return lerp(tw.from, tw.to, tw.ease(u));
  }
  function twDone(tw, t) { return tw.dur <= 0 || t >= tw.t0 + tw.dur; }
  function twSet(tw, v, t, dur, ease) {
    tw.from = twGet(tw, t); tw.to = v; tw.t0 = t; tw.dur = dur; tw.ease = ease || easeInOut;
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const rgb = (c, a) => a === undefined
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

  // Families are [light, dark] pairs: a plane is shaded from one to the other
  // (passage). 0-3 are the analytic tones; 4 and 5 are the drop's second colours.
  const PALETTES = [
    { name: 'Braque ochre', paper: '#E7DCC3', ground: '#7E6440', ink: '#2B2016', brick: '#8E3A22',
      fams: [['#DDB86F', '#5E4020'], ['#C9BEA4', '#4A4034'], ['#B98450', '#33210F'], ['#EEE0BE', '#8E7A55'],
        ['#A3AC86', '#3E4934'], ['#C07A55', '#5A2616']],
      weights: [0.4, 0.2, 0.28, 0.12] },
    { name: 'Picasso silver', paper: '#E3E0D6', ground: '#85806F', ink: '#23211D', brick: '#7E3B2A',
      fams: [['#CFC8B4', '#5A554A'], ['#B9BCB6', '#3D4244'], ['#C2A479', '#54402A'], ['#E8E4D8', '#8C897E'],
        ['#98A597', '#34403A'], ['#B98666', '#4F2A1C']],
      weights: [0.3, 0.36, 0.16, 0.18] },
    { name: 'Collage', paper: '#EADFC6', ground: '#8E7650', ink: '#221A12', brick: '#A23E22',
      fams: [['#DDB56C', '#6E4A1E'], ['#A9AE8C', '#3F4834'], ['#BE7E4F', '#43261A'], ['#EFE4C8', '#9A8866'],
        ['#9CAFA4', '#2E4540'], ['#C8704A', '#5C2414']],
      weights: [0.3, 0.26, 0.28, 0.16] },
  ];

  // Headlines: original French about music, night and dancing.
  const HEADS = [
    ['NUIT', 'DE', 'SON'],
    ['LA', 'DANSE', 'LENTE'],
    ['CORDES', 'ET', 'NUIT'],
    ['ÉCHO', 'DU', 'SOIR'],
  ];
  const TYPE_LINES = [
    'une soirée de musique',
    'guitare · verre · bouteille',
    'de minuit jusqu\'à l\'aube',
  ];

  const STENCIL = '"Abril Fatface", "Bodoni 72", "Didot", serif';
  const TYPEWRITER = '"Special Elite", "Courier New", monospace';

  // Where a stencil needs bridges so its counters don't fall out.
  function bridges(ch) {
    if ('OQCG0'.includes(ch)) return [[0.5, 0, 1]];
    if ('AÀÂ'.includes(ch)) return [[0.5, 0, 0.42]];
    if ('BDPRÉ'.includes(ch)) return ch === 'É' ? [] : [[0.34, 0, 1]];
    if (ch === 'S') return [[0.5, 0, 0.3], [0.5, 0.7, 1]];
    return [];
  }

  // Convex polygon split by the line through (px,py) with normal (nx,ny).
  function splitPoly(poly, px, py, nx, ny) {
    const A = [], B = [], seg = [];
    const n = poly.length / 2;
    for (let i = 0; i < n; i++) {
      const x0 = poly[2 * i], y0 = poly[2 * i + 1];
      const j = (i + 1) % n;
      const x1 = poly[2 * j], y1 = poly[2 * j + 1];
      const d0 = (x0 - px) * nx + (y0 - py) * ny;
      const d1 = (x1 - px) * nx + (y1 - py) * ny;
      if (d0 <= 0) A.push(x0, y0); else B.push(x0, y0);
      if ((d0 <= 0) !== (d1 <= 0)) {
        const u = d0 / (d0 - d1);
        const ix = x0 + (x1 - x0) * u, iy = y0 + (y1 - y0) * u;
        A.push(ix, iy); B.push(ix, iy); seg.push(ix, iy);
      }
    }
    return { A, B, seg };
  }
  function centroid(poly) {
    let x = 0, y = 0; const n = poly.length / 2;
    for (let i = 0; i < n; i++) { x += poly[2 * i]; y += poly[2 * i + 1]; }
    return [x / n, y / n];
  }
  function area(poly) {
    let a = 0; const n = poly.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += poly[2 * i] * poly[2 * j + 1] - poly[2 * j] * poly[2 * i + 1];
    }
    return Math.abs(a) / 2;
  }

  VIZ.register({
    id: 'cubist',
    name: 'Cubist',
    order: 504,

    params: [
      { key: 'fracture', label: 'Fracture', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'facets', label: 'Planes', type: 'range', min: 0.5, max: 1.6, default: 1, step: 0.01 },
      { key: 'orbit', label: 'Orbit speed', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'shape', label: 'Canvas', type: 'select', options: ['Oval', 'Rectangle'], default: 0 },
      { key: 'words', label: 'Stencilled words', type: 'text', default: 'SON NUIT DANSE ÉCHO' },
    ],

    actions: [
      { id: 'reshatter', label: 'Re-shatter', run() { this.wantReset = true; } },
    ],

    gallery: {
      title: 'Cubist',
      technique: 'Canvas 2D: the still life is drawn once a frame into an offscreen layer, then composited through every plane of a binary space partition of the oval, each clipped plane with its own rotation, parallax offset and passage-shaded gradient; split lines drift and are stroked as broken charcoal edges; stencil letters are Abril Fatface cut with bridges on an offscreen canvas; papiers collés are pre-rendered textures; a grain tile is multiplied over the sheet; onset detection against the previous frame',
      brief: 'An analytic-cubist poster alive. An oval canvas on cream stock: a guitar, a bottle, a glass and a folded newspaper on a table, broken into faceted planes of ochre, grey, umber and cream, each plane a slightly different viewpoint, so the objects break at the edges and re-join rotated. The viewpoint slowly orbits the table and the planes slide past each other with parallax. Each kick turns one plane near the guitar (its view rotates, its light swings round, it catches the light) and twangs the strings; each clap sprays the next stencilled letter of a word across the canvas; the bass line drives how far the viewpoints diverge, so the still life is nearly whole in the quiet and shatters in the drop; hats make small brush dabs catch the light. The drop adds planes, a second colour (muted green and brick), and slides in three papiers collés: faux-bois, newsprint and a scrap of sheet music. The breakdown merges the planes and the still life reassembles. Beside it the headline in cut stencil letters and typewritten lines in French about music and night.',
      lineage: [
        'Georges Braque and Pablo Picasso\'s analytic cubism (1909-12): the oval still lifes with guitars, bottles, glasses and newspaper fragments, passage shading that lets a plane bleed into its neighbour, the small directional brush dabs, and Braque\'s stencilled letters (from 1911) and faux-bois papiers collés (1912). Batch 05 brief entry "04 · Cubist". All words are original (headlines NUIT DE SON, LA DANSE LENTE, CORDES ET NUIT, ÉCHO DU SOIR; the invented newsprint mastheads NOCTU… and LA NOCE); no work is copied.',
        'Built as a binary space partition of the oval whose split lines drift; the still life is drawn once a frame to an offscreen layer and composited through every plane with that plane\'s own rotation, depth-scaled parallax offset and passage gradient, so the objects break at every edge. New planes inherit their parent\'s view and gradient and diverge over a second; merged pairs converge first, so re-division never pops. Stencils are Abril Fatface cut with bridges where a plate would hold its counters.',
        'Process: the first render read at once as a cubist poster but too grey, with the brush dabs all at one angle so they read as rain; the palette was warmed, the dabs shortened and given per-patch directions, and the oval fade softened. The drop\'s faux-bois strip covered the guitar head and the collage was shrunk and moved. The headline stack overlapped (line advance used the previous line\'s size). Jolt at 640x360 first came out calm but nearly invisible (area 0.02): a kicked plane was being split by the drop\'s re-division within a frame or two, and children inherited a stale rotation, so the flash vanished. Fixed by carrying flash and rotation into children and leaving a turned plane whole until it settles; kicks now prefer larger central planes and the drop turns two, with a charcoal contour while the plane holds the light: calm, area 0.041, ratio 2.25, with clear local hot spots. A 96 s run (four loops) stays alive: the headline cycles through all four, each drop brings the collage back, and the planes neither pile up nor empty out.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.root) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10; this.lastStamp = -10;
      this.kickCount = 0; this.snareCount = 0;
      this.low = 0; this.drop = false; this.hadDrop = false;
      this.bassEnv = 0; this.hatSlow = 0; this.energy = 0; this.kickEnv = 0;
      this.orbitClock = 0; this.driftClock = 0;
      this.frac = 0.3;
      this.nextId = 1;
      this.root = this.newNode(null);
      this.letters = [];          // stencilled letters sprayed on the canvas
      this.word = { i: -1, pos: 0, anchor: 0, t: -10 };
      this.dabs = [];             // hat sparkles
      this.collage = null;
      this.head = { i: 0, t0: -10 }; this.prevHead = null;
      this.lastGrow = -10;
      this.wantReset = false;
      this.letterCache = new Map();
      this.layerKey = '';
      for (let k = 0; k < 17; k++) this.grow(0, true);
    },

    newNode(parent, t) {
      t = t || 0;
      const r = this.rng;
      const pal = PALETTES[0].weights;
      let fam = 0, x = r() * (pal[0] + pal[1] + pal[2] + pal[3]);
      for (let i = 0; i < 4; i++) { x -= pal[i]; if (x <= 0) { fam = i; break; } }
      // Split lines lean on the cubist scaffold: verticals, horizontals and
      // steep diagonals, each a little off true.
      const axes = [Math.PI / 2, 0, Math.PI / 3, -Math.PI / 3, Math.PI / 6, -Math.PI / 5, Math.PI / 2, Math.PI / 2.3];
      const n = {
        id: this.nextId++, kids: null, poly: null, seg: null,
        a0: axes[Math.floor(r() * axes.length)] + (r() - 0.5) * 0.25,
        ph: r() * 6.283, off: (r() - 0.5) * 0.5, s0: r() * 0.2, s1: 0.75 + r() * 0.25, lit: r() < 0.35,
        edgeGrow: Tw(1), edgeAlpha: Tw(1), dying: false,
        // Leaf state (a plane's viewpoint).
        z: Tw(parent ? twGet(parent.z, t) : (r() * 2 - 1)),
        zr: parent ? parent.zr : (r() * 2 - 1),
        rot: Tw(0), relaxAt: -1,
        shade: Tw(parent ? twGet(parent.shade, t) : r() * 6.283),
        fam: parent ? parent.fam : fam, fam2: parent ? parent.fam2 : fam, famMix: Tw(1),
        flash: parent ? parent.flash : 0, inh: Tw(0),
      };
      if (parent) {
        n.rot = Tw(twGet(parent.rot, t)); n.relaxAt = parent.relaxAt;
        n.famMix = Tw(twGet(parent.famMix, t));
        if (!twDone(parent.famMix, t)) twSet(n.famMix, parent.famMix.to, t, parent.famMix.t0 + parent.famMix.dur - t);
      }
      return n;
    },

    leaves(n, out) {
      n = n || this.root; out = out || [];
      if (n.kids) { this.leaves(n.kids[0], out); this.leaves(n.kids[1], out); } else out.push(n);
      return out;
    },
    nodes(n, out) {
      n = n || this.root; out = out || [];
      out.push(n);
      if (n.kids) { this.nodes(n.kids[0], out); this.nodes(n.kids[1], out); }
      return out;
    },
    liveCount() { return this.leaves().filter((l) => !l.dyingLeaf).length; },

    // Split the largest plane near the middle into two views of the same thing.
    grow(t, instant) {
      const ls = this.leaves();
      let best = null, bs = -1;
      for (const l of ls) {
        // A plane still turning from a kick is left whole until it settles.
        if (l.dyingLeaf || l.flash > 0.1) continue;
        const a = l.poly ? area(l.poly) : 1;
        const c = l.poly ? centroid(l.poly) : [0, 0];
        const d = l.poly && this.pc ? Math.hypot((c[0] - this.pc[0]) / this.pw, (c[1] - this.pc[1]) / this.ph) : 0;
        const s = a * (1.2 - Math.min(1, d)) * (0.7 + 0.6 * this.rng());
        if (s > bs) { bs = s; best = l; }
      }
      if (!best) return;
      const k0 = this.newNode(best, t), k1 = this.newNode(best, t);
      for (const k of [k0, k1]) {
        k.inh = Tw(instant ? 0 : 1);
        if (!instant) {
          twSet(k.inh, 0, t, 1.1);
          twSet(k.z, this.rng() * 2 - 1, t, 1.6);
        }
      }
      if (!instant && this.rng() < 0.5) { k1.fam2 = Math.floor(this.rng() * 4); twSet(k1.famMix, 1, t, 1.2); k1.famMix.from = 0; k1.fam = best.fam2; }
      best.kids = [k0, k1];
      best.edgeGrow = Tw(instant ? 1 : 0);
      if (!instant) twSet(best.edgeGrow, 1, t, 0.7, easeOut);
      best.edgeAlpha = Tw(1); best.dying = false;
    },

    // Merge two sibling planes back into one view.
    shrink(t) {
      const cands = this.nodes().filter((n) => n.kids && !n.kids[0].kids && !n.kids[1].kids && !n.dying && n !== this.root);
      if (!cands.length) return;
      let best = cands[0], ba = 1e9;
      for (const c of cands) { const a = c.poly ? area(c.poly) : 0; const s = a * (0.6 + 0.8 * this.rng()); if (s < ba) { ba = s; best = c; } }
      best.dying = true;
      twSet(best.edgeAlpha, 0, t, 1.0);
      const k0 = best.kids[0], z0 = twGet(k0.z, t);
      for (const k of best.kids) {
        k.dyingLeaf = true;
        twSet(k.inh, 1, t, 1.0);
        twSet(k.z, z0, t, 1.0);
        twSet(k.rot, 0, t, 1.0);
        twSet(k.shade, k0.shade.to, t, 1.0);
      }
      const k1 = best.kids[1];
      if (k1.fam2 !== k0.fam2) { k1.fam = twGet(k1.famMix, t) > 0.5 ? k1.fam2 : k1.fam; k1.fam2 = k0.fam2; k1.famMix = Tw(0); twSet(k1.famMix, 1, t, 1.0); }
    },

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; this.kickCount++; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; this.snareCount++; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.03) : k(0.2));
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(1.2);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.4);
      return { kick, snare, hat };
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (this.wantReset) this.init();
      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      const react = params.reaction;
      const g = p.drawingContext;

      // ---- layout: the canvas plus a type column (landscape) or band (portrait)
      const m = Math.min(W, H) * 0.055;
      const land = W / H >= 1.2;
      let px, py, pw, ph, tx, ty, tw, th;
      if (land) {
        ph = H - 2 * m; pw = Math.min(ph * 1.34, W - 3 * m - Math.min(W, H) * 0.42);
        px = m; py = m;
        tx = px + pw + m * 0.9; ty = m; tw = W - tx - m; th = H - 2 * m;
      } else {
        pw = W - 2 * m; ph = Math.min(H * 0.62, pw * 1.2);
        px = m; py = m; tx = m; ty = py + ph + m * 0.7; tw = W - 2 * m; th = H - ty - m;
      }
      this.pc = [px + pw / 2, py + ph / 2]; this.pw = pw; this.ph = ph;
      const U = Math.min(ph, pw / 1.25);          // still-life unit
      const oval = Math.round(params.shape) === 0;

      // ---- music
      const ev = this.analyse(signals, t, dt);
      if (!this.drop && this.low > 30) { this.drop = true; this.hadDrop = true; this.onDrop(t, true); }
      else if (this.drop && this.low < 16) { this.drop = false; this.onDrop(t, false); }
      const kicksRecent = t - this.lastKick < 2.2;
      this.kickEnv *= Math.exp(-dt / 0.16);

      // How far viewpoints diverge: nearly whole in the quiet, shattered in the drop.
      const fracTarget = params.fracture * (0.28 + 0.5 * this.energy + 0.22 * this.bassEnv + (kicksRecent ? 0.08 : 0));
      this.frac += (fracTarget - this.frac) * (1 - Math.exp(-dt / 0.5));
      const motion = params.orbit;
      this.orbitClock += dt * motion * (0.16 + 0.22 * this.energy);
      this.driftClock += dt * (0.2 + 0.35 * this.energy) * (0.3 + 0.7 * motion);

      // Plane count follows the section.
      const target = Math.round((this.drop ? 40 : kicksRecent ? 26 : this.hadDrop ? 14 : 18) * params.facets);
      const live = this.liveCount();
      if (t - this.lastGrow > (this.drop ? 0.18 : 0.45)) {
        if (live < target) { this.grow(t, false); this.lastGrow = t; }
        else if (live > target + 1) { this.shrink(t); this.lastGrow = t; }
      }
      // Remove merged pairs once their views have converged.
      for (const n of this.nodes()) {
        if (n.dying && twDone(n.edgeAlpha, t)) {
          const k0 = n.kids[0];
          n.kids = null; n.dying = false; n.edgeAlpha = Tw(1);
          n.inh = Tw(0); n.rot = Tw(0); n.flash = 0;
          n.z = Tw(twGet(k0.z, t)); n.shade = Tw(k0.shade.to);
          n.fam = k0.fam2; n.fam2 = k0.fam2; n.famMix = Tw(1);
        }
      }

      // ---- geometry: recompute every plane from the drifting split lines
      const pcx = px + pw / 2, pcy = py + ph / 2;
      let rootPoly = [];
      if (oval) {
        const N = 56;
        for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; rootPoly.push(pcx + Math.cos(a) * pw / 2, pcy + Math.sin(a) * ph / 2); }
      } else rootPoly = [px, py, px + pw, py, px + pw, py + ph, px, py + ph];
      const dc = this.driftClock;
      const lay = (n, poly) => {
        n.poly = poly;
        const c = centroid(poly); n.cx = c[0]; n.cy = c[1];
        if (!n.kids) return;
        const ang = n.a0 + 0.16 * Math.sin(dc * 0.9 + n.ph) + 0.05 * Math.sin(dc * 0.37 + n.ph * 2);
        const nx = Math.cos(ang), ny = Math.sin(ang);
        const ext = Math.sqrt(area(poly));
        const o = (n.off + 0.12 * Math.sin(dc * 0.6 + n.ph * 3)) * ext * 0.5;
        const sp = splitPoly(poly, c[0] + nx * o, c[1] + ny * o, nx, ny);
        if (sp.A.length < 6 || sp.B.length < 6 || sp.seg.length < 4) {
          n.seg = null;
          lay(n.kids[0], poly); lay(n.kids[1], poly);   // degenerate this frame: both see the whole
          return;
        }
        n.seg = sp.seg;
        lay(n.kids[0], sp.A); lay(n.kids[1], sp.B);
      };
      lay(this.root, rootPoly);
      const leaves = this.leaves();

      // ---- beat events
      if (ev.kick) { this.onKick(t, leaves, react, null); if (this.drop) this.onKick(t, leaves, react, this.lastKicked); }
      if (ev.snare) this.onSnare(t, params, px, py, pw, ph, U);
      if (ev.hat) {
        const nn = this.drop ? 3 : 2;
        for (let i = 0; i < nn; i++) {
          const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * 0.42;
          this.dabs.push({ x: pcx + Math.cos(a) * r * pw, y: pcy + Math.sin(a) * r * ph * 0.9, a: -0.9 + this.rng() * 0.5, t0: t, len: 0.02 + this.rng() * 0.02 });
        }
      }
      this.dabs = this.dabs.filter((d) => t - d.t0 < 0.5);
      for (const l of leaves) {
        l.flash *= Math.exp(-dt / 0.55);
        if (l.relaxAt > 0 && t > l.relaxAt) { twSet(l.rot, 0, t, 3.2); l.relaxAt = -1; }
        if (l.famMix.to === 1 && twDone(l.famMix, t) && l.fam !== l.fam2) { l.fam = l.fam2; }
      }

      // ---- paint
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.setLineDash([]); g.lineCap = 'round'; g.lineJoin = 'round';
      g.fillStyle = pal.paper; g.fillRect(0, 0, W, H);

      // Offscreen layer for the still life, device resolution.
      const dev = p.width * p.pixelDensity() / W;
      const cw = Math.max(1, Math.round(W * dev)), chh = Math.max(1, Math.round(H * dev));
      if (!this.layer) { this.layer = document.createElement('canvas'); this.lg = this.layer.getContext('2d'); }
      const key = cw + 'x' + chh + ':' + Math.round(params.palette) + ':' + px.toFixed(1) + pw.toFixed(1);
      if (this.layer.width !== cw || this.layer.height !== chh) { this.layer.width = cw; this.layer.height = chh; }
      if (this.layerKey !== key) { this.layerKey = key; this.bakeDabs(cw, chh, dev, pcx, pcy, pw, ph, pal); }
      const lg = this.lg;
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.clearRect(0, 0, cw, chh);
      lg.globalAlpha = 1;
      lg.drawImage(this.dabCanvas, 0, 0);
      lg.setTransform(dev, 0, 0, dev, 0, 0);
      const vib = clamp(this.bassEnv * 0.7 + this.kickEnv * react, 0, 1.6);
      this.drawStillLife(lg, pcx, pcy + ph * 0.02, U, pal, t, vib);
      // Hat dabs catch the light, inside the layer so each plane re-views them.
      lg.lineCap = 'round';
      for (const d of this.dabs) {
        const u = (t - d.t0) / 0.5, a = (1 - u) * (1 - u);
        lg.strokeStyle = rgb(hex('#F6EEDA'), 0.85 * a);
        lg.lineWidth = U * 0.012;
        lg.beginPath();
        lg.moveTo(d.x, d.y); lg.lineTo(d.x + Math.cos(d.a) * d.len * U, d.y + Math.sin(d.a) * d.len * U);
        lg.stroke();
      }

      // Ground behind everything inside the canvas.
      g.save();
      this.clipPanel(g, oval, px, py, pw, ph);
      g.fillStyle = pal.ground; g.fillRect(px, py, pw, ph);

      // Each plane: passage-shaded fill, then its own view of the still life.
      const ox = Math.cos(this.orbitClock), oy = Math.sin(this.orbitClock * 0.8);
      const F = this.frac;
      const famRgb = pal.fams.map((f) => [hex(f[0]), hex(f[1])]);
      const parentOf = new Map();
      for (const n of this.nodes()) if (n.kids) { parentOf.set(n.kids[0], n); parentOf.set(n.kids[1], n); }
      for (const l of leaves) {
        const poly = l.poly;
        if (!poly || poly.length < 6) continue;
        const cx = l.cx, cy = l.cy;
        const zz = twGet(l.z, t);
        // Gradient ends: along the light direction, across this plane (or its parent's, while it inherits).
        const sa = twGet(l.shade, t), dx = Math.cos(sa), dy = Math.sin(sa);
        let lo = 1e9, hi = -1e9;
        const proj = (pp) => { for (let i = 0; i < pp.length; i += 2) { const v = (pp[i] - cx) * dx + (pp[i + 1] - cy) * dy; if (v < lo) lo = v; if (v > hi) hi = v; } };
        proj(poly);
        const inh = twGet(l.inh, t);
        const par = parentOf.get(l);
        if (inh > 0.001 && par && par.poly) {
          const lo0 = lo, hi0 = hi; lo = 1e9; hi = -1e9; proj(par.poly);
          lo = lerp(lo0, lo, inh); hi = lerp(hi0, hi, inh);
        }
        const fm = twGet(l.famMix, t);
        const A = mix3(famRgb[l.fam][0], famRgb[l.fam2][0], fm);
        const B = mix3(famRgb[l.fam][1], famRgb[l.fam2][1], fm);
        const fl = clamp(l.flash, 0, 1);
        const light = mix3(A, [252, 246, 230], fl * 0.75);
        const grad = g.createLinearGradient(cx + dx * lo, cy + dy * lo, cx + dx * hi, cy + dy * hi);
        grad.addColorStop(0, rgb(light));
        grad.addColorStop(0.55, rgb(mix3(light, B, 0.45)));
        grad.addColorStop(1, rgb(mix3(B, light, fl * 0.6)));
        g.save();
        g.beginPath();
        g.moveTo(poly[0], poly[1]);
        for (let i = 2; i < poly.length; i += 2) g.lineTo(poly[i], poly[i + 1]);
        g.closePath();
        g.clip();
        g.fillStyle = grad;
        g.fillRect(px - 2, py - 2, pw + 4, ph + 4);
        // The view: rotated about the plane's centre, shifted by the orbiting
        // viewpoint in proportion to the plane's depth.
        const rot = F * 0.16 * l.zr * Math.sin(this.orbitClock * 0.7 + zz * 2) + twGet(l.rot, t);
        const shx = (ox * zz * 0.055 + 0.02 * l.zr) * U * F;
        const shy = (oy * zz * 0.035) * U * F;
        g.translate(cx + shx, cy + shy);
        g.rotate(rot);
        const sc = 1 + 0.05 * F * zz;
        g.scale(sc, sc);
        g.translate(-cx, -cy);
        g.globalAlpha = 0.9;
        g.drawImage(this.layer, 0, 0, W, H);
        g.restore();
        // The turned plane is drawn round in charcoal while it holds the light.
        if (fl > 0.04) {
          g.strokeStyle = rgb(hex(pal.ink), 0.8 * fl);
          g.lineWidth = U * 0.007;
          g.beginPath();
          g.moveTo(poly[0], poly[1]);
          for (let i = 2; i < poly.length; i += 2) g.lineTo(poly[i], poly[i + 1]);
          g.closePath();
          g.stroke();
        }
      }

      // Broken charcoal edges along the split lines.
      g.globalAlpha = 1;
      for (const n of this.nodes()) {
        if (!n.kids || !n.seg) continue;
        const s = n.seg, gr = twGet(n.edgeGrow, t), al = twGet(n.edgeAlpha, t);
        if (al < 0.01 || gr < 0.01) continue;
        const x0 = s[0], y0 = s[1], x1 = s[2], y1 = s[3];
        const a = n.s0, b = n.s0 + (n.s1 - n.s0) * gr;
        const ax = lerp(x0, x1, a), ay = lerp(y0, y1, a), bx = lerp(x0, x1, b), by = lerp(y0, y1, b);
        g.strokeStyle = rgb(hex(pal.ink), 0.62 * al);
        g.lineWidth = U * 0.0042;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        if (n.lit) {
          const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
          const o = U * 0.006;
          g.strokeStyle = rgb(hex('#F3E9D2'), 0.45 * al);
          g.lineWidth = U * 0.003;
          g.beginPath(); g.moveTo(ax + nx / nl * o, ay + ny / nl * o); g.lineTo(bx + nx / nl * o, by + ny / nl * o); g.stroke();
        }
      }

      // Papiers collés (drop).
      if (this.collage) this.drawCollage(g, t, pcx, pcy, U, pal);

      // Stencilled letters sprayed across the canvas.
      this.drawLetters(g, t, U, pal, dev);

      // The picture dissolves toward the edge of the oval, as analytic canvases do.
      if (oval) {
        g.save();
        g.translate(pcx, pcy); g.scale(pw / 2, ph / 2);
        const rg = g.createRadialGradient(0, 0, 0.8, 0, 0, 1.0);
        const pp = hex(pal.paper);
        rg.addColorStop(0, rgb(pp, 0)); rg.addColorStop(0.6, rgb(pp, 0.18)); rg.addColorStop(1, rgb(pp, 0.62));
        g.fillStyle = rg; g.fillRect(-1, -1, 2, 2);
        g.restore();
      }
      g.restore();   // unclip

      // Canvas edge: a thin drawn line (oval) or a plate mark (rectangle).
      g.strokeStyle = rgb(hex(pal.ink), 0.5);
      g.lineWidth = U * 0.003;
      g.beginPath();
      if (oval) g.ellipse(pcx, pcy, pw / 2, ph / 2, 0, 0, Math.PI * 2); else g.rect(px, py, pw, ph);
      g.stroke();

      // ---- poster type
      this.drawType(g, t, tx, ty, tw, th, land, pal, dev);

      // Paper grain over everything.
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.5;
      g.fillStyle = this.grain(g);
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.restore();
    },

    clipPanel(g, oval, px, py, pw, ph) {
      g.beginPath();
      if (oval) g.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2);
      else g.rect(px, py, pw, ph);
      g.clip();
    },

    // ---- events ---------------------------------------------------------------

    onKick(t, leaves, react, avoid) {
      if (react <= 0.01) return;
      this.kickEnv = 1;
      // A plane near the guitar, of moderate size, not the one turned last time.
      const [cx, cy] = this.pc;
      let best = null, bs = -1;
      for (const l of leaves) {
        if (!l.poly || l.dyingLeaf || l === this.lastKicked || l === avoid || l.flash > 0.3) continue;
        const a = area(l.poly) / (this.pw * this.ph);
        if (a < 0.03 || a > 0.16) continue;
        const d = Math.hypot((l.cx - cx) / this.pw, (l.cy - cy) / this.ph);
        const s = (1 - Math.min(1, d * (avoid ? 0.9 : 1.6))) * Math.sqrt(a) * (0.4 + this.rng());
        if (s > bs) { bs = s; best = l; }
      }
      if (!best) return;
      this.lastKicked = best;
      const dir = this.rng() < 0.5 ? -1 : 1;
      twSet(best.rot, clamp(twGet(best.rot, t) + dir * (0.24 + 0.1 * this.rng()) * react, -0.6, 0.6), t, 0.2, easeOut);
      twSet(best.shade, best.shade.to + dir * (1.2 + this.rng() * 0.8), t, 0.3, easeOut);
      best.flash = Math.min(1, 0.85 * react);
      best.relaxAt = t + 1.2;
    },

    onSnare(t, params, px, py, pw, ph, U) {
      if (t - this.lastStamp < 0.2) return;
      this.lastStamp = t;
      const words = String(params.words || '').toUpperCase().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const w = this.word;
      if (w.i < 0 || w.pos >= words[w.i % words.length].length) {
        // Start the next word elsewhere; the last one fades off.
        for (const L of this.letters) if (L.fade < 0) L.fade = t;
        w.i = (w.i + 1) % words.length; w.pos = 0;
        const anchors = [[0.1, 0.24, -0.04], [0.52, 0.2, 0.05], [0.14, 0.78, 0.02], [0.5, 0.74, -0.06], [0.3, 0.12, 0.0]];
        w.anchor = (w.anchor + 1 + Math.floor(this.rng() * 2)) % anchors.length;
        const a = anchors[w.anchor];
        w.x = px + pw * a[0]; w.y = py + ph * a[1]; w.ang = a[2];
        w.size = U * (0.11 + 0.04 * this.rng());
      }
      const word = words[w.i % words.length];
      const ch = word[w.pos];
      const adv = w.size * 0.72;
      this.letters.push({ ch, x: w.x + Math.cos(w.ang) * adv * w.pos, y: w.y + Math.sin(w.ang) * adv * w.pos,
        ang: w.ang + (this.rng() - 0.5) * 0.04, size: w.size, t0: t, fade: -1, ink: this.drop && this.rng() < 0.35 ? 1 : 0 });
      w.pos++;
      this.letters = this.letters.filter((L) => L.fade < 0 || t - L.fade < 2.5);
      if (this.letters.length > 16) this.letters.shift();
    },

    onDrop(t, on) {
      if (on) {
        // A second colour enters some planes; the collage slides in.
        for (const l of this.leaves()) {
          if (this.rng() < 0.3) { l.fam = l.fam2; l.fam2 = 4 + Math.floor(this.rng() * 2); l.famMix = Tw(0); twSet(l.famMix, 1, t, 1.4); }
        }
        this.collage = this.collage || this.makeCollage();
        for (const c of this.collage) twSet(c.in, 1, t + c.delay, 1.1, easeOut), (c.in.t0 = t + c.delay);
        this.setHead((this.head.i + 1) % HEADS.length, t);
      } else {
        for (const l of this.leaves()) {
          if (l.fam2 >= 4) { l.fam = l.fam2; l.fam2 = Math.floor(this.rng() * 4); l.famMix = Tw(0); twSet(l.famMix, 1, t, 3); }
        }
        if (this.collage) for (const c of this.collage) twSet(c.in, 0, t + c.delay * 2, 2.2), (c.in.t0 = t + c.delay * 2);
        this.setHead((this.head.i + 1) % HEADS.length, t);
      }
    },

    setHead(i, t) {
      this.prevHead = { i: this.head.i, t0: t };
      this.head = { i, t0: t + 0.4 };
    },

    // ---- still life -------------------------------------------------------------

    drawStillLife(g, cx, cy, U, pal, t, vib) {
      const ink = pal.ink;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.globalAlpha = 1;
      // Table: a pedestal-table edge and its wood.
      g.fillStyle = 'rgba(92,60,30,0.28)';
      g.beginPath();
      g.moveTo(cx - U * 0.75, cy + U * 0.25);
      g.quadraticCurveTo(cx, cy + U * 0.21, cx + U * 0.75, cy + U * 0.25);
      g.lineTo(cx + U * 0.75, cy + U * 0.6); g.lineTo(cx - U * 0.75, cy + U * 0.6); g.closePath();
      g.fill();
      g.strokeStyle = ink; g.lineWidth = U * 0.006;
      g.beginPath(); g.moveTo(cx - U * 0.75, cy + U * 0.25); g.quadraticCurveTo(cx, cy + U * 0.21, cx + U * 0.75, cy + U * 0.25); g.stroke();
      g.lineWidth = U * 0.003;
      g.beginPath(); g.moveTo(cx - U * 0.75, cy + U * 0.285); g.quadraticCurveTo(cx, cy + U * 0.245, cx + U * 0.75, cy + U * 0.285); g.stroke();

      // Newspaper, folded, with an invented masthead cut off by the fold.
      g.save();
      g.translate(cx - U * 0.08, cy + U * 0.33); g.rotate(0.07);
      g.fillStyle = 'rgba(236,227,204,0.9)';
      g.fillRect(-U * 0.27, -U * 0.08, U * 0.54, U * 0.17);
      g.strokeStyle = rgb(hex(ink), 0.6); g.lineWidth = U * 0.003;
      g.strokeRect(-U * 0.27, -U * 0.08, U * 0.54, U * 0.17);
      g.fillStyle = ink;
      g.font = `400 ${(U * 0.075).toFixed(1)}px ${STENCIL}`;
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillText('NOCTU', -U * 0.25, -U * 0.005);
      g.fillStyle = 'rgba(60,50,40,0.45)';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        const w = U * (0.12 + ((r * 7 + c * 3) % 5) * 0.008);
        g.fillRect(-U * 0.25 + c * U * 0.17, U * 0.02 + r * U * 0.013, w, U * 0.004);
      }
      g.restore();

      // Bottle.
      g.save();
      g.translate(cx - U * 0.33, cy);
      g.fillStyle = 'rgba(58,70,52,0.5)';
      g.beginPath();
      g.moveTo(-U * 0.065, U * 0.27); g.lineTo(-U * 0.065, -U * 0.06);
      g.quadraticCurveTo(-U * 0.065, -U * 0.13, -U * 0.024, -U * 0.16);
      g.lineTo(-U * 0.024, -U * 0.32); g.lineTo(U * 0.024, -U * 0.32); g.lineTo(U * 0.024, -U * 0.16);
      g.quadraticCurveTo(U * 0.065, -U * 0.13, U * 0.065, -U * 0.06);
      g.lineTo(U * 0.065, U * 0.27); g.closePath();
      g.fill();
      g.strokeStyle = ink; g.lineWidth = U * 0.005; g.stroke();
      g.beginPath(); g.ellipse(0, U * 0.27, U * 0.065, U * 0.016, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.ellipse(0, -U * 0.32, U * 0.024, U * 0.007, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(245,238,220,0.7)'; g.lineWidth = U * 0.008;
      g.beginPath(); g.moveTo(-U * 0.038, -U * 0.04); g.lineTo(-U * 0.038, U * 0.22); g.stroke();
      g.fillStyle = 'rgba(234,224,198,0.9)';
      g.fillRect(-U * 0.058, U * 0.04, U * 0.116, U * 0.08);
      g.fillStyle = ink; g.textAlign = 'center';
      g.font = `400 ${(U * 0.04).toFixed(1)}px ${STENCIL}`;
      g.fillText('VIN', 0, U * 0.095);
      g.restore();

      // Glass.
      g.save();
      g.translate(cx + U * 0.36, cy + U * 0.1);
      g.fillStyle = 'rgba(240,232,212,0.35)';
      g.beginPath(); g.moveTo(-U * 0.06, -U * 0.08); g.lineTo(-U * 0.04, U * 0.12); g.lineTo(U * 0.04, U * 0.12); g.lineTo(U * 0.06, -U * 0.08); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = U * 0.004; g.stroke();
      g.beginPath(); g.ellipse(0, -U * 0.08, U * 0.06, U * 0.017, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(0, U * 0.12, U * 0.04, U * 0.011, 0, 0, Math.PI); g.stroke();
      g.strokeStyle = 'rgba(248,242,226,0.6)'; g.lineWidth = U * 0.006;
      g.beginPath(); g.moveTo(U * 0.03, -U * 0.05); g.lineTo(U * 0.022, U * 0.09); g.stroke();
      g.restore();

      // Guitar, leaning.
      g.save();
      g.translate(cx + U * 0.04, cy - U * 0.02); g.rotate(-0.32);
      g.fillStyle = 'rgba(122,78,38,0.55)';
      g.beginPath(); g.arc(0, U * 0.12, U * 0.16, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, -U * 0.1, U * 0.12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink; g.lineWidth = U * 0.006;
      g.beginPath(); g.arc(0, U * 0.12, U * 0.16, -0.12 * Math.PI, 1.12 * Math.PI); g.stroke();
      g.beginPath(); g.arc(0, -U * 0.1, U * 0.12, 0.9 * Math.PI, 2.1 * Math.PI); g.stroke();
      // Neck and head.
      g.fillStyle = 'rgba(176,132,82,0.9)';
      g.fillRect(-U * 0.027, -U * 0.5, U * 0.054, U * 0.3);
      g.strokeStyle = ink; g.lineWidth = U * 0.004;
      g.strokeRect(-U * 0.027, -U * 0.5, U * 0.054, U * 0.3);
      g.lineWidth = U * 0.0025;
      for (let f = 0; f < 8; f++) { const y = -U * 0.23 - f * U * 0.034; g.beginPath(); g.moveTo(-U * 0.027, y); g.lineTo(U * 0.027, y); g.stroke(); }
      g.fillStyle = 'rgba(70,44,22,0.9)';
      g.beginPath(); g.moveTo(-U * 0.034, -U * 0.5); g.lineTo(-U * 0.045, -U * 0.6); g.lineTo(U * 0.045, -U * 0.6); g.lineTo(U * 0.034, -U * 0.5); g.closePath(); g.fill();
      g.fillStyle = ink;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-U * 0.055, -U * 0.52 - k * U * 0.03, U * 0.009, 0, 7); g.fill(); g.beginPath(); g.arc(U * 0.055, -U * 0.52 - k * U * 0.03, U * 0.009, 0, 7); g.fill(); }
      // Sound hole and bridge.
      g.fillStyle = '#1E150E';
      g.beginPath(); g.arc(0, 0, U * 0.05, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(236,222,190,0.8)'; g.lineWidth = U * 0.004;
      g.beginPath(); g.arc(0, 0, U * 0.062, 0, Math.PI * 2); g.stroke();
      g.fillStyle = ink; g.fillRect(-U * 0.055, U * 0.18, U * 0.11, U * 0.022);
      // Strings: they hum with the bass and twang on the kick.
      g.strokeStyle = 'rgba(246,238,216,0.92)'; g.lineWidth = U * 0.0028;
      for (let s = 0; s < 6; s++) {
        const x0 = -U * 0.02 + s * U * 0.008;
        const amp = U * 0.006 * vib * (0.6 + 0.4 * Math.sin(s * 1.7));
        const ph = Math.sin(t * (38 + s * 7)) * amp;
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const u = k / 10, y = lerp(U * 0.19, -U * 0.5, u);
          const x = lerp(x0, x0 * 0.7, u) + Math.sin(Math.PI * u) * ph;
          if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.restore();
    },

    // Braque's and Picasso's small brush dabs, baked once per size.
    bakeDabs(cw, chh, dev, pcx, pcy, pw, ph, pal) {
      if (!this.dabCanvas) this.dabCanvas = document.createElement('canvas');
      const c = this.dabCanvas; c.width = cw; c.height = chh;
      const x = c.getContext('2d');
      x.setTransform(dev, 0, 0, dev, 0, 0);
      x.lineCap = 'round';
      const r = mulberry(77);
      const U = Math.min(ph, pw / 1.25);
      const tones = ['rgba(245,235,210,0.16)', 'rgba(50,35,20,0.16)', 'rgba(210,170,100,0.2)', 'rgba(120,100,80,0.16)'];
      // Short strokes in patches, each patch with its own direction, the way
      // the hatching in analytic canvases follows the planes rather than the rain.
      for (let i = 0; i < 1600; i++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r());
        const X = pcx + Math.cos(a) * rr * pw * 0.52, Y = pcy + Math.sin(a) * rr * ph * 0.52;
        const patch = Math.sin(X * 0.021) + Math.cos(Y * 0.027 + X * 0.008);
        const ang = -0.8 + patch * 0.9 + (r() - 0.5) * 0.3, len = U * (0.006 + r() * 0.01);
        x.strokeStyle = tones[Math.floor(r() * tones.length)];
        x.lineWidth = U * (0.006 + r() * 0.006);
        x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(ang) * len, Y + Math.sin(ang) * len); x.stroke();
      }
    },

    // ---- collage --------------------------------------------------------------

    makeCollage() {
      const mk = (w, h, paint) => {
        const c = document.createElement('canvas');
        c.width = Math.round(w); c.height = Math.round(h);
        paint(c.getContext('2d'), c.width, c.height);
        return c;
      };
      const r = mulberry(99);
      // Faux-bois: combed wood grain, as in Braque's first papier collé.
      const wood = mk(360, 110, (x, w, h) => {
        x.fillStyle = '#B98A55'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 26; i++) {
          x.strokeStyle = `rgba(${90 + r() * 30},${55 + r() * 20},${25},${0.35 + r() * 0.4})`;
          x.lineWidth = 1 + r() * 2.5;
          x.beginPath();
          const y0 = r() * h, ph = r() * 6, amp = 2 + r() * 6;
          for (let X = 0; X <= w; X += 6) {
            const Y = y0 + Math.sin(X * 0.02 + ph) * amp + Math.sin(X * 0.071 + ph * 2) * amp * 0.4;
            if (X === 0) x.moveTo(X, Y); else x.lineTo(X, Y);
          }
          x.stroke();
        }
        x.strokeStyle = 'rgba(70,40,18,0.7)'; x.lineWidth = 2;
        x.beginPath(); x.ellipse(w * 0.62, h * 0.5, 28, 12, 0.1, 0, 7); x.stroke();
        x.beginPath(); x.ellipse(w * 0.62, h * 0.5, 16, 6, 0.1, 0, 7); x.stroke();
      });
      // Newsprint: an invented masthead fragment and columns.
      const news = mk(260, 200, (x, w, h) => {
        x.fillStyle = '#E4DAC0'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#2B2016';
        x.font = `400 54px ${STENCIL}`; x.textBaseline = 'alphabetic';
        x.fillText('LA NOCE', 10, 58);
        x.fillRect(8, 68, w - 16, 3);
        x.fillStyle = 'rgba(40,32,24,0.55)';
        for (let c = 0; c < 3; c++) for (let row = 0; row < 16; row++) {
          x.fillRect(10 + c * 82, 82 + row * 7, 70 - (row % 5 === 4 ? 30 : r() * 8), 3);
        }
      });
      // A scrap of sheet music.
      const music = mk(260, 120, (x, w, h) => {
        x.fillStyle = '#EDE5CE'; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(40,30,20,0.8)'; x.lineWidth = 1.5;
        for (let st = 0; st < 2; st++) for (let l = 0; l < 5; l++) { const y = 20 + st * 55 + l * 7; x.beginPath(); x.moveTo(6, y); x.lineTo(w - 6, y); x.stroke(); }
        x.fillStyle = 'rgba(30,22,14,0.9)';
        for (let st = 0; st < 2; st++) for (let k = 0; k < 10; k++) {
          const X = 30 + k * 22, Y = 20 + st * 55 + Math.floor(r() * 9) * 3.5;
          x.beginPath(); x.ellipse(X, Y, 4.2, 3, -0.4, 0, 7); x.fill();
          x.fillRect(X + 3.2, Y - 20, 1.4, 20);
        }
      });
      return [
        { tex: wood, w: 0.46, h: 0.14, x: 0.36, y: -0.26, ang: -0.16, from: [1.4, -0.6], delay: 0, in: Tw(0) },
        { tex: news, w: 0.27, h: 0.21, x: -0.44, y: 0.14, ang: 0.13, from: [-1.3, 0.5], delay: 0.25, in: Tw(0) },
        { tex: music, w: 0.3, h: 0.14, x: 0.38, y: 0.3, ang: -0.18, from: [1.2, 0.9], delay: 0.5, in: Tw(0) },
      ];
    },

    drawCollage(g, t, pcx, pcy, U, pal) {
      for (const c of this.collage) {
        const u = twGet(c.in, t);
        if (u <= 0.002) continue;
        const x = pcx + U * lerp(c.from[0], c.x, u) + U * 0.012 * Math.sin(this.orbitClock + c.delay * 5);
        const y = pcy + U * lerp(c.from[1], c.y, u);
        const ang = c.ang + (1 - u) * 0.5;
        const w = c.w * U, h = c.h * U;
        g.save();
        g.translate(x, y); g.rotate(ang);
        g.globalAlpha = clamp(u * 3, 0, 1);
        // A real paper shadow, not a glow.
        g.fillStyle = 'rgba(30,20,10,0.28)';
        g.fillRect(-w / 2 + U * 0.008, -h / 2 + U * 0.01, w, h);
        g.drawImage(c.tex, -w / 2, -h / 2, w, h);
        g.globalAlpha = 1;
        g.restore();
      }
    },

    // ---- stencils ---------------------------------------------------------------

    stencil(ch, px, ink) {
      const k = ch + '|' + px + '|' + ink;
      let c = this.letterCache.get(k);
      if (c) return c;
      c = document.createElement('canvas');
      const x = c.getContext('2d');
      x.font = `400 ${px}px ${STENCIL}`;
      const m = x.measureText(ch);
      const w = Math.ceil(m.width + px * 0.2), h = Math.ceil(px * 1.35);
      c.width = Math.max(2, w); c.height = Math.max(2, h);
      x.font = `400 ${px}px ${STENCIL}`;
      x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      x.fillStyle = ink;
      const base = px * 1.1;
      x.fillText(ch, px * 0.1, base);
      // Bridges: cut where a real stencil plate would have to hold its counters.
      x.globalCompositeOperation = 'destination-out';
      const capTop = base - px * 0.72, capH = px * 0.72;
      for (const b of bridges(ch)) {
        const bx = px * 0.1 + m.width * b[0];
        x.fillRect(bx - px * 0.035, capTop + capH * b[1] - 2, px * 0.07, capH * (b[2] - b[1]) + 4);
      }
      // Sprayed edges: a scatter of pinholes near the letter.
      const r = mulberry(ch.charCodeAt(0) * 31 + px);
      for (let i = 0; i < 40; i++) { x.globalAlpha = 0.5; x.fillRect(r() * w, r() * h, 1.2, 1.2); }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      c.base = base; c.pad = px * 0.1; c.adv = m.width;
      if (this.letterCache.size > 300) this.letterCache.clear();
      this.letterCache.set(k, c);
      return c;
    },

    drawStencil(g, ch, x, y, size, ink, dev, alpha, ang, sc) {
      const px = Math.max(8, Math.round(size * dev / 4) * 4);
      const c = this.stencil(ch, px, ink);
      const k = size / px;
      g.save();
      g.translate(x, y); g.rotate(ang || 0); g.scale(k * (sc || 1), k * (sc || 1));
      g.globalAlpha = alpha;
      g.drawImage(c, -c.pad, -c.base);
      g.restore();
      return c.adv * k;
    },

    drawLetters(g, t, U, pal, dev) {
      for (const L of this.letters) {
        const u = clamp((t - L.t0) / 0.12, 0, 1);
        let a = easeOut(u) * 0.86;
        if (L.fade >= 0) a *= 1 - clamp((t - L.fade) / 2.5, 0, 1);
        if (a < 0.01) continue;
        const ink = L.ink ? pal.brick : pal.ink;
        this.drawStencil(g, L.ch, L.x, L.y, L.size, ink, dev, a, L.ang, 1 + 0.25 * (1 - easeOut(u)));
      }
    },

    // ---- poster type ------------------------------------------------------------

    drawType(g, t, tx, ty, tw, th, land, pal, dev) {
      const heads = HEADS;
      const drawHead = (hi, t0, out) => {
        const lines = heads[hi];
        // Fit each line to the column width, capped so the stack fits the height.
        g.font = `400 100px ${STENCIL}`;
        const widths = lines.map((w) => g.measureText(w).width / 100);
        const maxH = land ? th * 0.62 : th * 0.62;
        let sizes = widths.map((w) => Math.min(tw / w, land ? th * 0.22 : th * 0.28));
        const total = sizes.reduce((a, b) => a + b * 0.88, 0);
        if (total > maxH) sizes = sizes.map((s) => s * maxH / total);
        // Abril's capitals stand about 0.7 of the size: baseline each line
        // under the one above by its own cap height plus a stencil-plate gap.
        let y = ty;
        let li = 0;
        lines.forEach((word, wi) => {
          const s = sizes[wi];
          y += s * 0.71;
          let x = tx;
          const ink = this.drop && wi === 1 ? pal.brick : pal.ink;
          for (let i = 0; i < word.length; i++) {
            const lt = t0 + li * 0.06; li++;
            const u = clamp((t - lt) / 0.14, 0, 1);
            let a = easeOut(u);
            if (out >= 0) a *= 1 - clamp((t - out - i * 0.03) / 0.25, 0, 1);
            g.font = `400 ${s.toFixed(1)}px ${STENCIL}`;
            const adv = g.measureText(word[i]).width;
            if (a > 0.01) this.drawStencil(g, word[i], x, y, s, ink, dev, a, 0, 1 + 0.2 * (1 - a));
            x += adv;
          }
          y += s * 0.17;
        });
        return y;
      };
      let yEnd = ty;
      if (this.prevHead && t - this.prevHead.t0 < 0.8) drawHead(this.prevHead.i, -10, this.prevHead.t0);
      yEnd = drawHead(this.head.i, this.head.t0, -1);
      // Rule and typewritten lines.
      const small = Math.max(9, Math.min(tw * 0.075, th * 0.045));
      let y = Math.max(yEnd + small * 0.2, ty + th * 0.66);
      g.fillStyle = pal.ink;
      g.fillRect(tx, y, tw, Math.max(1.2, small * 0.12));
      y += small * 1.7;
      g.font = `400 ${small.toFixed(1)}px ${TYPEWRITER}`;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      for (const line of TYPE_LINES) {
        if (y > ty + th) break;
        g.fillText(line, tx, y);
        y += small * 1.45;
      }
      if (y < ty + th) {
        g.textAlign = 'right';
        g.fillText('Nº ' + (this.drop ? '12' : '4'), tx + tw, ty + th);
        g.textAlign = 'left';
      }
    },

    grain(g) {
      if (this.grainPat && this.grainCtx === g) return this.grainPat;
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const x = c.getContext('2d');
      const img = x.createImageData(256, 256);
      const rnd = mulberry(4321);
      const blot = new Float32Array(16 * 16);
      for (let i = 0; i < blot.length; i++) blot[i] = rnd();
      for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
        const bx = xx / 16, by = y / 16, ix = Math.floor(bx), iy = Math.floor(by);
        const fx = bx - ix, fy = by - iy;
        const q = (a, b) => blot[((b & 15) * 16) + (a & 15)];
        const sm = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
        const v = 255 - rnd() * 30 - sm * 22;
        const o = (y * 256 + xx) * 4;
        img.data[o] = v; img.data[o + 1] = v - 3; img.data[o + 2] = v - 9; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.grainPat = g.createPattern(c, 'repeat');
      this.grainCtx = g;
      return this.grainPat;
    },
  });
})();
