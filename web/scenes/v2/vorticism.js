// Vorticism V2: the vortex is the sheet. Redesigned after the six-judge review
// (harness/v2/vorticism.md), which found V1 a pink wall with type on top and a
// vortex drawn as scattered confetti.
//
// The whole broadside is cut into hard angular planes on a logarithmic spiral
// grid, jittered at the nodes so the cells come out as Lewis's blades, slabs and
// wedges rather than a dartboard. They stream endlessly inward into one still
// black eye: an infinite zoom in flat print. A black slab crosses the lower
// sheet on an aggressive diagonal, and the headline is cut out of it, so the
// vortex pours through the letters in inverted inks instead of sitting behind
// a word laid on top.
//
// Music, each in its own place:
//   kick   a charge of paper runs down one arm of the spiral into the eye, which
//          ratchets a notch; the arm steps round by 7 of 11 each beat
//   snare  one ring of planes turns over to its inverse inks and is carried in
//   hats   paper needles flick along the spiral
//   bar    the manifesto slip turns over to its next HAIL and SCORN
//   bass   the drain's speed and the eye's size
//   drop   the plates: black, steel and ochre ink in the planes (calm is mostly
//          keylines on pink), a faster, tighter drain, and the headline swings
//          steeper and thicker and changes word (HUSH to ROAR)
// Slow clock: the eye wanders over the upper sheet on a ~3 minute path, so the
// spiral re-composes itself over a set.
// Printed look: flat inks, a mottled flood, worn specks, the ochre plate a hair
// out of register. No glow.

