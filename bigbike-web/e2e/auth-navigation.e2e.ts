import { expect, test, type Page } from "@playwright/test";

import { gotoAndSettle } from "./helpers/ui-quality";
import { VIEWPORTS } from "./helpers/viewports";

const LOGIN_PATH = "/dang-nhap/";
const ACCOUNT_PATH = "/tai-khoan/";
const ORDER_HISTORY_PATH = "/tai-khoan/don-hang/";
const CART_PATH = "/gio-hang/";
const CHECKOUT_PATH = "/dat-hang/";
const HOME_PATH = "/";
const PRODUCT_LIST_PATH = "/sp/";
const AUTH_MARKER = "bb_customer_authenticated";
const SAMPLE_KEY = "__bb_e2e_body_samples";
const PHASE_KEY = "__bb_e2e_phase";
const NAVIGATION_KEY = "__bb_e2e_navigation_events";

const LOGIN_VIEWPORTS = [360, 390, 640, 768, 1440].map((width) =>
  VIEWPORTS.find((viewport) => viewport.width === width)!,
);
const LOGOUT_VIEWPORTS = [390, 1440].map((width) =>
  VIEWPORTS.find((viewport) => viewport.width === width)!,
);

type MockState = {
  loggedIn: boolean;
  loginRequests: number;
  meRequests: number;
  logoutRequests: number;
  orderRequests: number;
  protectedPrefetches: string[];
  navigationRequests: Array<{ pathname: string; time: number }>;
  phaseStartedAt: number;
  loginDelayMs: number;
  meDelayMs: number;
  logoutDelayMs: number;
  cart: CartResponse;
};

type NavigationEvent = {
  method: "pushState" | "replaceState";
  pathname: string;
  search: string;
  time: number;
};

type BodySample = {
  meaningful: boolean;
  skeleton: boolean;
  time: number;
};

const PROFILE = {
  id: "e2e-customer",
  email: "e2e-customer@example.invalid",
  phone: null,
  displayName: "Khách kiểm thử",
  status: "ACTIVE",
  emailVerified: true,
  avatarUrl: null,
};

const ORDER = {
  id: "e2e-order",
  orderNumber: "E2E-001",
  status: "COMPLETED",
  totalAmount: 100000,
  currency: "VND",
  placedAt: "2026-08-28T08:00:00Z",
  itemCount: 1,
  productNames: ["Sản phẩm kiểm thử"],
};

const EMPTY_CART = {
  data: {
    id: "e2e-cart",
    status: "ACTIVE",
    currency: "VND",
    items: [],
    totals: {
      subtotalAmount: 0,
      discountAmount: 0,
      shippingAmount: 0,
      feeAmount: 0,
      totalAmount: 0,
    },
  },
};

const GUEST_CART = {
  data: {
    id: "e2e-cart",
    status: "ACTIVE",
    currency: "VND",
    items: [
      {
        id: "guest-cart-item",
        productId: "guest-product",
        productVariantId: null,
        sku: "E2E-GUEST-001",
        productName: "Sản phẩm trong giỏ khách",
        variantName: null,
        image: null,
        quantity: 1,
        unitPrice: 100000,
        lineSubtotal: 100000,
        lineDiscount: 0,
        lineTotal: 100000,
        available: true,
      },
    ],
    totals: {
      subtotalAmount: 100000,
      discountAmount: 0,
      shippingAmount: 0,
      feeAmount: 0,
      totalAmount: 100000,
    },
  },
};

type CartResponse = typeof EMPTY_CART | typeof GUEST_CART;

function createMockState(): MockState {
  return {
    loggedIn: false,
    loginRequests: 0,
    meRequests: 0,
    logoutRequests: 0,
    orderRequests: 0,
    protectedPrefetches: [],
    navigationRequests: [],
    phaseStartedAt: 0,
    loginDelayMs: 0,
    meDelayMs: 0,
    logoutDelayMs: 0,
    cart: EMPTY_CART,
  };
}

