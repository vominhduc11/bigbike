// Mobile drawer "shift up on expand" probe (targets the drawer's own nav).
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3018";

async function measure(page) {
  return await page.evaluate(() => {
    const drawer = document.querySelector(".bb-mobile-header-drawer");
    const logo = document.querySelector(".bb-mobile-drawer-head img");
    return {
      drawerScrollTop: drawer ? Math.round(drawer.scrollTop) : null,
      drawerScrollHeight: drawer ? Math.round(drawer.scrollHeight) : null,
      drawerClientHeight: drawer ? Math.round(drawer.clientHeight) : null,
      logoTop: logo ? Math.round(logo.getBoundingClientRect().top) : null,
      overflowAnchor: drawer ? getComputedStyle(drawer).overflowAnchor : null,
    };
  });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });

await page.evaluate(() => { const t = document.querySelector(".bb-menu-toggle"); if (t) t.click(); });
await page.waitForSelector(".bb-mobile-header-panel.is-open", { timeout: 5000 });
await page.waitForTimeout(700);

const before = await measure(page);

// Expand the FIRST drawer toggle (= TAT CA SAN PHAM), then measure incrementally.
const steps = [];
async function expandNth(n) {
  const r = await page.evaluate((idx) => {
    const nav = document.querySelector(".bb-mobile-header-drawer nav");
    const btns = nav ? [...nav.querySelectorAll('button[aria-expanded="false"]')] : [];
    if (!btns[idx]) return "none";
    btns[idx].click();
    return btns[idx].closest("div")?.querySelector("a")?.textContent?.trim() || "clicked";
  }, n);
  await page.waitForTimeout(500);
  steps.push({ expanded: r, ...(await measure(page)) });
}

// First expand the top-level "Tat ca san pham"
await expandNth(0);
// Then expand a couple of nested groups to overflow "a lot"
await expandNth(0);
await expandNth(0);

const after = await measure(page);

console.log(JSON.stringify({
  overflowAnchor: before.overflowAnchor,
  before: { scrollTop: before.drawerScrollTop, logoTop: before.logoTop, scrollH: before.drawerScrollHeight, clientH: before.drawerClientHeight },
  steps: steps.map(s => ({ expanded: s.expanded, scrollTop: s.drawerScrollTop, logoTop: s.logoTop, scrollH: s.drawerScrollHeight, overflows: s.drawerScrollHeight > s.drawerClientHeight })),
  after: { scrollTop: after.drawerScrollTop, logoTop: after.logoTop, scrollH: after.drawerScrollHeight, overflows: after.drawerScrollHeight > after.drawerClientHeight },
  verdict: {
    scrollTopShift: (after.drawerScrollTop ?? 0) - (before.drawerScrollTop ?? 0),
    logoShift: (after.logoTop ?? 0) - (before.logoTop ?? 0),
  },
}, null, 2));

await browser.close();
