// Header chrome (container/row/right-header/user-control) computed-style A/B probe.
// Anchors structurally on the KEPT marker `.bb-site-header` so it works whether or
// not the migrated wrappers still carry their bb-* classes.
// Usage:
//   BASE=http://localhost:3000 node probe.mjs capture old.json   (OLD = docker :3000, header CSS unchanged in HEAD)
//   node probe.mjs capture new.json                              (NEW = local build on :3001)
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3001";
// Edge-heavy: 639/640 (user-control pl edge), 767/768 (mobile↔desktop), 1260/1261 (right-header
// justify edge), 1919/1920 (container max-width edge), plus 2560 (4xl) and mid widths.
const VPS = [390, 639, 640, 767, 768, 1024, 1260, 1261, 1280, 1536, 1919, 1920, 2560];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-site-header", { timeout: 30000 });
    await page.waitForTimeout(400);
    data[vp] = await page.evaluate(() => {
      const PICK = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const header = document.querySelector(".bb-site-header");
      const container = header ? header.firstElementChild : null;       // .bb-header-container
      const row = container ? container.firstElementChild : null;       // .bb-header-row
      const logo = row ? row.children[0] : null;                        // .bb-logo
      const rightHeader = row ? row.children[row.children.length - 1] : null; // .bb-right-header
      const nav = rightHeader ? rightHeader.querySelector("nav") : null;      // .bb-navigation
      const userControl = rightHeader ? rightHeader.querySelector(".bb-user-control") : null;
      return {
        container: PICK(container, [
          "display", "width", "height", "maxWidth", "marginLeft", "marginRight",
          "paddingLeft", "paddingRight", "boxSizing",
        ]),
        row: PICK(row, [
          "display", "position", "alignItems", "justifyContent", "height", "minHeight",
        ]),
        rightHeader: PICK(rightHeader, [
          "display", "flexGrow", "alignItems", "justifyContent", "columnGap",
          "height", "minWidth", "width",
        ]),
        navDisplay: nav ? getComputedStyle(nav).display : "MISSING",
        userControl: PICK(userControl, [
          "display", "alignItems", "flexShrink", "paddingLeft", "width", "minHeight", "justifyContent",
        ]),
      };
    });
    process.stdout.write(`captured ${vp}\n`);
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  let mism = 0;
  for (const vp of Object.keys(a)) {
    for (const grp of Object.keys(a[vp])) {
      const av = a[vp][grp], bv = b[vp]?.[grp];
      if (grp === "navDisplay") {
        if (av !== bv) { mism++; console.log(`[${vp}] ${grp}: OLD=${av} NEW=${bv}`); }
        continue;
      }
      if (av === null && bv === null) continue;
      if (!av || !bv) { mism++; console.log(`[${vp}] ${grp}: OLD=${JSON.stringify(av)} NEW=${JSON.stringify(bv)}`); continue; }
      for (const p of Object.keys(av)) {
        if (av[p] !== bv[p]) { mism++; console.log(`[${vp}] ${grp}.${p}: OLD="${av[p]}" NEW="${bv[p]}"`); }
      }
    }
  }
  console.log(mism === 0 ? "\n✅ 0 mismatches" : `\n❌ ${mism} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
