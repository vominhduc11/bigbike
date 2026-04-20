import type { Metadata } from "next";
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
    title: "Tin tuc",
    description: "Danh sach bai viet theo route legacy /tin-tuc/ va detail /tin-tuc/{slug}.html.",
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
          <ErrorState title="Query chua hop le" message={validationErrors.join(" ")} retryHref={toArticleListPath()} />
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
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Content</p>
          <h1>Tin tuc va huong dan</h1>
          <p className="bb-page-subtitle">Detail route giu theo legacy: /tin-tuc/{'{slug}'}.html.</p>
        </header>

        <form method="GET" className="bb-query-form">
          <div className="bb-query-row">
            <label className="bb-query-label">
              Tim kiem
              <input name="q" defaultValue={qParsed.value} className="bb-query-input" />
            </label>
            <label className="bb-query-label">
              Category slug
              <input
                name="category"
                defaultValue={categoryParsed.value}
                placeholder="huong-dan"
                className="bb-query-input"
              />
            </label>
            <label className="bb-query-label">
              Sort
              <select name="sort" defaultValue={sortParsed.value} className="bb-query-select">
                {ARTICLE_SORT_VALUES.map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="bb-button bb-button-primary">
            Ap dung
          </button>
        </form>

        {result.fromFallback ? (
          <p className="bb-status-banner">Dang hien thi du lieu fallback dev cho bai viet.</p>
        ) : null}

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toArticleListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="Khong co bai viet"
            description="Danh sach bai viet hien tai dang rong."
          />
        ) : (
          <>
            <div className="bb-grid-articles bb-section">
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
    </section>
  );
}
