// Knit — a Fair Isle panel being knitted on a table in daylight.
//
// Seen from above: a wooden table, a knitted panel lying on it, the live row on
// a pair of wooden needles near the bottom, and the balls of yarn it is being
// knitted from. The panel is made stitch by stitch while you watch: the working
// point shuttles back and forth along the row (flat knitting), each new round
// of stitches pushes the finished fabric up the screen, and the pattern works
// through Fair Isle bands (peerie borders, lice, trees, OXO, eight-point stars)
// whose colours shift row by row as the real thing does.
//
// Craft notes:
// - Every finished row is its own offscreen strip, drawn once stitch by stitch
//   from pre-shaded stitch sprites (two leaning plied legs over a dark backing,
//   one sprite per yarn colour, three heathered variants each). A frame is then
//   ~40 strip blits plus the needles, strands and balls, so the fabric can be
//   as rich as we like and still cost almost nothing.
// - The panel moves up continuously (row k sits at (knitted/cols - k) rows above
//   the needle), so scrolling is smooth and exactly as fast as the knitting:
//   the bass sets the knitting speed, so the bass sets the travel.
// - Light is matte and real, not glow: a soft shadow of the panel and needles on
//   the table, drape folds across the fabric, and the shadow of a window frame
//   drifting across everything (drawn in a tiny canvas and upscaled, so its
//   edges are soft for free). The drop is the sun coming out; the breakdown is
//   overcast.
// - Music is found as onsets against slow baselines (the Aurora listener) and
//   placed where the knitting is, so the beat stays in one part of the frame:
//   a kick knits the current stitch in an accent yarn with a small pop, a jab of
//   the needle tips and a puff of fibres; a clap makes the ball in use hop and
//   hands the next row a new colour (and queues a new motif); hats fleck the
//   next stitches with tweed neps and glint the needle tips. Because every
//   stitch stays in the fabric, the panel is a record of the set: calm
//   stretches knit as quiet two-colour peerie bands, drops as big coloured
//   stars, and the kicks are the scatter of accent stitches through it.

