// Robust A/B for the bb-cat-layout skeleton migration WITHOUT the flaky loading state.
// bb-cat-layout is a standalone (non-context-scoped) class, so we inject it on :3000
// (old CSS) and inject the new utility string on :3001 (compiled Tailwind) into the
// same full-width body context and compare computed styles. Same parent width on both
// servers at a given viewport => valid parity test of class -> CSS equivalence.
const { chromium } = require("playwright");

// EXACT class string from Skeletons.tsx `bbCatLayout` (underscores = compiled class names).
const NEW_CLASSES =
  "mx-auto mt-6 grid grid-cols-1 gap-0 bg-background pb-10 " +
  "w-[min(100%_-_calc(var(--bb-page-padding-mobile)_*_2),var(--bb-container-xl))] " +
  "md:mt-8 md:grid-cols-[220px_1fr] md:gap-7 md:pb-12 " +
  "md:w-[min(100%_-_calc(var(--bb-page-padding-tablet)_*_2),var(--bb-container-xl))] " +
  "lg:grid-cols-[240px_1fr] lg:w-[min(100%_-_calc(var(--bb-page-padding-desktop)_*_2),var(--bb-container-xl))] " +
  "xl:grid-cols-[260px_1fr] xl:gap-9";

const PROPS = [
  "display", "gridTemplateColumns", "columnGap", "rowGap",
  "marginTop", "marginBottom", "marginLeft", "marginRight",
  "paddingBottom", "width", "backgroundColor",
];
const VIEWPORTS = [
  { w: 390, h: 844, tier: "mobile<768" },
  { w: 900, h: 900, tier: "md 220px" },
  { w: 1100, h: 900, tier: "lg 240px" },
  { w: 1400, h: 900, tier: "xl 260px gap36" },
];

async function measure(page, base, cls) {
  await page.goto(base + "/san-pham/", { waitUntil: "domcontentloaded" });
  return page.evaluate(({ cls, PROPS }) => {
    document.getElementById("__catprobe")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "__catprobe";
    wrap.innerHTML = `<div class="${cls}"><aside style="min-width:0"></aside><div style="min-width:0"></div></div>`;
    document.body.appendChild(wrap);
    const el = wrap.firstElementChild;
    const cs = getComputedStyle(el);
    const o = {};
    PROPS.forEach((p) => (o[p] = cs[p]));
    return o;
  }, { cls, PROPS });
}

(async () => {
  const browser = await chromium.launch();
  let mismatches = 0;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const oldS = await measure(page, "http://localhost:3000", "bb-cat-layout");
    const newS = await measure(page, "http://localhost:3001", NEW_CLASSES);
    await ctx.close();
    console.log(`\n=== ${vp.w}x${vp.h} (${vp.tier}) ===`);
    for (const p of PROPS) {
      if (oldS[p] !== newS[p]) {
        console.log(`  [${p}] OLD="${oldS[p]}" NEW="${newS[p]}"`);
        mismatches++;
      }
    }
  }
  console.log(`\n${mismatches === 0 ? "✅ 0 MISMATCHES" : `❌ ${mismatches} MISMATCHES`}`);
  await browser.close();
  process.exit(mismatches === 0 ? 0 : 1);
})();
