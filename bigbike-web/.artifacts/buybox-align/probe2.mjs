import { chromium } from "playwright-core";

const PAGE_URL = "http://localhost:3000/product/mu-bao-hiem-ls2-ff800-storm/";
const OUT = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/.artifacts/buybox-align/";

const browser = await chromium.launch();
// narrower width so the note text wraps to 2 lines (matches the user's screenshot)
const page = await browser.newPage({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 2 });
await page.goto(PAGE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[class*="border-l-brand"]', { timeout: 15000 }).catch(() => {});

const data = await page.evaluate(() => {
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const ref = info.getBoundingClientRect().left;
  const r1 = (n) => Math.round(n * 10) / 10;
  const noteBox = info.querySelector('[class*="border-l-brand"]');
  const noteP = noteBox && noteBox.querySelector("p");
  const shareLabel = Array.from(info.querySelectorAll("p")).find((p) => /^chia/i.test((p.textContent || "").trim()));
  const cs = noteP ? getComputedStyle(noteP) : null;
  const lh = cs ? parseFloat(cs.lineHeight) : null;
  const fs = cs ? parseFloat(cs.fontSize) : null;
  const pRect = noteP ? noteP.getBoundingClientRect() : null;
  return {
    noteBoxLeft: r1(noteBox.getBoundingClientRect().left - ref),
    noteTextLeft: noteP ? r1(pRect.left - ref) : null,
    shareLeft: shareLabel ? r1(shareLabel.getBoundingClientRect().left - ref) : null,
    noteFontSize: fs,
    noteLineHeight: lh,
    lineHeightRatio: lh && fs ? r1(lh / fs) : null,
    notePHeight: pRect ? r1(pRect.height) : null,
    approxLines: pRect && lh ? r1(pRect.height / lh) : null,
  };
});

console.log("\n  --- note box / share, width=1000 (2-line state) ---");
console.log("  note box left edge (px from col)   :", data.noteBoxLeft);
console.log("  note TEXT left edge                :", data.noteTextLeft);
console.log("  'chia sẻ' left edge                :", data.shareLeft);
console.log("  note font-size                     :", data.noteFontSize, "px");
console.log("  note line-height                   :", data.noteLineHeight, "px  (ratio", data.lineHeightRatio + "x)");
console.log("  note <p> height / approx lines     :", data.notePHeight, "px /", data.approxLines, "lines");

const box = await page.$('[class*="border-l-brand"]');
if (box) {
  const wrap = await box.evaluateHandle((el) => el.closest('[class*="mt-[30px]"]')?.parentElement || el.parentElement);
  await (wrap.asElement() || box).screenshot({ path: OUT + "note-share.png" });
}
await browser.close();
console.log("\n  screenshot -> .artifacts/buybox-align/note-share.png\n");
