"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";

/** Hiển thị giá trị cài đặt theo ngôn ngữ hiện tại mà không cần tải lại trang. */
export function LocalizedSetting({
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
