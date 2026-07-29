import { test, expect, type Page } from "@playwright/test";
import { installPageGuards, summarizeGuards, gotoAndSettle } from "./helpers/ui-quality";

/* ----------------------------- lock helpers ------------------------------ */

type LockState = { panel: string | null; scrollLockedAttr: boolean };

async function readLock(page: Page): Promise<LockState> {
  return page.evaluate(() => ({
    panel: document.documentElement.getAttribute("data-bb-header-panel"),
    scrollLockedAttr:
      document.body.hasAttribute("data-scroll-locked") ||
      document.documentElement.hasAttribute("data-scroll-locked"),
  }));
}

/** The header scroll-lock pins body+html to overflow-y:hidden while a panel is open. */
async function isScrollLocked(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const b = getComputedStyle(document.body).overflowY;
    const h = getComputedStyle(document.documentElement).overflowY;
    return b === "hidden" || h === "hidden";
  });
}

async function expectClosedAndUnlocked(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(400); // allow close animation + lock release
  const s = await readLock(page);
  expect(s.panel == null || s.panel === "" || s.panel === "none", `${label}: header panel still active ("${s.panel}")`).toBeTruthy();
  expect(s.scrollLockedAttr, `${label}: data-scroll-locked still set`).toBeFalsy();
  expect(await isScrollLocked(page), `${label}: scroll lock (overflow-y:hidden) still applied after close`).toBeFalsy();
}

function headerSearchTrigger(page: Page) {
  return page.locator("button.bb-header-search-trigger").first();
}

function searchDialog(page: Page) {
  return page.getByRole("dialog").filter({ has: page.getByRole("combobox") }).first();
}

function searchInput(page: Page) {
  return searchDialog(page).getByRole("combobox").first();
}

function mobileMenuTrigger(page: Page) {
  return page.locator("[data-header-mobile-trigger]").first();
}

function floatingChatTrigger(page: Page) {
  return page.locator("#sudovn-btn-wrapper button, button.b24-widget-button-inner-block").first();
}

function firstVideoTrigger(page: Page) {
  return page.locator('button[aria-label^="Xem video"], button[aria-label^="Watch video"]').first();
}

async function readMainFrame(page: Page) {
  return page.locator(".bb-main").first().evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      left: Math.round(rect.left * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
    };
  });
}

async function expectMainFrameStable(page: Page, expected: Awaited<ReturnType<typeof readMainFrame>>, label: string) {
  const current = await readMainFrame(page);
  expect(current.left, `${label}: page content should not shift horizontally`).toBe(expected.left);
  expect(current.width, `${label}: page content width should stay stable`).toBe(expected.width);
}

async function clickMobileMenuTrigger(page: Page) {
  await mobileMenuTrigger(page).click();
}

function featuredProductCard(page: Page) {
  return page
    .locator(".swiper-slide [data-product-card]")
    .filter({ has: page.locator("[data-product-card-action]") })
    .first();
}

/* ------------------------------- desktop --------------------------------- */

