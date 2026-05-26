"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type StockData = {
  stockState: string;
  label: string;
  forceOutOfStock: boolean;
  /** On-hand count when tracked; null/undefined when not exposed by API. */
  quantity?: number | null;
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

// At/under this threshold the badge swaps from generic "Còn ít" to a
// concrete "Chỉ còn N sản phẩm" message. Keeps urgency honest — if backend
// returns 18 for a LOW_STOCK product, "Chỉ còn 18" undermines urgency.
const LOW_STOCK_URGENCY_THRESHOLD = 10;

export function StockStatus({
  data,
  fallbackState,
  isLoading,
  variant = "badge",
}: StockStatusProps) {
  const tProduct = useTranslations("Product");
  if (isLoading && !fallbackState) return null;

  const rawState = data?.forceOutOfStock
    ? "OUT_OF_STOCK"
    : (data?.stockState ?? fallbackState ?? "UNKNOWN");

  const stateKey =
    rawState === "IN_STOCK" || rawState === "LOW_STOCK" || rawState === "OUT_OF_STOCK"
      ? rawState
      : "UNKNOWN";
  const baseLabel = data?.label ?? tProduct(`stockState.${stateKey}`);
  const qty = data?.quantity ?? null;

  // Mirror WP's `wc_get_stock_html()` "Chỉ còn N sản phẩm" copy when the
  // count is small enough to feel scarce; otherwise keep the abstract
  // "Còn ít" so big numbers don't read as plenty.
  const label =
    rawState === "LOW_STOCK" && qty != null && qty > 0 && qty <= LOW_STOCK_URGENCY_THRESHOLD
      ? tProduct("lowStockRemaining", { count: qty })
      : baseLabel;

  // Inline status line — coloured dot + label (mockup buy-box style).
  if (variant === "inline") {
    const dotColor =
      rawState === "OUT_OF_STOCK"
        ? "var(--bb-brand-primary)"
        : rawState === "LOW_STOCK"
          ? "var(--bb-state-warning-text)"
          : rawState === "IN_STOCK"
            ? "var(--bb-state-success)"
            : "var(--bb-text-muted)";
    const isOut = rawState === "OUT_OF_STOCK";
    return (
      <span className="inline-flex items-center gap-2 text-sm">
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
  return (
    <span
      className={cn(
        "bb-pdp-stock-badge",
        rawState === "OUT_OF_STOCK" && "bb-pdp-stock-badge--out",
      )}
    >
      <span className="bb-pdp-stock-badge-label">{label}</span>
    </span>
  );
}
