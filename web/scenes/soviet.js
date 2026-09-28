// Mass Poster: the later Soviet mass-poster idiom (Klutsis's photomontage
// giants, Koretsky's and Ivanov's heroic scale), borrowed as graphic language
// only, for a night of dancing. Two colossal figures seen from far below, a
// woman and a man in black silhouette with a red plate printed out of register
// behind them, tower over a massed crowd; a red sunburst radiates from low
// between them; huge slanted type runs up the left of the sheet. No state or
// political symbols anywhere: no stars, tools, flags or fists. The pair's
// raised hands are open, and in the drop they clasp to make an arch.
//
// Music, each in its own place:
//   kick   the front ranks of the crowd hop, in a ripple that spreads out from
//          the centre (the only thing the kick moves)
//   clap   the red back ranks throw their arms up in a wave, and the second
//          headline line sets its next letter while it is being set
//   hats   printed leaflets flutter down out of the sky
//   bass   the beams' turn, the crowd's march across the sheet, the giants' sway
//   drop   the giants reach across and clasp hands overhead, the beams go full
//          red and double, a fourth rank of the crowd rises, arms go up, the
//          red slab with the second line slides in under the headline; the
//          breakdown lets go of the hands, pales the beams and sinks the crowd
// Printed look: two inks multiplied onto a generated paper, the red plate a
// hair out of register, a fixed halftone screen modelling the giants where the
// sunburst lights them, paper showing through the ink. No glow.

