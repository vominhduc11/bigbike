// Computed-style A/B probe for the PDP SHELL (.bb-wp-pdp wrapper, .bb-wp-pdp-layout
// grid, .bb-wp-pdp-gallery-col / .bb-wp-pdp-info-col columns). OLD = :3000 (docker),
// NEW = :3001 (local build with the migration). The layout container keeps its
// id="pdp-overview"; gallery/info-col keep their marker classes — so structural +
// id + class selectors resolve the same element in both builds.
const { chromium } = require("playwright");

const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const PATH = `/product/${SLUG}/`;
const VIEWPORTS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
// Exact edges around the off-by-one boundaries (1024/1023, 767/768) + tier-3 (1536).
if (!VIEWPORTS.length) VIEWPORTS.push(1600, 1280, 1025, 1024, 1023, 768, 767, 390);

function collectInPage() {
  const out = {};
  const wrap = document.querySelector(".bb-wp-pdp");
  const layout = document.querySelector("#pdp-overview");
  if (!wrap || !layout) return { __error: "no wrap/layout" };
  const gallery = layout.children[0] || null;     // .bb-wp-pdp-gallery-col
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const main = document.querySelector(".bb-main");

  const grab = (label, el, props) => {
    if (!el) { out[`${label}|__present`] = "MISSING"; return; }
    const cs = getComputedStyle(el);
    for (const p of props) out[`${label}|${p}`] = cs[p];
    const r = el.getBoundingClientRect();
    out[`${label}|rectWidth`] = Math.round(r.width);
  };

  grab("wrap", wrap, ["color", "backgroundColor", "paddingBottom"]);
  grab("layout", layout, [
    "display", "flexDirection", "gridTemplateColumns", "columnGap", "rowGap",
    "maxWidth", "marginLeft", "marginRight", "paddingLeft", "paddingRight", "alignItems",
  ]);
  grab("gallery", gallery, ["minWidth", "order", "width", "display"]);
  grab("info", info, ["minWidth", "order", "width", "display"]);
  grab("main", main, ["paddingTop"]); // body:has(.bb-wp-pdp) clearance — unchanged, regression check
  return out;
}

async function snapshot(page, base, vw) {
  await page.setViewportSize({ width: vw, height: 1000 });
  await page.goto(base + PATH, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".bb-wp-pdp-info-col h1", { timeout: 20000 });
  await page.waitForTimeout(800);
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
  fs.writeFileSync(".artifacts/pdp-shell-parity/report.json", JSON.stringify(report, null, 2));
  const total = Object.values(report).reduce((n, r) => n + r.diffs.length, 0);
  console.log(`\nTOTAL mismatches: ${total}`);
})();
