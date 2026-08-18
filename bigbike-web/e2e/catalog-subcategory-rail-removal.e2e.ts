import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  gotoAndSettle,
  installPageGuards,
} from "./helpers/ui-quality";

const CATALOG_ROUTES = [
  { name: "danh mục cha", path: "/danh-muc/mu-bao-hiem/" },
  { name: "tất cả sản phẩm lọc theo danh mục cha", path: "/sp/?category=mu-bao-hiem" },
  { name: "tìm kiếm lọc theo danh mục cha", path: "/tim-kiem/?q=mu&category=mu-bao-hiem" },
  { name: "thương hiệu", path: "/brands/alpinestar/" },
  { name: "danh mục con", path: "/danh-muc/mu-bao-hiem-fullface/" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const route of CATALOG_ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} không hiển thị dải ô danh mục con @${viewport.name}`, async ({ page }) => {
      const guards = installPageGuards(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoAndSettle(page, route.path);

      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("main nav img")).toHaveCount(0);
      await expect(page.locator('[data-responsive-overflow-ignore="carousel"]')).toHaveCount(0);
      await expectNoHorizontalOverflow(page, `${route.name} @ ${viewport.name}`);
      expectNoSeriousIssues(guards, `${route.name} @ ${viewport.name}`);
    });
  }
}
