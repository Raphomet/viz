// Grunge: a mid-90s music-magazine spread that will not sit still. Layered,
// distressed, overlapping type at clashing sizes on photocopied newsprint:
// a huge cropped headline whose letters come from different faces, a
// typewriter column set with the leading too tight, bands of type sliding
// past each other at different speeds, a halftone scan of a speaker cone,
// rubber stamps, tape and registration marks. One ink plus, in the drop, a
// second ink overprinted slightly out of register.
//
// Music, each in its own place:
//   kick   one rubber stamp slams down somewhere on the page, and the next
//          letter of the headline is knocked off its baseline and settles back
//   clap   the next sliding band is re-set: new face, new size, sometimes the
//          other ink or a knocked-out bar (Carson's mid-line font changes)
//   bass   the headline's tracking breathes; the speaker cone's dust cap
//          pushes out in the halftone
//   hats   the typewriter column misprints: single characters flick to other
//          faces, and copier dust specks come and go
//   drop   the page re-sets into a denser spread: more bands, colliding
//          words crossing the headline, a block of second ink, stamps in
//          colour; the breakdown re-sets to a sparse, quiet page
// Plain Canvas 2D. Ink is drawn to its own layer, eroded by a photocopy wear
// mask and multiplied onto the paper, so overlaps darken the way inks do.

