import { test, expect } from "@playwright/test";
import { installPageGuards, expectNoSeriousIssues, gotoAndSettle } from "./helpers/ui-quality";
import { SAMPLE } from "./helpers/routes";
import { installPreviewBackendCors } from "./helpers/preview-backend";

async function openHeaderSearch(page: import("@playwright/test").Page) {
  // SearchToggle is streamed in its own Suspense boundary. Wait for that boundary instead of
  // clicking the already-hydrated header button while its panel is not attached yet.
  const input = page.locator('input[role="combobox"][aria-label]').first();
  await input.waitFor({ state: "attached" });
  await page.locator("button.bb-header-search-trigger").first().click();
  await expect(input).toBeFocused();
  return input;
}

/**
 * Read-only catalog interactions (no data mutation): search results display +
 * empty state, and the PDP gallery thumbnail switch.
 */
test.describe("Search results @1440", () => {
  test("common keyword returns product results", async ({ page }) => {
    await installPreviewBackendCors(page);
    const guards = installPageGuards(page);
    await gotoAndSettle(page, "/", { scroll: false });
    const input = await openHeaderSearch(page);
    await input.fill("balo");
    await input.press("Enter");

    await page.waitForURL(/tim-kiem/i, { timeout: 15000 });
    const productCards = page.locator("[data-catalog-product-grid] [data-product-card]");
    await expect(productCards.first()).toBeVisible({ timeout: 30_000 });

    expect(
      await productCards.count(),
      "search should return product results for 'balo'",
    ).toBeGreaterThan(0);
    expectNoSeriousIssues(guards, "search results");
  });

  test("nonsense keyword shows an empty state, suggestions and a removable filter", async ({
    page,
  }) => {
    await installPreviewBackendCors(page);
    await gotoAndSettle(page, "/tim-kiem/?s=zzqqxx-khong-co-san-pham-9999&in_stock=true", {
      scroll: false,
    });
    await expect(page.locator("[data-catalog-product-grid]")).toHaveCount(0);

    const bodyText = ((await page.locator("main").first().textContent()) ?? "").toLowerCase();
    expect(
      /không tìm thấy|không có|no result|trống|0 kết quả|không tồn tại/.test(bodyText),
      "empty search should show a friendly 'no results' message",
    ).toBeTruthy();

    const recommendations = page.locator("[data-search-recommendations]");
    await expect(recommendations).toBeVisible();
    expect(
      await recommendations.locator("[data-product-card]").count(),
      "empty search should retain customers with suggested products",
    ).toBeGreaterThan(0);

    const removeStockFilter = page
      .locator('[aria-label^="Bỏ bộ lọc:"], [aria-label^="Remove filter:"]')
      .first();
    await expect(removeStockFilter).toBeVisible();
    await removeStockFilter.click();
    await expect(page).not.toHaveURL(/(?:\?|&)in_stock=true(?:&|$)/);
  });
});

test.describe("PDP gallery @1440", () => {
  test("clicking a thumbnail switches the main image", async ({ page }) => {
    await gotoAndSettle(page, SAMPLE.product);
    const thumbs = page.locator("[data-product-gallery-thumb]");
    const n = await thumbs.count();
    if (n < 2) {
      test.skip(true, "Sample product has a single gallery image");
      return;
    }
    const mainImg = page.locator("[data-product-gallery-main] img").first();
    const src1 = await mainImg.getAttribute("src");

    await thumbs.nth(1).click();
    await page.waitForTimeout(400);

    const src2 = await mainImg.getAttribute("src");
    const pressed = await thumbs.nth(1).getAttribute("aria-pressed");
    expect(
      src2 !== src1 || pressed === "true",
      `thumbnail switch had no effect (src ${src1} -> ${src2}, pressed=${pressed})`,
    ).toBeTruthy();
  });
});
