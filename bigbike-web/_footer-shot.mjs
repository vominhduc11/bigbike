import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE || "http://localhost:3000";
const TAG = process.env.SHOT_TAG || "before";
const OUT = process.env.SHOT_OUT || "/tmp/footer-shots";
const VPS = [
  { name: "390x844", w: 390, h: 844 },
  { name: "768x1024", w: 768, h: 1024 },
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1920x1080", w: 1920, h: 1080 },
  { name: "2560x1440", w: 2560, h: 1440 },
];

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: "vi-VN" });
  const page = await ctx.newPage();
  // Block remote images so the page is stable/fast (sandbox has no DNS for cdn.bigbike.vn).
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (/cdn\.bigbike\.vn|img\.youtube\.com|i\.ytimg\.com/.test(u)) return route.abort();
    return route.continue();
  });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  await page.goto(BASE, { waitUntil: "load", timeout: 60000 }).catch((e) => console.log(`[${vp.name}] goto warn: ${e.message}`));

  // Scroll to absolute bottom so the footer + any floating chat sit in the viewport.
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" }));
  // Give the IntersectionObserver time to fire its footer-visible signal.
  await page.waitForTimeout(1800);

  // Horizontal overflow check
  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  }));

  // chat bubble visibility + footer box
  const diag = await page.evaluate(() => {
    const r = (el) => el ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null;
    const footer = document.querySelector("footer");
    const chat = document.querySelector(".bb-floating-chat-anchor");
    const chatVisible = chat ? getComputedStyle(chat).display !== "none" && chat.getBoundingClientRect().height > 0 : false;
    const totop = document.querySelector("footer button[aria-label='Lên đầu trang']");
    const de = document.documentElement;
    return {
      footer: r(footer), chat: r(chat), chatDisplay: chat ? getComputedStyle(chat).display : null, chatVisible, totop: r(totop),
      footerVisibleAttr: de.hasAttribute("data-bb-footer-visible"),
      chatSensitiveAttr: de.hasAttribute("data-bb-chat-sensitive"),
    };
  });
  console.log(`\n[${vp.name}] overflowX=${overflow.overflowX}px chatVisible=${diag.chatVisible} chatDisplay=${diag.chatDisplay} footerVisibleAttr=${diag.footerVisibleAttr} chatSensitiveAttr=${diag.chatSensitiveAttr}`);
  console.log(`[${vp.name}] totop=`, JSON.stringify(diag.totop), " footer=", JSON.stringify(diag.footer));
  if (errors.length) console.log(`[${vp.name}] console errors:`, errors.slice(0, 4));

  // 1) Viewport at the bottom — shows footer bottom + chat overlap.
  await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-viewport.png` });

  // 2) Whole footer element — shows social alignment + scroll-to-top.
  const footer = page.locator("footer");
  if (await footer.count()) {
    await footer.screenshot({ path: `${OUT}/${TAG}-${vp.name}-footer.png` }).catch((e) => console.log(`[${vp.name}] footer shot failed: ${e.message}`));
  }
  await ctx.close();
}
await browser.close();
console.log("\nDone ->", OUT);
