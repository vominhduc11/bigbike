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
    const fab = page.locator("button.b24-widget-button-inner-block").first();
    if ((await fab.count()) === 0 || !(await fab.isVisible().catch(() => false))) {
      test.skip(true, "Floating chat FAB not present/visible at top of page");
      return;
    }
    await fab.click();
    const chatDialog = page.getByRole("dialog", { name: "Liên hệ hỗ trợ" });
    await expect(chatDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(chatDialog).toBeHidden();
    await page.waitForTimeout(400);
    expect(await isScrollLocked(page), "scroll lock stuck after chat close").toBeFalsy();
  });
});

/* -------------------------------- mobile --------------------------------- */

test.describe("Effects — mobile @390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile menu drawer opens, expands a branch, closes + releases lock", async ({ page }) => {
    await gotoAndSettle(page, "/");
    const trigger = mobileMenuTrigger(page);
    await expect(trigger).toBeVisible();
    await clickMobileMenuTrigger(page);

    const drawer = page.locator("[data-header-mobile-menu]").first();
    await expect(drawer).toBeVisible();
    expect(await isScrollLocked(page), "background should be scroll-locked while drawer open").toBeTruthy();

    const branch = drawer.locator("[data-header-submenu-trigger]").first();
    if ((await branch.count()) > 0 && await branch.isVisible().catch(() => false)) {
      await branch.click();
      await page.waitForTimeout(300);
      await expect(branch).toHaveAttribute("aria-expanded", "true");
    }

    await clickMobileMenuTrigger(page);
    await expectClosedAndUnlocked(page, "mobile menu");
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

  test("bottom nav is anchored at the bottom and main clears it", async ({ page }) => {
    await gotoAndSettle(page, "/san-pham/");
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
