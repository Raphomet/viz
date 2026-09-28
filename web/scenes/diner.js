// Diner: a roadside diner at night as the poster, and the poster is the sign.
// A streamlined stainless diner sits under a big Googie sign: a skewed enamel
// cabinet carrying the name in neon script, channel letters beneath, two
// starbursts, a chasing arrow that swoops down to the door, a boomerang, and a
// vertical EAT blade out front. The whole thing is doubled in a wet car park
// and smeared along the fluted chrome of the diner's flank.
//
// Music, each in its own place:
//   kick   the arrow: a bright pulse runs down its bulbs to the door and the
//          head flares (and so does its reflection in the puddle under it)
//   snare  the starbursts switch between their two tube sets, as a real
//          two-circuit animated sign does
//   hats   stars twinkle, rain rings open in the puddles
//   bass   the puddles' ripple and the hum of the gas
//   drop   the second circuit comes on: DANCING NIGHTLY on the cornice, the
//          swash under the name, the boomerang, the cabinet's chasing bulbs,
//          the EAT blade's border, dancers in the jukebox window. The
//          breakdown shuts them off one by one; the bad letter sputters.
// Neon is drawn as tubes (glass when unlit, gas colour with a hot core when
// lit) into a half-resolution light buffer, and the glow is that buffer's
// mip chain summed back additively, so the halo belongs to the tubes rather
// than to the frame. The same buffer, flipped and rippled, is the reflection.

