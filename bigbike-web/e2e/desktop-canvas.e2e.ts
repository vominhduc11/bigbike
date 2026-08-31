import { expect, test, type Page } from "@playwright/test";

import { gotoAndSettle, expectNoHorizontalOverflow } from "./helpers/ui-quality";
import { SAMPLE } from "./helpers/routes";
import { VIEWPORTS } from "./helpers/viewports";

const CANVAS_MAX = 1440;
const ACCEPTANCE_WIDTHS = new Set([360, 390, 768, 1440, 1920, 2560]);
const ACCEPTANCE_VIEWPORTS = VIEWPORTS.filter((viewport) => ACCEPTANCE_WIDTHS.has(viewport.width));

const ROUTES = [
  { name: "Trang chủ", path: "/" },
  { name: "Danh sách sản phẩm", path: "/sp/" },
  { name: "Danh mục sản phẩm", path: SAMPLE.category },
  { name: "Thương hiệu", path: "/brands/" },
  { name: "Tìm kiếm rỗng", path: "/tim-kiem/?s=__canvas_empty__" },
  { name: "Chi tiết sản phẩm", path: SAMPLE.product },
  { name: "Danh sách tin tức", path: "/tin-tuc/" },
  { name: "Bài viết", path: SAMPLE.news },
  { name: "Chính sách", path: SAMPLE.policy },
  { name: "Giới thiệu", path: "/gioi-thieu/" },
  { name: "Liên hệ", path: "/lien-he/" },
  { name: "Hướng dẫn", path: "/huong-dan/" },
  { name: "Đăng nhập", path: "/dang-nhap/", auth: true },
  { name: "Đăng ký", path: "/dang-ky/", auth: true },
  { name: "Quên mật khẩu", path: "/quen-mat-khau/", auth: true },
  { name: "Giỏ hàng", path: "/gio-hang/" },
  { name: "Đặt hàng", path: "/dat-hang/" },
  { name: "Xác nhận đơn", path: "/don-hang/xac-nhan/" },
  { name: "Tài khoản khách", path: "/tai-khoan/" },
  { name: "Xác nhận email", path: "/xac-nhan-email/", auth: true },
  { name: "Trang chủ tiếng Anh", path: "/en/" },
  { name: "Sản phẩm tiếng Anh", path: "/en/sp/" },
  { name: "Tin tức tiếng Anh", path: "/en/tin-tuc/" },
  { name: "Giới thiệu tiếng Anh", path: "/en/gioi-thieu/" },
  { name: "Liên hệ tiếng Anh", path: "/en/lien-he/" },
  { name: "Đăng nhập tiếng Anh", path: "/en/login/", auth: true },
] as const;

type CanvasMetrics = {
  innerWidth: number;
  root: { left: number; right: number; width: number };
  canvases: Array<{ tag: string; left: number; right: number; width: number; position: string }>;
  fullBleeds: Array<{ tag: string; left: number; right: number; width: number }>;
  rails: number[];
  hero: { left: number; right: number; width: number } | null;
  main: { left: number; right: number; width: number };
};

async function readCanvasMetrics(page: Page): Promise<CanvasMetrics> {
  return page.evaluate(() => {
    const rectOf = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    const root = rectOf(document.documentElement);
    const canvases = Array.from(document.querySelectorAll<HTMLElement>("[data-bb-canvas]"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return getComputedStyle(element).display !== "none" && rect.width > 0;
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        ...rectOf(element),
        position: getComputedStyle(element).position,
      }));
    const rails = Array.from(document.querySelectorAll<HTMLElement>("[data-bb-rail]"))
      .map((element) => element.getBoundingClientRect().width)
      .filter((width) => width > 0);
    const fullBleeds = Array.from(document.querySelectorAll<HTMLElement>("[data-bb-full-bleed]"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return getComputedStyle(element).display !== "none" && rect.width > 0;
      })
      .map((element) => ({ tag: element.tagName.toLowerCase(), ...rectOf(element) }));
    const heroElement = document.querySelector(".bb-main-banner, [data-page-hero]");
    const mainElement = document.querySelector("main");
    if (!mainElement) throw new Error("Không tìm thấy vùng nội dung chính");
    return {
      innerWidth: window.innerWidth,
      root,
      canvases,
      fullBleeds,
      rails,
      hero: heroElement ? rectOf(heroElement) : null,
      main: rectOf(mainElement),
    };
  });
}

async function gotoCanvasRoute(page: Page, path: string): Promise<void> {
  try {
    await gotoAndSettle(page, path);
  } catch (error) {
    // Next dev can abort one navigation while recompiling a concurrently changed
    // module. Retry only that transient case; genuine HTTP/layout failures still fail.
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
    await page.waitForTimeout(250);
    await gotoAndSettle(page, path);
  }
}

