// Substrate City — batch 06, "Substrate City" (harness/briefs/batch-06-ideas.md).
//
// Tarbell's Substrate (2003) laid out as a city plan. Crack-walkers leave from
// a point on an existing crack at right angles to it, travel in a straight (or
// gently bending) line, and stop dead when they meet another crack, so the
// sheet divides itself into blocks, streets and districts that nobody drew.
// Each walker drags a sand painter behind it: grains scattered along the
// perpendicular from the crack to the nearest wall, dense by the line and
// thinning away from it, so every street carries a narrow band of sandy colour
// on one side, like a shadow. Like Stamps, the image is the record of the
// process on a persistent plate, and like Stamps the plate never saturates:
// once most of it is built up, it is re-papered one cell at a time, and a new
// district begins on each fresh cell at its own orientation.
//
// Music, each in its own place:
//   kick   the dead end the city most recently made (the last crack to hit
//          another) is punched through: a red "beat street" shoots out across
//          the junction, a vermilion survey dot is printed where it started and
//          a small ring marks it, so the city grows outward from where the beat
//          last landed and the red streets are the record of the beats
//   snare  one city block near the last beat is inked in a flat map colour,
//          leaving the paper showing along its streets
//   bass   how fast the walkers travel
//   hats   the sand on the growing streets thickens and spreads
//   drop   many more walkers and more cracks per kick (the spawn rate), faster
//          growth, heavier sand, more blocks inked, a camera that travels
//          further; the breakdown lets growth stall so the long exposure can
//          be read
// Movement: the plate is larger than the view, and the camera drifts slowly
// toward where the recent beats have landed.
//
// Canvas 2D only. The crack grid is a Float32 angle per virtual unit (Tarbell's
// cgrid); the plate is one offscreen canvas at device resolution, blitted once
// a frame. A cream plate full-screen floodlights a dark room, so the ground is
// multiplied down by "Paper light" and a vignette, and two dark plates exist.

