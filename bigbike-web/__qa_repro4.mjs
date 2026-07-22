import { chromium } from "playwright";

const WEB = "http://localhost:3000"; // Docker container, already has the real fix deployed
const API = "http://localhost:8080";
const rand = Math.random().toString(36).slice(2, 8);
const EMAIL = `qa-repro-${rand}@example.com`;
const PASSWORD = "TestPass123!";
const PHONE = `09${Math.floor(10000000 + Math.random() * 89999999)}`;

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: WEB });
const page = await context.newPage();

const qaLog = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (text.startsWith("[QA]")) qaLog.push(text);
});

// ---- Setup ----
await page.goto("/", { waitUntil: "load" });
await page.evaluate(
  async ({ API, EMAIL, PASSWORD, PHONE }) => {
    await fetch(`${API}/api/v1/customer/auth/register`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, phone: PHONE, firstName: "QA", lastName: "Repro" }),
    });
  }, { API, EMAIL, PASSWORD, PHONE },
);
await page.evaluate(() => window.localStorage.setItem("bb_customer_authenticated", "1"));
await page.evaluate(
  async ({ API }) => {
    function getCsrf() { const m = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]*)/); return m ? decodeURIComponent(m[1]) : ""; }
    await fetch(`${API}/api/v1/customer/addresses`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": getCsrf() },
      body: JSON.stringify({ type: "SHIPPING", fullName: "QA Repro", phone: "0901234567", email: "qa-repro@example.com", country: "VN", province: "Thành phố Hồ Chí Minh", ward: "Phường Hòa Bình", addressLine1: "1 Test Street", isDefault: true }),
    });
  }, { API },
);
await page.evaluate(
  async ({ API }) => {
    function getCsrf() { const m = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]*)/); return m ? decodeURIComponent(m[1]) : ""; }
    await fetch(`${API}/api/v1/cart/items`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": getCsrf() },
      body: JSON.stringify({ productId: "prod_4a4da6ffca804e3a9306e9d51badf0c1", quantity: 1, productVariantId: null }),
    });
  }, { API },
);
console.log("setup done:", EMAIL);

// ---- Visit 1: land on checkout, tag the <html> element and the checkout <form> with a unique marker ----
await page.goto("/gio-hang/", { waitUntil: "load" });
await page.waitForTimeout(1000);
await page.getByRole("link", { name: /ĐẶT HÀNG/i }).first().click();
await page.waitForLoadState("load");
await page.waitForTimeout(2000);

const marker = "qa-marker-" + rand;
const tagResult = await page.evaluate((marker) => {
  document.documentElement.setAttribute("data-qa-marker", marker);
  const form = document.querySelector("[data-checkout-form]");
  if (form) form.setAttribute("data-qa-marker", marker);
  return { htmlTagged: document.documentElement.getAttribute("data-qa-marker"), formFound: !!form };
}, marker);
console.log("VISIT 1: tagged DOM with marker:", JSON.stringify(tagResult));

const provinceAfterVisit1 = await page.getByRole("combobox", { name: "Tỉnh / Thành phố" }).innerText();
console.log("VISIT 1 province select text:", JSON.stringify(provinceAfterVisit1));
console.log("\n=== QA LOG through end of VISIT 1 ===");
console.log(qaLog.join("\n"));
qaLog.length = 0;

// ---- Navigate away and back via pure in-app clicks, repeated 5x ----
for (let i = 2; i <= 6; i++) {
  await page.getByRole("link", { name: "TRANG CHỦ", exact: false }).first().click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: "Giỏ hàng" }).first().click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: /ĐẶT HÀNG/i }).first().click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);

  const province = await page.getByRole("combobox", { name: "Tỉnh / Thành phố" }).innerText();
  const ward = await page.getByRole("combobox", { name: "Phường / Xã" }).innerText().catch(() => "<not a select>");
  console.log(`VISIT ${i} (pure in-app clicks) -> province=${JSON.stringify(province)} ward=${JSON.stringify(ward)}`);
  console.log(`--- QA LOG for VISIT ${i} ---`);
  console.log(qaLog.join("\n"));
  qaLog.length = 0;
}

await browser.close();
