// Current — tens of thousands of particles riding a slowly evolving noise
// field, drawn as ink-per-distance into a floating-point accumulation buffer
// that fades slowly. Tone comes only from how much ink lands where.
//
// The field is not pure curl noise. Pure curl noise is divergence-free, so an
// evenly spread swarm stays evenly spread and the picture settles into uniform
// grey silk. Mixing in a little of the potential's own gradient
// (v = curl ψ − c·∇ψ) makes every extremum of ψ a slow spiral drain or
// source: particles braid into bright rivers that wind into whirlpools, and
// voids open between them. Because ψ keeps evolving, the drains wander,
// merge and dissolve, so the structure keeps re-forming.
//
// Why a JS float buffer rather than low-alpha canvas strokes: 8-bit canvas
// alpha cannot represent a 1% deposit faded by 1% per frame (it rounds to
// nothing, or stalls as grey smears that never clear), and 30k stroke calls
// a frame blow the frame budget. A Float32 buffer holds tone exactly, fades
// exactly, and is tone-mapped through a lookup table once per frame.

(function () {
  // ------------------------------------------------------------ noise
  // Improved Perlin noise in 3D, permutation seeded from Math.random (which
  // the harness seeds, so renders are deterministic).
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
  // One hue each, in linear light. Tone ramps black → hue → a pale core, so
  // the densest rivers read as hot rather than clipping to a flat colour.
  const HUES = [
    { name: 'Tide', rgb: [0.03, 0.42, 0.62] },
    { name: 'Ember', rgb: [0.95, 0.30, 0.05] },
    { name: 'Iris', rgb: [0.30, 0.16, 0.95] },
    { name: 'Bone', rgb: [0.78, 0.74, 0.66] },
  ];
  const LUT_SIZE = 2048;
  const WARMUP_STEPS = 75;       // frames the swarm runs ahead on entry (see draw)
  const LUT_MAX = 6;          // density mapped across the table; beyond it is white-hot

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  VIZ.register({
    id: 'current',
    name: 'Current',
    order: 102,

    params: [
      { key: 'whirl', label: 'Whirlpools', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'turbulence', label: 'Turbulence', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'speed', label: 'Flow speed', type: 'range', min: 0.2, max: 3, default: 1, step: 0.01 },
      { key: 'trail', label: 'Trail length', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'scale', label: 'Eddy size', type: 'range', min: 0.4, max: 2.5, default: 1, step: 0.01 },
      { key: 'count', label: 'Particles', type: 'range', min: 4000, max: 48000, default: 30000, step: 1000 },
      { key: 'hue', label: 'Hue', type: 'select', options: HUES.map((h) => h.name), default: 0 },
      { key: 'response', label: 'Music response', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'Re-seed', run() { seedNoise(); this.needsClear = true; } },
      { id: 'clear', label: 'Clear', run() { this.needsClear = true; } },
    ],

    gallery: {
      title: 'Current',
      technique: 'Particles advected through curl-plus-gradient Perlin noise, deposited as ink-per-distance into a Float32 accumulation buffer, tone-mapped through a single-hue LUT',
      brief: 'Silk streamlines that braid into slow wandering whirlpools. The bass thickens the turbulence and tightens the drains; the hats quicken the flow; in the drop the field itself evolves faster, while the breakdown lets the strands lengthen and settle.',
      lineage: [
        'Brief 02: curl-noise flow field, single hue on near-black.',
        'Departed from pure curl noise: divergence-free flow keeps particles uniform and the image goes to even grey silk, so a fraction of the potential gradient is mixed in to make rivers and drains.',
        'Canvas low-alpha strokes swapped for a Float32 ink buffer tone-mapped through a LUT: 8-bit alpha cannot hold a 1% deposit fading at 1% a frame.',
        'First render was pale grey fog; steepened the tone curve and deepened the hue so voids go black and only braided rivers reach the pale core.',
        'Particles now roam a margin beyond the screen: respawning at the edge made a vignette, wrapping trapped particles on the seam as bright border lines.',
        'Wrote straight into the canvas with putImageData at full resolution (renderTime p95 12.8 to 4 ms); softened how hard the bass churns the field so the drop reads as surging, not nervous.',
        'Critic polish: ink buffer cap raised to 2.1 Mpx so 1080p stays native; on entry the swarm runs 75 frames ahead so whirlpools and voids already exist at 2 s.',
      ],
    },

    // Allocated lazily in draw, because sizes depend on the canvas.
    bufW: 0, bufH: 0, density: null, image: null, pix: null, off: null, offCtx: null,
    n: 0, px: null, py: null, age: null, life: null,
    grid: null, gridVX: null, gridVY: null, gw: 0, gh: 0, cell: 0, margin: 0,
    lut: null, lutHue: -1,
    env: new Float32Array(9),
    fieldT: 0, drift: 0, needsClear: true, warmup: 0,

    enter() {
      this.needsClear = true;
      // Start part-way along the field's time so it isn't the same opening
      // every entry; the warm-up in draw forms the rivers from there.
      this.fieldT = 0.03;
      this.drift = 0;
      this.env.fill(0);
    },

    allocate(p, ctx) {
      const dw = Math.round(p.width * p.pixelDensity());
      const dh = Math.round(p.height * p.pixelDensity());
      // Cap the buffer near 2.1 million pixels, so 1080p stays at native
      // resolution (a projector shows any upscale as softness); every pixel
      // is faded and tone-mapped each frame, so this bounds the cost.
      const k = Math.min(1, Math.sqrt(2.1e6 / (dw * dh)));
      const w = Math.max(16, Math.round(dw * k));
      const h = Math.max(16, Math.round(dh * k));
      if (w === this.bufW && h === this.bufH) return;
      this.bufW = w; this.bufH = h;
      this.density = new Float32Array(w * h);
      this.off = document.createElement('canvas');
      this.off.width = w; this.off.height = h;
      this.offCtx = this.off.getContext('2d');
      this.image = this.offCtx.createImageData(w, h);
      this.pix = new Uint32Array(this.image.data.buffer);
      // Field grid: velocity is sampled on a coarse lattice (about 8 buffer
      // px) and interpolated, because evaluating noise per particle per
      // substep costs ~10x the whole frame budget.
      this.cell = Math.max(4, Math.round(w / 160));
      // Particles live in a domain wider than the screen by a margin, and
      // only ink inside it. Respawning at the screen edge left a dark
      // vignette; wrapping trapped particles on the seam (the field doesn't
      // tile) and drew bright lines down the borders.
      this.margin = this.cell * 4;
      // Plus padding for the central differences and the bilinear neighbour:
      // an unfilled border reads as zero velocity and particles pile up there.
      this.gw = Math.ceil((w + 2 * this.margin) / this.cell) + 4;
      this.gh = Math.ceil((h + 2 * this.margin) / this.cell) + 4;
      this.grid = new Float32Array(this.gw * this.gh);
      this.gridVX = new Float32Array(this.gw * this.gh);
      this.gridVY = new Float32Array(this.gw * this.gh);
      this.needsClear = true;
    },

    buildLut(hueIndex) {
      const c = HUES[hueIndex] || HUES[0];
      // Packed RGBA, little-endian (ABGR in the Uint32).
      const lut = new Uint32Array(LUT_SIZE);
      for (let i = 0; i < LUT_SIZE; i++) {
        const d = (i / (LUT_SIZE - 1)) * LUT_MAX;
        const t = 1 - Math.exp(-d);                 // soft shoulder: never clips
        const body = Math.pow(t, 2.1) * 1.35;       // the hue carries the midtones
        const core = Math.pow(t, 6) * 0.8;         // only dense rivers go pale
        const out = [0, 0, 0];
        for (let ch = 0; ch < 3; ch++) {
          const floor = c.rgb[ch] * 0.006;          // near-black, tinted
          const lin = floor + c.rgb[ch] * body + core;
          out[ch] = Math.round(255 * Math.pow(clamp01(lin), 1 / 2.2));
        }
        lut[i] = (255 << 24) | (out[2] << 16) | (out[1] << 8) | out[0];
      }
      this.lut = lut;
      this.lutHue = hueIndex;
    },

    respawn(i) {
      const m = this.margin;
      this.px[i] = -m + Math.random() * (this.bufW + 2 * m);
      this.py[i] = -m + Math.random() * (this.bufH + 2 * m);
      this.age[i] = 0;
      this.life[i] = 90 + Math.random() * 240;
    },

    ensureParticles(count) {
      if (this.px && this.px.length >= count) { this.n = count; return; }
      const old = this.px ? this.px.length : 0;
      const grow = (a) => { const b = new Float32Array(count); if (a) b.set(a); return b; };
      this.px = grow(this.px); this.py = grow(this.py);
      this.age = grow(this.age); this.life = grow(this.life);
      for (let i = old; i < count; i++) {
        this.respawn(i);
        // Stagger ages so a fresh swarm doesn't all die on the same frame.
        this.age[i] = Math.random() * this.life[i];
      }
      this.n = count;
    },

    // ψ on the lattice, then v = curl ψ − c·∇ψ by central differences.
    buildField(params, bass, feature, kb) {
      const { gw, gh, cell, grid, gridVX, gridVY, margin } = this;
      const t = this.fieldT;
      const inv = 1 / (feature * kb);                 // buffer px → noise units
      const turb = clamp01(params.turbulence + bass * 0.45 * params.response);
      const a2 = 0.5 * turb, a3 = 0.28 * turb;
      const dx = this.drift;
      for (let j = 0; j < gh; j++) {
        const y = ((j - 1) * cell - margin) * inv;
        for (let i = 0; i < gw; i++) {
          const x = ((i - 1) * cell - margin) * inv + dx;
          let v = noise3(x, y, t);
          if (a2 > 0.001) v += a2 * noise3(x * 2.13 + 5.2, y * 2.13 - 1.3, t * 1.7);
          if (a3 > 0.001) v += a3 * noise3(x * 4.37 - 7.1, y * 4.37 + 3.3, t * 2.9);
          grid[j * gw + i] = v;
        }
      }
      // The drains tighten with the bass: the music bends the field's shape,
      // not just its speed.
      const c = params.whirl * (1 + bass * 0.6 * params.response);
      // Derivatives are per noise unit, so velocities are resolution-free;
      // the caller scales them to buffer pixels.
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

    // Move every particle one frame along the field, inking its path.
    advect(W, H, speed, ink) {
      const { gw, cell, margin, gridVX, gridVY, density, px, py, age, life } = this;
      const xMax = W + margin, yMax = H + margin;
      const invCell = 1 / cell;
      for (let i = 0; i < this.n; i++) {
        let x = px[i], y = py[i];
        const a = age[i] + 1;
        age[i] = a;
        if (a >= life[i]) { this.respawn(i); continue; }
        // Tapered strand: ink swells in and out over the particle's life, so
        // births and deaths never show as dots.
        const env01 = Math.sin(Math.PI * a / life[i]);
        const w = ink * env01;

        // One sample decides the substep count; ≤0.8 px per substep keeps the
        // deposited line continuous.
        let left = speed;
        for (let s = 0; s < 6 && left > 0; s++) {
          const gxp = (x + margin) * invCell + 1, gyp = (y + margin) * invCell + 1;
          const ix = gxp | 0, iy = gyp | 0;
          const fx = gxp - ix, fy = gyp - iy;
          const k = iy * gw + ix;
          const vx = (gridVX[k] * (1 - fx) + gridVX[k + 1] * fx) * (1 - fy)
                   + (gridVX[k + gw] * (1 - fx) + gridVX[k + gw + 1] * fx) * fy;
          const vy = (gridVY[k] * (1 - fx) + gridVY[k + 1] * fx) * (1 - fy)
                   + (gridVY[k + gw] * (1 - fx) + gridVY[k + gw + 1] * fx) * fy;
          const m = Math.sqrt(vx * vx + vy * vy);
          if (m < 1e-6) break;
          const stepLen = Math.min(0.8, left);
          // Speed scales with the local field strength, capped, so eddy
          // cores slow down and drain rather than whip round.
          const local = Math.min(1.6, m * 0.9);
          const d = stepLen * local;
          x += (vx / m) * d;
          y += (vy / m) * d;
          left -= stepLen;
          if (x < -margin || y < -margin || x >= xMax || y >= yMax) { x = NaN; break; }
          if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) continue;   // off-screen: travel, no ink
          // Bilinear splat of ink proportional to distance travelled.
          const xi = x | 0, yi = y | 0;
          const ax = x - xi, ay = y - yi;
          const q = yi * W + xi;
          const dep = w * d;
          density[q] += dep * (1 - ax) * (1 - ay);
          density[q + 1] += dep * ax * (1 - ay);
          density[q + W] += dep * (1 - ax) * ay;
          density[q + W + 1] += dep * ax * ay;
        }
        if (x !== x) { this.respawn(i); continue; }   // NaN: left the domain
        px[i] = x; py[i] = y;
      }
    },

    draw(p, signals, params, ctx) {
      this.allocate(p, ctx);
      const count = Math.round(params.count);
      this.ensureParticles(count);
      const hueIndex = Math.round(params.hue);
      if (hueIndex !== this.lutHue) this.buildLut(hueIndex);
      if (this.needsClear) {
        this.density.fill(0);
        for (let i = 0; i < this.n; i++) { this.respawn(i); this.age[i] = Math.random() * this.life[i]; }
        this.needsClear = false;
        this.warmup = WARMUP_STEPS;
      }

      // Envelope-follow the bands: fast attack, slow release, so a kick
      // leans on the field for a moment instead of snapping it frame to frame.
      const env = this.env;
      for (let b = 0; b < 9; b++) {
        const s = signals[b] / 100;
        env[b] += (s - env[b]) * (s > env[b] ? 0.25 : 0.025);
      }
      const r = params.response;
      const bass = Math.max(env[0], env[1]);
      const hats = (env[6] + env[7] + env[8]) / 3;
      const energy = (env[0] + env[1] + env[3] + env[4] + env[6] + env[7]) / 6;

      // Time: the field evolves slowly always, several times faster under
      // the bass, so the drop churns while the breakdown drifts.
      this.fieldT += 0.0022 + 0.0065 * bass * r + 0.0025 * hats * r;
      this.drift += 0.0006;

      const W = this.bufW, H = this.bufH;
      const kb = W / ctx.width;                       // buffer px per virtual unit
      const feature = 330 * params.scale;             // eddy size in virtual units
      this.buildField(params, bass, feature, kb);

      // Base speed in buffer px/frame; hats lift it.
      const speed = 1.35 * kb * params.speed * (1 + 0.9 * hats * r);
      // Trails: memory in frames. Quiet passages linger longer so the
      // breakdown settles into long laminar strands; the drop refreshes faster.
      const memory = 20 + 160 * params.trail * (1.25 - 0.5 * clamp01(energy * r * 1.5));
      const fade = 1 - 1 / memory;

      // Ink per pixel of travel, normalised so the mean tone is about the
      // same at any particle count or trail length — those controls change
      // the texture, not the exposure.
      const meanStep = 1.35 * kb * params.speed;
      const ink = 0.38 * (W * H) / (this.n * meanStep * (20 + 160 * params.trail));

      // A fresh start is uniform silk until particles have had time to
      // gather into rivers, so on entry the swarm runs ahead for a second or
      // so against the current field, off-screen, in one go. It costs one
      // long frame at the moment of switching, where a hitch is invisible.
      if (this.warmup > 0) {
        const warmFade = 1 - 1 / memory;
        for (let n = 0; n < this.warmup; n++) {
          this.advect(W, H, speed, ink);
          const d = this.density;
          for (let q = 0, N = W * H; q < N; q++) d[q] *= warmFade;
        }
        this.warmup = 0;
      }
      this.advect(W, H, speed, ink);

      // Tone-map and fade in one pass.
      const lut = this.lut, pix = this.pix, density = this.density;
      const lscale = (LUT_SIZE - 1) / LUT_MAX;
      const top = LUT_SIZE - 1;
      for (let q = 0, N = W * H; q < N; q++) {
        const d = density[q];
        let li = (d * lscale) | 0;
        if (li > top) li = top;
        pix[q] = lut[li];
        density[q] = d * fade;
      }
      const g = p.drawingContext;
      if (this.bufW === g.canvas.width && this.bufH === g.canvas.height) {
        // Full resolution: write straight into the canvas. putImageData
        // ignores transform and compositing, which is what we want here, and
        // saves an upload plus a scaled draw (a third of the frame at 720p).
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
