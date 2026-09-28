// Magazine Cover: the painted cover of an invented city weekly, "The Borough",
// in the tradition of the gentle, witty gouache covers of the big mid-century
// weeklies. A rooftop party at night: a DJ at a card table under two strands
// of bulbs, neighbours dancing on the tar roof, a wooden water tower with
// pigeons on its catwalk, the brick block across the street with its fire
// escape and a cat in a window, a skyline behind, a big moon, a tree in a
// planter dropping its leaves. The masthead sits on the painting, as it does
// on those covers, and changes colour with the issue.
//
// Music, each in its own place (the kick never moves the whole picture):
//   kick   the dancers bend their knees and step side to side, the DJ nods,
//          the pigeons bob, the speaker cones push; in the drop, each kick
//          lights one more window across the street with a neighbour dancing
//   clap   several dancers clap overhead; the DJ throws a hand up; a window
//          across the street switches on or off
//   hats   single bulbs on the strands and stars in the sky twinkle
//   bass   the warm pool of light on the roof widens; the breeze and the
//          camera drift pick up
//   drop   more dancers climb up the roof stairs into the foreground, the
//          bulbs alternate warm and rose, the masthead takes the issue's
//          second colour, the tree lets go in a gust; the breakdown dims the
//          block across the street window by window and the crowd slows to a
//          sway
//
// No glow: bulbs have painted halos (flat discs of lighter paint), the light
// pool is paint, and a soft-light brushwork-and-paper pass sits over it all.

