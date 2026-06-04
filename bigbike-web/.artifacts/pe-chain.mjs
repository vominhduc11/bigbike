import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.reload({ waitUntil: "networkidle" });
await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
await p.waitForSelector(".bb-mobile-header-panel.is-open");
await p.waitForTimeout(700);
const r = await p.evaluate(() => {
  const pe = (sel) => { const el=document.querySelector(sel); return el?getComputedStyle(el).pointerEvents:"NF"; };
  const link = document.querySelector(".bb-mobile-header-drawer nav a");
  // walk from link up to panel logging pe
  const walk = [];
  let cur = link;
  while (cur && !cur.classList.contains("bb-mobile-header-panel")) {
    walk.push((cur.tagName.toLowerCase()) + "[" + (cur.className?.baseVal ?? (typeof cur.className==='string'?cur.className.split(' ')[0]:'') ) + "]=" + getComputedStyle(cur).pointerEvents);
    cur = cur.parentElement;
  }
  return {
    panel: pe(".bb-mobile-header-panel"),
    drawer: pe(".bb-mobile-header-drawer"),
    nav: pe(".bb-mobile-header-drawer nav"),
    firstLink: pe(".bb-mobile-header-drawer nav a"),
    walkFromLink: walk,
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