(function () {
  const GROUNDS = [
    { name: 'Blast pink', ground: '#DB4F85', dark: '#6E1740', light: '#EFE5D1' },
    { name: 'Puce', ground: '#B25672', dark: '#4F1530', light: '#ECE0CB' },
    { name: 'Raw paper', ground: '#E9DFC8', dark: '#6E1740', light: '#DB4F85' },
  ];
  const BLACK = '#171314';
  const STEEL = '#55606B';
  const OCHRE = '#C98F22';
  const PAPER = '#EFE6D2';
  const ARMS = 11;
  const Q = 0.8; // each ring is this fraction of the one outside it
  const LQ = -Math.log(Q);
  // Arms that lean dark, so the spiral reads as arms and not as a speckle.
  const DARK_ARMS = [0, 4, 8];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeLock = (u) => { const c1 = 1.6, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; };

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

  // A cell's properties are a pure function of its ring and arm, so a plane
  // keeps its ink all the way down the drain and nothing ever flickers.
  function hash(a, b, c, seed) {
    let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177) + seed) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    x = Math.imul(x, 0x85EBCA6B);
    x ^= x >>> 13;
    return (x >>> 0) / 4294967296;
  }

  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  VIZ.register({
    id: 'vorticismv2',
    name: 'Vorticism',
    versionOf: 'vorticism',
    version: 'V2',
    order: 723,

    params: [
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
      { key: 'ink', label: 'Ink (keylines to full plates)', type: 'range', min: 0, max: 1, default: 0.15, step: 0.01 },
      { key: 'speed', label: 'Drain speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'twist', label: 'Vortex twist', type: 'range', min: 0, max: 2.5, default: 1.1, step: 0.01 },
      { key: 'ochre', label: 'Ochre plate', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'shout', label: 'Headline (hush to roar)', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'ground', label: 'Ground ink', type: 'select', options: GROUNDS.map((g) => g.name), default: 0 },
      { key: 'headline', label: 'Loud headline', type: 'text', default: 'ROAR' },
      { key: 'quiet', label: 'Quiet headline', type: 'text', default: 'HUSH' },
      { key: 'subline', label: 'Beside the headline', type: 'text', default: 'OF THE NIGHT MACHINE' },
      { key: 'manifesto', label: 'Hail | Scorn', type: 'text', default: 'THE KICK DRUM, THE BASS BIN, THE LAST TRAIN, THE LOW END | THE HOUSE LIGHTS, THE COLD DAWN, THE QUIET ROOM, THE CLOAKROOM' },
    ],

    // Both set follow off: a recalled snapshot is the performer's look, and
    // the core's own Follow drives the fader between them.
    presets: {
      calm: { follow: 0, ink: 0.12, speed: 0.6, twist: 0.9, ochre: 0, shout: 0 },
      drop: { follow: 0, ink: 1, speed: 2.1, twist: 1.6, ochre: 1, shout: 1 },
      plates: { follow: 0, ink: 0.75, speed: 1, twist: 2.2, ochre: 0.6, shout: 0 },
    },

    actions: [
      { id: 'reshard', label: 'Cut new planes', run() { this.seed = (Math.random() * 1e9) | 0; } },
    ],

    gallery: {
      title: 'Vorticism',
      technique: 'Canvas 2D in flat letterpress inks: a logarithmic spiral grid (11 arms, rings shrinking by 0.8) with hashed node jitter and diagonal splits, streaming inward by a continuous log-radius phase so every plane keeps its identity down the drain; planes batched by ink into one path each; the headline is drawn as a mask on an offscreen layer and the vortex repainted into it with source-atop in inverted inks; generated flood and wear textures; onset detection per band',
      brief: 'A Vorticist broadside in hot pink, black and paper where the vortex is the whole sheet: every inch is cut into hard angular planes that spiral forever into one still black eye in the upper right, and a black slab crosses the lower sheet on a diagonal with the headline stencilled out of it, so the vortex pours through the letters. Each kick sends a charge of paper down one arm into the eye, which ratchets round; each snare turns one ring of planes over to its inverse inks; hats flick paper needles along the spiral; the pasted slip hails one thing of the night and scorns another, turning over every bar. The bass sets how fast the sheet drains. In the calm it is keylines on pink under the word HUSH; the drop lays down the black, steel and ochre plates, tightens and speeds the drain, and swings the slab steeper as the headline turns to ROAR. The eye wanders slowly, so the spiral recomposes over minutes.',
      lineage: 'V2 of Vorticism (vorticism, batch 05), which ranked in the bottom 12 (mean 4.0). After Wyndham Lewis and the 1914-15 review (puce ground, slab type between heavy rules, blast-and-bless lists), his angular compositions, and Pound\'s vortex as the point of maximum energy. Acted on: the designer\'s "the vortex should consume the page" and "ROAR sits on top of the vortex" (a full-sheet spiral tessellation, and a headline stencilled out of a slab so the vortex runs through it); the director\'s "no depth" and "ROAR never moves" (an endless inward drain, a slab that swings into the drop); the designer\'s headline-per-section transplant (HUSH to ROAR); the psychonaut\'s "pink wall" and the curator\'s "static and shouting" (a whispering keyline calm and a spiral to fall into); the purist\'s "identical at 96 s" (the wandering eye); the floor\'s unreadable card (two lines at room size). Rejected: onomatopoeia on the kick (Futurism\'s device; here the kick is the vortex drawing energy in) and merging into Constructivist. See harness/v2/vorticism.md.',
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.prev) this.init(); },

    init() {
      if (this.seed === undefined) this.seed = (Math.random() * 1e9) | 0;
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0;
      this.low = 0; this.dense = false; this.dropPres = 0;
      this.bassEnv = 0; this.energy = 0;
      this.phase = 0; this.spin = 0; this.clock = 0;
      this.charges = []; this.rings = []; this.needles = [];
      this.notch = 0; this.notchFrom = 0; this.notchAt = -10;
      this.bar = 0; this.barFrom = 0; this.barAt = -10;
      this.word = null; this.oldWord = null; this.wipeAt = -10;
      this.texKey = '';
    },

    analyse(s, t, dt, react) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        this.charges.push({ born: t, arm: (this.kickCount * 7) % ARMS });
        if (this.charges.length > 4) this.charges.shift();
        this.notchFrom = this.notch; this.notch++; this.notchAt = t;
        if (this.kickCount % 4 === 1) { this.barFrom = this.bar; this.bar++; this.barAt = t; }
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t;
        // The ring that is a little way in when the snare lands, named by its
        // own index so it is carried inward while it shows.
        this.rings.push({ born: t, k: Math.round(4.6 - this.phase) });
        if (this.rings.length > 2) this.rings.shift();
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t;
        const r = mulberry(Math.floor(t * 1000));
        const n = react > 1.2 ? 3 : 2;
        for (let i = 0; i < n; i++) this.needles.push({ born: t, a: r() * Math.PI * 2, e: lerp(1.6, 5.5, r()), len: lerp(0.6, 1.2, r()), amp: clamp(bh / 80, 0.35, 1) });
        if (this.needles.length > 12) this.needles.splice(0, this.needles.length - 12);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.06) : k(0.4));
      // The drain's speed takes the bass slowly: the eye's size may thump with
      // the kick, but the whole sheet surging on every beat is a global jolt.
      this.bassSlow = (this.bassSlow || 0) + (bass - (this.bassSlow || 0)) * k(0.6);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
    },

    // The flood of ink and the wear, generated once per canvas size in device
    // pixels (as V1), plus the hatch pattern at device resolution.
    makeTextures(p, g, dev, u) {
      const w = p.width * p.pixelDensity(), h = p.height * p.pixelDensity();
      const key = w + 'x' + h + ':' + g.name;
      if (this.texKey === key) return;
      this.texKey = key;
      const r = mulberry(11);
      const sc = Math.min(w, h) / 600;
      const flood = document.createElement('canvas');
      flood.width = w; flood.height = h;
      const f = flood.getContext('2d');
      f.fillStyle = g.ground; f.fillRect(0, 0, w, h);
      f.filter = 'blur(' + Math.round(18 * sc) + 'px)';
      for (let i = 0; i < 260; i++) {
        const x = r() * w, y = r() * h, rad = (40 + r() * 130) * sc;
        f.fillStyle = r() < 0.55 ? 'rgba(70,10,35,0.045)' : 'rgba(255,240,240,0.05)';
        f.beginPath(); f.ellipse(x, y, rad, rad * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2); f.fill();
      }
      f.filter = 'none';
      for (let i = 0; i < 70; i++) {
        const y = r() * h;
        f.fillStyle = r() < 0.5 ? 'rgba(60,0,25,0.035)' : 'rgba(255,245,240,0.04)';
        f.fillRect(0, y, w, (2 + r() * 10) * sc);
      }
      for (let i = 0; i < 1600; i++) {
        f.fillStyle = 'rgba(60,10,30,' + (0.06 + r() * 0.14).toFixed(3) + ')';
        f.fillRect(r() * w, r() * h, Math.max(1, sc * r() * 1.3), Math.max(1, sc * r() * 1.3));
      }
      const wear = document.createElement('canvas');
      wear.width = w; wear.height = h;
      const q = wear.getContext('2d');
      q.fillStyle = PAPER;
      for (let i = 0; i < 2800; i++) {
        q.globalAlpha = 0.2 + r() * 0.5;
        const s = sc * (0.5 + r() * r() * 2.2);
        q.fillRect(r() * w, r() * h, s, s);
      }
      q.globalAlpha = 0.06;
      q.strokeStyle = PAPER; q.lineWidth = Math.max(1, sc * 0.8);
      for (let i = 0; i < 120; i++) {
        const y = r() * h, x = r() * w, l = (40 + r() * 240) * sc;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + l, y + (r() - 0.5) * 3 * sc); q.stroke();
      }
      q.globalAlpha = 1;
      this.flood = flood; this.wear = wear;
      // BLAST stripes: a pattern tile drawn at device resolution and scaled back
      // down, because a pattern made in virtual units blurs under the stage scale.
      const tile = Math.max(4, Math.round(9 * u * dev));
      const pc = document.createElement('canvas');
      pc.width = tile; pc.height = tile;
      const pq = pc.getContext('2d');
      pq.fillStyle = BLACK;
      pq.beginPath();
      pq.moveTo(0, 0); pq.lineTo(tile * 0.5, 0); pq.lineTo(0, tile * 0.5); pq.closePath(); pq.fill();
      pq.beginPath();
      pq.moveTo(tile, 0); pq.lineTo(tile, tile * 0.5); pq.lineTo(tile * 0.5, tile); pq.lineTo(0, tile); pq.closePath(); pq.fill();
      this.hatchTile = pc; this.hatchDev = dev;
      this.layer = document.createElement('canvas');
      this.layer.width = w; this.layer.height = h;
    },

    draw(p, signals, params, ctx) {
      if (!this.prev) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const u = S / 600;
      const G = GROUNDS[clamp(Math.round(params.ground), 0, GROUNDS.length - 1)];
      const react = params.reaction;
      const c = p.drawingContext;
      const M = c.getTransform();
      const dev = Math.hypot(M.a, M.b);

      this.analyse(signals, t, dt, react);
      if (!this.dense && this.low > 27) this.dense = true;
      else if (this.dense && this.low < 19) this.dense = false;
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.dropPres += ((this.dense ? 1 : 0) - this.dropPres) * k(this.dense ? 0.5 : 1.4);

      // The look. With Follow on, the track pushes each drop param from where
      // the performer set it toward its drop value; with it off, params alone.
      const follow = Math.round(params.follow) === 1;
      const A = follow ? this.dropPres : 0;
      const build = follow ? clamp(this.energy * 1.1 - 0.15, 0, 0.45) : 0;
      const inkEff = lerp(params.ink, 1, Math.max(A, build));
      const speedEff = params.speed * (1 + 0.5 * A);
      const twistEff = params.twist + 0.5 * A;
      const ochreEff = Math.max(params.ochre, A);
      const shoutEff = easeInOut(Math.max(params.shout, A));

      // The drain: one phase in rings, whose speed follows the bass, so the
      // music changes how fast it flows and never jerks it.
      const drive = 0.14 + 0.25 * this.energy + 0.32 * (this.bassSlow || 0) * (0.4 + 0.6 * react);
      this.phase += dt * speedEff * drive;
      this.spin += dt * 0.02 * (0.3 + speedEff);
      this.clock += dt;

      this.charges = this.charges.filter((f) => t - f.born < 0.8);
      this.needles = this.needles.filter((n) => t - n.born < 0.4);
      this.rings = this.rings.filter((v) => t - v.born < 0.55);

      this.makeTextures(p, G, dev, u);
      if (!this.hatch || this.hatchFor !== this.hatchTile) {
        this.hatch = c.createPattern(this.hatchTile, 'repeat');
        this.hatchFor = this.hatchTile;
      }
      this.hatch.setTransform(new DOMMatrix().scale(1 / this.hatchDev));

      c.save();
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(this.flood, 0, 0);
      c.restore();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.lineJoin = 'miter'; c.lineCap = 'butt';

      // --- The eye wanders on a slow Lissajous in the upper sheet: the clock
      // slower than the song, so minute five is not minute one.
      const ex = W * (0.665 + 0.055 * Math.sin(this.clock * 2 * Math.PI / 171)) ;
      const ey = H * 0.33 + S * 0.04 * Math.sin(this.clock * 2 * Math.PI / 113 + 1);
      const Rmax = Math.hypot(Math.max(ex, W - ex), Math.max(ey, H - ey)) * 1.12;
      const er = (24 + 10 * this.bassEnv * (0.5 + 0.5 * react)) * u;
      const rMin = er * 0.55;
      const nR = Math.ceil(Math.log(Rmax / rMin) / LQ) + 2;
      const kb = -Math.floor(this.phase) - 1;
      const seed = this.seed | 0;
      const dA = Math.PI * 2 / ARMS;

      // Nodes: (nR + 2) rings by ARMS + 1 arms (the last repeats the first).
      const nodes = this.nodes && this.nodes.length === (nR + 2) * (ARMS + 1) * 3 ? this.nodes : (this.nodes = new Float32Array((nR + 2) * (ARMS + 1) * 3));
      for (let m = 0; m < nR + 2; m++) {
        const kk = kb + m;
        for (let j = 0; j <= ARMS; j++) {
          const jj = j % ARMS;
          const jr = (hash(kk, jj, 1, seed) - 0.5) * 0.5;
          const ja = (hash(kk, jj, 2, seed) - 0.5) * 0.55 * dA;
          const e = kk + this.phase + jr;
          const r = Rmax * Math.exp(-LQ * e);
          const th = j * dA + twistEff * LQ * e + this.spin + ja;
          const o = (m * (ARMS + 1) + j) * 3;
          nodes[o] = ex + Math.cos(th) * r; nodes[o + 1] = ey + Math.sin(th) * r; nodes[o + 2] = e;
        }
      }

      // --- Cells. Class: 0 black, 1 dark, 2 light, 3 steel, 4 ochre,
      // 5 bare (ground, keyline only), 6 hatched, 7 paper (a kick's charge).
      const cells = this.cellBuf || (this.cellBuf = []);
      cells.length = 0;
      const push = (cls, inv, pts) => cells.push({ cls, inv, pts });
      const litFor = (kk, j, e) => {
        for (const ch of this.charges) {
          if (ch.arm !== j) continue;
          const a = clamp((t - ch.born) / 0.62, 0, 1);
          const front = lerp(5.4, nR - 1, easeInOut(a));
          const len = 1.2 * (0.6 + 0.4 * react);
          if (e <= front && e > front - len) return true;
        }
        return false;
      };
      const invFor = (kk, j) => {
        for (const v of this.rings) {
          if (v.k !== kk) continue;
          // The inversion wipes round the ring in a tenth of a second.
          if (t - v.born > (j / ARMS) * 0.1) return true;
        }
        return false;
      };
      for (let m = 0; m < nR + 1; m++) {
        const kk = kb + m;
        for (let j = 0; j < ARMS; j++) {
          const o00 = (m * (ARMS + 1) + j) * 3, o01 = o00 + 3;
          const o10 = ((m + 1) * (ARMS + 1) + j) * 3, o11 = o10 + 3;
          const eMid = (nodes[o00 + 2] + nodes[o10 + 2]) * 0.5;
          const rIn = Rmax * Math.exp(-LQ * (kk + 1 + this.phase));
          if (rIn < rMin) continue;
          const pts = [nodes[o00], nodes[o00 + 1], nodes[o01], nodes[o01 + 1], nodes[o11], nodes[o11 + 1], nodes[o10], nodes[o10 + 1]];
          const hc = hash(kk, j, 3, seed), hk = hash(kk, j, 4, seed), hs = hash(kk, j, 5, seed);
          const dark = DARK_ARMS.indexOf(j) >= 0;
          const pick = (hv) => (dark
            ? (hv < 0.58 ? 0 : hv < 0.78 ? 1 : hv < 0.88 ? 3 : hv < 0.95 ? 6 : 2)
            : (hv < 0.2 ? 0 : hv < 0.4 ? 1 : hv < 0.56 ? 2 : hv < 0.68 ? 3 : hv < 0.82 ? 4 : hv < 0.9 ? 6 : 5));
          // The dark arms keep some ink even in the calm, so the spiral
          // still reads when the rest of the sheet is only keylines.
          const inkHere = dark ? inkEff + 0.3 : inkEff;
          const resolve = (cls, keep, okeep) => {
            if (cls === 5 || keep >= inkHere) return 5;
            if (cls === 4 && okeep >= ochreEff) return 5;
            return cls;
          };
          const lit = litFor(kk, j, eMid);
          const inv = invFor(kk, j);
          if (lit) { push(7, inv, pts); continue; }
          // A third of the planes are split on a diagonal into two wedges in
          // different inks: Lewis's forms are wedges and blades, not tiles.
          if (hs < 0.36) {
            const diag = hs < 0.18;
            const a = diag ? [pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]] : [pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]];
            const b = diag ? [pts[4], pts[5], pts[6], pts[7], pts[0], pts[1]] : [pts[6], pts[7], pts[0], pts[1], pts[2], pts[3]];
            push(resolve(pick(hc), hk, hash(kk, j, 6, seed)), inv, a);
            push(resolve(pick(hash(kk, j, 7, seed)), hash(kk, j, 8, seed), hash(kk, j, 9, seed)), inv, b);
          } else {
            push(resolve(pick(hc), hk, hash(kk, j, 6, seed)), inv, pts);
          }
        }
      }

      const NORMAL = [BLACK, G.dark, G.light, STEEL, OCHRE, null, 'hatch', PAPER];
      // Inverse inks, for the snare's ring and inside the headline's letters.
      // No black here: inside the letters it would erode them into the slab.
      const INVERSE = [G.ground, PAPER, G.dark, G.ground, OCHRE, PAPER, G.ground, G.dark];
      const mrx = (1.6 + 0.6 * Math.sin(this.clock * 0.21)) * u, mry = (-1.1 + 0.5 * Math.cos(this.clock * 0.15)) * u;
      const paint = (cx, forceInv, keyline, keyW) => {
        const groups = new Map();
        for (const cl of cells) {
          const col = (forceInv || cl.inv ? INVERSE : NORMAL)[cl.cls];
          if (!col) continue;
          const key = col + (cl.cls === 4 ? '|o' : '');
          let g = groups.get(key);
          if (!g) { g = []; groups.set(key, g); }
          g.push(cl.pts);
        }
        for (const [key, list] of groups) {
          const col = key.split('|')[0];
          const ochre = key.endsWith('|o');
          if (ochre) { cx.save(); cx.translate(mrx, mry); }
          cx.beginPath();
          for (const pts of list) {
            cx.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]);
            cx.closePath();
          }
          cx.fillStyle = col === 'hatch' ? this.hatch : col;
          cx.fill();
          if (ochre) cx.restore();
        }
        // Keylines: every plane edge in one stroke.
        cx.beginPath();
        for (const cl of cells) {
          const pts = cl.pts;
          cx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]);
          cx.closePath();
        }
        cx.strokeStyle = keyline; cx.lineWidth = keyW; cx.stroke();
      };
      paint(c, false, G.dark, Math.max(1, 1.5 * u));

      // --- Hats: paper needles flicked along the spiral.
      c.strokeStyle = PAPER; c.lineCap = 'butt';
      const tanA = Math.atan2(-twistEff, 1);
      for (const n of this.needles) {
        const age = (t - n.born) / 0.4;
        const e = n.e + age * 0.6;
        const r = Rmax * Math.exp(-LQ * (e + (this.phase % 1)));
        const th = n.a + twistEff * LQ * e + this.spin;
        const dir = th + tanA + Math.PI;
        const sx = ex + Math.cos(th) * r, sy = ey + Math.sin(th) * r;
        const L = n.len * 0.35 * r * (1 - age * 0.5);
        c.lineWidth = Math.max(1, 3 * u * n.amp * (1 - age));
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + Math.cos(dir) * L, sy + Math.sin(dir) * L);
        c.stroke();
      }

      // --- The eye: nested blade-tipped squares, still at the centre of all
      // that motion. The outer one ratchets a notch on every kick.
      {
        const lk = clamp((t - this.notchAt) / 0.28, 0, 1);
        const notchA = (this.notchFrom + (this.notch - this.notchFrom) * easeLock(lk)) * (Math.PI / 8);
        const layers = [
          { r: er * 1.7, a: notchA, col: BLACK },
          { r: er * 1.2, a: -this.spin * 3 + 0.3, col: PAPER },
          { r: er * 0.9, a: this.spin * 5, col: BLACK },
          { r: er * 0.5, a: notchA * -2, col: G.ground },
          { r: er * 0.24, a: 0, col: BLACK },
        ];
        for (const L of layers) {
          c.save(); c.translate(ex, ey); c.rotate(L.a);
          c.fillStyle = L.col;
          c.beginPath();
          c.moveTo(-L.r, -L.r * 0.85); c.lineTo(L.r * 1.35, -L.r); c.lineTo(L.r, L.r * 0.9); c.lineTo(-L.r * 0.9, L.r);
          c.closePath(); c.fill();
          c.restore();
        }
      }

      // --- The slab and its stencilled headline.
      const HEAD = face('Alfa Slab One', 'Rockwell, "Courier New", serif');
      const BOLD = face('Archivo Black', '"Arial Black", Arial, sans-serif');
      const THIN = face('Oswald', '"Arial Narrow", Arial, sans-serif');
      const loud = String(params.headline || '').toUpperCase().trim() || 'ROAR';
      const quiet = String(params.quiet || '').toUpperCase().trim() || 'HUSH';
      const want = shoutEff >= 0.5 ? loud : quiet;
      if (this.word === null) this.word = want;
      if (want !== this.word) { this.oldWord = this.word; this.word = want; this.wipeAt = t; }
      const ang = -(8.5 + 4.5 * shoutEff + 0.8 * Math.sin(this.clock * 0.11)) * Math.PI / 180;
      const th = S * (0.22 + 0.05 * shoutEff);
      const ca = Math.cos(ang);
      c.font = '400 100px ' + HEAD;
      const capK = (c.measureText('H').actualBoundingBoxAscent || 70) / 100;
      // The slab is hung from the word's lower left corner, so however steep
      // it swings the headline's foot stays on the sheet.
      const capH = th * 0.8;
      const Px = W * 0.035, Py = H * 0.955 - (capH / 2) * ca - (capH / 2) * Math.sin(-ang) * 0.2;
      const leftX = 0, rightX = (W * 0.97 - Px) / ca;
      const layout = (word) => {
        c.font = '400 100px ' + HEAD;
        const w100 = Math.max(1, c.measureText(word).width);
        const fs = Math.min(th * 0.8 / capK, (W * 0.6 / ca) / w100 * 100);
        c.font = '400 ' + fs.toFixed(2) + 'px ' + HEAD;
        const letters = Array.from(word);
        const adv = letters.map((ch) => c.measureText(ch).width);
        return { fs, letters, adv, total: adv.reduce((a, b) => a + b, 0), base: fs * capK / 2 };
      };
      const cur = layout(this.word);
      const old = this.oldWord ? layout(this.oldWord) : null;
      const wipeDone = t - this.wipeAt > 0.25 + 0.07 * 8;
      if (wipeDone) this.oldWord = null;
      const setLetters = (cx, L, dir) => {
        cx.font = '400 ' + L.fs.toFixed(2) + 'px ' + HEAD;
        cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
        let x = leftX;
        for (let i = 0; i < L.letters.length; i++) {
          // Each letter drops in (or out) of the slab in turn, left to right,
          // like sorts being changed in a forme.
          let off = 0;
          if (!wipeDone) {
            const a = easeInOut(clamp((t - this.wipeAt - i * 0.07) / 0.25, 0, 1));
            off = dir > 0 ? (1 - a) * -th : a * th;
          }
          cx.fillText(L.letters[i], x, L.base + off);
          x += L.adv[i];
        }
      };
      const slabFrame = (cx) => { cx.translate(Px, Py); cx.rotate(ang); };
      c.save();
      slabFrame(c);
      c.fillStyle = BLACK;
      c.fillRect(-W * 2, -th / 2, W * 4, th);
      c.restore();
      // The letters are a mask on an offscreen layer; the vortex is repainted
      // into it in inverse inks, so the word is cut from the vortex itself.
      {
        const L = this.layer.getContext('2d');
        L.setTransform(1, 0, 0, 1, 0, 0);
        L.globalCompositeOperation = 'source-over';
        L.clearRect(0, 0, this.layer.width, this.layer.height);
        L.setTransform(M);
        L.save();
        slabFrame(L);
        L.beginPath(); L.rect(-W * 2, -th / 2 + 2 * u, W * 4, th - 4 * u); L.clip();
        L.fillStyle = '#fff';
        setLetters(L, cur, 1);
        if (old && !wipeDone) setLetters(L, old, -1);
        L.restore();
        L.globalCompositeOperation = 'source-atop';
        L.fillStyle = PAPER; L.fillRect(0, 0, W, H);
        paint(L, true, G.dark, Math.max(1, 1.2 * u));
        L.globalCompositeOperation = 'source-over';
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(this.layer, 0, 0);
        c.restore();
      }
      // The line beside the word and the small print, in paper on the slab.
      {
        const sub = String(params.subline || '').toUpperCase().trim();
        const x0 = leftX + cur.total + 18 * u;
        const room = rightX - x0;
        c.save();
        slabFrame(c);
        c.fillStyle = PAPER; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        if (sub && room > 60 * u) {
          c.font = '400 100px ' + BOLD;
          const ss = Math.min(room / Math.max(1, c.measureText(sub).width) * 100, th * 0.2);
          c.font = '400 ' + ss.toFixed(2) + 'px ' + BOLD;
          c.fillText(sub, x0, -th * 0.06);
          c.fillRect(x0, -th * 0.06 + ss * 0.28, Math.min(room, c.measureText(sub).width), Math.max(2, 4 * u));
          const txt = 'ALL NIGHT · ONE HUNDRED & TWENTY-FOUR TO THE MINUTE';
          c.font = '400 100px ' + THIN;
          const ts = Math.min(room / Math.max(1, c.measureText(txt).width) * 100, ss * 0.62);
          c.font = '400 ' + ts.toFixed(2) + 'px ' + THIN;
          c.fillText(txt, x0, -th * 0.06 + ss * 0.28 + ts * 1.35);
        }
        c.restore();
      }

      // --- The manifesto slip: one thing hailed and one scorned, set big
      // enough to read across a room, turning over every bar.
      {
        const man = String(params.manifesto || '').split('|');
        const hail = (man[0] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        const scorn = (man[1] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        const pw = clamp(W * 0.34, 190 * u, 300 * u), m = 11 * u, iw = pw - 2 * m;
        const px = 18 * u + (W > H * 1.2 ? W * 0.01 : 0), py = 16 * u;
        const hs = 30 * u, is = 21 * u;
        const ph = m + hs * 0.74 + 6 * u + 4 * u + is + 10 * u + 7 * u + hs * 0.74 + 6 * u + 4 * u + is + m + 2 * u;
        c.save();
        c.translate(px, py); c.rotate(-0.03);
        c.fillStyle = 'rgba(40,10,20,0.28)';
        c.fillRect(5 * u, 6 * u, pw, ph);
        c.fillStyle = PAPER; c.fillRect(0, 0, pw, ph);
        c.fillStyle = BLACK; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        const lk = easeLock(clamp((t - this.barAt) / 0.32, 0, 1));
        let y = m;
        const block = (head, list) => {
          c.font = '400 ' + hs.toFixed(2) + 'px ' + HEAD;
          y += hs * 0.74; c.fillText(head, m, y);
          const hw = c.measureText(head).width;
          c.fillRect(m + hw + 8 * u, y - hs * 0.3, iw - hw - 8 * u, 6 * u);
          y += 6 * u;
          c.fillRect(m, y, iw, 3 * u); y += 4 * u;
          if (list.length) {
            const item = list[((this.bar % list.length) + list.length) % list.length];
            const prevItem = list[((this.barFrom % list.length) + list.length) % list.length];
            c.save();
            c.beginPath(); c.rect(m, y, iw, is + 4 * u); c.clip();
            const fit = (s) => { c.font = '400 100px ' + BOLD; return Math.min(is, iw / Math.max(1, c.measureText(s).width) * 100); };
            const draw = (s, dy) => { c.font = '400 ' + fit(s).toFixed(2) + 'px ' + BOLD; c.fillText(s, m, y + is * 0.92 + dy); };
            if (lk < 1 && prevItem !== item) { draw(prevItem, -lk * (is + 6 * u)); draw(item, (1 - lk) * (is + 6 * u)); }
            else draw(item, 0);
            c.restore();
          }
          y += is + 10 * u;
        };
        block('HAIL', hail);
        c.fillRect(m, y - 6 * u, iw, 7 * u); y += 7 * u;
        block('SCORN', scorn);
        c.restore();
      }

      // Wear over everything.
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.wear, 0, 0);
      c.restore();
      c.restore();
    },
  });
})();
