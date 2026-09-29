// Relay (GSAP 2 of 5): the grid stagger as the subject. A wall of Bauhaus
// tiles (quarter circles, half moons, wedges, bars) pans slowly past, and
// every change travels across it as a wave: GSAP's stagger with `grid` and
// `from` gives each tile a start time by its distance from an origin (the
// centre, the edges, a corner, a random tile), so one tween becomes a front
// that sweeps the wall. A kick is a ripple of lifted tiles, a bar is a wave
// of quarter turns that reorganises the pattern, a clap is a patch of card
// flips. The pattern is the sum of every wave that has passed.
//
// Music, each in its own place:
//   kick   a ring of tiles lifts off the wall (with a cast shadow) and
//          settles, travelling out from a random tile: at any moment only
//          the ring moves
//   clap   a round patch of tiles card-flips, staggered from its centre, to
//          new faces
//   bar    a wave of quarter turns sweeps the whole wall from a new origin
//   hats   the grout studs between tiles glint
//   bass   the pan speeds up
//   drop   waves every bar and half-turns, the flips spread wide and bring
//          all four inks, the pan runs; the breakdown's flips go back to two
//
// How it is made: GSAP 3.14.2 (web/gsap-kit.js). Each wave is one gsap.to()
// over an array of plain objects (one per tile) with a grid stagger, in a
// paused timeline authored in beats and scrubbed by the beat clock; when it
// finishes it is baked into the tiles and killed. Tiles are Path2D motifs on
// the p5 canvas.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return x - Math.floor(x); };

  const PALETTES = [
    { name: 'Bauhaus', grout: '#CDC2AC', stud: '#8E826C', paper: '#F3ECDD', inks: ['#1F4E9E', '#D9412B', '#F1B42F', '#1B1B1B'] },
    { name: 'Pool', grout: '#9DC1BE', stud: '#4F7C7A', paper: '#EDF3EF', inks: ['#0F5E63', '#F07F5A', '#F2CB5C', '#20303A'] },
    { name: 'Plum', grout: '#3A2437', stud: '#7C5A73', paper: '#F2E3D5', inks: ['#7C2E62', '#E86A4E', '#F1C45B', '#2B8C83'] },
    { name: 'Blueprint', grout: '#152240', stud: '#3C5586', paper: '#203765', inks: ['#F4EBD9', '#E6603E', '#8DB6D9', '#F4C04E'] },
  ];

  // Motifs in a unit tile centred on the origin.
  function motifs() {
    const m = [];
    let q = new Path2D(); q.moveTo(-0.5, -0.5); q.arc(-0.5, -0.5, 1, 0, Math.PI / 2); q.closePath(); m.push(q);   // quarter
    q = new Path2D(); q.moveTo(-0.5, -0.5); q.arc(-0.5, 0, 0.5, -Math.PI / 2, Math.PI / 2); q.closePath(); m.push(q); // half moon
    q = new Path2D(); q.arc(0, 0, 0.34, 0, TAU); m.push(q);                                                     // dot
    q = new Path2D(); q.moveTo(-0.5, -0.5); q.lineTo(0.5, -0.5); q.lineTo(-0.5, 0.5); q.closePath(); m.push(q);   // wedge
    q = new Path2D(); q.moveTo(-0.5, -0.5); q.arc(-0.5, -0.5, 0.5, 0, Math.PI / 2); q.closePath();
    q.moveTo(0.5, 0.5); q.arc(0.5, 0.5, 0.5, Math.PI, Math.PI * 1.5); q.closePath(); m.push(q);                  // two quarters
    q = new Path2D(); q.rect(-0.5, -0.5, 1, 0.25); q.rect(-0.5, 0, 1, 0.25); m.push(q);                         // bars
    q = new Path2D(); q.arc(0.5, 0, 0.5, Math.PI / 2, Math.PI * 1.5); q.arc(-0.5, 0, 0.5, -Math.PI / 2, Math.PI / 2); q.closePath(); m.push(q); // lens
    return m;
  }

  // Tiles are laid in 2x2 rosettes (each quarter of a block mirrors its
  // neighbour), and motifs and inks are chosen per block or per region, so
  // the wall reads as a designed pattern rather than noise.
  const ROSETTE = [180, 270, 90, 0];
  const rosette = (ci, r) => ROSETTE[((r & 1) << 1) | (ci & 1)];

  // Where waves start. Named origins are GSAP's own; arrays are [x, y] as a
  // fraction of the grid.
  const ORIGINS = ['center', 'edges', 'start', 'end', [0, 1], [1, 0], [0.5, 0], [0.5, 1], 'random'];

  const PRESETS = {
    calm: { energy: 0, pan: 0.5, spread: 0.3 },
    drop: { energy: 1, pan: 1.6, spread: 1 },
    // Still wall, all four inks: for a bright, slow passage.
    mosaic: { energy: 0.6, pan: 0, spread: 1, palette: 0 },
  };
  const DRIVE = ['energy', 'pan', 'spread'];

  function bootGsap(p) {
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_GSAP ? Promise.resolve() : new Promise((res) => {
      const s = document.createElement('script'); s.src = 'gsap-kit.js'; s.onload = s.onerror = res; document.head.appendChild(s);
    });
    kit.then(() => (window.VIZ_GSAP ? window.VIZ_GSAP.load() : null)).then(() => { if (hold) p._decrementPreload(); });
  }

  VIZ.register({
    id: 'gsap2',
    name: 'Relay',
    order: 1107,
    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'energy', label: 'Drop', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'pan', label: 'Pan speed', type: 'range', min: 0, max: 2.5, default: 0.5, step: 0.01 },
      { key: 'spread', label: 'Flip spread', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'tile', label: 'Tile size', type: 'range', min: 40, max: 110, default: 84, step: 1 },
      { key: 'reaction', label: 'Kick lift', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    gallery: {
      title: 'Relay',
      technique: 'GSAP 3.14.2 grid staggers: every reaction is one gsap.to() over an array of per-tile plain objects with stagger { grid, from, each, ease }, in a paused timeline authored in beats and scrubbed by a phase-locked beat clock, baked into the tiles when it ends; back.out turns, power-eased card flips, yoyo lifts; tiles drawn as cached Path2D Bauhaus motifs on the p5 canvas',
      brief: 'A wall of Bauhaus tiles in two or four flat inks pans past like a title card that never ends. Nothing on it moves on its own: every change arrives as a wave. The kick lifts a ring of tiles off the wall, shadow and all, and it travels out from a random tile and settles; a clap card-flips a round patch to new faces; each bar sweeps a wave of quarter turns across the wall from a new origin (centre, edges, a corner), so the pattern keeps reorganising itself. Hats glint in the grout. In the drop the turns come every bar as half-turns, the flips spread wide and bring all four inks, and the wall runs faster.',
      lineage: 'Bauhaus and Truchet tile systems, After Effects grid-stagger title cards; GSAP\'s stagger object (grid, from, amount, ease), which computes each element\'s delay by distance from an origin, is the medium, and the piece is nothing but those waves.',
    },

    preload(p) { bootGsap(p); },
    setup() {},
    enter() {},

    build() {
      this.M = motifs();
      this.clock = window.VIZ_GSAP.createClock();
      this.cols = new Map();
      this.waves = [];
      this.panX = 0;
      this.lastBeat = null;
      this.lastSnareIdx = 0;
      this.gridKey = '';
      this.nFlip = 0;
      this.built = true;
    },

    // Tile data by absolute column, so the wall can pan forever.
    col(ci, rows) {
      let c = this.cols.get(ci);
      if (!c) {
        c = [];
        for (let r = 0; r < rows; r++) {
          const h = hash(Math.floor(ci / 4), Math.floor(r / 4)), h2 = hash(Math.floor(ci / 2) * 7.1, Math.floor(r / 2) * 3.3);
          c.push({ motif: Math.floor(h * 7) % 7, rot: rosette(ci, r), bg: 0, fg: h2 > 0.85 ? 2 : 1 });
        }
        this.cols.set(ci, c);
        // Forget columns long gone.
        if (this.cols.size > 400) { for (const k of this.cols.keys()) { if (k < ci - 200) this.cols.delete(k); } }
      }
      return c;
    },

    // A wave: one staggered tween over fresh plain objects, positioned in the
    // grid as it was when the wave began.
    wave(kind, pos, opts) {
      const gsap = window.gsap;
      const n = this.rows * this.nc;
      const vals = new Array(n);
      for (let i = 0; i < n; i++) vals[i] = { v: 0 };
      const tl = gsap.timeline({ paused: true });
      const grid = [this.rows, this.nc];
      if (kind === 'lift') {
        tl.to(vals, { v: 1, duration: 0.28, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.05,
          stagger: { grid, from: opts.from, each: 0.075 } });
      } else if (kind === 'turn') {
        tl.to(vals, { v: 1, duration: 0.5, ease: 'back.out(2.2)', stagger: { grid, from: opts.from, amount: opts.amount, ease: 'power1.in' } });
      } else {
        // Flip: only tiles within the patch take part; the rest get a zero
        // target through a function-based value.
        const R = opts.radius;
        tl.to(vals, { v: (i) => (opts.inPatch(i) ? 1 : 0), duration: 0.55, ease: 'power2.inOut',
          stagger: { grid, from: opts.from, each: 0.13 } });
      }
      tl.progress(1).progress(0);
      this.waves.push(Object.assign({ kind, tl, vals, start: pos, shift: this.shift }, opts));
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]);
      g.fillStyle = pal.grout; g.fillRect(0, 0, W, H);
      if (!window.VIZ_GSAP || !window.VIZ_GSAP.ready) { g.restore(); return; }
      if (!this.built) this.build();

      const t = p.millis() / 1000;
      const follow = Math.round(params.follow) === 1;
      const c = this.clock.update(signals, t, follow);
      const P = window.VIZ_GSAP.drive(params, PRESETS.drop, DRIVE, follow ? c.auto : 0);
      const E = clamp(P.energy, 0, 1);
      const pos = c.pos;

      // ---- grid geometry; a new size or aspect starts the wall afresh
      const cs = clamp(params.tile, 40, 110);
      const rows = Math.ceil(H / cs) + 1, nc = Math.ceil(W / cs) + 2;
      const key = rows + 'x' + nc + ':' + cs;
      if (key !== this.gridKey) {
        this.gridKey = key; this.rows = rows; this.nc = nc;
        this.waves.forEach((w) => w.tl.kill()); this.waves = [];
        this.cols.clear(); this.panX = 0;
      }
      this.panX += c.dt * P.pan * (0.35 + 0.9 * c.bass) * cs * 0.5;
      this.shift = Math.floor(this.panX / cs);
      const frac = this.panX / cs - this.shift;
      const y0 = (H - rows * cs) / 2;

      // ---- events on the beat grid and from the detector
      const bi = Math.floor(pos);
      if (this.lastBeat === null) this.lastBeat = bi;
      if (bi !== this.lastBeat) {
        this.lastBeat = bi;
        const every = E > 0.5 ? 4 : 8;
        if (((bi % every) + every) % every === 0) {
          const k = Math.floor(bi / every);
          const from = ORIGINS[((k % ORIGINS.length) + ORIGINS.length) % ORIGINS.length];
          // Off the kick: the front sets out on the "and" and takes a bar or
          // so to cross, so only a band of the wall is ever turning.
          this.wave('turn', bi + 0.5, { from, amount: lerp(3.6, 3, E), deg: E > 0.66 ? 180 : 90, dir: k % 2 ? 1 : -1 });
          if (E < 0.35) this.pendingCalm = { from };
        }
      }
      if (c.kick) {
        const fx = hash(c.kickCount, 1.7), fy = hash(c.kickCount, 9.2);
        this.wave('lift', pos, { from: [fx, fy] });
      }
      if (c.snare) {
        const n = ++this.nFlip;
        const fx = 0.15 + 0.7 * hash(n, 4.4), fy = 0.15 + 0.7 * hash(n, 8.8);
        const rad = lerp(1.6, 5, clamp(P.spread, 0, 1)) * (0.85 + 0.25 * E);
        const cxI = fx * (nc - 1), cyI = fy * (rows - 1);
        const inPatch = (i) => { const r = Math.floor(i / nc), cI = i % nc; return Math.hypot(cI - cxI, (r - cyI) * 1.1) < rad; };
        // New faces, chosen now: in the calm the two quiet inks, in the drop all four.
        const faces = this.faces(n, E, rows, nc);
        this.wave('flip', pos, { from: [fx, fy], inPatch, faces });
      }
      // The exhale: in the calm each bar's turn wave is followed by a sweep of
      // flips that returns any loud tile to the two quiet inks.
      if (this.pendingCalm) {
        const w = this.pendingCalm; this.pendingCalm = null;
        const loud = [];
        for (let r = 0; r < rows; r++) for (let cI = 0; cI < nc; cI++) {
          const tile = this.col(cI + this.shift, rows)[r];
          loud[r * nc + cI] = tile.bg !== 0 || tile.fg > 2;
        }
        if (loud.some(Boolean)) this.wave('flip', pos, { from: w.from, inPatch: (i) => loud[i], faces: this.faces(++this.nFlip, 0, rows, nc) });
      }

      // ---- scrub every wave; bake and drop the finished ones
      const live = [];
      for (const w of this.waves) {
        const lt = pos - w.start;
        w.tl.time(clamp(lt, 0, w.tl.duration()));
        if (lt >= w.tl.duration()) {
          if (w.kind !== 'lift') this.bake(w, rows, nc);
          w.tl.kill();
        } else live.push(w);
      }
      this.waves = live;

      // ---- the wall
      const ink = (i) => (i === 0 ? pal.paper : pal.inks[(i - 1) % 4]);
      const react = clamp(params.reaction, 0, 2);
      const gap = cs * 0.06;
      const shadow = 'rgba(20,16,10,0.28)';
      // Hats: studs in the grout.
      g.fillStyle = pal.stud;
      for (let r = 0; r <= rows; r++) {
        for (let cI = 0; cI <= nc; cI++) {
          const x = (cI - frac) * cs - cs, y = y0 + r * cs;
          const tw = hash(cI + this.shift, r * 3 + Math.floor(t * 10));
          const sz = gap * (0.45 + 1.4 * c.hat * tw * tw);
          g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
      const drawn = [];
      for (let cI = 0; cI < nc; cI++) {
        const ci = cI + this.shift;
        const col = this.col(ci, rows);
        for (let r = 0; r < rows; r++) {
          const tile = col[r];
          let rot = tile.rot, lift = 0, flipV = 0, face = null;
          for (const w of this.waves) {
            const wc = ci - w.shift;
            if (wc < 0 || wc >= nc) continue;
            const v = w.vals[r * nc + wc].v;
            if (w.kind === 'turn') rot += v * w.deg * w.dir;
            else if (w.kind === 'lift') lift = Math.max(lift, v);
            else if (v > 0) { flipV = v; face = w.faces[r * nc + wc]; }
          }
          drawn.push(cI, r, rot, lift * react, flipV, face, tile);
        }
      }
      // Shadows first, so a lifted tile's shadow falls on its neighbours.
      g.fillStyle = shadow;
      for (let i = 0; i < drawn.length; i += 7) {
        const lift = drawn[i + 3];
        if (lift <= 0.01) continue;
        const x = (drawn[i] - frac) * cs - cs * 0.5, y = y0 + drawn[i + 1] * cs + cs * 0.5;
        const s = (cs - gap) * (1 + 0.14 * lift), o = cs * 0.16 * lift;
        g.fillRect(x - s / 2 + o, y - s / 2 + o * 1.3, s, s);
      }
      for (let i = 0; i < drawn.length; i += 7) {
        const cI = drawn[i], r = drawn[i + 1], rot = drawn[i + 2], lift = drawn[i + 3], flipV = drawn[i + 4];
        let tile = drawn[i + 6];
        let rotD = rot;
        if (flipV > 0.5 && drawn[i + 5]) { tile = drawn[i + 5]; rotD = tile.rot; }
        const x = (cI - frac) * cs - cs * 0.5, y = y0 + r * cs + cs * 0.5;
        const s = (cs - gap) * (1 + 0.14 * lift);
        g.save();
        g.translate(x - cs * 0.05 * lift, y - cs * 0.07 * lift);
        // A card flip: squash to an edge and open again on the new face.
        const fx = flipV > 0 ? Math.max(0.02, Math.abs(Math.cos(flipV * Math.PI))) : 1;
        if (flipV > 0 && flipV < 1 && drawn[i + 5]) {
          // The slot under a turning card already shows the new face's
          // ground, as on a split-flap board, rather than the grout.
          g.fillStyle = ink(drawn[i + 5].bg);
          g.fillRect(-s / 2, -s / 2, s, s);
        }
        g.scale(s * fx, s);
        g.fillStyle = ink(tile.bg);
        g.fillRect(-0.5, -0.5, 1, 1);
        g.rotate(rotD * Math.PI / 180);
        g.fillStyle = ink(tile.fg);
        g.fill(this.M[tile.motif]);
        g.restore();
      }
      g.restore();
    },

    // New faces for a flip: one motif for the whole patch, laid as rosettes;
    // inks per 2x2 block. The calm keeps to two quiet inks, the drop uses all four.
    faces(n, E, rows, nc) {
      const out = [];
      const motif = Math.floor(hash(n, 0.5) * 7) % 7;
      for (let r = 0; r < rows; r++) for (let cI = 0; cI < nc; cI++) {
        const ci = cI + this.shift;
        const bx = Math.floor(ci / 2), by = Math.floor(r / 2);
        const h = hash(n * 13 + bx, by * 2.2), h2 = hash(bx * 1.3 + n, by * 5.1);
        let bg, fg;
        if (E > 0.4 && h2 < 0.8) { bg = Math.floor(h * 5); fg = (bg + 1 + Math.floor(h2 * 4 / 0.8)) % 5; }
        else { bg = 0; fg = h2 > 0.85 ? 2 : 1; }
        out.push({ motif: hash(bx, by + n) < 0.8 ? motif : (motif + 3) % 7, bg, fg, rot: rosette(ci, r) });
      }
      return out;
    },

    bake(w, rows, nc) {
      for (let cI = 0; cI < nc; cI++) {
        const ci = cI + w.shift;
        const col = this.cols.get(ci);
        if (!col) continue;
        for (let r = 0; r < rows; r++) {
          const v = w.vals[r * nc + cI].v;
          const tile = col[r];
          if (w.kind === 'turn') tile.rot = (tile.rot + Math.round(v) * w.deg * w.dir) % 360;
          else if (v > 0.5) { const f = w.faces[r * nc + cI]; tile.motif = f.motif; tile.bg = f.bg; tile.fg = f.fg; tile.rot = f.rot; }
        }
      }
    },
  });
})();