test.describe("Effects — desktop @1440", () => {
  test("search panel opens, focuses input, locks scroll, closes on Escape + releases lock", async ({ page }) => {
    const guards = installPageGuards(page);
    await gotoAndSettle(page, "/");

    const trigger = headerSearchTrigger(page);
    await expect(trigger).toBeVisible();
    await trigger.click();

    await expect.poll(async () => (await readLock(page)).panel, { timeout: 5000 }).toBe("search");
    await expect(searchDialog(page)).toBeVisible();
    await expect(searchInput(page)).toBeFocused();
    expect(await isScrollLocked(page), "scroll should be locked while search open").toBeTruthy();

    await page.keyboard.press("Escape");
    await expectClosedAndUnlocked(page, "search (Escape)");
    expect(summarizeGuards(guards).serious, "search effect serious issues").toEqual([]);
  });

  test("search panel closes via close button", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await headerSearchTrigger(page).click();
    await expect.poll(async () => (await readLock(page)).panel, { timeout: 5000 }).toBe("search");
    await searchDialog(page).getByRole("button").first().click();
    await expectClosedAndUnlocked(page, "search (close button)");
  });

  test("nav dropdown opens on hover", async ({ page }) => {
    await gotoAndSettle(page, "/");
    // Mục cấp 1 có submenu ("Tất cả sản phẩm") — dropdown hiện khi hover (CSS-only,
    // khớp bigbike.vn live). Skip nếu menu hiện tại không có mục con nào.
    const parent = page
      .locator("[data-header-desktop-menu] > ul > [data-header-menu-item-with-children]")
      .first();
    if ((await parent.count()) === 0) {
      test.skip(true, "No parent menu item with children in current nav data");
      return;
    }
    const submenu = parent.locator("[data-header-submenu]").first();
    await expect(submenu).toBeHidden();

    await parent.hover();
    await expect(submenu).toBeVisible();

    // Rời chuột sang logo → dropdown đóng lại (không kẹt scroll-lock).
    await page.locator("[data-header-logo]").first().hover();
    await expect(submenu).toBeHidden();
    expect(await isScrollLocked(page), "scroll lock stuck after dropdown close").toBeFalsy();
  });

  test("featured product card keeps add-to-cart CTA available on hover", async ({ page }) => {
    await gotoAndSettle(page, "/");
    const card = featuredProductCard(page);
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const cta = card.locator("[data-product-card-action]").first();
    await expect(cta).toHaveCount(1);

    await expect(cta).toBeVisible();
    await card.hover();
    await page.waitForTimeout(450);
    await expect(cta).toBeVisible();
  });

  test("sticky header stays anchored after scrolling down", async ({ page }) => {
    await gotoAndSettle(page, "/");
    const header = page.locator("header, .bb-header-container").first();
    await expect(header).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(400);
    const box = await header.boundingBox();
    expect(box, "header box after scroll").not.toBeNull();
    expect(box!.y, `header top after scroll (y=${box?.y})`).toBeLessThanOrEqual(80);
    await expect(header).toBeVisible();
  });

  test("floating chat opens and closes on Escape, restores scroll", async ({ page }) => {
    await gotoAndSettle(page, "/", { scroll: false });
    await page.evaluate(() => window.scrollTo(0, 0));
    const fab = floatingChatTrigger(page);
    if ((await fab.count()) === 0 || !(await fab.isVisible().catch(() => false))) {
      test.skip(true, "Floating chat FAB not present/visible at top of page");
      return;
    }
    const mainFrameBefore = await readMainFrame(page);
    await fab.click();
    const chatDialog = page.getByRole("dialog").filter({ hasText: /Hotline|Zalo|Messager/i }).first();
    await expect(chatDialog).toBeVisible();
    await expectMainFrameStable(page, mainFrameBefore, "floating chat open");
    await page.keyboard.press("Escape");
    await expect(chatDialog).toBeHidden();
    await page.waitForTimeout(400);
    await expectMainFrameStable(page, mainFrameBefore, "floating chat closed");
    expect(await isScrollLocked(page), "scroll lock stuck after chat close").toBeFalsy();
  });

  test("home video modal opens without shifting page content", async ({ page }) => {
    await gotoAndSettle(page, "/", { scroll: false });
    const video = firstVideoTrigger(page);
    if ((await video.count()) === 0 || !(await video.isVisible().catch(() => false))) {
      test.skip(true, "No home video trigger on current data");
      return;
    }

    const mainFrameBefore = await readMainFrame(page);
    await video.click();
    const modal = page.locator('[data-bb-video-modal="true"]');
    await expect(modal).toBeVisible();
    await expectMainFrameStable(page, mainFrameBefore, "video modal open");
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await page.waitForTimeout(400);
    await expectMainFrameStable(page, mainFrameBefore, "video modal closed");
    expect(await isScrollLocked(page), "scroll lock stuck after video modal close").toBeFalsy();
  });
});

/* -------------------------------- mobile --------------------------------- */