(function () {
  // Gas colours by role. Real neon is red-orange; the pinks, blues and greens
  // are phosphor-coated or argon-mercury tubes, which is why a sign can carry
  // several at once. Core is the near-white the tube burns at its centre.
  const GASES = [
    { name: 'Rose & argon',
      script: ['#ff2f8a', '#ffe1ef'], block: ['#22e3ff', '#e2fdff'], arrow: ['#ffae2a', '#fff1d0'],
      star: ['#fff0a8', '#fffdf0'], boom: ['#9dff3a', '#f0ffe0'], eat: ['#ff3a1a', '#ffe0cc'],
      cornice: ['#3f7bff', '#dfe9ff'], juke: ['#b45cff', '#f3e6ff'] },
    { name: 'Red neon & blue',
      script: ['#ff3418', '#ffe2d4'], block: ['#3b6dff', '#e4ecff'], arrow: ['#ff3418', '#ffe2d4'],
      star: ['#e8f4ff', '#ffffff'], boom: ['#3b6dff', '#e4ecff'], eat: ['#ff3418', '#ffe2d4'],
      cornice: ['#ff3418', '#ffe2d4'], juke: ['#3b6dff', '#e4ecff'] },
    { name: 'Tangerine & mint',
      script: ['#ff8a1c', '#fff0da'], block: ['#3dffb4', '#e6fff5'], arrow: ['#ff4f7a', '#ffe3ea'],
      star: ['#fff6c8', '#ffffff'], boom: ['#ff4f7a', '#ffe3ea'], eat: ['#3dffb4', '#e6fff5'],
      cornice: ['#ffcf3a', '#fff8dc'], juke: ['#ff8a1c', '#fff0da'] },
  ];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  function hash(n) {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
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
  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }
  function cubic(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  }
  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  VIZ.register({
    id: 'diner',
    name: 'Diner',
    order: 512,

    params: [
      { key: 'name', label: 'Name in script', type: 'text', default: 'Starbeat' },
      { key: 'sub', label: 'Channel letters', type: 'text', default: 'DINER' },
      { key: 'gas', label: 'Gas colours', type: 'select', options: GASES.map((g) => g.name), default: 0 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'rain', label: 'Rain', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'wet', label: 'Wet car park', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'flicker', label: 'Bad transformer', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'strike', label: 'Re-strike the sign', run() { this.t0 = null; } },
    ],

    gallery: {
      title: 'Diner',
      technique: 'Canvas 2D. Every neon tube is drawn twice: flat gas colour into a half-resolution light buffer, and on the stage as glass (cold) or gas colour with a near-white core (lit). The glow is that buffer\'s mip chain (1/4 to 1/32) summed back additively, so the halo comes from the tubes, not a frame bloom. The wet car park is the same buffer flipped in 64 rippled strips (sharp level plus a soft level), shown faintly everywhere and fully through a generated puddle mask; the diner\'s fluted stainless flank carries a squashed, flipped copy. Tubes strike with a warm-up sputter and are cut in sequence; onset detection per band; sections from a slow follower of band 1 with hysteresis.',
      brief: 'A roadside diner at night, and the poster is its sign: a skewed Googie cabinet with the name in pink script, blue channel letters on an oxblood panel, two starbursts, a chasing arrow that swoops down to the door, a red EAT blade out front, a streamlined stainless diner with warm windows, and all of it doubled in a wet car park under light rain. The sign strikes tube by tube as it starts. Each kick sends a pulse of light down the arrow\'s bulbs to the door and swells its tube (and its reflection in the puddle); each snare switches the starbursts between their two tube circuits; hats twinkle the stars and open rain rings in the puddles; the bass ripples the reflections and the pad sets the hum of the gas. The drop throws the second circuit: the swash under the name, grand-opening searchlights, the boomerang, DANCING NIGHTLY on the cornice, chasing marquee bulbs round the cabinet and the blade, and a couple dancing by the jukebox. The breakdown cuts them one by one, and one channel letter has a bad transformer.',
      lineage: [
        'Mid-century American roadside signage: Googie cabinets and starbursts, chaser-bulb arrows, stainless streamliner diners, the neon photographs of wet parking lots at night; the batch-05 "Neon sign / diner Americana" entry, the one style in the poster series that calls for glow, so the glow is made to behave like gas in glass (tube, core, halo, reflection, flicker) rather than a bloom filter. The diner name "Starbeat" and all wording are invented. Faces from web/fonts.js: Yellowtail for the script, Bungee for the channel letters and blade, Russo One for the cornice.',
        'Process: the first 640x360 render already read as the scene; the windows were too hot (their light-buffer weight cut from 0.5 to 0.2 and the glass warmed down), the EAT blade overlapped the windows (raised to end above the roofline), and the reflection was squashed too hard to read (mirror factor capped at 1.75). Grand-opening searchlights were added to the drop circuit to make the drop bigger in the sky too. The first jolt run was calm (kickArea 0.035) but the kick hardly showed and the hottest spot was the bad letter, not the beat, so the arrow was widened, its bulbs doubled and enlarged, and its tube now rests at 0.4 and swells with each kick. The drop\'s DANCING NIGHTLY moved to the centre of the cornice from under the arrowhead.',
        'The kick lives only on the arrow and its puddle reflection. Jolt at 640x360: calm, kickArea 0.047, ratio 1.11 (build kick 0.04). The hot spots in heat.png are the arrow and its reflection; the other marks are the drop\'s chasing bulbs and the snare-switched starbursts.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.prev) this.init(); this.t0 = null; },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9));
      this.lastT = null; this.t0 = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickTimes = []; this.snareN = 0;
      this.low = 0; this.dense = false; this.denseAt = -10; this.calmAt = -10;
      this.bassEnv = 0; this.padEnv = 0; this.energy = 0;
      this.lv = {}; this.lit = {};
      this.splashes = [];
      this.twk = new Float32Array(140);
      this.ripple = 0; this.cloudX = 0; this.rainPh = 0;
      this.key = '';
      const r = mulberry(11);
      this.stars = [];
      for (let i = 0; i < 140; i++) {
        this.stars.push({ x: r(), y: Math.pow(r(), 1.4), m: 0.25 + r() * r() * 0.75, ph: r() * 6.28, f: 0.6 + r() * 1.8 });
      }
      this.drops = [];
      for (let i = 0; i < 220; i++) this.drops.push({ x: r(), y: r(), v: 0.8 + r() * 0.5, l: 0.5 + r(), z: r() });
      this.clouds = [];
      for (let i = 0; i < 7; i++) this.clouds.push({ x: r(), y: 0.06 + r() * 0.3, w: 160 + r() * 260, h: 18 + r() * 26, s: 0.5 + r() });
    },

    analyse(s, t, dt) {
      const b0 = s[0], b4 = s[4], bh = Math.max(s[7], s[8]);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      if (b0 > 45 && b0 - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t;
        this.kickTimes.push(t); if (this.kickTimes.length > 9) this.kickTimes.shift();
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.2) {
        this.lastSnare = t; this.snareN++;
      }
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.1) {
        this.lastHat = t;
        this.hatHit = true;
      }
      this.prev.set(s);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[0], s[1]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.08) : k(0.4));
      this.padEnv += ((s[2] + s[3]) / 200 - this.padEnv) * k(0.6);
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
      if (!this.dense && this.low > 27) { this.dense = true; this.denseAt = t; }
      else if (this.dense && this.low < 19) { this.dense = false; this.calmAt = t; }
    },

    beatPeriod() {
      const kt = this.kickTimes;
      if (kt.length < 3) return 0.484;
      const iv = [];
      for (let i = 1; i < kt.length; i++) iv.push(kt[i] - kt[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[iv.length >> 1];
      return med > 0.25 && med < 1.2 ? med : 0.484;
    },

    // Off-screen buffers, per device size: the light buffer at 1/2 and its
    // mip chain down to 1/32 (the glow), a reflection scratch at 1/2 and the
    // puddle mask that decides where the car park is a mirror.
    buffers(p, W, H, gY) {
      const pd = p.pixelDensity();
      const dw = Math.round(p.width * pd), dh = Math.round(p.height * pd);
      const key = dw + 'x' + dh + ':' + Math.round(gY);
      if (this.key === key) return;
      this.key = key;
      this.mips = [2, 4, 8, 16, 32].map((d) => mkCanvas(dw / d, dh / d));
      this.refl = mkCanvas(dw / 2, dh / 2);
      this.mask = mkCanvas(dw / 2, dh / 2);
      const a = dw / W; // device px per virtual unit
      const m = this.mask.getContext('2d');
      m.setTransform(a / 2, 0, 0, a / 2, 0, 0);
      const r = mulberry(5);
      for (let i = 0; i < 26; i++) {
        const x = r() * W, y = gY + 12 + Math.pow(r(), 0.8) * (H - gY);
        const depth = (y - gY) / (H - gY);
        const rx = (40 + r() * 150) * (0.5 + depth), ry = rx * (0.12 + 0.1 * depth);
        const g = m.createRadialGradient(x, y, 0, x, y, rx);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        m.save(); m.translate(x, y); m.scale(1, ry / rx); m.translate(-x, -y);
        m.fillStyle = g; m.beginPath(); m.arc(x, y, rx, 0, Math.PI * 2); m.fill(); m.restore();
      }
      this.puddles = [];
      for (let i = 0; i < 26; i++) { /* splash sites are sampled from the mask's own seed */ }
      const r2 = mulberry(5);
      for (let i = 0; i < 26; i++) {
        const x = r2() * W, y = gY + 12 + Math.pow(r2(), 0.8) * (H - gY);
        const depth = (y - gY) / (H - gY);
        const rx = (40 + r2() * 150) * (0.5 + depth); r2();
        this.puddles.push({ x, y, rx: rx * 0.6, depth });
      }
      // Asphalt: a dark ground with aggregate speckle, once per size.
      this.asphalt = mkCanvas(dw / 2, Math.max(1, (dh - gY * a) / 2));
      const q = this.asphalt.getContext('2d');
      const aw = this.asphalt.width, ah = this.asphalt.height;
      const g = q.createLinearGradient(0, 0, 0, ah);
      g.addColorStop(0, '#0d0b14'); g.addColorStop(1, '#07060a');
      q.fillStyle = g; q.fillRect(0, 0, aw, ah);
      for (let i = 0; i < aw * ah * 0.05; i++) {
        const v = 20 + r() * 30;
        q.fillStyle = 'rgba(' + v + ',' + (v - 2) + ',' + (v + 6) + ',' + (0.3 + r() * 0.5).toFixed(2) + ')';
        q.fillRect(r() * aw, r() * ah, 1, 1);
      }
    },

    // Every tube on the sign, in coordinates relative to the sign's centre
    // line (x) and absolute stage y. Rebuilt only when the size or words or
    // fonts change.
    layout(c, W, H, gY, params) {
      const fScript = face('Yellowtail', 'cursive');
      const fBlock = face('Bungee', 'Impact, sans-serif');
      const fSmall = face('Russo One', 'sans-serif');
      const name = String(params.name || '').trim() || 'Starbeat';
      const sub = (String(params.sub || '').trim() || 'DINER').toUpperCase().slice(0, 9);
      const key = [W, H, gY, name, sub, fScript, fBlock, fSmall].join('|');
      if (this.L && this.L.key === key) return this.L;
      const L = { key, name, sub };
      const roofY = gY - 125;
      const Y = (v) => roofY - 307 + v;
      L.roofY = roofY; L.Y0 = roofY - 307;

      // The script, sized to fit the cabinet.
      c.save();
      let sz = 124;
      c.font = sz + 'px ' + fScript;
      let w = c.measureText(name).width;
      if (w > 470) { sz = sz * 470 / w; w = 470; }
      L.scriptFont = sz.toFixed(1) + 'px ' + fScript;
      L.scriptY = Y(170); L.scriptW = w;

      // Channel letters, each its own tube so one can go bad.
      let bs = 44;
      c.font = bs + 'px ' + fBlock;
      const track = 10;
      let widths = sub.split('').map((ch) => c.measureText(ch).width);
      let tot = widths.reduce((a, b) => a + b, 0) + track * (sub.length - 1);
      if (tot > 300) { const f = 300 / tot; bs *= f; widths = widths.map((x) => x * f); tot = 300; }
      L.blockFont = bs.toFixed(1) + 'px ' + fBlock;
      L.letters = [];
      let x = -tot / 2;
      for (let i = 0; i < sub.length; i++) {
        L.letters.push({ ch: sub[i], x: x + widths[i] / 2 });
        x += widths[i] + track;
      }
      L.blockY = Y(266); L.panel = { x0: -tot / 2 - 26, x1: tot / 2 + 26, y0: Y(226), y1: Y(282) };
      L.bad = sub.length > 2 ? Math.floor(sub.length / 2) : 0;

      L.smallFont = '13px ' + fSmall;
      L.eatFont = '46px ' + fBlock;
      L.jukeFont = '26px ' + fScript;
      c.restore();

      // The Googie cabinet: a skewed, tapering slab behind the script.
      const cab = [[-290, Y(64)], [262, Y(34)], [300, Y(206)], [-262, Y(214)]];
      L.cab = cab;
      const cp = new Path2D();
      cp.moveTo(cab[0][0], cab[0][1]);
      for (let i = 1; i < 4; i++) cp.lineTo(cab[i][0], cab[i][1]);
      cp.closePath();
      L.cabPath = cp;
      // Marquee bulbs around the cabinet, inset from its edge.
      L.bulbs = [];
      const cxm = 5, cym = Y(130);
      for (let e = 0; e < 4; e++) {
        const a0 = cab[e], a1 = cab[(e + 1) % 4];
        const len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
        const n = Math.round(len / 17);
        for (let i = 0; i < n; i++) {
          const u = i / n;
          const px = lerp(a0[0], a1[0], u), py = lerp(a0[1], a1[1], u);
          L.bulbs.push([px + (cxm - px) * 0.035, py + (cym - py) * 0.1]);
        }
      }

      // The swash under the name (drop circuit).
      const sw = new Path2D();
      sw.moveTo(-w / 2 + 30, Y(196));
      sw.bezierCurveTo(-w / 2 + 140, Y(184), w / 2 - 80, Y(196), w / 2 + 26, Y(170));
      sw.moveTo(-w / 2 + 60, Y(204));
      sw.bezierCurveTo(-w / 2 + 160, Y(194), w / 2 - 90, Y(204), w / 2 + 6, Y(184));
      L.swash = sw;

      // Starbursts: two circuits each, long cardinals with short diagonals
      // and the reverse; the snare switches circuits.
      const burst = (x0, y0, R) => {
        const A = new Path2D(), B = new Path2D();
        for (let i = 0; i < 8; i++) {
          const ang = i * Math.PI / 4 + 0.12;
          const long = i % 2 === 0;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const pa = long ? A : B, pb = long ? B : A;
          pa.moveTo(x0 + ca * R * 0.22, y0 + sa * R * 0.22); pa.lineTo(x0 + ca * R, y0 + sa * R);
          pb.moveTo(x0 + ca * R * 0.22, y0 + sa * R * 0.22); pb.lineTo(x0 + ca * R * 0.55, y0 + sa * R * 0.55);
        }
        const core = new Path2D();
        core.arc(x0, y0, R * 0.12, 0, Math.PI * 2);
        return { A, B, core };
      };
      L.bursts = [burst(-286, Y(58), 44), burst(262, Y(28), 34), burst(-190, Y(8), 18)];

      // Boomerang (drop circuit), off the cabinet's right shoulder.
      const bm = new Path2D();
      const bx = 330, by = Y(128);
      bm.moveTo(bx - 60, by + 26);
      bm.quadraticCurveTo(bx - 4, by - 40, bx + 58, by - 18);
      bm.quadraticCurveTo(bx + 10, by - 16, bx - 38, by + 34);
      bm.closePath();
      bm.moveTo(bx - 50, by + 40);
      bm.quadraticCurveTo(bx + 20, by + 46, bx + 64, by + 84);
      bm.quadraticCurveTo(bx + 12, by + 62, bx - 42, by + 54);
      bm.closePath();
      L.boom = bm;

      // The arrow: from the cabinet's right end out, round and down to the
      // door. A tube outline with a line of chase bulbs inside it.
      const P0 = [300, Y(196)], P1 = [420, Y(206)], P2 = [360, Y(300)], P3 = [262, Y(318)];
      const N = 60, pts = [];
      for (let i = 0; i <= N; i++) pts.push(cubic(P0, P1, P2, P3, i / N));
      const nrm = (i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [-dy / l, dx / l];
      };
      const hw = 13, headN = N - 8;
      const ap = new Path2D();
      for (let i = 0; i <= headN; i++) {
        const n = nrm(i); const q = [pts[i][0] + n[0] * hw, pts[i][1] + n[1] * hw];
        if (i === 0) ap.moveTo(q[0], q[1]); else ap.lineTo(q[0], q[1]);
      }
      const nh = nrm(headN), tip = pts[N];
      ap.lineTo(pts[headN][0] + nh[0] * hw * 2.4, pts[headN][1] + nh[1] * hw * 2.4);
      ap.lineTo(tip[0], tip[1]);
      ap.lineTo(pts[headN][0] - nh[0] * hw * 2.4, pts[headN][1] - nh[1] * hw * 2.4);
      for (let i = headN; i >= 0; i--) {
        const n = nrm(i); ap.lineTo(pts[i][0] - n[0] * hw, pts[i][1] - n[1] * hw);
      }
      ap.closePath();
      L.arrow = ap;
      const head = new Path2D();
      head.moveTo(pts[headN][0] + nh[0] * hw * 1.4, pts[headN][1] + nh[1] * hw * 1.4);
      head.lineTo(pts[N - 2][0], pts[N - 2][1]);
      head.lineTo(pts[headN][0] - nh[0] * hw * 1.4, pts[headN][1] - nh[1] * hw * 1.4);
      L.head = head;
      L.arrowBulbs = [];
      for (let i = 2; i < headN; i += 2) L.arrowBulbs.push(pts[i]);

      // The EAT blade on its own pole, out front on the left.
      L.eat = { x: -420, y0: Y(112), y1: Y(290), w: 62 };
      L.eatBulbs = [];
      const e = L.eat;
      for (let yy = e.y0 + 8; yy < e.y1 - 4; yy += 15) { L.eatBulbs.push([e.x - e.w / 2 + 7, yy]); L.eatBulbs.push([e.x + e.w / 2 - 7, yy]); }

      this.L = L;
      return L;
    },

    // Level of each tube circuit, with the neon warm-up sputter when a tube
    // strikes and a quick fall when it is cut.
    level(id, want, t, delay) {
      let s = this.lit[id];
      if (!s) s = this.lit[id] = { on: false, at: -99 };
      if (want && !s.on) { s.on = true; s.at = t + (delay || 0); }
      if (!want && s.on) { s.on = false; s.at = t + (delay || 0); }
      const e = t - s.at;
      if (s.on) {
        if (e < 0) return this.lv[id] || 0;
        if (e < 0.4) {
          const h = hash(Math.floor(t * 30) * 131 + id.length * 7 + id.charCodeAt(0));
          return this.lv[id] = h < 0.45 + e ? 0.6 + e : 0.08;
        }
        return this.lv[id] = 1;
      }
      if (e < 0) return this.lv[id] || 0;
      return this.lv[id] = Math.max(0, 1 - e / 0.12) * (this.lv[id] > 0 ? 1 : 0);
    },

    draw(p, signals, params, ctx) {
      if (!this.prev) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (this.t0 === null) this.t0 = t;
      const age = t - this.t0;
      const W = ctx.width, H = ctx.height;
      const react = params.reaction;
      const G = GASES[clamp(Math.round(params.gas), 0, GASES.length - 1)];
      this.hatHit = false;
      this.analyse(signals, t, dt);
      const k = (tau) => 1 - Math.exp(-dt / tau);

      const gY = Math.round(Math.max(H * 0.72, H - 240));
      const cx = W / 2 - 20 + 9 * Math.sin(t * 0.045);
      const c = p.drawingContext;
      this.buffers(p, W, H, gY);
      const L = this.layout(c, W, H, gY, params);
      const M = c.getTransform();
      const a = M.a;
      const roofY = L.roofY;

      // ---- circuits ------------------------------------------------------
      const dense = this.dense;
      const lv = {};
      lv.script = this.level('script', age > 0.6, t);
      for (let i = 0; i < L.letters.length; i++) lv['L' + i] = this.level('L' + i, age > 1.3 + i * 0.22, t);
      lv.cornice = this.level('cornice', age > 2.4, t);
      lv.arrow = this.level('arrow', age > 2.9, t);
      lv.eat = this.level('eat', age > 3.4, t);
      lv.juke = this.level('juke', age > 2.0, t);
      lv.stars = this.level('stars', age > 3.8 && (this.energy > 0.12 || dense), t);
      // Drop circuit: on in sequence as the drop lands, off in reverse through
      // the breakdown so the exhale is visible.
      const dOn = ['swash', 'search', 'boom', 'dance', 'bulbs', 'eatb', 'dancers'];
      for (let i = 0; i < dOn.length; i++) {
        lv[dOn[i]] = this.level(dOn[i], dense, t, dense ? i * 0.12 : (dOn.length - 1 - i) * 0.4);
      }
      // Hum: the gas breathes a touch with the pad and bass, never with a kick.
      const hum = 0.9 + 0.1 * clamp(this.padEnv * 1.4 + this.bassEnv * 0.3, 0, 1);

      // The bad letter: a failing transformer. Episodes come and go; inside
      // one the letter stutters, and in the breakdown episodes are longer.
      const fl = params.flicker;
      if (L.letters.length && fl > 0) {
        const ep = hash(Math.floor(t * 0.6) + 999);
        const thr = fl * (dense ? 0.35 : 0.65);
        if (ep < thr) {
          const h = hash(Math.floor(t * 14) + 17);
          const b = h < 0.35 ? 0.06 : h < 0.55 ? 0.45 : 1;
          lv['L' + L.bad] *= b;
        } else if (hash(Math.floor(t * 9) + 5) < 0.04 * fl) lv['L' + L.bad] *= 0.3;
      }

      // Kick: a pulse runs down the arrow's bulbs to the door.
      const kp = (t - this.lastKick) / 0.3;
      const nB = L.arrowBulbs.length;
      const bulbLv = new Float32Array(nB);
      for (let i = 0; i < nB; i++) {
        const u = i / (nB - 1);
        const d = kp - u;
        let v = 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3 - i * 0.7));
        if (d > -0.15) v += react * (d < 0 ? Math.exp(-(d * d) / 0.004) : Math.exp(-d * 3.2)) * 0.9;
        bulbLv[i] = clamp(v, 0, 1.6) * lv.arrow;
      }
      const headFlare = lv.arrow * (0.35 + react * 0.9 * (kp > 0.9 ? Math.exp(-(kp - 0.9) * 2.4) : 0));
      const snA = (this.snareN % 2) === 0;
      // The arrow's own tube swells with the kick and settles back: the kick
      // lands on the arrow and nowhere else.
      lv.arrowOut = lv.arrow * clamp(0.4 + 0.75 * react * Math.exp(-(t - this.lastKick) / 0.28), 0, 1.3);

      // ---- the light buffer: every lit tube, flat gas colour ---------------
      const n1 = this.mips[0], g1 = n1.getContext('2d');
      g1.setTransform(1, 0, 0, 1, 0, 0);
      g1.globalCompositeOperation = 'source-over'; g1.globalAlpha = 1;
      g1.fillStyle = '#000'; g1.fillRect(0, 0, n1.width, n1.height);
      g1.setTransform(a / 2, 0, 0, a / 2, 0, 0);
      g1.translate(cx, 0);
      g1.globalCompositeOperation = 'lighter';
      this.windows(g1, L, gY, t, lv, true);
      this.tubes(g1, L, G, lv, bulbLv, headFlare, snA, hum, t, true);
      // Mip chain: each level is the one above halved, so the glow is the
      // tubes' own light spread wider at every step.
      for (let i = 1; i < this.mips.length; i++) {
        const src = this.mips[i - 1], dst = this.mips[i], gd = dst.getContext('2d');
        gd.setTransform(1, 0, 0, 1, 0, 0);
        gd.globalCompositeOperation = 'copy'; gd.globalAlpha = 1;
        gd.imageSmoothingEnabled = true; gd.imageSmoothingQuality = 'medium';
        gd.drawImage(src, 0, 0, dst.width, dst.height);
      }

      c.save();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';

      // ---- sky -------------------------------------------------------------
      const sky = c.createLinearGradient(0, 0, 0, gY);
      sky.addColorStop(0, '#04040c'); sky.addColorStop(0.55, '#0b0920'); sky.addColorStop(0.9, '#1e1234'); sky.addColorStop(1, '#2a1638');
      c.fillStyle = sky; c.fillRect(-2, -2, W + 4, gY + 4);
      // Stars: slow twinkle, and the hats set a few of them flashing.
      if (this.hatHit) {
        for (let j = 0; j < 5; j++) this.twk[Math.floor(this.rng() * this.stars.length)] = 0.6 + 0.4 * react;
      }
      const sway = cx - W / 2;
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        this.twk[i] *= Math.exp(-dt / 0.25);
        const x = ((s.x * (W + 80) + sway * 0.2) % (W + 80)) - 40, y = s.y * (gY - 60);
        let b = s.m * (0.65 + 0.35 * Math.sin(t * s.f + s.ph)) + this.twk[i];
        b *= 1 - 0.5 * smooth(y / (gY - 60));
        c.globalAlpha = clamp(b, 0, 1);
        c.fillStyle = '#e9e6ff';
        const r = 0.7 + s.m * 0.9;
        c.fillRect(x - r / 2, y - r / 2, r, r);
        if (this.twk[i] > 0.15) {
          c.globalAlpha = this.twk[i] * 0.7; c.strokeStyle = '#e9e6ff'; c.lineWidth = 0.6;
          const q = 3 + 5 * this.twk[i];
          c.beginPath(); c.moveTo(x - q, y); c.lineTo(x + q, y); c.moveTo(x, y - q); c.lineTo(x, y + q); c.stroke();
        }
      }
      c.globalAlpha = 1;
      // Moon, a thin crescent, high on the left.
      const mx = W / 2 - 400 + sway * 0.3, my = L.Y0 + 70;
      const halo = c.createRadialGradient(mx, my, 10, mx, my, 110);
      halo.addColorStop(0, 'rgba(190,190,230,0.16)'); halo.addColorStop(1, 'rgba(190,190,230,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(mx, my, 110, 0, Math.PI * 2); c.fill();
      c.save();
      c.beginPath(); c.arc(mx, my, 22, 0, Math.PI * 2); c.clip();
      c.fillStyle = '#efe9d6'; c.fillRect(mx - 24, my - 24, 48, 48);
      c.fillStyle = '#07061a'; c.beginPath(); c.arc(mx + 9, my - 4, 21, 0, Math.PI * 2); c.fill();
      c.restore();
      // Clouds, drifting, their bellies lit by the sign.
      this.cloudX += dt * (4 + 6 * this.energy);
      for (const cl of this.clouds) {
        const span = W + cl.w * 2;
        const x = ((cl.x * span + this.cloudX * cl.s) % span) - cl.w;
        const y = cl.y * gY;
        const near = Math.exp(-Math.pow((x + cl.w / 2 - cx) / 380, 2));
        const g = c.createLinearGradient(0, y - cl.h, 0, y + cl.h);
        g.addColorStop(0, 'rgba(14,12,30,0)');
        g.addColorStop(0.5, 'rgba(22,17,40,0.55)');
        g.addColorStop(1, 'rgba(' + Math.round(60 + 90 * near) + ',' + Math.round(24 + 10 * near) + ',' + Math.round(60 + 30 * near) + ',' + (0.25 + 0.3 * near).toFixed(2) + ')');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x + cl.w * 0.5, y, cl.w * 0.5, cl.h, 0, 0, Math.PI * 2);
        c.ellipse(x + cl.w * 0.3, y - cl.h * 0.35, cl.w * 0.25, cl.h * 0.8, 0, 0, Math.PI * 2);
        c.ellipse(x + cl.w * 0.68, y - cl.h * 0.2, cl.w * 0.22, cl.h * 0.7, 0, 0, Math.PI * 2);
        c.fill();
      }
      // Grand-opening searchlights behind the diner, drop only: two soft
      // beams crossing slowly over the sky.
      if (lv.search > 0.01) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const ox = cx + (i ? 250 : -300), oy = gY - 30;
          const ang = -Math.PI / 2 + (i ? -1 : 1) * (0.28 + 0.34 * Math.sin(t * 0.37 + i * 2.1));
          const len = gY * 1.6, spread = 0.045;
          const g = c.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
          g.addColorStop(0, 'rgba(170,180,255,' + (0.16 * lv.search).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(170,180,255,0)');
          c.fillStyle = g;
          c.beginPath(); c.moveTo(ox, oy);
          c.lineTo(ox + Math.cos(ang - spread) * len, oy + Math.sin(ang - spread) * len);
          c.lineTo(ox + Math.cos(ang + spread) * len, oy + Math.sin(ang + spread) * len);
          c.closePath(); c.fill();
        }
        c.restore();
      }
      // Mesa on the horizon, and a line of telegraph poles going away.
      c.fillStyle = '#150f26';
      c.beginPath();
      c.moveTo(-10, gY);
      const mesa = [[0, 38], [0.08, 44], [0.12, 72], [0.26, 76], [0.3, 50], [0.46, 46], [0.52, 58], [0.6, 60], [0.64, 40], [0.78, 36], [0.82, 64], [0.9, 68], [0.93, 42], [1, 40]];
      for (const m of mesa) c.lineTo(m[0] * (W + 20) - 10 + sway * 0.4, gY - m[1]);
      c.lineTo(W + 10, gY); c.closePath(); c.fill();
      c.strokeStyle = '#0a0814'; c.lineWidth = 1.2;
      const poleX = (i) => W - 40 - i * 90 * Math.pow(0.72, i) + sway * 0.6;
      for (let i = 0; i < 5; i++) {
        const s = Math.pow(0.72, i), x = poleX(i);
        c.lineWidth = 3 * s + 0.5;
        c.beginPath(); c.moveTo(x, gY + 6 * s); c.lineTo(x, gY - 170 * s); c.moveTo(x - 16 * s, gY - 160 * s); c.lineTo(x + 16 * s, gY - 160 * s); c.stroke();
      }
      c.lineWidth = 0.8;
      for (let w = -1; w <= 1; w += 2) {
        c.beginPath();
        for (let i = 0; i < 4; i++) {
          const s0 = Math.pow(0.72, i), s1 = Math.pow(0.72, i + 1);
          const x0 = poleX(i) + w * 14 * s0, y0 = gY - 160 * s0, x1 = poleX(i + 1) + w * 14 * s1, y1 = gY - 160 * s1;
          c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 10 * s0, x1, y1);
        }
        c.stroke();
      }

      // ---- the ground: asphalt, paint, reflection -------------------------
      c.drawImage(this.asphalt, 0, gY, W, H - gY);
      c.save(); c.translate(cx, 0);
      // Parking bays in perspective, faded paint.
      c.strokeStyle = 'rgba(200,196,180,0.16)';
      for (let i = -7; i <= 7; i++) {
        const xn = i * 70, xf = i * 150;
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(xn * 0.9, gY + 26); c.lineTo(xf, H + 4); c.stroke();
      }
      c.lineWidth = 2; c.beginPath(); c.moveTo(-600, gY + 26); c.lineTo(600, gY + 26); c.stroke();
      // Curb along the diner's foot.
      c.fillStyle = '#17131f'; c.fillRect(-520, gY - 2, 1000, 7);
      c.restore();

      this.ripple += dt * (1.2 + 3 * this.bassEnv);
      const wet = params.wet;
      if (wet > 0) {
        const rc = this.refl, gr = rc.getContext('2d');
        gr.setTransform(1, 0, 0, 1, 0, 0);
        gr.globalCompositeOperation = 'source-over'; gr.globalAlpha = 1;
        gr.clearRect(0, 0, rc.width, rc.height);
        gr.setTransform(a / 2, 0, 0, a / 2, 0, 0);
        gr.globalCompositeOperation = 'lighter';
        const span = H - gY, kk = Math.min(1.75, (gY - L.Y0 - 20) / span);
        const n = 64;
        const amp = 1.5 + 5 * this.bassEnv * react;
        const srcs = [[this.mips[0], 0.9], [this.mips[2], 1.2]];
        for (const [src, al] of srcs) {
          const sa = src.width / (W * 1);
          gr.globalAlpha = al;
          for (let i = 0; i < n; i++) {
            const d0 = i * span / n, d1 = (i + 1) * span / n;
            const depth = (d0 + d1) / 2 / span;
            const sy0 = gY - d1 * kk, sy1 = gY - d0 * kk;
            const dx = Math.sin(i * 0.8 + this.ripple * 2.1) * amp * (0.4 + depth) + Math.sin(i * 0.33 - this.ripple) * amp * 0.6;
            gr.save();
            gr.translate(0, gY + d0 + (d1 - d0) / 2);
            gr.scale(1, -1);
            gr.drawImage(src, 0, sy0 * sa, src.width, (sy1 - sy0) * sa, dx, -(d1 - d0) / 2 - 0.5, W, (d1 - d0) + 1);
            gr.restore();
          }
        }
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = clamp(0.22 * wet, 0, 1);
        c.drawImage(rc, 0, 0, W, H);
        gr.setTransform(1, 0, 0, 1, 0, 0);
        gr.globalAlpha = 1; gr.globalCompositeOperation = 'destination-in';
        gr.drawImage(this.mask, 0, 0);
        c.globalAlpha = clamp(0.75 * wet, 0, 1.5);
        c.drawImage(rc, 0, 0, W, H);
        c.restore();
      }
      // Rain rings open in the puddles: the hats, plus the rain itself.
      if (this.puddles && this.puddles.length) {
        const nNew = (this.hatHit ? Math.round(2 * react) : 0) + (this.rng() < params.rain * dt * 6 ? 1 : 0);
        for (let j = 0; j < nNew; j++) {
          const pd = this.puddles[Math.floor(this.rng() * this.puddles.length)];
          this.splashes.push({ x: pd.x + (this.rng() - 0.5) * pd.rx, y: pd.y + (this.rng() - 0.5) * 6, s: 0.5 + pd.depth, born: t });
        }
        this.splashes = this.splashes.filter((s) => t - s.born < 0.9);
        c.save();
        c.strokeStyle = '#f2c8e8'; c.lineWidth = 0.8;
        for (const s of this.splashes) {
          const e = (t - s.born) / 0.9;
          c.globalAlpha = 0.45 * (1 - e);
          c.beginPath(); c.ellipse(s.x, s.y, 3 + 22 * e * s.s, (1 + 5 * e) * s.s, 0, 0, Math.PI * 2); c.stroke();
        }
        c.restore();
      }

      // ---- the diner -------------------------------------------------------
      c.save();
      c.translate(cx, 0);
      this.building(c, L, gY, t, lv, W);
      this.chrome(c, L, gY, cx, a);
      this.sign(c, L, gY);
      c.restore();

      // ---- glow: the light buffer's mips, summed back ---------------------
      const gl = params.glow;
      if (gl > 0) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        const wts = [0, 0.32, 0.42, 0.55, 0.7];
        for (let i = 1; i < this.mips.length; i++) {
          c.globalAlpha = clamp(wts[i] * gl * hum, 0, 1);
          c.drawImage(this.mips[i], 0, 0, W, H);
        }
        c.restore();
      }

      // ---- the tubes themselves -------------------------------------------
      c.save();
      c.translate(cx, 0);
      this.tubes(c, L, G, lv, bulbLv, headFlare, snA, hum, t, false);
      c.restore();

      // ---- rain, in front of everything -----------------------------------
      const rain = params.rain;
      if (rain > 0) {
        this.rainPh += dt;
        c.save();
        c.lineWidth = 0.7;
        const nR = Math.round(this.drops.length * rain);
        for (let i = 0; i < nR; i++) {
          const d = this.drops[i];
          const sp = 520 * d.v * (0.6 + 0.4 * d.z);
          const y = ((d.y * (H + 60) + this.rainPh * sp) % (H + 60)) - 30;
          const x = d.x * (W + 60) - 30 - (y - H / 2) * 0.12;
          const len = (10 + 14 * d.z) * d.l;
          const near = Math.exp(-Math.pow((x - cx) / 330, 2)) * (y < gY ? 1 : 0.5);
          c.globalAlpha = (0.07 + 0.18 * near) * (0.5 + d.z);
          c.strokeStyle = near > 0.3 ? '#ffc6e6' : '#b9c2e6';
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + len * 0.12, y + len); c.stroke();
        }
        c.restore();
      }
      c.restore();
    },

    // The diner body: roof and cornice, lit windows with the counter and
    // (in the drop) dancers by the jukebox, the door vestibule.
    building(c, L, gY, t, lv, W) {
      const roofY = L.roofY;
      const x0 = -480, x1 = 430;
      // Body silhouette with streamlined rounded ends.
      c.fillStyle = '#100c18';
      c.beginPath();
      c.roundRect(x0, roofY - 8, x1 - x0, gY - roofY + 8, [30, 60, 4, 4]);
      c.fill();
      // Cornice band, enamel, lit a little from above.
      const cg = c.createLinearGradient(0, roofY - 8, 0, roofY + 20);
      cg.addColorStop(0, '#3a1a2c'); cg.addColorStop(1, '#1d0f1a');
      c.fillStyle = cg;
      c.beginPath(); c.roundRect(x0 + 2, roofY - 6, x1 - x0 - 4, 24, [26, 52, 0, 0]); c.fill();
      this.windows(c, L, gY, t, lv, false);
      // Door vestibule.
      c.fillStyle = '#16111d';
      c.fillRect(190, roofY + 10, 80, gY - roofY - 10);
      const dg = c.createLinearGradient(0, roofY + 30, 0, gY);
      dg.addColorStop(0, 'rgba(255,208,140,0.85)'); dg.addColorStop(1, 'rgba(200,120,60,0.6)');
      c.fillStyle = dg; c.fillRect(208, roofY + 30, 44, gY - roofY - 34);
      c.strokeStyle = '#2a2230'; c.lineWidth = 3; c.strokeRect(208, roofY + 30, 44, gY - roofY - 34);
      c.beginPath(); c.moveTo(230, roofY + 30); c.lineTo(230, gY - 4); c.stroke();
      c.fillStyle = '#231a2a'; c.fillRect(182, roofY + 8, 96, 8);
    },

    windows(c, L, gY, t, lv, light) {
      const roofY = L.roofY;
      const y0 = roofY + 26, y1 = roofY + 76;
      const cols = [];
      for (let x = -452; x < 400; x += 40) { if (x + 36 > 186 && x < 274) continue; cols.push(x); }
      if (light) {
        c.globalAlpha = 0.2;
        c.fillStyle = '#ffb45c';
        for (const x of cols) c.fillRect(x, y0, 36, y1 - y0);
        c.fillRect(208, roofY + 30, 44, gY - roofY - 34);
        c.globalAlpha = 1;
        return;
      }
      const wg = c.createLinearGradient(0, y0, 0, y1);
      wg.addColorStop(0, '#f0c488'); wg.addColorStop(0.6, '#d9894a'); wg.addColorStop(1, '#8e4630');
      c.fillStyle = wg;
      for (const x of cols) c.fillRect(x, y0, 36, y1 - y0);
      // Interior: counter, stools, a few regulars; a waitress drifts along.
      c.save();
      c.beginPath(); for (const x of cols) c.rect(x, y0, 36, y1 - y0); c.clip();
      c.fillStyle = 'rgba(40,18,24,0.85)';
      c.fillRect(-460, y1 - 16, 870, 16);
      c.fillStyle = 'rgba(120,60,50,0.5)'; c.fillRect(-460, y0, 870, 6);
      const people = [-400, -330, -236, -150, -60, 20, 110, 330];
      c.fillStyle = 'rgba(30,14,22,0.92)';
      for (let i = 0; i < people.length; i++) {
        const x = people[i] + 4 * Math.sin(t * 0.5 + i * 2);
        c.beginPath(); c.arc(x, y1 - 30, 7, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.roundRect(x - 11, y1 - 23, 22, 14, 6); c.fill();
      }
      const wx = -420 + ((t * 18) % 820);
      c.beginPath(); c.arc(wx, y0 + 14, 6, 0, Math.PI * 2); c.fill();
      c.fillRect(wx - 8, y0 + 20, 16, 22);
      // Dancers by the jukebox, drop only: a couple bobbing on the beat.
      const dn = lv.dancers || 0;
      if (dn > 0.02) {
        const per = this.beatPeriod();
        const ph = ((t - this.lastKick) / per) % 1;
        const bob = Math.abs(Math.cos(ph * Math.PI)) * 4;
        c.globalAlpha = dn;
        c.fillStyle = 'rgba(30,14,22,0.95)';
        for (let j = 0; j < 2; j++) {
          const x = -276 + j * 22, lean = (j ? -1 : 1) * Math.sin(t * 2.2) * 3;
          c.beginPath(); c.arc(x + lean, y0 + 12 + bob, 6, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.moveTo(x - 7, y1); c.lineTo(x + lean - 6, y0 + 20 + bob); c.lineTo(x + lean + 6, y0 + 20 + bob); c.lineTo(x + 7, y1); c.fill();
          c.lineWidth = 3; c.strokeStyle = 'rgba(30,14,22,0.95)';
          c.beginPath(); c.moveTo(x + lean, y0 + 24 + bob); c.lineTo(x + lean + (j ? -12 : 12) , y0 + 10 + bob * 2 - (j ? 0 : 6)); c.stroke();
        }
        c.globalAlpha = 1;
      }
      c.restore();
      // Mullions.
      c.fillStyle = '#1a1420';
      for (const x of cols) { c.fillRect(x - 4, y0 - 2, 4, y1 - y0 + 4); }
      c.fillRect(-460, y0 - 4, 650, 4); c.fillRect(274, y0 - 4, 132, 4);
    },

    // Stainless flank: horizontal fluting that smears the sign's light.
    chrome(c, L, gY, cx, a) {
      const roofY = L.roofY;
      const y0 = roofY + 80, y1 = gY - 8;
      const x0 = -478, x1 = 428;
      c.save();
      c.beginPath(); c.roundRect(x0, y0, x1 - x0, y1 - y0, [0, 0, 4, 4]);
      c.rect(186, y0, 88, y1 - y0);
      c.clip('evenodd');
      const bg = c.createLinearGradient(0, y0, 0, y1);
      bg.addColorStop(0, '#3a3552'); bg.addColorStop(0.35, '#151222'); bg.addColorStop(0.7, '#2a2238'); bg.addColorStop(1, '#0c0a12');
      c.fillStyle = bg; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      // The sign above, flipped and squashed into the band.
      const src = this.mips[2];
      const sa = src.width / (c.canvas.width / a);
      const sy0 = L.Y0, sy1 = roofY + 76;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.9;
      c.save();
      c.translate(-cx, y0);
      c.scale(1, -(y1 - y0) / (sy1 - sy0));
      c.translate(0, -sy1);
      c.drawImage(src, 0, sy0 * sa, src.width, (sy1 - sy0) * sa, 0, sy0, c.canvas.width / a, sy1 - sy0);
      c.restore();
      c.globalCompositeOperation = 'source-over';
      // Flutes.
      for (let y = y0 + 3; y < y1; y += 5) {
        c.globalAlpha = 0.5; c.fillStyle = '#07060b'; c.fillRect(x0, y, x1 - x0, 1.2);
        c.globalAlpha = 0.14; c.fillStyle = '#ffffff'; c.fillRect(x0, y + 1.6, x1 - x0, 0.8);
      }
      c.restore();
    },

    // Sign hardware: the enamel cabinet, the channel-letter panel, posts.
    sign(c, L, gY) {
      const roofY = L.roofY;
      c.fillStyle = '#1b1520';
      c.fillRect(-120, L.panel.y1, 8, roofY - 6 - L.panel.y1);
      c.fillRect(112, L.panel.y1, 8, roofY - 6 - L.panel.y1);
      c.fillRect(-160, L.cab[3][1] - 4, 8, L.panel.y0 - L.cab[3][1] + 6);
      c.fillRect(150, L.cab[2][1] - 4, 8, L.panel.y0 - L.cab[2][1] + 6);
      // EAT blade pole.
      c.fillRect(L.eat.x - 4, L.eat.y1, 8, gY - L.eat.y1);
      // Cabinet: dark teal enamel, a lighter rim.
      const cg = c.createLinearGradient(0, L.cab[1][1], 0, L.cab[3][1]);
      cg.addColorStop(0, '#12303a'); cg.addColorStop(1, '#0a1a22');
      c.fillStyle = cg; c.fill(L.cabPath);
      c.strokeStyle = '#294a52'; c.lineWidth = 5; c.stroke(L.cabPath);
      c.strokeStyle = '#0a1318'; c.lineWidth = 1.5; c.stroke(L.cabPath);
      // Channel-letter panel, oxblood enamel.
      const P = L.panel;
      c.fillStyle = '#2a0c14';
      c.beginPath(); c.roundRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, 6); c.fill();
      c.strokeStyle = '#46202a'; c.lineWidth = 3; c.stroke();
      // Blade.
      const e = L.eat;
      c.fillStyle = '#240d10';
      c.beginPath(); c.roundRect(e.x - e.w / 2, e.y0, e.w, e.y1 - e.y0, 8); c.fill();
      c.strokeStyle = '#3e1c20'; c.lineWidth = 3; c.stroke();
      // Channel letter faces, painted, before their tubes.
      c.font = L.blockFont; c.fillStyle = '#4a1822';
      for (const le of L.letters) c.fillText(le.ch, le.x, L.blockY);
    },

    // All neon. `light` = the light buffer pass (flat gas colour, fat), else
    // the visible tubes: glass when cold, gas colour with a hot core when lit.
    tubes(c, L, G, lv, bulbLv, headFlare, snA, hum, t, light) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const GLASS = 'rgba(190,200,225,0.16)';
      // One tube drawn by `fn(stroke?)`, at level l.
      const tube = (col, l, lw, fn) => {
        if (light) {
          if (l <= 0.01) return;
          c.globalAlpha = clamp(l * hum, 0, 1); c.strokeStyle = col[0]; c.fillStyle = col[0]; c.lineWidth = lw * 1.8;
          fn(); return;
        }
        c.globalAlpha = 1; c.strokeStyle = GLASS; c.fillStyle = GLASS; c.lineWidth = lw; fn();
        if (l <= 0.01) return;
        c.globalAlpha = clamp(l, 0, 1); c.strokeStyle = col[0]; c.fillStyle = col[0]; c.lineWidth = lw; fn();
        c.globalAlpha = clamp(l * 0.9, 0, 1); c.strokeStyle = col[1]; c.fillStyle = col[1]; c.lineWidth = lw * 0.38; fn();
      };
      const strokeP = (path) => () => c.stroke(path);

      // Script: the name, set on a slight climb.
      c.save();
      c.translate(0, L.scriptY); c.rotate(-0.07); c.translate(0, -L.scriptY);
      c.font = L.scriptFont;
      {
        const l = lv.script;
        if (light) {
          if (l > 0.01) {
            c.globalAlpha = clamp(l * hum, 0, 1); c.fillStyle = G.script[0]; c.strokeStyle = G.script[0]; c.lineWidth = 5;
            c.strokeText(L.name, 0, L.scriptY); c.fillText(L.name, 0, L.scriptY);
          }
        } else {
          c.globalAlpha = 1; c.fillStyle = GLASS; c.fillText(L.name, 0, L.scriptY);
          if (l > 0.01) {
            c.globalAlpha = clamp(l, 0, 1); c.strokeStyle = G.script[0]; c.lineWidth = 3.2;
            c.strokeText(L.name, 0, L.scriptY);
            c.fillStyle = G.script[1]; c.globalAlpha = clamp(l * 0.92, 0, 1);
            c.fillText(L.name, 0, L.scriptY);
          }
        }
      }
      tube(G.block, lv.swash, 3.2, strokeP(L.swash));
      c.restore();

      // Channel letters, outline tubing.
      c.font = L.blockFont;
      for (let i = 0; i < L.letters.length; i++) {
        const le = L.letters[i];
        tube(G.block, lv['L' + i], 2.6, () => c.strokeText(le.ch, le.x, L.blockY));
      }

      // Starbursts.
      for (let i = 0; i < L.bursts.length; i++) {
        const b = L.bursts[i];
        const a = (i % 2 === 0) === snA;
        tube(G.star, lv.stars * (a ? 1 : 0.02), 2.4, strokeP(b.A));
        tube(G.star, lv.stars * (a ? 0.02 : 1), 2.4, strokeP(b.B));
        tube(G.star, lv.stars, 2.4, strokeP(b.core));
      }
      tube(G.boom, lv.boom, 2.8, strokeP(L.boom));

      // Arrow: outline tube, chase bulbs, and the head.
      tube(G.arrow, lv.arrowOut, 2.8, strokeP(L.arrow));
      for (let i = 0; i < L.arrowBulbs.length; i++) {
        const [x, y] = L.arrowBulbs[i];
        const l = bulbLv[i];
        if (light) {
          c.globalAlpha = clamp(l, 0, 1); c.fillStyle = G.arrow[0];
          c.beginPath(); c.arc(x, y, 4 + 5 * Math.max(0, l - 0.5), 0, Math.PI * 2); c.fill();
        } else {
          c.globalAlpha = 1; c.fillStyle = '#3a2a24';
          c.beginPath(); c.arc(x, y, 3.4, 0, Math.PI * 2); c.fill();
          c.globalAlpha = clamp(l, 0, 1); c.fillStyle = l > 0.7 ? G.arrow[1] : G.arrow[0];
          c.beginPath(); c.arc(x, y, 3.1, 0, Math.PI * 2); c.fill();
        }
      }
      tube(G.arrow, clamp(headFlare, 0, 1.4), 3.2, strokeP(L.head));

      // Cabinet marquee bulbs (drop): chasing in threes.
      if (lv.bulbs > 0.01) {
        const n = L.bulbs.length, off = Math.floor(t * 9);
        for (let i = 0; i < n; i++) {
          const on = ((i + off) % 3) === 0 ? 1 : 0.22;
          const l = lv.bulbs * on;
          const [x, y] = L.bulbs[i];
          c.globalAlpha = clamp(l, 0, 1);
          c.fillStyle = light ? '#ffd27a' : (on > 0.5 ? '#fff4d8' : '#e8b060');
          c.beginPath(); c.arc(x, y, light ? 3.4 : 2.2, 0, Math.PI * 2); c.fill();
        }
      }

      // EAT blade: letters, and its border bulbs in the drop.
      const e = L.eat;
      c.font = L.eatFont;
      const eatY = [e.y0 + 56, e.y0 + 114, e.y0 + 172];
      'EAT'.split('').forEach((ch, i) => tube(G.eat, lv.eat, 2.4, () => c.strokeText(ch, e.x, eatY[i])));
      if (lv.eatb > 0.01) {
        const off = Math.floor(t * 7);
        for (let i = 0; i < L.eatBulbs.length; i++) {
          const on = ((Math.floor(i / 2) + off) % 4) < 2 ? 1 : 0.2;
          const [x, y] = L.eatBulbs[i];
          c.globalAlpha = clamp(lv.eatb * on, 0, 1);
          c.fillStyle = light ? '#ffd27a' : '#fff0cc';
          c.beginPath(); c.arc(x, y, light ? 3 : 2, 0, Math.PI * 2); c.fill();
        }
      }

      // Cornice lettering and the jukebox window.
      const roofY = L.roofY;
      c.font = L.smallFont;
      c.textAlign = 'left';
      tube(G.cornice, lv.cornice, 1.3, () => c.strokeText('BREAKFAST ANYTIME  •  JUKEBOX', -440, roofY + 12));
      c.textAlign = 'center';
      tube(G.cornice, lv.dance, 1.3, () => c.strokeText('DANCING NIGHTLY', 0, roofY + 12));
      c.font = L.jukeFont;
      tube(G.juke, lv.juke, 1.6, () => c.strokeText('Jukebox', -330, roofY + 58));
      c.globalAlpha = 1;
    },
  });
})();
