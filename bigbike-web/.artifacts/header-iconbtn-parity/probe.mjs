// Icon-btn family (search-trigger / cart-link / menu-toggle / info-trigger) A/B probe.
// All four are real, visible header buttons (each at its own breakpoint). We measure
// the shared icon-btn base at rest + on hover. Anchored by kept marker classes
// (bb-header-search-trigger / bb-menu-toggle / bb-header-info-trigger) and structurally
// for the cart link (its bb-cart-icon-link class is dropped in NEW).
// Usage:
//   BASE=http://localhost:3000 node probe.mjs capture old.json
//   node probe.mjs capture new.json        (BASE defaults :3001)
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3001";

const REST = [
  "display", "alignItems", "justifyContent", "height", "minHeight", "minWidth", "width",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "color", "backgroundColor",
  "borderTopStyle", "borderTopWidth", "borderRadius", "fontSize", "lineHeight", "cursor",
  "textDecorationLine",
];

// Each button + the viewport at which it is visible.
const TARGETS = [
  { key: "search", vp: 1280, sel: ".bb-header-search-trigger" },
  { key: "info", vp: 1280, sel: ".bb-header-info-trigger" },
  { key: "menu", vp: 1024, sel: ".bb-menu-toggle" },
  { key: "cart", vp: 1280, sel: null }, // structural: direct <a> child of .bb-user-control
  // 768 edge: all three visible + the @media(max-width:768) touch-target (min 44px) applies
  { key: "search768", vp: 768, sel: ".bb-header-search-trigger" },
  { key: "menu768", vp: 768, sel: ".bb-menu-toggle" },
  { key: "cart768", vp: 768, sel: null },
];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  // group targets by viewport to minimise reloads
  const byVp = {};
  for (const t of TARGETS) (byVp[t.vp] ||= []).push(t);
  for (const vp of Object.keys(byVp)) {
    await page.setViewportSize({ width: Number(vp), height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-site-header", { timeout: 30000 });
    await page.waitForTimeout(300);
    for (const t of byVp[vp]) {
      const rest = await page.evaluate(({ sel, props }) => {
        let el;
        if (sel) el = document.querySelector(sel);
        else {
          // cart link: the <a href*="gio-hang"|"cart"> inside the user control
          const uc = document.querySelector(".bb-user-control");
          el = uc ? uc.querySelector(":scope > a") : null;
        }
        if (!el) return { __missing: true };
        const r = el.getClientRects();
        const cs = getComputedStyle(el);
        const o = { __visible: r.length > 0 };
        for (const p of props) o[p] = cs[p];
        return o;
      }, { sel: t.sel, props: REST });
      // hover
      let hover = null;
      try {
        if (t.sel) await page.hover(t.sel, { timeout: 4000 });
        else {
          const h = await page.$(".bb-user-control > a");
          if (h) await h.hover({ timeout: 4000 });
        }
        await page.waitForTimeout(220);
        hover = await page.evaluate(({ sel }) => {
          let el = sel ? document.querySelector(sel)
            : document.querySelector(".bb-user-control > a");
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { color: cs.color, backgroundColor: cs.backgroundColor };
        }, { sel: t.sel });
        await page.mouse.move(2, 2); // un-hover
        await page.waitForTimeout(120);
      } catch { hover = { __err: true }; }
      data[t.key] = { vp: Number(vp), rest, hover };
      process.stdout.write(`captured ${t.key}@${vp}\n`);
    }
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  let mism = 0;
  for (const key of Object.keys(a)) {
    for (const grp of ["rest", "hover"]) {
      const av = a[key][grp], bv = b[key]?.[grp];
      if (av == null && bv == null) continue;
      if (!av || !bv) { mism++; console.log(`[${key}] ${grp}: OLD=${JSON.stringify(av)} NEW=${JSON.stringify(bv)}`); continue; }
      for (const p of Object.keys(av)) {
        if (av[p] !== bv[p]) { mism++; console.log(`[${key}] ${grp}.${p}: OLD="${av[p]}" NEW="${bv[p]}"`); }
      }
    }
  }
  console.log(mism === 0 ? "\n✅ 0 mismatches" : `\n❌ ${mism} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
