import { chromium } from "@playwright/test";
const BASE = process.env.BB_BASE || "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE + "/san-pham", { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const btn = document.querySelector(".filter-mobile");
  if (!btn) return { found: false };
  const wrap = document.querySelector(".filter-mobile-wrapper");
  const r = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  const wcs = wrap ? getComputedStyle(wrap) : null;
  // what's at the button's center?
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const topEl = document.elementFromPoint(cx, cy);
  const toolbar = document.querySelector(".product-list-filter");
  const tcs = toolbar ? getComputedStyle(toolbar) : null;
  return {
    found: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    btn: { display: cs.display, visibility: cs.visibility, pointerEvents: cs.pointerEvents, opacity: cs.opacity },
    wrapper: wcs ? { display: wcs.display, pointerEvents: wcs.pointerEvents } : null,
    centerPoint: { cx: Math.round(cx), cy: Math.round(cy) },
    topElementAtCenter: topEl ? (topEl.className?.toString().slice(0, 80) || topEl.tagName) : "none",
    topElementIsButtonOrChild: topEl ? (btn === topEl || btn.contains(topEl) || topEl.contains(btn)) : false,
    toolbar: tcs ? { position: tcs.position, zIndex: tcs.zIndex, transform: tcs.transform } : null,
    innerH: window.innerHeight,
  };
});
console.log(JSON.stringify(info, null, 2));
// try clicking with trial
try {
  await page.click(".filter-mobile", { timeout: 6000, trial: true });
  console.log("TRIAL CLICK: actionable=YES");
} catch (e) {
  console.log("TRIAL CLICK: actionable=NO ->", String(e).split("\n")[0]);
}
// force-click and see if drawer opens
try {
  await page.click(".filter-mobile", { force: true, timeout: 5000 });
  await page.waitForTimeout(800);
  const open = await page.evaluate(() => { const el = document.querySelector(".sidebar-wrap-product"); return el ? el.classList.contains("active") : "no-el"; });
  console.log("FORCE CLICK -> drawer active:", open);
} catch (e) { console.log("FORCE CLICK err", String(e).split("\n")[0]); }
await browser.close();
