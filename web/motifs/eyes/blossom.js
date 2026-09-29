// Blossom: the iris is a flower head. At rest it is a tight bud of petals
// around a pollen-ringed heart; the music opens it, and on the drop the outer
// petals unfold past the limbus onto the white of the eye.
//
// Music: bass and the drop set how far it has opened; each kick sends a ripple
// of opening from the heart out to the outer whorl; the snare turns the whole
// head one phyllotactic notch; hats glint on the pollen.
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
    // A kick onset clock: t of the last rising edge.
    var k = a.kick || 0;
    if (k > 0.55 && !(state.kHeld)) { state.kickT = t; state.kickN = (state.kickN || 0) + 1; }
    state.kHeld = k > 0.4;
    var s = a.snare || 0;
    if (s > 0.55 && !(state.sHeld)) { state.snareT = t; state.snareN = (state.snareN || 0) + 1; }
    state.sHeld = s > 0.4;
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

  var GOLD = 2.399963;   // the golden angle, so the petals pack like a real head

  function mix(a, b, u) {
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * u) + ',' + Math.round(a[1] + (b[1] - a[1]) * u) +
      ',' + Math.round(a[2] + (b[2] - a[2]) * u) + ')';
  }
  // Inner petals are apricot, outer ones rose; each petal runs dark at its
  // base to pale at its tip.
  var IN_BASE = [150, 62, 40], IN_TIP = [253, 222, 160];
  var OUT_BASE = [120, 28, 48], OUT_TIP = [246, 170, 150];

  VIZ_EYES.register({
    id: 'blossom',
    name: 'Blossom',
    idea: 'The iris is a flower head that opens with the music, and on the drop its petals unfold past the iris onto the white of the eye.',
    draw: function (p, x, y, r, t, a, state, look) {
      var c = p.drawingContext;
      p.push(); c.save();
      var dt = follow(state, t, a);
      var bl = VIZ_EYES.blink(state, t);
      var drop = state.drop, bd = a.bands || [];
      var bass = clamp(((bd[1] || 0) + (bd[2] || 0)) / 160);

      // Opening: slow with the drop and bass, a travelling ripple on the kick.
      if (state.open == null) state.open = 0.1;
      state.open += (0.08 + 0.72 * drop + 0.12 * bass - state.open) * (1 - Math.exp(-dt / 0.7));
      // Snare: the head turns one notch, eased, so it reads as a gesture.
      if (state.rot == null) { state.rot = 0; state.rotTo = 0; state.sn = 0; }
      if ((state.snareN || 0) !== state.sn) { state.sn = state.snareN || 0; state.rotTo += GOLD / 3; }
      state.rot += (state.rotTo - state.rot) * (1 - Math.exp(-dt / 0.12)) + dt * 0.04;

      var lx = look ? look.x : 0, ly = look ? look.y : 0;
      var ix = x + lx * r * 0.3, iy = y + ly * r * 0.16;
      var ri = r * 0.48;
      var rp = ri * (0.3 + 0.06 * bass);

      var cu = openEye(c, x, y, r, bl, '#f6efe3', '#d8cab8');

      // iris ground: deep plum, seen between petals while it is still a bud
      var g = c.createRadialGradient(ix, iy, rp, ix, iy, ri);
      g.addColorStop(0, '#5a2037'); g.addColorStop(0.85, '#3a1222'); g.addColorStop(1, '#22090f');
      c.fillStyle = g; c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.fill();

      var N = r < 30 ? 13 : 34;
      var kSince = state.kickT == null ? 99 : t - state.kickT;
      var fine = r >= 30;
      c.lineJoin = 'round';
      // Outer petals first, so the inner whorls lie on top of them.
      for (var i = N - 1; i >= 0; i--) {
        var f = i / (N - 1);
        // the kick's ripple reaches the outer whorl ~0.15 s after the heart
        var u = kSince - f * 0.15;
        var ripple = u < 0 ? 0 : Math.exp(-u / 0.22) * Math.min(1, u * 30);
        var o = clamp(state.open + 0.22 * ripple * (0.4 + f));
        var th = i * GOLD + state.rot * (1.2 - 0.5 * f);
        var r0 = rp * (0.55 + 0.35 * f);
        var tip = rp + (ri * (0.66 + 0.78 * o) - rp) * (0.42 + 0.58 * f);
        var L = tip - r0;
        var w = L * (0.26 + 0.2 * o) * (0.8 + 0.3 * f);
        c.save();
        c.translate(ix, iy); c.rotate(th);
        c.beginPath();
        c.moveTo(r0, 0);
        c.bezierCurveTo(r0 + L * 0.3, -w * 1.1, tip - L * 0.12, -w * 0.9, tip, 0);
        c.bezierCurveTo(tip - L * 0.12, w * 0.9, r0 + L * 0.3, w * 1.1, r0, 0);
        var gr = c.createLinearGradient(r0, 0, tip, 0);
        gr.addColorStop(0, mix(IN_BASE, OUT_BASE, f));
        gr.addColorStop(0.55, mix(mix3(IN_BASE, IN_TIP, 0.6), mix3(OUT_BASE, OUT_TIP, 0.6), f));
        gr.addColorStop(1, mix(IN_TIP, OUT_TIP, f));
        c.fillStyle = gr; c.fill();
        if (fine) {
          c.strokeStyle = 'rgba(70,14,26,0.45)'; c.lineWidth = Math.max(0.5, r * 0.006); c.stroke();
          c.strokeStyle = 'rgba(90,20,30,0.22)';
          c.beginPath(); c.moveTo(r0 + L * 0.1, 0); c.lineTo(tip - L * 0.2, 0); c.stroke();
        }
        c.restore();
      }

      // the heart: a dark pupil ringed with pollen that glints on the hats
      c.fillStyle = '#170709';
      c.beginPath(); c.arc(ix, iy, rp, 0, TAU); c.fill();
      var M = r < 30 ? 8 : 18;
      var hat = a.hat || 0;
      for (var j = 0; j < M; j++) {
        var aj = j * TAU / M + state.rot * 0.5;
        var tw = 0.5 + 0.5 * Math.sin(t * 7 + j * 2.1);
        var lum = 0.55 + 0.45 * clamp(hat * 1.4 * tw + 0.15 * tw);
        c.fillStyle = 'rgba(' + Math.round(200 + 55 * lum) + ',' + Math.round(150 + 70 * lum) + ',' + Math.round(40 + 90 * lum * lum) + ',1)';
        c.beginPath();
        c.arc(ix + Math.cos(aj) * rp * 0.86, iy + Math.sin(aj) * rp * 0.86, rp * (0.1 + 0.05 * lum), 0, TAU);
        c.fill();
      }
      catchlight(c, ix, iy, ri, 1);
      closeEye(c, x, y, r, cu, '#3a2018');
      c.restore(); p.pop();
    }
  });
  function mix3(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
})();
