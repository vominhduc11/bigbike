import { chromium } from "@playwright/test";
const BASE = process.env.BB_BASE || "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const reqs = [];
page.on("response", (r) => { const u = r.url(); if (r.status() >= 400) reqs.push(`${r.status()} ${u.slice(0, 140)}`); });
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const banner = document.querySelector("#main-banner");
  const slideLinks = Array.from(document.querySelectorAll("#main-banner .bb-main-banner-link"));
  const swiperSlides = document.querySelectorAll("#main-banner .swiper-slide");
  const out = {
    bannerExists: !!banner,
    bannerHeight: banner ? Math.round(banner.getBoundingClientRect().height) : null,
    bannerBg: banner ? getComputedStyle(banner).backgroundColor : null,
    swiperSlideCount: swiperSlides.length,
    links: slideLinks.slice(0, 3).map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        h: Math.round(r.height),
        top: Math.round(r.top),
        bgImage: cs.backgroundImage.slice(0, 120),
        mobileBgVar: cs.getPropertyValue("--bb-mobile-banner-bg").slice(0, 120),
        inlineStyle: (el.getAttribute("style") || "").slice(0, 200),
      };
    }),
    copyEls: Array.from(document.querySelectorAll("#main-banner .bb-main-banner-copy")).slice(0, 2).map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { position: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), color: cs.color };
    }),
  };
  return out;
});
console.log("HERO INFO:", JSON.stringify(info, null, 2));
console.log("\nFAILED REQUESTS (>=400):");
console.log(reqs.length ? [...new Set(reqs)].join("\n") : "  (none)");
// also check whether the resolved bg image actually loads
const bgUrl = info.links?.[0]?.mobileBgVar?.match(/url\("?([^")]+)"?\)/)?.[1];
if (bgUrl) {
  const abs = bgUrl.startsWith("http") ? bgUrl : BASE + bgUrl;
  try {
    const res = await page.request.get(abs);
    console.log(`\nMOBILE BG IMAGE: ${res.status()} ${abs.slice(0, 140)}`);
  } catch (e) { console.log("BG fetch error", String(e).slice(0, 120)); }
}
await browser.close();
