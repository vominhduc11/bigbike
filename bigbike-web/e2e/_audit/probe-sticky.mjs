import { chromium } from "@playwright/test";
const BASE = process.env.BB_BASE || "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE + "/san-pham", { waitUntil: "load" });
await page.waitForTimeout(1500);
let url = await page.$$eval("a[href*='/product/']", (as) => as.map((a) => a.getAttribute("href")).find(Boolean));
if (url && url.startsWith("http")) url = new URL(url).pathname;
await page.goto(BASE + url, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(900);
const info = await page.evaluate(() => {
  const cta = document.querySelector(".bb-pdp-sticky-cta");
  const nav = document.querySelector(".bb-bottom-nav");
  const rootVar = getComputedStyle(document.documentElement).getPropertyValue("--bb-mobile-nav-height");
  if (!cta) return { err: "no cta" };
  const cs = getComputedStyle(cta);
  const c = cta.getBoundingClientRect();
  const n = nav ? nav.getBoundingClientRect() : null;
  return {
    navHeightVar: rootVar.trim(),
    computedBottom: cs.bottom,
    computedZ: cs.zIndex,
    isVisible: cta.classList.contains("is-visible"),
    ctaTop: Math.round(c.top), ctaBottom: Math.round(c.bottom),
    navTop: n ? Math.round(n.top) : null, navBottom: n ? Math.round(n.bottom) : null,
    ctaAboveNav: n ? c.bottom <= n.top + 1 : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
