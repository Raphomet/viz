// Ophanim: a "biblically accurate angel" as an icon come alive.
//
// Ezekiel 1 and 10 (the wheels: "a wheel in the middle of a wheel", rims "full
// of eyes round about", fire and lightning going between them) and Isaiah 6
// (the seraph: six wings, two over the face, two over the feet, two to fly),
// painted in the triad of an illuminated manuscript: lapis ground sown with
// gold stars (the Scrovegni vault), gold-leaf wheels, vermilion wings, white
// fire. The aim is awe, not horror, so the eyes are icon eyes: almond, calm,
// gold-lidded, set in lapis enamel like inlay in the gold, and every one of
// them turns its iris toward the viewer.
//
// How it is drawn (Canvas 2D, no WebGL):
//   wheels  true 3D gimbal. Each ring is a cylindrical band (the rim's tread)
//           whose frame is its parent's frame times one more rotation about an
//           axis lying in the parent's plane, so the rings pivot inside one
//           another like an armillary sphere, joined by gold axles. The bands
//           are cut into quads and painter-sorted with the core fire and the
//           axles, so rings pass in front of and behind the fire and each
//           other. The outside of a band is gold leaf lit by a fixed key light
//           (Blinn highlight that slides round as it turns, per-tessera
//           variation like hammered leaf); the inside is vermilion lit by the
//           fire.
//   eyes    drawn in the band's own plane through a canvas affine transform
//           built from the projected tangent and axis at that point, so they
//           foreshorten with the rim and slide round the silhouette; the iris
//           is offset by the camera direction expressed in the eye's plane,
//           which is what makes every eye look at you.
//   wings   six (or two) fans of feathers in screen space behind the wheels,
//           frontal and symmetrical as in an icon: primaries, coverts, and a
//           row of marginal coverts each carrying an eye.
//   glory   a vesica mandorla of concentric lapis bands, gold rays from the
//           core, a white-gold fire of petal tongues at the centre.
//
// Music, each confined to one part of the being:
//   kick   one ring (round-robin) steps one eye-notch round its own axis, a
//          solemn ratchet, and that ring's eyes widen and its gold rims flare
//   snare  the wings beat once (a downstroke that recovers)
//   hats   lightning between two rings or out of the fire, sparks off its
//          ends, glints on the gold leaf, the vault's stars twinkle
//   bass   the fire at the centre swells
//   drop   every eye opens together, the wings spread wide, the wheels turn
//          faster and the rays lengthen and brighten, all inside the mandorla;
//          the breakdown folds the wings and the eyes grow drowsy
// Movement: the gimbal never stops turning on incommensurate periods; the
// whole being sways on a slow orbit, approaches and recedes over ~47 s; the
// rays wheel; gold dust rises through the foreground; the stars drift with
// parallax.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const vnoise = (x, seed) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i + seed * 101.3), hash(i + 1 + seed * 101.3), u);
  };
  const rgb = (c, m = 1) => 'rgb(' + clamp(c[0] * m, 0, 255) + ',' + clamp(c[1] * m, 0, 255) + ',' + clamp(c[2] * m, 0, 255) + ')';
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1) + ')';
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // 3x3 row-major rotation matrices.
  const mul = (A, B) => {
    const R = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return R;
  };
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const app = (M, x, y, z) => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };

  const PALETTES = [
    { name: 'Manuscript: lapis, gold, vermilion',
      bgIn: [22, 40, 112], bgOut: [4, 8, 30], star: [236, 190, 96],
      mandOut: [44, 84, 176], mandIn: [8, 16, 58], mandLine: [226, 180, 88],
      goldDk: [92, 56, 14], gold: [222, 170, 70], goldHi: [255, 238, 190],
      inner: [52, 92, 196], innerDk: [10, 18, 62],
      f1: [192, 44, 28], f1d: [112, 20, 16], f1t: [240, 128, 62], f2: [226, 96, 44], f3: [226, 176, 74],
      setting: [16, 36, 108], sclera: [246, 236, 212], iris: [44, 96, 200], irisDk: [14, 30, 92], pupil: [8, 10, 26],
      fireA: [255, 250, 236], fireB: [255, 204, 96], fireC: [232, 74, 30], fireM: [240, 128, 62], ray: [250, 200, 96], bolt: [255, 246, 214] },
    { name: 'White fire on night',
      bgIn: [20, 20, 30], bgOut: [2, 2, 5], star: [236, 222, 186],
      mandOut: [34, 34, 48], mandIn: [6, 6, 10], mandLine: [214, 196, 150],
      goldDk: [96, 82, 58], gold: [214, 196, 150], goldHi: [255, 252, 240],
      inner: [236, 206, 140], innerDk: [70, 58, 40],
      f1: [226, 220, 204], f1d: [120, 112, 96], f1t: [255, 252, 242], f2: [240, 232, 212], f3: [222, 198, 140],
      setting: [22, 20, 26], sclera: [250, 248, 240], iris: [176, 132, 58], irisDk: [86, 58, 20], pupil: [10, 8, 6],
      fireA: [255, 255, 255], fireB: [255, 236, 190], fireC: [220, 170, 90], fireM: [255, 246, 222], ray: [255, 240, 206], bolt: [255, 255, 255] },
    { name: 'Porphyry & lapis',
      bgIn: [84, 20, 60], bgOut: [16, 3, 16], star: [240, 196, 110],
      mandOut: [120, 36, 84], mandIn: [26, 6, 28], mandLine: [232, 186, 96],
      goldDk: [96, 58, 16], gold: [228, 176, 76], goldHi: [255, 240, 196],
      inner: [38, 84, 196], innerDk: [10, 20, 60],
      f1: [34, 74, 176], f1d: [14, 30, 88], f1t: [110, 170, 240], f2: [60, 110, 210], f3: [228, 176, 76],
      setting: [70, 14, 40], sclera: [246, 236, 212], iris: [30, 120, 110], irisDk: [10, 50, 46], pupil: [8, 10, 12],
      fireA: [255, 250, 236], fireB: [255, 204, 110], fireC: [226, 70, 60], fireM: [244, 132, 72], ray: [255, 214, 130], bolt: [255, 246, 220] },
  ];

  // Right-hand wings in units of U; angles in canvas degrees (0 right, -90
  // up). Each fan is its bone (root to wrist) plus feather directions at the
  // root and at the wrist, spread and folded. Upper wings arch over the head,
  // the flying pair reaches across a 16:9 stage, the lower pair covers the feet.
  const WINGS = {
    mid:   { root: [0.14, -0.02], boneS: -14, boneF: 10, boneLen: 0.75, dRoot: 58, dWrist: -10, lRoot: 0.55, lWrist: 1.55, n: 15, flap: 13 },
    lower: { root: [0.10, 0.18], boneS: 50, boneF: 78, boneLen: 0.40, dRoot: 22, dWrist: 96, lRoot: 0.42, lWrist: 0.9, n: 10, flap: 9 },
    upper: { root: [0.10, -0.18], boneS: -48, boneF: -78, boneLen: 0.42, dRoot: -8, dWrist: -96, lRoot: 0.42, lWrist: 0.95, n: 10, flap: 13 },
  };

  const almond = (g, w, h) => {
    g.moveTo(-w, 0);
    g.bezierCurveTo(-w * 0.45, -h * 1.3, w * 0.45, -h * 1.3, w, 0);
    g.bezierCurveTo(w * 0.45, h * 1.05, -w * 0.45, h * 1.05, -w, 0);
  };

  // An icon eye in local units (half-width 1, +y down). open 0..1, gaze in
  // the eye's plane, flare 0..1 from the kick.
  function drawEye(g, P, open, gx, gy, flare, lw, round, bare) {
    if (!bare) {
    g.beginPath();
    if (round) g.arc(0, 0, 1, 0, TAU); else almond(g, 1.3, 0.62);
    g.fillStyle = rgb(P.setting); g.fill();
    g.lineWidth = (round ? 0.12 : 0.1) * lw; g.strokeStyle = rgb(flare > 0.05 ? mixc(P.gold, P.goldHi, flare) : P.gold); g.stroke();
    if (round) { g.save(); g.scale(0.8, 0.8); drawEye(g, P, open, gx, gy, flare, lw / 0.8, false, true); g.restore(); return; }
    }
    if (open < 0.07) {
      g.beginPath(); g.moveTo(-0.95, -0.02); g.quadraticCurveTo(0, 0.3, 0.95, -0.02);
      g.lineWidth = 0.13 * lw; g.strokeStyle = rgb(P.goldHi); g.stroke();
      return;
    }
    const h = 0.6 * open;
    g.save();
    g.beginPath(); almond(g, 1, h);
    g.fillStyle = rgb(P.sclera); g.fill();
    g.clip();
    const ix = clamp(gx, -1, 1) * 0.4, iy = clamp(gy, -1, 1) * 0.18 + 0.03, r = 0.5;
    g.beginPath(); g.arc(ix, iy, r, 0, TAU); g.fillStyle = rgb(P.irisDk); g.fill();
    g.beginPath(); g.arc(ix, iy, r * 0.8, 0, TAU); g.fillStyle = rgb(P.iris, 1 + 0.35 * flare); g.fill();
    g.beginPath(); g.arc(ix, iy, r * 0.62, 0, TAU); g.lineWidth = 0.05 * lw; g.strokeStyle = rgb(P.goldHi); g.stroke();
    g.beginPath(); g.arc(ix, iy, r * (0.36 - 0.1 * flare), 0, TAU); g.fillStyle = rgb(P.pupil); g.fill();
    g.beginPath(); g.arc(ix - 0.14, iy - 0.14, 0.085 + 0.04 * flare, 0, TAU); g.fillStyle = '#fff'; g.fill();
    // the upper lid's shadow on the eyeball
    g.beginPath(); g.moveTo(-1, 0); g.bezierCurveTo(-0.45, -h * 1.3, 0.45, -h * 1.3, 1, 0);
    g.bezierCurveTo(0.45, -h * 0.85, -0.45, -h * 0.85, -1, 0);
    g.fillStyle = 'rgba(40,20,10,0.28)'; g.fill();
    g.restore();
    g.beginPath(); g.moveTo(-1, 0); g.bezierCurveTo(-0.45, -h * 1.3, 0.45, -h * 1.3, 1, 0);
    g.lineWidth = 0.14 * lw; g.strokeStyle = rgb(P.goldHi); g.stroke();
    g.beginPath(); g.moveTo(1, 0); g.bezierCurveTo(0.45, h * 1.05, -0.45, h * 1.05, -1, 0);
    g.lineWidth = 0.06 * lw; g.strokeStyle = rgb(P.gold); g.stroke();
  }

  function leaf(g, ax, ay, dx, dy, L, w, bend) {
    const nx = -dy, ny = dx, b = bend * L;
    const tx = ax + dx * L + nx * b * 0.6, ty = ay + dy * L + ny * b * 0.6;
    g.moveTo(ax, ay);
    g.bezierCurveTo(ax + dx * L * 0.3 + nx * (w + b * 0.2), ay + dy * L * 0.3 + ny * (w + b * 0.2),
      ax + dx * L * 0.85 + nx * (w * 0.9 + b * 0.6), ay + dy * L * 0.85 + ny * (w * 0.9 + b * 0.6), tx, ty);
    g.bezierCurveTo(ax + dx * L * 0.85 + nx * (-w * 0.7 + b * 0.6), ay + dy * L * 0.85 + ny * (-w * 0.7 + b * 0.6),
      ax + dx * L * 0.3 + nx * (-w + b * 0.2), ay + dy * L * 0.3 + ny * (-w + b * 0.2), ax, ay);
  }

  VIZ.register({
    id: 'ophanim',
    name: 'Ophanim',
    order: 605,
    gallery: {
      title: 'Ophanim',
      technique: 'Canvas 2D with hand-rolled perspective: a gimbal of cylindrical gold bands cut into quads and painter-sorted with the core fire and axles; icon eyes drawn in each band\'s plane through an affine transform built from the projected tangent and axis, irises offset by the camera direction so they all look at the viewer; six screen-space wings of layered feather leaves; vesica mandorla, gold rays and fire in additive light; onset detection per band.',
      brief: 'A biblically accurate angel as a Byzantine icon come alive: wheels within wheels of gold leaf turning on independent axes in true perspective, their rims set with calm almond eyes in lapis enamel that all turn to look at you, a white-gold fire at the centre, six vermilion wings full of eyes, all in a lapis mandorla under a vault of gold stars. Each kick ratchets one wheel round by one eye and widens its eyes; the snare beats the wings once; hats throw lightning between the wheels and sparks off the gold; the bass swells the fire. The drop opens every eye at once, spreads the wings and floods the mandorla with rays; the breakdown folds the wings and the eyes grow drowsy.',
      lineage: 'Raph\'s request (2026-09-28): "I\'d love to see something inspired by a \'biblically accurate angel\'." Descends from Ezekiel 1 and 10 (the wheels full of eyes, fire and lightning between them) and Isaiah 6 (six-winged seraphim), '
        + 'Byzantine icons (the Transfiguration\'s banded mandorla, chrysography: light drawn as fine gold lines), Giotto\'s Scrovegni vault of gold stars on lapis, and armillary spheres. '
        + 'Process: v1 set up the gimbal (each ring\'s frame is its parent\'s times one rotation about an axis in the parent\'s plane), the painter-sorted gold bands and eyes drawn along the rim; at 1280 the eyes lay sideways along vertical rims and read as wrong, so they became lapis roundels turned within the band plane until their long axis projects level, which keeps them upright like an icon\'s while still foreshortening in 3D; '
        + 'eyes were half-hidden by neighbouring quads until their sort depth was raised by their own radius. Additive rays and fire turned grey and magenta over lapis, so the rays became opaque gold chrysography lines and the fire painted crowns of vermilion, orange and gold with only its white heart added as light; the ring interiors moved from vermilion to lapis enamel so they stop merging with the wings. '
        + 'Jolt: first read kickArea 0.20 (drop kick alone 0.08, the clap kick 0.32 from the wing beat), then the beat was moved into the feather tips and lowered, giving kickArea 0.17, ratio 1.36, calm; the breakdown target was lowered so the wings fold and the eyes grow drowsy.',
    },

    params: [
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'rings', label: 'Wheels', type: 'range', min: 3, max: 6, step: 1, default: 4 },
      { key: 'eyes', label: 'Eyes per wheel', type: 'range', min: 6, max: 24, step: 1, default: 16 },
      { key: 'wings', label: 'Wings', type: 'select', options: ['Six wings', 'Two wings', 'No wings'], default: 0 },
      { key: 'turn', label: 'Turning speed', type: 'range', min: 0, max: 2.5, step: 0.01, default: 1 },
      { key: 'glory', label: 'Glory (rays and fire)', type: 'range', min: 0, max: 1.6, step: 0.01, default: 1 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
    ],

    enter() { this.reset(); },
    setup() { this.reset(); },

    reset() {
      this.prev = new Float32Array(9);
      this.lastT = null;
      this.lastKick = -10; this.kickCount = 0;
      this.lastSnare = -10; this.lastHat = -10; this.hatCount = 0;
      this.bassEnv = 0; this.low = 0; this.hatSlow = 0; this.energy = 0;
      this.dropOn = false; this.G = 0.1;
      this.ang = [0.3, 1.1, 2.0, 0.7, 2.6, 1.7];
      this.phi = [0, 0, 0, 0, 0, 0];
      this.phiT = [0, 0, 0, 0, 0, 0];
      this.flare = [0, 0, 0, 0, 0, 0];
      this.flap = 0; this.flapAmp = 0;
      this.bolts = []; this.sparks = []; this.glints = [];
      this.rayRot = 0; this.dustT = 0; this.orbit = 0;
      this.stars = [];
      for (let i = 0; i < 110; i++) this.stars.push({ x: hash(i * 3.1), y: hash(i * 7.7 + 1), s: 0.5 + hash(i * 5.3) * hash(i * 1.9) * 1.8, d: 0.3 + hash(i * 9.1) * 0.7, ph: hash(i * 2.3) * TAU });
      this.dust = [];
      for (let i = 0; i < 70; i++) this.dust.push({ x: hash(i * 4.3 + 9), y: hash(i * 6.1 + 3), s: 0.6 + hash(i * 8.7) * 1.6, v: 0.4 + hash(i * 2.9) * 0.9, ph: hash(i * 1.3) * TAU });
    },

    analyse(s, t, dt, nRings, eyes, react) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t;
        const r = this.kickCount % nRings;
        this.kickCount++;
        const n = Math.max(6, Math.round(eyes * (1 - r * 0.13)));
        this.phiT[r] += TAU / n * (r % 2 ? -1 : 1);
        this.flare[r] = Math.max(this.flare[r], clamp(b0 / 90, 0.5, 1) * clamp(react, 0, 1.5));
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t;
        this.flapAmp = clamp(b4 / 90, 0.4, 1) * react;
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t; this.hatCount++;
        const h = this.hatCount;
        const amp = clamp(bh / 85, 0.35, 1);
        if (hash(h * 1.37) < 0.3 + 0.5 * amp * Math.min(1, react)) {
          const a = Math.floor(hash(h * 2.1) * (nRings + 1)) - 1; // -1 = out of the fire
          const b = a < 0 ? Math.floor(hash(h * 4.4) * nRings) : (a + 1) % nRings;
          this.bolts.push({ t0: t, a, b, ta: hash(h * 3.3) * TAU, tb: hash(h * 5.9) * TAU, seed: h, amp });
          if (this.bolts.length > 6) this.bolts.shift();
        }
        const gl = 1 + Math.floor(hash(h * 7.3) * 2 * Math.min(1, react + 0.2));
        for (let i = 0; i < gl; i++) this.glints.push({ t0: t, r: Math.floor(hash(h * 11 + i) * nRings), th: hash(h * 13 + i * 3) * TAU, e: hash(h * 17 + i) < 0.5 ? 1 : -1 });
        if (this.glints.length > 24) this.glints.splice(0, this.glints.length - 24);
      }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.5, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.45));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.7);
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(0.6);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 380, 0, 1) - this.energy) * k(0.9);
      const kicking = t - this.lastKick < 0.9;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.25 || t - this.lastKick > 1.6)) this.dropOn = false;
      const target = this.dropOn ? 1 : clamp(0.06 + this.energy * 0.7, 0, 0.32);
      this.G += (target - this.G) * k(target > this.G ? 0.35 : 2.2);
      for (let r = 0; r < 6; r++) {
        this.flare[r] *= Math.exp(-dt / 0.35);
        this.phi[r] += (this.phiT[r] - this.phi[r]) * k(0.07);
      }
      // wing beat: fast downstroke, slower recovery
      this.flap += ((this.flapAmp > 0.01 ? 1 : 0) * this.flapAmp - this.flap) * k(0.05);
      if (this.flap > this.flapAmp * 0.92) this.flapAmp *= Math.exp(-dt / 0.06);
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const P = PALETTES[clamp(Math.round(params.palette) || 0, 0, PALETTES.length - 1)];
      const nRings = clamp(Math.round(params.rings), 3, 6);
      const eyes = clamp(Math.round(params.eyes), 6, 24);
      const react = params.react, glory = params.glory;
      this.analyse(signals, t, dt, nRings, eyes, react);
      const G = this.G;

      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const g = p.drawingContext;
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineJoin = 'round'; g.lineCap = 'round';

      // Slow continuous motion; the music changes its speed, never jerks it.
      const spd = params.turn * (0.45 + 1.4 * G);
      this.rayRot += dt * 0.05 * (0.5 + G);
      this.orbit += dt * 0.11 * (0.6 + 0.6 * G);
      this.dustT += dt * (0.5 + 0.9 * G);
      const approach = 1 + 0.07 * Math.sin(t * TAU / 47) + 0.05 * G;
      const U = S * 0.29 * approach;
      const cx = W / 2, cy = H / 2 + S * 0.01;
      const yaw = 0.42 * Math.sin(this.orbit * 0.4) + 0.2 * Math.sin(this.orbit * 0.13);
      const pitch = 0.3 + 0.22 * Math.sin(this.orbit * 0.29 + 1.3);

      // ---- ground: lapis with a vault of gold stars --------------------------
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.55);
      bg.addColorStop(0, rgb(P.bgIn)); bg.addColorStop(1, rgb(P.bgOut));
      g.fillStyle = bg; g.fillRect(-2, -2, W + 4, H + 4);
      g.fillStyle = rgb(P.star);
      for (let i = 0; i < this.stars.length; i++) {
        const st = this.stars[i];
        let x = ((st.x * 1.2 - 0.1 - yaw * 0.08 * st.d + this.orbit * 0.004 * st.d) % 1.2 + 1.2) % 1.2 - 0.1;
        const y = ((st.y - this.dustT * 0.004 * st.d) % 1 + 1) % 1;
        const tw = 0.45 + 0.35 * Math.sin(t * 0.9 + st.ph) + this.hatSlow * 0.8 * vnoise(t * 6 + i, i);
        const r = st.s * S / 600 * (1.6 + 1.2 * tw);
        g.globalAlpha = clamp(0.25 + 0.55 * tw, 0, 1) * st.d;
        const px = x * W, py = y * H;
        g.beginPath();
        for (let j = 0; j < 8; j++) {
          const a = j * TAU / 8, ro = j % 2 ? r * 0.42 : r;
          const a1 = a + TAU / 16;
          g.lineTo(px + Math.cos(a) * ro, py + Math.sin(a) * ro);
          g.lineTo(px + Math.cos(a1) * r * 0.3, py + Math.sin(a1) * r * 0.3);
        }
        g.fill();
      }
      g.globalAlpha = 1;

      // ---- mandorla: concentric lapis bands, gold between --------------------
      const mh = 3.05 * U, mw = 2.2 * U;
      const BANDS = 6;
      for (let b = 0; b < BANDS; b++) {
        const f = 1 - b * 0.13;
        const h2 = mh * f / 2, w2 = mw * f / 2;
        const d = (h2 * h2 - w2 * w2) / (2 * w2);
        const r = w2 + d, a = Math.atan2(h2, d);
        g.beginPath();
        g.arc(cx - d, cy, r, -a, a);
        g.arc(cx + d, cy, r, Math.PI - a, Math.PI + a);
        g.closePath();
        g.fillStyle = rgb(mixc(P.mandOut, P.mandIn, b / (BANDS - 1)));
        g.fill();
        g.lineWidth = S / 600 * (b === 0 ? 2.2 : 1);
        g.strokeStyle = rgba(P.mandLine, b === 0 ? 0.9 : 0.45);
        g.stroke();
      }

      // ---- rays of glory (behind the wings, inside the being's reach) --------
      // Chrysography: fine lines of gold radiating from the fire, as an icon
      // painter draws light, rather than a wash of glow.
      if (glory > 0.01) {
        const Rr = U * (1.2 + 1.1 * G) * (0.6 + 0.4 * glory);
        const NR = 96;
        const rg = g.createRadialGradient(cx, cy, U * 0.1, cx, cy, Rr);
        const ra = clamp((0.35 + 0.6 * G) * glory, 0, 1);
        rg.addColorStop(0, rgba(P.ray, ra)); rg.addColorStop(0.5, rgba(P.ray, ra * 0.7)); rg.addColorStop(1, rgba(P.ray, 0));
        g.strokeStyle = rg;
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath();
          for (let i = pass; i < NR; i += 2) {
            const a = this.rayRot * (pass ? -0.6 : 1) + i * TAU / NR;
            const L = Rr * (pass ? 0.55 + 0.2 * vnoise(t * 0.5 + i, 3) : 0.8 + 0.25 * vnoise(t * 0.4 + i * 3.7, 2));
            g.moveTo(cx + Math.cos(a) * U * 0.1, cy + Math.sin(a) * U * 0.1);
            g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
          }
          g.lineWidth = (pass ? 2.2 : 1.3) * S / 600;
          g.stroke();
        }
      }

      // ---- wings --------------------------------------------------------------
      const wingMode = Math.round(params.wings) || 0;
      if (wingMode < 2) {
        const spread = 0.35 + 0.65 * G;
        const fitX = clamp((W / 2) / (2.55 * U), 0.62, 1.12);
        const names = wingMode === 0 ? ['mid', 'lower', 'upper'] : ['mid'];
        const breath = Math.sin(t * 0.9) * 2.5;
        for (const nm of names) {
          for (const side of [1, -1]) {
            this.drawWing(g, P, WINGS[nm], nm, side, cx, cy, U, fitX * (1 + side * Math.sin(yaw) * 0.12), spread, this.flap, breath, t, G, react);
          }
        }
      }

      // ---- the wheels ---------------------------------------------------------
      const D = 4.2;
      const proj = (v) => { const kk = D / (D - v[2]); return [cx + v[0] * U * kk, cy - v[1] * U * kk, v[2]]; };
      const toCam = (v) => norm([-v[0], -v[1], D - v[2]]);
      const L = norm([-0.45, 0.62, 0.65]);
      const B = mul(rotY(yaw), rotX(pitch));
      const speeds = [0.11, -0.17, 0.23, -0.29, 0.34, -0.4];
      for (let r = 0; r < nRings; r++) this.ang[r] += dt * speeds[r] * spd;
      const fireLevel = clamp(0.25 + 0.55 * this.low + 0.45 * this.bassEnv, 0, 1.3);
      const frames = [];
      let F = mul(B, rotX(this.ang[0] + 1.2));
      frames.push(F);
      for (let r = 1; r < nRings; r++) {
        F = mul(F, r % 2 ? rotY(this.ang[r]) : rotX(this.ang[r]));
        frames.push(F);
      }
      const items = [];
      const ringR = (r) => 1 - r * 0.13;
      const ringW = (r) => 0.135 * (0.7 + 0.3 * ringR(r));
      const baseOpen = 0.08 + 0.92 * smooth(0.12, 0.9, G);
      const waveRing = Math.floor(t / 11) % nRings, waveT = t % 11;
      for (let r = 0; r < nRings; r++) {
        const Fm = frames[r], R = ringR(r), Wd = ringW(r);
        const M = Math.max(40, Math.round(84 * R));
        const top = [], bot = [];
        for (let i = 0; i <= M; i++) {
          const th = this.phi[r] + i * TAU / M, c = Math.cos(th) * R, s = Math.sin(th) * R;
          top.push(proj(app(Fm, c, s, Wd)));
          bot.push(proj(app(Fm, c, s, -Wd)));
        }
        const fl = this.flare[r];
        for (let i = 0; i < M; i++) {
          const th = this.phi[r] + (i + 0.5) * TAU / M;
          const n = app(Fm, Math.cos(th), Math.sin(th), 0);
          const mid = [n[0] * R, n[1] * R, n[2] * R];
          const v = toCam(mid);
          const facing = dot(n, v);
          let col, edge;
          const tess = 0.9 + 0.2 * hash(r * 997 + i * 13.1);
          if (facing >= 0) {
            const dif = Math.max(0, dot(n, L));
            const hv = norm([L[0] + v[0], L[1] + v[1], L[2] + v[2]]);
            const sp = Math.pow(Math.max(0, dot(n, hv)), 18);
            col = mixc(P.goldDk, P.gold, 0.25 + 0.75 * dif);
            col = mixc(col, P.goldHi, sp * 0.85);
            col = mixc(col, P.goldHi, 0.4 * fl).map((x) => x * tess);
            edge = mixc(P.gold, P.goldHi, 0.5 + 0.5 * fl);
          } else {
            const depthDim = 0.55 + 0.45 * smooth(-1, 0.3, mid[2]);
            col = mixc(P.innerDk, P.inner, clamp((0.35 + 0.55 * fireLevel) * depthDim, 0, 1)).map((x) => x * tess);
            edge = mixc(P.goldDk, P.gold, 0.6 + 0.4 * fl);
          }
          items.push({ z: mid[2], k: 0, a: top[i], b: top[i + 1], c: bot[i + 1], d: bot[i], col, edge, fl });
        }
        // eyes on the outer face
        const N = Math.max(6, Math.round(eyes * R));
        const spacing = TAU * R / N;
        const eu = Math.min(0.42 * spacing, 0.9 * Wd), ev = eu;
        for (let j = 0; j < N; j++) {
          const th = this.phi[r] + (j + 0.5) * TAU / N;
          const n = app(Fm, Math.cos(th), Math.sin(th), 0);
          const P0 = [n[0] * R, n[1] * R, n[2] * R];
          const c = toCam(P0);
          const facing = dot(n, c);
          if (facing < 0.1) continue;
          const T = app(Fm, -Math.sin(th), Math.cos(th), 0);
          const A = app(Fm, 0, 0, 1);
          const e = 0.01;
          const p0 = proj(P0);
          const pT = proj([P0[0] + T[0] * e, P0[1] + T[1] * e, P0[2] + T[2] * e]);
          const pA = proj([P0[0] + A[0] * e, P0[1] + A[1] * e, P0[2] + A[2] * e]);
          const sT = [(pT[0] - p0[0]) / e, (pT[1] - p0[1]) / e], sA = [(pA[0] - p0[0]) / e, (pA[1] - p0[1]) / e];
          // Turn the eye within the band's plane so its long axis projects
          // level: the eyes stay upright as the wheel turns, like an icon's,
          // instead of lying sideways along a vertical rim.
          const psi = Math.atan2(-sT[1], sA[1]);
          const cp = Math.cos(psi), sp = Math.sin(psi);
          let tx = [cp * sT[0] + sp * sA[0], cp * sT[1] + sp * sA[1]], ay = [-sp * sT[0] + cp * sA[0], -sp * sT[1] + cp * sA[1]];
          const Uw = [cp * T[0] + sp * A[0], cp * T[1] + sp * A[1], cp * T[2] + sp * A[2]];
          const Vw = [-sp * T[0] + cp * A[0], -sp * T[1] + cp * A[1], -sp * T[2] + cp * A[2]];
          let gx = dot(c, Uw), gy = dot(c, Vw);
          if (tx[0] < 0) { tx = [-tx[0], -tx[1]]; gx = -gx; }
          if (ay[1] < 0) { ay = [-ay[0], -ay[1]]; gy = -gy; }
          // slow blinks, plus a wave that runs round one ring every 11 s
          let blink = 1;
          const ph = hash(r * 100 + j * 7.3), per = 7 + 7 * hash(r * 31 + j * 3.1);
          const lb = (t + ph * per) % per;
          if (lb < 0.6) blink = Math.min(blink, 1 - Math.pow(Math.sin(Math.PI * lb / 0.6), 2));
          if (r === waveRing) {
            const lw = waveT - 1 - j * 0.1;
            if (lw > 0 && lw < 0.6) blink = Math.min(blink, 1 - Math.pow(Math.sin(Math.PI * lw / 0.6), 2));
          }
          const open = clamp(baseOpen + 0.45 * fl, 0, 1.05) * blink;
          items.push({ z: P0[2] + eu + 0.002, k: 1, p0, tx, ay, eu, ev, gx, gy, open, fl, alpha: smooth(0.1, 0.3, facing) });
        }
      }
      // axles joining each ring to its parent
      for (let r = 1; r < nRings; r++) {
        const Fp = frames[r - 1];
        const ax = r % 2 ? app(Fp, 0, 1, 0) : app(Fp, 1, 0, 0);
        for (const sg of [1, -1]) {
          const a = proj(ax.map((x) => x * ringR(r) * sg)), b = proj(ax.map((x) => x * ringR(r - 1) * sg));
          items.push({ z: (a[2] + b[2]) / 2 + 0.01, k: 2, a, b });
        }
      }
      items.push({ z: 0, k: 3 });
      items.sort((m, n) => m.z - n.z);

      const px = S / 600;
      for (const it of items) {
        if (it.k === 0) {
          g.beginPath();
          g.moveTo(it.a[0], it.a[1]); g.lineTo(it.b[0], it.b[1]); g.lineTo(it.c[0], it.c[1]); g.lineTo(it.d[0], it.d[1]); g.closePath();
          const cs = rgb(it.col);
          g.fillStyle = cs; g.fill();
          g.lineWidth = 0.8 * px; g.strokeStyle = cs; g.stroke();
          g.beginPath();
          g.moveTo(it.a[0], it.a[1]); g.lineTo(it.b[0], it.b[1]);
          g.moveTo(it.c[0], it.c[1]); g.lineTo(it.d[0], it.d[1]);
          g.lineWidth = (1.4 + 1.4 * it.fl) * px; g.strokeStyle = rgb(it.edge); g.stroke();
        } else if (it.k === 1) {
          g.save();
          g.globalAlpha = it.alpha;
          g.transform(it.tx[0] * it.eu, it.tx[1] * it.eu, it.ay[0] * it.ev, it.ay[1] * it.ev, it.p0[0], it.p0[1]);
          drawEye(g, P, it.open, it.gx, it.gy, it.fl, 1, true);
          g.restore();
        } else if (it.k === 2) {
          g.beginPath(); g.moveTo(it.a[0], it.a[1]); g.lineTo(it.b[0], it.b[1]);
          g.lineWidth = 3.2 * px; g.strokeStyle = rgb(P.goldDk); g.stroke();
          g.lineWidth = 1.4 * px; g.strokeStyle = rgb(P.gold); g.stroke();
          g.beginPath(); g.arc(it.b[0], it.b[1], 3.4 * px, 0, TAU); g.fillStyle = rgb(P.goldHi); g.fill();
        } else {
          this.drawFire(g, P, cx, cy, U, fireLevel, glory, t, G);
        }
      }

      // ---- lightning, sparks, glints ------------------------------------------
      g.globalCompositeOperation = 'lighter';
      const ringPoint = (r, th) => {
        if (r < 0) return [0, 0, 0];
        const R = ringR(r);
        return app(frames[r], Math.cos(th + this.phi[r]) * R, Math.sin(th + this.phi[r]) * R, 0);
      };
      this.bolts = this.bolts.filter((b) => t - b.t0 < 0.22);
      for (const b of this.bolts) {
        const age = (t - b.t0) / 0.22;
        const a = proj(ringPoint(b.a < nRings ? b.a : 0, b.ta)), c = proj(ringPoint(b.b < nRings ? b.b : 0, b.tb));
        const dx = c[0] - a[0], dy = c[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const pts = [];
        const NS = 14;
        for (let i = 0; i <= NS; i++) {
          const u = i / NS, env = Math.sin(Math.PI * u);
          const off = (hash(b.seed * 3.7 + i * 1.31 + Math.floor(t * 30) * 0.17) - 0.5) * len * 0.22 * env;
          pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
        }
        const al = (1 - age) * b.amp;
        for (const [w, aa] of [[5, 0.18], [2.2, 0.5], [1, 1]]) {
          g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
          g.lineWidth = w * px; g.strokeStyle = rgba(w > 2 ? P.ray : P.bolt, aa * al); g.stroke();
        }
        if (!b.sp) {
          b.sp = true;
          for (let i = 0; i < 7; i++) {
            const e = i % 2 ? c : a, an = hash(b.seed * 9 + i) * TAU, v = (40 + 90 * hash(b.seed * 5 + i * 2)) * px;
            this.sparks.push({ t0: t, x: e[0], y: e[1], vx: Math.cos(an) * v, vy: Math.sin(an) * v });
          }
          if (this.sparks.length > 60) this.sparks.splice(0, this.sparks.length - 60);
        }
      }
      this.sparks = this.sparks.filter((s) => t - s.t0 < 0.8);
      g.fillStyle = rgb(P.goldHi);
      for (const s of this.sparks) {
        const a = t - s.t0, f = 1 - a / 0.8;
        const x = s.x + s.vx * a, y = s.y + s.vy * a + 20 * px * a * a;
        g.globalAlpha = f;
        g.beginPath(); g.arc(x, y, 1.3 * px * (0.5 + f), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      this.glints = this.glints.filter((s) => t - s.t0 < 0.4);
      for (const s of this.glints) {
        if (s.r >= nRings) continue;
        const R = ringR(s.r), Wd = ringW(s.r);
        const n = app(frames[s.r], Math.cos(s.th + this.phi[s.r]), Math.sin(s.th + this.phi[s.r]), 0);
        const P0 = n.map((x) => x * R);
        if (dot(n, toCam(P0)) < 0) continue;
        const q = proj(app(frames[s.r], Math.cos(s.th + this.phi[s.r]) * R, Math.sin(s.th + this.phi[s.r]) * R, Wd * s.e));
        const a = (t - s.t0) / 0.4, f = Math.sin(Math.PI * Math.min(1, a * 1.6)) * (1 - a);
        const L2 = 11 * px * (0.4 + f);
        g.strokeStyle = rgba(P.bolt, f); g.lineWidth = 1.1 * px;
        g.beginPath();
        g.moveTo(q[0] - L2, q[1]); g.lineTo(q[0] + L2, q[1]);
        g.moveTo(q[0], q[1] - L2); g.lineTo(q[0], q[1] + L2);
        g.stroke();
        g.beginPath(); g.arc(q[0], q[1], 1.8 * px, 0, TAU); g.fillStyle = rgba(P.bolt, f); g.fill();
      }

      // ---- foreground: gold dust rising ---------------------------------------
      g.fillStyle = rgb(P.star);
      for (let i = 0; i < this.dust.length; i++) {
        const d = this.dust[i];
        const y = (((d.y - this.dustT * 0.03 * d.v) % 1) + 1) % 1;
        const x = d.x + 0.015 * Math.sin(t * 0.5 + d.ph) - yaw * 0.05 * d.v;
        g.globalAlpha = (0.25 + 0.35 * G) * smooth(0, 0.15, y) * smooth(1, 0.8, y);
        g.beginPath(); g.arc(x * W, y * H, d.s * px * (1 + d.v * 0.6), 0, TAU); g.fill();
      }
      g.restore();
    },

    // Painted fire, not a glow: additive light over lapis turns vermilion to
    // magenta, so the tongues are opaque crowns of vermilion, orange and gold
    // like icon flames, and only the white-hot heart is added as light.
    drawFire(g, P, cx, cy, U, lvl, glory, t, G) {
      const gl = Math.max(0.2, glory);
      const R = U * (0.26 + 0.24 * lvl) * (0.7 + 0.3 * gl);
      g.save();
      const crowns = [
        { n: 11, len: 1.5, w: 0.17, col: P.fireC, sp: 0.2, bend: 0.14 },
        { n: 9, len: 1.12, w: 0.16, col: P.fireM, sp: -0.3, bend: -0.12 },
        { n: 7, len: 0.78, w: 0.15, col: P.fireB, sp: 0.45, bend: 0.1 },
      ];
      crowns.forEach((c, layer) => {
        g.fillStyle = rgb(c.col);
        g.beginPath();
        for (let i = 0; i < c.n; i++) {
          const a = i * TAU / c.n + t * c.sp + layer * 0.4;
          const len = R * c.len * (0.72 + 0.5 * vnoise(t * 2.4 + i * 5.1, layer + 4));
          const dx = Math.cos(a), dy = Math.sin(a);
          leaf(g, cx, cy, dx, dy, len, R * c.w, c.bend);
        }
        g.fill();
      });
      g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
      rg.addColorStop(0, rgba(P.fireA, 1)); rg.addColorStop(0.35, rgba(P.fireB, 0.75)); rg.addColorStop(1, rgba(P.fireB, 0));
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cy, R * 0.9, 0, TAU); g.fill();
      g.restore();
    },

    drawWing(g, P, w, nm, side, cx, cy, U, fitX, spread, flap, breath, t, G, react) {
      g.save();
      g.translate(cx, cy);
      g.scale(side * fitX, 1);
      const px = 1 / Math.max(0.3, fitX);
      const fl = flap * w.flap;
      const bone = lerp(w.boneF, w.boneS, spread) + fl * 0.5 + breath * (nm === 'mid' ? 1 : 0.6);
      const fan = 0.5 + 0.5 * spread;
      const dR = (bone + (w.dRoot - w.boneS) * fan + fl * 0.4) * DEG;
      const dW = (bone + (w.dWrist - w.boneS) * fan + fl * 0.6) * DEG;
      const rx = w.root[0] * U, ry = w.root[1] * U;
      const bx = Math.cos(bone * DEG) * w.boneLen * U, by = Math.sin(bone * DEG) * w.boneLen * U;
      const n = w.n;
      const feathers = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const at = 0.12 + 0.88 * u;
        const d = lerp(dR, dW, Math.pow(u, 0.9));
        const ruffle = 1 + 0.035 * (vnoise(t * 0.8 + i * 3.1 + side * 7, 9) - 0.5);
        feathers.push({ ax: rx + bx * at, ay: ry + by * at, dx: Math.cos(d), dy: Math.sin(d), L: lerp(w.lRoot, w.lWrist, Math.pow(u, 0.7)) * U * ruffle, u });
      }
      const bend = (nm === 'upper' ? -0.06 : 0.06);
      // primaries
      for (const f of feathers) {
        const wd = U * 0.075 * (0.8 + 0.4 * f.u);
        g.beginPath(); leaf(g, f.ax, f.ay, f.dx, f.dy, f.L, wd, bend);
        g.fillStyle = rgb(P.f1); g.fill();
        g.lineWidth = 1.1 * px; g.strokeStyle = rgb(P.f1d); g.stroke();
        g.beginPath(); leaf(g, f.ax + f.dx * f.L * 0.55, f.ay + f.dy * f.L * 0.55, f.dx, f.dy, f.L * 0.45, wd * 0.55, bend);
        g.fillStyle = rgb(P.f1t); g.fill();
        g.beginPath(); g.moveTo(f.ax, f.ay); g.lineTo(f.ax + f.dx * f.L * 0.92, f.ay + f.dy * f.L * 0.92);
        g.lineWidth = 0.9 * px; g.strokeStyle = rgba(P.gold, 0.8); g.stroke();
      }
      // coverts
      for (let i = 1; i < n; i++) {
        const f = feathers[i];
        const wd = U * 0.085 * (0.8 + 0.4 * f.u);
        g.beginPath(); leaf(g, f.ax, f.ay, f.dx, f.dy, f.L * 0.5, wd, bend);
        g.fillStyle = rgb(P.f2); g.fill();
        g.lineWidth = 1 * px; g.strokeStyle = rgb(P.gold); g.stroke();
      }
      // marginal coverts, each with an eye
      const m = Math.round(n * 0.55);
      const eyeOpen = 0.08 + 0.92 * smooth(0.12, 0.9, G);
      for (let i = 0; i < m; i++) {
        const u = (i + 0.5) / m;
        const at = 0.1 + 0.9 * u;
        const d = lerp(dR, dW, Math.pow(u, 0.9));
        const dx = Math.cos(d), dy = Math.sin(d);
        const ax = rx + bx * at, ay = ry + by * at;
        const L2 = lerp(w.lRoot, w.lWrist, Math.pow(u, 0.7)) * U * 0.27;
        const wd = U * 0.075;
        g.beginPath(); leaf(g, ax, ay, dx, dy, L2, wd, 0);
        g.fillStyle = rgb(P.f3); g.fill();
        g.lineWidth = 1 * px; g.strokeStyle = rgb(P.goldDk); g.stroke();
        const ex = ax + dx * L2 * 0.5, ey = ay + dy * L2 * 0.5;
        let blink = 1;
        const ph = hash(i * 17.3 + side * 5 + nm.length * 3), per = 8 + 6 * hash(i * 2.7 + nm.length);
        const lb = (t + ph * per) % per;
        if (lb < 0.6) blink = 1 - Math.pow(Math.sin(Math.PI * lb / 0.6), 2);
        g.save();
        g.translate(ex, ey);
        const es = wd * 0.75;
        g.scale(es / fitX, es);
        drawEye(g, P, eyeOpen * blink, 0, 0, 0, 1);
        g.restore();
      }
      // the bone: a gold arm
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + bx, ry + by);
      g.lineWidth = 2.4 * px; g.strokeStyle = rgb(P.gold); g.stroke();
      g.restore();
    },
  });
})();