async function waitMs(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function addSessionCookies(page: Page): Promise<void> {
  const origin = new URL(page.url()).origin;
  await page.context().addCookies([
    { name: "bb_session", value: "e2e-session", url: origin, httpOnly: true },
    { name: "bb_refresh", value: "e2e-refresh", url: origin, httpOnly: true },
    { name: "bb_csrf", value: "e2e-csrf", url: origin },
  ]);
}

async function installMocks(page: Page): Promise<MockState> {
  const state = createMockState();

  await page.addInitScript(
    ({ sampleKey, phaseKey, navigationKey }) => {
      const win = window as typeof window & { __bbE2eNavigationPatched?: boolean };
      if (win.__bbE2eNavigationPatched) return;
      win.__bbE2eNavigationPatched = true;

      const readJson = <T>(key: string, fallback: T): T => {
        try {
          const value = sessionStorage.getItem(key);
          return value ? (JSON.parse(value) as T) : fallback;
        } catch {
          return fallback;
        }
      };

      const writeJson = (key: string, value: unknown) => {
        try {
          sessionStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* The assertions remain useful when storage is unavailable. */
        }
      };

      const recordNavigation = (
        method: "pushState" | "replaceState",
        url: string | URL | null | undefined,
      ) => {
        let parsed: URL;
        try {
          parsed = new URL(String(url ?? ""), window.location.href);
        } catch {
          parsed = new URL(window.location.href);
        }
        const events = readJson<NavigationEvent[]>(navigationKey, []);
        events.push({ method, pathname: parsed.pathname, search: parsed.search, time: Date.now() });
        writeJson(navigationKey, events.slice(-100));
      };

      const originalPushState = history.pushState.bind(history);
      const originalReplaceState = history.replaceState.bind(history);
      history.pushState = ((data, unused, url) => {
        recordNavigation("pushState", url);
        return originalPushState(data, unused, url);
      }) as typeof history.pushState;
      history.replaceState = ((data, unused, url) => {
        recordNavigation("replaceState", url);
        return originalReplaceState(data, unused, url);
      }) as typeof history.replaceState;

      const meaningfulMain = () => {
        const main = document.querySelector("main");
        if (!main) return { meaningful: true, skeleton: false };
        const skeleton = Boolean(main.querySelector('[role="status"][aria-busy="true"]'));
        return {
          meaningful: skeleton || Boolean((main as HTMLElement).innerText.trim()),
          skeleton,
        };
      };

      window.setInterval(() => {
        const result = meaningfulMain();
        const samples = readJson<BodySample[]>(sampleKey, []);
        samples.push({ ...result, time: Date.now() });
        writeJson(sampleKey, samples.slice(-400));
      }, 25);

      void phaseKey;
    },
    { sampleKey: SAMPLE_KEY, phaseKey: PHASE_KEY, navigationKey: NAVIGATION_KEY },
  );

  page.on("request", (request) => {
    const url = new URL(request.url());
    const headers = request.headers();
    const isNavigationPayload = request.resourceType() === "document" || headers.rsc === "1";
    if (
      state.phaseStartedAt > 0 &&
      isNavigationPayload &&
      [ACCOUNT_PATH, HOME_PATH, LOGIN_PATH].includes(url.pathname)
    ) {
      state.navigationRequests.push({ pathname: url.pathname, time: Date.now() });
    }

    if (!url.pathname.startsWith("/tai-khoan")) return;
    const isPrefetch =
      headers["next-router-prefetch"] === "1" ||
      headers.purpose?.toLowerCase().includes("prefetch") ||
      (headers.rsc === "1" && headers["next-router-prefetch"] !== "0");
    if (isPrefetch) state.protectedPrefetches.push(request.url());
  });

  await page.route("**/api/v1/customer/auth/login", async (route) => {
    state.loginRequests += 1;
    state.loggedIn = true;
    await addSessionCookies(page);
    await waitMs(state.loginDelayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          customer: {
            id: PROFILE.id,
            email: PROFILE.email,
            phone: PROFILE.phone,
            displayName: PROFILE.displayName,
            status: PROFILE.status,
          },
          csrfToken: "e2e-csrf",
        },
      }),
    });
  });

  await page.route("**/api/v1/customer/me", async (route) => {
    state.meRequests += 1;
    await waitMs(state.meDelayMs);
    if (!state.loggedIn) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHENTICATED" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: PROFILE }),
    });
  });

  await page.route("**/api/v1/customer/auth/logout", async (route) => {
    state.logoutRequests += 1;
    await waitMs(state.logoutDelayMs);
    state.loggedIn = false;
    await route.fulfill({ status: 204 });
    await page.context().clearCookies();
  });

  await page.route("**/api/v1/customer/orders**", async (route) => {
    state.orderRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [ORDER], pagination: { totalPages: 1, totalItems: 1 } }),
    });
  });

  await page.route("**/api/v1/cart**", async (route) => {
    if (
      route.request().method() === "POST" &&
      new URL(route.request().url()).pathname.endsWith("/items")
    ) {
      state.cart = GUEST_CART;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.cart),
    });
  });

  return state;
}

