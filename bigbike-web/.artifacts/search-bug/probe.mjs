import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3001";

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) =>
  logs.push(`[requestfailed] ${r.failure()?.errorText} ${r.url()}`),
);
page.on("response", (r) => {
  if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
});

async function dump(label) {
  console.log(`\n===== ${label} =====`);
  console.log("URL:", page.url());
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 300));
  console.log("BODY TEXT:", JSON.stringify(body));
}

// 1. Direct hard load of the search URL
console.log("### STEP 1: direct load /tim-kiem/?s=ls2");
const resp = await page.goto(`${BASE}/tim-kiem/?s=ls2`, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => {
  logs.push(`[goto error] ${e.message}`);
  return null;
});
console.log("goto status:", resp?.status());
await dump("after direct load");

// 2. Soft navigation: home -> type search -> navigate
console.log("\n### STEP 2: soft-nav from home");
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => logs.push(`[home goto] ${e.message}`));
logs.length = 0;
// simulate client navigation via Next router
await page.evaluate(() => {
  window.history.pushState({}, "", "/tim-kiem/?s=ls2");
});
await page.goto(`${BASE}/tim-kiem/?s=ls2`, { waitUntil: "networkidle" }).catch((e) => logs.push(`[soft goto] ${e.message}`));
await dump("after soft nav");

console.log("\n===== LOGS =====");
console.log(logs.join("\n") || "(none)");

await browser.close();
