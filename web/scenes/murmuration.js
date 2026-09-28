// Murmuration — thousands of starlings over a marsh at sunset.
//
// The flock is not a boids simulation. A real murmuration reads as a sheet of
// birds folding in three dimensions: where the sheet turns edge-on to you the
// birds pile up in projection and a dark ribbon appears, where it faces you it
// thins to a haze. So every bird owns a fixed slot (u, v, w) on a ribbon, and
// the ribbon is bent, twisted, undulated and yawed in 3D and projected with
// perspective. The density that makes the shape comes free from the
// projection, it costs a few trig calls per bird instead of a neighbour
// search, and it is fully steerable, which is what lets the music drive it.
//
// Deformations are evaluated at a time lagged along the ribbon, so every
// change travels down the flock as a wave instead of happening everywhere at
// once: that lag is most of why it looks alive.
//
// Layers, back to front: sky gradient, lit clouds, sun glow and rays (all on a
// low-resolution canvas, since they are soft); the sun's disc; a far treeline;
// the marsh water with the sun's glitter path; the flock; foreground reeds
// with backlit plumes; drifting motes and bokeh.
//
// Music:
//   kick   a ripple of dark density runs head to tail through the flock
//          (birds in the wave pull in and show more wing), and the sun's rim
//          flares. Confined on purpose: nothing else on screen jumps.
//   snare  the flock turns: a yaw swing that travels along the ribbon, birds
//          banking as it passes, so a dark (in the drop, iridescent) band
//          sweeps through the flock. Successive claps swing it back and forth.
//   bass   the flock's size and the sun's glow swell.
//   hats   reed plumes, water glitter and motes sparkle.
//   drop   an energy level built from the kicks lets the ribbon fold and twist
//          much harder, speeds its flight and the travel over the marsh,
//          raises sun rays, saturates the sky.
//
// The camera travels slowly along the marsh: reeds, water ripples, motes and
// the treeline slide past at parallax speeds, the flock keeps pace in the
// sky. The music changes the travel's speed through the energy level only,
// smoothly, never on a beat.

