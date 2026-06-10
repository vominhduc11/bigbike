import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCategorySidebar } from "@/components/wp/WpCategorySidebar";
import { WpCatalogResults } from "@/components/wp/WpCatalogResults";
import {
  getCatalogFacets,
  listBrands,
  listCategories,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { DEFAULT_WP_ORDERBY } from "@/lib/utils/catalog-sort";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath, toProductListPath } from "@/lib/utils/routes";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { readSearchParamAlias, readSingleSearchParam } from "@/lib/utils/query";

type ProductListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

  const catalog = parseCatalogListParams(params, { includeCategoryParam: true });
  const { filters, validationErrors, orderbyCurrent } = catalog;

  const locale = await getLocale();
  const [settingsResult] = await Promise.all([listPublicSettings(locale)]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_products");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? tCatalog("allProducts");
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );
  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: heroTitle },
  ];

  if (validationErrors.length > 0) {
    return (
      <>
        <link
          rel="stylesheet"
          href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2"
          precedence="default"
        />
        <div className="archive post-type-archive-product">
          <WpCategoryHero
            title={heroTitle}
            breadcrumb={heroBreadcrumb}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={heroSettings.imageAlt ?? heroTitle}
          />
          <div id="main-content">
            <div className="container">
              <p className="woocommerce-info">{validationErrors.join(" ")}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const [result, brandsResult, categoriesResult, facetsResult] = await Promise.all([
    listProducts({
      page: catalog.page,
      size: catalog.size,
      sort: catalog.productSort,
      category: filters.category,
      brand: filters.brand,
      q: filters.q,
      filterColor: filters.color,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ category: filters.category, q: filters.q, lang: locale }),
  ]);

  const products = result.data;
  const pagination = result.pagination;
  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);

  const canonicalPath = toProductListPath();
  const paginationBaseHref = catalog.buildPaginationHref(canonicalPath);

  const notice =
    result.error && products.length === 0
      ? result.error.message
      : products.length === 0
        ? tCatalog("noResults")
        : null;

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2"
        precedence="default"
      />

      <div className="archive post-type-archive-product">
        <WpCategoryHero
          title={heroTitle}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <div className="container">
            <div className="row">
              <div className="col-md-3">
                <WpCategorySidebar
                  brands={brandsResult.data}
                  categories={filterCategories}
                  facets={facetsResult.data}
                  current={catalog.currentFilters}
                  resetHref={canonicalPath}
                  hiddenParams={{
                    orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
                  }}
                />
              </div>

              <WpCatalogResults
                orderbyCurrent={orderbyCurrent}
                pagination={pagination}
                products={products}
                notice={notice}
                paginationBaseHref={paginationBaseHref}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
