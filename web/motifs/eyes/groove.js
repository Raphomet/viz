// Groove: the iris is a honey-coloured 45 spinning under a tiny tone arm.
//
// The pupil is the single's big centre hole, the inner iris its paper label,
// and the outer iris the grooves, whose wiggles turn with the record. The arm
// pivots from under the upper lid and tracks slowly inward across a side of
// the record; the groove it has just played glows for a moment behind it.
//
// Music: bass turns the record faster and opens the hole; each kick lights the
// played groove brighter and longer and lifts the arm a hair (its shadow
// grows); the clap is a scratch, the record jerked back and forth; hats glint
// dust on the vinyl.
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

  // ---- the record -------------------------------------------------------------
  const GAPS = [0.63, 0.74, 0.86];    // lead-ins between songs, as fractions of R

  function draw(p, x, y, r, t, a, state, look) {
    const E = openEye(p, x, y, r, t, state, look);
    const g = E.g, R = E.R, cx = E.ix, cy = E.iy, S = E.S;
    const dt = clamp(t - (state.t == null ? t : state.t), 0, 0.1);
    state.t = t;
    if (state.seed == null) state.seed = Math.random();
    const bands = a.bands || [];
    const bass = clamp(((bands[0] || 0) + (bands[1] || 0)) / 200, 0, 1);
    const kick = a.kick || 0, snare = a.snare || 0, hat = a.hat || 0;
    if (onset(state, 'pk', kick, 0.25)) state.kickT = t;
    if (onset(state, 'ps', snare, 0.3)) state.scratchT = t;
    state.glow = Math.max((state.glow || 0) * Math.exp(-dt / 0.35), kick);

    // Turning: clockwise, faster with the bass; a clap scratches it.
    let w = TAU * (0.16 + 0.34 * bass);
    const su = state.scratchT == null ? 2 : (t - state.scratchT) / 0.34;
    if (su < 1) w += -TAU * 2.4 * Math.sin(su * TAU) * (1 - su);
    state.rot = (state.rot || 0) + w * dt;
    const rot = state.rot;

    // Vinyl.
    const vg = g.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.2, cx, cy, R);
    vg.addColorStop(0, '#b0621e'); vg.addColorStop(0.55, '#8a4515'); vg.addColorStop(0.92, '#5e2b0c');
    vg.addColorStop(1, '#3e1a07');
    g.fillStyle = vg;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();

    // Grooves, their wiggles turning with the record. Spacing never under ~1.7 px.
    const r0 = R * 0.52, r1 = R * 0.975;
    const sp = Math.max((r1 - r0) / 34, 1.7 / S);
    const n = Math.floor((r1 - r0) / sp);
    g.lineWidth = sp * 0.42;
    g.strokeStyle = 'rgba(40,14,2,0.55)';
    const detail = R * S > 60;
    for (let i = 0; i <= n; i++) {
      const rr = r0 + i * sp;
      const f = rr / R;
      let gap = false;
      for (const q of GAPS) if (Math.abs(f - q) < sp / R * 0.9) gap = true;
      if (gap) continue;
      if (!detail) { g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); continue; }
      const segs = clamp(Math.round(rr * S * 0.35), 36, 200);
      const loud = 0.5 + 0.5 * Math.sin(i * 0.9 + state.seed * 9);
      const amp = sp * 0.22 * loud;
      g.beginPath();
      for (let k = 0; k <= segs; k++) {
        const th = k / segs * TAU;
        const ph = th - rot;
        const wig = amp * (Math.sin(ph * 23 + i) * 0.6 + Math.sin(ph * 57 + i * 2.3) * 0.4);
        const px = cx + Math.cos(th) * (rr + wig), py = cy + Math.sin(th) * (rr + wig);
        if (k) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.stroke();
    }
    // Sheen: two soft wedges fixed to the light, not the record.
    if (g.createConicGradient) {
      const cg = g.createConicGradient(-Math.PI * 0.75, cx, cy);
      const s = 'rgba(255,226,170,';
      cg.addColorStop(0, s + '0.32)'); cg.addColorStop(0.07, s + '0)'); cg.addColorStop(0.43, s + '0)');
      cg.addColorStop(0.5, s + '0.22)'); cg.addColorStop(0.57, s + '0)'); cg.addColorStop(0.93, s + '0)');
      cg.addColorStop(1, s + '0.32)');
      g.fillStyle = cg;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.arc(cx, cy, r0, 0, TAU, true); g.fill();
    }

    // Tone arm geometry: pivot under the upper lid, needle tracking inward.
    const px0 = cx + R * 1.12, py0 = cy - R * 0.58;
    const aStart = -0.05;
    const nx0 = cx + Math.cos(aStart) * R * 0.95, ny0 = cy + Math.sin(aStart) * R * 0.95;
    const L = Math.hypot(nx0 - px0, ny0 - py0);
    const prog = (t / 80 + state.seed) % 1;
    const rn = R * (0.93 - 0.36 * prog);
    // Intersect circle(centre, rn) with circle(pivot, L); take the upper-left one.
    const dx = px0 - cx, dy = py0 - cy, D = Math.hypot(dx, dy);
    const aa = (rn * rn - L * L + D * D) / (2 * D);
    const hh = Math.sqrt(Math.max(0, rn * rn - aa * aa));
    const mx = cx + dx * aa / D, my = cy + dy * aa / D;
    let nX = mx + dy * hh / D, nY = my - dx * hh / D;
    const alt = [mx - dy * hh / D, my + dx * hh / D];
    if (alt[1] > nY) { nX = alt[0]; nY = alt[1]; }
    const thN = Math.atan2(nY - cy, nX - cx);

    // The groove just played glows behind the needle (it has turned past).
    const glow = clamp(0.3 + 0.25 * bass + state.glow * 0.9, 0, 1.2);
    const span = 1.6 + 2.2 * state.glow;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'butt';
    const steps = 24;
    for (let k = 0; k < steps; k++) {
      const u0 = k / steps, u1 = (k + 1) / steps;
      g.strokeStyle = 'rgba(255,196,110,' + (glow * (1 - u0) * (1 - u0) * 0.8).toFixed(3) + ')';
      g.lineWidth = Math.max(sp * (2.2 + 2 * state.glow), 1.4 / S);
      g.beginPath(); g.arc(cx, cy, rn, thN + span * u0, thN + span * u1); g.stroke();
    }
    g.restore();

    // Hats: dust on the vinyl catches the light, turning with the record.
    if (hat > 0.05) {
      g.fillStyle = '#fff6e2';
      for (let k = 0; k < 9; k++) {
        const hr = r0 + (r1 - r0) * hash(k * 3.7 + state.seed);
        const th = hash(k * 9.1 + state.seed) * TAU + rot;
        const al = hat * (hash(k + Math.floor(t * 8)) > 0.45 ? 1 : 0.2);
        g.globalAlpha = clamp(al, 0, 1);
        const s2 = Math.max(R * 0.016, 0.8 / S);
        g.beginPath(); g.arc(cx + Math.cos(th) * hr, cy + Math.sin(th) * hr, s2, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }

    // Label: cream paper with a vermilion half and a line of tiny type.
    const rl = R * 0.49;
    g.save();
    g.translate(cx, cy); g.rotate(rot);
    g.fillStyle = '#efe2c4';
    g.beginPath(); g.arc(0, 0, rl, 0, TAU); g.fill();
    g.fillStyle = '#c9472b';
    g.beginPath(); g.arc(0, 0, rl, Math.PI * 0.08, Math.PI * 1.02); g.arc(0, 0, rl * 0.55, Math.PI * 1.02, Math.PI * 0.08, true); g.fill();
    g.strokeStyle = 'rgba(60,24,10,0.5)';
    g.lineWidth = Math.max(R * 0.008, 0.5 / S);
    g.beginPath(); g.arc(0, 0, rl * 0.93, 0, TAU); g.stroke();
    if (R * S > 50) {
      g.fillStyle = 'rgba(50,20,10,0.7)';
      for (let k = 0; k < 22; k++) {
        const th = Math.PI * 1.12 + k * 0.075;
        if (hash(k * 1.7) < 0.18) continue;
        const len = 0.035 + 0.02 * hash(k);
        g.save(); g.rotate(th); g.fillRect(rl * 0.7, -R * 0.012, R * 0.03, R * len * 0.5); g.restore();
      }
      // Our mark: three dots in a row, like a little ellipsis.
      g.fillStyle = '#efe2c4';
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(k * R * 0.07, rl * 0.76, R * 0.022, 0, TAU); g.fill(); }
    }
    g.restore();

    // Pupil: the 45's big hole, opening with the bass.
    const rp = R * (0.24 + 0.07 * bass);
    const pg = g.createRadialGradient(cx, cy - rp * 0.3, rp * 0.1, cx, cy, rp);
    pg.addColorStop(0, '#1c120c'); pg.addColorStop(1, '#070403');
    g.fillStyle = pg;
    g.beginPath(); g.arc(cx, cy, rp, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,240,215,0.35)';
    g.lineWidth = Math.max(R * 0.01, 0.6 / S);
    g.beginPath(); g.arc(cx, cy, rp, Math.PI * 0.1, Math.PI * 0.9); g.stroke();

    // Tone arm: shadow first, lifted a hair by each kick.
    const lift = kick * 0.6 + 0.4;
    const ang = Math.atan2(nY - py0, nX - px0);
    const armW = Math.max(R * 0.035, 1 / S);
    const drawArm = (ox, oy, shadow) => {
      g.save();
      g.translate(ox, oy);
      g.lineCap = 'round';
      g.strokeStyle = shadow ? 'rgba(20,8,2,0.3)' : '#3a322c';
      g.lineWidth = armW * (shadow ? 1.2 : 1.6);
      g.beginPath(); g.moveTo(px0, py0); g.lineTo(nX, nY); g.stroke();
      if (!shadow) {
        g.strokeStyle = '#e4ded3'; g.lineWidth = armW * 0.8;
        g.beginPath(); g.moveTo(px0, py0); g.lineTo(nX, nY); g.stroke();
      }
      // Headshell, a small plate square to the arm.
      g.translate(nX, nY); g.rotate(ang + 0.35);
      g.fillStyle = shadow ? 'rgba(20,8,2,0.3)' : '#d9d2c5';
      g.strokeStyle = '#3a322c'; g.lineWidth = armW * 0.35;
      g.beginPath(); g.rect(-R * 0.13, -R * 0.045, R * 0.16, R * 0.09); g.fill();
      if (!shadow) g.stroke();
      g.restore();
      // Pivot and counterweight.
      g.fillStyle = shadow ? 'rgba(20,8,2,0.3)' : '#cfc7b8';
      g.beginPath(); g.arc(px0 + ox, py0 + oy, R * 0.1, 0, TAU); g.fill();
      if (!shadow) { g.strokeStyle = '#3a322c'; g.lineWidth = armW * 0.4; g.stroke(); }
      const bx = px0 - Math.cos(ang) * R * 0.18 + ox, by = py0 - Math.sin(ang) * R * 0.18 + oy;
      g.fillStyle = shadow ? 'rgba(20,8,2,0.3)' : '#2e2824';
      g.beginPath(); g.arc(bx, by, R * 0.075, 0, TAU); g.fill();
    };
    drawArm(R * 0.05 * lift, R * 0.07 * lift, true);
    drawArm(0, -R * 0.015 * kick, false);

    closeEye(E);
  }

  VIZ_EYES.register({
    id: 'groove',
    name: 'Groove',
    idea: 'The iris is a honey-coloured 45 spinning under a tiny tone arm, with the pupil as its big centre hole; the groove it has just played glows behind the needle.',
    draw
  });
})();
