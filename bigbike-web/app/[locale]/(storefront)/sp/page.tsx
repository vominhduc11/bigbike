import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { CatalogDefault } from "@/components/catalog/CatalogDefault";
import { getCatalogFacets, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath, toProductListPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import type { RouteSearchParams } from "@/lib/utils/query";

export const dynamic = "force-dynamic";

// Shell + hero lấy từ settings (admin quản lý, revalidate theo tag "settings"). Lưới
// sản phẩm và facets được fetch đúng theo searchParams ở server để URL lọc mở thẳng
// không chớp dữ liệu mặc định. Sau hydrate, client tiếp quản các lần đổi tiếp theo.
type ProductListPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<RouteSearchParams>;
};

export async function generateMetadata({ params }: ProductListPageProps): Promise<Metadata> {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const tCatalog = await getTranslations("Catalog");
  return buildPublicMetadata({
    title: tCatalog("title"),
    description: tCatalog("metadataDescription"),
    canonicalPath: toProductListPath(locale),
    locale,
    languageAlternates: { vi: toProductListPath("vi"), en: toProductListPath("en") },
  });
}

export default async function ProductListPage({ params, searchParams }: ProductListPageProps) {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  const catalog = parseCatalogListParams((await searchParams) ?? {}, {
    includeCategoryParam: true,
  });
  setRequestLocale(locale);
  const tCatalog = await getTranslations("Catalog");

  const [settingsResult, facetsResult, productsResult] = await Promise.all([
    listPublicSettings(locale),
    getCatalogFacets({
      category: catalog.filters.category,
      brand: catalog.filters.brand,
      q: catalog.filters.q,
      filterColor: catalog.filters.color,
      filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender,
      sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice,
      maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock,
      lang: locale,
    }),
    listProducts({
      page: catalog.page,
      size: catalog.size,
      sort: catalog.productSort,
      category: catalog.filters.category,
      brand: catalog.filters.brand,
      q: catalog.filters.q,
      filterColor: catalog.filters.color,
      filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender,
      sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice,
      maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock,
      lang: locale,
    }),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_products");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const configuredHeroTitle = heroSettings.title?.trim();
  const heroTitle =
    configuredHeroTitle === "Tất cả sản phẩm1"
      ? tCatalog("allProducts")
      : configuredHeroTitle || tCatalog("allProducts");
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.illustrationUrl?.trim()) ||
      defaultHero.defaultIllustrationUrl?.trim(),
  );
  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath(locale) },
    { label: heroTitle },
  ];

  const canonicalPath = toProductListPath(locale);

  return (
    <div>
      <PageHero
        className="mb-4 md:mb-22.5"
        focusId="hero_products hero_default"
        title={heroTitle}
        breadcrumb={heroBreadcrumb}
        bgUrl={heroBgUrl}
        illustrationUrl={heroIllustrationUrl}
        illustrationAlt={heroSettings.imageAlt ?? heroTitle}
      />

      <div id="main-content">
        <Container>
          <Suspense
            fallback={
              <CatalogDefault
                canonicalPath={canonicalPath}
                products={productsResult.data}
                pagination={productsResult.pagination}
                error={Boolean(productsResult.error || facetsResult.error)}
              />
            }
          >
            <CatalogClient
              canonicalPath={canonicalPath}
              facets={facetsResult.data}
              initialProducts={productsResult.data}
              initialPagination={productsResult.pagination}
              initialProductsError={Boolean(productsResult.error)}
              initialFacetsError={Boolean(facetsResult.error)}
              includeCategoryParam
            />
          </Suspense>
        </Container>
      </div>
    </div>
  );
}
