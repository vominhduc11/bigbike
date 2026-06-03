// A/B probe for blog-listing pagination on /tin-tuc/?size=3 (forces >1 page).
// Modes: capture <base> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const VIEWPORTS = [1280, 390];
const URL = "/tin-tuc/?size=3";

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto(base + URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("nav[aria-label='Phân trang bài viết']", { timeout: 30000 }).catch(() => {});
    result[vw] = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-label='Phân trang bài viết']");
      if (!nav) return { __missing: true };
      const grab = (el, props, pseudo) => { if (!el) return { __missing: true }; const cs = getComputedStyle(el, pseudo || null); const o = {}; for (const p of props) o[p] = cs[p]; return o; };
      const outerUl = nav.querySelector("ul");
      const li = nav.querySelector("li");
      const cell = li ? li.querySelector("a, span") : null;
      const current = nav.querySelector("[aria-current='page']");
      const link = nav.querySelector("a"); // first non-current link (black)
      const icon = nav.querySelector("i");
      return {
        nav: grab(nav, ["display","paddingTop","paddingBottom","textAlign"]),
        outerUl: grab(outerUl, ["display","marginTop","paddingLeft","listStyleType","textAlign"]),
        li: grab(li, ["display","paddingLeft","paddingRight","color","fontSize","fontWeight"]),
        cell: grab(cell, ["display","paddingTop","paddingLeft","color","fontSize","textDecorationLine"]),
        link: grab(link, ["display","paddingTop","paddingLeft","color","fontSize","textDecorationLine"]),
        current: grab(current, ["color"]),
        icon: grab(icon, ["fontStyle"]),
        iconBefore: grab(icon, ["content"], "::before"),
      };
    });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out, "| @1280 missing:", !!result[1280].__missing);
}
function diff(of, nf) {
  const o = JSON.parse(fs.readFileSync(of, "utf8")), n = JSON.parse(fs.readFileSync(nf, "utf8"));
  let m = 0; const walk = (a, b, p, vw) => { if (a && typeof a === "object") for (const k of Object.keys(a)) walk(a[k], b ? b[k] : undefined, p + "/" + k, vw); else if (String(a) !== String(b)) { m++; console.log(`MISMATCH @${vw} ${p}: OLD=${a} NEW=${b}`); } };
  for (const vw of Object.keys(o)) walk(o[vw], n[vw], "", vw);
  console.log(m === 0 ? "✅ 0 MISMATCHES" : `❌ ${m} MISMATCHES`);
}
const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") capture(a, b).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "diff") diff(a, b);
