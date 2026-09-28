// Grunge V2: one enormous word, sliced into strips like a headline run
// through a broken copier, that the music pulls apart and lets fall back
// together. In the calm the strips sit in register and the word reads; in the
// drop they crawl in opposite directions at their own speeds, so copies of the
// word stream past legible only in part (Carson's sliced type as a slit-scan);
// the breakdown brings them back into register. Behind it, a halftone scan of
// a speaker cone; around it, a band or two of small type and the furniture of
// a mid-90s music-magazine page, on photocopied newsprint.
//
// Music, each in its own place:
//   kick   one strip of the word is ripped sideways and springs back with
//          overshoot (about a tenth of the frame; nothing else moves)
//   clap   a rubber-stamped onomatopoeia lands in the free corner of the page
//   bass   the speaker's dust cap pushes out in the halftone; the strips' sway
//          widens with the slow bass
//   hats   copier dust on the glass, specks that come and go
//   drop   a change of state, not more stuff: a slab of the hot second ink
//          slides in behind the word with the strips knocked out of it, the
//          strips shear apart and crawl, more bands of type run; crossing into
//          the drop re-sets the word, and crossing back re-sets the page
// Everything the drop changes is a param (shatter, slab, bands, speed), so
// snapshots can hold it; "Follow the track" eases between the calm and drop
// presets from the bass.
//
// Plain Canvas 2D. The word is rendered once per page into a mask and drawn as
// strips with drawImage, so the heavy type costs a handful of blits a frame.
// Inks are drawn to their own layers, eroded by a photocopy wear mask and
// multiplied onto the paper, so overlaps darken the way inks do.

