import { test, expect, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow, gotoAndSettle } from "./helpers/ui-quality";

const PHONE_WIDTHS = [320, 360, 375, 414];
const DESKTOP_WIDTHS = [1280, 1366, 1440, 1600, 1920];
const SEARCH_WIDTHS = [1280, 1440, 1920];
const DESKTOP_CATEGORY_LABELS = [
  "Giá đỡ điện thoại và phụ kiện camera hành trình",
  "Đồ lót giáp, đồ mưa và phụ kiện moto",
  "Tai nghe bluetooth mũ bảo hiểm",
  "Túi treo xe máy và túi hít bình xăng",
];
const LONG_DESKTOP_CATEGORY_LABEL = DESKTOP_CATEGORY_LABELS[0];

function header(page: Page) {
  return page.locator("[data-bb-header]");
}

function desktopMenu(page: Page) {
  return page.locator("[data-header-desktop-menu]");
}

function mobileMenuTrigger(page: Page) {
  return page.locator("[data-header-mobile-trigger]");
}

function searchTrigger(page: Page) {
  return page.locator("button.bb-header-search-trigger");
}

test.describe("Header acceptance — compact phones", () => {
  for (const width of PHONE_WIDTHS) {
    test(`${width}px keeps the logo and controls separate within the 60px header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndSettle(page, "/", { scroll: false });

      const [logo, language, search, menu] = await Promise.all(
        [
          page.locator("[data-header-logo]"),
          page.locator("[data-language-switch]"),
          searchTrigger(page),
          mobileMenuTrigger(page),
        ].map((locator) =>
          locator.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              height: rect.height,
            };
          }),
        ),
      );
      const rects = [
        { label: "logo", ...logo },
        { label: "language", ...language },
        { label: "search", ...search },
        { label: "menu", ...menu },
      ];

      expect(rects[0].right, `logo should not overlap language at ${width}px`).toBeLessThanOrEqual(
        rects[1].left + 1,
      );
      expect(
        rects[1].right,
        `language should not overlap search at ${width}px`,
      ).toBeLessThanOrEqual(rects[2].left + 1);
      expect(rects[2].right, `search should not overlap menu at ${width}px`).toBeLessThanOrEqual(
        rects[3].left + 1,
      );

      for (const control of rects.slice(1)) {
        expect(control.top, `${control.label} top edge @ ${width}px`).toBeCloseTo(0, 0);
        expect(control.bottom, `${control.label} bottom edge @ ${width}px`).toBeCloseTo(60, 0);
        expect(control.height, `${control.label} height @ ${width}px`).toBeCloseTo(60, 0);
      }

      await expectNoHorizontalOverflow(page, `header compact phone @ ${width}px`);
    });
  }
});

test.describe("Header acceptance — desktop navigation", () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`${width}px shows all primary links without the contact drawer trigger`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/", { scroll: false });

      const menu = desktopMenu(page);
      await expect(menu).toBeVisible();
      await expect(menu.locator(":scope > ul > li > a")).toHaveCount(5);
      await expect(mobileMenuTrigger(page)).toBeHidden();
      await expect(page.locator("[data-header-info-trigger]")).toHaveCount(0);
      await expectNoHorizontalOverflow(page, `header desktop navigation @ ${width}px`);
    });
  }
});

test.describe("Header acceptance — desktop spacing and category panels", () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`${width}px keeps the widened navigation inside the header`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/", { scroll: false });

      const menu = desktopMenu(page);
      const links = menu.locator(":scope > ul > li > a");
      await expect(links).toHaveCount(5);
      const expectedPadding = width < 1440 ? 20 : 24;
      const measurements = await links.evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return {
            paddingLeft: Number.parseFloat(style.paddingLeft),
            paddingRight: Number.parseFloat(style.paddingRight),
            left: rect.left,
            right: rect.right,
          };
        }),
      );

      for (const measurement of measurements) {
        expect(measurement.paddingLeft, `left nav padding @ ${width}px`).toBe(expectedPadding);
        expect(measurement.paddingRight, `right nav padding @ ${width}px`).toBe(expectedPadding);
      }

      const actions = page.locator("[data-header-actions]");
      const actionMetrics = await actions.evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          marginLeft: Number.parseFloat(style.marginLeft),
          paddingLeft: Number.parseFloat(style.paddingLeft),
          borderLeftWidth: Number.parseFloat(style.borderLeftWidth),
          right: rect.right,
        };
      });
      expect(actionMetrics.marginLeft, `menu-to-divider gap @ ${width}px`).toBe(24);
      expect(actionMetrics.paddingLeft, `divider-to-actions gap @ ${width}px`).toBe(24);
      expect(
        actionMetrics.borderLeftWidth,
        `divider should be present @ ${width}px`,
      ).toBeGreaterThan(0);
      expect(actionMetrics.right, `header actions right edge @ ${width}px`).toBeLessThanOrEqual(
        width + 1,
      );

      const [logoBox, firstLinkBox] = await Promise.all([
        page.locator("[data-header-logo]").evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { right: rect.right };
        }),
        links.first().evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left };
        }),
      ]);
      expect(firstLinkBox.left, `nav should not overlap logo @ ${width}px`).toBeGreaterThanOrEqual(
        logoBox.right - 1,
      );
      if (width === 1280) {
        expect(
          firstLinkBox.left - logoBox.right,
          "1280px should retain the future-menu reserve",
        ).toBeGreaterThanOrEqual(80);
      }

      await expectNoHorizontalOverflow(page, `widened header @ ${width}px`);
    });
  }

  for (const width of DESKTOP_WIDTHS) {
    test(`${width}px keeps both category panels at 368px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/", { scroll: false });

      const parent = desktopMenu(page)
        .locator(":scope > ul > li[data-header-menu-item-with-children]")
        .first();
      if ((await parent.count()) === 0) {
        test.skip(true, "Current menu data has no desktop category branch");
        return;
      }

      await parent.hover();
      const firstPanel = parent.locator('[data-header-submenu][data-header-submenu-depth="0"]');
      await expect(firstPanel).toBeVisible();

      const nestedParent = firstPanel.locator('li:has(> [data-header-submenu-depth="1"])').first();
      if ((await nestedParent.count()) === 0) {
        test.skip(true, "Current menu data has no second-level category branch");
        return;
      }

      await nestedParent.hover();
      const secondPanel = nestedParent.locator(
        '[data-header-submenu][data-header-submenu-depth="1"]',
      );
      await expect(secondPanel).toBeVisible();

      const panelMetrics = await Promise.all(
        [firstPanel, secondPanel].map((panel) =>
          panel.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, right: rect.right };
          }),
        ),
      );
      for (const [index, metrics] of panelMetrics.entries()) {
        expect(metrics.width, `category panel ${index + 1} width @ ${width}px`).toBe(368);
        expect(
          metrics.right,
          `category panel ${index + 1} right edge @ ${width}px`,
        ).toBeLessThanOrEqual(width + 1);
      }

      const labelStats = await desktopMenu(page)
        .locator("[data-header-menu-label]:visible")
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const lineTops = Array.from(range.getClientRects()).map(
              (rect) => Math.round(rect.top * 10) / 10,
            );
            range.detach();
            return {
              text: (node.textContent ?? "").trim(),
              lines: new Set(lineTops).size,
            };
          }),
        );
      const missingLabels = DESKTOP_CATEGORY_LABELS.filter(
        (label) => !labelStats.some((stat) => stat.text === label),
      );
      if (missingLabels.length > 0) {
        test.skip(true, `Current menu data does not contain: ${missingLabels.join(", ")}`);
        return;
      }

      const multilineLabels = labelStats.filter((stat) => stat.lines > 1).map((stat) => stat.text);
      expect(multilineLabels, `desktop multiline category labels @ ${width}px`).toEqual([
        LONG_DESKTOP_CATEGORY_LABEL,
      ]);

      await expectNoHorizontalOverflow(page, `open category panels @ ${width}px`);
    });
  }
});

