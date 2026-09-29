// Jitterbug: the pupil is a faceted black solid, and its outline is the pupil.
//
// Twelve vertices on Buckminster Fuller's jitterbug path (the points
// (0, ±1, ±s) cyclically permuted) fold one polyhedron continuously between
// an octahedron (s = 0), an icosahedron (s = 1/phi) and a cuboctahedron
// (s = 1). The triangulation never changes; an edge whose two faces go
// coplanar fades out, so each resting form is drawn with its true edges.
// Faces are obsidian lit from the upper left, edges fine gold, and the solid
// tumbles, so the pupil's silhouette is always a different polygon.
//
// Music: each kick folds it one step along octa, icosa, cubocta, icosa, ...
// on a spring that overshoots; bass swells it and speeds the tumble; the clap
// throws a quarter turn; hats catch single vertices as glints.
(function () {
  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---- the quiet eye (shared shape across designer B's styles) --------------
  function lidPath(g, x, y, W, hu, hl) {
    g.beginPath();
    g.moveTo(x - W, y);
    g.bezierCurveTo(x - W * 0.6, y - hu * 1.33, x + W * 0.5, y - hu * 1.33, x + W, y);
    g.bezierCurveTo(x + W * 0.5, y + hl * 1.33, x - W * 0.6, y + hl * 1.33, x - W, y);
    g.closePath();
  }
  function bez(u, a, b, c, d) { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; }

  function openEye(p, x, y, r, t, state, look) {
    const g = p.drawingContext;
    const tr = g.getTransform();
    const S = Math.hypot(tr.a, tr.b) || 1;
    const b = VIZ_EYES.blink(state, t);
    const lx = clamp(look ? look.x : 0, -1, 1), ly = clamp(look ? look.y : 0, -1, 1);
    const W = r * 0.96, Hl = r * 0.44 * (1 - 0.12 * b);
    const Hu = r * 0.56 * (1 - b) - Hl * 0.9 * b;
    const E = { g, S, px: 1 / S, b, x, y, r, W, Hu, Hl, R: r * 0.45,
      ix: x + lx * W * 0.3, iy: y + ly * r * 0.15 + b * r * 0.04 };
    g.save();
    // Seat the eye on any ground with a soft warm shadow, then the sclera.
    lidPath(g, x, y, W, Hu, Hl);
    g.shadowColor = 'rgba(30,15,8,0.45)';
    g.shadowBlur = r * 0.22 * S;
    g.shadowOffsetY = r * 0.04 * S;
    const sg = g.createRadialGradient(x - W * 0.1, y + Hl * 0.15, r * 0.1, x, y, W * 1.05);
    sg.addColorStop(0, '#f7f1e6'); sg.addColorStop(0.55, '#ece2d2'); sg.addColorStop(1, '#bfa58c');
    g.fillStyle = sg;
    g.fill();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.clip();
    return E;
  }

  function closeEye(E, catchlight) {
    const g = E.g, { x, y, r, W, Hu, Hl, S } = E;
    // The upper lid's shadow falls across the eye, iris included.
    const top = y - Math.max(Hu, 0) * 1.0;
    const lg = g.createLinearGradient(0, top, 0, top + r * 0.3);
    lg.addColorStop(0, 'rgba(58,30,18,0.42)'); lg.addColorStop(1, 'rgba(58,30,18,0)');
    g.fillStyle = lg;
    g.fillRect(x - W, top - r * 0.1, W * 2, r * 0.45);
    if (catchlight !== false) {
      const cx = E.ix - E.R * 0.36, cy = E.iy - E.R * 0.42, cr = E.R * 0.2;
      const cg = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0, 'rgba(255,252,244,0.9)'); cg.addColorStop(0.45, 'rgba(255,252,244,0.55)');
      cg.addColorStop(1, 'rgba(255,252,244,0)');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(cx, cy, cr, cr * 0.8, -0.5, 0, TAU); g.fill();
    }
    g.restore();
    // Lid lines.
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#2b1c16';
    g.lineWidth = Math.max(r * 0.05, 1.2 / S);
    g.beginPath();
    g.moveTo(x - W, y);
    g.bezierCurveTo(x - W * 0.6, y - Hu * 1.33, x + W * 0.5, y - Hu * 1.33, x + W, y);
    g.stroke();
    g.globalAlpha = 0.5;
    g.lineWidth = Math.max(r * 0.018, 0.7 / S);
    g.beginPath();
    g.moveTo(x + W, y);
    g.bezierCurveTo(x + W * 0.5, y + Hl * 1.33, x - W * 0.6, y + Hl * 1.33, x - W, y);
    g.stroke();
    if (r * S > 28) {
      // A crease above the lid and a few lashes toward the outer corner.
      const Hc = r * 0.74 - E.b * r * 0.08;
      g.globalAlpha = 0.25;
      g.lineWidth = r * 0.016;
      g.beginPath();
      g.moveTo(x - W * 0.74, y - r * 0.36);
      g.bezierCurveTo(x - W * 0.45, y - Hc * 1.15, x + W * 0.35, y - Hc * 1.15, x + W * 0.8, y - r * 0.34);
      g.stroke();
      g.globalAlpha = 0.85;
      g.lineWidth = r * 0.018;
      for (let i = 0; i < 6; i++) {
        const u = 0.52 + i * 0.085;
        const px = bez(u, x - W, x - W * 0.6, x + W * 0.5, x + W);
        const py = bez(u, y, y - Hu * 1.33, y - Hu * 1.33, y);
        const L = r * (0.07 + 0.05 * Math.sin(u * Math.PI)) * (1 - E.b * 0.3);
        const ang = -Math.PI / 2 + (u - 0.45) * 1.9;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(px + Math.cos(ang) * L * 0.5, py + Math.sin(ang) * L * 0.6,
          px + Math.cos(ang + 0.5) * L, py + Math.sin(ang + 0.5) * L);
        g.stroke();
      }
    }
    g.restore();
  }

  function onset(state, key, v, thr) {
    const prev = state[key] || 0;
    state[key] = v;
    return v - prev > thr;
  }

  // A quiet fibrous iris: a radial gradient, fine radial strands and a darker
  // limbal ring. cols = [inner, mid, outer, strand] as css colours.
  function fibres(g, cx, cy, R, rin, cols, seed, S) {
    const ig = g.createRadialGradient(cx, cy, rin * 0.8, cx, cy, R);
    ig.addColorStop(0, cols[0]); ig.addColorStop(0.55, cols[1]); ig.addColorStop(0.9, cols[2]);
    ig.addColorStop(1, 'rgba(20,12,8,0.95)');
    g.fillStyle = ig;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const n = clamp(Math.round(R * S * 0.7), 24, 150);
    g.strokeStyle = cols[3];
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const th = (i + hash(i * 1.3 + seed) * 0.8) / n * TAU;
      const r0 = rin * (1 + 0.15 * hash(i * 2.1 + seed));
      const r1 = R * (0.6 + 0.35 * hash(i * 3.7 + seed));
      g.globalAlpha = 0.18 + 0.3 * hash(i * 5.3 + seed);
      g.lineWidth = Math.max(R * 0.012, 0.6 / S);
      const bend = (hash(i * 7.1 + seed) - 0.5) * 0.12;
      g.beginPath();
      g.moveTo(cx + Math.cos(th) * r0, cy + Math.sin(th) * r0);
      g.quadraticCurveTo(cx + Math.cos(th + bend) * (r0 + r1) / 2, cy + Math.sin(th + bend) * (r0 + r1) / 2,
        cx + Math.cos(th) * r1, cy + Math.sin(th) * r1);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ---- the jitterbug -------------------------------------------------------
  const SIGNS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  function points(s) {
    const out = [];
    const k = 1 / Math.sqrt(1 + s * s);   // circumradius 1 all the way along
    for (const [a, b] of SIGNS) {
      out.push([0, a * k, b * s * k], [b * s * k, 0, a * k], [a * k, b * s * k, 0]);
    }
    return out;
  }
  // Connectivity, found once on the icosahedron (edge length 2s at s = 1/phi).
  const TOPO = (function () {
    const P = points(1 / PHI), n = P.length, e = 2 / PHI / Math.sqrt(1 + 1 / (PHI * PHI));
    const d = (i, j) => Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]);
    const adj = (i, j) => Math.abs(d(i, j) - e) < 1e-3;
    const tris = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      if (!adj(i, j) || !adj(j, k) || !adj(i, k)) continue;
      // Orient outward.
      const A = P[i], B = P[j], C = P[k];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      tris.push(nx * A[0] + ny * A[1] + nz * A[2] > 0 ? [i, j, k] : [i, k, j]);
    }
    const edges = new Map();
    tris.forEach((tr, f) => {
      for (let q = 0; q < 3; q++) {
        const a = tr[q], b = tr[(q + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
        if (!edges.has(key)) edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), f: [] });
        edges.get(key).f.push(f);
      }
    });
    return { tris, edges: Array.from(edges.values()) };
  })();

  const RUNGS = [0.04, 1 / PHI, 1, 1 / PHI];   // octa, icosa, cubocta, icosa

  function rotate(v, m) {
    return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  }
  function matrix(ax, ay, az) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
    // Rz * Ry * Rx
    return [
      cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa,
      sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa,
      -sb, cb * sa, cb * ca];
  }

  function draw(p, x, y, r, t, a, state, look) {
    const E = openEye(p, x, y, r, t, state, look);
    const g = E.g, R = E.R, cx = E.ix, cy = E.iy, S = E.S;
    const dt = clamp(t - (state.t == null ? t : state.t), 0, 0.1);
    state.t = t;
    if (state.seed == null) { state.seed = Math.random(); state.rung = 1; state.s = 1 / PHI; state.v = 0; state.ax = state.seed * 6; state.ay = state.seed * 3; }
    const bands = a.bands || [];
    const bass = clamp(((bands[0] || 0) + (bands[1] || 0)) / 200, 0, 1);
    const kick = a.kick || 0, snare = a.snare || 0, hat = a.hat || 0;
    if (onset(state, 'pk', kick, 0.25)) state.rung = (state.rung + 1) % RUNGS.length;
    if (onset(state, 'ps', snare, 0.3)) state.flip = (state.flip || 0) + Math.PI / 2;
    if (onset(state, 'ph', hat, 0.2)) { state.glintV = Math.floor(hash(t * 7.7 + state.seed) * 12); state.glintT = t; }
    // Spring toward the current rung: overshoots into the next form a little.
    const target = RUNGS[state.rung];
    state.v += ((target - state.s) * 170 - state.v * 13) * dt;
    state.s = clamp(state.s + state.v * dt, 0.0, 1.08);
    const spin = 0.35 + 0.9 * bass;
    state.ax += dt * spin * 0.7;
    state.ay += dt * spin;
    state.flipA = (state.flipA || 0) + ((state.flip || 0) - (state.flipA || 0)) * (1 - Math.exp(-dt * 9));

    fibres(g, cx, cy, R, R * 0.4, ['#6d7a78', '#566663', '#39423f', '#d9e2d6'], state.seed * 10, S);
    // Collarette: a thin warm ring the facets sit in.
    const rho = R * (0.44 + 0.07 * bass);
    g.strokeStyle = 'rgba(214,170,96,0.55)';
    g.lineWidth = Math.max(R * 0.025, 0.8 / S);
    g.beginPath(); g.arc(cx, cy, rho * 1.08, 0, TAU); g.stroke();
    // A soft round shadow under the solid keeps it reading as a pupil at 40 px.
    const sh = g.createRadialGradient(cx, cy, 0, cx, cy, rho * 1.05);
    sh.addColorStop(0, 'rgba(8,8,14,0.85)'); sh.addColorStop(0.75, 'rgba(8,8,14,0.55)'); sh.addColorStop(1, 'rgba(8,8,14,0)');
    g.fillStyle = sh;
    g.beginPath(); g.arc(cx, cy, rho * 1.05, 0, TAU); g.fill();

    // Solid.
    const M = matrix(state.ax, state.ay + state.flipA, state.flipA * 0.5);
    const P = points(state.s).map((v) => rotate(v, M));
    const light = [-0.45, -0.6, 0.66];
    const norms = TOPO.tris.map(([i, j, k]) => {
      const A = P[i], B = P[j], C = P[k];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const m = Math.hypot(n[0], n[1], n[2]);
      return m < 1e-6 ? null : [n[0] / m, n[1] / m, n[2] / m];
    });
    // Screen: x right, y down, z toward the viewer. Mild perspective.
    const proj = (v) => { const f = 1 / (1 - v[2] * 0.18); return [cx + v[0] * rho * f, cy + v[1] * rho * f]; };
    const Q = P.map(proj);
    g.lineJoin = 'round';
    TOPO.tris.forEach(([i, j, k], f) => {
      const n = norms[f];
      if (!n || n[2] <= 0) return;
      const lam = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const spec = Math.pow(Math.max(0, n[2] * 0.4 + lam * 0.6), 18);
      const rr = Math.round(8 + 22 * lam * lam + 130 * spec);
      const gg = Math.round(9 + 30 * lam * lam + 125 * spec);
      const bb = Math.round(16 + 52 * lam * lam + 115 * spec);
      g.fillStyle = 'rgb(' + rr + ',' + gg + ',' + bb + ')';
      g.strokeStyle = g.fillStyle;
      g.lineWidth = 0.6 / S;   // hides hairline seams between faces
      g.beginPath(); g.moveTo(Q[i][0], Q[i][1]); g.lineTo(Q[j][0], Q[j][1]); g.lineTo(Q[k][0], Q[k][1]); g.closePath();
      g.fill(); g.stroke();
    });
    // Gold edges, fading as their faces go coplanar; back edges faintly.
    g.lineCap = 'round';
    const ew = Math.max(R * 0.011, 0.6 / S);
    for (const e of TOPO.edges) {
      const n1 = norms[e.f[0]], n2 = norms[e.f[1]];
      if (!n1 || !n2) continue;
      const crease = clamp((1 - (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2])) * 6, 0, 1);
      const front = n1[2] > 0 || n2[2] > 0;
      const al = crease * (front ? 0.85 : 0.0);
      if (al < 0.02) continue;
      g.strokeStyle = 'rgba(236,196,120,' + al.toFixed(3) + ')';
      g.lineWidth = ew;
      g.beginPath(); g.moveTo(Q[e.a][0], Q[e.a][1]); g.lineTo(Q[e.b][0], Q[e.b][1]); g.stroke();
    }
    // Hat glint on one front vertex.
    const ga = state.glintT == null ? 0 : Math.exp(-(t - state.glintT) / 0.12);
    if (ga > 0.03) {
      const v = P[state.glintV], q = Q[state.glintV];
      if (v[2] > -0.1) {
        const L = R * 0.12 * ga;
        g.strokeStyle = 'rgba(255,244,220,' + ga.toFixed(3) + ')';
        g.lineWidth = Math.max(R * 0.012, 0.7 / S);
        g.beginPath(); g.moveTo(q[0] - L, q[1]); g.lineTo(q[0] + L, q[1]); g.moveTo(q[0], q[1] - L); g.lineTo(q[0], q[1] + L); g.stroke();
      }
    }
    closeEye(E);
  }

  VIZ_EYES.register({
    id: 'jitterbug',
    name: 'Jitterbug',
    idea: 'The pupil is a tumbling obsidian polyhedron that folds, beat by beat, between octahedron, icosahedron and cuboctahedron along Fuller\'s jitterbug, so its outline is never the same polygon twice.',
    draw
  });
})();
