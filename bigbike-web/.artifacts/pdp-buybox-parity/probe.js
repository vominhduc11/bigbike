// Computed-style A/B probe for the PDP buy box. OLD = :3000 (docker, pre-change
// build), NEW = :3001 (local build with the migration). DOM tree is identical
// across both (only classNames changed) so structural selectors resolve the same
// element in each. Compares getComputedStyle for a curated set of leaf elements.
const { chromium } = require("playwright");

const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const PATH = `/product/${SLUG}/`;
const VIEWPORTS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
if (!VIEWPORTS.length) VIEWPORTS.push(1280, 900, 390);

// In-page collector. Returns { "label|prop": value }. Resolvers use only the
// kept markers + structural nth-of-type, which match in both builds.
function collectInPage() {
  const out = {};
  const info = document.querySelector(".bb-wp-pdp-info-col");
  if (!info) return { __error: "no info-col" };
  const kids = (el, tag) => Array.from(el.children).filter((c) => !tag || c.tagName.toLowerCase() === tag);
  const summary = kids(info, "div")[1] || null; // [0]=title, [1]=summary
  const priceCol = summary ? kids(summary, "div")[0] : null;
  const statusCol = summary ? kids(summary, "div")[1] : null;
  const ratingDiv = priceCol ? kids(priceCol, "div")[1] : null;
  const statusP = statusCol ? statusCol.querySelector("p") : null;
  const badgeWrap = statusP ? statusP.querySelector("span") : null;
  const badgeLabel = badgeWrap ? badgeWrap.querySelector("span") : null;
  const sizeDiv = info.querySelector(".size");
  const groupLabel = sizeDiv ? sizeDiv.querySelector("label:not([for])") : null;
  const swatch = sizeDiv ? sizeDiv.querySelector("label[for]") : null;
  const formGroup = swatch ? swatch.parentElement : null;
  const radio = sizeDiv ? sizeDiv.querySelector('input[type="radio"]') : null;
  const buttonsRow = info.querySelector(".bb-wp-buttons-row");
  const addBtn = info.querySelector(".js-add-to-cart-btn");
  const addWrap = buttonsRow ? buttonsRow.parentElement : null;
  const qtyRow = addWrap ? kids(addWrap, "div")[0] : null;
  const qtyInput = document.querySelector("#bb-wp-pdp-qty");
  const qtyUp = qtyInput ? (() => { const g = qtyInput.closest("div").parentElement; return kids(g, "div")[1]?.querySelector("button"); })() : null;
  const fbLink = info.querySelector('a[href*="facebook"]');
  const socialDiv = fbLink ? fbLink.closest("div") : null;
  const socialP = socialDiv ? socialDiv.querySelector("p") : null;
  const priceP = info.querySelector(".js-single-price");
  const del = priceP ? priceP.querySelector("del") : null;
  const ins = priceP ? priceP.querySelector("ins") : null;
  const ratingStar = ratingDiv ? ratingDiv.querySelector("span") : null;
  const ratingP = ratingDiv ? ratingDiv.querySelector("p") : null;
  const titleDiv = kids(info, "div")[0];
  const h1 = info.querySelector("h1");
  const fbSvg = fbLink ? fbLink.querySelector("svg") : null;

  const grab = (label, el, props, pseudo) => {
    if (!el) { out[`${label}|__present`] = "MISSING"; return; }
    const cs = getComputedStyle(el, pseudo || undefined);
    for (const p of props) out[`${label}|${pseudo ? pseudo + " " : ""}${p}`] = cs[p];
  };

  grab("titleDiv", titleDiv, ["marginBottom"]);
  grab("h1", h1, ["fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "textTransform", "letterSpacing", "marginTop", "marginBottom"]);
  grab("summary", summary, ["display", "flexWrap", "marginLeft", "marginRight", "rowGap", "columnGap"]);
  grab("priceCol", priceCol, ["flexGrow", "flexShrink", "flexBasis", "maxWidth", "paddingLeft", "paddingRight"]);
  grab("statusCol", statusCol, ["display", "justifyContent", "flexGrow", "flexShrink", "flexBasis", "maxWidth", "paddingLeft", "paddingRight", "textAlign", "marginTop"]);
  grab("priceP", priceP, ["margin", "fontSize", "fontWeight", "color", "lineHeight"]);
  grab("del", del, ["color", "textDecorationLine"]);
  grab("ins", ins, ["display", "marginTop", "textDecorationLine"]);
  grab("ratingStar", ratingStar, ["display", "color", "fontSize", "letterSpacing", "lineHeight"]);
  grab("ratingStar", ratingStar, ["content"], "::before");
  grab("ratingP", ratingP, ["marginTop", "marginBottom", "color", "fontSize", "lineHeight"]);
  grab("statusP", statusP, ["position", "width", "maxWidth", "height", "marginLeft", "marginRight", "marginTop", "marginBottom", "textAlign", "fontFamily", "fontWeight", "textTransform", "color", "borderTopStyle"]);
  grab("statusP", statusP, ["content", "position", "backgroundColor", "transform", "top", "left", "right", "bottom", "zIndex"], "::after");
  grab("badgeWrap", badgeWrap, ["position", "zIndex", "display", "backgroundColor"]);
  grab("badgeLabel", badgeLabel, ["display", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform"]);
  grab("groupLabel", groupLabel, ["display", "fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "marginBottom", "paddingRight"]);
  grab("swatch", swatch, ["display", "width", "height", "borderTopWidth", "borderTopStyle", "borderTopColor", "backgroundColor", "color", "fontSize", "fontWeight", "lineHeight", "textAlign", "textTransform", "backgroundSize"]);
  grab("formGroup", formGroup, ["position", "display", "width", "height", "cursor", "opacity", "borderTopStyle"]);
  grab("radio", radio, ["position", "width", "height", "opacity", "zIndex"]);
  grab("addWrap", addWrap, ["marginTop"]);
  grab("qtyRow", qtyRow, ["width", "minWidth"]);
  grab("buttonsRow", buttonsRow, ["display", "gridTemplateColumns", "rowGap", "columnGap", "marginTop"]);
  grab("addBtn", addBtn, ["display", "alignItems", "justifyContent", "columnGap", "width", "height", "minHeight", "borderTopStyle", "borderTopLeftRadius", "backgroundColor", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform", "letterSpacing", "cursor"]);
  grab("qtyInput", qtyInput, ["width", "height", "borderTopColor", "borderTopStyle", "borderTopWidth", "borderTopLeftRadius", "textAlign", "color", "fontSize", "fontWeight"]);
  grab("qtyUp", qtyUp, ["display", "width", "height", "borderTopColor", "borderLeftWidth", "color", "fontSize"]);
  grab("socialDiv", socialDiv, ["marginTop", "textAlign"]);
  grab("socialP", socialP, ["display", "margin", "color", "fontSize", "fontWeight", "lineHeight", "textTransform"]);
  grab("fbLink", fbLink, ["display", "marginRight", "color", "fontSize", "textDecorationLine", "verticalAlign"]);
  grab("fbSvg", fbSvg, ["width", "height"]);
  return out;
}

async function snapshot(page, base, vw) {
  await page.setViewportSize({ width: vw, height: 1000 });
  await page.goto(base + PATH, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".bb-wp-pdp-info-col h1", { timeout: 20000 });
  await page.waitForTimeout(1200); // let snapshot query settle
  return page.evaluate(collectInPage);
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const vw of VIEWPORTS) {
    const ctxOld = await browser.newContext();
    const ctxNew = await browser.newContext();
    const pOld = await ctxOld.newPage();
    const pNew = await ctxNew.newPage();
    const oldData = await snapshot(pOld, "http://localhost:3000", vw);
    const newData = await snapshot(pNew, "http://localhost:3001", vw);
    await ctxOld.close();
    await ctxNew.close();
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const diffs = [];
    for (const k of [...keys].sort()) {
      if (oldData[k] !== newData[k]) diffs.push({ k, old: oldData[k], new: newData[k] });
    }
    report[vw] = { count: keys.size, diffs };
    console.log(`\n===== viewport ${vw}px =====  (${keys.size} props, ${diffs.length} mismatches)`);
    for (const d of diffs) console.log(`  ${d.k}\n    OLD: ${d.old}\n    NEW: ${d.new}`);
  }
  await browser.close();
  const fs = require("fs");
  fs.writeFileSync(".artifacts/pdp-buybox-parity/report.json", JSON.stringify(report, null, 2));
  const total = Object.values(report).reduce((n, r) => n + r.diffs.length, 0);
  console.log(`\nTOTAL mismatches: ${total}`);
})();
