import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
for (const w of [2880, 1920, 1600, 1536, 1440, 1280, 1025]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => {
    const r = (el) => el ? (b=>({l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width),h:Math.round(b.height)}))(el.getBoundingClientRect()) : null;
    const grid = document.querySelector(".bb-wp-pdp-gallery-col > div");
    const img = document.querySelector('.bb-wp-pdp-gallery-col [class*="aspect-square"]');
    return {
      bc: r(document.querySelector(".bb-wp-pdp .bb-breadcrumb")),
      ov: r(document.querySelector("#pdp-overview")),
      thumb: r(grid?.children?.[0]),
      img: r(img),
      info: r(document.querySelector(".bb-wp-pdp-info-col")),
    };
  });
  const leftAligned = d.bc.l === d.ov.l && Math.abs(d.thumb.l - (d.ov.l+15)) <= 1;
  const dh = Math.abs(d.thumb.h - d.img.h);
  console.log(`W=${String(w).padStart(4)}: bc.l=${d.bc.l} ov.l=${d.ov.l} thumb.l=${d.thumb.l} | img=${d.img.w}x${d.img.h} thumbH=${d.thumb.h} (Δ${dh}) | leftAligned=${leftAligned} | bc.w=${d.bc.w} ov.w=${d.ov.w} infoR=${d.info?.r} ovR=${d.ov.r}`);
  await page.close();
}
await browser.close();
