// Paper Chorus: the dancer's person mask, cut out of paper, pasted up as a
// frieze. MediaPipe's segmentation gives the whole silhouette (hat, coat
// tails, the long boots' shadowed soles), not a skeleton, so this is the
// piece where the body is a shape rather than a set of joints.
//
// Every kick the dancer's silhouette at that instant is cut out in coloured
// paper and pasted on the wall behind him; the wall slides slowly by, so the
// dance is written out along it as a chorus line of held poses, overprinting
// where they overlap like riso inks. He dances on in front, cut from black
// paper, lifted off the wall on his own shadow.
//
// Outlines: marching squares over the 160x120 mask with interpolated edge
// crossings, then Chaikin corner cutting, so the cut edge is smooth at any
// stage size; the paste keeps its outline, so a pasted pose costs one fill.
//
// Music:
//   kick   a new silhouette is pasted under the dancer (every beat, 2 beats
//          or bar), one shape in one place
//   snare  a silhouette is pasted into the mirrored upper frieze in the
//          second ink
//   hats   paper punchings pop off his edge and flutter down
//   bass   the paper lifts: his shadow and the pasted shapes' shadows deepen
//   drop   with Follow the track: every beat, the mirrored frieze comes down
//          from the top edge sliding the other way, three inks instead of one
// Movement: the wall slides, the upper frieze counter-slides, and the camera
// follows him lazily.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;

  const PRESETS = {
    calm: { every: 1, mirror: 0, lift: 0.4, slide: 0.6, colour: 0.15 },
    drop: { every: 0, mirror: 1, lift: 0.85, slide: 1.0, colour: 1 },
  };
  const DRIVE = ['mirror', 'lift', 'slide', 'colour'];

  const INKSETS = [
    { name: 'Matisse', wall: '#F1EBDD', floor: '#E2D6BF', figure: '#1B1918', inks: ['#E06A4E', '#2F55B4', '#E3B23C'], mono: '#8E9AAF' },
    { name: 'Riso', wall: '#F4EFE6', floor: '#E4DCCB', figure: '#23201F', inks: ['#E8557A', '#1F8A8A', '#F2C230'], mono: '#9FB4B1' },
    { name: 'Kraft', wall: '#C9A77C', floor: '#B08E64', figure: '#201B17', inks: ['#F5F0E4', '#B43A2C', '#2D3E6B'], mono: '#E9DFCB' },
  ];
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')'; };

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
      .catch((e) => console.error('paper chorus: pose kit failed', e))
      .then(() => { if (hold) p._decrementPreload(); });
  }

  // A silhouette's closed outlines, as one path at (ox, oy) scale s.
  function tracePath(g, loops, s, ox, oy, flipY) {
    g.beginPath();
    for (const L of loops) {
      g.moveTo(ox + L[0] * s, oy + (flipY ? -L[1] : L[1]) * s);
      for (let i = 2; i < L.length; i += 2) g.lineTo(ox + L[i] * s, oy + (flipY ? -L[i + 1] : L[i + 1]) * s);
      g.closePath();
    }
  }
  function cut(mask, thr) {
    const loops = K.contours(mask, thr || 120, 0.0006);
    return loops.map((L) => K.soften(L, 2));
  }
  function bounds(loops) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const L of loops) for (let i = 0; i < L.length; i += 2) { x0 = Math.min(x0, L[i]); x1 = Math.max(x1, L[i]); y0 = Math.min(y0, L[i + 1]); y1 = Math.max(y1, L[i + 1]); }
    return { x0, x1, y0, y1, cx: (x0 + x1) / 2 };
  }

  VIZ.register({
    id: 'pose2',
    name: 'Paper Chorus',
    order: 1122,

    params: [
      { key: 'every', label: 'Paste every', type: 'select', options: ['Beat', '2 beats', 'Bar'], default: PRESETS.calm.every },
      { key: 'slide', label: 'Wall slide', type: 'range', min: 0, max: 2, default: PRESETS.calm.slide, step: 0.01 },
      { key: 'mirror', label: 'Mirrored frieze', type: 'range', min: 0, max: 1, default: PRESETS.calm.mirror, step: 0.01 },
      { key: 'colour', label: 'Colour', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'lift', label: 'Paper lift', type: 'range', min: 0, max: 1, default: PRESETS.calm.lift, step: 0.01 },
      { key: 'papers', label: 'Papers', type: 'select', options: INKSETS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    get actions() { return window.VIZ_POSE ? window.VIZ_POSE.actions : []; },

    gallery: {
      title: 'Paper Chorus',
      technique: 'MediaPipe tasks-vision 1.0.1 PoseLandmarker person segmentation mask (baked offline from a public-domain film with pose_landmarker_heavy, or live in the page on the film, a dropped video or the camera with the selfie segmenter), traced to vector outlines by marching squares with interpolated crossings and Chaikin smoothing; Canvas 2D fills multiplied as overprinting inks, offset solid shadows for the paper\'s lift',
      brief: 'Little Tich cut out of black paper, dancing in front of a wall that slides slowly by. On every kick his silhouette at that instant is cut from coloured paper and pasted on the wall behind him, so the dance is written out as a chorus line of held poses, overprinting like riso inks where they overlap. The snare pastes one into a mirrored frieze hanging from the top edge; hats pop paper punchings off his edge; the bass lifts the paper so the shadows deepen. On the drop he pastes every beat, the mirrored frieze comes down sliding the other way and the one quiet ink becomes three.',
      lineage: [
        'The body as a shape: the one thing a segmentation mask gives that a skeleton cannot. Matisse\'s cut-outs (Jazz, 1947) for the papers; the Paper Dancers idea in docs/research/2026-09-28-js-libraries.md for the echoes a beat behind; Muybridge\'s plates for the frieze as a record of a movement.',
        'LEXSAN\'s white silhouettes (scene 2) are the brief\'s silhouette piece; Raph did not care for them, so this one does something with the silhouette instead of showing it.',
      ],
    },

    preload(p) { boot(p); },
    setup() {},

    enter(p, ctx) {
      if (window.VIZ_POSE) { K = window.VIZ_POSE; K.enter(); K.fromUrl(); }
      this.ear = window.VIZ_POSE ? window.VIZ_POSE.ear() : null;
      this.lastMs = null;
      this.cam = {};
      this.pastes = [];        // { loops, b, x (wall units), row, ink, t }
      this.wall = 0;           // how far the lower wall has slid, stage units
      this.wall2 = 0;
      this.beat = 0;
      this.inkIx = 0;
      this.bits = [];          // paper punchings
      this.seeded = false;
      this.t = 0;
    },
    leave() { if (K) K.leave(); },

    paste(row, ctx, T, age, inkIx) {
      const mask = K.mask(age || 0);
      const loops = cut(mask);
      if (!loops.length) return;
      const b = bounds(loops);
      // Where he stands now, in wall coordinates (the wall slides left).
      // Just behind him, on the side the wall slides away to, so the paste
      // is seen the moment it lands instead of hiding behind him.
      const sx = T.ox + this.cam.cx * T.s - ctx.width * 0.17 * (row === 0 ? 1 : -1);
      const wx = row === 0 ? sx + this.wall : sx - this.wall2;
      this.pastes.push({ loops, b, x: wx, row, ink: inkIx, t: this.t });
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const set = INKSETS[clamp(Math.round(params.papers), 0, INKSETS.length - 1)];
      g.fillStyle = set.wall; g.fillRect(0, 0, ctx.width, ctx.height);
      if (!K || !K.ready) { g.restore(); return; }
      if (!this.ear) this.enter(p, ctx);

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.t += dt;
      const e = this.ear;
      const hits = e.listen(signals, dt, Math.round(params.follow) === 1);
      const P = e.drive(params, PRESETS.drop, DRIVE);
      const react = params.react;
      const every = [1, 2, 4][Math.round(e.auto > 0.5 ? Math.min(params.every, PRESETS.drop.every) : params.every)];
      K.tick(dt, 1);

      const pose = (this.pz = K.pose(0, this.pz));
      const fill = 0.56;
      const T = K.frame(this.cam, pose, ctx, dt, fill, 2.2, 0.52);
      const H = this.cam.h * T.s;
      // The frieze: the same dance at 0.46 scale, feet on a line high on the wall.
      const FS = 0.46, fT = { s: T.s * FS };
      const base = ctx.height * 0.6;           // frieze baseline (feet)
      const slide = P.slide * ctx.width * 0.1 * (0.6 + 0.8 * e.bass);
      this.wall += slide * dt;
      this.wall2 += slide * dt * 0.8;

      // ---- seed the wall with the dance so far, so it is never bare
      if (!this.seeded && K.source === 'film') {
        this.seeded = true;
        for (let k = 13; k >= 1; k--) {
          const loops = cut(K.mask(k * 1.37));
          if (!loops.length) continue;
          const b = bounds(loops);
          this.pastes.push({ loops, b, x: ctx.width * 0.33 - k * ctx.width * 0.17 + this.wall, row: 0, ink: k % 3, t: -k });
        }
      }

      // ---- the music
      if (hits.kick && react > 0.05) {
        this.beat++;
        if (this.beat % every === 0) { this.inkIx = (this.inkIx + 1) % 3; this.paste(0, ctx, T, 0, this.inkIx); }
      }
      if (hits.snare && react > 0.05 && P.mirror > 0.2) this.paste(1, ctx, T, 0, (this.inkIx + 1) % 3);

      const lift = P.lift * (0.5 + 0.7 * e.bass * react);
      const shadowCol = 'rgba(55,35,20,' + (0.10 + 0.16 * lift).toFixed(3) + ')';

      // ---- the pasted frieze(s)
      const inkFor = (q) => {
        const age = this.t - q.t;
        const fresh = mix(set.mono, set.inks[q.ink], clamp(P.colour, 0, 1));
        return { col: fresh, fade: clamp((age - 20) / 45, 0, 0.85) };
      };
      const drawRow = (row) => {
        const flip = row === 1;
        const alpha = row === 1 ? clamp(P.mirror * 1.2, 0, 1) : 1;
        if (alpha < 0.01) return;
        const y0 = row === 0 ? base : ctx.height * 0.02 + (1 - P.mirror) * -ctx.height * 0.25;
        // shadows first, then the inks multiplied, so overlaps overprint
        for (const pass of [0, 1]) {
          g.globalCompositeOperation = pass ? 'multiply' : 'source-over';
          for (const q of this.pastes) {
            if (q.row !== row) continue;
            // The wall is a loop 2.4 stages long, so the chorus line comes
            // round again and builds up instead of sliding away for good.
            const Lw = ctx.width * 2.4, pad = ctx.width * 0.3;
            const x = ((((row === 0 ? q.x - this.wall : q.x + this.wall2) + pad) % Lw) + Lw) % Lw - pad;
            const halfW = (q.b.x1 - q.b.x0) * fT.s * 0.5;
            if (x + halfW < -20 || x - halfW > ctx.width + 20) continue;
            const ox = x - q.b.cx * fT.s;
            const oy = flip ? y0 + q.b.y1 * fT.s : y0 - q.b.y1 * fT.s;
            const ik = inkFor(q);
            if (!pass) {
              const d = H * FS * 0.02 * (0.4 + lift);
              g.globalAlpha = alpha * (1 - ik.fade);
              g.fillStyle = shadowCol;
              tracePath(g, q.loops, fT.s, ox + d, oy + d * 1.2, flip);
              g.fill();
            } else {
              g.globalAlpha = alpha * (1 - ik.fade) * 0.92;
              g.fillStyle = ik.col;
              tracePath(g, q.loops, fT.s, ox, oy, flip);
              g.fill();
            }
          }
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      };
      drawRow(1);
      // a pencil line where the frieze stands
      g.strokeStyle = 'rgba(40,30,20,0.25)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, base + 1.5); g.lineTo(ctx.width, base + 1.5); g.stroke();
      drawRow(0);
      // the oldest pastes are papered over
      this.pastes = this.pastes.filter((q) => this.t - q.t < 65);
      while (this.pastes.length > 44) this.pastes.shift();

      // ---- the floor, and his long shadow across it from a low lamp
      const horizon = ctx.height * 0.71;
      g.fillStyle = set.floor; g.fillRect(0, horizon, ctx.width, ctx.height - horizon);
      g.fillStyle = 'rgba(40,28,16,0.10)'; g.fillRect(0, horizon, ctx.width, ctx.height * 0.006);
      const mask = (this.mb = K.mask(0, this.mb));
      const loops = cut(mask);
      if (loops.length) {
        const bb = bounds(loops);
        const fy = T.oy + bb.y1 * T.s;
        this.lampPh = (this.lampPh || 0) + dt * (0.05 + 0.25 * e.pad);
        const kx = -0.9 * Math.sin(this.lampPh) - 0.3, m = 0.32 + 0.12 * lift;
        g.save();
        g.transform(1, 0, -kx * m, m, kx * m * fy, fy * (1 - m));
        g.fillStyle = 'rgba(50,32,18,' + (0.12 + 0.12 * lift).toFixed(3) + ')';
        tracePath(g, loops, T.s, T.ox, T.oy, false); g.fill();
        g.restore();
      }
      const d = H * 0.025 * (0.5 + lift);
      g.fillStyle = 'rgba(55,35,20,' + (0.16 + 0.18 * lift).toFixed(3) + ')';
      tracePath(g, loops, T.s, T.ox + d, T.oy + d * 1.3, false); g.fill();
      g.fillStyle = set.figure;
      tracePath(g, loops, T.s, T.ox, T.oy, false); g.fill();
      // the cut edge catches the light on the upper left
      g.strokeStyle = 'rgba(255,250,240,0.18)'; g.lineWidth = Math.max(0.6, H * 0.003);
      tracePath(g, loops, T.s, T.ox - H * 0.002, T.oy - H * 0.002, false); g.stroke();

      // ---- hats: punchings pop off his edge
      if (hits.hat && react > 0.05 && loops.length) {
        const L = loops.reduce((a, b) => (a.length > b.length ? a : b));
        for (let k = 0; k < 3; k++) {
          const i = (Math.floor(Math.random() * L.length / 2)) * 2;
          this.bits.push({ x: T.ox + L[i] * T.s, y: T.oy + L[i + 1] * T.s, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, a: Math.random() * TAU, life: 1, ink: Math.floor(Math.random() * 3) });
        }
        if (this.bits.length > 80) this.bits.splice(0, this.bits.length - 80);
      }
      for (const b of this.bits) {
        b.vy += 120 * dt; b.vx *= Math.exp(-2 * dt); b.vy *= Math.exp(-1.5 * dt);
        b.x += b.vx * dt + Math.sin(b.a + this.t * 5) * 8 * dt; b.y += b.vy * dt; b.a += dt * 3; b.life -= dt * 0.45;
      }
      this.bits = this.bits.filter((b) => b.life > 0);
      for (const b of this.bits) {
        const r = H * 0.008, sq = Math.abs(Math.cos(b.a));
        g.globalAlpha = clamp(b.life * 1.5, 0, 1);
        g.fillStyle = shadowCol; g.beginPath(); g.ellipse(b.x + r, b.y + r * 1.3, r, r * sq + 0.2, 0, 0, TAU); g.fill();
        g.fillStyle = mix(set.mono, set.inks[b.ink], clamp(P.colour + 0.3, 0, 1)); g.beginPath(); g.ellipse(b.x, b.y, r, r * sq + 0.2, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
    },
  });
})();
