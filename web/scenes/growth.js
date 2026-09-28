// Growth Rings — batch 06, "Things that grow" (harness/briefs/batch-06-ideas.md).
//
// Of the three growth systems the idea offers (differential growth, space
// colonisation, DLA frost) this is differential growth, with DLA's "fronts
// creep in from one side" folded into the kick and the tree-ring history the
// purist asked for. Why: it is the only one of the three that is in motion
// everywhere, all the time. A space-colonisation tree finishes its reach and
// then only its tips move; DLA frost is a still crystal with a moving rim. A
// differential-growth line keeps buckling along its whole length, so the eye
// always has somewhere to go, and its growth rate is a single continuous knob
// the bass can hold.
//
// Several closed ink lines (colonies) on paper. Every node repels nearby
// nodes, springs to its neighbours, and new nodes are inserted at a rate the
// music sets, so the line has to fold to fit: brain coral, lettuce, agate.
// Every few seconds, and on every snare, the current outline is stamped as a
// thin ring inside the shape, so each colony carries its own history like a
// tree's cross-section.
//
// Music, each in its own place:
//   kick   one bud: a burst of nodes pushed out at one point on one colony,
//          marked by a small ink ring, which buckles into a new lobe over the
//          next bar (only that colony, only that spot)
//   snare  prints a growth ring on the colonies, briefly in the accent ink
//   bass   growth rate (continuous) and the paper's travel speed
//   hats   fray the edge (jitter) and sparkle on the newest nodes
//   drop   a frenzy: growth rate up threefold, more colonies, the second ink
//          floods the fills, faster travel, more fray
//
// Why it never saturates or stalls: each colony has a node cap (and the scene
// a global cap, so the cost is bounded); a colony that reaches it rests,
// then recedes (its ink fades out, leaving a faint pencil ghost on the paper),
// and a new colony is seeded in the fresh paper ahead. The paper travels
// slowly left under the camera, so ghosts and old growth scroll away and the
// sheet is never full. Nodes are found through a uniform spatial hash, so a
// frame costs O(nodes), never O(nodes²).
//
// Plain Canvas 2D: flat fills, one ink line, a matte cast shadow. No glow.

