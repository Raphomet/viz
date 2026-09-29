// Time Sculpture: the dance as a solid object. MediaPipe's world landmarks
// are a 3D skeleton in metres from a single flat, 125-year-old film, and
// that depth is what this piece is about: the last seconds of the dance are
// laid out in space, each moment a slice, and every limb sweeps a ribbon
// through the slices, so the movement becomes a sculpture you can walk round.
// The camera does walk round it.
//
// How: the world landmarks are sampled at ~40 moments over the last few
// seconds of the pose track; slice k is displaced along a slow curve by its
// age; each bone between consecutive slices is a quad. Quads are lit
// (Lambert, one warm key and a cool fill), sorted back to front and filled in
// Canvas 2D, with their shadows dropped straight down onto a studio floor.
// The live pose stands at the head of the sculpture as a mannequin of balls
// and rods.
//
// Music:
//   kick   the moment is painted: a band of the accent colour goes round
//          every ribbon at the head of the sculpture and rides back along it
//   snare  a thin band in the second accent
//   hats   glints on the mannequin's joints
//   bass   the sculpture stretches: its travel per second swells
//   drop   with Follow the track: the torso and feet sweep ribbons too, the
//          sculpture grows longer, the camera orbits faster
// Movement: a slow orbit of the camera round the sculpture, which also
// travels through space as the dance goes on.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;

  const PRESETS = {
    calm: { span: 2.2, orbit: 0.35, travel: 0.9, body: 0, tilt: 0.35 },
    drop: { span: 3.2, orbit: 0.8, travel: 1.25, body: 1, tilt: 0.5 },
  };
  const DRIVE = ['span', 'orbit', 'travel', 'body', 'tilt'];

  const MATERIALS = [
    { name: 'Terracotta', bg: ['#D9CDBB', '#B9AA94'], floor: '#E6DCCB', a: [196, 104, 72], b: [236, 226, 208], k1: [214, 164, 56], k2: [52, 84, 150], rod: [40, 34, 30] },
    { name: 'Plaster', bg: ['#CFD3D1', '#9EA6A6'], floor: '#E1E4E1', a: [238, 234, 226], b: [170, 176, 178], k1: [210, 64, 48], k2: [40, 70, 130], rod: [30, 30, 34] },
    { name: 'Lacquer', bg: ['#2A2624', '#141211'], floor: '#34302C', a: [176, 38, 34], b: [60, 34, 30], k1: [236, 196, 90], k2: [220, 226, 230], rod: [236, 226, 208] },
  ];

  // Bones that sweep ribbons. Calm: the limbs. The drop adds the torso and feet.
  const LIMB_BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];
  const BODY_BONES = [[11, 12], [23, 24], [27, 31], [28, 32]];
  const ROD_BONES = [[11, 12], [23, 24], [11, 23], [12, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
  const BALLS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

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
      .catch((e) => console.error('time sculpture: pose kit failed', e))
      .then(() => { if (hold) p._decrementPreload(); });
  }

  const NS = 40;              // slices

  VIZ.register({
    id: 'pose4',
    name: 'Time Sculpture',
    order: 1124,

    params: [
      { key: 'span', label: 'Seconds of dance in the sculpture', type: 'range', min: 0.6, max: 5, default: PRESETS.calm.span, step: 0.01 },
      { key: 'travel', label: 'Stretch (metres a second)', type: 'range', min: 0, max: 1.6, default: PRESETS.calm.travel, step: 0.01 },
      { key: 'body', label: 'Torso and feet sweep too', type: 'range', min: 0, max: 1, default: PRESETS.calm.body, step: 0.01 },
      { key: 'orbit', label: 'Camera orbit', type: 'range', min: 0, max: 1.5, default: PRESETS.calm.orbit, step: 0.01 },
      { key: 'tilt', label: 'Camera height', type: 'range', min: 0, max: 1, default: PRESETS.calm.tilt, step: 0.01 },
      { key: 'material', label: 'Material', type: 'select', options: MATERIALS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    get actions() { return window.VIZ_POSE ? window.VIZ_POSE.actions : []; },

    gallery: {
      title: 'Time Sculpture',
      technique: 'MediaPipe tasks-vision 1.0.1 PoseLandmarker world landmarks (a metric 3D skeleton estimated from one flat 1900 film; baked offline with pose_landmarker_heavy, or live in the page on the film, a dropped video or the camera), sampled over the last seconds into ~40 slices; each bone swept into quads between slices, Lambert-lit with a key and a fill, depth-sorted and filled in Canvas 2D with drop shadows on a studio floor, under an orbiting perspective camera',
      brief: 'The last few seconds of Little Tich\'s dance made solid: every limb sweeps a ribbon through space, so the movement becomes a terracotta sculpture that trails behind him while he dances on at its head as a mannequin of balls and rods. The camera walks slowly round it. The kick paints a band round every ribbon at the head, and the band rides back along the sculpture, so the beat is written into the object; the snare paints a thin blue one; hats glint the mannequin\'s joints; the bass stretches the sculpture. On the drop the torso and feet sweep too, the sculpture grows longer and the camera circles faster. In terracotta, plaster, or red lacquer on a dark ground.',
      lineage: [
        'Motion sculpture: MIT CSAIL\'s MoSculp (2018), Marey\'s bronze of a flying gull (1887), Boccioni\'s Unique Forms of Continuity in Space (1913). MediaPipe\'s world landmarks make the 3D reading possible from a single flat film.',
        'LEXSAN takeaway: a camera that walks round the subject keeps it interesting (docs/research/2026-09-28-lexsan-takeaways.md).',
      ],
    },

    preload(p) { boot(p); },
    setup() {},

    enter() {
      if (window.VIZ_POSE) { K = window.VIZ_POSE; K.enter(); K.fromUrl(); }
      this.ear = window.VIZ_POSE ? window.VIZ_POSE.ear() : null;
      this.lastMs = null;
      this.az = 0.6;
      this.t = 0;
      this.marks = [];        // { t, kind } painted moments
      this.slices = [];
      for (let k = 0; k < NS; k++) this.slices.push({ w: new Float32Array(99), lm: new Float32Array(99) });
      this.proj = new Float32Array(NS * 33 * 3);
      this.stretch = 0.6;
    },
    leave() { if (K) K.leave(); },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const M = MATERIALS[clamp(Math.round(params.material), 0, MATERIALS.length - 1)];
      const bg = g.createLinearGradient(0, 0, 0, ctx.height);
      bg.addColorStop(0, M.bg[0]); bg.addColorStop(1, M.bg[1]);
      g.fillStyle = bg; g.fillRect(0, 0, ctx.width, ctx.height);
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
      K.tick(dt, 1);

      if (hits.kick && react > 0.05) this.marks.push({ t: this.t, kind: 0 });
      if (hits.snare && react > 0.05) this.marks.push({ t: this.t, kind: 1 });
      this.marks = this.marks.filter((m) => this.t - m.t < 6);

      // ---- camera
      this.az += dt * P.orbit * 0.35 * (0.8 + 0.4 * e.pad);
      this.stretch = lerp(this.stretch, P.travel * (0.7 + 0.6 * e.bass * react), 1 - Math.exp(-2 * dt));
      const span = P.span;
      const el = lerp(0.05, 0.55, P.tilt);
      const ca = Math.cos(this.az), sa = Math.sin(this.az), ce = Math.cos(el), se = Math.sin(el);
      const D = 5.2;
      const F = ctx.height * 2.05;
      const cx = ctx.width / 2, cy = ctx.height * 0.54;
      // The sculpture trails off along -x (and a little back); aim a third of
      // the way down it so the head and the tail both stay in frame.
      const dir = [-0.92, 0, 0.38];
      const trailAt = (age) => { const d = age * this.stretch; return [dir[0] * d, 0.08 * Math.sin(age * 2.1) * d, dir[2] * d]; };
      const aim = trailAt(span * 0.3);
      const ground = 0.92;      // metres below the hips; MediaPipe's y is down
      // world (x, y down, z) -> screen, returns depth
      const project = (x, y, z, out, o) => {
        x -= aim[0]; y -= aim[1] + 0.05; z -= aim[2];
        const x1 = x * ca - z * sa, z1 = x * sa + z * ca;       // orbit about the vertical
        const y2 = y * ce - z1 * se, z2 = y * se + z1 * ce;      // tilt: camera above looks down
        const zz = D + z2;
        out[o] = cx + (x1 / zz) * F; out[o + 1] = cy + (y2 / zz) * F; out[o + 2] = zz;
      };

      // ---- sample the slices
      const S = this.slices, Pj = this.proj;
      for (let k = 0; k < NS; k++) {
        const age = (k / (NS - 1)) * span;
        const q = K.pose(age, { lm: S[k].lm, world: S[k].w });
        const off = trailAt(age);
        for (let j = 0; j < 33; j++) project(q.world[j * 3] + off[0], q.world[j * 3 + 1] + off[1], q.world[j * 3 + 2] + off[2], Pj, (k * 33 + j) * 3);
      }

      // ---- the studio floor, and every quad's shadow straight down on it
      const fl = new Float32Array(3), fr = new Float32Array(3);
      g.fillStyle = M.floor;
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        project(aim[0] + Math.cos(a) * 3.2, ground, aim[2] + Math.sin(a) * 3.2, fl, 0);
        if (i) g.lineTo(fl[0], fl[1]); else g.moveTo(fl[0], fl[1]);
      }
      g.fill();

      const bones = LIMB_BONES.slice();
      const bodyA = clamp(P.body, 0, 1);
      if (bodyA > 0.05) for (const b of BODY_BONES) bones.push(b);
      g.fillStyle = 'rgba(40,28,18,' + (M === MATERIALS[2] ? 0.35 : 0.12).toFixed(3) + ')';
      g.beginPath();
      const sp = new Float32Array(12);
      for (const [a, b] of bones) for (let k = 0; k < NS - 1; k += 2) {
        const k2 = Math.min(NS - 1, k + 2);
        const offA = trailAt((k / (NS - 1)) * span), offB = trailAt((k2 / (NS - 1)) * span);
        project(S[k].w[a * 3] + offA[0], ground, S[k].w[a * 3 + 2] + offA[2], sp, 0);
        project(S[k].w[b * 3] + offA[0], ground, S[k].w[b * 3 + 2] + offA[2], sp, 3);
        project(S[k2].w[b * 3] + offB[0], ground, S[k2].w[b * 3 + 2] + offB[2], sp, 6);
        project(S[k2].w[a * 3] + offB[0], ground, S[k2].w[a * 3 + 2] + offB[2], sp, 9);
        g.moveTo(sp[0], sp[1]); g.lineTo(sp[3], sp[4]); g.lineTo(sp[6], sp[7]); g.lineTo(sp[9], sp[10]); g.closePath();
      }
      g.fill();

      // ---- the ribbons: one quad per bone per pair of slices, lit, sorted
      const quads = [];
      const L1 = [-0.45, -0.75, -0.48], L2 = [0.7, -0.2, 0.68];   // key upper left front, fill right
      const markAt = (age) => {
        let best = null, bd = 1e9;
        for (const m of this.marks) { const d = Math.abs((this.t - m.t) - age); if (d < bd) { bd = d; best = m; } }
        return best && bd < span / (NS - 1) * 0.75 ? best : null;
      };
      for (let bi = 0; bi < bones.length; bi++) {
        const [a, b] = bones[bi];
        const isBody = bi >= LIMB_BONES.length;
        for (let k = 0; k < NS - 1; k++) {
          const ageA = (k / (NS - 1)) * span, ageB = ((k + 1) / (NS - 1)) * span;
          const offA = trailAt(ageA), offB = trailAt(ageB);
          const A0 = [S[k].w[a * 3] + offA[0], S[k].w[a * 3 + 1] + offA[1], S[k].w[a * 3 + 2] + offA[2]];
          const B0 = [S[k].w[b * 3] + offA[0], S[k].w[b * 3 + 1] + offA[1], S[k].w[b * 3 + 2] + offA[2]];
          const A1 = [S[k + 1].w[a * 3] + offB[0], S[k + 1].w[a * 3 + 1] + offB[1], S[k + 1].w[a * 3 + 2] + offB[2]];
          const u = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]], v = [A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]];
          let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / nl, n[1] / nl, n[2] / nl];
          // two-sided: face the light either way
          const d1 = Math.abs(n[0] * L1[0] + n[1] * L1[1] + n[2] * L1[2]), d2 = Math.abs(n[0] * L2[0] + n[1] * L2[1] + n[2] * L2[2]);
          const oa = (k * 33 + a) * 3, ob = (k * 33 + b) * 3, oa1 = ((k + 1) * 33 + a) * 3, ob1 = ((k + 1) * 33 + b) * 3;
          const depth = (Pj[oa + 2] + Pj[ob + 2] + Pj[oa1 + 2] + Pj[ob1 + 2]) / 4;
          const ageT = k / (NS - 2);
          const mk = markAt((ageA + ageB) / 2);
          let base = [lerp(M.a[0], M.b[0], ageT), lerp(M.a[1], M.b[1], ageT), lerp(M.a[2], M.b[2], ageT)];
          if (mk) {
            // a painted band is bright at the head and weathers as it rides back
            const kc = mk.kind === 0 ? M.k1 : M.k2, w = Math.exp(-(this.t - mk.t) / 1.1) * clamp(react, 0, 1.2);
            base = [lerp(base[0], kc[0], w), lerp(base[1], kc[1], w), lerp(base[2], kc[2], w)];
          }
          const light = 0.42 + 0.5 * d1 + 0.16 * d2;
          const fade = isBody ? bodyA : 1;
          quads.push({ depth, pts: [oa, ob, ob1, oa1], col: 'rgb(' + clamp(Math.round(base[0] * light), 0, 255) + ',' + clamp(Math.round(base[1] * light), 0, 255) + ',' + clamp(Math.round(base[2] * light), 0, 255) + ')', a: fade * (1 - 0.35 * ageT * ageT) });
        }
      }
      // the mannequin's rods and balls join the sort
      for (const [a, b] of ROD_BONES) {
        const oa = a * 3, ob = b * 3;
        quads.push({ depth: (Pj[oa + 2] + Pj[ob + 2]) / 2 - 0.01, rod: [oa, ob] });
      }
      for (const j of BALLS) quads.push({ depth: Pj[j * 3 + 2] - 0.02, ball: j * 3 });
      quads.sort((q1, q2) => q2.depth - q1.depth);

      const rodCol = 'rgb(' + M.rod.join(',') + ')';
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const q of quads) {
        if (q.pts) {
          const [i0, i1, i2, i3] = q.pts;
          g.globalAlpha = q.a;
          g.fillStyle = q.col; g.strokeStyle = q.col; g.lineWidth = 0.6;
          g.beginPath(); g.moveTo(Pj[i0], Pj[i0 + 1]); g.lineTo(Pj[i1], Pj[i1 + 1]); g.lineTo(Pj[i2], Pj[i2 + 1]); g.lineTo(Pj[i3], Pj[i3 + 1]); g.closePath();
          g.fill(); g.stroke();
        } else if (q.rod) {
          g.globalAlpha = 1;
          const [i0, i1] = q.rod;
          g.strokeStyle = rodCol; g.lineWidth = F * 0.022 / Pj[i0 + 2];
          g.beginPath(); g.moveTo(Pj[i0], Pj[i0 + 1]); g.lineTo(Pj[i1], Pj[i1 + 1]); g.stroke();
        } else {
          g.globalAlpha = 1;
          const i = q.ball, r = F * (q.ball === 0 ? 0.1 : 0.04) / Pj[i + 2];
          g.fillStyle = rodCol; g.beginPath(); g.arc(Pj[i], Pj[i + 1], r, 0, TAU); g.fill();
          // hats: a glint on the joint
          const gl = e.hat * clamp(react, 0, 1.5) * (((i / 3) * 7) % 3 === 0 ? 1 : 0.5);
          g.fillStyle = 'rgba(255,250,240,' + (0.25 + 0.75 * gl).toFixed(3) + ')';
          g.beginPath(); g.arc(Pj[i] - r * 0.35, Pj[i + 1] - r * 0.35, r * (0.22 + 0.25 * gl), 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;
      g.restore();
    },
  });
})();
