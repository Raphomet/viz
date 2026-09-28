// Scanlines V2 — a Rutt/Etra scan processor flown like a landscape, now with
// one phosphor at a time, a dive for the drop, and one landscape per section.
//
// V1 (web/scenes/scanlines.js) is unchanged; see harness/v2/scanlines.md for
// why each change was made. In short: V1's intro and breakdown (mono phosphor
// on black) were its best frames and its drop (three hue-rotated channels and
// a woven column grid) its weakest, a synthwave mesh with rainbow fringes. So
// the drop no longer changes the finish; it changes the place. The camera
// comes down out of the sky and flies low and fast between the ridges, and
// climbs back up for the breakdown.
//
// Layers, back to front: a dim CRT raster and horizon glow; a scanned planet in
// the accent ink; the terrain raster, drawn far to near with a translucent
// black under every line so nearer ridges hide farther ones; a mist over the
// far edge so the land dissolves into sky; hat glints; phosphor persistence.
//
// Music, each in its own place:
// - kick: a ripple ring dropped at one spot on the terrain, a new spot each
//   beat, that lifts the lines it crosses and lights them in the accent;
// - snare: a retrace front sweeps the raster from the horizon toward the
//   viewer, re-colouring the lines it crosses toward the accent;
// - section change (entering or leaving the drop): the same front carries a
//   new hidden image and its phosphor, so each section is one landscape;
// - bass: relief and flying speed (eased, never jerked);
// - bands: each band wiggles its own group of lines by depth;
// - hats: glints on the lines;
// - drop: the dive (low, fast, towering relief), the sky takes the accent, and
//   the accent ghosts faintly under every line like a misconverged CRT.
(function () {
  const TAU = Math.PI * 2;
  const COLS = 150;                  // samples along each scan line
  const X_EXT = 2.3;                 // terrain half-width, world units
  const Z_NEAR = -1.65, Z_FAR = 2.3;  // terrain depth range relative to the camera target
  const IMAGES = ['Ridges', 'Pond', 'Lattice', 'Dunes', 'Vortex'];
  // One two-ink chord per hidden image: the phosphor, and the one accent that
  // lights the planet, the kick ring and the drop's ghost. Fixed pairs rather
  // than V1's hue-rotated triads, which were hue cycling by another name.
  const CHORDS = [
    [[70, 255, 140], [255, 214, 140]],   // Ridges: P31 green, gold
    [[255, 168, 60], [140, 205, 255]],   // Pond: P3 amber, ice
    [[120, 195, 255], [255, 130, 165]],  // Lattice: P4 ice, rose
    [[190, 130, 255], [255, 190, 90]],   // Dunes: violet, amber
    [[255, 105, 170], [90, 230, 210]],   // Vortex: rose, teal
  ];
  // The Phosphor control's fixed choices; White is Flyover's white-on-black,
  // with one red accent.
  const FIXED = [null, CHORDS[0], CHORDS[1], CHORDS[2], [[232, 232, 226], [255, 72, 52]]];
  // Section landscapes. The drop is a low flight, so it gets the images with
  // something to fly between (the ridges above all, then the whirlpools); the
  // rest sections get the calm, even ones. Each list walks in order, so a
  // drop and the breakdown after it never share a landscape or a phosphor.
  const DROP_IMAGES = [0, 4];        // Ridges, Vortex
  const REST_IMAGES = [2, 3, 1];     // Lattice, Dunes, Pond
  const PERSIST = 0.5;               // V1's default phosphor persistence
  const FALLBACK = 30;               // seconds without a section before a snare may switch

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }

  // ---- value noise (own implementation: p.noise is too slow for ~20k
  // samples a frame and would share its seed with other visuals)
  function hash2(i, j) {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, oct) {
    let s = 0, amp = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { s += amp * vnoise(x, y); n += amp; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; amp *= 0.5; }
    return s / n;
  }
  function ridged(x, y) {
    let s = 0, amp = 0.55, n = 0;
    for (let o = 0; o < 4; o++) {
      const v = 1 - Math.abs(2 * vnoise(x, y) - 1);
      s += amp * v * v; n += amp; x = x * 2.1 + 5.3; y = y * 2.1 + 1.9; amp *= 0.5;
    }
    return s / n;
  }

  // ---- the hidden images (unchanged from V1). f(x, z, t) -> roughly 0..1,
  // where z is the world coordinate along the direction of travel.
  const FIELDS = [
    (x, z, t) => Math.pow(ridged(x * 1.15 + 3, z * 1.15), 1.4) * 1.25,
    (x, z, t) => {
      const cell = Math.floor(z / 1.5);
      let s = 0;
      for (let k = cell - 1; k <= cell + 1; k++) {
        const cx = (hash2(k, 7) * 2 - 1) * 1.1, cz = (k + 0.5) * 1.5 + (hash2(k, 3) - 0.5) * 0.6;
        const d = Math.hypot(x - cx, z - cz);
        s += (0.5 + 0.5 * Math.cos(d * 26 - t * 2.4)) * Math.exp(-d * 2.2);
      }
      return 0.05 + 0.8 * s + 0.45 * fbm(x * 1.3 + 8, z * 1.3, 3);
    },
    (x, z, t) => {
      const w = 0.55 + 0.45 * fbm(x * 0.8, z * 0.8 + 40, 2);
      const b = Math.sin(x * 8.5 + 0.3 * Math.sin(z * 2 + t * 0.3)) * Math.sin(z * 8.5);
      return 0.15 + 0.85 * w * Math.pow(Math.max(0, b), 1.2);
    },
    (x, z, t) => {
      const s = x * 0.55 + z * 0.84 + 0.35 * fbm(x * 1.2, z * 1.2 + 11, 3);
      const r = 0.5 + 0.5 * Math.sin(s * 11 + t * 0.2);
      return 0.1 + 0.8 * r * r * r * (0.5 + 0.5 * fbm(x * 0.7 + 3, z * 0.7, 2)) + 0.1;
    },
    (x, z, t) => {
      const cell = Math.floor(z / 2.2);
      let s = 0;
      for (let k = cell - 1; k <= cell + 1; k++) {
        const cx = (hash2(k, 11) * 2 - 1) * 0.9, cz = (k + 0.5) * 2.2;
        const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz) + 1e-4;
        const arm = 0.5 + 0.5 * Math.cos(5 * Math.atan2(dz, dx) + Math.log(r) * 9 - t * 0.9 * (k & 1 ? 1 : -1));
        // Wider calm centre than V1 (0.15): the arms' phase runs away near r = 0,
        // and seen low in the dive the undersampled centre read as a crown of spikes.
        s += arm * Math.exp(-r * 1.3) * smooth(0.0, 0.32, r);
      }
      return 0.1 + s * 1.1;
    },
  ];

  VIZ.register({
    id: 'scanlinesv2',
    name: 'Scanlines',
    versionOf: 'scanlines',
    version: 'V2',
    order: 706,

    params: [
      { key: 'image', label: 'Hidden image', type: 'select',
        options: ['Changes each section', ...IMAGES], default: 0 },
      { key: 'phosphor', label: 'Phosphor', type: 'select',
        options: ['Follows the image', 'Green', 'Amber', 'Ice', 'White'], default: 0 },
      { key: 'dive', label: 'Drop dive', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'speed', label: 'Flying speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'rows', label: 'Scan lines', type: 'range', min: 40, max: 140, default: 92, step: 1 },
      { key: 'relief', label: 'Relief', type: 'range', min: 0.2, max: 2, default: 1, step: 0.01 },
      { key: 'turn', label: 'Camera turn', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'react', label: 'Reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    gallery: {
      title: 'Scanlines',
      technique: 'Canvas 2D: a Rutt/Etra raster (scan lines displaced by a procedural hidden image) projected in perspective by hand, painter-ordered with translucent occluders, one phosphor plus one accent ink, camera altitude driven by the section, horizon mist, phosphor persistence',
      brief: 'An analogue video synthesiser flown like a landscape, in one phosphor at a time. Glowing scan lines lie over a hidden image (mountains, a raindrop pond, a lattice of bubbles, dunes, whirlpools) and rise over its shapes while the camera flies over it and the raster slowly turns; a scanned planet in the accent ink hangs in the sky. Each kick drops a ripple ring at one spot of the terrain that lifts the lines it crosses and lights them in the accent; each snare sends a retrace front from the horizon to the viewer. Every section is its own landscape: entering the drop and leaving it each roll in a new hidden image and phosphor behind that front. The drop is a dive: the camera comes down to fly low and fast between towering ridges, the sky takes the accent colour and the accent ghosts faintly under the lines; the breakdown climbs back to the wide, slow view.',
      lineage: [
        'V2 of Scanlines (web/scenes/scanlines.js, batch 3, ranked #6 of 72). Kept: the flight, the five hidden images, the travelling kick ring every judge praised, the snare retrace front, band wiggles by depth, hat glints, the scanned planet, the occluders.',
        'Curator: palette-per-section is hue cycling by other means, and Chladni-style section changes should change the hidden image instead. Reinterpreted: each image keeps its phosphor (three judges credited it for longevity) but the drop\'s three hue-rotated channels are gone; each phosphor gets one fixed accent, and a single-phosphor control is offered. The image now changes at section changes (the drop arriving and leaving), not on any snare past a hold, so each section is one landscape (also the director\'s "a new chapter every drop").',
        'Floor theme 1 and curator transplant 10 (the drop as a place you enter): the drop is a dive, camera altitude and pitch eased down to fly low between the ridges, and back up for the breakdown. The column weave and channel split, which read as a synthwave mesh, are removed.',
        'Psychonaut theme 4 (the confined kick still clips to white): the ring core and its bloom are the accent, pale but never pure white. Curator merge 13: Flyover\'s white-on-black is the White phosphor, with one red accent. Horizon mist hides V1\'s far-edge shelf.',
        'Rejected: the purist\'s phase-echo kick (the ring already travels; a second travelling kick would compete with it).',
        'Built: the drop draws its landscape from Ridges and Vortex (something to fly between) and rest sections from Lattice, Dunes and Pond, so it opens on the ice lattice and dives into green ridges under a gold sky. Near rows fade by distance so the dive never cuts stubs at the near plane; Vortex\'s calm centre widened so it does not read as a crown of spikes. Jolt: calm, kickArea 0.40, ratio 1.13 (V1 0.21, 1.07); the added area is the low flight itself, not the kick.',
      ],
    },

    enter(p) {
      this.clock = 0;
      this.lastMs = null;
      this.S = 0;                           // distance flown
      this.env = { bass: 0, pad: 0, high: 0, dive: 0, lastKick: -9, lastSnare: -9, lastHat: -9,
        b: new Float32Array(9) };
      this.hist = { k: [0, 0, 0, 0], c: [0, 0, 0, 0], h: [0, 0, 0] };
      this.kickTimes = [];
      this.ripples = [];
      this.fronts = [];
      this.glints = [];
      this.dropN = 0; this.restN = 0;
      this.img = REST_IMAGES[0]; this.prevImg = this.img;
      this.switchAt = 0;
      this.wipe = null;
      this.inDrop = false;
      this.pending = -1;                    // time a section change asked for a new image
      this.kickN = 0;
      this.rng = 1234567;
      this.cleared = false;
    },

    rand() {
      // Own LCG so the scene is deterministic whatever else calls Math.random.
      this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
      return this.rng / 4294967296;
    },

    listen(sig, dt, now) {
      const e = this.env, H = this.hist;
      const ev = { kick: 0, snare: false, hats: 0 };
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
      if (h - hMin > 0.18 && h > 0.25 && now - e.lastHat > 0.07) { e.lastHat = now; ev.hats = h; }
      H.h.shift(); H.h.push(h);

      e.bass = ease(e.bass, (sig[1] + sig[2]) / 200, 1.6, dt);
      e.pad = ease(e.pad, (sig[2] + sig[3] + sig[4]) / 300, 0.8, dt);
      e.high = ease(e.high, (sig[6] + sig[7] + sig[8]) / 300, 3, dt);
      for (let i = 0; i < 9; i++) e.b[i] = ease(e.b[i], sig[i] / 100, i < 3 ? 1.5 : 2 + i * 1.2, dt);
      while (this.kickTimes.length && now - this.kickTimes[0] > 2.5) this.kickTimes.shift();

      // Section detector. A build's kicks alone must not count as the drop
      // (V1's kick-count envelope was already high by 8 s), so the drop also
      // needs the bass line under it; it ends as soon as the kicks stop,
      // because waiting for the envelope to decay put the breakdown's change
      // into the next intro.
      ev.section = 0;
      if (!this.inDrop && this.kickTimes.length >= 4 && e.bass > 0.28) { this.inDrop = true; ev.section = 1; }
      else if (this.inDrop && now - e.lastKick > 1.1) { this.inDrop = false; ev.section = -1; }
      return ev;
    },

    switchImage(now, carrier) {
      this.prevImg = this.img;
      this.img = this.inDrop ? DROP_IMAGES[this.dropN++ % DROP_IMAGES.length]
        : REST_IMAGES[++this.restN % REST_IMAGES.length];
      // A fallback switch (no sections) inside one list may land on itself.
      if (this.img === this.prevImg) this.img = this.inDrop ? DROP_IMAGES[this.dropN++ % DROP_IMAGES.length]
        : REST_IMAGES[++this.restN % REST_IMAGES.length];
      this.switchAt = now;
      const f = carrier || { t0: now, sw: true };
      f.sw = true;
      if (!carrier) this.fronts.push(f);
      this.wipe = f;
      if (this.fronts.length > 4) this.fronts.shift();
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter(p);
      const g = p.drawingContext;
      const W = ctx.width, Ht = ctx.height;
      const ms = p.millis();
      const now = ms / 1000;
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const react = params.react;
      const ev = this.listen(signals, dt, now);
      const e = this.env;
      this.clock += dt;
      const T = this.clock;

      // The dive: in quickly enough to land with the drop (about a bar), out
      // slowly so the breakdown is a long climb, never a jump.
      const diveTarget = this.inDrop ? 1 : 0;
      e.dive = ease(e.dive, diveTarget, diveTarget > e.dive ? 1.5 : 0.45, dt);
      const dive = e.dive * params.dive;
      const dv = Math.min(1, dive);

      // ---- motion: flying speed follows the bass level, eased; the dive
      // flies faster, and being low makes it feel faster still.
      const speed = params.speed * (0.16 + 0.34 * e.bass * Math.min(1.5, react) + 0.1 * dive);
      this.S += speed * dt;
      const S = this.S;

      // Camera: slow incommensurate turns; altitude and pitch drop in the dive.
      const tr = params.turn;
      const yaw = tr * (0.2 * Math.sin(T * 0.071) + 0.08 * Math.sin(T * 0.19 + 1));
      const pitch = 0.44 - 0.2 * dive + tr * (0.1 * Math.sin(T * 0.053 + 2) + 0.03 * Math.sin(T * 0.13)) * (1 - 0.5 * dv);
      const roll = tr * (0.045 + 0.03 * dv) * Math.sin(T * 0.061 + 0.5);
      const cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const D = 2.3 - 0.55 * dive;
      const F = Math.max(0.86 * Ht, 0.52 * W);
      const cx = W / 2, cyS = Ht * (0.53 - 0.07 * dive);

      // ---- events
      if (ev.kick && react > 0) {
        this.kickN++;
        const a = this.kickN * 2.39996 + this.rand() * 0.6;
        const x0 = 0.75 * Math.cos(a);
        const z0 = -0.1 + 0.55 * Math.sin(a * 1.3) + S;
        this.ripples.push({ t0: now, x: x0, z: z0, amp: ev.kick * react });
        if (this.ripples.length > 5) this.ripples.shift();
      }
      const imgMode = params.image | 0;
      if (imgMode === 0) {
        // Entering the drop: the next clap carries the new landscape in (the
        // clap lands within a bar); leaving it: the change goes at once,
        // because a breakdown has no snare to carry it.
        if (ev.section === 1) this.pending = now;
        if (ev.section === -1) { this.pending = -1; this.switchImage(now, null); }
      }
      if (ev.snare) {
        const f = { t0: now, sw: false };
        this.fronts.push(f);
        if (this.fronts.length > 4) this.fronts.shift();
        if (imgMode === 0 && (this.pending >= 0 || now - this.switchAt > FALLBACK)) {
          this.pending = -1; this.switchImage(now, f);
        }
      }
      if (this.pending >= 0 && now - this.pending > 0.9) { this.pending = -1; this.switchImage(now, null); }
      if (imgMode > 0 && this.img !== imgMode - 1) {
        this.prevImg = this.img; this.img = imgMode - 1; this.switchAt = now;
        this.wipe = { t0: now, sw: true }; this.fronts.push(this.wipe);
      }
      if (ev.hats && react > 0) {
        const n = 2 + Math.floor(ev.hats * 4 * Math.min(1.5, react));
        for (let i = 0; i < n; i++) {
          this.glints.push({ t0: now, x: (this.rand() * 2 - 1) * 1.5, z: S + Z_NEAR + 0.6 + this.rand() * 1.9,
            a: 0.6 + 0.4 * this.rand() });
        }
        while (this.glints.length > 40) this.glints.shift();
      }
      this.ripples = this.ripples.filter((r) => now - r.t0 < 1.4);
      this.fronts = this.fronts.filter((f) => now - f.t0 < 1.6);
      this.glints = this.glints.filter((q) => now - q.t0 < 0.5);
      const FRONT_DUR = 1.3;
      const frontPos = (f) => Z_FAR + 0.1 - (Z_FAR - Z_NEAR + 0.3) * clamp01((now - f.t0) / FRONT_DUR);
      if (this.wipe && now - this.wipe.t0 > FRONT_DUR + 0.2) this.wipe = null;
      const wipeZ = this.wipe ? frontPos(this.wipe) : -99;

      // ---- clear with persistence
      if (!this.cleared) { p.background(0); this.cleared = true; }
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,' + (1 - PERSIST * 0.85).toFixed(3) + ')';
      g.fillRect(-2, -2, W + 4, Ht + 4);

      g.translate(cx, cyS);
      g.rotate(roll);

      const pm = params.phosphor | 0;
      const chordNew = pm > 0 ? FIXED[pm] : CHORDS[this.img];
      const chordOld = pm > 0 ? FIXED[pm] : CHORDS[this.prevImg];
      const tintNew = chordNew[0], accNew = chordNew[1];
      const tintOld = chordOld[0], accOld = chordOld[1];

      // ---- sky: faint CRT raster, horizon glow (the accent comes in with the
      // dive, so the sky changes colour at the drop), scanned planet.
      const horizonY = F * (Z_FAR * sp) / (D + Z_FAR * cp);
      const skyTop = -cyS - 40;
      g.globalCompositeOperation = 'lighter';
      const skyCol = mix(tintNew, accNew, dv);
      const glow = g.createLinearGradient(0, -horizonY - 10, 0, skyTop);
      const gl0 = 0.1 + 0.12 * e.pad + 0.06 * dv;
      glow.addColorStop(0, rgba(skyCol, gl0));
      glow.addColorStop(0.35, rgba(skyCol, gl0 * 0.3));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(-W, skyTop, W * 2, Ht * 1.5);
      g.strokeStyle = rgba(tintNew, 0.05);
      g.lineWidth = 0.8;
      g.beginPath();
      for (let y = skyTop; y < -horizonY + 20; y += 4) { g.moveTo(-W, y); g.lineTo(W, y); }
      g.stroke();

      // Planet: a Rutt/Etra ball in the accent ink.
      {
        const R = 70 + 12 * e.pad * react;
        const px = W * 0.22 * Math.sin(T * 0.023 + 1) + 0.12 * W;
        const py = Math.max(-cyS + R + 14, -horizonY - R * 0.7 + 14 * Math.sin(T * 0.031));
        const rot = T * 0.12 + S * 0.3;
        const nL = 30;
        g.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          g.lineWidth = pass === 0 ? 4 : 1.1;
          g.beginPath();
          for (let i = 1; i < nL; i++) {
            const lat = -1 + (2 * i) / nL;
            const halfW = R * Math.sqrt(1 - lat * lat);
            const yb = py + lat * R;
            const phi = Math.asin(lat);
            for (let j = 0; j <= 40; j++) {
              const u = -1 + (2 * j) / 40;
              const lon = Math.asin(u) + rot;
              const tex = fbm(Math.cos(lon) * 1.6 + 4, Math.sin(lon) * 1.6 + phi * 3, 3);
              const bands = 0.5 + 0.5 * Math.sin(phi * 9 + tex * 5);
              const lift = (tex * 0.6 + bands * 0.4) * 9 * Math.sqrt(1 - u * u);
              const X = px + u * halfW, Y = yb - lift;
              if (j === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
            }
          }
          g.strokeStyle = rgba(accNew, pass === 0 ? 0.07 + 0.05 * e.pad : 0.5 + 0.2 * e.pad);
          g.stroke();
        }
      }

      // ---- terrain grid
      const rowsN = Math.round(params.rows);
      const dz = (Z_FAR - Z_NEAR) / (rowsN - 1);
      const k0 = Math.ceil((S + Z_NEAR) / dz);
      const nR = Math.floor((S + Z_FAR) / dz) - k0 + 1;
      const N = nR * COLS;
      if (!this.sx || this.sx.length < N) {
        this.sx = new Float32Array(N + COLS * 8); this.sy = new Float32Array(N + COLS * 8);
        this.ok = new Uint8Array(N + COLS * 8); this.hot = new Float32Array(N + COLS * 8);
      }
      const sxA = this.sx, syA = this.sy, okA = this.ok, hotA = this.hot;
      const relief = params.relief * (0.26 + 0.12 * e.bass * Math.min(1.5, react)) * (1 + 0.45 * dive);
      const fNew = FIELDS[this.img], fOld = FIELDS[this.prevImg];
      const ripples = this.ripples;
      const rowInfo = [];
      const bandAmp = [];
      for (let b = 0; b < 9; b++) bandAmp.push(e.b[b] * react * (0.05 - b * 0.003));
      for (let r = 0; r < nR; r++) {
        const zw = (k0 + r) * dz;
        const zl = zw - S;
        const depth01 = (zl - Z_NEAR) / (Z_FAR - Z_NEAR);
        const mNew = this.wipe ? smooth(wipeZ - 0.12, wipeZ + 0.12, zl) : 1;
        const bf = depth01 * 8, b0 = Math.min(7, Math.floor(bf)), bt = bf - b0;
        const wig = bandAmp[b0] * (1 - bt) + bandAmp[b0 + 1] * bt;
        const wfreq = 3 + bf * 2.2;
        let fr = 0;
        for (const f of this.fronts) {
          const d = zl - frontPos(f);
          fr = Math.max(fr, Math.exp(-(d * d) / 0.012) * (1 - clamp01((now - f.t0 - FRONT_DUR) / 0.4)));
        }
        const info = { zl, depth01, mNew, fr, near: 1 };
        rowInfo.push(info);
        for (let c = 0; c < COLS; c++) {
          // Wider with distance than V1 (1.7), so the side edges stay off
          // screen under the dive's lower pitch and the extra roll.
          const x = (-1 + (2 * c) / (COLS - 1)) * X_EXT * (1 + 2.4 * depth01);
          const hv = mNew >= 1 ? fNew(x, zw, T) : mNew <= 0 ? fOld(x, zw, T)
            : fOld(x, zw, T) * (1 - mNew) + fNew(x, zw, T) * mNew;
          let y = relief * (hv - 0.35);
          y += wig * Math.sin(x * wfreq + T * (1.3 + bf * 0.5) + r * 0.7);
          let hot = 0;
          for (let q = 0; q < ripples.length; q++) {
            const rp = ripples[q];
            const age = now - rp.t0;
            const rad = 0.06 + age * 0.95;
            const d = Math.hypot(x - rp.x, zw - rp.z) - rad;
            const w = 0.07 + age * 0.05;
            const fall = Math.exp(-age / 0.33) * rp.amp;
            const ring = Math.exp(-(d * d) / (w * w)) * fall;
            y += 0.09 * ring;
            hot = Math.max(hot, ring);
          }
          const xr = x * cy0 - zl * sy0, zr = x * sy0 + zl * cy0;
          const yc = y * cp + zr * sp;
          const zc = -y * sp + zr * cp + D;
          const i = r * COLS + c;
          if (zc < 0.35) { okA[i] = 0; continue; }
          okA[i] = 1;
          sxA[i] = F * xr / zc;
          syA[i] = -F * yc / zc;
          hotA[i] = hot;
        }
        // In the dive the nearest rows pass within the near plane and get cut,
        // leaving stubs hanging in the foreground; fade each row out by its
        // own distance first. (By the row's nearest point instead, one peak
        // blacked out the whole foreground.)
        info.near = smooth(0.36, 0.62, zl * cp + D);
      }

      // ---- draw terrain far to near
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const trace = (r, dy) => {
        let pen = false;
        const base = r * COLS;
        for (let c = 0; c < COLS; c++) {
          const i = base + c;
          if (!okA[i]) { pen = false; continue; }
          if (pen) g.lineTo(sxA[i], syA[i] + dy); else { g.moveTo(sxA[i], syA[i] + dy); pen = true; }
        }
      };
      const bottom = Ht * 0.6 + 60;
      for (let r = nR - 1; r >= 0; r--) {
        const info = rowInfo[r];
        const fadeFar = 1 - smooth(0.68, 1, info.depth01);
        const fadeNear = smooth(0, 0.05, info.depth01);
        const fog = 0.22 + 0.78 * Math.pow(1 - info.depth01, 1.1);
        const vis = fadeFar * fadeNear * info.near;
        if (vis <= 0.001) continue;

        g.globalCompositeOperation = 'source-over';
        g.beginPath();
        let first = -1, last = -1;
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (!okA[i]) continue;
          if (first < 0) { g.moveTo(sxA[i], syA[i]); first = i; } else g.lineTo(sxA[i], syA[i]);
          last = i;
        }
        if (first >= 0) {
          g.lineTo(sxA[last], bottom); g.lineTo(sxA[first], bottom); g.closePath();
          g.fillStyle = 'rgba(0,0,0,' + (0.82 * vis).toFixed(3) + ')';
          g.fill();
        }

        g.globalCompositeOperation = 'lighter';
        const m = info.mNew;
        let col = m >= 1 ? tintNew : mix(tintOld, tintNew, m);
        const acc = m >= 1 ? accNew : mix(accOld, accNew, m);
        // The retrace front re-colours the lines it crosses toward the accent.
        const fr = Math.min(1, info.fr * Math.min(1.2, react));
        if (fr > 0.01) col = mix(col, acc, fr);
        const bright = vis * fog * (0.72 + 0.28 * e.bass) * (1 + 0.8 * fr);
        const near = 1 - info.depth01;
        const lw = 0.8 + 1.1 * near + 0.5 * dv * near;

        // The drop's only chromatic device: the accent ghosted a little below
        // the line, as on a misconverged tube. Two inks, never a spectrum.
        if (dv > 0.03) {
          g.beginPath();
          trace(r, (1 + 3 * near) * dv);
          g.lineWidth = lw;
          g.strokeStyle = rgba(acc, 0.3 * dv * bright);
          g.stroke();
        }
        g.beginPath();
        trace(r, 0);
        g.lineWidth = lw * 4;
        g.strokeStyle = rgba(col, 0.13 * bright);
        g.stroke();
        g.lineWidth = lw;
        g.strokeStyle = rgba(col, 0.95 * bright);
        g.stroke();

        // Kick: the segments a ripple is crossing, thick and lit in the accent.
        let hmax = 0;
        for (let c = 0; c < COLS; c++) { const hv = hotA[r * COLS + c]; if (hv > hmax) hmax = hv; }
        if (hmax > 0.08) {
          g.beginPath();
          let pen = false;
          for (let c = 0; c < COLS; c++) {
            const i = r * COLS + c;
            if (!okA[i] || hotA[i] < 0.08) { pen = false; continue; }
            if (pen) g.lineTo(sxA[i], syA[i]); else { g.moveTo(sxA[i], syA[i]); pen = true; }
          }
          const ha = Math.min(1, hmax * 1.5) * vis * Math.sqrt(fog);
          g.lineWidth = lw * 6;
          g.strokeStyle = rgba(acc, 0.28 * ha);
          g.stroke();
          g.lineWidth = lw * 1.6;
          // Pale accent, not white: a white core read as a flashbulb.
          g.strokeStyle = rgba(mix(acc, [255, 250, 240], 0.45), 0.95 * ha);
          g.stroke();
        }
      }

      // ---- horizon mist: laid over the far rows, so the land thins into
      // the sky instead of ending in V1's lit shelf.
      {
        const hy = -horizonY;
        const mist = g.createLinearGradient(0, hy - 26, 0, hy + 70);
        mist.addColorStop(0, 'rgba(0,0,0,0)');
        mist.addColorStop(0.3, rgba(skyCol, 0.07 + 0.05 * e.pad));
        mist.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = mist;
        g.fillRect(-W, hy - 26, W * 2, 96);
      }

      // ---- kick impact: a soft bloom at the spot, gone in a quarter second.
      for (const rp of this.ripples) {
        const age = now - rp.t0;
        if (age > 0.6) continue;
        const zl = rp.z - S;
        const y = relief * (FIELDS[this.img](rp.x, rp.z, T) - 0.35) + 0.05 * rp.amp;
        const xr = rp.x * cy0 - zl * sy0, zr = rp.x * sy0 + zl * cy0;
        const zc = -y * sp + zr * cp + D;
        if (zc < 0.4) continue;
        const X = F * xr / zc, Y = -F * (y * cp + zr * sp) / zc;
        const a = Math.min(1, rp.amp) * Math.exp(-age / 0.16);
        const rad = Math.min(120, (40 + 50 * age) * (2 / zc));
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, rgba(mix(accNew, [255, 250, 240], 0.4), 0.38 * a));
        gr.addColorStop(0.3, rgba(accNew, 0.16 * a));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(X, Y, rad, rad * 0.55, 0, 0, TAU); g.fill();
      }

      // ---- hat glints: small four-point stars riding on the lines
      for (const q of this.glints) {
        const age = now - q.t0;
        const zl = q.z - S;
        if (zl < Z_NEAR || zl > Z_FAR) continue;
        const y = relief * (FIELDS[this.img](q.x, q.z, T) - 0.35);
        const xr = q.x * cy0 - zl * sy0, zr = q.x * sy0 + zl * cy0;
        const zc = -y * sp + zr * cp + D;
        if (zc < 0.4) continue;
        const X = F * xr / zc, Y = -F * (y * cp + zr * sp) / zc;
        const a = q.a * Math.exp(-age / 0.12) * Math.min(1.3, react);
        const len = Math.min(30, (6 + 14 * a) * (2 / zc));
        g.lineWidth = 1;
        g.strokeStyle = rgba([255, 255, 255], 0.8 * a);
        g.beginPath();
        g.moveTo(X - len, Y); g.lineTo(X + len, Y); g.moveTo(X, Y - len * 0.6); g.lineTo(X, Y + len * 0.6);
        g.stroke();
        g.fillStyle = rgba(accNew, 0.22 * a);
        g.beginPath(); g.arc(X, Y, len * 0.45, 0, TAU); g.fill();
      }

      g.restore();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    },
  });
})();
