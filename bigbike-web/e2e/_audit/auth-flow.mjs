/**
 * Authenticated mobile purchase-flow capture.
 * Logs in with the provided customer test account, adds a product to cart, and
 * captures the cart-with-items states (bottom-sheet, /gio-hang page, /thanh-toan
 * checkout) plus account — the parts a guest session can't reach.
 *
 * Usage: node e2e/_audit/auth-flow.mjs --tag=before
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const TAG = (argv.find((a) => a.startsWith("--tag=")) || "--tag=before").split("=")[1];
const OUT = join(__dirname, "out", "mobile", `auth-${TAG}`);
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BB_BASE || "http://localhost:3001";
const [VW, VH] = (process.env.BB_VP || "390x844").split("x").map(Number);
const EMAIL = process.env.BB_EMAIL || "duc237022@gmail.com";
const PASS = process.env.BB_PASS || "12345678";
const log = (...a) => console.log(`[auth:${TAG}]`, ...a);
const out = { tag: TAG, steps: {}, console: [] };

async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(ms);
}
const shot = (page, name, full = false) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") out.console.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => out.console.push("PAGEERROR " + String(e).slice(0, 200)));

try {
  // 1. LOGIN
  await page.goto(BASE + "/dang-nhap", { waitUntil: "load", timeout: 45000 });
  await settle(page, 800);
  await page.fill("#login-username", EMAIL);
  await page.fill("#login-password", PASS);
  await shot(page, "01-login-filled");
  await page.click("button[type='submit']");
  await page.waitForTimeout(3500);
  await settle(page, 800);
  const authed = await page.evaluate(() => !/\/dang-nhap/.test(location.pathname));
  out.steps.login = authed ? "ok (redirected " + (await page.url()) + ")" : "FAILED still on login";
  log("login:", out.steps.login);

  // 2. PDP add to cart
  // discover an in-stock product
  await page.goto(BASE + "/san-pham", { waitUntil: "load", timeout: 45000 });
  await settle(page, 1000);
  let productUrl = await page.$$eval("a[href*='/product/']", (as) => as.map((a) => a.getAttribute("href")).find(Boolean));
  if (productUrl && productUrl.startsWith("http")) productUrl = new URL(productUrl).pathname;
  productUrl = productUrl || "/product/tui-chong-nuoc-ilm-bl01/";
  await page.goto(BASE + productUrl, { waitUntil: "load", timeout: 45000 });
  await settle(page, 1200);
  await shot(page, "02-pdp-top");

  // if add-to-cart disabled and variants exist, pick first variant option
  const addSel = ".js-add-to-cart-btn";
  let disabled = await page.$eval(addSel, (b) => b.disabled).catch(() => true);
  if (disabled) {
    const opts = await page.$$(".size button, .size [role='radio'], .bb-variant-option, .size label");
    for (const o of opts.slice(0, 6)) { await o.click().catch(() => {}); await page.waitForTimeout(300); }
    disabled = await page.$eval(addSel, (b) => b.disabled).catch(() => true);
  }
  out.steps.addBtnDisabled = disabled;
  // tap targets of in-page buttons
  out.steps.pdpButtons = await page.$$eval(".bb-wp-buttons-row button", (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; }));
  if (!disabled) {
    await page.click(addSel);
    await page.waitForTimeout(2500);
    await shot(page, "03-pdp-after-add");
    out.steps.addToCart = "clicked";
    // cart count badge in bottom nav
    out.steps.cartBadge = await page.evaluate(() => {
      const b = document.querySelector(".bb-bottom-nav [aria-label='Mở giỏ hàng'] span");
      return b ? b.textContent.trim() : "none";
    });
  } else {
    out.steps.addToCart = "SKIPPED (disabled)";
  }

  // 3. Open cart sheet with item
  await page.click("[aria-label='Mở giỏ hàng']").catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "04-cart-sheet-items");
  out.steps.cartSheetItems = await page.$$eval(".bb-mobile-cart-line", (els) => els.length).catch(() => 0);
  // qty + button tap targets
  out.steps.cartSheetControls = await page.$$eval(".bb-mobile-cart-qty button, .bb-mobile-cart-remove, .bb-mobile-cart-primary", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { c: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; })).catch(() => []);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  // 4. Cart page
  await page.goto(BASE + "/gio-hang", { waitUntil: "load", timeout: 45000 });
  await settle(page, 1200);
  await shot(page, "05-cart-page", true);
  out.steps.cartPageLines = await page.$$eval("[class*='cart-line'], [class*='cart-item'], tr", (els) => els.length).catch(() => 0);

  // 5. Checkout page
  await page.goto(BASE + "/thanh-toan", { waitUntil: "load", timeout: 45000 });
  await settle(page, 1500);
  await shot(page, "06-checkout", true);
  await shot(page, "06-checkout-viewport");
  out.steps.checkoutHasForm = await page.$$eval("input, textarea, select", (els) => els.length).catch(() => 0);

  // 6. Account
  await page.goto(BASE + "/tai-khoan", { waitUntil: "load", timeout: 45000 });
  await settle(page, 1000);
  await shot(page, "07-account", true);
  out.steps.account = (await page.url());
} catch (e) {
  out.error = String(e).slice(0, 300);
  log("ERROR", out.error);
}

writeFileSync(join(OUT, "auth-findings.json"), JSON.stringify(out, null, 2));
await browser.close();
console.log(JSON.stringify(out.steps, null, 1));
console.log("console errors:", out.console.length);
log("done. out:", OUT);
