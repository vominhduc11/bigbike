import { test, expect, type Page } from "@playwright/test";

/**
 * Lô 4 — lưới kiểm tra HÀNH VI tương tác do home.min.js (jQuery) đảm nhiệm, để
 * chứng minh bản React hóa giữ hành vi 1:1. Selector lấy từ markup WP thật
 * (WpHeader/WpFooter/WpCatalogResults). Chạy được cả khi jQuery còn (mốc) lẫn
 * sau khi gỡ home.min.js (bản React).
 */

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function settle(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
}

test.describe("WP interactions — headroom + scrollToTop @desktop", () => {
  test.use({ viewport: DESKTOP });

  test("header gets headroom--not-top after scrolling, removes at top", async ({ page }) => {
    await settle(page, "/");
    const header = page.locator("header.headroom").first();
    await expect(header).not.toHaveClass(/headroom--not-top/);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).toHaveClass(/headroom--not-top/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).not.toHaveClass(/headroom--not-top/);
  });

  test("clicking .scrollToTop returns to top", async ({ page }) => {
    await settle(page, "/");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await page.locator(".scrollToTop").first().click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBeLessThan(5);
  });
});

test.describe("WP interactions — contact drawer @desktop", () => {
  test.use({ viewport: DESKTOP });

  test("hammer-menu-desktop opens drawer, close button hides it", async ({ page }) => {
    await settle(page, "/");
    const drawer = page.locator(".information-slide-bigbike").first();
    await expect(drawer).toBeHidden();
    await page.locator("header .hammer-menu-desktop").first().click();
    await expect(drawer).toBeVisible({ timeout: 4000 });
    await drawer.locator(".close").first().click();
    await expect(drawer).toBeHidden({ timeout: 4000 });
  });
});

test.describe("WP interactions — mobile menu @mobile", () => {
  test.use({ viewport: MOBILE });

  test("hamburger toggles navigation active on/off", async ({ page }) => {
    await settle(page, "/");
    const nav = page.locator("header .navigation").first();
    const burger = page.locator(".hammer-menu-mb").first();
    await burger.click();
    await expect(nav).toHaveClass(/\bactive\b/);
    await burger.click();
    await expect(nav).not.toHaveClass(/\bactive\b/);
  });

  test("every menu-item-has-children exposes an arrow toggle that expands its branch", async ({ page }) => {
    await settle(page, "/");
    await page.locator(".hammer-menu-mb").first().click();
    const parent = page.locator("header .navigation .menu-item-has-children").first();
    const arrow = parent.locator(":scope > .arrow").first();
    await expect(arrow).toHaveCount(1);
    await arrow.scrollIntoViewIfNeeded();
    await arrow.click();
    await expect(parent).toHaveClass(/\bactive\b/);
  });
});
