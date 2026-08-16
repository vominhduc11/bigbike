import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { getCatalogFacets, listBrands, listCategories, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import type { RouteSearchParams } from "@/lib/utils/query";

const SEARCH_PATH = "/tim-kiem/";

// Trang tìm kiếm: kết quả và facets khớp searchParams (s/q + filter) được render từ
// server; CatalogClient tiếp quản sau hydrate. requireQuery vẫn ngăn liệt kê toàn bộ
// sản phẩm khi chưa có từ khoá. Trang luôn noIndex.
type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RouteSearchParams>;
};

export async function generateMetadata({ params }: SearchPageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const tSearch = await getTranslations("Search");
  return buildPublicMetadata({
    title: tSearch("title"),
    description: tSearch("metaDescription"),
    canonicalPath: translatePath(SEARCH_PATH, locale),
    locale,
    noIndex: true,
    ogType: "article",
  });
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  const catalog = parseCatalogListParams(await searchParams, {
    includeCategoryParam: true,
    queryParamKeys: ["s", "q"],
  });
  setRequestLocale(locale);
  const tSearch = await getTranslations("Search");

  const productPromise = catalog.filters.q
    ? listProducts({
        page: catalog.page, size: catalog.size, sort: catalog.productSort,
        category: catalog.filters.category, brand: catalog.filters.brand, q: catalog.filters.q,
        filterColor: catalog.filters.color, filterFinish: catalog.filters.finish,
        filterGender: catalog.filters.gender, sizeFilter: catalog.filters.size,
        minPrice: catalog.filters.minPrice, maxPrice: catalog.filters.maxPrice,
        inStock: catalog.filters.inStock, lang: locale,
      })
    : Promise.resolve({ data: [], pagination: null, error: null });
  const [settingsResult, brandsResult, categoriesResult, facetsResult, productsResult] = await Promise.all([
    listPublicSettings(locale),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({
      category: catalog.filters.category, brand: catalog.filters.brand, q: catalog.filters.q,
      filterColor: catalog.filters.color, filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender, sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice, maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock, lang: locale,
    }),
    productPromise,
  ]);

  const heroTitle = tSearch("title");
  // Tái dùng đúng hero của trang sản phẩm để trang tìm kiếm trông cùng một archive.
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_products");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );
  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath(locale) },
    { label: heroTitle },
  ];

  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);

  return (
    <div>
        <PageHero
          className="mb-4 md:mb-22.5"
          title={heroTitle}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <Container>
            {/* canonicalPath phải dịch theo locale: CatalogClient dùng nó làm gốc cho
                link phân trang (buildPaginationHref) và nút xoá lọc. Truyền thẳng
                SEARCH_PATH thì trang /en/search/ phát toàn bộ link về /tim-kiem/, kéo
                bản EN sang không gian URL tiếng Việt — generateMetadata ở trên đã
                dịch cho canonical, chỗ này phải khớp. */}
            <Suspense fallback={null}>
              <CatalogClient
                canonicalPath={translatePath(SEARCH_PATH, locale)}
                brands={brandsResult.data}
                categories={filterCategories}
                facets={facetsResult.data}
                includeCategoryParam
                queryParamKeys={["s", "q"]}
                requireQuery
                initialProducts={productsResult.data}
                initialPagination={productsResult.pagination}
              />
            </Suspense>
          </Container>
        </div>
    </div>
  );
}