(function () {
  'use strict';

  const TAU = Math.PI * 2;

  // grounds: the light yarns the background rows shade through; fores: the
  // pattern yarns. acc: [accent on a light stitch, accent on a dark stitch].
  const PALETTES = [
    { name: 'Shetland', table: '#b98c5c', needle: '#dcc08e',
      grounds: ['#ebe2cc', '#dfcfa9', '#d2b980'],
      fores: ['#28375e', '#8e2c27', '#4f6637', '#c68b27', '#5b3a2b'],
      acc: ['#d8391c', '#f5b71e'], bold: { g: [3, 4, 7], edge: 0, mids: [6, 0], dots: [4, 5, 6] } },
    { name: 'Selbu', table: '#c9bfae', needle: '#8a5a3a',
      grounds: ['#f3f0e8', '#e8e2d4', '#d9d0bd'],
      fores: ['#17181c', '#b21f2c', '#2d4b7c', '#6d7b45', '#7f848b'],
      acc: ['#e0331f', '#f4c21f'], bold: { g: [3, 5, 4], edge: 0, mids: [4, 1], dots: [4, 5, 0] } },
    { name: 'Peat', table: '#5e412b', needle: '#e0c79a',
      grounds: ['#2b2521', '#3a2f28', '#4a3a2d'],
      fores: ['#eadcbf', '#c8742c', '#8fa9a4', '#d9b24a', '#a44b3d'],
      acc: ['#e2461c', '#f7efd9'], bold: { g: [3, 6], edge: 0, mids: [4, 7], dots: [7, 4, 5] } },
    { name: 'Seaglass', table: '#a47c59', needle: '#e8d3a8',
      grounds: ['#e8eee8', '#d6e3dc', '#c3d6cf'],
      fores: ['#2e4c57', '#d4705a', '#e1ae45', '#6c8c7a', '#3b3a55'],
      acc: ['#df3b24', '#f6c12a'], bold: { g: [3, 7, 4], edge: 0, mids: [5, 4, 6], dots: [4, 5, 0] } },
  ];

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }
  function luma(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
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
  const WHITE = [255, 250, 240], BLACK = [12, 8, 6];

  // ---- Motifs: f(c, r) -> 0 ground, 1 pattern, 2 second pattern colour.
  // c is already reduced into the repeat, r runs 0..h-1 from the top of the band.
  const A = Math.abs;
  const MOTIFS = {
    plain:  { h: 1, rep: 1, f: () => 0 },
    seed:   { h: 1, rep: 2, f: (c) => c },
    lice:   { h: 4, rep: 6, f: (c, r) => ((r === 1 && c === 1) || (r === 3 && c === 4)) ? 1 : 0 },
    peerie: { h: 5, rep: 6, f: (c, r) => { const d = A(c - 3) + A(r - 2); return d === 2 ? 1 : d === 0 ? 2 : 0; } },
    zig:    { h: 4, rep: 6, f: (c, r) => (r === A(c - 3) || (r === 3 && c === 0)) ? 1 : 0 },
    border: { h: 7, rep: 8, f: (c, r) => { const d = A(c - 4) + A(r - 3); return d === 3 ? 1 : d <= 1 ? 2 : 0; } },
    tree:   { h: 9, rep: 10, f: (c, r) => {
      const w = [0, 1, 1, 2, 1, 2, 3, 0, 0][r], dx = A(c - 5);
      if (r >= 7) return dx === 0 ? 1 : 0;
      if (dx <= w && !(r === 4 && dx === 0 && false)) return 1;
      return (r === 4 && c === 0) ? 2 : 0;
    } },
    oxo:    { h: 11, rep: 16, f: (c, r) => {
      if (r === 0 || r === 10) return 1;
      const d = A(c - 4) + A(r - 5);
      if (c < 9) return (d === 3 || d === 4) ? 1 : d <= 1 ? 2 : 0;
      const ax = A(c - 12), ay = A(r - 5);
      if (ax === 0 && ay === 0) return 2;
      return (ax === ay && ax <= 4) ? 1 : 0;
    } },
    // The Selbu-style eight-point star: fat axis arms, four corner petals,
    // a ring of ground round the centre stitch.
    star:   { h: 15, rep: 16, f: (c, r) => {
      const a0 = A(c - 7), b0 = A(r - 7), a = Math.max(a0, b0), b = Math.min(a0, b0);
      if (a <= 1) return a + b === 0 ? 2 : 0;
      if (b <= 1) return (a <= 6 || (a === 7 && b === 0)) ? 1 : 0;
      if (b === 2) return 0;
      return (a <= 6 && a - b <= 2) ? 1 : 0;
    } },
    snow:   { h: 13, rep: 14, f: (c, r) => {
      const a = A(c - 7), b = A(r - 6);
      if (a === 0 && b === 0) return 2;
      if ((a === 0 && b <= 5) || (b === 0 && a <= 5)) return 1;
      if (a === b && a <= 4) return 1;
      if ((a === 1 && b === 4) || (b === 1 && a === 4)) return 1;
      if ((c === 0 || c === 13) && (r === 0 || r === 12)) return 2;
      return 0;
    } },
  };
  const SMALL_REST = ['lice', 'peerie', 'zig'];
  const MAIN_REST = ['border', 'tree', 'peerie', 'border'];
  const SMALL_BOLD = ['border', 'zig', 'peerie'];
  const MAIN_BOLD = ['star', 'oxo', 'snow'];

  // ---- Sprites ---------------------------------------------------------------

  // One knit stitch: two leaning plied legs forming a V over a dark backing.
  function makeStitch(col, sw, rh, pxs, rand) {
    const w = Math.ceil(sw * 1.5 * pxs), h = Math.ceil(rh * 2.1 * pxs);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.setTransform(pxs, 0, 0, pxs, w / 2, h / 2);
    // Backing: the shadowed yarn behind and between legs.
    g.fillStyle = rgba(mix(col, BLACK, 0.48), 1);
    g.beginPath();
    g.ellipse(0, -rh * 0.05, sw * 0.5, rh * 0.62, 0, 0, TAU);
    g.fill();
    const lite = mix(col, WHITE, 0.28), dark = mix(col, BLACK, 0.5);
    for (let s = -1; s <= 1; s += 2) {
      g.save();
      g.translate(s * sw * 0.215, -rh * 0.1);
      g.rotate(s * 0.52);
      const rx = sw * 0.26, ry = rh * 0.7;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, TAU);
      const gr = g.createRadialGradient(-rx * 0.35, -ry * 0.25, 0, 0, 0, ry * 1.02);
      gr.addColorStop(0, rgba(lite, 1));
      gr.addColorStop(0.5, rgba(col, 1));
      gr.addColorStop(1, rgba(dark, 1));
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      // Plies: the twist of the yarn, as diagonal grooves.
      g.strokeStyle = rgba(dark, 0.45);
      g.lineWidth = Math.max(0.35, sw * 0.03);
      for (let j = -5; j <= 5; j++) {
        const y = j * ry * 0.26 + (rand() - 0.5) * 0.6;
        g.beginPath();
        g.moveTo(-rx * 1.2, y - s * rx * 0.9);
        g.lineTo(rx * 1.2, y + s * rx * 0.9);
        g.stroke();
      }
      g.strokeStyle = rgba(lite, 0.35);
      g.lineWidth = Math.max(0.3, sw * 0.02);
      for (let j = -5; j <= 5; j++) {
        const y = j * ry * 0.26 + ry * 0.09;
        g.beginPath();
        g.moveTo(-rx * 1.2, y - s * rx * 0.9);
        g.lineTo(rx * 1.2, y + s * rx * 0.9);
        g.stroke();
      }
      // The top of each leg dives under the stitch above.
      const tg = g.createLinearGradient(0, -ry, 0, -ry * 0.25);
      tg.addColorStop(0, rgba(BLACK, 0.55));
      tg.addColorStop(1, rgba(BLACK, 0));
      g.fillStyle = tg;
      g.fillRect(-rx * 1.5, -ry * 1.1, rx * 3, ry);
      g.restore();
      g.restore();
    }
    // Fibre halo: a few stray hairs.
    g.strokeStyle = rgba(mix(col, WHITE, 0.4), 0.4);
    g.lineWidth = Math.max(0.25, sw * 0.018);
    for (let i = 0; i < 6; i++) {
      const x = (rand() - 0.5) * sw * 0.9, y = (rand() - 0.5) * rh * 1.1, a = rand() * TAU, l = sw * (0.1 + rand() * 0.15);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + 0.4, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return cv;
  }

  // A ball of yarn's wound surface (rotates) and its fixed sphere shading.
  function makeBall(col, R, pxs, rand) {
    const s = Math.ceil(R * 2 * pxs);
    const cv = document.createElement('canvas');
    cv.width = s; cv.height = s;
    const g = cv.getContext('2d');
    g.setTransform(pxs, 0, 0, pxs, s / 2, s / 2);
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    g.fillStyle = rgba(mix(col, BLACK, 0.35), 1);
    g.fillRect(-R, -R, R * 2, R * 2);
    for (let i = 0; i < 70; i++) {
      g.save();
      g.rotate(rand() * TAU);
      const t = rand();
      g.strokeStyle = rgba(t < 0.5 ? mix(col, WHITE, 0.2 * rand()) : mix(col, BLACK, 0.25 * rand()), 1);
      g.lineWidth = R * 0.07;
      g.beginPath();
      g.ellipse(0, (rand() - 0.5) * R * 0.6, R * (0.75 + rand() * 0.35), R * (0.12 + rand() * 0.55), 0, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(mix(col, BLACK, 0.55), 0.35);
      g.lineWidth = R * 0.012;
      g.stroke();
      g.restore();
    }
    return cv;
  }
  function makeShade(R, pxs) {
    const s = Math.ceil(R * 2 * pxs);
    const cv = document.createElement('canvas');
    cv.width = s; cv.height = s;
    const g = cv.getContext('2d');
    g.setTransform(pxs, 0, 0, pxs, s / 2, s / 2);
    const gr = g.createRadialGradient(-R * 0.35, -R * 0.4, 0, 0, 0, R);
    gr.addColorStop(0, 'rgba(255,248,235,0.30)');
    gr.addColorStop(0.35, 'rgba(255,248,235,0.0)');
    gr.addColorStop(0.72, 'rgba(20,10,5,0.12)');
    gr.addColorStop(1, 'rgba(20,10,5,0.6)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    return cv;
  }

  // Wooden tabletop: planks with grain, drawn once at half resolution.
  function makeTable(W, H, col, pxs) {
    const k = Math.max(0.5, pxs * 0.5);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    const rand = rng(77);
    g.fillStyle = rgba(col, 1);
    g.fillRect(0, 0, W, H);
    const plank = 130;
    for (let py = 0; py < H; py += plank) {
      const tone = (rand() - 0.5) * 0.12;
      g.fillStyle = rgba(tone > 0 ? WHITE : BLACK, Math.abs(tone));
      g.fillRect(0, py, W, plank);
      for (let i = 0; i < 26; i++) {
        const y0 = py + rand() * plank, amp = 2 + rand() * 6, f = 0.004 + rand() * 0.01, ph = rand() * TAU;
        g.strokeStyle = rgba(rand() < 0.75 ? BLACK : WHITE, 0.04 + rand() * 0.08);
        g.lineWidth = 0.6 + rand() * 2.2;
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 12) {
          const y = y0 + amp * Math.sin(x * f + ph) + 1.5 * Math.sin(x * f * 3.7 + ph * 2);
          if (x === -10) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(20,10,4,0.35)';
      g.fillRect(0, py - 1, W, 2);
    }
    return cv;
  }

  VIZ.register({
    id: 'knit',
    name: 'Knit',
    order: 409,

    params: [
      { key: 'palette', label: 'Yarn', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'tempo', label: 'Knitting speed', type: 'range', min: 0.25, max: 3, default: 1, step: 0.01 },
      { key: 'gauge', label: 'Stitch size', type: 'range', min: 0.6, max: 2.2, default: 1, step: 0.01 },
      { key: 'patterns', label: 'Patterns', type: 'select', options: ['Follow the drop', 'Quiet peerie bands', 'Big stars always'], default: 0 },
      { key: 'light', label: 'Window light', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'ripple', label: 'Fabric ripple', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Knit',
      technique: 'Canvas 2D: pre-shaded stitch sprites stamped into per-row offscreen strips as they are knitted, strips blitted with a travelling ripple, procedural Fair Isle band charts with row-by-row colour shading, wound-yarn ball sprites that roll, a window-shadow layer drawn at 64 px and upscaled for soft edges, onset detection against slow baselines',
      brief: 'A Fair Isle panel being knitted on a wooden table in daylight, seen from above. The working point shuttles back and forth along the live row on a pair of birch needles, each finished row pushes the fabric up the screen, and the pattern works through Fair Isle bands: lice, peerie diamonds, zigzags and fir trees in two colours on oatmeal in quiet passages, and dark-ground yoke bands of eight-point stars, OXO and snowflakes in four or five shades when the drop hits. Strands run from the balls of yarn on the table to the needle; the shadow of a window drifts across everything. Music: the bass sets the knitting speed, so it sets the travel; each kick knits the current stitch in an accent yarn, which pops up off the fabric with a real shadow while the needle tips jab and a puff of fibres flies; a clap makes the ball now in use hop and hands the next row a new colour (and asks for a new motif); hats fleck the next stitches with tweed neps and glint the needle tips. The drop brings every ball of yarn rolling onto the table, the sun out from behind the clouds, a faster shuttle, a bigger ripple and a bold dark-ground band; the breakdown slows to a crawl under an overcast sky. Every stitch stays, so the panel is a record of the set: calm stretches knit as quiet bands, drops as big coloured stars, and the kicks are the scatter of bright stitches through it.',
      lineage: [
        'Brief 09 (batch 04): live knitting, stitch shapes with fibre and shading, three or four yarns in Fair Isle motifs, fabric scrolling up as rows are knitted; kick knits an accent stitch at the needle, snare introduces a motif, bass sets the speed, drop switches to a bolder pattern. Batch 04 asked for no rainbow and no glow: this is matte daylight, limited yarn palettes and real shadows.',
        'Approach: Canvas 2D. Stitches are pre-shaded sprites (two leaning plied legs over a dark backing, three heathered variants per yarn) stamped into one offscreen strip per row as they are knitted, so a frame is ~40 strip blits whatever the detail. Rows sit (knitted/cols - k) rows above the needle, so the scroll is continuous and exactly as fast as the knitting. Flat knitting (the shuttle reverses each row) rather than in the round, so the needle and strands never jump across the frame.',
        'v1: worked first time as knitting, but at 5-31 stitches a second only two or three rows were knitted in 24 s, needles and strands were hairlines, and my first eight-point star chart (triangles between axis and diagonal gaps) read as confetti. v2: stitches 18 -> 22 units, rate 8-58 stitches/s, thicker needles, a new star chart (fat axis arms, four corner petals, ringed centre) checked as ASCII before rendering.',
        'v3: the drop band was colour-shaded row by row on oatmeal and read as noise, so big bands now go dark-ground with light motifs, the ground fixed for the band and claps shifting the motif shades, like a yoke. The panel is pre-knitted with an earlier drop\'s yoke band at the top so the intro is not bare.',
        'v4: the balls re-spaced themselves whenever one arrived (the build\'s snare roll made the whole table slide), so each ball now has a fixed place. The drop only began a bold band once the quiet one finished, which could be the whole drop; a quiet band is now cut at the next row when the drop arrives (bold bands always finish, so stars are never halved). Kick pop enlarged (1.9x, 0.55 s) and nine fibres instead of seven.',
        'Jolt (640x360, seed 1): calm, kickArea 0.125, ratio 1.11; build kick 0.063. The heat map puts the kick at the needle (the popped stitch) and the clap on the hopping ball; the rest of the area is the continuous scroll and ripple, which is why the ratio sits near 1.',
        '1280x720 check: the second strand vanished in yoke bands, because it followed the pattern yarn only and the yoke\'s edge rows are knitted in the ground-ball colour; strands now follow the row\'s actual ground and pattern yarns. 96 s run: the panel keeps moving through snowflake, OXO and star bands in changing grounds; after the first drop the long yoke bands outlast the quiet passages, so quiet bands are rarer than the music would suggest.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.key = '';
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
    },

    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kick = false, snare = false, hat = false;
      // Kick: band 0 leading band 1, so the bass line's own notes don't count.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kick = kRaw; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.7, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snare = sRaw; }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hat = hRaw; }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      // The bass line lives in band 1 (and some of 2); the pad also reaches
      // band 2, so it counts for less, or the breakdown would knit fastest.
      e.bass = ease(e.bass, clamp01((s[1] + 0.3 * s[2]) / 110), 2.2, dt);
      return { kick, snare, hat };
    },

    // ---- Fabric state ----------------------------------------------------------

    build(W, H, pxs, params, palIdx) {
      const P = PALETTES[palIdx];
      this.pal = {
        table: hex(P.table), needle: hex(P.needle),
        grounds: P.grounds.map(hex), fores: P.fores.map(hex), acc: P.acc.map(hex), bold: P.bold,
      };
      const pal = this.pal;
      this.W = W; this.H = H; this.pxs = pxs;
      const gauge = params.gauge;
      this.margin = Math.round(Math.max(18, W * 0.035));
      this.fabW = W - this.margin * 2;
      this.cols = Math.max(8, Math.round(this.fabW / (22 * gauge)));
      this.sw = this.fabW / this.cols;
      this.rh = this.sw * 0.78;
      this.needleY = H * 0.8;

      // Colour table: every yarn gets an index; stitch sprites per index.
      this.colours = [].concat(pal.grounds, pal.fores, pal.acc);
      const rand = rng(11);
      this.sprites = this.colours.map((c) => [0, 1, 2].map((v) =>
        makeStitch(mix(c, v === 1 ? WHITE : BLACK, v === 0 ? 0 : 0.06), this.sw, this.rh, pxs, rand)));
      this.accentIdx = [this.colours.length - 2, this.colours.length - 1];
      this.darkIdx = this.colours.map((c) => luma(c) < 0.45);

      // Balls: the ground yarn and each pattern yarn.
      this.R = 40;
      const rb = rng(5);
      this.balls = [];
      const ballCols = [0, 3, 4, 5, 6, 7];   // grounds[0], fores[0..4]
      for (let i = 0; i < ballCols.length; i++) {
        const ci = ballCols[i];
        this.balls.push({ ci, spr: makeBall(this.colours[ci], this.R, pxs, rb), x: 0, tx: 0, rot: rb() * TAU,
          hop: 0, present: i < 3 ? 1 : 0, want: i < 3 ? 1 : 0, home: 0 });
      }
      this.shade = makeShade(this.R, pxs);
      this.table = makeTable(W, H, pal.table, pxs);
      this.light = document.createElement('canvas');
      this.light.width = 64; this.light.height = Math.max(8, Math.round(64 * H / W));

      // Knitting state.
      this.rows = new Map();       // k -> { cv, g, st: [] }
      this.pool = [];
      this.fi = 0;                 // pattern-colour rotation, advanced by claps
      this.band = null; this.bandRow = 0; this.slot = 0; this.bandBold = false;
      this.queueNew = false;
      this.rowInfo = new Map();    // k -> { motif, r, ground, fore, fore2, off }
      this.fleck = 0;
      this.pop = null;
      this.fibres = [];
      this.glint = 0; this.jab = 0; this.tug = 0;
      this.xwS = null; this.yNs = null;
      this.lastBall = [0, 1];
      this.hopBall = -1;

      // Pre-knit enough rows to fill the screen, sprinkled with old accents.
      const pre = Math.ceil(this.needleY / this.rh) + 3;
      this.N = 0;
      this.kDone = -1;
      const pr = rng(3);
      // The top of the panel is an earlier drop's big yoke band.
      for (let n = 0; n < pre * this.cols; n++) {
        this.preBold = n < pre * this.cols * 0.4;
        this.knitStitch(n, pr() < 0.004, pr() < 0.008, params);
      }
      this.preBold = undefined;
      this.N = pre * this.cols;
    },

    stripFor(k) {
      let row = this.rows.get(k);
      if (row) return row;
      const pxs = this.pxs;
      const w = Math.ceil((this.fabW + this.sw * 2) * pxs), h = Math.ceil(this.rh * 2.3 * pxs);
      let cv = this.pool.pop();
      if (!cv || cv.width !== w || cv.height !== h) {
        cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
      }
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      g.setTransform(pxs, 0, 0, pxs, 0, 0);
      row = { cv, g, st: new Array(this.cols) };
      this.rows.set(k, row);
      return row;
    },

    wantBold(params) {
      const mode = Math.round(params.patterns);
      return mode === 2 ? true : mode === 1 ? false : this.preBold !== undefined ? this.preBold : this.env.drop > 0.3;
    },

    nextBand(params) {
      const bold = this.wantBold(params);
      if (bold !== this.bandBold) { this.slot = bold ? 1 : 3; this.bandBold = bold; }
      const tpl = bold ? ['seed', 'MAIN', 'seed', 'plain', 'SMALL', 'plain'] : ['plain', 'SMALL', 'plain', 'seed', 'MAIN', 'seed', 'plain'];
      let kind = tpl[this.slot % tpl.length];
      if (this.queueNew && (kind === 'plain' || kind === 'seed')) {
        // A clap asked for a new motif: skip the filler and go to the next main band.
        const iMain = tpl.indexOf('MAIN', 0);
        this.slot = iMain; kind = 'MAIN';
      }
      this.slot++;
      const pick = (arr) => {
        let m;
        do { m = arr[(this.pickN = ((this.pickN || 0) * 7 + 3) % 101) % arr.length]; } while (m === this.lastMotif && arr.length > 1);
        return m;
      };
      let motif = kind;
      if (kind === 'MAIN') { motif = pick(bold ? MAIN_BOLD : MAIN_REST); this.queueNew = false; }
      else if (kind === 'SMALL') motif = pick(bold ? SMALL_BOLD : SMALL_REST);
      if (kind === 'MAIN' || kind === 'SMALL') this.lastMotif = motif;
      this.band = { motif, h: MOTIFS[motif].h, bold };
      this.bandRow = 0;
    },

    rowSetup(k, params) {
      // The drop cuts a quiet band short at the next row so the bold pattern
      // starts at once; a big band is always finished, never cut in half.
      if (!this.band || this.bandRow >= this.band.h || (!this.band.bold && this.wantBold(params))) this.nextBand(params);
      const b = this.band, m = MOTIFS[b.motif], r = this.bandRow++;
      const h = b.h, t = h > 1 ? A(r - (h - 1) / 2) / ((h - 1) / 2) : 1;
      const fi = this.fi;
      let ground, fore, fore2;
      if (b.bold) {
        // Big bands go dark-ground with light motifs, the way a Fair Isle yoke
        // does: the ground is fixed for the band, claps shift the motif shades.
        const B = this.pal.bold;
        if (b.gi === undefined) { this.boldN = this.boldN || 0; b.gi = B.g[this.boldN++ % B.g.length]; }
        const rot = (arr, skip) => { for (let j = 0; j < arr.length; j++) { const v = arr[(fi + j) % arr.length]; if (skip.indexOf(v) < 0) return v; } return arr[0]; };
        const mid = rot(B.mids, [b.gi]);
        if (b.motif === 'plain' || b.motif === 'seed') { ground = 0; fore = b.gi; fore2 = b.gi; }
        else {
          ground = b.gi;
          fore = t > 0.5 ? B.edge : mid;
          fore2 = rot(B.dots, [b.gi, fore]);
        }
      } else {
        ground = 0;
        fore = 3 + (fi % 2);
        fore2 = 6;
      }
      const off = Math.floor((this.cols % m.rep) / 2);
      const info = { motif: b.motif, r, ground, fore, fore2, off };
      this.rowInfo.set(k, info);
      return info;
    },

    // Knit stitch n into its row strip. accent: knit it in the accent yarn.
    knitStitch(n, accent, fleck, params) {
      const cols = this.cols, k = Math.floor(n / cols), i = n - k * cols;
      const c = (k & 1) === 0 ? i : cols - 1 - i;
      let info = this.rowInfo.get(k);
      if (!info) info = this.rowSetup(k, params);
      const m = MOTIFS[info.motif];
      const role = m.f((((c - info.off) % m.rep) + m.rep) % m.rep, info.r);
      let ci = role === 0 ? info.ground : role === 1 ? info.fore : info.fore2;
      const row = this.stripFor(k);
      const seed = (n * 2654435761) >>> 0;
      const st = { ci, base: ci, v: seed % 3, dx: ((seed >>> 3) % 100) / 100 - 0.5, dy: ((seed >>> 10) % 100) / 100 - 0.5,
        rot: (((seed >>> 17) % 100) / 100 - 0.5) * 0.08, fleck: fleck ? 1 + ((seed >>> 5) % 3) : 0 };
      row.st[c] = st;
      if (accent) st.ci = this.accentIdx[this.darkIdx[ci] ? 1 : 0];
      this.stamp(row, c, st);
      return { k, c, st, row };
    },

    stamp(row, c, st) {
      const g = row.g, sw = this.sw, rh = this.rh;
      const x = sw + (c + 0.5) * sw + st.dx * sw * 0.06, y = rh * 1.25 + st.dy * rh * 0.06;
      g.save();
      g.translate(x, y);
      g.rotate(st.rot);
      g.drawImage(this.sprites[st.ci][st.v], -sw * 0.75, -rh * 1.05, sw * 1.5, rh * 2.1);
      if (st.fleck) {
        // Tweed neps: flecks of a contrasting yarn caught in the ply.
        const fc = this.colours[this.darkIdx[st.ci] ? 0 : 3 + ((st.fleck + 2) % 5)];
        g.fillStyle = rgba(this.darkIdx[st.ci] ? mix(fc, WHITE, 0.2) : this.colours[this.accentIdx[0]], 0.9);
        for (let j = 0; j < st.fleck; j++) {
          const a = (st.dx + j * 2.1) * 3.1;
          g.beginPath();
          g.ellipse(Math.cos(a) * sw * 0.22, Math.sin(a) * rh * 0.3, sw * 0.07, sw * 0.045, a, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    },

    // ---- Frame -------------------------------------------------------------------

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      this.T += dt;
      const T = this.T;
      const push = params.push;
      const palIdx = Math.max(0, Math.min(PALETTES.length - 1, Math.round(params.palette)));
      const pxs = (p.width * p.pixelDensity()) / W;
      const key = [W.toFixed(1), H.toFixed(1), pxs.toFixed(3), palIdx, params.gauge.toFixed(2)].join('|');
      if (key !== this.key) { this.key = key; this.build(W, H, pxs, params, palIdx); }

      const ev = this.listen(signals, dt);
      const e = this.env;
      const cols = this.cols, sw = this.sw, rh = this.rh, x0 = this.margin;

      // Knitting speed: the bass sets it, the drop adds a little more.
      const rate = params.tempo * (8 + 40 * e.bass + 10 * e.drop);
      const N0 = Math.floor(this.N);
      this.N += rate * dt;
      if (ev.hat) { this.fleck = Math.min(3, this.fleck + 1.2 * push * (0.4 + ev.hat)); this.glint = 1; }
      if (ev.snare && push > 0) this.onSnare(ev.snare, params);
      let last = null;
      for (let n = N0; n < Math.floor(this.N); n++) {
        const fl = this.fleck > 0.5 && ((n * 7919) % 5) < 3;
        last = this.knitStitch(n, false, fl, params);
        this.fleck = Math.max(0, this.fleck - 0.35);
        if (fl) this.fleck = Math.max(0, this.fleck - 0.3);
      }
      if (last) this.lastStitch = last;
      if (ev.kick && push > 0) this.onKick(ev.kick, push);

      const Nf = this.N / cols;
      const kA = Math.floor(Nf), frac = Nf - kA;
      // Row k's cell centres sit (Nf - k) rows above the needle.
      const rowY = (k) => this.needleY - (Nf - k) * rh;
      const amp = params.ripple * (0.6 + 2.6 * e.bass + 1.4 * e.drop);
      this.amp = this.amp === undefined ? amp : ease(this.amp, amp, 1.5, dt);
      const sway = (k) => this.amp * Math.sin(k * 0.42 - T * 1.3) + this.amp * 0.4 * Math.sin(k * 0.13 + T * 0.5);

      // Retire rows that have left the top.
      const kTop = Math.floor(Nf - this.needleY / rh) - 3;
      for (const k of this.rows.keys()) {
        if (k < kTop) { this.pool.push(this.rows.get(k).cv); this.rows.delete(k); this.rowInfo.delete(k); }
      }

      p.colorMode(p.RGB, 255);
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.imageSmoothingEnabled = true;

      // 1. Table.
      g.drawImage(this.table, 0, 0, W, H);

      // 2. The panel's shadow on the table.
      const yBottom = rowY(kA) + rh * 0.55;
      g.fillStyle = 'rgba(30,16,6,0.16)';
      g.fillRect(x0 + 3, -10, this.fabW + 6, rowY(kA - 1) + rh * 0.55 + 18);
      g.fillStyle = 'rgba(30,16,6,0.14)';
      g.fillRect(x0 + 6, -10, this.fabW + 2, rowY(kA - 1) + rh * 0.55 + 12);

      // 3. Fabric rows, newest first so older rows' V points lap over them.
      for (let k = kA; k >= kTop; k--) {
        const row = this.rows.get(k);
        if (!row) continue;
        const y = rowY(k);
        if (y < -rh * 2) break;
        g.drawImage(row.cv, x0 - sw + sway(k), y - rh * 1.25, (this.fabW + sw * 2), rh * 2.3);
      }

      // 4. Drape: soft folds across the fabric, and the row-wise ripple's shading.
      this.drawDrape(g, W, rowY(kA - 1) + rh * 0.5, T, e, params);

      // Working point.
      const dir = (kA & 1) === 0 ? 1 : -1;
      const iF = (Nf - kA) * cols;
      const xw = x0 + sway(kA) + (dir > 0 ? iF : cols - iF) * sw;
      const yN = rowY(kA) + rh * 0.55;
      this.xwS = xw; this.yNs = this.yNs === null ? yN : ease(this.yNs, yN, 14, dt);

      // 5. The kick's stitch pops out of the fabric.
      this.drawPop(g, dt, rowY, sway);

      // 6. Balls, strands, needles.
      this.drawBalls(g, W, H, dt, rate, e, params);
      this.drawStrands(g, xw, this.yNs, dir, T);
      this.drawNeedles(g, W, xw, this.yNs, dir, dt);
      this.drawFibres(g, dt);

      // 7. Window light.
      this.drawLight(g, W, H, T, e, params);
      g.restore();
    },

    onKick(amt, push) {
      const L = this.lastStitch;
      if (!L) return;
      const st = L.st;
      st.ci = this.accentIdx[this.darkIdx[st.base] ? 1 : 0];
      this.stamp(L.row, L.c, st);
      this.pop = { k: L.k, c: L.c, st, t: 0, amt: Math.min(1.5, (0.6 + 0.6 * amt) * push) };
      this.jab = Math.min(1.5, push);
      this.tug = 1;
      const cx = this.margin + (L.c + 0.5) * this.sw;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * (0.1 + 0.8 * ((i + 0.5) / 9)) + Math.sin(i * 12.9 + L.k) * 0.2;
        const v = (55 + 45 * ((i * 37) % 9) / 9) * push;
        this.fibres.push({ k: L.k, cx, x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, ci: st.ci, rot: a });
      }
    },

    onSnare(amt, params) {
      this.fi = (this.fi + 1) % 5;
      this.queueNew = true;
      // The ball of the colour now in play hops.
      const ci = 3 + (this.fi % 5);
      const b = this.balls.find((x) => x.ci === ci) || this.balls[1];
      b.want = 1;
      b.hop = Math.min(1.4, (0.7 + 0.5 * amt) * params.push);
      this.hopBall = this.balls.indexOf(b);
    },

    drawDrape(g, W, yB, T, e, params) {
      const x0 = this.margin, fw = this.fabW;
      const gr = g.createLinearGradient(x0, 0, x0 + fw, 0);
      const s = params.ripple * (0.08 + 0.05 * e.bass);
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const v = Math.sin(u * 7.1 + T * 0.13) * 0.6 + Math.sin(u * 13.3 - T * 0.21 + 1.3) * 0.4;
        gr.addColorStop(u, v < 0 ? rgba([40, 22, 10], -v * s * 1.6) : rgba([255, 246, 228], v * s));
      }
      g.fillStyle = gr;
      g.fillRect(x0 - this.sw, 0, fw + this.sw * 2, yB);
    },

    drawPop(g, dt, rowY, sway) {
      const P = this.pop;
      if (!P) return;
      P.t += dt;
      const u = P.t / 0.55;
      if (u >= 1) { this.pop = null; return; }
      const sw = this.sw, rh = this.rh;
      const x = this.margin + sway(P.k) + (P.c + 0.5) * sw, y = rowY(P.k);
      const k = (1 - u) * (1 - u) * P.amt;
      const sc = 1 + 1.9 * k;
      g.save();
      g.translate(x, y - rh * 0.3 * k);
      g.scale(sc, sc);
      // A real shadow under the lifted stitch.
      g.fillStyle = rgba(BLACK, 0.35 * Math.min(1, k * 1.5));
      g.beginPath();
      g.ellipse(sw * 0.12 * k * 3, rh * 0.25 * k * 3, sw * 0.5, rh * 0.62, 0, 0, TAU);
      g.fill();
      g.drawImage(this.sprites[P.st.ci][1], -sw * 0.75, -rh * 1.05, sw * 1.5, rh * 2.1);
      g.restore();
    },

    drawBalls(g, W, H, dt, rate, e, params) {
      const R = this.R, balls = this.balls;
      const drop = Math.round(params.patterns) === 2 ? 1 : Math.round(params.patterns) === 1 ? 0 : e.drop;
      // In the drop every yarn comes out onto the table.
      // Each ball has its own place on the table, so one arriving never
      // shuffles the others; absent balls wait just off the nearer edge.
      const nWant = 3 + Math.round(3 * clamp01((drop - 0.25) / 0.5));
      const span = W - R * 2.4;
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        b.want = i < nWant || (i === this.hopBall && this.since.snare < 1.5) ? 1 : 0;
        const home = R * 1.2 + span * (i / (balls.length - 1));
        b.tx = b.want ? home : (home < W / 2 ? -R * 2.5 : W + R * 2.5);
        const nx = b.x === 0 && !b.init ? (b.init = true, b.want ? b.tx : b.tx) : ease(b.x, b.tx, 2.2, dt);
        b.rot += (nx - b.x) / R;
        b.x = nx;
        b.hop = Math.max(0, b.hop - dt * 3.2);
      }
      // Yarn in use unwinds.
      const inUse = this.inUse || [0, 1];
      for (const bi of inUse) if (balls[bi]) balls[bi].rot += rate * dt * 0.015;

      const yb = H - R * 0.55;
      for (const b of balls) {
        if (b.x < -R * 2 || b.x > W + R * 2) continue;
        const hp = b.hop > 0 ? Math.sin(Math.PI * (1 - b.hop / 1.4) ) : 0;
        const lift = b.hop > 0 ? Math.sin(Math.PI * clamp01(1 - b.hop / 1.4)) * 26 * Math.min(1, b.hop + 0.3) : 0;
        const sh = 1 + lift / 40;
        const sgr = g.createRadialGradient(b.x + 8 + lift * 0.3, yb + 10 + lift * 0.4, 0, b.x + 8 + lift * 0.3, yb + 10 + lift * 0.4, R * 1.15 * sh);
        sgr.addColorStop(0, 'rgba(25,12,4,' + (0.45 / sh).toFixed(3) + ')');
        sgr.addColorStop(0.7, 'rgba(25,12,4,' + (0.22 / sh).toFixed(3) + ')');
        sgr.addColorStop(1, 'rgba(25,12,4,0)');
        g.fillStyle = sgr;
        g.beginPath(); g.arc(b.x + 8 + lift * 0.3, yb + 10 + lift * 0.4, R * 1.15 * sh, 0, TAU); g.fill();
        const s = 1 + lift / 160;
        g.save();
        g.translate(b.x, yb - lift);
        g.scale(s, s);
        g.save();
        g.rotate(b.rot);
        g.drawImage(b.spr, -R, -R, R * 2, R * 2);
        g.restore();
        g.drawImage(this.shade, -R, -R, R * 2, R * 2);
        g.restore();
        b.cy = yb - lift;
        void hp;
      }
    },

    drawStrands(g, xw, yN, dir, T) {
      const info = this.rowInfo.get(Math.floor(this.N / this.cols)) || { ground: 0, fore: 3 };
      const R = this.R;
      const find = (ci) => {
        let bi = this.balls.findIndex((b) => b.ci === ci && b.want);
        if (bi < 0) bi = this.balls.findIndex((b) => b.want && b.ci === (ci < 3 ? 0 : b.ci));
        return bi < 0 ? 0 : bi;
      };
      // The two yarns this row is stranded in: its ground and its pattern.
      const gb = find(info.ground < 3 ? 0 : info.ground);
      let fb = find(info.fore < 3 ? 0 : info.fore);
      if (fb === gb) fb = find(info.fore2 < 3 ? 0 : info.fore2);
      this.inUse = [gb, fb];
      this.tug = Math.max(0, this.tug - 0.05);
      const strands = [[gb, 0], [fb, 1]];
      for (const [bi, idx] of strands) {
        const b = this.balls[bi];
        if (!b || b.cy === undefined) continue;
        const col = this.colours[b.ci];
        const ex = xw - dir * (idx ? 3 : -3), ey = yN + 2;
        const sx = b.x + (idx ? 6 : -6), sy = b.cy - R * 0.55;
        const sag = (1 - this.tug) * 22 + 6;
        const cx = (sx + ex) / 2 + Math.sin(T * 0.9 + idx * 2) * 14, cy = Math.max(sy, ey) + sag;
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(25,12,4,0.22)';
        g.lineWidth = 4.4;
        g.beginPath(); g.moveTo(sx + 3, sy + 5); g.quadraticCurveTo(cx + 3, cy + 5, ex + 3, ey + 5); g.stroke();
        g.strokeStyle = rgba(mix(col, BLACK, 0.45), 1);
        g.lineWidth = 4.2;
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
        g.strokeStyle = rgba(col, 1);
        g.lineWidth = 2.9;
        g.stroke();
      }
    },

    drawNeedles(g, W, xw, yN, dir, dt) {
      const pal = this.pal;
      this.jab = Math.max(0, this.jab - dt / 0.2);
      this.glint = Math.max(0, this.glint - dt / 0.12);
      const jab = this.jab * this.jab;
      // Two needles crossing at the working point: the one taking new
      // stitches comes from the finished side.
      const needles = [
        { from: [xw - dir * (W * 0.9), yN + 7], tip: [xw + dir * (18 + 12 * jab), yN - 3 - 4 * jab] },
        { from: [xw + dir * (W * 0.9), yN + 9], tip: [xw - dir * 16, yN + 1] },
      ];
      const body = pal.needle, dk = mix(body, BLACK, 0.45), lt = mix(body, WHITE, 0.45);
      for (const pass of [0, 1]) {
        for (const nd of needles) {
          const [ax, ay] = nd.from, [bx, by] = nd.tip;
          const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
          const nx = -uy, ny = ux, r = 6.2;
          const cx = bx - ux * 22, cy = by - uy * 22;
          const path = new Path2D();
          path.moveTo(ax + nx * r, ay + ny * r);
          path.lineTo(cx + nx * r, cy + ny * r);
          path.quadraticCurveTo(bx - ux * 6 + nx * r * 0.5, by - uy * 6 + ny * r * 0.5, bx, by);
          path.quadraticCurveTo(bx - ux * 6 - nx * r * 0.5, by - uy * 6 - ny * r * 0.5, cx - nx * r, cy - ny * r);
          path.lineTo(ax - nx * r, ay - ny * r);
          path.closePath();
          if (pass === 0) {
            g.save();
            g.translate(4, 6);
            g.fillStyle = 'rgba(25,12,4,0.28)';
            g.fill(path);
            g.restore();
          } else {
            const gr = g.createLinearGradient(cx + nx * r, cy + ny * r, cx - nx * r, cy - ny * r);
            gr.addColorStop(0, rgba(dk, 1));
            gr.addColorStop(0.55, rgba(body, 1));
            gr.addColorStop(0.8, rgba(lt, 1));
            gr.addColorStop(1, rgba(dk, 1));
            g.fillStyle = gr;
            g.fill(path);
            if (this.glint > 0) {
              g.fillStyle = rgba(WHITE, 0.85 * this.glint);
              g.beginPath();
              g.ellipse(bx - ux * 9 - nx * 1.4, by - uy * 9 - ny * 1.4, 4.5, 1.2, Math.atan2(uy, ux), 0, TAU);
              g.fill();
            }
          }
        }
      }
    },

    drawFibres(g, dt) {
      if (!this.fibres.length) return;
      const keep = [];
      g.lineCap = 'round';
      for (const f of this.fibres) {
        f.t += dt;
        if (f.t > 0.6) continue;
        f.x += f.vx * dt; f.y += f.vy * dt;
        f.vx *= Math.exp(-dt * 4); f.vy *= Math.exp(-dt * 4);
        f.rot += dt * 3;
        const a = 1 - f.t / 0.6;
        const bx = this.xwS !== null ? f.cx : 0;
        const by = this.yNs - this.rh * 0.55;
        const x = bx + f.x, y = by + f.y;
        g.strokeStyle = rgba(this.colours[f.ci], a);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(x - Math.cos(f.rot) * 4, y - Math.sin(f.rot) * 4);
        g.quadraticCurveTo(x + 1, y - 1.5, x + Math.cos(f.rot) * 4, y + Math.sin(f.rot) * 4);
        g.stroke();
        keep.push(f);
      }
      this.fibres = keep;
    },

    drawLight(g, W, H, T, e, params) {
      const lc = this.light, lg = lc.getContext('2d');
      const lw = lc.width, lh = lc.height, k = lw / W;
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.globalCompositeOperation = 'source-over';
      lg.fillStyle = 'rgb(38,22,10)';
      lg.fillRect(0, 0, lw, lh);
      lg.globalCompositeOperation = 'destination-out';
      lg.setTransform(k, 0, 0, k, 0, 0);
      // A window of 2 x 3 panes, skewed by the low sun, drifting slowly.
      const pw = H * 0.34, ph = H * 0.4, gap = H * 0.035, skew = 0.45;
      const ox = ((T * 6 + 900) % (W + 900)) - 850, oy = -H * 0.12 + Math.sin(T * 0.05) * 20;
      lg.fillStyle = '#000';
      for (let cx = 0; cx < 2; cx++) {
        for (let cy = 0; cy < 3; cy++) {
          const x = ox + cx * (pw + gap) + cy * (ph + gap) * skew, y = oy + cy * (ph + gap);
          lg.beginPath();
          lg.moveTo(x, y); lg.lineTo(x + pw, y);
          lg.lineTo(x + pw + ph * skew, y + ph); lg.lineTo(x + ph * skew, y + ph);
          lg.closePath(); lg.fill();
        }
      }
      lg.globalCompositeOperation = 'source-over';
      const a = params.light * (0.1 + 0.28 * clamp01(e.drop));
      if (a > 0.002) {
        g.globalAlpha = clamp01(a);
        g.drawImage(lc, 0, 0, W, H);
        g.globalAlpha = 1;
      }
    },
  });
})();
