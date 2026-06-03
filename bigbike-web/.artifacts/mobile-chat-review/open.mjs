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

await page.waitForSelector("#sudovn-btn-wrapper button", { state: "visible", timeout: 8000 });
await page.waitForTimeout(1200);

const closed = await page.evaluate(() => {
  const b = document.querySelector("#sudovn-btn-wrapper button").getBoundingClientRect();
  return { w: Math.round(b.width), h: Math.round(b.height), right: Math.round(innerWidth - b.right), bottom: Math.round(innerHeight - b.bottom) };
});

// Open it
const DIALOG = '[role="dialog"][aria-label="Liên hệ hỗ trợ"]';
await page.click("#sudovn-btn-wrapper button");
await page.waitForSelector(DIALOG, { state: "visible", timeout: 5000 });
await page.waitForTimeout(700);

await page.screenshot({ path: `${OUT}/open-full.png` });

const open = await page.evaluate((DIALOG) => {
  const fab = document.querySelector('button[aria-label="Đóng hỗ trợ"]')?.getBoundingClientRect();
  const panel = document.querySelector(DIALOG)?.getBoundingClientRect();
  const rows = Array.from(document.querySelectorAll(`${DIALOG} a`));
  const rowH = rows[0]?.getBoundingClientRect().height ?? null;
  const panelCs = document.querySelector(DIALOG) ? getComputedStyle(document.querySelector(DIALOG)) : null;
  return {
    fab: fab ? { w: Math.round(fab.width), h: Math.round(fab.height), right: Math.round(innerWidth - fab.right), bottom: Math.round(innerHeight - fab.bottom) } : null,
    panel: panel ? { w: Math.round(panel.width), left: Math.round(panel.left), top: Math.round(panel.top), bottom: Math.round(innerHeight - panel.bottom) } : null,
    rowCount: rows.length,
    rowHeight: rowH ? Math.round(rowH) : null,
    panelRadius: panelCs?.borderRadius ?? null,
    panelFont: panelCs?.fontFamily ?? null,
  };
}, DIALOG);

// Does tapping the backdrop (outside panel/fab) close it?  Tap top-left area.
await page.mouse.click(40, 120);
await page.waitForTimeout(400);
const stillOpenAfterBackdropTap = (await page.$(DIALOG)) !== null;

console.log("closed FAB:", JSON.stringify(closed));
console.log("open  state:", JSON.stringify(open, null, 2));
console.log("stillOpenAfterBackdropTap:", stillOpenAfterBackdropTap);

await browser.close();
