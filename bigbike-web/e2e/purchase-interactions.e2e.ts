import { expect, test, type Page } from "@playwright/test";

import { SAMPLE } from "./helpers/routes";

async function openProduct(page: Page) {
  await page.goto(SAMPLE.product, { waitUntil: "domcontentloaded" });
  await page.locator("[data-purchase-section]").waitFor({ state: "visible" });
}

test.describe("Purchase section @desktop", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("giữ bố cục hai cột và bật nút mua sau khi chọn biến thể", async ({ page }) => {
    await openProduct(page);
    const section = page.locator("[data-purchase-section]");
    const gallery = section.locator(":scope > div").first();
    const info = section.locator("[data-purchase-info]");
    const galleryBox = await gallery.boundingBox();
    const infoBox = await info.boundingBox();
    expect(Math.round(galleryBox?.y ?? -1)).toBe(Math.round(infoBox?.y ?? -2));
    expect(galleryBox?.width ?? 0).toBeGreaterThan(infoBox?.width ?? 0);

    const fieldsets = section.locator("[data-variant-picker] fieldset");
    const fieldsetCount = await fieldsets.count();
    for (let index = 0; index < fieldsetCount; index += 1) {
      const option = fieldsets.nth(index).locator('input[type="radio"]:not(:disabled)').first();
      await option.locator("xpath=following-sibling::label").click();
      await expect(option).toBeChecked();
    }

    const quantity = section.locator('input[type="number"]').first();
    await expect(quantity).toHaveValue("1");
    await quantity.locator("xpath=..").getByRole("button").last().click();
    await expect(quantity).toHaveValue("2");
    await expect(section.locator("[data-purchase-add]")).toBeEnabled();
  });
});

test.describe("Purchase section @mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("xếp một cột và hiển thị thanh mua bám đáy", async ({ page }) => {
    await openProduct(page);
    const section = page.locator("[data-purchase-section]");
    const galleryBox = await section.locator(":scope > div").first().boundingBox();
    const infoBox = await section.locator("[data-purchase-info]").boundingBox();
    expect(infoBox?.y ?? 0).toBeGreaterThan((galleryBox?.y ?? 0) + (galleryBox?.height ?? 0));

    const sticky = page.locator(".bb-pdp-sticky-cta");
    await expect(sticky).toHaveAttribute("aria-hidden", "false");
    await expect.poll(async () => {
      const stickyBox = await sticky.boundingBox();
      return Math.abs(844 - ((stickyBox?.y ?? 0) + (stickyBox?.height ?? 0)));
    }).toBeLessThanOrEqual(2);
  });
});
