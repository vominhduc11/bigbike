// A/B computed-style probe for the archive pagination migration.
// OLD :3000 (docker, .bb-archive-pagination CSS) vs NEW :3001 (inline Tailwind).
// /san-pham?size=5 -> 20 products / 5 = 4 pages; page=2 exercises prev+pages+current+next.
const { chromium } = require("playwright");

const URL = (base) => `${base}/san-pham/?size=5&page=2`;
const VIEWPORTS = [
  { w: 1280, h: 900 },
  { w: 390, h: 844 },
];

const NAV_PROPS = ["display", "paddingTop", "paddingBottom", "marginTop", "marginBottom", "marginLeft", "marginRight", "textAlign"];
const UL_PROPS = ["width", "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "listStyleType"];
const LI_PROPS = ["display", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "fontSize", "fontWeight"];
const LINK_PROPS = ["display", "alignItems", "justifyContent", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "color", "fontSize", "lineHeight", "textDecorationLine"];
const ICON_PROPS = ["fontSize", "lineHeight"];

async function capture(page, base) {
  await page.goto(URL(base), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('a[href*="paged="]', { state: "attached", timeout: 15000 });
  return page.evaluate(({ NAV_PROPS, UL_PROPS, LI_PROPS, LINK_PROPS, ICON_PROPS }) => {
    const pick = (el, props) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const o = {};
      props.forEach((p) => (o[p] = cs[p]));
      return o;
    };
    const navs = [...document.querySelectorAll("nav")];
    const nav = navs.find(
      (n) =>
        n.querySelectorAll("ul > li").length >= 3 &&
        [...n.querySelectorAll("ul > li")].some((li) => /^\d+$/.test(li.textContent.trim())),
    );
    if (!nav) return { error: "pagination nav not found" };
    const ul = nav.querySelector("ul");
    const li = ul.querySelector(":scope > li");
    const currentSpan = nav.querySelector("span");
    const links = [...nav.querySelectorAll("a")];
    const normalLink = links.find((a) => !a.querySelector("i") && /^\d+$/.test(a.textContent.trim()));
    const iconLink = links.find((a) => a.querySelector("i"));
    const icon = nav.querySelector("i");
    return {
      navHref: links.map((a) => a.getAttribute("href")),
      currentText: currentSpan ? currentSpan.textContent.trim() : null,
      nav: pick(nav, NAV_PROPS),
      ul: pick(ul, UL_PROPS),
      li: pick(li, LI_PROPS),
      currentSpan: pick(currentSpan, LINK_PROPS),
      normalLink: pick(normalLink, LINK_PROPS),
      iconLink: pick(iconLink, LINK_PROPS),
      icon: pick(icon, ICON_PROPS),
    };
  }, { NAV_PROPS, UL_PROPS, LI_PROPS, LINK_PROPS, ICON_PROPS });
}

(async () => {
  const browser = await chromium.launch();
  let mismatches = 0;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const oldS = await capture(page, "http://localhost:3000");
    const newS = await capture(page, "http://localhost:3001");
    await ctx.close();
    console.log(`\n=== viewport ${vp.w}x${vp.h} ===`);
    if (oldS.error || newS.error) {
      console.log("  ERROR old:", oldS.error, "new:", newS.error);
      mismatches++;
      continue;
    }
    for (const key of ["nav", "ul", "li", "currentSpan", "normalLink", "iconLink", "icon"]) {
      const o = oldS[key], n = newS[key];
      if (!o || !n) {
        console.log(`  [${key}] MISSING old=${!!o} new=${!!n}`);
        mismatches++;
        continue;
      }
      for (const p of Object.keys(o)) {
        if (o[p] !== n[p]) {
          console.log(`  [${key}.${p}] OLD="${o[p]}" NEW="${n[p]}"`);
          mismatches++;
        }
      }
    }
    console.log(`  currentText old=${oldS.currentText} new=${newS.currentText}`);
  }
  console.log(`\n${mismatches === 0 ? "✅ 0 MISMATCHES" : `❌ ${mismatches} MISMATCHES`}`);
  await browser.close();
  process.exit(mismatches === 0 ? 0 : 1);
})();
