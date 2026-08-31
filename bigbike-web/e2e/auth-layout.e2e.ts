import { expect, test, type Locator, type Page } from "@playwright/test";

import { disableAnimations, expectNoHorizontalOverflow, gotoAndSettle } from "./helpers/ui-quality";

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

const AUTH_ACCEPTANCE_VIEWPORTS = [
  { name: "mobile-360x640", width: 360, height: 640 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-414x896", width: 414, height: 896 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const;

type AuthKind = keyof typeof AUTH_ROUTES;

test.describe.configure({ mode: "serial", timeout: 300_000 });

function authRoot(page: Page, kind: AuthKind): Locator {
  return page.locator(`[data-auth-page="${kind}"]`);
}

async function goToAuth(page: Page, path: string): Promise<void> {
  await gotoAndSettle(page, path, { scroll: false });
  await disableAnimations(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectVisibleInsideViewport(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const metrics = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
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
}

async function expectWhiteAuthShell(page: Page, kind: AuthKind, path: string): Promise<void> {
  await expect(page.locator("[data-auth-shell]")).toHaveCount(1);
  await expect(page.locator("main[data-auth-main]")).toHaveCount(1);
  await expect(authRoot(page, kind)).toBeVisible();
  await expect(page.locator("header[data-auth-header], footer[data-auth-footer]")).toHaveCount(0);
  await expect(
    page.locator(
      "[data-auth-logo], [data-auth-continue-shopping], [data-auth-language-switch], header[data-bb-header], [data-header-desktop-menu], [data-header-mobile-trigger], [data-header-actions], nav.bb-bottom-nav, .bb-floating-chat-anchor, .bb-scroll-top-anchor, footer[data-bb-full-bleed]",
    ),
    `storefront and former authentication chrome must not render on ${path}`,
  ).toHaveCount(0);
  await expect(authRoot(page, kind).locator("[data-auth-guest-exit]")).toHaveCount(1);
}

async function readPageMetrics(page: Page) {
  return page.evaluate(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    const pageLength = Math.max(scroller.scrollHeight, document.body.scrollHeight);
    return {
      pageLength,
      scrollRequired: Math.max(0, pageLength - window.innerHeight),
    };
  });
}

async function hideDevelopmentTools(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal, .tsqd-parent-container").forEach((element) => {
      (element as HTMLElement).style.display = "none";
    });
  });
}

function normalStateControls(root: Locator, kind: AuthKind): Locator[] {
  const guestExit = root.locator("[data-auth-guest-exit] a");
  if (kind === "login") {
    return [
      root.locator("h1"),
      root.locator("#login-username"),
      root.locator("#login-password"),
      root.locator("#remember-me"),
      root.locator('form button[type="submit"]'),
      root.locator('a[href*="/oauth/facebook/authorize"]'),
      root.locator('a[href*="/oauth/google/authorize"]'),
      guestExit,
    ];
  }
  if (kind === "register") {
    return [
      root.locator("h1"),
      root.locator("#reg-fullName"),
      root.locator("#reg-email"),
      root.locator("#reg-phone"),
      root.locator("#reg-password"),
      root.locator("#reg-confirm"),
      root.locator("#reg-privacy-consent"),
      root.locator('form button[type="submit"]:visible'),
      root.locator('a[href*="/oauth/facebook/authorize"]'),
      root.locator('a[href*="/oauth/google/authorize"]'),
      guestExit,
    ];
  }
  if (kind === "forgot") {
    return [
      root.locator("h1"),
      root.locator("#forgot-login"),
      root.locator('button[type="submit"]'),
      guestExit,
    ];
  }
  return [guestExit];
}

test("four authentication pages are chrome-free and fit every accepted viewport", async ({
  page,
}) => {
  for (const viewport of AUTH_ACCEPTANCE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const routeSet of [AUTH_ROUTES, EN_AUTH_ROUTES]) {
      for (const [kind, path] of Object.entries(routeSet) as Array<[AuthKind, string]>) {
        await goToAuth(page, path);
        await expectWhiteAuthShell(page, kind, path);
        await expectNoHorizontalOverflow(page, `${kind} ${path} @ ${viewport.name}`);

        const root = authRoot(page, kind);
        for (const [index, control] of normalStateControls(root, kind).entries()) {
          await expectVisibleInsideViewport(
            page,
            control.first(),
            `${kind} control ${index + 1} @ ${viewport.name}`,
          );
        }

        const metrics = await readPageMetrics(page);
        expect(
          metrics.scrollRequired,
          `${kind} ${path} should not require normal-state scrolling @ ${viewport.name}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("login and registration errors remain reachable when validation expands the form", async ({
  page,
}) => {
  for (const viewport of AUTH_ACCEPTANCE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [kind, path] of Object.entries({
      login: AUTH_ROUTES.login,
      register: AUTH_ROUTES.register,
    }) as Array<["login" | "register", string]>) {
      await goToAuth(page, path);
      const root = authRoot(page, kind);
      await root.locator('form button[type="submit"]:visible').click();
      const errors = root.locator('[role="alert"]');
      await expect(errors, `${kind} validation errors should render`).not.toHaveCount(0);
      const lastError = errors.last();
      await lastError.scrollIntoViewIfNeeded();
      await expectVisibleInsideViewport(page, lastError, `${kind} error @ ${viewport.name}`);
    }
  }
});

test("captures requested login and registration evidence", async ({ page }, testInfo) => {
  for (const viewport of [
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "desktop-1440x900", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [kind, path] of Object.entries({
      login: AUTH_ROUTES.login,
      register: AUTH_ROUTES.register,
    }) as Array<["login" | "register", string]>) {
      await goToAuth(page, path);
      await hideDevelopmentTools(page);
      await page.screenshot({
        path: testInfo.outputPath(`${kind}-${viewport.name}.png`),
        fullPage: false,
      });
    }
  }
});
