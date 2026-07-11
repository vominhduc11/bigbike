"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isCatalogOrderbyValue, productSortToOrderby } from "@/lib/utils/catalog-sort";

const SORT_OPTIONS = [
  { value: "menu_order", labelKey: "default" },
  { value: "popularity", labelKey: "popularity" },
  { value: "date", labelKey: "date" },
  { value: "price", labelKey: "priceAsc" },
  { value: "price-desc", labelKey: "priceDesc" },
] as const;

type CatalogSortSelectProps = {
  selectedValue: string;
  sortLabel: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

function CatalogSortSelect({
  selectedValue,
  sortLabel,
  disabled = false,
  onValueChange,
}: CatalogSortSelectProps) {
  const t = useTranslations("Catalog");
  return (
    <Select
      name="orderby"
      value={onValueChange ? selectedValue : undefined}
      defaultValue={onValueChange ? undefined : selectedValue}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        aria-label={sortLabel}
        className="h-[52px]! w-full rounded-none border-border px-5 text-left font-cta text-b4-action font-semibold uppercase md:min-w-[200px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map(({ value, labelKey }) => (
          <SelectItem key={value} value={value}>
            {t(`sort.${labelKey}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CatalogSortStatic({ current }: { current: string }) {
  const t = useTranslations("Catalog");
  const selectedValue = isCatalogOrderbyValue(current) ? current : productSortToOrderby(current);
  return (
    <CatalogSortSelect
      selectedValue={selectedValue}
      sortLabel={t("sortLabel")}
      disabled
    />
  );
}

function CatalogSortInner({ current }: { current: string }) {
  const t = useTranslations("Catalog");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedValue = isCatalogOrderbyValue(current) ? current : productSortToOrderby(current);

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "menu_order") params.delete("orderby");
    else params.set("orderby", value);
    params.delete("sort");
    params.delete("page");
    params.delete("paged");
    const next = params.toString();
    router.push(next ? `${window.location.pathname}?${next}` : window.location.pathname);
  }

  return (
    <CatalogSortSelect
      selectedValue={selectedValue}
      sortLabel={t("sortLabel")}
      onValueChange={handleChange}
    />
  );
}

export function CatalogSort({ current }: { current: string }) {
  return (
    <Suspense fallback={<CatalogSortStatic current={current} />}>
      <CatalogSortInner current={current} />
    </Suspense>
  );
}
