import { type Locale } from "@/i18n/locale";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.BIGBIKE_SITE_URL?.trim() ||
  "https://bigbike.vn";

type RouteParts = { vi: string; en: string };

const STATIC_ROUTES: RouteParts[] = [
  { vi: "/", en: "/" },
  { vi: "/sp", en: "/products" },
  { vi: "/gio-hang", en: "/cart" },
  { vi: "/dat-hang", en: "/order" },
  { vi: "/don-hang", en: "/orders" },
  { vi: "/don-hang/xac-nhan", en: "/orders/confirm" },
  { vi: "/tai-khoan", en: "/account" },
  { vi: "/tai-khoan/don-hang", en: "/account/orders" },
  { vi: "/tai-khoan/edit-account", en: "/account/edit-account" },
  { vi: "/dang-nhap", en: "/login" },
  { vi: "/dang-ky", en: "/register" },
  { vi: "/quen-mat-khau", en: "/forgot-password" },
  { vi: "/xac-nhan-email", en: "/verify-email" },
  { vi: "/tim-kiem", en: "/search" },
  { vi: "/lien-he", en: "/contact" },
  { vi: "/gioi-thieu", en: "/about" },
  { vi: "/tin-tuc", en: "/tin-tuc" },
  { vi: "/brands", en: "/brands" },
  { vi: "/chinh-sach/chinh-sach-bao-mat-thong-tin", en: "/policy/privacy-policy" },
  { vi: "/chinh-sach/chinh-sach-bao-hanh", en: "/policy/warranty-policy" },
  { vi: "/chinh-sach/chinh-sach-doi-tra-hang", en: "/policy/return-policy" },
  { vi: "/huong-dan", en: "/guide" },
  { vi: "/huong-dan/size-mu", en: "/guide/helmet-size" },
  { vi: "/huong-dan/size-trang-phuc", en: "/guide/clothing-size" },
  { vi: "/preview/product", en: "/preview/product" },
  { vi: "/preview/article", en: "/preview/article" },
];

const DYNAMIC_ROUTES: RouteParts[] = [
  { vi: "/product/", en: "/product/" },
  { vi: "/danh-muc/", en: "/categories/" },
  { vi: "/tin-tuc/", en: "/tin-tuc/" },
  { vi: "/brands/", en: "/brands/" },
  { vi: "/tai-khoan/don-hang/", en: "/account/orders/" },
  { vi: "/tai-khoan/edit-address/", en: "/account/edit-address/" },
  { vi: "/dat-hang/order-received/", en: "/order/order-received/" },
];

function getActiveLocale(): Locale {
  return "vi";
}

function splitHref(value: string) {
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  return { pathname: match?.[1] || "/", suffix: match?.[2] || "" };
}

function cleanPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return `/${pathname.split("/").filter(Boolean).join("/")}`;
}

function withTrailingSlash(pathname: string): string {
  return pathname === "/" ? pathname : `${pathname.replace(/\/+$/, "")}/`;
}

function stripLocalePrefix(pathname: string): { path: string; locale: Locale } {
  const normalized = cleanPath(pathname);
  if (normalized === "/en") return { path: "/", locale: "en" };
  if (normalized.startsWith("/en/")) {
    return { path: normalized.slice(3) || "/", locale: "en" };
  }
  if (normalized === "/vi") return { path: "/", locale: "vi" };
  if (normalized.startsWith("/vi/")) {
    return { path: normalized.slice(3) || "/", locale: "vi" };
  }
  return { path: normalized, locale: "vi" };
}

