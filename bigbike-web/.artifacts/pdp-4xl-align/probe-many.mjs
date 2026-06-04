import { chromium } from "playwright";
const URL = "http://localhost:3018/product/mu-bao-hiem-fullface-ilm-racing-helmet-mf509/";
const browser = await chromium.launch();
for (const w of [2880, 1440, 800]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1300 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
  await page.waitForTimeout(700);
  const base = await page.evaluate(() => {
    const r = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const up = document.querySelector('[aria-label="Cuộn thumbnail lên"]');
    const grid = document.querySelector(".bb-wp-pdp-gallery-col > div");
    const thumbCol = grid?.children?.[0];
    const sw = thumbCol?.querySelector(".swiper");
    const img = document.querySelector('.bb-wp-pdp-gallery-col [class*="aspect-square"]');
    const slides = thumbCol?.querySelectorAll(".swiper-slide")?.length ?? 0;
    return { arrows: !!up && up.offsetParent !== null, colH: r(thumbCol), swiperH: r(sw), imgH: r(img), slides };
  });
  // try scrolling via down arrow
  let moved = "n/a";
  const down = await page.$('[aria-label="Cuộn thumbnail xuống"]');
  if (down) {
    const t0 = await page.evaluate(()=>{const w=document.querySelector(".bb-wp-pdp-gallery-col > div > div:first-child .swiper-wrapper");return w?getComputedStyle(w).transform:null;});
    await down.click(); await page.waitForTimeout(450);
    const t1 = await page.evaluate(()=>{const w=document.querySelector(".bb-wp-pdp-gallery-col > div > div:first-child .swiper-wrapper");return w?getComputedStyle(w).transform:null;});
    moved = (t0 !== t1);
  }
  const overhang = base.colH!=null&&base.imgH!=null? base.colH-base.imgH : null;
  console.log(`W=${String(w).padStart(4)}: arrows=${base.arrows} slides=${base.slides} colH=${base.colH} swiperH=${base.swiperH} imgH=${base.imgH} overhang=${overhang} scrollWorks=${moved}`);
  await page.close();
}
await browser.close();
