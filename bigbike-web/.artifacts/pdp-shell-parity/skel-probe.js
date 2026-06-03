// Computed-style A/B probe for the PdpSkeleton mirror (formerly .bb-pdp /
// .bb-pdp-below). OLD = :3000, NEW = :3001. Skeleton is transient: trigger it via
// a SOFT client nav to a product URL with that route's RSC fetch delayed, so
// loading.tsx (PdpSkeleton) stays on screen long enough to read. reducedMotion
// freezes the shimmer. Anchor structurally (role=status > aria-hidden > children)
// since NEW dropped the .bb-pdp/.bb-pdp-below classes.
const { chromium } = require("playwright");

const VIEWPORTS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
if (!VIEWPORTS.length) VIEWPORTS.push(1600, 1280, 769, 768, 601, 600, 390);

function collectInPage() {
  const out = {};
  const root = document.querySelector('[role="status"][aria-busy="true"]');
  if (!root) return { __error: "no skeleton root" };
  const inner = root.querySelector('[aria-hidden="true"]');
  if (!inner) return { __error: "no inner" };
  const grid = inner.children[1] || null;   // [0]=breadcrumb, [1]=grid, [2]=below
  const below = inner.children[2] || null;
  const grid0 = grid ? grid.children[0] : null;

  const grab = (label, el, props) => {
    if (!el) { out[`${label}|__present`] = "MISSING"; return; }
    const cs = getComputedStyle(el);
    for (const p of props) out[`${label}|${p}`] = cs[p];
    out[`${label}|rectWidth`] = Math.round(el.getBoundingClientRect().width);
  };

  grab("grid", grid, [
    "display", "gridTemplateColumns", "columnGap", "rowGap", "maxWidth",
    "marginLeft", "marginRight", "marginTop", "paddingLeft", "paddingRight",
    "alignItems", "minWidth", "backgroundColor",
  ]);
  grab("gridChild0", grid0, ["minWidth"]); // .bb-pdp > * { min-width:0 }
  grab("below", below, [
    "maxWidth", "marginLeft", "marginRight", "marginTop",
    "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
    "borderTopWidth", "borderTopStyle", "borderTopColor", "backgroundColor",
  ]);
  return out;
}

async function snapshot(ctx, base, vw) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: vw, height: 1000 });
  await page.goto(base + "/san-pham", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector('a[href*="/product/"]', { timeout: 20000 });
  await page.waitForTimeout(2500); // let link prefetches settle BEFORE arming the delay
  // Delay the product RSC fetch so the loading.tsx skeleton lingers.
  await page.route("**/*", async (route) => {
    const req = route.request();
    const isRsc = req.url().includes("_rsc") || req.headers()["rsc"] === "1";
    if (isRsc && /\/product\//.test(req.url())) {
      await new Promise((r) => setTimeout(r, 5000));
    }
    return route.continue();
  });
  const link = await page.$('a[href*="/product/"]');
  if (!link) { await page.close(); return { __error: "no product link on /san-pham" }; }
  await link.click();
  await page.waitForSelector('[role="status"][aria-busy="true"]', { timeout: 10000 });
  await page.waitForTimeout(400);
  const data = await page.evaluate(collectInPage);
  await page.close();
  return data;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const vw of VIEWPORTS) {
    const ctxOld = await browser.newContext({ reducedMotion: "reduce" });
    const ctxNew = await browser.newContext({ reducedMotion: "reduce" });
    const oldData = await snapshot(ctxOld, "http://localhost:3000", vw);
    const newData = await snapshot(ctxNew, "http://localhost:3001", vw);
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
  require("fs").writeFileSync(".artifacts/pdp-shell-parity/skel-report.json", JSON.stringify(report, null, 2));
  const total = Object.values(report).reduce((n, r) => n + r.diffs.length, 0);
  console.log(`\nTOTAL mismatches: ${total}`);
})();
