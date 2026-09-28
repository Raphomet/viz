// Rings V2 — Raph's 2016 rings of radial dashes (../../viz/rings.js,
// ../../../Rings.pde) given a stage. Notes in harness/v2/rings.md.
//
// V1 drew five rings twenty units apart, so the whole piece was a coin in the
// middle of the frame, and every bass dash in every ring punched on every
// kick. V2 keeps the grammar exactly (a ring is a circle of radial dashes;
// dash i is as long as band i % 9, so every ring is made of the spectrum;
// rings turn at their own speeds from {±1, ±2, ±4}; Partial arcs gathers a
// ring's dashes by 1 / |speed|; Missing rings), and changes two things:
//
// - The rings sit on an exponential radius with a constant number of dashes
//   each, so they run from a pin-prick at the centre to past the corners like
//   a tunnel seen head-on, and they travel outward (Raph's "ring zoom" note).
// - Each ring reads the music at a delay that grows with its depth, so the
//   centre is struck like a speaker cone and the sound rolls outward through
//   the rings. A kick is therefore one ring of long spokes (struck in the
//   accent ink) travelling to the corners, not the whole frame jumping.
(function () {
  const SPEEDS = [1, -1, 2, -2, 4, -4];   // Rings.pde randomizeRingSettings
  const R0 = 1.2;                          // radius at depth 0, virtual units
  const DZ = Math.log(1.11);               // depth between neighbouring rings
  const TRAVEL = 0.75;                     // depth units/s at Travel 1
  const WAVE = 1.3;                        // seconds for the music to reach the corners
  const HIST = 256;                        // frames of band history (> WAVE at 60 fps)
  const CH = 9;                            // the nine bands

  // Two-ink print sets. `blend` is how the second ink overprints: multiply on
  // paper, screen on a dark ground, so overlaps behave like real ink or light.
  const PALETTES = [
    { name: 'Newsprint', ground: '#ECE6D6', ink: '#18181B', ink2: '#2A5BC4', accent: '#E0432B', blend: 'multiply' },
    { name: 'Riso', ground: '#F3EFE4', ink: '#1F3F9C', ink2: '#FF4F8B', accent: '#F26A1B', blend: 'multiply' },
    { name: 'Oxide', ground: '#E6DAC2', ink: '#4A1D1B', ink2: '#B98A2C', accent: '#1F4470', blend: 'multiply' },
    { name: 'Night', ground: '#0F1013', ink: '#E7E0CE', ink2: '#3F79C2', accent: '#F09A36', blend: 'screen' },
  ];

  const PRESETS = {
    calm: { travel: 0.22, spin: 0.35, dash: 0.8, gather: 0, ink2: 0, dissolve: 0.3 },
    drop: { travel: 0.9, spin: 1.0, dash: 1.2, gather: 0.7, ink2: 1, dissolve: 0 },
    // Riley: the full field, still, in two inks — for staring into.
    riley: { travel: 0.12, spin: 0.15, dash: 1.1, gather: 0, ink2: 1, dissolve: 0, follow: 0 },
    night: { colorPalette: 3, travel: 0.22, spin: 0.35, dash: 0.8, gather: 0, ink2: 0, dissolve: 0.3 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['travel', 'spin', 'dash', 'gather', 'ink2', 'dissolve'];

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Integer hash to 0–1; per ring and per dash, so rings keep their character
  // (speed, phase, band offset, whether they are missing) for their whole life.
  function hash(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  VIZ.register({
    id: 'ringsv2',
    name: 'Rings',
    versionOf: 'rings',
    version: 'V2',
    order: 729,

    params: [
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Inks', type: 'select',
        options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'travel', label: 'Travel', type: 'range', min: 0, max: 2, default: PRESETS.calm.travel, step: 0.01 },
      // V1's SPEED: how fast the rings turn, each at its own ±1, ±½, ±¼.
      { key: 'spin', legacy: 'SPEED', label: 'Spin', type: 'range', min: 0, max: 3, default: PRESETS.calm.spin, step: 0.01 },
      // V1's SIZE1, the reaction strength: how far the bands push the dashes.
      { key: 'dash', legacy: 'SIZE1', label: 'Dash length', type: 'range', min: 0.2, max: 2, default: PRESETS.calm.dash, step: 0.01 },
      // V1's Partial arcs mode as a continuous morph, so the drop can gather
      // the rings into half and quarter arcs instead of snapping to them.
      { key: 'gather', legacy: 'MODE 2', label: 'Rings to arcs', type: 'range', min: 0, max: 1, default: PRESETS.calm.gather, step: 0.01 },
      { key: 'ink2', label: 'Second ink', type: 'range', min: 0, max: 1, default: PRESETS.calm.ink2, step: 0.01 },
      // V1's Missing rings, generalised: drops dashes, and whole rings.
      { key: 'dissolve', legacy: 'MODE 3', label: 'Dissolve', type: 'range', min: 0, max: 0.9, default: PRESETS.calm.dissolve, step: 0.01 },
      // V1's X0: angular spacing between dashes, higher is sparser.
      { key: 'x0', legacy: 'X0', label: 'Dash spacing', type: 'range', min: 0.5, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      // V1's Reshuffle: new speeds, phases and missing rings for every ring.
      { id: 'reshuffle', label: 'Reshuffle rings', run() { this.salt = (this.salt + 7919) | 0; } },
    ],

    gallery: {
      title: 'Rings V2',
      technique: 'Canvas 2D: rings of radial dashes on an exponential radius (constant dash count, so the field reads as a head-on tunnel), born at the centre and travelling outward; a 256-frame history of the nine bands read by each ring at a delay proportional to its depth, so onsets travel outward as rings; one stroked path per ring per ink, the second ink drawn off-register with multiply or screen compositing; onset detection against slow baselines; a section follower easing between calm and drop presets',
      brief: 'Raph\'s 2016 rings of band-driven dashes, printed in black on newsprint and running past every edge of the stage like a record groove seen as a tunnel. The rings are born as a pin-prick at the centre and travel outward, each turning at its own speed and direction, so the dash pattern shears into slow op-art rosettes. The music strikes the centre and rolls outward through the rings in under a second: every dash is still as long as its band, so each kick leaves the centre as one ring of long spokes, struck in vermilion, and travels to the corners while the rest of the field keeps its calm; each clap leaves as a ring gathered into crescents in the second ink; the hats flicker their own dashes. The breakdown is sparse, one ink, slow, a third of the dashes dissolved. The drop fills every dash in, speeds the travel and the spin, gathers two rings in three into half and quarter arcs (V1\'s Partial arcs mode) and brings in a blue second ink printed off-register, so the two systems overprint and shimmer like a Riley.',
      lineage: [
        'V1: Rings (web/viz/rings.js), a port of Raph\'s Rings.pde (2016): concentric rings of radial dashes, dash length from signals[i % 9], speeds ±1/±2/±4, modes Together, Own speeds, Partial arcs, Missing rings.',
        'Six-judge panel (2026-09-28): bottom twelve, mean 2.17. Scope chosen: restaging, keeping the whole grammar.',
        'All six judges (a coin in the middle of a black field): rings on an exponential radius run past the corners at every aspect ratio.',
        'Designer (record grooves, two inks offset like Riley): black on newsprint, and the drop adds a second ink printed off-register and multiplied.',
        'Floor (the kick sends a ring out to the edges), reinterpreted: every ring reads the music at a delay that grows with depth, so the kick is a ring of spokes, struck in the accent ink, that travels out.',
        'Director (a target that jitters on the drop; breakdown dissolves dot by dot): the kick reaches each ring only as the wave passes; a Dissolve control drops dashes and whole rings in the calm look.',
        'Raph\'s own notes in Rings.pde: "different circles rotate at different rates, including opposite directions" (the default), "ring zoom" (the rings travel), "color palettes" / "black white" (two-ink print sets); Partial arcs became the continuous Rings to arcs control the drop turns up.',
        'Presets: calm, drop, riley (still, two inks), night (bone on black).',
        'Rejected: a haze plane (glow by the back door), off-centre interfering ripples (Koi and Interference own them), folding into a shared "Line" scene (the brief is to give the sketch its own stage).',
      ],
    },

    salt: 0,

    enter() {
      this.lastT = null;
      this.hist = null;
    },

    init() {
      this.hist = new Float32Array(HIST * CH);
      this.head = 0;
      this.depth = 0;        // accumulated travel, in rings
      this.angle = 0;        // accumulated spin, radians at speed 1
      this.dtAvg = 1 / 60;
      this.reg = 0;          // register-error direction for the second ink
      this.waves = [];      // kick and clap onsets travelling outward
      this.env = { kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0,
        low: 0, bass: 0, dropOn: false, auto: 0 };
    },

    listen(signals, dt, t) {
      const e = this.env;
      // Kick: fast minus slow envelope on band 0, with a refractory gap so a
      // kick's own decay never fires twice.
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        // Stamped a few frames back: the fast envelope lags the band's own
        // attack, and the spokes travelling with it should wear the accent.
        this.waves.push({ t: t - 0.03, kind: 0, amp: clamp((e.kf - e.ks) * 3, 0.6, 1) });
        e.kWait = 0.2;
      }
      // Clap: the same on the clap bands; the breakdown's sustained pad in
      // those bands never outruns its own slow baseline, so it never fires.
      const c = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, c, 30, dt);
      e.cs = ease(e.cs, c, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        this.waves.push({ t: t - 0.03, kind: 1, amp: 1 });
        e.cWait = 0.6;
      }
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 2, dt);
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;

      this.head = (this.head + 1) % HIST;
      const o = this.head * CH;
      for (let b = 0; b < 9; b++) this.hist[o + b] = signals[b] / 100;
      while (this.waves.length && t - this.waves[0].t > WAVE + 0.3) this.waves.shift();
    },

    // The history row as it was `sec` seconds ago.
    past(sec) {
      const back = Math.min(HIST - 1, Math.round(sec / this.dtAvg));
      return ((this.head - back) % HIST + HIST) % HIST * CH;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.hist) this.init();
      if (dt > 0) this.dtAvg = ease(this.dtAvg, dt, 4, dt);

      const e = this.env;
      this.listen(signals, dt, t);
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.6, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // The bass swell pushes the travel, so the tunnel breathes with the
      // bass line rather than lurching on the kick.
      this.depth += (TRAVEL * P.travel * (1 + 0.8 * e.bass)) * dt / DZ;
      this.angle += P.spin * 0.9 * dt;
      this.reg += dt * 0.07;

      const pal = PALETTES[Math.round(params.colorPalette)] || PALETTES[0];
      const inkC = rgb(pal.ink), ink2C = rgb(pal.ink2);
      const N = Math.max(27, Math.round(14 / params.x0) * 9);
      const cell = (2 * Math.PI) / N;
      const Rmax = Math.sqrt(W * W + H * H) / 2 + 40;
      const zMax = Math.log(Rmax / R0);
      const dMax = zMax / DZ;
      const whole = Math.floor(this.depth);
      const frac = this.depth - whole;
      const salt = this.salt | 0;

      p.colorMode(p.RGB, 255);
      p.background(pal.ground);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'butt';
      g.translate(W / 2, H / 2);

      // Build every ring once: geometry is shared by both inks.
      const rings = this.ringBuf || (this.ringBuf = []);
      rings.length = 0;
      for (let m = 0; m <= dMax + 1; m++) {
        const z = (m + frac) * DZ;
        const r = R0 * Math.exp(z);
        if (r < 2.5 || r > Rmax + 30) continue;
        const id = m - whole;
        const h1 = hash(id, 11 + salt), h2 = hash(id, 23 + salt), h3 = hash(id, 37 + salt), h4 = hash(id, 41 + salt);
        // Whole missing rings: V1's mode 3, at half the dissolve rate.
        if (h4 < P.dissolve * 0.45) continue;
        const s = SPEEDS[Math.floor(h1 * 6)];
        const row = this.past(WAVE * z / zMax);
        // Each onset is a front moving out at the same rate as the delayed
        // bands; only the ring (or two) it is passing wears it, so a kick is
        // one ring, not a band of them.
        let kick = 0, clap = 0;
        for (const w of this.waves) {
          const zf = (t - w.t) / WAVE * zMax;
          const u = (z - zf) / (0.9 * DZ);
          if (u > 3 || u < -3) continue;
          const v = w.amp * Math.exp(-u * u) * (1 - 0.4 * clamp(zf / zMax, 0, 1));
          if (w.kind === 0) kick = Math.max(kick, v); else clap = Math.max(clap, v);
        }
        rings.push({
          id, r, s, row, kick, clap,
          rot: h2 * 2 * Math.PI + this.angle / s,
          off: Math.floor(h3 * 9),
          // The clap's ring gathers to a quarter arc whatever its own speed.
          fac: (1 - Math.max(P.gather, clap)) + Math.max(P.gather, clap) /
            (clap > P.gather ? 4 : Math.abs(s)),
          fade: clamp((r - 2.5) / 30, 0, 1),
        });
      }

      const hist = this.hist;
      // mode 0: the ink plate (kick rings left out); 1: the second ink;
      // 2: the kick rings alone in the accent, printed last and on top so
      // they stay clean vermilion instead of muddying under the overprint.
      const pass = (mode) => {
        for (const q of rings) {
          const struck = q.kick > 0.3;
          if (mode === 2 ? !struck : (mode === 0 && struck)) continue;
          const { r, row } = q;
          const kickRing = mode === 2 ? q.kick : 0;
          g.lineWidth = Math.max(0.35, r * cell * 0.46) * (1 + 0.8 * kickRing);
          g.globalAlpha = q.fade * (mode === 1 ? P.ink2 : 1) * (mode === 2 ? clamp(q.kick * 3, 0, 1) : 1);
          if (mode === 1) g.strokeStyle = pal.ink2;
          else if (mode === 2) g.strokeStyle = pal.accent;
          else if (q.clap > 0.05) g.strokeStyle = mix(inkC, ink2C, clamp(q.clap * 1.5, 0, 1));
          else g.strokeStyle = pal.ink;
          const base = r * 0.018;
          const span = r * 0.11 * P.dash;
          const kickLen = r * 0.06 * kickRing;
          // The struck ring opens back to a full circle, so in the drop's field
          // of arcs the kick is the one whole ring rolling outward.
          const fac = q.fac + (1 - q.fac) * clamp(q.kick * 2, 0, 1);
          g.beginPath();
          for (let i = 0; i < N; i++) {
            if (P.dissolve > 0 && hash(q.id * 977 + i, 5 + salt) < P.dissolve) continue;
            const sig = hist[row + ((i + q.off) % 9)];
            const len = base + span * sig + kickLen;
            const a = q.rot + i * cell * fac;
            const c = Math.cos(a), sn = Math.sin(a);
            const r0 = r - len / 2, r1 = r + len / 2;
            g.moveTo(c * r0, sn * r0);
            g.lineTo(c * r1, sn * r1);
          }
          g.stroke();
        }
      };

      pass(0);
      if (P.ink2 > 0.01) {
        // The second ink is the same plate printed a few units off-register
        // and a hair off-angle, so the two systems overprint and shimmer
        // instead of doubling cleanly. The bass line widens the error.
        g.save();
        g.globalCompositeOperation = pal.blend;
        const d = 4 + 7 * e.bass;
        g.translate(Math.cos(this.reg) * d, Math.sin(this.reg) * d);
        g.rotate(0.012);
        pass(1);
        g.restore();
      }
      pass(2);
      g.restore();
    },
  });
})();
