"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const SORT_OPTIONS = [
  { value: "createdAt:desc", labelKey: "newest" },
  { value: "createdAt:asc", labelKey: "oldest" },
  { value: "name:asc", labelKey: "nameAsc" },
  { value: "name:desc", labelKey: "nameDesc" },
  { value: "price:asc", labelKey: "priceAsc" },
  { value: "price:desc", labelKey: "priceDesc" },
] as const;

export function CatalogSortSelect({ current }: { current: string }) {
  const tCatalog = useTranslations("Catalog");
  const tSort = useTranslations("Catalog.sort");
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "createdAt:desc") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    params.delete("page");
    const next = params.toString();
    router.push(next ? `?${next}` : window.location.pathname);
  }

  return (
    <form className="woocommerce-ordering" method="get">
      <label htmlFor="sort-select" className="sr-only">{tCatalog("sortLabel")}</label>
      <div className="form-group form-select">
        <select
          id="sort-select"
          name="orderby"
          className="form-control"
          value={current}
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
