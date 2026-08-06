import { test, expect } from "@playwright/test";
import {
  installPageGuards,
  expectNoSeriousIssues,
  gotoAndSettle,
  expectNoHorizontalOverflow,
  expectNoBrokenImages,
} from "./helpers/ui-quality";
import { ALL_PUBLIC, ACCOUNT_ROUTES } from "./helpers/routes";

/**
 * Route coverage at desktop (1440x900): every public + deep-link route must
 * render its landmarks with no horizontal overflow, no broken images, and no
 * serious runtime/network issues. Account routes must gate guests, not crash.
 */
test.describe("Public + deep-link routes @1440", () => {
  for (const route of ALL_PUBLIC) {
    test(`${route.name} — ${route.path}`, async ({ page }) => {
      const guards = installPageGuards(page);
      const resp = await gotoAndSettle(page, route.path);

      expect(resp?.status() ?? 0, `HTTP status for ${route.path}`).toBeLessThan(400);

      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("footer").first()).toBeVisible();
      await expect(page.locator("header, .bb-header-container").first()).toBeVisible();

      // The page must not be blank.
      const mainText = (await page.locator("main").first().textContent()) ?? "";
      expect(mainText.replace(/\s+/g, " ").trim().length, `main content length on ${route.path}`).toBeGreaterThan(30);

      await expectNoHorizontalOverflow(page, `${route.name} @1440`);
      await expectNoBrokenImages(page, `${route.name} @1440`);

      const summary = expectNoSeriousIssues(guards, route.name);
      if (summary.warnings.length) {
        console.log(`[routes] ${route.path} warnings (${summary.warnings.length}):\n${summary.warnings.join("\n")}`);
      }
    });
  }
});

test.describe("Account routes — guest gating @1440", () => {
  for (const route of ACCOUNT_ROUTES) {
    test(`${route.name} gates guests — ${route.path}`, async ({ page }) => {
      const guards = installPageGuards(page);
      const resp = await gotoAndSettle(page, route.path);

      expect(resp?.status() ?? 0, `HTTP status for ${route.path}`).toBeLessThan(500);

      const finalUrl = page.url();
      const onLogin = /\/dang-nhap\//.test(finalUrl);
      const hasLoginAffordance = await page
        .locator('input[type="password"], a[href*="dang-nhap"]')
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`[account] ${route.path} -> ${finalUrl} (onLogin=${onLogin})`);
      expect(onLogin || hasLoginAffordance, `${route.path} should gate guests (redirect/login affordance)`).toBeTruthy();

      expectNoSeriousIssues(guards, route.name);
    });
  }
});

test.describe("Error handling @1440", () => {
  test("unknown route renders not-found page cleanly", async ({ page }) => {
    const guards = installPageGuards(page);
    const resp = await gotoAndSettle(page, "/khong-ton-tai-zzz-9999/");

    // Phải là 404 thật. Trước 2026-08-06 route này trả 200 vì `app/[locale]/loading.tsx`
    // bọc cả app và làm response stream trước khi notFound() chạy — xem
    // __tests__/seo/render-boundaries.test.ts và e2e/http-status.e2e.ts.
    expect(resp?.status() ?? 0, "404 status").toBe(404);
    await expect(page.locator("footer").first()).toBeVisible();
    await expectNoHorizontalOverflow(page, "not-found @1440");

    // not-found should still avoid serious console/runtime errors
    const summary = expectNoSeriousIssues(guards, "not-found");
    if (summary.warnings.length) {
      console.log(`[routes] not-found warnings:\n${summary.warnings.join("\n")}`);
    }
  });
});
