// Zoetrope: a flock of paper birds flies round and round inside the iris.
//
// The iris is a phenakistoscope disc: deep teal card with viewing slits cut
// round its rim, and on it a ring of cream birds, each drawn one frame
// further through the same wingbeat. Seen together they are a wave of flapping
// that runs round the ring, the way the old discs animate, while the whole
// flock circles the pupil. The rest of the eye is quiet.
//
// Music: each kick pulls every bird into one wingbeat at once, a single
// synchronised downstroke, and then they drift back out of step round the
// ring; bass flies the flock faster; the clap makes them all dip toward the
// pupil and climb back; hats flick tiny stars between the birds.
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

  // One bird in side view, flying toward +x with "up" toward -y, wing angle
  // from the flap phase: a full down-and-up stroke per turn.
  function wing(g, s, ph, k) {
    const up = Math.cos(ph);                 // 1 wings high, -1 wings low
    const tipY = -up * s * 1.1 * k, tipX = -s * (0.25 + 0.25 * (1 - Math.abs(up)));
    g.beginPath();
    g.moveTo(s * 0.36, -s * 0.06);
    g.bezierCurveTo(s * 0.4, tipY * 0.5, s * 0.1, tipY * 0.95, tipX, tipY);
    g.bezierCurveTo(tipX + s * 0.05, tipY * 0.6, -s * 0.05, tipY * 0.25 + s * 0.04, -s * 0.24, -s * 0.03);
    g.closePath();
    g.fill();
  }
  function bird(g, s, ph, ink, shade) {
    // The far wing, a little behind in the stroke and in shadow.
    g.fillStyle = shade;
    wing(g, s, ph - 0.5, 0.75);
    g.fillStyle = ink;
    g.beginPath();
    g.moveTo(s * 0.78, -s * 0.06);
    g.quadraticCurveTo(s * 0.62, -s * 0.26, s * 0.3, -s * 0.15);
    g.quadraticCurveTo(-s * 0.2, -s * 0.14, -s * 0.62, -s * 0.03);
    g.lineTo(-s * 1.0, -s * 0.2); g.lineTo(-s * 0.9, s * 0.08);
    g.quadraticCurveTo(-s * 0.2, s * 0.2, s * 0.38, s * 0.1);
    g.quadraticCurveTo(s * 0.66, s * 0.06, s * 0.78, -s * 0.06);
    g.closePath();
    g.fill();
    wing(g, s, ph, 1);
  }

  function draw(p, x, y, r, t, a, state, look) {
    const E = openEye(p, x, y, r, t, state, look);
    const g = E.g, R = E.R, cx = E.ix, cy = E.iy, S = E.S;
    const dt = clamp(t - (state.t == null ? t : state.t), 0, 0.1);
    state.t = t;
    if (state.seed == null) { state.seed = Math.random(); state.rot = state.seed * TAU; state.flap = 0; state.sync = 0; }
    const bands = a.bands || [];
    const bass = clamp(((bands[0] || 0) + (bands[1] || 0)) / 200, 0, 1);
    const kick = a.kick || 0, snare = a.snare || 0, hat = a.hat || 0;
    if (onset(state, 'pk', kick, 0.25)) state.syncT = t;
    if (onset(state, 'ps', snare, 0.3)) state.dipT = t;
    // Sync: 1 on the kick, easing back out of step over ~0.4 s.
    const sync = state.syncT == null ? 0 : Math.exp(-(t - state.syncT) / 0.22);
    state.rot += dt * (0.25 + 0.7 * bass);
    state.flap += dt * TAU * (1.4 + 1.2 * bass);
    const dip = state.dipT == null ? 0 : Math.sin(clamp((t - state.dipT) / 0.45, 0, 1) * Math.PI);

    // The card.
    const ig = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    ig.addColorStop(0, '#2f8a86'); ig.addColorStop(0.6, '#1f6a6c'); ig.addColorStop(0.92, '#123f45'); ig.addColorStop(1, '#0a2226');
    g.fillStyle = ig;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const n = 9;
    g.save();
    g.translate(cx, cy);
    g.rotate(state.rot);
    // Slits round the rim, turning with the disc.
    g.fillStyle = 'rgba(6,18,20,0.9)';
    for (let i = 0; i < n; i++) {
      g.save(); g.rotate((i + 0.5) / n * TAU);
      g.fillRect(R * 0.86, -R * 0.022, R * 0.16, R * 0.044);
      g.restore();
    }
    // A fine printed ring the birds fly along.
    g.strokeStyle = 'rgba(236,224,196,0.28)';
    g.lineWidth = Math.max(R * 0.008, 0.5 / S);
    g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.stroke();
    // Birds: bird i is i frames along the wingbeat, so the ring is one flap
    // unrolled; the kick pulls them all into the same frame.
    const s = R * 0.19;
    const rb = R * (0.63 - 0.12 * dip);
    for (let i = 0; i < n; i++) {
      const th = i / n * TAU;
      const ph = state.flap - (1 - sync) * i / n * TAU * 2;
      g.save();
      g.rotate(th);
      g.translate(rb, 0);
      // Fly clockwise: forward is +y in this frame, up is outward (+x).
      g.rotate(Math.PI / 2);
      g.scale(1, 1);
      bird(g, s, ph, '#f3e8cc', '#9fb8a8');
      g.restore();
    }
    // Hats: tiny four-point stars between the birds.
    if (hat > 0.05) {
      g.strokeStyle = 'rgba(255,246,220,' + clamp(hat * 1.3, 0, 1).toFixed(3) + ')';
      g.lineWidth = Math.max(R * 0.01, 0.5 / S);
      for (let i = 0; i < n; i++) {
        if (hash(i + Math.floor(t * 9) * 0.37 + state.seed) < 0.55) continue;
        const th = (i + 0.5) / n * TAU, rr = R * (0.5 + 0.3 * hash(i * 3.1 + Math.floor(t * 9)));
        const sx = Math.cos(th) * rr, sy = Math.sin(th) * rr, L = R * 0.035;
        g.beginPath(); g.moveTo(sx - L, sy); g.lineTo(sx + L, sy); g.moveTo(sx, sy - L); g.lineTo(sx, sy + L); g.stroke();
      }
    }
    g.restore();

    // Pupil: the disc's hub.
    const rp = R * (0.3 + 0.05 * bass);
    const pg = g.createRadialGradient(cx, cy - rp * 0.2, rp * 0.1, cx, cy, rp);
    pg.addColorStop(0, '#15191c'); pg.addColorStop(1, '#050607');
    g.fillStyle = pg;
    g.beginPath(); g.arc(cx, cy, rp, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(241,230,204,0.5)';
    g.lineWidth = Math.max(R * 0.012, 0.6 / S);
    g.beginPath(); g.arc(cx, cy, rp * 1.08, 0, TAU); g.stroke();
    closeEye(E);
  }

  VIZ_EYES.register({
    id: 'zoetrope',
    name: 'Zoetrope',
    idea: 'The iris is a spinning phenakistoscope disc: a ring of paper birds circles the pupil, each one frame further through the same wingbeat, so a wave of flapping runs round the ring, and on the kick they all beat as one.',
    draw
  });
})();