(function () {
  const SEASONS = [
    {
      name: 'Autumn night', date: 'OCT. 12, 2026', price: '$8.99', fall: 'leaves',
      sky: ['#161E3B', '#283866', '#56567F', '#A97470'],
      cloud: '#3B4776', star: '#EFE3C0',
      moon: '#F2E2B6', moonSh: '#D9C28D',
      mast: '#F2E7CF', mast2: '#F29C84', dateInk: '#E7DCC3',
      farA: '#4B557E', farB: '#323A5E', farWin: '#E7BE6A', farDim: '#5A6390',
      brick: '#86443A', brickSh: '#5F2F2C', trim: '#B98770', winDark: '#1F2540', winLit: '#EFC46A', winLit2: '#F3A383', sil: '#2A1B24',
      iron: '#1B1C2B',
      deck: '#3F3239', deckLit: '#8F6750', parapet: '#6E5049', parTop: '#A07C6C',
      tank: '#89603F', tankSh: '#5A3E2C', tankRoof: '#3A2E36', leg: '#231F2B',
      bulb: '#F8D57C', bulb2: '#F58F93', wire: '#1B1822',
      table: '#2A2430', cloth: '#C9473A', cloth2: '#EBDDC4',
      tree: ['#D9672E', '#E8A33A', '#B8442C', '#F0C04F', '#C9552F'], trunk: '#45302A', planter: '#7A5238', ornament: 'pumpkin',
      clothes: ['#D2553F', '#E3A63D', '#3F8A83', '#E48FA0', '#F1E4C8', '#5E74B8', '#7FAF5A', '#9A4E8C'],
      bottoms: ['#2E2F45', '#3B4B6E', '#5A3B30', '#1F2230', '#6B6F7E'],
    },
    {
      name: 'First snow', date: 'DEC. 14, 2026', price: '$8.99', fall: 'snow',
      sky: ['#1A2440', '#2F4165', '#617594', '#B4AEB6'],
      cloud: '#4A5C80', star: '#F4F1E8',
      moon: '#F4EEDD', moonSh: '#D8D0BC',
      mast: '#F5F2EA', mast2: '#E8604F', dateInk: '#EDEBE3',
      farA: '#56668A', farB: '#3A4868', farWin: '#F0C979', farDim: '#6A7A9C',
      brick: '#7E3E38', brickSh: '#582C2C', trim: '#E6E4E2', winDark: '#1E2742', winLit: '#F3C874', winLit2: '#EF7E6A', sil: '#2A1B24',
      iron: '#1B1E2C',
      deck: '#B9BECB', deckLit: '#F1DEC0', parapet: '#6E5552', parTop: '#EEF0F4',
      tank: '#7E5A40', tankSh: '#553B2C', tankRoof: '#EEF0F4', leg: '#232230',
      bulb: '#F9D983', bulb2: '#EE6E62', wire: '#1B1822',
      table: '#2A2430', cloth: '#2F6B55', cloth2: '#E9E2D2',
      tree: ['#EEF0F4', '#DCE2EA', '#C9D2DE'], trunk: '#3E2E2A', planter: '#7A4D3E', ornament: 'snowman',
      clothes: ['#C23B35', '#E8B44A', '#2F6B55', '#EDE3D0', '#3D5A99', '#8C5A9A', '#D9774A', '#6A8FA6'],
      bottoms: ['#2E2F45', '#3B4B6E', '#4A3530', '#1F2230', '#5D4A63'],
    },
    {
      name: 'Summer dusk', date: 'AUG. 3, 2026', price: '$8.99', fall: 'swifts',
      sky: ['#3A4C84', '#7E77A6', '#DB9488', '#F2C58E'],
      cloud: '#F0B7A0', star: '#FFF4DA',
      moon: '#FFF1D2', moonSh: '#EFD7AE',
      mast: '#22305A', mast2: '#B8323F', dateInk: '#2A3560',
      farA: '#9A8DB0', farB: '#6E6695', farWin: '#F7D98C', farDim: '#8A82AC',
      brick: '#A0543F', brickSh: '#7A3B31', trim: '#E9CFA8', winDark: '#3D3A62', winLit: '#F6D27E', winLit2: '#F59A8A', sil: '#3A2330',
      iron: '#2B2438',
      deck: '#6A5055', deckLit: '#C98E6C', parapet: '#8E6158', parTop: '#C8A08C',
      tank: '#9C6C45', tankSh: '#6C4830', tankRoof: '#4A3A44', leg: '#2E2634',
      bulb: '#FBE3A0', bulb2: '#F58F93', wire: '#2A2230',
      table: '#33293A', cloth: '#E6B84A', cloth2: '#F5EBD6',
      tree: ['#4E8A4A', '#6FA35A', '#3C6E45', '#8DB860', '#5E9A50'], trunk: '#4A3528', planter: '#D07A4E', ornament: 'flamingo',
      clothes: ['#E0634A', '#F0C04A', '#44A39A', '#F29BB0', '#F7EEDC', '#6C86CC', '#96C46A', '#B56AAE'],
      bottoms: ['#35385A', '#4C6390', '#E8DCC0', '#2B2E40', '#7C8296'],
    },
  ];

  const MAST_FONT = '"Abril Fatface", "Playfair Display", Georgia, serif';
  const DATE_FONT = '"Libre Baskerville", Georgia, serif';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (i, j) => { const r = mulberry(i * 7919 + j * 104729 + 13); r(); return r(); };
  const rgbCache = {};
  function rgb(h) {
    if (rgbCache[h]) return rgbCache[h];
    const n = parseInt(h.slice(1, 7), 16);
    return (rgbCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  function rgba(h, a) { const A = rgb(h); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a.toFixed(3) + ')'; }

  // A hand-painted rectangle: edges subdivided and nudged by a fixed hash, so
  // it never looks ruled, and never shimmers (the nudge is per shape, not per frame).
  function wobRect(c, x, y, w, h, seed, amt) {
    const pts = [];
    const edge = (x0, y0, x1, y1, k) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / 26));
      const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const j = i === 0 ? 0.5 : 1;
        const o = (hash(seed + k * 31, i) - 0.5) * 2 * amt * j;
        pts.push(x0 + (x1 - x0) * u + nx * o, y0 + (y1 - y0) * u + ny * o);
      }
    };
    edge(x, y, x + w, y, 1); edge(x + w, y, x + w, y + h, 2);
    edge(x + w, y + h, x, y + h, 3); edge(x, y + h, x, y, 4);
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
  }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); }

  VIZ.register({
    id: 'newyorker',
    name: 'Magazine Cover',
    order: 518,
    params: [
      { key: 'season', label: 'Issue', type: 'select', options: SEASONS.map((s) => s.name), default: 0 },
      { key: 'masthead', label: 'Masthead', type: 'text', default: 'The Borough' },
      { key: 'crowd', label: 'Crowd size', type: 'range', min: 0.3, max: 1, default: 1, step: 0.01 },
      { key: 'breeze', label: 'Breeze and drift', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'brush', label: 'Brushwork', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],
    gallery: {
      title: 'Magazine Cover',
      technique: 'Canvas 2D: flat gouache shapes with fixed hand-wobbled edges, cached skyline layers with parallax, articulated painted figures posed per frame, a pre-rendered soft-light brushwork and paper pass',
      brief: 'The painted cover of an invented city weekly, "The Borough": a rooftop party at night in gouache, with a DJ at a card table under strands of bulbs, neighbours dancing on the tar roof, a wooden water tower with pigeons, the brick block across the street with a fire escape and an unimpressed cat, a skyline and a big moon, and a seasonal detail (a pumpkin on the parapet and falling leaves; a snowman and snow; a flamingo and wheeling swifts). Kicks bend the dancers\' knees and step them side to side, nod the DJ, bob the pigeons and push the speaker cones; claps bring hands together overhead and switch a window across the street; hats twinkle single bulbs and stars; the bass widens the pool of light on the roof and speeds the breeze. In the drop more dancers climb onto the roof in the foreground, each kick lights another window with a neighbour dancing, the bulbs alternate warm and rose, the masthead takes the issue\'s second colour and the tree lets go in a gust; the breakdown darkens the block window by window and the crowd slows to a sway.',
      lineage: 'The tradition of the painted weekly-magazine cover (gentle, witty city scenes in gouache under a Didone masthead), with an invented title and masthead set in Abril Fatface, and a dateline in Libre Baskerville. Process: read the batch-05 brief and TASTE; chose a rooftop party because it lets the whole room see the music in people (the crowd bending on the kick is the most legible beat there is) while keeping each reaction local to its subject; built the figures as articulated flat-paint shapes seen mostly from behind, posed each frame from kick, clap and bass envelopes; made the drop a matter of more people, more lit windows and a second ink rather than more brightness; iterated at 640x360 with the render and jolt harnesses. First pass read as flat vector art with an empty lower third and a skyline landmark too like a real tower; the second pass enlarged and lowered the crowd, spread the clothes colours, added the lawn-chair neighbour and a wooden planter, gave the sky a cached dry-brush layer, swapped the landmark\'s needle for a pyramid cap with a beacon, and moved the cat clear of the tree. Jolt: calm, drop kickArea 0.087, ratio 2.73, the heat confined to the crowd and the windows across the street.',
    },

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.t = null;
      this.prev = new Float32Array(9);
      this.lastKick = -9; this.lastSnare = -9; this.lastHat = -9;
      this.beats = 0;
      this.low = 0; this.bassEnv = 0; this.energy = 0; this.padEnv = 0;
      this.kickAct = 0;
      this.dense = false; this.hadDrop = false; this.dropAmt = 0; this.hush = 0;
      this.phase = 0; this.windX = 0;
      this.leaves = []; this.leafAcc = 0;
      this.twinkles = [];
      this.win = null; this.winTimer = 0;
      this.dancers = null; this.dancerKey = '';
      this.geoKey = ''; this.skyKey = ''; this.texKey = '';
      this.lean = null; this.arms = null;
      this.djArm = 0;
    },

    // ---------- music ----------
    analyse(s, t, dt) {
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.beats++; this.onKick(t);
      }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - this.lastSnare > 0.14) {
        this.lastSnare = t; this.onSnare(t);
      }
      const bh = Math.max(s[7], s[8]);
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) {
        this.lastHat = t;
        for (let i = 0; i < 3; i++) this.twinkles.push({ i: Math.floor(Math.random() * 1000), at: t });
        if (this.twinkles.length > 30) this.twinkles.splice(0, this.twinkles.length - 30);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[1], s[2]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.25) : k(0.8));
      const pad = (s[2] + s[3] + s[4]) / 300;
      this.padEnv += (pad - this.padEnv) * k(0.6);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
      this.kickAct += ((t - this.lastKick < 1.2 ? 1 : 0) - this.kickAct) * k(0.5);
    },

    onKick(t) {
      // In the drop the block across the street joins in, one window per kick.
      if (this.win && this.dense) {
        const off = this.win.filter((w) => !w.party && !w.cat);
        if (off.length) {
          const w = off[Math.floor(Math.random() * off.length)];
          w.party = true; w.lit = true; w.at = t;
        }
      }
    },

    onSnare(t) {
      this.clapAt = t;
      if (this.win) {
        const cand = this.win.filter((w) => !w.party && !w.cat);
        if (cand.length) {
          const w = cand[Math.floor(Math.random() * cand.length)];
          w.lit = !w.lit; w.at = t;
        }
      }
    },

    // ---------- geometry ----------
    layout(W, H) {
      const r = mulberry(1918);
      const s = Math.min(W, H) / 600;
      const g = { W, H, s };
      g.yP = H * 0.705;              // parapet top: the far edge of our roof
      g.yS = H * 0.73;               // where the skyline's feet would be
      g.moon = { x: W * 0.58, y: H * 0.33, r: 40 * s };
      // Skyline ranks, generated wider than the stage so parallax never shows an edge.
      const M = 60 * s;
      g.M = M;
      const rank = (minW, maxW, lo, hi, winW, winH, gapX, gapY, litP, seed) => {
        const rr = mulberry(seed);
        const out = [];
        let x = -M;
        while (x < W + M) {
          const w = lerp(minW, maxW, rr()) * s;
          const top = g.yS - H * lerp(lo, hi, Math.pow(rr(), 1.3));
          const b = { x, w, top, set: rr() < 0.35 ? 0.2 + rr() * 0.25 : 0, ant: rr() < 0.18, tone: rr(), wins: [] };
          const cols = Math.max(1, Math.floor((w - 6 * s) / (gapX * s)));
          const x0 = x + (w - cols * gapX * s) / 2 + (gapX - winW) * s / 2;
          for (let yy = top + 8 * s; yy < g.yS - 6 * s; yy += gapY * s) {
            for (let cc = 0; cc < cols; cc++) {
              const wx = x0 + cc * gapX * s;
              if (b.set && yy < top + (g.yS - top) * 0.18 && (cc === 0 || cc === cols - 1)) continue;
              b.wins.push({ x: wx, y: yy, w: winW * s, h: winH * s, lit: rr() < litP });
            }
          }
          out.push(b);
          x += w + rr() * 6 * s;
        }
        return out;
      };
      g.farA = rank(28, 64, 0.1, 0.3, 3, 4, 8, 10, 0.16, 11);
      g.farB = rank(40, 96, 0.06, 0.3, 4, 6, 11, 14, 0.22, 23);
      // An invented stepped tower on the far rank, the skyline's one landmark.
      g.tower = { x: W * 0.4, w: 46 * s, top: H * 0.25 };
      // Live windows on the near rank that switch on and off on their own time.
      g.live = [];
      const allB = [];
      for (const b of g.farB) for (const w of b.wins) allB.push(w);
      for (let i = 0; i < 40 && allB.length; i++) g.live.push(allB[Math.floor(r() * allB.length)]);
      // The building across the street, left.
      g.blk = { x: -24 * s, x1: W * 0.255, top: H * 0.25 };
      g.blkWins = [];
      const cols = 3, rows = 4;
      const bw = g.blk.x1 - g.blk.x;
      for (let rI = 0; rI < rows; rI++) {
        for (let cI = 0; cI < cols; cI++) {
          const ww = bw * 0.17, wh = H * 0.075;
          g.blkWins.push({
            x: g.blk.x + bw * (0.14 + cI * 0.3), y: H * 0.315 + rI * H * 0.1, w: ww, h: wh,
            row: rI, col: cI,
          });
        }
      }
      // Water tower on our roof, right.
      g.tw = { x: W - Math.max(W * 0.13, 92 * s), w: 108 * s, top: H * 0.22, bot: H * 0.44, foot: H * 0.77 };
      // Strands of bulbs from the fire escape to the tower legs.
      const ax = g.blk.x1 - 6 * s, bx = g.tw.x - g.tw.w * 0.42;
      g.strands = [
        { x0: ax, y0: H * 0.39, x1: bx, y1: H * 0.45, sag: H * 0.1 },
        { x0: ax, y0: H * 0.49, x1: bx, y1: H * 0.53, sag: H * 0.075 },
      ];
      // DJ booth.
      g.dj = { x: W * 0.665, y: H * 0.8, w: 124 * s };
      // Tree in a planter, bottom left.
      g.tree = { x: Math.max(W * 0.075, 60 * s), y: H * 0.54, r: 80 * s, py: H * 0.84 };
      g.dabs = [];
      for (let i = 0; i < 170; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        g.dabs.push({ x: Math.cos(a) * d * g.tree.r * 1.15, y: Math.sin(a) * d * g.tree.r * 0.85, rx: (5 + r() * 7) * s, ry: (3 + r() * 4) * s, rot: r() * 3, c: Math.floor(r() * 5), ph: r() * 6.28 });
      }
      g.branches = [];
      for (let i = 0; i < 7; i++) g.branches.push({ a: -Math.PI / 2 + (r() - 0.5) * 2.2, l: (40 + r() * 45) * s });
      g.stars = [];
      for (let i = 0; i < 70; i++) g.stars.push({ x: r() * W, y: lerp(H * 0.03, H * 0.5, Math.pow(r(), 1.4)), s: (0.7 + r() * 1.1) * s, ph: r() * 6.28 });
      g.clouds = [];
      for (let i = 0; i < 4; i++) g.clouds.push({ fx: r(), y: lerp(H * 0.2, H * 0.5, r()), len: (160 + r() * 200) * s, th: (9 + r() * 8) * s, sp: 0.5 + r() });
      g.snow = [];
      for (let i = 0; i < 220; i++) g.snow.push({ x: r(), y: r(), z: 0.4 + r() * 0.8, ph: r() * 6.28 });
      g.swifts = [];
      for (let i = 0; i < 16; i++) g.swifts.push({ a: r() * 6.28, rr: 30 + r() * 110, sp: 0.4 + r() * 0.5, ph: r() * 6.28, dy: (r() - 0.5) * 40 });
      return g;
    },

    makeDancers(g, crowd) {
      const W = g.W, H = g.H, s = g.s;
      const r = mulberry(606);
      const base = [
        { x: 0.44, y: 0.86 }, { x: 0.33, y: 0.9 }, { x: 0.53, y: 0.9 },
        { x: 0.555, y: 0.85 }, { x: 0.39, y: 0.975 }, { x: 0.5, y: 1.0 }, { x: 0.27, y: 0.84 },
      ];
      const front = [{ x: 0.2, y: 1.1 }, { x: 0.63, y: 1.12 }, { x: 0.35, y: 1.15 }, { x: 0.76, y: 1.1 }];
      const nb = Math.max(2, Math.round(base.length * crowd));
      const nf = Math.max(1, Math.round(front.length * crowd));
      const out = [];
      const mk = (pos, i, fr) => {
        const depth = clamp((pos.y - 0.8) / 0.3, 0, 1);
        const pal = this.pal;
        return {
          x: W * pos.x, fy: H * pos.y, h: (fr ? 215 : lerp(118, 158, depth)) * s,
          front: fr, idx: i,
          look: {
            top: (i * 3 + (fr ? 1 : 0) + Math.floor(r() * 2)) % 8, bottom: Math.floor(r() * 5), skin: Math.floor(r() * 5),
            hair: Math.floor(r() * 6), style: Math.floor(r() * 6), skirt: r() < 0.35, bare: r() < 0.3,
          },
          clapper: r() < 0.5, ph: r() * 6.28, amp: 0.6 + r() * 0.5, delay: i * 0.45,
        };
      };
      for (let i = 0; i < nb; i++) out.push(mk(base[i], i, false));
      for (let i = 0; i < nf; i++) out.push(mk(front[i], i, true));
      return out;
    },

    // ---------- cached layers ----------
    makeSkyline(p, g, pal) {
      const dpr = (p.width * p.pixelDensity()) / g.W;
      const key = g.W.toFixed(1) + 'x' + g.H.toFixed(1) + ':' + dpr.toFixed(3) + ':' + pal.name;
      if (this.skyKey === key) return;
      this.skyKey = key;
      const mk = () => {
        const cv = document.createElement('canvas');
        cv.width = Math.ceil((g.W + 2 * g.M) * dpr); cv.height = Math.ceil((g.yS + 4) * dpr);
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, g.M * dpr, 0);
        return [cv, c];
      };
      const paintRank = (c, list, col, win, dim, seed) => {
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          c.fillStyle = mix(col, '#000000', b.tone * 0.12);
          wobRect(c, b.x, b.top, b.w, g.yS - b.top + 4, seed + i, 1.2 * g.s);
          c.fill();
          if (b.set) {
            const sw = b.w * b.set;
            wobRect(c, b.x + sw, b.top - (g.yS - b.top) * 0.12, b.w - 2 * sw, (g.yS - b.top) * 0.13, seed + i + 500, 1 * g.s);
            c.fill();
          }
          if (b.ant) { c.fillRect(b.x + b.w * 0.5 - 1 * g.s, b.top - 22 * g.s, 2 * g.s, 24 * g.s); }
          for (const w of b.wins) {
            c.fillStyle = w.lit ? win : dim;
            c.fillRect(w.x, w.y, w.w, w.h);
          }
        }
      };
      // Sky: a gradient worked over with horizontal dry-brush strokes of its
      // own colours, which is what makes gouache sky read as paint.
      {
        const cv = document.createElement('canvas');
        cv.width = Math.ceil((g.W + 4) * dpr); cv.height = Math.ceil((g.yS + 4) * dpr);
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 2 * dpr, 2 * dpr);
        const stops = [0, 0.45, 0.78, 1];
        const at = (u) => {
          for (let i = 1; i < stops.length; i++) if (u <= stops[i]) return mix(pal.sky[i - 1], pal.sky[i], (u - stops[i - 1]) / (stops[i] - stops[i - 1]));
          return pal.sky[3];
        };
        const gr = c.createLinearGradient(0, 0, 0, g.yS);
        for (let i = 0; i < 4; i++) gr.addColorStop(stops[i], pal.sky[i]);
        c.fillStyle = gr; c.fillRect(-2, -2, g.W + 4, g.yS + 4);
        const r = mulberry(808);
        c.lineCap = 'round';
        for (let i = 0; i < 900; i++) {
          const y = r() * g.yS, x = r() * g.W;
          const u = clamp(y / g.yS + (r() - 0.5) * 0.08, 0, 1);
          c.strokeStyle = at(u);
          c.globalAlpha = 0.35 + r() * 0.35;
          c.lineWidth = (2 + r() * 7) * g.s;
          const len = (30 + r() * 130) * g.s;
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y + (r() - 0.5) * 6 * g.s, x + len, y + (r() - 0.5) * 4 * g.s); c.stroke();
        }
        c.globalAlpha = 1;
        this.cvSky = cv;
      }
      const [cvA, cA] = mk();
      paintRank(cA, g.farA, pal.farA, mix(pal.farWin, pal.farA, 0.35), mix(pal.farDim, pal.farA, 0.4), 100);
      // The landmark: stepped setbacks and a needle.
      {
        const T = g.tower, c = cA;
        c.fillStyle = mix(pal.farA, '#000000', 0.05);
        const steps = [[1, 0.42], [0.78, 0.2], [0.56, 0.1], [0.34, 0.06]];
        let y = g.yS;
        const hgt = g.yS - T.top;
        for (let i = 0; i < steps.length; i++) {
          const ww = T.w * steps[i][0], hh = hgt * (i === 0 ? 1 - 0.42 - 0.2 - 0.1 - 0.06 + 0.42 : steps[i][1]);
          const yy = i === 0 ? T.top + hgt * 0.38 : y - hh;
          wobRect(c, T.x - ww / 2, yy, ww, (i === 0 ? g.yS - yy : hh) + 1, 900 + i, 0.8 * g.s);
          c.fill();
          y = yy;
        }
        const cw = T.w * 0.34;
        c.beginPath(); c.moveTo(T.x - cw / 2, y + 1); c.lineTo(T.x, y - 26 * g.s); c.lineTo(T.x + cw / 2, y + 1); c.closePath(); c.fill();
        g.beacon = { x: T.x, y: y - 27 * g.s };
        c.fillStyle = mix(pal.farWin, pal.farA, 0.3);
        for (let yy = T.top + hgt * 0.42; yy < g.yS - 6; yy += 9 * g.s) {
          for (let xx = -2; xx <= 2; xx++) if (hash(Math.round(yy), xx + 7) < 0.3) c.fillRect(T.x + xx * 8 * g.s - 1.5 * g.s, yy, 3 * g.s, 4 * g.s);
        }
      }
      const [cvB, cB] = mk();
      paintRank(cB, g.farB, pal.farB, pal.farWin, pal.farDim, 300);
      this.cvA = cvA; this.cvB = cvB; this.cvH = g.yS + 4;
    },

    makeTexture(p) {
      const w = Math.round(p.width * p.pixelDensity()), h = Math.round(p.height * p.pixelDensity());
      const key = w + 'x' + h;
      if (this.texKey === key) return;
      this.texKey = key;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      const r = mulberry(55);
      const unit = Math.min(w, h) / 600;
      // Brushwork: short strokes that follow a slow flow field, as gouache
      // laid down with a flat brush; lighter and darker than the grey mid-point
      // so the soft-light pass lifts and sinks the paint around them.
      const n = Math.min(60000, Math.round((w * h) / 70));
      c.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = r() * h;
        const a = Math.sin(x / (140 * unit)) * 0.8 + Math.cos(y / (90 * unit)) * 0.6 + (r() - 0.5) * 0.5;
        const len = (6 + r() * 16) * unit;
        const v = Math.round(128 + (r() - 0.5) * 70);
        c.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.35)';
        c.lineWidth = (1.2 + r() * 3) * unit;
        c.beginPath();
        c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        c.stroke();
      }
      // Paper tooth.
      const id = c.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const nn = (r() - 0.5) * 22;
        d[i] += nn; d[i + 1] += nn; d[i + 2] += nn;
      }
      c.putImageData(id, 0, 0);
      this.tex = cv;
    },

    // ---------- figures ----------
    person(c, x, fy, h, lk, ps, pal) {
      const d = ps.dip, L = ps.lean, A = ps.arms, sw = ps.swing;
      const top = pal.clothes[lk.top % pal.clothes.length];
      const bottom = pal.bottoms[lk.bottom % pal.bottoms.length];
      const skin = ['#E9B893', '#C98E68', '#8E5B3E', '#F2CDB0', '#6B4430'][lk.skin];
      const hair = ['#2A1E1A', '#5A3524', '#C9A15A', '#1A1A22', '#8E3B25', '#D8D2C4'][lk.hair];
      const shoe = '#1D1820';
      const hipX = x + L * h * 0.05, hipY = fy - h * 0.46 + d * h * 0.06;
      const shX = hipX + L * h * 0.05, shY = hipY - h * 0.27;
      c.lineCap = 'round'; c.lineJoin = 'round';
      // Shadow on the roof.
      c.fillStyle = 'rgba(18,12,22,0.28)';
      ell(c, x + L * h * 0.02, fy, h * 0.17, h * 0.03); c.fill();
      // Legs.
      for (let sd = -1; sd <= 1; sd += 2) {
        const fx = x + sd * h * 0.07 + (sd === Math.sign(L) ? L * h * 0.03 : 0);
        const hx = hipX + sd * h * 0.04;
        const kx = (hx + fx) / 2 + sd * d * h * 0.06 + L * h * 0.02;
        const ky = (hipY + fy) / 2 + d * h * 0.02;
        c.strokeStyle = lk.skirt ? skin : bottom;
        c.lineWidth = h * (lk.skirt ? 0.048 : 0.075);
        c.beginPath(); c.moveTo(hx, hipY); c.lineTo(kx, ky); c.lineTo(fx, fy - h * 0.025); c.stroke();
        c.fillStyle = shoe;
        ell(c, fx + sd * h * 0.012, fy - h * 0.014, h * 0.045, h * 0.022); c.fill();
      }
      if (lk.skirt) {
        c.fillStyle = bottom;
        c.beginPath();
        c.moveTo(hipX - h * 0.075, hipY - h * 0.03); c.lineTo(hipX + h * 0.075, hipY - h * 0.03);
        c.lineTo(hipX + h * 0.14 + L * h * 0.03, hipY + h * 0.19); c.lineTo(hipX - h * 0.14 + L * h * 0.03, hipY + h * 0.19);
        c.closePath(); c.fill();
      }
      // Torso.
      c.fillStyle = top;
      c.beginPath();
      c.moveTo(hipX - h * 0.072, hipY + h * 0.02); c.lineTo(hipX + h * 0.072, hipY + h * 0.02);
      c.lineTo(shX + h * 0.095, shY + h * 0.035);
      c.quadraticCurveTo(shX, shY - h * 0.035, shX - h * 0.095, shY + h * 0.035);
      c.closePath(); c.fill();
      // A painted fold of shadow down one side of the torso.
      c.fillStyle = 'rgba(20,10,30,0.16)';
      c.beginPath();
      c.moveTo(hipX + h * 0.02, hipY + h * 0.02); c.lineTo(hipX + h * 0.072, hipY + h * 0.02);
      c.lineTo(shX + h * 0.095, shY + h * 0.035); c.lineTo(shX + h * 0.05, shY + h * 0.02);
      c.closePath(); c.fill();
      // Head (mostly seen from behind, as the crowd faces the DJ).
      const hr = h * 0.068;
      const hx = shX + L * h * 0.02, hy = shY - h * 0.085 + ps.nod * h * 0.02;
      c.strokeStyle = skin; c.lineWidth = h * 0.04;
      c.beginPath(); c.moveTo(shX, shY + h * 0.01); c.lineTo(hx, hy); c.stroke();
      c.fillStyle = skin; ell(c, hx, hy, hr, hr * 1.05); c.fill();
      c.fillStyle = hair;
      switch (lk.style) {
        case 0: // bob
          c.beginPath(); c.arc(hx, hy - hr * 0.05, hr * 1.1, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(hx + hr * 1.05, hy + hr * 0.75); c.lineTo(hx - hr * 1.05, hy + hr * 0.75); c.closePath(); c.fill(); break;
        case 1: // bun
          c.beginPath(); c.arc(hx, hy, hr * 1.06, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(hx + hr, hy + hr * 0.4); c.lineTo(hx - hr, hy + hr * 0.4); c.closePath(); c.fill();
          ell(c, hx, hy - hr * 1.1, hr * 0.5, hr * 0.45); c.fill(); break;
        case 2: // short
          c.beginPath(); c.arc(hx, hy, hr * 1.05, Math.PI * 1.0, Math.PI * 2.0); c.lineTo(hx + hr, hy + hr * 0.5); c.lineTo(hx - hr, hy + hr * 0.5); c.closePath(); c.fill(); break;
        case 3: // round
          ell(c, hx, hy - hr * 0.15, hr * 1.42, hr * 1.35); c.fill(); break;
        case 4: { // ponytail, swinging opposite the lean
          c.beginPath(); c.arc(hx, hy, hr * 1.05, Math.PI * 1.0, Math.PI * 2.0); c.lineTo(hx + hr, hy + hr * 0.45); c.lineTo(hx - hr, hy + hr * 0.45); c.closePath(); c.fill();
          c.strokeStyle = hair; c.lineWidth = hr * 0.7;
          c.beginPath(); c.moveTo(hx, hy - hr * 0.2); c.quadraticCurveTo(hx - L * hr * 1.5, hy + hr * 0.8, hx - L * hr * 2 - sw * hr * 0.6, hy + hr * 1.6); c.stroke();
          break;
        }
        default: { // knit hat with a bobble, in a clothes colour
          const hat = pal.clothes[(lk.top + 3) % pal.clothes.length];
          c.fillStyle = hat;
          c.beginPath(); c.arc(hx, hy, hr * 1.1, Math.PI * 1.0, Math.PI * 2.0); c.lineTo(hx + hr * 1.1, hy + hr * 0.15); c.lineTo(hx - hr * 1.1, hy + hr * 0.15); c.closePath(); c.fill();
          c.fillStyle = mix(hat, '#FFFFFF', 0.45); ell(c, hx, hy - hr * 1.15, hr * 0.38, hr * 0.38); c.fill();
        }
      }
      // Arms: down, forearms up, swinging; or up, hands meeting overhead.
      c.lineWidth = h * 0.05;
      for (let sd = -1; sd <= 1; sd += 2) {
        const sx = shX + sd * h * 0.083, sy = shY + h * 0.035;
        const ex = lerp(sx + sd * h * 0.05, sx + sd * h * 0.07, A), ey = lerp(sy + h * 0.13, sy - h * 0.1, A);
        const hxx = lerp(sx + sd * h * 0.07 + sd * sw * h * 0.035, shX + sd * h * 0.018, A);
        const hyy = lerp(sy + h * 0.05 - sd * sw * h * 0.03, shY - h * 0.29, A);
        c.strokeStyle = lk.bare ? skin : top;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(hxx, hyy); c.stroke();
        c.fillStyle = skin; ell(c, hxx, hyy, h * 0.027, h * 0.027); c.fill();
      }
    },

    // The neighbour in the lawn chair: taps a toe on the kick, raises a cup
    // on the clap once the drop is on.
    seated(c, cx, fy, s, pal, kick, t) {
      const sy = fy - 34 * s;
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.fillStyle = 'rgba(18,12,22,0.3)'; ell(c, cx, fy, 44 * s, 7 * s); c.fill();
      // Chair: aluminium frame and striped webbing.
      c.strokeStyle = '#C9CCD2'; c.lineWidth = 2.2 * s;
      c.beginPath(); c.moveTo(cx - 26 * s, fy); c.lineTo(cx + 16 * s, sy); c.moveTo(cx + 22 * s, fy); c.lineTo(cx - 22 * s, sy); c.stroke();
      const web = ['#3F8A6A', '#EDE3CF'];
      for (let i = 0; i < 6; i++) {
        c.fillStyle = web[i % 2];
        c.beginPath();
        const u0 = i / 6, u1 = (i + 1) / 6;
        c.moveTo(lerp(cx + 22 * s, cx + 36 * s, u0), lerp(sy, sy - 58 * s, u0)); c.lineTo(lerp(cx + 22 * s, cx + 36 * s, u1), lerp(sy, sy - 58 * s, u1));
        c.lineTo(lerp(cx + 12 * s, cx + 26 * s, u1), lerp(sy + 2 * s, sy - 56 * s, u1)); c.lineTo(lerp(cx + 12 * s, cx + 26 * s, u0), lerp(sy + 2 * s, sy - 56 * s, u0));
        c.closePath(); c.fill();
      }
      c.fillStyle = web[0]; c.fillRect(cx - 24 * s, sy - 3 * s, 46 * s, 6 * s);
      // Sitter.
      const skin = '#C98E68', coat = pal.clothes[5], trou = '#4A4A58';
      const tap = clamp(kick, 0, 1.5);
      c.strokeStyle = trou; c.lineWidth = 10 * s;
      c.beginPath(); c.moveTo(cx + 12 * s, sy - 6 * s); c.lineTo(cx - 24 * s, sy - 8 * s); c.lineTo(cx - 30 * s, fy - 4 * s); c.stroke();
      c.fillStyle = '#1D1820';
      ell(c, cx - 34 * s, fy - 3 * s - tap * 3 * s, 8 * s, 3.5 * s, tap * 0.35); c.fill();
      c.fillStyle = coat;
      c.beginPath(); c.moveTo(cx + 18 * s, sy - 2 * s); c.lineTo(cx + 2 * s, sy - 4 * s); c.lineTo(cx + 10 * s, sy - 48 * s); c.lineTo(cx + 28 * s, sy - 46 * s); c.closePath(); c.fill();
      const hx = cx + 16 * s + Math.sin(t * 1.1) * 1 * s, hy = sy - 60 * s + tap * 1.2 * s;
      c.fillStyle = skin; ell(c, hx, hy, 9 * s, 9.5 * s); c.fill();
      // A flat cap with its brim to the party.
      c.fillStyle = '#6E5A48';
      c.beginPath(); c.arc(hx + 1 * s, hy - 2 * s, 10 * s, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
      c.fillRect(hx - 14 * s, hy - 4 * s, 8 * s, 3 * s);
      const raise = this.dense && (t - (this.clapAt || -9)) < 0.5 ? 1 : 0;
      this.cup = (this.cup || 0) + (raise - (this.cup || 0)) * 0.2;
      const ex = cx + 2 * s, ey = lerp(sy - 26 * s, sy - 50 * s, this.cup);
      const hdx = lerp(cx - 8 * s, cx - 2 * s, this.cup), hdy = lerp(sy - 30 * s, sy - 76 * s, this.cup);
      c.strokeStyle = coat; c.lineWidth = 7 * s;
      c.beginPath(); c.moveTo(cx + 16 * s, sy - 42 * s); c.lineTo(ex, ey); c.lineTo(hdx, hdy); c.stroke();
      c.fillStyle = '#E8584A'; c.fillRect(hdx - 3.5 * s, hdy - 9 * s, 7 * s, 9 * s);
      c.fillStyle = skin; ell(c, hdx, hdy, 3.5 * s, 3.5 * s); c.fill();
    },

    // ---------- frame ----------
    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.t === null ? 1 / 60 : clamp(t - this.t, 0, 0.1);
      this.t = t;
      const pal = SEASONS[clamp(Math.round(params.season), 0, SEASONS.length - 1)];
      this.pal = pal;
      const key = W.toFixed(1) + 'x' + H.toFixed(1);
      if (this.geoKey !== key) { this.geo = this.layout(W, H); this.geoKey = key; this.win = null; }
      const g = this.geo, s = g.s;
      const crowd = clamp(params.crowd, 0.3, 1);
      const dk = key + ':' + crowd.toFixed(2);
      if (this.dancerKey !== dk) { this.dancers = this.makeDancers(g, crowd); this.dancerKey = dk; this.lean = null; }
      if (!this.win) {
        this.win = g.blkWins.map((w, i) => ({ lit: hash(i, 71) < 0.45, party: false, cat: i === 1, at: -9, ph: hash(i, 3) * 6.28 }));
      }
      this.makeSkyline(p, g, pal);
      this.makeTexture(p);

      this.analyse(signals, t, dt);
      const react = clamp(params.reaction, 0, 2);
      const breeze = clamp(params.breeze, 0, 3);
      const k = (tau) => 1 - Math.exp(-dt / tau);

      if (!this.dense && this.low > 27) { this.dense = true; this.hadDrop = true; this.gustAt = t; }
      else if (this.dense && this.low < 19) { this.dense = false; }
      this.dropAmt += ((this.dense ? 1 : 0) - this.dropAmt) * k(this.dense ? 0.7 : 2.2);
      this.hush += ((!this.dense && this.hadDrop ? 1 : 0) - this.hush) * k(2.5);
      // The breakdown puts the block to bed, one window at a time.
      if (!this.dense) {
        this.winTimer += dt;
        if (this.winTimer > 1.3) {
          this.winTimer = 0;
          const on = this.win.filter((w) => w.party);
          if (on.length) { const w = on[Math.floor(Math.random() * on.length)]; w.party = false; w.lit = Math.random() < 0.3; w.at = t; }
        }
      }

      const kickE = Math.exp(-Math.max(0, t - this.lastKick) / 0.13) * (t - this.lastKick < 2 ? 1 : 0);
      const clapE = t - (this.clapAt || -9) < 0.42 ? 1 : 0;
      this.phase += dt * breeze * (0.3 + 0.9 * this.energy + 0.6 * this.bassEnv);
      const sway = Math.sin(this.phase * 0.23) * 1 + Math.sin(this.phase * 0.071 + 2) * 0.6;
      this.windX += dt * breeze * (0.6 + this.bassEnv * 1.2 + this.dropAmt * 1.5);

      p.colorMode(p.RGB, 255);
      const c = p.drawingContext;
      c.save();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.lineCap = 'round'; c.lineJoin = 'round';

      // ---- sky ----
      c.drawImage(this.cvSky, -2, -2, W + 4, g.yS + 4);
      if (this.dropAmt > 0.01) {
        // The drop warms the horizon with the second ink.
        const sg = c.createLinearGradient(0, g.yS * 0.45, 0, g.yS);
        sg.addColorStop(0, rgba(pal.bulb2, 0)); sg.addColorStop(1, rgba(pal.bulb2, 0.3 * this.dropAmt));
        c.fillStyle = sg; c.fillRect(-2, g.yS * 0.45, W + 4, g.yS * 0.55 + 4);
      }
      // Stars; hats wake a few.
      for (let i = 0; i < g.stars.length; i++) {
        const st = g.stars[i];
        let a = 0.35 + 0.25 * Math.sin(t * 0.8 + st.ph);
        let sz = st.s;
        for (const tw of this.twinkles) if (tw.i % 70 === i) { const e = Math.exp(-(t - tw.at) / 0.18); a += e * 0.6; sz += e * 1.6 * s; }
        c.fillStyle = rgba(pal.star, clamp(a, 0, 1) * (pal.fall === 'swifts' ? 0.5 : 1));
        c.fillRect(st.x - sz / 2, st.y - sz / 2, sz, sz);
      }
      // Moon with a painted halo (flat discs of lighter paint), rising very slowly.
      const moonY = g.moon.y - Math.min(40 * s, t * 0.12 * s) + Math.sin(t * 0.02) * 4 * s;
      const mx = g.moon.x + sway * 3 * s;
      c.fillStyle = rgba(pal.moon, 0.07 + this.padEnv * 0.05); ell(c, mx, moonY, g.moon.r * 2.4, g.moon.r * 2.4); c.fill();
      c.fillStyle = rgba(pal.moon, 0.1); ell(c, mx, moonY, g.moon.r * 1.55, g.moon.r * 1.55); c.fill();
      c.fillStyle = pal.moon; ell(c, mx, moonY, g.moon.r, g.moon.r); c.fill();
      c.fillStyle = pal.moonSh;
      ell(c, mx - g.moon.r * 0.3, moonY - g.moon.r * 0.2, g.moon.r * 0.28, g.moon.r * 0.2, 0.4); c.fill();
      ell(c, mx + g.moon.r * 0.25, moonY + g.moon.r * 0.3, g.moon.r * 0.22, g.moon.r * 0.16, -0.3); c.fill();
      ell(c, mx + g.moon.r * 0.35, moonY - g.moon.r * 0.35, g.moon.r * 0.12, g.moon.r * 0.1); c.fill();
      // Clouds: long painted streaks drifting across.
      for (const cl of g.clouds) {
        const span = W + cl.len * 2;
        const x = ((cl.fx * span + this.windX * 8 * s * cl.sp) % span) - cl.len;
        c.fillStyle = rgba(pal.cloud, 0.55);
        ell(c, x, cl.y, cl.len * 0.5, cl.th, 0); c.fill();
        ell(c, x + cl.len * 0.18, cl.y - cl.th * 0.6, cl.len * 0.3, cl.th * 0.8, 0); c.fill();
      }
      // A plane crossing, every forty seconds.
      {
        const per = 40, u = ((t + 12) % per) / 22;
        if (u < 1) {
          const px = lerp(W + 20, -20, u), py = H * 0.2 + u * H * 0.04;
          c.fillStyle = rgba(pal.sky[0], 0.9); c.fillRect(px - 6 * s, py - 1 * s, 12 * s, 2 * s);
          if (Math.floor(t * 1.4) % 2 === 0) { c.fillStyle = '#E8584A'; c.fillRect(px - 1.5 * s, py - 1.5 * s, 3 * s, 3 * s); }
        }
      }
      // Summer: a flock of swifts wheeling high.
      if (pal.fall === 'swifts') {
        const n = Math.round(8 + 8 * this.dropAmt);
        const cx = W * (0.45 + 0.12 * Math.sin(t * 0.05)), cy = H * 0.36;
        c.strokeStyle = '#2A2440'; c.lineWidth = 1.6 * s;
        for (let i = 0; i < n; i++) {
          const b = g.swifts[i];
          const a = b.a + t * b.sp * (1 + this.energy);
          const x = cx + Math.cos(a) * b.rr * s * 1.6, y = cy + Math.sin(a * 1.3) * b.rr * s * 0.35 + b.dy * s;
          const f = Math.sin(t * 14 + b.ph) * 3 * s;
          c.beginPath(); c.moveTo(x - 6 * s, y - f); c.quadraticCurveTo(x - 2 * s, y - 1 * s, x, y); c.quadraticCurveTo(x + 2 * s, y - 1 * s, x + 6 * s, y - f); c.stroke();
        }
      }

      // ---- skyline (two ranks, parallax) ----
      c.drawImage(this.cvA, -g.M + sway * 4 * s, 0, W + 2 * g.M, this.cvH);
      if (g.beacon && Math.floor(t * 0.9) % 2 === 0) { c.fillStyle = '#E8584A'; ell(c, g.beacon.x + sway * 4 * s, g.beacon.y, 1.8 * s, 1.8 * s); c.fill(); }
      c.drawImage(this.cvB, -g.M + sway * 8 * s, 0, W + 2 * g.M, this.cvH);
      for (let i = 0; i < g.live.length; i++) {
        const w = g.live[i];
        const per = 5 + hash(i, 9) * 9;
        const on = hash(i, Math.floor((t + hash(i, 4) * per) / per)) < 0.5;
        c.fillStyle = on ? pal.farWin : pal.farDim;
        c.fillRect(w.x + sway * 8 * s, w.y, w.w, w.h);
      }

      // ---- the block across the street ----
      const bxo = sway * 13 * s;
      {
        const B = g.blk;
        c.fillStyle = pal.brick;
        wobRect(c, B.x + bxo, B.top, B.x1 - B.x, g.yP - B.top + 4, 71, 1.4 * s); c.fill();
        // Brick courses: a few painted lines, not a pattern.
        c.fillStyle = rgba(pal.brickSh, 0.35);
        for (let i = 0; i < 18; i++) {
          const yy = B.top + 30 * s + i * (g.yP - B.top) / 18;
          const x0 = B.x + bxo + hash(i, 2) * (B.x1 - B.x) * 0.6;
          c.fillRect(x0, yy, (B.x1 - B.x) * (0.15 + hash(i, 5) * 0.25), 1.6 * s);
        }
        // Cornice.
        c.fillStyle = pal.trim;
        wobRect(c, B.x + bxo - 6 * s, B.top - 8 * s, B.x1 - B.x + 12 * s, 10 * s, 72, 0.8 * s); c.fill();
        c.fillStyle = pal.brickSh;
        for (let i = 0; i < 9; i++) c.fillRect(B.x + bxo + i * (B.x1 - B.x) / 9, B.top + 2 * s, 5 * s, 5 * s);
        // Windows.
        for (let i = 0; i < g.blkWins.length; i++) {
          const w = g.blkWins[i], st = this.win[i];
          const wx = w.x + bxo;
          c.fillStyle = pal.trim;
          c.fillRect(wx - 3 * s, w.y + w.h, w.w + 6 * s, 4 * s);
          c.fillRect(wx - 2 * s, w.y - 5 * s, w.w + 4 * s, 4 * s);
          const lit = st.lit || st.party || st.cat;
          const age = t - st.at;
          const on = clamp(age / 0.12, 0, 1);
          const col = st.cat ? mix(pal.winLit, pal.winDark, 0.35)
            : lit ? mix(pal.winDark, st.party && (i % 3 === 1) ? pal.winLit2 : pal.winLit, on) : mix(pal.winLit, pal.winDark, on);
          c.fillStyle = col;
          wobRect(c, wx, w.y, w.w, w.h, 200 + i, 0.6 * s); c.fill();
          if (lit) {
            // Curtains, painted as two lighter stripes.
            c.fillStyle = rgba('#FFFFFF', 0.14);
            c.fillRect(wx, w.y, w.w * 0.16, w.h); c.fillRect(wx + w.w * 0.84, w.y, w.w * 0.16, w.h);
          }
          c.save(); c.beginPath(); c.rect(wx, w.y, w.w, w.h); c.clip();
          if (st.party && age > 0.1) {
            // A neighbour dancing: head and shoulders, bobbing with the kick.
            const up = clamp((age - 0.1) / 0.3, 0, 1);
            const cx = wx + w.w * (0.5 + 0.12 * Math.sin(t * 2 + st.ph)), by = w.y + w.h + (1 - up) * w.h * 0.8;
            const hh = w.h;
            const bob = kickE * 3 * s * react;
            c.fillStyle = pal.sil;
            ell(c, cx, by - hh * 0.05 + bob, w.w * 0.34, hh * 0.3); c.fill();
            ell(c, cx, by - hh * 0.5 + bob, hh * 0.13, hh * 0.14); c.fill();
            const armU = clapE && (i % 2 === 0) ? 1 : 0.2 + 0.2 * Math.sin(t * 3 + st.ph);
            c.strokeStyle = pal.sil; c.lineWidth = 3 * s;
            for (let sd = -1; sd <= 1; sd += 2) {
              c.beginPath(); c.moveTo(cx + sd * w.w * 0.22, by - hh * 0.25 + bob);
              c.lineTo(cx + sd * w.w * lerp(0.4, 0.14, armU), by - hh * lerp(0.2, 0.72, armU) + bob); c.stroke();
            }
          }
          if (st.cat) {
            // The cat, unmoved by any of it, except the tail.
            const cx = wx + w.w * 0.4, by = w.y + w.h;
            c.fillStyle = pal.sil;
            ell(c, cx, by - w.h * 0.18, w.w * 0.2, w.h * 0.2); c.fill();
            ell(c, cx + w.w * 0.02, by - w.h * 0.45, w.w * 0.13, w.h * 0.12); c.fill();
            c.beginPath(); c.moveTo(cx - w.w * 0.07, by - w.h * 0.52); c.lineTo(cx - w.w * 0.05, by - w.h * 0.64); c.lineTo(cx - w.w * 0.0, by - w.h * 0.54); c.fill();
            c.beginPath(); c.moveTo(cx + w.w * 0.05, by - w.h * 0.53); c.lineTo(cx + w.w * 0.1, by - w.h * 0.64); c.lineTo(cx + w.w * 0.13, by - w.h * 0.5); c.fill();
            const tail = Math.sin(t * 2.2) * 0.5 + Math.sin(t * 5.1) * 0.15;
            c.strokeStyle = pal.sil; c.lineWidth = 2.4 * s;
            c.beginPath(); c.moveTo(cx + w.w * 0.15, by - w.h * 0.05);
            c.quadraticCurveTo(cx + w.w * 0.35, by + w.h * 0.02, cx + w.w * (0.33 + tail * 0.15), by - w.h * (0.25 + tail * 0.1)); c.stroke();
          }
          // Sash bar.
          c.fillStyle = pal.trim; c.fillRect(wx, w.y + w.h * 0.48, w.w, 2 * s);
          c.restore();
        }
        // Fire escape across the right-hand column: landings, rails, ladders.
        c.strokeStyle = pal.iron; c.fillStyle = pal.iron; c.lineWidth = 1.6 * s;
        const fx0 = B.x + bxo + (B.x1 - B.x) * 0.52, fx1 = B.x1 + bxo + 4 * s;
        for (let rI = 0; rI < 4; rI++) {
          const ly = H * 0.315 + rI * H * 0.1 + H * 0.075 + 4 * s;
          c.fillRect(fx0, ly, fx1 - fx0, 3 * s);
          c.beginPath(); c.moveTo(fx0, ly - 16 * s); c.lineTo(fx1, ly - 16 * s); c.stroke();
          for (let x = fx0; x <= fx1 + 0.1; x += (fx1 - fx0) / 7) { c.beginPath(); c.moveTo(x, ly); c.lineTo(x, ly - 16 * s); c.stroke(); }
          if (rI < 3) {
            const a = rI % 2 === 0;
            c.beginPath(); c.moveTo(a ? fx0 + 6 * s : fx1 - 6 * s, ly); c.lineTo(a ? fx1 - 10 * s : fx0 + 10 * s, ly + H * 0.1); c.stroke();
            c.beginPath(); c.moveTo(a ? fx0 + 12 * s : fx1 - 12 * s, ly); c.lineTo(a ? fx1 - 4 * s : fx0 + 4 * s, ly + H * 0.1); c.stroke();
          }
        }
      }

      // ---- our roof: parapet and deck ----
      c.fillStyle = pal.deck;
      c.fillRect(-2, g.yP + 12 * s, W + 4, H - g.yP);
      {
        // The pool of light under the bulbs: paint, not glow; the bass widens it.
        const px = W * 0.47, py = H * 0.9;
        const pr = W * (0.32 + 0.08 * this.bassEnv + 0.05 * this.dropAmt);
        const rg = c.createRadialGradient(px, py, 0, px, py, pr);
        const a = 0.45 + 0.25 * this.bassEnv + 0.15 * this.dropAmt - 0.15 * this.hush;
        rg.addColorStop(0, rgba(pal.deckLit, clamp(a, 0, 1)));
        rg.addColorStop(0.6, rgba(pal.deckLit, clamp(a * 0.45, 0, 1)));
        rg.addColorStop(1, rgba(pal.deckLit, 0));
        c.save(); c.translate(px, py); c.scale(1, 0.32); c.translate(-px, -py);
        c.fillStyle = rg; c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        c.restore();
        // Tar seams.
        c.fillStyle = rgba('#000000', 0.12);
        for (let i = 0; i < 6; i++) c.fillRect(-2, g.yP + 30 * s + i * i * 5 * s, W + 4, 1.5 * s);
      }
      c.fillStyle = pal.parapet;
      wobRect(c, -4, g.yP, W + 8, 14 * s, 81, 0.8 * s); c.fill();
      c.fillStyle = pal.parTop;
      wobRect(c, -4, g.yP - 4 * s, W + 8, 6 * s, 82, 0.7 * s); c.fill();
      // Seasonal ornament on the parapet.
      {
        const ox = W * 0.305, oy = g.yP - 3 * s;
        if (pal.ornament === 'pumpkin') {
          c.fillStyle = '#D9722C'; ell(c, ox, oy - 9 * s, 14 * s, 10 * s); c.fill();
          c.fillStyle = '#B85A22'; ell(c, ox - 5 * s, oy - 9 * s, 3 * s, 9 * s); c.fill(); ell(c, ox + 5 * s, oy - 9 * s, 3 * s, 9 * s); c.fill();
          c.fillStyle = '#4C5A2A'; c.fillRect(ox - 1.5 * s, oy - 23 * s, 3 * s, 6 * s);
          c.fillStyle = '#E6B84A'; ell(c, ox + 22 * s, oy - 6 * s, 7 * s, 6 * s); c.fill();
        } else if (pal.ornament === 'snowman') {
          c.fillStyle = '#F3F4F7'; ell(c, ox, oy - 10 * s, 11 * s, 10 * s); c.fill(); ell(c, ox, oy - 26 * s, 8 * s, 8 * s); c.fill();
          c.fillStyle = '#C23B35'; c.fillRect(ox - 8 * s, oy - 20 * s, 16 * s, 3 * s);
          c.fillStyle = '#1D1820'; c.fillRect(ox - 6 * s, oy - 35 * s, 12 * s, 2 * s); c.fillRect(ox - 4 * s, oy - 44 * s, 8 * s, 10 * s);
          c.fillStyle = '#E8873A'; c.beginPath(); c.moveTo(ox + 2 * s, oy - 27 * s); c.lineTo(ox + 10 * s, oy - 26 * s); c.lineTo(ox + 2 * s, oy - 25 * s); c.fill();
        } else {
          c.strokeStyle = '#2A2230'; c.lineWidth = 1.4 * s;
          c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox, oy - 16 * s); c.stroke();
          c.fillStyle = '#EE7FA0'; ell(c, ox, oy - 20 * s, 10 * s, 6 * s, -0.2); c.fill();
          c.strokeStyle = '#EE7FA0'; c.lineWidth = 3 * s;
          c.beginPath(); c.moveTo(ox + 7 * s, oy - 22 * s); c.quadraticCurveTo(ox + 12 * s, oy - 40 * s, ox + 6 * s, oy - 38 * s); c.stroke();
          c.fillStyle = '#2A2230'; c.fillRect(ox + 2 * s, oy - 39 * s, 4 * s, 2 * s);
        }
      }

      // ---- water tower and its pigeons ----
      {
        const T = g.tw, tx = T.x;
        c.strokeStyle = pal.leg; c.lineWidth = 4 * s;
        const legs = [-0.42, -0.14, 0.14, 0.42];
        for (const l of legs) { c.beginPath(); c.moveTo(tx + l * T.w, T.bot); c.lineTo(tx + l * T.w * 1.18, T.foot); c.stroke(); }
        c.lineWidth = 1.8 * s;
        for (let i = 0; i < 3; i++) {
          const y0 = lerp(T.bot, T.foot, i / 3), y1 = lerp(T.bot, T.foot, (i + 1) / 3);
          c.beginPath(); c.moveTo(tx - 0.42 * T.w, y0); c.lineTo(tx + 0.42 * T.w * 1.06, y1); c.stroke();
          c.beginPath(); c.moveTo(tx + 0.42 * T.w, y0); c.lineTo(tx - 0.42 * T.w * 1.06, y1); c.stroke();
        }
        // Tank: staves and hoops.
        c.fillStyle = pal.tank;
        wobRect(c, tx - T.w / 2, T.top, T.w, T.bot - T.top, 91, 1 * s); c.fill();
        c.fillStyle = pal.tankSh; c.fillRect(tx + T.w * 0.18, T.top, T.w * 0.32, T.bot - T.top);
        c.fillStyle = rgba(pal.tankSh, 0.6);
        for (let i = 1; i < 9; i++) c.fillRect(tx - T.w / 2 + i * T.w / 9, T.top + 2 * s, 1.2 * s, T.bot - T.top - 4 * s);
        c.fillStyle = pal.leg;
        for (let i = 0; i < 4; i++) c.fillRect(tx - T.w / 2 - 1 * s, lerp(T.top + 8 * s, T.bot - 6 * s, i / 3), T.w + 2 * s, 2.4 * s);
        // Conical roof with a finial.
        c.fillStyle = pal.tankRoof;
        c.beginPath(); c.moveTo(tx - T.w * 0.56, T.top + 2 * s); c.lineTo(tx, T.top - T.w * 0.42); c.lineTo(tx + T.w * 0.56, T.top + 2 * s); c.closePath(); c.fill();
        c.fillRect(tx - 1.5 * s, T.top - T.w * 0.42 - 9 * s, 3 * s, 10 * s);
        // Catwalk.
        c.fillStyle = pal.leg; c.fillRect(tx - T.w * 0.62, T.bot, T.w * 1.24, 3 * s);
        c.lineWidth = 1.2 * s; c.strokeStyle = pal.leg;
        c.beginPath(); c.moveTo(tx - T.w * 0.62, T.bot - 9 * s); c.lineTo(tx + T.w * 0.62, T.bot - 9 * s); c.stroke();
        // Pigeons on the catwalk rail: they bob their heads on the kick.
        const pig = [-0.5, -0.32, 0.4];
        for (let i = 0; i < pig.length; i++) {
          const px = tx + pig[i] * T.w, py = T.bot - 9 * s;
          const dir = i === 2 ? -1 : 1;
          const bob = clamp(kickE * react, 0, 1.5) * (i === 1 ? 0.6 : 1);
          c.fillStyle = '#8C93A8'; ell(c, px, py - 5 * s, 7 * s, 5 * s, -0.2 * dir); c.fill();
          c.fillStyle = '#6E7590'; ell(c, px - dir * 4 * s, py - 4 * s, 5 * s, 3 * s, -0.3 * dir); c.fill();
          c.fillStyle = '#9FA6BA'; ell(c, px + dir * (6 + bob * 3) * s, py - (11 - bob * 4) * s, 3.4 * s, 3.4 * s); c.fill();
          c.fillStyle = '#E3A04A'; c.fillRect(px + dir * (8.6 + bob * 3) * s - (dir < 0 ? 2 * s : 0), py - (11 - bob * 4) * s, 2 * s, 1.2 * s);
        }
      }

      // ---- strands of bulbs ----
      {
        let bi = 0;
        for (const st of g.strands) {
          c.strokeStyle = pal.wire; c.lineWidth = 1.1 * s;
          const swing = Math.sin(t * 0.9 + st.y0) * 2 * s * breeze;
          c.beginPath();
          for (let u = 0; u <= 1.0001; u += 0.05) {
            const x = lerp(st.x0, st.x1, u), y = lerp(st.y0, st.y1, u) + st.sag * 4 * u * (1 - u) + swing * 4 * u * (1 - u);
            if (u === 0) c.moveTo(x + bxo * (1 - u), y); else c.lineTo(x + bxo * (1 - u), y);
          }
          c.stroke();
          const len = Math.hypot(st.x1 - st.x0, st.y1 - st.y0);
          const n = Math.floor(len / (26 * s));
          for (let j = 1; j < n; j++, bi++) {
            const u = j / n;
            const x = lerp(st.x0, st.x1, u) + bxo * (1 - u), y = lerp(st.y0, st.y1, u) + st.sag * 4 * u * (1 - u) + swing * 4 * u * (1 - u) + 5 * s;
            let e = 0;
            for (const tw of this.twinkles) if (tw.i % 37 === bi % 37) e = Math.max(e, Math.exp(-(t - tw.at) / 0.16));
            const alt = this.dropAmt > 0.5 && bi % 2 === 1;
            const colB = alt ? pal.bulb2 : pal.bulb;
            const dim = 0.72 - 0.25 * this.hush + 0.2 * this.dropAmt;
            c.fillStyle = rgba(colB, clamp(0.13 + e * 0.22 + this.dropAmt * 0.05, 0, 1));
            ell(c, x, y, (9 + e * 5) * s, (9 + e * 5) * s); c.fill();
            c.fillStyle = mix(pal.wire, colB, clamp(dim + e * 0.5, 0, 1));
            ell(c, x, y, 3.4 * s, 4.2 * s); c.fill();
            if (e > 0.2) { c.fillStyle = rgba('#FFFFFF', e * 0.8); ell(c, x - 0.8 * s, y - 1.2 * s, 1.3 * s, 1.6 * s); c.fill(); }
          }
        }
      }

      // ---- people ----
      if (!this.lean || this.lean.length !== this.dancers.length) {
        this.lean = new Float32Array(this.dancers.length);
        this.arms = new Float32Array(this.dancers.length);
        this.pres = new Float32Array(this.dancers.length);
      }
      const drawList = [];
      for (let i = 0; i < this.dancers.length; i++) {
        const dn = this.dancers[i];
        // Stepping side to side: each kick flips the lean target.
        const beatLean = ((this.beats + i) % 2 ? 1 : -1) * dn.amp;
        const idle = Math.sin(t * (1.1 + 0.2 * (i % 3)) + dn.ph) * 0.55 * (0.4 + this.padEnv);
        const tgt = lerp(idle, beatLean, this.kickAct);
        this.lean[i] += (tgt - this.lean[i]) * k(0.11);
        const clapTgt = (clapE && dn.clapper ? 1 : 0);
        const dropUp = this.dense && dn.front && i % 2 === 0 ? 0.55 + 0.45 * Math.sin(t * 2.6 + dn.ph) : 0;
        const at = Math.max(clapTgt, dropUp);
        this.arms[i] += (at - this.arms[i]) * (at > this.arms[i] ? k(0.05) : k(0.2));
        if (dn.front) {
          const want = this.dense && (t - (this.gustAt || 0)) > dn.delay ? 1 : 0;
          this.pres[i] += (want - this.pres[i]) * k(want ? 0.35 : 0.8);
        } else this.pres[i] = 1;
        if (this.pres[i] < 0.01) continue;
        const dip = clamp(kickE * react, 0, 1.6) * dn.amp + (1 - this.kickAct) * 0.25 * (0.5 + 0.5 * Math.sin(t * 2 + dn.ph));
        drawList.push({ dn, i, pose: { dip, lean: this.lean[i] * clamp(react, 0.3, 1.5), arms: this.arms[i], swing: Math.sin(t * 3 + dn.ph) * (0.4 + this.energy), nod: kickE * react } });
      }
      drawList.sort((a, b) => a.dn.fy - b.dn.fy);
      const booth = () => {
        const D = g.dj;
        // Speakers either side.
        for (let sd = -1; sd <= 1; sd += 2) {
          const sx = D.x + sd * (D.w * 0.5 + 26 * s), sy = D.y + 30 * s;
          c.fillStyle = '#1E1A24'; wobRect(c, sx - 17 * s, sy - 62 * s, 34 * s, 62 * s, 400 + sd, 0.6 * s); c.fill();
          const push = 1 + 0.16 * kickE * react;
          c.fillStyle = '#3A3444'; ell(c, sx, sy - 20 * s, 11 * s * push, 11 * s * push); c.fill();
          c.fillStyle = '#16131A'; ell(c, sx, sy - 20 * s, 4 * s * push, 4 * s * push); c.fill();
          c.fillStyle = '#3A3444'; ell(c, sx, sy - 47 * s, 5 * s, 5 * s); c.fill();
        }
        // The DJ behind the table.
        {
          const dx = D.x + 8 * s, h = 132 * s, fy = D.y + 42 * s;
          const nod = kickE * react;
          const hipY = fy - h * 0.46, shY = hipY - h * 0.27;
          const shX = dx + Math.sin(t * 1.3) * 2 * s;
          c.fillStyle = '#E8E0CF';
          c.beginPath(); c.moveTo(dx - h * 0.075, hipY); c.lineTo(dx + h * 0.075, hipY); c.lineTo(shX + h * 0.1, shY + h * 0.035);
          c.quadraticCurveTo(shX, shY - h * 0.035, shX - h * 0.1, shY + h * 0.035); c.closePath(); c.fill();
          const hx = shX + nod * 2 * s, hy = shY - h * 0.085 + nod * 4 * s;
          c.strokeStyle = '#6B4430'; c.lineWidth = h * 0.04; c.beginPath(); c.moveTo(shX, shY); c.lineTo(hx, hy); c.stroke();
          c.fillStyle = '#6B4430'; ell(c, hx, hy, h * 0.068, h * 0.072); c.fill();
          // Face: this one faces us; two dots and a small smile, eyes shut.
          c.strokeStyle = '#2A1A14'; c.lineWidth = 1.2 * s;
          c.beginPath(); c.moveTo(hx - 4 * s, hy - 1 * s); c.lineTo(hx - 1.5 * s, hy - 1 * s); c.moveTo(hx + 1.5 * s, hy - 1 * s); c.lineTo(hx + 4 * s, hy - 1 * s); c.stroke();
          c.beginPath(); c.arc(hx, hy + 3 * s, 2.5 * s, 0.2, Math.PI - 0.2); c.stroke();
          // Hair and headphones.
          c.fillStyle = '#1A1418'; c.beginPath(); c.arc(hx, hy - 1 * s, h * 0.074, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
          c.strokeStyle = '#C9473A'; c.lineWidth = 2.6 * s;
          c.beginPath(); c.arc(hx, hy, h * 0.085, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
          c.fillStyle = '#C9473A'; ell(c, hx - h * 0.075, hy + 1 * s, 3.5 * s, 5 * s); c.fill(); ell(c, hx + h * 0.075, hy + 1 * s, 3.5 * s, 5 * s); c.fill();
          // Arms: one on the record (scratching with the hats), one on the fader or thrown up on the clap.
          this.djArm += ((clapE ? 1 : 0) - this.djArm) * (clapE ? k(0.05) : k(0.25));
          c.strokeStyle = '#E8E0CF'; c.lineWidth = h * 0.05;
          const sc = Math.sin(t * 9) * 3 * s * clamp(Math.max(this.prev[7], this.prev[8]) / 60, 0, 1);
          const lsx = shX - h * 0.085, lsy = shY + h * 0.035;
          const lhx = D.x - D.w * 0.24 + sc, lhy = D.y - 4 * s;
          c.beginPath(); c.moveTo(lsx, lsy); c.lineTo(lsx - 8 * s, lsy + 24 * s); c.lineTo(lhx, lhy); c.stroke();
          const rsx = shX + h * 0.085, rsy = shY + h * 0.035;
          const a = this.djArm;
          const rex = lerp(rsx + 10 * s, rsx + 12 * s, a), rey = lerp(rsy + 24 * s, rsy - 14 * s, a);
          const rhx = lerp(D.x + D.w * 0.05, rsx + 6 * s, a), rhy = lerp(D.y - 4 * s, rsy - 40 * s, a);
          c.beginPath(); c.moveTo(rsx, rsy); c.lineTo(rex, rey); c.lineTo(rhx, rhy); c.stroke();
          c.fillStyle = '#6B4430'; ell(c, lhx, lhy, 3.5 * s, 3.5 * s); c.fill(); ell(c, rhx, rhy, 3.5 * s, 3.5 * s); c.fill();
        }
        // Card table with a checked cloth, two turntables and a mixer.
        c.fillStyle = pal.table; c.fillRect(D.x - D.w / 2, D.y, D.w, 5 * s);
        c.fillStyle = pal.cloth; wobRect(c, D.x - D.w / 2 - 3 * s, D.y + 2 * s, D.w + 6 * s, 34 * s, 410, 0.8 * s); c.fill();
        c.fillStyle = pal.cloth2;
        for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) c.fillRect(D.x - D.w / 2 - 3 * s + i * (D.w + 6 * s) / 8, D.y + 2 * s + j * 11.3 * s, (D.w + 6 * s) / 8, 11.3 * s);
        c.fillStyle = pal.table; c.fillRect(D.x - D.w / 2 + 6 * s, D.y + 36 * s, 3 * s, 12 * s); c.fillRect(D.x + D.w / 2 - 9 * s, D.y + 36 * s, 3 * s, 12 * s);
        for (let sd = -1; sd <= 1; sd += 2) {
          const px = D.x + sd * D.w * 0.26, py = D.y - 3 * s;
          c.fillStyle = '#CFC6B4'; wobRect(c, px - 25 * s, py - 6 * s, 50 * s, 9 * s, 420 + sd, 0.4 * s); c.fill();
          c.fillStyle = '#16131A'; ell(c, px - 3 * s, py - 4 * s, 19 * s, 5 * s); c.fill();
          const ang = t * 3.5 * sd;
          c.fillStyle = sd < 0 ? pal.cloth : pal.bulb; ell(c, px - 3 * s, py - 4 * s, 5 * s, 1.5 * s); c.fill();
          c.strokeStyle = rgba('#FFFFFF', 0.35); c.lineWidth = 1 * s;
          c.beginPath(); c.moveTo(px - 3 * s + Math.cos(ang) * 8 * s, py - 4 * s + Math.sin(ang) * 2 * s); c.lineTo(px - 3 * s + Math.cos(ang) * 17 * s, py - 4 * s + Math.sin(ang) * 4.4 * s); c.stroke();
        }
        c.fillStyle = '#2A2632'; c.fillRect(D.x - 8 * s, D.y - 8 * s, 16 * s, 8 * s);
      };
      let boothDone = false;
      const pp = (item) => {
        const dn = item.dn;
        const lift = (1 - this.pres[item.i]) * dn.h * 0.9;
        this.person(c, dn.x, dn.fy + lift, dn.h, dn.look, item.pose, pal);
      };
      for (const item of drawList) {
        if (!boothDone && item.dn.fy > g.dj.y + 44 * s) { booth(); boothDone = true; }
        if (item.dn.front) continue;
        pp(item);
      }
      if (!boothDone) booth();

      // ---- the tree in its planter ----
      {
        const T = g.tree;
        const swy = Math.sin(t * 0.7) * 2 * s * breeze + Math.sin(this.windX * 0.8) * 2 * s;
        c.strokeStyle = pal.trunk; c.lineCap = 'round';
        c.lineWidth = 9 * s;
        c.beginPath(); c.moveTo(T.x, T.py); c.lineTo(T.x + swy * 0.3, T.y + 10 * s); c.stroke();
        c.lineWidth = 3 * s;
        for (const b of g.branches) {
          c.beginPath(); c.moveTo(T.x + swy * 0.3, T.y + 20 * s);
          c.lineTo(T.x + swy + Math.cos(b.a) * b.l, T.y + 20 * s + Math.sin(b.a) * b.l * 0.8); c.stroke();
        }
        // Foliage thins as leaves fall in the drop; bare with snow in winter.
        const keep = pal.fall === 'snow' ? 0.35 : 1 - 0.25 * this.dropAmt;
        for (let i = 0; i < g.dabs.length; i++) {
          const dbb = g.dabs[i];
          if (i / g.dabs.length > keep) break;
          c.fillStyle = pal.tree[dbb.c % pal.tree.length];
          const wob = Math.sin(t * 1.3 + dbb.ph) * 1.2 * s * breeze;
          ell(c, T.x + dbb.x + swy + wob, T.y + dbb.y, dbb.rx, dbb.ry, dbb.rot); c.fill();
        }
        // A wooden planter box, planks and a shadow side.
        const pw = 104 * s, ph = 58 * s;
        c.fillStyle = 'rgba(18,12,22,0.3)'; ell(c, T.x + 10 * s, T.py + ph, pw * 0.62, 8 * s); c.fill();
        c.fillStyle = pal.planter;
        wobRect(c, T.x - pw / 2, T.py, pw, ph, 500, 1 * s); c.fill();
        c.fillStyle = rgba('#000000', 0.22); c.fillRect(T.x + pw * 0.2, T.py, pw * 0.3, ph);
        c.fillStyle = rgba('#000000', 0.2);
        for (let i = 1; i < 3; i++) c.fillRect(T.x - pw / 2, T.py + i * ph / 3, pw, 1.5 * s);
        c.fillStyle = mix(pal.planter, '#FFFFFF', 0.25); c.fillRect(T.x - pw / 2 - 4 * s, T.py - 2 * s, pw + 8 * s, 6 * s);
      }

      this.seated(c, W - Math.max(W * 0.085, 60 * s), H * 0.965, s, pal, kickE * react, t);

      // ---- the foreground dancers, up the roof stairs in the drop ----
      for (const item of drawList) if (item.dn.front) pp(item);

      // ---- what falls ----
      if (pal.fall === 'leaves') {
        const rate = (0.9 + this.bassEnv * 1.5) * breeze + this.dropAmt * 5 * breeze + (t - (this.gustAt || -9) < 2.5 ? 14 : 0);
        this.leafAcc += rate * dt;
        const T = g.tree;
        while (this.leafAcc >= 1 && this.leaves.length < 70) {
          this.leafAcc -= 1;
          const a = Math.random() * 6.28, d = Math.sqrt(Math.random());
          this.leaves.push({ x: T.x + Math.cos(a) * d * T.r, y: T.y + Math.sin(a) * d * T.r * 0.8, vx: 0, vy: 10 * s, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 5, c: Math.floor(Math.random() * 4), ph: Math.random() * 6, sz: (4 + Math.random() * 3) * s });
        }
        if (this.leafAcc > 1) this.leafAcc = 1;
        const wind = (20 + 50 * this.bassEnv + 60 * this.dropAmt) * s * breeze;
        for (let i = this.leaves.length - 1; i >= 0; i--) {
          const L = this.leaves[i];
          L.vx += (wind - L.vx) * k(0.8);
          L.vy += (28 * s - L.vy) * k(1.2);
          L.x += (L.vx + Math.sin(t * 2.4 + L.ph) * 18 * s) * dt;
          L.y += (L.vy + Math.cos(t * 1.9 + L.ph) * 10 * s) * dt;
          L.rot += L.vr * dt;
          if (L.y > H + 10 || L.x > W + 10) { this.leaves.splice(i, 1); continue; }
          c.fillStyle = pal.tree[L.c];
          ell(c, L.x, L.y, L.sz, L.sz * 0.45 * Math.abs(Math.cos(L.rot * 0.7)) + 0.6 * s, L.rot); c.fill();
        }
      } else if (pal.fall === 'snow') {
        const n = Math.round(90 + 130 * this.dropAmt);
        c.fillStyle = 'rgba(245,246,250,0.85)';
        for (let i = 0; i < n; i++) {
          const f = g.snow[i];
          const y = ((f.y * (H + 20) + t * 22 * s * f.z * (1 + 0.5 * this.energy)) % (H + 20)) - 10;
          const x = ((f.x * (W + 40) + this.windX * 12 * s * f.z + Math.sin(t * 0.9 + f.ph) * 8 * s) % (W + 40)) - 20;
          const r = 1.3 * s * f.z;
          c.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }

      // ---- masthead and dateline ----
      {
        const name = String(params.masthead || 'The Borough');
        let fs = H * 0.15;
        c.font = '400 ' + fs.toFixed(1) + 'px ' + MAST_FONT;
        try { c.letterSpacing = (fs * 0.01).toFixed(1) + 'px'; } catch (e) { /* older canvas */ }
        const tw = c.measureText(name).width;
        // Centred, and narrow enough to clear the water tower's roof.
        const lim = Math.min(W * 0.6, (g.tw.x - g.tw.w * 0.62 - W / 2) * 2 - 16 * s);
        if (tw > lim) { fs *= lim / tw; c.font = '400 ' + fs.toFixed(1) + 'px ' + MAST_FONT; }
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        const base = H * 0.03 + fs * 0.82;
        c.fillStyle = mix(pal.mast, pal.mast2, clamp(this.dropAmt, 0, 1));
        c.fillText(name, W / 2, base);
        try { c.letterSpacing = '0px'; } catch (e) { /* */ }
        const ds = Math.max(8, 10.5 * s);
        c.font = '400 ' + ds.toFixed(1) + 'px ' + DATE_FONT;
        try { c.letterSpacing = (ds * 0.12).toFixed(1) + 'px'; } catch (e) { /* */ }
        c.fillStyle = rgba(pal.dateInk, 0.9);
        const half = Math.min(tw, lim) / 2;
        c.textAlign = 'left'; c.fillText(pal.date, W / 2 - half, base + ds * 2.1);
        c.textAlign = 'right'; c.fillText(pal.price, W / 2 + half, base + ds * 2.1);
        try { c.letterSpacing = '0px'; } catch (e) { /* */ }
      }

      // ---- brushwork and paper over everything ----
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'soft-light';
      c.globalAlpha = clamp(params.brush, 0, 2) * 0.5;
      c.drawImage(this.tex, 0, 0);
      c.restore();

      c.restore();
    },
  });
})();
