import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/mobile-chat-review";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });

// Wait for the floating chat FAB to mount + finish its 1s entrance pop.
let chatVisible = false;
try {
  await page.waitForSelector("#sudovn-btn-wrapper", { state: "visible", timeout: 8000 });
  chatVisible = true;
} catch {
  chatVisible = false;
}
await page.waitForTimeout(1500);

// Full mobile viewport at the top of the homepage.
await page.screenshot({ path: `${OUT}/top.png` });

// Close-up of the bottom-right corner (chat FAB + bottom nav).
await page.screenshot({
  path: `${OUT}/corner.png`,
  clip: { x: 200, y: 560, width: 190, height: 284 },
});

// Report the real rendered geometry of the FAB button.
const geo = await page.evaluate(() => {
  const btn = document.querySelector("#sudovn-btn-wrapper button");
  const nav = document.querySelector(".bb-bottom-nav");
  const r = btn?.getBoundingClientRect();
  const n = nav?.getBoundingClientRect();
  const cs = btn ? getComputedStyle(btn) : null;
  return {
    button: r ? { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom) } : null,
    bg: cs?.backgroundColor ?? null,
    navTopGapFromButton: r && n ? Math.round(n.top - r.bottom) : null,
    viewport: { w: innerWidth, h: innerHeight },
  };
});

console.log("chatVisible:", chatVisible);
console.log(JSON.stringify(geo, null, 2));

await browser.close();
