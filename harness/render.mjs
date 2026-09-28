#!/usr/bin/env node
// Render a viz scene headlessly through the scripted test track and write a
// contact sheet, full-size frames and a report. See README.md.
//
//   node harness/render.mjs web/scenes/foo.js [--out harness/renders/foo]
//     [--size 1280x720] [--seed 1] [--params '{"k":v}'] [--seconds 24]
//     [--frames 2,4,6,...] [--density 1]

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HARNESS_DIR);
const FPS = 60;

function usage(msg) {
  if (msg) console.error('render: ' + msg);
  console.error('usage: node harness/render.mjs <scene.js> [--out dir] [--size WxH] [--seed N] ' +
    "[--params '{\"k\":v}'] [--seconds 24] [--frames 2,4,...] [--density 1]");
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { size: '1280x720', seed: '1', params: null, seconds: null, frames: null, out: null, density: '1' };
  let scene = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage();
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const val = eq > 0 ? a.slice(eq + 1) : argv[++i];
      if (!(key in opts)) usage('unknown option --' + key);
      if (val === undefined) usage('--' + key + ' needs a value');
      opts[key] = val;
    } else if (!scene) scene = a;
    else usage('unexpected argument ' + a);
  }
  if (!scene) usage('no scene file given');

  const scenePath = path.resolve(scene);
  if (!existsSync(scenePath)) usage('no such file ' + scene);
  const rel = path.relative(REPO_ROOT, scenePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) usage('the scene must live inside the repo (' + REPO_ROOT + ')');

  const m = /^(\d+)x(\d+)$/.exec(opts.size);
  if (!m) usage('--size must look like 1280x720');
  const width = +m[1], height = +m[2];

  if (opts.params) {
    try { JSON.parse(opts.params); } catch { usage('--params is not valid JSON'); }
  }

  const seconds = opts.seconds == null ? null : Number(opts.seconds);
  if (seconds != null && !(seconds > 0)) usage('--seconds must be positive');
  let times;
  if (opts.frames) {
    times = opts.frames.split(',').map(s => Number(s.trim())).filter(t => isFinite(t) && t > 0);
    if (!times.length) usage('--frames needs positive times in seconds');
  } else {
    // Default: 12 evenly spaced tiles ending at --seconds (2, 4, ... 24 for the full track).
    const total = seconds ?? 24;
    times = Array.from({ length: 12 }, (_, i) => total * (i + 1) / 12);
  }
  times = [...new Set(times.map(t => Math.round(t * FPS) / FPS))].sort((a, b) => a - b);
  const lastT = seconds != null ? Math.max(seconds, times[times.length - 1]) : times[times.length - 1];

  const id = path.basename(scenePath).replace(/\.m?js$/, '');
  const out = path.resolve(opts.out ?? path.join(HARNESS_DIR, 'renders', id));
  return {
    scenePath, sceneUrl: '/' + rel.split(path.sep).join('/'), width, height, seed: String(opts.seed),
    params: opts.params, density: Number(opts.density) || 1, times, lastT, out
  };
}

// ------------------------------------------------------------ static server
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.glsl': 'text/plain', '.frag': 'text/plain', '.vert': 'text/plain',
  '.txt': 'text/plain', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4'
};

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400).end(); return; }
    const file = path.join(REPO_ROOT, urlPath);
    // Never serve outside the repo, whatever the URL says.
    if (file !== REPO_ROOT && !file.startsWith(REPO_ROOT + path.sep)) { res.writeHead(403).end(); return; }
    let st;
    try { st = statSync(file); } catch { res.writeHead(404).end('not found'); return; }
    if (!st.isFile()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store'
    });
    createReadStream(file).pipe(res);
  });
  // Loopback only, on whatever port is free.
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ------------------------------------------------------------------ browser
// swiftshader gives headless Chromium a working WebGL/WebGL2 with no GPU, and
// renders identically run to run, which the determinism guarantee relies on.
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];

