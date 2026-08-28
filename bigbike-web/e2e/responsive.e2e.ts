import { test, expect, type Page } from "@playwright/test";
import { gotoAndSettle, expectNoHorizontalOverflow } from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";
import { SAMPLE } from "./helpers/routes";

/**
 * Responsive sweep: key routes across the full 8-viewport matrix. The headline
 * check is horizontal overflow (the #1 responsive defect), plus landmark
 * visibility and that fixed bars (header / mobile bottom nav) fit the viewport.
 */
const KEY_ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "Trang chủ" },
  { path: "/sp/", name: "PLP" },
  { path: SAMPLE.product, name: "PDP" },
  { path: SAMPLE.category, name: "Danh mục chi tiết" },
  { path: SAMPLE.brand, name: "Thương hiệu chi tiết" },
  { path: "/tin-tuc/", name: "Tin tức" },
  { path: SAMPLE.news, name: "Bài viết" },
  { path: "/tim-kiem/", name: "Tìm kiếm" },
  { path: "/gio-hang/", name: "Giỏ hàng" },
  { path: "/dang-nhap/", name: "Đăng nhập" },
  { path: "/lien-he/", name: "Liên hệ" },
];

/**
 * Assert a (possibly fixed/sticky) bar fits the visual viewport. Uses the bar's
 * bounding box vs window.innerWidth (which includes the scrollbar gutter), so it
 * is immune to the clientWidth-minus-scrollbar artifact.
 */
async function expectBarFits(page: Page, selector: string, label: string): Promise<void> {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) return;
  if (!(await el.isVisible().catch(() => false))) return;
  const r = await el.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      innerW: window.innerWidth,
    };
  });
  expect(
    r.right,
    `${label}: extends past right edge (right=${r.right} > innerWidth=${r.innerW})`,
  ).toBeLessThanOrEqual(r.innerW + 2);
  expect(r.left, `${label}: starts left of viewport (left=${r.left})`).toBeGreaterThanOrEqual(-2);
}

for (const route of KEY_ROUTES) {
  test.describe(`Responsive — ${route.name} (${route.path})`, () => {
    for (const vp of VIEWPORTS) {
      test(`${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoAndSettle(page, route.path);

        await expect(page.locator("main").first()).toBeVisible();
        await expect(page.locator("footer").first()).toBeVisible();
        await expect(page.locator("header, .bb-header-container").first()).toBeVisible();

        await expectNoHorizontalOverflow(page, `${route.name} @ ${vp.name}`);
        await expectBarFits(page, ".bb-header-container, header", `header @ ${vp.name}`);

        if (vp.kind === "mobile") {
          const bottomNav = page.locator("nav.bb-bottom-nav");
          const stickyPurchaseBar = page.locator(".bb-pdp-sticky-cta.is-visible").first();
          const stickyBarVisible = await stickyPurchaseBar.isVisible().catch(() => false);

          if (stickyBarVisible) {
            await expectBarFits(
              page,
              ".bb-pdp-sticky-cta.is-visible",
              `PDP sticky purchase bar @ ${vp.name}`,
            );
          } else {
            await expect(
              bottomNav,
              `mobile bottom nav should be visible @ ${vp.name}`,
            ).toBeVisible();
            await expectBarFits(page, "nav.bb-bottom-nav", `bottom nav @ ${vp.name}`);
          }
        }
      });
    }
  });
}

const HEADER_NAV_VIEWPORTS = [768, 1024, 1280, 1366, 1440, 1920];

test.describe("Header primary navigation responsive mode", () => {
  for (const width of HEADER_NAV_VIEWPORTS) {
    test(`${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/");

      const desktopMenu = page.locator("[data-header-desktop-menu]").first();
      const mobileMenuTrigger = page.locator("[data-header-mobile-trigger]").first();

      if (width < 1280) {
        await expect(desktopMenu, `desktop menu should be hidden @ ${width}px`).toBeHidden();
        await expect(mobileMenuTrigger, `hamburger should be visible @ ${width}px`).toBeVisible();
        return;
      }

      await expect(desktopMenu, `desktop menu should be visible @ ${width}px`).toBeVisible();
      await expect(mobileMenuTrigger, `hamburger should be hidden @ ${width}px`).toBeHidden();

      const links = desktopMenu.locator(":scope > ul > li > a");
      await expect(links, `five primary menu items should be visible @ ${width}px`).toHaveCount(5);
      await expect(links.first()).toBeVisible();
      const measurements = await links.evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          return {
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
            whiteSpace: style.whiteSpace,
          };
        }),
      );

      for (const measurement of measurements) {
        expect(measurement.whiteSpace, `menu label should not wrap @ ${width}px`).toBe("nowrap");
        expect(
          measurement.scrollHeight,
          `menu label should stay on one line @ ${width}px`,
        ).toBeLessThanOrEqual(measurement.clientHeight);
        expect(
          measurement.scrollWidth,
          `menu label should not overflow its link @ ${width}px`,
        ).toBeLessThanOrEqual(measurement.clientWidth);
      }
    });
  }
});
