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
    }
  }

  window.VIZ = { register: register };

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

  function buildVizList() {
    var list = $('viz-list');
    list.textContent = '';
    if (!registry.length) {
      list.appendChild(el('p', { class: 'empty' }, 'No visuals loaded.'));
      return;
    }
    registry.forEach(function (def, i) {
      var b = el('button', { type: 'button', id: 'viz-' + def.id });
      if (i < 9) b.appendChild(el('kbd', null, String(i + 1)));
      b.appendChild(el('span', null, def.name || def.id));
      b.setAttribute('aria-current', String(current === def));
      b.addEventListener('click', function () { selectViz(def.id); });
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
    var commit = function (v) { params[spec.key] = v; saveParams(def); };
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
      (def.params || []).forEach(function (spec) { params[spec.key] = defaultFor(spec); });
      saveParams(def);
      syncControls();
    });
    actions.appendChild(reset);
    box.appendChild(actions);
    syncControls();
  }

  function syncControls() { controlSyncs.forEach(function (f) { f(); }); }

  function selectViz(id) {
    var def = registry.filter(function (d) { return d.id === id; })[0];
    if (!def) return;
    if (def !== current) {
      if (current && p5ready && typeof current.leave === 'function') safeCall(current, 'leave', [p5inst]);
      current = def;
      if (p5ready && typeof def.enter === 'function') safeCall(def, 'enter', [p5inst, ctx]);
      writeStore('viz.selected', def.id);
    }
    buildVizList();
    buildControls();
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
    if (k === 'h' || k === 'H') { togglePanel(); e.preventDefault(); }
    else if (k === 'f' || k === 'F') { toggleFullscreen(); e.preventDefault(); }
    else if (/^[1-9]$/.test(k)) {
      var def = registry[Number(k) - 1];
      if (def) { selectViz(def.id); e.preventDefault(); }
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
    renderSource();
    bindDrop();
    window.addEventListener('keydown', onKey);
  }

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
      var remembered = readStore('viz.selected');
      var first = registry.filter(function (d) { return d.id === remembered; })[0] || registry[0];
      if (first) {
        current = null;   // so selectViz runs enter() now that p5 exists
        selectViz(first.id);
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
