// Flyover V2 — a night flight up a winding river valley whose banks are the
// music's recent past. See harness/v2/flyover.md.
//
// The 2016 spark is kept: every row of the land is one spectrum snapshot,
// pushed onto a queue as the camera flies, so you fly over the music's
// history. What changed is the world. V1's default was a bare wireframe and
// the judges (and Raph) only liked Night drive's layers — sky, stars, sun,
// moving ground — so V2 is only that world, made solid: rows are filled far to
// near with one rim line each, fogged into the horizon haze, and lit from a
// low sun ahead. Scanlines now owns the phosphor raster, so there are no
// wires here at all.
//
// Music:
// - kick: sunlight laid on the water a third of the way out; the glint is
//   stored in the land's rows, so it rides the river toward and under you.
// - clap: a meteor across the upper sky (a contrail in daylight).
// - hats: the stars twinkle and the water sparkles.
// - bass: the sun swells, the flight quickens, the banks rise (they are the
//   spectrum, bass nearest the water).
// - the drop is the canyon: stratified walls rise on both banks, the camera
//   comes down between them and flies faster; the breakdown climbs back out
//   over open country. All of that is params, so snapshots capture it;
//   "Follow the track" eases toward the drop preset by itself.
(function () {
  const BANDS = 9;
  const COLS = 97;           // odd, so a column sits on the river's axis
  const MAX_ROWS = 170;
  const DZ = 0.28;           // world depth between rows
  const Z_FAR = 36;
  const RIVER = 0.24;        // river half-width, world units
  const LIGHTS = ['Ember dusk', 'Moonlight', 'Verdigris', 'Desert noon'];

  // Hand-made lights rather than the shared palettes: each is a whole
  // lighting setup (sky, haze, sun, rim, ground, water), and a random
  // five-colour palette made V1's Night drive incoherent on half the list.
  const SCHEMES = [
    { skyTop: [7, 5, 13], skyMid: [28, 12, 26], haze: [96, 40, 50], sun: [255, 124, 88],
      sunCore: [255, 216, 176], rim: [255, 168, 112], ground: [9, 5, 9], water: [18, 8, 16],
      star: [255, 236, 222], meteor: [255, 222, 190], night: 1 },
    { skyTop: [3, 6, 14], skyMid: [9, 19, 37], haze: [46, 68, 94], sun: [196, 214, 232],
      sunCore: [236, 242, 248], rim: [150, 188, 218], ground: [3, 6, 11], water: [7, 13, 24],
      star: [226, 236, 255], meteor: [214, 232, 255], night: 1 },
    { skyTop: [2, 8, 9], skyMid: [5, 24, 26], haze: [28, 76, 72], sun: [242, 186, 96],
      sunCore: [255, 234, 186], rim: [112, 214, 184], ground: [2, 7, 7], water: [4, 15, 15],
      star: [220, 255, 240], meteor: [255, 230, 170], night: 1 },
    // Daylight: matte ochre land drawn in dark ink, pale haze, no glow.
    { skyTop: [118, 150, 178], skyMid: [196, 200, 198], haze: [236, 222, 198], sun: [255, 246, 226],
      sunCore: [255, 252, 240], rim: [62, 38, 30], ground: [184, 132, 90], water: [112, 138, 150],
      star: [255, 255, 255], meteor: [255, 255, 255], night: 0 },
  ];

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  // The river's course, as a function of distance flown (in rows). Two slow
  // incommensurate sines, so the bends never repeat on a set's timescale.
  function course(s) {
    return 2.4 * Math.sin(s * 0.019) + 1.3 * Math.sin(s * 0.0077 + 1.3) + 0.45 * Math.sin(s * 0.047 + 4);
  }

  const PRESETS = {
    calm: { canyon: 0.18, speed: 0.8, altitude: 1.1, height: 1.2, glint: 0.85 },
    drop: { canyon: 1, speed: 1.8, altitude: 0.5, height: 1.6, glint: 1.2 },
    noon: { light: 3, canyon: 0.55, speed: 1, altitude: 0.9 },
    moonlit: { light: 1, canyon: 0.3, speed: 0.6, altitude: 1.3, height: 0.8 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['canyon', 'speed', 'altitude', 'height', 'glint'];

  VIZ.register({
    id: 'flyoverv2',
    name: 'Flyover',
    versionOf: 'flyover',
    version: 'V2',
    order: 721,

    params: [
      { key: 'light', label: 'Light', type: 'select', options: LIGHTS, default: 0 },
      { key: 'canyon', label: 'Canyon', type: 'range', min: 0, max: 1, default: 0.18, step: 0.01 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 2.5, default: 0.8, step: 0.01 },
      { key: 'altitude', label: 'Altitude', type: 'range', min: 0.3, max: 1.6, default: 1.1, step: 0.01 },
      { key: 'height', label: 'Terrain height', type: 'range', min: 0, max: 2.5, default: 1.2, step: 0.01 },
      { key: 'glint', label: 'Kick on the water', type: 'range', min: 0, max: 1.5, default: 0.85, step: 0.01 },
      { key: 'sun', label: 'Sun', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],

    presets: PRESETS,

    gallery: {
      title: 'Flyover',
      technique: 'Canvas 2D: a heightfield of spectrum snapshots in a ring buffer, projected through a hand-rolled pinhole camera and painted far to near as filled, rim-lit, fogged rows; a meandering river with a sun-reflection column and kick glints stored in the rows; section detector easing toward a drop preset',
      brief: 'A night flight up a winding river toward a low sun. Every row of the land is one moment of the music, so the banks you fly over are the last few seconds of the track: bass rises nearest the water, treble on the far ridges. Each kick lays a glint of sunlight on the river that then rides the water toward and under you; each clap sends a meteor across the sky; hats twinkle the stars and sparkle the water. The drop takes you down into a canyon, stratified walls rising on both banks as the camera drops between them and flies faster; the breakdown climbs back out over open country. Four lights: Ember dusk, Moonlight, Verdigris, and a matte Desert noon in ink.',
      lineage: [
        'V2 of Flyover (web/viz/flyover.js), which finished Raph\'s abandoned 2016 Flyover.pde ("flyover ;_;") and ranked in the bottom 12 of 72 (mean 4.2). Kept: the spark, every row of the land a spectrum snapshot flown over as history, and Night drive\'s layered world (stars, sun, moving ground) that Raph liked.',
        'Psychonaut and floor (the default wireframe is bare; Night drive should be the default) and director (a clear arc but nothing to look at): the wireframe is gone; the land is solid, fogged and rim-lit, with a river, a sun and a sky.',
        'Floor transplant 3 (Flyover should drop into a canyon): the drop is the canyon, walls rising and the camera descending between them; the breakdown climbs out.',
        'Curator (1983; merge into Scanlines): reinterpreted. Rather than merge, V2 leaves the raster and synthwave grid to Scanlines and becomes a landscape with light and weather. Psychonaut transplant 3 (rotating hidden image) is answered by the meandering river: the valley ahead is always a new bend.',
      ],
    },

    enter(p) { this.init(p); },

    init(p) {
      this.sig = new Float32Array(MAX_ROWS * BANDS);
      this.nLo = new Float32Array(MAX_ROWS * COLS);
      this.nHi = new Float32Array(MAX_ROWS * COLS);
      this.gl = new Float32Array(MAX_ROWS);      // kick glint per row
      this.wallL = new Float32Array(MAX_ROWS);
      this.wallR = new Float32Array(MAX_ROWS);
      this.sparkPh = new Float32Array(MAX_ROWS);  // per-row sparkle phase
      this.bandEnv = new Float32Array(BANDS);
      this.headSerial = 0;
      this.cam = 0;                  // camera position in rows flown
      this.rng = 918273;
      this.lastMs = null;
      this.env = { bass: 0, high: 0, auto: 0, lastKick: -9, lastSnare: -9, lastHat: -9, hat: 0 };
      this.hist = { k: [0, 0, 0, 0], c: [0, 0, 0, 0], h: [0, 0, 0] };
      this.kickTimes = [];
      this.inDrop = false;
      this.meteors = [];
      // Columns: fine near the river, spreading fast outward so the land
      // reaches the screen edge even at the horizon (36 units deep).
      this.colX = new Float32Array(COLS);
      for (let j = 0; j < COLS; j++) {
        const u = j / (COLS - 1) * 2 - 1, a = Math.abs(u);
        this.colX[j] = Math.sign(u) * (a * 2.4 + Math.pow(a, 3.2) * 46);
      }
      this.stars = [];
      for (let i = 0; i < 150; i++) {
        this.stars.push({ x: this.rand() * 1.4 - 0.2, y: Math.pow(this.rand(), 1.5),
          r: this.rand() < 0.12 ? 1.5 : 0.85, ph: this.rand() * 6.28, tw: this.rand() });
      }
      this.px = new Float32Array(COLS); this.py = new Float32Array(COLS);
      this.qx = new Float32Array(COLS); this.qy = new Float32Array(COLS);
      this.hgt = new Float32Array(COLS);
      // Fill the land out to the horizon so it is there on first switch.
      const quiet = new Float32Array(BANDS);
      while (this.headSerial * DZ < Z_FAR + DZ * 2) this.push(p, quiet);
    },

    rand() {
      this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
      return this.rng / 4294967296;
    },

    push(p, bands) {
      const s = ++this.headSerial;
      const slot = s % MAX_ROWS;
      for (let b = 0; b < BANDS; b++) this.sig[slot * BANDS + b] = bands[b];
      const o = slot * COLS;
      for (let j = 0; j < COLS; j++) {
        const x = this.colX[j];
        this.nLo[o + j] = p.noise(x * 0.28 + 50, s * 0.035);
        this.nHi[o + j] = p.noise(x * 1.9 + 200, s * 0.4);
      }
      // Where each canyon wall starts, per side, so the walls come and go in
      // buttresses and bays instead of running as two parallel corridors.
      this.wallL[slot] = RIVER + 0.55 + 1.7 * p.noise(s * 0.045, 7.3);
      this.wallR[slot] = RIVER + 0.55 + 1.7 * p.noise(s * 0.045, 19.1);
      this.gl[slot] = 0;
      this.sparkPh[slot] = this.rand() * 6.28;
    },

    listen(sig, dt, now) {
      const e = this.env, H = this.hist;
      const ev = { kick: 0, snare: false, hat: 0 };
      const k = sig[0] / 100;
      const kMin = Math.min(H.k[0], H.k[1], H.k[2], H.k[3]);
      if (k - kMin > 0.2 && k > 0.38 && now - e.lastKick > 0.2) {
        e.lastKick = now;
        ev.kick = Math.min(1, 0.55 + (k - kMin));
        this.kickTimes.push(now);
      }
      H.k.shift(); H.k.push(k);
      const c = sig[4] / 100;
      const cMin = Math.min(H.c[0], H.c[1], H.c[2], H.c[3]);
      if (c - cMin > 0.22 && c > 0.34 && now - e.lastSnare > 0.22) { e.lastSnare = now; ev.snare = true; }
      H.c.shift(); H.c.push(c);
      const h = (sig[7] + sig[8]) / 200;
      const hMin = Math.min(H.h[0], H.h[1], H.h[2]);
      if (h - hMin > 0.16 && h > 0.22 && now - e.lastHat > 0.07) { e.lastHat = now; ev.hat = h; }
      H.h.shift(); H.h.push(h);
      e.bass = ease(e.bass, (sig[0] + sig[1] + sig[2]) / 300, 1.8, dt);
      e.high = ease(e.high, (sig[6] + sig[7] + sig[8]) / 300, 3, dt);
      while (this.kickTimes.length && now - this.kickTimes[0] > 2.5) this.kickTimes.shift();
      // Section detector: the build's kicks alone must not open the canyon,
      // so the drop also needs the bass under it; it ends when the kicks stop.
      if (!this.inDrop && this.kickTimes.length >= 4 && e.bass > 0.28) this.inDrop = true;
      else if (this.inDrop && now - e.lastKick > 1.1) this.inDrop = false;
      return ev;
    },

    // Height (world units) of every column of the row in `slot`.
    profile(slot, out, canyon, height) {
      const sig = this.sig, base = slot * BANDS, o = slot * COLS, colX = this.colX;
      const nLo = this.nLo, nHi = this.nHi;
      for (let j = 0; j < COLS; j++) {
        const a = Math.abs(colX[j]);
        if (a < RIVER) { out[j] = -0.02; continue; }
        const bank = smooth(RIVER, RIVER + 0.3, a);
        // The spectrum runs outward from the water: bass on the near banks,
        // treble on the far ridges, then it dies into plain distant hills.
        const s = (a - RIVER) / 3.2;
        const pos = (s < 1 ? s : 1) * 8;
        let i = pos | 0; if (i > 7) i = 7;
        const t = pos - i;
        const p0 = sig[base + (i > 0 ? i - 1 : 0)], p1 = sig[base + i];
        const p2 = sig[base + i + 1], p3 = sig[base + (i < 7 ? i + 2 : 8)];
        const t2 = t * t, t3 = t2 * t;
        let v = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                       (3 * p1 - p0 - 3 * p2 + p3) * t3);
        if (v < 0) v = 0;
        if (s > 1) v *= 0.35 + 0.65 * Math.exp(-(s - 1) * 1.2);
        // Grain scaled by the signal, so loud banks are craggy not smooth.
        v *= 1 + 0.9 * (nHi[o + j] - 0.5);
        let y = v / 100 * height * 0.95;
        // Ground: low near the water, rolling hills in the distance.
        const lo = nLo[o + j];
        y += lo * (0.08 + 0.9 * smooth(1.5, 14, a)) + 0.25 * smooth(4, 20, a) * lo * lo;
        y *= bank;
        // Canyon walls: stratified (soft terraces), then a mesa top.
        if (canyon > 0.001) {
          const on = colX[j] < 0 ? this.wallL[slot] : this.wallR[slot];
          let w = canyon * 3.1 * smooth(on, on + 1.0, a) * (0.7 + 0.6 * lo);
          const kk = w / 0.5, fl = Math.floor(kk);
          w = (fl + smooth(0.55, 1, kk - fl)) * 0.5;
          y += w;
        }
        out[j] = y;
      }
    },

    draw(p, signals, params, ctx) {
      if (!this.sig) this.init(p);
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const now = ms / 1000;
      const ev = this.listen(signals, dt, now);
      const e = this.env;

      // Follow the track: ease toward the drop preset in about a bar, and
      // back out over about four, so the breakdown is a long climb.
      const follow = Math.round(params.follow) === 1;
      // The build already leans toward it: hats and early kicks raise the
      // bluffs a little, so the canyon is anticipated, not switched on.
      const lean = Math.min(0.3, e.high * 0.5 + this.kickTimes.length * 0.04);
      const target = !follow ? 0 : this.inDrop ? 1 : lean;
      e.auto = ease(e.auto, target, target > e.auto ? 1.6 : 0.4, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const canyon = clamp01(P.canyon);

      const sch = SCHEMES[Math.round(params.light) % SCHEMES.length];
      const W = ctx.width, H = ctx.height;

      // Each band is followed with a quick attack and slower release before
      // it is sampled into a row, so a hat leaves a ridge a few rows deep.
      const env = this.bandEnv;
      for (let b = 0; b < BANDS; b++) {
        const v = signals[b];
        env[b] += (v - env[b]) * (v > env[b] ? 0.7 : 0.16);
      }

      // Flight: rows per second, quickened a little by the bass.
      const rowsPerSec = 16 * P.speed * (0.8 + 0.45 * e.bass);
      this.cam += rowsPerSec * dt;
      while ((this.headSerial - this.cam) * DZ < Z_FAR + DZ) this.push(p, env);

      // Camera. Height above the water; x follows the river a few rows ahead
      // and yaws into the bend; a slight bank with the bend's curvature.
      const camY = 1.25 * P.altitude;
      const look = this.cam + 4;
      const camX = course(look);
      const slope = (course(look + 40) - course(look)) / (40 * DZ);
      const curv = course(look + 30) - 2 * course(look) + course(look - 30);
      const roll = Math.max(-0.06, Math.min(0.06, -curv * 0.09));
      const horizon = H * (0.38 + 0.03 * (1 - P.altitude));
      const F = H * 0.92;
      const cx = W / 2;

      p.colorMode(p.RGB, 255);
      p.background(0);
      const g = p.drawingContext;
      g.save();
      g.translate(cx, horizon);
      g.rotate(roll);
      g.translate(-cx, -horizon);
      g.lineJoin = 'round';
      g.lineCap = 'round';

      // ---- events
      if (ev.kick && P.glint > 0) {
        // Lay the glint on the rows about a third of the way out.
        const zHit = 7;
        const s0 = this.cam + zHit / DZ;
        for (let d = -5; d <= 5; d++) {
          const s = Math.round(s0) + d;
          if (s < 1 || s > this.headSerial) continue;
          const slot = s % MAX_ROWS;
          const w = Math.exp(-d * d / 8) * ev.kick * P.glint;
          if (w > this.gl[slot]) this.gl[slot] = w;
        }
      }
      if (ev.snare) {
        const dir = this.rand() < 0.5 ? -1 : 1;
        this.meteors.push({ t0: now, x: 0.15 + 0.7 * this.rand(), y: 0.1 + 0.4 * this.rand(), dir,
          len: 0.18 + 0.12 * this.rand(), dur: 0.55 + 0.25 * this.rand() });
        if (this.meteors.length > 4) this.meteors.shift();
      }
      if (ev.hat) e.hat = Math.max(e.hat, ev.hat);
      e.hat *= Math.exp(-dt * 7);
      // Glints fade as they travel, within about a beat, so each kick is its
      // own flare rather than a build-up of light on the water.
      const glDecay = Math.exp(-dt * 2.4);
      for (let i = 0; i < MAX_ROWS; i++) this.gl[i] *= glDecay;

      // ---- sky
      this.drawSky(g, W, H, horizon, sch, params, e, now, cx);

      // ---- land, far to near
      const rimGrad = g.createLinearGradient(cx - W * 0.7, 0, cx + W * 0.7, 0);
      rimGrad.addColorStop(0, rgba(sch.rim, 0.35));
      rimGrad.addColorStop(0.5, rgba(mix(sch.rim, sch.sunCore, sch.night ? 0.35 : 0), 1));
      rimGrad.addColorStop(1, rgba(sch.rim, 0.35));
      const waterGrad = g.createLinearGradient(cx - W * 0.07, 0, cx + W * 0.07, 0);
      const refl = mix(sch.sun, sch.sunCore, 0.3);
      waterGrad.addColorStop(0, rgba(refl, 0));
      waterGrad.addColorStop(0.5, rgba(refl, sch.night ? 0.85 : 0.6));
      waterGrad.addColorStop(1, rgba(refl, 0));

      const litC = sch.night ? mix(sch.ground, mix(sch.rim, sch.sun, 0.5), 0.3) : mix(sch.ground, sch.sunCore, 0.35);
      const first = Math.max(1, Math.ceil(this.cam + 0.6 / DZ));
      let prevOk = false;
      let jL = 0, jR = COLS - 1;
      for (let j = 0; j < COLS; j++) if (Math.abs(this.colX[j]) < RIVER) { jL = j - 1; break; }
      for (let j = COLS - 1; j >= 0; j--) if (Math.abs(this.colX[j]) < RIVER) { jR = j + 1; break; }
      const pad = W * 0.3;

      for (let s = this.headSerial; s >= first; s--) {
        const z = (s - this.cam) * DZ;
        if (z > Z_FAR + DZ) continue;
        const f = clamp01((z - 1) / (Z_FAR - 1));
        const fog = Math.pow(f, 0.62);
        const slot = s % MAX_ROWS;
        this.profile(slot, this.hgt, canyon, P.height);
        const inv = F / z;
        const rx = course(s) - camX - slope * z;
        const px = this.px, py = this.py, hgt = this.hgt;
        for (let j = 0; j < COLS; j++) {
          px[j] = cx + (this.colX[j] + rx) * inv;
          py[j] = horizon + (camY - hgt[j]) * inv;
        }
        // Soft entry at the far end so rows never pop in.
        const alpha = clamp01((Z_FAR + DZ - z) / (DZ * 6));

        // Water between the farther row and this one.
        if (prevOk) {
          const qx = this.qx, qy = this.qy;
          g.beginPath();
          g.moveTo(px[jL], py[jL]);
          for (let j = jL + 1; j <= jR; j++) g.lineTo(px[j], py[j]);
          for (let j = jR; j >= jL; j--) g.lineTo(qx[j], qy[j]);
          g.closePath();
          // Far water mirrors the haze, near water is dark (Fresnel); the
          // sun lays a column of light down the middle of it.
          g.fillStyle = rgba(mix(sch.water, sch.haze, 0.15 + 0.8 * fog), alpha);
          g.fill();
          g.globalAlpha = alpha * (0.2 + 0.8 * Math.sqrt(f)) * Math.min(1, params.sun);
          g.fillStyle = waterGrad;
          g.fill();
          g.globalAlpha = 1;
          // Kick glints and hat sparkle: short dashes of sunlight scattered
          // on the water, not bands across it (bands read as road markings).
          const gl = this.gl[slot];
          const sp = e.hat * (0.5 + 0.5 * Math.sin(this.sparkPh[slot] + now * 9)) * (1 - f);
          const lit = gl + sp * 0.7;
          if (gl > 0.02) {
            // The patch of water the flash lands on.
            g.globalCompositeOperation = sch.night ? 'lighter' : 'source-over';
            g.fillStyle = rgba(sch.sun, Math.min(0.6, gl * 0.45) * alpha);
            g.fill();
            g.globalCompositeOperation = 'source-over';
          }
          if (lit > 0.02) {
            const xl = (px[jL] + qx[jL]) / 2, xr = (px[jR] + qx[jR]) / 2;
            const y0 = (py[jL] + py[jR] + qy[jL] + qy[jR]) / 4;
            const wv = xr - xl, rowH = Math.abs(qy[jL] - py[jL]);
            g.globalCompositeOperation = sch.night ? 'lighter' : 'source-over';
            g.strokeStyle = rgba(mix(sch.sun, sch.sunCore, clamp01(gl)), Math.min(1, lit * 1.1) * alpha);
            g.lineWidth = Math.max(0.8, Math.min(3.5, rowH * 0.45));
            g.beginPath();
            const ph = this.sparkPh[slot];
            const n = 2 + (gl > 0.15 ? 4 : 0);
            for (let i = 0; i < n; i++) {
              const u = 0.5 + 0.42 * Math.sin(ph * (i + 1) * 3.1 + i * 1.7);
              const len = wv * (0.08 + 0.14 * (0.5 + 0.5 * Math.sin(ph * 5 + i * 2.3)));
              const yy = y0 + rowH * 0.3 * Math.sin(ph * 2 + i);
              g.moveTo(xl + u * wv - len / 2, yy);
              g.lineTo(xl + u * wv + len / 2, yy);
            }
            g.stroke();
            g.globalCompositeOperation = 'source-over';
          }
        }

        // Land: this row filled down far enough to hide what is behind it.
        // Only to the next nearer row's water line, not the screen bottom:
        // that row covers everything below its own ridge, and stopping here
        // cut the fill overdraw by an order of magnitude.
        const yCut = s === first ? H + pad : Math.min(H + pad, horizon + camY * F / Math.max(0.05, z - DZ) + 3);
        g.beginPath();
        g.moveTo(-pad, py[0]);
        for (let j = 0; j <= jL; j++) g.lineTo(px[j], py[j]);
        g.lineTo(px[jL], yCut);
        g.lineTo(-pad, yCut);
        g.closePath();
        g.moveTo(px[jR], yCut);
        for (let j = jR; j < COLS; j++) g.lineTo(px[j], py[j]);
        g.lineTo(W + pad, py[COLS - 1]);
        g.lineTo(W + pad, yCut);
        g.closePath();
        // Lit from the low sun: the tops of hills and canyon walls catch the
        // light, the feet of them stay in shadow. A vertical gradient keyed
        // to world height does it without per-vertex colour.
        const gTop = horizon + (camY - (0.5 + 2.9 * canyon)) * inv;
        const gBot = horizon + camY * inv;
        const lg = g.createLinearGradient(0, gTop, 0, gBot);
        lg.addColorStop(0, rgba(mix(litC, sch.haze, fog * 0.96), alpha));
        lg.addColorStop(1, rgba(mix(sch.ground, sch.haze, fog * 0.96), alpha));
        g.fillStyle = lg;
        g.fill();

        // Rim: one line per row, brightest toward the sun, louder rows
        // brighter, fading into the haze.
        let loud = 0;
        for (let b = 0; b < BANDS; b++) loud += this.sig[slot * BANDS + b];
        loud = Math.min(1, loud / 420);
        const gl = this.gl[slot];
        const ra = alpha * (1 - 0.9 * fog) * smooth(0, 0.035, f) * (0.45 + 0.6 * loud + 1.3 * gl);
        if (ra > 0.01) {
          g.beginPath();
          g.moveTo(px[0], py[0]);
          for (let j = 1; j <= jL; j++) g.lineTo(px[j], py[j]);
          g.moveTo(px[jR], py[jR]);
          for (let j = jR + 1; j < COLS; j++) g.lineTo(px[j], py[j]);
          g.lineWidth = 0.6 + 0.7 * (1 - f);
          g.strokeStyle = rimGrad;
          g.globalAlpha = Math.min(1, ra);
          g.stroke();
          g.globalAlpha = 1;
        }

        const tx = this.qx, ty = this.qy;
        this.qx = px; this.qy = py;
        this.px = tx; this.py = ty;
        prevOk = true;
      }

      g.restore();
    },

    drawSky(g, W, H, horizon, sch, params, e, now, cx) {
      const pad = W * 0.3;
      let gr = g.createLinearGradient(0, -H * 0.1, 0, horizon);
      gr.addColorStop(0, rgba(sch.skyTop, 1));
      gr.addColorStop(0.65, rgba(sch.skyMid, 1));
      gr.addColorStop(1, rgba(sch.haze, 1));
      g.fillStyle = gr;
      g.fillRect(-pad, -H * 0.3, W + pad * 2, horizon + H * 0.3 + 2);
      // Below the horizon, before the land covers it.
      g.fillStyle = rgba(sch.haze, 1);
      g.fillRect(-pad, horizon, W + pad * 2, H - horizon + pad);

      // Stars in the upper sky; the hats light a changing handful.
      if (sch.night) {
        g.fillStyle = rgba(sch.star, 1);
        for (const s of this.stars) {
          const y = s.y * horizon * 0.85;
          const hi = s.tw > 0.72 ? e.hat * (0.5 + 0.5 * Math.sin(s.ph * 7 + now * 5)) : 0;
          const a = ((0.3 + 0.2 * Math.sin(now * 0.6 + s.ph)) + 0.9 * hi) * (1 - 0.8 * y / horizon);
          if (a <= 0.01) continue;
          g.globalAlpha = Math.min(1, a);
          const r = s.r * (1 + hi);
          g.fillRect(s.x * W - r / 2, y - r / 2, r, r);
        }
        g.globalAlpha = 1;
      }

      // Meteors on the claps: a thin streak with a bright head.
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        const u = (now - m.t0) / m.dur;
        if (u >= 1) { this.meteors.splice(i, 1); continue; }
        const hx = (m.x + m.dir * m.len * u) * W, hy = (m.y + 0.35 * m.len * u) * horizon;
        const tl = m.len * W * 0.6 * Math.min(1, u * 3);
        const tx = hx - m.dir * tl, ty = hy - 0.35 * tl * horizon / W;
        const a = Math.sin(Math.PI * u) * (sch.night ? 0.9 : 0.55);
        const lg = g.createLinearGradient(tx, ty, hx, hy);
        lg.addColorStop(0, rgba(sch.meteor, 0));
        lg.addColorStop(1, rgba(sch.meteor, a));
        g.strokeStyle = lg;
        g.lineWidth = sch.night ? 1.4 : 2;
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      }

      // The sun sits low in the notch of the valley; the bass swells it.
      const r = H * 0.07 * params.sun * (0.85 + 0.35 * e.bass);
      if (r > 0.5) {
        const sy = horizon - r * 0.35;
        const glowR = r * (3.2 + 1.2 * e.bass);
        gr = g.createRadialGradient(cx, sy, r * 0.7, cx, sy, glowR);
        gr.addColorStop(0, rgba(sch.sun, sch.night ? 0.32 + 0.18 * e.bass : 0.35));
        gr.addColorStop(1, rgba(sch.sun, 0));
        g.fillStyle = gr;
        g.fillRect(cx - glowR, sy - glowR, glowR * 2, glowR * 2);
        gr = g.createLinearGradient(0, sy - r, 0, sy + r);
        gr.addColorStop(0, rgba(sch.sunCore, 1));
        gr.addColorStop(1, rgba(sch.sun, 1));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, sy, r, 0, Math.PI * 2);
        g.fill();
      }
    },
  });
})();
