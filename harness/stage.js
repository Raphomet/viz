// Harness stage: hosts exactly one scene the way web/core.js hosts a viz, but
// with no panel, no audio and no wall clock. render.mjs drives it through
// window.HARNESS; a person can also open stage.html?scene=… in a browser and
// call HARNESS.play() from the console to watch the track run in real time.
//
// Query string:
//   scene=../web/scenes/foo.js   the scene file (required; resolved against web/)
//   w=1280&h=720                 canvas size in CSS pixels (default 1280x720)
//   density=1                    p5 pixelDensity (default 1; see README)
//   seed=1                       seeds p.randomSeed, p.noiseSeed and Math.random
//   params={"k":v}               JSON overrides of the scene's param defaults
//
// The per-frame wrapper below mirrors core.js's p.draw line for line (push,
// scale to a 600-unit short side, draw, unwind the style stack, black on
// throw). If core.js's wrapper changes, change this one with it — a scene
// that behaves differently here than in the app makes the harness worthless.
(function () {
  'use strict';

  var VIRTUAL_SHORT_SIDE = 600;
  var BANDS = 9;
  var FPS = 60;
  var FRAME_MS = 1000 / FPS;

  var q = new URLSearchParams(location.search);
  var sceneUrl = q.get('scene');
  var width = Math.max(16, parseInt(q.get('w'), 10) || 1280);
  var height = Math.max(16, parseInt(q.get('h'), 10) || 720);
  var density = Math.max(0.25, parseFloat(q.get('density')) || 1);
  var seedArg = q.get('seed') == null ? '1' : q.get('seed');

  // Keep the real clock for measurement before anything is overridden.
  var realNow = performance.now.bind(performance);
  var realDateNow = Date.now;

  var H = window.HARNESS = {
    status: 'loading',
    error: null,
    warnings: [],
    info: null,
    frame: 0,
    drawMs: [],          // per frame: the scene's draw() call as JavaScript only
    renderMs: [],        // per frame: draw() plus forcing the canvas to finish (see p.draw)
    frameMs: [],         // the whole p5 redraw (wrapper + draw + p5 overhead)
    drawErrors: 0
  };

  function fail(msg) {
    H.status = 'error';
    H.error = msg;
    console.error('harness: ' + msg);
  }

  // ------------------------------------------------------------ determinism
  // Seed string -> 32-bit int, then mulberry32. Replacing Math.random before
  // the scene file is even fetched means module-level randomness (like
  // rings.js's randomizeRingSettings) is reproducible too.
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  var seedInt = /^-?\d+$/.test(seedArg) ? (parseInt(seedArg, 10) >>> 0) : hashSeed(seedArg);
  var prngState = (seedInt ^ 0x9E3779B9) >>> 0;
  Math.random = function () {
    prngState = (prngState + 0x6D2B79F5) >>> 0;
    var t = prngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // The simulated clock. Scenes should use p.millis(), but one that reaches
  // for performance.now() or Date.now() still sees simulated time rather than
  // however long the headless render happened to take.
  var simMs = 0;
  var DATE_EPOCH = Date.UTC(2016, 0, 1);
  performance.now = function () { return simMs; };
  Date.now = function () { return DATE_EPOCH + simMs; };

  // --------------------------------------------------------------- registry
  var def = null;
  var params = {};
  var ctx = { width: VIRTUAL_SHORT_SIDE, height: VIRTUAL_SHORT_SIDE };
  var drawScale = 1;
  var failedDraw = false;
  var signals = new Float32Array(BANDS);

  // defaultFor / sanitize are core.js's, so an override that core would clamp
  // is clamped here the same way.
  function clampInt(v, lo, hi, fallback) {
    v = Math.round(Number(v));
    return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  }
  function defaultFor(spec) {
    switch (spec.type) {
      case 'range': return typeof spec.default === 'number' ? spec.default : spec.min;
      case 'text': return typeof spec.default === 'string' ? spec.default : '';
      default: return typeof spec.default === 'number' ? spec.default : 0;
    }
  }
  function sanitize(spec, v) {
    var d = defaultFor(spec);
    switch (spec.type) {
      case 'range':
        v = Number(v);
        return isFinite(v) ? Math.min(spec.max, Math.max(spec.min, v)) : d;
      case 'select': return clampInt(v, 0, (spec.options || []).length - 1, d);
      case 'palette': return clampInt(v, 0, (spec.palettes || []).length - 1, d);
      case 'band': return clampInt(v, 0, BANDS - 1, d);
      case 'text': return typeof v === 'string' ? v : d;
      default: return v === undefined ? d : v;
    }
  }

  function register(d) {
    if (!d || typeof d.id !== 'string' || typeof d.draw !== 'function') {
      console.error('viz: VIZ.register needs an object with an id and a draw function', d);
      return;
    }
    if (def) H.warnings.push('more than one VIZ.register call; hosting the last one (' + d.id + ')');
    def = d;
  }
  window.VIZ = { register: register };

  function initParams() {
    var overrides = {};
    var raw = q.get('params');
    if (raw) {
      try { overrides = JSON.parse(raw) || {}; }
      catch (e) { H.warnings.push('params is not valid JSON; using defaults'); }
    }
    var known = {};
    (def.params || []).forEach(function (spec) {
      known[spec.key] = true;
      params[spec.key] = spec.key in overrides ? sanitize(spec, overrides[spec.key]) : defaultFor(spec);
    });
    Object.keys(overrides).forEach(function (k) {
      if (!known[k]) H.warnings.push('params.' + k + ' is not a param of ' + def.id + '; ignored');
    });
  }

  function safeCall(method, args) {
    try { def[method].apply(def, args); }
    catch (e) { console.error('viz: ' + def.id + '.' + method + ' failed', e); }
  }

  function probeWebGL() {
    var out = { webgl2: false, webgl: false, renderer: null };
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2');
      if (gl) out.webgl2 = true; else gl = c.getContext('webgl');
      if (gl) {
        out.webgl = true;
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        out.renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { /* reported as unavailable */ }
    return out;
  }

  // ---------------------------------------------------------------- p5 host
  var p5inst = null;
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  function sketch(p) {
    // Simulated time, derived from the frame being drawn, so p.millis() and
    // p.frameCount can never disagree: frame n is drawn at n/60 s.
    p.millis = function () { return simMs; };

    p.preload = function () {
      if (typeof def.preload === 'function') safeCall('preload', [p]);
    };

    p.setup = function () {
      p.pixelDensity(density);
      p.createCanvas(width, height);
      p.smooth();
      p.background(0);
      p.noLoop();
      p.randomSeed(seedInt);
      p.noiseSeed(seedInt);
      drawScale = Math.min(p.width, p.height) / VIRTUAL_SHORT_SIDE || 1;
      ctx.width = p.width / drawScale;
      ctx.height = p.height / drawScale;
      if (typeof def.setup === 'function') safeCall('setup', [p, ctx]);
      if (typeof def.enter === 'function') safeCall('enter', [p, ctx]);
    };

    p.draw = function () {
      // redraw() has already advanced frameCount; frame 1 is t = 1/60 s.
      var frame = p.frameCount;
      simMs = frame * FRAME_MS;
      p.deltaTime = FRAME_MS;
      window.VIZ_TRACK.bands(simMs / 1000, signals);
      var signalsForScene = new Float32Array(signals);   // core hands a fresh array each frame

      var depth = p._styles ? p._styles.length : 0;
      var failed = false;
      p.push();
      p.scale(drawScale);
      var t0 = realNow();
      try {
        def.draw(p, signalsForScene, params, ctx);
      } catch (e) {
        failed = true;
        H.drawErrors++;
        if (!failedDraw) {
          failedDraw = true;
          console.error('viz: ' + def.id + '.draw failed; showing black until it recovers', e);
        }
      }
      var t1 = realNow();
      if (p._styles) { while (p._styles.length > depth) p.pop(); }
      else p.pop();
      if (failed) {
        p.push();
        p.resetMatrix();
        p.background(0);
        p.pop();
      }
      // Chromium records canvas and WebGL calls and rasterises them later, so
      // timing draw() alone measures only the JavaScript (the self-test read
      // 0.04 ms a frame while the render took 10 ms a frame). Reading one pixel
      // back forces everything queued, including a GL layer's drawImage, to
      // finish now, so renderMs is the real cost of the frame.
      p.drawingContext.getImageData(0, 0, 1, 1);
      var t2 = realNow();
      H.drawMs.push(t1 - t0);
      H.renderMs.push(t2 - t0);
      H.frame = frame;
      if (frame === 1) readyResolve();
    };
  }

  // Step until frame `target` has been drawn. Every intermediate frame is drawn
  // because scenes accumulate state and some never clear the canvas.
  H.stepTo = function (target) {
    while (H.frame < target) {
      var t0 = realNow();
      p5inst.redraw();
      H.frameMs.push(realNow() - t0);
    }
    return H.frame;
  };

  H.canvas = function () { return p5inst.drawingContext.canvas; };

  // ---------------------------------------------------------- contact sheet
  var sheet = null;
  var sheetCtx = null;
  var layout = null;
  var TILE_W = 480;
  var INFO_H = 46;
  var HEADER_H = 40;
  var GAP = 8;
  // Bass warm to treble cool, so a reader can tell the strip's ends apart at a glance.
  var BAND_COLORS = ['#ff4d4d', '#ff7a3d', '#ffb13b', '#f2dd4a', '#9be15d', '#3fd6a0', '#36c2e8', '#5a8cff', '#a47bff'];

  H.initSheet = function (count, headerText) {
    var cols = Math.min(4, count);
    var rows = Math.ceil(count / cols);
    var tileH = Math.round(TILE_W * height / width);
    layout = { cols: cols, rows: rows, tileW: TILE_W, tileH: tileH };
    sheet = document.createElement('canvas');
    sheet.width = GAP + cols * (TILE_W + GAP);
    sheet.height = HEADER_H + rows * (tileH + INFO_H + GAP) + GAP;
    sheetCtx = sheet.getContext('2d');
    sheetCtx.fillStyle = '#111317';
    sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
    sheetCtx.fillStyle = '#e8ecf0';
    sheetCtx.font = '600 15px Menlo, Monaco, monospace';
    sheetCtx.textBaseline = 'middle';
    sheetCtx.fillText(headerText, GAP + 2, HEADER_H / 2 + 2);
  };

  function drawTile(index, label, bandValues) {
    var c = sheetCtx, L = layout;
    var col = index % L.cols, row = Math.floor(index / L.cols);
    var x = GAP + col * (L.tileW + GAP);
    var y = HEADER_H + row * (L.tileH + INFO_H + GAP);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(H.canvas(), x, y, L.tileW, L.tileH);

    var iy = y + L.tileH;
    c.fillStyle = '#1c2026';
    c.fillRect(x, iy, L.tileW, INFO_H);
    c.fillStyle = '#f4f6f8';
    c.font = '600 17px Menlo, Monaco, monospace';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(label, x + 10, iy + INFO_H / 2);

    // The band strip: nine bars, 0-100, with band numbers underneath.
    var barW = 14, barGap = 4, maxH = 28;
    var stripW = BANDS * barW + (BANDS - 1) * barGap;
    var sx = x + L.tileW - stripW - 10;
    var base = iy + 6 + maxH;
    c.fillStyle = '#2c323b';
    c.fillRect(sx - 3, iy + 5, stripW + 6, maxH + 2);
    for (var b = 0; b < BANDS; b++) {
      var bx = sx + b * (barW + barGap);
      var h = Math.max(1, Math.round(maxH * bandValues[b] / 100));
      c.fillStyle = BAND_COLORS[b];
      c.fillRect(bx, base - h, barW, h);
      c.fillStyle = '#8b95a3';
      c.font = '9px Menlo, Monaco, monospace';
      c.textAlign = 'center';
      c.fillText(String(b), bx + barW / 2, base + 7);
    }
    c.textAlign = 'left';
  }

  // Capture the canvas as it is now (after H.stepTo), add it to the sheet at
  // `index`, and return the full-size PNG plus what was playing.
  H.capture = function (index) {
    var t = H.frame / FPS;
    var bandValues = Array.prototype.slice.call(window.VIZ_TRACK.bands(t));
    var sec = window.VIZ_TRACK.section(t);
    if (sheet && index != null) drawTile(index, t.toFixed(1) + 's · ' + sec, bandValues);
    return {
      frame: H.frame,
      t: t,
      section: sec,
      bands: bandValues.map(function (v) { return Math.round(v * 10) / 10; }),
      png: H.canvas().toDataURL('image/png')
    };
  };

  H.sheetPng = function () { return sheet ? sheet.toDataURL('image/png') : null; };

  // For a person watching in a real browser: run the track in real time.
  H.play = function () {
    var start = realNow(), startFrame = H.frame;
    (function tick() {
      H.stepTo(startFrame + Math.floor((realNow() - start) / FRAME_MS));
      requestAnimationFrame(tick);
    })();
  };

  // ------------------------------------------------------------------ start
  function start() {
    if (typeof window.p5 !== 'function') return fail('p5.js did not load');
    if (!window.VIZ_TRACK) return fail('track.js did not load');
    if (!sceneUrl) return fail('no ?scene= given');
    var s = document.createElement('script');
    s.src = sceneUrl;
    s.onerror = function () { fail('could not load scene ' + sceneUrl); };
    s.onload = function () {
      if (!def) return fail(sceneUrl + ' loaded but never called VIZ.register');
      initParams();
      p5inst = new window.p5(sketch, document.getElementById('stage'));
      ready.then(function () {
        H.info = {
          id: def.id,
          name: def.name || def.id,
          order: def.order,
          gallery: def.gallery || null,
          params: params,
          width: width,
          height: height,
          density: density,
          seed: seedArg,
          virtual: { width: ctx.width, height: ctx.height },
          gl: probeWebGL()
        };
        H.status = 'ready';
      });
    };
    document.body.appendChild(s);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
