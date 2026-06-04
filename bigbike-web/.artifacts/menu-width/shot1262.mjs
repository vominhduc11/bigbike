import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const w of [1262, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 700 } });
  await p.goto('http://localhost:3055/', { waitUntil: 'networkidle', timeout: 120000 });
  const link = p.locator('header a', { hasText: 'TẤT CẢ SẢN PHẨM' }).first();
  const vis = await link.isVisible();
  await link.hover();
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => { const d=document.querySelector('[data-dropdown]'); if(!d) return null; const r=d.getBoundingClientRect(); return {l:Math.round(r.left),w:Math.round(r.width),right:Math.round(r.right)}; });
  console.log(`w=${w} navVisible=${vis} drop=${JSON.stringify(m)}`);
  await p.close();
}
await b.close();
