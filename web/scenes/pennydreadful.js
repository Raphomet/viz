// Penny Dreadful: a Victorian serial cover, one penny, printed on cheap stock.
// A masthead of mixed wood type (a Tuscan, a fat face, a slab, a condensed
// grotesque, all on one line as the jobbing printers set them), a price and a
// number, two narrow columns of the week's instalment, and in the middle a
// big white-line woodcut of a moonlit street: an engraved sky whose cut lines
// thicken towards the moon and the horizon, cut-out rooftops, a gas lamp, and a
// phantom fiddler playing while couples waltz past on their slides. The
// illustration moves like a toy theatre: every flat is a separate card sliding
// on its own groove at its own speed (the moving panorama), and the actors are
// pushed on from the wings, bobbing and flipping like card on a tin slide.
//
// Music, each in its own place:
//   kick   the fiddler's bow changes direction (one stroke per beat), the
//          dancers hop on their slides, and one letter of the subtitle jumps,
//          marching along the line one letter per beat
//   snare  a shutter bangs open: one window lights up with a dancer inside
//   bass   the moon swells and the sky's cut lines thicken around it; the
//          phantom's cloak billows; the panorama slides faster
//   hats   stars twinkle; in the build and drop, notes spill from the fiddle
//   drop   hand colouring: a stencilled red and yellow wash over the print
//          (a blood-red horizon, the cloak's lining, the moon, the windows),
//          the title word goes red, a "double number" slip is pasted across the
//          corner, more couples and a flight of bats; the subtitle re-sets
//          itself letter by letter at each change of section. The breakdown
//          drains the red, lets fog roll across the street and thins the dance.
// Plain Canvas 2D. Whites are the paper showing through; colour is laid on
// with multiply so the black key plate stays black, slightly off register.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOutBack = (u) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const posmod = (a, m) => ((a % m) + m) % m;

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

  // Stocks. The cheap serials were printed on whatever was cheapest: grey-cream
  // newsprint, or coloured wrapper paper. Ink is a warm black, never pure.
  const STOCKS = [
    { name: 'Newsprint', paper: '#E6DAC0', edge: '#C9B48A', ink: '#1A1511' },
    { name: 'Canary', paper: '#EBCF6E', edge: '#C79E3C', ink: '#1C1510' },
    { name: 'Rose', paper: '#E7B7A6', edge: '#BD8069', ink: '#1C1212' },
  ];
  const RED = [196, 38, 30];
  const YEL = [236, 186, 58];

  const SERIF = '"Libre Baskerville", "Baskerville", Georgia, serif';
  const ITAL = '"Playfair Display", "Didot", Georgia, serif';
  const FACES = {
    tuscan: '"Rye", "Rockwell", serif',
    fat: '"Abril Fatface", "Bodoni 72", Georgia, serif',
    slab: '"Alfa Slab One", "Rockwell", serif',
    cond: '"Anton", "Impact", sans-serif',
    bebas: '"Bebas Neue", "Impact", sans-serif',
  };

  const SUBTITLES = [
    'A ROMANCE OF MUSIC AND MIDNIGHT',
    'OR, THE BELL THAT TOLLED THIRTEEN',
    'OR, THE DANCE THAT NEVER ENDS!',
    'OR, THE LAST WALTZ BEFORE DAWN',
  ];

  // Each drop is the next number of the serial, with a new second title.
  const DROP_SUBS = [
    'OR, THE DANCE THAT NEVER ENDS!',
    'OR, THE BALL AT THE BOTTOM OF THE STAIRS!',
    'OR, WALTZING WITH THE MOON!',
    'OR, THE FIDDLE AND THE FLAME!',
  ];

  const COL_LEFT = 'The last stroke of twelve had scarcely died upon the frosty air of Lantern Row when a strain of music rose from the empty street below, so thin and sweet and wicked that every sleeper in every garret sat bolt upright in bed. It was a fiddle; and yet no fiddle made by mortal hands was ever tuned so high. Old Mrs. Grimsby, who kept the chandler\'s shop, went to her window with a candle and beheld a figure in a long black cloak standing beneath the lamp, his bow flying, his face as white as the moon above him. And the street was full of dancers! Couples she had never seen before went whirling over the cobbles, round and round, in silks and tail-coats, their feet never touching the stones, and not one of them made the smallest sound. "Heaven preserve us," cried she, "it is the Phantom Fiddler, and he has come for the Midsummer Ball!" But the music would not let her be. Her foot began to tap; her shoulders swayed; and before she knew it her candle was guttering on the sill and she was halfway down the stair.';
  const COL_RIGHT = 'Now it is well known in that quarter that whosoever dances to the Phantom\'s tune must dance until the tune is done, and that the tune is never done until the sun is up. Young Tom Hollis, the lamplighter, saw it all from the churchyard wall, and he has sworn upon his mother\'s Bible that the gas-lamps themselves leaned over to listen, and the moon came down a full yard nearer to the chimney-pots than ever it had come before. Faster went the bow, and faster went the feet; the windows flew open one by one, and in each there stood a sleeper in a nightcap, dancing. What befell the lamplighter, and how the Fiddler was at last outplayed by a blind girl with a penny whistle, the reader shall learn in our next.';

  // ---------------------------------------------------------------------------

  VIZ.register({
    id: 'pennydreadful',
    name: 'Penny Dreadful',
    order: 509,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'scroll', label: 'Panorama speed', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'dancers', label: 'Dancers', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'colour', label: 'Hand colouring', type: 'select', options: ['Drop only', 'Always', 'Black only'], default: 0 },
      { key: 'stock', label: 'Stock', type: 'select', options: ['Newsprint', 'Canary', 'Rose'], default: 0 },
      { key: 'wear', label: 'Ink and wear', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'words', label: 'Title (blank for default)', type: 'text', default: '' },
    ],

    actions: [
      { id: 'recast', label: 'Recast the street', run() { this.wantRecast = true; } },
    ],

    gallery: {
      title: 'Penny Dreadful',
      technique: 'Canvas 2D: a cached sheet (paper, foxing, justified Baskerville columns, rules) under live wood-type headlines set letter by letter; a white-line woodcut built from variable-width cut lines (each sky line a filled polygon whose thickness is a function of the moon and horizon), parallax card flats on separate grooves, procedural houses, cobbles in perspective, figures as silhouettes with white-line hatching; colour laid on with multiply blending, offset from the key; a seeded speckle of ink starvation and a grain tile over everything',
      brief: 'A Victorian penny serial cover come alive. Under a masthead of mixed wood type (THE PHANTOM FIDDLER) and a subtitle in condensed grotesque, a white-line woodcut of a moonlit street moves like a toy theatre: the sky, the far rooftops and church clock, the near houses, the cobbles and the gas lamps slide past at their own speeds, a cloaked phantom fiddles under the moon, and waltzing couples are pushed across on their slides, flipping like card. Each kick changes the bow\'s direction, makes the dancers hop and jumps one subtitle letter, marching along the line. Each clap bangs a shutter open on a lit window with a dancer inside. The bass swells the moon and thickens the cut lines around it and billows the cloak; hats twinkle the stars and spill notes from the fiddle. The drop is hand-coloured: a stencilled blood-red horizon and cloak lining, yellow moon and windows, the title word in red, a "double number" slip pasted over the corner, more dancers and a flight of bats. The breakdown drains the red and rolls fog over the cobbles.',
      lineage: [
        'The penny dreadfuls and penny bloods of 1830s-1880s London (Edward Lloyd\'s and the Newsagents\' Publishing Company\'s serials): a masthead in whatever wood type the printer had, the price and number above, a lurid wood engraving filling half the page, and dense columns below; later numbers hand- or stencil-coloured. The white-line technique follows Thomas Bewick\'s wood engraving, where the block is black and every cut is light. The motion is the Victorian toy theatre (Pollock\'s and Webb\'s "penny plain, twopence coloured" sheets): card flats on grooves, actors on tin slides, and the moving panorama. Batch 05 brief entry "09 · Penny dreadful". All wording is original.',
        'Process: the first render read as a penny serial at once, but the near houses stood so tall they hid the moon and the engraved sky, and the drop\'s red wash, laid as a band behind the roofs, turned the whole street into a red block. The houses were cut down with alleys between them so the far skyline and church clock show through, and the red moved into the ink itself: the sky\'s lower cut lines are printed in red, so the black key stays black. Dancers were enlarged (they were lost in the cobbles) and the fiddler now gets a small bump on each kick, as a card actor does when pushed on its slide, which gave the kick a clear local hot spot. The red wash spared the face after it made the phantom look like a devil. Fog was first a few thick white ropes across the street; it is now eleven fine broken wavy cuts. A 96 s run looked the same every drop, so each drop now prints the next number of the serial (No. 14, 15, ...) with a new second title. Jolt at 640x360: calm, drop kickArea 0.059, ratio 1.38; build kick 0.043.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.houses) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.seed = Math.floor(this.rng() * 1e6);
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.hatCount = 0; this.snareCount = 0;
      this.low = 0; this.drop = false; this.hadDrop = false; this.phase = -1;
      this.bassEnv = 0; this.padEnv = 0; this.hatEnv = 0; this.energy = 0;
      this.scrollX = 0;
      this.bow = { from: -1, to: 1, t0: -10 };
      this.red = 0; this.yel = 0; this.fog = 0.6; this.bats = 0; this.slip = 0;
      this.sub = { text: SUBTITLES[0], t0: -10 };
      this.prevSub = null;
      this.notes = [];
      this.twinkles = [];
      this.dancers = [];
      this.nextDancerId = 0;
      this.cache = null; this.cacheKey = '';
      this.grainPat = null; this.speckPat = null; this.patCtx = null;
      this.buildStreet();
      this.wantRecast = false;
    },

    // The strips of card: far skyline, near houses, lamps. Seeded, periodic.
    buildStreet() {
      const r = mulberry(this.seed + 17);
      // Near houses in units of the illustration width.
      const houses = [];
      let x = 0;
      while (x < 2.4) {
        const w = 0.11 + r() * 0.1;
        const h = 0.2 + r() * 0.21;
        const roof = r() < 0.55 ? 0 : r() < 0.6 ? 1 : 2; // gable, stepped, flat
        const cols = w > 0.16 ? 3 : 2;
        const rows = h > 0.33 ? 3 : 2;
        const wins = [];
        for (let i = 0; i < cols * rows; i++) wins.push({ lit: r() < 0.12 ? 1 : 0, t0: -10, until: r() < 0.12 ? 1e9 : -1, fig: r() });
        houses.push({ x, w, h, roof, cols, rows, wins, chim: r() < 0.7, chimX: 0.15 + r() * 0.6, gap: 0.004 + r() * 0.012 });
        x += w + (r() < 0.35 ? 0.03 + r() * 0.05 : 0.004 + r() * 0.01);
      }
      this.housesP = x;
      this.houses = houses;
      // Far skyline: a profile of roofs with one church tower per period.
      const far = [];
      let fx = 0;
      const towerAt = 0.3 + r() * 0.5;
      let tower = false;
      while (fx < 1.8) {
        if (!tower && fx > towerAt) {
          far.push({ x: fx, w: 0.08, h: 0.5, kind: 'tower' });
          fx += 0.08; tower = true; continue;
        }
        const w = 0.05 + r() * 0.08;
        far.push({ x: fx, w, h: 0.1 + r() * 0.14, kind: r() < 0.5 ? 'gable' : 'flat', pots: Math.floor(r() * 3) });
        fx += w;
      }
      this.farP = fx;
      this.far = far;
      this.stars = [];
      for (let i = 0; i < 46; i++) this.stars.push({ x: r(), y: r() * 0.42, s: 0.5 + r(), ph: r() * 10 });
    },

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; this.kickCount++; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; this.snareCount++; }
      if (b8 > 26 && b8 - this.prev[8] > 10 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; this.hatCount++; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.7) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.06) : k(0.35));
      this.padEnv += ((s[2] + s[3]) / 200 - this.padEnv) * k(0.8);
      this.hatEnv += ((s[7] + s[8]) / 200 - this.hatEnv) * k(0.6);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.2);
      return { kick, snare, hat };
    },

    // ---- textures ------------------------------------------------------------

    patterns(g) {
      if (this.patCtx === g && this.grainPat) return;
      this.patCtx = g;
      // Paper: fibre noise and soft blotches, near white so multiply only tones it.
      const N = 256;
      const c = document.createElement('canvas'); c.width = N; c.height = N;
      const x = c.getContext('2d');
      const img = x.createImageData(N, N);
      const rnd = mulberry(4242);
      const blot = new Float32Array(16 * 16);
      for (let i = 0; i < blot.length; i++) blot[i] = rnd();
      for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
        const bx = xx / 16, by = y / 16, ix = Math.floor(bx), iy = Math.floor(by);
        const fx = bx - ix, fy = by - iy;
        const q = (a, b) => blot[((b & 15) * 16) + (a & 15)];
        const sm = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
        const fib = (rnd() < 0.015) ? 30 : 0;
        const v = 255 - rnd() * 30 - sm * 18 - fib;
        const o = (y * N + xx) * 4;
        img.data[o] = v; img.data[o + 1] = v - 3; img.data[o + 2] = v - 9; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.grainPat = g.createPattern(c, 'repeat');
      // Ink starvation: specks and scratches where the ink missed the paper.
      const c2 = document.createElement('canvas'); c2.width = N; c2.height = N;
      const x2 = c2.getContext('2d');
      x2.fillStyle = '#fff';
      for (let i = 0; i < 520; i++) {
        const r0 = rnd() < 0.9 ? 0.35 + rnd() * 0.7 : 1 + rnd() * 1.4;
        x2.globalAlpha = 0.5 + rnd() * 0.5;
        x2.beginPath(); x2.ellipse(rnd() * N, rnd() * N, r0 * (1 + rnd()), r0, rnd() * 3, 0, Math.PI * 2); x2.fill();
      }
      x2.globalAlpha = 0.6; x2.strokeStyle = '#fff'; x2.lineWidth = 0.6;
      for (let i = 0; i < 14; i++) {
        const sx = rnd() * N, sy = rnd() * N, a = (rnd() - 0.5) * 0.5, L = 8 + rnd() * 30;
        x2.beginPath(); x2.moveTo(sx, sy); x2.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L); x2.stroke();
      }
      this.speckCanvas = c2;
      this.speckPat = g.createPattern(c2, 'repeat');
    },

    // ---- the static sheet ----------------------------------------------------

    layout(W, H) {
      const m = Math.min(W, H) * 0.035;
      const land = W / H >= 1.25;
      const L = { W, H, m, land };
      L.topY = m + 4;
      L.smallRow = L.topY + 14;
      L.titleY = L.topY + 26;
      L.titleH = H * (land ? 0.15 : 0.12);
      L.subY = L.titleY + L.titleH + 4;
      L.subH = H * (land ? 0.062 : 0.05);
      L.ruleY = L.subY + L.subH + 6;
      L.capH = 26;
      L.impH = 16;
      const colW = land ? Math.min(W * 0.17, 200) : 0;
      const gut = land ? 14 : 0;
      L.colW = colW; L.gut = gut;
      L.ix = m + 6 + colW + gut;
      L.iy = L.ruleY + 10;
      L.iw = W - 2 * (m + 6) - 2 * (colW + gut);
      L.ih = H - m - 6 - L.impH - L.capH - L.iy;
      if (!land) {
        // Stacked: illustration full width, a little squarer.
        L.ih = Math.min(L.ih, L.iw * 0.9);
      }
      L.capY = L.iy + L.ih + 6;
      L.impY = H - m - 6 - L.impH;
      L.lx = m + 6; L.rx = W - m - 6 - colW;
      return L;
    },

    buildCache(p, W, H, L, stock, wear) {
      const pd = p.pixelDensity();
      const cw = Math.round(p.width * pd), ch = Math.round(p.height * pd);
      if (!this.cache) this.cache = document.createElement('canvas');
      if (this.cache.width !== cw || this.cache.height !== ch) { this.cache.width = cw; this.cache.height = ch; }
      const g = this.cache.getContext('2d');
      const s = (p.width / W) * pd;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = stock.paper; g.fillRect(0, 0, W, H);
      // Age: darker toward the edges, foxing, a centre fold.
      const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, stock.edge);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = rg; g.fillRect(0, 0, W, H);
      const r = mulberry(99);
      for (let i = 0; i < 26 * wear; i++) {
        const fx = r() * W, fy = r() * H, fr = 2 + r() * 9;
        g.globalAlpha = 0.12 + r() * 0.18;
        g.fillStyle = stock.edge;
        g.beginPath(); g.ellipse(fx, fy, fr * (1 + r() * 0.6), fr, r() * 3, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 0.18;
      const fold = g.createLinearGradient(W / 2 - 8, 0, W / 2 + 8, 0);
      fold.addColorStop(0, 'rgba(0,0,0,0)'); fold.addColorStop(0.5, stock.edge); fold.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fold; g.fillRect(W / 2 - 8, 0, 16, H);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

      const ink = stock.ink;
      g.fillStyle = ink; g.strokeStyle = ink;
      const m = L.m;
      // Outer border: thick and thin.
      g.lineWidth = 2.2; g.strokeRect(m, m, W - 2 * m, H - 2 * m);
      g.lineWidth = 0.7; g.strokeRect(m + 3.5, m + 3.5, W - 2 * m - 7, H - 2 * m - 7);
      // Top line: number, publication, price.
      const x0 = m + 10, x1 = W - m - 10;
      g.textBaseline = 'alphabetic';
      g.font = `700 11px ${SERIF}`; g.textAlign = 'left';
      g.fillText('No. ' + (13 + (this.dropCount || 0)) + '.', x0, L.smallRow);
      g.textAlign = 'right'; g.fillText('ONE PENNY.', x1, L.smallRow);
      g.font = `400 9px ${SERIF}`; g.textAlign = 'center';
      g.fillText(L.land ? 'PUBLISHED EVERY SATURDAY NIGHT  •  ENTERED AT LAMPLIGHT HALL' : 'EVERY SATURDAY NIGHT', W / 2, L.smallRow - 1);
      g.lineWidth = 0.7; this.hline(g, x0 - 4, x1 + 4, L.smallRow + 4);
      g.lineWidth = 2; this.hline(g, x0 - 4, x1 + 4, L.smallRow + 7);
      // Rules under the subtitle: thin, thick, thin (a Scotch rule).
      g.lineWidth = 0.7; this.hline(g, x0 - 4, x1 + 4, L.ruleY - 1);
      g.lineWidth = 2.4; this.hline(g, x0 - 4, x1 + 4, L.ruleY + 2.5);
      g.lineWidth = 0.7; this.hline(g, x0 - 4, x1 + 4, L.ruleY + 6);
      // Caption under the illustration.
      g.font = `italic 700 ${L.land ? 13 : 12}px ${ITAL}`; g.textAlign = 'center';
      g.fillText('“Hark! — the fiddle, and the feet of those who cannot stop.”', L.ix + L.iw / 2, L.capY + 13);
      // Imprint.
      g.lineWidth = 0.7; this.hline(g, x0 - 4, x1 + 4, L.impY);
      g.font = `400 7.5px ${SERIF}`; g.textAlign = 'center';
      g.fillText('LONDON: Printed and Published for the Proprietors by the NIGHTJAR PRESS, 9, Lantern Row, Blackfriars. — Sold by all Booksellers and Newsmen.', W / 2, L.impY + 10);
      // Columns.
      if (L.land) {
        this.column(g, L.lx, L.iy, L.colW, L.impY - 6 - L.iy, COL_LEFT, true, ink, 'CHAPTER I.', 'THE BELL TOLLS TWELVE.');
        this.column(g, L.rx, L.iy, L.colW, L.impY - 6 - L.iy, COL_RIGHT, false, ink, null, null, true);
        g.lineWidth = 0.6;
        this.vline(g, L.ix - L.gut / 2, L.iy, L.impY - 6);
        this.vline(g, L.ix + L.iw + L.gut / 2, L.iy, L.impY - 6);
      }
    },

    hline(g, a, b, y) { g.beginPath(); g.moveTo(a, y); g.lineTo(b, y); g.stroke(); },
    vline(g, x, a, b) { g.beginPath(); g.moveTo(x, a); g.lineTo(x, b); g.stroke(); },

    // A justified column of small Baskerville, with a heading and a drop cap.
    column(g, x, y, w, h, text, dropCap, ink, head, sub, notice) {
      g.fillStyle = ink; g.strokeStyle = ink;
      let cy = y + 2;
      if (head) {
        g.font = `900 12px ${ITAL}`; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText(head, x + w / 2, cy); cy += 15;
        g.font = `400 7.5px ${SERIF}`; g.fillText(sub, x + w / 2, cy); cy += 11;
        g.lineWidth = 0.5; this.hline(g, x + w * 0.3, x + w * 0.7, cy); cy += 5;
      }
      const fs = 7.2, lh = 8.6;
      g.font = `400 ${fs}px ${SERIF}`; g.textBaseline = 'top'; g.textAlign = 'left';
      const words = text.split(' ');
      let capW = 0;
      if (dropCap) {
        g.font = `400 ${lh * 3 * 0.95}px ${FACES.fat}`;
        const ch = words[0][0];
        g.fillText(ch, x, cy - 1);
        capW = g.measureText(ch).width + 2;
        words[0] = words[0].slice(1);
        g.font = `400 ${fs}px ${SERIF}`;
      }
      const sp = g.measureText(' ').width;
      const noticeH = notice ? 74 : 0;
      const bottom = y + h - noticeH;
      let line = [], lineW = 0, li = 0;
      const avail = () => w - (li < 3 ? capW : 0);
      const flush = (last) => {
        const lx = x + (li < 3 ? capW : 0);
        const aw = avail();
        const gaps = line.length - 1;
        const extra = !last && gaps > 0 ? (aw - lineW) / gaps : 0;
        let px = lx;
        for (let i = 0; i < line.length; i++) {
          g.fillText(line[i].w, px, cy);
          px += line[i].m + sp + extra;
        }
        cy += lh; li++; line = []; lineW = 0;
      };
      // Loop the text so the column is always full, as a real serial would be.
      let wi = 0, guard = 0;
      while (cy + lh < bottom && guard++ < 4000) {
        const word = words[wi % words.length]; wi++;
        if (word === '') continue;
        const mw = g.measureText(word).width;
        const need = lineW + (line.length ? sp : 0) + mw;
        if (need > avail() && line.length) flush(false);
        if (cy + lh >= bottom) break;
        lineW += (line.length ? sp : 0) + mw;
        line.push({ w: word, m: mw });
      }
      if (line.length && cy + lh < bottom) flush(true);
      if (notice) {
        const ny = y + h - noticeH + 6;
        g.lineWidth = 1.4; g.strokeRect(x + 2, ny, w - 4, noticeH - 10);
        g.lineWidth = 0.5; g.strokeRect(x + 4.5, ny + 2.5, w - 9, noticeH - 15);
        g.textAlign = 'center'; g.textBaseline = 'top';
        g.font = `400 13px ${FACES.bebas}`; g.fillText('NOTICE.', x + w / 2, ny + 6);
        g.font = `400 7px ${SERIF}`;
        g.fillText('No. 14 will contain', x + w / 2, ny + 21);
        g.font = `400 12px ${FACES.tuscan}`; g.fillText('THE MIDNIGHT BALL', x + w / 2, ny + 31);
        g.font = `400 7px ${SERIF}`;
        g.fillText('with a Grand Engraving,', x + w / 2, ny + 46);
        g.fillText('given away GRATIS.', x + w / 2, ny + 55);
      }
    },

    // ---- per-frame type ------------------------------------------------------

    // Mixed wood type: each word in a different face, short words small italic,
    // the whole line fitted to the measure as a compositor would space it out.
    drawTitle(g, L, words, t, ink) {
      const parts = words.trim().toUpperCase().split(/\s+/).filter(Boolean);
      const bigFaces = ['tuscan', 'fat', 'slab'];
      let bi = 0;
      const H0 = 100; // reference size; everything scales to fit
      const items = [];
      let longest = -1, longLen = 0;
      for (let i = 0; i < parts.length; i++) {
        const w = parts[i];
        const small = w.length <= 3 && parts.length > 1;
        const face = small ? null : bigFaces[(bi++) % bigFaces.length];
        const size = small ? H0 * 0.34 : (face === 'tuscan' ? H0 * 0.92 : H0);
        g.font = small ? `italic 700 ${size}px ${ITAL}` : `400 ${size}px ${FACES[face]}`;
        const mw = g.measureText(w).width;
        items.push({ w, small, face, size, mw });
        if (!small && w.length > longLen) { longLen = w.length; longest = i; }
      }
      const gap = H0 * 0.16;
      let total = 0;
      for (const it of items) total += it.mw;
      total += gap * (items.length - 1);
      const availW = L.W - 2 * L.m - 30;
      const sc = Math.min(availW / Math.max(total, 1), L.titleH / (H0 * 0.86));
      let x = L.W / 2 - total * sc / 2;
      const base = L.titleY + L.titleH * 0.86;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const sz = it.size * sc;
        g.font = it.small ? `italic 700 ${sz}px ${ITAL}` : `400 ${sz}px ${FACES[it.face]}`;
        const red = i === longest ? this.red : 0;
        g.fillStyle = red > 0.01 ? this.mix(ink, RED, red) : ink;
        const y = it.small ? base - H0 * sc * 0.3 : base;
        g.fillText(it.w, x, y);
        // Ink squash: wood type prints fat at the edges.
        g.strokeStyle = g.fillStyle; g.lineWidth = 0.5; g.strokeText(it.w, x, y);
        x += it.mw * sc + gap * sc;
      }
    },

    mix(inkHex, rgb, u) {
      const n = parseInt(inkHex.slice(1), 16);
      const a = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return `rgb(${Math.round(lerp(a[0], rgb[0], u))},${Math.round(lerp(a[1], rgb[1], u))},${Math.round(lerp(a[2], rgb[2], u))})`;
    },

    mixHex(hex, rgb, u) { return this.mix(hex, rgb, u); },

    // The subtitle, set letter by letter so letters can drop in, fall out and hop.
    drawSubtitle(g, L, t, ink, params) {
      const size = L.subH * 0.95;
      g.save();
      g.beginPath(); g.rect(L.m + 5, L.subY - L.subH * 0.9, L.W - 2 * L.m - 10, L.subH * 1.9); g.clip();
      g.font = `400 ${size}px ${FACES.cond}`;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = ink;
      const base = L.subY + L.subH * 0.92;
      const track = size * 0.08;
      const layoutOf = (text) => {
        const ws = []; let tot = 0;
        for (const c of text) { const w = g.measureText(c).width; ws.push(w); tot += w + track; }
        return { ws, tot: tot - track };
      };
      // Outgoing letters fall off the line one after another.
      if (this.prevSub) {
        const lo = layoutOf(this.prevSub.text);
        let x = L.W / 2 - lo.tot / 2;
        let alive = false;
        for (let i = 0; i < this.prevSub.text.length; i++) {
          const c = this.prevSub.text[i];
          const u = t - this.prevSub.t0 - i * 0.018;
          const fy = u > 0 ? 900 * u * u : 0;
          if (fy < L.subH * 2) alive = true;
          if (c !== ' ' && fy < L.subH * 2) {
            g.save(); g.translate(x + lo.ws[i] / 2, base + fy); g.rotate(u > 0 ? (hash(i) - 0.5) * u * 3 : 0);
            g.fillText(c, -lo.ws[i] / 2, 0); g.restore();
          }
          x += lo.ws[i] + track;
        }
        if (!alive) this.prevSub = null;
      }
      const lo = layoutOf(this.sub.text);
      let x = L.W / 2 - lo.tot / 2;
      const letters = this.sub.text.replace(/ /g, '').length;
      const hopIdx = letters ? this.kickCount % letters : -1;
      const ku = (t - this.lastKick) / 0.32;
      const hop = ku < 1 ? Math.sin(Math.PI * clamp(ku, 0, 1)) : 0;
      let li = 0;
      for (let i = 0; i < this.sub.text.length; i++) {
        const c = this.sub.text[i];
        if (c !== ' ') {
          const u = clamp((t - this.sub.t0 - i * 0.03) / 0.3, 0, 1);
          if (u > 0) {
            let dy = (1 - easeOutBack(u)) * -L.subH * 1.6;
            let rot = 0;
            if (li === hopIdx && hop > 0) { dy -= hop * size * 0.32 * params.reaction; rot = (li % 2 ? 1 : -1) * hop * 0.12 * params.reaction; }
            g.save(); g.translate(x + lo.ws[i] / 2, base + dy); g.rotate(rot);
            g.fillText(c, -lo.ws[i] / 2, 0); g.restore();
          }
          li++;
        }
        x += lo.ws[i] + track;
      }
      g.restore();
    },

    // ---- the woodcut ---------------------------------------------------------

    drawIllustration(g, L, t, dt, params, P, ink, paper) {
      const { ix, iy, iw, ih } = L;
      const groundY = iy + ih * 0.76;
      g.save();
      g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
      g.fillStyle = ink; g.fillRect(ix, iy, iw, ih);

      // Moon: sits upper left, drifts a little on its wire.
      const moonX = ix + iw * (0.24 + 0.02 * Math.sin(t * 0.07));
      const moonY = iy + ih * (0.24 + 0.015 * Math.sin(t * 0.11 + 1));
      const moonR = ih * 0.095 * (1 + 0.1 * this.bassEnv);
      const M = { x: moonX, y: moonY, r: moonR };
      this.moon = M;

      // Sky: horizontal cut lines, each a polygon whose width is the light.
      const sp = ih / 62;
      // In the drop the lower sky is printed in red ink: a lurid horizon.
      if (this.red > 0.01) {
        const gr = g.createLinearGradient(0, iy + ih * 0.1, 0, groundY);
        gr.addColorStop(0, paper);
        gr.addColorStop(0.3, paper);
        gr.addColorStop(0.75, this.mixHex(paper, RED, 0.8 * this.red));
        gr.addColorStop(1, this.mixHex(paper, [150, 20, 16], this.red));
        g.fillStyle = gr;
      } else g.fillStyle = paper;
      g.beginPath();
      const nx = 36;
      for (let y = iy + sp * 0.5; y < groundY; y += sp) {
        const yn = (y - iy) / (groundY - iy);
        const top = [], bot = [];
        for (let k = 0; k <= nx; k++) {
          const x = ix + iw * k / nx;
          const d = Math.hypot(x - moonX, (y - moonY) * 1.25) / (moonR * (4.2 + 1.5 * this.bassEnv));
          let th = 0.07 + 0.5 * Math.pow(yn, 2.2) + 0.8 * Math.exp(-d * d) * (0.75 + 0.4 * this.bassEnv);
          th = clamp(th, 0.04, 0.9) * sp;
          const wob = Math.sin(x * 0.045 + y * 0.3) * 0.35;
          top.push(x, y + wob - th / 2); bot.push(x, y + wob + th / 2);
        }
        g.moveTo(top[0], top[1]);
        for (let k = 1; k <= nx; k++) g.lineTo(top[k * 2], top[k * 2 + 1]);
        for (let k = nx; k >= 0; k--) g.lineTo(bot[k * 2], bot[k * 2 + 1]);
        g.closePath();
      }
      g.fill();

      // Stars where the sky is dark; hats make them flare.
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        const sx = ix + posmod(s.x * iw - this.scrollX * 0.03, iw);
        const sy = iy + s.y * ih;
        if (Math.hypot(sx - moonX, sy - moonY) < moonR * 3) continue;
        let tw = 0;
        for (const tk of this.twinkles) if (tk.i === i) tw = Math.max(tw, 1 - (t - tk.t0) / 0.5);
        const r = (1.1 + 0.6 * Math.sin(t * 1.3 + s.ph)) * s.s + tw * 3.5;
        this.star(g, sx, sy, r, ink, paper);
      }

      // Moon and its ring halo.
      g.fillStyle = ink;
      g.beginPath(); g.arc(moonX, moonY, moonR * 1.22, 0, Math.PI * 2); g.fill();
      g.strokeStyle = paper;
      for (let k = 0; k < 3; k++) {
        g.lineWidth = 1.3 - k * 0.3;
        g.setLineDash([moonR * 0.25, moonR * 0.12]);
        g.lineDashOffset = t * (4 + k * 3) * (k % 2 ? -1 : 1);
        g.beginPath(); g.arc(moonX, moonY, moonR * (1.35 + k * 0.28 + 0.1 * this.bassEnv), 0, Math.PI * 2); g.stroke();
      }
      g.setLineDash([]);
      g.fillStyle = paper;
      g.beginPath(); g.arc(moonX, moonY, moonR, 0, Math.PI * 2); g.fill();
      // Engraved shading on the moon's right limb and two seas.
      g.save(); g.beginPath(); g.arc(moonX, moonY, moonR, 0, Math.PI * 2); g.clip();
      g.strokeStyle = ink; g.lineWidth = 0.8;
      for (let k = -6; k <= 6; k++) {
        const yy = moonY + k * moonR / 6.5;
        const half = Math.sqrt(Math.max(0, moonR * moonR - (yy - moonY) * (yy - moonY)));
        g.beginPath(); g.moveTo(moonX + half * 0.55, yy); g.lineTo(moonX + half + 1, yy); g.stroke();
      }
      g.fillStyle = ink; g.globalAlpha = 1;
      g.beginPath(); g.ellipse(moonX - moonR * 0.25, moonY - moonR * 0.2, moonR * 0.22, moonR * 0.14, 0.4, 0, Math.PI * 2);
      g.ellipse(moonX + moonR * 0.1, moonY + moonR * 0.3, moonR * 0.16, moonR * 0.1, -0.3, 0, Math.PI * 2); g.fill();
      g.restore();

      // Clouds: card flats on a slow wire, passing over the moon.
      for (let c = 0; c < 3; c++) {
        const per = iw * 1.9;
        const cx = ix + posmod(iw * (0.1 + c * 0.63) + t * (5 + c * 3) * (0.6 + P.scroll * 0.4), per) - iw * 0.35;
        const cy = iy + ih * (0.12 + c * 0.13 + (this.fogAmt * 0.04));
        this.cloud(g, cx, cy, iw * (0.22 + 0.05 * c), ih * 0.07, c, ink, paper);
      }

      // Bats in the drop.
      if (this.bats > 0.02) this.drawBats(g, L, t, ink, paper);

      // Far skyline and the church clock.
      this.drawFar(g, L, t, groundY, ink, paper);
      // Notes from the fiddle, behind the near houses so they rise into sky.
      // Near houses.
      this.drawHouses(g, L, t, groundY, ink, paper);
      // Street.
      this.drawStreet(g, L, t, groundY, ink, paper);
      // Dancers upstage of the fiddler.
      this.drawDancers(g, L, t, groundY, ink, paper, params, 0);
      // Fog.
      if (this.fogAmt > 0.02) this.drawFog(g, L, t, groundY, ink, paper);
      // The fiddler.
      this.drawPhantom(g, L, t, groundY, ink, paper, params);
      this.drawNotes(g, L, t, ink, paper);
      // Downstage dancers and the lamps, fastest flats.
      this.drawDancers(g, L, t, groundY, ink, paper, params, 1);
      this.drawLamps(g, L, t, groundY, ink, paper);

      g.restore();
      this.groundY = groundY;
    },

    star(g, x, y, r, ink, paper) {
      g.fillStyle = paper;
      g.beginPath();
      g.moveTo(x, y - r * 1.8); g.lineTo(x + r * 0.3, y - r * 0.3); g.lineTo(x + r * 1.8, y);
      g.lineTo(x + r * 0.3, y + r * 0.3); g.lineTo(x, y + r * 1.8); g.lineTo(x - r * 0.3, y + r * 0.3);
      g.lineTo(x - r * 1.8, y); g.lineTo(x - r * 0.3, y - r * 0.3); g.closePath(); g.fill();
    },

    cloud(g, x, y, w, h, seed, ink, paper) {
      const n = 5 + seed;
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        pts.push({ x: x + u * w, y: y - Math.sin(Math.PI * u) * h * (0.6 + 0.5 * hash(seed * 11 + k)) });
      }
      const path = () => {
        g.beginPath();
        g.moveTo(pts[0].x, y);
        for (let k = 0; k < n; k++) {
          const a = pts[k], b = pts[k + 1];
          const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - (b.x - a.x) * 0.45;
          g.quadraticCurveTo(mx, my, b.x, b.y);
        }
        g.quadraticCurveTo(x + w * 0.5, y + h * 0.5, pts[0].x, y);
        g.closePath();
      };
      path(); g.fillStyle = ink; g.fill();
      g.strokeStyle = paper; g.lineWidth = 1.4; g.stroke();
      // Inner cut lines echoing the scallops.
      g.lineWidth = 0.7;
      for (let r = 1; r <= 2; r++) {
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const a = pts[k], b = pts[k + 1];
          const off = r * h * 0.22;
          const ax = lerp(a.x, b.x, 0.15), bx = lerp(a.x, b.x, 0.85);
          g.moveTo(ax, a.y + off + (b.y - a.y) * 0.15);
          g.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - (b.x - a.x) * 0.3 + off, bx, b.y + off - (b.y - a.y) * 0.15);
        }
        g.stroke();
      }
    },

    drawBats(g, L, t, ink, paper) {
      const { ix, iy, iw, ih } = L;
      const n = Math.round(9 * this.bats);
      g.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        const per = iw * 1.5;
        const bx = ix + iw * 1.2 - posmod(t * iw * (0.07 + 0.02 * hash(i)) + hash(i + 3) * per, per);
        const by = iy + ih * (0.18 + 0.25 * hash(i + 9)) + Math.sin(t * 1.3 + i) * ih * 0.04;
        const s = ih * (0.022 + 0.012 * hash(i + 5));
        const f = Math.sin(t * 13 + i * 2.1);
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx - s * 0.6, by - s * (0.6 * f + 0.3), bx - s * 1.6, by - s * f);
        g.lineTo(bx - s * 1.1, by + s * 0.1); g.lineTo(bx - s * 0.7, by - s * 0.05 * f); g.lineTo(bx - s * 0.3, by + s * 0.35);
        g.lineTo(bx + s * 0.3, by + s * 0.35); g.lineTo(bx + s * 0.7, by - s * 0.05 * f); g.lineTo(bx + s * 1.1, by + s * 0.1);
        g.lineTo(bx + s * 1.6, by - s * f);
        g.quadraticCurveTo(bx + s * 0.6, by - s * (0.6 * f + 0.3), bx, by);
        g.closePath();
        g.fillStyle = ink; g.fill(); g.strokeStyle = paper; g.lineWidth = 0.9; g.stroke();
      }
    },

    drawFar(g, L, t, groundY, ink, paper) {
      const { ix, iw, ih } = L;
      const off = this.scrollX * 0.25;
      const per = this.farP * iw;
      const baseY = groundY - ih * 0.02;
      for (let rep = -1; rep <= 1; rep++) {
        for (const f of this.far) {
          const x0 = ix + f.x * iw - posmod(off, per) + rep * per;
          const w = f.w * iw;
          if (x0 > ix + iw || x0 + w < ix) continue;
          const h = f.h * ih;
          g.fillStyle = ink; g.strokeStyle = paper; g.lineWidth = 0.9;
          g.beginPath();
          if (f.kind === 'tower') {
            const tw = w * 0.6, tx = x0 + (w - tw) / 2;
            g.moveTo(tx, baseY); g.lineTo(tx, baseY - h * 0.62); g.lineTo(tx + tw / 2, baseY - h * 1.12);
            g.lineTo(tx + tw, baseY - h * 0.62); g.lineTo(tx + tw, baseY); g.closePath();
            g.fill(); g.stroke();
            // Clock: the minute hand ticks round a little each bar.
            const cx = tx + tw / 2, cy = baseY - h * 0.5, cr = tw * 0.32;
            g.fillStyle = paper; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
            g.strokeStyle = ink; g.lineWidth = 0.8;
            for (let k = 0; k < 12; k++) {
              const a = k * Math.PI / 6;
              g.beginPath(); g.moveTo(cx + Math.cos(a) * cr * 0.78, cy + Math.sin(a) * cr * 0.78);
              g.lineTo(cx + Math.cos(a) * cr * 0.92, cy + Math.sin(a) * cr * 0.92); g.stroke();
            }
            const mins = -Math.PI / 2 + (this.kickCount / 4) * (Math.PI / 30) - 0.35;
            g.lineWidth = 1.1;
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(mins) * cr * 0.8, cy + Math.sin(mins) * cr * 0.8); g.stroke();
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-Math.PI / 2 - 0.03) * cr * 0.55, cy + Math.sin(-Math.PI / 2 - 0.03) * cr * 0.55); g.stroke();
            // Belfry louvres.
            g.strokeStyle = paper; g.lineWidth = 0.7;
            for (let k = 0; k < 3; k++) { const yy = baseY - h * (0.72 + k * 0.045); g.beginPath(); g.moveTo(tx + tw * 0.3, yy); g.lineTo(tx + tw * 0.7, yy); g.stroke(); }
          } else {
            g.moveTo(x0, baseY);
            if (f.kind === 'gable') { g.lineTo(x0, baseY - h * 0.7); g.lineTo(x0 + w / 2, baseY - h); g.lineTo(x0 + w, baseY - h * 0.7); }
            else { g.lineTo(x0, baseY - h); g.lineTo(x0 + w, baseY - h); }
            g.lineTo(x0 + w, baseY); g.closePath(); g.fill();
            g.beginPath();
            if (f.kind === 'gable') { g.moveTo(x0, baseY - h * 0.7); g.lineTo(x0 + w / 2, baseY - h); g.lineTo(x0 + w, baseY - h * 0.7); }
            else { g.moveTo(x0, baseY - h); g.lineTo(x0 + w, baseY - h); }
            g.stroke();
            for (let k = 0; k < f.pots; k++) {
              const px = x0 + w * (0.25 + k * 0.4), py = baseY - h * (f.kind === 'gable' ? 0.82 : 1);
              g.fillStyle = ink; g.fillRect(px, py - h * 0.18, w * 0.09, h * 0.18);
              g.strokeRect(px, py - h * 0.18, w * 0.09, h * 0.18);
            }
          }
        }
      }
    },

    drawHouses(g, L, t, groundY, ink, paper) {
      const { ix, iw, ih } = L;
      const off = this.scrollX * 0.55;
      const per = this.housesP * iw;
      this.visWins = [];
      for (let rep = -1; rep <= 1; rep++) {
        for (let hi = 0; hi < this.houses.length; hi++) {
          const hs = this.houses[hi];
          const x0 = ix + hs.x * iw - posmod(off, per) + rep * per;
          const w = hs.w * iw;
          if (x0 > ix + iw || x0 + w < ix) continue;
          const h = hs.h * ih;
          const top = groundY - h;
          const roofH = hs.roof === 0 ? w * 0.55 : hs.roof === 1 ? w * 0.3 : 0;
          // Body and roof.
          g.fillStyle = ink; g.strokeStyle = paper; g.lineWidth = 1.2; g.lineJoin = 'miter';
          g.beginPath();
          g.moveTo(x0, groundY); g.lineTo(x0, top);
          if (hs.roof === 0) g.lineTo(x0 + w / 2, top - roofH);
          else if (hs.roof === 1) { const st = w / 5; g.lineTo(x0, top - roofH * 0.3); g.lineTo(x0 + st, top - roofH * 0.3); g.lineTo(x0 + st, top - roofH * 0.65); g.lineTo(x0 + st * 2, top - roofH * 0.65); g.lineTo(x0 + st * 2, top - roofH); g.lineTo(x0 + st * 3, top - roofH); g.lineTo(x0 + st * 3, top - roofH * 0.65); g.lineTo(x0 + st * 4, top - roofH * 0.65); g.lineTo(x0 + st * 4, top - roofH * 0.3); g.lineTo(x0 + w, top - roofH * 0.3); }
          g.lineTo(x0 + w, top); g.lineTo(x0 + w, groundY); g.closePath();
          g.fill(); g.stroke();
          if (hs.chim) {
            const cx = x0 + w * hs.chimX, cw = w * 0.1;
            const ct = top - (hs.roof === 0 ? roofH * (1 - Math.abs(hs.chimX - 0.5) * 2) : roofH) - ih * 0.05;
            g.fillStyle = ink; g.fillRect(cx, ct, cw, top - ct + 2);
            g.strokeRect(cx, ct, cw, top - ct);
            g.strokeRect(cx - cw * 0.15, ct - 2, cw * 1.3, 3);
          }
          // Moonlit facade: vertical cuts, thicker on the side facing the moon.
          g.save();
          g.beginPath(); g.rect(x0 + 1.5, top + 2, w - 3, h - 2); g.clip();
          g.beginPath();
          const step = 3.2;
          const lit = this.moon && this.moon.x < x0 + w / 2 ? 1 : 0;
          for (let x = x0 + 2; x < x0 + w - 1; x += step) {
            const u = (x - x0) / w;
            const f = lit ? 1 - u : u;
            const lw = 0.25 + 0.9 * f * f;
            g.rect(x, top + 2, lw, h);
          }
          g.fillStyle = paper; g.fill();
          g.restore();
          // Windows.
          const ww = w / (hs.cols * 1.9 + 0.9), wh = Math.min(ww * 1.5, h / (hs.rows * 1.7 + 0.6));
          const gx = (w - hs.cols * ww) / (hs.cols + 1), gy = (h - hs.rows * wh) / (hs.rows + 1);
          for (let r = 0; r < hs.rows; r++) for (let c = 0; c < hs.cols; c++) {
            const win = hs.wins[r * hs.cols + c];
            const wx = x0 + gx + c * (ww + gx), wy = top + gy * 0.8 + r * (wh + gy);
            const onU = win.t0 > -5 ? clamp((t - win.t0) / 0.12, 0, 1) : (win.until > t ? 1 : 0);
            const offU = win.until < t && win.t0 > -5 ? clamp((t - win.until) / 0.2, 0, 1) : 0;
            const litAmt = (win.until > t || win.t0 > -5) ? onU * (1 - offU) : 0;
            g.fillStyle = ink; g.fillRect(wx - 1.5, wy - 1.5, ww + 3, wh + 3);
            if (litAmt > 0.01) {
              g.fillStyle = paper; g.fillRect(wx, wy, ww, wh);
              // A sleeper dancing in the window.
              const sw = Math.sin(t * 5 + win.fig * 10) * ww * 0.12;
              g.fillStyle = ink;
              g.beginPath(); g.arc(wx + ww / 2 + sw, wy + wh * 0.38, ww * 0.13, 0, Math.PI * 2); g.fill();
              g.beginPath(); g.moveTo(wx + ww / 2 + sw, wy + wh * 0.45); g.lineTo(wx + ww * 0.22 + sw * 1.4, wy + wh); g.lineTo(wx + ww * 0.78 + sw * 1.4, wy + wh); g.closePath(); g.fill();
              this.visWins.push({ x: wx, y: wy, w: ww, h: wh, a: litAmt });
              // Shutters swing open.
              const sh = 1 - easeOut(onU);
              if (sh > 0.01) { g.fillStyle = ink; g.fillRect(wx, wy, ww / 2 * sh, wh); g.fillRect(wx + ww - ww / 2 * sh, wy, ww / 2 * sh, wh); }
            } else {
              g.strokeStyle = paper; g.lineWidth = 0.8; g.strokeRect(wx, wy, ww, wh);
            }
            g.strokeStyle = ink; g.lineWidth = 1;
            g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.45); g.lineTo(wx + ww, wy + wh * 0.45); g.stroke();
            g.fillStyle = paper; g.fillRect(wx - 2, wy + wh + 1, ww + 4, 1.2);
            win.sx = wx; win.sy = wy; win.vis = wx > ix + 4 && wx + ww < ix + iw - 4;
          }
          // Door.
          const dw = w * 0.16, dh = Math.min(h * 0.22, dw * 2.1), dx = x0 + w * 0.08 + (hi % 2) * w * 0.66;
          g.fillStyle = ink; g.fillRect(dx, groundY - dh, dw, dh);
          g.strokeStyle = paper; g.lineWidth = 0.9; g.strokeRect(dx, groundY - dh, dw, dh);
          g.beginPath(); g.arc(dx + dw / 2, groundY - dh, dw / 2, Math.PI, 0); g.stroke();
        }
      }
    },

    drawStreet(g, L, t, groundY, ink, paper) {
      const { ix, iy, iw, ih } = L;
      const bot = iy + ih;
      // Kerb and pavement.
      g.fillStyle = paper; g.fillRect(ix, groundY, iw, 1.6);
      g.fillRect(ix, groundY + ih * 0.035, iw, 1.1);
      const pw = ih * 0.06;
      g.strokeStyle = paper; g.lineWidth = 0.7;
      g.beginPath();
      const off0 = posmod(this.scrollX * 0.6, pw);
      for (let x = ix - off0; x < ix + iw + pw; x += pw) { g.moveTo(x, groundY + 1.6); g.lineTo(x - pw * 0.25, groundY + ih * 0.035); }
      g.stroke();
      // Cobbles in perspective: nearer rows are bigger and slide faster.
      const y0 = groundY + ih * 0.04;
      const rows = 9;
      g.beginPath();
      for (let r = 0; r < rows; r++) {
        const u0 = r / rows, u1 = (r + 1) / rows;
        const ya = y0 + (bot - y0) * Math.pow(u0, 1.35), yb = y0 + (bot - y0) * Math.pow(u1, 1.35);
        const rh = yb - ya;
        const cw = rh * 1.9;
        const speed = 0.65 + 0.9 * u0;
        const off = posmod(this.scrollX * speed + (r % 2) * cw * 0.5, cw);
        for (let x = ix - off; x < ix + iw + cw; x += cw) {
          const cx = x + cw / 2, cy = ya + rh * 0.45;
          g.moveTo(cx - cw * 0.38, cy + rh * 0.08);
          g.quadraticCurveTo(cx - cw * 0.35, cy - rh * 0.34, cx, cy - rh * 0.32);
          g.quadraticCurveTo(cx + cw * 0.28, cy - rh * 0.3, cx + cw * 0.36, cy - rh * 0.02);
        }
      }
      g.strokeStyle = paper; g.lineWidth = 1; g.stroke();
      // The moon's reflection laid on the wet stones as broken strokes.
      if (this.moon) {
        g.beginPath();
        for (let k = 0; k < 7; k++) {
          const yy = y0 + (bot - y0) * (0.1 + k * 0.12);
          const ww = this.moon.r * (0.8 - k * 0.07) * (1 + 0.25 * Math.sin(t * 2 + k));
          g.rect(this.moon.x - ww / 2 + Math.sin(t * 1.4 + k * 2) * 3, yy, ww, 1.4 + k * 0.25);
        }
        g.fillStyle = paper; g.fill();
      }
    },

    drawFog(g, L, t, groundY, ink, paper) {
      const { ix, iw, ih } = L;
      const a = this.fogAmt;
      g.fillStyle = paper;
      g.beginPath();
      for (let b = 0; b < 11; b++) {
        const yb = groundY - ih * 0.13 + b * ih * 0.026;
        const nx = 30;
        const th0 = (0.8 + 2.6 * a) * (1 - Math.abs(b - 5) * 0.07);
        const top = [], bot = [];
        for (let k = 0; k <= nx; k++) {
          const x = ix + iw * k / nx;
          const ph = x * 0.012 + t * (0.25 + b * 0.07) * (b % 2 ? 1 : -1) + b * 1.7;
          const wave = Math.sin(ph) * ih * 0.014;
          const th = th0 * Math.max(0, Math.sin(ph * 1.3 + b * 2.1) * 1.1 - 0.1) * a;
          top.push(x, yb + wave - th / 2); bot.push(x, yb + wave + th / 2);
        }
        g.moveTo(top[0], top[1]);
        for (let k = 1; k <= nx; k++) g.lineTo(top[k * 2], top[k * 2 + 1]);
        for (let k = nx; k >= 0; k--) g.lineTo(bot[k * 2], bot[k * 2 + 1]);
        g.closePath();
      }
      g.fill();
    },

    drawLamps(g, L, t, groundY, ink, paper) {
      const { ix, iy, iw, ih } = L;
      const per = iw * 0.95;
      const off = posmod(this.scrollX * 1.35, per);
      for (let x = ix + iw * 0.12 - off; x < ix + iw + 40; x += per) {
        const baseY = iy + ih + 4;
        const topY = iy + ih * 0.33;
        const lw = ih * 0.018;
        // Post.
        g.fillStyle = ink; g.strokeStyle = paper; g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x - lw * 1.6, baseY); g.lineTo(x - lw * 0.6, baseY - ih * 0.12); g.lineTo(x - lw * 0.5, topY + ih * 0.06);
        g.lineTo(x + lw * 0.5, topY + ih * 0.06); g.lineTo(x + lw * 0.6, baseY - ih * 0.12); g.lineTo(x + lw * 1.6, baseY); g.closePath();
        g.fill(); g.stroke();
        // Cross bar for the lamplighter's ladder.
        g.fillRect(x - lw * 3, topY + ih * 0.075, lw * 6, lw * 0.7);
        g.strokeRect(x - lw * 3, topY + ih * 0.075, lw * 6, lw * 0.7);
        // Engraved rays: short cuts radiating from the lantern; they lengthen
        // with the bass.
        const ly = topY - ih * 0.005;
        const R0 = ih * 0.05, R1 = ih * (0.1 + 0.05 * this.bassEnv + 0.03 * this.padEnv);
        g.strokeStyle = paper; g.lineWidth = 0.8;
        g.beginPath();
        for (let k = 0; k < 28; k++) {
          const a = k / 28 * Math.PI * 2 + 0.05;
          const r1 = R1 * (k % 2 ? 0.75 : 1);
          g.moveTo(x + Math.cos(a) * R0, ly + Math.sin(a) * R0); g.lineTo(x + Math.cos(a) * r1, ly + Math.sin(a) * r1);
        }
        g.stroke();
        // Lantern.
        const lh = ih * 0.07, lt = ih * 0.028, lb = ih * 0.018;
        g.fillStyle = ink;
        g.beginPath(); g.moveTo(x - lt * 1.3, ly - lh / 2); g.lineTo(x, ly - lh / 2 - lt); g.lineTo(x + lt * 1.3, ly - lh / 2); g.closePath(); g.fill();
        g.fillStyle = paper;
        g.beginPath(); g.moveTo(x - lt, ly - lh / 2); g.lineTo(x + lt, ly - lh / 2); g.lineTo(x + lb, ly + lh / 2); g.lineTo(x - lb, ly + lh / 2); g.closePath(); g.fill();
        g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
        g.beginPath(); g.moveTo(x, ly - lh / 2); g.lineTo(x, ly + lh / 2); g.stroke();
        // The flame.
        g.fillStyle = ink;
        const fl = 1 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3);
        g.beginPath(); g.ellipse(x, ly + lh * 0.12, lb * 0.35, lh * 0.18 * fl, 0, 0, Math.PI * 2); g.fill();
        (this.lampsSeen || (this.lampsSeen = [])).push({ x, y: ly, lt, lb, lh });
      }
    },

    // The phantom fiddler, a card figure on a slide centre stage.
    drawPhantom(g, L, t, groundY, ink, paper, params) {
      const { ix, iy, iw, ih } = L;
      const u = ih * 0.74;
      const fx = ix + iw * (0.63 + 0.025 * Math.sin(t * 0.23));
      const fy = iy + ih * 0.95;
      const bil = 1 + 0.22 * this.bassEnv;
      // A kick bumps him on his slide, as a hand pushing a card actor would.
      const ku = (t - this.lastKick) / 0.28;
      const bump = ku < 1 ? Math.sin(Math.PI * clamp(ku, 0, 1)) * params.reaction : 0;
      g.save();
      g.translate(fx, fy - bump * ih * 0.03);
      g.rotate(0.02 * Math.sin(t * 0.9) - bump * 0.025 * (this.kickCount % 2 ? 1 : -1));
      g.lineJoin = 'round';
      // Cloak with a ragged, fluttering hem.
      const cloak = new Path2D();
      cloak.moveTo(0, -1.02 * u);
      cloak.bezierCurveTo(0.09 * u, -1.02 * u, 0.12 * u, -0.9 * u, 0.13 * u, -0.8 * u);
      cloak.bezierCurveTo(0.2 * u, -0.6 * u, 0.24 * u * bil, -0.3 * u, 0.3 * u * bil, -0.02 * u);
      const n = 11;
      for (let k = 1; k <= n; k++) {
        const s = k / n;
        const x = lerp(0.3 * u * bil, -0.28 * u * bil, s);
        const fl = Math.sin(t * 3.1 + k * 1.7) * 0.02 * u * (0.5 + this.bassEnv);
        const y = (k % 2 ? 0.035 * u : -0.03 * u) + fl;
        cloak.lineTo(x + Math.sin(t * 2 + k) * 0.01 * u, y);
      }
      cloak.bezierCurveTo(-0.22 * u * bil, -0.3 * u, -0.18 * u, -0.6 * u, -0.13 * u, -0.8 * u);
      cloak.bezierCurveTo(-0.12 * u, -0.9 * u, -0.09 * u, -1.02 * u, 0, -1.02 * u);
      cloak.closePath();
      g.fillStyle = ink; g.fill(cloak);
      // Fold cuts.
      g.save(); g.clip(cloak);
      g.strokeStyle = paper;
      for (let k = -7; k <= 7; k++) {
        const x0 = k * 0.018 * u, x1 = k * 0.042 * u * bil + Math.sin(t * 1.5 + k) * 0.012 * u;
        g.lineWidth = 0.6 + 0.9 * clamp(0.5 - k / 14, 0, 1);
        g.beginPath(); g.moveTo(x0, -0.78 * u);
        g.quadraticCurveTo(x0 * 1.6 + Math.sin(t + k) * 0.01 * u, -0.4 * u, x1, 0.05 * u); g.stroke();
      }
      g.restore();
      g.strokeStyle = paper; g.lineWidth = 1.6; g.stroke(cloak);
      this.cloakPath = cloak; this.cloakTf = { x: fx, y: fy - bump * ih * 0.03, r: 0.02 * Math.sin(t * 0.9) - bump * 0.025 * (this.kickCount % 2 ? 1 : -1) };
      // Hood and face.
      g.fillStyle = ink;
      g.beginPath(); g.ellipse(0, -0.93 * u, 0.075 * u, 0.1 * u, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = paper; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = paper;
      g.beginPath(); g.ellipse(-0.012 * u, -0.9 * u, 0.045 * u, 0.062 * u, -0.1, 0, Math.PI * 2); g.fill();
      this.faceAt = { x: -0.012 * u, y: -0.9 * u, rx: 0.05 * u, ry: 0.067 * u };
      g.fillStyle = ink;
      g.beginPath(); g.ellipse(-0.03 * u, -0.91 * u, 0.012 * u, 0.016 * u, 0, 0, Math.PI * 2);
      g.ellipse(0.008 * u, -0.912 * u, 0.012 * u, 0.016 * u, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-0.035 * u, -0.868 * u); g.quadraticCurveTo(-0.012 * u, -0.855 * u, 0.012 * u, -0.868 * u); g.stroke();
      for (let k = 0; k < 4; k++) { const xx = -0.028 * u + k * 0.013 * u; g.beginPath(); g.moveTo(xx, -0.872 * u); g.lineTo(xx, -0.861 * u); g.stroke(); }
      // Fiddle under the chin, pointing left and down.
      const fa = -2.55;
      const fcx = -0.1 * u, fcy = -0.72 * u;
      g.save(); g.translate(fcx, fcy); g.rotate(fa + Math.PI);
      const fl = 0.2 * u;
      g.fillStyle = paper; g.strokeStyle = ink; g.lineWidth = 1.1;
      g.beginPath();
      g.ellipse(0.05 * fl, 0, 0.2 * fl, 0.17 * fl, 0, 0, Math.PI * 2);
      g.ellipse(0.33 * fl, 0, 0.16 * fl, 0.13 * fl, 0, 0, Math.PI * 2);
      g.fill(); g.stroke();
      g.fillStyle = ink; g.fillRect(0.12 * fl, -0.2 * fl * 0.25, 0.1 * fl, 0.1 * fl);
      g.fillRect(0.45 * fl, -0.025 * fl, 0.55 * fl, 0.05 * fl);
      g.beginPath(); g.arc(1.02 * fl, 0, 0.04 * fl, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-0.05 * fl, -0.07 * fl); g.quadraticCurveTo(0.0, -0.02 * fl, -0.05 * fl, 0.02 * fl);
      g.moveTo(-0.05 * fl, 0.07 * fl); g.quadraticCurveTo(0.0, 0.02 * fl, -0.05 * fl, -0.02 * fl); g.stroke();
      g.restore();
      // Left hand at the neck.
      const nx = fcx + Math.cos(fa + Math.PI) * fl * 0.85, ny = fcy + Math.sin(fa + Math.PI) * fl * 0.85;
      g.fillStyle = paper; g.beginPath(); g.ellipse(nx, ny, 0.022 * u, 0.016 * u, 0.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke();
      // Bow: one stroke per beat; between beats in the quiet a slow bowing.
      const bu = clamp((t - this.bow.t0) / 0.42, 0, 1);
      const quiet = clamp(1 - (t - this.lastKick) / 1.5, 0, 1);
      const sBeat = lerp(this.bow.from, this.bow.to, easeInOut(bu));
      const sIdle = Math.sin(t * 1.6);
      const sPos = lerp(sIdle, sBeat, quiet);
      const cxp = fcx + Math.cos(fa + Math.PI) * fl * 0.18, cyp = fcy + Math.sin(fa + Math.PI) * fl * 0.18;
      const bd = fa + Math.PI + Math.PI / 2 - 0.25;
      const dxv = Math.cos(bd), dyv = Math.sin(bd);
      const BL = 0.36 * u;
      const s = sPos * 0.13 * u;
      const hx = cxp + dxv * (s + BL * 0.5), hy = cyp + dyv * (s + BL * 0.5);
      const tx = cxp + dxv * (s - BL * 0.5), ty = cyp + dyv * (s - BL * 0.5);
      // Bowing arm: sleeve from the right shoulder to the hand.
      const shx = 0.11 * u, shy = -0.78 * u;
      const elx = lerp(shx, hx, 0.5) + 0.06 * u, ely = lerp(shy, hy, 0.5) + 0.07 * u;
      g.strokeStyle = paper; g.lineCap = 'round'; g.lineWidth = 0.06 * u + 2.4;
      g.beginPath(); g.moveTo(shx, shy); g.quadraticCurveTo(elx, ely, hx, hy); g.stroke();
      g.strokeStyle = ink; g.lineWidth = 0.06 * u;
      g.beginPath(); g.moveTo(shx, shy); g.quadraticCurveTo(elx, ely, hx, hy); g.stroke();
      g.strokeStyle = ink; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
      g.strokeStyle = paper; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = paper; g.beginPath(); g.ellipse(hx, hy, 0.024 * u, 0.018 * u, bd, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke();
      g.lineCap = 'butt';
      g.restore();
      this.fiddleAt = { x: fx + fcx, y: fy + fcy - bump * ih * 0.03 };
    },

    // Waltzing couples: card cut-outs pushed across on slides, flipping as
    // they turn. layer 0 is upstage (smaller, behind the fiddler), 1 downstage.
    drawDancers(g, L, t, groundY, ink, paper, params, layer) {
      const { ix, iy, iw, ih } = L;
      const ku = (t - this.lastKick) / 0.3;
      const hop = ku < 1 ? Math.sin(Math.PI * clamp(ku, 0, 1)) : 0;
      for (const d of this.dancers) {
        if (d.layer !== layer) continue;
        const sc = layer ? 1 : 0.72;
        const v = ih * 0.36 * sc;
        const x = ix + d.x * iw;
        const y = (layer ? iy + ih * 0.97 : groundY + ih * 0.1) - hop * ih * 0.08 * params.reaction * sc - Math.abs(Math.sin(d.ph * 2)) * ih * 0.008;
        const flip = Math.cos(d.ph);
        const fx = Math.sign(flip || 1) * Math.max(0.12, Math.abs(flip));
        g.save(); g.translate(x, y); g.rotate(Math.sin(d.ph * 2) * 0.05); g.scale(fx * d.dir, 1);
        this.couple(g, v, ink, paper, d.kind);
        g.restore();
      }
    },

    couple(g, v, ink, paper, kind) {
      g.lineJoin = 'round';
      // Lady: bell skirt, bodice, head with a bun; leaning back into the turn.
      const p = new Path2D();
      p.moveTo(-0.34 * v, 0);
      p.quadraticCurveTo(-0.3 * v, -0.3 * v, -0.1 * v, -0.47 * v);
      p.lineTo(-0.1 * v, -0.62 * v);
      p.quadraticCurveTo(-0.14 * v, -0.7 * v, -0.12 * v, -0.74 * v);
      p.lineTo(-0.02 * v, -0.72 * v);
      p.lineTo(0.0, -0.5 * v);
      p.quadraticCurveTo(0.2 * v, -0.3 * v, 0.2 * v, 0);
      p.closePath();
      g.fillStyle = ink; g.fill(p);
      // Skirt flounces as cut lines.
      g.save(); g.clip(p);
      g.strokeStyle = paper; g.lineWidth = 0.9;
      for (let k = 1; k <= 4; k++) {
        const yy = -0.1 * v * k + 0.02 * v;
        g.beginPath(); g.moveTo(-0.4 * v, yy); g.quadraticCurveTo(-0.07 * v, yy + 0.05 * v, 0.25 * v, yy - 0.01 * v); g.stroke();
      }
      g.restore();
      g.strokeStyle = paper; g.lineWidth = 1.1; g.stroke(p);
      g.fillStyle = paper;
      g.beginPath(); g.arc(-0.1 * v, -0.8 * v, 0.055 * v, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.beginPath(); g.arc(-0.15 * v, -0.83 * v, 0.035 * v, 0, Math.PI * 2); g.fill();
      g.strokeStyle = paper; g.lineWidth = 0.8; g.stroke();
      // Gent: tail-coat, trousers, top hat.
      const q = new Path2D();
      q.moveTo(0.1 * v, 0); q.lineTo(0.15 * v, -0.42 * v);
      q.lineTo(0.3 * v, -0.36 * v); // coat tail
      q.lineTo(0.2 * v, -0.5 * v);
      q.lineTo(0.2 * v, -0.74 * v);
      q.lineTo(0.08 * v, -0.76 * v);
      q.lineTo(0.03 * v, -0.62 * v); // arm round her
      q.lineTo(-0.05 * v, -0.58 * v);
      q.lineTo(0.06 * v, -0.5 * v);
      q.lineTo(0.08 * v, -0.42 * v);
      q.lineTo(0.03 * v, 0);
      q.closePath();
      g.fillStyle = ink; g.fill(q);
      g.strokeStyle = paper; g.lineWidth = 1.1; g.stroke(q);
      g.fillStyle = paper; g.beginPath(); g.arc(0.14 * v, -0.82 * v, 0.05 * v, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.fillRect(0.1 * v, -1.0 * v, 0.085 * v, 0.14 * v); g.fillRect(0.075 * v, -0.87 * v, 0.14 * v, 0.02 * v);
      g.strokeStyle = paper; g.lineWidth = 0.8; g.strokeRect(0.1 * v, -1.0 * v, 0.085 * v, 0.14 * v);
      g.fillStyle = paper; g.fillRect(0.14 * v, -0.73 * v, 0.03 * v, 0.1 * v); // shirt front
      if (kind === 1) {
        // A skeleton gent for the drop: ribs cut into the coat.
        g.strokeStyle = paper; g.lineWidth = 0.9;
        for (let k = 0; k < 4; k++) { const yy = -0.66 * v + k * 0.045 * v; g.beginPath(); g.moveTo(0.1 * v, yy); g.quadraticCurveTo(0.15 * v, yy - 0.015 * v, 0.19 * v, yy); g.stroke(); }
        g.fillStyle = ink; g.beginPath(); g.arc(0.125 * v, -0.83 * v, 0.012 * v, 0, Math.PI * 2); g.arc(0.155 * v, -0.83 * v, 0.012 * v, 0, Math.PI * 2); g.fill();
      }
    },

    drawNotes(g, L, t, ink, paper) {
      for (const n of this.notes) {
        const age = t - n.t0;
        const u = age / n.life;
        const s = n.s * (u > 0.8 ? (1 - u) / 0.2 : 1) * clamp(age / 0.15, 0, 1);
        if (s <= 0.05) continue;
        const x = n.x + age * n.vx + Math.sin(age * 3 + n.ph) * 6;
        const y = n.y + age * n.vy;
        g.save(); g.translate(x, y); g.rotate(Math.sin(age * 2 + n.ph) * 0.3);
        g.fillStyle = paper; g.strokeStyle = ink; g.lineWidth = 0.9;
        g.beginPath(); g.ellipse(0, 0, s * 0.55, s * 0.4, -0.4, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillRect(s * 0.4, -s * 1.9, s * 0.16, s * 1.9);
        g.strokeRect(s * 0.4, -s * 1.9, s * 0.16, s * 1.9);
        if (n.kind) {
          g.beginPath(); g.moveTo(s * 0.56, -s * 1.9); g.quadraticCurveTo(s * 1.2, -s * 1.4, s * 0.9, -s * 0.8);
          g.lineWidth = s * 0.2; g.strokeStyle = paper; g.stroke();
        }
        g.restore();
      }
    },

    // ---- colour washes -------------------------------------------------------

    washes(g, L, t, groundY) {
      const R = this.red, Y = this.yel;
      if (R < 0.01 && Y < 0.01) return;
      const { ix, iy, iw, ih } = L;
      const tint = (rgb, a) => `rgb(${Math.round(lerp(255, rgb[0], a))},${Math.round(lerp(255, rgb[1], a))},${Math.round(lerp(255, rgb[2], a))})`;
      g.save();
      g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
      g.globalCompositeOperation = 'multiply';
      // Stencils were cut by hand and laid on by the dozen: off register.
      g.translate(1.8, 1.2);
      if (R > 0.01) {
        // Cobbles caught red at the front.
        g.fillStyle = tint(RED, 0.55 * R);
        g.fillRect(ix, groundY + ih * 0.04, iw, ih);
        // The cloak's lining.
        if (this.cloakPath) {
          g.save();
          g.translate(this.cloakTf.x, this.cloakTf.y); g.rotate(this.cloakTf.r);
          // The face stays paper: only cloak and fiddle take the red.
          const pth = new Path2D(this.cloakPath);
          pth.moveTo(this.faceAt.x + this.faceAt.rx, this.faceAt.y);
          pth.ellipse(this.faceAt.x, this.faceAt.y, this.faceAt.rx, this.faceAt.ry, -0.1, 0, Math.PI * 2);
          g.fillStyle = tint(RED, R); g.fill(pth, 'evenodd');
          g.restore();
        }
      }
      if (Y > 0.01 && this.moon) {
        g.fillStyle = tint(YEL, 0.85 * Y);
        g.beginPath(); g.arc(this.moon.x + 1, this.moon.y - 1, this.moon.r * 1.08, 0, Math.PI * 2); g.fill();
        g.fillStyle = tint(YEL, 0.35 * Y);
        g.beginPath(); g.arc(this.moon.x, this.moon.y, this.moon.r * 2.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = tint(YEL, 0.9 * Y);
        for (const w of this.visWins || []) g.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
        for (const l of this.lampsSeen || []) {
          g.beginPath(); g.arc(l.x, l.y, l.lh * 0.9, 0, Math.PI * 2); g.fill();
        }
      }
      g.restore();
    },

    // The drop's slip: "Grand double number" pasted across the corner.
    drawSlip(g, L, t, ink, paper) {
      const a = this.slip;
      if (a < 0.01) return;
      const { ix, iy, iw, ih } = L;
      g.save();
      g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
      const cx = ix + iw, cy = iy;
      g.translate(cx, cy); g.rotate(Math.PI / 4);
      const w = ih * 0.14;
      const slide = (1 - easeOut(a)) * ih * 0.6;
      const off = ih * 0.2 + slide;
      g.fillStyle = `rgb(${RED[0]},${RED[1]},${RED[2]})`;
      g.fillRect(-ih, off, ih * 2, w);
      g.fillStyle = paper;
      g.fillRect(-ih, off + 2.5, ih * 2, 1); g.fillRect(-ih, off + w - 3.5, ih * 2, 1);
      g.font = `400 ${w * 0.62}px ${FACES.bebas}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('GRAND DOUBLE NUMBER!', 0, off + w * 0.54);
      g.restore();
    },

    // ---- per frame -------------------------------------------------------------

    draw(p, signals, params, ctx) {
      if (!this.houses) this.init();
      if (this.wantRecast) { this.seed = Math.floor(this.rng() * 1e6); this.buildStreet(); this.wantRecast = false; }
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const stock = STOCKS[clamp(Math.round(params.stock), 0, STOCKS.length - 1)];
      const ink = stock.ink, paper = stock.paper;
      const wear = params.wear;

      // ---- music
      const ev = this.analyse(signals, t, dt);
      const kicksRecent = t - this.lastKick < 2.2;
      if (!this.drop && this.low > 30) this.drop = true;
      else if (this.drop && this.low < 16) this.drop = false;
      if (this.drop) this.hadDrop = true;
      const phase = this.drop ? 2 : kicksRecent ? 1 : this.hadDrop ? 3 : 0;
      if (phase !== this.phase) {
        if (this.phase >= 0) this.prevSub = { text: this.sub.text, t0: t };
        if (phase === 2) this.dropCount = (this.dropCount || 0) + (this.phase >= 0 ? 1 : 0);
        const text = phase === 2 ? DROP_SUBS[((this.dropCount || 1) - 1) % DROP_SUBS.length] : SUBTITLES[phase];
        this.sub = { text, t0: this.phase >= 0 ? t + 0.25 : -10 };
        this.phase = phase;
      }
      if (ev.kick) {
        this.bow.from = lerp(this.bow.from, this.bow.to, easeInOut(clamp((t - this.bow.t0) / 0.42, 0, 1)));
        this.bow.to = this.bow.to > 0 ? -1 : 1;
        this.bow.t0 = t;
      }
      if (ev.snare) this.openWindow(t, phase);
      if (ev.hat) {
        this.twinkles.push({ i: Math.floor(hash(this.hatCount * 3.1) * this.stars.length), t0: t });
        if (phase >= 1 && phase <= 2 && this.fiddleAt && this.notes.length < (phase === 2 ? 16 : 7) && this.hatCount % 2 === 0) {
          const r = this.rng;
          this.notes.push({ x: this.fiddleAt.x, y: this.fiddleAt.y, vx: -8 - r() * 22, vy: -18 - r() * 22, t0: t, life: 2.2 + r(), s: 5 + r() * 4, ph: r() * 6, kind: r() < 0.6 ? 1 : 0 });
        }
      }
      this.twinkles = this.twinkles.filter((k) => t - k.t0 < 0.5);
      this.notes = this.notes.filter((n) => t - n.t0 < n.life);

      // Hand colouring, fog, bats and the slip follow the section.
      const cm = Math.round(params.colour);
      const redT = cm === 2 ? 0 : cm === 1 ? 1 : (phase === 2 ? 1 : 0);
      const yelT = cm === 2 ? 0 : cm === 1 ? 1 : [0.2, 0.4, 1, 0.55][phase];
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.red += (redT - this.red) * k(redT > this.red ? 0.35 : 1.2);
      this.yel += (yelT - this.yel) * k(0.8);
      const fogT = phase === 3 ? 1 : phase === 0 ? 0.6 : phase === 1 ? 0.25 : 0;
      this.fogAmt = (this.fogAmt === undefined ? fogT : this.fogAmt) + (fogT - (this.fogAmt || 0)) * k(1.5);
      this.bats += ((phase === 2 ? 1 : 0) - this.bats) * k(phase === 2 ? 0.8 : 1.5);
      this.slip += ((phase === 2 ? 1 : 0) - this.slip) * k(phase === 2 ? 0.25 : 0.6);

      // Panorama: speed follows energy, never jerks.
      const speed = params.scroll * (6 + 26 * this.energy + 10 * this.bassEnv);
      this.scrollX += speed * dt;

      this.updateDancers(t, dt, phase, params);

      // ---- sheet
      const L = this.layout(W, H);
      const fontsOk = window.VIZ_FONTS && VIZ_FONTS.has ? (VIZ_FONTS.has('Libre Baskerville') && VIZ_FONTS.has('Abril Fatface')) : true;
      const key = [p.width, p.height, p.pixelDensity(), W.toFixed(1), H.toFixed(1), params.stock, Math.round(wear * 4), fontsOk, this.dropCount || 0].join('|');
      if (key !== this.cacheKey) { this.buildCache(p, W, H, L, stock, wear); this.cacheKey = key; }
      this.patterns(g);

      g.save();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.setLineDash([]); g.lineCap = 'butt'; g.lineJoin = 'miter';
      g.drawImage(this.cache, 0, 0, W, H);

      const title = (params.words && String(params.words).trim()) || 'The Phantom Fiddler';
      this.drawTitle(g, L, title, t, ink);
      this.drawSubtitle(g, L, t, ink, params);

      this.lampsSeen = [];
      this.drawIllustration(g, L, t, dt, params, params, ink, paper);
      this.washes(g, L, t, this.groundY);
      // Engraving frame.
      g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(L.ix, L.iy, L.iw, L.ih);
      g.lineWidth = 0.6; g.strokeRect(L.ix - 3.5, L.iy - 3.5, L.iw + 7, L.ih + 7);
      this.drawSlip(g, L, t, ink, paper);

      // Print: paper grain multiplied over all, and specks where the ink missed.
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = this.grainPat; g.globalAlpha = clamp(0.6 + 0.3 * wear, 0, 1);
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      if (wear > 0.01) {
        // Tint the speck tile with the paper so misses show the stock colour.
        if (this.speckTint !== paper) {
          const c = this.speckCanvas, x = c.getContext('2d');
          x.globalCompositeOperation = 'source-in'; x.fillStyle = paper; x.fillRect(0, 0, c.width, c.height);
          x.globalCompositeOperation = 'source-over';
          this.speckPat = g.createPattern(c, 'repeat');
          this.speckTint = paper;
        }
        g.save();
        g.beginPath(); g.rect(L.ix, L.iy, L.iw, L.ih); g.clip();
        g.globalAlpha = clamp(0.55 * wear, 0, 1);
        g.fillStyle = this.speckPat;
        // The plate shifts a hair between impressions: speck field creeps.
        g.translate(Math.floor(t * 0.5) * 37 % 256, 0);
        g.fillRect(L.ix - 256, L.iy, L.iw + 512, L.ih);
        g.restore();
        g.globalAlpha = clamp(0.3 * wear, 0, 1);
        g.fillStyle = this.speckPat;
        g.fillRect(0, 0, W, L.ruleY + 8);
      }
      g.restore();
    },

    openWindow(t, phase) {
      const cands = [];
      for (const hs of this.houses) for (const w of hs.wins) if (w.vis && !(w.until > t)) cands.push(w);
      if (!cands.length) return;
      const w = cands[Math.floor(this.rng() * cands.length)];
      w.t0 = t; w.until = t + (phase === 2 ? 3.5 : 2.2) + this.rng() * 1.5;
    },

    updateDancers(t, dt, phase, params) {
      const base = [0, 2, 5, 1][phase];
      const target = Math.round(base * params.dancers);
      const r = this.rng;
      const live = this.dancers.filter((d) => !d.leaving);
      if (live.length < target && (!this.lastSpawn || t - this.lastSpawn > 0.6)) {
        const dir = r() < 0.5 ? 1 : -1;
        const layer = live.filter((d) => d.layer === 1).length < Math.ceil(target / 2) ? 1 : 0;
        this.dancers.push({ id: this.nextDancerId++, x: dir > 0 ? -0.15 : 1.15, v: dir * (0.04 + r() * 0.03), dir, ph: r() * 6, spin: 2.2 + r() * 1.2, layer, kind: phase === 2 && r() < 0.35 ? 1 : 0, leaving: false });
        this.lastSpawn = t;
      } else if (live.length > target) {
        live[0].leaving = true;
      }
      const sp = 0.6 + 0.8 * this.energy;
      for (const d of this.dancers) {
        // Couples drift across and wander back; leaving ones head for the wings.
        let v = d.v * sp;
        if (!d.leaving) {
          if (d.x > 0.92 && d.v > 0) d.v = -Math.abs(d.v);
          if (d.x < 0.08 && d.v < 0) d.v = Math.abs(d.v);
        } else v = Math.sign(d.v || 1) * 0.12;
        d.x += v * dt;
        d.ph += dt * d.spin * (0.5 + this.energy);
      }
      this.dancers = this.dancers.filter((d) => !(d.leaving && (d.x < -0.25 || d.x > 1.25)));
    },
  });
})();
