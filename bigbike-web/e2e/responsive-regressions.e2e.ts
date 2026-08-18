import { expect, test, type Locator, type Page } from "@playwright/test";

import { SAMPLE } from "./helpers/routes";
import { disableAnimations, gotoAndSettle } from "./helpers/ui-quality";

async function expectResponsiveImage(
  page: Page,
  selector: string,
  label: string,
  verifyBitmapFits = false,
): Promise<void> {
  const image = page.locator(selector).first();
  await expect(image, `${label}: ảnh phải hiển thị`).toBeVisible();
  await expect(image, `${label}: phải khai báo sizes`).toHaveAttribute("sizes", /\S/);
  await expect(image, `${label}: srcset phải dùng width descriptors`).toHaveAttribute("srcset", /\s\d+w(?:,|$)/);

  const measurement = await image.evaluate(async (node) => {
    const img = node as HTMLImageElement;
    await img.decode().catch(() => undefined);
    const rect = img.getBoundingClientRect();
    const url = new URL(img.currentSrc, window.location.href);
    const candidateWidth = Number(url.searchParams.get("w"));
    let bitmapWidth = 0;
    try {
      const response = await fetch(img.currentSrc, { cache: "force-cache" });
      const bitmap = await createImageBitmap(await response.blob());
      bitmapWidth = bitmap.width;
      bitmap.close();
    } catch {
      bitmapWidth = img.naturalWidth;
    }
    return {
      candidateWidth,
      bitmapWidth,
      renderedWidth: rect.width,
      dpr: window.devicePixelRatio,
    };
  });

  expect(
    measurement.candidateWidth,
    `${label}: cỡ ảnh được chọn phải đủ cho khung × DPR`,
  ).toBeGreaterThanOrEqual(Math.ceil(measurement.renderedWidth * measurement.dpr));
  expect(measurement.bitmapWidth, `${label}: nguồn ảnh phải tải thành công`).toBeGreaterThan(0);
  if (verifyBitmapFits) {
    expect(
      measurement.bitmapWidth,
      `${label}: dữ liệu ảnh nhận về không được nhỏ hơn khung hiển thị`,
    ).toBeGreaterThanOrEqual(Math.floor(measurement.renderedWidth));
  }
}

async function renderedTextLines(locator: Locator) {
  return locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const container = element.closest("p") ?? element.parentElement ?? element;
    const containerRect = container.getBoundingClientRect();
    const lines = Array.from(range.getClientRects()).map((rect) => ({
      left: rect.left,
      right: rect.right,
    }));
    return {
      text: element.textContent ?? "",
      viewportWidth: window.innerWidth,
      containerLeft: containerRect.left,
      containerRight: containerRect.right,
      lines,
    };
  });
}

function expectLinesInside(
  measurement: Awaited<ReturnType<typeof renderedTextLines>>,
  label: string,
): void {
  expect(measurement.lines.length, `${label}: phải có dòng chữ được render`).toBeGreaterThan(0);
  for (const line of measurement.lines) {
    expect(line.left, `${label}: chữ vượt mép trái màn hình`).toBeGreaterThanOrEqual(-2);
    expect(line.right, `${label}: chữ vượt mép phải màn hình`).toBeLessThanOrEqual(measurement.viewportWidth + 2);
    expect(line.left, `${label}: chữ vượt mép trái khung chứa`).toBeGreaterThanOrEqual(measurement.containerLeft - 2);
    expect(line.right, `${label}: chữ vượt mép phải khung chứa`).toBeLessThanOrEqual(measurement.containerRight + 2);
  }
}

test("Ảnh PDP chọn đúng nguồn trên màn hình DPR 2", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await gotoAndSettle(page, SAMPLE.product);

  for (const width of [390, 768, 1280, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await expectResponsiveImage(page, "[data-product-gallery-main] img", `PDP @ ${width}px`, true);
  }

  await context.close();
});

test("Lưới sản phẩm, bài viết và danh mục đều khai báo kích thước ảnh", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  await gotoAndSettle(page, "/sp/");
  await expectResponsiveImage(page, "[data-product-card] img[sizes]", "Lưới sản phẩm");

  await gotoAndSettle(page, "/tin-tuc/");
  await expectResponsiveImage(page, "[data-article-card] img[sizes]", "Lưới bài viết");

  await gotoAndSettle(page, "/");
  await expectResponsiveImage(page, "[data-home-category-grid] img[sizes]", "Lưới danh mục");
  await expectResponsiveImage(page, "[data-home-news-grid] img[sizes]", "Tin tức trang chủ");
});

