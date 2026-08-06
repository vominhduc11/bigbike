import { describe, expect, it } from "vitest";
import {
  translatePath,
  getLocalizedRoute,
  toCategoryPath,
  toProductPath,
  toArticlePath,
  toCartPath,
  toCheckoutPath,
  toProductListPath,
  toCategoryListPath,
  toArticleListPath,
  toLoginPath,
  toRegisterPath,
  toForgotPasswordPath,
  toAccountPath,
  toOrderHistoryPath,
  toOrderDetailPath,
  toOrderConfirmPath,
  getSafeLoginHref,
  normalizeStorefrontUrl,
} from "../../lib/utils/routes";

describe("Route Localization Utility Tests", () => {
  describe("translatePath", () => {
    it("should translate static routes correctly from VI to EN", () => {
      expect(translatePath("/gio-hang/", "en")).toBe("/en/cart/");
      expect(translatePath("/dat-hang/", "en")).toBe("/en/order/");
      expect(translatePath("/don-hang/", "en")).toBe("/en/orders/");
      expect(translatePath("/don-hang/xac-nhan/", "en")).toBe("/en/orders/confirm/");
      expect(translatePath("/tai-khoan/", "en")).toBe("/en/account/");
      expect(translatePath("/tai-khoan/don-hang/", "en")).toBe("/en/account/orders/");
      expect(translatePath("/tai-khoan/edit-account/", "en")).toBe("/en/account/edit-account/");
      expect(translatePath("/dang-nhap/", "en")).toBe("/en/login/");
      expect(translatePath("/dang-ky/", "en")).toBe("/en/register/");
      expect(translatePath("/quen-mat-khau/", "en")).toBe("/en/forgot-password/");
      expect(translatePath("/sp/", "en")).toBe("/en/products/");
      expect(translatePath("/san-pham/", "en")).toBe("/en/products/");
      expect(translatePath("/lien-he/", "en")).toBe("/en/contact/");
      expect(translatePath("/gioi-thieu/", "en")).toBe("/en/about/");
      expect(translatePath("/tim-kiem/", "en")).toBe("/en/search/");
    });

    it("should translate static routes correctly from EN to VI", () => {
      expect(translatePath("/cart/", "vi")).toBe("/gio-hang/");
      expect(translatePath("/order/", "vi")).toBe("/dat-hang/");
      expect(translatePath("/orders/", "vi")).toBe("/don-hang/");
      expect(translatePath("/orders/confirm/", "vi")).toBe("/don-hang/xac-nhan/");
      expect(translatePath("/account/", "vi")).toBe("/tai-khoan/");
      expect(translatePath("/account/orders/", "vi")).toBe("/tai-khoan/don-hang/");
      expect(translatePath("/account/edit-account/", "vi")).toBe("/tai-khoan/edit-account/");
      expect(translatePath("/login/", "vi")).toBe("/dang-nhap/");
      expect(translatePath("/register/", "vi")).toBe("/dang-ky/");
      expect(translatePath("/forgot-password/", "vi")).toBe("/quen-mat-khau/");
      expect(translatePath("/products/", "vi")).toBe("/sp/");
      expect(translatePath("/contact/", "vi")).toBe("/lien-he/");
      expect(translatePath("/about/", "vi")).toBe("/gioi-thieu/");
      expect(translatePath("/search/", "vi")).toBe("/tim-kiem/");
    });

    it("should translate nested/dynamic sub-segments correctly", () => {
      expect(translatePath("/dat-hang/order-received/123-abc/", "en")).toBe("/en/order/order-received/123-abc/");
      expect(translatePath("/tai-khoan/don-hang/456/", "en")).toBe("/en/account/orders/456/");
      expect(translatePath("/tai-khoan/edit-address/billing/", "en")).toBe("/en/account/edit-address/billing/");
      expect(translatePath("/chinh-sach/chinh-sach-bao-hanh/", "en")).toBe("/en/policy/warranty-policy/");
      expect(translatePath("/huong-dan/size-mu/", "en")).toBe("/en/guide/helmet-size/");
    });

    it("keeps the Vietnamese slug as an English fallback when slugEn is missing", () => {
      expect(translatePath("/danh-muc/ao-giap-chong-nuoc/", "en")).toBe("/en/categories/ao-giap-chong-nuoc/");
      expect(translatePath("/tin-tuc/bai-viet-moi/", "en")).toBe("/en/tin-tuc/bai-viet-moi/");
    });

    it("should translate list pages for categories and news", () => {
      expect(translatePath("/danh-muc/", "en")).toBe("/en/products/");
      expect(translatePath("/tin-tuc/", "en")).toBe("/en/tin-tuc/");
      expect(translatePath("/categories/", "vi")).toBe("/sp/");
      expect(translatePath("/news/", "vi")).toBe("/tin-tuc/");
    });

    it("normalizes /vi and preserves query strings and hashes", () => {
      expect(translatePath("/vi/gio-hang/?coupon=BB#summary", "vi")).toBe(
        "/gio-hang/?coupon=BB#summary",
      );
      expect(translatePath("/sp/?page=2#products", "en")).toBe(
        "/en/products/?page=2#products",
      );
      expect(translatePath("/en/products/?page=2#products", "vi")).toBe(
        "/sp/?page=2#products",
      );
    });
  });

  describe("getLocalizedRoute compatibility actions", () => {
    it("redirects to an explicit English URL without relying on a cookie", () => {
      const res = getLocalizedRoute("/gio-hang/", "en") as { action: string; url: string };
      expect(res.action).toBe("redirect");
      expect(res.url).toBe("/en/cart/");
    });

    it("should passthrough VI static path if cookie is vi", () => {
      const res = getLocalizedRoute("/gio-hang/", "vi");
      expect(res.action).toBe("passthrough");
    });

    it("redirects an English-prefixed path to Vietnamese", () => {
      const res = getLocalizedRoute("/en/cart/", "vi") as { action: string; url: string };
      expect(res.action).toBe("redirect");
      expect(res.url).toBe("/gio-hang/");
    });

    it("passes through a canonical English URL", () => {
      expect(getLocalizedRoute("/en/cart/", "en").action).toBe("passthrough");
    });

    it("should passthrough true EN category and news paths", () => {
      const catRes = getLocalizedRoute("/en/categories/waterproof-armor/", "en");
      expect(catRes.action).toBe("passthrough");

      const newsRes = getLocalizedRoute("/en/tin-tuc/new-article/", "en");
      expect(newsRes.action).toBe("passthrough");
    });

    it("redirects a VI detail path to its same-slug English fallback", () => {
      const catRes = getLocalizedRoute("/danh-muc/ao-giap-chong-nuoc/", "en");
      expect(catRes).toEqual({ action: "redirect", url: "/en/categories/ao-giap-chong-nuoc/" });
    });
  });

  describe("Individual path generator functions", () => {
    it("toCategoryPath", () => {
      expect(toCategoryPath("waterproof-armor", "en", true)).toBe("/en/categories/waterproof-armor/");
      expect(toCategoryPath("ao-giap-chong-nuoc", "en", false)).toBe("/en/categories/ao-giap-chong-nuoc/");
      expect(toCategoryPath("ao-giap-chong-nuoc", "vi", false)).toBe("/danh-muc/ao-giap-chong-nuoc/");
    });

    it("toArticlePath", () => {
      expect(toArticlePath("new-article", "en", true)).toBe("/en/tin-tuc/new-article/");
      expect(toArticlePath("bai-viet-moi", "en", false)).toBe("/en/tin-tuc/bai-viet-moi/");
    });

    it("toProductPath keeps the English detail route singular", () => {
      expect(toProductPath("helmet", "en")).toBe("/en/product/helmet/");
    });

    it("toCartPath / toCheckoutPath / Lists", () => {
      expect(toCartPath("en")).toBe("/en/cart/");
      expect(toCartPath("vi")).toBe("/gio-hang/");
      expect(toCheckoutPath("en")).toBe("/en/order/");
      expect(toProductListPath("en")).toBe("/en/products/");
      expect(toProductListPath("vi")).toBe("/sp/");
      expect(toCategoryListPath("en")).toBe("/en/products/");
      expect(toCategoryListPath("vi")).toBe("/sp/");
      expect(toArticleListPath("en")).toBe("/en/tin-tuc/");
    });

    it("normalizes persisted legacy storefront URLs without dropping query strings", () => {
      expect(normalizeStorefrontUrl("/danh-muc-san-pham/non-bao-hiem-moto/?page=2")).toBe(
        "/danh-muc/non-bao-hiem-moto/?page=2",
      );
      expect(normalizeStorefrontUrl("/danh-muc-san-pham.html")).toBe("/sp/");
      expect(normalizeStorefrontUrl("/san-pham/#filters")).toBe("/sp/#filters");
      expect(
        normalizeStorefrontUrl(
          "https://bigbike.vn/danh-muc-san-pham/non-bao-hiem-moto/?page=2",
        ),
      ).toBe("https://bigbike.vn/danh-muc/non-bao-hiem-moto/?page=2");
    });

    // Regression coverage for the "URL không đổi sang tiếng Anh" fix: these helpers
    // are called from client components via useLocale() (WpHeaderUser, WpAccountNav,
    // LoginForm, OrderHistoryContent, OrderDetailContent...) — a caller that forgets
    // to thread the explicit locale argument silently falls back to "vi" via
    // getActiveLocale(), which is exactly the class of bug this suite guards against.
    it("toLoginPath / toRegisterPath / toForgotPasswordPath / toAccountPath honor an explicit en locale", () => {
      expect(toLoginPath(undefined, "en")).toBe("/en/login/");
      expect(toLoginPath(undefined, "vi")).toBe("/dang-nhap/");
      expect(toRegisterPath("en")).toBe("/en/register/");
      expect(toForgotPasswordPath(undefined, "en")).toBe("/en/forgot-password/");
      expect(toAccountPath("en")).toBe("/en/account/");
      expect(toAccountPath("vi")).toBe("/tai-khoan/");
    });

    it("toLoginPath translates a returnTo path into the target locale before appending it", () => {
      expect(toLoginPath("/tai-khoan/don-hang/", "en")).toBe("/en/login/?tiep=%2Fen%2Faccount%2Forders%2F");
    });

    it("getSafeLoginHref returns a locale-correct login URL", () => {
      expect(getSafeLoginHref("/tai-khoan/don-hang/", "en")).toBe("/en/login/?tiep=%2Fen%2Faccount%2Forders%2F");
      expect(getSafeLoginHref("/dang-nhap/", "en")).toBe("/en/login/");
    });

    it("toOrderHistoryPath / toOrderDetailPath / toOrderConfirmPath honor an explicit en locale", () => {
      expect(toOrderHistoryPath("en")).toBe("/en/account/orders/");
      expect(toOrderHistoryPath("vi")).toBe("/tai-khoan/don-hang/");
      expect(toOrderDetailPath("123", "en")).toBe("/en/account/orders/123/");
      expect(toOrderConfirmPath("BB1001", "abc-key", "en")).toBe("/en/orders/confirm/?so=BB1001&key=abc-key");
    });
  });
});
