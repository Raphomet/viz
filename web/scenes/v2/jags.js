// Jags V2 — Raph's 2016 zigzag lines (../../viz/jags.js, ../../../Jags.pde)
// turned into a record of the track. Notes in harness/v2/jags.md.
//
// V1 drew ten zigzag lines whose height all followed one band at the same
// moment, which the panel read as an EQ in disguise. V2 keeps the zigzag, the
// band-driven height, the rotating stage and the ColorLisa palettes, and
// changes one thing: each row reads the music once, when it is cut at a seam
// across the middle of the stage, and keeps it. Rows then travel outward on
// both sides, so the frame is the last few seconds of the track laid out as a
// shape: flat two-ink stripes from the breakdown, tall jagged bands from the
// drop, one taller row with a thread of accent colour per kick.
//
// Each row is a band of one ink filled from its zigzag outward and painted
// outer-over-inner with a hard shadow toward the seam, like strips of cut
// paper; where two rows cross, the band between them pinches out, which is
// what gives the flame-stitch look without drawing it.
(function () {
  const shared = window.VIZ_PALETTES || [];

  const SEGMENT = 40;       // the original segmentLength: half a tooth
  const SPACING = 12;       // row spacing at the seam, virtual units
  const FLOW = 42;          // units/s at the seam at Flow 1
  // Rows speed up and widen as they travel: d/GROW is Raph's commented-out
  // `yoff *= (1 + 0.2 * l)` made continuous, so the fabric opens outward
  // instead of sliding off the stage at one pace.
  const GROW = 420;
  const SUB = 8;            // samples per tooth period, aligned so tips land on samples

  const PRESETS = {
    calm: { flow: 0.55, height: 0.7, sharp: 0.2, inks: 2 },
    drop: { flow: 1.5, height: 1.35, sharp: 1, inks: 4 },
    // V1's own reading: lines on the ground, no fills, the record in the
    // heights and weights. The quietest look, for the end of the night.
    ruled: { style: 1, flow: 0.45, height: 0.9, sharp: 1, inks: 4 },
    // The Floor judge's "go dark", as a look rather than the default: the
    // plum, slate and sea-green ColorLisa row, which keeps its cream for the
    // drop's brightest band only.
    night: { colorPalette: 20, flow: 0.55, height: 0.7, sharp: 0.2, inks: 2 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['flow', 'height', 'sharp', 'inks'];

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
  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  VIZ.register({
    id: 'jagsv2',
    name: 'Jags',
    versionOf: 'jags',
    version: 'V2',
    order: 726,

    params: [
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() })),
        default: 0 },
      { key: 'style', label: 'Style', type: 'select', options: ['Cut paper', 'Ruled lines'], default: 0 },
      { key: 'flow', label: 'Flow', type: 'range', min: 0, max: 2.5, default: PRESETS.calm.flow, step: 0.01 },
      { key: 'height', label: 'Jag height', type: 'range', min: 0, max: 2, default: PRESETS.calm.height, step: 0.01 },
      { key: 'sharp', label: 'Sines to jags', type: 'range', min: 0, max: 1, default: PRESETS.calm.sharp, step: 0.01 },
      { key: 'inks', label: 'Inks', type: 'range', min: 2, max: 4, default: PRESETS.calm.inks, step: 1 },
      // The original's SPEED, in its units (radians per 1000 frames).
      { key: 'speed', legacy: 'SPEED', label: 'Rotation speed', type: 'range',
        min: -10, max: 10, default: 0.3, step: 0.01 },
      // The original hard-coded signals[5]; the bass line reads better as a
      // record (near-silent outside the drop), so it is the default here.
      { key: 'heightBand', legacy: 'signals[5]', label: 'Zigzag height band', type: 'band', default: 1 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      {
        id: 'shuffle',
        label: 'Shuffle palette',
        // The original's shuffleCurrentColors, ground included. New rows take
        // the shuffled inks at the seam, so the change travels outward.
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
      title: 'Jags V2',
      technique: 'Canvas 2D: a ring of rows, each a zigzag polyline (sine-to-triangle morph, sampled so the tips land on vertices) recording the height band, ink, phase and kick at the moment it is cut at a central seam; rows advance outward with distance-proportional speed and height, mirrored about the seam on a slowly rotating stage, filled outer-over-inner with a hard offset shadow; onset detection against slow baselines; a section follower easing between calm and drop presets',
      brief: 'Raph\'s 2016 zigzag lines as a record of the track, in flat daylight inks. A seam runs through the middle of the slowly turning stage, and every fraction of a second it cuts a new row on both sides: a zigzag whose height is the band at that instant, a band of one ink filled outward from it and laid over the row inside it with a hard paper shadow. Rows travel outward, widening and speeding up as they go, so the whole frame is the last few seconds of music laid out as a flame-stitch chart: quiet passages are low sine stripes in two inks, the drop arrives in the middle as tall, sharp, four-ink jags and spreads to the edges, and the breakdown\'s flat rows follow it out. Each kick cuts one taller row with a thread of the palette\'s most saturated colour, the only place that colour appears, so the beat streams outward as a rhythm of red threads; each clap cuts a row twice as wide in the ink furthest round the sequence, so the backbeat leaves broad stripes between the threads; the build\'s rising hats sharpen the rows cut while they play, so the sines turn to points before the drop lands. Ruled lines mode is the V1 reading: the same record as lines on the ground.',
      lineage: [
        'V1: Jags (web/viz/jags.js), a port of Raph\'s Jags.pde (2016): parallel zigzags on a rotating stage, height from signals[5], weight from a band, 23 ColorLisa palettes.',
        'Six-judge panel (2026-09-28): 66th of 72, mean 3.0. Scope chosen: reconception of the rule, keeping the zigzag, band height, rotation and palettes.',
        'Director ("an EQ in disguise", no arc): each row keeps the band value it was cut with, so the frame shows the section shape instead of the level.',
        'Designer ("a palette looking for a composition") and Purist ("needs density"): rows fill the stage edge to edge, mirrored about a seam, forty-odd per side.',
        'Floor and Psychonaut (thin lines on a bright ground, nothing to follow): filled ink bands, cream reduced to one ink of several, continuous outward flow that widens as it goes.',
        'Floor (kick as one spike along one line, not all lines thickening), reinterpreted: one taller row with an accent thread per kick, confined to the seam and travelling outward.',
        'Floor (parallax layers), reinterpreted as real stacking: each strip casts a hard shadow on the one inside it.',
        'Curator (Agnes Martin in waiting; "Line"): Ruled lines mode keeps V1\'s lines on the ground with the same record.',
        'Raph\'s own sketch: the commented-out `yoff *= (1 + 0.2 * l)` became rows widening with distance, and `// TODO: modes: jags, sines` became the Sines to jags control the drop sharpens.',
        'Built, then revised: the clap first shifted the next rows half a tooth out of phase (a herringbone break), but with teeth three times the row spacing the rows crossed everywhere and the drop turned to shattered cells; the clap now cuts a double-width row in a far ink. Kick height bump cut from 16 to 5 units for the same reason, and kick threads moved above every strip, since under the next strip they were cut to slivers.',
        'Hats sharpen the rows cut while they play (TASTE: hats as detail), so the build visibly turns sines to points.',
        'Presets: calm, drop, ruled (Ruled lines), night (palette 21, the Floor judge\'s dark room).',
        'Rejected: dark ground as default (the flat daylight inks are the piece\'s strength), a selvedge label (decoration), Moiré Weave (that is Interference\'s territory).',
      ],
    },

    setup(p) {
      // Own copies so shuffling never reorders another visual's palette.
      this.palettes = shared.map((pal) => pal.colors.slice());
    },

    enter() {
      this.rows = null;
      this.lastT = null;
    },

    init(R) {
      this.rows = [];          // newest first
      this.travel = 0;         // seam travel since the last cut
      this.rot = 0;
      this.phase = 0;          // cycles; drifts slowly, so the chevrons lean
      this.seq = 0;            // ink sequence counter
      this.env = { band: 0, hat: 0, kf: 0, ks: 0, cf: 0, cs: 0, kWait: 0, cWait: 0,
        low: 0, dropOn: false, auto: 0 };
      this.pendKick = 0;
      this.clap = 0;
      this.gap = SPACING;
      // Fill the stage with a quiet record so the first frame is not empty:
      // run the calm flow until the oldest row has reached the corners.
      const P = Object.assign({}, PRESETS.calm);
      let guard = 0;
      while ((this.rows.length === 0 || this.rows[this.rows.length - 1].d < R + 60) && guard++ < 4000) {
        this.advance(1 / 30, P, R, 0.12 + 0.1 * Math.sin(guard * 0.05), 0.4);
      }
    },

    // Inks for a palette: the most saturated colour is the accent (kick
    // threads only); the rest, deduplicated, are the band inks, ground first.
    inksOf(pal) {
      let accent = pal[1];
      for (let i = 1; i < pal.length; i++) if (chroma(pal[i]) > chroma(accent)) accent = pal[i];
      const inks = [];
      for (const c of pal) {
        if (c.toLowerCase() === accent.toLowerCase()) continue;
        if (inks.some((k) => k.toLowerCase() === c.toLowerCase())) continue;
        inks.push(c);
      }
      if (inks.length < 2) inks.push(accent);
      return { ground: pal[0], accent, inks };
    },

    // Advance the flow by dt and cut rows at the seam. band is 0–1.
    advance(dt, P, R, band, weight) {
      const v0 = FLOW * P.flow;
      for (const r of this.rows) r.d += v0 * (1 + r.d / GROW) * dt;
      while (this.rows.length && this.rows[this.rows.length - 1].d > R + 140) this.rows.pop();

      this.travel += v0 * dt;
      const cut = () => {
        const n = Math.min(Math.round(clamp(P.inks, 2, 4)), this.nInks || 4);
        // Ping-pong through the inks: ground, a, b, a, ground, ... so the
        // bands shade like bargello instead of cycling hard.
        const period = Math.max(2, 2 * n - 2);
        // A clap jumps the sequence half-way round, so its row is cut in the
        // ink furthest from the one before it, and is twice as wide.
        if (this.clap) this.seq += Math.floor(period / 2);
        const s = this.seq++ % period;
        const idx = s < n ? s : period - s;
        const k = this.pendKick;
        this.pendKick = 0;
        this.gap = this.clap ? 2 * SPACING : SPACING;
        this.clap = 0;
        this.rows.unshift({
          d: Math.min(this.travel, SPACING),
          amp: P.height * (3 + 30 * band) + P.height * 5 * k,
          // Hats sharpen the rows cut while they play, so the build's rising
          // hats turn the sines to points before the drop arrives.
          sharp: P.sharp + (1 - P.sharp) * clamp(this.env.hat * 1.6, 0, 0.85),
          phase: this.phase,
          ink: idx,
          w: 1 + 3 * weight,
          kick: k,
        });
      };
      if (this.pendKick || this.clap) {
        // A kick or clap cuts its row now, so it lands on the beat. If a row
        // was only just cut, a kick marks that row instead of crowding a
        // second one in beside it; a clap waits the few frames until there
        // is room.
        const newest = this.rows[0];
        if (newest && newest.d < SPACING * 0.4) {
          if (this.pendKick) {
            newest.kick = Math.max(newest.kick, this.pendKick);
            newest.amp += P.height * 5 * this.pendKick;
            this.pendKick = 0;
          }
        } else {
          cut();
          this.travel = 0;
        }
      }
      while (this.travel >= (this.gap || SPACING)) {
        this.travel -= this.gap || SPACING;
        cut();
      }
    },

    listen(signals, dt, heightBand) {
      const e = this.env;
      e.band = ease(e.band, signals[heightBand] / 100, 9, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 1.5, dt);
      const kick = signals[0] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      e.ks = ease(e.ks, kick, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      let kickNow = false;
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        kickNow = true;
        this.pendKick = clamp((e.kf - e.ks) * 3, 0.4, 1);
        e.kWait = 0.2;
      }
      // Clap: fast minus slow on the clap bands, so the breakdown's sustained
      // pad in the same bands never fires it; a refractory gap keeps a snare
      // roll to one break instead of a shiver.
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        this.clap = 1;
        e.cWait = 0.6;
      }
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return kickNow;
    },

    // One row's edge as a flat array of [x, y] in row space (y outward from
    // the seam is positive), sampled so the tooth tips land on vertices.
    edge(r, L, out) {
      const per = 2 * SEGMENT;
      const g = 1 + r.d / GROW;
      const A = r.amp * g * Math.min(1, 0.3 + r.d / (SPACING * 2));
      const step = r.sharp > 0.985 ? SUB / 2 : 1;       // jags need only the tips
      const j0 = Math.floor((-L / per + r.phase) * SUB) - 1;
      const j1 = Math.ceil((L / per + r.phase) * SUB) + 1;
      let n = 0;
      for (let j = j0 - ((j0 % step) + step) % step; j <= j1; j += step) {
        const u = j / SUB;
        const f = u - Math.floor(u);
        const tri = 1 - 4 * Math.abs(f - 0.5);
        const sine = -Math.cos(2 * Math.PI * u);
        const z = sine + (tri - sine) * r.sharp;
        out[n++] = (u - r.phase) * per;
        out[n++] = r.d - z * A;
      }
      return n;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const R = Math.sqrt(W * W + H * H) / 2;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.rows) this.init(R);
      if (!this.buf) this.buf = new Float32Array(4096);

      const e = this.env;
      this.listen(signals, dt, Math.round(params.heightBand));
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.8 : 0.6, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      this.phase += 0.015 * dt * (0.5 + P.flow);
      this.advance(dt, P, R, e.band, e.band);
      this.rot += (params.speed / 1000) * 60 * dt;

      const pal = this.palettes[Math.round(params.colorPalette)] || this.palettes[0];
      const { ground, accent, inks } = this.inksOf(pal);
      this.nInks = inks.length;
      const ruled = Math.round(params.style) === 1;

      p.colorMode(p.RGB, 255);
      p.background(ground);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineJoin = 'miter';
      g.miterLimit = 6;
      g.lineCap = 'round';
      g.translate(W / 2, H / 2);
      g.rotate(this.rot);

      const L = R + 2 * SEGMENT;
      const buf = this.buf;
      // Shadow darkness follows the ground, so light palettes get a soft
      // grey and dark palettes still show a step.
      const shade = luma(ground) > 90 ? 'rgba(40,28,16,0.30)' : 'rgba(0,0,0,0.45)';
      const rows = this.rows;
      const threadInks = inks.filter((c) => c !== ground);
      if (!threadInks.length) threadInks.push(accent);

      // Newest (innermost) first, so each outer row lies on the one inside it.
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const n = this.edge(r, L, buf);
        const g1 = 1 + r.d / GROW;
        const depth = 2 * SPACING * g1 + 3 * r.amp * g1 + 16;
        for (let side = -1; side <= 1; side += 2) {
          g.beginPath();
          g.moveTo(buf[0], side * buf[1]);
          for (let k = 2; k < n; k += 2) g.lineTo(buf[k], side * buf[k + 1]);
          if (!ruled) {
            // Close the band outward, then paint the shadow a few units
            // toward the seam and the ink over it.
            g.lineTo(buf[n - 2], side * (r.d + depth));
            g.lineTo(buf[0], side * (r.d + depth));
            g.closePath();
            g.save();
            g.translate(0, -side * 2.4);
            g.fillStyle = shade;
            g.fill();
            g.restore();
            g.fillStyle = inks[Math.min(r.ink, inks.length - 1)];
            g.fill();
          } else {
            g.strokeStyle = threadInks[r.ink % threadInks.length];
            g.lineWidth = r.w * g1;
            g.stroke();
          }
        }
      }
      // Kick threads go on last, over every strip: under the next strip they
      // were cut to slivers wherever the teeth are steep and the band thin.
      g.strokeStyle = accent;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!(r.kick > 0)) continue;
        const n = this.edge(r, L, buf);
        g.lineWidth = (0.9 + 1.5 * r.kick) * (1 + r.d / GROW);
        for (let side = -1; side <= 1; side += 2) {
          g.beginPath();
          g.moveTo(buf[0], side * buf[1]);
          for (let k = 2; k < n; k += 2) g.lineTo(buf[k], side * buf[k + 1]);
          g.stroke();
        }
      }
      g.restore();
    },
  });
})();
