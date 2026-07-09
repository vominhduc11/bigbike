"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";

/**
 * Hiển thị 1 giá trị settings đa ngôn ngữ (vi/en), đổi ngay khi bấm nút chuyển
 * ngôn ngữ — cùng cơ chế với `WpFooterMenuLinks` (đọc `useLocale()` phía client)
 * vì server luôn fetch locale "vi" (xem `i18n/request.ts`).
 */
export function WpLocalizedSetting({
  vi,
  en,
  fallback,
}: {
  vi: string;
  en: string;
  fallback: ReactNode;
}) {
  const locale = useLocale();
  const text = locale === "en" ? en || vi : vi;
  return <>{text || fallback}</>;
}
