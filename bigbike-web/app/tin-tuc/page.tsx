import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ArticleCard } from "@/components/content/ArticleCard";
import { ArticleCategoryDrawer } from "@/components/content/ArticleCategoryDrawer";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { listArticles, listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readHeroSettings } from "@/lib/utils/page-hero";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseTextParam,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ArticleListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasFilters =
    page > 1 ||
    Boolean(readSingleSearchParam(params.q)) ||
    Boolean(readSingleSearchParam(params.category));

  return buildPublicMetadata({
    title: "Tin tức",
    description: "Tin tức, đánh giá sản phẩm và hướng dẫn biker từ BigBike.",
    canonicalPath: toArticleListPath(),
    noIndex: hasFilters,
  });
}

export default async function ArticleListPage({ searchParams }: ArticleListPageProps) {
  const params = await searchParams;

  const pageParsed = parsePositiveIntParam(params.page, {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: 12,
    min: 1,
    max: 100,
    field: "size",
  });
  const categoryParsed = parseSlugParam(
    params.category === "all" ? undefined : params.category,
    "category",
  );
  const qParsed = parseTextParam(params.q, 100);

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    categoryParsed.error,
    qParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState title={"Query chưa hợp lệ"} message={validationErrors.join(" ")} retryHref={toArticleListPath()} />
        </div>
      </section>
    );
  }

  const [result, settingsResult, categoriesResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: "publishedAt:desc",
      category: categoryParsed.value,
      q: qParsed.value,
    }),
    listPublicSettings(),
    listContentCategories(),
  ]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");

  const articles = result.data;
  // Chỉ hiển thị danh mục có bài viết — giữ danh sách gọn như bản thiết kế.
  const sidebarCategories = categoriesResult.data.filter((cat) => cat.articleCount > 0);

  const makeListHref = (overrides: {
    page?: number;
    category?: string;
    size?: number;
  }) =>
    `${toArticleListPath()}${buildQueryString({
      page: overrides.page,
      size: overrides.size,
      category: overrides.category,
    })}`;

  return (
    <div className="bg-background">
      <PageHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        title={heroSettings.title ?? "Tin tức"}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Tin tức" },
        ]}
      />

      <div className="bb-cat-layout">
        {/* Sidebar danh mục — chỉ hiển thị trên desktop */}
        <aside aria-label="Danh mục tin tức" className="max-[768px]:hidden">
          <h3 className="font-display text-base font-semibold uppercase text-foreground mb-4 pb-3 border-b-2 border-brand tracking-normal">
            {"Danh mục tin tức"}
          </h3>
          <ul className="list-none p-0 m-0">
            <li className="border-b border-border">
              <Link
                href={toArticleListPath()}
                className={`flex items-center justify-between py-3 font-body text-sm uppercase tracking-[0.02em] no-underline transition-all duration-150 hover:text-brand ${!categoryParsed.value ? "text-brand font-semibold" : "text-foreground"}`}
              >
                {"Tất cả"}
                <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
              </Link>
            </li>
            {sidebarCategories.map((cat) => {
              const isActive = categoryParsed.value === cat.slug;
              return (
                <li key={cat.id} className="border-b border-border">
                  <Link
                    href={makeListHref({ category: cat.slug })}
                    className={`flex items-center gap-2 py-3 font-body text-sm uppercase tracking-[0.02em] no-underline transition-all duration-150 hover:text-brand ${isActive ? "text-brand font-semibold" : "text-foreground"}`}
                  >
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                    )}
                    <span className="flex-1">{cat.name}</span>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Lưới bài viết */}
        <div>
          {/* Bộ lọc danh mục cho điện thoại — khớp breakpoint với sidebar desktop */}
          <div className="mb-5 hidden max-[768px]:block">
            <ArticleCategoryDrawer
              categories={sidebarCategories}
              currentCategory={categoryParsed.value}
            />
          </div>
          {result.error && result.data.length === 0 ? (
            <ErrorState message={result.error.message} retryHref={toArticleListPath()} />
          ) : result.data.length === 0 ? (
            <EmptyState
              title={"Không có bài viết"}
              description={"Chưa có bài viết phù hợp với bộ lọc hiện tại."}
            />
          ) : (
            <>
              <div className="bb-articles-grid-v2">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
              {result.pagination ? (
                <PaginationNav
                  page={result.pagination.page}
                  totalPages={result.pagination.totalPages}
                  makeHref={(nextPage) =>
                    `${toArticleListPath()}${buildQueryString({
                      page: nextPage,
                      size: sizeParsed.value,
                      category: categoryParsed.value,
                    })}`
                  }
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
