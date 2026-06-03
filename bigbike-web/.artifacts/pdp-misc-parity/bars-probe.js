// A/B probe for the mobile fixed bars: anchor nav (bb-pdp-anchor-* → fully inline)
// + sticky CTA (bb-pdp-sticky-cta kept as body:has marker, styling inline).
// OLD :3000 vs NEW :3001 @390. Scroll to bottom to trigger both IntersectionObservers
// (is-visible). Anchor: nav via aria-label; sticky via the kept .bb-pdp-sticky-cta.
const { chromium } = require("playwright");
const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const PATH = `/product/${SLUG}/`;

function collectInPage() {
  const out = {};
  const nav = document.querySelector('nav[aria-label="Điều hướng nội dung sản phẩm"]');
  const navBtn0 = nav ? nav.children[0] : null; // active (default activeId = items[0])
  const navBtn1 = nav ? nav.children[1] : null; // inactive
  const sticky = document.querySelector(".bb-pdp-sticky-cta");
  const add = sticky ? sticky.children[0] : null;
  const consult = sticky ? sticky.querySelector("a") : null;

  const grab = (label, el, props) => {
    if (!el) { out[`${label}|__present`] = "MISSING"; return; }
    const cs = getComputedStyle(el);
    for (const p of props) out[`${label}|${p}`] = cs[p];
  };
  grab("nav", nav, ["display", "position", "top", "left", "right", "zIndex", "backgroundColor", "borderBottomWidth", "borderBottomStyle", "borderBottomColor", "paddingLeft", "paddingRight", "columnGap", "transitionProperty", "transitionDuration", "transitionTimingFunction", "transform", "pointerEvents", "overflowX"]);
  grab("navBtn0", navBtn0, ["flexGrow", "flexShrink", "flexBasis", "paddingTop", "paddingLeft", "borderBottomWidth", "borderBottomStyle", "borderBottomColor", "backgroundColor", "color", "fontFamily", "fontSize", "fontWeight", "textTransform", "letterSpacing", "whiteSpace", "cursor", "marginBottom", "minHeight"]);
  grab("navBtn1", navBtn1, ["color", "borderBottomColor"]);
  grab("sticky", sticky, ["display", "position", "bottom", "left", "right", "zIndex", "paddingTop", "paddingLeft", "paddingRight", "paddingBottom", "backgroundColor", "borderTopWidth", "borderTopStyle", "borderTopColor", "boxShadow", "columnGap", "transform", "pointerEvents", "transitionDuration", "transitionTimingFunction"]);
  grab("add", add, ["flexGrow", "flexShrink", "flexBasis", "height", "borderTopStyle", "borderTopLeftRadius", "backgroundColor", "color", "opacity", "cursor", "fontFamily", "fontSize", "fontWeight", "textTransform", "letterSpacing"]);
  grab("consult", consult, ["flexGrow", "flexShrink", "flexBasis", "display", "alignItems", "justifyContent", "height", "paddingLeft", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderTopLeftRadius", "color", "fontSize", "fontWeight", "textDecorationLine", "textTransform", "whiteSpace"]);
  return out;
}

async function snapshot(page, base) {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(base + PATH, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".bb-wp-pdp-info-col h1", { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200); // let IntersectionObservers fire -> is-visible
  return page.evaluate(collectInPage);
}

(async () => {
  const browser = await chromium.launch();
  const cOld = await browser.newContext();
  const cNew = await browser.newContext();
  const oldD = await snapshot(await cOld.newPage(), "http://localhost:3000");
  const newD = await snapshot(await cNew.newPage(), "http://localhost:3001");
  await cOld.close(); await cNew.close();
  await browser.close();
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
  const diffs = [];
  for (const k of [...keys].sort()) if (oldD[k] !== newD[k]) diffs.push({ k, old: oldD[k], new: newD[k] });
  console.log(`\n=== bars @390 === (${keys.size} props, ${diffs.length} diff)`);
  for (const d of diffs) console.log(`  ${d.k}\n    OLD: ${d.old}\n    NEW: ${d.new}`);
  console.log(`\nTOTAL: ${diffs.length}`);
})();
