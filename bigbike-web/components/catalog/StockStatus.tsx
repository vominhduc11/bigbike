"use client";

import { stockStateLabel } from "@/lib/utils/format";
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
};

// At/under this threshold the badge swaps from generic "Còn ít" to a
// concrete "Chỉ còn N sản phẩm" message. Keeps urgency honest — if backend
// returns 18 for a LOW_STOCK product, "Chỉ còn 18" undermines urgency.
const LOW_STOCK_URGENCY_THRESHOLD = 10;

export function StockStatus({ data, fallbackState, isLoading }: StockStatusProps) {
  if (isLoading && !fallbackState) return null;

  const rawState = data?.forceOutOfStock
    ? "OUT_OF_STOCK"
    : (data?.stockState ?? fallbackState ?? "UNKNOWN");

  const baseLabel = data?.label ?? stockStateLabel(rawState);
  const qty = data?.quantity ?? null;

  // Mirror WP's `wc_get_stock_html()` "Chỉ còn N sản phẩm" copy when the
  // count is small enough to feel scarce; otherwise keep the abstract
  // "Còn ít" so big numbers don't read as plenty.
  const label =
    rawState === "LOW_STOCK" && qty != null && qty > 0 && qty <= LOW_STOCK_URGENCY_THRESHOLD
      ? `Chỉ còn ${qty} sản phẩm`
      : baseLabel;

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
