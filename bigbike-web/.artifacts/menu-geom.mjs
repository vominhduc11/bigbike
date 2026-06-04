import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3018";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => { const t = document.querySelector(".bb-menu-toggle"); if (t) t.click(); });
await page.waitForSelector(".bb-mobile-header-panel.is-open");
await page.waitForTimeout(700);
function geom() {
  const drawer = document.querySelector(".bb-mobile-header-drawer");
  const head = document.querySelector(".bb-mobile-drawer-head");
  const logo = document.querySelector(".bb-mobile-drawer-head img");
  const panel = document.querySelector(".bb-mobile-header-panel");
  const cs = getComputedStyle(drawer);
  const csh = getComputedStyle(head);
  return {
    winScrollY: Math.round(window.scrollY),
    panelTop: Math.round(panel.getBoundingClientRect().top),
    drawerTop: +drawer.getBoundingClientRect().top.toFixed(2),
    drawerTransform: cs.transform,
    drawerJustify: cs.justifyContent,
    drawerAlign: cs.alignItems,
    headTop: +head.getBoundingClientRect().top.toFixed(2),
    headPadTop: csh.paddingTop,
    headMinH: csh.minHeight,
    headHeight: +head.getBoundingClientRect().height.toFixed(2),
    logoTop: +logo.getBoundingClientRect().top.toFixed(2),
    logoH: +logo.getBoundingClientRect().height.toFixed(2),
  };
}
const before = await page.evaluate(geom);
await page.evaluate(() => { const b = document.querySelector('.bb-mobile-header-drawer nav button[aria-expanded="false"]'); b && b.click(); });
await page.waitForTimeout(500);
const after = await page.evaluate(geom);
console.log(JSON.stringify({ before, after }, null, 2));
await browser.close();
