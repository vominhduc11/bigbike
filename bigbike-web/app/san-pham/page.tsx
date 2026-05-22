import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import {
  PRODUCT_SORT_VALUES,
  listBrands,
  listCategories,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readHeroSettings } from "@/lib/utils/page-hero";
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
  const hasFilters =
    Boolean(q) ||
    Boolean(category) ||
    Boolean(brand) ||
    Boolean(color) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
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
  const [tCatalog, tBreadcrumb] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("Breadcrumb"),
  ]);

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
            title={tCatalog("filterInvalidTitle")}
            message={validationErrors.join(" ")}
            retryHref={toProductListPath()}
          />
        </div>
      </section>
    );
  }

  const locale = await getLocale();
  const [result, brandsResult, categoriesResult, settingsResult] = await Promise.all([
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
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc" }),
    listPublicSettings(),
  ]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_products");

  const pagination = result.pagination;
  const pageTitle = buildCatalogTitle(
    qParsed.value ? tCatalog("searchResultQuoted", { query: qParsed.value }) : tCatalog("title"),
    {
      page: pageParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
      colorName: colorParsed.value,
    },
  );

  const currentFilters = {
    q: qParsed.value,
    category: categoryParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    sort: sortParsed.value,
  };

  return (
    <div className="bb-product-archive archive post-type-archive-product">
      <ProductArchiveHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        title={heroSettings.title ?? pageTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: tCatalog("title") },
        ]}
      />

      <ProductArchiveLayout
        totalItems={pagination?.totalItems ?? null}
        sortCurrent={sortParsed.value ?? DEFAULT_SORT}
        filters={{
          brands: brandsResult.data,
          categories: categoriesResult.data,
          current: currentFilters,
          resetHref: toProductListPath(),
        }}
      >
          {result.error && result.data.length === 0 ? (
            <ErrorState message={result.error.message} retryHref={toProductListPath()} />
          ) : result.data.length === 0 ? (
            <p className="woocommerce-info">{tCatalog("noResults")}</p>
          ) : (
            <>
              <div className="bb-product-grid">
                {result.data.map((product) => (
                  <ProductCard key={product.id} product={product} variant="archive" />
                ))}
              </div>
              {pagination ? (
                <PaginationNav
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  baseHref={`${toProductListPath()}${buildQueryString({
                      size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                      sort: sortParsed.value !== DEFAULT_SORT ? sortParsed.value : undefined,
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
