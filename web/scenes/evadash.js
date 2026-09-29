// Sync Ratio — the track as a 1990s anime command-centre display.
//
// A black board of framed panels in hot orange, amber and red against one cold
// green: tabbed labels in Japanese and English, heavy condensed numerals,
// hexagon tiles, warning tape, a scrolling log, an oscilloscope. It borrows the
// grammar of that era's tactical screens (Raph's sketch idea, 2026-09-28) and
// none of any show's property: every word, mark and layout here is invented and
// is about the music.
//
// Every panel reads a real signal, so the board is a live instrument panel of
// the track rather than set dressing:
//   kick   → the PULSE tile blinks and the counter ticks; the tempo readout is
//            the median of recent kick intervals; the phrase countdown steps.
//   clap   → a different tile (cold green) and a cluster of hexes struck white.
//   hats   → single indicator lamps in the header flick on (sparkle).
//   bands  → hex field, segmented spectrum, oscilloscope, history strip.
//   build  → tension (top bands + kick presence) raises the sync ratio and
//            brings in the warning tape and a blinking WARNING panel.
//   drop   → the sidechained bass line (band 1) flips the board to alert: frames
//            go red, the giant vertical title slams into its own panel, the
//            EMERGENCY panel blinks with the kicks.
//   breakdown → the board cools to a green stand-by state.
// Alerts flash as panels, never the whole frame (TASTE: kick visible but
// confined; no full-screen strobing).
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const easeOut = (u) => 1 - Math.pow(1 - clamp01(u), 3);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';
  const pad = (n, w) => { let s = String(Math.max(0, Math.floor(n))); while (s.length < w) s = '0' + s; return s; };

  function face(fam, fb) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fb;
  }
  // Japanese comes from system fonts: a heavy Mincho where there is one, then
  // any serif CJK face, then whatever serif the browser has, which still
  // carries the glyphs on every OS we project from.
  const JP = '"Hiragino Mincho ProN", "Hiragino Mincho Pro", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", "Source Han Serif JP", "MS PMincho", serif';

  // Board colours. `warm` is the ordinary frame colour, `cold` the stand-by and
  // oscilloscope colour, `hot` the alert.
  const SCHEMES = [
    { name: 'Tactical (orange, green)', bg: [5, 3, 2], warm: [255, 112, 22], amber: [255, 182, 36], hot: [255, 34, 22], cold: [66, 255, 128], ink: [255, 238, 214] },
    { name: 'Night watch (green, amber)', bg: [2, 5, 3], warm: [80, 255, 140], amber: [214, 255, 96], hot: [255, 64, 40], cold: [90, 200, 255], ink: [226, 255, 232] },
    { name: 'Ice (cyan, amber)', bg: [2, 4, 7], warm: [110, 200, 255], amber: [226, 240, 255], hot: [255, 46, 84], cold: [255, 176, 44], ink: [236, 246, 255] },
  ];

  // The three board states and their words. Index = mode.
  const MODES = [
    { jp: '待機', en: 'STAND BY', tape: 'SYSTEM NOMINAL · 全系統正常 · AWAITING SIGNAL' },
    { jp: '上昇', en: 'ASCENT', tape: 'WARNING · 同期上昇中 · SYNC RISING · 警戒態勢' },
    { jp: '', en: 'CRITICAL', tape: 'EMERGENCY · 信号臨界 · FULL SIGNAL · 全帯域飽和' },
  ];
  const BAND_JP = ['超低', '低音', '低中', '中低', '中音', '中高', '高中', '高音', '超高'];

  const PRESETS = {
    calm: { alert: 0, telemetry: 0.6, scan: 0.35, response: 1 },
    drop: { alert: 1, telemetry: 1.8, scan: 0.55, response: 1.2 },
  };
  // Params the drop moves; while following, they ease toward the drop preset.
  const DRIVE = ['alert', 'telemetry', 'scan', 'response'];

  const HIST = 240;          // history strip: 8 s at 30 samples a second
  const HIST_RATE = 30;

  VIZ.register({
    id: 'evadash',
    name: 'Sync Ratio',
    order: 607,

    params: [
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
      { key: 'alert', label: 'Alert state', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'scheme', label: 'Board colours', type: 'select', options: SCHEMES.map((s) => s.name), default: 0 },
      { key: 'title', label: 'Drop title (vertical)', type: 'text', default: '臨界' },
      { key: 'telemetry', label: 'Telemetry rate', type: 'range', min: 0.2, max: 3, default: 0.6, step: 0.01 },
      { key: 'response', label: 'Music response', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'scan', label: 'Scanlines', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Sync Ratio',
      technique: 'Canvas 2D board of tabbed panels laid out on a proportional grid: honeycomb tile field, segmented spectrum with peak hold, additive-sine oscilloscope, rolling 8 s history, scrolling event log, warning tape; onset detectors for kick, clap and hats, a tempo estimate from kick intervals, and a section follower that drives the board between stand-by, ascent and critical',
      brief: 'The track as a 1990s anime command-centre display: black ground, hot orange and red against a cold green, stacked Japanese and English labels, hexagon tiles, warning tape, blinking alert panels and a sync ratio climbing toward 100%. Every panel is a real readout: the kick blinks the PULSE tile, ticks the counter and steps the phrase countdown; the clap strikes a different tile and a cluster of hexes; hats flick indicator lamps; the build raises the sync ratio and runs the warning tape; the drop flips the board red, slams a giant vertical title into its panel and blinks EMERGENCY with the kicks; the breakdown cools to a green stand-by board.',
      lineage: 'Raph\'s sketch idea "Evangelion UX inspired music dashboard" (harness/briefs/sketches.md, 2026-09-28): the tactical-display grammar of mid-1990s anime (tabbed panels, heavy condensed type stacked vertically in two scripts, honeycomb tiles, warning chevrons, klaxon bars) with all wording, marks and layout invented and about the music; no organisations, characters, logos, catchphrases or specific screens. Iterations at 640x360: the sync-ratio numerals mixed green and orange into olive, so they now take the board colour; the drop follower flapped between critical and stand-by in the sidechain rests, so it now leaves only after 0.35 s below its floor; leaving the drop goes straight to stand-by instead of passing through ascent; the slam\'s panel flash hid the title, so it is shorter and lighter. Jolt (seed 1, 640x360): calm, drop kickArea 0.14, ratio 1.30; build kick area 0.16, ratio 1.11.',
    },

    setup() { this.reset(); },
    enter() { this.reset(); },

    reset() {
      this.env = {
        kf: 0, ks: 0, kWait: 0, cf: 0, cs: 0, cWait: 0, hf: 0, hs: 0, hWait: 0,
        low: 0, dropOn: false, hadDrop: false, hi: 0, kAvg: 0, lvl: 0,
        tension: 0, sync: 8, auto: 0,
        sb: 1, asc: 0, crit: 0,
      };
      this.mode = 0; this.modeT = -9; this.prevMode = 0; this.slamT = -9;
      this.kicks = 0; this.claps = 0; this.kickT = -9; this.clapT = -9;
      this.kickTimes = []; this.tempo = 0;
      this.sm = new Float32Array(9); this.peak = new Float32Array(9); this.peakT = new Float32Array(9);
      this.hk = new Float32Array(HIST); this.hh = new Float32Array(HIST); this.hm = new Uint8Array(HIST);
      this.hIdx = 0; this.hAcc = 0; this.hMaxK = 0; this.hMaxH = 0;
      this.lamps = new Float32Array(32);
      this.impacts = [];
      this.osc = new Float32Array(9);
      this.log = []; this.scroll = 0; this.scanAcc = 0; this.lineNo = 0;
      this.t0 = null; this.lastT = null;
      this.fontFrame = -99;
      this.addLog('BOOT 音響同期監視系 REV 2.6', 'ink');
      this.addLog('CALIBRATING 9 BANDS ...... OK', 'dim');
      this.addLog('PHASE LOCK ........... OK', 'dim');
      this.addLog('AWAITING SIGNAL 信号待機', 'cold');
    },

    addLog(text, kind) {
      this.lineNo++;
      this.log.push({ text: pad(this.lineNo, 4) + ' ' + text, kind });
      if (this.log.length > 60) this.log.shift();
      this.scroll += 1;
    },

    listen(sig, dt, t, R) {
      const e = this.env;
      // Kick: fast minus slow envelope on band 0, refractory so a kick's own
      // decay never fires twice.
      const k = sig[0] / 100;
      e.kf = ease(e.kf, k, 40, dt); e.ks = ease(e.ks, k, 3, dt);
      e.kWait = Math.max(0, e.kWait - dt);
      if (e.kf - e.ks > 0.12 && e.kWait === 0) {
        this.kicks++; this.kickT = t; e.kWait = 0.2;
        const kt = this.kickTimes; kt.push(t);
        if (kt.length > 12) kt.shift();
        const iv = [];
        for (let i = 1; i < kt.length; i++) { const d = kt[i] - kt[i - 1]; if (d > 0.28 && d < 1.2) iv.push(d); }
        if (iv.length >= 3) { iv.sort((a, b) => a - b); this.tempo = 60 / iv[iv.length >> 1]; }
        if (this.kicks % 4 === 1) this.addLog('PULSE ' + pad(this.kicks, 4) + '  低音 ' + pad(sig[0], 3) + '  ' + (this.mode === 2 ? '過負荷' : 'OK'), 'warm');
      }
      // Clap / snare: bands 3–5.
      const c = (sig[3] + sig[4] + sig[5]) / 300;
      e.cf = ease(e.cf, c, 30, dt); e.cs = ease(e.cs, c, 2.5, dt);
      e.cWait = Math.max(0, e.cWait - dt);
      if (e.cf - e.cs > 0.08 && e.cWait === 0) {
        this.claps++; this.clapT = t; e.cWait = 0.3;
        this.impacts.push({ t, seed: this.claps * 7.31 });
        if (this.impacts.length > 4) this.impacts.shift();
        if (this.claps % 2 === 1) this.addLog('IMPACT 衝撃 ' + pad(this.claps, 3) + '  MID ' + pad(sig[4], 3), 'cold');
      }
      // Hats: each onset lights a few header lamps.
      const h = (sig[6] + sig[7] + sig[8]) / 300;
      e.hf = ease(e.hf, h, 45, dt); e.hs = ease(e.hs, h, 4, dt);
      e.hWait = Math.max(0, e.hWait - dt);
      if (e.hf - e.hs > 0.05 && e.hWait === 0) {
        const n = this.lamps.length;
        for (let i = 0; i < 3; i++) this.lamps[Math.floor(hash(t * 13.7 + i * 3.1) * n) % n] = 1;
        e.hWait = 0.09;
      }
      for (let i = 0; i < this.lamps.length; i++) this.lamps[i] = Math.max(0, this.lamps[i] - dt * 3.2);

      // Displayed bands: fast attack, slower release so readouts don't flicker.
      for (let b = 0; b < 9; b++) {
        const v = clamp01(sig[b] / 100 * R);
        this.sm[b] = v > this.sm[b] ? ease(this.sm[b], v, 30, dt) : ease(this.sm[b], v, 7, dt);
        if (this.sm[b] >= this.peak[b]) { this.peak[b] = this.sm[b]; this.peakT[b] = t; }
        else if (t - this.peakT[b] > 0.6) this.peak[b] = Math.max(this.sm[b], this.peak[b] - dt * 0.5);
      }

      // Section follower. The drop is the sidechained bass line on band 1,
      // with hysteresis; the build is top-band energy plus kick presence.
      e.low = ease(e.low, sig[1], sig[1] > e.low ? 1.2 : 2.5, dt);
      if (!e.dropOn && e.low > 27) { e.dropOn = true; e.hadDrop = true; }
      // Off only after a sustained 0.35 s below the floor: the sidechain's
      // rests dip the follower early in the drop and made the board flap.
      e.offT = e.dropOn && e.low < 19 ? (e.offT || 0) + dt : 0;
      if (e.dropOn && e.offT > 0.35) e.dropOn = false;
      e.hi = ease(e.hi, h, 1.2, dt);
      e.kAvg = ease(e.kAvg, k, 2, dt);
      let lv = 0; for (let b = 0; b < 9; b++) lv += sig[b];
      e.lvl = ease(e.lvl, lv / 900, 1.5, dt);
      e.tension = ease(e.tension, clamp01((e.hi - 0.05) * 2.2 + (e.kAvg - 0.04) * 2.5), 2, dt);
      let mode = this.mode;
      if (e.dropOn) mode = 2;
      // Leaving the drop is the breakdown: stand by, and hold off the ascent
      // for a moment while the drop's own kick and hats decay out of tension.
      else if (mode === 2) { mode = 0; this.calmUntil = t + 2.5; }
      else if (mode === 0 && e.tension > 0.2 && t > (this.calmUntil || 0)) mode = 1;
      else if (mode === 1 && e.tension < 0.1) mode = 0;
      if (mode !== this.mode) {
        this.prevMode = this.mode; this.mode = mode; this.modeT = t;
        if (mode === 2) this.slamT = t;
        this.addLog('MODE ▶ ' + (mode === 2 ? '臨界' : MODES[mode].jp) + ' ' + MODES[mode].en, mode === 2 ? 'hot' : mode === 1 ? 'amber' : 'cold');
      }
      e.sb = ease(e.sb, mode === 0 ? 1 : 0, 3, dt);
      e.asc = ease(e.asc, mode === 1 ? clamp01(e.tension * 1.4) : 0, 2.2, dt);
      e.crit = ease(e.crit, mode === 2 ? 1 : 0, mode === 2 ? 5 : 3, dt);
      const syncT = mode === 2 ? Math.min(100, 99.3 + 0.9 * clamp01(sig[4] / 80))
        : mode === 1 ? 38 + 58 * e.tension : 9 + 34 * clamp01(e.lvl * 3);
      e.sync = ease(e.sync, syncT, mode === 2 ? 3 : 0.9, dt);

      // History strip samples.
      this.hMaxK = Math.max(this.hMaxK, sig[0] / 100);
      this.hMaxH = Math.max(this.hMaxH, h);
      this.hAcc += dt;
      while (this.hAcc >= 1 / HIST_RATE) {
        this.hAcc -= 1 / HIST_RATE;
        this.hk[this.hIdx] = this.hMaxK; this.hh[this.hIdx] = this.hMaxH; this.hm[this.hIdx] = mode;
        this.hIdx = (this.hIdx + 1) % HIST;
        this.hMaxK = sig[0] / 100; this.hMaxH = h;
      }
    },

    layout(W, H) {
      const m = 12, gap = 8;
      const headH = 52, footH = 26;
      const top = m + headH + gap, bot = H - m - footH - gap, bodyH = bot - top;
      const leftW = clamp(W * 0.15, 84, 200);
      const rightW = clamp(W * 0.3, 170, 380);
      const cx0 = m + leftW + gap, cx1 = W - m - rightW - gap, cw = cx1 - cx0;
      const rx = W - m - rightW;
      const L = { W, H, m, gap };
      L.head = { x: m, y: m, w: W - 2 * m, h: headH };
      L.foot = { x: m, y: H - m - footH, w: W - 2 * m, h: footH };
      const tH = Math.round(bodyH * 0.7);
      L.title = { x: m, y: top, w: leftW, h: tH };
      L.modes = { x: m, y: top + tH + gap, w: leftW, h: bodyH - tH - gap };
      const hexH = Math.round(bodyH * 0.5), histH = Math.round(bodyH * 0.16);
      L.hex = { x: cx0, y: top, w: cw, h: hexH };
      L.hist = { x: cx0, y: top + hexH + gap, w: cw, h: histH };
      const rowY = top + hexH + histH + 2 * gap, rowH = bot - rowY;
      const oscW = Math.round(cw * 0.55);
      L.osc = { x: cx0, y: rowY, w: oscW, h: rowH };
      L.beat = { x: cx0 + oscW + gap, y: rowY, w: cw - oscW - gap, h: rowH };
      const syncH = Math.round(bodyH * 0.3), specH = Math.round(bodyH * 0.32);
      L.sync = { x: rx, y: top, w: rightW, h: syncH };
      L.spec = { x: rx, y: top + syncH + gap, w: rightW, h: specH };
      L.log = { x: rx, y: top + syncH + specH + 2 * gap, w: rightW, h: bodyH - syncH - specH - 2 * gap };
      return L;
    },

    // A panel: hairline frame, corner blocks, and a filled label tab. Returns
    // the content area under the tab.
    panel(g, r, col, jp, en, fill) {
      const F = this.F;
      g.lineWidth = 1.2;
      if (fill) { g.fillStyle = fill; g.fillRect(r.x, r.y, r.w, r.h); }
      g.strokeStyle = css(col, 0.8);
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      g.fillStyle = css(col, 1);
      const c = 4;
      g.fillRect(r.x, r.y + r.h - c, c, c); g.fillRect(r.x + r.w - c, r.y + r.h - c, c, c);
      g.fillRect(r.x + r.w - c, r.y, c, c);
      if (!jp && !en) return { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 };
      const th = 14;
      g.font = '700 10px ' + JP;
      const jw = jp ? g.measureText(jp).width + 5 : 0;
      g.font = '500 10px ' + F.cond;
      const ew = g.measureText(en).width;
      const tw = Math.min(r.w, jw + ew + 10);
      g.fillRect(r.x, r.y, tw, th);
      g.fillStyle = css(this.C.bg, 1);
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = '700 10px ' + JP;
      if (jp) g.fillText(jp, r.x + 4, r.y + th / 2 + 0.5);
      g.font = '500 10px ' + F.cond;
      g.fillText(en, r.x + 4 + jw, r.y + th / 2 + 0.5);
      return { x: r.x + 5, y: r.y + th + 4, w: r.w - 10, h: r.h - th - 9 };
    },

    draw(p, sig, params, ctx) {
      const t = p.millis() / 1000;
      if (this.lastT === null) { this.lastT = t; this.t0 = t; }
      const dt = clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      if (p.frameCount - this.fontFrame > 30) {
        this.fontFrame = p.frameCount;
        this.F = {
          head: face('Anton', 'Impact, "Haettenschweiler", "Arial Narrow", sans-serif'),
          cond: face('Oswald', '"Arial Narrow", "Helvetica Neue", Arial, sans-serif'),
          mono: face('Space Mono', 'Menlo, Monaco, "Courier New", monospace'),
        };
      }

      // Params, eased toward the drop preset while following a drop.
      const follow = Math.round(params.follow) === 1;
      const e = this.env;
      e.auto = ease(e.auto, follow && this.mode === 2 ? 1 : 0, this.mode === 2 ? 6 : 3, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * e.auto;
      this.listen(sig, dt, t, 0.35 + 0.65 * P.response);

      const S = SCHEMES[clamp(Math.round(params.scheme), 0, SCHEMES.length - 1)];
      const alert = clamp01(Math.max(P.alert, 0));
      // Frame colour: cold at stand-by, warm when active, hot in alert.
      const base = mixc(S.warm, S.cold, e.sb * (1 - alert) * 0.85);
      const frame = mixc(base, S.hot, alert);
      const C = this.C = { bg: S.bg, warm: S.warm, amber: S.amber, hot: S.hot, cold: S.cold, ink: S.ink, frame, alert };
      C.dim = mixc(S.bg, frame, 0.28);
      const W = ctx.width, H = ctx.height;
      const L = this.layout(W, H);

      p.background(S.bg[0], S.bg[1], S.bg[2]);
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.lineCap = 'butt'; g.lineJoin = 'miter'; g.setLineDash([]);

      // Faint registration grid behind everything.
      g.strokeStyle = css(frame, 0.06); g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x < W; x += 40) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = 0; y < H; y += 40) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();

      this.drawHeader(g, L.head, t, sig);
      this.drawTitle(g, L.title, t, params);
      this.drawModes(g, L.modes, t);
      this.drawHex(g, L.hex, t);
      this.drawHist(g, L.hist);
      this.drawOsc(g, L.osc, dt);
      this.drawBeat(g, L.beat, t);
      this.drawSync(g, L.sync, t);
      this.drawSpec(g, L.spec);
      this.drawLog(g, L.log, t, dt, P.telemetry, sig);
      this.drawTape(g, L.foot, t, dt);

      // Scanlines: a fine dark raster over the board, the CRT's grain.
      if (params.scan > 0.01) {
        g.fillStyle = 'rgba(0,0,0,' + (0.45 * P.scan).toFixed(3) + ')';
        for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1.1);
      }
      g.restore();
    },

    drawHeader(g, r, t, sig) {
      const C = this.C, F = this.F, e = this.env;
      g.strokeStyle = css(C.frame, 0.8); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(r.x, r.y + r.h - 0.5); g.lineTo(r.x + r.w, r.y + r.h - 0.5); g.stroke();
      // Invented mark: a hexagon cut by three level bars, the levels of bass,
      // mids and highs.
      const mx = r.x + 22, my = r.y + 22, mr = 19;
      g.fillStyle = css(C.frame, 1);
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.lineTo(mx + mr * Math.cos(a), my + mr * Math.sin(a)); }
      g.closePath(); g.fill();
      g.fillStyle = css(C.bg, 1);
      const lv = [this.sm[0] + this.sm[1], this.sm[3] + this.sm[4], this.sm[7] + this.sm[8]];
      for (let i = 0; i < 3; i++) g.fillRect(mx - 11, my - 9 + i * 7, 4 + 18 * clamp01(lv[i] / 1.6), 4);
      // Title block.
      const tx = r.x + 50;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = css(C.ink, 0.95);
      g.font = '700 22px ' + JP;
      g.fillText('音響同期監視系', tx, r.y + 22);
      const jw = g.measureText('音響同期監視系').width;
      g.font = '400 10px ' + F.cond;
      g.fillStyle = css(C.frame, 1);
      const cursor = Math.floor(t * 2) % 2 ? '█' : ' ';
      g.fillText('SONIC SYNCHRONY MONITOR  ·  ANALYSIS IN PROGRESS ' + cursor, tx, r.y + 38);
      // Readouts: elapsed, tempo, hat lamps.
      let x = tx + Math.max(jw, 250) + 22;
      const el = t - this.t0;
      const rd = (label, val, w) => {
        g.font = '500 9px ' + F.cond; g.fillStyle = css(C.frame, 0.85);
        g.fillText(label, x, r.y + 12);
        g.font = '400 20px ' + F.head; g.fillStyle = css(C.ink, 0.95);
        g.fillText(val, x, r.y + 36);
        x += w;
      };
      const alertW = clamp(r.w * 0.3, 170, 380);
      const right = r.x + r.w - alertW - 10;
      if (x + 110 < right) rd('経過 ELAPSED', pad(el / 60, 2) + ':' + pad(el % 60, 2) + ':' + pad((el * 60) % 60, 2), 118);
      if (x + 80 < right) rd('推定 TEMPO', this.tempo ? this.tempo.toFixed(1) : '---.-', 84);
      // Hat lamps: two rows of small squares, one flicks on per hat.
      const nl = this.lamps.length, cols = nl / 2;
      const lw = Math.min(8, (right - x - 4) / cols - 2);
      if (lw > 3) {
        g.font = '500 9px ' + F.cond; g.fillStyle = css(C.frame, 0.85);
        g.fillText('高域 HF LAMPS', x, r.y + 12);
        for (let i = 0; i < nl; i++) {
          const lx = x + (i % cols) * (lw + 2), ly = r.y + 20 + Math.floor(i / cols) * (lw + 3);
          const v = this.lamps[i];
          g.fillStyle = v > 0.02 ? css(mixc(C.frame, C.ink, v), 0.3 + 0.7 * v) : css(C.dim, 1);
          g.fillRect(lx, ly, lw, lw);
        }
      }
      // Alert panel: nominal / warning / emergency, blinking with the kicks.
      const ar = { x: r.x + r.w - alertW, y: r.y + 2, w: alertW, h: r.h - 8 };
      const mode = this.mode;
      const on = (this.kicks % 2 === 0) && t - this.kickT < 0.42;
      let col, word, jp, filled;
      if (C.alert > 0.5 || mode === 2) { col = C.hot; word = 'EMERGENCY'; jp = '緊急'; filled = on || t - this.slamT < 0.6; }
      else if (mode === 1) { col = C.amber; word = 'WARNING'; jp = '警告'; filled = on && e.asc > 0.3; }
      else { col = C.cold; word = 'NOMINAL'; jp = '正常'; filled = false; }
      g.fillStyle = filled ? css(col, 1) : css(C.bg, 1);
      g.fillRect(ar.x, ar.y, ar.w, ar.h);
      g.strokeStyle = css(col, 1); g.lineWidth = 2;
      g.strokeRect(ar.x + 1, ar.y + 1, ar.w - 2, ar.h - 2);
      g.fillStyle = filled ? css(C.bg, 1) : css(col, 1);
      g.textBaseline = 'middle';
      g.font = '700 24px ' + JP;
      g.textAlign = 'left';
      g.fillText(jp, ar.x + 10, ar.y + ar.h / 2 + 1);
      const jpw = g.measureText(jp).width;
      g.font = '400 26px ' + F.head;
      g.textAlign = 'right';
      g.fillText(word, ar.x + ar.w - 10, ar.y + ar.h / 2 + 1, ar.w - jpw - 30);
    },

    drawTitle(g, r, t, params) {
      const C = this.C, F = this.F, e = this.env;
      const mode = this.mode;
      const crit = mode === 2 || C.alert > 0.5;
      const word = crit ? (String(params.title || '').trim() || '臨界') : MODES[mode].jp;
      const en = crit ? 'CRITICAL' : MODES[mode].en;
      const col = crit ? C.hot : mode === 1 ? C.amber : C.cold;
      const panelFill = crit ? css(C.hot, 0.92 * Math.max(e.crit, C.alert)) : null;
      const inner = this.panel(g, r, crit ? C.hot : C.frame, '表示', 'STATUS', panelFill);
      g.save();
      g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip();
      // The slam: the title drops in oversized and settles in 0.22 s; mode
      // changes elsewhere just cut, as a display would.
      const since = t - (crit ? this.slamT : this.modeT);
      const s = 1 + 0.55 * (1 - easeOut(since / 0.22));
      const chars = Array.from(word).slice(0, 6);
      const enW = Math.min(inner.w * 0.22, 26);
      const colW = inner.w - enW - 4;
      const size = Math.min(inner.h / chars.length * 0.94, colW * 0.95);
      const cx = inner.x + colW / 2, cy = inner.y + inner.h / 2;
      g.translate(cx, cy); g.scale(s, s);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 ' + size.toFixed(1) + 'px ' + JP;
      const total = size * chars.length;
      for (let i = 0; i < chars.length; i++) {
        const y = -total / 2 + size * (i + 0.5);
        if (crit) { g.fillStyle = css(C.bg, 1); g.fillText(chars[i], 0, y); }
        else if (mode === 1) { g.fillStyle = css(col, 0.95); g.fillText(chars[i], 0, y); }
        else { g.strokeStyle = css(col, 0.9); g.lineWidth = Math.max(1, size / 60); g.strokeText(chars[i], 0, y); }
      }
      g.restore();
      // English running down the edge.
      g.save();
      g.translate(inner.x + inner.w - enW / 2, inner.y + inner.h / 2);
      g.rotate(Math.PI / 2);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = enW * 0.9;
      g.font = '400 ' + fs.toFixed(1) + 'px ' + F.head;
      const ew = g.measureText(en).width;
      if (ew > inner.h * 0.95) { fs *= inner.h * 0.95 / ew; g.font = '400 ' + fs.toFixed(1) + 'px ' + F.head; }
      g.fillStyle = crit ? css(C.bg, 1) : css(col, 0.9);
      g.fillText(en, 0, 0);
      g.restore();
      // The panel's own flash when the title lands: this panel only.
      const fl = crit ? 1 - clamp01((t - this.slamT) / 0.16) : 0;
      if (fl > 0) { g.fillStyle = css(C.ink, 0.4 * fl); g.fillRect(r.x, r.y, r.w, r.h); }
    },

    drawModes(g, r, t) {
      const C = this.C, F = this.F;
      const inner = this.panel(g, r, C.frame, '段階', 'PHASE');
      const n = 3, rh = inner.h / n;
      for (let i = 0; i < n; i++) {
        const y = inner.y + i * rh;
        const cur = this.mode === i;
        const col = i === 2 ? C.hot : i === 1 ? C.amber : C.cold;
        if (cur) { g.fillStyle = css(col, 1); g.fillRect(inner.x, y + 1, inner.w, rh - 2); }
        else { g.strokeStyle = css(col, 0.35); g.lineWidth = 1; g.strokeRect(inner.x + 0.5, y + 1.5, inner.w - 1, rh - 3); }
        const fs = Math.min(rh * 0.62, 20);
        g.fillStyle = cur ? css(C.bg, 1) : css(col, 0.5);
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.font = '700 ' + fs.toFixed(1) + 'px ' + JP;
        g.fillText(i === 2 ? '臨界' : MODES[i].jp, inner.x + 4, y + rh / 2 + 1);
        g.textAlign = 'right';
        g.font = '400 ' + (fs * 0.62).toFixed(1) + 'px ' + F.cond;
        if (inner.w > 110) g.fillText(MODES[i].en, inner.x + inner.w - 4, y + rh / 2 + 1);
      }
    },

    drawHex(g, r, t) {
      const C = this.C, F = this.F, e = this.env;
      const inner = this.panel(g, r, C.frame, '帯域分布', 'SECTOR MAP · 9 BANDS');
      g.save();
      g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip();
      // Flat-topped honeycomb sized so about five rows fit.
      const rows = 5;
      const R = Math.min(inner.h / (rows * Math.sqrt(3) + 0.9), inner.w / 9);
      const hx = R * 1.5, hy = R * Math.sqrt(3);
      const cols = Math.floor((inner.w - R * 0.5) / hx);
      const ox = inner.x + (inner.w - (cols - 1) * hx) / 2;
      const oy = inner.y + (inner.h - (rows - 0.5) * hy) / 2 + hy / 2 - hy / 2;
      const hexPath = (x, y, rr) => {
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
        g.closePath();
      };
      // Clap impacts strike a cluster of three neighbours.
      const struck = new Map();
      for (const im of this.impacts) {
        const age = t - im.t;
        if (age > 0.45) continue;
        const c0 = Math.floor(hash(im.seed) * cols), r0 = Math.floor(hash(im.seed + 1) * (rows - 1));
        const a = 1 - age / 0.45;
        for (const [dc, dr] of [[0, 0], [1, 0], [0, 1]]) {
          const key = (c0 + dc) + ':' + (r0 + dr);
          struck.set(key, Math.max(struck.get(key) || 0, a));
        }
      }
      const crit = Math.max(e.crit, C.alert);
      const fs = R * 0.42;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let c = 0; c < cols; c++) {
        for (let rw = 0; rw < rows; rw++) {
          const x = ox + c * hx;
          const y = oy + rw * hy + (c % 2 ? hy / 2 : 0);
          if (y > inner.y + inner.h + R) continue;
          const id = c * 31 + rw * 7 + 3;
          const h1 = hash(id), h2 = hash(id + 0.37), h3 = hash(id + 0.71);
          // Mostly mid and top bands; a few kick-band tiles, so the kick lands
          // in a handful of cells rather than across the field.
          const b = h1 < 0.1 ? (h1 < 0.05 ? 0 : 1) : 2 + Math.floor(h2 * 7);
          const th = 0.16 + 0.42 * h3;
          const lit = smooth(th, th + 0.12, this.sm[b]);
          const sk = struck.get(c + ':' + rw) || 0;
          hexPath(x, y, R * 0.9);
          g.strokeStyle = css(C.frame, 0.35 + 0.4 * lit); g.lineWidth = 1;
          g.stroke();
          if (lit > 0.01) {
            const col = mixc(mixc(e.sb > 0.5 ? C.cold : C.amber, C.frame, 0.5), C.hot, crit);
            g.fillStyle = css(col, 0.85 * lit);
            hexPath(x, y, R * 0.78); g.fill();
          }
          if (sk > 0) {
            g.fillStyle = css(C.ink, 0.95 * sk);
            hexPath(x, y, R * 0.78); g.fill();
          }
          // Cell code: band and cell number; alert cells read 警.
          const on = lit > 0.5 || sk > 0.5;
          g.fillStyle = on ? css(C.bg, 0.9) : css(C.frame, 0.45);
          if (on && crit > 0.5) {
            g.font = '700 ' + (R * 0.72).toFixed(1) + 'px ' + JP;
            g.fillText(sk > 0.5 ? '打' : '警', x, y + 1);
          } else if (sk > 0.5) {
            g.font = '700 ' + (R * 0.72).toFixed(1) + 'px ' + JP;
            g.fillText('打', x, y + 1);
          } else {
            g.font = '500 ' + fs.toFixed(1) + 'px ' + F.cond;
            g.fillText('B' + b + '-' + pad(c * rows + rw, 2), x, y + 1);
          }
        }
      }
      g.restore();
    },

    drawHist(g, r) {
      const C = this.C;
      const inner = this.panel(g, r, C.frame, '履歴', 'HISTORY · 8 SEC');
      const mid = inner.y + inner.h / 2;
      const bw = inner.w / HIST;
      g.strokeStyle = css(C.frame, 0.25); g.lineWidth = 1;
      g.beginPath(); g.moveTo(inner.x, mid); g.lineTo(inner.x + inner.w, mid); g.stroke();
      const cols = [C.cold, C.amber, C.hot];
      for (let i = 0; i < HIST; i++) {
        const j = (this.hIdx + i) % HIST;
        const v = this.hk[j];
        if (v < 0.02) continue;
        const hh = v * inner.h * 0.48;
        g.fillStyle = css(cols[this.hm[j]], 0.9);
        g.fillRect(inner.x + i * bw, mid - hh, Math.max(1, bw - 0.6), hh * 2);
      }
      // Top bands as a thin cold line over the kick bars.
      g.strokeStyle = css(C.cold, 0.85); g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < HIST; i++) {
        const j = (this.hIdx + i) % HIST;
        g.lineTo(inner.x + i * bw, inner.y + inner.h - this.hh[j] * inner.h * 0.95);
      }
      g.stroke();
    },

    drawOsc(g, r, dt) {
      const C = this.C, F = this.F;
      const inner = this.panel(g, r, C.cold, '波形', 'OSCILLOSCOPE');
      g.strokeStyle = css(C.cold, 0.14); g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= 8; i++) { const x = inner.x + inner.w * i / 8; g.moveTo(x, inner.y); g.lineTo(x, inner.y + inner.h); }
      for (let i = 0; i <= 4; i++) { const y = inner.y + inner.h * i / 4; g.moveTo(inner.x, y); g.lineTo(inner.x + inner.w, y); }
      g.stroke();
      // Each band is one sine, its amplitude the band level, higher bands at
      // higher frequencies: the trace is literally the spectrum summed.
      for (let b = 0; b < 9; b++) this.osc[b] += dt * (1.5 + b * 0.9);
      const mid = inner.y + inner.h / 2, amp = inner.h * 0.46;
      const N = 140;
      g.strokeStyle = css(C.cold, 0.95); g.lineWidth = 1.4; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        let y = 0;
        for (let b = 0; b < 9; b++) y += this.sm[b] * Math.sin(TAU * u * (2 + b * 2.6) + this.osc[b] + b) / (1 + b * 0.2);
        g.lineTo(inner.x + u * inner.w, mid - clamp(y / 2.6, -1, 1) * amp);
      }
      g.stroke();
      g.lineJoin = 'miter';
      g.font = '400 9px ' + F.mono; g.fillStyle = css(C.cold, 0.7);
      g.textAlign = 'right'; g.textBaseline = 'top';
      let pk = 0; for (let b = 0; b < 9; b++) pk = Math.max(pk, this.sm[b]);
      g.fillText('PK ' + pad(pk * 100, 3), inner.x + inner.w - 2, inner.y + 1);
    },

    drawBeat(g, r, t) {
      const C = this.C, F = this.F;
      const inner = this.panel(g, r, C.frame, '拍動', 'PULSE');
      const gp = 5;
      const cw = (inner.w - gp) / 2, ch = (inner.h - gp) / 2;
      const cell = (i, j) => ({ x: inner.x + i * (cw + gp), y: inner.y + j * (ch + gp), w: cw, h: ch });
      const label = (c, txt, col) => {
        g.font = '500 8.5px ' + F.cond; g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText(txt, c.x + 3, c.y + 2, c.w - 6);
      };
      // Kick tile: blinks.
      const k = cell(0, 0);
      const ka = 1 - clamp01((t - this.kickT - 0.08) / 0.14);
      const kc = C.alert > 0.5 || this.mode === 2 ? C.hot : C.warm;
      g.fillStyle = ka > 0 ? css(kc, ka) : css(C.bg, 1); g.fillRect(k.x, k.y, k.w, k.h);
      g.strokeStyle = css(kc, 0.9); g.lineWidth = 1.2; g.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
      g.fillStyle = ka > 0.5 ? css(C.bg, 1) : css(kc, 0.8);
      g.font = '700 ' + Math.min(k.h * 0.62, k.w * 0.5).toFixed(1) + 'px ' + JP;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('拍', k.x + k.w / 2, k.y + k.h / 2 + 3);
      label(k, 'KICK', ka > 0.5 ? css(C.bg, 1) : css(kc, 0.8));
      // Counter.
      const n = cell(1, 0);
      g.strokeStyle = css(C.frame, 0.6); g.strokeRect(n.x + 0.5, n.y + 0.5, n.w - 1, n.h - 1);
      label(n, '計数 COUNT', css(C.frame, 0.9));
      g.fillStyle = css(C.ink, 0.95);
      g.font = '400 ' + Math.min(n.h * 0.62, n.w * 0.34).toFixed(1) + 'px ' + F.head;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(pad(this.kicks, 4), n.x + n.w / 2, n.y + n.h / 2 + 4);
      // Clap tile: the other drum, in the cold colour.
      const s = cell(0, 1);
      const sa = 1 - clamp01((t - this.clapT - 0.06) / 0.16);
      g.fillStyle = sa > 0 ? css(C.cold, sa) : css(C.bg, 1); g.fillRect(s.x, s.y, s.w, s.h);
      g.strokeStyle = css(C.cold, 0.8); g.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
      g.fillStyle = sa > 0.5 ? css(C.bg, 1) : css(C.cold, 0.8);
      g.font = '700 ' + Math.min(s.h * 0.62, s.w * 0.5).toFixed(1) + 'px ' + JP;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('打', s.x + s.w / 2, s.y + s.h / 2 + 3);
      label(s, 'CLAP', sa > 0.5 ? css(C.bg, 1) : css(C.cold, 0.8));
      // Phrase countdown: beats to the next 16-beat phrase, and the phrase as
      // 16 cells filling.
      const q = cell(1, 1);
      g.strokeStyle = css(C.frame, 0.6); g.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1);
      label(q, '次節 NEXT PHRASE', css(C.frame, 0.9));
      const inPh = this.kicks % 16;
      const left = inPh === 0 && this.kicks > 0 ? 0 : 16 - inPh;
      g.fillStyle = css(left <= 4 && this.kicks > 0 ? C.hot : C.ink, 0.95);
      g.font = '400 ' + Math.min(q.h * 0.42, q.w * 0.3).toFixed(1) + 'px ' + F.head;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('T-' + pad(left, 2), q.x + 4, q.y + q.h * 0.52);
      const sq = Math.min((q.w - 8) / 16 - 1, 6);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i < inPh || (inPh === 0 && this.kicks > 0) ? css(C.frame, 0.95) : css(C.dim, 1);
        g.fillRect(q.x + 4 + i * (sq + 1), q.y + q.h - sq - 4, sq, sq);
      }
    },

    drawSync(g, r, t) {
      const C = this.C, F = this.F, e = this.env;
      const inner = this.panel(g, r, C.frame, '同期率', 'SYNC RATIO');
      const v = clamp(e.sync, 0, 100);
      const col = v > 95 ? C.hot : v > 60 ? C.amber : C.frame;
      // Chevrons march toward the number while it is climbing.
      const climbing = this.mode === 1 && e.asc > 0.2;
      const gh = Math.min(inner.h * 0.2, 16);
      const numH = inner.h - gh - 8;
      const cvW = climbing ? Math.min(46, inner.w * 0.16) : 0;
      if (climbing) {
        const ph = (t * 3) % 1;
        for (let i = 0; i < 3; i++) {
          const a = 0.25 + 0.75 * ((i + ph * 3) % 3) / 3;
          const x = inner.x + i * cvW / 3.2, y = inner.y + numH / 2;
          g.fillStyle = css(C.amber, a * e.asc);
          g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 9, y); g.lineTo(x, y + 12); g.lineTo(x + 5, y); g.closePath(); g.fill();
        }
      }
      let fs = numH * 1.02;
      const txt = v >= 99.95 ? '100.0' : pad(v, 3) + '.' + Math.floor((v * 10) % 10);
      g.font = '400 ' + fs.toFixed(1) + 'px ' + F.head;
      const avail = inner.w - cvW - 30;
      let tw = g.measureText(txt).width;
      if (tw > avail) { fs *= avail / tw; g.font = '400 ' + fs.toFixed(1) + 'px ' + F.head; tw = avail; }
      g.fillStyle = css(col, 1);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const bx = inner.x + cvW + 4, by = inner.y + numH * 0.5 + fs * 0.36;
      g.fillText(txt, bx, by);
      g.font = '400 ' + (fs * 0.4).toFixed(1) + 'px ' + F.head;
      g.fillText('%', bx + tw + 3, by);
      // Segmented gauge with quarter ticks.
      const gy = inner.y + inner.h - gh, segs = 40, sw = inner.w / segs;
      for (let i = 0; i < segs; i++) {
        const on = (i + 0.5) / segs * 100 <= v;
        const sc = i >= segs * 0.95 ? C.hot : i >= segs * 0.6 ? C.amber : C.frame;
        g.fillStyle = on ? css(sc, 0.95) : css(C.dim, 1);
        g.fillRect(inner.x + i * sw, gy, sw - 1.2, gh * 0.7);
      }
      g.fillStyle = css(C.frame, 0.7);
      for (let i = 0; i <= 4; i++) g.fillRect(inner.x + inner.w * i / 4 - (i === 4 ? 1 : 0), gy + gh * 0.72, 1, gh * 0.28);
    },

    drawSpec(g, r) {
      const C = this.C, F = this.F;
      const inner = this.panel(g, r, C.frame, '周波数', 'SPECTRUM');
      const gp = 4, bw = (inner.w - gp * 8) / 9;
      const segs = 14, labH = 12;
      const sh = (inner.h - labH) / segs;
      for (let b = 0; b < 9; b++) {
        const x = inner.x + b * (bw + gp);
        const n = Math.round(this.sm[b] * segs);
        const pk = Math.min(segs - 1, Math.round(this.peak[b] * segs));
        for (let s = 0; s < segs; s++) {
          const y = inner.y + inner.h - labH - (s + 1) * sh;
          const sc = s >= segs - 3 ? C.hot : s >= segs * 0.55 ? C.amber : C.frame;
          g.fillStyle = s < n ? css(sc, 0.95) : s === pk && pk > 0 ? css(C.ink, 0.8) : css(C.dim, 0.7);
          g.fillRect(x, y + 0.6, bw, sh - 1.2);
        }
        g.fillStyle = css(C.frame, 0.85);
        g.textAlign = 'center'; g.textBaseline = 'bottom';
        if (bw > 22) { g.font = '700 9px ' + JP; g.fillText(BAND_JP[b], x + bw / 2, inner.y + inner.h + 1); }
        else { g.font = '500 9px ' + F.cond; g.fillText(String(b), x + bw / 2, inner.y + inner.h + 1); }
      }
    },

    drawLog(g, r, t, dt, rate, sig) {
      const C = this.C, F = this.F;
      // A scan line at the telemetry rate: the band levels, as numbers.
      this.scanAcc += dt * rate * 2;
      if (this.scanAcc >= 1) {
        this.scanAcc = 0;
        const el = t - this.t0;
        this.addLog('SCAN ' + pad(el, 3) + '.' + pad((el * 100) % 100, 2) + ' L' + pad(sig[0], 2) + ' M' + pad(sig[4], 2) + ' H' + pad(sig[8], 2) + ' S' + pad(this.env.sync, 2), 'dim');
      }
      const inner = this.panel(g, r, C.frame, '記録', 'TELEMETRY');
      this.scroll = ease(this.scroll, 0, 14, dt);
      const lh = 12;
      g.save();
      g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip();
      g.font = '400 9.5px ' + F.mono;
      g.textAlign = 'left'; g.textBaseline = 'bottom';
      const kinds = { warm: C.frame, amber: C.amber, hot: C.hot, cold: C.cold, ink: C.ink, dim: mixc(C.frame, C.bg, 0.45) };
      let y = inner.y + inner.h + this.scroll * lh;
      for (let i = this.log.length - 1; i >= 0 && y > inner.y; i--) {
        const L = this.log[i];
        const newest = i === this.log.length - 1;
        g.fillStyle = css(kinds[L.kind] || C.frame, newest ? 1 : 0.85);
        g.fillText(L.text, inner.x, y);
        y -= lh;
      }
      g.restore();
    },

    drawTape(g, r, t, dt) {
      const C = this.C, F = this.F, e = this.env;
      const crit = Math.max(e.crit, C.alert);
      const warn = Math.max(e.asc, crit);
      const col = mixc(C.amber, C.hot, crit);
      g.save();
      g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
      g.strokeStyle = css(C.frame, 0.7); g.lineWidth = 1;
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      // Warning tape, running at a speed set by the bass.
      if (warn > 0.02) {
        this.tapeX = (this.tapeX || 0) + (18 + 60 * (this.sm[1] + this.sm[2])) * dt;
        const sw = 16, off = this.tapeX % (sw * 2);
        g.fillStyle = css(col, 0.9 * warn);
        g.beginPath();
        for (let x = r.x - r.h - sw * 2 + off; x < r.x + r.w + r.h; x += sw * 2) {
          g.moveTo(x, r.y + r.h); g.lineTo(x + sw, r.y + r.h); g.lineTo(x + sw + r.h, r.y); g.lineTo(x + r.h, r.y); g.closePath();
        }
        g.fill();
      }
      // Centre label.
      const mode = crit > 0.5 ? 2 : this.mode;
      const txt = MODES[mode].tape;
      g.font = '500 12px ' + F.cond;
      const tw = g.measureText(txt).width + 24;
      const lx = r.x + r.w / 2 - tw / 2;
      g.fillStyle = css(C.bg, 1); g.fillRect(lx, r.y + 3, tw, r.h - 6);
      g.strokeStyle = css(mode === 0 ? C.cold : col, 0.9); g.strokeRect(lx + 0.5, r.y + 3.5, tw - 1, r.h - 7);
      g.fillStyle = css(mode === 0 ? C.cold : col, 1);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 1);
      g.restore();
    },
  });
})();
