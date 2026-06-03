// A/B probe for the blog-listing category widget on /tin-tuc sidebar.
// Anchor: first <div> in #main-content aside (the widget). Modes: capture <base> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const VIEWPORTS = [1280, 390];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(base + "/tin-tuc/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#main-content aside ul li a", { timeout: 60000 }).catch(() => {});
    result[vw] = await page.evaluate(() => {
      const widget = document.querySelector("#main-content aside > div");
      if (!widget) return { __missing: true };
      const grab = (el, props, pseudo) => { if (!el) return { __missing: true }; const cs = getComputedStyle(el, pseudo || null); const o = {}; for (const p of props) o[p] = cs[p]; return o; };
      const widgetTitle = widget.children[0];
      const h3 = widgetTitle ? widgetTitle.querySelector("h3, div") : null;
      const ul = widget.querySelector("ul");
      const li = ul ? ul.children[0] : null;
      const a = li ? li.querySelector("a") : null;
      const count = a ? a.querySelector("span") : null;
      const inner = count ? count.querySelector("span") : null;
      a && a.setAttribute("data-probe-a", "1");
      return {
        widget: grab(widget, ["paddingBottom","marginBottom","borderBottomStyle","borderBottomWidth","borderBottomColor"]),
        widgetTitle: grab(widgetTitle, ["paddingBottom"]),
        h3: grab(h3, ["marginTop","color","fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","textTransform"]),
        ul: grab(ul, ["marginTop","paddingLeft","listStyleType"]),
        li: grab(li, ["position","marginTop","paddingTop","paddingBottom"]),
        a: grab(a, ["position","display","minHeight","paddingRight","color","fontFamily","fontSize","fontWeight","lineHeight","textDecorationLine"]),
        count: grab(count, ["position","top","right","width","height","color","fontWeight","textAlign"]),
        countAfter: grab(count, ["content","backgroundColor","position","display"], "::after"),
        inner: grab(inner, ["position","zIndex","display","fontSize","lineHeight"]),
      };
    });
    // hover the link to capture hover color (desktop only)
    if (vw === 1280 && !result[vw].__missing) {
      await page.hover("[data-probe-a]");
      await page.waitForTimeout(200);
      result[vw].aHover = await page.evaluate(() => ({ color: getComputedStyle(document.querySelector("[data-probe-a]")).color }));
    }
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
