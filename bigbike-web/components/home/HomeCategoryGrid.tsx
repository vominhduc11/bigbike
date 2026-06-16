"use client";

import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicCategoryList } from "@/lib/api/client-api";
import { resolveMediaUrl } from "@/lib/utils/format";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import type { Category } from "@/lib/contracts/public";

/* eslint-disable @next/next/no-img-element */

const T = "/wp-content/themes/bigbike";

/**
 * Lưới danh mục trang chủ — server render `vi` (initialCategories) cho SEO/ISR; khi khách
 * đổi sang EN thì refetch danh mục (showOnHomepage) theo lang ở client và thay tên. Giữ
 * nguyên DOM/class WP để CSS theme tô đúng.
 */
export function HomeCategoryGrid({ initialCategories }: { initialCategories: Category[] }) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: ["home-categories", locale],
    queryFn: () =>
      fetchPublicCategoryList({ size: 100, sort: "sortOrder:asc", showOnHomepage: true, lang: locale }),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

  const categories = isAlt && data && data.length > 0 ? data : initialCategories;
  if (categories.length === 0) return null;

  return (
    <div className="product-category-list mb-10">
      <div className="row">
        {categories.map((c) => {
          const img = resolveMediaUrl((c.image ?? c.icon)?.url?.trim()) || `${T}/images/Union-2.png`;
          return (
            <div className="col-6 col-md-3 col-sm-4 item" key={c.id}>
              <LocalizedLink
                kind="category"
                viSlug={c.slug}
                enSlug={c.slugEn}
                className="row align-items-center"
              >
                <span className="col-12">
                  <span className="img">
                    <img src={img} className="lazy mx-auto" alt="" width={1} height={1} />
                  </span>
                  <span className="desc">{c.name}</span>
                  <i className="fal fa-chevron-circle-right" />
                </span>
              </LocalizedLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
