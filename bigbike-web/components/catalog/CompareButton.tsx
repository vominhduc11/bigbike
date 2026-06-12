"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-context";
import { useCompare } from "@/lib/compare-context";
import type { CompareProduct } from "@/lib/compare-storage";
import { cn } from "@/lib/utils";
import { CardIconButton } from "@/components/shared/CardIconButton";

type CompareButtonProps = {
  product: CompareProduct;
  /** "icon" — small round button for product cards; "full" — labelled button for the PDP. */
  variant?: "icon" | "full";
};

/** Two-arrows "compare/swap" glyph. */
function CompareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H8" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h12" />
    </svg>
  );
}

export function CompareButton({ product, variant = "icon" }: CompareButtonProps) {
  const t = useTranslations("CompareBtn");
  const { toggle, isComparing } = useCompare();
  const { showToast } = useCart();
  const active = isComparing(product.id);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggle(product);
    if (result.ok) return;
    if (result.reason === "full") {
      showToast(t("limitTitle"), t("limitMax"));
    } else {
      showToast(t("limitTitle"), t("limitType"));
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        className={cn(
          "flex flex-1 min-w-[130px] items-center justify-center gap-2 whitespace-nowrap border-2 px-4 py-3 font-body text-sm font-semibold uppercase tracking-wide transition-colors",
          active
            ? "border-brand bg-brand-soft text-brand"
            : "border-border text-foreground hover:border-brand hover:text-brand",
        )}
      >
        <CompareIcon size={16} />
        {active ? t("active") : t("inactive")}
      </button>
    );
  }

  return (
    <CardIconButton
      active={active}
      ariaLabel={active ? t("removeAria") : t("addAria")}
      top="top-[52px]"
      ariaPressed={active}
      onClick={handleClick}
    >
      <CompareIcon />
    </CardIconButton>
  );
}
