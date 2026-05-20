"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    params.set("sort", value);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-[10px] text-sm text-muted-foreground">
      <label htmlFor="sort-select" className="sr-only">{tCatalog("sortLabel")}</label>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger id="sort-select" className="min-h-[40px] min-w-[160px] text-sm">
          <SelectValue placeholder={tCatalog("sortPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(({ value, labelKey }) => (
            <SelectItem key={value} value={value}>
              {tSort(labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
