import { expect, test } from "@playwright/test";
import { expectNoBrokenImages, expectNoSeriousIssues, installPageGuards } from "./helpers/ui-quality";
import { DESKTOP, MOBILE } from "./helpers/viewports";

test.describe("Trang chủ — carousel ngoài vùng nhìn", () => {
  for (const viewport of [DESKTOP, MOBILE]) {
    test(`chỉ kích hoạt carousel thương hiệu khi gần viewport @${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const guards = installPageGuards(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Brand rail is always the last deferred section, so it is outside the
      // 600px preload margin at the initial viewport even when a content API is empty.
      const rail = page.locator('[data-deferred-home-carousel="brands"]');
      await expect(rail).toHaveAttribute("data-ready", "false");

      await rail.scrollIntoViewIfNeeded();
      await expect(rail).toHaveAttribute("data-ready", "true");
      await expectNoBrokenImages(page, `trang chủ deferred carousel ${viewport.name}`);
      expectNoSeriousIssues(guards, `trang chủ deferred carousel ${viewport.name}`);
    });
  }
});
