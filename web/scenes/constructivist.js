// Constructivist: a Rodchenko/Lissitzky-style lithograph poster for a night of
// dancing, printed in red and black on cream stock. One diagonal carries the
// whole sheet: a red loudspeaker horn in the lower left throws a black beam of
// sound across the poster, and the headline streams out of it in cream
// knockout letters. Above the beam a constructed stack of bars assembles; a
// split red-and-black disc turns like a record behind it; a halftone photo
// fragment of a speaker cone sits in the corner; a huge red vertical word runs
// up the right edge; geometric dancers after Stepanova take the floor in the
// drop.
//
// Music, each in its own place:
//   kick   one bar flies in along its own axis and locks into the construction
//          (the oldest one leaves forward, slowly): the "forms lock on beats"
//   snare  the horn shouts: a red word leaves the mouth and grows along the beam
//   hats   thin cream sound-rings run down the black beam from the horn
//   bass   the record's speed, the halftone cone's ripple, the beam's scroll
//   drop   a red counter-band slides in across the beam, the dancers come on,
//          the construction grows to its full size with heavier bars; the
//          breakdown takes them away one by one and leaves the horn talking
// Printed look: every ink multiplies onto the paper (red over black stays
// black, as overprinted litho ink does), the red plate is a hair out of
// register, and paper shows through the ink as worn specks. No glow.

