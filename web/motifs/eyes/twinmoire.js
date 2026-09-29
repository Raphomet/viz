// Twin Moiré: two pupils, each ringed by its own ripples, drift apart and merge.
//
// Polycoria made optical. Each pupil is the centre of a set of fine concentric
// rings printed in its own ink, indigo and vermilion, overprinted (multiply)
// on a pale iris. When the pupils sit together the rings coincide and the
// iris is plain rings round one pupil; the moment they part, the two sets
// beat against each other into moiré fringes, hyperbolae that swing wildly
// with the smallest drift. The pupils join through a soft liquid neck.
//
// Music: bass pushes the pupils apart (the drop splits them, the breakdown
// lets them merge back into one); the rings flow outward continuously and
// each kick throws them out half a ring, which sweeps every fringe; the clap
// swings the pair a quarter turn round each other; hats thicken the ink a
// moment, so the fringes flash darker.
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

  // Two discs joined by a waisted neck when they are close (a metaball bridge).
  function twinPath(g, x1, y1, x2, y2, rho) {
    const D = Math.hypot(x2 - x1, y2 - y1);
    g.beginPath();
    g.arc(x1, y1, rho, 0, TAU);
    g.moveTo(x2 + rho, y2);
    g.arc(x2, y2, rho, 0, TAU);
    const reach = rho * 2.6;
    if (D > 1e-6 && D < reach) {
      const u = D / reach;                  // 0 merged .. 1 about to part
      const ux = (x2 - x1) / D, uy = (y2 - y1) / D, nx = -uy, ny = ux;
      const al = 0.9 - 0.25 * u;            // where the neck leaves each disc
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const waist = rho * (1 - u) * 0.95;
      const c1 = Math.cos(al), s1 = Math.sin(al);
      const ax = x1 + (ux * c1 + nx * s1) * rho, ay = y1 + (uy * c1 + ny * s1) * rho;
      const bx = x2 + (-ux * c1 + nx * s1) * rho, by = y2 + (-uy * c1 + ny * s1) * rho;
      const cx2 = x2 + (-ux * c1 - nx * s1) * rho, cy2 = y2 + (-uy * c1 - ny * s1) * rho;
      const dx = x1 + (ux * c1 - nx * s1) * rho, dy = y1 + (uy * c1 - ny * s1) * rho;
      // Wound the same way as the arcs, so the nonzero fill adds rather than cuts.
      g.moveTo(dx, dy);
      g.quadraticCurveTo(mx - nx * waist, my - ny * waist, cx2, cy2);
      g.lineTo(bx, by);
      g.quadraticCurveTo(mx + nx * waist, my + ny * waist, ax, ay);
      g.closePath();
    }
  }

  function rings(g, ox, oy, R, sp, phase, maxR, lw, color) {
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.beginPath();
    for (let rr = phase; rr < maxR; rr += sp) {
      if (rr <= 0) continue;
      g.moveTo(ox + rr, oy);
      g.arc(ox, oy, rr, 0, TAU);
    }
    g.stroke();
  }

  function draw(p, x, y, r, t, a, state, look) {
    const E = openEye(p, x, y, r, t, state, look);
    const g = E.g, R = E.R, cx = E.ix, cy = E.iy, S = E.S;
    const dt = clamp(t - (state.t == null ? t : state.t), 0, 0.1);
    state.t = t;
    if (state.seed == null) { state.seed = Math.random(); state.phi = state.seed * TAU; state.flow = 0; state.sep = 0; }
    const bands = a.bands || [];
    const bass = clamp(((bands[0] || 0) + (bands[1] || 0)) / 200, 0, 1);
    const kick = a.kick || 0, snare = a.snare || 0, hat = a.hat || 0;
    if (onset(state, 'pk', kick, 0.25)) state.push = (state.push || 0) + 0.5;
    if (onset(state, 'ps', snare, 0.3)) state.swing = (state.swing || 0) + Math.PI / 2;
    // Separation eases toward the bass, with a slow breath of its own.
    const tgt = clamp(bass * 1.3 - 0.1, 0, 1) * 0.8 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.37 + state.seed * 7));
    state.sep += (tgt - state.sep) * (1 - Math.exp(-dt * 2.2));
    const pushNow = (state.push || 0) * (1 - Math.exp(-dt * 10));
    state.push = (state.push || 0) - pushNow;
    const swingNow = ((state.swing || 0) - (state.swingA || 0)) * (1 - Math.exp(-dt * 7));
    state.swingA = (state.swingA || 0) + swingNow;
    state.phi += dt * 0.12;
    const sp = Math.max(R / 15, 2.2 / S);
    state.flow += dt * sp * 0.35 + pushNow * sp;

    // Pupils.
    const d = R * 0.5 * state.sep;
    const ang = state.phi + state.swingA;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const x1 = cx - ux * d, y1 = cy - uy * d, x2 = cx + ux * d, y2 = cy + uy * d;
    const rho = R * (0.23 - 0.08 * state.sep);

    // Iris: pale ground, two overprinted ring sets, dark limbus.
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    const ig = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    ig.addColorStop(0, '#f3ecdc'); ig.addColorStop(0.8, '#e2dccb'); ig.addColorStop(1, '#bdb6a4');
    g.fillStyle = ig;
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.globalCompositeOperation = 'multiply';
    const ph = state.flow % sp;
    const lw = sp * (0.42 + 0.18 * hat);
    rings(g, x1, y1, R, sp, ph, R * 2, lw, '#3b4fa8');
    rings(g, x2, y2, R, sp, ph, R * 2, lw, '#e0573a');
    g.globalCompositeOperation = 'source-over';
    // Limbus.
    const lg = g.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    lg.addColorStop(0, 'rgba(26,24,44,0)'); lg.addColorStop(1, 'rgba(26,24,44,0.85)');
    g.fillStyle = lg;
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();

    // A thin pale halo round the pair, then the pair itself.
    twinPath(g, x1, y1, x2, y2, rho * 1.18);
    g.fillStyle = 'rgba(248,242,230,0.9)';
    g.fill('nonzero');
    twinPath(g, x1, y1, x2, y2, rho);
    g.fillStyle = '#0c0a10';
    g.fill('nonzero');
    closeEye(E);
  }

  VIZ_EYES.register({
    id: 'twinmoire',
    name: 'Twin Moiré',
    idea: 'Two pupils, each ringed by its own ripples in its own ink, drift apart and merge, and their rings beat into moiré fringes that swing wildly with the smallest drift.',
    draw
  });
})();
