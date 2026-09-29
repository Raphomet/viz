// Confetti: the body as a physical thing in a room full of paper. Here the
// pose is not drawn at all; it acts. Paper confetti drifts down through the
// frame; the person mask is a solid the confetti lands on and slides off (it
// piles on the hat and shoulders and outlines him in paper), and his hands
// and feet sweep it along at the speed MediaPipe says they are moving. It is
// what the medium is for in a room: point the camera at the dance floor and
// the people on it become the thing the confetti falls on.
//
// Physics per piece: gravity against air drag (so paper floats rather than
// falls), a flutter that sways it and tumbles it (a tumbling piece shows its
// narrow edge, then its other face), a push out of the mask along the mask's
// gradient with most of its speed taken away (so it settles on top surfaces),
// and a drag towards the velocity of any hand, foot or the head within reach.
// Pieces are batched by ink and face and filled as one path each.
//
// Music:
//   kick   a burst of confetti from whichever hand or foot is moving fastest
//   snare  a paper streamer thrown from the other hand, curling as it falls
//   hats   the tumbling pieces glint: their bright faces flash brighter
//   bass   the air thickens: everything floats slower and sways wider
//   drop   with Follow the track: it pours, bigger pieces, a third ink, and
//          his shadow on the wall takes a colour
// Movement: the confetti's fall and his dance through it; the camera follows
// him slowly.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;

  const PRESETS = {
    calm: { pour: 0.3, size: 1, sweep: 1, inks: 2, shadow: 0 },
    drop: { pour: 1, size: 1.25, sweep: 1.4, inks: 3, shadow: 1 },
  };
  const DRIVE = ['pour', 'size', 'sweep', 'inks', 'shadow'];

  const ROOMS = [
    { name: 'Peach wall', wall: ['#F4DCCB', '#E9C4AE'], floor: '#DDB49A', shadow: [70, 40, 60], shadowDrop: [150, 50, 80],
      inks: [['#E0473C', '#F59A8E'], ['#2F6FB3', '#8FB9E6'], ['#F2B533', '#FBE08E'], ['#2E8C6E', '#8FD3B8']] },
    { name: 'Newsprint', wall: ['#EDEBE4', '#D8D5CA'], floor: '#C9C5B8', shadow: [40, 40, 44], shadowDrop: [40, 60, 110],
      inks: [['#1E1E22', '#6D6D72'], ['#F4F2EA', '#FFFFFF'], ['#C8372D', '#EE8A80'], ['#1E1E22', '#6D6D72']] },
    { name: 'Blue hour', wall: ['#2D3552', '#1C2136'], floor: '#161A2A', shadow: [8, 10, 20], shadowDrop: [60, 20, 60],
      inks: [['#F2C6A0', '#FFF0DC'], ['#E86A5A', '#FFB3A6'], ['#F2D16B', '#FFF1B8'], ['#9BC4E8', '#E1F0FF']] },
  ];

  const REACH = [0, 15, 16, 19, 20, 27, 28, 31, 32];

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
      .catch((e) => console.error('confetti: pose kit failed', e))
      .then(() => { if (hold) p._decrementPreload(); });
  }

  const MAXN = 3600;

  VIZ.register({
    id: 'pose5',
    name: 'Confetti',
    order: 1125,

    params: [
      { key: 'pour', label: 'Confetti pouring', type: 'range', min: 0, max: 1.5, default: PRESETS.calm.pour, step: 0.01 },
      { key: 'size', label: 'Piece size', type: 'range', min: 0.5, max: 2, default: PRESETS.calm.size, step: 0.01 },
      { key: 'sweep', label: 'Hands and feet sweep', type: 'range', min: 0, max: 2, default: PRESETS.calm.sweep, step: 0.01 },
      { key: 'inks', label: 'Inks', type: 'range', min: 1, max: 4, default: PRESETS.calm.inks, step: 0.01 },
      { key: 'shadow', label: 'Coloured shadow', type: 'range', min: 0, max: 1, default: PRESETS.calm.shadow, step: 0.01 },
      { key: 'room', label: 'Room', type: 'select', options: ROOMS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    get actions() { return window.VIZ_POSE ? window.VIZ_POSE.actions : []; },

    gallery: {
      title: 'Confetti',
      technique: 'MediaPipe tasks-vision 1.0.1 as physics input: the PoseLandmarker person mask as a collision solid (sampled with its gradient) and landmark velocities of hands, feet and head as moving colliders; baked offline from a public-domain film with pose_landmarker_heavy, or live in the page on the film, a dropped video or the camera (selfie segmenter for the camera). Up to 5,200 tumbling two-sided paper pieces with drag and flutter, batched into one Canvas 2D path per ink and face',
      brief: 'Little Tich dances as a shadow on a peach wall while paper confetti drifts down through the room. The confetti lands on him (it piles on his hat and shoulders and outlines him in paper), slides off as he leans, and his hands and big boots sweep it along. The kick throws a burst of confetti from whichever hand or foot is moving fastest; the snare throws a curling paper streamer from the other hand; hats make the tumbling pieces glint; the bass thickens the air so everything floats slower. On the drop it pours, the pieces grow, a third ink comes in and his shadow takes a colour. The same room with the camera on a real dance floor turns the dancers into what the confetti falls on.',
      lineage: [
        'Body-as-input installations (Myron Krueger\'s Videoplace, 1975; Camille Utterback and Romy Achituv\'s Text Rain, 1999, where letters fall and rest on the viewer\'s silhouette). MediaPipe puts the mask and the joints\' velocities in a browser tab.',
      ],
    },

    preload(p) { boot(p); },
    setup() {},

    enter(p, ctx) {
      if (window.VIZ_POSE) { K = window.VIZ_POSE; K.enter(); K.fromUrl(); }
      this.ear = window.VIZ_POSE ? window.VIZ_POSE.ear() : null;
      this.lastMs = null;
      this.cam = {};
      this.t = 0;
      // Struct of arrays for the pieces.
      this.n = 0;
      this.x = new Float32Array(MAXN); this.y = new Float32Array(MAXN);
      this.vx = new Float32Array(MAXN); this.vy = new Float32Array(MAXN);
      this.a = new Float32Array(MAXN); this.va = new Float32Array(MAXN);
      this.f = new Float32Array(MAXN); this.vf = new Float32Array(MAXN);
      this.ink = new Uint8Array(MAXN); this.sz = new Float32Array(MAXN);
      this.rest = new Float32Array(MAXN); this.ph = new Float32Array(MAXN);
      this.layer = new Uint8Array(MAXN);   // 0 behind him (small, far), 1 in front (lands on him)
      this.spawnAcc = 0;
      this.streamers = [];
      this.seeded = false;
    },
    leave() { if (K) K.leave(); },

    spawn(x, y, vx, vy, P) {
      let i;
      if (this.n < MAXN) i = this.n++;
      else { i = Math.floor(Math.random() * MAXN); }
      this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
      this.a[i] = Math.random() * TAU; this.va[i] = (Math.random() - 0.5) * 6;
      this.f[i] = Math.random() * TAU; this.vf[i] = 3 + Math.random() * 7;
      this.ink[i] = Math.floor(Math.random() * Math.max(1, Math.min(4, Math.round(P.inks) + (Math.random() < P.inks % 1 ? 1 : 0))));
      this.sz[i] = (0.7 + Math.random() * 0.6) * P.size;
      this.rest[i] = 0; this.ph[i] = Math.random() * TAU;
      this.layer[i] = Math.random() < 0.45 ? 0 : 1;
    },

    drawPieces(g, R, U, glint, layer) {
      const nInks = 4;
      for (let ink = 0; ink < nInks; ink++) for (let face = 0; face < 2; face++) {
        g.beginPath();
        let any = false;
        for (let i = 0; i < this.n; i++) {
          if (this.ink[i] !== ink || this.layer[i] !== layer) continue;
          const c = Math.cos(this.f[i]);
          if ((c >= 0 ? 0 : 1) !== face) continue;
          const s = this.sz[i] * U * (layer ? 5.2 : 3.2), w = s * Math.abs(c) + 0.25 * U, h = s * 0.62;
          const ca = Math.cos(this.a[i]), sa = Math.sin(this.a[i]);
          const x = this.x[i], y = this.y[i];
          g.moveTo(x + ca * w - sa * h, y + sa * w + ca * h);
          g.lineTo(x - ca * w - sa * h, y - sa * w + ca * h);
          g.lineTo(x - ca * w + sa * h, y - sa * w - ca * h);
          g.lineTo(x + ca * w + sa * h, y + sa * w - ca * h);
          g.closePath();
          any = true;
        }
        if (!any) continue;
        g.fillStyle = R.inks[ink][face];
        g.globalAlpha = layer ? 1 : 0.7;
        g.fill();
        g.globalAlpha = 1;
        if (face === 1 && glint > 0.05) { g.globalAlpha = glint * 0.7 * (layer ? 1 : 0.6); g.fillStyle = '#FFFFFF'; g.fill(); g.globalAlpha = 1; }
      }
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const R = ROOMS[clamp(Math.round(params.room), 0, ROOMS.length - 1)];
      const floorY = ctx.height * 0.9;
      const wall = g.createLinearGradient(0, 0, 0, floorY);
      wall.addColorStop(0, R.wall[0]); wall.addColorStop(1, R.wall[1]);
      g.fillStyle = wall; g.fillRect(0, 0, ctx.width, floorY);
      g.fillStyle = R.floor; g.fillRect(0, floorY, ctx.width, ctx.height - floorY);
      if (!K || !K.ready) { g.restore(); return; }
      if (!this.ear) this.enter(p, ctx);

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.05);
      this.lastMs = ms;
      this.t += dt;
      const e = this.ear;
      const hits = e.listen(signals, dt, Math.round(params.follow) === 1);
      const P = e.drive(params, PRESETS.drop, DRIVE);
      const react = params.react;
      K.tick(dt, 1);

      const pose = (this.pz = K.pose(0, this.pz));
      const prev = (this.pv = K.pose(0.05, this.pv));
      const T = K.frame(this.cam, pose, ctx, dt, 0.6, 2.5, 0.52);
      // Keep his feet on the floor line whatever the camera does.
      const H = this.cam.h * T.s;
      const U = ctx.height / 600;
      const mask = (this.mb = K.mask(0, this.mb));
      const MW = K.MW, MH = K.MH;

      // ---- seed a room already in the air, so it never starts empty
      if (!this.seeded) {
        this.seeded = true;
        for (let k = 0; k < 520; k++) this.spawn(Math.random() * ctx.width, Math.random() * floorY, 0, 20 * U, P);
      }
      // ---- pouring from above
      const pour = (40 + 380 * P.pour) * (ctx.width / 1067);
      this.spawnAcc += pour * dt;
      while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawn(Math.random() * ctx.width, -10 * U, (Math.random() - 0.5) * 20 * U, 30 * U, P); }

      // joint positions and velocities on the stage
      const jx = new Float32Array(REACH.length), jy = new Float32Array(REACH.length), jvx = new Float32Array(REACH.length), jvy = new Float32Array(REACH.length);
      let fast = 0, fastV = 0;
      for (let k = 0; k < REACH.length; k++) {
        const j = REACH[k];
        jx[k] = T.ox + pose.lm[j * 3] * T.s; jy[k] = T.oy + pose.lm[j * 3 + 1] * T.s;
        jvx[k] = (pose.lm[j * 3] - prev.lm[j * 3]) * T.s / 0.05; jvy[k] = (pose.lm[j * 3 + 1] - prev.lm[j * 3 + 1]) * T.s / 0.05;
        const v = Math.hypot(jvx[k], jvy[k]);
        if (k > 0 && v > fastV) { fastV = v; fast = k; }
      }

      // ---- kick: a burst from the fastest hand or foot
      if (hits.kick && react > 0.05) {
        const k = fast, n = Math.round(110 * clamp(react, 0, 2));
        const bx = jvx[k] / (fastV || 1), by = jvy[k] / (fastV || 1);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, s = (80 + Math.random() * 220) * U;
          this.spawn(jx[k], jy[k], Math.cos(a) * s + bx * 120 * U, Math.sin(a) * s + by * 120 * U - 120 * U, P);
        }
      }
      // ---- snare: a streamer from the other hand
      if (hits.snare && react > 0.05) {
        const hand = fast === 1 || fast === 3 ? 2 : 1, j = REACH[hand];
        const pts = [];
        for (let i = 0; i <= 26; i++) {
          const q = K.pose(i * 0.03);
          pts.push([T.ox + q.lm[j * 3] * T.s + Math.sin(i * 0.9) * 8 * U, T.oy + q.lm[j * 3 + 1] * T.s + Math.cos(i * 0.7) * 6 * U]);
        }
        this.streamers.push({ pts, vy: -60 * U, vx: jvx[hand] * 0.3, t: 0, ink: Math.floor(Math.random() * Math.max(1, Math.round(P.inks))) });
        if (this.streamers.length > 6) this.streamers.shift();
      }

      // ---- the pieces
      const drag = lerp(2.2, 4.2, e.bass * clamp(react, 0, 1.5));
      const grav = 150 * U;
      const sweep = P.sweep * 0.9;
      const reach = H * 0.11, reach2 = reach * reach;
      const X = this.x, Y = this.y, VX = this.vx, VY = this.vy, A = this.a, VA = this.va, Fp = this.f, VF = this.vf, RS = this.rest, PH = this.ph;
      const t = this.t;
      const inv = 1 / T.s, cell = T.s / MH;
      for (let i = 0; i < this.n; i++) {
        let vx = VX[i], vy = VY[i];
        // flutter: a sway that grows as the piece tumbles edge-on
        const sway = Math.sin(t * 2.3 + PH[i]) * (40 + 50 * e.bass) * U;
        vx += (sway - vx) * drag * dt * 0.5;
        vy += grav * dt - vy * drag * dt;
        // hands, feet and head
        for (let k = 0; k < REACH.length; k++) {
          const dx = X[i] - jx[k], dy = Y[i] - jy[k], d2 = dx * dx + dy * dy;
          if (d2 < reach2) {
            const w = (1 - d2 / reach2) * sweep * 8 * dt;
            vx += (jvx[k] - vx) * w; vy += (jvy[k] - vy) * w;
            VA[i] += (Math.random() - 0.5) * w * 20;
          }
        }
        // the body: a solid it rests on and slides off
        const mx = ((X[i] - T.ox) * inv) * MH - 0.5, my = ((Y[i] - T.oy) * inv) * MH - 0.5;
        const ix = mx | 0, iy = my | 0;
        if (this.layer[i] && ix > 0 && iy > 0 && ix < MW - 1 && iy < MH - 1) {
          const m = mask[iy * MW + ix];
          if (m > 100) {
            // Out along the mask's outward normal, and no speed into him:
            // gravity presses a piece onto a top surface, where it rests,
            // and down a side, where it slides.
            let nx = mask[iy * MW + ix - 1] - mask[iy * MW + ix + 1], ny = mask[(iy - 1) * MW + ix] - mask[(iy + 1) * MW + ix];
            const nl = Math.hypot(nx, ny);
            if (nl < 1) { nx = 0; ny = -1; } else { nx /= nl; ny /= nl; }
            const out = (m - 100) / 155 * cell * 0.9;
            X[i] += nx * out; Y[i] += ny * out;
            const vn = vx * nx + vy * ny;
            if (vn < 0) { vx -= vn * nx; vy -= vn * ny; }
            vx *= 0.9; vy *= 0.9;
            RS[i] = Math.min(1, RS[i] + dt * 5);
          } else RS[i] = Math.max(0, RS[i] - dt * 2);
        }
        X[i] += vx * dt; Y[i] += vy * dt;
        // the floor: pieces settle and stop tumbling
        if (Y[i] > floorY + (i % 7) * U * 3) {
          Y[i] = floorY + (i % 7) * U * 3; vy = 0; vx *= 0.8;
          VF[i] *= 0.9;
        }
        VX[i] = vx; VY[i] = vy;
        A[i] += VA[i] * dt * (1 - RS[i] * 0.8);
        Fp[i] += VF[i] * dt * (1 - RS[i] * 0.8);
      }
      // the floor keeps a carpet, but not forever: old floor pieces recycle
      // to the ceiling as the pour needs them (spawn() reuses random slots
      // once the pool is full)

      this.drawPieces(g, R, U, e.hat * clamp(react, 0, 1.5), 0);
      // ---- his silhouette: the person mask traced to a crisp outline
      const sc = [lerp(R.shadow[0], R.shadowDrop[0], P.shadow), lerp(R.shadow[1], R.shadowDrop[1], P.shadow), lerp(R.shadow[2], R.shadowDrop[2], P.shadow)].map(Math.round);
      const loops = K.contours(mask, 120, 0.0006).map((L) => K.soften(L, 2));
      g.fillStyle = 'rgb(' + sc.join(',') + ')';
      g.beginPath();
      for (const L of loops) { g.moveTo(T.ox + L[0] * T.s, T.oy + L[1] * T.s); for (let q = 2; q < L.length; q += 2) g.lineTo(T.ox + L[q] * T.s, T.oy + L[q + 1] * T.s); g.closePath(); }
      g.fill();
      this.drawPieces(g, R, U, e.hat * clamp(react, 0, 1.5), 1);

      // ---- streamers
      for (const s of this.streamers) {
        s.t += dt; s.vy += grav * 0.5 * dt; s.vy *= Math.exp(-1.2 * dt);
        for (const q of s.pts) { q[0] += s.vx * dt; q[1] += s.vy * dt; }
        const a = clamp(3 - s.t, 0, 1);
        if (a <= 0) continue;
        g.globalAlpha = a; g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 1; i < s.pts.length; i++) {
          const tw = Math.abs(Math.sin(i * 0.55 + s.t * 4));
          g.strokeStyle = R.inks[s.ink][tw > 0.5 ? 0 : 1];
          g.lineWidth = (1.2 + 3.2 * tw) * U;
          g.beginPath(); g.moveTo(s.pts[i - 1][0], s.pts[i - 1][1]); g.lineTo(s.pts[i][0], s.pts[i][1]); g.stroke();
        }
        g.globalAlpha = 1;
      }
      this.streamers = this.streamers.filter((s) => s.t < 3);
      g.restore();
    },
  });
})();