function resolveInternalPath(pathname: string): string {
  const stripped = stripLocalePrefix(pathname);
  const path = cleanPath(stripped.path);

  if (["/san-pham", "/danh-muc", "/danh-muc-san-pham", "/danh-muc-san-pham.html", "/categories"].includes(path)) {
    return "/sp";
  }

  // Compatibility aliases from the English URL contract used before 2026-08-03.
  // They are input-only: localization always emits the singular product and
  // Vietnamese `tin-tuc` segments chosen for the live migration.
  if (path === "/news") return "/tin-tuc";
  if (path.startsWith("/news/")) return `/tin-tuc${path.slice("/news".length)}`;
  if (path.startsWith("/products/")) return `/product${path.slice("/products".length)}`;

  for (const route of STATIC_ROUTES) {
    if (path === route.vi || path === route.en) return route.vi;
  }
  for (const route of DYNAMIC_ROUTES) {
    const viPrefix = route.vi.replace(/\/$/, "");
    const enPrefix = route.en.replace(/\/$/, "");
    if (path.startsWith(`${viPrefix}/`)) return `${viPrefix}${path.slice(viPrefix.length)}`;
    if (path.startsWith(`${enPrefix}/`)) return `${viPrefix}${path.slice(enPrefix.length)}`;
  }
  return path;
}

function localizeInternalPath(internalPath: string, targetLocale: Locale): string {
  const path = cleanPath(internalPath);
  let localized = path;
  for (const route of STATIC_ROUTES) {
    if (path === route.vi) {
      localized = targetLocale === "en" ? route.en : route.vi;
      break;
    }
  }
  if (localized === path) {
    for (const route of DYNAMIC_ROUTES) {
      const viPrefix = route.vi.replace(/\/$/, "");
      if (path.startsWith(`${viPrefix}/`)) {
        const targetPrefix = (targetLocale === "en" ? route.en : route.vi).replace(/\/$/, "");
        localized = `${targetPrefix}${path.slice(viPrefix.length)}`;
        break;
      }
    }
  }

  if (targetLocale === "en" && !localized.startsWith("/preview/")) {
    localized = localized === "/" ? "/en" : `/en${localized}`;
  }
  return withTrailingSlash(localized);
}

/** Translate a storefront URL while preserving query parameters and hash. */
export function translatePath(href: string, targetLocale: Locale): string {
  const { pathname, suffix } = splitHref(href);
  return `${localizeInternalPath(resolveInternalPath(pathname), targetLocale)}${suffix}`;
}

export function localizeStorefrontHref(value: string, locale: Locale): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || /^(mailto:|tel:|sms:|javascript:)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.origin !== new URL(SITE_ORIGIN).origin) return trimmed;
      parsed.pathname = translatePath(parsed.pathname, locale).split(/[?#]/)[0];
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }
  return translatePath(normalizeStorefrontUrl(trimmed), locale);
}

export function toProductPath(slug: string, locale?: Locale, _isEnSlug?: boolean): string {
  void _isEnSlug;
  return translatePath(`/product/${encodeURIComponent(slug)}/`, locale ?? getActiveLocale());
}

export function toProductListPath(locale?: Locale): string {
  return translatePath("/sp/", locale ?? getActiveLocale());
}

export function toCategoryPath(slug: string, locale?: Locale, _isEnSlug?: boolean): string {
  void _isEnSlug;
  return translatePath(`/danh-muc/${encodeURIComponent(slug)}/`, locale ?? getActiveLocale());
}

export function toBrandPath(slug: string, locale?: Locale): string {
  return translatePath(`/brands/${encodeURIComponent(slug)}/`, locale ?? getActiveLocale());
}

export function toBrandListPath(locale?: Locale): string {
  return translatePath("/brands/", locale ?? getActiveLocale());
}

export function toArticlePath(slug: string, locale?: Locale, _isEnSlug?: boolean): string {
  void _isEnSlug;
  return translatePath(`/tin-tuc/${encodeURIComponent(slug)}/`, locale ?? getActiveLocale());
}

export function toArticleListPath(locale?: Locale): string {
  return translatePath("/tin-tuc/", locale ?? getActiveLocale());
}

export function toSearchPath(locale?: Locale): string {
  return translatePath("/tim-kiem/", locale ?? getActiveLocale());
}

export function toCategoryListPath(locale?: Locale): string {
  return toProductListPath(locale);
}

