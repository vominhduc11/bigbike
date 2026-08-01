import Link from "@/i18n/StorefrontLink";
import type { ContentCategoryWithCount } from "@/lib/contracts/public";
import type { Locale } from "@/i18n/locale";
import { buildQueryString } from "@/lib/utils/query";
import { toArticleListPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

const ROOT_CATEGORY_SLUG = "tin-tuc";

export function ArticleCategoryNav({
  categories,
  activeSlug,
  locale,
  heading,
}: {
  categories: ContentCategoryWithCount[];
  activeSlug?: string;
  locale: Locale;
  heading: string;
}) {
  if (categories.length <= 1) return null;

  return (
    <aside className="md:col-span-3">
      <h2 className="mb-3 border-b border-border pb-3 font-body text-a3-section font-bold text-foreground">
        {heading}
      </h2>
      <nav aria-label={heading}>
        <ul className="m-0 list-none p-0">
          {categories.map((category) => {
            const isRoot = category.slug === ROOT_CATEGORY_SLUG;
            const href = isRoot
              ? toArticleListPath(locale)
              : `${toArticleListPath(locale)}${buildQueryString({ category: category.slug })}`;
            const active = isRoot ? !activeSlug : category.slug === activeSlug;

            return (
              <li key={category.id} className="border-b border-border">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 py-3 font-body text-a5-meta font-semibold text-foreground hover:text-brand",
                    active && "text-brand",
                  )}
                >
                  <span>{category.name}</span>
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-secondary px-2 py-1 font-cta text-b5-label uppercase text-muted-foreground">
                    {category.articleCount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
