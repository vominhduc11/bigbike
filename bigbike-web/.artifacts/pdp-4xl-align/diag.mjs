import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
for (const w of [2880, 1440]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1300 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
  await page.waitForTimeout(1000);
  const d = await page.evaluate(() => {
    const grid = document.querySelector(".bb-wp-pdp-gallery-col > div");
    const thumbCol = grid?.children?.[0];
    const allSlides = thumbCol?.querySelectorAll(".swiper-slide") ?? [];
    const real = [...allSlides].filter(s => !s.className.includes("swiper-slide-duplicate"));
    const imgs = [...allSlides].map(s => { const i = s.querySelector("img"); return i ? (i.getAttribute("src")||"").slice(-30) : "no-img"; });
    return { total: allSlides.length, real: real.length, classes: [...allSlides].map(s=>s.className.replace("swiper-slide","").trim()).slice(0,8), imgs };
  });
  console.log(`W=${w}: totalSlides=${d.total} nonDup=${d.real}`);
  console.log("  slide classes:", JSON.stringify(d.classes));
  console.log("  imgs:", JSON.stringify(d.imgs, null, 0));
  await page.close();
}
await browser.close();
