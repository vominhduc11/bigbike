import { chromium } from "playwright-core";

const PAGE_URL = "http://localhost:3000/product/mu-bao-hiem-ls2-ff800-storm/";
const OUT = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/.artifacts/buybox-align/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
await page.goto(PAGE_URL, { waitUntil: "networkidle" });
// Ensure the buy box rendered (out-of-stock note present)
await page.waitForSelector('[class*="border-l-brand"]', { timeout: 15000 }).catch(() => {});

const data = await page.evaluate(() => {
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const ref = info.getBoundingClientRect().left;
  const round = (n) => Math.round(n * 10) / 10;
  const rec = (name, el) => {
    if (!el) return { name, found: false };
    const r = el.getBoundingClientRect();
    return {
      name,
      left: round(r.left),
      offset: round(r.left - ref),
      width: round(r.width),
      text: (el.textContent || "").trim().slice(0, 38),
    };
  };
  const out = [];
  out.push(rec("infoCol (ref x=0)", info));
  out.push(rec("title h1", info.querySelector("h1")));

  // price: deepest element containing the price string
  const priceEl = Array.from(info.querySelectorAll("*")).find(
    (e) => e.children.length === 0 && /3\.190\.000/.test(e.textContent || ""),
  );
  out.push(rec("price text", priceEl));

  // rating row
  out.push(rec("rating row", Array.from(info.querySelectorAll("p")).find((p) => /đánh giá/i.test(p.textContent || ""))));

  // variant group labels (Color / Size) — labels without a `for` attr
  Array.from(info.querySelectorAll("label"))
    .filter((l) => !l.getAttribute("for"))
    .forEach((l, i) => out.push(rec(`variant label #${i + 1}`, l)));

  // first swatch in each group
  const swatchWraps = info.querySelectorAll('div[class*="inline-flex"][class*="flex-wrap"]');
  swatchWraps.forEach((w, i) => out.push(rec(`swatch group #${i + 1} first cell`, w.querySelector(":scope > div"))));

  // out-of-stock note box + inner text
  const noteBox = info.querySelector('[class*="border-l-brand"]');
  out.push(rec("NOTE box (outer)", noteBox));
  out.push(rec("NOTE text (p)", noteBox && noteBox.querySelector("p")));
  out.push(rec("NOTE icon (svg)", noteBox && noteBox.querySelector("svg")));

  // share row
  const shareLabel = Array.from(info.querySelectorAll("p")).find((p) => /^chia/i.test((p.textContent || "").trim()));
  out.push(rec("SHARE label 'chia sẻ'", shareLabel));
  const shareRow = shareLabel && shareLabel.parentElement;
  out.push(rec("SHARE first icon", shareRow && shareRow.querySelector("a,button")));

  return { out };
});

console.log("\n  ELEMENT                          left      offset   width   text");
console.log("  " + "-".repeat(86));
for (const r of data.out) {
  if (!r.found && r.left === undefined) {
    console.log("  " + r.name.padEnd(32) + "  NOT FOUND");
    continue;
  }
  console.log(
    "  " +
      r.name.padEnd(32) +
      String(r.left).padStart(7) +
      String(r.offset).padStart(9) +
      String(r.width).padStart(8) +
      "   " +
      r.text,
  );
}

// clip screenshot of the info column for visual confirmation
const info = await page.$(".bb-wp-pdp-info-col");
if (info) await info.screenshot({ path: OUT + "infocol.png" });
await browser.close();
console.log("\n  screenshot -> .artifacts/buybox-align/infocol.png\n");
