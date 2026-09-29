// Eddy: the pupil is a plughole. The iris is a cup of coffee just stirred,
// and ribbons of milk spiral in toward the middle and pour away down the
// pupil, carrying little bubbles of foam with them.
//
// Music: bass and the drop spin the eddy faster, wind its arms tighter and
// open the drain wider; each kick sends a bright gulp of milk spiralling in
// along the arms and down; the snare drops a sugar cube in at the rim that
// circles and sinks; hats glint on the surface.
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

  var ARMS = 3, STRANDS = 4;

  VIZ_EYES.register({
    id: 'eddy',
    name: 'Eddy',
    idea: 'The pupil is a plughole and the iris a just-stirred cup of coffee, whose milk spirals in and drains away down the pupil.',
    draw: function (p, x, y, r, t, a, state, look) {
      var c = p.drawingContext;
      p.push(); c.save();
      var dt = follow(state, t, a);
      var bl = VIZ_EYES.blink(state, t);
      var drop = state.drop, bd = a.bands || [];
      var bass = clamp(((bd[1] || 0) + (bd[2] || 0)) / 160);
      var hat = a.hat || 0;
      var lx = look ? look.x : 0, ly = look ? look.y : 0;
      var ix = x + lx * r * 0.3, iy = y + ly * r * 0.16;
      var ri = r * 0.48;
      var m = c.getTransform(), sc = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
      var fine = ri * sc > 26;

      // the eddy's state: its turn, how tightly wound, how wide the drain
      if (state.rot == null) {
        state.rot = Math.random() * TAU; state.k = 1.6; state.rp = 0.28;
        state.foam = []; state.cubes = []; state.sn = state.snareN || 0;
        for (var i = 0; i < 26; i++) state.foam.push({ s: Math.random(), th: Math.random() * TAU, z: 0.5 + Math.random() });
      }
      var spin = 0.5 + 1.4 * drop + 0.6 * bass;
      state.rot += dt * spin;
      state.k += (1.4 + 1.1 * drop + 0.4 * bass - state.k) * (1 - Math.exp(-dt / 1.5));
      var kS = state.kickT == null ? 99 : t - state.kickT;
      var gulp = kS < 0.12 ? 1 : Math.exp(-(kS - 0.12) / 0.2);
      state.rp += (0.24 + 0.06 * bass + 0.05 * drop + 0.03 * gulp - state.rp) * (1 - Math.exp(-dt / 0.15));
      var rp = state.rp, K = state.k, rot = state.rot;
      // a point on the streamline through angle th0 at radius rho
      function ang(th0, rho) { return th0 + rot - K * Math.log(rho); }

      if ((state.snareN || 0) !== state.sn) {
        state.sn = state.snareN || 0;
        state.cubes.push({ s: 0, th: Math.random() * TAU, t: t });
        if (state.cubes.length > 3) state.cubes.shift();
      }

      var cu = openEye(c, x, y, r, bl, '#f5efe5', '#d6cab8');

      // the coffee
      var g = c.createRadialGradient(ix, iy, ri * rp, ix, iy, ri);
      g.addColorStop(0, '#2e180c'); g.addColorStop(0.5, '#56311c'); g.addColorStop(0.84, '#80502e'); g.addColorStop(0.93, '#b07a4c'); g.addColorStop(1, '#5a3520');
      c.fillStyle = g; c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.fill();

      c.save();
      c.beginPath(); c.arc(ix, iy, ri * 0.99, 0, TAU); c.clip();
      c.translate(ix, iy);
      // milk: each arm is a few thin strands, so it feathers like latte art;
      // the kick's gulp is a bright stretch travelling in along them
      var gulpR = 1 - Math.min(1, kS / 0.7) * (1 - rp);
      var N = fine ? 44 : 18;
      // milk has soft edges; crisp ones made it a hypnotist's spiral
      if (fine) c.filter = 'blur(' + (ri * sc * 0.01).toFixed(1) + 'px)';
      for (var arm = 0; arm < ARMS; arm++) {
        for (var st = 0; st < (fine ? STRANDS : 2); st++) {
          var th0 = arm * TAU / ARMS + st * 0.16 + 0.05 * Math.sin(arm * 3 + st * 5);
          var wb = st === 0 ? 0.13 : 0.075 - st * 0.01;
          var left = [], right = [];
          for (var j = 0; j <= N; j++) {
            var rho = 1.02 - (1.02 - rp) * j / N;
            var th = ang(th0, rho);
            // widths breathe along the strand so it never looks like a stencil
            var w = wb * Math.pow(rho, 0.8) * Math.max(0.08, 0.65 + 0.55 * Math.sin(rho * 13 + arm * 2 + st * 2.7 + t * 0.9) * Math.sin(rho * 5 - st + t * 0.4));
            var dth = w / rho;
            left.push([Math.cos(th - dth) * rho * ri, Math.sin(th - dth) * rho * ri]);
            right.push([Math.cos(th + dth) * rho * ri, Math.sin(th + dth) * rho * ri]);
          }
          c.beginPath();
          c.moveTo(left[0][0], left[0][1]);
          for (j = 1; j <= N; j++) c.lineTo(left[j][0], left[j][1]);
          for (j = N; j >= 0; j--) c.lineTo(right[j][0], right[j][1]);
          c.closePath();
          c.fillStyle = st === 0 ? 'rgba(246,230,202,0.92)' : 'rgba(232,206,168,' + (0.75 - st * 0.1) + ')';
          c.fill();
        }
      }
      c.filter = 'none';
      // the gulp: the arms lit brighter in a band that runs in to the drain
      if (kS < 0.8) {
        c.save();
        var gw = ri * 0.12;
        c.beginPath(); c.arc(0, 0, gulpR * ri + gw, 0, TAU); c.arc(0, 0, Math.max(0, gulpR * ri - gw), 0, TAU, true); c.clip();
        c.strokeStyle = 'rgba(255,250,236,' + (0.9 * Math.min(1, gulp * 1.2)) + ')';
        c.lineWidth = ri * 0.07; c.lineCap = 'round';
        if (fine) c.filter = 'blur(' + (ri * sc * 0.012).toFixed(1) + 'px)';
        for (arm = 0; arm < ARMS; arm++) {
          c.beginPath();
          for (j = 0; j <= 24; j++) {
            rho = Math.min(1, gulpR + 0.14) - 0.28 * j / 24;
            if (rho < rp) break;
            th = ang(arm * TAU / ARMS, rho);
            c.lineTo(Math.cos(th) * rho * ri, Math.sin(th) * rho * ri);
          }
          c.stroke();
        }
        c.filter = 'none';
        c.restore();
      }
      // foam bubbles riding the streamlines in; faster near the drain
      if (fine) {
        for (i = 0; i < state.foam.length; i++) {
          var f = state.foam[i];
          rho = 1 - f.s * (1 - rp);
          f.s += dt * (0.05 + 0.12 * drop) * (0.4 / rho);
          if (f.s >= 1) { f.s = 0; f.th = Math.random() * TAU; }
          th = ang(f.th, rho);
          var br = ri * 0.012 * f.z * Math.pow(rho, 0.5);
          c.fillStyle = 'rgba(252,244,228,0.8)';
          c.beginPath(); c.arc(Math.cos(th) * rho * ri, Math.sin(th) * rho * ri, br, 0, TAU); c.fill();
        }
      }
      // sugar cubes from the snare: tumble round and sink
      for (i = 0; i < state.cubes.length; i++) {
        var cb = state.cubes[i];
        cb.s += dt * 0.35 * (0.5 / (1 - cb.s * (1 - rp)));
        if (cb.s >= 1) continue;
        rho = 1 - cb.s * (1 - rp) * 0.98;
        th = ang(cb.th, rho);
        var cs = ri * 0.07 * Math.pow(rho, 0.6);
        c.save();
        c.translate(Math.cos(th) * rho * ri, Math.sin(th) * rho * ri); c.rotate(th * 2);
        c.fillStyle = 'rgba(255,253,246,0.95)'; c.fillRect(-cs / 2, -cs / 2, cs, cs);
        c.fillStyle = 'rgba(200,180,150,0.5)'; c.fillRect(-cs / 2, cs * 0.2, cs, cs * 0.3);
        c.restore();
      }
      c.restore();

      // the drain: a dark throat with the arms twisting down into it
      var dr = ri * rp;
      var dg = c.createRadialGradient(ix, iy, 0, ix, iy, dr);
      dg.addColorStop(0, '#040100'); dg.addColorStop(0.75, '#100603'); dg.addColorStop(1, 'rgba(40,20,10,0.9)');
      c.fillStyle = dg; c.beginPath(); c.arc(ix, iy, dr, 0, TAU); c.fill();
      // hats: glints on the surface
      if (hat > 0.1) {
        c.fillStyle = 'rgba(255,252,240,' + Math.min(1, hat * 1.3) + ')';
        for (i = 0; i < 5; i++) {
          var ga = i * 2.4 + Math.floor(t * 8) * 1.3, gr = ri * (0.45 + 0.4 * ((i * 0.37 + Math.floor(t * 8) * 0.21) % 1));
          var gs = ri * 0.02 * hat;
          var gx = ix + Math.cos(ga) * gr, gy = iy + Math.sin(ga) * gr;
          c.beginPath(); c.ellipse(gx, gy, gs * 1.6, gs * 0.7, ga, 0, TAU); c.fill();
        }
      }
      catchlight(c, ix, iy, ri, 1);
      closeEye(c, x, y, r, cu, '#33221a');
      c.restore(); p.pop();
    }
  });
})();