(function () {
  const PRINTS = [
    { name: 'Red & black on cream', paper: '#E9DEC5', red: '#CF2A1E', fleck: [120, 96, 60] },
    { name: 'Red & black on newsprint', paper: '#DCD6C6', red: '#C8231F', fleck: [90, 88, 80] },
    { name: 'Scarlet on buff', paper: '#E3CFA6', red: '#DC3A1A', fleck: [115, 85, 45] },
  ];
  const BLACK = '#1B1714';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  // Every piece of a silhouette is added to one Path2D wound clockwise, so a
  // nonzero fill unions them: a multiplied ink laid once, with no darker seams
  // where an arm crosses the torso.
  function addPoly(path, pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    if (a < 0) pts = pts.slice().reverse();
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
    path.closePath();
  }
  // A closed curve through the midpoints of a polygon: soft, organic outlines
  // (heads, torsos) from a handful of points.
  function addSmooth(path, pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    if (a < 0) pts = pts.slice().reverse();
    const n = pts.length;
    const mid = (i) => { const p = pts[i % n], q = pts[(i + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    const m0 = mid(n - 1);
    path.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); path.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    path.closePath();
  }
  function addCircle(path, x, y, r) { path.moveTo(x + r, y); path.arc(x, y, r, 0, Math.PI * 2, false); }
  function addLimb(path, x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    addPoly(path, [[x1 + nx * r1, y1 + ny * r1], [x2 + nx * r2, y2 + ny * r2], [x2 - nx * r2, y2 - ny * r2], [x1 - nx * r1, y1 - ny * r1]]);
    addCircle(path, x1, y1, r1); addCircle(path, x2, y2, r2);
  }
  // Two-bone reach: the elbow that puts the hand on the target (or the arm
  // straight toward it when it is out of reach). bend picks the elbow's side.
  function reach(sx, sy, tx, ty, a, b, bend) {
    let dx = tx - sx, dy = ty - sy;
    let d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    d = clamp(d, Math.abs(a - b) + 1, a + b - 0.5);
    const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const base = Math.atan2(uy, ux) + bend * Math.acos(ca);
    const ex = sx + Math.cos(base) * a, ey = sy + Math.sin(base) * a;
    const wx = sx + ux * d, wy = sy + uy * d;
    return [ex, ey, wx, wy];
  }

  // Profile of a head facing +x, radius 1, centre at the origin: brow, nose,
  // lips, chin, then round under the jaw and up the back of the skull.
  const PROFILE = [
    [-0.55, -0.98], [0.1, -1.12], [0.72, -0.78], [0.9, -0.3], [1.02, -0.1], [1.2, 0.14], [0.94, 0.3],
    [1.0, 0.42], [0.9, 0.52], [0.98, 0.62], [0.9, 0.86], [0.55, 1.04], [0.3, 1.2], [-0.35, 1.15],
    [-0.8, 0.55], [-1.02, -0.2],
  ];
  // Torso from the hips up, facing +x in three-quarter view: chest forward,
  // shoulders broad (the low viewpoint widens them).
  const TORSO = [
    [-104, -250], [30, -262], [112, -248], [134, -214], [122, -150], [96, -70], [74, -8], [88, 120], [92, 260],
    [-92, 260], [-86, 120], [-74, -8], [-104, -110], [-128, -196],
  ];
  // Outer-arm targets relative to the outer shoulder (the figure facing +x,
  // so "outer" is -x), one per bar in the drop.
  const OUTER = [[-120, -290], [-240, -200], [-40, -310], [-260, -110]];

  VIZ.register({
    id: 'soviet',
    name: 'Mass Poster',
    order: 516,

    params: [
      { key: 'line1', label: 'Headline (a new word each drop)', type: 'text', default: 'DANCE / MOVE / SING' },
      { key: 'line2', label: 'Second line (in the drop)', type: 'text', default: 'TOGETHER! / EVERYBODY! / ALL NIGHT!' },
      { key: 'low', label: 'Camera low (heroic scale)', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'beams', label: 'Beams', type: 'range', min: 6, max: 30, default: 14, step: 1 },
      { key: 'crowd', label: 'Crowd density', type: 'range', min: 0.5, max: 1.8, default: 1, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'motion', label: 'Beam & march speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'print', label: 'Print', type: 'select', options: PRINTS.map((q) => q.name), default: 0 },
    ],

    actions: [
      { id: 'next', label: 'Next headline', run() { this.wantNext = true; } },
    ],

    gallery: {
      title: 'Mass Poster',
      technique: 'Canvas 2D in two multiplied inks on a generated paper texture: giant silhouettes built as one clockwise-wound Path2D each (a profile head, a three-quarter torso and two-bone arms reaching for targets), a fixed halftone screen clipped to them, a rotating sunburst of wedges, parallax ranks of crowd silhouettes, sheared and rotated display type; onset detection per band and a beat clock locked to the kicks',
      brief: 'A mass poster for a night of dancing, in red, black and cream. Two colossal figures, a woman and a man seen from far below, tower in black over a massed crowd, with a red sunburst radiating from low between them and huge slanted type up the left of the sheet. The crowd marches across the bottom in parallax ranks: every kick makes the front ranks hop in a ripple that spreads out from the centre, every clap throws the red back ranks\' arms up in a wave, and the hats send printed leaflets fluttering down out of the sky. In the build the giants reach toward each other; the drop clasps their hands overhead into an arch, turns the beams full red and doubles them, raises a fourth rank with its arms up and slides in a red slab under the headline whose second line sets itself a letter per beat. The breakdown lets go of the hands, pales the beams, sinks the crowd, and the next drop brings a new headline word.',
      lineage: [
        'The later Soviet mass poster, as graphic language only: Gustav Klutsis\'s photomontage giants rising over massed crowds, Viktor Koretsky\'s and Viktor Ivanov\'s heroic scale seen from below, the radiating beams of the 1930s-60s poster, huge slanted type; red, black and cream. No state or political symbols: no stars, tools, flags, fists or real slogans; the raised hands are open and meet each other, and the words are original, about dancing together. Deliberately unlike the Constructivist scene beside it (Rodchenko and Lissitzky geometry): here the image is figurative and monumental. Faces from web/fonts.js: Anton for the headline, Russo One for the slab and the small line.',
        'Process: first render read as the poster at once, but the giants were too big and too grey under the halftone, and in the build their inner arms reached horizontally and crossed into a knot in the middle of the sheet. Shrunk them, narrowed the halftone to the light of the source, sent the inner arms up from a raised open hand instead, and moved the clasp point low enough that the drop\'s arms go straight into an A-frame arch over the sunburst. A cream keyline round the headline keeps it whole where the woman\'s arm swings behind it; squarer stages shrink the giants and lift the headline.',
        'Jolt: the first pass was "noticeable" (ratio 3.95) and the heat map showed it was not the crowd at all but the giants: a beat bob on figures this size, and the arm pose changing on the downbeat. Removed the bob, slowed the pose change over nearly two beats, and phased the giants\' sway half a beat late so it rests on the kick and moves between beats. That left the kick with no hot spot, so the source now flares cream and throws one broad ring inside the arch, and the front ranks hop in a ripple from the centre. Final at 640x360: calm, kickArea 0.16, ratio 0.86 (build kick 0.05, ratio 1.01), with the hot spot on the source.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.ranks) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastClap = -10; this.lastHat = -10;
      this.kickTimes = []; this.kickCount = 0;
      this.beat = 0; this.beatFix = 0;
      this.low1 = 0; this.dense = false; this.denseAt = -10; this.calmAt = -10;
      this.bassSlow = 0; this.padEnv = 0; this.energy = 0; this.hatEnv = 0;
      this.rot = 0; this.march = 0; this.drift = 0;
      this.pres = 0; this.joinP = 0; this.reachP = 0;
      this.wordIdx = 0; this.slabIdx = 0; this.wantNext = false; this.setCount = 0;
      this.pose = 0; this.poseFrom = 0; this.poseAt = -10;
      this.leaves = [];
      this.paperKey = ''; this.toneKey = '';
      this.makeRanks();
    },

    // Four ranks, back to front: each person gets their own height, shoulder
    // width, head shape and how readily they put their arms up.
    makeRanks() {
      const r = mulberry(11);
      this.ranks = [];
      for (let k = 0; k < 4; k++) {
        const people = [];
        for (let i = 0; i < 48; i++) {
          people.push({
            jx: r() - 0.5, dh: r(), sw: 0.85 + 0.35 * r(), eager: r(),
            hair: r() < 0.4 ? 1 : r() < 0.5 ? 2 : 0, lean: r() - 0.5, ph: r() * 6.28,
          });
        }
        this.ranks.push(people);
      }
    },

    analyse(s, t, dt) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        this.kickTimes.push(t); if (this.kickTimes.length > 9) this.kickTimes.shift();
        // Lock the beat clock to the kick by spreading the error over a
        // quarter second, so the giants' sway never jumps.
        this.beatFix = Math.round(this.beat) - this.beat;
        if (this.kickCount % 4 === 1) { this.poseFrom = this.pose; this.pose++; this.poseAt = t; }
        if (this.dense) this.setCount++;
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastClap > 0.2) this.lastClap = t;
      if (bh > 26 && bh - Math.max(this.prev[7], this.prev[8]) > 8 && t - this.lastHat > 0.09) {
        this.lastHat = t;
        this.spawnLeaf(clamp(bh / 80, 0.3, 1));
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low1 += (s[1] - this.low1) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      // Slow on purpose: the drop's bass is sidechained to the kick, and a fast
      // follower would make the beams pulse the whole sheet on every beat.
      this.bassSlow += (bass - this.bassSlow) * k(0.7);
      this.padEnv += ((s[2] + s[3]) / 200 - this.padEnv) * k(0.8);
      this.hatEnv += ((s[7] + s[8]) / 200 - this.hatEnv) * k(1.2);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
    },

    beatPeriod() {
      const kt = this.kickTimes;
      if (kt.length < 3) return 0.484;
      const iv = [];
      for (let i = 1; i < kt.length; i++) iv.push(kt[i] - kt[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[iv.length >> 1];
      return med > 0.25 && med < 1.2 ? med : 0.484;
    },

    spawnLeaf(amp) {
      const r = this.rng;
      const n = this.dense ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.leaves.push({
          x: r(), y: -0.05 - r() * 0.05, vy: 0.06 + 0.05 * r(), sway: 0.02 + 0.03 * r(), ph: r() * 6.28,
          flip: r() * 6.28, fs: 2 + 3 * r(), spin: (r() - 0.5) * 1.5, size: 0.7 + 0.5 * r() * amp,
          red: r() < 0.35, lines: 2 + Math.floor(r() * 3),
        });
      }
      if (this.leaves.length > 70) this.leaves.splice(0, this.leaves.length - 70);
    },

    makePaper(p, pr) {
      const w = p.width * p.pixelDensity(), h = p.height * p.pixelDensity();
      const key = w + 'x' + h + ':' + pr.name;
      if (this.paperKey === key) return;
      this.paperKey = key;
      const r = mulberry(5);
      const paper = document.createElement('canvas');
      paper.width = w; paper.height = h;
      const g = paper.getContext('2d');
      g.fillStyle = pr.paper; g.fillRect(0, 0, w, h);
      const sc = Math.min(w, h) / 600;
      // Mottling drawn small and smoothed up (a canvas blur filter is far too
      // slow in software rendering).
      const lw = Math.max(8, Math.round(w / 16)), lh = Math.max(8, Math.round(h / 16));
      const lo = document.createElement('canvas');
      lo.width = lw; lo.height = lh;
      const lg = lo.getContext('2d');
      for (let i = 0; i < 300; i++) {
        const x = r() * lw, y = r() * lh, rad = (30 + r() * 110) * sc / 16;
        lg.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.035)' : 'rgba(255,250,235,0.05)';
        lg.beginPath(); lg.ellipse(x, y, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); lg.fill();
      }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(lo, 0, 0, w, h);
      // Age at the edges: posters that have hung on a wall.
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      vg.addColorStop(0, 'rgba(120,90,50,0)'); vg.addColorStop(1, 'rgba(120,90,50,0.13)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
      const f = pr.fleck;
      g.lineWidth = Math.max(0.6, 0.5 * sc);
      for (let i = 0; i < 800; i++) {
        const x = r() * w, y = r() * h, a = r() * Math.PI, l = (2 + r() * 7) * sc;
        g.strokeStyle = 'rgba(' + f.join(',') + ',' + (0.08 + r() * 0.14).toFixed(3) + ')';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i < 1200; i++) {
        g.fillStyle = 'rgba(' + f.join(',') + ',' + (0.1 + r() * 0.22).toFixed(3) + ')';
        g.fillRect(r() * w, r() * h, Math.max(1, sc * r() * 1.4), Math.max(1, sc * r() * 1.4));
      }
      // Wear: paper through the ink, specks and the odd dry streak; laid over
      // everything at the end.
      const wear = document.createElement('canvas');
      wear.width = w; wear.height = h;
      const q = wear.getContext('2d');
      q.fillStyle = pr.paper;
      for (let i = 0; i < 4200; i++) {
        q.globalAlpha = 0.2 + r() * 0.5;
        const s = sc * (0.5 + r() * r() * 2.2);
        q.fillRect(r() * w, r() * h, s, s);
      }
      q.globalAlpha = 0.06;
      q.lineWidth = Math.max(1, sc * 0.8);
      q.strokeStyle = pr.paper;
      for (let i = 0; i < 120; i++) {
        const y = r() * h, x = r() * w, l = (40 + r() * 240) * sc;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + l, y + (r() - 0.5) * 4 * sc); q.stroke();
      }
      q.globalAlpha = 1;
      this.paper = paper; this.wear = wear;
    },

    // The halftone screen that models the giants: paper-coloured dots on the
    // black, biggest nearest the sunburst's source, so the inner edges of the
    // figures read as lit by it. Fixed to the sheet like a real screen, and
    // regenerated only when the size or the source moves.
    makeTone(p, pr, sx, sy, H) {
      const d = p.pixelDensity();
      const sc = p.width / (this.W || p.width);
      const w = p.width * d, h = p.height * d;
      const key = w + 'x' + h + ':' + Math.round(sx) + ',' + Math.round(sy) + ':' + pr.name;
      if (this.toneKey === key) return;
      this.toneKey = key;
      const cv = this.tone || document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.fillStyle = pr.paper;
      const k = sc * d; // virtual units to device pixels
      const pitch = 5.4 * (H / 600) * k;
      const ang = 0.26, ca = Math.cos(ang), sa = Math.sin(ang);
      const R = 0.42 * H * k, cx = sx * k, cy = sy * k;
      g.beginPath();
      const span = Math.hypot(w, h);
      for (let v = -span; v < span; v += pitch) {
        for (let uu = -span; uu < span; uu += pitch) {
          const x = w / 2 + uu * ca - v * sa, y = h / 2 + uu * sa + v * ca;
          if (x < -pitch || y < -pitch || x > w + pitch || y > h + pitch) continue;
          const dd = Math.hypot(x - cx, (y - cy) * 0.8) / R;
          const lit = clamp(1 - dd, 0, 1);
          const rad = pitch * 0.56 * Math.pow(lit, 1.5);
          if (rad > 0.35 * d) { g.moveTo(x + rad, y); g.arc(x, y, rad, 0, Math.PI * 2); }
        }
      }
      g.fill();
      this.tone = cv;
    },

    // One colossal figure from the hips up, facing +x in its own frame
    // (mirrored by the caller). Returns its silhouette as one Path2D.
    giant(pose) {
      const path = new Path2D();
      addSmooth(path, TORSO);
      // neck and head, tipped back to look up at the hands
      addLimb(path, 10, -240, 34, 22, -292, 30);
      const hx = 30, hy = -336, hr = 50;
      const ct = Math.cos(pose.tilt), st = Math.sin(pose.tilt);
      const head = PROFILE.map(([x, y]) => {
        // pivot at the base of the skull, so the chin lifts rather than the
        // whole head sliding
        const px = x * hr, py = y * hr + hr * 0.7;
        return [hx + px * ct - py * st, hy - hr * 0.7 + px * st + py * ct];
      });
      addSmooth(path, head);
      // hair: a bob with a knot for her, a short crop for him
      const hc = (x, y) => [hx + (x * ct - y * st) * hr, hy + (x * st + y * ct) * hr];
      if (pose.her) {
        let [x, y] = hc(-0.35, -0.3); addCircle(path, x, y, hr * 0.92);
        [x, y] = hc(-1.1, 0.05); addCircle(path, x, y, hr * 0.36);
      } else {
        const [x, y] = hc(-0.2, -0.45); addCircle(path, x, y, hr * 0.8);
      }
      // arms
      const UA = 140, FA = 132;
      for (const arm of [pose.inner, pose.outer]) {
        const [ex, ey, wx, wy] = reach(arm.sx, arm.sy, arm.tx, arm.ty, UA, FA, arm.bend);
        addLimb(path, arm.sx, arm.sy, 36, ex, ey, 26);
        addLimb(path, ex, ey, 26, wx, wy, 18);
        // an open hand: a palm and a thumb, never a fist
        const a = Math.atan2(wy - ey, wx - ex);
        const hxp = wx + Math.cos(a) * 20, hyp = wy + Math.sin(a) * 20;
        addPoly(path, [
          [wx + Math.cos(a + 1.57) * 16, wy + Math.sin(a + 1.57) * 16],
          [hxp + Math.cos(a) * 26 + Math.cos(a + 1.57) * 12, hyp + Math.sin(a) * 26 + Math.sin(a + 1.57) * 12],
          [hxp + Math.cos(a) * 30 - Math.cos(a + 1.57) * 6, hyp + Math.sin(a) * 30 - Math.sin(a + 1.57) * 6],
          [wx - Math.cos(a + 1.57) * 17, wy - Math.sin(a + 1.57) * 17],
        ]);
        addLimb(path, wx - Math.cos(a + 1.57) * 12, wy - Math.sin(a + 1.57) * 12, 7,
          wx + Math.cos(a - 0.9) * 30, wy + Math.sin(a - 0.9) * 30, 6);
      }
      return path;
    },

    draw(p, signals, params, ctx) {
      if (!this.ranks) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      this.W = W;
      const u = S / 600;
      const pr = PRINTS[clamp(Math.round(params.print), 0, PRINTS.length - 1)];
      const RED = pr.red, PAPER = pr.paper;
      const react = params.reaction, motion = params.motion, lowA = params.low;
      const k = (tau) => 1 - Math.exp(-dt / tau);

      this.analyse(signals, t, dt);
      if (!this.dense && this.low1 > 27) { this.dense = true; this.denseAt = t; this.setCount = 0; this.slabIdx = this.wordIdx; }
      else if (this.dense && this.low1 < 19) { this.dense = false; this.calmAt = t; this.wordIdx++; }
      if (this.wantNext) { this.wantNext = false; this.wordIdx++; }

      // The beat clock: runs at the measured period, corrected gently on kicks.
      const per = this.beatPeriod();
      const fix = this.beatFix * k(0.12);
      this.beatFix -= fix;
      this.beat += dt / per + fix;
      const bph = this.beat - Math.floor(this.beat);

      this.pres += ((this.dense ? 1 : 0) - this.pres) * k(this.dense ? 0.4 : 1.2);
      // In the build (energy rising, no drop yet) the giants start to reach.
      const want = this.dense ? 1 : clamp((this.energy - 0.12) * 1.6, 0, 0.7);
      this.reachP += (want - this.reachP) * k(this.dense ? 0.25 : 0.9);

      const drive = 0.3 + 0.9 * this.bassSlow + 0.6 * this.energy;
      this.rot += dt * motion * (0.008 + 0.028 * this.bassSlow);
      this.march += dt * motion * drive * 34;
      this.drift += dt;

      // Layout. The source of the beams sits low between the two giants.
      // Wide sheets put the giants right of the headline; squarer ones shrink
      // them and lift the headline over their heads.
      const aspK = clamp((W / H - 1) / 0.78, 0, 1);
      const cx = W * 0.5 + Math.max(0, W - H) * 0.36 + (1 - aspK) * W * 0.06;
      const horizon = H * (0.74 + 0.08 * lowA) + 6 * u * Math.sin(this.drift * 0.09);
      const fs = u * (0.84 + 0.34 * lowA) * (0.74 + 0.26 * aspK);
      const gap = 222 * u * (0.9 + 0.2 * lowA) * (0.74 + 0.26 * aspK);
      const waistY = H * 0.96 + (1 - this.pres) * 18 * u;

      this.makePaper(p, pr);
      const c = p.drawingContext;
      c.save();
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(this.paper, 0, 0);
      c.restore();
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'multiply';
      const mrx = (1.6 + 0.7 * Math.sin(this.drift * 0.21)) * u;
      const mry = (-1.1 + 0.5 * Math.cos(this.drift * 0.16)) * u;
      const redPlate = (fn, a) => {
        c.save(); c.translate(mrx, mry); c.fillStyle = RED; c.strokeStyle = RED;
        if (a !== undefined) c.globalAlpha = a;
        fn(); c.restore();
      };

      const HEAD = face('Anton', 'Impact, "Arial Narrow", sans-serif');
      const BLOCK = face('Russo One', '"Arial Black", Arial, sans-serif');
      const SMALL = face('Oswald', '"Arial Narrow", Arial, sans-serif');

      // --- The sunburst. Pale and sparse in the breakdown, full red and
      // doubled in the drop, turning with the bass.
      const reachR = Math.hypot(W, H) * 1.3;
      const N = Math.round(params.beams);
      {
        const beamA = 0.42 + 0.58 * this.pres + 0.1 * this.padEnv;
        redPlate(() => {
          c.beginPath();
          for (let i = 0; i < N; i++) {
            const a0 = this.rot + (i / N) * Math.PI * 2;
            const w = (Math.PI / N) * (0.92 + 0.16 * Math.sin(i * 2.3));
            c.moveTo(cx, horizon);
            c.arc(cx, horizon, reachR, a0, a0 + w);
            c.closePath();
          }
          c.fill();
        }, clamp(beamA, 0, 1));
        // Thin secondary rays between the wedges, drawn in as the drop lands.
        if (this.pres > 0.02) {
          redPlate(() => {
            c.beginPath();
            for (let i = 0; i < N; i++) {
              const a0 = this.rot + ((i + 0.5) / N) * Math.PI * 2 + (Math.PI / N) * 0.5;
              const w = (Math.PI / N) * 0.18;
              c.moveTo(cx, horizon);
              c.arc(cx, horizon, reachR * smooth(this.pres * 1.2), a0 - w / 2, a0 + w / 2);
              c.closePath();
            }
            c.fill();
          }, 0.85);
        }
        // The source: a disc rising behind the crowd, with cream rings.
        const sr = (74 + 16 * this.bassSlow + 10 * this.pres) * u;
        redPlate(() => { c.beginPath(); c.arc(cx, horizon, sr, 0, Math.PI * 2); c.fill(); });
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = PAPER; c.lineWidth = 3.2 * u;
        for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(cx + mrx, horizon + mry, sr * (0.3 + i * 0.2), Math.PI * 1.02, Math.PI * 1.98); c.stroke(); }
        // Kick: the source flares cream for a moment and sends out one broad
        // cream ring with a black one behind it, all inside the arch between
        // the giants: the beat has one place on the sheet.
        const kt = (t - this.lastKick) / 0.55;
        if (kt >= 0 && kt < 1 && react > 0.01) {
          const e = easeOut(kt), rs = Math.min(1.4, react);
          const flare = Math.exp(-kt * 5) * clamp(react, 0, 1);
          c.globalAlpha = flare;
          c.fillStyle = PAPER;
          c.beginPath(); c.arc(cx + mrx, horizon + mry, sr * 0.92, 0, Math.PI * 2); c.fill();
          c.globalAlpha = clamp((1 - kt) * 1.3, 0, 1);
          c.lineWidth = (6 + 16 * (1 - kt)) * u * rs;
          c.beginPath(); c.arc(cx + mrx, horizon + mry, sr * (1.1 + 1.7 * e), Math.PI * 1.03, Math.PI * 1.97); c.stroke();
          c.globalCompositeOperation = 'multiply';
          c.strokeStyle = BLACK; c.lineWidth = (3 + 6 * (1 - kt)) * u * rs;
          c.beginPath(); c.arc(cx, horizon, sr * (1.05 + 1.2 * e), Math.PI * 1.05, Math.PI * 1.95); c.stroke();
        }
        c.restore();
      }

      // --- The giants.
      {
        // Phased half a beat late, so the sway is at rest on the kick and moves
        // fastest between beats: the giants dance, the kick belongs to the crowd.
        const sway = Math.cos(Math.PI * this.beat) * (0.012 + 0.03 * this.pres) * (0.5 + 0.5 * react);
        // No beat bob on the giants: at their size any bounce moved a fifth of
        // the sheet on every kick. They sway on a two-beat cycle instead.
        const bob = 0;
        const joinX = cx + Math.sin(this.drift * 0.4) * 6 * u, joinY = H * (0.17 - 0.06 * lowA);
        const poseU = smooth((t - this.poseAt) / (per * 1.8));
        const O0 = OUTER[((this.poseFrom % 4) + 4) % 4], O1 = OUTER[((this.pose % 4) + 4) % 4];
        const outerDrop = [lerp(O0[0], O1[0], poseU), lerp(O0[1], O1[1], poseU)];
        const tilt = lerp(-0.08, -0.34, this.reachP);
        const figs = [
          { her: true, f: 1, x: cx - gap },
          { her: false, f: -1, x: cx + gap },
        ];
        const paths = [];
        for (const g of figs) {
          const lean = sway * g.f;
          // world -> this figure's frame (mirrored, scaled, leaning)
          const toLocal = (wx, wy) => {
            let x = (wx - g.x) / (fs * g.f), y = (wy - waistY - bob) / fs;
            const cl = Math.cos(-lean), sl = Math.sin(-lean);
            return [x * cl - y * sl, x * sl + y * cl];
          };
          const sIn = [96, -222], sOut = [-100, -218];
          // Inner arm: hanging forward at rest, rising toward the partner in
          // the build, meeting their hand overhead in the drop.
          const jl = toLocal(joinX, joinY);
          const rest = [sIn[0] + 50, sIn[1] - 150];
          const half = [sIn[0] + 120, sIn[1] - 250];
          const rp = this.reachP;
          const inT = rp < 0.7 ? [lerp(rest[0], half[0], rp / 0.7), lerp(rest[1], half[1], rp / 0.7)]
            : [lerp(half[0], jl[0], (rp - 0.7) / 0.3), lerp(half[1], jl[1], (rp - 0.7) / 0.3)];
          const outRest = [sOut[0] - 60, sOut[1] + 220];
          const ou = [lerp(outRest[0], sOut[0] + outerDrop[0], this.pres), lerp(outRest[1], sOut[1] + outerDrop[1], this.pres)];
          const path = this.giant({
            her: g.her, tilt: tilt + 0.03 * Math.cos(Math.PI * this.beat * 0.5 + (g.her ? 0 : Math.PI)),
            inner: { sx: sIn[0], sy: sIn[1], tx: inT[0], ty: inT[1], bend: 1 },
            outer: { sx: sOut[0], sy: sOut[1], tx: ou[0], ty: ou[1], bend: 1 },
          });
          paths.push({ path, g, lean });
        }
        const place = (g, lean, dx, dy) => {
          c.translate(g.x + dx, waistY + bob + dy);
          c.rotate(lean);
          c.scale(fs * g.f, fs);
        };
        // The red plate, printed offset down and outward behind both figures.
        for (const { path, g, lean } of paths) {
          redPlate(() => { place(g, lean, -g.f * 11 * u, 8 * u); c.fill(path); });
        }
        for (const { path, g, lean } of paths) {
          c.save(); place(g, lean, 0, 0); c.fillStyle = BLACK; c.fill(path); c.restore();
        }
        // Halftone light where the sunburst falls on them.
        this.makeTone(p, pr, cx, H * (0.74 + 0.08 * lowA), H);
        c.save();
        c.globalCompositeOperation = 'source-over';
        // Both silhouettes in device pixels, so the screen can be laid flat.
        const clipP = new Path2D();
        for (const { path, g, lean } of paths) {
          c.save(); place(g, lean, 0, 0);
          const m = c.getTransform();
          c.restore();
          clipP.addPath(path, m);
        }
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clip(clipP);
        c.globalAlpha = 0.92;
        c.drawImage(this.tone, 0, 0);
        c.restore();
      }

      // --- The crowd, back to front, marching across the sheet.
      {
        const dens = params.crowd;
        const rise = this.pres;
        const RANKS = [
          { y: 0.0, hr: 9, col: RED, a: 0.6, spd: 0.35 },
          { y: 0.07, hr: 13, col: RED, a: 1, spd: 0.6 },
          { y: 0.13, hr: 19, col: BLACK, a: 1, spd: 1 },
          { y: 0.17, hr: 26, col: BLACK, a: 1, spd: 1.5 },
        ];
        for (let ri = 0; ri < 4; ri++) {
          const R = RANKS[ri];
          const hr = R.hr * u * (0.9 + 0.2 * lowA);
          let base = horizon + R.y * H * 0.9 + hr * 1.6 + (1 - rise) * (8 + ri * 6) * u;
          if (ri === 3) base += (1 - smooth(rise * 1.3 - 0.2)) * 120 * u;
          if (base - hr * 3 > H) continue;
          const sp = hr * 2.7 / dens;
          const n = Math.ceil((W + sp * 4) / sp);
          const off = (this.march * R.spd * u) % sp;
          const path = new Path2D();
          const people = this.ranks[ri];
          for (let i = 0; i < n; i++) {
            const idx = Math.floor(this.march * R.spd * u / sp);
            const per_ = people[((i - idx) % people.length + people.length) % people.length];
            const x = -sp * 2 + i * sp + off + per_.jx * sp * 0.35;
            // Kick: the front ranks hop, in a ripple spreading from the centre.
            let hop = 0;
            if (ri >= 2) {
              const tau = t - this.lastKick - Math.abs(x - cx) / W * 0.18;
              if (tau > 0) hop = (tau < 0.08 ? Math.sin(tau / 0.08 * Math.PI / 2) : Math.exp(-(tau - 0.08) / 0.16)) * (ri === 3 ? 24 : 15) * u * react * (0.4 + 0.6 * per_.eager);
            }
            const y = base - per_.dh * hr * 0.5 - hop;
            const sw = hr * 1.55 * per_.sw;
            // shoulders and body, down past the bottom of the sheet
            addPoly(path, [[x - sw, y + hr * 1.3], [x - sw * 0.8, y + hr * 0.95], [x + sw * 0.8, y + hr * 0.95], [x + sw, y + hr * 1.3], [x + sw * 1.05, H + 20 * u], [x - sw * 1.05, H + 20 * u]]);
            addCircle(path, x - sw * 0.8, y + hr * 1.25, hr * 0.32);
            addCircle(path, x + sw * 0.8, y + hr * 1.25, hr * 0.32);
            addLimb(path, x, y + hr * 0.4, hr * 0.42, x, y + hr * 1.0, hr * 0.45);
            const hx = x + per_.lean * hr * 0.3;
            addCircle(path, hx, y, hr);
            if (per_.hair === 1) addCircle(path, hx - hr * 0.6, y - hr * 0.35, hr * 0.42);
            if (per_.hair === 2) addCircle(path, hx + hr * 0.1, y - hr * 0.85, hr * 0.38);
            // Arms: up for the eager in the drop; the clap throws the back
            // ranks' arms up in a wave running outward from the centre.
            let up = smooth((rise - per_.eager * 0.9) * 3);
            if (ri <= 1) {
              const tc = t - this.lastClap - Math.abs(x - cx) / W * 0.25;
              if (tc > 0) up = Math.max(up, (tc < 0.08 ? tc / 0.08 : Math.exp(-(tc - 0.08) / 0.22)) * clamp(react, 0, 1.2));
            }
            if (up > 0.04) {
              const al = hr * 2.9;
              const wave = Math.sin(Math.PI * this.beat + per_.ph) * 0.18 * rise;
              for (const sd of [-1, 1]) {
                const a = lerp(Math.PI * 0.92, 0.3 + 0.12 * per_.eager, up) * sd + wave;
                const sx = x + sd * sw * 0.72, sy = y + hr * 1.2;
                const ex = sx + Math.sin(a) * al * 0.5, ey = sy - Math.cos(a) * al * 0.5;
                const wx = ex + Math.sin(a * 0.85) * al * 0.5, wy = ey - Math.cos(a * 0.85) * al * 0.5;
                addLimb(path, sx, sy, hr * 0.34, ex, ey, hr * 0.28);
                addLimb(path, ex, ey, hr * 0.28, wx, wy, hr * 0.3);
              }
            }
          }
          if (R.col === RED) redPlate(() => c.fill(path), R.a);
          else { c.fillStyle = BLACK; c.fill(path); }
        }
      }

      // --- The headline, huge and slanted up the left of the sheet.
      {
        const words1 = String(params.line1 || '').split('/').map((s) => s.trim()).filter(Boolean);
        const words2 = String(params.line2 || '').split('/').map((s) => s.trim()).filter(Boolean);
        const w1 = words1.length ? words1[this.wordIdx % words1.length] : 'DANCE';
        // The slab keeps the word it came in with while it slides back out.
        const w2 = words2.length ? words2[this.slabIdx % words2.length] : 'TOGETHER!';
        const zoneW = Math.max(260 * u, Math.min(cx - gap - 40 * u, W * 0.5));
        const ax = 34 * u, ay = H * (0.47 - 0.15 * (1 - aspK));
        c.save();
        c.translate(ax, ay);
        c.rotate(-0.16);
        c.transform(1, 0, -0.2, 1, 0, 0);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        // line one fills the zone's width
        c.font = '400 100px ' + HEAD;
        const m1 = c.measureText(w1).width || 300;
        const size1 = clamp(zoneW * 1.02 / m1 * 100, 60 * u, 250 * u);
        c.font = '400 ' + size1.toFixed(1) + 'px ' + HEAD;
        // A cream keyline cut round the letters, so they stay whole where a
        // giant's arm swings behind them.
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = PAPER; c.lineWidth = 7 * u; c.lineJoin = 'miter';
        c.strokeText(w1, 0, 0);
        c.restore();
        c.fillStyle = BLACK;
        c.fillText(w1, 0, 0);
        // the small line above
        c.font = '400 ' + (17 * u).toFixed(1) + 'px ' + BLOCK;
        c.fillText('ALL OF US · ONE FLOOR · ONE BEAT', 4 * u, -size1 * 0.9 - 16 * u);
        redPlate(() => c.fillRect(4 * u, -size1 * 0.9 - 8 * u, zoneW * 0.9, 5 * u));
        // line two: a red slab slides in with the drop; its letters set one
        // per beat, cream knocked out of the red.
        const slabH = size1 * 0.46;
        // Clears the sheet within a few seconds of the breakdown, rather than
        // leaving its last letters stranded at the edge until the next drop.
        const slide = easeOut(clamp(this.pres * 1.7 - 0.45, 0, 1));
        if (slide > 0.005) {
          c.font = '400 ' + (slabH * 0.8).toFixed(1) + 'px ' + BLOCK;
          const m2 = c.measureText(w2).width;
          const slabW = Math.max(zoneW * 0.95, m2 + 40 * u);
          const sx0 = -ax * 2 - slabW * (1 - slide);
          redPlate(() => c.fillRect(sx0, 16 * u, slabW + ax * 2, slabH));
          const shown = this.dense ? clamp(this.setCount + 1, 0, w2.length) : w2.length;
          c.save();
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = PAPER;
          c.beginPath(); c.rect(sx0 + mrx, 16 * u + mry, slabW + ax * 2, slabH); c.clip();
          c.fillText(w2.slice(0, shown), sx0 + ax * 2 + 14 * u + mrx, 16 * u + slabH * 0.84 + mry);
          c.restore();
        }
        c.restore();
      }

      // --- Leaflets, fluttering down on the hats.
      {
        c.save();
        c.globalCompositeOperation = 'source-over';
        const keep = [];
        for (const L of this.leaves) {
          L.y += L.vy * dt * (0.7 + 0.5 * motion);
          L.flip += dt * L.fs;
          if (L.y > 0.86) continue;
          keep.push(L);
          const x = (L.x + Math.sin(t * 1.3 + L.ph) * L.sway) * W, y = L.y * H;
          const w = 13 * u * L.size, h = 17 * u * L.size;
          const cf = Math.cos(L.flip);
          c.save();
          c.translate(x, y); c.rotate(L.spin * Math.sin(t * 0.9 + L.ph) + 0.3);
          c.scale(Math.abs(cf) < 0.08 ? 0.08 : cf, 1);
          c.fillStyle = L.red ? RED : PAPER;
          c.fillRect(-w / 2, -h / 2, w, h);
          c.fillStyle = L.red ? PAPER : BLACK;
          for (let i = 0; i < L.lines; i++) c.fillRect(-w * 0.35, -h * 0.3 + i * h * 0.2, w * (i === 0 ? 0.7 : 0.5), h * 0.07);
          c.restore();
        }
        this.leaves = keep;
        c.restore();
      }

      // Paper through the ink.
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.drawImage(this.wear, 0, 0);
      c.restore();
      c.restore();
    },
  });
})();
