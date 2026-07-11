export function safeText(value: string | null | undefined, fallback = "—"): string {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Format a VND amount as a grouped number string WITHOUT any currency suffix
 * (e.g. 1000000 -> "1.000.000"). Use where the surrounding text supplies its
 * own unit — e.g. SEO titles that append a literal " dong".
 */
export function formatVndNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
}

export function formatVnd(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (safeValue === null) {
    return "—";
  }

  // Keep the currency marker attached to its amount so it never wraps onto a
  // line by itself in compact mobile layouts.
  return formatVndNumber(safeValue) + "\u00a0đ";
}

const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PROXY = "/wp-content/uploads/";
const WP_CONTENT_PROXY = "/wp-content/";
const LEGACY_THEME_HELMET_PATH = "/wp-content/themes/bigbike/images/mu-bao-hiem.png";
const LEGACY_THEME_PAGE_TITLE_BG_PATH = "/wp-content/themes/bigbike/images/page-title-bg.png";
const CATALOG_HELMET_ASSET = "/brand/catalog/mu-bao-hiem.png";
const PAGE_TITLE_BG_ASSET = "/brand/page-title-bg.png";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";
const MEDIA_PROXY_PREFIX = "/media-proxy/";
const MEDIA_PREFIX = "/media/";
const PUBLIC_BASE_URL = "https://bigbike.vn";
const SAFE_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function resolveMediaUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.split(/[?#]/, 1)[0].endsWith(LEGACY_THEME_HELMET_PATH)) {
    return CATALOG_HELMET_ASSET;
  }
  if (url.split(/[?#]/, 1)[0].endsWith(LEGACY_THEME_PAGE_TITLE_BG_PATH)) {
    return PAGE_TITLE_BG_ASSET;
  }
  if (url.startsWith(LEGACY_CDN_PREFIX)) {
    return WP_UPLOADS_PROXY + url.slice(LEGACY_CDN_PREFIX.length);
  }
  if (url.startsWith(`${MEDIA_PROXY_PREFIX}wp-uploads/`)) {
    return WP_UPLOADS_PROXY + url.slice(`${MEDIA_PROXY_PREFIX}wp-uploads/`.length);
  }
  if (url.startsWith(MEDIA_PROXY_PREFIX)) {
    return MEDIA_PREFIX + url.slice(MEDIA_PROXY_PREFIX.length);
  }
  if (/^https?:\/\/(?:www\.)?bigbike\.vn\/wp-content\//.test(url)) {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith(WP_CONTENT_PROXY)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (url.startsWith("http") && url.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = url.indexOf(MINIO_UPLOADS_SUBPATH);
    return WP_UPLOADS_PROXY + url.slice(idx + MINIO_UPLOADS_SUBPATH.length);
  }
  return url;
}

/**
 * Keep legacy WP media on the current origin.
 *
 * Older call sites compose this as `toLegacyWpMediaUrl(resolveMediaUrl(src))`;
 * returning the normalized path avoids hotlinking `https://bigbike.vn`.
 */
export function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return resolveMediaUrl(src) ?? null;
}

function trimToNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasUnsafePrefix(value: string): boolean {
  return /^(javascript|data|vbscript|file):/i.test(value)
    || value.startsWith("//")
    || value.startsWith("\\\\")
    || value.includes("\\");
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value, PUBLIC_BASE_URL);
  } catch {
    return null;
  }
}

 export function isSafePublicHref(value: string | null | undefined): boolean {
  const normalized = trimToNull(value);
  if (!normalized || hasUnsafePrefix(normalized)) {
    return false;
  }
  if (normalized.startsWith("/")) {
    return true;
  }
  const parsed = parseUrl(normalized);
  return Boolean(parsed && parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password);
}

export function isValidVnPhone(value: string): boolean {
  return /^0[35789]\d{8}$/.test(value);
}

export function toSafePublicHref(value: string | null | undefined, fallback: string): string {
  return isSafePublicHref(value) ? (trimToNull(value) as string) : fallback;
}

export function isSafeHomeVideoUrl(value: string | null | undefined): boolean {
  const normalized = trimToNull(value);
  if (!normalized || hasUnsafePrefix(normalized)) {
    return false;
  }
  if (normalized.startsWith("/media/") || normalized.startsWith("/media-proxy/")) {
    return true;
  }
  const parsed = parseUrl(normalized);
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    return false;
  }
  if (SAFE_YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) {
    return true;
  }
  return parsed.pathname.includes("/bigbike-media/");
}

export function formatDate(value: string | null | undefined, fallback = "—"): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatAddress(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

/** Build a `tel:` href from a raw phone string, keeping only digits and "+". */
export function telHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

/**
 * Build a Zalo link from a raw value: pass through a full http(s) URL unchanged,
 * otherwise build `https://zalo.me/<digits>`; falls back to the raw value when
 * the input has no digits.
 */
export function zaloHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://zalo.me/${digits}` : value;
}

type TFn = (key: string) => string;

/** Locale-aware variant of stockStateLabel. Pass t from useTranslations("Product"). */
/** Locale-aware variant of orderStatusLabel. Pass t from useTranslations("Account.orders"). */
export function orderStatusLabelWithT(status: string | null | undefined, t: TFn): string {
  const known = ["PENDING", "ON_HOLD", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED", "FAILED"];
  if (status && known.includes(status)) return t(`orderStatus.${status}`);
  return status ?? t("orderStatus.UNKNOWN");
}

/** Locale-aware variant of paymentStatusLabel. Pass t from useTranslations("Account.orders"). */
/** Locale-aware label for fulfillment (giao hàng) status. Pass t from useTranslations("Account.orders"). */
export function fulfillmentStatusLabelWithT(status: string | null | undefined, t: TFn): string {
  const known = ["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED", "RETURNED", "CANCELLED"];
  if (status && known.includes(status)) return t(`fulfillmentStatus.${status}`);
  return status ?? t("fulfillmentStatus.UNKNOWN");
}

/** Locale-aware variant of paymentMethodLabel. Pass t from useTranslations("Checkout"). */
export function paymentMethodLabelWithT(method: string | null | undefined, t: TFn): string {
  const code = (method ?? "").trim().toUpperCase();
  switch (code) {
    case "COD": return t("paymentMethod.COD");
    case "BACS": return t("paymentMethod.BACS");
    case "": return t("paymentMethod.EMPTY");
    default: return code;
  }
}
