"use client";

import { resolveMediaUrl } from "@/lib/utils/format";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import type { Category } from "@/lib/contracts/public";
import { ChevronRight } from "lucide-react";

/* eslint-disable @next/next/no-img-element */

/**
 * Lưới danh mục trang chủ — server render `vi` (initialCategories) cho SEO/ISR; khi khách
 * đổi sang EN thì refetch danh mục (showOnHomepage) theo lang ở client và thay tên. Giữ
 * nguyên dữ liệu và thứ tự do admin cấu hình.
 */
export function HomeCategoryGrid({ initialCategories }: { initialCategories: Category[] }) {
  const categories = initialCategories;
  if (categories.length === 0) return null;

  return (
    <div className="mb-10 mt-32 max-md:mt-18">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((c) => {
          const img = resolveMediaUrl((c.image ?? c.icon)?.url?.trim()) || "/brand/home/category-fallback.png";
          return (
            <div className="border border-border text-center" key={c.id}>
              <LocalizedLink
                kind="category"
                viSlug={c.slug}
                enSlug={c.slugEn}
                className="group relative flex h-72.5 items-center justify-center overflow-hidden bg-card before:absolute before:inset-0 before:content-[''] before:bg-[url('/brand/home/category-hover.jpg')] before:bg-cover before:bg-center before:opacity-0 before:transition-opacity before:duration-normal before:ease-standard hover:before:opacity-100 focus-visible:outline-2 focus-visible:outline-ring focus-visible:[outline-offset:-3px]"
              >
                <span className="relative z-[1] block w-full px-4">
                  <span className="block">
                    <img src={img} className="mx-auto h-auto max-h-40 w-auto max-w-full object-contain transition duration-300 group-hover:brightness-0 group-hover:invert" alt="" loading="lazy" />
                  </span>
                  <span className="mt-7.5 block line-clamp-2 font-body text-a4-content font-semibold normal-case leading-body text-foreground group-hover:text-white">{c.name}</span>
                  <ChevronRight className="mx-auto mt-0 h-0 w-6 text-foreground opacity-0 transition-all duration-300 group-hover:mt-8 group-hover:h-6 group-hover:text-white group-hover:opacity-100" aria-hidden="true" />
                </span>
              </LocalizedLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
