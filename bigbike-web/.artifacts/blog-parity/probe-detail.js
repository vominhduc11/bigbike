// A/B probe for detail blog cards + widget + related-title + bootstrap grid on /tin-tuc/<slug>.
// Structural anchors only (classes change old->new). Modes: capture <base> <out> | diff <old> <new>
const { chromium } = require("playwright");
const fs = require("fs");
const SLUG = "tai-nghe-bluetooth-5-3-la-gi";
const VIEWPORTS = [2560, 1920, 1536, 1280, 768, 767, 576, 575, 390];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1600 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/tin-tuc/${SLUG}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#related", { timeout: 30000 }).catch(() => {});
    result[vw] = await page.evaluate(() => {
      const grab = (el, props, pseudo) => {
        if (!el) return { __missing: true };
        const cs = getComputedStyle(el, pseudo || null);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const BOX = ["width", "maxWidth", "flexGrow", "flexShrink", "flexBasis", "paddingLeft", "paddingRight", "position"];
      const mc = document.getElementById("main-content");
      const mainContainer = mc && mc.children[0];
      const mainRow = mainContainer && mainContainer.children[0];
      const colMd8 = mainRow && mainRow.children[0];
      const colMd4 = mainRow && mainRow.children[1];
      const widget1 = colMd4 && colMd4.children[0];
      const wTitleH3 = widget1 && widget1.children[0] && widget1.children[0].querySelector("h3");
      const wBody = widget1 && widget1.children[1];
      const newsList = wBody && wBody.children[0];
      const wRow = newsList && newsList.children[0];
      const wCol = wRow && wRow.children[0];
      const sItem = wCol && wCol.children[0];
      const sThumb = sItem && sItem.children[0];
      const sDesc = sItem && sItem.children[1];
      const sDate = sDesc && sDesc.children[0];
      const sDateP0 = sDate && sDate.children[0];
      const sInside = sDesc && sDesc.children[1];
      const sInsideH3 = sInside && sInside.querySelector("h3");
      const sInsideA = sInsideH3 && sInsideH3.querySelector("a");
      const sExcerpt = sInside && sInside.querySelector(":scope > p");

      const rel = document.getElementById("related");
      const relContainer = rel && rel.children[0];
      const relTitleH3 = relContainer && relContainer.children[0] && relContainer.children[0].querySelector("h3");
      const relRow = relContainer && relContainer.children[1];
      const relCol = relRow && relRow.children[0];
      const rItem = relCol && relCol.children[0];
      const rDesc = rItem && rItem.children[1];
      const rDate = rDesc && rDesc.children[0];
      const rDateP = rDate && rDate.children[0];
      const rInside = rDesc && rDesc.children[1];
      const rTitle = rInside && rInside.children[0];
      const rTitleA = rTitle && rTitle.querySelector("a");
      const rExcerpt = rInside && rInside.children[1];

      return {
        // --- container + grid (c) ---
        mainContainer: grab(mainContainer, ["maxWidth", "marginLeft", "paddingLeft", "paddingRight"]),
        mainRow: grab(mainRow, ["display", "flexWrap", "marginLeft", "marginRight"]),
        colMd8: grab(colMd8, BOX),
        colMd4: grab(colMd4, BOX),
        relContainer: grab(relContainer, ["maxWidth", "marginLeft", "paddingLeft"]),
        relRow: grab(relRow, ["display", "flexWrap", "marginLeft"]),
        relCol: grab(relCol, BOX),
        // --- widget + related title (b) ---
        widget1: grab(widget1, ["marginBottom"]),
        wTitleH3: grab(wTitleH3, ["marginTop", "marginBottom", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform"]),
        relTitleH3: grab(relTitleH3, ["marginTop", "marginBottom", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform"]),
        relSection: grab(rel, ["paddingBottom"]),
        // --- sidebar card (a) ---
        sItem: grab(sItem, ["display", "flexWrap", "marginBottom", "backgroundColor", "paddingBottom", "borderBottomWidth", "borderBottomStyle", "borderBottomColor", "borderTopWidth", "borderTopColor", "boxShadow"]),
        sThumb: grab(sThumb, ["flexGrow", "flexShrink", "flexBasis", "maxWidth"]),
        sDesc: grab(sDesc, ["flexGrow", "flexShrink", "flexBasis", "maxWidth", "backgroundColor"]),
        sDate: grab(sDate, ["display", "flexWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]),
        sDateP0: grab(sDateP0, ["margin", "color", "fontSize", "lineHeight"]),
        sDateP0After: grab(sDateP0, ["content", "marginLeft", "marginRight", "color", "display"], "::after"),
        sInside: grab(sInside, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "backgroundColor"]),
        sInsideH3: grab(sInsideH3, ["marginTop", "marginBottom", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform"]),
        sInsideA: grab(sInsideA, ["color", "textDecorationLine"]),
        sExcerpt: grab(sExcerpt, ["display"]),
        // --- related card (a) ---
        rItem: grab(rItem, ["display", "marginBottom", "backgroundColor", "boxShadow", "borderBottomWidth", "borderTopWidth", "borderTopColor"]),
        rDesc: grab(rDesc, ["backgroundColor"]),
        rDate: grab(rDate, ["display", "flexWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]),
        rDateP: grab(rDateP, ["margin", "color", "fontSize", "lineHeight"]),
        rInside: grab(rInside, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "backgroundColor"]),
        rTitle: grab(rTitle, ["marginTop", "marginBottom", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform"]),
        rTitleA: grab(rTitleA, ["color", "textDecorationLine"]),
        rExcerpt: grab(rExcerpt, ["display", "marginTop", "marginBottom", "color", "fontSize", "lineHeight"]),
      };
    });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out, "| @1280 main missing:", !!(result[1280].colMd8 || {}).__missing, "| rel missing:", !!(result[1280].relCol || {}).__missing);
}

function diff(of, nf, only) {
  const o = JSON.parse(fs.readFileSync(of, "utf8")), n = JSON.parse(fs.readFileSync(nf, "utf8"));
  let m = 0;
  const walk = (a, b, p, vw) => {
    if (a && typeof a === "object") for (const k of Object.keys(a)) walk(a[k], b ? b[k] : undefined, p + "/" + k, vw);
    else if (String(a) !== String(b)) { if (!only || p.includes(only)) { m++; console.log(`MISMATCH @${vw} ${p}: OLD=${a} NEW=${b}`); } }
  };
  for (const vw of Object.keys(o)) walk(o[vw], n[vw], "", vw);
  console.log(m === 0 ? "✅ 0 MISMATCHES" + (only ? " (filter: " + only + ")" : "") : `❌ ${m} MISMATCHES`);
}

const [mode, a, b, c] = process.argv.slice(2);
if (mode === "capture") capture(a, b).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "diff") diff(a, b, c);
