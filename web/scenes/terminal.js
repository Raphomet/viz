// Terminal — a 3D world rendered in characters on a phosphor CRT.
//
// Two scenes share one text screen. Away from the drop we fly down a twisting
// tunnel whose cross-section slowly morphs (circle, squircle, square), chasing
// a spinning ASCII torus that hangs in the vanishing point (a nod to donut.c).
// When the drop lands the landscape rises through the text in a ragged wipe:
// a canyon of contour-lined mountains under a starfield, the torus now a moon,
// and the mono phosphor gives way to colour. The breakdown folds back into the
// tunnel.
//
// How it is drawn: the 3D is sampled on the CPU once per character cell (a
// ~140×44 grid at the default glyph size, so ~6k samples a frame whatever the
// canvas size) into a luminance/colour grid. Each cell is then one drawImage
// from a glyph atlas pre-rendered per colour, bucketed by alpha so the canvas
// state changes a handful of times a frame, not thousands. Persistence is the
// glyph canvas fading instead of clearing; bloom is two cheap downscales added
// back; scanlines and the vignette are pre-rendered overlays.
//
// Music, kept local (Raph, 2026-09-28: whole-screen changes on every beat are
// jarring): the kick flares the torus and sends one ring of light down the
// tunnel wall, or across the canyon floor; the snare tears two to four rows
// sideways into katakana in a complementary colour; each hat types one
// character of the command at the prompt and flicks a few cells white; the
// bass sets the flight speed and swells the terrain.
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
  function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }

  // ------------------------------------------------------------ glyphs
  // Brightness ramp, dark to bright. Chosen for even steps of ink in a
  // monospace face, and ending on glyphs that read as solid at a distance.
  const RAMP = ' .`:-=+*cxoO#%@';
  const KATA = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
  const BLOCKS = '░▒▓█▌▐▀▄';
  let GLYPHS = '';
  for (let c = 32; c < 127; c++) GLYPHS += String.fromCharCode(c);
  const KATA0 = GLYPHS.length; GLYPHS += KATA;
  const BLOCK0 = GLYPHS.length; GLYPHS += BLOCKS;
  const RAMP_IDX = Array.from(RAMP, (ch) => ch.charCodeAt(0) - 32);
  const NR = RAMP_IDX.length;

  // ------------------------------------------------------------ colours
  const PHOS = [
    { name: 'Amber', rgb: [255, 168, 36], glitch: [40, 225, 255] },
    { name: 'Green', rgb: [70, 255, 120], glitch: [255, 70, 200] },
    { name: 'Ice', rgb: [120, 200, 255], glitch: [255, 150, 40] },
  ];
  // Drop palettes: ordered gradients, read by height and sky position, so the
  // colour has a structure (valleys cool, peaks warm) instead of cycling.
  const DROP = [
    [[50, 24, 140], [120, 34, 210], [220, 44, 180], [255, 70, 100], [255, 135, 40], [255, 205, 70], [130, 255, 200], [70, 200, 255]],
    [[20, 70, 160], [20, 150, 210], [30, 225, 190], [130, 255, 120], [225, 255, 90], [255, 180, 60], [255, 90, 150], [190, 80, 255]],
    [[90, 20, 120], [200, 30, 120], [255, 80, 60], [255, 160, 40], [255, 230, 120], [120, 240, 255], [60, 140, 255], [140, 90, 255]],
  ];
  const ND = DROP[0].length;
  // Atlas rows: 0-2 phosphor, 3-5 phosphor hot, 6-8 glitch, 9 white, then drop.
  const ROW_HOT = 3, ROW_GLITCH = 6, ROW_WHITE = 9, ROW_DROP = 10;
  const NROWS = ROW_DROP + DROP.length * ND;
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const PROMPT = 'raph@viz:~$ ';
  const COMMANDS = [
    './fly --through tunnel',
    'render --ascii torus.obj',
    'cat /dev/bass > /dev/eyes',
    'tail -f /var/log/kick',
    'ping -c 4 moon',
    'ssh dancefloor',
    'while true; do dance; done',
    'sudo make it --louder',
    'echo $FEELING | tee /dev/room',
    'top -o bpm',
  ];

  // ------------------------------------------------------------ terrain
  // A tileable fBm table sampled bilinearly: the canyon costs a few table
  // reads per march step instead of noise evaluations.
  const TN = 256;
  const terrain = new Float32Array(TN * TN);
  (function buildTerrain() {
    // Periodic value noise, five octaves of 8..128 lattice cells across the
    // table, so the land wraps without a seam.
    const lat = [];
    for (let o = 0; o < 5; o++) {
      const m = 8 << o;
      const a = new Float32Array(m * m);
      for (let i = 0; i < a.length; i++) a[i] = Math.random();
      lat.push({ m, a });
    }
    for (let y = 0; y < TN; y++) {
      for (let x = 0; x < TN; x++) {
        let h = 0, amp = 0.55, tot = 0;
        for (let o = 0; o < lat.length; o++) {
          const { m, a } = lat[o];
          const gx = x / TN * m, gy = y / TN * m;
          const ix = Math.floor(gx), iy = Math.floor(gy);
          let tx = gx - ix, ty = gy - iy;
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          const i0 = ix % m, i1 = (ix + 1) % m, j0 = iy % m, j1 = (iy + 1) % m;
          const v = (a[j0 * m + i0] * (1 - tx) + a[j0 * m + i1] * tx) * (1 - ty) +
                    (a[j1 * m + i0] * (1 - tx) + a[j1 * m + i1] * tx) * ty;
          // Ridged in the low octaves so the skyline has crests, not blobs.
          const r = o < 2 ? 1 - Math.abs(v * 2 - 1) : v;
          h += r * amp; tot += amp; amp *= 0.5;
        }
        terrain[y * TN + x] = h / tot;
      }
    }
  })();
  function terr(x, z) {
    x = x - Math.floor(x / TN) * TN; z = z - Math.floor(z / TN) * TN;
    const ix = x | 0, iz = z | 0, tx = x - ix, tz = z - iz;
    const x1 = (ix + 1) & (TN - 1), z1 = (iz + 1) & (TN - 1);
    const a = terrain[iz * TN + ix], b = terrain[iz * TN + x1];
    const c = terrain[z1 * TN + ix], d = terrain[z1 * TN + x1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  // The flight path winds, and the canyon is carved along it.
  const pathX = (z) => 7 * Math.sin(z * 0.043) + 3.2 * Math.sin(z * 0.117 + 1.3);
  const pathDX = (z) => 7 * 0.043 * Math.cos(z * 0.043) + 3.2 * 0.117 * Math.cos(z * 0.117 + 1.3);
  const pathDDX = (z) => -7 * 0.043 * 0.043 * Math.sin(z * 0.043) - 3.2 * 0.117 * 0.117 * Math.sin(z * 0.117 + 1.3);

  VIZ.register({
    id: 'terminal',
    name: 'Terminal',
    order: 310,

    params: [
      { key: 'scene', label: 'Scene', type: 'select', options: ['Follow the music', 'Tunnel', 'Canyon'], default: 0 },
      { key: 'phosphor', label: 'Phosphor', type: 'select', options: PHOS.map((c) => c.name), default: 0 },
      { key: 'glyph', label: 'Glyph size', type: 'range', min: 0.6, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'colour', label: 'Drop colour', type: 'range', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1.5, default: 0.7, step: 0.01 },
      { key: 'persist', label: 'Persistence', type: 'range', min: 0, max: 0.9, default: 0.45, step: 0.01 },
      { key: 'response', label: 'Music response', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    gallery: {
      title: 'Terminal',
      technique: 'CPU ray-sampled tunnel, heightfield canyon and torus into a character grid; glyphs blitted from a per-colour atlas onto a fading phosphor canvas with downscaled bloom, scanlines and vignette',
      brief: 'A phosphor terminal flying through a 3D world drawn in text. A twisting tunnel whose cross-section morphs chases an ASCII torus in the vanishing point; in the drop a canyon of contour-lined mountains rises through the characters under stars, the torus becomes the moon and the amber turns to colour. The kick flares the torus and sends one ring of light down the tunnel or across the canyon floor; the snare tears a few rows sideways into katakana; every hat types one character of the command at the prompt and flicks a few cells white; the bass sets the flight speed and swells the mountains.',
      lineage: [
        'Brief 03 · 10 (Terminal): a 3D scene in characters on a phosphor terminal; kicks brighten one region, the snare glitches rows into other character sets, hats flicker single characters, the drop switches scene and adds colour. Nods to donut.c and to Raph\'s 2016 Dot Matrix (text as light) and Flyover Night drive (the canyon under stars).',
        'Built as a CPU sample per character cell (about 140x44 at the default glyph size, independent of canvas size) into a luminance/colour grid, then one drawImage per cell from a glyph atlas pre-rendered per colour, bucketed into four alpha passes. Persistence by fading the glyph canvas; bloom from two downscales added back; scanlines and vignette pre-rendered.',
        'First render (640x360): the tunnel was a flat wall of mid-bright glyphs, the canyon a tilted ramp seen from inside it, the kick\'s floor ring a big white slab. Rebuilt the tunnel as dim panels framed by glowing seams, lifted the canyon camera above the ridges with a slight downward pitch, cut the bank roll to 8 degrees, narrowed the ring.',
        'The canyon and its colour stayed through most of the breakdown because the scene followed a slow energy envelope; it now leaves once the kick has been gone 2.6 s and the colour drains after 2 s, so the breakdown folds back into the amber tunnel.',
        'The build\'s snare roll tore half the screen, so glitch bands are capped at two at a time.',
        'At 1280x720 the fixed-width seams went sub-glyph and dissolved into dots; seam widths now scale with depth so each is about a glyph wide, which turned the tunnel into a clean wireframe in the dark. Dimmed the walls right beside the camera (lamps rushing past lit a quarter of the screen) and added a layer of dust streaming past for speed.',
        'Final jolt (640x360, seed 1): drop kickArea 0.17, kickMean 0.040, driftMean 0.026, ratio 1.55, calm; the heat map shows the kick as a hot spot on the torus plus a thin ring on the floor. Build kick 0.45 area, ratio 1.84, mostly the tunnel\'s own rush. Checked with a 96 s run at 1280x720.',
      ],
    },

    env: null,
    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.env = { kick: 0, bass: 0, snare: 0, hat: 0, avg0: 0, energy: 0 };
      this.kickArmed = true; this.snareArmed = true; this.hatArmed = true;
      this.Z = 0; this.LZ = 40; this.rotA = 0; this.rotB = 0;
      this.sceneMix = 0; this.sceneTarget = 0;
      this.colourMix = 0; this.dropCount = 0;
      this.pulses = []; this.glitches = []; this.flicks = [];
      this.cmd = 0; this.typed = 0; this.hold = 0; this.history = [];
      this.torusFlare = 0; this.sinceKick = 99;
      this.lastT = null;
    },

    listen(sig, dt) {
      const e = this.env;
      const kRaw = clamp01((sig[0] - 42) / 48);
      e.kick = kRaw > e.kick ? ease(e.kick, kRaw, 45, dt) : ease(e.kick, kRaw, 9, dt);
      let kickHit = false;
      if (this.kickArmed && kRaw > 0.5) { kickHit = true; this.kickArmed = false; }
      if (kRaw < 0.2) this.kickArmed = true;
      e.bass = ease(e.bass, (sig[1] + sig[2]) / 200, 3, dt);
      e.avg0 = ease(e.avg0, sig[0] / 100, 0.9, dt);
      const eT = clamp01((e.avg0 - 0.06) * 3.6);
      e.energy = ease(e.energy, eT, eT > e.energy ? 0.9 : 0.4, dt);
      const sRaw = clamp01((Math.max(sig[4], sig[5] * 1.15) - 38) / 42);
      e.snare = sRaw > e.snare ? sRaw : ease(e.snare, sRaw, 7, dt);
      let snareHit = false;
      if (this.snareArmed && sRaw > 0.45) { snareHit = true; this.snareArmed = false; }
      if (sRaw < 0.25) this.snareArmed = true;
      const hRaw = clamp01((sig[7] + sig[8]) / 170);
      e.hat = hRaw > e.hat ? hRaw : ease(e.hat, hRaw, 10, dt);
      let hatHit = false;
      if (this.hatArmed && hRaw > 0.38) { hatHit = true; this.hatArmed = false; }
      if (hRaw < 0.22) this.hatArmed = true;
      return { kickHit, snareHit, hatHit, hRaw };
    },

    canvas(name, w, h) {
      this.bufs = this.bufs || {};
      let b = this.bufs[name];
      if (!b) { const c = document.createElement('canvas'); b = this.bufs[name] = { c, g: c.getContext('2d') }; }
      if (b.c.width !== w || b.c.height !== h) { b.c.width = w; b.c.height = h; b.fresh = true; }
      return b;
    },

    // One row per colour, one column per glyph, at the device cell size.
    buildAtlas(cw, ch) {
      const key = cw + 'x' + ch;
      if (this.atlasKey === key) return;
      this.atlasKey = key;
      const b = this.canvas('atlas', cw * GLYPHS.length, ch * NROWS);
      const g = b.g;
      g.clearRect(0, 0, b.c.width, b.c.height);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = Math.round(ch * 0.9) + 'px Menlo, "DejaVu Sans Mono", Consolas, monospace';
      const rows = [];
      for (const c of PHOS) rows.push(c.rgb);
      for (const c of PHOS) rows.push(mixc(c.rgb, [255, 250, 235], 0.55));
      for (const c of PHOS) rows.push(c.glitch);
      rows.push([250, 250, 255]);
      for (const pal of DROP) for (const c of pal) rows.push(c);
      for (let r = 0; r < rows.length; r++) {
        const c = rows[r];
        g.fillStyle = 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
        for (let i = 0; i < GLYPHS.length; i++) {
          const ch0 = GLYPHS[i];
          if (ch0 === '█') { g.fillRect(i * cw, r * ch, cw, ch); continue; }
          g.fillText(ch0, i * cw + cw / 2, r * ch + ch / 2 + ch * 0.04);
        }
      }
    },

    // ---------------------------------------------------------- the tunnel
    // Screen point (x, y) in units of half the short side. Returns luminance
    // into this.sL, a 0-1 colour coordinate into this.sC.
    tunnel(x, y, T) {
      const F = 1.7;
      // Fixed-point on depth: the axis bends away with the path, so where a
      // wall point lands on screen depends on its own depth.
      let d = F / Math.max(0.05, Math.sqrt(x * x + y * y));
      let dx = x, dy = y;
      for (let k = 0; k < 2; k++) {
        const ox = T.bx * d * d / (1 + 0.012 * d * d * d), oy = T.by * d * d / (1 + 0.012 * d * d * d);
        dx = x - ox / d * F; dy = y - oy / d * F;
        const cr = Math.cos(T.roll), sr = Math.sin(T.roll);
        const rx = dx * cr - dy * sr, ry = dx * sr + dy * cr;
        const n = T.shape;
        const r = Math.pow(Math.pow(Math.abs(rx), n) + Math.pow(Math.abs(ry), n), 1 / n);
        d = F / Math.max(0.03, r);
        dx = rx; dy = ry;
      }
      if (d > 60) { this.sL = 0; this.sC = 0; return; }
      const v = T.Z + d;
      const ang = Math.atan2(dy, dx) / TAU + d * T.twist;
      const u = ang * T.segs;
      const fu = u - Math.floor(u), fv = v * 0.5 - Math.floor(v * 0.5);
      // Panels with dark grout, a lit seam down the middle of every other
      // panel, and lamps every 9 units that the camera rushes past.
      // Dim panels framed by glowing seams: in text, lit edges carry the 3D
      // far better than shaded surfaces, which all collapse to one glyph.
      const eu = Math.min(fu, 1 - fu), ev = Math.min(fv, 1 - fv);
      // Seam widths scale with depth so every seam is about a glyph wide on
      // screen; fixed widths went sub-glyph at 720p and dissolved into dots.
      const wu = eu / (0.018 * d + 0.012), wv = ev / Math.min(0.22, 0.006 * d * d + 0.012);
      const seam = Math.max(Math.exp(-wu * wu), 0.85 * Math.exp(-wv * wv));
      const panel = 0.04 + 0.1 * hash2(Math.floor(u) & 63, Math.floor(v * 0.5)) * (0.6 + 0.4 * Math.sin(v * 0.4 + ang * TAU * 2 + T.t * 0.7));
      let L = panel + 0.62 * seam;
      const lampPh = v / 9 - Math.floor(v / 9);
      L += 0.9 * Math.exp(-Math.pow((lampPh - 0.5) * 26, 2)) * (0.45 + 0.55 * Math.cos(ang * TAU * 3));
      // The kick's rings travel toward the camera along the wall.
      for (let i = 0; i < this.pulses.length; i++) {
        const pu = this.pulses[i];
        const w = (d - pu.d) * 1.6;
        L += pu.a * 1.4 * Math.exp(-w * w);
      }
      // Walls right beside the camera are held back a little: lamps rushing
      // past at full strength lit a quarter of the screen at a time.
      L *= (0.45 + 0.7 * T.glow) * Math.exp(-d * 0.12) * (0.55 + 0.45 * smooth(0.7, 2.2, d));
      this.sL = L;
      this.sC = clamp01(0.15 + 0.12 * Math.sin(v * 0.25) + ang * 0.25 + 0.5 * Math.exp(-d * 0.2));
    },

    // ---------------------------------------------------------- the canyon
    canyonH(x, z, amp) {
      const px = pathX(z);
      const side = Math.abs(x - px);
      const walls = smooth(1.2, 7, side);
      return (terr(x * 2.6, z * 2.6) * (0.2 + 1.2 * walls) + walls * 0.8) * amp;
    },

    canyon(x, y, C) {
      // Camera frame: roll then yaw, from the path's bend.
      let rx = x, ry = -y + C.pitch, rz = 1.5;
      const il = 1 / Math.sqrt(rx * rx + ry * ry + rz * rz);
      rx *= il; ry *= il; rz *= il;
      const tx = rx * C.cr - ry * C.sr; ry = rx * C.sr + ry * C.cr; rx = tx;
      const tz = rz * C.cy - rx * C.sy; rx = rz * C.sy + rx * C.cy; rz = tz;
      let t = 0.2, hit = false, h = 0, px = 0, py = 0, pz = 0;
      for (let i = 0; i < 64; i++) {
        px = C.x + rx * t; py = C.y + ry * t; pz = C.z + rz * t;
        h = this.canyonH(px, pz, C.amp);
        const gap = py - h;
        if (gap < 0.004 * t) { hit = true; break; }
        t += Math.max(0.03, gap * 0.45) + t * 0.004;
        if (t > 48) break;
      }
      if (!hit) {
        // Sky: a haze band on the horizon and stars fixed to the heading.
        const el = ry;
        const az = Math.atan2(rx, rz);
        const sx = Math.floor(az * 70), sy = Math.floor(el * 70);
        const s = hash2(sx, sy);
        let L = 0.3 * Math.exp(-Math.max(0, el) * 12);
        if (s > 0.982) L += (0.35 + 0.6 * hash(s * 91)) * (0.6 + 0.4 * Math.sin(C.t * (1 + 4 * hash(s * 7)) + s * 50));
        this.sL = L;
        this.sC = clamp01(0.7 + 0.3 * Math.min(1, Math.max(0, el) * 3));
        return;
      }
      const e = 0.06;
      const hx = this.canyonH(px + e, pz, C.amp) - h, hz = this.canyonH(px, pz + e, C.amp) - h;
      let nx = -hx / e, ny = 1, nz = -hz / e;
      const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= nl; ny *= nl; nz *= nl;
      const diff = Math.max(0, nx * -0.55 + ny * 0.62 + nz * 0.55);
      const hn = h / (C.amp * 2.1);
      // Topographic contours at fixed heights; as the bass swells the land
      // they slide up and down the slopes.
      const cv = h * 3.2 - Math.floor(h * 3.2);
      const contour = Math.exp(-Math.pow((cv - 0.5) * 9, 2));
      let L = (0.12 + 0.75 * diff) * (0.5 + 0.5 * hn) + 0.55 * contour;
      // The kick's ring runs out across the land from the camera.
      for (let i = 0; i < this.pulses.length; i++) {
        const pu = this.pulses[i];
        const w = (t - pu.r) * 5;
        L += pu.a * 0.9 * Math.exp(-w * w);
      }
      const fog = Math.exp(-t * 0.055);
      L = L * fog + 0.3 * (1 - fog) * 0.4;
      this.sL = L;
      this.sC = clamp01(hn * 0.72 + contour * 0.12);
    },

    // ---------------------------------------------------------- the torus
    // Sphere-traced in its own little box; returns -1 where it misses.
    torus(x, y, O) {
      const qx = (x - O.cx) / O.s, qy = (y - O.cy) / O.s;
      if (qx * qx + qy * qy > 2.2) return -1;
      let ox = 0, oy = 0, oz = -3.4;
      let dx = qx * 0.9, dy = qy * 0.9, dz = 2.6;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= il; dy *= il; dz *= il;
      const M = O.m;
      let t = 0;
      for (let i = 0; i < 28; i++) {
        const wx = ox + dx * t, wy = oy + dy * t, wz = oz + dz * t;
        const lx = M[0] * wx + M[1] * wy + M[2] * wz;
        const ly = M[3] * wx + M[4] * wy + M[5] * wz;
        const lz = M[6] * wx + M[7] * wy + M[8] * wz;
        const q = Math.sqrt(lx * lx + lz * lz) - 1;
        const dist = Math.sqrt(q * q + ly * ly) - 0.44;
        if (dist < 0.004) {
          const rl = Math.sqrt(lx * lx + lz * lz) || 1;
          let nx = lx - lx / rl, ny = ly, nz = lz - lz / rl;
          const nl2 = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
          nx *= nl2; ny *= nl2; nz *= nl2;
          // Back to world for lighting.
          const Wx = M[0] * nx + M[3] * ny + M[6] * nz;
          const Wy = M[1] * nx + M[4] * ny + M[7] * nz;
          const Wz = M[2] * nx + M[5] * ny + M[8] * nz;
          const diff = Math.max(0, Wx * -0.5 + Wy * -0.6 + Wz * -0.62);
          const spec = Math.pow(Math.max(0, Wx * -0.3 + Wy * -0.5 + Wz * -0.81), 18);
          const band = Math.atan2(lz, lx) * 6 / TAU;
          const stripe = 0.8 + 0.2 * Math.cos((band - Math.floor(band)) * TAU);
          this.tC = clamp01(0.5 + 0.5 * Math.sin(Math.atan2(ly, q) + O.t * 0.3));
          // Ambient and a rim term keep the shadowed side in glyphs: a dark
          // underside read as holes punched in the tunnel behind it.
          const rim = Math.pow(1 - Math.abs(Wz), 3);
          return (0.22 + 0.7 * diff * stripe + 0.6 * spec + 0.35 * rim) * O.gain;
        }
        t += dist * 0.9;
        if (t > 6) break;
      }
      return -1;
    },

    draw(p, signals, params, ctx) {
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      const hits = this.listen(signals, dt);
      this.sinceKick = hits.kickHit ? 0 : (this.sinceKick || 0) + dt;
      const e = this.env;
      const react = params.response;
      const phos = params.phosphor | 0;

      // ---- scene choice: the drop switches to the canyon
      const mode = params.scene | 0;
      if (mode === 0) {
        // In on the drop's energy, out as soon as the kick has been gone for
        // a few beats: waiting for the slow energy to drain kept the canyon
        // (and its colour) through most of the breakdown, which then failed
        // to exhale.
        if (e.energy > 0.45 && this.sceneTarget === 0 && this.sinceKick < 1) { this.sceneTarget = 1; this.dropCount++; }
        if (this.sinceKick > 2.6) this.sceneTarget = 0;
      } else this.sceneTarget = mode - 1;
      this.sceneMix = ease(this.sceneMix, this.sceneTarget, 1.8, dt);
      if (Math.abs(this.sceneMix - this.sceneTarget) < 0.002) this.sceneMix = this.sceneTarget;
      this.colourMix = ease(this.colourMix, (this.sinceKick < 2 ? clamp01(e.energy * 2 - 0.2) : 0) * params.colour, 1.5, dt);
      const pal = (this.dropCount + DROP.length - 1) % DROP.length;

      // ---- motion: the music changes speed, never position
      const spd = params.speed * (0.8 + 1.3 * e.bass * react + 0.9 * e.energy);
      this.Z += dt * 3.2 * spd;
      this.LZ += dt * 2.6 * spd;
      this.rotA += dt * (0.55 + 2.2 * e.kick * react);
      this.rotB += dt * (0.31 + 0.9 * e.kick * react);
      this.torusFlare = Math.max(this.torusFlare * Math.exp(-7 * dt), hits.kickHit ? 1 : 0);

      if (hits.kickHit) this.pulses.push({ d: 16, r: 5, a: 1 });
      for (const pu of this.pulses) { pu.d -= dt * 26; pu.r += dt * 22; pu.a *= Math.exp(-2.4 * dt); }
      this.pulses = this.pulses.filter((pu) => pu.d > 1.2 && pu.a > 0.05);

      // ---- grid geometry, in device pixels
      const dc = p.drawingContext;
      const Wd = dc.canvas.width, Hd = dc.canvas.height;
      const short = Math.min(Wd, Hd);
      const ch = Math.max(6, Math.round(short / (44 / params.glyph)));
      const cw = Math.max(4, Math.round(ch * 0.56));
      const cols = Math.ceil(Wd / cw), rows = Math.ceil(Hd / ch);
      this.buildAtlas(cw, ch);
      const atlas = this.bufs.atlas.c;
      const n = cols * rows;
      if (!this.L || this.L.length !== n) {
        this.L = new Float32Array(n); this.C = new Float32Array(n); this.K = new Uint8Array(n);
      }
      const Lg = this.L, Cg = this.C, Kg = this.K;
      const unit = short / 2;

      // ---- per-scene frame state
      const t = now;
      const T = {
        Z: this.Z, t,
        bx: 0.045 * Math.sin(t * 0.13), by: 0.03 * Math.sin(t * 0.09 + 1),
        roll: 0.25 * Math.sin(t * 0.07) + t * 0.05,
        // The cross-section breathes between circle (2) and a near-square (5).
        shape: 2 + 3 * (0.5 - 0.5 * Math.cos(t * 0.05)),
        twist: 0.028 * Math.sin(t * 0.031 + 0.8),
        segs: 12 + 4 * Math.round(1 + Math.sin(t * 0.021)),
        glow: 0.5 + 0.6 * e.bass * react,
      };
      const yaw = Math.atan(pathDX(this.LZ));
      const roll = Math.max(-0.14, Math.min(0.14, -pathDDX(this.LZ) * 5));
      const camX = pathX(this.LZ);
      const C = {
        x: camX, z: this.LZ, t,
        y: 2.9 + 0.4 * Math.sin(t * 0.11),
        amp: 1.25 * (0.85 + 0.45 * e.bass * react + 0.2 * e.energy),
        pitch: -0.2,
        cr: Math.cos(roll), sr: Math.sin(roll), cy: Math.cos(yaw), sy: Math.sin(yaw),
      };
      // Torus: centred in the tunnel's vanishing point, a moon over the canyon.
      const m = this.sceneMix;
      const ca = Math.cos(this.rotA), sa = Math.sin(this.rotA), cb = Math.cos(this.rotB), sb = Math.sin(this.rotB);
      const O = {
        cx: (Math.sin(t * 0.13) * 0.06) * (1 - m) + (0.55 * Wd / short) * m,
        cy: (Math.sin(t * 0.09 + 1) * 0.04) * (1 - m) + (-0.52) * m,
        s: (0.3 + 0.025 * this.torusFlare * react) * (1 - m) + 0.24 * m,
        gain: 0.75 + 0.8 * this.torusFlare * react + 0.2 * e.bass,
        m: [cb, sb * sa, sb * ca, 0, ca, -sa, -sb, cb * sa, cb * ca], t,
      };
      // (rotation: Rx(A) then Ry(B), written out)

      // ---- sample the world into the grid
      let k = 0;
      for (let j = 0; j < rows; j++) {
        const y = ((j + 0.5) * ch - Hd / 2) / unit;
        const rowN = j / rows;
        for (let i = 0; i < cols; i++, k++) {
          const x = ((i + 0.5) * cw - Wd / 2) / unit;
          let L, Cc;
          // Ragged wipe: the canyon rises from the bottom through the text.
          const useB = m >= 1 ? true : m <= 0 ? false : (0.55 * hash2(i, j) + 0.45 * (1 - rowN)) < m * 1.25 - 0.1;
          if (useB) { this.canyon(x, y, C); } else { this.tunnel(x, y, T); }
          L = this.sL; Cc = this.sC; let kind = 0;
          const tv = this.torus(x, y, O);
          if (tv >= 0) { L = tv; Cc = this.tC; kind = 1; }
          Lg[k] = L; Cg[k] = Cc; Kg[k] = kind;
        }
      }

      // ---- dust streaming past the camera down the tunnel: a foreground
      // layer that makes the speed felt between the lamps
      if (!this.dust) {
        this.dust = [];
        for (let q = 0; q < 140; q++) this.dust.push({ x: (Math.random() * 2 - 1) * 0.85, y: (Math.random() * 2 - 1) * 0.85, z: 0.4 + Math.random() * 20 });
      }
      const dustVis = 1 - m;
      for (const d0 of this.dust) {
        d0.z -= dt * 3.2 * spd;
        if (d0.z < 0.35) { d0.z += 20; d0.x = (Math.random() * 2 - 1) * 0.85; d0.y = (Math.random() * 2 - 1) * 0.85; }
        if (dustVis <= 0.01) continue;
        const sx = 1.7 * d0.x / d0.z, sy = 1.7 * d0.y / d0.z;
        const ci = Math.floor((sx * unit + Wd / 2) / cw), cj = Math.floor((sy * unit + Hd / 2) / ch);
        if (ci < 0 || cj < 0 || ci >= cols || cj >= rows) continue;
        const kk = cj * cols + ci;
        if (Kg[kk] === 1) continue;
        const b = Math.min(1.05, 1.6 / (0.6 + d0.z)) * dustVis;
        if (b > Lg[kk]) { Lg[kk] = b; Cg[kk] = 0.9; }
      }

      // ---- snare: a few rows tear sideways into another character set
      // Capped, so the build's snare roll tears a row or two, not the screen.
      if (hits.snareHit && this.glitches.length < 2) {
        const cnt = e.energy > 0.5 ? 2 : 1;
        for (let q = 0; q < cnt; q++) {
          const h0 = 2 + Math.floor(Math.random() * 3);
          this.glitches.push({ row: Math.floor(Math.random() * (rows - h0 - 1)), h: h0,
            shift: Math.round((Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 10)), life: 1, seed: Math.random() * 100 });
        }
      }
      for (const g of this.glitches) g.life -= dt * 3.2;
      this.glitches = this.glitches.filter((g) => g.life > 0);
      const glitchOf = new Int16Array(rows).fill(-1);
      this.glitches.forEach((g, gi) => { for (let r = g.row; r < g.row + g.h && r < rows; r++) glitchOf[r] = gi; });

      // ---- hats: flick cells white, and type at the prompt
      const nFlick = hits.hatHit ? Math.round(10 + 22 * e.energy) : 0;
      for (let q = 0; q < nFlick * react; q++) {
        this.flicks.push({ k: Math.floor(Math.random() * n), life: 1, g: RAMP_IDX[NR - 1 - Math.floor(Math.random() * 5)] });
      }
      for (const f of this.flicks) f.life -= dt * 7;
      this.flicks = this.flicks.filter((f) => f.life > 0);
      if (hits.hatHit && this.hold <= 0) this.typed++;
      const cmdText = COMMANDS[this.cmd % COMMANDS.length];
      if (this.typed >= cmdText.length) {
        this.hold += dt;
        if (this.hold > 1.2) { this.history.push(PROMPT + cmdText); this.cmd++; this.typed = 0; this.hold = 0; }
      }
      if (this.history.length > 2) this.history.shift();

      // ---- phosphor: fade instead of clear, then blit the glyphs
      const scr = this.canvas('scr', Wd, Hd);
      const sg = scr.g;
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.globalCompositeOperation = 'source-over';
      sg.globalAlpha = 1;
      sg.fillStyle = scr.fresh ? '#000' : 'rgba(0,0,0,' + (1 - params.persist).toFixed(3) + ')';
      sg.fillRect(0, 0, Wd, Hd);
      scr.fresh = false;
      const ALPHAS = [0.45, 0.65, 0.85, 1];
      const colourMix = this.colourMix;
      const frameSeed = Math.floor(t * 12);
      for (let pass = 0; pass < 4; pass++) {
        sg.globalAlpha = ALPHAS[pass];
        k = 0;
        for (let j = 0; j < rows; j++) {
          const gi = glitchOf[j];
          const gl = gi >= 0 ? this.glitches[gi] : null;
          const yy = j * ch;
          for (let i = 0; i < cols; i++, k++) {
            let src = k, L;
            if (gl) {
              let si = i - gl.shift;
              si = ((si % cols) + cols) % cols;
              src = j * cols + si;
            }
            L = Lg[src] * (1 + 0.0 * react);
            if (L < 0.03) continue;
            const lv = L > 1 ? 1 : L;
            const ab = Math.min(3, Math.floor(lv * 4.2));
            if (ab !== pass) continue;
            let gIdx, row;
            if (gl) {
              gIdx = hash2(i + frameSeed, j + gl.seed) < 0.8 ? KATA0 + Math.floor(hash2(i * 3 + frameSeed, j) * KATA.length)
                : BLOCK0 + Math.floor(lv * 3.99);
              row = ROW_GLITCH + phos;
            } else {
              gIdx = RAMP_IDX[Math.min(NR - 1, Math.round(lv * (NR - 1)))];
              if (gIdx === 0) continue;
              const colourCell = colourMix > 0 && hash2(i * 1.7, j * 2.3) < colourMix;
              if (colourCell) {
                const ci = Math.min(ND - 1, Math.floor(Cg[src] * ND));
                row = ROW_DROP + pal * ND + ci;
                if (L > 1.15) row = ROW_WHITE;
              } else {
                row = L > 0.92 ? ROW_HOT + phos : phos;
                if (L > 1.3) row = ROW_WHITE;
              }
            }
            sg.drawImage(atlas, gIdx * cw, row * ch, cw, ch, i * cw, yy, cw, ch);
          }
        }
      }
      // Hat flicks: single cells jump to white.
      sg.globalAlpha = 1;
      for (const f of this.flicks) {
        if (f.k >= n) continue;
        const i = f.k % cols, j = (f.k / cols) | 0;
        sg.globalAlpha = f.life;
        sg.drawImage(atlas, f.g * cw, ROW_WHITE * ch, cw, ch, i * cw, j * ch, cw, ch);
      }
      // The prompt: bottom rows, dim, typed by the hats.
      sg.globalAlpha = 1;
      const lines = this.history.slice();
      const cursorOn = (Math.floor(t * 2) % 2) === 0;
      lines.push(PROMPT + cmdText.slice(0, this.typed));
      const baseRow = rows - lines.length;
      sg.fillStyle = 'rgba(0,0,0,0.78)';
      sg.fillRect(0, baseRow * ch, Wd, lines.length * ch);
      for (let li = 0; li < lines.length; li++) {
        const s = lines[li];
        const last = li === lines.length - 1;
        sg.globalAlpha = last ? 0.95 : 0.5;
        for (let c = 0; c < s.length && c + 1 < cols; c++) {
          const code = s.charCodeAt(c) - 32;
          if (code <= 0 || code >= 95) continue;
          sg.drawImage(atlas, code * cw, (c < PROMPT.length ? phos : ROW_HOT + phos) * ch, cw, ch, (c + 1) * cw, (baseRow + li) * ch, cw, ch);
        }
        if (last && cursorOn) {
          const cb0 = BLOCK0 + BLOCKS.indexOf('█');
          sg.globalAlpha = 0.8;
          sg.drawImage(atlas, cb0 * cw, (ROW_HOT + phos) * ch, cw, ch, (s.length + 1) * cw, (baseRow + li) * ch, cw, ch);
        }
      }

      // ---- composite: phosphor, bloom, scanlines, vignette
      dc.save();
      dc.setTransform(1, 0, 0, 1, 0, 0);
      dc.globalCompositeOperation = 'source-over';
      dc.globalAlpha = 1;
      dc.fillStyle = '#000';
      dc.fillRect(0, 0, Wd, Hd);
      dc.imageSmoothingEnabled = true;
      dc.drawImage(scr.c, 0, 0);
      const b1 = this.canvas('b1', Math.max(1, Wd >> 2), Math.max(1, Hd >> 2));
      const b2 = this.canvas('b2', Math.max(1, Wd >> 4), Math.max(1, Hd >> 4));
      b1.g.globalCompositeOperation = 'copy'; b1.g.imageSmoothingEnabled = true;
      b1.g.drawImage(scr.c, 0, 0, b1.c.width, b1.c.height);
      b2.g.globalCompositeOperation = 'copy'; b2.g.imageSmoothingEnabled = true;
      b2.g.drawImage(b1.c, 0, 0, b2.c.width, b2.c.height);
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = Math.min(1, 0.45 * params.glow);
      dc.drawImage(b1.c, 0, 0, Wd, Hd);
      dc.globalAlpha = Math.min(1, 0.9 * params.glow);
      dc.drawImage(b2.c, 0, 0, Wd, Hd);
      dc.globalCompositeOperation = 'source-over';
      dc.globalAlpha = 1;
      this.overlays(dc, Wd, Hd, ch);
      dc.restore();
    },

    overlays(dc, Wd, Hd, ch) {
      const key = Wd + 'x' + Hd + 'x' + ch;
      if (this.ovKey !== key) {
        this.ovKey = key;
        const o = this.canvas('ov', Wd, Hd);
        const g = o.g;
        g.clearRect(0, 0, Wd, Hd);
        // Scanlines at a third of a glyph row, so every character is crossed
        // by the same few dark lines and they never beat against the text.
        const step = Math.max(2, Math.round(ch / 4));
        g.fillStyle = 'rgba(0,0,0,0.2)';
        for (let y = 0; y < Hd; y += step) g.fillRect(0, y + step - Math.max(1, step >> 1), Wd, Math.max(1, step >> 1));
        const r = Math.hypot(Wd, Hd) / 2;
        const grd = g.createRadialGradient(Wd / 2, Hd / 2, r * 0.45, Wd / 2, Hd / 2, r);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,0.72)');
        g.fillStyle = grd;
        g.fillRect(0, 0, Wd, Hd);
      }
      dc.drawImage(this.bufs.ov.c, 0, 0);
    },
  });
})();
