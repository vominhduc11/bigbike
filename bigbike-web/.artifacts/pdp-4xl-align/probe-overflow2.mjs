import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1300 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
await page.waitForTimeout(600);
const read = () => page.evaluate(() => {
  const sw = document.querySelector(".bb-wp-pdp-gallery-col > div > div:first-child .swiper");
  const inst = sw && sw.swiper;
  const up = document.querySelector('[aria-label="Cuộn thumbnail lên"]');
  return { isLocked: inst ? inst.isLocked : "no-inst", arrows: !!up && up.offsetParent !== null };
});
console.log("normal (4 fit):", JSON.stringify(await read()));
// Force each thumb slide tall so 4 overflow the 738 rail.
await page.addStyleTag({ content: ".bb-wp-pdp-gallery-col > div > div:first-child .swiper-slide{ height:300px !important; }" });
await page.setViewportSize({ width: 1921, height: 1300 });
await page.waitForTimeout(600);
console.log("forced overflow:", JSON.stringify(await read()));
// try clicking down
const d = await page.$('[aria-label="Cuộn thumbnail xuống"]');
if (d) {
  const t0 = await page.evaluate(()=>{const w=document.querySelector(".bb-wp-pdp-gallery-col > div > div:first-child .swiper-wrapper");return w?getComputedStyle(w).transform:null;});
  await d.click(); await page.waitForTimeout(400);
  const t1 = await page.evaluate(()=>{const w=document.querySelector(".bb-wp-pdp-gallery-col > div > div:first-child .swiper-wrapper");return w?getComputedStyle(w).transform:null;});
  console.log("scroll on click:", t0, "->", t1, "moved:", t0!==t1);
} else {
  console.log("no down arrow to click");
}
await browser.close();
