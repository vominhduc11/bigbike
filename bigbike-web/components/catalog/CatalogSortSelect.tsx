"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Mới nhất" },
  { value: "createdAt:asc", label: "Cũ nhất" },
  { value: "name:asc", label: "Tên A–Z" },
  { value: "name:desc", label: "Tên Z–A" },
  { value: "price:asc", label: "Giá tăng dần" },
  { value: "price:desc", label: "Giá giảm dần" },
];

export function CatalogSortSelect({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="wp-catalog-sort">
      <label htmlFor="sort-select" className="sr-only">Sắp xếp</label>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger id="sort-select" className="min-h-[40px] min-w-[160px] text-sm">
          <SelectValue placeholder="Sắp xếp theo..." />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
