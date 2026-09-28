// Scanlines — a Rutt/Etra scan processor flown like a landscape.
//
// The Rutt/Etra (1972) took a video raster and bent each horizontal scan line
// up by the brightness under it, so a picture became a relief of glowing
// lines on a vector monitor. Here the "picture" is a procedural image that
// never ends in one direction, the raster lies on it like a ground plane, and
// the camera flies over it: every scan line is a row fixed to the image, so
// the lines themselves travel toward the viewer, rise over the hidden shapes
// and leave off the bottom of the frame.
//
// Layers, back to front: a dim CRT raster and horizon glow; a scanned planet
// whose own hidden image turns as it rotates; the terrain raster, drawn far to
// near with a translucent black under every line so nearer ridges hide farther
// ones (the one liberty taken with the original, which was all see-through);
// hat glints riding on the lines; phosphor persistence over everything.
//
// Music, each in its own place:
// - kick: a ripple ring dropped at one spot on the terrain, a new spot each
//   beat, that lifts and whitens only the lines it is crossing;
// - snare: a retrace front sweeps the raster from the horizon toward the
//   viewer, re-colouring the lines it crosses; when the hold allows, the hidden
//   image behind the front is switched, so the new picture rolls in with it;
// - bass: relief and flying speed (eased, never jerked);
// - bands: each band has its own group of lines by depth (bass nearest,
//   treble at the horizon) and wiggles them at its own wavelength;
// - hats: glints that sparkle on the lines;
// - drop: the phosphor splits into three separated colour channels and a
//   second raster (the columns) weaves through the first.
(function () {
  const TAU = Math.PI * 2;
  const COLS = 150;                  // samples along each scan line
  const X_EXT = 2.3;                 // terrain half-width, world units
  const Z_NEAR = -1.65, Z_FAR = 2.3;  // terrain depth range relative to the camera target
  const IMAGES = ['Ridges', 'Pond', 'Lattice', 'Dunes', 'Vortex'];
  // One phosphor per hidden image: P31 green, P3 amber, P4 ice, violet, rose.
  const TINTS = [[70, 255, 140], [255, 168, 60], [120, 195, 255], [190, 120, 255], [255, 105, 170]];
  const HOLD = 3.6;                  // seconds an image must show before a snare may switch it

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  // Hue rotation of an RGB triple (degrees), for the drop's channel triad.
  function hueRot(c, deg) {
    const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const k = 1 / 3, sq = Math.sqrt(1 / 3);
    const m0 = cs + (1 - cs) * k, m1 = k * (1 - cs) - sq * sn, m2 = k * (1 - cs) + sq * sn;
    const r = c[0] * m0 + c[1] * m1 + c[2] * m2;
    const g = c[0] * m2 + c[1] * m0 + c[2] * m1;
    const b = c[0] * m1 + c[1] * m2 + c[2] * m0;
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
  }
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

  // ---- the hidden images. f(x, z, t) -> roughly 0..1, where z is the world
  // coordinate along the direction of travel (unbounded) and t the drift clock.
  const FIELDS = [
    // Ridges: a mountain range.
    (x, z, t) => Math.pow(ridged(x * 1.15 + 3, z * 1.15), 1.4) * 1.25,
    // Pond: raindrop rings from centres strung along the flight path.
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
    // Lattice: an egg-crate of bubbles whose size breathes across the field.
    (x, z, t) => {
      const w = 0.55 + 0.45 * fbm(x * 0.8, z * 0.8 + 40, 2);
      const b = Math.sin(x * 8.5 + 0.3 * Math.sin(z * 2 + t * 0.3)) * Math.sin(z * 8.5);
      return 0.15 + 0.85 * w * Math.pow(Math.max(0, b), 1.2);
    },
    // Dunes: long crescent ridges on a diagonal.
    (x, z, t) => {
      const s = x * 0.55 + z * 0.84 + 0.35 * fbm(x * 1.2, z * 1.2 + 11, 3);
      const r = 0.5 + 0.5 * Math.sin(s * 11 + t * 0.2);
      return 0.1 + 0.8 * r * r * r * (0.5 + 0.5 * fbm(x * 0.7 + 3, z * 0.7, 2)) + 0.1;
    },
    // Vortex: spiral arms around whirlpools strung along the path.
    (x, z, t) => {
      const cell = Math.floor(z / 2.2);
      let s = 0;
      for (let k = cell - 1; k <= cell + 1; k++) {
        const cx = (hash2(k, 11) * 2 - 1) * 0.9, cz = (k + 0.5) * 2.2;
        const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz) + 1e-4;
        const arm = 0.5 + 0.5 * Math.cos(5 * Math.atan2(dz, dx) + Math.log(r) * 9 - t * 0.9 * (k & 1 ? 1 : -1));
        s += arm * Math.exp(-r * 1.3) * smooth(0.0, 0.15, r);
      }
      return 0.1 + s * 1.1;
    },
  ];

  VIZ.register({
    id: 'scanlines',
    name: 'Scanlines',
    order: 304,

    params: [
      { key: 'image', label: 'Hidden image', type: 'select',
        options: ['Snare switches', ...IMAGES], default: 0 },
      { key: 'speed', label: 'Flying speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'rows', label: 'Scan lines', type: 'range', min: 40, max: 140, default: 92, step: 1 },
      { key: 'relief', label: 'Relief', type: 'range', min: 0.2, max: 2, default: 1, step: 0.01 },
      { key: 'turn', label: 'Camera turn', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'chroma', label: 'Colour', type: 'select',
        options: ['Follows the music', 'Mono phosphor', 'Full chroma + weave'], default: 0 },
      { key: 'persist', label: 'Phosphor persistence', type: 'range', min: 0, max: 0.9, default: 0.5, step: 0.01 },
      { key: 'react', label: 'Reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    gallery: {
      title: 'Scanlines',
      technique: 'Canvas 2D: a Rutt/Etra raster (scan lines displaced by a procedural hidden image) projected in perspective by hand, painter-ordered with translucent occluders, three additive colour channels with separation, phosphor persistence',
      brief: 'An analogue video synthesiser flown like a landscape. Glowing phosphor scan lines lie over a hidden image (mountains, a raindrop pond, a lattice of bubbles, dunes, whirlpools) and rise over its shapes, and the camera flies over it so the lines stream toward you while the whole raster slowly turns and tilts; a scanned planet turns in the sky. Each kick drops a ripple ring at one spot of the terrain that lifts and whitens only the lines it crosses; each snare sends a retrace front sweeping from the horizon to the viewer, and every couple of bars that front rolls in a new hidden image and a new phosphor colour; the bass lifts the relief and the flying speed; each band wiggles its own depth of lines (bass in front, treble at the horizon); hats sparkle glints on the lines. The drop splits the phosphor into three separated colour channels and weaves a second raster of columns through the first; the breakdown folds back to one mono phosphor.',
      lineage: [
        'Brief 04 (Rutt/Etra scan processor, Sandin IP): horizontal lines displaced by a hidden image, phosphor glow, chroma separation, persistence; image turns in 3D, raster sweeps; bands own groups of lines; kick ripples one wave; snare switches the image; drop adds colour channels and doubles the raster.',
        'Taken as a flight: the raster lies on an endless procedural image and every scan line is fixed to it, so lines stream toward the viewer (Night drive was the reference for travel plus sky), with a slow incommensurate yaw, pitch and roll so it keeps turning. Five hidden images (ridges, raindrop pond, bubble lattice, dunes, whirlpools), each with its own phosphor (P31 green, amber, ice, violet, rose). A scanned planet in the sky is a second Rutt/Etra object with its own turning image.',
        'Painter-ordered with a translucent black under each line, so ridges occlude and the relief reads as ground; the original was all see-through, which read as mush at this density.',
        'Kick = a ripple ring dropped at one spot (walking by the golden angle each beat) that lifts and whitens only the lines it crosses, plus a quarter-second bloom at the spot. Snare = a retrace front sweeping horizon to viewer, re-colouring the lines it crosses; at most every 3.6 s it also carries an image switch, the new image and phosphor rolling in behind it, so the change is a travelling wipe, never a cut.',
        'Render 1: kick ring legible, drop clearly bigger; but the terrain ended in a visible flat far edge and side corners, and the horizon strip read as a shelf. Jolt: calm, kickArea 0.26, ratio 1.07 (most of the area is the flight itself).',
        'Render 2: depth doubled with fog, strip widened with distance, kick bloom added and hot segments brightened; old rings then lingered for 2 s and covered half the frame. Ring decay cut to 0.33 s, lifetime 1.4 s; horizon lowered so the sky and planet have room.',
        'Jolt after: calm, kickArea 0.21, ratio 1.07, the kick a clear white hot spot on the heat map. Chroma separation and weave brightened for the drop; flat Pond image given hills; hat glints doubled in size.',
      ],
    },

    enter(p) {
      this.clock = 0;
      this.lastMs = null;
      this.S = 0;                           // distance flown
      this.env = { bass: 0, pad: 0, high: 0, energy: 0, lastKick: -9, lastSnare: -9, lastHat: -9,
        b: new Float32Array(9) };
      this.hist = { k: [0, 0, 0, 0], c: [0, 0, 0, 0], h: [0, 0, 0] };
      this.kickTimes = [];
      this.ripples = [];
      this.fronts = [];                     // snare retrace fronts
      this.glints = [];
      this.img = 0; this.prevImg = 0;
      this.switchAt = -99;                  // time of the last image switch (drift-free seconds)
      this.wipe = null;                     // the front that carries the current switch
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
      // Per-band line groups: slow for the low bands so a kick never heaves
      // a whole group, quicker at the top so hats shimmer the horizon.
      for (let i = 0; i < 9; i++) e.b[i] = ease(e.b[i], sig[i] / 100, i < 3 ? 1.5 : 2 + i * 1.2, dt);
      while (this.kickTimes.length && now - this.kickTimes[0] > 2.5) this.kickTimes.shift();
      const target = clamp01(this.kickTimes.length / 4.5);
      e.energy = ease(e.energy, target, target > e.energy ? 0.8 : 0.35, dt);
      return ev;
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

      const mode = params.chroma | 0;
      const drop = mode === 1 ? 0 : mode === 2 ? 1 : smooth(0.15, 0.85, e.energy);

      // ---- motion: flying speed follows the bass level, eased.
      const speed = params.speed * (0.16 + 0.34 * e.bass * Math.min(1.5, react) + 0.12 * drop);
      this.S += speed * dt;
      const S = this.S;

      // Camera: slow incommensurate turns, so the raster keeps finding new angles.
      const tr = params.turn;
      const yaw = tr * (0.2 * Math.sin(T * 0.071) + 0.08 * Math.sin(T * 0.19 + 1));
      const pitch = 0.44 + tr * (0.1 * Math.sin(T * 0.053 + 2) + 0.03 * Math.sin(T * 0.13));
      const roll = tr * 0.045 * Math.sin(T * 0.061 + 0.5);
      const cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const D = 2.3;
      const F = Math.max(0.86 * Ht, 0.52 * W);
      const cx = W / 2, cyS = Ht * 0.53;

      // ---- events
      if (ev.kick && react > 0) {
        // A new spot each beat, walking around the mid-ground so consecutive
        // ripples do not stack.
        this.kickN++;
        const a = this.kickN * 2.39996 + this.rand() * 0.6;
        const x0 = 0.75 * Math.cos(a);
        const z0 = -0.25 + 0.55 * Math.sin(a * 1.3) + S;
        this.ripples.push({ t0: now, x: x0, z: z0, amp: ev.kick * react });
        if (this.ripples.length > 5) this.ripples.shift();
      }
      const imgMode = params.image | 0;
      if (ev.snare) {
        let sw = false;
        if (imgMode === 0 && now - this.switchAt > HOLD) {
          sw = true;
          this.prevImg = this.img;
          this.img = (this.img + 1 + Math.floor(this.rand() * (IMAGES.length - 1))) % IMAGES.length;
          this.switchAt = now;
        }
        const f = { t0: now, sw };
        this.fronts.push(f);
        if (sw) this.wipe = f;
        if (this.fronts.length > 4) this.fronts.shift();
      }
      if (imgMode > 0 && this.img !== imgMode - 1) {
        this.prevImg = this.img; this.img = imgMode - 1; this.switchAt = now;
        this.wipe = { t0: now, sw: true }; this.fronts.push(this.wipe);
      }
      if (ev.hats && react > 0) {
        const n = 2 + Math.floor(ev.hats * 4 * Math.min(1.5, react));
        for (let i = 0; i < n; i++) {
          this.glints.push({ t0: now, x: (this.rand() * 2 - 1) * 1.5, z: S + Z_NEAR + 0.35 + this.rand() * 2.1,
            a: 0.6 + 0.4 * this.rand() });
        }
        while (this.glints.length > 40) this.glints.shift();
      }
      this.ripples = this.ripples.filter((r) => now - r.t0 < 1.4);
      this.fronts = this.fronts.filter((f) => now - f.t0 < 1.6);
      this.glints = this.glints.filter((q) => now - q.t0 < 0.5);
      const FRONT_DUR = 1.3;             // horizon to viewer
      const frontPos = (f) => Z_FAR + 0.1 - (Z_FAR - Z_NEAR + 0.3) * clamp01((now - f.t0) / FRONT_DUR);
      if (this.wipe && now - this.wipe.t0 > FRONT_DUR + 0.2) this.wipe = null;
      const wipeZ = this.wipe ? frontPos(this.wipe) : -99;   // local z; beyond it the new image shows

      // ---- clear with persistence
      if (!this.cleared) { p.background(0); this.cleared = true; }
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,' + (1 - params.persist * 0.85).toFixed(3) + ')';
      g.fillRect(-2, -2, W + 4, Ht + 4);

      g.translate(cx, cyS);
      g.rotate(roll);

      const tintNew = TINTS[this.img], tintOld = TINTS[this.prevImg];
      // Channel colours: in mono they are three thirds of the phosphor, in
      // the drop they rotate apart into a triad that still sums near white.
      const chanCols = (tint) => {
        const out = [];
        for (let k = 0; k < 3; k++) {
          const tri = hueRot(tint, (k - 1) * 120 + 20);
          out.push([tint[0] + (tri[0] - tint[0]) * drop * 0.85, tint[1] + (tri[1] - tint[1]) * drop * 0.85,
            tint[2] + (tri[2] - tint[2]) * drop * 0.85]);
        }
        return out;
      };
      const chNew = chanCols(tintNew), chOld = chanCols(tintOld);

      // ---- sky: faint CRT raster, horizon glow, scanned planet
      const horizonY = F * (Z_FAR * sp) / (D + Z_FAR * cp);
      const skyTop = -cyS - 40;
      g.globalCompositeOperation = 'lighter';
      const glow = g.createLinearGradient(0, -horizonY - 10, 0, skyTop);
      const gl0 = 0.1 + 0.12 * e.pad + 0.05 * drop;
      glow.addColorStop(0, rgba(tintNew, gl0));
      glow.addColorStop(0.35, rgba(hueRot(tintNew, 40), gl0 * 0.35));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(-W, skyTop, W * 2, Ht * 1.5);
      g.strokeStyle = rgba(tintNew, 0.05);
      g.lineWidth = 0.8;
      g.beginPath();
      for (let y = skyTop; y < -horizonY + 20; y += 4) { g.moveTo(-W, y); g.lineTo(W, y); }
      g.stroke();

      // Planet: a Rutt/Etra ball. Horizontal scan lines across a disc, each
      // raised by its own texture as the sphere turns under it.
      {
        const R = 70 + 12 * e.pad * react;
        const px = W * 0.22 * Math.sin(T * 0.023 + 1) + 0.12 * W;
        // Hangs low enough to set partly behind the ridges now and then.
        const py = Math.max(-cyS + R + 14, -horizonY - R * 0.7 + 14 * Math.sin(T * 0.031));
        const rot = T * 0.12 + S * 0.3;
        const pCol = hueRot(tintNew, 150);
        const nL = 30;
        g.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          g.lineWidth = pass === 0 ? 4 : 1.1;
          g.beginPath();
          for (let i = 1; i < nL; i++) {
            const lat = -1 + (2 * i) / nL;              // -1..1 (screen up is negative y)
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
          g.strokeStyle = rgba(pCol, pass === 0 ? 0.07 + 0.05 * e.pad : 0.5 + 0.2 * e.pad);
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
      const relief = params.relief * (0.26 + 0.12 * e.bass * Math.min(1.5, react));
      const fNew = FIELDS[this.img], fOld = FIELDS[this.prevImg];
      const ripples = this.ripples;
      const rowInfo = [];
      // Bands' wavelengths along the line: bass long, treble short.
      const bandAmp = [];
      for (let b = 0; b < 9; b++) bandAmp.push(e.b[b] * react * (0.05 - b * 0.003));
      for (let r = 0; r < nR; r++) {
        const zw = (k0 + r) * dz;
        const zl = zw - S;                               // local depth
        const depth01 = (zl - Z_NEAR) / (Z_FAR - Z_NEAR); // 0 near, 1 far
        // Old image where the wipe has not yet reached; blend across the front.
        const mNew = this.wipe ? smooth(wipeZ - 0.12, wipeZ + 0.12, zl) : 1;
        // This row's band and its neighbour, interpolated so groups blend.
        const bf = depth01 * 8, b0 = Math.min(7, Math.floor(bf)), bt = bf - b0;
        const wig = bandAmp[b0] * (1 - bt) + bandAmp[b0 + 1] * bt;
        const wfreq = 3 + bf * 2.2;
        let fr = 0;
        for (const f of this.fronts) {
          const d = zl - frontPos(f);
          fr = Math.max(fr, Math.exp(-(d * d) / 0.012) * (1 - clamp01((now - f.t0 - FRONT_DUR) / 0.4)));
        }
        rowInfo.push({ zl, depth01, mNew, fr });
        for (let c = 0; c < COLS; c++) {
          // The strip widens with distance so its far corners never show.
          const x = (-1 + (2 * c) / (COLS - 1)) * X_EXT * (1 + 1.7 * depth01);
          let hv = mNew >= 1 ? fNew(x, zw, T) : mNew <= 0 ? fOld(x, zw, T)
            : fOld(x, zw, T) * (1 - mNew) + fNew(x, zw, T) * mNew;
          let y = relief * (hv - 0.35);
          y += wig * Math.sin(x * wfreq + T * (1.3 + bf * 0.5) + r * 0.7);
          // Kick ripples: a ring of lift that travels outward from its spot.
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
          // Project: yaw about the target, then a camera pitched down at it.
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
      }

      // ---- draw terrain far to near
      const sepMax = drop * 6.5 * Math.min(1.5, 0.4 + react * 0.6);
      const weave = drop;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const trace = (r, dx, dy) => {
        let pen = false;
        const base = r * COLS;
        for (let c = 0; c < COLS; c++) {
          const i = base + c;
          if (!okA[i]) { pen = false; continue; }
          if (pen) g.lineTo(sxA[i] + dx, syA[i] + dy); else { g.moveTo(sxA[i] + dx, syA[i] + dy); pen = true; }
        }
      };
      const bottom = Ht * 0.6 + 40;
      for (let r = nR - 1; r >= 0; r--) {
        const info = rowInfo[r];
        // Fade rows in at the horizon and out at the bottom so none pops.
        const fadeFar = 1 - smooth(0.72, 1, info.depth01);
        const fadeNear = smooth(0, 0.05, info.depth01);
        const fog = 0.25 + 0.75 * Math.pow(1 - info.depth01, 1.1);
        const vis = fadeFar * fadeNear;
        if (vis <= 0.001) continue;

        // Occluder: translucent black from this line down, so nearer ridges
        // hide what is behind them and the relief reads as solid ground.
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
          g.fillStyle = 'rgba(0,0,0,' + (0.8 * vis).toFixed(3) + ')';
          g.fill();
        }

        g.globalCompositeOperation = 'lighter';
        const ch = info.mNew >= 1 ? chNew : chOld.map((o, k) => [
          o[0] + (chNew[k][0] - o[0]) * info.mNew, o[1] + (chNew[k][1] - o[1]) * info.mNew, o[2] + (chNew[k][2] - o[2]) * info.mNew]);
        // The snare's retrace front re-colours the lines it crosses toward the
        // complement and brightens them.
        const fr = info.fr * Math.min(1.2, react);
        const bright = vis * fog * (0.7 + 0.3 * e.bass) * (1 + 0.9 * fr);
        const sep = sepMax * (0.4 + 1.2 * (1 - info.depth01));
        const lw = 0.8 + 1.1 * (1 - info.depth01);

        // Columns of the drop's second raster, between this line and the one behind.
        if (weave > 0.02 && r + 1 < nR) {
          const stride = 5;
          g.beginPath();
          for (let c = 2; c < COLS; c += stride) {
            const i0 = r * COLS + c, i1 = (r + 1) * COLS + c;
            if (!okA[i0] || !okA[i1]) continue;
            g.moveTo(sxA[i1], syA[i1]); g.lineTo(sxA[i0], syA[i0]);
          }
          g.lineWidth = lw * 0.8;
          g.strokeStyle = rgba(hueRot(ch[1], 180), 0.5 * weave * bright);
          g.stroke();
        }

        for (let k = 0; k < 3; k++) {
          let col = ch[k];
          if (fr > 0.01) {
            const cc = hueRot(col, 150);
            col = [col[0] + (cc[0] - col[0]) * Math.min(1, fr), col[1] + (cc[1] - col[1]) * Math.min(1, fr),
              col[2] + (cc[2] - col[2]) * Math.min(1, fr)];
          }
          const off = (k - 1) * sep;
          g.beginPath();
          trace(r, off * 0.6, off);
          g.lineWidth = lw * 4;
          g.strokeStyle = rgba(col, 0.055 * bright);
          g.stroke();
          g.lineWidth = lw;
          g.strokeStyle = rgba(col, 0.42 * bright);
          g.stroke();
        }

        // Kick: the segments a ripple is crossing, white-hot and thick.
        let any = false;
        for (let c = 0; c < COLS; c++) if (hotA[r * COLS + c] > 0.08) { any = true; break; }
        if (any) {
          for (let pass = 0; pass < 2; pass++) {
            g.beginPath();
            let pen = false;
            for (let c = 0; c < COLS; c++) {
              const i = r * COLS + c;
              if (!okA[i] || hotA[i] < 0.08) { pen = false; continue; }
              if (pen) g.lineTo(sxA[i], syA[i]); else { g.moveTo(sxA[i], syA[i]); pen = true; }
            }
            let hmax = 0;
            for (let c = 0; c < COLS; c++) hmax = Math.max(hmax, hotA[r * COLS + c]);
            const hc = [255, 235 + 20 * (1 - drop), 220];
            g.lineWidth = pass === 0 ? lw * 6 : lw * 1.6;
            g.strokeStyle = rgba(pass === 0 ? tintNew : hc, (pass === 0 ? 0.3 : 1) * Math.min(1, hmax * 1.5) * vis * Math.sqrt(fog));
            g.stroke();
          }
        }
      }

      // ---- kick impact: a soft bloom where each ripple was dropped, gone in
      // a quarter of a second, so the beat has one bright point to land on.
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
        const rad = (40 + 50 * age) * (2 / zc);
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, rgba([255, 250, 240], 0.55 * a));
        gr.addColorStop(0.25, rgba(tintNew, 0.28 * a));
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(X, Y, rad, rad * 0.55, 0, 0, TAU); g.fill();
      }

      // ---- hat glints: small four-point stars riding on the lines
      g.globalCompositeOperation = 'lighter';
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
        const len = (6 + 14 * a) * (2 / zc);
        g.lineWidth = 1;
        g.strokeStyle = rgba([255, 255, 255], 0.8 * a);
        g.beginPath();
        g.moveTo(X - len, Y); g.lineTo(X + len, Y); g.moveTo(X, Y - len * 0.6); g.lineTo(X, Y + len * 0.6);
        g.stroke();
        g.fillStyle = rgba(hueRot(tintNew, 60), 0.25 * a);
        g.beginPath(); g.arc(X, Y, len * 0.45, 0, TAU); g.fill();
      }

      g.restore();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    },
  });
})();
