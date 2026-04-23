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
