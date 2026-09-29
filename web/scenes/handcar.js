// Railway Handcar — batch 06, "Figurative worlds" (harness/briefs/batch-06-ideas.md).
//
// A flat 1950s cartoon tracking shot. Two little railwaymen pump a red handcar
// along a branch line: Alf, tall, in a bowler and a ginger moustache, and Bert,
// short and round, in a flat cap and a red neckerchief. The camera rides with
// them; the world streams past in planes (angular far mountains, rolling hills
// with lollipop trees, telegraph poles and their sagging wires, semaphore
// signals, cows on the embankment).
//
// The track is real: behind the car it is the record of the grade they have
// actually ridden, and ahead of it the line is laid out from the current grade,
// so a climb always shows its crest waiting up the hill, getting closer the
// longer they climb, and a plunge shows the valley floor far below.
//
// Music, each in its own place:
//   kick   the pump lever: one stroke per kick, a seesaw with weight and
//          overshoot, and the two men bob out of phase on it (only them; each
//          stroke also gives the car a small shove of speed)
//   snare  the semaphore arms flip between stop and go, and the cows swing
//          their heads up from the grass to watch
//   bass   speed, and so the rush of the poles and the flutter of the pennant
//   hats   glints skate along the rail; at dusk the stars and the lake twinkle
//   build  the line tilts up into a long climb in the golden afternoon, the
//          lake sinks away behind the hills, the crest comes into view ahead
//   drop   over the top: the car tips and plunges, the scenery tears into
//          speed streaks, sparks fly off the wheels, hats lift off heads and
//          both men whoop; each drop crosses into a new country (meadow,
//          autumn, alpine)
//   breakdown  the line bottoms out along a lake at dusk and they coast, the
//          lever still, Bert puffing his pipe
// Matte Canvas 2D: flat fills, ink outlines, hard-edged sky bands, a paper
// grain multiplied over everything. No glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const TAU = Math.PI * 2;
  const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

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
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixA = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const css = (a, al) => al === undefined
    ? 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')'
    : 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al.toFixed(3) + ')';

  const INK = '#2A211C';
  const CREAM = '#F4EAD2';

  // Sky bands, top to horizon, at noon / golden afternoon / dusk.
  const SKY = [
    ['#4E9CC4', '#6DB0CE', '#93C6D2', '#BFDBD2', '#E6E6C8'].map(rgb),
    ['#5F93B2', '#8FB1B0', '#D8C68E', '#EDC47A', '#F4DCA0'].map(rgb),
    ['#2F3566', '#5C4A7E', '#A45A7E', '#E0786A', '#F3AE66'].map(rgb),
  ];
  const skyAt = (d, i) => d < 0.5 ? mixA(SKY[0][i], SKY[1][i], d * 2) : mixA(SKY[1][i], SKY[2][i], (d - 0.5) * 2);
  const DUSKTINT = rgb('#5B4876');

  // The three countries a drop can carry them into.
  const LANDS = [
    { name: 'Meadow', far: '#7FA3A6', farSnow: false, mid: '#86AE52', midDark: '#6F9844',
      trees: ['#4F8A3E', '#6FA048', '#3F7536'], treeKind: 0, trunk: '#6B4A33',
      ground: '#A2C45C', groundDark: '#8BB04C', groundDeep: '#76993F', cows: true, flower: '#F4EAD2' },
    { name: 'Autumn', far: '#A98C8A', farSnow: false, mid: '#D7A443', midDark: '#C08435',
      trees: ['#CF5530', '#E38D2F', '#B23F2A'], treeKind: 1, trunk: '#5E3F2C',
      ground: '#D2A24E', groundDark: '#BF8B40', groundDeep: '#A87536', cows: true, flower: '#C4472F' },
    { name: 'Alpine', far: '#8EA8C6', farSnow: true, mid: '#4E8C78', midDark: '#3F7565',
      trees: ['#2C6457', '#3B7866', '#255247'], treeKind: 2, trunk: '#4A3A30',
      ground: '#79AE83', groundDark: '#669B72', groundDeep: '#558460', cows: false, flower: '#F2C24B' },
  ].map((L) => Object.assign({}, L, {
    farC: rgb(L.far), midC: rgb(L.mid), midDarkC: rgb(L.midDark), groundC: rgb(L.ground),
    groundDarkC: rgb(L.groundDark), groundDeepC: rgb(L.groundDeep),
  }));

  const PRESETS = {
    calm: { grade: 0, speed: 0.45, lake: 1, dusk: 0.9, rush: 0 },
    drop: { grade: -0.8, speed: 1.8, lake: 0, dusk: 0.3, rush: 1 },
    climb: { grade: 0.62, speed: 0.3, lake: 0, dusk: 0.55, rush: 0 },
    express: { grade: 0, speed: 1.25, lake: 0, dusk: 0.08, rush: 0.45 },
  };
  const DRIVE = ['grade', 'speed', 'lake', 'dusk', 'rush'];
  const SLOPE = 0.8;       // track rise per unit run at grade 1
  const SAMP = 4;          // history sample spacing, world units
  const NH = 1024;         // history samples kept (4096 units)
  const CS = 1.4;          // the car and crew, drawn a little larger than life

  // Two-bone IK in screen coordinates; `pick` chooses between the two joint
  // solutions (it gets the joint and returns a score, higher wins).
  function ik(ax, ay, tx, ty, l1, l2, pick) {
    const dx = tx - ax, dy = ty - ay;
    const d = Math.hypot(dx, dy) || 1e-3;
    const dm = clamp(d, Math.abs(l1 - l2) + 1, l1 + l2 - 0.3);
    const ux = dx / d, uy = dy / d;
    const a = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = ax + ux * a, my = ay + uy * a;
    const j1 = [mx - uy * h, my + ux * h], j2 = [mx + uy * h, my - ux * h];
    const e = [ax + ux * dm, ay + uy * dm];
    return pick(j1) >= pick(j2) ? [j1, e] : [j2, e];
  }

  VIZ.register({
    id: 'handcar',
    name: 'Railway Handcar',
    order: 820,

    params: [
      { key: 'land', label: 'Country', type: 'select', options: LANDS.map((l) => l.name), default: 0 },
      { key: 'grade', label: 'Hill (plunge ← flat → climb)', type: 'range', min: -1, max: 1, default: PRESETS.calm.grade, step: 0.01 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'lake', label: 'Lakeside', type: 'range', min: 0, max: 1, default: PRESETS.calm.lake, step: 0.01 },
      { key: 'dusk', label: 'Time of day (noon → dusk)', type: 'range', min: 0, max: 1, default: PRESETS.calm.dusk, step: 0.01 },
      { key: 'rush', label: 'Rush (streaks, sparks, whoops)', type: 'range', min: 0, max: 1, default: PRESETS.calm.rush, step: 0.01 },
      { key: 'reaction', label: 'Pump strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Railway Handcar',
      technique: 'Canvas 2D: a track that is a ring buffer of the grade actually ridden behind the car and a per-frame extrapolation ahead of it (so the crest of a climb and the floor of a plunge are always in view), parallax planes in their own scroll coordinates (piecewise-linear far mountains, sine-sum hills with hashed trees whose country is fixed where each drop crossed a border), a sprung seesaw lever driven by kick onsets, two crewmen posed from the lever by two-bone IK, flat hard-edged sky bands interpolated noon → golden → dusk, a section follower that blends the params toward climb, drop and calm presets, and a multiplied paper grain',
      brief: 'Two cartoon railwaymen pump a red handcar along a branch line, flat 1950s style: tall Alf in a bowler and ginger moustache, round Bert in a flat cap and red neckerchief. The camera rides with them while the world streams past in planes. The kick is the pump lever, a seesaw with weight and overshoot that bobs the two men out of phase; the snare flips the semaphore arms and swings the cows\' heads up; the bass is speed; hats skate glints along the rail and twinkle the dusk stars. The build tilts the line up a long climb in golden light with the crest waiting ahead; the drop tips over the top and plunges, the scenery tearing into speed streaks, sparks off the wheels, hats lifting, both men whooping, into a new country each time; the breakdown bottoms out along a lake at dusk where they coast and Bert puffs his pipe.',
      lineage: [
        'Batch 06 idea 21, "Railway Handcar" (Director): climb, crest, coast, a story in every cycle, with the kick as the pump lever.',
        'Night Train (a locked tracking shot with the world streaming past and poles whipping through), Zagreb (a flat limited-palette cartoon with characters whose state changes with the section), Cube (mechanical acting: a lever with weight, overshoot and an idle breath, here Bert\'s pipe).',
        'UPA and 1950s railway cartoons, the Rev. W. Awdry\'s branch lines, Mary Blair\'s flat hills and lollipop trees.',
        'Presets: calm (coasting by the lake at dusk), drop (the plunge), climb (the long pull up in golden light), express (a flat-out noon run through the fields).',
      ].join(' '),
    },

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9) + 11);
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        low: 0, dropOn: false, hadDrop: false, drops: 0,
        auto: 0, bld: 0, rest: 0, hat: 0, hatLvl: 0, bass: 0,
        lastKick: -10, lastSnare: -10, lastHat: -10, kicks: 0, snares: 0,
      };
      // track
      this.S = 0; this.hist = new Float64Array(NH); this.lastIdx = 0; this.lastH = 0;
      this.hC = 0; this.hRef = 0; this.climbT = 0; this.plungeT = 0; this.surge = 0;
      this.carSY = null; this.gCam = 0; this.carAng = 0;
      this.farX = 0; this.midX = 0; this.cloudX = 0; this.wheel = 0;
      // lever and signals
      this.lev = 0; this.levV = 0; this.levT = 0; this.levSide = 1;
      this.sig = 0; this.sigV = 0; this.sigT = 0; this.cow = 0; this.cowV = 0; this.cowT = 0;
      // countries: borders in mid-layer and world coordinates
      this.midBorders = [{ x: -1e9, land: 0 }];
      this.worldBorders = [{ x: -1e9, land: 0 }];
      this.landShown = 0; this.landFrom = 0; this.landMix = 1;
      this.glints = []; this.sparks = []; this.puffs = []; this.stars = null;
      this.streaksArr = null;
      this.twinkle = new Float32Array(40).fill(0.6);
      this.flag = 0; this.blink = 0; this.nextBlink = 2.5; this.nextPuff = 1;
      this.chapter = ''; this.chapterA = 0; this.chapterNext = '';
      this.grain = null; this.pxs = 0;
    },

    // ---------------------------------------------------------------- audio

    listen(s, t, dt, P, react) {
      const e = this.env;
      let kick = false, snare = false, hat = false;
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - e.lastKick > 0.22) { e.lastKick = t; kick = true; }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - e.lastSnare > 0.26) { e.lastSnare = t; snare = true; }
      if (s[8] - this.prev[8] > 8 && s[8] > 18 && t - e.lastHat > 0.07) { e.lastHat = t; hat = true; }
      this.prev.set(s);

      const hatNow = (s[6] + s[7] + s[8]) / 300;
      e.hat = ease(e.hat, hatNow, 1.5, dt);
      e.hatLvl = ease(e.hatLvl, hatNow, hatNow > e.hatLvl ? 25 : 5, dt);
      e.bass = ease(e.bass, Math.max(s[0], s[1]) / 100, 1.6, dt);
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && (e.low > 27 || (s[0] > 90 && s[1] > 90))) {
        e.dropOn = true; e.hadDrop = true; e.drops++;
      } else if (e.dropOn && e.low < 19) e.dropOn = false;

      // Section weights for Follow: rising hats climb the hill, the drop is
      // the plunge, and a kick-less stretch after a drop coasts by the lake.
      const bTarget = e.dropOn ? 0 : smooth(0.025, 0.16, e.hat);
      // in the drop the climb hands over to the plunge only as fast as the
      // plunge arrives, so the lakeside underneath never shows through
      e.bld = ease(e.bld, bTarget, bTarget > e.bld ? 1.2 : e.dropOn ? 0.8 : 2.5, dt);
      const rTarget = e.hadDrop && !e.dropOn && t - e.lastKick > 1.0 && e.bld < 0.4 ? 1 : 0;
      e.rest = ease(e.rest, rTarget, rTarget ? 0.8 : 1.6, dt);
      e.auto = ease(e.auto, e.dropOn ? 1 : 0, e.dropOn ? 3.2 : 0.9, dt);

      if (kick) {
        // one stroke: the lever goes to the other side, harder in a rush
        this.levSide = -this.levSide;
        this.levT = this.levSide * 0.4 * clamp(0.55 + 0.45 * react, 0.2, 1.4);
        this.levV += this.levSide * 1.6 * react;
        this.surge += 0.12 * react;
        e.kicks++;
      }
      if (snare) {
        this.sigT = this.sigT > 0.5 ? 0 : 1;
        this.cowT = this.cowT > 0.5 ? 0 : 1;
        e.snares++;
      }
      if (hat) {
        for (let i = 0; i < 2; i++) this.glints.push({ s: this.S + 60 + this.rng() * 700, age: 0, life: 0.35 + this.rng() * 0.25 });
        for (let i = 0; i < this.twinkle.length; i++) if (this.rng() < 0.3) this.twinkle[i] = 1.2;
      }
      return kick;
    },

    // ---------------------------------------------------------------- track

    advance(dt, P) {
      const gs = P.grade * SLOPE;
      const v = this.v;
      this.S += v * dt;
      while ((this.lastIdx + 1) * SAMP <= this.S) {
        this.lastH += gs * SAMP; this.lastIdx++;
        this.hist[this.lastIdx % NH] = this.lastH;
      }
      this.hC = this.lastH + gs * (this.S - this.lastIdx * SAMP);
      this.hRef = ease(this.hRef, this.hC, 0.35, dt);
      if (P.grade > 0.12) this.climbT += dt * smooth(0.12, 0.4, P.grade); else this.climbT = Math.max(0, this.climbT - dt * 3);
      if (P.grade < -0.12) this.plungeT += dt; else this.plungeT = Math.max(0, this.plungeT - dt * 3);
    },

    histH(s) {
      const f = s / SAMP;
      let i = Math.floor(f);
      const lo = this.lastIdx - NH + 2;
      if (i < lo) i = lo;
      if (i >= this.lastIdx) return this.lastH;
      const a = this.hist[((i % NH) + NH) % NH], b = this.hist[(((i + 1) % NH) + NH) % NH];
      return lerp(a, b, clamp(f - i, 0, 1));
    },

    // Heights ahead of the car: the current grade bending toward what lies
    // beyond it (a crest over a climb, the valley floor under a plunge).
    layAhead(P, W) {
      const g = P.grade * SLOPE;
      let gA = 0, D = 800;
      if (P.grade > 0) { gA = -Math.max(0.35, P.grade) * SLOPE * 1.1; D = lerp(820, 170, smooth(0, 6.5, this.climbT)); }
      else if (P.grade < 0) { gA = 0; D = lerp(760, 330, smooth(0, 6, this.plungeT)); }
      const n = Math.ceil(W / 8) + 2;
      if (!this.ahead || this.ahead.length < n + 1) this.ahead = new Float64Array(n + 1);
      const A = this.ahead;
      A[0] = this.hC;
      for (let j = 1; j <= n; j++) {
        const d = (j - 0.5) * 8;
        const sl = g + (gA - g) * smooth(D - 110, D + 110, d);
        A[j] = A[j - 1] + sl * 8;
      }
    },

    // track height (world) at screen offset d from the car
    hAt(d) {
      if (d <= 0) return this.histH(this.S + d);
      const f = d / 8, i = Math.floor(f), A = this.ahead;
      if (i + 1 >= A.length) return A[A.length - 1];
      return lerp(A[i], A[i + 1], f - i);
    },
    yAt(d) { return this.carSY - (this.hAt(d) - this.hC); },

    landAt(borders, x) {
      let l = borders[0].land;
      for (let i = 0; i < borders.length; i++) if (borders[i].x <= x) l = borders[i].land;
      return l;
    },

    // ---------------------------------------------------------------- paint

    makeGrain() {
      const n = 256, rng = mulberry(47);
      const cv = canvas(n, n), g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, n, n);
      const img = g.getImageData(0, 0, n, n);
      for (let i = 0; i < n * n; i++) {
        const r = rng();
        const v = r < 0.05 ? 206 + rng() * 26 : r < 0.3 ? 238 + rng() * 12 : 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      }
      g.putImageData(img, 0, 0);
      return cv;
    },

    drawSky(c, W, H, P, horizon, t) {
      const d = P.dusk;
      const bandY = [0, 0.2, 0.36, 0.5, 0.62].map((f) => lerp(-10, horizon, f / 0.62 * 0.92));
      for (let i = 0; i < 5; i++) {
        c.fillStyle = css(skyAt(d, i));
        c.fillRect(0, bandY[i], W, (i < 4 ? bandY[i + 1] : H) - bandY[i] + 1);
      }
      // stars come out at dusk and twinkle on the hats
      const starA = smooth(0.62, 0.95, d);
      if (starA > 0.01) {
        if (!this.stars) {
          const r = mulberry(5); this.stars = [];
          for (let i = 0; i < 40; i++) this.stars.push([r(), r() * 0.3, 0.8 + r() * 1.4]);
        }
        for (let i = 0; i < this.stars.length; i++) {
          const s = this.stars[i];
          const x = ((s[0] * (W + 200) - this.cloudX * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
          const y = s[1] * H + 8;
          const tw = this.twinkle[i];
          c.fillStyle = css(rgb('#FFF3D6'), starA * clamp(tw, 0.2, 1));
          const r = s[2] * (0.7 + 0.5 * tw);
          c.fillRect(x - r * 0.35, y - r * 1.6, r * 0.7, r * 3.2);
          c.fillRect(x - r * 1.6, y - r * 0.35, r * 3.2, r * 0.7);
        }
      }
    },

    sunPos(W, H, P, horizon) {
      const d = P.dusk;
      return { x: W * lerp(0.78, 0.7, d), y: lerp(H * 0.14, horizon - H * 0.05, smooth(0, 1, d)), r: lerp(34, 46, d),
        col: d < 0.5 ? mixA(rgb('#FFF6DA'), rgb('#FBE08A'), d * 2) : mixA(rgb('#FBE08A'), rgb('#F58A4E'), (d - 0.5) * 2) };
    },

    drawClouds(c, W, H, P) {
      const d = P.dusk;
      const col = mixA(mixA(rgb('#FBF4E2'), rgb('#F6D9A8'), smooth(0.2, 0.6, d)), rgb('#E9A08E'), smooth(0.6, 1, d));
      const sh = mixA(col, DUSKTINT, 0.25);
      for (let i = 0; i < 6; i++) {
        const span = W + 360;
        const x = ((hash(i + 3) * span - this.cloudX * (0.6 + 0.4 * hash(i + 9))) % span + span) % span - 180;
        const y = H * (0.07 + 0.22 * hash(i + 21));
        const w = 70 + 90 * hash(i + 33), h = 16 + 8 * hash(i + 41);
        c.fillStyle = css(sh);
        this.pill(c, x + 4, y + 5, w, h);
        c.fillStyle = css(col);
        this.pill(c, x, y, w, h);
        this.pill(c, x + w * 0.2, y - h * 0.7, w * 0.45, h);
      }
    },
    pill(c, x, y, w, h) {
      const r = h / 2;
      c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); c.fill();
    },

    // angular far mountains, piecewise linear in their own scroll coordinate
    mtnY(x, base) {
      const cell = 110, i = Math.floor(x / cell), f = x / cell - i;
      const a = hash(i * 1.7 + 0.3), b = hash((i + 1) * 1.7 + 0.3);
      return base - lerp(a, b, f) * 120 - 20;
    },
    drawFar(c, W, H, P, base, land, reflect) {
      const col = mixA(land.farC, DUSKTINT, P.dusk * 0.55);
      const x0 = this.farX;
      c.beginPath();
      c.moveTo(-20, base + 400);
      for (let x = -20; x <= W + 20; x += 11) c.lineTo(x, this.mtnY(x + x0, base));
      c.lineTo(W + 20, base + 400); c.closePath();
      c.fillStyle = css(col); c.fill();
      // a shadow face on each peak for the flat-cut look
      c.fillStyle = css(mixA(col, rgb('#2A2440'), 0.18));
      const cell = 110;
      const i0 = Math.floor((x0 - 40) / cell), i1 = Math.ceil((x0 + W + 40) / cell);
      for (let i = i0; i <= i1; i++) {
        const h0 = hash(i * 1.7 + 0.3), hl = hash((i - 1) * 1.7 + 0.3), hr = hash((i + 1) * 1.7 + 0.3);
        if (h0 < hl || h0 < hr) continue;
        const px = i * cell - x0, py = base - h0 * 120 - 20;
        const rx = (i + 1) * cell - x0, ry = base - hr * 120 - 20;
        c.beginPath(); c.moveTo(px, py); c.lineTo(rx, ry); c.lineTo(rx - 30, base + 10); c.lineTo(px + 6, base + 10); c.closePath(); c.fill();
        if (land.farSnow) {
          c.fillStyle = css(mixA(rgb('#F6F1E6'), DUSKTINT, P.dusk * 0.35));
          const lx = (i - 1) * cell - x0, ly = base - hl * 120 - 20;
          const u = 0.28;
          c.beginPath(); c.moveTo(px, py); c.lineTo(lerp(px, rx, u), lerp(py, ry, u)); c.lineTo(lerp(px, rx, u * 0.6), lerp(py, ry, u) + 7);
          c.lineTo(px, py + 12); c.lineTo(lerp(px, lx, u * 0.5), lerp(py, ly, u * 0.5) + 6); c.lineTo(lerp(px, lx, u), lerp(py, ly, u)); c.closePath(); c.fill();
          c.fillStyle = css(mixA(col, rgb('#2A2440'), 0.18));
        }
      }
    },

    hillY(x, base) {
      return base - 26 * Math.sin(x * 0.0042 + 0.7) - 14 * Math.sin(x * 0.0113 + 1.3) - 6 * Math.sin(x * 0.029);
    },
    drawMid(c, W, H, P, base, landCol) {
      const x0 = this.midX;
      c.beginPath(); c.moveTo(-20, H + 400);
      for (let x = -20; x <= W + 20; x += 10) c.lineTo(x, this.hillY(x + x0, base));
      c.lineTo(W + 20, H + 400); c.closePath();
      c.fillStyle = css(mixA(landCol.mid, DUSKTINT, P.dusk * 0.35)); c.fill();
      // a darker second hill line lower down
      c.beginPath(); c.moveTo(-20, H + 400);
      for (let x = -20; x <= W + 20; x += 12) c.lineTo(x, this.hillY(x + x0 + 900, base + 46) + 8);
      c.lineTo(W + 20, H + 400); c.closePath();
      c.fillStyle = css(mixA(landCol.midDark, DUSKTINT, P.dusk * 0.38)); c.fill();

      // trees, each belonging to the country it was planted in
      const cell = 58, rush = P.rush * clamp(this.v / 260, 0, 1.3);
      const i0 = Math.floor((x0 - 60) / cell), i1 = Math.ceil((x0 + W + 60) / cell);
      for (let i = i0; i <= i1; i++) {
        if (hash(i * 3.1 + 7) < 0.42) continue;
        const wx = i * cell + hash(i * 5.3) * 34;
        const land = LANDS[this.landAt(this.midBorders, wx)];
        const x = wx - x0;
        const back = hash(i * 2.9) < 0.5;
        const y = back ? this.hillY(wx, base) + 6 : this.hillY(wx + 900, base + 46) + 14;
        const sz = (back ? 0.8 : 1.05) * (0.8 + 0.5 * hash(i * 9.7));
        const tc = mixA(rgb(land.trees[Math.floor(hash(i * 4.4) * 3)]), DUSKTINT, P.dusk * 0.35);
        this.tree(c, x, y, sz, land.treeKind, tc, mixA(rgb(land.trunk), DUSKTINT, P.dusk * 0.3), rush);
      }
    },
    tree(c, x, y, s, kind, col, trunk, rush) {
      const tail = rush * 70 * s;
      c.fillStyle = css(trunk);
      if (kind === 2) {
        c.fillRect(x - 2 * s, y - 8 * s, 4 * s, 10 * s);
        c.fillStyle = css(col);
        for (let k = 0; k < 3; k++) {
          const w = (20 - k * 5) * s, yy = y - (6 + k * 12) * s;
          c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x + w + tail * 0.8, yy); c.lineTo(x + tail * 0.3, yy - 20 * s); c.closePath(); c.fill();
        }
        return;
      }
      c.fillRect(x - 2 * s, y - 20 * s, 4 * s, 22 * s);
      c.fillStyle = css(col);
      const r = (kind === 1 ? 13 : 15) * s, cy = y - (kind === 1 ? 32 : 30) * s;
      c.beginPath();
      if (kind === 1) c.ellipse(x, cy, r * 0.8, r * 1.35, 0, 0, TAU);
      else c.arc(x, cy, r, 0, TAU);
      c.fill();
      if (tail > 1) {
        // the tree tears into a speed streak behind it
        const rr = kind === 1 ? r * 0.8 : r;
        c.fillRect(x, cy - rr * 0.55, tail, rr * 1.1);
        c.fillStyle = css(col, 0.5);
        c.fillRect(x + tail, cy - rr * 0.3, tail * 0.8, rr * 0.6);
      }
      c.fillStyle = 'rgba(255,245,220,0.18)';
      c.beginPath(); c.arc(x - r * 0.35, cy - r * 0.35, r * 0.35, 0, TAU); c.fill();
    },

    drawLake(c, W, H, P, top, far, landCol) {
      const d = P.dusk;
      const water = mixA(rgb('#4E97B4'), rgb('#6B5A8C'), smooth(0.3, 1, d));
      const light = mixA(rgb('#8CC3CE'), rgb('#E48A72'), smooth(0.3, 1, d));
      c.fillStyle = css(water); c.fillRect(0, top, W, H - top + 50);
      // far shore mirrored into the water
      c.save();
      c.beginPath(); c.rect(0, top, W, H); c.clip();
      const col = mixA(mixA(landCol.far, DUSKTINT, d * 0.55), water, 0.45);
      c.beginPath(); c.moveTo(-20, top);
      for (let x = -20; x <= W + 20; x += 11) c.lineTo(x, top + (top - this.mtnY(x + this.farX, far)) * 0.55);
      c.lineTo(W + 20, top); c.closePath();
      c.fillStyle = css(col); c.fill();
      // wind lines of reflected sky
      c.fillStyle = css(light, 0.55);
      for (let k = 0; k < 7; k++) {
        const y = top + 30 + k * k * 7 + 4 * Math.sin(this.lakeT * 0.7 + k);
        const w = 60 + 90 * hash(k + 1), span = W + 300;
        const x = ((hash(k + 11) * span - this.midX * 0.5) % span + span) % span - 150;
        c.fillRect(x, y, w, 2.2);
        c.fillRect(x + w * 1.4, y + 2, w * 0.5, 2.2);
      }
      // the sun's road across the water
      const sp = this.sun;
      const sr = css(sp.col, 0.8);
      c.fillStyle = sr;
      for (let k = 0; k < 9; k++) {
        const y = top + 6 + k * 11;
        const w = (sp.r * 1.4) * (1 - k * 0.06) * (0.7 + 0.3 * Math.sin(this.lakeT * 2.1 + k * 1.7)) * (0.8 + 0.4 * clamp(this.twinkle[k] || 0.6, 0, 1.2));
        c.fillRect(sp.x - w / 2, y, w, 3.2);
      }
      // two little sailboats out on the water
      for (let b = 0; b < 2; b++) {
        const span = W + 400;
        const x = ((hash(b + 71) * span - this.midX * 0.45 + this.lakeT * 6) % span + span) % span - 200;
        const y = top + 34 + b * 40;
        const s = 0.8 + b * 0.35;
        c.fillStyle = css(mixA(rgb(INK), water, 0.2));
        c.beginPath(); c.moveTo(x - 16 * s, y); c.lineTo(x + 16 * s, y); c.lineTo(x + 11 * s, y + 6 * s); c.lineTo(x - 12 * s, y + 6 * s); c.closePath(); c.fill();
        c.fillStyle = css(mixA(rgb(CREAM), DUSKTINT, d * 0.25));
        c.beginPath(); c.moveTo(x - 1 * s, y - 2 * s); c.lineTo(x - 1 * s, y - 34 * s); c.lineTo(x + 14 * s, y - 2 * s); c.closePath(); c.fill();
        c.fillStyle = b ? '#C4472F' : '#E3A93B';
        c.beginPath(); c.moveTo(x - 4 * s, y - 2 * s); c.lineTo(x - 4 * s, y - 26 * s); c.lineTo(x - 15 * s, y - 2 * s); c.closePath(); c.fill();
        c.fillStyle = css(light, 0.45); c.fillRect(x - 14 * s, y + 9 * s, 26 * s, 2);
      }
      c.restore();
    },

    // telegraph poles behind the rail, wires sagging between them
    drawPoles(c, W, P) {
      const sp = 170, carX = this.carX;
      const i0 = Math.floor((this.S - carX - 60) / sp), i1 = Math.ceil((this.S + W - carX + 60) / sp);
      const tops = [];
      const col = mixA(rgb('#5A4032'), DUSKTINT, P.dusk * 0.4);
      c.fillStyle = css(col); c.strokeStyle = css(col);
      for (let i = i0; i <= i1; i++) {
        const x = i * sp - this.S + carX;
        const y = this.yAt(x - carX) - 4;
        const top = y - 112;
        c.fillRect(x - 2.5, top, 5, y - top);
        c.fillRect(x - 14, top + 8, 28, 4);
        c.fillStyle = css(mixA(rgb(CREAM), DUSKTINT, P.dusk * 0.3));
        c.fillRect(x - 12, top + 4, 3, 4); c.fillRect(x + 9, top + 4, 3, 4);
        c.fillStyle = css(col);
        tops.push([x, top + 6]);
      }
      c.lineWidth = 1.2; c.strokeStyle = css(mixA(rgb(INK), DUSKTINT, P.dusk * 0.3), 0.7);
      for (let k = 0; k < tops.length - 1; k++) {
        const a = tops[k], b = tops[k + 1];
        for (const off of [-10.5, 10.5]) {
          c.beginPath(); c.moveTo(a[0] + off, a[1]);
          c.quadraticCurveTo((a[0] + b[0]) / 2 + off, (a[1] + b[1]) / 2 + 22, b[0] + off, b[1]); c.stroke();
        }
      }
    },

    drawSignals(c, W, P) {
      const sp = 620, carX = this.carX;
      const i0 = Math.floor((this.S - carX - 80) / sp), i1 = Math.ceil((this.S + W - carX + 80) / sp);
      const post = mixA(rgb('#F1E6CC'), DUSKTINT, P.dusk * 0.3);
      for (let i = i0; i <= i1; i++) {
        const x = i * sp + 250 - this.S + carX;
        const y = this.yAt(x - carX) - 2;
        const top = y - 128;
        c.fillStyle = css(post); c.fillRect(x - 3, top, 6, y - top);
        c.fillStyle = INK; c.fillRect(x - 5, top - 3, 10, 5);
        // a ladder of rungs for the cartoon engineering
        c.fillStyle = css(mixA(post, rgb(INK), 0.3));
        for (let r = top + 20; r < y - 6; r += 12) c.fillRect(x + 3, r, 5, 1.6);
        // the arm: horizontal is stop, raised is go
        const an = -this.sig * 0.75;
        c.save(); c.translate(x, top + 10); c.rotate(an);
        c.fillStyle = INK; c.fillRect(-2, -5, 42, 10);
        c.fillStyle = '#C8412C'; c.fillRect(0, -4, 40, 8);
        c.fillStyle = CREAM; c.fillRect(30, -4, 4, 8);
        // spectacle glass on the other side of the pivot
        c.fillStyle = INK; c.beginPath(); c.arc(-9, 0, 6.5, 0, TAU); c.fill();
        c.fillStyle = this.sig > 0.5 ? '#6FC08A' : '#E8584A';
        c.beginPath(); c.arc(-9, 0, 4, 0, TAU); c.fill();
        c.restore();
      }
    },

    drawGround(c, W, H, P, landCol) {
      const carX = this.carX, step = 8;
      const tint = P.dusk * 0.32;
      const fill = (off, col) => {
        c.beginPath(); c.moveTo(-20, H + 40);
        for (let x = -20; x <= W + 24; x += step) c.lineTo(x, this.yAt(x - carX) + off);
        c.lineTo(W + 24, H + 40); c.closePath();
        c.fillStyle = css(mixA(col, DUSKTINT, tint)); c.fill();
      };
      fill(8, landCol.ground);
      fill(62, landCol.groundDark);
      fill(150, landCol.groundDeep);
      // ballast bank
      c.beginPath();
      for (let x = -20; x <= W + 24; x += step) c.lineTo(x, this.yAt(x - carX) + 1);
      for (let x = W + 24; x >= -20; x -= step) c.lineTo(x, this.yAt(x - carX) + 15);
      c.closePath(); c.fillStyle = css(mixA(rgb('#8C7A66'), DUSKTINT, tint)); c.fill();
      // sleepers
      c.fillStyle = css(mixA(rgb('#5A3E2E'), DUSKTINT, tint));
      const ss = 20;
      for (let i = Math.floor((this.S - carX - 20) / ss); i <= Math.ceil((this.S + W - carX + 20) / ss); i++) {
        const x = i * ss - this.S + carX;
        const y = this.yAt(x - carX);
        c.fillRect(x - 5, y, 10, 6);
      }
      // the rail
      c.beginPath();
      for (let x = -20; x <= W + 24; x += 6) c.lineTo(x, this.yAt(x - carX) - 1.5);
      c.lineWidth = 4.5; c.strokeStyle = css(mixA(rgb('#3A3432'), DUSKTINT, tint * 0.5)); c.lineJoin = 'round'; c.stroke();
      c.beginPath();
      for (let x = -20; x <= W + 24; x += 6) c.lineTo(x, this.yAt(x - carX) - 3.2);
      c.lineWidth = 1.2; c.strokeStyle = css(mixA(rgb('#C9C0B2'), rgb('#F2A870'), smooth(0.5, 1, P.dusk)), 0.8); c.stroke();

      // tufts and flowers on the embankment
      const ts = 34;
      for (let i = Math.floor((this.S - carX - 20) / ts); i <= Math.ceil((this.S + W - carX + 20) / ts); i++) {
        const x = i * ts + hash(i * 1.3) * 20 - this.S + carX;
        const land = LANDS[this.landAt(this.worldBorders, i * ts)];
        const y = this.yAt(x - carX) + 24 + hash(i * 7.1) * 120;
        c.strokeStyle = css(mixA(rgb(land.groundDeep), DUSKTINT, tint)); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x - 4, y - 7); c.lineTo(x, y); c.lineTo(x + 1, y - 9); c.moveTo(x, y); c.lineTo(x + 5, y - 6); c.stroke();
        if (hash(i * 2.2) > 0.6) {
          c.fillStyle = css(mixA(rgb(land.flower), DUSKTINT, tint * 0.6));
          c.beginPath(); c.arc(x + 1, y - 10, 2.4, 0, TAU); c.fill();
        }
      }
    },

    // the near shore: the line runs on a causeway with the lake at its foot
    drawFrontWater(c, W, H, P, y0) {
      const d = P.dusk;
      const water = mixA(rgb('#4E97B4'), rgb('#6B5A8C'), smooth(0.3, 1, d));
      const deep = mixA(water, rgb('#2F3566'), 0.35);
      const light = mixA(rgb('#8CC3CE'), rgb('#E48A72'), smooth(0.3, 1, d));
      // stone facing of the causeway, down into the water
      c.fillStyle = css(mixA(rgb('#8C7A66'), DUSKTINT, d * 0.4));
      c.fillRect(0, y0 - 12, W, 14);
      c.fillStyle = css(mixA(rgb('#6E5E4E'), DUSKTINT, d * 0.4));
      const ss = 26;
      for (let i = Math.floor((this.S - this.carX - 30) / ss); i <= Math.ceil((this.S + W - this.carX + 30) / ss); i++) {
        const x = i * ss - this.S + this.carX;
        c.fillRect(x, y0 - 12, 1.6, 12);
      }
      c.fillRect(0, y0 - 6, W, 1.4);
      c.fillStyle = css(water); c.fillRect(0, y0, W, H - y0 + 20);
      c.fillStyle = css(deep); c.fillRect(0, y0 + (H - y0) * 0.55, W, H);
      // the sky's colour lying on the water in long bands
      c.fillStyle = css(light, 0.5);
      for (let k = 0; k < 6; k++) {
        const y = y0 + 8 + k * k * 5 + k * 8;
        if (y > H) break;
        const span = W + 300, w = 80 + 120 * hash(k + 31);
        const x = ((hash(k + 41) * span - this.S * 0.8) % span + span) % span - 150;
        c.fillRect(x, y, w, 2.2);
      }
      // the sun's road reaches right across to the near shore
      const sp = this.sun;
      c.fillStyle = css(sp.col, 0.6 * smooth(0.4, 0.9, d));
      for (let k = 0; k < 12; k++) {
        const y = y0 + 8 + k * 14;
        if (y > H) break;
        const w = sp.r * (1.6 + k * 0.25) * (0.6 + 0.4 * Math.sin(this.lakeT * 1.7 + k * 2.3));
        c.fillRect(sp.x - w / 2 + 6 * Math.sin(k * 1.9), y, w, 3);
      }
      // hats glint on the water
      c.fillStyle = css(mixA(rgb('#FFF3D6'), this.sun.col, 0.4));
      for (let k = 0; k < 14; k++) {
        const tw = this.twinkle[k + 20];
        if (tw < 0.7) continue;
        const x = hash(k * 3.7 + 1) * W, y = y0 + 10 + hash(k * 5.1 + 2) * (H - y0 - 10);
        const r = 5 * (tw - 0.55);
        c.fillRect(x - r, y - 0.8, r * 2, 1.6);
      }
    },

    // cows on the embankment below the line; the snare swings their heads up
    drawCows(c, W, P) {
      const sp = 380, carX = this.carX;
      const i0 = Math.floor((this.S - carX - 80) / sp), i1 = Math.ceil((this.S + W - carX + 80) / sp);
      for (let i = i0; i <= i1; i++) {
        if (hash(i * 6.1 + 2) < 0.45) continue;
        const land = LANDS[this.landAt(this.worldBorders, i * sp)];
        if (!land.cows) continue;
        const x = i * sp + 120 - this.S + carX;
        const y = this.yAt(x - carX) + 58 + hash(i * 3.3) * 40;
        const face = hash(i * 8.8) < 0.5 ? 1 : -1;
        this.cowDraw(c, x, y, face, this.cow, P, i);
      }
    },
    cowDraw(c, x, y, face, up, P, i) {
      const tint = P.dusk * 0.3;
      const body = css(mixA(rgb('#F4EEDF'), DUSKTINT, tint));
      const spot = css(mixA(rgb(i % 3 ? '#2A211C' : '#8A4B2E'), DUSKTINT, tint * 0.5));
      c.save(); c.translate(x, y); c.scale(face, 1);
      c.strokeStyle = INK; c.lineWidth = 1.6; c.fillStyle = spot;
      for (const lx of [-16, -9, 10, 16]) c.fillRect(lx - 2, -6, 4, 12);
      c.fillStyle = body;
      c.beginPath(); c.ellipse(0, -14, 24, 12, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = spot;
      c.beginPath(); c.ellipse(-8, -17, 7, 5, 0.3, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(9, -11, 5, 4, -0.2, 0, TAU); c.fill();
      // tail
      c.beginPath(); c.moveTo(-23, -18); c.quadraticCurveTo(-30, -10, -27, -2); c.stroke();
      // head: down in the grass, or up and looking at the handcar
      const hx = lerp(26, 27, up), hy = lerp(-2, -26, up);
      c.fillStyle = body;
      c.beginPath(); c.moveTo(18, -18); c.lineTo(hx - 4, hy - 4); c.lineTo(hx - 2, hy + 6); c.lineTo(18, -8); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(hx, hy, 8, 9, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#E8A48E';
      c.beginPath(); c.ellipse(hx + 1 * up + 2 * (1 - up), hy + 6, 6.5, 4.2, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = INK;
      c.beginPath(); c.arc(hx - 3, hy - 2, 1.5, 0, TAU); c.arc(hx + 3, hy - 2, 1.5, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(hx - 7, hy - 7); c.lineTo(hx - 12, hy - 11); c.moveTo(hx + 7, hy - 7); c.lineTo(hx + 12, hy - 11); c.stroke();
      c.restore();
    },

    // ---------------------------------------------------------------- the crew

    drawMan(c, dir, footX, hand, spec, t, P, k) {
      const deck = -34;
      const handleH = deck - hand[1];
      const hip0 = spec.legU + spec.legL - 4;
      const reach = hip0 + spec.torso * 0.72;
      const push = clamp((reach - handleH) / 36, -0.8, 1.2);
      const hipH = hip0 - Math.max(0, push) * 11 + 1.2 * Math.sin(t * 1.9 + k);
      // they keep themselves near upright against the car's tilt, leaning back
      // into a plunge and forward up a climb
      const phi = 0.1 + Math.max(0, push) * 0.55 - Math.max(0, -push) * 0.12 - P.rush * 0.1 - dir * this.carAng * 0.55;
      const hip = [footX - dir * 3, deck - hipH];
      const sh = [hip[0] + dir * Math.sin(phi) * spec.torso, hip[1] - Math.cos(phi) * spec.torso];
      const f1 = [footX - dir * 9, deck], f2 = [footX + dir * 7, deck];
      const knee = (j) => dir * j[0];
      const L1 = ik(hip[0], hip[1], f1[0], f1[1], spec.legU, spec.legL, knee);
      const L2 = ik(hip[0], hip[1], f2[0], f2[1], spec.legU, spec.legL, knee);
      const elbow = (j) => j[1] - dir * j[0] * 0.4;
      const A1 = ik(sh[0], sh[1], hand[0], hand[1], spec.arm, spec.arm, elbow);
      const A2 = ik(sh[0] - dir * 2, sh[1] + 1, hand[0] - dir * 1, hand[1] + 1, spec.arm, spec.arm, elbow);

      c.lineCap = 'round'; c.lineJoin = 'round';
      const limb = (a, j, e, w, col) => {
        c.strokeStyle = INK; c.lineWidth = w + 3.2;
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(j[0], j[1]); c.lineTo(e[0], e[1]); c.stroke();
        c.strokeStyle = col; c.lineWidth = w;
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(j[0], j[1]); c.lineTo(e[0], e[1]); c.stroke();
      };
      const pantsFar = css(mixA(rgb(spec.pants), rgb(INK), 0.25));
      const shirtFar = css(mixA(rgb(spec.sleeve), rgb(INK), 0.25));
      // far limbs
      limb(sh, A2[0], A2[1], 6.5, shirtFar);
      limb(hip, L1[0], L1[1], 8, pantsFar);
      // boots
      c.fillStyle = INK;
      for (const f of [f1, f2]) { c.beginPath(); c.ellipse(f[0] + dir * 4, f[1] - 3, 8, 4, 0, 0, TAU); c.fill(); }
      // near leg
      limb(hip, L2[0], L2[1], 8.5, spec.pants);
      // torso
      c.save(); c.translate(hip[0], hip[1]); c.rotate(dir * phi);
      c.fillStyle = spec.shirt; c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath();
      if (spec.belly) c.ellipse(dir * 3, -spec.torso * 0.48, 15, spec.torso * 0.62, 0, 0, TAU);
      else { c.moveTo(-9, 2); c.lineTo(9, 2); c.lineTo(10, -spec.torso - 1); c.lineTo(-10, -spec.torso - 1); c.closePath(); }
      c.fill(); c.stroke();
      if (spec.stripes) {
        c.save(); c.clip();
        c.fillStyle = '#C4472F';
        for (let yy = -spec.torso - 4; yy < 4; yy += 7) c.fillRect(-20, yy, 40, 3);
        c.restore();
        c.beginPath(); c.ellipse(dir * 3, -spec.torso * 0.48, 15, spec.torso * 0.62, 0, 0, TAU); c.stroke();
      }
      if (spec.braces) {
        c.strokeStyle = '#C4472F'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(-dir * 3, 0); c.lineTo(-dir * 4, -spec.torso); c.moveTo(dir * 5, 0); c.lineTo(dir * 5, -spec.torso); c.stroke();
      }
      // belt
      c.fillStyle = INK; c.fillRect(-11, -3, 22, 4);
      c.restore();

      // head
      const nk = [sh[0] + dir * Math.sin(phi) * 4, sh[1] - Math.cos(phi) * 4];
      const hr = spec.headR;
      const hc = [nk[0] + dir * 3, nk[1] - hr + 2];
      // neckerchief tails flutter back in the wind of the run
      if (spec.scarf) {
        const wind = clamp(this.v / 300, 0.1, 1.3);
        c.fillStyle = '#C4472F'; c.strokeStyle = INK; c.lineWidth = 1.5;
        const fl = Math.sin(t * (8 + 14 * wind) + k) * 4 * wind;
        c.beginPath(); c.moveTo(nk[0] - 5, nk[1] - 2); c.lineTo(nk[0] - 12 - 22 * wind, nk[1] - 2 + fl);
        c.lineTo(nk[0] - 10 - 16 * wind, nk[1] + 6 - fl * 0.5); c.lineTo(nk[0] + 4, nk[1] + 3); c.closePath(); c.fill(); c.stroke();
      }
      c.fillStyle = spec.skin; c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath(); c.arc(hc[0], hc[1], hr, 0, TAU); c.fill(); c.stroke();
      // ear
      c.beginPath(); c.arc(hc[0] - dir * hr * 0.35, hc[1] + 1, 3.6, 0, TAU); c.fill(); c.stroke();
      // cheek
      c.fillStyle = 'rgba(214,94,74,0.45)';
      c.beginPath(); c.arc(hc[0] + dir * hr * 0.35, hc[1] + 4, 4, 0, TAU); c.fill();
      // eye (blinks now and then)
      c.fillStyle = INK;
      const ex = hc[0] + dir * hr * 0.42, ey = hc[1] - 3;
      const whoop = smooth(0.35, 0.8, P.rush);
      if (this.blink > 0 && k === 0) c.fillRect(ex - 2.5, ey, 5, 1.6);
      else { c.beginPath(); c.ellipse(ex, ey, 1.9, 2.4 + whoop * 1.2, 0, 0, TAU); c.fill(); }
      // mouth: a small smile, or an O of delight on the plunge
      const mx = hc[0] + dir * hr * 0.55, my = hc[1] + 7;
      if (whoop > 0.05) {
        c.fillStyle = '#7A2A22'; c.strokeStyle = INK; c.lineWidth = 1.4;
        c.beginPath(); c.ellipse(mx, my + 1, 2.5 + whoop * 1.8, 2 + whoop * 3.4, 0, 0, TAU); c.fill(); c.stroke();
      } else {
        c.strokeStyle = INK; c.lineWidth = 1.5;
        c.beginPath(); c.arc(mx - dir * 1, my - 2, 4, 0.3, Math.PI - 0.3); c.stroke();
      }
      if (spec.moustache) {
        c.fillStyle = '#B5552C';
        c.beginPath(); c.ellipse(hc[0] + dir * (hr * 0.72), hc[1] + 5, 8, 3.2, dir * 0.15, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(hc[0] + dir * (hr * 0.72 - 6), hc[1] + 5.5, 5, 2.4, -dir * 0.5, 0, TAU); c.fill();
      }
      // the nose, big and rosy
      c.fillStyle = spec.nose; c.strokeStyle = INK; c.lineWidth = 1.8;
      c.beginPath(); c.ellipse(hc[0] + dir * (hr + 1), hc[1] + 1, spec.noseR * 1.1, spec.noseR, 0, 0, TAU); c.fill(); c.stroke();
      // pipe (Bert) when coasting
      if (spec.pipe && this.pipeA > 0.02) {
        const a0 = c.globalAlpha;
        c.globalAlpha = a0 * this.pipeA;
        c.strokeStyle = INK; c.lineWidth = 2.4;
        const px = mx + dir * 2, py = my + 1;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + dir * 9, py + 3); c.stroke();
        c.fillStyle = '#6B3A22'; c.fillRect(px + dir * 9 - 3, py - 3, 6, 8);
        this.pipeTip = [px + dir * 9, py - 4, dir];
        c.globalAlpha = a0;
      }
      // hat, lifting off the head on the plunge
      const lift = whoop * (7 + 4 * Math.sin(t * 17 + k * 2));
      c.save(); c.translate(hc[0], hc[1] - hr * 0.55 - lift); c.rotate(-dir * (0.1 + whoop * 0.25));
      c.fillStyle = spec.hatCol; c.strokeStyle = INK; c.lineWidth = 1.8;
      if (spec.hat === 'bowler') {
        c.beginPath(); c.ellipse(0, 0, hr + 5, 3, 0, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.arc(0, -1, hr * 0.78, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#C4472F'; c.fillRect(-hr * 0.78, -4, hr * 1.56, 3);
      } else {
        c.beginPath(); c.moveTo(-hr - 1, 2); c.quadraticCurveTo(-hr, -hr * 0.8, dir * 4, -hr * 0.72);
        c.quadraticCurveTo(hr + 2, -hr * 0.5, hr + 1, 2); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(dir * (hr - 2), 1); c.lineTo(dir * (hr + 10), 4); c.lineTo(dir * (hr - 3), 5); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(42,33,28,0.25)'; c.beginPath(); c.arc(0, -hr * 0.45, 1.6, 0, TAU); c.fill();
      }
      c.restore();
      if (lift > 3) {
        // little lift lines under the floating hat
        c.strokeStyle = INK; c.lineWidth = 1.3;
        for (const o of [-6, 0, 6]) { c.beginPath(); c.moveTo(hc[0] + o, hc[1] - hr - 1); c.lineTo(hc[0] + o, hc[1] - hr - lift + 5); c.stroke(); }
      }
      // near arm last, gripping the handle
      limb(sh, A1[0], A1[1], 7, spec.sleeve);
      c.fillStyle = spec.skin; c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.arc(A1[1][0], A1[1][1], 4.4, 0, TAU); c.fill(); c.stroke();
    },

    drawCar(c, t, P) {
      const th = this.lev;
      const pivot = [0, -100], Lh = 54;
      const hL = [pivot[0] - Lh * Math.cos(th), pivot[1] + Lh * Math.sin(th)];
      const hR = [pivot[0] + Lh * Math.cos(th), pivot[1] - Lh * Math.sin(th)];
      c.lineCap = 'round'; c.lineJoin = 'round';

      // pennant at the back, snapping in the wind of the run
      const wind = clamp(this.v / 280, 0.08, 1.4);
      c.strokeStyle = INK; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-84, -34); c.lineTo(-84, -108); c.stroke();
      c.fillStyle = '#E3A93B'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-84, -107);
      const fl = this.flag;
      for (let k = 1; k <= 4; k++) c.lineTo(-84 - k * 9 * (0.5 + 0.5 * wind), -107 + k * 1.2 + Math.sin(fl - k * 1.1) * k * 1.4 * (0.4 + wind));
      for (let k = 4; k >= 1; k--) c.lineTo(-84 - k * 9 * (0.5 + 0.5 * wind) * 0.92, -95 - k * 1.3 + Math.sin(fl - k * 1.1) * k * 1.4 * (0.4 + wind));
      c.lineTo(-84, -93); c.closePath(); c.fill(); c.stroke();

      // wheels
      for (const wx of [-46, 46]) {
        c.fillStyle = INK; c.beginPath(); c.arc(wx, -15, 16, 0, TAU); c.fill();
        c.fillStyle = '#C4472F'; c.beginPath(); c.arc(wx, -15, 12, 0, TAU); c.fill();
        c.strokeStyle = INK; c.lineWidth = 2.4;
        for (let s = 0; s < 3; s++) {
          const a = this.wheel + s * Math.PI / 3;
          c.beginPath(); c.moveTo(wx - Math.cos(a) * 11, -15 - Math.sin(a) * 11); c.lineTo(wx + Math.cos(a) * 11, -15 + Math.sin(a) * 11); c.stroke();
        }
        c.fillStyle = '#E3A93B'; c.beginPath(); c.arc(wx, -15, 3.5, 0, TAU); c.fill();
      }
      // frame and deck
      c.fillStyle = INK; c.fillRect(-70, -26, 140, 9);
      c.fillStyle = '#C4472F'; c.strokeStyle = INK; c.lineWidth = 2.2;
      c.beginPath(); c.rect(-88, -38, 176, 12); c.fill(); c.stroke();
      c.fillStyle = '#E3A93B'; c.fillRect(-86, -34, 172, 3);
      c.fillStyle = INK;
      for (const bx of [-78, -40, 40, 78]) { c.beginPath(); c.arc(bx, -29, 1.6, 0, TAU); c.fill(); }
      // lantern at the front, lit at dusk
      const lampOn = smooth(0.55, 0.9, P.dusk);
      c.fillStyle = INK; c.fillRect(84, -54, 12, 16);
      c.fillStyle = lampOn > 0.1 ? css(mixA(rgb('#8A7A5A'), rgb('#FFE08A'), lampOn)) : '#8A7A5A';
      c.fillRect(86, -51, 8, 10);
      if (lampOn > 0.02) {
        c.fillStyle = 'rgba(255,224,138,' + (0.16 * lampOn).toFixed(3) + ')';
        c.beginPath(); c.moveTo(94, -50); c.lineTo(260, -80); c.lineTo(260, 6); c.lineTo(94, -42); c.closePath(); c.fill();
      }
      // the A-frame
      c.strokeStyle = INK; c.lineWidth = 7;
      c.beginPath(); c.moveTo(-18, -37); c.lineTo(0, -100); c.lineTo(18, -37); c.stroke();
      c.strokeStyle = '#8C5A36'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-18, -37); c.lineTo(0, -100); c.lineTo(18, -37); c.stroke();

      // the crew: back arms first, so we draw the men then the lever over them
      const spec = this.specs;
      this.drawMan(c, 1, -66, hL, spec[0], t, P, 0);
      this.drawMan(c, -1, 64, hR, spec[1], t, P, 1);

      // the lever beam over their hands
      c.strokeStyle = INK; c.lineWidth = 8;
      c.beginPath(); c.moveTo(hL[0], hL[1]); c.lineTo(hR[0], hR[1]); c.stroke();
      c.strokeStyle = '#E3A93B'; c.lineWidth = 4.5;
      c.beginPath(); c.moveTo(hL[0], hL[1]); c.lineTo(hR[0], hR[1]); c.stroke();
      c.fillStyle = INK;
      for (const h of [hL, hR]) { c.beginPath(); c.arc(h[0], h[1], 4.6, 0, TAU); c.fill(); }
      c.fillStyle = '#E3A93B'; c.beginPath(); c.arc(0, -100, 5, 0, TAU); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      // hands over the grips
      c.fillStyle = spec[0].skin; c.lineWidth = 1.6;
      for (const [h, sp] of [[hL, spec[0]], [hR, spec[1]]]) {
        c.fillStyle = sp.skin; c.beginPath(); c.arc(h[0], h[1] - 1, 4.2, 0, TAU); c.fill(); c.stroke();
      }

      // sparks off the wheels on the plunge
      for (const s of this.sparks) {
        const u = s.age / s.life;
        c.strokeStyle = u < 0.5 ? '#FFF1C2' : '#F2B84A'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.014, s.y - s.vy * 0.014); c.stroke();
      }
    },

    // ---------------------------------------------------------------- frame

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      const react = params.reaction;

      // Effective look: the params, pulled by Follow toward the climb in the
      // build, the calm lakeside in the breakdown and the plunge in the drop.
      const P = {};
      for (const k of DRIVE) {
        let v = params[k];
        if (follow) {
          v = lerp(v, PRESETS.climb[k], e.bld * (1 - e.auto));
          v = lerp(v, PRESETS.calm[k], e.rest * (1 - e.auto));
          v = lerp(v, PRESETS.drop[k], e.auto);
        }
        P[k] = v;
      }
      this.listen(signals, t, dt, P, react);

      if (!this.specs) {
        this.specs = [
          { legU: 25, legL: 25, torso: 38, arm: 23, headR: 13, noseR: 6, hat: 'bowler', hatCol: '#2A211C',
            shirt: '#3E6FA8', sleeve: '#F1E4C6', pants: '#2F4E7A', skin: '#F2C6A0', nose: '#EE9C82',
            moustache: true, braces: true },
          { legU: 20, legL: 20, torso: 33, arm: 22, headR: 14.5, noseR: 7.5, hat: 'cap', hatCol: '#D69B33',
            shirt: '#F4EAD2', sleeve: '#F4EAD2', pants: '#6B4A33', skin: '#F0C09A', nose: '#E98F78',
            belly: true, stripes: true, scarf: true, pipe: true },
        ];
      }

      // speed: the bass sets it, each stroke of the lever shoves it
      this.surge *= Math.exp(-2.2 * dt);
      this.v = (40 + 150 * P.speed) * (0.8 + 0.45 * e.bass * clamp(react, 0, 1.5)) + 60 * this.surge * (0.4 + P.speed);
      this.advance(dt, P);
      this.layAhead(P, W);
      this.wheel += this.v * dt / 16;
      this.flag += dt * (5 + this.v * 0.06);
      this.farX += this.v * dt * 0.05;
      this.midX += this.v * dt * 0.24;
      this.cloudX += dt * 6 + this.v * dt * 0.02;
      this.lakeT = t;

      // the lever: a sprung seesaw with weight, settling level when idle
      if (t - e.lastKick > 1.3) this.levT = ease(this.levT, 0, 1.2, dt);
      const kL = 170, zL = 0.3;
      this.levV += (kL * (this.levT - this.lev) - 2 * Math.sqrt(kL) * zL * this.levV) * dt;
      this.lev += this.levV * dt;
      this.lev = clamp(this.lev, -0.62, 0.62);
      const kS = 140, zS = 0.28;
      this.sigV += (kS * (this.sigT - this.sig) - 2 * Math.sqrt(kS) * zS * this.sigV) * dt; this.sig += this.sigV * dt;
      this.cowV += (90 * (this.cowT - this.cow) - 2 * Math.sqrt(90) * 0.4 * this.cowV) * dt; this.cow += this.cowV * dt;
      for (let i = 0; i < this.twinkle.length; i++) this.twinkle[i] = ease(this.twinkle[i], 0.55, 2.5, dt);
      this.blink -= dt;
      if (t > this.nextBlink) { this.blink = 0.12; this.nextBlink = t + 2 + this.rng() * 3; }
      const idle = smooth(1.2, 2.5, t - e.lastKick) * (1 - smooth(0.4, 0.8, P.rush));
      this.pipeA = ease(this.pipeA || 0, idle, 1.5, dt);

      // a new country every drop (Follow), or the chosen one
      const want = ((Math.round(params.land) + (follow ? e.drops : 0)) % LANDS.length + LANDS.length) % LANDS.length;
      if (want !== this.landShown) {
        this.midBorders.push({ x: this.midX + W + 80, land: want });
        this.worldBorders.push({ x: this.S + W, land: want });
        if (this.midBorders.length > 8) { this.midBorders.shift(); this.worldBorders.shift(); }
        this.landFrom = this.landShown; this.landShown = want; this.landMix = 0;
      }
      this.landMix = Math.min(1, this.landMix + dt / 3);
      const Lf = LANDS[this.landFrom], Lt = LANDS[this.landShown], lm = smooth(0, 1, this.landMix);
      const landCol = {
        far: mixA(Lf.farC, Lt.farC, lm), mid: mixA(Lf.midC, Lt.midC, lm), midDark: mixA(Lf.midDarkC, Lt.midDarkC, lm),
        ground: mixA(Lf.groundC, Lt.groundC, lm), groundDark: mixA(Lf.groundDarkC, Lt.groundDarkC, lm), groundDeep: mixA(Lf.groundDeepC, Lt.groundDeepC, lm),
      };
      const farLand = lm > 0.5 ? Lt : Lf;

      // camera: the car sits lower on a climb (to see up the hill) and
      // higher on a plunge (to see down into the valley)
      this.carX = W * (W / H > 1.2 ? 0.36 : 0.42);
      this.gCam = ease(this.gCam, P.grade, 2, dt);
      const csy = H * (0.66 + 0.07 * this.gCam);
      this.carSY = this.carSY === null ? csy : csy;
      const alt = 70 * Math.tanh((this.hC - this.hRef) / 220);

      const c = p.drawingContext;
      c.save();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.lineCap = 'butt'; c.lineJoin = 'miter';

      const horizon = H * 0.5 + alt * 0.6 + P.lake * 18;
      this.sun = this.sunPos(W, H, P, horizon);
      this.drawSky(c, W, H, P, horizon, t);
      // sun
      c.fillStyle = css(this.sun.col);
      c.beginPath(); c.arc(this.sun.x, this.sun.y, this.sun.r, 0, TAU); c.fill();
      c.fillStyle = css(mixA(this.sun.col, rgb('#FFFFFF'), 0.35));
      c.beginPath(); c.arc(this.sun.x - this.sun.r * 0.25, this.sun.y - this.sun.r * 0.25, this.sun.r * 0.45, 0, TAU); c.fill();
      this.drawClouds(c, W, H, P);

      const farBase = horizon + 4 + alt * 0.3;
      this.drawFar(c, W, H, P, farBase, Object.assign({}, farLand, { farC: landCol.far }), false);
      if (P.lake > 0.01) this.drawLake(c, W, H, P, farBase, farBase, landCol);
      const midBase = H * 0.6 + alt + P.lake * 260;
      if (P.lake < 0.99) this.drawMid(c, W, H, P, midBase, landCol);

      // speed streaks across the middle distance on the plunge
      const rush = P.rush * clamp(this.v / 250, 0, 1.4);
      if (rush > 0.02) {
        if (!this.streaksArr) {
          const r = mulberry(19); this.streaksArr = [];
          for (let i = 0; i < 26; i++) this.streaksArr.push({ x: r(), y: 0.12 + r() * 0.5, l: 60 + r() * 220, sp: 1 + r() * 1.5 });
        }
        c.fillStyle = css(mixA(rgb(CREAM), DUSKTINT, P.dusk * 0.3), 0.55 * clamp(rush, 0, 1));
        const span = W + 500;
        for (const s of this.streaksArr) {
          const x = ((s.x * span - this.S * 0.6 * s.sp) % span + span) % span - 250;
          c.fillRect(x, s.y * H + alt * 0.5, s.l * clamp(rush, 0.2, 1.2), 2.2);
        }
      }

      this.drawPoles(c, W, P);
      this.drawSignals(c, W, P);
      this.drawGround(c, W, H, P, landCol);
      this.drawCows(c, W, P);
      const waterY = this.carSY + 24 + (1 - smooth(0, 1, P.lake)) * H * 0.55;
      if (P.lake > 0.01 && waterY < H) this.drawFrontWater(c, W, H, P, waterY);

      // rail glints on the hats
      c.fillStyle = css(mixA(rgb('#FFF6DA'), rgb('#FFD8A0'), P.dusk));
      this.glints = this.glints.filter((g) => (g.age += dt) < g.life);
      for (const g of this.glints) {
        const x = g.s - this.S + this.carX;
        if (x < -10 || x > W + 10) continue;
        const y = this.yAt(x - this.carX) - 3;
        const u = g.age / g.life, r = 7 * Math.sin(Math.PI * u);
        c.fillRect(x - r, y - 0.9, r * 2, 1.8); c.fillRect(x - 0.9, y - r * 0.8, 1.8, r * 1.6);
      }

      // the handcar, riding the rail at its slope
      const yb = this.yAt(-46 * CS), yf = this.yAt(46 * CS);
      const ang = Math.atan2(yf - yb, 92 * CS);
      this.carAng = ang;
      // sparks and pipe smoke live in the car's frame
      if (rush > 0.3) {
        const n = rush * 26 * dt * 6;
        for (let i = 0; i < n; i++) {
          const wx = this.rng() < 0.5 ? -46 : 46;
          this.sparks.push({ x: wx - 8, y: -2, vx: -(120 + 180 * this.rng()), vy: -(40 + 90 * this.rng()), age: 0, life: 0.25 + 0.25 * this.rng() });
        }
      }
      this.sparks = this.sparks.filter((s) => (s.age += dt) < s.life);
      for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; }

      c.save();
      c.translate(this.carX, (yb + yf) / 2); c.rotate(ang); c.scale(CS, CS);
      // speed lines trailing behind the car
      if (rush > 0.02) {
        c.strokeStyle = css(rgb(INK), 0.55 * clamp(rush, 0, 1)); c.lineWidth = 2; c.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const y = -48 - k * 22, len = (40 + 30 * Math.sin(t * 11 + k * 2)) * clamp(rush, 0, 1.2);
          c.beginPath(); c.moveTo(-100 - k * 8, y); c.lineTo(-100 - k * 8 - len, y); c.stroke();
        }
      }
      this.pipeTip = null;
      this.drawCar(c, t, P);
      // pipe smoke puffs drift up and back
      if (this.pipeTip && t > this.nextPuff) {
        this.puffs.push({ x: this.pipeTip[0], y: this.pipeTip[1], age: 0 });
        this.nextPuff = t + 0.9 + this.rng() * 0.6;
      }
      this.puffs = this.puffs.filter((q) => (q.age += dt) < 2.4);
      for (const q of this.puffs) {
        q.x -= (8 + this.v * 0.25) * dt; q.y -= 14 * dt;
        const r = 3 + q.age * 5;
        c.strokeStyle = css(mixA(rgb(CREAM), DUSKTINT, 0.15), 0.8 * (1 - q.age / 2.4)); c.lineWidth = 2;
        c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.stroke();
      }
      c.restore();

      // the car upside down in the still water of the lake
      if (P.lake > 0.01 && waterY < H) {
        c.save();
        c.beginPath(); c.rect(0, waterY, W, H - waterY); c.clip();
        c.globalAlpha = 0.32 * smooth(0, 0.6, P.lake);
        c.translate(0, 2 * waterY); c.scale(1, -1);
        c.translate(this.carX, (yb + yf) / 2); c.rotate(ang); c.scale(CS, CS);
        this.drawCar(c, t, P);
        c.restore();
        c.globalAlpha = 1;
        // ripples breaking the reflection
        const water = mixA(rgb('#4E97B4'), rgb('#6B5A8C'), smooth(0.3, 1, P.dusk));
        c.fillStyle = css(water, 0.7);
        for (let k = 0; k < 9; k++) {
          const y = waterY + 14 + k * 13;
          if (y > H) break;
          const span = W + 200, w = 30 + 60 * hash(k + 5);
          const x = ((hash(k + 91) * span - this.S * 0.9) % span + span) % span - 100;
          c.fillRect(x, y, w, 2.5); c.fillRect(x + w + 40, y + 4, w * 0.6, 2.5);
        }
      }

      // chapter card, like a title in a cartoon short
      let chap = 'the branch line';
      if (P.grade > 0.25) chap = 'the long climb';
      else if (P.grade < -0.3) chap = 'over the top!';
      else if (P.lake > 0.5) chap = 'the lake at dusk';
      else if (P.speed > 1) chap = 'full steam';
      if (chap !== this.chapter) {
        if (this.chapterA <= 0.02) { this.chapter = chap; }
        this.chapterA = ease(this.chapterA, 0, 6, dt);
        if (this.chapter === chap) this.chapterA = 0.03;
      } else this.chapterA = ease(this.chapterA, 1, 2, dt);
      if (this.chapterA > 0.02) {
        c.globalAlpha = clamp(this.chapterA, 0, 1);
        c.font = 'italic 600 17px Georgia, "Times New Roman", serif';
        c.textAlign = 'left'; c.textBaseline = 'middle';
        const tw = c.measureText(this.chapter).width;
        const bx = 22, by = H - 44;
        c.fillStyle = CREAM; c.strokeStyle = INK; c.lineWidth = 2;
        c.beginPath(); c.rect(bx, by, tw + 30, 28); c.fill(); c.stroke();
        c.fillStyle = '#C4472F'; c.fillRect(bx + 6, by + 12, 5, 5);
        c.fillStyle = INK; c.fillText(this.chapter, bx + 17, by + 15);
        c.globalAlpha = 1;
      }

      // paper grain over everything
      const pd = p.pixelDensity ? p.pixelDensity() : 1;
      const pxs = Math.min(2, p.width * pd / W);
      if (!this.grain || Math.abs(pxs - this.pxs) > 1e-3) { this.grain = this.makeGrain(); this.pxs = pxs; }
      const pat = c.createPattern(this.grain, 'repeat');
      if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / pxs));
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = pat || '#fff'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
      c.restore();
    },
  });
})();
