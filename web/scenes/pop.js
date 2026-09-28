// Pop — a comic page that never ends, sliding past like a strip of film.
//
// Pop-art comic panels in the Lichtenstein manner: flat primary inks on
// newsprint, Ben-Day dot shading, heavy black keylines, captions in yellow
// boxes, speech and thought balloons, and big onomatopoeia. The page is tilted
// a little, like a comic lying on a table, and its tiers of panels slide
// sideways continuously, so the page is always turning up new panels.
//
// Craft notes:
// - Ben-Day dots are cached canvas patterns (one staggered-grid tile per ink
//   and dot size), transformed with the panel so the dots travel with the
//   print instead of swimming across it.
// - Each panel is a quadrilateral between two gutters (the gutters slant in the
//   drop, the classic action-page look), clipped, filled by one of nine
//   drawings in panel-local coordinates, then keylined.
// - Music is found as onsets against slow baselines (the listener from Paper)
//   and each part of the track gets its own place: kicks stamp a "POW" burst in
//   one panel of the bottom tier (the only thing a kick moves), snares flip one
//   panel of the top tier over to a new drawing, hats pop tiny print sparkles
//   and toggle the city's windows, the bass pumps speaker cones, pupils, crowds
//   and waves, and the drop turns the page into action panels: slanted
//   gutters, speed lines, denser inks, faster sliding.
// - Balloons are one union shape: stroke every piece, then fill every piece,
//   so the tail and the balloon share one outline.

