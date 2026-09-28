// Letterpress: a two-colour broadside for a night of dancing, printed from
// wood and metal type on thick cotton stock. The sheet is lit by one low lamp
// that slowly circles the press, so every impression's walls catch light on
// one side and throw shadow on the other, and the shadows sweep round as the
// lamp travels.
//
// Music, each in its own place:
//   hats   the compositor sets the next sort: letters arrive one at a time as
//          blind impressions (pressed but uninked), so the forme builds itself
//          line by line in the paper
//   kick   the platen presses one line: ink lands in that line only, the
//          impression deepens for a moment and the fresh ink is wet and glossy
//          before it dries back; when every line is printed the kicks re-strike
//          the lines in turn, each hit squeezing a little more ink
//   snare  a red ornament in the fleuron row is stamped, the older stamps
//          fading back, so the row chases on the backbeat
//   bass   ink squeeze at the letter edges and the red plate's wander
//   drop   a new sheet is fed in that already carries its red run: a giant
//          wood-type showpiece glyph, a red line, a red border; the layout is
//          bolder and the type sets at speed. The breakdown feeds a blank sheet
//          and the whole forme appears only as blind embossing.
// Two inks multiply onto the paper (red under black, as a second run over a
// dried first run does), the red plate sits out of register, solids are salty
// where the paper did not take ink, and ink squeezes past every edge. No glow.

