// Quick Change: one continuous dance, redrawn in a different drawing style on
// every beat (LEXSAN's style-swap dancer, docs/research/2026-09-28-lexsan-
// takeaways.md scene 3). LEXSAN strung together preselected art; here the art
// is live code over a body MediaPipe tracked, so any dance (the film, a video
// the performer drops in, the room through the camera) can be redrawn in
// every style, and the swap lands exactly on the kick.
//
// The dancer is Little Tich, the music-hall eccentric, in his Big-Boot Dance
// (1900); a "quick change" is the music-hall act of changing costume in a
// flash, which is what the dance does here on every beat.
//
// The styles, each a different way of reading the same 33 landmarks and mask:
//   Stick figure   bones as one bold line, the way a child would
//   Ink brush      one tapered sumi stroke per limb, dry-brush hairs, a seal
//   Halftone       the person mask screened into two misregistered riso inks
//   Low poly       limbs as faceted prisms lit from the upper left
//   Cut paper      Matisse capsules in three papers, lifted on a shadow
//   Blueprint      hairlines, joint circles and live joint angles in degrees
//   Wire           one continuous Calder wire through every joint
//   Triadic        Oskar Schlemmer's Bauhaus costume: disc, cone, spheres
//
// Music:
//   kick   the style changes (every beat, every 2 beats or every bar)
//   snare  the style's ink flips to its second colour
//   hats   cartoon speed lines flick off the fastest hand or foot
//   bass   the line weight and the style's card swell
//   drop   with Follow the track: every beat, and the chorus comes in: two
//          more dancers either side, a beat and two beats behind (a canon),
//          each still wearing a style it has just taken off
// Movement: the camera follows the dancer across the set, lazily, with a
// slow drift of its own.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;

  const PRESETS = {
    calm: { every: 2, chorus: 0, speed: 0.9, drift: 0.4, weight: 1 },
    drop: { every: 0, chorus: 1, speed: 1.05, drift: 0.8, weight: 1.25 },
  };
  const DRIVE = ['chorus', 'speed', 'drift', 'weight'];

  // Paper grounds. Each style brings its own two inks and its own card.
  const GROUNDS = [
    { name: 'Cream paper', paper: '#EFE7D6', grain: 0.07, shade: 'rgba(60,40,20,0.13)', dark: false },
    { name: 'Night stage', paper: '#1D1B22', grain: 0.05, shade: 'rgba(0,0,0,0.35)', dark: true },
  ];

  // ------------------------------------------------------------ geometry
  function pts(K, pose, T, out) {
    const L = pose.lm;
    for (let j = 0; j < 33; j++) { out[j * 2] = T.ox + L[j * 3] * T.s; out[j * 2 + 1] = T.oy + L[j * 3 + 1] * T.s; }
    return out;
  }
  const X = (J, j) => J[j * 2], Y = (J, j) => J[j * 2 + 1];
  const mid = (J, a, b) => [(J[a * 2] + J[b * 2]) / 2, (J[a * 2 + 1] + J[b * 2 + 1]) / 2];
  function head(J, H) {
    const nx = X(J, 0), ny = Y(J, 0);
    const ex = (X(J, 7) + X(J, 8)) / 2, ey = (Y(J, 7) + Y(J, 8)) / 2;
    return { x: (nx + ex * 2) / 3, y: (ny + ey * 2) / 3 - H * 0.01, r: H * 0.072 };
  }
  function chainPts(J, chain) { return chain.map((j) => [X(J, j), Y(J, j)]); }
  function bodyChains(J) {
    const sh = mid(J, 11, 12), hp = mid(J, 23, 24);
    return {
      spine: [sh, hp],
      arms: [chainPts(J, [11, 13, 15, 19]), chainPts(J, [12, 14, 16, 20])],
      legs: [chainPts(J, [23, 25, 27, 31]), chainPts(J, [24, 26, 28, 32])],
      sh, hp,
    };
  }
  function polyline(g, P) { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); }
  // Deterministic per-index noise, so a style's hand-made wobble holds still.
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // A tapered stroke along a polyline, as one filled outline.
  function taper(g, P, w0, w1, bulge) {
    const n = P.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const u = i / (n - 1), w = lerp(w0, w1, u) * (1 + (bulge || 0) * Math.sin(u * Math.PI));
      L.push([P[i][0] - dy * w, P[i][1] + dx * w]); R.push([P[i][0] + dy * w, P[i][1] - dx * w]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    const e = P[n - 1];
    g.arc(e[0], e[1], w1, Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]), Math.atan2(R[n - 1][1] - e[1], R[n - 1][0] - e[0]), true);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    g.fill();
  }

  // ------------------------------------------------------------ the styles
  // Each: card(g, J, H, S) draws its ground behind the figure; fig(g, J, H, S)
  // draws the figure. S = { ink, alt, w (weight), t, K, mask, T, seed }.
  const STYLES = [
    {
      name: 'Stick figure', inks: ['#1A1714', '#C8372D'], nightInks: ['#F2EDE2', '#F0B54A'],
      card(g, J, H, S) {},
      fig(g, J, H, S) {
        const c = bodyChains(J), h = head(J, H);
        g.strokeStyle = S.ink; g.lineWidth = H * 0.028 * S.w; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        polyline(g, [c.sh, c.hp]);
        polyline(g, [[X(J, 11), Y(J, 11)], [X(J, 12), Y(J, 12)]]);
        for (const a of c.arms) polyline(g, a.slice(0, 3));
        for (const l of c.legs) polyline(g, [l[0], l[1], l[2], l[3]]);
        polyline(g, [c.hp, [X(J, 23), Y(J, 23)]]); polyline(g, [c.hp, [X(J, 24), Y(J, 24)]]);
        g.stroke();
        g.beginPath(); g.moveTo(c.sh[0], c.sh[1]); g.lineTo(h.x, h.y + h.r); g.stroke();
        g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.stroke();
      },
    },
    {
      name: 'Ink brush', inks: ['#141210', '#B3261E'], nightInks: ['#EDE6D8', '#E0533F'],
      card(g, J, H, S) {
        // An ensō behind the dancer, never quite closed.
        const c = mid(J, 23, 24), r = H * 0.56 * (0.96 + 0.08 * S.bass);
        g.strokeStyle = S.night ? 'rgba(240,230,215,0.10)' : 'rgba(30,26,22,0.10)';
        g.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          g.lineWidth = H * (0.06 - k * 0.015);
          g.beginPath(); g.arc(c[0] + k * H * 0.004, c[1] - H * 0.08, r - k * H * 0.01, -1.2 + k * 0.05, -1.2 + TAU * 0.9 - k * 0.1); g.stroke();
        }
      },
      fig(g, J, H, S) {
        const c = bodyChains(J), h = head(J, H), w = H * S.w;
        g.fillStyle = S.ink;
        taper(g, [c.sh, [lerp(c.sh[0], c.hp[0], 0.5) + w * 0.01, lerp(c.sh[1], c.hp[1], 0.5)], c.hp], w * 0.045, w * 0.03, 0.3);
        for (const a of c.arms) taper(g, a, w * 0.024, w * 0.007, 0.25);
        for (const l of c.legs) taper(g, l, w * 0.034, w * 0.012, 0.2);
        taper(g, [[X(J, 11), Y(J, 11)], c.sh, [X(J, 12), Y(J, 12)]], w * 0.02, w * 0.02, 0.2);
        // The head: one round stroke of the brush, open at the top.
        g.strokeStyle = S.ink; g.lineCap = 'round'; g.lineWidth = w * 0.022;
        g.beginPath(); g.arc(h.x, h.y, h.r, -1.1, TAU - 1.6); g.stroke();
        // Dry-brush hairs: fine streaks of paper through the strokes.
        g.strokeStyle = S.paper; g.lineWidth = w * 0.0035; g.globalAlpha = 0.55;
        g.beginPath();
        for (const l of [c.legs[0], c.legs[1], c.arms[0], c.arms[1]]) {
          for (let k = 0; k < 3; k++) {
            const o = (hash(k * 7 + l.length) - 0.5) * w * 0.03;
            const a = l[0], b = l[2];
            const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
            const t0 = 0.3 + 0.2 * hash(k * 3.1), t1 = 0.95;
            g.moveTo(a[0] + dx * t0 - dy / d * o, a[1] + dy * t0 + dx / d * o);
            g.lineTo(a[0] + dx * t1 - dy / d * o, a[1] + dy * t1 + dx / d * o);
          }
        }
        g.stroke(); g.globalAlpha = 1;
        // The seal.
        const sx = c.hp[0] + H * 0.34, sy = c.hp[1] + H * 0.3, ss = H * 0.05;
        g.fillStyle = S.alt; g.fillRect(sx, sy, ss, ss * 1.25);
        g.fillStyle = S.paper; g.fillRect(sx + ss * 0.25, sy + ss * 0.2, ss * 0.18, ss * 0.85); g.fillRect(sx + ss * 0.55, sy + ss * 0.2, ss * 0.18, ss * 0.5);
      },
    },
    {
      name: 'Halftone', inks: ['#2F4FA0', '#E0453A'], nightInks: ['#8FB2FF', '#FF7A59'],
      card(g, J, H, S) {},
      fig(g, J, H, S) {
        // The person mask screened on a fixed stage grid: the dots swell as
        // the body passes under them, like a halftone of a moving photograph.
        const K = S.K, T = S.T, M = S.mask, MW = K.MW, MH = K.MH;
        const step = H * 0.036;
        const c = mid(J, 23, 24);
        const x0 = Math.floor((c[0] - H * 0.75) / step) * step, x1 = c[0] + H * 0.75;
        const y0 = Math.floor((c[1] - H * 0.9) / step) * step, y1 = c[1] + H * 0.65;
        const sample = (x, y) => {
          const mx = ((x - T.ox) / T.s) * MH - 0.5, my = ((y - T.oy) / T.s) * MH - 0.5;
          const ix = Math.floor(mx), iy = Math.floor(my);
          if (ix < 0 || iy < 0 || ix >= MW - 1 || iy >= MH - 1) return 0;
          const fx = mx - ix, fy = my - iy, o = iy * MW + ix;
          return (M[o] * (1 - fx) * (1 - fy) + M[o + 1] * fx * (1 - fy) + M[o + MW] * (1 - fx) * fy + M[o + MW + 1] * fx * fy) / 255;
        };
        const pass = (ink, dx, dy, gain) => {
          g.fillStyle = ink; g.beginPath();
          for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
            const v = sample(x - dx, y - dy);
            if (v < 0.04) continue;
            const r = step * 0.5 * Math.sqrt(v) * gain;
            g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
          }
          g.fill();
        };
        g.globalCompositeOperation = S.night ? 'screen' : 'multiply';
        pass(S.alt, step * 0.18, step * 0.12, 0.7 * S.w);
        pass(S.ink, 0, 0, 0.9 * S.w);
        g.globalCompositeOperation = 'source-over';
      },
    },
    {
      name: 'Low poly', inks: ['#2E6E6A', '#D98C2B'], nightInks: ['#5FB3A8', '#F2A93B'],
      card(g, J, H, S) {
        const c = mid(J, 23, 24);
        g.fillStyle = S.night ? 'rgba(95,179,168,0.10)' : 'rgba(46,110,106,0.10)';
        g.beginPath(); g.moveTo(c[0] - H * 0.55, c[1] + H * 0.5); g.lineTo(c[0] + H * 0.1, c[1] - H * 0.75 - S.bass * H * 0.05); g.lineTo(c[0] + H * 0.6, c[1] + H * 0.42); g.closePath(); g.fill();
      },
      fig(g, J, H, S) {
        // Each bone a two-faced prism; the face towards the light is lit.
        const base = S.ink;
        const shade = (col, k) => {
          const n = parseInt(col.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
          const f = 0.55 + 0.6 * k;
          return 'rgb(' + clamp(Math.round(r * f), 0, 255) + ',' + clamp(Math.round(gg * f), 0, 255) + ',' + clamp(Math.round(b * f), 0, 255) + ')';
        };
        const bone = (a, b, wa, wb) => {
          const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
          const lit = 0.5 + 0.5 * (nx * -0.6 + ny * -0.8);
          g.fillStyle = shade(base, lit);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + nx * wa, a[1] + ny * wa); g.lineTo(b[0] + nx * wb, b[1] + ny * wb); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
          g.fillStyle = shade(base, 1 - lit);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] - nx * wa, a[1] - ny * wa); g.lineTo(b[0] - nx * wb, b[1] - ny * wb); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
        };
        const P = (j) => [X(J, j), Y(J, j)], w = H * S.w;
        // Torso: four facets round its centre.
        const q = [P(11), P(12), P(24), P(23)], c = [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
        for (let i = 0; i < 4; i++) {
          const a = q[i], b = q[(i + 1) % 4];
          const k = 0.35 + 0.5 * hash(i + 3) + (i === 0 ? 0.2 : 0);
          g.fillStyle = shade(base, k);
          g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
        }
        for (const ch of [[23, 25, 27, 31], [24, 26, 28, 32]]) for (let i = 0; i < 3; i++) bone(P(ch[i]), P(ch[i + 1]), w * (0.04 - i * 0.01), w * (0.03 - i * 0.008));
        for (const ch of [[11, 13, 15, 19], [12, 14, 16, 20]]) for (let i = 0; i < 3; i++) bone(P(ch[i]), P(ch[i + 1]), w * (0.026 - i * 0.007), w * (0.02 - i * 0.006));
        // Head: a hexagon split into lit and shaded triangles; the accent ink.
        const h = head(J, H);
        for (let i = 0; i < 6; i++) {
          const a0 = i / 6 * TAU + 0.3, a1 = (i + 1) / 6 * TAU + 0.3;
          g.fillStyle = shade(S.alt, 0.45 + 0.5 * (0.5 + 0.5 * Math.cos((a0 + a1) / 2 + 2.2)));
          g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(h.x + Math.cos(a0) * h.r, h.y + Math.sin(a0) * h.r); g.lineTo(h.x + Math.cos(a1) * h.r, h.y + Math.sin(a1) * h.r); g.closePath(); g.fill();
        }
      },
    },
    {
      name: 'Cut paper', inks: ['#2B4DB3', '#F2C230'], nightInks: ['#4F72E0', '#F2C230'],
      card(g, J, H, S) {
        // A torn patch of pink paper, its edge fixed for this change.
        const c = mid(J, 23, 24), n = 18, r = H * 0.42 * (1 + 0.06 * S.bass);
        g.fillStyle = S.night ? '#6E3048' : '#F0A7A0';
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU, rr = r * (0.82 + 0.3 * hash(i + S.seed * 31));
          const x = c[0] + Math.cos(a) * rr * 0.85, y = c[1] - H * 0.1 + Math.sin(a) * rr;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath(); g.fill();
      },
      fig(g, J, H, S) {
        const w = H * S.w, P = (j) => [X(J, j), Y(J, j)];
        const cap = (a, b, r) => { g.lineWidth = r * 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
        const draw = (dx, dy, cols) => {
          g.lineCap = 'round'; g.lineJoin = 'round';
          const off = (q) => [q[0] + dx, q[1] + dy];
          // legs, then torso, then arms, then head: paper laid in order
          g.strokeStyle = cols[0];
          for (const ch of [[23, 25, 27], [24, 26, 28]]) { cap(off(P(ch[0])), off(P(ch[1])), w * 0.034); cap(off(P(ch[1])), off(P(ch[2])), w * 0.03); }
          g.strokeStyle = cols[3]; for (const ch of [[27, 31], [28, 32]]) cap(off(P(ch[0])), off(P(ch[1])), w * 0.024);
          g.fillStyle = cols[1];
          g.beginPath(); for (const [i, j] of [[0, 11], [1, 12], [2, 24], [3, 23]]) { const q = off(P(j)); const e = (i < 2 ? -1 : 1) * w * 0.012; if (i) g.lineTo(q[0], q[1] + e); else g.moveTo(q[0], q[1] + e); } g.closePath(); g.fill();
          g.strokeStyle = cols[1]; g.lineWidth = w * 0.03; g.stroke();
          g.strokeStyle = cols[2];
          for (const ch of [[11, 13, 15], [12, 14, 16]]) { cap(off(P(ch[0])), off(P(ch[1])), w * 0.02); cap(off(P(ch[1])), off(P(ch[2])), w * 0.017); }
          const h = head(J, H); g.fillStyle = cols[2]; g.beginPath(); g.arc(h.x + dx, h.y + dy, h.r * 1.05, 0, TAU); g.fill();
        };
        const sh = S.night ? 'rgba(0,0,0,0.45)' : 'rgba(60,40,30,0.22)';
        draw(H * 0.018, H * 0.024, [sh, sh, sh, sh]);
        draw(0, 0, [S.ink, S.alt, S.night ? '#EDE6D8' : '#1E1B18', S.alt]);
      },
    },
    {
      name: 'Blueprint', inks: ['#F4F1EA', '#F2C230'], nightInks: ['#F4F1EA', '#F2C230'],
      card(g, J, H, S) {
        const c = mid(J, 23, 24), w = H * 0.8, h = H * 1.14, x = c[0] - w / 2, y = c[1] - h * 0.6;
        g.fillStyle = '#1F3F7A'; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(244,241,234,0.14)'; g.lineWidth = H * 0.0018;
        g.beginPath();
        const st = H * 0.065;
        for (let gx = x + st; gx < x + w; gx += st) { g.moveTo(gx, y); g.lineTo(gx, y + h); }
        for (let gy = y + st; gy < y + h; gy += st) { g.moveTo(x, gy); g.lineTo(x + w, gy); }
        g.stroke();
        g.strokeStyle = 'rgba(244,241,234,0.5)'; g.lineWidth = H * 0.003; g.strokeRect(x + H * 0.02, y + H * 0.02, w - H * 0.04, h - H * 0.04);
      },
      fig(g, J, H, S) {
        const P = (j) => [X(J, j), Y(J, j)], c = bodyChains(J), h = head(J, H);
        g.strokeStyle = S.ink; g.lineWidth = H * 0.004 * S.w; g.lineCap = 'round';
        g.beginPath();
        polyline(g, [c.sh, c.hp]); polyline(g, [P(11), P(12)]); polyline(g, [P(23), P(24)]);
        for (const a of c.arms) polyline(g, a); for (const l of c.legs) polyline(g, l);
        g.stroke();
        g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.moveTo(h.x - h.r * 1.4, h.y); g.lineTo(h.x + h.r * 1.4, h.y); g.moveTo(h.x, h.y - h.r * 1.4); g.lineTo(h.x, h.y + h.r * 1.4); g.stroke();
        g.fillStyle = '#1F3F7A';
        for (const j of [11, 12, 13, 14, 23, 24, 25, 26, 15, 16, 27, 28]) { g.beginPath(); g.arc(X(J, j), Y(J, j), H * 0.011, 0, TAU); g.fill(); g.stroke(); }
        // Live joint angles at the elbows and knees, the data showing through.
        g.strokeStyle = S.alt; g.fillStyle = S.alt; g.lineWidth = H * 0.003;
        g.font = Math.round(H * 0.03) + 'px ui-monospace, Menlo, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
        for (const [a, b, cc] of [[11, 13, 15], [12, 14, 16], [23, 25, 27], [24, 26, 28]]) {
          const a1 = Math.atan2(Y(J, a) - Y(J, b), X(J, a) - X(J, b)), a2 = Math.atan2(Y(J, cc) - Y(J, b), X(J, cc) - X(J, b));
          let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const r = H * 0.045;
          g.beginPath(); g.arc(X(J, b), Y(J, b), r, a1, a1 + d, d < 0); g.stroke();
          const m = a1 + d / 2;
          g.fillText(Math.round(Math.abs(d) * 180 / Math.PI) + '°', X(J, b) + Math.cos(m) * r * 1.5 - H * 0.015, Y(J, b) + Math.sin(m) * r * 1.5);
        }
      },
    },
    {
      name: 'Wire', inks: ['#1A1714', '#B3261E'], nightInks: ['#E8E2D4', '#E0533F'],
      card(g, J, H, S) {},
      fig(g, J, H, S) {
        // One wire through every joint, bent with a small loop at each, in
        // the order a sculptor would bend it: foot, leg, hip, arm, head,
        // arm, hip, leg, foot.
        const order = [31, 27, 25, 23, 11, 13, 15, 13, 11, -1, 12, 14, 16, 14, 12, 24, 26, 28, 32];
        const h = head(J, H);
        const P = order.map((j) => (j < 0 ? [h.x, h.y + h.r] : [X(J, j), Y(J, j)]));
        const path = (dx, dy) => {
          g.beginPath(); g.moveTo(P[0][0] + dx, P[0][1] + dy);
          for (let i = 0; i < P.length - 1; i++) {
            const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
            g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6 + dx, p1[1] + (p2[1] - p0[1]) / 6 + dy, p2[0] - (p3[0] - p1[0]) / 6 + dx, p2[1] - (p3[1] - p1[1]) / 6 + dy, p2[0] + dx, p2[1] + dy);
          }
          g.moveTo(h.x + h.r + dx, h.y + dy); g.arc(h.x + dx, h.y + dy, h.r, 0, TAU);
          for (const j of [13, 14, 25, 26]) { g.moveTo(X(J, j) + H * 0.014 + dx, Y(J, j) + dy); g.arc(X(J, j) + dx, Y(J, j) + dy, H * 0.014, 0, TAU); }
          g.stroke();
        };
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = S.night ? 'rgba(0,0,0,0.5)' : 'rgba(40,30,20,0.16)'; g.lineWidth = H * 0.008 * S.w;
        path(H * 0.05, H * 0.035);
        g.strokeStyle = S.ink; g.lineWidth = H * 0.008 * S.w;
        path(0, 0);
        g.fillStyle = S.alt; g.beginPath(); g.arc(h.x - h.r * 0.3, h.y - h.r * 0.1, h.r * 0.16, 0, TAU); g.fill();
      },
    },
    {
      name: 'Triadic', inks: ['#1C1A1A', '#D23A2A'], nightInks: ['#EDE6D8', '#E0533F'],
      card(g, J, H, S) {
        const c = mid(J, 23, 24);
        g.fillStyle = S.night ? 'rgba(242,194,48,0.14)' : 'rgba(242,194,48,0.35)';
        g.beginPath(); g.arc(c[0] + H * 0.18, c[1] - H * 0.42, H * 0.33 * (1 + 0.06 * S.bass), 0, TAU); g.fill();
      },
      fig(g, J, H, S) {
        // After Schlemmer's Triadic Ballet: a padded torso, a hooped cone
        // for a skirt, rods and balls for limbs, a masked disc head.
        const P = (j) => [X(J, j), Y(J, j)], w = H * S.w, c = bodyChains(J), h = head(J, H);
        const yellow = '#F2C230', blue = '#2B4DB3';
        g.lineCap = 'round';
        g.strokeStyle = S.ink;
        for (const ch of [[23, 25, 27, 31], [24, 26, 28, 32]]) { g.lineWidth = w * 0.03; g.beginPath(); polyline(g, ch.map(P)); g.stroke(); }
        // the cone skirt from the waist
        const hx = c.hp[0], hy = c.hp[1], sx = X(J, 24) - X(J, 23), sy = Y(J, 24) - Y(J, 23), sl = Math.hypot(sx, sy) || 1;
        const ux = sx / sl, uy = sy / sl, R = w * 0.19;
        g.fillStyle = S.alt;
        g.beginPath(); g.moveTo(hx - ux * w * 0.04 - uy * w * 0.08, hy - uy * w * 0.04 + ux * w * 0.08); g.lineTo(hx + ux * w * 0.04 - uy * w * 0.08, hy + uy * w * 0.04 + ux * w * 0.08);
        g.lineTo(hx + ux * R - uy * -w * 0.1, hy + uy * R + ux * -w * 0.1); g.lineTo(hx - ux * R - uy * -w * 0.1, hy - uy * R + ux * -w * 0.1); g.closePath(); g.fill();
        g.strokeStyle = S.paper; g.lineWidth = w * 0.006;
        for (let k = 1; k < 3; k++) { const t = k / 3, rr = lerp(w * 0.04, R, t), oy = lerp(-w * 0.08, w * 0.1, t); g.beginPath(); g.moveTo(hx - ux * rr + uy * oy, hy - uy * rr - ux * oy); g.lineTo(hx + ux * rr + uy * oy, hy + uy * rr - ux * oy); g.stroke(); }
        // the torso
        g.fillStyle = blue; g.beginPath(); for (const [i, j] of [[0, 11], [1, 12], [2, 24], [3, 23]]) { const q = P(j); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); } g.closePath(); g.fill();
        // arms: rods with balls
        g.strokeStyle = S.ink; g.lineWidth = w * 0.012;
        for (const ch of [[11, 13, 15], [12, 14, 16]]) { g.beginPath(); polyline(g, ch.map(P)); g.stroke(); }
        g.fillStyle = yellow;
        for (const j of [11, 12, 15, 16]) { g.beginPath(); g.arc(X(J, j), Y(J, j), w * (j < 13 ? 0.03 : 0.022), 0, TAU); g.fill(); }
        // the head: a white disc with a black half mask
        g.fillStyle = S.night ? '#EDE6D8' : '#FFFFFF'; g.beginPath(); g.arc(h.x, h.y, h.r * 1.1, 0, TAU); g.fill();
        g.fillStyle = S.night ? '#1C1A1A' : S.ink; g.beginPath(); g.arc(h.x, h.y, h.r * 1.1, -Math.PI / 2, Math.PI / 2); g.fill();
        g.strokeStyle = S.night ? '#EDE6D8' : S.ink; g.lineWidth = w * 0.006; g.beginPath(); g.arc(h.x, h.y, h.r * 1.1, 0, TAU); g.stroke();
      },
    },
  ];

  // Style sequence: a fixed shuffle, never the same style twice running.
  const SEQ = [0, 1, 2, 3, 4, 5, 6, 7, 2, 4, 0, 6, 3, 1, 7, 5];

  let K = null;
  function boot(p) {
    // In the app index.html loads pose/kit.js before the scenes; the render
    // harness loads only this file, so fetch the kit here and hold p5's
    // preload under the harness until the baked track is in.
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_POSE ? Promise.resolve(window.VIZ_POSE) : new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = 'pose/kit.js';
      s.onload = () => ok(window.VIZ_POSE); s.onerror = () => no(new Error('pose/kit.js did not load'));
      document.head.appendChild(s);
    });
    kit.then((k) => { K = k; return hold ? k.load() : null; })
      .catch((e) => console.error('quick change: pose kit failed', e))
      .then(() => { if (hold) p._decrementPreload(); });
  }

  let grain = null;
  function grainPattern(g) {
    if (grain) return grain;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), img = x.createImageData(256, 256);
    let s = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = (s >> 16) & 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    grain = g.createPattern(c, 'repeat');
    return grain;
  }

  VIZ.register({
    id: 'pose1',
    name: 'Quick Change',
    order: 1121,

    params: [
      { key: 'every', label: 'Change style every', type: 'select', options: ['Beat', '2 beats', 'Bar'], default: PRESETS.calm.every },
      { key: 'chorus', label: 'Chorus (canon dancers)', type: 'range', min: 0, max: 1, default: PRESETS.calm.chorus, step: 0.01 },
      { key: 'speed', label: 'Dance speed', type: 'range', min: 0.5, max: 1.5, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'drift', label: 'Camera drift', type: 'range', min: 0, max: 1, default: PRESETS.calm.drift, step: 0.01 },
      { key: 'weight', label: 'Line weight', type: 'range', min: 0.5, max: 2, default: PRESETS.calm.weight, step: 0.01 },
      { key: 'ground', label: 'Ground', type: 'select', options: GROUNDS.map((q) => q.name), default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    get actions() { return window.VIZ_POSE ? window.VIZ_POSE.actions : []; },

    gallery: {
      title: 'Quick Change',
      technique: 'MediaPipe tasks-vision 1.0.1 (PoseLandmarker, 33 BlazePose landmarks plus its person segmentation mask), baked offline from a public-domain film with pose_landmarker_heavy and replayed from the track, or run live in the page with pose_landmarker_lite on the film, a dropped video or the camera; eight Canvas 2D renderers of the same skeleton and mask (bold line, tapered brush outlines, a two-ink halftone screen of the mask, lit prism facets, cut-paper capsules on offset shadows, hairlines with live joint angles, a Catmull-Rom wire, a Schlemmer costume)',
      brief: 'One continuous dance, Little Tich\'s Big-Boot Dance of 1900, redrawn in a different drawing style on the beat: a stick figure, a sumi ink brush, a riso halftone, low-poly prisms, Matisse cut paper, a blueprint with the joint angles ticking over in degrees, a single Calder wire, a Bauhaus Triadic costume. The kick is the quick change; the snare flips the style\'s ink; hats flick cartoon speed lines off the fastest hand or foot; the bass swells the line and the card behind him. On the drop the changes come on every beat and a chorus joins him in canon, one and two beats behind, each still wearing the style it has just taken off. The camera follows him lazily across the set.',
      lineage: [
        'LEXSAN\'s style-swap dancer (docs/research/2026-09-28-lexsan-takeaways.md, scene 3), which Raph called super cool and not in our wheelhouse because it strings preselected art together. Here the art is code over MediaPipe\'s tracked body, so any dance can be redrawn in every style.',
        'The music-hall quick change; Little Tich (Harry Relph), filmed by Clément Maurice for the Phono-Cinéma-Théâtre, Paris 1900 (public domain, web/assets/pose/CREDITS.md).',
      ],
    },

    preload(p) { boot(p); },
    setup() {},

    enter() {
      if (window.VIZ_POSE) { K = window.VIZ_POSE; K.enter(); K.fromUrl(); }
      this.ear = window.VIZ_POSE ? window.VIZ_POSE.ear() : null;
      this.lastMs = null;
      this.cam = {};
      this.styleIx = 0;       // index into SEQ
      this.history = [0, 0, 0];
      this.chorusStyle = [0, 0, 0];
      this.pending = [];
      this.flip = 0;
      this.beatCount = 0;
      this.driftT = 0;
      this.pz = null;
    },
    leave() { if (K) K.leave(); },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]);
      const ground = GROUNDS[clamp(Math.round(params.ground), 0, GROUNDS.length - 1)];
      g.fillStyle = ground.paper; g.fillRect(0, 0, ctx.width, ctx.height);
      if (!K || !K.ready) { g.restore(); return; }
      if (!this.ear) this.enter(p, ctx);

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      const e = this.ear;
      const hits = e.listen(signals, dt, Math.round(params.follow) === 1);
      const P = e.drive(params, PRESETS.drop, DRIVE);
      const react = params.react;
      const every = [1, 2, 4][Math.round(e.auto > 0.5 ? Math.min(params.every, PRESETS.drop.every) : params.every)];

      K.tick(dt, P.speed);
      this.clock = this.clock || 0;
      if (hits.kick && react > 0.05) {
        this.beatCount++;
        if (this.beatCount % every === 0) {
          this.history.unshift(SEQ[this.styleIx % SEQ.length]); this.history.length = 3;
          this.styleIx++;
          // The chorus takes up the change a moment later, one dancer after
          // the other, so it ripples down the line instead of the whole
          // stage changing on the kick.
          for (let k = 1; k <= 2; k++) this.pending.push({ at: this.clock + 0.2 * k, k, style: this.history[k - 1] });
        }
      }
      if (hits.snare && react > 0.05) this.flip = 1 - this.flip;
      this.clock = (this.clock || 0) + dt;
      this.pending = this.pending.filter((q) => { if (q.at <= this.clock) { this.chorusStyle[q.k] = q.style; return false; } return true; });

      // ---- camera
      this.driftT += dt * (0.3 + 0.5 * e.pad);
      this.pz = K.pose(0, this.pz);
      const fill = 0.74 - 0.12 * P.chorus;
      const T = K.frame(this.cam, this.pz, ctx, dt, fill, 1.6, 0.5);
      const dr = P.drift * ctx.height;
      T.ox += Math.sin(this.driftT * 0.37) * dr * 0.06;
      T.oy += Math.sin(this.driftT * 0.23 + 1) * dr * 0.025;
      const H = this.cam.h * T.s;

      // ---- paper grain and the floor shadow
      g.globalAlpha = ground.grain; g.globalCompositeOperation = ground.dark ? 'screen' : 'multiply';
      g.fillStyle = grainPattern(g); g.fillRect(0, 0, ctx.width, ctx.height);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

      const J = pts(K, this.pz, T, this.J || (this.J = new Float32Array(66)));
      const mask = K.mask(0, this.maskBuf);
      this.maskBuf = mask;

      const S = (styleId, jSet, Ht) => {
        const st = STYLES[styleId];
        const inks = ground.dark ? st.nightInks : st.inks;
        return { ink: this.flip ? inks[1] : inks[0], alt: this.flip ? inks[0] : inks[1], paper: ground.paper, night: ground.dark,
          w: P.weight * (1 + 0.18 * e.bass * react), bass: e.bass * react, K, T, mask, seed: this.styleIx };
      };
      const floorY = Math.max(Y(J, 29), Y(J, 30), Y(J, 31), Y(J, 32)) + H * 0.01;
      const shadow = (cx, y, w, a) => {
        g.fillStyle = ground.shade; g.globalAlpha = a;
        g.beginPath(); g.ellipse(cx, y, w, w * 0.12, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
      };

      // ---- the chorus: two canon dancers, one and two beats behind, in
      // the styles just taken off
      if (P.chorus > 0.02) {
        const beat = 0.5 * P.speed;
        for (let k = 2; k >= 1; k--) {
          const side = k === 1 ? -1 : 1;
          const pk = K.pose(beat * k);
          const Jk = new Float32Array(66);
          const sc = 0.8 - 0.06 * k;
          const cx = ctx.width / 2 + side * ctx.width * (0.25 + 0.03 * k) * P.chorus;
          const b = K.body(pk), bm = K.body(this.pz);
          const Tk = { s: T.s * sc, ox: 0, oy: 0 };
          Tk.ox = cx - b.cx * Tk.s;
          Tk.oy = (T.oy + bm.cy * T.s - H * 0.06) - b.cy * Tk.s;
          pts(K, pk, Tk, Jk);
          const Hk = H * sc;
          const fy = Math.max(Y(Jk, 29), Y(Jk, 30), Y(Jk, 31), Y(Jk, 32)) + Hk * 0.01;
          g.globalAlpha = 1;
          shadow(b.cx * Tk.s + Tk.ox, fy, Hk * 0.22, P.chorus);
          const sid = this.chorusStyle[k];
          g.globalAlpha = clamp(P.chorus * 1.4, 0, 1);
          const Sk = S(sid, Jk, Hk);
          Sk.T = Tk; Sk.mask = K.mask(beat * k, this['mk' + k]); this['mk' + k] = Sk.mask;
          // Only the blueprint needs its ground to be seen at all.
          if (sid === 5) STYLES[sid].card(g, Jk, Hk, Sk);
          STYLES[sid].fig(g, Jk, Hk, Sk);
          g.globalAlpha = 1;
        }
      }

      // ---- the dancer
      const sid = SEQ[this.styleIx % SEQ.length];
      const st = STYLES[sid], s = S(sid, J, H);
      shadow(mid(J, 23, 24)[0], floorY, H * 0.24, 1);
      st.card(g, J, H, s);
      st.fig(g, J, H, s);

      // ---- hats: speed lines off the fastest hand or foot
      if (e.hat > 0.05 && react > 0.05) {
        this.pv = K.pose(0.07, this.pv);
        const Jv = pts(K, this.pv, T, this.Jv || (this.Jv = new Float32Array(66)));
        let best = -1, bv = 0;
        for (const j of [15, 16, 31, 32]) { const v = Math.hypot(X(J, j) - X(Jv, j), Y(J, j) - Y(Jv, j)); if (v > bv) { bv = v; best = j; } }
        if (best >= 0 && bv > H * 0.02) {
          const dx = X(J, best) - X(Jv, best), dy = Y(J, best) - Y(Jv, best), d = Math.hypot(dx, dy);
          const ux = dx / d, uy = dy / d;
          g.strokeStyle = s.ink; g.lineCap = 'round'; g.lineWidth = H * 0.006; g.globalAlpha = clamp(e.hat * react, 0, 1);
          g.beginPath();
          for (let k = -1; k <= 1; k++) {
            const ox = -uy * k * H * 0.028, oy = ux * k * H * 0.028, l = H * (0.07 + 0.03 * (1 - Math.abs(k)));
            g.moveTo(X(J, best) - ux * H * 0.05 + ox, Y(J, best) - uy * H * 0.05 + oy);
            g.lineTo(X(J, best) - ux * (H * 0.05 + l) + ox, Y(J, best) - uy * (H * 0.05 + l) + oy);
          }
          g.stroke(); g.globalAlpha = 1;
        }
      }

      // ---- the style's name, small, like a caption on a music-hall card
      g.fillStyle = s.ink; g.globalAlpha = 0.55;
      g.font = Math.round(ctx.height * 0.026) + 'px Georgia, "Times New Roman", serif';
      g.textAlign = 'left'; g.textBaseline = 'bottom';
      g.fillText(st.name.toUpperCase().split('').join(' '), ctx.height * 0.04, ctx.height * 0.96);
      g.globalAlpha = 1;
      g.restore();
    },
  });
})();
