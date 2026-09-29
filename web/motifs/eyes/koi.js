// Koi Pond
// The iris is a ring of jade water and three koi swim circuits round the
// pupil, which is the pond's dark deep middle with the moon in it. The bass
// sets their pace; each kick sends a ripple out from the pupil's edge and
// makes them dart; now and then, on a snare, one leaps clean across the
// pupil and splashes back in. The hats glint on the water.

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

  const WATER_IN = [74, 150, 136], WATER_OUT = [22, 74, 82];
  const FISH = [
    { body: [246, 240, 228], spot: [226, 84, 42], orbit: 0.36, rate: 0.55, len: 0.3 },
    { body: [238, 140, 40], spot: [250, 206, 120], orbit: 0.62, rate: 0.42, len: 0.36 },
    { body: [240, 236, 226], spot: [30, 30, 36], orbit: 0.84, rate: 0.33, len: 0.32 },
  ];

  // A koi along a path: pts from head (0) to tail, each { x, y }, widths w.
  function koi(g, pts, wid, f, scale) {
    const n = pts.length;
    // Fins first, under the body.
    const h = pts[2], h1 = pts[3];
    const ang = Math.atan2(h.y - h1.y, h.x - h1.x);
    g.fillStyle = rgba(f.body, 0.75);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(h.x + Math.cos(ang + s * 1.9) * wid * 1.1, h.y + Math.sin(ang + s * 1.9) * wid * 1.1,
        wid * 0.9, wid * 0.35, ang + s * 0.9, 0, TAU);
      g.fill();
    }
    // Tail fan.
    const tl = pts[n - 1], tp = pts[n - 2];
    const ta = Math.atan2(tl.y - tp.y, tl.x - tp.x);
    g.beginPath();
    g.moveTo(tl.x, tl.y);
    g.lineTo(tl.x + Math.cos(ta + 0.55) * wid * 1.6, tl.y + Math.sin(ta + 0.55) * wid * 1.6);
    g.quadraticCurveTo(tl.x + Math.cos(ta) * wid * 0.9, tl.y + Math.sin(ta) * wid * 0.9,
      tl.x + Math.cos(ta - 0.55) * wid * 1.6, tl.y + Math.sin(ta - 0.55) * wid * 1.6);
    g.closePath();
    g.fill();
    // Body as overlapping discs, head to tail.
    for (let i = n - 1; i >= 0; i--) {
      const u = i / (n - 1);
      const w = wid * (u < 0.2 ? 0.75 + 1.25 * u : 1 - 0.8 * (u - 0.2) / 0.8);
      const spot = (i === 1 || i === 4 || i === 5 || (f.spot[0] < 100 && i === 7));
      g.fillStyle = rgba(spot ? f.spot : f.body, 1);
      g.beginPath();
      g.arc(pts[i].x, pts[i].y, Math.max(0.3, w), 0, TAU);
      g.fill();
    }
  }

  function inner(g, R, info, a, state, dt) {
    const t = info.t;
    const bass = (a.bands[0] + a.bands[1]) / 200;
    const rp = R * 0.27 * (1 + 0.1 * bass);

    if (!state.ang) {
      state.ang = FISH.map(() => Math.random() * TAU);
      state.dart = 0;
      state.rips = [];
      state.leap = null;
      state.lastLeap = -10;
    }
    if (hit(state, 'k', a.kick, 0.5)) {
      state.rips.push({ age: 0 });
      state.dart = 1;
    }
    if (hit(state, 's', a.snare, 0.5) && !state.leap && t - state.lastLeap > 5) {
      const which = Math.floor(Math.random() * FISH.length);
      state.leap = { f: which, u: 0, a: state.ang[which] };
      state.lastLeap = t;
    }
    state.dart *= Math.exp(-dt / 0.25);
    for (let i = 0; i < FISH.length; i++) {
      if (state.leap && state.leap.f === i) continue;
      state.ang[i] += dt * FISH[i].rate * (0.4 + 0.9 * bass + 1.6 * state.dart);
    }
    state.rips.forEach((q) => (q.age += dt));
    state.rips = state.rips.filter((q) => q.age < 1.1);

    // Water.
    const wg = g.createRadialGradient(0, 0, rp, 0, 0, R);
    wg.addColorStop(0, rgba(WATER_IN, 1));
    wg.addColorStop(1, rgba(WATER_OUT, 1));
    g.fillStyle = wg;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    // Slow rings of light on the water.
    g.lineWidth = Math.max(0.4, R * 0.012);
    for (let i = 0; i < 4; i++) {
      const rr = rp + (R - rp) * ((t * 0.05 + i / 4) % 1);
      g.strokeStyle = 'rgba(200,240,226,0.08)';
      g.beginPath();
      g.arc(0, 0, rr, 0, TAU);
      g.stroke();
    }

    // The fish, a little under the surface: a soft shadow, then the body.
    const fishPts = (i, a0, rho, len) => {
      const pts = [];
      for (let j = 0; j < 9; j++) {
        const back = (j / 8) * len / rho;
        const wig = Math.sin(t * (5 + 6 * state.dart) - j * 0.8 + i) * R * 0.018 * (j / 8);
        const ang = a0 - back;
        pts.push({ x: Math.cos(ang) * (rho + wig), y: Math.sin(ang) * (rho + wig) });
      }
      return pts;
    };
    for (let i = 0; i < FISH.length; i++) {
      if (state.leap && state.leap.f === i) continue;
      const f = FISH[i];
      const rho = rp + (R * 0.92 - rp) * f.orbit;
      const pts = fishPts(i, state.ang[i], rho, R * f.len);
      g.save();
      g.translate(R * 0.02, R * 0.03);
      g.globalAlpha = 0.35;
      koi(g, pts, R * 0.05, { body: [10, 40, 44], spot: [10, 40, 44] });
      g.restore();
      koi(g, pts, R * 0.05, f);
    }

    // Lily pad, drifting round slowly near the rim.
    const la = t * 0.03 + 1.2, lr = R * 0.8;
    const lx = Math.cos(la) * lr, ly = Math.sin(la) * lr;
    g.fillStyle = 'rgb(96,150,70)';
    g.beginPath();
    g.moveTo(lx, ly);
    g.arc(lx, ly, R * 0.13, la + 0.35, la + TAU - 0.35);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgb(246,190,200)';
    g.beginPath();
    g.arc(lx - Math.cos(la) * R * 0.05, ly - Math.sin(la) * R * 0.05, R * 0.035, 0, TAU);
    g.fill();

    // Ripples leave the pupil on the kick.
    state.rips.forEach((q) => {
      const rr = rp + (R - rp) * q.age / 1.1;
      g.strokeStyle = 'rgba(230,255,246,' + (0.55 * (1 - q.age / 1.1)).toFixed(3) + ')';
      g.lineWidth = Math.max(0.5, R * 0.018);
      g.beginPath();
      g.arc(0, 0, rr, 0, TAU);
      g.stroke();
    });

    // Glints on the hats.
    for (let i = 0; i < 8; i++) {
      const ang = i * 2.4 + t * 0.07, d = rp + (R - rp) * ((i * 0.53 + 0.15) % 0.9);
      const tw = a.hat * Math.max(0, Math.sin(t * 9 + i * 2.2));
      if (tw < 0.05) continue;
      g.fillStyle = 'rgba(255,255,248,' + (0.9 * tw).toFixed(3) + ')';
      g.beginPath();
      g.ellipse(Math.cos(ang) * d, Math.sin(ang) * d, R * 0.03 * tw + 0.3, R * 0.01 + 0.2, ang + 1.57, 0, TAU);
      g.fill();
    }

    // The deep middle, with the moon reflected in it, trembling.
    const pg = g.createRadialGradient(0, 0, 0, 0, 0, rp);
    pg.addColorStop(0, 'rgb(12,26,40)');
    pg.addColorStop(1, 'rgb(4,10,16)');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(0, 0, rp, 0, TAU);
    g.fill();
    const mx = rp * 0.25 + Math.sin(t * 1.3) * rp * 0.03, my = -rp * 0.2;
    const mr = rp * 0.26;
    g.save();
    g.beginPath();
    g.arc(0, 0, rp, 0, TAU);
    g.clip();
    g.fillStyle = 'rgba(250,240,210,0.9)';
    g.beginPath();
    g.arc(mx, my, mr, 0, TAU);
    g.fill();
    g.fillStyle = 'rgb(8,18,28)';
    g.beginPath();
    g.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, TAU);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(8,30,34,0.9)';
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.arc(0, 0, R * 0.975, 0, TAU);
    g.stroke();

    // A leap: one koi arcs across the pupil, rising toward us, and back in.
    if (state.leap) {
      const L = state.leap;
      L.u += dt / 1.1;
      const f = FISH[L.f];
      const rho = rp + (R * 0.92 - rp) * f.orbit;
      const a0 = L.a, a1 = L.a + Math.PI;
      const u = Math.min(1, L.u);
      const x0 = Math.cos(a0) * rho, y0 = Math.sin(a0) * rho, x1 = Math.cos(a1) * rho, y1 = Math.sin(a1) * rho;
      const cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * R * 0.25;
      const lift = 1 + 0.7 * Math.sin(u * Math.PI);
      const dir = Math.atan2((y1 - y0) - Math.cos(u * Math.PI) * Math.PI * R * 0.25, x1 - x0);
      const pts = [];
      for (let j = 0; j < 9; j++) {
        const bend = Math.sin(u * TAU * 2 - j * 0.6) * 0.15 * (j / 8);
        const d = (j / 8) * R * f.len * lift;
        pts.push({ x: cx - Math.cos(dir + bend) * d, y: cy - Math.sin(dir + bend) * d });
      }
      koi(g, pts, R * 0.05 * lift, f);
      // Splashes where it leaves and where it lands.
      for (const [sx, sy, su] of [[x0, y0, u], [x1, y1, u - 0.85]]) {
        if (su < 0 || su > 0.4) continue;
        const k = su / 0.4;
        g.strokeStyle = 'rgba(235,255,250,' + (0.7 * (1 - k)).toFixed(3) + ')';
        g.lineWidth = Math.max(0.4, R * 0.012);
        g.beginPath();
        g.arc(sx, sy, R * (0.03 + 0.12 * k), 0, TAU);
        g.stroke();
      }
      if (L.u >= 1.3) {
        state.ang[L.f] = a1;
        state.leap = null;
      }
    }
  }

  VIZ_EYES.register({
    id: 'koi',
    name: 'Koi Pond',
    idea: 'The iris is a ring of jade water where three koi swim circuits round a pupil that is the pond\'s dark middle with the moon in it; kicks send ripples out and, now and then, a koi leaps across the pupil.',
    draw(p, x, y, r, t, a, state, look) {
      const dt = dtOf(state, t);
      eye(p, x, y, r, t, state, look, {
        open: 0.58, iris: 0.52, lashes: 6, catch: true,
        sclera: [[244, 244, 236], [186, 192, 182]], ink: [22, 40, 38], shade: [40, 70, 70], lid: [132, 150, 128],
      }, (g, R, info) => inner(g, R, info, a, state, dt));
    },
  });
})();
