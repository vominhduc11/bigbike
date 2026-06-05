import { chromium } from "playwright-core";

const PAGE_URL = "http://localhost:3000/product/mu-bao-hiem-ls2-ff800-storm/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(PAGE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[class*="border-l-brand"]', { timeout: 15000 }).catch(() => {});

const d = await page.evaluate(() => {
  const r1 = (n) => Math.round(n * 10) / 10;
  const cY = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  const info = document.querySelector(".bb-wp-pdp-info-col");

  // --- NOTE box ---
  const box = info.querySelector('[class*="border-l-brand"]');
  const boxR = box.getBoundingClientRect();
  const icon = box.querySelector("svg");
  const p = box.querySelector("p");
  const pcs = getComputedStyle(p);
  const lh = parseFloat(pcs.lineHeight);
  const pR = p.getBoundingClientRect();

  // --- SHARE row ---
  const label = Array.from(info.querySelectorAll("p")).find((x) => /^chia/i.test((x.textContent || "").trim()));
  const row = label.parentElement;
  const rowR = row.getBoundingClientRect();
  const icons = Array.from(row.querySelectorAll("a,button"));

  return {
    note: {
      boxTop: r1(boxR.top), boxH: r1(boxR.height), boxCenterY: r1(boxR.top + boxR.height / 2),
      iconCenterY: r1(cY(icon)), iconH: r1(icon.getBoundingClientRect().height),
      textBlockCenterY: r1(pR.top + pR.height / 2), textTop: r1(pR.top), textH: r1(pR.height),
      line1CenterY: r1(pR.top + lh / 2), lineHeight: r1(lh),
    },
    share: {
      rowCenterY: r1(rowR.top + rowR.height / 2), rowH: r1(rowR.height),
      labelCenterY: r1(cY(label)), labelH: r1(label.getBoundingClientRect().height),
      icons: icons.map((a, i) => ({ i, centerY: r1(cY(a)), h: r1(a.getBoundingClientRect().height) })),
    },
  };
});

console.log("\n=== NOTE box (vertical) ===");
console.log("  box center-Y      :", d.note.boxCenterY, " (h", d.note.boxH + ")");
console.log("  icon center-Y     :", d.note.iconCenterY, " (h", d.note.iconH + ")  diff vs box:", r(d.note.iconCenterY - d.note.boxCenterY));
console.log("  text-block centerY:", d.note.textBlockCenterY, " diff vs box:", r(d.note.textBlockCenterY - d.note.boxCenterY));
console.log("  text line-1 center:", d.note.line1CenterY, " | icon vs line1:", r(d.note.iconCenterY - d.note.line1CenterY), " (lh", d.note.lineHeight + ")");

console.log("\n=== SHARE row (vertical) ===");
console.log("  row center-Y   :", d.share.rowCenterY, " (h", d.share.rowH + ")");
console.log("  'chia sẻ' centerY:", d.share.labelCenterY, " (h", d.share.labelH + ")  diff vs row:", r(d.share.labelCenterY - d.share.rowCenterY));
for (const ic of d.share.icons)
  console.log(`  icon #${ic.i} center-Y :`, ic.centerY, " diff vs label:", r(ic.centerY - d.share.labelCenterY));

function r(n) { const v = Math.round(n * 10) / 10; return (v > 0 ? "+" : "") + v + "px"; }
await browser.close();
