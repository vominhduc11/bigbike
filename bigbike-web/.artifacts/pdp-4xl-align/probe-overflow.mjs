import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1300 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
await page.waitForTimeout(600);
const before = await page.evaluate(() => !!document.querySelector('[aria-label="Cuộn thumbnail lên"]'));
// Force the thumb rail short so 4 thumbs overflow -> Swiper should unlock.
await page.addStyleTag({ content: ".bb-wp-pdp-gallery-col .swiper{ max-height:250px !important; }" });
await page.setViewportSize({ width: 1921, height: 1300 }); // nudge to fire Swiper resize/recalc
await page.waitForTimeout(500);
const after = await page.evaluate(() => {
  const up = document.querySelector('[aria-label="Cuộn thumbnail lên"]');
  const down = document.querySelector('[aria-label="Cuộn thumbnail xuống"]');
  const wrap = document.querySelector(".bb-wp-pdp-gallery-col .swiper .swiper-wrapper");
  const t0 = wrap ? getComputedStyle(wrap).transform : null;
  return { arrowsNow: !!up && up.offsetParent !== null, hasDown: !!down, t0 };
});
// click down arrow, see if wrapper translates (scrolls)
let scrolled = false, t1 = null;
if (after.arrowsNow) {
  await page.click('[aria-label="Cuộn thumbnail xuống"]');
  await page.waitForTimeout(400);
  t1 = await page.evaluate(() => { const w=document.querySelector(".bb-wp-pdp-gallery-col .swiper .swiper-wrapper"); return w?getComputedStyle(w).transform:null; });
  scrolled = t1 !== after.t0;
}
console.log("arrows before forcing overflow:", before, "(expected false = locked/all fit)");
console.log("arrows after forcing overflow:", after.arrowsNow, "(expected true)");
console.log("wrapper transform before click:", after.t0);
console.log("wrapper transform after click: ", t1, "-> scrolled:", scrolled);
await browser.close();
