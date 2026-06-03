// Header NAV-BAR A/B probe — desktop primary nav (visible >=1261).
// Anchors by the KEPT marker .bb-header-nav-item (its >a is the nav link; the
// bb-header-nav-link / bb-navigation / bb-header-nav classes are dropped in NEW).
// Measures: nav-link rest+hover, the :not(:last-child)::after diamond, the last
// item (no diamond), item spacing, the >=1261 visible / <=1260 hidden boundary,
// and the .bb-user-control left/width (to confirm the bb-navigation margin-left:auto
// strip is a no-op given flex-1).
// Usage:
//   BASE=http://localhost:3000 node probe.mjs capture old.json
//   node probe.mjs capture new.json            (BASE defaults :3001)
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3001";

const LINK_PROPS = [
  "display", "alignItems", "height", "paddingTop", "paddingRight", "paddingBottom",
  "paddingLeft", "color", "fontSize", "lineHeight", "fontFamily", "fontWeight",
  "textTransform", "whiteSpace", "textDecorationLine",
];
const ITEM_PROPS = [
  "position", "display", "alignItems", "height", "marginRight", "paddingRight",
];
const AFTER_PROPS = [
  "content", "position", "top", "right", "width", "height", "backgroundColor", "transform",
];

async function snap(page) {
  return await page.evaluate(({ linkProps, itemProps, afterProps }) => {
    const items = [...document.querySelectorAll(".bb-header-nav-item")];
    const out = { count: items.length };
    if (!items.length) return out;
    const first = items[0];
    const last = items[items.length - 1];
    const firstLink = first.querySelector(":scope > a");
    const lastLink = last.querySelector(":scope > a");
    const pick = (el, props) => {
      if (!el) return { __missing: true };
      const cs = getComputedStyle(el);
      const o = {};
      for (const p of props) o[p] = cs[p];
      return o;
    };
    const pickAfter = (el, props) => {
      if (!el) return { __missing: true };
      const cs = getComputedStyle(el, "::after");
      const o = {};
      for (const p of props) o[p] = cs[p];
      return o;
    };
    // item[0] = "Trang chủ" -> is-active on "/" (color = active red); verifies
    // active color + all geometry (padding/lh/display are identical for every item).
    out.firstLink = pick(firstLink, linkProps);
    out.firstItem = pick(first, itemProps);
    out.firstAfter = pickAfter(first, afterProps);
    out.lastAfter = pickAfter(last, afterProps); // last: no diamond -> content "none"
    // item[1] = a non-active item -> verifies the DEFAULT white nav-link color.
    const plain = items[1];
    const plainLink = plain ? plain.querySelector(":scope > a") : null;
    out.plainColor = plainLink ? getComputedStyle(plainLink).color : null;
    out.firstLinkVisible = firstLink ? firstLink.getClientRects().length > 0 : false;
    out.firstLinkLeft = firstLink ? Math.round(firstLink.getBoundingClientRect().left) : null;
    const uc = document.querySelector(".bb-user-control");
    if (uc) {
      const r = uc.getBoundingClientRect();
      out.ucLeft = Math.round(r.left);
      out.ucWidth = Math.round(r.width);
    }
    return out;
  }, { linkProps: LINK_PROPS, itemProps: ITEM_PROPS, afterProps: AFTER_PROPS });
}

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  const vps = [1280, 1920, 1261, 1260];
  for (const vp of vps) {
    await page.setViewportSize({ width: vp, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-site-header", { timeout: 30000 });
    await page.waitForTimeout(300);
    data[vp] = await snap(page);
    // hover a NON-active nav link (item[1]) -> verifies the white->red hover swap
    if (data[vp].firstLinkVisible) {
      try {
        await page.hover(".bb-header-nav-item:nth-child(2) > a", { timeout: 4000 });
        await page.waitForTimeout(180);
        data[vp].plainHover = await page.evaluate(() => {
          const a = document.querySelector(".bb-header-nav-item:nth-child(2) > a");
          return a ? { color: getComputedStyle(a).color } : null;
        });
        await page.mouse.move(2, 2);
        await page.waitForTimeout(100);
      } catch { data[vp].plainHover = { __err: true }; }
    }
    process.stdout.write(`captured @${vp} (items=${data[vp].count}, vis=${data[vp].firstLinkVisible})\n`);
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out);
}

function walk(prefix, av, bv, report) {
  if (av && typeof av === "object" && bv && typeof bv === "object") {
    const keys = new Set([...Object.keys(av), ...Object.keys(bv)]);
    for (const k of keys) walk(prefix + "." + k, av[k], bv[k], report);
  } else if (av !== bv) {
    report.n++;
    console.log(`${prefix}: OLD=${JSON.stringify(av)} NEW=${JSON.stringify(bv)}`);
  }
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  const report = { n: 0 };
  for (const vp of Object.keys(a)) walk(vp, a[vp], b[vp], report);
  console.log(report.n === 0 ? "\n✅ 0 mismatches" : `\n❌ ${report.n} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
