// Sorted: the iris is a pixel-sorted glitch. It is rendered as a small pixel
// image, and rows of it are sorted by brightness and stretched sideways, so
// bright streaks run out of the iris across the white of the eye, trailing
// away from where it is looking, then draw back in. (Downward drips were the
// first try: the lower lid hides almost all the white below the iris.)
//
// Music: each kick flings the streaks further, then they ease back in;
// bass and the drop sort more columns and brighten the iris (brighter pixels
// cross the sort threshold, so the glitch spreads); the snare slips a slice
// of rows sideways, a datamosh tear; hats set single pixels flashing.
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

  // Three inks, no rainbow: ultramarine, coral, butter.
  var P0 = [28, 36, 128], P1 = [236, 104, 86], P2 = [255, 226, 150];
  function ramp(v, out) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    var a, b, u;
    if (v < 0.55) { a = P0; b = P1; u = v / 0.55; } else { a = P1; b = P2; u = (v - 0.55) / 0.45; }
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
  }
  function h1(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function vn(x) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return h1(i) * (1 - f) + h1(i + 1) * f; }

  var col = [0, 0, 0];
  var SIDE = 1.1;   // the buffer reaches this many iris diameters either side

  VIZ_EYES.register({
    id: 'pixelsort',
    name: 'Sorted',
    idea: 'The iris is pixel-sorted: bright rows of it streak sideways out across the white of the eye, trailing behind its gaze like a smeared screen.',
    draw: function (p, x, y, r, t, a, state, look) {
      var c = p.drawingContext;
      p.push(); c.save();
      var dt = follow(state, t, a);
      var bl = VIZ_EYES.blink(state, t);
      var drop = state.drop, bd = a.bands || [];
      var bass = clamp(((bd[1] || 0) + (bd[2] || 0)) / 160);
      var lx = look ? look.x : 0, ly = look ? look.y : 0;
      var ix = x + lx * r * 0.3, iy = y + ly * r * 0.16;
      var ri = r * 0.48;

      var m = c.getTransform(), sc = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
      var n = Math.max(10, Math.min(76, Math.round(2 * ri * sc)));
      var off = Math.round(n * SIDE), bw = n + 2 * off;
      if (!state.cv || state.cv.height !== n) {
        state.cv = document.createElement('canvas');
        state.cv.width = bw; state.cv.height = n;
        state.cx = state.cv.getContext('2d');
        state.img = state.cx.createImageData(bw, n);
        state.lum = new Float32Array(bw);
        state.tmp = new Uint32Array(bw);
        state.idx = [];
      }
      // streak length: a kick flings them out, then they ease back in
      if (state.fall == null) { state.fall = 0; state.side = 1; }
      var kS = state.kickT == null ? 99 : t - state.kickT;
      var kp = kS < 0.04 ? kS / 0.04 : Math.exp(-(kS - 0.04) / 0.3);
      var target = 0.08 + 0.22 * state.drop + 0.6 * kp;
      state.fall += (target - state.fall) * (1 - Math.exp(-dt / (target > state.fall ? 0.04 : 0.45)));
      // Streaks trail away from the gaze, toward the side with more white.
      state.side += ((lx > 0 ? -1 : 1) * Math.min(1, Math.abs(lx) * 3 + 0.3) - state.side) * (1 - Math.exp(-dt / 0.3));

      var data = new Uint32Array(state.img.data.buffer);
      data.fill(0);
      var lum = state.lum, tmp = state.tmp;
      var half = n / 2, prp = 0.3 + 0.07 * bass;
      var bright = 0.08 * bass + 0.05 * drop;
      var rot = t * 0.15;
      // 1. the iris as pixels
      for (var py = 0; py < n; py++) {
        for (var px = 0; px < n; px++) {
          var dx = (px + 0.5 - half) / half, dy = (py + 0.5 - half) / half;
          var rho = Math.sqrt(dx * dx + dy * dy);
          if (rho > 1) continue;
          var R, G, B;
          if (rho < prp) { R = 8; G = 6; B = 14; }
          else {
            var th = Math.atan2(dy, dx);
            var fib = 0.5 + 0.5 * Math.sin(th * 19 + 2.2 * Math.sin(th * 5 + rot) + rho * 6);
            var fib2 = 0.5 + 0.5 * Math.sin(th * 41 - rot * 2 + rho * 3);
            var v = Math.pow(1 - (rho - prp) / (1 - prp), 1.4) * 0.8 + fib * 0.28 + fib2 * 0.1 - 0.22 + bright;
            if (rho > 0.88) v *= 0.4;
            ramp(v, col); R = col[0]; G = col[1]; B = col[2];
          }
          data[py * bw + off + px] = (255 << 24) | (B << 16) | (G << 8) | R;
        }
      }
      // 2. sort chosen rows by brightness, bright end at the iris, and stretch
      // each sorted run outward across the white
      var amount = 0.28 + 0.4 * drop + 0.15 * bass;
      for (py = 0; py < n; py++) {
        var cy0 = (py + 0.5 - half) / half;
        if (Math.abs(cy0) >= 0.97) continue;
        var sel = vn(py * 0.41 + t * 0.35) * 0.6 + h1(py * 3.1 + Math.floor(t * 0.7)) * 0.4;
        if (sel > amount) continue;
        // which way this row runs: mostly the trailing side, a few the other
        var dir = (h1(py * 9.7 + Math.floor(t * 0.3)) < 0.5 + 0.45 * Math.abs(state.side)) ? (state.side < 0 ? -1 : 1) : (state.side < 0 ? 1 : -1);
        var cw = Math.sqrt(1 - cy0 * cy0) * half;
        var x0 = Math.max(0, Math.floor(half - cw)), x1 = Math.min(n - 1, Math.floor(half + cw - 0.001));
        // the run starts at the first bright-enough pixel, walking from the
        // pupil outward, and never inside the pupil
        var pw = Math.abs(cy0) < prp ? Math.sqrt(prp * prp - cy0 * cy0) * half + 1 : 0;
        var start = -1, px2;
        for (var k = 0; k <= half; k++) {
          px2 = Math.floor(half) + dir * k;
          if (px2 < x0 || px2 > x1) break;
          if (k < pw) continue;
          var pv = data[py * bw + off + px2];
          var L = ((pv & 255) * 0.3 + ((pv >> 8) & 255) * 0.55 + ((pv >> 16) & 255) * 0.15) / 255;
          if (L > 0.4 - 0.1 * drop) { start = px2; break; }
        }
        if (start < 0) continue;
        var len = (dir > 0 ? x1 - start : start - x0) + 1;
        var idx = state.idx; idx.length = len;
        for (var i = 0; i < len; i++) {
          var q = data[py * bw + off + start + dir * i];
          tmp[i] = q;
          lum[i] = (q & 255) * 0.3 + ((q >> 8) & 255) * 0.55 + ((q >> 16) & 255) * 0.15;
          idx[i] = i;
        }
        idx.sort(function (u, w) { return lum[w] - lum[u]; });
        var drip = Math.round(off * state.fall * (0.1 + 0.9 * Math.pow(vn(py * 0.53 + 40 + t * 0.3), 1.6)));
        var room = dir > 0 ? bw - (off + start) : off + start + 1;
        var outLen = Math.min(room, len + drip);
        for (i = 0; i < outLen; i++) {
          var srcI = idx[Math.min(len - 1, Math.floor(i * len / outLen))];
          data[py * bw + off + start + dir * i] = tmp[srcI];
        }
      }
      // 3. snare: a slice of rows slips sideways for a moment
      var sS = state.snareT == null ? 99 : t - state.snareT;
      if (sS < 0.18) {
        var seed = state.snareN || 0;
        var y0 = Math.floor(n * (0.15 + 0.6 * h1(seed * 7.7))), hgt = Math.max(1, Math.floor(n * 0.12));
        var sh = Math.round(n * 0.12 * (h1(seed * 3.3) < 0.5 ? -1 : 1) * (1 - sS / 0.18));
        for (py = y0; py < Math.min(n, y0 + hgt); py++) {
          var row = data.slice(py * bw, py * bw + bw);
          for (px = 0; px < bw; px++) data[py * bw + px] = row[((px - sh) % bw + bw) % bw];
        }
      }
      // 4. hats: single pixels flash
      var hat = a.hat || 0;
      var sparks = Math.floor(hat * n * 0.12);
      for (i = 0; i < sparks; i++) {
        var sx = Math.floor(Math.random() * n), sy = Math.floor(Math.random() * n);
        if (data[sy * bw + off + sx] >>> 24) data[sy * bw + off + sx] = 0xfff4fbff;
      }
      // 5. a pixel catchlight, placed after the sort so it stays put
      var cl = Math.max(1, Math.round(n * 0.07));
      var clx = Math.round(half - n * 0.2), cly = Math.round(half - n * 0.22);
      for (py = cly; py < cly + cl; py++) for (px = clx; px < clx + cl + (cl > 1 ? 1 : 0); px++) data[py * bw + off + px] = 0xfff6fbff;
      state.cx.putImageData(state.img, 0, 0);

      var cu = openEye(c, x, y, r, bl, '#f3eee6', '#d0c8bc');
      c.imageSmoothingEnabled = false;
      c.drawImage(state.cv, ix - ri - 2 * ri * off / n, iy - ri, 2 * ri * bw / n, 2 * ri);
      c.imageSmoothingEnabled = true;
      closeEye(c, x, y, r, cu, '#262230');
      c.restore(); p.pop();
    }
  });
})();
