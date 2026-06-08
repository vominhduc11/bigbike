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
  const priceText = "m-0 text-ui-21 font-semibold text-black";

  if (isLoading && !fallback) {
    return (
      <div className="mb-[5px]">
        <p className={priceText} aria-hidden="true">
          &nbsp;
        </p>
      </div>
    );
  }

  const retail = data?.retailPrice ?? fallback?.retailPrice ?? 0;
  const compare = data?.compareAtPrice ?? (fallback?.compareAtPrice ?? null);
  const sale = data?.salePrice ?? (fallback?.salePrice ?? null);
  const current = sale && sale > 0 ? sale : retail;

  if (!current) {
    return (
      <div className="mb-[5px]">
        <p className={priceText}>Liên hệ</p>
      </div>
    );
  }

  const hasSale = Boolean(compare && compare > current);

  return (
    <div className="mb-[5px]">
      <p className={`js-single-price ${priceText}`}>
        {hasSale && compare ? (
          <del className="text-muted-foreground">{formatVnd(compare)}</del>
        ) : null}
        {hasSale ? (
          <ins className="block mt-[5px] no-underline">{formatVnd(current)}</ins>
        ) : (
          formatVnd(current)
        )}
      </p>
    </div>
  );
}
