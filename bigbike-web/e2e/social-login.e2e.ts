import { expect, test, type Page } from "@playwright/test";

/**
 * The form's own error banner. Scoped to `<p role="alert">` because Next.js renders its
 * route announcer with the same role, which makes a bare getByRole("alert") ambiguous.
 */
const formAlert = (page: Page) => page.locator('p[role="alert"]');

/**
 * Social login (Google / Facebook). The provider round-trip cannot run in CI, so this covers
 * the two halves that are ours: the buttons must hand off to the backend's authorize endpoint
 * carrying the return destination, and every failure code the backend can send back must
 * surface a message on the login page — for years it surfaced nothing, and customers just
 * re-clicked a button that could never work.
 */

const ERROR_CODES = [
  "oauth_cancelled",
  "oauth_unconfigured",
  "oauth_blocked",
  "oauth_failed",
  // Pre-2026-08-07 code; links in the wild may still carry it and must not render a blank page.
  "oauth",
] as const;

test.describe("social login hand-off", () => {
  test("both provider buttons point at the backend authorize endpoint", async ({ page }) => {
    await page.goto("/dang-nhap/");

    for (const provider of ["google", "facebook"]) {
      const link = page.locator(`a[href*="/oauth/${provider}/authorize"]`);
      await expect(link).toHaveCount(1);

      const href = await link.getAttribute("href");
      expect(href).toBeTruthy();
      const url = new URL(href!);
      expect(url.pathname).toBe(`/api/v1/customer/auth/oauth/${provider}/authorize`);
      // Never a raw origin IP — that was live on 2026-08-07 and made both buttons dead ends.
      expect(url.hostname).not.toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(url.searchParams.get("tiep")).toBeTruthy();
    }
  });

  test("carries the page the customer was trying to reach", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/tai-khoan/don-hang/");
    await expect(page).toHaveURL(/\/dang-nhap\//);

    // The destination is read from the query string on the client, so the server-rendered
    // href starts at the account root and is corrected on hydration.
    await expect
      .poll(async () => {
        const href = await page.locator('a[href*="/oauth/google/authorize"]').getAttribute("href");
        return new URL(href!).searchParams.get("tiep");
      })
      .toContain("/tai-khoan/don-hang/");
  });

  test("the register page offers the same hand-off", async ({ page }) => {
    await page.goto("/dang-ky/");

    await expect(page.locator('a[href*="/oauth/google/authorize"]')).toHaveCount(1);
    await expect(page.locator('a[href*="/oauth/facebook/authorize"]')).toHaveCount(1);
  });
});

test.describe("social login failures are explained", () => {
  for (const code of ERROR_CODES) {
    test(`shows a Vietnamese message for ?error=${code}`, async ({ page }) => {
      await page.goto(`/dang-nhap/?error=${code}`);

      const alert = formAlert(page);
      await expect(alert).toBeVisible();
      await expect(alert).not.toBeEmpty();
      // Vietnamese with diacritics, not a raw code leaking through.
      await expect(alert).not.toContainText(code);
      expect(await alert.innerText()).toMatch(/[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩậắằẵặẹẻẽếềểệỉịọỏốồổộớờởợụủứừửữựỳỵỷỹ]/i);
    });
  }

  test("shows an English message on the English login page", async ({ page }) => {
    await page.goto("/en/login/?error=oauth_cancelled");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const alert = formAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/cancelled/i);
  });

  test("each failure reason reads differently", async ({ page }) => {
    const messages = new Set<string>();
    for (const code of ["oauth_cancelled", "oauth_unconfigured", "oauth_blocked", "oauth_failed"]) {
      await page.goto(`/dang-nhap/?error=${code}`);
      messages.add((await formAlert(page).innerText()).trim());
    }
    expect(messages.size).toBe(4);
  });

  test("a plain login page shows no alert", async ({ page }) => {
    await page.goto("/dang-nhap/");

    await expect(formAlert(page)).toHaveCount(0);
  });

  test("the register page also explains a failed social sign-up", async ({ page }) => {
    await page.goto("/dang-ky/?error=oauth_blocked");

    await expect(formAlert(page)).toBeVisible();
  });
});
