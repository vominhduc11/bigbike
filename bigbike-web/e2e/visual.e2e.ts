import { test, expect, type Page, type Locator } from "@playwright/test";
import { gotoAndSettle, disableAnimations } from "./helpers/ui-quality";
import { MOBILE, DESKTOP } from "./helpers/viewports";
import { SAMPLE } from "./helpers/routes";

/**
 * Basic visual regression. Dynamic / auto-rotating regions (images, carousels,
 * hero, cart badge, chat FAB) are masked so snapshots track layout & chrome,
 * not catalog data. Baselines are generated on first run (`--update-snapshots`)
 * and must be reviewed by a human before being trusted.
 */
function dynamicMasks(page: Page): Locator[] {
  return [
    page.locator("img"),
    page.locator("video, iframe"),
    page.locator(".swiper"), // experience / brand carousels rotate
    page.locator(".bb-main-banner"), // hero auto-rotates
    page.locator(".bb-fp-viewport"), // featured-products carousel
    page.locator(".bb-cart-badge"), // count varies
    page.locator(".bb-chat-float, #sudovn-btn-wrapper"), // floating chat FAB
  ];
}

async function prep(page: Page, path: string, vp: { width: number; height: number }): Promise<void> {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await gotoAndSettle(page, path);
  await disableAnimations(page);
  // Freeze Swiper autoplay + reset to slide 0 so full-page captures converge.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>(".swiper").forEach((el) => {
      const sw = (el as unknown as { swiper?: { autoplay?: { stop?: () => void }; slideTo?: (i: number, s: number) => void } }).swiper;
      sw?.autoplay?.stop?.();
      sw?.slideTo?.(0, 0);
    });
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

test.describe("Visual — chrome", () => {
  test("header @desktop", async ({ page }) => {
    await prep(page, "/", DESKTOP);
    await expect(page.locator("header, .bb-header-container").first()).toHaveScreenshot("header-desktop.png", {
      mask: dynamicMasks(page),
    });
  });

  test("header @mobile", async ({ page }) => {
    await prep(page, "/", MOBILE);
    await expect(page.locator("header, .bb-header-container").first()).toHaveScreenshot("header-mobile.png", {
      mask: dynamicMasks(page),
    });
  });

  test("footer @desktop", async ({ page }) => {
    await prep(page, "/", DESKTOP);
    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveScreenshot("footer-desktop.png", { mask: dynamicMasks(page) });
  });

  test("footer @mobile", async ({ page }) => {
    await prep(page, "/", MOBILE);
    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveScreenshot("footer-mobile.png", { mask: dynamicMasks(page) });
  });

  test("mobile bottom nav", async ({ page }) => {
    await prep(page, "/san-pham/", MOBILE);
    await expect(page.locator("nav.bb-bottom-nav")).toHaveScreenshot("bottom-nav-mobile.png", {
      mask: dynamicMasks(page),
    });
  });

  test("featured product card", async ({ page }) => {
    await prep(page, "/", DESKTOP);
    const card = page.locator(".bb-fp-item").first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await expect(card).toHaveScreenshot("product-card-featured.png", { mask: dynamicMasks(page) });
  });
});

test.describe("Visual — overlays", () => {
  test("search overlay @desktop", async ({ page }) => {
    await prep(page, "/", DESKTOP);
    await page.locator("button.bb-header-search-trigger").first().click();
    await page.waitForTimeout(500);
    await disableAnimations(page);
    await expect(page.locator(".bb-header-search-panel").first()).toHaveScreenshot("search-overlay-desktop.png", {
      mask: dynamicMasks(page),
    });
  });

  test("mobile menu drawer", async ({ page }) => {
    await prep(page, "/", MOBILE);
    await page.locator("nav.bb-bottom-nav").getByRole("button", { name: "Mở danh mục" }).click();
    await page.waitForTimeout(500);
    await disableAnimations(page);
    await expect(page.locator(".bb-mobile-header-drawer").first()).toHaveScreenshot("mobile-menu-drawer.png", {
      mask: dynamicMasks(page),
    });
  });
});

test.describe("Visual — pages (full-page baselines)", () => {
  const pages: { name: string; path: string }[] = [
    { name: "home", path: "/" },
    { name: "plp", path: "/san-pham/" },
    { name: "pdp", path: SAMPLE.product },
  ];
  for (const p of pages) {
    test(`${p.name} @desktop`, async ({ page }) => {
      await prep(page, p.path, DESKTOP);
      await expect(page).toHaveScreenshot(`${p.name}-desktop.png`, {
        fullPage: true,
        mask: dynamicMasks(page),
        maxDiffPixelRatio: 0.06,
      });
    });
    test(`${p.name} @mobile`, async ({ page }) => {
      await prep(page, p.path, MOBILE);
      await expect(page).toHaveScreenshot(`${p.name}-mobile.png`, {
        fullPage: true,
        mask: dynamicMasks(page),
        maxDiffPixelRatio: 0.06,
      });
    });
  }
});
