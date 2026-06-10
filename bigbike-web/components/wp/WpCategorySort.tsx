"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { isWpOrderbyValue, productSortToWpOrderby } from "@/lib/utils/catalog-sort";

/**
 * woocommerce_catalog_ordering — port 1:1 từ theme WP (form.woocommerce-ordering
 * + select.form-control). Native select để CSS theme tô đúng (.form-select arrow).
 * Đổi giá trị → điều hướng giữ nguyên các filter khác, reset trang.
 */
const SORT_OPTIONS = [
  { value: "menu_order", label: "Sắp xếp mặc định" },
  { value: "popularity", label: "Sắp xếp theo mức độ phổ biến" },
  { value: "date", label: "Sắp xếp theo mới nhất" },
  { value: "price", label: "Sắp xếp theo giá: thấp đến cao" },
  { value: "price-desc", label: "Sắp xếp theo giá: cao đến thấp" },
] as const;

export function WpCategorySort({ current }: { current: string }) {
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
      <div className="form-group form-select d-inline-block">
        <select
          name="orderby"
          className="form-control text-left"
          aria-label="Đơn hàng của cửa hàng"
          value={selectedValue}
          onChange={(e) => handleChange(e.target.value)}
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
