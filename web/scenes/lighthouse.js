// The Lighthouse Keeper — a three-ink risograph seascape at night.
//
// A tall lighthouse on a rock at the right of a bay, a dark headland with a
// village across the water on the left, a moon, a handful of small sailing
// boats, and the sea running in perspective rows to the horizon. Everything is
// printed in three riso inks on cream paper: a blue flood, a dark second ink
// (teal) that deepens it to night, and a light ink (yellow) that only lamps,
// windows and the beam are allowed to use. Where light falls, the two dark
// plates are knocked out so the light ink prints on bare paper, the way a
// printer would separate it.
//
// The story (Director judge, 2026-09-28, "The Lighthouse Keeper"): the build
// brings in a storm while the keeper climbs the tower (his lantern moves up
// from window to window); the drop lights the lamp, whose two beams sweep the
// bay in perspective, and the village lights come on across the water; the
// breakdown clears the storm, dawn warms the horizon, and he walks back down.
//
// Music, each in its own place:
// - kick: one flash catching one boat. The boat nearest the beam's heading
//   (or the next boat, before the lamp is lit) has its sail lit yellow and a
//   pool of light on the water around it for a moment. Nothing else moves.
// - snare / clap: a wave cresting against the rock: spray thrown up the foot
//   of the tower in bare paper.
// - bass: swell height, and the pace the rows of waves travel.
// - hats: rain glints in the storm, or stars twinkling and the moon glade
//   flickering when the sky is clear.
// - drop: the lamp ignites (the beams are a flat, confined wedge of ink, never
//   a wash), the storm is full, the keeper is at the top.
//
// Craft notes:
// - Each ink is its own offscreen canvas (a "plate") holding that ink's
//   density. The frame is built once as a list of Path2D operations, and every
//   plate replays the list with its own densities; the plates are then grained
//   and multiplied onto paper with a small misregistration. So a shape that
//   occludes (the tower in front of the sky) paints its own density on every
//   plate rather than stacking on top.
// - Depth is a single projection (x = vx + (X - cam) / Z, sea at
//   horizon + HS / Z, lamp at horizon - HL / Z), shared by the waves, boats,
//   beams and camera drift, so the parallax and the beam's perspective agree.
// - No blur, no glow: light is flat ink with stepped densities, as in print.

