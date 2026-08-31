import { expect, test } from "@playwright/test";

import { discoverFirstHref } from "./helpers/routes";
import { gotoAndSettle } from "./helpers/ui-quality";

const GUEST_EXIT = "[data-auth-guest-exit] a";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test("guest exit returns an anonymous product visitor to the exact product page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAndSettle(page, "/sp/");
  const productPath = await discoverFirstHref(page, /\/product\//);
  test.skip(!productPath, "No real product link is available in the current storefront data.");

  await gotoAndSettle(page, productPath!);
  const header = page.locator("header[data-bb-header]");
  await header.getByRole("button", { name: /tài khoản/i }).hover();
  const loginLink = page.getByRole("menu").getByRole("menuitem", { name: /đăng nhập/i });
  await expect(loginLink).toHaveAttribute(
    "href",
    new RegExp(`tiep=.*${encodeURIComponent(productPath!)}`),
  );
  await loginLink.click();

  await expect(page.locator('[data-auth-page="login"]')).toBeVisible();
  await page.locator(GUEST_EXIT).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(productPath);
});

test("guest exit sends account, auth and external destinations to home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, "/tai-khoan/");
  await expect(page).toHaveURL(/\/dang-nhap\/\?tiep=%2Ftai-khoan%2F$/);
  await page.locator(GUEST_EXIT).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");

  await gotoAndSettle(page, "/dang-nhap/?tiep=%2Fdang-ky%2F");
  await page.locator(GUEST_EXIT).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");

  await gotoAndSettle(page, "/dang-nhap/?tiep=https%3A%2F%2Fevil.example%2F");
  await page.locator(GUEST_EXIT).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
});
