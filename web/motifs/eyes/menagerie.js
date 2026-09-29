// Menagerie: the pupil keeps becoming another animal's pupil.
//
// Six outlines, each a closed contour resampled to the same number of points
// by arc length: a round pupil, a goat's bar, a cuttlefish's W, a keyhole, a
// gecko's slit with its four beads, and a stingray's crescent (turned on its side,
// so it never reads as a smile). Morphing is a
// straight blend between matched contours (each pair aligned once, at load,
// by the rotation of point order that moves the points least), so every shape
// melts into the next without collapsing through a blob. A pale collarette
// follows the outline. Honey-olive iris, quiet.
//
// Music: each kick morphs the pupil into the next animal on a springy blend;
// bass dilates it; the clap turns it over (a W becomes an M); hats twinkle
// gold flecks in the iris. With no kick for a few seconds it drifts on to the
// next shape by itself.
(function () {
  const TAU = Math.PI * 2;
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

  // ---- the outlines --------------------------------------------------------
  const N = 128;
  function resample(pts) {
    const L = [0];
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length];
      L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const tot = L[pts.length], out = [];
    let j = 0;
    for (let k = 0; k < N; k++) {
      const s = k / N * tot;
      while (L[j + 1] < s) j++;
      const a = pts[j], b = pts[(j + 1) % pts.length], u = (s - L[j]) / (L[j + 1] - L[j] || 1);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    // Clockwise on screen (y down) for every shape.
    let area = 0;
    for (let i = 0; i < N; i++) { const a = out[i], b = out[(i + 1) % N]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) out.reverse();
    return out;
  }
  function arcPts(cx, cy, r, a0, a1, n) {
    const o = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return o;
  }
  // A band of varying half-width along a centreline: upper side out, lower back.
  function band(center, halfW) {
    const up = [], dn = [];
    for (let i = 0; i < center.length; i++) {
      const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const w = halfW(i / (center.length - 1));
      up.push([center[i][0] + ty * w, center[i][1] - tx * w]);
      dn.push([center[i][0] - ty * w, center[i][1] + tx * w]);
    }
    return up.concat(dn.reverse());
  }
  function catmull(ctrl, per) {
    const o = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        o.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    o.push(ctrl[ctrl.length - 1]);
    return o;
  }
  const endCap = (u) => Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 8)));

  const SHAPES = [
    { name: 'round', pts: arcPts(0, 0, 0.62, -Math.PI / 2, Math.PI * 1.5, 160).slice(0, 160) },
    { name: 'goat', pts: band(catmull([[-0.9, 0.02], [-0.45, -0.02], [0, 0], [0.45, -0.02], [0.9, 0.02]], 20), (u) => 0.21 * endCap(u) + 0.01) },
    { name: 'cuttlefish', pts: band(catmull([[-0.95, -0.5], [-0.72, 0.05], [-0.42, 0.34], [-0.14, 0.02], [0, -0.26], [0.14, 0.02], [0.42, 0.34], [0.72, 0.05], [0.95, -0.5]], 12),
      (u) => (0.1 + 0.07 * Math.abs(Math.sin(u * Math.PI * 2))) * endCap(u) + 0.012) },
    { name: 'keyhole', pts: (function () {
      const c = -0.24, r = 0.37, jy = c + Math.sqrt(r * r - 0.12 * 0.12);
      const ja = Math.atan2(jy - c, 0.12);
      return arcPts(0, c, r, -Math.PI / 2, ja, 60)
        .concat([[0.14, 0.2], [0.2, 0.45], [0.27, 0.66], [0, 0.68], [-0.27, 0.66], [-0.2, 0.45], [-0.14, 0.2]])
        .concat(arcPts(0, c, r, Math.PI - ja, Math.PI * 1.5, 60));
    })() },
    { name: 'gecko', pts: band(catmull([[0, -0.9], [0, -0.45], [0, 0], [0, 0.45], [0, 0.9]], 30), (u) => {
      const y = u * 2 - 1;
      let w = 0.035;
      for (const b of [-0.58, -0.2, 0.2, 0.58]) w += 0.1 * Math.exp(-Math.pow((y - b) / 0.08, 2));
      return w * endCap(u) + 0.008;
    }) },
    { name: 'stingray', pts: band(arcPts(0.3, 0, 0.62, Math.PI * 0.42, Math.PI * 1.58, 50), (u) => 0.2 * Math.pow(Math.sin(u * Math.PI), 0.4) + 0.01) },
  ].map((s) => resample(s.pts));

  // Best point-order rotation of b to match a: least total squared travel.
  const OFF = SHAPES.map((A) => SHAPES.map((B) => {
    let best = 0, bestD = Infinity;
    for (let o = 0; o < N; o++) {
      let d = 0;
      for (let i = 0; i < N; i += 2) { const q = B[(i + o) % N]; d += (A[i][0] - q[0]) ** 2 + (A[i][1] - q[1]) ** 2; }
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }));

  function draw(p, x, y, r, t, a, state, look) {
    const E = openEye(p, x, y, r, t, state, look);
    const g = E.g, R = E.R, cx = E.ix, cy = E.iy, S = E.S;
    const dt = clamp(t - (state.t == null ? t : state.t), 0, 0.1);
    state.t = t;
    if (state.seed == null) {
      state.seed = Math.random();
      state.from = Math.floor(state.seed * SHAPES.length); state.to = state.from; state.m = 1; state.v = 0;
      state.off = 0; state.last = t;
    }
    const bands = a.bands || [];
    const bass = clamp(((bands[0] || 0) + (bands[1] || 0)) / 200, 0, 1);
    const kick = a.kick || 0, snare = a.snare || 0, hat = a.hat || 0;
    const advance = () => {
      // Freeze the current blend as the new start: rebuild it into a shape.
      state.fromPts = current(state);
      state.to = (state.to + 1) % SHAPES.length;
      state.m = 0; state.v = 0; state.last = t;
    };
    if (onset(state, 'pk', kick, 0.25)) advance();
    else if (t - state.last > 3.5) advance();
    if (onset(state, 'ps', snare, 0.3)) state.flip = (state.flip || 0) + Math.PI;
    state.v += ((1 - state.m) * 260 - state.v * 17) * dt;
    state.m = clamp(state.m + state.v * dt, 0, 1.12);
    state.flipA = (state.flipA || 0) + ((state.flip || 0) - (state.flipA || 0)) * (1 - Math.exp(-dt * 10));

    fibres(g, cx, cy, R, R * 0.3, ['#d39a3a', '#9c7c30', '#4d5528', '#f6dc92'], state.seed * 10, S);
    // Gold flecks that twinkle on the hats.
    const nf = 14;
    for (let i = 0; i < nf; i++) {
      const th = hash(i * 4.1 + state.seed) * TAU, rr = R * (0.55 + 0.35 * hash(i * 2.7 + state.seed));
      const tw = hat * (hash(i + Math.floor(t * 10) * 1.3) > 0.5 ? 1 : 0.25);
      g.fillStyle = 'rgba(255,228,150,' + (0.25 + 0.7 * tw).toFixed(3) + ')';
      g.beginPath(); g.arc(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, Math.max(R * (0.012 + 0.018 * tw), 0.5 / S), 0, TAU); g.fill();
    }

    const pts = current(state);
    const sc = R * 0.52 * (0.88 + 0.26 * bass);
    const fy = Math.cos(state.flipA), fx = 1;
    const path = (k) => {
      g.beginPath();
      for (let i = 0; i < N; i++) {
        const X = cx + pts[i][0] * sc * k * fx, Y = cy + pts[i][1] * sc * k * fy;
        if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
      }
      g.closePath();
    };
    g.lineJoin = 'round';
    // Collarette following the outline, then a soft dark rim, then the pupil.
    path(1.0);
    g.strokeStyle = 'rgba(250,226,160,0.45)';
    g.lineWidth = Math.max(R * 0.11, 1.4 / S);
    g.stroke();
    g.strokeStyle = 'rgba(30,20,8,0.35)';
    g.lineWidth = Math.max(R * 0.05, 1 / S);
    g.stroke();
    path(1.0);
    g.fillStyle = '#0b0806';
    g.fill();
    closeEye(E);
  }

  function current(state) {
    const A = state.fromPts || SHAPES[state.from];
    const B = SHAPES[state.to], m = state.m;
    const o = state.fromPts ? matchOff(A, B) : OFF[state.from][state.to];
    const out = new Array(N);
    for (let i = 0; i < N; i++) {
      const q = B[(i + o) % N];
      out[i] = [A[i][0] + (q[0] - A[i][0]) * m, A[i][1] + (q[1] - A[i][1]) * m];
    }
    return out;
  }
  function matchOff(A, B) {
    let best = 0, bestD = Infinity;
    for (let o = 0; o < N; o += 1) {
      let d = 0;
      for (let i = 0; i < N; i += 4) { const q = B[(i + o) % N]; d += (A[i][0] - q[0]) ** 2 + (A[i][1] - q[1]) ** 2; }
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  VIZ_EYES.register({
    id: 'menagerie',
    name: 'Menagerie',
    idea: 'The pupil melts from animal to animal on the beat: round, a goat\'s bar, a cuttlefish W, a keyhole, a gecko\'s beaded slit, a stingray\'s crescent.',
    draw
  });
})();
