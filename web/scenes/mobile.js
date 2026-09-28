// Mobile — a Calder mobile turning in a white gallery.
//
// Flat painted leaves in red, black, yellow and blue on thin black wires,
// balanced arms hanging from threads, and the soft grey shadows they throw on
// the wall and the floor. The camera circles slowly; the mobile turns in the
// air current.
//
// Craft notes:
// - It is a real little 3D scene drawn in Canvas 2D: every arm is a node with
//   three damped oscillators (yaw on its thread, a seesaw pitch about its
//   balance point, and a pendulum sway of the thread), placed recursively down
//   the tree each frame and projected through one pinhole camera. Leaves are
//   planar polygons in 3D, so they foreshorten and go edge-on as they turn,
//   which is most of what makes a mobile beautiful to watch.
// - Shadows are the same world points projected from a lamp onto the wall
//   plane and the floor plane, drawn into a quarter-resolution canvas, blurred
//   once and laid over the room. Wall shadow and floor shadow of the same
//   shape are each drawn in full and clipped to their own surface on screen;
//   because a ray meets the floor first exactly when its wall hit is below the
//   skirting, the two halves meet correctly at the corner.
// - Music is handed to single arms, never to the frame: each kick taps one
//   arm (a seesaw dip with a strongly damped return, so it reads the same at
//   any tempo instead of pumping up a resonance), each clap sets a different
//   arm spinning, hats flip the small two-tone pendants at the bottom, the bass
//   is the air current, and the drop lowers two more mobiles from the ceiling
//   and switches on a second lamp, so every shape gets a second shadow.
// - No glow and no spectrum: matte flat paint, real shadows, a daylight room.

