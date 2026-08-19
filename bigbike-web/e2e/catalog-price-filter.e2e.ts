import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const CATALOG_ROUTES = ["/sp/", "/en/products/"] as const;
const FALLBACK_BRANDS = ["Alpinestars", "DAINESE", "Kriega", "QUADLOCK", "SPIRIT MOTO", "XPEED", "BIGBIKE"];

async function openPriceFilter(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const filter = page.locator('[data-price-filter="true"]').first();
  await expect(filter, `price filter should render on ${path} (${response?.status() ?? "no response"})`).toBeVisible({ timeout: 30000 });
  return filter;
}

async function openMobileFilter(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const filterButton = page.getByRole("button", { name: /BỘ LỌC|FILTERS/i }).first();
  await expect(filterButton).toBeVisible({ timeout: 30000 });
  await filterButton.click();
  const dialog = page.getByRole("dialog", { name: /BỘ LỌC|FILTERS/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openMobilePriceFilter(page: Page, path: string) {
  const dialog = await openMobileFilter(page, path);
  const priceTrigger = dialog.getByRole("button", { name: /GIÁ|PRICE/i });
  if (await priceTrigger.count()) await priceTrigger.click();
  const filter = dialog.locator('[data-price-filter="true"]');
  await expect(filter).toBeVisible();
  return { dialog, filter };
}

async function openBrandFilter(container: Locator) {
  const brandFilter = container.locator('[data-brand-filter="true"]');
  if (await brandFilter.count()) return brandFilter;
  const brandTrigger = container.getByRole("button", { name: /THƯƠNG HIỆU|BRAND/i });
  if (await brandTrigger.count()) await brandTrigger.click();
  await expect(brandFilter).toBeVisible();
  return brandFilter;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    return { clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth };
  });
  expect(overflow.scrollWidth, "catalog should not have horizontal overflow").toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function expectEdgeAlignedIndicators(filter: Locator) {
  const tracks = filter.locator('span[data-orientation="horizontal"]');
  const track = tracks.nth(Math.max(0, (await tracks.count()) - 1));
  const trackBounds = await track.boundingBox();
  const indicators = filter.locator("[data-slider-thumb-indicator='true']");
  const indicatorBounds = await indicators.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  }));

  expect(trackBounds).not.toBeNull();
  expect(indicatorBounds).toHaveLength(2);
  expect(indicatorBounds[0]!.left).toBeCloseTo(trackBounds!.x, 0);
  expect(indicatorBounds[1]!.right).toBeCloseTo(trackBounds!.x + trackBounds!.width, 0);
  expect(indicatorBounds[0]!.width).toBeGreaterThan(12);
  expect(indicatorBounds[0]!.width).toBeLessThan(44);
}

