// A/B probe for the featured-products section: carousel chrome + section header.
// Confirms the dead-card strip left every LIVE rule (chrome + header) byte-identical
// and the inline ProductCard renders unchanged. Modes: `capture <out.json>` | `diff <old> <new>`.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const BASE = "http://localhost:3001";
const VIEWPORTS = [1280, 390];
const PROPS = [
  "display", "flexDirection", "gap", "gridTemplateColumns", "justifyContent", "alignItems",
  "position", "transform", "overflow", "overflowX", "width", "maxWidth", "minWidth", "minHeight", "height",
  "margin", "marginTop", "marginBottom", "padding", "paddingTop", "paddingBottom", "paddingLeft",
  "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight", "lineHeight", "textAlign",
  "textTransform", "letterSpacing", "opacity", "borderRadius",
  "borderTopWidth", "borderTopStyle", "borderTopColor", "borderBottomWidth", "borderBottomStyle", "borderBottomColor",
];

// Each target: a label + a function evaluated in-page returning the element (or null).
const TARGETS = [
  { key: "section", sel: ".bb-products-section.bb-home-products-parity" },
  { key: "header", sel: ".bb-products-section.bb-home-products-parity .bb-products-header" },
  { key: "kicker", sel: ".bb-products-section.bb-home-products-parity .bb-products-header .bb-kicker" },
  { key: "title", sel: "#home-products-heading" },
  { key: "carousel", sel: ".bb-fp-carousel" },
  { key: "viewport", sel: ".bb-fp-viewport" },
  { key: "track", sel: ".bb-fp-page-track" },
  { key: "card0", sel: ".bb-fp-page-track > article" },
  { key: "cardImg0", sel: ".bb-fp-page-track > article img" },
  { key: "pagination", sel: ".bb-fp-pagination" },
  { key: "bullet0", sel: ".bb-fp-pagination .swiper-pagination-bullet" },
  { key: "bulletActive", sel: ".bb-fp-pagination .swiper-pagination-bullet-active" },
  { key: "arrow0", sel: ".bb-fp-arrow" },
];

async function capture(out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    // Let the featured section + its data settle.
    await page.waitForSelector(".bb-products-section.bb-home-products-parity", { timeout: 60000 }).catch(() => {});
    await page.waitForSelector(".bb-fp-page-track", { timeout: 60000 }).catch(() => {});
    // Scroll the card into view + wait for the lazy product image to load and lay out
    // (img height is otherwise a lazy/layout-settle flake — see migration memory).
    await page.locator(".bb-fp-page-track > article img").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForFunction(() => {
      const im = document.querySelector(".bb-fp-page-track > article img");
      return im && im.getBoundingClientRect().height > 0;
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const snap = await page.evaluate(({ targets, props }) => {
      const o = {};
      for (const t of targets) {
        const el = document.querySelector(t.sel);
        if (!el) { o[t.key] = null; continue; }
        const cs = getComputedStyle(el);
        const r = {};
        for (const p of props) r[p] = cs[p];
        o[t.key] = r;
      }
      return o;
    }, { targets: TARGETS, props: PROPS });
    result[vw] = snap;
    await ctx.close();
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("captured ->", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(readFileSync(oldF, "utf8"));
  const b = JSON.parse(readFileSync(newF, "utf8"));
  let mism = 0;
  for (const vw of Object.keys(a)) {
    for (const key of Object.keys(a[vw])) {
      const ao = a[vw][key], bo = b[vw][key];
      if (ao === null && bo === null) continue;
      if ((ao === null) !== (bo === null)) { console.log(`[${vw}] ${key}: presence OLD=${ao ? "yes" : "null"} NEW=${bo ? "yes" : "null"}`); mism++; continue; }
      for (const p of Object.keys(ao)) {
        if (ao[p] !== bo[p]) { console.log(`[${vw}] ${key}.${p}: OLD="${ao[p]}" NEW="${bo[p]}"`); mism++; }
      }
    }
  }
  console.log(mism === 0 ? "*** 0 MISMATCH ***" : `*** ${mism} MISMATCH(ES) ***`);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else { console.log("usage: capture <out> | diff <old> <new>"); process.exit(1); }
