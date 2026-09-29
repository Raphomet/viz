// Cryptex: the iris is a combination lock of type. Rings of letters turn like
// tumblers, and every so often they click into line so that a word reads down
// from the top of the iris, in red, before the rings scatter it again.
//
// Music: each kick ratchets one ring a notch (round robin), alternating
// directions, so the beat is a visible tick; the snare spins every ring and,
// when the last word has had its moment, lands a new one; bass and the drop
// speed the tumblers' drift; hats flip single letters like a split-flap board.
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

  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // Four letters, one per ring, read outer to inner. Warm words only.
  var WORDS = ['GLOW', 'OPEN', 'WARM', 'SWAY', 'HALO', 'DAWN', 'KIND', 'SING',
    'HUSH', 'LOVE', 'WAVE', 'DEAR', 'BLUE', 'MOON', 'SOFT', 'HERE', 'LUSH'];
  var K = 4;
  var HOLD = 2.4;        // how long a word stays lit

  function init(state, r) {
    state.rings = [];
    for (var k = 0; k < K; k++) {
      state.rings.push({ pos: Math.random() * 20, to: null, letters: [], flip: [], dir: k % 2 ? -1 : 1 });
    }
    state.word = -1; state.wordT = -99; state.wordIdx = 0;
    state.kn = state.kickN || 0; state.sn = state.snareN || 0;
  }
  function letterAt(ring, j) {
    if (ring.letters[j] == null) ring.letters[j] = ALPHA[(j * 7 + ring.seed) % 26];
    return ring.letters[j];
  }

  VIZ_EYES.register({
    id: 'cryptex',
    name: 'Cryptex',
    idea: 'The iris is rings of type turning like the tumblers of a lock, which click into line so that a word reads down the iris.',
    draw: function (p, x, y, r, t, a, state, look) {
      var c = p.drawingContext;
      p.push(); c.save();
      var dt = follow(state, t, a);
      if (!state.rings) init(state, r);
      var bl = VIZ_EYES.blink(state, t);
      var drop = state.drop, bd = a.bands || [];
      var bass = clamp(((bd[1] || 0) + (bd[2] || 0)) / 160);

      var lx = look ? look.x : 0, ly = look ? look.y : 0;
      var ix = x + lx * r * 0.3, iy = y + ly * r * 0.16;
      var ri = r * 0.48;
      var rp = ri * (0.27 + 0.05 * bass);
      var rin = ri * 0.38, rout = ri * 0.97;
      var wk = (rout - rin) / K;
      var fs = wk * 0.8;

      // slots per ring, fixed per ring so letters keep their places
      var rings = state.rings, k, ring;
      for (k = 0; k < K; k++) {
        ring = rings[k];
        var rm = rin + wk * (k + 0.5);
        ring.n = Math.max(12, Math.round(TAU * rm / (fs * 0.74)));
        if (ring.seed == null) ring.seed = Math.floor(Math.random() * 26);
      }
      var holding = t - state.wordT < HOLD;

      // Kick: one tumbler clicks one notch.
      if ((state.kickN || 0) !== state.kn) {
        state.kn = state.kickN || 0;
        if (!holding) {
          ring = rings[state.kn % K];
          ring.to = (ring.to == null ? ring.pos : ring.to) + ring.dir;
        }
      }
      // Snare (or a quiet spell): spin, and land a word if the last one has
      // been read. In a breakdown with no snares the timer keeps it alive.
      var wantWord = t - state.wordT > HOLD + 1.6;
      var sn = (state.snareN || 0) !== state.sn;
      if (sn) state.sn = state.snareN || 0;
      if ((sn && !holding) || (wantWord && t - state.wordT > 6)) {
        var land = wantWord;
        var w = WORDS[state.wordIdx++ % WORDS.length];
        if (state.wordIdx === 1) state.wordIdx = Math.floor(Math.random() * WORDS.length) + 1;
        for (k = 0; k < K; k++) {
          ring = rings[k];
          var base = ring.to == null ? ring.pos : ring.to;
          ring.to = base + ring.dir * (3 + ((k * 5 + state.sn) % 4));
          if (land) {
            // Land exactly on 12 o'clock: slot j sits at angle (pos + j) * step,
            // so pick the slot nearest the top and aim the ring at it.
            var j = ((Math.round(-ring.to - ring.n / 4) % ring.n) + ring.n) % ring.n;
            ring.to = -ring.n / 4 - j + ring.n * Math.round((ring.to + ring.n / 4 + j) / ring.n);
            ring.letters[j] = w[K - 1 - k];
            ring.hl = j;
          }
        }
        if (land) state.wordT = t + 0.3;
      }
      // Motion: eased steps toward the target notch; a slow drift otherwise.
      for (k = 0; k < K; k++) {
        ring = rings[k];
        if (ring.to != null) {
          ring.pos += (ring.to - ring.pos) * (1 - Math.exp(-dt / 0.06));
          if (Math.abs(ring.to - ring.pos) < 0.002) { ring.pos = ring.to; ring.to = null; }
        } else if (!(t - state.wordT < HOLD)) {
          ring.pos += ring.dir * dt * (0.12 + 0.3 * drop + 0.15 * bass) * (1 + k * 0.2);
        }
      }
      // Hats: letters flip, split-flap style.
      var hat = a.hat || 0;
      if (hat > 0.2 && Math.random() < hat * 0.9) {
        ring = rings[Math.floor(Math.random() * K)];
        var s = Math.floor(Math.random() * ring.n);
        if (s !== ring.hl) { ring.letters[s] = ALPHA[Math.floor(Math.random() * 26)]; ring.flip[s] = t; }
      }

      var cu = openEye(c, x, y, r, bl, '#f4eee2', '#d3c8b6');

      // iris ground: deep teal with brass ring rules
      var g = c.createRadialGradient(ix, iy, rp, ix, iy, ri);
      g.addColorStop(0, '#1d4a4c'); g.addColorStop(0.8, '#123538'); g.addColorStop(1, '#0a2023');
      c.fillStyle = g; c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.fill();

      var m = c.getTransform(), sc = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
      var tiny = fs * sc < 5;
      c.strokeStyle = 'rgba(214,176,106,0.55)';
      c.lineWidth = Math.max(0.5 / sc, ri * 0.008);
      for (k = 0; k <= K; k++) { c.beginPath(); c.arc(ix, iy, rin + wk * k, 0, TAU); c.stroke(); }

      var lit = clamp(1 - (t - state.wordT - HOLD + 0.6) / 0.6) * (t >= state.wordT ? 1 : 0);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 ' + fs.toFixed(2) + 'px "Space Mono", "Courier New", monospace';
      for (k = 0; k < K; k++) {
        ring = rings[k];
        var n = ring.n, step = TAU / n, rm2 = rin + wk * (k + 0.5);
        var phi = ring.pos * step;
        for (var j2 = 0; j2 < n; j2++) {
          var th = phi + j2 * step;
          var isHl = j2 === ring.hl && lit > 0;
          var ft = ring.flip[j2] != null ? (t - ring.flip[j2]) / 0.12 : 9;
          var sy = ft < 1 ? Math.abs(Math.cos(ft * Math.PI)) : 1;
          c.save();
          c.translate(ix + Math.cos(th) * rm2, iy + Math.sin(th) * rm2);
          c.rotate(th + Math.PI / 2);
          if (sy !== 1) c.scale(1, Math.max(0.05, sy));
          if (isHl) {
            c.fillStyle = 'rgba(232,82,58,' + (0.35 + 0.65 * lit) + ')';
            c.fillRect(-fs * 0.42, -wk * 0.5, fs * 0.84, wk);
            c.fillStyle = '#fff6e4';
          } else {
            c.fillStyle = k % 2 ? 'rgba(236,224,196,0.92)' : 'rgba(236,224,196,0.7)';
          }
          if (tiny) c.fillRect(-fs * 0.22, -fs * 0.3, fs * 0.44, fs * 0.6);
          else c.fillText(letterAt(ring, j2), 0, fs * 0.04);
          c.restore();
        }
      }
      // pupil, with a thin brass ring
      c.fillStyle = '#060909';
      c.beginPath(); c.arc(ix, iy, rp, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(214,176,106,0.8)'; c.lineWidth = Math.max(0.6 / sc, ri * 0.015);
      c.beginPath(); c.arc(ix, iy, rp * 1.08, 0, TAU); c.stroke();
      catchlight(c, ix, iy, ri, 1);
      closeEye(c, x, y, r, cu, '#2e2420');
      c.restore(); p.pop();
    }
  });
})();
