import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto("http://localhost:3018", { waitUntil: "networkidle" });
const r = await p.evaluate(() => {
  const h = document.querySelector(".bb-site-header");
  const c = getComputedStyle(h);
  return { backdropFilter: c.backdropFilter, webkitBackdropFilter: c.webkitBackdropFilter, transform: c.transform, height: c.height, position: c.position };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
