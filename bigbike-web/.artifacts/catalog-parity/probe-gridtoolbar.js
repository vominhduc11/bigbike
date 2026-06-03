// A/B computed-style probe for the catalog archive grid + toolbar migration.
// Anchors elements STRUCTURALLY from #main-content (classes differ old↔new).
// Modes:
//   node probe-gridtoolbar.js capture <baseURL> <out.json>
//   node probe-gridtoolbar.js diff <old.json> <new.json>
// Baseline OLD = HEAD built locally on :3002 (docker :3000 is a STALE image
// from before the catalog migration commits, so it is NOT a valid baseline).
const fs = require("fs");
const { chromium } = require("playwright");

const URL_PATH = "/san-pham/";
const WIDTHS = [360, 390, 800, 1280, 2560];

const SPECS = {
  rail: ["width"],
  row: ["display", "flexWrap", "marginLeft", "marginRight"],
  sidebarCol: ["paddingLeft", "paddingRight", "minWidth", "flexBasis", "maxWidth", "width"],
  mainCol: ["paddingLeft", "paddingRight", "flexBasis", "maxWidth", "width"],
  inner: ["paddingLeft", "paddingRight", "marginLeft", "marginRight", "width"],
  toolbar: ["position", "top", "backgroundColor", "zIndex", "marginLeft", "marginRight",
    "borderBottomWidth", "borderBottomStyle", "borderBottomColor",
    "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "backdropFilter"],
  toolbarRow: ["display", "flexWrap", "alignItems", "marginLeft", "marginRight"],
  resultCol: ["paddingLeft", "paddingRight", "flexBasis", "maxWidth", "order", "width"],
  resultDiv: ["minHeight", "marginTop", "marginBottom", "fontSize", "fontWeight", "lineHeight"],
  sortCol: ["textAlign", "paddingLeft", "paddingRight", "flexBasis", "maxWidth", "order", "width"],
  orderingForm: ["display", "width", "maxWidth", "marginTop", "marginBottom", "marginLeft", "marginRight"],
  formSelectDiv: ["position", "width", "minWidth", "maxWidth", "marginBottom"],
  formSelectAfter: ["content", "position", "top", "right", "width", "height",
    "borderRightWidth", "borderRightColor", "borderBottomWidth", "borderBottomColor",
    "transform", "pointerEvents"],
  selectEl: ["height", "minHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderTopStyle", "borderTopColor", "borderRadius",
    "backgroundColor", "color", "fontSize", "fontWeight", "fontFamily",
    "textTransform", "appearance", "lineHeight", "textAlign", "width"],
  filterWrap: ["display", "order", "paddingLeft", "paddingRight", "flexBasis", "maxWidth", "marginBottom", "width"],
  filterBtn: ["width", "borderTopWidth", "borderTopStyle", "backgroundColor", "color", "textAlign", "cursor"],
  filterP: ["position", "height", "minHeight", "marginTop", "marginBottom",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderTopColor", "borderRightWidth", "borderBottomWidth",
    "borderLeftWidth", "borderLeftStyle",
    "fontSize", "fontWeight", "lineHeight", "fontFamily"],
  filterI: ["position", "top", "right", "transform"],
  // gridTemplateColumns intentionally omitted: a flex container reports its
  // *specified* template-columns, not "none", so it is misleading under flex.
  grid: ["display", "columnGap", "rowGap", "marginLeft", "marginRight", "alignItems", "flexWrap"],
  cardCol: ["paddingLeft", "paddingRight", "flexBasis", "maxWidth", "minWidth", "width"],
};

async function collect(page) {
  return page.evaluate((SPECS) => {
    const out = {};
    const grab = (el, props, pseudo) => {
      if (!el) return { __missing: true };
      const s = getComputedStyle(el, pseudo || undefined);
      const o = {};
      for (const p of props) o[p] = s[p];
      return o;
    };
    const main = document.querySelector("#main-content");
    if (!main) return { __error: "no #main-content" };
    const rail = main.querySelector(":scope > div");
    const row = rail && rail.querySelector(":scope > div");
    const sidebarCol = row && row.children[0];
    const mainCol = row && row.children[1];
    const pb10 = mainCol && mainCol.children[0];
    const inner = pb10 && pb10.children[0];
    const toolbar = inner && inner.children[0];
    const toolbarRow = toolbar && toolbar.children[0];
    const resultCol = toolbarRow && toolbarRow.children[0];
    const resultDiv = resultCol && resultCol.children[0];
    const sortCol = toolbarRow && toolbarRow.children[1];
    const orderingForm = sortCol && sortCol.querySelector("form");
    const formSelectDiv = orderingForm && orderingForm.querySelector("div");
    const selectEl = formSelectDiv && formSelectDiv.querySelector("select");
    const filterWrap = toolbarRow && toolbarRow.children[2];
    const filterBtn = filterWrap && filterWrap.querySelector("button");
    const filterP = filterBtn && filterBtn.querySelector("p");
    const filterI = filterP && filterP.querySelector("i");
    const product = inner && inner.children[1];
    const grid = product && product.children[0];
    const cardCol = grid && grid.children[0];

    out.rail = grab(rail, SPECS.rail);
    out.row = grab(row, SPECS.row);
    out.sidebarCol = grab(sidebarCol, SPECS.sidebarCol);
    out.mainCol = grab(mainCol, SPECS.mainCol);
    out.inner = grab(inner, SPECS.inner);
    out.toolbar = grab(toolbar, SPECS.toolbar);
    out.toolbarRow = grab(toolbarRow, SPECS.toolbarRow);
    out.resultCol = grab(resultCol, SPECS.resultCol);
    out.resultDiv = grab(resultDiv, SPECS.resultDiv);
    out.sortCol = grab(sortCol, SPECS.sortCol);
    out.orderingForm = grab(orderingForm, SPECS.orderingForm);
    out.formSelectDiv = grab(formSelectDiv, SPECS.formSelectDiv);
    out.formSelectAfter = grab(formSelectDiv, SPECS.formSelectAfter, "::after");
    out.selectEl = grab(selectEl, SPECS.selectEl);
    out.filterWrap = grab(filterWrap, SPECS.filterWrap);
    out.filterBtn = grab(filterBtn, SPECS.filterBtn);
    out.filterP = grab(filterP, SPECS.filterP);
    out.filterI = grab(filterI, SPECS.filterI);
    out.grid = grab(grid, SPECS.grid);
    out.cardCol = grab(cardCol, SPECS.cardCol);
    return out;
  }, SPECS);
}

async function capture(base, outFile) {
  const browser = await chromium.launch();
  const all = {};
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 1100 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#main-content .product", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600);
    all[w] = await collect(page);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(outFile, JSON.stringify(all, null, 2));
  console.log("captured", base, "->", outFile);
}

function diff(oldFile, newFile) {
  const O = JSON.parse(fs.readFileSync(oldFile, "utf8"));
  const N = JSON.parse(fs.readFileSync(newFile, "utf8"));
  let total = 0;
  for (const w of WIDTHS) {
    const od = O[w] || {}, nd = N[w] || {};
    const diffs = [];
    for (const key of Object.keys(SPECS)) {
      const o = od[key] || {}, n = nd[key] || {};
      if (o.__missing || n.__missing) {
        diffs.push(`${key}: MISSING old=${!!o.__missing} new=${!!n.__missing}`);
        continue;
      }
      for (const p of SPECS[key]) {
        let ov = o[p], nv = n[p];
        if (/px$/.test(String(ov)) && /px$/.test(String(nv))) {
          if (Math.abs(parseFloat(ov) - parseFloat(nv)) <= 0.6) continue;
        }
        if (ov !== nv) diffs.push(`${key}.${p}: OLD="${ov}" NEW="${nv}"`);
      }
    }
    if (diffs.length) {
      total += diffs.length;
      console.log(`\n=== @${w} : ${diffs.length} MISMATCH ===`);
      for (const d of diffs) console.log("  " + d);
    } else console.log(`@${w}: 0 mismatch ✓`);
  }
  console.log(`\nTOTAL MISMATCH: ${total}`);
}

(async () => {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === "capture") await capture(a, b);
  else if (mode === "diff") diff(a, b);
  else console.log("usage: capture <base> <out> | diff <old> <new>");
})();