(function () {
  'use strict';

  const TAU = Math.PI * 2;

  const PALETTES = [
    { name: 'Four-colour', paper: '#f2e8cc', ink: '#141214', red: '#e2262f', yellow: '#f9d423', blue: '#1f64c4', skin: '#f2a58e', white: '#fffaf0', gutter: '#f2e8cc' },
    { name: 'Riso', paper: '#f4efe4', ink: '#1d2a5e', red: '#ff4a9e', yellow: '#ffe24a', blue: '#00879e', skin: '#ffb0c4', white: '#fffdf7', gutter: '#f4efe4' },
    { name: 'Newsprint red', paper: '#e9e1c8', ink: '#1a1716', red: '#d4232a', yellow: '#e9e1c8', blue: '#1a1716', skin: '#e6a08e', white: '#faf6ea', gutter: '#e9e1c8' },
    { name: 'Night edition', paper: '#2a2d44', ink: '#08080c', red: '#ff5446', yellow: '#ffd23a', blue: '#4f9cff', skin: '#d98d7a', white: '#f3ead2', gutter: '#171826' },
  ];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  // --- Lettering. All of it is original and about sound and light.
  const TEXT = {
    speaker: ['WE ONLY SPEAK IN LOW END.', "DON'T MIND US. WE'RE JUST MOVING AIR.", 'LOUDER? WE WERE BUILT FOR LOUDER.', 'FEEL THAT? THAT WAS US.'],
    record: ['ROUND AND ROUND AND ROUND IT WENT...', 'THIRTY-THREE TURNS A MINUTE. NOBODY WAS COUNTING.', 'SIDE A. THE GOOD SIDE.', 'THE NEEDLE KNEW THE WAY HOME.'],
    bulb: ['SUDDENLY -- AN IDEA MADE OF LIGHT!', 'EVERY LAMP IN THE HOUSE LEANED IN TO LISTEN.', 'SOMEBODY TURNED THE LIGHT UP TO LOUD.', 'LIGHT HAS A SOUND. TONIGHT WE HEARD IT.'],
    city: ['MEANWHILE, ACROSS TOWN...', 'THE WHOLE CITY WAS HUMMING ALONG.', 'EVERY WINDOW KEPT THE BEAT.', 'MILES AWAY, THE LIGHTS STILL DANCED.'],
    eye: ['I CAN SEE THE MUSIC...', 'THE COLOURS ARE SO LOUD!', 'WAS THAT BLUE... OR A BASSLINE?', 'DON\'T BLINK. IT\'S TOO GOOD.'],
    dancers: ['IS THE FLOOR... BREATHING?', "DON'T STOP NOW!", 'THIS IS MY SONG!', 'WHO TURNED THE ROOM UP?'],
    wave: ['IT CAME IN WAVES.', 'THE BASS ROLLED IN LIKE WEATHER.', 'HIGH TIDE ON THE DANCE FLOOR.', 'NO ONE SAW THE SECOND WAVE COMING.'],
    moon: ['LATER, IN THE QUIET...', 'THE ROOM EXHALED.', 'ONE LAST LIGHT STAYED ON.', 'EVEN THE MOON TURNED IT DOWN.'],
    sfx: ['WHOOSH!', 'ZZZAP!', 'KRAK!', 'VWOOM!', 'SHAZZ!', 'FWAAM!', 'BZZT!', 'WHAMM!'],
  };
  const KICK_WORDS = ['POW!', 'BOOM!', 'THUD!', 'WHUMP!', 'BAM!', 'DOOF!', 'THOOM!', 'KA-BOOM!', 'BLAM!', 'WUMP!'];

  const QUIET = ['moon', 'city', 'eye', 'record', 'bulb', 'city', 'wave'];
  const BUSY = ['speaker', 'dancers', 'sfx', 'wave', 'eye', 'bulb', 'record', 'speaker', 'dancers', 'sfx'];
  const ACTION = ['sfx', 'speaker', 'dancers', 'sfx', 'wave', 'eye'];

  // --- Ben-Day dots: a staggered-grid tile per ink and dot radius.
  const TILE = 32;
  function dotTile(color, rf) {
    const c = document.createElement('canvas');
    c.width = TILE; c.height = TILE;
    const g = c.getContext('2d');
    g.fillStyle = color;
    const r = rf * TILE * 0.5;
    const pts = [[0, 0], [TILE, 0], [0, TILE], [TILE, TILE], [TILE / 2, TILE / 2]];
    for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    return c;
  }

  function makeGrain() {
    const c = document.createElement('canvas');
    c.width = 192; c.height = 192;
    const g = c.getContext('2d');
    const r = rng(77);
    for (let i = 0; i < 2600; i++) {
      const a = r() * 0.09;
      g.fillStyle = r() < 0.5 ? 'rgba(60,40,10,' + a.toFixed(3) + ')' : 'rgba(255,255,240,' + a.toFixed(3) + ')';
      g.fillRect(r() * 192, r() * 192, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    return c;
  }

  function fontFor(kind, px) {
    return kind === 'sfx'
      ? '900 ' + px.toFixed(1) + 'px Impact, "Arial Black", "Helvetica Neue", sans-serif'
      : 'italic 700 ' + px.toFixed(1) + 'px "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif';
  }

  function wrap(g, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function spikyPath(g, n, R, r, seed, rot) {
    const rr = rng(seed);
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * TAU + (rr() - 0.5) * 0.18;
      const rad = i % 2 === 0 ? R * (0.82 + rr() * 0.3) : r * (0.9 + rr() * 0.2);
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  VIZ.register({
    id: 'pop',
    name: 'Pop',
    order: 408,

    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Page speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'tiers', label: 'Tiers', type: 'select', options: ['Auto', 'One (close-ups)', 'Two', 'Three', 'Four (busy page)'], default: 0 },
      { key: 'dots', label: 'Dot size', type: 'range', min: 0.5, max: 2.5, default: 1, step: 0.01 },
      { key: 'tilt', label: 'Page tilt', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'words', label: 'Lettering', type: 'select', options: ['Captions and balloons', 'Sound effects only'], default: 0 },
    ],

    actions: [
      { id: 'newpage', label: 'New page', run() { this.tiers = null; this.pageSeed = (this.pageSeed || 1) + 101; } },
    ],

    gallery: {
      title: 'Pop',
      technique: 'Canvas 2D comic page: tiers of clipped quadrilateral panels sliding sideways, cached Ben-Day dot patterns that travel with the print, nine hand-built panel drawings, union-stroked balloons, onset detection against slow baselines',
      brief: 'An endless pop-art comic page sliding past on a slight tilt: newsprint, Ben-Day dots, heavy keylines, flat red, yellow and blue. Panels of speakers that talk, a spinning record, a light bulb with an idea, a city at night, a close-up eye, a dancing crowd under spotlights, a rolling wave, a quiet moon, and pure sound-effect panels, each with its own caption or balloon about sound and light. Each kick stamps a POW-style burst into one panel of the bottom tier and nowhere else; each snare flips one panel of the top tier over to a new drawing; hats pop tiny print sparkles and switch the city windows; the bass pumps the speaker cones, the crowd, the pupil and the waves. The drop turns the page into an action page: slanted gutters, narrower panels, speed lines behind everything, denser inks and faster sliding. The breakdown slows to wide, quiet panels.',
      lineage: [
        'Brief 08 (batch 04): Lichtenstein pop art, Ben-Day dots, heavy outlines, primary colours on newsprint, balloons and onomatopoeia; kick = burst in one panel, snare = page turn, drop = action panels. Batch-04 rule: no rainbow, no glow finish.',
        'Approach: Canvas 2D, because print is flat shapes and keylines. Ben-Day dots as cached pattern tiles transformed with each panel. The page slides sideways in tiers (movement through the page instead of a camera flight), tilted a couple of degrees like a comic on a table. Listener reused from Paper (onsets against slow baselines).',
        'v1: looked right first time (nine drawings, captions, balloons, bursts), but the page slid at up to 150 units/s in the drop and the snare flipped a whole panel edge-on like a card, exposing the gutter. Jolt: kickArea 0.59, ratio 1.07 -- the kick was lost in the scroll, every keyline in the frame moved. Even with the page stopped the card flip alone gave 0.20. The breakdown also kept the drop\'s action panels, because nothing replaced them.',
        'v2: the page became a slow crawl (7-17 units/s, the music changes its pace), speed lines fixed per panel instead of turning, the flip replaced by a page-turn wipe (a slanted fold sweeps across with a narrow curled flap and a flat shadow), snare turns spread over every tier and aimed at the panel turned longest ago so a drop fills the whole page with action panels, and quiet turns (every 0.9 s while action panels remain, 2.2 s otherwise) once the kicks stop, so the breakdown visibly exhales back to moons, cities and records. Jolt: kickArea 0.23, the burst the one hot spot.',
        'v3: the crowd\'s bob and the spotlight sway calmed (they were the next-largest drift), the wave\'s black foreground swapped for dotted deep blue with foam crests, no two neighbouring or stacked panels get the same drawing, lines cycle per drawing so balloons do not repeat on screen, bigger hat sparkles. Final jolt at 640x360: kickArea 0.225, kickMean 0.049, ratio 1.31, calm; build kick 0.21.',
      ],
    },

    setup() {},

    enter() {
      this.lastT = null;
      this.T = 0;
      this.tiers = null;
      this.pageSeed = this.pageSeed || 1;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.sparks = [];
      this.kickN = 0;
      this.snareN = 0;
      this.v = undefined;
      this.panelN = 0;
    },

    listen(s, dt) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      this.kickHit = 0; this.snareHit = 0; this.hatHit = 0;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.kickHit = kRaw;
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.4 : 0.7, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.snareHit = 0.6 + 0.4 * sRaw;
      }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw, e.snare * Math.exp(-dt / 0.16));

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
        this.hatHit = hRaw;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.2, dt);
      e.pad = ease(e.pad || 0, clamp01((s[2] + s[3] + s[4]) / 240), 1.5, dt);
    },

    dots(g, color, rf) {
      const q = Math.max(0.05, Math.min(0.95, Math.round(rf * 20) / 20));
      const key = color + '|' + q;
      if (!this.patterns) this.patterns = new Map();
      let pat = this.patterns.get(key);
      if (!pat) {
        pat = g.createPattern(dotTile(color, q), 'repeat');
        this.patterns.set(key, pat);
      }
      const k = this.dotSp / TILE;
      pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
      return pat;
    },

    // A panel's ground: newsprint, a Ben-Day ink, and in the drop speed lines.
    ground(g, w, h, P, ink, rf) {
      const S = this.S;
      g.fillStyle = S.pal.paper === S.pal.gutter ? S.pal.paper : S.pal.white;
      if (S.pal.name === 'Night edition') g.fillStyle = S.pal.paper;
      g.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
      g.fillStyle = this.dots(g, ink, rf + 0.22 * S.drop);
      g.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
      const lines = P.type === 'sfx' ? 1 : S.drop * 0.9;
      if (lines > 0.02) this.speedLines(g, w, h, P, lines);
    },

    speedLines(g, w, h, P, amt) {
      const S = this.S;
      const n = 30;
      const R = Math.hypot(w, h);
      const fx = P.fx * w, fy = P.fy * h;
      const rot = P.seed * 0.37;
      g.fillStyle = S.pal.ink;
      g.globalAlpha = amt;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU + hash2(P.seed, i) * 0.12;
        const da = 0.012 + hash2(i, P.seed) * 0.02;
        const r0 = R * (0.16 + hash2(P.seed + 7, i) * 0.12);
        g.moveTo(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0);
        g.lineTo(fx + Math.cos(a - da) * R, fy + Math.sin(a - da) * R);
        g.lineTo(fx + Math.cos(a + da) * R, fy + Math.sin(a + da) * R);
        g.closePath();
      }
      g.fill();
      g.globalAlpha = 1;
    },

    caption(g, text, w, h) {
      const S = this.S;
      if (!text || S.words !== 0) return;
      const fs = S.fs;
      g.font = fontFor('text', fs);
      const maxW = Math.min(w * 0.62, fs * 15);
      const lines = wrap(g, text, maxW - fs);
      let tw = 0;
      for (const l of lines) tw = Math.max(tw, g.measureText(l).width);
      const bw = tw + fs * 1.1, bh = lines.length * fs * 1.12 + fs * 0.7;
      const x = -w / 2 + S.lw * 0.5, y = -h / 2 + S.lw * 0.5 + S.capInset;
      g.fillStyle = S.pal.yellow === S.pal.paper ? S.pal.white : S.pal.yellow;
      g.strokeStyle = S.pal.ink;
      g.lineWidth = S.lw * 0.7;
      g.fillRect(x, y, bw, bh);
      g.strokeRect(x, y, bw, bh);
      g.fillStyle = S.pal.ink;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) g.fillText(lines[i], x + fs * 0.55, y + fs * 0.35 + fs * 1.12 * (i + 0.5));
    },

    // Speech or thought balloon centred at (cx, cy) with its tail pointing to (tx, ty).
    balloon(g, text, cx, cy, tx, ty, maxW, thought) {
      const S = this.S;
      if (!text || S.words !== 0) return;
      const fs = S.fs;
      g.font = fontFor('text', fs);
      const lines = wrap(g, text, maxW);
      let tw = 0;
      for (const l of lines) tw = Math.max(tw, g.measureText(l).width);
      const th = lines.length * fs * 1.12;
      const rx = tw * 0.62 + fs * 0.9, ry = th * 0.62 + fs * 0.8;
      const pieces = [];
      if (thought) {
        const n = 11;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          pieces.push(['c', cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.8, Math.min(rx, ry) * 0.42]);
        }
        pieces.push(['e', cx, cy, rx * 0.9, ry * 0.85]);
        for (let i = 1; i <= 3; i++) {
          const f = 0.55 + i * 0.15;
          pieces.push(['c', cx + (tx - cx) * f, cy + ry * 0.9 + (ty - cy - ry * 0.9) * f, fs * (0.55 - i * 0.12)]);
        }
      } else {
        pieces.push(['e', cx, cy, rx, ry]);
        const ang = Math.atan2(ty - cy, tx - cx);
        const bx = cx + Math.cos(ang) * rx * 0.75, by = cy + Math.sin(ang) * ry * 0.75;
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        pieces.push(['t', bx + nx * fs * 0.7, by + ny * fs * 0.7, bx - nx * fs * 0.7, by - ny * fs * 0.7, tx, ty]);
      }
      const path = (pc) => {
        g.beginPath();
        if (pc[0] === 'c') g.arc(pc[1], pc[2], pc[3], 0, TAU);
        else if (pc[0] === 'e') g.ellipse(pc[1], pc[2], pc[3], pc[4], 0, 0, TAU);
        else { g.moveTo(pc[1], pc[2]); g.lineTo(pc[5], pc[6]); g.lineTo(pc[3], pc[4]); g.closePath(); }
      };
      g.strokeStyle = S.pal.ink;
      g.lineWidth = S.lw * 1.3;
      g.lineJoin = 'round';
      for (const pc of pieces) { path(pc); g.stroke(); }
      g.fillStyle = S.pal.white;
      for (const pc of pieces) { path(pc); g.fill(); }
      g.fillStyle = S.pal.ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) g.fillText(lines[i], cx, cy - th / 2 + fs * 1.12 * (i + 0.5));
    },

    // Big lettering with a stepped black extrusion.
    bigWord(g, word, x, y, size, fill, rot, maxW) {
      const S = this.S;
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.font = fontFor('sfx', size);
      const m = g.measureText(word).width;
      if (maxW && m > maxW) { g.scale(maxW / m, maxW / m); }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.fillStyle = S.pal.ink;
      const ex = size * 0.07;
      for (let i = 4; i >= 1; i--) g.fillText(word, ex * i / 4, ex * i / 4);
      g.strokeStyle = S.pal.ink;
      g.lineWidth = size * 0.09;
      g.strokeText(word, 0, 0);
      g.fillStyle = fill;
      g.fillText(word, 0, 0);
      g.restore();
    },

    // ---------------------------------------------------------------- panels
    drawSpeaker(g, w, h, P) {
      const S = this.S, pal = S.pal, e = S.e, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.yellow === pal.paper ? pal.red : pal.yellow, 0.34);
      const cw = Math.min(m * 0.5, w * 0.42), ch = m * 0.8;
      const cx = P.side * w * 0.14, cy = h * 0.1;
      // Sound arcs, travelling outward at the speed of the bass.
      g.strokeStyle = pal.ink;
      g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const ph = (P.ph + k / 3) % 1;
        const r = cw * 0.55 + ph * m * 0.45;
        g.lineWidth = S.lw * (1.6 - ph * 1.2);
        for (const side of [0, Math.PI]) {
          g.beginPath();
          g.arc(cx, cy + ch * 0.12, r, side - 0.45, side + 0.45);
          g.stroke();
        }
      }
      g.lineWidth = S.lw;
      g.fillStyle = pal.blue;
      g.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
      g.strokeRect(cx - cw / 2, cy - ch / 2, cw, ch);
      const pump = 1 + 0.1 * e.bass * S.push;
      const cone = (x, y, r, dip) => {
        g.fillStyle = pal.white;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = this.dots(g, pal.ink, 0.28);
        g.beginPath(); g.arc(x, y, r * 0.78 * dip, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = pal.red;
        g.beginPath(); g.arc(x, y, r * 0.3 * dip, 0, TAU); g.fill(); g.stroke();
      };
      cone(cx, cy + ch * 0.16, cw * 0.36, pump);
      cone(cx, cy - ch * 0.28, cw * 0.17, 1 + 0.25 * e.hat);
      this.balloon(g, P.text, -P.side * w * 0.18, -h * 0.28, cx, cy - ch * 0.45, Math.min(w * 0.42, S.fs * 11), false);
    },

    drawRecord(g, w, h, P) {
      const S = this.S, pal = S.pal, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.blue, 0.3);
      const R = Math.min(m * 0.42, w * 0.42);
      const cx = P.side * w * 0.06, cy = h * 0.06;
      g.fillStyle = pal.ink;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.lineWidth = 1;
      for (let r = R * 0.4; r < R * 0.97; r += R * 0.055) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
      // Fixed sheen wedges: the light stays still while the disc turns.
      g.fillStyle = pal.blue;
      for (const a0 of [-0.9, Math.PI - 0.9]) {
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 0.96, a0, a0 + 0.22); g.closePath(); g.fill();
      }
      g.fillStyle = pal.ink;
      g.beginPath(); g.arc(cx, cy, R * 0.36, 0, TAU); g.fill();
      g.save();
      g.translate(cx, cy);
      g.rotate(S.spin * (P.seed % 2 ? 1 : 1.1));
      g.fillStyle = pal.red;
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw * 0.7;
      g.beginPath(); g.arc(0, 0, R * 0.3, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = pal.white;
      g.font = fontFor('sfx', R * 0.11);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SIDE A', 0, -R * 0.15);
      g.fillRect(-R * 0.14, R * 0.1, R * 0.28, R * 0.035);
      g.fillStyle = pal.paper;
      g.beginPath(); g.arc(0, 0, R * 0.035, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      // Tone arm.
      const px = cx + R * 0.98, py = cy - R * 0.82;
      const hx = cx + R * 0.52, hy = cy + R * 0.22;
      g.lineCap = 'round';
      g.lineWidth = S.lw * 3.2; g.strokeStyle = pal.ink;
      g.beginPath(); g.moveTo(px, py); g.lineTo(hx, hy); g.stroke();
      g.lineWidth = S.lw * 1.6; g.strokeStyle = pal.white;
      g.beginPath(); g.moveTo(px, py); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = pal.white; g.strokeStyle = pal.ink; g.lineWidth = S.lw;
      g.beginPath(); g.arc(px, py, R * 0.1, 0, TAU); g.fill(); g.stroke();
      this.caption(g, P.text, w, h);
    },

    drawBulb(g, w, h, P) {
      const S = this.S, pal = S.pal, e = S.e, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.red, 0.32);
      const R = Math.min(m * 0.24, w * 0.24);
      const cx = P.side * w * 0.08, cy = h * 0.02;
      const n = 12;
      const len = R * (0.55 + 0.45 * e.bass * S.push);
      g.fillStyle = pal.yellow === pal.paper ? pal.white : pal.yellow;
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw * 0.8;
      g.lineJoin = 'miter';
      const rot = S.T * 0.12;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU;
        const l = len * (i % 2 ? 0.75 : 1.1);
        const r0 = R * 1.18;
        g.beginPath();
        g.moveTo(cx + Math.cos(a - 0.09) * r0, cy + Math.sin(a - 0.09) * r0);
        g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l));
        g.lineTo(cx + Math.cos(a + 0.09) * r0, cy + Math.sin(a + 0.09) * r0);
        g.closePath(); g.fill(); g.stroke();
      }
      g.lineWidth = S.lw;
      g.beginPath();
      g.arc(cx, cy, R, Math.PI * 0.72, Math.PI * 2.28);
      g.lineTo(cx + R * 0.42, cy + R * 1.25);
      g.lineTo(cx - R * 0.42, cy + R * 1.25);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = pal.white;
      g.beginPath(); g.ellipse(cx - R * 0.45, cy - R * 0.4, R * 0.14, R * 0.26, 0.6, 0, TAU); g.fill();
      g.beginPath();
      g.moveTo(cx - R * 0.2, cy + R * 1.2); g.lineTo(cx - R * 0.2, cy + R * 0.3);
      for (let i = 0; i <= 6; i++) g.lineTo(cx - R * 0.3 + i * R * 0.1, cy + R * (i % 2 ? 0.05 : 0.25));
      g.lineTo(cx + R * 0.2, cy + R * 0.3); g.lineTo(cx + R * 0.2, cy + R * 1.2);
      g.stroke();
      g.fillStyle = this.dots(g, pal.ink, 0.45);
      for (let i = 0; i < 3; i++) {
        const y = cy + R * (1.25 + i * 0.2);
        g.fillStyle = i % 2 ? pal.white : this.dots(g, pal.ink, 0.45);
        g.fillRect(cx - R * 0.42, y, R * 0.84, R * 0.2);
        g.strokeRect(cx - R * 0.42, y, R * 0.84, R * 0.2);
      }
      this.caption(g, P.text, w, h);
    },

    drawCity(g, w, h, P) {
      const S = this.S, pal = S.pal, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.blue, 0.4);
      const r = rng(P.seed * 13 + 5);
      g.fillStyle = pal.yellow === pal.paper ? pal.white : pal.yellow;
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw;
      const mx = -P.side * w * 0.22, my = -h * 0.12;
      g.beginPath(); g.arc(mx, my, m * 0.13, 0, TAU); g.fill(); g.stroke();
      let x = -w / 2 - 10;
      let i = 0;
      const winC = pal.yellow === pal.paper ? pal.white : pal.yellow;
      while (x < w / 2 + 10) {
        const bw = m * (0.12 + r() * 0.14);
        const bh = h * (0.22 + r() * 0.42);
        const top = h / 2 - bh;
        g.fillStyle = pal.ink;
        g.fillRect(x, top, bw + 1, bh + 10);
        if (r() < 0.4) g.fillRect(x + bw * 0.4, top - bh * 0.12, bw * 0.12, bh * 0.12);
        const ww = m * 0.026, gap = m * 0.024;
        const cols = Math.max(1, Math.floor((bw - gap) / (ww + gap)));
        const rows = Math.floor((bh - gap) / (ww * 1.4 + gap));
        g.fillStyle = winC;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const hv = hash2(P.seed * 97 + i * 31 + cx, cy * 7 + 3);
            const flick = hash2(Math.floor(hv * 1000) + S.hatSeed * 13, i + cx * 3);
            if (hv < 0.35 || (hv < 0.62 && flick < 0.45)) g.fillRect(x + gap + cx * (ww + gap), top + gap + cy * (ww * 1.4 + gap), ww, ww * 1.4);
          }
        }
        x += bw + m * (0.005 + r() * 0.03);
        i++;
      }
      this.caption(g, P.text, w, h);
    },

    drawEye(g, w, h, P) {
      const S = this.S, pal = S.pal, e = S.e, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.skin, 0.42);
      const ew = Math.min(w * 0.72, m * 1.05);
      const blinkPh = ((S.T + P.seed * 1.7) % 6.3) / 0.22;
      const open = blinkPh < 1 ? Math.abs(1 - 2 * blinkPh) : 1;
      const eh = ew * 0.4 * (0.08 + 0.92 * open) * (1 + 0.12 * S.drop);
      const cx = 0, cy = h * 0.12;
      const eyePath = () => {
        g.beginPath();
        g.moveTo(cx - ew / 2, cy);
        g.bezierCurveTo(cx - ew * 0.25, cy - eh * 1.25, cx + ew * 0.25, cy - eh * 1.25, cx + ew / 2, cy - eh * 0.1);
        g.bezierCurveTo(cx + ew * 0.2, cy + eh * 0.95, cx - ew * 0.25, cy + eh * 0.9, cx - ew / 2, cy);
        g.closePath();
      };
      // Brow.
      g.fillStyle = pal.ink;
      g.beginPath();
      g.moveTo(cx - ew * 0.52, cy - ew * 0.28);
      g.quadraticCurveTo(cx, cy - ew * 0.62 - S.drop * ew * 0.05, cx + ew * 0.55, cy - ew * 0.3);
      g.quadraticCurveTo(cx, cy - ew * 0.5 - S.drop * ew * 0.05, cx - ew * 0.52, cy - ew * 0.28);
      g.fill();
      g.fillStyle = pal.white;
      eyePath(); g.fill();
      g.save();
      eyePath(); g.clip();
      const lx = Math.sin(S.T * 0.37 + P.seed) * ew * 0.12, ly = Math.sin(S.T * 0.23 + P.seed * 2) * ew * 0.03;
      const ir = ew * 0.2;
      g.fillStyle = pal.blue;
      g.beginPath(); g.arc(cx + lx, cy + ly, ir, 0, TAU); g.fill();
      g.fillStyle = this.dots(g, pal.ink, 0.35);
      g.beginPath(); g.arc(cx + lx, cy + ly, ir, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      g.strokeStyle = pal.ink; g.lineWidth = S.lw;
      g.beginPath(); g.arc(cx + lx, cy + ly, ir, 0, TAU); g.stroke();
      g.fillStyle = pal.ink;
      g.beginPath(); g.arc(cx + lx, cy + ly, ir * (0.36 + 0.3 * e.bass * S.push), 0, TAU); g.fill();
      g.fillStyle = pal.white;
      g.beginPath(); g.arc(cx + lx - ir * 0.35, cy + ly - ir * 0.38, ir * 0.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(cx + lx + ir * 0.3, cy + ly + ir * 0.3, ir * 0.08, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw * 1.5;
      eyePath(); g.stroke();
      g.lineWidth = S.lw * 1.1;
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const t = 0.2 + i * 0.12;
        const bx = cx - ew / 2 + ew * t;
        const by = cy - eh * 0.95 * Math.sin(Math.PI * Math.min(1, t * 1.02));
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx + ew * 0.03, by - ew * 0.06, bx + ew * 0.07, by - ew * 0.08 - (i === 6 ? ew * 0.02 : 0));
        g.stroke();
      }
      this.balloon(g, P.text, P.side * w * 0.2, -h * 0.3, cx + P.side * ew * 0.2, cy - eh, Math.min(w * 0.4, S.fs * 10), true);
    },

    drawDancers(g, w, h, P) {
      const S = this.S, pal = S.pal, e = S.e, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.red, 0.36);
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw * 0.8;
      g.fillStyle = pal.yellow === pal.paper ? pal.white : pal.yellow;
      for (let i = 0; i < 3; i++) {
        const sx = -w * 0.35 + i * w * 0.35;
        const a = Math.PI / 2 + Math.sin(S.T * (0.22 + i * 0.07) + i * 2 + P.seed) * 0.4;
        const L = h * 1.3, sp = 0.13;
        g.beginPath();
        g.moveTo(sx - 6, -h / 2 - 2);
        g.lineTo(sx + Math.cos(a - sp) * L, -h / 2 + Math.sin(a - sp) * L);
        g.lineTo(sx + Math.cos(a + sp) * L, -h / 2 + Math.sin(a + sp) * L);
        g.lineTo(sx + 6, -h / 2 - 2);
        g.closePath(); g.fill(); g.stroke();
      }
      const hr = m * 0.065;
      const n = Math.max(3, Math.round(w / (hr * 3.1)));
      g.fillStyle = pal.ink;
      g.strokeStyle = pal.ink;
      g.lineCap = 'round';
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < n + row; i++) {
          const x = -w / 2 + (i + 0.5 - row * 0.5) * (w / n) + (hash2(P.seed, i + row * 50) - 0.5) * hr;
          const phase = hash2(i, row + P.seed) * TAU;
          const bob = Math.sin(S.T * TAU * 1.03 + phase) * hr * (0.1 + 0.35 * e.bass * S.push);
          const base = h / 2 - (row === 0 ? m * 0.12 : m * 0.02);
          const hy = base - hr * 2.2 - bob;
          if (hash2(P.seed + 3, i + row * 20) < 0.5 + 0.4 * S.drop) {
            const lift = 0.8 + 0.2 * Math.sin(S.T * 1.3 + phase);
            g.lineWidth = hr * 0.55;
            for (const sd of [-1, 1]) {
              g.beginPath();
              g.moveTo(x + sd * hr * 0.9, hy + hr * 1.4);
              g.lineTo(x + sd * hr * (1.6 + 0.4 * Math.sin(phase + sd)), hy - hr * 1.6 * lift - hr * 0.5);
              g.stroke();
            }
          }
          g.beginPath(); g.arc(x, hy, hr, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(x, hy + hr * 2.6, hr * 1.35, hr * 1.7, 0, 0, TAU); g.fill();
        }
      }
      this.balloon(g, P.text, P.side * w * 0.12, -h * 0.26, P.side * w * 0.05, h * 0.08, Math.min(w * 0.45, S.fs * 11), false);
    },

    drawWave(g, w, h, P) {
      const S = this.S, pal = S.pal, e = S.e, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.blue, 0.2);
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw;
      g.lineJoin = 'round';
      const amp = m * (0.05 + 0.1 * e.bass * S.push + 0.03 * S.drop);
      const layers = [
        { base: h * 0.02, fill: this.dots(g, pal.blue, 0.6), k: 0.9, sp: 0.5 },
        { base: h * 0.18, fill: pal.blue, k: 1.3, sp: 0.8 },
        { base: h * 0.34, fill: this.dots(g, pal.ink, 0.62), under: pal.blue, k: 1.7, sp: 1.2 },
      ];
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const ph = S.T * L.sp * 0.5 * (1 + 0.5 * S.drop) + P.seed + li;
        const yAt = (x) => {
          const u = x / m * L.k * 5 + ph;
          const s = Math.sin(u);
          return L.base - amp * (0.6 + 0.4 * li / 2) * (s + 0.35 * Math.sin(u * 2 + 1)) - amp * 0.4 * Math.max(0, s) ** 4;
        };
        g.beginPath();
        g.moveTo(-w / 2 - 10, h / 2 + 10);
        for (let x = -w / 2 - 10; x <= w / 2 + 10; x += 6) g.lineTo(x, yAt(x));
        g.lineTo(w / 2 + 10, h / 2 + 10);
        g.closePath();
        if (L.under) { g.fillStyle = L.under; g.fill(); }
        g.fillStyle = L.fill; g.fill(); g.stroke();
        // Foam: white scallops on the crests.
        g.fillStyle = pal.white;
        const step = m * 0.045;
        for (let x = -w / 2; x <= w / 2; x += step) {
          const y = yAt(x);
          if (y < L.base - amp * 0.35) {
            g.beginPath(); g.arc(x, y, step * 0.6, Math.PI, TAU); g.fill(); g.stroke();
          }
        }
      }
      this.caption(g, P.text, w, h);
    },

    drawMoon(g, w, h, P) {
      const S = this.S, pal = S.pal, m = Math.min(w, h);
      this.ground(g, w, h, P, pal.blue, 0.5);
      const R = m * 0.26;
      const cx = P.side * w * 0.12, cy = h * 0.1;
      g.fillStyle = pal.yellow === pal.paper ? pal.white : pal.yellow;
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.save();
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      g.fillStyle = this.dots(g, pal.ink, 0.5);
      g.beginPath(); g.arc(cx + R * 0.45 * P.side, cy - R * 0.2, R * 0.95, 0, TAU); g.fill();
      g.restore();
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      // A few printed stars that twinkle with the hats.
      for (let i = 0; i < 7; i++) {
        const sx = (hash2(P.seed, i) - 0.5) * w * 0.9, sy = (hash2(i, P.seed) - 0.5) * h * 0.8;
        if (Math.hypot(sx - cx, sy - cy) < R * 1.3) continue;
        const on = hash2(S.hatSeed + i, P.seed) < 0.6;
        const s = m * (on ? 0.03 : 0.018);
        this.star(g, sx, sy, s, pal.white === pal.paper ? pal.yellow : pal.white);
      }
      this.caption(g, P.text, w, h);
    },

    drawSfx(g, w, h, P) {
      const S = this.S, pal = S.pal, m = Math.min(w, h);
      const inks = [pal.yellow, pal.red, pal.blue];
      const bg = inks[P.seed % 3] === pal.paper ? pal.red : inks[P.seed % 3];
      g.fillStyle = bg;
      g.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
      g.fillStyle = this.dots(g, pal.white, 0.3);
      g.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
      this.speedLines(g, w, h, P, 1);
      const fill = inks[(P.seed + 1) % 3] === pal.ink ? pal.white : inks[(P.seed + 1) % 3];
      const wob = Math.sin(S.T * 1.3 + P.seed) * 0.04;
      this.bigWord(g, P.text, 0, 0, Math.min(h * 0.34, m * 0.4) * (1 + 0.05 * S.e.bass), fill === bg ? pal.white : fill, -0.12 + wob + (P.seed % 3 - 1) * 0.05, w * 0.84);
    },

    star(g, x, y, s, fill) {
      const S = this.S;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const r = i % 2 ? s * 0.28 : s;
        if (i === 0) g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = fill;
      g.strokeStyle = S.pal.ink;
      g.lineWidth = Math.max(1, s * 0.16);
      g.lineJoin = 'miter';
      g.fill(); g.stroke();
    },

    drawBurst(g, w, h, P) {
      const S = this.S, pal = S.pal, b = P.burst;
      const t = S.T - b.t0;
      const life = 0.42;
      if (t < 0 || t > life) return;
      let sc;
      if (t < 0.06) { const u = t / 0.06; sc = u * (1.25 - 0.25 * u); }
      else if (t < 0.3) sc = 1;
      else sc = 1 - ((t - 0.3) / (life - 0.3)) ** 2;
      const R = Math.min(w, h) * 0.34 * (0.7 + 0.3 * b.amp) * sc;
      if (R < 1) return;
      g.save();
      g.translate(b.x * w, b.y * h);
      g.rotate(b.rot);
      g.strokeStyle = pal.ink;
      g.lineWidth = S.lw * 1.1;
      g.lineJoin = 'miter';
      spikyPath(g, 13, R * 1.15, R * 0.7, b.seed, 0);
      g.fillStyle = b.alt ? pal.red : (pal.yellow === pal.paper ? pal.white : pal.yellow);
      g.fill(); g.stroke();
      spikyPath(g, 11, R * 0.85, R * 0.55, b.seed + 9, 0.2);
      g.fillStyle = b.alt ? (pal.yellow === pal.paper ? pal.white : pal.yellow) : pal.white;
      g.fill();
      g.restore();
      const fill = b.alt ? pal.red : pal.red;
      this.bigWord(g, b.word, b.x * w, b.y * h, R * 0.62, b.alt ? pal.blue : fill, b.rot * 0.6, R * 1.5);
    },

    // ------------------------------------------------------------- the page
    newPanel(tier, x0, kL) {
      const S = this.S;
      const r = rng(this.pageSeed * 7919 + (this.panelN++) * 131 + tier.idx * 17);
      const dropNow = S.drop;
      const th = S.th;
      const act = dropNow > 0.45;
      let wv;
      if (S.nTiers === 1) wv = th * (act ? 0.75 + r() * 0.5 : 1.0 + r() * 0.6);
      else wv = th * (act ? 0.55 + r() * 0.55 : 0.85 + r() * 0.85);
      const kR = act ? (r() - 0.5) * 0.5 : 0;
      const type = this.pickType(r, dropNow, tier, x0 - tier.off + wv / 2);
      const P = {
        x0, w: wv, kL, kR, seed: Math.floor(r() * 100000), side: r() < 0.5 ? -1 : 1,
        fx: (r() - 0.5) * 0.4, fy: (r() - 0.5) * 0.4, ph: r(), flip: null, burst: null, type: null,
      };
      this.setContent(P, type, r);
      return P;
    },

    pickType(r, drop, tier, x) {
      const list = drop > 0.45 ? ACTION : drop > 0.15 || this.env.kAvg > 0.08 ? BUSY : QUIET;
      const avoid = x === undefined ? [] : this.typesNear(tier, x);
      if (tier) avoid.push(tier.lastType);
      let t = pick(r, list);
      for (let k = 0; k < 8 && avoid.indexOf(t) >= 0; k++) t = pick(r, list);
      if (tier) tier.lastType = t;
      return t;
    },

    // Drawings in the other tiers that sit above or below world position x
    // of this tier (page coordinates), so stacked panels differ too.
    typesNear(tier, xPage) {
      const out = [];
      if (!this.tiers) return out;
      for (const t of this.tiers) {
        if (t === tier) continue;
        for (const P of t.panels) {
          const xl = P.x0 - t.off, xr = xl + P.w;
          if (xr > xPage - this.S.th * 0.5 && xl < xPage + this.S.th * 0.5) out.push(P.type);
        }
      }
      return out;
    },

    setContent(P, type, r) {
      P.type = type;
      // Lines cycle per drawing, so two panels on screen rarely say the same.
      if (!this.textIdx) this.textIdx = {};
      const n = this.textIdx[type] = ((this.textIdx[type] === undefined ? Math.floor(r() * 8) : this.textIdx[type]) + 1);
      P.text = TEXT[type][n % TEXT[type].length];
      P.seed = Math.floor(r() * 100000);
      P.side = r() < 0.5 ? -1 : 1;
    },

    buildPage(W, H) {
      const S = this.S;
      this.tiers = [];
      for (let i = 0; i < S.nTiers; i++) {
        const tier = { idx: i, off: 0, panels: [], lastType: null };
        let x = -S.Wp / 2 - S.th * 0.3;
        let k = 0;
        while (x < S.Wp / 2 + S.th) {
          const P = this.newPanel(tier, x, k);
          tier.panels.push(P);
          x += P.w; k = P.kR;
        }
        this.tiers.push(tier);
      }
      this.layoutKey = S.layoutKey;
    },

    panelQuad(P, tier) {
      const S = this.S;
      const G = S.gut;
      const xl = P.x0 - tier.off, xr = P.x0 + P.w - tier.off;
      const yt = tier.y, yb = tier.y + S.th;
      const hh = S.th / 2;
      return [
        xl + G / 2 + P.kL * hh, yt,
        xr - G / 2 + P.kR * hh, yt,
        xr - G / 2 - P.kR * hh, yb,
        xl + G / 2 - P.kL * hh, yb,
      ];
    },

    drawPanel(g, P, tier) {
      const S = this.S;
      const q = this.panelQuad(P, tier);
      const cx = (q[0] + q[2] + q[4] + q[6]) / 4, cy = tier.y + S.th / 2;
      const w = ((q[2] - q[0]) + (q[4] - q[6])) / 2, h = S.th;
      // Keep captions clear of the frame edge that the page tilt crops.
      S.capInset = 0;
      if (tier.idx === 0) {
        const ca = Math.cos(S.tilt), sn = Math.sin(S.tilt);
        for (const u of [q[0], q[0] + w * 0.6]) {
          const v = (-S.H / 2 - u * sn) / ca;
          S.capInset = Math.max(S.capInset, v - tier.y + 3);
        }
      }
      // Snare: a page turn. The new drawing is revealed behind a slanted fold
      // that sweeps across the panel, with a curled paper flap and its shadow.
      // (v1 flipped the whole panel edge-on like a card, which exposed the
      // gutter and changed the entire panel at once.)
      let u = -1;
      if (P.flip) {
        u = (S.T - P.flip.t0) / 0.55;
        if (u >= 1) { this.setContent(P, P.flip.type, rng(P.flip.seed)); P.flip = null; u = -1; }
      }
      g.save();
      g.translate(cx, cy);
      const quad = () => {
        g.beginPath();
        g.moveTo(q[0] - cx, q[1] - cy);
        g.lineTo(q[2] - cx, q[3] - cy);
        g.lineTo(q[4] - cx, q[5] - cy);
        g.lineTo(q[6] - cx, q[7] - cy);
        g.closePath();
      };
      quad();
      g.save();
      g.clip();
      this.drawContent(g, w, h, P);
      if (u >= 0) {
        const ue = u * u * (3 - 2 * u);
        const sl = w * 0.22 * P.flipDir;
        const X = w * 0.78 - ue * w * 1.56;
        const f = w * 0.07 * Math.sin(Math.PI * ue);
        const x0 = X - sl, x1 = X + sl;         // fold at top and bottom
        g.save();
        g.beginPath();
        g.moveTo(x0, -h / 2 - 4); g.lineTo(w, -h / 2 - 4); g.lineTo(w, h / 2 + 4); g.lineTo(x1, h / 2 + 4);
        g.closePath();
        g.clip();
        const Q = P.flip.preview || (P.flip.preview = this.previewContent(P));
        this.drawContent(g, w, h, Q);
        g.fillStyle = S.pal.ink;
        g.globalAlpha = 0.22;
        g.beginPath();
        g.moveTo(x0, -h / 2 - 4); g.lineTo(x0 + f * 1.5, -h / 2 - 4); g.lineTo(x1 + f * 1.5, h / 2 + 4); g.lineTo(x1, h / 2 + 4);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = S.pal.white;
        g.strokeStyle = S.pal.ink;
        g.lineWidth = S.lw;
        g.beginPath();
        g.moveTo(x0, -h / 2 - 4); g.lineTo(x0 + f, -h / 2 - 4); g.lineTo(x1 + f * 0.7, h / 2 + 4); g.lineTo(x1, h / 2 + 4);
        g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      if (P.burst) this.drawBurst(g, w, h, P);
      g.restore();
      g.strokeStyle = S.pal.ink;
      g.lineWidth = S.lw * 1.25;
      g.lineJoin = 'miter';
      quad();
      g.stroke();
      g.restore();
    },

    drawContent(g, w, h, C) {
      const fn = this['draw' + C.type[0].toUpperCase() + C.type.slice(1)];
      fn.call(this, g, w, h, C);
    },

    turn(P, type, seed, r, tier, list) {
      // Never turn a panel into a copy of itself or of a neighbour.
      const i = tier.panels.indexOf(P);
      const near = [P.type, tier.panels[i - 1] && tier.panels[i - 1].type, tier.panels[i + 1] && tier.panels[i + 1].type].concat(this.typesNear(tier, this.panelX(P, tier)));
      for (let k = 0; k < 8 && near.indexOf(type) >= 0; k++) type = pick(r, list);
      P.flip = { t0: this.T, type, seed };
      P.flipDir = r() < 0.5 ? -1 : 1;
      P.lastFlip = this.T;
    },

    // The visible panel of a tier turned longest ago, preferring panels whose
    // drawing is not already in the wanted set.
    stalest(tier, W, exclude, wanted) {
      let best = null, bd = 1e9;
      for (const P of tier.panels) {
        if (P === exclude || P.flip) continue;
        const x = this.panelX(P, tier);
        if (Math.abs(x) > W * 0.42) continue;
        const d = (P.lastFlip || -100) + (wanted && wanted.indexOf(P.type) >= 0 ? 50 : 0) + Math.abs(x) * 1e-4;
        if (d < bd) { bd = d; best = P; }
      }
      return best;
    },

    previewContent(P) {
      const r = rng(P.flip.seed);
      const Q = Object.assign({}, P);
      this.setContent(Q, P.flip.type, r);
      return Q;
    },

    // Screen x of a panel's centre, in page coordinates.
    panelX(P, tier) { return P.x0 + P.w / 2 - tier.off; },

    nearest(tier, x, exclude) {
      let best = null, bd = 1e9;
      for (const P of tier.panels) {
        if (P === exclude || P.flip) continue;
        const d = Math.abs(this.panelX(P, tier) - x);
        if (d < bd) { bd = d; best = P; }
      }
      return best;
    },

    draw(p, signals, params, ctx) {
      const W = ctx.width, H = ctx.height;
      const g = p.drawingContext;
      const now = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      this.T += dt;
      if (!this.env) this.enter();
      this.listen(signals, dt);
      const e = this.env;
      const push = params.push;
      const pal = PALETTES[Math.max(0, Math.min(PALETTES.length - 1, Math.round(params.palette)))];

      // Page geometry: tilted, oversized so the tilt never shows a corner.
      const tiltA = (-0.035 + 0.008 * Math.sin(this.T * 0.11)) * params.tilt;
      const sa = Math.abs(Math.sin(tiltA));
      const Wp = W + H * sa * 1.2 + 20, Hp = H + W * sa * 1.1 + 10;
      const tierSel = Math.round(params.tiers);
      const nTiers = tierSel === 0 ? Math.max(2, Math.min(3, Math.round((H / W) * 3.4))) : tierSel;
      const gut = Math.max(8, 14 - nTiers * 1.5);
      const th = (Hp - gut * (nTiers + 1)) / nTiers;
      const shortTh = Math.min(th, W * 0.9);
      const S = this.S || (this.S = {});
      S.pal = pal; S.e = e; S.T = this.T; S.push = push; S.drop = clamp01(e.drop * Math.min(1.3, push + 0.3));
      S.Wp = Wp; S.Hp = Hp; S.H = H; S.tilt = tiltA; S.th = th; S.gut = gut; S.nTiers = nTiers;
      S.lw = 2.2 + shortTh * 0.008;
      S.fs = Math.max(11, Math.min(20, shortTh * 0.058));
      S.capInset = 0;
      S.words = Math.round(params.words);
      S.hatSeed = this.hatSeed;
      this.dotSp = Math.max(3, shortTh * 0.028) * params.dots;
      S.layoutKey = nTiers + '|' + Math.round(W) + 'x' + Math.round(H) + '|' + this.pageSeed;
      if (!this.tiers || this.layoutKey !== S.layoutKey) this.buildPage(W, H);

      // Travel: the music changes the page's speed, never jerks it.
      const vT = (7 + 3 * e.pad + 3 * e.bass + 4 * S.drop) * params.speed * (th / 280);
      this.v = this.v === undefined ? vT : ease(this.v, vT, 1.0, dt);
      this.spin = (this.spin || 0) + dt * TAU * (0.45 + 0.35 * S.drop);
      S.spin = this.spin;
      for (const tier of this.tiers) {
        tier.off += this.v * (1 + 0.14 * tier.idx) * dt;
        tier.y = -Hp / 2 + gut + tier.idx * (th + gut);
        for (const P of tier.panels) P.ph = (P.ph + dt * (0.5 + 0.9 * e.bass) * (1 + S.drop)) % 1;
        // Recycle panels that have left and add new ones at the right.
        while (tier.panels.length && tier.panels[0].x0 + tier.panels[0].w - tier.off < -Wp / 2 - th * 0.6) tier.panels.shift();
        let last = tier.panels[tier.panels.length - 1];
        while (last.x0 + last.w - tier.off < Wp / 2 + th * 0.6) {
          const P = this.newPanel(tier, last.x0 + last.w, last.kR);
          tier.panels.push(P);
          last = P;
        }
      }

      // Kick: a burst in one panel of the bottom tier.
      const bottom = this.tiers[this.tiers.length - 1];
      const top = this.tiers[0];
      if (this.kickHit && push > 0.02) {
        const target = this.nearest(bottom, Wp * 0.14, null);
        if (target) {
          const r = rng(++this.kickN * 7 + this.pageSeed);
          target.burst = {
            t0: this.T, amp: clamp01(this.kickHit * push), word: KICK_WORDS[this.kickN % KICK_WORDS.length],
            x: (r() - 0.5) * 0.3, y: (r() - 0.5) * 0.25 + 0.05, rot: (r() - 0.5) * 0.4, seed: this.kickN * 31, alt: this.kickN % 4 === 3,
          };
        }
      }
      // Snare: one visible panel turns over to a new drawing. Tiers take turns
      // and the panel turned longest ago goes next, so over a drop the whole
      // page fills with action panels. The kick's panel is never the one.
      if (this.snareHit && push > 0.02) {
        const kp = this.nearest(bottom, Wp * 0.14, null);
        const tier = this.tiers[this.snareN % this.tiers.length];
        const r = rng(++this.snareN * 13 + this.pageSeed * 3);
        const target = this.stalest(tier, W, kp, S.drop > 0.45 ? ACTION : null);
        if (target) this.turn(target, this.pickType(r, S.drop, null), Math.floor(r() * 1e6), r, tier, S.drop > 0.45 ? ACTION : BUSY);
      }
      // Without snares (intro, breakdown) the page still turns, slowly: an
      // action panel left over from the drop quietly flips to a calm drawing,
      // so the breakdown visibly exhales instead of freezing the drop's page.
      this.quietClock = (this.quietClock || 0) + dt;
      if (this.snareHit) this.quietClock = 0;
      const busyLeft = this.tiers.some((t) => t.panels.some((P) => ACTION.indexOf(P.type) >= 0 && QUIET.indexOf(P.type) < 0 && Math.abs(this.panelX(P, t)) < W * 0.5));
      if (this.quietClock > (busyLeft ? 0.9 : 2.2) && this.since.kick > 1.2) {
        this.quietClock = 0;
        const r = rng(++this.snareN * 13 + this.pageSeed * 5);
        const tier = this.tiers[this.snareN % this.tiers.length];
        const kp = this.nearest(bottom, Wp * 0.14, null);
        const best = this.stalest(tier, W, kp, QUIET);
        if (best) this.turn(best, pick(r, QUIET), Math.floor(r() * 1e6), r, tier, QUIET);
      }
      // Hats: tiny print sparkles, stuck to the page.
      if (this.hatHit && push > 0.02) {
        const r = rng(this.hatSeed * 17 + 3);
        const n = 1 + Math.floor(r() * 2 + S.drop * 2);
        for (let i = 0; i < n; i++) {
          const ti = Math.floor(r() * this.tiers.length);
          const tier = this.tiers[ti];
          this.sparks.push({ tier, wx: tier.off + (r() - 0.5) * W * 0.95, y: tier.y + th * (0.1 + r() * 0.8), t0: this.T, s: (9 + r() * 8 + 5 * this.hatHit) * Math.min(1.5, push) * (th / 280) ** 0.5 });
        }
      }
      this.sparks = this.sparks.filter((s) => this.T - s.t0 < 0.2);

      p.colorMode(p.RGB, 255);
      p.background(pal.gutter);
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.translate(W / 2, H / 2);
      g.rotate(tiltA);
      g.fillStyle = pal.gutter;
      g.fillRect(-Wp / 2 - 40, -Hp / 2 - 40, Wp + 80, Hp + 80);
      for (const tier of this.tiers) {
        for (const P of tier.panels) {
          const xl = P.x0 - tier.off, xr = xl + P.w;
          if (xr < -Wp / 2 - th * 0.5 || xl > Wp / 2 + th * 0.5) continue;
          this.drawPanel(g, P, tier);
        }
      }
      for (const s of this.sparks) {
        const u = (this.T - s.t0) / 0.2;
        const sz = s.s * Math.sin(Math.PI * Math.min(1, u * 1.3));
        if (sz > 0.5) this.star(g, s.wx - s.tier.off, s.y, sz, pal.white);
      }
      g.restore();

      // Newsprint grain over everything, fixed to the screen like the paper.
      if (!this.grain) this.grain = g.createPattern(makeGrain(), 'repeat');
      g.save();
      g.globalAlpha = pal.name === 'Night edition' ? 0.5 : 1;
      g.fillStyle = this.grain;
      g.fillRect(0, 0, W, H);
      g.restore();
    },
  });
})();
