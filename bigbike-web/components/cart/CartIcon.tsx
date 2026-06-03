"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { useCart } from "@/lib/cart-context";
import { toCartPath } from "@/lib/utils/routes";

export function CartIcon() {
  const t = useTranslations("Cart");
  const { closePanel } = useHeaderUi();
  const { cartCount } = useCart();
  const badgeCount = cartCount ?? 0;
  const showBadge = badgeCount > 0;
  const renderBadge = () =>
    showBadge ? (
      <span className="absolute top-[-8px] right-[-8px] inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 pt-0 pb-[3px] !rounded-[50%] bg-[var(--bb-action-primary)] text-white font-[family-name:var(--bb-font-body)] text-[11px] font-bold leading-none text-center max-md:top-[-6px] max-md:right-[-6px] max-md:min-w-4 max-md:h-4 max-md:pb-0 max-md:border-2 max-md:border-[var(--bb-color-black)] max-md:text-[9px] max-md:leading-[12px]">
        {badgeCount > 99 ? "99+" : badgeCount}
      </span>
    ) : null;

  return (
    <Link
      href={toCartPath()}
      className="bb-cart-icon-link relative hidden h-full items-center justify-center px-3.5 text-white no-underline transition-colors duration-fast hover:text-brand-on-dark focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-on-dark md:flex"
      aria-label={t("iconAria")}
      onClick={closePanel}
    >
      <span className="relative inline-flex">
        <ShoppingCart size={24} strokeWidth={1.75} aria-hidden />
        {renderBadge()}
      </span>
    </Link>
  );
}
