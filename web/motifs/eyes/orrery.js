// Orrery
// The iris is a brass orrery on blue enamel: a toothed limbus ring that
// turns, four engraved tracks, and four planets on arms around a pupil
// that holds a small gold sun. Each kick ratchets the next planet forward a
// notch, round-robin, so the beat walks round the system; the bass warms
// the sun and turns the gear; the snare sends a comet across the enamel;
// hats glint the engraved stars. When two planets come into line with the
// sun, a hairline of light joins them.

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

  const ENAMEL_IN = [30, 46, 96], ENAMEL_OUT = [12, 20, 50];
  const BRASS = [214, 176, 98], BRASS_DK = [120, 88, 40];
  const PLANETS = [
    { c: [236, 120, 92], size: 0.055, rate: 0.9 },
    { c: [96, 186, 172], size: 0.065, rate: 0.52 },
    { c: [240, 226, 196], size: 0.075, rate: 0.31, ring: true },
    { c: [168, 138, 220], size: 0.06, rate: 0.19, moon: true },
  ];

  function sphere(g, x, y, rad, c) {
    const sg = g.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
    sg.addColorStop(0, 'rgb(255,250,240)');
    sg.addColorStop(0.25, rgba(c, 1));
    sg.addColorStop(1, rgba([c[0] * 0.35 | 0, c[1] * 0.35 | 0, c[2] * 0.4 | 0], 1));
    g.fillStyle = sg;
    g.beginPath();
    g.arc(x, y, rad, 0, TAU);
    g.fill();
  }

  function inner(g, R, info, a, state, dt) {
    const t = info.t;
    const bass = (a.bands[0] + a.bands[1]) / 200;
    const rp = R * 0.27 * (1 + 0.08 * bass);
    const tracks = [0.42, 0.56, 0.7, 0.83].map((f) => f * R);

    if (!state.th) {
      state.th = PLANETS.map(() => Math.random() * TAU);
      state.tg = state.th.slice();
      state.turn = 0;
      state.gear = 0;
      state.comets = [];
    }
    for (let i = 0; i < 4; i++) state.tg[i] += PLANETS[i].rate * (0.35 + 0.9 * bass) * dt;
    if (hit(state, 'k', a.kick, 0.5)) {
      state.tg[state.turn % 4] += TAU / 12;
      state.turn++;
    }
    if (hit(state, 's', a.snare, 0.5) && state.comets.length < 2) {
      const ang = Math.random() * TAU;
      state.comets.push({ ang, off: (Math.random() - 0.5) * 0.9, life: 1 });
    }
    for (let i = 0; i < 4; i++) state.th[i] += (state.tg[i] - state.th[i]) * (1 - Math.exp(-dt / 0.08));
    state.gear += dt * (0.04 + 0.25 * bass);
    state.comets.forEach((c) => (c.life -= dt * 1.4));
    state.comets = state.comets.filter((c) => c.life > 0);

    // Enamel.
    const eg = g.createRadialGradient(0, 0, rp, 0, 0, R);
    eg.addColorStop(0, rgba(ENAMEL_IN, 1));
    eg.addColorStop(1, rgba(ENAMEL_OUT, 1));
    g.fillStyle = eg;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();

    // Engraved stars, glinting on the hats.
    for (let i = 0; i < 14; i++) {
      const ang = i * 2.399 + 0.3, d = rp + (R * 0.86 - rp) * ((i * 0.618 + 0.2) % 1);
      const sx = Math.cos(ang) * d, sy = Math.sin(ang) * d;
      const tw = a.hat * (0.5 + 0.5 * Math.sin(t * 12 + i * 5));
      const L = R * (0.012 + 0.035 * tw);
      g.strokeStyle = 'rgba(240,220,160,' + (0.3 + 0.7 * tw).toFixed(3) + ')';
      g.lineWidth = Math.max(0.35, R * 0.006);
      g.beginPath();
      g.moveTo(sx - L, sy); g.lineTo(sx + L, sy);
      g.moveTo(sx, sy - L); g.lineTo(sx, sy + L);
      g.stroke();
    }

    // Comets on the snare: a streak crossing the enamel along a chord.
    g.globalCompositeOperation = 'lighter';
    state.comets.forEach((c) => {
      const u = 1 - c.life;
      const dx = Math.cos(c.ang), dy = Math.sin(c.ang);
      const ox = -dy * c.off * R, oy = dx * c.off * R;
      const hx = ox + dx * R * (-1 + 2.2 * u), hy = oy + dy * R * (-1 + 2.2 * u);
      const tail = R * 0.35;
      const cg = g.createLinearGradient(hx, hy, hx - dx * tail, hy - dy * tail);
      cg.addColorStop(0, 'rgba(255,245,215,0.9)');
      cg.addColorStop(1, 'rgba(255,220,160,0)');
      g.strokeStyle = cg;
      g.lineWidth = Math.max(0.6, R * 0.02);
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - dx * tail, hy - dy * tail);
      g.stroke();
    });
    g.globalCompositeOperation = 'source-over';

    // Tracks.
    g.strokeStyle = rgba(BRASS, 0.45);
    g.lineWidth = Math.max(0.4, R * 0.008);
    tracks.forEach((tr) => { g.beginPath(); g.arc(0, 0, tr, 0, TAU); g.stroke(); });

    // Syzygy: two planets in line with the sun.
    const pos = PLANETS.map((pl, i) => ({ x: Math.cos(state.th[i]) * tracks[i], y: Math.sin(state.th[i]) * tracks[i], a: state.th[i] }));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      let d = Math.abs(((pos[i].a - pos[j].a) % TAU + TAU + Math.PI) % TAU - Math.PI);
      if (d < 0.14) {
        const k = 1 - d / 0.14;
        g.strokeStyle = 'rgba(255,236,190,' + (0.7 * k).toFixed(3) + ')';
        g.lineWidth = Math.max(0.4, R * 0.01);
        const far = tracks[j] + R * 0.1;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(pos[j].a) * far, Math.sin(pos[j].a) * far);
        g.stroke();
      }
    }

    // Arms and planets.
    g.strokeStyle = rgba(BRASS, 0.9);
    g.lineWidth = Math.max(0.5, R * 0.014);
    for (let i = 0; i < 4; i++) {
      const pl = PLANETS[i], q = pos[i];
      const ca = Math.cos(q.a), sa = Math.sin(q.a);
      g.beginPath();
      g.moveTo(ca * rp, sa * rp);
      g.lineTo(q.x, q.y);
      g.stroke();
      const pr = R * pl.size;
      if (pl.ring) {
        g.strokeStyle = rgba(BRASS, 0.9);
        g.lineWidth = Math.max(0.4, R * 0.01);
        g.beginPath();
        g.ellipse(q.x, q.y, pr * 1.8, pr * 0.55, -0.4, 0, TAU);
        g.stroke();
      }
      sphere(g, q.x, q.y, pr, pl.c);
      if (pl.moon) {
        const ma = t * 2.4 + i;
        sphere(g, q.x + Math.cos(ma) * pr * 1.9, q.y + Math.sin(ma) * pr * 1.9, pr * 0.35, [220, 220, 230]);
      }
      g.strokeStyle = rgba(BRASS, 0.9);
      g.lineWidth = Math.max(0.5, R * 0.014);
    }

    // The toothed limbus ring, turning with the bass.
    const n = 44, ro = R * 0.985, ri = R * 0.9, tooth = R * 0.045;
    g.fillStyle = rgba(BRASS, 1);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = state.gear + (i / n) * TAU, a1 = a0 + TAU / n;
      const w = (a1 - a0) * 0.28;
      g.lineTo(Math.cos(a0 + w) * (ro - tooth), Math.sin(a0 + w) * (ro - tooth));
      g.lineTo(Math.cos(a0 + w * 1.4) * ro, Math.sin(a0 + w * 1.4) * ro);
      g.lineTo(Math.cos(a1 - w * 1.4) * ro, Math.sin(a1 - w * 1.4) * ro);
      g.lineTo(Math.cos(a1 - w) * (ro - tooth), Math.sin(a1 - w) * (ro - tooth));
    }
    g.closePath();
    g.moveTo(ri, 0);
    g.arc(0, 0, ri, 0, TAU);
    g.fill('evenodd');
    g.strokeStyle = rgba(BRASS_DK, 0.9);
    g.lineWidth = Math.max(0.4, R * 0.01);
    g.beginPath();
    g.arc(0, 0, ri, 0, TAU);
    g.stroke();

    // Pupil, with the sun at its heart.
    g.fillStyle = 'rgb(6,8,16)';
    g.beginPath();
    g.arc(0, 0, rp, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(BRASS, 0.85);
    g.lineWidth = Math.max(0.5, R * 0.016);
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    const sr = rp * (0.32 + 0.12 * bass + 0.08 * a.kick);
    const hg = g.createRadialGradient(0, 0, 0, 0, 0, sr * 2.6);
    hg.addColorStop(0, 'rgba(255,220,140,0.7)');
    hg.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = hg;
    g.beginPath();
    g.arc(0, 0, sr * 2.6, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    sphere(g, 0, 0, sr, [255, 196, 90]);
  }

  VIZ_EYES.register({
    id: 'orrery',
    name: 'Orrery',
    idea: 'The iris is a brass orrery on blue enamel with a gold sun in the pupil; each kick ratchets the next planet a notch round its track, and planets that fall into line are joined by a hairline of light.',
    draw(p, x, y, r, t, a, state, look) {
      const dt = dtOf(state, t);
      eye(p, x, y, r, t, state, look, {
        open: 0.57, iris: 0.52, lashes: 5, catch: true,
        sclera: [[244, 240, 232], [188, 180, 172]], ink: [28, 26, 40], shade: [50, 50, 80], lid: [104, 110, 146],
      }, (g, R, info) => inner(g, R, info, a, state, dt));
    },
  });
})();
