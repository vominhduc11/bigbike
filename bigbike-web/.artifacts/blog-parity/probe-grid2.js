// A/B layout probe for the blog-listing grid (bb-wp-row/sidebar/content-col/card-col) on /tin-tuc.
// Measures element widths + key props at breakpoints. Modes: capture <base> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const VIEWPORTS = [1280, 768, 767, 576, 575, 390];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto(base + "/tin-tuc/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#main-content section", { timeout: 60000 }).catch(() => {});
    result[vw] = await page.evaluate(() => {
      const round = (n) => Math.round(n * 100) / 100;
      const main = document.querySelector("#main-content");
      const aside = main ? main.querySelector("aside") : null;
      const section = main ? main.querySelector("section") : null;
      const row = section ? section.querySelector(".news-list > div") : null; // inner flex row
      const card = row ? row.children[0] : null;
      const rect = (el) => el ? round(el.getBoundingClientRect().width) : null;
      const grab = (el, props) => { if (!el) return null; const cs = getComputedStyle(el); const o = {}; for (const p of props) o[p] = cs[p]; return o; };
      return {
        asideW: rect(aside),
        asideDisplay: aside ? getComputedStyle(aside).display : null,
        sectionW: rect(section),
        cardW: rect(card),
        cardDisplay: card ? getComputedStyle(card).display : null,
        row: grab(row, ["display","flexWrap","marginLeft","marginRight"]),
        cardCol: grab(card, ["paddingLeft","paddingRight","marginBottom","flexDirection"]),
      };
    });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out);
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
