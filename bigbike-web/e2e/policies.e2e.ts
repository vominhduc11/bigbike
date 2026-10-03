import { expect, test } from "@playwright/test";
import { getPolicyLinks } from "../lib/content/policy-pages";
import { translatePath } from "../lib/utils/routes";
import { DESKTOP, VIEWPORTS } from "./helpers/viewports";
import { installPreviewBackendCors } from "./helpers/preview-backend";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  gotoAndSettle,
  installPageGuards,
} from "./helpers/ui-quality";

// Chỉ đọc trang công khai và nguồn liên hệ thật; không tạo đơn hoặc sửa dữ liệu shop.
test.beforeEach(async ({ page }) => {
  await installPreviewBackendCors(page);
});

test.afterEach(async ({ page }) => {
  // Các kiểm tra đã hoàn tất; request nền bị hủy khi đóng trang không được làm lỗi teardown.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

for (const locale of ["vi", "en"] as const) {
  for (const policy of getPolicyLinks(locale)) {
    const path = translatePath(policy.href, locale);
    test(`${locale}: ${policy.id} có nội dung, điều hướng và metadata`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      const guards = installPageGuards(page);
      const response = await gotoAndSettle(page, path, { scroll: false });
      expect(response?.status()).toBe(200);
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("main h1")).toHaveText(policy.label);
      await expect(page.locator("main aside nav a")).toHaveCount(7);
      await expect(page.locator('main aside a[aria-current="page"]')).toHaveAttribute("href", path);
      await expect(page.locator("[data-footer-menu-link]")).toHaveCount(7);
      await expect(page.locator("[data-footer-support-link]")).toHaveCount(3);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(path);
      for (const language of ["vi", "en"] as const) {
        const alternate = await page.locator(`link[hreflang="${language}"]`).getAttribute("href");
        expect(new URL(alternate!).pathname).toBe(translatePath(policy.href, language));
      }
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/MINH TRUNG|\bundefined\b|\bNaN\b|\[object Object\]/);
      expect(text.length).toBeGreaterThan(300);
      if (policy.id === "payment") {
        await expect(
          page.getByRole("heading", {
            name: locale === "vi" ? "2. Thông tin số tài khoản" : "2. Bank account details",
          }),
        ).toBeVisible();
        await expect(page.locator("main")).toContainText("700039295136");
        await expect(page.locator("main")).toContainText(/Shinhan bank/i);
      }
      if (policy.id === "privacy") {
        await expect(page.locator("main")).toContainText("079190004735");
        await expect(page.locator("main")).toContainText(
          locale === "vi" ? "24 giờ làm việc" : "24 working hours",
        );
      }
      await expectNoHorizontalOverflow(page, path);
      expectNoSeriousIssues(guards, path);
    });
  }
}

for (const viewport of VIEWPORTS.filter(({ name }) =>
  ["mobile-375x812", "tablet-768x1024", "desktop-1440x900"].includes(name),
)) {
  test(`Khách đọc bảng giao hàng và thanh toán tại ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const guards = installPageGuards(page);
    await gotoAndSettle(page, "/chinh-sach/chinh-sach-doi-tra-hang/", { scroll: false });
    await expect(page.locator("main")).toContainText("1-2 ngày");
    await expect(page.locator("main")).toContainText("3 - 4 ngày");
    await expect(page.locator("main")).toContainText("7 ngày");
    await expect(page.locator("main")).toContainText("1 ngày");
    await expectNoHorizontalOverflow(page, "giao hàng");
    const paymentLink = page.locator('main aside a[href="/chinh-sach/chinh-sach-thanh-toan/"]');
    await paymentLink.scrollIntoViewIfNeeded();
    await paymentLink.click();
    await expect(page.locator("main h1")).toHaveText("Chính sách thanh toán");
    await expect(page.locator("main")).toContainText("700039295136");
    await expect(page.locator('main aside a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/chinh-sach/chinh-sach-thanh-toan/",
    );
    await expectNoHorizontalOverflow(page, "thanh toán");
    await page.screenshot({ path: test.info().outputPath("payment-policy.png"), fullPage: true });
    expectNoSeriousIssues(guards, viewport.name);
  });
}
