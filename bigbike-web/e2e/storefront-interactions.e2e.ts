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

  async function openMenu(page: Page) {
    await page.locator("[data-header-mobile-trigger]").click();
    await expect(page.locator("[data-header-mobile-menu]")).toBeVisible();
  }

  async function expectMenuClosedAndUnlocked(page: Page) {
    await expect(page.locator("[data-header-mobile-menu]")).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => ({ body: document.body.style.overflow, html: document.documentElement.style.overflow })))
      .toEqual({ body: "", html: "" });
  }

  async function expectPath(page: Page, path: string) {
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  }

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

  test("closes when selecting a category child", async ({ page }) => {
    await settle(page, "/");
    await openMenu(page);
    const branchTrigger = page.locator("[data-header-mobile-menu] [data-header-submenu-trigger]").first();
    if (await branchTrigger.count() === 0) {
      test.skip(true, "No category branch in current navigation data");
      return;
    }

    await branchTrigger.click();
    const childLink = page.locator('[data-header-mobile-menu] [data-header-submenu][data-state="open"] a').first();
    if (await childLink.count() === 0) {
      test.skip(true, "No child item in current navigation data");
      return;
    }

    const childPath = new URL((await childLink.getAttribute("href"))!, page.url()).pathname;
    await childLink.click();
    await expectPath(page, childPath);
    await expectMenuClosedAndUnlocked(page);
  });

  test("closes for auth links and keeps the page scrollable", async ({ page }) => {
    for (const path of ["/dang-ky/", "/dang-nhap/"] as const) {
      await settle(page, "/");
      await openMenu(page);
      await page.locator(`[data-header-mobile-menu] a[href="${path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
      await expectMenuClosedAndUnlocked(page);
    }
  });

  test("closes for the current-page menu item, logo, language switch, and Back", async ({ page }) => {
    await settle(page, "/sp/");
    await openMenu(page);
    await page.locator('[data-header-mobile-menu] a[href="/sp/"]').click();
    await expectMenuClosedAndUnlocked(page);

    await openMenu(page);
    await page.locator("[data-header-logo]").click();
    await expectPath(page, "/");
    await expectMenuClosedAndUnlocked(page);

    await openMenu(page);
    await page.getByRole("button", { name: "EN", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expectMenuClosedAndUnlocked(page);

    await settle(page, "/");
    await openMenu(page);
    await page.locator('[data-header-mobile-menu] a[href="/dang-nhap/"]').click();
    await expect(page).toHaveURL(/\/dang-nhap\/$/);
    await expectMenuClosedAndUnlocked(page);
    await page.goBack();
    await expectPath(page, "/");
    await expectMenuClosedAndUnlocked(page);
  });

  test("keeps the drawer open for a configured new-tab menu item", async ({ page }) => {
    await settle(page, "/");
    await openMenu(page);
    const newTabLink = page.locator('[data-header-mobile-menu] a[target="_blank"]').first();
    if (await newTabLink.count() === 0) {
      test.skip(true, "No configured new-tab menu item in current navigation data");
      return;
    }

    const popupPromise = page.waitForEvent("popup");
    await newTabLink.click();
    await popupPromise;
    await expect(page.locator("[data-header-mobile-menu]")).toBeVisible();
  });

  test("closes account navigation and logout for an authenticated customer", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("bb_customer_authenticated", "1"));
    await page.route("**/api/v1/customer/me", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "menu-test-customer",
          email: "menu-test@example.invalid",
          phone: null,
          displayName: "Khách kiểm thử",
          status: "ACTIVE",
          avatarUrl: null,
        },
      }),
    }));
    await page.route("**/api/v1/customer/auth/logout", (route) => route.fulfill({ status: 204 }));

    await settle(page, "/");
    await openMenu(page);
    const drawer = page.locator("[data-header-mobile-menu]");
    await expect(drawer.locator('a[href="/tai-khoan/"]')).toBeVisible();
    await drawer.locator('a[href="/tai-khoan/"]').click();
    await expectMenuClosedAndUnlocked(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await openMenu(page);
    await drawer.getByRole("button", { name: /đăng xuất/i }).click();
    await expectPath(page, "/");
    await expectMenuClosedAndUnlocked(page);
  });
});
