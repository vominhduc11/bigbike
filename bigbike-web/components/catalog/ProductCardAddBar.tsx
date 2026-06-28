"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { useCart } from "@/lib/cart-context";
import { toProductPath } from "@/lib/utils/routes";

type Props = {
  productId: string;
  hasVariants: boolean;
  slug: string;
  /** Optional English URL slug — used for the "pick variant" navigation in EN mode. */
  slugEn?: string | null;
  stockState?: string | null;
};

export function ProductCardAddBar({ productId, hasVariants, slug, slugEn, stockState }: Props) {
  const t = useTranslations("Product.cardAddBar");
  const locale = useLocale();
  const { addToCart, showToast } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isOutOfStock = stockState === "OUT_OF_STOCK";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    if (hasVariants) {
      // Click-time navigation (always post-mount) → safe to localize directly.
      router.push(toProductPath(locale === "en" ? (slugEn || slug) : slug));
      return;
    }

    setBusy(true);
    addToCart(productId, 1)
      .catch(() => {
        showToast(t("addError"), t("addErrorDetail"));
      })
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      className="absolute left-0 right-0 bottom-0 bg-black text-white py-3.5 text-center font-body text-caption font-semibold tracking-display uppercase translate-y-full transition-[transform,background-color] duration-[320ms] z-[2] cursor-pointer w-full hover:bg-brand-active [@media(hover:none)]:translate-y-0 [@media(pointer:coarse)]:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
      disabled={busy || isOutOfStock}
      onClick={handleClick}
    >
      {isOutOfStock ? t("soldOut") : hasVariants ? t("pickVariant") : busy ? t("adding") : t("addToCart")}
    </button>
  );
}