(function () {
  const TAU = Math.PI * 2;
  const RES = 0.62;          // plate resolution as a fraction of device pixels
  const DEPTH = 600;         // world units per unit of Z
  const ROWS = 22;           // rows of waves
  const Z_FAR = 9, Z_NEAR = 0.4;

  const INKS = [
    { name: 'Harbour night', paper: '#F2ECDC', inks: ['#3D5588', '#00838A', '#FFE800'] },
    { name: 'Ember', paper: '#F2EADA', inks: ['#0078BF', '#914E72', '#FF6C2F'] },
    { name: 'Green & pink', paper: '#F0EBDF', inks: ['#3D5588', '#407060', '#FF48B0'] },
  ];

  const PRESETS = {
    calm: { lamp: 0.12, storm: 0.08, climb: 0.08, sweep: 0.7, dawn: 0, flash: 1 },
    drop: { lamp: 1, storm: 0.9, climb: 1, sweep: 1.15, dawn: 0, flash: 1 },
    // The storm cleared, the lamp still turning, the sky warming at the horizon.
    dawn: { lamp: 0.55, storm: 0, climb: 0.35, sweep: 0.6, dawn: 1, flash: 0.8, follow: 0 },
    // Full gale in the ember inks, beams racing, left alone to run.
    gale: { inks: 1, lamp: 1, storm: 1, climb: 1, sweep: 1.8, dawn: 0, flash: 1.3, follow: 0 },
  };
  // What "Follow the track" eases toward the drop preset.
  const DRIVE = ['lamp', 'storm', 'climb', 'sweep'];

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // The sea surface's height (screen units at Z = 1, up positive) at world X,
  // depth Z. Rows and boats both sample this, so boats ride their own wave.
  function waveAt(X, Z, ph, sharp) {
    // The Z term is not linear, so crests in successive rows do not line up
    // into one long diagonal ridge.
    const u = X * 0.011 + Z * 1.1 + 2.6 * Math.sin(Z * 4.3) + ph;
    let w = 0.55 * Math.sin(u) + 0.28 * Math.sin(2.03 * u + 1.3 + Z) + 0.14 * Math.sin(3.4 * u + 2.1 - ph * 0.3);
    // A storm peaks the crests and flattens the troughs.
    w += sharp * 0.45 * (w * w - 0.2);
    return w;
  }

  VIZ.register({
    id: 'lighthouse',
    name: 'The Lighthouse Keeper',
    order: 821,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((q) => q.name), default: 0 },
      { key: 'lamp', label: 'Lamp', type: 'range', min: 0, max: 1, default: PRESETS.calm.lamp, step: 0.01 },
      { key: 'storm', label: 'Storm', type: 'range', min: 0, max: 1, default: PRESETS.calm.storm, step: 0.01 },
      // 0 at the foot of the stair, 1 out on the gallery beside the lamp.
      { key: 'climb', label: 'Keeper climbs', type: 'range', min: 0, max: 1, default: PRESETS.calm.climb, step: 0.01 },
      { key: 'sweep', label: 'Beam speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.sweep, step: 0.01 },
      { key: 'dawn', label: 'Dawn', type: 'range', min: 0, max: 1, default: PRESETS.calm.dawn, step: 0.01 },
      // Reaction strength for the kick's flash on a boat.
      { key: 'flash', label: 'Kick flash', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'The Lighthouse Keeper',
      technique: 'Canvas 2D risograph: the frame is built once as Path2D operations and replayed onto three offscreen ink plates (blue flood, dark second ink, light ink), each with its own densities, knockouts where light falls, a fixed paper grain and a slight misregistration, then multiplied onto cream paper; one perspective projection shared by the rows of waves, the boats, the camera drift and the two rotating lamp beams',
      brief: 'A night seascape in three riso inks: a tall lighthouse on a rock, a dark headland with a village across the bay, a moon, small sailing boats riding perspective rows of waves. The build brings a storm in (clouds cover the moon, rain slants, the sea rises) while the keeper climbs, his lantern moving up the tower window by window. The drop lights the lamp: two flat wedges of yellow ink sweep the bay in perspective, the village lights come on, rain glints in the beams. The kick is one flash catching one boat (its sail lit and a pool of light around it), the clap throws spray up the rock, the bass lifts the swell, hats glint the rain or twinkle the stars. The breakdown clears the storm, dawn warms the horizon and the keeper walks back down.',
      lineage: [
        'Director judge (2026-09-28), proposal 3, The Lighthouse Keeper: "kick = the beam\'s flash, snare = a wave cresting against the rock, bass = swell height, hats = rain glints"; the storm arrives through the build as the keeper climbs, the lamp lights on the drop, dawn in the breakdown.',
        'Isle (web/scenes/isle.js): the lighthouse on a point and the boats in a bay, moved from a daylight toy to a night print.',
        'Sumi (web/scenes/sumi.js): the confined kick that lives around one hull; here the light is flat ink instead of Sumi\'s blurred lantern, after the Curator\'s note that one additive blob reads as an error in a matte scene.',
        'WPA (web/scenes/wpa.js): the national-park silkscreen of flat layered colour, given the movement the judges said it lacked.',
        'The Designer judge\'s gap: a true risograph piece with visible misregistration between inks.',
        'Presets: calm, drop, dawn (storm cleared, the lamp still turning, the horizon warming), gale (ember inks, full storm, fast beams, follow off).',
      ],
    },

    setup() { this.init(); },
    enter() { this.init(); },

    init() {
      this.lastT = null;
      this.env = {
        kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0, hf: 0, hs: 0, hWait: 0,
        bass: 0, low: 0, hatE: 0, dropOn: false, hadDrop: false,
        aBuild: 0, aDrop: 0, aDawn: 0, P: null,
      };
      this.phase = 0;        // wave travel
      this.wind = 0;         // cloud travel
      this.rot = 0.6;        // beam heading, radians (0 = straight away from us)
      this.flashes = [];
      this.recentB = [];
      this.sprays = [];
      this.glints = [];
      this.kicks = 0;
      this.twinkle = new Float32Array(90);
      const R = rng(821);
      this.stars = [];
      for (let i = 0; i < 90; i++) this.stars.push({ x: R(), y: Math.pow(R(), 1.4), r: 0.6 + R() * R() * 1.6, ph: R() * TAU });
      this.boats = [];
      const bz = [1.55, 2.2, 2.9, 3.8, 5.2];
      for (let i = 0; i < bz.length; i++) {
        this.boats.push({ X: (R() - 0.5) * 900 * bz[i], Z: bz[i], v: (R() < 0.5 ? -1 : 1) * (6 + R() * 8), ph: R() * TAU, size: 0.9 + R() * 0.3 });
      }
      this.clouds = [];
      for (let i = 0; i < 9; i++) {
        const puffs = [];
        const n = 5 + Math.floor(R() * 5);
        for (let j = 0; j < n; j++) puffs.push([(j / (n - 1) - 0.5) * (1 + R() * 0.3), R() * 0.5, 0.18 + R() * 0.22]);
        this.clouds.push({ x: (i * 0.618) % 1 + R() * 0.08, y: 0.04 + (i % 5) * 0.075 + R() * 0.05, w: 180 + R() * 220, puffs, sp: 0.6 + R() * 0.8, order: R() });
      }
      this.clouds.sort((a, b) => a.order - b.order);
      this.village = [];
      for (let i = 0; i < 26; i++) this.village.push({ u: R(), v: R(), w: R() < 0.3 ? 2 : 1.3, on: R() });
    },

    listen(signals, dt) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      const ev = { kick: 0, clap: 0, hat: 0 };
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        ev.kick = clamp((e.kf - e.ks) * 3, 0.6, 1);
        e.kWait = 0.2;
      }
      const c = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, c, 30, dt);
      e.cs = ease(e.cs, c, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      if (e.cf - e.cs > 0.08 && e.cWait === 0) { ev.clap = 1; e.cWait = 0.35; }
      const h = (signals[6] + signals[7] + signals[8]) / 300;
      e.hf = ease(e.hf, h, 45, dt);
      e.hs = ease(e.hs, h, 4, dt);
      e.hWait = Math.max(0, e.hWait - dt);
      if (e.hf - e.hs > 0.05 && e.hWait === 0) { ev.hat = clamp((e.hf - e.hs) * 6, 0.4, 1); e.hWait = 0.09; }
      e.bass = ease(e.bass, (signals[0] * 0.3 + signals[1] + signals[2] * 0.7) / 200, 3, dt);
      // Section followers: the hat bed rising through a build, and the
      // sidechained bass line (with hysteresis) for the drop. A kick with a
      // loud hat bed calls the drop on its first downbeat, not a second late.
      e.hatE = ease(e.hatE, h, 0.9, dt);
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && (e.low > 27 || (signals[0] > 85 && e.hatE > 0.3))) { e.dropOn = true; e.hadDrop = true; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return ev;
    },

    // Under a software GL rasteriser (the harness's SwiftShader) a GPU-backed
    // plate took ~50 s to draw its first frame: every drawImage of it onto the
    // p5 canvas forced a readback of hundreds of queued path fills (Murmuration
    // hit the same thing). There the plates are kept in CPU memory with
    // willReadFrequently. On a real GPU they stay GPU canvases, because CPU
    // plates cost tens of ms a frame at full-screen Retina size.
    softGL() {
      if (this.soft !== undefined) return this.soft;
      let soft = true;
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          const r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
          soft = /swiftshader|llvmpipe|software/i.test(r);
          const lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
        }
      } catch (err) { soft = true; }
      this.soft = soft;
      return soft;
    },

    plates(p, W, H) {
      const w = Math.max(2, Math.round(p.width * p.pixelDensity() * RES));
      const h = Math.max(2, Math.round(p.height * p.pixelDensity() * RES));
      if (!this.pl) {
        this.pl = [0, 1, 2].map(() => {
          const cv = document.createElement('canvas');
          return { cv, g: cv.getContext('2d', this.softGL() ? { willReadFrequently: true } : undefined) };
        });
        // Paper grain: speckles where the ink did not take. Fixed to the
        // paper, a different patch for each plate.
        const N = 173;
        const gc = document.createElement('canvas');
        gc.width = gc.height = N;
        const gg = gc.getContext('2d');
        const img = gg.createImageData(N, N);
        const R = rng(7);
        for (let i = 0; i < N * N; i++) {
          const r = R();
          const a = r < 0.025 ? 90 + R() * 80 : Math.pow(R(), 3) * 60;
          img.data[i * 4 + 3] = a;
        }
        gg.putImageData(img, 0, 0);
        this.grain = gc;
        for (const pl of this.pl) pl.pat = pl.g.createPattern(gc, 'repeat');
      }
      for (const pl of this.pl) {
        if (pl.cv.width !== w || pl.cv.height !== h) { pl.cv.width = w; pl.cv.height = h; }
        pl.sx = w / W; pl.sy = h / H;
      }
      return this.pl;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.env) this.init();
      const e = this.env;
      const ev = this.listen(signals, dt);

      // ---- the look: params, eased toward the drop when following ----
      const follow = Math.round(params.follow) === 1;
      const build = clamp((e.hatE - 0.025) / 0.2, 0, 1);
      e.aBuild = ease(e.aBuild, follow ? build : 0, 1.2, dt);
      e.aDrop = ease(e.aDrop, follow && e.dropOn ? 1 : 0, e.dropOn ? 2.2 : 0.4, dt);
      // Dawn comes up after a drop has ended, and goes as the next build starts.
      const dawnT = follow && e.hadDrop && !e.dropOn ? clamp(1 - build * 2.5, 0, 1) : 0;
      e.aDawn = ease(e.aDawn, dawnT, dawnT > e.aDawn ? 0.35 : 0.8, dt);
      const P = {};
      const mixK = { lamp: e.aDrop, storm: Math.max(e.aBuild * 0.85, e.aDrop), climb: Math.max(e.aBuild * 0.9, e.aDrop), sweep: e.aDrop };
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? mixK[k] : 0);
      P.dawn = Math.max(params.dawn, e.aDawn * 0.9);
      // A breakdown's dawn clears the storm faster than the bass alone would.
      P.storm *= 1 - 0.8 * e.aDawn;
      P.climb = Math.max(0, P.climb - 0.6 * e.aDawn);
      P.flash = params.flash;
      const ink = INKS[Math.round(params.inks)] || INKS[0];

      const storm = P.storm, dawn = P.dawn;
      const lampK = sstep(0.12, 0.85, P.lamp);

      // ---- time ----
      this.phase += dt * (0.55 + 0.9 * storm + 0.9 * e.bass);
      this.wind += dt * (0.4 + 1.6 * storm);
      this.rot += dt * TAU * P.sweep / 10;
      const cam = 26 * Math.sin(t * 0.043) + 12 * Math.sin(t * 0.017 + 1);

      // ---- projection ----
      const HOR = H * 0.585;
      const vx = W * 0.5;
      const HS = H * 0.765 - HOR;                     // sea at Z = 1 (the rock's waterline)
      const XL = Math.min(W * 0.23, 0.5 * W - 110);   // lighthouse world X
      const seaY = (Z) => HOR + HS / Z;
      const sx = (X, Z) => vx + (X - cam) / Z;
      const swellA = 5 + 11 * storm + 14 * e.bass;    // amplitude at Z = 1
      const sharp = storm;

      // Tower geometry (screen, Z = 1).
      const Lx = sx(XL, 1);
      const yWater = seaY(1);
      const yBase = yWater - 30;
      const yTop = H * 0.2;
      const yLamp = yTop - 18;
      const HL = HOR - yLamp;

      // ---- events ----
      const nB = this.boats.length;
      if (ev.kick && P.flash > 0) {
        let bi;
        if (lampK > 0.3) {
          // The boat nearest either beam's heading, among those in front of it.
          let best = 1e9;
          for (let i = 0; i < nB; i++) {
            const b = this.boats[i];
            const a = Math.atan2(b.X - XL, (b.Z - 1) * DEPTH);
            if (b.vis === false) continue;
            // Boats caught in the last two seconds wait their turn, so the
            // flashes travel round the bay instead of hammering one hull.
            let recent = 0;
            for (const f of this.flashes) if (f.b === i) recent++;
            for (const h of this.recentB) if (h === i) recent++;
            for (const off of [0, Math.PI]) {
              const d = Math.abs(((a - (this.rot + off)) % TAU + TAU + Math.PI) % TAU - Math.PI) + 0.7 * recent;
              if (d < best) { best = d; bi = i; }
            }
          }
        } else {
          bi = this.kicks % nB;
        }
        if (bi === undefined) bi = this.kicks % nB;
        this.kicks++;
        this.recentB.push(bi);
        if (this.recentB.length > 3) this.recentB.shift();
        this.flashes.push({ b: bi, t0: t, amp: ev.kick * P.flash });
      }
      this.flashes = this.flashes.filter((f) => t - f.t0 < 0.7);
      if (ev.clap) {
        this.claps = (this.claps || 0) + 1;
        const R = rng(Math.floor(t * 1000) + 3);
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + (R() - 0.5) * 1.7;
          const sp = 60 + R() * 130 * (0.7 + storm * 0.6);
          this.sprays.push({ x: Lx + (this.claps % 2 ? 1 : -1) * (40 + R() * 40), y: yWater - 10, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp, t0: t, r: 1 + R() * 2.6, life: 0.7 + R() * 0.6 });
        }
        this.sprays.push({ sheet: true, t0: t, life: 1.1, side: this.claps % 2 ? 1 : -1, seed: this.claps * 31 + 7, amp: storm });
      }
      this.sprays = this.sprays.filter((s) => t - s.t0 < s.life);
      if (ev.hat) {
        const R = rng(Math.floor(t * 997) + 11);
        const n = Math.round(4 + 10 * ev.hat);
        for (let i = 0; i < n; i++) this.glints.push({ x: R(), y: R(), t0: t, s: R() });
        for (let i = 0; i < 14; i++) this.twinkle[Math.floor(R() * this.twinkle.length)] = 1;
      }
      this.glints = this.glints.filter((g) => t - g.t0 < 0.16);
      for (let i = 0; i < this.twinkle.length; i++) this.twinkle[i] *= Math.exp(-dt * 6);

      // ---- build the frame as operations ----
      // d = [blue, dark, light] densities; null leaves that plate untouched.
      const ops = [];
      const paint = (path, d) => ops.push({ t: 'paint', path, d });
      const add = (path, d) => ops.push({ t: 'fill', path, d });
      const cut = (path, d) => ops.push({ t: 'cut', path, d });
      const rect = (x, y, w, h) => { const q = new Path2D(); q.rect(x, y, w, h); return q; };
      const circ = (x, y, r) => { const q = new Path2D(); q.arc(x, y, Math.max(0.1, r), 0, TAU); return q; };

      // Sky: blue flood, deepened by the dark ink toward the top.
      const pls = this.plates(p, W, H);
      const snapY = (y) => Math.round(y * pls[0].sy) / pls[0].sy;
      // Fine flat bands rather than canvas gradients: gradient fills on the
      // plates cost ~50 s a frame under the harness's SwiftShader raster, and
      // under the grain the 40 steps read as one smooth fountain anyway.
      const SKYB = 40;
      for (let i = 0; i < SKYB; i++) {
        const f = (i + 0.5) / SKYB;
        const y0 = i === 0 ? -10 : snapY(HOR * i / SKYB);
        const y1 = i === SKYB - 1 ? HOR + 3 : snapY(HOR * (i + 1) / SKYB);
        const dark = (f < 0.6 ? 0.82 + (0.55 - 0.82) * f / 0.6 : 0.55 + (0.3 - 0.55) * (f - 0.6) / 0.4)
          - dawn * (0.3 + 0.1 * f) + storm * (0.1 + 0.07 * f);
        // Dawn lifts the inks off the horizon and lays the light ink there.
        const lift = dawn * sstep(0.35, 1, f);
        add(rect(-10, y0, W + 20, y1 - y0), [1 - 0.8 * lift, Math.max(0, dark) * (1 - 0.9 * lift), 0.5 * lift]);
      }

      // Stars.
      const starVis = (1 - dawn) * (1 - sstep(0.2, 0.7, storm));
      if (starVis > 0.02) {
        const st = [new Path2D(), new Path2D()];
        for (let i = 0; i < this.stars.length; i++) {
          const s = this.stars[i];
          const x = ((s.x * (W + 40) - cam * 0.05) % (W + 40) + W + 40) % (W + 40) - 20;
          const y = s.y * HOR * 0.85;
          const tw = this.twinkle[i];
          const r = s.r * (1 + 1.2 * tw);
          (tw > 0.3 ? st[1] : st[0]).moveTo(x + r, y);
          (tw > 0.3 ? st[1] : st[0]).arc(x, y, r, 0, TAU);
        }
        cut(st[0], [0.75 * starVis, 0.9 * starVis, null]);
        cut(st[1], [starVis, starVis, null]);
        add(st[1], [null, null, 0.35 * starVis]);
      }

      // Moon, with a flat printed halo ring rather than a glow.
      const mX = W * 0.17 - cam * 0.03, mY = H * 0.17, mR = 25;
      const moonVis = 1 - 0.85 * sstep(0.3, 0.75, storm);
      cut(circ(mX, mY, mR * 2.1), [0.18 * moonVis * (1 - dawn), 0.3 * moonVis, null]);
      cut(circ(mX, mY, mR * 1.45), [0.12 * moonVis, 0.25 * moonVis, null]);
      cut(circ(mX, mY, mR), [moonVis, moonVis, null]);
      add(circ(mX, mY, mR), [null, null, 0.1]);
      // A darker sea on the moon: a crescent shadow of the dark ink.
      const mc = new Path2D();
      mc.arc(mX, mY, mR, -1.2, 1.9);
      mc.arc(mX + 7, mY - 2, mR * 0.9, 1.9, -1.2, true);
      add(mc, [0.12 * moonVis, 0.12 * moonVis, null]);

      // Clouds: banks arrive one by one as the storm rises.
      const nC = this.clouds.length;
      for (let i = 0; i < nC; i++) {
        const c = this.clouds[i];
        const v = clamp((storm * 1.25 - i / nC) * 3, 0, 1);
        if (v <= 0.01) continue;
        const span = W + c.w * 2;
        const cx = ((c.x * span + this.wind * 14 * c.sp - cam * 0.08) % span + span) % span - c.w;
        const cy = c.y * HOR;
        const top = new Path2D(), belly = new Path2D();
        for (const [px, py, pr] of c.puffs) {
          const r = pr * c.w * 0.55;
          const x = cx + px * c.w, y = cy + py * c.w * 0.18 - r * 0.2;
          top.moveTo(x + r, y); top.arc(x, y, r, 0, TAU);
          belly.moveTo(x + r * 0.8, y + r * 0.35); belly.arc(x, y + r * 0.35, r * 0.8, 0, TAU);
        }
        const flat = rect(cx - c.w * 0.62, cy, c.w * 1.24, c.w * 0.14);
        ops.push({ t: 'paint', path: top, d: [0.85 * v, 0.42 * v, 0], fade: v });
        ops.push({ t: 'paint', path: flat, d: [0.95 * v, 0.62 * v, 0], fade: v });
        ops.push({ t: 'paint', path: belly, d: [v, 0.66 * v, 0], fade: v });
      }

      // Far headland and village across the bay (left), and a low far spit (right).
      const hill = new Path2D();
      const hz = 8;
      hill.moveTo(-20, HOR + 2);
      for (let x = -20; x <= W * 0.52; x += 8) {
        const X = (x - vx) * hz + cam;
        const u = x / (W * 0.52);
        const hgt = 50 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.95) * (0.9 + 0.1 * Math.sin(X * 0.004)) + 6 * Math.sin(X * 0.011);
        hill.lineTo(x - cam / hz, HOR - Math.max(0, hgt) - 1);
      }
      hill.lineTo(W * 0.52, HOR + 2);
      hill.closePath();
      paint(hill, [1, 0.94 - 0.35 * dawn, 0]);
      const spit = new Path2D();
      spit.moveTo(W * 0.86 - cam / 12, HOR + 1);
      spit.quadraticCurveTo(W * 0.93 - cam / 12, HOR - 12, W + 20, HOR - 9);
      spit.lineTo(W + 20, HOR + 1);
      paint(spit, [1, 0.8 - 0.3 * dawn, 0]);
      // Village lights: a few in the calm, all of them once the lamp is lit.
      const vil = new Path2D();
      const litN = 0.25 + 0.75 * lampK;
      for (const L of this.village) {
        if (L.on > litN) continue;
        const x = W * (0.06 + 0.36 * L.u) - cam / hz;
        const u = (x + cam / hz) / (W * 0.52);
        const top = 50 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.95);
        const y = HOR - 3 - L.v * Math.max(4, top * 0.7);
        vil.rect(x, y, L.w, L.w * 1.2);
      }
      cut(vil, [1, 1, null]);
      add(vil, [null, null, 1]);

      // Beams: two flat wedges of the light ink, in perspective from the lamp.
      const beamK = lampK * (1 - 0.35 * dawn);
      const beams = [];
      if (beamK > 0.02) {
        for (const off of [0, Math.PI]) {
          const phi = this.rot + off;
          const c = Math.cos(phi);
          // Toward us (c < 0) the wedge would grow over the viewer: cut it short
          // and thin it, and let the lens flash stand for it instead.
          const face = Math.max(0, -c);
          for (const [dl, dens] of [[0.075, 0.5], [0.028, 0.9]]) {
            const edge = (a, list) => {
              const ca = Math.cos(a), sa = Math.sin(a);
              const sMax = ca > 0.02 ? Math.min(40000, (Z_FAR * 1.6 - 1) * DEPTH / ca) : ca < -0.02 ? Math.min(2400, 0.45 * DEPTH / -ca) : 2400;
              for (let k = 1; k <= 26; k++) {
                const s = sMax * Math.pow(k / 26, 1.7);
                const Z = 1 + s * ca / DEPTH;
                list.push([sx(XL + s * sa, Z), HOR - HL / Z]);
              }
            };
            const e1 = [], e2 = [];
            edge(phi - dl, e1); edge(phi + dl, e2);
            const a0 = beamK * dens * (1 - 0.7 * face);
            // The fade along the beam is three flat steps of ink, nested, the
            // way a printer would build it, not a gradient.
            for (const [n, a] of [[26, 0.4], [16, 0.4], [9, 0.45]]) {
              const q = new Path2D();
              q.moveTo(Lx, yLamp);
              for (let k = 0; k < n; k++) q.lineTo(e1[k][0], e1[k][1]);
              for (let k = n - 1; k >= 0; k--) q.lineTo(e2[k][0], e2[k][1]);
              q.closePath();
              cut(q, [a0 * a * 1.6, a0 * a * 1.8, null]);
              add(q, [null, null, a0 * a * 1.5]);
              if (dl > 0.05 && n === 26) beams.push(q);
            }
          }
        }
      }

      // Sea base.
      const seaP = rect(-10, HOR, W + 20, H - HOR + 10);
      paint(seaP, [1, 0.6 - 0.3 * dawn, 0]);

      // Moon glade: broken dashes down the water under the moon.
      if (moonVis > 0.1) {
        const gl = new Path2D(), gl2 = new Path2D();
        for (let i = 0; i < 30; i++) {
          const f = i / 30;
          const Z = 1 / (0.02 + f * 1.3);
          const y = seaY(Z) + 1;
          if (y > H) break;
          const wdt = (8 + 70 * f) * (0.6 + 0.4 * Math.sin(i * 7.1 + this.phase * 2.3));
          const x = mX + (vx - mX) * f * 0.25 + 10 * Math.sin(i * 3.7 + this.phase);
          const tw = this.twinkle[i] > 0.3;
          (tw ? gl2 : gl).rect(x - wdt / 2, y, wdt, Math.max(0.8, 2.4 * f + 0.5));
        }
        cut(gl, [0.5 * moonVis, 0.7 * moonVis, null]);
        cut(gl2, [0.9 * moonVis, moonVis, null]);
        add(gl2, [null, null, 0.2]);
      }

      // Rows of waves, far to near, with the boats and the lighthouse set in
      // at their own depth.
      const drawBoat = (b, bi) => {
        const bx = sx(b.X, b.Z);
        b.vis = false;
        if (bx < -60 || bx > W + 60) return;
        const s = b.size * 3.6 / b.Z;
        const yy = seaY(b.Z) - swellA * waveAt(b.X, b.Z, this.phase, sharp) / b.Z;
        const slope = (waveAt(b.X + 20, b.Z, this.phase, sharp) - waveAt(b.X - 20, b.Z, this.phase, sharp)) * swellA / 40;
        const roll = clamp(-slope * 0.9, -0.35, 0.35) + 0.04 * Math.sin(t * 1.3 + b.ph);
        const cs = Math.cos(roll), sn = Math.sin(roll);
        const T = (x, y) => [bx + (x * cs - y * sn) * s, yy + (x * sn + y * cs) * s];
        b.vis = true; b.sx = bx; b.sy = yy; b.ss = s;
        const poly = (pts) => { const q = new Path2D(); pts.forEach((pt, k) => { const v = T(pt[0], pt[1]); k ? q.lineTo(v[0], v[1]) : q.moveTo(v[0], v[1]); }); q.closePath(); return q; };
        const dir = b.v > 0 ? 1 : -1;
        let fl = 0;
        for (const f of this.flashes) if (f.b === bi) fl = Math.max(fl, f.amp * Math.exp(-(t - f.t0) * 5.5) * sstep(0, 0.03, t - f.t0));
        if (fl > 0.02) {
          // The pool of light on the water around the boat, then the boat in it.
          const pool = new Path2D();
          pool.ellipse(bx, yy + 1.5 * s, 26 * s * (0.8 + 0.4 * fl), 5 * s * (0.8 + 0.3 * fl), 0, 0, TAU);
          cut(pool, [0.8 * fl, 0.95 * fl, null]);
          add(pool, [null, null, fl]);
        }
        const hull = poly([[-11 * dir, -2.2], [12 * dir, -2.6], [8 * dir, 2.4], [-8 * dir, 2.2]]);
        paint(hull, [1, 1, fl > 0.3 ? 0.3 * fl : 0]);
        const mast = poly([[-0.4, -2.2], [0.4, -2.2], [0.4, -19], [-0.4, -19]]);
        paint(mast, [1, 1, 0]);
        const sail = poly([[1.3 * dir, -3.4], [1.3 * dir, -18.5], [10.5 * dir, -4.2]]);
        const jib = poly([[-1.2 * dir, -4], [-1.2 * dir, -16], [-7.5 * dir, -3.6]]);
        paint(sail, [0.55 * (1 - fl), 0.12 * (1 - fl), fl]);
        paint(jib, [0.7 * (1 - fl), 0.3 * (1 - fl), fl * 0.8]);
        // A masthead lantern.
        const mt = T(0, -20);
        const lan = circ(mt[0], mt[1], Math.max(0.7, 0.9 * s));
        cut(lan, [1, 1, null]);
        add(lan, [null, null, 1]);
      };

      const drawTower = () => {
        const bw = 31, tw = 21;
        const Hh = yBase - yTop;
        const xAt = (y, side) => Lx + side * (tw + (bw - tw) * (y - yTop) / Hh);
        // Rock.
        const rock = new Path2D();
        rock.moveTo(Lx - 105, yWater + 4);
        rock.lineTo(Lx - 82, yWater - 14);
        rock.lineTo(Lx - 55, yWater - 22);
        rock.lineTo(Lx - 38, yBase + 2);
        rock.lineTo(Lx + 40, yBase + 1);
        rock.lineTo(Lx + 62, yWater - 18);
        rock.lineTo(Lx + 90, yWater - 6);
        rock.lineTo(Lx + 104, yWater + 4);
        rock.closePath();
        paint(rock, [1, 0.97, 0]);
        const facet = new Path2D();
        facet.moveTo(Lx - 82, yWater - 14); facet.lineTo(Lx - 55, yWater - 22); facet.lineTo(Lx - 38, yBase + 2);
        facet.lineTo(Lx - 50, yWater - 2); facet.lineTo(Lx - 90, yWater); facet.closePath();
        paint(facet, [0.9, 0.55, 0]);
        // Tower: the moonlit (left) half pale, the far half in shadow.
        const body = new Path2D();
        body.moveTo(xAt(yTop, -1), yTop); body.lineTo(xAt(yTop, 1), yTop);
        body.lineTo(xAt(yBase, 1), yBase); body.lineTo(xAt(yBase, -1), yBase); body.closePath();
        paint(body, [0.22 + 0.1 * dawn, 0.04, 0]);
        const shade = new Path2D();
        shade.moveTo(Lx + 3, yTop); shade.lineTo(xAt(yTop, 1), yTop);
        shade.lineTo(xAt(yBase, 1), yBase); shade.lineTo(Lx + 4, yBase); shade.closePath();
        paint(shade, [0.62, 0.3, 0]);
        // Two painted bands.
        for (const [f0, f1] of [[0.3, 0.4], [0.62, 0.72]]) {
          const y0 = yTop + Hh * f0, y1 = yTop + Hh * f1;
          const band = new Path2D();
          band.moveTo(xAt(y0, -1), y0); band.lineTo(xAt(y0, 1), y0); band.lineTo(xAt(y1, 1), y1); band.lineTo(xAt(y1, -1), y1); band.closePath();
          paint(band, [1, 0.72, 0]);
        }
        // Door.
        const door = new Path2D();
        door.moveTo(Lx - 6, yBase); door.lineTo(Lx - 6, yBase - 13); door.arc(Lx, yBase - 13, 6, Math.PI, 0); door.lineTo(Lx + 6, yBase); door.closePath();
        paint(door, [1, 0.95, 0]);

        // Windows up the stair, and the keeper's lantern moving between them.
        const pos = P.climb * 4;
        const wins = [0.84, 0.6, 0.36, 0.14];
        for (let i = 0; i < 4; i++) {
          const y = yTop + Hh * wins[i];
          const x = Lx + (i % 2 ? 5 : -7);
          const lit = clamp(1 - Math.abs(pos - i) * 1.25, 0, 1);
          const wq = rect(x - 5, y - 8, 10, 16);
          paint(wq, [1 - lit, 1 - lit, lit]);
          if (lit > 0.05) {
            // His lantern spills a little light onto the wall around the window.
            const sp = new Path2D();
            sp.ellipse(x, y, 13, 16, 0, 0, TAU);
            add(sp, [null, null, 0.35 * lit]);
          }
          if (lit > 0.55) {
            // The keeper, climbing: a small figure against his own lantern.
            const kx = x + (pos - i) * 5;
            const kf = new Path2D();
            kf.arc(kx, y - 3, 1.5, 0, TAU);
            kf.rect(kx - 1.5, y - 1.5, 3, 8.5);
            paint(kf, [1, 1, 0]);
          }
        }

        // Gallery and lantern room.
        const gal = rect(Lx - tw - 7, yTop - 3, (tw + 7) * 2, 4);
        paint(gal, [1, 1, 0]);
        const rail = new Path2D();
        rail.rect(Lx - tw - 6, yTop - 12, (tw + 6) * 2, 1.4);
        for (let k = 0; k <= 8; k++) rail.rect(Lx - tw - 6 + k * (tw + 6) * 2 / 8 - 0.5, yTop - 12, 1, 9);
        paint(rail, [1, 1, 0]);
        const glass = rect(Lx - 14, yTop - 37, 28, 34);
        const lit = clamp(P.lamp * 1.4, 0, 1);
        paint(glass, [0.9 * (1 - lit), 0.6 * (1 - lit), 0.35 + 0.65 * lit]);
        // The lens itself: a bright core that grows as a beam turns toward us.
        const face = beamK * Math.max(Math.pow(Math.max(0, -Math.cos(this.rot)), 10), Math.pow(Math.max(0, Math.cos(this.rot)), 10));
        const core = new Path2D();
        core.ellipse(Lx, yLamp, 5 + 9 * face, 7 + 7 * face, 0, 0, TAU);
        if (lit > 0.1) { cut(core, [lit, lit, null]); add(core, [null, null, lit]); }
        const bars = new Path2D();
        for (const bx of [-14, -5, 4, 13]) bars.rect(Lx + bx, yTop - 37, 1.4, 34);
        bars.rect(Lx - 14, yTop - 21, 28, 1.2);
        paint(bars, [1, 1, 0.2 * lit]);
        const dome = new Path2D();
        dome.moveTo(Lx - 17, yTop - 37); dome.quadraticCurveTo(Lx, yTop - 62, Lx + 17, yTop - 37); dome.closePath();
        dome.rect(Lx - 1, yTop - 58, 2, 8);
        dome.moveTo(Lx + 2.6, yTop - 59); dome.arc(Lx, yTop - 59, 2.6, 0, TAU);
        paint(dome, [1, 0.9, 0]);
        // The lens flash as a beam passes the viewer: short flat rays, confined
        // to the lantern.
        if (face > 0.05) {
          const rays = new Path2D();
          for (let k = 0; k < 8; k++) {
            const a = k * TAU / 8 + 0.2;
            const r0 = 10, r1 = 10 + 34 * face * (k % 2 ? 0.55 : 1);
            rays.moveTo(Lx + Math.cos(a - 0.08) * r0, yLamp + Math.sin(a - 0.08) * r0);
            rays.lineTo(Lx + Math.cos(a) * r1, yLamp + Math.sin(a) * r1);
            rays.lineTo(Lx + Math.cos(a + 0.08) * r0, yLamp + Math.sin(a + 0.08) * r0);
            rays.closePath();
          }
          cut(rays, [face, face, null]);
          add(rays, [null, null, face]);
        }
        // The keeper out on the gallery once he has reached the top.
        const gk = clamp((pos - 3.4) * 2, 0, 1);
        if (gk > 0.05) {
          // In front of the lantern glass, so he reads as a silhouette on the light.
          const kx = Lx - 7 + 4 * (1 - gk), ky = yTop - 3;
          const kf = new Path2D();
          kf.arc(kx, ky - 13, 2.3, 0, TAU);
          kf.rect(kx - 2.2, ky - 11, 4.4, 11);
          paint(kf, [gk, gk, 0]);
        }
      };

      // Rows are spaced evenly on screen, not in Z, so near water is as
      // finely drawn as far water.
      const rowZ = [];
      for (let i = 0; i < ROWS; i++) {
        const f = i / (ROWS - 1);
        const y = HOR + 3 + (H + 12 - HOR - 3) * Math.pow(f, 1.25);
        rowZ.push(HS / (y - HOR));
      }
      const boatOrder = this.boats.map((b, i) => i).sort((a, c) => this.boats[c].Z - this.boats[a].Z);
      let bo = 0, towerDone = false;
      for (let i = 0; i < ROWS; i++) {
        const Z = rowZ[i];
        while (bo < boatOrder.length && this.boats[boatOrder[bo]].Z > Z) { drawBoat(this.boats[boatOrder[bo]], boatOrder[bo]); bo++; }
        if (!towerDone && Z < 1) { drawTower(); towerDone = true; }
        const A = swellA / Z;
        const Znext = i < ROWS - 1 ? rowZ[i + 1] : Z * 0.8;
        const yBot = seaY(Znext) + swellA / Znext + 3;
        const row = new Path2D(), crest = new Path2D(), foam = new Path2D();
        const step = clamp(4 / Math.sqrt(Z), 3, 12);
        let first = true, inFoam = false;
        for (let x = -12; x <= W + 12 + step; x += step) {
          const X = (x - vx) * Z + cam;
          const w = waveAt(X, Z, this.phase, sharp);
          const y = seaY(Z) - A * w;
          if (first) { row.moveTo(x, y); crest.moveTo(x, y); first = false; } else { row.lineTo(x, y); crest.lineTo(x, y); }
          const f = w > 0.62 - 0.12 * storm && storm > 0.15;
          if (f) { if (!inFoam) foam.moveTo(x, y - 0.3); else foam.lineTo(x, y - 0.3); }
          inFoam = f;
        }
        row.lineTo(W + 12 + step, yBot); row.lineTo(-12, yBot); row.closePath();
        const depthK = clamp((Z_FAR - Z) / Z_FAR, 0, 1);
        paint(row, [1, (0.62 + 0.3 * depthK) * (1 - 0.35 * dawn), 0]);
        ops.push({ t: 'cutStroke', path: crest, d: [0.25 + 0.2 * dawn, 0.7, null], w: clamp(1.6 / Z, 0.6, 4) });
        if (storm > 0.15) ops.push({ t: 'cutStroke', path: foam, d: [storm, storm, null], w: clamp(2.4 / Z, 0.7, 6) });
      }
      while (bo < boatOrder.length) { drawBoat(this.boats[boatOrder[bo]], boatOrder[bo]); bo++; }
      if (!towerDone) drawTower();

      // Spray from the clap: a sheet of foam up the rock, then droplets.
      for (const s of this.sprays) {
        const age = t - s.t0;
        if (s.sheet) {
          // A plume of froth climbing the side of the rock and falling back:
          // overlapping puffs, each swelling as it rises.
          const u = clamp(age / s.life, 0, 1);
          const k = Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (1 - u * u);
          const sh = new Path2D();
          const R = rng(s.seed);
          for (let j = 0; j < 16; j++) {
            const f = j / 15;
            const rise = Math.sin(Math.min(1, u * 1.8) * Math.PI * 0.5) * (1 - 0.35 * u);
            const x = Lx + s.side * (48 + 22 * f - 30 * f * f) + (R() - 0.5) * 16;
            const y = yWater - 4 - (110 + 40 * s.amp) * f * rise + 30 * u * u * f;
            const r = (5 + 9 * R()) * (0.5 + 0.7 * f) * (0.4 + 0.8 * rise);
            sh.moveTo(x + r, y); sh.arc(x, y, r, 0, TAU);
          }
          cut(sh, [0.9 * k, 0.95 * k, null]);
        } else {
          const x = s.x + s.vx * age, y = s.y + s.vy * age + 160 * age * age;
          const a = 1 - age / s.life;
          const d = circ(x, y, s.r * (0.6 + 0.6 * a));
          cut(d, [a, a, null]);
        }
      }

      // Rain: slanted streaks, lighter than the night; lit yellow where they
      // cross a beam.
      if (storm > 0.05) {
        const n = Math.round(340 * storm);
        const rain = new Path2D();
        const slant = 0.35 + 0.25 * storm;
        const len = 10 + 12 * storm;
        const fall = t * 520;
        for (let i = 0; i < n; i++) {
          const hx = hash(i * 1.37), hy = hash(i * 2.91 + 5);
          const span = H + 60;
          const y = ((hy * span + fall * (0.8 + 0.4 * hash(i * 0.7))) % span) - 30;
          const x = ((hx * (W + 80) + y * slant - this.wind * 20) % (W + 80) + W + 80) % (W + 80) - 40;
          rain.moveTo(x, y); rain.lineTo(x - len * slant, y - len);
        }
        ops.push({ t: 'cutStroke', path: rain, d: [0.45 * storm, 0.5 * storm, null], w: 1.1 });
        for (const q of beams) {
          ops.push({ t: 'clip', path: q });
          ops.push({ t: 'cutStroke', path: rain, d: [0.9 * beamK, 0.9 * beamK, null], w: 1.2 });
          ops.push({ t: 'stroke', path: rain, d: [null, null, beamK], w: 1.2 });
          ops.push({ t: 'unclip' });
        }
      }
      // Hat glints: rain glints in a storm, sparks on the crests otherwise.
      if (this.glints.length) {
        const g = new Path2D();
        for (const gl of this.glints) {
          if (storm > 0.25) {
            const x = gl.x * W, y = gl.y * H;
            g.moveTo(x, y); g.lineTo(x - 7, y - 16);
          } else {
            const x = gl.x * W, Z = 1 / (0.1 + gl.y * 1.8), y = seaY(Z) - 2;
            g.moveTo(x - 4 / Z - 1, y); g.lineTo(x + 4 / Z + 1, y);
          }
        }
        ops.push({ t: 'cutStroke', path: g, d: [1, 1, null], w: 1.4 });
        ops.push({ t: 'stroke', path: g, d: [null, null, 0.3], w: 1.4 });
      }

      // The kick's flash: the lamp throws a narrow spot onto one boat, a thin
      // wedge that lives for a moment (only once the lamp is lit).
      if (lampK > 0.3) {
        for (const f of this.flashes) {
          const b = this.boats[f.b];
          if (!b.vis) continue;
          const fl = f.amp * Math.exp(-(t - f.t0) * 6) * sstep(0, 0.03, t - f.t0) * lampK;
          if (fl < 0.03) continue;
          const hw = 10 * b.ss;
          const q = new Path2D();
          const ty = b.sy - 8 * b.ss;
          q.moveTo(Lx - 1.5, yLamp); q.lineTo(Lx + 1.5, yLamp);
          q.lineTo(b.sx + hw, ty + 6 * b.ss); q.lineTo(b.sx - hw, ty - 6 * b.ss); q.closePath();
          cut(q, [0.55 * fl, 0.7 * fl, null]);
          add(q, [null, null, 0.7 * fl]);
        }
      }

      // ---- boats travel ----
      for (const b of this.boats) {
        b.X += b.v * dt * (0.6 + storm);
        const x = sx(b.X, b.Z);
        if (x > W + 70 && b.v > 0) b.X = (0 - 60 - vx) * b.Z + cam;
        else if (x < -70 && b.v < 0) b.X = (W + 60 - vx) * b.Z + cam;
      }

      // ---- replay onto the plates, grain them, print them ----
      for (let k = 0; k < 3; k++) {
        const { g, cv, sx: ax, sy: ay, pat } = pls[k];
        const ic = rgb(ink.inks[k]);
        const col = (a) => 'rgba(' + ic[0] + ',' + ic[1] + ',' + ic[2] + ',' + clamp(a, 0, 1) + ')';
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, cv.width, cv.height);
        g.setTransform(ax, 0, 0, ay, 0, 0);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        const solid = ink.inks[k];
        let clipDepth = 0;
        for (const o of ops) {
          if (o.t === 'clip') { g.save(); g.clip(o.path); clipDepth++; continue; }
          if (o.t === 'unclip') { if (clipDepth) { g.restore(); clipDepth--; } continue; }
          const d = o.d[k];
          if (d === null || d === undefined) continue;
          if (o.t === 'paint') {
            // Replace: knock the plate out under the shape, then lay its density.
            g.globalCompositeOperation = 'destination-out';
            g.globalAlpha = o.fade === undefined ? 1 : o.fade;
            g.fillStyle = solid;
            g.fill(o.path);
            if (d > 0.003) {
              g.globalCompositeOperation = 'source-over';
              g.globalAlpha = clamp(d, 0, 1);
              g.fill(o.path);
            }
          } else if (o.t === 'fill') {
            if (d <= 0.003) continue;
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = clamp(d, 0, 1);
            g.fillStyle = solid;
            g.fill(o.path);
          } else if (o.t === 'cut') {
            if (d <= 0.003) continue;
            g.globalCompositeOperation = 'destination-out';
            g.globalAlpha = clamp(d, 0, 1);
            g.fillStyle = solid;
            g.fill(o.path);
          } else if (o.t === 'stroke' || o.t === 'cutStroke') {
            if (d <= 0.003) continue;
            g.globalCompositeOperation = o.t === 'cutStroke' ? 'destination-out' : 'source-over';
            g.globalAlpha = clamp(d, 0, 1);
            g.strokeStyle = solid;
            g.lineWidth = o.w;
            g.stroke(o.path);
          }
        }
        while (clipDepth--) g.restore();
        // Grain, fixed to the paper.
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = 0.9;
        const ox = k * 57, oy = k * 91;
        g.translate(-ox, -oy);
        g.fillStyle = pat;
        g.fillRect(ox, oy, cv.width, cv.height);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }

      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.fillStyle = ink.paper;
      c2.fillRect(-2, -2, W + 4, H + 4);
      c2.globalCompositeOperation = 'multiply';
      c2.imageSmoothingEnabled = true;
      // Misregistration: each drum a hair off, slowly wandering.
      const mis = [[0, 0], [1.3 + 0.4 * Math.sin(t * 0.21), -0.9], [-1.1, 1.2 + 0.4 * Math.sin(t * 0.17 + 2)]];
      for (let k = 0; k < 3; k++) {
        c2.drawImage(pls[k].cv, mis[k][0] - 3, mis[k][1] - 3, W + 6, H + 6);
      }
      c2.restore();
    },
  });
})();
