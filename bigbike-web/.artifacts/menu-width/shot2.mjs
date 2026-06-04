import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 700 } });
await p.goto('http://localhost:3055/', { waitUntil: 'networkidle', timeout: 120000 });
const link = p.locator('header a', { hasText: 'TẤT CẢ SẢN PHẨM' }).first();
await link.hover();
await p.waitForFunction(() => { const d=document.querySelector('[data-dropdown]'); return d && getComputedStyle(d).opacity==='1'; }, { timeout: 10000 });
// hover each sidebar group button, measure dropdown box
const btns = p.locator('[data-dropdown] nav button');
const n = await btns.count();
for (let i = 0; i < n; i++) {
  const label = (await btns.nth(i).innerText()).replace(/\s+/g,' ').trim();
  await btns.nth(i).hover();
  await p.waitForTimeout(250);
  const box = await p.evaluate(() => { const d=document.querySelector('[data-dropdown]'); const r=d.getBoundingClientRect(); return {l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; });
  console.log(`[${i}] L=${box.l} W=${box.w} H=${box.h}  ${label}`);
}
// screenshot the densest (Áo quần)
const target = p.locator('[data-dropdown] nav button', { hasText: 'Áo quần' }).first();
await target.hover();
await p.waitForTimeout(300);
await p.screenshot({ path: '.artifacts/menu-width/menu-dense.png' });
console.log('saved menu-dense.png');
await b.close();
