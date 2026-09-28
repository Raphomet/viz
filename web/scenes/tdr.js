// Republic: a techno-consumerist poster in the manner of The Designers
// Republic (Sheffield, late 1980s to 2000s: Warp sleeves, Wipeout, Pop Will
// Eat Itself). What is borrowed is the grammar: a strict visible grid, dense
// English-and-Japanese sloganeering, invented corporate marks, pictograms,
// microscopic data type, registration marks, acid on cool grey. Every mark,
// slogan, company and pictogram here is invented for this piece; none of the
// studio's own marks, slogans or clients appear.
//
// The sheet is one 12 x 12 grid and every module sits on it:
//   header      an invented trading company, a running timecode
//   headline    two enormous wide monospaced words with a Japanese line under
//               them (LOW END / 低音専門), re-set by split-flap every phrase
//   mark block  an acid panel carrying an invented corporate mark that turns,
//               a katakana column scrolling down its edge
//   pictograms  a black strip of invented pictograms, each numbered and named
//   data        a table of fake readouts and a barcode
//   dial        a registration-style roundel with a sweeping hand
//   goods       a numbered catalogue of the night's "products", scrolling up
//   footer      a ticker of slogans
//
// Music, each in its own place:
//   kick   one pictogram cell floods acid and its pictogram flips to ink, and
//          the dial's centre fills; the lit cell walks along the strip
//   clap   an inspection stamp (検品済 CHECKED) slams onto the lower modules and
//          the next line of the goods catalogue is highlighted: a different
//          gesture from the kick, in a different place
//   hats   digits in the data table and bits of the barcode flip
//   bass   ticker, katakana and catalogue scroll speed, the dial's sweep,
//          the battery pictogram's charge
//   drop   the headline panel is wiped to ink with acid type, a second ink
//          overprints the headline off-register, a hazard stripe runs under
//          the header, a NEW sticker is slapped on, the pictogram strip starts
//          to march; the breakdown wipes it all back and the acid pales
// Printed look: flat offset inks on grey stock, hairline grid, crop and
// registration marks, a fine paper grain. No glow.

