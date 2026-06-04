import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.BB_EMAIL;
const PASS = process.env.BB_PASS;
const WIDTHS = [390, 360, 320];
const ACCOUNT_ROUTES = [
  "/tai-khoan/",
  "/tai-khoan/don-hang/",
  "/tai-khoan/edit-account/",
  "/tai-khoan/edit-address/billing/",
  "/tai-khoan/edit-address/shipping/",
  "/tai-khoan/yeu-thich/",
  "/tai-khoan/doi-tra/",
];

function measure() {
  const docW = document.documentElement.scrollWidth;
  const winW = window.innerWidth;
  const overflow = docW - winW;
  const offenders = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > winW + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") || "").slice(0, 110),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
    offenders.sort((a, b) => b.right - a.right);
  }
  return { docW, winW, overflow, offenders: offenders.slice(0, 5) };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// --- login ---
await page.goto(BASE + "/dang-nhap/", { waitUntil: "networkidle", timeout: 30000 });
await page.fill("#login-username", EMAIL);
await page.fill("#login-password", PASS);
await Promise.all([
  page.waitForLoadState("networkidle"),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1500);
// confirm auth by visiting dashboard
await page.goto(BASE + "/tai-khoan/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);
const loggedIn = !page.url().includes("/dang-nhap");
console.log("login url after:", page.url(), "| loggedIn:", loggedIn);
if (!loggedIn) { console.log("LOGIN FAILED"); await browser.close(); process.exit(1); }

// harvest an order detail link
let orderDetail = null;
try {
  await page.goto(BASE + "/tai-khoan/don-hang/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => a.getAttribute("href")).filter((h) => h && /\/tai-khoan\/don-hang\/[^/]+\/?$/.test(h))
  );
  if (links.length) orderDetail = links[0];
} catch {}
const routes = orderDetail ? [...ACCOUNT_ROUTES, orderDetail] : ACCOUNT_ROUTES;

const results = [];
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 844 });
  for (const route of routes) {
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(500);
      const m = await page.evaluate(measure);
      results.push({ width: w, route, status: resp ? resp.status() : 0, ...m });
    } catch (e) {
      results.push({ width: w, route, error: String(e).slice(0, 80) });
    }
  }
}
await browser.close();

const bad = results.filter((r) => r.overflow > 1);
console.log("\n===== ACCOUNT AREA OVERFLOW AUDIT (logged in, current running build) =====");
console.log("routes:", routes.join("  "));
console.log("checks:", results.length, "| OVERFLOWING:", bad.length);
for (const b of bad) {
  console.log(`\n[${b.width}px] ${b.route}  (+${b.overflow}px over ${b.winW})`);
  for (const o of b.offenders) console.log(`   ${o.tag}.${o.cls}  right=${o.right} w=${o.width}`);
}
if (bad.length === 0) console.log("\n✅ No overflow on any account route.");
