// Ophanim V2: the angel as the still point of a deep stack of moving planes.
//
// Raph (2026-09-28), after LEXSAN's #13 "Psychedelic mirror shards": "the way
// the shapes are morphing is super interesting and mesmerizing. also good use
// of layers with the rings flying in, the glow, and the starfield background.
// if we applied some of these layerings to our angel it would be amazing to
// behold. great palette too." The redesign note is harness/v2/ophanim.md.
//
// V1's anatomy stays (the gimbal of wheels in true perspective, eyes that turn
// to look at you, six wings, the fire, the rays inside the being) and so does
// its music vocabulary. What is new is the space around it and its surface:
//
//   ground    violet-black in a round porthole (#13's vignette)
//   stars     ~340 points flying at the viewer in the same camera as the
//             angel; their trails are stroked three times, offset radially in
//             red, green and blue and added, so a streak splits into colour at
//             its ends (#13's chromatic streaks). Points in the breakdown, warp
//             streaks in the drop.
//   rings     halos of eyes, spoked wheels and mandorlas arriving out of the
//             depth in translucent ink with gold wire. Each is split at the
//             angel's depth: its far side is drawn before the angel and its
//             near side after, so it visibly passes *around* the being.
//   angel     nested translucent mandorla bands, rays, six translucent wings,
//             the gimbal, the fire. Inks are flat and translucent, so overlaps
//             mix (#13's pink over cyan making lilac); gold is kept in the
//             rims, axles, wires and eyelids as the thread back to V1.
//   overlay   lightning, sparks, glints and gold dust, nearest the lens.
//
// Morphing: every wheel's profile is a continuous family (circle, pointed
// lens, lobed rosette) driven by its own slow clocks and deepened by the drop;
// the mandorla breathes between vesica and round nimbus; a length wave runs
// along the feathers; the wings fold into a closed shell as the build tightens
// and burst open on the drop (the Director's coiled pose).
//
// Music: kick ratchets one wheel a notch and widens its eyes (V1), and in the
// drop launches a ring from the depth; snare beats the wings (V1); hats throw
// lightning and sparks and twinkle the stars; bass swells the fire and its
// nimbus; the drop opens every eye, spreads the wings, speeds the flight into
// warp and deepens the morph; each breakdown melts the palette into the next
// outfit, so every drop arrives in new colours.

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
  const rgba = (c, a) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + clamp(a, 0, 1) + ')';
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const WHITE = [255, 255, 255];

  // 3x3 row-major rotation matrices.
  const mul = (A, B) => {
    const R = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return R;
  };
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const app = (M, x, y, z) => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };

  // Palettes melt in OKLab: an sRGB lerp between pink and teal passes through
  // grey, which read as the colour draining out mid-breakdown.
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055);
  const toLab = (c) => {
    const r = toLin(c[0]), g = toLin(c[1]), b = toLin(c[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const fromLab = (L) => {
    const l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3);
    const m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3);
    const s = Math.pow(L[0] - 0.0894841775 * L[1] - 1.2914855480 * L[2], 3);
    return [clamp(toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), 0, 255),
      clamp(toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), 0, 255),
      clamp(toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0, 255)];
  };
  const mixLab = (a, b, t) => { const A = toLab(a), B = toLab(b); return fromLab([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]); };

  // Three outfits of four flat inks on a deep ground. inks[0..3] are, in
  // order, the upper wings, the flying wings, the coverts and outer wheel,
  // and the lower wings; they are chosen so every pair mixes to a third
  // colour worth seeing when laid over each other at half strength.
  const OUTFITS = [
    { name: 'Rose window',
      g0: [40, 16, 82], g1: [5, 2, 16],
      inks: [[255, 70, 160], [36, 200, 255], [255, 186, 44], [142, 92, 255]],
      wire: [20, 6, 44], gold: [255, 204, 110], goldHi: [255, 242, 204], goldDk: [150, 92, 34],
      setting: [26, 10, 60], sclera: [252, 246, 236], iris: [30, 188, 226], irisDk: [12, 58, 120], pupil: [8, 6, 22],
      fireA: [255, 255, 250], fireB: [255, 216, 128], fireC: [255, 66, 150], fireM: [255, 142, 92] },
    { name: 'Ember',
      g0: [70, 10, 34], g1: [10, 2, 8],
      inks: [[255, 78, 40], [20, 206, 190], [255, 172, 36], [255, 40, 140]],
      wire: [32, 4, 14], gold: [255, 200, 104], goldHi: [255, 238, 204], goldDk: [140, 70, 22],
      setting: [44, 6, 22], sclera: [252, 244, 232], iris: [22, 196, 176], irisDk: [6, 70, 72], pupil: [10, 4, 8],
      fireA: [255, 255, 246], fireB: [255, 222, 132], fireC: [255, 58, 40], fireM: [255, 144, 52] },
    { name: 'Lapis and gold',
      g0: [18, 36, 110], g1: [2, 5, 24],
      inks: [[255, 72, 52], [50, 118, 255], [255, 198, 70], [36, 222, 204]],
      wire: [4, 10, 44], gold: [255, 206, 104], goldHi: [255, 244, 210], goldDk: [140, 90, 30],
      setting: [10, 24, 92], sclera: [248, 240, 222], iris: [44, 116, 236], irisDk: [12, 32, 104], pupil: [6, 8, 22],
      fireA: [255, 252, 240], fireB: [255, 210, 110], fireC: [236, 70, 36], fireM: [246, 132, 66] },
  ];
  const outfitAt = (x) => {
    const n = OUTFITS.length;
    const i = ((Math.floor(x) % n) + n) % n, f = x - Math.floor(x);
    const A = OUTFITS[i], B = OUTFITS[(i + 1) % n];
    if (f < 0.002) return A;
    const out = { name: A.name };
    for (const k in A) {
      if (k === 'name') continue;
      if (k === 'inks') out.inks = A.inks.map((c, j) => mixLab(c, B.inks[j], f));
      else out[k] = mixLab(A[k], B[k], f);
    }
    return out;
  };

  // Right-hand wings, as V1: angles in canvas degrees (0 right, -90 up).
  const WINGS = {
    mid:   { root: [0.14, -0.02], boneS: -14, boneF: 10, boneLen: 0.75, dRoot: 58, dWrist: -10, lRoot: 0.55, lWrist: 1.55, n: 15, flap: 13, ink: 1,
      shell: { bone: 64, dR: -50, dW: -100, len: 0.72 } },
    lower: { root: [0.10, 0.18], boneS: 50, boneF: 78, boneLen: 0.40, dRoot: 22, dWrist: 96, lRoot: 0.42, lWrist: 0.9, n: 10, flap: 9, ink: 3,
      shell: { bone: 84, dR: 128, dW: 176, len: 0.9 } },
    upper: { root: [0.10, -0.18], boneS: -48, boneF: -78, boneLen: 0.42, dRoot: -8, dWrist: -96, lRoot: 0.42, lWrist: 0.95, n: 10, flap: 13, ink: 0,
      shell: { bone: -84, dR: -128, dW: -176, len: 0.9 } },
  };
  // Which ink each wheel wears: the outer wheel in the gold-ish ink, as a
  // thread back to V1's gold leaf.
  const RING_INK = [2, 0, 1, 3, 2, 0];
  const LOBES = [3, 5, 4, 6, 3, 5];
  // The shapes a wheel snaps between on its kicks, as offsets from a circle:
  // ex pinches it into a lens, a raises its lobes into a rosette.
  const SHAPE_KEYS = [{ ex: 0, a: 0 }, { ex: 0.8, a: 0 }, { ex: 0, a: 0.2 }, { ex: 0.55, a: 0.13 }];

  const almond = (g, w, h) => {
    g.moveTo(-w, 0);
    g.bezierCurveTo(-w * 0.45, -h * 1.3, w * 0.45, -h * 1.3, w, 0);
    g.bezierCurveTo(w * 0.45, h * 1.05, -w * 0.45, h * 1.05, -w, 0);
  };

  // V1's icon eye, unchanged: local units (half-width 1, +y down), open 0..1,
  // gaze in the eye's plane, flare 0..1 from the kick.
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

  // The morph family shared by the wheels, the flying rings and the
  // mandorla: a circle whose x is pinched towards a pointed lens (ex > 1
  // gives a vesica with points at the top and bottom of the ring's plane)
  // and whose radius carries k lobes of amplitude a at phase lp.
  const shapeXY = (sh, th) => {
    const c = Math.cos(th), s = Math.sin(th);
    const rad = sh.R * (1 + sh.a * Math.cos(sh.k * (th - sh.lp)));
    const x = sh.ex === 1 ? c : Math.sign(c) * Math.pow(Math.abs(c), sh.ex);
    return [rad * x, rad * s];
  };

  // Performer looks. Follow the track eases the driven params from their
  // set values towards `drop` while the drop is detected.
  const PRESETS = {
    calm: { morph: 0.55, flight: 0.7, glory: 0.8, react: 1, wings: 0, follow: 1 },
    drop: { morph: 1, flight: 1.6, glory: 1.35, react: 1.2, wings: 0, follow: 1 },
  };
  const DRIVE = ['morph', 'flight', 'glory'];

  const N_STARS = 420;
  const RING_FAR = -26;

  VIZ.register({
    id: 'ophanimv2',
    name: 'Ophanim',
    versionOf: 'ophanim',
    version: 'V2',
    order: 605,
    gallery: {
      title: 'Ophanim V2',
      technique: 'Canvas 2D in one hand-rolled perspective camera that drifts, banks and dollies: a 3D starfield flying at the lens with trails stroked three times in red, green and blue, offset radially and added (chromatic streaks); halos, wheels and mandorlas flying in out of the depth, each split at the angel\'s depth so its far half is painted before the angel and its near half after; the V1 gimbal rebuilt with a morphing profile (circle, pointed lens, lobed rosette) whose bands are filled as translucent runs grouped by facing and painter-sorted with the fire and axles; icon eyes in each band\'s plane that turn to look at you; six wings of translucent feathers that fold into a shell and spread; nested translucent mandorla bands, additive rays and nimbus; outfits melted in OKLab.',
      brief: 'The angel of Ezekiel as the still point of a deep, moving space. A starfield streams towards you, its trails splitting into red and blue at the ends; halos of eyes, spoked wheels and mandorlas arrive out of the depth in translucent pink, cyan, saffron and violet with gold wire, and pass around the being, far side behind it and near side in front. At the centre the wheels within wheels turn in true perspective and keep changing shape, melting from circles into pointed lenses into lobed rosettes, their rims full of calm eyes that all look at you. Six translucent wings overlap so pink over cyan makes lilac. Each kick ratchets one wheel a notch and widens its eyes, and in the drop launches another ring out of the depth; the snare beats the wings; hats throw lightning between the wheels and twinkle the stars; the bass swells the fire and its nimbus. Through the build the wings fold into a closed shell; the drop throws them open, opens every eye, deepens the morph and turns the starfield to warp, while the camera dollies in. Each breakdown melts the palette into the next outfit, so every drop arrives in new colours.',
      lineage: [
        'V1: Ophanim (web/scenes/ophanim.js): a Byzantine icon come alive, a gold-leaf gimbal of eyes in a lapis mandorla with vermilion wings.',
        'Raph (2026-09-28), after LEXSAN\'s #13 Psychedelic mirror shards (docs/research/2026-09-28-lexsan-takeaways.md): morphing shapes, rings flying in, glow, a starfield background and a great palette, "applied to our angel". Taken as the scope: layers, morphing and palette, with the angel\'s anatomy and music kept.',
        'Floor (the same picture across the 96 s sheet; per-drop palette rotation): three outfits that melt into the next during each breakdown, so every drop arrives in new colours.',
        'Director (locked camera, dead centre; the coiled pose from Mass Poster): a drifting, banking camera shared by every layer so the drift reads as parallax, a dolly in on the drop, and wings that fold into a shell through the build and burst open on the drop.',
        'Designer (loud orange and blue, a central glow cliché): new flat translucent inks mixing where they overlap; the centre\'s radiance built from nested translucent bands, fine rays and a thin nimbus rather than a glow.',
        'Rejected: folding it into Mandala (Curator; Raph asked for this angel), dropping the wings (Purist; it is a seraph), eyes that look away (Psychonaut; calm attention is the brief), a Droste core (one idea too many).',
      ],
    },

    params: [
      { key: 'palette', label: 'Palette', type: 'select', options: ['New outfit each breakdown'].concat(OUTFITS.map((x) => x.name)), default: 0 },
      { key: 'rings', label: 'Wheels', type: 'range', min: 3, max: 6, step: 1, default: 4 },
      { key: 'morph', label: 'Morph', type: 'range', min: 0, max: 1, step: 0.01, default: PRESETS.calm.morph },
      { key: 'flight', label: 'Flight (stars and rings)', type: 'range', min: 0, max: 2.5, step: 0.01, default: PRESETS.calm.flight },
      { key: 'glory', label: 'Glory (rays and fire)', type: 'range', min: 0, max: 1.6, step: 0.01, default: PRESETS.calm.glory },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, step: 0.01, default: PRESETS.calm.react },
      { key: 'wings', label: 'Wings', type: 'select', options: ['Six wings', 'Two wings', 'No wings'], default: 0 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // Bloom at full strength whitened the drop's centre; three-fifths keeps
    // the rays and stars glowing while the core stays rose and gold.
    finish: { bloom: 0.6 },

    enter() { this.reset(); },
    setup() { this.reset(); },

    reset() {
      this.prev = new Float32Array(9);
      this.lastT = null;
      this.lastKick = -10; this.kickCount = 0; this.kickNow = false;
      this.lastSnare = -10; this.lastHat = -10; this.hatCount = 0;
      this.bassEnv = 0; this.low = 0; this.hatSlow = 0; this.energy = 0;
      this.dropOn = false; this.G = 0.1; this.auto = 0; this.tension = 0; this.open = 0.3;
      this.ang = [0.3, 1.1, 2.0, 0.7, 2.6, 1.7];
      this.phi = [0, 0, 0, 0, 0, 0];
      this.phiT = [0, 0, 0, 0, 0, 0];
      this.flare = [0, 0, 0, 0, 0, 0];
      // Per-wheel shape springs: each kick sends the wheel it ratchets to its
      // next shape key, and an underdamped spring carries it there with an
      // overshoot, so the morph is seen on the beat, not only over seconds.
      this.step = [0, 1, 2, 3, 0, 1];
      this.sEx = [0, 0, 0, 0, 0, 0]; this.vEx = [0, 0, 0, 0, 0, 0];
      this.sA = [0, 0, 0, 0, 0, 0]; this.vA = [0, 0, 0, 0, 0, 0];
      this.flap = 0; this.flapAmp = 0;
      this.bolts = []; this.sparks = []; this.glints = [];
      this.rayRot = 0; this.dustT = 0; this.orbit = 0; this.morphT = 0;
      this.pal = null; this.palTarget = 0; this.drops = 0;
      this.stars = [];
      for (let i = 0; i < N_STARS; i++) this.stars.push(this.newStar(i, -44 + hash(i * 9.1) * 47));
      this.starSeed = N_STARS;
      this.dust = [];
      for (let i = 0; i < 70; i++) this.dust.push({ x: hash(i * 4.3 + 9), y: hash(i * 6.1 + 3), s: 0.6 + hash(i * 8.7) * 1.6, v: 0.4 + hash(i * 2.9) * 0.9, ph: hash(i * 1.3) * TAU });
      // Rings already on their way, so the first frame has depth in it.
      this.flyers = []; this.flyCount = 0; this.sinceSpawn = 0;
      for (const z of [-21, -15, -9.5, -4.5, 0.2]) this.spawn(z);
    },

    newStar(i, z) {
      // A disc of radius 40 with a clear tube down the middle, so no star
      // flies through the lens.
      const a = hash(i * 3.1 + 0.5) * TAU, r = 0.8 + Math.sqrt(hash(i * 7.7 + 1)) * 39;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75, z, tw: hash(i * 2.3) < 0.5 ? 0 : 1 };
    },

    spawn(z) {
      const n = this.flyCount++;
      const type = [0, 2, 1, 0, 2, 0, 1][n % 7]; // 0 halo of eyes, 1 mandorla, 2 wheel
      this.flyers.push({
        type, n, z,
        R: type === 1 ? 1.25 + 0.5 * hash(n * 3.3) : 1.1 + 0.95 * hash(n * 3.3),
        x0: (hash(n * 5.1) - 0.5) * 0.9, y0: (hash(n * 6.7) - 0.5) * 0.5,
        tx: (hash(n * 7.9) - 0.5) * 1.1, ty: (hash(n * 8.3) - 0.5) * 1.0,
        spin: hash(n * 9.7) * TAU, spinV: (hash(n * 4.4) < 0.5 ? -1 : 1) * (0.12 + 0.25 * hash(n * 2.2)),
        ink: n % 4, k: 3 + (n % 4), lp: hash(n * 1.9) * TAU, ph: hash(n * 12.1) * TAU,
      });
      this.sinceSpawn = 0;
    },

    analyse(s, t, dt, nRings, eyes, react) {
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      this.kickNow = false;
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickNow = true;
        const r = this.kickCount % nRings;
        this.kickCount++;
        const n = Math.max(6, Math.round(eyes * (1 - r * 0.13)));
        this.phiT[r] += TAU / n * (r % 2 ? -1 : 1);
        this.flare[r] = Math.max(this.flare[r], clamp(b0 / 90, 0.5, 1) * clamp(react, 0, 1.5));
        this.step[r]++;
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
      const was = this.dropOn;
      if (!this.dropOn && kicking && this.low > 0.3) this.dropOn = true;
      else if (this.dropOn && (this.low < 0.25 || t - this.lastKick > 1.6)) this.dropOn = false;
      if (was && !this.dropOn) this.drops++;
      const target = this.dropOn ? 1 : clamp(0.06 + this.energy * 0.7, 0, 0.32);
      this.G += (target - this.G) * k(target > this.G ? 0.35 : 2.2);
      // Build tension: the hats climbing with no bass line under them. It
      // closes the wings into a shell; the drop releases it. Hats only: with
      // the pad counted too, the breakdown coiled them as well and the build
      // lost its one distinct pose.
      const tens = this.dropOn ? 0 : smooth(0.03, 0.17, this.hatSlow);
      this.tension += (tens - this.tension) * k(tens > this.tension ? 0.9 : 0.25);
      // Wing opening: snaps open on the drop, closes slowly.
      const openT = this.dropOn ? 1 : 0.3 - 0.95 * this.tension;
      this.open += (openT - this.open) * k(openT > this.open ? 0.28 : 1.6);
      for (let r = 0; r < 6; r++) {
        this.flare[r] *= Math.exp(-dt / 0.35);
        this.phi[r] += (this.phiT[r] - this.phi[r]) * k(0.07);
      }
      this.flap += ((this.flapAmp > 0.01 ? 1 : 0) * this.flapAmp - this.flap) * k(0.05);
      if (this.flap > this.flapAmp * 0.92) this.flapAmp *= Math.exp(-dt / 0.06);
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const nRings = clamp(Math.round(params.rings), 3, 6);
      const eyes = 16;
      const react = params.react;
      this.analyse(signals, t, dt, nRings, eyes, react);
      const G = this.G;

      // Follow the track: the driven params ease towards the drop look.
      const follow = Math.round(params.follow) === 1;
      this.auto += ((follow && this.dropOn ? 1 : 0) - this.auto) * (1 - Math.exp(-dt / (this.dropOn ? 0.5 : 1.8)));
      const a = follow ? this.auto : 0;
      const V = {};
      for (const key of DRIVE) V[key] = params[key] + (PRESETS.drop[key] - params[key]) * a;
      const glory = V.glory, morph = V.morph, flight = V.flight;

      // Palette: a fixed outfit, or the next one each breakdown. Either way
      // it melts over about five seconds rather than cutting.
      const pm = Math.round(params.palette) || 0;
      if (this.pal === null) this.pal = pm === 0 ? 0 : pm - 1;
      if (pm === 0) this.palTarget = this.drops;
      else {
        const want = pm - 1, n = OUTFITS.length;
        const cur = ((Math.round(this.palTarget) % n) + n) % n;
        if (cur !== want) this.palTarget = Math.round(this.palTarget) + ((want - cur + n) % n);
      }
      if (this.pal < this.palTarget) this.pal = Math.min(this.palTarget, this.pal + dt / 5);
      else if (this.pal > this.palTarget) this.pal = this.palTarget;
      const P = outfitAt(this.pal);

      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const px = S / 600;
      const g = p.drawingContext;
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.lineJoin = 'round'; g.lineCap = 'round';

      // ---- camera ---------------------------------------------------------
      // One perspective for every layer, so a drift of the camera is felt as
      // parallax: stars barely move, passing rings sweep, the angel between.
      const spd = 1 * (0.45 + 1.4 * G);
      this.rayRot += dt * 0.05 * (0.5 + G);
      this.orbit += dt * 0.11 * (0.6 + 0.6 * G);
      this.dustT += dt * (0.5 + 0.9 * G);
      this.morphT += dt * (0.6 + 0.9 * G);
      const cx = W / 2, cy = H / 2 + S * 0.01;
      const F = S * 0.29 * 4.2;
      const Dc = 4.2 * (1 - 0.1 * G - 0.05 * Math.sin(t * TAU / 47));
      const camX = 0.34 * Math.sin(t * TAU / 37) + 0.1 * Math.sin(t * TAU / 13.3 + 1);
      const camY = 0.1 * Math.sin(t * TAU / 29 + 1.3);
      const roll = 0.045 * Math.sin(t * TAU / 41 + 0.5);
      const proj = (v) => { const kk = F / (Dc - v[2]); return [cx + (v[0] - camX) * kk, cy - (v[1] - camY) * kk, v[2]]; };
      const toCam = (v) => norm([camX - v[0], camY - v[1], Dc - v[2]]);
      const U = F / Dc;
      const acx = cx - camX * U, acy = cy + camY * U;
      const yaw = 0.42 * Math.sin(this.orbit * 0.4) + 0.2 * Math.sin(this.orbit * 0.13);
      const pitch = 0.3 + 0.22 * Math.sin(this.orbit * 0.29 + 1.3);

      // ---- ground ---------------------------------------------------------
      const diag = Math.hypot(W, H);
      const bg = g.createRadialGradient(acx, acy, 0, cx, cy, diag * 0.55);
      bg.addColorStop(0, rgb(P.g0)); bg.addColorStop(1, rgb(P.g1));
      g.fillStyle = bg; g.fillRect(-2, -2, W + 4, H + 4);

      g.translate(cx, cy); g.rotate(roll); g.translate(-cx, -cy);

      // ---- stars ------------------------------------------------------------
      const vStar = (0.5 + 10 * G * G) * flight;
      const shutter = 0.075;
      for (let i = 0; i < this.stars.length; i++) {
        const st = this.stars[i];
        st.z += vStar * dt;
        if (Dc - st.z < 0.35) this.stars[i] = this.newStar(this.starSeed++, st.z - 47);
      }
      // Six batches (three depths by two twinkle groups), each stroked three
      // times in red, green and blue, offset radially and added: white in the
      // middle, a split into colour at the ends, like a lens.
      const ca = (0.006 + 0.022 * G) * (0.6 + 0.4 * flight);
      const tw = [0.75 + 0.25 * Math.sin(t * 1.3) + 0.5 * this.hatSlow * vnoise(t * 7, 1), 0.75 + 0.25 * Math.sin(t * 1.1 + 2) + 0.5 * this.hatSlow * vnoise(t * 7 + 5, 2)];
      const CH = [[255, 60, 110, 1], [70, 255, 150, 0], [110, 120, 255, -1]];
      g.globalCompositeOperation = 'lighter';
      for (let bin = 0; bin < 3; bin++) {
        for (let gr = 0; gr < 2; gr++) {
          for (const ch of CH) {
            const off = 1 + ch[3] * ca;
            g.beginPath();
            for (let i = 0; i < this.stars.length; i++) {
              const st = this.stars[i];
              if (st.tw !== gr) continue;
              const d = Dc - st.z;
              const b = d > 14 ? 0 : d > 5 ? 1 : 2;
              if (b !== bin) continue;
              const k1 = F / d, k2 = F / (d + vStar * shutter + 0.02);
              const hx = (st.x - camX) * k1 * off, hy = -(st.y - camY) * k1 * off;
              const tx2 = (st.x - camX) * k2 * off, ty2 = -(st.y - camY) * k2 * off;
              if (Math.abs(hx) > W && Math.abs(hy) > H) continue;
              g.moveTo(cx + hx, cy + hy); g.lineTo(cx + tx2, cy + ty2);
            }
            const fade = [0.55, 0.85, 1][bin] * tw[gr];
            g.strokeStyle = rgba(ch, fade * 0.8);
            g.lineWidth = [1.2, 1.8, 2.6][bin] * px;
            g.stroke();
          }
        }
      }
      g.globalCompositeOperation = 'source-over';

      // ---- flying rings: advance, spawn, geometry ---------------------------
      const vRing = (0.55 + 3.2 * G) * flight;
      const spacing = 4.2;
      for (const f of this.flyers) { f.z += vRing * dt; f.spin += f.spinV * dt * (0.6 + G); }
      this.flyers = this.flyers.filter((f) => f.z < Dc - 0.8);
      this.sinceSpawn += vRing * dt;
      // Calm: evenly spaced in depth. Drop: every kick launches one, so the
      // rings arrive in the rhythm of the track.
      if (this.sinceSpawn > spacing || (this.kickNow && G > 0.55 && this.sinceSpawn > 1.2)) this.spawn(RING_FAR);
      const fly = this.buildFlyers(proj, Dc, t, morph, G, px);

      // ---- back halves of the flying rings --------------------------------
      this.drawFlyers(g, P, fly, 0, px);

      // ---- mandorla: nested translucent bands whose overlaps stack colour ---
      const mBreath = 0.5 + 0.5 * Math.sin(this.morphT * 0.21);
      const mEx = 1 + (0.25 + 0.75 * mBreath) * (0.4 + 0.6 * morph) * 0.8;
      const BANDS = 6;
      for (let b = 0; b < BANDS; b++) {
        const f = 1 - b * 0.12;
        const sh = { R: 1, a: 0.03 * morph * (b % 2 ? 1 : -1), k: 6 + b * 2, lp: this.morphT * 0.1 * (b % 2 ? 1 : -1), ex: mEx };
        g.beginPath();
        for (let i = 0; i <= 72; i++) {
          const q = shapeXY(sh, i * TAU / 72);
          const x = acx + q[0] * 1.1 * U * f, y = acy + q[1] * 1.52 * U * f;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
        g.fillStyle = rgba(P.inks[[3, 1, 0, 3, 1, 2][b]], 0.14 + 0.012 * b);
        g.fill();
        g.lineWidth = px * (b === 0 ? 1.8 : 0.9);
        g.strokeStyle = rgba(P.gold, b === 0 ? 0.75 : 0.35);
        g.stroke();
      }

      // ---- rays: fine lines of light, two inks, inside the being -------------
      if (glory > 0.01) {
        const Rr = U * (1.15 + 0.75 * G) * (0.6 + 0.4 * glory);
        const NR = 96;
        const ra = clamp((0.22 + 0.33 * G) * glory, 0, 1);
        g.globalCompositeOperation = 'lighter';
        for (let pass = 0; pass < 2; pass++) {
          const col = pass ? P.inks[1] : P.inks[0];
          const rg = g.createRadialGradient(acx, acy, U * 0.1, acx, acy, Rr);
          rg.addColorStop(0, rgba(col, 0)); rg.addColorStop(0.3, rgba(col, ra)); rg.addColorStop(0.6, rgba(col, ra * 0.6)); rg.addColorStop(1, rgba(col, 0));
          g.strokeStyle = rg;
          g.beginPath();
          for (let i = pass; i < NR; i += 2) {
            const an = this.rayRot * (pass ? -0.6 : 1) + i * TAU / NR;
            const L = Rr * (pass ? 0.55 + 0.2 * vnoise(t * 0.5 + i, 3) : 0.8 + 0.25 * vnoise(t * 0.4 + i * 3.7, 2));
            g.moveTo(acx + Math.cos(an) * U * 0.32, acy + Math.sin(an) * U * 0.32);
            g.lineTo(acx + Math.cos(an) * L, acy + Math.sin(an) * L);
          }
          g.lineWidth = (pass ? 1.8 : 1.2) * px;
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
      }

      // ---- wings --------------------------------------------------------------
      const wingMode = Math.round(params.wings) || 0;
      if (wingMode < 2) {
        const fitX = clamp((W / 2) / (2.55 * U), 0.62, 1.12);
        const names = wingMode === 0 ? ['mid', 'lower', 'upper'] : ['mid'];
        const breath = Math.sin(t * 0.9) * 2.5;
        for (const nm of names) {
          for (const side of [1, -1]) {
            this.drawWing(g, P, WINGS[nm], nm, side, acx, acy, U, fitX * (1 + side * Math.sin(yaw) * 0.12), this.open, this.flap, breath, t, G, morph, px);
          }
        }
      }

      // ---- the wheels ---------------------------------------------------------
      const L = norm([-0.45, 0.62, 0.65]);
      const B = mul(rotY(yaw), rotX(pitch));
      const speeds = [0.11, -0.17, 0.23, -0.29, 0.34, -0.4];
      for (let r = 0; r < nRings; r++) this.ang[r] += dt * speeds[r] * spd;
      const fireLevel = clamp(0.25 + 0.55 * this.low + 0.45 * this.bassEnv, 0, 1.3);
      const frames = [];
      let Fm0 = mul(B, rotX(this.ang[0] + 1.2));
      frames.push(Fm0);
      for (let r = 1; r < nRings; r++) {
        Fm0 = mul(Fm0, r % 2 ? rotY(this.ang[r]) : rotX(this.ang[r]));
        frames.push(Fm0);
      }
      // Each wheel's profile on its own incommensurate clocks; the drop
      // deepens the morph so the wheels are most changeable at the peak.
      const md = morph * (0.55 + 0.45 * G);
      // Spring: w 13 rad/s, damping 0.3, about a third overshoot and settled
      // within half a second (Solids' sproing). Substepped so a dropped frame
      // cannot blow it up.
      const sub = Math.max(1, Math.ceil(dt / 0.008)), h = dt / sub, W0 = 13, Z = 0.3;
      for (let r = 0; r < nRings; r++) {
        const key = SHAPE_KEYS[this.step[r] % SHAPE_KEYS.length];
        for (let i = 0; i < sub; i++) {
          this.vEx[r] += (-W0 * W0 * (this.sEx[r] - key.ex) - 2 * Z * W0 * this.vEx[r]) * h;
          this.sEx[r] += this.vEx[r] * h;
          this.vA[r] += (-W0 * W0 * (this.sA[r] - key.a) - 2 * Z * W0 * this.vA[r]) * h;
          this.sA[r] += this.vA[r] * h;
        }
      }
      const shapes = [];
      for (let r = 0; r < nRings; r++) {
        const R = 1 - r * 0.13;
        const T1 = this.morphT * (0.23 + 0.071 * r) + r * 1.7;
        const T2 = this.morphT * (0.17 + 0.053 * r) + r * 2.9;
        shapes.push({
          R,
          ex: Math.max(0.7, 1 + morph * this.sEx[r] + 0.3 * md * Math.pow(0.5 + 0.5 * Math.sin(T1), 1.5)),
          a: morph * this.sA[r] + 0.05 * md * (0.5 + 0.5 * Math.sin(T2)),
          k: LOBES[r],
          lp: this.morphT * 0.13 * (r % 2 ? -1 : 1) + r,
          Wd: 0.135 * (0.7 + 0.3 * R) * (0.7 + 0.6 * (0.5 + 0.5 * Math.sin(this.morphT * (0.31 + 0.04 * r) + r * 4.1)) * (0.4 + 0.6 * morph) + 0.3 * (1 - morph) * 0.5),
        });
      }
      const ringPt = (r, th, h) => {
        const q = shapeXY(shapes[r], th);
        return app(frames[r], q[0], q[1], h || 0);
      };
      const items = [];
      const baseOpen = 0.08 + 0.92 * smooth(0.12, 0.9, G);
      const waveRing = Math.floor(t / 11) % nRings, waveT = t % 11;
      for (let r = 0; r < nRings; r++) {
        const Fm = frames[r], sh = shapes[r], Wd = sh.Wd;
        const M = Math.max(40, Math.round(84 * sh.R));
        const top = [], bot = [], face = [], zq = [];
        for (let i = 0; i <= M; i++) {
          const th = this.phi[r] + i * TAU / M;
          const q = shapeXY(sh, th);
          top.push(proj(app(Fm, q[0], q[1], Wd)));
          bot.push(proj(app(Fm, q[0], q[1], -Wd)));
        }
        for (let i = 0; i < M; i++) {
          const th = this.phi[r] + (i + 0.5) * TAU / M;
          const q = shapeXY(sh, th), q2 = shapeXY(sh, th + 0.002);
          // outward normal of the profile, in the ring's plane
          const n = norm(app(Fm, q2[1] - q[1], -(q2[0] - q[0]), 0));
          const mid = app(Fm, q[0], q[1], 0);
          face.push(dot(n, toCam(mid)) >= 0 ? 1 : 0);
          zq.push(mid[2]);
        }
        // Group the band into runs of one facing and fill each run as one
        // polygon: translucent quads filled one by one leave hairline seams.
        let i0 = 0;
        for (let i = 0; i < M; i++) if (face[i] !== face[(i + M - 1) % M]) { i0 = i; break; }
        const runs = [];
        let cur = null;
        for (let c = 0; c < M; c++) {
          const i = (i0 + c) % M;
          if (!cur || cur.face !== face[i]) { cur = { face: face[i], idx: [], z: 0 }; runs.push(cur); }
          cur.idx.push(i); cur.z += zq[i];
        }
        const whole = runs.length === 1;
        const fl = this.flare[r];
        const ink = P.inks[RING_INK[r]];
        const quadRun = new Int16Array(M);
        runs.forEach((run, ri) => {
          run.z /= run.idx.length;
          for (const i of run.idx) quadRun[i] = ri;
          const col = run.face ? mixc(ink, WHITE, 0.12 + 0.35 * fl) : mixc(ink, P.g1, 0.45);
          const edge = run.face ? mixc(P.gold, P.goldHi, 0.4 + 0.6 * fl) : mixc(P.goldDk, P.gold, 0.5 + 0.5 * fl);
          run.item = { z: run.z, k: 0, top, bot, idx: run.idx, whole, M, col, alpha: run.face ? 0.6 : 0.42, edge, fl, eyes: [] };
          items.push(run.item);
        });
        // eyes on the outer face, drawn with the run they sit on so the
        // translucent band never veils them
        const N = Math.max(6, Math.round(eyes * sh.R));
        const spacingE = TAU * sh.R / N;
        const eu = Math.min(0.42 * spacingE, 0.9 * 0.135 * (0.7 + 0.3 * sh.R)), ev = eu;
        for (let j = 0; j < N; j++) {
          const th = this.phi[r] + (j + 0.5) * TAU / N;
          const q = shapeXY(sh, th), q2 = shapeXY(sh, th + 0.002);
          const P0 = app(Fm, q[0], q[1], 0);
          const n = norm(app(Fm, q2[1] - q[1], -(q2[0] - q[0]), 0));
          const c = toCam(P0);
          const facing = dot(n, c);
          if (facing < 0.1) continue;
          const T = norm(app(Fm, q2[0] - q[0], q2[1] - q[1], 0));
          const A = app(Fm, 0, 0, 1);
          const e = 0.01;
          const p0 = proj(P0);
          const pT = proj([P0[0] + T[0] * e, P0[1] + T[1] * e, P0[2] + T[2] * e]);
          const pA = proj([P0[0] + A[0] * e, P0[1] + A[1] * e, P0[2] + A[2] * e]);
          const sT = [(pT[0] - p0[0]) / e, (pT[1] - p0[1]) / e], sA = [(pA[0] - p0[0]) / e, (pA[1] - p0[1]) / e];
          const psi = Math.atan2(-sT[1], sA[1]);
          const cp = Math.cos(psi), sp = Math.sin(psi);
          let tx = [cp * sT[0] + sp * sA[0], cp * sT[1] + sp * sA[1]], ay = [-sp * sT[0] + cp * sA[0], -sp * sT[1] + cp * sA[1]];
          const Uw = [cp * T[0] + sp * A[0], cp * T[1] + sp * A[1], cp * T[2] + sp * A[2]];
          const Vw = [-sp * T[0] + cp * A[0], -sp * T[1] + cp * A[1], -sp * T[2] + cp * A[2]];
          let gx = dot(c, Uw), gy = dot(c, Vw);
          if (tx[0] < 0) { tx = [-tx[0], -tx[1]]; gx = -gx; }
          if (ay[1] < 0) { ay = [-ay[0], -ay[1]]; gy = -gy; }
          let blink = 1;
          const ph = hash(r * 100 + j * 7.3), per = 7 + 7 * hash(r * 31 + j * 3.1);
          const lb = (t + ph * per) % per;
          if (lb < 0.6) blink = Math.min(blink, 1 - Math.pow(Math.sin(Math.PI * lb / 0.6), 2));
          if (r === waveRing) {
            const lw = waveT - 1 - j * 0.1;
            if (lw > 0 && lw < 0.6) blink = Math.min(blink, 1 - Math.pow(Math.sin(Math.PI * lw / 0.6), 2));
          }
          const open = clamp(baseOpen + 0.45 * fl, 0, 1.05) * blink;
          const qi = Math.min(M - 1, Math.floor(((j + 0.5) / N) * M));
          runs[quadRun[qi]].item.eyes.push({ p0, tx, ay, eu, ev, gx, gy, open, fl, alpha: smooth(0.1, 0.3, facing) });
        }
      }
      // axles joining each ring to its parent: the child turns about an axis
      // in the parent's plane, so both ends sit on that axis (for the odd
      // rings the lens points, where the pinch meets the axle)
      for (let r = 1; r < nRings; r++) {
        for (const sg of [1, -1]) {
          const th = r % 2 ? sg * Math.PI / 2 : (sg > 0 ? 0 : Math.PI);
          const a1 = proj(ringPt(r, th)), b1 = proj(ringPt(r - 1, th));
          items.push({ z: (a1[2] + b1[2]) / 2 + 0.01, k: 2, a: a1, b: b1 });
        }
      }
      items.push({ z: 0, k: 3 });
      items.sort((m, n) => m.z - n.z);

      for (const it of items) {
        if (it.k === 0) {
          const { top, bot, idx, M } = it;
          g.beginPath();
          if (it.whole) {
            for (let i = 0; i <= M; i++) { const q = top[i]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
            g.closePath();
            for (let i = 0; i <= M; i++) { const q = bot[i]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
            g.closePath();
          } else {
            g.moveTo(top[idx[0]][0], top[idx[0]][1]);
            for (const i of idx) g.lineTo(top[i + 1][0], top[i + 1][1]);
            for (let c = idx.length - 1; c >= 0; c--) { const i = idx[c]; g.lineTo(bot[i + 1][0], bot[i + 1][1]); }
            g.lineTo(bot[idx[0]][0], bot[idx[0]][1]);
            g.closePath();
          }
          g.fillStyle = rgba(it.col, it.alpha);
          g.fill('evenodd');
          // gold rims along both edges of the band
          g.beginPath();
          g.moveTo(top[idx[0]][0], top[idx[0]][1]);
          for (const i of idx) g.lineTo(top[i + 1][0], top[i + 1][1]);
          g.moveTo(bot[idx[0]][0], bot[idx[0]][1]);
          for (const i of idx) g.lineTo(bot[i + 1][0], bot[i + 1][1]);
          g.lineWidth = (1.3 + 1.6 * it.fl) * px; g.strokeStyle = rgb(it.edge); g.stroke();
          for (const e of it.eyes) {
            g.save();
            g.globalAlpha = e.alpha;
            g.transform(e.tx[0] * e.eu, e.tx[1] * e.eu, e.ay[0] * e.ev, e.ay[1] * e.ev, e.p0[0], e.p0[1]);
            drawEye(g, P, e.open, e.gx, e.gy, e.fl, 1, true);
            g.restore();
          }
        } else if (it.k === 2) {
          g.beginPath(); g.moveTo(it.a[0], it.a[1]); g.lineTo(it.b[0], it.b[1]);
          g.lineWidth = 3 * px; g.strokeStyle = rgb(P.goldDk); g.stroke();
          g.lineWidth = 1.3 * px; g.strokeStyle = rgb(P.gold); g.stroke();
          g.beginPath(); g.arc(it.b[0], it.b[1], 3.2 * px, 0, TAU); g.fillStyle = rgb(P.goldHi); g.fill();
        } else {
          this.drawFire(g, P, acx, acy, U, fireLevel, glory, t, G, px);
        }
      }

      // ---- near halves of the flying rings ----------------------------------
      this.drawFlyers(g, P, fly, 1, px);

      // ---- lightning, sparks, glints ------------------------------------------
      g.globalCompositeOperation = 'lighter';
      const boltPt = (r, th) => (r < 0 ? [0, 0, 0] : ringPt(r, th + this.phi[r]));
      this.bolts = this.bolts.filter((b) => t - b.t0 < 0.22);
      for (const b of this.bolts) {
        const age = (t - b.t0) / 0.22;
        const a1 = proj(boltPt(b.a < nRings ? b.a : 0, b.ta)), c1 = proj(boltPt(b.b < nRings ? b.b : 0, b.tb));
        const dx = c1[0] - a1[0], dy = c1[1] - a1[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const pts = [];
        const NS = 14;
        for (let i = 0; i <= NS; i++) {
          const u = i / NS, env = Math.sin(Math.PI * u);
          const off = (hash(b.seed * 3.7 + i * 1.31 + Math.floor(t * 30) * 0.17) - 0.5) * len * 0.22 * env;
          pts.push([a1[0] + dx * u + nx * off, a1[1] + dy * u + ny * off]);
        }
        const al = (1 - age) * b.amp;
        for (const [w, aa, col] of [[5, 0.2, P.inks[0]], [2.2, 0.5, P.inks[1]], [1, 1, P.goldHi]]) {
          g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
          g.lineWidth = w * px; g.strokeStyle = rgba(col, aa * al); g.stroke();
        }
        if (!b.sp) {
          b.sp = true;
          for (let i = 0; i < 7; i++) {
            const e = i % 2 ? c1 : a1, an = hash(b.seed * 9 + i) * TAU, v = (40 + 90 * hash(b.seed * 5 + i * 2)) * px;
            this.sparks.push({ t0: t, x: e[0], y: e[1], vx: Math.cos(an) * v, vy: Math.sin(an) * v });
          }
          if (this.sparks.length > 60) this.sparks.splice(0, this.sparks.length - 60);
        }
      }
      this.sparks = this.sparks.filter((s) => t - s.t0 < 0.8);
      g.fillStyle = rgb(P.goldHi);
      for (const s of this.sparks) {
        const age = t - s.t0, f = 1 - age / 0.8;
        const x = s.x + s.vx * age, y = s.y + s.vy * age + 20 * px * age * age;
        g.globalAlpha = f;
        g.beginPath(); g.arc(x, y, 1.3 * px * (0.5 + f), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      this.glints = this.glints.filter((s) => t - s.t0 < 0.4);
      for (const s of this.glints) {
        if (s.r >= nRings) continue;
        const th = s.th + this.phi[s.r];
        const P0 = ringPt(s.r, th);
        const a2 = shapeXY(shapes[s.r], th), b2 = shapeXY(shapes[s.r], th + 0.002);
        const n = norm(app(frames[s.r], b2[1] - a2[1], -(b2[0] - a2[0]), 0));
        if (dot(n, toCam(P0)) < 0) continue;
        const q = proj(ringPt(s.r, th, shapes[s.r].Wd * s.e));
        const ag = (t - s.t0) / 0.4, f = Math.sin(Math.PI * Math.min(1, ag * 1.6)) * (1 - ag);
        const L2 = 11 * px * (0.4 + f);
        g.strokeStyle = rgba(P.goldHi, f); g.lineWidth = 1.1 * px;
        g.beginPath();
        g.moveTo(q[0] - L2, q[1]); g.lineTo(q[0] + L2, q[1]);
        g.moveTo(q[0], q[1] - L2); g.lineTo(q[0], q[1] + L2);
        g.stroke();
        g.beginPath(); g.arc(q[0], q[1], 1.8 * px, 0, TAU); g.fillStyle = rgba(P.goldHi, f); g.fill();
      }
      g.globalCompositeOperation = 'source-over';

      // ---- foreground: gold dust, with the most parallax --------------------
      g.fillStyle = rgb(P.gold);
      for (let i = 0; i < this.dust.length; i++) {
        const d = this.dust[i];
        const y = (((d.y - this.dustT * 0.03 * d.v) % 1) + 1) % 1;
        const x = d.x + 0.015 * Math.sin(t * 0.5 + d.ph) - (yaw * 0.05 + camX * 0.12) * d.v;
        g.globalAlpha = (0.22 + 0.3 * G) * smooth(0, 0.15, y) * smooth(1, 0.8, y);
        g.beginPath(); g.arc(x * W, y * H, d.s * px * (1 + d.v * 0.6), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.restore();

      // ---- porthole: the corners darken into a round frame (#13) -----------
      g.save();
      g.globalCompositeOperation = 'source-over';
      const vg = g.createRadialGradient(cx, cy, diag * 0.28, cx, cy, diag * 0.56);
      vg.addColorStop(0, rgba(P.g1, 0)); vg.addColorStop(1, rgba(P.g1, 0.8));
      g.fillStyle = vg; g.fillRect(-2, -2, W + 4, H + 4);
      g.restore();
    },

    // Project every flying ring once per frame: the band's outer and inner
    // edges, their depths, and the ring's fade and line scale.
    buildFlyers(proj, Dc, t, morph, G, px) {
      const out = [];
      const NS = 72;
      for (const f of this.flyers) {
        const fadeIn = smooth(RING_FAR, RING_FAR + 7, f.z);
        const fadeOut = 1 - smooth(Dc - 2.2, Dc - 0.9, f.z);
        const alpha = fadeIn * fadeOut;
        if (alpha < 0.01) continue;
        const M = mul(rotY(f.ty), mul(rotX(f.tx), rotZ(f.spin)));
        // flying rings morph too, on their own clock through their flight
        const life = f.ph + t * 0.35;
        const sh = f.type === 1
          ? { R: f.R, ex: 1.7, a: 0, k: 1, lp: 0 }
          : { R: f.R, ex: 1 + 0.6 * morph * Math.pow(0.5 + 0.5 * Math.sin(life), 2), a: (f.type === 2 ? 0.1 : 0.05) * morph * (0.5 + 0.5 * Math.sin(life * 0.7 + 1)), k: f.k, lp: f.lp + t * 0.2 };
        const bw = f.type === 0 ? 0.05 : f.type === 1 ? 0.12 : 0.17;
        const outer = [], inner = [], zs = [];
        for (let i = 0; i <= NS; i++) {
          const th = i * TAU / NS;
          const q = shapeXY(sh, th);
          const w1 = app(M, q[0], q[1], 0), w2 = app(M, q[0] * (1 - bw), q[1] * (1 - bw), 0);
          const a1 = [w1[0] + f.x0, w1[1] + f.y0, w1[2] + f.z];
          const a2 = [w2[0] + f.x0, w2[1] + f.y0, w2[2] + f.z];
          zs.push(a1[2]);
          outer.push(a1[2] < Dc - 0.25 ? proj(a1) : null);
          inner.push(a2[2] < Dc - 0.25 ? proj(a2) : null);
        }
        const centre = [f.x0, f.y0, f.z];
        const sc = ppu(proj, centre);
        const spokes = [];
        if (f.type === 2) {
          for (let j = 0; j < 8; j++) {
            const th = j * TAU / 8 + 0.2;
            const q = shapeXY(sh, th);
            const h1 = app(M, q[0] * 0.16, q[1] * 0.16, 0), h2 = app(M, q[0] * (1 - bw), q[1] * (1 - bw), 0);
            const a1 = [h1[0] + f.x0, h1[1] + f.y0, h1[2] + f.z], a2 = [h2[0] + f.x0, h2[1] + f.y0, h2[2] + f.z];
            if (a1[2] < Dc - 0.25 && a2[2] < Dc - 0.25) spokes.push({ a: proj(a1), b: proj(a2), z: (a1[2] + a2[2]) / 2 });
          }
        }
        const eyesOn = [];
        if (f.type === 0) {
          const NE = 14;
          for (let j = 0; j < NE; j++) {
            const th = (j + 0.5) * TAU / NE;
            const q = shapeXY(sh, th);
            const w1 = app(M, q[0] * (1 - bw * 0.5), q[1] * (1 - bw * 0.5), 0);
            const a1 = [w1[0] + f.x0, w1[1] + f.y0, w1[2] + f.z];
            if (a1[2] < Dc - 0.4) eyesOn.push({ p: proj(a1), z: a1[2], j });
          }
        }
        out.push({ f, alpha, outer, inner, zs, sc, spokes, eyesOn, NS, hub: f.z < Dc - 0.4 ? proj(centre) : null });
      }
      return out;
    },

    // pass 0: the parts beyond the angel's depth; pass 1: the parts nearer.
    drawFlyers(g, P, fly, pass, px) {
      for (const R of fly) {
        const { f, alpha, outer, inner, zs, NS, sc } = R;
        const lw = clamp(sc / 174, 0.3, 4);
        const ink = P.inks[f.ink];
        const inPass = (i) => outer[i] && outer[i + 1] && inner[i] && inner[i + 1] && ((zs[i] + zs[i + 1]) * 0.5 < 0 ? 0 : 1) === pass;
        // contiguous runs of segments in this pass
        let i0 = -1;
        for (let i = 0; i < NS; i++) if (!inPass((i + NS - 1) % NS) && inPass(i)) { i0 = i; break; }
        const runs = [];
        if (i0 < 0) {
          if (inPass(0)) runs.push({ whole: true });
        } else {
          let cur = null;
          for (let c = 0; c < NS; c++) {
            const i = (i0 + c) % NS;
            if (inPass(i)) { if (!cur) { cur = []; runs.push(cur); } cur.push(i); } else cur = null;
          }
        }
        if (runs.length) {
          g.beginPath();
          for (const run of runs) {
            if (run.whole) {
              for (let i = 0; i <= NS; i++) { const q = outer[i]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
              g.closePath();
              for (let i = NS; i >= 0; i--) { const q = inner[i]; if (i < NS) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
              g.closePath();
            } else {
              g.moveTo(outer[run[0]][0], outer[run[0]][1]);
              for (const i of run) g.lineTo(outer[i + 1][0], outer[i + 1][1]);
              for (let c = run.length - 1; c >= 0; c--) g.lineTo(inner[run[c] + 1][0], inner[run[c] + 1][1]);
              g.lineTo(inner[run[0]][0], inner[run[0]][1]);
              g.closePath();
            }
          }
          g.fillStyle = rgba(ink, (f.type === 0 ? 0.5 : 0.36) * alpha);
          g.fill('evenodd');
          // gold wire on both edges
          g.beginPath();
          for (const run of runs) {
            const ids = run.whole ? Array.from({ length: NS }, (_, i) => i) : run;
            for (const E of [outer, inner]) {
              g.moveTo(E[ids[0]][0], E[ids[0]][1]);
              for (const i of ids) g.lineTo(E[i + 1][0], E[i + 1][1]);
            }
          }
          g.lineWidth = 1.1 * lw * px;
          g.strokeStyle = rgba(P.gold, 0.85 * alpha);
          g.stroke();
        }
        if (R.spokes.length) {
          g.beginPath();
          for (const s of R.spokes) if ((s.z < 0 ? 0 : 1) === pass) { g.moveTo(s.a[0], s.a[1]); g.lineTo(s.b[0], s.b[1]); }
          g.lineWidth = 1.2 * lw * px; g.strokeStyle = rgba(P.gold, 0.7 * alpha); g.stroke();
          if (R.hub && (f.z < 0 ? 0 : 1) === pass) {
            g.beginPath(); g.arc(R.hub[0], R.hub[1], 0.16 * f.R * sc, 0, TAU);
            g.moveTo(R.hub[0] + 0.07 * f.R * sc, R.hub[1]); g.arc(R.hub[0], R.hub[1], 0.07 * f.R * sc, 0, TAU);
            g.fillStyle = rgba(ink, 0.4 * alpha); g.fill('evenodd');
            g.lineWidth = 1.2 * lw * px; g.strokeStyle = rgba(P.gold, 0.8 * alpha); g.stroke();
          }
        }
        if (R.eyesOn.length) {
          const es = 0.1 * sc;
          for (const e of R.eyesOn) {
            if ((e.z < 0 ? 0 : 1) !== pass) continue;
            let blink = 1;
            const per = 6 + 5 * hash(f.n * 3 + e.j), lb = (this.lastT + hash(f.n * 7 + e.j * 1.3) * per) % per;
            if (lb < 0.6) blink = 1 - Math.pow(Math.sin(Math.PI * lb / 0.6), 2);
            g.save();
            g.globalAlpha = alpha;
            g.translate(e.p[0], e.p[1]);
            g.scale(es, es);
            drawEye(g, P, (0.35 + 0.65 * this.G) * blink, 0, 0, 0, 1, true);
            g.restore();
          }
        }
      }
    },

    // Painted fire: crowns of petal tongues in translucent flame inks, a
    // white heart added as light, and a thin nimbus that the bass swells.
    drawFire(g, P, cx, cy, U, lvl, glory, t, G, px) {
      const gl = Math.max(0.2, glory);
      const R = U * (0.26 + 0.24 * lvl) * (0.7 + 0.3 * gl);
      g.save();
      const crowns = [
        { n: 11, len: 1.5, w: 0.17, col: P.fireC, sp: 0.2, bend: 0.14, a: 0.8 },
        { n: 9, len: 1.12, w: 0.16, col: P.fireM, sp: -0.3, bend: -0.12, a: 0.85 },
        { n: 7, len: 0.78, w: 0.15, col: P.fireB, sp: 0.45, bend: 0.1, a: 0.9 },
      ];
      crowns.forEach((c, layer) => {
        g.fillStyle = rgba(c.col, c.a);
        g.beginPath();
        for (let i = 0; i < c.n; i++) {
          const an = i * TAU / c.n + t * c.sp + layer * 0.4;
          const len = R * c.len * (0.72 + 0.5 * vnoise(t * 2.4 + i * 5.1, layer + 4));
          leaf(g, cx, cy, Math.cos(an), Math.sin(an), len, R * c.w, c.bend);
        }
        g.fill();
      });
      // The heart is painted, not added: with pink and cyan rays and the
      // Finish's bloom on top, an additive white heart summed the whole
      // centre of the drop to white. A small white-gold point over a
      // saturated rose-gold core keeps the colour at the peak.
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
      rg.addColorStop(0, rgba(mixc(P.fireB, P.fireA, 0.6), 0.95));
      rg.addColorStop(0.18, rgba(P.fireB, 0.85));
      rg.addColorStop(0.55, rgba(mixc(P.fireB, P.fireC, 0.45), 0.5));
      rg.addColorStop(1, rgba(P.fireC, 0));
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cy, R * 0.9, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      const nim = clamp((0.2 + 0.7 * this.bassEnv) * glory, 0, 1);
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(cx, cy, R * (1.7 + 0.55 * i) * (1 + 0.08 * this.bassEnv), 0, TAU);
        g.lineWidth = (1.4 - 0.3 * i) * px;
        g.strokeStyle = rgba(i === 1 ? P.inks[1] : P.fireB, nim * (0.7 - 0.18 * i));
        g.stroke();
      }
      g.restore();
    },

    // V1's wing, translucent: feathers in the wing's ink overlap one another
    // and the other pairs, so the colours mix where they cross. `open` runs
    // from the closed shell (negative) through V1's folded pose (0) to spread
    // (1); a length wave runs along the feathers with the morph.
    drawWing(g, P, w, nm, side, cx, cy, U, fitX, open, flap, breath, t, G, morph, px0) {
      g.save();
      g.translate(cx, cy);
      g.scale(side * fitX, 1);
      const px = px0 / Math.max(0.3, fitX);
      const fl = flap * w.flap;
      // V1's pose between folded (0) and spread (1); below 0 it bends on into
      // the shell: the upper pair arches over the head, the lower pair under
      // the feet, the flying pair stands up along the sides.
      const sp = clamp(open, 0, 1.2), fan = 0.5 + 0.5 * sp;
      let bone = lerp(w.boneF, w.boneS, sp);
      let dRd = bone + (w.dRoot - w.boneS) * fan, dWd = bone + (w.dWrist - w.boneS) * fan, lenK = 1;
      const c = smooth(0, 0.6, -open);
      if (c > 0) {
        bone = lerp(bone, w.shell.bone, c); dRd = lerp(dRd, w.shell.dR, c); dWd = lerp(dWd, w.shell.dW, c);
        lenK = lerp(1, w.shell.len, c);
      }
      const br = breath * (nm === 'mid' ? 1 : 0.6);
      bone += fl * 0.5 + br;
      const dR = (dRd + fl * 0.4 + br) * DEG;
      const dW = (dWd + fl * 0.6 + br) * DEG;
      const rx = w.root[0] * U, ry = w.root[1] * U;
      const shrink = lenK;
      const bx = Math.cos(bone * DEG) * w.boneLen * U * shrink, by = Math.sin(bone * DEG) * w.boneLen * U * shrink;
      const n = w.n;
      const ink = P.inks[w.ink];
      const feathers = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const at = 0.12 + 0.88 * u;
        const d = lerp(dR, dW, Math.pow(u, 0.9));
        const wave = 1 + 0.13 * morph * Math.sin(u * TAU * 1.2 - t * 1.4);
        const ruffle = 1 + 0.035 * (vnoise(t * 0.8 + i * 3.1 + side * 7, 9) - 0.5);
        feathers.push({ ax: rx + bx * at, ay: ry + by * at, dx: Math.cos(d), dy: Math.sin(d), L: lerp(w.lRoot, w.lWrist, Math.pow(u, 0.7)) * U * ruffle * wave * shrink, u });
      }
      const bend = (nm === 'upper' ? -0.06 : 0.06) * (1 + 0.8 * morph * Math.sin(t * 0.37));
      const wire = rgba(P.wire, 0.55);
      const tip = rgba(mixc(ink, WHITE, 0.4), 0.3);
      const body = rgba(ink, 0.34);
      // primaries
      for (const f of feathers) {
        const wd = U * 0.075 * (0.8 + 0.4 * f.u);
        g.beginPath(); leaf(g, f.ax, f.ay, f.dx, f.dy, f.L, wd, bend);
        g.fillStyle = body; g.fill();
        g.lineWidth = 0.9 * px; g.strokeStyle = wire; g.stroke();
        g.beginPath(); leaf(g, f.ax + f.dx * f.L * 0.55, f.ay + f.dy * f.L * 0.55, f.dx, f.dy, f.L * 0.45, wd * 0.55, bend);
        g.fillStyle = tip; g.fill();
      }
      g.beginPath();
      for (const f of feathers) { g.moveTo(f.ax, f.ay); g.lineTo(f.ax + f.dx * f.L * 0.92, f.ay + f.dy * f.L * 0.92); }
      g.lineWidth = 0.8 * px; g.strokeStyle = rgba(P.gold, 0.75); g.stroke();
      // coverts
      const cov = rgba(P.inks[2], 0.36);
      for (let i = 1; i < n; i++) {
        const f = feathers[i];
        const wd = U * 0.085 * (0.8 + 0.4 * f.u);
        g.beginPath(); leaf(g, f.ax, f.ay, f.dx, f.dy, f.L * 0.5, wd, bend);
        g.fillStyle = cov; g.fill();
        g.lineWidth = 0.9 * px; g.strokeStyle = rgba(P.gold, 0.7); g.stroke();
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
        const L2 = lerp(w.lRoot, w.lWrist, Math.pow(u, 0.7)) * U * 0.27 * shrink;
        const wd = U * 0.075;
        g.beginPath(); leaf(g, ax, ay, dx, dy, L2, wd, 0);
        g.fillStyle = rgba(P.setting, 0.8); g.fill();
        g.lineWidth = 1 * px; g.strokeStyle = rgb(P.gold); g.stroke();
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
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + bx, ry + by);
      g.lineWidth = 2.2 * px; g.strokeStyle = rgb(P.gold); g.stroke();
      g.restore();
    },
  });

  // Virtual pixels per world unit at a point's depth (174 at the angel's
  // plane): line widths and eye sizes on the flying rings follow it.
  function ppu(proj, c) {
    const a = proj(c), b = proj([c[0] + 0.01, c[1], c[2]]);
    return Math.abs(b[0] - a[0]) / 0.01;
  }
})();
