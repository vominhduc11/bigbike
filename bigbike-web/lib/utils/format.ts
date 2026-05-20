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

export function formatVnd(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (safeValue === null) {
    return "—";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(safeValue) + " đ";
}

const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PROXY = "/wp-content/uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";
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
  if (url.startsWith(LEGACY_CDN_PREFIX)) {
    return WP_UPLOADS_PROXY + url.slice(LEGACY_CDN_PREFIX.length);
  }
  if (/^https:\/\/(?:www\.)?bigbike\.vn\/wp-content\/uploads\//.test(url)) {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (url.startsWith("http") && url.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = url.indexOf(MINIO_UPLOADS_SUBPATH);
    return WP_UPLOADS_PROXY + url.slice(idx + MINIO_UPLOADS_SUBPATH.length);
  }
  return url;
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

export function normalizeHeading(value: string | null | undefined, fallback: string): string {
  const text = safeText(value, fallback);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function stockStateLabel(stockState: string | null | undefined): string {
  switch (stockState) {
    case "IN_STOCK":
      return "Còn hàng";
    case "LOW_STOCK":
      return "Sắp hết hàng";
    case "OUT_OF_STOCK":
      return "Hết hàng";
    default:
      return "Đang cập nhật";
  }
}

export function orderStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "Chờ xác nhận";
    case "ON_HOLD":
      return "Tạm giữ";
    case "PROCESSING":
      return "Đang xử lý";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELLED":
      return "Đã huỷ";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thất bại";
    default:
      return status ?? "Đang cập nhật";
  }
}

export function formatAddress(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

export function isValidVnPhone(phone: string): boolean {
  // Re-uses the same regex as checkoutAddressSchema (supports both local 0x and +84x forms)
  return /^(0[3-9][0-9]{8}|\+84[3-9][0-9]{8})$/.test(phone.trim());
}

export function paymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "UNPAID":
      return "Chưa thanh toán";
    case "PAID":
      return "Đã thanh toán";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "CANCELLED":
      return "Đã huỷ thanh toán";
    default:
      return status ?? "Đang cập nhật";
  }
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const code = (method ?? "").trim().toUpperCase();
  switch (code) {
    case "COD":
      return "Thanh toán khi nhận hàng (COD)";
    case "BACS":
      return "Chuyển khoản";
    case "":
      return "—";
    default:
      return code;
  }
}

export function customerStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "ACTIVE":
      return "Đang hoạt động";
    case "INACTIVE":
      return "Tạm ngừng";
    case "BANNED":
      return "Bị khoá";
    default:
      return status ?? "Đang cập nhật";
  }
}

type TFn = (key: string) => string;

/** Locale-aware variant of stockStateLabel. Pass t from useTranslations("Product"). */
export function stockStateLabelWithT(stockState: string | null | undefined, t: TFn): string {
  switch (stockState) {
    case "IN_STOCK": return t("stockState.IN_STOCK");
    case "LOW_STOCK": return t("stockState.LOW_STOCK");
    case "OUT_OF_STOCK": return t("stockState.OUT_OF_STOCK");
    default: return t("stockState.UNKNOWN");
  }
}

/** Locale-aware variant of orderStatusLabel. Pass t from useTranslations("Account.orders"). */
export function orderStatusLabelWithT(status: string | null | undefined, t: TFn): string {
  const known = ["PENDING", "ON_HOLD", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED", "FAILED"];
  if (status && known.includes(status)) return t(`orderStatus.${status}`);
  return status ?? t("orderStatus.UNKNOWN");
}

/** Locale-aware variant of paymentStatusLabel. Pass t from useTranslations("Account.orders"). */
export function paymentStatusLabelWithT(status: string | null | undefined, t: TFn): string {
  const known = ["UNPAID", "PAID", "REFUNDED", "CANCELLED"];
  if (status && known.includes(status)) return t(`paymentStatus.${status}`);
  return status ?? t("paymentStatus.UNKNOWN");
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
