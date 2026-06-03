// A/B probe for detail blog-meta + social-sharing on /tin-tuc/<slug>.
// Modes: capture <base> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const SLUG = "tai-nghe-bluetooth-5-3-la-gi";
const VIEWPORTS = [1280, 390];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1600 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/tin-tuc/${SLUG}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("a[aria-label='Facebook']", { timeout: 30000 }).catch(() => {});
    result[vw] = await page.evaluate(() => {
      const grab = (el, props, pseudo) => { if (!el) return { __missing: true }; const cs = getComputedStyle(el, pseudo || null); const o = {}; for (const p of props) o[p] = cs[p]; return o; };
      const categoryP = document.querySelector("#main-content p.category");
      const meta = categoryP ? categoryP.parentElement : null;
      const categoryA = categoryP ? categoryP.querySelector("a") : null;
      const dateP = categoryP ? categoryP.nextElementSibling : null;
      const fb = document.querySelector("a[aria-label='Facebook']");
      const social = fb ? fb.parentElement : null;
      const socialP = social ? social.querySelector("p") : null;
      const fbI = fb ? fb.querySelector("i") : null;
      const tw = document.querySelector("a[aria-label='Twitter']");
      const blog = social ? social.parentElement : null;
      const thumb = blog ? blog.children[0] : null;
      if (!categoryP || !fb) return { __missing: true };
      return {
        blog: grab(blog, ["marginBottom","paddingBottom"]),
        thumb: grab(thumb, ["marginTop","marginBottom"]),
        meta: grab(meta, ["marginTop","marginBottom"]),
        categoryP: grab(categoryP, ["display","marginTop","color","fontSize","lineHeight"]),
        categoryAfter: grab(categoryP, ["content","marginLeft","color","display"], "::after"),
        categoryA: grab(categoryA, ["color","fontWeight","textDecorationLine"]),
        dateP: grab(dateP, ["display","color","fontSize"]),
        dateAfter: grab(dateP, ["content"], "::after"),
        social: grab(social, ["display","alignItems","paddingTop","paddingBottom","borderTopStyle","borderTopWidth","borderTopColor","borderBottomColor"]),
        socialP: grab(socialP, ["marginRight","color","fontWeight","lineHeight"]),
        fb: grab(fb, ["display","width","height","marginRight","borderTopLeftRadius","color","fontSize","fontWeight","backgroundColor","textDecorationLine"]),
        fbBefore: grab(fbI, ["content"], "::before"),
        tw: grab(tw, ["backgroundColor"]),
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
