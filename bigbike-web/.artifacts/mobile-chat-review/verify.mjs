import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3013";
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
await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });

await page.waitForSelector("#sudovn-btn-wrapper button", { state: "visible", timeout: 15000 });
await page.waitForTimeout(1300);

const closed = await page.evaluate(() => {
  const b = document.querySelector("#sudovn-btn-wrapper button").getBoundingClientRect();
  return { w: Math.round(b.width), h: Math.round(b.height), right: Math.round(innerWidth - b.right), bottom: Math.round(innerHeight - b.bottom) };
});
await page.screenshot({ path: `${OUT}/new-closed.png` });

const DIALOG = '[role="dialog"][aria-label="Liên hệ hỗ trợ"]';
await page.click("#sudovn-btn-wrapper button");
await page.waitForSelector(DIALOG, { state: "visible", timeout: 6000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/new-open.png` });

const open = await page.evaluate((DIALOG) => {
  const fab = document.querySelector('button[aria-label="Đóng hỗ trợ"]')?.getBoundingClientRect();
  const panel = document.querySelector(DIALOG)?.getBoundingClientRect();
  const cs = getComputedStyle(document.querySelector(DIALOG));
  const rows = Array.from(document.querySelectorAll(`${DIALOG} a`)).map((a) => {
    const label = a.querySelector("span:last-child");
    return {
      text: a.innerText.replace(/\s+/g, " ").trim(),
      clipped: label ? label.scrollWidth > label.clientWidth + 1 : null,
    };
  });
  return {
    fab: fab ? { w: Math.round(fab.width), h: Math.round(fab.height), right: Math.round(innerWidth - fab.right), bottom: Math.round(innerHeight - fab.bottom) } : null,
    panelW: panel ? Math.round(panel.width) : null,
    radius: cs.borderRadius,
    bg: cs.backgroundColor,
    rows,
  };
}, DIALOG);

// tap backdrop (top-left, away from panel/fab) → should close now
await page.mouse.click(40, 110);
await page.waitForTimeout(400);
const closedAfterBackdropTap = (await page.$(DIALOG)) === null;

const jump = closed && open.fab
  ? { sizeChanged: closed.w !== open.fab.w, bottomDelta: Math.abs(closed.bottom - open.fab.bottom), rightDelta: Math.abs(closed.right - open.fab.right) }
  : null;

console.log("closed FAB:", JSON.stringify(closed));
console.log("open:", JSON.stringify(open, null, 2));
console.log("jump (want sizeChanged:false, deltas ~0):", JSON.stringify(jump));
console.log("closedAfterBackdropTap (want true):", closedAfterBackdropTap);

await browser.close();
