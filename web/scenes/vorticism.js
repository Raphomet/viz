// Vorticism: a letterpress broadside in the manner of Wyndham Lewis's 1914
// review, for a night of dancing. The sheet is flooded in hot pink ink. On the
// right a vortex of hard-edged black, puce, steel and paper shards drains
// clockwise into a still black eye; the bottom left carries one enormous slab
// word on a rising diagonal; the top left is a pasted-on manifesto page of
// heavy rules that HAILs the things of the night and SCORNs the things that
// end it.
//
// Music, each in its own place:
//   kick   a flight of four big shards whirls in from one sector of the vortex
//          and is swallowed by the eye, which ratchets round one notch; the
//          sector advances by the golden angle, so the hits land all round
//   snare  one letter of the headline flips to pink in a black block
//   hats   black needles flick along the spiral, and fall out of it
//   bar    the pointing hand on the manifesto moves to the next line
//   bass   the drain's speed (the whole vortex flows faster), the eye's size
//   drop   ochre shards join the vortex, more shards come in, two black bars
//          slide in to frame the headline and it swings to a steeper, bigger
//          diagonal; the breakdown empties the vortex back to keylines
// Printed look: flat inks, a mottled flood, paper showing through the ink as
// worn specks, the ochre plate a hair out of register. No glow.