(function () {
  'use strict';

  const TAU = Math.PI * 2;

  // Ink slots: 0 red, 1 black, 2 yellow, 3 blue, 4 white.
  const INKS = [
    { name: 'Calder primaries', c: ['#c7261b', '#161616', '#eeb419', '#1c4a9e', '#f3efe6'] },
    { name: 'Black and red', c: ['#c42a1c', '#141414', '#141414', '#c42a1c', '#f1ede4'] },
    { name: 'Tate', c: ['#b4462a', '#1b1b1b', '#d59c2b', '#1f6e69', '#eee6d4'] },
    { name: 'Miró', c: ['#d8321f', '#111111', '#f0c31a', '#2d8a4a', '#2553a8'] },
  ];
  // wall, wallEdge, floor, floorNear, skirting, shadow colour, shadow strength
  const ROOMS = [
    { name: 'White gallery', wall: '#efece5', wallEdge: '#d5d0c6', pool: '#faf8f3', floor: '#c9c3b8', floorNear: '#a9a296', skirt: '#dedad2', shadow: '#2e3340', sAlpha: 0.34 },
    { name: 'Concrete', wall: '#c2beb6', wallEdge: '#a09b92', pool: '#dcd8cf', floor: '#8f8a81', floorNear: '#6f6a62', skirt: '#b0aca4', shadow: '#1f222a', sAlpha: 0.42 },
    { name: 'Night gallery', wall: '#2a2a2e', wallEdge: '#141417', pool: '#bdb6a6', floor: '#1d1c1e', floorNear: '#0f0f10', skirt: '#333236', shadow: '#050507', sAlpha: 0.62 },
  ];

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function col(c, k) {
    const r = Math.min(255, c[0] * k) | 0, g = Math.min(255, c[1] * k) | 0, b = Math.min(255, c[2] * k) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Cheap smooth noise from a few incommensurate sines: enough for air.
  function air(t, k) {
    return 0.5 * Math.sin(t * 0.37 + k * 1.7) + 0.3 * Math.sin(t * 0.83 + k * 4.1) + 0.2 * Math.sin(t * 1.91 + k * 2.3);
  }

  // A Calder leaf: a lumpy oval from a few low harmonics, normalised so its
  // longest radius is 1. Local x points away from the wire.
  function leafShape(r) {
    const n = 26, pts = [];
    const a1 = 0.1 + r() * 0.25, p1 = r() * TAU;
    const a2 = r() * 0.18, p2 = r() * TAU;
    const a3 = r() * 0.07, p3 = r() * TAU;
    const asp = 0.55 + r() * 0.45;
    let mx = 0;
    for (let i = 0; i < n; i++) {
      const f = (i / n) * TAU;
      let rr = 1 + a1 * Math.cos(f + p1) + a2 * Math.cos(2 * f + p2) + a3 * Math.cos(3 * f + p3);
      rr = Math.max(0.35, rr);
      const x = Math.cos(f) * rr, y = Math.sin(f) * rr * asp;
      pts.push([x, y]);
      mx = Math.max(mx, Math.hypot(x, y));
    }
    for (const q of pts) { q[0] /= mx; q[1] /= mx; }
    return pts;
  }

  // ---- mobile specs ------------------------------------------------------
  // An arm: len (m), piv (balance point as a fraction from the A end),
  // leaves at the ends (at 0 = A, 1 = B), kids hanging at fractions along it.
  // A leaf: ink, back ink (two-tone), size (m), roll (0 = vertical plane).
  function L(ink, size, roll, back) { return { ink, back: back === undefined ? ink : back, size, roll: roll || 0 }; }

  function mainSpec() {
    const confetti = {
      len: 0.52, piv: 0.5, tag: 'snare',
      leaves: [{ at: 0, leaf: L(1, 0.075, 0.2) }, { at: 1, leaf: L(0, 0.07, -0.3) }],
      pend: [
        { at: 0.18, thread: 0.14, leaf: L(2, 0.07, 0, 4) },
        { at: 0.42, thread: 0.22, leaf: L(0, 0.065, 0, 4) },
        { at: 0.64, thread: 0.12, leaf: L(3, 0.07, 0, 2) },
        { at: 0.84, thread: 0.19, leaf: L(4, 0.06, 0, 1) },
      ],
    };
    const a5 = { len: 0.62, piv: 0.62, leaves: [{ at: 0, leaf: L(0, 0.12, 0.1) }], kids: [{ at: 1, thread: 0.24, arm: confetti }] };
    const a4 = { len: 0.78, piv: 0.6, leaves: [{ at: 0, leaf: L(1, 0.15, -0.25) }], kids: [{ at: 1, thread: 0.26, arm: a5 }] };
    const a3 = { len: 0.95, piv: 0.6, tag: 'kick', leaves: [{ at: 0, leaf: L(3, 0.19, 0.15) }], kids: [{ at: 1, thread: 0.28, arm: a4 }] };
    const a2 = { len: 1.12, piv: 0.6, tag: 'kick', leaves: [{ at: 0, leaf: L(2, 0.22, 0.35) }], kids: [{ at: 1, thread: 0.3, arm: a3 }] };
    const a1 = { len: 1.3, piv: 0.61, tag: 'kick', leaves: [{ at: 0, leaf: L(0, 0.27, 0) }], kids: [{ at: 1, thread: 0.32, arm: a2 }] };
    const pair = {
      len: 0.72, piv: 0.45, tag: 'snare',
      leaves: [{ at: 0, leaf: L(4, 0.14, 1.2, 1) }, { at: 1, leaf: L(1, 0.12, -0.2) }],
      kids: [{ at: 0.2, thread: 0.3, arm: { len: 0.4, piv: 0.5, leaves: [{ at: 0, leaf: L(0, 0.07, 0) }, { at: 1, leaf: L(2, 0.08, 0.3) }] } }],
    };
    return {
      len: 2.0, piv: 0.56,
      leaves: [{ at: 0, leaf: L(1, 0.36, 0.05) }],
      kids: [{ at: 0.27, thread: 0.62, arm: pair }, { at: 1, thread: 0.36, arm: a1 }],
    };
  }

  // Smaller cascades for the drop, generated from a seed.
  function sideSpec(seed, inks, scale) {
    const r = rng(seed);
    let arm = {
      len: 0.4 * scale, piv: 0.5, leaves: [{ at: 0, leaf: L(inks[3], 0.06 * scale) }, { at: 1, leaf: L(inks[0], 0.055 * scale) }],
      pend: [{ at: 0.5, thread: 0.14 * scale, leaf: L(4, 0.045 * scale, 0, inks[1]) }],
    };
    let len = 0.55;
    for (let i = 0; i < 4; i++) {
      len += 0.22 + r() * 0.08;
      arm = {
        len: len * scale, piv: 0.58 + r() * 0.06, tag: i === 1 ? 'kick' : undefined,
        leaves: [{ at: 0, leaf: L(inks[(i + 1) % inks.length], (0.08 + i * 0.05) * scale, (r() - 0.5) * 0.9) }],
        kids: [{ at: 1, thread: (0.24 + r() * 0.1) * scale, arm }],
      };
    }
    return arm;
  }

  // Turn a spec into live nodes with physics state and leaf outlines.
  function build(spec, r, list, depth) {
    const a = {
      len: spec.len, piv: spec.piv, tag: spec.tag, depth,
      th: r() * TAU, thv: (r() - 0.5) * 0.2, ps: 0, psv: 0, sx: 0, sxv: 0, sz: 0, szv: 0,
      thread: 0.4, leaves: [], kids: [], pend: [], k: list.length,
    };
    list.push(a);
    for (const l of spec.leaves || []) a.leaves.push({ at: l.at, def: l.leaf, shape: leafShape(r), roll: 0, rollv: 0 });
    for (const p of spec.pend || []) {
      a.pend.push({ at: p.at, thread: p.thread, def: p.leaf, shape: leafShape(r), yaw: r() * TAU, yawv: 0, sx: 0, sxv: 0, sz: 0, szv: 0 });
    }
    for (const k of spec.kids || []) {
      const c = build(k.arm, r, list, depth + 1);
      c.thread = k.thread;
      a.kids.push({ at: k.at, arm: c });
    }
    return a;
  }

  function makeMobile(spec, seed, hang, topThread) {
    const list = [];
    const r = rng(seed);
    const root = build(spec, r, list, 0);
    root.thread = topThread;
    return {
      root, list, hang, drop: 0,
      kickArms: list.filter((a) => a.tag === 'kick'),
      snareArms: list.filter((a) => a.tag === 'snare'),
      pends: [].concat(...list.map((a) => a.pend)),
    };
  }

  // ---- vector helpers (arrays of 3) --------------------------------------
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  const WALL_Z = 2.3;       // the wall plane, behind the mobile
  const DROOP = 0.035;      // how much each wire arcs down at its ends (fraction of length)

  VIZ.register({
    id: 'mobile',
    name: 'Mobile',
    order: 402,

    params: [
      { key: 'inks', label: 'Paint', type: 'select', options: INKS.map((x) => x.name), default: 0 },
      { key: 'room', label: 'Room', type: 'select', options: ROOMS.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'wind', label: 'Air current', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'orbit', label: 'Camera orbit', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'shadow', label: 'Shadows', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'crowd', label: 'Mobiles in the drop', type: 'range', min: 0, max: 2, default: 2, step: 1 },
    ],

    actions: [],

    gallery: {
      title: 'Mobile',
      technique: 'Canvas 2D 3D scene: a tree of balanced arms, each with damped yaw, seesaw and pendulum-sway oscillators, projected through an orbiting pinhole camera; leaves are planar polygons that foreshorten as they turn; shadows are the same points projected from one or two lamps onto the wall and floor planes, drawn at quarter resolution, blurred once and clipped per surface',
      brief: 'A Calder mobile hanging in a white gallery: flat, matte painted leaves in red, black, yellow and blue on thin black wires, a cascade of balanced arms that turn on their threads and sway like pendulums, throwing soft grey shadows on the wall and the floor. The camera circles gently, so the shadows and leaves slide against each other in parallax, and leaves go edge-on and open again as they turn. Each kick taps one arm, which dips and rocks back (the only thing a kick moves); each clap sets a different arm spinning; hats flip the small two-tone pendants at the bottom; the bass is the air current that turns and swings everything. The drop lowers two more mobiles in from the ceiling and switches on a second lamp, so every shape casts a second shadow; the breakdown lifts them away and leaves one mobile turning in still air.',
      lineage: [
        'Brief 02 (batch 04): a Calder mobile in a white gallery, flat painted leaves in red, black, yellow and blue on black wires, real pendulum physics, soft grey shadows on wall and floor, a slowly circling camera; kick nudges one arm, snare spins another, bass is the air current, the drop adds a second mobile. Batch 04 leaves the dark-ground, glow and spectrum look behind: this is daylight, matte paint and real shadows.',
        'Approach: Canvas 2D rather than WebGL, because the subject is a few dozen flat polygons and thin lines that must stay crisp. A small 3D scene: a tree of arms, each with damped yaw, seesaw and thread-sway oscillators, placed recursively and projected through an orbiting pinhole camera. Leaves are planar polygons (lumpy ovals from three harmonics), so they foreshorten and go edge-on as they turn; a darker painted edge keeps an edge-on leaf a crisp line. Shadows are the same world points projected from a lamp onto the wall and floor planes, drawn at a third of the resolution, blurred once and clipped per surface.',
        'v1: worked first time as a picture, but the lamp was close (1.7x magnification) so the wall was covered in huge blurry grey blobs and fat wire shadows; the two drop mobiles hung beside the main one at the same depth and read as clutter. Jolt already calm: kickArea 0.077, ratio 2, the red leaf dipping was the one white hot spot.',
        'v2: lamps moved further away (1.3x), shadow blur and wire-shadow width cut, leaves 25% larger, kick tap stronger, hat pendants larger. The drop mobiles moved out of the main plane: one large in the foreground on the right (parallax against the orbit), one small near the wall on the left.',
        'v3: the foreground mobile first hung too high and central (its chain crossed the main one, its top arm cropped); moved right and down to (3.25, 3.7, -1.2) so it frames the right edge. The back-left one arrives later in the drop than the foreground one. Jolt: kickArea 0.09, kickMean 0.022, drift 0.010, ratio 2.1, calm; build kick 0.10. The hot spot is the kick arm\'s red leaf dipping; the rest of the heat is the ordinary turning, spread thin.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.orbitPhase = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.kickCount = 0;
      this.snareCount = 0;
      this.hatCount = 0;
      this.inkFor = -1;
      this.hitR = rng(77);
    },

    buildMobiles() {
      this.mobiles = [
        makeMobile(mainSpec(), 11, [0, 4.35, 0], 0.55),
        makeMobile(sideSpec(5, [2, 3, 1, 0], 1.05), 23, [3.25, 3.7, -1.2], 0.45),
        makeMobile(sideSpec(9, [3, 0, 2, 1], 0.75), 31, [-2.5, 4.05, 1.6], 0.5),
      ];
      this.mobiles[1].side = 1;
      this.mobiles[2].side = 2;
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kick = 0, snare = 0, hat = 0;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kick = kRaw; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.4 : 0.6, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snare = 0.6 + 0.4 * sRaw; }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hat = 0.5 + 0.5 * hRaw; }
      e.prevH = hRaw;

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 150), 1.6, dt);
      return { kick: kick * push, snare: snare * push, hat: hat * push };
    },

    // One physics step for every live mobile.
    step(dt, hits, wind) {
      const T = this.T, e = this.env;
      // Air: a slow baseline draught so the room is never still, plus the bass.
      const flow = wind * (0.18 + 1.1 * e.bass + 0.35 * e.drop);
      const wdir = 0.6 * Math.sin(T * 0.05) + 0.3;
      for (let mi = 0; mi < this.mobiles.length; mi++) {
        const m = this.mobiles[mi];
        if (m.side && m.drop < 0.001) continue;
        for (const a of m.list) {
          const k = a.k + mi * 20;
          const small = 1 / (0.4 + a.len);
          // Yaw: a thread has almost no torsional stiffness, so arms wander;
          // a weak spring keeps each near its own heading over minutes.
          const tq = flow * 0.22 * small * air(T * 0.7, k) + 0.02 * Math.sin(T * 0.11 + k);
          a.thv += (tq - 0.012 * wrapPi(a.th - k * 1.3) - 0.35 * a.thv) * dt;
          a.th += a.thv * dt;
          // Seesaw: stiff and well damped, so a tap reads as a dip and return.
          const pk = 44, pc = 5.2;
          a.psv += (-pk * a.ps - pc * a.psv + flow * 0.6 * air(T * 1.3, k + 7)) * dt;
          a.ps += a.psv * dt;
          // Thread sway: a real pendulum of the thread length.
          const w2 = 9.8 / Math.max(0.15, a.thread);
          const fx = flow * 0.9 * (Math.cos(wdir) * 0.5 + 0.5 * air(T * 0.9, k + 3));
          const fz = flow * 0.9 * (Math.sin(wdir) * 0.5 + 0.5 * air(T * 0.8, k + 11));
          a.sxv += (-w2 * a.sx - 0.7 * a.sxv + fx * small * 0.25) * dt;
          a.szv += (-w2 * a.sz - 0.7 * a.szv + fz * small * 0.25) * dt;
          a.sx += a.sxv * dt; a.sz += a.szv * dt;
          for (const l of a.leaves) {
            l.rollv += (-30 * l.roll - 3 * l.rollv) * dt;
            l.roll += l.rollv * dt;
          }
          for (const q of a.pend) {
            q.yawv += (flow * 0.8 * air(T * 1.1, k + q.at * 9) - 0.25 * q.yawv) * dt;
            q.yaw += q.yawv * dt;
            const pw = 9.8 / q.thread;
            q.sxv += (-pw * q.sx - 1.2 * q.sxv + flow * 0.3 * air(T * 1.7, k + q.at * 5)) * dt;
            q.szv += (-pw * q.sz - 1.2 * q.szv + flow * 0.3 * air(T * 1.5, k + q.at * 7)) * dt;
            q.sx += q.sxv * dt; q.sz += q.szv * dt;
          }
        }
      }
    },

    applyHits(hits) {
      const main = this.mobiles[0];
      if (hits.kick > 0) {
        // One arm carries the kick for eight bars, then it passes down the
        // cascade, so the room can learn which leaf is the drum.
        const arms = main.kickArms;
        const a = arms[Math.floor(this.kickCount / 32) % arms.length];
        a.psv += 4.2 * hits.kick;
        a.sxv += 0.25 * hits.kick * Math.cos(a.th);
        a.szv += 0.25 * hits.kick * Math.sin(a.th);
        // The drop's extra mobiles take the kick on their own arm too.
        for (let i = 1; i < this.mobiles.length; i++) {
          const m = this.mobiles[i];
          if (m.drop > 0.5 && m.kickArms.length && (this.kickCount % 2) === i - 1) m.kickArms[0].psv += 2.6 * hits.kick;
        }
        this.kickCount++;
      }
      if (hits.snare > 0) {
        const arms = main.snareArms;
        const a = arms[this.snareCount % arms.length];
        const dir = (Math.floor(this.snareCount / 2) % 2) ? 1 : -1;
        a.thv += dir * 5.5 * hits.snare;
        this.snareCount++;
      }
      if (hits.hat > 0) {
        // Flip one small two-tone pendant half a turn so its other face shows.
        const pool = [];
        for (const m of this.mobiles) if (!m.side || m.drop > 0.5) pool.push(...m.pends);
        const q = pool[Math.floor(this.hitR() * pool.length)];
        if (q) q.yawv += (this.hitR() < 0.5 ? -1 : 1) * 14 * hits.hat;
        this.hatCount++;
      }
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      this.T += dt;
      const T = this.T;
      const push = params.push;
      const inks = INKS[Math.max(0, Math.min(INKS.length - 1, Math.round(params.inks)))].c.map(hex);
      const room = ROOMS[Math.max(0, Math.min(ROOMS.length - 1, Math.round(params.room)))];
      if (!this.mobiles) this.buildMobiles();

      const hits = this.listen(signals, dt, push);
      const e = this.env;
      this.applyHits(hits);

      // The extra mobiles ride in on their threads: fully down a couple of
      // seconds into the drop, back up through the breakdown.
      const crowd = Math.round(params.crowd);
      for (let i = 1; i < this.mobiles.length; i++) {
        const m = this.mobiles[i];
        const want = crowd >= i ? smooth(0.15 + 0.15 * (i - 1), 0.55 + 0.2 * (i - 1), e.drop) : 0;
        m.drop = ease(m.drop, want, want > m.drop ? 1.6 : 0.9, dt);
      }

      const n = dt > 1 / 50 ? Math.ceil(dt * 120) : 2;
      for (let i = 0; i < n; i++) this.step(dt / n, hits, params.wind);

      // ---- camera: a slow orbit that the bass hurries, never jerks
      this.orbitPhase += dt * params.orbit * (0.045 + 0.03 * e.bass + 0.02 * e.drop);
      const yaw = 0.48 * Math.sin(this.orbitPhase) + 0.1 * Math.sin(this.orbitPhase * 0.37 + 1);
      const R = 5.4 - 0.25 * Math.sin(this.orbitPhase * 0.61);
      const cy = 1.55 + 0.18 * Math.sin(this.orbitPhase * 0.53 + 2);
      const C = [R * Math.sin(yaw), cy, -R * Math.cos(yaw)];
      const target = [0.15 * Math.sin(this.orbitPhase * 0.7), 2.45, 0.35];
      const f = norm(sub(target, C));
      const rt = norm([f[2], 0, -f[0]]);
      const up = cross(f, rt);
      const F = S * 1.0;
      const cx0 = W / 2, cy0 = H / 2;
      const proj = (q) => {
        const d = [q[0] - C[0], q[1] - C[1], q[2] - C[2]];
        const z = Math.max(0.05, dot(d, f));
        return [cx0 + F * dot(d, rt) / z, cy0 - F * dot(d, up) / z, z];
      };

      // ---- lamps: the key light high and front-left; the drop adds a second
      // from the right, so every shape throws a second, fainter shadow.
      const lamp1 = [-4.2 + 0.5 * Math.sin(T * 0.03), 8.0, -6.5];
      const lamp2 = [5.0, 6.5, -5.5];
      const l2 = clamp01(e.drop * 1.3 - 0.15) * (crowd > 0 ? 1 : 0.8);

      // ---- place every arm, leaf and pendant in the world
      const items = [];     // {z, kind, ...} for painter's sort
      const shapes = [];    // world outlines for the shadow pass: {pts, w (line width) or null}
      const threads = [];
      const place = (a, hang, mob) => {
        const P = [hang[0] + a.thread * Math.sin(a.sx), hang[1] - a.thread * Math.cos(a.sx) * Math.cos(a.sz), hang[2] + a.thread * Math.sin(a.sz)];
        threads.push([hang, P]);
        const cp = Math.cos(a.ps);
        const d = [cp * Math.cos(a.th), Math.sin(a.ps), cp * Math.sin(a.th)];
        const A = a.len * a.piv, B = a.len * (1 - a.piv);
        const at = (fr) => {
          const s = fr * a.len - A;
          const u = s < 0 ? s / A : s / B;
          const dr = DROOP * a.len * u * u;
          return [P[0] + d[0] * s, P[1] + d[1] * s - dr, P[2] + d[2] * s];
        };
        const wire = [];
        for (let i = 0; i <= 10; i++) wire.push(at(i / 10));
        items.push({ kind: 'wire', pts: wire, z: proj(P)[2] });
        shapes.push({ pts: wire, w: 0.012 });
        // horizontal perpendicular to the arm, and the arm's "up"
        const side = norm([-d[2], 0, d[0]]);
        const aup = cross(side, d);
        for (const l of a.leaves) {
          const out = l.at === 0 ? [-d[0], -d[1], -d[2]] : d;
          const end = at(l.at);
          const roll = l.def.roll + l.roll;
          const w = [aup[0] * Math.cos(roll) + side[0] * Math.sin(roll), aup[1] * Math.cos(roll) + side[1] * Math.sin(roll), aup[2] * Math.cos(roll) + side[2] * Math.sin(roll)];
          leafPoly(l, end, out, w, a.len);
        }
        for (const q of a.pend) {
          const top = at(q.at);
          const bot = [top[0] + q.thread * Math.sin(q.sx), top[1] - q.thread, top[2] + q.thread * Math.sin(q.sz)];
          threads.push([top, bot]);
          const out = [0, -1, 0];
          const w = [Math.cos(q.yaw), 0, Math.sin(q.yaw)];
          leafPoly(q, bot, out, w, 0);
        }
        for (const k of a.kids) place(k.arm, at(k.at), mob);
      };
      const leafPoly = (l, end, out, w, armLen) => {
        const r = l.def.size * 1.25;
        // Leaves sit just past the wire's tip, pinched onto it.
        const c = [end[0] + out[0] * r * 0.85, end[1] + out[1] * r * 0.85, end[2] + out[2] * r * 0.85];
        const pts = l.shape.map((q) => [c[0] + (out[0] * q[0] + w[0] * q[1]) * r, c[1] + (out[1] * q[0] + w[1] * q[1]) * r, c[2] + (out[2] * q[0] + w[2] * q[1]) * r]);
        const nrm = cross(out, w);
        const toCam = sub(C, c);
        const front = dot(nrm, toCam) >= 0;
        const toL = norm(sub(lamp1, c));
        const lam = Math.abs(dot(nrm, toL));
        const ink = front ? l.def.ink : l.def.back;
        items.push({ kind: 'leaf', pts, z: proj(c)[2], ink, lam, stub: [end, c] });
        shapes.push({ pts, w: null });
        shapes.push({ pts: [end, [c[0] - out[0] * r * 0.5, c[1] - out[1] * r * 0.5, c[2] - out[2] * r * 0.5]], w: 0.012 });
      };
      for (const m of this.mobiles) {
        if (m.side && m.drop < 0.002) continue;
        // Raised mobiles hang from further up, above the frame.
        const lift = m.side ? (1 - m.drop) * 3.6 : 0;
        place(m.root, [m.hang[0], m.hang[1] + lift, m.hang[2]], m);
        threads.push([[m.hang[0], 9, m.hang[2]], [m.hang[0], m.hang[1] + lift, m.hang[2]]]);
      }

      // ---- the room
      p.colorMode(p.RGB, 255);
      p.blendMode(p.BLEND);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.fillStyle = room.wall;
      g.fillRect(-2, -2, W + 4, H + 4);
      // The corner between wall and floor is one straight line on screen.
      const k1 = proj([-6, 0, WALL_Z]), k2 = proj([6, 0, WALL_Z]);
      const slope = (k2[1] - k1[1]) / (k2[0] - k1[0]);
      const yAt = (x) => k1[1] + (x - k1[0]) * slope;
      const cornerL = [-10, yAt(-10)], cornerR = [W + 10, yAt(W + 10)];
      // Wall light: a broad wash centred where the key lamp is aimed.
      const aim = proj([0.4, 2.3, WALL_Z]);
      const wash = g.createRadialGradient(aim[0], aim[1], 0, aim[0], aim[1], S * 1.05);
      wash.addColorStop(0, room.pool);
      wash.addColorStop(0.45, room.wall);
      wash.addColorStop(1, room.wallEdge);
      g.fillStyle = wash;
      g.fillRect(-2, -2, W + 4, H + 4);
      if (l2 > 0.01) {
        const aim2 = proj([-1.2, 2.0, WALL_Z]);
        const w2 = g.createRadialGradient(aim2[0], aim2[1], 0, aim2[0], aim2[1], S * 0.7);
        w2.addColorStop(0, room.pool);
        w2.addColorStop(1, room.pool.length === 7 ? room.pool + '00' : room.pool);
        g.globalAlpha = 0.55 * l2;
        g.fillStyle = w2;
        g.fillRect(-2, -2, W + 4, H + 4);
        g.globalAlpha = 1;
      }
      // Floor
      const floorPath = new Path2D();
      floorPath.moveTo(cornerL[0], cornerL[1]);
      floorPath.lineTo(cornerR[0], cornerR[1]);
      floorPath.lineTo(W + 10, H + 10);
      floorPath.lineTo(-10, H + 10);
      floorPath.closePath();
      const wallPath = new Path2D();
      wallPath.moveTo(cornerL[0], cornerL[1]);
      wallPath.lineTo(cornerR[0], cornerR[1]);
      wallPath.lineTo(W + 10, -10);
      wallPath.lineTo(-10, -10);
      wallPath.closePath();
      const cyMid = yAt(W / 2);
      const fg = g.createLinearGradient(0, cyMid, 0, H);
      fg.addColorStop(0, room.floor);
      fg.addColorStop(1, room.floorNear);
      g.fillStyle = fg;
      g.fill(floorPath);
      // A shallow skirting board and a breath of corner shade.
      g.strokeStyle = room.skirt;
      g.lineWidth = S * 0.012;
      g.beginPath(); g.moveTo(cornerL[0], cornerL[1] - S * 0.006); g.lineTo(cornerR[0], cornerR[1] - S * 0.006); g.stroke();

      // ---- shadows
      const shadowK = params.shadow;
      if (shadowK > 0.01) this.drawShadows(p, g, W, H, S, proj, shapes, lamp1, lamp2, l2, wallPath, floorPath, room, shadowK);

      // ---- the mobiles, back to front
      for (const t of threads) {
        const a = proj(t[0]), b = proj(t[1]);
        g.strokeStyle = 'rgba(40,40,40,0.55)';
        g.lineWidth = Math.max(0.35, F * 0.004 / ((a[2] + b[2]) / 2));
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      items.sort((a, b) => b.z - a.z);
      for (const it of items) {
        if (it.kind === 'wire') {
          g.strokeStyle = '#141414';
          g.lineWidth = Math.max(0.6, F * 0.012 / it.z);
          g.beginPath();
          for (let i = 0; i < it.pts.length; i++) {
            const q = proj(it.pts[i]);
            if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
          }
          g.stroke();
        } else {
          const a = proj(it.stub[0]), b = proj(it.stub[1]);
          g.strokeStyle = '#141414';
          g.lineWidth = Math.max(0.6, F * 0.012 / it.z);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
          const c = inks[it.ink];
          const tone = 0.8 + 0.2 * it.lam;
          g.fillStyle = col(c, tone);
          g.beginPath();
          for (let i = 0; i < it.pts.length; i++) {
            const q = proj(it.pts[i]);
            if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
          }
          g.closePath();
          g.fill();
          // The sheet's painted edge: keeps an edge-on leaf a crisp line.
          g.strokeStyle = col(c, tone * 0.72);
          g.lineWidth = Math.max(0.5, F * 0.006 / it.z);
          g.stroke();
        }
      }
    },

    drawShadows(p, g, W, H, S, proj, shapes, lamp1, lamp2, l2, wallPath, floorPath, room, shadowK) {
      const pd = p.pixelDensity();
      const sw = Math.max(64, Math.round(p.width * pd / 3)), sh = Math.max(36, Math.round(p.height * pd / 3));
      if (!this.shA) {
        this.shA = document.createElement('canvas');
        this.shB = document.createElement('canvas');
      }
      for (const c of [this.shA, this.shB]) if (c.width !== sw || c.height !== sh) { c.width = sw; c.height = sh; }
      const a = this.shA.getContext('2d'), b = this.shB.getContext('2d');
      const sc = sw / W;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, sw, sh);
      const lamps = [[lamp1, 1]];
      if (l2 > 0.01) lamps.push([lamp2, 0.75 * l2]);
      // Sharper with more "Shadows"; the wall is further from the leaves than
      // the thread is long, so it is always a little soft.
      const blurPx = Math.max(0.4, sw / 320 * (1.6 - 0.5 * Math.min(2, shadowK)));
      for (const [L, amt] of lamps) {
        a.setTransform(1, 0, 0, 1, 0, 0);
        a.clearRect(0, 0, sw, sh);
        a.setTransform(sc, 0, 0, sc, 0, 0);
        a.fillStyle = room.shadow;
        a.strokeStyle = room.shadow;
        a.lineJoin = 'round';
        a.lineCap = 'round';
        for (let surf = 0; surf < 2; surf++) {
          a.save();
          a.clip(surf === 0 ? wallPath : floorPath);
          for (const s of shapes) {
            a.beginPath();
            let zSum = 0, ok = true;
            for (let i = 0; i < s.pts.length; i++) {
              const q = s.pts[i];
              let t, hit;
              if (surf === 0) {
                t = (WALL_Z - L[2]) / (q[2] - L[2]);
                hit = [L[0] + (q[0] - L[0]) * t, L[1] + (q[1] - L[1]) * t, WALL_Z];
              } else {
                if (q[1] >= L[1] - 0.01) { ok = false; break; }
                t = (0 - L[1]) / (q[1] - L[1]);
                hit = [L[0] + (q[0] - L[0]) * t, 0, L[2] + (q[2] - L[2]) * t];
              }
              const pr = proj(hit);
              zSum += pr[2];
              if (i) a.lineTo(pr[0], pr[1]); else a.moveTo(pr[0], pr[1]);
            }
            if (!ok) continue;
            if (s.w) {
              a.lineWidth = Math.max(0.55 / sc, S * s.w / (zSum / s.pts.length));
              a.stroke();
            } else {
              a.closePath();
              a.fill();
            }
          }
          a.restore();
        }
        b.globalAlpha = amt;
        b.filter = 'blur(' + blurPx.toFixed(2) + 'px)';
        b.drawImage(this.shA, 0, 0);
        b.filter = 'none';
        b.globalAlpha = 1;
      }
      g.globalAlpha = clamp01(room.sAlpha * Math.min(1.6, shadowK));
      g.drawImage(this.shB, 0, 0, W, H);
      g.globalAlpha = 1;
    },
  });

  function wrapPi(x) {
    x = (x + Math.PI) % TAU;
    if (x < 0) x += TAU;
    return x - Math.PI;
  }
})();
