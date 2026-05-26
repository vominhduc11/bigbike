"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { useCart } from "@/lib/cart-context";
import { toCartPath } from "@/lib/utils/routes";

export function CartIcon() {
  const t = useTranslations("Cart");
  const { closePanel, openPanel } = useHeaderUi();
  const { cartCount } = useCart();
  const badgeCount = cartCount ?? 0;
  const showBadge = badgeCount > 0;
  const renderBadge = () =>
    showBadge ? (
      <span className="bb-cart-badge">
        {badgeCount > 99 ? "99+" : badgeCount}
      </span>
    ) : null;

  return (
    <>
      <button
        type="button"
        className="bb-cart-icon-link bb-cart-icon-button relative hidden h-full items-center justify-center px-3.5 text-white no-underline transition-colors duration-fast hover:text-brand-on-dark focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-on-dark"
        aria-label={t("iconAria")}
        onClick={() => openPanel("cart")}
      >
        <ShoppingCart size={24} strokeWidth={1.75} aria-hidden />
        {renderBadge()}
      </button>
      <Link
        href={toCartPath()}
        className="bb-cart-icon-link relative hidden h-full items-center justify-center px-3.5 text-white no-underline transition-colors duration-fast hover:text-brand-on-dark focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-on-dark md:flex"
        aria-label={t("iconAria")}
        onClick={closePanel}
      >
        <ShoppingCart size={24} strokeWidth={1.75} aria-hidden />
        {renderBadge()}
      </Link>
    </>
  );
}
