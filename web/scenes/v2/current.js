// Current V2 — dye and whirlpools on a moving river.
//
// V1's soul is kept whole: tens of thousands of particles riding a
// curl-plus-gradient noise field, inked per distance into a Float32 buffer
// that fades slowly and is tone-mapped through a LUT that never clips. See
// web/scenes/current.js for why each of those choices was made.
//
// What V2 adds, because the panel (and Raph, of batch 01 as a whole) could
// not find the music in V1:
//
// - A real current. The ink, the particles and the noise potential all slide
//   downstream together (see shiftInk), so the whirlpools are carried
//   intact. The bass sets how fast the river runs: movement that only ever
//   changes speed.
// - The kick drops dye. The nearest few hundred particles to one spot flash
//   and take a second ink; they deposit into a dye buffer as well as the
//   density buffer, and the flow draws the bloom out into coloured strands
//   that fade back into the ground hue. One place per kick.
// - The snare opens a whirlpool: a vortex spins up in one place for most of
//   a second and the water it catches takes a third, pale ink, leaving a
//   pale spiral.
// - The drop is bigger by speed and dye, not by turbulence. V1's drop pumped
//   high noise octaves, tightened the drains and shortened the trails; that is
//   what the judges saw as "tangled wire". V2 leaves the field's shape almost
//   alone under the bass.

