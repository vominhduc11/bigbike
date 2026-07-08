import { describe, expect, it } from "vitest";
import {
  translatePath,
  getLocalizedRoute,
  toCategoryPath,
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
} from "../../lib/utils/routes";

describe("Route Localization Utility Tests", () => {
  describe("translatePath", () => {
    it("should translate static routes correctly from VI to EN", () => {
      expect(translatePath("/gio-hang/", "en")).toBe("/cart/");
      expect(translatePath("/dat-hang/", "en")).toBe("/order/");
      expect(translatePath("/don-hang/", "en")).toBe("/orders/");
      expect(translatePath("/don-hang/xac-nhan/", "en")).toBe("/orders/confirm/");
      expect(translatePath("/tai-khoan/", "en")).toBe("/account/");
      expect(translatePath("/tai-khoan/don-hang/", "en")).toBe("/account/orders/");
      expect(translatePath("/tai-khoan/edit-account/", "en")).toBe("/account/edit-account/");
      expect(translatePath("/dang-nhap/", "en")).toBe("/login/");
      expect(translatePath("/dang-ky/", "en")).toBe("/register/");
      expect(translatePath("/quen-mat-khau/", "en")).toBe("/forgot-password/");
      expect(translatePath("/san-pham/", "en")).toBe("/products/");
      expect(translatePath("/lien-he/", "en")).toBe("/contact/");
      expect(translatePath("/gioi-thieu/", "en")).toBe("/about/");
      expect(translatePath("/tim-kiem/", "en")).toBe("/search/");
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
      expect(translatePath("/products/", "vi")).toBe("/san-pham/");
      expect(translatePath("/contact/", "vi")).toBe("/lien-he/");
      expect(translatePath("/about/", "vi")).toBe("/gioi-thieu/");
      expect(translatePath("/search/", "vi")).toBe("/tim-kiem/");
    });

    it("should translate nested/dynamic sub-segments correctly", () => {
      expect(translatePath("/dat-hang/order-received/123-abc/", "en")).toBe("/order/order-received/123-abc/");
      expect(translatePath("/tai-khoan/don-hang/456/", "en")).toBe("/account/orders/456/");
      expect(translatePath("/tai-khoan/edit-address/billing/", "en")).toBe("/account/edit-address/billing/");
      expect(translatePath("/chinh-sach/chinh-sach-bao-hanh/", "en")).toBe("/policy/chinh-sach-bao-hanh/");
      expect(translatePath("/huong-dan/size-mu/", "en")).toBe("/guide/size-mu/");
    });

    it("should preserve original path for category detail if admin enSlug is not verified", () => {
      expect(translatePath("/danh-muc-san-pham/ao-giap-chong-nuoc/", "en")).toBe("/danh-muc-san-pham/ao-giap-chong-nuoc/");
      expect(translatePath("/tin-tuc/bai-viet-moi/", "en")).toBe("/tin-tuc/bai-viet-moi/");
    });

    it("should translate list pages for categories and news", () => {
      expect(translatePath("/danh-muc-san-pham/", "en")).toBe("/categories/");
      expect(translatePath("/tin-tuc/", "en")).toBe("/news/");
      expect(translatePath("/categories/", "vi")).toBe("/danh-muc-san-pham/");
      expect(translatePath("/news/", "vi")).toBe("/tin-tuc/");
    });
  });

  describe("getLocalizedRoute actions", () => {
    it("should redirect VI static path to EN if cookie is en", () => {
      const res = getLocalizedRoute("/gio-hang/", "en") as { action: string; url: string };
      expect(res.action).toBe("redirect");
      expect(res.url).toBe("/cart/");
    });

    it("should passthrough VI static path if cookie is vi", () => {
      const res = getLocalizedRoute("/gio-hang/", "vi");
      expect(res.action).toBe("passthrough");
    });

    it("should redirect EN static path to VI if cookie is vi", () => {
      const res = getLocalizedRoute("/cart/", "vi") as { action: string; url: string };
      expect(res.action).toBe("redirect");
      expect(res.url).toBe("/gio-hang/");
    });

    it("should rewrite EN static path to VI internally if cookie is en", () => {
      const res = getLocalizedRoute("/cart/", "en") as { action: string; url: string };
      expect(res.action).toBe("rewrite");
      expect(res.url).toBe("/gio-hang/");
    });

    it("should rewrite EN category/news paths with custom slug to VI physical paths", () => {
      const catRes = getLocalizedRoute("/categories/waterproof-armor/", "en") as { action: string; url: string };
      expect(catRes.action).toBe("rewrite");
      expect(catRes.url).toBe("/danh-muc-san-pham/waterproof-armor/");

      const newsRes = getLocalizedRoute("/news/new-article/", "en") as { action: string; url: string };
      expect(newsRes.action).toBe("rewrite");
      expect(newsRes.url).toBe("/tin-tuc/new-article/");
    });

    it("should redirect EN category/news paths to VI physical paths if cookie is vi", () => {
      const catRes = getLocalizedRoute("/categories/waterproof-armor/", "vi") as { action: string; url: string };
      expect(catRes.action).toBe("redirect");
      expect(catRes.url).toBe("/danh-muc-san-pham/waterproof-armor/");
    });

    it("should passthrough VI category/news paths even if cookie is en (since slug availability must be page-managed)", () => {
      const catRes = getLocalizedRoute("/danh-muc-san-pham/ao-giap-chong-nuoc/", "en");
      expect(catRes.action).toBe("passthrough");
    });
  });

  describe("Individual path generator functions", () => {
    it("toCategoryPath", () => {
      expect(toCategoryPath("waterproof-armor", "en", true)).toBe("/categories/waterproof-armor/");
      expect(toCategoryPath("ao-giap-chong-nuoc", "en", false)).toBe("/danh-muc-san-pham/ao-giap-chong-nuoc/");
      expect(toCategoryPath("ao-giap-chong-nuoc", "vi", false)).toBe("/danh-muc-san-pham/ao-giap-chong-nuoc/");
    });

    it("toArticlePath", () => {
      expect(toArticlePath("new-article", "en", true)).toBe("/news/new-article/");
      expect(toArticlePath("bai-viet-moi", "en", false)).toBe("/tin-tuc/bai-viet-moi/");
    });

    it("toCartPath / toCheckoutPath / Lists", () => {
      expect(toCartPath("en")).toBe("/cart/");
      expect(toCartPath("vi")).toBe("/gio-hang/");
      expect(toCheckoutPath("en")).toBe("/order/");
      expect(toProductListPath("en")).toBe("/products/");
      expect(toCategoryListPath("en")).toBe("/categories/");
      expect(toArticleListPath("en")).toBe("/news/");
    });

    // Regression coverage for the "URL không đổi sang tiếng Anh" fix: these helpers
    // are called from client components via useLocale() (WpHeaderUser, WpAccountNav,
    // LoginForm, OrderHistoryContent, OrderDetailContent...) — a caller that forgets
    // to thread the explicit locale argument silently falls back to "vi" via
    // getActiveLocale(), which is exactly the class of bug this suite guards against.
    it("toLoginPath / toRegisterPath / toForgotPasswordPath / toAccountPath honor an explicit en locale", () => {
      expect(toLoginPath(undefined, "en")).toBe("/login/");
      expect(toLoginPath(undefined, "vi")).toBe("/dang-nhap/");
      expect(toRegisterPath("en")).toBe("/register/");
      expect(toForgotPasswordPath(undefined, "en")).toBe("/forgot-password/");
      expect(toAccountPath("en")).toBe("/account/");
      expect(toAccountPath("vi")).toBe("/tai-khoan/");
    });

    it("toLoginPath translates a returnTo path into the target locale before appending it", () => {
      expect(toLoginPath("/tai-khoan/don-hang/", "en")).toBe("/login/?tiep=%2Faccount%2Forders%2F");
    });

    it("getSafeLoginHref returns a locale-correct login URL", () => {
      expect(getSafeLoginHref("/tai-khoan/don-hang/", "en")).toBe("/login/?tiep=%2Faccount%2Forders%2F");
      expect(getSafeLoginHref("/dang-nhap/", "en")).toBe("/login/");
    });

    it("toOrderHistoryPath / toOrderDetailPath / toOrderConfirmPath honor an explicit en locale", () => {
      expect(toOrderHistoryPath("en")).toBe("/account/orders/");
      expect(toOrderHistoryPath("vi")).toBe("/tai-khoan/don-hang/");
      expect(toOrderDetailPath("123", "en")).toBe("/account/orders/123/");
      expect(toOrderConfirmPath("BB1001", "abc-key", "en")).toBe("/orders/confirm/?so=BB1001&key=abc-key");
    });
  });
});
