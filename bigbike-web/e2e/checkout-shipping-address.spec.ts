import { test, expect } from "@playwright/test";

/**
 * E2E cho luồng "Giao tới địa chỉ khác địa chỉ thanh toán" trên trang Đặt hàng.
 *
 * Form checkout (WpCheckoutClient) render bất kể giỏ rỗng — không redirect khi giỏ
 * trống — nên test chỉ cần mở /dat-hang/ rồi bật/tắt checkbox. Theo convention của
 * bộ e2e hiện có: nếu form không render (môi trường chưa dựng đủ stack) thì SKIP nhẹ
 * nhàng thay vì fail.
 *
 * Yêu cầu môi trường: web dev server chạy ở http://localhost:3001 (xem playwright.config).
 */

// Khớp cả tiếng Việt lẫn tiếng Anh để không phụ thuộc locale mặc định.
const TOGGLE_RE = /Giao tới địa chỉ khác|Ship to a different address/i;

test("checkout: ship-to-different-address toggle reveals and hides the shipping address form", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/dat-hang/", { waitUntil: "load", timeout: 60000 });

  const toggle = page.getByRole("checkbox", { name: TOGGLE_RE });
  if ((await toggle.count()) === 0) {
    test.skip(true, "Checkout form (ship-to-different toggle) not rendered — môi trường chưa sẵn sàng.");
    return;
  }
  await toggle.first().waitFor({ state: "visible", timeout: 20000 });

  const shipName = page.locator("#shipping_full_name");
  const shipAddr = page.locator("#shipping_address_1");

  // 1. Mặc định: chỉ có địa chỉ thanh toán, khối địa chỉ giao chưa render.
  await expect(toggle.first()).not.toBeChecked();
  await expect(shipName).toHaveCount(0);
  await expect(shipAddr).toHaveCount(0);

  // 2. Bật toggle → hiện khối địa chỉ giao riêng (tên + địa chỉ chi tiết).
  await toggle.first().check();
  await expect(toggle.first()).toBeChecked();
  await expect(shipName).toBeVisible();
  await expect(shipAddr).toBeVisible();

  // 3. Tắt toggle → khối địa chỉ giao biến mất.
  await toggle.first().uncheck();
  await expect(toggle.first()).not.toBeChecked();
  await expect(shipName).toHaveCount(0);
  await expect(shipAddr).toHaveCount(0);
});
