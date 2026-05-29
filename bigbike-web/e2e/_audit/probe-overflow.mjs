import { chromium } from "@playwright/test";
const BASE = process.env.BB_BASE || "http://localhost:3001";
const VPS = [[320, 568], [375, 812], [414, 896], [430, 932]];
const ROUTES = ["/", "/san-pham", "/danh-muc-san-pham", "/product/tui-chong-nuoc-ilm-bl01/", "/gio-hang", "/thanh-toan", "/tim-kiem?s=ao", "/brands", "/dang-nhap"];
const browser = await chromium.launch();
let problems = 0;
for (const [w, h] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      await page.evaluate(async () => { await new Promise((r)=>{let y=0;const s=()=>{window.scrollTo(0,y);y+=window.innerHeight;if(y<document.body.scrollHeight)requestAnimationFrame(s);else r();};s();}); });
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      const over = o.sw - o.cw;
      if (over > 1) { console.log(`OVERFLOW ${w}x${h} ${route}: scrollWidth ${o.sw} > clientWidth ${o.cw} (+${over})`); problems++; }
    } catch (e) { console.log(`ERR ${w}x${h} ${route}: ${String(e).slice(0,60)}`); }
  }
  await ctx.close();
  console.log(`[${w}x${h}] done`);
}
await browser.close();
console.log(problems === 0 ? "\nRESULT: no horizontal overflow at any mobile width ✓" : `\nRESULT: ${problems} overflow problems`);
