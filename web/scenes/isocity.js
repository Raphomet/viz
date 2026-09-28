// Iso City: an endless, dense isometric metropolis drifting past under a sun
// that crosses the sky, drawn flat like a printed city poster (eBoy, SimCity
// 2000 box art, a tourist map) with real cast shadows instead of glow. The
// idea that makes it more than a sim screenshot: the city *breathes skyward*
// with the track. In the drop a wave of growth rolls out from the middle of
// the view and the towers extrude floor after floor into a Manhattan, then
// settle back to brownstones when the breakdown exhales, while the cranes
// keep time by setting one storey per kick.
//   kick   -> one crane somewhere in view sets its hanging slab: a new storey
//             lands on that tower, flashing in the crane's colour, with a puff
//             of dust. Cranes take turns, so the beat walks around the city.
//   snare  -> a train bursts onto one of the elevated viaducts and crosses
//   hats   -> windows glint (a sun flash by day, a light switched on by night)
//   bass   -> traffic speed and the pace of the drift across the city
//   drop   -> the skyward wave; the breakdown lets the towers sink back
// The day turns on its own (or is pinned): shadows swing and lengthen, the
// light goes gold, then the city lights up building by building at dusk.
//
// Rendering: Canvas 2D only. Everything is an axis-aligned box on an
// isometric grid, drawn back to front by (x + y). Window grids are canvas
// patterns mapped onto each wall with a per-face transform, so a 40-storey
// tower costs the same as a 3-storey one. Shadows are one path of hexagons
// (each box's footprint swept along the sun) filled once.

