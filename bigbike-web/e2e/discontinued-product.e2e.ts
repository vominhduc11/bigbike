import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoSeriousIssues,
  gotoAndSettle,
  installPageGuards,
} from "./helpers/ui-quality";

type Target = {
  name: string;
  envName: string;
  expectsImage?: boolean;
  expectsFullPdp?: boolean;
};

const TARGETS: Target[] = [
  { name: "legacy có ảnh", envName: "E2E_DISCONTINUED_WITH_IMAGE_SLUG", expectsImage: true },
  { name: "legacy không ảnh", envName: "E2E_DISCONTINUED_NO_IMAGE_SLUG", expectsImage: false },
  { name: "legacy danh mục rỗng", envName: "E2E_DISCONTINUED_EMPTY_CATEGORY_SLUG" },
  { name: "sản phẩm discontinued thật", envName: "E2E_DISCONTINUED_PRODUCT_SLUG", expectsFullPdp: true },
];

function targetSlug(target: Target): string | undefined {
  const raw = process.env[target.envName]?.trim().replace(/^\/+|\/+$/g, "");
  return raw || undefined;
}

function routeFor(locale: "vi" | "en", slug: string): string {
  return `/${locale}/sp/${slug.replace(/\.html$/i, "")}.html/`;
}

async function assertDiscontinuedPage(
  page: Page,
  target: Target,
  locale: "vi" | "en",
  slug: string,
  viewport: "desktop" | "mobile",
) {
  const guards = installPageGuards(page);
  await page.setViewportSize(viewport === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
  const response = await gotoAndSettle(page, routeFor(locale, slug));
  expect(response?.status() ?? 0, `${target.name} ${locale} HTTP status`).toBeLessThan(400);

  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(
    page.getByText(locale === "en" ? "Product discontinued" : "Sản phẩm đã ngừng kinh doanh").first(),
  ).toBeVisible();
  await expect(page.locator('form[role="search"] input[type="search"]')).toBeVisible();
  await expect(page.locator("[data-purchase-actions], [data-purchase-add], .bb-pdp-sticky-cta")).toHaveCount(0);

  const gallery = page.locator("[data-product-gallery-main]");
  if (target.expectsImage === true) await expect(gallery).toBeVisible();
  if (target.expectsImage === false) await expect(gallery).toHaveCount(0);

  if (target.expectsFullPdp) {
    await expect(page.locator("#pdp-overview")).toBeVisible();
    await expect(page.locator("#pdp-description, #pdp-specifications, #pdp-faqs, #reviews").first()).toBeVisible();
  }

  const suggestionRail = page.locator("#discontinued-suggestions");
  if (await suggestionRail.count()) {
    const cards = suggestionRail.locator("a").filter({ has: page.locator("img") });
    expect(await cards.count(), "recommendations must be a non-empty 4–8 item rail").toBeGreaterThanOrEqual(4);
    expect(await cards.count(), "recommendations must not exceed 8 items").toBeLessThanOrEqual(8);
  }

  await expectNoHorizontalOverflow(page, `${target.name} ${locale} ${viewport}`);
  expectNoSeriousIssues(guards, `${target.name} ${locale} ${viewport}`);

  await page.screenshot({
    path: path.join("test-results", "discontinued-product", `${target.envName}-${locale}-${viewport}.png`),
    fullPage: true,
  });
}

for (const target of TARGETS) {
  for (const locale of ["vi", "en"] as const) {
    for (const viewport of ["desktop", "mobile"] as const) {
      test(`${target.name} — ${locale} — ${viewport}`, async ({ page }) => {
        const slug = targetSlug(target);
        test.skip(
          !slug,
          `Not run: set ${target.envName} to a real slug from the connected discontinued-product data before running this scenario.`,
        );
        await assertDiscontinuedPage(page, target, locale, slug!, viewport);
      });
    }
  }
}
