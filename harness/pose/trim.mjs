// Trims, crops and re-encodes the source dance film for web/assets/pose/.
// ffmpeg is not installed on the laptop (2026-09-29) and avconvert can trim
// but not crop or desaturate, so installed Chrome does it: the clip plays in
// real time into a canvas (cropped to the 4:3 picture, drawn in greys) and
// MediaRecorder encodes the canvas stream.
// Usage: node harness/pose/trim.mjs SOURCE.mp4 OUT.(mp4|webm) START_S DURATION_S [WIDTH]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [src, out, startS, durS, widthArg] = process.argv.slice(2);
if (!src || !out || !startS || !durS) { console.error('usage: trim.mjs SOURCE OUT START DURATION [WIDTH]'); process.exit(2); }
const srv = http.createServer((q, r) => {
  if (!q.url.startsWith('/src')) { r.writeHead(200, { 'Content-Type': 'text/html' }).end('<html></html>'); return; }
  const st = fs.statSync(src);
  const m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || '');
  const s = m ? +m[1] : 0, e = m && m[2] ? +m[2] : st.size - 1;
  r.writeHead(m ? 206 : 200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1, ...(m ? { 'Content-Range': `bytes ${s}-${e}/${st.size}` } : {}) });
  fs.createReadStream(src, { start: s, end: e }).pipe(r);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
const res = await page.evaluate(async ({ start, dur, W, wantMp4 }) => {
  const v = document.createElement('video');
  v.src = '/src'; v.muted = true; v.playsInline = true;
  await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('video error')); });
  // The picture is 4:3 pillarboxed inside a 16:9 frame: keep the 4:3 middle.
  const sh = v.videoHeight, sw = Math.round(sh * 4 / 3), sx = Math.round((v.videoWidth - sw) / 2);
  const H = Math.round(W * 3 / 4);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const types = wantMp4 ? ['video/mp4;codecs=avc1.42E01F', 'video/mp4'] : ['video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error('no recorder for ' + types);
  v.currentTime = start; await new Promise(ok => v.onseeked = ok);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 900000 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const draw = () => {
    g.filter = 'grayscale(1) contrast(1.08)';
    g.drawImage(v, sx, 0, sw, sh, 0, 0, W, H);
  };
  draw();
  rec.start(1000);
  await v.play();
  await new Promise(ok => {
    const tick = () => { draw(); if (v.currentTime >= start + dur || v.ended) ok(); else v.requestVideoFrameCallback(tick); };
    v.requestVideoFrameCallback(tick);
  });
  v.pause(); rec.stop();
  await new Promise(ok => rec.onstop = ok);
  const blob = new Blob(chunks, { type: mime });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
  return { mime, b64: btoa(bin), W, H };
}, { start: +startS, dur: +durS, W: +(widthArg || 640), wantMp4: out.endsWith('.mp4') });
fs.writeFileSync(out, Buffer.from(res.b64, 'base64'));
console.log(`wrote ${out} (${res.mime}, ${res.W}x${res.H}, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB)`);
await browser.close(); srv.close();
