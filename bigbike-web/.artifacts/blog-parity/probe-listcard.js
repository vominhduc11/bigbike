// A/B probe for the blog-listing news--* card (WpArticleCard) on /tin-tuc.
// Anchors structurally: first <article> inside #main-content. Classes differ old<->new.
// Modes: capture <baseUrl> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const VIEWPORTS = [1280, 767, 390];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1100 }, deviceScaleFactor: 1 });
    await page.goto(base + "/tin-tuc/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#main-content article", { timeout: 60000 }).catch(() => {});
    result[vw] = await page.evaluate(() => {
      const art = document.querySelector("#main-content article");
      if (!art) return { __missing: true };
      const grab = (el, props, pseudo) => {
        if (!el) return { __missing: true };
        const cs = getComputedStyle(el, pseudo || null);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const desc = art.children[1];
      const inside = desc ? desc.children[desc.children.length - 1] : null;
      const dateDiv = desc && desc.children.length > 1 ? desc.children[0] : null;
      const dateP = dateDiv ? dateDiv.querySelector("p") : null;
      const ps = inside ? inside.querySelectorAll("p") : [];
      const titleP = ps[0] || null;
      const titleA = titleP ? titleP.querySelector("a") : null;
      const excerptP = ps[1] || null;
      return {
        item: grab(art, ["display","flexDirection","flexGrow","marginBottom","backgroundColor","boxShadow","borderTopStyle","borderTopWidth","borderTopColor"]),
        desc: grab(desc, ["position","backgroundColor"]),
        dateDiv: grab(dateDiv, ["paddingTop","paddingRight","paddingBottom","paddingLeft"]),
        dateP: grab(dateP, ["display","marginTop","color","fontFamily","fontSize","fontWeight","lineHeight"]),
        datePBefore: grab(dateP, ["content","marginRight","display"], "::before"),
        inside: grab(inside, ["paddingTop","paddingRight","paddingBottom","paddingLeft","backgroundColor"]),
        titleP: grab(titleP, ["marginTop","marginBottom","fontFamily","fontSize","fontWeight","lineHeight","color"]),
        titleA: grab(titleA, ["color","textDecorationLine"]),
        excerptP: grab(excerptP, ["marginTop","color","fontFamily","fontSize","fontWeight","lineHeight"]),
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
  let m = 0;
  const walk = (a, b, p, vw) => {
    if (a && typeof a === "object") for (const k of Object.keys(a)) walk(a[k], b ? b[k] : undefined, p + "/" + k, vw);
    else if (String(a) !== String(b)) { m++; console.log(`MISMATCH @${vw} ${p}: OLD=${a} NEW=${b}`); }
  };
  for (const vw of Object.keys(o)) walk(o[vw], n[vw], "", vw);
  console.log(m === 0 ? "✅ 0 MISMATCHES" : `❌ ${m} MISMATCHES`);
}
const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") capture(a, b).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "diff") diff(a, b);
