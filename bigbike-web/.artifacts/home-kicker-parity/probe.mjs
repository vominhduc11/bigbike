// A/B for bb-kicker migration. Anchors structurally (kickers lost the bb-kicker class):
//  featured = <p> before #home-products-heading; experience = <p> before #home-exp-heading (Profile A/B on /);
//  compare = first <p> in .bb-compare-page header (Profile C on /so-sanh).
// Profiles B (about/news identical to experience) and C (recently-viewed/article-card identical to
// compare) are verified by string-identity. Modes: capture <out> | diff <old> <new>.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const BASE = "http://localhost:3001";
const PROPS = ["color", "fontFamily", "fontSize", "lineHeight", "letterSpacing", "fontWeight",
  "textTransform", "marginTop", "marginRight", "marginBottom", "marginLeft", "display", "alignItems", "gap"];
const BEFORE = ["content", "width", "height", "backgroundColor"];

async function snapKicker(page, anchorJs) {
  return page.evaluate(({ anchorJs, props, before }) => {
    // eslint-disable-next-line no-eval
    const el = eval(anchorJs);
    if (!el) return null;
    const cs = getComputedStyle(el), r = {};
    for (const p of props) r[p] = cs[p];
    const bcs = getComputedStyle(el, "::before"), rb = {};
    for (const p of before) rb[p] = bcs[p];
    return { self: r, before: rb };
  }, { anchorJs, props: PROPS, before: BEFORE });
}

async function capture(out) {
  const browser = await chromium.launch();
  const result = {};
  // home page: featured + experience kickers
  for (const vw of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#home-products-heading", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(500);
    result[`home_${vw}`] = {
      featured: await snapKicker(page, "document.querySelector('#home-products-heading')?.previousElementSibling"),
      experience: await snapKicker(page, "document.querySelector('#home-exp-heading')?.previousElementSibling"),
    };
    await ctx.close();
  }
  // compare page: compare kicker
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/so-sanh", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-compare-page", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(500);
    result["compare_1280"] = {
      compare: await snapKicker(page, "document.querySelector('.bb-compare-page header')?.querySelector('p')"),
    };
    await ctx.close();
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("captured ->", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(readFileSync(oldF, "utf8")), b = JSON.parse(readFileSync(newF, "utf8"));
  let m = 0;
  for (const grp of Object.keys(a)) for (const k of Object.keys(a[grp])) {
    const ao = a[grp][k], bo = b[grp][k];
    if (ao == null || bo == null) { if (ao !== bo) { console.log(`[${grp}] ${k}: presence OLD=${ao ? "y" : "null"} NEW=${bo ? "y" : "null"}`); m++; } continue; }
    for (const sub of ["self", "before"]) for (const p of Object.keys(ao[sub])) {
      if (ao[sub][p] !== bo[sub][p]) { console.log(`[${grp}] ${k}.${sub}.${p}: OLD="${ao[sub][p]}" NEW="${bo[sub][p]}"`); m++; }
    }
  }
  console.log(m === 0 ? "*** 0 MISMATCH ***" : `*** ${m} MISMATCH(ES) ***`);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else { console.log("usage: capture <out> | diff <old> <new>"); process.exit(1); }
