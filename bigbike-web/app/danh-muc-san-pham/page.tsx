import type { Metadata } from "next";
import { CategoryCard } from "@/components/catalog/CategoryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { CATEGORY_SORT_VALUES, listCategories } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toCategoryListPath } from "@/lib/utils/routes";
import { buildQueryString, collectErrors, parsePositiveIntParam, parseSortParam, readSingleSearchParam } from "@/lib/utils/query";

type CategoryListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: CategoryListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasQueryVariant = page > 1 || Boolean(readSingleSearchParam(params.sort));

  return buildPublicMetadata({
    title: "Danh mục sản phẩm",
    description: "Danh sách category theo route /danh-muc-san-pham/.",
    canonicalPath: toCategoryListPath(),
    noIndex: hasQueryVariant,
  });
}

export default async function CategoryListPage({ searchParams }: CategoryListPageProps) {
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
  const sortParsed = parseSortParam(params.sort, CATEGORY_SORT_VALUES, "sortOrder:asc");
  const validationErrors = collectErrors(pageParsed.error, sizeParsed.error, sortParsed.error);

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState
            title="Query chưa hợp lệ"
            message={validationErrors.join(" ")}
            retryHref={toCategoryListPath()}
          />
        </div>
      </section>
    );
  }

  const result = await listCategories({
    page: pageParsed.value,
    size: sizeParsed.value,
    sort: sortParsed.value,
  });

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Category</p>
          <h1>Danh mục sản phẩm</h1>
          <p className="bb-page-subtitle">
            Route legacy duoc giu la /danh-muc-san-pham/{'{slug}'}.
          </p>
        </header>

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toCategoryListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="Không có danh mục"
            description="Danh mục sản phẩm đang được cập nhật."
          />
        ) : (
          <>
            <div className="bb-grid-categories bb-section">
              {result.data.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
            {result.pagination ? (
              <PaginationNav
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                makeHref={(nextPage) =>
                  `${toCategoryListPath()}${buildQueryString({
                    page: nextPage,
                    size: sizeParsed.value,
                    sort: sortParsed.value,
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