async function resetSession(page: Page, state: MockState): Promise<void> {
  state.loggedIn = false;
  state.loginRequests = 0;
  state.meRequests = 0;
  state.logoutRequests = 0;
  state.orderRequests = 0;
  state.protectedPrefetches = [];
  state.navigationRequests = [];
  state.phaseStartedAt = 0;
  state.loginDelayMs = 0;
  state.meDelayMs = 0;
  state.logoutDelayMs = 0;
  state.cart = EMPTY_CART;
  await page.context().clearCookies();
  await page
    .evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    })
    .catch(() => undefined);
}

async function prepareAnonymous(page: Page, state: MockState, path: string): Promise<void> {
  await resetSession(page, state);
  await gotoAndSettle(page, path, { scroll: false });
}

async function prepareAuthenticated(page: Page, state: MockState, path: string): Promise<void> {
  await resetSession(page, state);
  await gotoAndSettle(page, HOME_PATH, { scroll: false });
  await page.evaluate((marker) => localStorage.setItem(marker, "1"), AUTH_MARKER);
  state.loggedIn = true;
  await addSessionCookies(page);
  await gotoAndSettle(page, path, { scroll: false });
}

async function beginTransitionObservation(page: Page, state: MockState): Promise<void> {
  state.navigationRequests = [];
  state.phaseStartedAt = Date.now();
  await page.evaluate(
    ({ sampleKey, phaseKey, navigationKey }) => {
      sessionStorage.setItem(sampleKey, "[]");
      sessionStorage.setItem(navigationKey, "[]");
      sessionStorage.setItem(phaseKey, String(Date.now()));
    },
    { sampleKey: SAMPLE_KEY, phaseKey: PHASE_KEY, navigationKey: NAVIGATION_KEY },
  );
}

async function readTransitionEvidence(page: Page): Promise<{
  samples: BodySample[];
  navigation: NavigationEvent[];
}> {
  return page.evaluate(
    ({ sampleKey, phaseKey, navigationKey }) => {
      const phase = Number(sessionStorage.getItem(phaseKey) ?? "0");
      const read = <T>(key: string): T[] => {
        try {
          return JSON.parse(sessionStorage.getItem(key) ?? "[]") as T[];
        } catch {
          return [];
        }
      };
      return {
        samples: read<BodySample>(sampleKey).filter((sample) => sample.time >= phase),
        navigation: read<NavigationEvent>(navigationKey).filter((event) => event.time >= phase),
      };
    },
    { sampleKey: SAMPLE_KEY, phaseKey: PHASE_KEY, navigationKey: NAVIGATION_KEY },
  );
}

function maxUnmeaningfulWindow(samples: BodySample[]): number {
  let startedAt: number | null = null;
  let maximum = 0;
  for (const sample of samples) {
    if (!sample.meaningful && startedAt == null) startedAt = sample.time;
    if (sample.meaningful && startedAt != null) {
      maximum = Math.max(maximum, sample.time - startedAt);
      startedAt = null;
    }
  }
  if (startedAt != null && samples.length > 0) {
    maximum = Math.max(maximum, samples[samples.length - 1].time - startedAt);
  }
  return maximum;
}

