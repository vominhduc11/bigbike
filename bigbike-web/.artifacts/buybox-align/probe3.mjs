import { chromium } from "playwright-core";

const PAGE_URL = "http://localhost:3000/product/mu-bao-hiem-ls2-ff800-storm/";
const OUT = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/.artifacts/buybox-align/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 1000 }, deviceScaleFactor: 4 });
await page.goto(PAGE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[class*="border-l-brand"]', { timeout: 15000 }).catch(() => {});

const info = await page.evaluate(() => {
  const box = document.querySelector('[class*="border-l-brand"]');
  const cs = getComputedStyle(box);
  const r = box.getBoundingClientRect();
  return {
    borderTop: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
    borderLeft: cs.borderLeftWidth + " " + cs.borderLeftStyle + " " + cs.borderLeftColor,
    borderRight: cs.borderRightWidth + " " + cs.borderRightStyle + " " + cs.borderRightColor,
    borderBottom: cs.borderBottomWidth + " " + cs.borderBottomStyle + " " + cs.borderBottomColor,
    borderRadius: cs.borderTopLeftRadius,
    boxH: Math.round(r.height),
    pTextLines: (() => {
      const p = box.querySelector("p");
      const pcs = getComputedStyle(p);
      return Math.round(p.getBoundingClientRect().height / parseFloat(pcs.lineHeight));
    })(),
  };
});
console.log("\n  note box computed borders:");
console.log("   top   :", info.borderTop);
console.log("   left  :", info.borderLeft, "  <-- red accent");
console.log("   right :", info.borderRight);
console.log("   bottom:", info.borderBottom);
console.log("   radius:", info.borderRadius, "| box height:", info.boxH, "px | text lines:", info.pTextLines);

const box = await page.$('[class*="border-l-brand"]');
await box.screenshot({ path: OUT + "note-box-zoom.png" });

// tight crop of the TOP-LEFT corner of the red bar (where a miter notch would show)
const bb = await box.boundingBox();
await page.screenshot({
  path: OUT + "note-corner-topleft.png",
  clip: { x: bb.x - 2, y: bb.y - 2, width: 40, height: 40 },
});
await page.screenshot({
  path: OUT + "note-corner-botleft.png",
  clip: { x: bb.x - 2, y: bb.y + bb.height - 38, width: 40, height: 40 },
});
await browser.close();
console.log("\n  screenshots -> note-box-zoom.png, note-corner-topleft.png, note-corner-botleft.png\n");
