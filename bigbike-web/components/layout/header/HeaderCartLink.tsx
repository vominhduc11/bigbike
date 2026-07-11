"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

import { HeaderCartCount } from "@/components/layout/header/HeaderCartCount";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { toCartPath } from "@/lib/utils/routes";
import { iconBtn } from "@/lib/ui-classes";

export function HeaderCartLink({ ariaLabel }: { ariaLabel: string }) {
  const locale = useLocale() as Locale;
  return (
    <Link
      href={toCartPath(locale)}
      aria-label={ariaLabel}
      className={cn(iconBtn, "relative h-[80px]! min-h-[80px]! px-[20px]!")}
    >
      <ShoppingCart size={18} strokeWidth={1.75} aria-hidden />
      <HeaderCartCount />
    </Link>
  );
}
