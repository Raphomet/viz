// GSAP kit: what the five GSAP sketches (scenes/gsap1.js … gsap5.js) share.
//
// GSAP 3.14.2 and its plugins from cdnjs. Since 3.13 every plugin (MorphSVG,
// DrawSVG, MotionPath, CustomBounce, CustomWiggle) is free, under GreenSock's
// "Standard no-charge license" (https://gsap.com/standard-license): free for
// commercial use; the one exclusion is building a visual animation builder
// that competes with Webflow, which viz is not. It is not an OSI licence,
// which batch 08's brief otherwise asks for: noted in the batch report.
//
// Three decisions every sketch relies on:
//
// 1. GSAP never runs on its own clock. Every timeline is created paused and
//    scrubbed each frame with .time()/.totalTime() from a beat clock, so
//    timelines are authored in *beats* (duration: 1 is one beat) and a morph
//    that lands "on the one" lands on the kick. GSAP's ticker is irrelevant,
//    and the render harness (which fakes time and runs no rAF) sees exactly
//    what the app sees.
//
// 2. GSAP animates plain JS objects and SVG elements, never the stage. The
//    SVG a plugin needs (MorphSVG writes `d`, DrawSVG writes a dash) lives in
//    one hidden <svg> off-screen; the sketches read the result back each
//    frame and draw it on the p5 canvas as Path2D. So everything goes through
//    the Finish and the effects rack like any other scene, and the harness
//    captures it. A visible SVG overlay would have skipped both.
//
// 3. The beat clock is a small phase-locked loop: it runs at 124 BPM (core's
//    assumption for real audio), and each detected kick pulls the nearest
//    beat onto itself and nudges the tempo, so under Demo's 120 BPM or a real
//    track it locks within a few bars. Snares land on beats 2 and 4, which
//    tells it where the bar starts.
(function () {
  'use strict';
  if (window.VIZ_GSAP) return;

  var VER = '3.14.2';
  var BASE = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/' + VER + '/';
  // File -> the global it defines, so a page that already has the tags
  // (web/index.html) loads nothing twice.
  var PLUGINS = [
    ['CustomEase.min.js', 'CustomEase'],
    ['CustomBounce.min.js', 'CustomBounce'],
    ['CustomWiggle.min.js', 'CustomWiggle'],
    ['MorphSVGPlugin.min.js', 'MorphSVGPlugin'],
    ['DrawSVGPlugin.min.js', 'DrawSVGPlugin'],
    ['MotionPathPlugin.min.js', 'MotionPathPlugin'],
    ['EasePack.min.js', 'RoughEase']
  ];

  function inject(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('gsap-kit: could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  var ready = null, ok = false;
  function load() {
    if (ready) return ready;
    ready = (window.gsap ? Promise.resolve() : inject(BASE + 'gsap.min.js'))
      .then(function () {
        return Promise.all(PLUGINS.filter(function (f) { return !window[f[1]]; })
          .map(function (f) { return inject(BASE + f[0]); }));
      })
      .then(function () {
        var g = window.gsap;
        g.registerPlugin(window.CustomEase, window.CustomBounce, window.CustomWiggle,
          window.MorphSVGPlugin, window.DrawSVGPlugin, window.MotionPathPlugin);
        // Nothing here plays on GSAP's own ticker; stop it asking for frames.
        g.ticker.lagSmoothing(0);
        ok = true;
      })
      .catch(function (e) { console.error(e); });
    return ready;
  }

  // The hidden SVG plugins write into. Off-screen rather than display:none,
  // because DrawSVG measures with getTotalLength, which wants a rendered tree.
  var root = null;
  var NS = 'http://www.w3.org/2000/svg';
  function svgRoot() {
    if (!root) {
      root = document.createElementNS(NS, 'svg');
      root.setAttribute('aria-hidden', 'true');
      root.setAttribute('width', '600'); root.setAttribute('height', '600');
      root.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;height:600px;visibility:hidden;pointer-events:none';
      document.body.appendChild(root);
    }
    return root;
  }
  function path(d) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('d', d);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', '#000');
    svgRoot().appendChild(el);
    return el;
  }

  // DrawSVG leaves its result as a dash on the element; this turns it into
  // canvas dash state. Returns false when the stroke is fully hidden.
  function applyDash(g, el) {
    var da = el.style.strokeDasharray, off = parseFloat(el.style.strokeDashoffset) || 0;
    if (!da || da === 'none') { g.setLineDash([]); g.lineDashOffset = 0; return true; }
    var parts = da.split(/[ ,]+/).map(parseFloat).filter(function (x) { return isFinite(x); });
    if (!parts.length || parts[0] <= 0.01) return false;
    g.setLineDash(parts);
    g.lineDashOffset = off;
    return true;
  }

  // Closed or open Catmull-Rom through points, as SVG cubic path data.
  function smoothD(pts, closed) {
    var n = pts.length, d = 'M' + f(pts[0][0]) + ',' + f(pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      var p1 = pts[i], p2 = pts[(i + 1) % n];
      var p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ',' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        f(p2[0] - (p3[0] - p1[0]) / 6) + ',' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ',' + f(p2[1]);
    }
    return d + (closed ? 'Z' : '');
  }
  function polyD(pts, closed) {
    var d = 'M' + f(pts[0][0]) + ',' + f(pts[0][1]);
    for (var i = 1; i < pts.length; i++) d += 'L' + f(pts[i][0]) + ',' + f(pts[i][1]);
    return d + (closed ? 'Z' : '');
  }
  function f(x) { return (Math.round(x * 100) / 100).toString(); }

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };

  // ---------------------------------------------------------------- the clock
  function createClock() {
    return {
      beat: 0, bpm: 124, shift: 0, corr: 0, lastT: null, dt: 1 / 60,
      prev: new Float32Array(9), lastKick: -9, lastSnare: -9, kick: false, snare: false,
      kickCount: 0, snareCount: 0, snareMiss: 0,
      bass: 0, low: 0, hat: 0, hatSlow: 0, pad: 0, dropOn: false, auto: 0,
      // pos is the beat count with the bar aligned: pos % 4 === 0 is the one.
      get pos() { return this.beat + this.shift; },
      update: function (s, t, follow) {
        var dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
        this.lastT = t; this.dt = dt;
        this.kick = false; this.snare = false;
        var per = 60 / this.bpm;
        if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - this.lastKick > 0.22) {
          var iv = t - this.lastKick, n = Math.round(iv / per);
          if (n >= 1 && n <= 2) {
            var est = iv / n;
            if (Math.abs(est - per) / per < 0.1) this.bpm = clamp(this.bpm + (60 / est - this.bpm) * 0.2, 90, 160);
          }
          // Pull the nearest beat onto the kick, spread over a few frames so a
          // scrubbed timeline never visibly jumps.
          this.corr -= (this.beat - Math.round(this.beat)) * 0.7;
          this.lastKick = t; this.kick = true; this.kickCount++;
        }
        if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - this.lastSnare > 0.3) {
          // Only a snare on the grid counts as evidence (the build's roll is not).
          var bp = this.pos, fr = bp - Math.round(bp);
          if (Math.abs(fr) < 0.15 && t - this.lastKick < 2) {
            if (((Math.round(bp) % 2) + 2) % 2 === 0) this.snareMiss++; else this.snareMiss = 0;
            if (this.snareMiss >= 2) { this.shift = (this.shift + 1) % 4; this.snareMiss = 0; }
          }
          this.lastSnare = t; this.snare = true; this.snareCount++;
        }
        this.prev.set(s);
        var step = this.corr * Math.min(1, dt * 12);
        this.corr -= step;
        var adv = dt * this.bpm / 60;
        this.beat += Math.max(adv * 0.3, adv + step);

        var k = function (tau) { return 1 - Math.exp(-dt / tau); };
        var b = s[1] / 100;
        this.bass += (b - this.bass) * (b > this.bass ? k(0.05) : k(0.3));
        this.low += (s[1] - this.low) * k(0.9);
        var h = Math.max(s[7], s[8]) / 100;
        this.hat += (h - this.hat) * (h > this.hat ? k(0.01) : k(0.07));
        this.hatSlow += (h - this.hatSlow) * k(1.2);
        var pd = (s[2] + s[3] + s[4]) / 300;
        this.pad += (pd - this.pad) * k(0.4);
        // The drop's sidechained bass line is a slow, reliable tell (as in
        // Grunge V2), with hysteresis.
        if (!this.dropOn && this.low > 27) this.dropOn = true;
        else if (this.dropOn && this.low < 19) this.dropOn = false;
        var target = follow && this.dropOn ? 1 : 0;
        this.auto += (target - this.auto) * k(target > this.auto ? 0.45 : 0.7);
        return this;
      },
      // Beats since the last kick (large if none yet).
      sinceKick: function (t) { return (t - this.lastKick) * this.bpm / 60; }
    };
  }

  // Blend params toward a scene's drop preset by the follower.
  function drive(params, drop, keys, auto) {
    var P = {};
    for (var k in params) P[k] = params[k];
    keys.forEach(function (key) { if (key in drop) P[key] = params[key] + (drop[key] - params[key]) * auto; });
    return P;
  }

  // For scene files: make sure the kit and GSAP are in. The app's index.html
  // loads both with <script> tags; the render harness only loads the scene,
  // so there the scene injects the kit and holds p5's preload until GSAP is in.
  window.VIZ_GSAP = {
    version: VER,
    load: load,
    get ready() { return ok; },
    svgRoot: svgRoot, path: path, applyDash: applyDash,
    smoothD: smoothD, polyD: polyD,
    createClock: createClock, drive: drive, clamp: clamp
  };
})();
