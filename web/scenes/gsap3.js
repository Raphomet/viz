// Title Card (GSAP 3 of 5): kinetic type, the thing GSAP is most used for,
// played as an opening-titles sequence that never reaches the film. Every two
// bars a new card arrives: coloured slabs wipe across with an expo ease in a
// staggered staircase, the title's letters rise from behind a mask line with
// a back ease, a rule draws under them, the credit line tracks in from wide
// letter-spacing, and a dot lands with an elastic. Before the next card the
// letters drop away, last letter first. All of it is one GSAP timeline per
// card, authored in beats and scrubbed by the beat clock, so the wipes land
// on the one.
//
// Music, each in its own place:
//   kick   one letter of the title leaps and lands with squash and stretch
//          (CustomBounce), a different letter each kick
//   clap   the accent dot pops and a second rule flicks across under it
//   hats   the credit line shimmers letter by letter
//   bass   a slow push-in on the card; stripes in the slabs run faster
//   drop   a card every bar, letters spin in on an elastic from random order,
//          two marquee bands of outlined type stream behind, more slabs
//
// How it is made: GSAP 3.14.2 (web/gsap-kit.js): timelines, staggers with
// `from`, expo/back/elastic eases, CustomBounce's paired bounce and squash
// eases. Letters are plain objects GSAP tweens; the canvas draws them with
// fillText, clipped to the slabs and to the mask line. Wording is invented.

