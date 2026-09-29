// Pose kit: the shared body-as-data layer for the MediaPipe scenes
// (scenes/pose1.js ... pose5.js). Everything a pose scene knows about the
// dancer comes through window.VIZ_POSE, from one of three sources:
//
//   film    the bundled dance (assets/pose/little-tich-1900.mp4), played from
//           the landmarks and masks baked offline by harness/pose/bake.mjs.
//           The default everywhere, and the only source the render harness
//           uses: video decode and inference are asynchronous, the harness
//           steps frames synchronously and needs byte-identical frames.
//   live    MediaPipe tasks-vision running in the page on a video: the
//           bundled film itself (to show the live path inside the Artifact,
//           which refuses the camera), a video file the performer opens or
//           drops on the stage, or the camera when the folder is served
//           locally. The library loads from jsDelivr at a pinned version;
//           the models are bundled beside the page, because their default
//           host (storage.googleapis.com) is outside the Artifact's CSP.
//
// Coordinates: a pose is 33 landmarks (MediaPipe's BlazePose topology) as
// Float32Array(99) of [X, Y, visibility], X and Y in units of the picture
// height (X runs 0..aspect), and 33 world landmarks as Float32Array(99) of
// [x, y, z] in metres, hip-centred, y down (MediaPipe's own axes). Masks are
// Uint8Array(MW * MH), 0..255 person coverage over the whole picture.
//
// Time: the film has its own playhead, advanced by the scene with tick(dt,
// rate), so a scene can let the music speed the dance up or slow it down.
// pose(age) and mask(age) look back `age` seconds of playhead (film) or of
// wall time (live), so trails and echoes work the same on either source.
// The film loops by cross-fading its last half second into its first.

