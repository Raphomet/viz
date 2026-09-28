// Plate — a natural-history colour plate that is alive.
//
// A chromolithograph in the spirit of the great nineteenth-century plates of
// sea life: aged cream paper with foxing and a pressed plate-mark, a double
// ruled border, a plate number and a Latin caption, and specimens drawn in a
// fine sepia line with flat printed tints (rose, ochre, slate, sage) laid a
// hair out of register. A large centrepiece (a medusa seen from above, or a
// radiolarian) sits in a ring of six satellites; pale medusae and
// siphonophores swim behind them and plankton specks drift through the water.
//
// Craft notes:
// - Everything is Canvas 2D line and flat fill: no gradients on the
//   organisms, no glow, no additive blending. The tint plates are drawn with
//   a small constant offset from the line plate (misregistration), which is
//   most of what makes it read as print rather than vector art.
// - Static engraving detail (lattice pores, diatom striae) is built once as a
//   Path2D at unit radius and drawn scaled, with the line width divided back,
//   so the plate can carry a few thousand pores cheaply.
// - Music is found as onsets against slow baselines (the Aurora/Paper
//   listener) and each kind of event goes to one place: the kick contracts
//   the centrepiece (a swim stroke, the only thing a kick moves); a clap steps
//   the ring of satellites round by one place, with a cooldown so the plate
//   turns in visible steps instead of spinning; hats flick plankton specks
//   into rose ink; the bass lengthens tentacles, arms and spines. The drop
//   prints a second ring of small specimens into the corners, sends more
//   swimmers across, and inks the tints to full strength; the breakdown lets
//   them fade back towards an uncoloured engraving.

