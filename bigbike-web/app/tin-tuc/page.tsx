import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/content/ArticleCard";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { ARTICLE_SORT_VALUES, listArticles, listPublicSettings } from "@/lib/api/public-api";
import type { Article, ContentCategorySummary } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readHeroSettings } from "@/lib/utils/page-hero";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";

const SORT_LABELS: Record<(typeof ARTICLE_SORT_VALUES)[number], string> = {
  "publishedAt:desc": "Mới nhất",
  "publishedAt:asc": "Cũ nhất",
  "createdAt:desc": "Mới tạo",
  "createdAt:asc": "Tạo cũ nhất",
  "title:asc": "Tên A-Z",
  "title:desc": "Tên Z-A",
};

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function collectArticleCategories(articles: Article[]): ContentCategorySummary[] {
  const categories = new Map<string, ContentCategorySummary>();

  for (const article of articles) {
    const articleCategories = [
      article.category,
      ...(article.categories ?? []),
    ].filter((category): category is ContentCategorySummary => Boolean(category?.slug && category.name));

    for (const category of articleCategories) {
      categories.set(category.slug, category);
    }
  }

  return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

function sortLabel(value: string): string {
  return SORT_LABELS[value as keyof typeof SORT_LABELS] ?? value;
}

export async function generateMetadata({ searchParams }: ArticleListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasFilters =
    page > 1 ||
    Boolean(readSingleSearchParam(params.q)) ||
    Boolean(readSingleSearchParam(params.category)) ||
    Boolean(readSingleSearchParam(params.sort));

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
  const categoryParsed = parseSlugParam(params.category, "category");
  const qParsed = parseTextParam(params.q, 100);
  const sortParsed = parseSortParam(params.sort, ARTICLE_SORT_VALUES, "publishedAt:desc");

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    categoryParsed.error,
    qParsed.error,
    sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState title="Query chưa hợp lệ" message={validationErrors.join(" ")} retryHref={toArticleListPath()} />
        </div>
      </section>
    );
  }

  const [result, settingsResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      category: categoryParsed.value,
      q: qParsed.value,
    }),
    listPublicSettings(),
  ]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");

  const articles = result.data;
  const totalItems = result.pagination?.totalItems ?? articles.length;
  const hasContentFilters = Boolean(qParsed.value || categoryParsed.value);
  const hasVisibleFilters =
    hasContentFilters ||
    Boolean(readSingleSearchParam(params.sort)) ||
    pageParsed.value > 1 ||
    sizeParsed.value !== 12;
  const featuredArticle = !hasContentFilters && pageParsed.value === 1 ? articles[0] : undefined;
  const gridArticles = featuredArticle ? articles.slice(1) : articles;
  const categories = collectArticleCategories(articles);
  const activeCategoryLabel =
    categories.find((category) => category.slug === categoryParsed.value)?.name ??
    categoryParsed.value;

  const makeListHref = (overrides: {
    page?: number;
    category?: string;
    q?: string;
    sort?: string;
    size?: number;
  }) =>
    `${toArticleListPath()}${buildQueryString({
      page: overrides.page,
      size: overrides.size,
      sort: overrides.sort,
      category: overrides.category,
      q: overrides.q,
    })}`;

  return (
    <div className="wp-news-page">
      <PageHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        kicker={heroSettings.kicker ?? "BIGBIKE BLOG"}
        title={heroSettings.title ?? "Tin tức và hướng dẫn biker"}
        description={
          heroSettings.description ??
          "Kiến thức chọn gear, kinh nghiệm sử dụng đồ bảo hộ moto và cập nhật sản phẩm chính hãng cho anh em rider Việt Nam."
        }
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Tin tức" },
        ]}
        meta={`${totalItems} bài viết`}
      />

      <div className="wp-news-section">
        <div className="wp-news-toolbar">
          <form method="GET" className="wp-news-filter-form" aria-label="Lọc bài viết">
            <div className="wp-field wp-news-filter-search">
              <label>Tìm kiếm</label>
              <Input
                name="q"
                defaultValue={qParsed.value}
                placeholder="VD: chọn size mũ, găng tay touring..."
              />
            </div>
            <div className="wp-field">
              <label>Danh mục</label>
              <Select name="category" defaultValue={categoryParsed.value ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả danh mục</SelectItem>
                  {categoryParsed.value && !categories.some((c) => c.slug === categoryParsed.value) ? (
                    <SelectItem value={categoryParsed.value}>Danh mục hiện tại: {categoryParsed.value}</SelectItem>
                  ) : null}
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="wp-field">
              <label>Sắp xếp</label>
              <Select name="sort" defaultValue={sortParsed.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_SORT_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {sortLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="wp-news-filter-actions">
              <Button type="submit" variant="primary">
                Áp dụng
              </Button>
              {hasVisibleFilters ? (
                <Link href={toArticleListPath()} className="wp-filter-reset">
                  Xoá lọc
                </Link>
              ) : null}
            </div>
          </form>

          {categories.length > 0 ? (
            <nav className="wp-news-category-strip" aria-label="Danh mục tin tức">
              <Link
                href={makeListHref({
                  q: qParsed.value,
                  sort: sortParsed.value === "publishedAt:desc" ? undefined : sortParsed.value,
                })}
                className={`wp-news-category-chip${categoryParsed.value ? "" : " active"}`}
              >
                Tất cả
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={makeListHref({
                    category: category.slug,
                    q: qParsed.value,
                    sort: sortParsed.value === "publishedAt:desc" ? undefined : sortParsed.value,
                  })}
                  className={`wp-news-category-chip${
                    categoryParsed.value === category.slug ? " active" : ""
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="wp-news-results-head">
          <div>
            <span className="wp-news-results-kicker">
              {hasContentFilters ? "Kết quả lọc" : "Bài mới nhất"}
            </span>
            <h2>
              {hasContentFilters
                ? `${totalItems} bài viết phù hợp`
                : "Cập nhật từ BigBike"}
            </h2>
          </div>
          <p>
            {qParsed.value ? `Từ khoá: "${qParsed.value}"` : null}
            {qParsed.value && activeCategoryLabel ? " · " : null}
            {activeCategoryLabel ? `Danh mục: ${activeCategoryLabel}` : null}
            {!qParsed.value && !activeCategoryLabel ? `Sắp xếp: ${sortLabel(sortParsed.value)}` : null}
          </p>
        </div>

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toArticleListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="Không có bài viết"
            description="Chưa có bài viết phù hợp với bộ lọc hiện tại."
            action={
              hasVisibleFilters ? (
                <Button asChild variant="primary">
                  <Link href={toArticleListPath()}>Xem tất cả bài viết</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {featuredArticle ? (
              <ArticleCard article={featuredArticle} variant="featured" />
            ) : null}

            {gridArticles.length > 0 ? (
              <div className="wp-news-grid">
                {gridArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
              </div>
            ) : null}
            {result.pagination ? (
              <PaginationNav
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                makeHref={(nextPage) =>
                  `${toArticleListPath()}${buildQueryString({
                    page: nextPage,
                    size: sizeParsed.value,
                    sort: sortParsed.value,
                    category: categoryParsed.value,
                    q: qParsed.value,
                  })}`
                }
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
