// Home hero A/B probe (v2): deterministic active-slide anchor + imgSrc check.
//   node probe2.mjs capture <out.json>   (vs http://localhost:3001/)
//   node probe2.mjs diff <old.json> <new.json>
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const VPS = [390, 767, 768, 1280, 1535, 1536, 1919, 1920, 2559, 2560];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-main-banner", { timeout: 30000 });
    await page.waitForTimeout(2500);
    data[vp] = await page.evaluate(() => {
      const PICK = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const container = document.querySelector(".bb-main-banner");
      const link =
        document.querySelector(".swiper-slide-active .bb-main-banner-link") ||
        Array.from(document.querySelectorAll(".bb-main-banner-link")).filter(
          (el) => !el.closest(".swiper-slide-duplicate")
        )[0] || null;
      const picture = link ? link.querySelector("picture") : null;
      const img = link ? link.querySelector(".bb-main-banner-img") : null;
      const copy = link ? link.querySelector(".bb-main-banner-copy") : null;
      const prev = document.querySelector('button[aria-label="Slide trước"]');
      const next = document.querySelector('button[aria-label="Slide tiếp"]');
      const svgPrev = prev ? prev.querySelector("svg") : null;
      const pagination = container
        ? Array.from(container.children).find(
            (el) => el.tagName === "DIV" && /^\d+\s*\/\s*\d+/.test((el.textContent || "").trim())
          ) : null;
      return {
        container: PICK(container, ["position", "width", "height", "maxHeight", "overflowX", "overflowY", "backgroundColor"]),
        link: PICK(link, ["position", "display", "width", "height", "color", "textDecorationLine", "overflowX", "overflowY", "backgroundColor"]),
        picture: PICK(picture, ["display", "width", "height"]),
        img: PICK(img, ["display", "width", "height", "minHeight", "objectFit", "objectPosition"]),
        imgSrc: img ? (img.currentSrc || img.src || "").split("/").pop() : "MISSING",
        copyDisplay: copy ? getComputedStyle(copy).display : "MISSING",
        prev: PICK(prev, ["position", "top", "left", "right", "zIndex", "display", "alignItems", "justifyContent", "width", "height", "paddingTop", "transform", "borderTopStyle", "borderTopWidth", "backgroundColor", "color", "cursor", "filter", "transitionProperty", "transitionDuration", "opacity"]),
        next: PICK(next, ["left", "right", "width", "height"]),
        svgPrev: PICK(svgPrev, ["display", "flexShrink", "width", "height"]),
        pagination: PICK(pagination, ["position", "left", "bottom", "zIndex", "display", "alignItems", "columnGap", "width", "transform", "paddingBottom", "borderBottomStyle", "borderBottomWidth", "borderBottomColor", "color", "fontFamily", "fontSize", "lineHeight", "textAlign"]),
      };
    });
    process.stdout.write(`captured ${vp} (img=${data[vp].imgSrc})\n`);
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
      if (grp === "copyDisplay" || grp === "imgSrc") {
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