async function expectFixedElementsFit(page: Page, label: string): Promise<void> {
  const boxes = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-bb-header], nav.bb-bottom-nav, .bb-pdp-sticky-cta.is-visible, .bb-floating-chat-anchor, .bb-scroll-top-anchor",
      ),
    )
      .filter(
        (element) =>
          getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width > 0,
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: element.tagName.toLowerCase(), left: rect.left, right: rect.right };
      }),
  );
  for (const box of boxes) {
    expect(box.left, `${label}: ${box.selector} tràn mép trái`).toBeGreaterThanOrEqual(-2);
    expect(box.right, `${label}: ${box.selector} tràn mép phải`).toBeLessThanOrEqual(
      (await page.evaluate(() => innerWidth)) + 2,
    );
  }
}

test.describe("Desktop canvas 1440px", () => {
  test.describe.configure({ mode: "serial" });

  for (const viewport of ACCEPTANCE_VIEWPORTS) {
    test(`${viewport.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of ROUTES) {
        await test.step(`${route.name} — ${route.path}`, async () => {
          await gotoCanvasRoute(page, route.path);
          await expect(page.locator("main").first()).toBeVisible();
          await expectNoHorizontalOverflow(page, `${route.name} @ ${viewport.name}`);

          if (route.auth) {
            await expect(page.locator("[data-auth-shell]")).toHaveCount(1);
            await expect(
              page.locator("header[data-auth-header], footer[data-auth-footer]"),
            ).toHaveCount(0);
            await expect(page.locator("[data-auth-guest-exit]")).toBeVisible();
            await expect(page.locator("header[data-bb-header], nav.bb-bottom-nav")).toHaveCount(0);
            return;
          }

          const metrics = await readCanvasMetrics(page);
          const expectedWidth = Math.min(metrics.main.width, CANVAS_MAX);
          expect(
            metrics.canvases.length,
            `${route.name}: thiếu content canvas`,
          ).toBeGreaterThanOrEqual(1);
          expect(
            metrics.fullBleeds.length,
            `${route.name}: thiếu full-bleed surface`,
          ).toBeGreaterThanOrEqual(1);

          for (const canvas of metrics.canvases) {
            expect(canvas.width, `${route.name}: ${canvas.tag} sai chiều rộng canvas`).toBeCloseTo(
              expectedWidth,
              0,
            );
            const leftGap = canvas.left - metrics.main.left;
            const rightGap = metrics.main.right - canvas.right;
            expect(leftGap, `${route.name}: ${canvas.tag} lệch tâm`).toBeCloseTo(rightGap, 0);
          }

          for (const surface of metrics.fullBleeds) {
            expect(surface.left, `${route.name}: ${surface.tag} chưa phủ mép trái`).toBeCloseTo(
              metrics.main.left,
              0,
            );
            expect(surface.right, `${route.name}: ${surface.tag} chưa phủ mép phải`).toBeCloseTo(
              metrics.main.right,
              0,
            );
          }

          expect(
            await page
              .locator("[data-bb-header]")
              .evaluate((element) => getComputedStyle(element).position),
            `${route.name}: header không còn fixed`,
          ).toBe("fixed");

          if (metrics.hero) {
            expect(metrics.hero.left, `${route.name}: hero lệch mép trái main`).toBeCloseTo(
              metrics.main.left,
              0,
            );
            expect(metrics.hero.right, `${route.name}: hero lệch mép phải main`).toBeCloseTo(
              metrics.main.right,
              0,
            );
          }

          for (const railWidth of metrics.rails) {
            expect(railWidth, `${route.name}: inner rail vượt 1200px`).toBeLessThanOrEqual(
              Math.min(metrics.root.width, 1200) + 1,
            );
          }

          await expectFixedElementsFit(page, `${route.name} @ ${viewport.name}`);
        });
      }
    });
  }

  test("các trạng thái không ghi dữ liệu vẫn nằm trong canvas", async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoCanvasRoute(page, "/tim-kiem/?s=__canvas_empty__");
    await expect(page.locator("main")).toContainText(
      /không tìm thấy|không có|không tải được|no result|unable to load|0 kết quả/i,
    );

    await gotoCanvasRoute(page, "/xac-nhan-email/");
    await expect(page.locator("main")).toContainText(/liên kết không hợp lệ|invalid link/i);

    await context.clearCookies();
    await gotoCanvasRoute(page, "/tai-khoan/");
    await expect(page).toHaveURL(/\/dang-nhap\//);

    await gotoCanvasRoute(page, "/don-hang/xac-nhan/");
    await expect(page.locator("main")).toContainText(/đơn hàng.*tiếp nhận|order.*received/i);
  });
});
