// What render.mjs and jolt.mjs share: the loopback static server, the headless
// browser, and opening stage.html on one scene until it reports ready. Each
// tool keeps its own CLI; this module has no side effects on import.

import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.dirname(HARNESS_DIR);
export const FPS = 60;

// ------------------------------------------------------------ static server
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.glsl': 'text/plain', '.frag': 'text/plain', '.vert': 'text/plain',
  '.txt': 'text/plain', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4'
};

export function serve() {
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

// `missing` is called (and should exit) when Playwright is not installed, so
// each tool can print its own usage line.
export async function launch(missing) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { missing('Playwright is not installed; run `npm install` inside harness/'); }
  try {
    return { browser: await chromium.launch({ headless: true, args: CHROMIUM_ARGS }), via: 'playwright chromium' };
  } catch (e) {
    // The cached headless shell must match this Playwright's expected build;
    // if it does not, the installed Google Chrome is a working substitute.
    const browser = await chromium.launch({ headless: true, channel: 'chrome', args: CHROMIUM_ARGS });
    return { browser, via: 'installed Google Chrome (bundled Chromium failed: ' + e.message.split('\n')[0] + ')' };
  }
}

// Open stage.html on one scene and wait for it to be ready. `log` collects the
// console errors/warnings, uncaught exceptions and failed requests from the
// moment the page exists, so a scene that fails in setup is still reported.
export async function openStage(browser, port, o, log) {
  const page = await browser.newPage({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: 1 });
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') log.console.push({ type: m.type(), text: m.text() });
  });
  page.on('pageerror', e => log.exceptions.push(String(e && e.stack || e)));
  page.on('requestfailed', r => log.failedRequests.push(r.url() + ' ' + (r.failure()?.errorText ?? '')));
  page.on('response', r => { if (r.status() >= 400) log.failedRequests.push(r.url() + ' HTTP ' + r.status()); });

  const qs = new URLSearchParams({ scene: o.sceneUrl, w: o.width, h: o.height, seed: o.seed, density: o.density });
  if (o.params) qs.set('params', o.params);
  if (o.fx) qs.set('fx', o.fx);
  if (o.fxparams) qs.set('fxparams', o.fxparams);
  if (o.finish) qs.set('finish', o.finish);
  await page.goto(`http://127.0.0.1:${port}/harness/stage.html?${qs}`);
  // 120 s, not 30: with a dozen agents rendering at once (load ~50) honest first
  // frames took 16-21 s and the 30 s limit failed runs that weren't broken (2026-09-28).
  await page.waitForFunction(() => window.HARNESS && window.HARNESS.status !== 'loading', null, { timeout: 120000 })
    .catch(() => { throw new Error('the stage did not become ready in 120 s (a preload that never finishes?)'); });
  const status = await page.evaluate(() => ({ status: HARNESS.status, error: HARNESS.error, info: HARNESS.info }));
  if (status.status !== 'ready') throw new Error(status.error);
  return { page, info: status.info };
}

export function pngBuffer(dataUrl) { return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'); }
export function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16); }
