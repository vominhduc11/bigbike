import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoAndSettle } from "./helpers/ui-quality";

type Box = { width: number; height: number; top: number; left: number };

async function visibleBoxes(locator: Locator): Promise<Box[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top, left: rect.left };
      })
      .filter((box) => box.width > 0 && box.height > 0),
  );
}

async function expectSameFrame(page: Page, selector: string, label: string, expected?: { width?: number; height?: number }) {
  const frames = page.locator(selector);
  const boxes = await visibleBoxes(frames);
  if (boxes.length === 0 && new URL(page.url()).hostname === "localhost") {
    test.skip(true, `Not run: local storefront không có dữ liệu cho ${label}`);
  }
  expect(boxes.length, `${label}: phải có ít nhất một khung hiển thị`).toBeGreaterThan(0);

  const first = boxes[0];
  for (const box of boxes) {
    expect(box.width, `${label}: các khung phải cùng chiều rộng`).toBeCloseTo(first.width, 0);
    expect(box.height, `${label}: các khung phải cùng chiều cao`).toBeCloseTo(first.height, 0);
  }
  if (expected?.width != null) expect(first.width, `${label}: chiều rộng khung sai`).toBeCloseTo(expected.width, 0);
  if (expected?.height != null) expect(first.height, `${label}: chiều cao khung sai`).toBeCloseTo(expected.height, 0);
}

async function expectResponsiveCandidates(page: Page, selector: string, label: string) {
  const images = page.locator(selector);
  const measurements = await images.evaluateAll(async (elements) => {
    const rows: Array<{ selected: number; required: number; smallest: number; objectFit: string }> = [];
    for (const element of elements) {
      const image = element as HTMLImageElement;
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || !image.currentSrc) continue;
      await image.decode().catch(() => undefined);
      const srcset = image.getAttribute("srcset") ?? "";
      const candidates = Array.from(srcset.matchAll(/(?:^|,\s*)\S+\s+(\d+)w/g))
        .map((match) => Number(match[1]))
        .filter((value) => Number.isFinite(value));
      const selected = Number(new URL(image.currentSrc, window.location.href).searchParams.get("w"));
      if (candidates.length === 0 || !Number.isFinite(selected)) continue;
      const required = Math.ceil(rect.width * window.devicePixelRatio);
      const smallest = Math.min(...candidates.filter((value) => value >= required));
      if (!Number.isFinite(smallest)) continue;
      rows.push({ selected, required, smallest, objectFit: getComputedStyle(image).objectFit });
    }
    return rows;
  });

  if (measurements.length === 0 && new URL(page.url()).hostname === "localhost") {
    test.skip(true, `Not run: local storefront không có ảnh tối ưu cho ${label}`);
  }
  expect(measurements.length, `${label}: phải có ảnh tối ưu để kiểm tra candidate`).toBeGreaterThan(0);
  for (const row of measurements) {
    expect(row.selected, `${label}: candidate phải đủ nét cho khung × DPR`).toBeGreaterThanOrEqual(row.required);
    expect(row.selected, `${label}: không được chọn candidate lớn hơn mức cần thiết`).toBe(row.smallest);
    expect(row.objectFit, `${label}: ảnh phải giữ toàn bộ nội dung`).toBe("contain");
  }
}

async function expectNoHighlightShift(page: Page) {
  const card = page.locator("[data-home-highlight-grid] article").first();
  const before = await card.boundingBox();
  expect(before).not.toBeNull();
  await page.locator("[data-home-highlight-grid] img").evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode().catch(() => undefined)));
  });
  const after = await card.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.top, "khối sản phẩm nổi bật không được nhảy khi ảnh tải xong").toBeCloseTo(before!.top, 0);
  expect(after?.height, "chiều cao card sản phẩm nổi bật không được đổi sau khi ảnh tải").toBeCloseTo(before!.height, 0);
}

test.describe("Chuẩn hóa khung ảnh storefront", () => {
  test.describe.configure({ mode: "serial" });

  test("trang chủ giữ khung ổn định trên mobile, tablet và desktop", async ({ page }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/");

      const categorySize = width >= 1200 ? 160 : width >= 768 ? 128 : 96;
      await expectSameFrame(page, "[data-home-category-grid] a > span > span", `Danh mục @ ${width}px`, {
        width: categorySize,
        height: categorySize,
      });
      await expectSameFrame(page, "[data-home-highlight-image]", `Sản phẩm nổi bật @ ${width}px`, { width: 180, height: 180 });
      await expectSameFrame(page, "[data-home-brand-carousel] a > span", `Logo dải thương hiệu @ ${width}px`, { width: 120, height: 120 });
      await expectResponsiveCandidates(page, "[data-home-category-grid] img, [data-home-highlight-image] img, [data-home-brand-carousel] img", `Trang chủ @ ${width}px`);
      await expectNoHighlightShift(page);
    }
  });

  test("logo Giới thiệu, Thương hiệu, bộ lọc và PageHero dùng khung đồng nhất", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, "/gioi-thieu/");
    await expectSameFrame(page, "[data-about-brand-grid] > a > span", "Logo thương hiệu Giới thiệu", { width: 128, height: 128 });
    await expectResponsiveCandidates(page, "[data-about-brand-grid] img", "Logo thương hiệu Giới thiệu");

    await gotoAndSettle(page, "/brands/");
    await expectSameFrame(page, "[data-brand-list-grid] > a > span", "Logo trang Thương hiệu", { height: 64 });
    await expectResponsiveCandidates(page, "[data-brand-list-grid] img", "Logo trang Thương hiệu");

    await gotoAndSettle(page, "/sp/");
    await expectSameFrame(page, '[data-brand-logo="true"]', "Logo bộ lọc", { width: 96, height: 48 });
    await expectResponsiveCandidates(page, '[data-brand-logo="true"] img', "Logo bộ lọc");

    await gotoAndSettle(page, "/danh-muc/ao-quan-adventure/");
    await expectSameFrame(page, "[data-page-hero-illustration]", "Ảnh minh họa PageHero", { height: 400 });
    await expectResponsiveCandidates(page, "[data-page-hero-illustration] img", "Ảnh minh họa PageHero");
  });

  test("khung CSS không đổi giữa DPR 1 và DPR 2", async ({ browser }) => {
    const measurements: Array<{ dpr: number; category: Box; highlight: Box }> = [];
    for (const dpr of [1, 2]) {
      const context = await browser.newContext({ viewport: { width: 375, height: 900 }, deviceScaleFactor: dpr });
      const page = await context.newPage();
      await gotoAndSettle(page, "/");
      const category = (await visibleBoxes(page.locator("[data-home-category-grid] a > span > span")))[0];
      const highlight = (await visibleBoxes(page.locator("[data-home-highlight-image]")))[0];
      if ((!category || !highlight) && new URL(page.url()).hostname === "localhost") {
        await context.close();
        test.skip(true, "Not run: local storefront không có dữ liệu sản phẩm và danh mục");
      }
      expect(category).toBeDefined();
      expect(highlight).toBeDefined();
      measurements.push({ dpr, category, highlight });
      await expectResponsiveCandidates(page, "[data-home-category-grid] img, [data-home-highlight-image] img", `Trang chủ DPR ${dpr}`);
      await context.close();
    }

    expect(measurements[0].category.width).toBeCloseTo(measurements[1].category.width, 0);
    expect(measurements[0].category.height).toBeCloseTo(measurements[1].category.height, 0);
    expect(measurements[0].highlight.width).toBeCloseTo(measurements[1].highlight.width, 0);
    expect(measurements[0].highlight.height).toBeCloseTo(measurements[1].highlight.height, 0);
  });
});
