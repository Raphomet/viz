// Real-GPU frame rate check: loads the app page in installed Chrome with the
// GPU on and reports fps per scene. The headless render harness rasterises in
// software, which overstated batch 02 costs 3-10x (2026-09-27), so ship
// decisions on speed come from this, not from render.mjs timings.
// Usage: serve web/, then node harness/fps.mjs http://localhost:PORT/ "Scene name" ...
import { chromium } from 'playwright';
const url = process.argv[2];
const names = process.argv.slice(3);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 });
await page.goto(url); await page.waitForTimeout(2500);
const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
console.log('renderer:', gpu);
await page.keyboard.press('h'); // hide panel so the stage fills 1280x720
for (const n of names) {
  const r = await page.evaluate(async (n) => {
    const el = [...document.querySelectorAll('button, [role=button], li, div')].find(e => e.textContent.trim().endsWith(n) && e.children.length <= 3 && e.closest('#visual-list, [id*=visual], nav, ul, section'));
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
