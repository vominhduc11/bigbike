import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoAndSettle, disableAnimations, expectNoHorizontalOverflow } from "./helpers/ui-quality";
import { VIEWPORTS, type ViewportDef } from "./helpers/viewports";

const AUTH_ROUTES = {
  login: "/dang-nhap/",
  register: "/dang-ky/",
} as const;

const DESKTOP_VIEWPORTS: ViewportDef[] = [
  VIEWPORTS.find((viewport) => viewport.width === 1024)!,
  { name: "laptop-1366x768", width: 1366, height: 768, kind: "desktop" },
  VIEWPORTS.find((viewport) => viewport.width === 1440)!,
  VIEWPORTS.find((viewport) => viewport.width === 1920)!,
];

const LOGO_VIEWPORTS = [
  { name: "logo-threshold-1261", width: 1261, height: 900 },
  { name: "compact-header-1260", width: 1260, height: 900 },
  { name: "compact-header-1024", width: 1024, height: 768 },
  { name: "logo-wide-1280", width: 1280, height: 800 },
  { name: "logo-wide-1366", width: 1366, height: 768 },
  { name: "logo-wide-1440", width: 1440, height: 900 },
  { name: "logo-wide-1600", width: 1600, height: 900 },
  { name: "logo-wide-1920", width: 1920, height: 1080 },
];

test.describe.configure({ mode: "serial", timeout: 240_000 });

