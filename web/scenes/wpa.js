// WPA: a silkscreened public-works travel poster for an invented lake resort,
// alive at dusk. Every colour is one flat screen-printed ink, each ink pulled
// through its own screen and landing slightly out of register, so thin slivers
// of paper show between plates and the registration breathes as the paper
// shifts. A paper border and a solid text band frame the picture, as on the
// 1930s National Parks and public-works posters.
//
// The picture: a stepped sky (a split of five inks, not a gradient), a moon
// with a stepped halo, streamline clouds, a faceted snow range and a nearer
// teal range, a lake that mirrors them in broken horizontal strokes, a lodge
// on the near shore with its windows lit and chimney smoke, framing pines,
// a flock crossing.
//
// Music, each in its own place:
//   kick   the moon's halo steps out one ink band and a small flat-ink firework
//          breaks with a ring spreading on the lake below it; in the drop the
//          bursts are full size, with their reflections laid in the lake
//   snare  the flock beats its wings, the lodge windows change which are lit;
//          in the drop, a crackle of paper-white dots round the last burst
//   hats   stars twinkle; a hat onset sparks a few of them into four-point stars
//   bass   the warm horizon inks rise into the sky, the moon path widens,
//          the whole picture drifts faster (clouds, birds, parallax)
//   drop   a transparent overprint of sun-rays fans out from the moon, the
//          fireworks begin, the squeegee pulls a new text band with the
//          headline; the breakdown pulls a quiet band and mist lies on the lake
//
// No glow: overlaps are multiply (a transparent ink over a dry one), grain is
// the paper, and everything else is opaque flat colour.

