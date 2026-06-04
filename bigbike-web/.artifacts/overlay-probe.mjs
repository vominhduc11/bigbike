import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3018";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => { const t = document.querySelector(".bb-menu-toggle"); if (t) t.click(); });
await page.waitForSelector(".bb-mobile-header-panel.is-open");
await page.waitForTimeout(700);
const info = await page.evaluate(() => {
  const ov = document.querySelector(".bb-mobile-header-overlay");
  const panel = document.querySelector(".bb-mobile-header-panel");
  const drawer = document.querySelector(".bb-mobile-header-drawer");
  const cs = ov ? getComputedStyle(ov) : null;
  const dr = drawer.getBoundingClientRect();
  // what element is at a point in the right "outside" strip
  const outsideX = Math.min(355, Math.round(dr.right) + 15);
  const elAtOutside = document.elementFromPoint(outsideX, 400);
  const elClasses = (el) => el ? (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) : null;
  return {
    overlayExists: !!ov,
    overlayDisplay: cs?.display,
    overlayOpacity: cs?.opacity,
    overlayBg: cs?.backgroundColor,
    overlayZ: cs?.zIndex,
    overlayRect: ov ? { w: Math.round(ov.getBoundingClientRect().width), h: Math.round(ov.getBoundingClientRect().height) } : null,
    panelZ: getComputedStyle(panel).zIndex,
    panelBg: getComputedStyle(panel).backgroundColor,
    panelPointerEvents: getComputedStyle(panel).pointerEvents,
    drawerWidth: Math.round(dr.width),
    drawerRight: Math.round(dr.right),
    outsideX,
    elementAtOutside: elAtOutside ? `${elAtOutside.tagName}.${elClasses(elAtOutside)}` : null,
    overlayIsOpen: ov?.classList.contains("is-open"),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: ".artifacts/overlay-open.png" });
await browser.close();
