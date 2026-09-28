// Direct Address: a street poster in the visual language of AIDS-crisis
// activist graphics (ACT UP, Gran Fury): a black sheet, a flush-left stack of
// enormous white grotesque, one hot accent colour, and copy that speaks
// straight to the reader. The words here are original and about the room
// itself: the dance floor, bodies, care, and each other. None of the
// movement's symbols, slogans or logos appear, and no existing poster is
// copied; what is borrowed is the grammar (stark type, direct address,
// collective urgency) because that grammar was made for exactly this: telling
// a room of people that they are responsible for one another.
//
// The sheet, top to bottom: an address line ("TO EVERYONE ON THIS FLOOR:")
// over a heavy rule; the headline, re-pasted line by line every phrase with a
// new message; a crowd made of words (YOU, ME, US, CHOSEN FAMILY, STRANGERS…)
// marching across the foot of the poster in three depths; a line of small
// body copy about looking after each other.
//
// Music, each in its own place:
//   kick   one knot of the crowd jumps together and brightens; the knot moves
//          along the crowd by the golden ratio, so every part of it gets a turn
//   snare  a thick accent rule underlines a word of the headline, sliding to
//          a new word on every clap, like a finger pointing while speaking
//   hats   single words in the crowd catch the accent colour for a moment
//   bass   how fast the crowd marches, how bright it is
//   drop   the accent line is flooded with the accent colour and knocked out,
//          placards rise out of the crowd on sticks, the crowd marches faster;
//          the breakdown lowers the placards and lets the crowd dim and slow
// Printed look: flat offset inks, ink voids and a faint mottle over the
// black, a ghost word in the ground. No glow.