(function () {
  'use strict';

  const TAU = Math.PI * 2;

  // Each palette is one paper and one set of litho stones. `dark` papers
  // (the cyanotype) print light line on a dark ground.
  const PALETTES = [
    { name: 'Chromolithograph', paper: '#ede1c3', edge: '#c9ad7c', fox: '#9c6a36', line: '#35251a', text: '#3d2b1f',
      rose: '#c47a68', ochre: '#c7963f', slate: '#5f7c96', sage: '#86975f', rust: '#a4513a' },
    { name: 'Two inks', paper: '#efe8d6', edge: '#cfc1a2', fox: '#8f7450', line: '#1f3350', text: '#1f3350',
      rose: '#bd563a', ochre: '#c9774f', slate: '#bd563a', sage: '#c9774f', rust: '#a8452c' },
    { name: 'Cyanotype', paper: '#1e4468', edge: '#0f2742', fox: '#0b1c30', line: '#e8eeea', text: '#dfe9ea',
      rose: '#a9c6da', ochre: '#d4e2e6', slate: '#7ea7c6', sage: '#b3cfd3', rust: '#dfe9ee' },
  ];
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const PAL = PALETTES.map((src) => {
    const o = { name: src.name };
    for (const k in src) if (k !== 'name') o[k] = hex(src[k]);
    return o;
  });
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function smoother(t) { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function rng(seed) {
    let a = (seed * 2654435761 + 1013904223) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(i, j) {
    let h = (i * 374761393 + j * 668265263) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function roman(n) {
    const v = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [k, r] of v) while (n >= k) { s += r; n -= k; }
    return s;
  }

  // ---------------------------------------------------------------------------
  // Printing helpers. `st` carries the palette, the tint and line strengths
  // for this specimen (print-in fades both), and the misregistration offset
  // already rotated into the specimen's local frame.

  function tint(g, path, c, a, st) {
    if (a * st.tint <= 0.003) return;
    g.save();
    g.translate(st.reg[0], st.reg[1]);
    g.fillStyle = rgba(c, a * st.tint);
    g.fill(path);
    g.restore();
  }
  function paperFill(g, path, st, a) {
    g.fillStyle = rgba(st.pal.paper, (a === undefined ? 0.92 : a) * st.line);
    g.fill(path);
  }
  function ink(g, path, w, a, st) {
    g.lineWidth = w;
    g.strokeStyle = rgba(st.pal.line, a * st.line);
    g.stroke(path);
  }
  // Cached unit paths are built at radius 100 and drawn scaled by k.
  function inkK(g, path, k, w, a, st) {
    g.save();
    g.scale(k, k);
    g.lineWidth = w / k;
    g.strokeStyle = rgba(st.pal.line, a * st.line);
    g.stroke(path);
    g.restore();
  }
  function fillK(g, path, k, style) {
    g.save();
    g.scale(k, k);
    g.fillStyle = style;
    g.fill(path);
    g.restore();
  }
  function tintK(g, path, k, c, a, st) {
    if (a * st.tint <= 0.003) return;
    g.save();
    g.translate(st.reg[0], st.reg[1]);
    g.scale(k, k);
    g.fillStyle = rgba(c, a * st.tint);
    g.fill(path);
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Specimen designs. make*(r) returns a design; draw*(g, d, st) draws it at
  // the origin with radius st.R. st.c is the kick contraction (0-1), st.bass
  // the swell, st.t time.

  // Spherical lattice radiolarian: a shell of pores foreshortened towards the
  // rim, an inner shell seen through it, and barbed radial spines.
  function makeLattice(r) {
    const K = 6 + Math.floor(r() * 3);
    const n = [8, 10, 12, 16, 20][Math.floor(r() * 5)];
    const pores = new Path2D();
    for (let j = 0; j < K; j++) {
      const th = ((j + 0.5) / K) * (Math.PI / 2);
      const rho = 100 * Math.sin(th), f = Math.cos(th);
      const s = (100 * Math.PI / 2) / K;
      const count = Math.max(1, Math.round((TAU * rho) / s));
      const a = s * 0.33, b = s * 0.33 * Math.max(0.28, f);
      for (let i = 0; i < count; i++) {
        const ang = ((i + 0.5 * (j % 2)) / count) * TAU;
        const x = rho * Math.cos(ang), y = rho * Math.sin(ang);
        pores.moveTo(x + b * Math.cos(ang), y + b * Math.sin(ang));
        pores.ellipse(x, y, b, a, ang, 0, TAU);
      }
    }
    return {
      kind: 'lattice', pores, n,
      len: 0.45 + r() * 0.6, barbs: r() < 0.7, shells: r() < 0.5 ? 2 : 1,
      twist: r() * TAU, shell: r() < 0.5 ? 'slate' : 'ochre', core: r() < 0.5 ? 'rose' : 'rust',
      spine: r() < 0.5 ? 'ochre' : 'sage',
    };
  }
  function drawLattice(g, d, st) {
    const R = st.R * (1 - 0.16 * st.c);
    const k = R / 100;
    const n = d.n;
    // Spines behind the shell.
    const sp = new Path2D(), barbs = new Path2D();
    const len = R * (d.len * (0.8 + 0.4 * st.bass) + 0.3 * st.c);
    const w = R * 0.055;
    const R0 = d.shells === 2 ? R * 1.26 : R;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + d.twist;
      const ca = Math.cos(a), sa = Math.sin(a);
      const tip = R0 + len;
      sp.moveTo(ca * R * 0.9 - sa * w, sa * R * 0.9 + ca * w);
      sp.lineTo(ca * (R0 + len * 0.15) - sa * w * 0.7, sa * (R0 + len * 0.15) + ca * w * 0.7);
      sp.lineTo(ca * tip, sa * tip);
      sp.lineTo(ca * (R0 + len * 0.15) + sa * w * 0.7, sa * (R0 + len * 0.15) - ca * w * 0.7);
      sp.lineTo(ca * R * 0.9 + sa * w, sa * R * 0.9 - ca * w);
      sp.closePath();
      if (d.barbs) {
        for (const u of [0.45, 0.72]) {
          const m = R0 + len * u, bw = w * (1.9 - u * 1.4), back = len * 0.09;
          barbs.moveTo(ca * m, sa * m);
          barbs.lineTo(ca * (m - back) - sa * bw, sa * (m - back) + ca * bw);
          barbs.moveTo(ca * m, sa * m);
          barbs.lineTo(ca * (m - back) + sa * bw, sa * (m - back) - ca * bw);
        }
      }
    }
    tint(g, sp, st.pal[d.spine], 0.7, st);
    ink(g, sp, 0.8, 0.85, st);
    ink(g, barbs, 0.7, 0.75, st);
    // Outer lattice shell of radial beams.
    if (d.shells === 2) {
      const outer = new Path2D();
      outer.arc(0, 0, R0, 0, TAU);
      const beams = new Path2D();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * TAU + d.twist + Math.PI / (n * 2);
        beams.moveTo(Math.cos(a) * R, Math.sin(a) * R);
        beams.lineTo(Math.cos(a) * R0, Math.sin(a) * R0);
      }
      ink(g, outer, 0.7, 0.6, st);
      ink(g, beams, 0.6, 0.55, st);
    }
    const body = new Path2D();
    body.arc(0, 0, R, 0, TAU);
    paperFill(g, body, st);
    tint(g, body, st.pal[d.shell], 0.55 + 0.35 * st.c, st);
    const core = new Path2D();
    core.arc(0, 0, R * 0.45, 0, TAU);
    tint(g, core, st.pal[d.core], 0.45, st);
    fillK(g, d.pores, k, rgba(st.pal.paper, 0.62 * st.line));
    inkK(g, d.pores, k, 0.5, 0.7, st);
    ink(g, core, 0.6, 0.35, st);
    ink(g, body, 1.1, 1, st);
  }

  // Acantharian: blade spines crossing a central capsule, with side
  // apophyses and a scalloped membrane between them.
  function makeAcanth(r) {
    return {
      kind: 'acanth', n: [10, 12, 16, 20][Math.floor(r() * 4)], len: 0.85 + r() * 0.3,
      twist: r() * TAU, blade: r() < 0.5 ? 'ochre' : 'sage', mem: r() < 0.6 ? 'slate' : 'rose',
      cap: r() < 0.5 ? 'rose' : 'rust', memR: 0.5 + r() * 0.2, leaf: r() < 0.6,
    };
  }
  function drawAcanth(g, d, st) {
    const R = st.R;
    const n = d.n;
    const memR = R * d.memR * (1 - 0.25 * st.c);
    const mem = new Path2D();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU + d.twist;
      const x = Math.cos(a) * memR, y = Math.sin(a) * memR;
      if (i === 0) mem.moveTo(x, y);
      else {
        const am = a - Math.PI / n;
        mem.quadraticCurveTo(Math.cos(am) * memR * 0.72, Math.sin(am) * memR * 0.72, x, y);
      }
    }
    mem.closePath();
    paperFill(g, mem, st, 0.6);
    tint(g, mem, st.pal[d.mem], 0.35 + 0.45 * st.c, st);
    ink(g, mem, 0.6, 0.55, st);
    const blades = new Path2D(), ribs = new Path2D();
    const len = R * (d.len * (0.85 + 0.35 * st.bass) + 0.25 * st.c);
    const w = R * 0.05;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + d.twist;
      const ca = Math.cos(a), sa = Math.sin(a);
      blades.moveTo(ca * R * 0.08, sa * R * 0.08);
      blades.lineTo(ca * len * 0.45 - sa * w, sa * len * 0.45 + ca * w);
      blades.lineTo(ca * len, sa * len);
      blades.lineTo(ca * len * 0.45 + sa * w, sa * len * 0.45 - ca * w);
      blades.closePath();
      ribs.moveTo(ca * R * 0.1, sa * R * 0.1);
      ribs.lineTo(ca * len * 0.97, sa * len * 0.97);
      // Apophyses: little forked leaves across the blade.
      const m = len * 0.5, lw = R * (d.leaf ? 0.1 : 0.06);
      ribs.moveTo(ca * m - sa * lw, sa * m + ca * lw);
      ribs.quadraticCurveTo(ca * (m + lw * 0.8), sa * (m + lw * 0.8), ca * m + sa * lw, sa * m - ca * lw);
    }
    tint(g, blades, st.pal[d.blade], 0.7, st);
    ink(g, blades, 0.8, 0.9, st);
    ink(g, ribs, 0.55, 0.6, st);
    const cap = new Path2D();
    cap.arc(0, 0, R * 0.2 * (1 - 0.15 * st.c), 0, TAU);
    paperFill(g, cap, st);
    tint(g, cap, st.pal[d.cap], 0.65, st);
    ink(g, cap, 0.9, 0.9, st);
  }

  // Centric diatom: rim, radial ribs, rows of puncta, a rosette centre.
  function makeDisc(r) {
    const n = [24, 32, 40][Math.floor(r() * 3)];
    const inner = 0.28 + r() * 0.12;
    const lines = new Path2D(), dots = new Path2D();
    lines.arc(0, 0, 100, 0, TAU);
    lines.moveTo(94, 0); lines.arc(0, 0, 94, 0, TAU);
    lines.moveTo(inner * 100, 0); lines.arc(0, 0, inner * 100, 0, TAU);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      lines.moveTo(Math.cos(a) * inner * 100, Math.sin(a) * inner * 100);
      lines.lineTo(Math.cos(a) * 94, Math.sin(a) * 94);
      const am = a + Math.PI / n;
      for (let rr = inner * 100 + 7; rr < 90; rr += 8) {
        const x = Math.cos(am) * rr, y = Math.sin(am) * rr, s = 1.2 + rr * 0.012;
        dots.moveTo(x + s, y); dots.arc(x, y, s, 0, TAU);
      }
    }
    const petals = 6 + Math.floor(r() * 4);
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU;
      const x = Math.cos(a) * inner * 55, y = Math.sin(a) * inner * 55;
      lines.moveTo(x + inner * 35, y); lines.arc(x, y, inner * 35, 0, TAU);
    }
    return { kind: 'disc', lines, dots, twist: r() * TAU, body: r() < 0.6 ? 'ochre' : 'sage' };
  }
  function drawDisc(g, d, st) {
    const R = st.R * (1 - 0.1 * st.c), k = R / 100;
    const body = new Path2D();
    body.arc(0, 0, R, 0, TAU);
    paperFill(g, body, st);
    tint(g, body, st.pal[d.body], 0.5, st);
    g.save();
    g.rotate(d.twist);
    tintK(g, d.dots, k, st.pal.rust, 0.6, st);
    inkK(g, d.lines, k, 0.55, 0.8, st);
    fillK(g, d.dots, k, rgba(st.pal.line, 0.5 * st.line));
    g.restore();
    ink(g, body, 1.1, 1, st);
  }

  // Triceratium-like: a polygon with concave sides, knobbed corners and a
  // honeycomb of areolae.
  function makeTri(r) {
    const sides = [3, 3, 4, 5][Math.floor(r() * 4)];
    const out = new Path2D();
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU - Math.PI / 2;
      pts.push([Math.cos(a) * 100, Math.sin(a) * 100]);
    }
    for (let i = 0; i < sides; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % sides];
      if (i === 0) out.moveTo(p0[0], p0[1]);
      const mx = (p0[0] + p1[0]) * 0.5 * 0.8, my = (p0[1] + p1[1]) * 0.5 * 0.8;
      out.quadraticCurveTo(mx, my, p1[0], p1[1]);
    }
    out.closePath();
    const cells = new Path2D();
    const s = 11;
    for (let row = -10; row <= 10; row++) {
      for (let col = -10; col <= 10; col++) {
        const x = col * s + (row % 2 ? s / 2 : 0), y = row * s * 0.866;
        if (x * x + y * y > 98 * 98) continue;
        const rr = 3.6 - Math.hypot(x, y) * 0.012;
        cells.moveTo(x + rr, y);
        for (let q = 1; q <= 6; q++) {
          const a = (q / 6) * TAU;
          cells.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
      }
    }
    const knobs = new Path2D();
    for (const p0 of pts) { knobs.moveTo(p0[0] * 0.92 + 9, p0[1] * 0.92); knobs.arc(p0[0] * 0.92, p0[1] * 0.92, 9, 0, TAU); }
    return { kind: 'tri', out, cells, knobs, twist: r() * TAU, body: r() < 0.5 ? 'ochre' : 'slate' };
  }
  function drawTri(g, d, st) {
    const R = st.R * (1 - 0.1 * st.c), k = R / 100;
    g.save();
    g.rotate(d.twist);
    fillK(g, d.out, k, rgba(st.pal.paper, 0.92 * st.line));
    tintK(g, d.out, k, st.pal[d.body], 0.55, st);
    if (R < 32) {
      // Too small for areolae to read: they print as a grey smudge, so a
      // small one gets an inner outline instead.
      g.save();
      g.scale(0.62, 0.62);
      inkK(g, d.out, k, 0.5, 0.6, st);
      g.restore();
    } else {
    g.save();
    g.scale(k, k);
    g.clip(d.out);
    g.fillStyle = rgba(st.pal.paper, 0.55 * st.line);
    g.fill(d.cells);
    g.lineWidth = 0.45 / k;
    g.strokeStyle = rgba(st.pal.line, 0.65 * st.line);
    g.stroke(d.cells);
    g.restore();
    }
    tintK(g, d.knobs, k, st.pal.rose, 0.6, st);
    inkK(g, d.knobs, k, 0.7, 0.9, st);
    inkK(g, d.out, k, 1.1, 1, st);
    g.restore();
  }

  // Pennate diatom: a lens with a central raphe and transverse striae.
  function makeNavi(r) {
    const wd = 0.26 + r() * 0.14;
    const out = new Path2D();
    out.moveTo(-100, 0);
    out.quadraticCurveTo(0, -wd * 200, 100, 0);
    out.quadraticCurveTo(0, wd * 200, -100, 0);
    out.closePath();
    const st = new Path2D();
    for (let i = -13; i <= 13; i++) {
      const x = i * 7;
      const hgt = wd * 100 * (1 - (x / 100) * (x / 100)) * 0.92;
      st.moveTo(x, -hgt); st.lineTo(x * 0.96, -7);
      st.moveTo(x, hgt); st.lineTo(x * 0.96, 7);
    }
    st.moveTo(-92, 0); st.lineTo(-8, 0); st.moveTo(8, 0); st.lineTo(92, 0);
    st.moveTo(6, 0); st.ellipse(0, 0, 6, 9, 0, 0, TAU);
    return { kind: 'navi', out, lines: st, twist: r() * TAU, body: r() < 0.5 ? 'sage' : 'ochre' };
  }
  function drawNavi(g, d, st) {
    const R = st.R * (1 - 0.1 * st.c), k = R / 100;
    g.save();
    g.rotate(d.twist);
    fillK(g, d.out, k, rgba(st.pal.paper, 0.92 * st.line));
    tintK(g, d.out, k, st.pal[d.body], 0.6, st);
    inkK(g, d.lines, k, 0.5, 0.75, st);
    inkK(g, d.out, k, 1.1, 1, st);
    g.restore();
  }

  // Medusa from above: a scalloped bell, coronal muscle rings, branched
  // radial canals, horseshoe gonads, frilled oral arms and a fringe of
  // tentacles. The kick contracts it.
  function makeMedusa(r) {
    const m = [4, 4, 6, 8][Math.floor(r() * 4)];
    return {
      kind: 'medusa', m, canals: m * 4, lappets: m * 4, tent: m * 20,
      twist: r() * TAU, bell: r() < 0.6 ? 'slate' : 'sage', gon: r() < 0.6 ? 'rose' : 'rust', arm: 'ochre',
    };
  }
  function drawMedusa(g, d, st) {
    const t = st.t, c = st.c;
    const R = st.R * (1 - 0.2 * c);
    const m = d.m;
    g.save();
    g.rotate(d.twist);
    // Tentacle fringe, under the bell. On the stroke the fringe trails back.
    const tent = new Path2D();
    const L = d.tent;
    for (let i = 0; i < L; i++) {
      const a = (i / L) * TAU;
      const h = hash(i, 7);
      const len = R * (0.16 + 0.22 * st.bass + 0.06 * h) * (1 + 0.6 * c);
      const bend = 0.35 * Math.sin(t * 1.1 + a * 3 + h * 4) + 1.2 * c * Math.sin(a * m * 0.5 + 1.3);
      const x0 = Math.cos(a) * R * 0.99, y0 = Math.sin(a) * R * 0.99;
      const x2 = Math.cos(a + bend * 0.25) * (R + len), y2 = Math.sin(a + bend * 0.25) * (R + len);
      const cx = Math.cos(a - bend * 0.12) * (R + len * 0.55), cy = Math.sin(a - bend * 0.12) * (R + len * 0.55);
      tent.moveTo(x0, y0);
      tent.quadraticCurveTo(cx, cy, x2, y2);
    }
    ink(g, tent, 0.5, 0.55, st);
    // Bell outline with lappets.
    const bell = new Path2D();
    const N = d.lappets * 6;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const f = (i % 6) / 6;
      const rr = R * (1 + 0.035 * Math.sin(Math.PI * f));
      if (i === 0) bell.moveTo(rr * Math.cos(a), rr * Math.sin(a));
      else bell.lineTo(rr * Math.cos(a), rr * Math.sin(a));
    }
    bell.closePath();
    paperFill(g, bell, st);
    tint(g, bell, st.pal[d.bell], 0.42 + 0.4 * c, st);
    // Coronal muscle rings.
    const rings = new Path2D();
    for (let rr = 0.64; rr < 0.9; rr += 0.034) { rings.moveTo(R * rr, 0); rings.arc(0, 0, R * rr, 0, TAU); }
    ink(g, rings, 0.45 + 0.5 * c, 0.28 + 0.5 * c, st);
    // Radial canals, every other one forked.
    const can = new Path2D();
    const C = d.canals;
    for (let i = 0; i < C; i++) {
      const a = (i / C) * TAU + Math.PI / C;
      can.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28);
      const fk = R * 0.68;
      can.lineTo(Math.cos(a) * fk, Math.sin(a) * fk);
      if (i % 2) {
        const da = (TAU / C) * 0.28;
        can.lineTo(Math.cos(a - da) * R * 0.92, Math.sin(a - da) * R * 0.92);
        can.moveTo(Math.cos(a) * fk, Math.sin(a) * fk);
        can.lineTo(Math.cos(a + da) * R * 0.92, Math.sin(a + da) * R * 0.92);
      } else {
        can.lineTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92);
      }
    }
    can.moveTo(R * 0.92, 0); can.arc(0, 0, R * 0.92, 0, TAU);
    ink(g, can, 0.6, 0.6, st);
    // Rhopalia: small knobs in the margin notches.
    const rho = new Path2D();
    for (let i = 0; i < m * 2; i++) {
      const a = (i / (m * 2)) * TAU;
      const x = Math.cos(a) * R * 0.97, y = Math.sin(a) * R * 0.97;
      rho.moveTo(x + R * 0.018, y); rho.arc(x, y, R * 0.018, 0, TAU);
    }
    tint(g, rho, st.pal.rust, 0.9, st);
    ink(g, rho, 0.5, 0.8, st);
    // Gonads: horseshoes between the arms, stippled.
    const gon = new Path2D(), stip = new Path2D();
    for (let i = 0; i < m; i++) {
      const a = ((i + 0.5) / m) * TAU;
      const gx = Math.cos(a) * R * 0.36, gy = Math.sin(a) * R * 0.36;
      const ro = R * (m > 4 ? 0.14 : 0.19), ri = ro * 0.55;
      gon.moveTo(gx + Math.cos(a + 2.3) * ro, gy + Math.sin(a + 2.3) * ro);
      gon.arc(gx, gy, ro, a + 2.3, a - 2.3 + TAU, false);
      gon.arc(gx + Math.cos(a) * ro * 0.1, gy + Math.sin(a) * ro * 0.1, ri, a - 2.3 + TAU, a + 2.3, true);
      gon.closePath();
      for (let q = 0; q < 12; q++) {
        const b = a + 2.3 + ((TAU - 4.6) * (q + 0.5)) / 12;
        const rr = (ro + ri) * 0.5;
        const x = gx + Math.cos(b) * rr, y = gy + Math.sin(b) * rr;
        stip.moveTo(x + 1, y); stip.arc(x, y, 1, 0, TAU);
      }
    }
    tint(g, gon, st.pal[d.gon], 0.75, st);
    ink(g, gon, 0.8, 0.9, st);
    g.fillStyle = rgba(st.pal.line, 0.55 * st.line);
    g.fill(stip);
    // Oral arms: frilled ribbons curling out from the mouth.
    const arms = new Path2D();
    const armLen = R * (0.5 + 0.3 * st.bass);
    for (let i = 0; i < m; i++) {
      const a0 = (i / m) * TAU;
      const curl = 0.5 * Math.sin(t * 0.45 + i * 1.7);
      const left = [], right = [];
      const S = 18;
      for (let s = 0; s <= S; s++) {
        const u = s / S;
        const a = a0 + curl * u * u;
        const rr = R * 0.07 + armLen * u;
        const wv = R * 0.055 * (1 - 0.6 * u) * (1 + 0.45 * Math.sin(u * 34 + t * 1.5 + i));
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        const nx = -Math.sin(a), ny = Math.cos(a);
        left.push([px + nx * wv, py + ny * wv]);
        right.push([px - nx * wv, py - ny * wv]);
      }
      arms.moveTo(left[0][0], left[0][1]);
      for (const q of left) arms.lineTo(q[0], q[1]);
      for (let s = right.length - 1; s >= 0; s--) arms.lineTo(right[s][0], right[s][1]);
      arms.closePath();
    }
    paperFill(g, arms, st, 0.5);
    tint(g, arms, st.pal[d.arm], 0.7, st);
    ink(g, arms, 0.6, 0.8, st);
    // Mouth.
    const mouth = new Path2D();
    for (let i = 0; i < m; i++) {
      const a = (i / m) * TAU;
      mouth.moveTo(0, 0);
      mouth.lineTo(Math.cos(a) * R * 0.08, Math.sin(a) * R * 0.08);
    }
    ink(g, mouth, 0.9, 0.9, st);
    ink(g, bell, 1.1, 1, st);
    g.restore();
  }

  // Medusa in profile, swimming: a scalloped dome with meridians, frilled
  // oral arms and long trailing tentacles. Its own stroke cycle moves it.
  function drawSwimmer(g, s, st) {
    const t = st.t, c = st.c;
    const w = st.R * (1 - 0.2 * c), h = st.R * 1.05 * (1 + 0.12 * c);
    // Tentacles trail behind (down in local frame).
    const tent = new Path2D();
    const nt = 14;
    for (let i = 0; i < nt; i++) {
      const x0 = -w * 0.95 + (2 * w * 0.95 * i) / (nt - 1);
      const L = h * (2.2 + 1.2 * hash(i, s.seed)) * (0.8 + 0.4 * st.bass);
      tent.moveTo(x0, 0);
      let x = x0, y = 0;
      for (let q = 1; q <= 6; q++) {
        const u = q / 6;
        const nx = x0 * (1 - 0.35 * u) + Math.sin(t * 1.3 - u * 5 + i * 0.7) * w * 0.18 * u;
        const ny = L * u;
        tent.quadraticCurveTo(x, (y + ny) * 0.5, (x + nx) * 0.5, (y + ny) * 0.5);
        x = nx; y = ny;
      }
    }
    ink(g, tent, 0.45, 0.5, st);
    // Oral arms.
    const arms = new Path2D();
    for (let i = 0; i < 4; i++) {
      const xo = (i - 1.5) * w * 0.14;
      const L = h * (1.6 + 0.5 * (i % 2)) * (0.85 + 0.3 * st.bass);
      const left = [], right = [];
      for (let q = 0; q <= 14; q++) {
        const u = q / 14;
        const cx = xo + Math.sin(t * 0.9 - u * 4 + i * 1.9) * w * 0.25 * u;
        const cy = -h * 0.1 + L * u;
        const wv = w * 0.09 * (1 - 0.5 * u) * (1 + 0.5 * Math.sin(u * 30 + t * 2 + i));
        left.push([cx - wv, cy]); right.push([cx + wv, cy]);
      }
      arms.moveTo(left[0][0], left[0][1]);
      for (const q of left) arms.lineTo(q[0], q[1]);
      for (let q = right.length - 1; q >= 0; q--) arms.lineTo(right[q][0], right[q][1]);
      arms.closePath();
    }
    paperFill(g, arms, st, 0.5);
    tint(g, arms, st.pal.ochre, 0.6, st);
    ink(g, arms, 0.5, 0.7, st);
    // Bell.
    const bell = new Path2D();
    bell.moveTo(-w, 0);
    bell.bezierCurveTo(-w, -h * 0.75, -w * 0.55, -h, 0, -h);
    bell.bezierCurveTo(w * 0.55, -h, w, -h * 0.75, w, 0);
    const lap = 10;
    for (let i = 0; i < lap; i++) {
      const x0 = w - (2 * w * i) / lap, x1 = w - (2 * w * (i + 1)) / lap;
      bell.quadraticCurveTo((x0 + x1) / 2, h * 0.09, x1, 0);
    }
    bell.closePath();
    paperFill(g, bell, st);
    tint(g, bell, st.pal[s.bell], 0.5, st);
    const sub = new Path2D();
    sub.moveTo(-w * 0.72, 0);
    sub.bezierCurveTo(-w * 0.7, -h * 0.55, -w * 0.35, -h * 0.72, 0, -h * 0.72);
    sub.bezierCurveTo(w * 0.35, -h * 0.72, w * 0.7, -h * 0.55, w * 0.72, 0);
    sub.closePath();
    tint(g, sub, st.pal.rose, 0.45, st);
    const mer = new Path2D();
    for (let i = -3; i <= 3; i++) {
      const x = (i / 3.4) * w;
      mer.moveTo(x * 0.2, -h * 0.97);
      mer.quadraticCurveTo(x * 1.05, -h * 0.65, x, 0);
    }
    ink(g, mer, 0.45, 0.45, st);
    ink(g, bell, 0.9, 0.95, st);
  }

  // Siphonophore: a float, paired swimming bells down a stem, then a long
  // train of feeding polyps with hanging tentacles.
  function drawSiphon(g, s, st) {
    const t = st.t, R = st.R;
    const Lb = R * 1.2, Lt = R * 3.2 * (0.85 + 0.3 * st.bass);
    const stemX = (y) => Math.sin(y / R * 1.3 - t * 1.1 + s.seed) * R * 0.18 * clamp01(y / (R * 1.5));
    const stem = new Path2D();
    stem.moveTo(0, 0);
    for (let y = 4; y <= Lb + Lt; y += 4) stem.lineTo(stemX(y), y);
    ink(g, stem, 0.6, 0.7, st);
    const bells = new Path2D();
    const nb = 6;
    for (let i = 0; i < nb; i++) {
      const y = R * 0.35 + (i / nb) * Lb;
      const side = i % 2 ? 1 : -1;
      const x = stemX(y);
      const bw = R * 0.28, bh = R * 0.2;
      bells.moveTo(x, y);
      bells.bezierCurveTo(x + side * bw * 0.2, y - bh, x + side * bw, y - bh * 0.8, x + side * bw, y);
      bells.bezierCurveTo(x + side * bw, y + bh * 0.8, x + side * bw * 0.2, y + bh, x, y);
      bells.closePath();
      bells.moveTo(x + side * bw * 0.72 + R * 0.05, y);
      bells.arc(x + side * bw * 0.72, y, R * 0.05, 0, TAU);
    }
    paperFill(g, bells, st, 0.85);
    tint(g, bells, st.pal.slate, 0.5, st);
    ink(g, bells, 0.6, 0.8, st);
    const pol = new Path2D(), ten = new Path2D();
    for (let y = Lb + R * 0.3; y < Lb + Lt; y += R * 0.32) {
      const x = stemX(y);
      pol.moveTo(x + R * 0.06, y); pol.ellipse(x, y + R * 0.02, R * 0.06, R * 0.09, 0, 0, TAU);
      const tl = R * 0.9;
      ten.moveTo(x, y);
      const sw = Math.sin(t * 1.4 + y * 0.05) * R * 0.25;
      ten.quadraticCurveTo(x + sw * 0.3, y + tl * 0.5, x + sw, y + tl);
      for (let q = 1; q < 5; q++) {
        const u = q / 5;
        const tx = x + sw * u * u, ty = y + tl * u;
        ten.moveTo(tx, ty); ten.lineTo(tx + R * 0.06, ty + R * 0.03);
      }
    }
    ink(g, ten, 0.4, 0.5, st);
    paperFill(g, pol, st, 0.85);
    tint(g, pol, st.pal.ochre, 0.7, st);
    ink(g, pol, 0.5, 0.8, st);
    const flt = new Path2D();
    flt.ellipse(0, -R * 0.05, R * 0.14, R * 0.26, 0, 0, TAU);
    paperFill(g, flt, st);
    tint(g, flt, st.pal.rose, 0.7, st);
    ink(g, flt, 0.8, 0.9, st);
  }

  const MAKERS = { lattice: makeLattice, acanth: makeAcanth, disc: makeDisc, tri: makeTri, navi: makeNavi, medusa: makeMedusa };
  const DRAWERS = { lattice: drawLattice, acanth: drawAcanth, disc: drawDisc, tri: drawTri, navi: drawNavi, medusa: drawMedusa };
  const GROUP = { lattice: 'Sphaerellaria', acanth: 'Acantharia', disc: 'Diatomeae', tri: 'Diatomeae', navi: 'Diatomeae', medusa: 'Discomedusae' };
  const CENTRES = ['medusa', 'lattice', 'acanth'];

  // ---------------------------------------------------------------------------
  // The paper: base colour, aged edges, mottle, foxing, fibres, a pressed
  // plate-mark, the ruled border and the lettering. Built once per size.

  function makePaper(pw, ph, W, H, pal, plateNo, caption) {
    const c = document.createElement('canvas');
    c.width = pw; c.height = ph;
    const g = c.getContext('2d');
    const k = pw / W;
    g.setTransform(k, 0, 0, k, 0, 0);
    const r = rng(plateNo * 31 + 7);
    g.fillStyle = rgba(pal.paper, 1);
    g.fillRect(0, 0, W, H);
    // Mottle: large soft patches of the edge colour.
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * H, rr = 60 + r() * 200;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, rgba(pal.edge, 0.07 + r() * 0.07));
      gr.addColorStop(1, rgba(pal.edge, 0));
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // Aged edges.
    const e = Math.min(W, H) * 0.16;
    const sides = [[0, 0, e, 0, 0, 0, e, H], [W, 0, W - e, 0, W - e, 0, e, H], [0, 0, 0, e, 0, 0, W, e], [0, H, 0, H - e, 0, H - e, W, e]];
    for (const s of sides) {
      const gr = g.createLinearGradient(s[0], s[1], s[2], s[3]);
      gr.addColorStop(0, rgba(pal.edge, 0.55));
      gr.addColorStop(1, rgba(pal.edge, 0));
      g.fillStyle = gr;
      g.fillRect(s[4], s[5], s[6], s[7]);
    }
    // Foxing.
    for (let i = 0; i < 70; i++) {
      const edgeBias = r() < 0.6;
      let x = r() * W, y = r() * H;
      if (edgeBias) { if (r() < 0.5) x = r() < 0.5 ? r() * W * 0.12 : W - r() * W * 0.12; else y = r() < 0.5 ? r() * H * 0.12 : H - r() * H * 0.12; }
      const rr = 0.6 + r() * r() * 5;
      g.fillStyle = rgba(pal.fox, 0.08 + r() * 0.22);
      g.beginPath();
      g.ellipse(x, y, rr, rr * (0.6 + r() * 0.5), r() * TAU, 0, TAU);
      g.fill();
      if (rr > 2.5) {
        g.fillStyle = rgba(pal.fox, 0.05);
        g.beginPath(); g.arc(x, y, rr * 2.4, 0, TAU); g.fill();
      }
    }
    // Fibres and specks.
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = r() * W, y = r() * H, a = r() * TAU, l = 2 + r() * 9;
      g.strokeStyle = r() < 0.5 ? rgba(pal.edge, 0.18) : rgba([255, 255, 255], pal.name === 'Cyanotype' ? 0.04 : 0.22);
      g.lineWidth = 0.4 + r() * 0.5;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // Plate-mark: the edge of the pressed stone, a light line and a shadow.
    const pm = Math.min(W, H) * 0.035;
    g.lineWidth = 1.4;
    g.strokeStyle = rgba(pal.edge, 0.5);
    g.strokeRect(pm + 1, pm + 1, W - 2 * pm, H - 2 * pm);
    g.strokeStyle = rgba([255, 255, 255], pal.name === 'Cyanotype' ? 0.06 : 0.35);
    g.strokeRect(pm - 0.5, pm - 0.5, W - 2 * pm, H - 2 * pm);
    // Ruled border: a heavy rule and a hairline.
    const b = Math.min(W, H) * 0.075;
    g.strokeStyle = rgba(pal.line, 0.85);
    g.lineWidth = 1.3;
    g.strokeRect(b, b, W - 2 * b, H - 2 * b);
    g.lineWidth = 0.5;
    g.strokeRect(b + 4, b + 4, W - 2 * b - 8, H - 2 * b - 8);
    // Lettering.
    g.fillStyle = rgba(pal.text, 0.88);
    g.textBaseline = 'alphabetic';
    g.font = 'italic 11px Georgia, "Times New Roman", serif';
    g.textAlign = 'left';
    g.fillText('Formae maris.', b, b - 7);
    g.font = '12px Georgia, "Times New Roman", serif';
    g.textAlign = 'right';
    g.fillText('Tab. ' + roman(plateNo) + '.', W - b, b - 7);
    g.textAlign = 'center';
    g.font = 'italic 13px Georgia, "Times New Roman", serif';
    g.fillText(caption, W / 2, H - b + 17);
    g.font = '8px Georgia, "Times New Roman", serif';
    g.textAlign = 'left';
    g.fillText('Lith. et impr.', b, H - b + 15);
    return c;
  }

  // ---------------------------------------------------------------------------

  VIZ.register({
    id: 'plate',
    name: 'Plate',
    order: 410,

    params: [
      { key: 'palette', label: 'Print', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'centre', label: 'Centrepiece', type: 'select', options: ['Medusa', 'Radiolarian', 'Acantharian'], default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'colour', label: 'Ink colour', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'crowd', label: 'Specimens', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'drift', label: 'Swimming', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'turn', label: 'Turning', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'reg', label: 'Misregistration', type: 'range', min: 0, max: 4, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'newplate', label: 'New plate', run() { this.wantNew = true; } },
    ],

    gallery: {
      title: 'Plate',
      technique: 'Canvas 2D chromolithograph: cached unit Path2D engraving detail (lattice pores, diatom striae, areolae) drawn scaled, flat tint plates offset from the line plate for misregistration, a pre-rendered aged paper with foxing, plate-mark, ruled border and lettering, onset detection against slow baselines',
      brief: 'A living natural-history colour plate: aged cream paper, a ruled border, a plate number and a Latin caption, and sea organisms drawn in fine sepia line with flat printed tints of rose, ochre, slate and sage laid slightly out of register. A large medusa seen from above (or a radiolarian) sits in a ring of six radiolaria and diatoms that slowly turn; pale medusae and siphonophores swim behind them, tentacles trailing, and plankton specks drift. The kick is a swim stroke of the centrepiece only: its bell contracts and the fringe flicks. A clap steps the ring round by one place. Hats flick plankton specks into rose ink. The bass lengthens tentacles, arms and spines. The drop prints a second ring of small specimens into the corners, sends more swimmers across and inks every tint to full strength; the breakdown lets them fade back towards an uncoloured engraving.',
      lineage: [
        'Brief 10 (batch 04): an Ernst Haeckel plate from Kunstformen der Natur, radiolaria, diatoms, medusae and siphonophores in radial symmetry as a chromolithograph on aged paper; no rainbow, no glow.',
        'Approach: Canvas 2D line and flat fill only, because a litho plate is line plus flat tint stones. Original organisms in the spirit of the plates rather than copies: a four- to eight-fold medusa from above (coronal rings, forked canals, horseshoe gonads, frilled arms), a foreshortened lattice-sphere radiolarian with barbed spines, an acantharian of blade spines and a scalloped membrane, centric, polygonal and pennate diatoms, and swimming medusae and siphonophores in profile.',
        'v1: the plate read well at once (cream paper, flat tints, ring of six turning), but the kick was nearly invisible: a 13% bell contraction on a pale bell moved 1% of the frame. The drop\'s corner specimens were placed on an ellipse that collided with the ring satellites.',
        'v2: the kick became a proper swim stroke of the centrepiece only: 20% contraction, the bell tint and coronal rings ink up (0.42 to 0.82) and the tentacle fringe flicks back, so the kick is a dark slate flush confined to the medusa. Drop specimens moved into the six gaps of the ring (riding it round) and the four corners. Jolt: drop kickArea 0.14 (plain downbeat 0.06, a clean hot ring on the medusa alone; the clap-kick 0.22 because the clap steps the ring at the same moment), ratio 2.25, calm. The clap\'s ring step has a 1.7 s cooldown and a 1.3 s smootherstep so the plate turns in visible steps rather than spinning.',
        'v3: small polygonal diatoms printed their areolae as a grey smudge, so below radius 32 they get an inner outline instead; centrepiece and satellites shrunk a little so the bottom satellite clears the fringe; background swimmers inked darker so the drift reads.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, step: 9 };
      this.hatSeed = 0;
      this.pulse = { t0: -9, amp: 0 };
      this.ring = { from: 0, to: 0, t0: -9, dur: 1.3 };
      this.plateNo = 47;
      this.built = null;
      this.paperKey = '';
      this.lastDropHigh = false;
      this.flashes = new Float32Array(0);
    },

    build(centreIdx) {
      const r = rng(this.plateNo * 97 + 13);
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      const centreKind = CENTRES[centreIdx];
      const pool = ['lattice', 'acanth', 'disc', 'tri'].filter((x) => x !== centreKind);
      const kA = pick(pool);
      const kB = pick(pool.filter((x) => x !== kA));
      const outerKinds = ['navi', 'disc', 'tri', 'lattice'];
      const outer = [];
      for (let i = 0; i < 4; i++) outer.push(MAKERS[pick(outerKinds)](r));
      const swimmers = [];
      for (let i = 0; i < 5; i++) {
        swimmers.push({
          kind: i < 3 ? 'medusa' : 'siphon', seed: i * 13 + 5,
          u: r(), v: r(), heading: (r() - 0.5) * 1.2, R: i < 3 ? 22 + r() * 12 : 26 + r() * 8,
          phase: r(), period: 1.5 + r() * 1.1, bell: r() < 0.5 ? 'slate' : 'sage',
        });
      }
      const specks = [];
      for (let i = 0; i < 110; i++) specks.push({ u: r(), v: r(), s: 0.5 + r() * 1.3, ph: r() * TAU, ring: r() < 0.4 });
      this.built = {
        centreIdx, centre: MAKERS[centreKind](r), ringKinds: [kA, kB],
        ringD: [MAKERS[kA](r), MAKERS[kB](r)], outer, swimmers, specks,
        caption: GROUP[centreKind] + '. — ' + GROUP[kA] + '. — ' + GROUP[kB] + '.',
      };
      this.flashes = new Float32Array(specks.length).fill(-9);
      this.nextSwap = this.T + 32;
      this.swap = null;
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt; since.step += dt;
      // Kick: band 0 leading band 1, so the bass line's own notes don't pump.
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.pulse = { t0: this.T, amp: Math.min(1, 0.4 + kRaw) };
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.6, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        // The ring steps on a clap, but never more often than every other
        // clap, so it reads as the plate being turned, not spun.
        if (since.step > 1.7) {
          since.step = 0;
          const cur = this.ringAngle();
          this.ring = { from: cur, to: this.ring.to + TAU / 6, t0: this.T, dur: 1.3 };
        }
      }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw, e.snare * Math.exp(-dt / 0.16));

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 9973;
        const n = this.flashes.length;
        for (let i = 0; i < n; i++) if (hash(i, this.hatSeed) < 0.07 + 0.08 * e.drop) this.flashes[i] = this.T;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 150), 2, dt);
    },

    ringAngle() {
      const r = this.ring;
      return r.from + (r.to - r.from) * smoother((this.T - r.t0) / r.dur);
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      this.T += dt;
      const T = this.T;
      const push = params.push;
      const palIdx = Math.max(0, Math.min(PAL.length - 1, Math.round(params.palette)));
      const pal = PAL[palIdx];
      const centreIdx = Math.max(0, Math.min(2, Math.round(params.centre)));

      if (this.wantNew) { this.wantNew = false; this.plateNo = 12 + Math.floor(Math.random() * 38); this.built = null; }
      if (!this.built || this.built.centreIdx !== centreIdx) this.build(centreIdx);
      const B = this.built;

      this.listen(signals, dt, push);
      const e = this.env;

      // Every half minute one of the ring's two species is reprinted as a new
      // specimen: it fades out, is re-drawn and fades back in.
      if (!this.swap && T > this.nextSwap) {
        this.swap = { which: Math.floor(T / 32) % 2, t0: T, done: false };
      }
      let swapFade = [1, 1];
      if (this.swap) {
        const u = (T - this.swap.t0) / 3;
        if (u > 0.5 && !this.swap.done) {
          this.swap.done = true;
          const r = rng(Math.floor(T * 1000) + this.plateNo);
          const pool = ['lattice', 'acanth', 'disc', 'tri'].filter((x) => x !== CENTRES[centreIdx]);
          const other = B.ringKinds[1 - this.swap.which];
          const kinds = pool.filter((x) => x !== other);
          const kd = kinds[Math.floor(r() * kinds.length)];
          B.ringKinds[this.swap.which] = kd;
          B.ringD[this.swap.which] = MAKERS[kd](r);
          B.caption = GROUP[CENTRES[centreIdx]] + '. \u2014 ' + GROUP[B.ringKinds[0]] + '. \u2014 ' + GROUP[B.ringKinds[1]] + '.';
        }
        swapFade[this.swap.which] = Math.abs(1 - 2 * clamp01(u));
        if (u >= 1) { this.swap = null; this.nextSwap = T + 32; }
      }

      // The drop re-deals the corner specimens each time it arrives.
      const dropHigh = e.drop > 0.5;
      if (dropHigh && !this.lastDropHigh) {
        const r = rng(Math.floor(T * 100) + 3);
        const outerKinds = ['navi', 'disc', 'tri', 'lattice'];
        for (let i = 0; i < 4; i++) B.outer[i] = MAKERS[outerKinds[Math.floor(r() * 4)]](r);
      }
      if (e.drop < 0.15) this.lastDropHigh = false;
      if (dropHigh) this.lastDropHigh = true;

      // Paper, cached per size, palette and plate.
      const pw = Math.round(p.width * p.pixelDensity()), ph = Math.round(p.height * p.pixelDensity());
      const key = pw + 'x' + ph + ':' + palIdx + ':' + this.plateNo + ':' + B.caption;
      if (this.paperKey !== key) {
        this.paperCanvas = makePaper(pw, ph, W, H, pal, this.plateNo, B.caption);
        this.paperKey = key;
      }

      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.shadowColor = 'rgba(0,0,0,0)';
      g.shadowBlur = 0;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.setLineDash([]);
      g.drawImage(this.paperCanvas, 0, 0, W, H);

      const S = Math.min(W, H);
      const bx = S * 0.075;
      const cx = W / 2, cy = H / 2;
      const inkStrength = clamp01(params.colour * (0.45 + 0.55 * e.drop)) + Math.max(0, params.colour - 1) * 0.3 * (1 - e.drop);
      const regG = [0.9 * params.reg, 0.6 * params.reg];
      const turn = params.turn;

      const makeSt = (R, rot, tintA, lineA, c) => {
        c = c || 0;
        const cr = Math.cos(-rot), sr = Math.sin(-rot);
        return {
          pal, R, c, bass: e.bass, t: T, tint: tintA * inkStrength, line: lineA,
          reg: [regG[0] * cr - regG[1] * sr, regG[0] * sr + regG[1] * cr],
        };
      };

      // Clip to the inside of the border so swimmers slip under it.
      g.save();
      g.beginPath();
      g.rect(bx + 5, bx + 5, W - 2 * bx - 10, H - 2 * bx - 10);
      g.clip();

      // --- Plankton specks drifting in the water; hats flick some into ink.
      const ux = W - 2 * bx, uy = H - 2 * bx;
      const flashCol = pal.rose;
      const speckPath = new Path2D(), ringPath = new Path2D(), flashPath = new Path2D();
      const nSpeck = Math.round(B.specks.length * (0.55 + 0.45 * e.drop) * Math.min(1.3, 0.4 + params.crowd * 0.6));
      for (let i = 0; i < Math.min(nSpeck, B.specks.length); i++) {
        const sp = B.specks[i];
        const x = bx + (((sp.u + T * 0.004 * params.drift + 0.02 * Math.sin(T * 0.3 + sp.ph)) % 1 + 1) % 1) * ux;
        const y = bx + (((sp.v - T * 0.006 * params.drift) % 1 + 1) % 1) * uy;
        const fl = T - this.flashes[i];
        if (fl >= 0 && fl < 0.22) {
          const s = sp.s * 1.6 + 1.6;
          flashPath.moveTo(x + s, y); flashPath.arc(x, y, s, 0, TAU);
        } else if (sp.ring) {
          ringPath.moveTo(x + sp.s * 1.4, y); ringPath.arc(x, y, sp.s * 1.4, 0, TAU);
        } else {
          speckPath.moveTo(x + sp.s * 0.6, y); speckPath.arc(x, y, sp.s * 0.6, 0, TAU);
        }
      }
      g.fillStyle = rgba(pal.line, 0.5);
      g.fill(speckPath);
      g.lineWidth = 0.5;
      g.strokeStyle = rgba(pal.line, 0.45);
      g.stroke(ringPath);
      g.fillStyle = rgba(flashCol, 0.95);
      g.fill(flashPath);
      g.strokeStyle = rgba(pal.line, 0.8);
      g.lineWidth = 0.6;
      g.stroke(flashPath);

      // --- Swimmers behind the plate: printed paler, as a lighter stone.
      const activeMed = 2 + (e.drop > 0.3 ? 1 : 0) + (params.crowd > 1.5 ? 1 : 0);
      for (let i = 0; i < B.swimmers.length; i++) {
        const s = B.swimmers[i];
        const isMed = s.kind === 'medusa';
        const on = isMed ? (i < activeMed ? 1 : 0) : (i === 3 ? 1 : smooth(0.3, 0.7, e.drop));
        s.vis = ease(s.vis === undefined ? on : s.vis, on, 0.8, dt);
        // Swim: a stroke cycle; each stroke pushes the body along its heading.
        const ph = ((T / s.period + s.phase) % 1);
        const c = isMed ? Math.exp(-ph * 5) * smooth(0, 0.08, ph) : 0;
        const sp = params.drift * (isMed ? (5 + 22 * c) * (1 + 0.6 * e.bass + 0.5 * e.drop) : 7 * (1 + 0.5 * e.drop));
        s.heading += Math.sin(T * 0.13 + s.seed) * 0.08 * dt;
        const hx = Math.sin(s.heading), hy = -Math.cos(s.heading);
        s.u += (hx * sp * dt) / ux; s.v += (hy * sp * dt) / uy;
        if (!isMed) { s.u += (8 * params.drift * dt) / ux; }
        s.u = ((s.u % 1.3) + 1.3) % 1.3; s.v = ((s.v % 1.4) + 1.4) % 1.4;
        if (s.vis < 0.02) continue;
        const x = bx + (s.u - 0.15) * ux, y = bx + (s.v - 0.2) * uy;
        g.save();
        g.translate(x, y);
        g.rotate(isMed ? s.heading : s.heading * 0.3 - 0.25);
        const st = makeSt(s.R, isMed ? s.heading : s.heading * 0.3 - 0.25, 0.75 * s.vis, 0.72 * s.vis, c);
        if (isMed) drawSwimmer(g, s, st); else drawSiphon(g, s, st);
        g.restore();
      }

      // --- The drop prints small specimens into the gaps of the ring and
      // the four corners; the gap specimens ride the ring round.
      const outerOn = clamp01(e.drop * Math.min(1, params.crowd) * 1.3 + Math.max(0, params.crowd - 1) * 0.6);
      const ra = this.ringAngle();
      const rx = Math.min(W / 2 - bx - S * 0.13, S * 0.62), ry = H / 2 - bx - S * 0.12;
      if (outerOn > 0.01) {
        const r2 = S * 0.042;
        const spots = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + ra;
          spots.push([cx + Math.cos(a) * rx * 1.02, cy + Math.sin(a) * ry * 1.02, B.outer[i % 3], r2, i * 0.1, i % 2 ? 1 : -1]);
        }
        const kx = W / 2 - bx - S * 0.07, ky = H / 2 - bx - S * 0.07;
        for (let i = 0; i < 4; i++) {
          const sx = i % 2 ? 1 : -1, sy = i < 2 ? -1 : 1;
          spots.push([cx + sx * kx, cy + sy * ky, B.outer[3], r2 * 0.9, 0.3 + i * 0.08, sx]);
        }
        for (const [x, y, d, rS, delay, dir] of spots) {
          const on = clamp01(outerOn * 1.6 - delay);
          if (on <= 0.01) continue;
          const rot = T * 0.06 * turn * dir + (dir < 0 ? Math.PI : 0);
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          DRAWERS[d.kind](g, d, makeSt(rS * (0.8 + 0.2 * on), rot, on, on));
          g.restore();
        }
      }

      // --- The ring of six.
      const rr = S * 0.08;
      const labels = [];
      for (let i = 0; i < 6; i++) {
        const a = ((i + 0.5) / 6) * TAU + ra;
        const which = i % 2;
        const d = B.ringD[which];
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        const rot = T * 0.07 * turn * (which ? 1 : -1) + i * 0.4;
        const f = swapFade[which];
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        const st = makeSt(rr * (1 + 0.05 * e.bass), rot, f, f);
        DRAWERS[d.kind](g, d, st);
        g.restore();
        labels.push([x + rr * 1.25, y + rr * 1.15, i + 2, f]);
      }

      // --- The centrepiece. The kick is its swim stroke.
      const pu = (T - this.pulse.t0);
      const cPulse = pu < 0 ? 0 : (pu < 0.07 ? smooth(0, 0.07, pu) : Math.exp(-(pu - 0.07) / 0.3)) * this.pulse.amp * Math.min(1.6, push);
      const Rc = S * (centreIdx === 0 ? 0.18 : 0.13) * (1 + 0.04 * e.bass);
      const crot = T * 0.03 * turn;
      g.save();
      g.translate(cx, cy);
      g.rotate(crot);
      DRAWERS[B.centre.kind](g, B.centre, makeSt(Rc, crot, 1, 1, cPulse));
      g.restore();
      labels.push([cx + Rc * 1.05, cy + Rc * 1.2, 1, 1]);

      // Figure numbers, as on a plate.
      g.font = 'italic 9px Georgia, "Times New Roman", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const L of labels) {
        g.fillStyle = rgba(pal.text, 0.8 * L[3]);
        g.fillText(String(L[2]) + '.', L[0], L[1]);
      }
      g.restore(); // clip
      g.restore();
    },
  });
})();
