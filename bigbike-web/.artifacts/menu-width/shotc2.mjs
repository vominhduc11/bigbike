import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 700 } });
await p.goto('http://localhost:3055/', { waitUntil: 'networkidle', timeout: 120000 });
await p.locator('header a', { hasText: 'TẤT CẢ SẢN PHẨM' }).first().hover();
await p.waitForFunction(() => { const d=document.querySelector('[data-dropdown]'); return d && getComputedStyle(d).opacity==='1'; }, { timeout: 10000 });
await p.waitForTimeout(400);
await p.screenshot({ path: '.artifacts/menu-width/menu-centered.png' });
// also the wide group: hover Phu kien khac then screenshot quickly without leaving
await p.locator('[data-dropdown] nav button', { hasText: 'Phụ kiện khác' }).first().hover();
await p.waitForTimeout(350);
await p.screenshot({ path: '.artifacts/menu-width/menu-centered-wide.png' });
console.log('saved both');
await b.close();
