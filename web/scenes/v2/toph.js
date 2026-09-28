// Twinkle Toph V2 — the 2016 portrait as a constellation.
//
// V1 (web/viz/toph.js) re-draws a 100×117 photo as one dot per pixel on a
// white page. The panel found it static and a floodlight. V2 keeps the photo
// and the one-mark-per-pixel rule, but every figure pixel becomes a star with
// two places to be: its home in the portrait, and an orbit in a slowly
// turning galaxy. `face` moves stars home in order (the Aladdin Sane bolt
// first), so the music can assemble him out of the sky and scatter him back.
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  const PRESETS = {
    calm: { face: 0.2, spin: 0.45, halo: 0.4, twinkle: 0.55, bolt: 0.8, meteors: 0.15 },
    drop: { face: 1, spin: 1.5, halo: 1, twinkle: 1, bolt: 1.3, meteors: 1 },
    paper: { ink: 2, face: 1, spin: 0.6, halo: 0.55, twinkle: 0.7, bolt: 1, meteors: 0.4 },
  };
  // The params Follow the track moves between the calm knobs and the drop look.
  const DRIVE = ['face', 'spin', 'halo', 'twinkle', 'bolt', 'meteors'];

  // Sky inks. `pos` true: star size follows brightness (a positive image on a
  // dark ground). Paper flips it to V1's reading, size by darkness.
  const INKS = [
    { name: 'Night', ground: [7, 8, 18], centre: [22, 27, 54], dim: [84, 98, 146],
      bright: [246, 234, 205], red: [255, 74, 52], hot: [255, 196, 140], pos: true },
    { name: 'Blue hour', ground: [17, 24, 52], centre: [44, 58, 104], dim: [110, 128, 180],
      bright: [255, 242, 214], red: [255, 92, 64], hot: [255, 214, 160], pos: true },
    { name: 'Paper', ground: [214, 205, 184], centre: [232, 225, 206], dim: [150, 150, 158],
      bright: [28, 32, 50], red: [204, 52, 40], hot: [120, 20, 16], pos: false },
  ];
  const LEVELS = 5; // brightness buckets per ink

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgb(c, a) {
    const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
    return a === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')'
      : 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
  }
  // Small seeded PRNG so the sky is the same every run, independent of the
  // host's Math.random state.
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

  VIZ.register({
    id: 'tophv2',
    name: 'Twinkle Toph',
    versionOf: 'toph',
    version: 'V2',
    order: 731,

    params: [
      { key: 'face', label: 'Face', type: 'range', min: 0, max: 1, default: PRESETS.calm.face, step: 0.01 },
      { key: 'spin', label: 'Galaxy spin', type: 'range', min: 0, max: 3, default: PRESETS.calm.spin, step: 0.01 },
      { key: 'halo', label: 'Loose stars', type: 'range', min: 0, max: 1, default: PRESETS.calm.halo, step: 0.01 },
      { key: 'twinkle', label: 'Twinkle', type: 'range', min: 0, max: 1.5, default: PRESETS.calm.twinkle, step: 0.01 },
      { key: 'bolt', label: 'Lightning', type: 'range', min: 0, max: 2, default: PRESETS.calm.bolt, step: 0.01 },
      { key: 'meteors', label: 'Shooting stars', type: 'range', min: 0, max: 1, default: PRESETS.calm.meteors, step: 0.01 },
      { key: 'ink', label: 'Sky', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      // The original's X0 "channel" knob, now the band that strikes the bolt.
      { key: 'x0', legacy: 'X0', label: 'Bolt band', type: 'band', default: 0 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Twinkle Toph V2',
      technique: 'Canvas 2D: the 100×117 photo masked by a flood fill from its border, each remaining pixel a star with a home in the portrait and an orbit in a differentially rotating galaxy; a per-star gather threshold ordered from the bolt outward, travel on a curl; stars batched into one path per ink bucket; onset detection for kick and clap, a section follower easing between calm and drop presets',
      brief: 'Raph\'s 2016 portrait of Toph as Aladdin Sane, turned into a constellation. On a deep night ground a galaxy of stars turns slowly around the frame; in quiet passages only the red lightning bolt hangs in it, a constellation of its own. As the build\'s hats rise the stars spiral home around the bolt and the face assembles out of the sky; the drop holds him whole, warm starlight fading to cool blue with the braces and tie in vermilion, the loose stars around him spinning faster, and shooting stars crossing on the claps. Every kick strikes the bolt (its stars swell and heat) and nothing else, so the beat is plain but confined. The hats are the twinkle, smooth per-star shimmer and a few four-point glints. The breakdown lets him come apart into stars again, and in long calm stretches the face surfaces for a few seconds and sinks. Paper is V1\'s reading on warm paper, with the same motion.',
      lineage: [
        'V1: Twinkle Toph (web/viz/toph.js), a port of Raph\'s TwinkleToph.pde (2016): a friend\'s photo re-drawn one dot per pixel on white, six modes (random twinkle every tenth frame, band halftones, hatching).',
        'Six-judge panel (2026-09-28): bottom twelve of 72, mean 2.0. Scope chosen: reconception of the motion and ground, keeping the photo, one mark per pixel, the framing and the title.',
        'Floor and Psychonaut (a white field is a floodlight): a night ground by default; Paper keeps V1\'s print reading on warm paper, not white.',
        'Floor (invert, pale dots, one warm ink), reinterpreted: stars sized by brightness so it is a positive image, not a negative, with the background cut away and the photo\'s own reds as the only accent.',
        'Director (a crowd with a job: gather in the build, apart on the drop, spring back), reinterpreted: the face assembles for the drop and scatters in the breakdown, so the one picture is whole when the room is looking.',
        'Psychonaut (a face in the stars you catch, not one that catches you): the face surfaces and sinks; in calm only the bolt is home. The eyes in the photo are closed.',
        'Director, Designer, Purist (static, no arc, no system): a galaxy with differential rotation that the face is spun out of and back into.',
        'TASTE vocabulary: kick strikes the bolt only; clap throws a shooting star; hats are the twinkle and glints; bass is the spin.',
        'The title: "twinkle, twinkle, little star" and a Bowie face paint; V2 makes Toph a Starman.',
        'Rejected: Warhol grid (Designer; quarters the one subject), any-image template (Floor; a different product), keep it off the stage (Curator; it is the piece\'s reason to exist), blink on the snare (Director; the eyes are closed).',
      ],
    },

    preload(p) {
      this.img = p.loadImage('assets/toph.jpg');
    },

    setup(p) {
      const img = this.img;
      img.loadPixels();
      const W = img.width, H = img.height;
      const px = img.pixels;
      this.W = W; this.H = H;

      // The photo's ground is a pale, near-neutral, slightly blue grey. Skin
      // highlights are just as light but warmer, so the test needs chroma
      // and blue-over-red, and a flood fill from the border so pale shirt
      // and cheek inside the figure are never cut.
      const isBg = (i) => {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        const l = r * 0.222 + g * 0.707 + b * 0.071;
        return l > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 16 && b >= r - 3;
      };
      const bg = new Uint8Array(W * H);
      const stack = [];
      for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
      for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
      while (stack.length) {
        const i = stack.pop();
        if (bg[i] || !isBg(i)) continue;
        bg[i] = 1;
        const x = i % W, y = (i / W) | 0;
        if (x > 0) stack.push(i - 1);
        if (x < W - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - W);
        if (y < H - 1) stack.push(i + W);
      }

      // Keep only sizeable pieces of the figure: the flood fill leaves a few
      // stray specks of ground on the top row that would hang over his head
      // as a dotted line.
      const comp = new Int32Array(W * H).fill(-1);
      const sizes = [];
      for (let s0 = 0; s0 < W * H; s0++) {
        if (bg[s0] || comp[s0] >= 0) continue;
        const id = sizes.length;
        let size = 0;
        const st = [s0];
        comp[s0] = id;
        while (st.length) {
          const i = st.pop();
          size++;
          const x = i % W, y = (i / W) | 0;
          const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
          for (const j of nb) if (j >= 0 && !bg[j] && comp[j] < 0) { comp[j] = id; st.push(j); }
        }
        sizes.push(size);
      }
      for (let i = 0; i < W * H; i++) if (!bg[i] && sizes[comp[i]] < 40) bg[i] = 1;

      const rand = rng(20160228);
      const list = [];
      let bx = 0, by = 0, bw = 0;
      for (let gy = 0; gy < H; gy++) {
        for (let gx = 0; gx < W; gx++) {
          const i = gy * W + gx;
          if (bg[i]) continue;
          const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
          const lum = (r * 0.222 + g * 0.707 + b * 0.071) / 255;
          const red = clamp((r - Math.max(g, b) - 60) / 90, 0, 1);
          list.push({ gx, gy, lum, red });
          // The bolt: red on the face (above the collar), weighted centre.
          if (red > 0.3 && gy < 70) { bx += gx * red; by += gy * red; bw += red; }
        }
      }
      const boltX = bw ? bx / bw : W / 2, boltY = bw ? by / bw : H * 0.4;
      this.boltX = boltX; this.boltY = boltY;

      const n = list.length;
      this.n = n;
      this.hx = new Float32Array(n);   // home, image units
      this.hy = new Float32Array(n);
      this.lum = new Float32Array(n);
      this.red = new Float32Array(n);
      this.tau = new Float32Array(n);  // gather order, 0 first home
      this.exp = new Float32Array(n);  // how far out its sky orbit is
      this.ang = new Float32Array(n);  // extra angle of its sky orbit
      this.ph = new Float32Array(n);   // twinkle phase
      this.fr = new Float32Array(n);   // twinkle rate
      this.curl = new Float32Array(n); // travel curl direction and size
      const maxD = Math.hypot(W, H);
      for (let k = 0; k < n; k++) {
        const s = list[k];
        // A little jitter off the pixel grid, so the assembled face reads as
        // stars and not as an LED panel.
        this.hx[k] = s.gx + (rand() - 0.5) * 0.7; this.hy[k] = s.gy + (rand() - 0.5) * 0.7;
        this.lum[k] = s.lum; this.red[k] = s.red;
        const d = Math.hypot(s.gx - boltX, (s.gy - boltY) * 1.2) / maxD;
        // Red on the face first (the bolt stands alone in calm), then the
        // face outward; jitter so the edge of the assembled area is ragged
        // like a constellation filling in, not a wipe.
        this.tau[k] = s.red > 0.3 && s.gy < 70 ? rand() * 0.06
          : clamp(0.14 + d * 1.2 + (rand() - 0.5) * 0.3, 0.1, 1);
        this.exp[k] = 1.25 + 2.6 * Math.pow(rand(), 0.7);
        this.ang[k] = (rand() - 0.5) * 2.2;
        this.ph[k] = rand() * TAU;
        this.fr[k] = 0.5 + rand() * 2.2;
        this.curl[k] = (rand() < 0.5 ? -1 : 1) * (0.2 + rand() * 0.25);
      }

      // Loose stars: a galaxy around the face, denser inward.
      const NH = 1800;
      this.nh = NH;
      this.hr = new Float32Array(NH);
      this.ha = new Float32Array(NH);
      this.hs = new Float32Array(NH);
      this.hl = new Float32Array(NH);
      this.hp = new Float32Array(NH);
      for (let k = 0; k < NH; k++) {
        this.hr[k] = 40 + 560 * Math.pow(rand(), 0.8);
        // Two loose arms so the rotation reads as a galaxy, not a disc.
        const arm = rand() < 0.5 ? 0 : Math.PI;
        this.ha[k] = arm + this.hr[k] * 0.009 + (rand() - 0.5) * 1.4;
        this.hs[k] = rand();
        this.hl[k] = 0.25 + 0.75 * Math.pow(rand(), 2);
        this.hp[k] = rand() * TAU;
      }
      // Distant field: fixed and faint, only a slow drift for parallax.
      const ND = 420;
      this.nd = ND;
      this.dx = new Float32Array(ND);
      this.dy = new Float32Array(ND);
      this.dl = new Float32Array(ND);
      for (let k = 0; k < ND; k++) {
        this.dx[k] = rand(); this.dy[k] = rand(); this.dl[k] = 0.2 + 0.8 * Math.pow(rand(), 3);
      }
      this.rand = rand;
      this.reset();
    },

    enter() {
      this.reset();
    },

    reset() {
      this.lastT = null;
      this.rot = 0;       // galaxy phase, advanced by spin (so spin changes speed, never jumps)
      this.drift = 0;
      this.tw = 0;        // twinkle clock
      this.env = { kf: 0, ks: 0, kWait: 0, kick: 0, cf: 0, cs: 0, cWait: 0, hat: 0,
        low: 0, dropOn: false, auto: 0, bass: 0, faceNow: null };
      this.meteors = [];
      this.glints = [];
    },

    listen(signals, dt, band) {
      const e = this.env;
      const kick = signals[band] / 100;
      e.kf = ease(e.kf, kick, 40, dt);
      // The slow side falls fast and rises slowly, so it sits on the trough
      // between kicks: with the drop's sidechained bass in band 0, a plain
      // slow average stayed high and read every other kick as half a kick.
      e.ks = ease(e.ks, kick, kick < e.ks ? 20 : 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      e.kick *= Math.exp(-5 * dt);
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        e.kick = clamp((e.kf - e.ks) * 3, 0.6, 1);
        e.kWait = 0.2;
      }
      // Clap: fast minus slow on the clap bands, so the breakdown's sustained
      // pad in the same bands never fires it.
      const clap = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, clap, 30, dt);
      e.cs = ease(e.cs, clap, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      let clapNow = false;
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        clapNow = true;
        e.cWait = 0.45;
      }
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 2, dt);
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 1.5, dt);
      // Section follower: the sidechained bass line (band 1) is near-silent
      // outside the drop. Hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return clapNow;
    },

    spawnMeteor(W, H) {
      const r = this.rand;
      // Always across the upper sky, away from the face, left or right.
      const dir = r() < 0.5 ? 1 : -1;
      const x = dir > 0 ? r() * W * 0.45 : W - r() * W * 0.45;
      const y = r() * H * 0.35;
      const a = (0.25 + r() * 0.35) * (dir > 0 ? 1 : -1);
      const speed = 700 + r() * 400;
      this.meteors.push({ x, y, vx: Math.cos(a) * speed * dir, vy: Math.abs(Math.sin(a)) * speed,
        life: 0, dur: 0.55 + r() * 0.3, len: 90 + r() * 70 });
    },

    draw(p, signals, params, ctx) {
      const Wc = ctx.width, Hc = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const e = this.env;
      const clapNow = this.listen(signals, dt, (Math.round(params.x0) || 0) % 9);

      const follow = Math.round(params.follow) === 1;
      // The build's rising hats lift the look part way; the drop's bass line
      // takes it all the way.
      // A build is hats that keep going, so integrate them: six seconds of
      // hats bring the face most of the way; silence lets it go again.
      e.build = clamp((e.build || 0) + dt * (e.hat > 0.045 ? 0.14 : -0.25), 0, 0.8);
      const buildLift = e.build;
      const target = follow ? (e.dropOn ? 1 : buildLift) : 0;
      e.auto = ease(e.auto, target, e.dropOn ? 1.6 : 1.0, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * e.auto;
      let face = P.face;
      // In long calm stretches the face surfaces for a few seconds every
      // 32 s and sinks again, so it is caught rather than always there. Only
      // after 20 s of calm, so it never muddles a build.
      e.calmFor = e.auto < 0.15 ? (e.calmFor || 0) + dt : 0;
      if (follow && e.calmFor > 20) {
        const ph = ((e.calmFor - 20) % 32) / 32;
        const surf = ph < 0.3 ? Math.pow(Math.sin((ph / 0.3) * Math.PI), 2) : 0;
        face += (1 - face) * 0.6 * surf;
      }
      // Ease the face itself so a snapshot recall or a section flip gathers
      // over a couple of seconds rather than in a frame.
      e.faceNow = e.faceNow === null ? face : ease(e.faceNow, face, 1.1, dt);
      face = e.faceNow;

      this.rot += dt * 0.12 * P.spin * (0.7 + 1.2 * e.bass);
      this.drift += dt * 0.004 * (0.5 + P.spin);
      this.tw += dt * (1 + 2.5 * e.hat);

      const ink = INKS[Math.round(params.ink)] || INKS[0];
      const c = p.drawingContext;
      p.colorMode(p.RGB, 255);
      c.save();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';

      // Ground: a quiet radial falloff, matte, no glow.
      const cx = Wc / 2, cy = Hc * 0.45;
      const R = Math.hypot(Wc, Hc) / 2;
      const grd = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      grd.addColorStop(0, rgb(ink.centre));
      grd.addColorStop(1, rgb(ink.ground));
      c.fillStyle = grd;
      c.fillRect(-2, -2, Wc + 4, Hc + 4);

      // Distant field.
      c.fillStyle = rgb(ink.dim, ink.pos ? 0.55 : 0.45);
      c.beginPath();
      for (let k = 0; k < this.nd; k++) {
        const x = ((this.dx[k] + this.drift) % 1) * Wc;
        const y = this.dy[k] * Hc;
        const s = 0.35 + this.dl[k] * 0.8;
        c.rect(x - s / 2, y - s / 2, s, s);
      }
      c.fill();

      const tile = Hc / this.H;
      const ox = Wc / 2 - (this.W * tile) / 2;
      const oy = tile * 0.5;
      const fcx = ox + this.boltX * tile, fcy = oy + this.boltY * tile; // galaxy centre on the bolt

      // Buckets: LEVELS brightness steps for starlight, LEVELS for red.
      const nb = LEVELS * 2;
      if (!this.paths || this.pathInk !== ink) {
        this.pathInk = ink;
        this.styles = [];
        for (let b = 0; b < nb; b++) {
          const lv = (b % LEVELS) / (LEVELS - 1);
          const col = b < LEVELS ? mix(ink.dim, ink.bright, lv) : mix(ink.red, ink.hot, lv * 0.6);
          this.styles.push(rgb(col));
        }
      }
      const paths = [];
      for (let b = 0; b < nb; b++) paths.push(new Path2D());

      // Loose stars: differential rotation, faster inside.
      const haloN = Math.round(this.nh * P.halo);
      const twA = P.twinkle * (0.35 + 0.9 * e.hat);
      for (let k = 0; k < haloN; k++) {
        const r = this.hr[k];
        const a = this.ha[k] + this.rot * (140 / (r + 60));
        const x = fcx + Math.cos(a) * r * 1.35;
        const y = fcy + Math.sin(a) * r * 0.8;
        if (x < -4 || x > Wc + 4 || y < -4 || y > Hc + 4) continue;
        const tw = 1 - twA * 0.5 * (1 + Math.sin(this.tw * 2 + this.hp[k]));
        const s = (0.5 + this.hl[k] * 1.4) * Math.max(0.15, tw);
        const lv = Math.min(LEVELS - 1, Math.floor(this.hl[k] * tw * LEVELS));
        paths[lv].moveTo(x + s, y);
        paths[lv].arc(x, y, s, 0, TAU);
      }

      // Portrait stars.
      const G = face * 1.35; // threshold sweep; 1.35 so tau up to 1 plus the ramp all land home
      const RAMP = 0.3;
      const kick = e.kick * P.bolt;
      const n = this.n;
      const hx = this.hx, hy = this.hy, lum = this.lum, red = this.red;
      const tau = this.tau, ex = this.exp, ang = this.ang, ph = this.ph, fr = this.fr, cu = this.curl;
      const maxR = tile * 0.5;
      const brightest = [];
      for (let k = 0; k < n; k++) {
        const g = clamp((G - tau[k]) / RAMP, 0, 1);
        const home = g * g * (3 - 2 * g); // smoothstep
        const fxp = ox + hx[k] * tile, fyp = oy + hy[k] * tile;
        let x = fxp, y = fyp;
        if (home < 1) {
          // Sky place: the home vector from the bolt, pushed out, turned,
          // and carried by the galaxy's differential rotation.
          const vx = fxp - fcx, vy = fyp - fcy;
          const rr = Math.hypot(vx, vy) * ex[k] + 30;
          const a0 = Math.atan2(vy, vx) + ang[k] + this.rot * (140 / (rr + 60));
          const sx = fcx + Math.cos(a0) * rr * 1.35;
          const sy = fcy + Math.sin(a0) * rr * 0.8;
          const u = 1 - home;
          const dx = sx - fxp, dy = sy - fyp;
          // Travel on a curl: sideways by up to a quarter of the distance
          // mid-flight, so the face spirals in rather than slides in.
          const bend = Math.sin(Math.PI * u) * cu[k];
          x = fxp + dx * u - dy * bend;
          y = fyp + dy * u + dx * bend;
          if (x < -6 || x > Wc + 6 || y < -6 || y > Hc + 6) continue;
        }
        const v = ink.pos ? lum[k] : 1 - lum[k];
        const rd = red[k];
        const tw = 1 - twA * 0.45 * (1 + Math.sin(this.tw * fr[k] * 2.2 + ph[k]));
        // Out in the sky the stars are smaller, so the scattered face is a
        // star field and not a cloud of discs.
        let s = maxR * (0.14 + 0.9 * Math.pow(v, 1.4)) * (0.55 + 0.45 * home) * Math.max(0.2, tw);
        let lvF = v * (0.6 + 0.4 * tw);
        if (rd > 0.15) {
          // The bolt is the one constellation that is always legible, so its
          // stars keep a floor of size. The kick strikes red stars only once
          // they are home: struck out in the sky they read as confetti.
          if (tau[k] < 0.07) s = Math.max(s, maxR * 0.55 * rd);
          const kk = kick * rd * home;
          s *= 1 + kk * 1.1;
          lvF = kk;
        }
        const lv = Math.min(LEVELS - 1, Math.floor(lvF * LEVELS));
        const b = rd > 0.35 ? LEVELS + lv : lv;
        paths[b].moveTo(x + s, y);
        paths[b].arc(x, y, s, 0, TAU);
        if (v > 0.8 && home > 0.9 && rd < 0.2 && brightest.length < 400) brightest.push(x, y);
      }
      for (let b = 0; b < nb; b++) {
        c.fillStyle = this.styles[b];
        c.fill(paths[b]);
      }

      // Hats: a few four-point glints on bright stars, fading in and out.
      const rand = this.rand;
      const glintRate = P.twinkle * e.hat * 14;
      if (brightest.length && rand() < glintRate * dt) {
        const j = Math.floor(rand() * (brightest.length / 2)) * 2;
        this.glints.push({ x: brightest[j], y: brightest[j + 1], life: 0, dur: 0.35 + rand() * 0.3 });
      }
      c.lineCap = 'round';
      c.lineWidth = 0.7;
      for (let k = this.glints.length - 1; k >= 0; k--) {
        const gl = this.glints[k];
        gl.life += dt;
        if (gl.life > gl.dur) { this.glints.splice(k, 1); continue; }
        const a = Math.sin((gl.life / gl.dur) * Math.PI);
        const L = 3 + 7 * a;
        c.strokeStyle = rgb(ink.bright, 0.85 * a);
        c.beginPath();
        c.moveTo(gl.x - L, gl.y); c.lineTo(gl.x + L, gl.y);
        c.moveTo(gl.x, gl.y - L); c.lineTo(gl.x, gl.y + L);
        c.stroke();
      }

      // Clap: a shooting star. A little ambient chance too, so calm skies
      // get the odd one.
      if ((clapNow && rand() < 0.35 + 0.65 * P.meteors) || rand() < P.meteors * 0.04 * dt) {
        if (P.meteors > 0.02 && this.meteors.length < 4) this.spawnMeteor(Wc, Hc);
      }
      for (let k = this.meteors.length - 1; k >= 0; k--) {
        const m = this.meteors[k];
        m.life += dt;
        if (m.life > m.dur) { this.meteors.splice(k, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        const a = Math.sin((m.life / m.dur) * Math.PI);
        const sp = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
        const lg = c.createLinearGradient(tx, ty, m.x, m.y);
        lg.addColorStop(0, rgb(ink.bright, 0));
        lg.addColorStop(1, rgb(ink.bright, 0.9 * a));
        c.strokeStyle = lg;
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(tx, ty); c.lineTo(m.x, m.y);
        c.stroke();
        c.fillStyle = rgb(ink.bright, a);
        c.beginPath();
        c.arc(m.x, m.y, 1.4, 0, TAU);
        c.fill();
      }

      c.restore();
    },
  });
})();
