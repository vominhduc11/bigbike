import { chromium } from "playwright";

const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2880, height: 1500 },
  deviceScaleFactor: 1,
});
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
// Kill transitions/animations so the shot + measurements are deterministic.
await page.addStyleTag({
  content: "*{transition:none!important;animation:none!important;}",
});
await page.waitForTimeout(600);

const data = await page.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      left: Math.round(b.left),
      right: Math.round(b.right),
      width: Math.round(b.width),
      top: Math.round(b.top),
      height: Math.round(b.height),
    };
  };
  const q = (s) => r(document.querySelector(s));
  const grid = document.querySelector(".bb-wp-pdp-gallery-col > div");
  const thumbCol = grid?.children?.[0] ?? null;
  const mainCol = grid?.children?.[grid.children.length - 1] ?? null;
  const mainImgBox = document.querySelector(
    '.bb-wp-pdp-gallery-col [class*="aspect-square"]',
  );
  return {
    breadcrumb: q(".bb-wp-pdp .bb-breadcrumb"),
    overview: q("#pdp-overview"),
    galleryCol: q(".bb-wp-pdp-gallery-col"),
    galleryGrid: r(grid),
    thumbCol: r(thumbCol),
    mainCol: r(mainCol),
    mainImageBox: r(mainImgBox),
    infoCol: q(".bb-wp-pdp-info-col"),
    tabs: q(".bb-wp-tabs"),
  };
});

console.log(JSON.stringify(data, null, 2));

// Alignment summary (content-left of breadcrumb has 15px padding; overview px-15).
const A = data;
const lefts = {
  "breadcrumb.left": A.breadcrumb?.left,
  "overview.left": A.overview?.left,
  "tabs.left": A.tabs?.left,
  "galleryCol.left": A.galleryCol?.left,
  "thumbCol.left": A.thumbCol?.left,
};
const rights = {
  "breadcrumb.right": A.breadcrumb?.right,
  "overview.right": A.overview?.right,
  "tabs.right": A.tabs?.right,
  "infoCol.right": A.infoCol?.right,
};
console.log("\n--- LEFT edges ---");
console.log(JSON.stringify(lefts, null, 2));
console.log("--- RIGHT edges ---");
console.log(JSON.stringify(rights, null, 2));
console.log("\nmainImage square?", A.mainImageBox?.width, "x", A.mainImageBox?.height);
console.log("thumbCol height vs mainImage height:", A.thumbCol?.height, "vs", A.mainImageBox?.height);

await page.screenshot({
  path: ".artifacts/pdp-4xl-align/shot-2880.png",
  clip: { x: 0, y: 0, width: 2880, height: 1000 },
});
await browser.close();
console.log("\nshot saved: .artifacts/pdp-4xl-align/shot-2880.png");
