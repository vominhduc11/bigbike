import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3011";
const DIR = ".artifacts/verify-fixes";
fs.mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const report = {};

// ───────────────────────── 1. CHECKOUT FIELD ERROR (real flow) ─────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 760, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/thanh-toan/", { waitUntil: "networkidle", timeout: 45000 });
  // Trigger react-hook-form validation: click any submit/place-order button
  const btnTexts = ["Đặt hàng", "Thanh toán", "Hoàn tất", "Tiếp tục", "Xác nhận"];
  let clicked = false;
  for (const tx of btnTexts) {
    const b = page.locator(`button:has-text("${tx}")`).first();
    if (await b.count()) { await b.click().catch(() => {}); clicked = true; break; }
  }
  if (!clicked) {
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.count()) { await submit.click().catch(() => {}); }
  }
  await page.waitForTimeout(800);
  // measure a FieldError <p> if present
  const err = await page.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((el) =>
      /thông tin|bắt buộc|hợp lệ|nhập|vui lòng|required|invalid/i.test(el.textContent || "") &&
      getComputedStyle(el).color !== "rgb(0, 0, 0)" && el.className.includes("text-brand"));
    if (!p) return null;
    const cs = getComputedStyle(p);
    return { text: (p.textContent || "").slice(0, 60), color: cs.color, fontSize: cs.fontSize, marginTop: cs.marginTop };
  });
  report.checkoutError = err || "no validation error rendered (cart may be empty / form not submitted)";
  await page.screenshot({ path: `${DIR}/1-checkout-error.png` });
  await ctx.close();
}

// ───────────────────────── 2. SKELETON FIXES + productGrid (injection) ─────────────────────────
// Inject the exact fixed markup into the live /san-pham CSS context, screenshot + measure.
const SHIMMER =
  "block animate-skeleton-shimmer bg-[linear-gradient(90deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.04)_100%)] bg-[length:200%_100%]";

const HARNESS = (shimmer) => `
  <div id="verify-root" style="padding:24px;background:#fff;font-family:sans-serif">
    <h3 style="margin:0 0 8px">1) productGrid (favorites grid + catalog skeleton — shared const)</h3>
    <div id="vg" class="grid grid-cols-1 gap-6 min-[576px]:grid-cols-2 min-[992px]:grid-cols-3">
      ${Array.from({length:6}).map(()=>`<div style="height:120px;border:1px solid #ddd;background:#f3f3f3"></div>`).join("")}
    </div>
    <h3 style="margin:20px 0 8px">2) bb-cat-grid-img → grid + bb-cat-img-cell → relative aspect-square</h3>
    <div id="vcat" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${Array.from({length:4}).map(()=>`<div class="relative aspect-square"><span class="${shimmer}" style="position:absolute;inset:0"></span></div>`).join("")}
    </div>
    <h3 style="margin:20px 0 8px">3) bb-filters-v2 → self-start border-r pr-7 (sidebar)</h3>
    <div style="display:grid;grid-template-columns:220px 1fr;gap:28px">
      <aside id="vfilter" class="self-start border-r border-[var(--bb-border-subtle)] pr-7">
        ${Array.from({length:4}).map(()=>`<div class="${shimmer}" style="height:14px;margin:10px 0"></div>`).join("")}
      </aside>
      <div style="color:#999">(content column)</div>
    </div>
  </div>`;

async function injectShot(width, file) {
  const ctx = await browser.newContext({ viewport: { width, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/san-pham/", { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate((html) => {
    document.body.innerHTML = html;
    window.scrollTo(0, 0);
  }, HARNESS(SHIMMER));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m = await page.evaluate(() => {
    const cols = (id) => getComputedStyle(document.getElementById(id)).gridTemplateColumns;
    const cell = document.querySelector("#vcat > div");
    const cc = getComputedStyle(cell);
    const fil = getComputedStyle(document.getElementById("vfilter"));
    return {
      productGridCols: cols("vg"),
      catGridCols: cols("vcat"),
      catCell: { position: cc.position, aspectRatio: cc.aspectRatio, w: Math.round(cell.getBoundingClientRect().width), h: Math.round(cell.getBoundingClientRect().height) },
      filterSidebar: { alignSelf: fil.alignSelf, borderRight: fil.borderRightWidth + " " + fil.borderRightStyle, paddingRight: fil.paddingRight },
    };
  });
  await page.screenshot({ path: `${DIR}/${file}`, fullPage: true });
  await ctx.close();
  return m;
}

report.inject_390 = await injectShot(390, "2-skeletons-390.png");
report.inject_768 = await injectShot(768, "2-skeletons-768.png");
report.inject_1280 = await injectShot(1280, "2-skeletons-1280.png");

await browser.close();
fs.writeFileSync(`${DIR}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