(function () {
  const PALETTES = [
    { name: 'Rust on newsprint', paper: '#E7E1D3', ink: '#1C1A17', acc: '#C8431F', op: 'multiply' },
    { name: 'Bruise', paper: '#DADBD4', ink: '#15161B', acc: '#3446B0', op: 'multiply' },
    { name: 'Nicotine', paper: '#E6D9B6', ink: '#2A2118', acc: '#1E7A70', op: 'multiply' },
    { name: 'Negative', paper: '#191816', ink: '#E4DDCD', acc: '#D8462A', op: 'screen' },
  ];

  // Faces from web/fonts.js, each with a fallback so a missing web font
  // degrades to something of the same kind rather than to Times.
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
    syne: { f: 'Syne', w: 700, fb: 'sans-serif' },
    rubik: { f: 'Rubik Mono One', w: 400, fb: '"Arial Black", sans-serif' },
  };
  const font = (k, px) => { const F = FACES[k]; return F.w + ' ' + px.toFixed(1) + 'px "' + F.f + '", ' + F.fb; };

  // All wording original.
  const TITLES = [
    { w: 'FEEDBACK', deck: 'what the room sends back' },
    { w: 'STATIC', deck: 'between the stations, after midnight' },
    { w: 'LOUDER', deck: 'the only direction left' },
    { w: 'HUM', deck: 'of the speakers before the first record' },
    { w: 'SUBSONIC', deck: 'felt in the ribs, not the ears' },
    { w: 'UNDERTOW', deck: 'the floor pulls everyone in' },
    { w: 'REVERB', deck: 'the walls keep the last note' },
    { w: 'NOCTURNE', deck: 'for broken amplifiers' },
    { w: 'THRUM', deck: 'a second heartbeat, borrowed' },
    { w: 'OVERDRIVE', deck: 'nobody here is going home' },
  ];
  const BANDS = [
    'TURN IT UP UNTIL THE WALLS HUM', 'the night is a frequency', 'BASS IN THE BONES',
    'NOBODY SLEEPS IN THIS ROOM', 'side b / take three / 124 per minute',
    'sweat, smoke, a red bulb and the drop', 'LISTEN WITH YOUR WHOLE BODY',
    'somewhere a needle finds the groove', 'NOISE IS A SONG YOU HAVE NOT DANCED TO YET',
    'ears ringing all the way home', 'MORE LOW END', 'the dark is warmer down the front',
    'EVERYBODY TALKS, NOBODY HEARS', 'amplified / distorted / true',
  ];
  const PASSERS = ['CRASH', 'ROAR', 'SIGNAL', 'NOISE', 'DRIFT', 'SWAY', 'TREMOR', 'WAIL', 'HOWL', 'PULSE'];
  const STAMPS = ['LOUD', 'AGAIN', 'YES', 'MORE', 'HERE', 'NOW', 'UP', 'STAY', 'HOLD', 'DANCE', 'OK'];
  const COPY = 'the room gets warmer and the floor starts to give. somebody turns the lights down to a red you can hear. ' +
    'we are all standing too close to the speakers and none of us will move. the kick drum is a second heart and it does not ask. ' +
    'the hiss between records is where the night lives. a cable crackles, a cone shivers, a stranger laughs at nothing and it is the best joke. ' +
    'nobody remembers the name of the song, only the moment the bass came back. tape hiss, cigarette burns on the sleeve, ' +
    'a flyer photocopied until the faces went to static. the last train left an hour ago. the music is still going. so are we. ';
  const CAPTIONS = ['vol. 7 / no. 2', 'side b', 'p. 33', 'do not bend', 'take 3', 'pressed too hot', 'mono', 'a-1'];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

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

  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  // A torn-paper polygon around a rectangle, fixed per element.
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

  VIZ.register({
    id: 'grunge',
    name: 'Grunge',
    order: 503,
    params: [
      { key: 'wreck', label: 'Wreckage', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'reaction', label: 'Reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Slide speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'grit', label: 'Photocopy grit', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'headline', label: 'Headline (blank = rotate)', type: 'text', default: '' },
    ],
    actions: [
      { id: 'reset', label: 'Re-set the page', run() { this.wantReset = true; } },
    ],
    gallery: {
      title: 'Grunge',
      technique: 'Canvas 2D: ink and second-ink layers drawn separately, eroded by a generated photocopy wear mask and multiplied onto a generated newsprint texture; per-letter mixed-face headline, parallax type bands, a procedural halftone speaker cone, onset detection against the previous frame',
      brief: 'A mid-90s music-magazine spread in the David Carson / Ray Gun manner that will not sit still. A huge cropped headline built letter by letter from clashing faces, a typewriter column with the leading set too tight, bands of type sliding past each other at different speeds and angles, a halftone scan of a speaker cone, show-through from the other side of the sheet, tape, stamps and registration marks, all on photocopied newsprint. Each kick slams a rubber stamp down somewhere and knocks the next headline letter off its baseline; each clap re-sets one sliding band in a new face and size; the bass breathes the headline tracking and pushes the cone; the hats make the typewriter column misprint and copier dust flicker. The drop re-sets the page into a dense spread with a second ink overprinted out of register, a colour block, colliding words crossing the headline and stamps in colour; the breakdown re-sets to a sparse, quiet sheet.',
      lineage: [
        'Descends from David Carson\'s Ray Gun and Beach Culture spreads and the wider grunge-typography moment: layered, overlapping, cropped type at clashing sizes, font changes mid-line, leading gone wrong, scanned and photocopied textures, legible only in part. Evoked, not copied: every word is original, no masthead.',
        'Process: built the print process first (generated newsprint with stains, creases and copier-edge shadow; a wear mask that bites specks and blotches out of the ink; ink multiplied so overlaps darken), then the layers. The kick was kept to two small things in two places (a stamp, one headline letter) so it reads without shaking the page; the clap gets a different verb (re-setting a band) so the two are never confused. Movement comes from the bands, passers and letters sliding on a clock whose speed follows the energy of the track, never a kick.',
        'Iterations at 640x360: the first render stalled at ~5 s a frame in the software rasteriser because the halftone cone was thousands of arcs filled every frame, so the static scan is now screened once into a cached canvas and only the dust cap is screened live. The first jolt run showed the whole headline lighting up on every kick: the tracking was following a bass envelope that included band 0 (the kick itself) and then the sidechained bass line, which dips on each kick. Tracking now follows the slow 0.9 s bass follower, leaving the stamp and the one knocked letter as the only kick-driven change. The drop headline was also set in the second ink over the second-ink block, which fused into one red mass; the headline stays in the key ink now so the block reads as an overprint under it. Jolt at 640x360, seed 1: calm, kickArea 0.19, ratio 1.29 (build 0.11), down from 0.24 before the tracking fix.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.st) this.init(); },

    init() {
      this.st = {
        rng: mulberry(0x6a7e + 17),
        prev: new Float32Array(9),
        lastKick: -9, lastSnare: -9, kickCount: 0, snareCount: 0,
        low: 0, bassEnv: 0, padEnv: 0, hatEnv: 0, hatSlow: 0, kd: 0,
        dense: false, lvl: 0, clk: 0, lastT: null,
        comp: null, old: null, lastReset: 0, kicksSinceReset: 0, titleIdx: 0,
        stamps: [], specks: [], glitches: [],
      };
      this.tex = null; this.texKey = '';
      this.wantReset = false;
    },

    // --------------------------------------------------------------- textures
    // Paper dirt (greyscale-ish, multiplied over everything) and a wear mask
    // (alpha, cut out of the ink). Built once per stage shape; ~1.4 texels per
    // virtual unit is enough for grain that reads as paper, not as noise.
    buildTextures(W, H) {
      const TS = Math.min(1.4, 2000 / Math.max(W, H));
      const tw = Math.ceil(W * TS), th = Math.ceil(H * TS);
      const rng = mulberry(991);
      const dirt = document.createElement('canvas'); dirt.width = tw; dirt.height = th;
      const wear = document.createElement('canvas'); wear.width = tw; wear.height = th;
      const dg = dirt.getContext('2d'), wg = wear.getContext('2d');
      const di = dg.createImageData(tw, th), wi = wg.createImageData(tw, th);
      const D = di.data, M = wi.data;
      // Creases where the poster was folded in four, and a coffee ring.
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
          // Copier edge: the lid never quite shuts, so the border goes grey
          // with streaks running down it.
          const de = Math.min(x, y, W - x, H - y);
          const streak = 0.5 + 0.5 * vnoise(x / 3, y / 90, 21);
          v *= 1 - 0.32 * Math.exp(-de / 10) * streak;
          // Fold creases: a dark hairline with a light shoulder.
          const fx = Math.abs(x - cx), fy = Math.abs(y - cy);
          v *= 1 - 0.09 * Math.exp(-fx * fx / 0.8) + 0.03 * Math.exp(-(fx - 2.5) * (fx - 2.5) / 3);
          v *= 1 - 0.07 * Math.exp(-fy * fy / 0.8);
          // Coffee ring: a brown rim, not a disc.
          const dr = Math.abs(Math.hypot(x - rx, y - ry) - rr);
          const ring = Math.exp(-dr * dr / 3) * (0.5 + 0.5 * vnoise(Math.atan2(y - ry, x - rx) * 4, 0, 31));
          const warm = 0.14 * ring + 0.05 * smooth(0.5, 0.9, stain);
          D[o] = clamp(255 * v * (1 - warm * 0.2), 0, 255);
          D[o + 1] = clamp(255 * v * (1 - warm * 0.5), 0, 255);
          D[o + 2] = clamp(255 * v * (1 - warm), 0, 255);
          D[o + 3] = 255;
          // Wear: fine specks everywhere, clumped where the drum is worn, and
          // a few horizontal dropouts where the copier skipped.
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
      // Dust: dark specks and hairs baked into the dirt.
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
    // A page layout, generated from a seed. Positions are fractions of the
    // stage so a re-set holds together at 16:9 and square alike.
    makeComp(W, H, dense, params, t) {
      const st = this.st, rng = st.rng, wr = params.wreck;
      const tall = H > W;
      const custom = (params.headline || '').trim().toUpperCase();
      const T = TITLES[st.titleIdx % TITLES.length];
      st.titleIdx += 1 + (rng() < 0.3 ? 1 : 0);
      const word = custom || T.w;
      const deck = custom ? 'for everyone still on the floor' : T.deck;

      // Headline: letters in mostly one heavy condensed face, a few swapped
      // for a fat didone, a serif, a typewriter or a wide black sans.
      const baseFace = pick(rng, ['anton', 'anton', 'bebas', 'oswald']);
      const oddFaces = ['abril', 'playfair', 'elite', 'archivo', 'bask', 'rubik', 'syne'];
      const hSize = (dense ? 0.54 : 0.5) * Math.min(H, W * 0.75);
      const letters = [];
      for (let i = 0; i < word.length; i++) {
        const odd = rng() < 0.18 + 0.3 * wr;
        const face = odd ? pick(rng, oddFaces) : baseFace;
        const sz = hSize * (odd ? 0.55 + rng() * 0.45 : 0.9 + rng() * 0.25 * (0.4 + wr));
        letters.push({
          ch: word[i], face, sz,
          dy: (rng() - 0.5) * hSize * 0.22 * wr,
          rot: (rng() - 0.5) * 0.25 * wr,
          flip: odd && rng() < 0.25 * wr,
          skew: odd && (face === 'playfair' || face === 'bask') ? -0.22 : 0,
          drift: (rng() - 0.5) * 2, phase: rng() * 6.28,
          knock: -9, knockDir: rng() < 0.5 ? -1 : 1,
        });
      }
      const vertical = !dense && rng() < 0.2 * wr;
      const title = {
        letters, deck,
        x: W * (dense ? -0.03 - rng() * 0.06 * wr : 0.04 + rng() * 0.05),
        y: H * (dense ? 0.68 + rng() * 0.14 : 0.62 + rng() * 0.18),
        rot: vertical ? -Math.PI / 2 : (rng() - 0.5) * 0.16 * wr,
        vertical,
        track: -0.06 - 0.05 * wr,
        fill: 0,
      };
      if (vertical) { title.x = W * 0.12; title.y = H * 0.98; }

      // Sliding bands of type.
      const nb = dense ? 5 : 3;
      const bands = [];
      const faces = ['bebas', 'oswald', 'elite', 'abril', 'mono', 'archivo', 'playfair', 'anton', 'bask'];
      for (let i = 0; i < nb; i++) {
        const big = rng() < 0.35;
        const sz = big ? 60 + rng() * 55 : 16 + rng() * 34;
        bands.push({
          text: pick(rng, BANDS), face: pick(rng, faces), sz,
          y: H * (0.06 + (i + rng() * 0.8) / nb * 0.9),
          rot: (rng() - 0.5) * (0.06 + 0.3 * wr) + (rng() < 0.12 * wr ? Math.PI / 2 : 0),
          speed: (rng() < 0.5 ? -1 : 1) * (18 + rng() * 60) * (big ? 0.6 : 1),
          ink: dense && rng() < 0.45 ? 1 : 0,
          alpha: big ? 0.35 + rng() * 0.4 : 0.75 + rng() * 0.25,
          knock: rng() < 0.2,
          off: rng() * 3000,
          minLvl: i < 2 ? 0 : dense ? (i - 1) / nb : 0.1,
          setAt: -9,
        });
      }

      // Words that slide across the headline and collide with it.
      const passers = [];
      if (dense) {
        for (let i = 0; i < 2; i++) {
          passers.push({
            text: pick(rng, PASSERS), face: i ? pick(rng, ['abril', 'playfair', 'archivo']) : pick(rng, ['anton', 'bebas']),
            sz: H * (0.18 + rng() * 0.14), y: title.y - H * (0.15 + rng() * 0.3),
            dir: i ? -1 : 1, speed: 70 + rng() * 60, off: rng() * 2000, ink: i, rot: (rng() - 0.5) * 0.2 * wr,
          });
        }
      }

      // Typewriter column.
      const colW = tall ? W * 0.5 : Math.min(W * 0.26, 260);
      const col = {
        x: W * (0.03 + rng() * 0.12) + (rng() < 0.5 ? 0 : W * 0.45), y: H * (0.06 + rng() * 0.08),
        w: colW, h: H * (dense ? 0.52 : 0.6), sz: 12 + rng() * 3, lead: 0.72 + rng() * 0.15 * (1 - wr),
        rot: (rng() - 0.5) * 0.12 * wr, lines: null, lineOff: Math.floor(rng() * 40), cols: dense ? 2 : 1,
      };
      if (col.x + col.w * col.cols > W * 0.98) col.x = W * 0.98 - col.w * col.cols;

      // Halftone scan of a speaker cone, cropped by a torn edge.
      const pw = (tall ? 0.8 : 0.42) * W * (dense ? 1.12 : 1), ph = Math.min(H * 0.82, pw * 1.05);
      const photo = {
        x: tall ? W * 0.1 : W * (0.5 + rng() * 0.1), y: H * (0.05 + rng() * 0.12), w: pw, h: ph,
        rot: (rng() - 0.5) * 0.12, R: Math.min(pw, ph) * (0.36 + rng() * 0.08),
        ccx: pw * (0.46 + rng() * 0.12), ccy: ph * (0.46 + rng() * 0.1),
        torn: tornRect(mulberry((rng() * 1e9) | 0), pw, ph, 9, 3.5 + 3 * wr),
        tape: [rng() < 0.7, rng() < 0.7],
      };
      if (!tall && photo.x + photo.w > W * 1.02) photo.x = W * 1.02 - photo.w;

      // A block of the second ink under part of the headline.
      const block = dense ? {
        x: W * (0.02 + rng() * 0.3), y: title.y - hSize * (0.75 + rng() * 0.3), w: W * (0.3 + rng() * 0.3), h: hSize * (0.55 + rng() * 0.3),
        rot: (rng() - 0.5) * 0.1, torn: null,
      } : null;
      if (block) block.torn = tornRect(mulberry((rng() * 1e9) | 0), block.w, block.h, 12, 5);

      const marks = {
        reg: [W * (0.9 + rng() * 0.06), H * (0.06 + rng() * 0.05)],
        cap: pick(rng, CAPTIONS), cap2: pick(rng, CAPTIONS), num: Math.floor(10 + rng() * 89),
        showWord: pick(rng, PASSERS), showY: H * (0.2 + rng() * 0.5),
      };
      return { t0: t, dense, title, bands, passers, col, photo, block, marks, W, H };
    },

    reset(t, params, W, H) {
      const st = this.st;
      st.old = st.comp; if (st.old) st.old.dieT = t;
      st.comp = this.makeComp(W, H, st.dense, params, t);
      st.lastReset = t; st.kicksSinceReset = 0;
    },

    // ---------------------------------------------------------------- analysis
    analyse(s, t, dt, params, W, H) {
      const st = this.st;
      const b0 = s[0], b1 = s[1], b4 = s[4];
      if (b0 > 45 && b0 - st.prev[0] > 14 && t - st.lastKick > 0.22) {
        st.lastKick = t; st.kickCount++; st.kicksSinceReset++;
        st.kd = Math.min(1, st.kd + 0.18);
        this.onKick(t, params, W, H);
      }
      if (b4 > 40 && b4 - st.prev[4] > 16 && t - st.lastSnare > 0.12) {
        st.lastSnare = t; st.snareCount++;
        this.onSnare(t, params);
      }
      st.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      st.kd *= Math.exp(-dt / 2.5);
      st.low += (b1 - st.low) * k(0.9);
      // Band 1 only: band 0 is mostly the kick, and a kick-driven swell
      // would move every letter of the headline on the beat.
      const bass = b1 / 100;
      st.bassEnv += (bass - st.bassEnv) * (bass > st.bassEnv ? k(0.05) : k(0.3));
      st.padEnv += ((s[2] + s[3]) / 200 - st.padEnv) * k(0.6);
      const hat = Math.max(s[7], s[8]) / 100;
      st.hatEnv += (hat - st.hatEnv) * (hat > st.hatEnv ? k(0.01) : k(0.06));
      st.hatSlow += (hat - st.hatSlow) * k(1.2);
    },

    onKick(t, params, W, H) {
      const st = this.st, c = st.comp, rng = st.rng;
      if (!c) return;
      // Knock the next letter of the headline.
      const L = c.title.letters;
      const li = st.kickCount % L.length;
      L[li].knock = t; L[li].knockDir = -L[li].knockDir;
      // Stamp. Placed away from the last few so the page fills evenly.
      let best = null, bestD = -1;
      for (let k = 0; k < 6; k++) {
        const x = W * (0.1 + rng() * 0.8), y = H * (0.12 + rng() * 0.76);
        let d = 1e9;
        for (const s of st.stamps) d = Math.min(d, Math.hypot(s.x - x, s.y - y));
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      const word = pick(rng, STAMPS);
      st.stamps.push({
        x: best[0], y: best[1], word, t, rot: (rng() - 0.5) * 0.7,
        sz: (st.dense ? 34 : 26) + rng() * 16, ink: st.dense ? 1 : 0, circle: rng() < 0.25,
        seed: (rng() * 1e9) | 0,
      });
      while (st.stamps.length > 7) st.stamps.shift();
    },

    onSnare(t, params) {
      const st = this.st, c = st.comp, rng = st.rng;
      if (!c) return;
      // Re-set the next visible, smallish band. Big bands are left alone so a
      // clap never swaps a quarter of the frame.
      const vis = c.bands.filter((b) => st.lvl >= b.minLvl - 0.05 && b.sz < 75);
      if (!vis.length) return;
      const b = vis[st.snareCount % vis.length];
      const faces = ['bebas', 'oswald', 'elite', 'abril', 'mono', 'archivo', 'playfair', 'anton', 'rubik', 'syne'];
      let f = pick(rng, faces); if (f === b.face) f = pick(rng, faces);
      b.face = f; b.sz = clamp(b.sz * (0.7 + rng() * 0.6), 16, 70);
      if (st.dense && rng() < 0.4) b.ink = 1 - b.ink;
      if (rng() < 0.3) b.knock = !b.knock;
      b.setAt = t; b.w = null;
    },

    // ----------------------------------------------------------------- drawing
    // The speaker's darkness at a point of the scan (0 paper, 1 solid ink).
    // `push` is the bass excursion; it only changes the dust cap.
    coneDark(ph, x, y, push) {
      const R = ph.R, dx = (x - ph.ccx) / R, dy = (y - ph.ccy) / R, r = Math.hypot(dx, dy);
      if (r < 0.26) {
        // Dust cap: a dome lit from the upper left; bass swells its highlight.
        const lx = dx + 0.08, ly = dy + 0.08;
        const hl = Math.exp(-(lx * lx + ly * ly) / (0.004 + 0.03 * push));
        return clamp(0.6 + 0.9 * (dx + dy) - 0.75 * hl, 0, 1);
      }
      if (r < 0.3) return 0.95;
      if (r < 0.86) {
        // Paper cone: a shallow funnel lit from one side, with pressed ribs.
        const th = Math.atan2(dy, dx);
        return clamp(0.48 - 0.3 * Math.cos(th + 0.8) + 0.15 * (r - 0.3) + 0.07 * Math.sin(r * 34), 0, 1);
      }
      if (r < 1.0) {
        // Rubber surround: a rolled edge, dark with a highlight ridge.
        const q = (r - 0.93) / 0.07;
        return clamp(0.85 - 0.5 * Math.exp(-q * q * 3) * (0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) + 2.4)), 0, 1);
      }
      if (r < 1.1) return 0.3;
      // Baffle, with the screw holes of the basket.
      const th = Math.atan2(dy, dx);
      const k = Math.round(th / (Math.PI / 4)) * (Math.PI / 4);
      const hx = dx - Math.cos(k) * 1.2, hy = dy - Math.sin(k) * 1.2;
      if (hx * hx + hy * hy < 0.004) return 0.03;
      return clamp(0.66 + 0.16 * vnoise(x / 40, y / 40, 5), 0, 1);
    },

    // Halftone dots on a 45° screen over the rect, keeping those `keep` accepts.
    halftone(g, ph, push, keep) {
      const sp = 7;
      const ca = Math.SQRT1_2;
      const x0 = keep ? ph.ccx - ph.R * 0.32 : 0, x1 = keep ? ph.ccx + ph.R * 0.32 : ph.w;
      const y0 = keep ? ph.ccy - ph.R * 0.32 : 0, y1 = keep ? ph.ccy + ph.R * 0.32 : ph.h;
      // Walk the rotated lattice over the bounding box only.
      const umin = (x0 + y0) * ca - sp, umax = (x1 + y1) * ca + sp;
      const vmin = (y0 - x1) * ca - sp, vmax = (y1 - x0) * ca + sp;
      g.beginPath();
      for (let v = Math.floor(vmin / sp) * sp; v < vmax; v += sp) {
        for (let u = Math.floor(umin / sp) * sp; u < umax; u += sp) {
          const x = (u - v) * ca, y = (u + v) * ca;
          if (x < x0 - sp || y < y0 - sp || x > x1 + sp || y > y1 + sp) continue;
          const inCap = Math.hypot(x - ph.ccx, y - ph.ccy) < ph.R * 0.3;
          if (keep ? !inCap : inCap) continue;
          const rr = Math.sqrt(this.coneDark(ph, x, y, push)) * sp * 0.64;
          if (rr < 0.45) continue;
          g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2);
        }
      }
      g.fill();
    },

    drawPhoto(g, c, st, a, t) {
      const ph = c.photo, sc = this.sc;
      // Thousands of dots are costly to fill every frame, so the static part
      // of the scan is screened once into its own canvas; only the dust cap,
      // which the bass moves, is screened live.
      if (!ph.cache || ph.cacheSc !== sc) {
        const cw = Math.ceil(ph.w * sc), chh = Math.ceil(ph.h * sc);
        const cv = ph.cache || document.createElement('canvas');
        cv.width = cw; cv.height = chh;
        const cg = cv.getContext('2d');
        cg.setTransform(sc, 0, 0, sc, 0, 0);
        polyPath(cg, ph.torn); cg.clip();
        cg.fillStyle = '#000';
        this.halftone(cg, ph, 0, false);
        cg.fillRect(-2, 0, 4, ph.h);   // the scanner's hard edge
        ph.cache = cv; ph.cacheSc = sc;
      }
      const drift = Math.sin(st.clk * 0.07 + ph.ccx) * 12;
      g.save();
      ph.dx = drift;
      g.translate(ph.x + drift, ph.y); g.rotate(ph.rot);
      g.globalAlpha = a;
      g.drawImage(ph.cache, 0, 0, ph.cache.width / sc, ph.cache.height / sc);
      polyPath(g, ph.torn); g.clip();
      this.halftone(g, ph, st.bassEnv * (0.4 + 0.6 * this.react), true);
      g.restore();
    },

    drawTape(g, ph, pap) {
      // Translucent tape across two corners of the scan: drawn on the main
      // canvas after the ink, so it sits on top and lightens what is under it.
      g.save();
      g.translate(ph.x + (ph.dx || 0), ph.y); g.rotate(ph.rot);
      g.fillStyle = pap; g.globalAlpha = 0.45;
      const tape = (x, y, r) => { g.save(); g.translate(x, y); g.rotate(r); g.fillRect(-40, -11, 80, 22); g.restore(); };
      if (ph.tape[0]) tape(0, 0, -0.7);
      if (ph.tape[1]) tape(ph.w, ph.h, -0.7);
      g.restore();
    },

    drawTitle(g, c, st, a, t, col) {
      const T = c.title;
      const age = t - c.t0;
      g.save();
      g.translate(T.x, T.y); g.rotate(T.rot);
      g.globalAlpha = a;
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      // Deck: a small serif line tucked into the headline's shoulder.
      g.save();
      g.font = font('bask', 17);
      g.transform(1, 0, -0.2, 1, 0, 0);
      g.fillText(T.deck, 6, -T.letters[0].sz * 0.86);
      g.restore();
      let x = 0;
      // The slow bass follower, not the envelope: the drop's bass is sidechained
      // to the kick, and following it made every letter jump on the beat.
      const breathe = clamp(st.low / 45, 0, 1) * 18 * (0.5 + 0.5 * this.react);
      for (let i = 0; i < T.letters.length; i++) {
        const L = T.letters[i];
        g.font = font(L.face, L.sz);
        if (!L.w) L.w = g.measureText(L.ch).width;
        // Letters assemble from below on a re-set, staggered.
        const inU = easeOut((age - i * 0.05) / 0.5);
        const ka = t - L.knock;
        const kk = ka >= 0 && ka < 0.6 ? Math.exp(-ka * 7) * Math.sin(Math.min(ka * 30, Math.PI / 2) + 0.0) : 0;
        const dx = L.drift * Math.sin(st.clk * 0.35 + L.phase) * 10;
        const dy = L.dy + (1 - inU) * 300 + kk * 55 * L.knockDir * this.react;
        const rot = L.rot + kk * 0.35 * L.knockDir * this.react;
        g.save();
        g.translate(x + dx + L.w / 2, dy);
        g.rotate(rot);
        if (L.skew) g.transform(1, 0, L.skew, 1, 0, 0);
        if (L.flip) g.scale(-1, 1);
        g.fillText(L.ch, -L.w / 2, 0);
        g.restore();
        x += L.w * (1 + T.track) + breathe * (i < T.letters.length - 1 ? 1 : 0);
      }
      g.restore();
      return x;
    },

    drawBands(g, c, st, which, a, t) {
      const W = c.W;
      for (const b of c.bands) {
        if (b.ink !== which) continue;
        const va = smooth(b.minLvl - 0.1, b.minLvl + 0.1, st.lvl) * a;
        if (va <= 0.01) continue;
        g.font = font(b.face, b.sz);
        const txt = b.text + '   ';
        if (!b.w) b.w = g.measureText(txt).width;
        const off = ((st.clk * b.speed + b.off) % b.w + b.w) % b.w;
        g.save();
        g.translate(W / 2, b.y); g.rotate(b.rot);
        g.textBaseline = 'middle'; g.textAlign = 'left';
        const span = Math.hypot(W, c.H) * 0.6 + b.w;
        // A fresh re-set prints a touch heavier, then settles.
        const fresh = t - b.setAt < 0.25 ? 1 : 0;
        g.globalAlpha = va * clamp(b.alpha + fresh * 0.2, 0, 1);
        if (b.knock) {
          g.fillRect(-span, -b.sz * 0.55, span * 2, b.sz * 1.08);
          g.globalCompositeOperation = 'destination-out';
          g.globalAlpha = 1;
        }
        for (let x = -span - off; x < span; x += b.w) g.fillText(txt, x, 0);
        g.globalCompositeOperation = 'source-over';
        g.restore();
      }
    },

    drawPassers(g, c, st, which, a) {
      const W = c.W;
      for (const q of c.passers) {
        if (q.ink !== which) continue;
        g.font = font(q.face, q.sz);
        if (!q.w) q.w = g.measureText(q.text).width;
        const L = W + q.w + 200;
        let x = ((st.clk * q.speed + q.off) % L + L) % L - q.w - 100;
        if (q.dir < 0) x = W - x - q.w;
        g.save();
        g.translate(x, q.y); g.rotate(q.rot);
        g.globalAlpha = a * 0.9;
        g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        g.fillText(q.text, 0, 0);
        g.restore();
      }
    },

    drawColumn(g, c, st, a, t, glitch) {
      const C = c.col;
      g.save();
      g.translate(C.x, C.y); g.rotate(C.rot);
      g.font = font('elite', C.sz);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      if (!C.lines) {
        const words = COPY.split(' ').filter(Boolean);
        const lines = []; let cur = '';
        for (let rep = 0; rep < 2; rep++) for (const w of words) {
          const tt = cur ? cur + ' ' + w : w;
          if (g.measureText(tt).width > C.w - 12 && cur) { lines.push(cur); cur = w; } else cur = tt;
        }
        if (cur) lines.push(cur);
        C.lines = lines;
      }
      const lh = C.sz * C.lead;
      const nVis = Math.floor(C.h / lh);
      // The copy feeds upward slowly, like paper through a platen.
      const scroll = st.clk * 6;
      const first = Math.floor(scroll / lh), frac = scroll / lh - first;
      g.globalAlpha = a;
      for (let k = 0; k < C.cols; k++) {
        g.save();
        g.translate(k * (C.w + 4), k * lh * 0.5);
        g.beginPath(); g.rect(-4, -C.sz, C.w, C.h + C.sz); g.clip();
        for (let i = 0; i <= nVis; i++) {
          const li = (first + i + C.lineOff + k * 23) % C.lines.length;
          g.fillText(C.lines[li], 0, (i - frac) * lh + C.sz);
        }
        // Hats: misprints. A few characters knocked out and re-struck in
        // another face; the swap lives only as long as the hat does.
        const n = Math.round(glitch);
        const rng = mulberry((Math.floor(t * 20) * 7919 + k * 31) | 0);
        for (let m = 0; m < n; m++) {
          const i = Math.floor(rng() * nVis);
          const li = (first + i + C.lineOff + k * 23) % C.lines.length;
          const line = C.lines[li];
          const ci = Math.floor(rng() * line.length);
          const ch = line[ci];
          if (!ch || ch === ' ') continue;
          const px = g.measureText(line.slice(0, ci)).width;
          const cw = g.measureText(ch).width;
          const py = (i - frac) * lh + C.sz;
          g.globalCompositeOperation = 'destination-out';
          g.fillRect(px - 0.5, py - C.sz * 0.8, cw + 1, C.sz);
          g.globalCompositeOperation = 'source-over';
          g.save();
          g.font = font(pick(rng, ['abril', 'archivo', 'rubik', 'bebas']), C.sz * (1.1 + rng() * 0.9));
          g.fillText(rng() < 0.5 ? ch.toUpperCase() : pick(rng, ['#', '&', '?', '%', '*', '/']), px, py + rng() * 3);
          g.restore();
          g.font = font('elite', C.sz);
        }
        g.restore();
      }
      g.restore();
    },

    drawStamp(g, s, a, t) {
      const age = t - s.t;
      const slam = 1 + 0.18 * Math.exp(-age * 30);
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
      // Rubber stamps never ink evenly: bite a few gaps out of each.
      const rng = mulberry(s.seed);
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 7; k++) {
        g.beginPath();
        g.ellipse((rng() - 0.5) * w * 1.2, (rng() - 0.5) * s.sz * 1.4, 3 + rng() * s.sz * 0.3, 1 + rng() * 3, rng() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.restore();
    },

    drawMarks(g, c, st, a, t) {
      const m = c.marks, W = c.W, H = c.H;
      g.save();
      g.globalAlpha = a;
      g.lineWidth = 1;
      // Registration mark.
      const [rx, ry] = m.reg;
      g.beginPath(); g.arc(rx, ry, 9, 0, Math.PI * 2);
      g.moveTo(rx - 15, ry); g.lineTo(rx + 15, ry); g.moveTo(rx, ry - 15); g.lineTo(rx, ry + 15); g.stroke();
      // Captions and a page number, tiny, at odd angles.
      g.font = font('mono', 10);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText(m.cap + '  ·  ' + m.cap2, W * 0.03, H * 0.965);
      g.save(); g.translate(W * 0.975, H * 0.55); g.rotate(Math.PI / 2);
      g.fillText('no. ' + m.num + ' / ' + Math.floor(st.clk * 3 % 1000).toString().padStart(3, '0'), 0, 0);
      g.restore();
      // Rules: a heavy one and a hairline, slightly off square.
      g.save(); g.translate(W * 0.03, H * 0.93); g.rotate(-0.01);
      g.fillRect(0, 0, W * 0.4, 4); g.fillRect(0, 8, W * 0.26, 1);
      g.restore();
      g.restore();
    },

    drawShowThrough(g, c, st, a) {
      // The reverse of the sheet showing through: a huge mirrored word, faint.
      const m = c.marks, W = c.W, H = c.H;
      g.save();
      g.globalAlpha = a * 0.07;
      g.font = font('anton', H * 0.95);
      g.textBaseline = 'middle'; g.textAlign = 'left';
      const w = g.measureText(m.showWord).width;
      const x = W - ((st.clk * 8) % (w + W));
      g.translate(x, m.showY); g.scale(-1, 1);
      g.fillText(m.showWord, 0, 0);
      g.restore();
    },

    drawComp(ink, acc, c, st, a, t, params) {
      // Ink layer.
      ink.fillStyle = '#000'; ink.strokeStyle = '#000';
      this.drawShowThrough(ink, c, st, a);
      this.drawPhoto(ink, c, st, a * 0.92, t);
      this.drawBands(ink, c, st, 0, a, t);
      const glitch = (2 + 18 * st.hatEnv) * (0.3 + 0.7 * this.react) * (0.4 + 0.6 * st.hatSlow + 0.2);
      this.drawColumn(ink, c, st, a, t, glitch);
      if (c.title.fill === 0 || !c.dense) this.drawTitle(ink, c, st, a, t);
      this.drawPassers(ink, c, st, 0, a);
      this.drawMarks(ink, c, st, a, t);
      // Second ink.
      if (acc) {
        acc.fillStyle = '#000'; acc.strokeStyle = '#000';
        const la = a * smooth(0.2, 0.8, st.lvl);
        if (c.block && la > 0.01) {
          acc.save(); acc.translate(c.block.x, c.block.y); acc.rotate(c.block.rot);
          acc.globalAlpha = la * 0.85; polyPath(acc, c.block.torn); acc.fill(); acc.restore();
        }
        if (c.title.fill === 1 && c.dense) this.drawTitle(acc, c, st, a, t);
        this.drawBands(acc, c, st, 1, la, t);
        this.drawPassers(acc, c, st, 1, la);
        acc.globalAlpha = 1;
      }
    },

    draw(p, signals, params, ctx) {
      if (!this.st) this.init();
      const st = this.st;
      const t = p.millis() / 1000;
      const dt = st.lastT === null ? 1 / 60 : clamp(t - st.lastT, 0, 0.1);
      st.lastT = t;
      const W = ctx.width, H = ctx.height;
      this.react = params.reaction;

      const key = Math.round(W) + 'x' + Math.round(H);
      if (this.texKey !== key) { this.tex = this.buildTextures(W, H); this.texKey = key; st.comp = null; }
      if (!st.comp) this.reset(t, params, W, H);

      this.analyse(signals, t, dt, params, W, H);

      // Sections: the drop's bass line is a slow, reliable tell (band 1 is
      // near-silent everywhere else), with hysteresis so it cannot flicker.
      let resetNow = false;
      if (!st.dense && st.low > 27) { st.dense = true; resetNow = true; }
      else if (st.dense && st.low < 19) { st.dense = false; resetNow = true; }
      else if (st.dense && st.kicksSinceReset >= 32) resetNow = true;
      else if (!st.dense && t - st.lastReset > 16 && t - st.lastKick > 4) resetNow = true;
      if (this.wantReset) { this.wantReset = false; resetNow = true; }
      if (resetNow) this.reset(t, params, W, H);

      const k = (tau) => 1 - Math.exp(-dt / tau);
      st.lvl += ((st.dense ? 1 : 0.15 * st.kd) - st.lvl) * k(st.dense ? 0.4 : 1.2);
      const energy = clamp(st.low / 45, 0, 1);
      st.clk += dt * params.speed * (0.45 + 1.3 * energy + 0.35 * st.hatSlow + 0.6 * st.padEnv);

      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      const pd = p.pixelDensity();
      const dw = Math.round(p.width * pd), dh = Math.round(p.height * pd);
      const sc = dw / W;
      this.sc = sc;
      const inkC = this.layer('inkC', dw, dh), accC = this.layer('accC', dw, dh);
      const ink = inkC.getContext('2d'), acc = accC.getContext('2d');
      for (const g of [ink, acc]) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, dw, dh);
        g.setTransform(sc, 0, 0, sc, 0, 0);
        g.lineJoin = 'miter'; g.lineCap = 'butt';
      }

      // Composition cross-fade on re-set: the old page lifts off quickly.
      const age = t - st.comp.t0;
      if (st.old) {
        const oa = 1 - clamp((t - st.old.dieT) / 0.35, 0, 1);
        if (oa <= 0) st.old = null;
        else this.drawComp(ink, acc, st.old, st, oa, t, params);
      }
      this.drawComp(ink, acc, st.comp, st, clamp(age / 0.25, 0, 1), t, params);

      // Stamps and copier dust live outside the composition.
      for (const s of st.stamps) {
        const sa = t - s.t;
        const a = sa < 0.4 ? 1 : Math.max(0, Math.exp(-(sa - 0.4) / 2.2));
        if (a < 0.02) continue;
        const g = s.ink ? acc : ink;
        g.fillStyle = '#000'; g.strokeStyle = '#000';
        this.drawStamp(g, s, a * 0.9, t);
      }
      // Hats: dust on the copier glass, specks that come and go.
      const nd = Math.round(40 * st.hatEnv * (0.3 + 0.7 * this.react));
      const dr = mulberry((Math.floor(t * 15) * 104729) | 0);
      ink.fillStyle = '#000'; ink.globalAlpha = 0.85;
      for (let i = 0; i < nd; i++) {
        const x = dr() * W, y = dr() * H;
        ink.fillRect(x, y, 1 + dr() * 2.2, 1 + dr() * 1.6);
      }
      ink.globalAlpha = 1;

      // Photocopy wear: bite the mask out of both inks, the second ink's mask
      // offset so the two wear differently.
      const grit = params.grit;
      if (grit > 0.01) {
        const tx = this.tex;
        for (const [g, ox, oy] of [[ink, 0, 0], [acc, -37, -23]]) {
          g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalCompositeOperation = 'destination-out';
          g.globalAlpha = clamp(grit, 0, 1);
          g.drawImage(tx.wear, ox * sc, oy * sc, dw, dh);
          if (ox) g.drawImage(tx.wear, dw + ox * sc, oy * sc, dw, dh);
          g.restore();
        }
      }

      // Composite onto paper. Colour the ink layers by source-in, then
      // multiply (or screen for the negative) with the second ink out of
      // register by a few units.
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
      const mis = (2 + 6 * params.wreck) * (0.6 + 0.4 * Math.sin(t * 0.4));
      c2.drawImage(accC, mis, mis * 0.6, W, H);
      c2.globalCompositeOperation = 'source-over';
      const cur = st.comp;
      this.drawTape(c2, cur.photo, pal.op === 'screen' ? '#8a8575' : '#F4EFD8');
      c2.globalCompositeOperation = 'multiply';
      c2.globalAlpha = pal.op === 'screen' ? 0.5 : 0.9;
      c2.drawImage(this.tex.dirt, 0, 0, W, H);
      c2.restore();
    },
  });
})();
