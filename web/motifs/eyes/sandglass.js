// Sandglass
// The pupil is an hourglass of dark glass, capped top and bottom, with gold
// sand pouring through its waist. The bass sets how fast it runs; each kick
// drops a clot of grains that bounce off the pile; when the top bulb runs
// dry the whole pupil turns over, slowly, and starts again. The hats glint
// on the falling grains; the snare runs a highlight down the glass.

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

  const IRIS = [[96, 128, 160], [62, 88, 124], [34, 50, 76]];
  const SAND = [236, 198, 124], SAND_DK = [186, 142, 76];
  const GLASS = [10, 12, 22];
  const CAP = [70, 44, 30];

  // Hourglass outline, half-height hh, bulb half-width bw, waist half-width ww.
  function glassPath(g, hh, bw, ww) {
    g.beginPath();
    g.moveTo(-bw * 0.82, -hh);
    g.lineTo(bw * 0.82, -hh);
    g.bezierCurveTo(bw * 1.22, -hh * 0.62, ww * 2.2, -hh * 0.2, ww, 0);
    g.bezierCurveTo(ww * 2.2, hh * 0.2, bw * 1.22, hh * 0.62, bw * 0.82, hh);
    g.lineTo(-bw * 0.82, hh);
    g.bezierCurveTo(-bw * 1.22, hh * 0.62, -ww * 2.2, hh * 0.2, -ww, 0);
    g.bezierCurveTo(-ww * 2.2, -hh * 0.2, -bw * 1.22, -hh * 0.62, -bw * 0.82, -hh);
    g.closePath();
  }

  const ease = (u) => u * u * (3 - 2 * u);

  function inner(g, R, info, a, state, dt) {
    const t = info.t;
    const bass = (a.bands[0] + a.bands[1]) / 200;
    const hh = R * 0.36 * (1 + 0.05 * bass), bw = R * 0.23, ww = R * 0.022;

    if (state.f == null) { state.f = 0.35 + Math.random() * 0.6; state.flip = -1; state.puffs = []; state.shine = 1; }
    const kicked = hit(state, 'k', a.kick, 0.5);
    if (hit(state, 's', a.snare, 0.5)) state.shine = 0;
    state.shine = Math.min(1, state.shine + dt * 1.6);
    const running = state.flip < 0 && state.f > 0;
    if (running) {
      state.f -= dt * (0.03 + 0.07 * bass) + (kicked ? 0.006 : 0);
      if (state.f <= 0) { state.f = 0; state.flip = 0; }
    } else if (state.flip >= 0) {
      state.flip += dt / 1.6;
      if (state.flip >= 1) { state.flip = -1; state.f = 1 - state.f; }
    }
    const pileTop = hh - hh * 0.92 * Math.pow(1 - state.f, 0.75);
    if (kicked && running) {
      for (let i = 0; i < 7; i++) {
        state.puffs.push({ x: 0, y: pileTop, vx: (Math.random() - 0.5) * R * 0.7, vy: -R * (0.2 + Math.random() * 0.35), life: 1 });
      }
    }
    state.puffs.forEach((q) => {
      q.vy += R * 2.2 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt * 2.2;
    });
    state.puffs = state.puffs.filter((q) => q.life > 0).slice(-24);

    // Iris: slate blue, fibred, with a sandy collarette round the glass.
    const ig = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    ig.addColorStop(0, rgba(IRIS[0], 1));
    ig.addColorStop(0.6, rgba(IRIS[1], 1));
    ig.addColorStop(1, rgba(IRIS[2], 1));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    g.lineWidth = Math.max(0.4, R * 0.011);
    for (let i = 0; i < 80; i++) {
      const ang = (i / 80) * TAU;
      const r0 = R * (0.4 + 0.08 * ((i * 0.618) % 1)), r1 = R * (0.72 + 0.24 * ((i * 0.382) % 1));
      g.strokeStyle = i % 2 ? 'rgba(20,30,50,0.25)' : 'rgba(200,220,240,0.18)';
      g.beginPath();
      g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
      g.quadraticCurveTo(Math.cos(ang + 0.06) * (r0 + r1) / 2, Math.sin(ang + 0.06) * (r0 + r1) / 2, Math.cos(ang) * r1, Math.sin(ang) * r1);
      g.stroke();
    }
    g.strokeStyle = 'rgba(214,180,120,0.35)';
    g.lineWidth = R * 0.03;
    g.beginPath();
    g.arc(0, 0, R * 0.47, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(16,24,40,0.85)';
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.arc(0, 0, R * 0.975, 0, TAU);
    g.stroke();

    // The hourglass, turning over when it is empty.
    g.save();
    const rot = state.flip >= 0 ? Math.PI * ease(state.flip) : 0;
    g.rotate(rot);
    glassPath(g, hh, bw, ww);
    g.fillStyle = rgba(GLASS, 1);
    g.fill();
    g.save();
    g.clip();
    // Sand in the top bulb, dimpled where it drains.
    const f = state.f;
    if (f > 0.002) {
      const surf = -hh * 0.92 * Math.pow(f, 0.75) - hh * 0.04;
      const dip = running ? R * 0.035 * Math.min(1, f * 4) : 0;
      const sg = g.createLinearGradient(0, surf, 0, 0);
      sg.addColorStop(0, rgba(SAND, 1));
      sg.addColorStop(1, rgba(SAND_DK, 1));
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(-bw * 1.3, surf);
      g.quadraticCurveTo(0, surf + dip * 2, bw * 1.3, surf);
      g.lineTo(bw * 1.3, 0.001);
      g.lineTo(-bw * 1.3, 0.001);
      g.closePath();
      g.fill();
    }
    // The pile below: a cone on a flat bed.
    if (1 - f > 0.002) {
      const hp = hh - pileTop;
      const pg = g.createLinearGradient(0, pileTop, 0, hh);
      pg.addColorStop(0, rgba(SAND, 1));
      pg.addColorStop(1, rgba(SAND_DK, 1));
      g.fillStyle = pg;
      g.beginPath();
      g.moveTo(-bw * 1.3, hh - hp * 0.45);
      g.quadraticCurveTo(-bw * 0.3, hh - hp * 0.6, 0, pileTop);
      g.quadraticCurveTo(bw * 0.3, hh - hp * 0.6, bw * 1.3, hh - hp * 0.45);
      g.lineTo(bw * 1.3, hh);
      g.lineTo(-bw * 1.3, hh);
      g.closePath();
      g.fill();
    }
    // The stream, thicker with the bass and a kick's clot.
    if (running) {
      g.strokeStyle = rgba(SAND, 0.95);
      g.lineWidth = Math.max(0.5, R * (0.01 + 0.012 * bass + 0.02 * a.kick));
      g.beginPath();
      g.moveTo(0, -R * 0.01);
      g.lineTo(0, pileTop);
      g.stroke();
      for (let i = 0; i < 6; i++) {
        const u = (t * 2.4 + i / 6) % 1;
        const gy = u * pileTop, gx = Math.sin(i * 9.1 + t) * R * 0.008;
        const tw = a.hat * (0.5 + 0.5 * Math.sin(t * 17 + i * 4));
        g.fillStyle = tw > 0.3 ? 'rgba(255,250,230,' + (0.5 + 0.5 * tw).toFixed(3) + ')' : rgba(SAND, 1);
        g.beginPath();
        g.arc(gx, gy, Math.max(0.4, R * (0.009 + 0.01 * tw)), 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = rgba(SAND, 1);
    state.puffs.forEach((q) => {
      g.globalAlpha = Math.min(1, q.life * 1.5);
      g.beginPath();
      g.arc(q.x, Math.min(q.y, hh), Math.max(0.4, R * 0.01), 0, TAU);
      g.fill();
    });
    g.globalAlpha = 1;
    // The snare's highlight, running down the left side of the glass.
    if (state.shine < 1) {
      const hy = -hh + 2 * hh * state.shine;
      const hg = g.createRadialGradient(-bw * 0.55, hy, 0, -bw * 0.55, hy, R * 0.15);
      hg.addColorStop(0, 'rgba(255,255,255,' + (0.55 * (1 - state.shine)).toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hg;
      g.fillRect(-bw * 1.3, -hh, bw * 2.6, hh * 2);
    }
    g.restore();
    // Glass sheen and caps.
    g.strokeStyle = 'rgba(220,235,255,0.28)';
    g.lineWidth = Math.max(0.4, R * 0.012);
    glassPath(g, hh, bw, ww);
    g.stroke();
    g.fillStyle = rgba(CAP, 1);
    const cw = bw * 1.05, chh = R * 0.045;
    g.fillRect(-cw, -hh - chh, cw * 2, chh);
    g.fillRect(-cw, hh, cw * 2, chh);
    g.fillStyle = 'rgba(255,220,180,0.25)';
    g.fillRect(-cw, -hh - chh, cw * 2, chh * 0.3);
    g.fillRect(-cw, hh, cw * 2, chh * 0.3);
    g.restore();
  }

  VIZ_EYES.register({
    id: 'sandglass',
    name: 'Sandglass',
    idea: 'The pupil is an hourglass pouring gold sand, faster with the bass and in clots on the kick; when the top runs dry the whole pupil turns slowly over and starts again.',
    draw(p, x, y, r, t, a, state, look) {
      const dt = dtOf(state, t);
      eye(p, x, y, r, t, state, look, {
        open: 0.58, iris: 0.52, lashes: 6, catch: true,
        sclera: [[244, 242, 236], [190, 186, 180]], ink: [30, 30, 40], shade: [50, 60, 80], lid: [150, 132, 118],
      }, (g, R, info) => inner(g, R, info, a, state, dt));
    },
  });
})();