export function normalizeStorefrontUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const normalizePath = (pathname: string) => {
    const clean = cleanPath(pathname);
    if (["/san-pham", "/danh-muc", "/danh-muc-san-pham", "/danh-muc-san-pham.html"].includes(clean)) {
      return "/sp/";
    }
    if (clean.startsWith("/danh-muc-san-pham/")) {
      return `/danh-muc/${clean.slice("/danh-muc-san-pham/".length)}/`;
    }
    return pathname;
  };
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      url.pathname = normalizePath(url.pathname);
      return url.toString();
    } catch {
      return trimmed;
    }
  }
  const { pathname, suffix } = splitHref(trimmed);
  return normalizePath(pathname) + suffix;
}

export function toPagePath(slug: string, locale?: Locale): string {
  return translatePath(`/${slug}/`, locale ?? getActiveLocale());
}

export function toHomePath(locale?: Locale): string {
  return translatePath("/", locale ?? getActiveLocale());
}

export function toCartPath(locale?: Locale): string {
  return translatePath("/gio-hang/", locale ?? getActiveLocale());
}

export function toCheckoutPath(locale?: Locale): string {
  return translatePath("/dat-hang/", locale ?? getActiveLocale());
}

export function toOrderConfirmPath(orderNumber: string, orderKey?: string, locale?: Locale): string {
  const params = new URLSearchParams({ so: orderNumber });
  if (orderKey) params.set("key", orderKey);
  return `${translatePath("/don-hang/xac-nhan/", locale ?? getActiveLocale())}?${params}`;
}

export function toOrderDetailPath(orderId: string, locale?: Locale): string {
  return translatePath(`/tai-khoan/don-hang/${encodeURIComponent(orderId)}/`, locale ?? getActiveLocale());
}

export function toLoginPath(returnTo?: string, locale?: Locale): string {
  const currentLocale = locale ?? getActiveLocale();
  const base = translatePath("/dang-nhap/", currentLocale);
  return returnTo ? `${base}?tiep=${encodeURIComponent(translatePath(returnTo, currentLocale))}` : base;
}

export function getSafeLoginHref(returnTo: string | undefined, locale?: Locale): string {
  if (!returnTo || isAuthRoute(returnTo)) return toLoginPath(undefined, locale);
  return toLoginPath(returnTo, locale);
}

export function toForgotPasswordPath(token?: string, locale?: Locale): string {
  const base = translatePath("/quen-mat-khau/", locale ?? getActiveLocale());
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function toRegisterPath(locale?: Locale): string {
  return translatePath("/dang-ky/", locale ?? getActiveLocale());
}

export function toAccountPath(locale?: Locale): string {
  return translatePath("/tai-khoan/", locale ?? getActiveLocale());
}

export function toOrderHistoryPath(locale?: Locale): string {
  return translatePath("/tai-khoan/don-hang/", locale ?? getActiveLocale());
}

export function toCanonicalUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export function getSiteOrigin(): string {
  return SITE_ORIGIN;
}

const AUTH_ROUTE_PATHS = new Set([
  "/dang-nhap", "/dang-ky", "/quen-mat-khau", "/xac-nhan-email",
  "/login", "/register", "/forgot-password", "/verify-email",
]);

export function isAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const internal = resolveInternalPath(splitHref(pathname).pathname).replace(/\/+$/, "");
  return AUTH_ROUTE_PATHS.has(internal);
}

export type LocalizedRouteResult =
  | { action: "redirect"; url: string }
  | { action: "rewrite"; url: string }
  | { action: "passthrough" };

/** Compatibility helper for tests and legacy callers; next-intl middleware owns rewrites. */
export function getLocalizedRoute(pathnameWithSearch: string, locale: Locale): LocalizedRouteResult {
  const target = translatePath(pathnameWithSearch, locale);
  const current = withTrailingSlash(splitHref(pathnameWithSearch).pathname) + splitHref(pathnameWithSearch).suffix;
  return target === current ? { action: "passthrough" } : { action: "redirect", url: target };
}
