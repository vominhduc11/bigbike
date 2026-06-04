import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3018";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
await p.waitForSelector(".bb-mobile-header-panel.is-open");
await p.waitForTimeout(500);
const r = await p.evaluate(() => {
  const pick = (sel) => { const el=document.querySelector(sel); if(!el) return null; const c=getComputedStyle(el); const rc=el.getBoundingClientRect(); return { position:c.position, top:c.top, right:c.right, bottom:c.bottom, left:c.left, inset:c.inset, height:c.height, width:c.width, rectW:Math.round(rc.width), rectH:Math.round(rc.height), rectTop:Math.round(rc.top) }; };
  return { overlay: pick(".bb-mobile-header-overlay"), panel: pick(".bb-mobile-header-panel"), headerVar: getComputedStyle(document.documentElement).getPropertyValue("--bb-header-height") };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