test.describe("Header acceptance — mobile category label wrapping", () => {
  for (const width of [360, 390]) {
    test(`${width}px keeps expanded category labels and arrows readable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndSettle(page, "/", { scroll: false });

      const trigger = mobileMenuTrigger(page);
      await trigger.click();
      const drawer = page.locator("[data-header-mobile-menu]");
      await expect(drawer).toBeVisible();

      const branch = drawer.locator("[data-header-submenu-trigger]").first();
      if ((await branch.count()) === 0) {
        test.skip(true, "Current menu data has no mobile category branch");
        return;
      }
      await branch.click();
      await expect(branch).toHaveAttribute("aria-expanded", "true");

      const labels = drawer.locator("[data-header-menu-label]:visible");
      await expect(labels.first()).toBeVisible();
      const labelMetrics = await labels.evaluateAll((nodes) =>
        nodes.map((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const lineRects = Array.from(range.getClientRects()).map((rect) => ({
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          }));
          range.detach();
          const labelRect = node.getBoundingClientRect();
          const link = node.closest("a");
          const linkRect = link?.getBoundingClientRect();
          const arrow = link?.parentElement?.querySelector<HTMLElement>(
            "[data-header-submenu-trigger]",
          );
          const arrowRect = arrow?.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            text: (node.textContent ?? "").trim(),
            whiteSpace: style.whiteSpace,
            label: {
              left: labelRect.left,
              right: labelRect.right,
              top: labelRect.top,
              bottom: labelRect.bottom,
            },
            link: linkRect ? { left: linkRect.left, right: linkRect.right } : null,
            arrow: arrowRect
              ? { left: arrowRect.left, top: arrowRect.top, bottom: arrowRect.bottom }
              : null,
            lineRects,
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
          };
        }),
      );

      for (const metric of labelMetrics) {
        expect(metric.whiteSpace, `${metric.text} should allow wrapping @ ${width}px`).toBe(
          "normal",
        );
        expect(
          metric.scrollWidth,
          `${metric.text} should not be clipped @ ${width}px`,
        ).toBeLessThanOrEqual(metric.clientWidth + 1);
        for (const line of metric.lineRects) {
          expect(line.left, `${metric.text} left edge @ ${width}px`).toBeGreaterThanOrEqual(
            metric.label.left - 1,
          );
          expect(line.right, `${metric.text} right edge @ ${width}px`).toBeLessThanOrEqual(
            metric.label.right + 1,
          );
          expect(line.top, `${metric.text} top edge @ ${width}px`).toBeGreaterThanOrEqual(
            metric.label.top - 1,
          );
          expect(line.bottom, `${metric.text} bottom edge @ ${width}px`).toBeLessThanOrEqual(
            metric.label.bottom + 1,
          );
          if (metric.arrow) {
            expect(
              line.right,
              `${metric.text} should stop before its arrow @ ${width}px`,
            ).toBeLessThanOrEqual(metric.arrow.left - 1);
          }
        }
        if (metric.arrow && metric.lineRects[0]) {
          expect(
            metric.arrow.top,
            `${metric.text} arrow should align with first line @ ${width}px`,
          ).toBeLessThanOrEqual(metric.lineRects[0].top + 4);
          expect(
            metric.arrow.bottom,
            `${metric.text} arrow should reach first line @ ${width}px`,
          ).toBeGreaterThanOrEqual(metric.lineRects[0].top);
        }
      }

      const arrowSizes = await drawer
        .locator("[data-header-submenu-trigger]:visible")
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }),
        );
      for (const size of arrowSizes) {
        expect(size.width, `mobile arrow width @ ${width}px`).toBeGreaterThanOrEqual(44);
        expect(size.height, `mobile arrow height @ ${width}px`).toBeGreaterThanOrEqual(44);
      }

      await expectNoHorizontalOverflow(page, `expanded mobile category menu @ ${width}px`);
    });
  }
});

test.describe("Header acceptance — menu semantics", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const topLevelPages = ["/", "/sp/", "/tin-tuc/", "/gioi-thieu/", "/lien-he/"];

  for (const path of topLevelPages) {
    test(`${path} has one red current primary link`, async ({ page }) => {
      await gotoAndSettle(page, path, { scroll: false });
      const menu = desktopMenu(page);
      const current = menu.locator(":scope > ul > li > a[aria-current='page']");

      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute("href", path);

      const colors = await current.evaluate((link) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--bb-brand-primary)";
        document.body.append(probe);
        const brand = getComputedStyle(probe).color;
        probe.remove();
        return { current: getComputedStyle(link).color, brand };
      });
      expect(colors.current).toBe(colors.brand);
    });
  }

  test("a category descendant keeps its parent red but marks only the exact page current", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/sp/", { scroll: false });
    const parent = desktopMenu(page).locator(':scope > ul > li > a[href="/sp/"]');
    await parent.hover();
    const child = desktopMenu(page).locator("[data-header-submenu] a").first();
    await expect(child).toBeVisible();
    const childHref = await child.getAttribute("href");
    expect(childHref).toBeTruthy();

    await gotoAndSettle(page, childHref!, { scroll: false });
    await expect(parent).not.toHaveAttribute("aria-current", "page");
    await expect(desktopMenu(page).locator("a[aria-current='page']")).toHaveCount(1);

    const colors = await parent.evaluate((link) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--bb-brand-primary)";
      document.body.append(probe);
      const brand = getComputedStyle(probe).color;
      probe.remove();
      return { parent: getComputedStyle(link).color, brand };
    });
    expect(colors.parent).toBe(colors.brand);
  });

  test("configured new-window links expose an invisible announcement", async ({ page }) => {
    await gotoAndSettle(page, "/", { scroll: false });
    const newWindowLink = page.locator("[data-header-desktop-menu] a[target='_blank']").first();
    if ((await newWindowLink.count()) === 0) {
      test.skip(true, "Current menu data has no new-window item");
      return;
    }
    await expect(newWindowLink.locator(".sr-only")).toHaveText(/Mở trong cửa sổ mới/);
  });
});

test.describe("Header acceptance — search, scroll and keyboard", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("skip link is the first Tab stop and moves focus to main", async ({ page }) => {
    await gotoAndSettle(page, "/", { scroll: false });
    await page.keyboard.press("Tab");
    const skipLink = page.locator("[data-header-skip-link]");
    await expect(skipLink).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
  });

  test("the header gains its token shadow only after scrolling", async ({ page }) => {
    await gotoAndSettle(page, "/", { scroll: false });
    await expect(header(page)).toHaveAttribute("data-scrolled", "false");
    const before = await header(page).evaluate((element) => getComputedStyle(element).boxShadow);
    expect(before).toBe("none");

    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header(page)).toHaveAttribute("data-scrolled", "true");
    await expect
      .poll(() => header(page).evaluate((element) => getComputedStyle(element).boxShadow))
      .not.toBe("none");

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header(page)).toHaveAttribute("data-scrolled", "false");
  });
});

test.describe("Header acceptance — search dropdown alignment", () => {
  for (const width of SEARCH_WIDTHS) {
    test(`${width}px aligns suggestion edges with the search input`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/", { scroll: false });
      await searchTrigger(page).click();
      const input = page.getByRole("combobox");
      await input.fill("a");
      const suggestions = page.locator("#bb-search-suggestions");
      await expect(suggestions).toBeVisible();

      const edges = await Promise.all([
        input.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        }),
        suggestions.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        }),
      ]);
      expect(edges[1].left, `suggestion left edge @ ${width}px`).toBeCloseTo(edges[0].left, 0);
      expect(edges[1].right, `suggestion right edge @ ${width}px`).toBeCloseTo(edges[0].right, 0);
    });
  }
});

test.describe("Header acceptance — image priority", () => {
  for (const width of [320, 1280]) {
    test(`${width}px prioritizes only the visible logo candidate`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, "/", { scroll: false });
      const visibleLogo = page.locator("[data-header-logo] img:visible");
      const source = await visibleLogo.getAttribute("src");
      await expect(visibleLogo).toHaveAttribute("fetchpriority", "high");

      const logoRequests = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => url.includes("header-logo.png") || url.includes("header-mark.png")),
      );
      const visibleAsset = width < 1261 ? "header-mark.png" : "header-logo.png";
      const hiddenAsset = width < 1261 ? "header-logo.png" : "header-mark.png";
      expect(source).toContain(visibleAsset);
      expect(logoRequests.some((url) => url.includes(visibleAsset))).toBe(true);
      expect(logoRequests.some((url) => url.includes(hiddenAsset))).toBe(false);
    });
  }
});
