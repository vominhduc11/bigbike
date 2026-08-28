import { test, expect, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow, gotoAndSettle } from "./helpers/ui-quality";

const PHONE_WIDTHS = [320, 360, 375, 414];
const DESKTOP_WIDTHS = [1280, 1366, 1440, 1920];
const SEARCH_WIDTHS = [1280, 1440, 1920];

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
