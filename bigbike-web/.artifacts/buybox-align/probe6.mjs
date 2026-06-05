import { chromium } from "playwright-core";
const PAGE_URL = "http://localhost:3000/product/mu-bao-hiem-ls2-ff800-storm/";
const OUT = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/.artifacts/buybox-align/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 1000 }, deviceScaleFactor: 3 });
await page.goto(PAGE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[class*="border-l-brand"]', { timeout: 15000 }).catch(() => {});
await page.evaluate(() => {
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const box = info.querySelector('[class*="border-l-brand"]');
  box.classList.remove("items-start"); box.classList.add("items-center");
  box.querySelector("svg").classList.remove("mt-0.5");
  const label = Array.from(info.querySelectorAll("p")).find((x) => /^chia/i.test((x.textContent || "").trim()));
  const row = label.parentElement;
  row.classList.remove("text-left"); row.classList.add("flex", "flex-wrap", "items-center");
});
const box = await page.$('[class*="border-l-brand"]');
await box.screenshot({ path: OUT + "note-fixed.png" });
const share = await page.evaluateHandle(() => {
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const label = Array.from(info.querySelectorAll("p")).find((x) => /^chia/i.test((x.textContent || "").trim()));
  return label.parentElement;
});
await share.asElement().screenshot({ path: OUT + "share-fixed.png" });
await browser.close();
console.log("ok -> note-fixed.png, share-fixed.png");
