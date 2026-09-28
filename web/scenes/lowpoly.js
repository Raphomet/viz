// Low Poly: a 2010s low-poly poster. A faceted whale swims slowly through a
// triangulated gradient sky above a flat-shaded valley that the viewer flies
// along, towards a faceted sun sinking at the vanishing point. Bold faceted
// type sits in the sky, small tracked captions frame it. Everything is flat
// facets and hard edges: no glow, no bloom, no blur.
//
// The music lives in separate places:
//   kick   -> the whale's facets catch the light: a scatter of its planes
//             flips to the glint colour, head first, and decays (confined to
//             the whale; the calves glint too once they have joined)
//   clap   -> the sun's facets re-deal their shades, one step round the disc
//   bass   -> the swim: stroke depth and tempo, and the flight speed over the
//             valley; the warm band of the sky rises with it
//   hats   -> faceted stars twinkle; hat onsets spark a few into four points
//   drop   -> two calves slide in to swim beside the mother, the title takes
//             the second ink, the peaks catch the accent and the sun warms;
//             the breakdown lets the calves drift away and the sky cool
//
// Rendering: Canvas 2D only. The valley is a heightfield on a world-fixed,
// jittered grid, so flying is the camera moving over vertices that never
// slide; rows are painted far to near and fade into the horizon haze before
// they are recycled. The whale is lofted from irregular heptagon rings, lit
// per facet and depth-sorted each frame.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const css = (c) => 'rgb(' + (clamp(c[0], 0, 255) | 0) + ',' + (clamp(c[1], 0, 255) | 0) + ',' + (clamp(c[2], 0, 255) | 0) + ')';

  function hash2(i, j, s) { const h = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, s) { return 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 13); }

  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  // Each palette: sky top/mid/horizon, sun pair, terrain low/high/peak, water,
  // whale back/belly, glint, type ink, accent (the drop's second ink).
  const PALETTES = [
    { name: 'Dusk', sky: ['#1a1740', '#5b2a6e', '#e2677a', '#ffc58a'], sun: ['#ffd99a', '#ff9f6e'],
      low: '#1d4f63', high: '#b8577a', peak: '#f3b39a', water: '#f59a86', back: '#22306a', belly: '#f2b3a2',
      glint: '#fff3c4', ink: '#fff0dc', accent: '#ffc24a', deep: '#0f1233' },
    { name: 'Glacier', sky: ['#2f6fa8', '#6fb3dc', '#cfe8f2', '#fbf6ea'], sun: ['#fffaf0', '#ffe2b8'],
      low: '#2d5f86', high: '#9cc6de', peak: '#ffffff', water: '#bfe2f0', back: '#15294d', belly: '#dbe9f1',
      glint: '#ffffff', ink: '#11264a', accent: '#e8434f', deep: '#0c1b33' },
    { name: 'Ember', sky: ['#120b0e', '#4a1218', '#c2381f', '#ff9a42'], sun: ['#ffcf6b', '#ff7a30'],
      low: '#1c0f12', high: '#7a2418', peak: '#e0662c', water: '#ff8a3a', back: '#231417', belly: '#e87a3a',
      glint: '#ffe7a8', ink: '#ffe6c7', accent: '#ff5a2c', deep: '#0a0608' },
    { name: 'Sherbet', sky: ['#2c2a63', '#8b5aa8', '#f59bb0', '#ffe3b0'], sun: ['#fff1c0', '#ffc79a'],
      low: '#2fa597', high: '#f2d6a0', peak: '#fff6e0', water: '#8fe0d0', back: '#3a3890', belly: '#ffd2dc',
      glint: '#ffffff', ink: '#ffffff', accent: '#ff5f8a', deep: '#1d1b48' }
  ].map((q) => ({
    name: q.name, sky: q.sky.map(hex), sun: q.sun.map(hex), low: hex(q.low), high: hex(q.high), peak: hex(q.peak),
    water: hex(q.water), back: hex(q.back), belly: hex(q.belly), glint: hex(q.glint), ink: hex(q.ink),
    accent: hex(q.accent), deep: hex(q.deep), inkCss: q.ink
  }));

  // Radius profile of the body, tail (0) to snout (1): a humpback's long
  // taper to the flukes and a blunt, slightly dropped head.
  const PROFILE = [[0, 0.06], [0.12, 0.11], [0.26, 0.2], [0.42, 0.33], [0.58, 0.42], [0.72, 0.45], [0.84, 0.43], [0.93, 0.36], [1, 0.2]];
  const SIDES = 7;

  VIZ.register({
    id: 'lowpoly',
    name: 'Low Poly',
    order: 520,

    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'NIGHT SONG' },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'flight', label: 'Flight speed', type: 'range', min: 0, max: 2.5, default: 1, step: 0.01 },
      { key: 'facets', label: 'Facet size', type: 'range', min: 0.6, max: 2.2, default: 1, step: 0.01 },
      { key: 'turn', label: 'Whale turning', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'pod', label: 'Calves', type: 'select', options: ['Join in the drop', 'Always', 'Never'], default: 0 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 }
    ],

    actions: [
      { id: 'hills', label: 'New valley', run() { this.seed = (this.seed || 1) + 17; } }
    ],

    gallery: {
      title: 'Low Poly',
      technique: 'Canvas 2D: a flat-shaded heightfield flown over on a world-fixed jittered grid, a lofted low-poly whale lit and depth-sorted per facet, a triangulated gradient sky, faceted type masked from an offscreen canvas',
      brief: 'A 2010s low-poly poster: a faceted humpback swims through a triangulated dusk sky above a flat-shaded valley that the viewer flies along towards a faceted sun, under a big faceted Bebas title and small tracked Josefin captions. Kicks make the whale\'s facets catch the light, head first, in one place; claps re-deal the sun\'s facet shades; the bass sets the whale\'s stroke and the flight speed and lifts the warm band of the sky; hats twinkle faceted stars. The drop brings two calves in beside the mother, a second ink into the title, accent light onto the peaks and a warmer sun; the breakdown lets the calves go and the sky cool.',
      lineage: 'The low-poly illustration craze of the 2010s (triangulated gradient backgrounds, faceted animals, flat-shaded landscapes in album art and gig posters) and 90s real-time 3D before smooth shading. Kept clearly apart from Isle (a toy island diorama from above): this is a poster, eye-level in a valley, with a creature in the sky and the type as the frame. Process: read the batch-05 brief and TASTE, planned the kick as light catching one subject (the whale) and the clap on a second object (the sun) so no reaction touches the whole frame; first render had the hills so tall they hid the horizon and the sun, and the whale seen dead level read as a fish (flukes and fins edge-on), and the bottom captions collided at 640 wide; lowered and widened the valley, raised the camera, moved the sun to the vanishing point, tilted the whale so we look up at its belly and fins, blunted the head and shortened the captions. The belly then read as one muddy plane, so a warm bounce light from the low sun and a small per-facet cut variation were added. Jolt read calm (kickArea 0.06, ratio 1.15, one hot spot on the whale), so the glint was widened a little. At 720 the belly light had turned the whole whale into a pale zeppelin, so the tilt, the bounce and the belly band were pulled back and the distant range hazed further. Checked 1280x720, a square and a 96 s run.'
    },

    setup() { this.seed = 1 + Math.floor(Math.random() * 1000); this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.t = null;
      this.prev = new Float32Array(9);
      this.lastKick = -9; this.lastClap = -9; this.lastHat = -9;
      this.kickCount = 0; this.kickRate = 0; this.bassEnv = 0; this.hatEnv = 0;
      this.dropAmt = 0; this.pod = 0; this.dropSince = -9;
      this.travel = 0; this.swim = 0; this.sunShift = 0; this.sunShiftAt = -9;
      this.sparks = [];
      this.maskKey = '';
    },

    analyse(s, t, dt, params) {
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - this.lastKick > 0.22) {
        this.lastKick = t; this.kickCount++; this.kickRate += 1;
      }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - this.lastClap > 0.14) {
        this.lastClap = t; this.sunShift++; this.sunShiftAt = t;
      }
      const bh = Math.max(s[7], s[8]);
      if (bh > 28 && bh - Math.max(this.prev[7], this.prev[8]) > 9 && t - this.lastHat > 0.08) {
        this.lastHat = t;
        const n = 1 + Math.floor(2 * clamp(params.reaction, 0, 2));
        for (let i = 0; i < n; i++) this.sparks.push({ i: Math.floor(Math.random() * 60), at: t });
        if (this.sparks.length > 24) this.sparks.splice(0, this.sparks.length - 24);
      }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.kickRate *= Math.exp(-dt / 2);
      const bass = Math.max(s[1], s[2]) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.3) : k(0.9));
      this.hatEnv += (bh / 100 - this.hatEnv) * (bh / 100 > this.hatEnv ? k(0.02) : k(0.18));
      // The drop is a steady four-on-the-floor: the build's kicks fade in too
      // slowly to cross this, and the breakdown's silence drains it in a bar.
      const want = sstep(3.0, 4.3, this.kickRate);
      this.dropAmt += (want - this.dropAmt) * k(want > this.dropAmt ? 0.5 : 1.4);
      const mode = Math.round(params.pod);
      const podWant = mode === 1 ? 1 : mode === 2 ? 0 : (this.dropAmt > 0.5 ? 1 : 0);
      // The calves swim in over two seconds and leave more slowly.
      this.pod = clamp(this.pod + dt * (podWant > this.pod ? 0.5 : -0.3), 0, 1);
    },

    // --------------------------------------------------------------- layout
    layout(W, H) {
      const wide = W / H > 1.25;
      return {
        wide,
        hy: H * (wide ? 0.6 : 0.62),
        f: H * 1.0,
        sunX: W * 0.5, sunR: H * (wide ? 0.19 : 0.16),
        whaleX: W * (wide ? 0.66 : 0.6), whaleY: H * (wide ? 0.31 : 0.47),
        whaleS: Math.min(W * 0.112, H * 0.2),
        titleX: W * 0.055, titleY: H * (wide ? 0.075 : 0.06), titleSize: H * (wide ? 0.28 : 0.19)
      };
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.t === null ? 1 / 60 : clamp(t - this.t, 0, 0.1);
      this.t = t;
      this.analyse(signals, t, dt, params);

      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      const L = this.layout(W, H);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineJoin = 'round';

      // Motion: flight speed follows the bass and the drop, never jumps.
      const fl = params.flight;
      this.travel += dt * fl * (1.1 + 1.6 * this.bassEnv + 0.9 * this.dropAmt);
      this.swim += dt * (0.9 + 1.4 * this.bassEnv + 0.6 * this.dropAmt);

      this.drawSky(g, W, H, L, pal, t);
      this.drawStars(g, W, H, L, pal, t, params);
      this.drawSun(g, W, H, L, pal, t);
      this.drawRange(g, W, H, L, pal, t);
      this.drawTerrain(g, W, H, L, pal, t, params);
      this.drawPod(g, W, H, L, pal, t, params);
      this.drawType(p, g, W, H, L, pal, t, params);
      g.restore();
    },

    // ------------------------------------------------------------------ sky
    skyColor(pal, v, lift) {
      // v: 0 at the top of the frame, 1 at the horizon.
      const s = pal.sky;
      const a = 0.45 - 0.12 * lift, b = 0.8 - 0.08 * lift;
      if (v < a) return mix(s[0], s[1], sstep(0, a, v));
      if (v < b) return mix(s[1], s[2], (v - a) / (b - a));
      return mix(s[2], s[3], clamp((v - b) / (1 - b), 0, 1));
    },

    drawSky(g, W, H, L, pal, t) {
      // A triangulated gradient, the signature 2010s backdrop: a jittered
      // grid whose vertices wander slowly, each facet flat-filled from the
      // gradient at its centroid with a little per-facet light.
      const nx = L.wide ? 11 : 7, ny = 5;
      const cw = W / nx, ch = L.hy / ny;
      const lift = clamp(this.bassEnv * 1.2 + this.dropAmt * 0.5, 0, 1);
      const cool = 1 - this.dropAmt;
      const pts = [];
      for (let j = 0; j <= ny; j++) {
        for (let i = 0; i <= nx; i++) {
          let x = i * cw, y = j * ch;
          if (i > 0 && i < nx) x += (hash2(i, j, 3) - 0.5) * cw * 0.7 + Math.sin(t * 0.13 + i * 1.7 + j) * cw * 0.1;
          if (j > 0 && j < ny) y += (hash2(i, j, 5) - 0.5) * ch * 0.6 + Math.cos(t * 0.11 + j * 2.1 + i) * ch * 0.1;
          pts.push(x, y);
        }
      }
      const row = nx + 1;
      // Anything below the grid's last row (hidden by the land) gets a plain fill.
      g.fillStyle = css(pal.sky[3]);
      g.fillRect(-2, L.hy - 4, W + 4, H - L.hy + 8);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const a = (j * row + i) * 2, b = a + 2, c = a + row * 2, d = c + 2;
          const flip = hash2(i, j, 9) > 0.5;
          const tris = flip ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]];
          for (let q = 0; q < 2; q++) {
            const tr = tris[q];
            const cy = (pts[tr[0] + 1] + pts[tr[1] + 1] + pts[tr[2] + 1]) / 3;
            let col = this.skyColor(pal, clamp(cy / L.hy, 0, 1), lift);
            const n = hash2(i * 2 + q, j, 11);
            const shimmer = 0.035 * Math.sin(t * 0.4 + n * 12);
            col = mul(col, 0.94 + 0.1 * n + shimmer - 0.03 * cool * (1 - cy / L.hy));
            g.fillStyle = css(col);
            g.strokeStyle = g.fillStyle;
            g.lineWidth = 0.6;
            g.beginPath();
            g.moveTo(pts[tr[0]], pts[tr[0] + 1]);
            g.lineTo(pts[tr[1]], pts[tr[1] + 1]);
            g.lineTo(pts[tr[2]], pts[tr[2] + 1]);
            g.closePath();
            g.fill(); g.stroke();
          }
        }
      }
    },

    drawStars(g, W, H, L, pal, t, params) {
      // Faceted stars: small diamonds in the dark top of the sky. Hats make
      // them twinkle; a hat onset opens a few into four-point stars.
      const n = Math.round(22 + 26 * this.dropAmt);
      const react = clamp(params.reaction, 0, 2);
      const light = pal.name === 'Glacier' ? pal.ink : pal.glint;
      for (let i = 0; i < n; i++) {
        const x = hash2(i, 1, 21) * W;
        const y = Math.pow(hash2(i, 2, 21), 1.4) * L.hy * 0.62;
        const ph = hash2(i, 3, 21) * TAU;
        const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + 2 * hash2(i, 4, 21)) + ph);
        let r = 1.1 + 1.3 * hash2(i, 5, 21);
        r *= 0.7 + 0.5 * tw + 0.9 * this.hatEnv * react * hash2(i, 6, 21);
        let spark = 0;
        for (const s of this.sparks) if (s.i === i) spark = Math.max(spark, Math.exp(-(t - s.at) / 0.25));
        const a = 0.35 + 0.4 * tw + 0.25 * spark;
        g.fillStyle = css(mix(pal.sky[1], light, clamp(a, 0, 1)));
        const arm = r * (1 + 2.6 * spark * react);
        g.beginPath();
        g.moveTo(x, y - arm); g.lineTo(x + r * 0.55, y); g.lineTo(x, y + arm); g.lineTo(x - r * 0.55, y);
        g.closePath(); g.fill();
        if (spark > 0.05) {
          g.beginPath();
          g.moveTo(x - arm, y); g.lineTo(x, y + r * 0.55); g.lineTo(x + arm, y); g.lineTo(x, y - r * 0.55);
          g.closePath(); g.fill();
        }
      }
      if (this.sparks.length && t - this.sparks[0].at > 1) this.sparks.shift();
    },

    // ------------------------------------------------------------------ sun
    drawSun(g, W, H, L, pal, t) {
      // A faceted disc turning slowly: a fan of eight inner facets and a band
      // of sixteen outer ones. Each clap deals the shades one step round.
      const cx = L.sunX, cy = L.hy - L.sunR * 0.28, R = L.sunR * (1 + 0.04 * this.dropAmt);
      const rot = t * 0.05;
      const outer = [], inner = [];
      for (let i = 0; i < 16; i++) {
        const a = rot + (i / 16) * TAU, rr = R * (0.97 + 0.05 * hash2(i, 0, 31));
        outer.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      for (let i = 0; i < 8; i++) {
        const a = rot * 1.3 + ((i + 0.5) / 8) * TAU, rr = R * 0.56;
        inner.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      const hot = mix(pal.sun[1], pal.accent, 0.55 * this.dropAmt);
      const sinceClap = t - this.sunShiftAt;
      const blend = sstep(0, 0.12, sinceClap);
      const shade = (idx) => {
        const now = hash2(idx + this.sunShift, 0, 37), was = hash2(idx + this.sunShift - 1, 0, 37);
        const v = lerp(was, now, blend);
        // The facet the deal lands on flares toward the glint for a moment.
        const flare = idx % 5 === this.sunShift % 5 ? Math.exp(-sinceClap / 0.3) * 0.6 : 0;
        return mix(mix(pal.sun[0], hot, v), pal.glint, flare);
      };
      const tri = (ax, ay, bx, by, qx, qy, col) => {
        g.fillStyle = css(col); g.strokeStyle = g.fillStyle; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(qx, qy); g.closePath(); g.fill(); g.stroke();
      };
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        tri(cx, cy, inner[i * 2], inner[i * 2 + 1], inner[j * 2], inner[j * 2 + 1], shade(i));
      }
      for (let i = 0; i < 16; i++) {
        const j = (i + 1) % 16;
        // Inner vertex k sits at the angle of outer vertex 2k+1, so both
        // outer edges either side of it fan to it; the gap fillers follow.
        const k2 = Math.floor(i / 2);
        tri(outer[i * 2], outer[i * 2 + 1], outer[j * 2], outer[j * 2 + 1], inner[k2 * 2], inner[k2 * 2 + 1], shade(8 + i));
      }
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8, o = ((i * 2 + 2) % 16);
        tri(inner[i * 2], inner[i * 2 + 1], inner[j * 2], inner[j * 2 + 1], outer[o * 2], outer[o * 2 + 1], shade(24 + i));
      }
    },

    // ------------------------------------------------------ far mountain range
    drawRange(g, W, H, L, pal, t) {
      // A distant range of big two-faced peaks (lit face, shadow face) sliding
      // slowly for parallax, hazed nearly into the sky.
      const haze = this.skyColor(pal, 0.97, 0);
      const base = mix(pal.high, haze, 0.72), shadow = mix(pal.low, haze, 0.66);
      const off = (this.travel * 0.9) % 1e6;
      const span = W / 5.5;
      const i0 = Math.floor((off - span) / span), i1 = Math.ceil((off + W + span) / span);
      for (let i = i0; i <= i1; i++) {
        const x = i * span - off + (hash2(i, 0, 41 + this.seed) - 0.5) * span * 0.5;
        const h = L.hy * (0.05 + 0.1 * hash2(i, 1, 41 + this.seed));
        const w = span * (0.8 + 0.6 * hash2(i, 2, 41 + this.seed));
        const px = x + (hash2(i, 3, 41 + this.seed) - 0.5) * w * 0.3;
        g.fillStyle = css(base);
        g.beginPath(); g.moveTo(x - w, L.hy + 2); g.lineTo(px, L.hy - h); g.lineTo(px, L.hy + 2); g.closePath(); g.fill();
        g.fillStyle = css(shadow);
        g.beginPath(); g.moveTo(px, L.hy - h); g.lineTo(x + w, L.hy + 2); g.lineTo(px, L.hy + 2); g.closePath(); g.fill();
      }
    },

    // -------------------------------------------------------------- terrain
    height(X, Z, seed) {
      const vc = 4.5 * Math.sin(Z * 0.045) + 2.5 * Math.sin(Z * 0.11 + 1.3);
      const d = Math.abs(X - vc);
      const ridge = sstep(2.2, 13, d);
      let h = ridge * (0.8 + 5.2 * fbm(X * 0.09, Z * 0.09, seed)) + (fbm(X * 0.35, Z * 0.35, seed + 3) - 0.5) * 1.3 - 0.45;
      return h < 0 ? 0 : h;
    },
    valleyAt(Z) { return 4.5 * Math.sin(Z * 0.045) + 2.5 * Math.sin(Z * 0.11 + 1.3); },

    drawTerrain(g, W, H, L, pal, t, params) {
      const seed = this.seed;
      const cell = 1.5 * clamp(params.facets, 0.6, 2.2);
      const f = L.f;
      const camZ = this.travel;
      const camX = this.valleyAt(camZ + 9);
      const camY = 3.4;
      const zFar = 44, zNear = 3.5;
      const j0 = Math.floor((camZ + zNear) / cell), j1 = Math.ceil((camZ + zFar) / cell);
      const halfW = (W * 0.5) / f;
      const iMin = Math.floor((camX - halfW * zFar - 3 * cell) / cell);
      const iMax = Math.ceil((camX + halfW * zFar + 3 * cell) / cell);
      const nI = iMax - iMin + 1, nJ = j1 - j0 + 1;
      const need = nI * nJ;
      if (!this.tv || this.tv.length < need * 5) this.tv = new Float32Array(need * 5 + 64);
      const tv = this.tv;
      // Vertices: world position (jittered, fixed in the world) and projection.
      for (let jj = 0; jj < nJ; jj++) {
        const j = j0 + jj;
        for (let ii = 0; ii < nI; ii++) {
          const i = iMin + ii;
          const X = (i + (hash2(i, j, seed + 51) - 0.5) * 0.55) * cell;
          const Z = (j + (hash2(i, j, seed + 53) - 0.5) * 0.55) * cell;
          const Y = this.height(X, Z, seed);
          const zr = Math.max(Z - camZ, 0.3);
          const o = (jj * nI + ii) * 5;
          tv[o] = X; tv[o + 1] = Y; tv[o + 2] = Z;
          tv[o + 3] = W * 0.5 + f * (X - camX) / zr;
          tv[o + 4] = L.hy + f * (camY - Y) / zr;
        }
      }
      // Light from the upper left and a little behind the viewer.
      let lx = -0.55, ly = 0.7, lz = -0.45;
      const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
      const haze = this.skyColor(pal, 0.97, 0);
      const drop = this.dropAmt;
      const peakCol = mix(pal.peak, pal.accent, 0.55 * drop);
      const tri = (a, b, c, fog, key) => {
        const ax = tv[a], ay = tv[a + 1], az = tv[a + 2];
        const ux = tv[b] - ax, uy = tv[b + 1] - ay, uz = tv[b + 2] - az;
        const vx = tv[c] - ax, vy = tv[c + 1] - ay, vz = tv[c + 2] - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const hAvg = (ay + tv[b + 1] + tv[c + 1]) / 3;
        let col;
        if (hAvg < 0.02) {
          // Water: flat, so shade it from the sky and a per-facet tilt.
          const k = hash2(key, 7, seed);
          col = mix(pal.water, haze, 0.25 + 0.3 * k);
          col = mul(col, 0.84 + 0.18 * k);
        } else {
          const hn = clamp(hAvg / 5, 0, 1);
          const base = hn < 0.55 ? mix(pal.low, pal.high, hn / 0.55) : mix(pal.high, peakCol, (hn - 0.55) / 0.45);
          const lam = Math.max(0, nx * lx + ny * ly + nz * lz);
          col = mul(base, 0.42 + 0.78 * lam);
        }
        col = mix(col, haze, fog);
        g.fillStyle = css(col); g.strokeStyle = g.fillStyle;
        g.beginPath();
        g.moveTo(tv[a + 3], tv[a + 4]); g.lineTo(tv[b + 3], tv[b + 4]); g.lineTo(tv[c + 3], tv[c + 4]);
        g.closePath(); g.fill(); g.stroke();
      };
      g.lineWidth = 0.7;
      for (let jj = nJ - 2; jj >= 0; jj--) {
        const j = j0 + jj;
        const zr = (j + 1) * cell - camZ;
        const fog = sstep(zFar * 0.45, zFar - cell * 1.5, zr);
        const reach = halfW * (zr + cell) + 2 * cell;
        const a0 = Math.max(0, Math.floor((camX - reach) / cell) - iMin);
        const a1 = Math.min(nI - 2, Math.ceil((camX + reach) / cell) - iMin);
        // Outside in, so a near-centre hill overlaps the flanks correctly.
        const mid = Math.round(camX / cell) - iMin;
        const order = [];
        for (let ii = a0; ii < Math.min(mid, a1 + 1); ii++) order.push(ii);
        for (let ii = a1; ii >= Math.max(mid, a0); ii--) order.push(ii);
        for (const ii of order) {
          const i = iMin + ii;
          const A = (jj * nI + ii) * 5, B = A + 5, C = A + nI * 5, D = C + 5;
          if (tv[A + 4] > H + 40 && tv[B + 4] > H + 40 && tv[C + 4] > H + 40 && tv[D + 4] > H + 40) continue;
          if (hash2(i, j, seed + 57) > 0.5) { tri(C, D, A, fog, i * 3 + j * 7); tri(A, D, B, fog, i * 3 + j * 7 + 1); }
          else { tri(C, D, B, fog, i * 3 + j * 7); tri(C, B, A, fog, i * 3 + j * 7 + 1); }
        }
      }
    },

    // ---------------------------------------------------------------- whales
    buildWhale(phase, amp, seed) {
      // Local space: x along the body (tail -2 .. snout +2), y up, z to the
      // whale's left. Rings are irregular heptagons so the facets read as cut
      // by hand, not turned on a lathe.
      const Lb = 4, rings = [];
      const bend = (u) => amp * Math.sin(phase - 2.4 * (1 - u)) * Math.pow(1 - u, 1.6) - amp * 0.15 * Math.sin(phase) * u;
      for (let r = 0; r < PROFILE.length; r++) {
        const u = PROFILE[r][0], rad = PROFILE[r][1] * Lb * 0.5;
        const x = -Lb / 2 + u * Lb, y0 = bend(u) - (u > 0.85 ? (u - 0.85) * 0.5 : 0);
        const ring = [];
        for (let k = 0; k < SIDES; k++) {
          const a = (k / SIDES) * TAU + 0.2;
          const jit = 1 + (hash2(r, k, seed) - 0.5) * 0.14;
          let y = Math.cos(a) * rad * 0.9 * jit;
          if (y < 0) y *= 0.82;
          ring.push([x + (hash2(k, r, seed + 1) - 0.5) * 0.06, y0 + y, Math.sin(a) * rad * jit]);
        }
        rings.push({ u, x, y0, ring });
      }
      const tris = [];
      const body = (a, b, c, u, spine) => tris.push({ v: [a, b, c], u, spine, part: 0 });
      for (let r = 0; r < rings.length - 1; r++) {
        const A = rings[r], B = rings[r + 1];
        const uMid = (A.u + B.u) / 2;
        const spine = [(A.x + B.x) / 2, (A.y0 + B.y0) / 2, 0];
        for (let k = 0; k < SIDES; k++) {
          const k2 = (k + 1) % SIDES;
          body(A.ring[k], A.ring[k2], B.ring[k2], uMid, spine);
          body(A.ring[k], B.ring[k2], B.ring[k], uMid, spine);
        }
      }
      // Caps: snout point and tail point.
      const head = rings[rings.length - 1], tail = rings[0];
      const snout = [head.x + 0.1, head.y0 - 0.08, 0], stock = [tail.x - 0.08, tail.y0, 0];
      for (let k = 0; k < SIDES; k++) {
        const k2 = (k + 1) % SIDES;
        body(head.ring[k], snout, head.ring[k2], 1, [head.x, head.y0, 0]);
        body(tail.ring[k2], stock, tail.ring[k], 0, [tail.x, tail.y0, 0]);
      }
      // Flukes: two swept lobes, pitched with the tail's stroke.
      const pitch = amp * 1.6 * Math.cos(phase - 2.4);
      for (const sd of [-1, 1]) {
        const root = stock, lead = [stock[0] - 0.12, stock[1] + pitch * 0.2, sd * 0.28];
        const tip = [stock[0] - 0.55, stock[1] + pitch * 0.55, sd * 0.95];
        const notch = [stock[0] - 0.42, stock[1] + pitch * 0.45, sd * 0.1];
        tris.push({ v: [root, lead, tip], u: 0, part: 1 }, { v: [root, tip, notch], u: 0, part: 1 });
      }
      // Long pectoral fins, the humpback's wings, flapping slowly.
      const fr = rings[5];
      const flap = Math.sin(phase * 0.5 + 0.8) * 0.25;
      for (const sd of [-1, 1]) {
        const rootF = [fr.x + 0.15, fr.y0 - 0.3, sd * 0.62], rootB = [fr.x - 0.3, fr.y0 - 0.34, sd * 0.6];
        const tip = [fr.x - 1.05, fr.y0 - 0.75 + flap, sd * 1.65];
        const mid = [fr.x - 0.35, fr.y0 - 0.55 + flap * 0.5, sd * 1.15];
        tris.push({ v: [rootF, mid, rootB], u: 0.72, part: 2 }, { v: [rootF, tip, mid], u: 0.66, part: 2 }, { v: [mid, tip, rootB], u: 0.62, part: 2 });
      }
      // A small dorsal fin.
      const dr = rings[3];
      const top = dr.ring[0];
      tris.push({ v: [[top[0] + 0.25, top[1] - 0.02, 0.02], [top[0] - 0.12, top[1] + 0.22, 0], [top[0] - 0.25, top[1] - 0.02, -0.02]], u: 0.4, part: 3 });
      return tris;
    },

    drawWhale(g, cx, cy, S, yaw, pitch, roll, phase, amp, pal, t, params, id, outList) {
      const tris = this.buildWhale(phase, amp, 7 + id * 13);
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const D = 9;
      const ct = Math.cos(0.3), st = Math.sin(0.3);
      const xf = (v) => {
        // roll about x, pitch about z, then yaw about y.
        let x = v[0], y = v[1] * cr - v[2] * sr, z = v[1] * sr + v[2] * cr;
        const x2 = x * cp - y * sp, y2 = x * sp + y * cp; x = x2; y = y2;
        const x3 = x * cyw + z * syw, z3 = -x * syw + z * cyw;
        // We look up at it from the valley floor: tilt the belly toward us.
        return [x3, y * ct - z3 * st, y * st + z3 * ct];
      };
      let lx = -0.45, ly = 0.8, lz = -0.4;
      const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
      const react = clamp(params.reaction, 0, 2);
      const since = t - this.lastKick;
      for (let n = 0; n < tris.length; n++) {
        const tr = tris[n];
        const a = xf(tr.v[0]), b = xf(tr.v[1]), c = xf(tr.v[2]);
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const mx = (a[0] + b[0] + c[0]) / 3, my = (a[1] + b[1] + c[1]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
        if (tr.part === 0) {
          // Outward from the spine, then drop the facets that face away.
          const sp0 = xf(tr.spine);
          if (nx * (mx - sp0[0]) + ny * (my - sp0[1]) + nz * (mz - sp0[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
          if (nx * mx + ny * my + nz * (mz + D) > 0) continue;
        } else if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
        const lam = Math.max(0, nx * lx + ny * ly + nz * lz);
        // Countershading: the belly is pale, the back dark; fins lean pale.
        const localY = (tr.v[0][1] + tr.v[1][1] + tr.v[2][1]) / 3;
        const bellyT = tr.part === 2 ? 0.5 : tr.part === 1 ? 0.1 : sstep(-0.05, -0.35, localY - (tr.spine ? tr.spine[1] : 0));
        let col = mix(pal.back, pal.belly, bellyT);
        // A warm bounce from the low sun ahead lights the belly from below,
        // so its facets read instead of going to one muddy plane.
        const fill = Math.max(0, -ny * 0.55 - nz * 0.6 - nx * 0.25);
        col = mix(mul(col, 0.46 + 0.72 * lam), mix(col, pal.sun[0], 0.3), clamp(fill * 0.6, 0, 0.55));
        // Each plane cut slightly differently, so the big belly still reads as facets.
        col = mul(col, 0.9 + 0.2 * hash2(n, id, 67));
        // The kick: a scatter of facets catches the light, head first.
        if (since < 1.2 && react > 0) {
          const pick = hash2(n, this.kickCount, 61 + id);
          if (pick < 0.55 && lam + fill > 0.12) {
            const delay = (1 - tr.u) * 0.14;
            const e = since > delay ? Math.exp(-(since - delay) / 0.2) : 0;
            col = mix(col, pal.glint, clamp(e * (0.65 + 0.35 * lam) * react, 0, 1));
          }
        }
        const pr = (q) => { const s = D / (D + q[2]); return [cx + q[0] * S * s, cy - q[1] * S * s]; };
        const pa = pr(a), pb = pr(b), pc = pr(c);
        outList.push({ z: mz, col, pa, pb, pc });
      }
    },

    drawPod(g, W, H, L, pal, t, params) {
      const turn = clamp(params.turn, 0, 1);
      const amp = 0.1 + 0.16 * this.bassEnv + 0.05 * this.dropAmt;
      const list = [];
      const whales = [];
      // Mother: heading left, three-quarters to the viewer, turning gently.
      const yaw = 2.62 + turn * (0.5 * Math.sin(t * 0.083) + 0.22 * Math.sin(t * 0.197 + 1));
      const bank = -turn * 0.35 * Math.cos(t * 0.083);
      whales.push({
        x: L.whaleX + Math.sin(t * 0.07) * L.whaleS * 0.35, y: L.whaleY + Math.sin(t * 0.11 + 0.5) * L.whaleS * 0.18,
        S: L.whaleS, yaw, pitch: 0.06 * Math.sin(t * 0.13) + 0.08 * Math.sin(this.swim * 0.5), roll: bank, phase: this.swim * 2.2, amp, id: 0
      });
      if (this.pod > 0.001) {
        const e = this.pod < 0.5 ? 2 * this.pod * this.pod : 1 - Math.pow(-2 * this.pod + 2, 2) / 2;
        const off = (1 - e) * (W * 0.75);
        whales.push({
          x: L.whaleX + L.whaleS * 1.9 + off + Math.sin(t * 0.09 + 2) * L.whaleS * 0.2, y: L.whaleY + L.whaleS * 0.95 + Math.sin(t * 0.15) * L.whaleS * 0.12,
          S: L.whaleS * 0.46, yaw: yaw + 0.08, pitch: 0.05 * Math.sin(t * 0.17), roll: bank, phase: this.swim * 2.7 + 1.1, amp: amp * 1.2, id: 1
        });
        whales.push({
          x: L.whaleX - L.whaleS * 1.3 + off * 1.3 + Math.sin(t * 0.12 + 4) * L.whaleS * 0.2, y: L.whaleY + L.whaleS * 1.25 + Math.sin(t * 0.13 + 1) * L.whaleS * 0.1,
          S: L.whaleS * 0.34, yaw: yaw - 0.1, pitch: 0.05 * Math.sin(t * 0.19 + 1), roll: bank, phase: this.swim * 3.0 + 2.3, amp: amp * 1.2, id: 2
        });
      }
      // Paint smaller (farther) whales first; each whale's facets far to near.
      whales.sort((a, b) => a.S - b.S);
      g.lineWidth = 0.6;
      for (const w of whales) {
        list.length = 0;
        this.drawWhale(g, w.x, w.y, w.S, w.yaw, w.pitch, w.roll, w.phase, w.amp, pal, t, params, w.id, list);
        list.sort((a, b) => b.z - a.z);
        for (const q of list) {
          g.fillStyle = css(q.col); g.strokeStyle = g.fillStyle;
          g.beginPath(); g.moveTo(q.pa[0], q.pa[1]); g.lineTo(q.pb[0], q.pb[1]); g.lineTo(q.pc[0], q.pc[1]);
          g.closePath(); g.fill(); g.stroke();
        }
      }
    },

    // ------------------------------------------------------------------ type
    drawType(p, g, W, H, L, pal, t, params) {
      const words = String(params.title || '').trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 3);
      const titleFont = face('Bebas Neue', 'Impact, sans-serif');
      const smallFont = face('Josefin Sans', 'Helvetica, Arial, sans-serif');
      const dens = (p.width / W) * p.pixelDensity();
      const size = L.titleSize * (words.length > 2 ? 0.72 : 1);
      const lead = size * 0.8;
      // The faceted title: the words are drawn once into a mask; each frame a
      // facet mesh is painted over the mask's box and cut to the letters.
      if (words.length) {
        g.font = size + 'px ' + titleFont;
        let tw = 0;
        for (const w of words) tw = Math.max(tw, g.measureText(w).width);
        const bw = Math.ceil(tw + size * 0.1), bh = Math.ceil(lead * (words.length - 1) + size * 0.8);
        const key = pal.name + '|' + words.join('|') + '|' + Math.round(size * 10) + '|' + dens.toFixed(3) + '|' + titleFont;
        if (key !== this.maskKey) {
          this.maskKey = key;
          this.mask = document.createElement('canvas');
          this.mask.width = Math.max(1, Math.ceil(bw * dens)); this.mask.height = Math.max(1, Math.ceil(bh * dens));
          const m = this.mask.getContext('2d');
          m.scale(dens, dens);
          m.font = size + 'px ' + titleFont;
          m.textBaseline = 'alphabetic'; m.textAlign = 'left'; m.fillStyle = '#fff';
          words.forEach((w, i) => m.fillText(w, 0, size * 0.78 + i * lead));
          this.shadowC = document.createElement('canvas');
          this.shadowC.width = this.mask.width; this.shadowC.height = this.mask.height;
          const sc = this.shadowC.getContext('2d');
          sc.drawImage(this.mask, 0, 0);
          sc.globalCompositeOperation = 'source-in';
          sc.fillStyle = css(pal.deep);
          sc.fillRect(0, 0, this.shadowC.width, this.shadowC.height);
          this.facetC = document.createElement('canvas');
          this.facetC.width = this.mask.width; this.facetC.height = this.mask.height;
          this.tbw = bw; this.tbh = bh;
        }
        const fc = this.facetC.getContext('2d');
        fc.setTransform(1, 0, 0, 1, 0, 0);
        fc.globalCompositeOperation = 'source-over';
        fc.clearRect(0, 0, this.facetC.width, this.facetC.height);
        fc.scale(dens, dens);
        const cs = size * 0.2;
        const nx = Math.ceil(this.tbw / cs) + 1, ny = Math.ceil(this.tbh / cs) + 1;
        const la = t * 0.25;
        const lx = Math.cos(la), ly = Math.sin(la);
        const ink2 = mix(pal.ink, pal.accent, 0.9);
        fc.lineWidth = 0.8;
        const P = (i, j) => [i * cs + (i > 0 && i < nx ? (hash2(i, j, 71) - 0.5) * cs * 0.7 : 0), j * cs + (j > 0 && j < ny ? (hash2(i, j, 73) - 0.5) * cs * 0.7 : 0)];
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
            const flip = hash2(i, j, 75) > 0.5;
            const ts = flip ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]];
            for (let q = 0; q < 2; q++) {
              const tt = ts[q];
              const k = (i * 2 + q) * 31 + j * 17;
              const fa = hash2(k, 1, 77) * TAU;
              const lam = 0.5 + 0.5 * Math.cos(fa) * lx + 0.5 * Math.sin(fa) * ly;
              let col = mul(pal.ink, 0.8 + 0.24 * lam);
              // The drop's second ink rises up the letters from the baseline.
              const cy = (tt[0][1] + tt[1][1] + tt[2][1]) / 3 / this.tbh;
              const inkT = this.dropAmt * sstep(0.95, 0.25, 1 - cy + 0.3 * hash2(k, 2, 79));
              col = mix(col, mul(ink2, 0.84 + 0.2 * lam), inkT);
              fc.fillStyle = css(col); fc.strokeStyle = fc.fillStyle;
              fc.beginPath(); fc.moveTo(tt[0][0], tt[0][1]); fc.lineTo(tt[1][0], tt[1][1]); fc.lineTo(tt[2][0], tt[2][1]);
              fc.closePath(); fc.fill(); fc.stroke();
            }
          }
        }
        fc.setTransform(1, 0, 0, 1, 0, 0);
        fc.globalCompositeOperation = 'destination-in';
        fc.drawImage(this.mask, 0, 0);
        fc.globalCompositeOperation = 'source-over';
        // A flat offset shadow in the sky's deep ink, as a printed poster would.
        g.globalAlpha = 0.5;
        g.drawImage(this.shadowC, L.titleX + size * 0.025, L.titleY + size * 0.03, this.tbw, this.tbh);
        g.globalAlpha = 1;
        g.drawImage(this.facetC, L.titleX, L.titleY, this.tbw, this.tbh);
        this.titleBottom = L.titleY + this.tbh;
        this.titleRight = L.titleX + this.tbw;
      } else {
        this.titleBottom = L.titleY; this.titleRight = L.titleX;
      }

      // Small tracked captions.
      const small = H * 0.022;
      g.textBaseline = 'alphabetic';
      g.fillStyle = pal.inkCss;
      g.font = '700 ' + small + 'px ' + smallFont;
      try { g.letterSpacing = (small * 0.28).toFixed(1) + 'px'; } catch (e) { /* older canvas */ }
      g.textAlign = 'left';
      const subY = this.titleBottom + small * 1.6;
      g.fillText('SONGS FOR THE DEEP BLUE HOUR', L.titleX + size * 0.02, subY);
      g.fillStyle = css(mix(pal.ink, pal.accent, 0.3 + 0.7 * this.dropAmt));
      g.fillRect(L.titleX + size * 0.02, subY + small * 0.9, size * 0.9, Math.max(1.2, small * 0.14));
      g.fillStyle = pal.inkCss;
      g.textAlign = 'right';
      g.fillText('A SLOW FLIGHT OVER', W - W * 0.045, H * 0.075);
      g.fillText('THE LISTENING HILLS', W - W * 0.045, H * 0.075 + small * 1.5);
      // The bottom rule: three columns of small type across the foot.
      const by = H - H * 0.05;
      // The foot band takes whichever ink the captions contrast with.
      const darkInk = pal.ink[0] + pal.ink[1] + pal.ink[2] < 384;
      g.fillStyle = css(darkInk ? pal.sky[3] : pal.deep);
      g.globalAlpha = darkInk ? 0.8 : 0.55;
      g.fillRect(0, by - small * 2.1, W, H - by + small * 2.1);
      g.globalAlpha = 1;
      g.fillStyle = pal.inkCss;
      g.textAlign = 'left';
      g.fillText('124 BPM', W * 0.055, by);
      if (L.wide) { g.textAlign = 'center'; g.fillText('DUSK UNTIL THE LIGHT COMES BACK', W * 0.5, by); }
      g.textAlign = 'right';
      g.fillText('BRING SOMEONE', W - W * 0.045, by);
      try { g.letterSpacing = '0px'; } catch (e) { /* */ }
    }
  });
})();