(function () {
  const MAX_BIRDS = 14000;

  // Dusk schemes. Sky stops run from the zenith to the horizon.
  const SCHEMES = {
    gold:   { sky: ['#1a1f4d', '#6b3b78', '#e8656a', '#ffc26b'], sun: '#fff2cf', lit: '#ffae86', dark: '#4a2f5e' },
    rose:   { sky: ['#1c1440', '#71306f', '#f0628a', '#ffb08c'], sun: '#fff0dc', lit: '#ff9ab8', dark: '#43234f' },
    violet: { sky: ['#0c1034', '#373275', '#9a4f98', '#f08aa0'], sun: '#ffe0cc', lit: '#e39ad0', dark: '#2c2352' },
    ember:  { sky: ['#140a2a', '#5a1a4a', '#d9403a', '#ff9a2a'], sun: '#ffe7a0', lit: '#ff8a50', dark: '#3a1830' },
    acid:   { sky: ['#0a0240', '#6a0aa0', '#ff2d8a', '#ffd21a'], sun: '#fffbe6', lit: '#40f0d8', dark: '#300c60' },
  };
  const SKY_OPTIONS = ['Dusk cycle', 'Gold', 'Rose', 'Violet hour', 'Ember', 'Acid'];
  const CYCLE = ['gold', 'rose', 'violet', 'ember'];
  const FIXED = [null, 'gold', 'rose', 'violet', 'ember', 'acid'];

  // Starling plumage: black with green and violet sheen, pushed to jewel tones.
  // In the drop, whole stretches of the sheet catch the light in these.
  const IRIS = ['#1de9b6', '#18c8ff', '#4f6bff', '#8f4dff', '#e040fb'];
  // Each clap takes the next pair, so successive turns flash different colours.
  const GLINT_PAIRS = [['#2af0c8', '#6a7bff'], ['#3fe0ff', '#ff3fa4'], ['#8f5cff', '#ff4fd0']];

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  function scheme(name) {
    const s = SCHEMES[name];
    return { sky: s.sky.map(hex), sun: hex(s.sun), lit: hex(s.lit), dark: hex(s.dark) };
  }
  function mixScheme(a, b, t) {
    return {
      sky: a.sky.map((c, i) => mixc(c, b.sky[i], t)),
      sun: mixc(a.sun, b.sun, t), lit: mixc(a.lit, b.lit, t), dark: mixc(a.dark, b.dark, t),
    };
  }
  const SCH = {};
  for (const k of Object.keys(SCHEMES)) SCH[k] = scheme(k);

  // Frame-rate independent one-pole smoothing, rate in 1/s.
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth01(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }

  VIZ.register({
    id: 'murmuration',
    name: 'Murmuration',
    order: 208,

    params: [
      { key: 'push', label: 'Music push', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'birds', label: 'Birds', type: 'range', min: 2000, max: MAX_BIRDS, default: 5500, step: 100 },
      { key: 'fold', label: 'Fold', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0.2, max: 2.5, default: 1, step: 0.01 },
      { key: 'sky', label: 'Sky', type: 'select', options: SKY_OPTIONS, default: 0 },
      { key: 'sheen', label: 'Iridescence', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'reeds', label: 'Reeds', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'New flock', run() { this.seedFlock(); this.layoutFor = null; } },
    ],

    gallery: {
      title: 'Murmuration',
      technique: 'Canvas 2D: thousands of birds on a 3D ribbon (bent, twisted, undulated, yawed, perspective-projected, deformations lagged along the ribbon so they travel as waves), batched into a few Path2D strokes; soft sky, clouds, sun glow and rays on a third-resolution canvas; full-resolution sun, treeline, glitter, reeds and motes',
      brief: 'Starlings at dusk over a marsh. A flock of thousands folds and pours across a sunset sky, dark ribbons forming wherever the sheet of birds turns edge-on. A slow travel along the marsh slides reeds, ripples and treeline past in parallax while the flock keeps pace overhead. Each kick sends a ripple of dark density running through the flock and flares the sun\'s rim; the clap swings the whole flock into a turn that visibly travels through it as a band of banking (iridescent in the drop); bass swells the flock and the sun\'s glow; hats sparkle the backlit reed plumes, the glitter path on the water and the drifting motes. The drop surges: the ribbon folds and twists much harder, flies faster, sun rays come up and the sky saturates; the breakdown lets it settle into a slow, wide drift.',
      lineage: [
        'Brief 08 (batch 02): starlings at dusk, boids drawn as dark flecks.',
        'Chose a projected ribbon over boids: murmuration shape is the projection of a folding sheet, and a steerable surface lets kick, clap and bass act on the whole flock at once, which boids with local rules cannot do legibly (and a neighbour search on 5,000 birds would blow the 2D budget).',
        'Deformations sampled at a time lagged along the ribbon so every change, including each clap\'s turn, travels through the flock as a wave.',
        'Layering after Flyover\'s Night drive: sky, clouds, sun, treeline, water, flock, reeds, motes.',
        'Render 1 (640x360): composition and palette worked, but raster cost was 300+ ms a frame. Bisected by disabling layers: the third-resolution backdrop canvas lived on the GPU and each drawImage forced a readback. willReadFrequently on that canvas brought it to ~8 ms.',
        'Kick strip 1: the kick read (flock clenches, sun blooms), but every clap coloured a third of the flock in three flat blocks, hiding the murmuration. The banking pulse was narrowed (sin cubed, shorter turn, longer travel time) so it is a band sweeping through the flock, coloured across its width, with each clap taking the next colour pair so successive turns are distinguishable.',
        'Flock enlarged and given a stronger resting fold and bend, so intro and breakdown are crescents and ribbons rather than a lens-shaped blob.',
        'Added a small far flock low over the treeline, hazed toward the sky, for depth; smoothed the treeline, whose tree crowns read as jagged mountains (then, stacking, as hills).',
        'Kick strip 2: gold glints vanished against the gold sky, replaced with cyan/magenta; the sun bloom and the halo rings leaving the sun on each drop kick were strengthened.',
        'Lead review: flock too small (an eighth of the frame), kick not landing, wanted more psychedelia. Flock made ~2.5x larger (R 115 to 210, sweeping most of the sky in the drop), with a thinner, denser sheet and heavier flecks where it is edge-on so folds read as bold dark ribbons; 8,000 birds by default.',
        'Kick rebuilt around the raw kick envelope (instant attack): a warm radial wash of light out of the sun over most of the sky on the low-res layer, a flared sun rim, and the rays pulsing on every kick even outside the drop; all decay in ~200 ms, gradients only.',
        'Drop plumage: where the sheet faces you and its angle catches the light, stretches of birds turn teal/cyan/blue/violet/magenta, hue drifting across the sheet; edge-on folds stay dark. A first pass let half the flock go colour and the dark mass vanished, so it is gated on facing. The flock is mirrored into the marsh.',
        'Performance: glitter bucketed into 3 strokes instead of 160, fewer bokeh discs, the reflection strokes only heavy or coloured birds whose mirror lands on stage. At 8,000 birds plus a full reflection the 1280x720 p95 had gone to 23 ms (busy machine), so the default dropped to 5,500 and the drop\'s twist and bend were reined in so the bigger sheet stays cohesive instead of scattering.',
        'Full-size check: kick now obvious (flare, rays, rim), drop flock a huge iridescent sweep, but intro and breakdown flocks were faint and sparse at the new size. Resting size cut to R 150 with the drop growing it 85%, so quiet sections keep a dense, bold crescent and the drop is far bigger than the breakdown.',
        'Raph on batch 02: "super cool" but too pulsey, and wanted more movement. Jolt meter before: kickArea 0.92 (jarring), the sky-wide warm wash and pulsing rays moving almost every block. The wash and ray pulse are gone; the sun keeps a rim flare and a small ring; the flock carries the beat as a ripple of dark density running head to tail (birds in the wave pull in and show more wing), and the whole-flock clench fell from 30% to 5%.',
        'Movement: the camera now travels along the marsh. Reeds (clumped on a wrapping strip, taller = nearer = faster), ripple streaks on the water, motes and bokeh, and the treeline slide past at parallax speeds while the flock keeps pace overhead; the drop speeds the travel through the slow energy level only.',
        'Jolt after: kickArea 0.17, ratio 0.99 (calm), down from 0.92 (jarring); build kick 0.18. Heat map shows the kick confined to the sun and a band of the flock. First travel pass spread reeds evenly into a fence across the sun; they are now four clumps of tall reeds with a low fringe between, so open water and sun slide by between stands.',
      ],
    },

    setup() {
      this.seedFlock();
    },

    enter() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kick: 0, kickSm: 0, kickAvg: 0, bass: 0, energy: 0, hat: 0, s8slow: 0, hatArmed: true,
        snPrev: 0, snLast: -10, lastHatT: -10 };
      this.turns = [];      // clap events travelling through the flock
      this.yawBase = 0;     // settled sum of past turns
      this.turnSign = 1;
      this.ringT = [];      // kick rings from the sun
      this.kicks = [];      // kick ripples travelling through the flock
      this.kickArmed = true;
      this.cam = 0;         // distance travelled along the marsh, units
      this.sparkT = 0;      // time of the latest hat
      this.sparkSeed = 0;
    },

    seedFlock() {
      const r = Math.random;
      const n = MAX_BIRDS;
      this.U = new Float32Array(n); this.V = new Float32Array(n); this.Wd = new Float32Array(n);
      this.Ph = new Float32Array(n); this.Fq = new Float32Array(n); this.Jt = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        // Slots fill a lens: dense in the core, thinning at the edges, with a
        // few stragglers so the silhouette is never a hard outline.
        const a = r() * Math.PI * 2;
        const rad = Math.pow(r(), 1.1) * (r() < 0.05 ? 1.25 : 1);
        this.U[i] = Math.cos(a) * rad;
        this.V[i] = Math.sin(a) * rad;
        this.Wd[i] = (r() + r() + r() - 1.5) / 1.5;
        this.Ph[i] = r() * Math.PI * 2;
        this.Fq[i] = 9 + r() * 7;           // wingbeat, rad/s
        this.Jt[i] = 2 + r() * 5;           // wander radius, units
      }
      this.seed = { a: r() * 50, b: r() * 50, c: r() * 50, d: r() * 50, e: r() * 50, f: r() * 50 };
    },

    // Everything that depends on the stage shape: treeline, reeds, clouds,
    // glitter and motes, all in virtual units.
    layout(W, H) {
      const r = Math.random;
      const hy = H * 0.74;
      this.hy = hy;
      const tree = [];
      // A wandering height plus scattered tree crowns, smoothed so crowns are
      // rounded: unsmoothed, the bumps read as a jagged mountain range.
      const steps = 260;
      const hs = [];
      let hgt = 6;
      for (let i = 0; i <= steps; i++) {
        hgt = Math.max(2, Math.min(18, hgt + (r() - 0.5) * 3));
        hs.push(hgt);
      }
      const base = hs.slice();
      for (let i = 0; i <= steps; i++) {
        if (r() < 0.08) {
          const top = 4 + r() * 9, wd = 2 + (r() * 4 | 0);
          for (let k = -wd; k <= wd; k++) {
            const j = i + k;
            if (j >= 0 && j <= steps) hs[j] = Math.max(hs[j], base[i] + top * Math.sqrt(1 - (k / (wd + 1)) ** 2));
          }
        }
      }
      // Periodic (wrapping) smoothing, so the line can scroll forever.
      hs.length = steps;
      for (let pass = 0; pass < 3; pass++) {
        const c = hs.slice();
        for (let i = 0; i < steps; i++) hs[i] = (c[(i + steps - 1) % steps] + 2 * c[i] + c[(i + 1) % steps]) / 4;
      }
      this.treeH = hs;
      this.tree = tree;

      // Reeds live on a strip of marsh 1.6 stages long that scrolls past
      // and wraps. They gather in clumps with open water between, so as they
      // slide by the sun and flock are framed rather than fenced off; taller
      // reeds are nearer and slide faster.
      const reeds = [];
      const span = W * 1.6;
      this.reedSpan = span;
      const clumps = [];
      for (let k = 0; k < 4; k++) clumps.push((k + 0.35 * r()) / 4 * span);
      for (let i = 0; i < 150; i++) {
        // Tall reeds only in the clumps; between them, a low fringe, so wide
        // stretches of open water and sun pass between the stands.
        const inClump = r() < 0.75;
        const x = inClump ? clumps[(r() * clumps.length) | 0] + (r() + r() - 1) * 110 : r() * span;
        const h = inClump ? H * (0.1 + Math.pow(r(), 1.2) * 0.36) : H * (0.04 + r() * 0.07);
        reeds.push({
          x, h, depth: 0.45 + 2.2 * h / H, lean: (r() - 0.5) * 0.35,
          w: 2 + r() * 3, ph: r() * 10, plume: r() < 0.45 && h > H * 0.15, cat: r() < 0.12,
          glint: r(),
        });
      }
      reeds.sort((a, b) => a.h - b.h);
      this.reedList = reeds;

      const clouds = [];
      for (let band = 0; band < 6; band++) {
        const y = hy * (0.12 + band * 0.13 + r() * 0.05);
        const cx = r() * W;
        const puffs = 5 + (r() * 6 | 0);
        const len = W * (0.25 + r() * 0.45);
        for (let k = 0; k < puffs; k++) {
          clouds.push({
            x: cx + (k / puffs - 0.5) * len + (r() - 0.5) * 40,
            y: y + (r() - 0.5) * 16,
            rx: 60 + r() * 120, ry: 7 + r() * 12,
            sp: 1.2 + band * 0.6 + r(), band,
          });
        }
      }
      this.clouds = clouds;

      // Ripple streaks across the whole water, scrolling with the travel.
      const rip = [];
      for (let i = 0; i < 70; i++) {
        const d = Math.pow(r(), 0.9);
        rip.push({ d, x: r() * (W + 200), len: 6 + d * 40 * r() + 6 });
      }
      this.rip = rip;

      const glit = [];
      for (let i = 0; i < 160; i++) {
        const d = Math.pow(r(), 0.8);          // 0 at the horizon, 1 at the bottom
        glit.push({ d, off: (r() - 0.5) * 2, len: 3 + r() * 10 * (0.3 + d), ph: r() * 10, f: 2 + r() * 4, k: r() });
      }
      this.glit = glit;

      const motes = [];
      for (let i = 0; i < 80; i++) {
        const bokeh = i < 10;
        motes.push({ x: r() * W, y: r() * H, z: bokeh ? 8 + r() * 18 : 0.8 + r() * 2.2, bokeh, ph: r() * 10, k: r(),
          vx: 4 + r() * 8, vy: -2 - r() * 5 });
      }
      this.motes = motes;
      this.layoutFor = W + 'x' + H;
    },

    listen(sg, dt, t) {
      const e = this.env;
      // Kick: band 0 over band 1. A bass note puts more into band 1 than 0,
      // a kick the reverse, so this separates them without a threshold.
      const kickness = sg[0] - 0.6 * sg[1];
      e.kick = Math.max(e.kick * Math.exp(-dt / 0.14), Math.min(1, Math.max(0, (kickness - 4) / 42)));
      e.kickSm = ease(e.kickSm, e.kick, 40, dt);
      if (this.kickArmed && e.kick > 0.45) {
        this.kickArmed = false;
        this.kicks.push({ t0: t, s: Math.min(1, e.kick) });
      } else if (e.kick < 0.25) this.kickArmed = true;
      while (this.kicks.length && t - this.kicks[0].t0 > 1) this.kicks.shift();
      e.kickAvg = ease(e.kickAvg, e.kick, 0.8, dt);
      // Energy: how much kick there has been lately. Up fast, down slowly, so
      // the drop surges in within a bar and the breakdown exhales over several.
      const target = Math.min(1, e.kickAvg / 0.22);
      e.energy = ease(e.energy, target, target > e.energy ? 1.6 : 0.3, dt);
      e.bass = ease(e.bass, (sg[1] + sg[2]) / 200, 2.2, dt);

      // Clap: band 4 over band 3. The pad sits evenly in both, the clap
      // leans to 4.
      const sn = sg[4] - 0.75 * sg[3];
      if (sn > 14 && e.snPrev <= 14 && t - e.snLast > 0.18) {
        e.snLast = t;
        const strength = Math.min(1, sn / 30);
        this.turnSign = -this.turnSign;
        this.clapN = (this.clapN || 0) + 1;
        this.turns.push({ t0: t, amt: this.turnSign * 0.62 * strength, s: strength, hue: this.clapN % GLINT_PAIRS.length });
      }
      e.snPrev = sn;

      // Hats: a jump in the top band over its own recent level (the riser is
      // slow, so it does not trigger).
      e.s8slow = ease(e.s8slow, sg[8], 6, dt);
      if (e.hatArmed && sg[8] > e.s8slow + 14) {
        e.hatArmed = false;
        this.sparkT = t;
        this.sparkSeed = (this.sparkSeed + 7.31) % 1000;
        e.hat = Math.min(1, sg[8] / 70);
      } else if (sg[8] < e.s8slow + 5) e.hatArmed = true;
      e.hatLvl = ease(e.hatLvl || 0, (sg[6] + sg[7] + sg[8]) / 300, 3, dt);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();
      const W = ctx.width, H = ctx.height;
      if (this.layoutFor !== W + 'x' + H) this.layout(W, H);

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const t = ms / 1000;
      this.listen(signals, dt, t);
      const e = this.env;
      const push = params.push;
      const E = e.energy * Math.min(1, push);
      const kick = e.kickSm * push;
      const s = this.seed;

      // One drift clock for everything that wanders; the drop flies faster.
      this.clock += dt * params.speed * (0.7 + 0.9 * E);
      const T = this.clock;
      // Travel along the marsh: faster in the drop, but only through the
      // slow energy level, so the music changes the speed and never jerks it.
      this.travelV = 38 * params.speed * (0.6 + 1.1 * E);
      this.cam += dt * this.travelV;

      // ---- palette
      let sch;
      const fixed = FIXED[params.sky | 0];
      if (fixed) sch = SCH[fixed];
      else {
        const pos = (T / 38) % CYCLE.length;
        const i0 = Math.floor(pos);
        sch = mixScheme(SCH[CYCLE[i0]], SCH[CYCLE[(i0 + 1) % CYCLE.length]], smooth01((pos - i0 - 0.6) / 0.4));
      }
      // The drop pushes the sky toward acid: more magenta, hotter horizon.
      if (fixed !== 'acid') sch = mixScheme(sch, SCH.acid, 0.38 * E);

      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      g.lineJoin = 'round';

      const hy = this.hy;
      const sunX = W * (0.5 + 0.14 * Math.sin(T * 0.021 + s.a));
      const sunR = 34 + 6 * e.bass;
      const sunY = hy - sunR * 0.55 - 14 * (0.5 + 0.5 * Math.sin(T * 0.017 + s.b));
      const glow = 0.6 + 0.5 * e.bass + 0.15 * kick + 0.3 * E;

      // The sun's rim flare follows the raw kick envelope (instant attack) so
      // it lands on the beat frame itself. It stays on the sun: a sky-wide
      // wash here in an earlier round made every beat move 90% of the frame.
      const flare = Math.min(1.5, e.kick * push);
      this.drawBackdrop(p, g, W, H, sch, sunX, sunY, sunR, glow, E, kick, T, flare);

      // ---- sun disc, crisp, then a soft additive rim over it. Disc first: a
      // disc drawn over the additive glow reads as a flat, dimmer coin.
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rgba(mixc(sch.sun, [255, 253, 245], 0.7));
      g.save();
      g.beginPath(); g.rect(0, 0, W, hy); g.clip();
      g.beginPath(); g.arc(sunX, sunY, sunR, 0, Math.PI * 2); g.fill();
      g.restore();
      g.globalCompositeOperation = 'lighter';
      const rimR = sunR * (1.8 + 0.9 * flare);
      let grd = g.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, rimR);
      grd.addColorStop(0, rgba(sch.sun, 0.5 + 0.4 * flare));
      grd.addColorStop(1, rgba(sch.sun, 0));
      g.fillStyle = grd;
      g.beginPath(); g.arc(sunX, sunY, rimR, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';

      // Kick rings: a soft halo leaving the sun on each beat of the drop.
      if (e.kick > 0.85 && (this.ringT.length === 0 || t - this.ringT[this.ringT.length - 1] > 0.3)) this.ringT.push(t);
      this.ringT = this.ringT.filter((r0) => t - r0 < 1.1);
      g.globalCompositeOperation = 'lighter';
      for (const r0 of this.ringT) {
        const a = (t - r0) / 1.1;
        const rr = sunR * 1.6 + a * 150;
        g.strokeStyle = rgba(sch.sun, 0.22 * (1 - a) * (1 - a) * Math.min(1, push) * (0.3 + 0.7 * E));
        g.lineWidth = 5 * (1 - a) + 1.5;
        g.beginPath(); g.arc(sunX, sunY, rr, Math.PI, Math.PI * 2); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';

      // ---- treeline
      const treeCol = mixc(sch.dark, [8, 4, 14], 0.6);
      g.fillStyle = rgba(treeCol);
      g.beginPath();
      g.moveTo(0, hy + 1);
      {
        // Far away, so it slides by slowly.
        const hs = this.treeH, n = hs.length, px = 0.06;
        const off = (this.cam * px) / W * n;
        for (let i = 0; i <= 200; i++) {
          const f = i / 200 * n + off;
          const i0 = Math.floor(f), fr = f - i0;
          const h = hs[i0 % n] * (1 - fr) + hs[(i0 + 1) % n] * fr;
          g.lineTo(W * i / 200, hy - h);
        }
      }
      g.lineTo(W, hy + 1);
      g.closePath();
      g.fill();

      // ---- glitter path on the water
      this.drawGlitter(g, W, H, sch, sunX, t, kick);

      // ---- the flock
      // A far flock low over the treeline first, hazed toward the sky, for
      // depth; then the main flock.
      this.drawFlock(g, W, H, params, sch, e, E, kick, T, t, true);
      this.drawFlock(g, W, H, params, sch, e, E, kick, T, t, false);

      // ---- reeds and motes
      if (params.reeds > 0.01) this.drawReeds(g, W, H, params, sch, e, E, t);
      this.drawMotes(g, W, H, sch, e, E, t, dt);

      g.restore();
    },

    // Sky, clouds, sun glow, rays and water, on a third-resolution canvas:
    // all of it is soft, so the upscale costs nothing visible.
    drawBackdrop(p, g, W, H, sch, sunX, sunY, sunR, glow, E, kick, T, flare) {
      const dw = Math.max(64, Math.round(p.width / 3));
      const dh = Math.max(36, Math.round(p.height / 3));
      if (!this.bg) {
        this.bg = document.createElement('canvas');
        // willReadFrequently keeps this canvas in CPU memory. Without it the
        // low-res layer lives on the GPU and every drawImage onto the p5
        // canvas forces a readback: 300+ ms a frame in the harness.
        this.bgc = this.bg.getContext('2d', { willReadFrequently: true });
      }
      if (this.bg.width !== dw || this.bg.height !== dh) { this.bg.width = dw; this.bg.height = dh; }
      const b = this.bgc;
      b.setTransform(dw / W, 0, 0, dh / H, 0, 0);
      b.globalCompositeOperation = 'source-over';
      b.globalAlpha = 1;
      const hy = this.hy;

      let grd = b.createLinearGradient(0, 0, 0, hy);
      grd.addColorStop(0, rgba(sch.sky[0]));
      grd.addColorStop(0.45, rgba(sch.sky[1]));
      grd.addColorStop(0.8, rgba(sch.sky[2]));
      grd.addColorStop(1, rgba(sch.sky[3]));
      b.fillStyle = grd;
      b.fillRect(0, 0, W, hy + 1);

      // Water: the sky mirrored, deeper and cooler.
      const deep = (c, k) => mixc(c, [10, 12, 30], k);
      grd = b.createLinearGradient(0, hy, 0, H);
      grd.addColorStop(0, rgba(deep(sch.sky[3], 0.35)));
      grd.addColorStop(0.3, rgba(deep(sch.sky[2], 0.5)));
      grd.addColorStop(1, rgba(deep(sch.sky[1], 0.7)));
      b.fillStyle = grd;
      b.fillRect(0, hy, W, H - hy);

      // Clouds: a dark body with a sunlit underside, lit more the nearer the
      // horizon and the sun.
      for (const c of this.clouds) {
        const span = W + 500;
        let x = ((c.x + T * c.sp) % span + span) % span - 250;
        const near = c.y / hy;
        const toSun = Math.max(0, 1 - Math.abs(x - sunX) / (W * 0.6));
        const body = mixc(sch.dark, sch.sky[1], 0.2 + 0.4 * near);
        const lit = mixc(body, sch.lit, 0.35 + 0.55 * near * (0.5 + 0.5 * toSun));
        this.puff(b, x, c.y, c.rx, c.ry, body, 0.55);
        this.puff(b, x + (sunX - x) * 0.03, c.y + c.ry * 0.45, c.rx * 0.8, c.ry * 0.6, lit, 0.5 + 0.35 * toSun);
      }

      // Sun glow and, in the drop, rays. Additive.
      b.globalCompositeOperation = 'lighter';
      const gr = sunR * (5 + 3 * glow);
      grd = b.createRadialGradient(sunX, sunY, 0, sunX, sunY, gr);
      grd.addColorStop(0, rgba(sch.sun, 0.55 * glow));
      grd.addColorStop(0.25, rgba(mixc(sch.sun, sch.sky[3], 0.5), 0.25 * glow));
      grd.addColorStop(1, rgba(sch.sky[3], 0));
      b.fillStyle = grd;
      b.fillRect(sunX - gr, sunY - gr, gr * 2, gr * 2);

      const rays = 0.1 + 0.9 * E;
      if (rays > 0.05) {
        const len = Math.max(W, H) * 1.1;
        const n = 14;
        for (let i = 0; i < n; i++) {
          const a = Math.PI + (i + 0.5) / n * Math.PI + 0.08 * Math.sin(T * 0.13 + i * 1.7);
          const wdt = 0.035 + 0.03 * Math.sin(i * 2.3 + T * 0.21);
          const al = rays * 0.06 * (0.6 + 0.4 * Math.sin(i * 3.1 + T * 0.4));
          grd = b.createRadialGradient(sunX, sunY, sunR, sunX, sunY, len);
          grd.addColorStop(0, rgba(sch.sun, al));
          grd.addColorStop(1, rgba(sch.sun, 0));
          b.fillStyle = grd;
          b.beginPath();
          b.moveTo(sunX, sunY);
          b.lineTo(sunX + Math.cos(a - wdt) * len, sunY + Math.sin(a - wdt) * len);
          b.lineTo(sunX + Math.cos(a + wdt) * len, sunY + Math.sin(a + wdt) * len);
          b.closePath();
          b.fill();
        }
      }
      // The sun's column on the water.
      grd = b.createLinearGradient(0, hy, 0, H);
      grd.addColorStop(0, rgba(sch.sun, 0.35 * glow));
      grd.addColorStop(1, rgba(sch.sun, 0));
      b.fillStyle = grd;
      b.beginPath();
      b.moveTo(sunX - sunR * 1.5, hy);
      b.lineTo(sunX + sunR * 1.5, hy);
      b.lineTo(sunX + sunR * 4, H);
      b.lineTo(sunX - sunR * 4, H);
      b.closePath();
      b.fill();
      b.globalCompositeOperation = 'source-over';

      g.imageSmoothingEnabled = true;
      g.drawImage(this.bg, 0, 0, W, H);
    },

    puff(b, x, y, rx, ry, col, a) {
      b.save();
      b.translate(x, y);
      b.scale(1, ry / rx);
      const grd = b.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, rgba(col, a));
      grd.addColorStop(0.6, rgba(col, a * 0.5));
      grd.addColorStop(1, rgba(col, 0));
      b.fillStyle = grd;
      b.fillRect(-rx, -rx, rx * 2, rx * 2);
      b.restore();
    },

    // How much a hat has lit glint k (0-1): each hat picks a new random
    // subset, and it fades over ~200 ms.
    spark(k, t) {
      const age = t - this.sparkT;
      if (age > 0.4) return 0;
      const pick = (Math.sin(k * 91.7 + this.sparkSeed * 13.1) * 43758.5) % 1;
      if (Math.abs(pick) > 0.45) return 0;
      return this.env.hat * Math.exp(-age / 0.09);
    },

    drawGlitter(g, W, H, sch, sunX, t, kick) {
      const hy = this.hy;
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = 1.4;
      const hl = this.env.hatLvl || 0;
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      const ripP = new Path2D();
      const wrapW = W + 200;
      for (const q of this.rip) {
        const y = hy + 3 + q.d * (H - hy);
        const x = ((q.x - this.cam * (0.12 + 1.3 * q.d)) % wrapW + wrapW) % wrapW - 100;
        ripP.moveTo(x, y); ripP.lineTo(x + q.len, y);
      }
      g.strokeStyle = rgba(mixc(sch.sky[2], sch.sun, 0.4), 0.16);
      g.stroke(ripP);
      for (const q of this.glit) {
        const y = hy + 2 + q.d * (H - hy);
        const spread = 30 + q.d * 150;
        const x = sunX + q.off * spread * (0.6 + 0.4 * Math.sin(t * 0.3 + q.ph));
        const tw = 0.5 + 0.5 * Math.sin(t * q.f + q.ph);
        const a = (0.1 + 0.3 * tw * tw) * (1 - 0.5 * q.d) + 0.9 * this.spark(q.k, t) + 0.15 * hl;
        if (a < 0.03) continue;
        // Bucketed by brightness: 160 separate strokes cost more raster time
        // than the whole flock.
        const k = a < 0.2 ? 0 : a < 0.45 ? 1 : 2;
        paths[k].moveTo(x - q.len, y); paths[k].lineTo(x + q.len, y);
      }
      const lv = [0.14, 0.32, 0.8];
      for (let k = 0; k < 3; k++) { g.strokeStyle = rgba(sch.sun, lv[k]); g.stroke(paths[k]); }
      g.globalCompositeOperation = 'source-over';
    },

    drawFlock(g, W, H, params, sch, e, E, kick, T, t, far) {
      const n = far ? Math.min(800, (params.birds * 0.12) | 0) : Math.min(MAX_BIRDS, params.birds | 0);
      if (far) T = T * 0.8 + 41;
      const s = this.seed;
      const fold = params.fold;
      const push = params.push;
      const sheen = params.sheen;

      // Where the flock is and how big: it wanders the band of sky above the
      // treeline, swells with the bass, grows in the drop, clenches on kicks.
      const cxAt = far
        ? (tt) => W * (0.5 + 0.34 * Math.sin(0.07 * tt + s.f))
        : (tt) => W * (0.5 + 0.13 * Math.sin(0.11 * tt + s.a) + 0.05 * Math.sin(0.27 * tt + s.b));
      const cyAt = far
        ? (tt) => this.hy - H * (0.17 + 0.04 * Math.sin(0.2 * tt + s.a))
        : (tt) => H * (0.32 + 0.05 * Math.sin(0.15 * tt + s.c) + 0.03 * Math.sin(0.37 * tt + s.d));
      const R = (far ? 38 : 150) * (1 + (far ? 0.35 : 0.85) * E + 0.25 * e.bass * push) * (1 + 0.12 * Math.sin(0.19 * T + s.e)) * (1 - 0.05 * Math.min(1.3, kick));
      const L = R * (1.8 + 0.5 * Math.sin(0.1 * T + s.f));
      const Hh = R * (far ? 0.6 : 0.42 + 0.18 * Math.sin(0.14 * T + 1));
      const A2 = R * (0.25 + 0.45 * fold * (0.35 + 0.65 * E));
      const twistAmp = fold * (0.9 + 1.0 * E) * (0.55 + 0.45 * Math.sin(0.083 * T + s.b));
      const bend = fold * (0.7 + 0.8 * E) * Math.sin(0.061 * T + s.c);
      const undul = R * (0.25 + 0.25 * E);
      const pitch = 0.35 * Math.sin(0.05 * T + s.d);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const F = far ? 900 : 1500;
      const lag = 0.9;            // seconds of drift-clock lag, end to end of the ribbon
      const turnDelay = 0.7;      // real seconds for a clap's turn to cross the flock
      const turnDur = 0.32;

      // Settle turns that every bird has finished into the base yaw.
      while (!far && this.turns.length && t - this.turns[0].t0 > turnDelay + turnDur) {
        this.yawBase += this.turns[0].amt;
        this.turns.shift();
      }
      const yaw0 = this.yawBase + 0.9 * Math.sin(0.043 * T + s.e) + 0.05 * T;
      const turns = this.turns;
      const kicks = this.kicks;

      const P = [new Path2D(), new Path2D(), new Path2D()];
      const G = [];
      for (let k = 0; k < GLINT_PAIRS.length * 3; k++) G.push(new Path2D());
      let glints = 0, irisN = 0;
      const I = IRIS.map(() => new Path2D());
      // Reflection: only birds whose mirror image lands on stage, and only
      // the heavy or coloured ones.
      const Rf = new Path2D(), Ri = new Path2D();
      const mirrorMin = 2 * this.hy - H;
      let refl = 0;
      const iri = far ? 0 : 0.7 * sheen * E;
      const tint = far ? 0 : Math.min(1, sheen * (0.35 + 0.65 * E));

      const jit = far ? 0.4 : 1.8, fs = far ? 0.6 : 1.6;
      const U = this.U, V = this.V, Wd = this.Wd, Ph = this.Ph, Fq = this.Fq, Jt = this.Jt;
      for (let i = 0; i < n; i++) {
        const u = U[i], v = V[i];
        const tl = T - lag * (u + 1);
        // Ribbon slot, then its undulation and fold, both lagged along u.
        let X = u * L + jit * Jt[i] * Math.sin(t * 0.7 + Ph[i]);
        let Y = v * Hh * (1 - 0.35 * u * u) + undul * Math.sin(2.1 * u + 0.9 * tl) + jit * Jt[i] * Math.cos(t * 0.53 + Ph[i] * 1.3);
        let Z = Wd[i] * R * (far ? 0.22 : 0.13) + A2 * Math.sin(1.6 * u + 1.1 * v + 0.6 * tl);
        // Twist about the long axis.
        const tw = twistAmp * u + 0.6 * Math.sin(0.31 * tl + s.a);
        const ct = Math.cos(tw), st = Math.sin(tw);
        let y2 = Y * ct - Z * st; Z = Y * st + Z * ct; Y = y2;
        // Bend the long axis round into depth.
        const be = bend * u;
        const cb = Math.cos(be), sb = Math.sin(be);
        let x2 = X * cb - Z * sb; Z = X * sb + Z * cb; X = x2;
        // Kick ripple: each kick runs head to tail through the flock in
        // ~0.3 s. Birds in the wave pull in toward the ribbon's spine and
        // show more wing, so a band of dark density travels through it.
        let kr = 0;
        if (!far) {
          const kd = (u + 1.2) * 0.14;
          for (let k = 0; k < kicks.length; k++) {
            const q = (t - kicks[k].t0 - kd) / 0.2;
            if (q > 0 && q < 1) kr = Math.max(kr, kicks[k].s * Math.sin(Math.PI * q));
          }
          if (kr > 0) { const c = 1 - 0.3 * kr * push; X *= c; Y *= c; Z *= c; }
        }
        // Yaw, including any clap turn that has reached this bird.
        let yaw = yaw0, bank = 0, hue = 0;
        const delay = (u + 1.25) * 0.5 * turnDelay;
        for (let k = 0; k < turns.length; k++) {
          const q = (t - turns[k].t0 - delay) / turnDur;
          if (q <= 0) continue;
          if (q >= 1) { yaw += turns[k].amt; continue; }
          const sq = q * q * (3 - 2 * q);
          yaw += turns[k].amt * sq;
          const bq = Math.sin(Math.PI * q);
          const bk = turns[k].s * bq * bq * bq;
          if (bk > bank) { bank = bk; hue = turns[k].hue; }
        }
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        x2 = X * cy - Z * sy; Z = X * sy + Z * cy; X = x2;
        y2 = Y * cp - Z * sp; Z = Y * sp + Z * cp; Y = y2;

        const ps = F / (F + Z);
        const tc = T - 1.2 * (u + 1) * 0.5;   // the tail trails the head's path
        const sx = cxAt(tc) + X * ps;
        const sy2 = cyAt(tc) + Y * ps;
        if (sx < -10 || sx > W + 10 || sy2 < -10 || sy2 > H + 10) continue;

        // A bird shows more of itself where the sheet faces you, and as it
        // banks through a turn.
        // Edge-on stretches get heavier flecks on top of their projected
        // density, so the folds read as bold dark ribbons.
        const face = Math.abs(ct);
        const ink = ps * (0.45 + 0.9 * (1 - face) + 1.1 * bank + 1.8 * kr * push);
        const flap = Math.sin(t * Fq[i] + Ph[i]);
        const len = fs * (1.15 * ink * (0.75 + 0.25 * flap) + 0.35);
        const ang = 0.9 * flap + 0.3 * sy + 0.4 * Math.sin(Ph[i] * 3);
        const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;

        if (bank > 0.6 && tint > 0.05) {
          // Across the band's width, so the band itself is iridescent.
          const b = hue * 3 + (v < -0.3 ? 0 : v < 0.3 ? 1 : 2);
          G[b].moveTo(sx - dx, sy2 - dy); G[b].lineTo(sx + dx, sy2 + dy);
          glints++;
        } else if (iri > 0.02 && face > 0.55 && Math.cos(tw + 0.7 * yaw + 0.9 * u - t * 0.5) > 1 - iri) {
          // Plumage: where the sheet faces you and its angle catches the
          // light, a stretch of birds turns jewel-coloured, the hue shifting
          // across the sheet. Edge-on folds never do, so they stay the bold
          // dark ribbons that give the flock its shape.
          const ph = (tw * 0.35 + 0.25 * u + t * 0.07) % 1;
          I[((ph < 0 ? ph + 1 : ph) * IRIS.length) | 0].moveTo(sx - dx, sy2 - dy);
          I[((ph < 0 ? ph + 1 : ph) * IRIS.length) | 0].lineTo(sx + dx, sy2 + dy);
          irisN++;
          if (!far && sy2 > mirrorMin) { Ri.moveTo(sx - dx, sy2 - dy); Ri.lineTo(sx + dx, sy2 + dy); refl++; }
        } else {
          const b = ink < 0.75 ? 0 : ink < 1.2 ? 1 : 2;
          P[b].moveTo(sx - dx, sy2 - dy); P[b].lineTo(sx + dx, sy2 + dy);
          if (b > 0 && !far && sy2 > mirrorMin) { Rf.moveTo(sx - dx, sy2 - dy); Rf.lineTo(sx + dx, sy2 + dy); refl++; }
        }
      }

      const bird = far ? mixc([12, 6, 16], sch.sky[1], 0.45) : mixc([12, 6, 16], sch.dark, 0.18);
      const widths = far ? [0.9, 1.1, 1.4] : [1.3, 1.9, 2.7];
      g.globalCompositeOperation = 'source-over';
      // Butt caps: round caps on thousands of tiny segments cost raster time
      // and are invisible at this size.
      g.lineCap = 'butt';
      for (let b = 0; b < 3; b++) {
        g.strokeStyle = rgba(bird, 0.6 + 0.18 * b);
        g.lineWidth = widths[b];
        g.stroke(P[b]);
      }
      if (glints) {
        for (let b = 0; b < G.length; b++) {
          const pair = GLINT_PAIRS[(b / 3) | 0];
          const c = mixc(hex(pair[0]), hex(pair[1]), (b % 3) / 2);
          g.strokeStyle = rgba(mixc(bird, c, tint), 0.95);
          g.lineWidth = 2.2;
          g.stroke(G[b]);
        }
      }
      if (irisN) {
        g.lineWidth = 1.9;
        for (let k = 0; k < IRIS.length; k++) {
          g.strokeStyle = rgba(mixc(bird, hex(IRIS[k]), 0.85), 0.9);
          g.stroke(I[k]);
        }
      }

      // Reflection in the marsh: the same paths mirrored about the horizon,
      // dimmed into the water. Only the heavier buckets: the fine haze would
      // vanish there anyway.
      if (!far && refl) {
        const hy = this.hy;
        g.save();
        g.beginPath(); g.rect(0, hy + 1, W, H - hy); g.clip();
        g.translate(0, 2 * hy);
        g.scale(1, -1);
        const wet = mixc(bird, sch.sky[1], 0.25);
        g.strokeStyle = rgba(wet, 0.32);
        g.lineWidth = widths[1];
        g.stroke(Rf);
        // One sheen colour: the water blurs it anyway.
        g.strokeStyle = rgba(hex(IRIS[1]), 0.22);
        g.stroke(Ri);
        g.restore();
      }
    },

    drawReeds(g, W, H, params, sch, e, E, t) {
      g.lineCap = 'round';
      const dens = params.reeds;
      const reeds = this.reedList;
      const col = [6, 3, 10];
      const rim = mixc(sch.sun, sch.lit, 0.4);
      const plumeCol = mixc(sch.sun, sch.lit, 0.3);
      const hl = e.hatLvl || 0;
      const body = new Path2D();
      const rimP = new Path2D();
      const tips = [];
      // Shorter reeds are further back in the list; drawing them all in one
      // path keeps it one fill.
      for (let i = 0; i < reeds.length; i++) {
        const r = reeds[i];
        if (r.glint > dens) continue;
        const wind = 0.05 * Math.sin(t * 0.8 + r.ph) + 0.03 * Math.sin(t * 1.9 + r.ph * 2.3) + 0.04 * e.bass * Math.sin(t * 3 + r.ph);
        const lean = r.lean + wind;
        const sp0 = this.reedSpan;
        const bx = ((r.x - this.cam * r.depth) % sp0 + sp0) % sp0 - (sp0 - W) / 2;
        if (bx < -r.h * 0.6 - 20 || bx > W + r.h * 0.6 + 20) continue;
        const by = H + 4;
        const tx = bx + lean * r.h, ty = H - r.h;
        const mx = bx + lean * r.h * 0.35, my = H - r.h * 0.5;
        const w = r.w;
        body.moveTo(bx - w, by);
        body.quadraticCurveTo(mx - w * 0.6, my, tx, ty);
        body.quadraticCurveTo(mx + w * 0.6, my, bx + w, by);
        body.closePath();
        rimP.moveTo(mx + w * 0.3 + (tx - mx) * 0.1, my + (ty - my) * 0.1);
        rimP.quadraticCurveTo(mx + w * 0.4, my - r.h * 0.1, tx, ty);
        if (r.cat) {
          body.ellipse(tx - lean * 12, ty + 12, 3.2, 12, Math.atan(lean), 0, Math.PI * 2);
        }
        if (r.plume) tips.push([tx, ty, lean, r.glint, r.h]);
      }
      g.fillStyle = rgba(col);
      g.fill(body);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(rim, 0.18 + 0.25 * hl);
      g.lineWidth = 1;
      g.stroke(rimP);

      // Plumes: feathery heads, backlit, drooping downwind. Each hat lights a
      // new handful of them.
      for (const [tx, ty, lean, k, h] of tips) {
        const sp = this.spark(k, t);
        const a = 0.14 + 0.2 * hl + 0.8 * sp;
        g.strokeStyle = rgba(plumeCol, a);
        g.lineWidth = 1.1;
        const size = 10 + h * 0.05;
        g.beginPath();
        for (let j = 0; j < 7; j++) {
          const aa = -Math.PI / 2 + lean * 1.5 + (j - 3) * 0.28 + 0.12 * Math.sin(t * 2 + j + k * 10);
          const l = size * (0.6 + 0.4 * Math.cos((j - 3) * 0.5));
          g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(aa) * l * 0.6, ty + Math.sin(aa) * l * 0.6,
            tx + Math.cos(aa + 0.5 + lean) * l, ty + Math.sin(aa + 0.5 + lean) * l);
        }
        g.stroke();
        if (sp > 0.1) {
          const rr = 3 + 6 * sp;
          const grd = g.createRadialGradient(tx, ty, 0, tx, ty, rr * 2);
          grd.addColorStop(0, rgba([255, 250, 235], 0.8 * sp));
          grd.addColorStop(1, rgba(plumeCol, 0));
          g.fillStyle = grd;
          g.beginPath(); g.arc(tx, ty, rr * 2, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    },

    drawMotes(g, W, H, sch, e, E, t, dt) {
      g.globalCompositeOperation = 'lighter';
      const col = mixc(sch.sun, sch.lit, 0.35);
      const hl = e.hatLvl || 0;
      for (const m of this.motes) {
        // They drift past with the travel, the out-of-focus near ones fastest.
        m.x += (-this.travelV * (m.bokeh ? 2.6 : 0.6 + 0.3 * m.z) + 0.3 * m.vx + 6 * Math.sin(t * 0.4 + m.ph)) * dt;
        m.y += (m.vy + 4 * Math.cos(t * 0.5 + m.ph)) * dt;
        if (m.x > W + 30) m.x -= W + 60;
        if (m.x < -30) m.x += W + 60;
        if (m.y < -30) m.y += H + 60;
        const sp = this.spark(m.k, t);
        if (m.bokeh) {
          const a = (0.04 + 0.07 * E + 0.05 * hl) * (0.6 + 0.4 * Math.sin(t * 0.7 + m.ph));
          const grd = g.createRadialGradient(m.x, m.y, m.z * 0.6, m.x, m.y, m.z);
          grd.addColorStop(0, rgba(col, a));
          grd.addColorStop(1, rgba(col, 0));
          g.fillStyle = grd;
          g.beginPath(); g.arc(m.x, m.y, m.z, 0, Math.PI * 2); g.fill();
        } else {
          const a = 0.15 + 0.2 * Math.sin(t * 1.3 + m.ph) ** 2 + 0.9 * sp;
          g.fillStyle = rgba(col, a);
          g.beginPath(); g.arc(m.x, m.y, m.z * (0.6 + 0.8 * sp), 0, Math.PI * 2); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    },
  });
})();