(function () {
  const GROUNDS = [
    { name: 'Blast pink', ground: '#DB4F85', dark: '#6E1740', light: '#EFE5D1', trap: '#DB4F85' },
    { name: 'Puce', ground: '#B25672', dark: '#4F1530', light: '#ECE0CB', trap: '#B25672' },
    { name: 'Raw paper', ground: '#E9DFC8', dark: '#6E1740', light: '#DB4F85', trap: '#E9DFC8' },
  ];
  const BLACK = '#171314';
  const STEEL = '#55606B';
  const OCHRE = '#C98F22';
  const PAPER = '#EFE6D2';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeLock = (u) => { const c1 = 1.6, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const GOLD = Math.PI * (3 - Math.sqrt(5));

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

  // A shard is four points in its own frame: x along the swirl, y across it.
  // Three families, after the forms in Lewis's drawings: long blades, slabs
  // with one sheared end, and wedges that come to a point.
  function makeShape(r) {
    const k = r();
    if (k < 0.4) {
      return { kind: 0, pts: [[-1.7, lerp(-0.05, 0.1, r())], [lerp(1.1, 1.8, r()), -lerp(0.12, 0.3, r())], [lerp(0.6, 1.3, r()), lerp(0.15, 0.32, r())], [-1.2, lerp(0.05, 0.14, r())]] };
    }
    if (k < 0.75) {
      const h = lerp(0.3, 0.55, r()), sh = lerp(-0.5, 0.5, r());
      return { kind: 1, pts: [[-1 + sh, -h], [1 + sh * 0.3, -h * lerp(0.7, 1.2, r())], [lerp(0.8, 1.3, r()), h], [-1.1, h * lerp(0.6, 1, r())]] };
    }
    return { kind: 2, pts: [[-1.3, 0], [lerp(0.2, 0.8, r()), -lerp(0.4, 0.7, r())], [1.3, lerp(-0.1, 0.1, r())], [lerp(-0.2, 0.5, r()), lerp(0.3, 0.6, r())]] };
  }

  VIZ.register({
    id: 'vorticism',
    name: 'Vorticism',
    order: 506,

    params: [
      { key: 'headline', label: 'Headline', type: 'text', default: 'ROAR' },
      { key: 'subline', label: 'Under the headline', type: 'text', default: 'OF THE NIGHT MACHINE' },
      { key: 'manifesto', label: 'Hail | Scorn', type: 'text', default: 'THE KICK DRUM, THE BASS BIN, THE LAST TRAIN | THE HOUSE LIGHTS, THE COLD DAWN, THE QUIET ROOM' },
      { key: 'ground', label: 'Ground ink', type: 'select', options: GROUNDS.map((g) => g.name), default: 0 },
      { key: 'twist', label: 'Vortex twist', type: 'range', min: 0, max: 3, default: 1.25, step: 0.01 },
      { key: 'shards', label: 'Shards', type: 'range', min: 40, max: 260, default: 170, step: 1 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'motion', label: 'Drain speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reshard', label: 'Cut new shards', run() { this.wantReshard = true; } },
    ],

    gallery: {
      title: 'Vorticism',
      technique: 'Canvas 2D in flat letterpress inks on a generated flood texture: a few hundred hand-cut quadrilateral shards placed on an area-preserving logarithmic drain (radius = R·√u, angle = twist·ln(R/r)), so the centre spins fastest and the edges barely move; per-letter slab headline with a knockout trap and clipped snare inversions; onset detection per band',
      brief: 'A Vorticist broadside in hot pink, black and puce. A vortex of hard-edged machine shards (blades, sheared slabs, wedges, some hatched, some only keylines) drains into a still black eye on the right of the sheet, the outer shards barely drifting and the inner ones whirling. An enormous black slab word rises across the lower left on an aggressive diagonal, and a pasted-on manifesto page of heavy rules HAILs the kick drum and SCORNs the house lights, with a black pointing hand that moves down a line every bar. Each kick sends a flight of big shards whirling into the vortex from one sector, where the eye swallows them and ratchets round a notch; each snare flips one letter of the headline to pink in a black block; the hats flick black needles along the spiral. The bass sets how fast the whole drain flows. The drop brings in ochre shards and more of them, slides two black bars in to frame the headline and swings it bigger and steeper; the breakdown empties the vortex back to keylines and slows it to a crawl.',
      lineage: 'After Wyndham Lewis and the 1914-15 Vorticist review (its puce cover, its manifesto pages of huge grotesque and slab type set between heavy rules, its blast-and-bless lists) and Lewis\'s angular compositions of the same years (Workshop, The Crowd, the Timon plates), with Ezra Pound\'s definition of the vortex as the point of maximum energy. Wording is original: HAIL/SCORN lists about the night, ROAR as the headline. Process: read the batch brief and TASTE; chose an area-preserving drain so the kick-free drift stays small at the edges (the jolt meter counts every moving edge) and the energy concentrates at the eye, which is also the Vorticist idea; kick flights confined to one sector per beat; snare as a one-letter inversion so the two drums land in different places. Iterations at 640x360: the first cut had the manifesto slip overflowing its page and the headline cropped off the left edge, and the shards alone did not read as a vortex; the page is now measured before it is cut, the word and its subline are kept on the sheet at any tilt, and three dark spiral arms built from straight chords give the drain its structure while spinning slowly enough not to count as motion. Jolt meter (seed 1): calm, drop kickArea 0.16, ratio 1.41; build kick 0.19.',
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.shards) this.init(); },

    init() {
      this.seed = Math.floor(Math.random() * 1e9);
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.snareCount = 0;
      this.low = 0; this.dense = false;
      this.bassEnv = 0; this.energy = 0;
      this.phase = 0; this.spin = 0; this.drift = 0;
      this.flights = []; this.needles = []; this.inversions = [];
      this.notch = 0; this.notchAt = -10;
      this.dropPres = 0; this.fill = 0.5;
      this.lineIdx = 0; this.lineFrom = 0; this.lineAt = -10;
      this.texKey = ''; this.wantReshard = false;
      this.cut();
    },

    cut() {
      const r = mulberry(this.seed);
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      const shards = [];
      for (let i = 0; i < 260; i++) {
        const c = r();
        // Colour classes: 0 black, 1 dark puce, 2 light (paper), 3 steel,
        // 4 ochre (drop only).
        const col = c < 0.4 ? 0 : c < 0.55 ? 1 : c < 0.69 ? 2 : c < 0.8 ? 3 : 4;
        const st = r();
        shards.push({
          u0: r(), th0: r() * Math.PI * 2,
          rank: r(), size: lerp(0.55, 1.25, r()), tilt: (r() - 0.5) * 0.9,
          shape: makeShape(r), col,
          // style: 0 solid, 1 hatched, 2 keyline only
          style: st < 0.72 ? 0 : st < 0.86 ? 1 : 2,
          keep: r(), // below the breakdown's fill level it stays solid
        });
      }
      this.shards = shards;
    },

    analyse(s, t, dt, params) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++;
        const sector = this.kickCount * GOLD;
        const n = this.dense ? 4 : 3;
        for (let i = 0; i < n; i++) {
          this.flights.push({
            born: t, a: sector + (i - (n - 1) / 2) * 0.22, r0: lerp(0.78, 1, (i * 0.37) % 1),
            shape: makeShape(mulberry(this.kickCount * 31 + i)),
            col: i % 2 === 0 ? 2 : (this.dense && i === 3 ? 4 : 2),
            size: 1 - i * 0.12, delay: i * 0.035,
          });
        }
        if (this.flights.length > 16) this.flights.splice(0, this.flights.length - 16);
        this.notchFrom = this.notch; this.notch++; this.notchAt = t;
        if (this.kickCount % 4 === 1) { this.lineFrom = this.lineIdx; this.lineIdx++; this.lineAt = t; }
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t;
        this.inversions.push({ born: t, idx: this.snareCount++ });
        if (this.inversions.length > 2) this.inversions.shift();
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t;
        const r = mulberry(Math.floor(t * 1000));
        for (let i = 0; i < 2; i++) this.needles.push({ born: t, a: r() * Math.PI * 2, rr: lerp(0.25, 0.75, r()), len: lerp(0.6, 1.2, r()), amp: clamp(bh / 80, 0.35, 1) });
        if (this.needles.length > 12) this.needles.splice(0, this.needles.length - 12);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.06) : k(0.4));
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
    },

    // The flood of ink and the wear, generated once per canvas size in device pixels.
    makeTextures(p, g) {
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
      // Uneven inking: soft blotches, a little darker and lighter, blurred so
      // they read as a flood that took the ink unevenly, not as spots.
      f.filter = 'blur(' + Math.round(18 * sc) + 'px)';
      for (let i = 0; i < 260; i++) {
        const x = r() * w, y = r() * h, rad = (40 + r() * 130) * sc;
        f.fillStyle = r() < 0.55 ? 'rgba(70,10,35,0.045)' : 'rgba(255,240,240,0.05)';
        f.beginPath(); f.ellipse(x, y, rad, rad * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2); f.fill();
      }
      f.filter = 'none';
      // Horizontal roller streaks: the inking roller's travel.
      for (let i = 0; i < 70; i++) {
        const y = r() * h;
        f.fillStyle = r() < 0.5 ? 'rgba(60,0,25,0.035)' : 'rgba(255,245,240,0.04)';
        f.fillRect(0, y, w, (2 + r() * 10) * sc);
      }
      for (let i = 0; i < 1600; i++) {
        f.fillStyle = 'rgba(60,10,30,' + (0.06 + r() * 0.14).toFixed(3) + ')';
        f.fillRect(r() * w, r() * h, Math.max(1, sc * r() * 1.3), Math.max(1, sc * r() * 1.3));
      }
      // Wear: paper through the ink, specks and dry drags, over everything.
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
    },

    draw(p, signals, params, ctx) {
      if (!this.shards) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height, S = Math.min(W, H);
      const u = S / 600;
      const G = GROUNDS[clamp(Math.round(params.ground), 0, GROUNDS.length - 1)];
      const react = params.reaction, motion = params.motion;
      if (this.wantReshard) { this.wantReshard = false; this.cut(); }

      this.analyse(signals, t, dt, params);
      if (!this.dense && this.low > 27) this.dense = true;
      else if (this.dense && this.low < 19) this.dense = false;
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.dropPres += ((this.dense ? 1 : 0) - this.dropPres) * k(this.dense ? 0.4 : 1.2);
      // How much of the vortex is solid ink: full in the drop, thinning to
      // keylines in the breakdown and the quiet intro.
      const fillTarget = clamp(0.35 + 0.65 * Math.max(this.dropPres, this.energy * 1.4), 0, 1);
      this.fill += (fillTarget - this.fill) * k(1.5);

      // The drain. Everything in the vortex is a function of one phase, whose
      // speed follows the bass: the music changes how fast it flows, never
      // jerks it.
      const drive = 0.18 + 0.7 * this.energy + 0.9 * this.bassEnv * (0.4 + 0.6 * react);
      this.phase += dt * motion * 0.028 * drive;
      this.spin += dt * motion * 0.012 * (0.4 + drive);
      this.drift += dt;

      this.flights = this.flights.filter((f) => t - f.born < 0.9);
      this.needles = this.needles.filter((n) => t - n.born < 0.4);
      this.inversions = this.inversions.filter((v) => t - v.born < 0.42);

      const c = p.drawingContext;
      this.makeTextures(p, G);
      c.save();
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(this.flood, 0, 0);
      c.restore();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.lineJoin = 'miter'; c.lineCap = 'butt';

      const colOf = (ci) => (ci === 0 ? BLACK : ci === 1 ? G.dark : ci === 2 ? G.light : ci === 3 ? STEEL : OCHRE);

      // --- The vortex.
      const ex = W * 0.71, ey = H * 0.36;
      const R = Math.hypot(Math.max(ex, W - ex), Math.max(ey, H - ey)) + 90 * u;
      const K = params.twist;
      const shownN = params.shards / 260 * lerp(0.62, 1, this.dropPres);
      const pathShard = (sx, sy, dir, s, pts) => {
        const ca = Math.cos(dir), sa = Math.sin(dir);
        c.beginPath();
        for (let j = 0; j < 4; j++) {
          const px = pts[j][0] * s, py = pts[j][1] * s;
          const X = sx + ca * px - sa * py, Y = sy + sa * px + ca * py;
          if (j === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
        }
        c.closePath();
      };
      const hatch = (sx, sy, dir, s, col) => {
        c.save(); c.clip();
        c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.07);
        const ca = Math.cos(dir + 0.9), sa = Math.sin(dir + 0.9);
        c.beginPath();
        for (let q = -2; q <= 2; q += 0.2) {
          const ox = sx + -sa * q * s, oy = sy + ca * q * s;
          c.moveTo(ox - ca * 2 * s, oy - sa * 2 * s); c.lineTo(ox + ca * 2 * s, oy + sa * 2 * s);
        }
        c.stroke(); c.restore();
      };
      // Ochre sits on its own plate, a hair out of register.
      const mrx = (1.6 + 0.6 * Math.sin(this.drift * 0.21)) * u, mry = (-1.1 + 0.5 * Math.cos(this.drift * 0.15)) * u;
      // Spiral arms in the dark ink: the structure the shards flow along.
      // Built from straight chords so they stay hard-edged, never a smooth curve.
      c.fillStyle = G.dark;
      for (let a = 0; a < 3; a++) {
        const a0 = a * Math.PI * 2 / 3 + 0.4;
        const hw = 0.11;
        const outer = [], inner = [];
        for (let lr = 0; lr < 4.3; lr += 0.62) {
          const r = R * Math.exp(-lr);
          const th = a0 + K * lr + this.spin;
          const w = hw * smooth(0, 0.8, lr) * (1 - smooth(3.4, 4.2, lr));
          outer.push([ex + Math.cos(th + w) * r, ey + Math.sin(th + w) * r]);
          inner.push([ex + Math.cos(th - w) * r, ey + Math.sin(th - w) * r]);
        }
        c.beginPath();
        outer.forEach((q, j) => (j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
        for (let j = inner.length - 1; j >= 0; j--) c.lineTo(inner[j][0], inner[j][1]);
        c.closePath(); c.fill();
      }
      const sorted = this.shards; // drawn in a fixed order so overlaps never flicker
      for (let i = 0; i < sorted.length; i++) {
        const sh = sorted[i];
        let pres = smooth(0, 0.04, shownN - sh.rank);
        if (sh.col === 4) pres *= this.dropPres;
        if (pres < 0.02) continue;
        let uu = (sh.u0 - this.phase) % 1; if (uu < 0) uu += 1;
        const r = R * Math.sqrt(uu);
        if (r < 14 * u) continue;
        const th = sh.th0 + K * Math.log(R / r) + this.spin;
        const sx = ex + Math.cos(th) * r, sy = ey + Math.sin(th) * r;
        const s = sh.size * pres * (7 * u + 0.2 * r) * smooth(14 * u, 60 * u, r);
        if (s < 1.2 * u) continue;
        const dir = th + Math.atan2(K, -1) + sh.tilt;
        const col = colOf(sh.col);
        const solid = sh.style === 2 ? false : sh.keep < this.fill + 0.15;
        if (sh.col === 4) { c.save(); c.translate(mrx, mry); }
        pathShard(sx, sy, dir, s, sh.shape.pts);
        if (solid) {
          c.fillStyle = col; c.fill();
          if (sh.style === 1) { pathShard(sx, sy, dir, s, sh.shape.pts); hatch(sx, sy, dir, s, sh.col === 0 ? G.ground : BLACK); }
        } else {
          c.strokeStyle = sh.col === 2 ? BLACK : col; c.lineWidth = Math.max(1, 2.2 * u); c.stroke();
        }
        if (sh.col === 4) c.restore();
      }

      // --- Hats: needles flicked along the spiral.
      c.strokeStyle = BLACK; c.lineCap = 'butt';
      for (const n of this.needles) {
        const age = (t - n.born) / 0.4;
        const r = S * 0.5 * n.rr;
        const th = n.a + K * Math.log(R / r) + this.spin;
        const dir = th + Math.atan2(K, -1);
        const sx = ex + Math.cos(th) * r, sy = ey + Math.sin(th) * r;
        const L = n.len * 70 * u * (1 - age * 0.5), off = age * 40 * u;
        c.lineWidth = Math.max(1, 2.6 * u * n.amp * (1 - age));
        c.beginPath();
        c.moveTo(sx + Math.cos(dir) * off, sy + Math.sin(dir) * off);
        c.lineTo(sx + Math.cos(dir) * (off + L), sy + Math.sin(dir) * (off + L));
        c.stroke();
      }

      // --- Kick: a flight of big shards whirling in from one sector.
      for (const f of this.flights) {
        const e0 = clamp((t - f.born - f.delay) / 0.75, 0, 1);
        if (e0 <= 0) continue;
        const e = easeInOut(e0);
        const r0 = S * 0.44 * f.r0;
        const r = Math.max(4 * u, r0 * (1 - e));
        const th = f.a + Math.min(3.2, (K + 0.6) * Math.log(r0 / r)) + this.spin;
        const sx = ex + Math.cos(th) * r, sy = ey + Math.sin(th) * r;
        const grow = smooth(0, 0.12, e0);
        const s = (0.3 + 0.7 * (r / r0)) * 60 * u * f.size * grow * (0.6 + 0.4 * react);
        if (s < 1) continue;
        const dir = th + Math.atan2(K + 0.6, -1);
        pathShard(sx, sy, dir, s, f.shape.pts);
        c.fillStyle = colOf(f.col); c.fill();
        c.strokeStyle = BLACK; c.lineWidth = Math.max(1, 1.8 * u); c.stroke();
      }

      // --- The eye: nested rotated squares, black, paper and ground. The
      // outer ring ratchets round a notch on every kick; the bass swells it.
      {
        const lk = clamp((t - this.notchAt) / 0.28, 0, 1);
        const notchA = ((this.notchFrom || 0) + (this.notch - (this.notchFrom || 0)) * easeLock(lk)) * (Math.PI / 8);
        const er = (38 + 14 * this.bassEnv * (0.5 + 0.5 * react)) * u;
        const layers = [
          { r: er * 1.9, a: notchA, col: BLACK },
          { r: er * 1.35, a: -this.spin * 3 + 0.3, col: G.light },
          { r: er * 1.0, a: this.spin * 6, col: BLACK },
          { r: er * 0.55, a: notchA * -2, col: G.ground },
          { r: er * 0.28, a: 0, col: BLACK },
        ];
        for (const L of layers) {
          c.save(); c.translate(ex, ey); c.rotate(L.a);
          c.fillStyle = L.col;
          c.beginPath();
          // A square with one corner pulled out: a blade-tipped rosette.
          c.moveTo(-L.r, -L.r * 0.85); c.lineTo(L.r * 1.35, -L.r); c.lineTo(L.r, L.r * 0.9); c.lineTo(-L.r * 0.9, L.r);
          c.closePath(); c.fill();
          c.restore();
        }
      }

      // --- The headline on its diagonal. The drop swings it bigger and steeper.
      const HEAD = face('Alfa Slab One', 'Rockwell, "Courier New", serif');
      const BOLD = face('Archivo Black', '"Arial Black", Arial, sans-serif');
      const THIN = face('Oswald', '"Arial Narrow", Arial, sans-serif');
      const word = String(params.headline || '').toUpperCase().trim() || 'ROAR';
      const dp = easeInOut(clamp(this.dropPres, 0, 1));
      const hAng = -(13 + 4 * dp + 1.2 * Math.sin(this.drift * 0.13)) * Math.PI / 180;
      const hx = W * lerp(0.41, 0.44, dp) - 20 * u, hy = H * lerp(0.82, 0.755, dp);
      const targetW = Math.min(W * 0.56, 640 * u) * lerp(1, 1.07, dp);
      c.font = '400 100px ' + HEAD;
      const w100 = Math.max(1, c.measureText(word).width);
      const fs = Math.min(targetW / w100 * 100, 300 * u);
      // Keep the word's left foot on the sheet however steep the diagonal gets.
      const hxx = Math.max(hx, 16 * u + Math.cos(hAng) * targetW / 2);
      // And the line under it on the sheet too: lift the whole diagonal if the
      // subline's lower left corner would run off the bottom edge.
      const sub = String(params.subline || '').toUpperCase();
      const estW = w100 * fs / 100;
      c.font = '400 100px ' + BOLD;
      const sw100 = Math.max(1, c.measureText(sub).width);
      const ss = Math.min(estW / sw100 * 100, 44 * u);
      const sy2 = fs * 0.12 + (dp > 0.01 ? 30 * u * dp : 0) + ss * 1.05;
      const lx = estW / 2 - sw100 * ss / 100, ly = sy2 + 6 * u;
      const low = hy + lx * Math.sin(hAng) + ly * Math.cos(hAng);
      const hyy = sub ? Math.min(hy, hy - (low - (H - 10 * u))) : hy;
      c.save();
      c.translate(hxx, hyy); c.rotate(hAng);
      // Drop: two black bars slide in along the diagonal to frame the word.
      if (dp > 0.01) {
        const slide = (1 - dp) * W * 1.2;
        c.fillStyle = BLACK;
        c.fillRect(-W * 0.9 + slide, -fs * 0.86, W * 1.8, 16 * u);
        c.fillRect(-W * 0.9 - slide, fs * 0.12, W * 1.8, 30 * u);
      }
      c.font = '400 ' + fs.toFixed(2) + 'px ' + HEAD;
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      const letters = Array.from(word);
      const adv = letters.map((ch) => c.measureText(ch).width);
      const total = adv.reduce((a, b) => a + b, 0);
      let x = -total / 2;
      const capH = fs * 0.72;
      for (let i = 0; i < letters.length; i++) {
        const ch = letters[i];
        c.lineWidth = 9 * u; c.strokeStyle = G.trap;
        c.strokeText(ch, x, 0);
        c.fillStyle = BLACK; c.fillText(ch, x, 0);
        for (const v of this.inversions) {
          if (v.idx % letters.length !== i || ch === ' ') continue;
          const a = (t - v.born);
          const up = clamp(a / 0.05, 0, 1), down = clamp((a - 0.2) / 0.2, 0, 1);
          const top = -capH * 1.12 * up, bot = -capH * 1.12 * down + 0.1 * fs;
          if (bot - top < 1) continue;
          c.save();
          c.beginPath(); c.rect(x - 4 * u, top, adv[i] + 8 * u, bot - top + 0.06 * fs); c.clip();
          c.fillStyle = BLACK; c.fillRect(x - 4 * u, top - 10, adv[i] + 8 * u, bot - top + fs);
          c.fillStyle = G.name === 'Raw paper' ? G.light : G.ground;
          c.fillText(ch, x, 0);
          c.restore();
        }
        x += adv[i];
      }
      // The line under it, set in heavy grotesque, flush with the word.
      if (sub) {
        c.font = '400 ' + ss.toFixed(2) + 'px ' + BOLD;
        c.lineWidth = 6 * u; c.strokeStyle = G.trap;
        c.textAlign = 'right';
        c.strokeText(sub, total / 2, sy2);
        c.fillStyle = BLACK; c.fillText(sub, total / 2, sy2);
      }
      c.restore();

      // --- The manifesto page, pasted on at a slight tilt.
      {
        const man = String(params.manifesto || '').split('|');
        const hail = (man[0] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        const scorn = (man[1] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        const pw = clamp(W * 0.28, 175 * u, 290 * u), px = 20 * u + (W > H * 1.2 ? W * 0.015 : 0), py = 18 * u;
        const m = 12 * u, iw = pw - 2 * m;
        const fit = (txt, fam, max, room = iw) => {
          c.font = '400 100px ' + fam;
          const w = Math.max(1, c.measureText(txt).width);
          return Math.min(room / w * 100, max);
        };
        // Two passes: the first only measures, so the page is cut to fit its
        // type, as a compositor would size a pasted slip.
        let y = 0, ink = false;
        const items = [];
        const rule = (h) => { if (ink) c.fillRect(m, y, iw, h); y += h; };
        const text = (txt, x, yy) => { if (ink) c.fillText(txt, x, yy); };
        const kicker = 'BULLETIN OF THE DANCE-FLOOR VORTEX · No. 1';
        const block = (head, list) => {
          const hs = fit(head, HEAD, 46 * u);
          c.font = '400 ' + hs.toFixed(2) + 'px ' + HEAD;
          y += hs * 0.76; text(head, m, y); y += 7 * u;
          rule(3 * u); y += 2 * u;
          for (const it of list) {
            const is = fit(it, BOLD, 17 * u, iw - 24 * u);
            c.font = '400 ' + is.toFixed(2) + 'px ' + BOLD;
            y += is * 1.1;
            text(it, m + 24 * u, y);
            if (ink) items.push(y - is * 0.36);
            y += 3 * u;
          }
          y += 5 * u; rule(9 * u); y += 4 * u;
        };
        const layout = () => {
          y = m;
          const fsz = fit(kicker, THIN, 12 * u);
          c.font = '400 ' + fsz.toFixed(2) + 'px ' + THIN;
          y += fsz; text(kicker, m, y); y += 5 * u;
          rule(7 * u); y += 4 * u;
          block('HAIL', hail);
          block('SCORN', scorn);
          return y + m - 4 * u;
        };
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        const ph = layout();
        c.save();
        c.translate(px, py); c.rotate(-0.035);
        c.fillStyle = 'rgba(40,10,20,0.2)';
        c.fillRect(5 * u, 6 * u, pw, ph);
        c.fillStyle = PAPER; c.fillRect(0, 0, pw, ph);
        c.fillStyle = BLACK;
        ink = true; layout();
        // The pointing wedge: moves one line every bar.
        if (items.length) {
          const lk = clamp((t - this.lineAt) / 0.3, 0, 1);
          const fromY = items[((this.lineFrom % items.length) + items.length) % items.length];
          const toY = items[this.lineIdx % items.length];
          const wy = this.lineIdx % items.length === 0 && this.lineFrom % items.length !== 0 ? lerp(fromY, toY, easeInOut(lk)) : lerp(fromY, toY, easeLock(lk));
          c.beginPath();
          c.moveTo(m, wy - 7 * u); c.lineTo(m + 18 * u, wy); c.lineTo(m, wy + 7 * u); c.closePath();
          c.fillStyle = BLACK; c.fill();
        }
        c.restore();
      }

      // --- Small print in the bottom right corner.
      {
        const txt = 'ALL NIGHT · ONE HUNDRED & TWENTY-FOUR TO THE MINUTE';
        c.font = '400 ' + (11 * u).toFixed(2) + 'px ' + THIN;
        c.textAlign = 'right'; c.textBaseline = 'alphabetic';
        c.fillStyle = BLACK;
        c.fillRect(W - 18 * u - c.measureText(txt).width, H - 36 * u, c.measureText(txt).width, 4 * u);
        c.fillText(txt, W - 18 * u, H - 16 * u);
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
