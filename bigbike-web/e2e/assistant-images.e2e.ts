import path from "node:path";
import { test, expect } from "@playwright/test";
import vi from "../messages/vi.json";
import en from "../messages/en.json";
import { VIEWPORTS } from "./helpers/viewports";
import { expectNoHorizontalOverflow, installPageGuards } from "./helpers/ui-quality";

// Composer checks only: no upload, conversation, private customer data or AI call.
// The browser's session bootstrap is intercepted; availability comes from the real API.
test.describe("Assistant image composer without submitting customer data", () => {
  test.describe.configure({ mode: "serial" });
  for (const locale of ["vi", "en"] as const) {
    const labels = locale === "vi" ? vi.Support : en.Support;
    test(`${locale}: three previews, removal and the image cap at three screen sizes`, async ({
      page,
    }, testInfo) => {
      let sessionBootstraps = 0;
      const unexpectedWrites: string[] = [];
      await page.route("**/api/v1/chat/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === "/api/v1/chat/sessions" && request.method() === "POST") {
          sessionBootstraps++;
          await route.fulfill({
            status: 200,
            json: { data: { visitorToken: "E2E_IMAGE_COMPOSER_BROWSER_ONLY" } },
          });
          return;
        }
        if (request.method() !== "GET" && request.method() !== "OPTIONS") {
          unexpectedWrites.push(url.pathname);
          await route.abort();
          return;
        }
        await route.continue();
      });
      const guards = installPageGuards(page);
      await page.goto(locale === "vi" ? "/" : "/en/", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-bigbike-launcher-ready="true"]')).toBeAttached();
      await page.getByRole("button", { name: labels.open, exact: true }).click();
      const panel = page.locator("#bigbike-assistant-panel");
      const chooseImage = panel
        .getByRole("button", { name: labels.chooseImage, exact: true })
        .and(panel.locator("button"));
      await expect(chooseImage).toBeEnabled();
      const input = panel.locator('input[type="file"][accept*="image"]');
      await expect(input).toHaveAttribute("multiple", "");
      const fixture = path.resolve("../bigbike-admin/e2e/fixtures/product-image-2000.jpg");
      await input.setInputFiles([fixture, fixture, fixture, fixture]);
      await expect(panel.getByText(labels.imageTurnLimit.replace("{count}", "3"))).toBeVisible();
      await expect(panel.locator("[data-chat-pending-image]")).toHaveCount(0);
      await input.setInputFiles([fixture, fixture, fixture]);
      await expect(panel.locator("[data-chat-pending-image]")).toHaveCount(3);
      await expect(chooseImage).toBeDisabled();
      for (const viewport of VIEWPORTS.filter((item) => [375, 768, 1440].includes(item.width))) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await expect(panel).toBeVisible();
        await expectNoHorizontalOverflow(page, `${locale} image composer ${viewport.width}`);
        const box = await panel.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(-1);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
        await expect(panel.locator("[data-chat-pending-image]")).toHaveCount(3);
        await page.screenshot({
          path: testInfo.outputPath(`images-${locale}-${viewport.width}.png`),
        });
      }
      await panel
        .getByRole("button", { name: new RegExp(labels.removeSelectedImage) })
        .first()
        .click();
      await expect(panel.locator("[data-chat-pending-image]")).toHaveCount(2);
      await expect(chooseImage).toBeEnabled();
      expect(sessionBootstraps).toBeGreaterThan(0);
      expect(unexpectedWrites).toEqual([]);
      expect(guards.pageErrors).toEqual([]);
      // Existing site-wide analytics warning: WEB_HEADER_UI_2026_09_07.md and
      // DEPLOY_TRO_LY_BIGBIKE_VIDEO_2026-09-08.md. Record it without changing CSP.
      const knownAnalyticsWarning = (entry: { text: string }) =>
        entry.text.includes("https://static.cloudflareinsights.com/beacon.min.js/") &&
        entry.text.includes("Content Security Policy");
      const consoleMessages = [...guards.consoleErrors, ...guards.consoleWarnings];
      const existingAnalyticsWarnings = consoleMessages.filter(knownAnalyticsWarning);
      if (existingAnalyticsWarnings.length) {
        testInfo.annotations.push({
          type: "warning",
          description: "Existing Cloudflare analytics CSP warning; image checks are unaffected.",
        });
      }
      await testInfo.attach("image-composer-checks", {
        body: JSON.stringify({
          locale,
          imageSelectionAndRemoval: "PASS",
          viewportWidths: [375, 768, 1440],
          unexpectedWrites,
          pageErrors: guards.pageErrors,
          existingAnalyticsWarnings,
        }),
        contentType: "application/json",
      });
      expect(
        consoleMessages.filter(
          (item) =>
            /hydration|Minified React|Content Security Policy/i.test(item.text) &&
            !knownAnalyticsWarning(item),
        ),
      ).toEqual([]);
    });
  }
});