(function () {
  // Inks per poster. sky: five bands top to horizon.
  const INKS = [
    {
      name: 'Dusk lake',
      paper: '#EFE5CC',
      sky: ['#1F2B40', '#3A3558', '#7A4458', '#D2703D', '#EBB04E'],
      moon: '#F4E7C4', halo: ['#F0CE86', '#E7A457'],
      far: '#A06C7A', farSh: '#6C4863', snow: '#F2E4C4',
      mid: '#2F6B72', midSh: '#1E4B56',
      lake: '#22505A', lakeDk: '#173A46', lakeLt: '#E7A457',
      near: '#172233', wall: '#8C4450', roof: '#172233', win: '#F3C552',
      cloud: '#F0C98A', cloudSh: '#B8645A',
      band: '#172233', head: '#EBB04E', sub: '#EFE5CC',
      fire: ['#F3C552', '#EF8A4E'], ray: '#E9C38E', bird: '#172233',
    },
    {
      name: 'Moonlight',
      paper: '#ECE6D6',
      sky: ['#101C30', '#172A45', '#223C5E', '#35587A', '#6D8FA3'],
      moon: '#F2EAD0', halo: ['#C9D2C8', '#8FA8B4'],
      far: '#9FB2BF', farSh: '#6D8598', snow: '#F2EAD0',
      mid: '#27415F', midSh: '#18293F',
      lake: '#1A2E48', lakeDk: '#0F1E33', lakeLt: '#9FB2BF',
      near: '#0B1422', wall: '#3F5A74', roof: '#0B1422', win: '#F0BF45',
      cloud: '#C6D3D6', cloudSh: '#51708A',
      band: '#F0BF45', head: '#101C30', sub: '#101C30',
      fire: ['#F0BF45', '#E8E0C8'], ray: '#BFC9C9', bird: '#0B1422',
    },
    {
      name: 'Canyon heat',
      paper: '#F1E2C6',
      sky: ['#5B2433', '#9A3533', '#D2542F', '#EC8A3A', '#F4C063'],
      moon: '#FBEBC4', halo: ['#F7D48A', '#F0A456'],
      far: '#C2703E', farSh: '#8E3F2E', snow: '#F6DDB0',
      mid: '#5E7C6A', midSh: '#3A5548',
      lake: '#2F6468', lakeDk: '#1F4649', lakeLt: '#F4C063',
      near: '#2A1A22', wall: '#D2542F', roof: '#2A1A22', win: '#F4C063',
      cloud: '#F9D9A2', cloudSh: '#D06A4B',
      band: '#2F6468', head: '#F4C063', sub: '#F1E2C6',
      fire: ['#F9E3AA', '#2F6468'], ray: '#F2C28A', bird: '#2A1A22',
    },
    {
      name: 'Evergreen',
      paper: '#EDE7D2',
      sky: ['#23413C', '#3F6A5E', '#7FA08A', '#C9C99A', '#EAD9A4'],
      moon: '#F6EED4', halo: ['#EFE4B8', '#D7D1A2'],
      far: '#8FA7A0', farSh: '#5F7D78', snow: '#F6EED4',
      mid: '#2C5446', midSh: '#1B3A30',
      lake: '#2C5446', lakeDk: '#1B3A30', lakeLt: '#EAD9A4',
      near: '#13241E', wall: '#B5432F', roof: '#13241E', win: '#F2CE5C',
      cloud: '#F6EED4', cloudSh: '#9DB39D',
      band: '#B5432F', head: '#F6EED4', sub: '#F6EED4',
      fire: ['#F2CE5C', '#B5432F'], ray: '#E7DDB0', bird: '#13241E',
    },
  ];
  const FIRE_MODES = ['In the drop', 'Always', 'Never'];

  // Text bands. $P is the place name, $H the drop headline.
  const CALM_BANDS = [
    { top: 'MUSIC UNDER THE STARS', head: '$P', sub: 'DANCES NIGHTLY AT THE LODGE  ·  BRING SOMEONE TO SWAY WITH' },
    { top: 'THE NIGHT SHIFT OF SUMMER', head: '$P', sub: 'A BANDSTAND ON THE WATER  ·  LANTERNS UNTIL LATE' },
    { top: 'HEAR THE MOUNTAINS HUM', head: '$P', sub: 'OPEN AIR DANCING  ·  THE LAST BOAT LEAVES AT DAWN' },
  ];
  const DROP_BANDS = [
    { top: 'FIREWORKS OVER THE WATER', head: '$H', sub: '$P  ·  EVERY SATURDAY  ·  ALL NIGHT LONG' },
    { top: 'THE WHOLE VALLEY DANCING', head: '$H', sub: '$P  ·  THE BAND PLAYS ON  ·  THE SKY JOINS IN' },
  ];
  const HUSH_BANDS = [
    { top: 'THE LAKE AT REST', head: '$P', sub: 'LISTEN  ·  THE WATER KEEPS THE BEAT' },
    { top: 'AFTER THE LAST WALTZ', head: '$P', sub: 'MIST ON THE WATER  ·  A LIGHT STILL ON' },
  ];

  const HEAD_FONT = '"Josefin Sans", "Futura", "Century Gothic", sans-serif';
  const SUB_FONT = '"Oswald", "Arial Narrow", sans-serif';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (i, j) => { const r = mulberry(i * 7919 + j * 104729 + 13); r(); return r(); };

  VIZ.register({
    id: 'wpa',
    name: 'WPA',
    order: 515,
    params: [
      { key: 'place', label: 'Place name', type: 'text', default: 'LAKE WENNOCK' },
      { key: 'headline', label: 'Drop headline', type: 'text', default: 'DANCE TILL DAWN' },
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'fireworks', label: 'Fireworks', type: 'select', options: FIRE_MODES, default: 0 },
      { key: 'drift', label: 'Drift speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'register', label: 'Misregistration', type: 'range', min: 0, max: 4, default: 1, step: 0.01 },
    ],
    gallery: {
      title: 'WPA',
      technique: 'Canvas 2D: flat screen-print ink layers, each offset by its own breathing registration vector; multiply overprint for rays; a pre-rendered paper-and-salt grain pass',
      brief: 'A silkscreened 1930s public-works travel poster for an invented lake resort at dusk: a stepped five-ink sky, a moon with a stepped halo, streamline clouds, a faceted snow range, a lake of broken horizontal strokes, a lodge with lit windows and chimney smoke, framing pines and a crossing flock, in flat inks slightly out of register on cream paper. Kicks spread rings on the lake and, in the drop, burst fireworks over the water with their reflections laid below; claps beat the flock\'s wings and change the lit windows (and crackle round the last burst in the drop); hats twinkle the stars; the bass lifts the warm horizon inks and speeds the drift. The drop fans a transparent overprint of rays from the moon and a squeegee pulls a new text band with the headline; the breakdown pulls a quiet band and lays mist on the water.',
      lineage: 'The WPA Federal Art Project and National Parks silkscreen posters (flat layered colour, bold geometric sans in a solid band, stepped skies) and streamline-era cloud drawing. Process: read the batch-05 brief and TASTE, planned the kick as a local event (a lake ring, then drop fireworks confined to one patch of sky and its reflection) so the frame never pumps; built the landscape as ink layers each with its own registration offset so paper slivers appear between plates; first pass merged the dark shore into the same-ink text band and scattered too many salt pinholes, so a paper gutter now separates picture and band and the salt was cut to a few per cent; the first jolt read calm but tiny (kickArea 0.014), so the bursts were enlarged, made to open faster and given a flat eight-point break at the heart (kickArea 0.027, one clear hot spot per kick); a canoe crossing the lake was added for continuous travel; checked all four ink sets, 1280x720 and a 96 s run. Review said the non-drop kick was too quiet, so every kick now steps the moon halo out by one ink band and outside the drop a single small firework breaks with its lake ring (kickArea 0.063 build, 0.068 drop, still calm).',
    },

    setup(p) { this.reset(); },
    enter(p) { this.reset(); },

    reset() {
      this.t = null;
      this.prev = new Float32Array(9);
      this.lastKick = -9; this.lastSnare = -9; this.lastHat = -9;
      this.low = 0; this.bassEnv = 0; this.energy = 0; this.hatEnv = 0;
      this.dense = false; this.hadDrop = false;
      this.dropAmt = 0; this.mist = 0;
      this.phase = 0; this.cloudX = 0; this.canoeX = 0.15;
      this.ripples = []; this.bursts = []; this.haloRings = [];
      this.sparks = [];
      this.flapAt = -9; this.winSeed = 1;
      this.burstIdx = 0;
      this.band = null; this.oldBand = null; this.pullAt = -9;
      this.calmIdx = 0; this.dropIdx = 0; this.hushIdx = 0;
      this.flock = null;
      this.geoKey = '';
    },

    // ---------- music ----------
    analyse(s, t, dt, params, W, geo) {
      const react = params.reaction;
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.onKick(t, params, W, geo);
      }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - this.lastSnare > 0.14) {
        this.lastSnare = t; this.onSnare(t, params);
      }
      const bh = Math.max(s[7], s[8]);
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) {
        this.lastHat = t;
        const n = 2 + Math.floor(3 * clamp(react, 0, 2));
        for (let i = 0; i < n; i++) this.sparks.push({ i: Math.floor(Math.random() * 400), at: t });
        if (this.sparks.length > 40) this.sparks.splice(0, this.sparks.length - 40);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (s[1] - this.low) * k(0.9);
      const bass = Math.max(s[1], s[2]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.25) : k(0.8));
      let tot = 0; for (let i = 0; i < 9; i++) tot += s[i];
      this.energy += (clamp(tot / 400, 0, 1) - this.energy) * k(1.2);
      this.hatEnv += (bh / 100 - this.hatEnv) * (bh / 100 > this.hatEnv ? k(0.02) : k(0.18));
    },

    firesOn(params) {
      const m = Math.round(params.fireworks);
      return m === 1 || (m === 0 && this.dense);
    },

    onKick(t, params, W, geo) {
      // Every kick steps the moon's halo out by one ink band. Fireworks carry
      // the kick into one patch of sky: full bursts in the drop, a single small
      // one otherwise (unless fireworks are off), each with a ring below it.
      this.haloRings.push({ at: t });
      const mode = Math.round(params.fireworks);
      const big = this.firesOn(params);
      const x = big || mode !== 2 ? this.burstSlot(geo) : geo.moonX + (Math.random() - 0.5) * geo.ih * 0.5;
      if (big || mode !== 2) {
        const y = lerp(geo.skyTop, geo.yL, (big ? 0.28 : 0.36) + 0.2 * Math.random());
        const R = geo.ih * (big ? 0.21 + 0.06 * Math.random() : 0.16) * (0.6 + 0.4 * clamp(params.reaction, 0, 2));
        this.bursts.push({ x, y, R, at: t, ink: this.burstIdx % 2, n: big ? 16 + (this.burstIdx % 3) * 4 : 12, rot: Math.random() * 6, crackle: -9 });
        this.burstIdx++;
        if (this.bursts.length > 8) this.bursts.shift();
      }
      this.ripples.push({ x, y: lerp(geo.yL, geo.lakeBot, 0.3 + 0.2 * Math.random()), at: t, big: 1 });
      if (this.ripples.length > 10) this.ripples.shift();
      if (this.haloRings.length > 5) this.haloRings.shift();
    },

    burstSlot(geo) {
      // Bursts walk across the sky in a fixed order that keeps clear of the moon.
      const slots = [0.2, 0.44, 0.84, 0.32, 0.9, 0.12, 0.54, 0.74];
      const sx = slots[this.burstIdx % slots.length];
      return geo.x0 + (geo.x1 - geo.x0) * sx + (Math.random() - 0.5) * 20;
    },

    onSnare(t, params) {
      this.flapAt = t;
      this.winSeed = (this.winSeed * 5 + 3) % 97;
      if (this.firesOn(params) && this.bursts.length) {
        this.bursts[this.bursts.length - 1].crackle = t;
      }
    },

    // ---------- geometry ----------
    layout(W, H) {
      const m = Math.min(W, H) * 0.028;
      const bandH = H * 0.2;
      const x0 = m, x1 = W - m, skyTop = m;
      const imgBot = H - m - bandH - m * 0.7;
      const bandTop = H - m - bandH;
      const ih = imgBot - skyTop;
      const g = {
        W, H, m, bandH, bandTop, x0, x1, skyTop, imgBot, ih,
        yL: skyTop + ih * 0.64,
        lakeBot: skyTop + ih * 0.95,
        moonX: lerp(x0, x1, 0.62), moonY: skyTop + ih * 0.3, moonR: ih * 0.075,
      };
      const r = mulberry(4242);
      // Ranges: peaks and valleys over a span wider than the stage so the
      // parallax sway never shows an edge.
      const range = (baseY, topLo, topHi, spacing, spurJit) => {
        const pts = [];
        let x = x0 - 160;
        let vy = baseY - (baseY - topHi) * 0.25;
        pts.push({ x, y: vy, peak: false });
        while (x < x1 + 160) {
          const sp = spacing * (0.7 + 0.6 * r());
          const px = x + sp * (0.35 + 0.3 * r());
          const py = lerp(topHi, topLo, r());
          const vx = x + sp;
          const vyy = lerp(py, baseY, 0.35 + 0.35 * r());
          pts.push({ x: px, y: py, peak: true, spur: 0.2 + spurJit * r(), snow: r() });
          pts.push({ x: vx, y: vyy, peak: false });
          x = vx;
        }
        return pts;
      };
      g.far = range(g.yL, skyTop + ih * 0.46, skyTop + ih * 0.26, ih * 0.42, 0.35);
      g.mid = range(g.yL + 1, skyTop + ih * 0.6, skyTop + ih * 0.5, ih * 0.3, 0.3);
      // Near-shore pines: left framing cluster and a few right.
      g.pines = [];
      const shore = (x) => this.shoreY(g, x);
      g.pines.push({ x: x0 + (x1 - x0) * 0.055, base: imgBot + 4, h: ih * 0.93, w: ih * 0.2, big: true });
      g.pines.push({ x: x0 + (x1 - x0) * 0.13, base: imgBot + 4, h: ih * 0.62, w: ih * 0.15, big: true });
      for (let i = 0; i < 9; i++) {
        const fx = 0.16 + 0.22 * r();
        const x = x0 + (x1 - x0) * fx;
        g.pines.push({ x, base: shore(x) + 6, h: ih * (0.12 + 0.14 * r()), w: ih * 0.06 });
      }
      for (let i = 0; i < 6; i++) {
        const fx = 0.86 + 0.17 * r();
        const x = x0 + (x1 - x0) * fx;
        g.pines.push({ x, base: shore(x) + 6, h: ih * (0.16 + 0.18 * r()), w: ih * 0.07 });
      }
      g.pines.sort((a, b) => a.h - b.h);
      g.lodge = { x: x0 + (x1 - x0) * 0.72, w: ih * 0.24, h: ih * 0.075 };
      g.lodge.y = shore(g.lodge.x);
      g.stars = [];
      for (let i = 0; i < 90; i++) {
        g.stars.push({ x: lerp(x0, x1, r()), y: lerp(skyTop, skyTop + ih * 0.3, Math.pow(r(), 1.3)), s: 0.6 + r(), ph: r() * 6.28 });
      }
      g.clouds = [];
      for (let i = 0; i < 5; i++) {
        const caps = [];
        const n = 2 + Math.floor(r() * 3);
        const len = ih * (0.35 + 0.35 * r());
        for (let j = 0; j < n; j++) caps.push({ dx: (r() - 0.3) * len * 0.35, dy: j * ih * 0.028, len: len * (1 - j * 0.18) * (0.7 + 0.3 * r()) });
        g.clouds.push({ fx: r(), y: lerp(skyTop + ih * 0.1, skyTop + ih * 0.42, r()), caps, depth: 0.4 + 0.6 * r(), th: ih * 0.03 });
      }
      g.clouds.sort((a, b) => a.depth - b.depth);
      return g;
    },

    shoreY(g, x) {
      const f = (x - g.x0) / (g.x1 - g.x0);
      let y = g.skyTop + g.ih * 0.925 + Math.sin(f * 7.1) * g.ih * 0.012;
      // The ground rises to the pines on the left.
      y -= g.ih * 0.1 * clamp(1 - f / 0.35, 0, 1);
      y -= g.ih * 0.04 * clamp((f - 0.85) / 0.15, 0, 1);
      return y;
    },

    // ---------- drawing helpers ----------
    regOff(i, t, amt) {
      // Every ink has its own screen and lands in its own place; the paper
      // creeps slowly, so registration breathes rather than jitters.
      const a = hash(i, 3) * 6.283;
      const r = (0.6 + 0.8 * hash(i, 5)) * amt;
      return [Math.cos(a) * r + Math.sin(t * 0.21 + i * 1.7) * 0.5 * amt, Math.sin(a) * r + Math.cos(t * 0.17 + i * 2.3) * 0.5 * amt];
    },

    pine(c, x, base, h, w) {
      const tiers = 5;
      c.beginPath();
      for (let k = 0; k < tiers; k++) {
        const top = base - h + (h * 0.82) * (k / tiers) * 0.95;
        const bot = base - h * 0.18 - (h * 0.82) * (1 - (k + 1) / tiers) * 0.95 + h * 0.06;
        const ww = w * (0.35 + 0.65 * (k + 1) / tiers);
        c.moveTo(x, top);
        c.lineTo(x + ww * 0.5, bot);
        c.lineTo(x + ww * 0.12, bot - h * 0.03);
        c.lineTo(x - ww * 0.12, bot - h * 0.03);
        c.lineTo(x - ww * 0.5, bot);
        c.closePath();
      }
      c.rect(x - w * 0.05, base - h * 0.2, w * 0.1, h * 0.2);
      c.fill();
    },

    ridgePath(c, pts, base, ox) {
      c.beginPath();
      c.moveTo(pts[0].x + ox, base);
      for (const q of pts) c.lineTo(q.x + ox, q.y);
      c.lineTo(pts[pts.length - 1].x + ox, base);
      c.closePath();
    },

    drawRange(c, pts, base, ox, lit, sh, snow, snowAmt, regLit, regSh, regSnow) {
      c.save(); c.translate(regLit[0], regLit[1]);
      c.fillStyle = lit; this.ridgePath(c, pts, base, ox); c.fill();
      c.restore();
      c.save(); c.translate(regSh[0], regSh[1]);
      c.fillStyle = sh;
      c.beginPath();
      for (let i = 1; i < pts.length - 1; i++) {
        const pk = pts[i]; if (!pk.peak) continue;
        const v = pts[i + 1];
        const sx = pk.x + (v.x - pk.x) * pk.spur;
        c.moveTo(pk.x + ox, pk.y);
        c.lineTo(v.x + ox, v.y);
        c.lineTo(v.x + ox, base);
        c.lineTo(sx + ox, base);
        c.lineTo(lerp(pk.x, sx, 0.5) + ox + 3, lerp(pk.y, base, 0.5));
        c.closePath();
      }
      c.fill();
      c.restore();
      if (!snow) return;
      c.save(); c.translate(regSnow[0], regSnow[1]);
      c.fillStyle = snow;
      c.beginPath();
      for (let i = 1; i < pts.length - 1; i++) {
        const pk = pts[i]; if (!pk.peak || pk.snow < 0.25) continue;
        const L = pts[i - 1], v = pts[i + 1];
        const d = snowAmt * (0.22 + 0.2 * pk.snow);
        const lx = lerp(pk.x, L.x, d), ly = lerp(pk.y, L.y, d);
        const sx = pk.x + (v.x - pk.x) * pk.spur;
        const bx = lerp(pk.x, lerp(pk.x, sx, 0.5) + 3, d * 1.6), by = lerp(pk.y, lerp(pk.y, base, 0.5), d * 1.6);
        c.moveTo(pk.x + ox, pk.y);
        c.lineTo(lx + ox, ly);
        // A ragged snow line, three teeth down the lit face.
        for (let k = 1; k <= 5; k++) {
          const f = k / 6;
          const tx = lerp(lx, bx, f), ty = lerp(ly, by, f) + (k % 2 ? 1 : -0.4) * (by - pk.y) * 0.25;
          c.lineTo(tx + ox, ty);
        }
        c.lineTo(bx + ox, by);
        c.closePath();
      }
      c.fill();
      c.restore();
    },

    capsule(c, x, y, len, th) {
      const r = th / 2;
      c.moveTo(x + r, y);
      c.lineTo(x + len - r, y);
      c.arc(x + len - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      c.lineTo(x + r, y + th);
      c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
      c.closePath();
    },

    makeGrain(p) {
      const w = Math.round(p.width * p.pixelDensity()), h = Math.round(p.height * p.pixelDensity());
      const key = w + 'x' + h;
      if (this.grainKey === key) return;
      this.grainKey = key;
      const r = mulberry(77);
      const mk = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
      // Multiply pass: soft mottling of the ink film plus dark specks.
      const dark = mk(); const dg = dark.getContext('2d');
      const id = dg.createImageData(w, h); const d = id.data;
      const salt = mk(); const sg = salt.getContext('2d');
      const is = sg.createImageData(w, h); const e = is.data;
      const cell = Math.max(2, Math.round(Math.min(w, h) / 180));
      const cw = Math.ceil(w / cell) + 2, ch = Math.ceil(h / cell) + 2;
      const cells = new Float32Array(cw * ch);
      for (let i = 0; i < cells.length; i++) cells[i] = r();
      for (let y = 0; y < h; y++) {
        const cy = y / cell, iy = Math.floor(cy), fy = cy - iy;
        for (let x = 0; x < w; x++) {
          const cx = x / cell, ix = Math.floor(cx), fx = cx - ix;
          const a = cells[iy * cw + ix], b = cells[iy * cw + ix + 1], c2 = cells[(iy + 1) * cw + ix], d2 = cells[(iy + 1) * cw + ix + 1];
          const mott = lerp(lerp(a, b, fx), lerp(c2, d2, fx), fy);
          const n = r();
          let v = 255 - mott * 20 - n * 14;
          if (n > 0.9975) v -= 70;
          const o = (y * w + x) * 4;
          d[o] = v; d[o + 1] = v * 0.99; d[o + 2] = v * 0.97; d[o + 3] = 255;
          // Salt: pinholes where the ink did not take.
          const sa = n < 0.0025 ? 130 : (n < 0.008 ? 45 : 0);
          e[o] = 250; e[o + 1] = 244; e[o + 2] = 228; e[o + 3] = sa;
        }
      }
      dg.putImageData(id, 0, 0); sg.putImageData(is, 0, 0);
      this.grainDark = dark; this.grainSalt = salt;
    },

    resolveBand(spec, params) {
      const place = (params.place || 'LAKE WENNOCK').toUpperCase();
      const head = (params.headline || 'DANCE TILL DAWN').toUpperCase();
      const sub = (s) => s.replace('$P', place).replace('$H', head);
      return { top: sub(spec.top), head: sub(spec.head), sub: sub(spec.sub), drop: spec.head === '$H' };
    },

    drawBand(c, band, g, ink, t) {
      const y0 = g.bandTop, x0 = g.x0, x1 = g.x1, bh = g.bandH;
      c.fillStyle = ink.band;
      c.fillRect(x0, y0, x1 - x0, bh);
      const bw = x1 - x0;
      // Headline: widely tracked geometric sans, fitted to the band.
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      let fs = bh * 0.52;
      c.font = '700 ' + fs.toFixed(1) + 'px ' + HEAD_FONT;
      const track = band.drop ? 0.06 : 0.14;
      c.letterSpacing = (fs * track).toFixed(1) + 'px';
      let tw = c.measureText(band.head).width;
      const maxW = bw * 0.9;
      if (tw > maxW) { fs *= maxW / tw; c.font = '700 ' + fs.toFixed(1) + 'px ' + HEAD_FONT; c.letterSpacing = (fs * track).toFixed(1) + 'px'; }
      c.fillStyle = ink.head;
      c.fillText(band.head, (x0 + x1) / 2 + fs * track / 2, y0 + bh * 0.08 + fs * 0.8);
      let ss = bh * 0.13;
      c.font = '400 ' + ss.toFixed(1) + 'px ' + SUB_FONT;
      c.letterSpacing = (ss * 0.22).toFixed(1) + 'px';
      tw = c.measureText(band.sub).width;
      if (tw > maxW) { ss *= maxW / tw; c.font = '400 ' + ss.toFixed(1) + 'px ' + SUB_FONT; c.letterSpacing = (ss * 0.22).toFixed(1) + 'px'; }
      c.fillStyle = ink.sub;
      c.fillText(band.sub, (x0 + x1) / 2, y0 + bh * 0.86);
      // Two thin rules either side of the subline.
      c.fillRect(x0 + bw * 0.04, y0 + bh * 0.66, bw * 0.92, Math.max(1, bh * 0.012));
      c.letterSpacing = '0px';
    },

    // ---------- frame ----------
    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.t === null ? 1 / 60 : clamp(t - this.t, 0, 0.1);
      this.t = t;
      const ink = INKS[clamp(Math.round(params.inks), 0, INKS.length - 1)];
      const key = W.toFixed(1) + 'x' + H.toFixed(1);
      if (this.geoKey !== key) { this.geo = this.layout(W, H); this.geoKey = key; }
      const g = this.geo;
      this.makeGrain(p);

      this.analyse(signals, t, dt, params, W, g);
      const react = clamp(params.reaction, 0, 2);

      // Sections, with hysteresis so one quiet bar does not flip the poster.
      let change = null;
      if (!this.dense && this.low > 27) { this.dense = true; this.hadDrop = true; change = 'drop'; }
      else if (this.dense && this.low < 19) { this.dense = false; change = 'hush'; }
      if (!this.band) { this.band = this.resolveBand(CALM_BANDS[0], params); this.bandSpec = CALM_BANDS[0]; }
      if (change) {
        let spec;
        if (change === 'drop') spec = DROP_BANDS[this.dropIdx++ % DROP_BANDS.length];
        else spec = HUSH_BANDS[this.hushIdx++ % HUSH_BANDS.length];
        this.oldBand = this.band; this.bandSpec = spec;
        this.pullAt = t;
      } else if (!this.dense && this.hadDrop && t - this.pullAt > 40) {
        // A long calm: pull the next calm print so the poster keeps changing.
        this.calmIdx++;
        this.oldBand = this.band; this.bandSpec = CALM_BANDS[this.calmIdx % CALM_BANDS.length];
        this.pullAt = t;
      }
      this.band = this.resolveBand(this.bandSpec, params);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.dropAmt += ((this.dense ? 1 : 0) - this.dropAmt) * k(this.dense ? 0.9 : 2.5);
      this.mist += ((!this.dense && this.hadDrop ? 1 : 0) - this.mist) * k(3);

      const drift = params.drift;
      const speed = drift * (0.35 + 1.1 * this.energy + 0.6 * this.bassEnv);
      this.phase += dt * speed;
      this.cloudX += dt * speed * 9;
      const sway = Math.sin(this.phase * 0.09) * 26 + Math.sin(this.phase * 0.031 + 1) * 14;
      const regAmt = clamp(params.register, 0, 4) * 1.4 + this.bassEnv * 0.6 * clamp(params.register, 0, 4);
      const reg = (i) => this.regOff(i, t, regAmt);

      p.colorMode(p.RGB, 255);
      const c = p.drawingContext;
      c.save();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.lineCap = 'round'; c.lineJoin = 'round';

      // Paper.
      c.fillStyle = ink.paper;
      c.fillRect(-2, -2, W + 4, H + 4);

      // Image area clip (the picture sits inside the paper border).
      c.save();
      c.beginPath(); c.rect(g.x0, g.skyTop, g.x1 - g.x0, g.imgBot - g.skyTop); c.clip();

      // Sky: five stepped inks. The bass lifts the warm lower inks upward.
      const skyH = g.yL - g.skyTop + 4;
      const lift = this.bassEnv * 0.09 * (0.5 + 0.5 * react) + this.dropAmt * 0.05;
      const edges = [0, 0.3 - lift * 0.4, 0.5 - lift * 0.8, 0.66 - lift, 0.8 - lift * 0.9, 1];
      for (let i = 0; i < 5; i++) {
        const o = reg(i === 0 ? 0 : 1 + (i % 2));
        c.fillStyle = ink.sky[i];
        const ya = g.skyTop + skyH * edges[i], yb = g.skyTop + skyH * edges[i + 1];
        c.fillRect(g.x0 - 10 + o[0], ya + o[1] - (i ? 0 : 10), g.x1 - g.x0 + 20, yb - ya + 1 + (i ? 0 : 10) + (i === 4 ? 10 : 0));
      }

      // Stars: tiny ink dots that twinkle with the hats; recent hat onsets
      // spark a few into four-point stars.
      const starFade = clamp(1 - lift * 2, 0.4, 1);
      c.fillStyle = ink.moon;
      const so = reg(7);
      for (let i = 0; i < g.stars.length; i++) {
        const s = g.stars[i];
        const tw = 0.55 + 0.45 * Math.sin(t * (1.3 + s.s) + s.ph) * (0.4 + this.hatEnv);
        const rr = s.s * 0.9 * tw * starFade;
        if (rr <= 0.15) continue;
        c.beginPath(); c.arc(s.x + sway * 0.03 + so[0], s.y + so[1], rr, 0, 6.283); c.fill();
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const sp = this.sparks[i];
        const a = t - sp.at;
        if (a > 0.6) { this.sparks.splice(i, 1); continue; }
        const s = g.stars[sp.i % g.stars.length];
        const e = Math.sin(clamp(a / 0.6, 0, 1) * Math.PI);
        const L = (4 + 6 * s.s) * e * (0.5 + 0.5 * react);
        const x = s.x + sway * 0.03 + so[0], y = s.y + so[1];
        c.beginPath();
        c.moveTo(x, y - L); c.lineTo(x + L * 0.18, y - L * 0.18); c.lineTo(x + L, y); c.lineTo(x + L * 0.18, y + L * 0.18);
        c.lineTo(x, y + L); c.lineTo(x - L * 0.18, y + L * 0.18); c.lineTo(x - L, y); c.lineTo(x - L * 0.18, y - L * 0.18);
        c.closePath(); c.fill();
      }

      // Rays: a transparent ink overprinted in the drop, fanning from the moon.
      const mx = g.moonX + sway * 0.05, my = g.moonY;
      if (this.dropAmt > 0.02) {
        const o = reg(8);
        c.save();
        c.fillStyle = ink.ray;
        c.globalAlpha = 0.2 * Math.min(1, this.dropAmt * 1.5);
        const n = 14;
        const rot = this.phase * 0.05 + t * 0.02;
        const half = (Math.PI / n) * 0.5 * this.dropAmt;
        const Rr = Math.hypot(W, H);
        c.beginPath();
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 2;
          c.moveTo(mx + o[0], my + o[1]);
          c.arc(mx + o[0], my + o[1], Rr, a - half, a + half);
          c.closePath();
        }
        c.fill();
        c.restore();
      }

      // Moon and its stepped halo; kicks outside the drop throw a halo ring.
      {
        const o1 = reg(3), o2 = reg(4);
        const hr = g.moonR * (1 + this.bassEnv * 0.15);
        // A kick steps the halo out by one ink band: the outer band jumps a
        // full band wider and the inner band takes the outer's place, then
        // they ease back. It is the same flat print, one ring bigger, not a flash.
        let step = 0;
        for (let i = this.haloRings.length - 1; i >= 0; i--) {
          const a = t - this.haloRings[i].at;
          if (a > 0.8) { this.haloRings.splice(i, 1); continue; }
          const e = a < 0.12 ? 1 : 1 - (a - 0.12) / 0.68;
          step = Math.max(step, e * e * (3 - 2 * e));
        }
        step *= 0.5 + 0.5 * react;
        c.fillStyle = ink.halo[1];
        c.beginPath(); c.arc(mx + o2[0], my + o2[1], hr * (2.3 + 2.2 * step), 0, 6.283); c.fill();
        c.fillStyle = ink.halo[0];
        c.beginPath(); c.arc(mx + o1[0], my + o1[1], hr * (1.6 + 1.1 * step), 0, 6.283); c.fill();
        c.fillStyle = ink.moon;
        c.beginPath(); c.arc(mx, my, g.moonR, 0, 6.283); c.fill();
      }

      // Streamline clouds: stacked capsules, a lit ink over a shadow ink.
      {
        const oS = reg(5), oL = reg(6);
        const span = (g.x1 - g.x0) + g.ih * 1.6;
        for (const cl of g.clouds) {
          let x = g.x0 - g.ih * 0.8 + ((cl.fx * span + this.cloudX * cl.depth) % span);
          x += sway * 0.08 * cl.depth;
          const th = cl.th * (0.8 + 0.4 * cl.depth);
          c.fillStyle = ink.cloudSh;
          c.beginPath();
          for (const cp of cl.caps) this.capsule(c, x + cp.dx + oS[0], cl.y + cp.dy + th * 0.35 + oS[1], cp.len, th);
          c.fill();
          c.fillStyle = ink.cloud;
          c.beginPath();
          for (const cp of cl.caps) this.capsule(c, x + cp.dx + oL[0] - 2, cl.y + cp.dy + oL[1], cp.len * 0.94, th * 0.72);
          c.fill();
        }
      }

      // Fireworks: flat ink dashes that drift down and shorten.
      const burstInk = (b) => ink.fire[b.ink];
      for (let i = this.bursts.length - 1; i >= 0; i--) {
        const b = this.bursts[i];
        const a = t - b.at;
        if (a > 2.2) { this.bursts.splice(i, 1); continue; }
        const grow = 1 - Math.exp(-a * 13);
        const fall = a * a * 10;
        const life = clamp(1 - a / 2.2, 0, 1);
        const o = reg(9 + b.ink);
        // The break: a flat eight-point star of the other ink at the heart,
        // gone in a third of a second.
        if (a < 0.35) {
          const e = 1 - a / 0.35;
          const sr = b.R * 0.45 * e * (0.6 + 0.4 * react);
          const bx = b.x + sway * 0.1 + o[0], by = b.y + o[1];
          c.fillStyle = ink.fire[1 - b.ink];
          c.beginPath();
          for (let j = 0; j < 16; j++) {
            const rr = j % 2 ? sr * 0.32 : sr;
            const ang = b.rot + (j / 16) * 6.283;
            c.lineTo(bx + Math.cos(ang) * rr, by + Math.sin(ang) * rr);
          }
          c.closePath(); c.fill();
        }
        c.strokeStyle = burstInk(b);
        c.lineWidth = 4.2 * (0.45 + 0.55 * life);
        c.beginPath();
        for (let j = 0; j < b.n; j++) {
          const ang = b.rot + (j / b.n) * 6.283;
          const r1 = b.R * grow, r0 = r1 * (0.45 + 0.4 * (1 - life));
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const bx = b.x + sway * 0.1 + o[0], by = b.y + o[1];
          c.moveTo(bx + ca * r0, by + sa * r0 + fall * 0.6);
          c.lineTo(bx + ca * r1, by + sa * r1 + fall);
        }
        c.stroke();
        c.fillStyle = ink.fire[1 - b.ink];
        const dr = b.R * grow * 0.42;
        for (let j = 0; j < 8; j++) {
          const ang = b.rot * 1.7 + (j / 8) * 6.283;
          c.beginPath();
          c.arc(b.x + sway * 0.1 + Math.cos(ang) * dr, b.y + Math.sin(ang) * dr + fall * 0.5, 2.6 * life + 0.4, 0, 6.283);
          c.fill();
        }
        if (b.crackle > 0) {
          const ca = t - b.crackle;
          if (ca < 0.7) {
            c.fillStyle = ink.moon;
            const cr = b.R * (1.05 + ca * 0.8);
            for (let j = 0; j < 22; j++) {
              const ang = j * 2.4 + b.rot;
              const rr = cr * (0.85 + 0.3 * hash(j, i));
              c.beginPath();
              c.arc(b.x + sway * 0.1 + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr + fall, 2.2 * (1 - ca / 0.7) + 0.3, 0, 6.283);
              c.fill();
            }
          }
        }
      }

      // Birds: a loose flock crossing; claps make them beat their wings.
      {
        if (!this.flock || this.flock.x > g.x1 + 120) {
          const n = 7 + Math.floor(Math.random() * 5);
          const birds = [];
          for (let i = 0; i < n; i++) birds.push({ dx: -i * 16 - Math.random() * 10, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 7 + Math.random() * 5, ph: Math.random() * 6 });
          this.flock = { x: g.x0 - 140, y: lerp(g.skyTop + g.ih * 0.12, g.skyTop + g.ih * 0.38, Math.random()), birds };
        }
        this.flock.x += dt * (18 + 30 * this.energy) * (0.3 + drift);
        const fa = t - this.flapAt;
        const flap = fa < 0.5 ? Math.sin(fa * 30) * (1 - fa / 0.5) : 0;
        c.strokeStyle = ink.bird;
        c.lineWidth = 2;
        c.beginPath();
        for (const b of this.flock.birds) {
          const x = this.flock.x + b.dx + sway * 0.15, y = this.flock.y + b.dy + Math.sin(t * 0.8 + b.ph) * 2;
          const wv = Math.sin(t * 3 + b.ph) * 0.4 + flap * (1.4 * react);
          const s = 6.5;
          c.moveTo(x - s, y - s * 0.35 * wv - 1);
          c.quadraticCurveTo(x - s * 0.45, y - s * 0.55 - s * 0.4 * wv, x, y);
          c.quadraticCurveTo(x + s * 0.45, y - s * 0.55 - s * 0.4 * wv, x + s, y - s * 0.35 * wv - 1);
        }
        c.stroke();
      }

      // Mountains: far snow range, then the nearer teal range.
      this.drawRange(c, g.far, g.yL + 6, sway * 0.12, ink.far, ink.farSh, ink.snow, 1, reg(10), reg(11), reg(12));
      this.drawRange(c, g.mid, g.yL + 6, sway * 0.3, ink.mid, ink.midSh, null, 0, reg(13), reg(14), null);

      // Lake.
      {
        const o = reg(15);
        c.fillStyle = ink.lake;
        c.fillRect(g.x0 - 10, g.yL + o[1], g.x1 - g.x0 + 20, g.imgBot - g.yL + 10);
        c.save();
        c.beginPath(); c.rect(g.x0, g.yL + o[1], g.x1 - g.x0, g.lakeBot - g.yL + 30); c.clip();
        // Mirrored ranges, squashed, in the deep lake ink.
        c.fillStyle = ink.lakeDk;
        const mir = (pts, ox, sq) => {
          c.beginPath();
          c.moveTo(pts[0].x + ox, g.yL);
          for (const q of pts) c.lineTo(q.x + ox, g.yL + (g.yL - q.y) * sq);
          c.lineTo(pts[pts.length - 1].x + ox, g.yL);
          c.closePath(); c.fill();
        };
        mir(g.far, sway * 0.12, 0.45);
        mir(g.mid, sway * 0.3, 0.5);
        // Broken horizontal strokes: lake-coloured gaps cut through the
        // reflection, drifting, so it shimmers like the printed water it is.
        const rows = 16;
        const lh = g.lakeBot + 20 - g.yL;
        c.fillStyle = ink.lake;
        for (let r = 0; r < rows; r++) {
          const y = g.yL + 3 + lh * (r / rows) * (0.6 + 0.4 * r / rows);
          const th = 1.2 + r * 0.25;
          const sp = (r % 2 ? 1 : -1) * (6 + r * 1.5) * (0.4 + speed);
          for (let j = 0; j < 7; j++) {
            const len = 40 + 90 * hash(r, j);
            const span = g.x1 - g.x0 + 200;
            const x = g.x0 - 100 + ((hash(j, r + 30) * span + t * sp) % span + span) % span;
            c.fillRect(x, y, len, th);
          }
        }
        // Moon path: dashes widening with the bass.
        c.fillStyle = ink.lakeLt;
        const pr = g.moonR * (0.9 + 0.8 * this.bassEnv * (0.5 + 0.5 * react));
        for (let r = 0; r < 12; r++) {
          const f = r / 12;
          const y = g.yL + 4 + (g.lakeBot - g.yL) * f * 1.05;
          const hw = pr * (0.5 + 1.3 * f) * (0.75 + 0.25 * Math.sin(t * 1.4 + r * 1.9));
          const gap = hw * (0.25 + 0.2 * Math.sin(t * 0.9 + r * 2.7));
          const cx = mx + Math.sin(t * 0.7 + r) * 3 + sway * 0.4 * f;
          c.fillRect(cx - hw, y, hw - gap * 0.5, 1.6 + f * 2.2);
          c.fillRect(cx + gap * 0.5, y, hw - gap * 0.5, 1.6 + f * 2.2);
        }
        // Firework reflections: a column of dashes in the burst's ink.
        for (const b of this.bursts) {
          const a = t - b.at;
          const life = clamp(1 - a / 2.2, 0, 1) * (1 - Math.exp(-a * 7));
          c.fillStyle = burstInk(b);
          const bx = b.x + sway * 0.1 + sway * 0.25;
          for (let r = 0; r < 9; r++) {
            const f = r / 9;
            const y = g.yL + 6 + (g.lakeBot - g.yL) * f * 0.95;
            const hw = b.R * 0.35 * life * (0.5 + f) * (0.7 + 0.3 * Math.sin(t * 3 + r * 2.1));
            if (hw < 0.5) continue;
            c.fillRect(bx - hw + Math.sin(t * 2 + r) * 3, y, hw * 2, 1.5 + f * 2);
          }
        }
        // Ripples from kicks: flattened rings of the light lake ink.
        c.strokeStyle = ink.lakeLt;
        for (let i = this.ripples.length - 1; i >= 0; i--) {
          const rp = this.ripples[i];
          const a = t - rp.at;
          if (a > 1.6) { this.ripples.splice(i, 1); continue; }
          const f = a / 1.6;
          const R = g.ih * 0.32 * rp.big * (0.4 + 0.6 * react) * (1 - Math.pow(1 - f, 3));
          for (let q = 0; q < 2; q++) {
            const rr = R * (1 - q * 0.38);
            if (rr < 2) continue;
            c.globalAlpha = (1 - f) * (q ? 0.75 : 1);
            c.lineWidth = (6 - q * 2) * (1 - f * 0.6);
            c.beginPath(); c.ellipse(rp.x + sway * 0.4, rp.y, rr, rr * 0.16, 0, 0, 6.283); c.stroke();
          }
        }
        c.globalAlpha = 1;
        // A canoe crossing the lake, paddle dipping, a wake opening behind.
        {
          this.canoeX += dt * (0.004 + 0.01 * speed);
          if (this.canoeX > 1.15) this.canoeX = -0.15;
          const cx = lerp(g.x0, g.x1, this.canoeX) + sway * 0.45;
          const cy = lerp(g.yL, g.lakeBot, 0.5);
          const s = g.ih * 0.045;
          c.strokeStyle = ink.lakeLt;
          c.lineWidth = 1.4;
          c.globalAlpha = 0.8;
          c.beginPath();
          c.moveTo(cx - s * 2.2, cy + s * 0.15); c.lineTo(cx - s * 9, cy - s * 0.5);
          c.moveTo(cx - s * 2.2, cy + s * 0.35); c.lineTo(cx - s * 9, cy + s * 1.1);
          c.stroke();
          c.globalAlpha = 1;
          c.fillStyle = ink.near;
          c.beginPath();
          c.moveTo(cx - s * 2.6, cy - s * 0.25);
          c.quadraticCurveTo(cx, cy + s * 0.9, cx + s * 2.6, cy - s * 0.25);
          c.lineTo(cx - s * 2.6, cy - s * 0.25);
          c.closePath(); c.fill();
          const st = Math.sin(t * 2.2 * (0.6 + 0.6 * speed));
          c.beginPath(); c.arc(cx + s * 0.5, cy - s * 1.7, s * 0.38, 0, 6.283); c.fill();
          c.fillRect(cx + s * 0.2, cy - s * 1.4, s * 0.6, s * 1.2);
          c.strokeStyle = ink.near; c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(cx + s * 0.5 + st * s * 0.8, cy - s * 1.9);
          c.lineTo(cx + s * 0.5 - st * s * 1.2, cy + s * 0.6);
          c.stroke();
        }
        // Mist after the drop: flat pale bands lying on the water.
        if (this.mist > 0.02) {
          c.globalAlpha = 0.55 * this.mist;
          c.fillStyle = ink.cloud;
          c.beginPath();
          for (let j = 0; j < 4; j++) {
            const span = g.x1 - g.x0 + 400;
            const x = g.x0 - 200 + ((hash(j, 90) * span + t * (8 + j * 3)) % span);
            this.capsule(c, x, g.yL + 4 + j * (g.lakeBot - g.yL) * 0.2, g.ih * (0.5 + 0.3 * hash(j, 91)), 5 + j);
          }
          c.fill();
          c.globalAlpha = 1;
        }
        c.restore();
      }

      // Near shore, lodge and pines in the key (darkest) ink.
      {
        const oK = reg(0);
        const ox = sway * 0.6 + oK[0], oy = oK[1];
        c.fillStyle = ink.near;
        c.beginPath();
        c.moveTo(g.x0 - 60, g.imgBot + 10);
        for (let x = g.x0 - 60; x <= g.x1 + 60; x += 12) c.lineTo(x + ox, this.shoreY(g, x) + oy);
        c.lineTo(g.x1 + 60, g.imgBot + 10);
        c.closePath(); c.fill();

        // Lodge: gable roof, walls, lit windows, a stone chimney and dock.
        const L = g.lodge;
        const lx = L.x + ox, ly = L.y + oy - 2;
        const oW = reg(16);
        c.fillStyle = ink.wall;
        c.fillRect(lx - L.w / 2 + oW[0], ly - L.h + oW[1], L.w, L.h + 4);
        c.fillStyle = ink.win;
        const nw = 7;
        for (let i = 0; i < nw; i++) {
          const lit = this.dense ? (hash(i, this.winSeed) > 0.15) : (hash(i, this.winSeed) > 0.45 - 0.2 * (1 - this.mist));
          if (!lit) continue;
          const wx = lx - L.w / 2 + L.w * (0.1 + 0.8 * (i + 0.5) / nw) - L.w * 0.028;
          c.fillRect(wx, ly - L.h * 0.72, L.w * 0.056, L.h * 0.42);
        }
        c.fillStyle = ink.roof;
        c.beginPath();
        c.moveTo(lx - L.w * 0.6, ly - L.h + 1);
        c.lineTo(lx - L.w * 0.36, ly - L.h - L.h * 0.9);
        c.lineTo(lx + L.w * 0.36, ly - L.h - L.h * 0.9);
        c.lineTo(lx + L.w * 0.6, ly - L.h + 1);
        c.closePath(); c.fill();
        c.fillRect(lx + L.w * 0.2, ly - L.h * 2.3, L.w * 0.07, L.h * 0.8);
        // Dock into the lake.
        c.fillRect(lx - L.w * 0.95, ly - 1, L.w * 0.5, 3);
        for (let i = 0; i < 4; i++) c.fillRect(lx - L.w * 0.93 + i * L.w * 0.14, ly, 2, 7);
        // Chimney smoke: flat puffs rising and leaning with the drift.
        c.fillStyle = ink.cloud;
        const ch = [lx + L.w * 0.235, ly - L.h * 2.35];
        for (let i = 0; i < 6; i++) {
          const a = ((t * (0.25 + 0.2 * this.energy) + i / 6) % 1);
          const px = ch[0] + a * a * 60 + Math.sin(a * 6 + t) * 3, py = ch[1] - a * g.ih * 0.2;
          c.globalAlpha = 0.85 * (1 - a);
          c.beginPath(); c.ellipse(px, py, 3 + a * 14, 2 + a * 7, -0.2, 0, 6.283); c.fill();
        }
        c.globalAlpha = 1;

        c.fillStyle = ink.near;
        for (const pn of g.pines) {
          const par = pn.big ? 0.75 : 0.6;
          const swayTree = Math.sin(t * 0.6 + pn.x * 0.05) * (pn.big ? 1.5 : 0.8) * (0.4 + this.bassEnv);
          c.save();
          c.translate(pn.x + sway * par + oK[0], pn.base + oy);
          c.transform(1, 0, swayTree * 0.004, 1, 0, 0);
          this.pine(c, 0, 0, pn.h, pn.w);
          c.restore();
        }
      }
      c.restore(); // image clip

      // Text band: a squeegee pull swaps the print left to right.
      {
        const pull = clamp((t - this.pullAt) / 0.9, 0, 1);
        const o = reg(17);
        c.save();
        c.beginPath(); c.rect(g.x0, g.bandTop, g.x1 - g.x0, g.bandH); c.clip();
        c.translate(o[0] * 0.6, o[1] * 0.6);
        if (pull < 1 && this.oldBand) {
          const sx = lerp(g.x0 - 10, g.x1 + 10, pull * pull * (3 - 2 * pull));
          c.save(); c.beginPath(); c.rect(sx, g.bandTop, g.x1 - sx + 20, g.bandH); c.clip();
          this.drawBand(c, this.oldBand, g, ink, t);
          c.restore();
          c.save(); c.beginPath(); c.rect(g.x0 - 20, g.bandTop, sx - g.x0 + 20, g.bandH); c.clip();
          this.drawBand(c, this.band, g, ink, t);
          c.restore();
          // The squeegee blade and the bead of ink it pushes.
          c.fillStyle = ink.head;
          c.fillRect(sx - 1, g.bandTop, 3, g.bandH);
          c.globalAlpha = 0.5; c.fillRect(sx + 2, g.bandTop, 5, g.bandH); c.globalAlpha = 1;
        } else {
          this.drawBand(c, this.band, g, ink, t);
        }
        c.restore();
      }

      // Top line, printed in the sky in the moon ink.
      {
        const o = reg(18);
        const fs = g.ih * 0.05;
        c.font = '700 ' + fs.toFixed(1) + 'px ' + HEAD_FONT;
        c.letterSpacing = (fs * 0.45).toFixed(1) + 'px';
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillStyle = ink.moon;
        c.fillText(this.band.top, (g.x0 + g.x1) / 2 + fs * 0.22 + o[0], g.skyTop + g.ih * 0.1 + o[1]);
        c.letterSpacing = '0px';
      }

      // Paper texture over everything: ink mottling and pinholes.
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'multiply';
      c.drawImage(this.grainDark, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 0.8;
      c.drawImage(this.grainSalt, 0, 0);
      c.restore();

      c.restore();
    },
  });
})();
