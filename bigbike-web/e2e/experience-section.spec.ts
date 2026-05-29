import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const BREAKPOINTS = [
  { name: "360", width: 360, height: 800 },
  { name: "576", width: 576, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "992", width: 992, height: 768 },
  { name: "1200", width: 1200, height: 800 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "2560", width: 2560, height: 1440 },
];

const AUDIT_DIR = path.join(
  process.cwd(),
  "docs",
  "audits",
  "experience-section"
);

test.beforeAll(() => {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
});

for (const bp of BREAKPOINTS) {
  test(`experience section @ ${bp.name}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto("/", { waitUntil: "load", timeout: 60000 });

    const section = page.locator(".bb-experience--home");
    if ((await section.count()) === 0) {
      console.log(`[${bp.name}px] SKIP: no .bb-experience--home found (no data)`);
      return;
    }
    await section.waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Absolute document bounding box (for layout checks)
    const sectionBox = await section.boundingBox();
    if (!sectionBox) {
      console.log(`[${bp.name}px] SKIP: section has no bounding box`);
      return;
    }

    // 1. Section height must be positive
    expect(sectionBox.height, `Section height > 0 at ${bp.name}px`).toBeGreaterThan(0);

    // 2. Section must not overflow viewport horizontally
    expect(sectionBox.x, `Section x >= 0`).toBeGreaterThanOrEqual(0);
    expect(sectionBox.x + sectionBox.width, `Section right edge <= viewport`).toBeLessThanOrEqual(bp.width + 2);

    // 3. Section must not overlap PromoBanner above it
    const promoBanner = page.locator(".bb-home .banner-ads");
    if ((await promoBanner.count()) > 0) {
      const promoBox = await promoBanner.boundingBox();
      if (promoBox) {
        const promoBottom = promoBox.y + promoBox.height;
        expect(
          sectionBox.y,
          `Experience top (${Math.round(sectionBox.y)}) must be >= PromoBanner bottom (${Math.round(promoBottom)}) at ${bp.name}px`
        ).toBeGreaterThanOrEqual(promoBottom - 2);
      }
    }

    // 4. News section must not overlap experience section
    const newsSection = page.locator(".bb-home-news-parity");
    if ((await newsSection.count()) > 0) {
      const newsBox = await newsSection.boundingBox();
      if (newsBox) {
        const sectionBottom = sectionBox.y + sectionBox.height;
        expect(
          newsBox.y,
          `News section top (${Math.round(newsBox.y)}) must be >= Experience bottom (${Math.round(sectionBottom)}) at ${bp.name}px`
        ).toBeGreaterThanOrEqual(sectionBottom - 2);
      }
    }

    // 5. Carousel height must be reasonable
    const carousel = page.locator(".bb-exp-carousel");
    let carouselBox = null;
    if ((await carousel.count()) > 0) {
      carouselBox = await carousel.boundingBox();
      if (carouselBox) {
        expect(carouselBox.height, `Carousel height > 100 at ${bp.name}px`).toBeGreaterThan(100);

        // 6. "XEM CHI TIẾT" button must not be clipped by carousel
        const activeLink = page.locator(".swiper-slide-active .bb-exp-slide-link");
        if ((await activeLink.count()) > 0) {
          const linkBox = await activeLink.boundingBox();
          if (linkBox) {
            const carouselBottom = carouselBox.y + carouselBox.height;
            const buttonBottom = linkBox.y + linkBox.height;
            const clipped = buttonBottom > carouselBottom + 5;
            console.log(
              `[${bp.name}px] button_bottom=${Math.round(buttonBottom)} carousel_bottom=${Math.round(carouselBottom)} ${clipped ? "⚠️  CLIPPED!" : "✓ OK"}`
            );
            expect(
              buttonBottom,
              `Button bottom (${Math.round(buttonBottom)}) should be within carousel (${Math.round(carouselBottom)}) at ${bp.name}px`
            ).toBeLessThanOrEqual(carouselBottom + 5);
          }
        }
      }
    }

    console.log(
      `[${bp.name}px] section: y=${Math.round(sectionBox.y)} h=${Math.round(sectionBox.height)}, carousel: h=${carouselBox ? Math.round(carouselBox.height) : "N/A"}`
    );

    // Screenshots — scroll to section first, then capture VIEWPORT-relative coordinates
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // Get viewport-relative rect AFTER scrolling
    const viewportRect = await page.evaluate(() => {
      const el = document.querySelector(".bb-experience--home");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    // Full-width viewport screenshot (current scroll position)
    await page.screenshot({
      path: path.join(AUDIT_DIR, `${bp.name}px-viewport.png`),
    });

    // Clipped section screenshot — viewport relative coords
    if (viewportRect) {
      const clipY = Math.max(0, viewportRect.y - 50);
      const clipH = Math.min(bp.height - clipY, viewportRect.height + 150);
      if (clipH > 0 && clipY < bp.height) {
        await page.screenshot({
          path: path.join(AUDIT_DIR, `${bp.name}px-section.png`),
          clip: { x: 0, y: clipY, width: bp.width, height: clipH },
        });
      }
    }
  });
}
