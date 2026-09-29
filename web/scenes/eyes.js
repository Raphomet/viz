// Eye Gallery: every registered signature-eye style (web/motifs/eyes/), side
// by side, so Raph can pick the one that becomes viz's eye (harness/briefs/
// eyes.md). Each eye glances and blinks on its own; the scene's own small
// detectors turn the bands into kick, snare and hat envelopes and hand the
// same music to every eye. `Solo` shows one style full-screen with its idea
// written under it.
//
// Styles load asynchronously (eyes/manifest.js inserts their scripts), so the
// list is read every frame rather than once at setup; the Solo menu is built
// from the registry when the panel first asks for the params, which is after
// window load, by which time every manifest script has run.

(function () {
  const TAU = Math.PI * 2;
  const n0 = (list) => list.length || 1;
  const GROUNDS = [
    { name: 'Dusk', bg: [29, 24, 36], glow: [58, 46, 70], text: [226, 214, 200], dim: [150, 136, 150] },
    { name: 'Paper', bg: [238, 229, 211], glow: [250, 244, 232], text: [52, 40, 40], dim: [128, 110, 100] },
    { name: 'Moss', bg: [42, 56, 48], glow: [66, 84, 70], text: [230, 224, 200], dim: [160, 170, 150] },
  ];

  // Solo options are the style names in manifest order. Cached, and rebuilt
  // only if a style registers after the first read.
  let soloCache = null, soloCount = -1;
  function soloOptions() {
    const list = window.VIZ_EYES ? VIZ_EYES.list() : [];
    if (list.length !== soloCount) {
      soloCount = list.length;
      soloCache = ['All'].concat(list.map((s) => s.name || s.id));
    }
    return soloCache;
  }

  const def = {
    id: 'eyes',
    name: 'Eye Gallery',
    order: 609,

    get params() {
      return [
        { key: 'solo', label: 'Solo (one style full-screen)', type: 'select', options: soloOptions(), default: 0 },
        { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
        { key: 'glance', label: 'Glancing about', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
        { key: 'ground', label: 'Ground', type: 'select', options: GROUNDS.map((g) => g.name), default: 0 },
        { key: 'labels', label: 'Labels', type: 'select', options: ['Off', 'On'], default: 1 },
        { key: 'size', label: 'Eye size in the grid', type: 'range', min: 0.6, max: 1.3, default: 1, step: 0.01 },
        { key: 'perPage', label: 'Eyes per page (pages turn every 8 s)', type: 'range', min: 4, max: 40, default: 40, step: 1 },
        { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
      ];
    },

    presets: {
      calm: { reaction: 0.6, glance: 0.4 },
      drop: { reaction: 1.5, glance: 0.9 },
    },

    gallery: {
      title: 'Eye Gallery',
      technique: 'Canvas 2D. Each style in web/motifs/eyes/ draws one eye (almond opening, shaded sclera, inked lid, catchlight, and its own iris and pupil) through VIZ_EYES.get(id).draw; the gallery lays them out in the grid that makes them largest, keeps a per-eye state and gaze, and feeds every eye kick, snare and hat envelopes from onset detectors on the bass, mid and top bands.',
      brief: 'A contact sheet of candidate signature eyes for viz, each with one weird idea in the pupil or iris that moves with the music. They glance about and blink independently; Solo shows one full-screen with its idea written underneath.',
      lineage: 'Raph (2026-09-28): "Whenever we see eyes, it should be a specific style of eye. Something weird happening in the pupil or iris or something, totally unique. Can you make me a gallery of eyes."',
    },

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.eyes = {};        // per style id: { state, gaze }
      this.det = null;
      this.energy = 0.5;
      this.lastT = null;
    },

    // Onset envelopes from the bands: a band group rising well above its own
    // recent average fires, then decays. Three groups: bass (kick), mids
    // (snare/clap), top (hats).
    detect(bands, dt) {
      if (!this.det) {
        this.det = [0, 1, 2].map(() => ({ avg: 0, prev: 0, env: 0, since: 1 }));
      }
      const groups = [[0, 1], [3, 4, 5], [6, 7, 8]];
      const thr = [14, 10, 8], floor = [35, 25, 18], decay = [0.14, 0.18, 0.08];
      const out = [];
      for (let i = 0; i < 3; i++) {
        const d = this.det[i];
        let v = 0;
        for (const b of groups[i]) v += bands[b];
        v /= groups[i].length;
        d.since += dt;
        if (v - d.avg > thr[i] && v > floor[i] && v > d.prev && d.since > 0.14) {
          d.env = 1;
          d.since = 0;
        } else {
          d.env *= Math.exp(-dt / decay[i]);
        }
        d.avg += (v - d.avg) * Math.min(1, dt * 4);
        d.prev = v;
        out.push(d.env);
      }
      return out;
    },

    // Saccades: hold a gaze for a second or three, then jump quickly to the
    // next, with a little drift while holding. Sometimes back to centre.
    gazeFor(e, t, dt, amount) {
      const G = e.gaze;
      if (t >= G.next) {
        const home = Math.random() < 0.3;
        G.tx = home ? 0 : (Math.random() * 2 - 1);
        G.ty = home ? 0 : (Math.random() * 2 - 1) * 0.7;
        G.next = t + 0.8 + Math.random() * 2.6;
      }
      const k = 1 - Math.exp(-dt / 0.045);
      G.x += (G.tx - G.x) * k;
      G.y += (G.ty - G.y) * k;
      return {
        x: (G.x + 0.05 * Math.sin(t * 0.7 + G.ph)) * amount,
        y: (G.y + 0.05 * Math.cos(t * 0.53 + G.ph)) * amount,
      };
    },

    eyeFor(id, t) {
      let e = this.eyes[id];
      if (!e) {
        e = this.eyes[id] = {
          state: {},
          gaze: { x: 0, y: 0, tx: 0, ty: 0, next: t + Math.random() * 1.5, ph: Math.random() * TAU },
        };
      }
      return e;
    },

    draw(p, signals, params, ctx) {
      if (!this.eyes) this.reset();
      const t = p.millis() / 1000;
      const dt = this.lastT == null ? 1 / 60 : Math.min(0.1, Math.max(0, t - this.lastT));
      this.lastT = t;
      const W = ctx.width, H = ctx.height;
      const G = GROUNDS[Math.round(params.ground) || 0] || GROUNDS[0];
      const g = p.drawingContext;

      // Ground: flat, with a faint lift in the middle so it is not dead.
      p.push();
      p.background(G.bg[0], G.bg[1], G.bg[2]);
      const rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(' + G.glow.join(',') + ',0.55)');
      rg.addColorStop(1, 'rgba(' + G.glow.join(',') + ',0)');
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
      p.pop();

      // Music. `follow` lets the track push the reaction up in loud passages
      // and down in quiet ones; off, only the Reaction knob decides.
      const env = this.detect(signals, dt);
      const loud = (signals[0] + signals[1] + signals[2]) / 300;
      this.energy += (loud - this.energy) * Math.min(1, dt * 0.6);
      const follow = Math.round(params.follow) === 1;
      const gain = params.reaction * (follow ? 0.7 + 0.6 * Math.min(1, this.energy * 1.4) : 1);
      const bands = new Float32Array(9);
      for (let i = 0; i < 9; i++) bands[i] = Math.min(100, signals[i] * Math.min(1.4, 0.3 + 0.7 * gain));
      const a = {
        bands,
        kick: Math.min(1, env[0] * gain),
        snare: Math.min(1, env[1] * gain),
        hat: Math.min(1, env[2] * gain),
      };

      const list = window.VIZ_EYES ? VIZ_EYES.list() : [];
      const labels = Math.round(params.labels) === 1;
      const soloStyle = this.soloStyle(params.solo, list);
      const font = '"IBM Plex Sans Condensed", "Josefin Sans", system-ui, sans-serif';

      if (!list.length) {
        this.caption(g, W / 2, H / 2, 'No eye styles registered yet', 16, G.dim, font);
        return;
      }

      if (soloStyle) {
        const s = soloStyle;
        const e = this.eyeFor(s.id, t);
        const look = this.gazeFor(e, t, dt, params.glance);
        const r = Math.min(W * 0.38, H * (labels ? 0.46 : 0.56));
        const cy = labels ? H * 0.46 : H * 0.5;
        this.drawEye(p, s, W / 2, cy, r, t, a, e.state, look);
        if (labels) {
          this.caption(g, W / 2, H - 58, s.name || s.id, 22, G.text, font);
          this.caption(g, W / 2, H - 30, s.idea || '', 13, G.dim, font, W * 0.8);
        }
        return;
      }

      // Paging, when there are more styles than the page holds.
      const per = Math.max(1, Math.round(params.perPage) || n0(list));
      const pages = Math.ceil(list.length / per);
      const page = pages > 1 ? Math.floor(t / 8) % pages : 0;
      const shown = list.slice(page * per, page * per + per);

      // Grid: the column count that makes the eyes largest. An eye is about
      // 2r wide and, with its lid fold and lashes, about 1.6r tall.
      const n = shown.length;
      const labelH = labels ? 24 : 0;
      const top = pages > 1 && labels ? 22 : 0;
      let best = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cw = W / cols, ch = (H - top) / rows;
        const r = Math.min(cw * 0.4, (ch - labelH) * 0.55);
        if (!best || r > best.r) best = { cols, rows, cw, ch, r };
      }
      const r = best.r * params.size;
      for (let i = 0; i < n; i++) {
        const s = shown[i];
        const row = Math.floor(i / best.cols), col = i % best.cols;
        // Centre a short last row.
        const inRow = row === best.rows - 1 ? n - row * best.cols : best.cols;
        const x0 = (W - inRow * best.cw) / 2;
        const cx = x0 + (col + 0.5) * best.cw;
        const cy = top + (row + 0.5) * best.ch - labelH * 0.5 + r * 0.12;
        const e = this.eyeFor(s.id, t);
        const look = this.gazeFor(e, t, dt, params.glance);
        this.drawEye(p, s, cx, cy, r, t, a, e.state, look);
        if (labels) this.caption(g, cx, cy + r * 0.72 + 12, s.name || s.id, 12, G.text, font);
      }
      if (pages > 1 && labels) this.caption(g, W / 2, 12, 'page ' + (page + 1) + ' of ' + pages, 11, G.dim, font);
    },

    // Solo takes the menu index (the panel's value) or, for the render
    // harness's --params, a style id or name as a string. The harness clamps a
    // select to a number before the scene sees it, so the string is read back
    // from the page's own ?params= when the index says "All".
    soloStyle(v, list) {
      const byKey = (k) => list.find((s) => s.id === k || (s.name || '').toLowerCase() === String(k).toLowerCase()) || null;
      if (typeof v === 'string' && isNaN(Number(v))) return byKey(v);
      const i = Math.round(Number(v)) || 0;
      if (i > 0) return list[i - 1] || null;
      if (this.urlSolo === undefined) {
        this.urlSolo = null;
        try {
          const raw = new URLSearchParams(window.location.search).get('params');
          const o = raw ? JSON.parse(raw) : null;
          if (o && typeof o.solo === 'string' && isNaN(Number(o.solo))) this.urlSolo = o.solo;
        } catch (e) { /* no usable query: leave solo to the index */ }
      }
      return this.urlSolo ? byKey(this.urlSolo) : null;
    },

    // A style that throws is shown as a cross, once logged, rather than taking
    // the whole gallery down with it.
    drawEye(p, s, x, y, r, t, a, state, look) {
      if (state.broken) return this.broken(p, x, y, r);
      try {
        s.draw(p, x, y, r, t, a, state, look);
      } catch (err) {
        state.broken = true;
        console.error('eyes: style ' + s.id + ' threw', err);
      }
    },

    broken(p, x, y, r) {
      const g = p.drawingContext;
      g.save();
      g.strokeStyle = 'rgba(200,80,80,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - r * 0.3, y - r * 0.3); g.lineTo(x + r * 0.3, y + r * 0.3);
      g.moveTo(x + r * 0.3, y - r * 0.3); g.lineTo(x - r * 0.3, y + r * 0.3);
      g.stroke();
      g.restore();
    },

    caption(g, x, y, text, size, col, font, maxW) {
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.font = '500 ' + size + 'px ' + font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgb(' + col.join(',') + ')';
      if (maxW && g.measureText(text).width > maxW) {
        // Two lines for a long idea.
        const words = text.split(' ');
        let line = '', lines = [];
        for (const w of words) {
          const tryL = line ? line + ' ' + w : w;
          if (g.measureText(tryL).width > maxW && line) { lines.push(line); line = w; } else line = tryL;
        }
        lines.push(line);
        lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1) / 2) * size * 1.3));
      } else {
        g.fillText(text, x, y);
      }
      g.restore();
    },
  };

  VIZ.register(def);
})();
