// gpu-kit: what the WebGPU compute scenes (scenes/gpu1.js … gpu5.js) share.
//
// This file is an ES module, fetched by the scenes with import() the first
// time one is preloaded, so the classic-script page never waits on it and
// never parses the 1 MB three.js WebGPU build unless a GPU scene is used.
//
//   three.js 0.186.1, the same pin as the WebGL scenes (rendered.js,
//   three-kit.js), but its /webgpu build: jsDelivr's `three@0.186.1/webgpu/+esm`
//   is one self-contained bundle (core + WebGPURenderer + TSL, which it
//   exports as THREE.TSL), so there is no version-skew trap to manage here.
//   It is a different module from the WebGL build's `three@0.186.1/+esm`; the
//   two never share objects, only the version number.
//
// Coexisting with the rest of viz:
//   - One WebGPURenderer (one GPUDevice) for all five scenes, created the
//     first time one of them draws. Each scene keeps its own buffers and
//     pipelines alive across switches, so coming back is instant.
//   - The renderer draws into its own offscreen canvas. After every frame
//     the scene drawImage()s it into the p5 canvas, inside the same task as
//     the submit (a WebGPU canvas's texture is only readable until the task
//     ends), exactly as the WebGL scenes composite. So the effects rack, the
//     Finish and the render harness see it like any other scene.
//   - Without WebGPU (Firefox before 141, older Safari, the harness's software
//     GL) the scene draws a quiet message on its own ground instead of
//     throwing, and every other scene is untouched. three.js would otherwise
//     silently fall back to WebGL2, where storage-buffer atomics do not exist.

const THREE_VERSION = '0.186.1';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@' + THREE_VERSION + '/webgpu/+esm';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const clamp01 = (x) => clamp(x, 0, 1);
const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

let threePromise = null;
let THREE = null;
let renderer = null;
let rendererPromise = null;
let noGPU = null;       // a sentence for the performer when WebGPU is missing

function loadThree() {
  if (!threePromise) {
    threePromise = import(THREE_URL).then((m) => { THREE = m; return m; }, (e) => {
      noGPU = 'three.js did not load (see the console)';
      console.error('gpu-kit: three.js did not load', e);
    });
  }
  return threePromise;
}

function getRenderer() {
  if (rendererPromise) return rendererPromise;
  rendererPromise = (async () => {
    await loadThree();
    if (!THREE) return null;
    if (!navigator.gpu) { noGPU = 'This scene needs WebGPU: open viz in Chrome, Edge or Safari 26.'; return null; }
    let adapter = null;
    try { adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); } catch (e) { /* below */ }
    if (!adapter) { noGPU = 'This scene needs WebGPU, which is switched off or blocked in this browser.'; return null; }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const r = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    try {
      await r.init();
    } catch (e) {
      console.error('gpu-kit: WebGPU init failed', e);
      noGPU = 'This scene needs WebGPU, which did not start (see the console).';
      return null;
    }
    if (!r.backend || !r.backend.isWebGPUBackend) { noGPU = 'This scene needs WebGPU compute; this browser only offers WebGL.'; return null; }
    r.setPixelRatio(1);
    renderer = r;
    return r;
  })();
  return rendererPromise;
}

