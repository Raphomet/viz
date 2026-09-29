#!/usr/bin/env node
// Render a viz scene headlessly through the scripted test track and write a
// contact sheet, full-size frames and a report. See README.md.
//
//   node harness/render.mjs web/scenes/foo.js [--out harness/renders/foo]
//     [--size 1280x720] [--seed 1] [--params '{"k":v}'] [--seconds 24]
//     [--frames 2,4,6,...] [--density 1] [--fx kaleido,slice]
//     [--fxparams '{"kaleido":{"segments":8}}'] [--finish on|off] [--gpu]

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HARNESS_DIR, REPO_ROOT, FPS, serve, launch, openStage, pngBuffer, sha } from './lib.mjs';

function usage(msg) {
  if (msg) console.error('render: ' + msg);
  console.error('usage: node harness/render.mjs <scene.js> [--out dir] [--size WxH] [--seed N] ' +
    "[--params '{\"k\":v}'] [--seconds 24] [--frames 2,4,...] [--density 1] " +
    "[--fx id1,id2] [--fxparams '{\"id\":{\"k\":v}}'] [--finish on|off] [--gpu]");
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { size: '1280x720', seed: '1', params: null, seconds: null, frames: null, out: null, density: '1',
    fx: null, fxparams: null, finish: 'on', gpu: false };
  let scene = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage();
    if (a === '--gpu') { opts.gpu = true; continue; }
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
  if (opts.fxparams) {
    try { JSON.parse(opts.fxparams); } catch { usage('--fxparams is not valid JSON'); }
  }
  if (!/^(on|off)$/.test(opts.finish)) usage('--finish must be on or off');
  if (opts.fx && !/^[a-z0-9_-]+(,[a-z0-9_-]+)*$/i.test(opts.fx)) usage('--fx takes effect ids separated by commas');

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
    params: opts.params, density: Number(opts.density) || 1, times, lastT, out,
    fx: opts.fx, fxparams: opts.fxparams, finish: opts.finish, gpu: opts.gpu
  };
}

function stats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const pct = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const r = x => Math.round(x * 1000) / 1000;
  return { frames: s.length, meanMs: r(mean), p50Ms: r(pct(0.5)), p95Ms: r(pct(0.95)), maxMs: r(s[s.length - 1]) };
}

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
  const { browser, via } = await launch(usage, { gpu: o.gpu });
  const console_ = [];
  const exceptions = [];
  const failedRequests = [];
  let report;

  try {
    const { page, info } = await openStage(browser, port, o,
      { console: console_, exceptions, failedRequests });
    // Chrome falls back to SwiftShader when it cannot get the GPU; a --gpu
    // run that silently rendered in software would mislead on speed.
    if (o.gpu && /swiftshader/i.test(info.gl.renderer || '')) throw new Error('--gpu asked for the GPU but Chrome gave SwiftShader (' + info.gl.renderer + ')');

    const lastFrame = Math.round(o.lastT * FPS);
    const header = `${info.name} (${info.id}) · ${o.width}x${o.height} · seed ${o.seed}` +
      (o.params ? ' · params ' + o.params : '') +
      (o.fx ? ' · fx ' + o.fx : '') + ' · finish ' + o.finish + (o.gpu ? ' · GPU' : '') + ' · track 124 BPM';
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
      seed: o.seed, params: info.params, fx: info.fx, finish: o.finish,
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
