import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const WIDTHS = [390, 360, 320]; // common phones (iPhone 12, small Android, very small)
const SEED = [
  "/", "/san-pham", "/tim-kiem", "/gio-hang", "/thanh-toan", "/lien-he",
  "/bao-hanh", "/brands", "/gioi-thieu", "/huong-dan", "/huong-dan-mua-hang",
  "/so-sanh", "/tin-tuc", "/dang-nhap", "/dang-ky", "/quen-mat-khau",
  "/tin-tuc/page-02661999fa881de9", "/khong-ton-tai-404-test",
];

async function collectLinks(page) {
  return await page.$$eval("a[href]", (as) =>
    Array.from(new Set(as.map((a) => a.getAttribute("href"))))
      .filter((h) => h && h.startsWith("/") && !h.startsWith("//"))
  );
}

// In-page: does the doc overflow horizontally, and which elements stick out past the right edge?
function measure() {
  const docW = document.documentElement.scrollWidth;
  const winW = window.innerWidth;
  const overflow = docW - winW;
  const offenders = [];
  if (overflow > 1) {
    const all = document.querySelectorAll("*");
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // element extends past the right viewport edge by a meaningful amount
      if (r.right > winW + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") || "").slice(0, 120),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
    // keep the widest few, dedup-ish by trimming
    offenders.sort((a, b) => b.right - a.right);
  }
  return { docW, winW, overflow, offenders: offenders.slice(0, 6) };
}

const browser = await chromium.launch();
const seen = new Set();
const queue = [...SEED];
const results = [];

// First pass at 390 to also harvest links from key listing pages
const harvestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const hp = await harvestCtx.newPage();
for (const p of ["/", "/san-pham", "/brands", "/tin-tuc"]) {
  try {
    await hp.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 });
    const links = await collectLinks(hp);
    for (const pre of ["/product/", "/danh-muc-san-pham/", "/brands/", "/chinh-sach/", "/tin-tuc/"]) {
      const sample = links.filter((l) => l.startsWith(pre)).slice(0, 2);
      for (const s of sample) if (!queue.includes(s)) queue.push(s);
    }
  } catch (e) { /* ignore */ }
}
await harvestCtx.close();

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const route of queue) {
    const key = w + " " + route;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(measure);
      results.push({ width: w, route, status: resp ? resp.status() : 0, ...m });
    } catch (e) {
      results.push({ width: w, route, error: String(e).slice(0, 80) });
    }
  }
  await ctx.close();
}
await browser.close();

const bad = results.filter((r) => r.overflow > 1);
console.log("\n===== HORIZONTAL OVERFLOW AUDIT (mobile) =====");
console.log("routes tested:", queue.length, "| width x route checks:", results.length);
console.log("OVERFLOWING:", bad.length);
for (const b of bad) {
  console.log(`\n[${b.width}px] ${b.route}  (+${b.overflow}px over ${b.winW})  status=${b.status}`);
  for (const o of b.offenders) console.log(`   ${o.tag}.${o.cls}  right=${o.right} w=${o.width}`);
}
if (bad.length === 0) console.log("\n✅ No horizontal overflow on any tested public route at 320/360/390px.");
console.log("\n--- routes covered ---");
console.log(queue.join("  "));
