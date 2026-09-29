// Marbled: the iris is a marbling bath. The pupil breathes out drops of ink
// that float on the size and push every older ring outward, as on real
// marbled paper; the eye's own glances drag a comb through them, so its
// gaze is written into the pattern, which never repeats.
//
// The ink moves by the exact marbling operations (a drop of radius a at c
// sends every point p to c + (p - c) * sqrt(1 + a^2 / |p - c|^2); a tine
// stroke shifts points along its line, falling off with distance), applied
// to each ring's outline, which is resampled as it stretches.
//
// Music: each kick drops a new ring of ink from the pupil; bass and the drop
// stir the bath (a slow swirl that shears the rings); the snare draws a comb
// across it; hats spatter tiny drops of ink.
(function () {
  // ---- the quiet eye (shared shape across designer C's styles; each file
  // carries its own copy so a style can be lifted into any scene alone) ----
  var TAU = Math.PI * 2;
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  // Slow energy follower on the low bands, so a style can tell the drop from
  // the breakdown without a section clock. Returns dt.
  function follow(state, t, a) {
    var dt = state.lt == null ? 1 / 60 : Math.min(0.1, Math.max(0, t - state.lt));
    state.lt = t;
    var bd = a.bands || [];
    var lvl = ((bd[0] || 0) + (bd[1] || 0) + (bd[2] || 0)) / 300;
    if (state.en == null) state.en = lvl;
    state.en += (lvl - state.en) * (1 - Math.exp(-dt / 1.2));
    state.drop = clamp((state.en - 0.12) / 0.3);
    // Onset clocks (t of the last kick / snare, and a count). An onset is a
    // jump in the envelope rather than a level, so a low Reaction setting,
    // which scales the envelopes down, still registers every hit.
    var k = a.kick || 0, s = a.snare || 0;
    if (k > 0.15 && k > (state.kPrev || 0) + 0.12) { state.kickT = t; state.kickN = (state.kickN || 0) + 1; }
    if (s > 0.15 && s > (state.sPrev || 0) + 0.12) { state.snareT = t; state.snareN = (state.snareN || 0) + 1; }
    state.kPrev = k; state.sPrev = s;
    return dt;
  }
  // Opens the almond as a clip and paints the sclera. Returns the upper lid's
  // control offset, which closeEye needs. b: 0 open .. 1 shut.
  function openEye(c, x, y, r, b, top, edge) {
    var cu = r * (-1.22 + 2.02 * b);
    c.save();
    c.beginPath(); c.moveTo(x - r, y);
    c.quadraticCurveTo(x, y + cu, x + r, y);
    c.quadraticCurveTo(x, y + r * 0.85, x - r, y);
    c.closePath(); c.clip();
    var g = c.createRadialGradient(x, y - r * 0.08, r * 0.15, x, y, r * 1.02);
    g.addColorStop(0, top); g.addColorStop(1, edge);
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    return cu;
  }
  // The lid's soft shadow on the eye, then the lid lines and crease. The
  // shadow is a blurred canvas shadow of a lid line drawn far off-canvas, so
  // only its soft shadow lands (stacked strokes showed hard bands at full
  // screen); shadowBlur is in device pixels, hence the transform scale.
  function closeEye(c, x, y, r, cu, ink) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    var m = c.getTransform(), sc = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
    var D = 4000 / sc;
    c.shadowColor = 'rgba(50,24,12,0.5)';
    c.shadowBlur = r * 0.2 * sc;
    c.shadowOffsetX = 0; c.shadowOffsetY = (D + r * 0.05) * sc;
    c.strokeStyle = '#000'; c.lineWidth = r * 0.12;
    c.beginPath(); c.moveTo(x - r * 1.1, y - D); c.quadraticCurveTo(x, y + cu - D, x + r * 1.1, y - D); c.stroke();
    c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.restore();
    c.strokeStyle = ink;
    c.lineWidth = Math.max(1, r * 0.05);
    c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x, y + cu, x + r, y); c.stroke();
    c.globalAlpha = 0.6; c.lineWidth = Math.max(0.6, r * 0.022);
    c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x, y + r * 0.85, x + r, y); c.stroke();
    c.globalAlpha = 0.3; c.lineWidth = Math.max(0.5, r * 0.02);
    c.beginPath(); c.moveTo(x - r * 0.74, y - r * 0.36);
    c.quadraticCurveTo(x + r * 0.04, y + Math.min(cu, -r * 0.6) - r * 0.5, x + r * 0.8, y - r * 0.33); c.stroke();
    c.globalAlpha = 1;
  }
  function catchlight(c, ix, iy, ri, alpha) {
    c.fillStyle = 'rgba(255,251,242,' + (0.88 * alpha) + ')';
    c.beginPath(); c.ellipse(ix - ri * 0.36, iy - ri * 0.4, ri * 0.14, ri * 0.1, -0.6, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,251,242,' + (0.3 * alpha) + ')';
    c.beginPath(); c.arc(ix + ri * 0.3, iy + ri * 0.34, ri * 0.045, 0, TAU); c.fill();
  }
  // ---- end quiet eye ----

  var INKS = ['#23395b', '#b5443a', '#d9a13b', '#efe4cc', '#1c1b22', '#7d9a7e', '#efe4cc', '#8a3b52'];
  var MAXSEG = 0.03, MINSEG = 0.004, MAXPTS = 700;

  function circle(cx, cy, a, n) {
    var pts = [];
    for (var i = 0; i < n; i++) { var th = i * TAU / n; pts.push(cx + Math.cos(th) * a, cy + Math.sin(th) * a); }
    return pts;
  }
  function dropInk(state, cx, cy, a, col) {
    var rings = state.rings, a2 = a * a;
    for (var k = 0; k < rings.length; k++) {
      var P = rings[k].p;
      for (var i = 0; i < P.length; i += 2) {
        var dx = P[i] - cx, dy = P[i + 1] - cy, l2 = dx * dx + dy * dy;
        var s = Math.sqrt(1 + a2 / Math.max(l2, 1e-9));
        P[i] = cx + dx * s; P[i + 1] = cy + dy * s;
      }
    }
    rings.push({ p: circle(cx, cy, a, Math.max(24, Math.round(a * 260))), c: col });
  }
  // A comb stroke along the line through (px, py) in direction (ux, uy).
  function tine(state, px, py, ux, uy, z, lam) {
    var rings = state.rings;
    for (var k = 0; k < rings.length; k++) {
      var P = rings[k].p;
      for (var i = 0; i < P.length; i += 2) {
        var d = Math.abs((P[i] - px) * uy - (P[i + 1] - py) * ux);
        var f = z * Math.exp(-d / lam);
        P[i] += ux * f; P[i + 1] += uy * f;
      }
    }
  }
  // Differential rotation about the pupil: fast near it, slow at the rim.
  function swirl(state, w) {
    var rings = state.rings;
    for (var k = 0; k < rings.length; k++) {
      var P = rings[k].p;
      for (var i = 0; i < P.length; i += 2) {
        var x = P[i], y = P[i + 1], r2 = x * x + y * y;
        var th = w / (0.25 + r2 * 1.6);
        var c = Math.cos(th), s = Math.sin(th);
        P[i] = x * c - y * s; P[i + 1] = x * s + y * c;
      }
    }
  }
  // Keep outlines smooth as they stretch, and drop rings that have left.
  function tidy(state) {
    var rings = state.rings, keep = [];
    for (var k = 0; k < rings.length; k++) {
      var P = rings[k].p, out = [], n = P.length / 2, inside = false;
      for (var i = 0; i < n; i++) {
        var x0 = P[2 * i], y0 = P[2 * i + 1];
        var j = (i + 1) % n, x1 = P[2 * j], y1 = P[2 * j + 1];
        if (x0 * x0 + y0 * y0 < 1.1) inside = true;
        var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy);
        if (L < MINSEG && out.length > 6 && i < n - 1) continue;
        out.push(x0, y0);
        if (L > MAXSEG && out.length < MAXPTS * 2) {
          var m = Math.min(4, Math.ceil(L / MAXSEG));
          for (var q = 1; q < m; q++) out.push(x0 + dx * q / m, y0 + dy * q / m);
        }
      }
      if (inside || k === rings.length - 1) { rings[k].p = out; keep.push(rings[k]); }
      else if (!keep.length) state.ground = rings[k].c;   // it now floods the bath
    }
    // Too many rings: shed spatters first (small, and losing one changes
    // nothing much), and only then let the outermost ring become the ground.
    // Shedding outer rings early made the whole iris change colour on hats.
    if (keep.length > 90) {
      keep = keep.filter(function (rg, i) { return i === 0 || rg.p.length > 60 || i > keep.length - 30; });
    }
    while (keep.length > 90) state.ground = keep.shift().c;
    state.rings = keep;
  }
  function nextInk(state) {
    state.ink = (state.ink + 1 + (Math.random() < 0.3 ? 1 : 0)) % INKS.length;
    return INKS[state.ink];
  }
  function init(state) {
    state.rings = []; state.ground = '#efe4cc'; state.ink = 0;
    for (var i = 0; i < 9; i++) dropInk(state, 0, 0, 0.2 + Math.random() * 0.08, nextInk(state));
    for (i = 0; i < 4; i++) {
      var a = Math.random() * TAU, rr = 0.4 + Math.random() * 0.4;
      dropInk(state, Math.cos(a) * rr, Math.sin(a) * rr, 0.06 + Math.random() * 0.06, nextInk(state));
    }
    tidy(state);
    tine(state, 0, -0.3, 1, 0, 0.18, 0.12); tidy(state);
    tine(state, 0, 0.35, -1, 0, 0.18, 0.12); tidy(state);
    swirl(state, 0.6); tidy(state);
    state.kn = state.kickN || 0; state.sn = state.snareN || 0;
    state.lastDrop = 0; state.lastLook = null;
  }

  VIZ_EYES.register({
    id: 'marbled',
    name: 'Marbled',
    idea: 'The iris is a marbling bath: the pupil breathes out rings of ink that push the old ones outward, and every glance drags a comb through them.',
    draw: function (p, x, y, r, t, a, state, look) {
      var c = p.drawingContext;
      p.push(); c.save();
      var dt = follow(state, t, a);
      if (!state.rings) init(state);
      var bl = VIZ_EYES.blink(state, t);
      var drop = state.drop, bd = a.bands || [];
      var bass = clamp(((bd[1] || 0) + (bd[2] || 0)) / 160);
      var lx = look ? look.x : 0, ly = look ? look.y : 0;
      var ix = x + lx * r * 0.3, iy = y + ly * r * 0.16;
      var ri = r * 0.48;
      var rp = 0.26 + 0.04 * bass;

      var changed = false;
      // kick: the pupil breathes out a ring of ink (and in a quiet spell it
      // still does, slowly, so the bath never stands still)
      if ((state.kickN || 0) !== state.kn || t - state.lastDrop > 2.2) {
        var kicked = (state.kickN || 0) !== state.kn;
        state.kn = state.kickN || 0;
        dropInk(state, 0, 0, kicked ? 0.14 + 0.04 * drop : 0.12, nextInk(state));
        state.lastDrop = t; changed = true;
      }
      // snare: a comb across the bath, alternating direction
      if ((state.snareN || 0) !== state.sn) {
        state.sn = state.snareN || 0;
        var ang = Math.random() * TAU, off = (Math.random() - 0.5) * 0.9;
        var ux = Math.cos(ang), uy = Math.sin(ang);
        tine(state, -uy * off, ux * off, ux, uy, 0.16, 0.1);
        changed = true;
      }
      // hats: a spatter of tiny drops
      var hat = a.hat || 0;
      if (hat > 0.35 && Math.random() < hat * 0.12) {
        var sa = Math.random() * TAU, sr = 0.4 + Math.random() * 0.55;
        dropInk(state, Math.cos(sa) * sr, Math.sin(sa) * sr, 0.015 + Math.random() * 0.025, Math.random() < 0.5 ? '#1c1b22' : '#b5443a');
        changed = true;
      }
      // the gaze drags a comb through the ink as the eye moves
      if (state.lastLook) {
        var gx = lx - state.lastLook.x, gy = ly - state.lastLook.y, gl = Math.sqrt(gx * gx + gy * gy);
        if (gl > 0.004) {
          tine(state, 0, 0, gx / gl, gy / gl, -Math.min(0.08, gl * 0.35), 0.25);
          changed = true;
        }
      }
      state.lastLook = { x: lx, y: ly };
      // bass stirs
      swirl(state, dt * (0.08 + 0.5 * drop + 0.3 * bass));
      if (changed || (Math.floor(t * 4) !== state.tq)) { tidy(state); state.tq = Math.floor(t * 4); }

      var cu = openEye(c, x, y, r, bl, '#f4efe6', '#d4cabb');
      c.save();
      c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.clip();
      c.fillStyle = state.ground; c.fillRect(ix - ri, iy - ri, 2 * ri, 2 * ri);
      var rings = state.rings;
      for (var k = 0; k < rings.length; k++) {
        var P = rings[k].p;
        c.beginPath();
        c.moveTo(ix + P[0] * ri, iy + P[1] * ri);
        for (var i = 2; i < P.length; i += 2) c.lineTo(ix + P[i] * ri, iy + P[i + 1] * ri);
        c.closePath();
        c.fillStyle = rings[k].c; c.fill();
      }
      // a faint paper grain of light across the bath, and the limbus
      var sh = c.createRadialGradient(ix - ri * 0.3, iy - ri * 0.35, ri * 0.1, ix, iy, ri);
      sh.addColorStop(0, 'rgba(255,250,240,0.12)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,14,10,0.35)');
      c.fillStyle = sh; c.fillRect(ix - ri, iy - ri, 2 * ri, 2 * ri);
      c.restore();
      c.strokeStyle = 'rgba(30,22,20,0.55)'; c.lineWidth = Math.max(0.6, ri * 0.03);
      c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.stroke();
      // the pupil: an ink well
      c.fillStyle = '#121016';
      c.beginPath(); c.arc(ix, iy, ri * rp, 0, TAU); c.fill();
      catchlight(c, ix, iy, ri, 1);
      closeEye(c, x, y, r, cu, '#2c2226');
      c.restore(); p.pop();
    }
  });
})();
