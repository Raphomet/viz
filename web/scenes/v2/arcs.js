// Arcs V2 — Raph's 2016 sweeping arcs (../../viz/arcs.js, ../../../Arcs.pde)
// restaged as the grid the sketch always had in it. Notes in harness/v2/arcs.md.
//
// V1 is already a Whitney-style machine: a grid of concentric arcs, each
// drawing itself closed from twelve o'clock and then erasing itself as the
// tail chases the head, staggered by ring (X1), row (Z0) and column (Z1). Its
// defaults (a 1×1 grid, one arc, no stagger) hid all of that behind a single
// crescent, which every judge read as a loading spinner. V2 keeps the arc rule
// exactly and changes the stage (an all-over grid that fills the frame) and
// how the music reaches the arcs: through their phase. The kick writes into
// the phase field as a travelling ripple, so the grid of clocks falls in and
// out of step with the track instead of only thickening.
(function () {
  const shared = window.VIZ_PALETTES || [];
  const TAU = Math.PI * 2;

  // Two palettes of our own ahead of the ColorLisa rows. Tonhalle is the
  // default because a cream ground is a floodlight in a dark room (the floor
  // judge); Plakat is the same poster printed for daylight.
  // Order: ground, ink 1 (the calm ink), ink 2 (clap), ink 3 (accent).
  const OWN = [
    { name: 'Tonhalle', colors: ['#111316', '#EAE4D5', '#E8B03A', '#E4472B'] },
    { name: 'Plakat', colors: ['#ECE6D9', '#17171B', '#2F5FA8', '#D8391F'] },
  ];

  const PRESETS = {
    calm: { rows: 3, rings: 3, weight: 5, speed: 0.5, ripple: 0.6, inks: 1, counter: 0 },
    drop: { rows: 4, rings: 6, weight: 6.5, speed: 1, ripple: 1, inks: 3, counter: 1 },
    // One frame-high set: the floor judge's "span most of the frame height",
    // and the closest this gets to the V1 picture, grown to stage size.
    solo: { rows: 1, rings: 8, weight: 9, speed: 0.6, spread: 0.8, ripple: 0.7, inks: 2, counter: 1 },
    // A dense field for the peak: the director's doubled grid.
    field: { rows: 7, rings: 3, weight: 3.5, speed: 1.2, spread: 0.5, ripple: 1, inks: 3, counter: 0 },
  };
  // What "Follow the track" eases toward the drop. counter is discrete and
  // flips once the blend is past halfway.
  const DRIVE = ['rows', 'rings', 'weight', 'speed', 'ripple', 'inks'];

  const RIPPLE_V = 520;        // virtual units/s: crosses a 600-high stage in ~1 s
  const RIPPLE_W = 55;         // half-width of the wavefront band
  const RIPPLE_KEEP = 7;       // s: how long a ripple's phase advance takes to relax
  const CLAP_LIFE = 1.7;       // s

  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function chroma(hex) {
    const c = rgbOf(hex);
    return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  }
  function luma(hex) {
    const c = rgbOf(hex);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function rgba(hex, a) {
    const c = rgbOf(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }
  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  VIZ.register({
    id: 'arcsv2',
    name: 'Arcs',
    versionOf: 'arcs',
    version: 'V2',
    order: 730,

    params: [
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: OWN.concat(shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() }))),
        default: 0 },
      // V1's X0 (grid size) as a continuous zoom: fractional rows scale the
      // grid about the centre, so a glide opens the sheet instead of cutting.
      { key: 'rows', legacy: 'X0', label: 'Grid rows', type: 'range', min: 1, max: 8,
        default: PRESETS.calm.rows, step: 0.01 },
      { key: 'rings', legacy: 'SIZE0', label: 'Arcs per cell', type: 'range', min: 1, max: 8,
        default: PRESETS.calm.rings, step: 0.01 },
      { key: 'weight', legacy: 'SIZE1', label: 'Line weight', type: 'range', min: 0.5, max: 14,
        default: PRESETS.calm.weight, step: 0.01 },
      // Raph's units: 1 is one second per sweep.
      { key: 'speed', legacy: 'SPEED', label: 'Sweep speed', type: 'range', min: 0.05, max: 2,
        default: PRESETS.calm.speed, step: 0.01 },
      // X1, Z0 and Z1 folded into one: how far apart in phase the rings and
      // cells run. 0 is V1's lockstep, where the whole sheet empties at once.
      { key: 'spread', legacy: 'X1 / Z0 / Z1', label: 'Phase spread', type: 'range', min: 0, max: 1,
        default: 0.6, step: 0.01 },
      { key: 'ripple', label: 'Kick ripple', type: 'range', min: 0, max: 1,
        default: PRESETS.calm.ripple, step: 0.01 },
      { key: 'inks', label: 'Inks', type: 'range', min: 1, max: 3, default: PRESETS.calm.inks, step: 1 },
      // V1's MODE. Per cell is Raph's default and the Swiss reading: each
      // concentric set printed in one ink.
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['Colour per cell', 'Colour per arc'], default: 0 },
      { key: 'counter', label: 'Counter-rotate', type: 'select', options: ['Off', 'On'],
        default: PRESETS.calm.counter },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      {
        id: 'shuffle',
        label: 'Shuffle palette',
        // The original's shuffleCurrentColors, ground included, in place.
        run(params) {
          const ar = this.palettes && this.palettes[Math.round(params.colorPalette)];
          if (!ar) return;
          for (let i = ar.length - 1; i > 0; i--) {
            const index = Math.floor(Math.random() * (i + 1));
            const a = ar[index];
            ar[index] = ar[i];
            ar[i] = a;
          }
        },
      },
    ],

    gallery: {
      title: 'Arcs V2',
      technique: 'Canvas 2D: an all-over drifting grid of cells, each holding concentric round-capped arcs with hairline ghost circles; every arc follows Raph\'s draw-then-erase sweep on an integrated phase, offset by ring stagger, a diagonal row/column wave and the sum of travelling kick ripples (smoothstep wavefronts from a wandering origin that decay over seconds); clap onsets stamp flat quarter-disc sectors that sweep themselves closed; onset detection against slow baselines; a section follower easing between calm and drop presets',
      brief: 'Raph\'s 2016 arcs as a Müller-Brockmann concert poster that keeps time. A grid of concentric arcs fills the stage in flat ink on a near-black sheet and drifts slowly sideways. Each ring draws itself closed from twelve o\'clock and then erases itself as its tail chases the head round, as in the original, while a hairline groove keeps every circle on the page. The rings and cells run out of step in a slow diagonal wave, so the sheet is always half drawn. Each kick sends a ripple across the grid from a point that wanders from beat to beat. As the wavefront passes, each cell\'s arcs whip a quarter turn forward and its outer ring flares thick and vermilion. The advance lingers and relaxes, so the kicks leave interference in the clockwork. Each clap stamps a solid quarter-disc into one cell, which sweeps itself away like the arcs. The bass thickens the lines, and hats grow beads at the arcs\' leading tips. The drop opens the grid from three rows to four, doubles the rings, prints whole sets in ochre and vermilion beside the bone (Raph\'s colour-per-cell mode), speeds the sweep to Raph\'s one second and sets alternate rings turning against each other. The breakdown slows everything to a two-second sweep in one ink.',
      lineage: [
        'V1: Arcs (web/viz/arcs.js), a port of Raph\'s Arcs.pde (2016): a grid of concentric arcs, each drawn closed and then erased over one second, staggered by ring (X1), row (Z0) and column (Z1), with ColorLisa palettes.',
        'Six-judge panel (2026-09-28): bottom 12 of 72, mean 2.00; every judge saw one small crescent at the centre. Scope chosen: restage the existing system and route the music into its phase, keeping the arc rule itself unchanged.',
        'Purist ("the real piece, a Whitney-style grid of phase-staggered sweeps, is hidden behind Grid size and the staggers"): the grid fills the stage and the staggers are on by default, folded into one Phase spread control.',
        'Floor (the sweep collapsing to zero reads as a dropout; scale it up; the drop adds rings in a second colour): phase spread keeps half the sheet drawn at every instant, hairline ghost circles hold the grid, the drop goes from 3 to 6 rings and 1 to 3 inks, and the Solo preset is one frame-high set.',
        'Director (phase offset from a point that wanders with each kick, a stadium card stunt; the breakdown slows the sweep): a travelling ripple that advances each cell\'s phase a quarter turn as it passes, confined to its wavefront; the calm sweep takes two seconds.',
        'Designer (Müller-Brockmann grid of concentric sets, a beat draws a quadrant, the drop adds a second colour and a counter-rotating ring set): the clap stamps a flat quarter-disc that sweeps itself closed; the drop sets alternate rings turning anticlockwise.',
        'Rejected: a line of type or chapter captions (decoration), retiring the scene or folding it into another (psychonaut; the grammar is the seed), and V1\'s HSB gradient palettes (TASTE: no hue ramps as a finish).',
      ],
    },

    setup(p) {
      // Own copies so shuffling never reorders another visual's palette.
      this.palettes = OWN.concat(shared).map((pal) => pal.colors.slice());
    },

    enter() {
      this.state = null;
    },

    init() {
      this.state = {
        lastT: null,
        phase: 0,          // cycles, integrated so speed can glide without jumps
        drift: 0,          // grid scroll, in cells
        ripples: [],
        claps: [],
        kicks: 0,
        env: { bass: 0, hat: 0, kf: 0, ks: 0, cf: 0, cs: 0, kWait: 0, cWait: 0,
          low: 0, dropOn: false, auto: 0 },
      };
    },

    // Ground, the inks rings cycle through, the clap ink and the kick accent.
    // For ColorLisa rows the accent is the most saturated colour and the calm
    // ink the one furthest in luma from the ground, so one-ink looks read.
    inksOf(pal, own) {
      const ground = pal[0];
      const rest = pal.slice(1).filter((c, i, a) =>
        c.toLowerCase() !== ground.toLowerCase() &&
        a.findIndex((d) => d.toLowerCase() === c.toLowerCase()) === i);
      if (!rest.length) rest.push(luma(ground) > 128 ? '#111111' : '#EEEEEE');
      if (own) {
        return { ground, inks: rest.slice(0, 3), clap: rest[1] || rest[0], accent: rest[rest.length - 1] };
      }
      const gl = luma(ground);
      const byContrast = rest.slice().sort((a, b) => Math.abs(luma(b) - gl) - Math.abs(luma(a) - gl));
      let accent = rest[0];
      for (const c of rest) if (chroma(c) > chroma(accent)) accent = c;
      const inks = [byContrast[0]];
      for (const c of byContrast) if (inks.length < 3 && !inks.includes(c)) inks.push(c);
      const clap = inks.find((c) => c !== inks[0] && c !== accent) || inks[1] || inks[0];
      return { ground, inks, clap, accent };
    },

    listen(signals, dt) {
      const s = this.state;
      const e = s.env;
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 6, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 8, dt);
      const kick = signals[0] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      e.ks = ease(e.ks, kick, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      let kick1 = 0;
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        kick1 = clamp((e.kf - e.ks) * 3, 0.4, 1);
        e.kWait = 0.2;
      }
      // Clap: fast minus slow on the clap bands, so the breakdown's sustained
      // pad in the same bands never fires it.
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      let clap1 = false;
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        clap1 = true;
        e.cWait = 0.6;
      }
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick1, clap1 };
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      if (!this.state) this.init();
      const s = this.state;
      const t = p.millis() / 1000;
      const dt = s.lastT === null ? 1 / 60 : clamp(t - s.lastT, 0, 0.1);
      s.lastT = t;
      const e = s.env;
      const { kick1, clap1 } = this.listen(signals, dt);

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.8 : 0.6, dt);
      const a = follow ? e.auto : 0;
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * a;
      const counter = follow && a > 0.5 ? 1 : Math.round(params.counter);
      const spread = params.spread;
      const perArc = Math.round(params.mode) === 1;

      s.phase += P.speed * dt;
      s.drift += (0.035 + 0.05 * e.bass) * (0.5 + P.speed) * dt;

      const rows = clamp(P.rows, 1, 8);
      const cell = H / rows;
      const outer = cell * 0.44;

      // Kick: a ripple from a point that wanders from beat to beat along a
      // slow Lissajous, so successive waves cross the sheet from new places.
      if (kick1 && P.ripple > 0.01) {
        const n = s.kicks++;
        s.ripples.push({
          x: W / 2 + W * 0.42 * Math.sin(n * 2.39 + 0.7),
          y: H / 2 + H * 0.4 * Math.sin(n * 1.71),
          t0: t, amp: kick1 * P.ripple,
        });
      }
      s.ripples = s.ripples.filter((r) => t - r.t0 < RIPPLE_KEEP * 4);

      // Grid extents: columns tile past both edges while the sheet drifts.
      const c0 = Math.floor(s.drift - W / 2 / cell) - 1;
      const c1 = Math.ceil(s.drift + W / 2 / cell) + 1;
      const jr = Math.ceil(H / 2 / cell) + 1;

      if (clap1) {
        // Stamp into a visible cell, preferring the middle band of the frame.
        const cc = Math.round(s.drift + (Math.random() - 0.5) * (W / cell - 1));
        const jj = Math.round((Math.random() - 0.5) * Math.max(0, rows - 1));
        s.claps.push({ c: cc, j: jj, q: Math.floor(Math.random() * 4), t0: t });
      }
      s.claps = s.claps.filter((c) => t - c.t0 < CLAP_LIFE);

      const palIdx = Math.round(params.colorPalette);
      const pal = this.palettes[palIdx] || this.palettes[0];
      const { ground, inks, clap, accent } = this.inksOf(pal, palIdx < OWN.length);
      const nInks = clamp(Math.round(P.inks), 1, inks.length);

      p.colorMode(p.RGB, 255);
      p.background(ground);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      g.setLineDash([]);

      const ringsF = clamp(P.rings, 1, 8);
      const nR = Math.ceil(ringsF - 1e-3);
      const gap = outer / ringsF;
      const wBase = Math.min(P.weight * (1 + 0.55 * e.bass), gap * 0.62);
      const hat = clamp(e.hat * 1.5, 0, 1);
      const ghost = rgba(inks[0], luma(ground) > 128 ? 0.2 : 0.17);

      // Clap wedges first, under the arcs: a flat quarter-disc that appears
      // whole and then sweeps itself closed from its leading edge, the way
      // Raph's arcs erase themselves.
      for (const c of s.claps) {
        // Never the cell's own ink, or the quarter-disc merges into its rings.
        const slot = (((c.c * 141 + c.j * 7) % 4) + 4) % 4;
        const own = perArc ? null : inks[[0, 1, 0, 2][slot] % nInks];
        g.fillStyle = own === clap ? (clap === accent ? inks[0] : accent) : clap;
        const x = W / 2 + (c.c - s.drift) * cell;
        const y = H / 2 + c.j * cell;
        const age = (t - c.t0) / CLAP_LIFE;
        const grow = smooth(0, 0.06, age);
        const eat = smooth(0.35, 1, age);
        const a0 = -Math.PI / 2 + c.q * Math.PI / 2;
        const r = outer * (0.7 + 0.3 * grow);
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, r, a0 + eat * Math.PI / 2, a0 + Math.PI / 2);
        g.closePath();
        g.fill();
      }

      for (let j = -jr; j <= jr; j++) {
        const y = H / 2 + j * cell;
        if (y + outer + wBase < 0 || y - outer - wBase > H) continue;
        for (let c = c0; c <= c1; c++) {
          const x = W / 2 + (c - s.drift) * cell;
          if (x + outer + wBase < 0 || x - outer - wBase > W) continue;

          // The kick ripples at this cell: the phase each one has advanced it
          // (a smoothstep as the wavefront passes, relaxing over seconds) and
          // the flare while the front is on it.
          let adv = 0, flare = 0;
          for (const r of s.ripples) {
            const age = t - r.t0;
            const d = Math.hypot(x - r.x, y - r.y) + outer * 0.5;
            const front = RIPPLE_V * age - d;
            adv += 0.25 * r.amp * smooth(-RIPPLE_W, RIPPLE_W, front) * Math.exp(-age / RIPPLE_KEEP);
            const f = front / RIPPLE_W;
            flare += r.amp * Math.exp(-f * f) * Math.exp(-age / 1.5);
          }
          flare = Math.min(1, flare);

          // Raph's Z0 and Z1: a diagonal wave of phase across rows and columns.
          // A full draw-and-erase takes two cycles, so at the default spread
          // the visible sheet spans about one whole period: some cells are
          // always drawing while others erase, and the frame never empties at
          // once (V1's lockstep read as a dropout at the back of the room).
          const cellPhase = s.phase + adv + spread * (0.42 * c + 0.3 * j);

          // Raph's (i * 141 + j) % 4 cell colouring, with the first ink on
          // two of the four slots so it stays the dominant one.
          const slot = (((c * 141 + j * 7) % 4) + 4) % 4;
          const cellInk = inks[[0, 1, 0, 2][slot] % nInks];

          // Ghost grooves: one path per cell.
          g.strokeStyle = ghost;
          g.lineWidth = 1;
          g.beginPath();
          for (let k = 0; k < nR; k++) {
            const rad = outer - k * gap;
            if (rad < gap * 0.3) break;
            g.moveTo(x + rad, y);
            g.arc(x, y, rad, 0, TAU);
          }
          g.stroke();

          for (let k = 0; k < nR; k++) {
            const rad = outer - k * gap;
            if (rad < gap * 0.3) break;
            // The innermost ring fades in as Arcs per cell glides up.
            const fade = k === nR - 1 ? clamp(ringsF - (nR - 1), 0, 1) : 1;
            // Raph's X1: each ring runs behind the one outside it.
            const u = cellPhase - spread * 0.5 * k / Math.max(ringsF, 1);
            const cyc = Math.floor(u);
            const f = u - cyc;
            // Draw from twelve o'clock on even cycles, erase on odd ones.
            let a0, a1;
            if ((cyc & 1) === 0) { a0 = 0; a1 = f * TAU; } else { a0 = f * TAU; a1 = TAU; }
            if (a1 - a0 < 1e-3) continue;
            const ccw = counter === 1 && (k & 1) === 1;
            const top = -Math.PI / 2;
            const s0 = ccw ? top - a1 : top + a0;
            const s1 = ccw ? top - a0 : top + a1;
            const fl = k === 0 ? flare : flare * 0.35;
            let col = perArc ? inks[k % nInks] : cellInk;
            if (k === 0 && flare > 0.3) col = cellInk === accent ? inks[0] : accent;
            const w = wBase * (1 + 1.1 * fl);
            g.globalAlpha = fade;
            g.strokeStyle = col;
            g.lineWidth = w;
            g.beginPath();
            g.arc(x, y, rad, s0, s1);
            g.stroke();
            // Hats: a bead at the moving end of the arc.
            if (hat > 0.08) {
              const am = ccw ? top - f * TAU : top + f * TAU;
              g.fillStyle = col;
              g.beginPath();
              g.arc(x + rad * Math.cos(am), y + rad * Math.sin(am), w * 0.5 * (1 + 1.3 * hat), 0, TAU);
              g.fill();
            }
          }
          g.globalAlpha = 1;
        }
      }
      g.restore();
    },
  });
})();