async function expectBrandLogos(brandFilter: Locator) {
  const rows = brandFilter.locator('[data-brand-filter-row="true"]');
  await expect(rows).not.toHaveCount(0);
  const logoBoxes = await brandFilter.locator('[data-brand-logo="true"]').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  expect(logoBoxes.length).toBe(await rows.count());
  for (const box of logoBoxes) {
    expect(Math.round(box.width)).toBe(24);
    expect(Math.round(box.height)).toBe(24);
  }

  const imageSources = await brandFilter.locator('[data-brand-logo="true"] img').evaluateAll((elements) => (
    elements as HTMLImageElement[]
  ).map((element) => element.currentSrc || element.src));
  for (const source of imageSources) expect(source).not.toMatch(/^https?:\/\//i);

  for (const brand of FALLBACK_BRANDS) {
    const row = rows.filter({ hasText: new RegExp(brand, "i") }).first();
    if (await row.count()) {
      await expect(row.locator('[data-brand-logo="true"] img')).toHaveCount(0);
      await expect(row.locator('[data-brand-logo="true"]')).toContainText(brand.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase());
    }
  }
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("Catalog price filter render/accessibility @price-filter", () => {
  for (const path of CATALOG_ROUTES) {
    test(`${path} renders the full rounded range with one fixed line`, async ({ page }) => {
      const filter = await openPriceFilter(page, path);
      await expectNoHorizontalOverflow(page);

      await expect(filter.locator('[data-price-range-label="true"]')).toBeVisible();
      await expect(filter.locator('[data-price-input]')).toHaveCount(0);
      await expect(filter.locator('[data-price-range-hint]')).toHaveCount(0);
      await expect(filter.locator('[data-price-apply]')).toHaveCount(0);
      await expect(filter.locator('[data-price-thumb-label]')).toHaveCount(0);
      await expect(filter.locator('[data-price-range-label="true"]')).toContainText(path.startsWith("/en") ? "50,000" : "50.000");
      await expect(filter.locator('[data-price-range-label="true"]')).toContainText(path.startsWith("/en") ? "12,000,000" : "12.000.000");

      const thumbs = filter.getByRole("slider");
      await expect(thumbs).toHaveCount(2);
      const thumbData = await thumbs.evaluateAll((elements) => elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        const indicator = element.querySelector("[data-slider-thumb-indicator='true']")?.getBoundingClientRect();
        return {
          width: bounds.width,
          height: bounds.height,
          indicatorWidth: indicator?.width ?? 0,
          indicatorHeight: indicator?.height ?? 0,
          min: element.getAttribute("aria-valuemin"),
          max: element.getAttribute("aria-valuemax"),
          now: element.getAttribute("aria-valuenow"),
          text: element.getAttribute("aria-valuetext"),
        };
      }));
      for (const thumb of thumbData) {
        expect(thumb.width).toBeGreaterThanOrEqual(44);
        expect(thumb.height).toBeGreaterThanOrEqual(44);
        expect(thumb.indicatorWidth).toBeGreaterThan(12);
        expect(thumb.indicatorWidth).toBeLessThan(44);
        expect(thumb.indicatorHeight).toBeLessThan(44);
        expect(Number(thumb.max)).toBeGreaterThan(Number(thumb.min));
        expect(Number(thumb.now)).toBeGreaterThanOrEqual(Number(thumb.min));
        expect(Number(thumb.now)).toBeLessThanOrEqual(Number(thumb.max));
        expect(thumb.text).toMatch(/\d[\d.,]*(?:₫| VND)$/);
      }
      await expectEdgeAlignedIndicators(filter);
    });
  }

  test("dragging exposes continuous values then commits a rounded amount", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/");
    const thumb = filter.getByRole("slider").nth(1);
    const box = await thumb.boundingBox();
    expect(box).not.toBeNull();

    const liveValues: string[] = [];
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(box!.x + box!.width / 2 - step * 8, box!.y + box!.height / 2);
      liveValues.push((await thumb.getAttribute("aria-valuenow")) ?? "");
    }
    await page.mouse.up();

    expect(new Set(liveValues).size).toBeGreaterThan(3);
    const committed = Number(await thumb.getAttribute("aria-valuenow"));
    expect(committed % 500_000 === 0 || committed % 1_000_000 === 0).toBe(true);
  });

  test("the middle of the density scale lands near the common price range", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/");
    const tracks = filter.locator('span[data-orientation="horizontal"]');
    const track = tracks.nth(Math.max(0, (await tracks.count()) - 1));
    const box = await track.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    const text = await filter.locator('[data-price-range-label="true"]').textContent();
    expect(text).toMatch(/(?:1[.,]5|2[.,]0|2[.,]5)\s?million|(?:1[.,]5|2[.,]0|2[.,]5)[.,]0{3}[.,]0{3}/i);
  });

  for (const width of [390, 320]) {
    test(`mobile ${width}px keeps one red apply action and usable handles`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      const { dialog, filter } = await openMobilePriceFilter(page, "/sp/");
      await expectNoHorizontalOverflow(page);

      await expect(dialog.getByRole("button", { name: /Xem .* sản phẩm|View .* products/i })).toHaveCount(1);
      await expect(filter.locator('[data-price-apply]')).toHaveCount(0);
      await expect(filter.locator('[data-price-input]')).toHaveCount(0);
      await expect(filter.locator('[data-price-range-label="true"]')).toBeVisible();
      await expectEdgeAlignedIndicators(filter);

      const close = dialog.getByRole("button", { name: /Đóng|Close/i });
      await expect(close).toBeVisible();
      const closeBounds = await close.boundingBox();
      expect(closeBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(closeBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    });
  }

  test("desktop back navigation restores the unfiltered URL after one price action", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/");
    const tracks = filter.locator('span[data-orientation="horizontal"]');
    const track = tracks.nth(Math.max(0, (await tracks.count()) - 1));
    const box = await track.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.6, box!.y + box!.height / 2);
    await expect.poll(() => new URL(page.url()).searchParams.has("max_price")).toBe(true);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });
});

