import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
await p.waitForSelector(".bb-mobile-header-panel.is-open");
await p.waitForTimeout(700);
const open = await p.evaluate(() => {
  const ov = document.querySelector(".bb-mobile-header-overlay");
  const dr = document.querySelector(".bb-mobile-header-drawer").getBoundingClientRect();
  const outsideX = Math.round(dr.right) + 15;
  const el = document.elementFromPoint(outsideX, 400);
  return {
    overlayH: Math.round(ov.getBoundingClientRect().height),
    overlayW: Math.round(ov.getBoundingClientRect().width),
    drawerRight: Math.round(dr.right),
    outsideX,
    elAtOutside: el ? (el.className?.baseVal ?? el.className) : null,
  };
});
// tap outside (the strip beside the drawer) and check it closes
await p.mouse.click(open.outsideX, 400);
await p.waitForTimeout(600);
const closed = await p.evaluate(() => !document.querySelector(".bb-mobile-header-panel")?.classList.contains("is-open"));
// also confirm a drawer link is still clickable (interactive)
await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
await p.waitForTimeout(500);
const drawerInteractive = await p.evaluate(() => {
  const link = document.querySelector(".bb-mobile-header-drawer nav a");
  const r = link.getBoundingClientRect();
  const el = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + r.height/2));
  return el ? (el.closest("a") ? "link-hit" : el.tagName) : "null";
});
console.log(JSON.stringify({ open, closesOnOutsideTap: closed, drawerInteractive }, null, 2));
await b.close();
