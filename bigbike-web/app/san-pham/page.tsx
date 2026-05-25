import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { PaginationNav } from "@/components/ui/PaginationNav";
import {
  PRODUCT_SORT_VALUES,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import {
  DEFAULT_WP_ORDERBY,
  isWpOrderbyValue,
  productSortToWpOrderby,
  wpOrderbyToProductSort,
} from "@/lib/utils/catalog-sort";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toHomePath, toProductListPath } from "@/lib/utils/routes";
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
  const category = readSingleSearchParam(params.category);
  const color = readSingleSearchParam(params.filter_color);
  const minPrice = readSingleSearchParam(params.min_price);
  const maxPrice = readSingleSearchParam(params.max_price);
  const brand = readSearchParamAlias(params, "pwb-brand", "brand");
  const orderby = readSingleSearchParam(params.orderby);
  const hasFilters =
    Boolean(q) ||
    Boolean(category) ||
    Boolean(brand) ||
    Boolean(color) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    Boolean(orderby && orderby !== DEFAULT_WP_ORDERBY) ||
    page > 1;

  const tCatalog = await getTranslations("Catalog");
  const titleBase = q ? tCatalog("searchResult", { query: q }) : tCatalog("title");

  return buildPublicMetadata({
    title: buildCatalogTitle(titleBase, {
      page,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      colorName: color,
    }),
    description: tCatalog("metadataDescription"),
    canonicalPath: toProductListPath(),
    noIndex: hasFilters,
  });
}

export default async function ProductListPage({ searchParams }: ProductListPageProps) {
  const params = await searchParams;
  const tCatalog = await getTranslations("Catalog");

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
    categoryParsed.error,
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
        <ProductArchiveHero title={tCatalog("allProducts")} breadcrumb={[{ label: "Bigbike.vn", href: toHomePath() }]} />
        <div id="main-content" className="bb-archive-main">
          <div className="container bb-wp-container">
            <p className="woocommerce-info">{validationErrors.join(" ")}</p>
          </div>
        </div>
      </div>
    );
  }

  const locale = await getLocale();
  const [result, brandsResult, categoriesResult] = await Promise.all([
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: productSort,
      category: categoryParsed.value,
      brand: brandParsed.value,
      q: qParsed.value,
      filterColor: colorParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc" }),
  ]);

  const pagination = result.pagination;
  const currentFilters = {
    q: qParsed.value,
    category: categoryParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
  };

  return (
    <div className="bb-product-archive archive post-type-archive-product">
      <ProductArchiveHero
        title={tCatalog("allProducts")}
        breadcrumb={[{ label: "Bigbike.vn", href: toHomePath() }]}
      />

      <ProductArchiveLayout
        totalItems={pagination?.totalItems ?? null}
        sortCurrent={orderbyCurrent}
        filters={{
          brands: brandsResult.data,
          categories: categoriesResult.data,
          current: currentFilters,
          resetHref: toProductListPath(),
          hiddenParams: {
            orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
          },
        }}
      >
          {result.error && result.data.length === 0 ? (
            <p className="woocommerce-info">{result.error.message}</p>
          ) : result.data.length === 0 ? (
            <p className="woocommerce-info">{tCatalog("noResults")}</p>
          ) : (
            <>
              <div className="row bb-wp-row bb-product-grid">
                {result.data.map((product) => (
                  <div key={product.id} className="col-md-3 col-6 bb-wp-col-md-3 bb-wp-col-6">
                    <ProductCard product={product} variant="archive" />
                  </div>
                ))}
              </div>
              {pagination ? (
                <PaginationNav
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  baseHref={`${toProductListPath()}${buildQueryString({
                      size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                      orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
                      category: categoryParsed.value,
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