async function expectVisibleInsideViewport(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  await expect(locator, `${label} should be visible`).toBeVisible();

  const metrics = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);

    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      covered: hit === element || (hit instanceof Node && element.contains(hit)),
    };
  });

  expect(metrics.top, `${label} starts above the viewport`).toBeGreaterThanOrEqual(-1);
  expect(metrics.bottom, `${label} ends below the viewport`).toBeLessThanOrEqual(
    metrics.viewportHeight + 1,
  );
  expect(metrics.left, `${label} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
  expect(metrics.right, `${label} ends outside the viewport`).toBeLessThanOrEqual(
    metrics.viewportWidth + 1,
  );
  expect(metrics.covered, `${label} is covered by another element`).toBe(true);
}

function authRoot(page: Page, kind: keyof typeof AUTH_ROUTES): Locator {
  return page.locator(`[data-auth-page="${kind}"]`);
}

async function goToAuth(page: Page, path: string): Promise<void> {
  await gotoAndSettle(page, path, { scroll: false });
  await disableAnimations(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectDesktopLoginContent(page: Page, viewport: ViewportDef): Promise<void> {
  const root = authRoot(page, "login");
  const controls = [
    root.locator("h1"),
    root.locator("#login-username"),
    root.locator("#login-password"),
    root.locator('form button[type="submit"]'),
    root.locator('a[href*="/dang-ky/"], a[href*="/register/"]'),
    root.locator('a[href*="/oauth/facebook/authorize"]'),
    root.locator('a[href*="/oauth/google/authorize"]'),
  ];

  for (const [index, control] of controls.entries()) {
    await expectVisibleInsideViewport(
      page,
      control.first(),
      `login control ${index + 1} @ ${viewport.name}`,
    );
  }
}

async function expectDesktopRegisterContent(page: Page, viewport: ViewportDef): Promise<void> {
  const root = authRoot(page, "register");
  const controls = [
    root.locator("h1"),
    root.locator("#reg-fullName"),
    root.locator("#reg-email"),
    root.locator("#reg-phone"),
    root.locator("#reg-password"),
    root.locator("#reg-confirm"),
    root.locator('button[type="submit"]:visible'),
    root.locator('a[href*="/oauth/facebook/authorize"]'),
    root.locator('a[href*="/oauth/google/authorize"]'),
  ];

  for (const [index, control] of controls.entries()) {
    await expectVisibleInsideViewport(
      page,
      control.first(),
      `register control ${index + 1} @ ${viewport.name}`,
    );
  }
}

async function readPageMetrics(page: Page) {
  return page.evaluate(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    const pageLength = Math.max(scroller.scrollHeight, document.body.scrollHeight);
    return {
      pageLength,
      scrollRequired: Math.max(0, pageLength - window.innerHeight),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

test("logo clearance keeps both credential pages below the hanging logo", async ({ page }) => {
  for (const viewport of LOGO_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const [kind, path] of Object.entries(AUTH_ROUTES) as Array<
      [keyof typeof AUTH_ROUTES, string]
    >) {
      await goToAuth(page, path);
      const root = authRoot(page, kind);
      const logo = page.locator('[data-header-logo] img[src*="header-logo.png"]');

      if (viewport.width >= 1261) {
        await expect(logo, `large logo should be visible @ ${viewport.name}`).toBeVisible();
        const logoBottom = await logo.evaluate((element) => element.getBoundingClientRect().bottom);
        const headingTop = await root
          .locator("h1")
          .evaluate((element) => element.getBoundingClientRect().top);
        expect(logoBottom, `${kind} heading overlaps logo @ ${viewport.name}`).toBeLessThanOrEqual(
          headingTop + 1,
        );
      } else {
        await expect(logo, `compact logo should be used @ ${viewport.name}`).toBeHidden();
      }

      await expectNoHorizontalOverflow(page, `${kind} @ ${viewport.name}`);
    }
  }
});

test("login controls fit the desktop viewport without scrolling", async ({ page }) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await goToAuth(page, AUTH_ROUTES.login);
    await expectDesktopLoginContent(page, viewport);
    expect(
      (await readPageMetrics(page)).scrollRequired,
      `login should not scroll @ ${viewport.name}`,
    ).toBe(0);
    await expectNoHorizontalOverflow(page, `login @ ${viewport.name}`);
  }
});

test("register controls and primary action fit the desktop viewport without scrolling", async ({
  page,
}) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await goToAuth(page, AUTH_ROUTES.register);
    await expectDesktopRegisterContent(page, viewport);
    expect(
      (await readPageMetrics(page)).scrollRequired,
      `register should not scroll @ ${viewport.name}`,
    ).toBe(0);
    await expectNoHorizontalOverflow(page, `register @ ${viewport.name}`);
  }
});

test("register primary action stays above the mobile bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToAuth(page, AUTH_ROUTES.register);

  const root = authRoot(page, "register");
  const actionBar = root.locator("[data-auth-mobile-submit]");
  const actionButton = actionBar.locator('button[type="submit"]');
  const bottomNav = page.locator("nav.bb-bottom-nav");

  await expectVisibleInsideViewport(page, actionBar, "mobile register action bar");
  await expectVisibleInsideViewport(page, actionButton, "mobile register submit button");
  await expect(bottomNav, "mobile bottom navigation should remain visible").toBeVisible();

  const metrics = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>("[data-auth-mobile-submit]");
    const nav = document.querySelector<HTMLElement>("nav.bb-bottom-nav");
    const button = bar?.querySelector<HTMLElement>('button[type="submit"]');
    if (!bar || !nav || !button) throw new Error("Missing mobile auth action geometry");
    return {
      barPosition: getComputedStyle(bar).position,
      buttonForm: button.getAttribute("form"),
      buttonBottom: button.getBoundingClientRect().bottom,
      navTop: nav.getBoundingClientRect().top,
    };
  });

  expect(metrics.barPosition).toBe("fixed");
  expect(metrics.buttonForm).toBe("register-form");
  expect(
    metrics.buttonBottom,
    "mobile register action must not be covered by bottom navigation",
  ).toBeLessThanOrEqual(metrics.navTop + 1);
  await expectNoHorizontalOverflow(page, "register @ mobile-390x844");
});

test("auth footer keeps the privacy policy link and does not render the full footer", async ({
  page,
}) => {
  for (const path of [AUTH_ROUTES.login, AUTH_ROUTES.register, "/en/login/", "/en/register/"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToAuth(page, path);

    const footer = page.locator("footer[data-bb-auth-footer]");
    await expect(footer, `compact auth footer should render for ${path}`).toBeVisible();
    await expect(
      page.locator("footer"),
      `only compact auth footer should render for ${path}`,
    ).toHaveCount(1);
    await expect(
      footer.locator('a[href*="chinh-sach-bao-mat-thong-tin"], a[href*="privacy-policy"]'),
    ).toHaveCount(1);
    await expect(footer.locator("a")).toBeVisible();
  }

  await goToAuth(page, "/quen-mat-khau/");
  await expect(page.locator("footer[data-bb-auth-footer]")).toHaveCount(0);
  await expect(page.locator("footer").first()).toBeVisible();

  await goToAuth(page, "/xac-nhan-email/");
  await expect(page.locator("footer[data-bb-auth-footer]")).toHaveCount(0);
  await expect(page.locator("footer").first()).toBeVisible();
});

test("records acceptance viewport metrics and screenshots for auth pages", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const viewports = [
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "laptop-1366x768", width: 1366, height: 768 },
    { name: "desktop-1440x900", width: 1440, height: 900 },
    { name: "desktop-1920x1080", width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [kind, path] of Object.entries(AUTH_ROUTES) as Array<
      [keyof typeof AUTH_ROUTES, string]
    >) {
      await goToAuth(page, path);
      const metrics = await readPageMetrics(page);
      const action = authRoot(page, kind).locator('button[type="submit"]:visible').first();
      const actionBox = await action.boundingBox();

      console.log(
        `[auth-layout] ${JSON.stringify({ kind, ...viewport, ...metrics, actionTop: actionBox?.y, actionBottom: actionBox ? actionBox.y + actionBox.height : null })}`,
      );

      if (viewport.width >= 1024) {
        await expectVisibleInsideViewport(
          page,
          action,
          `${kind} primary action @ ${viewport.name}`,
        );
        expect(metrics.scrollRequired, `${kind} should not scroll @ ${viewport.name}`).toBe(0);
      }

      if ([390, 1366, 1440, 1920].includes(viewport.width)) {
        await page.screenshot({
          path: testInfo.outputPath(`${kind}-${viewport.name}.png`),
          fullPage: false,
        });
      }
    }
  }
});
