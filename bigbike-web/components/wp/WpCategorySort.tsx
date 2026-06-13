"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isWpOrderbyValue, productSortToWpOrderby } from "@/lib/utils/catalog-sort";
import { useDetachWpHandlers } from "@/lib/hooks/useDetachWpHandlers";

/**
 * woocommerce_catalog_ordering — port 1:1 từ theme WP (form.woocommerce-ordering
 * + select.form-control). Native select để CSS theme tô đúng (.form-select arrow).
 * Đổi giá trị → điều hướng giữ nguyên các filter khác, reset trang.
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedValue = isWpOrderbyValue(current) ? current : productSortToWpOrderby(current);

  // home.min.js bind `$(".woocommerce-ordering select").change(() => this.form.submit())`
  // (submit native, bỏ qua onSubmit preventDefault của React) → reload nguyên trang đè
  // lên router.push của onChange dưới đây. Gỡ handler WP, giữ điều hướng SPA của React.
  useDetachWpHandlers([{ selector: ".woocommerce-ordering select", events: "change" }]);

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
      <div className="form-group form-select d-inline-block">
        <select
          name="orderby"
          className="form-control text-left"
          aria-label={t("sortLabel")}
          value={selectedValue}
          onChange={(e) => handleChange(e.target.value)}
        >
          {SORT_OPTIONS.map(({ value, labelKey }) => (
            <option key={value} value={value}>
              {t(`sort.${labelKey}`)}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
