// Zagreb: a 1960s Zagreb-school cartoon poster that plays its own little film.
// A paper header carries the title in a quirky wide lowercase; below it, the
// picture: a flat night street in a handful of inks, painted as limited
// animation. A small man with a huge nose and a top hat walks along while the
// town pans past behind him in three planes (far silhouettes, a row of wonky
// flat-coloured houses with scribbled window grids, the street and its lamps).
// His walk is held on twos, like the cartoons, and when the music arrives he
// dances pose to pose.
//
// Music, each in its own place:
//   kick   the man snaps to his next dance pose and his hat hops off his head
//          (only him; the rest of the picture keeps its own motion)
//   clap   a neighbour pops out of a window with a jagged shout, and in the
//          drop the chorus line behind him changes step together
//   bass   the speed of the pan, and a slight stretch in the houses
//   hats   stars in the sky blink on, one per hat
//   drop   the man dances instead of walking and his coat is cut to red, a
//          chorus line of little men in red hats slides in behind him, the
//          windows light up house by house, a red moon overprints the cream
//          one and the title letters hop; the breakdown sends the chorus off,
//          puts the lights out and slows the walk to a stroll.
// Plain Canvas 2D, flat fills only; the whole sheet is multiplied by a paper
// grain and the key plate sits a hair off register. No glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const D2R = Math.PI / 180;

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

  // Inks per print. Houses draw from `house`; the hero's coat is `coat` and
  // turns `coatDrop` in the drop.
  const PRINTS = [
    { name: 'Night blue', paper: '#ECE1C6', sky: '#243F55', far: '#1A2F41', key: '#1C1A17',
      house: ['#D8A03A', '#C4472F', '#DD9C84', '#8A8E3D', '#EFE4C9', '#3E8783'],
      lit: '#F2CB52', dark: '#1C1A17', moon: '#EFE4C9', moon2: '#C4472F', skin: '#E8B89A',
      nose: '#E8B89A', coat: '#1C1A17', coatDrop: '#C4472F', street: '#1C1A17', kerb: '#3A3833', pave: '#7E7866', cheek: '#D9745C',
      tram: '#2F5DA3', accent: '#C4472F', star: '#EFE4C9', cone: 'rgba(242,203,82,0.16)' },
    { name: 'Mustard dusk', paper: '#EFE6CF', sky: '#D69B33', far: '#B67E2A', key: '#1C1A17',
      house: ['#C4472F', '#1C1A17', '#EFE4C9', '#3E8783', '#8A8E3D', '#DD9C84'],
      lit: '#F4DC8A', dark: '#1C1A17', moon: '#F3EBD3', moon2: '#C4472F', skin: '#F0C9A8',
      nose: '#F0C9A8', coat: '#1C1A17', coatDrop: '#3E8783', street: '#2A2622', kerb: '#5A4A33', pave: '#8E7A55', cheek: '#C4472F',
      tram: '#2F5DA3', accent: '#3E8783', star: '#F3EBD3', cone: 'rgba(255,240,190,0.2)' },
    { name: 'Red and black', paper: '#EDE4CE', sky: '#B53A25', far: '#8E2C1B', key: '#1A1816',
      house: ['#1A1816', '#EDE4CE', '#1A1816', '#EDE4CE', '#1A1816', '#6E2418'],
      lit: '#EDE4CE', dark: '#1A1816', moon: '#EDE4CE', moon2: '#1A1816', skin: '#EDE4CE',
      nose: '#EDE4CE', coat: '#1A1816', coatDrop: '#EDE4CE', street: '#1A1816', kerb: '#4A1A12', pave: '#7A2616', cheek: '#B53A25',
      tram: '#1A1816', accent: '#1A1816', star: '#EDE4CE', cone: 'rgba(237,228,206,0.14)' },
  ];

  // Poses: [lean, hop, thighB, shinB, thighF, shinF, upperB, foreB, upperF,
  // foreF, headTilt, hatTilt]. Angles in degrees, absolute: 0 hangs straight
  // down, +90 points forward (the way he faces), 180 straight up.
  const DANCE = [
    [0, 0.02, -14, -14, 14, 14, -155, -165, 155, 165, 6, -8],      // arms up, legs apart
    [-6, 0.0, -4, -4, 85, 95, -125, -95, 70, 115, -8, 10],         // front kick
    [6, 0.0, -35, 10, 38, -8, -70, -20, 75, 25, 10, 0],            // knees out
    [12, 0.01, -22, -6, 22, 6, -35, -50, 135, 145, 14, 12],        // point up
    [14, 0.0, 6, 6, -55, -120, 100, 150, -95, -50, -10, -6],       // heel kick
    [0, 0.07, -32, -38, 32, 38, -105, -120, 105, 120, 0, 15],      // star jump
    [-12, 0.0, 18, 5, -18, -5, -80, -110, 80, 110, -14, -12],      // lean back, arms wide
  ];
  // The chorus line only knows two steps, and does them together.
  const KICKLINE = [
    [0, 0.0, -2, -2, 95, 100, -60, -20, 60, 20, 0, 0],
    [0, 0.0, 95, 100, -2, -2, 60, 20, -60, -20, 0, 0],
    [0, 0.04, -10, -10, 10, 10, -170, -175, 170, 175, 0, 0],
  ];

  const WORDS = ['hop!', 'la la!', 'ha!', 'bam!', 'oj!', 'yes!', 'shh!', 'ole!'];
  const TITLE = 'the loud little night';
  const HEAD_FONT = 'Syne', CAP_FONT = 'Josefin Sans';

  function font(weight, size, fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return weight + ' ' + size.toFixed(2) + 'px ' + (ok ? '"' + fam + '", ' : '') + fallback;
  }

  VIZ.register({
    id: 'zagreb',
    name: 'Zagreb',
    order: 513,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'walk', label: 'Walk speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'chorus', label: 'Chorus line', type: 'range', min: 0, max: 9, default: 6, step: 1 },
      { key: 'print', label: 'Print', type: 'select', options: ['Night blue', 'Mustard dusk', 'Red and black'], default: 0 },
      { key: 'neighbours', label: 'Neighbours', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'texture', label: 'Paper grain', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'words', label: 'Title (blank for default)', type: 'text', default: '' },
    ],

    gallery: {
      title: 'Zagreb',
      technique: 'Canvas 2D: a jointed stick-and-shape character driven by pose tables (walk held on twos, dance poses snapped on onsets), three procedurally generated parallax planes of flat houses and silhouettes, a timed tram, pop-up neighbours, all flat fills multiplied by a paper-grain pattern',
      brief: 'A 1960s Zagreb-school cartoon poster that plays its own little film. Under a paper header with a quirky wide lowercase title, a small man with a huge nose and a top hat walks through a flat night town that pans past in three planes, his walk held on twos like limited animation. Each kick snaps him into his next dance pose and pops his hat off his head; each clap brings a neighbour out of a window with a jagged shout; hats blink stars on; the bass sets the pace of the pan. The drop cuts his coat to red, slides in a chorus line of little men who change step together on the clap, lights the windows house by house, overprints a red moon and makes the title hop. The breakdown sends the chorus off, puts the lights out and slows him to a stroll.',
      lineage: [
        'The Zagreb school of animation (Zagreb Film, 1956 onward): Dusan Vukotic\'s reduced, witty figures and cut-paper towns, Vatroslav Mimica\'s flat urban backgrounds, Nedeljko Dragic\'s nervous line and his films about noise and neighbours, Boris Kolar and Zlatko Grgic\'s big-nosed little men; their limited animation, held on twos and snapped pose to pose over panning painted backgrounds. The poster frame (paper header, quirky wide lowercase title, credit line) evokes the studio\'s film posters without copying one; the studio mark, title and all wording are invented. Batch 05 brief entry "13 · Zagreb school animation".',
        'Process: the kick was given to the one character (a pose snap, a hat that hops off his head, impact strokes at his planted foot), the clap to the neighbours and the chorus line, the hats to the stars, the bass to the pace of the pan. First render at 640x360 read as the style at once but the houses were packed so tall and dense they hid the moon and crowded the sky, the man was small, his black legs vanished on a black street and his red nose disappeared against the red drop coat. The houses were made lower with gaps between them, the far silhouettes lowered, the street became a warm grey pavement with a black gutter, the man grew to 0.6 of the picture height and his nose became a skin-coloured shape with a key line. The jolt heat map then showed the pan of the window grids dominating, so the mid-ground parallax was slowed and the stomp marks were enlarged to give the kick a clearer local spot. Jolt at 640x360: calm, kickArea 0.17, kickMean 0.035, drift 0.026, ratio 1.35 (build kick 0.14, 1.28); the heat map puts the brightest spot on the man and his feet, with the slow pan of the houses as the drift. The 96 s run stays varied because the town is generated as it pans and a tram comes through every 16-30 s.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.mid) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.low = 0; this.drop = false; this.hadDrop = false;
      this.bassEnv = 0; this.hatSlow = 0; this.energy = 0;
      this.pan = 0; this.walkPh = 0;
      this.dropL = 0; this.rest = 0; this.danceW = 0; this.chorusIn = 0; this.redMoon = 0;
      this.poseFrom = DANCE[0].slice(); this.poseTo = DANCE[0].slice(); this.poseT0 = -10; this.poseI = 0;
      this.cFrom = KICKLINE[2].slice(); this.cTo = KICKLINE[2].slice(); this.cT0 = -10; this.cI = 2;
      this.hatY = 0; this.hatV = 0; this.hatSpin = 0; this.hatSpinV = 0;
      this.coatRed = false;
      this.mid = []; this.midEnd = -200;
      this.far = []; this.farEnd = -200;
      this.pops = [];
      this.stars = [];
      for (let i = 0; i < 26; i++) {
        this.stars.push({ u: this.rng(), v: Math.pow(this.rng(), 1.3) * 0.55, k: 0.5 + this.rng(), flash: 0, rot: this.rng() * 90 });
      }
      this.tram = null; this.nextTram = 7;
      this.grainPat = null;
    },

    newHouse(far, S, ph) {
      const r = this.rng;
      if (far) {
        const w = S * (0.08 + 0.16 * r());
        return { w, h: ph * (0.3 + 0.3 * r()), gap: r() < 0.3 ? S * 0.02 * r() : 0,
          roof: r() < 0.25 ? 'dome' : r() < 0.45 ? 'spire' : 'flat', wins: Array.from({ length: 6 }, () => [r(), r()]) };
      }
      const w = S * (0.11 + 0.15 * r());
      const cols = 2 + Math.floor(r() * 4), rows = 3 + Math.floor(r() * 6);
      const style = r();
      const win = [];
      for (let i = 0; i < cols * rows; i++) win.push({ v: r(), j: [(r() - 0.5), (r() - 0.5), (r() - 0.5)] });
      return {
        w, h: ph * (r() < 0.12 ? 0.5 + 0.12 * r() : 0.2 + 0.26 * r()), gap: r() < 0.55 ? S * (0.02 + 0.07 * r()) : 0,
        ink: Math.floor(r() * 6), tilt: (r() - 0.5) * 7, lean: (r() - 0.5) * 0.08,
        roof: r() < 0.3 ? 'gable' : r() < 0.45 ? 'dome' : r() < 0.6 ? 'step' : 'flat',
        chimney: r() < 0.5 ? r() : -1, antenna: r() < 0.3,
        cols, rows, style: style < 0.5 ? 'rect' : style < 0.75 ? 'slit' : 'round', win,
        ph: r() * 10,
      };
    },

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.4));
      this.hatSlow += ((s[6] + s[7] + s[8]) / 300 - this.hatSlow) * k(1.5);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.2);
      return { kick, snare, hat };
    },

    makeGrain(g) {
      if (this.grainPat && this.grainCtx === g) return;
      const rnd = mulberry(9173);
      const N = 256;
      const c = document.createElement('canvas'); c.width = N; c.height = N;
      const x = c.getContext('2d'); const img = x.createImageData(N, N);
      const blot = new Float32Array(256);
      for (let i = 0; i < 256; i++) blot[i] = rnd();
      for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
        const bx = xx / 16, by = y / 16, ix = Math.floor(bx), iy = Math.floor(by), fx = bx - ix, fy = by - iy;
        const q = (a, b) => blot[((b & 15) * 16) + (a & 15)];
        const sm = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
        const n = rnd();
        // Cartoon background board: fibre speckle, a soft cloud, and the odd
        // horizontal drag of a dry brush.
        const streak = (Math.sin(y * 1.7 + Math.sin(xx * 0.05) * 3) > 0.96) ? 10 : 0;
        const v = 255 - n * 26 - sm * 16 - streak;
        const o = (y * N + xx) * 4;
        img.data[o] = v; img.data[o + 1] = v - 3; img.data[o + 2] = v - 9; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.grainPat = g.createPattern(c, 'repeat');
      this.grainCtx = g;
    },

    // ---- the little man --------------------------------------------------

    // Walk cycle, held on twos: the phase is quantised to 8 drawings a stride.
    walkPose(ph, slump) {
      const s = Math.sin(ph), c = Math.cos(ph);
      const tF = 26 * s, tB = -26 * s;
      const sF = tF - 34 * Math.max(0, -Math.sin(ph - 0.7));
      const sB = tB - 34 * Math.max(0, Math.sin(ph - 0.7));
      return [4 + 6 * slump, 0.012 * Math.abs(c), tB, sB, tF, sF, 24 * s, 24 * s + 28, -24 * s, -24 * s + 28, -8 * slump, 0];
    },

    // Draws a figure with its feet on (x, y), facing right, `u` tall.
    figure(g, x, y, u, pose, col, opts) {
      const dir = (a) => [Math.sin(a * D2R), Math.cos(a * D2R)];
      const [lean, hop, tB, sB, tF, sF, uB, fB, uF, fF, head, hatTilt] = pose;
      const thigh = 0.2 * u, shin = 0.2 * u;
      const legs = [[tB, sB], [tF, sF]].map(([a, b]) => {
        const d1 = dir(a), d2 = dir(b);
        const kx = d1[0] * thigh, ky = d1[1] * thigh;
        return { kx, ky, fx: kx + d2[0] * shin, fy: ky + d2[1] * shin, sa: b };
      });
      const drop = Math.max(legs[0].fy, legs[1].fy);
      const hx = x, hy = y - drop - hop * u;
      const tv = dir(180 - lean);
      const torso = 0.3 * u;
      const sx = hx + tv[0] * torso, sy = hy + tv[1] * torso;
      const lw = Math.max(1.2, 0.024 * u);
      g.lineCap = 'round'; g.lineJoin = 'round';

      const limb = (ox, oy, a, b, la, lb, colr) => {
        const d1 = dir(a), d2 = dir(b);
        const ex = ox + d1[0] * la, ey = oy + d1[1] * la;
        const wx = ex + d2[0] * lb, wy = ey + d2[1] * lb;
        g.strokeStyle = colr; g.lineWidth = lw;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex, ey); g.lineTo(wx, wy); g.stroke();
        return [wx, wy];
      };
      const shoe = (lg, colr) => {
        const fx = hx + lg.fx, fy = hy + lg.fy;
        g.save(); g.translate(fx, fy);
        // A shoe on a raised leg tips with the shin; on the ground it lies flat.
        const tilt = lg.fy < drop - 0.01 * u ? (lg.sa - 0) * 0.5 * D2R : 0;
        g.rotate(-tilt);
        g.fillStyle = colr;
        g.beginPath(); g.ellipse(0.035 * u, -0.012 * u, 0.058 * u, 0.022 * u, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      };
      const backCol = opts.silhouette ? col.coat : col.limbBack;

      // Back leg and arm first, behind the coat.
      limb(hx, hy, tB, sB, thigh, shin, backCol);
      shoe(legs[0], backCol);
      const hb = limb(sx - tv[0] * 0.02 * u, sy - tv[1] * 0.02 * u, uB, fB, 0.15 * u, 0.14 * u, backCol);
      g.fillStyle = opts.silhouette ? col.coat : col.hand;
      g.beginPath(); g.arc(hb[0], hb[1], 0.022 * u, 0, Math.PI * 2); g.fill();

      // Front leg.
      limb(hx, hy, tF, sF, thigh, shin, col.limb);
      shoe(legs[1], col.limb);

      // Coat: a stiff trapezoid, flared at the hem.
      g.save(); g.translate(hx, hy); g.rotate(lean * D2R);
      g.fillStyle = col.coat;
      g.beginPath();
      g.moveTo(-0.055 * u, -torso - 0.01 * u);
      g.lineTo(0.06 * u, -torso - 0.01 * u);
      g.lineTo(0.115 * u, 0.07 * u);
      g.lineTo(-0.11 * u, 0.08 * u);
      g.closePath(); g.fill();
      if (!opts.silhouette) {
        // Three buttons and a pocket flap, cut in the paper colour.
        g.fillStyle = col.detail;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0.03 * u, -torso * (0.75 - i * 0.22), 0.011 * u, 0, Math.PI * 2); g.fill(); }
        g.fillRect(-0.07 * u, -0.04 * u, 0.06 * u, 0.012 * u);
      }
      g.restore();

      // Head, nose, eye, hat.
      const nk = 0.1 * u;
      const hcx = sx + tv[0] * nk, hcy = sy + tv[1] * nk;
      const hr = 0.105 * u;
      g.save(); g.translate(hcx, hcy); g.rotate((lean + head) * D2R);
      g.fillStyle = opts.silhouette ? col.coat : col.skin;
      g.beginPath(); g.ellipse(0, 0, hr, hr * 1.08, 0, 0, Math.PI * 2); g.fill();
      // The nose is the character: a long droop, bigger than the face.
      g.fillStyle = opts.silhouette ? col.coat : col.nose;
      g.beginPath();
      g.moveTo(hr * 0.35, -hr * 0.35);
      g.bezierCurveTo(hr * 1.6, -hr * 0.55, hr * 2.25, hr * 0.2, hr * 1.95, hr * 0.62);
      g.bezierCurveTo(hr * 1.6, hr * 0.95, hr * 0.8, hr * 0.5, hr * 0.3, hr * 0.35);
      g.closePath(); g.fill();
      if (!opts.silhouette) {
        g.strokeStyle = col.limb; g.lineWidth = lw * 0.6; g.stroke();
        g.fillStyle = col.cheek;
        g.beginPath(); g.arc(-hr * 0.05, hr * 0.35, hr * 0.16, 0, Math.PI * 2); g.fill();
        g.fillStyle = col.eyeWhite;
        g.beginPath(); g.ellipse(hr * 0.32, -hr * 0.42, hr * 0.2, hr * 0.26, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = col.limb;
        g.beginPath(); g.arc(hr * 0.4, -hr * 0.38, hr * 0.09, 0, Math.PI * 2); g.fill();
        g.strokeStyle = col.limb; g.lineWidth = lw * 0.7;
        g.beginPath(); g.moveTo(hr * 0.1, -hr * 0.78); g.lineTo(hr * 0.55, -hr * 0.72); g.stroke();
        // Ear.
        g.fillStyle = col.nose;
        g.beginPath(); g.ellipse(-hr * 0.35, hr * 0.05, hr * 0.14, hr * 0.2, 0, 0, Math.PI * 2); g.fill();
      }
      // Top hat, lifted and spun by the kick.
      const hl = (opts.hatY || 0) * u;
      g.save();
      g.translate(-hr * 0.05, -hr * 0.92 - hl);
      g.rotate((hatTilt - 10 + (opts.hatSpin || 0)) * D2R);
      g.fillStyle = col.hat;
      g.fillRect(-0.075 * u, -0.012 * u, 0.15 * u, 0.022 * u);
      g.beginPath();
      g.moveTo(-0.048 * u, -0.005 * u); g.lineTo(0.048 * u, -0.005 * u);
      g.lineTo(0.056 * u, -0.15 * u); g.lineTo(-0.042 * u, -0.155 * u);
      g.closePath(); g.fill();
      if (col.band) { g.fillStyle = col.band; g.fillRect(-0.047 * u, -0.04 * u, 0.096 * u, 0.02 * u); }
      g.restore();
      g.restore();

      // Front arm over the coat.
      const hf = limb(sx, sy, uF, fF, 0.15 * u, 0.14 * u, col.limb);
      g.fillStyle = opts.silhouette ? col.coat : col.hand;
      g.beginPath(); g.arc(hf[0], hf[1], 0.024 * u, 0, Math.PI * 2); g.fill();
      // The planted foot, for the stomp marks.
      const lo = legs[0].fy >= legs[1].fy ? legs[0] : legs[1];
      return [hx + lo.fx + 0.035 * u, hy + lo.fy];
    },

    // ---- the town ------------------------------------------------------------

    drawHouse(g, b, x, base, P, lit, bass, S) {
      const h = b.h * (1 + 0.035 * bass * Math.sin(b.ph + 1));
      g.save();
      g.translate(x + b.w / 2, base);
      g.rotate(b.tilt * D2R * 0.4);
      const w = b.w, col = P.house[b.ink];
      const lw = w * (1 - Math.abs(b.lean)), top = -h;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-w / 2, 0.02 * S); g.lineTo(w / 2, 0.02 * S);
      g.lineTo(w / 2 - (w - lw) * (b.lean > 0 ? 0 : 1), top);
      g.lineTo(-w / 2 + (w - lw) * (b.lean > 0 ? 1 : 0), top);
      g.closePath(); g.fill();
      // Roofs are stuck on like cut paper.
      const rx0 = -w / 2 + (w - lw) * (b.lean > 0 ? 1 : 0), rx1 = w / 2 - (w - lw) * (b.lean > 0 ? 0 : 1);
      const rc = (rx0 + rx1) / 2, rw = rx1 - rx0;
      if (b.roof === 'gable') {
        g.fillStyle = P.dark;
        g.beginPath(); g.moveTo(rx0 - 0.01 * S, top); g.lineTo(rc + rw * 0.1, top - rw * 0.45); g.lineTo(rx1 + 0.01 * S, top); g.closePath(); g.fill();
      } else if (b.roof === 'dome') {
        g.fillStyle = P.house[(b.ink + 3) % 6];
        g.beginPath(); g.ellipse(rc, top, rw * 0.32, rw * 0.3, 0, Math.PI, 0); g.fill();
        g.fillStyle = P.dark; g.fillRect(rc - 1, top - rw * 0.3 - 0.03 * S, 2, 0.03 * S);
      } else if (b.roof === 'step') {
        g.fillStyle = col;
        g.fillRect(rc - rw * 0.3, top - 0.03 * S, rw * 0.6, 0.031 * S);
        g.fillRect(rc - rw * 0.12, top - 0.055 * S, rw * 0.24, 0.026 * S);
      }
      if (b.chimney >= 0) {
        g.fillStyle = P.dark;
        g.fillRect(rx0 + rw * (0.15 + 0.6 * b.chimney), top - 0.035 * S, 0.018 * S, 0.04 * S);
      }
      if (b.antenna) {
        g.strokeStyle = P.dark; g.lineWidth = 1.2;
        const ax = rc + rw * 0.2;
        g.beginPath(); g.moveTo(ax, top); g.lineTo(ax, top - 0.06 * S);
        g.moveTo(ax - 0.02 * S, top - 0.045 * S); g.lineTo(ax + 0.02 * S, top - 0.05 * S);
        g.moveTo(ax - 0.013 * S, top - 0.03 * S); g.lineTo(ax + 0.015 * S, top - 0.034 * S);
        g.stroke();
      }
      // Windows: a hand-drawn grid, each a little crooked.
      const padX = rw * 0.16, padT = 0.035 * S, padB = 0.05 * S;
      const gw = rw - 2 * padX, gh = h - padT - padB;
      const cw = gw / b.cols, chh = Math.min(gh / b.rows, 0.075 * S);
      const rows = Math.min(b.rows, Math.floor(gh / chh));
      const winW = b.style === 'slit' ? cw * 0.34 : cw * 0.56, winH = b.style === 'slit' ? chh * 0.7 : chh * 0.52;
      b.slots = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < b.cols; c++) {
        const wi = b.win[r * b.cols + c];
        const wx = rx0 + padX + (c + 0.5) * cw + wi.j[0] * cw * 0.12;
        const wy = top + padT + (r + 0.5) * chh + wi.j[1] * chh * 0.1;
        const on = wi.v < lit;
        g.fillStyle = on ? P.lit : P.dark;
        g.save(); g.translate(wx, wy); g.rotate(wi.j[2] * 0.12);
        if (b.style === 'round') { g.beginPath(); g.ellipse(0, 0, winW * 0.42, winH * 0.55, 0, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(-winW / 2, -winH / 2, winW, winH);
        g.restore();
        b.slots.push([wx, wy, winW, winH]);
      }
      // A door.
      g.fillStyle = P.dark;
      g.fillRect(rc - 0.018 * S, -0.045 * S, 0.036 * S, 0.065 * S);
      g.restore();
      b.frame = { x: x + b.w / 2, y: base, rot: b.tilt * D2R * 0.4 };
    },

    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const P = PRINTS[Math.round(params.print) || 0] || PRINTS[0];
      const react = params.reaction;
      const kf = (tau) => 1 - Math.exp(-dt / tau);
      const ev = this.analyse(signals, t, dt);

      // ---- sections from the music: the drop is the sustained bass line.
      const wasDrop = this.drop;
      if (!this.drop && this.low > 30) this.drop = true;
      else if (this.drop && this.low < 16) this.drop = false;
      if (this.drop) this.hadDrop = true;
      const kicksRecent = t - this.lastKick < 1.2;
      const building = !this.drop && (kicksRecent || this.hatSlow > 0.25);
      this.dropL += ((this.drop ? 1 : 0) - this.dropL) * kf(this.drop ? 0.8 : 1.6);
      const restWant = !this.drop && !building && this.hadDrop ? 1 : 0;
      this.rest += (restWant - this.rest) * kf(1.5);
      this.danceW += ((this.drop ? 1 : 0) - this.danceW) * kf(this.drop ? 0.12 : 0.5);
      this.chorusIn += ((this.drop ? 1 : 0) - this.chorusIn) * kf(this.drop ? 0.9 : 1.2);
      this.redMoon += ((this.drop ? 1 : 0) - this.redMoon) * kf(0.5);
      // The coat is a cut, as a cel change would be: on the drop's first beat.
      if (this.drop && !wasDrop) this.coatRed = true;
      if (!this.drop && wasDrop) this.coatRed = false;

      // ---- layout: paper header with the title, the picture, a credit line.
      const m = 0.03 * S, head = 0.15 * S, foot = 0.055 * S;
      const X0 = m, X1 = W - m, Y0 = m + head, Y1 = H - m - foot;
      const PW = X1 - X0, PH = Y1 - Y0;
      const groundTop = Y1 - 0.22 * PH;
      const heroY = Y1 - 0.075 * PH;
      const heroX = X0 + PW * clamp(0.36 - (W / S - 1) * 0.02, 0.3, 0.4);
      const heroU = 0.6 * PH;

      // ---- motion: the pan runs on the bass, never jumps.
      const speed = params.walk * S * (0.07 + 0.05 * this.energy + 0.06 * this.bassEnv + 0.04 * this.dropL) * (1 - 0.45 * this.rest);
      this.pan += dt * speed;
      const stride = 0.55 * heroU;
      this.walkPh += dt * speed / stride * Math.PI * 2;

      // ---- events
      if (ev.kick && react > 0.01) {
        if (this.danceW > 0.3) {
          this.poseFrom = this.curPose ? this.curPose.slice() : DANCE[0].slice();
          let n = Math.floor(this.rng() * (DANCE.length - 1));
          if (n >= this.poseI) n++;
          this.poseI = n; this.poseTo = DANCE[n].slice(); this.poseT0 = t;
        }
        this.stomp = { t0: t, k: react };
        // Hat hop: stronger once he is dancing.
        this.hatV = Math.max(this.hatV, (0.5 + 0.9 * this.danceW) * react);
        this.hatSpinV = (this.rng() < 0.5 ? -1 : 1) * (60 + 200 * this.danceW) * react;
      }
      if (ev.snare) {
        if (this.chorusIn > 0.4) {
          this.cFrom = this.cCur ? this.cCur.slice() : KICKLINE[2].slice();
          this.cI = this.cI === 0 ? 1 : 0; this.cTo = KICKLINE[this.cI].slice(); this.cT0 = t;
        }
        const last = this.pops.length ? this.pops[this.pops.length - 1].t0 : -10;
        if (params.neighbours > this.rng() * 0.999 && t - last > 0.18) {
          const vis = this.mid.filter((b) => b.slots && b.slots.length && b.sx > X0 + 0.02 * S && b.sx + b.w < X1 - 0.02 * S);
          if (vis.length) {
            const b = vis[Math.floor(this.rng() * vis.length)];
            const si = Math.floor(this.rng() * Math.min(b.slots.length, b.cols * 2));
            this.pops.push({ b, si, t0: t, word: WORDS[Math.floor(this.rng() * WORDS.length)], side: this.rng() < 0.5 ? -1 : 1, ang: (this.rng() - 0.5) * 20 });
            if (this.pops.length > 3) this.pops.shift();
          }
        }
      }
      if (ev.hat) {
        const cand = this.stars.filter((s) => s.flash < 0.15);
        if (cand.length) { const s = cand[Math.floor(this.rng() * cand.length)]; s.flash = 1; s.rot += 45; }
      }
      this.pops = this.pops.filter((q) => t - q.t0 < 0.9);
      for (const s of this.stars) s.flash *= Math.exp(-dt / 0.45);

      // Hat physics, in units of hero height.
      this.hatY += this.hatV * dt; this.hatV -= 7.5 * dt;
      if (this.hatY <= 0) { this.hatY = 0; this.hatV = 0; }
      this.hatSpin += this.hatSpinV * dt; this.hatSpinV *= Math.exp(-dt / 0.15);
      if (this.hatY === 0) this.hatSpin *= Math.exp(-dt / 0.06);

      // ---- the hero's pose: walk on twos blended into the dance.
      const q = Math.floor(this.walkPh / (Math.PI / 4)) * (Math.PI / 4);
      const wp = this.walkPose(q, this.rest);
      const du = easeOut(clamp((t - this.poseT0) / 0.07, 0, 1));
      const dp = this.poseFrom.map((v, i) => lerp(v, this.poseTo[i], du));
      // Between kicks he breathes with the bass rather than freezing.
      dp[1] += 0.012 * this.bassEnv;
      const pose = wp.map((v, i) => lerp(v, dp[i], this.danceW));
      // In the build he nods along with the hats.
      if (building) pose[10] += 7 * Math.max(0, Math.sin(t * Math.PI * 4.13));
      this.curPose = dp;
      const cu = easeOut(clamp((t - this.cT0) / 0.08, 0, 1));
      this.cCur = this.cFrom.map((v, i) => lerp(v, this.cTo[i], cu));

      const lit = clamp(0.2 + 0.5 * this.dropL - 0.16 * this.rest + 0.1 * this.energy, 0.04, 0.8);

      // ---- draw
      const g = p.drawingContext;
      this.makeGrain(g);
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.setLineDash([]);
      g.fillStyle = P.paper;
      g.fillRect(-2, -2, W + 4, H + 4);

      // The picture, clipped.
      g.save();
      g.beginPath(); g.rect(X0, Y0, PW, PH); g.clip();
      // Sky plate, a hair off register from the key.
      g.fillStyle = P.sky;
      g.fillRect(X0 + 0.9, Y0 + 0.6, PW, PH);

      // Stars, far beyond the pan.
      for (const s of this.stars) {
        const sx = X0 + ((s.u * PW - this.pan * 0.02) % PW + PW) % PW;
        const sy = Y0 + 0.04 * PH + s.v * PH * 0.6;
        const r = S * 0.004 * s.k;
        g.fillStyle = P.star;
        if (s.flash > 0.05) {
          const R = r + S * 0.022 * s.k * s.flash;
          g.save(); g.translate(sx, sy); g.rotate((s.rot + 45 * (1 - s.flash)) * D2R);
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, rr = i % 2 ? R * 0.22 : R;
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.closePath(); g.fill(); g.restore();
        } else {
          g.fillRect(sx - r / 2, sy - r / 2, r, r);
        }
      }

      // The moon; in the drop a red moon overprints it, off register.
      const mx = X0 + PW * 0.8, my = Y0 + PH * 0.19, mr = S * 0.09;
      g.fillStyle = P.moon;
      g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      if (this.redMoon > 0.01) {
        g.save();
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = P.moon2;
        const o = mr * 0.32 * this.redMoon;
        g.beginPath(); g.arc(mx - o, my + o * 0.5, mr * (0.55 + 0.45 * this.redMoon), 0, Math.PI * 2); g.fill();
        g.restore();
      }

      // Far town: silhouettes, slow.
      const farL = this.pan * 0.18;
      while (this.farEnd < farL + PW + 0.3 * S) {
        const b = this.newHouse(true, S, PH);
        b.x = this.farEnd + b.gap; this.farEnd = b.x + b.w; this.far.push(b);
      }
      this.far = this.far.filter((b) => b.x + b.w > farL - 0.3 * S);
      g.fillStyle = P.far;
      for (const b of this.far) {
        const x = X0 + b.x - farL, top = groundTop - b.h;
        g.fillRect(x, top, b.w + 0.5, b.h + 2);
        if (b.roof === 'dome') { g.beginPath(); g.ellipse(x + b.w / 2, top, b.w * 0.3, b.w * 0.28, 0, Math.PI, 0); g.fill(); }
        else if (b.roof === 'spire') { g.beginPath(); g.moveTo(x + b.w * 0.35, top); g.lineTo(x + b.w * 0.5, top - b.w * 0.9); g.lineTo(x + b.w * 0.65, top); g.fill(); }
      }
      g.fillStyle = P.lit;
      for (const b of this.far) {
        const x = X0 + b.x - farL, top = groundTop - b.h;
        for (const [a, c] of b.wins) {
          if (a > lit * 0.9) continue;
          g.fillRect(x + b.w * (0.15 + 0.6 * c), top + b.h * (0.1 + 0.6 * a), S * 0.006, S * 0.009);
        }
        g.fillStyle = P.lit;
      }

      // Overhead tram wire.
      const wireY = groundTop - 0.4 * PH;
      g.strokeStyle = P.key; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X0, wireY); g.quadraticCurveTo(X0 + PW / 2, wireY + 0.012 * S, X1, wireY); g.stroke();

      // Mid town: the flat houses.
      const midL = this.pan * 0.42;
      while (this.midEnd < midL + PW + 0.3 * S) {
        const b = this.newHouse(false, S, PH);
        b.x = this.midEnd + b.gap; this.midEnd = b.x + b.w; this.mid.push(b);
      }
      this.mid = this.mid.filter((b) => b.x + b.w > midL - 0.3 * S);
      for (const b of this.mid) {
        b.sx = X0 + b.x - midL;
        this.drawHouse(g, b, b.sx, groundTop, P, lit, this.bassEnv, S);
      }

      // Neighbours: a head out of a window with a jagged shout.
      for (const pop of this.pops) {
        const b = pop.b, sl = b.slots && b.slots[pop.si];
        if (!sl || !b.frame) continue;
        const age = t - pop.t0;
        const up = easeOut(clamp(age / 0.08, 0, 1)) * (age > 0.7 ? 1 - (age - 0.7) / 0.2 : 1);
        g.save();
        g.translate(b.frame.x, b.frame.y); g.rotate(b.frame.rot);
        g.translate(sl[0], sl[1]);
        // The window flung open: a dark slot, then the head rising out of it.
        g.fillStyle = P.lit;
        g.fillRect(-sl[2] * 0.7, -sl[3] * 0.7, sl[2] * 1.4, sl[3] * 1.4);
        const hr = 0.026 * S * up;
        if (hr > 0.5) {
          g.fillStyle = P.skin;
          g.beginPath(); g.arc(0, -hr * 0.4, hr, 0, Math.PI * 2); g.fill();
          g.fillStyle = P.nose;
          g.beginPath(); g.ellipse(hr * 0.9 * pop.side, -hr * 0.1, hr * 0.9, hr * 0.38, pop.side * 0.3, 0, Math.PI * 2); g.fill();
          g.fillStyle = P.key;
          g.beginPath(); g.arc(hr * 0.3 * pop.side, -hr * 0.65, hr * 0.14, 0, Math.PI * 2); g.fill();
          // Shout.
          const R = 0.055 * S * up, bx = pop.side * 0.07 * S, by = -0.065 * S;
          g.translate(bx, by); g.rotate(pop.ang * D2R);
          g.fillStyle = P.moon;
          g.beginPath();
          for (let i = 0; i < 18; i++) {
            const a = i * Math.PI * 2 / 18, rr = i % 2 ? R * 0.68 : R;
            g.lineTo(Math.cos(a) * rr * 1.35, Math.sin(a) * rr);
          }
          g.closePath(); g.fill();
          g.fillStyle = P.accent === P.moon ? P.key : P.accent;
          g.font = font(800, 0.03 * S * up, HEAD_FONT, 'sans-serif');
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(pop.word, 0, 0);
        }
        g.restore();
      }

      // Tram: every so often a flat blue tram rattles through the mid-ground.
      if (!this.tram && t > this.nextTram) {
        this.tram = { x: X1 + 0.1 * S, v: -(0.18 + 0.1 * this.rng()) * S };
      }
      if (this.tram) {
        const tr = this.tram;
        tr.x += (tr.v - speed * 0.42) * dt;
        const tw = 0.55 * S, th = 0.14 * PH, ty = groundTop + 0.02 * PH;
        const x = tr.x;
        g.fillStyle = P.tram;
        g.beginPath();
        if (g.roundRect) g.roundRect(x, ty - th, tw, th, th * 0.35); else g.rect(x, ty - th, tw, th);
        g.fill();
        g.fillStyle = P.moon;
        g.fillRect(x + tw * 0.02, ty - th * 0.28, tw * 0.96, th * 0.1);
        const nw = 7;
        for (let i = 0; i < nw; i++) {
          const wx = x + tw * (0.07 + i * 0.125), wy = ty - th * 0.82;
          g.fillStyle = P.lit;
          g.fillRect(wx, wy, tw * 0.09, th * 0.38);
          // Passengers bob to the bass line.
          g.fillStyle = P.key;
          const bob = Math.sin(t * 7.8 + i * 1.3) * th * 0.05 * (0.3 + this.dropL);
          g.beginPath(); g.arc(wx + tw * 0.045, wy + th * 0.28 + bob, th * 0.1, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = P.key; g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(x + tw * 0.45, ty - th); g.lineTo(x + tw * 0.55, (ty - th + wireY) / 2); g.lineTo(x + tw * 0.47, wireY);
        g.stroke();
        g.fillStyle = P.key;
        for (const wx of [0.15, 0.85]) { g.beginPath(); g.arc(x + tw * wx, ty, th * 0.09, 0, Math.PI * 2); g.fill(); }
        if (x + tw < X0 - 0.1 * S) { this.tram = null; this.nextTram = t + 16 + 14 * this.rng(); }
      }

      // Street.
      // A flat pavement he can be seen on, and the gutter along the bottom.
      g.fillStyle = P.pave;
      g.fillRect(X0, groundTop + 0.02 * PH, PW, Y1 - groundTop);
      g.fillStyle = P.street;
      g.fillRect(X0, groundTop + 0.02 * PH, PW, 0.018 * PH);
      g.fillRect(X0, Y1 - 0.045 * PH, PW, 0.045 * PH);
      // Paving joints slide past with the street.
      const gL = this.pan;
      const jp = 0.09 * S;
      g.strokeStyle = P.street; g.lineWidth = 1.3;
      g.beginPath();
      for (let k = Math.floor(gL / jp) - 1; k * jp < gL + PW + jp; k++) {
        const jx = X0 + k * jp - gL;
        g.moveTo(jx, groundTop + 0.038 * PH); g.lineTo(jx - 0.03 * S, Y1 - 0.045 * PH);
      }
      g.stroke();

      // Lamps at the back of the pavement, moving with the street.
      const lp = 0.62 * PW;
      for (let k = Math.floor(gL / lp) - 1; k * lp < gL + PW + lp; k++) {
        const lx = X0 + k * lp - gL + 0.3 * lp;
        const base = groundTop + 0.05 * PH, top = base - 0.55 * PH;
        g.fillStyle = P.cone;
        g.beginPath(); g.moveTo(lx - 0.006 * S, top + 0.02 * S); g.lineTo(lx + 0.006 * S, top + 0.02 * S);
        g.lineTo(lx + 0.09 * S, base + 0.01 * S); g.lineTo(lx - 0.09 * S, base + 0.01 * S); g.closePath(); g.fill();
        g.fillStyle = P.key;
        g.fillRect(lx - 0.004 * S, top, 0.008 * S, base - top);
        g.fillRect(lx - 0.012 * S, base - 0.02 * S, 0.024 * S, 0.02 * S);
        g.fillStyle = P.lit;
        g.beginPath(); g.arc(lx, top, 0.017 * S, 0, Math.PI * 2); g.fill();
        g.fillStyle = P.key;
        g.beginPath(); g.moveTo(lx - 0.02 * S, top - 0.012 * S); g.lineTo(lx, top - 0.03 * S); g.lineTo(lx + 0.02 * S, top - 0.012 * S); g.closePath(); g.fill();
      }

      // The chorus line, sliding in for the drop.
      const nC = Math.round(params.chorus);
      if (this.chorusIn > 0.01 && nC > 0) {
        const cu2 = 0.26 * PH;
        const span = Math.min(PW * 0.5, nC * cu2 * 0.42);
        const cx0 = X1 - span - PW * 0.05 + (1 - this.chorusIn) * (span + PW * 0.2) * (this.drop ? 1 : -2.2);
        const cy = groundTop + 0.075 * PH;
        const cc = { coat: P.key, limb: P.key, limbBack: P.key, hat: P.accent, band: null };
        const moving = Math.abs(1 - this.chorusIn) > 0.08;
        const cwp = this.walkPose(q + Math.PI / 2, 0);
        const cpose = moving ? cwp : this.cCur;
        for (let i = 0; i < nC; i++) {
          const x = cx0 + (i + 0.5) * span / nC;
          if (x < X0 - cu2 || x > X1 + cu2) continue;
          this.figure(g, x, cy, cu2, cpose, cc, { silhouette: true });
        }
      }

      // The hero.
      const col = {
        coat: this.coatRed ? P.coatDrop : P.coat,
        limb: P.key, limbBack: P.key, hand: P.moon, skin: P.skin, nose: P.nose,
        eyeWhite: P.moon, hat: P.key, cheek: P.cheek, band: this.coatRed ? P.moon : P.accent,
        detail: this.coatRed ? P.key : P.moon,
      };
      if (P.coat === P.key && !this.coatRed) col.detail = P.moon;
      // His shadow: a flat ellipse, not a blur.
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(heroX + 0.02 * heroU, heroY + 0.005 * heroU, 0.16 * heroU, 0.022 * heroU, 0, 0, Math.PI * 2); g.fill();
      const footPt = this.figure(g, heroX, heroY, heroU, pose, col, { hatY: this.hatY, hatSpin: this.hatSpin });
      // Stomp: the cartoon's impact marks, short strokes flung out from the
      // planted foot, so the kick lands at his feet as well as in his pose.
      if (this.stomp) {
        const a = (t - this.stomp.t0) / 0.24;
        if (a >= 0 && a < 1) {
          const e = easeOut(a), R0 = heroU * (0.08 + 0.12 * e), R1 = R0 + heroU * 0.1 * (1 - a) * clamp(this.stomp.k, 0, 2);
          g.strokeStyle = P.key; g.lineWidth = Math.max(1.5, 0.02 * heroU); g.lineCap = 'round';
          g.beginPath();
          for (let i = 0; i < 7; i++) {
            const an = Math.PI * (1.08 + i * 0.14);
            g.moveTo(footPt[0] + Math.cos(an) * R0 * 1.5, footPt[1] + Math.sin(an) * R0 * 0.9);
            g.lineTo(footPt[0] + Math.cos(an) * R1 * 1.5, footPt[1] + Math.sin(an) * R1 * 0.9);
          }
          g.stroke();
        }
      }

      g.restore(); // picture clip

      // Key line round the picture, as a printed border.
      g.strokeStyle = P.key; g.lineWidth = 2;
      g.strokeRect(X0, Y0, PW, PH);

      // ---- type
      const title = ((params.words || '').trim() || TITLE).toLowerCase();
      let ts = 0.105 * S;
      g.font = font(800, ts, HEAD_FONT, 'sans-serif');
      const maxTW = PW * (W / S > 1.2 ? 0.74 : 0.98);
      const tw0 = g.measureText(title).width;
      if (tw0 > maxTW) { ts *= maxTW / tw0; g.font = font(800, ts, HEAD_FONT, 'sans-serif'); }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const tyBase = m + head * 0.78;
      let tx = X0 - ts * 0.02;
      const hopA = 0.18 * ts * this.dropL;
      for (let i = 0; i < title.length; i++) {
        const ch = title[i];
        const cw = g.measureText(ch).width;
        // In the drop the letters hop in a wave that runs along the title.
        const wv = Math.max(0, Math.sin(t * 5.2 - i * 0.55));
        const dy = -hopA * wv * wv;
        g.fillStyle = (i % 7 === 3 && this.dropL > 0.5) ? P.accent : P.key;
        if (ch !== ' ') g.fillText(ch, tx, tyBase + dy);
        tx += cw;
      }
      // Side note in the header, set in a light geometric sans.
      if (W / S > 1.2) {
        g.textAlign = 'right';
        g.fillStyle = P.key;
        g.font = font(700, 0.022 * S, CAP_FONT, 'sans-serif');
        g.fillText('A CARTOON IN SIX INKS', X1, m + head * 0.42);
        g.font = font(300, 0.022 * S, CAP_FONT, 'sans-serif');
        g.fillText('with dancing, neighbours', X1, m + head * 0.62);
        g.fillText('and a tram', X1, m + head * 0.8);
      }
      // Credit line.
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = P.key;
      g.font = font(700, 0.02 * S, CAP_FONT, 'sans-serif');
      const cy2 = Y1 + foot * 0.55;
      g.fillText('STUDIO MALA NOĆ', X0 + 0.04 * S, cy2);
      g.font = font(300, 0.02 * S, CAP_FONT, 'sans-serif');
      g.textAlign = 'right';
      g.fillText('drawn frame by frame  ·  music by whoever is at the decks', X1, cy2);
      // A little studio mark: a circle with a bar through it.
      g.fillStyle = P.accent;
      const sr = 0.011 * S, smx = X0 + sr * 1.6;
      g.beginPath(); g.arc(smx, cy2, sr, 0, Math.PI * 2); g.fill();
      g.fillStyle = P.key; g.fillRect(smx - sr * 1.6, cy2 - sr * 0.22, sr * 3.2, sr * 0.44);

      // Paper grain over everything, multiplied.
      if (params.texture > 0.001) {
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = clamp(params.texture, 0, 1);
        g.fillStyle = this.grainPat;
        g.fillRect(-2, -2, W + 4, H + 4);
      }
      g.restore();
    },
  });
})();
