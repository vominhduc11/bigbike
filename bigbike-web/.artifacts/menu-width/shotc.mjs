import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 700 } });
await p.goto('http://localhost:3055/', { waitUntil: 'networkidle', timeout: 120000 });
await p.locator('header a', { hasText: 'TẤT CẢ SẢN PHẨM' }).first().hover();
await p.waitForFunction(() => { const d=document.querySelector('[data-dropdown]'); return d && getComputedStyle(d).opacity==='1'; }, { timeout: 10000 });
const groups = ['Mũ bảo hiểm','Phụ kiện khác'];
for (const g of groups) {
  await p.locator('[data-dropdown] nav button', { hasText: g }).first().hover();
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => { const d=document.querySelector('[data-dropdown]').getBoundingClientRect(); return {l:Math.round(d.left),r:Math.round(d.right),w:Math.round(d.width),center:Math.round((d.left+d.right)/2)}; });
  console.log(`${g}: L=${m.l} R=${m.r} W=${m.w} center=${m.center} (vw/2=683)`);
}
await p.locator('[data-dropdown] nav button', { hasText: 'Mũ bảo hiểm' }).first().hover();
await p.waitForTimeout(300);
await p.screenshot({ path: '.artifacts/menu-width/menu-centered.png' });
console.log('saved');
await b.close();
