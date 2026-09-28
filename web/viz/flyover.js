// Flyover — finishes ../../Flyover.pde, which never ran (it is commented out
// in viz.pde as "flyover ;_;").
//
// The idea was Raph's: a landscape where every row is one spectrum snapshot,
// pushed onto a queue every other frame, drawn in P3D as TRIANGLE_STRIP rows
// under rotateX(PI/3). The port has no WEBGL canvas, so the 3D is done by
// hand: every row is an affine strip on screen (centre, half-width, ground
// line, height scale), which is all a pinhole camera over a heightfield needs
// and keeps the hot loop to multiply-adds.
//
// Nine bands make a coarse row, so each snapshot is splined into a mirrored
// profile (bass in the middle by default, treble at both edges) with a little
// Perlin ground so silence still has terrain.
(function () {
  const shared = window.VIZ_PALETTES || [];
  const BANDS = 9;
  const COLS = 81;           // odd, so there is a centre column on the axis
  const MAX_ROWS = 110;      // ring buffer size; rows param goes to 100 (+ entry rows)
  const MODES = ['Wireframe', 'Ridgelines', 'Night drive'];

  // Per-mode constants that are part of each look rather than things a VJ
  // turns: how strong the perspective is, how wide the mesh is, how high the
  // hills beside the valley rise, the base line weight.
  const LOOK = [
    // Wireframe: the original's framing — a trapezoid of mesh over black.
    { zNear: 3, zFar: 13, halfWidth: 0.56, sideHills: 0.5, weight: 1, stride: 2, gain: 1 },
    // Ridgelines: near-orthographic stacking, like the pulsar plot.
    { zNear: 0, zFar: 0, halfWidth: 0.34, sideHills: 0, weight: 1.4, stride: 1, gain: 1 },
    // Night drive: a wider land so the mesh reaches the screen edge further
    // back, with the row lines continued flat to the edges as a grid floor,
    // and a deep far end so the land meets the sky. Seen from lower, it needs
    // more height to read as hills.
    { zNear: 2.5, zFar: 28, halfWidth: 1.25, sideHills: 1, weight: 1.2, stride: 2, gain: 1.6 },
  ];

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  }
  function saturation(c) {
    const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
    return mx === 0 ? 0 : (mx - mn) / mx;
  }
  function luma(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // Night drive derives its whole scene from one palette, so every palette
  // gives a coherent night instead of five colours used at random: the most
  // saturated colour draws the land, the next one lights the sun, and the
  // sky and haze are the darkest colour pushed toward night.
  function nightScheme(hexes) {
    const cols = hexes.map(hexToRgb);
    const bySat = cols.slice().sort((a, b) => saturation(b) * (0.4 + luma(b) / 255) -
                                              saturation(a) * (0.4 + luma(a) / 255));
    const byLuma = cols.slice().sort((a, b) => luma(a) - luma(b));
    const warmth = (c) => (c[0] - c[2]) / 255 + 0.5 * saturation(c) + 0.2 * luma(c) / 255;
    const sun = cols.slice().sort((a, b) => warmth(b) - warmth(a))[0];
    const line = bySat[0] === sun ? bySat[1] : bySat[0];
    const dark = byLuma[0];
    const black = [0, 0, 0];
    return {
      line,
      sun,
      sunCore: mix(sun, [255, 250, 235], 0.55),
      skyTop: mix(dark, black, 0.88),
      haze: mix(mix(dark, sun, 0.35), black, 0.45),
      ground: mix(dark, black, 0.93),
    };
  }

  VIZ.register({
    id: 'flyover',
    name: 'Flyover',
    order: 8,

    params: [
      { key: 'mode', label: 'Mode', type: 'select', options: MODES, default: 0 },
      { key: 'height', label: 'Terrain height', type: 'range', min: 0, max: 400, default: 150 },
      // Rows taken per frame; the original took one every 2 frames (0.5).
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 1, default: 0.5 },
      { key: 'rows', label: 'Rows of history', type: 'range', min: 10, max: 100, default: 40, step: 1 },
      { key: 'direction', label: 'Flight', type: 'select',
        options: ['Land recedes', 'Land approaches'], default: 0 },
      { key: 'camHeight', label: 'Camera height', type: 'range', min: 0.3, max: 2, default: 1 },
      { key: 'tilt', label: 'Camera tilt', type: 'range', min: 0, max: 1, default: 0.5 },
      { key: 'valley', label: 'Valley width', type: 'range', min: 0.15, max: 1, default: 0.6 },
      { key: 'layout', label: 'Layout', type: 'select',
        options: ['Bass in the middle', 'Treble in the middle'], default: 0 },
      { key: 'noise', label: 'Ground noise', type: 'range', min: 0, max: 1, default: 0.35 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.25, max: 4, default: 1 },
      { key: 'colorPalette', label: 'Palette (Night drive)', type: 'palette',
        palettes: shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() })),
        default: 5 },
      { key: 'sunBand', label: 'Sun band', type: 'band', default: 0 },
      { key: 'sunSize', label: 'Sun size', type: 'range', min: 0, max: 2, default: 1 },
    ],

    // Ring buffer: raw bands per row, plus that row's ground noise, which
    // depends only on the row's serial number and so is computed once.
    sig: null,
    nLo: null,
    nHi: null,
    head: 0,        // slot of the newest row
    serial: 0,
    acc: 0,         // fraction of the way to the next row
    sunLevel: 0,
    stars: null,
    schemeFor: -1,
    scheme: null,

    setup(p) {
      this.sig = new Float32Array(MAX_ROWS * BANDS);
      this.env = new Float32Array(BANDS);
      this.nLo = new Float32Array(MAX_ROWS * COLS);
      this.nHi = new Float32Array(MAX_ROWS * COLS);
      // Prefill with silence so the land is already there on first switch.
      const quiet = new Float32Array(BANDS);
      for (let i = 0; i < MAX_ROWS; i++) this.push(p, quiet);
      this.stars = [];
      for (let i = 0; i < 90; i++) {
        this.stars.push({ x: Math.random(), y: Math.pow(Math.random(), 1.6),
                          r: Math.random() < 0.15 ? 1.4 : 0.8, ph: Math.random() * 6.28 });
      }
      // Profile scratch, reused every frame.
      this.px = new Float32Array(COLS);
      this.py = new Float32Array(COLS);
      this.pyPrev = new Float32Array(COLS);
      this.pxPrev = new Float32Array(COLS);
    },

    push(p, signals) {
      this.head = (this.head + 1) % MAX_ROWS;
      this.serial++;
      const s = this.serial;
      for (let b = 0; b < BANDS; b++) this.sig[this.head * BANDS + b] = signals[b];
      const o = this.head * COLS;
      for (let j = 0; j < COLS; j++) {
        this.nLo[o + j] = p.noise(j * 0.09, s * 0.06);
        this.nHi[o + j] = p.noise(j * 0.45 + 100, s * 0.5 + 100);
      }
    },

    // Height (0-100-ish signal units) of every column of the row in `slot`.
    profile(slot, out, prm) {
      const sig = this.sig, base = slot * BANDS, o = slot * COLS;
      const valley = prm.valley, noise = prm.noise, hills = prm.sideHills, trebleMid = prm.layout === 1;
      for (let j = 0; j < COLS; j++) {
        const d = Math.abs(j / (COLS - 1) * 2 - 1);
        const s = d / valley;
        let pos = (s < 1 ? s : 1) * 8;
        if (trebleMid) pos = 8 - pos;
        // Catmull-Rom through the nine bands.
        let i = pos | 0;
        if (i > 7) i = 7;
        const t = pos - i;
        const p0 = sig[base + (i > 0 ? i - 1 : 0)], p1 = sig[base + i];
        const p2 = sig[base + i + 1], p3 = sig[base + (i < 7 ? i + 2 : 8)];
        const t2 = t * t, t3 = t2 * t;
        let v = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                       (3 * p1 - p0 - 3 * p2 + p3) * t3);
        if (v < 0) v = 0;
        // Outside the valley the outermost band dies away into plain hills.
        const out1 = s - 1;
        if (out1 > 0) v *= Math.exp(-out1 * 2.5);
        // Grain, scaled by the signal, so loud peaks are jagged rather than
        // smooth splines; then the ground, which rises beside the valley.
        v *= 1 + noise * 1.2 * (this.nHi[o + j] - 0.5);
        const side = out1 > 0 ? (out1 < 1.5 ? out1 : 1.5) : 0;
        v += noise * (10 + hills * 55 * side) * this.nLo[o + j];
        // Taper to the ground at the edges so the mesh ends on the floor.
        const e = clamp01((1 - d) / 0.12);
        out[j] = v * e * e * (3 - 2 * e);
      }
    },

    draw(p, signals, params, ctx) {
      if (!this.sig) this.setup(p);
      const mode = Math.round(params.mode) % 3;
      const look = LOOK[mode];
      const W = ctx.width, H = ctx.height;
      const rows = Math.round(params.rows);
      const approach = Math.round(params.direction) === 1;

      // Advance the flight: whole rows taken, and the fraction toward the
      // next one so the land glides rather than stepping.
      // Each band is followed with a quick attack and a slower release before
      // it is sampled, so a hi-hat leaves a ridge a few rows deep instead of a
      // one-row spike standing alone in the mesh.
      const env = this.env;
      for (let b = 0; b < BANDS; b++) {
        const v = signals[b];
        env[b] += (v - env[b]) * (v > env[b] ? 0.7 : 0.18);
      }
      this.acc += params.speed;
      while (this.acc >= 1) { this.acc -= 1; this.push(p, env); }
      const phase = this.acc;

      const band = Math.round(params.sunBand) % BANDS;
      this.sunLevel += (signals[band] - this.sunLevel) * 0.2;

      p.colorMode(p.RGB, 255);
      p.background(0);
      const g = p.drawingContext;
      g.lineJoin = 'round';
      g.lineCap = 'round';

      const horizon = H * (0.52 - 0.4 * params.tilt);
      const heightPx = params.height * look.gain;
      const cx = W / 2;
      const prm = { valley: params.valley, noise: params.noise, sideHills: look.sideHills,
                    layout: Math.round(params.layout) };

      let sch = null;
      if (mode === 2) {
        const pi = Math.round(params.colorPalette);
        if (this.schemeFor !== pi || !this.scheme) {
          this.scheme = nightScheme((shared[pi] || shared[0]).colors);
          this.schemeFor = pi;
        }
        sch = this.scheme;
        // The sky ends where the farthest ground line sits, not at the
        // vanishing line, so there is no empty strip between land and sky.
        const yFar = horizon + (H * 1.02 - horizon) * params.camHeight * look.zNear / look.zFar;
        this.drawSky(g, W, H, yFar, sch, params, p);
      }

      // Row placement. `f` is depth: 0 at the front, 1 at the far end. Rows
      // are spaced one step apart and slide by `phase` between pushes; one
      // extra row sits just beyond each end so nothing pops into view.
      const step = 1 / (rows - 1);
      const yFront = horizon + (H * 1.02 - horizon) * params.camHeight;
      const lw = look.weight * params.weight;
      const stride = look.stride;

      const rowCount = rows + 1;
      let prevOk = false;
      for (let k = rowCount - 1; k >= 0; k--) {
        // k is the row's age in pushes: 0 newest. Far-to-near painting means
        // oldest first when the land recedes, newest first when it approaches.
        const age = approach ? rowCount - 1 - k : k;
        const slot = ((this.head - age) % MAX_ROWS + MAX_ROWS) % MAX_ROWS;
        // The newest row slides in from just beyond its end (behind the far
        // row, or below the front) so nothing pops into view.
        const f = approach ? 1 - (age + phase - 1) * step : (age - 1 + phase) * step;

        let xs, yb, hs;
        if (mode === 1) {
          // Evenly stacked lines, a slight narrowing for depth.
          const yBack = horizon * 0.55 + H * 0.06;
          const yNear = yBack + (H * 0.93 - yBack) * params.camHeight;
          xs = Math.min(W * 0.46, H * look.halfWidth * 1.1) * (1 - 0.18 * f);
          yb = yNear + (yBack - yNear) * f;
          hs = heightPx * 0.55 * (1 - 0.25 * f) / 100;
        } else {
          const z = look.zNear + f * (look.zFar - look.zNear);
          if (z <= 0.3) { prevOk = false; continue; }
          const r = look.zNear / z;
          xs = W * look.halfWidth * r;
          yb = horizon + (yFront - horizon) * r;
          hs = heightPx * r / 100;
        }

        // Fade at both ends of the history so entry and exit are soft.
        const fadeFar = clamp01((1.02 - f) / 0.14);
        const fadeNear = clamp01((f + step) / step);
        const alpha = fadeFar * fadeNear;
        if (alpha <= 0.001) { prevOk = false; continue; }

        this.profile(slot, this.py, prm);
        const px = this.px, py = this.py;
        for (let j = 0; j < COLS; j++) {
          px[j] = cx + (j / (COLS - 1) * 2 - 1) * xs;
          py[j] = yb - py[j] * hs;
        }

        if (mode === 0) this.wireRow(g, px, py, prevOk, stride, lw, f, alpha);
        else if (mode === 1) this.ridgeRow(g, px, py, lw, H, alpha);
        else this.nightRow(g, px, py, prevOk, stride, lw, f, alpha, sch, W, H, yb);

        // Keep this row as the farther neighbour of the next one.
        const tx = this.pxPrev, ty = this.pyPrev;
        this.pxPrev = px; this.pyPrev = py;
        this.px = tx; this.py = ty;
        prevOk = true;
      }
    },

    // The original's TRIANGLE_STRIP with noFill: every row line, the
    // longitudinal edges to the farther row and the strip diagonals, all
    // visible — no hidden lines, as P3D drew it. Depth only dims.
    wireRow(g, px, py, prevOk, stride, lw, f, alpha) {
      const a = alpha * (1 - 0.7 * f);
      g.lineWidth = lw * (1.1 - 0.5 * f);
      g.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      g.beginPath();
      g.moveTo(px[0], py[0]);
      for (let j = stride; j < COLS; j += stride) g.lineTo(px[j], py[j]);
      if (prevOk) {
        const qx = this.pxPrev, qy = this.pyPrev;
        for (let j = 0; j < COLS; j += stride) {
          g.moveTo(px[j], py[j]);
          g.lineTo(qx[j], qy[j]);
          if (j + stride < COLS) {
            g.moveTo(px[j], py[j]);
            g.lineTo(qx[j + stride], qy[j + stride]);
          }
        }
      }
      g.stroke();
    },

    // Each ridge fills black down past the bottom before it is stroked, so a
    // nearer ridge hides whatever it passes in front of.
    ridgeRow(g, px, py, lw, H, alpha) {
      g.beginPath();
      g.moveTo(px[0], py[0]);
      for (let j = 1; j < COLS; j++) g.lineTo(px[j], py[j]);
      g.lineWidth = lw;
      g.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      g.lineTo(px[COLS - 1], H + 20);
      g.lineTo(px[0], H + 20);
      g.closePath();
      g.fillStyle = '#000';
      g.fill();
      // Re-trace only the ridge so the fill's sides and bottom are not outlined.
      g.beginPath();
      g.moveTo(px[0], py[0]);
      for (let j = 1; j < COLS; j++) g.lineTo(px[j], py[j]);
      g.stroke();
    },

    drawSky(g, W, H, horizon, sch, params, p) {
      // Sky: night overhead, haze at the horizon.
      let gr = g.createLinearGradient(0, 0, 0, horizon);
      gr.addColorStop(0, rgba(sch.skyTop, 1));
      gr.addColorStop(0.7, rgba(mix(sch.skyTop, sch.haze, 0.35), 1));
      gr.addColorStop(1, rgba(sch.haze, 1));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, horizon + 1);

      // Stars, faint and only in the upper sky.
      const t = p.millis() / 1000;
      g.fillStyle = 'rgb(255,255,255)';
      for (const s of this.stars) {
        const y = s.y * horizon * 0.8;
        const a = (0.25 + 0.2 * Math.sin(t * 0.7 + s.ph)) * (1 - y / horizon);
        g.globalAlpha = a;
        g.fillRect(s.x * W, y, s.r, s.r);
      }
      g.globalAlpha = 1;

      // The sun sits on the horizon; its size breathes with the sun band.
      const level = this.sunLevel / 100;
      const r = H * 0.11 * params.sunSize * (0.7 + 0.55 * level);
      if (r > 0.5) {
        const sx = W / 2, sy = horizon - r * 0.25;
        g.save();
        g.beginPath();
        g.rect(0, 0, W, horizon);
        g.clip();
        const glowR = r * (3 + 1.5 * level);
        gr = g.createRadialGradient(sx, sy, r * 0.8, sx, sy, glowR);
        gr.addColorStop(0, rgba(sch.sun, 0.35 + 0.25 * level));
        gr.addColorStop(1, rgba(sch.sun, 0));
        g.fillStyle = gr;
        g.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
        gr = g.createLinearGradient(0, sy - r, 0, sy + r);
        gr.addColorStop(0, rgba(sch.sunCore, 1));
        gr.addColorStop(1, rgba(sch.sun, 1));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(sx, sy, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      // Ground: haze at the horizon falling to dark earth at the front.
      gr = g.createLinearGradient(0, horizon, 0, H);
      gr.addColorStop(0, rgba(sch.haze, 1));
      gr.addColorStop(0.25, rgba(sch.ground, 1));
      gr.addColorStop(1, rgba(sch.ground, 1));
      g.fillStyle = gr;
      g.fillRect(0, horizon, W, H - horizon + 1);
    },

    // Hidden-line grid: longitudinal edges from the farther row, then this
    // row's land filled down to the bottom (hiding whatever is behind it),
    // then the row line, continued flat to the screen edges as a grid floor.
    // Fog mixes both line and fill toward the horizon haze with depth.
    nightRow(g, px, py, prevOk, stride, lw, f, alpha, sch, W, H, yb) {
      const fog = Math.pow(f < 0 ? 0 : f, 0.8);
      const lineC = mix(sch.line, sch.haze, fog);
      const fillC = mix(sch.ground, sch.haze, fog * 0.9);
      const la = alpha * (1 - 0.35 * fog);
      g.lineWidth = lw * (1.15 - 0.6 * (f < 0 ? 0 : f));

      if (prevOk) {
        const qx = this.pxPrev, qy = this.pyPrev;
        g.beginPath();
        for (let j = 0; j < COLS; j += stride) {
          g.moveTo(qx[j], qy[j]);
          g.lineTo(px[j], py[j]);
        }
        g.strokeStyle = rgba(lineC, la * 0.55);
        g.stroke();
      }

      g.beginPath();
      g.moveTo(-10, yb);
      for (let j = 0; j < COLS; j++) g.lineTo(px[j], py[j]);
      g.lineTo(W + 10, yb);
      g.lineTo(W + 10, H + 20);
      g.lineTo(-10, H + 20);
      g.closePath();
      g.fillStyle = rgba(fillC, alpha);
      g.fill();

      g.beginPath();
      g.moveTo(-10, yb);
      for (let j = 0; j < COLS; j++) g.lineTo(px[j], py[j]);
      g.lineTo(W + 10, yb);
      g.strokeStyle = rgba(lineC, la);
      g.stroke();
    },
  });
})();
