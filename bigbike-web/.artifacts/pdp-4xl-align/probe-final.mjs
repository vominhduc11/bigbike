import { chromium } from "playwright";
const PRODUCTS = {
  "5-img (gang-tay)": "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/",
  "28-img (mu-mf509)": "http://localhost:3018/product/mu-bao-hiem-fullface-ilm-racing-helmet-mf509/",
};
const browser = await chromium.launch();
for (const [name, URL] of Object.entries(PRODUCTS)) {
  console.log("### " + name);
  for (const w of [2880, 1920, 1536, 1280, 1025]) {
    const page = await browser.newPage({ viewport: { width: w, height: 1300 }, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => {
      const r = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
      const up = document.querySelector('[aria-label="Cuộn thumbnail lên"]');
      const grid = document.querySelector(".bb-wp-pdp-gallery-col > div");
      const thumbCol = grid?.children?.[0];
      const slides = thumbCol?.querySelectorAll(".swiper-slide")?.length ?? 0;
      const img = document.querySelector('.bb-wp-pdp-gallery-col [class*="aspect-square"]');
      return { arrows: !!up && up.offsetParent !== null, slides, colH: r(thumbCol), imgH: r(img) };
    });
    const oh = d.colH!=null&&d.imgH!=null? d.colH-d.imgH : null;
    const bad = oh!=null && oh>1 ? " OVERHANG!" : "";
    console.log(`  W=${String(w).padStart(4)}: slides=${d.slides} arrows=${d.arrows} colH=${d.colH} imgH=${d.imgH} overhang=${oh}${bad}`);
    await page.close();
  }
}
await browser.close();