(function () {
  const ACCENTS = [
    { name: 'Hot pink', c: '#FF2E86' },
    { name: 'Signal red', c: '#FF3A22' },
    { name: 'Safety orange', c: '#FF7A0E' },
    { name: 'Acid green', c: '#A6FF2A' },
  ];
  const GROUND_NAMES = ['Black ink', 'Accent flood', 'Paper white'];
  const INK = '#0A0A0A';
  const WHITE = '#F4F2EC';
  const PAPER = '#ECE8DF';
  const FACES = [
    { name: 'Archivo Black', w: '400', fb: '"Arial Black", "Helvetica Neue", Arial, sans-serif' },
    { name: 'Anton', w: '400', fb: 'Impact, "Arial Narrow", sans-serif' },
    { name: 'Oswald', w: '700', fb: '"Arial Narrow", Arial, sans-serif' },
  ];
  const CROWD_WORDS = [
    'YOU', 'ME', 'US', 'WE', 'HER', 'HIM', 'THEM', 'THEY', 'FRIENDS', 'LOVERS',
    'STRANGERS', 'NEIGHBOURS', 'CHOSEN FAMILY', 'EVERYONE', 'KIN', 'ALL OF US',
    'SISTERS', 'BROTHERS', 'SIBLINGS', 'ELDERS', 'REGULARS', 'NEWCOMERS', 'EXES',
    'ROOMMATES', 'THE DJ', 'THE DOOR', 'THE BAR', 'YOUR MATES', 'NOBODY ALONE',
  ];
  const PLACARDS = ['CARE', 'STAY', 'HOLD ON', 'TOGETHER', 'WATER', 'HOME', 'HERE', 'US'];
  const DEFAULT_MESSAGES = 'WE KEEP/*EACH OTHER*/ALIVE | THIS FLOOR/HOLDS/*ALL OF US* | LOOK AT/THE PERSON/*NEXT TO YOU* | NO ONE/DANCES/*ALONE* | DANCE FOR/THE ONES WHO/*CAN\'T BE HERE* | YOUR BODY/*BELONGS*/HERE | CARE IS/HOW WE/*MOVE*';
  const DEFAULT_FOOTER = 'Drink water. Check on your friends. Ask before you touch. Make room. Walk each other home. | NOBODY LEAVES ALONE.';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeInOut = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const GOLD = 0.6180339887;

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
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixRgb(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  function css(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function face(fam, fb) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fb;
  }

  // "LINE/*ACCENT*/LINE | next sheet": sheets split on |, lines on /, and
  // asterisks toggle the accent colour inside a line.
  function parseSheets(str) {
    const out = [];
    String(str || '').split('|').forEach((sheet) => {
      const lines = sheet.split('/').map((l) => l.trim()).filter((l) => l.replace(/\*/g, '').trim().length);
      if (!lines.length) return;
      out.push(lines.slice(0, 5).map((l) => {
        const segs = [];
        l.split('*').forEach((txt, i) => { if (txt.length) segs.push({ text: txt.toUpperCase(), accent: i % 2 === 1 }); });
        return segs;
      }));
    });
    return out;
  }

  VIZ.register({
    id: 'actup',
    name: 'Direct Address',
    order: 517,

    params: [
      { key: 'messages', label: 'Messages ( / new line, *accent*, | next )', type: 'text', default: DEFAULT_MESSAGES },
      { key: 'address', label: 'Address line', type: 'text', default: 'TO EVERYONE ON THIS FLOOR:' },
      { key: 'footer', label: 'Small print | sign-off', type: 'text', default: DEFAULT_FOOTER },
      { key: 'accent', label: 'Accent ink', type: 'select', options: ACCENTS.map((a) => a.name), default: 0 },
      { key: 'ground', label: 'Ground', type: 'select', options: GROUND_NAMES, default: 0 },
      { key: 'face', label: 'Typeface', type: 'select', options: FACES.map((f) => f.name), default: 0 },
      { key: 'rows', label: 'Crowd rows', type: 'range', min: 0, max: 4, default: 3, step: 1 },
      { key: 'march', label: 'March speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'hold', label: 'Seconds per message', type: 'range', min: 5, max: 40, default: 15, step: 0.5 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'next', label: 'Next message', run() { this.wantNext = true; } },
    ],

    gallery: {
      title: 'Direct Address',
      technique: 'Canvas 2D in flat offset inks: a flush-left grotesque headline fitted to the sheet from measured cap heights and re-pasted line by line behind a clip wipe; a crowd of words in parallax rows on an endless march whose speed follows the bass; per-kick Gaussian "jump" of one knot of the crowd; a snare-driven underline that slides between measured word boxes; a generated ink-void and mottle layer over everything. In dialogue with the graphic language of AIDS-crisis activist posters (ACT UP, Gran Fury): stark type on black, direct address, one hot accent colour. No symbols, slogans or logos of the movement, and every word is original.',
      brief: 'A black street poster speaking straight to the room. Under an address line (TO EVERYONE ON THIS FLOOR:) an enormous white stack of type says one thing at a time, WE KEEP EACH OTHER ALIVE, THIS FLOOR HOLDS ALL OF US, LOOK AT THE PERSON NEXT TO YOU, with one line in hot pink, and every phrase the message is torn down and a new one pasted up line by line. Along the foot of the sheet a crowd made of words (YOU, ME, US, STRANGERS, CHOSEN FAMILY, THE DJ) marches across in three depths, and small print asks you to drink water, check on your friends and walk each other home. On each kick one knot of the crowd jumps together and brightens, the knot travelling along the crowd; on each clap a thick pink rule underlines a different word, like a finger pointing as someone speaks; hats catch single crowd words in pink. The bass sets the pace of the march. The drop floods the pink line into a solid band with the type knocked out, raises placards on sticks out of the crowd (CARE, STAY, HOLD ON, WATER, HOME) and quickens the march; the breakdown lowers them and lets the crowd dim and slow, leaving the words.',
      lineage: 'In dialogue with the late-1980s and early-1990s posters, stickers and bus-side works of AIDS activist collectives (ACT UP, Gran Fury): Futura- and Helvetica-weight grotesque, white or hot colour on black, sentences addressed to "you", wheat-pasted in repeats on city walls, the urgency of a group speaking as one. The rule for this piece was to honour that grammar without borrowing any of its symbols, slogans or specific posters, and without anything flippant, so all copy is original and about care on the dance floor: the headline messages, the pronoun crowd, the placards and the small print. Also drawing on the dance floor as a place of community and memory for queer people through that era, hence DANCE FOR THE ONES WHO CAN\'T BE HERE. Process: read the batch brief, TASTE and the contract; chose a crowd of words so the kick could land as bodies jumping together in one confined place, and the snare as a pointing underline so the two drums read as different gestures; the drop earns its second use of the accent (a flooded band, placards) while the breakdown dims the crowd. Iterations at 640x360: the first print mottle summed to a grey fog and the black stopped being black, so the blotches were cut to a whisper; a height-fit bug let the headline overrun the address rule; square and portrait sheets were half empty with one size per line, so narrow stages now justify each line to the measure at its own size; the accent flood got its own clock so it is pulled off briskly at the end of the drop instead of lingering half-drawn; the crowd gained a walking gait tied to its travel, and more, larger placards. Jolt meter (seed 1, 640x360): calm, drop kickArea 0.13, ratio 1.20; build kick 0.11.',
    },

    setup() { this.init(); },
    enter() { if (!this.inited) this.init(); },

    init() {
      this.inited = true;
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.snareCount = 0; this.hatCount = 0;
      this.kickNow = false;
      this.hops = []; this.sparks = [];
      this.low = 0; this.dense = false; this.bassEnv = 0; this.energy = 0;
      this.dropPres = 0; this.life = 0.3;
      this.march = [0, 0, 0, 0]; this.ghost = 0;
      this.sheet = null; this.prevSheet = null;
      this.ptr = { from: -1, to: 0, at: -10 };
      this.wantNext = false;
      this.texKey = ''; this.layoutKey = ''; this.crowdKey = '';
      const r = mulberry(1987);
      // Each row gets its own shuffled run of the crowd words, long enough to
      // outrun any stage width.
      this.rowWords = [0, 1, 2, 3].map(() => {
        const out = [];
        let bag = [];
        while (out.length < 110) {
          if (!bag.length) { bag = CROWD_WORDS.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; } }
          out.push(bag.pop());
        }
        return out;
      });
    },

    analyse(s, t, dt) {
      this.kickNow = false;
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++; this.kickNow = true;
        this.hops.push({ t, u: (this.kickCount * GOLD) % 1 });
        if (this.hops.length > 3) this.hops.shift();
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t; this.snareCount++;
        this.ptr = { from: this.ptr.to, to: this.ptr.to + 1 + (this.snareCount * 7) % 3, at: t };
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t; this.hatCount++;
        const r = mulberry(this.hatCount * 977 + 13);
        for (let i = 0; i < 2; i++) this.sparks.push({ t, row: Math.floor(r() * 4), j: Math.floor(r() * 110) });
        if (this.sparks.length > 10) this.sparks.splice(0, this.sparks.length - 10);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.5));
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
      if (!this.dense && this.low > 26) this.dense = true;
      else if (this.dense && this.low < 12) this.dense = false;
      this.dropPres += ((this.dense ? 1 : 0) - this.dropPres) * k(this.dense ? 0.45 : 1.3);
      // How lit the crowd is: full in the drop, a dim hush in the breakdown.
      const lifeT = clamp(0.35 + 0.65 * Math.max(this.dropPres, this.energy * 1.5), 0, 1);
      this.life += (lifeT - this.life) * k(1.4);
    },

    // Ink voids and a faint mottle, generated once per canvas size in device
    // pixels. Offset black is never a perfect black: the grain is what makes
    // the sheet read as printed rather than a screen.
    makeTexture(p, mode) {
      const w = Math.round(p.width * p.pixelDensity()), h = Math.round(p.height * p.pixelDensity());
      const key = w + 'x' + h + ':' + mode;
      if (this.texKey === key) return;
      this.texKey = key;
      const r = mulberry(41);
      const sc = Math.min(w, h) / 600;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const f = cv.getContext('2d');
      const light = mode === 0;
      f.filter = 'blur(' + Math.max(1, Math.round(22 * sc)) + 'px)';
      // Few, faint blotches: they overlap, so the sum is what reads, and it
      // must stay a whisper or the black stops being black.
      for (let i = 0; i < 36; i++) {
        const rad = (50 + r() * 160) * sc;
        f.fillStyle = light ? 'rgba(255,255,255,' + (r() < 0.5 ? 0.012 : 0.006) + ')' : 'rgba(0,0,0,0.018)';
        f.beginPath(); f.ellipse(r() * w, r() * h, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); f.fill();
      }
      f.filter = 'none';
      const speck = light ? '0,0,0' : '0,0,0';
      // Voids: tiny holes in whatever ink is underneath, dark on the white type
      // and the accent, lighter on the black ground.
      for (let i = 0; i < 2000; i++) {
        const s = Math.max(1, sc * (0.4 + r() * r() * 1.6));
        f.fillStyle = r() < 0.7 ? 'rgba(' + speck + ',' + (0.15 + r() * 0.3).toFixed(3) + ')' : 'rgba(255,255,255,' + (0.03 + r() * 0.05).toFixed(3) + ')';
        f.fillRect(r() * w, r() * h, s, s);
      }
      this.tex = cv;
    },

    // Fit the headline stack into its zone. Landscape: one size for every
    // line, as large as the widest line and the height allow, ragged right.
    // Square and portrait: each line justified to the full measure at its own
    // size (the other classic of the street-poster stack), so a narrow sheet
    // is filled by type instead of left half empty.
    layout(g, sheet, fontFam, fontW, zone, key, justify) {
      if (this.layoutKey === key) return this.lay;
      g.font = fontW + ' 100px ' + fontFam;
      const cap = (g.measureText('HXE').actualBoundingBoxAscent || 72) / 100;
      const w100 = sheet.map((segs) => { let w = 0; segs.forEach((sg) => { w += g.measureText(sg.text).width; }); return Math.max(1, w); });
      const maxW = Math.max.apply(null, w100);
      let sizes = w100.map((w) => (justify ? zone.w / w : zone.w / maxW) * 100);
      const gapK = 0.2;
      const heightOf = (sz) => {
        let h = 0;
        sz.forEach((f, i) => { h += cap * f; if (i) h += gapK * cap * Math.min(f, sz[i - 1]); });
        return h;
      };
      const k = Math.min(1, zone.h / heightOf(sizes));
      sizes = sizes.map((f) => f * k);
      const blockH = heightOf(sizes);
      let y = zone.y + (zone.h - blockH) * 0.5;
      const lines = [], words = [];
      sheet.forEach((segs, li) => {
        const fs = sizes[li], capH = cap * fs;
        if (li) y += gapK * cap * Math.min(fs, sizes[li - 1]);
        y += capH;
        const baseline = y;
        const gapBelow = li < sheet.length - 1 ? gapK * cap * Math.min(fs, sizes[li + 1]) : gapK * capH;
        const font = fontW + ' ' + fs.toFixed(2) + 'px ' + fontFam;
        g.font = font;
        let x = zone.x;
        const out = [];
        segs.forEach((sg) => {
          const w = g.measureText(sg.text).width;
          out.push({ text: sg.text, accent: sg.accent, x0: x, x1: x + w });
          if (!sg.accent) {
            // Word boxes for the snare's underline, measured by prefix so the
            // rule sits exactly under the letters, not the spaces.
            let pre = '';
            sg.text.split(' ').forEach((wd, wi, arr) => {
              const x0 = x + g.measureText(pre).width;
              const x1 = x0 + g.measureText(wd).width;
              if (wd.replace(/[^A-Z0-9]/g, '').length > 1) words.push({ line: li, x0, x1, baseline, gap: gapBelow });
              pre += wd + (wi < arr.length - 1 ? ' ' : '');
            });
          }
          x += w;
        });
        lines.push({ segs: out, baseline, x0: zone.x, x1: x, font, capH, gapAbove: li ? gapK * cap * Math.min(fs, sizes[li - 1]) : gapK * capH, gapBelow });
      });
      this.lay = { lines, words };
      this.layoutKey = key;
      return this.lay;
    },

    draw(p, s, params, ctx) {
      if (!this.inited) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const R = params.reaction;
      this.analyse(s, t, dt);
      this.hops = this.hops.filter((h) => t - h.t < 1.2);
      this.sparks = this.sparks.filter((sp) => t - sp.t < 0.22);

      // --- Inks for the chosen ground.
      const acc = ACCENTS[clamp(Math.round(params.accent), 0, ACCENTS.length - 1)].c;
      const mode = clamp(Math.round(params.ground), 0, 2);
      const pal = mode === 0 ? { bg: INK, fg: WHITE, acc, knock: INK, tag: INK }
        : mode === 1 ? { bg: acc, fg: INK, acc: WHITE, knock: acc, tag: acc }
          : { bg: PAPER, fg: INK, acc, knock: INK, tag: INK };
      const bgR = hexRgb(pal.bg), fgR = hexRgb(pal.fg), accR = hexRgb(pal.acc);

      const fc = FACES[clamp(Math.round(params.face), 0, FACES.length - 1)];
      const headFam = face(fc.name, fc.fb);
      const archivo = face('Archivo Black', FACES[0].fb);
      const crowdFam = face('Oswald', FACES[2].fb);
      const bodyFam = face('Oswald', FACES[2].fb);

      p.colorMode(p.RGB, 255);
      p.background(pal.bg);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.lineCap = 'butt'; g.lineJoin = 'miter';

      const m = Math.round(S * 0.055);
      const sheets = (this.sheetsSrc === params.messages && this.sheets) ? this.sheets
        : (this.sheetsSrc = params.messages, this.sheets = parseSheets(params.messages), this.sheets.length ? this.sheets : (this.sheets = parseSheets(DEFAULT_MESSAGES)));

      // --- Message sequencing: after the hold, the next message is pasted on
      // a kick (or at once if the music has no kick), torn down line by line
      // first.
      if (!this.sheet) this.sheet = { i: 0, start: t + 0.3 };
      if (this.sheet.i >= sheets.length) this.sheet.i = 0;
      const age = t - this.sheet.start;
      if (sheets.length > 1 && (this.wantNext || (age > params.hold && (this.kickNow || t - this.lastKick > 1.5)))) {
        this.wantNext = false;
        const n = sheets[this.sheet.i].length;
        this.prevSheet = { i: this.sheet.i, end: t };
        this.sheet = { i: (this.sheet.i + 1) % sheets.length, start: t + 0.35 + n * 0.1 };
        this.ptr = { from: -1, to: this.ptr.to, at: -10 };
      }

      // --- Vertical budget.
      const rows = clamp(Math.round(params.rows), 0, 4);
      const f = S * 0.088;                     // front-row type size
      const bodySize = clamp(S * 0.026, 10, 22);
      const footBase = H - m;
      const footRule = footBase - bodySize * 1.5;
      g.font = '700 100px ' + crowdFam;
      const capC = (g.measureText('HXE').actualBoundingBoxAscent || 80) / 100;
      const rowDefs = [];
      let y = footRule - f * 0.35;
      for (let k = rows - 1; k >= 0; k--) {
        const d = rows === 1 ? 1 : k / (rows - 1);
        const size = f * lerp(0.4, 1, d);
        rowDefs[k] = { k, d, size, base: y, speed: lerp(0.38, 1.1, d), shade: lerp(0.26, 0.9, d) };
        y -= capC * size + size * 0.2;
      }
      const crowdTop = rows ? rowDefs[0].base - capC * rowDefs[0].size : footRule;
      const placardH = f * 0.85, stick = f * 0.5;
      const headBottom = rows ? crowdTop - placardH - stick * 0.35 : footRule - m * 0.6;
      const addrSize = clamp(S * 0.03, 11, 26);
      const addrBase = m + addrSize * 0.75;
      const topRule = addrBase + addrSize * 0.55;
      const headTop = topRule + m * 0.55;

      // --- Ghost word in the ground: barely there, the one slow thing that
      // travels across the whole sheet.
      this.ghost += dt * params.march * (7 + 14 * this.bassEnv);
      {
        const gs = H * 0.9;
        g.font = '400 ' + gs.toFixed(1) + 'px ' + archivo;
        const word = 'TOGETHER ';
        const gw = g.measureText(word).width;
        const gx = -(this.ghost % gw);
        g.fillStyle = css(mixRgb(bgR, fgR, 0.045));
        const gy = H * 0.5 + gs * 0.36;
        for (let x = gx; x < W; x += gw) g.fillText(word, x, gy);
      }

      // --- Headline.
      const justify = W / H < 1.25;
      // The flood has its own clock: it sweeps in with the drop and is pulled
      // off briskly when the drop ends, rather than lingering half-drawn.
      this.flood = clamp((this.flood || 0) + (this.dropPres > 0.5 ? dt / 0.7 : -dt / 0.5), 0, 1);
      const zone = { x: m, y: headTop, w: W - 2 * m, h: Math.max(40, headBottom - headTop) };
      const drawSheet = (idx, inFn) => {
        const sheet = sheets[idx];
        const key = idx + '|' + this.sheetsSrc + '|' + headFam + '|' + W.toFixed(1) + 'x' + H.toFixed(1) + '|' + rows;
        const L = this.layout(g, sheet, headFam, fc.w, zone, key + (justify ? '|j' : ''), justify);
        const flood = easeInOut(this.flood);
        L.lines.forEach((ln, li) => {
          const clip = inFn(li, ln);
          if (!clip) return;
          g.font = ln.font;
          const capH = ln.capH, padX = capH * 0.12;
          const padT = ln.gapAbove * 0.42, padB = ln.gapBelow * 0.42;
          g.save();
          g.beginPath(); g.rect(clip[0], ln.baseline - capH - padT - 2, clip[1] - clip[0], capH + padT + padB + 4); g.clip();
          ln.segs.forEach((sg) => {
            if (sg.accent && flood > 0.002) {
              const fx0 = sg.x0 - padX, fx1 = lerp(fx0, sg.x1 + padX, flood);
              g.fillStyle = pal.acc;
              g.fillRect(fx0, ln.baseline - capH - padT, fx1 - fx0, capH + padT + padB);
              g.fillStyle = pal.acc;
              g.fillText(sg.text, sg.x0, ln.baseline);
              g.save(); g.beginPath(); g.rect(fx0, ln.baseline - capH - padT - 1, fx1 - fx0, capH + padT + padB + 2); g.clip();
              g.fillStyle = pal.knock; g.fillText(sg.text, sg.x0, ln.baseline);
              g.restore();
            } else {
              g.fillStyle = sg.accent ? pal.acc : pal.fg;
              g.fillText(sg.text, sg.x0, ln.baseline);
            }
          });
          g.restore();
          // The paste's leading edge: a bar of accent riding the wipe.
          if (clip[2] != null && clip[2] > 0 && clip[2] < 1) {
            g.fillStyle = pal.acc;
            const bw = capH * 0.09;
            g.fillRect(clip[1] - bw, ln.baseline - capH - padT * 0.5, bw, capH + (padT + padB) * 0.5);
          }
        });
        return L;
      };
      if (this.prevSheet) {
        const P = this.prevSheet;
        let alive = false;
        drawSheet(P.i, (li, ln) => {
          const v = easeInOut((t - P.end - li * 0.1) / 0.35);
          if (v >= 1) return null;
          alive = true;
          const x0 = ln.x0 - 20, x1 = ln.x1 + 30;
          return [lerp(x0, x1, v), x1 + 2];
        });
        if (!alive) this.prevSheet = null;
      }
      const L = drawSheet(this.sheet.i, (li, ln) => {
        const u = easeOut((t - this.sheet.start - li * 0.22) / 0.5);
        if (u <= 0) return null;
        const x0 = ln.x0 - 20, x1 = ln.x1 + 30;
        return [x0, lerp(x0, x1, u), u];
      });

      // --- Snare: the pointing rule under one word.
      if (L.words.length && t - this.ptr.at < 3.5 && t > this.sheet.start + 0.8) {
        const nW = L.words.length;
        const to = L.words[((this.ptr.to % nW) + nW) % nW];
        const from = this.ptr.from < 0 ? to : L.words[((this.ptr.from % nW) + nW) % nW];
        const u = easeOut((t - this.ptr.at) / 0.12);
        const x0 = lerp(from.x0, to.x0, u), x1 = lerp(from.x1, to.x1, u), bl = lerp(from.baseline, to.baseline, u);
        const gap = lerp(from.gap, to.gap, u);
        const th = clamp(gap * 0.3, 3, S * 0.018) * (0.6 + 0.4 * clamp(R, 0, 1.5));
        const a = clamp((0.75 + 0.25 * Math.exp(-(t - this.ptr.at) / 0.45)) * (1 - smooth(2.5, 3.5, t - this.ptr.at)), 0, 1);
        g.globalAlpha = a;
        g.fillStyle = pal.acc;
        g.fillRect(x0, bl + gap * 0.3 - th * 0.5, x1 - x0, th);
        g.globalAlpha = 1;
      }

      // --- The crowd.
      if (rows) {
        const drive = params.march * (20 + 60 * this.bassEnv + 26 * this.dropPres) * (S / 600);
        for (let k = 0; k < rows; k++) this.march[k] += dt * drive * rowDefs[k].speed;
        const ck = crowdFam + '|' + f.toFixed(2) + '|' + rows;
        if (this.crowdKey !== ck) {
          this.crowdKey = ck;
          this.rowGeo = rowDefs.map((rd, k) => {
            g.font = '700 ' + rd.size.toFixed(2) + 'px ' + crowdFam;
            const gapW = rd.size * 0.38;
            const cum = [], wid = [];
            let x = 0;
            this.rowWords[k].forEach((wd) => { const w = g.measureText(wd).width; cum.push(x); wid.push(w); x += w + gapW; });
            return { cum, wid, total: x };
          });
        }
        // Where the crowd jumps: each kick picks a spot along the crowd.
        const hopAt = this.hops.map((h) => {
          const a = t - h.t;
          const env = a < 0.05 ? smooth(0, 0.05, a) : Math.exp(-(a - 0.05) / 0.17);
          return { cx: m + 60 * (S / 600) + h.u * (W - 2 * m - 120 * (S / 600)), env };
        });
        const sigma = lerp(85, 120, this.dropPres) * (S / 600);
        const hopOf = (xc) => {
          let hsum = 0;
          for (let i = 0; i < hopAt.length; i++) { const d = (xc - hopAt[i].cx) / sigma; hsum += hopAt[i].env * Math.exp(-d * d); }
          return Math.min(1, hsum);
        };
        const sparkOf = (k, j) => {
          for (let i = 0; i < this.sparks.length; i++) { const sp = this.sparks[i]; if (sp.row === k && sp.j === j) return 1 - (t - sp.t) / 0.22; }
          return 0;
        };
        const drawRow = (k) => {
          const rd = rowDefs[k], geo = this.rowGeo[k];
          g.font = '700 ' + rd.size.toFixed(2) + 'px ' + crowdFam;
          const base = mixRgb(bgR, fgR, rd.shade * lerp(0.5, 1, this.life));
          const amp = rd.size * 0.62 * R;
          for (let j = 0; j < geo.cum.length; j++) {
            let x = (geo.cum[j] + this.march[k]) % geo.total - 220 * (S / 600);
            if (x > W + 10 || x + geo.wid[j] < -10) continue;
            const h = hopOf(x + geo.wid[j] * 0.5) * Math.min(1, R + 0.2);
            const sp = sparkOf(k, j);
            let col = mixRgb(base, fgR, h * 0.85);
            if (sp > 0) col = mixRgb(col, accR, sp);
            g.fillStyle = css(col);
            // The march is a walk: every word steps up and down on its own
            // foot, phased by how far the row has travelled, so the crowd's
            // gait follows its pace rather than the clock.
            const gait = Math.abs(Math.sin(this.march[k] / (rd.size * 1.1) + j * 1.9)) * rd.size * 0.07;
            g.fillText(this.rowWords[k][j], x, rd.base - h * amp - gait);
          }
        };
        const front = rows - 1;
        for (let k = 0; k < front; k++) drawRow(k);
        // Placards rise out of the crowd in the drop, held just above the
        // back rows, clipped so they come up from inside the crowd.
        if (this.dropPres > 0.01) {
          const rd = rowDefs[front], geo = this.rowGeo[front];
          const pf = placardH * 0.56;
          const clipY = rd.base - capC * rd.size;
          g.save();
          g.beginPath(); g.rect(-10, -10, W + 20, clipY + 10); g.clip();
          g.font = '400 ' + pf.toFixed(2) + 'px ' + archivo;
          for (let j = 1; j < geo.cum.length; j += 3) {
            const x = (geo.cum[j] + this.march[front]) % geo.total - 220 * (S / 600);
            if (x > W + 60 || x + geo.wid[j] < -60) continue;
            const stag = ((j * 7) % 5) / 5;
            const raise = easeOut(clamp(this.dropPres * 1.6 - stag * 0.5, 0, 1));
            if (raise < 0.01) continue;
            const xc = x + geo.wid[j] * 0.5;
            const h = hopOf(xc) * Math.min(1, R + 0.2);
            const txt = PLACARDS[Math.floor(j / 3) % PLACARDS.length];
            const tw = g.measureText(txt).width;
            const pw = tw + pf * 0.9, ph = placardH;
            const bottom = clipY - stick * 0.3 + (1 - raise) * (ph + stick) - h * rd.size * 0.5 * R;
            const sway = Math.sin(t * 1.1 + j * 1.7) * 0.035;
            g.save();
            g.translate(xc, bottom);
            g.rotate(sway);
            g.fillStyle = css(mixRgb(bgR, fgR, 0.75));
            g.fillRect(-S * 0.003, 0, S * 0.006, stick * 1.5);
            const isAcc = (Math.floor(j / 3) % 3) !== 1;
            g.fillStyle = isAcc ? pal.acc : pal.fg;
            g.fillRect(-pw / 2, -ph, pw, ph);
            g.fillStyle = isAcc ? pal.knock : pal.bg;
            g.fillText(txt, -tw / 2, -ph * 0.5 + pf * 0.36);
            g.restore();
          }
          g.restore();
        }
        drawRow(front);
      }

      // --- Address line and top rule.
      g.font = '400 ' + addrSize.toFixed(2) + 'px ' + archivo;
      g.fillStyle = pal.fg;
      g.fillText(String(params.address || '').toUpperCase(), m, addrBase);
      {
        const tag = 'TONIGHT';
        const tw = g.measureText(tag).width;
        const pad = addrSize * 0.35;
        g.fillStyle = pal.acc;
        g.fillRect(W - m - tw - 2 * pad, addrBase - addrSize * 0.72 - pad, tw + 2 * pad, addrSize * 0.72 + 2 * pad);
        g.fillStyle = pal.tag;
        g.fillText(tag, W - m - tw - pad, addrBase);
      }
      g.fillStyle = pal.fg;
      g.fillRect(m, topRule, W - 2 * m, Math.max(2, S * 0.006));

      // --- Small print.
      {
        const parts = String(params.footer || '').split('|');
        const body = (parts[0] || '').trim(), sign = (parts[1] || '').trim().toUpperCase();
        g.fillStyle = pal.fg;
        g.fillRect(m, footRule, W - 2 * m, Math.max(1, S * 0.0025));
        g.font = '400 ' + (bodySize * 0.95).toFixed(2) + 'px ' + archivo;
        const sw = sign ? g.measureText(sign).width : 0;
        if (sign) { g.fillStyle = pal.acc; g.fillText(sign, W - m - sw, footBase); }
        let bs = bodySize;
        g.font = '400 ' + bs.toFixed(2) + 'px ' + bodyFam;
        const avail = W - 2 * m - sw - bodySize * 1.5;
        const bw = g.measureText(body).width;
        if (bw > avail) { bs = Math.max(7, bs * avail / bw); g.font = '400 ' + bs.toFixed(2) + 'px ' + bodyFam; }
        g.fillStyle = css(mixRgb(bgR, fgR, 0.85));
        g.fillText(body, m, footBase);
      }

      // --- Print texture over everything.
      this.makeTexture(p, mode);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.drawImage(this.tex, 0, 0);
      g.restore();

      g.restore();
    },
  });
})();
