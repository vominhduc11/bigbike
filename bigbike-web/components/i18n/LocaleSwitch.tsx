"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";

/**
 * Đổi cả một cây nội dung tĩnh theo locale đang chọn ở client (AUD-013). Server
 * (luôn render `vi` — xem i18n/request.ts) dựng sẵn CẢ HAI nhánh vào payload; nhánh
 * `vi` là HTML canonical (khớp hydration, giữ SEO), khách chọn EN thì client hoán
 * sang nhánh `en` — không round-trip server, không phá ISR. Dùng cho trang tĩnh
 * đóng cứng (chính sách/hướng dẫn), nơi nội dung cả hai ngôn ngữ nằm sẵn trong code.
 */
export function LocaleSwitch({ vi, en }: { vi: ReactNode; en?: ReactNode }) {
  const locale = useLocale();
  return <>{locale === "en" && en ? en : vi}</>;
}
