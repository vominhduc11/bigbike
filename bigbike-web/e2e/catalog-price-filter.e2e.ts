import { expect, test, type Locator, type Page } from "@playwright/test";

const CATALOG_ROUTES = ["/vi/sp/", "/en/products/"] as const;

async function openPriceFilter(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const filter = page.locator('[data-price-filter="true"]').first();
  await expect(filter, `price filter should render on ${path} (${response?.status() ?? "no response"})`).toBeVisible({ timeout: 30000 });
  return filter;
}

async function openMobilePriceFilter(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const filterButton = page.getByRole("button", { name: /BỘ LỌC/i }).first();
  await expect(filterButton).toBeVisible({ timeout: 30000 });
  await filterButton.click();
  const dialog = page.getByRole("dialog", { name: /BỘ LỌC/i });
  await expect(dialog).toBeVisible();
  const filter = dialog.locator('[data-price-filter="true"]');
  if (!(await filter.isVisible().catch(() => false))) {
    await dialog.getByRole("button", { name: /GIÁ/i }).click();
  }
  await expect(filter).toBeVisible();
  return { dialog, filter };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    return { clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth };
  });
  expect(overflow.scrollWidth, "catalog should not have horizontal overflow").toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function expectEdgeAlignedIndicators(filter: Locator) {
  const track = filter.locator('span[data-orientation="horizontal"]').nth(1);
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

test.describe("Catalog price filter render/accessibility @price-filter", () => {
  for (const path of CATALOG_ROUTES) {
    test(`${path} keeps blank inputs, full-number semantics and a usable round scale`, async ({ page }) => {
      const filter = await openPriceFilter(page, path);
      await expectNoHorizontalOverflow(page);

      expect(await filter.getAttribute("data-price-filter-active")).toBe("false");
      await expect(filter.locator('[data-price-range-hint="true"]')).toBeVisible();
      await expect(filter.locator('[data-price-input="min"]')).toHaveValue("");
      await expect(filter.locator('[data-price-input="max"]')).toHaveValue("");
      await expect(filter.locator('[data-price-input="min"]')).toHaveAttribute("placeholder", /\d/);
      await expect(filter.locator('[data-price-input="max"]')).toHaveAttribute("placeholder", /\d/);

      const histogram = filter.locator('[data-price-histogram="true"]');
      await expect(histogram).toBeVisible();
      expect((await histogram.boundingBox())?.height ?? 0).toBeGreaterThan(0);
      expect(await histogram.locator("span").count()).toBeGreaterThan(0);

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
        expect(thumb.text).toMatch(/\d[\d.,]* (?:đồng|VND)(?: (?:trở lên|and above))?$/);
      }
      await expectEdgeAlignedIndicators(filter);
    });
  }

  for (const width of [390, 320]) {
    test(`mobile ${width}px keeps the drawer close target usable`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      const { dialog, filter } = await openMobilePriceFilter(page, "/vi/sp/");
      await expectNoHorizontalOverflow(page);

      const close = dialog.getByRole("button", { name: "Đóng" });
      await expect(close).toBeVisible();
      const closeBounds = await close.boundingBox();
      expect(closeBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(closeBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(filter.locator('[data-price-input="min"]')).toBeVisible();
      await close.click();
      await expect(dialog).toBeHidden();
    });
  }

  test("typed round prices apply exactly once after the range is complete", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/vi/sp/");
    const minInput = filter.locator('[data-price-input="min"]');
    const maxInput = filter.locator('[data-price-input="max"]');

    await minInput.fill("");
    await minInput.pressSequentially("1000000");
    await minInput.blur();
    expect(new URL(page.url()).searchParams.get("min_price"), "leaving From must not apply half a range").toBeNull();

    await maxInput.fill("");
    await maxInput.pressSequentially("2000000");
    expect(new URL(page.url()).searchParams.get("max_price")).toBeNull();
    await filter.getByRole("button", { name: "Áp dụng" }).click();

    await expect.poll(() => new URL(page.url()).searchParams.get("min_price")).toBe("1000000");
    await expect.poll(() => new URL(page.url()).searchParams.get("max_price")).toBe("2000000");
    await expect(minInput).toHaveValue("1.000.000");
    await expect(maxInput).toHaveValue("2.000.000");
  });

  test("one completed price action creates one browser history step", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const filter = await openPriceFilter(page, "/vi/sp/");
    const minInput = filter.locator('[data-price-input="min"]');
    const maxInput = filter.locator('[data-price-input="max"]');

    await minInput.fill("1000000");
    await minInput.blur();
    await maxInput.fill("2000000");
    await filter.getByRole("button", { name: "Áp dụng" }).click();
    await expect(page).toHaveURL(/min_price=1000000/);
    await expect(page).toHaveURL(/max_price=2000000/);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("mobile keeps the price edit in the draft until the single sheet action", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { dialog, filter } = await openMobilePriceFilter(page, "/vi/sp/");
    const minInput = filter.locator('[data-price-input="min"]');
    const maxInput = filter.locator('[data-price-input="max"]');

    await minInput.fill("1000000");
    await minInput.blur();
    await maxInput.fill("2000000");
    expect(new URL(page.url()).search).toBe("");
    await filter.getByRole("button", { name: "Áp dụng" }).click();
    expect(new URL(page.url()).search).toBe("");

    await dialog.getByRole("button", { name: /Xem .* sản phẩm/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("min_price")).toBe("1000000");
    await expect.poll(() => new URL(page.url()).searchParams.get("max_price")).toBe("2000000");
  });

  test("size stays neutral/red and gender behaves as a radio list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/vi/sp/", { waitUntil: "domcontentloaded" });
    const sidebar = page.locator("[data-catalog-sidebar]");
    await expect(sidebar).toBeVisible();

    const sizeTrigger = sidebar.getByRole("button", { name: /KÍCH CỠ/i });
    if (await sizeTrigger.count()) {
      await sizeTrigger.click();
      const sizeFilter = sidebar.locator("[data-size-filter]");
      if (await sizeFilter.count()) {
        const size = sizeFilter.getByRole("button").first();
        await expect(size).not.toHaveClass(/text-blue|border-blue/);
        await expect(size).not.toHaveClass(/scale-\[1\.02\]/);
        const before = await size.boundingBox();
        await size.hover();
        const after = await size.boundingBox();
        expect(after?.width).toBe(before?.width);
        expect(after?.height).toBe(before?.height);
      }
    }

    const genderTrigger = sidebar.getByRole("button", { name: /GIỚI TÍNH/i });
    if (await genderTrigger.count()) {
      await genderTrigger.click();
      const genderFilter = sidebar.locator("[data-gender-filter]");
      if (await genderFilter.count()) {
        const radios = genderFilter.getByRole("radio");
        await expect(radios).toHaveCount(2);
        await radios.nth(0).check();
        await expect(radios.nth(0)).toBeChecked();
        await radios.nth(1).check();
        await expect(radios.nth(1)).toBeChecked();
        await expect(radios.nth(0)).not.toBeChecked();
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
