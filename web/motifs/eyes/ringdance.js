// Round Dance
// The iris is a ring of small people holding hands, feet to the pupil and
// heads to the rim, dancing round it; from a distance they are just the
// iris's pattern, and the pupil's ember glow lights their feet. The bass
// sets how fast the ring turns; on each kick every other dancer hops, the
// two halves taking turns; a snare turns the whole ring round the other
// way (no more than every few seconds) and lifts their joined hands; the
// hats are fireflies over their heads.

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

  const HONEY = [[250, 204, 112], [214, 142, 60], [132, 74, 40]];
  const INK = [84, 24, 36];

  function inner(g, R, info, a, state, dt) {
    const t = info.t;
    const bass = (a.bands[0] + a.bands[1]) / 200;
    const rp = R * 0.25 * (1 + 0.1 * bass);
    const N = R > 40 ? 12 : 10;

    if (state.rot == null) {
      state.rot = Math.random() * TAU;
      state.dir = 1; state.dirT = 1; state.lastTurn = -10;
      state.grp = 0; state.raise = 0;
    }
    if (hit(state, 'k', a.kick, 0.5)) state.grp ^= 1;
    if (hit(state, 's', a.snare, 0.5) && t - state.lastTurn > 3.5) {
      state.dirT = -state.dirT;
      state.lastTurn = t;
    }
    state.dir += (state.dirT - state.dir) * (1 - Math.exp(-dt / 0.35));
    state.rot += dt * state.dir * (0.12 + 0.5 * bass);
    state.raise += (Math.max(a.snare, 0.2 + 0.5 * bass) - state.raise) * (1 - Math.exp(-dt / 0.2));

    // Honey iris.
    const ig = g.createRadialGradient(0, 0, rp, 0, 0, R);
    ig.addColorStop(0, rgba(HONEY[0], 1));
    ig.addColorStop(0.55, rgba(HONEY[1], 1));
    ig.addColorStop(1, rgba(HONEY[2], 1));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    // Ember light from the pupil on the ground at their feet.
    g.globalCompositeOperation = 'lighter';
    const eg = g.createRadialGradient(0, 0, rp, 0, 0, rp + R * 0.28);
    eg.addColorStop(0, 'rgba(255,150,60,' + (0.35 + 0.35 * bass).toFixed(3) + ')');
    eg.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = eg;
    g.beginPath();
    g.arc(0, 0, rp + R * 0.28, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';

    // The dancers.
    const rf = rp + R * 0.05;
    const hgt = R * 0.88 - rf;
    const u = hgt / 7;
    const P = (phi, tx, rr) => {
      const c = Math.cos(phi), s = Math.sin(phi);
      return { x: c * (rf + rr) - s * tx, y: s * (rf + rr) + c * tx };
    };
    const hopOf = (i) => (i % 2 === state.grp ? a.kick : a.kick * 0.2) * 0.9 * u;
    const handH = 3.6 * u + 2.0 * u * state.raise;
    g.strokeStyle = g.fillStyle = rgba(INK, 1);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < N; i++) {
      const phi = state.rot + (i / N) * TAU;
      const hop = hopOf(i);
      const step = Math.sin(state.rot * 9 + i * Math.PI);   // feet step as the ring turns
      const hip = P(phi, 0, 2.6 * u + hop);
      const neck = P(phi, 0, 5.0 * u + hop);
      const head = P(phi, 0, 5.85 * u + hop);
      const fl = P(phi, -0.75 * u, hop * 0.4 + Math.max(0, step) * 0.8 * u);
      const fr = P(phi, 0.75 * u, hop * 0.4 + Math.max(0, -step) * 0.8 * u);
      g.lineWidth = 0.55 * u;
      g.beginPath();
      g.moveTo(fl.x, fl.y); g.lineTo(hip.x, hip.y); g.lineTo(fr.x, fr.y);
      g.stroke();
      g.lineWidth = 0.95 * u;
      g.beginPath();
      g.moveTo(hip.x, hip.y); g.lineTo(neck.x, neck.y);
      g.stroke();
      if (i % 2 === 0) {
        // A skirt, swinging out on the hop.
        const w = (1.0 + 0.5 * hop / u) * u;
        const a1 = P(phi, -0.3 * u, 4.0 * u + hop), a2 = P(phi, 0.3 * u, 4.0 * u + hop);
        const b1 = P(phi, w, 1.9 * u + hop), b2 = P(phi, -w, 1.9 * u + hop);
        g.beginPath();
        g.moveTo(a1.x, a1.y); g.lineTo(a2.x, a2.y); g.lineTo(b1.x, b1.y); g.lineTo(b2.x, b2.y);
        g.closePath();
        g.fill();
      }
      g.beginPath();
      g.arc(head.x, head.y, 0.72 * u, 0, TAU);
      g.fill();
      // Arms to the hands held with each neighbour, halfway between them.
      g.lineWidth = 0.42 * u;
      for (const sgn of [-1, 1]) {
        const sh = P(phi, sgn * 0.45 * u, 4.7 * u + hop);
        const hand = P(phi + sgn * Math.PI / N, 0, handH + (hop + hopOf(i + (sgn > 0 ? 1 : N - 1))) / 2);
        const el = P(phi + sgn * Math.PI / N * 0.5, 0, (4.7 * u + handH) / 2 + hop - 0.5 * u);
        g.beginPath();
        g.moveTo(sh.x, sh.y);
        g.quadraticCurveTo(el.x, el.y, hand.x, hand.y);
        g.stroke();
      }
    }

    // Fireflies over their heads, on the hats.
    for (let i = 0; i < 10; i++) {
      const ang = i * 2.4 + t * 0.2 * (i % 2 ? 1 : -1);
      const d = R * (0.86 + 0.06 * Math.sin(t * 0.7 + i));
      const tw = a.hat * Math.max(0, Math.sin(t * 8 + i * 1.7));
      if (tw < 0.05) continue;
      g.fillStyle = 'rgba(255,250,200,' + (0.95 * tw).toFixed(3) + ')';
      g.beginPath();
      g.arc(Math.cos(ang) * d, Math.sin(ang) * d, Math.max(0.4, R * 0.018 * tw), 0, TAU);
      g.fill();
    }

    // Pupil, with an ember rim.
    g.fillStyle = 'rgb(14,6,6)';
    g.beginPath();
    g.arc(0, 0, rp, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,140,60,' + (0.4 + 0.4 * bass).toFixed(3) + ')';
    g.lineWidth = Math.max(0.5, R * 0.015);
    g.stroke();
    g.strokeStyle = 'rgba(70,30,16,0.85)';
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.arc(0, 0, R * 0.975, 0, TAU);
    g.stroke();
  }

  VIZ_EYES.register({
    id: 'ringdance',
    name: 'Round Dance',
    idea: 'The iris is a ring of little people holding hands and dancing round the pupil, feet to its ember glow; half of them hop on each kick, and a snare turns the whole ring the other way.',
    draw(p, x, y, r, t, a, state, look) {
      const dt = dtOf(state, t);
      eye(p, x, y, r, t, state, look, {
        open: 0.58, iris: 0.52, lashes: 7, catch: true,
        sclera: [[248, 242, 230], [200, 184, 164]], ink: [50, 24, 20], shade: [100, 60, 40], lid: [184, 120, 100],
      }, (g, R, info) => inner(g, R, info, a, state, dt));
    },
  });
})();
