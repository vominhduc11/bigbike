import { resolveLocale, type Locale } from "@/i18n/locale";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.BIGBIKE_SITE_URL?.trim() ||
  "https://bigbike.vn";

if (
  globalThis.window === undefined &&
  process.env.NODE_ENV === "production" &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(SITE_ORIGIN)
) {
  console.error(
    `[routes] SITE_ORIGIN is "${SITE_ORIGIN}" in production. Set NEXT_PUBLIC_SITE_URL or BIGBIKE_SITE_URL to the canonical domain to prevent localhost URLs in sitemap/canonical tags.`,
  );
}

function getActiveLocale(): Locale {
  if (typeof window !== "undefined") {
    return (globalThis as any).__NEXT_LOCALE__ || "vi";
  }
  return "vi";
}

export function translatePath(pathname: string, targetLocale: Locale): string {
  const cleanPath = pathname.split("?")[0];
  const search = pathname.includes("?") ? pathname.slice(pathname.indexOf("?")) : "";
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) return pathname;

  const seg0 = segments[0];
  const seg1 = segments[1];
  const remaining = segments.slice(2);

  let mapped: string[] | null = null;

  if (targetLocale === "en") {
    // VI -> EN
    if (seg0 === "gio-hang") mapped = ["cart"];
    else if (seg0 === "dat-hang") {
      if (seg1 === "order-received") mapped = ["order", "order-received", ...remaining];
      else mapped = ["order", ...remaining];
    }
    else if (seg0 === "don-hang") {
      if (seg1 === "xac-nhan") mapped = ["orders", "confirm", ...remaining];
      else mapped = ["orders", ...remaining];
    }
    else if (seg0 === "tai-khoan") {
      if (seg1 === "don-hang") mapped = ["account", "orders", ...remaining];
      else if (seg1 === "edit-account") mapped = ["account", "edit-account", ...remaining];
      else if (seg1 === "edit-address") mapped = ["account", "edit-address", ...remaining];
      else mapped = ["account", ...remaining];
    }
    else if (seg0 === "dang-nhap") mapped = ["login"];
    else if (seg0 === "dang-ky") mapped = ["register"];
    else if (seg0 === "quen-mat-khau") mapped = ["forgot-password"];
    else if (seg0 === "xac-nhan-email") mapped = ["verify-email"];
    else if (seg0 === "san-pham") mapped = ["products"];
    else if (seg0 === "lien-he") mapped = ["contact"];
    else if (seg0 === "gioi-thieu") mapped = ["about"];
    else if (seg0 === "chinh-sach") {
      mapped = ["policy"];
      if (seg1) mapped.push(seg1, ...remaining);
    }
    else if (seg0 === "huong-dan") {
      mapped = ["guide"];
      if (seg1) mapped.push(seg1, ...remaining);
    }
    else if (seg0 === "tim-kiem") mapped = ["search"];
    else if (seg0 === "danh-muc-san-pham") {
      if (segments.length === 1) mapped = ["categories"];
    }
    else if (seg0 === "tin-tuc") {
      if (segments.length === 1) mapped = ["news"];
    }
  } else {
    // EN -> VI
    if (seg0 === "cart") mapped = ["gio-hang"];
    else if (seg0 === "order") {
      if (seg1 === "order-received") mapped = ["dat-hang", "order-received", ...remaining];
      else mapped = ["dat-hang", ...remaining];
    }
    else if (seg0 === "orders") {
      if (seg1 === "confirm") mapped = ["don-hang", "xac-nhan", ...remaining];
      else mapped = ["don-hang", ...remaining];
    }
    else if (seg0 === "account") {
      if (seg1 === "orders") mapped = ["tai-khoan", "don-hang", ...remaining];
      else if (seg1 === "edit-account") mapped = ["tai-khoan", "edit-account", ...remaining];
      else if (seg1 === "edit-address") mapped = ["tai-khoan", "edit-address", ...remaining];
      else mapped = ["tai-khoan", ...remaining];
    }
    else if (seg0 === "login") mapped = ["dang-nhap"];
    else if (seg0 === "register") mapped = ["dang-ky"];
    else if (seg0 === "forgot-password") mapped = ["quen-mat-khau"];
    else if (seg0 === "verify-email") mapped = ["xac-nhan-email"];
    else if (seg0 === "products") mapped = ["san-pham"];
    else if (seg0 === "contact") mapped = ["lien-he"];
    else if (seg0 === "about") mapped = ["gioi-thieu"];
    else if (seg0 === "policy") {
      mapped = ["chinh-sach"];
      if (seg1) mapped.push(seg1, ...remaining);
    }
    else if (seg0 === "guide") {
      mapped = ["huong-dan"];
      if (seg1) mapped.push(seg1, ...remaining);
    }
    else if (seg0 === "search") mapped = ["tim-kiem"];
    else if (seg0 === "categories") mapped = ["danh-muc-san-pham", ...remaining];
    else if (seg0 === "news") mapped = ["tin-tuc", ...remaining];
  }

  if (!mapped) return pathname;

  const hasTrailingSlash = cleanPath.endsWith("/");
  return "/" + mapped.join("/") + (hasTrailingSlash ? "/" : "") + search;
}



