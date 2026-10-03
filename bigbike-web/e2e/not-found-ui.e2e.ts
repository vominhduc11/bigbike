import { expect, test, type Locator, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";

async function boxesOverlap(first: Locator, second: Locator): Promise<boolean> {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  if (!firstBox || !secondBox) return false;

  return !(
    firstBox.x + firstBox.width <= secondBox.x ||
    secondBox.x + secondBox.width <= firstBox.x ||
    firstBox.y + firstBox.height <= secondBox.y ||
    secondBox.y + secondBox.height <= firstBox.y
  );
}

async function openNotFound(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-not-found-recovery]")).toBeVisible();
}

test.describe("Giao diện 404", () => {
  for (const viewport of VIEWPORTS) {
    test(`hành động khôi phục nằm trong màn hình đầu @${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openNotFound(page, "/product/khong-ton-tai-giao-dien-404/");

      const recovery = page.locator("[data-not-found-recovery]");
      const search = recovery.locator('form[role="search"]');
      const primaryAction = recovery.getByRole("link", { name: /Về trang chủ|Go home/i });
      const input = search.getByRole("searchbox");
      const recentArticles = recovery.locator("xpath=following-sibling::section[1]");
      const articleBox =
        (await recentArticles.count()) > 0 ? await recentArticles.boundingBox() : null;

      const [searchBox, primaryBox, inputMetrics, rhythm] = await Promise.all([
        search.boundingBox(),
        primaryAction.boundingBox(),
        input.evaluate((element) => ({
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          height: element.getBoundingClientRect().height,
        })),
        recovery.evaluate((element) => {
          const rect = (selector: string) =>
            element.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
          const recoveryBox = element.getBoundingClientRect();
          const number = rect(":scope > div");
          const title = rect("h1");
          const description = rect("p");
          const searchForm = rect("form");
          const navigation = rect("nav");

          return {
            leftGutter: recoveryBox.left,
            width: recoveryBox.width,
            numberToTitle: number && title ? title.top - number.bottom : -1,
            titleToDescription: title && description ? description.top - title.bottom : -1,
            descriptionToSearch:
              description && searchForm ? searchForm.top - description.bottom : -1,
            searchToNavigation: searchForm && navigation ? navigation.top - searchForm.bottom : -1,
            navigationBottom: navigation?.bottom ?? -1,
          };
        }),
      ]);

      expect(searchBox?.y).toBeGreaterThanOrEqual(0);
      expect((searchBox?.y ?? viewport.height) + (searchBox?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      );
      expect((primaryBox?.y ?? viewport.height) + (primaryBox?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(inputMetrics.fontSize).toBeGreaterThanOrEqual(16);
      expect(inputMetrics.height).toBeGreaterThanOrEqual(48);
      expect(rhythm.leftGutter).toBeGreaterThanOrEqual(16);
      expect(rhythm.width).toBeLessThanOrEqual(720);
      expect(rhythm.numberToTitle).toBeGreaterThanOrEqual(12);
      expect(rhythm.numberToTitle).toBeLessThanOrEqual(20);
      expect(rhythm.titleToDescription).toBeGreaterThanOrEqual(6);
      expect(rhythm.titleToDescription).toBeLessThanOrEqual(12);
      expect(rhythm.descriptionToSearch).toBeGreaterThanOrEqual(20);
      expect(rhythm.descriptionToSearch).toBeLessThanOrEqual(28);
      expect(rhythm.searchToNavigation).toBeGreaterThanOrEqual(12);
      expect(rhythm.searchToNavigation).toBeLessThanOrEqual(20);
      if (articleBox) {
        const navigationToArticles = articleBox.y - rhythm.navigationBottom;
        expect(navigationToArticles).toBeGreaterThanOrEqual(24);
        expect(navigationToArticles).toBeLessThanOrEqual(32);
      }
      await expectNoHorizontalOverflow(page, `404 @${viewport.name}`);

      if (viewport.kind === "mobile") {
        const chat = page.locator("#bb-floating-contact-trigger");
        const bottomNav = page.locator(".bb-bottom-nav");
        await expect(chat).toBeVisible();
        await expect(bottomNav).toBeVisible();
        expect(await boxesOverlap(chat, search)).toBe(false);
        expect(await boxesOverlap(bottomNav, primaryAction)).toBe(false);
      }
    });
  }

  test("URL lạ vẫn có nhận diện BigBike và footer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNotFound(page, "/duong-dan-la-giao-dien-404/");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("img", { name: "BigBike" }).first()).toBeVisible();
  });

  test("URL lạ tiếng Anh giữ đúng ngôn ngữ và lối đi", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openNotFound(page, "/en/path-that-does-not-exist-404/");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Search for products or brands" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/en/products/",
    );
    await expect(page.getByRole("link", { name: "Read news" })).toHaveAttribute(
      "href",
      "/en/tin-tuc/",
    );
  });
});
