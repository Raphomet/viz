// Bloom — a night garden that opens to the music.
//
// Canvas 2D, drawn back to front in virtual units:
//   sky (gradient, stars, drop-only nebula glow, moon with halo rings)
//   → two hill silhouettes with parallax → ground mist
//   → back grass → flowers on stems, far to near (fogged by depth)
//   → pollen, bloom sparks, fireflies → foreground grass silhouettes → vignette.
//
// Flowers are seen head-on (a slight downward tilt squashes them), so each
// head is a mandala: three rings of petals, counter-rotating, each ring a
// single path filled translucent and stroked bright under additive blending.
// Overlaps between rings add up to light, which is where the iridescence comes
// from; no per-petal gradients are needed, which keeps a full garden cheap.
//
// Music is read as onsets, not levels, so it works on real mixes where band 0
// sits near 100 all night: a kick is a sharp rise in band 0 over the last few
// frames, a snare/clap a rise in band 4, a hat a rise in bands 7-8. Each
// onset starts its own envelope; the scene never flashes a large area.
//
// Life cycle of a flower: its stem grows from the grass as a bud; a snare
// makes one bud burst open (a ring of light and sparks); it stays open for
// ~10-17 s, then closes and sinks, and is replanted somewhere else. In the
// breakdown there are no snares, so buds open only occasionally on their own,
// and the garden slowly closes: the exhale.