export function toProductPath(slug: string): string {
  return `/product/${slug}/`;
}

export function toProductListPath(locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  return currentLocale === "en" ? "/products/" : "/san-pham/";
}



export function toCategoryPath(slug: string, locale?: Locale, isEnSlug?: boolean): string {
  const currentLocale = locale || getActiveLocale();
  if (currentLocale === "en" && isEnSlug) {
    return `/categories/${slug}/`;
  }
  return `/danh-muc-san-pham/${slug}/`;
}



export function toBrandPath(slug: string): string {
  return `/brands/${slug}/`;
}

export function toBrandListPath(): string {
  return "/brands/";
}

export function toArticlePath(slug: string, locale?: Locale, isEnSlug?: boolean): string {
  const currentLocale = locale || getActiveLocale();
  if (currentLocale === "en" && isEnSlug) {
    return `/news/${slug}/`;
  }
  return `/tin-tuc/${slug}/`;
}

export function toArticleListPath(locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  return currentLocale === "en" ? "/news/" : "/tin-tuc/";
}

export function toPagePath(slug: string, locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  const p = `/${slug}/`;
  return translatePath(p, currentLocale);
}

export function toHomePath(): string {
  return "/";
}

export function toCartPath(locale?: Locale): string {
  return translatePath("/gio-hang/", locale || getActiveLocale());
}

export function toCheckoutPath(locale?: Locale): string {
  return translatePath("/dat-hang/", locale || getActiveLocale());
}

export function toOrderConfirmPath(orderNumber: string, orderKey?: string, locale?: Locale): string {
  const params = new URLSearchParams({ so: orderNumber });
  if (orderKey) {
    params.set("key", orderKey);
  }
  const basePath = translatePath("/don-hang/xac-nhan/", locale || getActiveLocale());
  return `${basePath}?${params.toString()}`;
}

export function toOrderDetailPath(orderId: string, locale?: Locale): string {
  return translatePath(`/tai-khoan/don-hang/${encodeURIComponent(orderId)}/`, locale || getActiveLocale());
}

export function toLoginPath(returnTo?: string, locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  const base = translatePath("/dang-nhap/", currentLocale);
  if (returnTo) {
    const translatedReturnTo = translatePath(returnTo, currentLocale);
    return `${base}?tiep=${encodeURIComponent(translatedReturnTo)}`;
  }
  return base;
}

export function toForgotPasswordPath(token?: string, locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  const base = translatePath("/quen-mat-khau/", currentLocale);
  if (token) return `${base}?token=${encodeURIComponent(token)}`;
  return base;
}

export function toRegisterPath(locale?: Locale): string {
  return translatePath("/dang-ky/", locale || getActiveLocale());
}

export function toAccountPath(locale?: Locale): string {
  return translatePath("/tai-khoan/", locale || getActiveLocale());
}

export function toOrderHistoryPath(locale?: Locale): string {
  return translatePath("/tai-khoan/don-hang/", locale || getActiveLocale());
}

export function toCanonicalUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export function getSiteOrigin(): string {
  return SITE_ORIGIN;
}

// Auth pages that should never be used as returnTo destinations.
// Handles both /path and /path/ variants.
const AUTH_ROUTE_PATHS = [
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/xac-nhan-email",
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
] as const;

/** Returns true when pathname is an auth-specific page (login, register, etc.). */
export function isAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return (AUTH_ROUTE_PATHS as readonly string[]).includes(p);
}


