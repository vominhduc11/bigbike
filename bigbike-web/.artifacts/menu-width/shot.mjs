import { chromium } from '@playwright/test';
const url = 'http://localhost:3055/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 700 } });
p.on('console', m => { if (m.type()==='error') console.log('PAGE-ERR:', m.text()); });
await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
// find the nav item with "TẤT CẢ"
const link = p.locator('header a', { hasText: 'TẤT CẢ SẢN PHẨM' }).first();
await link.waitFor({ state: 'visible', timeout: 30000 });
await link.hover();
// wait for dropdown visible (opacity 1)
await p.waitForFunction(() => {
  const d = document.querySelector('[data-dropdown]');
  if (!d) return false;
  return getComputedStyle(d).opacity === '1';
}, { timeout: 10000 }).catch(()=>console.log('dropdown not visible'));
await p.waitForTimeout(500);
// measure
const box = await p.evaluate(() => {
  const d = document.querySelector('[data-dropdown]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
});
console.log('DROPDOWN BOX:', JSON.stringify(box));
await p.screenshot({ path: '.artifacts/menu-width/menu-1366.png' });
console.log('saved .artifacts/menu-width/menu-1366.png');
await b.close();
