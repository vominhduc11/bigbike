import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const CATALOG_ROUTES = ["/sp/", "/en/products/"] as const;
const CATEGORY_PRICE_ROUTES = [
  { name: "mũ bảo hiểm", path: "/danh-muc/mu-bao-hiem/" },
  { name: "mũ bảo hiểm fullface", path: "/danh-muc/mu-bao-hiem-fullface/" },
  { name: "áo quần adventure", path: "/danh-muc/ao-quan-adventure/" },
] as const;
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
  const track = filter.locator('[data-slider-track="true"]');
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

async function expectIndicatorsToMatchRange(filter: Locator) {
  const range = filter.locator('[data-slider-range="true"]');
  const rangeBounds = await range.boundingBox();
  const indicatorBounds = await filter.locator("[data-slider-thumb-indicator='true']").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { center: rect.left + rect.width / 2 };
  }));

  expect(rangeBounds).not.toBeNull();
  expect(indicatorBounds).toHaveLength(2);
  expect(indicatorBounds[0]!.center).toBeCloseTo(rangeBounds!.x, 0);
  expect(indicatorBounds[1]!.center).toBeCloseTo(rangeBounds!.x + rangeBounds!.width, 0);
}

async function dragThumbToRatio(page: Page, filter: Locator, index: number, ratio: number) {
  const thumb = filter.getByRole("slider").nth(index);
  const thumbBounds = await thumb.boundingBox();
  const trackBounds = await filter.locator('[data-slider-track="true"]').boundingBox();
  expect(thumbBounds).not.toBeNull();
  expect(trackBounds).not.toBeNull();

  await page.mouse.move(
    thumbBounds!.x + thumbBounds!.width / 2,
    thumbBounds!.y + thumbBounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    trackBounds!.x + trackBounds!.width * ratio,
    trackBounds!.y + trackBounds!.height / 2,
  );
  await page.mouse.up();
}