(function () {
  const SCHEMES = [
    { name: 'Acid / grey', bg: '#C3C5C1', ink: '#121314', acid: '#DAF01E', second: '#10A4DC', pale: '#D2D4CF', mult: true },
    { name: 'Night display', bg: '#1B1C1D', ink: '#E6E6E0', acid: '#D6F21A', second: '#FF4F98', pale: '#2A2B2C', mult: false },
    { name: 'Chrome / orange', bg: '#D8DCDF', ink: '#181B22', acid: '#FF6B12', second: '#3450F0', pale: '#E4E7E9', mult: true },
    { name: 'Pink alert', bg: '#BCBEBF', ink: '#111111', acid: '#FF5A9E', second: '#CFEA12', pale: '#CDCFD0', mult: true },
  ];

  const DEFAULT_SLOGANS = 'LOW/END/低音専門 | BUY/NIGHT/夜を買う | MORE/KICK/新型キック搭載 | DANCE/UNIT/踊る装置 | FEEL/INC./感覚株式会社 | SUB/WAVE/重低音 | STAY/AWAKE/眠らない街 | HZ/HZ/HZ/周波数';

  const MARKS = [
    { a: 'LOWEND', b: 'KOGYO', jp: '低音工業', reg: 'REG.NO.0041-8812' },
    { a: 'NOCTO', b: 'SYSTEMS', jp: '夜間システム', reg: 'LIC.77/NX-03' },
    { a: 'HZ+', b: 'SUPPLY', jp: '周波数供給', reg: 'CERT.124.00' },
  ];

  const PICTS = [
    'SPEAKER', 'OBSERVE', 'DANCE', 'NIGHT', 'POWER', 'CONNECT', 'ASCEND', 'PLAY',
    'CHARGE', 'SMILE', 'WAVE', 'SHINE', 'HYDRATE',
  ];

  const GOODS = [
    'BASS, PREMIUM GRADE', 'NIGHT (EXTENDED)', 'KICK DRUM ×4', 'SILENCE — DISCONTINUED',
    'DANCE FLOOR, LEASED', 'LIGHT, NON-STROBE', 'SUB 40HZ, BULK', 'SWEAT, ORGANIC',
    'EUPHORIA (TRIAL)', 'SLEEP — OUT OF STOCK', 'CROWD, ASSEMBLED', 'HANDS, RAISED ×2',
    'SUNRISE (DELAYED)', 'LOOP, INFINITE',
  ];
  const GOODS_JP = ['低音', '夜', '太鼓', '静寂', '床', '光', '重低音', '汗', '快楽', '睡眠', '群衆', '手', '日の出', '反復'];

  const COPY = [
    'SOUND IS NOW AVAILABLE IN BLACK', '夜は終わらない', 'YOUR BODY IS A RECEIVER',
    'PLEASE REMAIN ON THE FLOOR', '低音は無料です', 'THIS RHYTHM HAS BEEN APPROVED',
    'ALL FEELINGS ARE SYNTHETIC', 'もっと踊ろう', 'DO NOT ADJUST YOUR SPEAKERS',
    'THE LIGHTS ARE PART OF THE PRODUCT', 'NIGHT SHIFT BEGINS NOW', '音を信じて',
  ];
  const TICKER = 'NOW WITH MORE LOW END ◆ 踊ってください ◆ PLEASE ENJOY THE FREQUENCY ◆ 新発売 ◆ THE NIGHT IS A PRODUCT ◆ 100% SYNTHETIC FEELING ◆ 音響システム ◆ CONSUME RHYTHM DAILY ◆ ';
  const KATA = 'サウンド・システム・ダンス・ナイト・ベース・リズム・フロア・ループ・';
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&+';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const GOLD = 0.6180339887;

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, u) { const A = hexRgb(a), B = hexRgb(b); return 'rgb(' + (lerp(A[0], B[0], u) | 0) + ',' + (lerp(A[1], B[1], u) | 0) + ',' + (lerp(A[2], B[2], u) | 0) + ')'; }
  function face(fam, fb) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fb;
  }
  const JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';

  function parseSlogans(str) {
    const out = String(str || '').split('|').map((chunk) => {
      const parts = chunk.split('/').map((x) => x.trim()).filter((x) => x.length);
      if (!parts.length) return null;
      // Latin lines first, the last part is the Japanese line when it has any non-ASCII.
      let jp = '';
      if (parts.length > 1 && /[^\x00-\x7F]/.test(parts[parts.length - 1])) jp = parts.pop();
      return { lines: parts.slice(0, 3).map((x) => x.toUpperCase()), jp };
    }).filter(Boolean);
    return out.length ? out : [{ lines: ['LOW', 'END'], jp: '低音専門' }];
  }

  // ---------- pictograms: each drawn in a unit box centred at (0,0), size 1
  function pict(g, id, col, ph, charge) {
    g.fillStyle = col; g.strokeStyle = col;
    g.lineWidth = 0.075; g.lineCap = 'butt'; g.lineJoin = 'miter';
    g.beginPath();
    switch (id) {
      case 0: // speaker
        g.rect(-0.38, -0.14, 0.16, 0.28); g.fill();
        g.beginPath(); g.moveTo(-0.22, -0.14); g.lineTo(0.02, -0.34); g.lineTo(0.02, 0.34); g.lineTo(-0.22, 0.14); g.closePath(); g.fill();
        for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(0.05, 0, 0.16 + i * 0.14, -0.7, 0.7); g.stroke(); }
        break;
      case 1: // eye
        g.moveTo(-0.42, 0); g.quadraticCurveTo(0, -0.34, 0.42, 0); g.quadraticCurveTo(0, 0.34, -0.42, 0); g.closePath(); g.stroke();
        g.beginPath(); g.arc(Math.sin(ph) * 0.08, 0, 0.12, 0, Math.PI * 2); g.fill();
        break;
      case 2: { // dancing figure; limbs swap on each beat
        const a = ph > 0.5 ? 1 : -1;
        g.arc(0, -0.3, 0.09, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(0, -0.2); g.lineTo(0, 0.08);
        g.moveTo(0, -0.12); g.lineTo(0.26 * a, -0.36);
        g.moveTo(0, -0.12); g.lineTo(-0.24 * a, 0.0);
        g.moveTo(0, 0.08); g.lineTo(0.2 * a, 0.38);
        g.moveTo(0, 0.08); g.lineTo(-0.16 * a, 0.36); g.stroke();
        break;
      }
      case 3: // crescent moon + dot star
        g.arc(-0.02, 0, 0.3, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(0.12, -0.08, 0.26, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.beginPath(); g.rect(0.26, 0.18, 0.08, 0.08); g.fill();
        break;
      case 4: // bolt
        g.moveTo(0.08, -0.42); g.lineTo(-0.2, 0.04); g.lineTo(-0.01, 0.04); g.lineTo(-0.08, 0.42); g.lineTo(0.22, -0.06); g.lineTo(0.03, -0.06); g.closePath(); g.fill();
        break;
      case 5: // plug
        g.rect(-0.18, -0.12, 0.36, 0.26); g.fill();
        g.beginPath(); g.rect(-0.12, -0.34, 0.07, 0.22); g.rect(0.05, -0.34, 0.07, 0.22); g.fill();
        g.beginPath(); g.moveTo(0, 0.14); g.lineTo(0, 0.42); g.stroke();
        break;
      case 6: // arrow up
        g.moveTo(0, -0.4); g.lineTo(0.3, -0.06); g.lineTo(0.1, -0.06); g.lineTo(0.1, 0.38); g.lineTo(-0.1, 0.38); g.lineTo(-0.1, -0.06); g.lineTo(-0.3, -0.06); g.closePath(); g.fill();
        break;
      case 7: // record
        g.arc(0, 0, 0.36, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(0, 0, 0.12, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(0, 0, 0.25, ph * 6.28, ph * 6.28 + 1.2); g.stroke();
        break;
      case 8: // battery, charge follows the bass
        g.lineWidth = 0.06; g.strokeRect(-0.36, -0.18, 0.66, 0.36);
        g.fillRect(0.3, -0.08, 0.07, 0.16);
        g.fillRect(-0.3, -0.12, 0.54 * clamp(charge, 0.05, 1), 0.24);
        break;
      case 9: // robot face
        g.lineWidth = 0.07; g.strokeRect(-0.3, -0.3, 0.6, 0.6);
        g.fillRect(-0.16, -0.1, 0.09, 0.09); g.fillRect(0.07, -0.1, 0.09, 0.09);
        g.fillRect(-0.16, 0.1, 0.32, 0.05);
        g.fillRect(-0.03, -0.42, 0.06, 0.12);
        break;
      case 10: // wave
        g.moveTo(-0.42, 0);
        for (let i = 0; i <= 24; i++) { const x = -0.42 + i * 0.035; g.lineTo(x, Math.sin(i * 0.55 + ph * 6.28) * 0.2); }
        g.stroke();
        break;
      case 11: // burst
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const r0 = i % 2 ? 0.16 : 0.1; g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 0.4, Math.sin(a) * 0.4); }
        g.stroke();
        break;
      default: // cup
        g.moveTo(-0.24, -0.3); g.lineTo(0.24, -0.3); g.lineTo(0.16, 0.36); g.lineTo(-0.16, 0.36); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(-0.21, -0.06); g.lineTo(0.21, -0.06); g.lineTo(0.16, 0.36); g.lineTo(-0.16, 0.36); g.closePath(); g.fill();
    }
  }

  // ---------- invented corporate marks, unit radius
  function mark(g, id, ink, bg, rot) {
    g.save(); g.rotate(rot);
    g.fillStyle = ink; g.strokeStyle = ink;
    if (id === 0) {
      // ring with three bars and a notch cut out of it
      g.lineWidth = 0.2; g.beginPath(); g.arc(0, 0, 0.88, 0.35, Math.PI * 2 - 0.35); g.stroke();
      for (let i = -1; i <= 1; i++) g.fillRect(-0.55 + Math.abs(i) * 0.1, i * 0.26 - 0.08, 1.2 - Math.abs(i) * 0.2, 0.16);
    } else if (id === 1) {
      g.rotate(Math.PI / 4);
      g.fillRect(-0.68, -0.68, 1.36, 1.36);
      g.fillStyle = bg; g.beginPath(); g.arc(0, 0, 0.44, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.fillRect(-0.44, -0.07, 0.88, 0.14);
      g.fillStyle = bg; g.fillRect(0.68 - 0.3, -0.68, 0.3, 0.3);
    } else {
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; g.beginPath(); g.arc(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.24, 0, Math.PI * 2); g.fill(); }
      g.lineWidth = 0.12; g.beginPath(); g.arc(0, 0, 0.92, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.beginPath(); g.arc(0, 0, 0.92, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    g.restore();
  }

  function regMark(g, x, y, r, ink) {
    g.strokeStyle = ink; g.lineWidth = 0.6;
    g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2);
    g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
  }

  VIZ.register({
    id: 'tdr',
    name: 'Republic',
    order: 522,

    params: [
      { key: 'scheme', label: 'Inks', type: 'select', options: SCHEMES.map((s) => s.name), default: 0 },
      { key: 'slogans', label: 'Slogans ( / new line, last line Japanese, | next )', type: 'text', default: DEFAULT_SLOGANS },
      { key: 'speed', label: 'Scroll speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'density', label: 'Data density', type: 'select', options: ['Sparse', 'Standard', 'Saturated'], default: 1 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'grain', label: 'Print grain', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],

    actions: [
      { id: 'next', label: 'Next slogan', run() { this.wantNext = true; } },
    ],

    gallery: {
      title: 'Republic',
      technique: 'Canvas 2D on a strict 12 x 12 module grid. Wide monospaced headline (Rubik Mono One) re-set with a per-letter split-flap scramble; Space Mono data type; system Japanese gothic; invented pictograms and corporate marks drawn as paths; a clip-rect wipe inverts the headline panel for the drop with a multiply-overprinted second ink; transient detection on bands 0, 4 and 7 with re-arm hysteresis drives a walking pictogram cell, inspection stamps and flipping digits; a pre-generated paper grain tile multiplied over the sheet.',
      brief: 'A cool grey techno-consumerist poster running like a machine display. Two enormous wide words (LOW END, BUY NIGHT, MORE KICK, FEEL INC.) with a Japanese line beneath, an acid panel carrying an invented corporate mark (LOWEND KOGYO 低音工業, NOCTO SYSTEMS, HZ+ SUPPLY) with katakana streaming down its edge, a black strip of numbered pictograms, a data table and barcode, a registration roundel, a catalogue of the night\'s goods (SILENCE — DISCONTINUED, SLEEP — OUT OF STOCK) and a slogan ticker. Each kick floods one pictogram cell acid and fills the roundel\'s eye, the lit cell walking along the strip; each clap slams an inspection stamp (検品済 CHECKED) onto the lower modules and highlights the next item in the catalogue; hats flip digits; the bass sets the speed of every scroll. The drop wipes the headline panel to ink with acid letters and a second ink printed off-register, runs a hazard stripe, slaps on a NEW sticker and sets the pictograms marching; the breakdown wipes it back and pales the acid.',
      lineage: 'In the manner of The Designers Republic (Sheffield, from 1986): Warp and Pop Will Eat Itself sleeves, the Wipeout identities, the techno-consumerist satire of logos, slogans and packaging copy, Japanese-English sloganeering, microscopic data type, pictograms, registration marks and a strict visible grid in acid and grey. Every mark, company, slogan, pictogram and product line here is invented (SUBSONIC TRADING CO., LOWEND KOGYO, NOCTO SYSTEMS, HZ+ SUPPLY, BUY NIGHT, SLEEP — OUT OF STOCK); none of the studio\'s own marks or slogans, nor any real brand, appears. Process: read the batch brief, TASTE and the contract; laid every module on one 12 x 12 grid so the machine-display motion (tickers, katakana, catalogue, typed copy, barcode) runs inside fixed cells; gave the kick a single walking pictogram cell, the roundel\'s eye and a mark that clicks a twelfth of a turn, and the clap an inspection stamp and a catalogue highlight, so the two drums land as different gestures in different places. Iterations at 640x360: the headline filled only a third of its panel, so short words are now stretched wide and a typed terminal column of copy fills the rest; the drop wipe started in the late build, so the energy follower was retuned to fire on the drop\'s bass line rather than the build\'s kick; the NEW sticker was drawn under the mark panel and then over its brand name, and now sits on the seam; the kick flash was held for five frames because it read as olive at its decay; density Saturated gained a security-print field of micro copy. Jolt meter (seed 1, 640x360): calm, drop kickArea 0.10, ratio 1.5; build kick area 0.06.',
    },

    setup() { this.init(); },
    enter() { if (!this.inited) this.init(); },

    init() {
      this.inited = true;
      this.lastT = null;
      this.kArm = true; this.sArm = true; this.hArm = true;
      this.kicks = 0; this.kickT = -9; this.snares = 0; this.snareT = -9; this.hats = 0;
      this.energy = 0; this.drop = 0; this.bass = 0;
      this.scroll = 0; this.sweep = 0; this.stripX = 0; this.typed = 40;
      this.slogan = 0; this.sloganT = -9; this.prevSlogan = 0; this.lastChange = 0;
      this.stamps = []; this.markStep = 0; this.markRot = 0;
      this.grainTile = null;
      this.wantNext = false;
    },

    analyse(s, t, dt) {
      const k = s[0], sn = s[4], h = s[7];
      if (k < 35) this.kArm = true;
      if (this.kArm && k > 55) {
        this.kArm = false; this.kicks++; this.kickT = t; this.markStep += 1;
        // A phrase is sixteen kicks; re-set the headline on the phrase line.
        if (this.kicks % 16 === 0) this.nextSlogan(t);
      }
      if (sn < 30) this.sArm = true;
      if (this.sArm && sn > 50 && t - this.snareT > 0.2) {
        this.sArm = false; this.snares++; this.snareT = t;
        const n = this.snares;
        this.stamps.push({ t, slot: Math.floor(hash(n * 3.7) * 6), rot: (hash(n * 9.1) - 0.5) * 0.35, n, kind: n % 3 });
        if (this.stamps.length > 5) this.stamps.shift();
      }
      if (h < 25) this.hArm = true;
      if (this.hArm && h > 40) { this.hArm = false; this.hats++; }

      // Slow energy: the kick and bass line averaged over about a second.
      const e = (s[0] * 0.5 + s[1] * 0.5 + s[2] * 0.25);
      this.energy += (e - this.energy) * (1 - Math.exp(-dt / 0.5));
      const target = smooth(28, 44, this.energy);
      this.drop += (target - this.drop) * (1 - Math.exp(-dt / (target > this.drop ? 0.3 : 1.1)));
      const b = (s[0] + s[1] + s[2]) / 300;
      this.bass += (b - this.bass) * (1 - Math.exp(-dt / 0.35));
      // No music at all for a while: keep the headline changing on the clock.
      if (t - this.lastChange > 16) this.nextSlogan(t);
      if (this.wantNext) { this.wantNext = false; this.nextSlogan(t); }
    },

    nextSlogan(t) {
      this.prevSlogan = this.slogan;
      this.slogan++;
      this.sloganT = t; this.lastChange = t;
    },

    grain(g) {
      if (this.grainTile) return this.grainTile;
      const c = document.createElement('canvas'); c.width = c.height = 192;
      const x = c.getContext('2d'); const im = x.createImageData(192, 192);
      for (let i = 0; i < 192 * 192; i++) {
        const v = hash(i * 0.731 + 5.1);
        const w = v > 0.985 ? 150 : 205 + hash(i * 1.37) * 50;
        im.data[i * 4] = w; im.data[i * 4 + 1] = w; im.data[i * 4 + 2] = w; im.data[i * 4 + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      this.grainTile = g.createPattern(c, 'repeat');
      return this.grainTile;
    },

    draw(p, s, params, ctx) {
      if (!this.inited) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      this.analyse(s, t, dt);

      const W = ctx.width, H = ctx.height;
      const R = params.reaction;
      const sc = SCHEMES[clamp(Math.round(params.scheme), 0, SCHEMES.length - 1)];
      const dens = clamp(Math.round(params.density), 0, 2);
      const spd = params.speed;
      const drop = this.drop;
      const slogans = parseSlogans(params.slogans);

      // Scrolls integrate a bass-driven speed, so the music changes their pace, never jerks them.
      const pace = spd * (0.35 + 1.4 * this.bass + 0.5 * drop);
      this.scroll += dt * pace;
      this.sweep += dt * spd * (0.25 + 2.2 * this.bass);
      this.stripX += dt * spd * drop * 0.55;
      this.typed += dt * pace * 16;

      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';

      const WIDE = face('Rubik Mono One', '"Arial Black", Arial, sans-serif');
      const MONO = face('Space Mono', '"Courier New", monospace');
      const COND = face('Bebas Neue', '"Arial Narrow", Arial, sans-serif');

      // The acid pales in the breakdown and before the music arrives.
      const acidLive = mix(sc.pale, sc.acid, 0.55 + 0.45 * smooth(0, 0.6, Math.max(drop, this.energy / 30)));

      // ---------- ground
      g.fillStyle = sc.bg; g.fillRect(0, 0, W, H);

      // ---------- grid
      const M = Math.max(14, Math.min(W, H) * 0.032), gut = Math.min(W, H) * 0.011;
      const cw = (W - 2 * M - 11 * gut) / 12, rh = (H - 2 * M - 11 * gut) / 12;
      const G = (c, r, cs, rs) => ({ x: M + c * (cw + gut), y: M + r * (rh + gut), w: cs * cw + (cs - 1) * gut, h: rs * rh + (rs - 1) * gut });

      // hairline column guides across the whole sheet
      g.strokeStyle = mix(sc.bg, sc.ink, 0.13); g.lineWidth = 0.5;
      g.beginPath();
      for (let c = 0; c <= 12; c++) { const x = M + c * (cw + gut) - gut / 2; g.moveTo(x, M * 0.5); g.lineTo(x, H - M * 0.5); }
      g.stroke();
      // crop and registration marks in the margin
      g.strokeStyle = sc.ink; g.lineWidth = 0.6; g.beginPath();
      [[M, M], [W - M, M], [M, H - M], [W - M, H - M]].forEach(([x, y]) => {
        const sx = x < W / 2 ? -1 : 1, sy = y < H / 2 ? -1 : 1;
        g.moveTo(x + sx * 3, y); g.lineTo(x + sx * M * 0.8, y);
        g.moveTo(x, y + sy * 3); g.lineTo(x, y + sy * M * 0.8);
      });
      g.stroke();
      regMark(g, W / 2, M * 0.5, M * 0.32, sc.ink);
      regMark(g, W / 2, H - M * 0.5, M * 0.32, sc.ink);

      const text = (str, x, y, font, col, align) => { g.font = font; g.fillStyle = col; g.textAlign = align || 'left'; g.fillText(str, x, y); };
      const micro = Math.max(5.5, Math.min(rh * 0.2, cw * 0.14));

      // ---------- header (row 0)
      {
        const b = G(0, 0, 12, 1);
        text('SUBSONIC TRADING CO.', b.x, b.y + b.h * 0.46, '400 ' + (b.h * 0.34).toFixed(1) + 'px ' + WIDE, sc.ink);
        text('低周波通商株式会社 · DIV.07 · NIGHT OPERATIONS · ISSUE 124', b.x, b.y + b.h * 0.78, '700 ' + micro.toFixed(1) + 'px ' + JP, sc.ink);
        const tc = Math.floor(t * 30);
        const hh = String(Math.floor(tc / 108000) % 24).padStart(2, '0'), mm = String(Math.floor(tc / 1800) % 60).padStart(2, '0');
        const ss = String(Math.floor(tc / 30) % 60).padStart(2, '0'), ff = String(tc % 30).padStart(2, '0');
        text('T+ ' + hh + ':' + mm + ':' + ss + ':' + ff, b.x + b.w, b.y + b.h * 0.46, '700 ' + (b.h * 0.3).toFixed(1) + 'px ' + MONO, sc.ink, 'right');
        text('BEAT ' + String(this.kicks).padStart(5, '0') + ' / CLAP ' + String(this.snares).padStart(4, '0') + ' / 営業中', b.x + b.w, b.y + b.h * 0.78, '400 ' + micro.toFixed(1) + 'px ' + MONO, sc.ink, 'right');
        // rule, or in the drop a hazard stripe that runs
        const ry = b.y + b.h + gut * 0.5;
        g.fillStyle = sc.ink; g.fillRect(b.x, ry - 1, b.w, 2);
        if (drop > 0.02) {
          const hh2 = gut * 1.1 + 5;
          const wv = b.w * smooth(0, 0.7, drop);
          g.save(); g.beginPath(); g.rect(b.x, ry + 1, wv, hh2); g.clip();
          g.fillStyle = sc.ink; g.fillRect(b.x, ry + 1, wv, hh2);
          g.fillStyle = acidLive;
          const step = hh2 * 1.6, off = (this.scroll * 40) % step;
          g.beginPath();
          for (let x = b.x - step * 2 + off; x < b.x + wv + step; x += step) {
            g.moveTo(x, ry + 1 + hh2); g.lineTo(x + step * 0.5, ry + 1 + hh2); g.lineTo(x + step * 0.5 + hh2, ry + 1); g.lineTo(x + hh2, ry + 1); g.closePath();
          }
          g.fill(); g.restore();
        }
      }

      // ---------- headline (cols 0-8, rows 1-5)
      {
        const b = G(0, 1, 9, 5);
        const y0 = b.y + gut * 1.6;
        const bh = b.h - gut * 1.6;
        const cur = slogans[this.slogan % slogans.length];
        const age = t - this.sloganT;
        const nL = Math.max(2, cur.lines.length);
        const maxChars = Math.max(3, ...cur.lines.map((l) => l.length));
        // Rubik Mono One is monospaced: an advance of ~0.83 em.
        g.font = '400 100px ' + WIDE;
        const adv = g.measureText('M').width / 100;
        const topPad = bh * 0.14, jpH = bh * 0.2;
        const fs = Math.min((b.w - 8) / (maxChars * adv), (bh - topPad - jpH) / (nL * 0.86));
        // Short words leave the panel half empty at full height, so the type is
        // stretched wide (as the period's wide faces were) to about two thirds.
        const natW = maxChars * adv * fs;
        const sx = clamp((b.w * 0.64) / natW, 1, 1.75);
        const headR = b.x + natW * sx;
        const drawHead = (col, ox, oy) => {
          g.font = '400 ' + fs.toFixed(1) + 'px ' + WIDE; g.fillStyle = col; g.textAlign = 'left';
          cur.lines.forEach((line, li) => {
            const by = y0 + topPad + fs * 0.74 + li * fs * 0.86 + oy;
            for (let i = 0; i < line.length; i++) {
              let ch = line[i];
              const settle = 0.12 + i * 0.05 + li * 0.1;
              if (age < settle && ch !== ' ') ch = GLYPHS[Math.floor(hash(Math.floor(t * 20) + i * 7.3 + li * 3.1) * GLYPHS.length)];
              g.save(); g.translate(b.x + ox + i * fs * adv * sx, by); g.scale(sx, 1); g.fillText(ch, 0, 0); g.restore();
            }
          });
        };
        const drawRest = (col, sub) => {
          // caption line above, JP line below
          text('PRODUCT LINE ' + String((this.slogan % slogans.length) + 1).padStart(2, '0') + '/' + String(slogans.length).padStart(2, '0') + '  ———  ORIGINAL SPECIFICATION  ———  ' + (cur.lines.join(' ')) + '™', b.x, y0 + micro * 1.2, '400 ' + micro.toFixed(1) + 'px ' + MONO, col);
          const jy = y0 + topPad + nL * fs * 0.86 + jpH * 0.62;
          if (cur.jp) text(cur.jp, b.x, jy, '800 ' + (jpH * 0.62).toFixed(1) + 'px ' + JP, col);
          text('NET CONTENTS: 1 NIGHT / 夜 · BATCH ' + String(this.slogan * 37 % 1000).padStart(3, '0'), b.x + b.w, jy, '400 ' + micro.toFixed(1) + 'px ' + MONO, sub, 'right');
        };
        // A column of copy typed out like a terminal beside the headline.
        const copyCol = (col) => {
          const cx0 = headR + gut * 2.5, cwid = b.x + b.w - 6 - cx0;
          if (cwid < 50 || dens === 0) return;
          const fsz = Math.max(micro * 1.2, Math.min(cwid / 24, bh * 0.055));
          const lh = fsz * 1.45;
          const top = y0 + topPad, bot = y0 + topPad + nL * fs * 0.86 - fsz * 0.2;
          const nLines = Math.max(1, Math.floor((bot - top) / lh));
          // Walk the copy from the start of the previous cycle only, so the
          // cost stays flat however long the set runs.
          const cyc = COPY.reduce((a, l) => a + l.length + 6, 0);
          const full = Math.floor(this.typed / cyc);
          let rem = this.typed - Math.max(0, full - 1) * cyc, li = 0;
          const nOff = Math.max(0, full - 1) * COPY.length;
          const done = [];
          while (true) {
            const ln = COPY[li % COPY.length];
            const need = ln.length + 6;
            if (rem < need) { done.push(ln.slice(0, Math.min(ln.length, Math.floor(rem)))); break; }
            done.push(ln); rem -= need; li++;
          }
          const shown = done.slice(-nLines);
          const base = done.length - shown.length;
          g.font = '400 ' + fsz.toFixed(1) + 'px ' + MONO + ', ' + JP; g.fillStyle = col; g.textAlign = 'left';
          shown.forEach((ln, i) => {
            const y = top + fsz + i * lh;
            const n = nOff + base + i;
            g.fillText(String(n % 100).padStart(2, '0') + ' ' + ln, cx0, y);
            if (i === shown.length - 1 && Math.floor(t * 3) % 2 === 0) {
              const w = g.measureText(String(n % 100).padStart(2, '0') + ' ' + ln).width;
              g.fillRect(cx0 + w + 2, y - fsz * 0.8, fsz * 0.55, fsz * 0.95);
            }
          });
        };
        // Saturated density prints a security-style field of micro copy behind the headline.
        const field = (col) => {
          if (dens < 2) return;
          const fz = micro * 0.95, lh = fz * 1.25;
          g.font = '400 ' + fz.toFixed(1) + 'px ' + MONO + ', ' + JP; g.fillStyle = col; g.textAlign = 'left';
          const unitStr = 'SUBSONIC◆低音◆124◆NIGHT◆周波数◆';
          const uw = g.measureText(unitStr).width;
          const line = unitStr.repeat(Math.ceil(b.w / uw) + 2);
          for (let i = 0, y = b.y + lh; y < b.y + b.h; i++, y += lh) {
            const off = ((this.scroll * 12 * (i % 2 ? 1 : -1) + i * 37) % uw + uw) % uw;
            g.fillText(line, b.x - off, y);
          }
        };
        // normal state
        g.fillStyle = sc.bg; g.fillRect(b.x, b.y, b.w, b.h);
        g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip(); field(mix(sc.bg, sc.ink, 0.16)); g.restore();
        g.strokeStyle = sc.ink; g.lineWidth = 0.6; g.strokeRect(b.x, b.y, b.w, b.h);
        drawHead(sc.ink, 0, 0); drawRest(sc.ink, sc.ink); copyCol(sc.ink);
        // drop: the panel is wiped to ink with acid type and a second ink off-register
        const wv = smooth(0.05, 0.85, drop);
        if (wv > 0.001) {
          g.save(); g.beginPath(); g.rect(b.x, b.y, b.w * wv, b.h); g.clip();
          g.fillStyle = sc.ink; g.fillRect(b.x, b.y, b.w, b.h); field(mix(sc.ink, sc.bg, 0.14));
          g.globalAlpha = 0.95; drawHead(sc.second, fs * 0.05, fs * 0.04); g.globalAlpha = 1;
          drawHead(acidLive, 0, 0); drawRest(acidLive, sc.bg); copyCol(sc.bg);
          g.restore();
        }
        this.stk = { cx: b.x + b.w + gut / 2, top: b.y, r: Math.min(b.h * 0.2, b.w * 0.1) };
      }

      // ---------- mark block (cols 9-11, rows 1-7): acid panel
      {
        const b = G(9, 1, 3, 7);
        g.fillStyle = acidLive; g.fillRect(b.x, b.y, b.w, b.h);
        const mk = MARKS[Math.floor(this.slogan / 2) % MARKS.length];
        const colW = Math.max(micro * 1.6, b.w * 0.12);
        const iw = b.w - colW;
        text('AUTHORISED PRODUCT', b.x + 6, b.y + micro * 1.6, '400 ' + micro.toFixed(1) + 'px ' + MONO, sc.ink);
        text('正規品', b.x + 6, b.y + micro * 3, '700 ' + micro.toFixed(1) + 'px ' + JP, sc.ink);
        const r = Math.min(iw * 0.36, b.h * 0.2);
        g.save(); g.translate(b.x + iw / 2, b.y + b.h * 0.34); g.scale(r, r);
        // The mark clicks round a twelfth of a turn on each kick, like a dial
        // indexing, and eases into place; the slow drift between belongs to the bass.
        this.markRot += (this.markStep * Math.PI / 6 * clamp(R, 0, 2) - this.markRot) * (1 - Math.exp(-dt / 0.06));
        mark(g, Math.floor(this.slogan / 2) % MARKS.length, sc.ink, acidLive, this.markRot + this.sweep * 0.12);
        g.restore();
        const ny = b.y + b.h * 0.34 + r * 1.35;
        const nfs = Math.min(iw * 0.9 / (Math.max(mk.a.length, mk.b.length) * 0.83), b.h * 0.07);
        text(mk.a, b.x + 6, ny + nfs, '400 ' + nfs.toFixed(1) + 'px ' + WIDE, sc.ink);
        text(mk.b, b.x + 6, ny + nfs * 2.05, '400 ' + nfs.toFixed(1) + 'px ' + WIDE, sc.ink);
        text(mk.jp, b.x + 6, ny + nfs * 2.05 + nfs * 1.15, '800 ' + (nfs * 0.8).toFixed(1) + 'px ' + JP, sc.ink);
        g.fillStyle = sc.ink; g.fillRect(b.x + 6, ny + nfs * 3.6, iw - 12, 1.2);
        const regLines = [mk.reg, 'EST. 00:00 / 閉店なし', 'QC ' + String(Math.floor(hash(this.hats) * 9999)).padStart(4, '0') + '-' + (this.hats % 100)];
        regLines.forEach((l, i) => text(l, b.x + 6, ny + nfs * 3.6 + micro * (1.5 + i * 1.25), '400 ' + micro.toFixed(1) + 'px ' + MONO, sc.ink));
        // katakana column streaming down the edge
        g.fillStyle = sc.ink; g.fillRect(b.x + iw, b.y, colW, b.h);
        g.save(); g.beginPath(); g.rect(b.x + iw, b.y, colW, b.h); g.clip();
        const kfs = colW * 0.66; g.font = '700 ' + kfs.toFixed(1) + 'px ' + JP; g.textAlign = 'center'; g.fillStyle = acidLive;
        const step = kfs * 1.12; const off = (this.scroll * 38) % (step * KATA.length);
        const n0 = Math.floor(off / step);
        for (let i = -1; i < b.h / step + 2; i++) {
          const idx = ((i - n0) % KATA.length + KATA.length) % KATA.length;
          g.fillText(KATA[idx], b.x + iw + colW / 2, b.y + i * step + (off % step) + kfs);
        }
        g.restore();
      }

      // ---------- NEW sticker, over the seam, drawn after both panels
      {
        // NEW sticker, slapped on in the drop
        if (drop > 0.35) {
          const u = easeOut((drop - 0.35) / 0.25);
          const r = this.stk.r * (1.4 - 0.4 * u);
          // Slapped across the seam between the headline and the mark panel.
          const cx = this.stk.cx, cy = this.stk.top + r * 0.95;
          g.save(); g.translate(cx, cy); g.rotate(-0.3 + Math.sin(t * 0.5) * 0.12);
          g.globalAlpha = clamp(u * 1.5, 0, 1);
          g.fillStyle = sc.second; g.beginPath();
          for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? r * 0.86 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          g.closePath(); g.fill();
          g.textAlign = 'center'; g.fillStyle = sc.ink;
          g.font = '400 ' + (r * 0.42).toFixed(1) + 'px ' + WIDE; g.fillText('NEW', 0, r * 0.05);
          g.font = '800 ' + (r * 0.3).toFixed(1) + 'px ' + JP; g.fillText('新発売', 0, r * 0.45);
          g.restore();
        }
      }

      // ---------- pictogram strip (cols 0-8, rows 6-7)
      {
        const b = G(0, 6, 9, 2);
        g.fillStyle = sc.ink; g.fillRect(b.x, b.y, b.w, b.h);
        const n = 9, cwid = b.w / n;
        const kAge = t - this.kickT;
        // Held at full for a few frames so the flash reads, then let go.
        const kE = (kAge < 0.08 ? 1 : Math.exp(-(kAge - 0.08) / 0.3)) * clamp(R, 0, 2);
        const lit = Math.floor(this.kicks * 4) % PICTS.length; // walk by four: every pictogram gets its turn
        const shift = this.stripX * cwid;
        const first = Math.floor(shift / cwid);
        g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
        for (let j = -1; j <= n; j++) {
          const id = (((j + first) % PICTS.length) + PICTS.length) % PICTS.length;
          const x = b.x + j * cwid - (shift - first * cwid);
          const isLit = id === lit && kAge < 1.2;
          const a = isLit ? clamp(kE, 0, 1) : 0;
          if (a > 0.01) { g.fillStyle = acidLive; g.globalAlpha = a; g.fillRect(x + 1, b.y + 1, cwid - 2, b.h - 2); g.globalAlpha = 1; }
          g.strokeStyle = mix(sc.ink, sc.bg, 0.3); g.lineWidth = 0.6; g.strokeRect(x + 1, b.y + 1, cwid - 2, b.h - 2);
          const fg = a > 0.5 ? sc.ink : sc.bg;
          const ps = Math.min(cwid, b.h) * 0.52;
          g.save(); g.translate(x + cwid / 2, b.y + b.h * 0.48); g.scale(ps, ps);
          const ph = id === 2 ? (this.kicks % 2 ? 1 : 0) : (t * 0.3 + id * 0.1) % 1;
          pict(g, id, fg, ph, this.bass * 1.4);
          g.restore();
          text('P-' + String(id + 1).padStart(2, '0'), x + 4, b.y + micro * 1.3, '400 ' + micro.toFixed(1) + 'px ' + MONO, fg);
          text(PICTS[id], x + 4, b.y + b.h - micro * 0.6, '700 ' + micro.toFixed(1) + 'px ' + MONO, fg);
        }
        g.restore();
      }

      // ---------- lower row: data table, dial, goods catalogue
      const bE = G(0, 8, 5, 3), bF = G(5, 8, 3, 3), bG = G(8, 8, 4, 3);
      // data table
      {
        const b = bE;
        g.strokeStyle = sc.ink; g.lineWidth = 0.6; g.strokeRect(b.x, b.y, b.w, b.h);
        const fs = micro * (dens === 2 ? 0.95 : 1.05);
        const lh = fs * 1.32;
        g.fillStyle = sc.ink; g.fillRect(b.x, b.y, b.w, lh * 1.2);
        text('CH  UNIT        LEVEL   FREQ    STATUS', b.x + 4, b.y + lh * 0.88, '700 ' + fs.toFixed(1) + 'px ' + MONO, sc.bg);
        const names = ['LOW.END', 'SUB.HZ', 'KICK.4', 'CLAP.2', 'HAT.8', 'PAD.OS', 'NIGHT', 'CROWD', 'FLOOR', 'LIGHT', 'RISER', 'LOOP'];
        const status = ['OK', 'OK', 'RUN', 'HOLD', 'OK', '稼働', 'LIVE', 'OK'];
        const barH = b.h * 0.2;
        const rows = Math.max(1, Math.floor((b.h - lh * 1.4 - barH - 4) / lh));
        g.font = '400 ' + fs.toFixed(1) + 'px ' + MONO; g.textAlign = 'left';
        for (let i = 0; i < rows; i++) {
          const hv = hash(this.hats * 1.3 + i * 17.7);
          const flip = Math.floor((this.hats + i * 3) / (dens + 1));
          const lvl = (hv * 99.99).toFixed(2).padStart(5, '0');
          const fq = String(Math.floor(40 + hash(i * 5.1 + flip) * 16000)).padStart(5, ' ');
          const st = status[Math.floor(hash(flip + i) * status.length)];
          g.fillStyle = sc.ink;
          g.fillText(String(i + 1).padStart(2, '0') + '  ' + names[i % names.length].padEnd(10, ' ') + '  ' + lvl + '   ' + fq + '   ' + st, b.x + 4, b.y + lh * 1.2 + lh * (i + 0.85));
        }
        // barcode: stable bars scrolling, a few flip with the hats
        const by = b.y + b.h - barH - 3, bx0 = b.x + 4, bw = b.w * 0.62;
        g.save(); g.beginPath(); g.rect(bx0, by, bw, barH); g.clip();
        const unit = Math.max(1, bw / 110);
        const off = Math.floor(this.scroll * 10);
        for (let i = 0; i < 112; i++) {
          const k = i + off;
          let v = hash(k * 1.91);
          if (hash(k * 3.3 + this.hats) > 0.93) v = 1 - v;
          if (v > 0.48) { g.fillStyle = sc.ink; g.fillRect(bx0 + i * unit, by, unit * (v > 0.8 ? 2 : 1), barH); }
        }
        g.restore();
        text('4 902124 ' + String(off % 1000000).padStart(6, '0'), bx0 + bw + 6, by + barH * 0.45, '400 ' + micro.toFixed(1) + 'px ' + MONO, sc.ink);
        text('非売品 / NOT FOR SALE', bx0 + bw + 6, by + barH * 0.95, '700 ' + micro.toFixed(1) + 'px ' + JP, sc.ink);
      }
      // dial
      {
        const b = bF;
        g.strokeStyle = sc.ink; g.lineWidth = 0.6; g.strokeRect(b.x, b.y, b.w, b.h);
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) * 0.4;
        const kAge = t - this.kickT;
        const kE = clamp(Math.exp(-kAge / 0.3) * R, 0, 1);
        if (kE > 0.01) { g.fillStyle = acidLive; g.globalAlpha = kE; g.beginPath(); g.arc(cx, cy, r * (0.62 + 0.1 * (1 - kE)), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
        g.strokeStyle = sc.ink; g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 0.6; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(cx, cy, r * 0.3, 0, Math.PI * 2); g.stroke();
        g.beginPath();
        for (let i = 0; i < 60; i++) {
          const a = i / 60 * Math.PI * 2, l = i % 5 === 0 ? 0.14 : 0.06;
          g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * r * (1 + l), cy + Math.sin(a) * r * (1 + l));
        }
        g.moveTo(cx - r * 1.2, cy); g.lineTo(cx + r * 1.2, cy); g.moveTo(cx, cy - r * 1.2); g.lineTo(cx, cy + r * 1.2);
        g.stroke();
        // sweeping hand + a filled wedge behind it
        const a = this.sweep * 2.2;
        g.fillStyle = sc.ink; g.globalAlpha = 0.18; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a - 0.9, a); g.closePath(); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = sc.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
        g.fillStyle = sc.ink; g.fillRect(cx - 2, cy - 2, 4, 4);
        text('RX-124', b.x + 4, b.y + micro * 1.3, '400 ' + micro.toFixed(1) + 'px ' + MONO, sc.ink);
        text('同期 SYNC', b.x + b.w - 4, b.y + b.h - micro * 0.6, '700 ' + micro.toFixed(1) + 'px ' + JP, sc.ink, 'right');
        text(String(Math.floor(((a * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°', b.x + 4, b.y + b.h - micro * 0.6, '400 ' + micro.toFixed(1) + 'px ' + MONO, sc.ink);
      }
      // goods catalogue
      {
        const b = bG;
        g.fillStyle = sc.ink; g.fillRect(b.x, b.y, b.w, b.h);
        const hh = micro * 2.2;
        g.fillStyle = acidLive; g.fillRect(b.x, b.y, b.w, hh);
        text('INDEX OF GOODS / 商品一覧', b.x + 4, b.y + hh * 0.68, '700 ' + micro.toFixed(1) + 'px ' + JP, sc.ink);
        const lh = Math.max(micro * 1.9, (b.h - hh) / (dens === 0 ? 4 : dens === 1 ? 5.5 : 7));
        const fs = Math.min(lh * 0.62, b.w / 16);
        g.save(); g.beginPath(); g.rect(b.x, b.y + hh, b.w, b.h - hh); g.clip();
        const off = this.scroll * 9;
        const i0 = Math.floor(off / lh);
        const hiIdx = this.snares % GOODS.length;
        const sAge = t - this.snareT;
        for (let i = -1; i < (b.h - hh) / lh + 1; i++) {
          const k = i + i0;
          const idx = ((k % GOODS.length) + GOODS.length) % GOODS.length;
          const y = b.y + hh + (i - (off / lh - i0)) * lh + lh;
          const hi = idx === hiIdx && sAge < 1.4;
          if (hi) {
            const u = clamp(Math.exp(-sAge / 0.6) * R, 0, 1);
            g.fillStyle = sc.second; g.globalAlpha = u; g.fillRect(b.x, y - lh * 0.78, b.w, lh * 0.95); g.globalAlpha = 1;
          }
          text(String(idx + 1).padStart(2, '0'), b.x + 4, y - lh * 0.2, '400 ' + (fs * 0.8).toFixed(1) + 'px ' + MONO, acidLive);
          text(GOODS[idx], b.x + 4 + fs * 1.8, y - lh * 0.2, '400 ' + fs.toFixed(1) + 'px ' + COND, sc.bg);
          text(GOODS_JP[idx], b.x + b.w - 4, y - lh * 0.2, '700 ' + (fs * 0.72).toFixed(1) + 'px ' + JP, mix(sc.ink, sc.bg, 0.6), 'right');
        }
        g.restore();
      }

      // ---------- inspection stamps (clap)
      {
        const slots = [
          [bE.x + bE.w * 0.62, bE.y + bE.h * 0.4], [bE.x + bE.w * 0.3, bE.y + bE.h * 0.62],
          [bF.x + bF.w * 0.5, bF.y + bF.h * 0.3], [bF.x + bF.w * 0.4, bF.y + bF.h * 0.75],
          [bG.x + bG.w * 0.35, bG.y + bG.h * 0.55], [bE.x + bE.w * 0.85, bE.y + bE.h * 0.75],
        ];
        const labels = [['検品済', 'CHECKED'], ['承認', 'APPROVED'], ['合格', 'PASSED']];
        this.stamps = this.stamps.filter((st) => t - st.t < 1.6);
        this.stamps.forEach((st) => {
          const age = t - st.t;
          const [sx, sy] = slots[st.slot % slots.length];
          const sw = Math.min(cw * 2.1, 120), sh = Math.min(rh * 1.05, 44);
          const sca = 1 + 0.35 * Math.max(0, 1 - age / 0.07);
          const al = clamp(Math.min(1, R * 1.2) * (age < 0.07 ? age / 0.07 : 1) * (1 - smooth(0.9, 1.6, age)), 0, 1);
          const col = st.kind === 1 ? sc.ink : sc.second;
          g.save(); g.translate(sx, sy); g.rotate(st.rot); g.scale(sca, sca);
          g.globalAlpha = al * 0.92;
          if (sc.mult) g.globalCompositeOperation = 'multiply';
          g.strokeStyle = col; g.lineWidth = 2.2; g.strokeRect(-sw / 2, -sh / 2, sw, sh);
          g.lineWidth = 0.8; g.strokeRect(-sw / 2 + 3.5, -sh / 2 + 3.5, sw - 7, sh - 7);
          const lab = labels[st.kind];
          g.fillStyle = col; g.textAlign = 'center';
          g.font = '800 ' + (sh * 0.4).toFixed(1) + 'px ' + JP; g.fillText(lab[0], 0, sh * 0.06);
          g.font = '700 ' + (sh * 0.2).toFixed(1) + 'px ' + MONO; g.fillText(lab[1] + ' ' + String(st.n).padStart(4, '0'), 0, sh * 0.34);
          g.restore();
        });
      }

      // ---------- footer ticker (row 11)
      {
        const b = G(0, 11, 12, 1);
        g.fillStyle = sc.ink; g.fillRect(b.x, b.y, b.w, b.h);
        g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
        const fs = b.h * 0.42;
        g.font = '400 ' + fs.toFixed(1) + 'px ' + WIDE + ', ' + JP;
        const tw = g.measureText(TICKER).width;
        const off = (this.scroll * 70) % tw;
        g.fillStyle = drop > 0.5 ? acidLive : mix(sc.ink, acidLive, 0.85);
        g.textAlign = 'left';
        for (let x = b.x - off; x < b.x + b.w; x += tw) g.fillText(TICKER, x, b.y + b.h * 0.66);
        g.restore();
      }

      // ---------- paper grain over everything
      if (params.grain > 0.001) {
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = params.grain * (sc.mult ? 0.55 : 0.25);
        g.fillStyle = this.grain(g); g.fillRect(0, 0, W, H);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }

      g.restore();
    },
  });
})();
