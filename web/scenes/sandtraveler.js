// Sand Traveler Orbits — the Planets orrery with the planets taken away.
//
// Between each pair of related bodies, grains of sand are sprinkled along the
// line that joins them, thick near each body and thinning toward the middle
// (Tarbell's Sand Traveler, 2004). The bodies themselves are never drawn: what
// shows is the history of their relations, painted onto one sheet of paper as
// they orbit. Each kick gives one planet a new moon, and so a new relation to
// paint; a moon lives a few bars and retires, so the breakdown thins back to
// the planets alone.
//
// Why a Float32 absorbance buffer rather than canvas points: a grain here is
// a 1-3% deposit, which 8-bit alpha rounds to nothing, and 20k point calls a
// frame would blow the budget (the same finding as Current). The paper holds
// ink absorbance per channel and is shown through Beer–Lambert,
// paper × e^(−A), so overlapping inks darken and mix like pigment instead of
// adding up to white, and heavy passages go deep but never clip flat.
//
// Why the paper forgets: a sheet that only accumulates goes to mud within a
// minute or two. Absorbance fades with a half-life ("Paper memory"), each
// grain lands more lightly where the paper is already dark, and the whole
// orrery wanders and precesses, so minute five is painted over fresh ground.

(function () {
  const TWO_PI = Math.PI * 2;
  const MAX_PLANETS = 9;
  const MAX_MOONS = 14;
  const LUT_SIZE = 1024;
  const LUT_MAX = 7;              // absorbance mapped across the table
  const WARMUP_STEPS = 540;       // frames of orbit painted on entry (see draw)

  // Inks: hex at full strength. On paper they are absorbed (Beer–Lambert);
  // on the night slate they lift the ground toward themselves, the same law
  // mirrored, so both grounds share one buffer and one deposit model.
  const INKS = [
    { name: 'Umber & indigo', night: false, paper: '#EEE7D7', planet: '#5A3418', moon: '#1F2E63', accent: '#D8391C' },
    { name: 'Riso teal & pink', night: false, paper: '#F3F0E9', planet: '#00737F', moon: '#E0457B', accent: '#1E2B6E' },
    { name: 'Graphite', night: false, paper: '#ECEAE5', planet: '#2A2A2E', moon: '#4A4A52', accent: '#D8391C' },
    { name: 'Night slate', night: true, paper: '#101318', planet: '#E7D6B3', moon: '#7FC4C8', accent: '#F06A45' },
  ];

  const PRESETS = {
    calm: { grains: 0.7, scatter: 0.28, speed: 0.5, moons: 2, accent: 0.15, relations: 2 },
    drop: { grains: 1.5, scatter: 0.8, speed: 1.45, moons: 10, accent: 1, relations: 3 },
    // The same system on a dark slate, pale sand and a blue moon ink.
    night: { inks: 3, grains: 0.9, scatter: 0.45, speed: 0.7, moons: 4, accent: 0.4, relations: 2 },
    // A long exposure: slow orbits and a paper that barely forgets, so the
    // sheet becomes a portrait of the whole set.
    portrait: { grains: 0.55, scatter: 0.35, speed: 0.3, moons: 5, accent: 0.3, relations: 2, memory: 110 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['grains', 'scatter', 'speed', 'moons', 'accent', 'relations'];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  // Absorbance that brings the ground to this ink at unit density.
  function inkVector(hex, night) {
    const c = hexRgb(hex);
    return c.map((v) => -Math.log(clamp(night ? 1 - v : v, 0.02, 0.98)));
  }

  VIZ.register({
    id: 'sandtraveler',
    name: 'Sand Traveler Orbits',
    order: 804,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      { key: 'planets', label: 'Planets', type: 'range', min: 3, max: MAX_PLANETS, default: 6, step: 1 },
      { key: 'relations', label: 'Relations per planet', type: 'range', min: 1, max: 3, default: 2, step: 1 },
      { key: 'grains', label: 'Sand per frame', type: 'range', min: 0.2, max: 2, default: 0.8, step: 0.01 },
      { key: 'scatter', label: 'Grain spread', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'speed', label: 'Orbit speed', type: 'range', min: 0.1, max: 3, default: 0.6, step: 0.01 },
      { key: 'moons', label: 'Moons (most at once)', type: 'range', min: 0, max: 12, default: 3, step: 1 },
      { key: 'accent', label: 'Accent ink', type: 'range', min: 0, max: 1, default: 0.2, step: 0.01 },
      { key: 'memory', label: 'Paper memory (s)', type: 'range', min: 5, max: 120, default: 35, step: 1 },
      { key: 'response', label: 'Music response', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'repaper', label: 'Fresh sheet', run() { this.needsClear = true; } },
      { id: 'reseed', label: 'New orrery', run() { this.init(); } },
    ],

    gallery: {
      title: 'Sand Traveler Orbits',
      technique: 'An invisible orrery (sun, up to nine planets on precessing ellipses, short-lived moons) whose related pairs sprinkle Tarbell-style sand grains along their joining lines, dense at each body and thinning to the middle; grains land in a Float32 per-channel absorbance buffer shown through Beer–Lambert over a fibred paper, with a half-life and self-limiting deposits so the sheet never saturates',
      brief: 'The planets are never drawn. What you see is their relations: grainy sand nebulae and spirograph ribbons laid down on paper as the bodies orbit. The bass widens the scatter of the grains; every kick gives one planet a new moon, whose first sweep lands as a burst of sand in one place; the snare knocks one orbit into a new ellipse and prints that planet\'s relations in the accent ink for a moment; hats sift fine dust along the full length of the lines. The drop adds moons, relations, speed and the accent colour; the breakdown lets the moons retire and the sheet slowly forgets.',
      lineage: [
        'The Planets orrery (Raph\'s 2016 sketch and its web port) and Magnetosphere, through the purist judge\'s batch 06 proposal.',
        'Jared Tarbell\'s Sand Traveler and sand-painter strokes: grains along a line between two moving bodies, reach random-walking so the bands breathe.',
        'Current\'s Float32 accumulation, turned subtractive: absorbance per channel over paper instead of light on black, per TASTE\'s call for paper and ink over glow.',
      ],
    },

    bufW: 0, bufH: 0, A: null, base: null, image: null, pix: null, off: null, offCtx: null,
    lut: null, baseKey: '', needsClear: true, env: null,

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); this.needsClear = true; this.lastT = null; },

    init() {
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        bass: 0, hat: 0, pad: 0, lvl: 0, floor: 0.12, ceil: 0.55, auto: 0,
        lastKick: -10, lastSnare: -10,
      };
      // Every planet is rolled up front, so raising the count reveals
      // planets that were already decided.
      this.planets = [];
      for (let i = 0; i < MAX_PLANETS; i++) {
        const e = Math.random() * 0.32;
        this.planets.push({
          th: Math.random() * TWO_PI,
          dir: Math.random() < 0.72 ? 1 : -1,
          e, eT: e,
          phi: Math.random() * TWO_PI, phiT: 0,
          prec: (Math.random() - 0.5) * 0.02,
          r: 0.5, jitter: 0.85 + Math.random() * 0.3,
          x: 0, y: 0, hot: 0,
        });
      }
      this.planets.forEach((pl) => { pl.phiT = pl.phi; });
      this.moons = [];
      this.nextParent = 0;
      this.links = new Map();       // relation key → sand-painter state
      this.time = 0;
      this.wanderT = Math.random() * 100;
      this.needsClear = true;
    },

    allocate(p) {
      const dw = Math.round(p.width * p.pixelDensity());
      const dh = Math.round(p.height * p.pixelDensity());
      // Three channels are faded and tone-mapped per pixel each frame, so the
      // buffer is capped near 1.6 Mpx (1080p runs at ~0.9x, where sand grain
      // still reads as grain).
      const k = Math.min(1, Math.sqrt(1.6e6 / (dw * dh)));
      const w = Math.max(16, Math.round(dw * k));
      const h = Math.max(16, Math.round(dh * k));
      if (w === this.bufW && h === this.bufH) return;
      this.bufW = w; this.bufH = h;
      this.A = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
      this.off = document.createElement('canvas');
      this.off.width = w; this.off.height = h;
      this.offCtx = this.off.getContext('2d');
      this.image = this.offCtx.createImageData(w, h);
      this.pix = new Uint32Array(this.image.data.buffer);
      this.baseKey = '';
      this.needsClear = true;
    },

    // The sheet itself: ground colour, a faint fibre texture, and a lamp
    // falloff toward the corners, precomputed per size and ink set.
    buildBase(ink) {
      const key = this.bufW + 'x' + this.bufH + ':' + ink.name;
      if (key === this.baseKey) return;
      this.baseKey = key;
      const W = this.bufW, H = this.bufH, N = W * H;
      const g = hexRgb(ink.paper);
      const base = this.base = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
      // Fibre: value noise stretched along x plus fine speckle.
      const cw = 64, ch = 64;
      const lat = new Float32Array(cw * ch);
      for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
      const sx = cw / W * 3.2, sy = ch / H * 9;
      for (let y = 0; y < H; y++) {
        const fy = y * sy, iy = fy | 0, ty = fy - iy;
        const y0 = (iy % ch) * cw, y1 = ((iy + 1) % ch) * cw;
        const vy = (y / H - 0.5) * 2;
        for (let x = 0; x < W; x++) {
          const fx = x * sx, ix = fx | 0, tx = fx - ix;
          const x0 = ix % cw, x1 = (ix + 1) % cw;
          const n = lerp(lerp(lat[y0 + x0], lat[y0 + x1], tx), lerp(lat[y1 + x0], lat[y1 + x1], tx), ty);
          const vx = (x / W - 0.5) * 2;
          const vig = 1 - 0.09 * (vx * vx * 0.6 + vy * vy);
          const tex = 1 + (n - 0.5) * 0.035 + (Math.random() - 0.5) * 0.025;
          const q = y * W + x;
          for (let c = 0; c < 3; c++) {
            const v = ink.night ? g[c] * (0.8 + 0.2 * vig) * tex : g[c] * vig * tex;
            base[c][q] = clamp(v, 0, 1) * 255;
          }
        }
      }
    },

    buildLut() {
      const lut = new Float32Array(LUT_SIZE + 1);
      for (let i = 0; i <= LUT_SIZE; i++) lut[i] = Math.exp(-(i / LUT_SIZE) * LUT_MAX);
      this.lut = lut;
    },

    // Planet i of n on its ellipse, in virtual units around the wandering sun.
    placePlanets(n, geo, dt, speed) {
      const pls = this.planets;
      for (let i = 0; i < MAX_PLANETS; i++) {
        const pl = pls[i];
        const rT = (0.14 + 0.86 * Math.pow((i + 1) / n, 0.95)) * pl.jitter;
        pl.r = ease(pl.r, Math.min(rT, 1.12), 1.5, dt);
        pl.e = ease(pl.e, pl.eT, 2.2, dt);
        pl.phiT += pl.prec * dt;
        pl.phi = ease(pl.phi, pl.phiT, 2.2, dt);
        pl.hot = Math.max(0, pl.hot - dt / 1.1);
        // Inner planets turn faster (1/r, gentler than Kepler's 1/r^1.5 so
        // the inner relations sweep rather than smear into a disc).
        pl.th += pl.dir * speed * dt * 0.16 / Math.max(0.12, pl.r);
        const a = pl.r, b = a * Math.sqrt(1 - pl.e * pl.e);
        const ex = a * Math.cos(pl.th) - a * pl.e, ey = b * Math.sin(pl.th);
        const cp = Math.cos(pl.phi), sp = Math.sin(pl.phi);
        pl.x = geo.cx + (ex * cp - ey * sp) * geo.sx;
        pl.y = geo.cy + (ex * sp + ey * cp) * geo.sy;
      }
    },

    placeMoons(dt, speed) {
      for (const m of this.moons) {
        const pl = this.planets[m.parent];
        m.age += dt;
        m.th += m.dir * speed * dt * m.w;
        m.x = pl.x + Math.cos(m.th) * m.rad;
        m.y = pl.y + Math.sin(m.th) * m.rad * 0.92;
        m.life = m.retiring ? Math.max(0, m.life - dt / 2.5) : Math.min(1, m.life + dt / 0.15);
        if (!m.retiring && m.age > m.span) m.retiring = true;
      }
      this.moons = this.moons.filter((m) => !(m.retiring && m.life <= 0));
    },

    addMoon(n, cap, S) {
      if (cap < 1) return;
      const live = this.moons.filter((m) => !m.retiring);
      // Over the cap, the oldest moon starts to retire.
      while (live.length >= cap) { live.shift().retiring = true; }
      if (this.moons.length >= MAX_MOONS) return;
      // Parents cycle through the planets in a shuffled order, so successive moons
      // land in different parts of the sheet.
      if (!this.order || this.order.length !== n) {
        this.order = [];
        for (let i = 0; i < n; i++) this.order.splice(Math.floor(Math.random() * (i + 1)), 0, i);
      }
      this.nextParent = (this.nextParent + 1) % n;
      const parent = this.order[this.nextParent];
      let other = Math.floor(Math.random() * (n + 1)) - 1;     // −1 is the sun
      if (other === parent) other = -1;
      this.moons.push({
        parent, other,
        th: Math.random() * TWO_PI, dir: Math.random() < 0.5 ? 1 : -1,
        w: 1.8 + Math.random() * 2.4,
        rad: S * (0.035 + Math.random() * 0.06),
        age: 0, span: 9 + Math.random() * 7, life: 0, retiring: false,
        id: (this.moonSerial = (this.moonSerial || 0) + 1),
      });
    },

    link(key) {
      let L = this.links.get(key);
      if (!L) {
        L = { reachA: 0.3 + Math.random() * 0.5, reachB: 0.3 + Math.random() * 0.5, seen: 0 };
        this.links.set(key, L);
      }
      L.seen = this.frameNo;
      return L;
    },

    // Sprinkle one relation's grains between (x0,y0) and (x1,y1), in buffer px.
    sprinkle(L, x0, y0, x1, y1, count, amt, vec, spread, dust) {
      const W = this.bufW, H = this.bufH;
      const A0 = this.A[0], A1 = this.A[1], A2 = this.A[2];
      const v0 = vec[0] * amt, v1 = vec[1] * amt, v2 = vec[2] * amt;
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const nx = -dy / len, ny = dx / len;
      // Tarbell's sand painter: each end's reach wanders, so the gradient of
      // grains breathes in bands rather than sitting as a fixed smear.
      L.reachA = clamp(L.reachA + (Math.random() - 0.5) * 0.06, 0.08, 0.95);
      L.reachB = clamp(L.reachB + (Math.random() - 0.5) * 0.06, 0.08, 0.95);
      const wid = spread * len;
      const cnt = count | 0;
      for (let j = 0; j < cnt; j++) {
        const fromA = j & 1;
        const u = Math.random();
        // Dense at the body, thinning toward the middle.
        const tl = u * u * 0.5 * (fromA ? L.reachA : L.reachB);
        const t = fromA ? tl : 1 - tl;
        // Scatter grows away from the ends (a spindle) and is roughly
        // Gaussian; a small floor keeps the ends from being hard dots.
        const gss = (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
        const off = gss * (wid * Math.sin(Math.PI * t) + 2.2);
        const off2 = (Math.random() - 0.5) * 2.2;
        const x = (x0 + dx * t + nx * off + off2 * ny) | 0;
        const y = (y0 + dy * t + ny * off - off2 * nx) | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const q = y * W + x;
        // Grains land lighter where the paper is already dark, so the heavy
        // ends of relations deepen slowly instead of going to black blots.
        const w = (1 - tl * 1.6) / (1 + (A0[q] + A1[q] + A2[q]) * 0.7);
        if (w <= 0) continue;
        A0[q] += v0 * w; A1[q] += v1 * w; A2[q] += v2 * w;
      }
      // Hats: fine dust sifted evenly along the whole line.
      const nd = dust | 0;
      for (let j = 0; j < nd; j++) {
        const t = Math.random();
        const off = (Math.random() - 0.5) * 3;
        const x = (x0 + dx * t + nx * off) | 0;
        const y = (y0 + dy * t + ny * off) | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const q = y * W + x;
        A0[q] += v0 * 0.9; A1[q] += v1 * 0.9; A2[q] += v2 * 0.9;
      }
    },

    // An arc of thrown sand along the new moon's orbit, heaviest where the
    // moon is and thinning round both ways (a full dotted ring read as a stamp).
    splash(cx, cy, rad, count, amt, vec, a0) {
      const W = this.bufW, H = this.bufH;
      const A0 = this.A[0], A1 = this.A[1], A2 = this.A[2];
      const cnt = count | 0;
      for (let j = 0; j < cnt; j++) {
        const sd = Math.random() - Math.random();
        const a = a0 + sd * 2.1;
        const g = (Math.random() + Math.random() + Math.random() - 1.5);
        const r = rad * (1 + g * 0.2 * (1.2 - Math.abs(sd)));
        const x = (cx + Math.cos(a) * r) | 0, y = (cy + Math.sin(a) * r * 0.92) | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const q = y * W + x;
        // A lighter self-limit than the relations: the mark has to read even
        // where it lands on sand that is already dark.
        const w = amt / (1 + (A0[q] + A1[q] + A2[q]) * 0.2);
        A0[q] += vec[0] * w; A1[q] += vec[1] * w; A2[q] += vec[2] * w;
      }
    },

    listen(s, t, dt, P, n, S, response) {
      const e = this.env;
      const b0 = s[0], b4 = s[4];
      let kick = false, snare = false;
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - e.lastKick > 0.22) { e.lastKick = t; kick = true; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - e.lastSnare > 0.28) { e.lastSnare = t; snare = true; }
      this.prev.set(s);
      const bass = Math.max(s[0], s[1]) / 100;
      // Slow attack: a fast one widened every relation at once on each kick,
      // the full-frame pulse TASTE rules out. The bass is the continuous swell.
      e.bass = ease(e.bass, bass, bass > e.bass ? 3 : 1.2, dt);
      e.pad = ease(e.pad, (s[2] + s[3]) / 200, 1.2, dt);
      const hat = (s[6] + s[7] + s[8]) / 300;
      e.hat = ease(e.hat, hat, hat > e.hat ? 30 : 8, dt);
      // Track follower: a slow level on the low bands, ranged against a
      // floor and ceiling that adapt to the track.
      e.lvl = ease(e.lvl, (s[0] + s[1]) / 200, 0.9, dt);
      e.ceil = Math.max(e.lvl, e.ceil - dt * 0.008);
      e.floor = Math.min(e.lvl, e.floor + dt * 0.006);
      if (kick && response > 0) this.addMoon(n, Math.round(P.moons), S);
      if (snare && response > 0) {
        // One orbit is knocked into a new ellipse, and that planet's
        // relations print in the accent ink while it settles.
        const i = Math.floor(Math.random() * n);
        const pl = this.planets[i];
        pl.eT = Math.random() * 0.55 * Math.min(1, response);
        pl.phiT += (Math.random() - 0.5) * 1.2 * Math.min(1, response);
        pl.hot = 1;
      }
    },

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      this.allocate(p);
      if (!this.lut) this.buildLut();
      const ink = INKS[clamp(Math.round(params.inks), 0, INKS.length - 1)];
      this.buildBase(ink);
      if (this.needsClear) {
        for (const a of this.A) a.fill(0);
        this.needsClear = false;
        this.warmup = WARMUP_STEPS;
      }

      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      this.frameNo = (this.frameNo || 0) + 1;

      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      const response = params.response;
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const n = clamp(Math.round(params.planets), 3, MAX_PLANETS);
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);

      this.listen(signals, t, dt, P, n, S, response);
      const span = Math.max(0.18, e.ceil - e.floor);
      const want = follow ? smooth(0.35, 0.8, (e.lvl - e.floor) / span) : 0;
      e.auto = ease(e.auto, want, want > e.auto ? 1.4 : 0.35, dt);
      // The breakdown exhales: once the energy falls away from a peak, the
      // paper forgets faster, so the drop's crowded sheet clears back toward
      // the planets' own relations instead of sitting there as mud.
      e.peak = Math.max(e.auto, (e.peak || 0) - dt * 0.03);
      const exhale = follow ? clamp((e.peak - e.auto) * 2.2, 0, 1) : 0;

      // The sun wanders slowly around the stage, so the painting migrates
      // and fresh paper keeps coming under the orbits.
      this.wanderT += dt;
      const wt = this.wanderT;
      const geo = {
        cx: W * (0.5 + 0.07 * Math.sin(wt * 0.021) + 0.03 * Math.sin(wt * 0.053 + 2)),
        cy: H * (0.5 + 0.08 * Math.sin(wt * 0.017 + 1) + 0.03 * Math.sin(wt * 0.047)),
        sx: W * 0.53, sy: H * 0.5,
      };
      const speed = P.speed * (0.8 + 0.5 * e.bass * response);

      // Buffer geometry.
      const Wb = this.bufW, Hb = this.bufH;
      const kb = Wb / W;
      const grains = P.grains * 520 * kb * kb * (1 + 0.25 * e.pad);
      const spread = 0.02 + P.scatter * 0.09 * (0.45 + 1.1 * e.bass * response);
      const dust = e.hat * response * 70 * kb * kb;
      const amt = 0.026;
      const relK = clamp(Math.round(P.relations), 1, 3);
      const vPlanet = inkVector(ink.planet, ink.night);
      const vMoon = inkVector(ink.moon, ink.night);
      const vAccent = inkVector(ink.accent, ink.night);
      const acc = clamp(P.accent, 0, 1);

      const self = this;
      const step = (sdt, painting) => {
        self.placePlanets(n, geo, sdt, speed);
        self.placeMoons(sdt, speed);
        const pls = self.planets;
        const sunX = geo.cx * kb, sunY = geo.cy * kb;
        const bx = (i) => (i < 0 ? sunX : pls[i].x * kb);
        const by = (i) => (i < 0 ? sunY : pls[i].y * kb);
        // Planet relations: each planet to its next relK outward neighbours,
        // the innermost also to the sun.
        for (let i = -1; i < n; i++) {
          for (let k = 1; k <= relK; k++) {
            const j = i + k;
            if (j >= n) break;
            const L = self.link(i + ':' + j);
            const len = Math.hypot(bx(j) - bx(i), by(j) - by(i)) / kb;
            const cnt = grains * clamp(len / 260, 0.35, 1.8) * (k === 1 ? 1 : 0.7);
            const hot = Math.max(i >= 0 ? pls[i].hot : 0, pls[j].hot);
            // The accent ink shows on snared planets, and as a thread through
            // the relations when the accent is up.
            let vec = vPlanet;
            if (hot > 0.02 || ((i + j) % 4 === 1 && acc > 0.55)) vec = mixVec(vPlanet, vAccent, Math.max(hot, (acc - 0.55) / 0.45));
            self.sprinkle(L, bx(i), by(i), bx(j), by(j), cnt * painting, amt, vec, spread, dust * painting);
          }
        }
        // Moon relations: to the parent (a tight spirograph ribbon along the
        // parent's orbit) and to one other body (a long sweeping fan).
        for (const m of self.moons) {
          if (m.parent >= n) { m.retiring = true; }
          if (!m.splashed && painting > 0) {
            // The kick made visible: the new moon lands as a handful of sand
            // thrown in a ring around its planet, one confined mark per beat.
            m.splashed = true;
            self.splash(bx(m.parent), by(m.parent), m.rad * kb, grains * 6 * Math.min(1.5, response), amt * 2.2, mixVec(vMoon, vAccent, acc * 0.6), m.th);
          }
          const burst = 1 + 5 * Math.exp(-m.age / 0.3);
          const lw = m.life * burst;
          const mx = m.x * kb, my = m.y * kb;
          const L1 = self.link('m' + m.id + 'p');
          const vm = mixVec(vMoon, vAccent, acc * 0.6);
          self.sprinkle(L1, bx(m.parent), by(m.parent), mx, my, grains * 0.55 * lw * painting, amt, vm, spread * 1.4, 0);
          const o = m.other < n ? m.other : -1;
          const L2 = self.link('m' + m.id + 'o');
          const len = Math.hypot(bx(o) - mx, by(o) - my) / kb;
          self.sprinkle(L2, mx, my, bx(o), by(o), grains * clamp(len / 260, 0.35, 1.8) * lw * painting, amt, vm, spread, dust * painting);
        }
      };

      // A blank sheet on entry would take several seconds to show anything,
      // so the orrery paints a few seconds ahead in one go at the moment of
      // switching, where a hitch is invisible. Fading is applied once at the
      // end instead of per step, which is close enough for a warm-up.
      if (this.warmup > 0) {
        for (let s = 0; s < this.warmup; s++) step(1 / 60, 0.8);
        const f = Math.exp(-(this.warmup / 60) / params.memory * 0.5);
        for (const a of this.A) for (let q = 0; q < a.length; q++) a[q] *= f;
        this.warmup = 0;
      }
      step(dt, 1);
      // Forget relations whose bodies have gone.
      if (this.frameNo % 120 === 0) {
        for (const [k, L] of this.links) if (this.frameNo - L.seen > 10) this.links.delete(k);
      }

      // Fade and shade in one pass.
      const fade = Math.exp(-dt / (params.memory * (1 - 0.8 * exhale)));
      const lut = this.lut, pix = this.pix;
      const A0 = this.A[0], A1 = this.A[1], A2 = this.A[2];
      const B0 = this.base[0], B1 = this.base[1], B2 = this.base[2];
      const ls = LUT_SIZE / LUT_MAX;
      const night = ink.night;
      for (let q = 0, N = Wb * Hb; q < N; q++) {
        let a0 = A0[q], a1 = A1[q], a2 = A2[q];
        let i0 = (a0 * ls) | 0, i1 = (a1 * ls) | 0, i2 = (a2 * ls) | 0;
        if (i0 > LUT_SIZE) i0 = LUT_SIZE;
        if (i1 > LUT_SIZE) i1 = LUT_SIZE;
        if (i2 > LUT_SIZE) i2 = LUT_SIZE;
        let r, g, b;
        if (night) {
          r = 255 - (255 - B0[q]) * lut[i0];
          g = 255 - (255 - B1[q]) * lut[i1];
          b = 255 - (255 - B2[q]) * lut[i2];
        } else {
          r = B0[q] * lut[i0];
          g = B1[q] * lut[i1];
          b = B2[q] * lut[i2];
        }
        pix[q] = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
        A0[q] = a0 * fade; A1[q] = a1 * fade; A2[q] = a2 * fade;
      }
      const c2 = p.drawingContext;
      if (Wb === c2.canvas.width && Hb === c2.canvas.height) {
        c2.putImageData(this.image, 0, 0);
        return;
      }
      this.offCtx.putImageData(this.image, 0, 0);
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.drawImage(this.off, 0, 0, W, H);
      c2.restore();
    },
  });

  function mixVec(a, b, u) {
    u = clamp(u, 0, 1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  }
})();
