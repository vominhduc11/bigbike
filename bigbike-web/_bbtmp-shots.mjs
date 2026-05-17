// Migration screenshot harness — captures key routes × 3 viewports.
// Usage: node _bbtmp-shots.mjs <baseUrl> <outDir>
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE = process.argv[2];
const OUT = process.argv[3];
if (!BASE || !OUT) { console.error("usage: node _bbtmp-shots.mjs <baseUrl> <outDir>"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "d1280", width: 1280, height: 900 },
  { name: "t768", width: 768, height: 1024 },
  { name: "m390", width: 390, height: 844 },
];

async function goto(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);
    return true;
  } catch (e) {
    console.log(`  ! goto ${url}: ${String(e).split("\n")[0]}`);
    return false;
  }
}

const browser = await chromium.launch({ headless: true });
const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
const probe = await ctx0.newPage();

// discover a product detail slug + a category slug
let pdpPath = null, catPath = null;
if (await goto(probe, `${BASE}/san-pham`)) {
  const found = await probe.evaluate(() => {
    const grab = (sel) => [...document.querySelectorAll(sel)]
      .map((el) => new URL(el.href).pathname);
    const pdp = grab('a[href*="/product/"]').find((p) => /^\/product\/[^/]+\/?$/.test(p));
    const cat = grab('a[href*="/danh-muc-san-pham/"]')
      .find((p) => /^\/danh-muc-san-pham\/[^/]+\/?$/.test(p));
    return { pdp: pdp ?? null, cat: cat ?? null };
  });
  pdpPath = found.pdp;
  catPath = found.cat;
}
await ctx0.close();

const routes = [
  ["home", "/"],
  ["catalog", "/san-pham"],
  ["blog", "/tin-tuc"],
  ["cart", "/gio-hang"],
  ["contact", "/lien-he"],
  ["about", "/gioi-thieu"],
];
if (pdpPath) routes.push(["pdp", pdpPath]);
if (catPath) routes.push(["category", catPath]);
console.log("routes:", routes.map((r) => r[1]).join(", "));

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "vi-VN", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [name, route] of routes) {
    const ok = await goto(page, `${BASE}${route}`);
    if (!ok) continue;
    const file = path.join(OUT, `${name}--${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ok ${path.basename(file)}`);
  }
  await ctx.close();
}
await browser.close();
console.log("done →", OUT);
