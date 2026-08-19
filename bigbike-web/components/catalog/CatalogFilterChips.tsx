"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { CatalogFacets } from "@/lib/contracts/public";
import { formatPriceDisplay, getPriceDisplayRange } from "@/lib/utils/catalog-price-filter";
import {
  countCatalogFilters,
  type CatalogFilterState,
  type CatalogFilterToken,
} from "@/lib/utils/catalog-filter-state";

type Props = {
  current: CatalogFilterState;
  facets?: CatalogFacets | null;
  onRemove: (token: CatalogFilterToken) => void;
  onClear: () => void;
  compact?: boolean;
};

export function CatalogFilterChips({ current, facets, onRemove, onClear, compact = false }: Props) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  if (countCatalogFilters(current) === 0) return null;

  const labels = new Map<string, string>();
  for (const bucket of [
    ...(facets?.brands ?? []),
    ...(facets?.colors ?? []),
    ...(facets?.finishes ?? []),
    ...(facets?.genders ?? []),
    ...((facets?.sizeGroups ?? []).flatMap((group) => group.buckets)),
  ]) labels.set(bucket.key, bucket.label);

  const tokens: { token: CatalogFilterToken; label: string }[] = [
    ...current.brand.map((value) => ({ token: { group: "brand" as const, value }, label: labels.get(value) ?? value })),
    ...current.color.map((value) => ({ token: { group: "color" as const, value }, label: labels.get(value) ?? value })),
    ...current.finish.map((value) => ({ token: { group: "finish" as const, value }, label: labels.get(value) ?? value })),
    ...current.size.map((value) => ({ token: { group: "size" as const, value }, label: labels.get(value) ?? value })),
    ...(current.gender ? [{ token: { group: "gender" as const }, label: labels.get(current.gender) ?? current.gender }] : []),
    ...(current.minPrice != null || current.maxPrice != null
      ? (() => {
          const displayRange = facets?.priceRange ? getPriceDisplayRange(facets.priceRange) : null;
          return [{
            token: { group: "price" as const },
            label: t("activePrice", {
              min: formatPriceDisplay(current.minPrice ?? displayRange?.minPrice ?? 0, locale),
              max: formatPriceDisplay(current.maxPrice ?? displayRange?.maxPrice ?? 0, locale),
            }),
          }];
        })()
      : []),
    ...(current.inStock ? [{ token: { group: "stock" as const }, label: t("inStockOnly") }] : []),
  ];

  return (
    <div className={compact ? "flex gap-2 overflow-x-auto pb-1" : "flex flex-wrap items-center gap-2"}>
      {tokens.map(({ token, label }) => (
        <Button
          key={`${token.group}:${"value" in token ? token.value : "active"}`}
          type="button"
          variant="filter"
          className="h-11 shrink-0 gap-2 rounded-none px-3 font-body text-a5-meta font-semibold normal-case tracking-normal hover:not-disabled:!scale-100"
          aria-label={t("removeFilter", { label })}
          onClick={() => onRemove(token)}
        >
          <span>{label}</span>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      ))}
      {!compact ? (
        <Button
          type="button"
          variant="link"
          className="h-11 shrink-0 rounded-none px-2 font-body text-a5-meta font-semibold normal-case tracking-normal underline"
          onClick={onClear}
        >
          {t("clearAll")}
        </Button>
      ) : null}
    </div>
  );
}
