// Cart badge (.bb-cart-badge) class-injection A/B probe.
// The real badge only renders when cartCount > 0, so we inject a synthetic badge
// into the live `.bb-site-header` (the CSS is scoped `.bb-site-header .bb-cart-badge`)
// and read its computed style. OLD = `bb-cart-badge` class against :3000 (CSS present);
// NEW = the inline Tailwind string against :3001 (utilities compiled from CartIcon.tsx).
// Usage:
//   VARIANT=old BASE=http://localhost:3000 node probe.mjs capture old.json
//   VARIANT=new node probe.mjs capture new.json     (BASE defaults :3001)
//   node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3001";
const VARIANT = process.env.VARIANT || "new";
const VPS = [390, 767, 768, 1280];

const OLD_CLASS = "bb-cart-badge";
const NEW_CLASS =
  "absolute top-[-8px] right-[-8px] inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 pt-0 pb-[3px] !rounded-[50%] bg-[var(--bb-action-primary)] text-white font-[family-name:var(--bb-font-body)] text-[11px] font-bold leading-none text-center max-md:top-[-6px] max-md:right-[-6px] max-md:min-w-4 max-md:h-4 max-md:pb-0 max-md:border-2 max-md:border-[var(--bb-color-black)] max-md:text-[9px] max-md:leading-[12px]";

const PROPS = [
  "position", "top", "right", "transform", "display", "alignItems", "justifyContent",
  "minWidth", "height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderRadius", "backgroundColor", "color", "fontFamily", "fontSize", "fontWeight",
  "lineHeight", "textAlign", "borderTopWidth", "borderTopStyle", "borderTopColor",
];

async function capture(out) {
  const cls = VARIANT === "old" ? OLD_CLASS : NEW_CLASS;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-site-header", { timeout: 30000 });
    data[vp] = await page.evaluate(({ cls, props }) => {
      const header = document.querySelector(".bb-site-header");
      const host = document.createElement("span");
      host.className = "relative inline-flex";
      const badge = document.createElement("span");
      badge.className = cls;
      badge.textContent = "99";
      host.appendChild(badge);
      header.appendChild(host);
      const cs = getComputedStyle(badge);
      const o = {};
      for (const p of props) o[p] = cs[p];
      host.remove();
      return o;
    }, { cls, props: PROPS });
    process.stdout.write(`captured ${vp}\n`);
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out, "(variant=" + VARIANT + ")");
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  let mism = 0;
  for (const vp of Object.keys(a)) {
    for (const p of Object.keys(a[vp])) {
      if (a[vp][p] !== b[vp]?.[p]) {
        mism++;
        console.log(`[${vp}] ${p}: OLD="${a[vp][p]}" NEW="${b[vp]?.[p]}"`);
      }
    }
  }
  console.log(mism === 0 ? "\n✅ 0 mismatches" : `\n❌ ${mism} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
