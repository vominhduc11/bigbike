import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3001";
const OUT = path.resolve("../docs/audits/homepage-p3-after-shots");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "laptop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];
const shot = (p, n, o = {}) => p.screenshot({ path: path.join(OUT, n + ".png"), ...o });
const settle = async (p) => {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(1300);
};
const browser = await chromium.launch({ headless: true });
const log = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: "vi-VN" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 40000 });
  await settle(p);
  await shot(p, `${vp.name}--top`);
  await shot(p, `${vp.name}--full`, { fullPage: true });
  const ov = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log.push(`[${vp.name}] scrollW=${ov.sw} clientW=${ov.cw} hOverflow=${ov.sw > ov.cw} consoleErrors=${errs.length}`);
  errs.slice(0, 6).forEach((e) => log.push(`   · ${e.slice(0, 180)}`));
  await ctx.close();
}

const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "vi-VN" });
const p = await ctx.newPage();
const stateErrs = [];
p.on("console", (m) => { if (m.type() === "error") stateErrs.push(m.text()); });
p.on("pageerror", (e) => stateErrs.push("PAGEERROR: " + e.message));
await p.goto(BASE + "/", { waitUntil: "load", timeout: 40000 });
await settle(p);

await shot(p, "homepage-default-top");

// mid sections
await p.evaluate(() => window.scrollTo({ top: 1700, behavior: "instant" }));
await p.waitForTimeout(700);
await shot(p, "homepage-mid-sections");
// sticky header (scroll up a bit)
await p.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
await p.waitForTimeout(700);
await shot(p, "sticky-header");
await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await p.waitForTimeout(500);

const sect = async (sel, name) => {
  try {
    const el = p.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    await el.screenshot({ path: path.join(OUT, name + ".png") });
    log.push(`[${name}] ok`);
  } catch (e) { log.push(`[${name}] FAIL: ` + e.message.split("\n")[0]); }
};
await sect("[aria-labelledby='home-exp-heading']", "experience-section");
await sect(".bb-products-section", "recommended-carousel");
await sect(".bb-cat-list", "category-grid");
await sect(".bb-promo-banner", "promo-banner");
await sect("footer", "homepage-footer");

await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await p.waitForTimeout(500);

// interactive states
try {
  await p.click('button[aria-label="Tìm kiếm"]');
  await p.waitForSelector(".bb-search-shell", { timeout: 5000 });
  await p.waitForTimeout(800);
  await shot(p, "search-overlay-empty");
  await p.fill(".bb-search-shell input", "mũ");
  await p.waitForTimeout(1600);
  await shot(p, "search-overlay-suggestions");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  log.push("[search] ok");
} catch (e) { log.push("[search] FAIL: " + e.message.split("\n")[0]); }

try {
  await p.click('[aria-label^="Tài khoản"]');
  await p.waitForTimeout(700);
  await shot(p, "account-dropdown-guest");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  log.push("[account-guest] ok");
} catch (e) { log.push("[account-guest] FAIL: " + e.message.split("\n")[0]); }

try {
  await p.locator(".bb-navigation-item-has-children.mega-item").first().hover();
  await p.waitForTimeout(900);
  await shot(p, "mega-menu-open");
  log.push("[megamenu] ok");
} catch (e) { log.push("[megamenu] FAIL: " + e.message.split("\n")[0]); }

try {
  await p.click('button[aria-label^="Thông tin về"]');
  await p.waitForTimeout(900);
  await shot(p, "burger-drawer-open");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  log.push("[burger] ok");
} catch (e) { log.push("[burger] FAIL: " + e.message.split("\n")[0]); }

log.push(`[state-page] consoleErrors=${stateErrs.length}`);
[...new Set(stateErrs)].slice(0, 10).forEach((e) => log.push(`   · ${e.slice(0, 200)}`));

await ctx.close();
await browser.close();
fs.writeFileSync(path.join(OUT, "_p3-log.txt"), log.join("\n"));
console.log(log.join("\n"));
console.log("DONE → " + OUT);
