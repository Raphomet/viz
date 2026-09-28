// Chomper V2 — a maze game that plays itself, then comes loose from the plane.
//
// V2 (2026-09-28, after the six-judge panel) keeps V1 whole and changes the
// song-level structure in two places; see harness/v2/chomper.md:
// - Every breakdown dives into a new maze. V1 opened the portal only after a
//   level had run 55-110 s, so its best recursion happened once in 96 s and the
//   garden only ever grew (the curator's "accumulation without erasure"). Now
//   the portal opens just ahead of the chomper as each drop spends itself; the
//   dive leaves the old garden behind and arrives clean, at a new scale, in new
//   inks.
// - The build lifts the board. V1's build was indistinguishable from its intro
//   (the director's missing anticipation); a riser detector now tilts the flat
//   maze into perspective toward the chapter it is about to fold into.
//
// An original arcade-maze homage (no borrowed characters): a many-legged
// vermilion "chompede" with snapping mandibles eats its way round a real
// maze, chased by soft, googly-eyed pursuers that keep changing species. It is
// a real game underneath: the maze is generated (mirror-symmetric, braided,
// wrapping at every edge like an arcade tunnel), the chomper plans with
// breadth-first searches (nearest pellet, danger from each pursuer, prey when
// powered, the portal when one opens), and each pursuer has its own target
// rule (stalker, ambusher, mirror, wanderer) with scatter/chase phases.
//
// Craft notes:
// - The whole game is painted flat, every frame, into one "board" canvas, one
//   period of a maze that wraps at every edge. Flat views just tile that
//   canvas. The surreal views upload it as a texture onto a WebGL2 mesh that a
//   vertex shader folds: rolled into a tube, bent into a torus, curled into a
//   drum, with wall blocks extruded as instanced boxes through the same fold.
//   Because the maze wraps, the torus and the tunnel close without a seam.
// - Mesh span is capped at one full turn of any fold, so a half-rolled sheet
//   never lies on top of itself.
// - Nested mazes: power pellets carry a miniature of the maze they sit in, and
//   the portal pellet carries the next maze, live, with its own game running.
//   Eating the portal dives into it: an exponential zoom where the disc becomes
//   the screen and the next level (new scale, new inks) takes over seamlessly.
// - Music: the kick snaps the mandibles and sends one ripple through nearby
//   pellets (the only thing a kick moves); the snare turns pursuers round and
//   morphs them a step; hats glint individual pellets; bass swells pellets,
//   walls and flowers; the drop grows a power pellet in the chomper's path
//   (time slows, the board inverts, pursuers multiply) and folds the world into
//   the next surreal chapter; the breakdown unfolds it back to a calm maze.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function sstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function wrapA(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function easeAng(cur, target, rate, dt) { return cur + wrapA(target - cur) * (1 - Math.exp(-rate * dt)); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function wrapD(d, n) { return mod(d + n / 2, n) - n / 2; }
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mixRGB(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) {
    const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
    return a === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
  }
  function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  // Limited inks, matte, mostly daylight. Each maze takes the next one.
  const PALETTES = [
    { name: 'Riso', floor: '#f1e9d6', wall: '#1f6f78', key: '#0b3a40', pellet: '#2b2d42', chomp: '#ff4f5a', spot: '#fff3dc', ink: '#1a1a24', bg: '#d3c8ae', inks: ['#f2b705', '#3d5a98', '#ef7a2e', '#8a4fa3'], flowers: ['#ff4f5a', '#f2b705', '#fbf6ea', '#3d5a98'] },
    { name: 'Terracotta', floor: '#f0dcc4', wall: '#b4532f', key: '#5e2412', pellet: '#40281c', chomp: '#1d5c8c', spot: '#f6e7d2', ink: '#24160f', bg: '#dcc0a0', inks: ['#2f7d5b', '#f0b429', '#6b3fa0', '#e8e0d0'], flowers: ['#1d5c8c', '#f0b429', '#fbf2e4', '#2f7d5b'] },
    { name: 'Night arcade', floor: '#12132a', wall: '#2f3cc0', key: '#9aa3ff', pellet: '#f5deb0', chomp: '#ff5c7a', spot: '#ffe9ef', ink: '#06070f', bg: '#08091a', inks: ['#ffd23f', '#3ee0c8', '#ff8c42', '#c77dff'], flowers: ['#ff5c7a', '#ffd23f', '#3ee0c8', '#f5deb0'] },
    { name: 'Blueprint', floor: '#1f4e8c', wall: '#ebe6d8', key: '#0e2b52', pellet: '#f7f3e8', chomp: '#ff6b3d', spot: '#fff1e0', ink: '#0b1830', bg: '#163a6b', inks: ['#ffd23f', '#7de2d1', '#ff9fb2', '#f7f3e8'], flowers: ['#ff6b3d', '#ffd23f', '#f7f3e8', '#7de2d1'] },
    { name: 'Mint and ink', floor: '#dcefe2', wall: '#1b1b22', key: '#000000', pellet: '#1b1b22', chomp: '#ff5436', spot: '#fff4ea', ink: '#0d0d12', bg: '#bcd6c5', inks: ['#3a86ff', '#ffbe0b', '#8338ec', '#ff006e'], flowers: ['#ff5436', '#ffbe0b', '#ffffff', '#3a86ff'] },
  ];
  // The drop inverts the board: floor and wall trade places.
  function prepPalette(P) {
    const n = {
      floor: hex(P.floor), wall: hex(P.wall), key: hex(P.key), pellet: hex(P.pellet), chomp: hex(P.chomp),
      spot: hex(P.spot), ink: hex(P.ink), bg: hex(P.bg), inks: P.inks.map(hex), flowers: P.flowers,
    };
    n.side = shade(n.wall, 0.78);
    const i = Object.assign({}, n);
    i.floor = n.wall; i.wall = n.floor; i.pellet = n.floor; i.side = shade(n.floor, 0.78);
    i.bg = shade(n.wall, 0.55);
    return { n, i };
  }
  const PAL = PALETTES.map(prepPalette);
  function palMix(pi, t) {
    const A = PAL[pi].n, B = PAL[pi].i;
    const o = {};
    for (const k of ['floor', 'wall', 'key', 'pellet', 'chomp', 'spot', 'ink', 'bg', 'side']) o[k] = mixRGB(A[k], B[k], t);
    o.inks = A.inks; o.flowers = A.flowers;
    return o;
  }

  // ---------------------------------------------------------------- maze
  // Cells on a torus, mirrored left-right, braided so there are no dead ends.
  function makeMaze(Cw, Ch, r) {
    const half = Cw / 2;
    const R = new Uint8Array(Cw * Ch), D = new Uint8Array(Cw * Ch), PL = new Uint8Array(Cw * Ch);
    const openR = (k, j) => { k = mod(k, Cw); j = mod(j, Ch); R[j * Cw + k] = 1; R[j * Cw + mod(Cw - 2 - k, Cw)] = 1; };
    const openD = (i, j) => { i = mod(i, Cw); j = mod(j, Ch); D[j * Cw + i] = 1; D[j * Cw + (Cw - 1 - i)] = 1; };
    const isOpen = (i, j, d) => {
      if (d === 0) return R[mod(j, Ch) * Cw + mod(i, Cw)];
      if (d === 2) return R[mod(j, Ch) * Cw + mod(i - 1, Cw)];
      if (d === 1) return D[mod(j, Ch) * Cw + mod(i, Cw)];
      return D[mod(j - 1, Ch) * Cw + mod(i, Cw)];
    };
    const open = (i, j, d) => {
      if (d === 0) openR(i, j); else if (d === 2) openR(i - 1, j); else if (d === 1) openD(i, j); else openD(i, j - 1);
    };
    // Spanning tree over the left half (vertical wrap allowed).
    const seen = new Uint8Array(Cw * Ch);
    const s0 = [Math.floor(r() * half), Math.floor(r() * Ch)];
    seen[s0[1] * Cw + s0[0]] = 1;
    const stack = [s0];
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const ni = i + DX[d], nj = mod(j + DY[d], Ch);
        if (ni < 0 || ni >= half) continue;
        if (!seen[nj * Cw + ni]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      const d = opts[Math.floor(r() * opts.length)];
      open(i, j, d);
      const ni = i + DX[d], nj = mod(j + DY[d], Ch);
      seen[nj * Cw + ni] = 1;
      stack.push([ni, nj]);
    }
    // Join the halves across the centre line and through the wrap tunnels.
    const nc = 2 + Math.floor(r() * 2);
    for (let k = 0; k < nc; k++) openR(half - 1, Math.floor(r() * Ch));
    const nw = 1 + Math.floor(r() * 2);
    for (let k = 0; k < nw; k++) openR(Cw - 1, Math.floor(r() * Ch));
    // Braid: every dead end gets a second way out.
    for (let pass = 0; pass < 3; pass++) {
      for (let j = 0; j < Ch; j++) for (let i = 0; i < half; i++) {
        let deg = 0; const closed = [];
        for (let d = 0; d < 4; d++) { if (isOpen(i, j, d)) deg++; else closed.push(d); }
        if (deg <= 1 && closed.length) open(i, j, closed[Math.floor(r() * closed.length)]);
      }
    }
    // A few extra loops.
    for (let j = 0; j < Ch; j++) for (let i = 0; i < half; i++) {
      if (r() < 0.08) open(i, j, 0);
      if (r() < 0.08) open(i, j, 1);
    }
    // One or two plazas: a pillar and its four passages removed.
    const npl = 1 + Math.floor(r() * 2);
    for (let k = 0; k < npl; k++) {
      const i = 1 + Math.floor(r() * (half - 1)), j = 1 + Math.floor(r() * (Ch - 1));
      openR(i - 1, j - 1); openR(i - 1, j); openD(i - 1, j - 1); openD(i, j - 1);
      PL[j * Cw + i] = 1; PL[j * Cw + mod(Cw - i, Cw)] = 1;
    }
    const Gw = Cw * 2, Gh = Ch * 2;
    const wall = new Uint8Array(Gw * Gh).fill(1);
    for (let j = 0; j < Ch; j++) for (let i = 0; i < Cw; i++) {
      wall[(2 * j + 1) * Gw + 2 * i + 1] = 0;
      if (R[j * Cw + i]) wall[(2 * j + 1) * Gw + mod(2 * i + 2, Gw)] = 0;
      if (D[j * Cw + i]) wall[mod(2 * j + 2, Gh) * Gw + 2 * i + 1] = 0;
      if (PL[j * Cw + i]) wall[(2 * j) * Gw + 2 * i] = 0;
    }
    return { Gw, Gh, wall };
  }

  // ---------------------------------------------------------------- level
  let LEVEL_ID = 1;
  function newLevel(idx, palIdx, W, H, devScale, params, seed) {
    const r = rng(seed * 7919 + idx * 131 + 17);
    const CH_SEQ = [8, 6, 10, 7, 12, 9, 5, 11];
    let Ch = Math.round(CH_SEQ[idx % CH_SEQ.length] * (params.scale || 1));
    Ch = clamp(Ch, 4, 16);
    const aspect = Math.max(0.5, W / H);
    const Cw = Math.max(4, 2 * Math.round(Ch * aspect / 2));
    const M = makeMaze(Cw, Ch, r);
    const Gw = M.Gw, Gh = M.Gh, N = Gw * Gh;
    const L = {
      id: LEVEL_ID++, idx, palIdx, Gw, Gh, N, wall: M.wall, rnd: r,
      nb: new Int32Array(N * 4), pel: new Uint8Array(N), flower: new Float32Array(N), fcol: new Uint8Array(N),
      age: 0, portal: null, inner: null, particles: [], pursuers: [], eaten: 0, total: 0, modeT: 0, mode: 'scatter',
    };
    for (let y = 0; y < Gh; y++) for (let x = 0; x < Gw; x++) {
      const i = y * Gw + x;
      for (let d = 0; d < 4; d++) {
        const j = mod(y + DY[d], Gh) * Gw + mod(x + DX[d], Gw);
        L.nb[i * 4 + d] = (M.wall[i] || M.wall[j]) ? -1 : j;
      }
      if (!M.wall[i]) { L.pel[i] = 1; L.total++; }
      L.fcol[i] = Math.floor(hash2(i, L.id) * 4);
    }
    // Power pellets at mirrored quarter points.
    const cellT = (ci, cj) => (2 * mod(cj, Gh / 2) + 1) * Gw + 2 * mod(ci, Gw / 2) + 1;
    const qi = Math.max(1, Math.round(Cw / 4) - 1), qj = Math.max(1, Math.round(Ch / 4));
    for (const [ci, cj] of [[qi, qj], [Cw - 1 - qi, qj], [qi, Ch - 1 - qj], [Cw - 1 - qi, Ch - 1 - qj]]) L.pel[cellT(ci, cj)] = 2;
    L.home = cellT(Cw / 2, Math.floor(Ch / 2) - 1);
    L.corners = [cellT(0, 0), cellT(Cw - 1, 0), cellT(0, Ch - 1), cellT(Cw - 1, Ch - 1)].map(t => bfs(L, t));
    L.start = cellT(Cw / 2 - 1, Math.floor(Ch * 0.75));
    L.pel[L.start] = 0; L.total--;
    // Size the board canvas to the screen's tile size.
    const T = Math.max(W / Gw, H / Gh);
    L.ppt = clamp(Math.round(T * devScale), 14, Math.floor(3072 / Gw));
    L.canvas = document.createElement('canvas');
    L.canvas.width = Gw * L.ppt; L.canvas.height = Gh * L.ppt;
    L.g = L.canvas.getContext('2d');
    L.cacheN = buildCache(L, PAL[palIdx].n);
    L.cacheI = buildCache(L, PAL[palIdx].i);
    L.thumbN = thumb(L.cacheN, 96); L.thumbI = thumb(L.cacheI, 96);
    L.walls = [];
    for (let i = 0; i < N; i++) if (M.wall[i]) L.walls.push(i % Gw, Math.floor(i / Gw));
    L.wallArr = new Float32Array(L.walls);
    // The chomper.
    L.chomp = makeEntity(L, L.start, 0);
    L.chomp.hist = []; L.chomp.segs = 3; L.chomp.kick = 0; L.chomp.jawOpen = 0.15; L.chomp.caught = 0; L.chomp.caughtT = 0; L.chomp.pop = 1;
    L.chomp.map = bfs(L, L.start);
    L.chomp.aheadMap = L.chomp.map; L.chomp.mirrorMap = L.chomp.map;
    const nP = Math.round(params.crowd || 4);
    for (let k = 0; k < nP; k++) addPursuer(L, k % 4, k);
    return L;
  }

  function bfs(L, start, out) {
    const N = L.N;
    out = out || new Int16Array(N);
    out.fill(32767);
    const q = new Int32Array(N);
    let h = 0, t = 0;
    q[t++] = start; out[start] = 0;
    while (h < t) {
      const c = q[h++], dc = out[c] + 1;
      for (let d = 0; d < 4; d++) {
        const n = L.nb[c * 4 + d];
        if (n >= 0 && out[n] > dc) { out[n] = dc; q[t++] = n; }
      }
    }
    return out;
  }
  function nearestPellet(L, start, avoid) {
    const N = L.N, seen = L._seen || (L._seen = new Int32Array(N)), q = L._q || (L._q = new Int32Array(N));
    L._stamp = (L._stamp || 0) + 1;
    const st = L._stamp;
    const dist = L._dist || (L._dist = new Int16Array(N));
    let h = 0, t = 0;
    q[t++] = start; seen[start] = st; dist[start] = 0;
    if (avoid >= 0) seen[avoid] = st;
    while (h < t) {
      const c = q[h++];
      if (L.pel[c]) return dist[c];
      if (dist[c] > 40) break;
      for (let d = 0; d < 4; d++) {
        const n = L.nb[c * 4 + d];
        if (n >= 0 && seen[n] !== st) { seen[n] = st; dist[n] = dist[c] + 1; q[t++] = n; }
      }
    }
    return 45;
  }

  function makeEntity(L, tile, d) {
    const x = tile % L.Gw, y = Math.floor(tile / L.Gw);
    let dd = d;
    for (let k = 0; k < 4 && L.nb[tile * 4 + dd] < 0; k++) dd = (dd + 1) % 4;
    return { tile, x, y, bx: x, by: y, d: dd, p: 0, ux: x, uy: y, ang: dd * TAU / 4, moving: true, hist: [] };
  }

  let PURSUER_N = 0;
  function addPursuer(L, beh, k, from) {
    let tile;
    if (from) tile = from.tile;
    else {
      // Somewhere far from the chomper.
      let best = L.home, bd = -1;
      for (let a = 0; a < 40; a++) {
        const t = Math.floor(L.rnd() * L.N);
        if (L.wall[t]) continue;
        const dd = L.chomp ? L.chomp.map[t] : 99;
        if (dd > bd && dd < 999) { bd = dd; best = t; }
        if (bd > 10 && a > 10) break;
      }
      tile = best;
    }
    const e = makeEntity(L, tile, from ? (from.d + 2) % 4 : Math.floor(L.rnd() * 4));
    e.beh = beh; e.inkI = (k + (from ? 1 : 0)) % 4; e.sp = from ? from.sp + 1 : (k * 1.37) % 5; e.spT = e.sp;
    e.id = PURSUER_N++; e.map = bfs(L, e.tile); e.fright = false; e.dead = 0; e.fade = from ? 0.01 : 1;
    e.clone = !!from; e.dissolve = 0; e.flip = 0; e.phase = L.rnd() * TAU;
    if (from) { e.p = from.p; e.bx = from.bx; e.by = from.by; e.x = from.x; e.y = from.y; e.tile = from.tile; e.d = from.d; reverse(L, e); e.ux = from.ux; e.uy = from.uy; }
    L.pursuers.push(e);
    return e;
  }

  function reverse(L, e) {
    // Turn round mid-corridor: the tile we were heading to becomes the base.
    const nt = L.nb[e.tile * 4 + e.d];
    if (nt < 0 || e.p <= 0) { e.d = (e.d + 2) % 4; if (L.nb[e.tile * 4 + e.d] < 0) e.d = (e.d + 2) % 4; return; }
    e.bx += DX[e.d]; e.by += DY[e.d];
    e.tile = nt; e.x = nt % L.Gw; e.y = Math.floor(nt / L.Gw);
    e.d = (e.d + 2) % 4; e.p = 1 - e.p;
  }

  // Step an entity along its corridor; returns true on each arrival.
  function stepEntity(L, e, dist, onArrive) {
    if (!e.moving) { onArrive(e); if (!e.moving) return; }
    e.p += dist;
    let guard = 0;
    while (e.p >= 1 && guard++ < 4) {
      const nt = L.nb[e.tile * 4 + e.d];
      if (nt < 0) { e.p = 0; break; }
      e.bx += DX[e.d]; e.by += DY[e.d];
      e.tile = nt; e.x = nt % L.Gw; e.y = Math.floor(nt / L.Gw);
      e.p -= 1;
      onArrive(e);
      if (L.nb[e.tile * 4 + e.d] < 0) { e.p = 0; e.moving = false; break; }
    }
    e.ux = e.bx + DX[e.d] * e.p; e.uy = e.by + DY[e.d] * e.p;
  }

  // ---------------------------------------------------------------- AI
  function chomperDecide(L, S) {
    const c = L.chomp, t = c.tile;
    const pel = L.pel[t];
    if (pel) eatPellet(L, t, S);
    c.map = bfs(L, t, c.map);
    // Ambush target: four ahead; mirror target: across the centre line.
    let at = t;
    for (let k = 0; k < 4; k++) { const n = L.nb[at * 4 + c.d]; if (n < 0) break; at = n; }
    c.aheadMap = bfs(L, at, c.aheadMap === c.map ? null : c.aheadMap);
    const mx = mod(L.Gw - c.x, L.Gw), mt = c.y * L.Gw + mx;
    c.mirrorMap = bfs(L, L.wall[mt] ? t : mt, c.mirrorMap === c.map ? null : c.mirrorMap);
    let best = -1, bs = -1e9;
    const powered = S.power > 0;
    const portalMap = L.portal ? L.portal.map : null;
    for (let d = 0; d < 4; d++) {
      const n = L.nb[t * 4 + d];
      if (n < 0) continue;
      let s = -nearestPellet(L, n, t) * 1.0;
      for (const g of L.pursuers) {
        if (g.dead > 0 || g.fade < 0.6 || g.dissolve > 0) continue;
        const gd = g.map[n];
        if (g.fright) { if (gd < 12) s -= gd * 0.35 - 4; }
        else if (gd < 7) s -= (7 - gd) * (7 - gd) * 1.6;
      }
      if (portalMap) s -= portalMap[n] * 2.5;
      if (d === (c.d + 2) % 4) s -= 2.5;
      s += L.rnd() * 0.4;
      if (s > bs) { bs = s; best = d; }
    }
    if (best >= 0) { c.d = best; c.moving = true; } else c.moving = false;
    void powered;
  }

  function pursuerDecide(L, e, S) {
    const t = e.tile;
    e.map = bfs(L, t, e.map);
    const c = L.chomp;
    let target = null, flee = false;
    if (e.fright) flee = true;
    else if (L.mode === 'scatter' && !e.clone) target = L.corners[e.beh % 4];
    else if (e.beh === 0) target = c.map;
    else if (e.beh === 1) target = c.aheadMap;
    else if (e.beh === 2) target = c.mirrorMap;
    else target = c.map[t] > 8 ? c.map : null;
    let best = -1, bs = -1e9;
    const rev = (e.d + 2) % 4;
    for (let d = 0; d < 4; d++) {
      const n = L.nb[t * 4 + d];
      if (n < 0) continue;
      let s = L.rnd() * (target ? 0.5 : 3);
      if (flee) s += c.map[n] * 0.8;
      else if (target) s -= target[n];
      if (d === rev) s -= 50;
      if (s > bs) { bs = s; best = d; }
    }
    if (best >= 0) { e.d = best; e.moving = true; } else e.moving = false;
    void S;
  }

  function eatPellet(L, t, S) {
    const v = L.pel[t];
    L.pel[t] = 0;
    L.eaten++;
    L.flower[t] = -0.6 - L.rnd() * 1.4; // a seed: sprouts after a little while
    if (v === 2) S.startPower(t === S.grownTile ? 7 : 5, t === S.grownTile);
    if (v === 3) S.portalEaten = true;
    L.chomp.segs = Math.min(9, 3 + Math.floor(L.eaten / 40));
  }

  // ---------------------------------------------------------------- caches
  function buildCache(L, pal) {
    const c = document.createElement('canvas');
    c.width = L.canvas.width; c.height = L.canvas.height;
    const g = c.getContext('2d');
    const s = L.ppt, Gw = L.Gw, Gh = L.Gh, cw = c.width, ch = c.height;
    const corridors = (gg, ox, oy) => {
      gg.beginPath();
      for (let y = 0; y < Gh; y++) for (let x = 0; x < Gw; x++) {
        const i = y * Gw + x;
        if (L.wall[i]) continue;
        const px = (x + 0.5) * s + ox, py = (y + 0.5) * s + oy;
        for (const d of [0, 1]) {
          if (L.nb[i * 4 + d] < 0) continue;
          gg.moveTo(px, py); gg.lineTo(px + DX[d] * s, py + DY[d] * s);
        }
        gg.moveTo(px, py); gg.lineTo(px + 0.001, py);
      }
    };
    const all = (fn) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) fn(a * cw, b * ch); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Keyline, then the corridor floor.
    g.strokeStyle = css(pal.key);
    g.lineWidth = s * 0.96;
    all((ox, oy) => { corridors(g, ox, oy); g.stroke(); });
    g.strokeStyle = css(pal.floor);
    g.lineWidth = s * 0.8;
    all((ox, oy) => { corridors(g, ox, oy); g.stroke(); });
    // Baked shadow of the walls on the floor, light from the upper left.
    const sh = document.createElement('canvas');
    sh.width = cw; sh.height = ch;
    const sg = sh.getContext('2d');
    sg.fillStyle = 'rgba(0,0,0,1)';
    sg.fillRect(0, 0, cw, ch);
    sg.globalCompositeOperation = 'destination-out';
    sg.lineCap = 'round'; sg.lineJoin = 'round';
    sg.lineWidth = s * 0.96;
    const o = s * 0.14;
    all((ox, oy) => { corridors(sg, ox + o, oy + o); sg.stroke(); });
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.16;
    g.drawImage(sh, 0, 0);
    g.globalAlpha = 1;
    // Walls fill behind everything.
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = css(pal.wall);
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'source-over';
    // A fine print line on the wall tops.
    g.strokeStyle = css(mixRGB(pal.wall, pal.key, 0.35));
    g.lineWidth = Math.max(1, s * 0.05);
    g.lineCap = 'butt';
    for (let y = 0; y < Gh; y++) for (let x = 0; x < Gw; x++) {
      const i = y * Gw + x;
      if (!L.wall[i] || hash2(i, 99) < 0.55) continue;
      const cx = (x + 0.5) * s, cy = (y + 0.5) * s;
      g.beginPath();
      g.arc(cx, cy, s * 0.13, 0, TAU);
      g.stroke();
    }
    return c;
  }
  function thumb(src, size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, TAU); g.clip();
    const k = size / Math.min(src.width, src.height) * 1.6;
    g.drawImage(src, size / 2 - src.width * k / 2, size / 2 - src.height * k / 2, src.width * k, src.height * k);
    return c;
  }
  const FLOWER_CACHE = {};
  function flowerSprites(pi) {
    if (FLOWER_CACHE[pi]) return FLOWER_CACHE[pi];
    const P = PAL[pi].n;
    const out = [];
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      g.translate(32, 32);
      const col = P.flowers[k];
      const petals = 5 + (k % 2);
      g.fillStyle = col;
      g.strokeStyle = css(P.ink, 0.8);
      g.lineWidth = 2;
      for (let q = 0; q < petals; q++) {
        g.save();
        g.rotate(q * TAU / petals);
        g.beginPath();
        g.ellipse(15, 0, 13, 8, 0, 0, TAU);
        g.fill(); g.stroke();
        g.restore();
      }
      g.fillStyle = css(k === 1 ? P.chomp : hex(P.flowers[1]));
      g.beginPath(); g.arc(0, 0, 7.5, 0, TAU); g.fill(); g.stroke();
      out.push(c);
    }
    FLOWER_CACHE[pi] = out;
    return out;
  }

  // ---------------------------------------------------------------- creatures
  // Pursuer bodies are radial profiles; a morph blends two neighbours.
  const SPECIES = [
    { r: (a, t) => 1 + 0.06 * Math.sin(3 * a + t * 2.1), tend: 1, legs: 0, sx: 1.0, sy: 1.0 },            // bell
    { r: (a) => 0.78 + 0.38 * Math.pow(0.5 + 0.5 * Math.cos(5 * a), 2.2), tend: 0, legs: 0, sx: 1, sy: 1 }, // star
    { r: (a) => 0.86 + 0.2 * Math.abs(Math.cos(3 * a)), tend: 0, legs: 1, sx: 1.05, sy: 0.95 },          // six-lobed walker
    { r: (a, t) => 1 + 0.1 * Math.cos(8 * a + t), tend: 0.6, legs: 0, sx: 1.25, sy: 0.8 },              // cloud-squid
    { r: (a) => 0.95 + 0.14 * Math.cos(2 * a) + 0.06 * Math.cos(4 * a), tend: 0, legs: 0.7, sx: 1, sy: 1 }, // bean
  ];

  function drawPursuer(g, e, cx, cy, s, pal, T, S, chompPos) {
    const nS = SPECIES.length;
    const f0 = Math.floor(e.sp), fr = e.sp - f0;
    const A = SPECIES[mod(f0, nS)], B = SPECIES[mod(f0 + 1, nS)];
    const alive = e.dead > 0 ? 0 : 1;
    const scale = e.fade * (1 - e.dissolve) * (0.94 + 0.1 * S.bass) * (e.fright ? 0.86 : 1);
    if (scale < 0.02 || !alive) return;
    const R = s * 0.48 * scale;
    const sx = lerp(A.sx, B.sx, fr), sy = lerp(A.sy, B.sy, fr);
    const tend = lerp(A.tend, B.tend, fr), legs = lerp(A.legs, B.legs, fr);
    const ink = css(pal.ink);
    let body = pal.inks[(e.inkI) % 4];
    if (e.fright) body = mixRGB(pal.floor, pal.spot, 0.3);
    g.save();
    g.translate(cx, cy);
    // contact shadow
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.beginPath(); g.ellipse(s * 0.07, s * 0.1, R * 1.05, R * 0.95, 0, 0, TAU); g.fill();
    const flipK = Math.cos(e.flip * Math.PI);
    g.rotate(e.ang);
    g.scale(1, flipK < 0 ? -Math.max(0.15, -flipK) : Math.max(0.15, flipK));
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = ink;
    const lw = Math.max(1, s * 0.05);
    const wob = e.fright ? 0.12 : 0;
    const ph = e.phase + T * 9;
    // tendrils trail behind
    if (tend > 0.05) {
      g.lineWidth = s * 0.07 * tend;
      g.strokeStyle = css(body);
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(-R * 0.6 * sx, k * R * 0.4);
        for (let q = 1; q <= 5; q++) {
          const xx = -R * 0.6 * sx - q * R * 0.2 * tend;
          const yy = k * R * 0.4 + Math.sin(ph * 0.7 + q * 1.1 + k) * R * 0.12 * q * 0.5;
          g.lineTo(xx, yy);
        }
        g.stroke();
      }
      g.strokeStyle = ink;
    }
    // little legs with round feet
    if (legs > 0.05) {
      g.lineWidth = lw;
      for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) {
        const lx = (k - 1) * R * 0.55;
        const sw = Math.sin(ph + k * 2.1 + (sd > 0 ? Math.PI : 0)) * R * 0.25;
        const fx = lx + sw, fy = sd * R * (0.95 + 0.45 * legs);
        g.beginPath(); g.moveTo(lx, sd * R * 0.6); g.lineTo(fx, fy); g.stroke();
        g.fillStyle = ink;
        g.beginPath(); g.arc(fx, fy, s * 0.04 * legs, 0, TAU); g.fill();
      }
    }
    // body
    g.beginPath();
    const n = 40;
    for (let q = 0; q <= n; q++) {
      const a = q / n * TAU;
      let r = lerp(A.r(a, ph * 0.3), B.r(a, ph * 0.3), fr);
      if (wob) r += wob * Math.sin(a * 5 + ph * 1.3);
      const x = Math.cos(a) * r * R * sx, y = Math.sin(a) * r * R * sy;
      if (q === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = css(body);
    g.fill();
    g.lineWidth = lw * (e.fright ? 1.4 : 1);
    if (e.fright) g.setLineDash([s * 0.08, s * 0.06]);
    g.stroke();
    g.setLineDash([]);
    // eyes, looking toward the chomper
    const lookA = Math.atan2(chompPos[1] - cy, chompPos[0] - cx) - e.ang;
    for (const sd of [-1, 1]) {
      const ex = R * 0.32 * sx, ey = sd * R * 0.34;
      const er = R * 0.27;
      g.fillStyle = '#fffdf6';
      g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
      g.lineWidth = lw * 0.6; g.strokeStyle = ink; g.stroke();
      const pr = e.fright ? er * 0.3 : er * 0.52;
      const jig = e.fright ? Math.sin(ph * 3 + sd) * er * 0.3 : 0;
      g.fillStyle = ink;
      g.beginPath();
      g.arc(ex + Math.cos(lookA) * er * 0.4 + jig, ey + Math.sin(lookA) * er * 0.4, pr, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function drawChomper(g, c, cx, cy, s, pal, T, S) {
    const ink = css(pal.ink), body = css(pal.chomp), spot = css(pal.spot);
    const lw = Math.max(1, s * 0.05);
    const pump = 1 + 0.2 * c.kick;
    const pop = c.pop * (c.caught > 0 ? Math.max(0, 1 - c.caughtT) : 1);
    if (pop < 0.02) return;
    // Segments trail along the path actually taken.
    const pts = segPoints(c, c.segs, 0.58);
    const R0 = s * 0.37 * pump * pop;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // shadows first
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let k = pts.length - 1; k >= 0; k--) {
      const q = pts[k], rr = s * (0.3 - k * 0.012) * pop;
      g.beginPath(); g.arc(cx + q[0] * s + s * 0.07, cy + q[1] * s + s * 0.1, rr, 0, TAU); g.fill();
    }
    g.beginPath(); g.arc(cx + s * 0.07, cy + s * 0.1, R0, 0, TAU); g.fill();
    const ph = T * 14;
    for (let k = pts.length - 1; k >= 0; k--) {
      const q = pts[k];
      const rr = s * (0.3 - k * 0.012) * pop;
      const px = cx + q[0] * s, py = cy + q[1] * s;
      const a = q[2];
      // legs
      g.strokeStyle = ink; g.lineWidth = lw * 0.9;
      const sw = Math.sin(ph - k * 0.9) * 0.5;
      for (const sd of [-1, 1]) {
        const la = a + sd * (Math.PI / 2 + sw * sd);
        g.beginPath(); g.moveTo(px, py);
        g.lineTo(px + Math.cos(la) * rr * 1.45, py + Math.sin(la) * rr * 1.45);
        g.stroke();
      }
      g.fillStyle = body;
      g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
      g.lineWidth = lw; g.stroke();
      g.fillStyle = spot;
      g.beginPath(); g.arc(px + Math.cos(a + 2) * rr * 0.3, py + Math.sin(a + 2) * rr * 0.3, rr * 0.3, 0, TAU); g.fill();
    }
    // head
    g.save();
    g.translate(cx, cy);
    g.rotate(c.ang + (c.caught > 0 ? c.caughtT * 12 : 0));
    const R = R0;
    const J = c.jawOpen;
    // mandibles: two curved horns hinged at the front corners of the head
    g.fillStyle = css(mixRGB(pal.ink, pal.chomp, 0.25));
    g.strokeStyle = ink; g.lineWidth = lw;
    for (const sd of [-1, 1]) {
      g.save();
      g.translate(R * 0.55, sd * R * 0.5);
      g.rotate(sd * (-0.35 + 1.05 * J));
      g.beginPath();
      g.moveTo(-R * 0.12, -sd * R * 0.2);
      g.quadraticCurveTo(R * 0.75, -sd * R * 0.05, R * 0.72, -sd * R * 0.62);
      g.quadraticCurveTo(R * 0.45, sd * R * 0.12, -R * 0.1, sd * R * 0.2);
      g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.stroke();
    // a pale crown stripe
    g.fillStyle = spot;
    g.beginPath(); g.ellipse(-R * 0.35, 0, R * 0.22, R * 0.62, 0, 0, TAU); g.fill();
    // eyes
    for (const sd of [-1, 1]) {
      g.fillStyle = '#fffdf6';
      g.beginPath(); g.arc(R * 0.28, sd * R * 0.4, R * 0.3, 0, TAU); g.fill();
      g.lineWidth = lw * 0.6; g.stroke();
      g.fillStyle = ink;
      g.beginPath(); g.arc(R * 0.4, sd * R * 0.38, R * 0.15, 0, TAU); g.fill();
    }
    g.restore();
    void S;
  }

  function segPoints(c, n, gap) {
    // Walk back along the head's history, one point every `gap` tiles.
    const h = c.hist, out = [];
    let need = gap, px = c.ux, py = c.uy, i = h.length - 1;
    let acc = 0;
    while (out.length < n && i >= 0) {
      const qx = h[i][0], qy = h[i][1];
      const d = Math.hypot(qx - px, qy - py);
      if (acc + d >= need) {
        const t = (need - acc) / Math.max(1e-6, d);
        const sx = px + (qx - px) * t, sy = py + (qy - py) * t;
        out.push([sx - c.ux, sy - c.uy, Math.atan2(py - qy, px - qx)]);
        px = sx; py = sy; acc = 0; need = gap;
        continue;
      }
      acc += d; px = qx; py = qy; i--;
    }
    return out;
  }

  // ---------------------------------------------------------------- WebGL
  const GLSL_COMMON = `#version 300 es
precision highp float;
uniform vec2 uC; uniform vec2 uG; uniform float uT; uniform vec2 uA; uniform float uR2min;
uniform vec3 uCam; uniform vec3 uRight; uniform vec3 uDown; uniform vec3 uFwd;
uniform float uFoc; uniform vec2 uHalf; uniform vec2 uNF; uniform vec2 uSpan;
vec3 fold(float du, float dv, float h){
  float x=du*uT, y=dv*uT, z=h*uT;
  if(abs(uA.x)>1e-4){ float R=uG.y*uT/(6.2831853*uA.x); float ph=y/R; float rr=R+z; y=rr*sin(ph); z=rr*cos(ph)-R; }
  if(uA.y>1e-4){ float Rn=uG.x*uT/(6.2831853*uA.y); float R=max(Rn,uR2min); float th=x/Rn; float rr=R+z; x=rr*sin(th); z=rr*cos(th)-R; }
  return vec3(x,y,z);
}
vec4 project(vec3 P, out float depth){
  vec3 d=P-uCam; float X=dot(d,uRight), Y=dot(d,uDown), Z=dot(d,uFwd);
  depth=Z;
  float A=(uNF.y+uNF.x)/(uNF.y-uNF.x), B=-2.0*uNF.y*uNF.x/(uNF.y-uNF.x);
  return vec4(X*uFoc/uHalf.x, -Y*uFoc/uHalf.y, A*Z+B, Z);
}
`;
  const VS_FLOOR = GLSL_COMMON + `
in vec2 aST;
out vec2 vUV; out vec3 vP; out float vZ; out float vFace;
void main(){
  float du=aST.x*uSpan.x, dv=aST.y*uSpan.y;
  vec3 P=fold(du,dv,0.0);
  vUV=(uC+vec2(du,dv))/uG; vP=P; vFace=0.0;
  gl_Position=project(P,vZ);
}`;
  const VS_WALL = GLSL_COMMON + `
in vec3 aCorner; in float aFace; in vec2 aTile;
uniform vec2 uCopy; uniform float uWallH; uniform vec4 uRip;
out vec2 vUV; out vec3 vP; out float vZ; out float vFace;
void main(){
  float du=mod(aTile.x+0.5-uC.x+uG.x*0.5,uG.x)-uG.x*0.5+uCopy.x*uG.x;
  float dv=mod(aTile.y+0.5-uC.y+uG.y*0.5,uG.y)-uG.y*0.5+uCopy.y*uG.y;
  if(abs(du)>uSpan.x*0.5-0.5||abs(dv)>uSpan.y*0.5-0.5){ gl_Position=vec4(3.0,3.0,3.0,1.0); vUV=vec2(0.0); vP=vec3(0.0); vZ=0.0; vFace=0.0; return; }
  float cu=du+aCorner.x-0.5, cv=dv+aCorner.y-0.5;
  // the kick's ripple lifts a travelling ring of blocks round the chomper
  float rx=mod(aTile.x+0.5-uRip.x+uG.x*0.5,uG.x)-uG.x*0.5, ry=mod(aTile.y+0.5-uRip.y+uG.y*0.5,uG.y)-uG.y*0.5;
  float rd=length(vec2(rx,ry))-uRip.z;
  float bump=uRip.w*exp(-rd*rd/1.3)*min(1.0,uWallH*3.0);
  vec3 P=fold(cu,cv,aCorner.z*(uWallH+bump));
  vUV=(uC+vec2(cu,cv))/uG; vP=P; vFace=aFace;
  gl_Position=project(P,vZ);
}`;
  const FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vP; in float vZ; in float vFace;
uniform sampler2D uTex; uniform vec3 uSide; uniform vec3 uFogC; uniform vec3 uFogP; uniform vec3 uL; uniform vec3 uCam2;
out vec4 o;
void main(){
  vec3 n=normalize(cross(dFdx(vP),dFdy(vP)));
  if(dot(n,uCam2-vP)<0.0) n=-n;
  float sh=clamp(1.0+0.62*(dot(n,uL)-uL.z),0.28,1.12);
  vec3 c = vFace>0.5 ? uSide : texture(uTex,vUV).rgb;
  c*=sh;
  float f=uFogP.z*smoothstep(uFogP.x,uFogP.y,vZ);
  o=vec4(mix(c,uFogC,f),1.0);
}`;

  function initGL(self) {
    self.glTried = true;
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: true, depth: true });
    if (!gl) return;
    try {
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        return pr;
      };
      const pF = link(VS_FLOOR, FS), pW = link(VS_WALL, FS);
      // floor grid
      const NX = 180, NY = 110;
      const v = new Float32Array((NX + 1) * (NY + 1) * 2);
      let k = 0;
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { v[k++] = i / NX - 0.5; v[k++] = j / NY - 0.5; }
      const idx = new Uint16Array(NX * NY * 6);
      k = 0;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
        idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = c;
      }
      const vaoF = gl.createVertexArray();
      gl.bindVertexArray(vaoF);
      const bF = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bF); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      const locST = gl.getAttribLocation(pF, 'aST');
      gl.enableVertexAttribArray(locST); gl.vertexAttribPointer(locST, 2, gl.FLOAT, false, 0, 0);
      const bI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      // wall box: top + four sides
      const faces = [
        [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], 0],
        [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], 1],
        [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1], 1],
        [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], 1],
        [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1], 1],
      ];
      const bx = [];
      for (const f of faces) for (const q of [0, 1, 2, 0, 2, 3]) bx.push(f[q][0], f[q][1], f[q][2], f[4]);
      const vaoW = gl.createVertexArray();
      gl.bindVertexArray(vaoW);
      const bW = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bW); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bx), gl.STATIC_DRAW);
      const lC = gl.getAttribLocation(pW, 'aCorner'), lFa = gl.getAttribLocation(pW, 'aFace'), lT = gl.getAttribLocation(pW, 'aTile');
      gl.enableVertexAttribArray(lC); gl.vertexAttribPointer(lC, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(lFa); gl.vertexAttribPointer(lFa, 1, gl.FLOAT, false, 16, 12);
      const bT = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bT);
      gl.enableVertexAttribArray(lT); gl.vertexAttribPointer(lT, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(lT, 1);
      gl.bindVertexArray(null);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      const U = (pr) => {
        const o = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(pr, i); o[info.name] = gl.getUniformLocation(pr, info.name); }
        return o;
      };
      self.GL = { gl, cv, pF, pW, uF: U(pF), uW: U(pW), vaoF, vaoW, bT, tex, nIdx: idx.length, wallLevel: -1, nWalls: 0 };
    } catch (err) {
      console.warn('chomper: WebGL unavailable, flat only', err && err.message);
      self.GL = null;
    }
  }

  // ---------------------------------------------------------------- scene
  const CHAPTERS = ['Torus', 'Tabletop chase', 'Tunnel', 'Drum'];
  const FLAT = { pitch: 0, yaw: 0, a1: 0, a2: 0, zoom: 1.03, ldist: Math.log(300), wallH: 0, follow: 0, Fz: 0, fog: 0, fogA: 0, fogB: 1, K: 1, spinU: 0, spinV: 0 };

  VIZ.register({
    id: 'chomperv2',
    name: 'Chomper',
    versionOf: 'chomper',
    version: 'V2',
    order: 704,

    params: [
      { key: 'surreal', label: 'Surrealism', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'chapter', label: 'Surreal chapter', type: 'select', options: ['Auto (a new one each drop)'].concat(CHAPTERS), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Game speed', type: 'range', min: 0.4, max: 2, default: 1, step: 0.01 },
      { key: 'colours', label: 'Colours', type: 'select', options: ['Auto (new inks each maze)'].concat(PALETTES.map(p => p.name)), default: 0 },
      { key: 'scale', label: 'Maze scale (next maze)', type: 'range', min: 0.6, max: 1.6, default: 1, step: 0.01 },
      { key: 'crowd', label: 'Pursuers', type: 'range', min: 1, max: 8, default: 4, step: 1 },
    ],

    actions: [
      { id: 'dive', label: 'Dive into a new maze', run() { this.forceDive = true; } },
      { id: 'chapter', label: 'Next surreal chapter', run() { this.forceChapter = true; } },
    ],

    gallery: {
      title: 'Chomper',
      technique: 'A real self-playing maze game (generated wrapping maze, BFS chomper AI, four pursuer target rules) painted flat into a board canvas each frame, then uploaded as a texture onto a WebGL2 mesh folded in the vertex shader (tube, torus, drum, tilted table) with instanced extruded wall blocks; nested live mazes inside pellets and an exponential dive between levels in Canvas 2D. V2 drives the level structure from the song: a riser detector lifts the board in the build, and each spent drop opens the portal that dives into the next maze.',
      brief: 'An arcade maze game playing itself, then coming loose from the plane. A vermilion many-legged chomper with snapping mandibles eats through a wrapping maze, leaving a garden of flowers where the pellets were, chased by soft googly-eyed pursuers that keep changing species. Kicks snap the mandibles and send one ripple through the nearby pellets; snares turn the pursuers round and morph them; hats glint single pellets; bass swells pellets, walls and flowers. Through the build the flat board starts to lift, tilting into perspective toward the chapter to come. The drop grows a power pellet in the chomper\'s path: time slows, floor and walls trade colours, the pursuers turn to paper and multiply, and the board folds into the next surreal chapter: a spinning torus, a low chase over a tilted table, a flight down a maze-lined tunnel, a little drum planet. As the drop spends itself the board unfolds, still full of flowers, and a portal pellet opens just ahead of the chomper holding the next maze, live; the chomper eats it and dives inside, leaving the garden behind, and the breakdown settles into a clean maze at a new scale in new inks.',
      lineage: [
        'V1: Chomper (`chomper`, web/scenes/chomper.js), ranked #4 of 72 by the six-judge panel (mean 7.5). Raph\'s own sketch: "Pacman playing itself, but complexity and surrealism x100", kept original (no borrowed character, ghosts, maze or sounds).',
        'Acted on: the curator\'s "accumulation without erasure" (and the director\'s theme 7): V1\'s garden only grew, and its portal opened only after 55-110 s, so the dive happened once in 96 s. V2 opens the portal as each drop spends itself, so every breakdown is a dive into a new maze: erasure, recursion and a new world in one move. The director\'s missing anticipation: V1\'s build looked like its intro; V2\'s board lifts into perspective on the riser. The psychonaut\'s "the rest is a game", reinterpreted: the calm stays a game (the arcade grammar is the brief\'s starting point) but now begins to break before the drop and ends in a dive.',
        'Rejected: per-section chapter captions (small type does not read at distance, and the chapters read as shapes); swapping the cream opener for a dark one (it is the identity; the faster level turnover brings the dark Night arcade and Blueprint inks within the first minute).',
        'Kept exactly: the game, the four chapters and their staged camera mixes, the creatures, the garden, the confined kick (mandibles and a ring of lifted blocks), snare, hats and the power-pellet inversion.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.level = null;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0, pad: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.power = 0; this.inv = 0; this.slow = 0;
      this.chap = -1; this.chapPrev = -1; this.chapX = 1; this.chapAge = 0; this.armed = true; this.dropArmed = true;
      this.flatten = 0; this.dive = null; this.diveWait = false;
      this.cam = null; this.spinU = 0; this.spinV = 0;
      this.headYaw = 0; this.axisYaw = Math.PI / 2;
      this.levelCount = 0; this.seed = Math.floor(Math.random() * 100000);
      this.rip = 9; this.ripAmp = 0;
      this.snareN = 0;
      this.spent = false; this.lean = 0;
    },

    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      this.kickHit = 0; this.snareHit = 0; this.hatHit = 0;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; this.kickHit = kRaw; }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.4 : 0.7, dt);
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; this.snareHit = 0.6 + 0.4 * sRaw; }
      e.prevS = sRaw;
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; this.hatSeed = (this.hatSeed + 1) % 997; this.hatHit = hRaw; }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.2, dt);
      e.pad = ease(e.pad, clamp01((s[2] + s[3] + s[4]) / 240), 1.5, dt);
      // Treble energy on a slow ease: it climbs through a riser and a build's
      // thickening hats, which is what lifts the board before the drop.
      e.rise = ease(e.rise || 0, clamp01((s[6] + s[7] + s[8]) / 240), 0.9, dt);
    },

    palIndexFor(params) {
      const c = Math.round(params.colours);
      if (c > 0) return clamp(c - 1, 0, PALETTES.length - 1);
      return this.levelCount % PALETTES.length;
    },

    startPower(dur, big) {
      // Only the pellet the drop grew inverts the board and slows time; the
      // corner pellets just frighten the pursuers, so the drop keeps its moment.
      this.power = Math.max(this.power, dur);
      if (big) { this.bigPower = dur; this.slow = 1; }
      const L = this.level;
      for (const g of L.pursuers) if (g.dead <= 0) { g.fright = true; reverse(L, g); }
    },

    // ------------------------------------------------------------ simulation
    simLevel(L, gdt, dt, S, isMain) {
      L.age += gdt;
      const c = L.chomp;
      // scatter / chase phases
      L.modeT += gdt;
      if (L.mode === 'scatter' && L.modeT > 5) { L.mode = 'chase'; L.modeT = 0; }
      else if (L.mode === 'chase' && L.modeT > 16) { L.mode = 'scatter'; L.modeT = 0; }
      const spd = S.speed;
      // chomper
      if (c.caught > 0) {
        c.caughtT += dt / 1.1;
        if (c.caughtT >= 1) {
          c.caught = 0; c.pop = 0.01;
          // reappear far from every pursuer, out of a flower
          // With a portal open, reappear a few tiles from it: a catch in the
          // breakdown must not push the dive into the next build.
          let best = c.tile, bd = -1e9;
          const pm = L.portal ? L.portal.map : null;
          for (let a = 0; a < 60; a++) {
            const t = Math.floor(L.rnd() * L.N);
            if (L.wall[t] || (pm && pm[t] === 0)) continue;
            let m = 999;
            for (const g of L.pursuers) if (g.dead <= 0) m = Math.min(m, g.map[t]);
            if (pm) m = Math.min(m, 6) - Math.abs(pm[t] - 3);
            if (m > bd) { bd = m; best = t; }
          }
          const ne = makeEntity(L, best, c.d);
          const ox = c.bx - c.x, oy = c.by - c.y;
          Object.assign(c, { tile: ne.tile, x: ne.x, y: ne.y, bx: ne.x + ox, by: ne.y + oy, p: 0, d: ne.d, moving: true });
          c.ux = c.bx; c.uy = c.by; c.hist.length = 0;
          chomperDecide(L, S);
        }
      } else {
        const v = (6.2 + 0.8 * S.bass) * spd * (S.power > 0 ? 1.12 : 1);
        stepEntity(L, c, v * gdt, () => chomperDecide(L, S));
      }
      c.pop = Math.min(1, c.pop + dt * 3);
      c.ang = easeAng(c.ang, c.d * TAU / 4, 16, dt);
      const lh = c.hist[c.hist.length - 1];
      if (!lh || Math.hypot(lh[0] - c.ux, lh[1] - c.uy) > 0.06) { c.hist.push([c.ux, c.uy]); if (c.hist.length > 260) c.hist.shift(); }
      // pursuers
      for (let k = L.pursuers.length - 1; k >= 0; k--) {
        const g = L.pursuers[k];
        g.fade = Math.min(1, g.fade + dt * 2);
        g.flip = Math.max(0, g.flip - dt * 3.5);
        g.sp = ease(g.sp, g.spT, 5, dt);
        g.spT += dt * 0.015;
        if (g.dissolve > 0) {
          g.dissolve += dt * 1.6;
          if (g.dissolve >= 1) {
            if (!L.wall[g.tile] && !L.pel[g.tile]) { L.flower[g.tile] = Math.max(L.flower[g.tile], 0.05); L.fcol[g.tile] = g.inkI % 4; }
            L.pursuers.splice(k, 1);
          }
          continue;
        }
        if (g.dead > 0) {
          g.dead -= gdt;
          if (g.dead <= 0) {
            const t0 = g.tile;
            let best = t0, bd = -1;
            for (let a = 0; a < 40; a++) {
              const t = Math.floor(L.rnd() * L.N);
              if (L.wall[t]) continue;
              if (c.map[t] > bd) { bd = c.map[t]; best = t; }
            }
            const ne = makeEntity(L, best, g.d);
            Object.assign(g, { tile: ne.tile, x: ne.x, y: ne.y, bx: ne.x, by: ne.y, ux: ne.x, uy: ne.y, p: 0, d: ne.d, moving: true, fade: 0.01, fright: false });
            g.map = bfs(L, g.tile, g.map);
          }
          continue;
        }
        const base = g.fright ? 3.4 : (5.3 + 0.5 * S.bass);
        stepEntity(L, g, base * spd * gdt, () => pursuerDecide(L, g, S));
        g.ang = easeAng(g.ang, g.d * TAU / 4, 10, dt);
        g.hist.push([g.ux, g.uy]); if (g.hist.length > 24) g.hist.shift();
        // collision with the chomper (periodic distance)
        if (c.caught <= 0 && g.fade > 0.7) {
          const ddx = wrapD(g.ux - c.ux, L.Gw), ddy = wrapD(g.uy - c.uy, L.Gh);
          if (ddx * ddx + ddy * ddy < 0.36) {
            if (g.fright) {
              g.dead = 2.5;
              for (let q = 0; q < 9; q++) L.particles.push({ x: mod(g.ux, L.Gw) + 0.5, y: mod(g.uy, L.Gh) + 0.5, vx: Math.cos(q / 9 * TAU) * 3, vy: Math.sin(q / 9 * TAU) * 3, life: 1, col: g.inkI % 4, rot: q });
            } else if (isMain) {
              c.caught = 1; c.caughtT = 0;
              L.mode = 'scatter'; L.modeT = 0;
              for (const h of L.pursuers) reverse(L, h);
            }
          }
        }
      }
      // gardens: seeds sprout, flowers grow
      const grow = gdt * (0.12 + 0.35 * S.E);
      let pellets = 0;
      for (let i = 0; i < L.N; i++) {
        const f = L.flower[i];
        if (f < 0) L.flower[i] = Math.min(0.02, f + gdt);
        else if (f > 0 && f < 1) L.flower[i] = Math.min(1, f + grow);
        if (L.pel[i] === 1) pellets++;
      }
      L.pellets = pellets;
      // regrowth keeps the game going: a flower closes back into a pellet
      if (pellets < L.total * 0.3 && !L.portal) {
        L.regrow = (L.regrow || 0) + gdt * 4;
        while (L.regrow > 1) {
          L.regrow -= 1;
          const t = Math.floor(L.rnd() * L.N);
          if (!L.wall[t] && !L.pel[t] && L.flower[t] > 0.9 && c.map[t] > 5) { L.pel[t] = 1; L.flower[t] = 0; }
        }
      }
      for (let k = L.particles.length - 1; k >= 0; k--) {
        const q = L.particles[k];
        q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt * 0.9;
        if (q.life <= 0) L.particles.splice(k, 1);
      }
    },

    // ------------------------------------------------------------ board painting
    paintBoard(L, S, pal, inv, forThumbOnly) {
      const g = L.g, s = L.ppt, Gw = L.Gw, Gh = L.Gh, cw = L.canvas.width, ch = L.canvas.height;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(L.cacheN, 0, 0);
      if (inv > 0.004) { g.globalAlpha = inv; g.drawImage(L.cacheI, 0, 0); g.globalAlpha = 1; }
      const T = this.T;
      const c = L.chomp;
      const cux = mod(c.ux, Gw), cuy = mod(c.uy, Gh);
      // flowers
      const spr = flowerSprites(L.palIdx);
      const big = 0.72 + 0.75 * S.E * S.surreal;
      for (let i = 0; i < L.N; i++) {
        const f = L.flower[i];
        if (f <= 0.01) continue;
        const x = i % Gw, y = (i / Gw) | 0;
        const h1 = hash2(i, 7 + L.id), h2 = hash2(i, 13 + L.id);
        const gs = f * f * (3 - 2 * f);
        const sz = s * gs * big * (0.75 + 0.35 * h1) * (1 + 0.12 * S.bass);
        const a = h2 * TAU + 0.25 * Math.sin(T * 1.3 + h1 * 9) * (0.4 + S.bass);
        const k = sz / 64;
        const px = (x + 0.5 + (h1 - 0.5) * 0.3) * s, py = (y + 0.5 + (h2 - 0.5) * 0.3) * s;
        g.setTransform(Math.cos(a) * k, Math.sin(a) * k, -Math.sin(a) * k, Math.cos(a) * k, px, py);
        g.drawImage(spr[L.fcol[i]], -32, -32);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      // pellets: the kick ripple lifts them, hats glint a few
      const pr = s * 0.1 * (1 + 0.45 * S.bass);
      const hatK = S.hat, hs = S.hatSeed, react = S.react;
      const ripR = this.rip, ripA = this.ripAmp * react;
      g.fillStyle = css(pal.pellet);
      g.beginPath();
      const special = [];
      for (let i = 0; i < L.N; i++) {
        const v = L.pel[i];
        if (!v) continue;
        const x = i % Gw, y = (i / Gw) | 0;
        const px = (x + 0.5) * s, py = (y + 0.5) * s;
        if (v !== 1) { special.push(i); continue; }
        let r = pr;
        if (isMainLevel(this, L) && ripA > 0.01) {
          const dx = wrapD(x - cux, Gw), dy = wrapD(y - cuy, Gh);
          const d = Math.sqrt(dx * dx + dy * dy);
          const hop = Math.exp(-((d - ripR) * (d - ripR)) / 1.4) * ripA;
          r *= 1 + 1.6 * hop;
        }
        if (hatK > 0.05 && hash2(i, hs) < 0.1 * react) { special.push(i); continue; }
        g.moveTo(px + r, py); g.arc(px, py, r, 0, TAU);
      }
      g.fill();
      for (const i of special) {
        const v = L.pel[i];
        const x = i % Gw, y = (i / Gw) | 0;
        const px = (x + 0.5) * s, py = (y + 0.5) * s;
        if (v === 1) {
          // a glint: a four-point star in the chomper's ink
          const rr = pr * (1.6 + 2.2 * hatK);
          g.fillStyle = css(pal.chomp);
          g.beginPath();
          for (let q = 0; q < 8; q++) {
            const a = q * Math.PI / 4 + 0.3, r = q % 2 ? rr * 0.3 : rr;
            if (q === 0) g.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r); else g.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
          }
          g.closePath(); g.fill();
        } else if (v === 2) {
          // power pellet: a miniature of this very maze
          const rr = s * 0.4 * (1 + 0.12 * S.bass + 0.05 * Math.sin(T * 4 + i));
          g.drawImage(inv > 0.5 ? L.thumbI : L.thumbN, px - rr, py - rr, rr * 2, rr * 2);
          g.strokeStyle = css(pal.key); g.lineWidth = s * 0.07;
          g.beginPath(); g.arc(px, py, rr, 0, TAU); g.stroke();
          g.strokeStyle = css(pal.chomp); g.lineWidth = s * 0.05;
          g.beginPath(); g.arc(px, py, rr + s * 0.07, 0, TAU); g.stroke();
        }
      }
      // portal: the next maze, live
      if (L.portal && !forThumbOnly) {
        const P = L.portal, inner = L.inner;
        const px = (P.x + 0.5) * s, py = (P.y + 0.5) * s;
        const rr = s * this.portalR(S);
        if (!(this.dive && this.dive.outer === L)) {
          g.save();
          g.beginPath(); g.arc(px, py, rr, 0, TAU); g.clip();
          const vir = this.viewRadius();
          const Tin = this.tileSize(inner);
          // inner board scaled so the disc shows a whole screen of it
          const k = rr / (vir / Tin * inner.ppt);
          drawTiled(g, inner.canvas, px, py, k, 0, (this.innerCam(inner).u) * inner.ppt, (this.innerCam(inner).v) * inner.ppt, rr);
          g.restore();
        }
        g.strokeStyle = css(pal.key); g.lineWidth = s * 0.1;
        g.beginPath(); g.arc(px, py, rr, 0, TAU); g.stroke();
        g.strokeStyle = css(pal.chomp); g.lineWidth = s * 0.06;
        g.setLineDash([s * 0.18, s * 0.12]); g.lineDashOffset = -T * s * 0.6;
        g.beginPath(); g.arc(px, py, rr + s * 0.12, 0, TAU); g.stroke();
        g.setLineDash([]);
      }
      // particles (petals from eaten pursuers)
      for (const q of L.particles) {
        g.fillStyle = css(pal.inks[q.col], clamp01(q.life));
        g.save(); g.translate(q.x * s, q.y * s); g.rotate(q.rot + T * 3);
        g.beginPath(); g.ellipse(0, 0, s * 0.16 * q.life, s * 0.08 * q.life, 0, 0, TAU); g.fill();
        g.restore();
      }
      // entities, with wrapped copies near the edges
      const chompPx = [(cux + 0.5) * s, (cuy + 0.5) * s];
      const copies = (ux, uy, fn) => {
        const bx = (mod(ux, Gw) + 0.5) * s, by = (mod(uy, Gh) + 0.5) * s;
        const m = s * 1.6;
        for (const ox of [0, -cw, cw]) {
          if (ox < 0 && bx < cw - m) continue;
          if (ox > 0 && bx > m) continue;
          for (const oy of [0, -ch, ch]) {
            if (oy < 0 && by < ch - m) continue;
            if (oy > 0 && by > m) continue;
            fn(bx + ox, by + oy);
          }
        }
      };
      // kick ring around the chomper
      if (isMainLevel(this, L) && ripA > 0.02 && ripR < 7) {
        copies(c.ux, c.uy, (x, y) => {
          g.strokeStyle = css(pal.chomp, clamp01(ripA * (1 - ripR / 7)));
          g.lineWidth = s * 0.07;
          g.beginPath(); g.arc(x, y, ripR * s, 0, TAU); g.stroke();
        });
      }
      const echoes = this.slow > 0.08 && isMainLevel(this, L);
      for (const e of L.pursuers) {
        if (echoes && e.hist.length > 12) {
          for (const lag of [18, 12, 6]) {
            const hp = e.hist[Math.max(0, e.hist.length - 1 - Math.round(lag * this.slow * 1.4))];
            g.globalAlpha = 0.22 * this.slow;
            copies(hp[0], hp[1], (x, y) => drawPursuer(g, e, x, y, s, pal, T, S, chompPx));
          }
          g.globalAlpha = 1;
        }
        copies(e.ux, e.uy, (x, y) => drawPursuer(g, e, x, y, s, pal, T, S, chompPx));
      }
      copies(c.ux, c.uy, (x, y) => drawChomper(g, c, x, y, s, pal, T, S));
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    },

    portalR(S) { return 1.15 * (1 + 0.08 * S.bass); },
    viewRadius() { return Math.hypot(this.W, this.H) / 2; },
    tileSize(L) { return Math.max(this.W / L.Gw, this.H / L.Gh); },
    innerCam(L) {
      if (!L.cam) L.cam = { u: mod(L.chomp.ux, L.Gw) + 0.5, v: mod(L.chomp.uy, L.Gh) + 0.5 };
      return L.cam;
    },

    // ------------------------------------------------------------ camera config
    chapterCfg(ci, L, T) {
      const Gw = L.Gw, Gh = L.Gh;
      const R1 = Gh / TAU, R2 = Math.max(Gw / TAU, 3.0 * R1);
      const HT = this.H / this.tileSize(L);
      switch (CHAPTERS[ci]) {
        case 'Torus': return { pitch: 0.78, yaw: 0.35 * Math.sin(T * 0.05), a1: 1, a2: 1, zoom: HT / (2.25 * R2), ldist: Math.log(26), wallH: 0.3, follow: 0.9, Fz: -R2, fog: 0.35, fogA: -R2 * 0.2, fogB: R2 * 1.6, K: 0, spinU: 0.25, spinV: 0.1 };
        case 'Tabletop chase': return { pitch: 0.9, yaw: this.headYaw, a1: 0, a2: 0, zoom: 1.75, ldist: Math.log(12), wallH: 0.6, follow: 1, Fz: 0, fog: 0.5, fogA: 3, fogB: 16, K: 1.5, spinU: 0, spinV: 0 };
        case 'Tunnel': return { pitch: 1.5, yaw: Math.PI / 2 + 0.22 * Math.sin(T * 0.045), a1: -1, a2: 0, zoom: 0.95, ldist: Math.log(3.4), wallH: 0.35, follow: 1, Fz: 0.62 * R1, fog: 0.85, fogA: 1, fogB: 22, K: 3, spinU: 0, spinV: 0 };
        default: return { pitch: 1.2, yaw: 0.3 * Math.sin(T * 0.04), a1: 0.34, a2: 0, zoom: 1.5, ldist: Math.log(10), wallH: 0.6, follow: 1, Fz: 0, fog: 0.5, fogA: 3, fogB: 20, K: 2, spinU: 0, spinV: 0 };
      }
    },

    liftCfg(T) {
      return { pitch: 0.62, yaw: 0.18 * Math.sin(T * 0.07), a1: 0, a2: 0, zoom: 1.12, ldist: Math.log(16), wallH: 0.5, follow: 0.6, Fz: 0, fog: 0.3, fogA: 6, fogB: 22, K: 1.5, spinU: 0, spinV: 0 };
    },

    // Staged mix, so the camera never passes through the tunnel wall: going
    // into a fold the camera arrives first and the sheet then curls round it;
    // coming out of a tunnel the sheet opens first and then the camera leaves.
    mixCfg(A, B, t) {
      let tc = t, tf = t;
      if (B.a1 < -0.01 || (A.a1 >= -0.01 && A === FLAT)) { tc = sstep(0, 0.55, t); tf = sstep(0.45, 1, t); }
      else if (A.a1 < -0.01) { tf = sstep(0, 0.55, t); tc = sstep(0.45, 1, t); }
      const o = {};
      for (const k in A) {
        const u = (k === 'a1' || k === 'a2' || k === 'wallH' || k === 'K') ? tf : tc;
        o[k] = k === 'yaw' ? A.yaw + wrapA(B.yaw - A.yaw) * u : lerp(A[k], B[k], u);
      }
      return o;
    },

    // ------------------------------------------------------------ draw
    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      this.W = W; this.H = H;
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null || this.lastT === undefined ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      if (!this.env) this.enter();
      this.T += dt;
      const T = this.T;
      this.listen(signals, dt);
      const e = this.env;
      const devScale = p.width / W * p.pixelDensity();
      const surreal = params.surreal, react = params.react;
      this.react = react;
      if (!this.level) { this.level = newLevel(0, this.palIndexFor(params), W, H, devScale, params, this.seed); this.levelCount = 0; }
      let L = this.level;

      // --- music -> game events
      const E = Math.min(1, sstep(0.25, 0.9, e.drop) * surreal);
      const S = {
        E, surreal, react, speed: params.speed, bass: e.bass, hat: e.hat, hatSeed: this.hatSeed,
        power: this.power, startPower: (d, b) => this.startPower(d, b), portalEaten: false, grownTile: this.growT,
      };
      if (this.kickHit) { this.rip = 0; this.ripAmp = 0.7 + 0.5 * this.kickHit; L.chomp.kickT = 1; }
      this.rip += dt * 16;
      this.ripAmp *= Math.exp(-dt / 0.35);
      const ck = L.chomp;
      ck.kick = Math.max(0, (ck.kick || 0) * Math.exp(-dt / 0.12));
      if (this.kickHit) ck.kick = clamp01(0.6 + 0.6 * this.kickHit) * Math.min(1.4, react);
      const chew = ck.moving ? 0.5 + 0.5 * Math.sin(T * 11) : 0;
      ck.jawOpen = clamp01(0.08 + 0.14 * chew + 0.9 * ck.kick);
      if (this.snareHit) {
        this.snareN++;
        let k = 0;
        for (const gg of L.pursuers) {
          if (gg.dead > 0 || gg.dissolve > 0) continue;
          if ((k++ + this.snareN) % 2 === 0) reverse(L, gg);
          gg.flip = 1;
          gg.spT = Math.round(gg.spT) + 1;
          gg.inkI = (gg.inkI + 1) % 4;
        }
        // in the drop the pursuers multiply
        const cap = Math.round(params.crowd) + Math.round(9 * E * Math.min(1.5, surreal));
        if (E > 0.5 && L.pursuers.length < cap) {
          const live = L.pursuers.filter(q => q.dead <= 0 && q.dissolve <= 0);
          if (live.length) addPursuer(L, Math.floor(L.rnd() * 4), L.pursuers.length, live[Math.floor(L.rnd() * live.length)]);
        }
      }
      // calm: clones melt into flowers, one at a time
      if (E < 0.3) {
        this.meltT = (this.meltT || 0) + dt;
        if (this.meltT > 0.8) {
          this.meltT = 0;
          const cl = L.pursuers.find(q => q.clone && q.dissolve <= 0 && q.dead <= 0);
          if (cl) cl.dissolve = 0.01;
        }
      }
      // pursuer count param changed
      const base = L.pursuers.filter(q => !q.clone).length;
      if (base < Math.round(params.crowd)) addPursuer(L, base % 4, base);
      else if (base > Math.round(params.crowd)) { const q = L.pursuers.find(q => !q.clone && q.dissolve <= 0); if (q) q.dissolve = 0.01; }

      // the drop: a power pellet grows in the chomper's path, and the next chapter begins
      // Once the energy is gone the calm maze starts leaning toward the next
      // chapter, so the build previews it and the drop arrives already on it.
      if (e.drop < 0.35 && !this.dropArmed) { this.dropArmed = true; this.chapPrev = this.chap; this.chapX = 0; }
      if (this.dropArmed && e.drop > 0.7) {
        this.dropArmed = false;
        const nt = L.nb[ck.tile * 4 + ck.d];
        const t2 = nt >= 0 ? nt : ck.tile;
        if (!L.portal) { L.pel[t2] = 2; this.growT = t2; }
        this.nextChapter(params, true);
      }
      if (E > 0.6) { this.chapAge += dt; this.spent = true; }
      if ((this.chapAge > 34 || this.forceChapter) && !this.dive) { this.forceChapter = false; this.nextChapter(params); }
      this.power = Math.max(0, this.power - dt);
      if (this.power <= 0) for (const gg of L.pursuers) gg.fright = false;
      this.bigPower = Math.max(0, (this.bigPower || 0) - dt);
      this.inv = ease(this.inv, this.bigPower > 0.6 ? 1 : 0, this.bigPower > 0.6 ? 6 : 1.4, dt);
      this.slow = Math.max(0, this.slow - dt / 2.4);
      const timeScale = 1 - 0.68 * sstep(0, 0.45, this.slow);
      S.power = this.power;

      // --- portal and the dive between levels
      // Every drop that has spent itself opens the way into the next maze, so
      // each breakdown is a dive (the reset the panel asked for) rather than a
      // garden that only grows. The age floor stops back-to-back short drops
      // from churning levels; the 110 s fallback serves music with no drops.
      const spentDrop = this.spent && E < 0.5 && L.age > 14;
      if (this.spent && E < 0.5 && !spentDrop) this.spent = false;
      if (!L.portal && !this.dive && (spentDrop || L.age > 110 || this.forceDive)) {
        this.forceDive = false;
        this.spent = false;
        // A few tiles ahead, so the chomper reaches it inside the breakdown.
        let best = -1, bd = 1e9;
        for (let a = 0; a < 120; a++) {
          const t = Math.floor(L.rnd() * L.N);
          if (L.wall[t] || t === ck.tile) continue;
          const d = Math.abs(ck.map[t] - 4) * 2 + ck.aheadMap[t] * 0.5;
          if (d < bd) { bd = d; best = t; }
        }
        if (best >= 0) {
          L.portal = { x: best % L.Gw, y: Math.floor(best / L.Gw), tile: best, map: bfs(L, best) };
          L.pel[best] = 3;
          this.levelCount++;
          L.inner = newLevel(this.levelCount, this.palIndexFor(params), W, H, devScale, params, this.seed);
        }
      }
      const gdt = dt * params.speed * timeScale * (this.dive ? 0.4 : 1);
      this.simLevel(L, gdt, dt, S, true);
      if (L.inner) {
        this.simLevel(L.inner, dt * params.speed, dt, Object.assign({}, S, { power: 0, E: 0, startPower() {} }), false);
        const ic = this.innerCam(L.inner);
        ic.u = ease(ic.u, L.inner.chomp.ux + 0.5, 0.25, dt);
        ic.v = ease(ic.v, L.inner.chomp.uy + 0.5, 0.25, dt);
      }
      if (S.portalEaten && !this.dive) this.diveWait = true;

      // --- camera: flat <-> chapter, by the drop energy
      this.flatten = ease(this.flatten, (this.diveWait || this.dive) ? 1 : 0, (this.diveWait || this.dive) ? 3 : 0.8, dt);
      const hd = ck.d;
      this.headYaw = easeAng(this.headYaw, Math.atan2(DX[hd], -DY[hd]), 1.1, dt);
      if (hd === 0) this.axisYaw = easeAng(this.axisYaw, Math.PI / 2, 0.7, dt);
      else if (hd === 2) this.axisYaw = easeAng(this.axisYaw, -Math.PI / 2, 0.7, dt);
      this.chapX = Math.min(1, this.chapX + dt / 3.2);
      const fixed = Math.round(params.chapter);
      let cfg = FLAT;
      {
        // Before the first drop the build already leans toward the first chapter.
        const cur = fixed > 0 ? fixed - 1 : (this.dropArmed ? (this.chap + 1) % CHAPTERS.length : this.chap);
        let C = this.chapterCfg(cur, L, T);
        if (fixed === 0 && this.chapPrev >= 0 && this.chapX < 1) {
          const x = this.chapX * this.chapX * (3 - 2 * this.chapX);
          C = this.mixCfg(this.chapterCfg(this.chapPrev, L, T), C, x);
        }
        // The build lifts the board: while a drop is armed, a rising riser
        // leans the flat maze up to a fifth of the way toward the chapter to
        // come, so the fold is announced before it lands.
        // A first test leaned toward the chapter's own camera and was invisible
        // (the staged mix barely moves at a fifth), so the lift is its own
        // pose: the board tilts toward a low table and its walls rise out of
        // the print, the maze visibly coming loose before it folds.
        const lean = this.dropArmed ? Math.min(1, surreal) * sstep(0.03, 0.22, e.rise || 0) : 0;
        this.lean = ease(this.lean || 0, lean, 2.2, dt);
        const lift = this.lean * (1 - this.flatten);
        const base = lift > 0.002 ? this.mixCfg(FLAT, this.liftCfg(T), lift) : FLAT;
        cfg = this.mixCfg(base, C, E * (1 - this.flatten));
      }
      const is3D = cfg.pitch > 0.004 || Math.abs(cfg.a1) > 0.003 || cfg.a2 > 0.003 || cfg.wallH > 0.004;
      if (this.diveWait && !is3D && this.flatten > 0.97) {
        this.diveWait = false;
        const cm = this.cam;
        this.dive = { t: 0, outer: L, inner: L.inner, u0: cm.u, v0: cm.v, yaw: cm.yaw };
      }

      // camera focus follows the chomper loosely (flat) or closely (chase views)
      if (!this.cam) this.cam = { su: ck.ux + 0.5, sv: ck.uy + 0.5, fu: ck.ux + 0.5, fv: ck.uy + 0.5, u: 0, v: 0, yaw: 0 };
      const cm = this.cam;
      cm.su = ease(cm.su, ck.ux + 0.5, 0.22, dt); cm.sv = ease(cm.sv, ck.uy + 0.5, 0.22, dt);
      cm.fu = ease(cm.fu, ck.ux + 0.5, 3.2, dt); cm.fv = ease(cm.fv, ck.uy + 0.5, 3.2, dt);
      this.spinU += cfg.spinU * dt; this.spinV += cfg.spinV * dt;
      cm.u = lerp(cm.su, cm.fu, cfg.follow) + this.spinU;
      cm.v = lerp(cm.sv, cm.fv, cfg.follow) + this.spinV;
      cm.yaw = cfg.yaw;

      // --- paint the board(s)
      const pal = palMix(L.palIdx, this.inv);
      this.paintBoard(L, S, pal, this.inv);
      if (L.inner) this.paintBoard(L.inner, Object.assign({}, S, { E: 0, hat: 0 }), palMix(L.inner.palIdx, 0), 0);

      // --- compose
      g.save();
      p.colorMode(p.RGB, 255);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.imageSmoothingEnabled = true;
      const Tt = this.tileSize(L);
      if (this.dive) {
        this.drawDive(g, dt, W, H, pal);
      } else if (is3D && (this.GL || !this.glTried)) {
        if (!this.glTried) initGL(this);
        if (this.GL) this.drawGL(p, g, L, cfg, pal, W, H, Tt);
        else this.drawFlat(g, L, W, H, Tt * cfg.zoom, cfg.yaw, cm.u, cm.v);
      } else {
        this.drawFlat(g, L, W, H, Tt * cfg.zoom, cfg.yaw, cm.u, cm.v);
      }
      g.restore();
    },

    nextChapter(params, onDrop) {
      const fixed = Math.round(params.chapter);
      if (fixed > 0) return;
      this.chapAge = 0;
      // A drop commits the chapter the build was already previewing.
      if (onDrop) { this.chap = (this.chap + 1) % CHAPTERS.length; return; }
      this.chapPrev = this.chap;
      this.chap = (this.chap + 1) % CHAPTERS.length;
      this.chapX = this.chapPrev < 0 ? 1 : 0;
    },

    drawFlat(g, L, W, H, scale, yaw, u0, v0) {
      const k = scale / L.ppt;
      g.save();
      g.translate(W / 2, H / 2);
      drawTiled(g, L.canvas, 0, 0, k, -yaw, u0 * L.ppt, v0 * L.ppt, Math.hypot(W, H) / 2);
      g.restore();
    },

    drawDive(g, dt, W, H, pal) {
      const D = this.dive;
      D.t += dt / 3.4;
      const t = Math.min(1, D.t);
      const eT = t * t * (3 - 2 * t);
      const L = D.outer, I = D.inner;
      const To = this.tileSize(L);
      const P = L.portal;
      const pu = P.x + 0.5, pv = P.y + 0.5;
      // bring the portal's periodic image nearest the old camera
      const pcu = D.u0 + wrapD(pu - D.u0, L.Gw), pcv = D.v0 + wrapD(pv - D.v0, L.Gh);
      const vir = this.viewRadius();
      const rT = this.portalR({ bass: this.env.bass });
      const Zmax = vir / (rT * To);
      const Z = Math.exp(Math.log(Zmax) * eT);
      const u0 = lerp(D.u0, pcu, sstep(0, 0.6, t)), v0 = lerp(D.v0, pcv, sstep(0, 0.6, t));
      const yaw = D.yaw * (1 - eT);
      const scale = To * Z;
      g.fillStyle = css(pal.bg);
      g.fillRect(-2, -2, W + 4, H + 4);
      this.drawFlat(g, L, W, H, scale, yaw, u0, v0);
      // the disc, and the next maze inside it
      const c = Math.cos(-yaw), s = Math.sin(-yaw);
      const dx = (pcu - u0) * scale, dy = (pcv - v0) * scale;
      const cx = W / 2 + dx * c - dy * s, cy = H / 2 + dx * s + dy * c;
      const rr = rT * scale;
      const Tin = this.tileSize(I);
      const ic = this.innerCam(I);
      g.save();
      g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.clip();
      const kin = (Tin * rr / vir) / I.ppt;
      drawTiled(g, I.canvas, cx, cy, kin, 0, ic.u * I.ppt, ic.v * I.ppt, rr);
      g.restore();
      if (t < 1) {
        g.strokeStyle = css(pal.key); g.lineWidth = Math.max(1, rr * 0.08 * (1 - t));
        g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke();
      }
      if (t >= 1) {
        // the inner maze takes over
        this.level = I;
        L.inner = null;
        this.dive = null;
        this.cam = { su: ic.u, sv: ic.v, fu: ic.u, fv: ic.v, u: ic.u, v: ic.v, yaw: 0 };
        this.spinU = 0; this.spinV = 0;
        this.power = 0; this.inv = 0;
        this.flatten = 1;
      }
    },

    drawGL(p, g, L, cfg, pal, W, H, Tt) {
      const G = this.GL, gl = G.gl;
      const pd = p.pixelDensity();
      const w = Math.round(p.width * pd), h = Math.round(p.height * pd);
      if (G.cv.width !== w || G.cv.height !== h) { G.cv.width = w; G.cv.height = h; }
      // backdrop: the maze again, faint and far, turning slowly the other way
      g.fillStyle = css(pal.bg);
      g.fillRect(-2, -2, W + 4, H + 4);
      g.save();
      g.globalAlpha = 0.13;
      g.translate(W / 2, H / 2);
      drawTiled(g, L.cacheN, 0, 0, Tt * 0.42 / L.ppt, this.T * 0.02 - cfg.yaw * 0.3, (this.cam.u * 0.3) * L.ppt, (this.cam.v * 0.3) * L.ppt, Math.hypot(W, H) / 2);
      g.restore();

      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.bindTexture(gl.TEXTURE_2D, G.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, L.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      // camera
      const Tv = Tt;
      const dist = Math.exp(cfg.ldist) * Tv;
      const b = cfg.pitch, y = cfg.yaw;
      const cy = Math.cos(y), sy = Math.sin(y);
      const rot = (v) => [v[0] * cy - v[1] * sy, v[0] * sy + v[1] * cy, v[2]];
      const off = rot([0, Math.sin(b), Math.cos(b)]);
      const F = [0, 0, cfg.Fz * Tv];
      const cam = [F[0] + off[0] * dist, F[1] + off[1] * dist, F[2] + off[2] * dist];
      const fwd = [-off[0], -off[1], -off[2]];
      const down = rot([0, Math.cos(b), -Math.sin(b)]);
      const right = rot([1, 0, 0]);
      const foc = dist * cfg.zoom;
      const a1 = cfg.a1, a2 = cfg.a2;
      const Su = Math.min((2 * cfg.K + 1) * L.Gw, a2 > 0.001 ? L.Gw / a2 : 1e9);
      const Sv = Math.min((2 * cfg.K + 1) * L.Gh, Math.abs(a1) > 0.001 ? L.Gh / Math.abs(a1) : 1e9);
      const R1v = a1 > 0.001 ? L.Gh * Tv / (TAU * a1) : 0;
      const R2min = 3.0 * R1v * sstep(0.4, 1, a1);
      const span = Math.max(Su, Sv) * Tv;
      const near = Math.max(0.05 * Tv, dist - span * 1.5), far = dist + span * 1.5 + 10 * Tv;
      const wallH = cfg.wallH * (0.8 + 0.45 * this.env.bass);
      const L3 = (() => { const v = [-0.38, -0.55, 0.74]; const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
      const fogC = pal.bg.map(v => v / 255);
      const set = (u) => {
        gl.uniform2f(u.uC, this.cam.u, this.cam.v);
        gl.uniform2f(u.uG, L.Gw, L.Gh);
        gl.uniform1f(u.uT, Tv);
        gl.uniform2f(u.uA, a1, a2);
        gl.uniform1f(u.uR2min, R2min);
        gl.uniform3f(u.uCam, cam[0], cam[1], cam[2]);
        gl.uniform3f(u.uCam2, cam[0], cam[1], cam[2]);
        gl.uniform3f(u.uRight, right[0], right[1], right[2]);
        gl.uniform3f(u.uDown, down[0], down[1], down[2]);
        gl.uniform3f(u.uFwd, fwd[0], fwd[1], fwd[2]);
        gl.uniform1f(u.uFoc, foc);
        gl.uniform2f(u.uHalf, W / 2, H / 2);
        gl.uniform2f(u.uNF, near, far);
        gl.uniform2f(u.uSpan, Su, Sv);
        gl.uniform1i(u.uTex, 0);
        gl.uniform3f(u.uSide, pal.side[0] / 255, pal.side[1] / 255, pal.side[2] / 255);
        gl.uniform3f(u.uFogC, fogC[0], fogC[1], fogC[2]);
        gl.uniform3f(u.uFogP, dist + cfg.fogA * Tv, dist + (cfg.fogA + cfg.fogB) * Tv, cfg.fog);
        gl.uniform3f(u.uL, L3[0], L3[1], L3[2]);
      };
      gl.activeTexture(gl.TEXTURE0);
      gl.useProgram(G.pF); set(G.uF);
      gl.bindVertexArray(G.vaoF);
      gl.drawElements(gl.TRIANGLES, G.nIdx, gl.UNSIGNED_SHORT, 0);
      if (wallH > 0.01) {
        if (G.wallLevel !== L.id) {
          gl.bindBuffer(gl.ARRAY_BUFFER, G.bT);
          gl.bufferData(gl.ARRAY_BUFFER, L.wallArr, gl.STATIC_DRAW);
          G.wallLevel = L.id; G.nWalls = L.wallArr.length / 2;
        }
        gl.useProgram(G.pW); set(G.uW);
        gl.uniform1f(G.uW.uWallH, wallH);
        const ck = L.chomp;
        gl.uniform4f(G.uW.uRip, mod(ck.ux, L.Gw) + 0.5, mod(ck.uy, L.Gh) + 0.5, this.rip, this.ripAmp * this.react * (this.rip < 7 ? 1 - this.rip / 7 : 0) * 1.6);
        gl.bindVertexArray(G.vaoW);
        const ku = Math.ceil((Su / L.Gw - 1) / 2 - 1e-6), kv = Math.ceil((Sv / L.Gh - 1) / 2 - 1e-6);
        for (let a = -ku; a <= ku; a++) for (let c = -kv; c <= kv; c++) {
          gl.uniform2f(G.uW.uCopy, a, c);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 30, G.nWalls);
        }
      }
      gl.bindVertexArray(null);
      g.drawImage(G.cv, 0, 0, W, H);
    },
  });

  function isMainLevel(self, L) { return self.level === L; }

  // Draw a periodic canvas so it covers a circle of radius `rad` around
  // (cx, cy): scale k, rotation rot, with source point (sx, sy) at the centre.
  function drawTiled(g, img, cx, cy, k, rot, sx, sy, rad) {
    const w = img.width, h = img.height;
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.scale(k, k);
    g.translate(-sx, -sy);
    const R = rad / k;
    const i0 = Math.floor((sx - R) / w), i1 = Math.floor((sx + R) / w);
    const j0 = Math.floor((sy - R) / h), j1 = Math.floor((sy + R) / h);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) <= 400) {
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) g.drawImage(img, i * w, j * h);
    }
    g.restore();
  }
})();
