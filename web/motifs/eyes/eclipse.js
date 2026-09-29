// Totality
// The iris is a dusk sky with the sun's corona in it; the pupil is the moon.
// The moon sits a touch nearer than the sun, so when the eye glances the
// pupil slides off centre by more than the iris does and a crescent of sun
// shows on the far side: the eclipse is total only while the eye looks
// straight at you.

(function () {
  // ---- the quiet anatomy -------------------------------------------------
  // Every style in this set shares the same well-drawn, quiet eye: an almond
  // opening, a shaded sclera, an inked upper lid with a crease and a few
  // lashes, a catchlight that stays put while the iris moves under it. It is
  // repeated in each style file (rather than shared) so the one Raph picks can
  // be lifted out on its own. Only `inner` differs: it draws the iris and
  // pupil at the origin, radius R, already clipped to the opening.
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

  function bez(k, W, s) {
    // Point and upward normal on the lid curve (-W,0)…(W,0), controls at
    // (±W/2, k). k = 4/3 of the apex height.
    const u = 1 - s;
    const px = u * u * u * -W + 3 * u * u * s * (-W / 2) + 3 * u * s * s * (W / 2) + s * s * s * W;
    const py = 3 * u * u * s * k + 3 * u * s * s * k;
    const dx = 3 * u * u * (W / 2) + 6 * u * s * W + 3 * s * s * (W / 2);
    const dy = 3 * u * u * k + 6 * u * s * 0 - 3 * s * s * k;
    const n = Math.hypot(dx, dy) || 1;
    return { x: px, y: py, nx: dy / n, ny: -dx / n };
  }

  function almond(g, W, top, bot) {
    g.beginPath();
    g.moveTo(-W, 0);
    g.bezierCurveTo(-W / 2, top * 4 / 3, W / 2, top * 4 / 3, W, 0);
    g.bezierCurveTo(W / 2, bot * 4 / 3, -W / 2, bot * 4 / 3, -W, 0);
    g.closePath();
  }

  // o: { open, iris, sclera:[inner rgb, outer rgb], ink rgb, shade rgb,
  //      lashes: count, catch: true/false }
  function eye(p, x, y, r, t, state, look, o, inner) {
    const g = p.drawingContext;
    const b = VIZ_EYES.blink(state, t);
    const W = r, H = r * o.open;
    const lx = clamp((look && look.x) || 0, -1, 1), ly = clamp((look && look.y) || 0, -1, 1);
    // The upper lid does the blinking; the lower one barely moves. Looking
    // down drops the upper lid a little, as real lids follow the gaze.
    const top = -H * (1 - 0.12 * Math.max(0, ly)) + H * 1.72 * b;
    const bot = H * 0.8 - H * 0.04 * b;
    const R = r * (o.iris || 0.5);
    const ix = lx * W * 0.4, iy = ly * H * 0.36 + H * 0.05;
    const lw = Math.max(0.6, r * 0.05);

    p.push();
    g.save();
    g.translate(x, y);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Sclera, clipped: everything of the eyeball lives inside the opening.
    g.save();
    almond(g, W, top, bot);
    const sg = g.createRadialGradient(0, H * 0.15, 0, 0, H * 0.15, W * 1.05);
    sg.addColorStop(0, rgba(o.sclera[0], 1));
    sg.addColorStop(1, rgba(o.sclera[1], 1));
    g.fillStyle = sg;
    g.fill();
    g.clip();

    if (b < 0.97) {
      g.save();
      g.translate(ix, iy);
      // A turned eye shows its iris a little foreshortened.
      g.scale(1 - 0.13 * Math.abs(lx), 1 - 0.08 * Math.abs(ly));
      inner(g, R, { t, look: { x: lx, y: ly }, blink: b, r });
      g.restore();
    }

    // The upper lid's shadow on the eyeball, and the corners' curve away.
    const lg = g.createLinearGradient(0, top, 0, top + H * 0.75);
    lg.addColorStop(0, rgba(o.shade, 0.5));
    lg.addColorStop(1, rgba(o.shade, 0));
    g.fillStyle = lg;
    g.fillRect(-W, top - 1, 2 * W, H * 0.8);
    const cg = g.createLinearGradient(-W, 0, W, 0);
    cg.addColorStop(0, rgba(o.shade, 0.35));
    cg.addColorStop(0.28, rgba(o.shade, 0));
    cg.addColorStop(0.72, rgba(o.shade, 0));
    cg.addColorStop(1, rgba(o.shade, 0.35));
    g.fillStyle = cg;
    g.fillRect(-W, -H * 1.2, 2 * W, H * 2.4);

    // Catchlight: fixed to the light, so the iris slides beneath it.
    if (o.catch !== false) {
      const cx = ix * 0.8 - R * 0.34, cy = iy * 0.8 - R * 0.36;
      g.fillStyle = 'rgba(255,253,246,0.9)';
      g.beginPath();
      g.ellipse(cx, cy, R * 0.15, R * 0.11, -0.5, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,253,246,0.45)';
      g.beginPath();
      g.arc(cx + R * 0.62, cy + R * 0.62, R * 0.045, 0, TAU);
      g.fill();
    }
    g.restore();

    // Lids. The upper lid is skin between a fixed fold and the moving lid
    // edge, so it is the lid itself that comes down over the eyeball in a
    // blink; the lower lid is a thin rim. Their tone gives the eye its own
    // edge on any ground, dark or pale.
    const k = top * 4 / 3;
    const lid = o.lid || o.shade;
    g.fillStyle = rgba(lid, 1);
    g.beginPath();
    g.moveTo(-W * 1.02, H * 0.02);
    g.bezierCurveTo(-W * 0.6, -H * 1.5, W * 0.55, -H * 1.54, W * 1.03, 0);
    g.bezierCurveTo(W / 2, k, -W / 2, k, -W * 1.02, H * 0.02);
    g.fill();
    g.beginPath();
    g.moveTo(-W, 0);
    g.bezierCurveTo(-W / 2, bot * 4 / 3, W / 2, bot * 4 / 3, W, 0);
    g.bezierCurveTo(W / 2, bot * 4 / 3 + H * 0.26, -W / 2, bot * 4 / 3 + H * 0.26, -W, 0);
    g.fill();
    g.strokeStyle = rgba(o.ink, 0.55);
    g.lineWidth = lw * 0.4;
    g.beginPath();
    g.moveTo(-W * 1.02, H * 0.02);
    g.bezierCurveTo(-W * 0.6, -H * 1.5, W * 0.55, -H * 1.54, W * 1.03, 0);
    g.stroke();
    g.strokeStyle = rgba(o.ink, 1);
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(-W, 0);
    g.bezierCurveTo(-W / 2, k, W / 2, k, W, 0);
    g.stroke();
    g.lineWidth = lw * 0.4;
    g.strokeStyle = rgba(o.ink, 0.5);
    g.beginPath();
    g.moveTo(-W * 0.95, H * 0.05);
    g.bezierCurveTo(-W / 2, bot * 4 / 3, W / 2, bot * 4 / 3, W * 0.97, H * 0.03);
    g.stroke();
    // Lashes: a few, tapered, curling out toward the corners.
    const n = o.lashes || 0;
    if (n) {
      g.fillStyle = rgba(o.ink, 1);
      for (let i = 0; i < n; i++) {
        const s = 0.14 + 0.76 * (n === 1 ? 0.5 : i / (n - 1));
        const q = bez(k, W, s);
        const len = r * (0.14 + 0.1 * Math.sin(s * Math.PI));
        const sweep = (s - 0.5) * 1.6;
        // Closed, the lid's normal points down; lashes still curl out and up.
        const ny = b > 0.5 ? -Math.abs(q.ny) : q.ny;
        const cx = q.x + q.nx * len * 0.55, cy = q.y + ny * len * 0.6;
        const ex = q.x + (q.nx + sweep) * len, ey = q.y + ny * len * 0.8;
        const w0 = lw * 0.5;
        // A quadratic spine, widened at the root and drawn to a point.
        const L = [], Rr = [];
        for (let j = 0; j <= 6; j++) {
          const u = j / 6, v = 1 - u;
          const px = v * v * q.x + 2 * v * u * cx + u * u * ex;
          const py = v * v * q.y + 2 * v * u * cy + u * u * ey;
          const tx = 2 * v * (cx - q.x) + 2 * u * (ex - cx), ty = 2 * v * (cy - q.y) + 2 * u * (ey - cy);
          const tn = Math.hypot(tx, ty) || 1, w = w0 * (1 - u);
          L.push([px - ty / tn * w, py + tx / tn * w]);
          Rr.push([px + ty / tn * w, py - tx / tn * w]);
        }
        g.beginPath();
        g.moveTo(L[0][0], L[0][1]);
        for (let j = 1; j < L.length; j++) g.lineTo(L[j][0], L[j][1]);
        for (let j = Rr.length - 1; j >= 0; j--) g.lineTo(Rr[j][0], Rr[j][1]);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
    p.pop();
  }

  // Rising-edge detector on one of the gallery's envelopes, kept per eye.
  function hit(state, key, v, thr) {
    const was = state['_' + key] || 0;
    state['_' + key] = v;
    return v > thr && was <= thr;
  }
  function dtOf(state, t) {
    const d = state._t == null ? 1 / 60 : clamp(t - state._t, 0, 0.1);
    state._t = t;
    return d;
  }

  const SKY_IN = [34, 32, 78], SKY_OUT = [18, 18, 48];
  const PEARL = [255, 246, 228];

  // Smooth pseudo-random streamer lengths, looping round the circle.
  function wob(i, t) {
    return 0.5 + 0.28 * Math.sin(i * 2.3 + t * 0.21) + 0.22 * Math.sin(i * 5.7 - t * 0.13 + 1.1);
  }

  function inner(g, R, info, a, state, dt) {
    const t = info.t;
    const bass = (a.bands[0] + a.bands[1]) / 200;
    const rs = R * (0.4 + 0.05 * bass);          // the sun's disc (hidden)
    const rm = rs * 1.02;                         // the moon, just larger

    // Events: each kick lights a Baily's bead that walks round the limb by
    // the golden angle; a snare raises a rose prominence that slowly sinks.
    state.beads = state.beads || [];
    state.proms = state.proms || [];
    if (state.bead == null) state.bead = Math.random() * TAU;
    if (hit(state, 'k', a.kick, 0.5)) {
      state.bead += 2.39996;
      state.beads.push({ a: state.bead, life: 1 });
    }
    if (hit(state, 's', a.snare, 0.5)) {
      state.proms.push({ a: Math.random() * TAU, life: 1, w: 0.18 + Math.random() * 0.18 });
    }
    state.beads.forEach((b) => (b.life -= dt * 2.2));
    state.proms.forEach((q) => (q.life -= dt * 0.7));
    state.beads = state.beads.filter((b) => b.life > 0).slice(-4);
    state.proms = state.proms.filter((q) => q.life > 0).slice(-3);

    // Sky.
    const sky = g.createRadialGradient(0, 0, rs, 0, 0, R);
    sky.addColorStop(0, rgba(SKY_IN, 1));
    sky.addColorStop(0.85, rgba(SKY_OUT, 1));
    sky.addColorStop(1, 'rgba(8,8,24,1)');
    g.fillStyle = sky;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(0, 0, R * 0.985, 0, TAU);
    g.clip();

    // A few stars, which the hats make twinkle.
    for (let i = 0; i < 9; i++) {
      const ang = i * 2.1 + 0.4, d = R * (0.62 + 0.3 * ((i * 0.37) % 1));
      const tw = 0.35 + 0.65 * a.hat * (0.5 + 0.5 * Math.sin(t * 13 + i * 7));
      g.fillStyle = 'rgba(255,250,235,' + (0.25 + 0.6 * tw).toFixed(3) + ')';
      g.beginPath();
      g.arc(Math.cos(ang) * d, Math.sin(ang) * d, R * (0.012 + 0.012 * tw), 0, TAU);
      g.fill();
    }

    // Corona: pearly streamers, longer with the bass, drifting slowly.
    g.globalCompositeOperation = 'lighter';
    const cg = g.createRadialGradient(0, 0, rs * 0.95, 0, 0, R);
    cg.addColorStop(0, rgba(PEARL, 0.55));
    cg.addColorStop(0.35, rgba([220, 214, 240], 0.16));
    cg.addColorStop(1, rgba([200, 200, 255], 0));
    g.fillStyle = cg;
    const N = 36;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * TAU + 0.05 * Math.sin(t * 0.1 + i);
      const len = rs + (R - rs) * (0.25 + 0.75 * wob(i, t)) * (0.55 + 0.6 * bass);
      const hw = (0.05 + 0.04 * wob(i + 11, t)) * TAU / N * 3;
      g.beginPath();
      g.moveTo(Math.cos(ang - hw) * rs, Math.sin(ang - hw) * rs);
      g.quadraticCurveTo(Math.cos(ang) * (rs + len) * 0.62, Math.sin(ang) * (rs + len) * 0.62,
        Math.cos(ang + 0.02) * len, Math.sin(ang + 0.02) * len);
      g.quadraticCurveTo(Math.cos(ang) * (rs + len) * 0.62, Math.sin(ang) * (rs + len) * 0.62,
        Math.cos(ang + hw) * rs, Math.sin(ang + hw) * rs);
      g.fill();
    }
    // Inner corona: a steady pearl ring hugging the limb.
    const ig = g.createRadialGradient(0, 0, rs, 0, 0, rs * 1.6);
    ig.addColorStop(0, rgba(PEARL, 0.9));
    ig.addColorStop(0.25, rgba(PEARL, 0.35));
    ig.addColorStop(1, rgba(PEARL, 0));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(0, 0, rs * 1.6, 0, TAU);
    g.fill();

    // The sun's own disc, which only shows where the moon slips off it.
    // The moon's offset: the gaze, exaggerated (parallax), plus a slow wander.
    const mx = info.look.x * rs * 0.55 + rs * 0.04 * Math.sin(t * 0.17);
    const my = info.look.y * rs * 0.55 + rs * 0.04 * Math.cos(t * 0.13);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgb(255,247,226)';
    g.beginPath();
    g.arc(0, 0, rs, 0, TAU);
    g.fill();

    // Prominences: rose loops standing on the limb.
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = Math.max(0.8, R * 0.035);
    state.proms.forEach((q) => {
      const h = rs * (0.12 + 0.22 * Math.sin(Math.min(1, (1 - q.life) * 3) * Math.PI / 2)) * q.life;
      const a0 = q.a - q.w / 2, a1 = q.a + q.w / 2;
      g.strokeStyle = 'rgba(255,120,150,' + (0.85 * Math.min(1, q.life * 2)).toFixed(3) + ')';
      g.beginPath();
      g.moveTo(Math.cos(a0) * rs, Math.sin(a0) * rs);
      g.bezierCurveTo(Math.cos(a0) * (rs + h * 1.4), Math.sin(a0) * (rs + h * 1.4),
        Math.cos(a1) * (rs + h * 1.4), Math.sin(a1) * (rs + h * 1.4),
        Math.cos(a1) * rs, Math.sin(a1) * rs);
      g.stroke();
    });
    g.globalCompositeOperation = 'source-over';

    // The moon: black, with the faintest earthshine so it reads as a body.
    const mg = g.createRadialGradient(mx - rm * 0.3, my - rm * 0.3, 0, mx, my, rm);
    mg.addColorStop(0, 'rgb(16,16,26)');
    mg.addColorStop(1, 'rgb(4,4,10)');
    g.fillStyle = mg;
    g.beginPath();
    g.arc(mx, my, rm, 0, TAU);
    g.fill();

    // Baily's beads: points of sun between lunar mountains, on the kick.
    g.globalCompositeOperation = 'lighter';
    state.beads.forEach((b) => {
      const bx = Math.cos(b.a) * rs, by = Math.sin(b.a) * rs;
      const k = b.life * b.life;
      const bg2 = g.createRadialGradient(bx, by, 0, bx, by, rs * 0.7);
      bg2.addColorStop(0, 'rgba(255,252,240,' + (0.95 * k).toFixed(3) + ')');
      bg2.addColorStop(0.15, 'rgba(255,240,210,' + (0.5 * k).toFixed(3) + ')');
      bg2.addColorStop(1, 'rgba(255,230,200,0)');
      g.fillStyle = bg2;
      g.beginPath();
      g.arc(bx, by, rs * 0.7, 0, TAU);
      g.fill();
      // The diamond's short rays.
      g.strokeStyle = 'rgba(255,250,235,' + (0.8 * k).toFixed(3) + ')';
      g.lineWidth = Math.max(0.4, R * 0.008);
      const L = rs * (0.18 + 0.3 * k);
      g.beginPath();
      g.moveTo(bx - L, by); g.lineTo(bx + L, by);
      g.moveTo(bx, by - L); g.lineTo(bx, by + L);
      g.stroke();
    });
    g.globalCompositeOperation = 'source-over';
    g.restore();

    // Limbal ring: the iris's dark edge.
    g.strokeStyle = 'rgba(6,6,20,0.85)';
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.arc(0, 0, R * 0.975, 0, TAU);
    g.stroke();
  }

  VIZ_EYES.register({
    id: 'eclipse',
    name: 'Totality',
    idea: 'The pupil is the moon and the iris is the sun\'s corona; glance away and the moon slips, showing a crescent of sun, and each kick lights a Baily\'s bead that walks round the limb.',
    draw(p, x, y, r, t, a, state, look) {
      const dt = dtOf(state, t);
      eye(p, x, y, r, t, state, look, {
        open: 0.56, iris: 0.5, lashes: 7, catch: true,
        sclera: [[241, 238, 244], [178, 172, 196]], ink: [30, 22, 44], shade: [60, 50, 90], lid: [118, 98, 140],
      }, (g, R, info) => inner(g, R, info, a, state, dt));
    },
  });
})();
