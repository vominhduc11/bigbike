import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
for (const w of [2880, 1920, 1536, 1440, 1280, 1025, 800, 375]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1300 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
  await page.waitForTimeout(700);
  const d = await page.evaluate(() => {
    const r = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const up = document.querySelector('[aria-label="Cuộn thumbnail lên"]');
    const grid = document.querySelector(".bb-wp-pdp-gallery-col > div");
    const thumbCol = grid?.children?.[0];
    const thumbSwiper = thumbCol?.querySelector(".swiper");
    const thumbSlides = thumbCol?.querySelectorAll(".swiper-slide") ?? [];
    const img = document.querySelector('.bb-wp-pdp-gallery-col [class*="aspect-square"]');
    return {
      arrows: !!up && up.offsetParent !== null,
      thumbs: thumbSlides.length,
      slideH: thumbSlides[0] ? Math.round(thumbSlides[0].getBoundingClientRect().height) : null,
      colH: r(thumbCol),
      swiperH: r(thumbSwiper),
      imgH: r(img),
    };
  });
  const overhang = d.colH != null && d.imgH != null ? d.colH - d.imgH : null;
  const flag = overhang != null && overhang > 1 ? "  <-- RAIL OVERHANGS IMAGE" : "";
  console.log(`W=${String(w).padStart(4)}: arrows=${d.arrows} thumbs=${d.thumbs} slideH=${d.slideH} | colH=${d.colH} swiperH=${d.swiperH} imgH=${d.imgH} overhang=${overhang}${flag}`);
  await page.close();
}
await browser.close();
