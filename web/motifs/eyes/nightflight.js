// Night Flight: the iris is a city at night seen from a plane. Avenues of
// sodium light run out from the pupil, which is a dark lake with the moon on
// it; ring roads, lit districts and traffic fill the rest, and wisps of cloud
// slide over it all as the city turns slowly beneath.
//
// Music: each kick sends a surge of power out through the grid, a ring of
// brightening that travels from the lake to the edge of town; bass and the
// drop switch more of the city's windows on (the breakdown is 3 a.m.); the
// snare sets off a firework over one district; hats glint on the traffic.
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

  var LAKE = 0.3;   // the pupil's resting radius, as a fraction of the iris
  var LAYERS = 4;   // districts wake in four groups as the music fills out

  function h2(x, y) { var v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); }
  function noise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // The city, in unit iris coordinates, built once per eye. Earlier tries
  // with a few hundred dots read as a spider's web, then as cracks; a city
  // from the air is thousands of fine lights on street grids, arterials
  // brighter, water and parks dark. So the fabric is dense and baked once into
  // offscreen layers, and the frame only composites them.
  function build() {
    var seed = Math.random() * 100;
    var riverA = Math.random() * TAU, riverPh = Math.random() * 10;
    function riverTh(rr) { return riverA + 0.35 * Math.sin(rr * 7 + riverPh) + 0.6 * (rr - LAKE); }
    function riverDist(px, py) {
      var rr = Math.sqrt(px * px + py * py);
      var d = Math.atan2(py, px) - riverTh(rr);
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * rr;
    }
    // arterials: wandering radial roads, lights every few metres
    var lanes = [], A = 11, i, j, rho, th;
    for (i = 0; i < A; i++) {
      var th0 = i * TAU / A + (Math.random() - 0.5) * 0.35, wob = Math.random() * 10, lane = [];
      for (rho = LAKE + 0.03; rho < 0.99; rho += 0.013) {
        th = th0 + 0.07 * Math.sin(rho * 6 + wob) + 0.03 * Math.sin(rho * 17 + wob);
        lane.push([Math.cos(th) * rho, Math.sin(th) * rho]);
      }
      lanes.push(lane);
    }
    // two ring roads, never quite round
    var rings = [];
    [0.52, 0.76].forEach(function (rr) {
      var ph = Math.random() * TAU, n = Math.round(TAU * rr / 0.013), ring = [];
      for (i = 0; i <= n; i++) {
        th = i * TAU / n;
        var r2 = rr + 0.03 * Math.sin(th * 3 + ph) + 0.012 * Math.sin(th * 7 + ph * 2);
        ring.push([Math.cos(th) * r2, Math.sin(th) * r2]);
      }
      rings.push(ring);
    });
    // district lights: sample, snap to a street grid whose heading drifts
    // across town, keep by density (dense downtown, parks and water empty)
    var pts = [];
    for (i = 0; i < 60000 && pts.length < 14000; i++) {
      rho = Math.sqrt(LAKE * LAKE + Math.random() * (1 - LAKE * LAKE));
      th = Math.random() * TAU;
      var px = Math.cos(th) * rho, py = Math.sin(th) * rho;
      var head = th + 0.8 * (noise(px * 3 + seed, py * 3) - 0.5);
      var ca = Math.cos(head), sa = Math.sin(head), G = 0.011;
      var u = Math.round((px * ca + py * sa) / G), v = (-px * sa + py * ca) / G;
      // lights sit on streets: snap one axis to the grid, keep the other free
      var onStreet = Math.random() < 0.5;
      var uu = onStreet ? u * G : (px * ca + py * sa), vv = onStreet ? v * G : Math.round(v) * G;
      px = uu * ca - vv * sa; py = uu * sa + vv * ca;
      rho = Math.sqrt(px * px + py * py);
      if (rho < LAKE + 0.04 || rho > 0.99) continue;
      if (riverDist(px, py) < 0.028) continue;
      var dens = Math.pow(1 - (rho - LAKE) / (1 - LAKE), 0.8);
      var park = noise(px * 9 + seed, py * 9 - seed);
      if (park < 0.28) continue;
      if (Math.random() > 0.2 + 0.8 * dens * (0.4 + 0.6 * park)) continue;
      var zn = noise(px * 4 - seed, py * 4 + seed);
      var layer = Math.min(LAYERS - 1, Math.floor(clamp(zn * 0.7 + (rho - LAKE) / (1 - LAKE) * 0.6) * LAYERS));
      var kind = Math.random() < 0.08 + 0.25 * dens * dens ? 1 : Math.random() < 0.06 ? 3 : 2;
      pts.push([px, py, layer, kind]);
    }
    var river = [];
    for (rho = LAKE * 0.8; rho <= 1.02; rho += 0.02) { th = riverTh(rho); river.push([Math.cos(th) * rho, Math.sin(th) * rho]); }
    var cars = [];
    for (i = 0; i < A; i++) for (j = 0; j < 3; j++) cars.push({ a: i, s: Math.random(), v: (0.04 + Math.random() * 0.05) * (j % 2 ? 1 : -1) });
    return { pts: pts, lanes: lanes, rings: rings, river: river, cars: cars, riverDist: riverDist,
      clouds: [Math.random(), Math.random(), Math.random()] };
  }
  var COL = ['255,172,76', '255,232,196', '255,184,98', '214,236,255'];

  // Bake the city into offscreen layers at the eye's device size: [0] the
  // arterials and ring roads, [1..LAYERS] the districts by wake-up group.
  function bake(city, D) {
    var out = [];
    function mk() { var cv = document.createElement('canvas'); cv.width = cv.height = D; var g = cv.getContext('2d'); g.translate(D / 2, D / 2); return { cv: cv, g: g }; }
    var R = D / 2, dot = Math.max(1, Math.round(D / 320)), L, i, j;
    // The fabric was tuned at a ~430 px iris. Smaller, the same lights crowd
    // into fewer pixels and add up to white, so dim them by the area ratio
    // (and the arterials by the length ratio) to keep the city's brightness.
    var kArea = Math.min(1, Math.pow(D / (430 * dot), 2)), kLen = Math.min(1, D / (430 * dot));
    L = mk();
    L.g.globalCompositeOperation = 'lighter';
    city.lanes.concat(city.rings).forEach(function (lane) {
      for (j = 0; j < lane.length; j++) {
        var q = lane[j];
        if (city.riverDist(q[0], q[1]) < 0.028 && j % 2) continue;
        L.g.fillStyle = 'rgba(255,170,70,' + (0.1 * kLen) + ')';
        L.g.fillRect(Math.round(q[0] * R) - dot * 2, Math.round(q[1] * R) - dot * 2, dot * 4, dot * 4);
        L.g.fillStyle = 'rgba(255,196,110,' + (0.9 * kLen) + ')';
        L.g.fillRect(Math.round(q[0] * R) - dot, Math.round(q[1] * R) - dot, dot * 2, dot * 2);
      }
    });
    out.push(L.cv);
    for (var l = 0; l < LAYERS; l++) {
      L = mk();
      for (i = 0; i < city.pts.length; i++) {
        var p2 = city.pts[i];
        if (p2[2] !== l) continue;
        // a canvas can't hold alphas much under 1/255, so thin out rather
        // than dim when small: draw a share pk of the lights at kArea / pk
        var pk = Math.min(1, kArea * 4);
        if (h2(i, 11) > pk) continue;
        L.g.fillStyle = 'rgba(' + COL[p2[3]] + ',' + ((0.6 + 0.4 * h2(i, 3)) * kArea / pk) + ')';
        var ds = h2(i, 7) < 0.25 ? dot * 2 : dot;
        L.g.fillRect(Math.round(p2[0] * R), Math.round(p2[1] * R), ds, ds);
      }
      out.push(L.cv);
    }
    return out;
  }

  VIZ_EYES.register({
    id: 'nightflight',
    name: 'Night Flight',
    idea: 'The iris is a city at night seen from a plane, turning slowly below, with a dark lake for a pupil; each kick sends a surge of power out through its streets.',
    draw: function (p, x, y, r, t, a, state, look) {
      var c = p.drawingContext;
      p.push(); c.save();
      var dt = follow(state, t, a);
      if (!state.city) { state.city = build(); state.fw = []; state.sn = state.snareN || 0; }
      var city = state.city;
      var bl = VIZ_EYES.blink(state, t);
      var drop = state.drop, bd = a.bands || [];
      var bass = clamp(((bd[1] || 0) + (bd[2] || 0)) / 160);
      var hat = a.hat || 0;
      var lx = look ? look.x : 0, ly = look ? look.y : 0;
      var ix = x + lx * r * 0.3, iy = y + ly * r * 0.16;
      var ri = r * 0.48;
      var m = c.getTransform(), sc = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
      var px1 = 1 / sc;
      var fine = ri * sc > 30;
      var lake = LAKE * (0.95 + 0.2 * bass + 0.1 * drop);

      // bake at the eye's device size (rebaked only if that changes a lot)
      var D = Math.max(24, Math.min(900, Math.round(2 * ri * sc)));
      if (!state.layers || Math.abs(state.D - D) > D * 0.25) { state.layers = bake(city, D); state.D = D; }

      if ((state.snareN || 0) !== state.sn) {
        state.sn = state.snareN || 0;
        var fr = 0.45 + Math.random() * 0.4, fa = Math.random() * TAU;
        state.fw.push({ x: Math.cos(fa) * fr, y: Math.sin(fa) * fr, t: t, hue: Math.random() < 0.5 ? 0 : 1 });
        if (state.fw.length > 4) state.fw.shift();
      }

      var cu = openEye(c, x, y, r, bl, '#efeae2', '#c9c0b3');
      var g = c.createRadialGradient(ix, iy, ri * lake, ix, iy, ri);
      g.addColorStop(0, '#141a2c'); g.addColorStop(0.7, '#0b0f1d'); g.addColorStop(1, '#05070d');
      c.fillStyle = g; c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.fill();

      c.save();
      c.beginPath(); c.arc(ix, iy, ri * 0.985, 0, TAU); c.clip();
      c.translate(ix, iy);
      var rot = t * 0.035;
      c.rotate(rot);
      // light pollution over downtown, warmer when the city is awake
      var haze = c.createRadialGradient(0, 0, ri * LAKE, 0, 0, ri);
      haze.addColorStop(0, 'rgba(255,140,50,' + (0.08 + 0.1 * drop) + ')');
      haze.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = haze; c.fillRect(-ri, -ri, 2 * ri, 2 * ri);

      // the districts wake in groups with the music; the arterials never sleep
      var on = 0.42 + 0.5 * drop + 0.2 * bass;
      c.globalCompositeOperation = 'lighter';
      var Ls = state.layers;
      for (var l = 0; l < LAYERS; l++) {
        var al = clamp((on * (LAYERS + 0.4) - l) * 1.2);
        if (al <= 0.01) continue;
        c.globalAlpha = al;
        c.drawImage(Ls[l + 1], -ri, -ri, 2 * ri, 2 * ri);
      }
      c.globalAlpha = 0.7;
      c.drawImage(Ls[0], -ri, -ri, 2 * ri, 2 * ri);
      // kick: a surge of power, the same lights drawn again in a ring that
      // travels out from the lake
      var kS = state.kickT == null ? 99 : t - state.kickT;
      if (kS < 0.6) {
        var wave = (LAKE + kS * 1.5) * ri, wA = 1 - kS / 0.6, ww = ri * 0.09;
        c.save();
        c.beginPath(); c.arc(0, 0, wave + ww, 0, TAU); c.arc(0, 0, Math.max(0, wave - ww), 0, TAU, true); c.clip();
        c.globalAlpha = wA;
        c.drawImage(Ls[0], -ri, -ri, 2 * ri, 2 * ri);
        for (l = 1; l <= LAYERS; l++) c.drawImage(Ls[l], -ri, -ri, 2 * ri, 2 * ri);
        c.restore();
      }
      c.globalAlpha = 1;
      // traffic on the arterials: white headlights in, red tail-lights out
      if (fine) {
        for (var i = 0; i < city.cars.length; i++) {
          var car = city.cars[i];
          car.s = (car.s + car.v * dt * (0.6 + drop)) % 1; if (car.s < 0) car.s += 1;
          var lane = city.lanes[car.a];
          var fi = car.s * (lane.length - 1), i0 = Math.floor(fi), fu = fi - i0;
          var qa = lane[i0], qb = lane[Math.min(lane.length - 1, i0 + 1)];
          var cxp = (qa[0] + (qb[0] - qa[0]) * fu) * ri, cyp = (qa[1] + (qb[1] - qa[1]) * fu) * ri;
          var glint = 0.6 + 0.4 * clamp(hat * 1.5);
          c.fillStyle = car.v < 0 ? 'rgba(255,250,235,' + glint + ')' : 'rgba(255,80,70,' + (0.8 * glint) + ')';
          var cz = Math.max(px1 * 1.5, ri * 0.012 * (car.v < 0 ? 1 + hat : 1));
          c.fillRect(cxp - cz / 2, cyp - cz / 2, cz, cz);
        }
      }
      // fireworks: a ring of sparks that opens and falls
      for (i = 0; i < state.fw.length; i++) {
        var fw = state.fw[i], u = (t - fw.t) / 1.1;
        if (u < 0 || u > 1) continue;
        var rad = ri * 0.13 * Math.sqrt(u), fa2 = (1 - u) * (1 - u);
        c.fillStyle = fw.hue ? 'rgba(255,150,190,' + fa2 + ')' : 'rgba(255,214,120,' + fa2 + ')';
        for (var j = 0; j < 14; j++) {
          var aj = j * TAU / 14;
          var fz = Math.max(px1, ri * 0.018 * (1 - u * 0.5));
          c.fillRect(fw.x * ri + Math.cos(aj) * rad - fz / 2, fw.y * ri + Math.sin(aj) * rad + u * u * ri * 0.03 - fz / 2, fz, fz);
        }
        c.fillStyle = 'rgba(255,240,210,' + fa2 * 0.25 + ')';
        c.beginPath(); c.arc(fw.x * ri, fw.y * ri, rad * 1.2, 0, TAU); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();

      // clouds below the plane, drifting across, hiding the lights they cross
      if (fine) {
        c.save(); c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.clip();
        for (i = 0; i < 3; i++) {
          var cf = ((t * 0.03 + city.clouds[i] + i * 0.37) % 1);
          var ccx = ix + (cf * 2.8 - 1.4) * ri, ccy = iy + (city.clouds[i] - 0.5) * ri * 1.3;
          var cg = c.createRadialGradient(ccx, ccy, 0, ccx, ccy, ri * 0.4);
          cg.addColorStop(0, 'rgba(30,32,48,0.55)'); cg.addColorStop(0.6, 'rgba(36,36,52,0.28)'); cg.addColorStop(1, 'rgba(40,38,52,0)');
          c.save(); c.translate(ccx, ccy); c.scale(1.9, 0.65); c.translate(-ccx, -ccy);
          c.fillStyle = cg; c.beginPath(); c.arc(ccx, ccy, ri * 0.4, 0, TAU); c.fill();
          c.restore();
        }
        c.restore();
      }

      // the lake: a dark pupil with a wobbly shore, the promenade lit round it,
      // and the moon's path on the water
      c.save(); c.translate(ix, iy);
      c.beginPath();
      for (i = 0; i <= 48; i++) {
        var al2 = i * TAU / 48;
        var sr = ri * lake * (1 + 0.05 * Math.sin(al2 * 3 + 1) + 0.03 * Math.sin(al2 * 7 + 2));
        c.lineTo(Math.cos(al2 + rot) * sr, Math.sin(al2 + rot) * sr);
      }
      c.closePath();
      c.fillStyle = '#03040a'; c.fill();
      c.strokeStyle = 'rgba(255,196,120,' + (0.5 + 0.3 * drop) + ')';
      c.lineWidth = Math.max(px1, ri * 0.01);
      if (fine) c.setLineDash([ri * 0.008, ri * 0.012]);
      c.stroke(); c.setLineDash([]);
      if (fine) {
        c.clip();
        var mx = ri * lake * 0.2;
        var mg = c.createLinearGradient(mx - ri * lake * 0.3, 0, mx + ri * lake * 0.3, 0);
        mg.addColorStop(0, 'rgba(200,215,255,0)'); mg.addColorStop(0.5, 'rgba(200,215,255,0.14)'); mg.addColorStop(1, 'rgba(200,215,255,0)');
        c.fillStyle = mg; c.fillRect(mx - ri * lake * 0.3, -ri * lake, ri * lake * 0.6, 2 * ri * lake);
        for (i = 0; i < 9; i++) {
          var sh = Math.sin(t * 2.3 + i * 1.9);
          var mw = ri * lake * (0.1 + 0.22 * Math.abs(Math.sin(i * 4.1 + t * 0.9)));
          var my = -ri * lake * 0.7 + i * ri * lake * 0.16 + sh * ri * 0.004;
          c.fillStyle = 'rgba(225,232,255,' + (0.2 + 0.3 * Math.abs(Math.sin(i * 2.7 + t * 1.3))) + ')';
          c.fillRect(mx - mw / 2 + sh * ri * lake * 0.08, my, mw, Math.max(px1, ri * 0.008));
        }
      }
      c.restore();

      catchlight(c, ix, iy, ri, 0.8);
      closeEye(c, x, y, r, cu, '#1f2030');
      c.restore(); p.pop();
    }
  });
})();
