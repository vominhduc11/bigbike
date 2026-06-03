import { chromium } from "playwright";

const API = "http://localhost:8080";
const OUT = "C:/Users/ADMIN/OneDrive/Documents/bigbike/.artifacts/cart-parity";
const CREDS = { login: "duc237022@gmail.com", password: "12345678", remember: true };

async function apiInPage(page, method, path, body) {
  return page.evaluate(
    async ({ API, method, path, body }) => {
      const csrf = (document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]*)/) || [])[1];
      const headers = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (method !== "GET" && csrf) headers["X-CSRF-Token"] = decodeURIComponent(csrf);
      const res = await fetch(API + path, {
        method,
        credentials: "include",
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      let payload = null;
      try { payload = await res.json(); } catch {}
      return { ok: res.ok, status: res.status, payload };
    },
    { API, method, path, body },
  );
}

async function openCartSheet(page, base) {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.click('button[aria-label="Mở giỏ hàng"]');
  await page.waitForSelector("[data-bb-sheet-content]", { state: "visible" });
  // wait for cart query to settle: either a line article or the empty/state text
  await page.waitForTimeout(900);
}

async function shot(page, name) {
  const el = await page.$("[data-bb-sheet-content]");
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();

  // bootstrap csrf + login on :3000 (cookies shared across ports)
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const login = await apiInPage(page, "POST", "/api/v1/customer/auth/login", CREDS);
  console.log("login", login.status, login.ok);

  // clear any existing cart, then seed known in-stock variants (2 lines)
  await apiInPage(page, "DELETE", "/api/v1/cart/clear");
  const seed = [
    { productId: "wp-prod-6093", productVariantId: "wp-var-6094", quantity: 2 },
    { productId: "wp-prod-6093", productVariantId: "wp-var-6095", quantity: 1 },
  ];
  let added = 0;
  for (const it of seed) {
    const r = await apiInPage(page, "POST", "/api/v1/cart/items", it);
    console.log("add", it.productVariantId, r.status, r.ok, r.ok ? "" : JSON.stringify(r.payload?.error ?? r.payload));
    if (r.ok) added++;
  }
  console.log("added", added);

  // FILLED
  for (const [base, port] of [["http://localhost:3000", "3000"], ["http://localhost:3001", "3001"]]) {
    await openCartSheet(page, base);
    await shot(page, `${port}-filled`);
  }

  // EMPTY
  await apiInPage(page, "DELETE", "/api/v1/cart/clear");
  for (const [base, port] of [["http://localhost:3000", "3000"], ["http://localhost:3001", "3001"]]) {
    await openCartSheet(page, base);
    await shot(page, `${port}-empty`);
  }

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