(function () {
  const TAU = Math.PI * 2;

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function mixRGB(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  function rgba(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
  function hsla(h, s, l, a) {
    h = ((h % 360) + 360) % 360;
    return `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(3)})`;
  }
  // Overshooting ease-out: petals snap open past their rest and settle.
  function springOpen(x) {
    if (x >= 1) return 1;
    if (x <= 0) return 0;
    return 1 - Math.exp(-6 * x) * Math.cos(7.5 * x) * (1 - x * 0.15);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Each scheme is one night: sky, hills, and the flower hues the garden
  // draws from. Hues are a chosen set, not a rainbow; the snare steps the
  // whole garden around them.
  const SCHEMES = [
    { name: 'Moon garden', skyTop: [3, 6, 22], skyLow: [16, 30, 78], hillFar: [14, 26, 64], hillNear: [6, 12, 34],
      ground: [3, 7, 16], moon: [226, 234, 255], mist: [70, 96, 170], hues: [318, 196, 42, 272, 168], seed: 48, fly: 72 },
    { name: 'Ultraviolet', skyTop: [8, 2, 22], skyLow: [44, 12, 86], hillFar: [34, 12, 70], hillNear: [14, 4, 34],
      ground: [6, 2, 14], moon: [240, 226, 255], mist: [120, 60, 190], hues: [286, 328, 186, 250, 52], seed: 60, fly: 160 },
    { name: 'Ember', skyTop: [14, 3, 12], skyLow: [66, 18, 40], hillFar: [52, 16, 36], hillNear: [22, 6, 16],
      ground: [10, 3, 6], moon: [255, 232, 214], mist: [170, 70, 80], hues: [18, 338, 44, 2, 300], seed: 190, fly: 40 },
    { name: 'Glacier', skyTop: [1, 8, 18], skyLow: [8, 44, 68], hillFar: [10, 40, 60], hillNear: [4, 18, 30],
      ground: [2, 8, 12], moon: [220, 248, 255], mist: [60, 140, 170], hues: [184, 206, 150, 262, 318], seed: 320, fly: 90 },
  ];

  // Parallax: how fast a flower at depth z slides past as the camera walks.
  function par(z) { return 0.3 + 0.9 * z; }
  // Layers that repeat (grass, hills, fireflies) live on a loop 1.3 stages wide.
  function wrapX(x, W) {
    const span = W * 1.3;
    return ((x + W * 0.15) % span + span) % span - W * 0.15;
  }

  const SLOTS_MAX = 24;
  const FLIES_MAX = 110;
  const STARS = 170;

  VIZ.register({
    id: 'bloom',
    name: 'Bloom',
    order: 209,

    params: [
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'scheme', label: 'Night', type: 'select', options: SCHEMES.map((s) => s.name), default: 0 },
      { key: 'count', label: 'Flowers', type: 'range', min: 6, max: 24, default: 15, step: 1 },
      { key: 'walk', label: 'Walk speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'trails', label: 'Dream trails', type: 'range', min: 0, max: 0.9, default: 0.35, step: 0.01 },
      { key: 'wind', label: 'Sway', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'flies', label: 'Fireflies', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'colour', label: 'Colour', type: 'select', options: ['Follows the music', 'Always lit', 'Moonlight only'], default: 0 },
    ],

    actions: [
      { id: 'replant', label: 'Replant garden', run() { this.replant(); } },
    ],

    gallery: {
      title: 'Bloom',
      technique: 'Canvas 2D, additive blending: gradient sky, star field, moon halo, parallax hills and grass, mandala flowers (three counter-rotating rings of petals, each ring one path filled and stroked under "lighter"), glow-sprite fireflies and pollen, optional frame persistence for trails',
      brief: 'A slow walk through a night garden beside a lake, under a moon that stays put. Mandala flowers on swaying stems at several depths slide past in parallax (near stems and reeds fastest), entering on the right and leaving on the left; fireflies drift; the lake reflects it all. Each kick starts a ripple of flaring on one flower (petals punch out, glow blooms, pollen puffs) that spreads both ways through its neighbours and fades, a new spot each beat, while a thin ring leaves the moon; each snare bursts a bud open with a ring of light and sparks; bass sways stems, swells the mist and stirs the lake; hats blink the fireflies and glint the moon path. The drop walks faster and lights the silver garden up in saturated, slowly drifting colour with nebula glow; the breakdown slows, drains and closes.',
      lineage: [
        'Brief 09 (night garden: moon, stems with parallax, flowers opening, fireflies; kick opens, snare blooms, bass sways, hats blink, drop lights up the colour).',
        'Flowers head-on rather than in profile, so each is a mandala with detail inside detail (phyllotaxis seed head inside three counter-rotating petal rings) for the altered viewer to fall into, and so a flare reads as the whole head punching outward at any size.',
        'Music read as onsets with refractory windows (band 0 rise = kick, band 4 rise = snare, bands 7-8 rise = hat) so each drum gets its own envelope and the scene survives a real mix whose bass bands never drop.',
        'Snare drives the life cycle (it opens a bud) rather than spawning from nothing, so the garden count stays bounded and the breakdown, with no snares, visibly closes up.',
        'Render 1: the layers and the kick read, but heads crowded into one horizontal band with the lower 40% dead dark grass, and overlapping heads summed to white blots under additive blending in the drop.',
        'Fixes: petal fills composite with "screen" (strokes still add, for the neon edge); new flowers take the best of four spots away from neighbours at similar depth; stem heights spread 0.12-1 so heads fill the middle of the frame.',
        'Render 2: the empty foreground became a lake. The finished garden above the waterline is copied once, flipped and squashed (a true mirror of so short a lake would show only the meadow), at a third of the resolution, and laid back in 3-pixel strips shifted by ripples that bass and kicks agitate. Copying pixels instead of drawing the garden twice keeps it cheap, and every flare and burst now lands twice.',
        'Added a moon path of glints on the water that twinkles with the pad and sparkles on each hat, so hats read in a second place beside the fireflies, which now use one cached glow sprite instead of a gradient each.',
        'Kick strip: 12.0 s (65 ms after a kick) shows every head flared, glows bloomed, moon halo brightened and a ring leaving it, against 11.9 s. Snare rings and sparks were given a minimum size after a burst from a far bud read as a speck.',
        '96 s run: the colour steps and drift keep the palette moving (fireflies and garden wander through the scheme), the garden count rises and falls with the sections, no accumulation or stasis.',
        'Batch 02 review (2026-09-28): too pulsey. Jolt meter before: kickArea 0.36, ratio 2.96, "noticeable": every head flared at once, the moon halo brightened, the garden zoomed 1.8% and the lake churned, and each clap stepped the whole garden 34 degrees in hue.',
        'Revision: zoom removed; the kick is now a ripple that starts on one open flower (a new spot each beat, walking across the stage) and spreads both ways at 0.8 stage widths a second, fading in 0.5 s, so only a few heads flare at once; pollen puffs as the ripple reaches each head. Moon keeps only its thin ring; lake and waterline no longer jump on the kick. Snare keeps its local bud burst but no longer steps the hue: colour drifts at 2-6 degrees a second instead.',
        'Movement: the camera walks right through the garden, speed set by the music (faster in the drop, eased, never jerked). Flowers live in world x with depth parallax and are replanted beyond the right edge when they leave on the left; grass, hills and fireflies wrap on seamless loops; the moon stays put. "Bloom size" gave way to a "Walk speed" control. Jolt after: kickArea 0.13, ratio 1.12, "calm", with the kick a clear hot spot on one flower.',
      ],
    },

    setup(p, ctx) { if (ctx) this.W = ctx.width; this.replant(); },
    enter(p, ctx) { if (ctx) this.W = ctx.width; this.replant(); },

    replant() {
      const rnd = mulberry32((Math.random() * 1e9) | 0);
      this.rnd = rnd;
      this.lastMs = null;
      this.time = 0;
      this.hist = { k: [0, 0, 0, 0], c: [0, 0, 0, 0], h: [0, 0, 0] };
      this.env = { kick: 0, kickAmp: 0, lastKick: -9, lastSnare: -9, lastHat: -9, snare: 0,
        bass: 0, pad: 0, high: 0, energy: 0, colour: 0 };
      this.kickTimes = [];
      this.hueShift = 0;
      this.hueTarget = 0;
      this.lastBloom = 0;
      this.cam = 0;           // how far the walk has gone, in virtual units
      this.waves = [];
      this.waveX = 0.3 + rnd() * 0.4;
      this.waveN = 0;
      this.W = this.W || 1067;

      this.flowers = [];
      for (let i = 0; i < SLOTS_MAX; i++) {
        const f = this.newFlower(i);
        // Start the garden already partly grown and open so the first frame is a garden.
        const r = rnd();
        if (r < 0.45) { f.state = 'open'; f.grow = 1; f.openAge = 1 + rnd() * 6; f.open = 1; }
        else if (r < 0.75) { f.state = 'bud'; f.grow = 1; }
        else { f.grow = rnd(); }
        this.flowers.push(f);
      }

      this.stars = [];
      for (let i = 0; i < STARS; i++) {
        this.stars.push({ x: rnd(), y: Math.pow(rnd(), 1.4), r: 0.6 + rnd() * 1.4, ph: rnd() * TAU, f: 0.5 + rnd() * 2 });
      }

      this.flies = [];
      for (let i = 0; i < FLIES_MAX; i++) {
        this.flies.push({
          x0: rnd(), y0: 0.28 + rnd() * 0.44, z: rnd(),
          ax: 0.04 + rnd() * 0.12, ay: 0.02 + rnd() * 0.06,
          f1: 0.05 + rnd() * 0.12, f2: 0.07 + rnd() * 0.15, f3: 0.3 + rnd() * 0.5,
          p1: rnd() * TAU, p2: rnd() * TAU, p3: rnd() * TAU,
          flash: 0, base: 0.1 + rnd() * 0.2, glowPh: rnd() * TAU,
        });
      }

      // Hills and grass are generated in a normalised width 0..1.3 so the
      // camera drift never shows an edge.
      const hill = (n, amp, oct) => {
        const pts = [];
        const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          // Integer cycles over the loop, so the walk never meets a seam.
          pts.push(amp * (0.5 * Math.sin(u * oct[0] * TAU + ph[0]) + 0.3 * Math.sin(u * oct[1] * TAU + ph[1])
            + 0.2 * Math.sin(u * oct[2] * TAU + ph[2])));
        }
        return pts;
      };
      this.hillFar = hill(120, 1, [1, 3, 7]);
      this.hillNear = hill(120, 1, [2, 5, 11]);

      this.grassBack = [];
      for (let i = 0; i < 260; i++) {
        this.grassBack.push({ u: -0.15 + rnd() * 1.3, h: 8 + rnd() * 26, lean: (rnd() - 0.5) * 16, w: 1.6 + rnd() * 1.6, ph: rnd() * TAU, d: rnd() });
      }
      this.grassFront = [];
      for (let i = 0; i < 110; i++) {
        this.grassFront.push({ u: -0.2 + rnd() * 1.4, h: 30 + Math.pow(rnd(), 1.8) * 170, lean: (rnd() - 0.5) * 60, w: 3 + rnd() * 5, ph: rnd() * TAU });
      }

      this.pollen = [];
      this.sparks = [];
      this.rings = [];
      this.moonRings = [];
    },

    // Where a flower is on stage now, as a fraction of the width.
    screenU(f) { return (f.wx - this.cam * par(f.z)) / this.W; },

    newFlower(i, entering) {
      const rnd = this.rnd;
      const z = Math.pow(rnd(), 0.8);
      // Best of four spots: the one furthest from flowers at a similar depth,
      // so heads spread over the stage instead of piling into one blot.
      let u = 0.5, best = -1;
      for (let c = 0; c < 4; c++) {
        const cu = entering ? 1.1 + rnd() * 0.15 : -0.05 + rnd() * 1.1;
        let dmin = 9;
        for (const o of this.flowers || []) {
          if (o.id === i || o.state === 'close') continue;
          dmin = Math.min(dmin, Math.abs(this.screenU(o) - cu) + 0.6 * Math.abs(o.z - z));
        }
        if (dmin > best) { best = dmin; u = cu; }
      }
      return {
        id: i,
        wx: u * this.W + this.cam * par(z), // world x: the walk slides it past
        z,                                  // 0 far, 1 near
        hueIdx: (rnd() * 5) | 0,
        hueJit: (rnd() - 0.5) * 24,
        n: 5 + ((rnd() * 8) | 0),           // petals per ring
        tilt: 0.52 + rnd() * 0.35,          // head-on squash
        pointy: rnd(),                      // petal shape
        spin: (rnd() < 0.5 ? -1 : 1) * (0.04 + rnd() * 0.1),
        rot: rnd() * TAU,
        stemH: 0.12 + rnd() * 0.88,
        lean: (rnd() - 0.5) * 70,
        ph: rnd() * TAU,
        swayF: 0.35 + rnd() * 0.35,
        leafAt: 0.25 + rnd() * 0.3,
        leafSide: rnd() < 0.5 ? -1 : 1,
        life: 10 + rnd() * 7,
        state: 'grow', grow: 0, open: 0, openAge: 0, closeAge: 0, fade: 1,
        hx: 0, hy: 0, R: 0,
      };
    },

    // The lake: the band of the finished garden just above the waterline,
    // flipped once into an offscreen canvas, then laid back below it in thin
    // strips, each shifted sideways by a ripple that bass and kicks agitate.
    // Copying pixels is far cheaper than drawing the garden twice.
    reflect(g, W, H, waterY, now, e, sch) {
      const cv = g.canvas;
      const s = cv.width / W;
      const wy = Math.round(waterY * s);
      const bandH = cv.height - wy;
      if (bandH <= 0) return;
      // The reflection is squashed (SQUASH of the height above the waterline
      // per unit below it): a true mirror of this short lake would only show
      // the meadow, never the flower heads, which are what should shimmer.
      const SQUASH = 0.58;
      const srcH = Math.min(wy, Math.round(bandH / SQUASH));
      // Kept at a third of the resolution: cheaper to copy, and the softness
      // reads as water.
      const RES = 3;
      const rw = Math.ceil(cv.width / RES), rh = Math.ceil(bandH / RES);
      if (!this.refl) this.refl = document.createElement('canvas');
      const rc = this.refl;
      if (rc.width !== rw || rc.height !== rh) {
        rc.width = rw; rc.height = rh;
        this.rctx = rc.getContext('2d');
      }
      const r = this.rctx;
      if (!r) return;
      r.setTransform(1, 0, 0, -1, 0, rh);
      r.globalCompositeOperation = 'copy';
      r.globalAlpha = 1;
      r.imageSmoothingEnabled = true;
      r.drawImage(cv, 0, wy - srcH, cv.width, srcH, 0, 0, rw, rh);

      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      const gr = g.createLinearGradient(0, wy, 0, cv.height);
      gr.addColorStop(0, rgba(mixRGB(sch.skyLow, sch.ground, 0.5), 1));
      gr.addColorStop(1, rgba(sch.ground, 1));
      g.fillStyle = gr;
      g.fillRect(0, wy, cv.width, bandH);
      g.imageSmoothingEnabled = true;
      const agit = 0.6 + 1.8 * e.bass + 0.4 * e.kick;
      const pad = 14 * s;
      for (let y = 0; y < rh; y++) {
        const d = y / rh;
        const yv = (y * RES) / s;
        // Ripples bunch up toward the far bank, as they would in perspective.
        const ph = 26 * Math.log(1 + yv / 10) - now * 2.1;
        const off = s * (1 + 5 * d) * agit * (Math.sin(ph) + 0.5 * Math.sin(ph * 1.7 + now * 0.9 + yv * 0.03));
        g.globalAlpha = 0.7 * (1 - 0.6 * d);
        // Overdrawn a little each side so a shifted strip never bares the edge.
        g.drawImage(rc, 0, y, rw, 1, off - pad, wy + y * RES, cv.width + 2 * pad, RES);
      }
      g.restore();
    },

    // One pre-rendered glow per hue: a radial gradient per firefly per frame
    // was the single largest cost in the scene.
    flySprite(hue) {
      if (this.spr && Math.abs(this.sprHue - hue) < 3) return this.spr;
      const c = this.spr || document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      x.clearRect(0, 0, 64, 64);
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, hsla(hue, 90, 72, 1));
      gr.addColorStop(0.12, hsla(hue, 90, 62, 0.8));
      gr.addColorStop(0.3, hsla(hue, 90, 55, 0.3));
      gr.addColorStop(1, hsla(hue, 90, 50, 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      this.spr = c;
      this.sprHue = hue;
      return c;
    },

    // ---- listening ------------------------------------------------------
    listen(sig, dt, now, react) {
      const e = this.env, H = this.hist;
      const ev = { kick: false, snare: false, hat: false };

      const k = sig[0] / 100;
      const kMin = Math.min(H.k[0], H.k[1], H.k[2], H.k[3]);
      if (k - kMin > 0.2 && k > 0.38 && now - e.lastKick > 0.2) {
        e.lastKick = now;
        e.kickAmp = Math.min(1, 0.55 + (k - kMin));
        this.kickTimes.push(now);
        ev.kick = true;
      }
      H.k.shift(); H.k.push(k);

      const c = sig[4] / 100;
      const cMin = Math.min(H.c[0], H.c[1], H.c[2], H.c[3]);
      if (c - cMin > 0.22 && c > 0.34 && now - e.lastSnare > 0.22) {
        e.lastSnare = now;
        ev.snare = true;
      }
      H.c.shift(); H.c.push(c);

      const h = (sig[7] + sig[8]) / 200;
      const hMin = Math.min(H.h[0], H.h[1], H.h[2]);
      if (h - hMin > 0.18 && h > 0.25 && now - e.lastHat > 0.07) {
        e.lastHat = now;
        ev.hat = true;
      }
      H.h.shift(); H.h.push(h);

      // Punch envelopes: instant attack, a few hundred ms of decay.
      e.kick = e.kickAmp * Math.exp(-(now - e.lastKick) / 0.17) * react;
      e.snare = Math.exp(-(now - e.lastSnare) / 0.22) * react;

      e.bass = ease(e.bass, (sig[1] + sig[2]) / 200, 2.5, dt);
      e.pad = ease(e.pad, (sig[2] + sig[3] + sig[4]) / 300, 0.8, dt);
      e.high = ease(e.high, (sig[6] + sig[7] + sig[8]) / 300, 3, dt);

      // Drop-ness: how many kicks landed in the last 2.5 s. Tempo-agnostic
      // enough, and immune to a bass band that never falls.
      while (this.kickTimes.length && now - this.kickTimes[0] > 2.5) this.kickTimes.shift();
      const target = clamp01(this.kickTimes.length / 4.5);
      e.energy = ease(e.energy, target, target > e.energy ? 0.9 : 0.45, dt);
      return ev;
    },

    // ---- flower life ----------------------------------------------------
    bloomOne(now) {
      const fl = this.flowers.slice(0, this.active);
      let cand = fl.filter((f) => f.state === 'bud');
      if (!cand.length) cand = fl.filter((f) => f.state === 'grow' && f.grow > 0.6);
      if (!cand.length) {
        // Everything is open: re-bloom the oldest open flower, so every snare still lands.
        cand = fl.filter((f) => f.state === 'open').sort((a, b) => b.openAge - a.openAge).slice(0, 3);
      }
      if (!cand.length) return null;
      // Prefer nearer flowers: a bloom up front reads across the room.
      cand.sort((a, b) => b.z - a.z);
      const f = cand[Math.min(cand.length - 1, (this.rnd() * Math.min(3, cand.length)) | 0)];
      f.state = 'open';
      f.grow = Math.max(f.grow, 0.85);
      f.openAge = 0;
      f.burst = true;
      this.lastBloom = now;
      return f;
    },

    stepFlowers(dt, now) {
      for (let i = 0; i < this.flowers.length; i++) {
        let f = this.flowers[i];
        // Walked past: replant it just beyond the right edge, already grown
        // (open, in bud or still growing) so the garden keeps coming.
        if (this.screenU(f) < -0.2) {
          f = this.newFlower(f.id, true);
          const r = this.rnd();
          if (r < 0.5) { f.state = 'open'; f.grow = 1; f.openAge = 1.2 + this.rnd() * 5; f.open = 1; }
          else if (r < 0.8) { f.state = 'bud'; f.grow = 1; }
          else f.grow = 0.3 + 0.6 * this.rnd();
          this.flowers[i] = f;
        }
        const on = i < this.active;
        if (f.state === 'grow') {
          f.grow = Math.min(1, f.grow + dt / 3);
          if (f.grow >= 1) f.state = 'bud';
          f.open = ease(f.open, 0, 3, dt);
          f.fade = ease(f.fade, on ? 1 : 0, 1, dt);
        } else if (f.state === 'bud') {
          f.grow = Math.min(1, f.grow + dt / 3);
          f.open = ease(f.open, 0, 3, dt);
          f.fade = ease(f.fade, on ? 1 : 0, 1, dt);
          if (!on) f.state = 'close';
        } else if (f.state === 'open') {
          f.grow = Math.min(1, f.grow + dt / 0.5);
          f.openAge += dt;
          f.open = springOpen(f.openAge / 1.1);
          f.fade = ease(f.fade, 1, 4, dt);
          if (f.openAge > f.life || !on) { f.state = 'close'; f.closeAge = 0; }
        } else if (f.state === 'close') {
          f.closeAge += dt;
          f.open = ease(f.open, 0, 1.2, dt);
          if (f.closeAge > 1.8) f.grow = Math.max(0, f.grow - dt / 2.2);
          f.fade = ease(f.fade, f.closeAge > 1.8 ? 0 : 1, 1.2, dt);
          if (f.grow <= 0) {
            const nf = this.newFlower(f.id);
            this.flowers[i] = nf;
          }
        }
      }
    },

    // ---- drawing --------------------------------------------------------
    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.flowers) this.replant();
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.time += dt;
      const now = this.time;
      const react = params.react;
      const sch = SCHEMES[(params.scheme | 0) % SCHEMES.length];
      this.active = Math.max(1, Math.min(SLOTS_MAX, Math.round(params.count)));

      const ev = this.listen(signals, dt, now, react);
      const e = this.env;
      const cm = params.colour | 0;
      const colTarget = cm === 1 ? 1 : cm === 2 ? 0 : e.energy;
      e.colour = ease(e.colour, colTarget, 1.5, dt);
      const col = e.colour;

      // Snare: a bud bursts open. (It used to step the whole garden's hue
      // too; on every clap that was a full-frame jolt, so colour now drifts.)
      if (ev.snare) {
        const f = this.bloomOne(now);
        if (f) f.burstPending = true;
      }
      // Without snares the garden still breathes, slowly.
      if (now - this.lastBloom > 2.6 && now - e.lastSnare > 2.6) this.bloomOne(now);
      this.hueShift = ease(this.hueShift, this.hueTarget, 7, dt);
      this.hueTarget += dt * (2 + 4 * e.energy);   // drifts, faster in the drop, so no two minutes match
      this.stepFlowers(dt, now);

      // The walk: the camera strolls right through the garden. The music sets
      // its speed (the drop walks faster), it never jerks it.
      this.W = W;
      this.walkV = ease(this.walkV || 0, params.walk * (14 + 26 * e.energy + 14 * e.bass), 1.2, dt);
      this.cam += dt * this.walkV;
      const cam = this.cam;

      // Kick: a ripple of flaring that starts at one spot in the garden and
      // spreads both ways, fading as it goes, so only part of the garden
      // flares at a time. Each kick starts from a different spot.
      if (ev.kick) {
        this.waveX = (this.waveX + 0.29 + 0.25 * this.rnd()) % 1;
        let x = (0.12 + 0.76 * this.waveX) * W;
        // Start it on the open flower nearest that spot, so the beat always
        // lands on a head, never on empty meadow.
        let best = Infinity;
        for (let i = 0; i < this.active; i++) {
          const f = this.flowers[i];
          if (f.open < 0.6 || f.hx < W * 0.05 || f.hx > W * 0.95) continue;
          const d = Math.abs(f.hx - x) - 60 * f.z;
          if (d < best) { best = d; x = f.hx; }
        }
        this.waves.push({ t0: now, x, amp: e.kickAmp * react, id: ++this.waveN });
      }
      while (this.waves.length && now - this.waves[0].t0 > 1.2) this.waves.shift();
      const waves = this.waves;
      const flareAt = (x) => {
        let v = 0, id = 0;
        for (const w of waves) {
          const age = now - w.t0;
          const d = Math.abs(x - w.x) - age * 0.8 * W;
          const band = Math.exp(-(d * d) / (0.012 * W * W));
          const k = w.amp * band * Math.exp(-age / 0.5);
          if (k > v) { v = k; id = w.id; }
        }
        return [v, id];
      };

      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';

      const horizon = H * 0.56;
      const waterY = H * 0.74;

      // ---- sky ---------------------------------------------------------
      const skyTop = mixRGB(sch.skyTop, [sch.skyTop[0] * 1.8 + 6, sch.skyTop[1] * 0.9, sch.skyTop[2] * 1.5 + 8], col * 0.7);
      const skyLow = mixRGB(sch.skyLow, [sch.skyLow[0] * 1.5 + 20, sch.skyLow[1] * 0.8, sch.skyLow[2] * 1.1], col * 0.6);
      let gr = g.createLinearGradient(0, 0, 0, horizon + 40);
      gr.addColorStop(0, rgba(skyTop, 1));
      gr.addColorStop(0.75, rgba(skyLow, 1));
      gr.addColorStop(1, rgba(mixRGB(skyLow, sch.mist, 0.3), 1));
      // Trails: repaint the sky translucent, so everything that moves leaves a
      // short ghost. The sky itself converges to its true colour.
      g.globalAlpha = 1 - params.trails;
      g.fillStyle = gr;
      g.fillRect(-2, -2, W + 4, H + 4);
      g.globalAlpha = 1;

      g.globalCompositeOperation = 'lighter';

      // Stars: twinkle, a little sharper when the hats are busy.
      g.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const y = s.y * horizon * 0.95;
        const tw = 0.5 + 0.5 * Math.sin(now * s.f + s.ph);
        const a = (0.12 + 0.4 * tw * tw + 0.35 * e.high * tw) * (1 - y / horizon * 0.8);
        g.globalAlpha = Math.min(1, a);
        const x = ((s.x * W * 1.1 - cam * 0.01) % (W * 1.1) + W * 1.1) % (W * 1.1) - W * 0.05;
        g.fillRect(x, y, s.r, s.r);
      }
      g.globalAlpha = 1;

      // Nebula: the drop fills the sky with slow coloured light.
      if (col > 0.02) {
        for (let i = 0; i < 3; i++) {
          const hue = sch.hues[i] + this.hueShift * 0.5;
          const nx = W * (0.2 + 0.3 * i) + 90 * Math.sin(now * 0.07 + i * 2.1);
          const ny = H * (0.2 + 0.08 * Math.sin(now * 0.05 + i));
          const nr = H * (0.35 + 0.05 * Math.sin(now * 0.11 + i * 1.7)) * (1 + 0.12 * e.bass);
          gr = g.createRadialGradient(nx, ny, 0, nx, ny, nr);
          gr.addColorStop(0, hsla(hue, 80, 45, 0.16 * col));
          gr.addColorStop(1, hsla(hue, 80, 45, 0));
          g.fillStyle = gr;
          g.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
        }
      }

      // Moon, halo and kick rings.
      const mx = W * 0.74, my = H * 0.2, mr = 34;
      const haloR = mr * (3.2 + 1.6 * e.pad);
      gr = g.createRadialGradient(mx, my, mr * 0.9, mx, my, haloR);
      gr.addColorStop(0, rgba(sch.moon, 0.22 + 0.25 * e.pad));
      gr.addColorStop(0.4, rgba(mixRGB(sch.moon, sch.mist, 0.6), 0.07 + 0.06 * e.pad));
      gr.addColorStop(1, rgba(sch.mist, 0));
      g.fillStyle = gr;
      g.fillRect(mx - haloR, my - haloR, haloR * 2, haloR * 2);
      if (ev.kick) this.moonRings.push({ t0: now, a: e.kickAmp });
      g.lineWidth = 1.5;
      for (let i = this.moonRings.length - 1; i >= 0; i--) {
        const r = this.moonRings[i];
        const age = now - r.t0;
        if (age > 1.4) { this.moonRings.splice(i, 1); continue; }
        const rr = mr * (1.2 + age * 5);
        g.strokeStyle = rgba(sch.moon, 0.4 * r.a * Math.min(1, react) * (1 - age / 1.4));
        g.beginPath();
        g.arc(mx, my, rr, 0, TAU);
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(sch.moon, 1);
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();
      // Maria: a few soft darker patches so it reads as a moon, not a lamp.
      g.fillStyle = rgba(mixRGB(sch.moon, sch.skyLow, 0.35), 0.2);
      for (const [dx, dy, rr] of [[-10, -8, 11], [8, 6, 8], [-4, 13, 6], [12, -12, 5]]) {
        g.beginPath();
        g.arc(mx + dx, my + dy, rr, 0, TAU);
        g.fill();
      }


      // ---- hills -------------------------------------------------------
      const drawHill = (pts, base, amp, color, hp) => {
        g.fillStyle = color;
        g.beginPath();
        const n = pts.length - 1;
        const span = W * 1.3;
        const shift = cam * hp;
        g.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 10; x += span / n) {
          const u = (((x + shift) / span) % 1 + 1) % 1 * n;
          const i = Math.floor(u), t = u - i;
          g.lineTo(x, base - amp * (0.6 + pts[i] + (pts[Math.min(n, i + 1)] - pts[i]) * t));
        }
        g.lineTo(W + 10, H + 10);
        g.closePath();
        g.fill();
      };
      drawHill(this.hillFar, horizon + 10, 55, rgba(mixRGB(sch.hillFar, sch.mist, 0.15 + 0.2 * e.pad), 1), 0.06);
      drawHill(this.hillNear, horizon + 32, 34, rgba(sch.hillNear, 1), 0.15);

      // Ground.
      gr = g.createLinearGradient(0, horizon + 30, 0, H);
      gr.addColorStop(0, rgba(sch.hillNear, 1));
      gr.addColorStop(1, rgba(sch.ground, 1));
      g.fillStyle = gr;
      g.fillRect(-W * 0.1, horizon + 30, W * 1.2, H - horizon);

      g.globalCompositeOperation = 'lighter';
      // Mist: a band of moonlit haze along the ground; bass swells it, the
      // drop tints it with the garden.
      const mistHue = sch.hues[0] + this.hueShift;
      const mistA = 0.1 + 0.18 * e.bass + 0.1 * e.pad;
      gr = g.createLinearGradient(0, horizon - 20, 0, waterY);
      gr.addColorStop(0, rgba(sch.mist, 0));
      gr.addColorStop(0.6, col > 0.05 ? hsla(mistHue, 30 + 50 * col, 35 + 10 * col, mistA) : rgba(sch.mist, mistA));
      gr.addColorStop(1, rgba(sch.mist, 0));
      g.fillStyle = gr;
      g.fillRect(-W * 0.1, horizon - 20, W * 1.2, waterY - horizon + 20);

      // ---- back grass ----------------------------------------------------
      const wind = params.wind;
      const swayAmp = wind * (0.35 + 1.4 * e.bass);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(mixRGB(sch.hillNear, [20, 60, 60], 0.25), 1);
      g.beginPath();
      for (const b of this.grassBack) {
        const bx = wrapX(b.u * W - cam * 0.3, W);
        const by = waterY - 44 + b.d * 46;
        const sw = swayAmp * 5 * Math.sin(now * 0.9 + b.ph + b.u * 6);
        const tx = bx + b.lean + sw, ty = by - b.h;
        g.moveTo(bx - b.w, by);
        g.quadraticCurveTo(bx, by - b.h * 0.5, tx, ty);
        g.quadraticCurveTo(bx + b.w * 0.3, by - b.h * 0.5, bx + b.w, by);
      }
      g.fill();

      // ---- flowers -------------------------------------------------------
      const order = this.flowers.slice().sort((a, b) => a.z - b.z);
      const sat = 18 + 80 * col;
      const size = 1;
      for (const f of order) {
        if (f.fade < 0.01 && f.grow < 0.01) continue;
        const sc = 0.42 + 0.78 * f.z;
        const bx = f.wx - cam * par(f.z);
        const by = waterY - 56 * (1 - f.z) + 2;
        const fullH = H * (0.1 + 0.36 * f.stemH) * sc;
        const sway = swayAmp * 18 * sc * (Math.sin(now * f.swayF + f.ph) + 0.4 * Math.sin(now * f.swayF * 2.3 + f.ph * 2));
        const gh = f.grow;
        const hx = bx + (f.lean + sway) * gh;
        const hy = by - fullH * gh;
        f.hx = hx; f.hy = hy;
        const fog = 0.5 + 0.5 * f.z;
        const alpha = fog * f.fade;

        // Stem and leaf.
        g.globalCompositeOperation = 'source-over';
        const stemL = 10 + 6 * f.z;
        g.strokeStyle = `rgba(${(8 + stemL) | 0},${(28 + stemL * 2) | 0},${(34 + stemL * 1.5) | 0},${Math.min(1, alpha * 1.4)})`;
        g.lineWidth = (1.4 + 2.2 * f.z) * size;
        const cx = bx + f.lean * 0.2 * gh, cy = by - fullH * gh * 0.55;
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(cx, cy, hx, hy);
        g.stroke();
        if (gh > 0.3) {
          const t = f.leafAt;
          const lx = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * hx;
          const ly = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * hy;
          const ll = 34 * sc * size * Math.min(1, (gh - 0.3) * 2);
          const dir = f.leafSide;
          const tipx = lx + dir * ll, tipy = ly - ll * 0.45 + sway * 0.2 * dir;
          g.fillStyle = g.strokeStyle;
          g.beginPath();
          g.moveTo(lx, ly);
          g.quadraticCurveTo(lx + dir * ll * 0.5, ly - ll * 0.55, tipx, tipy);
          g.quadraticCurveTo(lx + dir * ll * 0.55, ly + ll * 0.05, lx, ly);
          g.fill();
        }
        if (alpha < 0.01) continue;

        // Head.
        const R = 58 * sc * size;
        f.R = R;
        const hueBase = sch.hues[f.hueIdx] + f.hueJit + this.hueShift;
        const light = 52 + 8 * (1 - col);
        const openK = f.open;
        const [localKick, waveId] = flareAt(hx);
        const flare = Math.min(1.3, 1.25 * localKick) * clamp01(openK * 1.5) * (0.8 + 0.4 * f.z);
        const bloomPunch = f.state === 'open' ? Math.exp(-f.openAge / 0.35) * clamp01(react) : 0;
        g.globalCompositeOperation = 'lighter';

        // Glow behind the head.
        const glowR = R * (1.5 + 0.8 * flare + 0.6 * bloomPunch + 0.4 * e.bass) * (0.3 + 0.7 * openK);
        if (glowR > 1) {
          gr = g.createRadialGradient(hx, hy, 0, hx, hy, glowR);
          const ga = alpha * (0.07 + 0.13 * col + 0.2 * flare + 0.3 * bloomPunch) * (0.35 + 0.65 * openK);
          gr.addColorStop(0, hsla(hueBase, sat, light + 8, ga));
          gr.addColorStop(0.45, hsla(hueBase + 20, sat, light, ga * 0.4));
          gr.addColorStop(1, hsla(hueBase + 40, sat, light, 0));
          g.fillStyle = gr;
          g.fillRect(hx - glowR, hy - glowR, glowR * 2, glowR * 2);
        }

        // Petal rings, outer to inner, counter-rotating.
        const openLen = 0.18 + 0.82 * openK;
        const lens = [1.0, 0.74, 0.48];
        const widths = [0.36, 0.34, 0.3];
        for (let k = 0; k < 3; k++) {
          const n = f.n + (k === 2 ? 3 : 0);
          const rot = f.rot + now * f.spin * (k === 1 ? -1.4 : 1) + (k * Math.PI) / n + flare * 0.08 * (k === 1 ? -1 : 1);
          const L = R * lens[k] * openLen * (1 + (0.34 - 0.08 * k) * flare + 0.25 * bloomPunch)
            * (1 + 0.04 * Math.sin(now * 0.8 + k + f.ph));
          const Wd = L * widths[k] * (1 + 0.15 * flare) * (0.6 + 0.4 * openK);
          const r0 = R * 0.06;
          const pt = f.pointy;
          g.beginPath();
          for (let i = 0; i < n; i++) {
            const a = rot + (i * TAU) / n;
            const ca = Math.cos(a), sa = Math.sin(a);
            const tl = f.tilt;
            // local (along, across) -> screen
            const P = (u, v) => [hx + (u * ca - v * sa), hy + (u * sa + v * ca) * tl];
            const p0 = P(r0, 0);
            const c1 = P(L * 0.3, Wd);
            const c2 = P(L * (0.85 + 0.1 * pt), Wd * (0.9 - 0.7 * pt));
            const tip = P(L, 0);
            const c3 = P(L * (0.85 + 0.1 * pt), -Wd * (0.9 - 0.7 * pt));
            const c4 = P(L * 0.3, -Wd);
            g.moveTo(p0[0], p0[1]);
            g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], tip[0], tip[1]);
            g.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], p0[0], p0[1]);
          }
          const hk = hueBase + k * 38;
          const lk = light - 6 + k * 4 + 14 * flare;
          g.fillStyle = hsla(hk, sat, lk, alpha * (0.2 + 0.1 * col + 0.14 * flare) * (1 - 0.2 * k));
          // Fills screen rather than add, so crowded heads stay coloured
          // instead of summing to a white blot; strokes still add, for the neon.
          g.globalCompositeOperation = 'screen';
          g.fill();
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = hsla(hk + 18, sat * 0.95, Math.min(82, lk + 16), alpha * (0.5 + 0.3 * flare));
          g.lineWidth = (0.7 + 0.7 * f.z) * size;
          g.stroke();
        }

        // Seed head: phyllotaxis spiral, turning slowly, flaring gold on the kick.
        const seeds = 26 + ((f.n * 3) | 0);
        const sr = R * 0.2 * (0.5 + 0.5 * openK) * (1 + 0.2 * flare);
        const srot = -now * f.spin * 2.2;
        const dotR = (0.9 + 0.7 * f.z) * size * (1 + 0.6 * flare);
        g.fillStyle = hsla(hueBase + 180 + 20 * Math.sin(now * 0.3), 30 + 60 * col, 62 + 20 * flare, alpha * (0.55 + 0.45 * flare));
        g.beginPath();
        for (let i = 1; i <= seeds; i++) {
          const rr = sr * Math.sqrt(i / seeds);
          const a = i * 2.39996 + srot;
          const x = hx + Math.cos(a) * rr, y = hy + Math.sin(a) * rr * f.tilt;
          g.moveTo(x + dotR, y);
          g.arc(x, y, dotR, 0, TAU);
        }
        g.fill();

        // Kick pollen: a puff from each head as the ripple reaches it.
        if (flare > 0.45 && f.puffed !== waveId) {
          f.puffed = waveId;
          const nP = 2 + ((f.z * 3) | 0);
          for (let i = 0; i < nP; i++) {
            const a = this.rnd() * TAU;
            this.pollen.push({ x: hx, y: hy, vx: Math.cos(a) * 30 * sc, vy: -25 - this.rnd() * 45 * sc, t0: now, life: 1.2 + this.rnd(),
              hue: hueBase + 180, r: (1.2 + 1.5 * f.z) * size });
          }
        }

        // Snare burst: ring of light and sparks from the bud that just opened.
        if (f.burstPending) {
          f.burstPending = false;
          // A floor on the ring and spark size: a snare that opens a far bud must
          // still read across the room.
          this.rings.push({ x: hx, y: hy, t0: now, R: Math.max(R, 46), hue: hueBase, tilt: f.tilt });
          const nS = 26;
          for (let i = 0; i < nS; i++) {
            const a = (i / nS) * TAU + this.rnd() * 0.2;
            const sp = (140 + this.rnd() * 160) * Math.max(sc, 0.85);
            this.sparks.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * f.tilt, t0: now, life: 0.7 + this.rnd() * 0.4, hue: hueBase + this.rnd() * 60 });
          }
        }
      }

      // ---- particles ------------------------------------------------------
      g.globalCompositeOperation = 'lighter';
      if (this.pollen.length > 400) this.pollen.splice(0, this.pollen.length - 400);
      for (let i = this.pollen.length - 1; i >= 0; i--) {
        const q = this.pollen[i];
        const age = now - q.t0;
        if (age > q.life) { this.pollen.splice(i, 1); continue; }
        q.vx *= Math.exp(-1.2 * dt); q.vy *= Math.exp(-0.9 * dt);
        q.x += (q.vx + 8 * Math.sin(now * 1.3 + q.t0 * 7)) * dt; q.y += (q.vy - 6) * dt;
        const a = (1 - age / q.life);
        g.fillStyle = hsla(q.hue, 20 + 70 * col, 75, a * 0.9);
        g.beginPath();
        g.arc(q.x, q.y, q.r, 0, TAU);
        g.fill();
      }
      g.lineWidth = 2;
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        const age = now - r.t0;
        if (age > 0.9) { this.rings.splice(i, 1); continue; }
        const k = age / 0.9;
        const rr = r.R * (0.8 + 3.2 * (1 - Math.pow(1 - k, 2.5)));
        g.strokeStyle = hsla(r.hue + 30, 40 + 55 * col, 72, 0.75 * (1 - k) * Math.min(1, react));
        g.lineWidth = 3 * (1 - k) + 0.6;
        g.beginPath();
        g.ellipse(r.x, r.y, rr, rr * r.tilt, 0, 0, TAU);
        g.stroke();
      }
      g.lineWidth = 1.6;
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        const age = now - s.t0;
        if (age > s.life) { this.sparks.splice(i, 1); continue; }
        s.vx *= Math.exp(-3 * dt); s.vy = s.vy * Math.exp(-3 * dt) + 40 * dt;
        const x0 = s.x, y0 = s.y;
        s.x += s.vx * dt; s.y += s.vy * dt;
        const a = 1 - age / s.life;
        g.strokeStyle = hsla(s.hue, 40 + 55 * col, 78, a);
        g.beginPath();
        g.moveTo(x0 - s.vx * 0.03, y0 - s.vy * 0.03);
        g.lineTo(s.x, s.y);
        g.stroke();
      }

      // ---- fireflies --------------------------------------------------------
      const nFlies = Math.round(FLIES_MAX * params.flies * (0.3 + 0.45 * col + 0.1 * e.high) / 2);
      if (ev.hat) {
        for (let i = 0; i < nFlies; i++) if (this.rnd() < 0.3) this.flies[i].flash = 1;
      }
      const flyHue = sch.fly + this.hueShift * 0.15;
      const spr = this.flySprite(flyHue);
      for (let i = 0; i < FLIES_MAX; i++) {
        const q = this.flies[i];
        q.flash *= Math.exp(-dt / 0.13);
        if (i >= nFlies) continue;
        const x = wrapX((q.x0 + q.ax * Math.sin(now * q.f1 + q.p1) + 0.05 * Math.sin(now * q.f3 + q.p3)) * W * 1.1 - W * 0.05 - cam * (0.3 + 0.7 * q.z), W);
        const y = (q.y0 + q.ay * Math.sin(now * q.f2 + q.p2)) * H;
        const glowOn = q.base * (0.6 + 0.4 * Math.sin(now * 1.7 + q.glowPh)) + q.flash * Math.min(1, react);
        const r = (3 + 5 * q.z) * (1 + 1.1 * q.flash);
        g.globalAlpha = Math.min(1, glowOn);
        g.drawImage(spr, x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
      }
      g.globalAlpha = 1;

      // ---- lake -----------------------------------------------------------
      this.reflect(g, W, H, waterY, now, e, sch);
      // Moon path: glints on the water under the moon; hats make them sparkle.
      g.globalCompositeOperation = 'lighter';
      const hatNow = Math.exp(-(now - e.lastHat) / 0.09) * Math.min(1, react);
      for (let i = 0; i < 46; i++) {
        const d = Math.pow((i + 0.5) / 46, 1.25);
        const y = waterY + 4 + d * (H - waterY);
        const spread = 10 + 70 * d;
        const x = mx + spread * Math.sin(i * 12.9898 + now * (0.6 + (i % 5) * 0.21)) * 0.9;
        const tw = 0.5 + 0.5 * Math.sin(now * (2.3 + (i % 7) * 0.7) + i * 1.7);
        const flash = hatNow * ((i * 7 + Math.floor(e.lastHat * 50)) % 3 === 0 ? 1 : 0.25);
        const a = (0.12 + 0.25 * tw * tw + 0.35 * e.pad * tw) * (1 - 0.5 * d) + 0.7 * flash;
        const len = (6 + 22 * d) * (0.6 + 0.4 * tw);
        g.fillStyle = rgba(sch.moon, Math.min(1, a));
        g.fillRect(x - len / 2, y, len, 0.8 + 1.6 * d);
      }
      // The waterline catches the moonlight, brighter with the bass.
      gr = g.createLinearGradient(0, waterY - 3, 0, waterY + 5);
      gr.addColorStop(0, rgba(sch.mist, 0));
      gr.addColorStop(0.5, rgba(mixRGB(sch.mist, sch.moon, 0.5), 0.1 + 0.15 * e.bass));
      gr.addColorStop(1, rgba(sch.mist, 0));
      g.fillStyle = gr;
      g.fillRect(-W * 0.1, waterY - 3, W * 1.2, 8);

      // ---- foreground grass ----------------------------------------------
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(mixRGB(sch.ground, [0, 0, 0], 0.4), 1);
      g.beginPath();
      for (const b of this.grassFront) {
        const bx = wrapX(b.u * W - cam * 1.7, W);
        const by = H + 6;
        const sw = swayAmp * 14 * Math.sin(now * 0.7 + b.ph + b.u * 4);
        const tx = bx + b.lean + sw, ty = by - b.h;
        g.moveTo(bx - b.w, by);
        g.quadraticCurveTo(bx - b.w * 0.2 + b.lean * 0.2, by - b.h * 0.55, tx, ty);
        g.quadraticCurveTo(bx + b.w * 0.4 + b.lean * 0.3, by - b.h * 0.5, bx + b.w, by);
      }
      g.fill();

      g.restore();

      // Vignette.
      g.save();
      g.globalCompositeOperation = 'source-over';
      const vr = Math.hypot(W, H) * 0.6;
      gr = g.createRadialGradient(W / 2, H * 0.45, vr * 0.45, W / 2, H * 0.45, vr);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.restore();
    },
  });
})();
