"use client";

import { useLocale } from "next-intl";
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE, type Locale } from "@/i18n/locale";

/**
 * Ngày hiển thị theo ngôn ngữ — VI giữ ĐÚNG format cũ (WP parity), EN dùng Intl en-US.
 * Client nên đổi format ngay khi đổi ngôn ngữ; render đầu (vi) khớp server → no hydration
 * mismatch. Mốc thời gian luôn quy về `Asia/Ho_Chi_Minh`.
 *
 * dateStyle:
 *  - "long"     → VI "8 Tháng 3, 2026" | EN "March 8, 2026"
 *  - "slash"    → VI "8/3/2026"        | EN "3/8/2026"     (không pad — port get_the_date j/n/Y)
 *  - "slashPad" → VI "08/03/2026"      | EN "03/08/2026"   (2 chữ số — formatDate dùng chung)
 *
 * Dùng `<LocalDate>` trong JSX; dùng `useLocalDate()` khi cần CHUỖI (vd nội suy vào câu qua t()).
 */
export type DateStyle = "long" | "slash" | "slashPad";

function viParts(date: Date): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** Format thuần — VI thủ công (parity), EN qua Intl. Dùng chung cho component + hook. */
export function formatLocalDate(
  value: string | null | undefined,
  locale: Locale,
  dateStyle: DateStyle = "slashPad",
  fallback = "",
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return fallback;

  if (locale === DEFAULT_LOCALE) {
    const { day, month, year } = viParts(date);
    if (dateStyle === "long") return `${day} Tháng ${month}, ${year}`;
    if (dateStyle === "slash") return `${day}/${month}/${year}`;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  const opts: Intl.DateTimeFormatOptions =
    dateStyle === "long"
      ? { timeZone: DEFAULT_TIME_ZONE, month: "long", day: "numeric", year: "numeric" }
      : dateStyle === "slash"
        ? { timeZone: DEFAULT_TIME_ZONE, month: "numeric", day: "numeric", year: "numeric" }
        : { timeZone: DEFAULT_TIME_ZONE, month: "2-digit", day: "2-digit", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

export function LocalDate({
  value,
  dateStyle = "slashPad",
  fallback = "",
}: {
  value: string | null | undefined;
  dateStyle?: DateStyle;
  fallback?: string;
}) {
  const locale = useLocale() as Locale;
  return <>{formatLocalDate(value, locale, dateStyle, fallback)}</>;
}

/** Trả về hàm format ngày theo locale hiện tại — cho chỗ cần CHUỖI (nội suy t(), prop string…). */
export function useLocalDate(): (value: string | null | undefined, dateStyle?: DateStyle, fallback?: string) => string {
  const locale = useLocale() as Locale;
  return (value, dateStyle = "slashPad", fallback = "") => formatLocalDate(value, locale, dateStyle, fallback);
}
