import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALES } from "./locale";

/**
 * Public URL contract. Internal pathnames follow the Vietnamese app tree; next-intl
 * exposes the localized English paths and rewrites both locales to app/[locale].
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
  // Dynamic entity alternates need slugEn-aware URLs, so metadata builds them.
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/sp": { vi: "/sp", en: "/products" },
    "/sp/[slug].html": { vi: "/sp/[slug].html", en: "/sp/[slug].html" },
    "/product/[slug]": { vi: "/product/[slug]", en: "/product/[slug]" },
    "/danh-muc/[slug]": { vi: "/danh-muc/[slug]", en: "/categories/[slug]" },
    "/brands": "/brands",
    "/brands/[slug]": "/brands/[slug]",
    "/tin-tuc": "/tin-tuc",
    "/tin-tuc/[slug]": "/tin-tuc/[slug]",
    "/gio-hang": { vi: "/gio-hang", en: "/cart" },
    "/dat-hang": { vi: "/dat-hang", en: "/order" },
    "/dat-hang/order-received/[id]": {
      vi: "/dat-hang/order-received/[id]",
      en: "/order/order-received/[id]",
    },
    "/don-hang/xac-nhan": { vi: "/don-hang/xac-nhan", en: "/orders/confirm" },
    "/tai-khoan": { vi: "/tai-khoan", en: "/account" },
    "/tai-khoan/don-hang": { vi: "/tai-khoan/don-hang", en: "/account/orders" },
    "/tai-khoan/don-hang/[id]": {
      vi: "/tai-khoan/don-hang/[id]",
      en: "/account/orders/[id]",
    },
    "/tai-khoan/edit-account": {
      vi: "/tai-khoan/edit-account",
      en: "/account/edit-account",
    },
    "/tai-khoan/edit-address/[type]": {
      vi: "/tai-khoan/edit-address/[type]",
      en: "/account/edit-address/[type]",
    },
    "/dang-nhap": { vi: "/dang-nhap", en: "/login" },
    "/dang-ky": { vi: "/dang-ky", en: "/register" },
    "/quen-mat-khau": { vi: "/quen-mat-khau", en: "/forgot-password" },
    "/xac-nhan-email": { vi: "/xac-nhan-email", en: "/verify-email" },
    "/tu-choi-thu-moi-danh-gia": {
      vi: "/tu-choi-thu-moi-danh-gia",
      en: "/review-invitations/unsubscribe",
    },
    "/tim-kiem": { vi: "/tim-kiem", en: "/search" },
    "/lien-he": { vi: "/lien-he", en: "/contact" },
    "/gioi-thieu": { vi: "/gioi-thieu", en: "/about" },
    "/chinh-sach/chinh-sach-bao-mat-thong-tin": {
      vi: "/chinh-sach/chinh-sach-bao-mat-thong-tin",
      en: "/policy/privacy-policy",
    },
    "/chinh-sach/chinh-sach-bao-hanh": {
      vi: "/chinh-sach/chinh-sach-bao-hanh",
      en: "/policy/warranty-policy",
    },
    "/chinh-sach/chinh-sach-doi-tra-hang": {
      vi: "/chinh-sach/chinh-sach-doi-tra-hang",
      en: "/policy/return-policy",
    },
    "/huong-dan": { vi: "/huong-dan", en: "/guide" },
    "/huong-dan/size-mu": { vi: "/huong-dan/size-mu", en: "/guide/helmet-size" },
    "/huong-dan/size-trang-phuc": {
      vi: "/huong-dan/size-trang-phuc",
      en: "/guide/clothing-size",
    },
    "/preview/product": "/preview/product",
    "/preview/article": "/preview/article",
  },
});
