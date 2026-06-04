import { test, expect } from "@playwright/test";
import {
  installPageGuards,
  expectNoSeriousIssues,
  gotoAndSettle,
  expectNoHorizontalOverflow,
  expectNoBrokenImages,
} from "./helpers/ui-quality";

/**
 * Pipeline smoke: proves Chromium can reach the live storefront, the homepage
 * renders its landmarks, and the UI-quality helpers work end-to-end.
 */
test.describe("Smoke", () => {
  test("homepage renders landmarks with no serious runtime/network/layout issues", async ({ page }) => {
    const guards = installPageGuards(page);
    const resp = await gotoAndSettle(page, "/");
    expect(resp?.status(), "homepage HTTP status").toBeLessThan(400);

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator("footer").first()).toBeVisible();
    await expect(page.locator("header, .bb-header-container").first()).toBeVisible();

    await expectNoHorizontalOverflow(page, "homepage @1440");
    await expectNoBrokenImages(page, "homepage @1440");

    const summary = expectNoSeriousIssues(guards, "homepage");
    if (summary.warnings.length) {
      console.log(`[smoke] non-blocking warnings (${summary.warnings.length}):\n${summary.warnings.join("\n")}`);
    }
  });
});
