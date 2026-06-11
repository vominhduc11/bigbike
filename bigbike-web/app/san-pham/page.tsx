import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCatalogClient } from "@/components/wp/WpCatalogClient";
import { getCatalogFacets, listBrands, listCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath, toProductListPath } from "@/lib/utils/routes";

// Shell tĩnh (ISR) — hero lấy từ settings (admin quản lý, revalidate theo tag "settings").
// Lưới sản phẩm (lọc/phân trang/tìm theo searchParams) render ở CLIENT qua WpCatalogClient
// → trang không phụ thuộc searchParams → tĩnh được, không SSR.
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

  const [settingsResult, brandsResult, categoriesResult, facetsResult] = await Promise.all([
    listPublicSettings(locale),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ lang: locale }),
  ]);

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

  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);
  const canonicalPath = toProductListPath();

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
            <WpCatalogClient
              canonicalPath={canonicalPath}
              brands={brandsResult.data}
              categories={filterCategories}
              facets={facetsResult.data}
              includeCategoryParam
            />
          </div>
        </div>
      </div>
    </>
  );
}