async function expectMeaningfulMain(page: Page, label: string): Promise<void> {
  const main = page.locator("main").first();
  await expect(main, `${label}: main should remain visible`).toBeVisible();
  await expect
    .poll(
      () =>
        main.evaluate((element) =>
          Boolean(
            element.querySelector('[role="status"][aria-busy="true"]') ||
            (element as HTMLElement).innerText.trim(),
          ),
        ),
      { timeout: 10000 },
    )
    .toBe(true);
}

async function expectTransitionEvidence(
  page: Page,
  state: MockState,
  targetPath: string,
  label: string,
  options: { allowSamePathNoop?: boolean; requireSkeleton?: boolean } = {},
): Promise<void> {
  await expectMeaningfulMain(page, label);
  const evidence = await readTransitionEvidence(page);
  expect(
    maxUnmeaningfulWindow(evidence.samples),
    `${label}: body must not be empty for more than one second`,
  ).toBeLessThanOrEqual(1000);
  if (options.requireSkeleton !== false) {
    expect(
      evidence.samples.some((sample) => sample.skeleton),
      `${label}: transition should expose the shared loading skeleton`,
    ).toBe(true);
  }

  const targetEvents = evidence.navigation.filter((event) => event.pathname === targetPath);
  const targetRequests = state.navigationRequests.filter(
    (request) => request.pathname === targetPath && request.time >= state.phaseStartedAt,
  );
  if (targetEvents.length > 0) {
    expect(targetEvents, `${label}: exactly one history navigation to ${targetPath}`).toHaveLength(
      1,
    );
  } else if (targetRequests.length > 0) {
    expect(
      targetRequests,
      `${label}: exactly one document navigation to ${targetPath}`,
    ).toHaveLength(1);
  } else {
    expect(
      options.allowSamePathNoop && new URL(page.url()).pathname === targetPath,
      `${label}: same-path navigation may be a no-op only when already at ${targetPath}`,
    ).toBe(true);
  }
  const loginRequests = state.navigationRequests.filter(
    (request) => request.pathname === LOGIN_PATH && request.time >= state.phaseStartedAt,
  );
  expect(
    evidence.navigation.filter((event) => event.pathname === LOGIN_PATH).length +
      loginRequests.length,
    `${label}: should not navigate back to login`,
  ).toBe(0);
}

async function expectAccount(page: Page, label: string): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 10000, message: `${label}: target URL` })
    .toBe(ACCOUNT_PATH);
  await expectMeaningfulMain(page, label);
  await expect(page.locator("main").first()).toContainText("Bảng điều khiển");
}

async function expectHome(page: Page, label: string): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 10000, message: `${label}: target URL` })
    .toBe(HOME_PATH);
  await expectMeaningfulMain(page, label);
}

async function submitLogin(page: Page): Promise<void> {
  await page.locator("#login-username").fill("e2e-customer@example.invalid");
  await page.locator("#login-password").fill("Correct-Horse-Battery-Staple!");
  await page.locator('[data-auth-page="login"] form button[type="submit"]').click();
}

async function openLoginFromHome(page: Page): Promise<void> {
  const mobileTrigger = page.locator("[data-header-mobile-trigger]");
  if (!(await mobileTrigger.isVisible())) {
    const header = page.locator("header[data-bb-header]");
    await header.getByRole("button", { name: /tài khoản/i }).click();
    await page.getByRole("menu").locator(`a[href="${LOGIN_PATH}"]`).click();
    return;
  }

  await mobileTrigger.click();
  const menu = page.locator("[data-header-mobile-menu]");
  await expect(menu).toBeVisible();
  const loginLink = menu.locator(`a[href="${LOGIN_PATH}"]`);
  await expect(loginLink).toBeVisible();
  await page.waitForTimeout(500);
  await loginLink.click();
}

async function logoutFromHeader(page: Page): Promise<void> {
  const mobileTrigger = page.locator("[data-header-mobile-trigger]");
  if (!(await mobileTrigger.isVisible())) {
    const header = page.locator("header[data-bb-header]");
    await header.getByRole("button", { name: /tài khoản/i, exact: false }).click();
    await page
      .getByRole("menu")
      .getByRole("menuitem", { name: /đăng xuất/i })
      .click();
    return;
  }

  await mobileTrigger.click();
  const menu = page.locator("[data-header-mobile-menu]");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /đăng xuất/i }).click();
}

