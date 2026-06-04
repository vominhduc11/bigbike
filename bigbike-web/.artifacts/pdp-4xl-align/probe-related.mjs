import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2880, height: 1500 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(800);
const d = await page.evaluate(() => {
  const r = (el) => el ? (b=>({l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width)}))(el.getBoundingClientRect()) : null;
  // related section = the section after tabs that has the related track
  const track = document.querySelector(".bb-wp-related-track");
  const relatedSection = track?.closest("section");
  const cards = track ? track.querySelectorAll(".swiper-slide").length : 0;
  const colsVar = track ? getComputedStyle(track).getPropertyValue("--bb-wp-related-columns") : "n/a";
  return { ov: r(document.querySelector("#pdp-overview")), related: r(relatedSection), cards, colsVar: colsVar.trim() };
});
console.log(JSON.stringify(d, null, 2));
console.log("relatedAlignedWithOverview:", d.related && d.ov ? (d.related.l===d.ov.l && d.related.r===d.ov.r) : "no related section");
await browser.close();