(function () {
  'use strict';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + (b || 0) * 311.7 + 7.7) * 43758.5453; return x - Math.floor(x); };

  // Each palette is five inks; each card takes a [ground, type, accent]
  // triple from its schemes, so consecutive cards change colour like a
  // sequence of title cards cut together.
  const PALETTES = [
    { name: 'Orange & black', inks: ['#E5482D', '#F3E8D0', '#1C1B1A', '#F1B233', '#2D5C8A'], schemes: [[0, 1, 2], [1, 2, 0], [2, 1, 3], [3, 2, 0], [4, 1, 3]] },
    { name: 'Teal & mustard', inks: ['#1E6E6B', '#F1E7CF', '#23262B', '#E3A72F', '#D8553A'], schemes: [[0, 1, 3], [1, 2, 4], [3, 2, 1], [2, 3, 4], [4, 1, 2]] },
    { name: 'Red on cream', inks: ['#F2EADB', '#171615', '#D22F2B', '#E6DBC5', '#171615'], schemes: [[0, 1, 2], [2, 0, 1], [1, 0, 2], [3, 2, 1]] },
    { name: 'Pink & navy', inks: ['#F2C4C0', '#1D2A4D', '#F7EFE4', '#6CB8A0', '#E5553F'], schemes: [[0, 1, 4], [1, 2, 0], [2, 1, 3], [3, 1, 2], [1, 3, 0]] },
  ];

  const CARDS = [
    ['HALF LIGHT', 'starring everyone on the floor'],
    ['LONG DIVISION', 'music by the room'],
    ['COPPER HOUR', 'a picture in three colours'],
    ['MOTH & LANTERN', 'produced after midnight'],
    ['WIDE AWAKE', 'in order of appearance'],
    ['THE BIG QUIET', 'costumes by the weather'],
    ['SECOND SUMMER', 'filmed on location, right here'],
    ['ORANGE SEASON', 'with the kind participation of the bass'],
    ['GLASSHOUSE', 'titles set on the beat'],
    ['UNDER THE HUM', 'a viz production'],
  ];
  const FACES = [
    { f: 'Anton', w: 400, cap: 0.73 }, { f: 'Abril Fatface', w: 400, cap: 0.7 }, { f: 'Syne', w: 700, cap: 0.7 },
    { f: 'Archivo Black', w: 400, cap: 0.72 }, { f: 'Playfair Display', w: 700, cap: 0.71, it: true }, { f: 'Rubik Mono One', w: 400, cap: 0.72 },
  ];
  const fontStr = (F, px) => (F.it ? 'italic ' : '') + F.w + ' ' + px.toFixed(1) + 'px "' + F.f + '", Impact, sans-serif';
  const FROMS = ['start', 'center', 'end', 'edges'];

  const PRESETS = {
    calm: { energy: 0, marquee: 0, push: 0.6 },
    drop: { energy: 1, marquee: 1, push: 1.4 },
    // Long cards and a lot of type behind: for a slow, wordy passage.
    credits: { energy: 0.2, marquee: 1, push: 0.3, palette: 2 },
  };
  const DRIVE = ['energy', 'marquee', 'push'];

  function bootGsap(p) {
    const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
    if (hold) p._incrementPreload();
    const kit = window.VIZ_GSAP ? Promise.resolve() : new Promise((res) => {
      const s = document.createElement('script'); s.src = 'gsap-kit.js'; s.onload = s.onerror = res; document.head.appendChild(s);
    });
    kit.then(() => (window.VIZ_GSAP ? window.VIZ_GSAP.load() : null)).then(() => { if (hold) p._decrementPreload(); });
  }

  VIZ.register({
    id: 'gsap3',
    name: 'Title Card',
    order: 1108,
    params: [
      { key: 'palette', label: 'Inks', type: 'select', options: PALETTES.map((q) => q.name), default: 0 },
      { key: 'energy', label: 'Drop', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'marquee', label: 'Marquee', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'push', label: 'Push-in', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'reaction', label: 'Letter hop', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'title', label: 'Title (blank = rotate)', type: 'text', default: '' },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    gallery: {
      title: 'Title Card',
      technique: 'GSAP 3.14.2 kinetic type: one timeline per title card authored in beats (staggered expo.inOut slab wipes, per-letter back.out rises from behind a mask with stagger from start/centre/end/edges, an expo tracking-in credit line, an elastic dot, a staggered exit), scrubbed by a phase-locked beat clock; CustomBounce bounce-plus-squash eases for the kick\'s letter hop; drawn with canvas fillText clipped to the slabs',
      brief: 'An opening-titles sequence for a film that never starts. Every two bars a new card cuts in: flat slabs of colour wipe across in a staggered staircase, an invented title rises letter by letter from behind a mask line, a rule draws under it, a small credit tracks in from wide spacing and a dot lands with a spring; then the letters fall away, last first, as the next card wipes over. The kick makes one letter leap and land with squash and stretch, a different one each time; the clap pops the dot and flicks a second rule; hats shimmer the credit. In the drop a card arrives every bar, letters spin in from random order, and two marquee bands of outlined type stream behind.',
      lineage: 'Mid-century title design (Saul Bass, Pablo Ferro) by way of After Effects kinetic type; GSAP\'s timeline, per-letter staggers and eases are the medium, and CustomBounce\'s paired squash ease is what gives the hop its weight.',
    },

    preload(p) { bootGsap(p); },
    setup() {},
    enter() {},

    build() {
      const gsap = window.gsap;
      if (!window.CustomEase.get('vizHop')) {
        window.CustomBounce.create('vizHop', { strength: 0.55, squash: 2.2, endAtStart: true });
      }
      this.hop = { y: 0, sx: 1, sy: 1 };
      const ht = gsap.timeline({ paused: true });
      ht.to(this.hop, { y: -1, duration: 1.1, ease: 'vizHop' }, 0)
        .to(this.hop, { sx: 1.35, sy: 0.7, duration: 1.1, ease: 'vizHop-squash' }, 0);
      ht.progress(1).progress(0);
      this.ht = ht;
      this.clap = { s: 0, r0: 0, r1: 0 };
      const ct = gsap.timeline({ paused: true });
      ct.fromTo(this.clap, { s: 1.6 }, { s: 1, duration: 0.8, ease: 'elastic.out(1,0.35)' }, 0)
        .fromTo(this.clap, { r1: 0 }, { r1: 1, duration: 0.35, ease: 'expo.out' }, 0)
        .fromTo(this.clap, { r0: 0 }, { r0: 1, duration: 0.5, ease: 'expo.in' }, 0.3);
      ct.progress(1).progress(0);
      this.ct = ct;
      this.clock = window.VIZ_GSAP.createClock();
      this.cards = [];
      this.cardN = 0;
      this.nextStart = null;
      this.lastSnare = -99;
      this.built = true;
    },

    // One card: its look is decided now, its motion is one timeline in card
    // units (8 = the card's length; 1.2 more for the next card's wipe).
    makeCard(start, beats, E, params, pal) {
      const gsap = window.gsap;
      const n = this.cardN++;
      const custom = (params.title || '').trim().toUpperCase();
      const pair = CARDS[n % CARDS.length];
      const text = custom || pair[0];
      const sc = pal.schemes[n % pal.schemes.length];
      const card = {
        n, start, beats, text, credit: pair[1], face: FACES[(n * 7 + 3) % FACES.length],
        bg: pal.inks[sc[0]], fg: pal.inks[sc[1]], acc: pal.inks[sc[2]],
        dir: n % 4, spin: E > 0.5, panels: [], chars: [],
        shape: { s: 0, r: 0 }, kind: n % 4, rule: { x0: 0, x1: 0 }, credit2: { track: 1, a: 0 }, dot: { s: 0 }, push: { z: 0 },
      };
      const np = E > 0.5 ? 7 : 4;
      for (let i = 0; i < np; i++) card.panels.push({ s: 0, w: 1 + hash(n, i) * 0.8 });
      const sum = card.panels.reduce((a, q) => a + q.w, 0);
      let acc = 0;
      card.panels.forEach((q) => { q.a = acc / sum; acc += q.w; q.b = acc / sum; });
      for (const ch of text) card.chars.push({ ch, y: 1.15, r: card.spin ? (hash(n, ch.charCodeAt(0)) - 0.5) * 3 : 0, s: card.spin ? 0.2 : 1 });

      const tl = gsap.timeline({ paused: true });
      tl.to(card.panels, { s: 1, duration: 1.15, ease: 'expo.inOut', stagger: { each: 0.09, from: n % 2 ? 'end' : 'start' } }, 0);
      const from = card.spin ? 'random' : FROMS[n % FROMS.length];
      tl.to(card.chars, { y: 0, duration: 0.9, ease: card.spin ? 'back.out(2.2)' : 'back.out(1.6)', stagger: { each: 0.06, from } }, 0.85);
      if (card.spin) tl.to(card.chars, { r: 0, s: 1, duration: 1.3, ease: 'elastic.out(1,0.45)', stagger: { each: 0.06, from } }, 0.85);
      tl.to(card.rule, { x1: 1, duration: 1.3, ease: 'expo.inOut' }, 1.1);
      tl.to(card.credit2, { track: 0, a: 1, duration: 2.4, ease: 'expo.out' }, 1.7);
      tl.to(card.dot, { s: 1, duration: 1, ease: 'elastic.out(1,0.4)' }, 2.1);
      tl.to(card.push, { z: 1, duration: 9.2, ease: 'none' }, 0);
      tl.to(card.shape, { s: 1, duration: 1.6, ease: 'expo.out' }, 0.6);
      tl.to(card.shape, { r: 1, duration: 8.6, ease: 'none' }, 0.6);
      tl.to(card.chars, { y: -1.15, duration: 0.6, ease: 'expo.in', stagger: { each: 0.035, from: 'end' } }, 7.05);
      tl.to(card.rule, { x0: 1, duration: 0.7, ease: 'expo.in' }, 7.0);
      tl.to(card.credit2, { a: 0, track: -0.3, duration: 0.5, ease: 'power2.in' }, 7.1);
      tl.to(card.dot, { s: 0, duration: 0.5, ease: 'back.in(2)' }, 7.2);
      tl.progress(1).progress(0);
      card.tl = tl;
      return card;
    },

    draw(p, signals, params, ctx) {
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const pal = PALETTES[clamp(Math.round(params.palette), 0, PALETTES.length - 1)];
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]);
      g.fillStyle = pal.inks[pal.schemes[0][0]]; g.fillRect(0, 0, W, H);
      if (!window.VIZ_GSAP || !window.VIZ_GSAP.ready) { g.restore(); return; }
      if (!this.built) this.build();

      const t = p.millis() / 1000;
      const follow = Math.round(params.follow) === 1;
      const c = this.clock.update(signals, t, follow);
      const P = window.VIZ_GSAP.drive(params, PRESETS.drop, DRIVE, follow ? c.auto : 0);
      const E = clamp(P.energy, 0, 1);
      const pos = c.pos;
      this.react = params.reaction;

      // A card's wipe starts a beat before a bar line and lands on it.
      if (this.nextStart === null) this.nextStart = Math.ceil(pos / 4) * 4 - 1.1;
      if (pos >= this.nextStart) {
        const beats = E > 0.5 ? 4 : 8;
        this.cards.push(this.makeCard(this.nextStart, beats, E, params, pal));
        if (this.cards.length > 2) this.cards.shift().tl.kill();
        this.nextStart += beats;
      }
      if (c.snare) this.lastSnare = t;
      this.ct.time(clamp((t - this.lastSnare) * c.bpm / 60, 0, this.ct.duration()));

      // Marquee bands behind everything on the current card.
      for (let k = 0; k < this.cards.length; k++) {
        const card = this.cards[k];
        const tau = (pos - card.start) * 8 / card.beats;
        card.tl.time(clamp(tau, 0, card.tl.duration()));
        this.drawCard(g, card, tau, W, H, c, P, t, k === this.cards.length - 1);
      }
      g.restore();
    },

    drawCard(g, card, tau, W, H, c, P, t, isTop) {
      const vertical = card.dir % 2 === 0;
      const rev = card.dir >= 2;
      // ---- the slabs, and a clip to them for everything else on the card
      const clip = new Path2D();
      for (const q of card.panels) {
        if (q.s <= 0) continue;
        if (vertical) {
          const x0 = q.a * W, x1 = q.b * W + 1, h = H * q.s;
          clip.rect(x0, rev ? H - h : 0, x1 - x0, h);
        } else {
          const y0 = q.a * H, y1 = q.b * H + 1, w = W * q.s;
          clip.rect(rev ? W - w : 0, y0, w, y1 - y0);
        }
      }
      g.save();
      g.clip(clip);
      g.fillStyle = card.bg; g.fillRect(0, 0, W, H);

      // Stripes in the ground, sliding (the camera's travel).
      g.save();
      g.globalAlpha = 0.07;
      g.fillStyle = card.fg;
      const sp = 38, off = ((t * (14 + 40 * c.bass) * (0.5 + P.push)) % sp);
      g.beginPath();
      for (let x = -H - sp + off; x < W + sp; x += sp) { g.moveTo(x, 0); g.lineTo(x + 12, 0); g.lineTo(x + 12 + H, H); g.lineTo(x + H, H); g.closePath(); }
      g.fill();
      g.restore();

      const F = card.face;
      const S = Math.min(W, H);
      // Push-in: the whole card drifts closer across its life.
      const z = 1 + card.push.z * 0.08 * P.push;
      g.translate(W / 2, H * 0.47);
      g.scale(z, z);

      // ---- one big graphic shape behind the title, a Bass-style second plane
      if (card.shape.s > 0.001) {
        const q = card.shape, R = S * 0.62 * q.s;
        g.save();
        g.fillStyle = card.acc;
        g.globalAlpha = 0.22;
        const side = card.n % 2 ? 1 : -1;
        if (card.kind === 0) { g.beginPath(); g.arc(side * W * 0.24, -S * 0.05, R, 0, Math.PI * 2); g.fill(); }
        else if (card.kind === 1) { g.rotate(-0.5 + q.r * 0.25); g.fillRect(-W, -S * 0.11 * q.s, W * 2, S * 0.22 * q.s); }
        else if (card.kind === 2) { g.beginPath(); g.arc(0, S * 0.62, R * 1.1, Math.PI, 0); g.fill(); }
        else {
          g.lineWidth = S * 0.06 * q.s; g.strokeStyle = card.acc;
          g.beginPath(); g.arc(side * W * 0.22, 0, R * 0.75, -Math.PI / 2 + q.r * 1.2, -Math.PI / 2 + q.r * 1.2 + Math.PI * 2 * Math.min(1, q.s * 1.1)); g.stroke();
        }
        g.restore();
      }

      // ---- marquee bands of outlined type (the drop's extra layer)
      const mq = clamp(P.marquee, 0, 1);
      if (mq > 0.01) {
        const px = S * 0.2;
        g.font = fontStr(F, px);
        g.lineWidth = 1.4;
        g.strokeStyle = card.fg;
        g.globalAlpha = 0.45 * mq;
        const line = (card.text + '  •  ').repeat(4);
        const lw = g.measureText(card.text + '  •  ').width;
        for (let b = -1; b <= 1; b += 2) {
          const sh = ((t * 60 * b * (0.6 + c.bass)) % lw + lw) % lw;
          g.strokeText(line, -W / z - sh, b * S * 0.36 + px * 0.36);
        }
        g.globalAlpha = 1;
      }

      // ---- the title
      g.font = fontStr(F, 100);
      let tw = g.measureText(card.text).width;
      const px = Math.min(S * 0.3, (W * 0.8) / (tw / 100));
      g.font = fontStr(F, px);
      tw = g.measureText(card.text).width;
      const cap = px * F.cap;
      const base = cap * 0.5;
      g.save();
      // The mask line: letters rise from below it and leave above.
      g.beginPath(); g.rect(-W, base - cap * 1.25, W * 2, cap * 1.25 + px * 0.06); g.clip();
      g.fillStyle = card.fg;
      g.textBaseline = 'alphabetic'; g.textAlign = 'center';
      let x = -tw / 2;
      const hopIdx = c.kickCount % Math.max(1, card.chars.length);
      const hopOn = isTop && tau > 2.2 && tau < 6.8;
      const sk = c.sinceKick(t);
      this.ht.time(clamp(sk, 0, this.ht.duration()));
      const react = clamp(this.react, 0, 2);
      for (let i = 0; i < card.chars.length; i++) {
        const q = card.chars[i];
        const w = g.measureText(q.ch).width;
        const cx = x + w / 2;
        x += w;
        if (q.ch === ' ') continue;
        g.save();
        let y = base + q.y * cap * 1.3, sx = q.s, sy = q.s;
        if (hopOn && i === hopIdx && sk < 1.1) {
          y += this.hop.y * cap * 0.32 * react;
          sx *= 1 + (this.hop.sx - 1) * react; sy *= 1 + (this.hop.sy - 1) * react;
        }
        g.translate(cx, y);
        g.rotate(q.r);
        g.scale(sx, sy);
        g.fillText(q.ch, 0, 0);
        g.restore();
      }
      g.restore();

      // ---- rule, credit, dot
      const ry = base + px * 0.14;
      g.fillStyle = card.acc;
      const rx0 = -tw / 2 + tw * card.rule.x0, rx1 = -tw / 2 + tw * card.rule.x1;
      if (rx1 > rx0) g.fillRect(rx0, ry, rx1 - rx0, Math.max(2, px * 0.035));
      if (isTop) {
        const k0 = this.clap.r0, k1 = this.clap.r1;
        if (k1 > k0) g.fillRect(-tw / 2 + tw * k0, ry + px * 0.07, tw * (k1 - k0), Math.max(1.5, px * 0.02));
      }
      const cr = card.credit2;
      if (cr.a > 0.01) {
        const cpx = Math.max(10, S * 0.028);
        g.font = '300 ' + cpx.toFixed(1) + 'px "Josefin Sans", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'top';
        const tr = cpx * (0.25 + 1.6 * Math.max(0, cr.track));
        const txt = card.credit.toUpperCase();
        // Hats shimmer the credit letter by letter; set by hand so tracking
        // and shimmer can both act on each letter.
        g.font = '300 ' + cpx.toFixed(1) + 'px "Josefin Sans", sans-serif';
        let total = 0;
        const ws = [];
        for (const ch of txt) { const w = g.measureText(ch).width; ws.push(w); total += w + tr; }
        let cx = -total / 2;
        g.fillStyle = card.fg;
        for (let i = 0; i < txt.length; i++) {
          const sh = hash(i, Math.floor(t * 14));
          g.globalAlpha = cr.a * (1 - 0.8 * c.hat * (sh > 0.6 ? 1 : 0));
          g.fillText(txt[i], cx + ws[i] / 2, ry + px * 0.2);
          cx += ws[i] + tr;
        }
        g.globalAlpha = 1;
      }
      const ds = card.dot.s * (isTop ? this.clap.s : 1);
      if (ds > 0.01) {
        g.fillStyle = card.acc;
        g.beginPath(); g.arc(tw / 2 + px * 0.16, base - cap * 0.08, px * 0.075 * ds, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    },
  });
})();
