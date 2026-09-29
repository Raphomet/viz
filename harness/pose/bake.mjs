// Bakes MediaPipe pose landmarks and person masks from the bundled dance clip
// into web/assets/pose/, so the pose scenes run from a fixed track: the render
// harness needs deterministic frames (video decode and inference are both
// asynchronous), the Artifact refuses the camera, and a slow laptop may not
// keep up with live inference at full screen.
//
// Baking is offline, so it uses pose_landmarker_heavy (30.7 MB, over the
// 15 MB bundle cap, so never shipped) for better joints than the lite model the
// page runs live, and the landmarker's own full-body segmentation mask, which
// holds a small full-length figure far better than the selfie segmenter.
//
// Output:
//   <name>.pose.json   { fps, frames, width, height, landmarks, world, masks }
//     landmarks: base64 Int16, frames x 33 x [x, y, visibility], x and y in
//                1/10000 of the picture, visibility in 1/10000
//     world:     base64 Int16, frames x 33 x [x, y, z] in millimetres,
//                hip-centred (MediaPipe's worldLandmarks)
//     Both are smoothed with a centred Gaussian over time (no lag, which only
//     an offline pass can have), weighted by visibility.
//   <name>.masks.png   the person mask, MW x MH per frame, three frames packed
//                      into the R, G and B of one tile, tiles in rows of COLS.
//
// Usage: node harness/pose/bake.mjs CLIP.mp4 HEAVY_MODEL.task OUT_PREFIX
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const [clip, model, outPrefix] = process.argv.slice(2);
if (!clip || !model || !outPrefix) { console.error('usage: bake.mjs CLIP.mp4 MODEL.task OUT_PREFIX'); process.exit(2); }
const FPS = 30, MW = 160, MH = 120, COLS = 20;
const TV = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';

const files = { '/clip.mp4': [clip, 'video/mp4'], '/model.task': [model, 'application/octet-stream'] };
const srv = http.createServer((q, r) => {
  const f = files[q.url.split('?')[0]];
  if (!f) { r.writeHead(200, { 'Content-Type': 'text/html' }).end('<html></html>'); return; }
  const st = fs.statSync(f[0]);
  const m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || '');
  const s = m ? +m[1] : 0, e = m && m[2] ? +m[2] : st.size - 1;
  r.writeHead(m ? 206 : 200, { 'Content-Type': f[1], 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1, ...(m ? { 'Content-Range': `bytes ${s}-${e}/${st.size}` } : {}) });
  fs.createReadStream(f[0], { start: s, end: e }).pipe(r);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
await page.exposeFunction('progress', (s) => process.stdout.write('\r' + s));

const raw = await page.evaluate(async ({ TV, FPS, MW, MH, COLS }) => {
  const { FilesetResolver, PoseLandmarker } = await import(TV + '/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks(TV + '/wasm');
  let pl, delegate = 'GPU';
  try {
    pl = await PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/model.task', delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: true, minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3 });
  } catch (e) {
    delegate = 'CPU';
    pl = await PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/model.task', delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: true, minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3 });
  }
  const v = document.createElement('video');
  v.src = '/clip.mp4'; v.muted = true;
  await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('video error')); });
  const frames = Math.floor(v.duration * FPS);
  const lm = new Float32Array(frames * 33 * 3), world = new Float32Array(frames * 33 * 3);
  const present = new Uint8Array(frames);
  const rows = Math.ceil(Math.ceil(frames / 3) / COLS);
  const atlas = document.createElement('canvas'); atlas.width = COLS * MW; atlas.height = rows * MH;
  const ag = atlas.getContext('2d');
  const atlasData = ag.createImageData(atlas.width, atlas.height);
  for (let i = 3; i < atlasData.data.length; i += 4) atlasData.data[i] = 255;
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    v.currentTime = (f + 0.5) / FPS;
    await new Promise(ok => v.onseeked = ok);
    const r = pl.detectForVideo(v, Math.round(f * 1000 / FPS) + 1);
    if (r.landmarks && r.landmarks[0]) {
      present[f] = 1;
      r.landmarks[0].forEach((p, j) => { lm.set([p.x, p.y, p.visibility ?? 1], (f * 33 + j) * 3); });
      r.worldLandmarks[0].forEach((p, j) => { world.set([p.x, p.y, p.z], (f * 33 + j) * 3); });
    }
    const mk = r.segmentationMasks && r.segmentationMasks[0];
    if (mk) {
      const src = mk.getAsFloat32Array(), sw = mk.width, sh = mk.height;
      const tile = Math.floor(f / 3), ch = f % 3;
      const tx = (tile % COLS) * MW, ty = Math.floor(tile / COLS) * MH;
      // Box-filter down to MW x MH so the edge keeps its soft coverage.
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const x0 = Math.floor(x * sw / MW), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sw / MW));
        const y0 = Math.floor(y * sh / MH), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sh / MH));
        let s = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += src[yy * sw + xx]; n++; }
        atlasData.data[((ty + y) * atlas.width + tx + x) * 4 + ch] = Math.round(255 * s / n);
      }
    }
    if (r.close) r.close();
    if (f % 10 === 0) window.progress(`${delegate} frame ${f}/${frames}  ${((performance.now() - t0) / (f + 1)).toFixed(0)} ms/frame   `);
  }
  ag.putImageData(atlasData, 0, 0);
  const png = atlas.toDataURL('image/png');
  return { frames, width: v.videoWidth, height: v.videoHeight, lm: [...lm], world: [...world], present: [...present], png, rows, delegate };
}, { TV, FPS, MW, MH, COLS });
console.log('\nbaked', raw.frames, 'frames with', raw.delegate, 'delegate;', raw.present.filter(Boolean).length, 'with a pose');

