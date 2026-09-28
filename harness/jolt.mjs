#!/usr/bin/env node
// Jolt meter: how much of the frame does a kick disturb, compared with the
// scene's ordinary motion? Written after Raph's 2026-09-28 feedback that the
// batch 02 scenes were too "pulsey" — a full-frame flash, zoom punch or global
// glow on every kick is jarring over a whole set, even when each one looks
// good on a contact sheet. See README.md, "Jolt meter".
//
//   node harness/jolt.mjs web/scenes/foo.js [--size 640x360] [--seed 1]
//     [--params '{"k":v}'] [--out harness/renders/jolt/foo]

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HARNESS_DIR, REPO_ROOT, FPS, serve, launch, openStage, pngBuffer } from './lib.mjs';

// Guidance, not law: a starting point calibrated on 2026-09-28 against the
// scenes Raph called too pulsey (iris, rave, mandala, abyss) and the ones he
// found calm (current, interference). Retune here, and say why in the README,
// when his judgement of a new batch disagrees with the verdicts.
//
// Calibration changed the brief's first cut (calm = area <= 0.25 and ratio <= 3)
// in one way: Interference's fine moving line texture changes ~35% of the frame
// every 0.15 s whether or not a kick lands, so area alone called a calm scene
// "noticeable". What it lacks is a kick-shaped change: its ratio sits at ~1.2,
// the pulsey scenes at 1.7-2.3. So a scene whose kick disturbs no more than
// its own motion does (ratio <= calmRatio) is calm at any area.
const JOLT_THRESHOLDS = {
  deltaL: 0.06,          // a block counts as "disturbed" when its luminance moves more than this
  driftFloor: 0.002,     // ratio denominator floor, so a near-static scene does not divide by ~0
  calm: { area: 0.25, ratio: 3 },   // at most this much of the frame, and at most 3x ordinary motion...
  calmRatio: 1.4,                   // ...or, at any area, no more than 1.4x the scene's ordinary motion
  noticeable: { area: 0.45 }        // above this fraction of the frame, a kick is "jarring"
};

// Luminance is compared in blocks of 1/45 of the short side (8 px at 640x360),
// not per pixel. A pulse is a regional change in brightness; per pixel, a
// thin line drifting by its own width reads as a 100% change, which made
// busy-but-steady textures look as jolting as a full-frame flash.
const BLOCKS_ON_SHORT_SIDE = 45;

// Kicks the meter measures, on the track's grid (DROP + n * 60/124 s). Each is
// compared from ~2 frames before the onset to every frame in the following
// 0.165 s, and its drift is the next 0.15 s, which has no kick in it.
const BEAT = 60 / 124;
const KICKS = [
  { name: 'build', t: 10 - BEAT },        // 9.516 s: kick at ~80% gain, under the snare roll and riser
  { name: 'drop 1', t: 10 + 4 * BEAT },   // 11.935 s: downbeat of the drop's second bar
  { name: 'drop 2', t: 10 + 7 * BEAT }    // 13.387 s: beat 4, so a clap lands with it
];
const PRE_LEAD = 0.035, POST_SPAN = 0.165, DRIFT_SPAN = 0.15;

function usage(msg) {
  if (msg) console.error('jolt: ' + msg);
  console.error("usage: node harness/jolt.mjs <scene.js> [--size WxH] [--seed N] [--params '{\"k\":v}'] [--out dir]");
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { size: '640x360', seed: '1', params: null, out: null };
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
  if (!m) usage('--size must look like 640x360');
  if (opts.params) {
    try { JSON.parse(opts.params); } catch { usage('--params is not valid JSON'); }
  }
  const id = path.basename(scenePath).replace(/\.m?js$/, '');
  return {
    scenePath, sceneUrl: '/' + rel.split(path.sep).join('/'), width: +m[1], height: +m[2],
    seed: String(opts.seed), params: opts.params, density: 1,
    out: path.resolve(opts.out ?? path.join(HARNESS_DIR, 'renders', 'jolt', id))
  };
}

// Frame numbers for one kick. The pre frame rounds to just before the onset
// (11.935 s -> frame 714 = 11.90 s); the first post frame is the first one
// drawn at or after it (frame 717 = 11.95 s).
function plan(k) {
  const pre = Math.round((k.t - PRE_LEAD) * FPS);
  const first = Math.ceil(k.t * FPS - 1e-6);
  const last = Math.round((k.t + POST_SPAN) * FPS);
  const post = [];
  for (let f = first; f <= last; f++) post.push(f);
  return { ...k, pre, post, driftA: last, driftB: last + Math.round(DRIFT_SPAN * FPS) };
}

