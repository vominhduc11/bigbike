"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isWpOrderbyValue, productSortToWpOrderby } from "@/lib/utils/catalog-sort";

const SORT_OPTIONS = [
  { value: "menu_order", labelKey: "default" },
  { value: "popularity", labelKey: "popularity" },
  { value: "date", labelKey: "date" },
  { value: "price", labelKey: "priceAsc" },
  { value: "price-desc", labelKey: "priceDesc" },
] as const;

export function CatalogSortSelect({ current }: { current: string }) {
  const tCatalog = useTranslations("Catalog");
  const tSort = useTranslations("Catalog.sort");
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
    <form className="woocommerce-ordering" method="get">
      <label htmlFor="sort-select" className="sr-only">{tCatalog("sortLabel")}</label>
      <div className="form-group form-select">
        <select
          id="sort-select"
          name="orderby"
          className="form-control text-left"
          value={selectedValue}
          onChange={(event) => handleChange(event.target.value)}
          aria-label={tCatalog("sortLabel")}
        >
          {SORT_OPTIONS.map(({ value, labelKey }) => (
            <option key={value} value={value}>
              {tSort(labelKey)}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
