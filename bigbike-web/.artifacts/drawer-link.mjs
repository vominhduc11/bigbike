import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
await p.waitForSelector(".bb-mobile-header-panel.is-open");
await p.waitForTimeout(700);
// find the "Tin tức" link in the drawer and click it
const target = await p.evaluate(() => {
  const links = [...document.querySelectorAll(".bb-mobile-header-drawer nav a")];
  const tt = links.find(a => /tin t/i.test(a.textContent));
  if (!tt) return null;
  const r = tt.getBoundingClientRect();
  const cx = Math.round(r.left + r.width/2), cy = Math.round(r.top + r.height/2);
  const el = document.elementFromPoint(cx, cy);
  return { text: tt.textContent.trim(), href: tt.getAttribute("href"), cx, cy, hitIsThisLink: el?.closest("a") === tt, pe: getComputedStyle(tt).pointerEvents };
});
let navigated = false;
if (target) {
  await p.mouse.click(target.cx, target.cy);
  await p.waitForTimeout(900);
  navigated = p.url().includes("/tin-tuc") || p.url() !== BASE + "/";
}
console.log(JSON.stringify({ target, urlAfter: p.url(), navigated }, null, 2));
await b.close();
