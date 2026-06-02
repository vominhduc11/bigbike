"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { isWpOrderbyValue, productSortToWpOrderby } from "@/lib/utils/catalog-sort";

const SORT_OPTIONS = [
  { value: "menu_order", label: "Sắp xếp mặc định" },
  { value: "popularity", label: "Sắp xếp theo mức độ phổ biến" },
  { value: "date", label: "Sắp xếp theo mới nhất" },
  { value: "price", label: "Sắp xếp theo giá: thấp đến cao" },
  { value: "price-desc", label: "Sắp xếp theo giá: cao đến thấp" },
] as const;

export function CatalogSortSelect({ current }: { current: string }) {
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
    <form className="inline-block w-full max-w-[200px] m-0 max-md:max-w-full" method="get">
      <label htmlFor="sort-select" className="sr-only">Sắp xếp</label>
      <div className="relative w-full min-w-[200px] max-w-full mb-[30px] max-md:min-w-0 after:content-[''] after:absolute after:top-1/2 after:right-[25px] after:h-[7px] after:w-[7px] after:border-r after:border-b after:border-black after:pointer-events-none after:[transform:translateY(-65%)_rotate(45deg)]">
        <select
          id="sort-select"
          name="orderby"
          className="w-full h-[52px] py-0 pr-10 pl-5 border border-[var(--bb-border-default)] rounded-none bg-white text-black text-[14px] font-semibold uppercase appearance-none text-left max-md:h-11 max-md:min-h-11 max-md:text-[12px] max-md:font-[family-name:var(--bb-font-cta)] max-md:leading-[42px]"
          value={selectedValue}
          onChange={(event) => handleChange(event.target.value)}
          aria-label="Sắp xếp"
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
