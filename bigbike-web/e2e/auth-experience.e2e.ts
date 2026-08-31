import { expect, test } from "@playwright/test";
import { expectNoRenderedHorizontalOverflow, gotoAndSettle } from "./helpers/ui-quality";

const LOCALES = [
  {
    name: "Tiếng Việt",
    login: "/dang-nhap/",
    register: "/dang-ky/",
    loginSocial: "Đăng nhập bằng Google",
    registerSocial: "Đăng ký bằng Facebook",
    emailRequired: "Vui lòng nhập email",
    consentRequired: "Vui lòng đồng ý với Chính sách bảo mật",
    showPassword: "Hiện mật khẩu",
    privacyText: "Chính sách bảo mật",
  },
  {
    name: "English",
    login: "/en/login/",
    register: "/en/register/",
    loginSocial: "Sign in with Google",
    registerSocial: "Sign up with Facebook",
    emailRequired: "Please enter your email address",
    consentRequired: "Please agree to the Privacy Policy",
    showPassword: "Show password",
    privacyText: "Privacy Policy",
  },
] as const;

for (const locale of LOCALES) {
  test(`${locale.name}: desktop login uses the white auth shell with a focused form`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndSettle(page, locale.login);

    await expect(page.locator("[data-auth-shell]")).toHaveCount(1);
    await expect(page.locator("header[data-auth-header], footer[data-auth-footer]")).toHaveCount(0);
    await expect(page.locator('[data-auth-page="login"]')).toBeVisible();
    await expect(page.locator("[data-auth-brand-panel]")).toBeVisible();
    await expect(page.locator("header[data-bb-header]")).toHaveCount(0);
    await expect(page.locator("nav.bb-bottom-nav")).toHaveCount(0);
    await expect(page.locator(".bb-floating-chat-anchor, .bb-scroll-top-anchor")).toHaveCount(0);
    await expect(page.locator("[data-auth-order-lookup]")).toBeVisible();
    await expect(page.getByRole("link", { name: locale.loginSocial })).toBeVisible();
    await expect(page.locator("[data-auth-guest-exit]")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("login-username");
  });

  test(`${locale.name}: mobile register validates early and keeps controls unobstructed`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, locale.register);

    await expect(page.locator("[data-auth-brand-panel]")).toBeHidden();
    await expect(page.locator(".bb-floating-chat-anchor, .bb-scroll-top-anchor")).toHaveCount(0);
    await expect(page.locator("header[data-bb-header], nav.bb-bottom-nav")).toHaveCount(0);
    await expect(page.locator("#reg-fullName")).not.toBeFocused();

    const email = page.locator("#reg-email");
    await email.focus();
    await page.locator("#reg-phone").focus();
    await expect(page.getByText(locale.emailRequired)).toBeVisible();

    const privacyLink = page
      .locator("#reg-privacy-consent-label")
      .getByRole("link", { name: locale.privacyText, exact: true });
    await privacyLink.click();
    await expect(page).toHaveURL(/chinh-sach-bao-mat-thong-tin|privacy-policy/);
    await gotoAndSettle(page, locale.register);

    const privacy = page.getByRole("checkbox", { name: new RegExp(locale.privacyText, "i") });
    await expect(privacy).toBeVisible();
    const facebook = page.getByRole("link", { name: locale.registerSocial });
    await facebook.click();
    await expect(page.getByText(locale.consentRequired)).toBeVisible();

    await privacy.click();
    await expect(facebook).toHaveAttribute("href", /privacyConsent=true/);

    const password = page.locator("#reg-password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: locale.showPassword }).first().click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.locator("[data-password-strength]")).toHaveAttribute(
      "data-password-strength",
      "empty",
    );

    const signInLink = page.getByRole("link", {
      name: /đăng nhập tài khoản hiện có|sign in to an existing account/i,
    });
    const signInBox = await signInLink.boundingBox();
    expect(signInBox?.height).toBeGreaterThanOrEqual(44);
    const submit = page.locator('[data-auth-page="register"] form button[type="submit"]:visible');
    await expect(submit).toHaveCount(1);
    expect(await submit.evaluate((element) => getComputedStyle(element).position)).toBe("static");
    await expect(page.locator("[data-auth-guest-exit]")).toBeVisible();
    await expectNoRenderedHorizontalOverflow(page, `${locale.name} register mobile`);
  });
}