(function () {
  const PAPERS = [
    // ground, grain, ink, shadow, calm fills, drop fills, accent
    { name: 'Coral on bone', ground: '#ECE5D5', grain: 'rgba(90,70,50,0.07)', ink: '#1D2033', shadow: 'rgba(70,45,30,0.16)', ghost: 'rgba(40,40,60,0.13)',
      calm: ['#EAC7B2', '#C7D3CC', '#E6D3AE'], drop: ['#E2583B', '#EE8A4E', '#C7384A'], accent: '#1F6F8B' },
    { name: 'Night reef', ground: '#0E1822', grain: 'rgba(200,220,255,0.035)', ink: '#EFE4CF', shadow: 'rgba(0,0,0,0.35)', ghost: 'rgba(220,210,190,0.10)',
      calm: ['#1B3140', '#20363A', '#23304A'], drop: ['#D9674A', '#E3A34F', '#B44A6A'], accent: '#E9C46A' },
    { name: 'Lichen', ground: '#DEDDCB', grain: 'rgba(60,70,40,0.07)', ink: '#262C1E', shadow: 'rgba(50,60,30,0.16)', ghost: 'rgba(40,50,30,0.13)',
      calm: ['#C6CCA6', '#D8C9A2', '#B5C6B8'], drop: ['#7F9E3F', '#C9A12E', '#4F7F5A'], accent: '#C4532D' },
    { name: 'Indigo print', ground: '#F3EEE3', grain: 'rgba(40,50,90,0.06)', ink: '#1C2A66', shadow: 'rgba(30,40,90,0.14)', ghost: 'rgba(30,40,100,0.12)',
      calm: ['#D6DCEE', '#EADCD6', '#D3E1E2'], drop: ['#3552B0', '#5A74C8', '#27408F'], accent: '#E0421F' },
  ];

  const PRESETS = {
    calm: { growth: 0.7, colonies: 4, drift: 0.45, ink: 0.12, fray: 0.25, rings: 0.6, frill: 1 },
    drop: { growth: 2.6, colonies: 6, drift: 1.3, ink: 1, fray: 0.8, rings: 0.6, frill: 1 },
    // Tight lettuce edges and full colour: the drop's cousin with finer folds.
    lettuce: { growth: 1.8, colonies: 5, drift: 0.8, ink: 0.7, fray: 0.5, rings: 0.4, frill: 0.35 },
    // Nearly still, rings dark: a fossil cross-section for a 5 a.m. breakdown.
    fossil: { growth: 0.15, colonies: 4, drift: 0.2, ink: 0, fray: 0, rings: 1, frill: 1.4 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['growth', 'colonies', 'drift', 'ink', 'fray'];

  const L = 4.2;                 // rest length of an edge, virtual units
  const MAX_TOTAL = 4200;        // global node cap: bounds the frame cost
  const RING_EVERY = 5;          // seconds between automatic growth rings
  const MAX_RINGS = 9;
  const MAX_GHOSTS = 14;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

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

  function hexRgb(h) {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mixHex(a, b, u) {
    const A = hexRgb(a), B = hexRgb(b);
    return `rgb(${Math.round(lerp(A[0], B[0], u))},${Math.round(lerp(A[1], B[1], u))},${Math.round(lerp(A[2], B[2], u))})`;
  }

  class Colony {
    constructor(x, y, r0, cap, tone, t, rng) {
      const n0 = Math.max(12, Math.round((Math.PI * 2 * r0) / L));
      this.size = cap + 64;
      this.xs = new Float32Array(this.size);
      this.ys = new Float32Array(this.size);
      this.born = new Float32Array(this.size);
      this.n = n0;
      for (let i = 0; i < n0; i++) {
        const a = (i / n0) * Math.PI * 2;
        const rr = r0 * (1 + 0.08 * (rng() - 0.5));
        this.xs[i] = x + Math.cos(a) * rr;
        this.ys[i] = y + Math.sin(a) * rr;
        this.born[i] = -10;
      }
      this.cap = cap;
      this.tone = tone;
      this.t0 = t;
      this.state = 0;        // 0 growing, 1 resting, 2 receding
      this.stateT = t;
      this.alpha = 0;        // fades in at birth, out when receding
      this.budget = 0;
      this.rings = [];       // { pts: Float32Array, t, snare }
      this.lastRing = t;
      this.bud = -1; this.budUntil = 0;
      this.cx = x; this.cy = y; this.rad = r0;
      this.minX = x - r0; this.maxX = x + r0;
      this.seed = rng() * 100;
    }

    insertAt(k, x, y, t) {
      // Insert a node after index k.
      const n = this.n;
      this.xs.copyWithin(k + 2, k + 1, n);
      this.ys.copyWithin(k + 2, k + 1, n);
      this.born.copyWithin(k + 2, k + 1, n);
      this.xs[k + 1] = x; this.ys[k + 1] = y; this.born[k + 1] = t;
      this.n = n + 1;
      if (this.bud > k) this.bud++;
    }

    removeAt(k) {
      const n = this.n;
      this.xs.copyWithin(k, k + 1, n);
      this.ys.copyWithin(k, k + 1, n);
      this.born.copyWithin(k, k + 1, n);
      this.n = n - 1;
      if (this.bud > k) this.bud--;
    }

    measure() {
      let sx = 0, sy = 0, mnx = 1e9, mxx = -1e9;
      const n = this.n;
      for (let i = 0; i < n; i++) {
        const x = this.xs[i];
        sx += x; sy += this.ys[i];
        if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      }
      this.cx = sx / n; this.cy = sy / n;
      let r = 0;
      for (let i = 0; i < n; i += 4) {
        const dx = this.xs[i] - this.cx, dy = this.ys[i] - this.cy;
        const d = dx * dx + dy * dy;
        if (d > r) r = d;
      }
      this.rad = Math.sqrt(r);
      this.minX = mnx; this.maxX = mxx;
    }

    snapshot(t, snare) {
      const n = this.n, step = 2;
      const m = Math.floor(n / step);
      const pts = new Float32Array(m * 2);
      for (let i = 0, j = 0; j < m; i += step, j++) { pts[j * 2] = this.xs[i]; pts[j * 2 + 1] = this.ys[i]; }
      this.rings.push({ pts, t, snare });
      if (this.rings.length > MAX_RINGS) this.rings.shift();
      this.lastRing = t;
    }

    path(c2, dx, dy) {
      const n = this.n, xs = this.xs, ys = this.ys;
      c2.moveTo(xs[0] + dx, ys[0] + dy);
      for (let i = 1; i < n; i++) c2.lineTo(xs[i] + dx, ys[i] + dy);
      c2.closePath();
    }
  }

  VIZ.register({
    id: 'growth',
    name: 'Growth Rings',
    order: 806,

    params: [
      { key: 'paper', label: 'Paper', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'growth', label: 'Growth rate', type: 'range', min: 0, max: 3, default: PRESETS.calm.growth, step: 0.01 },
      { key: 'frill', label: 'Fold size', type: 'range', min: 0.3, max: 1.6, default: PRESETS.calm.frill, step: 0.01 },
      { key: 'colonies', label: 'Colonies', type: 'range', min: 1, max: 6, default: PRESETS.calm.colonies, step: 0.01 },
      { key: 'drift', label: 'Travel', type: 'range', min: 0, max: 2, default: PRESETS.calm.drift, step: 0.01 },
      { key: 'ink', label: 'Second ink', type: 'range', min: 0, max: 1, default: PRESETS.calm.ink, step: 0.01 },
      { key: 'fray', label: 'Fray', type: 'range', min: 0, max: 1, default: PRESETS.calm.fray, step: 0.01 },
      { key: 'rings', label: 'Growth rings', type: 'range', min: 0, max: 1, default: PRESETS.calm.rings, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Growth Rings',
      technique: 'Canvas 2D differential growth: closed polylines whose nodes spring to their neighbours and repel every nearby node through a uniform spatial hash, with nodes inserted at a music-driven rate so the line must buckle; periodic and snare-triggered outline snapshots clipped inside each shape as growth rings; per-colony node caps with rest, recede and a pencil ghost; a slowly travelling sheet so new colonies seed in fresh paper; a section follower easing params toward the drop preset',
      brief: 'Ink coral growing on paper. A few closed lines fold and fold again as they grow, into brain coral, lettuce and agate, each filled with a flat tint, casting a soft matte shadow, and carrying its own history as thin growth rings stamped inside it like the cross-section of a tree. The sheet travels slowly left; colonies that reach their size rest, then recede to a faint pencil ghost, and new ones are seeded in the fresh paper ahead, so minute ten is a different reef. Each kick pushes out one bud at one spot on one colony, marked by a small ink ring, and you watch it buckle into a new lobe over the next bar; each snare prints a growth ring, briefly in the accent ink; the bass sets the growth rate and the travel; the hats fray the edge and sparkle on the newest growth. The drop is a frenzy: growth three times faster, more colonies, the second ink flooding the fills; the breakdown lets the lines relax and smooth.',
      lineage: [
        'Batch 06 idea 6, "Things that grow" (Purist). Chose differential growth over space colonisation and DLA frost because it moves along its whole length all the time, where a colonised tree and a frost crystal only move at their tips, and its growth rate is one continuous knob for the bass. DLA\'s idea of fronts arriving from different sides lives on in the kick buds landing on different colonies; the purist\'s tree-ring contours are the growth rings.',
        'Anders Hoff (inconvergent), differential growth; Nervous System\'s Floraform; brain coral and lettuce coral; tree cross-sections and agate. In the collection: Coral\'s reef morphology and Knit\'s accumulation.',
        'Presets: calm, drop, lettuce (fine folds in full colour), fossil (nearly still, rings dark).',
      ].join(' '),
    },

    setup() { this.init(); },
    enter(p, ctx) { if (!this.env) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        low: 0, dropOn: false, auto: 0, bass: 0, pad: 0, hat: 0,
        lastKick: -10, lastSnare: -10, lastSpawn: -10,
      };
      this.cols = [];
      this.ghosts = [];
      this.buds = [];
      this.camX = 0;
      this.kicks = 0;
      this.budTurn = 0;
      this.spawned = 0;
      this.grain = null;
      this.W = 0; this.H = 0;
      // Scratch arrays for the hash, grown on demand.
      this.gx = new Float32Array(MAX_TOTAL + 512);
      this.gy = new Float32Array(MAX_TOTAL + 512);
      this.fx = new Float32Array(MAX_TOTAL + 512);
      this.fy = new Float32Array(MAX_TOTAL + 512);
      this.own = new Int16Array(MAX_TOTAL + 512);
      this.loc = new Int32Array(MAX_TOTAL + 512);
      this.nxt = new Int32Array(MAX_TOTAL + 512);
      this.head = new Int32Array(4096);
      this.warm = false;
    },

    makeGrain() {
      // A tile of paper fibre and specks, drawn once and tiled under the
      // travelling sheet, so the paper visibly moves with the colonies.
      const S = 300;
      const cv = document.createElement('canvas');
      cv.width = S; cv.height = S;
      const g = cv.getContext('2d');
      const r = mulberry(77);
      g.fillStyle = '#000';
      for (let i = 0; i < 900; i++) {
        g.globalAlpha = 0.25 + r() * 0.6;
        const s = r() < 0.9 ? 0.7 : 1.4;
        g.fillRect(r() * S, r() * S, s, s);
      }
      g.lineWidth = 0.5;
      g.strokeStyle = '#000';
      for (let i = 0; i < 70; i++) {
        g.globalAlpha = 0.25 + r() * 0.35;
        const x = r() * S, y = r() * S, a = r() * Math.PI, l = 3 + r() * 9;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 3,
          x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      return cv;
    },

    spawn(t, W, H, first) {
      const rng = this.rng;
      let best = null, bestD = -1;
      for (let k = 0; k < 14; k++) {
        // Anywhere on the visible sheet, emptiest candidate wins, with a lean
        // toward the fresh paper on the right (seeding only on the right left
        // the trailing third of the sheet bare).
        const x = first ? this.camX + W * (0.18 + 0.64 * rng()) : this.camX + W * (0.1 + 0.85 * Math.sqrt(rng()));
        const y = H * (0.2 + 0.6 * rng());
        let dmin = 1e9;
        for (const c of this.cols) {
          const d = Math.hypot(c.cx - x, c.cy - y) - c.rad;
          if (d < dmin) dmin = d;
        }
        if (dmin > bestD) { bestD = dmin; best = [x, y]; }
      }
      if (!best || bestD < 45) return false;
      const cap = Math.round(760 + rng() * 560);
      const tone = (this.spawned = (this.spawned || 0) + 1) % 3;
      this.cols.push(new Colony(best[0], best[1], 7 + rng() * 5, cap, tone, t, rng));
      this.env.lastSpawn = t;
      return true;
    },

    listen(s, t, dt, react) {
      const e = this.env;
      let kick = false, snare = false;
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - e.lastKick > 0.22) { e.lastKick = t; kick = true; }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - e.lastSnare > 0.28) { e.lastSnare = t; snare = true; }
      this.prev.set(s);
      const bass = Math.max(s[0], s[1]) / 100;
      // Slow attack: growth should surge with the bass line, not jump on
      // every kick (the kick has its own, local event).
      e.bass = ease(e.bass, bass, bass > e.bass ? 4 : 1.5, dt);
      e.pad = ease(e.pad, (s[2] + s[3]) / 200, 1.2, dt);
      const hatNow = (s[6] + s[7] + s[8]) / 300;
      e.hat = ease(e.hat, hatNow, hatNow > e.hat ? 30 : 6, dt);
      // Section follower on the sidechained bass line (band 1), near-silent
      // outside the drop; hysteresis so a stray kick does not flip it.
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, snare };
    },

    onKick(t, W, react) {
      // One bud on one visible, growing colony, taking turns.
      const vis = this.cols.filter((c) => c.state === 0 && c.alpha > 0.5 &&
        c.cx - this.camX > 40 && c.cx - this.camX < W - 40);
      if (!vis.length) return;
      const c = vis[this.budTurn++ % vis.length];
      // Pick an outward-facing node: the farthest of a few random ones.
      let k = 0, bd = -1;
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(this.rng() * c.n);
        const d = Math.hypot(c.xs[i] - c.cx, c.ys[i] - c.cy);
        if (d > bd) { bd = d; k = i; }
      }
      const n = c.n;
      const burst = Math.round(6 + 8 * react);
      // Push the neighbourhood outward along its normal, then fill the
      // stretched edges with fresh nodes: a bump that must fold into a lobe.
      const kp = (k - 1 + n) % n, kn = (k + 1) % n;
      let nx = c.ys[kn] - c.ys[kp], ny = -(c.xs[kn] - c.xs[kp]);
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      // Orientation: make the normal point away from the centroid.
      if (nx * (c.xs[k] - c.cx) + ny * (c.ys[k] - c.cy) < 0) { nx = -nx; ny = -ny; }
      const span = 6;
      for (let j = -span; j <= span; j++) {
        const i = (k + j + n) % n;
        const w = Math.cos((j / span) * Math.PI * 0.5);
        c.xs[i] += nx * w * 3.5 * (0.6 + 0.4 * react);
        c.ys[i] += ny * w * 3.5 * (0.6 + 0.4 * react);
      }
      if (c.n + burst < c.size) {
        for (let b = 0; b < burst; b++) {
          const i = (k + ((b % 7) - 3) + c.n) % c.n;
          const i2 = (i + 1) % c.n;
          c.insertAt(i, (c.xs[i] + c.xs[i2]) / 2 + nx * 0.5, (c.ys[i] + c.ys[i2]) / 2 + ny * 0.5, t);
          if (i < k) k++;
        }
      }
      c.bud = k; c.budUntil = t + 1.6; c.budT = t;
      this.buds.push({ x: c.xs[k], y: c.ys[k], nx, ny, t });
      if (this.buds.length > 8) this.buds.shift();
    },

    simulate(t, dt, P, W, H, e, react) {
      const cols = this.cols;
      const R = L * (2.1 + 1.6 * P.frill);        // repulsion radius
      const R2 = R * R;
      // Total node count, and flat scratch copies for the hash.
      let N = 0;
      for (let ci = 0; ci < cols.length; ci++) N += cols[ci].n;
      if (N > this.gx.length) {
        const sz = N + 512;
        this.gx = new Float32Array(sz); this.gy = new Float32Array(sz);
        this.fx = new Float32Array(sz); this.fy = new Float32Array(sz);
        this.own = new Int16Array(sz); this.loc = new Int32Array(sz); this.nxt = new Int32Array(sz);
      }
      const gx = this.gx, gy = this.gy, fx = this.fx, fy = this.fy, own = this.own, loc = this.loc, nxt = this.nxt;
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      let g = 0;
      for (let ci = 0; ci < cols.length; ci++) {
        const c = cols[ci];
        c.off = g;
        for (let i = 0; i < c.n; i++, g++) {
          const x = c.xs[i], y = c.ys[i];
          gx[g] = x; gy[g] = y; own[g] = ci; loc[g] = i; fx[g] = 0; fy[g] = 0;
          if (x < mnx) mnx = x; if (x > mxx) mxx = x;
          if (y < mny) mny = y; if (y > mxy) mxy = y;
        }
      }
      if (!N) return;
      const cell = R;
      const gw = Math.floor((mxx - mnx) / cell) + 1, gh = Math.floor((mxy - mny) / cell) + 1;
      const cells = gw * gh;
      if (cells > this.head.length) this.head = new Int32Array(cells * 2);
      const head = this.head;
      head.fill(-1, 0, cells);
      for (let i = 0; i < N; i++) {
        const k = Math.floor((gx[i] - mnx) / cell) + Math.floor((gy[i] - mny) / cell) * gw;
        nxt[i] = head[k]; head[k] = i;
      }
      // Repulsion between every pair closer than R, except a node's own
      // neighbours along the line (those are held by the springs).
      const KR = 0.55;
      for (let i = 0; i < N; i++) {
        const xi = gx[i], yi = gy[i], oi = own[i], li = loc[i], ni = cols[oi].n;
        const cx = Math.floor((xi - mnx) / cell), cy = Math.floor((yi - mny) / cell);
        let ax = 0, ay = 0;
        const x0 = cx > 0 ? cx - 1 : 0, x1 = cx < gw - 1 ? cx + 1 : cx;
        const y0 = cy > 0 ? cy - 1 : 0, y1 = cy < gh - 1 ? cy + 1 : cy;
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            let j = head[xx + yy * gw];
            while (j !== -1) {
              if (j !== i) {
                const dx = xi - gx[j], dy = yi - gy[j];
                const d2 = dx * dx + dy * dy;
                if (d2 < R2 && d2 > 1e-6) {
                  let skip = false;
                  if (own[j] === oi) {
                    const dl = Math.abs(loc[j] - li);
                    skip = dl <= 1 || dl >= ni - 1;
                  }
                  if (!skip) {
                    const d = Math.sqrt(d2);
                    const f = (R - d) / R;
                    ax += (dx / d) * f; ay += (dy / d) * f;
                  }
                }
              }
              j = nxt[j];
            }
          }
        }
        fx[i] += ax * KR; fy[i] += ay * KR;
      }
      // Springs toward rest length along each line, plus a little smoothing
      // toward the neighbours' midpoint (more of it when growth is slow, so the
      // breakdown lets the line relax).
      const smooth = 0.05 + 0.12 * (1 - clamp(P.growth / 1.5, 0, 1));
      const jit = P.fray * (0.06 + 0.8 * e.hat * react) * 0.4;
      for (let ci = 0; ci < cols.length; ci++) {
        const c = cols[ci], n = c.n, off = c.off, xs = c.xs, ys = c.ys;
        for (let i = 0; i < n; i++) {
          const a = i === 0 ? n - 1 : i - 1, b = i === n - 1 ? 0 : i + 1;
          let ex = xs[b] - xs[i], ey = ys[b] - ys[i];
          let d = Math.sqrt(ex * ex + ey * ey) || 1e-3;
          const s = ((d - L) / d) * 0.25;
          fx[off + i] += ex * s; fy[off + i] += ey * s;
          fx[off + b] -= ex * s; fy[off + b] -= ey * s;
          fx[off + i] += ((xs[a] + xs[b]) * 0.5 - xs[i]) * smooth;
          fy[off + i] += ((ys[a] + ys[b]) * 0.5 - ys[i]) * smooth;
        }
        // Integrate, with a speed limit so a dense knot cannot explode, and a
        // soft floor and ceiling so the reef stays on the sheet.
        for (let i = 0; i < n; i++) {
          let mx = fx[off + i], my = fy[off + i];
          if (jit > 0) { mx += (this.rng() - 0.5) * jit; my += (this.rng() - 0.5) * jit; }
          const m = Math.hypot(mx, my);
          if (m > 1.2) { mx *= 1.2 / m; my *= 1.2 / m; }
          let y = ys[i] + my;
          if (y < 24) y += (24 - y) * 0.15;
          else if (y > H - 24) y -= (y - (H - 24)) * 0.15;
          xs[i] += mx; ys[i] = y;
        }
      }
    },

    grow(t, dt, P, e, react, total) {
      const rng = this.rng;
      // Nodes per second per colony: the bass carries it between beats.
      const rate = 24 * P.growth * (0.6 + 1.1 * e.bass * react + 0.3 * e.pad);
      let room = MAX_TOTAL - total;
      for (const c of this.cols) {
        c.measure();
        // Tidy: split over-long edges, merge crowded ones. Both keep the line
        // resolution even, so the springs stay stable.
        for (let i = 0; i < c.n; i++) {
          const b = (i + 1) % c.n;
          const d = Math.hypot(c.xs[b] - c.xs[i], c.ys[b] - c.ys[i]);
          if (d > L * 2.2 && c.n < c.size - 1 && room > 0) {
            c.insertAt(i, (c.xs[i] + c.xs[b]) / 2, (c.ys[i] + c.ys[b]) / 2, t); room--; i++;
          } else if (d < L * 0.3 && c.n > 16 && b !== 0) {
            c.removeAt(b);
          }
        }
        if (c.state !== 0) continue;
        c.budget += rate * dt;
        const grow = Math.min(Math.floor(c.budget), 24);
        c.budget -= grow;
        for (let k = 0; k < grow && room > 0 && c.n < c.size - 2; k++) {
          // Growth is uneven around the rim, which is what makes lobes: pick
          // the most vigorous of a few random edges on a slowly moving noise
          // field, or near the latest bud while it is fresh.
          let best = 0, bv = -1;
          const useBud = c.bud >= 0 && t < c.budUntil && rng() < 0.55;
          for (let tries = 0; tries < 3; tries++) {
            let i;
            if (useBud) i = (c.bud + Math.floor((rng() - 0.5) * 24) + c.n) % c.n;
            else i = Math.floor(rng() * c.n);
            const a = Math.atan2(c.ys[i] - c.cy, c.xs[i] - c.cx);
            const v = useBud ? rng() : this.p.noise(c.seed + Math.cos(a) * 1.3 + 3, Math.sin(a) * 1.3 + 3, t * 0.04);
            if (v > bv) { bv = v; best = i; }
          }
          const b = (best + 1) % c.n;
          const mx = (c.xs[best] + c.xs[b]) / 2, my = (c.ys[best] + c.ys[b]) / 2;
          c.insertAt(best, mx + (rng() - 0.5) * 0.3, my + (rng() - 0.5) * 0.3, t);
          room--;
        }
      }
    },

    lifecycle(t, dt, P, W, H) {
      const e = this.env;
      for (const c of this.cols) {
        if (c.state === 0) {
          c.alpha = Math.min(1, c.alpha + dt * 1.2);
          // Mature when full, or when it would outgrow a third of the sheet.
          if (c.n >= c.cap || c.rad > H * 0.34) { c.state = 1; c.stateT = t; c.snapshot(t, false); }
          else if (P.rings > 0.01 && t - c.lastRing > RING_EVERY) c.snapshot(t, false);
        } else if (c.state === 1) {
          if (t - c.stateT > 20) { c.state = 2; c.stateT = t; }
        } else {
          c.alpha = Math.max(0, c.alpha - dt / 12);
        }
      }
      // Receded colonies leave a pencil ghost; colonies gone off the left of
      // the sheet simply go.
      const keep = [];
      for (const c of this.cols) {
        const off = c.maxX < this.camX - 30;
        if (c.state === 2 && c.alpha <= 0) {
          const step = 3, m = Math.floor(c.n / step);
          const pts = new Float32Array(m * 2);
          for (let i = 0, j = 0; j < m; i += step, j++) { pts[j * 2] = c.xs[i]; pts[j * 2 + 1] = c.ys[i]; }
          this.ghosts.push({ pts, maxX: c.maxX, t });
          if (this.ghosts.length > MAX_GHOSTS) this.ghosts.shift();
        } else if (!off) keep.push(c);
      }
      this.cols = keep;
      this.ghosts = this.ghosts.filter((g) => g.maxX > this.camX - 20);
      // Seed new colonies in the fresh paper ahead while under the target.
      // Receding ones do not count, so the sheet is refilled as they go.
      const target = Math.round(P.colonies);
      let growing = 0, total = 0;
      for (const c of this.cols) { if (c.state === 0) growing++; total += c.n; }
      const gap = e.dropOn ? 1.2 : 3;
      if (growing < target && t - e.lastSpawn > gap && total < MAX_TOTAL - 300) this.spawn(t, W, H, false);
      // Too many for the budget: the oldest grower matures early.
      if (total > MAX_TOTAL - 100) {
        const g = this.cols.find((c) => c.state === 0);
        if (g) { g.state = 1; g.stateT = t; g.snapshot(t, false); }
      }
      // Too many alive (after the drop): the oldest resting ones recede.
      if (this.cols.filter((c) => c.state < 2).length > target + 2) {
        const r = this.cols.find((c) => c.state === 1);
        if (r) { r.state = 2; r.stateT = t; }
      }
      return total;
    },

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      this.p = p;
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const e = this.env;
      const react = params.reaction;
      const follow = Math.round(params.follow) === 1;
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      P.frill = params.frill; P.rings = params.rings;

      if (!this.warm) {
        // Start with a reef already established, not a blank sheet.
        this.warm = true;
        this.W = W; this.H = H;
        for (let k = 0; k < Math.round(params.colonies); k++) this.spawn(-30 + k, W, H, true);
        const Pw = Object.assign({}, P, { growth: 1.2, fray: 0.1 });
        const ew = { bass: 0.4, pad: 0.2, hat: 0 };
        for (let s = 0; s < 260; s++) {
          const tw = -30 + s / 60 * 3;
          this.grow(tw, 1 / 20, Pw, ew, 1, 0);
          this.simulate(tw, 1 / 60, Pw, W, H, ew, 1);
          for (const c of this.cols) {
            c.alpha = 1;
            if (s % 60 === 59) c.snapshot(tw, false);
          }
        }
        for (const c of this.cols) { c.lastRing = t; c.t0 = t; }
      }

      const hits = this.listen(signals, t, dt, react);
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.45, dt);
      if (hits.kick) this.onKick(t, W, react);
      if (hits.snare && P.rings > 0.01) {
        for (const c of this.cols) if (c.state === 0 && c.alpha > 0.5) c.snapshot(t, true);
      }

      this.camX += dt * P.drift * (5 + 9 * e.bass * react);
      const total = this.lifecycle(t, dt, P, W, H);
      this.grow(t, dt, P, e, react, total);
      this.simulate(t, dt, P, W, H, e, react);

      // ---- paint --------------------------------------------------------------
      const pap = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];
      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.setLineDash([]);
      c2.lineJoin = 'round';
      c2.lineCap = 'round';
      c2.fillStyle = pap.ground;
      c2.fillRect(-2, -2, W + 4, H + 4);

      // Paper grain, travelling with the sheet.
      if (!this.grain) this.grain = this.makeGrain();
      const dark = pap.ground.charCodeAt(1) < 0x38;   // '#0…'–'#3…' grounds
      c2.globalAlpha = dark ? 0.18 : 0.12;
      if (dark) c2.globalCompositeOperation = 'screen';
      c2.filter = 'none';
      const GS = 300;
      const gx0 = -((this.camX % GS) + GS) % GS;
      for (let x = gx0; x < W; x += GS) for (let y = 0; y < H; y += GS) c2.drawImage(this.grain, x, y, GS, GS);
      c2.globalCompositeOperation = 'source-over';
      c2.globalAlpha = 1;

      c2.save();
      c2.translate(-this.camX, 0);

      // Pencil ghosts of receded colonies.
      c2.strokeStyle = pap.ghost;
      c2.lineWidth = 0.8;
      for (const g of this.ghosts) {
        const a = clamp((t - g.t) / 3, 0, 1);
        c2.globalAlpha = a;
        const pts = g.pts;
        c2.beginPath();
        c2.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) c2.lineTo(pts[i], pts[i + 1]);
        c2.closePath();
        c2.stroke();
      }

      // Growth rings: earlier outlines left on the paper beneath the reef as
      // fine contours, so each colony carries its own history. (Clipped inside
      // the shape they vanished: the folded interior is only a tube wide.)
      if (P.rings > 0.01) {
        c2.strokeStyle = pap.ink;
        c2.lineWidth = 0.6;
        for (const c of this.cols) {
          if (c.alpha <= 0) continue;
          for (let r = 0; r < c.rings.length; r++) {
            const ring = c.rings[r];
            const depth = (r + 1) / c.rings.length;
            c2.globalAlpha = c.alpha * P.rings * (0.16 + 0.3 * depth) * clamp((t - ring.t) / 0.9, 0, 1);
            const pts = ring.pts;
            c2.beginPath();
            c2.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) c2.lineTo(pts[i], pts[i + 1]);
            c2.closePath();
            c2.stroke();
          }
        }
      }

      // Shadows first, all colonies, so a shadow never lies on a neighbour.
      c2.fillStyle = pap.shadow;
      for (const c of this.cols) {
        if (c.alpha <= 0) continue;
        c2.globalAlpha = c.alpha;
        c2.beginPath(); c.path(c2, 2.5, 3.5); c2.fill();
      }

      const inkAmt = clamp(P.ink, 0, 1);
      const lw = 1.25 + 0.5 * e.bass * react;
      for (const c of this.cols) {
        if (c.alpha <= 0) continue;
        c2.globalAlpha = c.alpha;
        // The second ink arrives unevenly: colonies take it in turn, so the
        // drop floods the reef colony by colony rather than all at once.
        const own = clamp(inkAmt * 1.25 - (c.tone * 0.12), 0, 1);
        c2.fillStyle = mixHex(pap.calm[c.tone], pap.drop[c.tone], own);
        c2.beginPath(); c.path(c2, 0, 0); c2.fill();

        // The line itself.
        c2.globalAlpha = c.alpha;
        c2.strokeStyle = pap.ink;
        c2.lineWidth = lw;
        c2.beginPath(); c.path(c2, 0, 0); c2.stroke();

        // Hats: the newest growth glints in the accent ink.
        const sp = P.fray * e.hat * react;
        if (sp > 0.02 && c.state === 0) {
          c2.fillStyle = pap.accent;
          for (let i = 0; i < c.n; i += 1) {
            const age = t - c.born[i];
            if (age > 0.7 || age < 0) continue;
            if (this.rng() > 0.5) continue;
            c2.globalAlpha = c.alpha * clamp(sp * 1.6, 0, 1) * (1 - age / 0.7);
            c2.beginPath();
            c2.arc(c.xs[i], c.ys[i], 1.3, 0, Math.PI * 2);
            c2.fill();
          }
        }
      }

      // Snare: the ring just printed shows in the accent ink over the reef for
      // a moment, then settles into the paper with the others.
      c2.strokeStyle = pap.accent;
      for (const c of this.cols) {
        const ring = c.rings[c.rings.length - 1];
        if (!ring || !ring.snare) continue;
        const u = (t - ring.t) / 0.9;
        if (u < 0 || u >= 1) continue;
        c2.globalAlpha = c.alpha * (1 - u) * 0.9;
        c2.lineWidth = 1.8 * (1 - u) + 0.5;
        const pts = ring.pts;
        c2.beginPath();
        c2.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) c2.lineTo(pts[i], pts[i + 1]);
        c2.closePath();
        c2.stroke();
      }

      // Kick buds: the stretch of line that just budded is inked over in the
      // accent, thick, and fades within a beat, so each kick is seen in one
      // place on one colony while the lobe it started keeps growing.
      c2.strokeStyle = pap.accent;
      for (const c of this.cols) {
        if (c.bud < 0 || c.budT === undefined) continue;
        const u = (t - c.budT) / 0.75;
        if (u < 0 || u >= 1) continue;
        const span = 16, n = c.n;
        c2.globalAlpha = c.alpha * (1 - u * u);
        c2.lineWidth = 3.4 * (1 - u) + lw;
        c2.beginPath();
        for (let j = -span; j <= span; j++) {
          const i = (c.bud + j + n) % n;
          if (j === -span) c2.moveTo(c.xs[i], c.ys[i]); else c2.lineTo(c.xs[i], c.ys[i]);
        }
        c2.stroke();
      }

      // Kick buds, the mark: a small ink ring opening at the spot, gone within a beat.
      for (const b of this.buds) {
        const age = t - b.t;
        if (age > 0.7) continue;
        const u = age / 0.7;
        c2.globalAlpha = (1 - u) * 0.85;
        c2.strokeStyle = pap.accent;
        c2.lineWidth = 2.2 * (1 - u) + 0.5;
        c2.beginPath();
        c2.arc(b.x + b.nx * 6, b.y + b.ny * 6, 4 + 22 * Math.sqrt(u), 0, Math.PI * 2);
        c2.stroke();
      }

      c2.restore();
      c2.restore();
    },
  });
})();
