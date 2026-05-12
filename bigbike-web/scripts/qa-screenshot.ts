/**
 * Phase 1 + 2.1 Browser Screenshot QA
 * Chụp các viewport key để verify visual sau WP parity fixes.
 * Usage: npx tsx scripts/qa-screenshot.ts
 */
import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "qa-screenshots");

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1200", width: 1200, height: 800 },
  { name: "tablet-768",   width: 768,  height: 1024 },
  { name: "mobile-375",   width: 375,  height: 812 },
];

const ROUTES: { slug: string; path: string; waitFor?: string }[] = [
  { slug: "homepage",      path: "/",                waitFor: ".wp-home" },
  { slug: "catalog",       path: "/san-pham/",       waitFor: ".wp-product-card" },
  { slug: "not-found",     path: "/this-404-page/",  waitFor: ".wp-404-page" },
  { slug: "article-list",  path: "/tin-tuc/",        waitFor: ".wp-article-card" },
];

async function shot(
  page: import("@playwright/test").Page,
  name: string,
  vp: { name: string; width: number; height: number },
) {
  const file = path.join(OUT_DIR, `${vp.name}--${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✓ ${path.basename(file)}`);
  return file;
}

async function shotClip(
  page: import("@playwright/test").Page,
  name: string,
  vp: { name: string; width: number; height: number },
  selector: string,
) {
  const el = page.locator(selector).first();
  const bb = await el.boundingBox();
  if (!bb) { console.log(`  ⚠ ${selector} not found for clip ${name}`); return; }
  const file = path.join(OUT_DIR, `${vp.name}--${name}--clip.png`);
  await page.screenshot({
    path: file,
    clip: { x: bb.x, y: bb.y, width: bb.width, height: Math.min(bb.height, 600) },
  });
  console.log(`  ✓ ${path.basename(file)}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  console.log(`\nBrowser: Chromium ${browser.version()}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output: ${OUT_DIR}\n`);

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: "vi-VN",
    });
    const page = await ctx.newPage();
    console.log(`\n── Viewport: ${vp.name} (${vp.width}×${vp.height}) ──`);

    for (const route of ROUTES) {
      try {
        console.log(`  → ${route.path}`);
        await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        if (route.waitFor) {
          await page.waitForSelector(route.waitFor, { timeout: 10000 }).catch(() => {});
        }
        // Extra wait for fonts/images
        await page.waitForTimeout(800);

        // Full page
        await shot(page, route.slug, vp);

        // Component clips — desktop only
        if (vp.width >= 1200) {
          if (route.slug === "homepage") {
            await shotClip(page, "header",         vp, ".wp-header");
            await shotClip(page, "footer-bottom",  vp, ".bb-footer-bottom");
            await shotClip(page, "footer-top",     vp, ".bb-footer");
          }
          if (route.slug === "catalog") {
            await shotClip(page, "product-grid",   vp, ".wp-product-grid");
            await shotClip(page, "product-card-1", vp, ".wp-product-card:first-child");
          }
          if (route.slug === "not-found") {
            await shotClip(page, "404-image-area", vp, ".wp-404-image");
          }
        }

        // Scroll test — scroll to bottom then check scroll-to-top button
        if (route.slug === "homepage" && vp.width >= 1200) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(600);
          const btnVisible = await page.locator(".wp-scroll-to-top").isVisible().catch(() => false);
          console.log(`  ScrollToTopBtn visible after scroll: ${btnVisible ? "YES ✓" : "NO ✗"}`);
          if (btnVisible) {
            await shotClip(page, "scroll-to-top-btn", vp, ".wp-scroll-to-top");
          }
          // Scroll back and screenshot footer
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 400));
          await page.waitForTimeout(300);
          await shotClip(page, "footer-full", vp, ".bb-footer");
        }
      } catch (err) {
        console.error(`  ✗ ${route.path}: ${(err as Error).message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`\n✅ Screenshots saved to: ${OUT_DIR}`);
  console.log(`   Total files: ${fs.readdirSync(OUT_DIR).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
