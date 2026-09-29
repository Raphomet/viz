// Keyhole
// The pupil is a keyhole, and through it is a warm lamplit room where one
// small figure is dancing on their own. The room is further away than the
// keyhole, so when the eye glances the view inside shifts the other way,
// and the dancer wanders to the edges and half out of sight. The figure
// steps on every kick, throws their arms up on the snare, and sways with
// the bass; the hats sparkle the dust in the lamplight.

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

  const IRIS = [[204, 158, 72], [134, 124, 64], [72, 78, 54]];
  const WALL_LIT = [255, 206, 138], WALL = [214, 124, 84], FLOOR = [128, 62, 50];
  const FIG = [66, 22, 48];

  // One contour (so its stroke has no seam inside): the slot, then round
  // over the top of the circle.
  function keyholePath(g, R, s) {
    const cy = -0.17 * R * s, cr = 0.2 * R * s;
    const y1 = 0.4 * R * s;
    const wt = 0.075 * R * s, wb = 0.165 * R * s;
    const jy = cy + Math.sqrt(cr * cr - wt * wt);
    const aR = Math.atan2(jy - cy, wt), aL = Math.PI - aR;
    g.beginPath();
    g.moveTo(wt, jy);
    g.lineTo(wb, y1);
    g.lineTo(-wb, y1);
    g.lineTo(-wt, jy);
    g.arc(0, cy, cr, aL, aR + TAU);
    g.closePath();
  }

  // The dancer, feet on the floor at (fx, fy); u is one "head" of height/7.
  function dancer(g, fx, fy, u, pose) {
    const { hop, sway, lift, side, arms, skirt } = pose;
    const hip = { x: fx + sway * 0.5 * u, y: fy - 3.3 * u - hop };
    const neck = { x: fx + sway * 1.0 * u, y: hip.y - 3.0 * u };
    const lim = (a, b, bend) => {
      const mx = (a.x + b.x) / 2 + bend, my = (a.y + b.y) / 2;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.quadraticCurveTo(mx, my, b.x, b.y);
      g.stroke();
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // Legs: one planted, one lifted, swapping each step.
    g.lineWidth = 0.62 * u;
    const planted = { x: fx - side * 0.7 * u, y: fy - hop * 0.2 };
    const lifted = { x: fx + side * (0.9 + 0.5 * lift) * u, y: fy - hop - 1.5 * u * lift };
    lim(hip, planted, -side * 0.3 * u);
    lim(hip, lifted, side * 1.1 * u * lift);
    // Torso and skirt.
    g.lineWidth = 1.0 * u;
    lim(hip, neck, sway * 0.3 * u);
    const w = (1.3 + 0.7 * skirt) * u;
    g.beginPath();
    g.moveTo(hip.x - 0.35 * u + sway * 0.2 * u, hip.y - 1.0 * u);
    g.lineTo(hip.x + 0.35 * u + sway * 0.2 * u, hip.y - 1.0 * u);
    g.lineTo(hip.x + w - sway * 0.3 * u, hip.y + 1.1 * u);
    g.lineTo(hip.x - w - sway * 0.3 * u, hip.y + 1.1 * u);
    g.closePath();
    g.fill();
    // Arms: down and swinging, or thrown up on the snare.
    g.lineWidth = 0.5 * u;
    for (const sgn of [-1, 1]) {
      const sh = { x: neck.x + sgn * 0.55 * u, y: neck.y + 0.4 * u };
      const downX = sh.x + sgn * 1.1 * u + sway * 0.8 * u, downY = sh.y + 2.3 * u;
      const upX = sh.x + sgn * 1.4 * u, upY = sh.y - 2.5 * u;
      const hx = downX + (upX - downX) * arms, hy = downY + (upY - downY) * arms;
      lim(sh, { x: hx, y: hy }, sgn * 0.6 * u);
    }
    // Head.
    g.beginPath();
    g.arc(neck.x + sway * 0.2 * u, neck.y - 1.0 * u, 0.78 * u, 0, TAU);
    g.fill();
  }

  function inner(g, R, info, a, state, dt) {
    const t = info.t;
    const bass = (a.bands[0] + a.bands[1]) / 200;
    const s = 1 + 0.1 * bass;

    // The dance: a step per kick (eased), arms follow the snare.
    if (state.ph == null) { state.ph = 0; state.tg = 0; state.arms = 0; state.wx = Math.random() * 10; }
    if (hit(state, 'k', a.kick, 0.5)) state.tg += 1;
    state.ph += (state.tg - state.ph) * (1 - Math.exp(-dt / 0.09));
    state.arms += (Math.max(a.snare, 0.15 + 0.3 * bass) - state.arms) * (1 - Math.exp(-dt / 0.12));

    // Iris: hazel, with fine fibres.
    const ig = g.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
    ig.addColorStop(0, rgba(IRIS[0], 1));
    ig.addColorStop(0.55, rgba(IRIS[1], 1));
    ig.addColorStop(1, rgba(IRIS[2], 1));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    g.lineWidth = Math.max(0.4, R * 0.012);
    for (let i = 0; i < 72; i++) {
      const ang = (i / 72) * TAU + 0.03 * Math.sin(i * 7.1);
      const r0 = R * (0.28 + 0.1 * ((i * 0.618) % 1)), r1 = R * (0.7 + 0.25 * ((i * 0.382) % 1));
      g.strokeStyle = i % 3 ? 'rgba(60,44,20,0.22)' : 'rgba(250,220,150,0.25)';
      g.beginPath();
      g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
      g.lineTo(Math.cos(ang + 0.03) * r1, Math.sin(ang + 0.03) * r1);
      g.stroke();
    }
    g.strokeStyle = 'rgba(40,34,20,0.8)';
    g.lineWidth = R * 0.05;
    g.beginPath();
    g.arc(0, 0, R * 0.975, 0, TAU);
    g.stroke();

    // Lamplight spilling out of the keyhole onto the iris.
    g.globalCompositeOperation = 'lighter';
    const sp = g.createRadialGradient(0, 0.05 * R, 0, 0, 0.05 * R, R * 0.65);
    sp.addColorStop(0, 'rgba(255,170,80,' + (0.32 + 0.15 * bass).toFixed(3) + ')');
    sp.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = sp;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';

    // The room, through the keyhole.
    g.save();
    keyholePath(g, R, s);
    g.clip();
    const px = -info.look.x * R * 0.14, py = -info.look.y * R * 0.06;
    const lampX = px - 0.3 * R, lampY = py - 0.12 * R;
    const wg = g.createRadialGradient(lampX, lampY, 0, lampX, lampY, R * 0.9);
    wg.addColorStop(0, rgba(WALL_LIT, 1));
    wg.addColorStop(1, rgba(WALL, 1));
    g.fillStyle = wg;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    const floorY = py + 0.3 * R;
    g.fillStyle = rgba(FLOOR, 1);
    g.fillRect(-R, floorY, 2 * R, R);
    g.strokeStyle = 'rgba(70,30,26,0.5)';
    g.lineWidth = Math.max(0.4, R * 0.01);
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(px + i * 0.06 * R, floorY);
      g.lineTo(px + i * 0.16 * R, floorY + 0.3 * R);
      g.stroke();
    }
    // A picture frame on the wall, for depth.
    g.strokeStyle = 'rgba(120,60,40,0.55)';
    g.lineWidth = Math.max(0.5, R * 0.014);
    g.strokeRect(px + 0.16 * R, py - 0.3 * R, 0.14 * R, 0.1 * R);

    // Dust in the lamp's light, sparkling on the hats.
    for (let i = 0; i < 10; i++) {
      const dx = lampX + ((i * 0.37 + t * 0.013 * (1 + i % 3)) % 1 - 0.5) * 0.4 * R;
      const dy = lampY + ((i * 0.61 + t * 0.02) % 1 - 0.5) * 0.35 * R;
      const tw = 0.2 + 0.8 * a.hat * (0.5 + 0.5 * Math.sin(t * 11 + i * 3));
      g.fillStyle = 'rgba(255,248,220,' + (0.25 + 0.6 * tw).toFixed(3) + ')';
      g.beginPath();
      g.arc(dx, dy, Math.max(0.35, R * 0.006 * (1 + tw)), 0, TAU);
      g.fill();
    }

    // The dancer wanders the room; the shadow falls on the wall behind.
    const fx = px + 0.07 * R * Math.sin(t * 0.23 + state.wx) + 0.025 * R * Math.sin(t * 0.61);
    const step = Math.floor(state.ph), fr = state.ph - step;
    const pose = {
      hop: Math.sin(Math.min(1, fr * 1.4) * Math.PI) * 0.035 * R + a.kick * 0.01 * R,
      sway: Math.sin(state.ph * Math.PI) * (0.5 + 0.6 * bass),
      lift: Math.sin(fr * Math.PI),
      side: step % 2 ? 1 : -1,
      arms: state.arms,
      skirt: Math.abs(Math.sin(state.ph * Math.PI)),
    };
    const u = 0.068 * R;
    g.fillStyle = g.strokeStyle = 'rgba(120,50,40,0.28)';
    dancer(g, fx + 0.12 * R, floorY - 0.03 * R, u * 1.05, pose);
    g.fillStyle = g.strokeStyle = rgba(FIG, 1);
    dancer(g, fx, floorY + 0.07 * R, u, pose);
    g.restore();

    // The keyhole's cut edge.
    g.strokeStyle = 'rgba(24,12,8,0.9)';
    g.lineWidth = Math.max(0.6, R * 0.025);
    keyholePath(g, R, s);
    g.stroke();
  }

  VIZ_EYES.register({
    id: 'keyhole',
    name: 'Keyhole',
    idea: 'The pupil is a keyhole onto a warm lamplit room where one small figure dances alone, stepping on the kick and throwing their arms up on the snare.',
    draw(p, x, y, r, t, a, state, look) {
      const dt = dtOf(state, t);
      eye(p, x, y, r, t, state, look, {
        open: 0.58, iris: 0.5, lashes: 6, catch: true,
        sclera: [[246, 240, 228], [196, 180, 160]], ink: [44, 26, 20], shade: [96, 60, 40], lid: [178, 124, 96],
      }, (g, R, info) => inner(g, R, info, a, state, dt));
    },
  });
})();