async function launch() {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { usage('Playwright is not installed; run `npm install` inside harness/'); }
  try {
    return { browser: await chromium.launch({ headless: true, args: CHROMIUM_ARGS }), via: 'playwright chromium' };
  } catch (e) {
    // The cached headless shell must match this Playwright's expected build;
    // if it does not, the installed Google Chrome is a working substitute.
    const browser = await chromium.launch({ headless: true, channel: 'chrome', args: CHROMIUM_ARGS });
    return { browser, via: 'installed Google Chrome (bundled Chromium failed: ' + e.message.split('\n')[0] + ')' };
  }
}

function stats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const pct = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const r = x => Math.round(x * 1000) / 1000;
  return { frames: s.length, meanMs: r(mean), p50Ms: r(pct(0.5)), p95Ms: r(pct(0.95)), maxMs: r(s[s.length - 1]) };
}

function pngBuffer(dataUrl) { return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16); }
function frameName(t) {
  const s = Number.isInteger(t) ? String(t).padStart(2, '0') : t.toFixed(2).replace(/0$/, '').padStart(4, '0');
  return 'frame-' + s + 's.png';
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  await fs.mkdir(o.out, { recursive: true });
  const wall0 = performance.now();

  const server = await serve();
  const port = server.address().port;
  const { browser, via } = await launch();
  const console_ = [];
  const exceptions = [];
  const failedRequests = [];
  let report;

  try {
    const page = await browser.newPage({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: 1 });
    page.on('console', m => {
      if (m.type() === 'error' || m.type() === 'warning') console_.push({ type: m.type(), text: m.text() });
    });
    page.on('pageerror', e => exceptions.push(String(e && e.stack || e)));
    page.on('requestfailed', r => failedRequests.push(r.url() + ' ' + (r.failure()?.errorText ?? '')));
    page.on('response', r => { if (r.status() >= 400) failedRequests.push(r.url() + ' HTTP ' + r.status()); });

    const qs = new URLSearchParams({ scene: o.sceneUrl, w: o.width, h: o.height, seed: o.seed, density: o.density });
    if (o.params) qs.set('params', o.params);
    await page.goto(`http://127.0.0.1:${port}/harness/stage.html?${qs}`);
    await page.waitForFunction(() => window.HARNESS && window.HARNESS.status !== 'loading', null, { timeout: 30000 })
      .catch(() => { throw new Error('the stage did not become ready in 30 s (a preload that never finishes?)'); });
    const status = await page.evaluate(() => ({ status: HARNESS.status, error: HARNESS.error, info: HARNESS.info }));
    if (status.status !== 'ready') throw new Error(status.error);
    const info = status.info;

    const lastFrame = Math.round(o.lastT * FPS);
    const header = `${info.name} (${info.id}) · ${o.width}x${o.height} · seed ${o.seed}` +
      (o.params ? ' · params ' + o.params : '') + ' · track 124 BPM';
    await page.evaluate(([n, h]) => HARNESS.initSheet(n, h), [o.times.length, header]);

    const frames = [];
    const step0 = performance.now();
    for (let i = 0; i < o.times.length; i++) {
      const f = Math.round(o.times[i] * FPS);
      const cap = await page.evaluate(([f, i]) => { HARNESS.stepTo(f); return HARNESS.capture(i); }, [f, i]);
      const buf = pngBuffer(cap.png);
      const file = path.join(o.out, frameName(o.times[i]));
      await fs.writeFile(file, buf);
      frames.push({ t: cap.t, frame: cap.frame, section: cap.section, bands: cap.bands, file, sha256: sha(buf) });
    }
    await page.evaluate(f => HARNESS.stepTo(f), lastFrame);
    const stepSeconds = (performance.now() - step0) / 1000;

    const sheetBuf = pngBuffer(await page.evaluate(() => HARNESS.sheetPng()));
    const sheetFile = path.join(o.out, 'sheet.png');
    await fs.writeFile(sheetFile, sheetBuf);

    const timing = await page.evaluate(() => ({
      drawMs: HARNESS.drawMs, renderMs: HARNESS.renderMs, frameMs: HARNESS.frameMs, drawErrors: HARNESS.drawErrors, warnings: HARNESS.warnings
    }));

    report = {
      scene: path.relative(REPO_ROOT, o.scenePath),
      id: info.id, name: info.name, gallery: info.gallery,
      size: { width: o.width, height: o.height, density: o.density, virtual: info.virtual },
      seed: o.seed, params: info.params,
      framesStepped: lastFrame, seconds: lastFrame / FPS,
      browser: via, webgl: info.gl,
      // renderTime is the honest per-frame cost (draw + forced flush); drawTime is draw()'s JavaScript alone.
      renderTime: stats(timing.renderMs),
      drawTime: stats(timing.drawMs),
      frameTime: stats(timing.frameMs),
      wall: { steppingSeconds: Math.round(stepSeconds * 100) / 100, totalSeconds: Math.round((performance.now() - wall0) / 10) / 100 },
      drawErrors: timing.drawErrors,
      warnings: timing.warnings,
      consoleErrors: console_.filter(m => m.type === 'error').map(m => m.text),
      consoleWarnings: console_.filter(m => m.type === 'warning').map(m => m.text),
      exceptions,
      failedRequests,
      sheet: { file: sheetFile, sha256: sha(sheetBuf) },
      frames
    };
  } catch (e) {
    report = {
      scene: path.relative(REPO_ROOT, o.scenePath), failed: String(e.message || e), browser: via,
      consoleErrors: console_.filter(m => m.type === 'error').map(m => m.text), exceptions, failedRequests
    };
  } finally {
    await browser.close();
    server.close();
  }

  const reportFile = path.join(o.out, 'report.json');
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');

  const rel = p => { const r = path.relative(process.cwd(), p); return !r ? '.' : r.startsWith('..') ? p : r; };
  const firstLine = x => String(x).split('\n')[0];
  if (report.failed) {
    console.log(`render FAILED for ${report.scene}: ${report.failed}. ` +
      `${report.consoleErrors.length} console error(s), ${report.exceptions.length} exception(s)` +
      (report.consoleErrors[0] ? ` (first: ${firstLine(report.consoleErrors[0])})` : '') + `. Report: ${rel(reportFile)}.`);
    process.exit(1);
  }
  const problems = report.consoleErrors.length + report.exceptions.length + report.failedRequests.length;
  const d = report.renderTime, j = report.drawTime;
  console.log(
    `Rendered ${report.name} (${report.scene}) at ${o.width}x${o.height}, seed ${o.seed}: ` +
    `${report.framesStepped} frames (${report.seconds}s of track) stepped in ${report.wall.steppingSeconds}s ` +
    `(${report.wall.totalSeconds}s total). Scene draw() incl. raster flush: mean ${d.meanMs} ms, p95 ${d.p95Ms} ms, ` +
    `max ${d.maxMs} ms per frame (draw() JavaScript alone: mean ${j.meanMs} ms, p95 ${j.p95Ms} ms). ` +
    `WebGL2 ${report.webgl.webgl2 ? 'available' : 'UNAVAILABLE'} (${report.webgl.renderer}). ` +
    (problems
      ? `PROBLEMS: ${report.consoleErrors.length} console error(s), ${report.exceptions.length} exception(s), ` +
        `${report.failedRequests.length} failed request(s), ${report.drawErrors} frame(s) where draw threw` +
        (report.consoleErrors[0] ? ` — first: ${firstLine(report.consoleErrors[0])}` : report.exceptions[0] ? ` — first: ${firstLine(report.exceptions[0])}` : '') + '. '
      : 'No console errors or exceptions. ') +
    (report.warnings.length ? `Warnings: ${report.warnings.join('; ')}. ` : '') +
    `Contact sheet ${rel(report.sheet.file)}, ${report.frames.length} full-size frames and report.json in ${rel(o.out)}/.`
  );
  if (problems || report.drawErrors) process.exitCode = 1;
}

main().catch(e => { console.error('render: ' + (e.stack || e)); process.exit(1); });
