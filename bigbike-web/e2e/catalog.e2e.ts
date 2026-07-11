import { test, expect } from "@playwright/test";
import { installPageGuards, expectNoSeriousIssues, gotoAndSettle } from "./helpers/ui-quality";
import { SAMPLE } from "./helpers/routes";

/**
 * Read-only catalog interactions (no data mutation): search results display +
 * empty state, and the PDP gallery thumbnail switch.
 */
test.describe("Search results @1440", () => {
  test("common keyword returns product results", async ({ page }) => {
    const guards = installPageGuards(page);
    await gotoAndSettle(page, "/");
    await page.locator("button.bb-header-search-trigger").first().click();
    const input = page.locator('input[type="search"]').first();
    await expect(input).toBeFocused();
    await input.fill("balo");
    await input.press("Enter");

    await page.waitForURL(/tim-kiem/i, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);

    const productLinks = page.locator('a[href*="/product/"]');
    expect(await productLinks.count(), "search should return product results for 'balo'").toBeGreaterThan(0);
    expectNoSeriousIssues(guards, "search results");
  });

  test("nonsense keyword shows an empty state (no products, friendly message)", async ({ page }) => {
    // Reuse the URL shape produced by a real search, then swap in a no-match keyword.
    await gotoAndSettle(page, "/");
    await page.locator("button.bb-header-search-trigger").first().click();
    const input = page.locator('input[type="search"]').first();
    await input.fill("balo");
    await input.press("Enter");
    await page.waitForURL(/tim-kiem/i, { timeout: 15000 });

    const url = new URL(page.url());
    const key = [...url.searchParams.keys()][0] ?? "q";
    url.searchParams.set(key, "zzqqxx-khong-co-san-pham-9999");

    await gotoAndSettle(page, url.pathname + url.search);
    const productLinks = page.locator('a[href*="/product/"]');
    expect(await productLinks.count(), "nonsense keyword should yield 0 product results").toBe(0);

    const bodyText = ((await page.locator("main").first().textContent()) ?? "").toLowerCase();
    expect(
      /không tìm thấy|không có|no result|trống|0 kết quả|không tồn tại/.test(bodyText),
      "empty search should show a friendly 'no results' message",
    ).toBeTruthy();
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
    expect(src2 !== src1 || pressed === "true", `thumbnail switch had no effect (src ${src1} -> ${src2}, pressed=${pressed})`).toBeTruthy();
  });
});