// Installed in the page. Luminance is Rec.709 weights on the gamma-encoded
// channels (luma, 0-1): closer to how bright a change *looks* than linear
// light, which would under-count changes in the dark scenes most of these are.
function installJolt([threshold, blocksOnShortSide]) {
  const cw = HARNESS.canvas().width, ch = HARNESS.canvas().height;
  const B = Math.max(1, Math.round(Math.min(cw, ch) / blocksOnShortSide));
  const gw = Math.ceil(cw / B), gh = Math.ceil(ch / B);
  // Pixels per block, so the partial blocks at the right and bottom edges
  // count for only the area they cover.
  const weight = new Float32Array(gw * gh);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) weight[((y / B) | 0) * gw + ((x / B) | 0)]++;
  function grab() {
    const c = HARNESS.canvas();
    const d = c.getContext('2d').getImageData(0, 0, cw, ch).data;
    const L = new Float32Array(gw * gh);
    for (let y = 0, j = 0; y < ch; y++) {
      const row = ((y / B) | 0) * gw;
      for (let x = 0; x < cw; x++, j += 4) L[row + ((x / B) | 0)] += (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
    }
    for (let i = 0; i < L.length; i++) L[i] /= weight[i];
    const copy = document.createElement('canvas');
    copy.width = c.width; copy.height = c.height;
    copy.getContext('2d').drawImage(c, 0, 0);
    return { L, img: copy, frame: HARNESS.frame };
  }
  function diff(a, b) {
    let over = 0, sum = 0;
    for (let i = 0; i < a.L.length; i++) {
      const v = Math.abs(a.L[i] - b.L[i]);
      sum += v * weight[i];
      if (v > threshold) over += weight[i];
    }
    return { area: over / (cw * ch), mean: sum / (cw * ch) };
  }
  // Black -> violet -> red -> amber -> near-white, full scale at |ΔL| = 0.3, so
  // anything past the disturbance threshold (0.06) already reads as colour.
  const STOPS = [[0, 0, 0, 0], [0.2, 70, 20, 110], [0.45, 200, 40, 60], [0.75, 250, 160, 30], [1, 255, 250, 220]];
  function heatColor(v) {
    const t = Math.min(1, v / 0.3);
    for (let s = 1; s < STOPS.length; s++) {
      if (t <= STOPS[s][0]) {
        const a = STOPS[s - 1], b = STOPS[s], u = (t - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
      }
    }
    return STOPS[STOPS.length - 1].slice(1);
  }
  const rows = [];
  let pre = null, best = null, driftA = null;
  window.JOLT = {
    pre(f) { HARNESS.stepTo(f); pre = grab(); best = null; },
    post(f) {
      HARNESS.stepTo(f);
      const g = grab(), d = diff(pre, g);
      // "Largest difference" is judged by mean |ΔL|; area is reported from the same frame.
      if (!best || d.mean > best.d.mean) best = { g, d };
      return d;
    },
    driftA(f) { HARNESS.stepTo(f); driftA = grab(); },
    driftB(f) { HARNESS.stepTo(f); return diff(driftA, grab()); },
    finishKick(label) {
      rows.push({ label, pre, best });
      return { worstFrame: best.g.frame, area: best.d.area, mean: best.d.mean };
    },
    heatPng() {
      const w = cw, h = ch, gap = 8, lab = 26;
      const out = document.createElement('canvas');
      out.width = 3 * w + 4 * gap;
      out.height = rows.length * (h + lab + gap) + gap;
      const c = out.getContext('2d');
      c.fillStyle = '#111317';
      c.fillRect(0, 0, out.width, out.height);
      rows.forEach((r, i) => {
        const y = gap + i * (h + lab + gap);
        // One heat cell per block, drawn at block size: the map shows exactly what was measured.
        const small = document.createElement('canvas');
        small.width = gw; small.height = gh;
        const sc = small.getContext('2d'), heat = sc.createImageData(gw, gh);
        for (let p = 0, j = 0; p < r.pre.L.length; p++, j += 4) {
          const col = heatColor(Math.abs(r.pre.L[p] - r.best.g.L[p]));
          heat.data[j] = col[0]; heat.data[j + 1] = col[1]; heat.data[j + 2] = col[2]; heat.data[j + 3] = 255;
        }
        sc.putImageData(heat, 0, 0);
        c.drawImage(r.pre.img, gap, y + lab);
        c.drawImage(r.best.g.img, 2 * gap + w, y + lab);
        c.imageSmoothingEnabled = false;
        c.drawImage(small, 3 * gap + 2 * w, y + lab, gw * B, gh * B);
        c.imageSmoothingEnabled = true;
        c.fillStyle = '#e8ecf0';
        c.font = '600 13px Menlo, Monaco, monospace';
        c.textBaseline = 'middle';
        const f = n => (n / 60).toFixed(2) + 's';
        c.fillText(r.label + ' · before ' + f(r.pre.frame), gap + 2, y + lab / 2);
        c.fillText('worst after · ' + f(r.best.g.frame), 2 * gap + w + 2, y + lab / 2);
        c.fillText('|ΔL| · area ' + r.best.d.area.toFixed(2) + ' · mean ' + r.best.d.mean.toFixed(3),
          3 * gap + 2 * w + 2, y + lab / 2);
      });
      return out.toDataURL('image/png');
    }
  };
}

function verdictFor(area, ratio) {
  const T = JOLT_THRESHOLDS;
  if (ratio <= T.calmRatio || (area <= T.calm.area && ratio <= T.calm.ratio)) return 'calm';
  if (area <= T.noticeable.area) return 'noticeable';
  return 'jarring';
}

const r3 = x => Math.round(x * 1000) / 1000;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  await fs.mkdir(o.out, { recursive: true });
  const server = await serve();
  const { browser } = await launch(usage);
  const log = { console: [], exceptions: [], failedRequests: [] };
  let result;
  try {
    const { page, info } = await openStage(browser, server.address().port, o, log);
    await page.evaluate(installJolt, [JOLT_THRESHOLDS.deltaL, BLOCKS_ON_SHORT_SIDE]);
    const kicks = [];
    for (const k of KICKS.map(plan)) {
      await page.evaluate(f => JOLT.pre(f), k.pre);
      for (const f of k.post) await page.evaluate(f => JOLT.post(f), f);
      const kick = await page.evaluate(l => JOLT.finishKick(l), `${k.name} kick ${k.t.toFixed(3)}s`);
      await page.evaluate(f => JOLT.driftA(f), k.driftA);
      const drift = await page.evaluate(f => JOLT.driftB(f), k.driftB);
      const ratio = kick.mean / Math.max(drift.mean, JOLT_THRESHOLDS.driftFloor);
      kicks.push({
        name: k.name, kickAt: r3(k.t), preT: r3(k.pre / FPS), worstT: r3(kick.worstFrame / FPS),
        driftFrom: r3(k.driftA / FPS), driftTo: r3(k.driftB / FPS),
        kickArea: r3(kick.area), kickMean: r3(kick.mean), driftArea: r3(drift.area), driftMean: r3(drift.mean),
        ratio: Math.round(ratio * 100) / 100
      });
    }
    const heatFile = path.join(o.out, 'heat.png');
    await fs.writeFile(heatFile, pngBuffer(await page.evaluate(() => JOLT.heatPng())));
    const drawErrors = await page.evaluate(() => HARNESS.drawErrors);

    // The verdict rests on the drop, where the kick is at full strength and
    // the scene is in the state it spends most of a set in; the build kick is
    // reported alongside for scenes whose build behaves differently.
    const drop = kicks.filter(k => k.name.startsWith('drop'));
    const avg = key => drop.reduce((s, k) => s + k[key], 0) / drop.length;
    const kickArea = avg('kickArea'), kickMean = avg('kickMean'), driftMean = avg('driftMean');
    const ratio = kickMean / Math.max(driftMean, JOLT_THRESHOLDS.driftFloor);
    result = {
      scene: path.relative(REPO_ROOT, o.scenePath), id: info.id, name: info.name,
      size: { width: o.width, height: o.height }, seed: o.seed, params: info.params,
      thresholds: JOLT_THRESHOLDS,
      drop: { kickArea: r3(kickArea), kickMean: r3(kickMean), driftArea: r3(avg('driftArea')), driftMean: r3(driftMean),
        ratio: Math.round(ratio * 100) / 100 },
      verdict: verdictFor(kickArea, ratio),
      kicks, heat: heatFile, drawErrors,
      consoleErrors: log.console.filter(m => m.type === 'error').map(m => m.text),
      exceptions: log.exceptions, failedRequests: log.failedRequests
    };
  } catch (e) {
    result = { scene: path.relative(REPO_ROOT, o.scenePath), failed: String(e.message || e),
      consoleErrors: log.console.filter(m => m.type === 'error').map(m => m.text), exceptions: log.exceptions };
  } finally {
    await browser.close();
    server.close();
  }

  const jsonFile = path.join(o.out, 'jolt.json');
  await fs.writeFile(jsonFile, JSON.stringify(result, null, 2) + '\n');
  const rel = p => { const r = path.relative(process.cwd(), p); return r.startsWith('..') ? p : r; };
  if (result.failed) {
    console.log(`jolt FAILED for ${result.scene}: ${result.failed}. Report: ${rel(jsonFile)}.`);
    process.exit(1);
  }
  const d = result.drop, b = result.kicks.find(k => k.name === 'build'), T = JOLT_THRESHOLDS;
  console.log(
    `${result.id}: ${result.verdict.toUpperCase()} — drop kicks disturb ${Math.round(d.kickArea * 100)}% of the frame ` +
    `(kickArea ${d.kickArea}, kickMean ${d.kickMean}) vs drift ${d.driftMean} → ratio ${d.ratio}; ` +
    `build kick area ${b.kickArea}, ratio ${b.ratio}. ` +
    `[calm: ratio ≤ ${T.calmRatio}, or area ≤ ${T.calm.area} and ratio ≤ ${T.calm.ratio}; noticeable: area ≤ ${T.noticeable.area}; else jarring] ` +
    `${rel(result.heat)}, ${rel(jsonFile)}` +
    (result.consoleErrors.length + result.exceptions.length + result.drawErrors
      ? ` — PROBLEMS: ${result.consoleErrors.length} console error(s), ${result.exceptions.length} exception(s), ${result.drawErrors} draw error(s)`
      : '')
  );
  if (result.consoleErrors.length + result.exceptions.length + result.drawErrors) process.exitCode = 1;
}

main().catch(e => { console.error('jolt: ' + (e.stack || e)); process.exit(1); });
