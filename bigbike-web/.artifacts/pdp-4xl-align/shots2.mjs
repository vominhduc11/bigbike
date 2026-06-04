import { chromium } from "playwright";
const URL = "http://localhost:3018/product/gang-tay-xe-may-alpinestars-sp-8-v3/";
const browser = await chromium.launch();
for (const [w,h,clipH] of [[2880,1500,1050],[800,1300,1100]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 20000 });
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important;}" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `.artifacts/pdp-4xl-align/thumbs-${w}.png`, clip:{x:0,y:0,width:w,height:clipH} });
  await page.close();
  console.log("saved thumbs-"+w+".png");
}
await browser.close();
