import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 900 } });
await p.goto('http://localhost:3055/', { waitUntil: 'networkidle', timeout: 120000 });
await p.locator('header a', { hasText: 'TẤT CẢ SẢN PHẨM' }).first().hover();
await p.waitForFunction(() => { const d=document.querySelector('[data-dropdown]'); return d && getComputedStyle(d).opacity==='1'; }, { timeout: 10000 });
await p.waitForTimeout(400);
const m = await p.evaluate(() => {
  const d = document.querySelector('[data-dropdown]').getBoundingClientRect();
  const logo = document.querySelector('header a[href="/"], header img')?.getBoundingClientRect();
  const headerInner = document.querySelector('header > div')?.getBoundingClientRect();
  return { dropLeft: Math.round(d.left), dropW: Math.round(d.width), logoLeft: logo?Math.round(logo.left):null, headerInnerLeft: headerInner?Math.round(headerInner.left):null };
});
console.log('1920:', JSON.stringify(m));
await p.screenshot({ path: '.artifacts/menu-width/menu-1920.png' });
await b.close();
