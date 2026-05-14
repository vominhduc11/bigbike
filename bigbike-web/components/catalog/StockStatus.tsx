"use client";

import { stockStateLabel } from "@/lib/utils/format";

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

function stockBadgeColorClass(state: string): string {
  switch (state) {
    case "IN_STOCK": return "bg-[var(--bb-state-success-bg)] text-[#3d5230] border-[var(--bb-state-success-border)]";
    case "LOW_STOCK": return "bg-[var(--bb-state-warning)] text-black border-[var(--bb-state-warning)]";
    case "OUT_OF_STOCK": return "bg-[#dddddd] text-[#4a4a4a] border-[#dddddd]";
    default: return "";
  }
}

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

  return (
    <span className={`font-body text-[12px] leading-3 font-bold tracking-normal uppercase py-[3px] px-2 inline-block mt-[2px] self-start border ${stockBadgeColorClass(rawState)}`}>
      {label}
    </span>
  );
}
