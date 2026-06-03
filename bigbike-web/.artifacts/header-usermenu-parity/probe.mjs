// USER-MENU + INFO-SHEET A/B probe (class-injection).
// These are BARE-selector rules (.bb-header-user / .bb-header-user-menu /
// .bb-header-info-sheet / -overlay / -content — NOT descendant-scoped), so we can
// inject hosts into document.body and read getComputedStyle, incl ::before/::after.
// We inject the twMerge-RESOLVED (conflict-free) class string for each state so the
// cascade is deterministic. Captures both motion modes (normal + reduce).
//
// Usage:
//   BASE=http://localhost:3000 VARIANT=old node probe.mjs capture old.json   (docker = OLD)
//   BASE=http://localhost:3001 VARIANT=new node probe.mjs capture new.json   (local build = NEW)
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3001";
const VARIANT = process.env.VARIANT || "new";
const WIDTHS = [1280, 1536, 1920, 2560];

// ---- injected class strings (resolved per state) -----------------------------
const STR = {
  old: {
    wrapper: "bb-header-user",
    menuClosed: "bb-header-user-menu",
    menuOpen: "bb-header-user-menu is-open",
    sheetClosed: "bb-header-info-sheet max-[1260px]:hidden",
    sheetOpen: "bb-header-info-sheet max-[1260px]:hidden is-open",
    overlay: "bb-header-info-overlay",
    content: "bb-header-info-content",
  },
  new: {
    wrapper: "relative flex items-stretch",
    menuClosed:
      "absolute top-[var(--bb-header-height)] right-0 z-[var(--bb-z-dropdown)] w-[220px] p-4 bg-white " +
      "[box-shadow:0_4px_16px_rgba(0,0,0,0.18),0_0_6px_rgba(0,0,0,0.1)] " +
      "opacity-0 invisible pointer-events-none [transform:translateY(8px)] " +
      "[transition:opacity_var(--bb-duration-fast)_var(--bb-ease-standard),transform_var(--bb-duration-fast)_var(--bb-ease-standard),visibility_0s_linear_var(--bb-duration-fast),pointer-events_0s_linear_var(--bb-duration-fast)] " +
      "before:content-[''] before:absolute before:top-[-10px] before:right-5 before:w-0 before:h-0 before:[border-left:10px_solid_transparent] before:[border-right:10px_solid_transparent] before:[border-bottom:10px_solid_#ffffff] " +
      "after:content-[''] after:absolute after:bottom-full after:left-0 after:right-0 after:h-3 " +
      "motion-reduce:[transform:none] motion-reduce:[transition:opacity_var(--bb-duration-fast)_linear,visibility_0s_linear_var(--bb-duration-fast),pointer-events_0s_linear_var(--bb-duration-fast)]",
    menuOpen:
      "absolute top-[var(--bb-header-height)] right-0 z-[var(--bb-z-dropdown)] w-[220px] p-4 bg-white " +
      "[box-shadow:0_4px_16px_rgba(0,0,0,0.18),0_0_6px_rgba(0,0,0,0.1)] " +
      "opacity-100 visible pointer-events-auto [transform:translateY(0px)] " +
      "[transition:opacity_var(--bb-duration-fast)_var(--bb-ease-standard),transform_var(--bb-duration-fast)_var(--bb-ease-standard),visibility_0s_linear_0s,pointer-events_0s_linear_0s] " +
      "before:content-[''] before:absolute before:top-[-10px] before:right-5 before:w-0 before:h-0 before:[border-left:10px_solid_transparent] before:[border-right:10px_solid_transparent] before:[border-bottom:10px_solid_#ffffff] " +
      "after:content-[''] after:absolute after:bottom-full after:left-0 after:right-0 after:h-3 " +
      "motion-reduce:[transform:none] motion-reduce:[transition:opacity_var(--bb-duration-fast)_linear,visibility_0s_linear_0s,pointer-events_0s_linear_0s]",
    sheetClosed:
      "bb-header-info-sheet max-[1260px]:hidden fixed inset-0 z-[var(--bb-z-modal)] overflow-hidden " +
      "pointer-events-none invisible [transition:visibility_0s_linear_0.5s]",
    sheetOpen:
      "bb-header-info-sheet max-[1260px]:hidden fixed inset-0 z-[var(--bb-z-modal)] overflow-hidden is-open " +
      "pointer-events-auto visible [transition:visibility_0s_linear_0s]",
    overlayClosed:
      "absolute inset-0 [border:none] bg-[rgba(0,0,0,0.64)] opacity-0 [transition:opacity_0.3s_ease]",
    overlayOpen:
      "absolute inset-0 [border:none] bg-[rgba(0,0,0,0.64)] opacity-100 [transition:opacity_0.3s_ease]",
    contentClosed:
      "bb-header-info-content absolute top-0 right-0 w-[min(100vw,645px)] h-full overflow-y-auto bg-white py-[50px] px-[70px] " +
      "[transform:translateX(100%)] opacity-0 [transition:transform_0.5s_ease,opacity_0.5s_ease]",
    contentOpen:
      "bb-header-info-content absolute top-0 right-0 w-[min(100vw,645px)] h-full overflow-y-auto bg-white py-[50px] px-[70px] " +
      "[transform:translateX(0px)] opacity-100 [transition:transform_0.5s_ease,opacity_0.5s_ease]",
  },
};

