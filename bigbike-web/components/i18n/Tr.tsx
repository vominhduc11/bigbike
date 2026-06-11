"use client";

import { useTranslations } from "next-intl";

/**
 * Chuỗi dịch nhỏ dùng được TRONG server component — bọc một nhãn cố định (marketing
 * heading…) để nó đổi ngôn ngữ ở client mà không phải chuyển cả trang sang "use client".
 * Server vẫn render `vi` (khớp SEO/ISR); next-intl swap sang EN sau khi đổi locale.
 */
export function Tr({ ns, k }: { ns: string; k: string }) {
  const t = useTranslations(ns);
  return <>{t(k)}</>;
}