test.describe("Catalog brand logos @brand-filter", () => {
  test("desktop renders fixed logo slots, search and multi-select rows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sp/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const sidebar = page.locator("[data-catalog-sidebar]");
    const brandFilter = await openBrandFilter(sidebar);
    await expectBrandLogos(brandFilter);
    await expect(sidebar.getByPlaceholder(/Tìm thương hiệu|Search brands/i)).toHaveCount(1);
    await expect(sidebar.getByRole("button", { name: /Xem thêm|Show more|Thu gọn|Show less/i })).toHaveCount(1);

    const firstRow = brandFilter.locator('[data-brand-filter-row="true"]').first();
    await firstRow.getByRole("checkbox").click();
    await expect.poll(() => new URL(page.url()).searchParams.has("pwb-brand")).toBe(true);
  });

  test("brand filter is hidden on a dedicated brand page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/brands/alpinestars/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-brand-filter="true"]')).toHaveCount(0);
  });

  test("mobile renders the same logo slots in the filter drawer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const dialog = await openMobileFilter(page, "/sp/");
    const brandFilter = await openBrandFilter(dialog);
    await expectBrandLogos(brandFilter);
  });
});

test.describe("Catalog filter screenshots @visual-advisory", () => {
  test("desktop before/after reference for brand and price filters", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sp/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await attachScreenshot(page, testInfo, "catalog-filters-desktop.png");
  });

  test("mobile before/after reference for brand and price filters", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const dialog = await openMobileFilter(page, "/sp/");
    const brandFilter = await openBrandFilter(dialog);
    await attachScreenshot(page, testInfo, "catalog-brand-filter-mobile.png");
    const priceTrigger = dialog.getByRole("button", { name: /GIÁ|PRICE/i });
    await priceTrigger.click();
    await expect(dialog.locator('[data-price-filter="true"]')).toBeVisible();
    await attachScreenshot(page, testInfo, "catalog-price-filter-mobile.png");
    expect(await brandFilter.count()).toBe(1);
  });
});

test.describe("Catalog filter compatibility", () => {
  test("size remains neutral and gender remains a radio list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sp/", { waitUntil: "domcontentloaded" });
    const sidebar = page.locator("[data-catalog-sidebar]");

    const sizeTrigger = sidebar.getByRole("button", { name: /KÍCH CỠ|SIZE/i });
    if (await sizeTrigger.count()) {
      await sizeTrigger.click();
      const sizeFilter = sidebar.locator("[data-size-filter]");
      if (await sizeFilter.count()) {
        const size = sizeFilter.getByRole("button").first();
        await expect(size).not.toHaveClass(/text-blue|border-blue/);
        await expect(size).not.toHaveClass(/scale-\[1\.02\]/);
      }
    }

    const genderTrigger = sidebar.getByRole("button", { name: /GIỚI TÍNH|GENDER/i });
    if (await genderTrigger.count()) {
      await genderTrigger.click();
      const genderFilter = sidebar.locator("[data-gender-filter]");
      if (await genderFilter.count()) {
        const radios = genderFilter.getByRole("radio");
        await expect(radios).toHaveCount(2);
        await radios.nth(0).check();
        await radios.nth(1).check();
        await expect(radios.nth(0)).not.toBeChecked();
        await expect(radios.nth(1)).toBeChecked();
      }
    }
  });

  test("English /sp alias remains a redirect decision, while canonical route stays /products/", async ({ page }) => {
    const response = await page.goto("/en/sp/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(500);
    const pathname = new URL(page.url()).pathname;
    if (pathname === "/en/sp/") {
      test.skip(true, "English /sp alias is not exposed by the current routing table");
      return;
    }
    expect(pathname).toBe("/en/products/");
  });
});
