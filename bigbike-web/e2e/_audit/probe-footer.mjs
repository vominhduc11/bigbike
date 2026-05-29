import { chromium } from "@playwright/test";
const BASE = process.env.BB_BASE || "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
for (const route of ["/gio-hang", "/tin-tuc"]) {
  await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const footer = document.querySelector("footer");
    const nav = document.querySelector(".bb-bottom-nav");
    // last meaningful footer content: the legal/copyright text block
    const legal = document.querySelector("footer .bb-container:last-of-type") || footer?.lastElementChild;
    const footerCs = footer ? getComputedStyle(footer) : null;
    const lastTextEl = Array.from(footer?.querySelectorAll("p,a,small,span") || []).filter(e => (e.textContent||"").trim().length > 8).pop();
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    const n = nav ? nav.getBoundingClientRect() : null;
    const lt = lastTextEl ? lastTextEl.getBoundingClientRect() : null;
    return {
      footerPadBottom: footerCs?.paddingBottom,
      navTop: n ? Math.round(n.top) : null,
      lastTextBottom: lt ? Math.round(lt.bottom) : null,
      lastText: lastTextEl ? (lastTextEl.textContent || "").trim().slice(0, 40) : null,
      coveredByNav: (lt && n) ? lt.bottom > n.top + 2 : null,
    };
  });
  console.log(route, JSON.stringify(info));
}
await browser.close();
