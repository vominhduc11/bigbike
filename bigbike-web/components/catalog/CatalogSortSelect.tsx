"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORT_LABELS: Record<string, string> = {
  "createdAt:desc": "Mới nhất",
  "createdAt:asc": "Cũ nhất",
  "name:asc": "Tên A–Z",
  "name:desc": "Tên Z–A",
  "price:asc": "Giá tăng dần",
  "price:desc": "Giá giảm dần",
};

export function CatalogSortSelect({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="wp-catalog-sort">
      <label htmlFor="sort-select">Sắp xếp</label>
      <select id="sort-select" value={current} onChange={handleChange}>
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