(function () {
  'use strict';
  if (window.VIZ_POSE) return;

  const TV_VER = '1.0.1';
  const TV = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + TV_VER;
  const BASE = 'assets/pose/';
  const TRACK = BASE + 'little-tich.pose.json';
  const FILM = BASE + 'little-tich-1900.mp4';
  const POSE_MODEL = BASE + 'models/pose_landmarker_lite.task';
  const SEG_MODEL = BASE + 'models/selfie_segmenter.tflite';
  const SEAM = 0.5;          // seconds of cross-fade where the film loops
  const HISTORY = 8;         // seconds of live poses kept for trails and echoes

  // BlazePose topology, the pairs every scene draws from.
  const I = {
    nose: 0, lEye: 2, rEye: 5, lEar: 7, rEar: 8, mouthL: 9, mouthR: 10,
    lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
    lPinky: 17, rPinky: 18, lIndex: 19, rIndex: 20, lThumb: 21, rThumb: 22,
    lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
    lHeel: 29, rHeel: 30, lToe: 31, rToe: 32,
  };
  // Limbs as chains, root outwards, so a style can draw one stroke per limb.
  const LIMBS = [
    [11, 13, 15, 19], [12, 14, 16, 20],   // arms, ending at the index finger
    [23, 25, 27, 31], [24, 26, 28, 32],   // legs, ending at the toe
  ];
  const EDGES = [
    [11, 12], [11, 23], [12, 24], [23, 24],
    [11, 13], [13, 15], [15, 19], [12, 14], [14, 16], [16, 20],
    [23, 25], [25, 27], [27, 31], [27, 29], [29, 31], [24, 26], [26, 28], [28, 32], [28, 30], [30, 32],
  ];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  const K = {
    I, LIMBS, EDGES,
    ready: false,
    error: null,
    source: 'film',          // 'film' | 'live'
    liveKind: null,          // 'film' | 'file' | 'camera'
    aspect: 4 / 3,
    MW: 160, MH: 120,
    playhead: 0,
    duration: 1,
    stats: { inferMs: 0, detectFps: 0, frames: 0 },
  };

  // ------------------------------------------------------------ the film
  let film = null;           // { N, fps, lm, world, masks }
  let loading = null;

  function b64i16(s) {
    const b = atob(s), u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new Int16Array(u.buffer);
  }

  K.load = function () {
    if (loading) return loading;
    loading = fetch(TRACK).then((r) => {
      if (!r.ok) throw new Error('pose track HTTP ' + r.status);
      return r.json();
    }).then((J) => {
      const N = J.frames, aspect = J.width / J.height;
      const L = b64i16(J.landmarks), W = b64i16(J.world);
      const lm = new Float32Array(N * 99), world = new Float32Array(N * 99);
      for (let i = 0; i < N * 33; i++) {
        lm[i * 3] = L[i * 3] / J.landmarkScale * aspect;
        lm[i * 3 + 1] = L[i * 3 + 1] / J.landmarkScale;
        lm[i * 3 + 2] = L[i * 3 + 2] / J.landmarkScale;
        world[i * 3] = W[i * 3] / J.worldScale;
        world[i * 3 + 1] = W[i * 3 + 1] / J.worldScale;
        world[i * 3 + 2] = W[i * 3 + 2] / J.worldScale;
      }
      const M = J.masks;
      return new Promise((ok, no) => {
        const img = new Image();
        img.onload = () => ok({ J, N, aspect, lm, world, M, img });
        img.onerror = () => no(new Error('pose masks did not load'));
        img.src = BASE + M.file;
      });
    }).then(({ J, N, aspect, lm, world, M, img }) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const size = M.width * M.height;
      const masks = new Uint8Array(N * size);
      const sums = new Float64Array(N);
      for (let f = 0; f < N; f++) {
        const tile = Math.floor(f / M.perTile), ch = f % M.perTile;
        const tx = (tile % M.cols) * M.width, ty = Math.floor(tile / M.cols) * M.height;
        let s = 0;
        for (let y = 0; y < M.height; y++) {
          let src = ((ty + y) * c.width + tx) * 4 + ch, dst = f * size + y * M.width;
          for (let x = 0; x < M.width; x++, src += 4, dst++) { masks[dst] = px[src]; s += px[src]; }
        }
        sums[f] = s;
      }
      // A frame the segmenter missed borrows its neighbour's mask, so the
      // silhouette never blinks out for a frame.
      for (let f = 0; f < N; f++) if (sums[f] < 255 * 20) {
        let d = 1, src = -1;
        while (src < 0 && d < N) { if (f + d < N && sums[f + d] >= 255 * 20) src = f + d; else if (f - d >= 0 && sums[f - d] >= 255 * 20) src = f - d; d++; }
        if (src >= 0) masks.copyWithin(f * size, src * size, src * size + size);
      }
      film = { N, fps: J.fps, lm, world, masks };
      K.aspect = aspect; K.MW = M.width; K.MH = M.height;
      K.duration = N / J.fps;
      K.ready = true;
      return K;
    }).catch((e) => { K.error = e; console.error('pose: the baked track did not load', e); throw e; });
    return loading;
  };

  // Film pose at playhead time t (seconds), with the loop's cross-fade.
  const tmpA = { lm: new Float32Array(99), world: new Float32Array(99) };
  function rawFilm(t, out) {
    const f = clamp(t * film.fps, 0, film.N - 1.001);
    const i = Math.floor(f), u = f - i, a = i * 99, b = Math.min(film.N - 1, i + 1) * 99;
    for (let k = 0; k < 99; k++) {
      out.lm[k] = film.lm[a + k] + (film.lm[b + k] - film.lm[a + k]) * u;
      out.world[k] = film.world[a + k] + (film.world[b + k] - film.world[a + k]) * u;
    }
    return out;
  }
  function filmPose(t, out) {
    const P = K.duration - SEAM;
    const u = ((t % P) + P) % P;
    rawFilm(u, out);
    if (u < SEAM) {
      const w = u / SEAM, s = w * w * (3 - 2 * w);
      rawFilm(u + P, tmpA);
      for (let k = 0; k < 99; k++) {
        out.lm[k] = tmpA.lm[k] + (out.lm[k] - tmpA.lm[k]) * s;
        out.world[k] = tmpA.world[k] + (out.world[k] - tmpA.world[k]) * s;
      }
    }
    return out;
  }
  function filmMask(t, out) {
    const P = K.duration - SEAM, size = K.MW * K.MH;
    const u = ((t % P) + P) % P;
    const f = clamp(Math.round(u * film.fps), 0, film.N - 1);
    if (u >= SEAM) { out.set(film.masks.subarray(f * size, f * size + size)); return out; }
    const w = u / SEAM, g = clamp(Math.round((u + P) * film.fps), 0, film.N - 1);
    const A = film.masks, ao = g * size, bo = f * size;
    for (let k = 0; k < size; k++) out[k] = A[ao + k] + (A[bo + k] - A[ao + k]) * w;
    return out;
  }

  // ------------------------------------------------------------ live
  let lib = null, libP = null, landmarker = null, segmenter = null, video = null, stream = null;
  const hist = [];           // { t, lm, world, mask }
  let lastVideoT = -1, lastDetect = 0, liveToken = 0, newFrame = false;
  // Inference runs once per decoded video frame, not once per display frame:
  // the film is 30 fps, and running it at 60 doubled the cost for nothing
  // (Confetti fell to 35 fps live, 2026-09-29).
  function watchFrames(v) {
    if (!v.requestVideoFrameCallback) { newFrame = true; return; }
    const cb = () => { newFrame = true; if (v.srcObject || v.src) v.requestVideoFrameCallback(cb); };
    v.requestVideoFrameCallback(cb);
  }

  function loadLib() {
    if (libP) return libP;
    libP = import(TV + '/vision_bundle.mjs').then(async (m) => {
      const fileset = await m.FilesetResolver.forVisionTasks(TV + '/wasm');
      lib = { m, fileset };
      return lib;
    });
    libP.catch((e) => { libP = null; });
    return libP;
  }
  async function makeLandmarker(masks) {
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: masks,
      minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4, minTrackingConfidence: 0.4,
    });
    try { return await lib.m.PoseLandmarker.createFromOptions(lib.fileset, opts('GPU')); }
    catch (e) { return lib.m.PoseLandmarker.createFromOptions(lib.fileset, opts('CPU')); }
  }
  async function makeSegmenter() {
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: SEG_MODEL, delegate }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
    try { return await lib.m.ImageSegmenter.createFromOptions(lib.fileset, opts('GPU')); }
    catch (e) { return lib.m.ImageSegmenter.createFromOptions(lib.fileset, opts('CPU')); }
  }

  function stopStream() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (video) { video.pause(); if (video.src && video.src.startsWith('blob:')) URL.revokeObjectURL(video.src); video.removeAttribute('src'); video.srcObject = null; video.load(); }
  }

  // kind: 'film' (the bundled clip, inferred live), 'file' (a File), 'camera'.
  K.startLive = async function (kind, file) {
    const token = ++liveToken;
    toast(kind === 'camera' ? 'Starting the camera…' : 'Loading MediaPipe…');
    try {
      await loadLib();
      if (!landmarker) landmarker = await makeLandmarker(true);
      if (kind === 'camera' && !segmenter) segmenter = await makeSegmenter();
      if (token !== liveToken) return;
      stopStream();
      if (!video) { video = document.createElement('video'); video.muted = true; video.playsInline = true; video.loop = true; }
      if (kind === 'camera') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser offers no camera here.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        video.srcObject = stream;
      } else {
        video.srcObject = null;
        video.src = kind === 'file' ? URL.createObjectURL(file) : FILM;
      }
      await video.play();
      if (token !== liveToken) return;
      watchFrames(video);
      K.aspect = video.videoWidth / video.videoHeight || 4 / 3;
      K.MW = 160; K.MH = Math.max(60, Math.round(160 / K.aspect));
      hist.length = 0; lastVideoT = -1;
      K.source = 'live'; K.liveKind = kind;
      K.stats.frames = 0;
      toast(kind === 'camera' ? 'Camera: live pose' : kind === 'file' ? 'Video: live pose' : 'Film: live pose (MediaPipe in the page)');
    } catch (e) {
      if (token !== liveToken) return;
      console.warn('pose: live source failed', e);
      K.stopLive();
      const refused = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      toast(kind === 'camera' && refused ? 'The camera is refused here (the Artifact frame blocks it). Playing the film.' : 'Live pose failed: ' + (e && e.message || e) + '. Playing the film.');
    }
  };
  K.stopLive = function () {
    liveToken++;
    stopStream();
    K.source = 'film'; K.liveKind = null;
    if (film) { K.aspect = film ? K.aspect : 4 / 3; }
    if (K.ready) { K.MW = 160; K.MH = 120; K.aspect = 4 / 3; }
    hist.length = 0;
  };

  function liveStep() {
    if (!video || video.readyState < 2 || !landmarker) return;
    const vt = video.currentTime;
    if (video.requestVideoFrameCallback ? !newFrame : vt === lastVideoT) return;
    newFrame = false;
    lastVideoT = vt;
    const now = performance.now();
    const t0 = now;
    let r;
    try { r = landmarker.detectForVideo(video, now); } catch (e) { return; }
    const mirror = K.liveKind === 'camera';
    const MW = K.MW, MH = K.MH, aspect = K.aspect;
    const prev = hist.length ? hist[hist.length - 1] : null;
    const s = { t: now / 1000, lm: new Float32Array(99), world: new Float32Array(99), mask: new Uint8Array(MW * MH), found: false };
    if (r.landmarks && r.landmarks[0]) {
      s.found = true;
      r.landmarks[0].forEach((q, j) => {
        s.lm[j * 3] = (mirror ? 1 - q.x : q.x) * aspect; s.lm[j * 3 + 1] = q.y; s.lm[j * 3 + 2] = q.visibility == null ? 1 : q.visibility;
      });
      r.worldLandmarks[0].forEach((q, j) => { s.world[j * 3] = mirror ? -q.x : q.x; s.world[j * 3 + 1] = q.y; s.world[j * 3 + 2] = q.z; });
      // Live detections jitter frame to frame; a light exponential pull
      // towards the last pose takes the shiver out without much lag.
      if (prev && prev.found) for (let k = 0; k < 99; k++) {
        s.lm[k] = prev.lm[k] + (s.lm[k] - prev.lm[k]) * 0.6;
        s.world[k] = prev.world[k] + (s.world[k] - prev.world[k]) * 0.6;
      }
    } else if (prev) { s.lm.set(prev.lm); s.world.set(prev.world); for (let j = 0; j < 33; j++) s.lm[j * 3 + 2] *= 0.8; }
    let mk = null;
    if (segmenter) {
      try { const sr = segmenter.segmentForVideo(video, now + 0.5); mk = sr.confidenceMasks && sr.confidenceMasks[0]; downsample(mk, s.mask, MW, MH, mirror); if (sr.close) sr.close(); } catch (e) { /* keep the pose */ }
    } else if (r.segmentationMasks && r.segmentationMasks[0]) {
      downsample(r.segmentationMasks[0], s.mask, MW, MH, mirror);
    }
    if (r.close) r.close();
    const ms = performance.now() - t0;
    K.stats.inferMs = K.stats.inferMs ? K.stats.inferMs * 0.9 + ms * 0.1 : ms;
    if (lastDetect) { const f = 1000 / Math.max(1, now - lastDetect); K.stats.detectFps = K.stats.detectFps ? K.stats.detectFps * 0.9 + f * 0.1 : f; }
    lastDetect = now;
    K.stats.frames++;
    hist.push(s);
    while (hist.length > 2 && hist[0].t < s.t - HISTORY) hist.shift();
  }
  function downsample(mk, out, MW, MH, mirror) {
    if (!mk) return;
    const src = mk.getAsFloat32Array(), sw = mk.width, sh = mk.height;
    for (let y = 0; y < MH; y++) {
      const sy = Math.min(sh - 1, Math.floor((y + 0.5) * sh / MH));
      for (let x = 0; x < MW; x++) {
        const sx = Math.min(sw - 1, Math.floor((x + 0.5) * sw / MW));
        out[y * MW + (mirror ? MW - 1 - x : x)] = Math.round(255 * clamp(src[sy * sw + sx], 0, 1));
      }
    }
  }
  function liveAt(age) {
    if (!hist.length) return null;
    const t = hist[hist.length - 1].t - age;
    let i = hist.length - 1;
    while (i > 0 && hist[i - 1].t > t) i--;
    if (i === 0 || hist[i].t <= t) return { a: hist[i], b: hist[i], u: 0 };
    const a = hist[i - 1], b = hist[i];
    return { a, b, u: clamp((t - a.t) / Math.max(1e-3, b.t - a.t), 0, 1) };
  }

  // ------------------------------------------------------------ the API
  // Advance the film playhead (dt seconds at `rate` x speed), or run live
  // inference on the newest video frame. Call once per frame, first.
  K.tick = function (dt, rate) {
    K.playhead += dt * (rate == null ? 1 : rate);
    if (K.source === 'live') liveStep();
  };

  // The pose `age` seconds ago. `out` is optional and reused if given.
  K.pose = function (age, out) {
    out = out || { lm: new Float32Array(99), world: new Float32Array(99) };
    age = age || 0;
    if (K.source === 'live') {
      const h = liveAt(age);
      if (h) {
        for (let k = 0; k < 99; k++) {
          out.lm[k] = h.a.lm[k] + (h.b.lm[k] - h.a.lm[k]) * h.u;
          out.world[k] = h.a.world[k] + (h.b.world[k] - h.a.world[k]) * h.u;
        }
        return out;
      }
      if (!film) return null;
    }
    if (!film) return null;
    return filmPose(K.playhead - age, out);
  };

  // The person mask `age` seconds ago, Uint8Array(MW * MH).
  K.mask = function (age, out) {
    const size = K.MW * K.MH;
    if (!out || out.length !== size) out = new Uint8Array(size);
    if (K.source === 'live') {
      const h = liveAt(age || 0);
      if (h && h.b.mask.length === size) { out.set(h.u < 0.5 ? h.a.mask : h.b.mask); return out; }
    }
    if (!film || size !== 160 * 120) return out.fill(0);
    return filmMask(K.playhead - (age || 0), out);
  };

  // A mask as a small canvas: `rgb` where the person is, alpha = coverage.
  // Drawn scaled up with smoothing it gives a soft-edged silhouette.
  K.maskCanvas = function (mask, rgb, cache) {
    const MW = K.MW, MH = K.MH;
    let c = cache && cache.canvas;
    if (!c || c.width !== MW || c.height !== MH) {
      c = document.createElement('canvas'); c.width = MW; c.height = MH;
      cache = { canvas: c, g: c.getContext('2d'), img: null };
    }
    if (!cache.img || cache.img.width !== MW) cache.img = cache.g.createImageData(MW, MH);
    const d = cache.img.data, r = rgb[0], g = rgb[1], b = rgb[2];
    for (let i = 0, j = 0; i < mask.length; i++, j += 4) { d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = mask[i]; }
    cache.g.putImageData(cache.img, 0, 0);
    return cache;
  };

  // Marching squares over a mask: closed outlines at coverage `thr`, as
  // arrays of flat [X, Y, X, Y, ...] in picture-height units, with the edge
  // crossings interpolated so the outline is smooth at any size. Loops
  // smaller than `minArea` (picture-height units squared) are dropped: stray
  // specks of mask the segmenter leaves on the set.
  K.contours = function (mask, thr, minArea) {
    const MW = K.MW, MH = K.MH, sc = 1 / MH;
    thr = thr == null ? 128 : thr;
    minArea = minArea == null ? 0.0004 : minArea;
    // Edge ids: horizontal edge (x,y)-(x+1,y) = 2*(y*MW+x); vertical (x,y)-(x,y+1) = 2*(y*MW+x)+1.
    const next = new Map(), pt = new Map();
    const v = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? 0 : mask[y * MW + x]);
    const hp = (x, y) => { const a = v(x, y), b = v(x + 1, y); const u = a === b ? 0.5 : (thr - a) / (b - a); return [(x + clamp(u, 0, 1) + 0.5) * sc, (y + 0.5) * sc]; };
    const vp = (x, y) => { const a = v(x, y), b = v(x, y + 1); const u = a === b ? 0.5 : (thr - a) / (b - a); return [(x + 0.5) * sc, (y + clamp(u, 0, 1) + 0.5) * sc]; };
    const E = (x, y, side) => {        // side: 0 top, 1 right, 2 bottom, 3 left of cell (x,y)
      let id, p;
      if (side === 0) { id = 2 * ((y + 1) * (MW + 2) + (x + 1)); p = hp; }
      else if (side === 2) { id = 2 * ((y + 2) * (MW + 2) + (x + 1)); p = hp; y = y + 1; }
      else if (side === 3) { id = 2 * ((y + 1) * (MW + 2) + (x + 1)) + 1; p = vp; }
      else { id = 2 * ((y + 1) * (MW + 2) + (x + 2)) + 1; p = vp; x = x + 1; }
      if (!pt.has(id)) pt.set(id, p(x, y));
      return id;
    };
    // Segments oriented so the inside is on the left: follow next[] to trace.
    const TABLE = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[1, 0]], [[3, 0], [1, 2]], [[2, 0]], [[3, 0]],
      [[0, 3]], [[0, 2]], [[0, 1], [2, 3]], [[0, 1]], [[1, 3]], [[1, 2]], [[2, 3]], []];
    for (let y = -1; y < MH; y++) for (let x = -1; x < MW; x++) {
      const c = (v(x, y) >= thr ? 8 : 0) | (v(x + 1, y) >= thr ? 4 : 0) | (v(x + 1, y + 1) >= thr ? 2 : 0) | (v(x, y + 1) >= thr ? 1 : 0);
      if (c === 0 || c === 15) continue;
      for (const [a, b] of TABLE[c]) next.set(E(x, y, a), E(x, y, b));
    }
    const loops = [];
    for (const start of next.keys()) {
      if (!next.has(start)) continue;
      const out = [];
      let id = start, guard = 0;
      while (next.has(id) && guard++ < 100000) {
        const q = pt.get(id); out.push(q[0], q[1]);
        const n = next.get(id); next.delete(id); id = n;
      }
      if (out.length < 8) continue;
      let area = 0;
      for (let i = 0, n = out.length; i < n; i += 2) { const j = (i + 2) % n; area += out[i] * out[j + 1] - out[j] * out[i + 1]; }
      if (Math.abs(area) * 0.5 >= minArea) loops.push(out);
    }
    return loops;
  };

  // Chaikin corner cutting on a closed loop, for silhouettes drawn large.
  K.soften = function (loop, passes) {
    let a = loop;
    for (let p = 0; p < (passes || 1); p++) {
      const n = a.length, b = new Array(n * 2);
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        b[i * 2] = a[i] * 0.75 + a[j] * 0.25; b[i * 2 + 1] = a[i + 1] * 0.75 + a[j + 1] * 0.25;
        b[i * 2 + 2] = a[i] * 0.25 + a[j] * 0.75; b[i * 2 + 3] = a[i + 1] * 0.25 + a[j + 1] * 0.75;
      }
      a = b;
    }
    return a;
  };

  // Where the body is: hip centre, and a height from shoulder-hip and
  // hip-ankle lengths (steady whatever the arms do), in picture units.
  K.body = function (pose) {
    const L = pose.lm;
    const cx = (L[23 * 3] + L[24 * 3]) / 2, cy = (L[23 * 3 + 1] + L[24 * 3 + 1]) / 2;
    const sx = (L[11 * 3] + L[12 * 3]) / 2, sy = (L[11 * 3 + 1] + L[12 * 3 + 1]) / 2;
    const torso = Math.hypot(sx - cx, sy - cy);
    const leg = (Math.hypot(L[25 * 3] - L[23 * 3], L[25 * 3 + 1] - L[23 * 3 + 1]) + Math.hypot(L[27 * 3] - L[25 * 3], L[27 * 3 + 1] - L[25 * 3 + 1]) +
      Math.hypot(L[26 * 3] - L[24 * 3], L[26 * 3 + 1] - L[24 * 3 + 1]) + Math.hypot(L[28 * 3] - L[26 * 3], L[28 * 3 + 1] - L[26 * 3 + 1])) / 2;
    return { cx, cy, height: Math.max(0.05, torso * 1.45 + leg) };
  };

  // A camera that keeps the dancer framed: returns { s, ox, oy } so that a
  // picture point (X, Y) lands at (ox + X * s, oy + Y * s) on the stage.
  // `cam` holds its eased state; `fill` is the body height as a fraction of
  // the stage height; `lag` how slowly it follows (higher = lazier).
  K.frame = function (cam, pose, ctx, dt, fill, lag, yAt) {
    const b = K.body(pose);
    const want = { cx: b.cx, cy: b.cy, h: b.height };
    if (!cam.init) { cam.cx = want.cx; cam.cy = want.cy; cam.h = want.h; cam.init = true; }
    const r = 1 / Math.max(0.05, lag || 1.2);
    cam.cx = ease(cam.cx, want.cx, r, dt);
    cam.cy = ease(cam.cy, want.cy, r, dt);
    cam.h = ease(cam.h, want.h, r * 0.3, dt);
    const s = (ctx.height * (fill || 0.7)) / cam.h;
    return { s, ox: ctx.width / 2 - cam.cx * s, oy: ctx.height * (yAt || 0.55) - cam.cy * s };
  };

  // ------------------------------------------------------------ music
  // The onset reading every viz scene uses: a jump against a slow baseline
  // is a hit; bass and pad are eased levels; `auto` is the follow-the-track
  // position between calm (0) and drop (1).
  K.ear = function () {
    const e = { prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0, bass: 0, pad: 0, hat: 0, kick: 0, snare: 0,
      lvl: 0, floor: 0.12, ceil: 0.55, auto: 0, since: { kick: 9, snare: 9, hat: 9 }, beats: 0 };
    e.listen = function (s, dt, follow) {
      const since = e.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      let kick = false, snare = false, hat = false;
      const kRaw = clamp(Math.max(0, s[0] - 0.45 * s[1]) / 50, 0, 1);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kick = true; e.beats++; }
      e.prevK = kRaw;
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp((s[4] - e.b4 - 12) / 55, 0, 1);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snare = true; }
      e.prevS = sRaw;
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp((s[8] - e.b8 - 6) / 55, 0, 1);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) { since.hat = 0; hat = true; }
      e.prevH = hRaw;
      e.kick = Math.exp(-since.kick * 7);
      e.snare = Math.exp(-since.snare * 5);
      e.hat = Math.exp(-since.hat * 14);
      e.bass = ease(e.bass, clamp((s[1] + s[2]) / 170, 0, 1), 1.2, dt);
      e.pad = ease(e.pad, clamp((s[2] + s[3] + s[4]) / 180, 0, 1), 0.8, dt);
      e.lvl = ease(e.lvl, (s[0] + s[1]) / 200, 0.9, dt);
      e.ceil = Math.max(e.lvl, e.ceil - dt * 0.008);
      e.floor = Math.min(e.lvl, e.floor + dt * 0.006);
      const rel = (e.lvl - e.floor) / Math.max(0.18, e.ceil - e.floor);
      const x = clamp((rel - 0.35) / 0.45, 0, 1), want = follow ? x * x * (3 - 2 * x) : 0;
      e.auto = ease(e.auto, want, want > e.auto ? 1.4 : 0.35, dt);
      e.rel = rel;
      return { kick, snare, hat };
    };
    // Every driven param, pulled from the performer's value towards the
    // drop preset by the follow position.
    e.drive = function (params, drop, keys) {
      const P = Object.assign({}, params);
      for (const k of keys) P[k] = params[k] + (drop[k] - params[k]) * e.auto;
      return P;
    };
    return e;
  };

  // ------------------------------------------------------------ the page
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (window.HARNESS) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:50;max-width:min(420px,calc(100vw - 32px));padding:8px 12px;border-radius:6px;background:rgba(20,18,16,.86);color:#eee;font:13px/1.35 system-ui,sans-serif;pointer-events:none;transition:opacity .4s';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 4200);
  }
  K.toast = toast;

  function pickFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) K.startLive('file', f); };
    inp.click();
  }

  // The same four source buttons on every pose scene.
  K.actions = [
    { id: 'pose-film', label: 'Dancer: baked film', run() { K.stopLive(); toast('Film: baked pose track'); } },
    { id: 'pose-live', label: 'Dancer: film, live MediaPipe', run() { K.startLive('film'); } },
    { id: 'pose-camera', label: 'Dancer: camera', run() { K.startLive('camera'); } },
    { id: 'pose-file', label: 'Dancer: open a video…', run() { pickFile(); } },
  ];

  // While a pose scene is showing, a video dropped on the stage becomes the
  // dancer (the core's own drop handler still takes audio files).
  let active = 0, dropBound = false;
  K.enter = function () {
    active++;
    K.load().catch(() => {});
    if (dropBound) return;
    const stage = document.getElementById('stage');
    if (!stage || window.HARNESS) return;
    dropBound = true;
    stage.addEventListener('drop', (e) => {
      if (!active) return;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /^video\//.test(f.type)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const hint = document.getElementById('drop-hint'); if (hint) hint.hidden = true;
        K.startLive('file', f);
      }
    }, true);
  };
  K.leave = function () { active = Math.max(0, active - 1); };

  // For fps measurement and demos: ?pose=live runs MediaPipe on the film,
  // ?pose=camera asks for the camera, from the first pose scene shown.
  let urlDone = false;
  K.fromUrl = function () {
    if (urlDone || window.HARNESS) return;
    urlDone = true;
    const m = /[?&]pose=(live|camera)/.exec(location.search);
    if (m) K.startLive(m[1] === 'live' ? 'film' : 'camera');
  };

  window.VIZ_POSE = K;
})();
