// Cube: a machine-cube seen in true isometric, every face an instrument panel.
//
// The whole scene is drawn with one trick. An orthographic projection maps
// every plane affinely, so each face of the cube is an ordinary flat 2D panel
// (200 x 200 units, u right, v down) drawn through a canvas `transform` built
// from three projected corners. Anything that stands proud of a face (a
// button, a gasket, a lever) is drawn by re-issuing the same transform shifted
// along the face normal's screen vector, so layers at different heights show
// true parallax, and a cylinder's side is the round-capped stroke between its
// base circle and its lid. The cube can therefore turn on its turntable and
// every part stays correct, shaded by a light that is fixed in the room.
//
// Music, each on its own part (so the room can read the mix on the cube):
//   kick   the big orange plunger on the top deck slams down into its rubber
//          boot (the boot bulges) and springs back; the top is always in view
//   snare  panel A: a wave of six toggle switches flips down the row, their
//          lamps changing over; panel C: a tiny smith in his porthole brings
//          his hammer down on the anvil, sparks
//   hats   the ring of lamps round the plunger chases one lamp per hat;
//          bubbles rise in panel B's tank; keys on panel C's keypad depress;
//          panel D's paper tape gets a row punched
//   bass   the porthole fan on A spins up and its gasket swells; B's tank
//          sloshes and its valve wheel turns; D's tape reels run faster
//   pad    fills B's tank; steadies D's oscilloscope figure
//   drop   a radar mast telescopes out of the top deck and the dish sweeps;
//          C's hazard hatch swings open with weight and a speaker slides out
//          on its sled; A's louvres open on an orange chamber; B's pressure
//          gauge goes into the red. The breakdown retracts all of it.
// Movement: every so often the turntable makes a mechanical quarter turn to
// show the next face, settling with a little shudder of mass.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  // True isometric: the camera looks down at atan(1/sqrt 2) = 35.26 degrees.
  const ISO = Math.atan(1 / Math.SQRT2);
  const SA = Math.sin(ISO), CA = Math.cos(ISO);
  const S = 200;                   // panel units per face edge
  const K = 2 / S;                 // world units per panel unit (cube is 2 x 2 x 2)
  // Light fixed in the camera frame (x right, y up, z toward the viewer): from
  // the upper left and a little behind, so the left face is lit, the right in
  // shade, and the cast shadow falls forward to the right where it can be seen.
  const L = (() => { const v = [-0.62, 0.74, -0.16]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
  const AMB = 0.6, DIF = 0.44;

  const FINISHES = [
    { name: 'Braun white',
      bg: [226, 222, 214], grid: [204, 198, 188], body: [238, 235, 228], inset: [228, 224, 216], seam: [168, 163, 154],
      ink: [52, 50, 48], rubber: [48, 48, 50], metal: [200, 202, 204], metalDark: [118, 121, 125],
      accent: [240, 88, 30], lampOff: [96, 92, 86], lampHat: [255, 206, 96], lampGo: [132, 208, 104],
      glass: [34, 44, 48], interior: [26, 31, 33], liquid: [238, 128, 52], dial: [247, 244, 237],
      trace: [255, 168, 88], paper: [246, 240, 222], steam: [252, 251, 248], turn: [58, 58, 61], turnSide: [36, 36, 38], halo: 0.18 },
    { name: 'Enamel & brass',
      bg: [218, 206, 182], grid: [198, 184, 158], body: [48, 92, 77], inset: [41, 81, 67], seam: [22, 46, 38],
      ink: [22, 28, 25], rubber: [30, 30, 30], metal: [206, 166, 82], metalDark: [132, 100, 42],
      accent: [204, 54, 40], lampOff: [62, 54, 42], lampHat: [255, 216, 140], lampGo: [255, 190, 90],
      glass: [24, 32, 30], interior: [15, 20, 18], liquid: [222, 160, 52], dial: [242, 232, 206],
      trace: [255, 204, 110], paper: [240, 228, 198], steam: [248, 243, 230], turn: [96, 60, 40], turnSide: [64, 40, 26], halo: 0.18 },
    { name: 'Pastel works',
      bg: [208, 200, 222], grid: [190, 180, 207], body: [172, 216, 198], inset: [160, 206, 188], seam: [112, 152, 138],
      ink: [66, 60, 82], rubber: [88, 80, 106], metal: [246, 240, 230], metalDark: [172, 162, 152],
      accent: [243, 120, 96], lampOff: [124, 116, 134], lampHat: [255, 230, 120], lampGo: [255, 150, 130],
      glass: [60, 66, 94], interior: [46, 50, 74], liquid: [250, 196, 96], dial: [253, 250, 243],
      trace: [255, 230, 130], paper: [255, 248, 232], steam: [255, 253, 250], turn: [122, 112, 142], turnSide: [92, 84, 110], halo: 0.18 },
    { name: 'Night shift',
      bg: [24, 26, 31], grid: [36, 39, 46], body: [70, 75, 82], inset: [62, 67, 74], seam: [34, 36, 40],
      ink: [16, 17, 20], rubber: [22, 22, 24], metal: [150, 154, 160], metalDark: [84, 88, 94],
      accent: [255, 104, 36], lampOff: [44, 44, 46], lampHat: [255, 214, 150], lampGo: [120, 232, 150],
      glass: [16, 20, 24], interior: [10, 12, 14], liquid: [255, 132, 50], dial: [222, 216, 202],
      trace: [255, 170, 90], paper: [220, 212, 192], steam: [128, 131, 138], pool: [74, 76, 86], turn: [40, 41, 45], turnSide: [26, 27, 30], halo: 0.55 },
  ];

  const MAST_PORTS = [[26, 26], [174, 26], [174, 174], [26, 174]];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const mix = (c1, c2, u) => [lerp(c1[0], c2[0], u), lerp(c1[1], c2[1], u), lerp(c1[2], c2[2], u)];
  const css = (c, k = 1, a = 1) => {
    const r = clamp(Math.round(c[0] * k), 0, 255), g = clamp(Math.round(c[1] * k), 0, 255), b = clamp(Math.round(c[2] * k), 0, 255);
    return a >= 1 ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
  };
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function font(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }
  // A damped spring, integrated semi-implicitly: the mechanical parts that
  // have mass (hatch, mast, louvres, gauge needle) all move with one of these,
  // so they overshoot and settle instead of easing like UI.
  function spring(st, target, w, z, dt) {
    const n = Math.max(1, Math.ceil(dt * w / 0.4));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      st.v += (w * w * (target - st.x) - 2 * z * w * st.v) * h;
      st.x += st.v * h;
    }
    return st.x;
  }
  // A button hit at s seconds ago: down hard in 30 ms, then back up on a
  // spring that overshoots once above its rest.
  function press(s) {
    if (s < 0 || s > 0.9) return 0;
    if (s < 0.03) return s / 0.03;
    const r = s - 0.03;
    return Math.max(-0.18, Math.exp(-r / 0.075) * Math.cos(r * 19));
  }
  // A toggle lever flipping: across in ~40 ms with a bounce off the stop.
  function flip(s) {
    if (s <= 0) return 0;
    return 1 - Math.exp(-s / 0.03) * Math.cos(s * 34);
  }

  // ---- The camera and the face frames --------------------------------------

  function makeCam(cx, cy, sc, yaw, cubeYaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const cam = {
      rot(v) { return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c]; },
      P(x, y, z) {
        const xr = x * c - z * s, zr = x * s + z * c;
        return [cx + xr * sc, cy + (-y * CA + zr * SA) * sc];
      },
      // A point already in the camera frame (for shadows, cast along L).
      Pc(xr, y, zr) { return [cx + xr * sc, cy + (-y * CA + zr * SA) * sc]; },
      facing(v) { const r = cam.rot(v); return r[1] * SA + r[2] * CA; },
      depth(v) { const r = cam.rot(v); return r[1] * SA + r[2] * CA; },
      light(v) {
        const r = cam.rot(v); const m = Math.hypot(r[0], r[1], r[2]) || 1;
        return AMB + DIF * Math.max(0, (r[0] * L[0] + r[1] * L[1] + r[2] * L[2]) / m);
      },
      sc, cx, cy, yaw, cubeYaw,
    };
    return cam;
  }

  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  // A drawing frame for one plane: O is the panel's (0,0) corner, U and V its
  // edges (each S panel units long), n its outward normal (unit).
  function frame(cam, g, base, O, U, V, n) {
    const p0 = cam.P(O[0], O[1], O[2]);
    const pu = cam.P(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
    const pv = cam.P(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
    const pn = cam.P(O[0] + n[0] * K, O[1] + n[1] * K, O[2] + n[2] * K);
    const a = (pu[0] - p0[0]) / S, b = (pu[1] - p0[1]) / S;
    const c = (pv[0] - p0[0]) / S, d = (pv[1] - p0[1]) / S;
    const nx = pn[0] - p0[0], ny = pn[1] - p0[1];
    let det = a * d - b * c;
    if (Math.abs(det) < 1e-6) det = det < 0 ? -1e-6 : 1e-6;
    const uh = scl(U, 1 / Math.hypot(...U)), vh = scl(V, 1 / Math.hypot(...V));
    return {
      g, base, cam, O, U, V, n, uh, vh,
      a, b, c, d, e: p0[0], f: p0[1], nx, ny,
      du: (d * nx - c * ny) / det, dv: (-b * nx + a * ny) / det,
      px: 1 / Math.sqrt(Math.abs(det)),
      facing: cam.facing(n), shade: cam.light(n),
      fU: cam.facing(uh), fV: cam.facing(vh),
      lUp: cam.light(uh), lUm: cam.light(scl(uh, -1)), lVp: cam.light(vh), lVm: cam.light(scl(vh, -1)),
    };
  }
  // Set the canvas to draw in this panel's coordinates at height z.
  function at(F, z) {
    const g = F.g;
    g.setTransform(F.base);
    g.transform(F.a, F.b, F.c, F.d, F.e + F.nx * z, F.f + F.ny * z);
  }
  // A panel point at height z, in stage (virtual) coordinates.
  function pt(F, u, v, z) {
    return [F.e + F.a * u + F.c * v + F.nx * z, F.f + F.b * u + F.d * v + F.ny * z];
  }
  function screen(F) { F.g.setTransform(F.base); }
  // A world direction written in panel terms (du along U, dv along V, dz out).
  function dir(F, du, dv, dz) { return add(add(scl(F.uh, du), F.vh, dv), F.n, dz); }

  // ---- Primitives drawn in panel coordinates -------------------------------

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
  }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }

  // An upright cylinder (along the face normal) from z0 to z1.
  function cyl(F, x, y, r, z0, z1, top, side, ink) {
    const g = F.g;
    if (z1 - z0 > 0.02) {
      at(F, z0);
      g.strokeStyle = side; g.lineWidth = 2 * r; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + F.du * (z1 - z0), y + F.dv * (z1 - z0)); g.stroke();
    }
    at(F, z1);
    g.fillStyle = top; circ(g, x, y, r); g.fill();
    if (ink) { g.strokeStyle = ink; g.lineWidth = 0.8 * F.px; g.stroke(); }
  }
  // A box standing on the panel: walls that face the camera, then the lid.
  function box(F, x, y, w, h, z0, z1, rgb, lid, ink) {
    const g = F.g, dz = z1 - z0, ox = F.du * dz, oy = F.dv * dz;
    at(F, z0);
    const wall = (x1, y1, x2, y2, k) => {
      g.fillStyle = css(rgb, k * 0.93);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2 + ox, y2 + oy); g.lineTo(x1 + ox, y1 + oy); g.closePath(); g.fill();
    };
    if (dz > 0.02) {
      if (F.fU < 0) wall(x, y, x, y + h, F.lUm);
      if (F.fU > 0) wall(x + w, y, x + w, y + h, F.lUp);
      if (F.fV < 0) wall(x, y, x + w, y, F.lVm);
      if (F.fV > 0) wall(x, y + h, x + w, y + h, F.lVp);
    }
    at(F, z1);
    g.fillStyle = lid || css(rgb, F.shade);
    g.beginPath(); g.rect(x, y, w, h); g.fill();
    if (ink) { g.strokeStyle = ink; g.lineWidth = 0.8 * F.px; g.stroke(); }
  }
  function screw(F, x, y, r, z, P) {
    const g = F.g;
    cyl(F, x, y, r, z, z + 1.2, css(P.metal, F.shade), css(P.metalDark, F.shade));
    const a = hash(x * 3.1 + y * 7.7) * Math.PI;
    g.strokeStyle = css(P.metalDark, F.shade * 0.8); g.lineWidth = r * 0.35; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7); g.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); g.stroke();
  }
  // A panel lamp: metal bezel, domed lens, a specular dot. A lit lamp gets a
  // small halo only as big as a real lens would throw (bigger at night).
  function lamp(F, x, y, r, P, on, col, z) {
    const g = F.g;
    z = z || 0;
    cyl(F, x, y, r + 1.6, z, z + 1.4, css(P.metal, F.shade), css(P.metalDark, F.shade));
    at(F, z + 1.4);
    on = clamp(on, 0, 1);
    if (on > 0.02) {
      const hr = r * (2.2 + P.halo * 2);
      const gr = g.createRadialGradient(x, y, r * 0.5, x, y, hr);
      gr.addColorStop(0, css(col, 1, P.halo * on));
      gr.addColorStop(1, css(col, 1, 0));
      g.fillStyle = gr; circ(g, x, y, hr); g.fill();
    }
    const offc = css(P.lampOff, F.shade);
    g.fillStyle = on > 0.02 ? css(mix(mix(P.lampOff, [0, 0, 0], 0.1 - 0.1 * F.shade), col, 0.25 + 0.75 * on)) : offc;
    circ(g, x, y, r); g.fill();
    g.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.35 * on).toFixed(3) + ')';
    circ(g, x - r * 0.35, y - r * 0.38, r * 0.28); g.fill();
  }
  // A seven-segment digit in a w x h cell, slightly italic like the real thing.
  const SEG = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F];
  function digit(g, x, y, w, h, d, on, off) {
    const m = d < 0 ? 0 : SEG[d], t = w * 0.2, sk = 0.12;
    const segs = [
      [x + t * 0.6, y, w - t * 1.2, t, 0], [x + w - t, y + t * 0.6, t, h / 2 - t * 0.9, 1], [x + w - t, y + h / 2 + t * 0.3, t, h / 2 - t * 0.9, 1],
      [x + t * 0.6, y + h - t, w - t * 1.2, t, 0], [x, y + h / 2 + t * 0.3, t, h / 2 - t * 0.9, 1], [x, y + t * 0.6, t, h / 2 - t * 0.9, 1],
      [x + t * 0.6, y + h / 2 - t / 2, w - t * 1.2, t, 0],
    ];
    for (let i = 0; i < 7; i++) {
      const s = segs[i];
      g.fillStyle = (m >> i) & 1 ? on : off;
      const sx = s[0] + (y + h - s[1]) * sk;
      g.beginPath();
      g.moveTo(sx, s[1]); g.lineTo(sx + s[2], s[1]);
      g.lineTo(sx + s[2] - s[3] * sk, s[1] + s[3]); g.lineTo(sx - s[3] * sk, s[1] + s[3]); g.closePath(); g.fill();
    }
  }
  function label(F, txt, x, y, size, col, align) {
    const g = F.g;
    at(F, 0);
    g.font = '700 ' + size + 'px ' + font('Space Mono', 'monospace');
    g.textAlign = align || 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = col; g.fillText(txt, x, y);
  }
  // The enamel plate every panel sits on: body, inset panel, seam, screws.
  function plate(F, P, name) {
    const g = F.g, sh = F.shade;
    at(F, 0);
    g.fillStyle = css(P.body, sh); g.beginPath(); g.rect(0, 0, S, S); g.fill();
    rr(g, 7, 7, S - 14, S - 14, 6);
    g.fillStyle = css(P.inset, sh); g.fill();
    g.strokeStyle = css(P.seam, sh); g.lineWidth = 1.1 * F.px; g.stroke();
    g.strokeStyle = css(P.body, sh * 1.08, 0.8); g.lineWidth = 0.8 * F.px;
    rr(g, 8.2, 8.2, S - 16.4, S - 16.4, 5); g.stroke();
    for (const [x, y] of [[4.5, 4.5], [S - 4.5, 4.5], [4.5, S - 4.5], [S - 4.5, S - 4.5]]) screw(F, x, y, 2.4, 0, P);
    if (name) label(F, name, S - 12, S - 10, 5.2, css(P.seam, sh), 'right');
  }
  function edge(F, P) {
    const g = F.g;
    at(F, 0);
    g.strokeStyle = css(P.ink, 1, 0.9); g.lineWidth = 1.2 * F.px;
    g.beginPath(); g.rect(0, 0, S, S); g.stroke();
  }
  // Glass over a window: two soft diagonal reflections.
  function glass(F, clipPath, x, y, w, h) {
    const g = F.g;
    at(F, 0);
    g.save(); clipPath(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.moveTo(x + w * 0.15, y); g.lineTo(x + w * 0.42, y); g.lineTo(x, y + h * 0.5); g.lineTo(x, y + h * 0.22); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.beginPath(); g.moveTo(x + w * 0.55, y); g.lineTo(x + w * 0.62, y); g.lineTo(x + w * 0.1, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h * 0.96); g.closePath(); g.fill();
    g.restore();
  }

  // ---- The scene -------------------------------------------------------------

  VIZ.register({
    id: 'cube',
    name: 'Cube',
    order: 601,

    params: [
      { key: 'finish', label: 'Finish', type: 'select', options: FINISHES.map((f) => f.name), default: 0 },
      { key: 'rotation', label: 'Rotation', type: 'select', options: ['Quarter turns', 'Turntable', 'Still'], default: 0 },
      { key: 'turnEvery', label: 'Seconds per face', type: 'range', min: 6, max: 60, default: 16, step: 1 },
      { key: 'hatches', label: 'Hatches & mast', type: 'select', options: ['Open on the drop', 'Always open', 'Shut'], default: 0 },
      { key: 'travel', label: 'Mechanical travel', type: 'range', min: 0.3, max: 2, default: 1, step: 0.01 },
      { key: 'size', label: 'Cube size', type: 'range', min: 0.6, max: 1.25, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'turn', label: 'Turn to the next face', run() { this.turnRequest = true; } },
    ],

    gallery: {
      title: 'Cube',
      technique: 'Canvas 2D in true isometric (35.26 degree elevation, orthographic). Every face is a flat 200-unit instrument panel drawn through an affine canvas transform built from three projected corners; parts that stand proud of a face re-issue that transform shifted along the projected normal, so buttons, gaskets, levers, windows and recesses have real parallax, and a cylinder side is the round-capped stroke between its base and its lid. Shading from a light fixed in the room, a hard cast shadow on turntable and floor, damped springs for everything with mass, onset detection per band.',
      brief: 'A machine-cube on a turntable, drawn like an industrial-design illustration: Braun-white enamel with one orange (or bottle-green enamel and brass, pastel works, night shift). Each face is its own instrument panel and each answers a different part of the music, so a room can read the mix on the cube. The kick slams the big orange plunger on the top deck into its rubber boot, which squashes and bulges, and the cap lights from inside as it bottoms out; a ring of lamps round it chases one lamp per hat. Panel A: the bass spins the porthole fan and swells its gasket, the snare flips a wave of toggle switches down the row, a seven-segment readout counts bar and beat. Panel B: a tank of orange liquid sloshes with the bass, fills with the pad and takes a bubble per hat; a pressure gauge needle rides the mix on a spring; a valve wheel turns with the bass. Panel C: a tiny smith behind a porthole brings his hammer down on each snare, sparks; a keypad takes the hats. Panel D: tape reels run with the energy, an oscilloscope traces a Lissajous the pad steadies and the hats fray, a paper-tape punch logs every hat. The drop telescopes a radar mast out of the deck, swings the hazard hatch open with weight and slides a pumping speaker out on its sled, opens the louvres on an orange chamber and pegs the gauge; the breakdown stows it all and the stacks exhale slow smoke rings instead of the bar-by-bar puffs. Every sixteen seconds the turntable makes a mechanical quarter turn to show the next face, stowing the mast first and settling with a shudder of mass.',
      lineage: 'Raph\'s sketch (2026-09-28): "A cube-shaped machine with gaskets, windows, lights, and buttons on each side ... isometric ... on each facet the gaskets, windows etc. are reacting to music." Descends from Dieter Rams\' Braun panels, isometric toy and game illustration, and the machine interiors of Machinarium. Process: v1 established the affine-face engine and the four panels; the first jolt read (kickArea 0.016) was calm but too quiet, so the plunger travel was doubled and the cap made an illuminated button (kickArea 0.033, ratio 2, a clear hot spot on the plunger only). The cube was scaled up to fill the stage and exhaust stacks were added so each bar sends steam drifting across the empty sky, with smoke rings for the breakdown. After a 96-second run showed the quarter turns carrying the mast in front of the plunger and then off the top of the frame, the deck got a port in every corner and two stacks on opposite edges: the mast stows while the cube turns and rises from the left corner, steam leaves by the rear stack. The hatch waits while its face is turned to the back left, where the open door read only as a sliver.',
    },

    setup() { this.init(); },
    enter() { if (!this.prev) this.init(); },

    init() {
      this.prev = new Float32Array(9);
      this.lastT = null;
      this.lastKick = -10; this.kickAmp = 0; this.kickCount = 0;
      this.lastSnare = -10; this.snareCount = 0;
      this.lastHat = -10; this.hatCount = 0; this.hatTimes = [];
      this.bassEnv = 0; this.low = 0; this.pad = 0; this.hatSlow = 0; this.energy = 0;
      this.dropOn = false; this.dropAt = -10;
      this.hatch = { x: 0, v: 0 }; this.mast = { x: 0, v: 0 }; this.louvre = { x: 0, v: 0 };
      this.needle = { x: 0.1, v: 0 };
      this.level = 0.3; this.sloshPh = 0;
      this.fan = 0; this.wheel = 0; this.reel = 0; this.radar = 0; this.tape = 0; this.scopePh = 0; this.fanTop = 0;
      this.toggles = [0, 0, 0, 0, 0, 0].map(() => ({ state: 1, at: -10 }));
      this.pendingFlips = [];
      this.bubbles = [];
      this.keys = new Array(9).fill(-10);
      this.punches = [];
      this.sparks = [];
      this.puffs = []; this.puffKick = 0; this.lastRing = -10; this.mastPort = 0;
      this.yaw = 0; this.turnFrom = 0; this.turnStart = -10; this.turnEnd = 0; this.turning = false;
      this.turnRequest = false;
    },

    analyse(s, t, dt) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickAmp = clamp(b0 / 90, 0.55, 1.1); this.kickCount++;
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.1) {
        this.lastSnare = t; this.snareCount++;
        const dirn = this.snareCount % 2 ? -1 : 1;
        for (let i = 0; i < 6; i++) this.pendingFlips.push({ i, at: t + i * 0.03, state: dirn });
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI * (0.15 + 0.7 * hash(t * 13 + i)), sp = 30 + 50 * hash(t * 7 + i * 3);
          this.sparks.push({ t0: t, vx: Math.cos(a) * sp * (hash(i + t) < 0.5 ? -1 : 1), vy: Math.sin(a) * sp });
        }
        if (this.sparks.length > 40) this.sparks.splice(0, this.sparks.length - 40);
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t; this.hatCount++;
        this.hatTimes.push({ t, i: this.hatCount, a: clamp(bh / 85, 0.35, 1) });
        if (this.hatTimes.length > 20) this.hatTimes.shift();
        this.bubbles.push({ t0: t, x: 0.2 + 0.6 * hash(this.hatCount * 1.7), r: 1.6 + 2.2 * hash(this.hatCount * 3.3), w: hash(this.hatCount) * TAU });
        if (this.bubbles.length > 30) this.bubbles.shift();
        this.keys[Math.floor(hash(this.hatCount * 5.1) * 9)] = t;
        let bits = 0;
        for (let i = 0; i < 7; i++) if (s[i + 1] > 18 + 6 * i * 0.5 || hash(this.hatCount * 2.9 + i) < 0.18) bits |= 1 << i;
        this.punches.push({ at: this.tape, bits });
        if (this.punches.length > 60) this.punches.shift();
      }
      this.prev.set(s);
      const bass = Math.max(s[0] * 0.6, s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.05) : k(0.3));
      this.low += ((s[1] + s[2]) / 200 - this.low) * k(0.8);
      this.pad += ((s[2] + s[3]) / 200 - this.pad) * k(0.6);
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(0.8);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 380, 0, 1) - this.energy) * k(0.9);
      // The drop is the bass line under a running kick; hysteresis so one
      // quiet bar does not slam every hatch shut.
      const kicking = t - this.lastKick < 0.9;
      if (!this.dropOn && kicking && this.low > 0.3) { this.dropOn = true; this.dropAt = t; }
      else if (this.dropOn && (this.low < 0.25 || t - this.lastKick > 1.6)) { this.dropOn = false; this.dropAt = t; }
    },

    draw(p, signals, params, ctx) {
      if (!this.prev) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const P = FINISHES[clamp(Math.round(params.finish), 0, FINISHES.length - 1)];
      const travel = params.travel;
      const W = ctx.width, Hs = ctx.height;
      const g = p.drawingContext;

      this.analyse(signals, t, dt);

      // ---- mechanics
      const hm = Math.round(params.hatches);
      const open = hm === 1 ? 1 : hm === 2 ? 0 : this.dropOn ? 1 : 0;
      // The hatch is heavy: slow spring, low damping, and it bounces off its
      // frame when it slams shut.
      // Panel C's hatch opens only where it reads: facing us, or turned away
      // to the right where the open door stands out past the cube's edge. Seen
      // from the back left it is just a sliver above the deck, so it waits.
      const th = this.yaw + Math.PI / 4;
      const hatchShows = -Math.cos(th) > 0.02 || Math.sin(th) > 0.3;
      spring(this.hatch, hatchShows ? open : 0, 5.2, 0.42, dt);
      if (this.hatch.x < 0) { this.hatch.x = 0; this.hatch.v = -this.hatch.v * 0.3; }
      spring(this.mast, this.turning ? 0 : open, 3.6, 0.55, dt);
      if (this.mast.x < 0) { this.mast.x = 0; this.mast.v = 0; }
      spring(this.louvre, open, 7, 0.35, dt);
      const gaugeT = clamp(0.06 + 1.1 * this.low + 0.28 * (this.dropOn ? 1 : 0) + 0.12 * this.bassEnv + 0.04 * this.hatSlow, 0, 1.02);
      spring(this.needle, gaugeT, 8, 0.22, dt);
      this.level += (clamp(0.2 + 1.1 * this.pad + 0.12 * this.mast.x, 0.15, 0.86) - this.level) * (1 - Math.exp(-dt / 1.2));
      this.sloshPh += dt * (2.4 + 3 * this.bassEnv);
      this.fan += dt * (1.2 + 16 * this.bassEnv * travel + 5 * this.mast.x);
      this.fanTop += dt * (0.8 + 9 * this.bassEnv);
      this.wheel += dt * (0.15 + 1.6 * this.bassEnv);
      this.reel += dt * (0.8 + 3.2 * this.energy + 2.2 * this.mast.x);
      this.radar += dt * (0.9 + 0.8 * this.energy) * clamp(this.mast.x * 1.4, 0, 1);
      this.tape += dt * (4 + 16 * this.energy);
      this.scopePh += dt * (0.7 + 1.2 * this.pad);
      while (this.pendingFlips.length && this.pendingFlips[0].at <= t) {
        const f = this.pendingFlips.shift();
        const tg = this.toggles[f.i];
        if (tg.state !== f.state) { tg.state = f.state; tg.at = f.at; }
      }

      // ---- rotation
      const rm = Math.round(params.rotation);
      if (rm === 0) {
        if (!this.turning && (this.turnRequest || t - this.turnEnd > params.turnEvery)) {
          this.turning = true; this.turnStart = t; this.turnFrom = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
          this.turnRequest = false;
        }
        if (this.turning) {
          const u = (t - this.turnStart) / 2.6;
          if (u >= 1) { this.turning = false; this.turnEnd = t; this.yaw = this.turnFrom + Math.PI / 2; }
          else this.yaw = this.turnFrom + (Math.PI / 2) * smooth(u);
        }
      } else if (rm === 1) {
        this.yaw += dt * (0.1 + 0.16 * this.energy);
        this.turning = false; this.turnEnd = t;
      } else {
        const q = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
        this.yaw += (q - this.yaw) * (1 - Math.exp(-dt / 0.5));
        this.turnEnd = t; this.turnRequest = false;
      }
      // The turntable stops with mass: a small shudder after each quarter turn.
      let yaw = this.yaw;
      if (rm === 0 && !this.turning) {
        const s2 = t - this.turnEnd;
        if (s2 < 0.8 && this.turnEnd > 0.1) yaw += 0.035 * Math.exp(-s2 / 0.14) * Math.sin(s2 * 32);
      }

      // ---- layout: the cube body spans about 1.63 x its edge vertically
      const Hw = 134 * params.size;                     // half edge, virtual units
      const cx = W / 2, cy = Hs / 2 + 38 * params.size;
      const cam = makeCam(cx, cy, Hw, yaw + Math.PI / 4, yaw);
      const room = makeCam(cx, cy, Hw, Math.PI / 4, 0);

      g.save();
      const base = g.getTransform();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.lineJoin = 'round';

      // ---- the room: a matte floor with a faint isometric grid
      g.fillStyle = css(P.bg); g.fillRect(0, 0, W, Hs);
      const yF = -1.2;
      g.strokeStyle = css(P.grid); g.lineWidth = 0.7;
      g.beginPath();
      for (let i = -24; i <= 24; i++) {
        const a1 = room.P(i * 0.4, yF, -10), a2 = room.P(i * 0.4, yF, 10);
        const b1 = room.P(-10, yF, i * 0.4), b2 = room.P(10, yF, i * 0.4);
        g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]);
      }
      g.stroke();
      // A soft pool of light on the floor around the machine, and falloff to
      // the corners, so the ground reads as a room rather than a flat fill.
      // At night it is a work lamp's pool, or the plinth would vanish.
      {
        const c0 = room.P(0, yF, 0);
        g.save(); g.translate(c0[0], c0[1]); g.scale(1, SA * 1.2);
        if (P.pool) {
          const gp = g.createRadialGradient(0, 0, Hw * 0.5, 0, 0, Hw * 3.4);
          gp.addColorStop(0, css(P.pool)); gp.addColorStop(1, css(P.pool, 1, 0));
          g.fillStyle = gp; circ(g, 0, 0, Hw * 3.4); g.fill();
        }
        const R = Math.max(W, Hs) * 0.9;
        const gr = g.createRadialGradient(0, 0, Hw * 1.2, 0, 0, R);
        gr.addColorStop(0, css(P.bg, 1.04, 0.0));
        gr.addColorStop(1, 'rgba(0,0,0,0.16)');
        g.fillStyle = gr; g.fillRect(-R * 2, -R * 4, R * 4, R * 8);
        g.restore();
      }

      // ---- shadows (cast along L onto the floor, then onto the turntable)
      const RT = 1.45, yT = -1;
      const toCam = (x, y, z) => { const r = cam.rot([x, y, z]); return r; };
      const castTo = (r, y0) => { const k2 = (r[1] - y0) / L[1]; return [r[0] - L[0] * k2, y0, r[2] - L[2] * k2]; };
      const hull = (pts) => {
        pts = pts.slice().sort((A, B) => A[0] - B[0] || A[1] - B[1]);
        const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], up = [];
        for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
        for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
        return lo.slice(0, -1).concat(up.slice(0, -1));
      };
      const corners = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(toCam(x, y, z));
      const mastTop = 1 + 1.3 * clamp(this.mast.x, 0, 1.1);
      const mp = MAST_PORTS[this.mastPort], mpu = [-1 + mp[0] * K, -1 + mp[1] * K];
      const mastPt = toCam(mpu[0], mastTop, mpu[1]);
      const shadowOn = (y0) => {
        const pts = corners.map((r) => cam.Pc(...castTo(r, y0)));
        return hull(pts);
      };
      const shadowCol = 'rgba(20,16,12,0.22)';
      {
        const pts = shadowOn(yF);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          pts.push(cam.Pc(...castTo([Math.cos(a) * RT, yT, Math.sin(a) * RT], yF)));
        }
        const hp = hull(pts);
        g.fillStyle = shadowCol;
        g.beginPath(); hp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
        if (this.mast.x > 0.02) {
          const m0 = cam.Pc(...castTo(toCam(mpu[0], 1, mpu[1]), yF)), m1 = cam.Pc(...castTo(mastPt, yF));
          g.strokeStyle = shadowCol; g.lineWidth = 0.1 * Hw; g.lineCap = 'round';
          g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
        }
      }

      // ---- the turntable: a plinth whose top turns with the cube
      {
        const ct = cam.P(0, yT, 0), cb = cam.P(0, yF, 0);
        const rx = RT * Hw, ry = RT * Hw * SA;
        g.fillStyle = css(P.turnSide);
        g.beginPath();
        g.moveTo(ct[0] - rx, ct[1]); g.lineTo(cb[0] - rx, cb[1]);
        g.ellipse(cb[0], cb[1], rx, ry, 0, Math.PI, 0, true);
        g.lineTo(ct[0] + rx, ct[1]); g.closePath(); g.fill();
        // a lit band on the plinth's edge, the light catching its chamfer
        g.strokeStyle = css(P.turn, 1.25); g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(ct[0], ct[1] + 2.2, rx, ry, 0, 0, Math.PI); g.stroke();
        g.fillStyle = css(P.turn);
        g.beginPath(); g.ellipse(ct[0], ct[1], rx, ry, 0, 0, TAU); g.fill();
        g.strokeStyle = css(P.turn, 0.82); g.lineWidth = 0.8;
        for (const rr2 of [0.72, 0.84, 0.95]) { g.beginPath(); g.ellipse(ct[0], ct[1], rx * rr2, ry * rr2, 0, 0, TAU); g.stroke(); }
        // degree ticks on the rim turn with the table
        g.lineCap = 'butt';
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * TAU, big = i % 6 === 0;
          const r1 = RT * (big ? 0.965 : 0.98), r2 = RT * 0.998;
          const q1 = cam.P(Math.cos(a) * r1, yT, Math.sin(a) * r1), q2 = cam.P(Math.cos(a) * r2, yT, Math.sin(a) * r2);
          g.strokeStyle = i % 18 === 0 ? css(P.accent) : css(P.turn, big ? 2.2 : 1.7);
          g.lineWidth = big ? 1.4 : 0.8;
          g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
        }
        // the fixed pointer on the plinth that the ticks turn past
        const fp = room.P(0, yT, RT * 1.02);
        g.fillStyle = css(P.accent);
        g.beginPath(); g.moveTo(fp[0], fp[1] - 1); g.lineTo(fp[0] - 4, fp[1] + 6); g.lineTo(fp[0] + 4, fp[1] + 6); g.closePath(); g.fill();
        // the cube's shadow on the table top
        g.save();
        g.beginPath(); g.ellipse(ct[0], ct[1], rx, ry, 0, 0, TAU); g.clip();
        const sp = shadowOn(yT);
        g.fillStyle = 'rgba(10,8,6,0.3)';
        g.beginPath(); sp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
        g.restore();
      }

      // ---- the faces
      const up = [0, 1, 0];
      const sides = [
        { id: 'A', n: [0, 0, 1], draw: this.faceA },
        { id: 'B', n: [1, 0, 0], draw: this.faceB },
        { id: 'C', n: [0, 0, -1], draw: this.faceC },
        { id: 'D', n: [-1, 0, 0], draw: this.faceD },
      ];
      const frames = sides.map((sd) => {
        const n = sd.n, r = [n[2], 0, -n[0]];
        const O = add(add(n, r, -1), up, 1);
        return { sd, F: frame(cam, g, base, O, scl(r, 2), [0, -2, 0], n) };
      });
      const env = { t, P, travel, open: this.hatch.x, cam };
      // An open hatch on a face turned away still sticks out past the cube,
      // so it is drawn first, behind everything.
      const fc = frames[2];
      if (fc.F.facing <= 0.02 && this.hatch.x > 0.02) this.hatchDoor(fc.F, env, true);
      const vis = frames.filter((f) => f.F.facing > 0.02);
      vis.sort((a, b) => (a.sd.id === 'C' ? 1 : 0) - (b.sd.id === 'C' ? 1 : 0) || a.F.facing - b.F.facing);
      for (const f of vis) f.sd.draw.call(this, f.F, env);

      const top = frame(cam, g, base, [-1, 1, -1], [2, 0, 0], [0, 0, 2], up);
      this.faceTop(top, env);
      g.setTransform(base);
      this.drawPuffs(g, t, P);

      g.setTransform(base);
      g.restore();
    },

    // ---- Top deck: the kick plunger, the hat lamp ring, the radar mast ------
    faceTop(F, E) {
      const g = F.g, P = E.P, sh = F.shade, t = E.t;
      plate(F, P, 'MOD. 601 · DECK');
      // Two exhaust stacks on opposite corners: a puff every bar while the
      // kick runs, smoke rings when it stops (the breakdown exhales). Steam
      // leaves by whichever stack is at the back, so it never hides the plunger.
      const W2 = (u, v) => [-1 + u * K, 1, -1 + v * K];
      const stacks = [[100, 15], [100, 185]];
      for (const [chx, chy] of stacks) {
        cyl(F, chx, chy, 10.5, 0, 3, css(P.metal, sh), css(P.metalDark, sh), css(P.metalDark, sh));
        cyl(F, chx, chy, 7, 3, 24, css(P.metal, sh), css(P.metalDark, sh * 1.05));
        cyl(F, chx, chy, 9, 22, 27, css(P.rubber, sh * 1.2), css(P.rubber, sh * 0.9));
        at(F, 27); g.fillStyle = css(P.interior); circ(g, chx, chy, 5.6); g.fill();
      }
      {
        const back = E.cam.depth(W2(...stacks[0])) < E.cam.depth(W2(...stacks[1])) ? stacks[0] : stacks[1];
        const em = pt(F, back[0], back[1], 28);
        const bar1 = this.kickCount > 0 && this.kickCount % 4 === 1 && this.kickCount !== this.puffKick;
        if (bar1 && t - this.lastKick < 0.05) {
          this.puffKick = this.kickCount;
          this.puffs.push({ t0: t, x: em[0], y: em[1], ring: false, size: 16 + 14 * this.mast.x });
        } else if (t - this.lastKick > 1.5 && t - this.lastRing > 2.8) {
          this.lastRing = t;
          this.puffs.push({ t0: t, x: em[0], y: em[1], ring: true, size: 16 + 18 * clamp(this.pad * 2, 0, 1) });
        }
        while (this.puffs.length && t - this.puffs[0].t0 > 6) this.puffs.shift();
      }

      // --- kick plunger
      const cx = 100, cy = 100;
      const s = t - this.lastKick;
      const pr = press(s) * this.kickAmp * E.travel;
      cyl(F, cx, cy, 71, 0, 3, css(P.metal, sh), css(P.metalDark, sh), css(P.metalDark, sh * 0.9));
      at(F, 3);
      g.strokeStyle = css(P.metalDark, sh, 0.5); g.lineWidth = 0.8 * F.px;
      circ(g, cx, cy, 67.5); g.stroke();
      // hat lamps chase round the bezel
      const NL = 16;
      const lit = new Float32Array(NL);
      for (const h of this.hatTimes) {
        const age = t - h.t;
        if (age < 0.5) { const j = h.i % NL; lit[j] = Math.max(lit[j], h.a * Math.exp(-age / 0.16)); }
      }
      for (let i = 0; i < NL; i++) {
        const a = (i / NL) * TAU - Math.PI * 0.75;
        lamp(F, cx + Math.cos(a) * 61, cy + Math.sin(a) * 61, 4.6, P, lit[i], P.lampHat, 3);
      }
      // rubber boot: squashes lower and bulges wider as the plunger goes down
      const pd = clamp(pr, -0.2, 1.2);
      const bootH = 17 - 14 * pd, bootR = 48 + 6 * pd;
      cyl(F, cx, cy, bootR, 3, 3 + bootH, css(P.rubber, sh * 1.1), css(P.rubber, sh * 0.8));
      at(F, 3 + bootH);
      g.strokeStyle = css(P.rubber, sh * 1.45); g.lineWidth = 1.1 * F.px;
      for (const rr2 of [bootR - 3.5, bootR - 7]) { circ(g, cx, cy, rr2); g.stroke(); }
      const capZ0 = 3 + bootH, capZ1 = capZ0 + 12;
      // the cap is an illuminated button: it lights from inside as it bottoms out
      const glow = clamp(pd, 0, 1);
      const capCol = mix(P.accent, [255, 226, 170], 0.55 * glow);
      cyl(F, cx, cy, 40, capZ0, capZ1, css(capCol, lerp(sh, 1.05, glow)), css(P.accent, sh * 0.72), css(mix(P.accent, P.ink, 0.5), sh));
      at(F, capZ1);
      if (glow > 0.02) {
        const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 37);
        gr.addColorStop(0, css([255, 244, 214], 1, 0.85 * glow)); gr.addColorStop(1, css([255, 244, 214], 1, 0));
        g.fillStyle = gr; circ(g, cx, cy, 37); g.fill();
      }
      g.strokeStyle = css(P.accent, sh * 0.8); g.lineWidth = 1.6 * F.px;
      circ(g, cx, cy, 31); g.stroke();
      g.fillStyle = css(mix(P.accent, [255, 255, 255], 0.35), sh, 0.55);
      g.beginPath(); g.arc(cx, cy, 36, Math.PI * 1.05, Math.PI * 1.55); g.arc(cx, cy, 30.5, Math.PI * 1.55, Math.PI * 1.05, true); g.closePath(); g.fill();

      // --- radar mast (the drop)
      // A mast port in every corner. The mast is stowed while the cube turns
      // and rises from whichever corner is on the left: at the back it would
      // leave the frame, at the front its dish would stand over the plunger.
      const m = clamp(this.mast.x, 0, 1.12);
      const ports = MAST_PORTS;
      if (m < 0.005) {
        let best = 0, bx = Infinity;
        for (let i = 0; i < 4; i++) { const x = E.cam.rot(W2(...ports[i]))[0]; if (x < bx) { bx = x; best = i; } }
        this.mastPort = best;
      }
      for (let i = 0; i < 4; i++) {
        const [qx, qy] = ports[i];
        cyl(F, qx, qy, 16, 0, 2.5, css(P.metal, sh), css(P.metalDark, sh), css(P.metalDark, sh));
        at(F, 2.5);
        g.fillStyle = css(P.interior); circ(g, qx, qy, 12.5); g.fill();
        // the lid slides out of the way first, toward the nearer edge
        const lid = i === this.mastPort ? clamp(m * 3, 0, 1) : 0;
        const lx = qx + (qx > 100 ? 18 : -18) * lid;
        box(F, lx - 11.5, qy - 11.5, 23, 23, 2.5, 4, P.body, null, css(P.seam, sh));
      }
      const [mx, my] = ports[this.mastPort];
      if (m > 0.02) {
        const hMax = 125 * m;
        const segs = [[11, 0, 0.45], [8.5, 0.35, 0.75], [6, 0.7, 1]];
        let hTop = 2.5;
        for (const [r, a0, a1] of segs) {
          const hz = 2.5 + hMax * a1;
          cyl(F, mx, my, r, 2.5 + hMax * a0, hz, css(P.metal, sh), css(P.metalDark, sh * 1.1));
          hTop = hz;
        }
        // the dish: a shallow disc on a tilted yoke, sweeping round
        const ang = this.radar * 1.6, tilt = 0.45;
        const nd = [Math.cos(ang) * Math.cos(tilt), Math.sin(ang) * Math.cos(tilt), Math.sin(tilt)];
        const a1 = [-Math.sin(ang), Math.cos(ang), 0];
        const b1 = [nd[1] * a1[2] - nd[2] * a1[1], nd[2] * a1[0] - nd[0] * a1[2], nd[0] * a1[1] - nd[1] * a1[0]];
        const R = 34 * clamp(m * 1.3, 0, 1);
        const c0 = [mx, my, hTop + 6];
        const toW = (v) => [F.uh[0] * v[0] + F.vh[0] * v[1] + F.n[0] * v[2], F.uh[1] * v[0] + F.vh[1] * v[1] + F.n[1] * v[2], F.uh[2] * v[0] + F.vh[2] * v[1] + F.n[2] * v[2]];
        const front = E.cam.facing(toW(nd)) > 0;
        const lightD = E.cam.light(toW(front ? nd : scl(nd, -1)));
        screen(F);
        const rim = [];
        for (let i = 0; i < 28; i++) {
          const q = (i / 28) * TAU, cq = Math.cos(q) * R, sq = Math.sin(q) * R;
          rim.push(pt(F, c0[0] + a1[0] * cq + b1[0] * sq, c0[1] + a1[1] * cq + b1[1] * sq, c0[2] + a1[2] * cq + b1[2] * sq));
        }
        const ctr = pt(F, c0[0] - nd[0] * 6, c0[1] - nd[1] * 6, c0[2] - nd[2] * 6);
        const feed = pt(F, c0[0] + nd[0] * 16, c0[1] + nd[1] * 16, c0[2] + nd[2] * 16);
        const pc = pt(F, mx, my, hTop);
        g.strokeStyle = css(P.metalDark, sh); g.lineWidth = 2.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(pc[0], pc[1]); g.lineTo(ctr[0], ctr[1]); g.stroke();
        const drawFeed = () => {
          g.strokeStyle = css(P.ink, 1); g.lineWidth = 1.1;
          g.beginPath(); g.moveTo(ctr[0], ctr[1]); g.lineTo(feed[0], feed[1]); g.stroke();
          g.fillStyle = css(P.accent); circ(g, feed[0], feed[1], 2.2); g.fill();
        };
        if (!front) drawFeed();
        g.fillStyle = css(front ? P.metal : P.body, lightD);
        g.beginPath(); rim.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
        g.strokeStyle = css(P.metalDark, lightD); g.lineWidth = 1; g.stroke();
        // concentric ribs on the dish face
        if (front) {
          g.strokeStyle = css(P.metalDark, lightD, 0.5); g.lineWidth = 0.6;
          for (const f of [0.35, 0.68]) {
            g.beginPath();
            for (let i = 0; i <= 28; i++) {
              const q = rim[i % 28];
              const x = ctr[0] + (q[0] - ctr[0]) * f, y = ctr[1] + (q[1] - ctr[1]) * f;
              i ? g.lineTo(x, y) : g.moveTo(x, y);
            }
            g.stroke();
          }
          drawFeed();
        }
        // a beacon lamp on the mast collar, turning with the dish
        const bp = pt(F, mx, my, hTop);
        const on = 0.5 + 0.5 * Math.cos(this.radar * 3.2);
        g.fillStyle = css(mix(P.lampOff, P.accent, on)); circ(g, bp[0], bp[1] - 2, 2.6); g.fill();
      }
      edge(F, P);
    },

    // Steam, drawn flat in the stage: matte cartoon puffs with a shaded
    // underside, and the breakdown's smoke rings, drifting up and away.
    drawPuffs(g, t, P) {
      for (const pf of this.puffs) {
        const a = t - pf.t0;
        if (a < 0) continue;
        if (!pf.ring) {
          const life = 5.5;
          if (a > life) continue;
          const al = Math.pow(1 - a / life, 1.5) * 0.95;
          const grow = 0.3 + 0.7 * (1 - Math.exp(-a * 1.6));
          const x = pf.x + 22 * a + 5 * a * a, y = pf.y - 30 * a - 3 * a * a;
          const r = pf.size * grow * (1 + a * 0.4);
          const lobes = [[0, 0, 1], [-0.62, 0.28, 0.72], [0.66, 0.22, 0.78], [0.1, -0.5, 0.7]];
          g.fillStyle = css(P.steam, 0.84, al);
          for (const [ox, oy, k] of lobes) { circ(g, x + ox * r + r * 0.12, y + oy * r + r * 0.16, r * k); g.fill(); }
          g.fillStyle = css(P.steam, 1, al);
          for (const [ox, oy, k] of lobes) { circ(g, x + ox * r, y + oy * r, r * k * 0.94); g.fill(); }
        } else {
          const life = 6;
          if (a > life) continue;
          const al = Math.pow(1 - a / life, 1.2) * 0.95 * Math.min(1, a * 4);
          const r = pf.size * (0.4 + 0.6 * (1 - Math.exp(-a * 0.8))) * (1 + a * 0.18);
          const x = pf.x + 10 * a, y = pf.y - 18 * a - 2 * a * a;
          g.lineWidth = r * 0.4;
          g.strokeStyle = css(P.steam, 0.84, al);
          g.beginPath(); g.ellipse(x + r * 0.05, y + r * 0.08, r, r * SA, 0, 0, TAU); g.stroke();
          g.lineWidth = r * 0.24;
          g.strokeStyle = css(P.steam, 1, al);
          g.beginPath(); g.ellipse(x, y - r * 0.04, r, r * SA, 0, 0, TAU); g.stroke();
        }
      }
    },

    // ---- Panel A: porthole fan, bar/beat readout, louvres, snare toggles ----
    faceA(F, E) {
      const g = F.g, P = E.P, sh = F.shade, t = E.t;
      plate(F, P, 'PANEL A');
      // porthole
      const px = 70, py = 76, R = 50;
      cyl(F, px, py, R + 12, 0, 4, css(P.metal, sh), css(P.metalDark, sh), css(P.metalDark, sh));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.26;
        screw(F, px + Math.cos(a) * (R + 7), py + Math.sin(a) * (R + 7), 2.2, 4, P);
      }
      const gw = 4 + 8 * this.bassEnv * E.travel;   // the gasket swells with the bass
      const rg = R - gw;
      at(F, 4);
      g.save(); circ(g, px, py, R); g.clip();
      at(F, -14);
      g.fillStyle = css(P.interior); g.fillRect(px - R * 2, py - R * 2, R * 4, R * 4);
      g.strokeStyle = css(P.metalDark, 0.5); g.lineWidth = 1;
      for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(px + i * 9, py - R * 1.5); g.lineTo(px + i * 9, py + R * 1.5); g.stroke(); }
      at(F, -8);
      g.strokeStyle = css(P.metalDark, 0.8); g.lineWidth = 3;
      circ(g, px, py, R * 0.86); g.stroke();
      // fan blades, with ghost copies when it is really going
      const spin = this.fan;
      const blur = clamp((16 * this.bassEnv) / 14, 0, 1);
      const blade = (a, alpha) => {
        g.fillStyle = css(P.metal, 0.95, alpha);
        for (let i = 0; i < 6; i++) {
          const b = a + (i / 6) * TAU;
          g.beginPath();
          g.moveTo(px + Math.cos(b - 0.12) * 8, py + Math.sin(b - 0.12) * 8);
          g.quadraticCurveTo(px + Math.cos(b + 0.1) * 30, py + Math.sin(b + 0.1) * 30, px + Math.cos(b + 0.05) * 41, py + Math.sin(b + 0.05) * 41);
          g.arc(px, py, 41, b + 0.05, b + 0.5);
          g.quadraticCurveTo(px + Math.cos(b + 0.45) * 22, py + Math.sin(b + 0.45) * 22, px + Math.cos(b + 0.35) * 8, py + Math.sin(b + 0.35) * 8);
          g.closePath(); g.fill();
        }
      };
      at(F, -6);
      if (blur > 0.1) { blade(spin - 0.16, 0.28 * blur); blade(spin - 0.08, 0.4 * blur); }
      blade(spin, 1);
      g.fillStyle = css(P.accent); circ(g, px, py, 7.5); g.fill();
      g.fillStyle = css(P.metalDark); circ(g, px, py, 2.5); g.fill();
      g.restore();
      // gasket: a rubber ring between glass and bezel that bulges inward
      at(F, 3);
      g.strokeStyle = css(P.rubber, sh * 1.1); g.lineWidth = gw;
      circ(g, px, py, R - gw / 2); g.stroke();
      at(F, 3.6);
      g.strokeStyle = css(P.rubber, sh * 1.6, 0.8); g.lineWidth = 0.8 * F.px;
      circ(g, px, py, R - gw * 0.55); g.stroke();
      glass(F, () => { at(F, 3); circ(g, px, py, rg); }, px - rg, py - rg, rg * 2, rg * 2);

      // readout: bar number and beat, counted off the kick
      box(F, 138, 22, 50, 28, 0, 3, P.metal, null, css(P.metalDark, sh));
      at(F, 3);
      g.fillStyle = css(P.interior); rr(g, 141, 25, 44, 22, 2); g.fill();
      const bar = Math.floor(Math.max(0, this.kickCount - 1) / 4) + 1, beat = this.kickCount ? ((this.kickCount - 1) % 4) + 1 : 0;
      const on = css(P.accent), off = css(P.accent, 0.22);
      digit(g, 145, 29, 8, 14, Math.floor(bar / 10) % 10, on, off);
      digit(g, 155, 29, 8, 14, bar % 10, on, off);
      g.fillStyle = on; circ(g, 166, 42, 1.2); g.fill();
      digit(g, 172, 29, 8, 14, beat, on, off);
      label(F, 'BAR · BEAT', 163, 58, 5.2, css(P.seam, sh), 'center');

      // louvres: open on an orange chamber for the drop
      const lx = 138, ly = 66, lw = 50, lh = 66;
      const op = clamp(this.louvre.x, -0.1, 1.15);
      at(F, 0);
      g.fillStyle = css(P.ink, sh); g.fillRect(lx - 1.5, ly - 1.5, lw + 3, lh + 3);
      g.save(); at(F, 0); g.beginPath(); g.rect(lx, ly, lw, lh); g.clip();
      at(F, -10);
      g.fillStyle = css(P.accent, 0.95); g.fillRect(lx - 20, ly - 20, lw + 40, lh + 40);
      g.fillStyle = css(P.accent, 0.7);
      for (let i = 0; i < 5; i++) g.fillRect(lx - 20, ly + i * 14 + 3, lw + 40, 3);
      g.restore();
      const n = 6, sh2 = lh / n;
      const gam = op * 1.05;
      for (let i = 0; i < n; i++) {
        const yc = ly + sh2 * (i + 0.5), hh = sh2 * 0.62;
        const cg = Math.cos(gam), sg = Math.sin(gam);
        const q = [pt(F, lx, yc - hh * cg, hh * sg + 1), pt(F, lx + lw, yc - hh * cg, hh * sg + 1), pt(F, lx + lw, yc + hh * cg, -hh * sg + 1), pt(F, lx, yc + hh * cg, -hh * sg + 1)];
        const nrm = dir(F, 0, sg, cg);
        const kk = E.cam.light(nrm);
        screen(F);
        g.fillStyle = css(P.body, kk);
        g.beginPath(); q.forEach((v, j) => (j ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath(); g.fill();
        g.strokeStyle = css(P.seam, kk); g.lineWidth = 0.6; g.stroke();
      }

      // toggles: the snare flips a wave down the row
      box(F, 16, 142, 168, 46, 0, 2, P.metal, null, css(P.metalDark, sh));
      for (let i = 0; i < 6; i++) {
        const tg = this.toggles[i];
        const x = 30 + i * 28, y = 173;
        const fl = flip(t - tg.at);
        const ang = (tg.state * (2 * fl - 1)) * 0.72 * clamp(E.travel, 0.5, 1.4);
        const upOn = clamp(0.5 - 0.5 * Math.sin(ang) / 0.66, 0, 1);
        lamp(F, x, 153, 3.8, P, upOn, P.lampGo, 2);
        cyl(F, x, y, 7, 2, 4, css(P.metal, sh * 1.05), css(P.metalDark, sh));
        cyl(F, x, y, 3.6, 4, 8, css(P.metal, sh * 1.1), css(P.metalDark, sh));
        const Lv = 18;
        const b0 = pt(F, x, y, 7), tip = pt(F, x, y + Math.sin(ang) * Lv, 7 + Math.cos(ang) * Lv);
        screen(F);
        g.lineCap = 'round';
        g.strokeStyle = css(P.metalDark, sh); g.lineWidth = 3.4 * Math.sqrt(Math.abs(F.a * F.d - F.b * F.c)) * 1.0;
        g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(tip[0], tip[1]); g.stroke();
        g.strokeStyle = css(P.metal, sh * 1.12); g.lineWidth *= 0.55;
        g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(tip[0], tip[1]); g.stroke();
        g.fillStyle = css(P.accent, sh); circ(g, tip[0], tip[1], 2.6 * Math.sqrt(Math.abs(F.a * F.d - F.b * F.c))); g.fill();
      }
      label(F, 'ON', 22, 139, 5, css(P.seam, sh));
      edge(F, P);
    },

    // ---- Panel B: tank of liquid, pressure gauge, valve wheel --------------
    faceB(F, E) {
      const g = F.g, P = E.P, sh = F.shade, t = E.t;
      plate(F, P, 'PANEL B');
      const tx = 20, ty = 20, tw = 64, th = 160;
      box(F, tx - 6, ty - 6, tw + 12, th + 12, 0, 4, P.metal, null, css(P.metalDark, sh));
      for (const [x, y] of [[tx - 2, ty - 2], [tx + tw + 2, ty - 2], [tx - 2, ty + th + 2], [tx + tw + 2, ty + th + 2], [tx - 2, ty + th / 2], [tx + tw + 2, ty + th / 2]]) screw(F, x, y, 1.8, 4, P);
      at(F, 4);
      g.save(); rr(g, tx, ty, tw, th, 8); g.clip();
      at(F, -12);
      g.fillStyle = css(P.interior); g.fillRect(tx - 30, ty - 30, tw + 60, th + 60);
      g.strokeStyle = css(P.metalDark, 0.55); g.lineWidth = 0.8;
      for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(tx - 20, ty + i * 16); g.lineTo(tx + tw + 20, ty + i * 16); g.stroke(); }
      // the liquid, sloshing with the bass
      at(F, -6);
      const lvY = ty + th * (1 - this.level);
      const A = 1.5 + 9 * this.bassEnv * E.travel, ph = this.sloshPh;
      const surf = (x) => lvY + A * Math.sin(ph + x * 0.07) * 0.7 + A * 0.45 * Math.sin(ph * 1.7 - x * 0.13 + 1.3);
      g.fillStyle = css(P.liquid, 0.95);
      g.beginPath(); g.moveTo(tx - 30, ty + th + 30);
      for (let x = tx - 30; x <= tx + tw + 30; x += 4) g.lineTo(x, surf(x));
      g.lineTo(tx + tw + 30, ty + th + 30); g.closePath(); g.fill();
      g.strokeStyle = css(mix(P.liquid, [255, 255, 255], 0.45)); g.lineWidth = 1.4;
      g.beginPath();
      for (let x = tx - 30; x <= tx + tw + 30; x += 4) (x === tx - 30 ? g.moveTo(x, surf(x)) : g.lineTo(x, surf(x)));
      g.stroke();
      // a darker band deeper down: the liquid has depth
      g.fillStyle = css(P.liquid, 0.78, 0.6);
      g.fillRect(tx - 30, ty + th - 26, tw + 60, 60);
      // bubbles from the hats
      g.strokeStyle = css(mix(P.liquid, [255, 255, 255], 0.7), 1, 0.9); g.lineWidth = 0.9;
      for (const b of this.bubbles) {
        const age = t - b.t0;
        const y = ty + th - 4 - age * 55;
        if (y < surf(0) + 3 || age < 0) continue;
        const x = tx + b.x * tw + Math.sin(age * 7 + b.w) * 3;
        circ(g, x, y, b.r); g.stroke();
      }
      // a float riding the surface
      const fx = tx + tw * 0.62, fy = surf(tx + tw * 0.62) - 2;
      g.fillStyle = css(P.accent); circ(g, fx, fy, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; circ(g, fx - 1.5, fy - 1.6, 1.5); g.fill();
      g.restore();
      glass(F, () => { at(F, 4); rr(g, tx, ty, tw, th, 8); }, tx, ty, tw, th);
      at(F, 4);
      g.strokeStyle = css(P.rubber, sh * 1.15); g.lineWidth = 2.6;
      rr(g, tx, ty, tw, th, 8); g.stroke();
      // graduations on the frame
      at(F, 4);
      g.strokeStyle = css(P.ink, sh, 0.8); g.lineWidth = 0.7 * F.px;
      for (let i = 1; i < 10; i++) {
        const y = ty + th - i * (th / 10), w = i % 5 === 0 ? 6 : 3.5;
        g.beginPath(); g.moveTo(tx + tw + 5.5 - w, y); g.lineTo(tx + tw + 5.5, y); g.stroke();
      }

      // pressure gauge with a sprung needle
      const gx = 138, gy = 64, gr = 40;
      cyl(F, gx, gy, gr + 6, 0, 6, css(P.metal, sh), css(P.metalDark, sh), css(P.metalDark, sh));
      at(F, 5);
      g.fillStyle = css(P.dial, sh * 1.02); circ(g, gx, gy, gr); g.fill();
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      g.strokeStyle = css(P.accent, sh); g.lineWidth = 5;
      g.beginPath(); g.arc(gx, gy, gr - 6, lerp(a0, a1, 0.78), a1); g.stroke();
      g.strokeStyle = css(P.ink, sh); g.lineCap = 'butt';
      for (let i = 0; i <= 40; i++) {
        const a = lerp(a0, a1, i / 40), big = i % 5 === 0;
        g.lineWidth = big ? 1.2 : 0.6;
        g.beginPath(); g.moveTo(gx + Math.cos(a) * (gr - (big ? 10 : 6.5)), gy + Math.sin(a) * (gr - (big ? 10 : 6.5))); g.lineTo(gx + Math.cos(a) * (gr - 3), gy + Math.sin(a) * (gr - 3)); g.stroke();
      }
      g.font = '700 6px ' + font('Space Mono', 'monospace'); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = css(P.ink, sh);
      for (let i = 0; i <= 8; i += 2) { const a = lerp(a0, a1, i / 8); g.fillText(String(i), gx + Math.cos(a) * (gr - 16), gy + Math.sin(a) * (gr - 16)); }
      g.fillText('BAR', gx, gy + 15);
      const na = lerp(a0, a1, clamp(this.needle.x, -0.02, 1.03));
      at(F, 6.5);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.moveTo(gx + 1.5 + Math.cos(na + 1.57) * 2, gy + 2 + Math.sin(na + 1.57) * 2); g.lineTo(gx + 1.5 + Math.cos(na) * (gr - 6), gy + 2 + Math.sin(na) * (gr - 6)); g.lineTo(gx + 1.5 + Math.cos(na - 1.57) * 2, gy + 2 + Math.sin(na - 1.57) * 2); g.closePath(); g.fill();
      at(F, 8);
      g.fillStyle = css(P.accent, sh * 0.95);
      g.beginPath(); g.moveTo(gx + Math.cos(na + 1.57) * 2.2, gy + Math.sin(na + 1.57) * 2.2); g.lineTo(gx + Math.cos(na) * (gr - 5), gy + Math.sin(na) * (gr - 5)); g.lineTo(gx + Math.cos(na - 1.57) * 2.2, gy + Math.sin(na - 1.57) * 2.2); g.lineTo(gx - Math.cos(na) * 8, gy - Math.sin(na) * 8); g.closePath(); g.fill();
      cyl(F, gx, gy, 4, 8, 9.5, css(P.ink, sh * 1.4), css(P.ink, sh));
      glass(F, () => { at(F, 6); circ(g, gx, gy, gr); }, gx - gr, gy - gr, gr * 2, gr * 2);

      // valve handwheel, turned by the bass
      const wx = 138, wy = 148, wr = 28;
      cyl(F, wx, wy, 5, 0, 12, css(P.metal, sh), css(P.metalDark, sh));
      for (let z = 7; z <= 10; z += 1) {
        at(F, z);
        g.strokeStyle = z < 10 ? css(P.accent, sh * 0.7) : css(P.accent, sh); g.lineWidth = 5;
        circ(g, wx, wy, wr); g.stroke();
      }
      at(F, 10);
      g.strokeStyle = css(P.accent, sh * 0.9); g.lineWidth = 3.4; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = this.wheel + (i / 5) * TAU;
        g.beginPath(); g.moveTo(wx + Math.cos(a) * 5, wy + Math.sin(a) * 5); g.lineTo(wx + Math.cos(a) * (wr - 1), wy + Math.sin(a) * (wr - 1)); g.stroke();
      }
      g.strokeStyle = css(mix(P.accent, [255, 255, 255], 0.4), sh, 0.7); g.lineWidth = 1;
      g.beginPath(); g.arc(wx, wy, wr + 1.2, Math.PI * 1.0, Math.PI * 1.6); g.stroke();
      cyl(F, wx, wy, 6.5, 10, 13, css(P.metal, sh * 1.05), css(P.metalDark, sh));
      edge(F, P);
    },

    // ---- Panel C: the hazard hatch (drop), the smith (snare), keypad (hats) --
    hatchDoor(F, E, behind) {
      const g = F.g, P = E.P;
      const x0 = 18, y0 = 26, w = 100, h = 150;
      const beta = clamp(this.hatch.x, 0, 1.1) * 1.75;
      const cb = Math.cos(beta), sb = Math.sin(beta);
      // the door's own frame, hinged on the hole's left edge
      const O = add(add(F.O, F.uh, x0 * K), F.vh, y0 * K);
      const Ud = scl(add(scl(F.uh, cb), F.n, sb), 2), nd = add(scl(F.n, cb), F.uh, -sb);
      const D = frame(E.cam, g, F.base, O, Ud, F.V, nd);
      const T = 4;
      const sh = D.shade;
      if (D.facing >= 0) {
        box(D, 0, 0, w, h, 0, T, P.body, null, css(P.seam, sh));
        at(D, T);
        g.strokeStyle = css(P.seam, sh); g.lineWidth = 1.2 * D.px;
        rr(g, 8, 8, w - 16, h - 16, 4); g.stroke();
        for (const [x, y] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5], [5, h / 2], [w - 5, h / 2], [w / 2, 5], [w / 2, h - 5]]) screw(D, x, y, 1.9, T, P);
        // hazard chevrons across the foot of the door
        at(D, T);
        g.save(); g.beginPath(); g.rect(12, h - 34, w - 24, 18); g.clip();
        g.fillStyle = css(P.ink, sh); g.fillRect(12, h - 34, w - 24, 18);
        g.fillStyle = css(P.accent, sh);
        for (let i = -3; i < 12; i++) { g.beginPath(); g.moveTo(12 + i * 12, h - 16); g.lineTo(18 + i * 12, h - 16); g.lineTo(30 + i * 12, h - 34); g.lineTo(24 + i * 12, h - 34); g.closePath(); g.fill(); }
        g.restore();
        label(D, 'C-3 SERVICE', w / 2, 32, 8, css(P.ink, sh), 'center');
        label(D, 'KEEP CLEAR', w / 2, 42, 5.5, css(P.seam, sh), 'center');
        // handle: two posts and a grip
        cyl(D, w - 18, h / 2 - 16, 3, T, T + 8, css(P.metal, sh), css(P.metalDark, sh));
        cyl(D, w - 18, h / 2 + 16, 3, T, T + 8, css(P.metal, sh), css(P.metalDark, sh));
        const a1 = pt(D, w - 18, h / 2 - 16, T + 8), a2 = pt(D, w - 18, h / 2 + 16, T + 8);
        screen(D);
        g.strokeStyle = css(P.metalDark, sh); g.lineWidth = 4 * Math.sqrt(Math.abs(D.a * D.d - D.b * D.c)); g.lineCap = 'round';
        g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.stroke();
        g.strokeStyle = css(P.metal, sh * 1.1); g.lineWidth *= 0.5;
        g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.stroke();
      } else {
        // seen from behind: the door's inner skin with its bracing
        box(D, 0, 0, w, h, 0, T, P.body, null, null);
        at(D, 0);
        const shb = E.cam.light(scl(nd, -1));
        g.fillStyle = css(P.inset, shb); g.beginPath(); g.rect(0, 0, w, h); g.fill();
        g.strokeStyle = css(P.seam, shb); g.lineWidth = 3;
        g.beginPath(); g.moveTo(6, 6); g.lineTo(w - 6, h - 6); g.moveTo(w - 6, 6); g.lineTo(6, h - 6); g.stroke();
        g.lineWidth = 1.2 * D.px; g.strokeRect(0, 0, w, h);
      }
      // hinge knuckles
      for (const y of [18, h - 18]) cyl(F, x0 - 2, y0 + y, 3.2, 0, 4, css(P.metal, F.shade), css(P.metalDark, F.shade));
      if (behind) return;
    },

    faceC(F, E) {
      const g = F.g, P = E.P, sh = F.shade, t = E.t;
      plate(F, P, 'PANEL C');
      const x0 = 18, y0 = 26, w = 100, h = 150, D = 34;
      const op = this.hatch.x;
      // hazard frame round the hatch
      at(F, 0);
      g.save();
      g.beginPath(); g.rect(x0 - 6, y0 - 6, w + 12, h + 12); g.rect(x0, y0, w, h); g.clip('evenodd');
      g.fillStyle = css(P.ink, sh); g.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);
      g.fillStyle = css(P.accent, sh);
      for (let i = -20; i < 30; i++) { g.beginPath(); g.moveTo(x0 - 6 + i * 10, y0 - 6); g.lineTo(x0 + i * 10, y0 - 6); g.lineTo(x0 - 6 + i * 10 + h + 12 - 6, y0 + h + 6); g.lineTo(x0 - 12 + i * 10 + h + 12 - 6 + 0, y0 + h + 6); g.closePath(); g.fill(); }
      g.restore();
      if (op > 0.01) {
        // the cavity: dark, recessed, walls lit by the room
        at(F, 0);
        g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
        g.fillStyle = css(P.interior); g.fillRect(x0, y0, w, h);
        const ox = F.du * -D, oy = F.dv * -D;
        const wall = (x1, y1, x2, y2, k) => {
          g.fillStyle = css(P.inset, k * 0.45);
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2 + ox, y2 + oy); g.lineTo(x1 + ox, y1 + oy); g.closePath(); g.fill();
        };
        if (F.fU > 0) wall(x0, y0, x0, y0 + h, F.lUp);
        if (F.fU < 0) wall(x0 + w, y0, x0 + w, y0 + h, F.lUm);
        if (F.fV > 0) wall(x0, y0, x0 + w, y0, F.lVp);
        if (F.fV < 0) wall(x0, y0 + h, x0 + w, y0 + h, F.lVm);
        at(F, -D);
        g.strokeStyle = css(P.metalDark, 0.5); g.lineWidth = 1;
        for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x0, y0 + i * 25); g.lineTo(x0 + w, y0 + i * 25); g.stroke(); }
        g.restore();
        // the speaker rides out on its sled as the door opens
        const ex = clamp((op - 0.35) / 0.65, 0, 1.1);
        const zs = -D + (D + 16) * smooth(ex);
        const sx = x0 + w / 2, sy = y0 + h / 2 - 8;
        box(F, sx - 34, sy - 38, 68, 88, -D, zs, P.metalDark, null, css(P.ink, sh));
        const bass = this.bassEnv * E.travel;
        at(F, zs);
        g.fillStyle = css(P.rubber, sh * 1.2); circ(g, sx, sy, 30); g.fill();
        at(F, zs - 1 + bass * 3);
        g.fillStyle = css(P.rubber, sh * 0.8); circ(g, sx, sy, 26); g.fill();
        for (let k = 0; k < 4; k++) {
          at(F, zs - 2 - k * 2 + bass * (4 + k * 1.5));
          g.fillStyle = css(P.metalDark, sh * (0.8 + k * 0.08)); circ(g, sx, sy, 24 - k * 4.5); g.fill();
        }
        at(F, zs - 6 + bass * 12);
        g.fillStyle = css(P.accent, sh); circ(g, sx, sy, 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; circ(g, sx - 2.5, sy - 2.5, 2.4); g.fill();
        // tweeter
        cyl(F, sx, sy + 40, 7, zs, zs + 2, css(P.metal, sh), css(P.metalDark, sh));
        at(F, zs + 2); g.fillStyle = css(P.rubber, sh); circ(g, sx, sy + 40, 4); g.fill();
      }
      if (!(op > 0.01)) {
        this.hatchDoor(F, E, false);
      }

      // the smith's porthole: a tiny figure hammers on each snare
      const wx = 131, wy = 24, ww = 56, wh = 70;
      box(F, wx - 5, wy - 5, ww + 10, wh + 10, 0, 3, P.metal, null, css(P.metalDark, sh));
      at(F, 3);
      g.save(); rr(g, wx, wy, ww, wh, 6); g.clip();
      at(F, -8);
      g.fillStyle = css(P.interior, 1.5); g.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
      // lamp-lit back wall, a warmer pool by the forge
      const s = t - this.lastSnare;
      const fg = Math.exp(-Math.max(0, s) / 0.18);
      const grd = g.createRadialGradient(wx + 22, wy + 48, 2, wx + 22, wy + 48, 42);
      grd.addColorStop(0, css(P.accent, 1, 0.25 + 0.4 * fg)); grd.addColorStop(1, css(P.accent, 1, 0));
      g.fillStyle = grd; g.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
      at(F, -5);
      const fy = wy + wh - 10;
      g.translate(wx + ww / 2, fy); g.scale(1.3, 1.3); g.translate(-(wx + ww / 2), -fy);
      g.fillStyle = css(P.metalDark, 0.6); g.fillRect(wx - 10, fy, ww + 20, 20);
      // anvil
      const ax = wx + 20, ay = fy;
      g.fillStyle = css(P.ink, 1.5);
      g.beginPath(); g.moveTo(ax - 10, ay - 12); g.lineTo(ax + 8, ay - 12); g.lineTo(ax + 11, ay - 9); g.lineTo(ax + 4, ay - 8); g.lineTo(ax + 3, ay - 3); g.lineTo(ax + 6, ay); g.lineTo(ax - 8, ay); g.lineTo(ax - 5, ay - 3); g.lineTo(ax - 6, ay - 8); g.lineTo(ax - 13, ay - 10); g.closePath(); g.fill();
      // a hot bar on the anvil
      g.fillStyle = css(mix(P.accent, [255, 230, 160], 0.3 + 0.5 * fg)); g.fillRect(ax - 6, ay - 14, 12, 2.2);
      // the smith: bobbing with the bass, hammer arm driven by the snare
      const bob = Math.sin(this.fan * 0.25) * 0.6 + this.bassEnv * 1.5;
      const hx = wx + 38, hy = fy - bob * 0.5;
      g.strokeStyle = css(P.dial, 0.9); g.fillStyle = css(P.dial, 0.9); g.lineCap = 'round'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(hx - 3, hy); g.lineTo(hx - 1, hy - 11); g.lineTo(hx + 3, hy); g.stroke();
      g.lineWidth = 4.2; g.beginPath(); g.moveTo(hx - 1, hy - 11); g.lineTo(hx - 2.5, hy - 22); g.stroke();
      circ(g, hx - 3, hy - 27, 3.3); g.fill();
      g.fillStyle = css(P.accent); g.fillRect(hx - 6.5, hy - 31, 7, 2.2);   // cap
      // arm angle: raised high, struck down on the snare, lifted slowly again
      const strike = s < 0.05 ? s / 0.05 : Math.max(0, 1 - (s - 0.05) / 0.4);
      const idle = -2.2 + 0.15 * Math.sin(t * 2.1);
      const arm = lerp(idle, -0.35, smooth(strike));
      const sx0 = hx - 2.5, sy0 = hy - 20;
      const elx = sx0 - Math.cos(arm) * 7, ely = sy0 + Math.sin(arm) * 7;
      g.lineWidth = 2.4; g.strokeStyle = css(P.dial, 0.9);
      g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(elx, ely); g.stroke();
      // hammer shaft and head
      const hdx = elx - Math.cos(arm) * 10, hdy = ely + Math.sin(arm) * 10;
      g.strokeStyle = css(P.seam, 1.2); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(elx, ely); g.lineTo(hdx, hdy); g.stroke();
      g.save(); g.translate(hdx, hdy); g.rotate(-arm + Math.PI / 2);
      g.fillStyle = css(P.metal, 0.9); g.fillRect(-4.5, -2.4, 9, 4.8);
      g.restore();
      // sparks
      for (const sp of this.sparks) {
        const age = t - sp.t0;
        if (age < 0 || age > 0.5) continue;
        const x = ax + sp.vx * age, y = ay - 14 + sp.vy * age + 160 * age * age;
        g.fillStyle = css(mix([255, 240, 190], P.accent, age * 2), 1, 1 - age * 2);
        g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      }
      g.restore();
      glass(F, () => { at(F, 3); rr(g, wx, wy, ww, wh, 6); }, wx, wy, ww, wh);

      // keypad: hats press keys at random
      box(F, 130, 104, 58, 80, 0, 2, P.metal, null, css(P.metalDark, sh));
      for (let i = 0; i < 9; i++) {
        const kx = 136 + (i % 3) * 17, ky = 110 + Math.floor(i / 3) * 17;
        const pr = clamp(press(t - this.keys[i]), -0.2, 1) * E.travel;
        const top = 7 - 5 * clamp(pr, -0.2, 1.1);
        const litK = Math.exp(-Math.max(0, t - this.keys[i]) / 0.25);
        box(F, kx, ky, 13, 13, 2, top, i === 4 ? P.accent : P.body, css(mix(i === 4 ? P.accent : P.body, P.lampHat, litK * 0.8), sh * (1 + 0.15 * litK)), css(P.seam, sh));
        at(F, top);
        g.fillStyle = css(P.ink, sh, 0.7);
        g.font = '700 6px ' + font('Space Mono', 'monospace'); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(i + 1), kx + 6.5, ky + 7);
      }
      // the four-key footer: a red cancel, a green go
      lamp(F, 139, 168, 4, P, Math.exp(-Math.max(0, t - this.lastHat) / 0.2) * 0.8, P.lampHat, 2);
      label(F, 'CODE', 170, 171, 6, css(P.ink, sh), 'center');

      if (op > 0.01) this.hatchDoor(F, E, false);
      edge(F, P);
    },

    // ---- Panel D: tape reels, oscilloscope, paper-tape punch ----------------
    faceD(F, E) {
      const g = F.g, P = E.P, sh = F.shade, t = E.t;
      plate(F, P, 'PANEL D');
      const wx = 16, wy = 18, ww = 168, wh = 84;
      box(F, wx - 4, wy - 4, ww + 8, wh + 8, 0, 3, P.metal, null, css(P.metalDark, sh));
      at(F, 3);
      g.save(); rr(g, wx, wy, ww, wh, 6); g.clip();
      at(F, -10);
      g.fillStyle = css(P.interior, 1.3); g.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
      at(F, -6);
      const fcy = 0.5 + 0.5 * Math.sin(t * 0.045);
      const reels = [[58, 58, 13 + 17 * fcy], [142, 58, 13 + 17 * (1 - fcy)]];
      // tape path under the head
      g.strokeStyle = css([80, 52, 36], 1); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(58 - reels[0][2] * 0.2, 58 + reels[0][2]); g.lineTo(88, 94); g.lineTo(112, 94); g.lineTo(142 + reels[1][2] * 0.2, 58 + reels[1][2]); g.stroke();
      g.fillStyle = css(P.metal, 0.85); g.fillRect(93, 92, 14, 7);
      for (const [i, [x, y, rp]] of reels.entries()) {
        const a = this.reel * (i ? 1.15 : 1) * (30 / (rp + 12));
        g.fillStyle = css([88, 58, 40]); circ(g, x, y, rp); g.fill();
        g.strokeStyle = css([60, 40, 28]); g.lineWidth = 0.5;
        for (let r = 12; r < rp; r += 3) { circ(g, x, y, r); g.stroke(); }
        // flange with three cut-outs
        g.fillStyle = css(P.metal, 0.9, 0.9);
        g.beginPath(); g.arc(x, y, 33, 0, TAU);
        for (let k = 0; k < 3; k++) {
          const b = a + (k / 3) * TAU;
          g.moveTo(x + Math.cos(b) * 28, y + Math.sin(b) * 28);
          g.arc(x, y, 28, b, b + 1.3);
          g.arc(x, y, 12, b + 1.3, b, true);
          g.closePath();
        }
        g.fill('evenodd');
        g.fillStyle = css(P.metalDark); circ(g, x, y, 5); g.fill();
        g.fillStyle = css(P.accent); circ(g, x + Math.cos(a) * 8.5, y + Math.sin(a) * 8.5, 1.8); g.fill();
      }
      g.restore();
      glass(F, () => { at(F, 3); rr(g, wx, wy, ww, wh, 6); }, wx, wy, ww, wh);

      // oscilloscope: a Lissajous figure that the pad steadies and the hats fray
      const sx = 16, sy = 112, sw = 84, shh = 72;
      box(F, sx - 3, sy - 3, sw + 6, shh + 6, 0, 3, P.ink, css(P.ink, sh * 1.3), null);
      at(F, 3);
      g.save(); rr(g, sx + 4, sy + 4, sw - 8, shh - 8, 8); g.clip();
      at(F, -1);
      g.fillStyle = css(P.glass, 0.8); g.fillRect(sx, sy, sw, shh);
      g.strokeStyle = css(P.trace, 1, 0.12); g.lineWidth = 0.6;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(sx + i * sw / 6, sy); g.lineTo(sx + i * sw / 6, sy + shh); g.stroke(); }
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(sx, sy + i * shh / 4); g.lineTo(sx + sw, sy + i * shh / 4); g.stroke(); }
      const ccx = sx + sw / 2, ccy = sy + shh / 2;
      const amp = 0.35 + 0.55 * clamp(this.pad * 1.6 + this.bassEnv * 0.5, 0, 1);
      const ratio = this.mast.x > 0.5 ? 3 : 2;
      const fray = this.hatSlow * 5;
      const trace = (w, a) => {
        g.strokeStyle = css(P.trace, 1, a); g.lineWidth = w;
        g.beginPath();
        for (let i = 0; i <= 160; i++) {
          const q = (i / 160) * TAU;
          const x = ccx + Math.sin(ratio * q + this.scopePh) * (sw * 0.38) * amp + Math.sin(q * 23 + t * 9) * fray * 0.4;
          const y = ccy + Math.sin(2 * q) * (shh * 0.36) * amp + Math.cos(q * 31 - t * 11) * fray * 0.4;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      };
      trace(3.2, 0.18); trace(1.1, 0.95);
      g.restore();
      glass(F, () => { at(F, 3); rr(g, sx + 4, sy + 4, sw - 8, shh - 8, 8); }, sx, sy, sw, shh);

      // paper-tape punch: each hat punches a row; the tape feeds out and down
      const px = 110, py = 112;
      box(F, px, py, 74, 20, 0, 9, P.metal, null, css(P.metalDark, sh));
      at(F, 9);
      g.fillStyle = css(P.ink, sh); g.fillRect(px + 16, py + 12, 42, 2.5);
      const hp = press(t - this.lastHat) * E.travel;
      cyl(F, px + 64, py + 8, 4, 9, 14 - 3 * clamp(hp, 0, 1), css(P.accent, sh), css(P.accent, sh * 0.7));
      const tx = px + 19, tw = 36, t0 = py + 20;
      at(F, 1.2);
      g.save(); g.beginPath(); g.rect(tx - 2, t0, tw + 4, S - t0 - 6); g.clip();
      g.fillStyle = css(P.paper, sh); g.fillRect(tx, t0, tw, S);
      g.strokeStyle = css(P.seam, sh, 0.6); g.lineWidth = 0.6 * F.px;
      g.beginPath(); g.moveTo(tx, t0); g.lineTo(tx, S); g.moveTo(tx + tw, t0); g.lineTo(tx + tw, S); g.stroke();
      const feed = this.tape;
      g.fillStyle = css(P.body, sh * 0.78);
      // sprocket holes run continuously
      for (let y = t0 + 4 - ((feed * 1) % 5); y < S; y += 5) { if (y < t0 + 1) continue; circ(g, tx + 14, y, 0.9); g.fill(); }
      for (const pu of this.punches) {
        const y = t0 + 4 + (feed - pu.at) * 1;
        if (y > S) continue;
        for (let b = 0; b < 7; b++) {
          if (!((pu.bits >> b) & 1)) continue;
          const col = b < 2 ? b : b + 1;
          g.beginPath(); g.arc(tx + 4 + col * 4.5 + (col >= 3 ? 1 : 0), y, 1.6, 0, TAU); g.fill();
        }
      }
      g.restore();
      label(F, 'D-4 LOG', px + 60, py + 50, 5.5, css(P.seam, sh), 'center');
      edge(F, P);
    },
  });
})();
