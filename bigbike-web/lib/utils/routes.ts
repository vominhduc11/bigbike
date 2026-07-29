import { type Locale } from "@/i18n/locale";

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
    return (globalThis.__NEXT_LOCALE__ as Locale) || "vi";
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
    else if (seg0 === "sp" || seg0 === "san-pham") mapped = ["products"];
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
    else if (seg0 === "danh-muc" || seg0 === "danh-muc-san-pham") {
      if (segments.length === 1) mapped = ["products"];
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
    else if (seg0 === "products") {
      // Only the bare list path is an alias for the VI list page — /products/{slug}/
      // is now a real EN product detail route (app/products/[slug]/page.tsx) and
      // must not be rewritten/redirected away.
      if (segments.length === 1) mapped = ["sp"];
    }
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
    else if (seg0 === "categories") {
      // Same reasoning: /categories/{slug}/ is now a real EN category detail route.
      // The bare category archive shares the canonical product listing.
      if (segments.length === 1) mapped = ["sp"];
    }
    else if (seg0 === "news") {
      // Same reasoning: /news/{slug}/ is now a real EN article detail route.
      if (segments.length === 1) mapped = ["tin-tuc"];
    }
  }

  if (!mapped) return pathname;

  const hasTrailingSlash = cleanPath.endsWith("/");
  return "/" + mapped.join("/") + (hasTrailingSlash ? "/" : "") + search;
}



export function toProductPath(slug: string, locale?: Locale, isEnSlug?: boolean): string {
  const currentLocale = locale || getActiveLocale();
  if (currentLocale === "en" && isEnSlug) {
    return `/products/${slug}/`;
  }
  return `/product/${slug}/`;
}

export function toProductListPath(locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  return currentLocale === "en" ? "/products/" : "/sp/";
}



export function toCategoryPath(slug: string, locale?: Locale, isEnSlug?: boolean): string {
  const currentLocale = locale || getActiveLocale();
  if (currentLocale === "en" && isEnSlug) {
    return `/categories/${slug}/`;
  }
  return `/danh-muc/${slug}/`;
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

export function toCategoryListPath(locale?: Locale): string {
  return toProductListPath(locale);
}

/**
 * Normalizes storefront URLs that may come from persisted admin content.
 * Redirect sources keep the legacy values; generated links and canonical URLs do not.
 */
export function normalizeStorefrontUrl(value: string): string {
  const normalizePath = (pathname: string): string => {
    const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

    if (
      withoutTrailingSlash === "/san-pham" ||
      withoutTrailingSlash === "/danh-muc" ||
      withoutTrailingSlash === "/danh-muc-san-pham" ||
      withoutTrailingSlash === "/danh-muc-san-pham.html"
    ) {
      return "/sp/";
    }

    const legacyCategoryPrefix = "/danh-muc-san-pham/";
    if (withoutTrailingSlash.startsWith(legacyCategoryPrefix)) {
      const slug = withoutTrailingSlash.slice(legacyCategoryPrefix.length);
      return slug ? `/danh-muc/${slug}/` : "/sp/";
    }

    return pathname;
  };

  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = normalizePath(parsed.pathname);
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  const suffixIndexes = [trimmed.indexOf("?"), trimmed.indexOf("#")].filter(
    (index) => index >= 0,
  );
  const suffixIndex = suffixIndexes.length > 0 ? Math.min(...suffixIndexes) : trimmed.length;
  const pathname = trimmed.slice(0, suffixIndex);
  const suffix = trimmed.slice(suffixIndex);
  return normalizePath(pathname) + suffix;
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

/**
 * Like toLoginPath but skips appending the returnTo when it is itself
 * an auth page (login, register, etc.) — prevents auth → auth redirect loops.
 */
export function getSafeLoginHref(returnTo: string | undefined, locale?: Locale): string {
  const currentLocale = locale || getActiveLocale();
  const base = translatePath("/dang-nhap/", currentLocale);
  if (!returnTo || isAuthRoute(returnTo)) {
    return base;
  }
  const translatedReturnTo = translatePath(returnTo, currentLocale);
  return `${base}?tiep=${encodeURIComponent(translatedReturnTo)}`;
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

type LocalizedRouteResult =
  | { action: "redirect"; url: string }
  | { action: "rewrite"; url: string }
  | { action: "passthrough" };

/**
 * Determines what the proxy/middleware should do with a given request path.
 *
 * - "redirect":   Browser should navigate to `url` (307).
 * - "rewrite":    Serve content from `url` transparently (URL bar unchanged).
 *                 Used when EN display paths (e.g. /cart/) map to VI physical
 *                 files (e.g. /gio-hang/) in the Next.js app directory.
 * - "passthrough": No action needed.
 */
export function getLocalizedRoute(
  pathnameWithSearch: string,
  locale: Locale,
): LocalizedRouteResult {
  const qIdx = pathnameWithSearch.indexOf("?");
  const search = qIdx >= 0 ? pathnameWithSearch.slice(qIdx) : "";
  const pathname = qIdx >= 0 ? pathnameWithSearch.slice(0, qIdx) : pathnameWithSearch;

  if (locale === "en") {
    // Is this an EN display URL that has a VI physical equivalent?
    // (e.g. /cart/ → /gio-hang/). True EN entity routes pass through unchanged.
    const viEquivalent = translatePath(pathname, "vi");
    if (viEquivalent !== pathname) {
      // Rewrite: serve the VI physical file while keeping the EN URL in the browser.
      return { action: "rewrite", url: viEquivalent + search };
    }
    // Is this a VI path that should be displayed as EN?
    // (e.g. /gio-hang/ when locale is EN → redirect to /cart/)
    const enEquivalent = translatePath(pathname, "en");
    if (enEquivalent !== pathname) {
      return { action: "redirect", url: enEquivalent + search };
    }
    return { action: "passthrough" };
  } else {
    // VI locale: any EN display path should redirect to its VI equivalent.
    const viEquivalent = translatePath(pathname, "vi");
    if (viEquivalent !== pathname) {
      return { action: "redirect", url: viEquivalent + search };
    }
    return { action: "passthrough" };
  }
}


