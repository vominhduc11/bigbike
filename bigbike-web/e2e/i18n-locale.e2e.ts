import { expect, test } from "@playwright/test";

test.describe("VI/EN URL locale contract", () => {
  test("renders English directly on the server with canonical alternates", async ({ page }) => {
    await page.goto("/en/");

    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/$/);
    await expect(page.locator('link[rel="alternate"][hreflang="vi"]')).toHaveAttribute("href", /\/$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/$/);
    await expect.poll(async () => (await page.request.get("/brand/header-logo.png")).status()).toBe(200);
  });

  test("language switching preserves query and hash and participates in history", async ({ page }) => {
    await page.goto("/sp/?page=1#products");
    await page.getByRole("button", { name: "EN", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/products\/?\?page=1#products$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goBack();
    await expect(page).toHaveURL(/\/sp\/?\?page=1#products$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");

    await page.goForward();
    await expect(page).toHaveURL(/\/en\/products\/?\?page=1#products$/);
  });

  test("keeps dynamic product deep links locale-aware", async ({ page }) => {
    await page.goto("/sp/");
    const productHref = await page.locator('a[href^="/product/"]').first().getAttribute("href");
    test.skip(!productHref, "The connected catalog has no public product.");

    await page.goto(productHref!);
    await page.getByRole("button", { name: "EN", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/products\/[a-z0-9-]+\/$/);
    await expect(page.locator('link[rel="canonical"][href*="/en/products/"]')).toHaveCount(1);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("localizes protected redirects and the complete return URL", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/en/account/?tab=orders");
    await expect(page).toHaveURL(/\/en\/login\/\?tiep=%2Fen%2Faccount%2F%3Ftab%3Dorders$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("serves the complete English return policy on desktop and mobile", async ({ page }) => {
    await page.goto("/en/policy/return-policy/");
    await expect(page.getByRole("heading", { name: "Returns and Exchanges Policy" })).toBeVisible();
    await expect(page.getByText("7 days", { exact: true })).toBeVisible();
    await expect(page.getByText("1 day", { exact: true })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/policy\/return-policy\/$/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Returns and exchanges support", exact: true }).last()).toBeVisible();
  });
});
