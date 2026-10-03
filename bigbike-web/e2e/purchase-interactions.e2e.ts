import { expect, test, type Page } from "@playwright/test";

import { SAMPLE } from "./helpers/routes";

async function openProduct(page: Page) {
  await page.goto(SAMPLE.product, { waitUntil: "domcontentloaded" });
  await page.locator("[data-purchase-section]").waitFor({ state: "visible" });
}

async function scrollPastPurchaseActions(page: Page) {
  const actions = page.locator("[data-purchase-actions]");
  // Server-rendered markup can become visible just before hydration attaches the
  // IntersectionObserver. Establish a visible baseline after `load` so the later
  // scroll always produces the observed in-view -> above-viewport transition.
  await page.waitForLoadState("load");
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.evaluate(() => {
    const purchaseActions = document.querySelector<HTMLElement>("[data-purchase-actions]");
    if (!purchaseActions) throw new Error("Missing inline purchase actions");
    const actionsBottom = window.scrollY + purchaseActions.getBoundingClientRect().bottom;
    window.scrollTo(0, actionsBottom + 80);
  });
  // The storefront intentionally uses smooth scrolling. Wait for the real purchase buttons to
  // cross the viewport boundary before asserting the IntersectionObserver-driven sticky state.
  await expect
    .poll(() => actions.evaluate((element) => element.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(0);
}

test.describe("Purchase section @desktop", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("giữ bố cục hai cột và bật nút mua sau khi chọn biến thể", async ({ page }) => {
    await openProduct(page);
    const section = page.locator("[data-purchase-section]");
    const gallery = section.locator(":scope > div").first();
    const info = section.locator("[data-purchase-info]");
    const galleryBox = await gallery.boundingBox();
    const infoBox = await info.boundingBox();
    expect(Math.round(galleryBox?.y ?? -1)).toBe(Math.round(infoBox?.y ?? -2));
    expect(galleryBox?.width ?? 0).toBeGreaterThan(infoBox?.width ?? 0);

    const groups = section.locator('[data-variant-picker] [role="radiogroup"]');
    const groupCount = await groups.count();
    for (let index = 0; index < groupCount; index += 1) {
      const option = groups.nth(index).locator('[role="radio"]:not([disabled])').first();
      await option.click();
      await expect(option).toHaveAttribute("data-state", "checked");
    }

    const quantity = section.locator('input[type="number"]').first();
    await expect(quantity).toHaveValue("1");
    await quantity.locator("xpath=..").getByRole("button").last().click();
    await expect(quantity).toHaveValue("2");
    await expect(section.locator("[data-purchase-add]")).toBeEnabled();
  });
});

test.describe("Purchase section @mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("xếp một cột và chỉ hiển thị thanh mua sau khi đã cuộn qua nút mua thật", async ({
    page,
  }) => {
    await openProduct(page);
    const section = page.locator("[data-purchase-section]");
    const galleryBox = await section.locator(":scope > div").first().boundingBox();
    const infoBox = await section.locator("[data-purchase-info]").boundingBox();
    expect(infoBox?.y ?? 0).toBeGreaterThan((galleryBox?.y ?? 0) + (galleryBox?.height ?? 0));

    const sticky = page.locator(".bb-pdp-sticky-cta");
    await expect(sticky).toHaveAttribute("aria-hidden", "true");

    const actions = page.locator("[data-purchase-actions]");
    await actions.scrollIntoViewIfNeeded();
    await expect(sticky).toHaveAttribute("aria-hidden", "true");

    await scrollPastPurchaseActions(page);
    const scrollYWhenShown = await page.evaluate(() => window.scrollY);
    await expect(sticky).toHaveAttribute("aria-hidden", "false");
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollYWhenShown),
    ).toBeLessThanOrEqual(1);
    await expect
      .poll(async () => {
        const stickyBox = await sticky.boundingBox();
        return Math.abs(844 - ((stickyBox?.y ?? 0) + (stickyBox?.height ?? 0)));
      })
      .toBeLessThanOrEqual(2);

    await actions.scrollIntoViewIfNeeded();
    await expect(sticky).toHaveAttribute("aria-hidden", "true");
  });

  test("giữ nhãn VI/EN một dòng và tỷ lệ 60/40 từ 320 đến 430px", async ({ page }) => {
    test.setTimeout(150_000);
    const cases = [
      { width: 320, path: SAMPLE.product },
      { width: 360, path: SAMPLE.product },
      { width: 390, path: SAMPLE.product },
      { width: 430, path: SAMPLE.product },
      { width: 320, path: `/en${SAMPLE.product}` },
    ];

    for (const scenario of cases) {
      await page.setViewportSize({ width: scenario.width, height: 844 });
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      await page.locator("[data-purchase-actions]").waitFor({ state: "visible" });
      await scrollPastPurchaseActions(page);

      const sticky = page.locator(".bb-pdp-sticky-cta");
      await expect(sticky, `${scenario.path} @ ${scenario.width}px`).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      const buttons = sticky.locator("[data-sticky-purchase-add], [data-sticky-zalo]");
      await expect(buttons).toHaveCount(2);

      const metrics = await buttons.evaluateAll((elements) =>
        elements.map((element) => {
          const button = element.getBoundingClientRect();
          const label = element.querySelector<HTMLElement>("[data-sticky-purchase-label]");
          if (!label) throw new Error("Missing sticky purchase label");
          const labelBox = label.getBoundingClientRect();
          return {
            button: { left: button.left, right: button.right, height: button.height },
            label: { left: labelBox.left, right: labelBox.right },
            lineCount: label.getClientRects().length,
            flexGrow: getComputedStyle(element).flexGrow,
            whiteSpace: getComputedStyle(element).whiteSpace,
          };
        }),
      );

      for (const metric of metrics) {
        expect(metric.button.height, `${scenario.width}px touch target`).toBeGreaterThanOrEqual(44);
        expect(metric.lineCount, `${scenario.width}px label line count`).toBe(1);
        expect(metric.whiteSpace).toBe("nowrap");
        expect(metric.label.left).toBeGreaterThanOrEqual(metric.button.left - 1);
        expect(metric.label.right).toBeLessThanOrEqual(metric.button.right + 1);
      }

      const combinedButtonWidth =
        metrics[0].button.right -
        metrics[0].button.left +
        (metrics[1].button.right - metrics[1].button.left);
      const addRatio = (metrics[0].button.right - metrics[0].button.left) / combinedButtonWidth;
      expect(metrics.map((metric) => metric.flexGrow)).toEqual(["3", "2"]);
      // Viền 1px của nút Zalo nằm ngoài phần không gian flex được chia, nên tỷ lệ
      // bounding-box dao động chưa tới 1 điểm phần trăm quanh cấu hình 60/40.
      expect(addRatio).toBeCloseTo(0.6, 1);
    }
  });
});
