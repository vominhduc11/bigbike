/**
 * Phase 1 + 2.1 Browser Screenshot QA — v3
 * Captures visual + computed styles for key elements.
 * Usage: QA_BASE_URL=http://localhost:3000 npx tsx scripts/qa-screenshot.ts
 */
import { chromium, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "qa-screenshots");

// ── helpers ─────────────────────────────────────────────────────────────────

async function shotViewport(page: Page, name: string) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ vp   ${path.basename(file)}`);
}

async function shotClipCoords(
  page: Page, name: string,
  x: number, y: number, w: number, h: number,
) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, clip: { x, y, width: w, height: h } });
  console.log(`  ✓ clip ${path.basename(file)}`);
}

async function getStyle(page: Page, selector: string, prop: string): Promise<string> {
  return page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel as string);
      if (!el) return "NOT_FOUND";
      return window.getComputedStyle(el).getPropertyValue(p as string).trim();
    },
    [selector, prop],
  );
}

async function getRect(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom };
  }, selector);
}

async function goto(page: Page, url: string, waitFor?: string) {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});
    // Extra wait for fonts + JS hydration
    await page.waitForTimeout(1500);
    return true;
  } catch (e) {
    console.log(`  ✗ goto ${url}: ${(e as Error).message.split("\n")[0]}`);
    return false;
  }
}

// ── computed style audit ─────────────────────────────────────────────────────

async function auditStyles(page: Page, label: string) {
  const checks: [string, string, string][] = [
    [".wp-header",              "height",           "header height"],
    [".wp-header",              "background-color", "header bg"],
    [".bb-main",                "padding-top",      "main padding-top"],
    [".bb-footer",              "background-color", "footer top bg"],
    [".bb-footer-bottom",       "background-color", "footer bottom bg"],
    [".bb-footer-bottom",       "padding-top",      "footer bottom padding-top"],
    [".bb-footer-bottom-slogan","color",             "slogan color"],
    [".wp-product-card",        "border-width",     "product card border-width"],
    [".wp-product-name",        "font-size",        "product name font-size"],
    [".wp-product-price b",     "font-weight",      "price font-weight"],
    [".wp-product-price b",     "font-size",        "price font-size"],
    [".wp-scroll-to-top",       "background-color", "scroll-btn bg"],
    [".wp-scroll-to-top",       "width",            "scroll-btn width"],
    [".wp-scroll-to-top",       "height",           "scroll-btn height"],
    ["--bb-header-height",      "",                 ""], // token — handled separately
  ];

  console.log(`\n  ── Computed styles [${label}] ──`);
  for (const [sel, prop, desc] of checks) {
    if (!prop) continue;
    const val = await getStyle(page, sel, prop);
    const ok = val !== "NOT_FOUND";
    const flag = (() => {
      if (!ok) return "⚠";
      if (desc === "header height" && !val.startsWith("80")) return "✗";
      if (desc === "header bg" && !val.includes("0, 0, 0")) return "✗";
      if (desc === "footer top bg" && !val.includes("58, 58, 58")) return "✗"; // #3a3a3a
      if (desc === "footer bottom bg" && !val.includes("0, 0, 0")) return "✗";
      if (desc === "product card border-width" && val !== "0px") return "✗";
      if (desc === "product name font-size" && val !== "16px") return "✗";
      if (desc === "price font-weight" && val !== "600") return "✗";
      if (desc === "price font-size" && val !== "14px") return "✗";
      if (desc === "scroll-btn bg" && !val.includes("255, 12, 9")) return "✗"; // #ff0c09
      if (desc === "scroll-btn width" && val !== "52px") return "✗";
      if (desc === "scroll-btn height" && val !== "52px") return "✗";
      return "✓";
    })();
    console.log(`  ${flag} ${desc}: ${val}`);
  }

  // CSS token value
  const tokenVal = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue("--bb-header-height").trim();
  });
  const tokenOk = tokenVal === "5rem" ? "✓" : "✗";
  console.log(`  ${tokenOk} --bb-header-height token: ${tokenVal}`);
}

// ── main ────────────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: "d1440", width: 1440, height: 900 },
  { name: "d1200", width: 1200, height: 800 },
  { name: "t768",  width: 768,  height: 1024 },
  { name: "m375",  width: 375,  height: 812 },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clear old PNGs
  for (const f of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"))) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const browser = await chromium.launch({ headless: true });
  console.log(`\nChromium ${browser.version()} | ${BASE_URL}\n`);

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: "vi-VN",
    });
    const page = await ctx.newPage();
    console.log(`\n════ ${vp.name} (${vp.width}×${vp.height}) ════`);

    // ── HOMEPAGE ────────────────────────────────────────────────────────────
    console.log("\n  → /");
    if (await goto(page, `${BASE_URL}/`, ".bb-main")) {
      // Computed style audit
      await auditStyles(page, vp.name + " homepage");

      // Viewport at top — shows header + hero
      await shotViewport(page, `${vp.name}--home-top`);

      // Header dimensions from DOM
      const headerRect = await getRect(page, ".wp-header");
      console.log(`  header rect: h=${headerRect?.height}px (expected 80)`);

      if (vp.width >= 1200) {
        // Clip header from viewport coordinates (fixed element → use viewport coords)
        if (headerRect) {
          await shotClipCoords(page, `${vp.name}--header-clip`,
            0, 0, vp.width, headerRect.height + 2);
        }

        // Scroll to bottom → footer + scroll-btn
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
        await page.waitForTimeout(600);

        // Scroll-to-top button viewport coords
        const btnRect = await getRect(page, ".wp-scroll-to-top");
        console.log(`  scroll-btn rect: ${JSON.stringify(btnRect)}`);
        await shotViewport(page, `${vp.name}--home-bottom`);
        if (btnRect) {
          await shotClipCoords(page, `${vp.name}--scroll-btn`,
            btnRect.x - 4, btnRect.y - 4, btnRect.width + 8, btnRect.height + 8);
        }

        // Footer bottom clip
        const footerBottomRect = await getRect(page, ".bb-footer-bottom");
        if (footerBottomRect) {
          await shotClipCoords(page, `${vp.name}--footer-bottom`,
            0, footerBottomRect.y, vp.width, footerBottomRect.height);
        }
      }
    }

    // ── CATALOG ─────────────────────────────────────────────────────────────
    console.log("\n  → /san-pham/");
    if (await goto(page, `${BASE_URL}/san-pham/`, ".wp-product-card")) {
      await shotViewport(page, `${vp.name}--catalog-top`);
      if (vp.width >= 1200) {
        // Product card clip from DOM coords
        const cardRect = await getRect(page, ".wp-product-card");
        if (cardRect) {
          await shotClipCoords(page, `${vp.name}--product-card`,
            cardRect.x, cardRect.y, cardRect.width, cardRect.height);
        }
        // Product name font size
        const nameSz = await getStyle(page, ".wp-product-name", "font-size");
        const priceSz = await getStyle(page, ".wp-product-price b", "font-size");
        const priceWt = await getStyle(page, ".wp-product-price b", "font-weight");
        const borderW  = await getStyle(page, ".wp-product-card", "border-width");
        console.log(`  card border-width: ${borderW} (expect 0px)`);
        console.log(`  product-name font-size: ${nameSz} (expect 16px)`);
        console.log(`  price b font-size: ${priceSz} (expect 14px)`);
        console.log(`  price b font-weight: ${priceWt} (expect 600)`);
      }
    }

    // ── 404 ─────────────────────────────────────────────────────────────────
    console.log("\n  → /this-page-does-not-exist/");
    if (await goto(page, `${BASE_URL}/this-page-does-not-exist/`, ".wp-404-page")) {
      await shotViewport(page, `${vp.name}--404-top`);
      if (vp.width >= 1200) {
        const img404Rect = await getRect(page, ".wp-404-image");
        if (img404Rect) {
          await shotClipCoords(page, `${vp.name}--404-image`,
            img404Rect.x, img404Rect.y, img404Rect.width, Math.min(img404Rect.height, 400));
        } else {
          console.log("  ⚠ .wp-404-image not found");
        }
      }
    }

    // ── BLOG ────────────────────────────────────────────────────────────────
    console.log("\n  → /tin-tuc/");
    if (await goto(page, `${BASE_URL}/tin-tuc/`, ".wp-article-card")) {
      await shotViewport(page, `${vp.name}--blog-top`);
    }

    await ctx.close();
  }

  await browser.close();

  const shots = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
  console.log(`\n✅ ${shots.length} screenshots saved to ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
