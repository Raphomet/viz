// Fault Lines — crack growth on paper, in the manner of the golden-age
// substrate technique: straight-ish graphite cracks grow until they meet
// another crack, new cracks branch from old ones at a set angle, and each
// crack drags a band of low-alpha "sand" along one side so the regions it
// bounds fill slowly with watercolour tone.
//
// The point of view this adds to the technique: the plate is a palimpsest.
// When a generation is subdivided enough, it is not wiped: it sinks into the
// paper as a faint ghost while the next generation, with a new grain (its
// seed cracks run at a rotated angle) and a new dominant earth colour, grows
// straight across it. So the piece never stops growing and never resets.
//
// Music changes the physics, not a meter: kicks crack the plate (new
// branches, and a lurch of growth), the low end sets growth speed and how
// long the population survives, the treble thickens the sand, and the pad
// widens the sand into broad washes, so the drop shatters and the breakdown
// thins out into slow, wide colour.
(function () {
  // Warm paper, graphite, and three earths per palette (the brief's cap).
  // Darker than a sheet of paper on purpose: a near-white stage is the
  // brightest thing in a dark room and washes the sand out.
  const PAPER = [215, 206, 188];
  const GRAPHITE = 'rgb(44,42,40)';
  const PALETTES = [
    { name: 'Sienna, umber, slate', sand: ['#b3692f', '#7a4431', '#566a6b'] },
    { name: 'Ochre, rust, soot',    sand: ['#c08b36', '#9a4a2a', '#3f3d3a'] },
    { name: 'Terre verte, clay, ink', sand: ['#6f7d5e', '#a86a4c', '#2f3a4a'] },
  ];

  const STEP = 0.5;           // growth substep in virtual units; < 1 cell so lines mark contiguous cells
  const TIERS = [1.5, 0.8, 0.45, 0.2];   // sand alpha falls off away from the crack
  const MAX_POINTS = 24000;   // branch-point pool; old points are overwritten at random once full
  const GHOST_FLOOR = 0.06;   // a dissolved plate stays as a whisper, not a second plate
  const GOLDEN = 2.39996;
  const FADE_SECONDS = 14;   // how long a plate takes to sink into the paper
  const FADE_EVERY = 6;      // frames between fade steps     // rotate each generation's grain by the golden angle so grains never repeat

  const rnd = (a, b) => a + Math.random() * (b - a);

  VIZ.register({
    id: 'faultlines',
    name: 'Fault Lines',
    order: 101,

    params: [
      { key: 'growth', label: 'Growth rate', type: 'range', min: 0.2, max: 3, default: 1, step: 0.01 },
      { key: 'cracks', label: 'Crack count', type: 'range', min: 8, max: 240, default: 90, step: 1 },
      { key: 'branch', label: 'Branch angle', type: 'range', min: 20, max: 90, default: 90, step: 1 },
      { key: 'bend', label: 'Bend', type: 'range', min: 0, max: 1, default: 0.12, step: 0.01 },
      { key: 'sand', label: 'Sand', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'reach', label: 'Wash width', type: 'range', min: 0.1, max: 1, default: 0.5, step: 0.01 },
      { key: 'palette', label: 'Earths', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'kickBand', label: 'Fracture band', type: 'band', default: 0 },
    ],

    actions: [
      { id: 'renew', label: 'New plate', run() { this.renewPending = true; } },
    ],

    gallery: {
      title: 'Fault Lines',
      technique: 'Canvas 2D crack growth on a cell grid with substrate-style sand painting, accumulated in an offscreen layer that never clears; generations dissolve into a ghost layer',
      brief: 'Graphite cracks subdivide a paper plate and sand bands tone the regions like watercolour. Kicks fracture the plate and make it lurch forward; treble thickens the sand; the pad spreads it into wide washes. When a plate is finely subdivided it sinks into the paper and a new one, with a rotated grain and a new dominant earth, grows across it.',
      lineage: [
        'Brief 01: substrate-style crack growth (Tarbell, 2003) on paper, graphite lines, three earths per palette.',
        'Kept the technique (branching at a set angle, sand laid along one side toward the next crack) but not the look: a slight per-crack bend so plates read as dried clay or crackle glaze rather than a ruled grid.',
        'Departed from the brief on renewal: instead of a low-alpha wash, a finished plate is snapshotted and eased into the paper as a ghost while the next plate, rotated by the golden angle and with a new dominant earth, cracks across it. A palimpsest, never a reset.',
        'First pass composited three full-stage layers every frame (19 ms mean); now marks go straight onto the never-cleared stage and a fade restacks only two frames in six.',
        'Sand was too faint and too sparse on the first renders: denser, smaller grains with a heavier first tier near the crack.',
        'The breakdown froze once the drop had filled the plate; renewal now fires when the plate is subdivided (total crack length, or short recent cracks), so the breakdown opens a new, slow plate with pad-widened washes.',
        'Critic round 1 (REVISE, 3/4/4/2/3): the long run had gone to mush, a half-grown plate over stacked pale ghosts. Renewal now waits for a genuinely subdivided plate (30 s minimum, W*H/10 of crack), and the ghost floor dropped from 0.16 to 0.06 so it is a whisper.',
        'Seed cracks are straight and capped at about a third of the short side, 13 to 14 per plate, and bend decays with distance: no more scythe arcs across the frame. The paper is about 10% darker and the sand alpha went from 0.17 to 0.26 for weight in a dark room.',
      ],
    },

    setup() {},

    enter(p, ctx) {
      this.reset(p, ctx);
    },

    // --- state ---------------------------------------------------------

    reset(p, ctx) {
      this.W = ctx.width;
      this.H = ctx.height;
      this.gw = Math.ceil(this.W);
      this.gh = Math.ceil(this.H);
      this.grid = new Int32Array(this.gw * this.gh);   // crack serial per cell, 0 = open
      this.gridAng = new Float32Array(this.gw * this.gh);
      this.px = new Float32Array(MAX_POINTS);
      this.py = new Float32Array(MAX_POINTS);
      this.pa = new Float32Array(MAX_POINTS);
      this.ps = new Int32Array(MAX_POINTS);
      this.nPoints = 0;
      this.cracks = [];
      this.serial = 0;
      this.gen = 0;
      this.theta = rnd(0, Math.PI);
      this.renewPending = false;
      this.eLow = 0; this.eHigh = 0; this.ePad = 0;
      this.prevKick = 0; this.lastKick = -1;
      this.canvases(p, true);
      this.startGeneration(14);
    },

    // Offscreen canvases in device pixels: a paper texture, a snapshot of
    // the stage taken at each renewal (the ghost), the paper-plus-faded-ghost
    // base, and a transparent layer the new generation also grows into while
    // the ghost fades. Marks always go straight onto the stage, which is
    // never cleared; full-stage blits are paid only during a fade, and only
    // on two frames in every FADE_EVERY (the fade is slow enough that
    // stepping it ten times a second does not show), which keeps renderTime
    // p95 flat instead of tripling it for the length of every fade.
    canvases(p, clear) {
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      // willReadFrequently keeps these on the CPU: the stage gets read back
      // (by the harness, and by our renewal snapshot), and blitting between a
      // GPU and a CPU canvas cost 100+ ms a frame in the first renders.
      const make = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d', { willReadFrequently: true });
        return c;
      };
      if (!this.layer || this.layer.width !== w || this.layer.height !== h) {
        this.layer = make(); this.ghost = make(); this.base = make();
        this.paper = make();
        this.paintPaper(this.paper);
        clear = true;
      }
      if (clear) {
        this.layer.getContext('2d').clearRect(0, 0, w, h);
        this.fading = false;
        this.fadeDone = false;
        this.needPaper = true;
      }
      this.k = w / this.W;   // device pixels per virtual unit
    },

    // Paper: a flat warm ground with fine fibre noise and a very soft edge
    // falloff, so large empty areas never read as a flat digital fill.
    paintPaper(c) {
      const g = c.getContext('2d');
      const w = c.width, h = c.height;
      const img = g.createImageData(w, h);
      const d = img.data;
      const cx = w / 2, cy = h / 2, rr = Math.hypot(cx, cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = Math.hypot(x - cx, y - cy) / rr;
          const n = (Math.random() - 0.5) * 6 - r * r * 14;
          d[i] = PAPER[0] + n; d[i + 1] = PAPER[1] + n; d[i + 2] = PAPER[2] + n * 1.15; d[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },

    startGeneration(seeds) {
      this.grid.fill(0);
      this.nPoints = 0;
      this.cracks.length = 0;
      this.genStart = this.now || 0;
      this.genLen = 0;
      this.recent = [];
      this.dominant = this.gen % 3;
      for (let i = 0; i < seeds; i++) {
        // Seeds share the generation's grain (theta or theta + 90°), which is
        // what makes each generation read as its own plate.
        const a = this.theta + (Math.random() < 0.5 ? 0 : Math.PI / 2) + rnd(-0.06, 0.06) + (Math.random() < 0.5 ? Math.PI : 0);
        this.cracks.push(this.newCrack(rnd(0.08, 0.92) * this.W, rnd(0.08, 0.92) * this.H, a, 0));
      }
    },

    newCrack(x, y, a, parent) {
      const r = Math.random();
      return {
        x, y, a, parent,
        serial: ++this.serial,
        trav: 0,
        // Seed cracks (no parent) cross an empty grid and would hit nothing,
        // so bend accumulated into frame-wide scythe arcs: keep them straight
        // and short, and let branching do the subdividing.
        maxLen: parent === 0 ? 0.35 * Math.min(this.W, this.H) * rnd(0.6, 1) : Infinity,
        speed: rnd(0.7, 1.3),
        curv: rnd(-1, 1),           // scaled by the Bend param each step
        side: Math.random() < 0.5 ? -1 : 1,
        // Dominant earth for this generation 60%, the other two 20% each.
        col: r < 0.6 ? this.dominant : (this.dominant + (r < 0.8 ? 1 : 2)) % 3,
        g: rnd(0.1, 0.9),           // sand band width, random-walked
      };
    },

    // Branch from a random point on an existing crack.
    spawn(params, fromTip) {
      let x, y, a, parent;
      if (fromTip && this.cracks.length) {
        const c = this.cracks[(Math.random() * this.cracks.length) | 0];
        x = c.x; y = c.y; a = c.a; parent = c.serial;
      } else if (this.nPoints > 0) {
        const i = (Math.random() * Math.min(this.nPoints, MAX_POINTS)) | 0;
        x = this.px[i]; y = this.py[i]; a = this.pa[i]; parent = this.ps[i];
      } else {
        return this.newCrack(rnd(0.1, 0.9) * this.W, rnd(0.1, 0.9) * this.H, this.theta, 0);
      }
      const br = (params.branch + rnd(-2.5, 2.5)) * Math.PI / 180;
      return this.newCrack(x, y, a + (Math.random() < 0.5 ? br : -br), parent);
    },

    renew(p) {
      // Snapshot the stage as it stands (paper, older ghosts, this plate)
      // and fade that snapshot toward the paper while the next plate grows
      // on a clear layer above it. Nothing visibly changes on the swap.
      const g = this.ghost.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'copy';
      g.drawImage(p.drawingContext.canvas, 0, 0);
      g.globalCompositeOperation = 'source-over';
      const l = this.layer.getContext('2d');
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.clearRect(0, 0, this.layer.width, this.layer.height);
      this.fading = true;
      this.fadeStart = this.now;
      this.fadeTick = 0;
      this.ghostAlpha = 1;
      this.gen++;
      this.theta += GOLDEN;
      this.startGeneration(13);
      this.renewPending = false;
    },

    // --- frame ---------------------------------------------------------

    draw(p, signals, params, ctx) {
      if (!this.grid || Math.abs(ctx.width - this.W) > 0.5 || Math.abs(ctx.height - this.H) > 0.5) this.reset(p, ctx);
      this.canvases(p, false);
      const t = p.millis() / 1000;
      this.now = t;

      // Smoothed energies: these steer physics, so they ease rather than jump.
      const low = (signals[0] + signals[1]) / 200;
      const high = (signals[6] + signals[7] + signals[8]) / 300;
      const pad = (signals[2] + signals[3] + signals[4]) / 300;
      this.eLow += (low - this.eLow) * 0.06;
      this.eHigh += (high - this.eHigh) * 0.1;
      this.ePad += (pad - this.ePad) * 0.03;

      // Kick onset on the chosen band: a sharp rise above a floor.
      const kb = Math.round(params.kickBand) % 9;
      const kv = signals[kb];
      let kick = 0;
      if (kv - this.prevKick > 12 && kv > 45 && t - this.lastKick > 0.18) {
        kick = kv / 100;
        this.lastKick = t;
      }
      this.prevKick = kv;

      const cap = Math.round(params.cracks);
      if (kick > 0) {
        const n = 2 + Math.round(kick * 4 * (cap / 90));
        for (let i = 0; i < n && this.cracks.length < cap; i++) this.cracks.push(this.spawn(params, Math.random() < 0.5));
      }

      // Growth per frame: a base walk, the low end, and a decaying lurch
      // after each kick so the plate visibly gives way on the beat.
      const sinceKick = this.lastKick < 0 ? 99 : t - this.lastKick;
      const lurch = Math.exp(-sinceKick * 6);
      const dist = params.growth * (0.7 + 1.6 * this.eLow + 1.4 * lurch);

      const m = p.drawingContext;
      if (this.needPaper) {
        m.save();
        m.globalAlpha = 1;
        m.globalCompositeOperation = 'source-over';
        m.drawImage(this.paper, 0, 0, ctx.width, ctx.height);
        m.restore();
        this.needPaper = false;
      }
      const targets = [m];
      if (this.fading) {
        const l = this.layer.getContext('2d');
        l.setTransform(this.k, 0, 0, this.k, 0, 0);
        targets.push(l);
      }

      const pal = PALETTES[Math.round(params.palette) % PALETTES.length].sand;
      const sandPaths = [];
      for (let c = 0; c < 3; c++) sandPaths.push(TIERS.map(() => new Path2D()));
      const lines = new Path2D();

      const bend = params.bend * 0.012;
      const grainsBase = 30 * params.sand * (1 + 2.2 * this.eHigh);
      const widthMul = params.reach * (0.6 + 1.2 * this.ePad);
      const maxReach = 40 + 360 * params.reach;

      const survivors = [];
      for (const c of this.cracks) {
        const alive = this.grow(c, dist * c.speed, bend, lines);
        if (alive) {
          this.paintSand(c, sandPaths[c.col], grainsBase, widthMul, maxReach);
          survivors.push(c);
        } else {
          this.recent.push(c.trav);
          if (this.recent.length > 40) this.recent.shift();
          // Keep the population alive in proportion to the low end: the
          // breakdown lets cracks retire, the drop replaces them all.
          const keep = survivors.length + 1 < 5 || Math.random() < 0.3 + 0.75 * this.eLow;
          if (keep) survivors.push(this.spawn(params, false));
        }
      }
      this.cracks = survivors;
      while (this.cracks.length < 3) this.cracks.push(this.spawn(params, false));
      while (this.cracks.length > cap) this.cracks.pop();

      // Sand first, graphite over it, so the lines stay crisp.
      for (const L of targets) {
        L.save();
        L.globalCompositeOperation = 'source-over';
        for (let c = 0; c < 3; c++) {
          L.fillStyle = pal[c];
          for (let i = 0; i < TIERS.length; i++) {
            L.globalAlpha = Math.min(1, 0.26 * TIERS[i]);
            L.fill(sandPaths[c][i]);
          }
        }
        L.globalAlpha = 0.9;
        L.strokeStyle = GRAPHITE;
        L.lineWidth = 0.6;
        L.lineCap = 'butt';
        L.lineJoin = 'round';
        L.stroke(lines);
        L.restore();
      }

      if (this.fading) this.stepFade(m, ctx);

      // Renewal: once the plate is finely subdivided (recent cracks are
      // short) or has simply run long, it sinks and a new one starts.
      const age = t - this.genStart;
      const mean = this.recent.length >= 30 ? this.recent.reduce((s, v) => s + v, 0) / this.recent.length : 1e9;
      if (!this.fading && (this.renewPending || (age > 30 && (mean < 18 || this.genLen > this.W * this.H / 10)) || age > 40)) this.renew(p);
    },

    // One fade step: on one frame rebuild the base (paper, then the ghost
    // at its eased alpha); on the next, put base and the new plate's layer
    // back on the stage. Between steps new marks land on both the stage and
    // the layer, so nothing is lost when the stage is rebuilt.
    stepFade(m, ctx) {
      const phase = this.fadeTick++ % FADE_EVERY;
      if (phase === 0) {
        const u = Math.min(1, (this.now - this.fadeStart) / FADE_SECONDS);
        // Ease-out: the old plate steps back fast, so the new cracks read
        // at once instead of tangling with an equally strong old plate,
        // then it settles into the paper slowly.
        const e = 1 - (1 - u) * (1 - u) * (1 - u);
        this.ghostAlpha = 1 + (GHOST_FLOOR - 1) * e;
        const b = this.base.getContext('2d');
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.globalCompositeOperation = 'source-over';
        b.globalAlpha = 1;
        b.drawImage(this.paper, 0, 0);
        b.globalAlpha = this.ghostAlpha;
        b.drawImage(this.ghost, 0, 0);
        b.globalAlpha = 1;
        if (u >= 1) this.fadeDone = true;
      } else if (phase === 1) {
        m.save();
        m.globalCompositeOperation = 'source-over';
        m.globalAlpha = 1;
        m.drawImage(this.base, 0, 0, ctx.width, ctx.height);
        m.drawImage(this.layer, 0, 0, ctx.width, ctx.height);
        m.restore();
        if (this.fadeDone) {
          // Flattened for good: the layer's marks now live on the stage.
          this.fading = false;
          this.fadeDone = false;
          const l = this.layer.getContext('2d');
          l.setTransform(1, 0, 0, 1, 0, 0);
          l.clearRect(0, 0, this.layer.width, this.layer.height);
        }
      }
    },

    // Advance one crack by `dist`, marking the grid and extending the line
    // path. Returns false when it hits another crack or the edge.
    grow(c, dist, bend, lines) {
      const n = Math.max(1, Math.ceil(dist / STEP));
      const s = dist / n;
      lines.moveTo(c.x, c.y);
      const gw = this.gw, gh = this.gh, grid = this.grid;
      for (let i = 0; i < n; i++) {
        // Bend fades with distance so a long crack across open paper settles
        // into a straight run instead of a frame-wide scythe arc.
        if (c.parent !== 0) c.a += c.curv * bend * s * Math.exp(-c.trav / 160);
        if (c.trav >= c.maxLen) return false;
        const nx = c.x + Math.cos(c.a) * s;
        const ny = c.y + Math.sin(c.a) * s;
        const ix = nx | 0, iy = ny | 0;
        if (nx < 0 || ny < 0 || ix >= gw || iy >= gh) {
          lines.lineTo(Math.max(0, Math.min(this.W, nx)), Math.max(0, Math.min(this.H, ny)));
          return false;
        }
        const idx = iy * gw + ix;
        const o = grid[idx];
        c.x = nx; c.y = ny; c.trav += s; this.genLen += s;
        if (o !== 0 && o !== c.serial) {
          // A fresh branch starts on its parent's line; let it clear it.
          if (!(o === c.parent && c.trav < 4)) { lines.lineTo(nx, ny); return false; }
        } else {
          grid[idx] = c.serial;
          this.gridAng[idx] = c.a;
        }
        lines.lineTo(nx, ny);
      }
      // Record a branch point now and then.
      if (Math.random() < 0.25) {
        const j = this.nPoints < MAX_POINTS ? this.nPoints++ : (Math.random() * MAX_POINTS) | 0;
        this.px[j] = c.x; this.py[j] = c.y; this.pa[j] = c.a; this.ps[j] = c.serial;
      }
      return true;
    },

    // Walk out from the crack on its sand side until the next crack (or the
    // reach limit), then lay grains along a random-walked fraction of that
    // gap, thinning away from the crack. Regions fill as their cracks pass.
    paintSand(c, paths, grainsBase, widthMul, maxReach) {
      const pa = c.a + c.side * Math.PI / 2;
      const dx = Math.cos(pa), dy = Math.sin(pa);
      const gw = this.gw, gh = this.gh, grid = this.grid;
      let d = 2;
      while (d < maxReach) {
        const x = c.x + dx * d, y = c.y + dy * d;
        if (x < 0 || y < 0 || x >= gw || y >= gh) break;
        const o = grid[(y | 0) * gw + (x | 0)];
        if (o !== 0 && o !== c.serial) break;
        d += 1.5;
      }
      c.g = Math.max(0.05, Math.min(1, c.g + rnd(-0.03, 0.03)));
      const span = d * Math.min(1, c.g * widthMul * 1.6);
      const grains = Math.round(grainsBase * (0.5 + Math.min(span, 160) / 70));
      if (grains < 1) return;
      const nt = TIERS.length;
      for (let i = 0; i < grains; i++) {
        const u = (i + Math.random()) / grains;
        const f = Math.sin(Math.sin(u * 1.2)) / 0.84;   // denser near the crack
        const x = c.x + dx * span * f, y = c.y + dy * span * f;
        paths[Math.min(nt - 1, (u * nt) | 0)].rect(x, y, 0.85, 0.85);
      }
    },
  });
})();
