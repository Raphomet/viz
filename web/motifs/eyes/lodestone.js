// Lodestone: the pupil is a pool of ferrofluid, the iris a ring of iron filings.
//
// At rest the pupil is a smooth glossy black pool with one broad reflection.
// As the bass comes up it goes through the Rosensweig instability: a hexagonal
// field of spikes rises out of it, the one reflection breaks into a lattice
// of tiny catchlights (one per spike tip, the thing that reads at a glance),
// and the pool's rim crowns into points. The spikes lean outward from the
// centre, as a cluster of cones seen from above does. The iris is copper,
// drawn over with short filings that line up along the field.
//
// Music: bass raises the spikes and aligns the filings; each kick sends one
// ring of taller spikes rolling out from the centre to the rim; the clap
// turns the lattice a sixth; hats glint the filings.
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

  // Hex lattice in units of the spacing, out to radius 3.3.
  const LATTICE = (function () {
    const o = [];
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
      const X = i + j * 0.5, Y = j * Math.sqrt(3) / 2;
      const d = Math.hypot(X, Y);
      if (d <= 3.25) o.push([X, Y, d]);
    }
    return o.sort((a, b) => a[1] - b[1]);   // back to front, top to bottom
  })();

  function draw(p, x, y, r, t, a, state, look) {
    const E = openEye(p, x, y, r, t, state, look);
    const g = E.g, R = E.R, cx = E.ix, cy = E.iy, S = E.S;
    const dt = clamp(t - (state.t == null ? t : state.t), 0, 0.1);
    state.t = t;
    if (state.seed == null) { state.seed = Math.random(); state.waves = []; state.rot = state.seed * TAU; }
    const bands = a.bands || [];
    const bass = clamp(((bands[0] || 0) + (bands[1] || 0)) / 200, 0, 1);
    const kick = a.kick || 0, snare = a.snare || 0, hat = a.hat || 0;
    if (onset(state, 'pk', kick, 0.25)) { state.waves.push(t); if (state.waves.length > 4) state.waves.shift(); }
    if (onset(state, 'ps', snare, 0.3)) state.turn = (state.turn || 0) + TAU / 6;
    state.turnA = (state.turnA || 0) + ((state.turn || 0) - (state.turnA || 0)) * (1 - Math.exp(-dt * 8));
    // Field strength: eases toward the bass so the spikes rise and settle.
    const target = clamp((bass - 0.12) * 1.5, 0, 1);
    state.H = (state.H || 0) + (target - (state.H || 0)) * (1 - Math.exp(-dt * 6));
    const H = state.H;
    state.rot += dt * 0.08;

    // Iris: copper with filings.
    const ig = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R);
    ig.addColorStop(0, '#c98a4c'); ig.addColorStop(0.5, '#a35f31'); ig.addColorStop(0.9, '#5b3119'); ig.addColorStop(1, '#1e0f07');
    g.fillStyle = ig;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const nf = clamp(Math.round(R * S * 1.6), 50, 420);
    const align = 0.5 + 0.5 * H;
    g.strokeStyle = 'rgba(38,18,8,0.55)';
    g.lineWidth = Math.max(R * 0.011, 0.6 / S);
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < nf; i++) {
      const th = hash(i * 1.37 + state.seed) * TAU;
      const rr = R * (0.46 + 0.5 * Math.sqrt(hash(i * 2.91 + state.seed)));
      const jit = (hash(i * 5.3 + state.seed) - 0.5) * 1.4 * (1 - align);
      // Field lines curl a little, like the lines of a bar magnet seen end on.
      const dir = th + jit + 0.25 * Math.sin(th * 3 + state.seed * 5);
      const L = R * (0.03 + 0.03 * hash(i * 7.7));
      const fx = cx + Math.cos(th) * rr, fy = cy + Math.sin(th) * rr;
      g.moveTo(fx - Math.cos(dir) * L, fy - Math.sin(dir) * L);
      g.lineTo(fx + Math.cos(dir) * L, fy + Math.sin(dir) * L);
    }
    g.stroke();
    if (hat > 0.05) {
      g.fillStyle = '#ffe7c4';
      for (let i = 0; i < 16; i++) {
        const k = Math.floor(hash(i * 3.3 + Math.floor(t * 12) * 0.71 + state.seed) * nf);
        const th = hash(k * 1.37 + state.seed) * TAU;
        const rr = R * (0.46 + 0.5 * Math.sqrt(hash(k * 2.91 + state.seed)));
        g.globalAlpha = clamp(hat * 1.2, 0, 1);
        g.beginPath(); g.arc(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, Math.max(R * 0.012, 0.6 / S), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }

    // The pool. Its rim crowns into points with the field.
    const rp = R * (0.4 + 0.06 * bass);
    const rim = (th) => {
      const c = Math.max(0, Math.cos(12 * (th - state.rot - state.turnA)));
      return rp * (1 + 0.16 * H * c * c * c * c);
    };
    g.beginPath();
    for (let k = 0; k <= 144; k++) {
      const th = k / 144 * TAU, rr = rim(th);
      if (k) g.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); else g.moveTo(cx + rr, cy);
    }
    g.closePath();
    const pg = g.createRadialGradient(cx - rp * 0.3, cy - rp * 0.35, rp * 0.05, cx, cy, rp * 1.1);
    pg.addColorStop(0, '#2a2a33'); pg.addColorStop(0.5, '#0d0d12'); pg.addColorStop(1, '#030305');
    g.fillStyle = pg;
    g.fill();
    g.save();
    g.clip();
    // The smooth pool's broad reflection, fading as the spikes take over.
    if (H < 0.95) {
      const hx = cx - rp * 0.32, hy = cy - rp * 0.38;
      const hg = g.createRadialGradient(hx, hy, 0, hx, hy, rp * 0.45);
      hg.addColorStop(0, 'rgba(235,238,250,' + (0.7 * (1 - H)).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(235,238,250,0)');
      g.fillStyle = hg;
      g.beginPath(); g.ellipse(hx, hy, rp * 0.45, rp * 0.3, -0.6, 0, TAU); g.fill();
    }
    // Spikes.
    const d = rp * 0.29;
    const ang = state.rot + state.turnA;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const small = d * S < 4;
    for (const [lx, ly, ld] of LATTICE) {
      const X = (lx * ca - ly * sa) * d, Y = (lx * sa + ly * ca) * d;
      const dist = Math.hypot(X, Y);
      if (dist > rp * 0.97) continue;
      // Height: the field, lower toward the rim, plus kick waves rolling out.
      let h = H * (1 - 0.45 * Math.pow(dist / rp, 2));
      for (const w0 of state.waves) {
        const front = (t - w0) * rp * 2.6;
        const age = t - w0;
        h += 0.9 * Math.exp(-Math.pow((dist - front) / (d * 0.8), 2)) * Math.exp(-age * 1.5);
      }
      h = clamp(h, 0, 1.5);
      if (h < 0.04) continue;
      const bx = cx + X, by = cy + Y;
      // The tip leans outward from the centre (cones seen from above, a
      // little off axis), so each spike is a teardrop: a base circle joined
      // by its tangents to the tip.
      const lean = 1.0 * h;
      const ox = X / rp, oy = Y / rp;
      const br = d * 0.46 * Math.min(1, 0.4 + h);
      const tx = bx + (ox * 0.9 + 0.12) * d * lean, ty = by + (oy * 0.9 + 0.1) * d * lean;
      const vx = tx - bx, vy = ty - by, L = Math.hypot(vx, vy);
      if (!small) {
        const al = Math.atan2(vy, vx);
        g.beginPath();
        if (L > br * 1.02) {
          const phi = Math.acos(br / L);
          g.arc(bx, by, br, al + phi, al - phi + TAU);
          g.lineTo(tx, ty);
          g.closePath();
        } else g.arc(bx, by, br, 0, TAU);
        const cg = g.createLinearGradient(bx - br, by - br, bx + br * 0.8, by + br * 0.8);
        cg.addColorStop(0, 'rgb(84,88,108)'); cg.addColorStop(0.45, 'rgb(20,20,27)'); cg.addColorStop(1, 'rgb(2,2,3)');
        g.fillStyle = cg;
        g.fill();
        // A specular streak down the lit flank.
        const nx = -vy / (L || 1), ny = vx / (L || 1);
        const side = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;
        g.strokeStyle = 'rgba(220,226,245,' + clamp(0.2 + 0.5 * h, 0, 0.8).toFixed(3) + ')';
        g.lineWidth = Math.max(br * 0.12, 0.5 / S);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(bx + nx * side * br * 0.55, by + ny * side * br * 0.55);
        g.lineTo(tx + (bx - tx) * 0.12 + nx * side * br * 0.08, ty + (by - ty) * 0.12 + ny * side * br * 0.08);
        g.stroke();
      }
      // The catchlight on each tip.
      const cr = Math.max(br * 0.2, 0.55 / S);
      g.fillStyle = 'rgba(248,250,255,' + clamp(0.4 + 0.6 * h, 0, 1).toFixed(3) + ')';
      g.beginPath(); g.arc(tx, ty, cr, 0, TAU); g.fill();
    }
    g.restore();
    closeEye(E, false);
  }

  VIZ_EYES.register({
    id: 'lodestone',
    name: 'Lodestone',
    idea: 'The pupil is a pool of ferrofluid: glossy and still in the quiet, it rises into a hexagonal field of spikes with the bass, its one reflection shattering into a lattice of tiny catchlights.',
    draw
  });
})();