async function expectBrandLogos(brandFilter: Locator) {
  const rows = brandFilter.locator('[data-brand-filter-row="true"]');
  await expect(rows).not.toHaveCount(0);
  const logoBoxes = await brandFilter.locator('[data-brand-logo="true"]').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: rect.width,
      height: rect.height,
      borderWidth: style.borderWidth,
      backgroundColor: style.backgroundColor,
    };
  }));
  expect(logoBoxes.length).toBe(await rows.count());
  for (const box of logoBoxes) {
    expect(Math.round(box.width)).toBe(96);
    expect(Math.round(box.height)).toBe(48);
    expect(box.borderWidth).toBe("0px");
    expect(box.backgroundColor).toMatch(/^(?:transparent|rgba\(0, 0, 0, 0\))$/);
  }

  const imageFits = await brandFilter.locator('[data-brand-logo="true"] img').evaluateAll((elements) => (
    elements as HTMLImageElement[]
  ).map((element) => getComputedStyle(element).objectFit));
  for (const objectFit of imageFits) expect(objectFit).toBe("contain");

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
        return {
          width: bounds.width,
          height: bounds.height,
          min: element.getAttribute("aria-valuemin"),
          max: element.getAttribute("aria-valuemax"),
          now: element.getAttribute("aria-valuenow"),
          text: element.getAttribute("aria-valuetext"),
        };
      }));
      for (const thumb of thumbData) {
        expect(thumb.width).toBeGreaterThanOrEqual(44);
        expect(thumb.height).toBeGreaterThanOrEqual(44);
        expect(Number(thumb.max)).toBeGreaterThan(Number(thumb.min));
        expect(Number(thumb.now)).toBeGreaterThanOrEqual(Number(thumb.min));
        expect(Number(thumb.now)).toBeLessThanOrEqual(Number(thumb.max));
        expect(thumb.text).toMatch(/\d[\d.,]*(?:₫| VND)$/);
      }
      const indicatorData = await filter.locator("[data-slider-thumb-indicator='true']").evaluateAll((elements) => elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }));
      expect(indicatorData).toHaveLength(2);
      for (const indicator of indicatorData) {
        expect(indicator.width).toBeGreaterThan(12);
        expect(indicator.width).toBeLessThan(44);
        expect(indicator.height).toBeLessThan(44);
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
    const track = filter.locator('[data-slider-track="true"]');
    const box = await track.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    const text = await filter.locator('[data-price-range-label="true"]').textContent();
    expect(text).toMatch(/(?:1[.,]5|2[.,]0|2[.,]5)\s?million|(?:1[.,]5|2[.,]0|2[.,]5)[.,]0{3}[.,]0{3}/i);
  });

  test("dragging the lower handle repeatedly keeps the committed upper bound", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/?max_price=4500000");
    const maxThumb = filter.getByRole("slider").nth(1);
    await expect.poll(async () => Number(await maxThumb.getAttribute("aria-valuenow"))).toBe(4_500_000);

    for (const ratio of [0.05, 0.1, 0.15, 0.2, 0.25]) {
      await dragThumbToRatio(page, filter, 0, ratio);
      await expect.poll(async () => Number(await filter.getByRole("slider").nth(1).getAttribute("aria-valuenow"))).toBe(4_500_000);
      await expect.poll(() => new URL(page.url()).searchParams.get("max_price")).toBe("4500000");
    }
  });

  test("dragging the upper handle repeatedly keeps the committed lower bound", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/?min_price=2000000");
    const minThumb = filter.getByRole("slider").nth(0);
    const stableMin = Number(await minThumb.getAttribute("aria-valuenow"));

    for (const ratio of [0.55, 0.62, 0.69, 0.76, 0.83]) {
      await dragThumbToRatio(page, filter, 1, ratio);
      await expect.poll(async () => Number(await filter.getByRole("slider").nth(0).getAttribute("aria-valuenow"))).toBe(stableMin);
      await expect.poll(() => new URL(page.url()).searchParams.get("min_price")).toBe(String(stableMin));
    }
  });

  test("track-aligned indicators follow both ends of a selected range", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/?min_price=2000000&max_price=5000000");
    await expectIndicatorsToMatchRange(filter);
  });

  test("keeps the price slider usable across three real catalog categories", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const route of CATEGORY_PRICE_ROUTES) {
      const filter = await openPriceFilter(page, route.path);
      const thumbs = filter.getByRole("slider");
      const minimum = Number(await thumbs.nth(0).getAttribute("aria-valuenow"));
      const maximum = Number(await thumbs.nth(1).getAttribute("aria-valuenow"));
      expect(maximum, `${route.name} should expose a usable price range`).toBeGreaterThan(minimum);
      await expectEdgeAlignedIndicators(filter);
    }
  });

  test("a copied filtered URL restores the exact selected bounds", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/sp/");
    await dragThumbToRatio(page, filter, 0, 0.35);
    await dragThumbToRatio(page, filter, 1, 0.75);
    await expect.poll(() => new URL(page.url()).search).not.toBe("");

    const copiedUrl = new URL(page.url());
    const expectedMin = Number(copiedUrl.searchParams.get("min_price"));
    const expectedMax = Number(copiedUrl.searchParams.get("max_price"));
    expect(expectedMin).toBeGreaterThan(0);
    expect(expectedMax).toBeGreaterThan(expectedMin);

    const reopened = await openPriceFilter(page, `${copiedUrl.pathname}${copiedUrl.search}`);
    await expect.poll(async () => Number(await reopened.getByRole("slider").nth(0).getAttribute("aria-valuenow"))).toBe(expectedMin);
    await expect.poll(async () => Number(await reopened.getByRole("slider").nth(1).getAttribute("aria-valuenow"))).toBe(expectedMax);
  });

  test("a mobile draft preserves the untouched bound before applying", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { dialog, filter } = await openMobilePriceFilter(page, "/sp/?max_price=4500000");
    const maxThumb = filter.getByRole("slider").nth(1);
    await expect.poll(async () => Number(await maxThumb.getAttribute("aria-valuenow"))).toBe(4_500_000);

    for (const ratio of [0.05, 0.1, 0.15, 0.2, 0.25]) {
      await dragThumbToRatio(page, filter, 0, ratio);
      await expect.poll(async () => Number(await filter.getByRole("slider").nth(1).getAttribute("aria-valuenow"))).toBe(4_500_000);
      expect(new URL(page.url()).searchParams.get("max_price")).toBe("4500000");
    }

    await dialog.getByRole("button", { name: /Xem .* sản phẩm|View .* products/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("max_price")).toBe("4500000");
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
    const track = filter.locator('[data-slider-track="true"]');
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

    const rows = brandFilter.locator('[data-brand-filter-row="true"]');
    await rows.nth(0).getByRole("checkbox").click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll("pwb-brand").length).toBe(1);
    await rows.nth(1).getByRole("checkbox").click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll("pwb-brand").length).toBe(2);
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
