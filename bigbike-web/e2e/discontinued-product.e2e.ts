import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

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
  testInfo: TestInfo,
) {
  const guards = installPageGuards(page);
  await page.setViewportSize(viewport === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
  const response = await gotoAndSettle(page, routeFor(locale, slug));
  expect(response?.status() ?? 0, `${target.name} ${locale} HTTP status`).toBeLessThan(400);

  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  const statusPanel = page.locator("[data-discontinued-status]");
  await expect(statusPanel).toBeVisible();
  await expect(
    page.getByText(locale === "en" ? "Product discontinued" : "Sản phẩm đã ngừng kinh doanh").first(),
  ).toBeVisible();
  await expect(statusPanel.locator('form[role="search"], input[type="search"]')).toHaveCount(0);
  await expect(page.locator("[data-purchase-actions], [data-purchase-add], .bb-pdp-sticky-cta")).toHaveCount(0);

  const spacing = await page.evaluate(() => {
    type Box = { top: number; bottom: number };
    const box = (selector: string): Box | null => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    const gap = (from: Box | null, to: Box | null): number | null => {
      if (!from || !to) return null;
      return Math.round((to.top - from.bottom) * 100) / 100;
    };
    const label = box("[data-discontinued-label]");
    const title = box("#discontinued-product-title");
    const description = box("[data-discontinued-description]");
    const actions = box("[data-discontinued-actions]");
    const meta = box("[data-discontinued-meta]");
    const category = box("[data-discontinued-category-link]");
    return {
      labelToTitle: gap(label, title),
      titleToDescription: gap(title, description),
      descriptionToActions: gap(description, actions),
      actionsToMeta: gap(actions, meta),
      metaToCategory: gap(meta, category),
    };
  });

  expect(spacing.labelToTitle, "nhãn → tên hàng phải dùng gap-1.5 như nhóm eyebrow của PDP").toBeCloseTo(6, 0);
  expect(spacing.titleToDescription, "tên hàng → mô tả phải dùng mt-6 như PDP").toBeCloseTo(24, 0);
  expect(spacing.descriptionToActions, "mô tả → cụm nút phải dùng mt-8 như PDP").toBeCloseTo(32, 0);
  expect(spacing.actionsToMeta, "cụm nút → thông tin cuối phải giữ mt-5").toBeCloseTo(20, 0);
  if (spacing.metaToCategory !== null) {
    expect(spacing.metaToCategory, "thông tin → link nhóm hàng phải giữ mt-5").toBeCloseTo(20, 0);
  }
  const spacingReport = {
    target: target.envName,
    locale,
    viewport,
    measuredPx: spacing,
    reference: {
      labelToTitle: "PDP eyebrow grouping: gap-1.5 = 6px",
      titleToDescription: "PDP short-description separation: mt-6 = 24px",
      descriptionToActions: "PDP section/action separation: mt-8 = 32px",
      actionsToMeta: "Existing card rhythm: mt-5 = 20px",
    },
  };
  console.log(`[discontinued-spacing] ${JSON.stringify(spacingReport)}`);
  await testInfo.attach(`discontinued-spacing-${target.envName}-${locale}-${viewport}`, {
    body: Buffer.from(JSON.stringify(spacingReport, null, 2), "utf8"),
    contentType: "application/json",
  });

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

  const artifactPhase = process.env.DISCONTINUED_ARTIFACT_PHASE?.trim() || "after";
  const artifactDir = path.join("test-results", "discontinued-product", artifactPhase);
  const artifactName = `${target.envName}-${locale}-${viewport}`;
  await mkdir(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${artifactName}-top.png`),
    fullPage: false,
  });
  await statusPanel.screenshot({
    path: path.join(artifactDir, `${artifactName}-card.png`),
  });
  await page.screenshot({
    path: path.join(artifactDir, `${artifactName}-full.png`),
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
        await assertDiscontinuedPage(page, target, locale, slug!, viewport, testInfo);
      });
    }
  }
}
