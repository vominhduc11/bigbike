"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { toCartPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { WpCartCount } from "./WpCartCount";

/**
 * Icon giỏ hàng ở header — client vì `toCartPath()` phải theo đúng locale hiện tại
 * của khách (`useLocale()`); `WpHeader` là Server Component luôn render "vi" tĩnh
 * (xem i18n/request.ts) nên không thể tự đổi href sang /cart/ khi khách chọn EN.
 */
export function WpCartLink({ ariaLabel }: { ariaLabel: string }) {
  const locale = useLocale() as Locale;
  return (
    <Link href={toCartPath(locale)} aria-label={ariaLabel}>
      <ShoppingCart size={22} strokeWidth={1.75} aria-hidden /> <WpCartCount />
    </Link>
  );
}
