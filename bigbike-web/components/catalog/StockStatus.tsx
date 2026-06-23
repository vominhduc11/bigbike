"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type StockData = {
  stockState: string;
  label: string;
  forceOutOfStock: boolean;
};

type StockStatusProps = {
  data: StockData | null;
  fallbackState?: string;
  isLoading?: boolean;
  /**
   * "badge"  — black skewed parallelogram badge (legacy WP product page).
   * "inline" — coloured status dot + label, sits inline above the buy row.
   */
  variant?: "badge" | "inline";
};

export function StockStatus({
  data,
  fallbackState,
  isLoading,
  variant = "badge",
}: StockStatusProps) {
  const tProduct = useTranslations("Product");
  if (isLoading && !fallbackState) return null;

  // Boolean tồn kho: chỉ còn Còn hàng / Hết hàng. LOW_STOCK không còn phát sinh
  // (backend không emit) — gộp vào "Còn hàng", KHÔNG hiển thị số lượng.
  const rawState = data?.forceOutOfStock
    ? "OUT_OF_STOCK"
    : (data?.stockState ?? fallbackState) === "OUT_OF_STOCK"
      ? "OUT_OF_STOCK"
      : (data?.stockState ?? fallbackState)
        ? "IN_STOCK"
        : "UNKNOWN";

  const stateKey =
    rawState === "IN_STOCK" || rawState === "OUT_OF_STOCK" ? rawState : "UNKNOWN";
  // Use `||` not `??`: the selected-variant path (PurchaseSectionClient)
  // passes label: "" rather than null, and `??` would keep that empty string —
  // rendering the skewed badge with no text (an empty red block on the PDP).
  // Falling back to the i18n state label restores "Hết hàng"/"Còn hàng".
  const label = data?.label || tProduct(`stockState.${stateKey}`);

  // Inline status line — coloured dot + label (mockup buy-box style).
  if (variant === "inline") {
    const dotColor =
      rawState === "OUT_OF_STOCK"
        ? "var(--bb-state-danger)"
        : rawState === "IN_STOCK"
          ? "var(--bb-state-success)"
          : "var(--bb-text-muted)";
    const isOut = rawState === "OUT_OF_STOCK";
    return (
      <span className="inline-flex items-center gap-2 text-caption">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            rawState === "IN_STOCK" && "animate-pulse",
          )}
          style={{ background: dotColor }}
          aria-hidden="true"
        />
        <span
          className={cn(
            "font-semibold",
            isOut ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
        </span>
      </span>
    );
  }

  // Black, skewed parallelogram badge — matches the legacy WP product page.
  // The skewed background lives on the parent `.status p::after` (see
  // PurchaseSectionClient); `bb-pdp-stock-badge--out` is kept purely as a
  // marker so that parent's `has-[.bb-pdp-stock-badge--out]` flips it red.
  return (
    <span
      className={cn(
        "relative z-[1] block",
        rawState === "OUT_OF_STOCK" && "bb-pdp-stock-badge--out",
      )}
    >
      <span className="block font-cta text-ui-14 font-semibold uppercase tracking-normal !leading-[42px] text-white max-md:!leading-[38px]">
        {label}
      </span>
    </span>
  );
}
