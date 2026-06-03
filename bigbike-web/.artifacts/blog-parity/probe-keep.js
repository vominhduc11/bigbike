// Verify the kept members of the split groups render identically (the A2 splits
// only removed dead bb-news-* selectors). Inject bare elements with the kept
// classes, read key props at several widths. Usage: capture <base> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const WIDTHS = [1280, 700, 500];
const TARGETS = [
  { cls: "bb-cat-hero-title", props: ["fontSize", "lineHeight", "color", "fontFamily", "textTransform"] },
  { cls: "bb-products-section", props: ["paddingTop", "paddingBottom", "backgroundColor"] },
  { cls: "bb-experience", props: ["paddingTop", "paddingBottom", "backgroundColor"] },
  { cls: "bb-seo-content", props: ["paddingTop", "paddingBottom", "backgroundColor"] },
];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    result[w] = await page.evaluate((TARGETS) => {
      const out = {};
      for (const t of TARGETS) {
        const el = document.createElement(t.cls === "bb-cat-hero-title" ? "h1" : "section");
        el.className = t.cls;
        el.textContent = "Probe";
        document.body.appendChild(el);
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of t.props) o[p] = cs[p];
        out[t.cls] = o;
      }
      return out;
    }, TARGETS);
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out);
}
function diff(of, nf) {
  const o = JSON.parse(fs.readFileSync(of, "utf8")), n = JSON.parse(fs.readFileSync(nf, "utf8"));
  let m = 0;
  for (const w of Object.keys(o)) for (const cls of Object.keys(o[w])) for (const p of Object.keys(o[w][cls])) {
    if (String(o[w][cls][p]) !== String(n[w][cls][p])) { m++; console.log(`MISMATCH @${w} ${cls}.${p}: OLD=${o[w][cls][p]} NEW=${n[w][cls][p]}`); }
  }
  console.log(m === 0 ? "✅ 0 MISMATCHES (kept members unchanged)" : `❌ ${m} MISMATCHES`);
}
const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") capture(a, b).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "diff") diff(a, b);
