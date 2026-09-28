// Skyline — fireworks over a city at night, seen from a boat drifting down
// the river opposite.
//
// Layers, back to front: a dusk gradient sky with a few stars; drifting smoke
// left by every shell, lit from below by the bass and by fresh bursts; the
// fireworks themselves (shells, stars, glitter sparks) on a persistence
// buffer so every star draws its own trail; a soft bloom of light where each
// shell breaks; the city in three parallax layers (far haze, downtown, the
// waterfront) sliding past as the boat drifts; and the river, a rippled, squashed reflection of everything above
// it with glints on the water.
//
// The music:
//   kick   the shells are timed to the beat. Each kick breaks every shell in
//          flight (a white-hot core, a bloom of its colour, stars flung out)
//          and launches the next ones, which rise for one beat interval so
//          they arrive exactly on the following kick. The burst IS the beat.
//          The kick stays local: one burst carries a bloom, the rest of
//          the sky is left alone (see the jolt note below).
//   clap   a salute: a row of white strobe pops ripples across the sky, left
//          to right, and the water flashes with glints. The build's snare
//          roll fires crackling comets up instead, a rising barrage.
//   bass   lifts the smoke glow and the horizon; ripples the river harder.
//   hats   strobe the glitter stars, throw sparks off every glitter shell,
//          twinkle the sky, flicker the city's windows and glint the water.
//   drift  the boat's speed follows kick rate, bass and pad, eased over
//          seconds: the drop carries the city past faster, the breakdown
//          slows it. Speed changes, never a jerk.
//   drop   a finale: each kick sends up two to four shells and every fourth
//          kick a fan of palms. With no kick the show exhales into slow gold
//          willows that hang and drip.
//
// Craft notes:
// - Jolt (2026-09-28, Raph: batch 02 "too pulsey"): nothing global moves on
//   the kick. No sidechain dip of the older stars, no flash in the horizon,
//   smoke or water, and only the lead burst of each kick gets a bloom. A
//   new burst stands out by burning white-hot and thick for 0.16 s instead.
// - Stars share colour and age per burst, so a burst is one stroke call no
//   matter how many stars it has. Trails come from fading the buffer, not
//   from per-star history.
// - The persistence buffer is 8-bit. A black wash never takes it fully to
//   black (v * 0.86 rounds back to v below ~3/255), which is invisible over
//   the sky; a float16 buffer fixes it but rasterises far slower in software.
// - Everything soft (horizon glow, lit smoke, the blooms) lives on quarter-
//   resolution layers: large blurry sprites are the expensive part of a
//   Canvas 2D frame and nobody can see their resolution.
// - The river is rebuilt from those layers at half resolution, flipped, and
//   drawn back in thin strips with a horizontal ripple. It never reads the
//   live canvas: that forces the whole frame to rasterise mid-draw.

