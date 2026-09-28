// Glitch art: a clean, confident poster being corrupted by the music, and
// forever trying to put itself back together.
//
// Two canvases. The POSTER is drawn fresh every frame, crisp: a bone sheet, a
// big vermilion disc with a gradient in it, a condensed headline that overlaps
// the disc, a tagline, a mono data block, a grey-step test strip and a
// scrolling hex dump of the words. The DISPLAY is what you see, and it is never
// cleared: each frame it is healed a fraction of the way back towards the
// poster, then the glitches are written into it. So corruption is persistent
// and self-feeding (datamosh smears copy the display into itself) but always
// decays back to the poster: "the underlying poster keeps trying to reassert
// itself" is literally the heal step.
//
// Music, each in its own place:
//   kick   one local tear: a slab of the poster around one anchor (a letter,
//          the disc edge, the data block) splits into slices that jump
//          sideways with red/cyan channel separation, and some of its 12-unit
//          macroblocks drop to JPEG-like mush; stepped decay, ~0.3 s
//   snare  a different event: a thin full-width scanline tear, two to four
//          slices sliding with channel split, wrapped at the edges
//   bass   the datamosh zone: a ragged patch of macroblocks carrying motion
//          vectors wanders across the sheet and drags the picture with it;
//          vector length follows the bass
//   pad    the pixel-sort melt: the disc's colours sort downward from a sort
//          line in jagged streaks; length follows bass + pad
//   hats   dead macroblocks: single squares flip to a flat ink for a frame or two
//   drop   the headline re-sets bigger with a mosh transition to its next word,
//          a second (cyan) plate slides out of register behind the black, the
//          melt and the mosh zone grow, kick tears get larger; the breakdown
//          exhales to a nearly clean poster with a slow melt and one drifting
//          tracking band.
// Nothing ever inverts or flashes a large area: every glitch is local or thin.
// Plain Canvas 2D; no glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hash2 = (a, b) => hash(a * 57.31 + b * 191.7);
  // Cheap smooth 1D value noise.
  const vnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

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
  function face(fam, fb) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fb;
  }

  // Three inks plus the second plate that arrives with the drop. Glitch art
  // lives or dies on a controlled palette: the corruption supplies the chaos.
  const PRINTS = [
    { name: 'Bone', ground: '#ECE7DC', ink: '#141414', accent: '#EE3A1E', deep: '#7A1410',
      second: '#12B5C9', mute: '#9C968B' },
    { name: 'Night', ground: '#0F0F11', ink: '#EAE4D6', accent: '#FF4127', deep: '#3A0B0A',
      second: '#1FC7D8', mute: '#5B5852' },
    { name: 'Blue screen', ground: '#1731B8', ink: '#F1EFE8', accent: '#FFCE1F', deep: '#B0470E',
      second: '#FF4FA3', mute: '#6F82D8' },
  ];

  const DEFAULT_WORDS = 'SIGNAL | STATIC | BLEED | CARRIER | LOOP';

  function hexOf(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) out += str.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0') + ' ';
    return out;
  }

  VIZ.register({
    id: 'glitch',
    name: 'Glitch',
    order: 519,
    params: [
      { key: 'print', label: 'Print', type: 'select', options: PRINTS.map((p) => p.name), default: 0 },
      { key: 'corrupt', label: 'Corruption', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'heal', label: 'Heal speed', type: 'range', min: 0.2, max: 3, default: 1, step: 0.01 },
      { key: 'melt', label: 'Pixel-sort melt', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'mosh', label: 'Datamosh smear', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'words', label: 'Headlines ( | between)', type: 'text', default: DEFAULT_WORDS },
    ],
    actions: [
      { id: 'next', label: 'Next headline', run() { this.wantNext = true; } },
      { id: 'crash', label: 'Crash', run() { this.wantCrash = true; } },
    ],
    gallery: {
      title: 'Glitch',
      technique: 'Canvas 2D, two canvases: a crisp poster redrawn each frame and a persistent display healed towards it by an exponential blend, then corrupted in place by region operations (slice shifts with red/cyan channel separation via multiply-and-add, macroblock downsampling behind a clip path, block-wise self-copies along a motion-vector field for datamosh, stretched source strips for pixel sorting); onset detection against the previous frame',
      brief: 'A graphic poster (a vermilion disc, a huge condensed headline, a data block, a test strip) being corrupted by the music. Kicks tear one local slab sideways with channel split; claps tear a thin scanline across the sheet; the bass drags a wandering datamosh patch; the disc melts in pixel-sorted streaks with the bass and pad; hats flip single dead blocks. The drop re-sets the headline bigger with a mosh transition and brings in a second cyan plate out of register. The breakdown heals back to an almost clean poster. Nothing flashes the whole frame.',
      lineage: 'Rosa Menkman\'s and the early-2010s glitch-art scene\'s vocabulary (datamoshing from deleted I-frames, Kim Asendorf\'s pixel sorting, JPEG macroblock decay, VHS tracking tears) laid over a Swiss-style rave poster. Process: read the batch-05 brief and TASTE; designed the two-canvas heal/corrupt loop first so every glitch is local and self-limiting; iterated at 640x360 on the contact sheet and on jolt.mjs heat maps to keep each kick to one slab of the sheet; wording is original (SIGNAL / STATIC / BLEED, "we dance until the picture breaks").',
    },

    setup(p) {
      this.rng = mulberry(519);
      this.events = [];
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0;
      this.density = 0; this.bassEnv = 0; this.padEnv = 0; this.drop = 0;
      this.wordIdx = 0; this.wordT = -10;
      this.anchorIdx = 0; this.lastT = null;
    },
    enter(p) {
      this.lastT = null;
      this.fresh = true;
    },

    canvases(w, h) {
      const mk = () => document.createElement('canvas');
      if (!this.P) {
        this.P = mk(); this.D = mk(); this.M = mk(); this.TR = mk(); this.TG = mk();
        this.pc = this.P.getContext('2d'); this.dc = this.D.getContext('2d');
        this.mc = this.M.getContext('2d'); this.trc = this.TR.getContext('2d'); this.tgc = this.TG.getContext('2d');
      }
      if (this.P.width !== w || this.P.height !== h) {
        this.P.width = w; this.P.height = h; this.D.width = w; this.D.height = h;
        this.fresh = true;
      }
    },

    words(params) {
      const list = String(params.words || DEFAULT_WORDS).split('|').map((s) => s.trim().toUpperCase()).filter((s) => s.length);
      return list.length ? list : ['SIGNAL'];
    },

    // ---------------------------------------------------------------- layout
    layout(W, H) {
      const wide = W >= H * 1.25;
      const m = Math.min(W, H) * 0.045;
      const L = { W, H, m, wide };
      if (wide) {
        L.cx = W * 0.69; L.cy = H * 0.42; L.R = H * 0.33;
        L.headX = m; L.headBase = H - m - 26; L.headW = W * 0.8; L.headMaxH = H * 0.46;
        L.tagX = m; L.tagY = H * 0.16; L.tagSize = H * 0.042;
        L.infoY = H * 0.33;
      } else {
        L.cx = W * 0.6; L.cy = H * 0.37; L.R = Math.min(W * 0.33, H * 0.25);
        L.headX = m; L.headBase = H - m - 26; L.headW = W - 2 * m; L.headMaxH = H * 0.3;
        L.tagX = m; L.tagY = H * 0.14; L.tagSize = Math.min(W, H) * 0.038;
        L.infoY = H * 0.29;
      }
      return L;
    },

    // ---------------------------------------------------------------- poster
    drawPoster(c, L, pr, t, word, dropness, bass) {
      const { W, H, m } = L;
      const HEAD = face('Anton', 'Impact, sans-serif');
      const TAG = face('Archivo Black', 'Arial Black, sans-serif');
      const MONO = face('Space Mono', 'Menlo, monospace');

      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = pr.ground; c.fillRect(0, 0, W, H);

      // The disc drifts on a slow orbit and breathes a little with the bass.
      const cx = L.cx + Math.sin(t * 0.11) * L.R * 0.06;
      const cy = L.cy + Math.cos(t * 0.083) * L.R * 0.04;
      const R = L.R * (1 + 0.035 * bass + 0.06 * dropness);
      L.dcx = cx; L.dcy = cy; L.dR = R;

      // Second plate: a cyan disc outline slipping out of register in the drop.
      if (dropness > 0.02) {
        c.strokeStyle = pr.second; c.globalAlpha = dropness;
        c.lineWidth = 3;
        const ox = 14 * dropness + Math.sin(t * 0.7) * 4, oy = -9 * dropness;
        c.beginPath(); c.arc(cx + ox, cy + oy, R * 1.04, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      }
      const g = c.createLinearGradient(0, cy - R, 0, cy + R);
      g.addColorStop(0, pr.accent); g.addColorStop(0.55, pr.accent); g.addColorStop(1, pr.deep);
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      // Groove rings around it, like a record or a speaker cone.
      c.strokeStyle = pr.ink; c.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        c.globalAlpha = 0.55 - i * 0.12;
        c.beginPath(); c.arc(cx, cy, R + 9 * i, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;

      // Top rule and running heads.
      c.fillStyle = pr.ink; c.fillRect(m, m + 16, W - 2 * m, 1.5);
      c.font = '700 ' + (L.wide ? 11 : 10) + 'px ' + MONO;
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.fillText('CH.07  //  LIVE TRANSMISSION', m, m + 10);
      c.textAlign = 'right';
      c.fillText('124 BPM  //  ALL NIGHT', W - m, m + 10);

      // Grey-step test strip under the rule, with one accent chip.
      const sw = L.wide ? 22 : 18, sx0 = W - m - sw * 9, sy = m + 26;
      for (let i = 0; i < 9; i++) {
        const v = Math.round(20 + i * 29);
        c.fillStyle = i === 8 ? pr.accent : 'rgb(' + v + ',' + v + ',' + v + ')';
        c.fillRect(sx0 + i * sw, sy, sw, 10);
      }

      // Tagline.
      c.fillStyle = pr.ink; c.textAlign = 'left';
      c.font = '400 ' + L.tagSize.toFixed(1) + 'px ' + TAG;
      c.fillText('WE DANCE UNTIL', L.tagX, L.tagY);
      c.fillText('THE PICTURE BREAKS', L.tagX, L.tagY + L.tagSize * 1.08);

      // Data block.
      c.font = '400 ' + (L.wide ? 11 : 10) + 'px ' + MONO;
      const info = ['SAT 23:00 -- LATE', 'FREQ 88.4 / NO REPEAT', 'ERR 0x7F: PICTURE LOST', 'KEEP DANCING'];
      for (let i = 0; i < info.length; i++) {
        c.fillStyle = i === 2 ? pr.accent : pr.ink;
        c.fillText(info[i], L.tagX, L.infoY + i * 15);
      }

      // Headline, fitted to its box; bigger in the drop.
      const hw = L.headW * (1 + 0.12 * dropness);
      c.font = '400 100px ' + HEAD;
      const mw = c.measureText(word);
      const asc = mw.actualBoundingBoxAscent || 73;
      let fs = Math.min(100 * hw / Math.max(1, mw.width), 100 * L.headMaxH * (1 + 0.15 * dropness) / asc);
      c.font = '400 ' + fs.toFixed(1) + 'px ' + HEAD;
      const bx = L.headX, by = L.headBase;
      L.head = { x: bx, y: by - asc * fs / 100, w: mw.width * fs / 100, h: asc * fs / 100 };
      if (dropness > 0.02) {
        c.globalAlpha = dropness; c.fillStyle = pr.second;
        c.fillText(word, bx + 9 * dropness, by + 5 * dropness);
        c.globalAlpha = 1;
      }
      c.fillStyle = pr.ink; c.fillText(word, bx, by);

      // Hex dump of the words, scrolling along the foot.
      c.font = '400 10px ' + MONO; c.fillStyle = pr.mute;
      const hx = hexOf(word + ' / WE DANCE UNTIL THE PICTURE BREAKS / ');
      const tw = c.measureText(hx).width;
      let x = -((t * 22) % tw);
      while (x < W) { c.fillText(hx, x, H - m + 12); x += tw; }

      // Registration crosses.
      c.strokeStyle = pr.ink; c.lineWidth = 1;
      const cross = (x, y) => { c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke(); };
      cross(m * 0.5, H * 0.5); cross(W - m * 0.5, H * 0.5);
    },

    // Anchors a kick can land on: parts of the poster where a tear is legible.
    anchors(L) {
      const hd = L.head;
      const out = [];
      for (let i = 0; i < 4; i++) out.push({ x: hd.x + hd.w * (0.12 + 0.25 * i), y: hd.y + hd.h * (0.25 + 0.5 * hash(i + 3)), big: true });
      out.push({ x: L.dcx - L.dR * 0.5, y: L.dcy - L.dR * 0.3 });
      out.push({ x: L.dcx + L.dR * 0.6, y: L.dcy + L.dR * 0.1 });
      out.push({ x: L.tagX + 120, y: L.tagY - 4 });
      out.push({ x: L.tagX + 90, y: L.infoY + 20 });
      out.push({ x: L.W - L.m - 100, y: L.m + 30 });
      return out;
    },

    // --------------------------------------------------------------- effects
    // Copy a band of the poster into the display with a sideways shift and a
    // red/cyan channel split. Channel split: the poster region multiplied by
    // pure red and by pure cyan, added back together at different offsets —
    // where they overlap the sum is the original, where they don't the edges
    // fringe.
    splitSlice(S, x, y, w, h, dx, split, wrap) {
      const D = this.dc;
      const X = Math.round(x * S), Y = Math.round(y * S), Wd = Math.max(1, Math.round(w * S)), Hd = Math.max(1, Math.round(h * S));
      const ddx = Math.round(dx * S), sp = Math.round(split * S);
      if (this.TR.width < Wd || this.TR.height < Hd) {
        this.TR.width = this.TG.width = Math.max(this.TR.width, Wd);
        this.TR.height = this.TG.height = Math.max(this.TR.height, Hd);
      }
      const fillPlate = (tc, col, off) => {
        tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1;
        // Out-of-sheet source reads as bare paper, not black.
        tc.fillStyle = this.groundCol || '#000'; tc.fillRect(0, 0, Wd, Hd);
        const sx = X - ddx - off;
        tc.drawImage(this.P, sx, Y, Wd, Hd, 0, 0, Wd, Hd);
        if (wrap) {
          const PW = this.P.width;
          tc.drawImage(this.P, sx + PW, Y, Wd, Hd, 0, 0, Wd, Hd);
          tc.drawImage(this.P, sx - PW, Y, Wd, Hd, 0, 0, Wd, Hd);
        }
        tc.globalCompositeOperation = 'multiply';
        tc.fillStyle = col; tc.fillRect(0, 0, Wd, Hd);
        tc.globalCompositeOperation = 'source-over';
      };
      fillPlate(this.trc, '#ff0000', sp);
      fillPlate(this.tgc, '#00ffff', -sp);
      D.globalAlpha = 1; D.globalCompositeOperation = 'source-over';
      D.fillStyle = '#000'; D.fillRect(X, Y, Wd, Hd);
      D.globalCompositeOperation = 'lighter';
      D.drawImage(this.TR, 0, 0, Wd, Hd, X, Y, Wd, Hd);
      D.drawImage(this.TG, 0, 0, Wd, Hd, X, Y, Wd, Hd);
      D.globalCompositeOperation = 'source-over';
    },

    // JPEG-ish macroblocks: the region is averaged down to one pixel per block
    // and some blocks (a hashed subset, shrinking as the event ages) are
    // drawn back nearest-neighbour; a few become flat quantised chips with a
    // faint DCT stripe.
    blocks(S, x, y, w, h, bs, frac, seed, pr) {
      const D = this.dc;
      const nx = Math.ceil(w / bs), ny = Math.ceil(h / bs);
      if (this.M.width < nx || this.M.height < ny) { this.M.width = Math.max(this.M.width, nx); this.M.height = Math.max(this.M.height, ny); }
      const X = x * S, Y = y * S;
      this.mc.imageSmoothingEnabled = true;
      this.mc.drawImage(this.D, X, Y, nx * bs * S, ny * bs * S, 0, 0, nx, ny);
      D.save();
      D.beginPath();
      const flats = [];
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const hv = hash2(seed + i * 1.7, j * 3.1 + seed * 0.37);
          if (hv < frac) {
            D.rect(Math.round(X + i * bs * S), Math.round(Y + j * bs * S), Math.ceil(bs * S), Math.ceil(bs * S));
            if (hv < frac * 0.07) flats.push([i, j, hv]);
          }
        }
      }
      D.clip();
      D.imageSmoothingEnabled = false;
      D.drawImage(this.M, 0, 0, nx, ny, X, Y, nx * bs * S, ny * bs * S);
      D.imageSmoothingEnabled = true;
      D.restore();
      for (const f of flats) {
        const col = [pr.accent, pr.second, pr.ink, pr.deep][Math.floor(f[2] * 1e4) % 4];
        const bx = Math.round(X + f[0] * bs * S), by = Math.round(Y + f[1] * bs * S), b = Math.ceil(bs * S);
        D.fillStyle = col; D.fillRect(bx, by, b, b);
        D.globalAlpha = 0.35; D.fillStyle = pr.ground;
        for (let k = 1; k < 4; k += 2) D.fillRect(bx, by + (b * k) / 4, b, Math.max(1, b / 8));
        D.globalAlpha = 1;
      }
    },

    // Datamosh: every active block in the zone shows the source picture
    // displaced along a smooth motion-vector field, so the poster seems to be
    // dragged through itself in 14-unit blocks. The source is the crisp poster
    // (or, for a headline change, the poster as it was before: the old frame
    // pushed around by the new one's motion, which is what a deleted I-frame
    // does). Reading from a separate canvas also matters for speed: drawing a
    // canvas onto itself copies the whole canvas per call.
    mosh(S, src, zone, strength, t, W, H, bs, keepFrac) {
      const D = this.dc;
      bs = bs || 14;
      const x0 = Math.max(0, Math.floor(zone.x / bs) * bs), y0 = Math.max(0, Math.floor(zone.y / bs) * bs);
      const x1 = Math.min(W - bs, zone.x + zone.w), y1 = Math.min(H - bs, zone.y + zone.h);
      const b = Math.ceil(bs * S);
      const tq = Math.floor(t * 4);
      const kf = keepFrac == null ? 1 : keepFrac;
      for (let y = y0; y < y1; y += bs) {
        for (let x = x0; x < x1; x += bs) {
          // A ragged blob, not a rectangle: soft radial falloff broken by hash.
          const u = (x - zone.x) / zone.w - 0.5, v = (y - zone.y) / zone.h - 0.5;
          const r = Math.sqrt(u * u + v * v) * 2;
          const hv = hash2(x * 0.13, y * 0.29 + tq);
          if (r + hv * 0.45 > 1.05 || hv > kf) continue;
          const a = vnoise(x * 0.006 + t * 0.25) * 6.28 + vnoise(y * 0.008 - t * 0.2) * 2;
          const mag = strength * (0.6 + 0.8 * vnoise(x * 0.02 + y * 0.015 + t * 0.7));
          const sx = Math.round((x - Math.cos(a) * mag) * S), sy = Math.round((y - Math.sin(a) * mag * 0.5) * S);
          D.drawImage(src, clamp(sx, 0, src.width - b), clamp(sy, 0, src.height - b), b, b,
            Math.round(x * S), Math.round(y * S), b, b);
        }
      }
    },

    // Pixel sort: short strips of the disc under the sort line stretched down
    // into long streaks, lengths from a noise profile so the ends are jagged.
    melt(S, L, amount, t) {
      const D = this.dc;
      const cx = L.dcx, cy = L.dcy, R = L.dR;
      const y0 = cy + R * (0.05 + 0.3 * Math.sin(t * 0.21));
      const half = Math.sqrt(Math.max(0, R * R - (y0 - cy) * (y0 - cy)));
      const sw = 3;
      const Y = Math.round(y0 * S);
      for (let x = cx - half; x < cx + half - sw; x += sw) {
        const n = vnoise(x * 0.045 + t * 0.35) * 0.65 + hash2(Math.floor(x), Math.floor(t * 6)) * 0.35;
        const edge = Math.sqrt(clamp(1 - ((x - cx) / half) * ((x - cx) / half), 0, 1));
        const len = amount * (25 + 280 * n * n) * (0.35 + 0.65 * edge);
        if (len < 3) continue;
        const src = Math.max(2, len * 0.3);
        D.drawImage(this.P, Math.round(x * S), Y, Math.ceil(sw * S), Math.round(src * S),
          Math.round(x * S), Y, Math.ceil(sw * S), Math.round(len * S));
      }
    },

    // ------------------------------------------------------------ analysis
    analyse(s, t, dt) {
      let kick = false, snare = false, hat = false;
      const b0 = s[0], b4 = s[4], b7 = (s[7] + s[8]) * 0.5;
      let landing = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) {
        kick = true; this.lastKick = t; this.kickCount++;
        // A full-strength kick after a stretch without one: the drop landing
        // (a build's kicks fade in below this, so it fires on the downbeat).
        if (b0 > 88) {
          if (t - (this.lastStrong == null ? -10 : this.lastStrong) > 3) { landing = true; this.kickCount = 1; }
          this.lastStrong = t;
        }
      }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; }
      if (b7 > 25 && b7 - (this.prev[7] + this.prev[8]) * 0.5 > 10 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      // Weighted by the kick's strength, so the fading-in kicks of a build don't
      // count as a drop and the headline changes when the drop actually lands.
      this.density = this.density * Math.exp(-dt / 2) + (kick ? Math.pow(b0 / 100, 2) : 0);
      const bass = Math.max(s[1], s[2] * 0.8) / 100;
      this.bassEnv += (bass - this.bassEnv) * (bass > this.bassEnv ? k(0.05) : k(0.35));
      const pad = (s[2] + s[3] + s[4]) / 300;
      this.padEnv += (pad - this.padEnv) * k(0.8);
      const target = smooth(2.2, 3.4, this.density);
      this.drop += (target - this.drop) * k(target > this.drop ? 0.35 : 1.6);
      return { kick, snare, hat, landing };
    },

    // ----------------------------------------------------------------- draw
    draw(p, signals, params, ctx) {
      const t = p.millis() / 1000;
      const dt = this.lastT == null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height;
      const pd = p.pixelDensity();
      const w = Math.round(p.width * pd), h = Math.round(p.height * pd);
      this.canvases(w, h);
      const S = w / W;
      const pr = PRINTS[clamp(Math.round(params.print) || 0, 0, PRINTS.length - 1)];
      this.groundCol = pr.ground;
      const corrupt = params.corrupt;
      const rng = this.rng;

      const ev = this.analyse(signals, t, dt);
      const drop = this.drop;

      // Headline: the next word arrives when the drop lands and every 32 kicks after.
      const words = this.words(params);
      const inDrop = drop > 0.5;
      if (ev.landing || this.wantNext || (inDrop && ev.kick && this.kickCount % 32 === 0)) {
        this.wordIdx = (this.wordIdx + 1) % words.length;
        this.wordT = t; this.wantNext = false;
        // Keep the outgoing poster: the transition drags it through the new one.
        if (!this.O) { this.O = document.createElement('canvas'); this.oc = this.O.getContext('2d'); }
        this.O.width = w; this.O.height = h;
        this.oc.drawImage(this.P, 0, 0);
      }
      const word = words[this.wordIdx % words.length];

      // 1. The clean poster.
      const L = this.layout(W, H);
      const pc = this.pc;
      pc.setTransform(S, 0, 0, S, 0, 0);
      this.drawPoster(pc, L, pr, t, word, drop, this.bassEnv);
      pc.setTransform(1, 0, 0, 1, 0, 0);

      // 2. Heal the display towards it. Slower in the drop so corruption
      // lingers; fast when the music thins so the poster reasserts itself.
      const D = this.dc;
      D.setTransform(1, 0, 0, 1, 0, 0);
      D.globalCompositeOperation = 'source-over';
      if (this.fresh) { D.globalAlpha = 1; D.drawImage(this.P, 0, 0); this.fresh = false; }
      const healRate = params.heal * lerp(14, 7, drop);
      D.globalAlpha = 1 - Math.exp(-dt * healRate);
      D.drawImage(this.P, 0, 0);
      D.globalAlpha = 1;
      // An 8-bit blend at this rate stalls a few levels short of the poster,
      // which left faint ghosts of old headlines on the paper. A refresh band
      // sweeping down the sheet every ~1.5 s writes the poster back exactly.
      {
        const bandH = Math.ceil(h * 0.06);
        const by = Math.floor(((t / 1.5) % 1) * (h + bandH)) - bandH;
        const y0 = Math.max(0, by), y1 = Math.min(h, by + bandH);
        if (y1 > y0) D.drawImage(this.P, 0, y0, w, y1 - y0, 0, y0, w, y1 - y0);
      }

      // 3. Spawn events.
      const anchors = this.anchors(L);
      if (ev.kick && corrupt > 0) {
        this.anchorIdx = (this.anchorIdx + 1 + Math.floor(rng() * 3)) % anchors.length;
        const a = anchors[this.anchorIdx];
        const sz = lerp(0.7, 1.3, drop) * lerp(0.6, 1, Math.min(1, corrupt));
        const ew = (a.big ? 250 : 190) * sz, eh = (a.big ? 110 : 80) * sz;
        this.events.push({ type: 'slab', t0: t, life: 0.3, x: a.x - ew / 2, y: a.y - eh / 2, w: ew, h: eh,
          n: 2 + Math.floor(rng() * 3), seed: rng() * 1000, amp: (30 + 50 * rng()) * corrupt * sz });
      }
      if (ev.snare && corrupt > 0) {
        const bh = (10 + rng() * 22) * lerp(0.7, 1.2, drop);
        this.events.push({ type: 'tear', t0: t, life: 0.24, y: rng() * (H - bh), h: bh,
          n: 2 + Math.floor(rng() * 3), seed: rng() * 1000, amp: (40 + 70 * rng()) * corrupt });
      }
      if (ev.hat && corrupt > 0) {
        const cnt = 1 + Math.floor(rng() * (2 + 2 * drop));
        for (let i = 0; i < cnt; i++) {
          const a = anchors[Math.floor(rng() * anchors.length)];
          const b = 8 + Math.floor(rng() * 3) * 4;
          this.events.push({ type: 'dead', t0: t, life: 0.08 + rng() * 0.12,
            x: a.x + (rng() - 0.5) * 260, y: a.y + (rng() - 0.5) * 120, b,
            col: [pr.accent, pr.second, pr.ink][Math.floor(rng() * 3)] });
        }
      }
      if (ev.hat && corrupt > 0 && rng() < 0.35) {
        const a = anchors[4 + Math.floor(rng() * (anchors.length - 4))];
        this.events.push({ type: 'slab', t0: t, life: 0.16, x: a.x - 45, y: a.y - 8 + (rng() - 0.5) * 20, w: 90 + rng() * 60, h: 10,
          n: 1, seed: rng() * 1000, amp: (8 + 16 * rng()) * corrupt, micro: true });
      }
      if (this.wordT === t) {
        const hd = L.head;
        this.events.push({ type: 'wordmosh', t0: t, life: 0.9, x: hd.x - 10, y: hd.y - 10, w: hd.w + 20, h: hd.h + 20, seed: rng() * 1000 });
      }
      if (this.wantCrash) {
        this.wantCrash = false;
        const hd = L.head;
        this.events.push({ type: 'wordmosh', crash: true, t0: t, life: 1.4, x: hd.x - 10, y: hd.y - 10, w: hd.w + 20, h: hd.h + 20, seed: rng() * 1000 });
        for (let i = 0; i < 4; i++) {
          this.events.push({ type: 'tear', t0: t + i * 0.09, life: 0.3, y: rng() * H * 0.9, h: 14 + rng() * 20, n: 3, seed: rng() * 1000, amp: 90 });
        }
      }

      // 4. Continuous corruption: datamosh zone (bass) and pixel-sort melt.
      const moshStr = params.mosh * corrupt * (this.bassEnv * lerp(10, 45, drop) + this.padEnv * 10);
      if (moshStr > 1) {
        const zw = lerp(170, 290, drop), zh = lerp(120, 190, drop);
        const zx = W * (0.5 + 0.42 * Math.sin(t * 0.071 + 1.3)) - zw / 2;
        const zy = H * (0.5 + 0.38 * Math.sin(t * 0.113)) - zh / 2;
        this.mosh(S, this.P, { x: zx, y: zy, w: zw, h: zh }, moshStr, t, W, H);
      }
      const meltAmt = params.melt * (0.12 + this.padEnv * 0.9 + this.bassEnv * 0.5 * (0.4 + drop)) * (0.5 + 0.5 * Math.min(corrupt, 1.5));
      if (meltAmt > 0.03) this.melt(S, L, meltAmt, t);

      // A slow tracking band always drifts down the sheet: the poster is never
      // quite still, even in the silence.
      {
        const ty = ((t * 38) % (H + 60)) - 30;
        const off = 3 + 5 * this.padEnv + 6 * drop;
        for (let i = 0; i < 3; i++) {
          const yy = ty + i * 4;
          if (yy < 0 || yy > H - 3) continue;
          const dxx = Math.round(Math.sin(t * 9 + i * 2) * off * S);
          D.drawImage(this.P, 0, Math.round(yy * S), w, Math.round(3 * S), dxx, Math.round(yy * S), w, Math.round(3 * S));
        }
      }

      // 5. Run the events.
      const keep = [];
      for (const e of this.events) {
        const age = t - e.t0;
        if (age < 0) { keep.push(e); continue; }
        if (age > e.life) continue;
        keep.push(e);
        const u = age / e.life;
        // Stepped decay: glitches jump between states rather than easing.
        const step = u < 0.3 ? 1 : u < 0.6 ? 0.55 : u < 0.85 ? 0.2 : 0;
        if (e.type === 'slab') {
          const sh = e.h / e.n;
          for (let i = 0; i < e.n; i++) {
            const dir = hash(e.seed + i) < 0.5 ? -1 : 1;
            const dx = dir * e.amp * (0.3 + 0.7 * hash(e.seed + i * 7)) * step;
            if (Math.abs(dx) < 0.5) continue;
            this.splitSlice(S, e.x, e.y + i * sh, e.w, sh, dx, 3 + 4 * step, false);
          }
          if (!e.micro) this.blocks(S, e.x, e.y, e.w, e.h, 12, 0.45 * step, e.seed, pr);
        } else if (e.type === 'tear') {
          const sh = e.h / e.n;
          for (let i = 0; i < e.n; i++) {
            const dx = (hash(e.seed + i * 3) - 0.5) * 2 * e.amp * step;
            if (Math.abs(dx) < 0.5) continue;
            this.splitSlice(S, 0, e.y + i * sh, W, sh, dx, 5 * step, true);
          }
        } else if (e.type === 'dead') {
          D.fillStyle = e.col;
          D.fillRect(Math.round(e.x * S), Math.round(e.y * S), Math.ceil(e.b * S), Math.ceil(e.b * S));
        } else if (e.type === 'wordmosh') {
          const f = 1 - u;
          if (e.crash || !this.O) this.mosh(S, this.P, { x: e.x - e.w * 0.1, y: e.y - e.h * 0.2, w: e.w * 1.2, h: e.h * 1.4 }, 40 * f, t, W, H, 20);
          else this.mosh(S, this.O, { x: e.x - e.w * 0.1, y: e.y - e.h * 0.2, w: e.w * 1.2, h: e.h * 1.4 }, 12 + 30 * u, t, W, H, 20, f * 1.1);
          this.blocks(S, e.x, e.y, e.w, e.h, 16, 0.55 * f * f, e.seed + Math.floor(age * 12), pr);
        }
      }
      this.events = keep.length > 120 ? keep.slice(-120) : keep;

      // 6. Present.
      const out = p.drawingContext;
      out.save();
      out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
      out.imageSmoothingEnabled = true;
      out.drawImage(this.D, 0, 0, ctx.width, ctx.height);
      out.restore();
    },
  });
})();
