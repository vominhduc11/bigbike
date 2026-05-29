/**
 * Mobile interaction + viewport capture for the mobile UX audit.
 *
 * Drives a realistic mobile context (390x844, dsf=2, touch) against the dev
 * server and captures VIEWPORT-level screenshots (readable, unlike fullPage)
 * of above-the-fold + interaction states (search panel, category menu, cart
 * sheet, PDP sticky bar, filters). Also records console errors, horizontal
 * overflow, and tap-target sizes of primary actions.
 *
 * Usage:  node e2e/_audit/mobile-capture.mjs --tag=before
 *         BB_VP=360x800 node e2e/_audit/mobile-capture.mjs --tag=before-sm
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const TAG = (argv.find((a) => a.startsWith("--tag=")) || "--tag=before").split("=")[1];
const OUT = join(__dirname, "out", "mobile", TAG);
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BB_BASE || "http://localhost:3001";
const [VW, VH] = (process.env.BB_VP || "390x844").split("x").map(Number);

const log = (...a) => console.log(`[mcap:${TAG}]`, ...a);
const findings = { tag: TAG, base: BASE, viewport: `${VW}x${VH}`, routes: {}, interactions: {}, console: {} };

async function settle(page, ms = 700) {
  // scroll through to trigger lazy content, then back to top
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        window.scrollTo(0, y);
        y += window.innerHeight;
        if (y < document.body.scrollHeight) requestAnimationFrame(step);
        else res();
      };
      step();
    });
  });
  // Next dev server keeps an HMR websocket open so networkidle never settles;
  // use a short soft wait, then a bounded explicit wait for background-images.
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
  // Bounded wait (max 6s) for CSS background-images + <img> to finish loading.
  // background-image isn't covered by the load event; external CDN bg images are
  // why a naive domcontentloaded capture screenshots a black hero placeholder.
  await page.evaluate(async () => {
    const deadline = Date.now() + 9000;
    const pending = () => Array.from(document.images).filter((i) => i.src && !i.complete).length;
    const urls = new Set();
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const bg = getComputedStyle(el).backgroundImage;
      const m = bg && bg.match(/url\("?([^")]+)"?\)/);
      if (m && /^https?:|^\//.test(m[1])) urls.add(m[1]);
    }
    await Promise.race([
      Promise.all(
        [...urls].slice(0, 20).map(
          (u) => new Promise((res) => {
            const img = new Image();
            img.onload = img.onerror = () => res();
            img.src = u;
            if (img.complete) res();
          }),
        ),
      ),
      new Promise((res) => setTimeout(res, 9000)),
    ]);
    while (pending() > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  }).catch(() => {});
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
}

async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      innerWidth: window.innerWidth,
      hasHScroll: de.scrollWidth > de.clientWidth + 1,
    };
  });
}

// measure tap targets for a set of selectors -> [{sel, w, h, ok}]
async function tapTargets(page, sels) {
  return page.evaluate((selectors) => {
    const out = [];
    for (const sel of selectors) {
      const els = Array.from(document.querySelectorAll(sel));
      for (const el of els.slice(0, 1)) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        out.push({ sel, w: Math.round(r.width), h: Math.round(r.height), ok: r.width >= 44 && r.height >= 44 });
      }
    }
    return out;
  }, sels);
}

async function shot(page, name, full = false) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();

  // Hide dev-only floating widgets (React Query Devtools bottom-right, Next dev
  // indicator) so they don't obscure real bottom-edge UI in screenshots. These
  // do NOT exist in the production build.
  await page.addInitScript(() => {
    const css = `.tsqd-parent-container,[class^='tsqd-'],[id^='tsqd'],nextjs-portal,[data-nextjs-toast],[data-next-badge-root],#__next-dev-tools-indicator{display:none!important;visibility:hidden!important;}`;
    const apply = () => { const s = document.createElement("style"); s.id = "bb-hide-dev"; s.textContent = css; document.head?.appendChild(s); };
    if (document.head) apply(); else document.addEventListener("DOMContentLoaded", apply);
  });

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 300)));

  // discover a product url
  await page.goto(BASE + "/san-pham", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1000);
  let productUrl = await page.$$eval("a[href*='/product/']", (as) => as.map((a) => a.getAttribute("href")).find(Boolean));
  if (productUrl && productUrl.startsWith("http")) productUrl = new URL(productUrl).pathname;
  productUrl = productUrl || "/product/tui-chong-nuoc-ilm-bl01/";
  log("product:", productUrl);

  const ROUTES = [
    ["home", "/"],
    ["listing", "/san-pham"],
    ["category-index", "/danh-muc-san-pham"],
    ["pdp", productUrl],
    ["cart", "/gio-hang"],
    ["checkout", "/thanh-toan"],
    ["search-page", "/tim-kiem?s=ao"],
    ["brands", "/brands"],
    ["news", "/tin-tuc"],
    ["login", "/dang-nhap"],
    ["contact", "/lien-he"],
  ];

  for (const [name, route] of ROUTES) {
    const before = consoleErrors.length;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
      await settle(page);
      const ov = await overflow(page);
      await shot(page, `route__${name}__viewport`); // above the fold
      await shot(page, `route__${name}__full`, true);
      findings.routes[name] = { route, status: resp?.status() ?? null, overflow: ov, consoleErrors: consoleErrors.slice(before) };
      log(`route ${name} status=${resp?.status()} hScroll=${ov.hasHScroll} (${ov.scrollWidth}/${ov.clientWidth})`);
    } catch (e) {
      findings.routes[name] = { route, error: String(e).slice(0, 200) };
      log(`route ${name} ERROR`, String(e).slice(0, 120));
    }
  }

  // ---- INTERACTIONS on home ----
  await page.goto(BASE + "/", { waitUntil: "load", timeout: 45000 });
  await settle(page, 800);

  // bottom-nav tap targets
  findings.interactions.bottomNavTargets = await tapTargets(page, [
    ".bb-bottom-nav-item",
  ]).catch(() => null);
  // all bottom nav items
  findings.interactions.bottomNavAll = await page.$$eval(".bb-bottom-nav-item", (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
    }),
  ).catch(() => null);

  // open category menu
  try {
    await page.click("[aria-label='Mở danh mục']", { timeout: 8000 });
    await page.waitForTimeout(700);
    await shot(page, "interaction__menu-open");
    findings.interactions.menu = "opened";
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
  } catch (e) {
    findings.interactions.menu = "FAIL: " + String(e).slice(0, 120);
  }

  // open search
  try {
    await page.click("[aria-label='Mở tìm kiếm']", { timeout: 8000 });
    await page.waitForTimeout(700);
    await shot(page, "interaction__search-open");
    // is input focused?
    const focused = await page.evaluate(() => document.activeElement?.tagName + "/" + (document.activeElement?.getAttribute("type") || ""));
    findings.interactions.searchFocus = focused;
    await shot(page, "interaction__search-open");
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
  } catch (e) {
    findings.interactions.search = "FAIL: " + String(e).slice(0, 120);
  }

  // open cart sheet
  try {
    await page.click("[aria-label='Mở giỏ hàng']", { timeout: 8000 });
    await page.waitForTimeout(900);
    await shot(page, "interaction__cart-sheet");
    findings.interactions.cartSheet = "opened";
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
  } catch (e) {
    findings.interactions.cartSheet = "FAIL: " + String(e).slice(0, 120);
  }

  // ---- PDP interactions ----
  try {
    await page.goto(BASE + productUrl, { waitUntil: "load", timeout: 45000 });
    await settle(page, 900);
    await shot(page, "pdp__top");
    // scroll down a bit to reveal sticky purchase bar
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(600);
    await shot(page, "pdp__scrolled-sticky");
    // sticky bar tap targets
    findings.interactions.pdpSticky = await tapTargets(page, [
      ".bb-pdp-sticky-cta .bb-pdp-sticky-add",
      ".bb-pdp-sticky-cta .bb-pdp-sticky-consult",
      ".bb-pdp-sticky-cta a",
      ".bb-pdp-sticky-cta button",
    ]).catch(() => null);
    findings.interactions.pdpStickyVisible = await page.evaluate(() => {
      const el = document.querySelector(".bb-pdp-sticky-cta");
      if (!el) return "not-found";
      return el.classList.contains("is-visible") ? "visible" : "hidden";
    }).catch(() => "err");
    // Geometry: the sticky CTA must sit ABOVE the bottom nav (not occluded by it)
    // and be fully within the viewport.
    findings.interactions.pdpStickyGeometry = await page.evaluate(() => {
      const cta = document.querySelector(".bb-pdp-sticky-cta");
      const nav = document.querySelector(".bb-bottom-nav");
      if (!cta || !nav) return "missing";
      const c = cta.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        ctaTop: Math.round(c.top), ctaBottom: Math.round(c.bottom),
        navTop: Math.round(n.top), navBottom: Math.round(n.bottom),
        ctaInViewport: c.top >= 0 && c.bottom <= vh + 1,
        ctaAboveNav: c.bottom <= n.top + 1,
      };
    }).catch(() => "err");
    await shot(page, "pdp__sticky-fixed");
    // anchor nav presence
    findings.interactions.pdpAnchorNav = await page.$$eval("[class*='anchor'] a, nav[class*='Anchor'] a", (as) => as.length).catch(() => 0);
  } catch (e) {
    findings.interactions.pdp = "FAIL: " + String(e).slice(0, 120);
  }

  // ---- listing filter ----
  try {
    await page.goto(BASE + "/san-pham", { waitUntil: "load", timeout: 45000 });
    await settle(page, 800);
    await shot(page, "listing__top");
    // look for a filter trigger button on mobile
    const filterBtn = await page.$("button.filter-mobile, button:has-text('Bộ lọc'), [aria-label*='lọc'], [aria-label*='Lọc']");
    if (filterBtn) {
      await filterBtn.scrollIntoViewIfNeeded().catch(() => {});
      await filterBtn.click({ timeout: 8000 });
      await page.waitForTimeout(800);
      await shot(page, "listing__filter-open");
      const drawerOpen = await page.evaluate(() => {
        const el = document.querySelector(".sidebar-wrap-product");
        return el ? el.classList.contains("active") : "no-drawer";
      });
      // verify the close control is reachable + filter content present
      const closeVisible = await page.isVisible(".sidebar-wrap-product .close-btn").catch(() => false);
      findings.interactions.filter = `opened (active=${drawerOpen}, close=${closeVisible})`;
    } else {
      findings.interactions.filter = "no mobile filter trigger found";
    }
  } catch (e) {
    findings.interactions.filter = "FAIL: " + String(e).slice(0, 120);
  }

  findings.console.allErrors = consoleErrors;
  await browser.close();
  writeFileSync(join(OUT, "findings.json"), JSON.stringify(findings, null, 2));
  log("done. out:", OUT);
  // print compact summary
  console.log("\n==== OVERFLOW / CONSOLE SUMMARY ====");
  for (const [name, r] of Object.entries(findings.routes)) {
    const bits = [];
    if (r.error) bits.push("ERROR " + r.error);
    if (r.overflow?.hasHScroll) bits.push(`HSCROLL ${r.overflow.scrollWidth}>${r.overflow.clientWidth}`);
    if (r.consoleErrors?.length) bits.push(`console×${r.consoleErrors.length}`);
    console.log(`- ${name} (${r.route}): ${bits.length ? bits.join(" | ") : "ok"}`);
  }
  console.log("bottomNavAll:", JSON.stringify(findings.interactions.bottomNavAll));
  console.log("searchFocus:", findings.interactions.searchFocus);
  console.log("pdpSticky:", JSON.stringify(findings.interactions.pdpSticky));
  console.log("total console errors:", consoleErrors.length);
}

run().catch((e) => { console.error(e); process.exit(1); });
