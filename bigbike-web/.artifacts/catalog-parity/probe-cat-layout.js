// A/B computed-style probe for the bb-cat-layout skeleton migration.
// OLD :3000 (.bb-cat-layout CSS) vs NEW :3001 (inline `bbCatLayout`).
// /san-pham is force-dynamic -> a soft client-nav shows CatalogSkeleton (san-pham/loading.tsx)
// while the RSC render is in flight; we delay that fetch so the skeleton lingers, then probe.
const { chromium } = require("playwright");

const PROPS = [
  "display", "gridTemplateColumns", "columnGap", "rowGap",
  "marginTop", "marginBottom", "marginLeft", "marginRight",
  "paddingBottom", "width", "backgroundColor",
];
// widths chosen to land squarely in each tier: <768 / 768-1023 / 1024-1279 / >=1280
const VIEWPORTS = [
  { w: 390, h: 844, tier: "mobile<768" },
  { w: 900, h: 900, tier: "md 220px" },
  { w: 1100, h: 900, tier: "lg 240px" },
  { w: 1400, h: 900, tier: "xl 260px gap36" },
];

async function captureSkel(page, base) {
  // Land on the homepage and soft-nav to a category page (force-dynamic ->
  // CatalogSkeleton/loading.tsx shows while the RSC render is in flight). The
  // /san-pham/ links live in a hidden mega-menu, but visible /danh-muc-san-pham/
  // category links render the same bb-cat-layout skeleton (withHero variant).
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('a[href^="/danh-muc-san-pham/"]', { state: "attached", timeout: 15000 });
  await page.waitForTimeout(2500); // let link prefetches settle BEFORE arming the delay
  await page.route(
    (url) => url.toString().includes("san-pham"), // matches danh-muc-san-pham RSC too
    async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      return route.continue();
    },
  );
  await page.locator('a[href^="/danh-muc-san-pham/"]:visible').first().click();
  await page.waitForSelector('[role=status][aria-busy] [aria-hidden] aside', { timeout: 8000 });
  return page.evaluate((PROPS) => {
    const aside = document.querySelector('[role=status][aria-busy] [aria-hidden] aside');
    const cat = aside ? aside.parentElement : null;
    if (!cat) return { error: "bb-cat-layout not found" };
    const cs = getComputedStyle(cat);
    const o = {};
    PROPS.forEach((p) => (o[p] = cs[p]));
    o._childCount = cat.children.length;
    return o;
  }, PROPS);
}

(async () => {
  const browser = await chromium.launch();
  let mismatches = 0;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    let oldS, newS;
    try {
      oldS = await captureSkel(page, "http://localhost:3000");
      newS = await captureSkel(page, "http://localhost:3001");
    } catch (e) {
      console.log(`\n=== ${vp.w}x${vp.h} (${vp.tier}) === CAPTURE ERROR: ${e.message}`);
      mismatches++;
      await ctx.close();
      continue;
    }
    await ctx.close();
    console.log(`\n=== ${vp.w}x${vp.h} (${vp.tier}) ===`);
    if (oldS.error || newS.error) {
      console.log("  ERROR old:", oldS.error, "new:", newS.error);
      mismatches++;
      continue;
    }
    for (const p of PROPS) {
      if (oldS[p] !== newS[p]) {
        console.log(`  [${p}] OLD="${oldS[p]}" NEW="${newS[p]}"`);
        mismatches++;
      }
    }
    console.log(`  children old=${oldS._childCount} new=${newS._childCount}`);
  }
  console.log(`\n${mismatches === 0 ? "✅ 0 MISMATCHES" : `❌ ${mismatches} MISMATCHES`}`);
  await browser.close();
  process.exit(mismatches === 0 ? 0 : 1);
})();
