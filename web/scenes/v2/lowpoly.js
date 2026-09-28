// Low Poly V2: a night poster of a humpback flying over a moonlit sea,
// rendered live as a triangulation whose polygon count is the music.
//
// V1 (web/scenes/lowpoly.js) drew a faceted whale over a dusk valley and the
// six-judge panel put it in the bottom twelve: nearly static, and the low-poly
// look worn as a costume ("the 2014 cliché", "a desktop wallpaper"). So here
// the triangulation is the process, not the finish. A smooth painting nobody
// sees (sky, moon, three ridgelines, a sea with its glade, the whales) is
// redrawn small every frame; what you see is a Delaunay mesh of moving points
// sampling it. Few points: shards. Many: the picture comes into focus. That
// polygon budget is what the music spends.
//
// The music lives in separate places:
//   kick   -> a tail stroke: the flukes flick and shed a wake of fresh
//             points whose facets catch the light and fade (confined to the
//             water behind the whale)
//   clap   -> the moon's facets re-deal their shades
//   hats   -> a sky vertex catches starlight: the facets round it glint
//   bass   -> swim depth and flight speed (the parallax layers and the
//             points riding them)
//   build  -> the riser creeps the budget up and an accent halo forms round
//             the moon: the image starts to resolve before the drop
//   drop   -> full resolution in about a bar, the calves arrive in the
//             mother's wake, the second ink prints; the breakdown drains the
//             points back to shards and the calves peel away
//
// Rendering: Canvas 2D. The painting is ~110 px on its short side and read
// back once a frame; the mesh is a sweep-hull Delaunay (after Delaunator) of
// up to ~1,800 points, which costs about a millisecond. Points are particles
// that ride the parallax speed of the layer they sit on, are importance-
// sampled toward the painting's edges, and are kept off the whales' outlines,
// where fixed structural points hold the silhouettes crisp at any budget.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c) => 'rgb(' + (clamp(c[0], 0, 255) | 0) + ',' + (clamp(c[1], 0, 255) | 0) + ',' + (clamp(c[2], 0, 255) | 0) + ')';
  const cssA = (c, a) => 'rgba(' + (clamp(c[0], 0, 255) | 0) + ',' + (clamp(c[1], 0, 255) | 0) + ',' + (clamp(c[2], 0, 255) | 0) + ',' + a.toFixed(3) + ')';

  function hash1(n) { const h = Math.sin(n * 127.1 + 11.3) * 43758.5453; return h - Math.floor(h); }
  function hash2(i, j) { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); }
  function vn1(x, s) {
    const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f);
    return lerp(hash2(i, s), hash2(i + 1, s), f);
  }
  // Angular ridges: sharp-crested value noise, so peaks read as peaks even
  // before the mesh cuts them into facets.
  function ridge(x, s) {
    const a = 1 - Math.abs(2 * vn1(x, s) - 1), b = 1 - Math.abs(2 * vn1(x * 2.3, s + 5) - 1);
    return 0.7 * a * a + 0.3 * b;
  }

  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  // Sweep-hull Delaunay triangulation, after Mapbox's Delaunator (ISC):
  // points sorted by distance from a seed circle, each added to a convex
  // hull and legalised by edge flips. Reused across frames, no allocation.
  function makeDelaunay() {
    const EPS = Math.pow(2, -52);
    const STACK = new Uint32Array(1024);
    const D = {
      cap: 0, tris: null, half: null, hPrev: null, hNext: null, hTri: null, hHash: null, ids: null, dists: null,
      hashSize: 0, cx: 0, cy: 0, hullStart: 0, len: 0, coords: null,
      ensure(n) {
        if (n <= this.cap) return;
        const cap = Math.ceil(n * 1.25) + 16;
        this.cap = cap;
        const mt = Math.max(2 * cap - 5, 0) * 3;
        this.tris = new Uint32Array(mt); this.half = new Int32Array(mt);
        this.hPrev = new Uint32Array(cap); this.hNext = new Uint32Array(cap); this.hTri = new Uint32Array(cap);
        this.ids = new Uint32Array(cap); this.dists = new Float64Array(cap);
        this.idArr = new Array(cap);
      },
      key(x, y) {
        const dx = x - this.cx, dy = y - this.cy;
        const p = dx / (Math.abs(dx) + Math.abs(dy) || 1);
        const a = (dy > 0 ? 3 - p : 1 + p) / 4;
        return Math.floor(a * this.hashSize) % this.hashSize;
      },
      link(a, b) { this.half[a] = b; if (b !== -1) this.half[b] = a; },
      add(i0, i1, i2, a, b, c) {
        const t = this.len;
        this.tris[t] = i0; this.tris[t + 1] = i1; this.tris[t + 2] = i2;
        this.link(t, a); this.link(t + 1, b); this.link(t + 2, c);
        this.len += 3;
        return t;
      },
      legalize(a) {
        const T = this.tris, H = this.half, C = this.coords;
        let i = 0, ar = 0;
        for (;;) {
          const b = H[a];
          const a0 = a - a % 3;
          ar = a0 + (a + 2) % 3;
          if (b === -1) { if (i === 0) break; a = STACK[--i]; continue; }
          const b0 = b - b % 3, al = a0 + (a + 1) % 3, bl = b0 + (b + 2) % 3;
          const p0 = T[ar], pr = T[a], pl = T[al], p1 = T[bl];
          if (inCircle(C[2 * p0], C[2 * p0 + 1], C[2 * pr], C[2 * pr + 1], C[2 * pl], C[2 * pl + 1], C[2 * p1], C[2 * p1 + 1])) {
            T[a] = p1; T[b] = p0;
            const hbl = H[bl];
            if (hbl === -1) {
              let e = this.hullStart;
              do { if (this.hTri[e] === bl) { this.hTri[e] = a; break; } e = this.hPrev[e]; } while (e !== this.hullStart);
            }
            this.link(a, hbl); this.link(b, H[ar]); this.link(ar, bl);
            const br = b0 + (b + 1) % 3;
            if (i < STACK.length) STACK[i++] = br;
          } else { if (i === 0) break; a = STACK[--i]; }
        }
        return ar;
      },
      // coords: flat [x0, y0, x1, y1, ...]; n points. Returns triangle count * 3 in this.len.
      run(coords, n) {
        this.ensure(n);
        this.coords = coords; this.len = 0;
        if (n < 3) return 0;
        const C = coords, hPrev = this.hPrev, hNext = this.hNext, hTri = this.hTri;
        this.hashSize = Math.ceil(Math.sqrt(n));
        if (!this.hHash || this.hHash.length < this.hashSize) this.hHash = new Int32Array(this.hashSize + 8);
        const hHash = this.hHash;
        for (let k = 0; k < this.hashSize; k++) hHash[k] = -1;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < n; i++) {
          const x = C[2 * i], y = C[2 * i + 1];
          if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
        const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
        let i0 = 0, i1 = -1, i2 = -1, md = Infinity;
        for (let i = 0; i < n; i++) { const d = sq(mx - C[2 * i], my - C[2 * i + 1]); if (d < md) { i0 = i; md = d; } }
        const i0x = C[2 * i0], i0y = C[2 * i0 + 1];
        md = Infinity;
        for (let i = 0; i < n; i++) { if (i === i0) continue; const d = sq(i0x - C[2 * i], i0y - C[2 * i + 1]); if (d < md && d > 0) { i1 = i; md = d; } }
        if (i1 < 0) return 0;
        let i1x = C[2 * i1], i1y = C[2 * i1 + 1];
        let minR = Infinity;
        for (let i = 0; i < n; i++) {
          if (i === i0 || i === i1) continue;
          const r = circumR(i0x, i0y, i1x, i1y, C[2 * i], C[2 * i + 1]);
          if (r < minR) { i2 = i; minR = r; }
        }
        if (i2 < 0 || minR === Infinity) return 0;
        let i2x = C[2 * i2], i2y = C[2 * i2 + 1];
        if (orient(i0x, i0y, i1x, i1y, i2x, i2y)) {
          const i = i1, x = i1x, y = i1y;
          i1 = i2; i1x = i2x; i1y = i2y; i2 = i; i2x = x; i2y = y;
        }
        const cc = circumC(i0x, i0y, i1x, i1y, i2x, i2y);
        this.cx = cc[0]; this.cy = cc[1];
        const ids = this.idArr, dists = this.dists;
        ids.length = n;
        for (let i = 0; i < n; i++) { ids[i] = i; dists[i] = sq(C[2 * i] - cc[0], C[2 * i + 1] - cc[1]); }
        ids.sort((a, b) => dists[a] - dists[b]);
        this.hullStart = i0;
        hNext[i0] = hPrev[i2] = i1; hNext[i1] = hPrev[i0] = i2; hNext[i2] = hPrev[i1] = i0;
        hTri[i0] = 0; hTri[i1] = 1; hTri[i2] = 2;
        hHash[this.key(i0x, i0y)] = i0; hHash[this.key(i1x, i1y)] = i1; hHash[this.key(i2x, i2y)] = i2;
        this.add(i0, i1, i2, -1, -1, -1);
        let xp = 0, yp = 0;
        for (let k = 0; k < n; k++) {
          const i = ids[k];
          const x = C[2 * i], y = C[2 * i + 1];
          if (k > 0 && Math.abs(x - xp) <= EPS && Math.abs(y - yp) <= EPS) continue;
          xp = x; yp = y;
          if (i === i0 || i === i1 || i === i2) continue;
          let start = 0;
          for (let j = 0, kk = this.key(x, y); j < this.hashSize; j++) {
            start = hHash[(kk + j) % this.hashSize];
            if (start !== -1 && start !== hNext[start]) break;
          }
          start = hPrev[start];
          let e = start, q;
          while (q = hNext[e], !orient(x, y, C[2 * e], C[2 * e + 1], C[2 * q], C[2 * q + 1])) {
            e = q;
            if (e === start) { e = -1; break; }
          }
          if (e === -1) continue;
          let t = this.add(e, i, hNext[e], -1, -1, hTri[e]);
          hTri[i] = this.legalize(t + 2);
          hTri[e] = t;
          let nn = hNext[e];
          while (q = hNext[nn], orient(x, y, C[2 * nn], C[2 * nn + 1], C[2 * q], C[2 * q + 1])) {
            t = this.add(nn, i, q, hTri[i], -1, hTri[nn]);
            hTri[i] = this.legalize(t + 2);
            hNext[nn] = nn;
            nn = q;
          }
          if (e === start) {
            while (q = hPrev[e], orient(x, y, C[2 * q], C[2 * q + 1], C[2 * e], C[2 * e + 1])) {
              t = this.add(q, i, e, -1, hTri[e], hTri[q]);
              this.legalize(t + 2);
              hTri[q] = t;
              hNext[e] = e;
              e = q;
            }
          }
          this.hullStart = hPrev[i] = e;
          hNext[e] = hPrev[nn] = i;
          hNext[i] = nn;
          hHash[this.key(x, y)] = i;
          hHash[this.key(C[2 * e], C[2 * e + 1])] = e;
        }
        return this.len;
      }
    };
    function sq(x, y) { return x * x + y * y; }
    function orient(px, py, qx, qy, rx, ry) { return (qy - py) * (rx - qx) - (qx - px) * (ry - qy) < 0; }
    function inCircle(ax, ay, bx, by, cx, cy, px, py) {
      const dx = ax - px, dy = ay - py, ex = bx - px, ey = by - py, fx = cx - px, fy = cy - py;
      const ap = dx * dx + dy * dy, bp = ex * ex + ey * ey, cp = fx * fx + fy * fy;
      return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) < 0;
    }
    function circumR(ax, ay, bx, by, cx, cy) {
      const dx = bx - ax, dy = by - ay, ex = cx - ax, ey = cy - ay;
      const bl = dx * dx + dy * dy, cl = ex * ex + ey * ey, d = 0.5 / (dx * ey - dy * ex);
      const x = (ey * bl - dy * cl) * d, y = (dx * cl - ex * bl) * d;
      return x * x + y * y;
    }
    function circumC(ax, ay, bx, by, cx, cy) {
      const dx = bx - ax, dy = by - ay, ex = cx - ax, ey = cy - ay;
      const bl = dx * dx + dy * dy, cl = ex * ex + ey * ey, d = 0.5 / (dx * ey - dy * ex);
      return [ax + (ey * bl - dy * cl) * d, ay + (dx * cl - ex * bl) * d];
    }
    return D;
  }


  // Palettes. Moonrise is the default because V1's pink dusk was the thing
  // the designer and curator called generic; Dusk keeps V1's colours.
  const PALETTES = [
    { name: 'Moonrise', skyTop: '#06071a', skyMid: '#1a1f55', skyLow: '#4a4f98', glow: '#c08aa4', cloud: '#2b3170',
      moon: '#f3ead3', moonShade: '#cfc4ad', far: '#3c4282', mid: '#1f2358', near: '#07081a', seaTop: '#343b7c',
      seaBot: '#06071a', glade: '#efe2c2', back: '#0b0c24', belly: '#c9c4e0', fin: '#dedaf0', accent: '#ff5a36',
      ink: '#f3ead3', deep: '#04040f' },
    { name: 'Dusk', skyTop: '#1a1740', skyMid: '#5b2a6e', skyLow: '#e2677a', glow: '#ffc58a', cloud: '#8a3f78',
      moon: '#ffe0a6', moonShade: '#ffa472', far: '#b0587c', mid: '#6e3169', near: '#1a1838', seaTop: '#f59a86',
      seaBot: '#1d3f5a', glade: '#fff0c8', back: '#22306a', belly: '#f2b3a2', fin: '#f8c9b8', accent: '#ffc24a',
      ink: '#fff0dc', deep: '#0f1233' },
    { name: 'Glacier', skyTop: '#2f6fa8', skyMid: '#6fb3dc', skyLow: '#cfe8f2', glow: '#fbf6ea', cloud: '#f4f8fb',
      moon: '#fffaf0', moonShade: '#f2e2c4', far: '#9cc6de', mid: '#5f93bd', near: '#1d3f66', seaTop: '#bfe2f0',
      seaBot: '#2d5f86', glade: '#ffffff', back: '#15294d', belly: '#dbe9f1', fin: '#eef5fa', accent: '#e8434f',
      ink: '#10254a', deep: '#0c1b33' },
    { name: 'Ember', skyTop: '#120b0e', skyMid: '#4a1218', skyLow: '#b8341d', glow: '#ff9a42', cloud: '#5e1818',
      moon: '#ffcf6b', moonShade: '#ff7a30', far: '#7a2418', mid: '#46130f', near: '#140809', seaTop: '#d85e28',
      seaBot: '#1a0d10', glade: '#ffe7a8', back: '#221316', belly: '#e87a3a', fin: '#f09a5a', accent: '#56d2c6',
      ink: '#ffe6c7', deep: '#0a0608' }
  ].map((q) => {
    const o = { name: q.name };
    for (const k in q) if (k !== 'name') { o[k] = hex(q[k]); o[k + 'Css'] = q[k]; }
    return o;
  });

  // Whale half-thickness above (TOP) and below (BOT) the spine, snout (s=0)
  // to the tail stock (s=1), as fractions of body length: a humpback's blunt
  // head, deep belly and long taper.
  const PS = [0, 0.04, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1];
  const TOP = [0.006, 0.055, 0.1, 0.122, 0.118, 0.1, 0.07, 0.04, 0.024, 0.018];
  const BOT = [0.006, 0.065, 0.125, 0.152, 0.145, 0.112, 0.074, 0.04, 0.024, 0.018];
  function prof(tab, s) {
    if (s <= 0) return tab[0];
    if (s >= 1) return tab[PS.length - 1];
    let k = 1; while (PS[k] < s) k++;
    return lerp(tab[k - 1], tab[k], (s - PS[k - 1]) / (PS[k] - PS[k - 1]));
  }

  const CAP = 2400;       // free particles
  const DROP_POLYS = 3200; // the budget Follow takes the drop to

  VIZ.register({
    id: 'lowpolyv2',
    name: 'Low Poly',
    versionOf: 'lowpoly',
    version: 'V2',
    order: 724,

    params: [
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['On', 'Off'], default: 0 },
      { key: 'polys', label: 'Polygons', type: 'range', min: 120, max: 3600, default: 560, step: 10 },
      { key: 'calves', label: 'Calves', type: 'range', min: 0, max: 2, default: 0, step: 1 },
      { key: 'ink', label: 'Second ink', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'flight', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'relief', label: 'Facet relief', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'title', label: 'Title', type: 'text', default: 'NIGHT SONG' }
    ],

    presets: {
      calm: { polys: 560, calves: 0, ink: 0, flight: 1 },
      drop: { polys: 3200, calves: 2, ink: 1, flight: 1.6 },
      shards: { polys: 140, calves: 0, ink: 0, flight: 0.6, relief: 1 },
      glass: { polys: 3600, calves: 1, ink: 0.4, flight: 2.2, relief: 0.25 }
    },

    actions: [
      { id: 'reseed', label: 'Re-cut the facets', run() { this.reseedReq = true; } }
    ],

    gallery: {
      title: 'Low Poly',
      technique: 'Canvas 2D: a small hidden painting redrawn each frame and read back; a live sweep-hull Delaunay mesh of up to ~1,800 moving, edge-importance-sampled points, each triangle flat-filled from the painting at its centroid with relief shading from the painting\'s own gradient; structural points pin the whales\' silhouettes and the moon\'s rim',
      brief: 'A night poster of a humpback flying over a moonlit sea, rendered live as a triangulation whose polygon count is the music. The intro is coarse shards; the build\'s riser adds facets and forms a halo round the moon; the drop brings the picture into full focus in about a bar, the calves arrive in their mother\'s wake and a second ink prints; the breakdown drains it back to shards. Kicks are tail strokes that shed a glinting wake of fresh facets; claps re-deal the moon\'s facets; hats light single star vertices; the bass sets the swim and the flight, with three ridgelines and the sea sliding past in parallax and the facets riding them. A crisp Bebas title, tracked captions, a chapter line and the live polygon count sit on top like a spec sheet.',
      lineage: 'V2 of Low Poly (lowpoly, batch 05), which ranked in the bottom 12 of 72 (mean 4.0). Acted on: the purist\'s live-mesh idea (points in a flow, added and removed with the music, so the image refines and coarsens) as the spine of the piece; the director\'s frozen whale (a readable swim cycle, a tail stroke on the kick, a 32 s banking path, calves that follow her wake in and peel off after); the psychonaut\'s and director\'s static camera (a sideways truck with parallax ridgelines); the designer\'s generic gradient and weak drop (a night palette with one vermilion second ink, and a drop that is an event: the picture snaps into focus); the curator\'s "doesn\'t change between sections" (shards, focus, full resolution, shards). Rejected: removing the title (it is the poster) and Koi Sky (a different scene). Kept from V1: the whale in the sky, flat facets and hard edges, the Bebas title and tracked captions, the calves. See harness/v2/lowpoly.md.'
    },

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.t = null;
      this.clock = 0;
      this.prev = new Float32Array(9);
      this.lastKick = -9; this.lastClap = -9; this.lastHat = -9;
      this.kickCount = 0; this.kickRate = 0; this.clapCount = 0;
      this.bassEnv = 0; this.hiEnv = 0; this.flick = 0;
      this.dropAmt = 0; this.build = 0; this.pod = 0; this.podLeaving = false;
      this.travel = 0; this.swim = 0; this.moonRot = 0;
      this.salt = 1 + Math.floor(Math.random() * 997);
      this.px = new Float32Array(CAP); this.py = new Float32Array(CAP);
      this.life = new Float32Array(CAP); this.pid = new Uint32Array(CAP);
      this.nFree = 0; this.nextId = 1;
      this.wake = [];
      this.coords = new Float64Array((CAP + 600) * 2);
      this.ids = new Uint32Array(CAP + 600);
      this.glow = new Float32Array(CAP + 600);
      this.del = makeDelaunay();
      this.shown = 0; this.seeded = false;
      this.chapter = 0; this.peak = 0;
    },

    // ------------------------------------------------------------ listening
    analyse(s, t, dt, react) {
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++; this.kickRate += 1;
        this.flick = 1;
        this.kickWake = true;
      }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - this.lastClap > 0.14) {
        this.lastClap = t; this.clapCount++;
      }
      const bh = Math.max(s[7], s[8]);
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) {
        this.lastHat = t;
        this.hatReq = 1 + Math.floor(1.5 * react);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.kickRate *= Math.exp(-dt / 2);
      const bass = Math.max(s[1], s[2]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.3) : k(0.9));
      const hi = (s[6] + s[7] + s[8]) / 300;
      this.hiEnv += (hi - this.hiEnv) * k(hi > this.hiEnv ? 0.8 : 1.6);
      this.flick *= Math.exp(-dt / 0.35);
      // The drop is a steady four-on-the-floor: the build's kicks fade in too
      // slowly to cross this, and the breakdown's silence drains it in a bar.
      const want = sstep(3.0, 4.3, this.kickRate);
      this.dropAmt += (want - this.dropAmt) * k(want > this.dropAmt ? 0.35 : 1.4);
      // The build is the riser in the top bands before the drop arrives:
      // it lets the picture start resolving, so the room can see it coming.
      const bw = sstep(0.12, 0.5, this.hiEnv) * (1 - this.dropAmt);
      this.build += (bw - this.build) * k(bw > this.build ? 1.2 : 0.8);
    },

    // --------------------------------------------------------------- layout
    layout(W, H) {
      const wide = W / H > 1.25;
      return {
        wide,
        hy: H * 0.68,
        moonX: W * (wide ? 0.74 : 0.7), moonY: H * (wide ? 0.27 : 0.25), moonR: H * (wide ? 0.12 : 0.1),
        whaleL: Math.min(W * 0.4, H * 0.72)
      };
    },

    // Parallax speed (fraction of the flight rate) of whatever is at x, y.
    layerSpeed(x, y, W, H, L) {
      if (y >= L.hy) {
        if (y > H - this.nearH(x, H)) return 1.7;
        return 0.35 + 1.1 * (y - L.hy) / (H - L.hy);
      }
      if (y > this.midY(x, H, L)) return 0.3;
      if (y > this.farY(x, H, L)) return 0.14;
      return 0.03;
    },
    farY(x, H, L) { return L.hy - H * 0.13 * ridge((x + this.travel * 0.14) / (H * 0.34), 3 + this.salt); },
    midY(x, H, L) {
      const u = (x + this.travel * 0.3) / (H * 0.5);
      const gate = sstep(0.25, 0.55, vn1(u * 0.35, 9 + this.salt));
      return L.hy - H * 0.22 * gate * ridge(u, 7 + this.salt) + 1;
    },
    nearH(x, H) {
      const u = (x + this.travel * 1.7) / (H * 0.9);
      const gate = sstep(0.45, 0.8, vn1(u * 0.5, 13 + this.salt));
      return H * 0.24 * gate * (0.55 + 0.45 * ridge(u * 2, 17 + this.salt));
    },

    // ---------------------------------------------------------------- whales
    // A whale's geometry in world units: spine, outline, flukes and fin.
    whale(cx, cy, Lw, ang, phase, amp) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const toW = (lx, ly) => [cx + lx * ca + ly * sa, cy - lx * sa + ly * ca];
      const spineY = (s) => amp * Lw * Math.sin(phase - 4.2 * s) * Math.pow(Math.max(s, 0), 1.8);
      const N = 16;
      const top = [], bot = [], spine = [], belly = [];
      for (let k = 0; k <= N; k++) {
        const s = k / N;
        const lx = Lw * (0.5 - s), ly = spineY(s);
        const d = 0.01;
        const tx = -Lw, ty = (spineY(s + d) - spineY(s - d)) / (2 * d);
        const tl = Math.hypot(tx, ty); const nx = -ty / tl, ny = tx / tl; // points up (-y) since tx < 0
        const up = prof(TOP, s) * Lw, dn = prof(BOT, s) * Lw;
        top.push(toW(lx + nx * up, ly + ny * up));
        spine.push(toW(lx, ly));
        bot.push(toW(lx - nx * dn, ly - ny * dn));
        belly.push(toW(lx - nx * dn * 0.5, ly - ny * dn * 0.5));
      }
      // Flukes, seen a little from below so they read as a spread tail: they
      // pitch with the stroke and the kick's flick.
      const lx1 = -Lw * 0.5, ly1 = spineY(1);
      const slope = (spineY(1) - spineY(0.97)) / (0.03 * Lw) + 3.5 * amp * Math.cos(phase - 4.2);
      const bl = Math.hypot(1, slope), bx = -1 / bl, by = slope / bl;
      const span = Lw * 0.14 * (0.45 + 0.55 * Math.abs(Math.cos(phase - 4.2)));
      const px = -by, py = bx;
      const fl = [
        toW(lx1 + px * 0.02 * Lw, ly1 + py * 0.02 * Lw),
        toW(lx1 + bx * 0.15 * Lw + px * span, ly1 + by * 0.15 * Lw + py * span),
        toW(lx1 + bx * 0.1 * Lw, ly1 + by * 0.1 * Lw),
        toW(lx1 + bx * 0.15 * Lw - px * span, ly1 + by * 0.15 * Lw - py * span),
        toW(lx1 - px * 0.02 * Lw, ly1 - py * 0.02 * Lw)
      ];
      // The humpback's long pectoral, flapping slowly like a wing.
      const k0 = Math.round(0.27 * N), k1 = Math.round(0.38 * N);
      const fAng = 0.55 + 0.35 * Math.sin(phase * 0.5 + 0.7);
      const dx = -Math.cos(fAng), dy = Math.sin(fAng);
      const r0 = bot[k0], r1 = bot[k1];
      const dwx = dx * ca + dy * sa, dwy = -dx * sa + dy * ca;
      const tip = [r0[0] + dwx * Lw * 0.33, r0[1] + dwy * Lw * 0.33];
      const midB = [r1[0] + dwx * Lw * 0.15 + dwy * Lw * 0.012, r1[1] + dwy * Lw * 0.15 - dwx * Lw * 0.012];
      const fin = [r0, tip, midB, r1];
      const eye = toW(Lw * (0.5 - 0.13), spineY(0.13) + Lw * 0.028);
      return { top, bot, spine, belly, fl, fin, eye, cx, cy, Lw, ca, sa, spineY, tip };
    },

    // True if a free point here would cut across a whale's silhouette.
    blocked(x, y, clr) {
      for (const w of this.whales) {
        const dx = x - w.cx, dy = y - w.cy;
        const lx = dx * w.ca - dy * w.sa, ly = dx * w.sa + dy * w.ca;
        const s = 0.5 - lx / w.Lw;
        if (s > -0.06 && s < 1.22) {
          const sy = w.spineY(clamp(s, 0, 1));
          const up = s > 1 ? w.Lw * 0.16 : prof(TOP, s) * w.Lw, dn = s > 1 ? w.Lw * 0.16 : prof(BOT, s) * w.Lw;
          if (ly > sy - up - clr && ly < sy + dn + clr) return true;
        }
        // The fin.
        const f = w.fin, ax = f[0][0], ay = f[0][1], ex = w.tip[0] - ax, ey = w.tip[1] - ay;
        const u = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey), 0, 1);
        if (Math.hypot(x - ax - ex * u, y - ay - ey * u) < w.Lw * 0.04 + clr) return true;
      }
      const L = this.L;
      const dm = Math.hypot(x - L.moonX, y - L.moonY) - L.moonR;
      return Math.abs(dm) < clr * 0.8;
    },

    // ------------------------------------------------------------- painting
    paint(W, H, L, pal, t, ink) {
      const sh = 110, sw = Math.max(8, Math.round(sh * W / H));
      if (!this.src || this.src.width !== sw || this.src.height !== sh) {
        this.src = document.createElement('canvas');
        this.src.width = sw; this.src.height = sh;
        this.sg = this.src.getContext('2d', { willReadFrequently: true });
        this.edge = new Float32Array(sw * sh);
        this.lum = new Float32Array(sw * sh);
      }
      const g = this.sg;
      g.setTransform(sw / W, 0, 0, sh / H, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // Sky.
      let gr = g.createLinearGradient(0, 0, 0, L.hy);
      gr.addColorStop(0, pal.skyTopCss); gr.addColorStop(0.5, pal.skyMidCss);
      gr.addColorStop(0.86, pal.skyLowCss); gr.addColorStop(1, pal.glowCss);
      g.fillStyle = gr; g.fillRect(0, 0, W, L.hy + 2);
      // Long flat cloud banks, drifting at sky speed.
      for (let i = 0; i < 4; i++) {
        const cw = W * (0.35 + 0.2 * hash1(i + 3));
        const span = W + cw * 2;
        const x = ((hash1(i) * span - this.travel * (0.05 + 0.02 * i)) % span + span) % span - cw;
        const y = H * [0.12, 0.2, 0.47, 0.56][i];
        g.fillStyle = cssA(i < 2 ? pal.cloud : mix(pal.cloud, pal.glow, 0.35), 0.85);
        g.beginPath(); g.ellipse(x + cw / 2, y, cw / 2, H * (0.018 + 0.01 * hash1(i + 9)), 0, 0, TAU); g.fill();
      }
      // The halo: the second ink, and the build's anticipation.
      const halo = Math.max(ink, 0.65 * this.build);
      if (halo > 0.01) {
        g.strokeStyle = cssA(pal.accent, clamp(halo, 0, 1));
        g.lineWidth = L.moonR * (0.1 + 0.12 * halo);
        g.beginPath(); g.arc(L.moonX, L.moonY, L.moonR * (1.28 + 0.1 * halo), 0, TAU); g.stroke();
      }
      // Moon with a few maria, turning very slowly.
      g.fillStyle = pal.moonCss;
      g.beginPath(); g.arc(L.moonX, L.moonY, L.moonR, 0, TAU); g.fill();
      g.fillStyle = cssA(pal.moonShade, 0.8);
      for (let i = 0; i < 3; i++) {
        const a = this.moonRot + i * 2.1, r = L.moonR * (0.35 + 0.2 * i);
        g.beginPath(); g.arc(L.moonX + Math.cos(a) * r * 0.8, L.moonY + Math.sin(a) * r * 0.6, L.moonR * (0.24 - 0.04 * i), 0, TAU); g.fill();
      }
      // Far and mid ridgelines.
      const step = W / 90;
      g.fillStyle = css(mix(pal.far, pal.glow, 0.25));
      g.beginPath(); g.moveTo(-2, L.hy + 2);
      for (let x = -2; x <= W + step; x += step) g.lineTo(x, this.farY(x, H, L));
      g.lineTo(W + step, L.hy + 2); g.closePath(); g.fill();
      g.fillStyle = pal.midCss;
      g.beginPath(); g.moveTo(-2, L.hy + 2);
      for (let x = -2; x <= W + step; x += step) g.lineTo(x, this.midY(x, H, L));
      g.lineTo(W + step, L.hy + 2); g.closePath(); g.fill();
      // Sea, and the moon's glade: broken bars that shimmer in place.
      gr = g.createLinearGradient(0, L.hy, 0, H);
      gr.addColorStop(0, pal.seaTopCss); gr.addColorStop(1, pal.seaBotCss);
      g.fillStyle = gr; g.fillRect(0, L.hy, W, H - L.hy);
      // The glade is soft on purpose: sharp dashes made coarse facets
      // flicker between dash and gap as the points crossed them.
      const gl = 0.35 + 0.3 * this.bassEnv + 0.15 * ink;
      g.save();
      g.translate(L.moonX, L.hy);
      g.scale(1, (H - L.hy) / (L.moonR * 1.6));
      gr = g.createRadialGradient(0, 0, 0, 0, 0, L.moonR * 1.6);
      gr.addColorStop(0, cssA(pal.glade, gl)); gr.addColorStop(1, cssA(pal.glade, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, L.moonR * 1.6, 0, TAU); g.fill();
      g.restore();
      for (let i = 0; i < 6; i++) {
        const v = (i + 0.5) / 6, y = L.hy + (H - L.hy) * v;
        const w = L.moonR * (0.8 + 2.6 * v) * (0.7 + 0.5 * vn1(t * 0.35 + i * 1.7, 23));
        g.fillStyle = cssA(pal.glade, gl * 0.7 * (1 - 0.5 * v));
        g.beginPath(); g.ellipse(L.moonX, y, w / 2, (H - L.hy) * 0.025, 0, 0, TAU); g.fill();
      }
      // A near headland slides past now and then, fastest of all.
      g.fillStyle = pal.nearCss;
      g.beginPath(); g.moveTo(-2, H + 2);
      for (let x = -2; x <= W + step; x += step) g.lineTo(x, H - this.nearH(x, H));
      g.lineTo(W + step, H + 2); g.closePath(); g.fill();
      // Whales, smallest (farthest) first.
      for (const w of this.whales.slice().sort((a, b) => a.Lw - b.Lw)) this.paintWhale(g, w, pal);
      // Read it back and find the edges the points should gather on.
      const d = g.getImageData(0, 0, sw, sh).data;
      this.pix = d; this.sw = sw; this.sh = sh;
      const lum = this.lum, E = this.edge;
      for (let i = 0, j = 0; i < sw * sh; i++, j += 4) lum[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const i = y * sw + x;
          const xa = x > 0 ? i - 1 : i, xb = x < sw - 1 ? i + 1 : i, ya = y > 0 ? i - sw : i, yb = y < sh - 1 ? i + sw : i;
          E[i] = Math.abs(lum[xb] - lum[xa]) + Math.abs(lum[yb] - lum[ya]);
        }
      }
    },

    paintWhale(g, w, pal) {
      const poly = (pts, col) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath(); g.fill();
      };
      poly(w.fl, pal.backCss);
      const body = w.top.concat(w.bot.slice().reverse());
      poly(body, pal.backCss);
      // Countershading: the pale throat and belly below a line just under the spine.
      poly(w.belly.slice(1, -2).concat(w.bot.slice(1, -2).reverse()), css(mix(pal.back, pal.belly, 0.55)));
      poly(w.fin, pal.finCss);
      g.fillStyle = pal.deepCss;
      g.beginPath(); g.arc(w.eye[0], w.eye[1], w.Lw * 0.012, 0, TAU); g.fill();
    },

    sample(x, y) {
      const sx = clamp((x / this.W * this.sw) | 0, 0, this.sw - 1), sy = clamp((y / this.H * this.sh) | 0, 0, this.sh - 1);
      return (sy * this.sw + sx);
    },

    // ----------------------------------------------------------- particles
    spawn(i, mode, W, H, clr) {
      let x = 0, y = 0;
      for (let tries = 0; tries < 12; tries++) {
        x = mode === 1 ? W + Math.random() * 14 : Math.random() * W;
        y = Math.random() * H;
        const e = this.edge[this.sample(Math.min(x, W - 1), y)];
        if (tries < 11 && Math.random() > 0.1 + 7 * e) continue;
        if (tries < 11 && this.blocked(x, y, clr)) continue;
        break;
      }
      this.px[i] = x; this.py[i] = y;
      this.life[i] = 5 + 12 * Math.random();
      this.pid[i] = this.nextId++;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      this.W = W; this.H = H;
      const t = p.millis() / 1000;
      const dt = this.t === null ? 1 / 60 : clamp(t - this.t, 0, 0.1);
      this.t = t;
      const react = clamp(params.reaction, 0, 2);
      this.analyse(signals, t, dt, react);
      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      const L = this.L = this.layout(W, H);
      if (this.reseedReq) { this.reseedReq = false; this.salt += 31; this.nFree = 0; }

      // What Follow does: carry the drop's params toward the drop look.
      const follow = Math.round(params.follow) === 0;
      const dA = follow ? this.dropAmt : 0, bA = follow ? this.build : 0;
      const lift = Math.max(dA, 0.3 * bA);
      const polys = lerp(params.polys, Math.max(params.polys, DROP_POLYS), lift);
      const ink = Math.max(params.ink, dA);
      const flight = params.flight * (1 + 0.6 * dA);
      const calvesWant = Math.max(Math.round(params.calves), dA > 0.35 ? 2 : 0);

      // Motion.
      this.clock += dt;
      const rate = H * 0.075 * flight * (1 + 0.6 * this.bassEnv);
      this.travel += rate * dt;
      const amp = (0.035 + 0.035 * this.bassEnv + 0.012 * dA) * (1 + 1.4 * this.flick * react);
      this.swim += dt * (2.2 + 1.6 * this.bassEnv + 0.8 * dA);
      this.moonRot += dt * 0.02;
      const podT = calvesWant > 0 ? 1 : 0;
      if (podT > this.pod) this.podLeaving = false; else if (podT < this.pod) this.podLeaving = true;
      this.pod = clamp(this.pod + dt * (podT > this.pod ? 0.75 : -0.22), 0, 1);

      // The mother banks across the frame on a 32 s figure of eight, facing
      // into the flight; the calves follow the line she swam a moment ago.
      const Lw = L.whaleL;
      const path = (c) => {
        const a = TAU * c / 32;
        return [W * (0.46 + 0.16 * Math.sin(a)), H * (0.36 + 0.075 * Math.sin(2 * a + 0.6))];
      };
      const bankAt = (c) => {
        const a = path(c), b = path(c + 0.5);
        return clamp(Math.atan2(-(b[1] - a[1]), Math.abs(b[0] - a[0]) + W * 0.05) * 0.8, -0.22, 0.22);
      };
      this.whales = [];
      const m = path(this.clock);
      this.whales.push(this.whale(m[0], m[1], Lw, bankAt(this.clock) + 0.03 * Math.sin(this.swim * 0.5), this.swim, amp));
      if (calvesWant > 0) this.podN = calvesWant;
      if (this.pod > 0.001) {
        const e = this.pod < 0.5 ? 2 * this.pod * this.pod : 1 - Math.pow(-2 * this.pod + 2, 2) / 2;
        const off = this.podLeaving ? [-(1 - e) * W * 0.45, -(1 - e) * H * 0.5] : [-(1 - e) * W * 0.55, (1 - e) * H * 0.05];
        const lag = [2.4, 4.2];
        const scl = [0.44, 0.34];
        const dy = [0.2, -0.05];
        for (let c = 0; c < Math.min(this.podN || 0, 2); c++) {
          const q = path(this.clock - lag[c]);
          const wx = q[0] - Lw * (0.5 + 0.35 * c) + off[0], wy = q[1] + H * dy[c] + off[1];
          this.whales.push(this.whale(wx, wy, Lw * scl[c], bankAt(this.clock - lag[c]), this.swim * 1.3 + 1.7 * (c + 1), amp * 1.2));
        }
      }

      this.paint(W, H, L, pal, t, ink);

      // ---- the point set
      // Structural points: frame edge, moon rim, whale outlines.
      let n = 0;
      const co = this.coords, ids = this.ids, glow = this.glow;
      const put = (x, y, id, gl) => { co[2 * n] = x; co[2 * n + 1] = y; ids[n] = id; glow[n] = gl || 0; n++; };
      const ex = Math.max(4, Math.round(W / 110)), ey = Math.max(3, Math.round(H / 110));
      for (let i = 0; i <= ex; i++) { put(W * i / ex, 0, 900000 + i); put(W * i / ex, H, 900100 + i); }
      for (let j = 1; j < ey; j++) { put(0, H * j / ey, 900200 + j); put(W, H * j / ey, 900300 + j); }
      const detail = sstep(300, 3000, polys);
      const mr = Math.round(12 + 10 * detail);
      for (let i = 0; i < mr; i++) {
        const a = this.moonRot * 2 + (i / mr) * TAU;
        put(L.moonX + Math.cos(a) * L.moonR, L.moonY + Math.sin(a) * L.moonR, 901000 + i);
      }
      const stride = detail > 0.5 ? 1 : 2;
      this.whales.forEach((w, wi) => {
        const base = 910000 + wi * 1000;
        const st = wi === 0 ? stride : 2;
        for (let k = 0; k < w.top.length; k += st) { put(w.top[k][0], w.top[k][1], base + k); put(w.bot[k][0], w.bot[k][1], base + 100 + k); }
        for (let k = 2; k < w.belly.length - 2; k += 3) put(w.belly[k][0], w.belly[k][1], base + 200 + k);
        for (let k = 1; k < 4; k++) put(w.fl[k][0], w.fl[k][1], base + 300 + k);
        put(w.fin[1][0], w.fin[1][1], base + 310); put(w.fin[2][0], w.fin[2][1], base + 311);
      });
      const nStruct = n;

      // Free points: ride the layers, live and die, keep off the outlines.
      const clr = Lw * 0.035;
      const want = clamp(Math.round(polys / 2) - nStruct, 30, CAP);
      if (!this.seeded) { this.nFree = 0; }
      if (this.nFree < want) {
        const add = this.seeded ? Math.min(want - this.nFree, Math.max(6, Math.round(want * 0.012))) : want - this.nFree;
        for (let k = 0; k < add; k++) this.spawn(this.nFree++, 0, W, H, clr);
      } else if (this.nFree > want) {
        // Coarsening is a process you watch: a few points go each frame.
        const drop = Math.min(this.nFree - want, Math.max(3, Math.round(this.nFree * 0.006)));
        for (let k = 0; k < drop; k++) {
          const i = (Math.random() * this.nFree) | 0, last = --this.nFree;
          this.px[i] = this.px[last]; this.py[i] = this.py[last]; this.life[i] = this.life[last]; this.pid[i] = this.pid[last];
        }
      }
      this.seeded = true;
      // A hat onset cuts a tiny four-point star into the sky: five fresh
      // points, so only its own small facets light, however coarse the mesh.
      if (this.hatReq) {
        for (let k = 0, made = 0; k < 20 && made < this.hatReq; k++) {
          const x = W * (0.03 + 0.94 * Math.random()), y = H * 0.5 * Math.random();
          if (y > this.farY(x, H, L) - H * 0.05 || this.blocked(x, y, H * 0.03)) continue;
          const r = H * (0.012 + 0.008 * Math.random()), a0 = Math.random() * 0.6;
          const star = [[0, 0]];
          for (let q = 0; q < 4; q++) star.push([Math.cos(a0 + q * TAU / 4) * r, Math.sin(a0 + q * TAU / 4) * r]);
          for (const o of star) this.wake.push({ x: x + o[0], y: y + o[1], vx: 0, vy: 0, at: t, id: this.nextId++, sky: true, tau: 0.3, life: 0.7 });
          made++;
        }
        this.hatReq = 0;
      }
      const wob = H * 0.006;
      for (let i = 0; i < this.nFree; i++) {
        let x = this.px[i], y = this.py[i];
        const sp = this.layerSpeed(x, y, W, H, L);
        x -= sp * rate * dt;
        y += Math.sin(t * 0.3 + this.pid[i] * 1.7) * wob * dt;
        this.life[i] -= dt;
        this.px[i] = x; this.py[i] = y;
        if (x < -12) this.spawn(i, 1, W, H, clr);
        else if (this.life[i] < 0 || y < -4 || y > H + 4 || this.blocked(x, y, clr * 0.7)) this.spawn(i, 0, W, H, clr);
        put(this.px[i], this.py[i], this.pid[i], 0);
      }

      // The kick's wake: fresh points shed from the flukes, streaming back.
      const mom = this.whales[0];
      if (this.kickWake) {
        this.kickWake = false;
        if (react > 0) {
          const cnt = Math.round(18 + 16 * react);
          // Shed just clear of the flukes (inside their no-go zone a point
          // would be dropped before it could glint).
          const fx = mom.fl[2][0] - Lw * 0.1 * mom.ca, fy = mom.fl[2][1] + Lw * 0.1 * mom.sa;
          for (let k = 0; k < cnt; k++) {
            const a = Math.PI + (Math.random() - 0.5) * 0.8;
            const v = Lw * (0.15 + 0.5 * Math.random());
            this.wake.push({ x: fx - Lw * 0.05 * Math.random(), y: fy + (Math.random() - 0.5) * Lw * 0.15, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, at: t, id: this.nextId++, tau: 0.55, life: 1.8 });
          }
        }
      }
      for (let k = this.wake.length - 1; k >= 0; k--) {
        const q = this.wake[k], age = t - q.at;
        if (age > q.life) { this.wake.splice(k, 1); continue; }
        const drag = Math.exp(-dt / 0.5);
        q.vx *= drag; q.vy *= drag;
        q.x += (q.vx - (q.sky ? 0.03 : 0.2) * rate) * dt; q.y += q.vy * dt;
        if (this.blocked(q.x, q.y, clr * 0.5)) continue;
        put(q.x, q.y, q.id, react * Math.exp(-Math.max(0, age - 0.03) / q.tau));
      }

      // ---- triangulate and fill
      const nt = this.del.run(co, n);
      const T = this.del.tris;
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.lineJoin = 'round'; g.lineWidth = 0.9;
      const pix = this.pix, lum = this.lum;
      const relief = clamp(params.relief, 0, 1);
      const la = -2.3 + 0.25 * Math.sin(this.clock * 0.05);
      const lx = Math.cos(la), ly = Math.sin(la);
      const kx = this.sw / W;
      const glint = mix(pal.glade, [255, 255, 255], 0.4);
      const sinceClap = t - this.lastClap;
      const deal = sstep(0, 0.12, sinceClap);
      const mr2 = L.moonR * L.moonR;
      let shown = 0;
      for (let q = 0; q < nt; q += 3) {
        const a = T[q], b = T[q + 1], c = T[q + 2];
        const ax = co[2 * a], ay = co[2 * a + 1], bx = co[2 * b], by = co[2 * b + 1], cx = co[2 * c], cy = co[2 * c + 1];
        const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3;
        const si = this.sample(mx, my) * 4;
        let r = pix[si], gg = pix[si + 1], bb = pix[si + 2];
        // Relief: the painting's own slope across the facet, lit from the
        // upper left, so the facets read as planes cut at angles.
        const La = lum[this.sample(ax, ay)], Lb = lum[this.sample(bx, by)], Lc = lum[this.sample(cx, cy)];
        const e1x = bx - ax, e1y = by - ay, e2x = cx - ax, e2y = cy - ay;
        const det = e1x * e2y - e1y * e2x || 1e-6;
        const gx = ((Lb - La) * e2y - (Lc - La) * e1y) / det, gy = ((Lc - La) * e1x - (Lb - La) * e2x) / det;
        const hid = ids[a] + ids[b] + ids[c], hx = ids[a] ^ ids[b] ^ ids[c];
        const hr = hash2(hid % 100003, hx % 99991);
        let k = 1 + relief * (clamp((gx * lx + gy * ly) / kx * 3.2, -0.22, 0.22) + 0.16 * (hr - 0.5));
        // The clap re-deals the moon's facets.
        const dmx = mx - L.moonX, dmy = my - L.moonY;
        if (dmx * dmx + dmy * dmy < mr2) {
          const now = hash2(hid % 100003, this.clapCount + 7), was = hash2(hid % 100003, this.clapCount + 6);
          k *= 0.86 + 0.24 * lerp(was, now, deal);
        }
        r *= k; gg *= k; bb *= k;
        // Only facets cut wholly from fresh points glint, so a kick or a hat
        // lights small new facets and never a big coarse one.
        const gw = Math.min(glow[a], glow[b], glow[c]);
        if (gw > 0.02 && hr < 0.8) {
          const m2 = clamp(gw * (0.55 + 0.45 * hr), 0, 1);
          r += (glint[0] - r) * m2; gg += (glint[1] - gg) * m2; bb += (glint[2] - bb) * m2;
        }
        const col = 'rgb(' + (clamp(r, 0, 255) | 0) + ',' + (clamp(gg, 0, 255) | 0) + ',' + (clamp(bb, 0, 255) | 0) + ')';
        g.fillStyle = col; g.strokeStyle = col;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath();
        g.fill(); g.stroke();
        shown++;
      }
      this.shown = shown;

      this.drawType(g, W, H, L, pal, params, ink, polys, dt);
      g.restore();
    },

    // ------------------------------------------------------------------ type
    drawType(g, W, H, L, pal, params, ink, polys, dt) {
      const titleFont = face('Bebas Neue', 'Impact, sans-serif');
      const smallFont = face('Josefin Sans', 'Helvetica, Arial, sans-serif');
      const monoFont = face('Space Mono', 'Menlo, monospace');
      const small = H * 0.022;
      const mx = W * 0.05;
      // Chapter: named from what the mesh is doing, so it is true with Follow
      // off as well (the performer's fader moves it through the same words).
      // The count is smoothed so the spec line ticks rather than flickers.
      // The chapter reads the trend of the budget, not of the realised
      // count, which jitters with every star and wake.
      const cs0 = this.cs || this.shown;
      this.cs = cs0 + (this.shown - cs0) * 0.08;
      const cnt = Math.round(this.cs);
      const b0 = this.lastPolys === undefined ? polys : this.lastPolys;
      this.lastPolys = polys;
      this.slope = (this.slope || 0) + ((polys - b0) / Math.max(dt, 1e-3) - (this.slope || 0)) * 0.1;
      const rising = this.slope > 30, falling = this.slope < -30;
      let ch = this.chapter;
      if (polys > 2000 && !falling) ch = 2;
      else if (rising && polys > 600) ch = 1;
      else if (falling && ch >= 1) ch = 3;
      else if (!rising && !falling && polys < 900) ch = 0;
      this.chapter = ch;
      const CH = ['I · THE SEA ASLEEP', 'II · SOMETHING SURFACING', 'III · FULL RESOLUTION', 'IV · FALLING BACK TO SHARDS'];

      g.textBaseline = 'alphabetic';
      // The title: crisp, unfaceted, the one layer the mesh doesn't touch.
      const words = String(params.title || '').trim().toUpperCase();
      const size = H * (L.wide ? 0.15 : 0.12);
      const by = H - H * 0.075;
      if (words) {
        g.font = size + 'px ' + titleFont;
        g.textAlign = 'left';
        try { g.letterSpacing = (size * 0.02).toFixed(1) + 'px'; } catch (e) { /* older canvas */ }
        g.fillStyle = cssA(pal.deep, 0.45);
        g.fillText(words, mx + size * 0.03, by - small * 1.9 + size * 0.035);
        g.fillStyle = pal.inkCss;
        g.fillText(words, mx, by - small * 1.9);
      }
      g.font = '700 ' + small + 'px ' + smallFont;
      try { g.letterSpacing = (small * 0.28).toFixed(1) + 'px'; } catch (e) { /* */ }
      g.fillStyle = pal.inkCss;
      g.textAlign = 'left';
      g.fillText(CH[ch], mx, by);
      // The rule under the title takes the second ink.
      g.fillStyle = css(mix(pal.ink, pal.accent, clamp(ink, 0, 1)));
      g.fillRect(mx, by - small * 1.45, W * (L.wide ? 0.32 : 0.5), Math.max(1.2, small * 0.16));
      g.fillStyle = pal.inkCss;
      g.fillText('A SLOW FLIGHT OVER', mx, H * 0.07);
      g.fillText('THE LISTENING SEA', mx, H * 0.07 + small * 1.5);
      g.textAlign = 'right';
      g.fillText('124 BPM', W - mx, H * 0.07);
      g.fillText('BRING SOMEONE', W - mx, H * 0.07 + small * 1.5);
      // The live polygon count, like a render spec: it names what the image
      // is doing without being a meter.
      g.font = '400 ' + small * 1.05 + 'px ' + monoFont;
      try { g.letterSpacing = (small * 0.08).toFixed(1) + 'px'; } catch (e) { /* */ }
      const s = String(cnt).padStart(4, '0');
      g.fillText(s.slice(0, -3) + ' ' + s.slice(-3) + ' POLYGONS', W - mx, by);
      try { g.letterSpacing = '0px'; } catch (e) { /* */ }
    }
  });
})();
