// Attractor — a strange attractor photographed on a long exposure.
//
// A few hundred thousand points a frame are iterated through a Clifford (or
// de Jong) map and splatted into a float accumulation buffer, which decays
// like a slow shutter. The coefficients wander on slow sine walks and the
// bands bend them, so the form morphs continuously and leaves its own past
// behind as a cooling afterglow.
//
// Colour is not decoration: two buffers are kept, a slow one (the exposure)
// and a fast one (the last fraction of a second). Their ratio says whether
// light at a pixel is new, steady or dying, and that picks the colour. A still
// form is one warm tone; a moving form burns white at its leading edges and
// leaves cool trails, so the drop (which drives the morph harder) reads
// differently from the breakdown without anything being keyed to the beat.
//
// Everything is CPU: a sine lookup table keeps the map cheap, and a 2D
// colour lookup table keeps the per-pixel tone map to a few array reads.

(function () {
  const TAU = Math.PI * 2;

  // Sine table with linear interpolation. Interpolation is not optional: a
  // nearest-entry table quantises the map, and a quantised chaotic map falls
  // into short cycles within a few thousand steps (measured: 5k distinct cells
  // instead of 25k), which renders as sparse dots instead of filaments.
  const SIN_N = 4096;
  const SIN_MASK = SIN_N - 1;
  const SIN_SCALE = SIN_N / TAU;
  const SIN = new Float32Array(SIN_N + 1);
  for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin(i / SIN_SCALE);
  // Argument is pre-multiplied by SIN_SCALE (one table unit per step).
  function lsin(f) {
    const fl = Math.floor(f);
    const i = fl & SIN_MASK;
    return SIN[i] + (SIN[i + 1] - SIN[i]) * (f - fl);
  }
  const QUARTER = SIN_N / 4;   // cos(t) = sin(t + pi/2)

  // Base coefficients known to be richly chaotic. The walk stays near one of
  // these; "New form" eases to another.
  // Chosen by an offline scan: each is filament-rich (not a diffuse cloud,
  // which renders as grain) and >85% of random neighbours within the wander
  // amplitude stay chaotic. The same scan showed that straight paths *between*
  // presets are mostly non-chaotic (20-38 of 41 samples collapse), which is
  // why a new form arrives by crossfade, never by interpolating coefficients.
  const PRESETS = [
    // Clifford: x' = sin(a y) + c cos(a x);  y' = sin(b x) + d cos(b y)
    [[-1.4, 1.6, 1.0, 0.7], [1.7, 1.7, 0.06, 1.2], [-1.7, 1.8, -1.9, -0.4]],
    // de Jong: x' = sin(a y) - cos(b x);  y' = sin(c x) - cos(d y)
    [[1.4, -2.3, 2.4, -2.1], [2.01, -2.53, 1.61, -0.33], [-2.7, -0.09, -0.86, -2.2],
     [-2.0, -2.0, -1.2, 2.0], [0.97, -1.899, 1.381, -1.506], [-0.827, -1.637, 1.659, -0.943]],
  ];
  // Wander amplitude per coefficient (small: these maps are sensitive).
  const AMP = [[0.16, 0.16, 0.22, 0.22], [0.12, 0.12, 0.14, 0.14]];

  // Three stops per palette: dying light, steady light, fresh light.
  const PALETTES = [
    { name: 'Ember & ice', stops: [[38, 96, 150], [236, 184, 120], [255, 246, 228]], ground: [3, 4, 7] },
    { name: 'Silver gelatin', stops: [[70, 76, 88], [196, 194, 188], [255, 255, 252]], ground: [4, 4, 4] },
    { name: 'Sodium', stops: [[92, 46, 128], [255, 138, 44], [255, 232, 188]], ground: [5, 3, 8] },
  ];

  const WALKERS = 1024;
  const BURN_IN = 24;
  const TONE_N = 1024;   // brightness levels in the colour LUT
  const FRESH_N = 32;    // freshness levels in the colour LUT
  const FAST_DECAY = 0.86;
  const LIT_T = 160;         // tone level that counts as "lit" for coverage
  const LIT_FRAC = 0.25;     // lit fraction above which the shutter stretches
  const RES = 0.75;          // accumulation buffer size relative to the canvas
  const JOURNEY_S = 45;      // seconds (at morph 1) between crossfades to a new form
  const FADE_S = 7;          // crossfade length

  VIZ.register({
    id: 'attractor',
    name: 'Attractor',
    order: 104,
    gallery: {
      title: 'Attractor',
      technique: 'Clifford / de Jong maps, ~195k points a frame splatted bilinearly into a decaying Float32 exposure (0.75x resolution) plus half-resolution slow/fast light-age buffers, log tone-mapped through a 2D colour LUT into ImageData, with a 1/8-resolution blurred halo; crossfades between vetted forms, guarded by a running Lyapunov estimate',
      brief: 'A strange attractor as a long-exposure photograph: filaments that glow where the orbit lingers. Coefficients wander so the form morphs without ever jumping; the bass sweeps it continuously (the drop is the most mobile section), mids and hats lean on it and heat the light. Colour comes from the age of the light, so motion paints white leading edges and cool afterglow.',
      lineage: [
        'Brief 04: density-rendered Clifford/de Jong attractor in a decaying float buffer; took the CPU route (sine table, Float32 buffers, ImageData).',
        'Render 1 was sparse dots: a nearest-entry sine table quantised the map into short cycles. Interpolating the table restored filaments.',
        'Colour from light age (fast/slow buffer ratio) instead of a hue ramp, so motion itself is what gets coloured: white leading edges, cool afterglow.',
        'Composition: fit the eased bounding box with mild anisotropy, and turn the camera a slow quarter turn when a tall form sits in a wide stage.',
        'Longevity test (96 s) showed collapse and grain after the form journeyed: coefficient paths between presets are mostly non-chaotic, so new forms now crossfade in as a double exposure, and a Lyapunov-exponent guard hurries or replaces a collapsing orbit.',
        'Freshness moved to half resolution after its Poisson noise read as white sand on spread-out forms; willReadFrequently canvases cut p95 render time from ~17 ms to ~11 ms.',
        'Critic round 1: grain after 70 s was not diffuse forms but walker collapse: a brief periodic window merged all 1024 walkers onto one trajectory (3 distinct by 80 s). A sub-pixel nudge per frame keeps them apart; coverage-based shutter stretch added as a second line of defence.',
        'Critic round 1: the drop froze because a held bass envelope became a constant offset. Bass now integrates into a sweep phase (and feeds the walk clock); the sweep looks ahead with a Lyapunov probe and turns round before a window, and a collapsed orbit is dimmed and kept out of auto-exposure.',
      ],
    },

    params: [
      { key: 'exposure', label: 'Exposure', type: 'range', min: 0.3, max: 3, default: 1.1, step: 0.01 },
      { key: 'shutter', label: 'Shutter (s)', type: 'range', min: 0.2, max: 8, default: 1.6, step: 0.05 },
      { key: 'morph', label: 'Morph speed', type: 'range', min: 0, max: 4, default: 1, step: 0.01 },
      { key: 'push', label: 'Music bends form', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'family', label: 'Family', type: 'select', options: ['Clifford', 'de Jong'], default: 0 },
      { key: 'palette', label: 'Film', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
    ],

    actions: [
      { id: 'newform', label: 'New form', run() { this.pickForm(); } },
    ],

    // ------------------------------------------------------------ state

    setup(p, ctx) {
      this.reset();
    },

    enter(p, ctx) {
      this.reset();
    },

    reset() {
      this.W = 0; this.H = 0;           // buffer size; allocated lazily in draw
      this.family = -1;
      this.forms = [];                  // one form, or two during a crossfade
      this.phase = Math.random() * 100;
      this.walkPhases = [];
      for (let i = 0; i < 8; i++) this.walkPhases.push(Math.random() * TAU);
      this.walkFreqs = [0.19, 0.23, 0.29, 0.17, 0.13, 0.11, 0.21, 0.15];
      this.env = { bass: 0, mid: 0, high: 0, energy: 0 };
      this.bassPhase = 0;
      this.bassDir = 1;
      this.turnCooldown = 0;
      this.exposureStretch = 1;
      this.journey = 0;
      this.view = null;
      this.angle = 0;          // view rotation, eased towards angleTarget
      this.angleTarget = 0;
      this.level = 0;
      this.frames = 0;
      this.paletteBuilt = -1;
    },

    // A form is one attractor: its family, base coefficients, its own walkers
    // and its crossfade weight.
    makeForm(fam, avoid) {
      const list = PRESETS[fam];
      let k = Math.floor(Math.random() * list.length);
      if (k === avoid) k = (k + 1) % list.length;
      const f = {
        fam, preset: k, base: list[k].slice(), fade: 0, weight: 0, guard: 0,
        wx: new Float32Array(WALKERS), wy: new Float32Array(WALKERS), burn: new Uint8Array(WALKERS),
      };
      for (let i = 0; i < WALKERS; i++) respawn(f, i);
      return f;
    },

    // Crossfade to a new form. Only one crossfade at a time: a second press
    // during a fade retargets the incoming form instead of stacking a third.
    pickForm(fam) {
      if (fam === undefined) fam = this.family < 0 ? 0 : this.family;
      const cur = this.forms[0];
      const next = this.makeForm(fam, cur && cur.fam === fam ? cur.preset : -1);
      if (this.forms.length > 1) this.forms[1] = next; else this.forms.push(next);
      this.journey = 0;
    },

    allocate(W, H) {
      this.W = W; this.H = H;
      // The exposure, at buffer resolution.
      this.acc = new Float32Array(W * H);
      // Light age is measured at half resolution: a slow and a fast
      // accumulator, interleaved. At full resolution the fast one (a few
      // frames of light) held so few hits per pixel that its Poisson noise
      // showed as white sand across the spread-out forms; 2x2 cells hold four
      // times the hits, and colour needs no finer detail than that.
      this.Wl = Math.ceil(W / 2); this.Hl = Math.ceil(H / 2);
      this.lo = new Float32Array(this.Wl * this.Hl * 2);
      this.frIdx = new Uint8Array(this.Wl * this.Hl);
      this.canvas = document.createElement('canvas');
      this.canvas.width = W; this.canvas.height = H;
      // willReadFrequently keeps these canvases in CPU memory. Measured: it
      // takes p95 render time from ~17 ms to ~10 ms, because putImageData on a
      // GPU-backed canvas forces a synchronous upload every frame.
      this.c2d = this.canvas.getContext('2d', { willReadFrequently: true });
      this.img = this.c2d.createImageData(W, H);
      this.px = new Uint32Array(this.img.data.buffer);
      // Halo: points are also splatted into a 1/8-size buffer, blurred and
      // upscaled additively — a lens glow without a full-size blur, and
      // without downsampling the frame (which aliases into sparkle).
      const hw = Math.max(4, Math.round(W / 8)), hh = Math.max(4, Math.round(H / 8));
      this.hw = hw; this.hh = hh;
      this.hacc = new Float32Array(hw * hh);
      this.hblur = new Float32Array(hw * hh);
      this.halo = document.createElement('canvas');
      this.halo.width = hw; this.halo.height = hh;
      this.haloCtx = this.halo.getContext('2d', { willReadFrequently: true });
      this.haloImg = this.haloCtx.createImageData(hw, hh);
      this.haloPx = new Uint32Array(this.haloImg.data.buffer);
      // Static dither (not per frame, so it cannot shimmer) to break the 8-bit
      // banding in the faint haze.
      this.dither = new Int8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // Interleaved gradient noise: well-spread, cheap, deterministic.
          const v = (52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1)) % 1;
          this.dither[y * W + x] = Math.round((v - 0.5) * 6);
        }
      }
      this.view = null;
    },

    buildPalette(idx) {
      const pal = PALETTES[idx];
      this.lut = new Uint32Array(TONE_N * FRESH_N);
      const [old, mid, hot] = pal.stops;
      const g = pal.ground;
      for (let f = 0; f < FRESH_N; f++) {
        // f: 0 = dying light, FRESH_N/2 ≈ steady, top = brand new light.
        const u = f / (FRESH_N - 1);
        const col = [0, 0, 0];
        for (let c = 0; c < 3; c++) {
          col[c] = u < 0.5 ? old[c] + (mid[c] - old[c]) * smooth(u / 0.5)
                           : mid[c] + (hot[c] - mid[c]) * smooth((u - 0.5) / 0.5);
        }
        for (let t = 0; t < TONE_N; t++) {
          const q = t / (TONE_N - 1);
          // Filmic shoulder: highlights desaturate towards white like
          // overexposed emulsion instead of clipping to a flat hue.
          const white = Math.pow(q, 3) * 0.55;
          const rgb = [0, 0, 0];
          for (let c = 0; c < 3; c++) {
            let v = g[c] + col[c] * q * (1 - white) + 255 * white;
            rgb[c] = Math.max(0, Math.min(255, Math.round(v)));
          }
          this.lut[f * TONE_N + t] = (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
        }
      }
      this.paletteBuilt = idx;
    },

    // Blur the 1/8 buffer (two separable [1 2 1] passes each way) and tone
    // it in the palette's steady colour at low intensity.
    drawHalo(decay, gain) {
      const a = this.hacc, b = this.hblur, w = this.hw, h = this.hh;
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < h; y++) {
          const r = y * w;
          for (let x = 0; x < w; x++) {
            const l = a[r + (x > 0 ? x - 1 : 0)], c = a[r + x], rr = a[r + (x < w - 1 ? x + 1 : x)];
            b[r + x] = (l + 2 * c + rr) * 0.25;
          }
        }
        for (let y = 0; y < h; y++) {
          const u = (y > 0 ? y - 1 : 0) * w, d = (y < h - 1 ? y + 1 : y) * w, r = y * w;
          for (let x = 0; x < w; x++) a[r + x] = (b[u + x] + 2 * b[r + x] + b[d + x]) * 0.25;
        }
      }
      const st = PALETTES[this.paletteBuilt].stops[1];
      const px = this.haloPx;
      // One halo cell collects ~(8/RES)^2 exposure pixels' worth of points.
      const g = gain * RES * RES / 64;
      for (let i = 0; i < w * h; i++) {
        const v = a[i];
        a[i] = v * decay;
        const t = Math.min(1, Math.log(1 + v * g) * 0.12);
        px[i] = (255 << 24) | (((st[2] * t) | 0) << 16) | (((st[1] * t) | 0) << 8) | ((st[0] * t) | 0);
      }
      this.haloCtx.putImageData(this.haloImg, 0, 0);
    },

    // ------------------------------------------------------------ frame

    draw(p, signals, params, ctx) {
      const pd = p.pixelDensity();
      // The exposure is accumulated below device resolution: it cuts the
      // per-pixel passes (tone map, upload) by ~45%, and the bilinear upscale
      // reads as the softness of a real long exposure rather than as blur.
      const W = Math.round(p.width * pd * RES), H = Math.round(p.height * pd * RES);
      if (W !== this.W || H !== this.H) this.allocate(W, H);
      const palIdx = Math.min(PALETTES.length - 1, params.palette | 0);
      if (palIdx !== this.paletteBuilt) this.buildPalette(palIdx);
      this.frames++;

      // --- audio envelopes: fast-ish attack, slow release, so a kick is a
      // swell in the form, never a jump.
      const e = this.env;
      const dt = 1 / 60;
      const bass = (signals[0] + signals[1]) / 200;
      const mid = (signals[2] + signals[3] + signals[4]) / 300;
      const high = (signals[6] + signals[7] + signals[8]) / 300;
      const follow = (cur, target, up, down) => cur + (target - cur) * (target > cur ? up : down);
      e.bass = follow(e.bass, bass, 0.12, 0.07);
      // The bass is integrated into a phase rather than used as an offset.
      // As an offset, four-on-the-floor held it high and constant, parking the
      // form for the whole drop (critic: the drop was the most frozen
      // section). Integrated, the drop sweeps the form continuously and the
      // breakdown lets the sweep coast to a stop.
      this.bassPhase += dt * params.push * e.bass * 1.5 * this.bassDir;
      e.mid = follow(e.mid, mid, 0.05, 0.02);
      e.high = follow(e.high, high, 0.08, 0.03);
      let total = 0;
      for (let i = 0; i < 9; i++) total += signals[i];
      e.energy = follow(e.energy, total / 900, 0.02, 0.01);

      // --- forms: start with one, crossfade on family change, New form, or
      // the slow journey timer, so minute five is a different animal.
      const fam = params.family | 0;
      if (this.forms.length === 0) {
        const f0 = this.makeForm(fam, -1);
        f0.fade = 1;
        this.forms.push(f0);
        this.family = fam;
      } else if (fam !== this.family) {
        this.family = fam;
        this.pickForm(fam);
      }
      this.journey += dt * params.morph;
      if (this.journey > JOURNEY_S && this.forms.length === 1) this.pickForm(this.family);
      if (this.forms.length > 1) {
        const inc = this.forms[1];
        inc.fade = Math.min(1, inc.fade + dt / FADE_S);
        if (inc.fade >= 1) this.forms.shift();
      }
      if (this.forms.length > 1) {
        const w = smooth(this.forms[1].fade);
        this.forms[0].weight = 1 - w; this.forms[1].weight = w;
      } else {
        this.forms[0].weight = 1;
      }

      // --- coefficient walk. Its clock runs faster with the music's energy,
      // and the bass drives it too, so the drop is the most mobile section.
      const walkRate = params.morph * (0.25 + 2.2 * e.energy + 1.2 * e.bass);
      this.phase += dt * walkRate;
      const wp = this.walkPhases, wf = this.walkFreqs, ph = this.phase;
      const push = params.push;
      // Bass sweeps c and d round a Lissajous loop; mids and hats lean on the
      // other pair.
      const bp = this.bassPhase;
      const sweepC = push * 0.22 * Math.sin(bp), sweepD = push * 0.16 * (Math.sin(bp * 0.71 + 1.3) - Math.sin(1.3));
      for (const f of this.forms) {
        const amp = AMP[f.fam];
        // A form in a periodic window (the chaos guard is up) runs its own
        // walk faster, so it hurries through instead of sitting as dots.
        f.extra = (f.extra || 0) + dt * walkRate * 6 * f.guard;
        const q = ph + f.extra;
        const co = f.co || (f.co = [0, 0, 0, 0]);
        for (let i = 0; i < 4; i++) {
          co[i] = f.base[i] + amp[i] * (0.65 * Math.sin(q * wf[i] + wp[i]) + 0.35 * Math.sin(q * wf[i + 4] * 1.7 + wp[i + 4]));
        }
        co[2] += sweepC;
        co[3] += sweepD;
        co[0] += push * 0.07 * e.mid;
        co[1] -= push * 0.06 * e.high;
      }
      // Look ahead along the bass sweep (~half a second at drop speed): if the
      // coefficients there are not chaotic, turn the sweep round before the
      // form gets there. Reacting only on entry still let a window blank the
      // middle of the drop (render of 14 s).
      this.turnCooldown = Math.max(0, this.turnCooldown - dt);
      const lead = this.forms[this.forms.length - 1];
      if (e.bass > 0.05 && this.turnCooldown === 0 && push > 0) {
        const bpA = bp + 0.4 * this.bassDir;
        const ahead = lead.co.slice();
        ahead[2] += push * 0.22 * Math.sin(bpA) - sweepC;
        ahead[3] += push * 0.16 * (Math.sin(bpA * 0.71 + 1.3) - Math.sin(1.3)) - sweepD;
        const dj = lead.fam === 1;
        const lam = lyapunov(lead, ahead[0] * SIN_SCALE, ahead[1] * SIN_SCALE,
          dj ? ahead[2] * SIN_SCALE : ahead[2], dj ? ahead[3] * SIN_SCALE : ahead[3], dj, 80);
        if (lam < 0.05) { this.bassDir = -this.bassDir; this.turnCooldown = 1; }
      }

      // --- view: fit the (eased) bounding box of last frame's points.
      if (!this.view) this.view = { x0: -2.2, x1: 2.2, y0: -2.2, y1: 2.2, fresh: true };
      const v = this.view;
      const bw = v.x1 - v.x0, bh = v.y1 - v.y0;
      let sx = W * 0.88 / bw, sy = H * 0.86 / bh;
      // Allow a little anisotropy so a squarish form fills a 16:9 stage, but
      // not so much that it reads as stretched.
      const s = Math.min(sx, sy);
      sx = Math.min(sx, s * 1.3); sy = Math.min(sy, s * 1.3);
      // Orientation: forms are often tall; turn the camera a quarter turn,
      // slowly, when that fills the stage clearly better. The old exposure
      // stays where it was and fades, like a pan during a long exposure.
      if (Math.abs(this.angle - this.angleTarget) < 0.01) {
        const fill = (a, b) => { const k = Math.min(W / a, H / b); return a * b * k * k; };
        if (fill(bh, bw) > fill(bw, bh) * 1.3) this.angleTarget += Math.PI / 2;
      }
      this.angle += (this.angleTarget - this.angle) * 0.015;
      const cr = Math.cos(this.angle), sr = Math.sin(this.angle);
      const ox = W / 2 - (v.x0 + v.x1) / 2 * sx;
      const oy = H / 2 - (v.y0 + v.y1) / 2 * sy;

      // --- iterate and splat. Points are shared between forms by weight, so
      // a crossfade is a double exposure: one form thins as the other fills.
      const fr = {
        acc: this.acc, lo: this.lo, Wl: this.Wl, hacc: this.hacc, hw: this.hw, W, H, sx, sy, ox, oy, cr, sr,
        wFast: 1 + 1.8 * e.high,   // hats heat the fresh light
        mnx: 1e9, mxx: -1e9, mny: 1e9, mxy: -1e9, lvlSum: 0, lvlN: 0,
      };
      const STEPS = 190;           // per walker per frame -> ~195k points
      for (const f of this.forms) {
        const steps = Math.round(STEPS * f.weight);
        if (steps < 1) continue;
        const lyap = splatForm(f, steps, fr);
        // Chaos guard: when the orbit stops being chaotic the walk hurries on,
        // and if it stays collapsed for ~3 s the piece crossfades to a fresh
        // form, so a periodic window never sits on screen as a few dots.
        f.lyap = f.lyap === undefined ? lyap : f.lyap + (lyap - f.lyap) * 0.1;
        // The raw estimate trips it too: windows open within a few frames,
        // and a guard that lags lets the collapsed orbit burn bright dots in.
        const collapsed = f.lyap < 0.04 || lyap < 0 ? 1 : 0;
        // The bass sweep is what usually carries the form into a window, so
        // on entering one the sweep reverses and backs straight out again:
        // the form rebounds off the window instead of dying in it.
        if (collapsed && !f.wasCollapsed && f === this.forms[this.forms.length - 1]) this.bassDir = -this.bassDir;
        f.wasCollapsed = collapsed;
        f.guard += (collapsed - f.guard) * (collapsed ? 0.25 : 0.02);
        // Leaky count of trouble, so a flickering in-and-out of windows
        // (intermittency) also ends in a fresh form, not only a solid stall.
        f.stuck = Math.max(0, (f.stuck || 0) + dt * (collapsed ? 1 : -0.25));
      }
      if (this.forms.length === 1 && this.forms[0].stuck > 3) this.pickForm(this.family);
      const { mnx, mxx, mny, mxy, lvlSum, lvlN } = fr;

      // Ease the view towards this frame's bounds (snap on the first frame).
      if (mxx > mnx && mxy > mny) {
        const padX = (mxx - mnx) * 0.02, padY = (mxy - mny) * 0.02;
        let tx0 = mnx - padX, tx1 = mxx + padX, ty0 = mny - padY, ty1 = mxy + padY;
        // Never zoom in on a collapsing orbit: the view may shrink only to
        // 60% of its size, and more slowly than it grows.
        const cx = (tx0 + tx1) / 2, cy = (ty0 + ty1) / 2;
        const hwid = Math.max((tx1 - tx0) / 2, 1.2), hhei = Math.max((ty1 - ty0) / 2, 1.2);
        const kView = v.fresh ? 1 : (hwid * hhei * 4 < (v.x1 - v.x0) * (v.y1 - v.y0) ? 0.008 : 0.02);
        tx0 = cx - hwid; tx1 = cx + hwid; ty0 = cy - hhei; ty1 = cy + hhei;
        v.x0 += (tx0 - v.x0) * kView; v.x1 += (tx1 - v.x1) * kView;
        v.y0 += (ty0 - v.y0) * kView; v.y1 += (ty1 - v.y1) * kView;
        v.fresh = false;
      }

      // Auto-exposure level, eased so it never flickers.
      if (lvlN > 0) {
        const lv = lvlSum / lvlN;
        // Rises at most 1.5% a frame: a sudden spike (a window's dense dots)
        // must not black out the frame in an instant.
        const eased = this.level + (lv - this.level) * 0.03;
        this.level = this.level === 0 ? lv : this.frames < 180 ? eased : Math.min(this.level * 1.015, eased);
      }

      // --- decay + tone map in one pass.
      // Coverage-based exposure: a form spread over much of the frame puts
      // fewer hits in each pixel, so its shutter is lengthened (up to 3x) to
      // keep it smooth; the level-based gain below then lowers itself.
      const slowDecay = Math.exp(-1 / (60 * params.shutter * this.exposureStretch));
      // Steady-state fast/slow ratio for unchanging light; freshness is
      // measured relative to it so "steady" lands mid-LUT at any shutter.
      const steady = (1 - slowDecay) / (1 - FAST_DECAY);
      const freshScale = (FRESH_N - 1) * 0.5 / steady;
      // Map density d to a log curve: q = log(1 + g d) / log(1 + g dRef).
      // Calibrated so the typical lit pixel sits mid-curve and the faint haze
      // (a twentieth of that) is still visible.
      const gain = params.exposure * 6 / Math.max(1e-3, this.level);
      const logNorm = 1 / Math.log(1 + 48);
      const toneScale = (TONE_N - 1);
      const prior = 0.4 / gain;
      const acc = this.acc, lut = this.lut, px = this.px, dither = this.dither;
      // Light age per 2x2 cell -> freshness row of the LUT (pre-multiplied).
      const lo = this.lo, frIdx = this.frIdx, nl = this.Wl * this.Hl;
      const priorLo = prior * 4;
      for (let i = 0, j = 0; i < nl; i++, j += 2) {
        const a = lo[j], f = lo[j + 1];
        lo[j] = a * slowDecay; lo[j + 1] = f * FAST_DECAY;
        let fr = ((f + steady * priorLo) / (a + priorLo) * freshScale) | 0;
        if (fr > FRESH_N - 1) fr = FRESH_N - 1;
        frIdx[i] = fr;
      }
      const ground = lut[0], Wl = this.Wl;
      let lit = 0;
      for (let y = 0, i = 0; y < H; y++) {
        const row = (y >> 1) * Wl;
        for (let x = 0; x < W; x++, i++) {
          const a = acc[i];
          if (a < 1e-4) {
            px[i] = ground;
            if (a !== 0) acc[i] = 0;
            continue;
          }
          acc[i] = a * slowDecay;
          let t = (Math.log(1 + a * gain) * logNorm * toneScale + dither[i]) | 0;
          if (t > TONE_N - 1) t = TONE_N - 1; else if (t < 0) t = 0;
          if (t > LIT_T) lit++;
          px[i] = lut[frIdx[row + (x >> 1)] * TONE_N + t];
        }
      }
      this.litFrac = lit / (W * H);
      const stretchTarget = Math.min(3, Math.max(1, this.litFrac / LIT_FRAC));
      this.exposureStretch += (stretchTarget - this.exposureStretch) * 0.01;
      this.c2d.putImageData(this.img, 0, 0);

      // --- composite: the exposure, then a soft additive halo.
      const dc = p.drawingContext;
      dc.save();
      dc.globalCompositeOperation = 'source-over';
      dc.globalAlpha = 1;
      dc.imageSmoothingEnabled = true;
      dc.drawImage(this.canvas, 0, 0, ctx.width, ctx.height);
      this.drawHalo(slowDecay, gain);
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = 0.6;
      dc.drawImage(this.halo, 0, 0, ctx.width, ctx.height);
      dc.restore();
    },
  });

  function smooth(t) { return t * t * (3 - 2 * t); }

  function respawn(f, i) {
    f.wx[i] = Math.random() * 2 - 1;
    f.wy[i] = Math.random() * 2 - 1;
    f.burn[i] = BURN_IN;
  }

  // The hot loop: iterate every walker of one form `steps` times and splat
  // each point bilinearly into the slow and fast buffers (interleaved) and the
  // 1/8 halo buffer. Returns how many cells of the chaos probe were hit.
  function splatForm(f, steps, fr) {
    const { acc, lo, Wl, hacc, hw, W, H, sx, sy, ox, oy, cr, sr, wFast } = fr;
    const co = f.co, dj = f.fam === 1;
    const A = co[0] * SIN_SCALE, B = co[1] * SIN_SCALE;
    const C = dj ? co[2] * SIN_SCALE : co[2], D = dj ? co[3] * SIN_SCALE : co[3];
    const wx = f.wx, wy = f.wy, burn = f.burn;
    // A collapsed orbit (guard up) is dimmed nearly out while the walk
    // hurries it through the window, and kept out of the auto-exposure: its
    // few, extremely dense pixels would otherwise drag the gain down and
    // darken the whole frame.
    const lw = 1 - 0.95 * f.guard, sample = f.guard < 0.5;
    const Wm = W - 1, Hm = H - 1, hsx = hw / W, hsy = fr.hacc.length / hw / H;
    let mnx = fr.mnx, mxx = fr.mxx, mny = fr.mny, mxy = fr.mxy, lvlSum = 0, lvlN = 0;
    for (let k = 0; k < WALKERS; k++) {
      // A nudge far below a pixel, every frame. Without it, a brief periodic
      // window pulls all walkers onto one orbit, and being deterministic they
      // then share one trajectory forever: 1024 walkers became 3 by 80 s,
      // which is what rendered as salt-grain. Chaos re-separates them within
      // a few dozen steps.
      let x = wx[k] + (Math.random() - 0.5) * 2e-5, y = wy[k] + (Math.random() - 0.5) * 2e-5, b = burn[k];
      for (let n = 0; n < steps; n++) {
        let nx, ny;
        if (dj) {
          nx = lsin(A * y) - lsin(B * x + QUARTER);
          ny = lsin(C * x) - lsin(D * y + QUARTER);
        } else {
          nx = lsin(A * y) + C * lsin(A * x + QUARTER);
          ny = lsin(B * x) + D * lsin(B * y + QUARTER);
        }
        x = nx; y = ny;
        if (b > 0) { b--; continue; }
        const u = x * cr - y * sr, w = x * sr + y * cr;
        if (u < mnx) mnx = u; if (u > mxx) mxx = u;
        if (w < mny) mny = w; if (w > mxy) mxy = w;
        const fx = u * sx + ox, fy = w * sy + oy;
        if (fx < 0 || fy < 0 || fx >= Wm || fy >= Hm) continue;
        const ix = fx | 0, iy = fy | 0;
        const ax = fx - ix, ay = fy - iy;
        const i0 = iy * W + ix;
        const bx = ax * lw, cx = lw - bx;
        acc[i0] += cx * (1 - ay); acc[i0 + 1] += bx * (1 - ay);
        acc[i0 + W] += cx * ay; acc[i0 + W + 1] += bx * ay;
        const l0 = ((iy >> 1) * Wl + (ix >> 1)) * 2;
        lo[l0] += lw; lo[l0 + 1] += lw * wFast;
        hacc[((fy * hsy) | 0) * hw + ((fx * hsx) | 0)] += lw;
        // Sample the exposure where the orbit lands: a density-weighted
        // "typical brightness" to auto-expose against.
        if (sample && (n & 7) === 4) { lvlSum += acc[i0]; lvlN++; }
      }
      // Escaped or NaN walkers (possible at extreme coefficients) restart.
      if (!(x > -8 && x < 8 && y > -8 && y < 8)) respawn(f, k);
      else { wx[k] = x; wy[k] = y; burn[k] = b; }
    }
    fr.mnx = mnx; fr.mxx = mxx; fr.mny = mny; fr.mxy = mxy;
    fr.lvlSum += lvlSum; fr.lvlN += lvlN;
    return lyapunov(f, A, B, C, D, dj, Math.min(steps, 120));
  }

  // Largest Lyapunov exponent, estimated from a few walker/shadow pairs
  // started 1e-7 apart and renormalised every step. Chaos is > 0; a periodic
  // window is < 0 and a quasi-periodic loop is ~0. A coverage count was tried
  // first and could not tell a closed loop from a thin chaotic band.
  const D0 = 1e-7;
  function lyapunov(f, A, B, C, D, dj, steps) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      let x = f.wx[j * 97], y = f.wy[j * 97];
      let u = x + D0, v = y;
      for (let n = 0; n < steps; n++) {
        let nx, ny, nu, nv;
        if (dj) {
          nx = lsin(A * y) - lsin(B * x + QUARTER); ny = lsin(C * x) - lsin(D * y + QUARTER);
          nu = lsin(A * v) - lsin(B * u + QUARTER); nv = lsin(C * u) - lsin(D * v + QUARTER);
        } else {
          nx = lsin(A * y) + C * lsin(A * x + QUARTER); ny = lsin(B * x) + D * lsin(B * y + QUARTER);
          nu = lsin(A * v) + C * lsin(A * u + QUARTER); nv = lsin(B * u) + D * lsin(B * v + QUARTER);
        }
        const dx = nu - nx, dy = nv - ny;
        const d = Math.sqrt(dx * dx + dy * dy) || D0 * 1e-6;
        sum += Math.log(d / D0);
        x = nx; y = ny;
        u = x + dx * D0 / d; v = y + dy * D0 / d;
      }
    }
    return sum / (4 * steps);
  }
})();
