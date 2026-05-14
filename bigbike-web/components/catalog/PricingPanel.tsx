"use client";

import { formatVnd } from "@/lib/utils/format";
import type { ProductPrice } from "@/lib/contracts/public";

export type PricingData = {
  retailPrice: number;
  compareAtPrice: number | null;
  salePrice: number | null;
  discountPercent: number;
  currency: string;
};

type PricingPanelProps = {
  data: PricingData | null;
  fallback: ProductPrice | null | undefined;
  isLoading?: boolean;
};

// Renders only the inner bb-pdp-price content.
// Wrap with bb-pdp-price-row alongside StockStatus in PurchaseSectionClient.
export function PricingPanel({ data, fallback, isLoading }: PricingPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-baseline gap-3 flex-wrap min-w-0">
        <b className="text-brand font-display text-[clamp(1.4rem,5vw,2rem)] font-semibold tracking-normal opacity-40">Đang tải...</b>
      </div>
    );
  }

  const retail = data?.retailPrice ?? fallback?.retailPrice ?? 0;
  const compare = data?.compareAtPrice ?? (fallback?.compareAtPrice ?? null);
  const sale = data?.salePrice ?? (fallback?.salePrice ?? null);
  const current = sale && sale > 0 ? sale : retail;

  if (!current) {
    return (
      <div className="flex items-baseline gap-3 flex-wrap min-w-0">
        <b className="text-brand font-display text-[clamp(1.4rem,5vw,2rem)] font-semibold tracking-normal">Liên hệ</b>
      </div>
    );
  }

  const savings = compare && compare > current ? compare - current : 0;

  return (
    <div className="flex items-baseline gap-3 flex-wrap min-w-0">
      <b className="text-brand font-display text-[clamp(1.4rem,5vw,2rem)] font-semibold tracking-normal">{formatVnd(current)}</b>
      {compare && compare > current && <s className="text-[#cecece] text-base">{formatVnd(compare)}</s>}
      {savings > 0 && (
        <span className="bg-brand text-white py-1 px-[10px] font-bold text-[11px] tracking-[0.1em]">Tiết kiệm {formatVnd(savings)}</span>
      )}
    </div>
  );
}
