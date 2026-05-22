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

export function PricingPanel({ data, fallback, isLoading }: PricingPanelProps) {
  if (isLoading) {
    return (
      <div className="price">
        <p>Đang tải...</p>
      </div>
    );
  }

  const retail = data?.retailPrice ?? fallback?.retailPrice ?? 0;
  const compare = data?.compareAtPrice ?? (fallback?.compareAtPrice ?? null);
  const sale = data?.salePrice ?? (fallback?.salePrice ?? null);
  const current = sale && sale > 0 ? sale : retail;

  if (!current) {
    return (
      <div className="price">
        <p>Liên hệ</p>
      </div>
    );
  }

  const hasSale = Boolean(compare && compare > current);

  return (
    <div className="price">
      <p className="price js-single-price">
        {hasSale && compare ? <del>{formatVnd(compare)}</del> : null}
        {hasSale ? <ins>{formatVnd(current)}</ins> : formatVnd(current)}
      </p>
    </div>
  );
}
