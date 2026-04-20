import type { ProductPrice } from "@/lib/contracts/public";
import { formatVnd } from "@/lib/utils/format";

type PriceTextProps = {
  price?: ProductPrice | null;
  className?: string;
};

export function PriceText({ price, className }: PriceTextProps) {
  if (!price) {
    return <p className={className ?? "bb-price"}>Lien he</p>;
  }

  const retailPrice = Number.isFinite(price.retailPrice) ? price.retailPrice : null;
  const salePrice =
    Number.isFinite(price.salePrice) && (price.salePrice ?? 0) > 0
      ? price.salePrice ?? null
      : null;
  const compareAtPrice =
    Number.isFinite(price.compareAtPrice) && (price.compareAtPrice ?? 0) > 0
      ? price.compareAtPrice ?? null
      : null;

  const primaryPrice = salePrice ?? retailPrice;

  return (
    <div className={`bb-price-wrap ${className ?? ""}`}>
      <p className="bb-price">{formatVnd(primaryPrice)}</p>
      {compareAtPrice && compareAtPrice > (primaryPrice ?? 0) ? (
        <p className="bb-price-compare">{formatVnd(compareAtPrice)}</p>
      ) : null}
    </div>
  );
}