test.describe("Effects — mobile @390", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });

  test("mobile menu drawer opens, expands a branch, closes + releases lock", async ({ page }) => {
    await gotoAndSettle(page, "/");
    const trigger = mobileMenuTrigger(page);
    await expect(trigger).toBeVisible();
    const mainFrameBefore = await readMainFrame(page);
    await clickMobileMenuTrigger(page);

    const drawer = page.locator("[data-header-mobile-menu]").first();
    await expect(drawer).toBeVisible();
    const openingMotion = await drawer.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const duration = styles.animationDuration.split(",")[0]?.trim() ?? "0s";
      const durationMs = duration.endsWith("ms") ? parseFloat(duration) : parseFloat(duration) * 1000;
      return {
        animationName: styles.animationName,
        durationMs,
        left: rect.left,
      };
    });
    expect(openingMotion.animationName, "mobile drawer should use the dedicated menu slide-in").toBe("bb-mobile-menu-in-right");
    expect(openingMotion.durationMs, "mobile drawer open animation should be visible").toBeGreaterThanOrEqual(500);
    expect(openingMotion.left, "mobile drawer should still be sliding in immediately after open").toBeGreaterThan(20);
    await page.waitForTimeout(600);
    await expect.poll(async () => {
      return drawer.evaluate((el) => Math.round(el.getBoundingClientRect().left));
    }, { timeout: 2000 }).toBe(0);
    await expectMainFrameStable(page, mainFrameBefore, "mobile menu open");
    const drawerWidthBeforeSubmenu = await drawer.evaluate((el) => el.clientWidth);
    expect(await isScrollLocked(page), "background should be scroll-locked while drawer open").toBeTruthy();

    const branch = drawer.locator("[data-header-submenu-trigger]").first();
    if ((await branch.count()) > 0 && await branch.isVisible().catch(() => false)) {
      const branchItem = branch.locator("xpath=ancestor::li[1]");
      const submenu = branchItem.locator("[data-header-submenu]").first();
      await expect(submenu).toHaveAttribute("data-state", "closed");
      expect(await submenu.evaluate((el) => el.getBoundingClientRect().height), "submenu should start collapsed").toBeLessThan(1);

      await branch.click();
      await expect(branch).toHaveAttribute("aria-expanded", "true");
      await expect(submenu).toHaveAttribute("data-state", "open");
      const expandMotion = await submenu.evaluate((el) => {
        const styles = getComputedStyle(el);
        const duration = styles.transitionDuration.split(",")[0]?.trim() ?? "0s";
        const durationMs = duration.endsWith("ms") ? parseFloat(duration) : parseFloat(duration) * 1000;
        return {
          height: el.getBoundingClientRect().height,
          property: styles.transitionProperty,
          durationMs,
        };
      });
      expect(expandMotion.property, "submenu should animate height").toContain("grid-template-rows");
      expect(expandMotion.durationMs, "submenu expand transition should be visible").toBeGreaterThanOrEqual(200);
      await page.waitForTimeout(80);
      const expandingHeight = await submenu.evaluate((el) => el.getBoundingClientRect().height);
      await page.waitForTimeout(260);
      const expandedHeight = await submenu.evaluate((el) => el.getBoundingClientRect().height);
      expect(expandedHeight, "submenu should finish expanded").toBeGreaterThan(20);
      expect(expandingHeight, "submenu should still be expanding shortly after click").toBeLessThan(expandedHeight);
      const drawerScroll = await drawer.evaluate((el) => {
        const originalScrollTop = el.scrollTop;
        el.scrollTop = 96;
        const scrolledTop = el.scrollTop;
        el.scrollTop = originalScrollTop;
        const scrollbar = getComputedStyle(el, "::-webkit-scrollbar");
        return {
          clientWidth: el.clientWidth,
          offsetWidth: el.offsetWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          scrollbarDisplay: scrollbar.display,
          scrollbarWidth: scrollbar.width,
          scrolledTop,
        };
      });
      expect(drawerScroll.clientWidth, "drawer content width should not shift when submenu expands").toBe(drawerWidthBeforeSubmenu);
      expect(drawerScroll.offsetWidth - drawerScroll.clientWidth, "hidden scrollbar should not reserve drawer width").toBeLessThanOrEqual(1);
      expect(
        drawerScroll.scrollbarDisplay === "none" || drawerScroll.scrollbarWidth === "0px",
        `drawer scrollbar should be hidden (display=${drawerScroll.scrollbarDisplay}, width=${drawerScroll.scrollbarWidth})`,
      ).toBeTruthy();
      if (drawerScroll.scrollHeight > drawerScroll.clientHeight) {
        expect(drawerScroll.scrolledTop, "drawer should still scroll after hiding scrollbar").toBeGreaterThan(0);
      }

      await branch.click();
      await expect(branch).toHaveAttribute("aria-expanded", "false");
      await expect(submenu).toHaveAttribute("data-state", "closed");
      await page.waitForTimeout(80);
      const collapsingHeight = await submenu.evaluate((el) => el.getBoundingClientRect().height);
      expect(collapsingHeight, "submenu should still be collapsing shortly after close").toBeGreaterThan(0);
      expect(collapsingHeight, "submenu collapse should move toward zero").toBeLessThan(expandedHeight);
      await page.waitForTimeout(260);
      expect(await submenu.evaluate((el) => el.getBoundingClientRect().height), "submenu should finish collapsed").toBeLessThan(1);
    }

    await clickMobileMenuTrigger(page);
    await expectClosedAndUnlocked(page, "mobile menu");
    await expectMainFrameStable(page, mainFrameBefore, "mobile menu closed");
  });

  test("mobile search panel opens, accepts input, closes", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await headerSearchTrigger(page).click();
    await expect.poll(async () => (await readLock(page)).panel).toBe("search");
    const input = searchInput(page);
    await expect(input).toBeVisible();
    await input.fill("mu bao hiem");
    await expect(input).toHaveValue("mu bao hiem");
    await page.waitForTimeout(600); // suggest fetch debounce
    await page.keyboard.press("Escape");
    await expectClosedAndUnlocked(page, "mobile search");
  });

  test("mobile cart sheet opens (guest) and closes + releases lock", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await page.locator("nav.bb-bottom-nav button").first().click();
    const sheet = page.getByRole("dialog").first();
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await readLock(page)).panel).toBe("cart");
    const txt = (await sheet.textContent()) ?? "";
    expect(txt.replace(/\s+/g, " ").trim().length, "cart sheet content not blank").toBeGreaterThan(5);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expectClosedAndUnlocked(page, "mobile cart sheet");
  });

  test("floating chat opens on mobile without shifting page content", async ({ page }) => {
    await gotoAndSettle(page, "/sp/", { scroll: false });
    const fab = floatingChatTrigger(page);
    if ((await fab.count()) === 0 || !(await fab.isVisible().catch(() => false))) {
      test.skip(true, "Floating chat FAB not present/visible");
      return;
    }

    const mainFrameBefore = await readMainFrame(page);
    await fab.click();
    const chatDialog = page.getByRole("dialog").filter({ hasText: /Hotline|Zalo|Messager/i }).first();
    await expect(chatDialog).toBeVisible();
    await expectMainFrameStable(page, mainFrameBefore, "mobile floating chat open");
    await page.keyboard.press("Escape");
    await expect(chatDialog).toBeHidden();
    await page.waitForTimeout(400);
    await expectMainFrameStable(page, mainFrameBefore, "mobile floating chat closed");
    expect(await isScrollLocked(page), "scroll lock stuck after mobile chat close").toBeFalsy();
  });

  test("home video modal opens on mobile without shifting page content", async ({ page }) => {
    await gotoAndSettle(page, "/", { scroll: false });
    const video = firstVideoTrigger(page);
    if ((await video.count()) === 0 || !(await video.isVisible().catch(() => false))) {
      test.skip(true, "No home video trigger on current data");
      return;
    }

    const mainFrameBefore = await readMainFrame(page);
    await video.click();
    const modal = page.locator('[data-bb-video-modal="true"]');
    await expect(modal).toBeVisible();
    await expectMainFrameStable(page, mainFrameBefore, "mobile video modal open");
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await page.waitForTimeout(400);
    await expectMainFrameStable(page, mainFrameBefore, "mobile video modal closed");
    expect(await isScrollLocked(page), "scroll lock stuck after mobile video modal close").toBeFalsy();
  });

  test("bottom nav is anchored at the bottom and main clears it", async ({ page }) => {
    await gotoAndSettle(page, "/sp/");
    const nav = page.locator("nav.bb-bottom-nav");
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box, "bottom nav box").not.toBeNull();
    expect(box!.y + box!.height, `bottom nav bottom edge (=${box!.y + box!.height}, vh=${vh})`).toBeGreaterThanOrEqual(vh - 2);
    const mainPad = await page
      .locator("main.bb-main")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom) || 0)
      .catch(() => 0);
    expect(mainPad, "main padding-bottom for bottom nav clearance").toBeGreaterThan(0);
  });
});