(function () {
  const TAU = Math.PI * 2;
  const MAX_SPARKS = 7000;
  const SMOKE = 0.6;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
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
  const rnd = (a, b) => a + (b - a) * Math.random();
  function hsl(c, a, lift) {
    const l = lift ? c[2] + (95 - c[2]) * lift : c[2];
    const s = lift ? c[1] * (1 - 0.7 * lift) : c[1];
    return `hsla(${c[0].toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(3)})`;
  }

  // Skies: gradient stops top to horizon, the horizon glow colour, the
  // water's own tint, and the far city's haze colour.
  const SKIES = [
    { // Dusk: the last of the light is plum and ember at the horizon.
      stops: [[0, '#04030c'], [0.45, '#0d0a28'], [0.75, '#2a1440'], [0.92, '#562347'], [1, '#7a3448']],
      glow: [18, 80, 55], water: '3,4,14', far: '#1c1230', near: '#050409',
    },
    { // Midnight: deep navy, cold city glow.
      stops: [[0, '#010207'], [0.5, '#050b20'], [0.85, '#0f1d40'], [1, '#243a66']],
      glow: [215, 70, 55], water: '1,3,10', far: '#0d1630', near: '#020308',
    },
    { // Violet hour: saturated, psychedelic, a teal seam under magenta.
      stops: [[0, '#07021a'], [0.45, '#1c0640'], [0.78, '#4a0e5e'], [0.93, '#8a1f6e'], [1, '#2a8a96']],
      glow: [300, 85, 55], water: '6,2,18', far: '#24103c', near: '#06030c',
    },
  ];

  // Colour schemes for the shells. Each returns [h, s, l] triples: the
  // star's first colour, the colour it changes to, and the pistil (inner
  // core) colour. Colour-changing stars are what real Japanese shells do and
  // what keeps the eye on a burst after it breaks.
  const GOLD = [40, 90, 58], SILVER = [220, 25, 88], WHITE = [50, 30, 92];
  function scheme(mode, H) {
    const r = Math.random();
    if (mode === 1) { // Classic
      const set = [[0, 95, 55], [120, 85, 50], [215, 95, 60], GOLD, SILVER, [285, 80, 62], [25, 100, 55]];
      const a = set[(r * set.length) | 0];
      const b = Math.random() < 0.35 ? set[(Math.random() * set.length) | 0] : a;
      return [a, b, Math.random() < 0.5 ? GOLD : SILVER];
    }
    if (mode === 2) { // Neon
      const set = [[315, 100, 60], [185, 100, 55], [95, 100, 55], [240, 100, 66], [45, 100, 58]];
      const i = (r * set.length) | 0;
      return [set[i], set[(i + 1 + ((Math.random() * 3) | 0)) % set.length], set[(i + 2) % set.length]];
    }
    if (mode === 3) { // Gold & silver
      const a = r < 0.6 ? [34 + 12 * Math.random(), 90, 55] : SILVER;
      return [a, Math.random() < 0.5 ? WHITE : GOLD, Math.random() < 0.5 ? [15, 100, 55] : GOLD];
    }
    // Kaleidoscope: a harmony around a slowly travelling base hue: the base,
    // its neighbour and its complements. Stars change to the complement.
    if (r < 0.12) return [GOLD, [H + 180, 95, 62], [H, 95, 60]];
    const off = [0, 35, 180, 210][(Math.random() * 4) | 0];
    const a = [(H + off) % 360, 95, 60];
    const b = [(H + off + 150 + 60 * Math.random()) % 360, 95, 62];
    return [a, b, Math.random() < 0.5 ? WHITE : [(H + off + 90) % 360, 90, 65]];
  }

  VIZ.register({
    id: 'skyline',
    name: 'Skyline',
    order: 203,

    params: [
      { key: 'shells', label: 'Shells', type: 'select',
        options: ['Mixed show', 'Gold willows', 'Rings & crossettes', 'Glitter strobes'], default: 0 },
      { key: 'mirror', label: 'Symmetry', type: 'select', options: ['Off', 'Mirror'], default: 0 },
      { key: 'colours', label: 'Colours', type: 'select',
        options: ['Kaleidoscope', 'Classic', 'Neon', 'Gold & silver'], default: 0 },
      { key: 'sky', label: 'Sky', type: 'select', options: ['Dusk', 'Midnight', 'Violet hour'], default: 0 },
      { key: 'size', label: 'Finale size', type: 'range', min: 0.3, max: 2, default: 1, step: 0.01 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'trails', label: 'Trails', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'drift', label: 'Drift speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'finale', label: 'Fire a finale', run() { this.pendingFinale = true; } },
    ],

    gallery: {
      title: 'Skyline',
      technique: 'Canvas 2D: three wrapping parallax skyline layers scrolled by a music-driven drift, particle fireworks on a persistence buffer composited additively, quarter-resolution sprite blooms, lit smoke and horizon glow, a procedurally built skyline, and a river rebuilt from those layers at half resolution and drawn back in rippled strips',
      brief: 'Fireworks over a city across a river. Shells are timed to the kick: each beat breaks every shell in flight with a white-hot core and a bloom of colour, and launches the next, which rises for exactly one beat; only that one place in the sky lights up. The clap fires a salute, a row of white strobe pops rippling across the sky with glints on the water; hats strobe the glitter, flicker the windows and twinkle the sky; the bass lights the smoke and the horizon from below. The drop is a finale of multiple shells per beat and fans of palms; the breakdown exhales into slow gold willows. All the while the view drifts downriver, the waterfront, downtown and far city sliding past at different speeds with their reflections, faster in the drop and slower in the breakdown. Stars change colour as they fall, the river doubles everything, and a Mirror symmetry turns the show into a slow kaleidoscope.',
      lineage: [
        'Brief 03 (batch 02): dusky sky, fireworks with gravity, drag, glitter and smoke, a skyline with lit windows, the river reflecting everything; kicks launch, the snare bursts, hats flicker windows, bass lifts smoke, the drop is a finale.',
        'Timing decision: a launch is not a punch (a comet leaving the ground is small and the eye does not catch its start), so shells launched on one kick rise for one estimated beat interval and are broken by the next. Every kick is a burst; the launch is the anticipation. With no kick for a second, shells fall back to rising on their own and breaking at the apex, which is what makes the breakdown read as an exhale.',
        'Snare as a different shape rather than a bigger kick: a salute row of small white strobe pops rippling across the sky in 150 ms. Roll hits (short gaps, low level) fire crackling comets instead, so the build\'s snare roll becomes a rising barrage.',
        'Persistence buffer, not per-star history, for trails. Colour-changing and pistil stars (Japanese shell craft) and a slowly travelling harmony hue for "Kaleidoscope", so colour moves with intent rather than cycling.',
        'Render 1: the idea worked (drop obviously bigger, kick bursts land) but the city was a wall of black taking half the stage, slits between towers showed the horizon as red lines to the water, the reflection banded into stripes (translucent overlapping strips), and the frame cost was absurd: a float16 buffer and reading the live canvas back for the reflection. Fixed: a low waterfront with a downtown cluster, windows lit in floors, opaque strips, 8-bit buffer, the river rebuilt from layers, soft light on quarter-resolution layers.',
        'Render 2: the drop sky became a gold-white wall (gold embers from every chrysanthemum) and the salute row was lost in it. Fewer shells per kick, fewer embers, and the salute moved down to the rooftops, where kick shells never break: kick high, clap low, and the towers stand backlit on every clap. Willows rebuilt as near-still drip sparks so a strand traces the star\'s whole path.',
        'Kick strip on a dense finale: the new burst was visible but competed with the sky full of older stars. Added a sidechain duck: on each kick every star older than 0.1 s dips about 45% and recovers over ~0.2 s, so the sky pumps with the kick and the fresh burst stands clear.',
        'Render 3 (full size, and square with Mirror): full size read well; Mirror in a square blew out to white, since everything soft was drawn twice over a narrow sky. Mirror now keeps shells to the left half (the mirror supplies the right), sends up fewer, and halves the soft light; shells shrink on narrow stages. Stars switched from stroked segments to runs of squares after profiling showed stroking was most of the frame.',
        'Batch 02 feedback (2026-09-28): "too pulsey", and wanted more movement. Jolt meter before: kickArea 0.44, ratio 2.24, noticeable; the heat map lit most of the sky and the water on every kick (the sidechain dip, two or three big blooms, flash-driven horizon, smoke and water glints). Removed the dip and every flash-driven global term, shrank the blooms and gave only one burst per kick a bloom, and made new bursts stand out by burning white-hot longer and thicker. The salute glint on the water is halved. After: kickArea 0.13, ratio 1.47, calm, and the heat map shows the kick as one or two hot spots plus the salute\'s row of dots.',
        'Movement: the city is rebuilt as three wrapping layers (far haze 2 stages wide, downtown 2.5 with two tall clusters per lap, waterfront 1.5) scrolled at 0.18 / 0.42 / 1 of a drift whose speed follows kick rate, bass and pad, eased over about three seconds. The river is rebuilt from the scrolled layers, so the reflections follow. Drift speed replaces the Smoke slider (smoke fixed at 0.6) to keep eight controls.',
      ],
    },

    // ------------------------------------------------------------------ state

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.t = 0;
      this.lastMs = null;
      this.shells = [];
      this.bursts = [];
      this.blooms = [];
      this.puffs = [];
      this.queue = [];
      this.sx = new Float32Array(MAX_SPARKS); this.sy = new Float32Array(MAX_SPARKS);
      this.svx = new Float32Array(MAX_SPARKS); this.svy = new Float32Array(MAX_SPARKS);
      this.sd = new Float32Array(MAX_SPARKS); this.sk = new Uint8Array(MAX_SPARKS);
      this.sl = new Float32Array(MAX_SPARKS);
      this.si = 0;
      this.hist = { k: [0, 0, 0], c: [0, 0, 0], h: [0, 0, 0] };
      this.lastKick = -10; this.lastClap = -10; this.lastHat = -10;
      this.kickTimes = [];
      this.beat = 0.484;
      this.kickCount = 0;
      this.energy = 0; this.bass = 0; this.pad = 0; this.hat = 0; this.glint = 0;
      this.flash = 0; this.flashHue = 40; this.lastBloom = -10; this.cam = 0; this.speed = 8;
      this.autoTimer = 0.8;
      this.hue = 330 * Math.random();
      this.spread = Math.random();
      this.pendingFinale = false;
      if (this.fx) this.clearFx();
    },

    // --------------------------------------------------------------- buffers

    ensureBuffers(p, W, H, params) {
      const pd = p.pixelDensity();
      const dw = Math.round(p.width * pd), dh = Math.round(p.height * pd);
      const skyMode = params.sky | 0;
      if (this.dw === dw && this.dh === dh && this.skyMode === skyMode) return;
      this.dw = dw; this.dh = dh; this.skyMode = skyMode;
      this.k = dw / W;
      this.W = W; this.H = H;
      this.yW = Math.round(H * 0.72);

      if (!this.fx) {
        this.fx = document.createElement('canvas');
        this.fxg = this.fx.getContext('2d', { alpha: false });
        this.soft = document.createElement('canvas');     // additive: horizon, lit smoke, blooms
        this.softg = this.soft.getContext('2d');
        this.smk = document.createElement('canvas');      // smoke bodies, drawn over the sky
        this.smkg = this.smk.getContext('2d');
        this.refl = document.createElement('canvas');
        this.reflg = this.refl.getContext('2d');
      }
      this.fx.width = dw; this.fx.height = dh;
      this.clearFx();
      this.qk = this.k / 4;
      this.soft.width = this.smk.width = Math.max(2, Math.round(dw / 4));
      this.soft.height = this.smk.height = Math.max(2, Math.round(dh / 4));
      this.refl.width = Math.max(2, Math.round(dw / 2));
      this.refl.height = Math.max(2, Math.round((H - this.yW) * this.k / 2));

      this.buildSky(W, H);
      this.buildCity(W, H);
      this.buildSprites();
    },

    clearFx() {
      const g = this.fxg;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.fillRect(0, 0, this.fx.width, this.fx.height);
    },

    canvas(W, H) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W * this.k));
      c.height = Math.max(1, Math.round(H * this.k));
      const g = c.getContext('2d');
      g.setTransform(this.k, 0, 0, this.k, 0, 0);
      return [c, g];
    },

    buildSky(W, H) {
      const sky = SKIES[this.skyMode] || SKIES[0];
      const [c, g] = this.canvas(W, this.yW + 2);
      const gr = g.createLinearGradient(0, 0, 0, this.yW);
      for (const [o, col] of sky.stops) gr.addColorStop(o, col);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, this.yW + 2);
      this.skyC = c;

      // Horizon glow: drawn additively with an alpha that follows the bass.
      // It is a vertical ramp only, so a sliver stretched across is enough.
      const hc = document.createElement('canvas');
      hc.width = 4; hc.height = 128;
      const hg = hc.getContext('2d');
      const g2 = hg.createLinearGradient(0, 0, 0, 128);
      g2.addColorStop(0, hsl(sky.glow, 0));
      g2.addColorStop(0.55, hsl(sky.glow, 0.25));
      g2.addColorStop(1, hsl(sky.glow, 0.9));
      hg.fillStyle = g2;
      hg.fillRect(0, 0, 4, 128);
      this.glowC = hc;

      const r = mulberry(7);
      this.stars = [];
      for (let i = 0; i < 160; i++) {
        this.stars.push({ x: r() * W, y: Math.pow(r(), 1.6) * this.yW * 0.7, s: 0.5 + r() * 1.1, ph: r() * TAU, b: 0.2 + 0.6 * r() });
      }
    },

    // The city in three wrapping layers that slide past at different
    // speeds, as seen from a boat drifting down the river: a far layer in
    // haze, downtown (two tall clusters per lap, lit windows, beacons) and
    // a low waterfront with the promenade lamps. Each layer is one canvas a
    // few stages wide; buildings that cross its seam are drawn at both ends
    // so the lap is seamless.
    buildCity(W, H) {
      const sky = SKIES[this.skyMode] || SKIES[0];
      const r = mulberry(1234);
      const yW = this.yW;
      const top = Math.max(0, Math.floor(yW - yW * 0.5 - 90));
      this.cityTop = top;
      const bandH = yW + 1 - top;

      const mkLayer = (tw) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(tw * this.k));
        c.height = Math.max(1, Math.round(bandH * this.k));
        const g = c.getContext('2d');
        g.setTransform(this.k, 0, 0, this.k, 0, -top * this.k);
        return { c, g, tw };
      };
      // Distance around the lap, for clusters that wrap.
      const wrapD = (x, cx, tw) => { const d = Math.abs(x - cx) % tw; return Math.min(d, tw - d); };

      const build = (L, spec) => {
        const { g, tw } = L;
        const list = [];
        let x = 0;
        while (x < tw) {
          const w = spec.w0 + r() * spec.w1;
          let tall = 0;
          for (const cx of spec.clusters) { const d = wrapD(x + w / 2, cx * tw, tw) / W; tall = Math.max(tall, Math.exp(-d * d * 22)); }
          let h = spec.h0 + r() * spec.h1 + tall * spec.hc * (0.3 + r());
          if (spec.landmarks && r() < 0.05) h += 40 + r() * 40;
          h = Math.min(h, yW * 0.5);
          list.push({ x, w, h, kind: r(), seed: (r() * 1e9) | 0, gap: 0 });
          x += w + (r() < spec.gapP ? 3 + r() * spec.gapW : 0);
        }
        const beacons = [], flick = [], lamps = [];
        for (const pass of [0, 1]) {         // 0: silhouettes, 1: windows over them
          for (const bd of list) {
            for (const off of bd.x + bd.w > tw ? [0, -tw] : [0]) {
              const rr = mulberry(bd.seed);
              const x0 = bd.x + off, w = bd.w, h = bd.h, t0 = yW - h;
              const setback = bd.kind < 0.18 && w > 22, spire = !setback && bd.kind < 0.3;
              if (pass === 0) {
                g.fillStyle = spec.color;
                g.beginPath();
                if (setback) { const i = w * 0.2; g.rect(x0, t0 + h * 0.25, w, h); g.rect(x0 + i, t0, w - 2 * i, h * 0.3); }
                else if (spire) { g.rect(x0, t0, w, h); g.moveTo(x0 + w * 0.3, t0); g.lineTo(x0 + w / 2, t0 - 18 - rr() * 30); g.lineTo(x0 + w * 0.7, t0); }
                else if (bd.kind < 0.38 && spec.slants) { g.moveTo(x0, yW); g.lineTo(x0, t0 + 10); g.lineTo(x0 + w, t0 - 8); g.lineTo(x0 + w, yW); }
                else g.rect(x0, t0, w, h);
                g.fill();
                if (spec.beacons && (h > 150 || spire) && rr() < 0.8) {
                  const ah = 8 + rr() * 22, ay = t0 - ah - (spire ? 40 : 0);
                  g.fillRect(x0 + w / 2 - 0.5, ay, 1, t0 - ay + 2);
                  if (off === 0) beacons.push({ x: bd.x + w / 2, y: ay, ph: rr() * TAU });
                }
                continue;
              }
              if (!spec.windows) continue;
              const wtop = setback ? t0 + h * 0.25 : t0 + 10;
              const cols = Math.max(1, Math.floor((w - 4) / 4.5));
              const rows = Math.floor((yW - wtop - spec.floorGap) / 6);
              const office = rr() < 0.35;
              const density = spec.windows * (0.05 + 0.3 * rr() * rr());
              for (let j = 0; j < rows; j++) {
                const lit = rr() < 0.25 ? 0.75 : density;
                for (let i = 0; i < cols; i++) {
                  const on = rr() <= lit, fl = rr() < 0.25, a = 0.3 + 0.5 * rr(), ci = (rr() * 3) | 0;
                  if (!on) continue;
                  const wx = x0 + 3 + i * 4.5, wy = wtop + 5 + j * 6;
                  if (fl && spec.flicker) { if (off === 0) flick.push({ x: bd.x + 3 + i * 4.5, y: wy, cool: office, on: rr() < 0.5 }); continue; }
                  g.globalAlpha = a;
                  g.fillStyle = office ? ['#bfe4ff', '#9fd0ff', '#e8f4ff'][ci] : ['#ffcf7a', '#ffb65c', '#ffe3a8'][ci];
                  g.fillRect(wx, wy, 1.8, 2.6);
                }
              }
              g.globalAlpha = 1;
            }
          }
        }
        if (spec.lamps) for (let lx = 4 + r() * 6; lx < tw - 10; lx += 14 + r() * 6) lamps.push({ x: lx, ph: r() * TAU });
        return { beacons, flick, lamps };
      };

      const far = mkLayer(W * 2);
      build(far, { w0: 8, w1: 22, h0: 30, h1: 40, hc: 120, clusters: [0.2, 0.62], color: sky.far, gapP: 1, gapW: 1, floorGap: 6 });
      // Haze over the far layer so it sits back.
      const hz = far.g.createLinearGradient(0, yW - 140, 0, yW);
      hz.addColorStop(0, hsl(sky.glow, 0));
      hz.addColorStop(1, hsl(sky.glow, 0.18));
      far.g.fillStyle = hz;
      far.g.fillRect(0, yW - 140, far.tw, 141);

      const down = mkLayer(W * 2.5);
      const dt = build(down, { w0: 14, w1: 34, h0: 26, h1: 34, hc: 120, clusters: [0.28, 0.74], landmarks: true, slants: true,
        color: sky.near, gapP: 0.2, gapW: 10, beacons: true, windows: 1, flicker: true, floorGap: 22 });

      // The waterfront passes fastest and hides the bottom of downtown: warehouses,
      // low blocks, and the promenade.
      const front = mkLayer(W * 1.5);
      const ft = build(front, { w0: 18, w1: 50, h0: 8, h1: 22, hc: 0, clusters: [], color: sky.near, gapP: 0.15, gapW: 6,
        windows: 0.6, floorGap: 4, lamps: true });
      front.g.fillStyle = sky.near;
      front.g.fillRect(0, yW - 4, front.tw, 5);

      this.layers = [
        { L: far, f: 0.18 }, { L: down, f: 0.42 }, { L: front, f: 1 },
      ];
      this.flick = dt.flick;
      this.beacons = dt.beacons;
      this.lamps = ft.lamps;
      this.downTw = down.tw; this.frontTw = front.tw;
    },

    // Scroll offset of a layer: how far the boat has drifted, times its parallax.
    layerOff(f, tw) { const o = (this.cam * f) % tw; return o < 0 ? o + tw : o; },

    drawCity(g, afterDowntown) {
      const W = this.W, top = this.cityTop, bh = this.yW + 1 - top;
      this.layers.forEach(({ L, f }, i) => {
        const o = this.layerOff(f, L.tw);
        g.drawImage(L.c, -o, top, L.tw, bh);
        if (L.tw - o < W) g.drawImage(L.c, L.tw - o, top, L.tw, bh);
        if (i === 1 && afterDowntown) afterDowntown();
      });
    },

    buildSprites() {
      this.spriteCache = new Map();
      const mk = (stops) => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        for (const [o, col] of stops) gr.addColorStop(o, col);
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        return c;
      };
      this.coreSprite = mk([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,250,235,0.8)'], [0.5, 'rgba(255,235,200,0.2)'], [1, 'rgba(255,220,180,0)']]);
      this.smokeSprite = mk([[0, 'rgba(70,64,90,0.55)'], [0.5, 'rgba(50,46,70,0.3)'], [1, 'rgba(40,36,60,0)']]);
      this.mk = mk;
    },

    // A soft coloured glow, cached by hue so tinting costs nothing per frame.
    glow(h, s) {
      const key = ((Math.round(h / 8) * 8) % 360) * 1000 + Math.round(s / 10) * 10;
      let c = this.spriteCache.get(key);
      if (!c) {
        const hh = (Math.round(h / 8) * 8) % 360, ss = Math.round(s / 10) * 10;
        c = this.mk([[0, `hsla(${hh},${ss}%,70%,1)`], [0.25, `hsla(${hh},${ss}%,58%,0.45)`],
          [0.6, `hsla(${hh},${ss}%,50%,0.1)`], [1, `hsla(${hh},${ss}%,50%,0)`]]);
        this.spriteCache.set(key, c);
      }
      return c;
    },

    // ----------------------------------------------------------------- music

    listen(sig, dt, params) {
      const t = this.t;
      const h = this.hist;
      const kick = sig[0] / 100;
      const clap = (sig[3] + sig[4] + sig[5]) / 300;
      const hat = (sig[6] + sig[7] + sig[8]) / 300;
      // Onsets: a rise over the last two frames, above a floor, with a
      // refractory gap. Two frames so an FFT-smeared attack still counts.
      const kOn = kick - Math.min(h.k[0], h.k[1]) > 0.2 && kick > 0.5 && t - this.lastKick > 0.22;
      const cOn = clap - Math.min(h.c[0], h.c[1]) > 0.14 && clap > 0.3 && t - this.lastClap > 0.09;
      const hOn = hat - Math.min(h.h[0], h.h[1]) > 0.1 && hat > 0.2 && t - this.lastHat > 0.07;
      h.k[1] = h.k[0]; h.k[0] = kick;
      h.c[1] = h.c[0]; h.c[0] = clap;
      h.h[1] = h.h[0]; h.h[0] = hat;

      this.bass = ease(this.bass, (sig[1] + sig[2]) / 200, 2.5, dt);
      this.pad = ease(this.pad, (sig[2] + sig[3] + sig[4]) / 300, 1, dt);
      this.hat = Math.max(this.hat * Math.exp(-dt / 0.07), 0);
      this.glint = this.glint * Math.exp(-dt / 0.18);

      while (this.kickTimes.length && t - this.kickTimes[0] > 2.5) this.kickTimes.shift();
      const rate = clamp(this.kickTimes.length / 4.5, 0, 1);
      this.energy = ease(this.energy, rate, rate > this.energy ? 1.5 : 0.45, dt);

      if (kOn) this.onKick(kick, params);
      if (cOn) this.onClap(clap, params);
      if (hOn) this.onHat(hat);
    },

    onKick(strength, params) {
      const t = this.t;
      const gap = t - this.lastKick;
      if (gap > 0.3 && gap < 0.9) this.beat = ease(this.beat, gap, 3, 1);
      this.lastKick = t;
      this.kickTimes.push(t);
      this.kickCount++;

      // Break every armed shell that has had time to climb.
      let broke = 0;
      for (const s of this.shells) {
        if (s.armed && !s.dead && t - s.born > 0.22) { this.breakShell(s, strength, params); broke++; }
      }
      // A kick is always a burst, even when nothing was in flight.
      if (!broke) {
        const [x, y] = this.target();
        this.burst(x, y, this.kickKind(params), strength, params);
      }
      // Launch the next ones: they arrive on the next beat.
      let n = Math.min(4, 1 + Math.floor(this.energy * params.size * 1.25 + Math.random() * 0.5));
      // Mirrored, every shell is drawn twice: send up fewer.
      if ((params.mirror | 0) === 1) n = Math.max(1, Math.round(n * 0.55));
      for (let i = 0; i < n; i++) this.launch(true, this.beat * 0.97, null, params);
      if (this.energy > 0.55 && this.kickCount % 4 === 0) {
        // A fan of palms from one point behind the city.
        const bx = this.mirrored ? this.W * (0.2 + 0.2 * Math.random()) : this.W * (0.3 + 0.4 * Math.random());
        const m = Math.round((this.mirrored ? 2 : 3) + 2 * params.size);
        for (let i = 0; i < m; i++) {
          const f = m === 1 ? 0 : i / (m - 1) - 0.5;
          this.launch(true, this.beat * 0.97, { x0: bx, x1: bx + f * this.W * 0.55, y1: this.yW * (0.3 + 0.12 * Math.abs(f)), kind: 'palm' }, params);
        }
      }
    },

    onClap(level, params) {
      const t = this.t;
      const gap = t - this.lastClap;
      this.lastClap = t;
      if (level > 0.45 && gap > 0.3) {
        // Salute: a row of white strobe pops rippling along the rooftops.
        // Low, where the kick's shells never break, so the clap has its own
        // place on the stage; the tall towers stand backlit against it.
        const n = Math.round(5 + 2 * params.size);
        const y = this.yW * (0.6 + 0.08 * Math.random());
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          const x = this.W * (0.08 + 0.84 * (dir > 0 ? f : 1 - f));
          const yy = y + Math.sin(f * Math.PI) * -this.yW * 0.05 + rnd(-6, 6);
          if ((params.mirror | 0) === 1 && x > this.W / 2) continue;   // the mirror completes the row
          this.queue.push({ t: t + i * 0.022, fn: () => this.burst(x, yy, 'pop', level, params) });
        }
        this.glint = 1;
      } else {
        // Roll hit: a crackling comet climbing out of the city.
        this.launch(false, 0.7 + Math.random() * 0.3, { comet: true, x1j: 30 }, params);
      }
    },

    onHat(level) {
      this.lastHat = this.t;
      this.hat = Math.max(this.hat, clamp(level * 1.4, 0, 1));
      // Windows: a handful of lights go on or off.
      const f = this.flick;
      if (f && f.length) {
        const n = Math.max(1, Math.round(f.length * 0.06));
        for (let i = 0; i < n; i++) { const w = f[(Math.random() * f.length) | 0]; w.on = !w.on; }
      }
      // Glitter shells throw sparks.
      for (const b of this.bursts) {
        if (!b.glitter) continue;
        const step = b.n > 60 ? 2 : 1;
        for (let i = 0; i < b.n; i += step) {
          if (b.die[i] <= this.t - b.born) continue;
          this.spark(b.x_[i], b.y_[i], rnd(-25, 25), rnd(-25, 15), rnd(0.15, 0.35), 1);
        }
      }
    },

    // ------------------------------------------------------------ fireworks

    target() {
      // Golden-ratio spread across the sky so consecutive bursts don't stack.
      // Mirrored, shells keep to the left half and the mirror supplies the
      // right, or every burst would land on top of another's twin.
      this.spread = (this.spread + 0.618034) % 1;
      const x = this.mirrored ? this.W * (0.05 + 0.4 * this.spread) : this.W * (0.1 + 0.8 * this.spread) + rnd(-20, 20);
      const y = this.yW * (0.14 + 0.36 * Math.random());
      return [x, y];
    },

    kickKind(params) {
      const m = params.shells | 0;
      const r = Math.random();
      if (m === 1) return r < 0.7 ? 'willow' : 'kamuro';
      if (m === 2) return r < 0.55 ? 'ring' : 'crossette';
      if (m === 3) return r < 0.6 ? 'strobe' : 'kamuro';
      return r < 0.34 ? 'peony' : r < 0.58 ? 'chrys' : r < 0.72 ? 'ring' : r < 0.84 ? 'crossette' : r < 0.93 ? 'strobe' : 'palm';
    },

    autoKind(params) {
      const m = params.shells | 0;
      const r = Math.random();
      if (m === 2) return r < 0.5 ? 'ring' : 'willow';
      if (m === 3) return 'kamuro';
      return r < 0.55 ? 'willow' : r < 0.8 ? 'kamuro' : 'chrys';
    },

    launch(armed, T, opt, params) {
      opt = opt || {};
      let x1, y1;
      if (opt.x1 !== undefined) { x1 = opt.x1; y1 = opt.y1; } else { [x1, y1] = this.target(); }
      if (opt.comet) y1 = this.yW * (0.15 + 0.3 * Math.random());
      const x0 = opt.x0 !== undefined ? opt.x0 : x1 + rnd(-40, 40);
      this.shells.push({
        x0, y0: this.yW - 20, x1, y1, born: this.t, T, armed, comet: !!opt.comet,
        kind: opt.kind || null, px: x0, py: this.yW - 20, x: x0, y: this.yW - 20, dead: false,
      });
    },

    breakShell(s, strength, params) {
      s.dead = true;
      if (s.comet) {
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * TAU, v = rnd(20, 70);
          this.spark(s.x, s.y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.2, 0.6), 1);
        }
        return;
      }
      const kind = s.kind || (s.armed ? this.kickKind(params) : this.autoKind(params));
      this.burst(s.x, s.y, kind, strength, params);
    },

    burst(x, y, kind, strength, params) {
      const t = this.t;
      const sz = 0.75 + 0.35 * strength;
      const [ca, cb, cp] = scheme(params.colours | 0, this.hue);
      let n, R, drag, grav, life, width = 1.7, sparkRate = 0, glitter = false, strobe = false, drip = false;
      let ring = false, pistil = 0, change = 0.45 + 0.2 * Math.random(), crossette = 0;
      let colA = ca, colB = cb;
      switch (kind) {
        case 'chrys': n = 80; R = 120; drag = 2.4; grav = 34; life = 2.0; sparkRate = 2.5; pistil = 0.3; break;
        case 'ring': n = 64; R = 105; drag = 2.6; grav = 26; life = 1.8; ring = true; width = 2; break;
        case 'crossette': n = 14; R = 70; drag = 1.8; grav = 30; life = 0.55; crossette = 1; width = 2.2; sparkRate = 12; break;
        case 'palm': n = 11; R = 110; drag = 1.3; grav = 50; life = 2.4; width = 3; sparkRate = 26; colA = GOLD; change = 0.7; break;
        case 'willow': n = 50; R = 115; drag = 1.35; grav = 22; life = 4.2; width = 1.5; sparkRate = 14; drip = true;
          colA = [36 + 8 * Math.random(), 85, 52]; colB = Math.random() < 0.5 ? ca : [30, 90, 45]; change = 0.6; glitter = true; break;
        case 'kamuro': n = 70; R = 120; drag = 1.6; grav = 24; life = 3.6; width = 1.3; sparkRate = 6; drip = true;
          colA = SILVER; colB = GOLD; glitter = true; strobe = true; change = 0.35; break;
        case 'strobe': n = 90; R = 115; drag = 2.3; grav = 30; life = 2.2; strobe = true; glitter = true; colB = WHITE; change = 0.3; break;
        case 'pop': n = 34; R = 44; drag = 3.2; grav = 20; life = 1.0; strobe = true; glitter = true;
          colA = WHITE; colB = [(this.hue + 180) % 360, 90, 70]; change = 0.4; width = 1.5; break;
        case 'mini': n = 5; R = 32; drag = 2.2; grav = 30; life = 1.1; width = 1.6; sparkRate = 8; break;
        default: n = 85; R = 110; drag = 2.6; grav = 34; life = 1.9; pistil = Math.random() < 0.5 ? 0.35 : 0; break;
      }
      if (kind !== 'pop' && kind !== 'mini') { n = Math.round(n * (0.7 + 0.3 * params.size)); R *= sz; }
      // A square stage has little more than half a wide one's sky.
      R *= clamp(this.W / 1000, 0.72, 1);
      // Hold the total down in a heavy finale: fewer, not dimmer, stars.
      let live = 0;
      for (const b of this.bursts) live += b.n;
      if (live > 2600) n = Math.max(6, Math.round(n * 0.5));

      const b = {
        x, y, born: t, n, drag, grav, life, width, sparkRate, glitter, strobe, crossette, kind, drip,
        ca: colA, cb: colB, cp, change, np: Math.round(n * pistil),
        x_: new Float32Array(n), y_: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
        px: new Float32Array(n), py: new Float32Array(n), die: new Float32Array(n), alive: n,
      };
      const v0 = R * drag;
      const tilt = Math.random() * 0.8 + 0.1, rot = Math.random() * TAU;
      const ct = Math.cos(rot), st = Math.sin(rot);
      for (let i = 0; i < n; i++) {
        let dx, dy;
        if (ring) {
          const a = (i / n) * TAU;
          const rx = Math.cos(a), ry = Math.sin(a) * tilt;
          dx = rx * ct - ry * st; dy = rx * st + ry * ct;
        } else if (kind === 'crossette' || kind === 'palm') {
          const a = (i / n) * TAU + Math.random() * 0.2;
          dx = Math.cos(a); dy = Math.sin(a) - (kind === 'palm' ? 0.35 : 0);
        } else {
          // Uniform on a sphere, projected: the centre fills in like a real shell.
          const z = Math.random() * 2 - 1, a = Math.random() * TAU, q = Math.sqrt(1 - z * z);
          dx = q * Math.cos(a); dy = q * Math.sin(a);
        }
        const inner = i < b.np ? 0.45 : 1;
        const v = v0 * inner * (0.94 + 0.1 * Math.random());
        b.vx[i] = dx * v; b.vy[i] = dy * v;
        b.x_[i] = b.px[i] = x; b.y_[i] = b.py[i] = y;
        b.die[i] = life * (0.72 + 0.38 * Math.random());
      }
      this.bursts.push(b);

      if (kind !== 'mini') {
        // One bloom per kick carries the punch; the others break without
        // one, so a finale kick lights one place, not the whole sky.
        const lead = t - this.lastBloom > 0.1;
        if (lead) this.lastBloom = t;
        const big = kind === 'pop' ? 0.45 : lead ? 1 : 0.3;
        this.blooms.push({ x, y, born: t, R: R * (kind === 'pop' ? 1.2 : 1.05), h: colA[0], s: colA[1], k: strength * big });
        this.flash = Math.min(1.5, this.flash + 0.55 * strength * big);
        this.flashHue = colA[0];
      }
      if (kind !== 'pop' && kind !== 'mini' && this.puffs.length < 70) {
        for (let i = 0; i < 3; i++) {
          this.puffs.push({ x: x + rnd(-R, R) * 0.5, y: y + rnd(-R, R) * 0.4, r: R * rnd(0.35, 0.6), born: t,
            life: rnd(7, 11), h: colA[0], s: colA[1] });
        }
      }
    },

    spark(x, y, vx, vy, life, kind) {
      const i = this.si;
      this.si = (i + 1) % MAX_SPARKS;
      this.sx[i] = x; this.sy[i] = y; this.svx[i] = vx; this.svy[i] = vy;
      this.sd[i] = this.t + life; this.sl[i] = life; this.sk[i] = kind;
    },

    // ---------------------------------------------------------------- update

    step(dt, params) {
      const t = this.t;
      // Delayed events (the salute ripple).
      for (let i = this.queue.length - 1; i >= 0; i--) {
        if (this.queue[i].t <= t) { const q = this.queue[i]; this.queue.splice(i, 1); q.fn(); }
      }
      if (this.pendingFinale) {
        this.pendingFinale = false;
        for (let i = 0; i < 6; i++) this.queue.push({ t: t + i * 0.12, fn: () => { const [x, y] = this.target(); this.burst(x, y, this.kickKind(params), 1, params); } });
      }

      // No kick for a while: the show runs itself, slower, on willows.
      if (t - this.lastKick > 1.1) {
        this.autoTimer -= dt * (0.7 + 1.2 * this.pad);
        if (this.autoTimer <= 0) {
          this.launch(false, rnd(1.2, 1.7), null, params);
          this.autoTimer = rnd(1.1, 2.2);
        }
      }

      // Shells: ease-out climb, arriving at the target at T.
      for (const s of this.shells) {
        if (s.dead) continue;
        const age = t - s.born;
        const f = Math.min(1, age / s.T);
        const e = 1 - (1 - f) * (1 - f);
        s.px = s.x; s.py = s.y;
        s.x = s.x0 + (s.x1 - s.x0) * e + Math.sin(age * 9 + s.x0) * 1.2;
        s.y = s.y0 + (s.y1 - s.y0) * e;
        if (Math.random() < (s.comet ? 0.9 : 0.5)) this.spark(s.x, s.y, rnd(-8, 8), rnd(5, 30), rnd(0.2, 0.5), s.comet ? 1 : 0);
        // An armed shell whose kick never came breaks at its apex anyway.
        if (age >= s.T * (s.armed ? 1.45 : 1)) this.breakShell(s, 0.8, params);
      }
      this.shells = this.shells.filter((s) => !s.dead);

      // Stars.
      const gust = 6 + 4 * Math.sin(t * 0.07);
      for (const b of this.bursts) {
        const age = t - b.born;
        const kd = Math.exp(-b.drag * dt);
        let alive = 0;
        for (let i = 0; i < b.n; i++) {
          if (b.die[i] <= age) continue;
          alive++;
          b.px[i] = b.x_[i]; b.py[i] = b.y_[i];
          b.vx[i] = b.vx[i] * kd + gust * 0.3 * dt;
          b.vy[i] = b.vy[i] * kd + b.grav * dt;
          b.x_[i] += b.vx[i] * dt;
          b.y_[i] += b.vy[i] * dt;
          if (b.sparkRate && Math.random() < b.sparkRate * dt) {
            if (b.drip) this.spark(b.x_[i], b.y_[i], rnd(-2, 2), rnd(0, 3), rnd(2.2, 3.8), 2);
            else this.spark(b.x_[i], b.y_[i], b.vx[i] * 0.2 + rnd(-6, 6), b.vy[i] * 0.2 + rnd(0, 12), rnd(0.4, 1.1), b.glitter ? 1 : 0);
          }
          if (b.crossette && age > b.life * 0.65 && b.die[i] > 0) {
            // Crossette: each star splits into four.
            b.die[i] = 0;
            this.crossSplit(b, i, params);
          }
        }
        b.alive = alive;
      }
      this.bursts = this.bursts.filter((b) => b.alive > 0);

      // Sparks.
      const sd = Math.exp(-2.2 * dt);
      for (let i = 0; i < MAX_SPARKS; i++) {
        if (this.sd[i] <= t) continue;
        // Willow drip barely falls: the strand it leaves is the star's path.
        this.svx[i] *= sd; this.svy[i] = this.svy[i] * sd + (this.sk[i] === 2 ? 5 : 30) * dt;
        this.sx[i] += this.svx[i] * dt; this.sy[i] += this.svy[i] * dt;
      }

      // Smoke drifts downwind and spreads.
      for (const s of this.puffs) { s.x += gust * dt; s.y -= 1.5 * dt; s.r += 5 * dt; }
      this.puffs = this.puffs.filter((s) => t - s.born < s.life);
      this.blooms = this.blooms.filter((b) => t - b.born < 2.5);
      this.flash *= Math.exp(-dt / 0.22);
    },

    crossSplit(b, i, params) {
      const x = b.x_[i], y = b.y_[i];
      const c = {
        x, y, born: this.t, n: 4, drag: 2.2, grav: 30, life: 0.9, width: 1.6, sparkRate: 6, glitter: true, strobe: false,
        crossette: 0, kind: 'mini', ca: b.cb, cb: WHITE, cp: b.cb, change: 0.5, np: 0,
        x_: new Float32Array(4), y_: new Float32Array(4), vx: new Float32Array(4), vy: new Float32Array(4),
        px: new Float32Array(4), py: new Float32Array(4), die: new Float32Array(4), alive: 4,
      };
      const a0 = Math.random() * TAU;
      for (let j = 0; j < 4; j++) {
        const a = a0 + (j * TAU) / 4, v = 90;
        c.vx[j] = Math.cos(a) * v + b.vx[i] * 0.5; c.vy[j] = Math.sin(a) * v + b.vy[i] * 0.5;
        c.x_[j] = c.px[j] = x; c.y_[j] = c.py[j] = y;
        c.die[j] = 0.7 + 0.3 * Math.random();
      }
      this.bursts.push(c);
    },

    // ------------------------------------------------------------------ draw

    // Draws fn once, or twice mirrored about the centre line.
    twice(g, mirror, fn) {
      fn();
      if (!mirror) return;
      g.save();
      g.translate(this.W, 0);
      g.scale(-1, 1);
      fn();
      g.restore();
    },

    // Stars as runs of small squares along this frame's motion, not stroked
    // segments: antialiased stroking of thousands of tiny paths is the most
    // expensive thing a software rasteriser does, and squares are the
    // cheapest. Only a burst's first frames, when the stars radiate fastest
    // and the streaks are the punch, are stroked.
    drawStars(g, b, i0, i1, style, w, age, blink) {
      if (age < 0.08) {
        g.lineWidth = w;
        g.strokeStyle = style;
        g.beginPath();
        for (let i = i0; i < i1; i++) {
          if (b.die[i] <= age) continue;
          g.moveTo(b.px[i], b.py[i]); g.lineTo(b.x_[i], b.y_[i]);
        }
        g.stroke();
        return;
      }
      g.fillStyle = style;
      const h = w / 2;
      for (let i = i0; i < i1; i++) {
        if (b.die[i] <= age) continue;
        if (blink < 1 && Math.random() > blink && age > 0.2) continue;
        const x1 = b.x_[i], y1 = b.y_[i];
        const dx = b.px[i] - x1, dy = b.py[i] - y1;
        const n = Math.min(4, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (w * 0.8)));
        for (let j = 0; j < n; j++) {
          const f = j / n;
          g.fillRect(x1 + dx * f - h, y1 + dy * f - h, w, w);
        }
      }
    },

    drawFx(dt, params, mirror) {
      const g = this.fxg, k = this.k, t = this.t;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      // Trail length: per-frame fade, frame-rate independent.
      const keep = 0.72 + 0.24 * params.trails;
      g.fillStyle = `rgba(0,0,0,${(1 - Math.pow(keep, dt * 60)).toFixed(4)})`;
      g.fillRect(0, 0, this.fx.width, this.fx.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'butt';

      this.twice(g, mirror, () => {
        // Shells: a hot gold streak.
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(255,215,150,0.95)';
        g.beginPath();
        for (const s of this.shells) { g.moveTo(s.px, s.py); g.lineTo(s.x, s.y); }
        g.stroke();

        for (const b of this.bursts) {
          const age = t - b.born, f = age / b.life;
          let col = b.ca;
          if (f > b.change) {
            const m = clamp((f - b.change) / 0.15, 0, 1);
            col = m >= 1 ? b.cb : [b.ca[0] + (((b.cb[0] - b.ca[0] + 540) % 360) - 180) * m,
              b.ca[1] + (b.cb[1] - b.ca[1]) * m, b.ca[2] + (b.cb[2] - b.ca[2]) * m];
          }
          const hot = clamp(1 - age / 0.16, 0, 1);    // white-hot for the first moments: the new burst outshines the sky
          const a = f < 0.6 ? 1 : clamp(1 - (f - 0.6) / 0.5, 0.15, 1);
          const w = b.width * (1 + hot * 0.9);
          const blink = b.strobe ? 0.3 + 0.7 * this.hat : 1;
          this.drawStars(g, b, b.np, b.n, hsl(col, a, hot), w, age, blink);
          if (b.np) this.drawStars(g, b, 0, b.np, hsl(b.cp, a, hot), w, age, 1);
        }

        // Sparks: gold embers (0), white glitter (1) that strobes with the
        // hats, and willow drip (2). Two passes each, young and dying, so
        // they fade without a style change per spark.
        const sz = 1.1;
        const on = 0.3 + 0.7 * this.hat;
        const pass = (kind, style, young, size, strobe) => {
          g.fillStyle = style;
          for (let i = 0; i < MAX_SPARKS; i++) {
            if (this.sd[i] <= t || this.sk[i] !== kind) continue;
            if ((this.sd[i] - t > this.sl[i] * 0.45) !== young) continue;
            if (strobe && Math.random() > on) continue;
            g.fillRect(this.sx[i] - size / 2, this.sy[i] - size / 2, size, size);
          }
        };
        pass(0, 'rgba(255,190,110,0.9)', true, sz, false);
        pass(0, 'rgba(255,140,60,0.45)', false, sz, false);
        pass(2, 'rgba(255,200,120,0.8)', true, sz * 1.15, false);
        pass(2, 'rgba(230,120,40,0.45)', false, sz, false);
        const gz = sz * (1 + this.hat * 0.9);
        pass(1, 'rgba(255,250,235,1)', true, gz, true);
        pass(1, 'rgba(255,235,200,0.6)', false, gz, true);
        g.globalAlpha = 1;
      });
    },

    // The quarter-resolution layers: smoke bodies (source-over, they darken
    // the sky) and everything soft and additive.
    drawSoft(t, params, react, mirror) {
      const W = this.W, yW = this.yW, q = this.qk;
      const sg = this.smkg, lg = this.softg;
      for (const g of [sg, lg]) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, this.soft.width, this.soft.height);
        g.setTransform(q, 0, 0, q, 0, 0);
      }

      // Horizon glow: bass and bursts light the haze from below.
      lg.globalCompositeOperation = 'lighter';
      lg.globalAlpha = clamp(0.1 + (0.55 * this.bass + 0.3 * this.pad) * react, 0, 1);
      lg.drawImage(this.glowC, 0, yW * 0.3, W, yW * 0.7 + 1);

      const smoke = SMOKE;
      const lit = clamp((0.1 + 0.8 * this.bass + 0.5 * this.pad) * react, 0, 1.4);
      // Mirrored, everything soft is drawn twice over the same sky.
      const dim = mirror ? 0.55 : 1;
      const draw = () => {
        if (smoke > 0) {
          for (const s of this.puffs) {
            const age = t - s.born;
            const env = Math.min(1, age / 0.8) * (1 - age / s.life);
            const r = s.r * 2;
            sg.globalAlpha = clamp(env * 0.4 * smoke, 0, 1);
            sg.drawImage(this.smokeSprite, s.x - r, s.y - r, r * 2, r * 2);
            lg.globalAlpha = clamp(env * 0.5 * smoke * lit * dim, 0, 1);
            lg.drawImage(this.glow(s.h, s.s * 0.7), s.x - r, s.y - r, r * 2, r * 2);
          }
        }
        // Blooms: the punch of each break, then the cloud of light it leaves.
        for (const b of this.blooms) {
          const age = t - b.born;
          const punch = Math.exp(-age / 0.14);
          const cloud = 0.1 * Math.exp(-age / 1.2);
          const a = clamp((0.45 * punch * react + cloud) * b.k * dim, 0, 1);
          const r = b.R * (0.8 + 0.5 * (1 - punch));
          lg.globalAlpha = a;
          lg.drawImage(this.glow(b.h, b.s), b.x - r, b.y - r, r * 2, r * 2);
        }
      };
      sg.globalCompositeOperation = 'source-over';
      lg.globalCompositeOperation = 'lighter';
      draw();
      if (mirror) {
        sg.save(); lg.save();
        sg.translate(W, 0); sg.scale(-1, 1);
        lg.translate(W, 0); lg.scale(-1, 1);
        draw();
        sg.restore(); lg.restore();
      }
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      const W = ctx.width, H = ctx.height;
      if (this.t === undefined) this.reset();
      this.ensureBuffers(p, W, H, params);
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.t += dt;
      const t = this.t;
      const react = params.react;
      const mirror = (params.mirror | 0) === 1;
      this.mirrored = mirror;

      // The harmony hue travels a full circle in about four minutes, faster in a finale.
      this.hue = (this.hue + dt * (1.2 + 3 * this.energy)) % 360;

      this.listen(signals, dt, params);
      // The boat drifts downriver. Speed, in waterfront units a second,
      // follows the music but eases over seconds, so the drop pushes the
      // city past faster and the breakdown slows it, without a single jerk.
      const want = params.drift * (8 + 34 * this.energy + 14 * this.bass + 6 * this.pad);
      this.speed = ease(this.speed, want, 0.35, dt);
      this.cam += this.speed * dt;
      this.step(dt, params);
      this.drawFx(dt, params, mirror);
      this.drawSoft(t, params, react, mirror);

      const g = p.drawingContext;
      const yW = this.yW;
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;

      // 1. Sky and stars; the stars twinkle with the hats.
      g.drawImage(this.skyC, 0, 0, W, yW + 2);
      g.fillStyle = '#fff';
      for (const s of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + s.ph);
        g.globalAlpha = clamp(s.b * (0.3 + 0.4 * tw) + this.hat * 0.7 * (s.ph > 3 ? 1 : 0) * s.b, 0, 1);
        g.fillRect(s.x, s.y, s.s, s.s);
      }

      // 2. Smoke bodies, 3. fireworks, 4. the soft light over them.
      g.globalAlpha = 1;
      g.drawImage(this.smk, 0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.fx, 0, 0, W, H);
      g.drawImage(this.soft, 0, 0, W, H);
      // White-hot cores, sharp, on the main canvas.
      this.twice(g, mirror, () => {
        for (const b of this.blooms) {
          const age = t - b.born;
          if (age > 0.25) continue;
          const c = 10 + 18 * b.k * react;
          g.globalAlpha = clamp(Math.exp(-age / 0.06) * b.k * (0.5 + 0.5 * react), 0, 1);
          g.drawImage(this.coreSprite, b.x - c, b.y - c, c * 2, c * 2);
        }
      });

      // 5. City, sliding past.
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      this.drawCity(g, () => {
        // Downtown's extras ride with downtown, under the waterfront.
        const o = this.layerOff(this.layers[1].f, this.downTw), tw = this.downTw;
        const sx = (x) => { let v = x - o; if (v < -10) v += tw; return v; };
        g.globalAlpha = 0.9;
        g.fillStyle = '#ffd488';
        for (const w of this.flick) if (w.on && !w.cool) { const x = sx(w.x); if (x < W + 4) g.fillRect(x, w.y, 1.8, 2.6); }
        g.fillStyle = '#cfe8ff';
        for (const w of this.flick) if (w.on && w.cool) { const x = sx(w.x); if (x < W + 4) g.fillRect(x, w.y, 1.8, 2.6); }
        g.globalCompositeOperation = 'lighter';
        const red = this.glow(0, 100);
        for (const bcn of this.beacons) {
          const x = sx(bcn.x);
          if (x > W + 6) continue;
          g.globalAlpha = Math.sin(t * 3.2 + bcn.ph) > 0.55 ? 1 : 0.08;
          g.drawImage(red, x - 5, bcn.y - 5, 10, 10);
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      });
      // Promenade lamps on the waterfront.
      g.globalCompositeOperation = 'lighter';
      const lampSprite = this.glow(35, 90);
      const lo = this.layerOff(1, this.frontTw);
      for (const l of this.lamps) {
        let x = l.x - lo; if (x < -10) x += this.frontTw;
        if (x > W + 6) continue;
        g.globalAlpha = 0.45 + 0.1 * Math.sin(t * 2 + l.ph);
        g.drawImage(lampSprite, x - 5, yW - 9, 10, 10);
      }

      // 6. River.
      this.drawRiver(g, W, H, t, react);

      g.restore();
    },

    drawRiver(g, W, H, t, react) {
      const yW = this.yW;
      const waterH = H - yW;
      const rg = this.reflg, rw = this.refl.width, rh = this.refl.height;
      // Rebuild the scene above the waterline, flipped, from its layers. The
      // whole sky is squashed into the water: not optics, but it lets the
      // high bursts reach the river too.
      const sx = rw / W, sy = rh / yW;
      rg.setTransform(sx, 0, 0, -sy, 0, rh);
      rg.globalCompositeOperation = 'source-over';
      rg.globalAlpha = 1;
      rg.drawImage(this.skyC, 0, 0, W, yW + 2);
      rg.drawImage(this.smk, 0, 0, this.smk.width, yW * this.qk, 0, 0, W, yW);
      rg.globalCompositeOperation = 'lighter';
      rg.drawImage(this.fx, 0, 0, this.fx.width, yW * this.k, 0, 0, W, yW);
      rg.drawImage(this.soft, 0, 0, this.soft.width, yW * this.qk, 0, 0, W, yW);
      rg.globalCompositeOperation = 'source-over';
      this.drawCity(rg);
      rg.setTransform(1, 0, 0, 1, 0, 0);

      // Strips with a ripple that grows toward the viewer. Opaque and
      // overlapping by half a unit: translucent overlaps band into stripes.
      const stripH = 2.5;
      const swell = 1 + 2.2 * this.bass * react;
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      for (let y = yW; y < H; y += stripH) {
        const d = (y - yW) / waterH;
        const amp = (0.4 + 8 * d * d) * swell;
        const dx = amp * (Math.sin(y * 0.8 - t * 2.1) * 0.6 + Math.sin(y * 0.21 + t * 1.3) * 0.4);
        // Rows are sampled a little ahead so the reflection smears
        // vertically, as it does on moving water.
        const srow = clamp(d * rh + Math.sin(y * 0.37 + t * 1.7) * 2 * d, 0, rh - 1);
        g.drawImage(this.refl, 0, srow, rw, Math.max(1, (stripH * rh) / waterH), dx - 12, y, W + 24, stripH + 0.6);
      }

      // Darker toward the viewer.
      const sky = SKIES[this.skyMode] || SKIES[0];
      const gr = g.createLinearGradient(0, yW, 0, H);
      gr.addColorStop(0, `rgba(${sky.water},0.1)`);
      gr.addColorStop(1, `rgba(${sky.water},0.62)`);
      g.fillStyle = gr;
      g.fillRect(0, yW, W, waterH + 1);

      // Glints: the hats and the salute catch the water.
      const gl = clamp((this.hat * 0.45 + this.glint * 0.5) * react, 0, 1);
      g.globalCompositeOperation = 'lighter';
      if (gl > 0.03) {
        const r = mulberry((Math.floor(t * 12) * 7919) >>> 0);
        g.fillStyle = hsl([this.flashHue, 70, 78], 1);
        for (let i = 0; i < 110; i++) {
          const y = yW + 3 + Math.pow(r(), 1.3) * (waterH - 6);
          const d = (y - yW) / waterH;
          const len = 3 + 16 * d * r();
          g.globalAlpha = gl * (0.25 + 0.6 * r()) * (1 - 0.4 * d);
          g.fillRect(r() * W, y, len, 0.6 + d);
        }
      }
      // Lamp reflections: broken dashes that wander, as on moving water. A
      // solid streak per lamp read as a comb of vertical lines.
      g.fillStyle = 'rgba(255,190,110,1)';
      const lo = this.layerOff(1, this.frontTw);
      for (const l of this.lamps) {
        let lx = l.x - lo; if (lx < -10) lx += this.frontTw;
        if (lx > W + 6) continue;
        for (let j = 0; j < 5; j++) {
          const y = yW + 2 + j * j * 2.2 + 2 * Math.sin(t * 1.9 + l.ph + j);
          g.globalAlpha = (0.2 - j * 0.035) * (0.6 + 0.4 * Math.sin(t * 3.1 + l.ph * 2 + j * 1.7));
          const wob = Math.sin(t * 2.4 + l.ph + j * 0.9) * (1 + j);
          g.fillRect(lx - 1 - j * 0.3 + wob, y, 2 + j * 0.6, 1.2 + j * 0.3);
        }
      }
    },
  });
})();
