"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="inline-block w-full max-w-[260px] mb-[30px] max-md:max-w-full max-md:mb-0">
      <label htmlFor="sort-select" className="sr-only">Sắp xếp</label>
      <Select value={selectedValue} onValueChange={handleChange}>
        <SelectTrigger
          id="sort-select"
          aria-label="Sắp xếp"
          className="h-[52px] min-h-[52px] font-cta text-ui-14 font-semibold uppercase max-md:h-11 max-md:min-h-11 max-md:text-ui-12"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {SORT_OPTIONS.map(({ value, label }) => (
            <SelectItem
              key={value}
              value={value}
              className="font-cta text-ui-14 font-semibold uppercase max-md:text-ui-12"
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