(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const EMPTY = 10001;       // Tarbell's "no crack here" (> any angle we store)
  const BLOCKED = -99999;    // a cell being re-papered: a wall to everything
  const STEP = 0.42;         // Tarbell's step, in virtual units
  const GRAINS = 12;         // per sand stroke; Tarbell used 64 at a tenth the alpha
  const PLATE = 1.3;         // plate size relative to the stage, for camera room
  const TILE = 118;          // re-paper cell, virtual units
  const SAMPLE_CAP = 24000;

  const PALETTES = [
    { name: 'Cadastral cream', dark: false,
      paper: [232, 224, 205], ink: [28, 26, 23], accent: [212, 62, 38],
      sands: [[192, 132, 48], [184, 76, 50], [64, 96, 140], [104, 132, 92]],
      blocks: [[236, 164, 60], [226, 100, 70], [120, 176, 150], [96, 140, 200], [240, 186, 170], [250, 214, 90]] },
    { name: 'Kraft', dark: false,
      paper: [202, 176, 136], ink: [36, 27, 19], accent: [190, 36, 28],
      sands: [[250, 242, 224], [46, 60, 108], [164, 50, 38], [90, 108, 68], [232, 202, 122]],
      blocks: [[246, 238, 218], [96, 112, 162], [200, 92, 70], [138, 156, 104]] },
    { name: 'Blueprint', dark: true,
      paper: [24, 46, 86], ink: [224, 230, 236], accent: [255, 176, 58],
      sands: [[120, 178, 228], [196, 216, 238], [86, 136, 198], [226, 198, 140]],
      blocks: [[58, 104, 170], [96, 146, 200], [52, 88, 146], [150, 132, 96]] },
    { name: 'Night map', dark: true,
      paper: [22, 22, 26], ink: [214, 206, 188], accent: [236, 90, 62],
      sands: [[212, 158, 68], [68, 158, 158], [198, 98, 118], [118, 118, 198], [158, 188, 108]],
      blocks: [[110, 74, 36], [36, 92, 92], [100, 44, 64], [56, 56, 112], [80, 96, 48]] },
  ];

  const PRESETS = {
    calm: { walkers: 14, speed: 0.75, spawn: 1, sand: 0.8, blocks: 0.35, travel: 0.35 },
    drop: { walkers: 48, speed: 1.1, spawn: 3, sand: 1.3, blocks: 1, travel: 1 },
    // The long exposure: almost nothing moving, everything laid down readable.
    exposure: { walkers: 6, speed: 0.12, spawn: 0.5, sand: 1.4, blocks: 0.15, travel: 0.15, paperLight: 0.72 },
    // The same city drawn on a black map, for a dark room.
    night: { palette: 3, walkers: 60, speed: 1, spawn: 2, sand: 1.1, blocks: 0.7, travel: 0.6 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['walkers', 'speed', 'spawn', 'sand', 'blocks', 'travel'];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const rnd = () => Math.random();
  const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';
  // Angles are stored unwrapped (a walker that bends keeps counting), so
  // compare them on the circle.
  const angDiff = (a, b) => { const d = (((a - b) % 360) + 540) % 360 - 180; return d < 0 ? -d : d; };
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  function makePaper(P, w, h) {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = rgb(P.paper); g.fillRect(0, 0, w, h);
    // Tooth from one small tile: a per-pixel pass over a 9 MP plate stalls.
    const T = 256, tile = makeCanvas(T, T), tg = tile.getContext('2d');
    const id = tg.createImageData(T, T), d = id.data;
    for (let k = 0; k < T * T; k++) {
      const v = rnd(), o = k * 4, light = v > 0.5;
      d[o] = d[o + 1] = d[o + 2] = light ? 255 : 0;
      d[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * (P.dark ? 9 : 16));
    }
    tg.putImageData(id, 0, 0);
    g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, w, h);
    const S = Math.max(w, h);
    for (let k = 0; k < 50; k++) {
      const x = rnd() * w, y = rnd() * h, r = S * (0.03 + rnd() * 0.12);
      const col = rnd() < 0.5 ? (P.dark ? '90,100,120' : '255,252,244') : (P.dark ? '0,0,0' : '130,108,80');
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + col + ',0.06)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    return c;
  }

  VIZ.register({
    id: 'substratecity',
    name: 'Substrate City',
    order: 805,

    params: [
      { key: 'palette', label: 'Plate', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'paperLight', label: 'Paper light', type: 'range', min: 0.4, max: 1, default: 0.9, step: 0.01 },
      { key: 'walkers', label: 'Crack walkers', type: 'range', min: 2, max: 180, default: PRESETS.calm.walkers, step: 1 },
      { key: 'speed', label: 'Growth speed', type: 'range', min: 0, max: 3, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'spawn', label: 'Cracks per kick', type: 'range', min: 0, max: 6, default: PRESETS.calm.spawn, step: 0.01 },
      { key: 'sand', label: 'Sand colour', type: 'range', min: 0, max: 2, default: PRESETS.calm.sand, step: 0.01 },
      { key: 'blocks', label: 'Inked blocks', type: 'range', min: 0, max: 1, default: PRESETS.calm.blocks, step: 0.01 },
      { key: 'travel', label: 'Camera travel', type: 'range', min: 0, max: 2, default: PRESETS.calm.travel, step: 0.01 },
      { key: 'bend', label: 'Street bend', type: 'range', min: 0, max: 1, default: 0.2, step: 0.01 },
      { key: 'beatInk', label: 'Beat streets in red', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'renew', label: 'Renewal', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    actions: [{ id: 'fresh', label: 'Fresh plate', run() { this.freshRequest = true; } }],

    gallery: {
      title: 'Substrate City',
      technique: 'Canvas 2D. Tarbell\'s Substrate: a Float32 angle grid per virtual unit, crack-walkers that start perpendicular to an existing crack (best of four candidates by open space ahead), step 0.42 units, optionally bend, and die on meeting a crack of another angle; each step a sand painter scatters sine-distributed grains along the perpendicular to the nearest wall. Everything accumulates on one device-resolution plate 1.3x the stage, blitted through a drifting camera. Snare blocks by 4-connected flood fill on the grid, eroded two units off the streets, printed as a grained mask with multiply (screen on dark plates). Per-cell ink tallies drive random-order re-papering with a feathered, blurred mask; each fresh cell is seeded with a new district at its own angle.',
      brief: 'A city plan drawing itself. Fine black streets crack across a cream sheet, each new one leaving an existing street at right angles and running until it meets another, so blocks, avenues and districts appear that nobody drew; every street trails a band of sand-painted ochre, terracotta, sage or slate along one side. On each kick the dead end the city most recently made is punched through: a vermilion street shoots across the junction, a red survey dot is printed where it started, and a small ring marks it, so the city grows from where the beat last landed and the red streets become the record of the set. The snare inks one block near the last beat in a flat map colour with the paper left showing along its streets; the bass sets how fast the walkers travel; the hats thicken the sand. The drop floods the plate with walkers and several cracks per kick, so the city visibly races outward and fills with colour; the breakdown stalls it and leaves the long exposure to read. The camera drifts toward the recent beats, and when the plate is built up it is re-papered one cell at a time, each fresh cell starting a new district at its own angle, so minute ten is a different city.',
      lineage: [
        'Batch 06 idea 5, "Substrate City" (the Purist\'s first new idea, judge-purist.md section 7).',
        'Jared Tarbell, Substrate (2003) and its SandPainter, followed closely: perpendicular starts, the stop-on-contact rule, the sin(sin()) grain falloff along the perpendicular to the nearest crack, grain width as a random walk.',
        'Iso City (the city, flat map colour for blocks, a camera that drifts over it). Stamps (the persistent plate as the record of the process, and random-order per-cell re-papering so it never saturates).',
        'Presets: calm, drop, exposure (stalled, heavy sand, dim paper), night (the Night map plate at a medium pace).',
      ].join(' '),
    },

    setup() {},
    enter() {},

    // ------------------------------------------------------------------ build
    build(p, W, H, pal) {
      this.W = W; this.H = H;
      this.PW = Math.ceil(W * PLATE); this.PH = Math.ceil(H * PLATE);
      const s = p.width / W, dens = p.pixelDensity();
      // Slightly over the device scale so the camera usually downsamples; a
      // ceiling keeps a retina full screen under about 9 MP.
      this.R = Math.min(s * dens * 1.12, Math.sqrt(9e6 / (this.PW * this.PH)));
      this.plate = makeCanvas(Math.ceil(this.PW * this.R), Math.ceil(this.PH * this.R));
      this.pc = this.plate.getContext('2d');
      // Three layers, composited each frame: paper (with the inked blocks),
      // sand, and the crack lines on top. The sand is painted on the CPU into
      // its own pixel buffer and uploaded by dirty blocks: as canvas calls, a
      // fillRect or path rect per grain stalled the software rasteriser for a
      // minute on the warm-up alone, and would cost a laptop its drop frames.
      this.linePlate = makeCanvas(this.plate.width, this.plate.height);
      this.lc = this.linePlate.getContext('2d');
      // Sand at a fixed 0.9 px per virtual unit, whatever the screen: a grain
      // is one pixel, so tying this to the device made the sand half as dense
      // at 720p as at 360p. Upscaled, the grains soften, which sand can take.
      this.RS = 0.9;
      this.SW = Math.ceil(this.PW * this.RS); this.SH = Math.ceil(this.PH * this.RS);
      this.sandCv = makeCanvas(this.SW, this.SH);
      this.sc = this.sandCv.getContext('2d');
      this.sandImg = this.sc.createImageData(this.SW, this.SH);
      this.sd = this.sandImg.data;
      this.DBX = Math.ceil(this.SW / 32); this.DBY = Math.ceil(this.SH / 32);
      this.dirty = new Uint8Array(this.DBX * this.DBY);
      this.cg = new Float32Array(this.PW * this.PH).fill(EMPTY);
      this.visit = new Uint32Array(this.PW * this.PH);
      this.gen = 0;
      this.samples = new Float32Array(SAMPLE_CAP * 2);
      this.nSamples = 0;
      this.walkers = [];
      this.junctions = [];
      this.kickPts = [];
      this.rings = [];
      this.fills = [];
      this.TX = Math.max(3, Math.round(this.PW / TILE));
      this.TY = Math.max(2, Math.round(this.PH / TILE));
      this.tw = this.PW / this.TX; this.th = this.PH / this.TY;
      this.tiles = [];
      for (let j = 0; j < this.TY; j++) for (let i = 0; i < this.TX; i++) this.tiles.push({ i, j, ink: 0, fade: null });
      this.queue = [];
      this.renewAcc = 0;
      this.setPalette(pal);
      this.pc.setTransform(1, 0, 0, 1, 0, 0);
      this.pc.drawImage(this.paperCv, 0, 0);
      this.makeMask();
      this.cam = null;
      this.fieldPh = rnd() * 6.28;
      // A few seeds from two street orientations, so the first minutes read as
      // neighbouring districts rather than one grid.
      const base = rnd() * 90;
      for (let k = 0; k < 5; k++) {
        const x = this.PW * (0.2 + 0.6 * rnd()), y = this.PH * (0.2 + 0.6 * rnd());
        this.seedPair(x, y, base + (k % 2) * (20 + rnd() * 25), 0);
      }
    },

    setPalette(pi) {
      this.palIdx = pi;
      this.P = PALETTES[pi];
      this.paperCv = makePaper(this.P, this.plate.width, this.plate.height);
      this.segs = [[], []];
      for (const w of this.walkers || []) w.sand %= this.P.sands.length;
    },

    // A feathered cell-sized mask, blurred once, for pasting fresh paper.
    makeMask() {
      const R = this.R, F = 7 * R;
      const w = Math.ceil(this.tw * R + 2 * F), h = Math.ceil(this.th * R + 2 * F);
      this.maskF = F;
      this.mask = makeCanvas(w, h);
      const g = this.mask.getContext('2d');
      g.filter = 'blur(' + (F * 0.45).toFixed(1) + 'px)';
      g.fillStyle = '#000';
      g.fillRect(F * 0.6, F * 0.6, w - F * 1.2, h - F * 1.2);
      g.filter = 'none';
    },

    // ------------------------------------------------------------------ walkers
    spawn(x, y, a, o) {
      const w = {
        x, y, a, ink: o && o.ink ? 1 : 0, grace: (o && o.grace) || 0, burst: (o && o.burst) || 0,
        // Most streets run straight, as in Substrate; a share of them bend,
        // and more of them the higher Street bend is.
        bend: rnd() < 0.15 + 0.6 * this.bendNow ? (rnd() - 0.5) * 2 * this.bendNow * 0.3 : 0,
        sand: this.sandAt(x, y), g: rnd() * 0.25, acc: 0, steps: 0, path: [x, y],
      };
      this.walkers.push(w);
      return w;
    },

    // Sand colour by district: a slow field over the plate picks the colour,
    // with a few strays, so the colour reads as neighbourhoods rather than a
    // spectrum scattered crack by crack.
    sandAt(x, y) {
      const n = this.P.sands.length;
      if (rnd() < 0.2) return Math.floor(rnd() * n);
      const v = Math.sin(x * 0.011 + this.fieldPh) + Math.sin(y * 0.014 - this.fieldPh * 0.7) + Math.sin((x + y) * 0.006 + 2.1);
      return Math.floor(clamp((v + 3) / 6 * 1.5 - 0.25 + (rnd() - 0.5) * 0.15, 0, 0.999) * n);
    },

    seedPair(x, y, a, ink) {
      this.spawn(x, y, a, { ink });
      this.spawn(x, y, a + 180, { ink, grace: 2 });
    },

    isCrack(x, y) {
      const cx = x | 0, cy = y | 0;
      if (cx < 0 || cy < 0 || cx >= this.PW || cy >= this.PH) return false;
      const c = this.cg[cy * this.PW + cx];
      return c < EMPTY && c !== BLOCKED;
    },

    openAhead(x, y, a) {
      const dx = Math.cos(a * DEG), dy = Math.sin(a * DEG);
      let score = 0;
      for (const d of [3, 7, 14, 26, 44]) {
        const cx = (x + dx * d) | 0, cy = (y + dy * d) | 0;
        if (cx < 0 || cy < 0 || cx >= this.PW || cy >= this.PH) break;
        if (this.cg[cy * this.PW + cx] < EMPTY) break;
        score++;
      }
      return score;
    },

    // Tarbell's findStart, choosing the best of a few candidates by how much
    // open ground lies ahead: purely random starts spent the plate's later life
    // on walkers that died a unit later, and fresh cells took minutes to fill.
    findStart(o) {
      if (this.nSamples === 0) return false;
      let best = null, bestScore = -1;
      for (let k = 0; k < 7 && bestScore < 5; k++) {
        const i = Math.floor(rnd() * this.nSamples);
        const x = this.samples[i * 2], y = this.samples[i * 2 + 1];
        if (!this.isCrack(x, y)) continue;
        const c = this.cg[(y | 0) * this.PW + (x | 0)];
        const a = c + (rnd() < 0.5 ? 90 : -90) + (rnd() - 0.5) * 4;
        const sc = this.openAhead(x, y, a);
        if (sc > bestScore) { bestScore = sc; best = [x, y, a]; }
      }
      if (!best || bestScore < 1) return false;
      const [x, y, a] = best;
      this.spawn(x + 0.61 * Math.cos(a * DEG), y + 0.61 * Math.sin(a * DEG), a, o);
      return true;
    },

    addSample(x, y) {
      if (this.nSamples < SAMPLE_CAP) { this.samples[this.nSamples * 2] = x; this.samples[this.nSamples * 2 + 1] = y; this.nSamples++; }
      else { const i = Math.floor(rnd() * SAMPLE_CAP); this.samples[i * 2] = x; this.samples[i * 2 + 1] = y; }
    },

    // Advances one walker n steps, painting its sand as it goes. Returns
    // false when it dies.
    advance(w, n, sandA, hat) {
      const PW = this.PW, PH = this.PH, cg = this.cg;
      const sd = this.sd, SW = this.SW, SH = this.SH, RS = this.RS, dirty = this.dirty, DBX = this.DBX;
      const col = this.P.sands[w.sand], c0 = col[0], c1 = col[1], c2 = col[2];
      for (let s = 0; s < n; s++) {
        w.a += w.bend;
        const r = w.a * DEG, ca = Math.cos(r), sa = Math.sin(r);
        w.x += STEP * ca; w.y += STEP * sa;
        const cx = w.x | 0, cy = w.y | 0;
        if (w.x < 0 || w.y < 0 || cx >= PW || cy >= PH) return false;
        const idx = cy * PW + cx, c = cg[idx];
        if (c === BLOCKED) return false;
        if (c >= EMPTY || angDiff(c, w.a) < 5 || w.grace > 0) {
          cg[idx] = w.a;
          if (w.grace > 0) w.grace--;
        } else if (angDiff(c, w.a) > 2) {
          w.path.push(w.x, w.y);
          if (w.steps > 6) {
            this.junctions.push({ x: w.x, y: w.y, a: w.a });
            if (this.junctions.length > 16) this.junctions.shift();
          }
          return false;
        }
        w.steps++;
        if ((w.steps % 5) === 0) this.addSample(w.x, w.y);
        const ti = Math.min(this.TX - 1, (w.x / this.tw) | 0) + Math.min(this.TY - 1, (w.y / this.th) | 0) * this.TX;
        this.tiles[ti].ink++;

        // SandPainter: walk the perpendicular to the nearest wall, then
        // scatter grains toward it, dense at the crack.
        if (sandA > 0.002) {
          let rx = w.x, ry = w.y, k = 0;
          const px = 0.81 * sa, py = -0.81 * ca;
          for (; k < 70; k++) {
            rx += px; ry += py;
            const qx = rx | 0, qy = ry | 0;
            if (rx < 0 || ry < 0 || qx >= PW || qy >= PH) break;
            if (cg[qy * PW + qx] < EMPTY) break;
          }
          w.g = clamp(w.g + (rnd() - 0.5) * (0.1 + 0.25 * hat), 0, 1);
          const gw = w.g / (GRAINS - 1), dxr = rx - w.x, dyr = ry - w.y;
          for (let i = 0; i < GRAINS; i++) {
            const f = Math.sin(Math.sin(i * gw));
            const gx = ((w.x + dxr * f) * RS) | 0, gy = ((w.y + dyr * f) * RS) | 0;
            if (gx < 0 || gy < 0 || gx >= SW || gy >= SH) continue;
            // Non-premultiplied "over", as putImageData wants it.
            const a = sandA * (1 - i / GRAINS);
            const o = (gy * SW + gx) * 4, A = sd[o + 3] / 255;
            const oa = a + A * (1 - a), k1 = a / oa, k2 = 1 - k1;
            sd[o] = c0 * k1 + sd[o] * k2;
            sd[o + 1] = c1 * k1 + sd[o + 1] * k2;
            sd[o + 2] = c2 * k1 + sd[o + 2] * k2;
            sd[o + 3] = oa * 255 + 0.5;
            dirty[(gy >> 5) * DBX + (gx >> 5)] = 1;
          }
        }
      }
      return true;
    },

    // ------------------------------------------------------------------ events
    onKick(t, P, react) {
      let n = Math.floor(P.spawn) + (rnd() < P.spawn - Math.floor(P.spawn) ? 1 : 0);
      if (n <= 0) return;
      for (let k = 0; k < n; k++) {
        const j = this.junctions.pop();
        const first = k === 0;
        if (j && this.isCrack(j.x, j.y)) {
          // Punch through the dead end: the crack that stopped here carries
          // on across the street it hit.
          const dx = Math.cos(j.a * DEG), dy = Math.sin(j.a * DEG);
          this.spawn(j.x + dx * 0.9, j.y + dy * 0.9, j.a, { ink: first ? 1 : 0, grace: 6, burst: 0.45 });
          if (first) {
            this.stamp(j.x, j.y);
            this.rings.push({ x: j.x, y: j.y, t0: t, r: 1 + 0.5 * react });
            this.kickPts.push([j.x, j.y]); if (this.kickPts.length > 6) this.kickPts.shift();
          }
        } else {
          this.findStart({ ink: first ? 1 : 0, burst: 0.45 });
        }
      }
      if (this.rings.length > 12) this.rings.shift();
    },

    stamp(x, y) {
      const pc = this.lc;
      pc.setTransform(this.R, 0, 0, this.R, 0, 0);
      pc.globalAlpha = 0.92;
      pc.globalCompositeOperation = 'source-over';
      pc.fillStyle = rgb(this.P.accent);
      pc.beginPath(); pc.arc(x, y, 2.6, 0, Math.PI * 2); pc.fill();
    },

    onSnare(P) {
      if (rnd() > P.blocks) return;
      const cands = [];
      for (let k = this.kickPts.length - 1; k >= 0; k--) cands.push(this.kickPts[k]);
      for (let k = 0; k < 6 && this.nSamples; k++) {
        const i = Math.floor(rnd() * this.nSamples);
        cands.push([this.samples[i * 2], this.samples[i * 2 + 1]]);
      }
      for (const [x0, y0] of cands) {
        const a = rnd() * 360;
        const x = x0 + 3.5 * Math.cos(a * DEG), y = y0 + 3.5 * Math.sin(a * DEG);
        if (this.inkBlock(x, y, P)) return;
      }
    },

    // Flood the block containing (x, y) on the crack grid, give up if it is
    // not closed within a city-block's area, then print it eroded two units
    // off its streets so the paper shows along them, as on a street map.
    inkBlock(x, y, P) {
      const PW = this.PW, PH = this.PH, cg = this.cg;
      const sx = x | 0, sy = y | 0;
      if (sx < 2 || sy < 2 || sx >= PW - 2 || sy >= PH - 2 || cg[sy * PW + sx] < EMPTY) return false;
      const cap = 7000;
      const gen = ++this.gen, vis = this.visit;
      const q = this.fq || (this.fq = new Int32Array(cap + 8));
      let head = 0, tail = 0;
      q[tail++] = sy * PW + sx; vis[sy * PW + sx] = gen;
      let x0 = sx, x1 = sx, y0 = sy, y1 = sy;
      while (head < tail) {
        const i = q[head++], cx = i % PW, cy = (i / PW) | 0;
        if (cx <= 0 || cy <= 0 || cx >= PW - 1 || cy >= PH - 1) return false;   // open to the edge
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        const nb = [i - 1, i + 1, i - PW, i + PW];
        for (let k = 0; k < 4; k++) {
          const m = nb[k];
          if (vis[m] === gen || cg[m] < EMPTY) continue;
          if (tail >= cap) return false;
          vis[m] = gen; q[tail++] = m;
        }
      }
      if (tail < 90) return false;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const cv = makeCanvas(bw, bh), g = cv.getContext('2d');
      const id = g.createImageData(bw, bh), d = id.data;
      const col = this.P.blocks[Math.floor(rnd() * this.P.blocks.length)];
      for (let k = 0; k < tail; k++) {
        const i = q[k], cx = i % PW, cy = (i / PW) | 0;
        let near = false;
        for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -2; ox <= 2; ox++) {
          const qx = cx + ox, qy = cy + oy;
          if (qx < 0 || qy < 0 || qx >= PW || qy >= PH || cg[qy * PW + qx] < EMPTY) { near = true; break; }
        }
        if (near) continue;
        const o = ((cy - y0) * bw + (cx - x0)) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
        d[o + 3] = 170 + Math.floor(rnd() * 85);   // riso grain
      }
      g.putImageData(id, 0, 0);
      this.fills.push({ cv, x: x0, y: y0, w: bw, h: bh, u: 0, op: 0.4 + 0.45 * P.blocks });
      return true;
    },

    // ------------------------------------------------------------------ renewal
    beginRepaper(tile, t) {
      const PW = this.PW, cg = this.cg;
      const X0 = Math.floor(tile.i * this.tw), X1 = Math.min(PW, Math.ceil((tile.i + 1) * this.tw));
      const Y0 = Math.floor(tile.j * this.th), Y1 = Math.min(this.PH, Math.ceil((tile.j + 1) * this.th));
      for (let y = Y0; y < Y1; y++) cg.fill(BLOCKED, y * PW + X0, y * PW + X1);
      const inside = (x, y) => x >= X0 && x < X1 && y >= Y0 && y < Y1;
      this.walkers = this.walkers.filter((w) => !inside(w.x, w.y));
      this.junctions = this.junctions.filter((j) => !inside(j.x, j.y));
      this.kickPts = this.kickPts.filter((j) => !inside(j[0], j[1]));
      let n = 0;
      for (let i = 0; i < this.nSamples; i++) {
        const x = this.samples[i * 2], y = this.samples[i * 2 + 1];
        if (inside(x, y)) continue;
        this.samples[n * 2] = x; this.samples[n * 2 + 1] = y; n++;
      }
      this.nSamples = n;
      // The fresh paper, cut and feathered once; faded in over a second.
      const R = this.R, F = this.maskF;
      const tmp = makeCanvas(this.mask.width, this.mask.height), g = tmp.getContext('2d');
      const px = tile.i * this.tw * R - F, py = tile.j * this.th * R - F;
      g.drawImage(this.paperCv, px, py, tmp.width, tmp.height, 0, 0, tmp.width, tmp.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(this.mask, 0, 0);
      tile.fade = { cv: tmp, px, py, u: 0, X0, X1, Y0, Y1 };
      tile.ink = 0;
    },

    liftSand(f, inc) {
      const RS = this.RS, SW = this.SW, SH = this.SH, sd = this.sd;
      const F = 6 * RS;
      const x0 = f.X0 * RS, x1 = f.X1 * RS, y0 = f.Y0 * RS, y1 = f.Y1 * RS;
      const gx0 = Math.max(0, Math.floor(x0 - F / 2)), gx1 = Math.min(SW, Math.ceil(x1 + F / 2));
      const gy0 = Math.max(0, Math.floor(y0 - F / 2)), gy1 = Math.min(SH, Math.ceil(y1 + F / 2));
      for (let y = gy0; y < gy1; y++) {
        const dy = Math.min(y - y0, y1 - y);
        for (let x = gx0; x < gx1; x++) {
          const d = Math.min(dy, x - x0, x1 - x);
          const k = d >= F / 2 ? 1 : (d + F / 2) / F;
          if (k <= 0) continue;
          const o = (y * SW + x) * 4 + 3;
          sd[o] = sd[o] * (1 - inc * k);
        }
      }
      for (let by = gy0 >> 5; by <= (gy1 - 1) >> 5; by++) for (let bx = gx0 >> 5; bx <= (gx1 - 1) >> 5; bx++) this.dirty[by * this.DBX + bx] = 1;
    },

    endRepaper(tile) {
      const f = tile.fade, PW = this.PW, cg = this.cg;
      for (let y = f.Y0; y < f.Y1; y++) cg.fill(EMPTY, y * PW + f.X0, y * PW + f.X1);
      tile.fade = null;
      // A new district at its own angle.
      const x = f.X0 + (f.X1 - f.X0) * (0.3 + 0.4 * rnd()), y = f.Y0 + (f.Y1 - f.Y0) * (0.3 + 0.4 * rnd());
      this.seedPair(x, y, rnd() * 180, 0);
    },

    // ------------------------------------------------------------------ draw
    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === undefined || this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const pal = clamp(Math.round(params.palette), 0, PALETTES.length - 1);
      this.bendNow = params.bend;
      if (this.fieldPh !== undefined) this.fieldPh += dt * 0.012;

      if (!this.cg || Math.abs(this.W - W) > 0.5 || Math.abs(this.H - H) > 0.5) {
        this.build(p, W, H, pal);
        this.env = { low: 0, dropOn: false, auto: 0, hadDrop: false, bass: 0, hat: 0, lastKick: -10, lastSnare: -10, stall: 1 };
        this.prev = new Float32Array(9);
        // Pre-grow a skeleton so the first frame is already a plan.
        for (let k = 0; k < 260; k++) {
          this.simulate(PRESETS.calm, 3, 0.5, 0, 1 / 60, t, params);
          if (k % 65 === 64) this.flush(params);
        }
      }
      if (pal !== this.palIdx || this.freshRequest) {
        // A new plate, or a fresh one: re-paper every cell quickly in random
        // order rather than cutting, so the change reads as a paste-up.
        this.freshRequest = false;
        if (pal !== this.palIdx) this.setPalette(pal);
        this.queue = this.tiles.slice().sort(() => rnd() - 0.5);
      }

      // ---- listen
      const e = this.env, s = signals;
      const follow = Math.round(params.follow) === 1;
      const react = params.reaction;
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      let kick = false, snare = false;
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - e.lastKick > 0.22) { e.lastKick = t; kick = true; }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - e.lastSnare > 0.28) { e.lastSnare = t; snare = true; }
      this.prev.set(s);
      const bass = Math.max(s[0], s[1]) / 100;
      e.bass = ease(e.bass, bass, bass > e.bass ? 6 : 1.5, dt);
      const hatNow = (s[6] + s[7] + s[8]) / 300;
      e.hat = ease(e.hat, hatNow, hatNow > e.hat ? 30 : 6, dt);
      // Section follower on the sidechained bass line (band 1), which is
      // near-silent outside the drop; hysteresis so a stray kick cannot flip it.
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; e.hadDrop = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.8 : 0.45, dt);
      // The breakdown stalls growth, so the long exposure sits there to read.
      const quiet = t - e.lastKick > 1.5;
      e.stall = ease(e.stall, follow && e.hadDrop && !e.dropOn && quiet ? 0.2 : 1, 0.6, dt);

      if (kick) this.onKick(t, P, react);
      if (snare) this.onSnare(P);

      // Growth: bass drives travel; spare capacity refills at a rate, so the
      // drop's extra walkers pour in over a second rather than appearing.
      e.pad = ease(e.pad || 0, (s[2] + s[3] + s[4]) / 300, 1.2, dt);
      const perFrame = P.speed * (0.55 + 1.5 * e.bass * react + 0.5 * e.pad) * 2.2 * e.stall * dt * 60;
      this.simulate(P, perFrame, e.hat * react, t, dt, t, params);
      this.flush(params);

      // ---- renewal
      const pc = this.pc;
      // A plate reads as built up at about 5-6% ink by area (street length
      // over area, measured on the harness track); past the threshold, the
      // densest cells are re-papered one at a time, in random order among them.
      const area = this.tw * this.th;
      let mean = 0;
      for (const tl of this.tiles) mean += tl.ink * STEP / area;
      mean /= this.tiles.length;
      if (params.renew > 0.001 && mean > 0.035 + 0.04 * (1 - params.renew)) {
        // Renewal keeps pace with growth, so a stalled breakdown keeps its
        // long exposure instead of filling with blank cells.
        this.renewAcc += dt * (0.25 + 1.1 * params.renew) * clamp(perFrame / 2.5, 0.15, 1.5);
        if (this.renewAcc >= 1) {
          this.renewAcc = 0;
          const cands = this.tiles.filter((tl) => !tl.fade).sort((x, y) => y.ink - x.ink);
          cands.length = Math.max(1, Math.ceil(cands.length / 3));
          this.beginRepaper(cands[Math.floor(rnd() * cands.length)], t);
        }
      } else this.renewAcc = 0;
      if (this.queue.length) {
        this.queueAcc = (this.queueAcc || 0) + dt;
        while (this.queueAcc > 0.06 && this.queue.length) {
          this.queueAcc -= 0.06;
          const tl = this.queue.pop();
          if (!tl.fade) this.beginRepaper(tl, t);
        }
      }
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalCompositeOperation = 'source-over';
      for (const tl of this.tiles) {
        const f = tl.fade;
        if (!f) continue;
        const u1 = Math.min(1, f.u + dt / 1.1);
        const inc = (u1 - f.u) / Math.max(1e-3, 1 - f.u);
        pc.globalAlpha = inc;
        pc.drawImage(f.cv, f.px, f.py);
        // The lines and the sand lift off under the same feathered edge.
        const lc = this.lc;
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.globalCompositeOperation = 'destination-out';
        lc.globalAlpha = inc;
        lc.drawImage(this.mask, f.px, f.py);
        lc.globalCompositeOperation = 'source-over';
        lc.globalAlpha = 1;
        this.liftSand(f, inc);
        f.u = u1;
        if (u1 >= 1) this.endRepaper(tl);
      }
      // Inked blocks print over half a second.
      pc.globalCompositeOperation = this.P.dark ? 'screen' : 'multiply';
      pc.imageSmoothingEnabled = true;
      for (let k = this.fills.length - 1; k >= 0; k--) {
        const f = this.fills[k];
        const u1 = Math.min(1, f.u + dt / 0.45);
        // Each frame lays its share of the final density; the multiply
        // compounds a little, which only deepens the print slightly.
        pc.globalAlpha = f.op * (u1 - f.u);
        pc.drawImage(f.cv, f.x * this.R, f.y * this.R, f.w * this.R, f.h * this.R);
        f.u = u1;
        if (u1 >= 1) this.fills.splice(k, 1);
      }
      pc.globalCompositeOperation = 'source-over';
      pc.globalAlpha = 1;

      // ---- camera
      const PWv = this.PW, PHv = this.PH;
      let tx = PWv / 2, ty = PHv / 2;
      if (this.kickPts.length) {
        tx = 0; ty = 0;
        for (const q of this.kickPts) { tx += q[0]; ty += q[1]; }
        tx /= this.kickPts.length; ty /= this.kickPts.length;
      }
      const wander = 0.09 * P.travel;
      tx += PWv * wander * Math.sin(t * 0.043 + 1.3);
      ty += PHv * wander * Math.sin(t * 0.031);
      if (!this.cam) this.cam = [PWv / 2, PHv / 2, t];
      const kc = 1 - Math.exp(-dt * (0.04 + 0.16 * P.travel));
      this.cam[0] += (tx - this.cam[0]) * kc; this.cam[1] += (ty - this.cam[1]) * kc;
      const z = 1.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.021));
      const vw = W / z, vh = H / z;
      const cx = clamp(this.cam[0], vw / 2, PWv - vw / 2), cy = clamp(this.cam[1], vh / 2, PHv - vh / 2);
      const vx0 = cx - vw / 2, vy0 = cy - vh / 2;

      // ---- composite
      const c = p.drawingContext;
      c.save();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.imageSmoothingEnabled = true;
      // Low (bilinear) quality: 'high' rebuilds mipmaps of all three plates,
      // which change every frame, and the downscale is only about 1.2x.
      c.imageSmoothingQuality = 'low';
      c.fillStyle = rgb(this.P.paper);
      c.fillRect(-2, -2, W + 4, H + 4);
      const R = this.R;
      c.drawImage(this.plate, vx0 * R, vy0 * R, vw * R, vh * R, 0, 0, W, H);
      const RS = this.RS;
      c.drawImage(this.sandCv, vx0 * RS, vy0 * RS, vw * RS, vh * RS, 0, 0, W, H);
      c.drawImage(this.linePlate, vx0 * R, vy0 * R, vw * R, vh * R, 0, 0, W, H);

      // Growing heads: the pen nibs, so the drawing is visibly being drawn.
      const toX = (x) => (x - vx0) * z, toY = (y) => (y - vy0) * z;
      c.fillStyle = rgb(this.P.ink);
      c.beginPath();
      for (const w of this.walkers) {
        if (w.ink) continue;
        const X = toX(w.x), Y = toY(w.y);
        if (X < -4 || Y < -4 || X > W + 4 || Y > H + 4) continue;
        c.moveTo(X + 1.3, Y); c.arc(X, Y, 1.3, 0, Math.PI * 2);
      }
      c.fill();
      c.fillStyle = rgb(this.P.accent);
      c.beginPath();
      for (const w of this.walkers) {
        if (!w.ink) continue;
        const X = toX(w.x), Y = toY(w.y);
        c.moveTo(X + 2.2, Y); c.arc(X, Y, 2.2, 0, Math.PI * 2);
      }
      c.fill();
      // Survey rings where the beat landed: small, and only there.
      c.strokeStyle = rgb(this.P.accent);
      for (let k = this.rings.length - 1; k >= 0; k--) {
        const r = this.rings[k], u = (t - r.t0) / 0.8;
        if (u >= 1) { this.rings.splice(k, 1); continue; }
        const eo = 1 - Math.pow(1 - u, 3);
        c.globalAlpha = (1 - u) * 0.95;
        c.lineWidth = 3 * (1 - u) + 0.6;
        c.beginPath(); c.arc(toX(r.x), toY(r.y), (4 + 30 * eo * r.r) * z, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;

      // Paper light and a vignette, multiplied: a full cream frame is a
      // floodlight in a dark room.
      c.globalCompositeOperation = 'multiply';
      const L = Math.round(255 * clamp(params.paperLight, 0, 1));
      c.fillStyle = 'rgb(' + L + ',' + Math.round(L * 0.97) + ',' + Math.round(L * 0.9) + ')';
      c.fillRect(-2, -2, W + 4, H + 4);
      const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      vg.addColorStop(0, 'rgb(255,255,255)');
      vg.addColorStop(1, 'rgb(168,146,118)');
      c.fillStyle = vg;
      c.fillRect(-2, -2, W + 4, H + 4);
      c.restore();
    },

    // One tick of growth: refill the population, advance every walker, and
    // stroke the new crack segments on top of their sand.
    simulate(P, perFrame, hat, t, dt, now, params) {
      const target = Math.round(P.walkers);
      this.spawnAcc = (this.spawnAcc || 0) + dt * Math.max(4, target * 1.2);
      let tries = 0;
      while (this.walkers.length < target && this.spawnAcc >= 1 && tries < 40) {
        tries++;
        if (this.findStart()) this.spawnAcc -= 1;
      }
      if (this.walkers.length >= target) this.spawnAcc = Math.min(this.spawnAcc, 2);

      this.sandA = 0.2 * P.sand * (1 + 1.2 * hat);
      const alive = [];
      for (const w of this.walkers) {
        w.path = [w.x, w.y];
        const boost = w.burst > 0 ? 4 : 1;
        w.burst = Math.max(0, w.burst - dt);
        w.acc += perFrame * boost;
        const n = Math.floor(w.acc);
        w.acc -= n;
        let ok = true;
        if (n > 0) ok = this.advance(w, n, this.sandA, hat);
        if (ok) w.path.push(w.x, w.y);
        if (w.path.length >= 4) this.segs[w.ink].push(w.path);
        if (ok) alive.push(w);
      }
      this.walkers = alive;
    },

    // Prints what the walkers laid down since the last flush: the sand, one
    // path per colour and grain rank, then the crack lines over it, black and
    // then the beat's red.
    flush(params) {
      const pc = this.lc;
      pc.setTransform(this.R, 0, 0, this.R, 0, 0);
      // Upload the sand that changed, one run of dirty blocks at a time.
      const DBX = this.DBX, DBY = this.DBY, dirty = this.dirty;
      for (let by = 0; by < DBY; by++) {
        let bx = 0;
        while (bx < DBX) {
          if (!dirty[by * DBX + bx]) { bx++; continue; }
          const b0 = bx;
          while (bx < DBX && dirty[by * DBX + bx]) { dirty[by * DBX + bx] = 0; bx++; }
          const x = b0 * 32, y = by * 32;
          this.sc.putImageData(this.sandImg, 0, 0, x, y, Math.min(this.SW - x, (bx - b0) * 32), Math.min(this.SH - y, 32));
        }
      }
      pc.globalCompositeOperation = 'source-over';
      pc.lineCap = 'round';
      pc.lineJoin = 'round';
      const minW = 1.05 / this.R;
      const beat = clamp(params.beatInk, 0, 1);
      for (let pass = 0; pass < 2; pass++) {
        const list = this.segs[pass];
        if (!list.length) continue;
        const col = pass === 0 ? this.P.ink
          : this.P.accent.map((v, i) => v * beat + this.P.ink[i] * (1 - beat));
        pc.strokeStyle = rgb(col);
        pc.globalAlpha = pass === 0 ? 0.9 : 0.95;
        pc.lineWidth = Math.max(minW, pass === 0 ? 0.62 : 1.9);
        pc.beginPath();
        for (const q of list) {
          pc.moveTo(q[0], q[1]);
          for (let i = 2; i < q.length; i += 2) pc.lineTo(q[i], q[i + 1]);
        }
        pc.stroke();
        list.length = 0;
      }
      pc.globalAlpha = 1;
    },
  });
})();
