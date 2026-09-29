// viz effects rack: the registry, the WebGL2 runner that pushes the scene frame
// through an ordered chain of effects, simple kick / snare / hat detectors, and
// the Finish (a fixed tail of three effects: motion blur, bloom, film). Plain
// script, no modules; both web/core.js and harness/stage.js host it. The effect
// interface is specified in harness/briefs/fx.md.
//
// Why a separate canvas: the p5 canvas stays Canvas 2D (every scene is written
// against it), and each frame is copied into a WebGL2 texture. Measured
// 2026-09-28 on the M4 Pro at 3024x1890: uploading a GPU-backed 2D canvas is a
// GPU-to-GPU copy costing about 1.1 ms of the frame, no slower than uploading
// from a WebGL canvas (1.9 ms), and hiding the 2D canvas under the finished one
// costs nothing extra. So scenes are untouched and the rack costs one upload
// plus its own passes.
(function () {
  'use strict';

  var BANDS = 9;
  var MAX_PASS_SAMPLERS = 12;   // uPass0 .. uPass11

  // ---------------------------------------------------------------- registry
  var defs = {};

  function register(def) {
    if (!def || typeof def.id !== 'string' || !Array.isArray(def.passes) || !def.passes.length) {
      console.error('viz fx: VIZ_FX.register needs an id and at least one pass', def);
      return;
    }
    def.params = Array.isArray(def.params) ? def.params : [];
    def.history = Math.max(0, Math.min(32, Math.round(def.history || 0)));
    defs[def.id] = def;
    if (api.onRegister) api.onRegister(def);
  }

  function list() {
    var GROUPS = ['space', 'time', 'colour', 'texture', 'lens'];
    return Object.keys(defs).map(function (k) { return defs[k]; })
      .filter(function (d) { return !d.hidden; })
      .sort(function (a, b) {
        var ga = GROUPS.indexOf(a.group), gb = GROUPS.indexOf(b.group);
        if (ga !== gb) return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb);
        return (a.name || a.id) < (b.name || b.id) ? -1 : 1;
      });
  }

  function paramDefaults(def) {
    var out = {};
    def.params.forEach(function (s) { out[s.key] = typeof s.default === 'number' ? s.default : s.min; });
    return out;
  }

  // Stored and command-line values are clamped against the current spec, so an
  // effect can retune its params without breaking what was saved.
  function sanitizeParams(def, raw) {
    var out = paramDefaults(def);
    if (raw && typeof raw === 'object') def.params.forEach(function (s) {
      var v = Number(raw[s.key]);
      if (s.key in raw && isFinite(v)) out[s.key] = Math.min(s.max, Math.max(s.min, v));
    });
    return out;
  }

  // ------------------------------------------------------------- detectors
  // Kick, snare and hat envelopes (0-1) from the nine 0-100 bands: an onset is
  // a band group rising above its own slow average, and the envelope decays
  // after it. Crude, but it rides the same signals the scenes see, so an effect
  // stepped on uKick lands with the scene's own kick.
  function createDetector() {
    var groups = [
      { bands: [0, 1], decay: 0.16, gain: 3.2 },   // kick
      { bands: [3, 4, 5], decay: 0.14, gain: 3.2 }, // snare / clap
      { bands: [6, 7, 8], decay: 0.07, gain: 3.5 }  // hats
    ];
    var base = [0, 0, 0], env = [0, 0, 0], last = [0, 0, 0];
    var bands01 = new Float32Array(BANDS);
    return {
      update: function (signals, dt) {
        dt = Math.min(0.1, Math.max(0.001, dt || 1 / 60));
        for (var b = 0; b < BANDS; b++) bands01[b] = Math.min(1, Math.max(0, (signals[b] || 0) / 100));
        for (var g = 0; g < 3; g++) {
          var G = groups[g], lvl = 0;
          for (var i = 0; i < G.bands.length; i++) lvl += bands01[G.bands[i]];
          lvl /= G.bands.length;
          var rise = lvl - last[g];
          var over = lvl - base[g];
          env[g] *= Math.exp(-dt / G.decay);
          if (rise > 0.04 && over > 0.08) env[g] = Math.max(env[g], Math.min(1, over * G.gain));
          base[g] += (lvl - base[g]) * (1 - Math.exp(-dt / 0.45));
          last[g] = lvl;
        }
        return { bands: bands01, kick: env[0], snare: env[1], hat: env[2] };
      },
      reset: function () { base = [0, 0, 0]; env = [0, 0, 0]; last = [0, 0, 0]; }
    };
  }

  // ------------------------------------------------------------------ GLSL
  var VERT = '#version 300 es\n' +
    'out vec2 vUv;\n' +
    'void main() {\n' +
    '  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n' +
    '  vUv = p;\n' +
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n' +
    '}\n';

  // stage 'vert' is the header for a mesh pass's vertex shader (see
  // createRunner): the same uniforms and helpers, with vUv as an output.
  function header(def, stage) {
    var h = '#version 300 es\n' +
      'precision highp float;\n' +
      'precision highp sampler2DArray;\n' +
      // Uniforms shared by both stages must agree on precision, and ints
      // default to mediump in a fragment shader but highp in a vertex one.
      (stage === 'vert' ? 'precision mediump int;\n' : '') +
      'uniform sampler2D uSrc;\n' +
      'uniform sampler2D uScene;\n' +
      'uniform sampler2D uPrev;\n' +
      'uniform sampler2D uInput;\n';
    for (var i = 0; i < MAX_PASS_SAMPLERS; i++) h += 'uniform sampler2D uPass' + i + ';\n';
    h += 'uniform sampler2DArray uHist;\n' +
      'uniform int uHistLen;\n' +
      'uniform int uHistHead;\n' +
      'uniform vec2 uRes;\n' +
      'uniform float uTime;\n' +
      'uniform float uDt;\n' +
      'uniform float uBands[9];\n' +
      'uniform float uKick;\n' +
      'uniform float uSnare;\n' +
      'uniform float uHat;\n' +
      'uniform float uBeat;\n' +
      'uniform float uBeatIndex;\n' +
      (stage === 'vert' ? 'out vec2 vUv;\n' : 'in vec2 vUv;\n' + 'out vec4 fragColor;\n');
    def.params.forEach(function (s) { h += 'uniform float p_' + s.key + ';\n'; });
    // Helpers every effect may use.
    h += 'float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }\n' +
      'float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n' +
      'vec3 toLinear(vec3 c) { c = max(c, 0.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }\n' +
      'vec2 mirrorUv(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }\n' +
      'vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }\n' +
      '// n frames ago (0 = this frame\'s input), clamped to what has been kept.\n' +
      'vec4 histFrame(vec2 uv, int n) {\n' +
      '  int L = textureSize(uHist, 0).z;\n' +
      '  n = clamp(n, 0, max(uHistLen - 1, 0));\n' +
      '  return texture(uHist, vec3(uv, float((uHistHead - n + L * 64) % L)));\n' +
      '}\n' +
      '#line 1\n';
    return h;
  }

  var COPY_FRAG = '#version 300 es\nprecision highp float;\nuniform sampler2D uSrc;\nin vec2 vUv;\nout vec4 fragColor;\n' +
    'void main() { fragColor = vec4(texture(uSrc, vUv).rgb, 1.0); }\n';

  // ---------------------------------------------------------------- runner
  // opts: { preserve: bool } (the harness reads the canvas back after drawing).
  function createRunner(opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    var runner = { canvas: canvas, available: false, render: function () { return false; }, reset: function () {}, broken: {} };
    var gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
        preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance'
      });
    } catch (e) { gl = null; }
    if (!gl) return runner;

    // Half-float targets keep feedback and bloom sums from banding; without
    // the extension everything still runs in 8 bits.
    var floatOK = !!gl.getExtension('EXT_color_buffer_float');
    var IFMT = floatOK ? gl.RGBA16F : gl.RGBA8;
    var vao = gl.createVertexArray();
    var W = 0, H = 0;
    var sceneTex = null;
    var chainBufs = [];   // two full-size targets the chain ping-pongs through
    var programs = {};    // def.id + '#' + pass -> program record
    var states = {};      // instance key -> per-instance GPU state
    var lost = false;
    var copyProg = null;

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; runner.available = false; });

    function makeTex(w, h, ifmt) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, ifmt || IFMT, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function makeTarget(w, h) {
      var tex = makeTex(w, h);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex: tex, fb: fb, w: w, h: h };
    }
    function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }

    var dummy2D = makeTex(1, 1, gl.RGBA8);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    var dummyArr = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, dummyArr);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 1, 1, 1);

    function compile(fragSrc, label, vertSrc) {
      function sh(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          var log = gl.getShaderInfoLog(s);
          gl.deleteShader(s);
          throw new Error(label + ': ' + log);
        }
        return s;
      }
      var p = gl.createProgram();
      var v = sh(gl.VERTEX_SHADER, vertSrc || VERT), f = sh(gl.FRAGMENT_SHADER, fragSrc);
      gl.attachShader(p, v); gl.attachShader(p, f);
      gl.linkProgram(p);
      gl.deleteShader(v); gl.deleteShader(f);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(label + ': ' + gl.getProgramInfoLog(p));
      var rec = { prog: p, u: {} };
      var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var info = gl.getActiveUniform(p, i);
        var name = info.name.replace(/\[0\]$/, '');
        rec.u[name] = gl.getUniformLocation(p, info.name);
      }
      // Fixed texture units, bound per pass below.
      gl.useProgram(p);
      var units = { uSrc: 0, uScene: 1, uPrev: 2, uInput: 3, uHist: 4 };
      for (var k = 0; k < MAX_PASS_SAMPLERS; k++) units['uPass' + k] = 5 + k;
      Object.keys(units).forEach(function (name) { if (rec.u[name]) gl.uniform1i(rec.u[name], units[name]); });
      return rec;
    }

    function programFor(def, i) {
      var key = def.id + '#' + i;
      if (!(key in programs)) {
        var pass = def.passes[i];
        try {
          programs[key] = compile(header(def) + pass.frag, 'fx ' + def.id + ' pass ' + i,
            pass.mesh ? header(def, 'vert') + pass.vert : null);
        }
        catch (e) {
          programs[key] = null;
          if (!runner.broken[def.id]) { runner.broken[def.id] = String(e.message || e); console.error('viz fx: ' + e.message); }
        }
      }
      return programs[key];
    }

    function usesPrev(def) {
      if (def._usesPrev == null) def._usesPrev = def.passes.some(function (p) { return /\buPrev\b/.test(p.frag); });
      return def._usesPrev;
    }

    function passSize(scale) {
      var s = typeof scale === 'number' && scale > 0 ? Math.min(1, scale) : 1;
      return { w: Math.max(1, Math.round(W * s)), h: Math.max(1, Math.round(H * s)) };
    }

    function freeState(st) {
      st.passes.forEach(freeTarget);
      st.prev.forEach(freeTarget);
      if (st.hist) { gl.deleteTexture(st.hist.tex); st.hist.fbs.forEach(function (f) { gl.deleteFramebuffer(f); }); }
    }

    function stateFor(key, def) {
      var st = states[key];
      if (st && (st.def !== def || st.W !== W || st.H !== H)) { freeState(st); st = null; }
      if (!st) {
        st = { def: def, W: W, H: H, passes: [], prev: [], prevIdx: 0, hist: null };
        var last = def.passes.length - 1;
        for (var i = 0; i < last; i++) {
          var sz = passSize(def.passes[i].scale);
          st.passes.push(makeTarget(sz.w, sz.h));
        }
        if (usesPrev(def)) st.prev = [makeTarget(W, H), makeTarget(W, H)];
        if (def.history > 0) {
          var hs = typeof def.historyScale === 'number' && def.historyScale > 0 ? Math.min(1, def.historyScale) : 0.5;
          var hw = Math.max(1, Math.round(W * hs)), hh = Math.max(1, Math.round(H * hs));
          var tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
          gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, hw, hh, def.history);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          var fbs = [];
          for (var l = 0; l < def.history; l++) {
            var fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, l);
            fbs.push(fb);
          }
          st.hist = { tex: tex, fbs: fbs, w: hw, h: hh, head: -1, len: 0 };
        }
        states[key] = st;
      }
      return st;
    }

    function ensureSize(w, h) {
      if (w === W && h === H && sceneTex) return;
      W = w; H = h;
      canvas.width = w; canvas.height = h;
      if (sceneTex) gl.deleteTexture(sceneTex);
      sceneTex = makeTex(w, h, gl.RGBA8);
      chainBufs.forEach(freeTarget);
      chainBufs = [makeTarget(w, h), makeTarget(w, h)];
      Object.keys(states).forEach(function (k) { freeState(states[k]); delete states[k]; });
    }

    function bind(unit, target, tex) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(target, tex);
    }

    function draw(rec, fb, w, h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function copy(srcTex, fb, w, h) {
      if (!copyProg) copyProg = compile(COPY_FRAG, 'fx copy');
      gl.useProgram(copyProg.prog);
      bind(0, gl.TEXTURE_2D, srcTex);
      draw(copyProg, fb, w, h);
    }

    // chain: [{ key, def, params }] in order. frame: { time, dt, bands (0-1),
    // kick, snare, hat, beat (phase 0-1), beatIndex (whole beats so far) }. Draws the result on runner.canvas and returns
    // true, or returns false if nothing could be drawn (caller shows the scene).
    runner.render = function (source, chain, frame) {
      if (lost) return false;
      var w = source.width, h = source.height;
      if (!w || !h) return false;
      ensureSize(w, h);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);

      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      var live = {};
      var runnable = chain.filter(function (inst) {
        if (!inst || !inst.def || runner.broken[inst.def.id]) return false;
        for (var i = 0; i < inst.def.passes.length; i++) if (!programFor(inst.def, i)) return false;
        return true;
      });

      var input = sceneTex;            // texture feeding the next effect
      var inputBuf = -1;               // which chain buffer holds it (-1: neither)
      var onCanvas = false;
      for (var e = 0; e < runnable.length; e++) {
        var inst = runnable[e], def = inst.def;
        live[inst.key] = true;
        var st = stateFor(inst.key, def);
        var params = inst.params || {};

        if (st.hist) {
          var H_ = st.hist;
          H_.head = (H_.head + 1) % def.history;
          H_.len = Math.min(def.history, H_.len + 1);
          copy(input, H_.fbs[H_.head], H_.w, H_.h);
        }

        var prevRead = st.prev.length ? st.prev[st.prevIdx].tex : dummy2D;
        var lastOut = input;
        var isLastEffect = e === runnable.length - 1;
        for (var i = 0; i < def.passes.length; i++) {
          var rec = programs[def.id + '#' + i];
          var isLast = i === def.passes.length - 1;
          var target;
          if (!isLast) target = st.passes[i];
          else if (st.prev.length) target = st.prev[1 - st.prevIdx];
          else if (isLastEffect) target = null;   // straight onto the canvas
          else { var nb = inputBuf === 0 ? 1 : 0; target = chainBufs[nb]; inputBuf = nb; }

          var mesh = def.passes[i].mesh;
          // A mesh pass draws its triangles over a copy of its input, so the
          // copy goes down first, before this pass's textures are bound.
          if (mesh) copy(lastOut, target ? target.fb : null, target ? target.w : W, target ? target.h : H);
          gl.useProgram(rec.prog);
          var u = rec.u;
          bind(0, gl.TEXTURE_2D, lastOut);
          bind(1, gl.TEXTURE_2D, sceneTex);
          bind(2, gl.TEXTURE_2D, prevRead);
          bind(3, gl.TEXTURE_2D, input);
          bind(4, gl.TEXTURE_2D_ARRAY, st.hist ? st.hist.tex : dummyArr);
          for (var k = 0; k < MAX_PASS_SAMPLERS; k++) {
            if (u['uPass' + k]) bind(5 + k, gl.TEXTURE_2D, k < st.passes.length ? st.passes[k].tex : dummy2D);
          }
          var tw = target ? target.w : W, th = target ? target.h : H;
          if (u.uRes) gl.uniform2f(u.uRes, tw, th);
          if (u.uTime) gl.uniform1f(u.uTime, frame.time || 0);
          if (u.uDt) gl.uniform1f(u.uDt, frame.dt || 1 / 60);
          if (u.uBands) gl.uniform1fv(u.uBands, frame.bands || new Float32Array(BANDS));
          if (u.uKick) gl.uniform1f(u.uKick, frame.kick || 0);
          if (u.uSnare) gl.uniform1f(u.uSnare, frame.snare || 0);
          if (u.uHat) gl.uniform1f(u.uHat, frame.hat || 0);
          if (u.uBeat) gl.uniform1f(u.uBeat, frame.beat || 0);
          if (u.uBeatIndex) gl.uniform1f(u.uBeatIndex, frame.beatIndex || 0);
          if (u.uHistLen) gl.uniform1i(u.uHistLen, st.hist ? st.hist.len : 0);
          if (u.uHistHead) gl.uniform1i(u.uHistHead, st.hist ? st.hist.head : 0);
          for (var pi = 0; pi < def.params.length; pi++) {
            var s = def.params[pi], loc = u['p_' + s.key];
            if (loc) gl.uniform1f(loc, s.key in params ? params[s.key] : s.default);
          }
          if (mesh) {
            // fragColor.a is coverage (edge antialiasing); alpha in the
            // target stays 1 so later passes see an opaque frame.
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
            gl.drawArrays(gl.TRIANGLES, 0, Math.round(mesh) * 3);
            gl.disable(gl.BLEND);
          } else draw(rec, target ? target.fb : null, tw, th);
          if (!target) onCanvas = true;
          else lastOut = target.tex;
        }
        if (st.prev.length) { st.prevIdx = 1 - st.prevIdx; inputBuf = -1; }
        input = lastOut;
      }
      if (!onCanvas) copy(input, null, W, H);

      // Effects taken out of the chain give their GPU memory back.
      Object.keys(states).forEach(function (k) { if (!live[k]) { freeState(states[k]); delete states[k]; } });
      return true;
    };

    // Forget every effect's past (uPrev, history): a scene switch or turning
    // an effect back on should not blend in a stale frame.
    runner.reset = function (key) {
      Object.keys(states).forEach(function (k) {
        if (key && k !== key) return;
        freeState(states[k]); delete states[k];
      });
    };

    runner.available = true;
    runner.gl = gl;
    return runner;
  }

  // ---------------------------------------------------------------- finish
  // The Finish is the rack's fixed tail: motion blur, then bloom (with soft
  // focus and halation), then film (tone curve, grade, aberration, vignette,
  // grain). Its panel knobs are a performer-sized layer over those three
  // effects' params; Strength scales them all. A scene can opt out with
  // `finish: false` or scale stages with `finish: { bloom: 0.5, ... }` (see
  // CONTRACT.md).
  var FINISH_DEFAULTS = {
    on: true, grade: 1, strength: 1,
    motionBlur: 0.4, bloom: 0.45, softness: 0.4, grain: 0.35, vignette: 0.35, aberration: 0
  };
  var FINISH_KEYS = ['strength', 'motionBlur', 'bloom', 'softness', 'grain', 'vignette', 'aberration'];
  var GRADE_NAMES = ['Neutral', 'Film', 'Print', 'Night', 'Bleach'];

  function sanitizeFinish(raw) {
    var out = {};
    Object.keys(FINISH_DEFAULTS).forEach(function (k) { out[k] = FINISH_DEFAULTS[k]; });
    if (raw && typeof raw === 'object') {
      if (typeof raw.on === 'boolean') out.on = raw.on;
      var g = Math.round(Number(raw.grade));
      if (isFinite(g)) out.grade = Math.min(GRADE_NAMES.length - 1, Math.max(0, g));
      FINISH_KEYS.forEach(function (k) {
        var v = Number(raw[k]);
        if (k in raw && isFinite(v)) out[k] = Math.min(1, Math.max(0, v));
      });
    }
    return out;
  }

  // The scene's `finish` field: false opts out; an object scales stages
  // (numbers, 1 = as set, 0 = off) and may name a grade.
  function sceneScale(sceneFinish, key) {
    if (!sceneFinish || typeof sceneFinish !== 'object') return 1;
    var v = Number(sceneFinish[key]);
    return key in sceneFinish && isFinite(v) ? Math.max(0, v) : 1;
  }

  // The three finish effects with their effective params, or [] when off.
  function finishChain(settings, sceneFinish) {
    if (!settings.on || sceneFinish === false) return [];
    var s = settings.strength * sceneScale(sceneFinish, 'strength');
    var m = function (k) { return s * sceneScale(sceneFinish, k); };
    var grade = settings.grade;
    if (sceneFinish && typeof sceneFinish.grade === 'string') {
      var gi = GRADE_NAMES.map(function (n) { return n.toLowerCase(); }).indexOf(sceneFinish.grade.toLowerCase());
      if (gi >= 0) grade = gi;
    }
    var out = [];
    var mb = defs.motionblur, bl = defs.bloom, fm = defs.film;
    if (mb) out.push({ key: 'finish:motionblur', def: mb, params: { amount: Math.min(1, settings.motionBlur * m('motionBlur')) } });
    if (bl) out.push({ key: 'finish:bloom', def: bl, params: {
      bloom: Math.min(1, settings.bloom * m('bloom')),
      softness: Math.min(1, settings.softness * m('softness')),
      halation: Math.min(1, 0.5 * m('halation')),
      threshold: paramDefaults(bl).threshold
    } });
    if (fm) out.push({ key: 'finish:film', def: fm, params: {
      tone: Math.min(1, m('tone')),
      grade: grade,
      look: Math.min(1, m('grade')),
      grain: Math.min(1, settings.grain * m('grain')),
      vignette: Math.min(1, settings.vignette * m('vignette')),
      aberration: Math.min(1, settings.aberration * m('aberration'))
    } });
    return out;
  }

  var api = {
    register: register,
    list: list,
    get: function (id) { return defs[id] || null; },
    paramDefaults: paramDefaults,
    sanitizeParams: sanitizeParams,
    createRunner: createRunner,
    createDetector: createDetector,
    FINISH_DEFAULTS: FINISH_DEFAULTS,
    FINISH_KEYS: FINISH_KEYS,
    GRADE_NAMES: GRADE_NAMES,
    FINISH_IDS: ['motionblur', 'bloom', 'film'],
    sanitizeFinish: sanitizeFinish,
    finishChain: finishChain,
    onRegister: null
  };
  window.VIZ_FX = api;
})();
