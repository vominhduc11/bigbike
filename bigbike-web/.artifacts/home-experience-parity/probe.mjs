// Home Experience-section A/B probe: computed-style parity old vs new.
//   node probe.mjs capture <out.json>   (vs http://localhost:3001/)
//   node probe.mjs diff <old.json> <new.json>
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
// Edges around every CSS boundary the experience leaf touches:
//   374/375 (slide-content mt), 600, 767/768 (mobile<->desktop), 1023/1024
//   (tablet upper), + large-desktop (title clamps, container token).
const VPS = [360, 374, 375, 390, 600, 767, 768, 1023, 1024, 1280, 1536, 1920, 2560];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 1000 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bb-experience--home", { timeout: 30000 });
    // Scroll it into view so the carousel + lazy imgs mount, then let Swiper settle.
    await page.evaluate(() => document.querySelector(".bb-experience--home")?.scrollIntoView());
    await page.waitForSelector(".swiper-slide-active .bb-exp-slide-link", { timeout: 30000 });
    await page.waitForTimeout(2500);
    data[vp] = await page.evaluate(() => {
      const PICK = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const section = document.querySelector(".bb-experience--home");
      const headerOuter = section ? section.children[0] : null;
      const header = headerOuter ? headerOuter.children[0] : null;
      const title = document.querySelector("#home-exp-heading");
      const descWrapper = title ? title.nextElementSibling : null;
      const desc = descWrapper ? descWrapper.querySelector("p") : null;
      const carousel = section ? section.querySelector(".bb-exp-carousel") : null;
      // Home has several Swipers (hero/featured/brand/video) — scope the active
      // slide to THIS carousel, else querySelector grabs the hero's active slide.
      const active = carousel ? carousel.querySelector(".swiper-slide-active") : null;
      const slideContent = active ? active.querySelector(".bb-exp-slide-content") : null;
      const slideCover = active ? active.querySelector(".bb-exp-slide-cover") : null;
      const productImg = slideContent ? slideContent.querySelector("img") : null;
      const slideTitle = active ? active.querySelector("h3") : null;
      const slideLink = active ? active.querySelector(".bb-exp-slide-link") : null;
      return {
        section: PICK(section, ["paddingTop", "paddingBottom", "backgroundColor", "color"]),
        header: PICK(header, ["paddingBottom", "paddingTop", "textAlign", "marginBottom", "borderBottomWidth", "color"]),
        title: PICK(title, ["fontFamily", "fontSize", "fontWeight", "textTransform", "color", "marginTop", "marginBottom", "lineHeight", "letterSpacing", "maxWidth", "overflowWrap", "textWrap"]),
        descWrapper: PICK(descWrapper, ["paddingTop", "paddingLeft", "paddingRight", "width", "maxWidth", "marginLeft", "marginRight"]),
        desc: PICK(desc, ["color", "maxWidth", "marginTop", "marginBottom", "marginLeft", "lineHeight", "fontSize"]),
        carousel: PICK(carousel, ["paddingBottom", "paddingTop", "width"]),
        slideContent: PICK(slideContent, ["marginTop", "paddingBottom", "opacity", "transform", "pointerEvents"]),
        slideCover: PICK(slideCover, ["transform", "transformOrigin", "overflowX"]),
        productImg: PICK(productImg, ["display", "width", "maxWidth", "objectFit"]),
        slideTitle: PICK(slideTitle, ["color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "marginTop", "marginBottom", "maxWidth", "display", "webkitLineClamp", "overflowX", "marginLeft"]),
        slideLink: PICK(slideLink, ["display", "width", "paddingTop", "paddingLeft", "borderTopWidth", "borderTopStyle", "borderTopColor", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform", "textDecorationLine", "transitionProperty", "transitionDuration"]),
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
