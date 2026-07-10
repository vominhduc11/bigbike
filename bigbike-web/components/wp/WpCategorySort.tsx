"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isWpOrderbyValue, productSortToWpOrderby } from "@/lib/utils/catalog-sort";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * WooCommerce catalog ordering shell keeps the legacy form wrapper while using
 * the shared Radix/shadcn select for tokenized focus and keyboard behavior.
 */
const SORT_OPTIONS = [
  { value: "menu_order", labelKey: "default" },
  { value: "popularity", labelKey: "popularity" },
  { value: "date", labelKey: "date" },
  { value: "price", labelKey: "priceAsc" },
  { value: "price-desc", labelKey: "priceDesc" },
] as const;

export function WpCategorySort({ current }: { current: string }) {
  const t = useTranslations("Catalog");
  const selectedValue = isWpOrderbyValue(current) ? current : productSortToWpOrderby(current);

  return (
    <Suspense fallback={<WpCategorySortStatic selectedValue={selectedValue} sortLabel={t("sortLabel")} />}>
      <WpCategorySortInner current={current} />
    </Suspense>
  );
}

function WpCategorySortStatic({
  selectedValue,
  sortLabel,
}: {
  selectedValue: string;
  sortLabel: string;
}) {
  const t = useTranslations("Catalog");
  return (
    <form className="woocommerce-ordering" method="get">
      <div className="form-group d-inline-block">
        <Select name="orderby" defaultValue={selectedValue} disabled>
          <SelectTrigger aria-label={sortLabel} className="text-left font-cta text-ui-14 font-semibold uppercase">
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
      </div>
    </form>
  );
}

function WpCategorySortSelect({
  selectedValue,
  sortLabel,
  onValueChange,
}: {
  selectedValue: string;
  sortLabel: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("Catalog");
  return (
    <Select name="orderby" value={selectedValue} onValueChange={onValueChange}>
      <SelectTrigger aria-label={sortLabel} className="text-left font-cta text-ui-14 font-semibold uppercase">
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

function WpCategorySortInner({ current }: { current: string }) {
  const t = useTranslations("Catalog");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedValue = isWpOrderbyValue(current) ? current : productSortToWpOrderby(current);

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "menu_order") {
      params.delete("orderby");
    } else {
      params.set("orderby", value);
    }
    params.delete("sort");
    params.delete("page");
    params.delete("paged");
    const next = params.toString();
    router.push(next ? `${window.location.pathname}?${next}` : window.location.pathname);
  }

  return (
    <form className="woocommerce-ordering" method="get" onSubmit={(e) => e.preventDefault()}>
      <div className="form-group d-inline-block">
        <WpCategorySortSelect
          selectedValue={selectedValue}
          sortLabel={t("sortLabel")}
          onValueChange={handleChange}
        />
      </div>
    </form>
  );
}
