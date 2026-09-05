import { expect, test, type Locator, type Page } from "@playwright/test";

async function visitCatalog(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await expect(
    page.locator("[data-catalog-product-grid]"),
    `catalog grid should render on ${path} (${response?.status() ?? "no response"})`,
  ).toBeVisible({ timeout: 30000 });
}

async function expectCatalogCount(page: Page, count: number) {
  await expect(page.locator("[data-catalog-product-grid] [data-product-card]")).toHaveCount(count, {
    timeout: 30000,
  });
  await expect(page.getByText(`${count} Sản phẩm`, { exact: true })).toBeVisible();
}

async function openFacet(container: Locator, name: RegExp) {
  const trigger = container.getByRole("button", { name }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
}

async function findFacetCheckbox(container: Locator, name: RegExp) {
  let checkbox = container.getByRole("checkbox", { name }).first();
  if ((await checkbox.count()) === 0) {
    const showMore = container.getByRole("button", { name: /Xem thêm|Show more/i }).last();
    if (await showMore.count()) await showMore.click();
    checkbox = container.getByRole("checkbox", { name }).first();
  }
  await expect(checkbox).toBeVisible();
  return checkbox;
}

async function expandFacetOptions(container: Locator) {
  const showMore = container.getByRole("button", { name: /Xem thêm|Show more/i }).last();
  while ((await showMore.count()) && (await showMore.isVisible().catch(() => false))) {
    await showMore.click();
  }
}

async function getFacetCheckboxes(container: Locator) {
  await expandFacetOptions(container);
  return container.getByRole("checkbox");
}

async function openMobileFilter(page: Page, path: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const filterButton = page.getByRole("button", { name: /BỘ LỌC|FILTERS/i }).first();
  await expect(filterButton).toBeVisible({ timeout: 30000 });
  await filterButton.click();
  const dialog = page.getByRole("dialog", { name: /BỘ LỌC|FILTERS/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Catalog filter regressions @catalog-filter", () => {
  test("desktop color selection persists on category and multi-color brand views", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visitCatalog(page, "/danh-muc/mu-bao-hiem/");

    const sidebar = page.locator("[data-catalog-sidebar]");
    await openFacet(sidebar, /MÀU SẮC|COLOR/i);
    const black = await findFacetCheckbox(sidebar, /^(?:Đen|Black) \(\d+\)$/i);
    await black.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.getAll("filter_color"))
      .toEqual(["den"]);
    await expectCatalogCount(page, 18);

    await visitCatalog(page, "/brands/ls2/?filter_color=do");
    const brandSidebar = page.locator("[data-catalog-sidebar]");
    await openFacet(brandSidebar, /MÀU SẮC|COLOR/i);
    const brandBlack = await findFacetCheckbox(brandSidebar, /^(?:Đen|Black) \(\d+\)$/i);
    await brandBlack.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.getAll("filter_color"))
      .toEqual(["do", "den"]);
  });

  test("all-products direct filter links use the server-rendered filter context", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const scenario of [
      { path: "/sp/?pwb-brand=agv", count: 2 },
      { path: "/sp/?kich-co=shoe%3A42", count: 12 },
      { path: "/sp/?pwb-brand=ls2&filter_color=do", count: 5 },
    ]) {
      await visitCatalog(page, scenario.path);
      await expectCatalogCount(page, scenario.count);
    }

    expect(new URL(page.url()).searchParams.getAll("filter_color")).toEqual(["do"]);
  });

  test("accepts every displayed size and brand option without the old 16-value failure", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visitCatalog(page, "/sp/");

    const sidebar = page.locator("[data-catalog-sidebar]");
    await openFacet(sidebar, /KÍCH CỠ|SIZE/i);
    const sizeOptions = sidebar.locator('[data-size-filter="true"] button[aria-pressed]');
    await expect(sizeOptions).toHaveCount(55);
    for (let index = 0; index < (await sizeOptions.count()); index += 1) {
      await sizeOptions.nth(index).click();
    }
    await expectCatalogCount(page, 112);
    await expect(page.locator("body")).not.toContainText(
      /Hệ thống đang gặp sự cố|system is having trouble/i,
    );

    await page.goto("/sp/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const brandSidebar = page.locator("[data-catalog-sidebar]");
    await openFacet(brandSidebar, /THƯƠNG HIỆU|BRAND/i);
    const brandCheckboxes = await getFacetCheckboxes(
      brandSidebar.locator('[data-brand-filter="true"]'),
    );
    await expect(brandCheckboxes).toHaveCount(19);
    for (let index = 0; index < (await brandCheckboxes.count()); index += 1) {
      await brandCheckboxes.nth(index).click();
    }
    await expectCatalogCount(page, 185);
    await expect(page.locator("body")).not.toContainText(
      /Hệ thống đang gặp sự cố|system is having trouble/i,
    );
  });

  test("reports a system failure instead of an empty result when catalog APIs fail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visitCatalog(page, "/sp/?pwb-brand=agv");
    await page.route("**/api/v1/products**", (route) => route.abort());
    await page.route("**/api/v1/catalog/facets**", (route) => route.abort());

    const sidebar = page.locator("[data-catalog-sidebar]");
    await openFacet(sidebar, /THƯƠNG HIỆU|BRAND/i);
    const agv = await findFacetCheckbox(
      sidebar.locator('[data-brand-filter="true"]'),
      /^AGV \(\d+\)$/i,
    );
    await agv.click();

    await expect(page.getByText(/Hệ thống đang gặp sự cố|system is having trouble/i)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/Không có sản phẩm nào khớp|No products match/i)).not.toBeVisible();
  });

  test("clear all omits the default page size but keeps an explicit non-default size", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visitCatalog(page, "/sp/?pwb-brand=agv");
    await page.getByRole("button", { name: /Xoá tất cả|Clear all/i }).click();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).searchParams.has("size")).toBe(false);

    await visitCatalog(page, "/sp/?size=12&pwb-brand=agv");
    await page.getByRole("button", { name: /Xoá tất cả|Clear all/i }).click();
    await expect.poll(() => new URL(page.url()).search).toBe("?size=12");
  });

  test("mobile applies LS2 and black together only after the apply button", async ({ page }) => {
    const dialog = await openMobileFilter(page, "/sp/");
    await openFacet(dialog, /THƯƠNG HIỆU|BRAND/i);
    const brandFilter = dialog.locator('[data-brand-filter="true"]');
    const brandSearch = brandFilter.getByPlaceholder(/Tìm thương hiệu|Search brands/i);
    await brandSearch.fill("LS2");
    const ls2 = await findFacetCheckbox(brandFilter, /^LS2 \(\d+\)$/i);
    await ls2.click();

    await expect.poll(() => new URL(page.url()).search).toBe("");
    await openFacet(dialog, /MÀU SẮC|COLOR/i);
    const black = await findFacetCheckbox(dialog, /^(?:Đen|Black) \(\d+\)$/i);
    await black.click();
    await expect.poll(() => new URL(page.url()).search).toBe("");

    const apply = dialog.getByRole("button", { name: /Xem 6 sản phẩm|View 6 products/i });
    await expect(apply).toBeVisible({ timeout: 30000 });
    await apply.click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("pwb-brand")).toBe("ls2");
    await expect.poll(() => new URL(page.url()).searchParams.get("filter_color")).toBe("den");
    await expectCatalogCount(page, 6);
  });

  test("existing category, brand and search filter routes keep their accepted counts", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const scenario of [
      { path: "/danh-muc/mu-bao-hiem/?pwb-brand=ls2", count: 8 },
      { path: "/brands/ls2/?filter_color=do", count: 5 },
      { path: "/tim-kiem/?q=komine&filter_color=do", count: 7 },
    ]) {
      await visitCatalog(page, scenario.path);
      await expectCatalogCount(page, scenario.count);
    }
  });
});
