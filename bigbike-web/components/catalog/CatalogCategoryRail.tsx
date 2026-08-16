/* eslint-disable @next/next/no-img-element */

import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import type { CatalogFacets, Category } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

export function CatalogCategoryRail({
  categories,
  facets,
  activeSlug,
}: {
  categories: Category[];
  facets?: CatalogFacets | null;
  activeSlug?: string;
}) {
  if (!activeSlug) return null;
  const active = categories.find((category) => category.slug === activeSlug);
  if (!active) return null;
  const children = categories.filter((category) => category.isVisible && category.parentId === active.id);
  if (!children.length) return null;
  const buckets = new Map((facets?.categories ?? []).map((bucket) => [bucket.key, bucket]));

  return (
    <nav className="mb-6" aria-label={safeText(active.name, "BigBike")}>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible">
        {children.map((category) => {
          const bucket = buckets.get(category.slug);
          const image = bucket?.image ?? category.image;
          const src = resolveMediaUrl(image?.url?.trim());
          return (
            <LocalizedLink
              key={category.id}
              kind="category"
              viSlug={category.slug}
              enSlug={category.slugEn}
              className="group flex w-32 shrink-0 snap-start flex-col border border-border bg-background p-3 text-foreground no-underline! hover:border-brand md:w-auto"
            >
              <span className="mb-2 flex h-20 items-center justify-center overflow-hidden bg-secondary">
                {src ? (
                  <img src={src} alt={safeText(image?.alt, category.name)} width={160} height={100} className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <img src="/brand/header-mark.png" alt="" width={96} height={32} className="h-auto w-20 object-contain opacity-60" />
                )}
              </span>
              <span className="line-clamp-2 text-a5-meta font-semibold group-hover:text-brand">{category.name}</span>
              <span className="mt-1 text-a5-meta text-muted-foreground">{bucket?.count ?? 0}</span>
            </LocalizedLink>
          );
        })}
      </div>
    </nav>
  );
}
