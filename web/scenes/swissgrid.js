// Swiss Grid — batch 06, "Swiss Grid, or Line" (harness/briefs/batch-06-ideas.md).
//
// Arcs, Rings and Jags given the stage the panel asked for: a Müller-Brockmann
// concert sheet. Paper, black and one second ink. The field is a strict grid of
// Truchet tiles, each holding two bundles of concentric quarter-arcs (Arcs'
// arcs), so neighbouring tiles join into parallel-line ribbons (Jags' parallel
// lines) that meander across the sheet. Over it, a big set of dashed rings
// (Rings) is overprinted in the second ink; the drop prints a second,
// counter-rotating set in black. One line of type anchors the foot.
//
// Music, each in its own place:
//   kick   one solid disc steps to its next cell, and the tile it lands on turns
//          a quarter, re-routing the ribbons through that one cell
//   snare  a wash of the second ink laid between the outer lines of one bundle
//          (the Line idea's wash), fading over a bar
//   bass   line weight swells; the rings breathe; the field's travel speeds up
//   hats   the ruler along the foot flickers
//   drop   denser field, more lines per bundle, more second ink, the counter
//          ring set, faster travel; breakdown erases the sheet top-down,
//          leaving ghost grooves
// Plain Canvas 2D: flat strokes, multiply overprint, no gradients, no glow.