test("Bảng lọc điện thoại tự áp dụng và đóng khi chuyển sang desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, "/sp/");
  await disableAnimations(page);
  await page.evaluate(() => window.scrollTo(0, 350));

  await page.locator("[data-mobile-filter-trigger]").click();
  const sheet = page.locator("[data-catalog-mobile-filter-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /thương hiệu|brand/i }).click();
  const option = sheet.getByRole("checkbox").first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(option).toBeChecked();
  expect(new URL(page.url()).searchParams.getAll("pwb-brand")).toHaveLength(0);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(sheet).toBeHidden();
  await expect(page.locator("[data-catalog-sidebar]")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.getAll("pwb-brand").length).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.body.hasAttribute("data-scroll-locked"))).toBe(false);

  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll);
  await page.locator("[data-catalog-product-grid] a").first().click({ trial: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(sheet).toBeHidden();
  await expect(page.locator("[data-catalog-sidebar]")).toBeVisible();
});

test("Facebook trang Giới thiệu luôn nằm trong cột", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoAndSettle(page, "/gioi-thieu/");
  const facebook = page.locator("[data-about-facebook]");
  await expect(facebook).toBeVisible();

  for (const width of [320, 768, 776, 820, 830, 980, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const measurement = await renderedTextLines(facebook);
    expectLinesInside(measurement, `Facebook @ ${width}px`);
  }
});

test("Ba dòng liên hệ chân trang không bị cắt ở 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoAndSettle(page, "/");
  const email = page.locator("[data-footer-email]");
  await expect(email).toHaveText("bigbikevnshop@gmail.com");
  expectLinesInside(await renderedTextLines(email), "Email chân trang");

  const rows = await page.locator("[data-footer-contacts] > p").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewportWidth: window.innerWidth };
    }),
  );
  for (const row of rows) {
    expect(row.left).toBeGreaterThanOrEqual(-2);
    expect(row.right).toBeLessThanOrEqual(row.viewportWidth + 2);
  }
});

test("Ô ghi nhớ và nút VI/EN có vùng chạm tối thiểu 44px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });

  for (const path of ["/dang-nhap/", "/dang-ky/"]) {
    await gotoAndSettle(page, path);
    const languageButtons = page.locator("[data-language-switch] button");
    await expect(languageButtons).toHaveCount(2);
    const boxes = await languageButtons.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    for (const box of boxes) {
      expect(box.width, `${path}: nút ngôn ngữ quá hẹp`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${path}: nút ngôn ngữ quá thấp`).toBeGreaterThanOrEqual(44);
    }
  }

  await gotoAndSettle(page, "/dang-nhap/");
  const checkbox = page.locator("#remember-me");
  const box = await checkbox.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const initiallyChecked = await checkbox.isChecked();
  await page.locator('label[for="remember-me"]').click();
  await expect(checkbox).toBeChecked({ checked: !initiallyChecked });
});

test("Phân trang tin tức và sản phẩm nằm gọn ở 320/360px", async ({ page }) => {
  for (const path of ["/tin-tuc/", "/sp/"]) {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, path);
      const nav = page.locator("[data-archive-pagination]");
      await expect(nav, `${path} @ ${width}px: phải có phân trang`).toBeVisible();
      const next = nav.getByRole("link", { name: /trang sau|next page/i });
      await expect(next).toBeVisible();

      const measurements = await nav.locator("ul:visible > li").evaluateAll((nodes) => {
        const navRect = nodes[0]?.closest("nav")?.getBoundingClientRect();
        return nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            navLeft: navRect?.left ?? 0,
            navRight: navRect?.right ?? window.innerWidth,
            viewportWidth: window.innerWidth,
          };
        });
      });
      for (const item of measurements) {
        expect(item.left).toBeGreaterThanOrEqual(item.navLeft - 2);
        expect(item.right).toBeLessThanOrEqual(item.navRight + 2);
        expect(item.left).toBeGreaterThanOrEqual(-2);
        expect(item.right).toBeLessThanOrEqual(item.viewportWidth + 2);
      }

      const nextBox = await next.boundingBox();
      expect(nextBox?.width).toBeGreaterThanOrEqual(44);
      expect(nextBox?.height).toBeGreaterThanOrEqual(44);
      await Promise.all([
        page.waitForURL(/(?:\?|&)paged=2(?:&|$)/),
        next.click(),
      ]);
    }
  }
});
