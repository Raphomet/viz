// Chronograph: the dance as Étienne-Jules Marey photographed movement in the
// 1880s. His runners wore black suits with white lines down the limbs and
// dots at the joints, ran past a black shed, and a rotating shutter exposed
// them many times on one plate, so the plate showed a fan of stick figures:
// the first pictures of movement as data. MediaPipe gives exactly that data
// (the line down each limb, a point at each joint) from an ordinary film, so
// this piece is Marey's apparatus rebuilt on the pose track.
//
// The plate: a shutter fires several times a second, each exposure a
// geometric figure (limb lines, joint dots) that fades as the plate ages.
// The plate slides steadily left under the lens, so the exposures fan out
// across it behind the dancer. With trails on, the wrists, ankles and head
// also draw their paths through the last seconds, as Marey's point-light
// trajectory plates did.
//
// Music:
//   kick   a full exposure: heavier lines and, faintly, the whole body (the
//          person mask) caught on the plate for an instant
//   snare  one exposure in the second ink
//   hats   the joint dots of the live figure glint
//   bass   the shutter speeds up; the plate slides faster
//   drop   with Follow the track: a faster shutter, longer memory, the
//          trajectories of hands, feet and head drawn in three inks
// Movement: the plate itself: everything the shutter caught drifts away
// leftwards, so the frame is always a moving record.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  const PRESETS = {
    calm: { strobe: 4, drift: 0.5, persist: 2.2, trails: 0, ghost: 0.5 },
    drop: { strobe: 7, drift: 1.1, persist: 3, trails: 1, ghost: 0.9 },
  };
  const DRIVE = ['strobe', 'drift', 'persist', 'trails', 'ghost'];

  const PLATES = [
    { name: 'Velvet shed', ground: '#14120F', line: [233, 225, 204], alt: [217, 85, 59], inks: [[233, 225, 204], [217, 85, 59], [226, 176, 74]], ghost: [233, 225, 204], dark: true },
    { name: 'Cyanotype', ground: '#1B3A66', line: [236, 240, 238], alt: [242, 194, 48], inks: [[236, 240, 238], [242, 194, 48], [140, 196, 214]], ghost: [236, 240, 238], dark: true },
    { name: 'Albumen print', ground: '#E8DCC0', line: [58, 40, 26], alt: [168, 52, 36], inks: [[58, 40, 26], [168, 52, 36], [60, 86, 120]], ghost: [90, 62, 40], dark: false },
  ];
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';

  // Marey's suit: a line down each limb and the spine, dots at the joints.
  const LINES = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32], [11, 12], [23, 24]];
  const DOTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const TRAILS = [[15, 0], [16, 0], [27, 1], [28, 1], [0, 2]];

  let K = null;
  function boot(p) {
    // In the app index.html loads pose/kit.js before the scenes; the render
    // harness loads only this file, so fetch the kit here and hold p5's
    // preload under the harness until the baked track is in.
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_POSE ? Promise.resolve(window.VIZ_POSE) : new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = 'pose/kit.js';
      s.onload = () => ok(window.VIZ_POSE); s.onerror = () => no(new Error('pose/kit.js did not load'));
      document.head.appendChild(s);
    });
    kit.then((k) => { K = k; return hold ? k.load() : null; })
      .catch((e) => console.error('chronograph: pose kit failed', e))
      .then(() => { if (hold) p._decrementPreload(); });
  }

  function figure(g, L, s, ox, oy, H, width, dotR) {
    g.lineWidth = width;
    g.beginPath();
    for (const [a, b] of LINES) { g.moveTo(ox + L[a * 3] * s, oy + L[a * 3 + 1] * s); g.lineTo(ox + L[b * 3] * s, oy + L[b * 3 + 1] * s); }
    // spine and head, as Marey's suit had a line down the back and a white cap
    const sx = (L[33] + L[36]) / 2, sy = (L[34] + L[37]) / 2, hx = (L[69] + L[72]) / 2, hy = (L[70] + L[73]) / 2;
    g.moveTo(ox + sx * s, oy + sy * s); g.lineTo(ox + hx * s, oy + hy * s);
    g.stroke();
    g.beginPath();
    for (const j of DOTS) { const x = ox + L[j * 3] * s, y = oy + L[j * 3 + 1] * s; g.moveTo(x + dotR, y); g.arc(x, y, dotR, 0, TAU); }
    const nx = ox + (L[0] * 0.4 + (L[21] + L[24]) * 0.3) * s, ny = oy + (L[1] * 0.4 + (L[22] + L[25]) * 0.3) * s;
    g.moveTo(nx + dotR * 2.6, ny); g.arc(nx, ny, dotR * 2.6, 0, TAU);
    g.fill();
  }

  VIZ.register({
    id: 'pose3',
    name: 'Chronograph',
    order: 1123,

    params: [
      { key: 'strobe', label: 'Shutter (exposures a second)', type: 'range', min: 1, max: 14, default: PRESETS.calm.strobe, step: 0.1 },
      { key: 'drift', label: 'Plate drift', type: 'range', min: 0, max: 1.5, default: PRESETS.calm.drift, step: 0.01 },
      { key: 'persist', label: 'Plate memory (s)', type: 'range', min: 0.5, max: 6, default: PRESETS.calm.persist, step: 0.01 },
      { key: 'trails', label: 'Point-light trails', type: 'range', min: 0, max: 1, default: PRESETS.calm.trails, step: 0.01 },
      { key: 'ghost', label: 'Body on the kick', type: 'range', min: 0, max: 1, default: PRESETS.calm.ghost, step: 0.01 },
      { key: 'plate', label: 'Plate', type: 'select', options: PLATES.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    get actions() { return window.VIZ_POSE ? window.VIZ_POSE.actions : []; },

    gallery: {
      title: 'Chronograph',
      technique: 'MediaPipe tasks-vision 1.0.1 PoseLandmarker (33 landmarks over time, and the person mask on the kick), baked offline from a public-domain film with pose_landmarker_heavy or run live in the page on the film, a dropped video or the camera; a strobed history of pose snapshots drawn as Canvas 2D line-and-dot figures on a sliding plate, joint trajectories sampled from the pose history, the mask composited as a low-alpha upscaled image',
      brief: 'Marey\'s geometric chronophotograph, rebuilt on the pose track: Little Tich in his big boots as a figure of white lines and joint dots, exposed several times a second onto a plate that slides slowly left, so every movement fans out behind him across the black. The kick is a full exposure, heavier, with his whole body faintly caught on the plate for an instant; the snare exposes one figure in red; hats glint his joints; the bass quickens the shutter and the slide. On the drop the shutter races, the plate remembers longer and his hands, feet and head draw their paths through the air in three inks. Also as a cyanotype, or a light albumen print.',
      lineage: [
        'Étienne-Jules Marey, "Joinville soldier walking" (1883) and his other geometric chronophotographs: black suits with white lines and dots, a black shed, a rotating shutter. MediaPipe\'s landmarks are that suit, found in any footage.',
        'Marey\'s point-light trajectory plates, and Muybridge\'s plates for the idea of movement as a record.',
      ],
    },

    preload(p) { boot(p); },
    setup() {},

    enter() {
      if (window.VIZ_POSE) { K = window.VIZ_POSE; K.enter(); K.fromUrl(); }
      this.ear = window.VIZ_POSE ? window.VIZ_POSE.ear() : null;
      this.lastMs = null;
      this.cam = {};
      this.exp = [];            // { L, s, ox, oy, t, w, ink, ghost }
      this.shutter = 0;
      this.plate = 0;           // how far the plate has slid
      this.t = 0;
    },
    leave() { if (K) K.leave(); },

    expose(T, w, ink, ghost) {
      const pz = K.pose(0);
      const q = { L: pz.lm, s: T.s, ox: T.ox, oy: T.oy, t: this.t, x0: this.plate, w, ink };
      if (ghost > 0.02) {
        const m = K.mask(0);
        q.ghost = K.maskCanvas(m, this.inkGhost, null).canvas;
        q.ghostA = ghost;
      }
      this.exp.push(q);
      if (this.exp.length > 140) this.exp.shift();
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const plate = PLATES[clamp(Math.round(params.plate), 0, PLATES.length - 1)];
      g.fillStyle = plate.ground; g.fillRect(0, 0, ctx.width, ctx.height);
      if (!K || !K.ready) { g.restore(); return; }
      if (!this.ear) this.enter(p, ctx);
      this.inkGhost = plate.ghost;

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.t += dt;
      const e = this.ear;
      const hits = e.listen(signals, dt, Math.round(params.follow) === 1);
      const P = e.drive(params, PRESETS.drop, DRIVE);
      const react = params.react;
      K.tick(dt, 1);

      const pose = (this.pz = K.pose(0, this.pz));
      // The lens keeps him in the right third so the plate's record fans out
      // across the rest.
      const T = K.frame(this.cam, pose, ctx, dt, 0.62, 1.4, 0.5);
      T.ox += ctx.width * 0.16;
      const H = this.cam.h * T.s;
      const slide = ctx.width * 0.14 * P.drift * (0.7 + 0.6 * e.bass * react);
      this.plate += slide * dt;

      // ---- the shutter
      const rate = P.strobe * (1 + 0.35 * e.bass * react);
      this.shutter += dt * rate;
      if (this.shutter >= 1) { this.shutter -= Math.floor(this.shutter); this.expose(T, 1, 0, 0); }
      if (hits.kick && react > 0.05) this.expose(T, 2.4, 0, P.ghost * clamp(react, 0, 1.5));
      if (hits.snare && react > 0.05) this.expose(T, 1.8, 1, 0);

      // ---- the plate: every exposure, faded by age, slid by the plate's travel
      const persist = P.persist;
      this.exp = this.exp.filter((q) => this.t - q.t < persist * 3.2);
      const lw = H * 0.006, dotR = H * 0.007;
      for (const q of this.exp) {
        const age = this.t - q.t;
        const a = Math.exp(-age / persist);
        const dx = -(this.plate - q.x0);
        if (q.ghost) {
          const ga = q.ghostA * 0.22 * Math.exp(-age / (persist * 0.45));
          if (ga > 0.004) {
            g.globalAlpha = ga;
            g.imageSmoothingEnabled = true;
            g.drawImage(q.ghost, q.ox + dx, q.oy, K.MW / K.MH * q.s, q.s);
          }
        }
        const col = q.ink === 1 ? plate.alt : plate.line;
        g.globalAlpha = clamp(a * (q.w >= 2 ? 1 : 0.7), 0, 1);
        g.strokeStyle = rgba(col, 1); g.fillStyle = rgba(col, 1);
        g.lineCap = 'round';
        figure(g, q.L, q.s, q.ox + dx, q.oy, H, lw * (0.5 + q.w * 0.5), dotR * (0.6 + q.w * 0.3));
      }
      g.globalAlpha = 1;

      // ---- point-light trails of hands, feet and head
      if (P.trails > 0.02) {
        const span = 1.2 + 1.8 * P.trails, n = 48;
        for (const [j, ink] of TRAILS) {
          g.strokeStyle = rgba(plate.inks[ink], 1);
          g.lineWidth = H * 0.007 * (1 + e.bass * 0.6);
          g.lineCap = 'round'; g.lineJoin = 'round';
          let px = 0, py = 0;
          for (let i = 0; i <= n; i++) {
            const age = (i / n) * span;
            const q = K.pose(age, this.tq || (this.tq = { lm: new Float32Array(99), world: new Float32Array(99) }));
            // older points slide with the plate, as the exposures do
            const x = T.ox + q.lm[j * 3] * T.s - slide * age, y = T.oy + q.lm[j * 3 + 1] * T.s;
            if (i) {
              g.globalAlpha = P.trails * (1 - i / n) * 0.9;
              g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
            }
            px = x; py = y;
          }
        }
        g.globalAlpha = 1;
      }

      // ---- the live figure, and the hats glinting on its joints
      g.strokeStyle = rgba(plate.line, 1); g.fillStyle = rgba(plate.line, 1);
      figure(g, pose.lm, T.s, T.ox, T.oy, H, lw * 1.1, dotR);
      if (e.hat > 0.05 && react > 0.05) {
        g.fillStyle = rgba(plate.inks[2], 1);
        for (const j of DOTS) {
          const x = T.ox + pose.lm[j * 3] * T.s, y = T.oy + pose.lm[j * 3 + 1] * T.s;
          g.globalAlpha = clamp(e.hat * react, 0, 1) * (0.5 + 0.5 * ((j * 7) % 3) / 2);
          g.beginPath(); g.arc(x, y, dotR * 1.8, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
      }

      // ---- Marey's graduated rule along the foot of the plate
      const ry = ctx.height * 0.93, seg = ctx.height * 0.05, off = -(this.plate % (seg * 2));
      g.fillStyle = rgba(plate.line, 0.55);
      for (let x = off; x < ctx.width; x += seg * 2) g.fillRect(x, ry, seg, ctx.height * 0.012);
      g.fillStyle = rgba(plate.line, 0.2); g.fillRect(0, ry - ctx.height * 0.002, ctx.width, ctx.height * 0.002);
      g.restore();
    },
  });
})();
