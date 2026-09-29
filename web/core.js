// viz core: visual registry, audio sources, octave-band analysis, the control
// panel and the p5 host. Plain script, no modules; see CONTRACT.md for the
// interface the viz/*.js files are written against.
(function () {
  'use strict';

  var VIRTUAL_SHORT_SIDE = 600;   // the originals were tuned for a 600x600 window
  var BANDS = 9;
  var FFT_SIZE = 512;             // viz.pde: bufferSize = 512
  var FFT_BASE_FREQ = 86;         // viz.pde: fftBaseFrequency = 86
  var DEFAULT_EXPBASE = 1.75;
  var DEFAULT_SIGNALSCALE = 4;
  // Web Audio reports dB of |X|/N with a Blackman window; Minim reports raw |X|
  // with a Hamming window. N restores the scale and the ratio of the windows'
  // coherent gains (0.54 / 0.42) restores the level, so the same music lands at
  // the same place against the same EXPBASE / SIGNALSCALE as in 2016.
  var MINIM_SCALE = FFT_SIZE * (0.54 / 0.42);
  var MICROPHONE_BLOCKED = 'The microphone is blocked here. Serve this folder locally to use it (see README), or play an audio file.';

  // ---------------------------------------------------------------- storage
  // Every access guarded: private windows, sandboxed frames and cleared site
  // data can all make localStorage throw, and the page must still run.
  function readStore(key) {
    try { var raw = window.localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  // --------------------------------------------------------------- registry
  var registry = [];
  var paramValues = {};   // viz id -> params object (the same object for the page's lifetime)
  var current = null;
  var p5ready = false;
  var p5inst = null;
  var ctx = { width: VIRTUAL_SHORT_SIDE, height: VIRTUAL_SHORT_SIDE };
  var drawScale = 1;
  var failedDraw = {};    // viz id -> true once its draw threw (log once)

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

  // Stored values survive across versions of a viz file, so each one is checked
  // against the current spec before use.
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

  function initParams(def) {
    var stored = readStore('viz.params.' + def.id) || {};
    var params = paramValues[def.id] || {};
    (def.params || []).forEach(function (spec) {
      params[spec.key] = spec.key in stored ? sanitize(spec, stored[spec.key]) : defaultFor(spec);
    });
    paramValues[def.id] = params;
  }

  function saveParams(def) { writeStore('viz.params.' + def.id, paramValues[def.id]); }

  function register(def) {
    if (!def || typeof def.id !== 'string' || typeof def.draw !== 'function') {
      console.error('viz: VIZ.register needs an object with an id and a draw function', def);
      return;
    }
    registry = registry.filter(function (d) { return d.id !== def.id; });
    registry.push(def);
    registry.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    initParams(def);
    // A registration after start-up (not expected, but harmless) still shows up.
    if (p5ready) {
      if (typeof def.setup === 'function') safeCall(def, 'setup', [p5inst, ctx]);
      buildVizList();
      if (!current) selectViz(def.id);
      // A late version of the live scene needs the Version control to appear.
      else if (familyOf(current) === familyOf(def)) buildControls();
    }
  }

  window.VIZ = { register: register };

  // ---------------------------------------------------------------- versions
  // A redesign registers as its own def with versionOf pointing at the
  // original, so both stay runnable side by side with separate params. The
  // list shows one entry per scene (the original's); the Version control and
  // the V key pick which def that entry puts on the stage. Everything here is
  // resolved at use time rather than at register time, because V2 scripts load
  // after V1s and a V2 may arrive before, after, or without its original.
  function byId(id) { return registry.filter(function (d) { return d.id === id; })[0] || null; }

  // The id of the list entry a def belongs to. A V2 whose original never
  // registered falls back to being its own entry rather than vanishing.
  function familyOf(def) {
    return def.versionOf && def.versionOf !== def.id && byId(def.versionOf) ? def.versionOf : def.id;
  }

  function versionLabel(def) { return def.version || (def.versionOf ? 'V2' : 'V1'); }

  // The original first, then its versions by label (V2, V3, ...).
  function versionsOf(familyId) {
    var base = byId(familyId);
    if (!base) return [];
    var others = registry.filter(function (d) { return d !== base && familyOf(d) === familyId; });
    others.sort(function (a, b) { return versionLabel(a) < versionLabel(b) ? -1 : versionLabel(a) > versionLabel(b) ? 1 : 0; });
    return [base].concat(others);
  }

  function listedDefs() { return registry.filter(function (d) { return familyOf(d) === d.id; }); }

  // The def a family's entry currently stands for: the remembered version if
  // it is still registered, otherwise the original.
  function chosenVersion(familyId) {
    var versions = versionsOf(familyId);
    var remembered = readStore('viz.version.' + familyId);
    return versions.filter(function (d) { return d.id === remembered; })[0] || versions[0] || null;
  }

  function selectScene(familyId) {
    var def = chosenVersion(familyId);
    if (def) selectViz(def.id);
  }

  function toggleVersion() {
    if (!current) return;
    var versions = versionsOf(familyOf(current));
    if (versions.length < 2) return;
    selectViz(versions[(versions.indexOf(current) + 1) % versions.length].id);
  }

  function safeCall(def, method, args) {
    try { def[method].apply(def, args); }
    catch (e) { console.error('viz: ' + def.id + '.' + method + ' failed', e); }
  }

  // ------------------------------------------------------------------ audio
  var source = 'demo';
  var actx = null, analyser = null, freqData = null;
  var sampleRate = 44100;   // Minim's default; used for the Hz labels until real audio starts
  var bandBins = [];        // [lowBin, highBin] per band, or null for an empty band
  var bandHz = [];          // [lowHz, highHz] per band
  var fileBuffer = null, fileNode = null, fileOffset = 0, fileStartedAt = 0, filePlaying = false, fileName = '';
  var micStream = null, micNode = null;
  var expBase = DEFAULT_EXPBASE, signalScale = DEFAULT_SIGNALSCALE;

  (function restoreGlobals() {
    var g = readStore('viz.global');
    if (g) {
      if (isFinite(g.expBase)) expBase = Math.min(3, Math.max(0, g.expBase));
      if (isFinite(g.signalScale)) signalScale = Math.min(8, Math.max(0.5, g.signalScale));
    }
  })();

  // Band edges exactly as Minim's FFT.logAverages(86, 1): halve Nyquist while it
  // stays above 86 Hz to count octaves; band i runs from nyq/2^(oct-i) to
  // nyq/2^(oct-i-1), with band 0 reaching down to DC.
  function computeBands(rate) {
    sampleRate = rate;
    var nyq = rate / 2;
    var octaves = 1;
    var n = nyq;
    while ((n /= 2) > FFT_BASE_FREQ) octaves++;
    var binWidth = rate / FFT_SIZE;
    var lastBin = FFT_SIZE / 2 - 1;   // AnalyserNode has no Nyquist bin
    function toBin(f) {
      if (f < binWidth / 2) return 0;
      if (f > nyq - binWidth / 2) return lastBin;
      return Math.min(lastBin, Math.round(f / binWidth));
    }
    var all = [];
    for (var i = 0; i < octaves; i++) {
      var lo = i === 0 ? 0 : nyq / Math.pow(2, octaves - i);
      var hi = nyq / Math.pow(2, octaves - i - 1);
      all.push({ lo: lo, hi: hi, bins: [toBin(lo), toBin(hi)] });
    }
    // 44.1 and 48 kHz both give nine octaves. Any other rate still yields nine
    // bands: the top nine, or the available ones right-aligned so 8 stays treble.
    var top = all.slice(-BANDS);
    var pad = BANDS - top.length;
    bandBins = []; bandHz = [];
    for (var b = 0; b < BANDS; b++) {
      var band = b < pad ? null : top[b - pad];
      bandBins.push(band ? band.bins : null);
      bandHz.push(band ? [band.lo, band.hi] : null);
    }
  }
  computeBands(sampleRate);

  function ensureAudio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      analyser = actx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;   // Minim's FFT has no smoothing
      freqData = new Float32Array(analyser.frequencyBinCount);
      computeBands(actx.sampleRate);
    }
    // Called from click handlers so autoplay rules let the context start.
    if (actx.state === 'suspended') actx.resume().catch(function () {});
    return actx;
  }

  function analyserBands(out) {
    analyser.getFloatFrequencyData(freqData);
    for (var b = 0; b < BANDS; b++) {
      var r = bandBins[b];
      if (!r) { out[b] = 0; continue; }
      var sum = 0;
      for (var k = r[0]; k <= r[1]; k++) {
        var db = freqData[k];
        if (db > -1000) sum += Math.pow(10, db / 20) * MINIM_SCALE;   // -Infinity is silence
      }
      out[b] = sum / (r[1] - r[0] + 1);
    }
  }

  // Demo: a synthetic 120 BPM groove. Targets are written as the bar heights
  // they should reach at the default settings, then divided back through the
  // default boost, so treble boost and gain act on them exactly as on music.
  var DEMO_BOOST = [];
  for (var di = 0; di < BANDS; di++) DEMO_BOOST.push(Math.pow(DEFAULT_EXPBASE, di) * DEFAULT_SIGNALSCALE);

  function demoBands(out) {
    var t = performance.now() / 1000;
    var beatPos = t / 0.5;
    var beat = Math.floor(beatPos);
    var sinceBeat = (beatPos - beat) * 0.5;
    var kick = Math.exp(-sinceBeat / 0.11);
    var snare = beat % 2 === 1 ? Math.exp(-sinceBeat / 0.09) : 0;   // beats 2 and 4
    var eighthPos = t / 0.25;
    var eighth = Math.floor(eighthPos);
    var sinceEighth = (eighthPos - eighth) * 0.25;
    var hatLevel = 0.72 + 0.25 * Math.sin(t * 0.21);
    var hat = Math.exp(-sinceEighth / 0.035) * (eighth % 2 === 1 ? 1 : 0.7) * hatLevel;
    var bedA = 0.5 + 0.5 * Math.sin(t * 0.37);
    var bedB = 0.5 + 0.5 * Math.sin(t * 0.23 + 1.7);
    var bedC = 0.5 + 0.5 * Math.sin(t * 0.31 + 4.1);
    var target = [
      12 + 98 * kick,
      10 + 86 * kick + 10 * bedA,
      20 + 35 * bedA + 25 * kick,
      18 + 30 * bedB + 78 * snare,
      15 + 25 * bedC + 90 * snare,
      10 + 72 * snare + 22 * hat,
      8 + 72 * hat + 18 * snare,
      6 + 88 * hat,
      5 + 98 * hat
    ];
    for (var b = 0; b < BANDS; b++) {
      var jitter = 1 + (Math.random() - 0.5) * 0.12;
      out[b] = target[b] * jitter / DEMO_BOOST[b];
    }
  }

  var rawBands = new Float32Array(BANDS);

  // viz.pde getAdjustedFftSignals(): avg x expBase^i x signalScale, clamped 0-100.
  function computeSignals() {
    if (source === 'demo') demoBands(rawBands);
    else if (analyser) analyserBands(rawBands);
    else rawBands.fill(0);
    var signals = new Float32Array(BANDS);
    for (var i = 0; i < BANDS; i++) {
      var v = rawBands[i] * Math.pow(expBase, i) * signalScale;
      signals[i] = v < 0 ? 0 : v > 100 ? 100 : v;
    }
    return signals;
  }

  function stopFileNode() {
    if (!fileNode) return;
    fileNode.onended = null;
    try { fileNode.stop(); } catch (e) { /* already stopped */ }
    fileNode.disconnect();
    fileNode = null;
  }

  function playFile() {
    if (!fileBuffer || !ensureAudio()) return;
    stopFileNode();
    fileNode = actx.createBufferSource();
    fileNode.buffer = fileBuffer;
    fileNode.loop = true;
    fileNode.connect(analyser);
    fileNode.connect(actx.destination);
    fileStartedAt = actx.currentTime - fileOffset;
    fileNode.start(0, fileOffset);
    filePlaying = true;
    renderSource();
    // A drop is not a user activation, so the context may refuse to start
    // until the next click; show that honestly rather than a silent "Pause".
    setTimeout(function () {
      if (filePlaying && actx.state !== 'running') {
        pauseFile();
        showSourceMsg('Press Play to start the sound.');
      }
    }, 400);
  }

  function pauseFile() {
    if (filePlaying && fileBuffer && actx) {
      fileOffset = (actx.currentTime - fileStartedAt) % fileBuffer.duration;
      if (!(fileOffset >= 0)) fileOffset = 0;
    }
    stopFileNode();
    filePlaying = false;
    renderSource();
  }

  function stopMic() {
    if (micStream) micStream.getTracks().forEach(function (t) { t.stop(); });
    if (micNode) micNode.disconnect();
    micStream = null; micNode = null;
  }

  function loadFile(file) {
    if (!file) return;
    if (!ensureAudio()) { showSourceMsg('This browser has no Web Audio support.'); return; }
    stopMic();
    source = 'file';
    fileName = file.name || 'Audio file';
    showSourceMsg('');
    renderSource(true);
    file.arrayBuffer().then(function (buf) {
      return actx.decodeAudioData(buf);
    }).then(function (decoded) {
      pauseFile();
      fileBuffer = decoded;
      fileOffset = 0;
      if (source === 'file') playFile();
      else renderSource();
    }).catch(function () {
      showSourceMsg('That file could not be read as audio.');
      renderSource();
    });
  }

  function setSource(next) {
    showSourceMsg('');
    if (next === 'demo') {
      stopMic();
      pauseFile();
      source = 'demo';
    } else if (next === 'file') {
      stopMic();
      ensureAudio();
      source = 'file';
      if (fileBuffer && !filePlaying) playFile();
    } else if (next === 'mic') {
      pauseFile();
      if (!ensureAudio() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        micFailed();
        return;
      }
      source = 'mic';
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      }).then(function (stream) {
        if (source !== 'mic') { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        stopMic();
        micStream = stream;
        micNode = actx.createMediaStreamSource(stream);
        micNode.connect(analyser);   // not to the speakers: that would feed back
      }).catch(function () {
        if (source === 'mic') micFailed();
      });
    }
    renderSource();
  }

  function micFailed() {
    stopMic();
    source = 'demo';
    renderSource();
    showSourceMsg(MICROPHONE_BLOCKED);
  }

  // ------------------------------------------------------------------ panel
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  };

  function showSourceMsg(text) {
    var m = $('source-msg');
    m.textContent = text;
    m.hidden = !text;
  }

  function renderSource(loading) {
    ['demo', 'file', 'mic'].forEach(function (s) {
      $('src-' + s).setAttribute('aria-pressed', String(source === s));
    });
    $('source-file').hidden = source !== 'file';
    var play = $('file-play');
    play.disabled = !fileBuffer;
    play.textContent = filePlaying ? 'Pause' : 'Play';
    $('file-name').textContent = loading ? 'Loading ' + fileName + '\u2026'
      : fileName || 'or drop one on the stage';
    $('file-name').title = fileName;
  }

  function hzText(b) {
    var r = bandHz[b];
    if (!r) return 'Band ' + b + ' \u00B7 no range at ' + sampleRate + ' Hz';
    return 'Band ' + b + ' \u00B7 ' + Math.floor(r[0]) + '\u2013' + Math.floor(r[1]) + ' Hz';
  }
  var HZ_IDLE = 'Hover a bar for its frequency range';

  var monitorBars = [];
  function buildMonitor() {
    var mon = $('monitor'), labels = $('bar-labels');
    for (var b = 0; b < BANDS; b++) {
      (function (b) {
        var bar = el('div', { class: 'bar', id: 'band-bar-' + b, tabindex: '0', role: 'img', 'aria-label': 'Band ' + b });
        var fill = el('i');
        bar.appendChild(fill);
        var show = function () { $('hz').textContent = hzText(b); };
        var hide = function () { $('hz').textContent = HZ_IDLE; };
        bar.addEventListener('mouseenter', show);
        bar.addEventListener('focus', show);
        bar.addEventListener('mouseleave', hide);
        bar.addEventListener('blur', hide);
        mon.appendChild(bar);
        labels.appendChild(el('span', null, String(b)));
        monitorBars.push(fill);
      })(b);
    }
  }

  // The monitor and fps are DOM, so they update ~15 times a second; holding
  // each band's peak across the interval keeps short kicks visible.
  var peak = new Float32Array(BANDS);
  var lastMonitor = 0;
  function monitorTick(signals, p) {
    for (var i = 0; i < BANDS; i++) if (signals[i] > peak[i]) peak[i] = signals[i];
    var now = performance.now();
    if (now - lastMonitor < 66) return;
    lastMonitor = now;
    for (var b = 0; b < BANDS; b++) {
      monitorBars[b].style.transform = 'scaleY(' + (peak[b] / 100).toFixed(3) + ')';
      peak[b] = 0;
    }
    $('fps').textContent = Math.round(p.frameRate()) + ' fps';
    perfUiTick(now);
  }

  function setRangeFill(input, v, min, max) {
    var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--pct', pct.toFixed(2) + '%');
  }

  function niceStep(span) {
    var raw = span / 500;
    if (!(raw > 0)) return 0.01;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n < 2 ? 1 : n < 5 ? 2 : 5) * mag;
  }
  function decimalsFor(step) {
    return Math.min(4, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
  }

  function bindGlobalSlider(id, get, set, min, max) {
    var input = $(id), out = $(id + '-val');
    var sync = function () {
      input.value = String(get());
      setRangeFill(input, get(), min, max);
      out.textContent = get().toFixed(2);
    };
    input.addEventListener('input', function () {
      set(parseFloat(input.value));
      sync();
      writeStore('viz.global', { expBase: expBase, signalScale: signalScale });
    });
    sync();
  }

  // The scene browser (browser.js: collections, filter, favourites, grid)
  // takes over the Visual list when it loads. Core keeps the registry and the
  // version rules and lends them here; without browser.js the plain list below
  // still works.
  var sceneHost = window.VIZ.scenes = {
    listed: listedDefs, versionsOf: versionsOf, chosenVersion: chosenVersion,
    versionLabel: versionLabel, familyOf: familyOf, select: selectScene,
    current: function () { return current; },
    browser: null
  };

  function buildVizList() {
    if (sceneHost.browser) { sceneHost.browser.render(); return; }
    var list = $('viz-list');
    list.textContent = '';
    if (!registry.length) {
      list.appendChild(el('p', { class: 'empty' }, 'No visuals loaded.'));
      return;
    }
    var liveFamily = current ? familyOf(current) : null;
    listedDefs().forEach(function (def, i) {
      var b = el('button', { type: 'button', id: 'viz-' + def.id });
      if (i < 9) b.appendChild(el('kbd', null, String(i + 1)));
      b.appendChild(el('span', null, def.name || def.id));
      var versions = versionsOf(def.id);
      if (versions.length > 1) {
        // The tag names the newest version and is filled in while that version
        // is the one this entry shows, outlined while the original is.
        var live = liveFamily === def.id ? current : chosenVersion(def.id);
        var newest = versions[versions.length - 1];
        var tag = el('span', {
          class: 'vtag' + (live === newest ? ' live' : ''),
          id: 'viz-' + def.id + '-version',
          title: 'Showing ' + versionLabel(live)
        }, versionLabel(newest));
        b.appendChild(tag);
        b.setAttribute('data-version', versionLabel(live));
      }
      b.setAttribute('aria-current', String(liveFamily === def.id));
      b.addEventListener('click', function () { selectScene(def.id); });
      list.appendChild(b);
    });
  }

  var controlSyncs = [];

  function rowHead(labelText, legacy, forId, labelId) {
    var head = el('div', { class: 'row-head' });
    var label = forId ? el('label', { for: forId }, labelText) : el('span', { class: 'label', id: labelId }, labelText);
    head.appendChild(label);
    if (legacy) head.appendChild(el('span', { class: 'tag' }, legacy));
    var val = el('span', { class: 'val' });
    head.appendChild(val);
    return { head: head, val: val };
  }

  function buildControl(def, spec, params) {
    var base = 'ctl-' + def.id + '-' + spec.key;
    var row = el('div', { class: 'row' });
    var commit = function (v) { params[spec.key] = v; noteManual(def, spec.key); saveParams(def); };
    var h;

    if (spec.type === 'range') {
      h = rowHead(spec.label || spec.key, spec.legacy, base);
      var step = spec.step || niceStep(spec.max - spec.min);
      var dec = decimalsFor(step);
      var input = el('input', { type: 'range', id: base, min: spec.min, max: spec.max, step: step });
      var sync = function () {
        input.value = String(params[spec.key]);
        setRangeFill(input, params[spec.key], spec.min, spec.max);
        h.val.textContent = Number(params[spec.key]).toFixed(dec);
      };
      input.addEventListener('input', function () {
        commit(parseFloat(input.value));
        setRangeFill(input, params[spec.key], spec.min, spec.max);
        h.val.textContent = Number(params[spec.key]).toFixed(dec);
      });
      row.appendChild(h.head); row.appendChild(input);
      controlSyncs.push(sync);
    } else if (spec.type === 'select') {
      var options = spec.options || [];
      var segmented = options.length <= 4 && options.every(function (o) { return String(o).length <= 14; });
      if (segmented) {
        h = rowHead(spec.label || spec.key, spec.legacy, null, base + '-label');
        var seg = el('div', { class: 'seg', role: 'group', 'aria-labelledby': base + '-label', id: base });
        var btns = options.map(function (o, i) {
          var b = el('button', { type: 'button', id: base + '-' + i }, String(o));
          b.addEventListener('click', function () { commit(i); sync2(); });
          seg.appendChild(b);
          return b;
        });
        var sync2 = function () {
          btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(params[spec.key] === i)); });
        };
        row.appendChild(h.head); row.appendChild(seg);
        controlSyncs.push(sync2);
      } else {
        h = rowHead(spec.label || spec.key, spec.legacy, base);
        var sel = el('select', { id: base });
        options.forEach(function (o, i) { sel.appendChild(el('option', { value: String(i) }, String(o))); });
        sel.addEventListener('change', function () { commit(parseInt(sel.value, 10)); });
        row.appendChild(h.head); row.appendChild(sel);
        controlSyncs.push(function () { sel.value = String(params[spec.key]); });
      }
    } else if (spec.type === 'palette') {
      h = rowHead(spec.label || spec.key, spec.legacy, null, base + '-label');
      var strip = el('div', { class: 'swatches', role: 'group', 'aria-labelledby': base + '-label', id: base });
      var palettes = spec.palettes || [];
      var chips = palettes.map(function (pal, i) {
        var colors = pal.colors || [];
        var chip = el('button', {
          type: 'button', id: base + '-' + i, title: pal.name || 'Palette ' + (i + 1),
          'aria-label': pal.name || 'Palette ' + (i + 1),
          class: 'swatch' + (colors.length ? '' : ' named')
        });
        if (colors.length) colors.forEach(function (c) {
          var s = el('span'); s.style.background = c; chip.appendChild(s);
        });
        else chip.textContent = pal.name || String(i + 1);
        chip.addEventListener('click', function () { commit(i); syncChips(); });
        strip.appendChild(chip);
        return chip;
      });
      var syncChips = function () {
        chips.forEach(function (c, i) { c.setAttribute('aria-pressed', String(params[spec.key] === i)); });
        var pal = palettes[params[spec.key]];
        h.val.textContent = pal ? pal.name || '' : '';
      };
      row.appendChild(h.head); row.appendChild(strip);
      controlSyncs.push(syncChips);
    } else if (spec.type === 'band') {
      h = rowHead(spec.label || spec.key, spec.legacy, null, base + '-label');
      var group = el('div', { class: 'bands', role: 'group', 'aria-labelledby': base + '-label', id: base });
      var bandBtns = [];
      for (var b = 0; b < BANDS; b++) {
        (function (b) {
          var btn = el('button', { type: 'button', id: base + '-' + b, 'aria-label': 'Band ' + b }, String(b));
          btn.addEventListener('click', function () { commit(b); syncBands(); });
          group.appendChild(btn);
          bandBtns.push(btn);
        })(b);
      }
      var syncBands = function () {
        bandBtns.forEach(function (btn, i) { btn.setAttribute('aria-pressed', String(params[spec.key] === i)); });
      };
      row.appendChild(h.head); row.appendChild(group);
      controlSyncs.push(syncBands);
    } else if (spec.type === 'text') {
      h = rowHead(spec.label || spec.key, spec.legacy, base);
      var text = el('input', { type: 'text', id: base, autocomplete: 'off', spellcheck: 'false' });
      text.addEventListener('input', function () { commit(text.value); });
      row.appendChild(h.head); row.appendChild(text);
      controlSyncs.push(function () { if (text.value !== params[spec.key]) text.value = params[spec.key]; });
    } else {
      return null;
    }
    return row;
  }

  function buildControls() {
    var box = $('controls');
    box.textContent = '';
    controlSyncs = [];
    if (!current) {
      box.appendChild(el('p', { class: 'empty' }, 'Nothing to control yet.'));
      return;
    }
    var def = current, params = paramValues[def.id];
    var versions = versionsOf(familyOf(def));
    if (versions.length > 1) {
      var vrow = el('div', { class: 'row' });
      var vhead = rowHead('Version', null, null, 'ctl-version-label');
      var vseg = el('div', { class: 'seg', role: 'group', 'aria-labelledby': 'ctl-version-label', id: 'ctl-version' });
      versions.forEach(function (v) {
        var b = el('button', { type: 'button', id: 'ctl-version-' + v.id }, versionLabel(v));
        b.setAttribute('aria-pressed', String(v === def));
        b.addEventListener('click', function () { selectViz(v.id); });
        vseg.appendChild(b);
      });
      vrow.appendChild(vhead.head); vrow.appendChild(vseg);
      box.appendChild(vrow);
    }
    if ((def.params || []).length) {
      perfBox = el('div', { class: 'perf', id: 'perf' });
      box.appendChild(perfBox);
      renderPerf();
    } else {
      perfBox = null;
    }
    (def.params || []).forEach(function (spec) {
      var row = buildControl(def, spec, params);
      if (row) box.appendChild(row);
    });
    var actions = el('div', { class: 'actions' });
    (def.actions || []).forEach(function (action) {
      var b = el('button', { type: 'button', class: 'btn', id: 'act-' + def.id + '-' + action.id }, action.label || action.id);
      b.addEventListener('click', function () {
        try { action.run.call(def, params); }
        catch (e) { console.error('viz: action ' + action.id + ' failed', e); }
        // An action may have changed params (e.g. a shuffle); show and keep that.
        syncControls();
        saveParams(def);
      });
      actions.appendChild(b);
    });
    var reset = el('button', { type: 'button', class: 'btn', id: 'reset-params' }, 'Reset to defaults');
    reset.addEventListener('click', function () {
      cancelMotion(def);
      holds[def.id] = {};
      (def.params || []).forEach(function (spec) { params[spec.key] = defaultFor(spec); });
      saveParams(def);
      syncControls();
    });
    actions.appendChild(reset);
    // Separate from Reset on purpose: resetting a look mid-set must never cost
    // the performer the snapshots they built it from.
    if ((def.params || []).length) {
      var clearSnaps = el('button', { type: 'button', class: 'btn', id: 'clear-snapshots' }, 'Clear snapshots');
      clearSnaps.addEventListener('click', function () { clearAllSlots(def); });
      actions.appendChild(clearSnaps);
    }
    box.appendChild(actions);
    syncControls();
  }

  function syncControls() { controlSyncs.forEach(function (f) { f(); }); }

  function selectViz(id) {
    var def = registry.filter(function (d) { return d.id === id; })[0];
    if (!def) return;
    if (def !== current) {
      if (current) leavePerf(current);
      if (current && p5ready && typeof current.leave === 'function') safeCall(current, 'leave', [p5inst]);
      current = def;
      if (fxRunner) fxRunner.reset();   // no trail of the last scene over the new one
      if (p5ready && typeof def.enter === 'function') safeCall(def, 'enter', [p5inst, ctx]);
      writeStore('viz.selected', def.id);
      if (versionsOf(familyOf(def)).length > 1) writeStore('viz.version.' + familyOf(def), def.id);
    }
    buildVizList();
    buildControls();
    syncFinishPanel();
  }

  // ------------------------------------------------------ performer controls
  // Raph's direction (2026-09-28): the VJ shapes a scene with intention across
  // all of its params at once, not along a single Intensity axis. Snapshots
  // capture a whole look; glides and the morph fader travel between looks. The
  // Drop button and Follow the music are conveniences, opt-in and off by default,
  // so the performer's hands are always the primary input.
  var SLOT_NAMES = ['A', 'B', 'C', 'D'];
  // Q W E R sit directly over 1-4, so scene picks and look recalls live under
  // one hand without sharing a key (1-9, H, F and V are already taken).
  var SLOT_KEYS = ['q', 'w', 'e', 'r'];
  var GLIDES = [
    { id: 'cut', label: 'Cut', beats: 0 },
    { id: 'beat', label: '1 beat', beats: 1 },
    { id: 'bar', label: '1 bar', beats: 4 },
    { id: 'bars4', label: '4 bars', beats: 16 }
  ];
  var DEFAULT_GLIDE = 'bar';
  // Core detects no tempo. Demo is a known 120 BPM; for real audio 124 is a
  // middle-of-the-floor house tempo, near enough that "1 bar" feels like a bar.
  var DEMO_BPM = 120, ASSUMED_BPM = 124;

  var perfState = {};      // def id -> { slots, glide, ends, fader, dropOn, dropSlot, followOn, cleared }
  var holds = {};          // def id -> { key: true }: params taken by hand, skipped by automatic motion
  var lastRecalled = {};   // def id -> slot index whose look is on stage, or null
  var motion = null;       // the one running glide: { def, from, to, specs, keys, t0, dur }
  var dropHeld = null;     // { def, back } while the Drop button is held
  var storeArmed = false;
  var perfBox = null, perfUi = null;
  var perfDirty = false;   // stage-side values moved; repaint controls on the next UI tick
  var paramsDirtyDef = null, lastParamsSave = 0, lastStep = 0;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t * t * (3 - 2 * t); }

  function sanitizeSnapshot(def, raw) {
    if (!raw || typeof raw !== 'object' || !raw.values || typeof raw.values !== 'object') return null;
    var values = {};
    (def.params || []).forEach(function (spec) {
      if (spec.key in raw.values) values[spec.key] = sanitize(spec, raw.values[spec.key]);
    });
    return { values: values, name: typeof raw.name === 'string' ? raw.name : '' };
  }

  // Scene-suggested looks (def.presets) fill empty slots so the fader works
  // the first time a scene is opened: calm in A, drop in B, the rest after.
  // Keys a preset leaves out take the param's default, so a slot is always a
  // complete look rather than depending on whatever was on stage.
  function prefillFromPresets(def, st) {
    var presets = def.presets;
    if (!presets || typeof presets !== 'object') return;
    var names = Object.keys(presets).filter(function (n) { return presets[n] && typeof presets[n] === 'object'; });
    var order = [null, null, null, null];
    if (names.indexOf('calm') >= 0) order[0] = 'calm';
    if (names.indexOf('drop') >= 0) order[1] = 'drop';
    names.forEach(function (n) {
      if (n === 'calm' || n === 'drop') return;
      var free = order.indexOf(null);
      if (free >= 0) order[free] = n;
    });
    order.forEach(function (n, i) {
      if (!n) return;
      var values = {};
      (def.params || []).forEach(function (spec) {
        values[spec.key] = spec.key in presets[n] ? sanitize(spec, presets[n][spec.key]) : defaultFor(spec);
      });
      st.slots[i] = { values: values, name: n };
      if (n === 'drop') st.dropSlot = i;
    });
  }

  function perfFor(def) {
    if (perfState[def.id]) return perfState[def.id];
    var s = readStore('viz.perform.' + def.id) || {};
    var ends = Array.isArray(s.ends) ? s.ends : [0, 1];
    var st = {
      slots: [0, 1, 2, 3].map(function (i) { return sanitizeSnapshot(def, Array.isArray(s.slots) ? s.slots[i] : null); }),
      glide: GLIDES.some(function (g) { return g.id === s.glide; }) ? s.glide : DEFAULT_GLIDE,
      ends: [clampInt(ends[0], 0, 3, 0), clampInt(ends[1], 0, 3, 1)],
      fader: isFinite(s.fader) ? clamp01(Number(s.fader)) : 0,
      dropOn: s.dropOn === true,
      dropSlot: s.dropSlot == null ? 3 : clampInt(s.dropSlot, 0, 3, 3),
      followOn: s.followOn === true,
      cleared: s.cleared === true
    };
    if (st.ends[0] === st.ends[1]) st.ends[1] = (st.ends[0] + 1) % 4;
    // "Clear snapshots" is remembered, so a scene's suggestions do not creep
    // back into slots the performer deliberately emptied.
    if (!st.cleared && st.slots.every(function (x) { return !x; })) prefillFromPresets(def, st);
    perfState[def.id] = st;
    return st;
  }

  function savePerf(def) {
    var st = perfFor(def);
    writeStore('viz.perform.' + def.id, {
      slots: st.slots, glide: st.glide, ends: st.ends, fader: st.fader,
      dropOn: st.dropOn, dropSlot: st.dropSlot, followOn: st.followOn, cleared: st.cleared
    });
  }

  function glideSeconds(st) {
    var g = GLIDES.filter(function (x) { return x.id === st.glide; })[0] || GLIDES[0];
    return g.beats * 60 / (source === 'demo' ? DEMO_BPM : ASSUMED_BPM);
  }

  // Ranges travel; everything discrete (select, palette, band, text) has no
  // in-between, so it switches at the halfway point of the travel.
  function blendParam(spec, a, b, t) {
    if (spec.type === 'range') {
      a = Number(a); b = Number(b);
      if (!isFinite(a)) return isFinite(b) ? b : defaultFor(spec);
      if (!isFinite(b)) return a;
      return Math.min(spec.max, Math.max(spec.min, a + (b - a) * t));
    }
    return t < 0.5 ? a : b;
  }

  function markParamsDirty(def) { paramsDirtyDef = def; perfDirty = true; }

  // Motion writes params every frame; localStorage gets them at most once a
  // second and when the page goes away, not sixty times a second.
  function flushParams() {
    if (!paramsDirtyDef) return;
    saveParams(paramsDirtyDef);
    paramsDirtyDef = null;
    lastParamsSave = performance.now();
  }

  function startGlide(def, target, seconds) {
    var params = paramValues[def.id];
    var from = {}, to = {}, specs = {}, keys = [];
    (def.params || []).forEach(function (spec) {
      var k = spec.key;
      if (!(k in target)) return;
      keys.push(k); specs[k] = spec; from[k] = params[k]; to[k] = target[k];
    });
    motion = null;
    if (!(seconds > 0)) {
      keys.forEach(function (k) { params[k] = to[k]; });
      markParamsDirty(def);
      syncControls();
      return;
    }
    motion = { def: def, from: from, to: to, specs: specs, keys: keys, t0: performance.now(), dur: seconds * 1000 };
  }

  function stepMotion(now) {
    if (!motion) return;
    var m = motion, params = paramValues[m.def.id];
    var t = Math.min(1, (now - m.t0) / m.dur), e = ease(t);
    m.keys.forEach(function (k) { params[k] = t >= 1 ? m.to[k] : blendParam(m.specs[k], m.from[k], m.to[k], e); });
    markParamsDirty(m.def);
    if (t >= 1) motion = null;
  }

  function cancelMotion(def) { if (motion && (!def || motion.def === def)) motion = null; }

  // The override rule: a control touched by hand is held where the performer
  // put it. A running glide drops it, the drop will not pull it back, and
  // Follow the music skips it. A hand on the fader or a recall releases every
  // hold, because those are the performer asking for the whole look again.
  function noteManual(def, key) {
    (holds[def.id] = holds[def.id] || {})[key] = true;
    if (motion && motion.def === def) motion.keys = motion.keys.filter(function (k) { return k !== key; });
    if (dropHeld && dropHeld.def === def) delete dropHeld.back[key];
    if (lastRecalled[def.id] != null) { lastRecalled[def.id] = null; syncPerfLive(); }
  }

  // Sets params to the fader's blend of its two end slots. A key only one
  // end knows (a param added after the snapshot) holds that end's value.
  function applyFader(def, pos, respectHolds) {
    var st = perfFor(def), a = st.slots[st.ends[0]], b = st.slots[st.ends[1]];
    if (!a || !b) return false;
    var params = paramValues[def.id], held = holds[def.id] || {};
    (def.params || []).forEach(function (spec) {
      var k = spec.key;
      if (respectHolds && held[k]) return;
      var inA = k in a.values, inB = k in b.values;
      if (!inA && !inB) return;
      params[k] = blendParam(spec, inA ? a.values[k] : b.values[k], inB ? b.values[k] : a.values[k], pos);
    });
    markParamsDirty(def);
    return true;
  }

  // Any hand on the fader or a slot takes the fader back from the music.
  function handBack(def) {
    var st = perfFor(def);
    if (!st.followOn) return;
    st.followOn = false;
    showFollowNote('Follow the music is off: the fader is yours again.');
    savePerf(def);
    // Updated in place, not rebuilt: this often fires mid-drag on the fader.
    syncPerfLive();
  }

  var followNote = '', followNoteTimer = 0;
  function showFollowNote(text) {
    followNote = text;
    clearTimeout(followNoteTimer);
    followNoteTimer = setTimeout(function () { followNote = ''; syncPerfLive(); }, 6000);
    syncPerfLive();
  }

  function helpText(st) {
    if (followNote) return followNote;
    if (!st.slots[st.ends[0]] || !st.slots[st.ends[1]]) {
      return 'Store looks in ' + SLOT_NAMES[st.ends[0]] + ' and ' + SLOT_NAMES[st.ends[1]] + ' to morph between them.';
    }
    return 'A control you touch stays where you put it until the fader or a recall moves it.';
  }

  function faderMoved(def, pos) {
    var st = perfFor(def);
    handBack(def);
    cancelMotion(def);
    holds[def.id] = {};
    lastRecalled[def.id] = null;
    st.fader = clamp01(pos);
    applyFader(def, st.fader, false);
    syncControls();
    syncPerfLive();
  }

  function slotTapped(def, i, shift) {
    var st = perfFor(def);
    if (storeArmed || shift || !st.slots[i]) storeSlot(def, i);
    else recallSlot(def, i);
  }

  function storeSlot(def, i) {
    var st = perfFor(def), params = paramValues[def.id], values = {};
    (def.params || []).forEach(function (spec) { values[spec.key] = params[spec.key]; });
    st.slots[i] = { values: values, name: '' };
    st.cleared = false;
    storeArmed = false;
    lastRecalled[def.id] = i;
    handBack(def);
    savePerf(def);
    renderPerf();
  }

  function recallSlot(def, i) {
    var st = perfFor(def), slot = st.slots[i];
    if (!slot) return;
    handBack(def);
    holds[def.id] = {};
    // A recall is a new home: a drop still held has nothing left to return to.
    if (dropHeld && dropHeld.def === def) dropHeld = null;
    lastRecalled[def.id] = i;
    // Park the fader at the recalled end so grabbing it next does not jump.
    if (i === st.ends[0]) st.fader = 0;
    else if (i === st.ends[1]) st.fader = 1;
    startGlide(def, slot.values, glideSeconds(st));
    savePerf(def);
    syncPerfLive();
  }

  function clearSlot(def, i) {
    var st = perfFor(def);
    st.slots[i] = null;
    if (lastRecalled[def.id] === i) lastRecalled[def.id] = null;
    if (st.followOn && st.ends.indexOf(i) >= 0) handBack(def);
    savePerf(def);
    renderPerf();
  }

  function clearAllSlots(def) {
    var st = perfFor(def);
    st.slots = [null, null, null, null];
    st.cleared = true;
    st.followOn = false;
    lastRecalled[def.id] = null;
    if (dropHeld && dropHeld.def === def) releaseDrop();
    savePerf(def);
    renderPerf();
  }

  function dropEnabled() {
    return !!(current && (current.params || []).length && perfFor(current).dropOn);
  }

  function pressDrop() {
    if (dropHeld || !current || !(current.params || []).length) return;
    var def = current, st = perfFor(def), slot = st.slots[st.dropSlot];
    if (!st.dropOn || !slot) return;
    var params = paramValues[def.id], back = {};
    // Mid-glide, "where they were" means where the glide was heading.
    (def.params || []).forEach(function (spec) {
      var k = spec.key;
      back[k] = motion && motion.def === def && motion.keys.indexOf(k) >= 0 ? motion.to[k] : params[k];
    });
    dropHeld = { def: def, back: back };
    startGlide(def, slot.values, glideSeconds(st));
    syncPerfLive();
  }

  function releaseDrop() {
    if (!dropHeld) return;
    var d = dropHeld;
    dropHeld = null;
    if (d.def === current) startGlide(d.def, d.back, glideSeconds(perfFor(d.def)));
    syncPerfLive();
  }

  // Switching away finishes whatever was in flight, so a scene is never left
  // frozen half-way through a glide or stuck in its drop.
  function leavePerf(def) {
    var params = paramValues[def.id];
    if (dropHeld && dropHeld.def === def) {
      Object.keys(dropHeld.back).forEach(function (k) { params[k] = dropHeld.back[k]; });
      dropHeld = null;
      cancelMotion(def);
      markParamsDirty(def);
    }
    if (motion && motion.def === def) {
      motion.keys.forEach(function (k) { params[k] = motion.to[k]; });
      motion = null;
      markParamsDirty(def);
    }
    storeArmed = false;
    followNote = '';
    flushParams();
  }

  // Follow the music: a slow energy follower on the kick bands (0-1), ranged
  // against a floor and ceiling that chase it quickly towards the extremes and
  // relax slowly back, so "loud" means loud for this track, not in absolute
  // terms. Deliberately modest: it finds the big sections, not every fill.
  var det = { level: 0, low: -1, high: -1, amount: 0 };
  function stepDetector(signals, dt) {
    var e = (signals[0] + signals[1]) / 200;
    det.level += (e - det.level) * (1 - Math.exp(-dt / 1.2));
    if (det.low < 0) { det.low = det.level; det.high = det.level; }
    var fast = 1 - Math.exp(-dt / 1.5), slow = 1 - Math.exp(-dt / 45);
    det.low += (det.level - det.low) * (det.level < det.low ? fast : slow);
    det.high += (det.level - det.high) * (det.level > det.high ? fast : slow);
    var span = det.high - det.low;
    // A steady signal (the demo, a held drone) has no sections to find.
    det.amount = span < 0.08 ? 0 : clamp01((det.level - det.low) / span);
  }

  function stepPerformer(signals) {
    var now = performance.now();
    var dt = lastStep ? Math.min(0.1, (now - lastStep) / 1000) : 0;
    lastStep = now;
    stepDetector(signals, dt);
    stepMotion(now);
    var st = current && perfState[current.id];
    if (st && st.followOn && !motion && !dropHeld) {
      st.fader += (det.amount - st.fader) * (1 - Math.exp(-dt / 0.8));
      applyFader(current, st.fader, true);
    }
  }

  // Runs on the monitor's ~15 Hz tick: repaint the controls that motion moved
  // and persist params, without doing either per frame.
  function perfUiTick(now) {
    if (perfDirty) { perfDirty = false; syncControls(); syncPerfLive(); }
    if (paramsDirtyDef && now - lastParamsSave > 1000) flushParams();
  }

  // Cheap, frequent sync of the parts of the block that change without a rebuild.
  function syncPerfLive() {
    if (!perfUi || perfUi.def !== current) return;
    var def = perfUi.def, st = perfFor(def);
    perfUi.slots.forEach(function (b, i) { b.classList.toggle('live', lastRecalled[def.id] === i); });
    if (perfUi.fader) {
      perfUi.fader.value = String(st.fader);
      setRangeFill(perfUi.fader, st.fader, 0, 1);
      perfUi.faderVal.textContent = Math.round(st.fader * 100) + '%';
    }
    if (perfUi.drop) perfUi.drop.setAttribute('aria-pressed', String(!!(dropHeld && dropHeld.def === def)));
    perfUi.following.hidden = !st.followOn;
    perfUi.followToggle.setAttribute('aria-pressed', String(st.followOn));
    var help = helpText(st);
    if (perfUi.help.textContent !== help) perfUi.help.textContent = help;
  }

  function slotSelect(id, label, value, st, onChange) {
    var sel = el('select', { id: id, class: 'end', 'aria-label': label });
    SLOT_NAMES.forEach(function (n, i) {
      var snap = st.slots[i];
      sel.appendChild(el('option', { value: String(i) }, n + (snap ? (snap.name ? ' · ' + snap.name : '') : ' · empty')));
    });
    sel.value = String(value);
    sel.addEventListener('change', function () { onChange(parseInt(sel.value, 10)); });
    return sel;
  }

  function toggleButton(id, label, pressed, onClick) {
    var b = el('button', { type: 'button', class: 'opt', id: id, 'aria-pressed': String(pressed) }, label);
    b.addEventListener('click', onClick);
    return b;
  }

  function renderPerf() {
    if (!perfBox || !current) return;
    var def = current, st = perfFor(def);
    // Rebuilding would drop keyboard focus; put it back on the same control.
    var focusId = perfBox.contains(document.activeElement) ? document.activeElement.id : null;
    perfBox.textContent = '';
    perfUi = { def: def, slots: [] };

    // Snapshots: tap empty = store, tap filled = recall, Store / Shift = overwrite.
    var srow = el('div', { class: 'row' });
    srow.appendChild(rowHead('Snapshots', null, null, 'perf-snap-label').head);
    var slots = el('div', { class: 'slots', role: 'group', 'aria-labelledby': 'perf-snap-label' });
    SLOT_NAMES.forEach(function (name, i) {
      var snap = st.slots[i];
      var key = SLOT_KEYS[i].toUpperCase();
      var cell = el('div', { class: 'slot' + (snap ? ' filled' : '') + (storeArmed ? ' armed' : '') });
      var what = storeArmed || !snap ? 'Store the current look in ' + name : 'Glide to ' + name + (snap.name ? ' (' + snap.name + ')' : '');
      var b = el('button', { type: 'button', class: 'slot-btn', id: 'perf-slot-' + i, 'aria-label': what, title: what + ' · ' + key });
      b.appendChild(el('span', { class: 'slot-letter' }, name));
      b.appendChild(el('span', { class: 'slot-sub' }, snap ? snap.name || 'stored' : 'empty'));
      b.addEventListener('click', function (e) { slotTapped(def, i, e.shiftKey); });
      cell.appendChild(b);
      if (snap) {
        var x = el('button', { type: 'button', class: 'slot-x', id: 'perf-slot-' + i + '-clear', 'aria-label': 'Clear ' + name, title: 'Clear ' + name }, '×');
        x.addEventListener('click', function () { clearSlot(def, i); });
        cell.appendChild(x);
      }
      slots.appendChild(cell);
      perfUi.slots.push(b);
    });
    var store = el('button', {
      type: 'button', class: 'slot-store', id: 'perf-store', 'aria-pressed': String(storeArmed),
      title: 'Arm, then tap a slot to store the current look into it (or Shift+click, Shift+Q–R)'
    }, 'Store');
    store.addEventListener('click', function () { storeArmed = !storeArmed; renderPerf(); });
    slots.appendChild(store);
    srow.appendChild(slots);

    var gline = el('div', { class: 'perf-line' });
    gline.appendChild(el('span', { class: 'label', id: 'perf-glide-label' }, 'Glide'));
    var gseg = el('div', { class: 'seg', role: 'group', 'aria-labelledby': 'perf-glide-label', id: 'perf-glide' });
    GLIDES.forEach(function (g) {
      var b = el('button', { type: 'button', id: 'perf-glide-' + g.id, 'aria-pressed': String(st.glide === g.id) }, g.label);
      b.addEventListener('click', function () { st.glide = g.id; savePerf(def); renderPerf(); });
      gseg.appendChild(b);
    });
    gline.appendChild(gseg);
    srow.appendChild(gline);
    perfBox.appendChild(srow);

    // Morph fader between two chosen slots.
    var ready = !!(st.slots[st.ends[0]] && st.slots[st.ends[1]]);
    var mrow = el('div', { class: 'row' });
    var mh = rowHead('Morph', null, 'perf-fader');
    perfUi.following = el('span', { class: 'auto', id: 'perf-following', title: 'Follow the music is moving the fader; touch it or a slot to take over' }, 'Following');
    mh.head.insertBefore(perfUi.following, mh.val);
    perfUi.faderVal = mh.val;
    mrow.appendChild(mh.head);
    var mline = el('div', { class: 'morph' });
    var setEnd = function (side) {
      return function (v) {
        var other = st.ends[1 - side];
        if (v === other) st.ends[1 - side] = st.ends[side];   // picking the other end swaps them
        st.ends[side] = v;
        savePerf(def);
        renderPerf();
      };
    };
    mline.appendChild(slotSelect('perf-end-0', 'Fader left end', st.ends[0], st, setEnd(0)));
    var fader = el('input', {
      type: 'range', id: 'perf-fader', min: 0, max: 1, step: 0.001,
      'aria-valuetext': SLOT_NAMES[st.ends[0]] + ' to ' + SLOT_NAMES[st.ends[1]]
    });
    fader.disabled = !ready;
    fader.addEventListener('input', function () { faderMoved(def, parseFloat(fader.value)); });
    fader.addEventListener('change', function () { savePerf(def); flushParams(); });
    mline.appendChild(fader);
    mline.appendChild(slotSelect('perf-end-1', 'Fader right end', st.ends[1], st, setEnd(1)));
    mrow.appendChild(mline);
    perfUi.fader = fader;
    perfBox.appendChild(mrow);

    // The optional Drop button.
    if (st.dropOn) {
      var drow = el('div', { class: 'row drop-row' });
      var drop = el('button', { type: 'button', class: 'drop-btn', id: 'perf-drop', 'aria-pressed': 'false' });
      drop.appendChild(el('span', null, 'Drop'));
      drop.appendChild(el('kbd', null, 'hold Space'));
      drop.disabled = !st.slots[st.dropSlot];
      drop.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        try { drop.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported */ }
        pressDrop();
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { drop.addEventListener(t, releaseDrop); });
      drop.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.repeat) { pressDrop(); e.preventDefault(); } });
      drop.addEventListener('keyup', function (e) { if (e.key === 'Enter') { releaseDrop(); e.preventDefault(); } });
      drow.appendChild(drop);
      var dlabel = el('label', { class: 'drop-slot', for: 'perf-drop-slot' }, 'goes to');
      drow.appendChild(dlabel);
      drow.appendChild(slotSelect('perf-drop-slot', 'Drop snapshot', st.dropSlot, st, function (v) {
        st.dropSlot = v; savePerf(def); renderPerf();
      }));
      perfUi.drop = drop;
      perfBox.appendChild(drow);
    }

    perfUi.help = el('p', { class: 'helper perf-help', id: 'perf-help', role: 'status' });
    perfBox.appendChild(perfUi.help);

    var opts = el('div', { class: 'perf-opts', role: 'group', 'aria-label': 'Performer options' });
    opts.appendChild(toggleButton('perf-opt-drop', 'Drop button', st.dropOn, function () {
      st.dropOn = !st.dropOn;
      if (!st.dropOn) releaseDrop();
      savePerf(def);
      renderPerf();
    }));
    perfUi.followToggle = toggleButton('perf-opt-follow', 'Follow the music', st.followOn, function () {
      if (!st.followOn && !(st.slots[st.ends[0]] && st.slots[st.ends[1]])) {
        showFollowNote('Follow the music needs looks in both fader ends.');
        return;
      }
      followNote = '';
      st.followOn = !st.followOn;
      if (st.followOn) { holds[def.id] = {}; cancelMotion(def); lastRecalled[def.id] = null; }
      savePerf(def);
      syncPerfLive();
    });
    opts.appendChild(perfUi.followToggle);
    perfBox.appendChild(opts);

    syncPerfLive();
    if (focusId && $(focusId)) $(focusId).focus();
  }

  // ------------------------------------------------------------ stage chrome
  function togglePanel() {
    var app = $('app');
    var hiding = !app.classList.contains('panel-hidden');
    if (hiding && $('panel').contains(document.activeElement)) document.activeElement.blur();
    app.classList.toggle('panel-hidden', hiding);
  }

  function toggleFullscreen() {
    var stage = $('stage');
    try {
      if (document.fullscreenElement) {
        var ex = document.exitFullscreen();
        if (ex && ex.catch) ex.catch(function () {});
      } else if (stage.requestFullscreen) {
        var rq = stage.requestFullscreen();
        if (rq && rq.catch) rq.catch(function () {});   // refused in some frames; stay put quietly
      }
    } catch (e) { /* fullscreen unavailable */ }
  }

  function isTyping(target) {
    if (!target || !target.tagName) return false;
    if (target.isContentEditable) return true;
    var tag = target.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !/^(range|button|checkbox|radio|file|submit|reset|color)$/i.test(target.type);
  }

  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    var k = e.key;
    var slot = SLOT_KEYS.indexOf(k.toLowerCase());
    if (k === ' ' && dropEnabled()) {
      // Swallowed even on repeat, so a focused button under the performer's
      // thumb is never clicked by the hold.
      if (!e.repeat) pressDrop();
      e.preventDefault();
    }
    else if (slot >= 0 && current && (current.params || []).length) {
      if (!e.repeat) {
        if (e.shiftKey) storeSlot(current, slot);
        else slotTapped(current, slot, false);
      }
      e.preventDefault();
    }
    else if (k === 'h' || k === 'H') { togglePanel(); e.preventDefault(); }
    else if (k === 'f' || k === 'F') { toggleFullscreen(); e.preventDefault(); }
    else if (k === 'v' || k === 'V') { toggleVersion(); e.preventDefault(); }
    else if (k === 'l' || k === 'L') { toggleFinish(); e.preventDefault(); }
    // The browser's keys: / find, G grid, [ ] step, and 1-9 once favourites exist.
    else if (sceneHost.browser && sceneHost.browser.onKey(e)) { e.preventDefault(); }
    else if (/^[1-9]$/.test(k)) {
      var def = listedDefs()[Number(k) - 1];
      if (def) { selectScene(def.id); e.preventDefault(); }
    }
  }

  function bindDrop() {
    var stage = $('stage'), hint = $('drop-hint');
    var depth = 0;
    var hasFiles = function (e) {
      return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
    };
    stage.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      hint.hidden = false;
    });
    stage.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    stage.addEventListener('dragleave', function () {
      depth = Math.max(0, depth - 1);
      if (!depth) hint.hidden = true;
    });
    stage.addEventListener('drop', function (e) {
      e.preventDefault();
      depth = 0;
      hint.hidden = true;
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
    // A file dropped beside the stage must not navigate the page away.
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
  }

  function bindPanel() {
    buildMonitor();
    ['demo', 'file', 'mic'].forEach(function (s) {
      $('src-' + s).addEventListener('click', function () { setSource(s); });
    });
    $('file-input').addEventListener('change', function (e) {
      loadFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    $('file-play').addEventListener('click', function () {
      showSourceMsg('');
      if (filePlaying) pauseFile(); else { ensureAudio(); playFile(); }
    });
    bindGlobalSlider('g-expbase', function () { return expBase; }, function (v) { expBase = v; }, 0, 3);
    bindGlobalSlider('g-gain', function () { return signalScale; }, function (v) { signalScale = v; }, 0.5, 8);
    buildFinishPanel();
    buildRackPanel();
    renderSource();
    bindDrop();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', function (e) {
      if (e.key === ' ' && dropHeld) { releaseDrop(); e.preventDefault(); }
    });
    // A keyup lost to another window would otherwise leave the drop stuck on.
    window.addEventListener('blur', releaseDrop);
    window.addEventListener('pagehide', flushParams);
  }


  // -------------------------------------------------------- effects + finish
  // The rack (ordered effects, web/fx/*.js) and the Finish (motion blur, bloom,
  // film) run after the scene on a WebGL2 canvas stacked over the p5 canvas;
  // see web/fx.js. With nothing to run, or no WebGL2, the p5 canvas shows as
  // before. L flips the Finish so the performer can compare it instantly.
  var FX = window.VIZ_FX || null;
  var fxRunner = null, fxDetector = null, fxShown = false;
  var finishSettings = FX ? FX.sanitizeFinish(readStore('viz.finish')) : null;
  var rackOn = true;
  var rack = [];   // [{ id, params }] in order; sanitized once every effect has registered
  var FINISH_SLIDERS = [
    { key: 'strength', label: 'Strength' },
    { key: 'motionBlur', label: 'Motion blur' },
    { key: 'bloom', label: 'Bloom' },
    { key: 'softness', label: 'Soft focus' },
    { key: 'grain', label: 'Grain' },
    { key: 'vignette', label: 'Vignette' },
    { key: 'aberration', label: 'Aberration' }
  ];

  (function restoreRack() {
    if (!FX) return;
    var saved = readStore('viz.fx.rack');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      rackOn = saved.on !== false;
      saved = saved.effects;
    }
    rack = (Array.isArray(saved) ? saved : []).filter(function (e) { return e && typeof e.id === 'string'; })
      .map(function (e) { return { id: e.id, params: e.params || {} }; });
  })();

  function saveFinish() { writeStore('viz.finish', finishSettings); }
  function saveRack() {
    writeStore('viz.fx.rack', { on: rackOn, effects: rack.map(function (e) { return { id: e.id, params: e.params }; }) });
  }

  // Beat phase for effects. Core detects no tempo (see the performer
  // controls): Demo's grid is exact, anything else assumes 124 BPM.
  function beatClock() {
    var len = 60 / (source === 'demo' ? DEMO_BPM : ASSUMED_BPM);
    var pos = performance.now() / 1000 / len;
    return { beat: pos - Math.floor(pos), beatIndex: Math.floor(pos) };
  }

  function fxChain() {
    var chain = [];
    if (rackOn) rack.forEach(function (e) {
      var def = FX.get(e.id);
      if (def) chain.push({ key: 'rack:' + e.id, def: def, params: e.params });
    });
    return chain.concat(FX.finishChain(finishSettings, current ? current.finish : undefined));
  }

  function showFx(on, p) {
    if (on !== fxShown) {
      fxShown = on;
      fxRunner.canvas.style.display = on ? 'block' : 'none';
      // Hidden rather than removed: it is still the rack's source every frame.
      p.drawingContext.canvas.style.visibility = on ? 'hidden' : '';
      if (!on) fxRunner.reset();
    }
    if (on) {
      var st = fxRunner.canvas.style, c = p.drawingContext.canvas;
      if (st.width !== c.style.width) st.width = c.style.width;
      if (st.height !== c.style.height) st.height = c.style.height;
    }
  }

  function renderFx(p, signals) {
    if (!FX) return;
    if (!fxRunner) {
      fxRunner = FX.createRunner();
      fxDetector = FX.createDetector();
      var c = fxRunner.canvas;
      c.style.cssText = 'position:absolute;left:0;top:0;display:none;pointer-events:none';
      // First in the stage, so the drop hint and stage note still paint over it.
      $('stage').insertBefore(c, $('stage').firstChild);
      c.addEventListener('webglcontextlost', function () { if (p5inst) showFx(false, p5inst); });
    }
    var det = fxDetector.update(signals, (p.deltaTime || 16.7) / 1000);
    var chain = fxRunner.available ? fxChain() : [];
    var ok = false;
    if (chain.length) {
      var clock = beatClock();
      ok = fxRunner.render(p.drawingContext.canvas, chain, {
        time: p.millis() / 1000, dt: (p.deltaTime || 16.7) / 1000, bands: det.bands,
        kick: det.kick, snare: det.snare, hat: det.hat, beat: clock.beat, beatIndex: clock.beatIndex
      });
    }
    showFx(ok, p);
  }

  function toggleFinish() {
    if (!finishSettings) return;
    finishSettings.on = !finishSettings.on;
    saveFinish();
    syncFinishPanel();
  }

  var finishSyncs = [];
  function syncFinishPanel() { finishSyncs.forEach(function (f) { f(); }); }

  function sliderRow(id, label, value, min, max, step, onInput) {
    var row = el('div', { class: 'row' });
    var head = el('div', { class: 'row-head' });
    head.appendChild(el('label', { for: id }, label));
    var out = el('output', { class: 'val', id: id + '-val', for: id });
    head.appendChild(out);
    var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step) });
    var dec = decimalsFor(step);
    var sync = function () {
      var v = value();
      input.value = String(v);
      setRangeFill(input, v, min, max);
      out.textContent = Number(v).toFixed(dec);
    };
    input.addEventListener('input', function () { onInput(parseFloat(input.value)); sync(); });
    row.appendChild(head); row.appendChild(input);
    sync();
    return { row: row, sync: sync };
  }

  function segRow(id, label, names, value, onPick) {
    var row = el('div', { class: 'row' });
    var head = el('div', { class: 'row-head' });
    head.appendChild(el('span', { class: 'label', id: id + '-label' }, label));
    row.appendChild(head);
    var seg = el('div', { class: 'seg', role: 'group', 'aria-labelledby': id + '-label', id: id });
    var btns = names.map(function (n, i) {
      var b = el('button', { type: 'button', id: id + '-' + i }, n);
      b.addEventListener('click', function () { onPick(i); });
      seg.appendChild(b);
      return b;
    });
    row.appendChild(seg);
    var sync = function () { btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(value() === i)); }); };
    sync();
    return { row: row, sync: sync };
  }

  function buildFinishPanel() {
    var box = $('finish-controls');
    if (!box) return;
    if (!FX) { box.appendChild(el('p', { class: 'helper' }, 'fx.js did not load.')); return; }
    var onRow = segRow('finish-on', 'Finish', ['On', 'Off'], function () { return finishSettings.on ? 0 : 1; },
      function (i) { finishSettings.on = i === 0; saveFinish(); syncFinishPanel(); });
    onRow.row.querySelector('.row-head').appendChild(el('span', { class: 'tag' }, 'L'));
    box.appendChild(onRow.row);
    var note = el('p', { class: 'helper', id: 'finish-note' });
    box.appendChild(note);
    var gradeRow = segRow('finish-grade', 'Grade', FX.GRADE_NAMES, function () { return finishSettings.grade; },
      function (i) { finishSettings.grade = i; saveFinish(); syncFinishPanel(); });
    box.appendChild(gradeRow.row);
    finishSyncs = [onRow.sync, gradeRow.sync];
    FINISH_SLIDERS.forEach(function (f) {
      var r = sliderRow('finish-' + f.key, f.label, function () { return finishSettings[f.key]; }, 0, 1, 0.01,
        function (v) { finishSettings[f.key] = v; saveFinish(); });
      box.appendChild(r.row);
      finishSyncs.push(r.sync);
    });
    finishSyncs.push(function () {
      var sf = current ? current.finish : undefined;
      note.textContent = !finishSettings.on ? 'Off: the scene as drawn.'
        : sf === false ? 'This scene opts out of the Finish.'
        : sf && typeof sf === 'object' ? 'This scene sets its own Finish amounts.'
        : 'Lens, light and grade over every scene.';
    });
    syncFinishPanel();
  }

  function buildRackPanel() {
    var box = $('fx-rack');
    if (!box) return;
    box.textContent = '';
    if (!FX) return;
    var onRow = segRow('fx-on', 'Rack', ['On', 'Bypass'], function () { return rackOn ? 0 : 1; },
      function (i) { rackOn = i === 0; saveRack(); buildRackPanel(); });
    box.appendChild(onRow.row);

    var add = el('div', { class: 'fx-add' });
    var sel = el('select', { id: 'fx-pick', 'aria-label': 'Effect to add' });
    var groups = {};
    FX.list().forEach(function (def) {
      if (rack.some(function (e) { return e.id === def.id; })) return;
      var g = def.group || 'other';
      if (!groups[g]) { groups[g] = el('optgroup', { label: g.charAt(0).toUpperCase() + g.slice(1) }); sel.appendChild(groups[g]); }
      groups[g].appendChild(el('option', { value: def.id }, def.name || def.id));
    });
    var addBtn = el('button', { type: 'button', class: 'btn', id: 'fx-add' }, 'Add');
    addBtn.disabled = !sel.options.length;
    addBtn.addEventListener('click', function () {
      var def = FX.get(sel.value);
      if (!def) return;
      rack.push({ id: def.id, params: FX.paramDefaults(def) });
      saveRack();
      buildRackPanel();
    });
    add.appendChild(sel); add.appendChild(addBtn);
    box.appendChild(add);

    if (!rack.length) box.appendChild(el('p', { class: 'helper' }, 'Effects run on the scene in this order, before the Finish.'));
    rack.forEach(function (entry, idx) {
      var def = FX.get(entry.id);
      var item = el('div', { class: 'fx-entry' + (def ? '' : ' missing'), id: 'fx-entry-' + entry.id });
      var head = el('div', { class: 'fx-entry-head' });
      head.appendChild(el('span', { class: 'fx-name' }, def ? def.name || def.id : entry.id + ' (not loaded)'));
      var mk = function (label, title, fn, disabled) {
        var b = el('button', { type: 'button', class: 'btn fx-mini', title: title, 'aria-label': title }, label);
        b.disabled = !!disabled;
        b.addEventListener('click', function () { fn(); saveRack(); buildRackPanel(); });
        head.appendChild(b);
      };
      var name = def ? def.name || def.id : entry.id;
      mk('↑', 'Move ' + name + ' up', function () { rack.splice(idx - 1, 0, rack.splice(idx, 1)[0]); }, idx === 0);
      mk('↓', 'Move ' + name + ' down', function () { rack.splice(idx + 1, 0, rack.splice(idx, 1)[0]); }, idx === rack.length - 1);
      mk('×', 'Remove ' + name, function () { rack.splice(idx, 1); if (fxRunner) fxRunner.reset('rack:' + entry.id); });
      item.appendChild(head);
      if (def) {
        entry.params = FX.sanitizeParams(def, entry.params);
        def.params.forEach(function (spec) {
          var step = spec.step || niceStep(spec.max - spec.min);
          var r = sliderRow('fx-' + def.id + '-' + spec.key, spec.label || spec.key, function () { return entry.params[spec.key]; },
            spec.min, spec.max, step, function (v) { entry.params[spec.key] = v; saveRack(); });
          item.appendChild(r.row);
        });
        if (fxRunner && fxRunner.broken[def.id]) item.appendChild(el('p', { class: 'note warn' }, 'This effect failed to compile; it is skipped.'));
      }
      box.appendChild(item);
    });
  }

  // An effect file that loads after start-up still shows in the Add list.
  if (FX) FX.onRegister = function () { if (document.readyState === 'complete') buildRackPanel(); };

  // ---------------------------------------------------------------- p5 host
  function updateScale(p) {
    drawScale = Math.min(p.width, p.height) / VIRTUAL_SHORT_SIDE || 1;
    ctx.width = p.width / drawScale;
    ctx.height = p.height / drawScale;
  }

  function stageSize() {
    var s = $('stage');
    return { w: Math.max(1, s.clientWidth), h: Math.max(1, s.clientHeight) };
  }

  function sketch(p) {
    p.preload = function () {
      registry.forEach(function (def) {
        if (typeof def.preload === 'function') safeCall(def, 'preload', [p]);
      });
    };

    p.setup = function () {
      var size = stageSize();
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.createCanvas(size.w, size.h);
      p.smooth();
      p.background(0);
      updateScale(p);
      p5ready = true;
      registry.forEach(function (def) {
        if (typeof def.setup === 'function') safeCall(def, 'setup', [p, ctx]);
      });
      var remembered = byId(readStore('viz.selected'));
      var first = remembered ? familyOf(remembered) : (listedDefs()[0] || {}).id;
      if (first) {
        current = null;   // so selectViz runs enter() now that p5 exists
        selectScene(first);
      } else {
        buildVizList();
        buildControls();
      }

      var resize = function () {
        var sz = stageSize();
        if (sz.w === p.width && sz.h === p.height) return;
        p.resizeCanvas(sz.w, sz.h);
        updateScale(p);
      };
      if (window.ResizeObserver) new ResizeObserver(resize).observe($('stage'));
      window.addEventListener('resize', resize);
    };

    p.draw = function () {
      var signals = computeSignals();
      monitorTick(signals, p);
      var def = current;
      if (!def) { p.background(0); return; }
      // Performer motion runs before the scene draws, so glides, the fader and
      // the drop land on this frame rather than the next.
      stepPerformer(signals);
      // p5 keeps a style stack; if a viz throws between its own push and pop,
      // unwinding to the recorded depth stops that leaking frame after frame.
      var depth = p._styles ? p._styles.length : 0;
      var failed = false;
      p.push();
      p.scale(drawScale);
      try {
        def.draw(p, signals, paramValues[def.id], ctx);
      } catch (e) {
        failed = true;
        if (!failedDraw[def.id]) {
          failedDraw[def.id] = true;
          console.error('viz: ' + def.id + '.draw failed; showing black until it recovers', e);
        }
      }
      if (p._styles) { while (p._styles.length > depth) p.pop(); }
      else p.pop();
      if (failed) {
        p.push();
        p.resetMatrix();
        p.background(0);
        p.pop();
      }
      renderFx(p, signals);
    };
  }

  function start() {
    bindPanel();
    buildVizList();
    if (typeof window.p5 !== 'function') {
      var note = $('stage-note');
      note.textContent = 'p5.js did not load, so nothing can be drawn. Check the connection and reload.';
      note.hidden = false;
      buildControls();
      return;
    }
    p5inst = new window.p5(sketch, $('stage'));
  }

  // Every viz/*.js registers during parsing; waiting for load means all of them
  // (or all that exist) are in before preload runs.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
