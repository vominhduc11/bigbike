// A/B computed-style probe for the filter-sidebar migration.
// OLD :3000 (.bb-product-archive .widget/.sidebar-wrap-product CSS) vs NEW :3001 (inline Tailwind).
// Uses a category page WITH an active category + children so the diamond + connector render.
const { chromium } = require("playwright");

const CAT = "/danh-muc-san-pham/non-bao-hiem-moto/"; // active parent category (has children)
const pick = (el, props, pseudo) => {
  if (!el) return null;
  const cs = getComputedStyle(el, pseudo || undefined);
  const o = {};
  props.forEach((p) => (o[p] = cs[p]));
  return o;
};

function findAside() {
  return [...document.querySelectorAll("aside")].find(
    (a) => a.querySelector('a[href*="filter_color"]') || /Màu sắc/.test(a.textContent),
  );
}

async function captureDesktop(page, base) {
  await page.goto(base + CAT, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('aside a[href*="filter_color"]', { state: "attached", timeout: 15000 });
  return page.evaluate(({ CAT }) => {
    const pick = (el, props, pseudo) => {
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo || undefined);
      const o = {};
      props.forEach((p) => (o[p] = cs[p]));
      return o;
    };
    const aside = [...document.querySelectorAll("aside")].find(
      (a) => a.querySelector('a[href*="filter_color"]') || /Màu sắc/.test(a.textContent),
    );
    if (!aside) return { error: "filter aside not found" };
    const panel = aside.querySelector(":scope > div");
    const h3 = aside.querySelector("h3");
    const widget = h3 ? h3.parentElement.parentElement : null;
    const catLinks = [...aside.querySelectorAll('a[href^="/danh-muc-san-pham"]')];
    const activeLink = aside.querySelector(`a[href="${CAT}"]`);
    const restingLink = catLinks.find((a) => a.getAttribute("href") !== CAT) || catLinks[0];
    const childrenUl = aside.querySelector("ul ul");
    const brandLink = aside.querySelector('a[href*="pwb-brand"]');
    const brandImg = brandLink ? brandLink.querySelector("img") : null;
    // layered count badge only (exclude OLD's display:none category counts)
    const badge = [...aside.querySelectorAll("li > span")].find(
      (s) => s.querySelector("span") && /^\d+$/.test(s.textContent.trim()) && getComputedStyle(s).display !== "none",
    );
    return {
      aside: pick(aside, ["position", "display"]),
      panel: pick(panel, ["backgroundColor", "position"]),
      widget: pick(widget, ["marginBottom", "paddingBottom", "borderBottomWidth", "borderBottomStyle", "borderBottomColor"]),
      h3: pick(h3, ["fontFamily", "fontSize", "fontWeight", "textTransform", "color", "marginTop", "marginBottom"]),
      restingLink: pick(restingLink, ["color", "fontSize", "fontWeight", "lineHeight", "display", "paddingRight", "textDecorationLine"]),
      activeLink: pick(activeLink, ["color", "paddingLeft"]),
      diamond: pick(activeLink, ["content", "position", "top", "left", "width", "height", "borderTopLeftRadius", "backgroundColor", "transform"], "::after"),
      connector: pick(childrenUl, ["content", "position", "top", "left", "width", "height", "borderTopStyle", "borderTopWidth", "borderTopColor"], "::after"),
      brandLink: pick(brandLink, ["display", "alignItems", "columnGap"]),
      brandImg: pick(brandImg, ["width", "maxWidth", "display"]),
      badge: pick(badge, ["position", "top", "right", "width", "height", "color", "textAlign"]),
      badgeAfter: pick(badge, ["backgroundColor", "transform", "borderTopLeftRadius", "width", "height"], "::after"),
      _hasActive: !!activeLink,
      _hasChildren: !!childrenUl,
      _hasBadge: !!badge,
    };
  }, { CAT });
}

async function captureMobile(page, base) {
  await page.goto(base + CAT, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".filter-mobile", { state: "attached", timeout: 15000 });
  await page.locator(".filter-mobile").first().click();
  await page.waitForTimeout(500); // let mobileIn (rAF) + transition settle
  return page.evaluate(() => {
    const pick = (el, props, pseudo) => {
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo || undefined);
      const o = {};
      props.forEach((p) => (o[p] = cs[p]));
      return o;
    };
    const aside = [...document.querySelectorAll("aside")].find(
      (a) => a.querySelector('a[href*="filter_color"]') || /Màu sắc/.test(a.textContent),
    );
    if (!aside) return { error: "filter aside not found" };
    const panel = aside.querySelector(":scope > div");
    const overlay = aside.querySelector(":scope > button");
    // mobile title = the div inside panel whose text starts with the filter label
    const title = [...panel.querySelectorAll(":scope > div")].find((d) => /BỘ LỌC|LỌC|Lọc/.test(d.textContent.slice(0, 12)));
    return {
      aside: pick(aside, ["position", "display", "top", "right", "width", "height", "zIndex"]),
      panel: pick(panel, ["position", "width", "maxWidth", "transform", "transitionProperty", "paddingTop", "paddingLeft", "backgroundColor", "overflowX", "zIndex"]),
      overlay: pick(overlay, ["position", "display", "opacity", "backgroundColor", "width", "height", "zIndex"]),
      title: pick(title, ["display", "marginBottom", "paddingBottom", "borderBottomWidth", "borderBottomColor"]),
      _hasOverlay: !!overlay,
      _hasTitle: !!title,
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  let mismatches = 0;
  const run = async (label, vp, fn) => {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    let oldS, newS;
    try {
      oldS = await fn(page, "http://localhost:3000");
      newS = await fn(page, "http://localhost:3001");
    } catch (e) {
      console.log(`\n=== ${label} === CAPTURE ERROR: ${e.message}`);
      mismatches++;
      await ctx.close();
      return;
    }
    await ctx.close();
    console.log(`\n=== ${label} ===`);
    if (oldS.error || newS.error) { console.log("  ERROR", oldS.error, newS.error); mismatches++; return; }
    for (const grp of Object.keys(oldS)) {
      if (grp.startsWith("_")) { if (oldS[grp] !== newS[grp]) { console.log(`  [${grp}] OLD=${oldS[grp]} NEW=${newS[grp]}`); mismatches++; } continue; }
      const o = oldS[grp], n = newS[grp];
      if (!o && !n) continue;
      if (!o || !n) { console.log(`  [${grp}] MISSING old=${!!o} new=${!!n}`); mismatches++; continue; }
      for (const p of Object.keys(o)) if (o[p] !== n[p]) { console.log(`  [${grp}.${p}] OLD="${o[p]}" NEW="${n[p]}"`); mismatches++; }
    }
  };
  await run("DESKTOP 1280", { width: 1280, height: 1000 }, captureDesktop);
  await run("MOBILE 390 drawer-open", { width: 390, height: 844 }, captureMobile);
  console.log(`\n${mismatches === 0 ? "✅ 0 MISMATCHES" : `❌ ${mismatches} MISMATCHES`}`);
  await browser.close();
  process.exit(mismatches === 0 ? 0 : 1);
})();
