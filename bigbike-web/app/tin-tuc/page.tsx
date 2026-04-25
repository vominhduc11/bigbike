import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/content/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { ARTICLE_SORT_VALUES, listArticles } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toArticleListPath } from "@/lib/utils/routes";

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

  const result = await listArticles({
    page: pageParsed.value,
    size: sizeParsed.value,
    sort: sortParsed.value,
    category: categoryParsed.value,
    q: qParsed.value,
  });

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <span>Tin tức</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">BigBike Blog</span>
        <h1>Tin tức và hướng dẫn</h1>
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto 40px", padding: "0 24px" }}>
        {/* Search/filter bar */}
        <form
          method="GET"
          style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28, alignItems: "flex-end" }}
        >
          <div className="wp-field" style={{ flex: "1 1 200px" }}>
            <label>Tìm kiếm</label>
            <input name="q" defaultValue={qParsed.value} className="wp-input" placeholder="Tìm bài viết..." />
          </div>
          <div className="wp-field" style={{ flex: "0 1 160px" }}>
            <label>Danh mục</label>
            <input name="category" defaultValue={categoryParsed.value} className="wp-input" placeholder="huong-dan" />
          </div>
          <div className="wp-field" style={{ flex: "0 1 160px" }}>
            <label>Sắp xếp</label>
            <select name="sort" defaultValue={sortParsed.value} className="wp-input">
              {ARTICLE_SORT_VALUES.map((value) => (
                <option value={value} key={value}>
                  {value === "publishedAt:desc" ? "Mới nhất" : value === "publishedAt:asc" ? "Cũ nhất" : value}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="wp-btn-primary" style={{ flexShrink: 0 }}>
            Áp dụng
          </button>
        </form>

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toArticleListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="Không có bài viết"
            description="Danh sách bài viết hiện tại đang rỗng."
          />
        ) : (
          <>
            <div className="wp-news-grid">
              {result.data.map((article) => (
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
    </>
  );
}