async function logoutFromSidebar(page: Page): Promise<void> {
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator("main aside")
    .getByRole("button", { name: /đăng xuất/i })
    .last()
    .click();
}

async function repeatThreeTimes(action: (run: number) => Promise<void>): Promise<void> {
  for (let run = 1; run <= 3; run += 1) await action(run);
}

test.describe.configure({ mode: "serial", timeout: 300_000 });

test("1. đăng nhập trực tiếp luôn tới Tài khoản ở mọi bề ngang", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGIN_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAnonymous(page, state, LOGIN_PATH);
      await expect(page.locator('[data-auth-page="login"]')).toBeVisible();
      await beginTransitionObservation(page, state);
      state.loginDelayMs = 150;
      state.meDelayMs = 350;
      await submitLogin(page);
      await expectAccount(page, `case 1 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        ACCOUNT_PATH,
        `case 1 run ${run} @ ${viewport.name}`,
      );
      expect(state.loginRequests, `case 1 login API @ ${viewport.name} run ${run}`).toBe(1);
    });
  }
});

test("2. đăng nhập sau khi bị chặn vẫn quay lại đúng Tài khoản", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGIN_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAnonymous(page, state, ACCOUNT_PATH);
      await expect(page).toHaveURL(/\/dang-nhap\/\?tiep=%2Ftai-khoan%2F$/);
      await expect(page.locator('[data-auth-page="login"]')).toBeVisible();
      await beginTransitionObservation(page, state);
      state.loginDelayMs = 150;
      state.meDelayMs = 350;
      await submitLogin(page);
      await expectAccount(page, `case 2 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        ACCOUNT_PATH,
        `case 2 run ${run} @ ${viewport.name}`,
      );
      expect(state.loginRequests, `case 2 login API @ ${viewport.name} run ${run}`).toBe(1);
    });
  }
});

test("3. mở Đăng nhập từ Trang chủ rồi đăng nhập thành công", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGIN_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAnonymous(page, state, HOME_PATH);
      await openLoginFromHome(page);
      await expect(page).toHaveURL(new RegExp(`${LOGIN_PATH.replaceAll("/", "\\/")}$`));
      await expect(page.locator('[data-auth-page="login"]')).toBeVisible();
      await beginTransitionObservation(page, state);
      state.loginDelayMs = 150;
      state.meDelayMs = 350;
      await submitLogin(page);
      await expectAccount(page, `case 3 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        ACCOUNT_PATH,
        `case 3 run ${run} @ ${viewport.name}`,
      );
      expect(state.loginRequests, `case 3 login API @ ${viewport.name} run ${run}`).toBe(1);
    });
  }
});

test("4. ở lâu tại Đăng nhập vẫn không prefetch Tài khoản sai trạng thái", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGIN_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAnonymous(page, state, LOGIN_PATH);
      await page.waitForTimeout(4000);
      expect(
        state.protectedPrefetches,
        `case 4 must not prefetch protected account route @ ${viewport.name} run ${run}`,
      ).toEqual([]);
      await beginTransitionObservation(page, state);
      state.loginDelayMs = 150;
      state.meDelayMs = 350;
      await submitLogin(page);
      await expectAccount(page, `case 4 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        ACCOUNT_PATH,
        `case 4 run ${run} @ ${viewport.name}`,
      );
    });
  }
});

