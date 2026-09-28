// Guilloché — Parametric Lines (../viz/parametric.js, ../../ParametricLines.pde)
// re-engraved as a banknote, after the Designer's note that the 2016 sketch
// should become "an engraved spirograph ... the pattern a banknote uses".
//
// The whole stage is one note of an invented currency, the Low Frequency
// Reserve, denomination 33⅓. A rose-engine rosette fills the middle: three
// bands of phase-shifted sinusoidal rings, each band a lattice woven from a
// few dozen closed curves, so the lace is literally Raph's parametric curves
// laid side by side. The band phases drift at different rates, which is what
// makes the lace crawl and the moiré keep finding new shapes. Behind it a
// lathe-work net of sine lines flows sideways; around it a microprint border.
//
// Music, kept to the parts of a note:
// - bass line: the rosette's petal depth swells (continuous, eased);
// - kick: one ripple leaves the portrait window and travels out through the
//   lace, and the serial number ticks up by one (the kick is counted);
// - clap: the two side medallions index one division, like a rose engine's
//   division plate clicking round;
// - hats: glints of a second ink run along the microprint;
// - drop: a second ink printed in register — a counter-turning rosette, a lace
//   doubled with half-phase curves, and the intaglio vignette in the window (a
//   turntable, spinning) — plus faster drift. Every one of those is a param.
(function () {
  const TAU = Math.PI * 2;

  // Paper, first ink, second ink, serial ink. `blend` is how the second ink
  // overprints: multiply on paper, screen on the dark proof.
  const PALETTES = [
    // Prussian blue on warm ivory with a gold second plate: deliberately not
    // green-on-green, which Parametric Lines V2 took for its own sheet.
    { name: 'Prussian and gold', paper: '#F2EAD6', paper2: '#E6D9BC', ink: '#1C3A7A', ink2: '#C98A1C', serial: '#C4351F', fibre: ['#C85A6A', '#5A76B8'], blend: 'multiply' },
    { name: 'Security green', paper: '#F0EBDA', paper2: '#E3DCC4', ink: '#1E5A44', ink2: '#C0476A', serial: '#1C2A5A', fibre: ['#C85A6A', '#5A76B8'], blend: 'multiply' },
    { name: 'Sepia and rose', paper: '#EEE5D3', paper2: '#E2D4BA', ink: '#5B3B22', ink2: '#B23F68', serial: '#1F3F8C', fibre: ['#B8505A', '#6A86B0'], blend: 'multiply' },
    { name: 'Night proof', paper: '#0F1220', paper2: '#171B2E', ink: '#A9BCE8', ink2: '#E6B25A', serial: '#E7553E', fibre: ['#6A3A40', '#34466A'], blend: 'screen' },
  ];

  const PRESETS = {
    calm: { turn: 0.3, swell: 0.7, lace: 0, ink2: 0, plate: 0.16, spin: 0.35, loupe: 1 },
    drop: { turn: 0.95, swell: 1.3, lace: 1, ink2: 1, plate: 1, spin: 1, loupe: 1 },
    // Under the loupe: the lace at 2.4x, both inks, slow, for staring into.
    loupe: { turn: 0.22, swell: 0.9, lace: 1, ink2: 1, plate: 1, spin: 0.3, loupe: 2.4, follow: 0 },
    proof: { colorPalette: 3, turn: 0.3, swell: 0.7, lace: 0, ink2: 0, plate: 0.16, spin: 0.35 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['turn', 'swell', 'lace', 'ink2', 'plate', 'spin'];

  const MICRO = 'LOW FREQUENCY RESERVE · PAYABLE ON THE DOWNBEAT · THIRTY-THREE AND A THIRD · ';
  const SANS_SERIF = '"Libre Baskerville", Georgia, serif';

  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
      Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  // Small seeded PRNG for the paper fibres, so the cache is the same every
  // time it is rebuilt (a resize must not reshuffle the paper).
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Trig tables per (n, m, samples): every curve in a band shares its angles,
  // so a curve costs a handful of multiply-adds per vertex.
  const TABLES = {};
  function table(n, m, S) {
    const key = n + ':' + m + ':' + S;
    if (TABLES[key]) return TABLES[key];
    const T = { c: new Float32Array(S), s: new Float32Array(S), sn: new Float32Array(S),
      cn: new Float32Array(S), sm: new Float32Array(S), cm: new Float32Array(S) };
    for (let i = 0; i < S; i++) {
      const th = (i / S) * TAU;
      T.c[i] = Math.cos(th); T.s[i] = Math.sin(th);
      T.sn[i] = Math.sin(n * th); T.cn[i] = Math.cos(n * th);
      T.sm[i] = Math.sin(m * th); T.cm[i] = Math.cos(m * th);
    }
    return (TABLES[key] = T);
  }

  // One rose-engine band: N closed curves r = r0 + a·sin(nθ + φk) + b·sin(mθ + ψ),
  // φk evenly spaced. `half` draws the interleaved set at φk + π/N instead,
  // which doubles the lattice. Every curve goes into the caller's open path.
  function band(g, B, R, ph, psi, half, ripple) {
    const T = table(B.n, B.m, B.S);
    const r0 = B.r * R, a = B.a * R * B.amp, b = B.b * R;
    const cps = Math.cos(psi), sps = Math.sin(psi);
    const N = B.N, S = B.S;
    const nr = ripple.length;
    for (let k = 0; k < N; k++) {
      const phi = ph + (TAU * (k + (half ? 0.5 : 0))) / N;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      for (let i = 0; i <= S; i++) {
        const j = i === S ? 0 : i;
        let r = r0 + a * (T.sn[j] * cp + T.cn[j] * sp) + b * (T.sm[j] * cps + T.cm[j] * sps);
        // The kick ripple: a radial push in a narrow ring around its front.
        for (let w = 0; w < nr; w += 2) {
          const u = (r - ripple[w]) * 0.075;
          if (u > -3 && u < 3) r += ripple[w + 1] * Math.exp(-u * u);
        }
        const x = T.c[j] * r, y = T.s[j] * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    }
  }

  // The main rosette, outside in. r, a, b are fractions of the rosette radius.
  // Few curves with a deep swing, so each band reads as an open woven
  // lattice (lace) rather than a solid ribbon; the first render with 20–30
  // curves a band printed as flat tone at 640x360.
  const MAIN = [
    { r: 0.905, a: 0.075, b: 0.02, n: 24, m: 6, N: 12, S: 288, rate: 0.23, amp: 1 },
    { r: 0.70, a: 0.15, b: 0.035, n: 10, m: 5, N: 14, S: 200, rate: -0.15, amp: 1 },
    { r: 0.485, a: 0.07, b: 0.012, n: 30, m: 10, N: 10, S: 330, rate: 0.31, amp: 1 },
  ];
  // The second ink: counter-turning bands laid over the gaps of the first.
  const SECOND = [
    { r: 0.80, a: 0.11, b: 0.02, n: 18, m: 9, N: 12, S: 216, rate: -0.27, amp: 1 },
    { r: 0.585, a: 0.085, b: 0.025, n: 15, m: 5, N: 10, S: 210, rate: 0.19, amp: 1 },
  ];
  const MEDAL = { r: 0.76, a: 0.16, b: 0.03, n: 9, m: 3, N: 10, S: 144, rate: 0.12, amp: 1 };
  const MEDAL_DIV = 12;   // the medallion's division plate: one click per clap

  VIZ.register({
    id: 'guilloche',
    name: 'Guilloché',
    order: 803,

    params: [
      { key: 'colorPalette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      // How fast the band phases drift: the lace crawling. The drop speeds it.
      { key: 'turn', label: 'Lathe speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.turn, step: 0.01 },
      // Reaction strength: how far the bass line swells the rosette's petals.
      { key: 'swell', label: 'Bass swell', type: 'range', min: 0, max: 2, default: PRESETS.calm.swell, step: 0.01 },
      { key: 'lace', label: 'Double lace', type: 'range', min: 0, max: 1, default: PRESETS.calm.lace, step: 0.01 },
      { key: 'ink2', label: 'Second ink', type: 'range', min: 0, max: 1, default: PRESETS.calm.ink2, step: 0.01 },
      // The intaglio vignette in the window: a watermark at low values, a
      // full second-ink engraving at 1.
      { key: 'plate', label: 'Turntable plate', type: 'range', min: 0, max: 1, default: PRESETS.calm.plate, step: 0.01 },
      { key: 'spin', label: 'Platter speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.spin, step: 0.01 },
      { key: 'weight', label: 'Engraving weight', type: 'range', min: 0.3, max: 2, default: 1, step: 0.01 },
      // A loupe over the note that wanders slowly across the lace.
      { key: 'loupe', label: 'Loupe', type: 'range', min: 1, max: 4, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Guilloché',
      technique: 'Canvas 2D: rose-engine bands built from phase-shifted closed sinusoidal curves (r = r0 + a·sin(nθ+φk) + b·sin(mθ+ψ)) from shared trig tables, one stroked path per band per ink; a flowing lathe-work net of interlaced sine lines; paper, fibres and the microprint border cached at device resolution with a second cached copy in the glint ink, clipped in for hat glints; a radial kick ripple displacing the lace near its front; the second ink overprinted in register with multiply (screen on the dark proof); onset detection against slow baselines and a section follower easing toward the drop preset',
      brief: 'A banknote of an invented currency, the Low Frequency Reserve, denomination 33⅓, filling the stage: an engraved rose-engine rosette in Prussian blue on ivory security paper, a lathe-work net flowing behind it, two side medallions, a microprint border, a serial number in red. The lace never stops crawling, because each band of curves drifts at its own rate and the moiré keeps re-forming. The bass line swells the rosette\'s petals; every kick sends one ripple out from the portrait window through the lace and ticks the serial number up by one; the clap clicks the side medallions round one division of their plate; the hats run glints of colour along the microprint. The drop prints a second ink in register: a counter-turning rosette over the gaps of the first, the lace doubled, and the intaglio vignette in the window, an engraved turntable whose platter spins. The breakdown takes the second ink off the press and leaves the turntable as a faint watermark.',
      lineage: [
        'Parametric Lines (web/viz/parametric.js), Raph\'s ParametricLines.pde (2016): pairs of parametric curves joined by trails; here each band is a family of parametric closed curves laid side by side, which is how a rose engine cuts guilloché.',
        'Kept apart from Parametric Lines V2 (a single chord ribbon, green on grey-green): here the subject is lathe symmetry — rosettes, medallions and the whole note layout — in blue and gold on ivory.',
        'Designer judge (2026-09-28), Parametric Lines fix: "an engraved spirograph. Guilloché in one ink on security-paper green ... the drop adding a second ink in register"; and proposal 7, Guilloché banknote, with a second-colour intaglio portrait of a turntable.',
        'Banknote engraving and rose-engine lathe work: rosettes, lathe-work nets, microprint borders, security fibres, serial numbers, the division plate.',
        'All wording, the currency, its denomination and every mark are invented; no real note, bank, portrait or seal is referenced.',
        'Presets: calm, drop, loupe (2.4x into the lace, both inks), proof (the plate proofed in pale ink on black).',
      ],
    },

    enter() {
      this.lastT = null;
      this.env = null;
    },

    init() {
      this.env = { kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0, hf: 0, hs: 0, hWait: 0,
        bass: 0, low: 0, dropOn: false, auto: 0 };
      this.phase = [0, 0, 0, 0, 0];   // accumulated band drift
      this.psi = 0;
      this.flow = 0;
      this.platter = 0;
      this.medal = 0;                 // eased index angle
      this.medalTarget = 0;
      this.serial = 4180;
      this.stampT = -9;
      this.waves = [];
      this.glints = [];
      this.rand = rng(9173);
      this.loupeT = 0;
    },

    listen(signals, dt, t) {
      const e = this.env;
      // Kick: fast minus slow envelope on band 0, refractory so a kick's own
      // decay never fires twice.
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        this.waves.push({ t: t - 0.02, amp: clamp((e.kf - e.ks) * 3, 0.6, 1) });
        this.serial = (this.serial + 1) % 1000000;
        this.stampT = t;
        e.kWait = 0.2;
      }
      const c = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, c, 30, dt);
      e.cs = ease(e.cs, c, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        this.medalTarget += TAU / MEDAL_DIV;
        e.cWait = 0.5;
      }
      const h = (signals[6] + signals[7] + signals[8]) / 300;
      e.hf = ease(e.hf, h, 45, dt);
      e.hs = ease(e.hs, h, 4, dt);
      e.hWait = Math.max(0, e.hWait - dt);
      if (e.hf - e.hs > 0.05 && e.hWait === 0) {
        // Two glints per hat, somewhere on the border, running along it.
        for (let i = 0; i < 2; i++) {
          this.glints.push({ t, edge: Math.floor(this.rand() * 4), pos: this.rand(),
            dir: this.rand() < 0.5 ? -1 : 1, amp: clamp((e.hf - e.hs) * 6, 0.5, 1) });
        }
        e.hWait = 0.09;
      }
      // Bass line (bands 1–2) for the swell: eased, so the kick never jerks it.
      e.bass = ease(e.bass, (signals[1] + signals[2]) / 200, 4, dt);
      // Section follower on the sidechained bass line, with hysteresis.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      while (this.waves.length && t - this.waves[0].t > 1.2) this.waves.shift();
      while (this.glints.length && t - this.glints[0].t > 0.6) this.glints.shift();
      if (this.glints.length > 24) this.glints.splice(0, this.glints.length - 24);
    },

    // Paper, fibres and microprint border at device resolution, in one ink
    // (`accent` false) or all in the glint ink on transparent (`accent` true).
    buildCache(p, W, H, pal, accent) {
      const pd = p.pixelDensity();
      const s = (p.width / W) * pd;
      const cv = document.createElement('canvas');
      cv.width = Math.round(p.width * pd);
      cv.height = Math.round(p.height * pd);
      const g = cv.getContext('2d');
      g.setTransform(s, 0, 0, s, 0, 0);
      const L = this.frame(W, H);
      if (!accent) {
        const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
        grd.addColorStop(0, pal.paper);
        grd.addColorStop(1, pal.paper2);
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
        // Security fibres: short curved threads in two colours, sunk in the paper.
        const R = rng(417);
        g.lineWidth = 0.45;
        for (let i = 0; i < Math.round(W * H / 2200); i++) {
          const x = R() * W, y = R() * H, a = R() * TAU, l = 4 + R() * 7, bend = (R() - 0.5) * 5;
          g.strokeStyle = pal.fibre[i % 2];
          g.globalAlpha = 0.35 + R() * 0.3;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + Math.cos(a) * l / 2 - Math.sin(a) * bend, y + Math.sin(a) * l / 2 + Math.cos(a) * bend,
            x + Math.cos(a) * l, y + Math.sin(a) * l);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      const col = accent ? pal.ink2 : pal.ink;
      g.strokeStyle = col;
      g.fillStyle = col;
      // Frame rules: a heavy outer rule, hairlines either side of the microprint.
      g.lineWidth = 1.6;
      g.strokeRect(L.o, L.o, W - 2 * L.o, H - 2 * L.o);
      g.lineWidth = 0.5;
      g.strokeRect(L.o + 3, L.o + 3, W - 2 * (L.o + 3), H - 2 * (L.o + 3));
      g.strokeRect(L.i, L.i, W - 2 * L.i, H - 2 * L.i);
      // Microprint: the tiny sentence repeated along all four sides.
      g.font = '700 4.6px ' + SANS_SERIF;
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      const mid = (L.o + 3 + L.i) / 2;
      const run = (len) => {
        let str = '';
        while (g.measureText(str).width < len) str += MICRO;
        return str;
      };
      const sides = [
        [L.o + 3, mid, 0, W - 2 * (L.o + 3)],
        [W - mid, L.o + 3, Math.PI / 2, H - 2 * (L.o + 3)],
        [W - L.o - 3, H - mid, Math.PI, W - 2 * (L.o + 3)],
        [mid, H - L.o - 3, -Math.PI / 2, H - 2 * (L.o + 3)],
      ];
      for (const [x, y, a, len] of sides) {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.beginPath();
        g.rect(0, -4, len, 8);
        g.clip();
        g.fillText(run(len + 20), 1, 0.3);
        g.restore();
      }
      return cv;
    },

    frame(W, H) {
      const o = 7;
      return { o, i: o + 11 };
    },

    // The intaglio vignette: a turntable seen from above, engraved in hatching,
    // clipped to the portrait window. Drawn with the caller's stroke colour.
    turntable(g, Rw, lw, spinA, ink, paper) {
      // Knockouts are paper, printed over: the window is plain paper already,
      // and erasing to transparency would punch through the whole canvas.
      const knock = (fn) => {
        g.save();
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.fillStyle = paper; g.strokeStyle = paper;
        fn();
        g.restore();
      };
      g.save();
      g.beginPath();
      g.arc(0, 0, Rw, 0, TAU);
      g.clip();
      // Plinth: diagonal hatching, denser (so darker) toward the lower right.
      g.lineWidth = lw * 0.8;
      g.beginPath();
      for (let d = -Rw * 1.5; d < Rw * 1.5; d += 2.6) {
        g.moveTo(d - Rw, -Rw); g.lineTo(d + Rw, Rw);
      }
      g.stroke();
      g.beginPath();
      for (let d = 0; d < Rw * 1.5; d += 2.6) {
        g.moveTo(-Rw, d - Rw * 0.4); g.lineTo(Rw, d - Rw * 0.4 + Rw * 0.5);
      }
      g.stroke();
      const cx = -Rw * 0.1, cy = Rw * 0.06, pr = Rw * 0.74;
      // The platter knocks the plinth hatching out, then is cut in grooves.
      knock(() => { g.beginPath(); g.arc(cx, cy, pr + 1.5, 0, TAU); g.fill(); });
      g.lineWidth = lw * 0.7;
      g.beginPath();
      g.arc(cx, cy, pr, 0, TAU);
      g.stroke();
      // Grooves: concentric rings, with gaps between tracks and a fixed lit
      // sector (the lamp is still; the record turns under it).
      g.lineWidth = lw * 0.55;
      g.beginPath();
      let track = 0;
      for (let r = pr * 0.34; r < pr * 0.95; r += 1.45) {
        track++;
        if (track % 9 === 0) continue;
        g.moveTo(cx + Math.cos(-2.1) * r, cy + Math.sin(-2.1) * r);
        g.arc(cx, cy, r, -2.1, -2.1 + TAU * 0.83);
      }
      g.stroke();
      // Label: a solid disc with its lettering turning at the platter's speed.
      g.save();
      g.translate(cx, cy);
      g.rotate(spinA);
      g.beginPath(); g.arc(0, 0, pr * 0.3, 0, TAU); g.fill();
      knock(() => {
      g.font = '700 4.2px ' + SANS_SERIF;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SIDE A', 0, -pr * 0.15);
      g.fillText('33⅓', 0, pr * 0.16);
      g.fillRect(-pr * 0.2, -0.4, pr * 0.4, 0.8);
      g.beginPath(); g.arc(0, 0, 1.3, 0, TAU); g.fill();
      });
      g.restore();
      // Tonearm from the upper-right pivot down to the outer grooves.
      const px = Rw * 0.66, py = -Rw * 0.52;
      const hx = cx + pr * 0.62, hy = cy + pr * 0.52;
      knock(() => {
        g.lineWidth = lw * 5;
        g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 2, hy - 18, hx, hy); g.stroke();
        g.beginPath(); g.arc(px, py, 9, 0, TAU); g.fill();
      });
      g.lineWidth = lw * 0.8;
      g.beginPath(); g.moveTo(px - 1.6, py); g.quadraticCurveTo(px + 0.4, hy - 18, hx - 1.4, hy); g.stroke();
      g.beginPath(); g.moveTo(px + 1.6, py); g.quadraticCurveTo(px + 3.6, hy - 18, hx + 1.4, hy); g.stroke();
      g.beginPath(); g.arc(px, py, 8, 0, TAU); g.stroke();
      g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
      g.save(); g.translate(hx, hy); g.rotate(0.5);
      g.fillRect(-3.2, -1.6, 6.4, 5.2);
      g.restore();
      g.restore();
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (!this.env) this.init();
      const e = this.env;
      this.listen(signals, dt, t);

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.5, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const pal = PALETTES[Math.round(params.colorPalette)] || PALETTES[0];
      const lw = 0.5 * params.weight;

      // Lathe drift: the bass line pushes it a little, so the lace crawls
      // faster when the low end is busy, without ever lurching.
      const drive = P.turn * (1 + 0.5 * e.bass) * dt;
      for (let i = 0; i < 5; i++) this.phase[i] += drive * 0.9 * (i < 3 ? MAIN[i].rate : SECOND[i - 3].rate) * 4;
      this.psi += drive * 0.35;
      this.flow += drive * 1.1;
      this.platter += P.spin * dt * TAU * 0.25;
      this.medal = ease(this.medal, this.medalTarget, 14, dt);
      this.loupeT += dt;

      // Caches: rebuilt only when the stage, density, palette or font changes.
      const fontOk = window.VIZ_FONTS ? VIZ_FONTS.has('Libre Baskerville') : true;
      const key = p.width + 'x' + p.height + '@' + p.pixelDensity() + ':' + pal.name + ':' + fontOk;
      if (this.cacheKey !== key) {
        this.cacheKey = key;
        this.paperCv = this.buildCache(p, W, H, pal, false);
        this.glintCv = this.buildCache(p, W, H, pal, true);
      }

      p.colorMode(p.RGB, 255);
      p.background(pal.paper);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      // Bevel joins and butt caps: round ones on tens of thousands of short
      // segments were most of the raster cost.
      g.lineCap = 'butt';
      g.lineJoin = 'bevel';
      g.drawImage(this.paperCv, 0, 0, W, H);

      const L = this.frame(W, H);
      const ix = L.i + 0.5, iy = L.i + 0.5, iw = W - 2 * ix, ih = H - 2 * iy;

      // ---- Everything inside the border, under the loupe.
      g.save();
      g.beginPath();
      g.rect(ix, iy, iw, ih);
      g.clip();
      const zoom = params.loupe;
      if (zoom > 1.001) {
        // The loupe wanders a slow Lissajous over the lace, so a zoomed note
        // is a journey across the engraving rather than a fixed crop.
        const R0 = Math.min(W, H) * 0.38;
        const reach = R0 * 0.75 * (1 - 1 / zoom);
        const lx = Math.sin(this.loupeT * 0.041) * reach, ly = Math.sin(this.loupeT * 0.029 + 1) * reach * 0.8;
        g.translate(W / 2, H / 2);
        g.scale(zoom, zoom);
        g.translate(-W / 2 - lx, -H / 2 - ly);
      }

      const R = Math.min(W, H) * 0.38;
      const cx = W / 2, cy = H / 2;
      const wide = W > 900;
      const mR = Math.min(96, (W / 2 - R - 36) * 0.9);
      const mx = R + 18 + mR;   // medallion centres, from the middle

      // Lathe-work net: two sets of sine lines in counter-phase, flowing
      // sideways, which interlace into a chain across the whole note.
      g.strokeStyle = pal.ink;
      g.lineWidth = lw * 0.75;
      g.globalAlpha = 0.34;
      const sp = 9, step = 5;
      for (let set = 0; set < 2; set++) {
        g.beginPath();
        const sgn = set ? -1 : 1;
        for (let y0 = iy - sp; y0 < iy + ih + sp; y0 += sp) {
          const lp = y0 * 0.021;
          for (let x = ix; x <= ix + iw + step; x += step) {
            const y = y0 + sgn * 5.2 * Math.sin(x * 0.034 + this.flow * sgn + lp) +
              2.2 * Math.sin(x * 0.011 - this.flow * 0.6 + lp * 2);
            if (x === ix) g.moveTo(x, y); else g.lineTo(x, y);
          }
        }
        g.stroke();
      }
      g.globalAlpha = 1;

      // Paper reserves: the rosettes and medallions sit on clean paper, with a
      // soft edge so the net fades into them rather than being cut.
      const reserve = (x, y, r) => {
        const grd = g.createRadialGradient(x, y, r * 0.86, x, y, r * 1.06);
        grd.addColorStop(0, pal.paper);
        grd.addColorStop(1, pal.paper + '00');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r * 1.06, 0, TAU); g.fill();
      };
      reserve(cx, cy, R);
      const medals = [];
      if (wide && mR > 50) {
        medals.push([cx - mx, cy], [cx + mx, cy]);
        for (const [x, y] of medals) reserve(x, y, mR);
      }

      // Kick ripples, as (front radius, push) pairs in rosette units.
      const rip = this.rip || (this.rip = []);
      rip.length = 0;
      for (const w of this.waves) {
        const age = t - w.t;
        if (age < 0) continue;
        const front = R * 0.36 + age * R * 1.1;
        if (front > R * 1.05) continue;
        rip.push(front, w.amp * 8 * (1 - 0.6 * age));
      }

      // ---- The main rosette, first ink.
      g.save();
      g.translate(cx, cy);
      g.strokeStyle = pal.ink;
      // Guide rules: the outer edge and the portrait window, double-ruled.
      g.lineWidth = lw * 1.2;
      g.beginPath(); g.arc(0, 0, R * 1.0, 0, TAU); g.stroke();
      g.lineWidth = lw * 0.6;
      g.beginPath(); g.arc(0, 0, R * 0.985, 0, TAU); g.stroke();
      const swellA = 1 + P.swell * (e.bass * 1.1 - 0.15);
      MAIN[0].amp = 0.8 + 0.4 * (swellA - 1) + 0.2;
      MAIN[1].amp = Math.max(0.2, swellA);
      MAIN[2].amp = 1 + 0.3 * (swellA - 1);
      g.lineWidth = lw;
      for (let bi = 0; bi < 3; bi++) {
        g.beginPath();
        band(g, MAIN[bi], R, this.phase[bi], this.psi * (bi + 1), false, rip);
        g.stroke();
      }
      if (P.lace > 0.01) {
        g.globalAlpha = P.lace;
        for (let bi = 0; bi < 3; bi++) {
          g.beginPath();
          band(g, MAIN[bi], R, this.phase[bi], this.psi * (bi + 1), true, rip);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      // Portrait window: paper disc, bead ring, double rule.
      const Rw = R * 0.36;
      g.fillStyle = pal.paper;
      g.beginPath(); g.arc(0, 0, Rw + 6, 0, TAU); g.fill();
      g.lineWidth = lw * 1.4;
      g.beginPath(); g.arc(0, 0, Rw + 5.5, 0, TAU); g.stroke();
      g.lineWidth = lw * 0.7;
      g.beginPath(); g.arc(0, 0, Rw + 1.5, 0, TAU); g.stroke();
      g.fillStyle = pal.ink;
      g.beginPath();
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU + this.phase[2] * 0.02;
        g.moveTo(Math.cos(a) * (Rw + 3.5) + 0.7, Math.sin(a) * (Rw + 3.5));
        g.arc(Math.cos(a) * (Rw + 3.5), Math.sin(a) * (Rw + 3.5), 0.7, 0, TAU);
      }
      g.fill();

      // ---- The second ink, in register, overprinted.
      const plateCol = mix(pal.ink, pal.ink2, clamp(P.ink2 * 1.3, 0, 1));
      if (P.ink2 > 0.01) {
        g.save();
        g.globalCompositeOperation = pal.blend;
        g.globalAlpha = P.ink2;
        g.strokeStyle = pal.ink2;
        g.lineWidth = lw * 0.95;
        for (let bi = 0; bi < 2; bi++) {
          const B = SECOND[bi];
          B.amp = 1 + 0.5 * (swellA - 1);
          g.beginPath();
          band(g, B, R, this.phase[3 + bi], -this.psi * (bi + 2), false, rip);
          g.stroke();
        }
        g.restore();
      }
      if (P.plate > 0.01) {
        g.save();
        g.globalAlpha = P.plate;
        if (P.ink2 > 0.5) g.globalCompositeOperation = pal.blend;
        g.strokeStyle = plateCol;
        g.fillStyle = plateCol;
        this.turntable(g, Rw, lw * 1.1, this.platter, plateCol, pal.paper);
        g.restore();
      }
      g.restore();

      // ---- Side medallions: small rosettes on a division plate, the
      // denomination on a paper boss in the middle.
      for (let mi = 0; mi < medals.length; mi++) {
        const [x, y] = medals[mi];
        g.save();
        g.translate(x, y);
        g.rotate((mi ? -1 : 1) * this.medal + this.phase[0] * 0.05);
        g.strokeStyle = pal.ink;
        g.lineWidth = lw * 1.1;
        g.beginPath(); g.arc(0, 0, mR, 0, TAU); g.stroke();
        MEDAL.amp = 1 + 0.3 * (swellA - 1);
        g.lineWidth = lw * 0.9;
        g.beginPath();
        band(g, MEDAL, mR, this.phase[1] * 0.5, this.psi, false, []);
        g.stroke();
        if (P.ink2 > 0.01) {
          g.save();
          g.globalCompositeOperation = pal.blend;
          g.globalAlpha = P.ink2;
          g.strokeStyle = pal.ink2;
          g.beginPath();
          band(g, MEDAL, mR * 0.72, -this.phase[1] * 0.5, -this.psi, true, []);
          g.stroke();
          g.restore();
        }
        // The division plate: twelve ticks, one of them the index mark.
        g.fillStyle = pal.ink;
        for (let d = 0; d < MEDAL_DIV; d++) {
          const a = (d / MEDAL_DIV) * TAU;
          g.save(); g.rotate(a);
          if (d === 0) { g.beginPath(); g.moveTo(mR + 1, 0); g.lineTo(mR + 7, -3); g.lineTo(mR + 7, 3); g.fill(); }
          else g.fillRect(mR + 1, -0.5, 4, 1);
          g.restore();
        }
        g.restore();
        g.save();
        g.translate(x, y);
        g.fillStyle = pal.paper;
        g.beginPath(); g.arc(0, 0, mR * 0.42, 0, TAU); g.fill();
        g.strokeStyle = pal.ink; g.lineWidth = lw;
        g.beginPath(); g.arc(0, 0, mR * 0.42, 0, TAU); g.stroke();
        g.beginPath(); g.arc(0, 0, mR * 0.39, 0, TAU); g.stroke();
        g.fillStyle = pal.ink;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 ' + (mR * 0.3).toFixed(1) + 'px ' + SANS_SERIF;
        g.fillText('33⅓', 0, 1);
        g.restore();
      }

      // ---- Lettering: engraved caps top and bottom, serials in the corners.
      g.fillStyle = pal.ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const topY = cy - R - (cy - R - iy) / 2 - 1, botY = cy + R + (iy + ih - cy - R) / 2 + 1;
      const cap = Math.min(15, (cy - R - iy) * 0.52);
      g.font = '700 ' + cap.toFixed(1) + 'px ' + SANS_SERIF;
      if ('letterSpacing' in g) g.letterSpacing = (cap * 0.32).toFixed(1) + 'px';
      g.fillText('THE LOW FREQUENCY RESERVE', cx, topY);
      g.font = '400 ' + (cap * 0.62).toFixed(1) + 'px ' + SANS_SERIF;
      if ('letterSpacing' in g) g.letterSpacing = (cap * 0.24).toFixed(1) + 'px';
      g.fillText('PAYABLE TO THE BEARER ON THE DOWNBEAT', cx, botY);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      // Serial: the kick counts. The new number is struck in with a little
      // extra ink that settles, rather than blinking.
      const age = t - this.stampT;
      const fresh = clamp(1 - age / 0.25, 0, 1);
      const num = 'Nº LF ' + String(this.serial).padStart(6, '0');
      g.fillStyle = pal.serial;
      const sz = Math.min(15, cap * 1.02);
      g.font = '700 ' + sz.toFixed(1) + 'px "Oswald", "Arial Narrow", sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = (sz * 0.12).toFixed(1) + 'px';
      const sPos = [[ix + 14, topY, 'left'], [ix + iw - 14, botY, 'right']];
      for (const [x, y, al] of sPos) {
        g.textAlign = al;
        g.save();
        g.translate(x, y);
        const sq = 1 + 0.12 * fresh;
        g.scale(sq, 1 / (1 + 0.04 * fresh));
        g.fillText(num, 0, 0);
        g.restore();
      }
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.restore();   // loupe + inner clip

      // ---- Hat glints along the microprint, in the second-ink copy.
      if (this.glints.length) {
        const bw = L.i - L.o;
        for (const q of this.glints) {
          const age2 = t - q.t;
          const a = clamp(1 - age2 / 0.55, 0, 1) * q.amp;
          if (a <= 0) continue;
          const len = 46;
          const along = q.pos + q.dir * age2 * 0.12;
          let rx, ry, rw, rh;
          if (q.edge === 0 || q.edge === 2) {
            rx = L.o + along * (W - 2 * L.o - len); rw = len; rh = bw + 1;
            ry = q.edge === 0 ? L.o : H - L.i - 1;
          } else {
            ry = L.o + along * (H - 2 * L.o - len); rh = len; rw = bw + 1;
            rx = q.edge === 3 ? L.o : W - L.i - 1;
          }
          g.save();
          g.globalAlpha = a;
          g.beginPath(); g.rect(rx, ry, rw, rh); g.clip();
          g.drawImage(this.glintCv, 0, 0, W, H);
          g.restore();
        }
      }
      g.restore();
    },
  });
})();