(function () {
  // ------------------------------------------------------------ noise
  // Improved Perlin noise in 3D, permutation seeded from Math.random (which
  // the harness seeds, so renders are deterministic). Own table: V1 and V2
  // must not reseed each other.
  const perm = new Uint8Array(512);
  function seedNoise() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  seedNoise();

  const fade5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(h, x, y, z) {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : (g === 12 || g === 14 ? x : z);
    return ((g & 1) ? -u : u) + ((g & 2) ? -v : v);
  }
  function noise3(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = fade5(x), v = fade5(y), w = fade5(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    const l = (a, b, t) => a + t * (b - a);
    return l(
      l(l(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
        l(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      l(l(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
        l(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }

  // ------------------------------------------------------------ palette
  // Three inks per palette, in linear light: the water (V1's single hue),
  // the kick's dye, and the snare's whirlpool ink. The dyes are chosen against the
  // ground (a complement and a pale), never a spectrum.
  const INKS = [
    { name: 'Tide', ground: [0.03, 0.42, 0.62], dyeA: [1.00, 0.26, 0.24], dyeB: [0.96, 0.87, 0.68] },
    { name: 'Ember', ground: [0.95, 0.30, 0.05], dyeA: [0.10, 0.36, 0.95], dyeB: [0.90, 0.88, 0.80] },
    { name: 'Iris', ground: [0.30, 0.16, 0.95], dyeA: [1.00, 0.62, 0.06], dyeB: [0.62, 0.95, 0.80] },
    { name: 'Bone', ground: [0.78, 0.74, 0.66], dyeA: [0.90, 0.16, 0.08], dyeB: [0.08, 0.42, 0.52] },
  ];
  // The LUT is 3D: density × dye-A fraction × dye-B fraction, so every mix
  // goes through V1's tone curve and dye never clips or glows.
  const DL = 1024;             // density levels
  const FL = 12;               // levels per dye fraction
  const LUT_MAX = 6;           // density mapped across the table; beyond it is white-hot
  const WARMUP_STEPS = 75;     // frames the swarm runs ahead on entry (see draw)
  const COUNT = 30000;
  const TURBULENCE = 0.35;     // V1's default; the bass no longer drives it

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const KICK_PARTICLES = 650;
  const DYE_FLOOR = 0.002;      // dye ink below this is invisible, so it is dropped   // how many particles one kick dyes, at full Dye

  // k-th smallest of src[0..n) (quickselect on a scratch copy).
  function kth(src, work, n, k) {
    if (k >= n) k = n - 1;
    work.set(src.subarray(0, n));
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const pivot = work[(lo + hi) >> 1];
      let i = lo, j = hi;
      while (i <= j) {
        while (work[i] < pivot) i++;
        while (work[j] > pivot) j--;
        if (i <= j) { const t = work[i]; work[i] = work[j]; work[j] = t; i++; j--; }
      }
      if (k <= j) hi = j; else if (k >= i) lo = i; else break;
    }
    return work[k];
  }

  VIZ.register({
    id: 'currentv2',
    name: 'Current',
    versionOf: 'current',
    version: 'V2',
    order: 708,

    params: [
      { key: 'flow', label: 'Current', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'dye', label: 'Dye', type: 'range', min: 0, max: 1, default: 0.8, step: 0.01 },
      { key: 'whirl', label: 'Whirlpools', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'speed', label: 'Swirl speed', type: 'range', min: 0.2, max: 3, default: 1, step: 0.01 },
      { key: 'trail', label: 'Trail length', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'scale', label: 'Eddy size', type: 'range', min: 0.4, max: 2.5, default: 1, step: 0.01 },
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((h) => h.name), default: 0 },
      { key: 'response', label: 'Music response', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'Re-seed', run() { seedNoise(); this.needsClear = true; } },
      { id: 'clear', label: 'Clear', run() { this.needsClear = true; } },
    ],

    gallery: {
      title: 'Current',
      technique: 'Particles advected through curl-plus-gradient Perlin noise, inked per distance into Float32 density and two dye buffers that slide downstream with the particles and the potential, plus transient vortices; tone-mapped through a 3D (density × dye × dye) LUT',
      brief: 'Dye on a moving river. Silk streamlines braid into whirlpools and the whole river slides downstream; the bass sets how fast it runs. Each kick drops a flash of coral dye into the water at one place, and the eddies draw it out into coloured strands; each clap spins up a whirlpool that winds a pale spiral into the silk. The drop runs fast and fills with dye; the breakdown slows to a drift and washes back to one hue.',
      lineage: [
        'V2 of Current (web/scenes/current.js, #8 of 72): the field, the Float32 ink and the tone curve are V1\'s, unchanged.',
        'Acted on "the kick itself is hard to pick out" (floor, purist) and Raph\'s batch-01 verdict: the kick is now a flash of dye in one place, the snare a whirlpool that winds a pale spiral (a comb line was tried first; the drains ate it).',
        'Acted on "the drop turns scribbly / tangled wire" (psychonaut, curator): the bass no longer adds turbulence octaves, tightens the drains hard or shortens the trails; the drop is bigger by river speed and dye.',
        'Reinterpreted "floats in a void, fly through it" (psychonaut) as a current: ink, particles and potential slide downstream together, the bass setting the speed. Moving only the particles and potential drew straight fronts across the frame.',
        'Reinterpreted light-age colouring (psychonaut, curator) as dye: colour shows flow direction only where the music put it, and the ground stays one hue.',
        'Rejected parallax motes, a centroid-to-curl mapping and the corridor/plotter transplants as dilutions or other scenes.',
      ],
    },

    // Allocated lazily in draw, because sizes depend on the canvas.
    d2s: null, sel: null, vortices: [],
    rowDye: null,
    bufW: 0, bufH: 0, visW: 0, pad: 0, shiftAcc: 0, density: null, dyeBufA: null, dyeBufB: null,
    image: null, pix: null, off: null, offCtx: null,
    n: 0, px: null, py: null, age: null, life: null, tagA: null, tagB: null, pendA: null, pendB: null, flash: null,
    grid: null, gridVX: null, gridVY: null, gw: 0, gh: 0, cell: 0, margin: 0,
    lut: null, lut0: null, lutInks: -1, marked: null,
    env: new Float32Array(9),
    fieldT: 0, drift: 0, flowOX: 0, flowOY: 0, river: 0,
    kLow: 0, sLow: 0, sinceKick: 99, sinceSnare: 99, nKick: 0, nSnare: 0,
    needsClear: true, warmup: 0, ux: 0, uy: 0,

    enter() {
      this.needsClear = true;
      // Start part-way along the field's time so it isn't the same opening
      // every entry; the warm-up in draw forms the rivers from there.
      this.fieldT = 0.03;
      this.drift = 0;
      this.flowOX = 0; this.flowOY = 0;
      this.river = 0;
      this.env.fill(0);
      this.kLow = 0; this.sLow = 0; this.sinceKick = 99; this.sinceSnare = 99;
      this.vortices = [];
    },

    allocate(p) {
      const dw = Math.round(p.width * p.pixelDensity());
      const dh = Math.round(p.height * p.pixelDensity());
      // Cap near 2.1 million pixels so 1080p stays native (V1's reasoning).
      const k = Math.min(1, Math.sqrt(2.1e6 / (dw * dh)));
      const w = Math.max(16, Math.round(dw * k));
      const h = Math.max(16, Math.round(dh * k));
      if (w === this.visW && h === this.bufH) return;
      // The ink moves with the river (see shiftInk), so the buffer carries a
      // hidden upstream pad where ink builds up before it slides into view.
      // Without it, each column would enter the frame with no history and
      // the upstream edge would read as a dark band.
      this.visW = w;
      this.pad = Math.round(0.16 * w);
      const bw = w + this.pad;
      this.bufW = bw; this.bufH = h;
      this.density = new Float32Array(bw * h);
      this.dyeBufA = new Float32Array(bw * h);
      this.dyeBufB = new Float32Array(bw * h);
      // Rows that hold any dye; the rest take V1's plain tone-map path.
      this.rowDye = new Uint8Array(h + 5);
      this.off = document.createElement('canvas');
      this.off.width = w; this.off.height = h;
      this.offCtx = this.off.getContext('2d');
      this.image = this.offCtx.createImageData(w, h);
      this.pix = new Uint32Array(this.image.data.buffer);
      // Velocity on a coarse lattice, interpolated (V1: per-particle noise
      // costs ~10x the frame budget). Margin domain beyond the screen so
      // neither respawns nor the upstream entry show at the edges.
      this.cell = Math.max(4, Math.round(w / 160));
      this.margin = this.cell * 4;
      this.gw = Math.ceil((bw + 2 * this.margin) / this.cell) + 4;
      this.gh = Math.ceil((h + 2 * this.margin) / this.cell) + 4;
      this.grid = new Float32Array(this.gw * this.gh);
      this.gridVX = new Float32Array(this.gw * this.gh);
      this.gridVY = new Float32Array(this.gw * this.gh);
      this.needsClear = true;
    },

    buildLut(inkIndex) {
      const c = INKS[inkIndex] || INKS[0];
      const lut = new Uint32Array(DL * FL * FL);
      const hue = [0, 0, 0];
      const g = (v) => Math.round(255 * Math.pow(clamp01(v), 1 / 2.2));
      for (let li = 0; li < DL; li++) {
        const d = (li / (DL - 1)) * LUT_MAX;
        const t = 1 - Math.exp(-d);                 // soft shoulder: never clips
        const body = Math.pow(t, 2.1) * 1.35;       // the hue carries the midtones
        const core = Math.pow(t, 6) * 0.8;          // only dense rivers go pale
        for (let ia = 0; ia < FL; ia++) {
          for (let ib = 0; ib < FL; ib++) {
            // Dye shows where the ink is: in the faint haze it would read as
            // a muddy brown wash, so the darks keep the water's hue.
            const show = Math.min(1, Math.max(0, (t - 0.06) / 0.3));
            let fa = (ia / (FL - 1)) * show, fb = (ib / (FL - 1)) * show;
            const s = fa + fb;
            if (s > 1) { fa /= s; fb /= s; }
            const f0 = 1 - fa - fb;
            for (let ch = 0; ch < 3; ch++) {
              hue[ch] = c.ground[ch] * f0 + c.dyeA[ch] * fa + c.dyeB[ch] * fb;
            }
            // Dye rides a little under the pale core, so a dyed river stays
            // coloured where plain water would go white-hot.
            const coreK = core * (1 - 0.7 * (fa + fb));
            const r = g(hue[0] * 0.006 + hue[0] * body + coreK);
            const gg = g(hue[1] * 0.006 + hue[1] * body + coreK);
            const b = g(hue[2] * 0.006 + hue[2] * body + coreK);
            lut[(li * FL + ia) * FL + ib] = (255 << 24) | (b << 16) | (gg << 8) | r;
          }
        }
      }
      this.lut = lut;
      // Undyed water is most of the frame: give it its own contiguous table
      // (V1's), because stepping through the 3D one by 144 entries per
      // density level missed the cache on every pixel.
      this.lut0 = new Uint32Array(DL);
      for (let li = 0; li < DL; li++) this.lut0[li] = lut[li * FL * FL];
      this.lutInks = inkIndex;
    },

    respawn(i) {
      const m = this.margin;
      this.px[i] = -m + Math.random() * (this.bufW + 2 * m);
      this.py[i] = -m + Math.random() * (this.bufH + 2 * m);
      this.age[i] = 0;
      this.life[i] = 90 + Math.random() * 240;
      this.tagA[i] = 0; this.tagB[i] = 0; this.pendA[i] = 0; this.pendB[i] = 0; this.flash[i] = 0;
    },

    ensureParticles(count) {
      if (this.px && this.px.length >= count) { this.n = count; return; }
      this.px = new Float32Array(count); this.py = new Float32Array(count);
      this.age = new Float32Array(count); this.life = new Float32Array(count);
      this.tagA = new Float32Array(count); this.tagB = new Float32Array(count);
      this.pendA = new Float32Array(count); this.pendB = new Float32Array(count);
      this.flash = new Float32Array(count);
      this.marked = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        this.respawn(i);
        this.age[i] = Math.random() * this.life[i];
      }
      this.n = count;
    },

    // ψ on the lattice (translated with the current), then
    // v = curl ψ − c·∇ψ by central differences.
    buildField(params, bass, feature, kb, r) {
      const { gw, gh, cell, grid, gridVX, gridVY, margin } = this;
      const t = this.fieldT;
      const inv = 1 / (feature * kb);                 // buffer px → noise units
      // A touch of bass on the fine octaves only; V1's +0.45 is what turned
      // the drop to wire.
      const turb = clamp01(TURBULENCE + bass * 0.08 * r);
      const a2 = 0.5 * turb, a3 = 0.28 * turb;
      const ox = this.drift - this.flowOX, oy = -this.flowOY;
      for (let j = 0; j < gh; j++) {
        const y = ((j - 1) * cell - margin) * inv + oy;
        for (let i = 0; i < gw; i++) {
          const x = ((i - 1) * cell - margin) * inv + ox;
          let v = noise3(x, y, t);
          v += a2 * noise3(x * 2.13 + 5.2, y * 2.13 - 1.3, t * 1.7);
          v += a3 * noise3(x * 4.37 - 7.1, y * 4.37 + 3.3, t * 2.9);
          grid[j * gw + i] = v;
        }
      }
      const c = params.whirl * (1 + bass * 0.2 * r);
      const h2 = 1 / (2 * cell * inv);
      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const k = j * gw + i;
          const gx = (grid[k + 1] - grid[k - 1]) * h2;
          const gy = (grid[k + gw] - grid[k - gw]) * h2;
          gridVX[k] = gy - c * gx;
          gridVY[k] = -gx - c * gy;
        }
      }
    },

    // Move every particle one frame: its swirl along the field plus the
    // river's mean flow, inking its path into the density and dye buffers.
    advect(W, H, speed, ink, dyeFade, dyeBoost, flashInk) {
      const { gw, cell, margin, gridVX, gridVY, density, dyeBufA, dyeBufB,
        px, py, age, life, tagA, tagB, pendA, pendB, flash, rowDye, marked } = this;
      const xMax = W + margin, yMax = H + margin;
      const invCell = 1 / cell;
      const spanX = W + 2 * margin;
      // V1's substep count (a step covers at most ~1.3 px at the local
      // speed cap). Particles inside a live whirlpool get more, for its
      // spin; only they pay for it.
      const nSub0 = Math.min(8, Math.max(1, Math.ceil(speed / 0.8)));
      // Live whirlpools: spin eases in over ~5 frames and dies away over
      // ~0.7 s. Tangential speed peaks at sigma; a little inflow makes it
      // a spiral rather than a ring. vs holds x, y, sigma, spin per frame.
      const vs = [];
      let spinMax = 0;
      for (const v of this.vortices) {
        const e = Math.min(1, v.age / 5) * Math.exp(-v.age / 26);
        if (e > 0.02) { vs.push(v.x, v.y, v.sigma, v.spin * e); spinMax = Math.max(spinMax, Math.abs(v.spin * e)); }
      }
      const nv = vs.length;
      const nSubV = Math.min(10, Math.max(1, Math.ceil((speed + 0.7 * spinMax) / 0.8)));
      for (let i = 0; i < this.n; i++) {
        let x = px[i], y = py[i];
        const a = age[i] + 1;
        age[i] = a;
        if (a >= life[i]) { this.respawn(i); continue; }
        // Tapered strand: births and deaths never show as dots.
        const env01 = Math.sin(Math.PI * a / life[i]);
        // A trigger sets the pending dye; the tag the particle inks with
        // eases toward it over a few frames, so a bloom's rim is soft.
        let ta = 0, tb = 0, fl = 0;
        let dyed = marked[i] === 1;
        if (dyed) {
          ta = tagA[i]; tb = tagB[i];
          const pa = pendA[i] * dyeFade, pb = pendB[i] * dyeFade;
          pendA[i] = pa; pendB[i] = pb;
          ta += (pa - ta) * 0.3; tb += (pb - tb) * 0.2;
          tagA[i] = ta; tagB[i] = tb;
          // The strike itself: for a tenth of a second or so the struck
          // particles ink several times harder, so the beat lands as a
          // bright bloom (or a bright stroke) in one place, then settles
          // into the dye it leaves.
          fl = flash[i];
          if (fl > 0.01) flash[i] = fl * 0.86; else fl = 0;
          if (ta + tb + pa + pb < 0.03) { marked[i] = 0; dyed = false; ta = tb = 0; }
        }
        const w = ink * env01 * (dyed ? 1 + dyeBoost * (ta + tb) : 1);
        // Flash ink is per frame, not per distance: particles sit nearly
        // still in the drains, and ink by distance there barely showed.
        const wf = fl > 0 ? flashInk * env01 * fl : 0;
        let out = false;
        let near = false;
        for (let t = 0; t < nv; t += 4) {
          const rx = x - vs[t], ry = y - vs[t + 1], lim = 3.3 * vs[t + 2];
          if (rx * rx + ry * ry < lim * lim) { near = true; break; }
        }
        const nSub = near ? nSubV : nSub0;
        const sw = speed / nSub, vScale = 1 / nSub;
        for (let s = 0; s < nSub; s++) {
          const gxp = (x + margin) * invCell + 1, gyp = (y + margin) * invCell + 1;
          const ix = gxp | 0, iy = gyp | 0;
          const fx = gxp - ix, fy = gyp - iy;
          const k = iy * gw + ix;
          const vx = (gridVX[k] * (1 - fx) + gridVX[k + 1] * fx) * (1 - fy)
                   + (gridVX[k + gw] * (1 - fx) + gridVX[k + gw + 1] * fx) * fy;
          const vy = (gridVY[k] * (1 - fx) + gridVY[k + 1] * fx) * (1 - fy)
                   + (gridVY[k + gw] * (1 - fx) + gridVY[k + gw + 1] * fx) * fy;
          const m = Math.sqrt(vx * vx + vy * vy);
          // Speed scales with the local field strength, capped, so eddy
          // cores slow down and drain rather than whip round (V1).
          const local = m > 1e-6 ? Math.min(1.6, m * 0.9) * sw / m : 0;
          let dx = vx * local, dy = vy * local;
          if (near) for (let t = 0; t < nv; t += 4) {
            const rx = x - vs[t], ry = y - vs[t + 1], sg = vs[t + 2];
            const q2 = (rx * rx + ry * ry) / (sg * sg);
            if (q2 < 9) {
              const k = vs[t + 3] * vScale * Math.exp(0.5 - 0.5 * q2) / sg;   // peak |v| = spin at r = sigma
              dx += -ry * k - 0.3 * Math.abs(k) * rx;
              dy += rx * k - 0.3 * Math.abs(k) * ry;
            }
          }
          x += dx; y += dy;
          if (x >= xMax) { x -= spanX; tagA[i] = tagB[i] = pendA[i] = pendB[i] = flash[i] = ta = tb = 0; }
          else if (x < -margin) { x += spanX; tagA[i] = tagB[i] = pendA[i] = pendB[i] = flash[i] = ta = tb = 0; }
          if (y < -margin || y >= yMax) { out = true; break; }
          if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) continue;   // off-screen: travel, no ink
          const d = near ? Math.sqrt(dx * dx + dy * dy) : m * local;
          const xi = x | 0, yi = y | 0;
          const ax = x - xi, ay = y - yi;
          const q = yi * W + xi;
          const dep = w * d;
          const w00 = dep * (1 - ax) * (1 - ay), w10 = dep * ax * (1 - ay);
          const w01 = dep * (1 - ax) * ay, w11 = dep * ax * ay;
          density[q] += w00; density[q + 1] += w10;
          density[q + W] += w01; density[q + W + 1] += w11;
          if (dyed) {
            rowDye[yi] = 1; rowDye[yi + 1] = 1;
            if (ta > 0.002) {
              dyeBufA[q] += w00 * ta; dyeBufA[q + 1] += w10 * ta;
              dyeBufA[q + W] += w01 * ta; dyeBufA[q + W + 1] += w11 * ta;
            }
            if (tb > 0.002) {
              dyeBufB[q] += w00 * tb; dyeBufB[q + 1] += w10 * tb;
              dyeBufB[q + W] += w01 * tb; dyeBufB[q + W + 1] += w11 * tb;
            }
          }
        }
        if (out) { this.respawn(i); continue; }
        // The flash is splatted soft (a 5x5 tent), once per frame: at a
        // point, near-still particles printed it as a grain of dots.
        if (wf > 0 && x >= 2 && y >= 2 && x < W - 3 && y < H - 3) {
          const c = ((y | 0) - 2) * W + ((x | 0) - 2);
          for (let j = (y | 0) - 2; j <= (y | 0) + 2; j++) rowDye[j] = 1;
          const wa = wf * (ta > 0.3 ? ta : 0.3) / 81, wd = wf / 81;
          for (let j = 0; j < 5; j++) {
            const kj = j < 3 ? j + 1 : 5 - j;
            for (let k = 0; k < 5; k++) {
              const kk = kj * (k < 3 ? k + 1 : 5 - k);
              const q = c + j * W + k;
              density[q] += wd * kk;
              dyeBufA[q] += wa * kk;
            }
          }
        }
        px[i] = x; py[i] = y;
      }
    },

    // Kick: a drop of dye. The nearest few hundred particles take dye A and
    // a short flash.
    dropDye(W, H, amount) {
      // Golden-ratio walk, so drops never land in the same place twice in a
      // row; biased upstream so the bloom has the frame to travel across.
      // Of a few candidates, the one on the most ink wins: dye dropped in a
      // void tags a handful of particles and reads as a faint haze.
      let cx = 0, cy = 0, best = -1;
      for (let c = 0; c < 5; c++) {
        const n = this.nKick++;
        const u = (0.37 + n * 0.6180339) % 1, v = (0.61 + n * 0.7548777) % 1;
        const x = this.pad + this.visW * (0.06 + 0.62 * u);
        const y = H * (0.14 + 0.72 * v);
        // Fresh water, not an old bloom: dye piled into one drain went
        // white-hot and stayed there for seconds.
        const sc = this.inkAround(this.density, x, y, W, H) - 2.5 * this.inkAround(this.dyeBufA, x, y, W, H);
        if (sc > best) { best = sc; cx = x; cy = y; }
      }
      // The bloom takes the nearest few hundred particles rather than a
      // fixed disc: particles gather in the drains, so a fixed disc caught
      // anywhere from 30 to 1,100 of them and half the kicks were invisible.
      // In a drain this makes a tight bright knot, in open water a wider,
      // softer bloom; capped so it stays one place.
      const { px, py, pendA, flash } = this;
      const n = this.n;
      if (!this.d2s || this.d2s.length < n) { this.d2s = new Float32Array(n); this.sel = new Float32Array(n); }
      const d2s = this.d2s;
      for (let i = 0; i < n; i++) {
        const dx = px[i] - cx, dy = py[i] - cy;
        d2s[i] = dx * dx + dy * dy;
      }
      const rmin = 0.05 * Math.min(this.visW, H), rmax = 0.16 * Math.min(this.visW, H);
      let r2 = kth(d2s, this.sel, n, Math.round(KICK_PARTICLES * amount));
      r2 = Math.min(rmax * rmax, Math.max(rmin * rmin, r2));
      for (let i = 0; i < n; i++) {
        const d2 = d2s[i];
        if (d2 < r2) {
          const f = amount * Math.sqrt(1 - d2 / r2);
          if (f > pendA[i]) pendA[i] = f;
          this.marked[i] = 1;
          if (f > flash[i]) flash[i] = f;
        }
      }
    },

    inkAround(buf, x, y, W, H) {
      const step = Math.max(2, Math.round(0.02 * Math.min(this.visW, H)));
      let s = 0;
      for (let j = -3; j <= 3; j++) {
        const yy = Math.round(y + j * step);
        if (yy < 0 || yy >= H) continue;
        for (let i = -3; i <= 3; i++) {
          const xx = Math.round(x + i * step);
          if (xx >= 0 && xx < W) s += buf[yy * W + xx];
        }
      }
      return s;
    },

    // Snare: a whirlpool opens. A vortex spins up in one place for most of
    // a second, and the water it catches takes the pale ink, so each clap
    // leaves a pale spiral in the silk: a motion event in its own colour,
    // where the kick is a coloured bloom. (A comb line across the flow was
    // tried first; the drains ate it within a beat and its strike read as a
    // hairy barcode.)
    whirl(W, H, amount, kb) {
      const n = this.nSnare++;
      const u = (0.2 + n * 0.6180339) % 1, v = (0.8 + n * 0.4142136) % 1;
      const cx = this.pad + this.visW * (0.12 + 0.62 * u), cy = H * (0.22 + 0.56 * v);
      const sigma = 0.075 * Math.min(this.visW, H);
      this.vortices.push({ x: cx, y: cy, sigma, age: 0,
        spin: (n & 1 ? 1 : -1) * amount * 2.4 * kb });
      if (this.vortices.length > 3) this.vortices.shift();
      const r2 = (1.25 * sigma) * (1.25 * sigma);
      const { px, py, pendB } = this;
      for (let i = 0; i < this.n; i++) {
        const dx = px[i] - cx, dy = py[i] - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const f = amount * Math.sqrt(1 - d2 / r2);
          if (f > pendB[i]) pendB[i] = f;
          this.marked[i] = 1;
        }
      }
    },

    // The river. Ink, particles and the noise potential all slide
    // downstream together by whole buffer pixels, so in the river's own
    // frame this is exactly V1's field and V1's swirl, and the music sets
    // how fast the whole of it travels. Two things this replaced:
    // particles carried continuously over a still ink buffer drew every
    // sharp feature of the moving field as a straight front sweeping across
    // the frame; and continuous particles over a whole-pixel ink shift
    // left a one-pixel sawtooth in every strand, which read as hatching.
    shiftInk(pxPerNoise) {
      this.shiftAcc += this.ux;
      const s = Math.floor(this.shiftAcc);
      if (s < 1) return;
      this.shiftAcc -= s;
      const W = this.bufW, H = this.bufH;
      this.flowOX += s / pxPerNoise;
      for (const v of this.vortices) v.x += s;
      const { px, tagA, tagB, pendA, pendB, flash } = this;
      const m = this.margin, xMax = W + m, spanX = W + 2 * m;
      // The domain wraps along the river, off screen, so the upstream side
      // is fed by exactly what leaves downstream and never thins.
      for (let i = 0; i < this.n; i++) {
        let x = px[i] + s;
        if (x >= xMax) { x -= spanX; tagA[i] = tagB[i] = pendA[i] = pendB[i] = flash[i] = 0; }
        px[i] = x;
      }
      if (s >= W) { this.density.fill(0); this.dyeBufA.fill(0); this.dyeBufB.fill(0); return; }
      for (const buf of [this.density, this.dyeBufA, this.dyeBufB]) {
        for (let y = 0; y < H; y++) {
          const row = y * W;
          buf.copyWithin(row + s, row, row + W - s);
          buf.fill(0, row, row + s);
        }
      }
    },

    draw(p, signals, params, ctx) {
      this.allocate(p);
      this.ensureParticles(COUNT);
      const inkIndex = Math.round(params.inks);
      if (inkIndex !== this.lutInks) this.buildLut(inkIndex);
      if (this.needsClear) {
        this.density.fill(0); this.dyeBufA.fill(0); this.dyeBufB.fill(0);
        for (let i = 0; i < this.n; i++) { this.respawn(i); this.age[i] = Math.random() * this.life[i]; }
        this.needsClear = false;
        this.warmup = WARMUP_STEPS;
      }

      // Envelope-follow the bands: fast attack, slow release (V1).
      const env = this.env;
      for (let b = 0; b < 9; b++) {
        const s = signals[b] / 100;
        env[b] += (s - env[b]) * (s > env[b] ? 0.25 : 0.025);
      }
      const r = params.response;
      const bass = Math.max(env[0], env[1]);
      const hats = (env[6] + env[7] + env[8]) / 3;
      const energy = (env[0] + env[1] + env[3] + env[4] + env[6] + env[7]) / 6;
      // The river follows the bass over about a second, so it surges and
      // slows but never lurches on a single kick.
      this.river += (bass - this.river) * 0.022;

      const W = this.bufW, H = this.bufH;
      const kb = this.visW / ctx.width;                       // buffer px per virtual unit
      const feature = 330 * params.scale;             // eddy size in virtual units

      // The current: speed in buffer px/frame, heading wandering slowly.
      // Straight downstream, left to right: the ink buffer slides with the
      // river, and a sideways component would need a pad on two more edges.
      const uSpeed = kb * params.flow * (0.42 + 1.25 * this.river * r);
      this.ux = uSpeed;
      this.uy = 0;

      // Onsets. A trigger needs the band to jump well clear of a floor that
      // creeps up behind it, so one kick fires once however its envelope
      // is shaped, and a sustained pad never fires.
      const k0 = signals[0] / 100;   // band 0 only: the bass line bleeds into 1
      const s0 = (signals[3] + signals[4] + signals[5]) / 300;
      this.sinceKick++; this.sinceSnare++;
      const dyeAmt = clamp01(params.dye * Math.min(1.25, r));
      if (k0 - this.kLow > 0.3 && k0 > 0.45 && this.sinceKick > 16) {
        if (dyeAmt > 0.01 && this.warmup === 0) this.dropDye(W, H, dyeAmt);
        this.sinceKick = 0; this.kLow = k0;
      } else this.kLow = Math.min(k0, this.kLow + 0.015);
      if (s0 - this.sLow > 0.22 && s0 > 0.3 && this.sinceSnare > 12) {
        if (dyeAmt > 0.01 && this.warmup === 0) this.whirl(W, H, dyeAmt, kb);
        this.sinceSnare = 0; this.sLow = s0;
      } else this.sLow = Math.min(s0, this.sLow + 0.012);

      // Field time: slow always, a little faster under the bass (V1 ran it
      // 3x faster; the drop's energy now goes into the river instead).
      this.fieldT += 0.0022 + 0.0035 * bass * r + 0.0018 * hats * r;
      this.drift += 0.0003;
      this.buildField(params, bass, feature, kb, r);

      // Swirl speed in buffer px/frame; hats lift it a little.
      const speed = 1.35 * kb * params.speed * (1 + 0.5 * hats * r);
      // Trails: memory in frames. The breakdown still lengthens them, but
      // the drop no longer shortens them into wire.
      const memory = 20 + 160 * params.trail * (1.12 - 0.22 * clamp01(energy * r * 1.5));
      const fade = 1 - 1 / memory;

      // Ink per pixel of travel through the water (V1's normalisation), so
      // the mean tone holds at any trail length and river speed. A slight
      // lift with the river keeps the drop a touch richer.
      const meanStep = 1.35 * kb * params.speed;
      const ink = 0.38 * (1 + 0.12 * this.river * r) * (W * H) /
        (this.n * meanStep * (20 + 160 * params.trail));
      // Dye stays on a particle for about a second and a half.
      const dyeFade = 0.99;
      const dyeBoost = 2.6;

      // On entry the swarm runs ahead against the current field so the
      // rivers already exist (V1).
      if (this.warmup > 0) {
        for (let n = 0; n < this.warmup; n++) {
          this.advect(W, H, speed, ink, dyeFade, dyeBoost, 0);
          const d = this.density;
          for (let q = 0, N = W * H; q < N; q++) d[q] *= fade;
        }
        this.warmup = 0;
      }
      // About thirty times a particle's ordinary ink per frame: enough for a
      // few hundred struck particles to raise a bright bloom.
      const flashInk = 30 * ink * meanStep;
      this.advect(W, H, speed, ink, dyeFade, dyeBoost, flashInk);
      for (const v of this.vortices) v.age++;
      this.vortices = this.vortices.filter((v) => v.age < 90);
      this.shiftInk(feature * kb);

      // Tone-map the visible part and fade everything in one pass.
      const lut = this.lut, pix = this.pix, density = this.density;
      const A = this.dyeBufA, B = this.dyeBufB;
      const lscale = (DL - 1) / LUT_MAX;
      const top = DL - 1;
      const fmax = FL - 1;
      const Wv = this.visW, P = this.pad, rowDye = this.rowDye, lut0 = this.lut0;
      for (let y = 0; y < H; y++) {
        const row = y * W;
        let o = y * Wv;
        if (!rowDye[y]) {
          for (let q = row; q < row + P; q++) density[q] *= fade;
          for (let q = row + P, e = row + W; q < e; q++, o++) {
            const d = density[q];
            let li = (d * lscale) | 0;
            if (li > top) li = top;
            pix[o] = lut0[li];
            density[q] = d * fade;
          }
          continue;
        }
        let any = 0;
        for (let q = row; q < row + P; q++) {
          density[q] *= fade;
          const a = A[q], b = B[q];
          if (a + b > DYE_FLOOR) { A[q] = a * fade; B[q] = b * fade; any = 1; } else if (a + b > 0) { A[q] = 0; B[q] = 0; }
        }
        for (let q = row + P, e = row + W; q < e; q++, o++) {
          const d = density[q];
          let li = (d * lscale) | 0;
          if (li > top) li = top;
          const a = A[q], b = B[q];
          let idx = li * FL * FL;
          if (a + b > DYE_FLOOR) {
            // sqrt: a strand of dye in a busy river should still read as
            // colour, not as a faint tint.
            const invd = 1 / (d + 1e-6);
            let ia = (Math.sqrt(a * invd) * fmax + 0.5) | 0;
            let ib = (Math.sqrt(b * invd) * fmax + 0.5) | 0;
            if (ia > fmax) ia = fmax;
            if (ib > fmax) ib = fmax;
            idx += ia * FL + ib;
            A[q] = a * fade; B[q] = b * fade;
            any = 1;
          } else if (a + b > 0) { A[q] = 0; B[q] = 0; }
          pix[o] = lut[idx];
          density[q] = d * fade;
        }
        rowDye[y] = any;
      }
      const g = p.drawingContext;
      if (this.visW === g.canvas.width && this.bufH === g.canvas.height) {
        // Full resolution: write straight into the canvas (V1).
        g.putImageData(this.image, 0, 0);
        return;
      }
      this.offCtx.putImageData(this.image, 0, 0);
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(this.off, 0, 0, ctx.width, ctx.height);
      g.restore();
    },
  });
})();
