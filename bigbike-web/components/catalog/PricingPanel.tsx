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

// Renders only the inner wp-pdp-price content.
// Wrap with wp-pdp-price-row alongside StockStatus in PurchaseSectionClient.
export function PricingPanel({ data, fallback, isLoading }: PricingPanelProps) {
  if (isLoading) {
    return (
      <div className="wp-pdp-price">
        <b style={{ opacity: 0.4 }}>Đang tải...</b>
      </div>
    );
  }

  const retail = data?.retailPrice ?? fallback?.retailPrice ?? 0;
  const compare = data?.compareAtPrice ?? (fallback?.compareAtPrice ?? null);
  const sale = data?.salePrice ?? (fallback?.salePrice ?? null);
  const current = sale && sale > 0 ? sale : retail;

  if (!current) {
    return (
      <div className="wp-pdp-price">
        <b>Liên hệ</b>
      </div>
    );
  }

  const savings = compare && compare > current ? compare - current : 0;

  return (
    <div className="wp-pdp-price">
      <b>{formatVnd(current)}</b>
      {compare && compare > current && <s>{formatVnd(compare)}</s>}
      {savings > 0 && (
        <span className="save">Tiết kiệm {formatVnd(savings)}</span>
      )}
    </div>
  );
}