// Fill frames with no pose from the nearest neighbours, then smooth.
const N = raw.frames;
const lm = Float32Array.from(raw.lm), world = Float32Array.from(raw.world);
for (let f = 0; f < N; f++) if (!raw.present[f]) {
  let a = f - 1; while (a >= 0 && !raw.present[a]) a--;
  let b = f + 1; while (b < N && !raw.present[b]) b++;
  const src = a >= 0 ? a : b; if (src < 0 || src >= N) continue;
  lm.set(lm.subarray(src * 99, src * 99 + 99), f * 99); world.set(world.subarray(src * 99, src * 99 + 99), f * 99);
}
function smooth(arr, stride, sigma, weightIdx) {
  const out = new Float32Array(arr.length), R = Math.ceil(sigma * 2.5);
  for (let f = 0; f < N; f++) for (let j = 0; j < 33; j++) for (let c = 0; c < stride; c++) {
    if (c === weightIdx) { out[(f * 33 + j) * stride + c] = arr[(f * 33 + j) * stride + c]; continue; }
    let s = 0, w = 0;
    for (let k = -R; k <= R; k++) {
      const g = Math.min(N - 1, Math.max(0, f + k));
      const wk = Math.exp(-(k * k) / (2 * sigma * sigma)) * (0.15 + (weightIdx >= 0 ? lm[(g * 33 + j) * 3 + 2] : 1));
      s += arr[(g * 33 + j) * stride + c] * wk; w += wk;
    }
    out[(f * 33 + j) * stride + c] = s / w;
  }
  return out;
}
// 1.2 frames: enough to take the per-frame jitter out, not the snap of a kick.
const lmS = smooth(lm, 3, 1.2, 2), worldS = smooth(world, 3, 1.2, -1);
const q = (arr, scale) => { const a = new Int16Array(arr.length); for (let i = 0; i < arr.length; i++) a[i] = Math.max(-32768, Math.min(32767, Math.round(arr[i] * scale))); return Buffer.from(a.buffer).toString('base64'); };
const json = {
  source: 'little-tich-1900.mp4', fps: FPS, frames: N, width: raw.width, height: raw.height,
  model: 'pose_landmarker_heavy (float16), MediaPipe tasks-vision 1.0.1',
  landmarkScale: 10000, worldScale: 1000,
  landmarks: q(lmS, 10000), world: q(worldS, 1000),
  masks: { file: outPrefix.split('/').pop() + '.masks.png', width: MW, height: MH, cols: COLS, rows: raw.rows, perTile: 3 }
};
fs.writeFileSync(outPrefix + '.pose.json', JSON.stringify(json));
fs.writeFileSync(outPrefix + '.masks.png', Buffer.from(raw.png.split(',')[1], 'base64'));
console.log('wrote', outPrefix + '.pose.json', (fs.statSync(outPrefix + '.pose.json').size / 1e3).toFixed(0), 'KB;',
  outPrefix + '.masks.png', (fs.statSync(outPrefix + '.masks.png').size / 1e3).toFixed(0), 'KB');
await browser.close(); srv.close();
