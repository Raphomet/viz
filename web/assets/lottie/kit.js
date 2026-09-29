// Lottie kit for the lottie1…lottie5 scenes: authoring helpers that write
// Bodymovin JSON (used by the gen-*.mjs generators under Node and, for the
// type scene, in the browser), and a player that renders lottie-web's canvas
// renderer into an offscreen canvas the scene composites onto the p5 stage.
//
// Why the player does not "play": lottie-web normally owns time (play(),
// setSpeed(), a requestAnimationFrame loop). Here the music owns it. Every
// animated part of a composition sits in a precomp whose time remap (`tm`) is
// bound to a clock the scene advances from the beat, and any other property
// can be bound the same way. Binding uses lottie-web's own per-property effect
// chain (property.addEffect, the hook its expression engine uses), so the
// JSON's keyframes are still evaluated and the scene's function receives the
// keyframed value and returns what to show. A property is bound by tagging it
// in the JSON with `vz: "<name>"`; the player finds every tagged property
// once, after the animation is built.
//
// Tagged properties are always written as keyframed (two identical keys) so
// lottie-web treats them as animated from the start: a static property is
// evaluated once at build and some of its consumers cache the result.
//
// Rendering is deterministic: autoplay is off, nothing is scheduled, and each
// frame is drawn with renderer.renderFrame(frame, true) from the scene's draw.
(function (root) {
  'use strict';
  const L = root.VIZ_LOTTIE = root.VIZ_LOTTIE || {};
  // One pinned lottie-web: the light canvas build (canvas renderer, no
  // expressions, so no eval under the Artifact's CSP).
  L.LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.13.0/lottie_light_canvas.min.js';

  // ------------------------------------------------------------ authoring
  const isProp = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'k' in v && 'a' in v;
  const S = (v) => (isProp(v) ? v : { a: 0, k: v });
  const EASE = {
    lin: [0, 0, 1, 1],
    io: [0.33, 0, 0.67, 1],
    out: [0.16, 1, 0.3, 1],
    in: [0.7, 0, 0.84, 0],
    soft: [0.45, 0, 0.2, 1],
    back: [0.34, 1.56, 0.64, 1],
    snap: [0.5, 0, 0.1, 1],
  };
  // keys: [[frame, value, ease?], ...]; the ease belongs to the segment that
  // starts at that key ('hold' for a step). Values may be numbers or arrays.
  function A(keys) {
    const k = keys.map(([t, v, e], n) => {
      const key = { t, s: Array.isArray(v) || (v && typeof v === 'object') ? v : [v] };
      if (n === keys.length - 1) return key;
      if (e === 'hold') { key.h = 1; return key; }
      const b = Array.isArray(e) ? e : EASE[e || 'io'];
      key.o = { x: b[0], y: b[1] };
      key.i = { x: b[2], y: b[3] };
      return key;
    });
    return { a: 1, k };
  }
  // A property the scene drives: keyframed (see header), tagged.
  function T(name, v) {
    const p = A([[0, v, 'lin'], [1, v]]);
    p.vz = name;
    return p;
  }
  function hex(h, a = 1) {
    const n = parseInt(h.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
  }
  const tr = (o = {}) => ({
    ty: 'tr', nm: 'Transform',
    p: S(o.p || [0, 0]), a: S(o.a || [0, 0]), s: S(o.s || [100, 100]),
    r: S(o.r || 0), o: S(o.o == null ? 100 : o.o), sk: S(0), sa: S(0),
  });
  const gr = (nm, items, t) => ({ ty: 'gr', nm, np: items.length, it: items.concat([tr(t)]) });
  const el = (s, p = [0, 0]) => ({ ty: 'el', d: 1, p: S(p), s: S(s) });
  const rc = (s, p = [0, 0], r = 0) => ({ ty: 'rc', d: 1, p: S(p), s: S(s), r: S(r) });
  const sr = (o) => ({                        // star (sy 1) or polygon (sy 2)
    ty: 'sr', d: 1, sy: o.sy || 1, pt: S(o.pt || 5), p: S(o.p || [0, 0]), r: S(o.r || 0),
    ir: S(o.ir || 20), is: S(o.is || 0), or: S(o.or || 50), os: S(o.os || 0),
  });
  const sh = (ks) => ({ ty: 'sh', d: 1, ks: isProp(ks) ? ks : S(ks) });
  const path = (v, i, o, c = true) => ({
    c, v, i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]),
  });
  const fl = (c, o = 100) => ({ ty: 'fl', c: Array.isArray(c) ? S(c) : c, o: S(o), r: 1, bm: 0 });
  const st = (c, w, o = 100, lc = 2, lj = 2) => ({
    ty: 'st', c: Array.isArray(c) ? S(c) : c, o: S(o), w: S(w), lc, lj, ml: 4, bm: 0,
  });
  const tm = (s, e, o = 0, m = 1) => ({ ty: 'tm', s: S(s), e: S(e), o: S(o), m });
  const rp = (c, o, t = {}) => ({
    ty: 'rp', c: S(c), o: S(o), m: t.m || 1,
    tr: {
      ty: 'tr', p: S(t.p || [0, 0]), a: S(t.a || [0, 0]), s: S(t.s || [100, 100]),
      r: S(t.r || 0), so: S(t.so == null ? 100 : t.so), eo: S(t.eo == null ? 100 : t.eo),
    },
  });
  const zz = (s, r, pt = 2) => ({ ty: 'zz', s: S(s), r: S(r), pt: S(pt) });
  const pb = (a) => ({ ty: 'pb', a: S(a) });
  const rd = (r) => ({ ty: 'rd', r: S(r) });
  const op = (a, lj = 2, ml = 4) => ({ ty: 'op', a: S(a), lj, ml: S(ml) });
  const ks = (o = {}) => ({
    o: S(o.o == null ? 100 : o.o), r: S(o.r || 0),
    p: S(o.p || [0, 0, 0]), a: S(o.a || [0, 0, 0]), s: S(o.s || [100, 100, 100]),
  });
  function layerBase(nm, ty, o) {
    const l = { ddd: 0, ty, nm, sr: 1, ks: o.ks || ks(o.t), ao: 0, ip: o.ip == null ? 0 : o.ip, op: o.op == null ? 1e6 : o.op, st: o.st || 0, bm: o.bm || 0 };
    if (o.td) l.td = 1;
    if (o.tt) l.tt = o.tt;
    if (o.parent) l.parent = o.parent;
    if (o.masks) { l.hasMask = true; l.masksProperties = o.masks; }
    if (o.hd) l.hd = true;
    return l;
  }
  const shapeLayer = (nm, shapes, o = {}) => Object.assign(layerBase(nm, 4, o), { shapes });
  const compLayer = (nm, refId, w, h, o = {}) => {
    const l = Object.assign(layerBase(nm, 0, o), { refId, w, h });
    if (o.tm) l.tm = o.tm;
    return l;
  };
  const nullLayer = (nm, o = {}) => layerBase(nm, 3, o);
  const mask = (pt, o = {}) => ({ inv: !!o.inv, mode: o.mode || 'a', pt: isProp(pt) ? pt : S(pt), o: S(o.o == null ? 100 : o.o), x: S(0), nm: o.nm || 'Mask' });
  function number(layers) { layers.forEach((l, n) => { l.ind = n + 1; }); return layers; }
  function comp(o) {
    return {
      v: '5.12.0', fr: o.fr || 60, ip: 0, op: o.op || 600, w: o.w, h: o.h, nm: o.nm || 'viz', ddd: 0,
      assets: (o.assets || []).map((a) => ({ id: a.id, nm: a.id, fr: o.fr || 60, layers: number(a.layers) })),
      layers: number(o.layers), markers: o.markers || [], meta: { g: 'viz lottie kit (generated)' },
    };
  }
  // A circle as a four-point bezier path (for morphs, which need matching
  // vertex counts, and masks, which need paths).
  function circlePath(r, cx = 0, cy = 0, n = 4) {
    const v = [], i = [], o = [];
    const k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * r;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 - Math.PI / 2;
      const c = Math.cos(a), s = Math.sin(a);
      v.push([cx + c * r, cy + s * r]);
      i.push([s * k, -c * k]);
      o.push([-s * k, c * k]);
    }
    return path(v, i, o, true);
  }
  // Closed smooth path through points (Catmull-Rom to bezier), for blobs.
  function smoothPath(pts, closed = true, tension = 1) {
    const n = pts.length, v = [], i = [], o = [];
    for (let j = 0; j < n; j++) {
      const p0 = pts[(j - 1 + n) % n], p1 = pts[j], p2 = pts[(j + 1) % n];
      const edge = !closed && (j === 0 || j === n - 1);
      const tx = edge ? 0 : (p2[0] - p0[0]) / 6 * tension, ty = edge ? 0 : (p2[1] - p0[1]) / 6 * tension;
      const r1 = (x) => Math.round(x * 10) / 10;
      v.push([r1(p1[0]), r1(p1[1])]);
      i.push([r1(-tx), r1(-ty)]);
      o.push([r1(tx), r1(ty)]);
    }
    return path(v, i, o, closed);
  }

  L.author = { S, A, T, EASE, hex, tr, gr, el, rc, sr, sh, path, fl, st, tm, rp, zz, pb, rd, op, ks,
    shapeLayer, compLayer, nullLayer, mask, comp, circlePath, smoothPath };

  if (typeof document === 'undefined') return;

  // ---------------------------------------------------------------- loading
  const scripts = {};
  function loadScript(url) {
    if (!scripts[url]) {
      scripts[url] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('could not load ' + url));
        document.head.appendChild(s);
      });
    }
    return scripts[url];
  }
  const json = {};
  L.fetchJSON = (url) => {
    if (!json[url]) json[url] = fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' HTTP ' + r.status); return r.json(); });
    return json[url];
  };
  L.ready = () => (root.lottie ? Promise.resolve(root.lottie) : loadScript(L.LIB_URL).then(() => {
    if (!root.lottie) throw new Error('lottie-web did not define window.lottie');
    return root.lottie;
  }));

  // --------------------------------------------------------------- binding
  // Walk the built element tree for properties whose JSON carries `vz`. The
  // skip list is the back-references (parent comp, global data, the JSON
  // itself, the canvas) that would otherwise take the walk everywhere.
  const SKIP = new Set(['globalData', 'comp', 'elem', 'container', 'animationItem', 'canvasContext',
    'contextData', 'transformCanvas', 'data', 'layers', '_caching', 'keyframes', 'keyframesMetadata',
    'buffers', 'baseElement', 'hierarchy', 'pendingElements', 'renderer', 'renderableEffectsManager',
    'shapesData', 'textProperty', 'effectsSequence', 'pMatrix', 'rMatrix', 'sMatrix', 'tMatrix', 'matrix',
    'localShapeCollection', 'paths', 'shape', 'pv', 'v', 'mat', 'props', 'finalTransform']);
  function findTagged(start) {
    const out = [];
    const seen = new Set();
    const stack = [start];
    let guard = 0;
    while (stack.length && guard++ < 400000) {
      const obj = stack.pop();
      if (!obj || typeof obj !== 'object' || seen.has(obj)) continue;
      if (ArrayBuffer.isView(obj) || obj instanceof HTMLCanvasElement || obj instanceof CanvasRenderingContext2D) continue;
      seen.add(obj);
      if (typeof obj.addEffect === 'function' && obj.data && typeof obj.data.vz === 'string') out.push(obj);
      if (Array.isArray(obj)) {
        if (obj.length && typeof obj[0] === 'number') continue;
        for (let n = 0; n < obj.length; n++) stack.push(obj[n]);
      } else {
        for (const key in obj) {
          if (SKIP.has(key)) continue;
          const v = obj[key];
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    }
    return out;
  }
  // finalTransform (skipped above: it is mostly matrices) holds each layer's
  // own transform properties in mProp, so those are collected separately.
  function findLayerTransforms(anim, out) {
    const visit = (els) => {
      for (const e of els || []) {
        if (!e) continue;
        const m = e.finalTransform && e.finalTransform.mProp;
        if (m) for (const k of ['o', 'r', 'p', 'a', 's', 'px', 'py', 'rz']) {
          const pr = m[k];
          if (pr && pr.addEffect && pr.data && typeof pr.data.vz === 'string' && out.indexOf(pr) < 0) out.push(pr);
        }
        if (e.elements) visit(e.elements);
      }
    };
    visit(anim.renderer.elements);
    return out;
  }

  function bakeTags(obj, bake) {
    const stack = [obj];
    while (stack.length) {
      const o = stack.pop();
      if (Array.isArray(o)) { for (const x of o) if (x && typeof x === 'object') stack.push(x); continue; }
      for (const key in o) {
        const v = o[key];
        if (!v || typeof v !== 'object') continue;
        if (typeof v.vz === 'string' && 'k' in v) {
          const b = bake(v.vz);
          if (b !== undefined) { o[key] = { a: 0, k: b }; continue; }
        }
        stack.push(v);
      }
    }
  }

  // The name of the precomp layer a property's element lives in (the layer
  // `nm` in the parent comp), so one tag inside a shared asset can be told
  // apart per instance.
  L.instanceOf = (prop) => {
    const el = prop.elem;
    const c = el && el.comp;
    return c && c.data ? c.data.nm : '';
  };

  // ----------------------------------------------------------------- player
  class Player {
    // data: the Bodymovin JSON (cloned per build, since lottie-web writes to
    // it). bind(tag, prop) returns a function value -> value, or null.
    constructor(data, opts = {}) {
      this.src = data;
      this.fit = opts.fit || 'xMidYMid slice';
      this.bind = opts.bind || null;
      // bake(tag) returns a value to write into the JSON as a static
      // property before the build, or undefined to leave the tag to bind().
      // Anything inside a repeater is cloned per copy by lottie-web (props
      // and all), so inks and other slow-changing values are baked, and a
      // change to them is a rebuild (rebake()) rather than thousands of
      // bound effects.
      this.bake = opts.bake || null;
      this.canvas = document.createElement('canvas');
      this.canvas.width = 2; this.canvas.height = 2;
      this.anim = null;
      this.bound = 0;
      this.scale = opts.scale || 1;      // render resolution relative to device pixels
    }
    setData(data) { this.src = data; this.destroy(); }
    rebake() { this.destroy(); }
    destroy() { if (this.anim) { try { this.anim.destroy(); } catch (e) { /* already gone */ } } this.anim = null; }
    build(w, h) {
      this.destroy();
      if (!root.lottie) return false;
      this.canvas.width = w; this.canvas.height = h;
      const data = JSON.parse(JSON.stringify(this.src));
      if (this.bake) bakeTags(data, this.bake);
      this.anim = root.lottie.loadAnimation({
        renderer: 'canvas', loop: false, autoplay: false, animationData: data,
        rendererSettings: { context: this.canvas.getContext('2d'), clearCanvas: true, preserveAspectRatio: this.fit },
      });
      // Canvas buffers for track mattes are sized when layers are built, so a
      // new stage size means a new build rather than a resize.
      this.anim.resize(w, h);
      const props = findLayerTransforms(this.anim, findTagged(this.anim.renderer.elements));
      this.bound = 0;
      this.tagged = 0;
      this.attach(props);
      // A repeater makes its copies the first time it is evaluated (and again
      // if its copy count grows) by cloning its items, properties and all, and
      // asking the shape layer to reload. The clones carry the tags; bind them
      // as they appear.
      const self = this;
      const wrap = (els) => {
        for (const e of els || []) {
          if (!e) continue;
          if (typeof e.reloadShapes === 'function' && !e.reloadShapes.__vz) {
            const orig = e.reloadShapes;
            e.reloadShapes = function () {
              orig.apply(this, arguments);
              self.attach(findTagged([this.itemsData, this.shapeModifiers]));
            };
            e.reloadShapes.__vz = true;
          }
          if (e.elements) wrap(e.elements);
        }
      };
      wrap(this.anim.renderer.elements);
      return true;
    }
    attach(props) {
      for (const pr of props) {
        if (pr.__vz) continue;
        pr.__vz = true;
        this.tagged++;
        const fn = this.bind && this.bind(pr.data.vz, pr);
        if (fn) { pr.addEffect(fn); this.bound++; }
      }
    }
    // Render the root composition at `frame` into the offscreen canvas, sized
    // to the p5 canvas in device pixels.
    render(p, frame) {
      const pd = p.pixelDensity ? p.pixelDensity() : 1;
      const w = Math.max(2, Math.round(p.width * pd * this.scale));
      const h = Math.max(2, Math.round(p.height * pd * this.scale));
      if (!this.anim || this.canvas.width !== w || this.canvas.height !== h) {
        if (!this.build(w, h)) return false;
      }
      this.anim.renderer.renderFrame(frame, true);
      return true;
    }
    draw(p, ctx, alpha = 1) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = alpha;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(this.canvas, 0, 0, ctx.width, ctx.height);
      g.restore();
    }
  }
  L.Player = Player;

  // ------------------------------------------------------------------ music
  // One listener per scene: onsets (kick, snare, hat), smoothed levels, a drop
  // detector and a beat phase that locks to the kicks. Thresholds are the
  // ones the batch-06 scenes settled on against harness/track.js.
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  L.clamp = clamp; L.ease = ease;
  L.smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
  L.listener = () => ({
    prev: new Float32Array(9), lastT: null, t: 0, dt: 1 / 60,
    kick: false, snare: false, hat: false,
    lastKick: -10, lastSnare: -10, lastHat: -10, kicks: 0, snares: 0, hats: 0,
    bass: 0, low: 0, pad: 0, hatLvl: 0, energy: 0,
    drop: false, auto: 0, drops: 0,
    period: 60 / 124, phase: 0, phaseErr: 0,
    update(s, t) {
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t; this.t = t; this.dt = dt;
      const pr = this.prev;
      this.kick = false; this.snare = false; this.hat = false;
      if (s[0] > 45 && s[0] - pr[0] > 14 && t - this.lastKick > 0.22) {
        const iv = t - this.lastKick;
        if (iv > 0.3 && iv < 0.9) this.period += (iv - this.period) * 0.3;
        this.lastKick = t; this.kick = true; this.kicks++;
        this.phaseErr = Math.round(this.phase) - this.phase;
      }
      if (s[4] > 40 && s[4] - pr[4] > 16 && t - this.lastSnare > 0.26) { this.lastSnare = t; this.snare = true; this.snares++; }
      if (s[8] - pr[8] > 8 && s[8] > 18 && t - this.lastHat > 0.07) { this.lastHat = t; this.hat = true; this.hats++; }
      pr.set(s);
      const hatNow = (s[6] + s[7] + s[8]) / 300;
      this.hatLvl = ease(this.hatLvl, hatNow, hatNow > this.hatLvl ? 25 : 5, dt);
      this.bass = ease(this.bass, Math.max(s[0], s[1]) / 100, 1.6, dt);
      this.pad = ease(this.pad, (s[2] + s[3] + s[4]) / 300, 1.2, dt);
      this.low = ease(this.low, s[1], 1.1, dt);
      this.energy = ease(this.energy, (s[0] + s[1] + s[2] + s[5] + s[7]) / 500, 0.8, dt);
      if (!this.drop && (this.low > 27 || (s[0] > 90 && s[1] > 90))) { this.drop = true; this.drops++; }
      else if (this.drop && this.low < 19) this.drop = false;
      this.auto = ease(this.auto, this.drop ? 1 : 0, this.drop ? 3 : 1.0, dt);
      this.phase += dt / this.period;
      const corr = this.phaseErr * (1 - Math.exp(-8 * dt));
      this.phase += corr; this.phaseErr -= corr;
      return this;
    },
    since(which) { return this.t - (which === 'kick' ? this.lastKick : which === 'snare' ? this.lastSnare : this.lastHat); },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
