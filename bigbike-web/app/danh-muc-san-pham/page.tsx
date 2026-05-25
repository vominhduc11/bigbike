import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PaginationNav } from "@/components/ui/PaginationNav";
import {
  PRODUCT_SORT_VALUES,
  getCatalogFacets,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import {
  DEFAULT_WP_ORDERBY,
  isWpOrderbyValue,
  productSortToWpOrderby,
  wpOrderbyToProductSort,
} from "@/lib/utils/catalog-sort";
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
import { toCategoryListPath, toHomePath } from "@/lib/utils/routes";

export const dynamic = "force-dynamic";

type CategoryListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_SORT = "createdAt:desc";
const PRICE_PARAM_MAX = 1_000_000_000;
const ALL_PRODUCTS_TITLE = "Tất cả sản phẩm";
const NO_RESULTS_MESSAGE = "Không tìm thấy sản phẩm phù hợp.";
const METADATA_DESCRIPTION =
  "Danh sách sản phẩm bảo hộ biker BigBike - mũ bảo hiểm, áo giáp, găng tay, giày và phụ kiện rider.";

export async function generateMetadata({ searchParams }: CategoryListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSearchParamAlias(params, "page", "paged") ?? "1");
  const q = readSingleSearchParam(params.q);
  const brand = readSearchParamAlias(params, "pwb-brand", "brand");
  const color = readSingleSearchParam(params.filter_color);
  const minPrice = readSingleSearchParam(params.min_price);
  const maxPrice = readSingleSearchParam(params.max_price);
  const orderby = readSingleSearchParam(params.orderby);

  return buildPublicMetadata({
    title: buildCatalogTitle(ALL_PRODUCTS_TITLE, {
      page,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      colorName: color,
    }),
    description: METADATA_DESCRIPTION,
    canonicalPath: toCategoryListPath(),
    noIndex:
      page > 1 ||
      Boolean(q) ||
      Boolean(brand) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice) ||
      Boolean(orderby && orderby !== DEFAULT_WP_ORDERBY),
  });
}

export default async function CategoryListPage({ searchParams }: CategoryListPageProps) {
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
  const orderbyParam = readSingleSearchParam(params.orderby);
  const orderbyError = orderbyParam && !isWpOrderbyValue(orderbyParam) ? "orderby không hợp lệ." : null;
  const sortParsed = parseSortParam(params.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);
  const orderbyCurrent = isWpOrderbyValue(orderbyParam)
    ? orderbyParam
    : productSortToWpOrderby(sortParsed.value ?? DEFAULT_SORT);
  const productSort = isWpOrderbyValue(orderbyParam)
    ? wpOrderbyToProductSort(orderbyParam, DEFAULT_SORT)
    : sortParsed.value;

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    brandParsed.error,
    qParsed.error,
    colorParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    orderbyError,
    orderbyParam ? null : sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <div className="bb-product-archive archive post-type-archive-product">
        <ProductArchiveHero title={ALL_PRODUCTS_TITLE} breadcrumb={[{ label: "Bigbike.vn", href: toHomePath() }]} />
        <div id="main-content" className="bb-archive-main">
          <div className="container bb-wp-container">
            <p className="woocommerce-info">{validationErrors.join(" ")}</p>
          </div>
        </div>
      </div>
    );
  }

  const locale = await getLocale();
  const [productsResult, brandsResult, categoriesResult, facetsResult] = await Promise.all([
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: productSort,
      brand: brandParsed.value,
      q: qParsed.value,
      filterColor: colorParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ q: qParsed.value }),
  ]);

  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
  };
  const visibleCategories = categoriesResult.data.filter(
    (category) => category.isVisible && category.name.toLowerCase() !== "uncategorized",
  );

  return (
    <div className="bb-product-archive archive post-type-archive-product">
      <ProductArchiveHero
        title={ALL_PRODUCTS_TITLE}
        breadcrumb={[{ label: "Bigbike.vn", href: toHomePath() }]}
      />

      <ProductArchiveLayout
        totalItems={pagination?.totalItems ?? null}
        sortCurrent={orderbyCurrent}
        filters={{
          brands: brandsResult.data,
          categories: visibleCategories,
          facets: facetsResult.data,
          current: currentFilters,
          resetHref: toCategoryListPath(),
          showBrandLabels: true,
          hiddenParams: {
            orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
          },
        }}
      >
        {productsResult.error && productsResult.data.length === 0 ? (
          <p className="woocommerce-info">{productsResult.error.message}</p>
        ) : productsResult.data.length === 0 ? (
          <p className="woocommerce-info">{NO_RESULTS_MESSAGE}</p>
        ) : (
          <>
            <div className="row bb-wp-row bb-product-grid">
              {productsResult.data.map((product) => (
                <div key={product.id} className="col-md-3 col-6 bb-wp-col-md-3 bb-wp-col-6">
                  <ProductCard product={product} variant="archive" />
                </div>
              ))}
            </div>
            {pagination ? (
              <PaginationNav
                page={pagination.page}
                totalPages={pagination.totalPages}
                baseHref={`${toCategoryListPath()}${buildQueryString({
                  size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                  orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
                  "pwb-brand": brandParsed.value,
                  q: qParsed.value,
                  filter_color: colorParsed.value,
                  min_price: minPriceParsed.value,
                  max_price: maxPriceParsed.value,
                })}`}
                variant="archive"
              />
            ) : null}
          </>
        )}
      </ProductArchiveLayout>
    </div>
  );
}
