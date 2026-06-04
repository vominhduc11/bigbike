import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3020";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });

async function openMenu() {
  await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
  await p.waitForSelector(".bb-mobile-header-panel.is-open");
  await p.waitForTimeout(600);
}
await openMenu();

// 1) overlay full-size dim
const overlay = await p.evaluate(() => {
  const ov = document.querySelector(".bb-mobile-header-overlay");
  const r = ov.getBoundingClientRect();
  return { h: Math.round(r.height), w: Math.round(r.width), bg: getComputedStyle(ov).backgroundColor };
});

// 2) drawer link clickable -> navigate
const linkInfo = await p.evaluate(() => {
  const a = [...document.querySelectorAll(".bb-mobile-header-drawer nav a")].find(x=>/tin t/i.test(x.textContent));
  const r = a.getBoundingClientRect();
  const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  const el = document.elementFromPoint(cx,cy);
  return { cx, cy, hitsLink: el?.closest("a")?.getAttribute("href"), pe: getComputedStyle(a).pointerEvents };
});
await p.mouse.click(linkInfo.cx, linkInfo.cy);
await p.waitForTimeout(900);
const navigated = p.url();

// reset to home & reopen for close-on-outside test
await p.goto(BASE, { waitUntil: "networkidle" });
await openMenu();
const closeTest = await p.evaluate(() => {
  const dr = document.querySelector(".bb-mobile-header-drawer").getBoundingClientRect();
  return { outsideX: Math.round(dr.right)+15 };
});
await p.mouse.click(closeTest.outsideX, 400);
await p.waitForTimeout(600);
const closedOnOutside = await p.evaluate(() => !document.querySelector(".bb-mobile-header-panel")?.classList.contains("is-open"));

console.log(JSON.stringify({
  overlay,
  drawerLink: { pointerEvents: linkInfo.pe, elementAtCenterHref: linkInfo.hitsLink, urlAfterClick: navigated, navigated: navigated.includes("tin-tuc") },
  closedOnOutsideTap: closedOnOutside,
}, null, 2));
await b.close();