test("5. đăng xuất từ menu trên cùng tại Tài khoản về Trang chủ", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGOUT_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAuthenticated(page, state, ACCOUNT_PATH);
      await expectAccount(page, `case 5 setup @ ${viewport.name}`);
      await beginTransitionObservation(page, state);
      state.logoutDelayMs = 350;
      await logoutFromHeader(page);
      await expectHome(page, `case 5 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        HOME_PATH,
        `case 5 run ${run} @ ${viewport.name}`,
      );
      expect(state.logoutRequests, `case 5 logout API @ ${viewport.name} run ${run}`).toBe(1);
    });
  }
});

test("6. đăng xuất từ menu trên cùng tại Lịch sử mua hàng về Trang chủ", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGOUT_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAuthenticated(page, state, ORDER_HISTORY_PATH);
      await expect(page.locator("main").first()).toContainText("Lịch sử mua hàng");
      await beginTransitionObservation(page, state);
      state.logoutDelayMs = 350;
      await logoutFromHeader(page);
      await expectHome(page, `case 6 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        HOME_PATH,
        `case 6 run ${run} @ ${viewport.name}`,
      );
      expect(state.logoutRequests, `case 6 logout API @ ${viewport.name} run ${run}`).toBe(1);
    });
  }
});

test("7. đăng xuất từ cột trái tại Tài khoản về Trang chủ", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGOUT_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await repeatThreeTimes(async (run) => {
      await prepareAuthenticated(page, state, ACCOUNT_PATH);
      await expectAccount(page, `case 7 setup @ ${viewport.name}`);
      await beginTransitionObservation(page, state);
      state.logoutDelayMs = 350;
      await logoutFromSidebar(page);
      await expectHome(page, `case 7 run ${run} @ ${viewport.name}`);
      await expectTransitionEvidence(
        page,
        state,
        HOME_PATH,
        `case 7 run ${run} @ ${viewport.name}`,
      );
      expect(state.logoutRequests, `case 7 logout API @ ${viewport.name} run ${run}`).toBe(1);
    });
  }
});

test("8. đăng xuất từ menu trên cùng ở trang sản phẩm và Trang chủ", async ({ page }) => {
  const state = await installMocks(page);
  for (const viewport of LOGOUT_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const startPath of [PRODUCT_LIST_PATH, HOME_PATH]) {
      await repeatThreeTimes(async (run) => {
        await prepareAuthenticated(page, state, startPath);
        await expectMeaningfulMain(page, `case 8 setup @ ${viewport.name} ${startPath}`);
        await beginTransitionObservation(page, state);
        state.logoutDelayMs = 350;
        await logoutFromHeader(page);
        await expectHome(page, `case 8 run ${run} @ ${viewport.name} ${startPath}`);
        await expectTransitionEvidence(
          page,
          state,
          HOME_PATH,
          `case 8 run ${run} @ ${viewport.name} ${startPath}`,
          { allowSamePathNoop: startPath === HOME_PATH, requireSkeleton: false },
        );
        expect(
          state.logoutRequests,
          `case 8 logout API @ ${viewport.name} ${startPath} run ${run}`,
        ).toBe(1);
      });
    }
  }
});

test("9. giỏ khách còn nguyên sau khi đăng nhập và khách vẫn được vào trang đặt hàng", async ({
  page,
}) => {
  const state = await installMocks(page);

  await resetSession(page, state);
  await gotoAndSettle(page, HOME_PATH, { scroll: false });
  const addResponse = await page.evaluate(async () => {
    const response = await fetch("/api/v1/cart/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: "guest-product", quantity: 1 }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(addResponse.status).toBe(200);
  expect(addResponse.body.data.items).toHaveLength(1);

  await gotoAndSettle(page, `${LOGIN_PATH}?tiep=${encodeURIComponent(CART_PATH)}`, {
    scroll: false,
  });
  await expect(page).toHaveURL(/\/dang-nhap\/\?tiep=%2Fgio-hang%2F$/);
  await submitLogin(page);
  await expect(page).toHaveURL(/\/gio-hang\/$/);
  await expect(page.locator("[data-cart-content]")).toContainText("Sản phẩm trong giỏ khách");

  await resetSession(page, state);
  state.cart = GUEST_CART;
  await gotoAndSettle(page, CHECKOUT_PATH, { scroll: false });
  await expect(page).toHaveURL(/\/dat-hang\/$/);
  await expect(page.locator("main")).toContainText(/Thông tin giao hàng|Shipping information/i);
  await expect(page.locator("[data-auth-shell]")).toHaveCount(0);
});