(function () {
  'use strict';

  // ------------------------------------------------------------ helpers
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mod = (a, n) => ((a % n) + n) % n;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function h2(i, j, s) {
    let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = h2(i, j, s), b = h2(i + 1, j, s), c = h2(i, j + 1, s), d = h2(i + 1, j + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  const fbm = (x, y, s) => 0.6 * vnoise(x, y, s) + 0.28 * vnoise(x * 2.3, y * 2.3, s + 7) + 0.12 * vnoise(x * 5.1, y * 5.1, s + 13);

  // ------------------------------------------------------------ world layout
  // A block is 4 units: a 1-unit street, then three 1-unit lots.
  const PITCH = 4;
  const FLOOR = 0.34;         // storey height in world units
  const INSET = 0.07;         // gap between a building and its lot edge
  const RIVER_EVERY = 11, RIVER_AT = 5;   // block columns that are river
  const VIADUCT_EVERY = 4, VIADUCT_AT = 1; // block rows whose street carries a viaduct
  const DECK_Z0 = 1.05, DECK_Z1 = 1.25, TRAIN_Z1 = 1.68;
  const CELL = 32;            // window pattern cell, px

  const P0WALLS = 8;
  const lotX0 = (l) => Math.floor(l / 3) * PITCH + 1 + mod(l, 3);
  const isRiverBlock = (bx) => mod(bx, RIVER_EVERY) === RIVER_AT;
  const isViaductRow = (by) => mod(by, VIADUCT_EVERY) === VIADUCT_AT;

  // ------------------------------------------------------------ palettes
  const PALETTES = [
    { name: 'Brownstone',
      walls: ['#b4553e', '#d8c6a2', '#8c9199', '#ece0c4', '#744c3c', '#8fb8c8', '#dca23e', '#5e9c93'],
      roof: ['#7b7770', '#9a8f80', '#5f6a70'], street: '#595c62', walk: '#cbc3b1', grass: '#72a04c',
      tree: ['#3e7a3c', '#5b9440'], water: '#3f7fa8', quay: '#a79f8e', crane: '#f0b21c',
      accent: '#ffd23a', train: ['#d8482e', '#e9e4da'], cars: ['#e0412f', '#f2c230', '#2f6fd1', '#f1eee6', '#24282e', '#3aa37a'],
      tank: '#8a5a3a', spire: '#bcdce6', haze: '#e9dcc4' },
    { name: 'Riso',
      walls: ['#f6bfd0', '#9ad6d0', '#a9b6ea', '#fff0ae', '#ff8db0', '#58bbb6', '#f3ecdc', '#ffd23f'],
      roof: ['#f3ecdc', '#ffd6e2', '#cfe9e6'], street: '#4a63c9', walk: '#f3ecdc', grass: '#3fb5ad',
      tree: ['#1a8f89', '#2da49c'], water: '#3155c4', quay: '#e8dfc9', crane: '#ffcf2f',
      accent: '#ff4f8b', train: ['#ff4f8b', '#f3ecdc'], cars: ['#ff4f8b', '#ffd23f', '#f3ecdc', '#1aa6a0', '#3155c4'],
      tank: '#ff7aa2', spire: '#ff4f8b', haze: '#f3ecdc' },
    { name: 'Whitewash',
      walls: ['#f4efe4', '#ece2cf', '#e7ddd0', '#d9e4ea', '#f2d6b8', '#fbf8f0', '#cfd8d6', '#bcd3dc'],
      roof: ['#c5643c', '#d77c4f', '#e9e1d2'], street: '#b39a78', walk: '#e8dcc2', grass: '#8fae58',
      tree: ['#4f7d3a', '#6d9446'], water: '#2aa3b5', quay: '#dccfb3', crane: '#2f63b8',
      accent: '#2f63b8', train: ['#2f63b8', '#f4efe4'], cars: ['#2f63b8', '#e8b33a', '#c5643c', '#f4efe4', '#3c9aa8'],
      tank: '#6f8fa6', spire: '#8fc3dc', haze: '#f3ead8' },
    { name: 'Ink',
      walls: ['#f2f0ea', '#d9d7d0', '#bdbbb4', '#8f8d88', '#e6e3db', '#a8a6a0', '#ffffff', '#c9c7c0'],
      roof: ['#6c6a66', '#9a9892', '#4b4a47'], street: '#2a2a2c', walk: '#dedbd3', grass: '#b8b6ae',
      tree: ['#5a5955', '#77766f'], water: '#3a3a3e', quay: '#cfccc4', crane: '#e8362a',
      accent: '#e8362a', train: ['#e8362a', '#f2f0ea'], cars: ['#e8362a', '#f2f0ea', '#2a2a2c', '#9a9892'],
      tank: '#77766f', spire: '#e8362a', haze: '#efece4' },
  ];
  // Every colour a palette uses goes into one flat table, so lighting is
  // computed once per colour per frame (three face tones each), not per box.
  for (const P of PALETTES) {
    const all = [];
    const add = (h) => { all.push(hex(h)); return all.length - 1; };
    P.iWalls = P.walls.map(add); P.iRoof = P.roof.map(add);
    P.iStreet = add(P.street); P.iWalk = add(P.walk); P.iGrass = add(P.grass);
    P.iTree = P.tree.map(add); P.iWater = add(P.water); P.iQuay = add(P.quay);
    P.iCrane = add(P.crane); P.iAccent = add(P.accent); P.iTrain = P.train.map(add);
    P.iCars = P.cars.map(add); P.iTank = add(P.tank); P.iSpire = add(P.spire);
    P.iConcrete = add('#b9b4aa'); P.iDark = add('#34373d'); P.iGlassTop = add('#5d6f82');
    P.iAC = add('#c9c6bf'); P.iBoat = add('#f2efe6'); P.iPillar = add('#a39d92');
    P.all = all;
    P.hazeRGB = hex(P.haze);
  }

  // ------------------------------------------------------------ window patterns
  // Three façade styles (punched windows, curtain glass, ribbon bands), each
  // as a glass layer (always drawn) and a lit layer (faded in at night).
  function makePatterns(g) {
    const N = 8, sz = N * CELL;
    const out = [];
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const litCols = ['#ffd98a', '#ffe7b0', '#ffc466', '#fff3d6', '#cfe0ff', '#ffb050'];
    for (let style = 0; style < 3; style++) {
      const rect = style === 0 ? [9, 7, 14, 17] : style === 1 ? [2, 3, 28, 27] : [0, 9, 32, 14];
      const mk = (lit) => {
        const c = document.createElement('canvas');
        c.width = sz; c.height = sz;
        const x = c.getContext('2d');
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const [rx, ry, rw, rh] = rect;
            if (!lit) {
              const v = rnd();
              x.fillStyle = style === 1 ? `rgba(24,40,64,${0.5 + v * 0.18})` : `rgba(22,26,38,${0.62 + v * 0.2})`;
              x.fillRect(i * CELL + rx, j * CELL + ry, rw, rh);
              // A lighter sky reflection across the upper part of the pane.
              x.fillStyle = `rgba(210,225,240,${style === 1 ? 0.16 : 0.1})`;
              x.fillRect(i * CELL + rx, j * CELL + ry + rh * 0.55, rw, rh * 0.45);
            } else if (rnd() < (style === 1 ? 0.5 : 0.42)) {
              x.fillStyle = litCols[Math.floor(rnd() * litCols.length)];
              if (style === 2) x.fillRect(i * CELL + rx - 1, j * CELL + ry, rw + 2, rh);
              else x.fillRect(i * CELL + rx, j * CELL + ry, rw, rh);
            }
          }
        }
        return g.createPattern(c, 'repeat');
      };
      out.push({ glass: mk(false), lit: mk(true), cols: style === 1 ? 4 : 3 });
    }
    // Bare concrete frame for storeys still under construction.
    const c = document.createElement('canvas');
    c.width = CELL * 2; c.height = CELL;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(30,32,38,0.62)'; x.fillRect(0, 0, CELL * 2, CELL);
    x.fillStyle = 'rgba(230,226,216,0.95)';
    x.fillRect(0, 0, CELL * 2, 5); x.fillRect(0, 0, 5, CELL); x.fillRect(CELL, 0, 5, CELL);
    out.frame = g.createPattern(c, 'repeat');
    return out;
  }

  // ------------------------------------------------------------ the scene
  VIZ.register({
    id: 'isocity',
    name: 'Iso City',
    order: 602,

    params: [
      { key: 'skyward', label: 'Skyward growth', type: 'range', min: 0, max: 3, default: 1.5, step: 0.01 },
      { key: 'time', label: 'Time of day', type: 'select', options: ['Day cycle', 'Morning', 'Golden hour', 'Night'], default: 0 },
      { key: 'dayLen', label: 'Day length (s)', type: 'range', min: 30, max: 300, default: 100, step: 1 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'speed', label: 'Drift speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 16, max: 44, default: 24, step: 0.5 },
      { key: 'clouds', label: 'Clouds', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'react', label: 'Reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    gallery: {
      title: 'Iso City',
      technique: 'Canvas 2D isometric painter: an endless procedural grid of boxes sorted by x + y, window grids as canvas patterns mapped onto each wall by a per-face transform, one path of sun-swept hexagons for the cast shadows, a lighting table recomputed per colour per frame from a moving sun, and a recorded drop envelope read back with a distance delay so the growth travels as a wave',
      brief: 'A dense isometric city drawn like a printed poster, drifting past on the diagonal: blocks of brick, limestone and glass, rooftop water tanks and gardens, parks, a river with boats and bridges, elevated viaducts, cars on every street and people on the pavements. The sun crosses the sky on its own, so shadows swing and lengthen, the light turns gold, and at dusk the city switches on building by building. The music: every kick lights one tower near the front from the street up in the palette accent, like a struck meter, and one crane in view sets the storey it was lowering, which flashes as it lands. The snare sends a train across a viaduct. Hats make single windows glint. The bass sets the traffic and the pace of the drift. The drop is the idea: a wave rolls out from the middle of the view and the city grows skyward, pale glass spires extruding out of the old roofs into a Manhattan, and in the breakdown they sink back into the brownstones.',
      lineage: [
        'Brief (2026-09-28), Raph: "Something interesting with an isometrically-drawn city." Kept clear of Isle (a WebGL low-poly island turning on a plinth): this is a flat Canvas 2D poster city, dense and urban, that travels. Visual lineage: eBoy\'s Pixorama posters, SimCity 2000 box art, tourist map cutaways.',
        'The idea: the city breathes skyward with the track. Buildings are generated from a district noise field; in the drop a recorded drop envelope is read back with a delay proportional to distance from the view centre, so growth rolls outward as a wave, and the extruded floors are a different material (pale glass spires out of brick roofs) so the drop reads as the city sprouting rather than rescaling.',
        'v1: everything worked first time structurally but the city was a wall of towers from the first frame and the drop grew everything, so there was no contrast; the kick (one crane setting a storey) was too small to find; cranes were 15 stray yellow lines. Jolt 0.27 area, ratio 1.26, calm but no hot spot.',
        'v2: towers restricted to downtown districts, low-rise elsewhere; fewer cranes drawn as trusses; added the beat tower: each kick fills one front-row tower\'s windows with the palette accent from the street up (0.12 s) and fades over 0.6 s, the confined, legible kick. Heat map now shows one bright vertical strip per kick.',
        'v3: growth as glass spires on a subset of buildings; clouds moved onto a wind-shifted world grid so they reliably cross the view, then made solid and sun-tinted after the 96 s run showed lavender translucent disks at dawn. 96 s run: day, golden hour, a night where the city lights up building by building (lovely), dawn.',
        'v4: fewer growers (so the drop keeps the city\'s colour), faster exhale after the drop, tighter wave, growth threshold raised so the spires are back in their roofs ~4 s into the breakdown. Final jolt: drop kickArea 0.28, kickMean 0.048, drift 0.039, ratio 1.25, calm; build kick 0.25 / 1.29. The area is mostly the drift of a moving city; the kick itself is one bright tower strip in heat.png.',
      ],
    },

    setup() {},

    enter() {
      this.last = null;
      this.T = 0;
      this.camX = 0; this.camY = 0;
      this.trav = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.beat = 0.48;
      this.lots = new Map();
      this.trains = [];
      this.trainN = 0;
      this.hist = new Float32Array(150); this.histT = 0; this.histI = 0;
      this.visSites = []; this.visFaces = [];
      this.puffs = [];
      this.kickQ = 0; this.hatQ = 0; this.snareQ = 0;
      this.pruneT = 0;
    },

    // Onsets against slow baselines, so a pad or riser that lifts a whole
    // band does not read as a hit; only a jump does.
    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        if (since.kick < 1.2) this.beat = lerp(this.beat, since.kick, 0.3);
        since.kick = 0;
        this.kickQ++;
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.6 : 2.2, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.3) {
        since.snare = 0;
        this.snareQ++;
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatQ++;
      }
      e.prevH = hRaw;
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.0, dt);
    },

    // ---------------------------------------------------------- lots
    lot(lx, ly) {
      const key = lx * 131071 + ly;
      let L = this.lots.get(key);
      if (L) return L;
      const bx = Math.floor(lx / 3), by = Math.floor(ly / 3);
      const x0 = lotX0(lx), y0 = lotX0(ly);
      L = { lx, ly, x0, y0, key };
      const r = (k) => h2(lx, ly, k);
      if (isRiverBlock(bx)) { L.type = 'water'; }
      else if (h2(bx, by, 3) < 0.09) {
        L.type = 'park';
        L.trees = [];
        const n = 2 + Math.floor(r(4) * 3);
        for (let i = 0; i < n; i++) L.trees.push([x0 + 0.18 + r(10 + i) * 0.64, y0 + 0.18 + r(20 + i) * 0.64, 0.17 + r(30 + i) * 0.1, i & 1]);
      } else {
        L.type = 'bldg';
        const d = fbm(x0 / 13 + 50, y0 / 13 + 50, 5);
        const tall = sstep(0.5, 0.86, d);
        L.tall = tall;
        let floors = 2 + Math.floor(r(1) * 4);
        if (r(2) < 0.1 + tall * 0.8) floors += Math.floor(tall * (5 + r(3) * 24));
        L.floors = floors;
        L.wall = Math.floor(r(5) * P0WALLS);
        L.roofC = Math.floor(r(6) * 3);
        L.style = floors > 14 ? (r(7) < 0.6 ? 1 : 2) : (r(7) < 0.75 ? 0 : 2);
        L.pox = Math.floor(r(8) * 8); L.poy = Math.floor(r(9) * 8);
        L.litTh = r(11) * 0.85;
        L.setback = floors > 12 && r(12) < 0.6;
        const ro = r(13);
        L.roof = floors > 14 ? (ro < 0.35 ? 'spire' : ro < 0.6 ? 'box' : ro < 0.8 ? 'antenna' : 'none')
          : (ro < 0.3 ? 'tank' : ro < 0.5 ? 'garden' : ro < 0.8 ? 'ac' : 'none');
        L.grow = r(14) < 0.05 + 0.3 * tall ? 0.5 + 1.4 * tall + 0.5 * r(18) : 0;
        if (r(15) < 0.012 + 0.025 * tall && floors > 3) {
          L.site = true;
          L.target = floors + 14 + Math.floor(r(16) * 16);
          L.floors = Math.max(2, Math.floor(floors * 0.5));
          L.lastSet = -99;
          L.jib = r(17) * Math.PI * 2;
        }
      }
      this.lots.set(key, L);
      return L;
    },

    // ---------------------------------------------------------- lighting
    light(params, T) {
      const mode = params.time | 0;
      let ph;
      if (mode === 1) ph = 0.17;
      else if (mode === 2) ph = 0.575;
      else if (mode === 3) ph = 0.8;
      else ph = mod(0.2 + T / Math.max(10, params.dayLen), 1);
      const DAY = 0.64;
      const up = ph < DAY ? sstep(0, 0.06, Math.min(ph, DAY - ph)) : 0;
      const warm = ph < DAY ? 1 - sstep(0.04, 0.2, Math.min(ph, DAY - ph)) : 1;
      const st = clamp01(ph / DAY);
      const el = Math.max(0.12, Math.sin(Math.PI * st) * 0.95);
      // The sun swings so shadows sweep from up-left, through down-left, to
      // down-right: always falling somewhere the camera can see.
      const az = lerp(-0.12, -0.98, st) * Math.PI;
      const L = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
      const ambDay = [0.62, 0.64, 0.7], ambGold = [0.5, 0.42, 0.52], ambNight = [0.17, 0.2, 0.34];
      const sunDay = [0.46, 0.44, 0.4], sunGold = [0.62, 0.4, 0.22];
      const amb = mix3(ambNight, mix3(ambDay, ambGold, warm), up);
      const sun = mix3([0, 0, 0], mix3(sunDay, sunGold, warm), up);
      const faces = [];
      const n = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
      const ak = [1.0, 0.86, 0.72];
      for (let f = 0; f < 3; f++) {
        const lam = Math.max(0, n[f][0] * L[0] + n[f][1] * L[1] + n[f][2] * L[2]);
        faces.push([amb[0] * ak[f] + sun[0] * lam * 1.2, amb[1] * ak[f] + sun[1] * lam * 1.2, amb[2] * ak[f] + sun[2] * lam * 1.2]);
      }
      const shadowLen = Math.min(5, Math.cos(el) / Math.sin(el));
      return {
        ph, up, warm, night: 1 - up, faces,
        sdx: -Math.cos(az) * shadowLen, sdy: -Math.sin(az) * shadowLen,
        shadowA: 0.3 * up,
        haze: mix3([0.1, 0.12, 0.24], mix3([1, 1, 1], [1.0, 0.72, 0.5], warm), up),
      };
    },

    buildCSS(P, lt) {
      const css = [[], [], []];
      for (let f = 0; f < 3; f++) {
        const m = lt.faces[f];
        for (let i = 0; i < P.all.length; i++) {
          const c = P.all[i];
          css[f][i] = `rgb(${Math.round(clamp01(c[0] * m[0]) * 255)},${Math.round(clamp01(c[1] * m[1]) * 255)},${Math.round(clamp01(c[2] * m[2]) * 255)})`;
        }
      }
      return css;
    },

    // ---------------------------------------------------------- draw
    draw(p, s, params, ctx) {
      const now = p.millis() / 1000;
      const dt = this.last == null ? 1 / 60 : clamp(now - this.last, 0, 0.1);
      this.last = now;
      this.T += dt;
      const T = this.T;
      if (!this.pats) this.pats = makePatterns(p.drawingContext);
      this.listen(s, dt);
      const e = this.env;
      const R = params.react;
      const P = PALETTES[clamp(params.palette | 0, 0, PALETTES.length - 1)];
      const S = params.zoom;
      const W = ctx.width, H = ctx.height;

      // Drift: along +x with a slow meander in y. The bass sets the pace.
      const pace = params.speed * (0.55 + 0.9 * e.bass + 0.5 * e.drop);
      this.trav += pace * dt;
      this.camX = this.trav;
      this.camY = -0.22 * this.trav + 7 * Math.sin(this.trav * 0.013);
      const cx = this.camX, cy = this.camY;
      const cu = cx - cy, cv = cx + cy;

      // The drop envelope, recorded so the skyward wave can read it late at
      // a distance from the centre.
      this.histT += dt;
      while (this.histT >= 1 / 30) {
        this.histT -= 1 / 30;
        this.histI = (this.histI + 1) % this.hist.length;
        this.hist[this.histI] = e.drop;
      }
      const G = params.skyward;
      const growAt = (delay) => {
        const k = Math.min(this.hist.length - 1, Math.round(delay * 30));
        return sstep(0.2, 0.9, this.hist[mod(this.histI - k, this.hist.length)]);
      };

      const lt = this.light(params, T);
      const css = this.buildCSS(P, lt);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineJoin = 'round'; g.lineCap = 'butt';
      g.setLineDash([]);
      const base = g.getTransform();
      const bA = base.a, bB = base.b, bC = base.c, bD = base.d, bE = base.e, bF = base.f;
      const setT = (a, b, c, d, e2, f) => g.setTransform(
        bA * a + bC * b, bB * a + bD * b, bA * c + bC * d, bB * c + bD * d, bA * e2 + bC * f + bE, bB * e2 + bD * f + bF);

      const ox = W / 2 - cu * S, oy = H / 2 - cv * S / 2;
      const SX = (x, y) => (x - y) * S + ox;
      const SY = (x, y, z) => (x + y) * S / 2 - z * S + oy;

      // Visible band in u = x - y and v = x + y; v extends below the screen
      // far enough that tall towers standing off the bottom edge still show.
      const uMin = -W / 2 / S + cu - 1.5, uMax = W / 2 / S + cu + 1.5;
      const vMin = -H / S + cv - 2, vMax = H / S + cv + 2;
      const zMaxW = 42 * FLOOR * (1 + G * 1.8 * 1.0);
      const vExt = vMax + 2 * zMaxW;

      // ---- ground
      g.fillStyle = css[0][P.iStreet];
      g.fillRect(-2, -2, W + 4, H + 4);
      const quad = (x0, y0, x1, y1, z) => {
        g.moveTo(SX(x0, y0), SY(x0, y0, z)); g.lineTo(SX(x1, y0), SY(x1, y0, z));
        g.lineTo(SX(x1, y1), SY(x1, y1, z)); g.lineTo(SX(x0, y1), SY(x0, y1, z)); g.closePath();
      };
      const bxMin = Math.floor(((uMin + vMin) / 2) / PITCH) - 1, bxMax = Math.floor(((uMax + vMax) / 2) / PITCH) + 1;
      const byMin = Math.floor(((vMin - uMax) / 2) / PITCH) - 1, byMax = Math.floor(((vMax - uMin) / 2) / PITCH) + 1;
      const inView = (x, y, r) => { const u = x - y, v = x + y; return u > uMin - r && u < uMax + r && v > vMin - r && v < vMax + r; };

      // Sidewalks / block interiors, parks, river.
      const walk = [], parks = [], rivers = [];
      for (let bx = bxMin; bx <= bxMax; bx++) {
        for (let by = byMin; by <= byMax; by++) {
          const x0 = bx * PITCH + 1, y0 = by * PITCH + 1;
          if (!inView(x0 + 1.5, y0 + 1.5, 4)) continue;
          if (isRiverBlock(bx)) rivers.push([bx, by]);
          else if (h2(bx, by, 3) < 0.09) parks.push([x0, y0]);
          else walk.push([x0, y0]);
        }
      }
      g.beginPath();
      for (const [x0, y0] of walk) quad(x0 - 0.1, y0 - 0.1, x0 + 3.1, y0 + 3.1, 0);
      for (const [x0, y0] of parks) quad(x0 - 0.1, y0 - 0.1, x0 + 3.1, y0 + 3.1, 0);
      for (const [bx, by] of rivers) quad(bx * PITCH + 0.9, by * PITCH + 0.9, bx * PITCH + 4.1, by * PITCH + 4.1, 0);
      g.fillStyle = css[0][P.iWalk]; g.fill();
      g.beginPath();
      for (const [x0, y0] of parks) quad(x0 + 0.05, y0 + 0.05, x0 + 2.95, y0 + 2.95, 0);
      g.fillStyle = css[0][P.iGrass]; g.fill();
      g.beginPath();
      for (const [x0, y0] of parks) { quad(x0 + 1.42, y0 + 0.05, x0 + 1.58, y0 + 2.95, 0); quad(x0 + 0.05, y0 + 1.42, x0 + 2.95, y0 + 1.58, 0); }
      g.fillStyle = css[0][P.iWalk]; g.fill();

      // River: water sits a little below the street, so the quay wall on the
      // far bank and the bridge decks read as solid.
      const WZ = -0.28;
      if (rivers.length) {
        g.beginPath();
        for (const [bx, by] of rivers) quad(bx * PITCH + 1.25, by * PITCH + 1, bx * PITCH + 3.95, by * PITCH + 4, 0);
        g.fillStyle = css[2][P.iQuay]; g.fill();
        g.beginPath();
        for (const [bx, by] of rivers) quad(bx * PITCH + 1.25, by * PITCH + 1, bx * PITCH + 3.95, by * PITCH + 4, WZ);
        g.fillStyle = css[0][P.iWater]; g.fill();
        // Far-bank wall (faces +x) reaching down to the water.
        g.beginPath();
        for (const [bx, by] of rivers) {
          const x = bx * PITCH + 1.25, ya = by * PITCH + 1, yb = by * PITCH + 4;
          g.moveTo(SX(x, ya), SY(x, ya, 0)); g.lineTo(SX(x, yb), SY(x, yb, 0));
          g.lineTo(SX(x, yb), SY(x, yb, WZ)); g.lineTo(SX(x, ya), SY(x, ya, WZ)); g.closePath();
        }
        g.fillStyle = css[1][P.iQuay]; g.fill();
        // Ripples drifting downstream.
        g.beginPath();
        for (const [bx, by] of rivers) {
          for (let k = 0; k < 7; k++) {
            const x = bx * PITCH + 1.5 + h2(bx, by * 7 + k, 40) * 2.2;
            const y = by * PITCH + 1 + mod(h2(bx, by * 7 + k, 41) * 3 + T * 0.35, 3);
            g.moveTo(SX(x, y), SY(x, y, WZ)); g.lineTo(SX(x, y + 0.35), SY(x, y + 0.35, WZ));
          }
        }
        g.strokeStyle = `rgba(255,255,255,${0.18 + 0.2 * lt.up})`; g.lineWidth = 1; g.stroke();
        // Bridge deck edges: the +y face of each street crossing the water.
        g.beginPath();
        for (const [bx, by] of rivers) {
          const xa = bx * PITCH + 1.25, xb = bx * PITCH + 3.95, y = by * PITCH + 1;
          g.moveTo(SX(xa, y), SY(xa, y, 0)); g.lineTo(SX(xb, y), SY(xb, y, 0));
          g.lineTo(SX(xb, y), SY(xb, y, -0.2)); g.lineTo(SX(xa, y), SY(xa, y, -0.2)); g.closePath();
        }
        g.fillStyle = css[2][P.iStreet]; g.fill();
      }

      // Lane markings: dashes pinned to the world, so they travel with it.
      g.beginPath();
      for (let by = byMin; by <= byMax; by++) {
        const y = by * PITCH + 0.5;
        const xa = Math.max(Math.floor((uMin + vMin) / 2), y + uMin), xb = Math.min(Math.ceil((uMax + vMax) / 2), y + uMax);
        const x1 = Math.max(xa, vMin - y), x2 = Math.min(xb, vMax - y);
        if (x2 <= x1) continue;
        for (let x = Math.floor(x1); x < x2; x += 1) { g.moveTo(SX(x + 0.2, y), SY(x + 0.2, y, 0)); g.lineTo(SX(x + 0.6, y), SY(x + 0.6, y, 0)); }
      }
      for (let bx = bxMin; bx <= bxMax; bx++) {
        if (isRiverBlock(bx)) continue;
        const x = bx * PITCH + 0.5;
        const y1 = Math.max(x - uMax, vMin - x), y2 = Math.min(x - uMin, vMax - x);
        if (y2 <= y1) continue;
        for (let y = Math.floor(y1); y < y2; y += 1) { g.moveTo(SX(x, y + 0.2), SY(x, y + 0.2, 0)); g.lineTo(SX(x, y + 0.6), SY(x, y + 0.6, 0)); }
      }
      g.strokeStyle = `rgba(245,240,225,${0.5 * (0.35 + 0.65 * lt.up) + 0.2})`;
      g.lineWidth = Math.max(1, S * 0.05); g.stroke();

      // ---- collect drawables
      const items = [];
      const lxMin = Math.floor(((uMin + vMin) / 2) / PITCH) * 3 - 3, lxMax = Math.ceil(((uMax + vExt) / 2) / PITCH) * 3 + 3;
      const lyMin = Math.floor(((vMin - uMax) / 2) / PITCH) * 3 - 3, lyMax = Math.ceil(((vExt - uMin) / 2) / PITCH) * 3 + 3;
      const shadows = [];
      const sites = [];
      const cands = [];
      const faces = [];
      for (let lx = lxMin; lx <= lxMax; lx++) {
        const x0 = lotX0(lx);
        for (let ly = lyMin; ly <= lyMax; ly++) {
          const y0 = lotX0(ly);
          const u = x0 - y0, v = x0 + y0 + 1;
          if (u < uMin - 1.5 || u > uMax + 1.5 || v < vMin - 1 || v > vExt) continue;
          const L = this.lot(lx, ly);
          if (L.type === 'water') continue;
          if (L.type === 'park') {
            if (v > vMax + 2) continue;
            for (const t of L.trees) {
              items.push({ k: t[0] + t[1], t: 1, tr: t });
              shadows.push(t);
            }
            continue;
          }
          let h;
          if (L.site) h = L.floors * FLOOR;
          else {
            const dist = Math.hypot(x0 + 0.5 - cx, y0 + 0.5 - cy);
            L.k = 1 + G * L.grow * growAt(dist / 14);
            h = L.floors * L.k * FLOOR;
          }
          L.h = h;
          // Screen cull: the box spans from its top back corner to its base front corner.
          const top = SY(x0, y0, h + (L.site ? 2.6 : 1.2)), bot = SY(x0 + 1, y0 + 1, 0);
          if (top > H + 2 || bot < -2) continue;
          items.push({ k: x0 + y0 + 1, t: 0, L });
          if (bot < H + S * 0.5) faces.push(L);
          if (L.site && bot < H - S && top > -S * 3 && Math.abs(SX(x0, y0) - W / 2) < W * 0.44) sites.push(L);
          else if (!L.site && bot < H * 0.97 && bot > H * 0.5 && L.floors > 5 && Math.abs(SX(x0, y0) - W / 2) < W * 0.34) { L.bot = bot; cands.push(L); }
        }
      }

      // Traffic. Each lane is a conveyor of cars, with a small wobble per car
      // so they bunch and spread; the bass sets how fast the conveyor runs.
      const lanePace = 0.6 + 2.6 * e.bass + 0.8 * e.drop;
      this.laneT = (this.laneT || 0) + lanePace * dt;
      const LT = this.laneT;
      const SP = 3.1;
      for (let by = byMin; by <= byMax; by++) {
        for (let lane = 0; lane < 2; lane++) {
          const y = by * PITCH + (lane ? 0.7 : 0.3), dir = lane ? 1 : -1;
          const xa = Math.max(y + uMin, vMin - y) - 1, xb = Math.min(y + uMax, vMax - y) + 1;
          if (xb <= xa) continue;
          const off = h2(by, lane, 50) * SP + dir * LT;
          for (let k = Math.floor((xa - off) / SP); k <= Math.ceil((xb - off) / SP); k++) {
            if (h2(k, by * 2 + lane, 51) < 0.25) continue;
            const x = off + k * SP + Math.sin(T * 0.4 + k * 1.7) * 0.5;
            if (x < xa || x > xb) continue;
            items.push({ k: x + y, t: 2, x, y, ax: 0, dir, c: P.iCars[Math.floor(h2(k, by * 2 + lane, 52) * P.iCars.length)] });
          }
        }
      }
      for (let bx = bxMin; bx <= bxMax; bx++) {
        if (isRiverBlock(bx)) {
          // Boats on the river instead of cars.
          for (let lane = 0; lane < 2; lane++) {
            const x = bx * PITCH + (lane ? 3.1 : 2.1), dir = lane ? 1 : -1;
            const ya = Math.max(x - uMax, vMin - x) - 2, yb = Math.min(x - uMin, vMax - x) + 2;
            const off = h2(bx, lane, 60) * 9 + dir * T * 0.45;
            for (let k = Math.floor((ya - off) / 9); k <= Math.ceil((yb - off) / 9); k++) {
              const y = off + k * 9;
              items.push({ k: x + y - 0.3, t: 4, x, y, dir });
            }
          }
          continue;
        }
        for (let lane = 0; lane < 2; lane++) {
          const x = bx * PITCH + (lane ? 0.3 : 0.7), dir = lane ? 1 : -1;
          const ya = Math.max(x - uMax, vMin - x) - 1, yb = Math.min(x - uMin, vMax - x) + 1;
          if (yb <= ya) continue;
          const off = h2(bx, lane, 53) * SP + dir * LT;
          for (let k = Math.floor((ya - off) / SP); k <= Math.ceil((yb - off) / SP); k++) {
            if (h2(k, bx * 2 + lane, 54) < 0.25) continue;
            const y = off + k * SP + Math.sin(T * 0.4 + k * 2.3) * 0.5;
            if (y < ya || y > yb) continue;
            items.push({ k: x + y, t: 2, x, y, ax: 1, dir, c: P.iCars[Math.floor(h2(k, bx * 2 + lane, 55) * P.iCars.length)] });
          }
        }
      }

      // Viaducts: one segment per unit of street, each drawing the bit of any
      // train above it, so deck and train sort correctly against buildings.
      const vRows = [];
      for (let by = byMin; by <= byMax; by++) {
        if (!isViaductRow(by)) continue;
        const y = by * PITCH;
        const xa = Math.max(y + uMin, vMin - y) - 2, xb = Math.min(y + uMax, vExt - y) + 1;
        if (xb <= xa) continue;
        vRows.push({ y, xa, xb });
        for (let x = Math.floor(xa); x <= xb; x++) items.push({ k: x + 0.5 + y + 0.5 + 0.3, t: 3, x, y });
      }

      // Snare: a train enters from off-screen on a viaduct in view.
      while (this.snareQ > 0) {
        this.snareQ--;
        if (!vRows.length) continue;
        const row = vRows[this.trainN % vRows.length];
        const dir = (this.trainN >> 1) % 2 ? -1 : 1;
        this.trainN++;
        const len = 5;
        this.trains.push({ y: row.y, dir, x: dir > 0 ? row.xa - 1 : row.xb + len * 1.12 + 1, v: 11 + 3 * R, n: len, c: this.trainN % 2 });
      }
      for (const tr of this.trains) tr.x += tr.dir * tr.v * dt;
      this.trains = this.trains.filter((tr) => {
        const row = vRows.find((r) => r.y === tr.y);
        if (!row) return false;
        return tr.dir > 0 ? tr.x - tr.n * 1.12 < row.xb + 2 : tr.x + tr.n * 1.12 > row.xa - 2;
      });

      // Kick: the least recently served crane in view sets its storey.
      const kicked = this.kickQ > 0;
      while (this.kickQ > 0) {
        this.kickQ--;
        let best = null;
        for (const L of sites) if (L.floors < L.target && (!best || L.lastSet < best.lastSet)) best = L;
        if (best) {
          best.floors++;
          best.lastSet = T;
          best.flashAmp = clamp(0.6 + 0.4 * R, 0, 1.4);
          this.puffs.push({ x: best.x0 + 0.5, y: best.y0 + 0.5, z: best.floors * FLOOR, t0: T });
        }
      }
      for (const L of sites) if (L.floors >= L.target) L.site = false;
      // ...and one tall tower near the middle lights up floor by floor in
      // the palette's accent, like a building-sized level meter struck once.
      if (kicked && cands.length) {
        let best = null, bs = -1;
        for (const L of cands) {
          if (T - (L.beatT || -99) < 2.5) continue;
          const sc = L.h * 0.6 + (L.bot / H) * 14 + h2(L.lx, L.ly, Math.floor(T * 2)) * 2;
          if (sc > bs) { bs = sc; best = L; }
        }
        if (best) { best.beatT = T; best.beatA = clamp(0.55 + 0.45 * R, 0, 1.2); }
      }
      this.puffs = this.puffs.filter((q) => T - q.t0 < 0.8);

      // Hats: a few windows catch the light (or switch on, by night).
      while (this.hatQ > 0) {
        this.hatQ--;
        const n = Math.round(4 + 6 * R + 6 * e.drop);
        for (let i = 0; i < n && faces.length; i++) {
          const L = faces[Math.floor(Math.random() * faces.length)];
          if (L.site) continue;
          const st = this.pats[L.style];
          const rows = Math.max(1, Math.floor(L.h / FLOOR));
          L.fl = { f: Math.random() < 0.5 ? 1 : 2, c: Math.floor(Math.random() * st.cols), r: Math.floor(Math.random() * rows), t0: T };
        }
      }

      // ---- shadows: every box swept along the sun into one path.
      if (lt.shadowA > 0.01) {
        const dx = lt.sdx, dy = lt.sdy;
        g.beginPath();
        const hull = (x0, y0, x1, y1, h) => {
          const ex = dx * h, ey = dy * h;
          // Minkowski sum of the footprint and the shadow vector, as a hexagon.
          const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
          const c = [];
          for (let i = 0; i < 4; i++) {
            const a = pts[i], b = pts[(i + 1) % 4];
            // Edge normal (outward, CCW in world) against the sweep direction.
            const nx = b[1] - a[1], ny = -(b[0] - a[0]);
            const facing = nx * ex + ny * ey > 0;
            c.push([a, b, facing]);
          }
          let first = true;
          for (let i = 0; i < 4; i++) {
            const [a, b, fc] = c[i];
            const ax = fc ? a[0] + ex : a[0], ay = fc ? a[1] + ey : a[1];
            const bx2 = fc ? b[0] + ex : b[0], by2 = fc ? b[1] + ey : b[1];
            if (first) { g.moveTo(SX(ax, ay), SY(ax, ay, 0)); first = false; } else g.lineTo(SX(ax, ay), SY(ax, ay, 0));
            g.lineTo(SX(bx2, by2), SY(bx2, by2, 0));
          }
          g.closePath();
        };
        for (const it of items) {
          if (it.t === 0) {
            const L = it.L;
            hull(L.x0 + INSET, L.y0 + INSET, L.x0 + 1 - INSET, L.y0 + 1 - INSET, L.h);
          } else if (it.t === 1) {
            const t = it.tr, r = t[2] * 0.8;
            hull(t[0] - r, t[1] - r, t[0] + r, t[1] + r, 0.55);
          }
        }
        for (const row of vRows) hull(row.xa, row.y + 0.15, row.xb, row.y + 0.85, DECK_Z1);
        g.fillStyle = `rgba(28,24,60,${lt.shadowA})`;
        g.fill();
      }

      // Streetlight pools and pedestrians.
      const nightK = lt.night;
      if (nightK > 0.05) {
        g.beginPath();
        for (const [x0, y0] of walk) {
          for (let k = 0; k < 3; k++) {
            const a = x0 + 0.5 + k, b = y0 - 0.05;
            g.moveTo(SX(a, b) + S * 0.55, SY(a, b, 0)); g.ellipse(SX(a, b), SY(a, b, 0), S * 0.55, S * 0.28, 0, 0, Math.PI * 2);
            const c2 = x0 - 0.05, d2 = y0 + 0.5 + k;
            g.moveTo(SX(c2, d2) + S * 0.55, SY(c2, d2, 0)); g.ellipse(SX(c2, d2), SY(c2, d2, 0), S * 0.55, S * 0.28, 0, 0, Math.PI * 2);
          }
        }
        g.fillStyle = `rgba(255,190,110,${0.22 * nightK})`; g.fill();
      }
      g.beginPath();
      const pr = Math.max(0.8, S * 0.045);
      for (const [x0, y0] of walk) {
        for (let k = 0; k < 4; k++) {
          const r = h2(x0, y0, 70 + k), sp = 0.12 + 0.1 * r;
          const along = mod(r * 13 + T * sp * (k & 1 ? 1 : -1), 3.2) - 0.05;
          let a, b;
          if (k < 2) { a = x0 + along; b = y0 - 0.05 + (k ? 3.2 : 0); } else { a = x0 - 0.05 + (k === 3 ? 3.2 : 0); b = y0 + along; }
          const X = SX(a, b), Y = SY(a, b, 0);
          g.rect(X - pr * 0.5, Y - pr * 2.6, pr, pr * 2.6);
        }
      }
      g.fillStyle = nightK > 0.5 ? 'rgba(20,20,30,0.8)' : 'rgba(40,36,44,0.75)'; g.fill();

      // ---- draw sorted
      items.sort((a, b) => a.k - b.k);
      const pats = this.pats;

      // A box with its two visible walls and roof. Colour indices into css.
      const box = (x0, y0, x1, y1, z0, z1, ci, ciTop) => {
        const ax = SX(x1, y0), ay0 = SY(x1, y0, z0), ay1 = SY(x1, y0, z1);
        const bxp = SX(x1, y1), by0 = SY(x1, y1, z0), by1 = SY(x1, y1, z1);
        const cxp = SX(x0, y1), cy0 = SY(x0, y1, z0), cy1 = SY(x0, y1, z1);
        const dxp = SX(x0, y0), dy1 = SY(x0, y0, z1);
        g.beginPath(); g.moveTo(ax, ay0); g.lineTo(bxp, by0); g.lineTo(bxp, by1); g.lineTo(ax, ay1); g.closePath();
        g.fillStyle = css[1][ci]; g.fill();
        g.beginPath(); g.moveTo(cxp, cy0); g.lineTo(bxp, by0); g.lineTo(bxp, by1); g.lineTo(cxp, cy1); g.closePath();
        g.fillStyle = css[2][ci]; g.fill();
        g.beginPath(); g.moveTo(dxp, dy1); g.lineTo(ax, ay1); g.lineTo(bxp, by1); g.lineTo(cxp, cy1); g.closePath();
        g.fillStyle = css[0][ciTop == null ? ci : ciTop]; g.fill();
      };
      // Window grid on both walls: pattern space is CELL px per window column
      // and CELL px per storey, mapped onto the wall by a per-face transform.
      const windows = (L, x0, y0, x1, y1, z0, z1, pat, alpha, cols, pox, poy) => {
        const hpx = (z1 - z0) / FLOOR * CELL;
        if (hpx <= 0.5) return;
        const wy = y1 - y0, wx = x1 - x0;
        g.fillStyle = pat;
        g.globalAlpha = alpha;
        // +x wall, horizontal along +y.
        let a = -S * wy / (cols * CELL), b = S / 2 * wy / (cols * CELL);
        setT(a, b, 0, -S * FLOOR / CELL, SX(x1, y0), SY(x1, y0, z0));
        g.translate(-pox * CELL, -poy * CELL);
        g.fillRect(pox * CELL, poy * CELL, cols * CELL, hpx);
        // +y wall, horizontal along +x.
        a = S * wx / (cols * CELL); b = S / 2 * wx / (cols * CELL);
        setT(a, b, 0, -S * FLOOR / CELL, SX(x0, y1), SY(x0, y1, z0));
        g.translate(-(pox + 3) * CELL, -poy * CELL);
        g.fillRect((pox + 3) * CELL, poy * CELL, cols * CELL, hpx);
        g.setTransform(base);
        g.globalAlpha = 1;
      };
      const cell = (x0, y0, x1, y1, face, c, r, cols, inset) => {
        // One window cell's quad on a wall, in screen space.
        const z0 = r * FLOOR + FLOOR * 0.2, z1 = (r + 1) * FLOOR - FLOOR * 0.15;
        if (face === 1) {
          const ya = y0 + (y1 - y0) * (c + inset) / cols, yb = y0 + (y1 - y0) * (c + 1 - inset) / cols;
          g.moveTo(SX(x1, ya), SY(x1, ya, z0)); g.lineTo(SX(x1, yb), SY(x1, yb, z0));
          g.lineTo(SX(x1, yb), SY(x1, yb, z1)); g.lineTo(SX(x1, ya), SY(x1, ya, z1)); g.closePath();
        } else {
          const xa = x0 + (x1 - x0) * (c + inset) / cols, xb = x0 + (x1 - x0) * (c + 1 - inset) / cols;
          g.moveTo(SX(xa, y1), SY(xa, y1, z0)); g.lineTo(SX(xb, y1), SY(xb, y1, z0));
          g.lineTo(SX(xb, y1), SY(xb, y1, z1)); g.lineTo(SX(xa, y1), SY(xa, y1, z1)); g.closePath();
        }
      };

      const drawBuilding = (L) => {
        const x0 = L.x0 + INSET, y0 = L.y0 + INSET, x1 = L.x0 + 1 - INSET, y1 = L.y0 + 1 - INSET;
        const st = pats[L.style];
        const wallC = P.iWalls[L.wall];
        const roofC = P.iRoof[L.roofC];
        const litA = sstep(L.litTh, L.litTh + 0.12, nightK * 1.1);
        let zTop;
        if (L.site) {
          // Finished storeys, then two bare-frame storeys with the crane.
          const done = Math.max(0, L.floors - 2);
          const zd = done * FLOOR;
          zTop = L.floors * FLOOR;
          box(x0, y0, x1, y1, 0, zd, wallC, roofC);
          windows(L, x0, y0, x1, y1, 0, zd, st.glass, 1, st.cols, L.pox, L.poy);
          if (litA > 0.01) windows(L, x0, y0, x1, y1, 0, zd, st.lit, litA, st.cols, L.pox, L.poy);
          box(x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, zd, zTop, P.iConcrete);
          windows(L, x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, zd, zTop, pats.frame, 1, 1, 0, 0);
          // The storey the last kick set flashes in the crane's colour.
          const ft = T - L.lastSet;
          if (ft < 0.6) {
            const a = (1 - ft / 0.6) * (L.flashAmp || 1);
            const za = zTop - FLOOR;
            g.globalAlpha = clamp01(a);
            box(x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, za, zTop + 0.02, P.iAccent);
            g.globalAlpha = 1;
          }
          this.drawCrane(g, L, SX, SY, S, css, P, T, zTop, x0, y0, x1, y1, lt);
          return;
        }
        const h = L.h;
        // The building as generated, then (in the drop) a new glass spire
        // extruding out of its roof: the growth is a different material, so
        // the skyward wave reads as the city sprouting, not just rescaling.
        const parts = L.parts || (L.parts = []);
        parts.length = 0;
        const hb = L.floors * FLOOR;
        if (L.setback) {
          const zbf = Math.round(L.floors * 0.55) * FLOOR, q = 0.14;
          parts.push([x0, y0, x1, y1, 0, zbf, L.pox, 0], [x0 + q, y0 + q, x1 - q, y1 - q, zbf, hb, L.pox + 1, 0]);
        } else parts.push([x0, y0, x1, y1, 0, hb, L.pox, 0]);
        const grown = h - hb;
        if (grown > FLOOR * 0.4) {
          const tp = parts[parts.length - 1], q = 0.1;
          parts.push([tp[0] + q, tp[1] + q, tp[2] - q, tp[3] - q, hb, h, L.pox + 2, 1]);
        }
        for (const pt of parts) {
          if (pt[7]) {
            const sp = pats[1];
            box(pt[0], pt[1], pt[2], pt[3], pt[4], pt[5], P.iSpire);
            windows(L, pt[0], pt[1], pt[2], pt[3], pt[4], pt[5], sp.glass, 1, sp.cols, pt[6], L.poy);
            if (litA > 0.01) windows(L, pt[0], pt[1], pt[2], pt[3], pt[4], pt[5], sp.lit, litA, sp.cols, pt[6], L.poy);
          } else {
            box(pt[0], pt[1], pt[2], pt[3], pt[4], pt[5], wallC, roofC);
            windows(L, pt[0], pt[1], pt[2], pt[3], pt[4], pt[5], st.glass, 1, st.cols, pt[6], L.poy);
            if (litA > 0.01) windows(L, pt[0], pt[1], pt[2], pt[3], pt[4], pt[5], st.lit, litA, st.cols, pt[6], L.poy);
          }
        }
        const tp = parts[parts.length - 1];
        if (tp[7]) {
          // A needle on the growing tip.
          const mx = (tp[0] + tp[2]) / 2, my = (tp[1] + tp[3]) / 2, X = SX(mx, my);
          g.beginPath(); g.moveTo(X, SY(mx, my, h)); g.lineTo(X, SY(mx, my, h + 0.7));
          g.strokeStyle = css[1][P.iDark]; g.lineWidth = Math.max(1, S * 0.05); g.stroke();
        } else this.roofItems(g, L, tp[0], tp[1], tp[2], tp[3], h, SX, SY, S, css, P, T, nightK, box);
        // Kick: the façade fills with accent light from the street up, then fades.
        if (L.beatT != null) {
          const bt = T - L.beatT;
          if (bt < 0.75) {
            const zr = h * clamp01(bt / 0.12), a = clamp01((bt < 0.12 ? 1 : 1 - (bt - 0.12) / 0.63) * L.beatA);
            const bp = this.beatPattern(g, L.style, P);
            for (const pt of parts) {
              if (zr <= pt[4]) break;
              windows(L, pt[0], pt[1], pt[2], pt[3], pt[4], Math.min(pt[5], zr), pt[7] ? this.beatPattern(g, 1, P) : bp, a, pt[7] ? pats[1].cols : st.cols, pt[6], L.poy);
            }
          }
        }
        // Hat glint: one window flares and fades.
        if (L.fl) {
          const ft = T - L.fl.t0;
          if (ft > 0.35) L.fl = null;
          else if (L.fl.r * FLOOR < (L.setback ? h * 0.5 : h) - FLOOR) {
            const a = (1 - ft / 0.35) * clamp01(0.5 + 0.5 * R);
            g.beginPath();
            cell(x0, y0, x1, y1, L.fl.f, L.fl.c, L.fl.r, st.cols, 0.12);
            g.fillStyle = nightK > 0.5 ? `rgba(255,236,190,${a})` : `rgba(255,255,250,${a})`;
            g.fill();
          }
        }
      };

      for (const it of items) {
        if (it.t === 0) drawBuilding(it.L);
        else if (it.t === 1) {
          const [x, y, r, v] = it.tr;
          const X = SX(x, y), Y = SY(x, y, 0);
          g.fillStyle = css[1][P.iDark];
          g.fillRect(X - S * 0.03, Y - S * 0.28, S * 0.06, S * 0.28);
          g.beginPath(); g.arc(X, Y - S * (0.28 + r), S * r * 1.2, 0, Math.PI * 2);
          g.fillStyle = css[2][P.iTree[v]]; g.fill();
          g.beginPath(); g.arc(X - S * r * 0.25, Y - S * (0.34 + r), S * r * 0.8, 0, Math.PI * 2);
          g.fillStyle = css[0][P.iTree[v]]; g.fill();
        } else if (it.t === 2) {
          const hl = 0.22, hw = 0.1;
          if (it.ax === 0) box(it.x - hl, it.y - hw, it.x + hl, it.y + hw, 0, 0.13, it.c);
          else box(it.x - hw, it.y - hl, it.x + hw, it.y + hl, 0, 0.13, it.c);
          // Cabin glass, set back from the nose.
          const f = it.dir * 0.05;
          g.beginPath();
          if (it.ax === 0) quad(it.x - 0.12 + f, it.y - 0.08, it.x + 0.1 + f, it.y + 0.08, 0.14);
          else quad(it.x - 0.08, it.y - 0.12 + f, it.x + 0.08, it.y + 0.1 + f, 0.14);
          g.fillStyle = css[1][P.iDark]; g.fill();
          if (nightK > 0.3) {
            const nx = it.ax === 0 ? it.x + it.dir * hl : it.x, ny = it.ax === 0 ? it.y : it.y + it.dir * hl;
            g.fillStyle = it.dir > 0 ? `rgba(255,244,200,${nightK})` : `rgba(255,60,50,${nightK})`;
            g.fillRect(SX(nx, ny) - 1.2, SY(nx, ny, 0.07) - 1.2, 2.4, 2.4);
          }
        } else if (it.t === 3) this.drawDeck(g, it, SX, SY, S, css, P, box, nightK);
        else if (it.t === 4) {
          const { x, y, dir } = it;
          g.beginPath();
          g.moveTo(SX(x - 0.12, y - dir * 0.2), SY(x - 0.12, y - dir * 0.2, WZ));
          g.lineTo(SX(x - 0.3, y - dir * 1.1), SY(x - 0.3, y - dir * 1.1, WZ));
          g.moveTo(SX(x + 0.12, y - dir * 0.2), SY(x + 0.12, y - dir * 0.2, WZ));
          g.lineTo(SX(x + 0.3, y - dir * 1.1), SY(x + 0.3, y - dir * 1.1, WZ));
          g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1; g.stroke();
          box(x - 0.16, y - 0.35, x + 0.16, y + 0.35, WZ, WZ + 0.12, P.iBoat);
          box(x - 0.1, y - 0.12 - dir * 0.08, x + 0.1, y + 0.12 - dir * 0.08, WZ + 0.12, WZ + 0.26, P.iBoat, P.iAccent);
        }
      }

      // Dust puffs where a storey landed.
      if (this.puffs.length) {
        g.beginPath();
        for (const q of this.puffs) {
          const a = (T - q.t0) / 0.8;
          for (let k = 0; k < 6; k++) {
            const ang = k / 6 * Math.PI * 2 + q.t0;
            const rr = 0.35 + a * 0.5;
            const X = SX(q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr), Y = SY(q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr, q.z + a * 0.25);
            const r2 = S * (0.07 + 0.08 * a);
            g.moveTo(X + r2, Y); g.arc(X, Y, r2, 0, Math.PI * 2);
          }
        }
        const a0 = this.puffs.reduce((m, q) => Math.max(m, 1 - (T - q.t0) / 0.8), 0);
        g.fillStyle = `rgba(236,230,218,${0.7 * a0})`; g.fill();
      }

      this.drawClouds(g, params, SX, SY, S, lt, T, cx, cy, W, H);

      // Distance haze at the top of the frame (the far side of the city).
      const hz = lt.haze;
      const grad = g.createLinearGradient(0, 0, 0, H * 0.45);
      const hc = `${Math.round(hz[0] * 255)},${Math.round(hz[1] * 255)},${Math.round(hz[2] * 255)}`;
      grad.addColorStop(0, `rgba(${hc},${0.34})`);
      grad.addColorStop(1, `rgba(${hc},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H * 0.45);

      // Keep the lot cache to the neighbourhood of the camera.
      this.pruneT += dt;
      if (this.pruneT > 3) {
        this.pruneT = 0;
        for (const [k, L] of this.lots) if (Math.abs(L.x0 - cx) + Math.abs(L.y0 - cy) > 160) this.lots.delete(k);
      }
      g.restore();
    },

    // All windows filled with the palette accent, cached per style and palette.
    beatPattern(g, style, P) {
      this.beatPats = this.beatPats || {};
      const key = style + P.name;
      if (this.beatPats[key]) return this.beatPats[key];
      const N = 8, c = document.createElement('canvas');
      c.width = N * CELL; c.height = N * CELL;
      const x = c.getContext('2d');
      const rect = style === 0 ? [9, 7, 14, 17] : style === 1 ? [2, 3, 28, 27] : [0, 9, 32, 14];
      x.fillStyle = P.accent;
      x.globalAlpha = 0.4; x.fillRect(0, 0, N * CELL, N * CELL); x.globalAlpha = 1;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) x.fillRect(i * CELL + rect[0], j * CELL + rect[1], rect[2], rect[3]);
      return (this.beatPats[key] = g.createPattern(c, 'repeat'));
    },

    drawDeck(g, it, SX, SY, S, css, P, box, nightK) {
      const { x, y } = it;
      const ya = y + 0.18, yb = y + 0.82;
      if (Math.abs(mod(x, 3)) < 0.5) box(x + 0.4, y + 0.38, x + 0.6, y + 0.62, 0, DECK_Z0, P.iPillar);
      // Deck slab: top and the +y face (the +x face is hidden by the next).
      g.beginPath();
      g.moveTo(SX(x, yb), SY(x, yb, DECK_Z0)); g.lineTo(SX(x + 1, yb), SY(x + 1, yb, DECK_Z0));
      g.lineTo(SX(x + 1, yb), SY(x + 1, yb, DECK_Z1)); g.lineTo(SX(x, yb), SY(x, yb, DECK_Z1)); g.closePath();
      g.fillStyle = css[2][P.iPillar]; g.fill();
      g.beginPath();
      g.moveTo(SX(x, ya), SY(x, ya, DECK_Z1)); g.lineTo(SX(x + 1, ya), SY(x + 1, ya, DECK_Z1));
      g.lineTo(SX(x + 1, yb), SY(x + 1, yb, DECK_Z1)); g.lineTo(SX(x, yb), SY(x, yb, DECK_Z1)); g.closePath();
      g.fillStyle = css[0][P.iConcrete]; g.fill();
      g.beginPath();
      for (const r of [0.34, 0.66]) { g.moveTo(SX(x, y + r), SY(x, y + r, DECK_Z1)); g.lineTo(SX(x + 1, y + r), SY(x + 1, y + r, DECK_Z1)); }
      g.strokeStyle = css[1][P.iDark]; g.lineWidth = 1; g.stroke();
      // Any train cars over this segment, clipped to it.
      for (const tr of this.trains) {
        if (tr.y !== y) continue;
        for (let c = 0; c < tr.n; c++) {
          const head = tr.x - tr.dir * c * 1.12;
          const ca = tr.dir > 0 ? head - 1 : head, cb = tr.dir > 0 ? head : head + 1;
          const a = Math.max(ca, x), b = Math.min(cb, x + 1);
          if (b <= a) continue;
          const body = P.iTrain[0], stripe = P.iTrain[1];
          const za = DECK_Z1 + 0.04, zb = TRAIN_Z1;
          // +y face and roof; +x face only at the car's real end.
          g.beginPath();
          g.moveTo(SX(a, y + 0.72), SY(a, y + 0.72, za)); g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, za));
          g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, zb)); g.lineTo(SX(a, y + 0.72), SY(a, y + 0.72, zb)); g.closePath();
          g.fillStyle = css[2][body]; g.fill();
          g.beginPath();
          const zs0 = za + 0.17, zs1 = za + 0.3;
          g.moveTo(SX(a, y + 0.72), SY(a, y + 0.72, zs0)); g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, zs0));
          g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, zs1)); g.lineTo(SX(a, y + 0.72), SY(a, y + 0.72, zs1)); g.closePath();
          g.fillStyle = nightK > 0.4 ? 'rgba(255,226,160,0.95)' : css[2][stripe]; g.fill();
          g.beginPath();
          g.moveTo(SX(a, y + 0.28), SY(a, y + 0.28, zb)); g.lineTo(SX(b, y + 0.28), SY(b, y + 0.28, zb));
          g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, zb)); g.lineTo(SX(a, y + 0.72), SY(a, y + 0.72, zb)); g.closePath();
          g.fillStyle = css[0][stripe]; g.fill();
          if (b === cb) {
            g.beginPath();
            g.moveTo(SX(b, y + 0.28), SY(b, y + 0.28, za)); g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, za));
            g.lineTo(SX(b, y + 0.72), SY(b, y + 0.72, zb)); g.lineTo(SX(b, y + 0.28), SY(b, y + 0.28, zb)); g.closePath();
            g.fillStyle = css[1][body]; g.fill();
          }
        }
      }
    },

    roofItems(g, L, x0, y0, x1, y1, h, SX, SY, S, css, P, T, nightK, box) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      switch (L.roof) {
        case 'tank': {
          const tx = x0 + 0.27, ty = y0 + 0.27, r = 0.15, zl = h + 0.16, zt = zl + 0.3;
          const X = SX(tx, ty), rx = r * S * 1.41, ry = rx * 0.5;
          g.strokeStyle = css[1][P.iDark]; g.lineWidth = 1;
          g.beginPath(); g.moveTo(X - rx * 0.7, SY(tx, ty, h)); g.lineTo(X - rx * 0.7, SY(tx, ty, zl));
          g.moveTo(X + rx * 0.7, SY(tx, ty, h)); g.lineTo(X + rx * 0.7, SY(tx, ty, zl)); g.stroke();
          g.beginPath();
          g.ellipse(X, SY(tx, ty, zl), rx, ry, 0, 0, Math.PI);
          g.lineTo(X - rx, SY(tx, ty, zt)); g.lineTo(X + rx, SY(tx, ty, zt)); g.closePath();
          g.fillStyle = css[1][P.iTank]; g.fill();
          g.beginPath(); g.ellipse(X, SY(tx, ty, zt), rx, ry, 0, 0, Math.PI * 2); g.fillStyle = css[0][P.iTank]; g.fill();
          g.beginPath(); g.moveTo(X - rx, SY(tx, ty, zt)); g.lineTo(X, SY(tx, ty, zt + 0.16)); g.lineTo(X + rx, SY(tx, ty, zt)); g.closePath();
          g.fillStyle = css[2][P.iDark]; g.fill();
          break;
        }
        case 'garden': {
          g.beginPath();
          const q = 0.1;
          g.moveTo(SX(x0 + q, y0 + q), SY(x0 + q, y0 + q, h)); g.lineTo(SX(x1 - q, y0 + q), SY(x1 - q, y0 + q, h));
          g.lineTo(SX(x1 - q, y1 - q), SY(x1 - q, y1 - q, h)); g.lineTo(SX(x0 + q, y1 - q), SY(x0 + q, y1 - q, h)); g.closePath();
          g.fillStyle = css[0][P.iGrass]; g.fill();
          g.beginPath();
          for (let k = 0; k < 3; k++) {
            const tx = x0 + 0.25 + h2(L.lx, L.ly, 80 + k) * 0.5, ty = y0 + 0.25 + h2(L.lx, L.ly, 90 + k) * 0.5;
            const X = SX(tx, ty), Y = SY(tx, ty, h + 0.1);
            g.moveTo(X + S * 0.1, Y); g.arc(X, Y, S * 0.1, 0, Math.PI * 2);
          }
          g.fillStyle = css[0][P.iTree[0]]; g.fill();
          break;
        }
        case 'ac':
          box(x0 + 0.2, y0 + 0.2, x0 + 0.42, y0 + 0.38, h, h + 0.12, P.iAC);
          box(x0 + 0.55, y0 + 0.5, x0 + 0.72, y0 + 0.74, h, h + 0.16, P.iAC);
          break;
        case 'box':
          box(cx - 0.2, cy - 0.2, cx + 0.2, cy + 0.2, h, h + 0.3, P.iWalls[L.wall], P.iRoof[L.roofC]);
          break;
        case 'spire': {
          box(cx - 0.22, cy - 0.22, cx + 0.22, cy + 0.22, h, h + 0.25, P.iWalls[L.wall], P.iRoof[L.roofC]);
          const X = SX(cx, cy);
          g.beginPath(); g.moveTo(X, SY(cx, cy, h + 0.25)); g.lineTo(X, SY(cx, cy, h + 1.3));
          g.strokeStyle = css[1][P.iDark]; g.lineWidth = Math.max(1, S * 0.05); g.stroke();
          const blink = nightK > 0.3 && mod(T + L.pox * 0.37, 1.6) < 0.5;
          g.fillStyle = blink ? '#ff3b30' : css[1][P.iDark];
          g.beginPath(); g.arc(X, SY(cx, cy, h + 1.3), Math.max(1, S * 0.05), 0, Math.PI * 2); g.fill();
          break;
        }
        case 'antenna': {
          const X = SX(cx + 0.2, cy + 0.1);
          g.beginPath(); g.moveTo(X, SY(cx + 0.2, cy + 0.1, h)); g.lineTo(X, SY(cx + 0.2, cy + 0.1, h + 0.8));
          const X2 = SX(cx - 0.2, cy - 0.1);
          g.moveTo(X2, SY(cx - 0.2, cy - 0.1, h)); g.lineTo(X2, SY(cx - 0.2, cy - 0.1, h + 0.5));
          g.strokeStyle = css[1][P.iDark]; g.lineWidth = 1; g.stroke();
          break;
        }
        default: break;
      }
    },

    drawCrane(g, L, SX, SY, S, css, P, T, zTop, x0, y0, x1, y1, lt) {
      // A climbing tower crane on the lot's front corner: the mast rises with
      // the building, the jib turns slowly, and between kicks the next slab is
      // lowered toward the roof so the landing is anticipated.
      const mx = x1 - 0.12, my = y1 - 0.12;
      const zJ = zTop + 2.4;
      const X = SX(mx, my);
      const col = css[1][P.iCrane], colT = css[0][P.iCrane];
      const w = S * 0.13;
      g.fillStyle = col;
      g.fillRect(X - w / 2, SY(mx, my, zJ + 0.45), w, SY(mx, my, zTop) - SY(mx, my, zJ + 0.45));
      // Lattice.
      g.beginPath();
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const za = zTop + (zJ - zTop) * i / segs, zb = zTop + (zJ - zTop) * (i + 1) / segs;
        g.moveTo(X - w / 2, SY(mx, my, za)); g.lineTo(X + w / 2, SY(mx, my, zb));
      }
      g.strokeStyle = css[2][P.iDark]; g.lineWidth = 0.8; g.stroke();
      const ang = L.jib + T * 0.12;
      const jx = Math.cos(ang), jy = Math.sin(ang);
      const ex = mx + jx * 2.9, ey = my + jy * 2.9;
      const bx = mx - jx * 0.8, by = my - jy * 0.8;
      // Jib as a slim truss: a filled triangle from the mast head to the tip,
      // with a lattice zigzag, so it reads as a crane and not a stray line.
      const zA = zJ + 0.45;
      g.beginPath();
      g.moveTo(SX(bx, by), SY(bx, by, zJ)); g.lineTo(SX(ex, ey), SY(ex, ey, zJ));
      g.lineTo(SX(mx, my), SY(mx, my, zA)); g.closePath();
      g.fillStyle = 'rgba(0,0,0,0)';
      g.strokeStyle = colT; g.lineWidth = Math.max(1.2, S * 0.06); g.stroke();
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const f0 = i / 8, f1 = (i + 1) / 8;
        const pxa = lerp(mx, ex, f0), pya = lerp(my, ey, f0), pxb = lerp(mx, ex, f1), pyb = lerp(my, ey, f1);
        g.moveTo(SX(pxa, pya), SY(pxa, pya, zJ + (zA - zJ) * (1 - f0)));
        g.lineTo(SX(pxb, pyb), SY(pxb, pyb, zJ));
      }
      g.strokeStyle = col; g.lineWidth = Math.max(0.8, S * 0.035); g.stroke();
      g.beginPath();
      g.moveTo(SX(bx, by), SY(bx, by, zJ)); g.lineTo(SX(ex, ey), SY(ex, ey, zJ));
      g.strokeStyle = colT; g.lineWidth = Math.max(1.6, S * 0.09); g.stroke();
      // Counterweight and cab.
      g.fillStyle = css[1][P.iConcrete];
      g.fillRect(SX(bx, by) - S * 0.1, SY(bx, by, zJ) - S * 0.02, S * 0.2, S * 0.14);
      g.fillStyle = css[1][P.iDark];
      g.fillRect(X - S * 0.07, SY(mx, my, zJ) - S * 0.02, S * 0.14, S * 0.12);
      // Hook: a trolley over the roof, lowering the next slab.
      const since = T - L.lastSet;
      const lower = clamp01(since / Math.max(0.3, this.beat * 3));
      const hxw = (x0 + x1) / 2, hyw = (y0 + y1) / 2;
      // Trolley slides along the jib toward the point above the roof.
      const tx = mx + jx * 0.9, ty = my + jy * 0.9;
      const hx = lerp(tx, hxw, 0.5), hy = lerp(ty, hyw, 0.5);
      const zh = lerp(zJ - 0.3, zTop + 0.35, lower * lower);
      g.beginPath(); g.moveTo(SX(hx, hy), SY(hx, hy, zJ)); g.lineTo(SX(hx, hy), SY(hx, hy, zh + 0.08));
      g.strokeStyle = css[2][P.iDark]; g.lineWidth = 0.8; g.stroke();
      if (since > 0.15) {
        g.fillStyle = css[0][P.iConcrete];
        const Xh = SX(hx, hy), Yh = SY(hx, hy, zh);
        g.fillRect(Xh - S * 0.34, Yh - S * 0.05, S * 0.68, S * 0.14);
      }
      // Warning light on the jib tip.
      if (lt.night > 0.3) {
        g.fillStyle = mod(T, 1.2) < 0.4 ? '#ff4a3a' : 'rgba(120,30,30,0.9)';
        g.fillRect(SX(ex, ey) - 1.5, SY(ex, ey, zJ) - 1.5, 3, 3);
      }
    },

    drawClouds(g, params, SX, SY, S, lt, T, cx, cy, W, H) {
      const amt = params.clouds;
      if (amt <= 0.01) return;
      // Clouds live in the world at altitude, drifting on a slow wind; each
      // is a cluster of flat ellipses with a ground shadow along the sun.
      const Z = 13;
      const wind = T * 0.35;
      // Clouds keep the sun's hue but not its dimness: normalised so they stay
      // solid and bright through golden hour, and only sink toward the night.
      const lit = lt.faces[0], lm = Math.max(lit[0], lit[1], lit[2]), lb = 0.35 + 0.65 * lt.up;
      const cl = (k) => lit.map((c) => Math.round(clamp01((0.25 + 0.75 * c / lm) * lb * k) * 255)).join(',');
      const top = `rgba(${cl(1.02)},`, und = `rgba(${cl(0.84)},`;
      // Clouds sit on a coarse world grid that the wind slides along; only
      // cells whose clouds can land in view are visited.
      const wx = wind * 0.5, wy = -wind;
      const C = 11;
      const list = [];
      const cu0 = cx - cy, cv0 = cx + cy;
      const vA = cv0 + 2 * Z - H / S - 8, vB = cv0 + 2 * Z + H / S + 8;
      const uA = cu0 - W / 2 / S - 8, uB = cu0 + W / 2 / S + 8;
      const ia = Math.floor(((uA + vA) / 2 - wx) / C), ib = Math.ceil(((uB + vB) / 2 - wx) / C);
      const ja = Math.floor(((vA - uB) / 2 - wy) / C), jb = Math.ceil(((vB - uA) / 2 - wy) / C);
      for (let i = ia; i <= ib; i++) {
        for (let j = ja; j <= jb; j++) {
          if (h2(i, j, 90) > amt * 0.33) continue;
          const x = i * C + h2(i, j, 91) * C + wx, y = j * C + h2(i, j, 92) * C + wy;
          const u = x - y, v = x + y;
          if (u < uA || u > uB || v < vA || v > vB) continue;
          list.push([x, y, 0.8 + h2(i, j, 93) * 0.9, i * 131 + j]);
        }
      }
      // Ground shadows first (dim everything under them), then the clouds.
      if (lt.up > 0.05) {
        g.beginPath();
        for (const [x, y, sc, id] of list) {
          const gx = x + lt.sdx * Z * 0.3, gy = y + lt.sdy * Z * 0.3;
          for (let i = 0; i < 5; i++) {
            const a = h2(id, i, 94) * 6.28, r = (0.8 + h2(id, i, 95) * 1.0) * sc;
            const px = gx + Math.cos(a) * r * 1.3, py = gy + Math.sin(a) * r * 0.8;
            const X = SX(px, py), Y = SY(px, py, 0), rx = r * S * 0.8;
            g.moveTo(X + rx, Y); g.ellipse(X, Y, rx, rx * 0.5, 0, 0, Math.PI * 2);
          }
        }
        g.fillStyle = `rgba(30,26,70,${0.14 * lt.up})`; g.fill();
      }
      for (const [x, y, sc, id] of list) {
        const X0 = SX(x, y), Y0 = SY(x, y, Z);
        if (X0 < -300 || X0 > W + 300 || Y0 < -200 || Y0 > H + 200) continue;
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = h2(id, i, 94) * 6.28, r = (0.8 + h2(id, i, 95) * 1.0) * sc;
            const px = x + Math.cos(a) * r * 1.3, py = y + Math.sin(a) * r * 0.8;
            const X = SX(px, py), Y = SY(px, py, Z + (pass ? 0.35 : 0)), rx = r * S * 0.8 * (pass ? 0.92 : 1);
            g.moveTo(X + rx, Y); g.ellipse(X, Y, rx, rx * 0.5, 0, 0, Math.PI * 2);
          }
          g.fillStyle = (pass ? top : und) + (0.35 + 0.57 * lt.up) + ')';
          g.fill();
        }
      }
    },
  });
})();