(function () {
  const PAPERS = [
    { name: 'Cotton white', paper: '#EEEAE1', fleck: [120, 110, 96], bed: '#262320' },
    { name: 'Cream', paper: '#ECE1C9', fleck: [128, 104, 70], bed: '#28221B' },
    { name: 'Grey board', paper: '#D2CEC6', fleck: [80, 78, 74], bed: '#1E1E1F' },
    { name: 'Blush', paper: '#EFDCD2', fleck: [130, 96, 86], bed: '#271F1E' },
  ];
  const INKS = [
    { name: 'Black & vermilion', k: '#1C1A1B', r: '#D8412A' },
    { name: 'Navy & tomato', k: '#1D2946', r: '#E3573B' },
    { name: 'Black & fluoro pink', k: '#1B191C', r: '#EB4F8D' },
    { name: 'Forest & ochre', k: '#1F3A2F', r: '#D5932A' },
  ];
  const PRESS = ['Two colours', 'Blind only', 'Heavy ink'];

  // Faces: [weight, style, family, fallback]. Every family is in web/fonts.js.
  const FACES = {
    alfa: ['400', 'normal', 'Alfa Slab One', 'Georgia, serif'],
    abril: ['400', 'normal', 'Abril Fatface', 'Georgia, serif'],
    anton: ['400', 'normal', 'Anton', 'Impact, sans-serif'],
    bebas: ['400', 'normal', 'Bebas Neue', 'Impact, sans-serif'],
    rye: ['400', 'normal', 'Rye', 'Georgia, serif'],
    osw: ['700', 'normal', 'Oswald', '"Arial Narrow", sans-serif'],
    oswl: ['400', 'normal', 'Oswald', '"Arial Narrow", sans-serif'],
    lb: ['400', 'normal', 'Libre Baskerville', 'Georgia, serif'],
    lbi: ['400', 'italic', 'Libre Baskerville', 'Georgia, serif'],
    pfi: ['700', 'italic', 'Playfair Display', 'Georgia, serif'],
    pf9: ['900', 'normal', 'Playfair Display', 'Georgia, serif'],
  };
  const fontCss = (key, px) => { const f = FACES[key]; return f[1] + ' ' + f[0] + ' ' + px.toFixed(2) + 'px "' + f[2] + '", ' + f[3]; };
  const faceSpec = (key) => { const f = FACES[key]; return f[1] + ' ' + f[0] + ' 40px "' + f[2] + '"'; };

  // Sheets. H is the headline word from the Words control. `pre` lines come
  // already printed in red (the first run of a two-colour job), kick lines
  // are black, `r` lines without `pre` stay blind on calm sheets.
  const CALM = [
    [
      { k: 'text', s: 'AN EVENING OF', f: 'lb', cap: 0.045, track: 0.34 },
      { k: 'rule', style: 'thinthick', w: 0.42 },
      { k: 'text', s: '$H', f: 'alfa', cap: 0.3, fill: true },
      { k: 'text', s: 'music for the small hours', f: 'pfi', cap: 0.075, p: 'r' },
      { k: 'orn', n: 9, cap: 0.035 },
      { k: 'text', s: 'SLOW LIGHTS · DEEP BASS · AN OPEN FLOOR', f: 'osw', cap: 0.055, fill: true },
      { k: 'text', s: 'Doors at dusk. Dancing until the candles give out.', f: 'lb', cap: 0.03 },
      { k: 'rule', style: 'thin', w: 0.22 },
      { k: 'text', s: 'SET BY HAND · PRINTED ON THE BEAT', f: 'oswl', cap: 0.024, track: 0.3, p: 'r' },
    ],
    [
      { k: 'text', s: 'YOU ARE WARMLY INVITED', f: 'lb', cap: 0.04, track: 0.28 },
      { k: 'text', s: 'to the', f: 'lbi', cap: 0.045 },
      { k: 'text', s: '$H', f: 'pf9', cap: 0.27, fill: true },
      { k: 'text', s: 'a night of records & slow light', f: 'pfi', cap: 0.065, p: 'r' },
      { k: 'rule', style: 'double', w: 0.6 },
      { k: 'text', s: 'THE LAMPS STAY LOW · THE NEEDLE STAYS DOWN', f: 'osw', cap: 0.05, fill: true },
      { k: 'orn', n: 5, cap: 0.04 },
      { k: 'text', s: 'Come late, stay later, bring someone to dance with', f: 'lbi', cap: 0.032 },
    ],
    [
      { k: 'text', s: 'THIS SATURDAY', f: 'bebas', cap: 0.085, fill: true, track: 0.08 },
      { k: 'text', s: '$H', f: 'rye', cap: 0.25, fill: true },
      { k: 'text', s: '& ALL NIGHT LONG', f: 'abril', cap: 0.12, fill: true, p: 'r' },
      { k: 'rule', style: 'thick', w: 1 },
      { k: 'text', s: 'NO SPEECHES · NO SLEEP · JUST THE BEAT', f: 'osw', cap: 0.05, fill: true },
      { k: 'orn', n: 7, cap: 0.035 },
      { k: 'text', s: 'Admit the whole room', f: 'lbi', cap: 0.04 },
    ],
  ];
  const DROP = [
    {
      giant: { ch: '&', f: 'abril', size: 1.2, x: 0.5, y: 0.53 },
      lines: [
        { k: 'text', s: 'EVERYBODY', f: 'anton', cap: 0.19, fill: true, track: 0.04 },
        { k: 'text', s: '$H', f: 'alfa', cap: 0.33, fill: true },
        { k: 'text', s: 'ON THE FLOOR', f: 'bebas', cap: 0.16, fill: true, track: 0.06 },
        { k: 'orn', n: 11, cap: 0.04 },
        { k: 'text', s: 'THE BASS IS DEEP · THE NIGHT IS LONG', f: 'osw', cap: 0.05, fill: true, p: 'r', pre: true },
      ],
    },
    {
      giant: { ch: '!', f: 'alfa', size: 1.25, x: 0.5, y: 0.56 },
      lines: [
        { k: 'text', s: 'TURN IT', f: 'anton', cap: 0.15, fill: true, track: 0.05, p: 'r', pre: true },
        { k: 'text', s: '$H', f: 'abril', cap: 0.33, fill: true },
        { k: 'text', s: 'UP  UP  UP', f: 'alfa', cap: 0.15, fill: true },
        { k: 'orn', n: 9, cap: 0.04 },
        { k: 'text', s: 'EVERY BODY · EVERY BEAT · UNTIL THE LIGHT COMES', f: 'osw', cap: 0.045, fill: true },
      ],
    },
    {
      giant: { ch: '*', f: 'alfa', size: 1.5, x: 0.5, y: 0.78 },
      lines: [
        { k: 'text', s: 'HANDS UP FOR', f: 'bebas', cap: 0.15, fill: true, track: 0.05 },
        { k: 'text', s: '$H', f: 'rye', cap: 0.3, fill: true },
        { k: 'text', s: 'THE LAST RECORD', f: 'anton', cap: 0.14, fill: true, p: 'r', pre: true },
        { k: 'orn', n: 7, cap: 0.04 },
        { k: 'text', s: 'DANCE LIKE THE LAMPS ARE OUT', f: 'osw', cap: 0.05, fill: true },
      ],
    },
  ];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

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

  // A printer's ornament: an eight-pointed star, or a small lozenge between.
  function ornPath(cx, cy, r, star) {
    const pth = new Path2D();
    if (star) {
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 8, rr = i % 2 ? r * 0.42 : r;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i) pth.lineTo(x, y); else pth.moveTo(x, y);
      }
      pth.closePath();
      pth.moveTo(cx + r * 0.16, cy); pth.arc(cx, cy, r * 0.16, 0, Math.PI * 2, true);
    } else {
      pth.moveTo(cx, cy - r * 0.5); pth.lineTo(cx + r * 0.32, cy); pth.lineTo(cx, cy + r * 0.5); pth.lineTo(cx - r * 0.32, cy); pth.closePath();
    }
    return pth;
  }

  VIZ.register({
    id: 'letterpress',
    name: 'Letterpress',
    order: 510,

    params: [
      { key: 'words', label: 'Headline words (/ between)', type: 'text', default: 'NIGHT / DANCE / LOUD / SWAY / TOGETHER / BASS' },
      { key: 'press', label: 'Press', type: 'select', options: PRESS, default: 0 },
      { key: 'depth', label: 'Impression depth', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'lamp', label: 'Lamp speed', type: 'range', min: 0, max: 4, default: 1, step: 0.01 },
      { key: 'register', label: 'Misregistration', type: 'range', min: 0, max: 4, default: 1, step: 0.01 },
      { key: 'ink', label: 'Inks', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'paper', label: 'Paper', type: 'select', options: PAPERS.map((s) => s.name), default: 0 },
    ],

    actions: [
      { id: 'fresh', label: 'Feed a fresh sheet', run() { this.wantFresh = true; } },
    ],

    gallery: {
      title: 'Letterpress',
      technique: 'Canvas 2D with four device-pixel layers: impression walls computed per line as the glyph minus itself shifted away from a moving point lamp (shadow) and toward it (highlight), two ink layers with edge squeeze and a salty wear mask multiplied onto a generated cotton-paper texture, the red run offset out of register; type set glyph by glyph in Web Fonts from web/fonts.js, each line fitted to the measure as on a wood-type broadside; onset detection per band',
      brief: 'A two-colour letterpress broadside for a night of dancing on thick cotton stock, lit by one low lamp that circles the press so the deep impressions throw shadows that slowly sweep round. The hats set the type: sorts arrive one at a time as blind impressions and the forme builds itself line by line in the paper. Each kick is the platen: one line takes ink, sinks a little deeper and shines wet for a moment, and when the sheet is fully printed the kicks re-strike the lines in turn. Each snare stamps the next red fleuron in the ornament row. The drop feeds a sheet that already carries its red run (a giant showpiece ampersand, exclamation or asterisk, a red line and border) with a bolder wood-type layout set at speed; the breakdown feeds a blank sheet and leaves only blind embossing, white on white.',
      lineage: [
        'Nineteenth-century wood-type broadsides (every line chosen and spaced to fill the measure, faces mixed freely, fleuron rows and thick-thin rules) and today\'s deep-impression letterpress stationery on soft cotton stock, where the bite of the type into the paper is the point and blind (uninked) impressions are a technique of their own; the batch-05 "Letterpress stationery" entry. Faces from web/fonts.js: Alfa Slab One, Abril Fatface, Rye, Anton and Bebas Neue as the wood type, Playfair Display and Libre Baskerville (with their italics, requested in setup) as the metal type, Oswald for the small gothic lines. All wording original.',
        'Built as a press run: the compositor sets sorts in reading order (hats add sorts), set sorts show only as impressions, each kick inks the first line waiting, and a finished sheet is re-struck line by line until it is fed out to the left and a fresh sheet follows. Drop sheets arrive carrying their first (red) run already printed, which is how a two-colour job is actually printed and lets the drop land as a whole bolder sheet rather than a flash. Impressions are lit by a point lamp circling the bed: per line, the glyph minus itself shifted away from the lamp gives the shadowed wall and the opposite shift the lit wall, in two half-steps for a soft edge.',
        'Process: first render read as letterpress straight away (blind NIGHT in the build, the red ampersand under DANCE in the drop), but the paper mottling was blotchy enough to read as stains and the ink carried visible horizontal streaks, the red line in the second drop sheet was hidden behind the giant exclamation mark, and the breakdown sheet set so slowly it looked empty. Mottle and roller streaks were cut to a third, the red and black lines of that sheet swapped, the calm setting rate doubled. The jolt heat map showed drop kicks landing mostly on re-strikes of an already printed sheet, which moved little, so a re-strike now slurs: a ghost of the line a few points off that the paper drinks in 0.2 s.',
        'Jolt at 640x360: calm, kickArea 0.11, ratio 2.9 (build kick area 0.04, ratio 4.1); each kick lights one line and nothing else. Sections from a slow follower of band 1 with hysteresis, as in Constructivist.',
      ].join(' '),
    },

    setup(p, ctx) {
      this.init();
      // fonts.js asks for the upright faces only; ask for the italics too.
      if (document.fonts && document.fonts.load) {
        Object.keys(FACES).forEach((k) => { document.fonts.load(faceSpec(k)).catch(() => {}); });
      }
    },
    enter(p, ctx) { if (!this.sheets) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickTimes = [];
      this.low = 0; this.dense = false;
      this.bassEnv = 0; this.energy = 0;
      this.lampA = 3.6; this.drift = 0; this.wander = 0;
      this.sheets = null; this.swapAt = -10; this.old = null;
      this.calmIdx = 0; this.dropIdx = 0; this.headIdx = 0;
      this.paperKey = ''; this.fontKey = ''; this.fontCheckAt = -1;
      this.wantFresh = false; this.hatSets = 0;
      this.measure = document.createElement('canvas').getContext('2d');
    },

    headWord(params) {
      const list = String(params.words || '').split('/').map((w) => w.trim()).filter(Boolean);
      const w = list.length ? list[this.headIdx % list.length] : 'NIGHT';
      this.headIdx++;
      return w;
    },

    makeSheet(drop, params, W, H, u, t) {
      let spec;
      if (drop) { spec = DROP[this.dropIdx % DROP.length]; this.dropIdx++; }
      else { spec = { lines: CALM[this.calmIdx % CALM.length] }; this.calmIdx++; }
      const head = this.headWord(params);
      const sheet = {
        drop, giant: spec.giant || null, born: t,
        spec: spec.lines.map((l) => ({ ...l, s: l.s === '$H' ? head : l.s })),
        lines: null, setLine: 0, setUnit: 0, setAcc: 0,
        idleKicks: 0, completeAt: -1, restrike: 0,
        seed: Math.floor(this.rng() * 1e9),
      };
      this.layout(sheet, W, H, u);
      return sheet;
    },

    // Lays a sheet out in its own coordinates (0..W, 0..H). Each text line is
    // fitted to the measure the way a broadside's wood type is chosen to fill
    // the line, capped so short words do not grow without limit. Relayout
    // keeps each unit's set and ink state.
    layout(sheet, W, H, u) {
      const g = this.measure;
      const r = mulberry(sheet.seed);
      const old = sheet.lines;
      const drop = sheet.drop;
      const measure = Math.min(W - 170 * u, drop ? 900 * u : 800 * u);
      const top = 62 * u, contentH = H - 2 * top;
      const cx = W / 2;
      const rows = [];
      const fit = (l, scale) => {
        const n = Array.from(l.s).length;
        const tr = l.track || 0;
        g.font = fontCss(l.f, 100);
        const m = g.measureText(l.s);
        const w100 = m.width + tr * 100 * (n - 1);
        let size = (l.cap * contentH / 0.72) * scale;
        if (l.fill || w100 * size / 100 > measure) size = Math.min(size, measure / w100 * 100);
        const asc = m.actualBoundingBoxAscent * size / 100, desc = m.actualBoundingBoxDescent * size / 100;
        return { size, asc, desc, w: w100 * size / 100 };
      };
      const measureRows = (scale) => {
        let sum = 0;
        const out = sheet.spec.map((l) => {
          let h;
          if (l.k === 'text') { const f = fit(l, scale); h = f.asc + f.desc; return { l, f, h }; }
          if (l.k === 'rule') { h = ({ thin: 1.6, thick: 7, thinthick: 11, double: 6.5 })[l.style] * u; return { l, h }; }
          h = l.cap * contentH * 1.6 * scale; return { l, h };
        });
        out.forEach((o) => { sum += o.h; });
        return { out, sum };
      };
      const gapBase = contentH * (drop ? 0.03 : 0.04);
      let scale = 1, m = measureRows(1);
      const gaps = gapBase * (sheet.spec.length - 1);
      if (m.sum + gaps > contentH) { scale = (contentH - gaps) / m.sum; m = measureRows(scale); }
      const gap = Math.min(gapBase * 1.8, (contentH - m.sum) / Math.max(1, sheet.spec.length - 1));
      let y = top + (contentH - m.sum - gap * (sheet.spec.length - 1)) / 2;
      const lines = [];
      // The border is the first thing in the forme: a heavy rule, a hairline
      // inside it, and a corner piece at each corner.
      {
        const a = 20 * u, b = 30 * u, th = 5 * u, hl = 1.4 * u;
        const ring = (x0, y0, x1, y1, w) => {
          const pth = new Path2D();
          pth.rect(x0, y0, x1 - x0, y1 - y0);
          pth.rect(x0 + w, y0 + w, x1 - x0 - 2 * w, y1 - y0 - 2 * w);
          return pth;
        };
        const units = [
          { path: ring(a, a, W - a, H - a, th) },
          { path: ring(a + th + b - a, a + th + b - a, W - a - th - (b - a), H - a - th - (b - a), hl) },
        ];
        const cs = 9 * u, ci = a + th + (b - a) + hl + 6 * u;
        [[ci, ci], [W - ci, ci], [ci, H - ci], [W - ci, H - ci]].forEach(([x, yy]) => {
          units.push({ path: ornPath(x, yy, cs, true) });
        });
        lines.push({ k: 'border', p: drop ? 'r' : 'k', pre: drop, units, cx: W / 2, cy: H / 2, tilt: 0 });
      }
      if (sheet.giant) {
        const gi = sheet.giant;
        const size = H * gi.size;
        g.font = fontCss(gi.f, size);
        const gm = g.measureText(gi.ch);
        const gy = H * gi.y + (gm.actualBoundingBoxAscent - gm.actualBoundingBoxDescent) / 2;
        lines.push({
          k: 'giant', p: 'r', pre: true, font: fontCss(gi.f, size), cx: W * gi.x, cy: H * gi.y, tilt: (r() - 0.5) * 0.02,
          units: [{ ch: gi.ch, x: W * gi.x - gm.width / 2, y: gy }],
        });
      }
      m.out.forEach((o) => {
        const l = o.l;
        const line = { k: l.k, p: l.p || 'k', pre: !!l.pre, units: [], cx, cy: y + o.h / 2, tilt: (r() - 0.5) * 0.007 };
        if (l.k === 'text') {
          const f = o.f;
          line.font = fontCss(l.f, f.size);
          g.font = line.font;
          const chars = Array.from(l.s);
          const x0 = cx - f.w / 2;
          const base = y + f.asc;
          let prefix = '';
          chars.forEach((ch, i) => {
            const x = x0 + g.measureText(prefix).width + (l.track || 0) * f.size * i;
            prefix += ch;
            if (ch === ' ') return;
            line.units.push({ ch, x, y: base + (r() - 0.5) * f.size * 0.014 });
          });
        } else if (l.k === 'rule') {
          const w = measure * l.w, x0 = cx - w / 2;
          const add = (yy, hh) => { const pth = new Path2D(); pth.rect(x0, yy, w, hh); line.units.push({ path: pth }); };
          if (l.style === 'thin') add(y, 1.6 * u);
          else if (l.style === 'thick') add(y, 7 * u);
          else if (l.style === 'thinthick') { add(y, 7 * u); add(y + 9.4 * u, 1.6 * u); }
          else { add(y, 1.6 * u); add(y + 4.9 * u, 1.6 * u); }
        } else {
          const rad = l.cap * contentH * 0.8 * scale, step = rad * 3.2;
          const n = l.n, x0 = cx - (n - 1) * step / 2;
          line.k = 'orn'; line.p = 'o';
          for (let i = 0; i < n; i++) {
            const star = i % 2 === 0;
            line.units.push({ path: ornPath(x0 + i * step, y + o.h / 2, star ? rad : rad * 0.9, star), star });
          }
        }
        lines.push(line);
        y += o.h + gap;
      });
      lines.forEach((line, li) => {
        line.pressAt = -10; line.squeeze = 0; line.deep = 0; line.slurAt = -10; line.slurX = 1; line.slurY = 0;
        line.units.forEach((un, ui) => {
          const prev = old && old[li] && old[li].units[ui];
          un.setAt = prev ? prev.setAt : line.pre ? -10 : Infinity;
          un.inkAt = prev ? prev.inkAt : line.pre ? -10 : Infinity;
        });
        if (old && old[li]) { line.slurAt = old[li].slurAt; line.slurX = old[li].slurX; line.slurY = old[li].slurY; line.pressAt = old[li].pressAt; line.squeeze = old[li].squeeze; line.deep = old[li].deep; }
      });
      sheet.lines = lines;
      sheet.W = W; sheet.H = H;
    },

    // The compositor: sets the next sort in reading order.
    setNext(sheet, t) {
      const L = sheet.lines;
      while (sheet.setLine < L.length) {
        const line = L[sheet.setLine];
        if (line.pre || sheet.setUnit >= line.units.length) { sheet.setLine++; sheet.setUnit = 0; continue; }
        line.units[sheet.setUnit].setAt = t;
        sheet.setUnit++;
        return true;
      }
      return false;
    },

    allSet(sheet) { return sheet.setLine >= sheet.lines.length; },
    kickable(line, params) { return (line.p === 'k') && !line.pre; },

    // The platen: ink every set, uninked sort in the first line that has
    // any; if there are none, re-strike the next printed line.
    press(sheet, t, params) {
      const blind = Math.round(params.press) === 1;
      for (const line of sheet.lines) {
        if (!this.kickable(line, params)) continue;
        let hit = false;
        for (const un of line.units) {
          if (un.setAt <= t && un.inkAt === Infinity) { if (!blind) un.inkAt = t; else un.inkAt = -Infinity; hit = true; }
        }
        if (hit) { line.pressAt = t; line.deep = Math.min(1, line.deep + (blind ? 0.5 : 0.2)); return; }
      }
      // Nothing waiting: the forme is printed (or not yet set). Re-strike.
      const done = sheet.lines.filter((l) => this.kickable(l, params) && l.units.length && l.units[0].setAt <= t);
      if (done.length) {
        const line = done[sheet.restrike % done.length];
        sheet.restrike++;
        line.pressAt = t;
        // A re-strike slurs: the sheet creeps on the platen and the second
        // hit lands a few points off, a ghost that the paper then drinks.
        const a = this.rng() * Math.PI * 2;
        line.slurAt = t; line.slurX = Math.cos(a); line.slurY = Math.sin(a) * 0.6;
        line.squeeze = Math.min(1, line.squeeze + 0.2);
        line.deep = Math.min(1, line.deep + 0.12);
      }
      if (this.allSet(sheet)) sheet.idleKicks++;
    },

    stamp(sheet, t) {
      const orn = sheet.lines.filter((l) => l.k === 'orn');
      if (!orn.length) return;
      const line = orn[0];
      line.stampPtr = ((line.stampPtr || 0) + 1) % line.units.length;
      const un = line.units[line.stampPtr];
      if (un.setAt > t) un.setAt = t;
      un.inkAt = t;
      line.pressAt = t;
    },

    analyse(s, t, dt, params) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      const sheet = this.sheets[this.sheets.length - 1];
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t;
        this.kickTimes.push(t); if (this.kickTimes.length > 9) this.kickTimes.shift();
        this.press(sheet, t, params);
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.14) {
        this.lastSnare = t; this.stamp(sheet, t);
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) {
        this.lastHat = t; this.hatSets++;
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.5));
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
    },

    // Paper and ink-wear textures, generated once per canvas size in device
    // pixels. The paper is a heavy cotton: soft mottling, fibres, specks.
    makeTextures(p, stock) {
      const w = p.width * p.pixelDensity(), h = p.height * p.pixelDensity();
      const key = w + 'x' + h + ':' + stock.name;
      if (this.paperKey === key) return;
      this.paperKey = key;
      const mk = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
      const r = mulberry(11);
      const sc = Math.min(w, h) / 600;
      const paper = mk();
      const g = paper.getContext('2d');
      g.fillStyle = stock.paper; g.fillRect(0, 0, w, h);
      // Mottling at 1/16 scale, smoothed up (a canvas blur filter is far
      // slower in the harness's software rasteriser).
      const lw = Math.max(8, Math.round(w / 16)), lh = Math.max(8, Math.round(h / 16));
      const lo = document.createElement('canvas'); lo.width = lw; lo.height = lh;
      const lg = lo.getContext('2d');
      for (let i = 0; i < 360; i++) {
        const rad = (20 + r() * 90) * sc / 16;
        lg.fillStyle = r() < 0.5 ? 'rgba(80,66,44,0.014)' : 'rgba(255,252,244,0.03)';
        lg.beginPath(); lg.ellipse(r() * lw, r() * lh, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); lg.fill();
      }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(lo, 0, 0, w, h);
      const f = stock.fleck;
      const rgba = (a) => 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',' + a.toFixed(3) + ')';
      // Cotton tooth: a dense field of tiny light and dark grains.
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = r() < 0.5 ? rgba(0.05 + r() * 0.06) : 'rgba(255,255,250,' + (0.08 + r() * 0.1).toFixed(3) + ')';
        const s = Math.max(1, sc * (0.4 + r() * 0.9));
        g.fillRect(r() * w, r() * h, s, s);
      }
      g.lineWidth = Math.max(0.6, 0.45 * sc);
      for (let i = 0; i < 1100; i++) {
        const x = r() * w, y = r() * h, a = r() * Math.PI, l = (2 + r() * 8) * sc;
        g.strokeStyle = rgba(0.06 + r() * 0.12);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      // Wear, applied to the ink layers: paper that did not take ink. Salty
      // specks everywhere, and faint roller streaks running across the sheet.
      const wear = mk();
      const q = wear.getContext('2d');
      q.fillStyle = '#000';
      for (let i = 0; i < 16000; i++) {
        q.globalAlpha = 0.2 + r() * 0.7;
        const s = sc * (0.35 + r() * r() * 1.8);
        q.fillRect(r() * w, r() * h, s, s);
      }
      q.globalAlpha = 0.035;
      for (let i = 0; i < 30; i++) {
        const y = r() * h, hh = sc * (6 + r() * 30);
        q.fillRect(0, y, w, hh);
      }
      q.globalAlpha = 1;
      this.paper = paper; this.wear = wear;
      this.layers = [mk(), mk(), mk(), mk()];
      this.lctx = this.layers.map((cv) => cv.getContext('2d'));
    },

    draw(p, signals, params, ctx) {
      if (!this.sheets && !this.measure) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const u = S / 600;
      const stock = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];
      const ink = INKS[clamp(Math.round(params.ink), 0, INKS.length - 1)];
      const pressMode = clamp(Math.round(params.press), 0, 2);
      const react = params.reaction;
      const k = (tau) => 1 - Math.exp(-dt / tau);

      // Web fonts can arrive after the first layout; measure again when they do.
      if (t - this.fontCheckAt > 0.5 || this.fontCheckAt < 0) {
        this.fontCheckAt = t;
        const fk = document.fonts ? Object.keys(FACES).map((f) => (document.fonts.check(faceSpec(f)) ? 1 : 0)).join('') : '';
        if (fk !== this.fontKey) { this.fontKey = fk; if (this.sheets) this.sheets.forEach((s) => this.layout(s, W, H, u)); }
      }
      if (!this.sheets) this.sheets = [this.makeSheet(false, params, W, H, u, t)];
      this.sheets.forEach((s) => { if (s.W !== W || s.H !== H) this.layout(s, W, H, u); });
      let sheet = this.sheets[this.sheets.length - 1];

      this.analyse(signals, t, dt, params);

      // Sections: the drop's bass line holds `low` up; hysteresis so a quiet
      // bar does not pull the sheet.
      let feed = null;
      if (!this.dense && this.low > 27) { this.dense = true; feed = true; }
      else if (this.dense && this.low < 19) { this.dense = false; feed = false; }
      const swapping = t - this.swapAt < 1;
      if (feed === null && !swapping) {
        const complete = this.allSet(sheet) && !sheet.lines.some((l) => this.kickable(l, params) && l.units.some((un) => un.inkAt === Infinity));
        if (complete && sheet.completeAt < 0) sheet.completeAt = t;
        if (this.wantFresh) feed = this.dense;
        else if (complete && sheet.idleKicks >= 7) feed = this.dense;
        else if (complete && t - sheet.completeAt > 7 && t - this.lastKick > 2) feed = this.dense;
      }
      this.wantFresh = false;
      if (feed !== null && !swapping) {
        this.sheets = [sheet, this.makeSheet(feed && pressMode !== 1, params, W, H, u, t)];
        this.swapAt = t;
        sheet = this.sheets[1];
      }
      if (t - this.swapAt >= 1 && this.sheets.length > 1) this.sheets = [sheet];

      // The compositor: a steady hand, quicker with energy, one extra sort
      // for each hat; in the drop it keeps a line ahead of the platen.
      const rate = this.dense ? 26 : 6 + 14 * this.energy;
      sheet.setAcc += rate * dt + this.hatSets * (this.dense ? 0 : 1);
      this.hatSets = 0;
      while (sheet.setAcc >= 1) { sheet.setAcc -= 1; if (!this.setNext(sheet, t)) { sheet.setAcc = 0; break; } }

      // Continuous motion.
      this.lampA += dt * params.lamp * (0.05 + 0.08 * this.energy);
      this.drift += dt * (0.4 + 0.6 * this.energy);
      this.wander += dt * (0.3 + 1.2 * this.bassEnv);

      this.makeTextures(p, stock);
      const c = p.drawingContext;
      const T0 = c.getTransform();
      const z = 1.035 + 0.012 * Math.sin(this.drift * 0.07);
      const cdx = 14 * u * Math.sin(this.drift * 0.053), cdy = 9 * u * Math.sin(this.drift * 0.041 + 1);
      const cam = (g) => { g.setTransform(T0); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2 + cdx, -H / 2 + cdy); };
      const lampX = W / 2 + Math.cos(this.lampA) * W * 0.78, lampY = H / 2 + Math.sin(this.lampA) * H * 0.95;

      // Sheet positions: during a feed the printed sheet leaves left and the
      // fresh one follows it in from the right.
      const e = easeInOut(clamp((t - this.swapAt) / 1, 0, 1));
      const travel = W + 60 * u;
      const pos = this.sheets.length > 1 ? [-e * travel, (1 - e) * travel] : [0];

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = stock.bed; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      cam(c);
      this.sheets.forEach((s, i) => {
        const ox = pos[i];
        if (this.sheets.length > 1) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(ox + 7 * u, 9 * u, W, H); }
        c.drawImage(this.paper, ox, 0, W, H);
      });

      const [gS, gH, gK, gR] = this.lctx;
      const dw = c.canvas.width, dh = c.canvas.height;
      this.lctx.forEach((g) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, dw, dh);
        cam(g);
        g.lineJoin = 'round';
      });
      gS.fillStyle = '#5E5548'; gH.fillStyle = '#FFFFFF';
      gK.fillStyle = ink.k; gK.strokeStyle = ink.k; gR.fillStyle = ink.r; gR.strokeStyle = ink.r;

      const heavy = pressMode === 2, blind = pressMode === 1;
      const depthBase = 1.7 * u * params.depth;
      const spreadBase = (heavy ? 1.9 : 0.9) * u + 0.7 * u * this.bassEnv * react;

      const drawUnit = (g, un, dx, dy, stroke) => {
        if (un.ch !== undefined) { if (stroke) g.strokeText(un.ch, un.x + dx, un.y + dy); else g.fillText(un.ch, un.x + dx, un.y + dy); }
        else { g.save(); g.translate(dx, dy); if (stroke) g.stroke(un.path); else g.fill(un.path, 'evenodd'); g.restore(); }
      };

      this.sheets.forEach((s, si) => {
        const ox = pos[si];
        const lx = lampX - ox, ly = lampY;
        // The giant glyph first, so the black forme's walls sit on top of it.
        s.lines.forEach((line) => {
          const units = line.units;
          if (!units.length) return;
          const pulse = Math.exp(-(t - line.pressAt) / 0.14) * react;
          const depth = depthBase * (1 + 0.45 * line.deep + 0.9 * pulse) * (line.k === 'giant' ? 0.8 : 1);
          let vx = line.cx - lx, vy = line.cy - ly;
          const vl = Math.hypot(vx, vy) || 1;
          vx = vx / vl * depth; vy = vy / vl * depth;
          const plateCtx = line.p === 'k' ? gK : gR;
          const fresh = Math.exp(-(t - line.pressAt) / 0.45);
          const spread = spreadBase * (1 + 0.8 * line.squeeze) + 1.2 * u * pulse;
          [gS, gH, plateCtx].forEach((g) => {
            g.save();
            g.translate(ox + line.cx, line.cy); g.rotate(line.tilt); g.translate(-line.cx, -line.cy);
            if (line.font) g.font = line.font;
          });
          gK.lineWidth = spread; gR.lineWidth = spread;
          for (const un of units) {
            const sa = clamp((t - un.setAt) / 0.12, 0, 1);
            if (sa <= 0) continue;
            // Walls: the glyph minus itself shifted away from the lamp is the
            // wall nearest the lamp, in shadow; the other way is the lit wall.
            gS.globalCompositeOperation = 'source-over'; gS.globalAlpha = sa;
            drawUnit(gS, un, 0, 0);
            gS.globalCompositeOperation = 'destination-out'; gS.globalAlpha = 0.5;
            drawUnit(gS, un, vx * 0.5, vy * 0.5);
            gS.globalAlpha = 1;
            drawUnit(gS, un, vx, vy);
            gS.globalCompositeOperation = 'source-over'; gS.globalAlpha = 0.1 * sa;
            drawUnit(gS, un, 0, 0);
            gH.globalCompositeOperation = 'source-over'; gH.globalAlpha = sa;
            drawUnit(gH, un, 0, 0);
            gH.globalCompositeOperation = 'destination-out'; gH.globalAlpha = 0.5;
            drawUnit(gH, un, -vx * 0.5, -vy * 0.5);
            gH.globalAlpha = 1;
            drawUnit(gH, un, -vx, -vy);
            // Ink, with the squeeze: a darker ring pushed past the edge.
            if (un.inkAt !== Infinity && un.inkAt !== -Infinity && !blind) {
              let ia = clamp((t - un.inkAt) / 0.07, 0, 1);
              if (line.k === 'orn') ia *= 0.3 + 0.7 * Math.exp(-(t - un.inkAt) / 1.4);
              if (ia > 0) {
                plateCtx.globalAlpha = ia * (heavy ? 1 : 0.9);
                drawUnit(plateCtx, un, 0, 0);
                plateCtx.globalAlpha = ia * (heavy ? 0.75 : 0.5);
                drawUnit(plateCtx, un, 0, 0, true);
                if (line.slurAt !== undefined) {
                  const sl = Math.exp(-(t - line.slurAt) / 0.2) * clamp(react, 0, 1.5);
                  if (sl > 0.02) {
                    const d = 5.5 * u * (0.6 + 0.4 * react);
                    plateCtx.globalAlpha = ia * 0.7 * sl;
                    drawUnit(plateCtx, un, line.slurX * d, line.slurY * d);
                  }
                }
                // Wet ink shines for a moment after the platen lifts.
                if (fresh > 0.01 && line.k !== 'giant') {
                  gH.globalCompositeOperation = 'source-over'; gH.globalAlpha = 0.3 * fresh * ia;
                  drawUnit(gH, un, -vx * 0.3, -vy * 0.3);
                }
              }
            }
          }
          [gS, gH, plateCtx].forEach((g) => g.restore());
        });
      });

      // Paper that did not take ink, moving with each sheet.
      const wearA = heavy ? 0.35 : 0.7;
      [gK, gR].forEach((g) => {
        g.globalCompositeOperation = 'destination-out'; g.globalAlpha = wearA;
        this.sheets.forEach((s, i) => g.drawImage(this.wear, pos[i], 0, W, H));
      });

      // Composite: red run, black run, walls, lamp falloff.
      const devScale = T0.a * z;
      const reg = params.register * (heavy ? 1.8 : 1);
      const mrx = reg * (2.2 * u + 1.2 * u * Math.sin(this.wander * 0.9)) * devScale;
      const mry = reg * (-1.4 * u + 1.0 * u * Math.cos(this.wander * 0.7)) * devScale;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = 1;
      c.drawImage(this.layers[3], mrx, mry);
      c.drawImage(this.layers[2], 0, 0);
      c.globalAlpha = clamp(0.55 + 0.25 * params.depth, 0, 1);
      c.drawImage(this.layers[0], 0, 0);
      c.globalCompositeOperation = 'screen';
      c.globalAlpha = clamp(0.35 + 0.2 * params.depth, 0, 0.8);
      c.drawImage(this.layers[1], 0, 0);
      cam(c);
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = 1;
      const grad = c.createRadialGradient(lampX, lampY, 0, lampX, lampY, Math.hypot(W, H) * 1.35);
      grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(0.45, '#F2EEE8'); grad.addColorStop(1, '#C9C2B6');
      c.fillStyle = grad;
      c.fillRect(-W, -H, W * 3, H * 3);
      c.restore();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    },
  });
})();
