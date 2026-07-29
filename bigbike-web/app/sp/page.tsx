import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { CatalogDefault } from "@/components/catalog/CatalogDefault";
import { getCatalogFacets, listBrands, listCategories, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { DEFAULT_PRODUCT_PAGE_SIZE, DEFAULT_PRODUCT_SORT } from "@/lib/constants/catalog";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath, toProductListPath } from "@/lib/utils/routes";

// Shell + hero lấy từ settings (admin quản lý, revalidate theo tag "settings"). Lưới
// sản phẩm view MẶC ĐỊNH (page 1, sort mặc định, chưa lọc) fetch sẵn ở server và
// truyền xuống CatalogClient → nằm trong HTML server (SEO). Khi khách lọc/sắp xếp/
// sang trang, client tiếp quản fetch theo searchParams.
export async function generateMetadata(): Promise<Metadata> {
  const tCatalog = await getTranslations("Catalog");
  return buildPublicMetadata({
    title: tCatalog("title"),
    description: tCatalog("metadataDescription"),
    canonicalPath: toProductListPath(),
  });
}

export default async function ProductListPage() {
  const tCatalog = await getTranslations("Catalog");
  const locale = await getLocale();

  const [settingsResult, brandsResult, categoriesResult, facetsResult, productsResult] = await Promise.all([
    listPublicSettings(locale),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ lang: locale }),
    listProducts({ page: 1, size: DEFAULT_PRODUCT_PAGE_SIZE, sort: DEFAULT_PRODUCT_SORT, lang: locale }),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_products");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? tCatalog("allProducts");
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.illustrationUrl?.trim()) || defaultHero.defaultIllustrationUrl?.trim(),
  );
  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: heroTitle },
  ];

  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);
  const canonicalPath = toProductListPath();

  return (
    <div>
        <PageHero
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
                  brands={brandsResult.data}
                  categories={filterCategories}
                  facets={facetsResult.data}
                  products={productsResult.data}
                  pagination={productsResult.pagination}
                />
              }
            >
              <CatalogClient
                canonicalPath={canonicalPath}
                brands={brandsResult.data}
                categories={filterCategories}
                facets={facetsResult.data}
                initialProducts={productsResult.data}
                initialPagination={productsResult.pagination}
                includeCategoryParam
              />
            </Suspense>
          </Container>
        </div>
    </div>
  );
}
