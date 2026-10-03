import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

import {
  bootstrapPreviewCustomerSession,
  installPreviewBackendCors,
} from "./helpers/preview-backend";
import { SAMPLE } from "./helpers/routes";
import {
  expectNoBrokenImages,
  expectNoHorizontalOverflow,
  gotoAndSettle,
} from "./helpers/ui-quality";

const REMOVE_ITEM_RE = /Xóa sản phẩm|Remove product/i;
const SHIP_TO_DIFFERENT_RE = /Giao hàng tới địa chỉ khác|Ship to a different address/i;

async function addOnePurchasableItem(page: Page) {
  await gotoAndSettle(page, SAMPLE.product, { scroll: false });
  const section = page.locator("[data-purchase-section]");
  await expect(section).toBeVisible();

  const groups = section.locator('[data-variant-picker] [role="radiogroup"]');
  for (let index = 0; index < (await groups.count()); index += 1) {
    await groups.nth(index).locator('[role="radio"]:not([disabled])').first().click();
  }

  const addButton = section.locator("[data-purchase-add]");
  await expect(addButton).toBeEnabled();
  const added = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/api/v1/cart/items"),
  );
  await addButton.click();
  const addedResponse = await added;
  const addedBody = await addedResponse.text();
  expect(addedResponse.status(), `Không tạo được giỏ E2E: ${addedBody}`).toBeGreaterThanOrEqual(
    200,
  );
  expect(addedResponse.status(), `Không tạo được giỏ E2E: ${addedBody}`).toBeLessThan(300);
  await expect(page.getByText(/Đã thêm vào giỏ|Added to cart/i).first()).toBeVisible();
}

async function removeTemporaryCartItem(page: Page) {
  await gotoAndSettle(page, "/gio-hang/", { scroll: false });
  const removeButton = page.getByRole("button", { name: REMOVE_ITEM_RE }).first();
  if (!(await removeButton.count())) return;

  const removed = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" && response.url().includes("/api/v1/cart/items/"),
  );
  await removeButton.click();
  const removedResponse = await removed;
  expect(removedResponse.status()).toBeGreaterThanOrEqual(200);
  expect(removedResponse.status()).toBeLessThan(300);
  await expect(page.getByRole("button", { name: REMOVE_ITEM_RE })).toHaveCount(0);
}

test.describe("Web UX audit 2026-09-10", () => {
  test("checkout chỉ báo lỗi sau khi rời ô và xoá lỗi ngay khi sửa", async ({ page }) => {
    test.setTimeout(150_000);
    await installPreviewBackendCors(page);
    await bootstrapPreviewCustomerSession(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await addOnePurchasableItem(page);

    try {
      await gotoAndSettle(page, "/dat-hang/", { scroll: false });
      await expect(page.locator("[data-checkout-form]")).toBeVisible();

      const billingName = page.locator("#billing_full_name");
      await expect(billingName).toHaveAttribute("aria-invalid", "false");
      await billingName.clear();
      await billingName.focus();
      await billingName.blur();
      await expect(billingName).toHaveAttribute("aria-invalid", "true");
      await expect(
        page.getByText(/Vui lòng nhập họ và tên|Please enter your full name/i).first(),
      ).toBeVisible();
      await billingName.fill("Nguyễn Văn An");
      await expect(billingName).toHaveAttribute("aria-invalid", "false");

      const shippingToggle = page.getByRole("checkbox", { name: SHIP_TO_DIFFERENT_RE });
      await shippingToggle.check();
      const shippingName = page.locator("#shipping_full_name");
      await expect(shippingName).toHaveAttribute("aria-invalid", "false");
      await shippingName.focus();
      await shippingName.blur();
      await expect(shippingName).toHaveAttribute("aria-invalid", "true");
      await shippingName.fill("Nguyễn Văn Bình");
      await expect(shippingName).toHaveAttribute("aria-invalid", "false");
    } finally {
      await removeTemporaryCartItem(page);
    }
  });

  test("home, PLP, PDP, giỏ, checkout và 404 ổn định ở mobile/tablet/desktop", async ({ page }) => {
    test.setTimeout(300_000);
    await installPreviewBackendCors(page);
    await bootstrapPreviewCustomerSession(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await addOnePurchasableItem(page);

    const screenshotDir = process.env.WEB_UX_SCREENSHOT_DIR;
    if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
    const routes = [
      { name: "home", path: "/", status: 200 },
      { name: "plp", path: "/sp/", status: 200 },
      { name: "pdp", path: SAMPLE.product, status: 200 },
      { name: "cart", path: "/gio-hang/", status: 200 },
      { name: "checkout", path: "/dat-hang/", status: 200 },
      { name: "not-found", path: "/duong-dan-la-ux-2026/", status: 404 },
    ];
    const viewports = [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
    ];

    try {
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const route of routes) {
          const response = await gotoAndSettle(page, route.path);
          expect(response?.status(), `${route.name} @ ${viewport.name}`).toBe(route.status);
          await expect(page.locator("main").first()).toBeVisible();
          await expectNoHorizontalOverflow(page, `${route.name} @ ${viewport.width}px`);
          await expectNoBrokenImages(page, `${route.name} @ ${viewport.width}px`);
          if (screenshotDir) {
            await page.screenshot({
              path: `${screenshotDir}/${viewport.name}-${route.name}.png`,
              fullPage: true,
            });
          }
        }
      }
    } finally {
      await removeTemporaryCartItem(page);
    }
  });
});
