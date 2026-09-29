// Real-GPU frame rate check: loads the app page in installed Chrome with the
// GPU on and reports fps per scene. The headless render harness rasterises in
// software, which overstated batch 02 costs 3-10x (2026-09-27), so ship
// decisions on speed come from this, not from render.mjs timings.
// Usage: serve web/, then node harness/fps.mjs [--v2] http://localhost:PORT/ "Scene name" ...
// --v2 measures each family's V2 by seeding the version picker's memory.
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
const args = process.argv.slice(2);
const v2 = args[0] === '--v2'; if (v2) args.shift();
const [url, ...names] = args;
// harness/briefs/v2.md: web/scenes/v2/<id>.js registers '<id>v2' as versionOf '<id>'.
const families = v2 ? readdirSync(new URL('../web/scenes/v2/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)) : [];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 });
await page.addInitScript(fams => { for (const id of fams) localStorage.setItem('viz.version.' + id, JSON.stringify(id + 'v2')); }, families);
// 110+ scene scripts load in order; at 2.5 s the last ones were often not yet
// registered and read as "not found" (2026-09-28).
await page.goto(url); await page.waitForTimeout(9000);
const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
console.log('renderer:', gpu);
await page.keyboard.press('h'); // hide panel so the stage fills 1280x720
for (const n of names) {
  const r = await page.evaluate(async (n) => {
    const el = [...document.querySelectorAll('button, [role=button], li, div')].find(e => e.textContent.trim().replace(/\s*V\d$/, '').endsWith(n) && e.children.length <= 3 && e.closest('#visual-list, [id*=visual], nav, ul, section'));
    if (!el) return 'not found'; el.click();
    await new Promise(r => setTimeout(r, 1500));
    const ts = []; await new Promise(res => { const t0 = performance.now(); (function f(t){ ts.push(t); if (t - t0 < 5000) requestAnimationFrame(f); else res(); })(t0); });
    const d = ts.slice(1).map((t,i) => t - ts[i]).sort((a,b)=>a-b);
    const c = document.querySelector('canvas');
    return { fps: +(d.length / (ts.at(-1)-ts[0]) * 1000).toFixed(1), p95: +d[Math.floor(d.length*0.95)].toFixed(1), canvas: c.width+'x'+c.height };
  }, n);
  console.log(n.padEnd(14), JSON.stringify(r));
}
await browser.close();
