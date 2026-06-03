// A/B probe for the PDP Videos tab (bb-wp-video-*/video-slide--* → inline).
// OLD :3000 vs NEW :3001. Anchor on #tab-videos (role=tabpanel id, kept) > grid.
// Test product has 4 videos -> the 2fr/1fr grid renders (1-col <=1023).
const { chromium } = require("playwright");
const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const PATH = `/product/${SLUG}/`;
const VIEWPORTS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
if (!VIEWPORTS.length) VIEWPORTS.push(1280, 1024, 1023, 390);

function collectInPage() {
  const out = {};
  const panel = document.querySelector("#tab-videos");
  if (!panel) return { __error: "no #tab-videos" };
  const grid = panel.children[0] || null;
  const mainWrap = grid ? grid.children[0] : null;
  const frame = mainWrap ? mainWrap.querySelector("iframe, video") : null;
  const list = grid ? grid.children[1] : null;
  const btn0 = list ? list.children[0] : null;
  const btn1 = list ? list.children[1] : null;
  const thumb0 = btn0 ? btn0.children[0] : null;
  const title0 = btn0 ? btn0.children[1] : null;
  const title1 = btn1 ? btn1.children[1] : null;

  const grab = (label, el, props) => {
    if (!el) { out[`${label}|__present`] = "MISSING"; return; }
    const cs = getComputedStyle(el);
    for (const p of props) out[`${label}|${p}`] = cs[p];
  };
  grab("grid", grid, ["display", "gridTemplateColumns", "columnGap", "rowGap"]);
  grab("frame", frame, ["display", "width", "aspectRatio", "borderTopStyle", "borderTopWidth", "backgroundColor"]);
  grab("list", list, ["display", "flexDirection", "rowGap"]);
  grab("btn0", btn0, ["display", "gridTemplateColumns", "columnGap", "alignItems", "borderTopStyle", "borderTopWidth", "backgroundColor", "paddingTop", "paddingLeft", "textAlign", "cursor"]);
  grab("thumb0", thumb0, ["display", "width", "aspectRatio", "backgroundColor", "backgroundPosition", "backgroundSize", "backgroundRepeat"]);
  grab("title0", title0, ["color", "fontWeight", "lineHeight"]); // active = brand
  grab("title1", title1, ["color"]); // inactive = black
  return out;
}

async function snapshot(page, base, vw) {
  await page.setViewportSize({ width: vw, height: 1000 });
  await page.goto(base + PATH, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#tab-videos", { state: "attached", timeout: 20000 });
  if (vw >= 768) {
    const tab = await page.$("#videos-tab");
    if (tab) { await tab.click(); await page.waitForTimeout(400); }
  }
  await page.waitForSelector("#tab-videos iframe, #tab-videos video", { state: "attached", timeout: 10000 });
  await page.waitForTimeout(600);
  return page.evaluate(collectInPage);
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const vw of VIEWPORTS) {
    const cOld = await browser.newContext();
    const cNew = await browser.newContext();
    const oldD = await snapshot(await cOld.newPage(), "http://localhost:3000", vw);
    const newD = await snapshot(await cNew.newPage(), "http://localhost:3001", vw);
    await cOld.close(); await cNew.close();
    const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
    const diffs = [];
    for (const k of [...keys].sort()) if (oldD[k] !== newD[k]) diffs.push({ k, old: oldD[k], new: newD[k] });
    report[vw] = { count: keys.size, diffs };
    console.log(`\n=== ${vw}px === (${keys.size} props, ${diffs.length} diff)`);
    for (const d of diffs) console.log(`  ${d.k}\n    OLD: ${d.old}\n    NEW: ${d.new}`);
  }
  await browser.close();
  const total = Object.values(report).reduce((n, r) => n + r.diffs.length, 0);
  console.log(`\nTOTAL: ${total}`);
})();
