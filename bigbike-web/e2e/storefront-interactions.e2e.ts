import { test, expect, type Page } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function settle(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
}

test.describe("Shell interactions — header scroll + footer scroll @desktop", () => {
  test.use({ viewport: DESKTOP });

  test("header records the scrolled state", async ({ page }) => {
    await settle(page, "/");
    const header = page.locator("[data-bb-header]");
    await expect(header).toHaveAttribute("data-scrolled", "false");
    await expect(page.locator("[data-header-logo] img:visible")).toHaveAttribute("src", "/brand/header-logo.png");
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).toHaveAttribute("data-scrolled", "true");
    await expect(page.locator("[data-header-logo] img:visible")).toHaveAttribute("src", "/brand/header-mark.png");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute("data-scrolled", "false");
    await expect(page.locator("[data-header-logo] img:visible")).toHaveAttribute("src", "/brand/header-logo.png");
  });

  test("footer scroll button returns to top", async ({ page }) => {
    await settle(page, "/");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await page.getByRole("button", { name: "Cuộn lên đầu trang" }).first().click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBeLessThan(5);
  });
});

test.describe("Footer accordion @mobile", () => {
  test.use({ viewport: MOBILE });

  test("information section can collapse and reopen", async ({ page }) => {
    await settle(page, "/");
    const section = page.locator('footer [data-footer-section="menu"]');
    const trigger = section.getByRole("button");
    const content = section.locator("[data-footer-content]");
    await expect(content).toBeVisible();
    await trigger.click();
    await expect(content).toBeHidden();
    await trigger.click();
    await expect(content).toBeVisible();
  });
});

test.describe("Store information drawer @desktop", () => {
  test.use({ viewport: DESKTOP });

  test("opens and closes", async ({ page }) => {
    await settle(page, "/");
    await page.getByRole("button", { name: "Thông tin cửa hàng" }).click();
    const drawer = page.getByRole("dialog", { name: "Thông tin cửa hàng" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Đóng" }).click();
    await expect(drawer).toBeHidden();
  });
});

test.describe("Mobile menu @mobile", () => {
  test.use({ viewport: MOBILE });

  test("hamburger toggles the menu", async ({ page }) => {
    await settle(page, "/");
    const trigger = page.locator("[data-header-mobile-trigger]");
    await trigger.click();
    await expect(page.locator("[data-header-mobile-menu]")).toBeVisible();
    await trigger.click();
    await expect(page.locator("[data-header-mobile-menu]")).toBeHidden();
  });

  test("a parent menu item expands its branch", async ({ page }) => {
    await settle(page, "/");
    await page.locator("[data-header-mobile-trigger]").click();
    const trigger = page.locator("[data-header-mobile-menu] [data-header-submenu-trigger]").first();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      trigger.locator("xpath=following-sibling::*[@data-header-submenu][1]"),
    ).toBeVisible();
  });
});
