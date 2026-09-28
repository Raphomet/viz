// Abyss — bioluminescent jellyfish in a deep-sea column.
//
// Layers, back to front: a water column gradient with god rays falling from
// the surface; far marine snow; a swarm of jellies at several depths (bells
// as translucent domes with rim light and comb rows of iridescent light,
// oral arms and tentacles as verlet chains); mid and near marine snow (the
// near flakes as out-of-focus bokeh); sparkling plankton; a vignette.
//
// The music has one job per layer, so the room can read each part:
// - Kick: every bell contracts at once (tall and narrow, the margin pulling
//   in), and because thrust is taken from the rate of contraction, each kick
//   jets every jelly upward with its tentacles trailing. The halos flare, the
//   stage makes a small zoom punch and the snow streaks as the column lurches.
//   Between kicks (intro, breakdown) the bells pulse on their own slow,
//   unsynchronised rhythms; the drop entrains them to the beat.
// - Snare / clap: a bead of bioluminescence runs down every tentacle, in the
//   palette's complementary colour, launched as a wave that sweeps across the
//   swarm from one side (alternating sides), and the rims flash that colour.
// - Bass and pad: the glow deepens (halo size, god-ray strength, water tint).
// - Hats: plankton glints.
// - Drop: more jellies swim up from below, colour spreads (comb rows go
//   rainbow, hues fan out), the column rises faster.
//
// Canvas 2D throughout, additive ('lighter') light on a dark ground. All glow
// is pre-rendered sprites (radial gradients per hue) drawn with drawImage;
// shadowBlur is never used, it is far too slow for a hundred glowing things.

