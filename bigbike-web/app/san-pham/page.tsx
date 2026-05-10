import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogSortSelect } from "@/components/catalog/CatalogSortSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, listBrands, listProducts } from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toProductListPath } from "@/lib/utils/routes";
import {
  buildQueryString,
  collectErrors,
  parseOptionalPositiveIntParam,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSearchParamAlias,
  readSingleSearchParam,
} from "@/lib/utils/query";

type ProductListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_SORT = "createdAt:desc";
const PRICE_PARAM_MAX = 1_000_000_000;

export async function generateMetadata({ searchParams }: ProductListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const pageValue = readSearchParamAlias(params, "page", "paged");
  const page = Number(pageValue ?? "1");
  const q = readSingleSearchParam(params.q);
  const color = readSingleSearchParam(params.filter_color);
  const minPrice = readSingleSearchParam(params.min_price);
  const maxPrice = readSingleSearchParam(params.max_price);
  const brand = readSearchParamAlias(params, "pwb-brand", "brand");
  const hasFilters =
    Boolean(q) ||
    Boolean(brand) ||
    Boolean(color) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    page > 1;

  const titleBase = q ? `Kết quả tìm kiếm: ${q}` : "Sản phẩm";

  return buildPublicMetadata({
    title: buildCatalogTitle(titleBase, {
      page,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      colorName: color,
    }),
    description: "Danh sách sản phẩm bảo hộ biker BigBike — mũ bảo hiểm, áo giáp, găng tay, giày và phụ kiện rider.",
    canonicalPath: toProductListPath(),
    noIndex: hasFilters,
  });
}

export default async function ProductListPage({ searchParams }: ProductListPageProps) {
  const params = await searchParams;

  const pageParsed = parsePositiveIntParam(readSearchParamAlias(params, "page", "paged"), {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: 100,
    field: "size",
  });
  const categoryParsed = parseSlugParam(params.category, "category");
  const brandParsed = parseSlugParam(readSearchParamAlias(params, "pwb-brand", "brand"), "pwb-brand");
  const qParsed = parseTextParam(params.q, 100);
  const colorParsed = parseSlugParam(params.filter_color, "filter_color");
  const minPriceParsed = parseOptionalPositiveIntParam(params.min_price, {
    min: 0,
    max: PRICE_PARAM_MAX,
    field: "min_price",
  });
  const maxPriceParsed = parseOptionalPositiveIntParam(params.max_price, {
    min: 0,
    max: PRICE_PARAM_MAX,
    field: "max_price",
  });
  const sortParsed = parseSortParam(params.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    categoryParsed.error,
    brandParsed.error,
    qParsed.error,
    colorParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState
            title="Bộ lọc không hợp lệ"
            message={validationErrors.join(" ")}
            retryHref={toProductListPath()}
          />
        </div>
      </section>
    );
  }

  const [result, brandsResult] = await Promise.all([
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      category: categoryParsed.value,
      brand: brandParsed.value,
      q: qParsed.value,
      filterColor: colorParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
  ]);

  const pagination = result.pagination;
  const pageTitle = buildCatalogTitle(qParsed.value ? `Kết quả tìm kiếm: "${qParsed.value}"` : "Sản phẩm", {
    page: pageParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    colorName: colorParsed.value,
  });

  const currentFilters = {
    q: qParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    sort: sortParsed.value,
  };

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <span className="wp-breadcrumb-active">Sản phẩm</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Shop gear biker</span>
        <h1>{pageTitle}</h1>
      </div>

      <div className="wp-cat-layout">
        <CatalogFilters
          key={[currentFilters.brand, currentFilters.color, currentFilters.minPrice, currentFilters.maxPrice, currentFilters.q].join(",")}
          brands={brandsResult.data}
          current={currentFilters}
          resetHref={toProductListPath()}
        />

        <div>
          <div className="wp-catalog-head">
            <div className="wp-catalog-count">
              {result.data.length > 0 && pagination ? (
                <>
                  Hiển thị{" "}
                  <b>
                    {(pagination.page - 1) * pagination.pageSize + 1}–
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
                  </b>{" "}
                  / {pagination.totalItems} sản phẩm
                </>
              ) : null}
            </div>
            <Suspense
              fallback={
                <span
                  className="bb-skel"
                  aria-hidden="true"
                  style={{ width: 160, height: 36, borderRadius: 4 }}
                />
              }
            >
              <CatalogSortSelect current={sortParsed.value ?? "createdAt:desc"} />
            </Suspense>
          </div>

          {result.error && result.data.length === 0 ? (
            <ErrorState message={result.error.message} retryHref={toProductListPath()} />
          ) : result.data.length === 0 ? (
            <EmptyState
              title="Không tìm thấy sản phẩm"
              description="Thử đổi bộ lọc hoặc bỏ qua từ khoá tìm kiếm."
            />
          ) : (
            <>
              <div className="wp-product-grid">
                {result.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {pagination ? (
                <PaginationNav
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  makeHref={(nextPage) =>
                    `${toProductListPath()}${buildQueryString({
                      page: nextPage,
                      size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                      sort: sortParsed.value !== DEFAULT_SORT ? sortParsed.value : undefined,
                      category: categoryParsed.value,
                      "pwb-brand": brandParsed.value,
                      q: qParsed.value,
                      filter_color: colorParsed.value,
                      min_price: minPriceParsed.value,
                      max_price: maxPriceParsed.value,
                    })}`
                  }
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
