// SEARCH header A/B probe — REAL-RENDER drive (not class-injection).
// The search shell is dual-layout (desktop centered-bar dropdown <-> mobile
// full-screen) with 4 media-query layers + open/closed state + ::before bar +
// ::placeholder. We open the live panel via the trigger (programmatic .click()
// fires onClick even when the trigger is display:none at mobile widths) and read
// getComputedStyle off STRUCTURAL anchors (DOM is identical OLD vs NEW — only the
// classNames change), so the same probe runs against both builds.
//
// Anchors: .bb-header-search-trigger (KEPT marker) -> parent = search container.
//   container.children[1] = layer; layer.children[0] = overlay;
//   layer.children[1] = panel; panel.children[0] = form;
//   form.children[0] = icon(span); form input = <input>; form.lastChild = close;
//   panel.children[1] (when open, empty query) = pre-suggestions results.
//
// Usage:
//   BASE=http://localhost:3000 node probe.mjs capture old.json     (docker = OLD)
//   BASE=http://localhost:3007 node probe.mjs capture new.json     (local build = NEW)
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3007";
const WIDTHS = [374, 375, 639, 640, 767, 768, 1024, 1280, 1536, 1920, 2560];

const LAYER_PROPS = ["position", "opacity", "visibility", "pointerEvents", "zIndex",
  "transitionProperty", "transitionDuration", "transitionTimingFunction", "transitionDelay"];
const BEFORE_PROPS = ["content", "position", "top", "left", "right", "height",
  "backgroundColor", "opacity", "zIndex", "display",
  "transitionProperty", "transitionDuration"];
const OVERLAY_PROPS = ["position", "top", "right", "bottom", "left",
  "borderTopStyle", "borderTopWidth", "backgroundColor", "zIndex"];
const PANEL_PROPS = ["position", "top", "left", "zIndex", "width", "height", "maxHeight",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "transform",
  "display", "flexDirection", "backgroundColor", "color", "overflowX", "overflowY"];
const FORM_PROPS = ["position", "display", "alignItems", "height", "minHeight",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "columnGap", "rowGap",
  "borderBottomWidth", "borderBottomStyle", "borderBottomColor", "backgroundColor",
  "flexGrow", "flexShrink", "flexBasis", "flexDirection"];
const ICON_PROPS = ["position", "top", "left", "transform", "color", "display",
  "width", "height", "minWidth", "alignItems", "justifyContent", "marginTop"];
const CLOSE_PROPS = ["position", "right", "top", "transform", "color", "minHeight",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "display",
  "width", "height", "minWidth", "alignItems", "justifyContent"];
const INPUT_PROPS = ["height", "minHeight", "borderTopWidth", "borderTopStyle", "borderTopColor",
  "borderBottomWidth", "borderBottomStyle", "borderBottomColor",
  "backgroundColor", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "boxShadow", "color", "fontSize", "fontWeight", "minWidth", "lineHeight", "display", "width"];
const PLACEHOLDER_PROPS = ["color", "opacity", "fontWeight"];
const RESULTS_PROPS = ["position", "top", "left", "right", "backgroundColor",
  "borderTopWidth", "borderTopStyle", "borderTopColor", "boxShadow", "zIndex",
  "animationName", "animationDuration", "animationTimingFunction", "animationFillMode",
  "display", "flexGrow", "flexShrink", "flexBasis", "minHeight", "maxHeight",
  "overflowY", "borderRadius"];

async function snap(page, openState) {
  return page.evaluate(({ openState, P }) => {
    const trigger = document.querySelector(".bb-header-search-trigger");
    if (!trigger) return { error: "no trigger" };
    const container = trigger.parentElement;
    const layer = container.children[1];
    const overlay = layer.children[0];
    const panel = layer.children[1];
    const form = panel.children[0];
    const icon = form.children[0];
    const input = form.querySelector("input");
    const close = form.children[form.children.length - 1];
    const results = openState ? panel.children[1] : null;
    function read(el, props, pseudo) {
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo || null);
      const o = {};
      for (const p of props) o[p] = cs[p];
      return o;
    }
    const out = {
      container: read(container, ["position", "order", "marginLeft", "marginRight", "display"]),
      layer: read(layer, P.LAYER_PROPS),
      layerBefore: read(layer, P.BEFORE_PROPS, "::before"),
      overlay: read(overlay, P.OVERLAY_PROPS),
    };
    if (openState) {
      out.panel = read(panel, P.PANEL_PROPS);
      out.form = read(form, P.FORM_PROPS);
      out.icon = read(icon, P.ICON_PROPS);
      out.close = read(close, P.CLOSE_PROPS);
      out.input = read(input, P.INPUT_PROPS);
      out.placeholder = read(input, P.PLACEHOLDER_PROPS, "::placeholder");
      out.results = read(results, P.RESULTS_PROPS);
      out.resultsTag = results ? results.tagName + "." + (results.className || "").slice(0, 30) : null;
    }
    return out;
  }, { openState, P: { LAYER_PROPS, BEFORE_PROPS, OVERLAY_PROPS, PANEL_PROPS, FORM_PROPS, ICON_PROPS, CLOSE_PROPS, INPUT_PROPS, PLACEHOLDER_PROPS, RESULTS_PROPS } });
}

async function captureFor(browser, reduced) {
  const ctx = await browser.newContext({ reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const result = {};
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.waitForSelector(".bb-header-search-trigger", { state: "attached", timeout: 15000 });
    // closed snapshot (skip for reduced — closed state irrelevant under rm)
    const closed = reduced ? null : await snap(page, false);
    // open the panel
    await page.evaluate(() => document.querySelector(".bb-header-search-trigger").click());
    await page.waitForTimeout(550);
    const open = await snap(page, true);
    result["w" + w] = { closed, open };
  }
  await ctx.close();
  return result;
}

async function capture(outFile) {
  const browser = await chromium.launch();
  const data = { normal: await captureFor(browser, false), reduced: await captureFor(browser, true) };
  await browser.close();
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log("wrote", outFile);
}

function diff(aFile, bFile) {
  const a = JSON.parse(fs.readFileSync(aFile));
  const b = JSON.parse(fs.readFileSync(bFile));
  let mism = 0;
  function walk(pa, pb, path) {
    if (pa === null && pb === null) return;
    if (path.endsWith("/resultsTag")) return; // diagnostic only — className changes by design
    if (typeof pa !== "object" || pa === null || typeof pb !== "object" || pb === null) {
      if (JSON.stringify(pa) !== JSON.stringify(pb)) {
        console.log(`MISMATCH ${path}: OLD=${JSON.stringify(pa)} NEW=${JSON.stringify(pb)}`);
        mism++;
      }
      return;
    }
    const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
    for (const k of keys) walk(pa[k], pb[k], path + "/" + k);
  }
  walk(a, b, "");
  console.log(mism === 0 ? "✅ 0 mismatches" : `❌ ${mism} mismatches`);
}

const [, , cmd, f1, f2] = process.argv;
if (cmd === "capture") capture(f1);
else if (cmd === "diff") diff(f1, f2);
else console.log("usage: capture <out> | diff <old> <new>");
