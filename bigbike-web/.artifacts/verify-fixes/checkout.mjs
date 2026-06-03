import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3011";
const DIR = ".artifacts/verify-fixes";
const browser = await chromium.launch();
const out = {};

const ctx = await browser.newContext({ viewport: { width: 780, height: 1200 } });
const page = await ctx.newPage();

// 1) add a product to the (guest) cart
await page.goto(BASE + "/product/tui-chong-nuoc-ilm-bl01/", { waitUntil: "networkidle", timeout: 45000 });
let added = false;
for (const sel of [".js-add-to-cart-btn", 'button:has-text("Thêm vào giỏ")', 'button:has-text("Mua ngay")', 'button:has-text("Thêm")']) {
  const b = page.locator(sel).first();
  if (await b.count()) { await b.click().catch(() => {}); added = true; break; }
}
await page.waitForTimeout(2000);
out.addedToCart = added;

// 2) go to checkout
await page.goto(BASE + "/thanh-toan/", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1000);
const hasForm = await page.locator("input, form").count();
out.checkoutHasForm = hasForm > 0;

// 3) trigger validation (submit empty)
for (const tx of ["Đặt hàng", "Hoàn tất đơn", "Thanh toán", "Hoàn tất", "Tiếp tục", "Xác nhận đơn"]) {
  const b = page.locator(`button:has-text("${tx}")`).first();
  if (await b.count()) { await b.scrollIntoViewIfNeeded().catch(()=>{}); await b.click().catch(() => {}); break; }
}
await page.waitForTimeout(1000);

// measure any rendered field error
out.realError = await page.evaluate(() => {
  const ps = [...document.querySelectorAll("p.text-brand, p")].filter((el) => el.className.includes("text-brand"));
  return ps.slice(0, 3).map((p) => {
    const cs = getComputedStyle(p);
    return { text: (p.textContent || "").slice(0, 50), color: cs.color, fontSize: cs.fontSize, marginTop: cs.marginTop };
  });
});
await page.screenshot({ path: `${DIR}/1b-checkout-real.png`, fullPage: true });

// 4) GUARANTEED visual: inject the exact FieldError output and measure color
out.injectedError = await page.evaluate(() => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;top:8px;left:8px;z-index:99999;background:#fff;border:1px solid #ccc;padding:14px;width:320px";
  host.innerHTML = `
    <label style="font-size:13px;color:#333">Họ và tên</label>
    <input style="display:block;width:100%;border:1px solid #ddd;padding:8px;margin-top:4px" />
    <p class="m-0 mt-1 text-sm text-brand" id="fe">Vui lòng nhập họ và tên</p>`;
  document.body.appendChild(host);
  const p = document.getElementById("fe");
  const cs = getComputedStyle(p);
  return { color: cs.color, fontSize: cs.fontSize, marginTop: cs.marginTop, marginBottom: cs.marginBottom };
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${DIR}/1c-checkout-fielderror-injected.png` });

await browser.close();
fs.writeFileSync(`${DIR}/checkout-report.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
