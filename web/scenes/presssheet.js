// Press Sheet — batch 06, "Press sheet" (harness/briefs/batch-06-ideas.md).
//
// The Floor's "Fireworks Letterpress" fused with the Designer's riso duotone:
// a black press sheet feeding slowly through a screen-print press, a harbour
// skyline already printed along its foot, and a sky that the music prints
// fireworks into. Every mark is halftone ink from one of three drums (each at
// its own screen angle), and the drums are never quite in register: the bass
// walks their offset, so every burst, window and registration mark carries a
// living colour fringe.
//
// Music, each in its own place:
//   kick   one firework is stamped: the burst unfolds from its centre as the
//          platen meets the sheet, and its reflection is printed in the water
//          below it. Nothing else on the sheet moves.
//   snare  a rising launch trail is printed from the skyline up into the sky;
//          the next kick bursts at its top
//   bass   the drums' misregistration and the feed speed
//   hats   wet ink catches the lamp: glints on the freshest bursts and windows
//   drop   the third drum comes in (the city's windows light up, bursts
//          crackle), bursts grow and overprint two or three to a kick, the
//          feed runs faster and the plates slip further
//   breakdown  the printed sheet is pulled off the press and a fresh black
//          sheet runs in, carrying a faint mirrored set-off of the last one
// Inks overprint like light on black stock (screen), a paper tooth salts every
// solid, and nothing is blurred: no glow, no bloom.