(function () {
  const MAXJ = 16;           // jellies allocated; count param + drop extras
  const SEGS = 15;           // points per tentacle chain
  const ARM_SEGS = 10;       // points per oral arm
  const N_PLANK = 240;
  const HUES = 36;           // sprite hue steps (10 degrees)

  const PALETTES = [
    // bells: hue range; snare: complementary pop; plank: plankton hue;
    // top/bot: water gradient; ray: god-ray colour.
    { name: 'Prism', bells: [0, 360], snare: 55, plank: 200, top: [16, 20, 58], bot: [2, 2, 12], ray: [205, 220, 255] },
    { name: 'Abyssal', bells: [178, 290], snare: 42, plank: 188, top: [5, 34, 56], bot: [0, 3, 10], ray: [140, 225, 235] },
    { name: 'Nebula', bells: [262, 338], snare: 168, plank: 295, top: [30, 10, 52], bot: [3, 0, 10], ray: [200, 170, 255] },
    { name: 'Ember', bells: [350, 410], snare: 185, plank: 30, top: [44, 12, 10], bot: [6, 1, 2], ray: [255, 196, 150] },
  ];

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const wrapHue = (h) => ((h % 360) + 360) % 360;

  // Smooth 1D value noise, seeded per call site by an offset.
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
  }

  function makeSprite(hue, soft) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const col = (l, a) => (hue < 0 ? `hsla(0,0%,${l}%,${a})` : `hsla(${hue},100%,${l}%,${a})`);
    if (soft) {
      // Halo: a gaussian-ish falloff with no hard core.
      gr.addColorStop(0, col(60, 0.55));
      gr.addColorStop(0.25, col(55, 0.32));
      gr.addColorStop(0.55, col(50, 0.1));
      gr.addColorStop(1, col(50, 0));
    } else {
      // Point light: white-hot core, coloured falloff.
      gr.addColorStop(0, col(96, 1));
      gr.addColorStop(0.12, col(78, 0.85));
      gr.addColorStop(0.4, col(60, 0.25));
      gr.addColorStop(1, col(55, 0));
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  VIZ.register({
    id: 'abyss',
    name: 'Abyss',
    order: 201,

    params: [
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'count', label: 'Jellies', type: 'range', min: 2, max: 8, default: 5, step: 1 },
      { key: 'react', label: 'Music reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'irid', label: 'Iridescence', type: 'range', min: 0, max: 1, default: 0.65, step: 0.01 },
      { key: 'tentacles', label: 'Tentacle length', type: 'range', min: 0.4, max: 2, default: 1, step: 0.01 },
      { key: 'rays', label: 'God rays', type: 'range', min: 0, max: 1.5, default: 0.8, step: 0.01 },
      { key: 'trails', label: 'Trails', type: 'range', min: 0, max: 0.92, default: 0.35, step: 0.01 },
      { key: 'current', label: 'Current', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'reseed', label: 'New swarm', run() { this.reseed(); } },
    ],

    gallery: {
      title: 'Abyss',
      technique: 'Canvas 2D, additive light: verlet-chain tentacles and oral arms, bells as bezier domes with gradient fill and rim strokes, all glow from pre-rendered per-hue radial sprites; parallax marine snow in three depths, god-ray wedges, plankton glints',
      brief: 'A deep-sea column. God rays fall from far above, marine snow drifts past at three depths, and a swarm of glowing jellies hangs in the dark, each bell a translucent dome with a lit rim and rows of iridescent comb light, trailing oral arms and fine tentacles. Every kick contracts every bell at once and jets the swarm upward, tentacles streaming, halos flaring, the snow streaking past; the snare sends beads of complementary light running down the tentacles in a wave across the swarm; bass deepens the glow; hats make the plankton glint. The drop brings more jellies swimming up from below and fans their colour out into rainbow; the breakdown lets them drift and pulse on their own.',
      lineage: [
        'Batch 02 brief 01 (Abyss); layering after Flyover Night drive, music legibility after Interference.',
        'First pass (640x360): Canvas 2D, additive light, verlet tentacles, bells contracting on the kick with thrust taken from the rate of contraction. The drop read clearly bigger, but the swarm clumped in the centre (value-noise homes average to 0.5), tentacles hung like a comb, and jellies started off-screen below in the intro.',
        'Homes became a fixed random place plus a wander; each tentacle got its own length and a travelling wave; the opening swarm starts in the water.',
        'Snare given a second, unmistakable voice besides the tentacle beads: a ring of the complementary colour leaving each bell, swept across the swarm from alternating sides.',
        'Soft layers (water, rays, vignette, halos, bloom, bokeh) moved to quarter-resolution buffers; additive order does not matter, so the glow buffer is composited once.',
        'Drop kicks outrun a weak, capped pull home, so in the drop the swarm climbs out of the top and new jellies rise from below (the column ascending); the breakdown gathers them back. One giant foreground jelly added for depth.',
        'Drop colour fanned wider (hue spread x1.8, tentacles leaning further round the wheel), comb rows enlarged so the iridescence reads; gonads filled instead of outlined (they read as doodles at 1280x720). Kick bloom and contraction strengthened a little after the kick strip.',
        'Checked with a kick strip (11.90-12.5 s), a full-size render and a 96 s longevity run.',
        'Lead review: a lovely aquarium, not yet hard to look away from. Revision: fewer, far larger jellies (default 5, the foreground giant about a third of the frame and held in place so the breakdown is never empty); Prism the default palette; rainbow light flowing continuously down every tentacle (one stroke per segment index, hued by a travelling band); comb rows cycling faster in the drop; Trails 0.35 by default so motion leaves ghosts.',
        'Kick deepened: bells contract to ~54% width, each bell flashes its own colour, the halos and a soft water-wide bloom flare and decay in ~200 ms. The first attempt blew overlapping bells out to white across a large area; flash, halo and bloom were each tempered by about a third.',
        'Drop quickens the bells\' own pulse threefold between kicks, adds up to five jellies and fans the colour out further.',
      ],
    },

    setup() {
      this.reseed();
    },

    enter() {
      this.lastMs = null;
      this.env = { kick: 0, bass: 0, snare: 0, hat: 0, avg0: 0, energy: 0 };
      this.snareArmed = true;
      this.hatArmed = true;
      this.snareSide = 1;
      this.rise = 0;
      this.t = 0;
    },

    reseed() {
      const r = Math.random;
      this.jellies = [];
      for (let i = 0; i < MAXJ; i++) {
        // One giant drifts close to the camera: a foreground plane that makes
        // the rest of the swarm read as deep.
        const z = i === 0 ? 1.45 : 0.4 + 0.6 * r();
        const j = {
          z,
          u: r(),                        // position within the palette's hue range
          R: i === 0 ? 170 + 30 * r() : (62 + 40 * r()) * (0.45 + 0.8 * z),
          rate: 0.45 + 0.35 * r(),       // idle pulse, Hz
          ph: r(),
          seed: r() * 100,
          nt: 7 + Math.floor(r() * 5),   // tentacle count
          x: 0, y: 0, vx: 0, vy: 0, ang: 0, c: 0, cPrev: 0,
          pres: 0, waves: [], homeX: r(), homeY: r(),
          chains: null, arms: null, spawned: false,
        };
        this.jellies.push(j);
      }
      // Presence order is shuffled so the drop's extra jellies land at
      // random depths; draw order is far to near.
      this.order = this.jellies.slice();
      for (let i = this.order.length - 1; i > 0; i--) {
        const k = Math.floor(r() * (i + 1));
        [this.order[i], this.order[k]] = [this.order[k], this.order[i]];
      }
      const gi = this.order.indexOf(this.jellies[0]);
      [this.order[gi], this.order[2]] = [this.order[2], this.order[gi]];
      this.drawOrder = this.jellies.slice().sort((a, b) => a.z - b.z);

      this.snow = [];
      const layers = [[170, 0.25], [80, 0.55], [18, 1.0]];
      for (const [n, d] of layers) {
        for (let i = 0; i < n; i++) {
          this.snow.push({ x: r(), y: r(), d: d * (0.8 + 0.4 * r()), s: r(), ph: r() * 6.28 });
        }
      }
      this.plank = [];
      for (let i = 0; i < N_PLANK; i++) {
        this.plank.push({ x: r(), y: r(), ph: r() * 6.28, spark: 0, d: 0.5 + 0.5 * r() });
      }
      this.rays = [];
      for (let i = 0; i < 7; i++) this.rays.push({ a: (i / 6 - 0.5) * 0.9 + (r() - 0.5) * 0.12, w: 0.03 + 0.05 * r(), s: r() * 50 });
    },

    buffer(name, w, h) {
      if (!this.bufs) this.bufs = {};
      let b = this.bufs[name];
      if (!b) {
        const c = document.createElement('canvas');
        b = this.bufs[name] = { c, g: c.getContext('2d') };
      }
      if (b.c.width !== w || b.c.height !== h) { b.c.width = w; b.c.height = h; }
      return b.g;
    },

    sprites() {
      if (this.spr) return this.spr;
      const pt = [], halo = [];
      for (let i = 0; i < HUES; i++) {
        pt.push(makeSprite(i * 10, false));
        halo.push(makeSprite(i * 10, true));
      }
      this.spr = { pt, halo, white: makeSprite(-1, false) };
      return this.spr;
    },

    listen(sig, dt) {
      const e = this.env;
      const kRaw = clamp01((sig[0] - 42) / 48);
      e.kick = kRaw > e.kick ? ease(e.kick, kRaw, 45, dt) : ease(e.kick, kRaw, 9, dt);
      const bass = (sig[1] + sig[2]) / 200;
      e.bass = ease(e.bass, bass, 3, dt);
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
      return { snareHit, hatHit, hRaw };
    },

    // Chains hang straight down from their anchor when a jelly (re)appears,
    // so it never snaps a long line across the stage.
    resetChains(j, W) {
      const L = j.R * 3.4;
      j.chains = [];
      for (let k = 0; k < j.nt; k++) {
        const pts = new Float32Array(SEGS * 4);
        for (let i = 0; i < SEGS; i++) {
          pts[i * 4] = pts[i * 4 + 2] = j.x;
          pts[i * 4 + 1] = pts[i * 4 + 3] = j.y + (i * L) / SEGS;
        }
        j.chains.push(pts);
      }
      j.arms = [];
      for (let k = 0; k < 4; k++) {
        const pts = new Float32Array(ARM_SEGS * 4);
        for (let i = 0; i < ARM_SEGS; i++) {
          pts[i * 4] = pts[i * 4 + 2] = j.x;
          pts[i * 4 + 1] = pts[i * 4 + 3] = j.y + (i * L * 0.5) / ARM_SEGS;
        }
        j.arms.push(pts);
      }
    },

    // Verlet step for one chain pinned at (ax, ay).
    stepChain(pts, n, ax, ay, segLen, dt, flowX, t, seed, amp = 1) {
      const damp = Math.pow(0.9, dt * 60);
      const g = 70 * dt * dt;
      for (let i = 1; i < n; i++) {
        const o = i * 4;
        const x = pts[o], y = pts[o + 1];
        const vx = (x - pts[o + 2]) * damp, vy = (y - pts[o + 3]) * damp;
        pts[o + 2] = x; pts[o + 3] = y;
        // A travelling wave down each tentacle, out of step with its
        // neighbours, so they curl and part instead of hanging like a comb.
        const sway = (flowX + 30 * noise1(t * 0.6 + seed + i * 0.15)
          + 55 * amp * Math.sin(i * 0.55 - t * 2.1 + seed * 2.3) * (i / n)) * dt * dt;
        pts[o] = x + vx + sway;
        pts[o + 1] = y + vy + g;
      }
      pts[0] = pts[2] = ax; pts[1] = pts[3] = ay;
      for (let it = 0; it < 2; it++) {
        for (let i = 1; i < n; i++) {
          const a = (i - 1) * 4, b = i * 4;
          const dx = pts[b] - pts[a], dy = pts[b + 1] - pts[a + 1];
          const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          const k = (d - segLen) / d;
          if (i === 1) { pts[b] -= dx * k; pts[b + 1] -= dy * k; }
          else {
            pts[a] += dx * k * 0.5; pts[a + 1] += dy * k * 0.5;
            pts[b] -= dx * k * 0.5; pts[b + 1] -= dy * k * 0.5;
          }
        }
      }
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.jellies) this.reseed();
      if (!this.env) this.enter();
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const spr = this.sprites();

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0.001, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.t += dt * (0.4 + 0.6 * params.current);
      const t = this.t;
      const T = ms / 1000;

      const hits = this.listen(signals, dt);
      const e = this.env;
      const react = params.react;
      const kick = clamp01(e.kick * react);
      const energy = e.energy;
      const pal = PALETTES[(params.palette | 0) % PALETTES.length];

      // ---- the column rises: slowly at rest, faster in the drop, lurching on kicks
      const riseV = 6 + 28 * energy + 150 * kick;
      this.rise += riseV * dt;

      // Everything soft (water, rays, vignette, halos, bloom, bokeh) is drawn
      // into quarter-resolution buffers and scaled up: it has no edges to
      // lose, and in a software rasteriser the big additive sprites at full
      // resolution cost several times the rest of the scene put together.
      const pd = p.pixelDensity();
      const bw = Math.max(16, Math.round((p.width * pd) / 4)), bh = Math.max(16, Math.round((p.height * pd) / 4));
      const B = this.buffer('back', bw, bh), G = this.buffer('glow', bw, bh);
      B.setTransform(bw / W, 0, 0, bh / H, 0, 0);
      G.setTransform(1, 0, 0, 1, 0, 0);
      G.globalCompositeOperation = 'source-over';
      G.globalAlpha = 1;
      G.clearRect(0, 0, bw, bh);
      G.setTransform(bw / W, 0, 0, bh / H, 0, 0);
      G.globalCompositeOperation = 'lighter';

      // ---- water: gradient, deepened by bass
      B.globalCompositeOperation = 'source-over';
      B.globalAlpha = 1;
      const glow = clamp01(0.55 + 0.6 * e.bass + 0.35 * energy);
      const top = pal.top.map((v) => Math.round(v * (0.7 + 0.8 * glow)));
      let gr = B.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
      gr.addColorStop(0.55, `rgb(${Math.round(top[0] * 0.3)},${Math.round(top[1] * 0.3)},${Math.round(top[2] * 0.35)})`);
      gr.addColorStop(1, `rgb(${pal.bot[0]},${pal.bot[1]},${pal.bot[2]})`);
      B.fillStyle = gr;
      B.fillRect(-2, -2, W + 4, H + 4);

      // ---- god rays: wedges from a sun far above, swaying
      B.globalCompositeOperation = 'lighter';
      const rayK = params.rays * (0.35 + 0.45 * e.bass + 0.25 * energy);
      if (rayK > 0.01) {
        const sx = W * (0.5 + 0.18 * noise1(t * 0.03 + 3)), sy = -H * 0.9;
        const rc = pal.ray;
        for (const r of this.rays) {
          const a = r.a + 0.07 * noise1(t * 0.07 + r.s);
          const w = r.w * (0.8 + 0.4 * noise1(t * 0.11 + r.s * 2));
          const a0 = a - w, a1 = a + w;
          const L = H * 2.4;
          const inten = rayK * (0.5 + 0.5 * noise1(t * 0.13 + r.s * 3)) * 0.16;
          if (inten <= 0.003) continue;
          gr = B.createLinearGradient(0, 0, 0, H * 1.05);
          gr.addColorStop(0, `rgba(${rc[0]},${rc[1]},${rc[2]},${inten})`);
          gr.addColorStop(0.5, `rgba(${rc[0]},${rc[1]},${rc[2]},${inten * 0.35})`);
          gr.addColorStop(1, `rgba(${rc[0]},${rc[1]},${rc[2]},0)`);
          B.fillStyle = gr;
          B.beginPath();
          B.moveTo(sx, sy);
          B.lineTo(sx + Math.sin(a0) * L, sy + Math.cos(a0) * L);
          B.lineTo(sx + Math.sin(a1) * L, sy + Math.cos(a1) * L);
          B.closePath();
          B.fill();
        }
      }
      // Vignette lives in the backdrop, so it darkens water, never jellies.
      B.globalCompositeOperation = 'source-over';
      const vr = Math.hypot(W, H) * 0.5;
      gr = B.createRadialGradient(W / 2, H * 0.45, vr * 0.4, W / 2, H * 0.45, vr);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.6)');
      B.fillStyle = gr;
      B.fillRect(-2, -2, W + 4, H + 4);

      g.save();
      g.globalCompositeOperation = 'source-over';
      // Trails: the backdrop only partly covers the last frame.
      g.globalAlpha = 1 - params.trails;
      g.imageSmoothingEnabled = true;
      g.drawImage(this.bufs.back.c, 0, 0, W, H);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';

      // ---- zoom punch on the kick, for everything in the water
      const zoom = 1 + 0.035 * kick;
      g.translate(W / 2, H * 0.45);
      g.scale(zoom, zoom);
      g.translate(-W / 2, -H * 0.45);

      // ---- marine snow; layer 0 far, 1 mid, drawn before the jellies; 2 near after
      const drawSnow = (near) => {
        for (const s of this.snow) {
          if ((s.d > 0.8) !== near) continue;
          const span = H + 40;
          const y = ((s.y * span + this.rise * s.d + T * 4 * s.d) % span + span) % span - 20;
          const x = ((s.x * W + 14 * noise1(s.ph + t * 0.1) + t * 6 * (params.current - 0.5) * s.d) % W + W) % W;
          if (near) {
            const rr = 7 + 12 * s.s;
            G.globalAlpha = 0.09 + 0.06 * e.bass;
            G.drawImage(spr.halo[20], x - rr, y - rr, rr * 2, rr * 2);
          } else {
            const len = 0.8 + riseV * s.d * 0.035;
            const a = (0.18 + 0.35 * s.d) * (0.6 + 0.4 * s.s);
            g.fillStyle = `rgba(190,215,230,${a})`;
            g.fillRect(x, y - len, 0.8 + s.d * 1.1, len + 0.8);
          }
        }
        g.globalAlpha = 1;
      };
      drawSnow(false);

      // ---- jellies
      const extra = Math.round(5 * energy);
      const nVis = Math.min(MAXJ, Math.round(params.count) + extra);
      for (let i = 0; i < MAXJ; i++) {
        const j = this.order[i];
        const target = i < nVis ? 1 : 0;
        if (target && j.pres < 0.02 && !j.spawned) {
          // Enter from below, so new arrivals are seen swimming up.
          j.x = W * (0.1 + 0.8 * j.homeX);
          j.y = H + j.R * 1.5 + 60 * Math.random();
          j.vx = 0; j.vy = -40;
          if (!this.started) {
            // The opening swarm is already in the water.
            j.x = W * (0.1 + 0.8 * j.homeX);
            j.y = H * (0.25 + 0.5 * j.homeY);
            j.vy = 0;
            j.pres = 0.5;
          }
          j.spawned = true;
          this.resetChains(j, W);
        }
        if (!target && j.pres < 0.01) j.spawned = false;
        j.pres = ease(j.pres, target, target ? 1.1 : 0.6, dt);
      }
      this.started = true;

      const snareHue = pal.snare;
      if (hits.snareHit) {
        this.snareSide = -this.snareSide;
        for (const j of this.jellies) {
          if (!j.spawned) continue;
          const frac = this.snareSide > 0 ? j.x / W : 1 - j.x / W;
          j.waves.push(T + 0.28 * clamp01(frac));
          if (j.waves.length > 4) j.waves.shift();
        }
      }

      const hueLo = pal.bells[0], hueHi = pal.bells[1];
      // The drop fans the swarm's hues out across (and past) the palette; the
      // centre wanders slowly so the harmony keeps shifting over minutes.
      const spread = pal.name === 'Prism' ? 1 : 0.5 + 1.3 * energy;
      const hueMid = (hueLo + hueHi) / 2 + (pal.name === 'Prism' ? t * 4 : 28 * noise1(t * 0.013 + 5));
      const irid = params.irid * (0.45 + 0.9 * energy);

      for (const j of this.drawOrder) {
        if (!j.spawned) continue;
        const z = j.z;
        // Idle pulse: quick contraction, slow relaxation; the kick overrides it.
        // The drop quickens the bells' own pulse, so between kicks they
        // flutter rather than rest.
        j.ph += dt * j.rate * (1 + 2.2 * energy);
        const f = j.ph % 1;
        const idle = f < 0.18 ? Math.sin((f / 0.18) * Math.PI / 2) : Math.exp(-(f - 0.18) * 5);
        const cT = Math.max(idle * (0.5 - 0.2 * energy), kick);
        j.cPrev = j.c;
        j.c = cT;
        const c = j.c;

        // Thrust from the rate of contraction, along the bell's axis.
        const dc = Math.max(0, j.c - j.cPrev);
        // The giant bobs on the kick but keeps its place: it is the foreground,
        // and when it swam out of the top in the drop the breakdown was empty.
        const thrust = dc * (z > 1 ? 70 : 95 * (0.6 + 0.6 * z));
        j.ang = 0.38 * noise1(t * 0.09 + j.seed) + 0.1 * noise1(t * 0.31 + j.seed * 3);
        const ax = Math.sin(j.ang), ay = -Math.cos(j.ang);
        j.vx += ax * thrust;
        j.vy += ay * thrust;
        // Homes wander across the whole stage; the drop lifts them a little.
        // Homes are spread by a fixed random place plus a slow wander: value
        // noise alone averages to the centre and clumped the swarm there.
        const hx = W * Math.min(0.95, Math.max(0.05, 0.08 + 0.84 * j.homeX + 0.22 * noise1(t * 0.021 + j.seed * 7)));
        const hy = H * Math.min(0.8, Math.max(0.18, 0.22 + 0.5 * j.homeY + 0.18 * noise1(t * 0.017 + j.seed * 5) - 0.06 * energy));
        // A weak, capped pull home: enough to gather the swarm back in quiet
        // passages, too weak to hold it against a drop's kicks, so in the drop
        // the jellies climb out of the top and new ones rise from below.
        let fx = (hx - j.x) * 0.35, fy = (hy - j.y) * 0.8 + 6;
        const fm = Math.hypot(fx, fy);
        const cap = z > 1 ? 160 : 45;
        if (fm > cap) { fx *= cap / fm; fy *= cap / fm; }
        j.vx += fx * dt; j.vy += fy * dt;
        const drag = Math.exp(-2.0 * dt);
        j.vx *= drag; j.vy *= drag;
        j.x += j.vx * dt; j.y += j.vy * dt;
        if (j.y < -j.R * (1.5 + 3.6 * params.tentacles)) {
          j.y = H + j.R * 1.3;
          j.x = W * (0.08 + 0.84 * Math.random());
          j.vx = 0; j.vy = -30;
          this.resetChains(j, W);
        }

        const R = j.R;
        const Wb = R * (1 - 0.46 * c);             // bell half-width
        const Hb = R * (0.7 + 0.46 * c);          // bell height
        const my = R * 0.06 * c;                  // margin droop when contracted
        const cos = Math.cos(j.ang), sin = Math.sin(j.ang);
        const toW = (lx, ly) => [j.x + lx * cos - ly * sin, j.y + lx * sin + ly * cos];

        // Simulate tentacles and oral arms.
        const L = R * 3.4 * params.tentacles * (0.9 + 0.2 * Math.sin(j.seed));
        const flowX = 25 * (params.current - 0.5) + 20 * noise1(t * 0.05 + 9);
        for (let k = 0; k < j.nt; k++) {
          const u = j.nt === 1 ? 0 : -1 + (2 * k) / (j.nt - 1);
          const [axw, ayw] = toW(u * Wb * 0.92, my + R * 0.02);
          const lf = 0.65 + 0.45 * hash(j.seed * 13 + k);
          this.stepChain(j.chains[k], SEGS, axw, ayw, (L * lf) / SEGS, dt, flowX, t, j.seed + k * 1.7, Math.max(1, j.R / 60));
        }
        for (let k = 0; k < 4; k++) {
          const [axw, ayw] = toW((k - 1.5) * R * 0.08, -R * 0.05);
          this.stepChain(j.arms[k], ARM_SEGS, axw, ayw, (L * 0.5) / ARM_SEGS, dt, flowX * 0.6, t, j.seed + 40 + k);
        }

        // ---- colour
        const hue = wrapHue(hueMid + (j.u - 0.5) * (hueHi - hueLo) * spread);
        const depthA = (z > 1 ? 0.7 : 0.35 + 0.65 * z) * j.pres;
        const sat = 70 + 25 * energy;
        // Two-tone: tentacles lean toward the far end of the palette, more so
        // in the drop, so each jelly carries a gradient of colour.
        const tentHue = wrapHue(hue + (pal.name === 'Prism' ? 60 : 30) * (0.5 + 1.3 * energy));
        const hi = Math.round(hue / 10) % HUES;

        // Snare waves: brightness of chain point i given each wave's age.
        const waves = j.waves;
        let rimSnare = 0;
        for (let wi = 0; wi < waves.length; wi++) {
          const a = T - waves[wi];
          if (a >= 0 && a < 0.35) rimSnare = Math.max(rimSnare, 1 - a / 0.35);
        }
        rimSnare *= Math.min(1, react);

        // ---- halo
        const bodyCy = -Hb * 0.45;
        const [cx, cy] = toW(0, bodyCy);
        const haloR = R * (2.5 + 1.3 * e.bass + 1.6 * kick);
        G.globalAlpha = clamp01((0.28 + 0.3 * e.bass + 0.5 * kick) * depthA);
        G.drawImage(spr.halo[hi], cx - haloR, cy - haloR, haloR * 2, haloR * 2);
        // Kick flash: each bell lights up in its own colour.
        if (kick > 0.02) {
          const fr = R * (1.3 + 0.6 * kick);
          G.globalAlpha = clamp01(0.55 * kick * depthA);
          G.drawImage(spr.pt[hi], cx - fr, cy - fr, fr * 2, fr * 2);
        }

        // Snare shock ring: a ring of the complementary colour leaves the bell.
        for (let wi = 0; wi < waves.length; wi++) {
          const a = T - waves[wi];
          if (a < 0 || a > 0.45) continue;
          const q = a / 0.45;
          const ra = clamp01((1 - q) * (1 - q) * depthA * Math.min(1.2, react));
          g.beginPath();
          g.arc(cx, cy, R * (0.9 + 2.0 * Math.sqrt(q)), 0, Math.PI * 2);
          g.strokeStyle = `hsl(${snareHue},100%,58%)`;
          g.globalAlpha = ra * 0.3;
          g.lineWidth = (9 - 5 * q) * (0.5 + 0.5 * z);
          g.stroke();
          g.globalAlpha = ra * 0.85;
          g.lineWidth = (1.8 - 1.2 * q) * (0.5 + 0.5 * z);
          g.stroke();
        }
        g.globalAlpha = 1;

        // ---- tentacles (behind the bell)
        const tentA = (0.28 + 0.2 * e.bass + 0.35 * rimSnare) * depthA;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        // Rainbow bioluminescence flows continuously down the tentacles: one
        // path per segment index across all of a jelly's tentacles, each
        // stroked in the hue of the band passing through it (28 strokes a
        // jelly, instead of one per segment).
        g.globalAlpha = 1;
        const lwS = R / 60;
        const bow = params.irid * (0.55 + 0.45 * energy);
        const flow = t * (0.35 + 0.9 * energy);
        for (let i = 1; i < SEGS; i++) {
          g.beginPath();
          for (const pts of j.chains) {
            g.moveTo(pts[(i - 1) * 4], pts[(i - 1) * 4 + 1]);
            g.lineTo(pts[i * 4], pts[i * 4 + 1]);
          }
          const ph = (i / SEGS) * 0.9 - flow;
          const sh = wrapHue(tentHue + bow * 360 * (ph - Math.floor(ph)));
          const tip = 1 - 0.5 * (i / SEGS);
          g.strokeStyle = `hsla(${sh},${sat}%,60%,${tentA * 0.4 * tip})`;
          g.lineWidth = 3.2 * lwS;
          g.stroke();
          g.strokeStyle = `hsla(${sh},${sat}%,78%,${tentA * tip * 1.2})`;
          g.lineWidth = 0.9 * lwS;
          g.stroke();
        }

        // Oral arms: thicker, frilly ribbons.
        g.beginPath();
        for (const pts of j.arms) {
          g.moveTo(pts[0], pts[1]);
          for (let i = 1; i < ARM_SEGS; i++) {
            const wig = 1.8 * Math.sin(i * 1.9 + t * 3 + j.seed);
            g.lineTo(pts[i * 4] + wig, pts[i * 4 + 1]);
          }
        }
        const armHue = wrapHue(tentHue + 25);
        g.strokeStyle = `hsla(${armHue},${sat}%,60%,${(0.16 + 0.1 * e.bass) * depthA})`;
        g.lineWidth = R * 0.14;
        g.stroke();
        g.strokeStyle = `hsla(${armHue},${sat}%,75%,${(0.3 + 0.2 * rimSnare) * depthA})`;
        g.lineWidth = R * 0.035;
        g.stroke();

        // Snare beads running down the tentacles.
        if (waves.length) {
          const sh = Math.round(snareHue / 10) % HUES;
          for (let wi = 0; wi < waves.length; wi++) {
            const a = T - waves[wi];
            if (a < 0 || a > 1.0) continue;
            const front = a * 26;            // points per second down the chain
            const fade = Math.exp(-a * 2.2) * Math.min(1.2, react) * j.pres;
            const lo = Math.max(1, Math.floor(front - 3)), hiI = Math.min(SEGS - 1, Math.ceil(front + 3));
            for (const pts of j.chains) {
              for (let i = lo; i <= hiI; i++) {
                const d = i - front;
                const b = Math.exp(-d * d * 0.5) * fade;
                if (b < 0.04) continue;
                const rr = (3 + 7 * b) * (0.6 + 0.5 * z);
                g.globalAlpha = clamp01(b);
                g.drawImage(spr.pt[sh], pts[i * 4] - rr, pts[i * 4 + 1] - rr, rr * 2, rr * 2);
              }
            }
            for (const pts of j.arms) {
              const fr = a * 17;
              const i = Math.min(ARM_SEGS - 1, Math.max(1, Math.round(fr)));
              const b = fade * Math.exp(-(i - fr) * (i - fr) * 0.5);
              if (b < 0.04) continue;
              const rr = (4 + 8 * b) * (0.6 + 0.5 * z);
              g.globalAlpha = clamp01(b * 0.8);
              g.drawImage(spr.pt[sh], pts[i * 4] - rr, pts[i * 4 + 1] - rr, rr * 2, rr * 2);
            }
          }
          while (waves.length && T - waves[0] > 1.0) waves.shift();
        }
        g.globalAlpha = 1;

        // ---- bell, in local coordinates
        g.save();
        g.translate(j.x, j.y);
        g.rotate(j.ang);
        const bellPath = () => {
          g.beginPath();
          g.moveTo(-Wb, my);
          g.bezierCurveTo(-Wb * 1.02, -Hb * 0.62, -Wb * 0.58, -Hb, 0, -Hb);
          g.bezierCurveTo(Wb * 0.58, -Hb, Wb * 1.02, -Hb * 0.62, Wb, my);
          // Velum: a scalloped margin curving back under the bell.
          const sc = 8;
          for (let i = 1; i <= sc; i++) {
            const x0 = Wb - (2 * Wb * (i - 0.5)) / sc, x1 = Wb - (2 * Wb * i) / sc;
            const lift = -R * 0.1 * (1 - Math.pow((x1 / Wb), 2)) + my;
            g.quadraticCurveTo(x0, lift + R * 0.07 + R * 0.03 * Math.sin(t * 4 + i + j.seed), x1, lift);
          }
          g.closePath();
        };
        bellPath();
        gr = g.createRadialGradient(0, -Hb * 0.55, R * 0.05, 0, -Hb * 0.3, R * 1.1);
        const bodyL = 55 + 22 * kick;
        gr.addColorStop(0, `hsla(${hue},${sat}%,${bodyL + 20}%,${(0.34 + 0.5 * kick) * depthA})`);
        gr.addColorStop(0.55, `hsla(${hue},${sat}%,${bodyL}%,${(0.12 + 0.1 * e.bass) * depthA})`);
        gr.addColorStop(1, `hsla(${wrapHue(hue + 30)},${sat}%,50%,${0.2 * depthA})`);
        g.fillStyle = gr;
        g.fill();
        // Rim light: wide soft pass then a thin bright one; the snare tints it.
        const rimHue = rimSnare > 0.05 ? snareHue : hue;
        const rimMix = rimSnare > 0.05 ? rimSnare : 0;
        g.strokeStyle = `hsla(${rimMix > 0 ? rimHue : hue},${sat}%,65%,${(0.22 + 0.2 * kick + 0.3 * rimMix) * depthA})`;
        g.lineWidth = 4 * (0.5 + 0.5 * z);
        g.stroke();
        g.strokeStyle = `hsla(${rimMix > 0.3 ? rimHue : hue},${sat}%,${82 + 10 * rimMix}%,${(0.55 + 0.35 * kick + 0.3 * rimMix) * depthA})`;
        g.lineWidth = 1.1 * (0.5 + 0.5 * z);
        g.stroke();

        // Gonads: four horseshoe loops seen through the bell.
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + 0.6;
          const gx = Math.cos(a) * Wb * 0.3, gy = -Hb * 0.5 + Math.sin(a) * Hb * 0.13;
          g.moveTo(gx + R * 0.12, gy);
          g.ellipse(gx, gy, R * 0.12, R * 0.06, a, 0, Math.PI * 2);
        }
        // Filled, not outlined: outlined they read as a doodle on the bell.
        g.fillStyle = `hsla(${wrapHue(hue - 30)},${sat}%,68%,${(0.16 + 0.22 * kick) * depthA})`;
        g.fill();

        // Comb rows: meridians of light whose colour travels from apex to rim,
        // like a ctenophore's cilia. Iridescence fans the hue into a rainbow.
        const rows = R > 90 ? 10 : 8, dots = R > 90 ? 10 : 7;
        for (let rI = 0; rI < rows; rI++) {
          const m = -0.85 + (1.7 * rI) / (rows - 1);
          for (let d = 1; d <= dots; d++) {
            const s = d / (dots + 0.5);
            // Point on the dome surface between apex (s=0) and margin (s=1).
            const px = m * Wb * Math.sin(s * Math.PI / 2) * 0.95;
            const py = -Hb * Math.cos(s * Math.PI / 2) * (1 - 0.25 * m * m) + my * s;
            const wave = Math.sin((s * 2.2 - T * (0.9 + 2.2 * energy) + rI * 0.35) * Math.PI * 2);
            const dh = wrapHue(hue + irid * 180 * wave + irid * 120 * m);
            const b = (0.35 + 0.35 * (0.5 + 0.5 * wave)) * (0.6 + 0.6 * kick);
            const rr = (1.8 + 2.2 * b) * (1 + 0.4 * irid) * (R / 60);
            g.globalAlpha = clamp01(b * depthA);
            g.drawImage(spr.pt[Math.round(dh / 10) % HUES], px - rr, py - rr, rr * 2, rr * 2);
          }
        }
        g.globalAlpha = 1;
        g.restore();
      }

      // ---- plankton: hats make them glint
      if (hits.hatHit) {
        const n = Math.round(14 + 26 * clamp01(e.hat) * Math.min(1.5, react));
        for (let i = 0; i < n; i++) this.plank[Math.floor(Math.random() * N_PLANK)].spark = 1;
      }
      // The build's riser is continuous hiss, no onsets: it lights plankton steadily.
      const hissN = Math.floor(hits.hRaw * 6 * react);
      for (let i = 0; i < hissN; i++) {
        const q = this.plank[Math.floor(Math.random() * N_PLANK)];
        q.spark = Math.max(q.spark, 0.6);
      }
      const ph = Math.round(pal.plank / 10) % HUES;
      const sparkDecay = Math.exp(-7 * dt);
      for (const q of this.plank) {
        const span = H + 20;
        const y = ((q.y * span + this.rise * 0.7 * q.d + 6 * noise1(q.ph + t * 0.2)) % span + span) % span - 10;
        const x = ((q.x * W + 10 * noise1(q.ph * 3 + t * 0.15)) % W + W) % W;
        const base = 0.25 + 0.15 * Math.sin(T * 1.3 + q.ph);
        g.globalAlpha = base * q.d;
        g.drawImage(spr.pt[ph], x - 1.6, y - 1.6, 3.2, 3.2);
        if (q.spark > 0.03) {
          const rr = 2 + 7 * q.spark;
          g.globalAlpha = clamp01(q.spark);
          g.drawImage(spr.white, x - rr, y - rr, rr * 2, rr * 2);
          // A four-point glint: two thin crossed strokes.
          g.fillStyle = `hsla(${pal.plank},80%,85%,${q.spark * 0.7})`;
          const gl = rr * 1.8;
          g.fillRect(x - gl, y - 0.35, gl * 2, 0.7);
          g.fillRect(x - 0.35, y - gl, 0.7, gl * 2);
        }
        q.spark *= sparkDecay;
      }
      g.globalAlpha = 1;

      drawSnow(true);

      // ---- kick bloom: a soft lift of light over the swarm, never a strobe
      if (kick > 0.02) {
        const bh2 = Math.round(wrapHue(hueMid) / 10) % HUES;
        const br = Math.max(W, H) * 0.8;
        G.globalAlpha = 0.32 * kick;
        G.drawImage(spr.halo[bh2], W / 2 - br, H * 0.45 - br, br * 2, br * 2);
      }
      G.globalAlpha = 1;
      // The glow buffer is composited inside the zoom, like the rest of the water.
      g.globalAlpha = 1;
      g.drawImage(this.bufs.glow.c, 0, 0, W, H);
      g.restore();
    },
  });
})();