(function () {
  const INKS = [
    { name: 'Vermilion', hex: '#E0421F' },
    { name: 'Ultramarine', hex: '#2B40BE' },
    { name: 'Signal yellow', hex: '#F0B50A' },
    { name: 'Racing green', hex: '#11774A' },
  ];
  const PAPERS = [
    { name: 'Cream', ground: '#ECE7DA', ink: '#161514', over: 'multiply' },
    { name: 'White', ground: '#F6F5F1', ink: '#111111', over: 'multiply' },
    { name: 'Black', ground: '#121212', ink: '#E9E4D6', over: 'source-over' },
  ];
  const FONT = '"Helvetica Neue", Helvetica, Arial, "Nimbus Sans", sans-serif';
  const MAX_LINES = 9;

  const PRESETS = {
    calm: { density: 0.42, lines: 4, drift: 0.3, rings: 0.75, second: 0.06, erase: 0 },
    drop: { density: 0.93, lines: 7, drift: 1.0, rings: 2, second: 0.2, erase: 0 },
    // The breakdown held as a look: most of the sheet erased to its grooves.
    erased: { density: 0.3, lines: 3, drift: 0.15, rings: 0.4, second: 0, erase: 0.78 },
    // Everything printed, nothing moving: a poster to leave up at 5 a.m.
    plate: { density: 1, lines: 9, drift: 0.05, rings: 1, second: 0.12, erase: 0 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['density', 'lines', 'drift', 'rings', 'second'];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  // Stable per-cell hashes: the sheet is infinite along its travel, so a cell's
  // orientation and whether it is printed have to come from its address, not
  // from a stored array.
  function hash(c, r, salt) {
    let h = (c * 374761393 + r * 668265263 + salt * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

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

  // Line k sits at this many gaps from the bundle's middle radius. Lines are
  // added alternately outward and inward, so a fractional line count grows one
  // new line without re-spacing the others (re-spacing made every tile jump).
  const OFFS = [0, 1, -1, 2, -2, 3, -3, 4, -4];

  VIZ.register({
    id: 'swissgrid',
    name: 'Swiss Grid',
    order: 801,

    params: [
      { key: 'ink', label: 'Second ink', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'paper', label: 'Paper', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'density', label: 'Printed cells', type: 'range', min: 0.1, max: 1, default: PRESETS.calm.density, step: 0.01 },
      { key: 'lines', label: 'Lines per arc', type: 'range', min: 1, max: MAX_LINES, default: PRESETS.calm.lines, step: 0.01 },
      { key: 'drift', label: 'Travel', type: 'range', min: 0, max: 2, default: PRESETS.calm.drift, step: 0.01 },
      { key: 'rings', label: 'Ring sets', type: 'range', min: 0, max: 2, default: PRESETS.calm.rings, step: 0.01 },
      { key: 'second', label: 'Second ink share', type: 'range', min: 0, max: 1, default: PRESETS.calm.second, step: 0.01 },
      { key: 'erase', label: 'Erase from the top', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'words', label: 'Line of type', type: 'text', default: 'klang und raum' },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Swiss Grid',
      technique: 'Canvas 2D on a modular grid: an endless, travelling Truchet field of concentric quarter-arc bundles addressed by hashed cell coordinates, each tile sweeping its arcs in and out like the 2016 Arcs and turning a quarter on its own tween; dashed ring sets overprinted with multiply; onset detection against the previous frame; a section follower easing params toward the drop preset and driving a top-down erase in the breakdown',
      brief: 'A Müller-Brockmann concert sheet that keeps printing itself. Cream paper, black and one vermilion. The field is a strict grid of tiles, each two bundles of concentric quarter-arcs, so neighbouring tiles join into ribbons of parallel lines that meander across the sheet, which travels slowly sideways like a score being read. A great set of dashed vermilion rings turns over it, overprinted. Each kick steps one solid disc to its next cell and turns the tile it lands on a quarter, so the ribbons re-route through that one cell, a little each beat; each snare lays a vermilion wash between the outer lines of one bundle; the bass thickens the lines and speeds the travel; the hats flicker a ruler along the foot, where one line of type and a bar count sit. The drop prints more cells and more lines per bundle, brings more vermilion tiles and a second, counter-rotating ring set in black; the breakdown erases the sheet from the top down, leaving the grooves faintly behind, and the build prints it back.',
      lineage: [
        'Batch 06 idea 1, "Swiss Grid, or Line" (Designer and Curator). Chose Swiss Grid, with the Line idea\'s wash and top-down eraser folded in: the grid gives the kick a legible, confined move (one disc, one tile) and the drop somewhere to go (density, a second ink, a counter-rotating ring set), where ruled graphite lines are a lovely 5 a.m. piece but read as near-stasis on a dance floor.',
        'Arcs (2016): concentric arcs that sweep closed and open again become the tiles, sweeping in and out as they are printed and erased. Rings (2016): dashed rings at their own rotation speeds, now scaled past the sheet\'s edges as the Designer asked. Jags (2016): parallel lines, here the ribbons the Truchet tiles form.',
        'Josef Müller-Brockmann\'s Musica Viva and Tonhalle posters (concentric arcs on a strict grid, one line of grotesque type); Agnes Martin via the Curator\'s Line (washes between ruled lines, ghost grooves); Truchet and Smith tiles.',
        'Presets: calm, drop, erased (the breakdown held), plate (everything printed, still).',
      ].join(' '),
    },

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        low: 0, dropOn: false, auto: 0, autoErase: 0, hadDrop: false,
        bass: 0, pad: 0, hat: 0, lastKick: -10, lastSnare: -10, lastHat: -10,
      };
      this.tiles = new Map();
      this.scroll = 0;
      this.ringRot = 0;
      this.disc = null;
      this.washes = [];
      this.kicks = 0; this.kickTimes = [];
      this.ticks = new Float32Array(160);
      this.grid = null;
      this.born = null;
    },

    makeGrid(W, H) {
      const S = Math.min(W, H);
      const margin = S * 0.055;
      const band = S * 0.11;             // the foot: ruler and type
      const rows = 6;
      const fieldH = H - 2 * margin - band;
      const m = fieldH / rows;
      const cols = Math.max(4, Math.floor((W - 2 * margin) / m + 1e-6));
      const fx = (W - cols * m) / 2;
      return { W, H, S, m, rows, cols, fx, fy: margin, fw: cols * m, fh: rows * m, band, margin };
    },

    tile(c, r, t) {
      const key = (c + 1e5) * 16 + r;
      let tl = this.tiles.get(key);
      if (!tl) {
        // Cells created while the sheet is first laid sweep in as a wave from
        // the top left; cells arriving at the travelling edge are already
        // printed, as if they had always been there.
        const first = this.born === null || t - this.born < 0.05;
        tl = {
          c, r, s: first ? 0 : -1, wait: first ? t + 0.06 * (c - Math.floor(this.scroll)) + 0.12 * r : 0,
          turn: 0, from: 0, t0: 0, dur: 0,
          o: hash(c, r, 1) < 0.5 ? 0 : 1, pa: hash(c, r, 2), pb: hash(c, r, 3), pd: hash(c, r, 4),
        };
        this.tiles.set(key, tl);
      }
      return tl;
    },

    turnOf(tl, t) {
      if (tl.dur <= 0) return tl.turn;
      const u = clamp((t - tl.t0) / tl.dur, 0, 1);
      return lerp(tl.from, tl.turn, easeOut(u));
    },

    listen(s, t, dt, g, P, react) {
      const e = this.env;
      const b0 = s[0], b4 = s[4];
      let kick = false;
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - e.lastKick > 0.22) {
        e.lastKick = t; kick = true;
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - e.lastSnare > 0.28) {
        e.lastSnare = t; this.onSnare(t, g, P);
      }
      const hatNow = (s[7] + s[8]) / 200;
      if (s[8] - this.prev[8] > 12 && t - e.lastHat > 0.06) {
        e.lastHat = t;
        for (let i = 0; i < this.ticks.length; i++) this.ticks[i] = this.rng();
      }
      this.prev.set(s);
      const bass = Math.max(s[0], s[1]) / 100;
      // Slow attack on the weight swell: a fast one thickened every line in
      // the field on each kick, which is the full-frame pulse TASTE rules out.
      e.bass = ease(e.bass, bass, bass > e.bass ? 7 : 2.5, dt);
      e.pad = ease(e.pad, (s[2] + s[3]) / 200, 1.2, dt);
      e.hat = ease(e.hat, hatNow, hatNow > e.hat ? 40 : 9, dt);
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; e.hadDrop = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      if (kick) this.onKick(t, g, react);
    },

    onKick(t, g, react) {
      this.kicks++;
      this.kickTimes.push(t); if (this.kickTimes.length > 9) this.kickTimes.shift();
      const d = this.disc;
      const lo = Math.ceil(this.scroll) + 1, hi = Math.floor(this.scroll) + g.cols - 2;
      let nc = d.c + d.dir, nr = d.r;
      if (nc > hi || nc < lo) {
        // Turn at the edge of the sheet like a reading eye: down a row, back.
        d.dir = -d.dir;
        nc = clamp(d.c + d.dir, lo, hi);
        nr = (d.r + 1) % g.rows;
      }
      const oc = d.c, or = d.r;
      d.fc = this.discC(t); d.fr = this.discR(t);
      d.c = nc; d.r = nr; d.t0 = t;
      d.dur = 0.08 + 0.1 / (0.5 + react);
      // The tile it leaves turns a quarter, re-routing its ribbons. (Turning
      // the one it lands on hid the turn under the disc.)
      const tl = this.tile(oc, or, t);
      tl.from = this.turnOf(tl, t);
      tl.turn = Math.round(tl.from) + (this.kicks % 2 ? 1 : -1);
      tl.t0 = t; tl.dur = d.dur * 1.8;
    },

    discC(t) { const d = this.disc; return lerp(d.fc, d.c, easeOut(clamp((t - d.t0) / d.dur, 0, 1))); },
    discR(t) { const d = this.disc; return lerp(d.fr, d.r, easeOut(clamp((t - d.t0) / d.dur, 0, 1))); },

    onSnare(t, g, P) {
      // A visible printed tile, away from the disc, gets a wash.
      if (!this.disc) return;
      for (let tries = 0; tries < 12; tries++) {
        const c = Math.floor(this.scroll) + 1 + Math.floor(this.rng() * (g.cols - 2));
        const r = Math.floor(this.rng() * g.rows);
        if (Math.abs(c - this.disc.c) + Math.abs(r - this.disc.r) < 2) continue;
        const tl = this.tile(c, r, t);
        if (tl.s < 0.9 || tl.pa < 0.3) continue;
        this.washes.push({ c, r, half: this.rng() < 0.5 ? 0 : 1, t0: t });
        break;
      }
      if (this.washes.length > 10) this.washes.shift();
    },

    bpm(t) {
      const kt = this.kickTimes;
      if (kt.length < 4 || t - kt[kt.length - 1] > 3) return null;
      const iv = [];
      for (let i = 1; i < kt.length; i++) iv.push(kt[i] - kt[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[iv.length >> 1];
      return med > 0.2 && med < 1.5 ? Math.round(60 / med) : null;
    },

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;

      const g0 = this.grid;
      if (!g0 || Math.abs(g0.W - W) > 0.5 || Math.abs(g0.H - H) > 0.5) {
        this.grid = this.makeGrid(W, H);
        this.tiles.clear();
        this.born = null;
      }
      const g = this.grid;
      const m = g.m;
      if (!this.disc) {
        const c = Math.floor(this.scroll) + Math.floor(g.cols * 0.3), r = 2;
        this.disc = { c, r, fc: c, fr: r, t0: 0, dur: 0.1, dir: 1 };
      }

      // Params, eased toward the drop preset while following a drop.
      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      const react = params.reaction;
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      this.listen(signals, t, dt, g, P, react);
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.5, dt);
      // The breakdown: once a drop has ended and the kick has gone, the
      // eraser comes down the sheet; the build's returning kick lifts it.
      const quiet = t - e.lastKick > 1.2;
      const wantErase = follow && e.hadDrop && !e.dropOn && quiet ? 0.8 : 0;
      e.autoErase = wantErase > e.autoErase
        ? Math.min(wantErase, e.autoErase + dt * 0.2)
        : Math.max(wantErase, e.autoErase - dt * 0.28);
      const erase = Math.max(params.erase, e.autoErase);

      this.scroll += dt * P.drift * (0.35 + 0.9 * e.bass * react) * 0.55;
      this.ringRot += dt * (0.05 + 0.25 * e.pad + 0.2 * e.bass * react) * (0.5 + 0.5 * P.drift);

      const paper = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];
      const acc = INKS[clamp(Math.round(params.ink), 0, INKS.length - 1)].hex;
      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.setLineDash([]);
      c2.lineCap = 'butt';
      c2.fillStyle = paper.ground;
      c2.fillRect(-2, -2, W + 4, H + 4);

      // ---- the field --------------------------------------------------------
      c2.save();
      c2.beginPath();
      c2.rect(g.fx, g.fy, g.fw, g.fh);
      c2.clip();

      const eY = g.fy + erase * g.fh;
      const cFirst = Math.floor(this.scroll) - 1, cLast = Math.floor(this.scroll) + g.cols + 1;
      const X = (c) => g.fx + (c - this.scroll) * m;
      const Y = (r) => g.fy + r * m;
      const HP = Math.PI / 2;
      const gap = m * 0.088;
      const lineW = gap * 0.36 * (1 + 0.55 * e.bass * react);
      const nLines = clamp(P.lines, 1, MAX_LINES);
      const vis = [];
      for (let c = cFirst; c <= cLast; c++) {
        for (let r = 0; r < g.rows; r++) {
          const tl = this.tile(c, r, t);
          const on = tl.pd < P.density;
          const cy = Y(r) + m / 2;
          const target = on && cy > eY ? 1 : 0;
          if (tl.s < 0) tl.s = target;
          if (t >= tl.wait) {
            const rate = target > tl.s ? 1.5 : 1.1;
            tl.dir = target > tl.s ? 1 : target < tl.s ? -1 : tl.dir || 1;
            tl.s = target > tl.s ? Math.min(target, tl.s + dt * rate) : Math.max(target, tl.s - dt * rate);
          }
          tl.on = on;
          vis.push(tl);
        }
      }
      if (this.born === null) this.born = t;
      // Forget cells that have travelled off the sheet.
      if (this.tiles.size > vis.length * 3) {
        for (const [k, tl] of this.tiles) if (tl.c < cFirst - 2) this.tiles.delete(k);
      }

      // One arc of line k in tile tl, rotated by the tile's turn, swept by s.
      const arcsOf = (tl, k, sweep, grow, halfOnly) => {
        const th = (tl.o + this.turnOf(tl, t)) * HP;
        const ccx = X(tl.c) + m / 2, ccy = Y(tl.r) + m / 2;
        const cs = Math.cos(th), sn = Math.sin(th);
        const rad = m / 2 + OFFS[k] * gap;
        if (rad <= 0.5) return;
        for (let h = 0; h < 2; h++) {
          if (halfOnly !== undefined && h !== halfOnly) continue;
          const lx = h ? m / 2 : -m / 2, ly = lx;
          const ax = ccx + lx * cs - ly * sn, ay = ccy + lx * sn + ly * cs;
          const a0 = (h ? Math.PI : 0) + th;
          const s0 = grow ? a0 : a0 + (1 - sweep) * HP;
          const s1 = grow ? a0 + sweep * HP : a0 + HP;
          if (s1 - s0 < 1e-3) continue;
          c2.moveTo(ax + rad * Math.cos(s0), ay + rad * Math.sin(s0));
          c2.arc(ax, ay, rad, s0, s1);
        }
      };

      // Ghost grooves: what the eraser left behind, and the cells not yet printed.
      c2.strokeStyle = paper.ink;
      c2.globalAlpha = 0.13;
      c2.lineWidth = Math.max(0.6, lineW * 0.55);
      c2.beginPath();
      for (const tl of vis) {
        if (!tl.on || tl.s > 0.98) continue;
        for (let k = 0; k < Math.ceil(nLines); k++) arcsOf(tl, k, 1, true);
      }
      c2.stroke();
      c2.globalAlpha = 1;

      // The printed tiles, one stroke per line index and ink.
      c2.lineWidth = lineW;
      for (let pass = 0; pass < 2; pass++) {
        c2.strokeStyle = pass ? acc : paper.ink;
        for (let k = 0; k < Math.ceil(nLines); k++) {
          const frac = clamp(nLines - k, 0, 1);
          c2.beginPath();
          for (const tl of vis) {
            if (tl.s <= 0.001) continue;
            if ((tl.pa < P.second) !== (pass === 1)) continue;
            const sw = easeInOut(tl.s) * frac;
            arcsOf(tl, k, sw, tl.dir >= 0);
          }
          c2.stroke();
        }
      }

      // Snare: one cell reversed out, a solid square of the second ink with
      // its arcs cut through in paper, fading over about a bar. (A wash of
      // ink between two lines, the Line idea's snare, was tried first and was
      // indistinguishable from the second-ink tiles in the drop.)
      if (this.washes.length) {
        for (const w of this.washes) {
          const age = t - w.t0;
          const a = age < 0.06 ? age / 0.06 : Math.max(0, 1 - Math.max(0, age - 0.4) / 1.3);
          if (a <= 0) continue;
          const tl = this.tile(w.c, w.r, t);
          const x0 = X(tl.c), y0 = Y(tl.r);
          c2.globalAlpha = a;
          c2.fillStyle = acc;
          c2.fillRect(x0, y0, m, m);
          c2.strokeStyle = paper.ground;
          c2.lineWidth = lineW;
          c2.save();
          c2.beginPath();
          c2.rect(x0, y0, m, m);
          c2.clip();
          c2.beginPath();
          for (let k = 0; k < Math.ceil(nLines); k++) arcsOf(tl, k, 1, true);
          c2.stroke();
          c2.restore();
        }
        this.washes = this.washes.filter((w) => t - w.t0 < 1.8);
        c2.globalAlpha = 1;
      }

      // ---- the ring sets, overprinted ----------------------------------------
      const S = g.S;
      const ringSet = (cx, cy, col, alpha, dirn, phase, n, r0, step, wt, mode) => {
        if (alpha <= 0.01) return;
        c2.strokeStyle = col;
        c2.globalAlpha = alpha;
        c2.lineWidth = wt;
        c2.globalCompositeOperation = mode;
        for (let i = 0; i < n; i++) {
          const R = r0 + i * step;
          const circ = 2 * Math.PI * R;
          // Rings' dashes: fewer, longer segments on the outer rings, each ring
          // at its own speed so the set shears as it turns.
          const segs = 3 + (i % 4) + Math.floor(i / 3);
          const L = circ / segs;
          c2.setLineDash([L * (0.52 + 0.3 * hash(i, 7, 5)), L * (0.48 - 0.3 * hash(i, 7, 5) + 0.3)]);
          c2.lineDashOffset = dirn * (this.ringRot * (1 + 0.37 * i) + phase + i * 0.7) * R;
          c2.beginPath();
          c2.arc(cx, cy, R, 0, 2 * Math.PI);
          c2.stroke();
        }
        c2.setLineDash([]);
        c2.globalAlpha = 1;
        c2.globalCompositeOperation = 'source-over';
      };
      const breathe = 1 + 0.05 * e.bass * react;
      const drift = this.ringRot * 0.08;
      const bC = g.fx + g.fw * (0.22 + 0.08 * Math.sin(drift * 0.7 + 2)), bY = g.fy + g.fh * (0.28 + 0.1 * Math.cos(drift * 0.5));
      // The drop's counter-rotating set is reversed out of the field in paper
      // colour: printed in black it was lost in the dense black lines.
      ringSet(bC, bY, paper.ground, clamp(P.rings - 1, 0, 1), -1.3, 3, 7, S * 0.07 * breathe, S * 0.055 * breathe, S * 0.016, 'source-over');
      const aC = g.fx + g.fw * (0.72 + 0.1 * Math.sin(drift * 0.9)), aY = g.fy + g.fh * (0.62 + 0.12 * Math.sin(drift * 0.6 + 1));
      ringSet(aC, aY, acc, clamp(P.rings, 0, 1), 1, 0, 9, S * 0.1 * breathe, S * 0.062 * breathe, S * 0.022, paper.over);

      // ---- the disc: the beat, one cell at a time ------------------------------
      {
        const d = this.disc;
        // Cells that have travelled off the left edge re-enter from the right,
        // so the disc survives long quiet passages without a kick to move it.
        if (d.c - this.scroll < -1.2) { d.c += g.cols + 2; d.fc = d.c; }
        const dc = this.discC(t), dr = this.discR(t);
        // Knocked out of the field and printed solid on top: overprinted, it
        // sank into the drop's dense black and the beat was lost.
        const px = X(dc) + m / 2, py = Y(dr) + m / 2;
        c2.fillStyle = paper.ground;
        c2.beginPath();
        c2.arc(px, py, m * 0.47, 0, 2 * Math.PI);
        c2.fill();
        c2.fillStyle = acc;
        c2.beginPath();
        c2.arc(px, py, m * 0.4, 0, 2 * Math.PI);
        c2.fill();
      }

      // The eraser's edge: a hairline rule where it has reached.
      if (erase > 0.01) {
        c2.strokeStyle = paper.ink;
        c2.globalAlpha = 0.5 * clamp(erase * 8, 0, 1);
        c2.lineWidth = 0.8;
        c2.beginPath();
        c2.moveTo(g.fx, eY); c2.lineTo(g.fx + g.fw, eY);
        c2.stroke();
        c2.globalAlpha = 1;
      }
      c2.restore();

      // ---- the foot: ruler, type, bar count -----------------------------------
      const footY = g.fy + g.fh;
      c2.strokeStyle = paper.ink;
      c2.lineWidth = 1;
      c2.beginPath();
      c2.moveTo(g.fx, footY + 0.5); c2.lineTo(g.fx + g.fw, footY + 0.5);
      c2.stroke();
      const nT = Math.min(this.ticks.length, Math.floor(g.fw / (m / 8)));
      c2.lineWidth = 0.8;
      c2.beginPath();
      for (let i = 0; i <= nT; i++) {
        const x = g.fx + i * (g.fw / nT);
        const major = i % 8 === 0;
        const hgt = (major ? m * 0.12 : m * 0.045) + m * 0.14 * e.hat * this.ticks[i % this.ticks.length] * react;
        c2.moveTo(x, footY); c2.lineTo(x, footY + hgt);
      }
      c2.stroke();

      const words = String(params.words || '').trim();
      const typeY = H - g.margin;
      const big = g.band * 0.5;
      c2.fillStyle = paper.ink;
      c2.textBaseline = 'alphabetic';
      c2.textAlign = 'left';
      c2.font = '700 ' + big.toFixed(1) + 'px ' + FONT;
      if (words) c2.fillText(words, g.fx, typeY);
      const small = g.band * 0.17;
      c2.font = '400 ' + small.toFixed(1) + 'px ' + FONT;
      c2.textAlign = 'right';
      const bpm = this.bpm(t);
      const bar = Math.floor(this.kicks / 4) + 1;
      c2.fillText((bpm ? bpm + ' bpm' : '— bpm'), g.fx + g.fw, typeY - small * 1.25);
      c2.fillText('takt ' + String(bar).padStart(3, '0'), g.fx + g.fw, typeY);
      c2.fillStyle = acc;
      c2.beginPath();
      c2.arc(g.fx + g.fw - small * 6.2, typeY - small * 0.8, small * 0.55, 0, 2 * Math.PI);
      c2.fill();

      c2.restore();
    },
  });
})();
