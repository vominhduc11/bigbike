// Header submenu-icon + nav-dropdown animation A/B probe (class-injection).
// The .bb-submenu-icon glyph and the [data-dropdown] mega-menu only render inside
// an opened menu, so we inject synthetic nodes and read computed styles:
//   OLD build (docker :3000, still has the CSS): inject the legacy classes.
//   NEW build (local): inject the NEW inline class strings (which exist in the
//   build because they live in lib/ui-classes.ts + HeaderNavItem.tsx).
// diff() cross-compares OLD's legacy nodes vs NEW's inline nodes.
// Usage:
//   BASE=http://localhost:3000 node probe.mjs capture old.json
//   BASE=http://localhost:3005 node probe.mjs capture new.json
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";

// NEW inline strings — must match the source exactly.
const ICON_NEW =
  "inline-block shrink-0 w-5 h-4 bg-current " +
  "[mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] " +
  "[-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain] " +
  "transition-[background-color] duration-[var(--bb-duration-normal)] ease-[ease]";
const DD_BASE_NEW =
  "opacity-0 [transform:translateY(6px)] pointer-events-none " +
  "[transition:opacity_0.2s_ease,transform_0.2s_ease] motion-reduce:[transition-duration:1ms]";
// visible = cn(base, visible-classes) after twMerge drops the conflicts:
const DD_VIS_NEW =
  "[transition:opacity_0.2s_ease,transform_0.2s_ease] motion-reduce:[transition-duration:1ms] " +
  "opacity-100 [transform:translateY(0px)] pointer-events-auto";

const ICON_PROPS = [
  "display", "flexShrink", "width", "height", "backgroundColor",
  "maskRepeat", "maskPosition", "maskSize",
  "webkitMaskRepeat", "webkitMaskPosition", "webkitMaskSize",
  "transitionProperty", "transitionDuration", "transitionTimingFunction",
];
const DD_PROPS = [
  "opacity", "transform", "pointerEvents",
  "transitionProperty", "transitionDuration", "transitionTimingFunction",
];

async function capture(out) {
  const browser = await chromium.launch();
  // default (no reduced-motion) so the real 0.2s dropdown transition is visible.
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".bb-site-header", { timeout: 30000 });
  await page.waitForTimeout(300);

  const data = await page.evaluate(({ iconNew, ddBaseNew, ddVisNew, iconProps, ddProps }) => {
    const host = document.createElement("div");
    host.style.color = "rgb(0, 128, 255)"; // currentColor source for the icon
    host.style.position = "fixed";
    host.style.left = "-9999px";
    document.body.appendChild(host);
    const mk = (tag, cls, attrs) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      host.appendChild(el);
      return el;
    };
    const nodes = {
      iconOld: mk("span", "bb-submenu-icon"),
      iconNew: mk("span", iconNew),
      ddBaseOld: mk("div", "", { "data-dropdown": "" }),
      ddBaseNew: mk("div", ddBaseNew),
      ddVisOld: mk("div", "is-visible", { "data-dropdown": "" }),
      ddVisNew: mk("div", ddVisNew),
    };
    const pick = (el, props) => {
      const cs = getComputedStyle(el);
      const o = {};
      for (const p of props) o[p] = cs[p];
      return o;
    };
    const res = {
      iconOld: pick(nodes.iconOld, iconProps),
      iconNew: pick(nodes.iconNew, iconProps),
      ddBaseOld: pick(nodes.ddBaseOld, ddProps),
      ddBaseNew: pick(nodes.ddBaseNew, ddProps),
      ddVisOld: pick(nodes.ddVisOld, ddProps),
      ddVisNew: pick(nodes.ddVisNew, ddProps),
    };
    host.remove();
    return res;
  }, { iconNew: ICON_NEW, ddBaseNew: DD_BASE_NEW, ddVisNew: DD_VIS_NEW, iconProps: ICON_PROPS, ddProps: DD_PROPS });

  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out);
}

function cmp(label, av, bv, report) {
  for (const p of Object.keys(av)) {
    if (av[p] !== bv[p]) { report.n++; console.log(`[${label}] ${p}: OLD="${av[p]}" NEW="${bv[p]}"`); }
  }
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  const report = { n: 0 };
  cmp("submenu-icon", a.iconOld, b.iconNew, report);
  cmp("dropdown-base", a.ddBaseOld, b.ddBaseNew, report);
  cmp("dropdown-visible", a.ddVisOld, b.ddVisNew, report);
  console.log(report.n === 0 ? "\n✅ 0 mismatches" : `\n❌ ${report.n} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
