// BOTTOM NAV A/B probe — real-render (mobile-only nav, always present ≤767).
// Home tab is active on "/". Anchors are STRUCTURAL (NEW drops bb-bottom-nav-item /
// -active-bar classes); only .bb-bottom-nav is kept as a marker.
// Usage: BASE=http://localhost:3000 node probe.mjs capture old.json
//        BASE=http://localhost:3007 node probe.mjs capture new.json
//        node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3007";
const WIDTHS = [390, 374, 360];

const NAV = ["position","bottom","left","right","display","borderTopWidth","borderTopStyle","borderTopColor","backgroundColor","color","zIndex","boxShadow","transitionProperty","transitionDuration","backdropFilter","paddingBottom"];
const DIV = ["display","justifyContent","gap","paddingLeft","paddingRight","paddingTop","paddingBottom"];
const ITEM = ["display","flexDirection","alignItems","justifyContent","gap","minHeight","minWidth","flexGrow","flexShrink","flexBasis","borderTopWidth","borderTopStyle","backgroundColor","color","fontFamily","letterSpacing","cursor","touchAction","paddingLeft","paddingRight","position"];
const BAR = ["position","left","top","height","width","backgroundColor","transform"];
const SPAN = ["maxWidth","overflow","textOverflow","whiteSpace","fontSize","lineHeight","fontWeight","color"];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const data = {};
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-bottom-nav", { timeout: 30000 });
    await page.waitForTimeout(250);
    data[`@${w}`] = await page.evaluate(({ NAV, DIV, ITEM, BAR, SPAN }) => {
      const g = (el, ks) => { if (!el) return { __missing: true }; const cs = getComputedStyle(el); const o = {}; for (const k of ks) o[k] = cs[k]; return o; };
      const nav = document.querySelector(".bb-bottom-nav");
      const div = nav?.querySelector(":scope > div");
      const items = div ? [...div.children] : [];
      const item0 = items[0]; // home (active on "/")
      const item1 = items[1]; // menu (inactive)
      const bar = item0 ? [...item0.querySelectorAll("span")].find(s => getComputedStyle(s).position === "absolute") : null;
      const label0 = item0 ? [...item0.querySelectorAll("span")].filter(s => getComputedStyle(s).position !== "absolute").pop() : null;
      return {
        nav: g(nav, NAV),
        div: g(div, DIV),
        item0: g(item0, ITEM),
        item1: g(item1, ITEM),
        bar: g(bar, BAR),
        label0: g(label0, SPAN),
      };
    }, { NAV, DIV, ITEM, BAR, SPAN });
    process.stdout.write(`captured @${w}\n`);
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