const WRAPPER_PROPS = ["position", "display", "alignItems"];
const MENU_PROPS = [
  "position", "top", "right", "zIndex", "width",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "backgroundColor", "boxShadow", "opacity", "visibility", "pointerEvents", "transform",
  "transitionProperty", "transitionDuration", "transitionTimingFunction", "transitionDelay",
];
const BEFORE_PROPS = [
  "content", "position", "top", "right", "width", "height",
  "borderLeftWidth", "borderLeftStyle", "borderLeftColor",
  "borderRightWidth", "borderRightStyle", "borderRightColor",
  "borderBottomWidth", "borderBottomStyle", "borderBottomColor",
];
const AFTER_PROPS = ["content", "position", "bottom", "left", "right", "height"];
const SHEET_PROPS = [
  "position", "top", "right", "bottom", "left", "zIndex", "overflowX", "overflowY",
  "pointerEvents", "visibility", "display",
  "transitionProperty", "transitionDuration", "transitionTimingFunction", "transitionDelay",
];
const OVERLAY_PROPS = [
  "position", "top", "right", "bottom", "left", "borderTopStyle", "borderTopWidth",
  "backgroundColor", "opacity",
  "transitionProperty", "transitionDuration", "transitionTimingFunction", "transitionDelay",
];
const CONTENT_PROPS = [
  "position", "top", "right", "width", "height", "overflowY", "backgroundColor",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "transform", "opacity",
  "transitionProperty", "transitionDuration", "transitionTimingFunction", "transitionDelay",
];

async function snap(page, s) {
  return page.evaluate(({ s, WRAPPER_PROPS, MENU_PROPS, BEFORE_PROPS, AFTER_PROPS, SHEET_PROPS, OVERLAY_PROPS, CONTENT_PROPS }) => {
    document.querySelectorAll(".__probe-host").forEach((n) => n.remove());
    function mk(cls) {
      const d = document.createElement("div");
      d.className = cls;
      return d;
    }
    function read(el, props, pseudo) {
      const cs = getComputedStyle(el, pseudo || null);
      const o = {};
      for (const p of props) o[p] = cs[p];
      return o;
    }
    // user menu hosts
    const wrapC = mk("__probe-host " + s.wrapper);
    const menuC = mk(s.menuClosed);
    wrapC.appendChild(menuC);
    const wrapO = mk("__probe-host " + s.wrapper);
    const menuO = mk(s.menuOpen);
    wrapO.appendChild(menuO);
    // info sheet hosts (closed)
    const sheetC = mk("__probe-host " + s.sheetClosed);
    const ovC = mk(s.overlayClosed || s.overlay);
    const ctC = mk(s.contentClosed || s.content);
    sheetC.appendChild(ovC); sheetC.appendChild(ctC);
    // info sheet hosts (open)
    const sheetO = mk("__probe-host " + s.sheetOpen);
    const ovO = mk(s.overlayOpen || s.overlay);
    const ctO = mk(s.contentOpen || s.content);
    sheetO.appendChild(ovO); sheetO.appendChild(ctO);

    for (const n of [wrapC, wrapO, sheetC, sheetO]) document.body.appendChild(n);

    return {
      wrapper: read(wrapC, WRAPPER_PROPS),
      menuClosed: read(menuC, MENU_PROPS),
      menuClosedBefore: read(menuC, BEFORE_PROPS, "::before"),
      menuClosedAfter: read(menuC, AFTER_PROPS, "::after"),
      menuOpen: read(menuO, MENU_PROPS),
      menuOpenBefore: read(menuO, BEFORE_PROPS, "::before"),
      menuOpenAfter: read(menuO, AFTER_PROPS, "::after"),
      sheetClosed: read(sheetC, SHEET_PROPS),
      overlayClosed: read(ovC, OVERLAY_PROPS),
      contentClosed: read(ctC, CONTENT_PROPS),
      sheetOpen: read(sheetO, SHEET_PROPS),
      overlayOpen: read(ovO, OVERLAY_PROPS),
      contentOpen: read(ctO, CONTENT_PROPS),
    };
  }, { s, WRAPPER_PROPS, MENU_PROPS, BEFORE_PROPS, AFTER_PROPS, SHEET_PROPS, OVERLAY_PROPS, CONTENT_PROPS });
}

async function capture(out) {
  const s = STR[VARIANT];
  if (!s) throw new Error("VARIANT must be old|new");
  const browser = await chromium.launch();
  const data = {};
  for (const motion of ["normal", "reduce"]) {
    const ctx = await browser.newContext({ reducedMotion: motion === "reduce" ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector(".bb-site-header", { timeout: 30000 });
      await page.waitForTimeout(200);
      data[`${motion}@${w}`] = await snap(page, s);
      process.stdout.write(`captured ${VARIANT} ${motion}@${w}\n`);
    }
    await ctx.close();
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  let mism = 0;
  for (const bucket of Object.keys(a)) {
    for (const grp of Object.keys(a[bucket])) {
      const av = a[bucket][grp], bv = b[bucket]?.[grp];
      if (!av || !bv) { mism++; console.log(`[${bucket}] ${grp}: missing OLD=${!!av} NEW=${!!bv}`); continue; }
      for (const p of Object.keys(av)) {
        if (av[p] !== bv[p]) { mism++; console.log(`[${bucket}] ${grp}.${p}: OLD="${av[p]}" NEW="${bv[p]}"`); }
      }
    }
  }
  console.log(mism === 0 ? "\n✅ 0 mismatches" : `\n❌ ${mism} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
