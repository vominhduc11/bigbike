import { chromium } from "playwright-core";

const PAGE_URL = "http://localhost:3000/product/mu-bao-hiem-ls2-ff800-storm/";
const OUT = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/.artifacts/buybox-align/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 1000 }, deviceScaleFactor: 3 });
await page.goto(PAGE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[class*="border-l-brand"]', { timeout: 15000 }).catch(() => {});

const measure = () =>
  page.evaluate(() => {
    const r1 = (n) => Math.round(n * 10) / 10;
    const cY = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const info = document.querySelector(".bb-wp-pdp-info-col");
    const box = info.querySelector('[class*="border-l-brand"]');
    const bR = box.getBoundingClientRect();
    const icon = box.querySelector("svg");
    const p = box.querySelector("p");
    const pR = p.getBoundingClientRect();
    const label = Array.from(info.querySelectorAll("p")).find((x) => /^chia/i.test((x.textContent || "").trim()));
    const row = label.parentElement;
    const rR = row.getBoundingClientRect();
    const icons = Array.from(row.querySelectorAll("a,button"));
    return {
      iconVsBox: r1(cY(icon) - (bR.top + bR.height / 2)),
      textVsBox: r1(pR.top + pR.height / 2 - (bR.top + bR.height / 2)),
      labelVsRow: r1(cY(label) - (rR.top + rR.height / 2)),
      iconsVsLabel: icons.map((a) => r1(cY(a) - cY(label))),
    };
  });

const before = await measure();

// --- inject the proposed className fix (A/B) ---
await page.evaluate(() => {
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const box = info.querySelector('[class*="border-l-brand"]');
  box.classList.remove("items-start"); box.classList.add("items-center");
  box.querySelector("svg").classList.remove("mt-0.5");
  const label = Array.from(info.querySelectorAll("p")).find((x) => /^chia/i.test((x.textContent || "").trim()));
  const row = label.parentElement;
  row.classList.remove("text-left"); row.classList.add("flex", "flex-wrap", "items-center");
});

const after = await measure();

const fmt = (n) => (n > 0 ? "+" : "") + n + "px";
console.log("\n                          BEFORE      AFTER");
console.log("  note: icon vs box   :  ", fmt(before.iconVsBox).padEnd(8), fmt(after.iconVsBox));
console.log("  note: text vs box   :  ", fmt(before.textVsBox).padEnd(8), fmt(after.textVsBox));
console.log("  share: label vs row :  ", fmt(before.labelVsRow).padEnd(8), fmt(after.labelVsRow));
console.log("  share: icons vs lbl :  ", "[" + before.iconsVsLabel.map(fmt).join(", ") + "]  ->  [" + after.iconsVsLabel.map(fmt).join(", ") + "]");

const info = await page.$(".bb-wp-pdp-info-col");
// screenshot just the note + share region after fix
const box = await page.$('[class*="border-l-brand"]');
const bb = await box.boundingBox();
await page.screenshot({ path: OUT + "after-fix.png", clip: { x: bb.x - 4, y: bb.y - 4, width: Math.min(bb.width + 8, 430), height: 150 } });
await browser.close();
console.log("\n  screenshot (after fix) -> after-fix.png\n");