(function () {
  // V1's murk came from greys: partial-alpha layers averaging on a dim paper.
  // V2 prints only solid ink, so the paper is lighter and the second inks hotter.
  const PALETTES = [
    { name: 'Rust on newsprint', paper: '#ECE7DA', ink: '#161412', acc: '#D8401C', op: 'multiply' },
    { name: 'Bruise', paper: '#E2E3DC', ink: '#121318', acc: '#2F45C8', op: 'multiply' },
    { name: 'Nicotine', paper: '#EBDFBF', ink: '#221B14', acc: '#138274', op: 'multiply' },
    { name: 'Negative', paper: '#161513', ink: '#E8E1D0', acc: '#E24A2A', op: 'screen' },
  ];

  const FACES = {
    anton: { f: 'Anton', w: 400, fb: 'Impact, "Arial Narrow", sans-serif' },
    bebas: { f: 'Bebas Neue', w: 400, fb: 'Impact, "Arial Narrow", sans-serif' },
    oswald: { f: 'Oswald', w: 700, fb: '"Arial Narrow", sans-serif' },
    archivo: { f: 'Archivo Black', w: 400, fb: '"Arial Black", sans-serif' },
    abril: { f: 'Abril Fatface', w: 400, fb: 'Didot, Georgia, serif' },
    playfair: { f: 'Playfair Display', w: 700, fb: 'Georgia, serif' },
    bask: { f: 'Libre Baskerville', w: 400, fb: 'Georgia, serif' },
    elite: { f: 'Special Elite', w: 400, fb: '"Courier New", monospace' },
    mono: { f: 'Space Mono', w: 400, fb: 'Menlo, monospace' },
    rubik: { f: 'Rubik Mono One', w: 400, fb: '"Arial Black", sans-serif' },
  };
  const font = (k, px) => { const F = FACES[k]; return F.w + ' ' + px.toFixed(1) + 'px "' + F.f + '", ' + F.fb; };
  const fontReady = (k) => !window.VIZ_FONTS || window.VIZ_FONTS.has(FACES[k].f);

  // One face per word. Mixed faces within a word were half of V1's cacophony;
  // the variety now comes page to page.
  const HEAD_FACES = ['anton', 'abril', 'archivo', 'bebas'];

  // All wording original (carried over from V1).
  const TITLES = [
    { w: 'FEEDBACK', deck: 'what the room sends back' },
    { w: 'STATIC', deck: 'between the stations, after midnight' },
    { w: 'HUM', deck: 'of the speakers before the first record' },
    { w: 'LOUDER', deck: 'the only direction left' },
    { w: 'UNDERTOW', deck: 'the floor pulls everyone in' },
    { w: 'REVERB', deck: 'the walls keep the last note' },
    { w: 'THRUM', deck: 'a second heartbeat, borrowed' },
    { w: 'SUBSONIC', deck: 'felt in the ribs, not the ears' },
    { w: 'NOCTURNE', deck: 'for broken amplifiers' },
    { w: 'OVERDRIVE', deck: 'nobody here is going home' },
  ];
  const BANDS = [
    'TURN IT UP UNTIL THE WALLS HUM', 'the night is a frequency', 'BASS IN THE BONES',
    'NOBODY SLEEPS IN THIS ROOM', 'side b / take three / 124 per minute',
    'sweat, smoke, a red bulb and the drop', 'LISTEN WITH YOUR WHOLE BODY',
    'somewhere a needle finds the groove', 'MORE LOW END', 'the dark is warmer down the front',
    'amplified / distorted / true', 'ears ringing all the way home',
  ];
  const HITS = ['SNAP', 'CRACK', 'CLAP', 'WHAP', 'SMACK', 'TSSK', 'KRAK', 'SLAP'];
  const CAPTIONS = ['vol. 7 / no. 2', 'side b', 'p. 33', 'do not bend', 'take 3', 'pressed too hot', 'mono', 'a-1'];

  const MAXS = 14;

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeIn = (u) => { u = clamp(u, 0, 1); return u * u * u; };
  const easeBack = (u) => { u = clamp(u, 0, 1) - 1; const s = 1.4; return 1 + u * u * ((s + 1) * u + s); };

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
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }
  const fbm = (x, y, s) => 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 13);
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  function tornRect(rng, w, h, step, amp) {
    const pts = [];
    const edge = (x0, y0, x1, y1, nx, ny) => {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / step));
      for (let i = 0; i < n; i++) {
        const u = i / n, j = (rng() - 0.5) * 2 * amp;
        pts.push([lerp(x0, x1, u) + nx * j, lerp(y0, y1, u) + ny * j]);
      }
    };
    edge(0, 0, w, 0, 0, 1); edge(w, 0, w, h, 1, 0); edge(w, h, 0, h, 0, 1); edge(0, h, 0, 0, 1, 0);
    return pts;
  }
  function polyPath(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }

  const PRESETS = {
    calm: { shatter: 0.06, slab: 0, bands: 1, speed: 0.7 },
    drop: { shatter: 0.8, slab: 1, bands: 3, speed: 1.3 },
    // The page wrecked but still in one ink: for a long peak that should not
    // go red.
    wreck: { shatter: 1, slab: 0, bands: 2, speed: 1.8, slices: 12 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['shatter', 'slab', 'bands', 'speed'];

  VIZ.register({
    id: 'grungev2',
    name: 'Grunge',
    versionOf: 'grunge',
    version: 'V2',
    order: 725,
    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'shatter', label: 'Shatter', type: 'range', min: 0, max: 1, default: 0.06, step: 0.01 },
      { key: 'slab', label: 'Second ink', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'bands', label: 'Type bands', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'speed', label: 'Slide speed', type: 'range', min: 0, max: 2.5, default: 0.7, step: 0.01 },
      { key: 'slices', label: 'Slices', type: 'range', min: 4, max: 14, default: 8, step: 1 },
      { key: 'reaction', label: 'Kick rip', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'headline', label: 'Headline (blank = rotate)', type: 'text', default: '' },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    actions: [
      { id: 'reset', label: 'Next word', run() { this.wantReset = true; } },
    ],
    gallery: {
      title: 'Grunge',
      technique: 'Canvas 2D: a word rendered once per page into a mask and drawn as irregular horizontal strips that sway, crawl and wrap at their own speeds and ease back into register; second-ink slab with the strips knocked out of it; ink layers eroded by a generated photocopy wear mask and multiplied onto a generated newsprint texture; a cached coarse-screen halftone speaker cone with a live dust cap; a section follower that eases between calm and drop presets',
      brief: 'A Ray Gun-style music-magazine page built on one idea: Carson\'s sliced headline. One enormous word, cropped by the frame, is cut into strips like a headline run through a broken copier. In the calm the strips sit in register and the word reads; in the drop they shear apart and crawl in opposite directions, so copies of the word stream past, legible only in part; the breakdown lets them fall back into register. Behind it a coarse halftone scan of a speaker cone whose dust cap the bass pushes out; around it one to three bands of small type and the furniture of a page, on photocopied newsprint. Each kick rips one strip sideways and it springs back with overshoot; each clap rubber-stamps an onomatopoeia in the free corner; hats are copier dust. The drop is a change of state: a slab of hot second ink slides in behind the word with the strips knocked out of it, and the word re-sets; the breakdown re-sets the page.',
      lineage: [
        'V2 of Grunge (web/scenes/grunge.js, batch 05), which ranked in the bottom 12 of 72 (mean 3.67). Every judge said murk and no hierarchy: "murky where Carson was precise even when illegible" (designer), "no single thing to watch" (director), "recombination without a rule you can feel" (purist), "Carson without the eye. Cacophony." (curator). Kept from V1: the newsprint and photocopy-wear print process, inks multiplied with the second out of register, the halftone speaker cone and its bass-pushed dust cap, the rubber stamp, the wording.',
        'The new idea is the rule the purist asked for: the word is sliced, and the music shears it. Legibility becomes the parameter, whole in the calm and streaming in the drop. It fuses the director\'s two asks (one big word per section as the anchor, bands sliding past at different speeds for parallax) into one object: the bands are the word\'s own strips.',
        'Acted on the director: the kick rips one strip sideways with a damped-spring overshoot; the drop brings one hot second ink (as a slab the word is knocked out of, a change of state per the curator\'s theme); the breakdown strips back to one band and the cone. Reinterpreted the floor\'s onomatopoeia transplant: the kick already has its verb, so the clap stamps SNAP or CRACK. Acted on the curator\'s "body copy nobody will read": the typewriter column, passers, show-through and mixed-face letters are cut, and the word changes only at section boundaries. Murk fixed by printing only solid ink on lighter paper with a coarser screen.',
        'Rejected the psychonaut\'s "words kill trance" in its strong form: without a word this is not a typography poster; instead the drop turns the word into a slit-scan to stare into rather than read.',
      ].join(' '),
    },

    setup() { this.init(); },
    enter() { if (!this.st) this.init(); },

    init() {
      this.st = {
        rng: mulberry(0x6a7e + 29),
        prev: new Float32Array(9),
        lastKick: -9, lastSnare: -9, kickCount: 0, lastRip: -1,
        low: 0, bassEnv: 0, hatEnv: 0, hatSlow: 0,
        dropOn: false, auto: 0, hi: false, clk: 0, lastT: null,
        comp: null, old: null, lastReset: 0, titleIdx: 0, faceIdx: 0, layout: 0,
        stamps: [], rips: [],
      };
      for (let i = 0; i < MAXS; i++) this.st.rips.push({ t: -9, dir: 1 });
      this.tex = null; this.texKey = '';
      this.wantReset = false;
    },

    // --------------------------------------------------------------- textures
    // V1's newsprint and wear mask, unchanged apart from the caller using the
    // dirt more lightly.
    buildTextures(W, H) {
      const TS = Math.min(1.4, 2000 / Math.max(W, H));
      const tw = Math.ceil(W * TS), th = Math.ceil(H * TS);
      const rng = mulberry(991);
      const dirt = document.createElement('canvas'); dirt.width = tw; dirt.height = th;
      const wear = document.createElement('canvas'); wear.width = tw; wear.height = th;
      const dg = dirt.getContext('2d'), wg = wear.getContext('2d');
      const di = dg.createImageData(tw, th), wi = wg.createImageData(tw, th);
      const D = di.data, M = wi.data;
      const cx = W * (0.47 + rng() * 0.06), cy = H * (0.48 + rng() * 0.06);
      const rx = W * (0.15 + rng() * 0.7), ry = H * (0.15 + rng() * 0.7), rr = 38 + rng() * 20;
      for (let j = 0; j < th; j++) {
        const y = j / TS;
        for (let i = 0; i < tw; i++) {
          const x = i / TS, o = (j * tw + i) * 4;
          const stain = fbm(x / 160, y / 160, 3);
          const fine = fbm(x / 9, y / 9, 5);
          const grain = hash2(i, j, 11);
          let v = 1 - 0.13 * smooth(0.45, 0.85, stain) - 0.05 * fine - 0.05 * grain;
          const de = Math.min(x, y, W - x, H - y);
          const streak = 0.5 + 0.5 * vnoise(x / 3, y / 90, 21);
          v *= 1 - 0.32 * Math.exp(-de / 10) * streak;
          const fx = Math.abs(x - cx), fy = Math.abs(y - cy);
          v *= 1 - 0.09 * Math.exp(-fx * fx / 0.8) + 0.03 * Math.exp(-(fx - 2.5) * (fx - 2.5) / 3);
          v *= 1 - 0.07 * Math.exp(-fy * fy / 0.8);
          const dr = Math.abs(Math.hypot(x - rx, y - ry) - rr);
          const ring = Math.exp(-dr * dr / 3) * (0.5 + 0.5 * vnoise(Math.atan2(y - ry, x - rx) * 4, 0, 31));
          const warm = 0.14 * ring + 0.05 * smooth(0.5, 0.9, stain);
          D[o] = clamp(255 * v * (1 - warm * 0.2), 0, 255);
          D[o + 1] = clamp(255 * v * (1 - warm * 0.5), 0, 255);
          D[o + 2] = clamp(255 * v * (1 - warm), 0, 255);
          D[o + 3] = 255;
          const wearN = fbm(x / 70, y / 70, 41);
          const thr = 0.965 - 0.12 * smooth(0.5, 0.85, wearN);
          let a = hash2(i >> 1, j >> 1, 43) > thr ? 255 : 0;
          if (fine > 0.79) a = Math.max(a, 150);
          const row = vnoise(0, y / 1.3, 47);
          if (row > 0.93 && hash2(i >> 3, j, 49) > 0.3) a = Math.max(a, 200);
          M[o] = 0; M[o + 1] = 0; M[o + 2] = 0; M[o + 3] = a;
        }
      }
      dg.putImageData(di, 0, 0); wg.putImageData(wi, 0, 0);
      dg.fillStyle = 'rgba(20,18,16,0.8)';
      for (let k = 0; k < 90; k++) {
        const x = rng() * tw, y = rng() * th, r = 0.4 + rng() * 1.2;
        dg.beginPath(); dg.arc(x, y, r, 0, Math.PI * 2); dg.fill();
      }
      dg.strokeStyle = 'rgba(20,18,16,0.55)'; dg.lineWidth = 0.8;
      for (let k = 0; k < 6; k++) {
        let x = rng() * tw, y = rng() * th, a = rng() * 6.3;
        dg.beginPath(); dg.moveTo(x, y);
        for (let s = 0; s < 12; s++) { a += (rng() - 0.5) * 0.8; x += Math.cos(a) * 4; y += Math.sin(a) * 4; dg.lineTo(x, y); }
        dg.stroke();
      }
      return { dirt, wear, TS };
    },

    layer(key, w, h) {
      let c = this[key];
      if (!c) { c = this[key] = document.createElement('canvas'); }
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      return c;
    },

    // ------------------------------------------------------------ composition
    // Two layouts, each mirrored: the word low with the cone up one side, or
    // the word high with the cone bleeding off the bottom. The rest of the
    // page is a free corner for the bands and stamps, and left mostly paper.
    makeComp(W, H, params, t, newLayout) {
      const st = this.st, rng = st.rng;
      if (newLayout) st.layout = (st.layout + 1 + (rng() < 0.5 ? 0 : 2)) % 4;
      const low = st.layout % 2 === 0, mir = st.layout >= 2;
      const custom = (params.headline || '').trim().toUpperCase();
      const T = TITLES[st.titleIdx % TITLES.length];
      st.titleIdx += 1;
      const face = HEAD_FACES[st.faceIdx % HEAD_FACES.length];
      st.faceIdx += 1;
      const S = Math.min(H, W * 0.8);
      const hc = 0.44 * S;                       // cap height of the word
      const capTop = low ? H * 0.92 - hc : H * 0.08;
      const word = {
        text: custom || T.w, face, hc, capTop, base: capTop + hc,
        deck: custom ? 'for everyone still on the floor' : T.deck,
        mask: null, maskSc: 0, ok: false, w: 0, x0: 0, period: 0,
        mirror: mir,
      };

      // Per-strip motion. Most strips ride one travelling wave, so the word
      // ripples like a flag in a draught and stays legible in part; every third
      // strip is a "slip" that crawls on its own, in alternating directions,
      // so fragments of the word's copies stream through it. The first render
      // let every strip crawl independently and the word became checkerboard.
      const sv = [], sp = [];
      for (let i = 0; i < MAXS; i++) {
        const slip = i % 4 === 2;
        sv.push(slip ? (i % 8 === 2 ? 1 : -1) * (0.5 + rng() * 0.4) : 0);
        sp.push((rng() - 0.5) * 0.25);
      }

      // The speaker scan.
      const s = 0.74 * Math.min(H, W * 0.75);
      const cone = {
        w: s, h: s * 1.02, R: s * 0.4, ccx: s * (0.48 + rng() * 0.06), ccy: s * (0.5 + rng() * 0.05),
        rot: (rng() - 0.5) * 0.08,
        torn: tornRect(mulberry((rng() * 1e9) | 0), s, s * 1.02, 10, 5),
      };
      if (low) { cone.x = mir ? W * 0.03 : W - s * 0.94; cone.y = -s * 0.1; }
      else { cone.x = mir ? W - s * 1.02 : W * 0.05; cone.y = H - s * 0.86; }

      // The free corner: opposite the cone, on the other side of the word.
      const fz = low
        ? { x0: mir ? W * 0.5 : W * 0.04, x1: mir ? W * 0.96 : W * 0.5, y0: H * 0.08, y1: capTop - H * 0.07 }
        : { x0: mir ? W * 0.04 : W * 0.5, x1: mir ? W * 0.5 : W * 0.96, y0: word.base + H * 0.08, y1: H * 0.93 };

      // Up to three bands of small type, running the width of the page. Band 0
      // is the calm's one band; 2 is a reversed bar in the second ink.
      const bandY = low ? [H * 0.33, H * 0.2, H * 0.1] : [H * 0.7, H * 0.83, H * 0.93];
      const bands = [
        { text: pick(rng, BANDS), face: pick(rng, ['bebas', 'playfair', 'oswald', 'elite']), sz: 26 + rng() * 8, speed: 22, bar: false, ink: 0 },
        { text: pick(rng, BANDS), face: 'mono', sz: 12 + rng() * 3, speed: -40, bar: false, ink: 0 },
        { text: pick(rng, BANDS).toUpperCase(), face: pick(rng, ['anton', 'archivo']), sz: 20 + rng() * 6, speed: 60, bar: true, ink: 1 },
      ];
      bands.forEach((b, i) => { b.y = bandY[i]; b.rot = (rng() - 0.5) * 0.05; b.off = rng() * 2000; b.w = 0; });

      // The slab of second ink sits behind the word, entering from the side
      // the word is cropped on.
      const slab = {
        // From the side away from the cone, so the second ink lands on paper
        // and type rather than turning the scan to a dark red mass.
        fromLeft: low ? !mir : mir, y: capTop - hc * 0.14, h: hc * 1.26, fw: W * (0.5 + rng() * 0.12),
      };
      slab.torn = tornRect(mulberry((rng() * 1e9) | 0), slab.fw, slab.h, 14, 6);

      const marks = {
        reg: mir ? [W * 0.05, H * 0.06] : [W * 0.95, H * 0.06],
        cap: pick(rng, CAPTIONS), cap2: pick(rng, CAPTIONS), num: Math.floor(10 + rng() * 89),
      };
      return { t0: t, W, H, low, mir, word, sv, sp, ph: new Float64Array(MAXS), crawl: 0, crawlDir: rng() < 0.5 ? -1 : 1, cone, fz, bands, slab, marks, cuts: {}, seed: (rng() * 1e9) | 0 };
    },

    // Rendered lazily (it needs the device scale) and again if the web font
    // arrives after the first attempt, so a fallback face never sticks.
    buildWordMask(c, sc) {
      const Wd = c.word, W = c.W;
      const g0 = (this.measure || (this.measure = document.createElement('canvas').getContext('2d')));
      g0.font = font(Wd.face, 100);
      const capA = g0.measureText('H').actualBoundingBoxAscent || 72;
      let px = Wd.hc / capA * 100;
      g0.font = font(Wd.face, px);
      // Tight tracking: the letters nearly touch, as in the magazine.
      const trackOf = (p) => -0.035 * p;
      const widthAt = () => { let x = 0; for (const ch of Wd.text) x += g0.measureText(ch).width + trackOf(px); return x - trackOf(px); };
      let w = widthAt();
      if (w > 1.55 * W) { px *= 1.55 * W / w; g0.font = font(Wd.face, px); w = widthAt(); }
      const hc = g0.measureText('H').actualBoundingBoxAscent || Wd.hc;
      const top = hc * 0.14, mh = hc * 1.24;
      const pad = 8;
      const cv = Wd.mask || document.createElement('canvas');
      cv.width = Math.ceil((w + pad * 2) * sc); cv.height = Math.ceil(mh * sc);
      const g = cv.getContext('2d');
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.clearRect(0, 0, w + pad * 2, mh);
      g.fillStyle = '#000'; g.font = font(Wd.face, px);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      let x = pad;
      for (const ch of Wd.text) { g.fillText(ch, x, top + hc); x += g.measureText(ch).width + trackOf(px); }
      Wd.mask = cv; Wd.maskSc = sc; Wd.ok = fontReady(Wd.face);
      Wd.w = w; Wd.mw = w + pad * 2; Wd.mh = mh; Wd.pad = pad;
      Wd.top = Wd.base - hc - top;               // stage y of the mask's top row
      // Cropped by the frame on one side: that edge is the one the slab
      // enters from, so the word reads as running off the page.
      Wd.x0 = Wd.mirror ? W * 1.04 - w : -W * 0.04;
      // Long enough that, in register, no second copy is on the page.
      Wd.period = Math.max(w + W * 0.25, W * 1.12);
      c.cuts = {};
    },

    // Irregular slice heights, fixed per page and slice count.
    cutsFor(c, n) {
      if (c.cuts[n]) return c.cuts[n];
      const rng = mulberry(c.seed + n * 101);
      const f = [0];
      let acc = 0; const wts = [];
      for (let i = 0; i < n; i++) { const v = 0.6 + rng() * 0.8; wts.push(v); acc += v; }
      let run = 0;
      for (let i = 0; i < n; i++) { run += wts[i]; f.push(run / acc); }
      c.cuts[n] = f;
      return f;
    },

    reset(t, params, W, H, newLayout) {
      const st = this.st;
      if (st.comp) { st.old = st.comp; st.old.dieT = t; }
      st.comp = this.makeComp(W, H, params, t, newLayout);
      st.lastReset = t;
    },

    // ---------------------------------------------------------------- analysis
    analyse(s, t, dt, W, H, P) {
      const st = this.st;
      const b0 = s[0], b1 = s[1], b4 = s[4];
      if (b0 > 45 && b0 - st.prev[0] > 14 && t - st.lastKick > 0.22) {
        st.lastKick = t; st.kickCount++;
        this.onKick(t, P);
      }
      if (b4 > 40 && b4 - st.prev[4] > 16 && t - st.lastSnare > 0.3) {
        st.lastSnare = t;
        this.onSnare(t, P, W, H);
      }
      st.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      // Band 1 only, slowly: band 0 is mostly the kick itself.
      st.low += (b1 - st.low) * k(0.9);
      const bass = b1 / 100;
      st.bassEnv += (bass - st.bassEnv) * (bass > st.bassEnv ? k(0.05) : k(0.3));
      const hat = Math.max(s[7], s[8]) / 100;
      st.hatEnv += (hat - st.hatEnv) * (hat > st.hatEnv ? k(0.01) : k(0.06));
      st.hatSlow += (hat - st.hatSlow) * k(1.2);
    },

    onKick(t, P) {
      const st = this.st, rng = st.rng;
      const n = this.nStrips || 8;
      // Never the same strip twice running, and never a strip next to the
      // last, so consecutive rips read as separate hits.
      let i = Math.floor(rng() * n);
      for (let k = 0; k < 6 && Math.abs(i - st.lastRip) < 2; k++) i = Math.floor(rng() * n);
      st.lastRip = i;
      const r = st.rips[i];
      r.t = t; r.dir = st.kickCount % 2 ? 1 : -1;
    },

    onSnare(t, P, W, H) {
      const st = this.st, c = st.comp, rng = st.rng;
      if (!c) return;
      // A stamp in the free corner, away from the last one.
      const fz = c.fz;
      let best = null, bestD = -1;
      for (let k = 0; k < 5; k++) {
        const x = lerp(fz.x0 + 50, fz.x1 - 50, rng()), y = lerp(fz.y0 + 30, fz.y1 - 20, rng());
        let d = 1e9;
        for (const s of st.stamps) d = Math.min(d, Math.hypot(s.x - x, s.y - y));
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      st.stamps.push({
        x: best[0], y: best[1], word: pick(rng, HITS), t, rot: (rng() - 0.5) * 0.5,
        sz: 22 + rng() * 10, ink: P.slab > 0.5 ? 1 : 0, circle: rng() < 0.3, seed: (rng() * 1e9) | 0,
      });
      while (st.stamps.length > 3) st.stamps.shift();
    },

    // ----------------------------------------------------------------- drawing
    coneDark(ph, x, y, push) {
      const R = ph.R, dx = (x - ph.ccx) / R, dy = (y - ph.ccy) / R, r = Math.hypot(dx, dy);
      if (r < 0.26) {
        const lx = dx + 0.08, ly = dy + 0.08;
        const hl = Math.exp(-(lx * lx + ly * ly) / (0.004 + 0.03 * push));
        return clamp(0.6 + 0.9 * (dx + dy) - 0.75 * hl, 0, 1);
      }
      if (r < 0.3) return 0.95;
      if (r < 0.86) {
        const th = Math.atan2(dy, dx);
        return clamp(0.42 - 0.34 * Math.cos(th + 0.8) + 0.15 * (r - 0.3) + 0.09 * Math.sin(r * 34), 0, 1);
      }
      if (r < 1.0) {
        const q = (r - 0.93) / 0.07;
        return clamp(0.88 - 0.55 * Math.exp(-q * q * 3) * (0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) + 2.4)), 0, 1);
      }
      if (r < 1.1) return 0.25;
      const th = Math.atan2(dy, dx);
      const k = Math.round(th / (Math.PI / 4)) * (Math.PI / 4);
      const hx = dx - Math.cos(k) * 1.2, hy = dy - Math.sin(k) * 1.2;
      if (hx * hx + hy * hy < 0.004) return 0.02;
      // The baffle is lighter than V1's: its mid-grey was most of the murk.
      return clamp(0.4 + 0.14 * vnoise(x / 40, y / 40, 5), 0, 1);
    },

    // A coarser screen than V1 (9 units, not 7): dots that read from the back
    // of the room as dots, not as a grey.
    halftone(g, ph, push, keep) {
      const sp = 9;
      const ca = Math.SQRT1_2;
      const x0 = keep ? ph.ccx - ph.R * 0.32 : 0, x1 = keep ? ph.ccx + ph.R * 0.32 : ph.w;
      const y0 = keep ? ph.ccy - ph.R * 0.32 : 0, y1 = keep ? ph.ccy + ph.R * 0.32 : ph.h;
      const umin = (x0 + y0) * ca - sp, umax = (x1 + y1) * ca + sp;
      const vmin = (y0 - x1) * ca - sp, vmax = (y1 - x0) * ca + sp;
      g.beginPath();
      for (let v = Math.floor(vmin / sp) * sp; v < vmax; v += sp) {
        for (let u = Math.floor(umin / sp) * sp; u < umax; u += sp) {
          const x = (u - v) * ca, y = (u + v) * ca;
          if (x < x0 - sp || y < y0 - sp || x > x1 + sp || y > y1 + sp) continue;
          const inCap = Math.hypot(x - ph.ccx, y - ph.ccy) < ph.R * 0.3;
          if (keep ? !inCap : inCap) continue;
          const d = this.coneDark(ph, x, y, push);
          const rr = Math.sqrt(d) * sp * 0.66;
          if (rr < 0.6) continue;
          g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2);
        }
      }
      g.fill();
    },

    drawCone(g, c, st, a) {
      const ph = c.cone, sc = this.sc;
      if (!ph.cache || ph.cacheSc !== sc) {
        const cw = Math.ceil(ph.w * sc), chh = Math.ceil(ph.h * sc);
        const cv = ph.cache || document.createElement('canvas');
        cv.width = cw; cv.height = chh;
        const cg = cv.getContext('2d');
        cg.setTransform(sc, 0, 0, sc, 0, 0);
        polyPath(cg, ph.torn); cg.clip();
        cg.fillStyle = '#000';
        this.halftone(cg, ph, 0, false);
        ph.cache = cv; ph.cacheSc = sc;
      }
      const drift = Math.sin(st.clk * 0.09 + ph.ccx) * 10;
      ph.dx = drift;
      g.save();
      g.translate(ph.x + drift, ph.y); g.rotate(ph.rot);
      g.globalAlpha = a;
      g.drawImage(ph.cache, 0, 0, ph.cache.width / sc, ph.cache.height / sc);
      polyPath(g, ph.torn); g.clip();
      this.halftone(g, ph, st.bassEnv, true);
      g.restore();
    },

    // Horizontal offset of strip i of a page at time t, in stage units.
    stripOffset(c, i, n, t, P, dying) {
      const st = this.st, W = c.W, sh = P.shatter;
      // The ripple: a wave travelling down the strips, a few units even in
      // register, wide when shattered, a little wider with the slow bass.
      const bass = clamp(st.low / 45, 0, 1);
      const amp = 3 + sh * W * 0.055 * (0.7 + 0.5 * bass);
      // A long wave (a third of a cycle over the word) shears the word into a
      // curve rather than a checkerboard: neighbours stay nearly in step.
      let off = amp * Math.sin(st.clk * 1.15 - i * 0.3 + c.sp[i]) + c.ph[i] + c.crawl;
      // Kick: an instant rip, then a damped spring through one overshoot.
      if (!dying) {
        const r = st.rips[i], ra = t - r.t;
        if (ra >= 0 && ra < 1.4) off += this.react * (40 + 70 * sh) * r.dir * Math.exp(-ra * 5) * Math.cos(ra * 15);
      }
      // Page re-set: the new strips slot in from alternating sides, staggered
      // top to bottom; the old ones leave the other way.
      const side = i % 2 ? 1 : -1;
      if (dying) off -= side * W * 1.3 * easeIn((t - c.dieT - i * 0.03) / 0.45);
      // The new word waits a beat for the old to clear, so the two never tangle.
      else off += side * W * 1.3 * (1 - easeBack((t - c.t0 - 0.22 - i * 0.04) / 0.6));
      return off;
    },

    drawWord(g, c, t, P, dying) {
      const Wd = c.word, W = c.W, sc = this.sc;
      if (!Wd.mask || Wd.maskSc !== sc || (!Wd.ok && this.frame % 20 === 0)) this.buildWordMask(c, sc);
      const n = this.nStrips;
      const cuts = this.cutsFor(c, n);
      const gap = 3.5 * P.shatter;
      const period = Wd.period;
      for (let i = 0; i < n; i++) {
        const ya = cuts[i] * Wd.mh, yb = cuts[i + 1] * Wd.mh;
        // The strips part a little vertically as they shear, a hairline of
        // paper between each.
        const dy = (i - (n - 1) / 2) * gap;
        const x = Wd.x0 - Wd.pad + this.stripOffset(c, i, n, t, P, dying);
        const kmin = Math.ceil((-Wd.mw - x) / period), kmax = Math.floor((W - x) / period);
        for (let k = kmin; k <= kmax; k++) {
          g.drawImage(Wd.mask, 0, ya * sc, Wd.mask.width, Math.max(1, (yb - ya) * sc),
            x + k * period, Wd.top + ya + dy, Wd.mw, yb - ya);
        }
      }
    },

    slabPath(g, c, amt) {
      const S = c.slab, W = c.W;
      const u = easeOut(amt);
      g.save();
      const x = S.fromLeft ? -S.fw * (1 - u) - 6 : W - S.fw * u + 6;
      g.translate(x, S.y);
      polyPath(g, S.torn);
      g.restore();
    },

    drawBands(g, c, st, which, a, P) {
      const W = c.W;
      c.bands.forEach((b, j) => {
        if (b.ink !== which) return;
        const va = clamp(P.bands - j, 0, 1) * a;
        if (va <= 0.01) return;
        g.font = font(b.face, b.sz);
        const txt = b.text + (b.bar ? '  /  ' : '   ');
        if (!b.w) b.w = g.measureText(txt).width;
        const off = ((st.clk * b.speed + b.off) % b.w + b.w) % b.w;
        g.save();
        g.translate(0, b.y); g.rotate(b.rot);
        g.textBaseline = 'middle'; g.textAlign = 'left';
        // Bands wipe on from the left rather than fading: print has no alpha.
        g.beginPath(); g.rect(-20, -b.sz, (W + 40) * va, b.sz * 2); g.clip();
        if (b.bar) {
          g.fillRect(-20, -b.sz * 0.62, W + 40, b.sz * 1.24);
          g.globalCompositeOperation = 'destination-out';
        }
        for (let x = -off - 20; x < W + 20; x += b.w) g.fillText(txt, x, b.sz * 0.04);
        g.globalCompositeOperation = 'source-over';
        g.restore();
      });
    },

    drawFurniture(g, c, st, a) {
      const m = c.marks, W = c.W, H = c.H, Wd = c.word;
      g.save();
      g.globalAlpha = a;
      g.lineWidth = 1;
      const [rx, ry] = m.reg;
      g.beginPath(); g.arc(rx, ry, 9, 0, Math.PI * 2);
      g.moveTo(rx - 15, ry); g.lineTo(rx + 15, ry); g.moveTo(rx, ry - 15); g.lineTo(rx, ry + 15); g.stroke();
      // The deck: a small italic line hugging the word's shoulder, the scale
      // contrast that makes the word look enormous.
      g.save();
      g.font = font('bask', 15);
      g.textBaseline = 'alphabetic';
      const dx = c.mir ? W * 0.95 : W * 0.05;
      g.textAlign = c.mir ? 'right' : 'left';
      const dy = c.low ? Wd.capTop - 12 : Wd.base + 26;
      g.translate(dx, dy); g.transform(1, 0, -0.2, 1, 0, 0);
      g.fillText(Wd.deck, 0, 0);
      g.restore();
      g.font = font('mono', 10);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const fy = c.low ? H * 0.045 : H * 0.975;
      g.fillText(m.cap + '  ·  ' + m.cap2, c.mir ? W * 0.55 : W * 0.04, fy + (c.low ? 6 : 0));
      g.save(); g.translate(c.mir ? W * 0.025 : W * 0.975, H * 0.5); g.rotate(c.mir ? -Math.PI / 2 : Math.PI / 2);
      g.fillText('no. ' + m.num + ' / ' + Math.floor(st.clk * 3 % 1000).toString().padStart(3, '0'), 0, 0);
      g.restore();
      g.save(); g.translate(c.mir ? W * 0.55 : W * 0.04, fy + (c.low ? 12 : -16)); g.rotate(-0.008);
      g.fillRect(0, 0, W * 0.3, 3); g.fillRect(0, 6, W * 0.18, 1);
      g.restore();
      g.restore();
    },

    drawStamp(g, s, a, t) {
      const age = t - s.t;
      const slam = 1 + 0.25 * Math.exp(-age * 28);
      g.save();
      g.translate(s.x, s.y); g.rotate(s.rot); g.scale(slam, slam);
      g.font = font('rubik', s.sz);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = g.measureText(s.word).width;
      g.globalAlpha = a;
      g.lineWidth = s.sz * 0.1;
      g.beginPath();
      if (s.circle) g.ellipse(0, 0, w / 2 + s.sz * 0.5, s.sz * 0.95, 0, 0, Math.PI * 2);
      else g.rect(-w / 2 - s.sz * 0.3, -s.sz * 0.72, w + s.sz * 0.6, s.sz * 1.44);
      g.stroke();
      g.fillText(s.word, 0, s.sz * 0.04);
      const rng = mulberry(s.seed);
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.ellipse((rng() - 0.5) * w * 1.2, (rng() - 0.5) * s.sz * 1.4, 3 + rng() * s.sz * 0.3, 1 + rng() * 3, rng() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.restore();
    },

    draw(p, signals, params, ctx) {
      if (!this.st) this.init();
      const st = this.st;
      const t = p.millis() / 1000;
      const dt = st.lastT === null ? 1 / 60 : clamp(t - st.lastT, 0, 0.1);
      st.lastT = t;
      this.frame = (this.frame || 0) + 1;
      const W = ctx.width, H = ctx.height;
      this.react = params.reaction;
      this.nStrips = clamp(Math.round(params.slices), 4, MAXS);

      const key = Math.round(W) + 'x' + Math.round(H);
      if (this.texKey !== key) { this.tex = this.buildTextures(W, H); this.texKey = key; st.comp = null; st.old = null; }

      // Follow the track: the drop's sidechained bass line is a slow, reliable
      // tell (band 1 is near-silent elsewhere), with hysteresis. Ease into the
      // drop look in about a bar and out over about three.
      if (!st.dropOn && st.low > 27) st.dropOn = true;
      else if (st.dropOn && st.low < 19) st.dropOn = false;
      const follow = Math.round(params.follow) === 1;
      const target = follow && st.dropOn ? 1 : 0;
      const k = (tau) => 1 - Math.exp(-dt / tau);
      st.auto += (target - st.auto) * k(target > st.auto ? 0.45 : 0.6);
      const P = {};
      for (const kk of DRIVE) P[kk] = params[kk] + (PRESETS.drop[kk] - params[kk]) * (follow ? st.auto : 0);
      // The build: rising hats set the word trembling before the drop tears it.
      if (follow) P.shatter += 0.22 * smooth(0.15, 0.6, st.hatSlow) * (1 - st.auto);
      P.shatter = clamp(P.shatter, 0, 1); P.slab = clamp(P.slab, 0, 1);

      if (!st.comp) this.reset(t, params, W, H, true);
      this.analyse(signals, t, dt, W, H, P);

      // The page re-sets when its state flips, whoever flipped it (the track
      // or the performer's fader): into the drop a new word on the same page,
      // out of it a new page. A long stretch in one state turns the page too.
      let resetNow = 0;
      if (!st.hi && P.slab > 0.55) { st.hi = true; resetNow = 1; }
      else if (st.hi && P.slab < 0.12) { st.hi = false; resetNow = 2; }
      else if (t - st.lastReset > 40) resetNow = st.hi ? 1 : 2;
      if (this.wantReset) { this.wantReset = false; resetNow = 2; }
      if (resetNow) this.reset(t, params, W, H, resetNow === 2);

      const energy = clamp(st.low / 45, 0, 1);
      st.clk += dt * P.speed * (0.5 + 0.9 * energy + 0.3 * st.hatSlow);

      // Strip crawl: each strip slides at its own speed when shattered, and
      // is pulled to the nearest whole copy of the word as the shatter falls,
      // so the calm always lands back in register.
      const advance = (c) => {
        const per = c.word.period || 1;
        const rate = P.speed * 95 * Math.pow(P.shatter, 1.3);
        const pull = 2.4 * (1 - smooth(0.1, 0.4, P.shatter));
        // The whole word drifts too when shattered, a slow marquee, and
        // settles on the nearest copy when calm.
        c.crawl += dt * rate * 0.45 * c.crawlDir;
        if (pull > 0) { const tg = Math.round(c.crawl / per) * per; c.crawl += (tg - c.crawl) * (1 - Math.exp(-dt * pull * 0.6)); }
        for (let i = 0; i < MAXS; i++) {
          c.ph[i] += dt * rate * c.sv[i];
          if (pull > 0) { const tg = Math.round(c.ph[i] / per) * per; c.ph[i] += (tg - c.ph[i]) * (1 - Math.exp(-dt * pull)); }
        }
      };
      advance(st.comp);

      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      const pd = p.pixelDensity();
      const dw = Math.round(p.width * pd), dh = Math.round(p.height * pd);
      const sc = dw / W;
      this.sc = sc;
      const inkC = this.layer('inkC', dw, dh), accC = this.layer('accC', dw, dh), wordC = this.layer('wordC', dw, dh);
      const ink = inkC.getContext('2d'), acc = accC.getContext('2d'), wg = wordC.getContext('2d');
      for (const g of [ink, acc, wg]) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, dw, dh);
        g.setTransform(sc, 0, 0, sc, 0, 0);
        g.lineJoin = 'miter'; g.lineCap = 'butt';
        g.fillStyle = '#000'; g.strokeStyle = '#000';
      }

      const cur = st.comp, old = st.old;
      const age = t - cur.t0;
      const ca = old ? clamp(age / 0.3, 0, 1) : 1;
      let oa = 0;
      if (old) {
        oa = 1 - clamp((t - old.dieT) / 0.3, 0, 1);
        if (t - old.dieT > 0.45 + MAXS * 0.03) { st.old = null; }
      }

      // Ink: the cone, the bands, the furniture.
      if (st.old && oa > 0) this.drawCone(ink, old, st, oa);
      this.drawCone(ink, cur, st, ca);
      if (st.old && oa > 0) { this.drawBands(ink, old, st, 0, oa, P); this.drawFurniture(ink, old, st, oa); }
      this.drawBands(ink, cur, st, 0, ca, P);
      this.drawFurniture(ink, cur, st, ca);

      // The word, on its own layer so it can be knocked out of the slab.
      if (st.old) this.drawWord(wg, st.old, t, P, true);
      this.drawWord(wg, cur, t, P, false);

      // Second ink: the slab, with the word cut out of it.
      if (P.slab > 0.005) {
        acc.save();
        this.slabPath(acc, cur, P.slab); acc.fill();
        acc.restore();
        acc.save(); acc.setTransform(1, 0, 0, 1, 0, 0);
        acc.globalCompositeOperation = 'destination-out';
        acc.drawImage(wordC, 0, 0);
        acc.restore();
        // ...and the slab cut out of the word, so inside it the word is paper.
        wg.save();
        wg.globalCompositeOperation = 'destination-out';
        this.slabPath(wg, cur, P.slab); wg.fill();
        wg.restore();
      }
      ink.save(); ink.setTransform(1, 0, 0, 1, 0, 0); ink.drawImage(wordC, 0, 0); ink.restore();
      if (st.old && oa > 0) this.drawBands(acc, old, st, 1, oa, P);
      this.drawBands(acc, cur, st, 1, ca, P);

      // Stamps: one place on the page per clap.
      for (const s of st.stamps) {
        const sa = t - s.t;
        const a = sa < 0.35 ? 1 : Math.max(0, Math.exp(-(sa - 0.35) / 1.6));
        if (a < 0.03) continue;
        const g = s.ink ? acc : ink;
        this.drawStamp(g, s, a, t);
      }

      // Hats: dust on the copier glass.
      const nd = Math.round(36 * st.hatEnv);
      const dr = mulberry((Math.floor(t * 15) * 104729) | 0);
      for (let i = 0; i < nd; i++) {
        const x = dr() * W, y = dr() * H;
        ink.fillRect(x, y, 1 + dr() * 2.2, 1 + dr() * 1.6);
      }

      // Photocopy wear bites both inks, the second offset so they wear apart.
      const tx = this.tex;
      for (const [g, ox, oy] of [[ink, 0, 0], [acc, -37, -23]]) {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = 0.55;
        g.drawImage(tx.wear, ox * sc, oy * sc, dw, dh);
        if (ox) g.drawImage(tx.wear, dw + ox * sc, oy * sc, dw, dh);
        g.restore();
      }

      // Composite onto paper, the second ink a few units out of register.
      const c2 = p.drawingContext;
      c2.save();
      c2.globalAlpha = 1; c2.globalCompositeOperation = 'source-over';
      c2.fillStyle = pal.paper; c2.fillRect(0, 0, W, H);
      for (const [g, colr] of [[ink, pal.ink], [acc, pal.acc]]) {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-in'; g.globalAlpha = 1;
        g.fillStyle = colr; g.fillRect(0, 0, dw, dh);
        g.restore();
      }
      c2.globalCompositeOperation = pal.op;
      c2.drawImage(inkC, 0, 0, W, H);
      const mis = 3 + 2 * Math.sin(t * 0.4);
      c2.drawImage(accC, mis, mis * 0.6, W, H);
      c2.globalCompositeOperation = 'source-over';
      c2.globalCompositeOperation = 'multiply';
      c2.globalAlpha = pal.op === 'screen' ? 0.4 : 0.65;
      c2.drawImage(this.tex.dirt, 0, 0, W, H);
      c2.restore();
    },
  });
})();
