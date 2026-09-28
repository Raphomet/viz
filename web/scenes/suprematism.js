// Suprematism: a Malevich lithograph poster whose forms have lost their weight.
// On warm white stock a black square, a red quadrilateral, a circle, bars and a
// cross hang in white space, each a little out of true as if painted by hand,
// all drifting and turning very slowly. The headline is set along a black bar
// in a wide geometric grotesque, with small captions in a light geometric sans.
// Behind the composition small forms drift in the distance with parallax, so the
// white reads as infinite space rather than a wall.
//
// Music, each in its own place:
//   kick   the red square takes the beat: an angular kick that turns it a
//          quarter-turn's worth and swells it slightly, then it coasts; in the
//          drop the flight also surges forward on the beat
//   clap   a different event: a hairline draws itself across the composition
//          through one of the forms, then fades, and the small circle flips
//          between black and red
//   bass   continuous: the speed of everything (drift, parallax, flight), and
//          how far the composition opens out
//   hats   one of the distant specks flips red and turns, per hat
//   drop   a flight of forms: a squadron of bars, rectangles and wedges, all
//          pointing along the diagonal, streams in from the lower left in depth,
//          blue, yellow and green join the black and red, the headline letters
//          come loose from their baseline and float; the breakdown lets the
//          flight leave, pales the inks, and a white square surfaces on the
//          white ground.
// Plain Canvas 2D. Forms are drawn into an ink layer that loses specks of ink
// through a crayon-lithograph noise, the red plate sits slightly off register,
// and a paper grain is multiplied over the sheet. No glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const D2R = Math.PI / 180;

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
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixCss = (a, b, u) => 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';

  // Ink names; each print maps them to colours.
  const K = 0, R = 1, B = 2, Y = 3, G = 4, O = 5, P = 6, WH = 7;
  const PRINTS = [
    // Malevich 1915-16: black and red, and in the drop the blue, yellow, green,
    // ochre and pink of the Supremus canvases.
    { paper: '#EEE9DD', text: '#161513', dark: false,
      inks: ['#171614', '#C3281D', '#223F8E', '#E6B41E', '#2F6A45', '#B27A36', '#D48A9C', '#F8F6F0'] },
    // Black and red only: the colour inks fold back into the two plates.
    { paper: '#EEE9DD', text: '#161513', dark: false,
      inks: ['#171614', '#C3281D', '#171614', '#C3281D', '#171614', '#6B6760', '#C3281D', '#F8F6F0'] },
    // Night: the same sheet printed on black stock, the key plate in cream.
    { paper: '#121214', text: '#E9E3D4', dark: true,
      inks: ['#E9E3D4', '#D2321F', '#3C63C8', '#EDBE22', '#3E8A5A', '#C08A44', '#DB93A5', '#26262A'] },
  ];

  // The poster's forms. Positions are in units of the short side S about the
  // centre, laid out for 16:9 and pulled in on narrower stages. Each
  // composition is a set of placements [x, y, rotation°, scale]; the sheet
  // recomposes between them slowly, on section changes.
  const HEROES = [
    { id: 'blacksq', kind: 'quad', w: 0.40, h: 0.40, ink: K, skew: [0.000, 0.012, -0.010, 0.006] },
    { id: 'redsq', kind: 'quad', w: 0.19, h: 0.19, ink: R, skew: [0.012, -0.004, 0.022, 0.014] },
    { id: 'circle', kind: 'circ', w: 0.13, h: 0.13, ink: K },
    { id: 'typebar', kind: 'quad', w: 0.86, h: 0.028, ink: K, skew: [0, 0, 0, 0] },
    { id: 'redbar', kind: 'quad', w: 0.50, h: 0.022, ink: R, skew: [0, 0.002, 0, -0.002] },
    { id: 'rect', kind: 'quad', w: 0.13, h: 0.055, ink: K, skew: [0, 0, 0.004, 0] },
    { id: 'trap', kind: 'quad', w: 0.20, h: 0.07, ink: Y, skew: [0.03, 0, -0.012, 0] },
    { id: 'cross', kind: 'cross', w: 0.17, h: 0.17, ink: K },
    { id: 'bluebar', kind: 'quad', w: 0.26, h: 0.04, ink: B, skew: [0, 0, 0.01, 0] },
  ];
  const COMPS = [
    { blacksq: [0.02, -0.07, -13, 1], redsq: [0.45, 0.17, 21, 1], circle: [-0.36, -0.27, 0, 1],
      typebar: [-0.38, 0.30, -8, 1], redbar: [0.33, -0.28, 34, 1], rect: [0.66, -0.12, 34, 1],
      trap: [0.20, 0.32, -28, 1], cross: [0.72, 0.30, 12, 0], bluebar: [-0.62, -0.05, 60, 1] },
    { blacksq: [0.36, -0.05, 9, 0.92], redsq: [-0.16, -0.24, -17, 1.1], circle: [0.72, 0.27, 0, 0.8],
      typebar: [-0.36, 0.31, -6, 1], redbar: [0.00, 0.02, -40, 1.1], rect: [-0.60, -0.28, -40, 1],
      trap: [0.62, -0.33, 18, 1], cross: [-0.06, 0.15, 30, 0.8], bluebar: [0.25, 0.36, -25, 1] },
    { blacksq: [-0.20, -0.10, 24, 0.85], redsq: [0.30, -0.22, -8, 1.25], circle: [0.02, 0.16, 0, 1.3],
      typebar: [-0.40, 0.29, -10, 1], redbar: [0.55, 0.15, 58, 1], rect: [0.70, -0.30, 58, 1.2],
      trap: [-0.62, -0.30, -48, 0.9], cross: [0.40, 0.30, -14, 0], bluebar: [0.20, 0.00, 34, 1.3] },
  ];

  // Headlines by section, original wording: [word, sub-line].
  const HEADS = {
    calm: ['WEIGHTLESS', 'a night of sound in white space'],
    drop: ['IN FLIGHT', 'every form in the room is dancing'],
    rest: ['PURE SOUND', 'the forms come down to rest'],
  };
  const HEAD_FONT = 'Rubik Mono One', CAP_FONT = 'Josefin Sans';

  function fontStack(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  VIZ.register({
    id: 'suprematism',
    name: 'Suprematism',
    order: 507,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'drift', label: 'Drift speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'flight', label: 'Flight size', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'space', label: 'Distant forms', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'print', label: 'Print', type: 'select', options: ['Malevich colour', 'Black and red', 'Night'], default: 0 },
      { key: 'texture', label: 'Litho texture', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'words', label: 'Headline (blank cycles)', type: 'text', default: '' },
    ],

    actions: [
      { id: 'recompose', label: 'Recompose', run() { this.wantRecompose = true; } },
    ],

    gallery: {
      title: 'Suprematism',
      technique: 'Canvas 2D: hand-skewed polygons in a composed layer that recomposes by tweens, a toroidal parallax field of distant forms, and a spawned squadron of forms flying in depth along one diagonal; everything is drawn into an offscreen ink layer that loses specks through a crayon-litho noise pattern before it is laid on grained paper; onset detection against the previous frame',
      brief: 'A Malevich lithograph poster alive. On warm white stock a black square, a red quadrilateral, a circle, bars and a cross float weightless, turning and drifting very slowly, with small forms far away in white space moving past with parallax. The headline sits along a black bar in a wide geometric grotesque. Each kick turns and swells the red square, which then coasts like something in orbit; each clap draws a hairline across the composition and flips the small circle red; hats flip distant specks red. The bass sets the speed of the whole sky. The drop brings in a flight of forms: a squadron of bars and wedges in black, red, blue, yellow and green, all pointing along the diagonal, stream across in depth, surging on the beat, while the headline letters float off their baseline. The breakdown lets the flight leave, pales the inks and raises a white square out of the white ground.',
      lineage: [
        'Kazimir Malevich\'s Suprematist canvases (1915-16), especially the airplane and "dynamic" compositions with forms aligned along one diagonal, his Black Square and Red Square, the white-on-white works of 1918, and his lithographed Suprematism: 34 Drawings (1920); El Lissitzky\'s Suprematist book typography for the wide geometric type set along a bar. Batch 05 brief entry "07 · Suprematism".',
        'The forms are quadrilaterals with small per-corner offsets, so the squares are a little out of true like the painted originals. Depth is expressed Malevich\'s way, by scale and overlap, with only a slight fade in the farthest forms.',
        'Process: the kick was put on one form, the red square, as an angular impulse that bleeds off (weightless inertia rather than a pulse); the flight surge in the drop is the only other thing that answers the beat. The first render read as Suprematism at once, but the litho speckle was so heavy the black square looked grey and noisy, the flight forms spun continuously and read as confetti rather than a squadron, and the breakdown\'s white square sat under the black square where it could not be seen. The speckle was thinned, the flight now keeps its heading with only a slow sway, and the white square is placed opposite the black square. Jolt at 640x360: calm, kickArea 0.16, ratio 1.17; the heat map shows the red square and the clap hairlines, with the flight\'s own motion as the drift. A 96 s run showed the composition only alternating between two of its three arrangements and the headline stuck on the breakdown word once the track looped, so recomposition now steps through all three and the build restores the opening headline. A paper-coloured cut was also added round the headline letters so the flight passing behind them does not break the word.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.heroes) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      const rng = this.rng;
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.low = 0; this.drop = false; this.hadDrop = false;
      this.bassEnv = 0; this.hatSlow = 0; this.energy = 0; this.kickEnv = 0;
      this.clock = 0; this.flow = 0; this.flight = 0; this.rest = 0; this.build = 0;
      this.comp = 0; this.compT0 = -100; this.compFrom = null; this.lastRecomp = 0;
      this.lines = [];
      this.redSpin = 0; this.redAng = 0;
      this.circleRed = 0; this.circleTarget = 0;
      this.head = { word: HEADS.calm[0], sub: HEADS.calm[1], t0: -10 };
      this.oldHead = null;
      this.wantRecompose = false;
      this.inkCanvas = null; this.grainPat = null; this.speckPat = null;
      this.heroes = HEROES.map((h, i) => {
        const c = COMPS[0][h.id];
        return Object.assign({}, h, { x: c[0], y: c[1], r: c[2], s: c[3], ph: rng() * 100, sp: 0.6 + 0.8 * rng() });
      });
      this.snapComp(0);
      // Distant forms: a wrapped field, far away, drifting on the same heading.
      this.far = [];
      for (let i = 0; i < 26; i++) this.far.push(this.newForm(true));
      // The flight: a pool that is spawned upstream only while the drop wants it.
      this.fl = [];
      for (let i = 0; i < 64; i++) { const f = this.newForm(false); f.active = false; this.fl.push(f); }
      this.spawnClock = 0;
    },

    newForm(far) {
      const rng = this.rng;
      const r = rng();
      const kind = r < 0.36 ? 'bar' : r < 0.66 ? 'rect' : r < 0.78 ? 'sq' : r < 0.88 ? 'trap' : 'circ';
      const k = far ? 0.22 + 0.4 * rng() : 0.45 + 1.1 * Math.pow(rng(), 1.7);
      let w, h;
      if (kind === 'bar') { w = 0.12 + 0.22 * rng(); h = w * (0.07 + 0.06 * rng()); }
      else if (kind === 'rect') { w = 0.06 + 0.1 * rng(); h = w * (0.28 + 0.3 * rng()); }
      else if (kind === 'sq') { w = h = 0.04 + 0.06 * rng(); }
      else if (kind === 'trap') { w = 0.08 + 0.1 * rng(); h = w * 0.3; }
      else { w = h = 0.03 + 0.05 * rng(); }
      const ci = rng();
      return {
        kind, k, w, h, u: rng(), v: rng(), lane: 0, d: 0,
        ci, rot: (rng() - 0.5) * 24, rv: (rng() - 0.5) * 10, ph: rng() * 100,
        skew: [(rng() - 0.5) * 0.15, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.15, 0],
        flash: 0, flashRot: 0, active: true,
      };
    },

    // An ink for a flight/far form: black and red always, colour in the drop.
    formInk(f, colour) {
      if (colour > 0.5) {
        const c = f.ci;
        return c < 0.34 ? K : c < 0.56 ? R : c < 0.68 ? B : c < 0.8 ? Y : c < 0.88 ? G : c < 0.95 ? O : P;
      }
      return f.ci < 0.7 ? K : R;
    },

    snapComp(i) {
      const c = COMPS[i];
      for (const h of this.heroes) { const q = c[h.id]; h.x = q[0]; h.y = q[1]; h.r = q[2]; h.s = q[3]; }
      this.comp = i; this.compFrom = null;
    },
    recompose(t, i) {
      if (i === this.comp) i = (i + 1) % COMPS.length;
      this.compFrom = this.heroes.map((h) => [h.x, h.y, h.r, h.s]);
      this.comp = i; this.compT0 = t; this.lastRecomp = t;
    },

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.05) : k(0.35));
      this.hatSlow += ((s[6] + s[7] + s[8]) / 300 - this.hatSlow) * k(1.5);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.2);
      return { kick, snare, hat };
    },

    setHead(which, t, params) {
      const custom = (params.words || '').trim();
      const next = custom ? [custom.toUpperCase(), HEADS[which][1]] : HEADS[which];
      if (next[0] === this.head.word && next[1] === this.head.sub) return;
      this.oldHead = { word: this.head.word, sub: this.head.sub, t0: t };
      this.head = { word: next[0], sub: next[1], t0: t + 0.3 };
    },

    // ---- textures ------------------------------------------------------------

    makeGrain(g) {
      if (this.grainPat && this.grainCtx === g) return;
      const rnd = mulberry(4321);
      const mk = (fn) => {
        const c = document.createElement('canvas'); c.width = 256; c.height = 256;
        const x = c.getContext('2d'); const img = x.createImageData(256, 256);
        const blot = new Float32Array(256);
        for (let i = 0; i < 256; i++) blot[i] = rnd();
        for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
          const bx = xx / 16, by = y / 16, ix = Math.floor(bx), iy = Math.floor(by), fx = bx - ix, fy = by - iy;
          const q = (a, b) => blot[((b & 15) * 16) + (a & 15)];
          const sm = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
          fn(img.data, (y * 256 + xx) * 4, rnd(), sm);
        }
        x.putImageData(img, 0, 0);
        return g.createPattern(c, 'repeat');
      };
      // Uncoated stock: fibre noise and soft cloudiness, multiplied.
      this.grainPat = mk((d, o, n, sm) => { const v = 255 - n * 30 - sm * 14; d[o] = v; d[o + 1] = v - 2; d[o + 2] = v - 7; d[o + 3] = 255; });
      // Crayon on stone: where the ink did not take. Fine specks, thicker in the
      // lighter patches of the blotch field, used with destination-out.
      this.speckPat = mk((d, o, n, sm) => {
        const a = n > 0.9 - sm * 0.14 ? 120 + n * 120 : n * n * 22 * sm;
        d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = a;
      });
      this.grainCtx = g;
    },

    // ---- drawing -------------------------------------------------------------

    // A hand-skewed quadrilateral centred at 0,0.
    quad(g, w, h, sk) {
      const a = w / 2, b = h / 2;
      g.beginPath();
      g.moveTo(-a + sk[0] * w, -b);
      g.lineTo(a, -b + sk[1] * h);
      g.lineTo(a + sk[2] * w, b);
      g.lineTo(-a, b + sk[3] * h);
      g.closePath();
    },

    shape(g, kind, w, h, sk) {
      if (kind === 'circ') { g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill(); return; }
      if (kind === 'cross') {
        const t = w * 0.26;
        g.fillRect(-w / 2, -t / 2, w, t); g.fillRect(-t / 2, -h / 2, t, h); return;
      }
      if (kind === 'trap') { const a = w / 2, b = h / 2; g.beginPath(); g.moveTo(-a + w * 0.18, -b); g.lineTo(a, -b); g.lineTo(a - w * 0.08, b); g.lineTo(-a, b); g.closePath(); g.fill(); return; }
      this.quad(g, w, h, sk || [0, 0, 0, 0]); g.fill();
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const cx = W / 2, cy = H / 2;
      const print = PRINTS[Math.round(params.print) || 0] || PRINTS[0];
      const INK = print.inks.map(hex), PAPER = hex(print.paper);
      const react = params.reaction;
      const kf = (tau) => 1 - Math.exp(-dt / tau);

      const ev = this.analyse(signals, t, dt);

      // Sections, from the music: the drop is the sustained bass line.
      const wasDrop = this.drop;
      if (!this.drop && this.low > 30) this.drop = true;
      else if (this.drop && this.low < 16) this.drop = false;
      const kicksRecent = t - this.lastKick < 1.2;
      if (this.drop) this.hadDrop = true;
      const building = !this.drop && (kicksRecent || this.hatSlow > 0.25);
      const flightWant = this.drop ? 1 : building ? 0.12 : 0;
      this.flight += (flightWant - this.flight) * kf(this.drop ? 0.7 : 1.4);
      const restWant = !this.drop && !building && this.hadDrop ? 1 : 0;
      this.rest += (restWant - this.rest) * kf(1.6);
      this.build += ((building ? 1 : 0) - this.build) * kf(1.0);

      if (this.drop !== wasDrop) {
        this.setHead(this.drop ? 'drop' : 'rest', t, params);
        this.recompose(t, (this.comp + 1) % COMPS.length);
      } else if (!this.drop && building && t - this.lastKick < 0.6) {
        this.setHead('calm', t, params);
      }
      if (this.wantRecompose) { this.wantRecompose = false; this.recompose(t, (this.comp + 1) % COMPS.length); }
      // Minute five should not be minute one: a slow recomposition every 40 s.
      if (t - this.lastRecomp > 40) this.recompose(t, (this.comp + 1) % COMPS.length);
      const custom = (params.words || '').trim().toUpperCase();
      if (custom && custom !== this.head.word) { this.oldHead = { word: this.head.word, sub: this.head.sub, t0: t }; this.head = { word: custom, sub: this.head.sub, t0: t + 0.3 }; }

      // Speed: the bass line sets how fast the sky moves, never a jump.
      const speed = params.drift * (0.35 + 0.5 * this.energy + 0.7 * this.bassEnv);
      this.clock += dt * speed;
      this.kickEnv *= Math.exp(-dt / 0.16);

      // ---- events
      if (ev.kick) {
        this.kickEnv = 1;
        this.redSpin += 150 * react;
      }
      if (ev.snare && (this.lines.length === 0 || t - this.lines[this.lines.length - 1].t0 > 0.2)) {
        const hs = this.heroes.filter((h) => h.id !== 'typebar' && h.s > 0.2);
        const h = hs[Math.floor(this.rng() * hs.length)];
        const ang = (this.rng() < 0.6 ? -32 : 58) + (this.rng() - 0.5) * 30;
        this.lines.push({ h, ang, len: 0.7 + 0.5 * this.rng(), t0: t, ink: this.drop && this.rng() < 0.4 ? R : K,
          off: (this.rng() - 0.5) * 0.08, dir: this.rng() < 0.5 ? 1 : -1 });
        if (this.lines.length > 4) this.lines.shift();
        this.circleTarget = 1 - this.circleTarget;
      }
      if (ev.hat) {
        const vis = this.far.filter((f) => f.flash < 0.2 && f.vis);
        if (vis.length) { const f = vis[Math.floor(this.rng() * vis.length)]; f.flash = 1; f.flashRot += 45; }
      }
      this.lines = this.lines.filter((l) => t - l.t0 < 2.6);
      this.circleRed += (this.circleTarget - this.circleRed) * kf(0.06);

      // The red square coasts: angular momentum from the kick, bled off slowly.
      this.redAng += this.redSpin * dt;
      this.redSpin *= Math.exp(-dt / 0.3);

      // ---- composition tween
      let cu = 1;
      if (this.compFrom) {
        cu = easeInOut(clamp((t - this.compT0) / 6, 0, 1));
        if (cu >= 1) this.compFrom = null;
      }
      const C = COMPS[this.comp];
      this.heroes.forEach((h, i) => {
        const q = C[h.id];
        if (this.compFrom) { const f = this.compFrom[i]; h.x = lerp(f[0], q[0], cu); h.y = lerp(f[1], q[1], cu); h.r = lerp(f[2], q[2], cu); h.s = lerp(f[3], q[3], cu); }
        else { h.x = q[0]; h.y = q[1]; h.r = q[2]; h.s = q[3]; }
      });

      // Narrower stages pull the composition in horizontally.
      const aspect = W / S;
      const xs = clamp((aspect / 2 - 0.08) / (1.78 / 2 - 0.08), 0.52, 1.15);
      const open = 1 + 0.1 * this.flight;       // the drop opens the composition out
      const heading = -32 * D2R;
      const hvx = Math.cos(heading), hvy = Math.sin(heading);
      const colour = params.print === 1 ? 0 : this.flight;
      const pale = this.rest * 0.4;

      // ---- the ink layer, in device pixels, with the stage transform
      const g0 = p.drawingContext;
      this.makeGrain(g0);
      const tf = g0.getTransform();
      const pw = p.width * p.pixelDensity(), ph = p.height * p.pixelDensity();
      if (!this.inkCanvas) { this.inkCanvas = document.createElement('canvas'); this.inkCtx = this.inkCanvas.getContext('2d'); }
      if (this.inkCanvas.width !== pw || this.inkCanvas.height !== ph) { this.inkCanvas.width = pw; this.inkCanvas.height = ph; }
      const g = this.inkCtx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, pw, ph);
      g.setTransform(tf);

      const inkCss = (i, fade) => {
        const u = clamp(fade, 0, 1);
        return u <= 0.001 ? print.inks[i] : mixCss(INK[i], PAPER, u);
      };
      const regX = 0.9, regY = 0.6; // red plate off register

      // Distant field: toroidal wrap in a domain a little larger than the stage.
      const dw = W + 0.4 * S, dh = H + 0.4 * S;
      const farN = Math.round(this.far.length * clamp(params.space, 0, 2) / 2 * 1.0 + (params.space > 0 ? 6 : 0));
      const flowD = this.clock * 0.12 * S;
      const drawFar = [];
      for (let i = 0; i < Math.min(farN, this.far.length); i++) {
        const f = this.far[i];
        f.flash *= Math.exp(-dt / 0.35);
        let x = f.u * dw + flowD * f.k * hvx, y = f.v * dh + flowD * f.k * hvy;
        x = ((x % dw) + dw) % dw - 0.2 * S; y = ((y % dh) + dh) % dh - 0.2 * S;
        f.vis = x > 0 && x < W && y > 0 && y < H;
        drawFar.push({ f, x, y });
      }
      for (const d of drawFar) {
        const f = d.f, sz = S * f.k;
        const ink = f.flash > 0.25 ? R : this.formInk(f, colour * 0.6);
        g.save();
        g.translate(d.x + (ink === R ? regX : 0), d.y + (ink === R ? regY : 0));
        g.rotate((f.rot + heading / D2R + f.flashRot - 45 * f.flash + this.clock * f.rv * 0.4) * D2R);
        g.fillStyle = inkCss(ink, 0.3 + (0.62 - f.k) * 0.6 + pale);
        this.shape(g, f.kind, f.w * sz, f.h * sz, f.skew);
        g.restore();
      }

      // The flight: forms spawned upstream along a lane, flying the diagonal.
      const R0 = 0.5 * Math.hypot(W, H) + 0.35 * S;
      const want = Math.round(this.fl.length * clamp(params.flight, 0, 2) / 2 * this.flight);
      this.spawnClock -= dt;
      const laneC = 0.18 * S * Math.sin(this.clock * 0.21) - 0.05 * S;
      const surge = 1 + 1.4 * this.kickEnv * react * (this.drop ? 1 : 0.3);
      for (let i = 0; i < this.fl.length; i++) {
        const f = this.fl[i];
        if (!f.active) {
          if (i < want && this.spawnClock <= 0) {
            Object.assign(f, this.newForm(false));
            f.active = true; f.d = -this.rng() * 0.15 * S;
            const gs = (this.rng() + this.rng() + this.rng() - 1.5) * 0.55;
            f.lane = laneC + gs * S;
            f.rot = (this.rng() - 0.5) * 16; f.rv = (this.rng() - 0.5) * 6;
            this.spawnClock = 0.11 / (0.4 + this.flight);
          }
          continue;
        }
        f.d += dt * S * (0.1 + 0.16 * this.bassEnv + 0.05 * this.energy) * params.drift * f.k * surge * 1.6;
        if (f.d > 2 * R0) f.active = false;
      }
      const flying = this.fl.filter((f) => f.active).sort((a, b) => a.k - b.k);
      const flBehind = flying.filter((f) => f.k < 0.95), flFront = flying.filter((f) => f.k >= 0.95);
      const drawFlight = (list) => {
        for (const f of list) {
          const along = f.d - R0;
          const x = cx + hvx * along - hvy * f.lane, y = cy + hvy * along + hvx * f.lane;
          const sz = S * f.k * 0.9;
          const ink = this.formInk(f, colour);
          g.save();
          g.translate(x + (ink === R ? regX : 0), y + (ink === R ? regY : 0));
          g.rotate(heading + (f.rot + 3 * f.rv * Math.sin(this.clock * 0.3 + f.ph)) * D2R);
          // A slow tumble about the long axis, so the squadron reads as in space.
          g.scale(1, 0.75 + 0.25 * Math.cos(this.clock * 0.5 + f.ph));
          g.fillStyle = inkCss(ink, (f.k < 0.7 ? (0.7 - f.k) * 0.5 : 0) + pale);
          this.shape(g, f.kind, f.w * sz, f.h * sz, f.skew);
          g.restore();
        }
      };
      drawFlight(flBehind);

      // White on white: a square of whiter white surfaces in the breakdown.
      if (this.rest > 0.01) {
        const ws = 0.46 * S * (0.96 + 0.04 * this.rest);
        g.save();
        // Opposite the black square, so the whiter white is seen against paper.
        const bx = this.heroes[0].x, wu = clamp((bx + 0.1) / 0.2, 0, 1);
        g.translate(cx + lerp(0.42, -0.4, wu * wu * (3 - 2 * wu)) * S * xs, cy - 0.06 * S);
        g.rotate((-18 + 3 * Math.sin(this.clock * 0.15)) * D2R);
        g.globalAlpha = this.rest * (print.dark ? 0.9 : 1);
        g.fillStyle = print.inks[WH];
        this.quad(g, ws, ws, [0.01, -0.01, 0.006, 0.012]); g.fill();
        g.globalAlpha = this.rest * 0.18;
        g.strokeStyle = print.dark ? '#000' : '#8C877C'; g.lineWidth = 0.6;
        g.stroke();
        g.restore(); g.globalAlpha = 1;
      }

      // The composed forms.
      const heroPos = {};
      for (const h of this.heroes) {
        if (h.s < 0.02) continue;
        const bob = 0.012 * S;
        let x = cx + h.x * S * xs * open + bob * Math.sin(this.clock * 0.27 * h.sp + h.ph);
        let y = cy + h.y * S * open + bob * Math.cos(this.clock * 0.21 * h.sp + h.ph * 1.3);
        let rot = h.r + 3.5 * Math.sin(this.clock * 0.16 * h.sp + h.ph);
        let sc = h.s;
        let ink = h.ink;
        if (h.id === 'redsq') {
          rot += this.redAng;
          sc *= 1 + 0.07 * react * this.kickEnv;
          x += hvx * 0.02 * S * react * this.kickEnv; y += hvy * 0.02 * S * react * this.kickEnv;
        }
        if (h.id === 'typebar') { x = cx + h.x * S * xs + bob * 0.4 * Math.sin(this.clock * 0.2 + h.ph); rot = h.r + 1.2 * Math.sin(this.clock * 0.12 + h.ph); }
        // The colour forms are grey until the drop brings their ink in.
        let fade = pale;
        if ((h.ink === Y || h.ink === B) && colour < 0.5) ink = h.ink === Y ? O : K;
        if (h.ink === Y && params.print === 1) ink = R;
        heroPos[h.id] = { x, y, rot, sc };
        if (h.id === 'circle' && this.circleRed > 0.02) {
          g.fillStyle = mixCss(INK[K], INK[R], this.circleRed);
        } else g.fillStyle = inkCss(ink, h.id === 'blacksq' ? pale * 0.5 : fade);
        g.save();
        g.translate(x + (ink === R ? regX : 0), y + (ink === R ? regY : 0));
        g.rotate(rot * D2R);
        const ww = h.w * S * sc, hh = h.h * S * sc;
        this.shape(g, h.kind, ww, hh, h.skew);
        g.restore();
      }

      // Clap hairlines: drawn across from one end, then gone.
      g.lineCap = 'butt';
      for (const l of this.lines) {
        const hp = heroPos[l.h.id]; if (!hp) continue;
        const age = t - l.t0;
        const grow = easeOut(clamp(age / 0.14, 0, 1));
        const fade = clamp((age - 1.1) / 1.4, 0, 1);
        const a = l.ang * D2R, L = l.len * S;
        const ox = hp.x - Math.sin(a) * l.off * S, oy = hp.y + Math.cos(a) * l.off * S;
        const x0 = ox - Math.cos(a) * L / 2 * l.dir, y0 = oy - Math.sin(a) * L / 2 * l.dir;
        g.strokeStyle = inkCss(l.ink, fade + pale);
        g.lineWidth = 0.0045 * S;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L * grow * l.dir, y0 + Math.sin(a) * L * grow * l.dir); g.stroke();
      }

      drawFlight(flFront);

      // ---- type
      const tb = heroPos.typebar;
      if (tb) this.drawHead(g, tb, t, S, print, pale, params);
      this.drawCaptions(g, W, H, S, print, pale);

      // Crayon-litho: specks where the ink did not take.
      const tex = clamp(params.texture, 0, 1);
      if (tex > 0) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = 0.15 + 0.55 * tex;
        g.fillStyle = this.speckPat;
        g.fillRect(-10, -10, W + 20, H + 20);
        g.restore();
      }

      // ---- composite onto the paper
      p.background(print.paper);
      g0.save();
      g0.setTransform(1, 0, 0, 1, 0, 0);
      g0.globalAlpha = 1; g0.globalCompositeOperation = 'source-over';
      g0.drawImage(this.inkCanvas, 0, 0);
      g0.restore();
      g0.save();
      g0.globalCompositeOperation = print.dark ? 'overlay' : 'multiply';
      g0.globalAlpha = print.dark ? 0.25 : 0.35 + 0.65 * tex;
      g0.fillStyle = this.grainPat;
      g0.fillRect(0, 0, W, H);
      g0.restore();
    },

    drawHead(g, tb, t, S, print, pale, params) {
      const draw = (hd, appear) => {
        const word = hd.word;
        if (!word) return;
        let size = 0.078 * S;
        g.font = '400 ' + size.toFixed(2) + 'px ' + fontStack(HEAD_FONT, '"Arial Black", sans-serif');
        let widths = [], total = 0;
        const track = size * 0.08;
        for (const ch of word) { const w = g.measureText(ch).width; widths.push(w); total += w + track; }
        total -= track;
        const maxW = 0.84 * S;
        if (total > maxW) { const f = maxW / total; size *= f; total = maxW; widths = widths.map((w) => w * f); g.font = '400 ' + size.toFixed(2) + 'px ' + fontStack(HEAD_FONT, '"Arial Black", sans-serif'); }
        g.save();
        g.translate(tb.x, tb.y);
        g.rotate(tb.rot * D2R);
        const barW = 0.86 * S * tb.sc;
        let x = -barW / 2;
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        const float = this.flight;
        for (let i = 0; i < word.length; i++) {
          const ch = word[i];
          // Letters settle onto the bar one by one, and leave by floating off.
          let u = appear ? clamp((t - hd.t0 - i * 0.06) / 0.6, 0, 1) : 1 - clamp((t - hd.t0 - i * 0.04) / 0.7, 0, 1);
          if (u <= 0) { x += widths[i] + track; continue; }
          const e = easeOut(u);
          const ph = i * 1.7 + (appear ? 0 : 3);
          const fy = -float * 0.03 * S * (0.5 + 0.5 * Math.sin(this.clock * 0.9 + ph)) - (1 - e) * 0.09 * S;
          const fx = (1 - e) * (appear ? -0.03 : 0.05) * S;
          const fr = float * 7 * Math.sin(this.clock * 0.7 + ph * 1.3) + (1 - e) * (appear ? -20 : 25);
          g.save();
          g.translate(x + widths[i] / 2 + fx, -0.022 * S + fy);
          g.rotate(fr * D2R);
          g.globalAlpha = e;
          // A thin paper-coloured cut around each letter, so the headline stays
          // legible when the flight passes behind it.
          g.strokeStyle = print.paper; g.lineWidth = size * 0.14; g.lineJoin = 'round';
          g.strokeText(ch, -widths[i] / 2, 0);
          g.fillStyle = pale > 0 ? mixCss(hex(print.inks[K]), hex(print.paper), pale * 0.6) : print.inks[K];
          g.fillText(ch, -widths[i] / 2, 0);
          g.restore();
          x += widths[i] + track;
        }
        // The sub-line hangs under the bar.
        if (hd.sub) {
          g.globalAlpha = appear ? clamp((t - hd.t0 - 0.3) / 0.8, 0, 1) : 1 - clamp((t - hd.t0) / 0.5, 0, 1);
          g.font = '300 ' + (0.03 * S).toFixed(2) + 'px ' + fontStack(CAP_FONT, 'Futura, sans-serif');
          g.fillStyle = print.text;
          g.fillText(hd.sub.toUpperCase().split('').join(' '), -barW / 2, 0.052 * S);
        }
        g.globalAlpha = 1;
        g.restore();
      };
      if (this.oldHead && t - this.oldHead.t0 < 1.4) draw(this.oldHead, false);
      draw(this.head, true);
    },

    drawCaptions(g, W, H, S, print, pale) {
      const m = 0.045 * S;
      g.save();
      g.fillStyle = print.text;
      g.textBaseline = 'alphabetic';
      g.font = '700 ' + (0.024 * S).toFixed(2) + 'px ' + fontStack(CAP_FONT, 'Futura, sans-serif');
      g.textAlign = 'left';
      g.fillText('A NIGHT OF FORMS AND RHYTHM', m, m + 0.02 * S);
      g.font = '300 ' + (0.022 * S).toFixed(2) + 'px ' + fontStack(CAP_FONT, 'Futura, sans-serif');
      g.fillText('from ten until the light comes', m, m + 0.052 * S);
      g.fillRect(m, m + 0.07 * S, 0.12 * S, 0.004 * S);
      g.textAlign = 'right';
      g.font = '300 ' + (0.022 * S).toFixed(2) + 'px ' + fontStack(CAP_FONT, 'Futura, sans-serif');
      g.fillText('the dance of the black square', W - m, H - m);
      g.font = '700 ' + (0.022 * S).toFixed(2) + 'px ' + fontStack(CAP_FONT, 'Futura, sans-serif');
      g.fillText('SOUND · COLOUR · FLIGHT', W - m, H - m - 0.032 * S);
      g.restore();
    },
  });
})();
