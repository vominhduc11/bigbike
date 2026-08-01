import { getTranslations } from "next-intl/server";
import { ArticleCard } from "@/components/content/ArticleCard";
import { ArticleCategoryNav } from "@/components/content/ArticleCategoryNav";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { toArticleListPath } from "@/lib/utils/routes";
import { resolveLocale } from "@/i18n/locale";

type ArticlePagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

export async function ArticleListDefault({
  categories,
  articles,
  pagination,
  locale,
}: {
  categories: ContentCategoryWithCount[];
  articles: Article[];
  pagination?: ArticlePagination | null;
  locale: string;
}) {
  const t = await getTranslations("Blog");
  const resolvedLocale = resolveLocale(locale);
  const hasMultipleCategories = categories.length > 1;

  return (
    <>
      <div className="pb-15 text-a4-content leading-relaxed text-foreground">
        <p className="m-0 text-justify">{t("contentTop")}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        {hasMultipleCategories ? (
          <ArticleCategoryNav
            categories={categories}
            locale={resolvedLocale}
            heading={t("categoriesHeading")}
          />
        ) : null}

        <div className={hasMultipleCategories ? "min-w-0 md:col-span-9" : "min-w-0 md:col-span-12"}>
          {articles.length === 0 ? (
            <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground">{t("listEmpty")}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
              </div>
              {pagination ? (
                <CatalogPagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  baseHref={toArticleListPath(resolvedLocale)}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="pb-15 pt-25 text-a4-content leading-relaxed text-foreground">
        <p className="m-0 text-justify">{t("contentBottom")}</p>
      </div>
    </>
  );
}