(function () {
  const STOCKS = [
    { name: 'Cream stock', paper: '#E8DDC4', fleck: [120, 96, 60] },
    { name: 'Newsprint', paper: '#D9D4C6', fleck: [90, 88, 80] },
    { name: 'Kraft', paper: '#D2B48A', fleck: [110, 80, 45] },
  ];
  const INKS = [
    { name: 'Signal red', red: '#D5261C' },
    { name: 'Vermilion', red: '#E24A1A' },
    { name: 'Carmine', red: '#B8142A' },
  ];
  const BLACK = '#1A1714';
  const TILTS = [0, -8, 5, -4];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeIn = (u) => u * u * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  // A hard landing with a small bounce back: the bar hits its stop and settles.
  const easeLock = (u) => { const c1 = 1.4, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; };

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

  VIZ.register({
    id: 'constructivist',
    name: 'Constructivist',
    order: 502,

    params: [
      { key: 'words', label: 'Beam headline', type: 'text', default: 'DANCE UNTIL THE MORNING' },
      { key: 'shouts', label: 'Horn shouts', type: 'text', default: 'HEY! LOUDER! MOVE! AGAIN! NOW! ALL NIGHT!' },
      { key: 'angle', label: 'Diagonal', type: 'range', min: -40, max: 40, default: -22, step: 0.5 },
      { key: 'forms', label: 'Forms in the construction', type: 'range', min: 2, max: 10, default: 7, step: 1 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'motion', label: 'Beam & record speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'ink', label: 'Red ink', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'stock', label: 'Paper', type: 'select', options: STOCKS.map((s) => s.name), default: 0 },
    ],

    actions: [
      { id: 'rebuild', label: 'Rebuild the construction', run() { this.wantRebuild = true; } },
    ],

    gallery: {
      title: 'Constructivist',
      technique: 'Canvas 2D in two multiplied litho inks on a generated paper texture: every element placed along one rotating diagonal axis, bars tweened in with a locking overshoot, knockout type clipped to the beam, a halftone photo fragment drawn dot by dot, geometric figures posed from the measured beat phase; onset detection per band',
      brief: 'A Rodchenko/Lissitzky poster for a night of dancing, in red, black and cream. A red loudspeaker horn in the lower left throws a black diagonal beam across the sheet and the headline streams out of it in huge cream capitals. Above the beam a construction of red and black bars assembles: each kick fires one bar in along its own axis to lock into place with a hard little bounce, while the oldest bar leaves forward. Each snare makes the horn shout a red word that grows along the beam; the hats run thin sound-rings down it; the bass spins the split red-and-black record behind the beam and ripples the halftone speaker cone in the corner. The drop slides a red counter-band across the beam, brings on three Stepanova-style geometric dancers who crouch on the beat and change their arms every bar, and fills the construction with heavier bars; the breakdown sends them off one at a time and leaves the horn talking to an emptier sheet.',
      lineage: [
        'Rodchenko\'s and Lissitzky\'s posters and book covers (one hard diagonal carrying the sheet, type running on it, the loudspeaker and the shouting mouth as images of broadcast), Varvara Stepanova\'s geometric figures for the dancers, and the halftone photo fragment of their photomontage; red, black and cream only, with no state or political symbols; the batch-05 "Constructivist" entry. Faces from web/fonts.js: Anton for the beam, the shouts and the vertical word, Oswald for the small print.',
        'Built along one axis: every element is placed in (along, across) coordinates of the diagonal, so the Diagonal control swings the whole construction and each breakdown slowly re-pitches it to a new angle (0, -8, +5, -4 degrees) so later drops land on a different sheet. Inks multiply onto a generated paper texture, the red plate sits about a unit out of register and wanders, and a wear layer lets paper through the ink.',
        'Process: first render already read as the poster, but the drop\'s red counter-band ran through the dancers and the small print, the mottled paper read as polka dots, and overlapping snare shouts piled up on the record. The counter-band was re-angled to cross down-left between them, the small print moved onto the beam\'s underside, a stage rule added under the dancers, shouts limited in travel and rate, and the paper mottling drawn at 1/16 scale instead of with a canvas blur filter (whose first frame took 25 s in SwiftShader and timed the harness out).',
        'The kick is one bar flying in along its own axis and locking with a small bounce, plus the dancers\' crouch (a continuous function of measured beat phase, lowest on the kick); everything else is continuous. Jolt at 640x360: calm, kickArea 0.22, ratio 1.41 (build kick 0.18, ratio 1.12). Sections from a slow follower of band 1 with hysteresis, as in Poster.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.bars) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.kickTimes = [];
      this.low = 0; this.dense = false; this.denseAt = -10; this.calmAt = -10;
      this.bassEnv = 0; this.padEnv = 0; this.hatSlow = 0; this.energy = 0;
      this.scroll = 0; this.spin = 0; this.ripple = 0; this.drift = 0;
      this.bars = []; this.slotPtr = 0; this.slots = null; this.lastLeave = 0;
      this.shouts = []; this.shoutPtr = 0;
      this.rings = [];
      this.dancePres = 0; this.crossPres = 0;
      this.pose = 0; this.poseFrom = 0; this.poseAt = -10;
      this.paperKey = ''; this.wantRebuild = false;
      this.tiltIdx = 0; this.tilt = 0;
    },

    // A fresh construction: a list of slots above the beam, in axis
    // coordinates (s along the beam, d up away from it). Written in 600-unit
    // space so the same stack reads at 16:9 and square.
    makeSlots() {
      const r = this.rng;
      const slots = [];
      for (let i = 0; i < 10; i++) {
        const perp = r() < 0.28;
        const heavy = r() < 0.35;
        slots.push({
          perp,
          s: perp ? lerp(-380, 60, r()) : lerp(-360, 40, r()),
          d: perp ? lerp(160, 300, r()) : 95 + Math.floor(r() * 11) * 22,
          len: perp ? lerp(140, 300, r()) : lerp(110, 360, r()),
          th: heavy ? lerp(26, 40, r()) : r() < 0.5 ? 9 : lerp(14, 20, r()),
          red: i % 3 !== 1,
        });
      }
      this.slots = slots;
      this.slotPtr = 0;
    },

    addBar(t, params) {
      if (!this.slots) this.makeSlots();
      const slot = this.slots[this.slotPtr % this.slots.length];
      this.slotPtr++;
      if (this.slotPtr % this.slots.length === 0) this.makeSlots();
      // Drop bars are heavier, so the construction thickens when the room does.
      const th = slot.th * (this.dense ? 1.35 : 1);
      const flyDur = 0.1 + 0.1 / (0.5 + params.reaction);
      this.bars.push({ ...slot, th, born: t, flyDur, leaving: -1 });
      const maxN = this.dense ? Math.round(params.forms) : Math.max(2, Math.round(params.forms * 0.55));
      const live = this.bars.filter((b) => b.leaving < 0);
      if (live.length > maxN) live[0].leaving = t;
    },

    shout(t, params) {
      const list = String(params.shouts || '').trim().split(/\s+/).filter(Boolean);
      const word = list.length ? list[this.shoutPtr % list.length] : 'HEY!';
      this.shoutPtr++;
      this.shouts.push({ word, born: t, lift: this.shoutPtr % 2 });
      if (this.shouts.length > 3) this.shouts.shift();
    },

    analyse(s, t, dt, params) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        this.kickTimes.push(t); if (this.kickTimes.length > 9) this.kickTimes.shift();
        this.addBar(t, params);
        if (this.kickCount % 4 === 1) { this.poseFrom = this.pose; this.pose++; this.poseAt = t; }
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t; this.shout(t, params);
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t;
        this.rings.push({ born: t, amp: clamp(bh / 80, 0.3, 1) });
        if (this.rings.length > 10) this.rings.shift();
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.05) : k(0.35));
      this.padEnv += ((s[2] + s[3]) / 200 - this.padEnv) * k(0.6);
      this.hatSlow += ((s[7] + s[8]) / 200 - this.hatSlow) * k(1.5);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
    },

    beatPeriod(t) {
      const kt = this.kickTimes;
      if (kt.length < 3) return 0.484;
      const iv = [];
      for (let i = 1; i < kt.length; i++) iv.push(kt[i] - kt[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[iv.length >> 1];
      return med > 0.25 && med < 1.2 ? med : 0.484;
    },

    // Paper and wear textures, generated once per canvas size in device pixels.
    makePaper(p, stock) {
      const w = p.width * p.pixelDensity(), h = p.height * p.pixelDensity();
      const key = w + 'x' + h + ':' + stock.name;
      if (this.paperKey === key) return;
      this.paperKey = key;
      const r = mulberry(7);
      const paper = document.createElement('canvas');
      paper.width = w; paper.height = h;
      const g = paper.getContext('2d');
      g.fillStyle = stock.paper; g.fillRect(0, 0, w, h);
      const sc = Math.min(w, h) / 600;
      // Mottling: large soft blotches of slightly darker and lighter stock.
      // Drawn at 1/16 scale and smoothed up: soft enough not to read as polka
      // dots, and far cheaper than a canvas blur filter (which took 25 s for
      // the first frame under SwiftShader).
      const lw = Math.max(8, Math.round(w / 16)), lh = Math.max(8, Math.round(h / 16));
      const lo = document.createElement('canvas');
      lo.width = lw; lo.height = lh;
      const lg = lo.getContext('2d');
      for (let i = 0; i < 320; i++) {
        const x = r() * lw, y = r() * lh, rad = (30 + r() * 110) * sc / 16;
        lg.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.03)' : 'rgba(255,250,235,0.045)';
        lg.beginPath(); lg.ellipse(x, y, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); lg.fill();
      }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(lo, 0, 0, w, h);
      // Fibres and flecks.
      const f = stock.fleck;
      g.lineWidth = Math.max(0.6, 0.5 * sc);
      for (let i = 0; i < 900; i++) {
        const x = r() * w, y = r() * h, a = r() * Math.PI, l = (2 + r() * 7) * sc;
        g.strokeStyle = 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',' + (0.08 + r() * 0.15).toFixed(3) + ')';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',' + (0.1 + r() * 0.25).toFixed(3) + ')';
        g.fillRect(r() * w, r() * h, Math.max(1, sc * r() * 1.4), Math.max(1, sc * r() * 1.4));
      }
      // Wear: paper showing through the ink, as specks and faint dragged
      // streaks where the stone ran dry. Drawn over everything.
      const wear = document.createElement('canvas');
      wear.width = w; wear.height = h;
      const q = wear.getContext('2d');
      q.fillStyle = stock.paper;
      for (let i = 0; i < 5200; i++) {
        q.globalAlpha = 0.25 + r() * 0.55;
        const s = sc * (0.5 + r() * r() * 2.4);
        q.fillRect(r() * w, r() * h, s, s);
      }
      q.globalAlpha = 0.07;
      q.lineWidth = Math.max(1, sc * 0.8);
      q.strokeStyle = stock.paper;
      for (let i = 0; i < 140; i++) {
        const y = r() * h, x = r() * w, l = (40 + r() * 260) * sc;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + l, y + (r() - 0.5) * 4 * sc); q.stroke();
      }
      q.globalAlpha = 1;
      this.paper = paper; this.wear = wear;
    },

    draw(p, signals, params, ctx) {
      if (!this.bars) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const u = S / 600;
      const stock = STOCKS[clamp(Math.round(params.stock), 0, STOCKS.length - 1)];
      const RED = INKS[clamp(Math.round(params.ink), 0, INKS.length - 1)].red;
      const PAPER = stock.paper;
      const react = params.reaction, motion = params.motion;

      this.analyse(signals, t, dt, params);
      if (this.wantRebuild) {
        this.wantRebuild = false;
        this.makeSlots();
        this.bars.forEach((b) => { if (b.leaving < 0) b.leaving = t; });
      }

      // Sections: the drop's bass line holds `low` up; hysteresis so a single
      // quiet bar does not tear the poster down.
      if (!this.dense && this.low > 27) { this.dense = true; this.denseAt = t; }
      else if (this.dense && this.low < 19) {
        this.dense = false; this.calmAt = t;
        // Each breakdown swings the whole diagonal to a new pitch, slowly, so
        // the sheet you come back to after the next drop is not the same one.
        this.tiltIdx = (this.tiltIdx + 1) % TILTS.length;
      }
      this.tilt += (TILTS[this.tiltIdx] - this.tilt) * (1 - Math.exp(-dt / 2.5));
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.crossPres += ((this.dense ? 1 : 0) - this.crossPres) * k(this.dense ? 0.35 : 0.9);
      this.dancePres += ((this.dense ? 1 : 0) - this.dancePres) * k(this.dense ? 0.45 : 1.1);

      // Without kicks the construction thins out on its own, one bar at a time.
      if (t - this.lastKick > 1.5 && t - this.lastLeave > 1.1) {
        const live = this.bars.filter((b) => b.leaving < 0);
        if (live.length > 2) { live[0].leaving = t; this.lastLeave = t; }
      }
      this.bars = this.bars.filter((b) => b.leaving < 0 || t - b.leaving < 1.2);
      this.shouts = this.shouts.filter((s) => t - s.born < 1.3);
      this.rings = this.rings.filter((r) => t - r.born < 1.1);

      // Continuous motion: speeds follow the energy, never jump.
      const drive = 0.25 + 1.1 * this.energy + 0.9 * this.bassEnv;
      this.scroll += dt * motion * 60 * drive;
      this.spin += dt * motion * (0.25 + 1.6 * this.bassEnv + 0.6 * this.energy);
      this.ripple += dt * (1.5 + 5 * this.bassEnv) * (0.4 + 0.6 * motion);
      this.drift += dt;

      // The axis. Everything hangs off one diagonal, which breathes a couple of
      // degrees over half a minute so the sheet is never quite still.
      const ang = (params.angle + this.tilt + 1.6 * Math.sin(this.drift * 0.19)) * Math.PI / 180;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ox = W * 0.45, oy = H * 0.62;
      const nx = sa, ny = -ca; // unit normal pointing up, away from the beam
      const AX = (s, d) => ox + ca * s + nx * d;
      const AY = (s, d) => oy + sa * s + ny * d;
      const BAND = 122 * u;
      const reach = Math.hypot(W, H);

      this.makePaper(p, stock);
      const c = p.drawingContext;
      c.save();
      // Paper, in device pixels.
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(this.paper, 0, 0);
      c.restore();

      c.globalAlpha = 1;
      c.lineCap = 'butt'; c.lineJoin = 'miter';
      c.globalCompositeOperation = 'multiply';
      // The red plate sits a hair out of register and wanders slowly.
      const mrx = (1.3 + 0.6 * Math.sin(this.drift * 0.23)) * u;
      const mry = (-0.9 + 0.5 * Math.cos(this.drift * 0.17)) * u;
      const redPlate = (fn) => { c.save(); c.translate(mrx, mry); c.fillStyle = RED; c.strokeStyle = RED; fn(); c.restore(); };

      const HEAD = face('Anton', 'Impact, "Arial Narrow", sans-serif');
      const SMALL = face('Oswald', '"Arial Narrow", Arial, sans-serif');

      // --- Halftone photo fragment: a speaker cone, cut and pasted on a tilt.
      {
        const pw = 240 * u, ph = 180 * u;
        const cx = Math.min(W * 0.17, 175 * u) + 20 * u, cy = H * 0.2;
        c.save();
        c.translate(cx, cy); c.rotate(0.1);
        c.fillStyle = 'rgba(40,34,28,0.10)';
        c.fillRect(-pw / 2, -ph / 2, pw, ph);
        c.beginPath(); c.rect(-pw / 2, -ph / 2, pw, ph); c.clip();
        const pitch = 5.2 * u;
        const ccx = 0.12 * pw, ccy = 0.05 * ph, R = 0.62 * ph;
        const amp = 0.08 + 0.55 * this.bassEnv * (0.4 + 0.6 * react);
        c.fillStyle = BLACK;
        c.beginPath();
        for (let y = -ph / 2 + pitch / 2, row = 0; y < ph / 2 + pitch; y += pitch, row++) {
          for (let x = -pw / 2 + (row % 2 ? pitch / 2 : 0); x < pw / 2 + pitch; x += pitch) {
            const dx = x - ccx, dy = (y - ccy) * 1.08;
            const rr = Math.hypot(dx, dy) / R;
            let v;
            if (rr < 0.16) v = 0.85 - rr * 1.5;                       // dust cap
            else if (rr < 0.86) v = 0.25 + 0.5 * rr + 0.12 * Math.cos(rr * 44 - this.ripple * 5) * amp + 0.15 * amp * Math.sin(rr * 13 - this.ripple * 2); // the cone, rippling
            else if (rr < 1.02) v = 0.15 + 0.2 * Math.sin((rr - 0.86) * 20); // surround
            else v = 0.62 + 0.18 * (x / pw) + 0.1 * Math.sin(y * 0.02 / u);   // the cabinet
            // a sidelight from upper left, so it reads as a photograph
            v -= 0.18 * ((-dx - dy) / R) * (rr < 1 ? 1 : 0.3);
            v = clamp(v, 0.02, 1);
            const rad = pitch * 0.62 * Math.sqrt(v);
            if (rad > 0.3 * u) { c.moveTo(x + rad, y); c.arc(x, y, rad, 0, Math.PI * 2); }
          }
        }
        c.fill();
        c.restore();
        // the cut edge, drawn as a black keyline
        c.save(); c.translate(cx, cy); c.rotate(0.1);
        c.strokeStyle = BLACK; c.lineWidth = 3 * u; c.strokeRect(-pw / 2, -ph / 2, pw, ph);
        c.restore();
      }

      // --- The record: a split red and black disc, turning with the bass.
      const dcx = W * 0.62, dcy = H * 0.27, dr = 172 * u;
      {
        redPlate(() => { c.beginPath(); c.arc(dcx, dcy, dr, 0, Math.PI * 2); c.fill(); });
        c.fillStyle = BLACK;
        c.beginPath(); c.moveTo(dcx, dcy); c.arc(dcx, dcy, dr, this.spin, this.spin + Math.PI); c.closePath(); c.fill();
        // A red quarter wedge riding on the black half, offset from the centre:
        // the turn is readable at a glance from across a room.
        redPlate(() => {
          c.beginPath(); c.moveTo(dcx, dcy);
          c.arc(dcx, dcy, dr * 0.78, this.spin + Math.PI * 1.25, this.spin + Math.PI * 1.55); c.closePath(); c.fill();
        });
        c.strokeStyle = BLACK; c.lineWidth = 1.4 * u;
        for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(dcx, dcy, dr * (0.46 + i * 0.075), this.spin + 0.2, this.spin + Math.PI - 0.2, true); c.stroke(); }
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = PAPER;
        c.beginPath(); c.arc(dcx, dcy, dr * 0.3, 0, Math.PI * 2); c.fill();
        c.restore();
        // label type on a circle, turning with the record
        c.fillStyle = BLACK; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '600 ' + (10.5 * u).toFixed(2) + 'px ' + SMALL;
        const label = 'SIDE ONE · MUSIC FOR THE NIGHT · 124 · ';
        const lr = dr * 0.22;
        for (let i = 0; i < label.length; i++) {
          const a = this.spin + (i / label.length) * Math.PI * 2;
          c.save(); c.translate(dcx + Math.cos(a) * lr, dcy + Math.sin(a) * lr); c.rotate(a + Math.PI / 2);
          c.fillText(label[i], 0, 0); c.restore();
        }
        c.beginPath(); c.arc(dcx, dcy, 4 * u, 0, Math.PI * 2); c.fill();
      }

      // --- Drop: a red counter-band slides in across the beam.
      if (this.crossPres > 0.01) {
        // Crossing the beam steeply, down-left below it, so it runs between
        // the small print and the dancers rather than through them.
        const ca2 = Math.cos(ang + 2.25), sa2 = Math.sin(ang + 2.25);
        const cx0 = AX(100, 0), cy0 = AY(100, 0);
        const off = (1 - easeInOut(clamp(this.crossPres, 0, 1))) * reach;
        redPlate(() => {
          c.save(); c.translate(cx0 - ca2 * off, cy0 - sa2 * off); c.rotate(ang + 2.25);
          c.fillRect(-reach, -30 * u, reach * 2, 60 * u);
          c.restore();
        });
        // a thin black rule riding beside it
        c.save(); c.translate(cx0 + ca2 * off * 1.3, cy0 + sa2 * off * 1.3); c.rotate(ang + 2.25);
        c.fillStyle = BLACK; c.fillRect(-reach, 42 * u, reach * 2, 7 * u);
        c.restore();
      }

      // --- The construction: bars that fly in and lock on the kick.
      for (const b of this.bars) {
        const fu = clamp((t - b.born) / b.flyDur, 0, 1);
        const land = easeLock(fu);
        const far = reach * 1.1;
        let s = b.s, d = b.d;
        if (b.perp) d = b.d + (1 - land) * far; else s = b.s - (1 - land) * far;
        if (b.leaving >= 0) {
          const lu = easeIn(clamp((t - b.leaving) / 1.1, 0, 1)) * far;
          if (b.perp) d -= lu; else s += lu;
        }
        const x = AX(s, d), y = AY(s, d);
        const draw = () => {
          c.save(); c.translate(x, y); c.rotate(b.perp ? ang + Math.PI / 2 : ang);
          c.fillRect(-b.len / 2 * u, -b.th / 2 * u, b.len * u, b.th * u);
          c.restore();
        };
        if (b.red) redPlate(draw); else { c.fillStyle = BLACK; draw(); }
        // the rivet that appears the moment it locks
        if (fu >= 1 && b.leaving < 0) {
          const rx = b.perp ? AX(b.s, b.d - b.len / 2 + 6) : AX(b.s + b.len / 2 - 6, b.d);
          const ry = b.perp ? AY(b.s, b.d - b.len / 2 + 6) : AY(b.s + b.len / 2 - 6, b.d);
          const rs = Math.min(b.th * 0.8, 10) * u;
          c.fillStyle = b.red ? BLACK : RED;
          c.save(); c.translate(rx, ry); c.rotate(ang); c.fillRect(-rs / 2, -rs / 2, rs, rs); c.restore();
        }
      }

      // --- The beam.
      const bs0 = -262 * u; // where the beam leaves the horn mouth
      c.save();
      c.translate(ox, oy); c.rotate(ang);
      c.fillStyle = BLACK;
      c.fillRect(bs0, -BAND / 2, reach * 1.5, BAND);
      c.restore();

      // --- The horn: a red flared cone with a black driver at its throat.
      {
        c.save(); c.translate(ox, oy); c.rotate(ang);
        const m = bs0, th = m - 165 * u;
        const mouth = BAND * 0.8 + 8 * u * this.bassEnv * react;
        redPlate(() => {
          c.beginPath();
          c.moveTo(th, -16 * u); c.lineTo(m, -mouth); c.lineTo(m + 12 * u, -mouth);
          c.lineTo(m + 12 * u, mouth); c.lineTo(m, mouth); c.lineTo(th, 16 * u); c.closePath(); c.fill();
        });
        c.fillStyle = BLACK;
        c.fillRect(th - 46 * u, -30 * u, 46 * u, 60 * u);
        c.fillRect(th - 70 * u, -8 * u, 24 * u, 16 * u);
        // guide lines on the cone, the machine drawing
        c.strokeStyle = BLACK; c.lineWidth = 1.5 * u;
        for (let i = 1; i < 4; i++) {
          const f = i / 4;
          c.beginPath(); c.moveTo(th, -16 * u + 32 * u * f); c.lineTo(m, -mouth + 2 * mouth * f); c.stroke();
        }
        c.restore();
      }

      // --- Inside the beam: knockout type streaming out of the horn, and the
      // hats' sound-rings. Paper colour, painted over the black.
      {
        c.save();
        c.translate(ox, oy); c.rotate(ang);
        c.beginPath(); c.rect(bs0 + 12 * u, -BAND / 2, reach * 1.5, BAND); c.clip();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = PAPER; c.strokeStyle = PAPER;
        const fs = BAND * 0.98;
        c.font = '400 ' + fs.toFixed(1) + 'px ' + HEAD;
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        const txt = String(params.words || 'DANCE').toUpperCase().trim() + '   ■   ';
        const tw = Math.max(40 * u, c.measureText(txt).width);
        const capH = fs * 0.735;
        const base = capH / 2;
        let x0 = bs0 + 20 * u + ((this.scroll * u) % tw) - tw;
        for (let x = x0; x < reach * 1.2; x += tw) c.fillText(txt, x, base);
        // sound rings: arcs travelling out of the mouth along the beam
        for (const r of this.rings) {
          const a = (t - r.born) / 1.1;
          const rad = (20 + 520 * easeOut(a)) * u;
          c.globalAlpha = (1 - a) * 0.9 * r.amp;
          c.lineWidth = (3.2 - 2 * a) * u;
          c.beginPath(); c.arc(bs0 - 60 * u, 0, rad, -0.5, 0.5); c.stroke();
        }
        c.globalAlpha = 1;
        c.restore();
        // hairlines along both edges of the beam
        c.save(); c.translate(ox, oy); c.rotate(ang);
        c.fillStyle = BLACK;
        c.fillRect(bs0, -BAND / 2 - 12 * u, reach * 1.5, 3 * u);
        c.fillRect(bs0 + 120 * u, BAND / 2 + 9 * u, reach * 1.5, 2 * u);
        c.restore();
      }

      // --- The vertical word up the right edge.
      {
        const fsV = 196 * u;
        c.font = '400 ' + fsV.toFixed(1) + 'px ' + HEAD;
        const word = 'LOUDER';
        const ww = c.measureText(word).width;
        const target = H * 0.92;
        const sc = target / Math.max(1, ww);
        c.save();
        c.translate(W - 16 * u, H * 0.96);
        c.rotate(-Math.PI / 2);
        c.scale(sc, 1);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        redPlate(() => { c.fillText(word, 0, 0); });
        c.restore();
      }

      // --- Dancers after Stepanova: circle heads, wedge torsos, bar limbs.
      if (this.dancePres > 0.01) {
        const per = this.beatPeriod(t);
        let ph = (t - this.lastKick) / per;
        if (t - this.lastKick > per * 2.5) ph = t / 0.484;
        const crouch = 0.5 + 0.5 * Math.cos(2 * Math.PI * ph);
        const pu = clamp((t - this.poseAt) / 0.18, 0, 1);
        const poseT = easeOut(pu);
        const floorY = H * 0.95;
        const specs = [
          { fx: 0.57, h: 150, red: false, lag: 0.0, mir: 1 },
          { fx: 0.70, h: 180, red: true, lag: 0.12, mir: -1 },
          { fx: 0.83, h: 160, red: false, lag: 0.06, mir: 1 },
        ];
        const enter = easeInOut(clamp(this.dancePres, 0, 1));
        // the stage they dance on: a heavy black rule that slides in first
        c.fillStyle = BLACK;
        const fl0 = W * 0.53 + (1 - enter) * W * 0.55;
        c.fillRect(fl0, floorY + 2 * u, W * 0.36, 9 * u);
        specs.forEach((sp, i) => {
          const x = W * sp.fx + (1 - clamp(enter * 1.25 - i * 0.12, 0, 1)) * W * 0.6;
          this.dancer(c, x, floorY, sp.h * u, sp.red ? RED : BLACK, crouch, ph + sp.lag, this.pose + i, this.poseFrom + i, poseT, sp.mir, u, sp.red ? [mrx, mry] : null);
        });
      }

      // --- Snare: the horn shouts a red word that flies up the beam.
      {
        c.save(); c.translate(ox, oy); c.rotate(ang);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        for (const sh of this.shouts) {
          const a = (t - sh.born) / 1.3;
          const e = easeOut(clamp(a * 1.4, 0, 1));
          const fs = (26 + 70 * e * (0.6 + 0.4 * react)) * u;
          c.font = '400 ' + fs.toFixed(1) + 'px ' + HEAD;
          const x = bs0 + (10 + 210 * e) * u;
          const y = -BAND / 2 - 20 * u - (sh.lift ? 50 : 12) * u * e;
          c.globalAlpha = a < 0.65 ? 1 : clamp(1 - (a - 0.65) / 0.35, 0, 1);
          c.save(); c.translate(x, y); c.rotate(-0.08 * e);
          redPlate(() => c.fillText(sh.word, 0, 0));
          c.restore();
        }
        c.globalAlpha = 1;
        c.restore();
      }

      // --- Small print, bottom left, under the horn.
      {
        // Set along the underside of the beam, as the movement set its small print.
        c.save(); c.translate(ox, oy); c.rotate(ang);
        c.fillStyle = BLACK; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        const x = -300 * u, y = BAND / 2 + 34 * u;
        c.font = '700 ' + (15 * u).toFixed(1) + 'px ' + SMALL;
        c.fillText('A NIGHT OF SOUND AND MOVEMENT', x, y);
        c.font = '400 ' + (12 * u).toFixed(1) + 'px ' + SMALL;
        c.fillText('DOORS AT DUSK  ·  DANCE TILL LIGHT  ·  BRING EVERYONE', x, y + 17 * u);
        redPlate(() => c.fillRect(x - 22 * u, y - 13 * u, 13 * u, 13 * u));
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

    // One geometric figure. Crouches on the beat (a continuous function of the
    // beat phase, lowest on the kick), sways every two beats, and takes a new
    // arm pose on each bar's downbeat, tweened over a fraction of a beat.
    dancer(c, x, floor, h, col, crouch, ph, pose, poseFrom, poseT, mir, u, reg) {
      const POSES = [
        [2.5, 0.6, -2.5, -0.6],   // both arms up in a V
        [1.57, 0.9, -0.4, -1.2],  // one out, one down on the hip
        [2.9, 0.1, -1.57, 0.9],   // one straight up, one out and bent
        [1.2, 1.6, -1.2, -1.6],   // arms out, forearms up
      ];
      const P0 = POSES[((poseFrom % 4) + 4) % 4], P1 = POSES[((pose % 4) + 4) % 4];
      const A = P0.map((v, i) => lerp(v, P1[i], poseT));
      const sway = Math.sin(Math.PI * ph);
      const leg = h * 0.27, torso = h * 0.3, arm = h * 0.2, head = h * 0.075;
      const bend = 0.18 + 0.55 * crouch;
      const hipY = floor - 2 * leg * Math.cos(bend);
      const hipX = x + sway * h * 0.05 * mir;
      const lean = 0.12 * sway * mir;
      const shX = hipX + Math.sin(lean) * torso, shY = hipY - Math.cos(lean) * torso;
      c.save();
      if (reg) c.translate(reg[0], reg[1]);
      c.fillStyle = col; c.strokeStyle = col;
      c.lineCap = 'butt';
      // legs: thigh forward, shin back, feet planted apart
      const lw = h * 0.07;
      c.lineWidth = lw;
      for (const sd of [-1, 1]) {
        const fx = x + sd * h * 0.13;
        const kx = (hipX + fx) / 2 + sd * leg * Math.sin(bend) * 0.9, ky = (hipY + floor) / 2;
        c.beginPath(); c.moveTo(hipX + sd * h * 0.04, hipY); c.lineTo(kx, ky); c.lineTo(fx, floor); c.stroke();
        c.fillRect(fx - (sd < 0 ? h * 0.1 : 0), floor - lw * 0.6, h * 0.1, lw * 0.6);
      }
      // torso: a wedge, broad at the shoulders
      c.beginPath();
      const px = Math.cos(lean), py = Math.sin(lean);
      c.moveTo(hipX - px * h * 0.05, hipY - py * h * 0.05);
      c.lineTo(hipX + px * h * 0.05, hipY + py * h * 0.05);
      c.lineTo(shX + px * h * 0.11, shY + py * h * 0.11);
      c.lineTo(shX - px * h * 0.11, shY - py * h * 0.11);
      c.closePath(); c.fill();
      // arms
      c.lineWidth = h * 0.055;
      const arms = [[A[0], A[1], 1], [A[2], A[3], -1]];
      for (const [up, fore, sd] of arms) {
        const sx = shX + sd * px * h * 0.1 * mir, sy = shY + sd * py * h * 0.1;
        const a1 = Math.PI / 2 - up * mir + lean;
        const ex = sx + Math.cos(a1) * arm, ey = sy + Math.sin(a1) * arm;
        const a2 = a1 - fore * mir + 0.25 * sway;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(ex + Math.cos(a2) * arm, ey + Math.sin(a2) * arm); c.stroke();
      }
      // head
      c.beginPath(); c.arc(shX + Math.sin(lean) * head * 1.8, shY - head * 1.7, head, 0, Math.PI * 2); c.fill();
      c.restore();
    },
  });
})();
