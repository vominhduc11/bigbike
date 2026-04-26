export function safeText(value: string | null | undefined, fallback = "Đang cập nhật"): string {
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
    return "Liên hệ";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(safeValue) + " VND";
}

const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PROXY = "/wp-content/uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";

export function resolveMediaUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  // Legacy CDN absolute URL → same-origin proxy path
  if (url.startsWith(LEGACY_CDN_PREFIX)) {
    return WP_UPLOADS_PROXY + url.slice(LEGACY_CDN_PREFIX.length);
  }
  // MinIO/object-storage absolute URL (http://localhost:9000/bigbike-media/wp-uploads/...)
  // → same-origin proxy path so Next.js rewrite forwards to the correct CDN/MinIO instance
  if (url.startsWith("http") && url.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = url.indexOf(MINIO_UPLOADS_SUBPATH);
    return WP_UPLOADS_PROXY + url.slice(idx + MINIO_UPLOADS_SUBPATH.length);
  }
  return url;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Đang cập nhật";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Đang cập nhật";
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
      return "Sắp hết";
    case "PREORDER":
      return "Đặt trước";
    case "OUT_OF_STOCK":
      return "Hết hàng";
    case "CONTACT_FOR_STOCK":
      return "Liên hệ";
    default:
      return "Đang cập nhật";
  }
}

export function orderStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "Chờ xác nhận";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "PROCESSING":
      return "Đang xử lý";
    case "SHIPPED":
      return "Đang giao";
    case "DELIVERED":
      return "Đã giao";
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

export function paymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "Chờ thanh toán";
    case "PAID":
      return "Đã thanh toán";
    case "COD_PENDING":
      return "Thanh toán khi nhận hàng";
    case "FAILED":
      return "Thanh toán thất bại";
    case "REFUNDED":
      return "Đã hoàn tiền";
    default:
      return status ?? "Đang cập nhật";
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