(function () {
  const INKS = [
    { name: 'Fluoro pink, aqua, yellow', c: ['#FF4F8E', '#1E9FD6', '#FFD23F'] },
    { name: 'Orange, teal, bone', c: ['#FF7433', '#12958F', '#EDE6D2'] },
    { name: 'Red, violet, gold', c: ['#EE3A36', '#6E5BF2', '#F5BF32'] },
    { name: 'Mint, magenta, lemon', c: ['#39D69C', '#D33FB8', '#F3E75A'] },
  ];
  const PAPERS = [
    { name: 'Black stock', paper: '#121116', fibre: 'rgba(120,112,130,0.10)', bed: '#1D1E21', rail: '#2A2B2F' },
    { name: 'Midnight blue', paper: '#0E1424', fibre: 'rgba(110,130,170,0.10)', bed: '#1C1E24', rail: '#2A2D35' },
    { name: 'Oxblood', paper: '#1C0E12', fibre: 'rgba(160,110,110,0.10)', bed: '#201D1D', rail: '#302B2B' },
  ];
  const PRESETS = {
    calm: { feed: 0.35, size: 0.75, stamps: 1, third: 0, misreg: 0.6 },
    drop: { feed: 1.1, size: 1.15, stamps: 2.2, third: 1, misreg: 1.3 },
    overprint: { feed: 0.12, size: 1.45, stamps: 3, third: 1, misreg: 2 },
    proof: { feed: 0.2, size: 0.9, stamps: 1, third: 0.6, misreg: 0 },
  };
  const DRIVE = ['feed', 'size', 'stamps', 'third', 'misreg'];
  const STYLES = ['peony', 'ring', 'chrys', 'willow', 'palm'];
  const ANG = [0.26, 0.785, 0]; // screen angles per drum (15°, 45°, 0°)

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A halftone screen at angle `ang`: dots on a rotated lattice, each sized by
  // dens(x, y) (0..1, area coverage). Adds to the current path.
  function halftone(c, ang, cell, x0, y0, x1, y1, dens) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // Walk the lattice row by row, only across the span that lands in the box.
    let vmin = Infinity, vmax = -Infinity;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const v = -x * sa + y * ca;
      vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
    }
    for (let iv = Math.floor(vmin / cell); iv <= Math.ceil(vmax / cell); iv++) {
      const v = iv * cell;
      let ua = (x0 + v * sa) / ca, ub = (x1 + v * sa) / ca;
      if (sa > 1e-6) {
        ua = Math.max(ua, (y0 - v * ca) / sa);
        ub = Math.min(ub, (y1 - v * ca) / sa);
      } else if (v < y0 || v > y1) continue;
      for (let iu = Math.ceil(ua / cell); iu * cell <= ub; iu++) {
        const u = iu * cell;
        const x = u * ca - v * sa, y = u * sa + v * ca;
        const d = dens(x, y);
        if (d <= 0.015) continue;
        const r = cell * 0.56 * Math.sqrt(Math.min(1, d));
        c.moveTo(x + r, y);
        c.arc(x, y, r, 0, Math.PI * 2);
      }
    }
  }

  VIZ.register({
    id: 'presssheet',
    name: 'Press Sheet',
    order: 816,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'paper', label: 'Stock', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'feed', label: 'Feed speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.feed, step: 0.01 },
      { key: 'size', label: 'Burst size', type: 'range', min: 0.4, max: 1.6, default: PRESETS.calm.size, step: 0.01 },
      { key: 'stamps', label: 'Stamps per kick', type: 'range', min: 1, max: 3, default: PRESETS.calm.stamps, step: 0.01 },
      { key: 'third', label: 'Third drum', type: 'range', min: 0, max: 1, default: PRESETS.calm.third, step: 0.01 },
      { key: 'misreg', label: 'Misregistration', type: 'range', min: 0, max: 2, default: PRESETS.calm.misreg, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    actions: [{ id: 'pull', label: 'Pull a fresh sheet', run() { this.wantPull = true; } }],

    gallery: {
      title: 'Press Sheet',
      technique: 'Canvas 2D: travelling sheets, each holding three offscreen ink layers (one per riso drum) that accumulate halftone dots on rotated screens; the layers are composited live with screen blending at bass-driven registration offsets, then salted by a multiplied paper-tooth pattern; kicks stamp progressively unfolding bursts, snares print launch trails, onset detection against the previous frame, a section follower easing params toward the drop preset and pulling a fresh sheet in the breakdown',
      brief: 'A black press sheet feeding slowly sideways through a screen-print press, with a harbour skyline and its reflection already printed in halftone along its foot. The music prints the fireworks: each kick stamps one burst (peony, chrysanthemum, ring, willow or palm) that unfolds from its centre in two inks, with a column of dashes printed in the water below it; each snare prints a dotted launch trail rising from the roofs, and the next kick bursts at its top. The drums are never in register: the bass walks their offset, so every burst, window and registration mark wears a slow colour fringe, and the hats make the wet ink of the freshest bursts glint. The drop brings in the third drum (every window in the city lights, bursts crackle at their rims), bursts grow and overprint two or three to a kick, and the feed runs faster; the breakdown pulls the printed sheet off the press and runs in a fresh black one, a faint mirrored set-off of the last sheet on it.',
      lineage: [
        'Batch 06 idea 16, "Press sheet" (Floor and Designer). A fusion of both alternatives rather than a choice: the Floor\'s firework stamps give the kick its one confined, legible event, and the Designer\'s riso drums give the bass a continuous job (misregistration) and the drop a print-true escalation (a third drum). Either alone was thinner: stamps alone have no between-beat motion, drums alone no beat.',
        'Letterpress (the process as the story, a press that prints on the beat; its blank breakdown answered with a set-off ghost on a fresh sheet), Skyline (one shell per kick, a city on water, reflections), the Designer\'s Riso Zine Duotone (visible misregistration the music shifts), Stamps (riso palette).',
        'Screen-printed gig posters on black stock; risograph halftone screens at different angles; press-sheet furniture: crop marks, registration targets, colour bars, slug lines.',
        'Presets: calm, drop, overprint (huge slow overprinted bursts, plates far apart), proof (a slow, registered proof run).',
      ].join(' '),
    },

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        low: 0, dropOn: false, auto: 0, hadDrop: false, pulledThisBreak: false,
        bass: 0, pad: 0, hat: 0, lastKick: -10, lastSnare: -10, lastHat: -10,
      };
      this.sheets = new Map();
      this.scroll = 0;
      this.pull = null;
      this.wantPull = false;
      this.stamps = [];
      this.glints = [];
      this.points = [];      // recent burst tips, for glints
      this.pending = null;   // a launch trail waiting for its burst
      this.recent = [];
      this.geo = null;
      this.kicks = 0;
      this.drops = 0;
      this.tiles = null;
      this.warm = false;
      this.seeded = false;
    },

    makeGeo(W, H, s) {
      const sh = H * 0.86, sy = H * 0.07;
      const sw = Math.max(W * 1.3, sh * 1.7);
      const gap = Math.max(40, W * 0.05);
      const ls = clamp(s, 0.5, 1.6);
      const tx0 = 20, ty0 = 24, tx1 = sw - 20, ty1 = sh - 46;
      const horizon = ty0 + (ty1 - ty0) * 0.76;
      return { W, H, s, sw, sh, sy, gap, pitch: sw + gap, ls, tx0, ty0, tx1, ty1, horizon, startX: W * 0.04 };
    },

    // Paper fibre and tooth tiles, as patterns scaled to virtual units.
    makeTiles(p, ls) {
      const n = 256;
      const rng = mulberry(77);
      const fib = canvas(n, n), fc = fib.getContext('2d');
      fc.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        const x = rng() * n, y = rng() * n, a = rng() * Math.PI, l = 3 + rng() * 10;
        fc.strokeStyle = 'rgba(255,255,255,' + (0.05 + rng() * 0.12).toFixed(3) + ')';
        fc.lineWidth = 0.6 + rng() * 0.6;
        fc.beginPath();
        fc.moveTo(x, y);
        fc.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rng() * 2, y + Math.sin(a) * l * 0.5 + rng() * 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
        fc.stroke();
      }
      const tooth = canvas(n, n), tc = tooth.getContext('2d');
      tc.fillStyle = '#fff'; tc.fillRect(0, 0, n, n);
      const img = tc.getImageData(0, 0, n, n);
      for (let i = 0; i < n * n; i++) {
        const r = rng();
        let v = 255;
        if (r < 0.10) v = 120 + rng() * 80;          // salt: ink did not take
        else if (r < 0.35) v = 215 + rng() * 30;     // tooth
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      }
      tc.putImageData(img, 0, 0);
      const c2 = p.drawingContext;
      const mk = (cv) => {
        const pat = c2.createPattern(cv, 'repeat');
        if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / ls));
        return pat;
      };
      return { fibre: mk(fib), tooth: mk(tooth), ls };
    },

    inkSet(params) { return INKS[clamp(Math.round(params.inks), 0, INKS.length - 1)].c; },

    // A sheet: three ink layers plus the skyline, water and press furniture
    // printed when it is fed in.
    makeSheet(i, inks) {
      const g = this.geo;
      const rng = mulberry(9001 + i * 131);
      const L = [0, 1, 2].map(() => {
        const cv = canvas(g.sw * g.ls, g.sh * g.ls);
        const c = cv.getContext('2d');
        c.setTransform(g.ls, 0, 0, g.ls, 0, 0);
        return { cv, c };
      });
      const sheet = { i, L, n: 0 };
      const { tx0, ty0, tx1, ty1, horizon, sw, sh } = g;
      const wBottom = ty1 - 4;

      // Skyline: a far row and a near row of buildings, 1-unit height maps.
      const N = Math.ceil(sw);
      const far = new Float32Array(N), near = new Float32Array(N);
      const blds = [];
      for (let row = 0; row < 2; row++) {
        let x = tx0 - 10;
        const arr = row ? near : far;
        while (x < tx1 + 10) {
          const w = row ? 16 + rng() * 44 : 20 + rng() * 50;
          const tall = rng() < 0.12;
          const h = row ? (tall ? 70 + rng() * 50 : 16 + rng() * 44) : 34 + rng() * 56;
          const spire = tall && rng() < 0.6;
          for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(N, x + w); xx++) {
            let hh = h;
            if (spire) {
              const m = Math.abs(xx - (x + w / 2)) / (w / 2);
              if (m < 0.12) hh = h + 30; else if (m < 0.35) hh = h + 10;
            }
            arr[xx] = Math.max(arr[xx], hh);
          }
          if (row) blds.push({ x, w, h });
          x += w + (row ? (rng() < 0.3 ? 4 + rng() * 14 : 0) : rng() * 8);
        }
      }
      sheet.near = near;
      const H = (arr, x) => arr[clamp(Math.floor(x), 0, N - 1)];
      const ripple = (x, y) => 0.5 + 0.5 * Math.sin(y * 1.7 + Math.sin(x * 0.031 + y * 0.2) * 2.2);

      // Drum B (45°): the city and the harbour. Drum A (15°): a low haze of
      // sky above the roofs. Both are rasterised per pixel in slices over
      // several frames before the sheet reaches the stage: as vector paths the
      // city was ~30k circles, a visible hitch on every new sheet.
      sheet.jobs = [
        {
          L: 1, ang: ANG[1], cell: 3.3, x0: tx0, y0: horizon - 170, x1: tx1, y1: wBottom, ink: inks[1],
          dens: (x, y) => {
            const hn = H(near, x), hf = H(far, x);
            if (y < horizon) {
              const up = horizon - y;
              if (up < hn) return 0.4 + 0.34 * (1 - up / Math.max(1, hn));
              if (up < hf) return 0.13 + 0.08 * (1 - up / hf);
              return 0.05 * smooth(70, 0, up);
            }
            const dn = y - horizon, depth = dn / (wBottom - horizon);
            let d = 0.06 + 0.08 * depth;
            if (dn < hn * 0.6) d += 0.3 * ripple(x, y) * (1 - dn / (hn * 0.6 + 1));
            return d * (0.55 + 0.45 * ripple(x * 0.7, y * 1.3));
          },
        },
        {
          L: 0, ang: ANG[0], cell: 3.6, x0: tx0, y0: horizon - 130, x1: tx1, y1: horizon, ink: inks[0],
          dens: (x, y) => (horizon - y < H(near, x) ? 0 : 0.1 * Math.pow(smooth(horizon - 130, horizon, y), 1.6)),
        },
      ];

      // Drum C: windows, and their broken reflections.
      c = L[2].c;
      c.fillStyle = inks[2];
      c.beginPath();
      for (const b of blds) {
        if (b.h < 30) continue;
        const cols = Math.floor((b.w - 4) / 6), rows = Math.floor((b.h - 8) / 8);
        for (let cc = 0; cc < cols; cc++) {
          for (let rr = 0; rr < rows; rr++) {
            if (rng() > 0.42) continue;
            const x = b.x + 3 + cc * 6, y = horizon - b.h + 6 + rr * 8;
            if (x < tx0 || x > tx1) continue;
            c.rect(x, y, 2.4, 3.4);
            if (rr > rows - 5 && rng() < 0.5) {
              const ry = horizon + (horizon - y) * 0.5 + rng() * 4;
              if (ry < wBottom) c.rect(x - 1.5, ry, 5 + rng() * 5, 1.2);
            }
          }
        }
      }
      c.fill();

      // Press furniture in every drum: crop marks, registration targets, the
      // colour bar and the slug. Out of register, they fringe like the art.
      for (let k = 0; k < 3; k++) {
        c = L[k].c;
        c.strokeStyle = inks[k];
        c.fillStyle = inks[k];
        c.lineWidth = 0.8;
        c.beginPath();
        for (const [x, y, dx, dy] of [[tx0, ty0, -1, -1], [tx1, ty0, 1, -1], [tx0, ty1, -1, 1], [tx1, ty1, 1, 1]]) {
          c.moveTo(x + dx * 4, y); c.lineTo(x + dx * 16, y);
          c.moveTo(x, y + dy * 4); c.lineTo(x, y + dy * 16);
        }
        for (const [x, y] of [[sw * 0.5, 11], [52, sh - 20], [sw - 52, sh - 20]]) {
          c.moveTo(x + 5, y); c.arc(x, y, 5, 0, Math.PI * 2);
          c.moveTo(x - 9, y); c.lineTo(x + 9, y);
          c.moveTo(x, y - 9); c.lineTo(x, y + 9);
        }
        c.stroke();
        const combos = [[0], [1], [2], [0, 1], [1, 2], [0, 2], [0, 1, 2], [0], [1], [2]];
        const tints = [1, 1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5];
        c.beginPath();
        let j = 0;
        for (let x = 80; x < sw - 90; x += 12, j++) {
          const q = j % combos.length;
          if (!combos[q].includes(k)) continue;
          if (tints[q] < 1) halftone(c, ANG[k], 2.2, x, sh - 26, x + 11, sh - 16, () => tints[q]);
          else c.rect(x, sh - 26, 11, 10);
        }
        c.fill();
      }
      c = L[0].c;
      c.fillStyle = inks[0];
      c.font = '400 7px "IBM Plex Mono", Menlo, monospace';
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      const no = String(1000 + i * 7 + 3).slice(1);
      c.fillText('PRESS SHEET  Nº ' + no + '   ·   NIGHT RUN   ·   3 DRUMS   ·   PRINTED ON THE KICK', tx0 + 22, 11);
      c.textAlign = 'right';
      c.fillText('SHEET ' + no + ' / ∞', tx1 - 22, 11);

      return sheet;
    },

    // Rasterise a sheet's halftone jobs, at most `budget` pixels this call.
    bake(sheet, budget) {
      const g = this.geo, ls = g.ls;
      while (sheet.jobs.length && budget > 0) {
        const j = sheet.jobs[0];
        const c = sheet.L[j.L].c;
        if (!j.img) {
          j.px0 = Math.floor(j.x0 * ls); j.py0 = Math.floor(j.y0 * ls);
          j.pw = Math.ceil(j.x1 * ls) - j.px0; j.ph = Math.ceil(j.y1 * ls) - j.py0;
          j.img = c.createImageData(j.pw, j.ph);
          j.row = 0;
          const n = parseInt(j.ink.slice(1), 16);
          j.rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
        const { img, pw, ph, px0, py0, cell, rgb } = j;
        const data = img.data;
        const ca = Math.cos(j.ang), sa = Math.sin(j.ang), inv = 1 / cell;
        const rmax = cell * 0.56, rmax2 = rmax * rmax;
        const start = j.row;
        while (j.row < ph && budget > 0) {
          const py = j.row;
          const y = (py0 + py + 0.5) / ls;
          for (let px = 0; px < pw; px++) {
            const x = (px0 + px + 0.5) / ls;
            const u = x * ca + y * sa, v = -x * sa + y * ca;
            const cu = Math.round(u * inv) * cell, cv = Math.round(v * inv) * cell;
            const du = u - cu, dv = v - cv;
            const dist2 = du * du + dv * dv;
            if (dist2 > rmax2) continue;
            const d = j.dens(cu * ca - cv * sa, cu * sa + cv * ca);
            if (d <= 0.015) continue;
            let a = (rmax * Math.sqrt(d < 1 ? d : 1) - Math.sqrt(dist2)) * ls + 0.5;
            if (a <= 0) continue;
            if (a > 1) a = 1;
            const k = (py * pw + px) * 4;
            data[k] = rgb[0]; data[k + 1] = rgb[1]; data[k + 2] = rgb[2]; data[k + 3] = a * 255;
          }
          j.row++;
          budget -= pw;
        }
        c.putImageData(img, px0, py0, 0, start, pw, j.row - start);
        if (j.row >= ph) sheet.jobs.shift();
      }
    },

    sheetLeft(i) { const g = this.geo; return g.startX + i * g.pitch - this.scroll; },

    sheetAt(x) {
      const g = this.geo;
      const i = Math.floor((x - g.startX + this.scroll) / g.pitch);
      const sx = x - this.sheetLeft(i);
      if (sx < 0 || sx > g.sw) return null;
      return { i, sx };
    },

    getSheet(i, inks) {
      let s = this.sheets.get(i);
      if (!s) { s = this.makeSheet(i, inks); this.sheets.set(i, s); }
      return s;
    },

    // One burst's dots, in unfold order d (0 = centre, 1 = rim, >1 = crackle).
    burst(cx, cy, R, style, a, b, crackle, rng) {
      const E = [];
      const sz = clamp(R / 80, 0.7, 1.5);
      const dot = (L, x, y, r, d) => E.push({ L, x, y, r: r * sz, d });
      const spokes = (n, k0, k1, dk, g, rf, Lf, tip) => {
        const off = rng() * 6.28;
        for (let i = 0; i < n; i++) {
          const an = off + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.08;
          const len = 0.9 + rng() * 0.18;
          const ca = Math.cos(an), sa = Math.sin(an);
          for (let k = k0; k <= k1; k += dk) {
            const kk = k * len;
            dot(Lf(k), cx + ca * R * kk, cy + sa * R * kk + g * R * kk * kk, rf(k), k / k1);
          }
          if (tip) { const kk = (k1 + 0.05) * len; dot(b, cx + ca * R * kk, cy + sa * R * kk + g * R * kk * kk, tip, 1); }
        }
      };
      if (style === 'peony') {
        spokes(20 + Math.floor(rng() * 10), 0.16, 1, 0.07, 0.16, (k) => 1.9 - 1.1 * k, () => a, 2.5);
        for (let i = 0; i < 10; i++) { const an = i * 0.628; dot(b, cx + Math.cos(an) * R * 0.1, cy + Math.sin(an) * R * 0.1, 1.6, 0.05); }
      } else if (style === 'chrys') {
        spokes(34 + Math.floor(rng() * 12), 0.1, 1, 0.032, 0.08, (k) => 1.25 - 0.75 * k, (k) => (k > 0.55 && k < 0.72 ? b : a), 0);
      } else if (style === 'ring') {
        for (let i = 0; i < 44; i++) { const an = i / 44 * 6.283; dot(a, cx + Math.cos(an) * R, cy + Math.sin(an) * R * 0.94, 2, 1); }
        for (let i = 0; i < 26; i++) { const an = i / 26 * 6.283 + 0.1; dot(b, cx + Math.cos(an) * R * 0.55, cy + Math.sin(an) * R * 0.52, 1.6, 0.55); }
        spokes(12, 0.12, 0.4, 0.07, 0, () => 1.2, () => a, 0);
      } else if (style === 'willow') {
        spokes(16 + Math.floor(rng() * 6), 0.1, 1.35, 0.05, 0.5, (k) => 1.7 - 0.95 * k / 1.35, () => b, 0);
        spokes(10, 0.08, 0.34, 0.06, 0.05, () => 1.4, () => a, 2);
      } else {
        spokes(7 + Math.floor(rng() * 3), 0.1, 1, 0.035, 0.34, (k) => 3.3 - 2.4 * k, () => a, 2.8);
        spokes(9, 0.1, 0.6, 0.08, 0.2, () => 0.9, () => b, 0);
      }
      if (crackle) {
        const m = 24 + Math.floor(rng() * 18);
        for (let i = 0; i < m; i++) {
          const an = rng() * 6.283, dist = R * (1.02 + rng() * 0.36);
          dot(2, cx + Math.cos(an) * dist, cy + Math.sin(an) * dist + 0.2 * R, 0.9 + rng() * 0.9, 1.02 + rng() * 0.28);
        }
        for (let i = 0; i < 6; i++) dot(2, cx + (rng() - 0.5) * R * 0.12, cy + (rng() - 0.5) * R * 0.12, 1.4, 0.02);
      }
      return E;
    },

    // The burst's reflection: a column of dashes in the harbour.
    reflection(cx, R, L, rng) {
      const g = this.geo, E = [];
      const y0 = g.horizon + 3, y1 = g.ty1 - 6;
      const n = Math.floor((y1 - y0) / 3.2);
      for (let j = 0; j < n; j++) {
        const u = j / n;
        const w = R * 0.55 * (1 - u * 0.8) * (0.45 + 0.55 * rng());
        if (rng() < 0.25) continue;
        E.push({ L, x: cx + (rng() - 0.5) * R * 0.2, y: y0 + j * 3.2, w, h: 1.3, d: 0.1 + u * 0.8 });
      }
      return E;
    },

    addStamp(t, sheet, E, dur, sx, sy, R) {
      E.sort((u, v) => u.d - v.d);
      const dmax = E.length ? E[E.length - 1].d : 1;
      this.stamps.push({ t0: t, dur, sheet: sheet.i, E, i: 0, dmax });
      sheet.n++;
      if (R) {
        for (let k = 0; k < 10; k++) {
          const e = E[Math.floor(this.rng() * E.length)];
          if (e) this.points.push({ sheet: sheet.i, x: e.x, y: e.y, t });
        }
        if (this.points.length > 60) this.points.splice(0, this.points.length - 60);
      }
    },

    onKick(t, P, react, inks) {
      const g = this.geo, rng = this.rng;
      this.kicks++;
      const R = 58 * P.size * (0.82 + 0.36 * rng()) * (0.8 + 0.2 * react);
      let spot = null;
      const pend = this.pending;
      if (pend && t - pend.t < 1.4 && this.sheets.has(pend.sheet)) {
        const sx = pend.x + this.sheetLeft(pend.sheet);
        if (sx > -R && sx < g.W + R) spot = { i: pend.sheet, sx: pend.x, sy: pend.y };
      }
      this.pending = null;
      if (!spot) {
        for (let tries = 0; tries < 8 && !spot; tries++) {
          const x = g.W * (0.3 + 0.62 * rng());
          const at = this.sheetAt(x);
          if (!at) continue;
          const sx = at.sx;
          if (sx < g.tx0 + R * 0.7 || sx > g.tx1 - R * 0.7) continue;
          const sy = lerp(g.ty0 + R * 0.75, g.horizon - R * 0.55 - 40, rng());
          if (this.recent.some((q) => q.i === at.i && Math.hypot(q.x - sx, q.y - sy) < R * 1.0) && tries < 6) continue;
          spot = { i: at.i, sx, sy };
        }
      }
      if (!spot) return;
      const sheet = this.getSheet(spot.i, inks);
      const flip = (this.kicks % 3 === 0) !== (this.drops > 0 && this.drops % 2 === 0);
      const a = flip ? 1 : 0, b = flip ? 0 : 1;
      const style = STYLES[Math.floor(rng() * STYLES.length)];
      const crackle = P.third > 0.3;
      let E = this.burst(spot.sx, spot.sy, R, style, a, b, crackle, rng);
      E = E.concat(this.reflection(spot.sx, R, a, rng));
      // More stamps per kick overprint: smaller bursts in swapped inks, a
      // beat of the platen later.
      const extra = Math.floor(P.stamps - 1) + (rng() < (P.stamps % 1) ? 1 : 0);
      for (let k = 0; k < extra; k++) {
        const an = rng() * 6.283;
        const ox = spot.sx + Math.cos(an) * R * 0.45, oy = spot.sy + Math.sin(an) * R * 0.3;
        const st = STYLES[(STYLES.indexOf(style) + 1 + k) % STYLES.length];
        const e2 = this.burst(ox, oy, R * (0.62 - 0.1 * k), st, b, a, crackle && k === 0, rng);
        for (const e of e2) e.d = e.d * 0.8 + 0.25 + 0.15 * k;
        E = E.concat(e2);
      }
      this.addStamp(t, sheet, E, 0.34, spot.sx, spot.sy, R);
      this.recent.push({ i: spot.i, x: spot.sx, y: spot.sy });
      if (this.recent.length > 5) this.recent.shift();
    },

    onSnare(t, P, inks) {
      const g = this.geo, rng = this.rng;
      for (let tries = 0; tries < 6; tries++) {
        const x = g.W * (0.3 + 0.62 * rng());
        const at = this.sheetAt(x);
        if (!at || at.sx < g.tx0 + 60 || at.sx > g.tx1 - 60) continue;
        const R = 58 * P.size;
        const ty = lerp(g.ty0 + R * 0.75, g.horizon - R * 0.55 - 40, rng());
        const sheet = this.getSheet(at.i, inks);
        const hn = sheet.near[clamp(Math.floor(at.sx), 0, sheet.near.length - 1)];
        const y0 = g.horizon - hn - 4;
        const E = [];
        const bend = (rng() - 0.5) * 30;
        const n = Math.floor((y0 - ty) / 3.4);
        for (let j = 0; j < n; j++) {
          const u = j / n;
          E.push({ L: 1, x: at.sx + bend * u * u + Math.sin(u * 9) * 0.8, y: y0 - (y0 - ty) * u, r: 1.25 - 0.7 * u, d: u });
        }
        this.addStamp(t, sheet, E, 0.24, 0, 0, 0);
        this.pending = { sheet: at.i, x: at.sx + bend, y: ty - 4, t };
        return;
      }
    },

    startPull(t, inks) {
      const g = this.geo;
      // The next sheet that has not yet reached the stage.
      let i = Math.floor((g.W - g.startX + this.scroll) / g.pitch);
      while (this.sheetLeft(i) < g.W * 0.98) i++;
      // Its set-off comes from the most printed sheet on the stage now: the
      // old sheet's ink, mirrored and faint, as if it had lain face down on
      // this one in the stack. (Designer and Floor: Letterpress's breakdown
      // was a blank page; this one never is.)
      let best = null;
      for (const [k, s] of this.sheets) if (k !== i && (!best || s.n > best.n)) best = s;
      const dst = this.getSheet(i, inks);
      this.bake(dst, Infinity);
      if (best && best.n > 0) {
        for (let k = 0; k < 3; k++) {
          const cc = dst.L[k].c;
          cc.save();
          cc.setTransform(-g.ls, 0, 0, g.ls, g.sw * g.ls, 0);
          cc.globalAlpha = 0.15;
          cc.drawImage(best.L[k].cv, 0, 0, g.sw, g.sh);
          cc.restore();
        }
      }
      this.pull = { from: this.scroll, to: g.startX + i * g.pitch - g.W * 0.03, t0: t, dur: 2.4 };
      this.pending = null;
      this.recent = [];
    },

    listen(s, t, dt, P, react, inks, follow) {
      const e = this.env;
      const b0 = s[0], b4 = s[4];
      let kick = false, snare = false;
      if (b0 > 30 && b0 - this.prev[0] > 10 && t - e.lastKick > 0.22) { e.lastKick = t; kick = true; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - e.lastSnare > 0.26) { e.lastSnare = t; snare = true; }
      const hatNow = (s[7] + s[8]) / 200;
      let hat = false;
      if (s[8] - this.prev[8] > 10 && s[8] > 25 && t - e.lastHat > 0.06) { e.lastHat = t; hat = true; }
      this.prev.set(s);
      const bass = Math.max(s[0], s[1]) / 100;
      // Slow attack: the offset moves every plate at once, so a fast one
      // would make the whole sheet jump on the sidechain.
      e.bass = ease(e.bass, bass, 1.4, dt);
      e.pad = ease(e.pad, (s[2] + s[3]) / 200, 1.2, dt);
      e.hat = ease(e.hat, hatNow, hatNow > e.hat ? 30 : 6, dt);
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; e.hadDrop = true; e.pulledThisBreak = false; this.drops++; }
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      if (snare) this.onSnare(t, P, inks);
      if (kick) this.onKick(t, P, react, inks);
      if (hat) this.onHat(t, e.hat);
      if (follow && e.hadDrop && !e.dropOn && !e.pulledThisBreak && t - e.lastKick > 1.1) {
        e.pulledThisBreak = true;
        this.wantPull = true;
      }
    },

    onHat(t, level) {
      const n = 2 + Math.round(level * 4);
      const fresh = this.points.filter((q) => t - q.t < 6 && this.sheets.has(q.sheet));
      const g = this.geo;
      for (let k = 0; k < n; k++) {
        let q;
        if (fresh.length) q = fresh[Math.floor(this.rng() * fresh.length)];
        else {
          const at = this.sheetAt(g.W * (0.1 + 0.8 * this.rng()));
          if (!at) continue;
          const s = this.sheets.get(at.i);
          if (!s) continue;
          const hn = s.near[clamp(Math.floor(at.sx), 0, s.near.length - 1)];
          if (hn < 30) continue;
          q = { sheet: at.i, x: at.sx, y: g.horizon - hn * (0.2 + 0.7 * this.rng()) };
        }
        this.glints.push({ sheet: q.sheet, x: q.x + (this.rng() - 0.5) * 3, y: q.y + (this.rng() - 0.5) * 3, t0: t, s: 0.7 + this.rng() * 0.6 });
      }
      if (this.glints.length > 40) this.glints.splice(0, this.glints.length - 40);
    },

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const s = p.width / W;
      const e = this.env;

      const g0 = this.geo;
      if (!g0 || Math.abs(g0.W - W) > 0.5 || Math.abs(g0.H - H) > 0.5 || Math.abs(g0.s - s) > 0.01) {
        this.geo = this.makeGeo(W, H, s);
        this.sheets.clear();
        this.stamps = []; this.glints = []; this.points = []; this.pending = null; this.recent = [];
        this.tiles = this.makeTiles(p, this.geo.ls);
      }
      const g = this.geo;
      const inks = this.inkSet(params);
      // Build the press on the second frame: the first one only lays the bed,
      // so switching to the scene never stalls on sheet setup.
      if (!this.warm) {
        this.warm = true;
        const c0 = p.drawingContext;
        c0.save();
        c0.globalAlpha = 1; c0.globalCompositeOperation = 'source-over';
        c0.fillStyle = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)].bed;
        c0.fillRect(-2, -2, W + 4, H + 4);
        c0.restore();
        return;
      }
      const paper = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];
      const follow = Math.round(params.follow) === 1;
      const react = params.reaction;
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // First sheet: a few bursts already printed, so the intro has a sky.
      if (!this.sheets.size && this.stamps.length === 0 && !this.seeded) {
        this.seeded = true;
        const sh0 = this.getSheet(0, inks);
        const rng = mulberry(5);
        for (let k = 0; k < 3; k++) {
          const R = 50 + rng() * 20;
          const sx = g.W * (0.2 + 0.28 * k) + rng() * 40 - g.startX;
          const sy = lerp(g.ty0 + R, g.horizon - R - 40, rng());
          const E = this.burst(sx, sy, R, STYLES[(k * 2) % 5], k % 2, 1 - (k % 2), false, rng).concat(this.reflection(sx, R, k % 2, rng));
          this.addStamp(-1, sh0, E, 0.01, sx, sy, 0);
        }
      }

      this.listen(signals, t, dt, P, react, inks, follow);
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.6 : 0.5, dt);
      if (this.wantPull && !this.pull) { this.wantPull = false; this.startPull(t, inks); }

      // Feed.
      if (this.pull) {
        const u = clamp((t - this.pull.t0) / this.pull.dur, 0, 1);
        this.scroll = lerp(this.pull.from, this.pull.to, easeInOut(u));
        if (u >= 1) this.pull = null;
      } else {
        this.scroll += dt * P.feed * (16 + 22 * e.bass * react);
      }

      // Sheets on the stage; forget those that have left.
      const vis = [];
      const i0 = Math.floor((-g.startX + this.scroll - g.sw) / g.pitch);
      let ahead = null;
      for (let i = i0; i <= i0 + 3; i++) {
        const x = this.sheetLeft(i);
        if (x + g.sw < 0) continue;
        if (x > W) { if (!ahead) ahead = this.getSheet(i, inks); continue; }
        const sh = this.getSheet(i, inks);
        this.bake(sh, Infinity);
        vis.push(sh);
      }
      // The next sheet is prepared off stage, a slice per frame.
      if (ahead) this.bake(ahead, 60000);
      for (const [i, sh] of this.sheets) {
        if (this.sheetLeft(i) + g.sw < -20) this.sheets.delete(i);
      }

      // Print: each stamp lays down the dots its platen has reached.
      for (let k = this.stamps.length - 1; k >= 0; k--) {
        const st = this.stamps[k];
        const sheet = this.sheets.get(st.sheet);
        if (!sheet) { this.stamps.splice(k, 1); continue; }
        const u = clamp((t - st.t0) / st.dur, 0, 1);
        const reach = easeOut(u) * st.dmax + (u >= 1 ? 1 : 0);
        if (st.i >= st.E.length) { this.stamps.splice(k, 1); continue; }
        const paths = [null, null, null];
        while (st.i < st.E.length && st.E[st.i].d <= reach) {
          const el = st.E[st.i++];
          const c = sheet.L[el.L].c;
          if (!paths[el.L]) { paths[el.L] = true; c.fillStyle = inks[el.L]; c.beginPath(); }
          if (el.w) c.rect(el.x - el.w / 2, el.y - el.h / 2, el.w, el.h);
          else { c.moveTo(el.x + el.r, el.y); c.arc(el.x, el.y, Math.max(0.35, el.r), 0, Math.PI * 2); }
        }
        for (let L = 0; L < 3; L++) if (paths[L]) sheet.L[L].c.fill();
      }

      // ---- composite --------------------------------------------------------
      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
      c2.setLineDash([]);
      c2.fillStyle = paper.bed;
      c2.fillRect(-2, -2, W + 4, H + 4);
      // The bed: two rails and an engraved gauge that stays put while the
      // sheets run past, so the feed is felt.
      c2.fillStyle = paper.rail;
      c2.fillRect(-2, g.sy + 14, W + 4, 5);
      c2.fillRect(-2, g.sy + g.sh - 19, W + 4, 5);
      c2.strokeStyle = paper.rail;
      c2.lineWidth = 1;
      c2.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const l = x % 50 === 0 ? 9 : 4;
        c2.moveTo(x, g.sy - 4); c2.lineTo(x, g.sy - 4 - l);
        c2.moveTo(x, g.sy + g.sh + 4); c2.lineTo(x, g.sy + g.sh + 4 + l);
      }
      c2.stroke();

      // Registration: A and B walk apart along a slowly turning axis, C
      // across it. The bass widens the gap.
      const o = P.misreg * (1.1 + 5.5 * e.bass * react) + 0.8 * P.misreg * e.pad;
      const th = t * 0.21 + Math.sin(t * 0.13) * 1.3;
      const off = [
        [-Math.cos(th) * o * 0.5, -Math.sin(th) * o * 0.5],
        [Math.cos(th) * o * 0.5, Math.sin(th) * o * 0.5],
        [-Math.sin(th) * o * 0.6, Math.cos(th) * o * 0.6],
      ];
      const thirdA = clamp(P.third, 0, 1);

      for (const sh of vis) {
        const x = this.sheetLeft(sh.i), y = g.sy;
        c2.globalCompositeOperation = 'source-over';
        c2.globalAlpha = 0.55;
        c2.fillStyle = '#050506';
        c2.fillRect(x + 3, y + 5, g.sw, g.sh);
        c2.globalAlpha = 1;
        c2.fillStyle = paper.paper;
        c2.fillRect(x, y, g.sw, g.sh);
        c2.save();
        c2.beginPath();
        c2.rect(x, y, g.sw, g.sh);
        c2.clip();
        c2.translate(x, y);
        c2.fillStyle = this.tiles.fibre;
        c2.fillRect(0, 0, g.sw, g.sh);
        c2.globalCompositeOperation = 'screen';
        for (let L = 0; L < 3; L++) {
          const a = L === 2 ? thirdA : 1;
          if (a <= 0.01) continue;
          c2.globalAlpha = a;
          c2.drawImage(sh.L[L].cv, off[L][0], off[L][1], g.sw, g.sh);
        }
        c2.globalAlpha = 1;
        c2.globalCompositeOperation = 'multiply';
        c2.fillStyle = this.tiles.tooth;
        c2.fillRect(0, 0, g.sw, g.sh);
        c2.restore();
        // The lamp catches the sheet's leading edge.
        c2.globalCompositeOperation = 'source-over';
        c2.fillStyle = 'rgba(255,245,230,0.07)';
        c2.fillRect(x, y, g.sw, 1.2);
      }

      // Glints: wet ink catching the lamp on the hats.
      c2.globalCompositeOperation = 'source-over';
      c2.strokeStyle = '#FFF4DC';
      c2.fillStyle = '#FFF4DC';
      for (let k = this.glints.length - 1; k >= 0; k--) {
        const q = this.glints[k];
        const age = t - q.t0;
        if (age > 0.3 || !this.sheets.has(q.sheet)) { this.glints.splice(k, 1); continue; }
        const f = 1 - age / 0.3;
        const gx = this.sheetLeft(q.sheet) + q.x, gy = g.sy + q.y;
        const l = 5.5 * q.s * f;
        c2.globalAlpha = 0.9 * f;
        c2.lineWidth = 0.9;
        c2.beginPath();
        c2.moveTo(gx - l, gy); c2.lineTo(gx + l, gy);
        c2.moveTo(gx, gy - l); c2.lineTo(gx, gy + l);
        c2.stroke();
        c2.beginPath();
        c2.arc(gx, gy, 1.3 * q.s * f + 0.3, 0, Math.PI * 2);
        c2.fill();
      }
      c2.globalAlpha = 1;
      c2.restore();
    },
  });
})();
