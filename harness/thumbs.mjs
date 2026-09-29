#!/usr/bin/env node
// Thumbnails for the app's scene browser (web/browser.js): one representative
// frame per scene, in the drop, written as a small JPEG to
// web/assets/thumbs/<scene id>.jpg, plus manifest.json ({ id: content stamp })
// so the app knows which exist without probing for 404s, and re-fetches one
// only when it changes.
//
//   node harness/thumbs.mjs [--force] [--jobs 3] [--at 12] [--only id,id|file.js]
//     [--software]
//
// Scenes come from web/index.html's script tags, so a scene the app loads gets
// a thumbnail and nothing else does. Existing thumbnails are kept unless
// --force (or --only) names them, so a new batch costs only its own renders.
// It renders through render.mjs with --gpu when render.mjs has it: three.js
// and WebGPU scenes are slow or unsupported on the software rasteriser, and a
// thumbnail needs no bit-for-bit reproducibility. --software opts out.

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HARNESS);
const WEB = path.join(ROOT, 'web');
const OUT = path.join(WEB, 'assets', 'thumbs');
const WORK = path.join(HARNESS, 'renders', 'thumbs');   // renders/ is gitignored
const IDS = path.join(WORK, 'ids.json');                // scene file -> id, from past reports

// Rendered at 640x360 and scaled down by half: supersampling keeps the
// one-pixel lines most scenes are made of from breaking up at thumbnail size.
const RENDER_SIZE = '640x360';
const THUMB_W = 320, THUMB_H = 180;
const JPEG_QUALITY = 72;   // ~15-25 KB at 320x180
const TIMEOUT_MS = 6 * 60 * 1000;

function usage(msg) {
  if (msg) console.error('thumbs: ' + msg);
  console.error('usage: node harness/thumbs.mjs [--force] [--jobs N] [--at SECONDS] [--only id,id|file.js] [--software]');
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = { force: false, jobs: 3, at: 12, only: null, software: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--force') opts.force = true;
  else if (a === '--software') opts.software = true;
  else if (a === '--jobs') opts.jobs = Math.max(1, parseInt(args[++i], 10) || 1);
  else if (a === '--at') opts.at = Number(args[++i]);
  else if (a === '--only') opts.only = String(args[++i] || '').split(',').filter(Boolean);
  else if (a === '-h' || a === '--help') usage();
  else usage('unknown option ' + a);
}
if (!(opts.at > 0)) usage('--at must be a positive number of seconds');

const gpu = !opts.software && readFileSync(path.join(HARNESS, 'render.mjs'), 'utf8').includes("'--gpu'");

// Every scene script index.html loads, in page order (V2s included: the
// browser shows the thumbnail of whichever version an entry plays).
function sceneFiles() {
  const html = readFileSync(path.join(WEB, 'index.html'), 'utf8');
  const files = [];
  for (const m of html.matchAll(/<script\s+src="((?:viz|scenes)\/[^"]+\.js)"/g)) files.push(m[1]);
  return [...new Set(files)];
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

function run(cmd, argv) {
  return new Promise(resolve => {
    const child = spawn(cmd, argv, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += '\n(timed out)'; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('close', code => { clearTimeout(timer); resolve({ code, out }); });
  });
}

function frameName(t) {
  // render.mjs names frames by seconds, dropping a trailing .0 (frame-12s.png, frame-10.5s.png).
  const s = Math.round(t * 60) / 60;
  return 'frame-' + (Number.isInteger(s) ? String(s).padStart(2, '0') : String(Math.round(s * 100) / 100)) + 's.png';
}

async function thumbOne(file, ids) {
  const base = file.replace(/\.js$/, '').replace(/[\/]/g, '_');
  const work = path.join(WORK, base);
  const argv = [path.join(HARNESS, 'render.mjs'), path.join('web', file), '--size', RENDER_SIZE,
    '--frames', String(opts.at), '--seconds', String(opts.at), '--out', work];
  if (gpu) argv.push('--gpu');
  const t0 = performance.now();
  const r = await run(process.execPath, argv);
  const report = await readJson(path.join(work, 'report.json'), null);
  const id = report && report.id;
  if (id) ids[file] = id;
  let png = path.join(work, frameName(opts.at));
  if (!existsSync(png)) {
    // Fall back to whatever frame render.mjs wrote, if its naming ever changes.
    const any = (await fs.readdir(work).catch(() => [])).filter(f => /^frame-.*\.png$/.test(f));
    png = any.length ? path.join(work, any[0]) : null;
  }
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  if (!id || !png) {
    return { file, ok: false, msg: `no frame (${r.code}): ${r.out.trim().split('\n').slice(-2).join(' ')}` };
  }
  const jpg = path.join(OUT, id + '.jpg');
  const s = await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY),
    '-z', String(THUMB_H), String(THUMB_W), png, '--out', jpg]);
  if (s.code !== 0) return { file, id, ok: false, msg: 'sips failed: ' + s.out.trim() };
  const size = (await fs.stat(jpg)).size;
  // A scene that logged errors still gets its frame; say so, since the
  // thumbnail may show the black of a failed draw.
  const warn = r.code !== 0 ? ' (render reported problems: see ' + path.relative(ROOT, path.join(work, 'report.json')) + ')' : '';
  return { file, id, ok: true, msg: `${id} ${Math.round(size / 1024)} KB in ${secs}s${warn}` };
}

async function writeManifest() {
  const names = (await fs.readdir(OUT)).filter(f => f.endsWith('.jpg')).sort();
  const manifest = {};
  for (const n of names) {
    const buf = await fs.readFile(path.join(OUT, n));
    manifest[n.slice(0, -4)] = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  }
  await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  return names.length;
}

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(WORK, { recursive: true });
const ids = await readJson(IDS, {});
let files = sceneFiles();
if (opts.only) files = files.filter(f => opts.only.includes(ids[f]) || opts.only.includes(f) || opts.only.includes(path.basename(f)));
else if (!opts.force) files = files.filter(f => !(ids[f] && existsSync(path.join(OUT, ids[f] + '.jpg'))));

console.log(`thumbs: ${files.length} scene(s) to render at ${opts.at}s, ${opts.jobs} at a time, ` +
  (gpu ? 'on the GPU (render.mjs --gpu)' : 'in software'));
const queue = files.slice();
let done = 0, failed = 0;
async function worker() {
  while (queue.length) {
    const file = queue.shift();
    const r = await thumbOne(file, ids);
    done++;
    if (!r.ok) failed++;
    console.log(`[${done}/${files.length}] ${r.ok ? 'ok  ' : 'FAIL'} ${file}: ${r.msg}`);
    await fs.writeFile(IDS, JSON.stringify(ids, null, 1) + '\n');
  }
}
await Promise.all(Array.from({ length: Math.min(opts.jobs, files.length) }, worker));
const count = await writeManifest();
console.log(`thumbs: ${count} thumbnail(s) in ${path.relative(ROOT, OUT)}; ${failed} failed.`);
process.exit(failed ? 1 : 0);