// ------------------------------------------------------------------ ears
// The music as events and envelopes, after rendered.js's listener: a kick
// detector on bass minus low-mid, a snare/clap detector on band 4 against its
// own running floor, hats on band 8, a slow bass swell, and the drop as a
// hysteresis on a slow follower of band 1.
export class Ears {
  constructor() {
    this.kick = 0; this.snare = 0; this.hat = 0;       // 1 on the frame of an onset, else 0
    this.kickAmp = 0; this.hatAmp = 0;
    this.kickEnv = 0; this.snareEnv = 0; this.hatEnv = 0; // decaying envelopes
    this.bass = 0; this.low = 0; this.high = 0; this.dropOn = false; this.auto = 0;
    this.kicks = 0; this.snares = 0; this.hats = 0;       // counters
    this._pk = 0; this._ps = 0; this._ph = 0; this._b4 = 0; this._b8 = 0;
    this._since = { k: 9, s: 9, h: 9 };
  }
  listen(s, dt, follow) {
    const since = this._since;
    since.k += dt; since.s += dt; since.h += dt;
    this.kick = this.snare = this.hat = 0;
    const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
    if (kRaw > 0.3 && kRaw - this._pk > 0.15 && since.k > 0.2) {
      since.k = 0; this.kick = 1; this.kickAmp = 0.6 + 0.4 * kRaw; this.kicks++; this.kickEnv = 1;
    }
    this._pk = kRaw;
    this._b4 = s[4] > this._b4 ? ease(this._b4, s[4], 1.2, dt) : ease(this._b4, s[4], 8, dt);
    const sRaw = clamp01((s[4] - this._b4 - 12) / 55);
    if (sRaw > 0.4 && sRaw - this._ps > 0.15 && since.s > 0.22) { since.s = 0; this.snare = 1; this.snares++; this.snareEnv = 1; }
    this._ps = sRaw;
    this._b8 = s[8] > this._b8 ? ease(this._b8, s[8], 1.5, dt) : ease(this._b8, s[8], 8, dt);
    const hRaw = clamp01((s[8] - this._b8 - 6) / 55);
    if (hRaw > 0.25 && hRaw - this._ph > 0.12 && since.h > 0.07) { since.h = 0; this.hat = 1; this.hatAmp = hRaw; this.hats++; this.hatEnv = Math.min(1.5, this.hatEnv + hRaw); }
    this._ph = hRaw;
    this.kickEnv *= Math.exp(-dt / 0.18);
    this.snareEnv *= Math.exp(-dt / 0.25);
    this.hatEnv *= Math.exp(-dt / 0.09);
    this.bass = ease(this.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
    this.high = ease(this.high, clamp01((s[6] + s[7] + s[8]) / 240), 3, dt);
    this.low = ease(this.low, s[1], 1.2, dt);
    if (!this.dropOn && this.low > 27) this.dropOn = true;
    else if (this.dropOn && this.low < 19) this.dropOn = false;
    this.auto = ease(this.auto, follow && this.dropOn ? 1 : 0, this.dropOn ? 1.2 : 0.45, dt);
  }
}

// The performer's params with Follow the track folded in: every key in
// `drive` slides from where the performer left it to the drop preset.
export function mixParams(params, drop, drive, auto) {
  const P = Object.assign({}, params);
  for (const k of drive) if (k in drop) P[k] = params[k] + (drop[k] - params[k]) * auto;
  return P;
}

// ------------------------------------------------------------------ host
// A scene file hands its def and a spec to these three calls:
//   spec.build(env) -> sim      once, on the first frame WebGPU is ready;
//                               env = { THREE, TSL, renderer, aspect, w, h }
//   sim.frame(f)                every frame: f = { dt, t, ears, P, w, h, frame }
//                               computes and renders into the renderer canvas
//   sim.resize(w, h)            optional; the sim is rebuilt instead if the
//                               aspect changes (its domain has that shape)
//   spec.ground  '#rrggbb'      what the stage shows while loading
//   spec.scale   0..1           render resolution relative to the device
//                               pixels (default 1)
//   spec.drive, spec.drop       keys Follow moves, and where it moves them
// Called from the scene's preload once this module is in. In the app it only
// starts fetching three.js (the page must never wait on a scene the
// performer may not pick); under the harness the scene holds p5's preload
// until this resolves, so the WebGPU device is up before frame 1.
export function warm(hold) {
  return hold ? getRenderer() : loadThree();
}

export function enter(def) {
  def._gpu = def._gpu || {};
  const g = def._gpu;
  g.ears = new Ears();
  g.lastMs = null;
  g.t = 0;
  g.frame = 0;
  if (g.sim && g.sim.enter) g.sim.enter();
}

export function leave(def) {
  const g = def._gpu;
  if (g && g.sim && g.sim.leave) g.sim.leave();
}

export function draw(def, spec, p, signals, params, ctx) {
  if (!def._gpu || !def._gpu.ears) enter(def);
  const g = def._gpu;
  const ms = p.millis();
  const dt = g.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - g.lastMs) / 1000));
  g.lastMs = ms;
  const follow = Math.round(params.follow) === 1;
  g.ears.listen(signals, dt, follow);
  g.t += dt;

  if (g.failed) { status(p, ctx, spec.ground || '#000000', g.failed); return; }
  if (!renderer) {
    getRenderer();
    status(p, ctx, spec.ground || '#000000', noGPU);
    return;
  }

  const dw = Math.round(p.width * p.pixelDensity());
  const dh = Math.round(p.height * p.pixelDensity());
  const sc = spec.scale || 1;
  const w = Math.max(2, Math.round(dw * sc));
  const h = Math.max(2, Math.round(dh * sc));
  const aspect = w / h;
  if (g.sim && Math.abs(g.sim.aspect - aspect) / aspect > 0.01) {
    if (g.sim.dispose) g.sim.dispose();
    g.sim = null;
  }
  if (!g.sim) {
    try {
      g.sim = spec.build({ THREE, TSL: THREE.TSL, renderer, aspect, w, h });
      g.sim.aspect = aspect;
    } catch (e) {
      console.error('gpu-kit: ' + def.id + ' failed to build', e);
      g.failed = 'This scene failed to build (see the console).';
      status(p, ctx, spec.ground || '#000000', g.failed);
      return;
    }
  }
  const cv = renderer.domElement;
  if (cv.width !== w || cv.height !== h) {
    renderer.setSize(w, h, false);
    if (g.sim.resize) g.sim.resize(w, h);
  }
  const P = mixParams(params, spec.drop || {}, spec.drive || [], follow ? g.ears.auto : 0);
  g.frame++;
  g.sim.frame({ dt, t: g.t, ears: g.ears, P, w, h, frame: g.frame, renderer });
  p.drawingContext.drawImage(cv, 0, 0, ctx.width, ctx.height);
}

function status(p, ctx, ground, msg) {
  p.background(ground);
  if (!msg) return;
  p.push();
  p.colorMode(p.RGB, 255);
  p.noStroke();
  const c = p.color(ground);
  const lum = 0.3 * p.red(c) + 0.59 * p.green(c) + 0.11 * p.blue(c);
  p.fill(lum > 128 ? 40 : 215, 170);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(15);
  p.text(msg, ctx.width / 2, ctx.height / 2);
  p.pop();
}

export { THREE_VERSION };
