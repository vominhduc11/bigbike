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
import { DEFAULT_WP_ORDERBY } from "@/lib/utils/catalog-sort";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath } from "@/lib/utils/routes";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { parseTextParam, readSearchParamAlias } from "@/lib/utils/query";

const SEARCH_PATH = "/tim-kiem/";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const [params, tCatalog, tSearch] = await Promise.all([
    searchParams,
    getTranslations("Catalog"),
    getTranslations("Search"),
  ]);
  const q = parseTextParam(readSearchParamAlias(params, "s", "q"), 100).value?.trim();
  return buildPublicMetadata({
    title: q ? tCatalog("searchResult", { query: q }) : tSearch("title"),
    description: tSearch("metaDescription"),
    canonicalPath: SEARCH_PATH,
    noIndex: true,
    ogType: "article",
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const [tCatalog, tSearch] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("Search"),
  ]);

  const catalog = parseCatalogListParams(params, {
    includeCategoryParam: true,
    queryParamKeys: ["s", "q"],
  });
  const { filters, validationErrors, orderbyCurrent } = catalog;

  const query = filters.q?.trim() ?? "";
  const hasQuery = query.length > 0 && validationErrors.length === 0;
  const heroTitle = query ? tCatalog("searchResult", { query }) : tSearch("title");

  const locale = await getLocale();
  const [settingsResult, brandsResult, categoriesResult] =
    await Promise.all([
      listPublicSettings(locale),
      listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
      listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    ]);

  // Tái dùng đúng hero của trang sản phẩm để trang tìm kiếm trông cùng một archive.
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_products");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
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

  // Chỉ truy vấn sản phẩm/facet khi có từ khoá hợp lệ — tránh liệt kê toàn bộ
  // sản phẩm cho lần tìm kiếm rỗng.
  const [result, facetsResult] = hasQuery
    ? await Promise.all([
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
        getCatalogFacets({ category: filters.category, q: filters.q, lang: locale }),
      ])
    : [null, null];

  const products = result?.data ?? [];
  const pagination = result?.pagination;
  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);

  const paginationBaseHref = catalog.buildPaginationHref(SEARCH_PATH);

  const notice =
    validationErrors.length > 0
      ? validationErrors.join(" ")
      : !hasQuery
        ? tSearch("emptyTitle")
        : result?.error && products.length === 0
          ? result.error.message
          : products.length === 0
            ? tSearch("noResultTitle", { query })
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
                  facets={facetsResult?.data}
                  current={catalog.currentFilters}
                  resetHref={SEARCH_PATH}
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
