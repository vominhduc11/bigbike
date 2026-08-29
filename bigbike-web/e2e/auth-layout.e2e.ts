import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoAndSettle, disableAnimations, expectNoHorizontalOverflow } from "./helpers/ui-quality";
import { VIEWPORTS, type ViewportDef } from "./helpers/viewports";

const AUTH_ROUTES = {
  login: "/dang-nhap/",
  register: "/dang-ky/",
  forgot: "/quen-mat-khau/",
  verify: "/xac-nhan-email/",
} as const;

const EN_AUTH_ROUTES = {
  login: "/en/login/",
  register: "/en/register/",
  forgot: "/en/forgot-password/",
  verify: "/en/verify-email/",
} as const;

type AuthKind = keyof typeof AUTH_ROUTES;

const DESKTOP_VIEWPORTS: ViewportDef[] = [
  VIEWPORTS.find((viewport) => viewport.width === 1024)!,
  VIEWPORTS.find((viewport) => viewport.width === 1440)!,
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

function authRoot(page: Page, kind: AuthKind): Locator {
  return page.locator(`[data-auth-page="${kind}"]`);
}

async function goToAuth(page: Page, path: string): Promise<void> {
  await gotoAndSettle(page, path, { scroll: false });
  await disableAnimations(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectAuthShell(page: Page, kind: AuthKind, path: string): Promise<void> {
  await expect(page.locator("[data-auth-shell]")).toHaveCount(1);
  await expect(page.locator("header[data-auth-header]")).toHaveCount(1);
  await expect(page.locator("header[data-auth-header]")).toBeVisible();
  await expect(page.locator("main[data-auth-main]")).toHaveCount(1);
  await expect(page.locator("footer[data-auth-footer]")).toHaveCount(1);
  await expect(page.locator("footer[data-auth-footer]")).toBeVisible();
  await expect(authRoot(page, kind)).toBeVisible();

  await expect(page.locator('[data-auth-logo] img[src*="header-mark.png"]')).toBeVisible();
  await expect(page.locator('[data-auth-logo] img[src*="header-logo.png"]')).toHaveCount(0);
  await expect(page.locator("[data-auth-continue-shopping]")).toHaveCount(1);
  await expect(page.locator("[data-auth-language-switch] button")).toHaveCount(2);
  await expect(
    page.locator('footer[data-auth-footer] [data-footer-menu-link="privacy"]'),
  ).toHaveCount(1);

  await expect(
    page.locator(
      "header[data-bb-header], [data-header-desktop-menu], [data-header-mobile-trigger], [data-header-actions], nav.bb-bottom-nav, .bb-floating-chat-anchor, .bb-scroll-top-anchor",
    ),
    `storefront chrome must not render on ${path}`,
  ).toHaveCount(0);
  await expect(
    page.locator("footer[data-bb-full-bleed], footer:not([data-auth-footer])"),
  ).toHaveCount(0);
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

test("all auth routes use one independent shell at mobile and desktop", async ({ page }) => {
  for (const viewport of [
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "desktop-1440x900", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const routeSet of [AUTH_ROUTES, EN_AUTH_ROUTES]) {
      for (const [kind, path] of Object.entries(routeSet) as Array<[AuthKind, string]>) {
        await goToAuth(page, path);
        await expectAuthShell(page, kind, path);
        await expectNoHorizontalOverflow(page, `${kind} ${path} @ ${viewport.name}`);
      }
    }
  }
});

test("login form fits the viewport from 1024x768 upward", async ({ page }) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await goToAuth(page, AUTH_ROUTES.login);
    await expectAuthShell(page, "login", AUTH_ROUTES.login);

    const root = authRoot(page, "login");
    const controls = [
      root.locator("h1"),
      root.locator("#login-username"),
      root.locator("#login-password"),
      root.locator('form button[type="submit"]'),
      root.locator("[data-auth-order-lookup]"),
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
});

test("register mobile submit is in normal flow and cannot be covered", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToAuth(page, AUTH_ROUTES.register);
  await expectAuthShell(page, "register", AUTH_ROUTES.register);

  const root = authRoot(page, "register");
  const action = root.locator('form button[type="submit"]:visible');
  await expect(action).toHaveCount(1);
  await expect(root.locator("[data-auth-mobile-submit]")).toHaveCount(0);

  await action.scrollIntoViewIfNeeded();
  await expectVisibleInsideViewport(page, action, "mobile register submit button");
  const position = await action.evaluate((element) => getComputedStyle(element).position);
  expect(position, "mobile register submit should stay in document flow").toBe("static");
  await expect(page.locator("nav.bb-bottom-nav")).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "register @ mobile-390x844");
});

test("auth logo and continue-shopping links both return to the home page", async ({ page }) => {
  for (const path of [AUTH_ROUTES.login, "/en/login/"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToAuth(page, path);

    await page.locator("[data-auth-logo]").click();
    await expect(page).toHaveURL(/\/en\/?$|\/$/);

    await goToAuth(page, path);
    await page.locator("[data-auth-continue-shopping]").click();
    await expect(page).toHaveURL(/\/en\/?$|\/$/);
  }
});

test("records acceptance viewport metrics and screenshots for all auth pages", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const viewports = [
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "desktop-1440x900", width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [kind, path] of Object.entries(AUTH_ROUTES) as Array<[AuthKind, string]>) {
      await goToAuth(page, path);
      await expectAuthShell(page, kind, path);
      const metrics = await readPageMetrics(page);
      const action = authRoot(page, kind).locator('button[type="submit"]:visible').first();
      const actionBox = (await action.count()) ? await action.boundingBox() : null;

      console.log(
        `[auth-layout] ${JSON.stringify({
          kind,
          ...viewport,
          ...metrics,
          actionTop: actionBox?.y,
          actionBottom: actionBox ? actionBox.y + actionBox.height : null,
        })}`,
      );

      if ([390, 1440].includes(viewport.width)) {
        await page.screenshot({
          path: testInfo.outputPath(`${kind}-${viewport.name}.png`),
          fullPage: false,
        });
      }
    }
  }
});
