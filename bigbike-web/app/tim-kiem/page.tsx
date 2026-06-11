import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCatalogClient } from "@/components/wp/WpCatalogClient";
import { getCatalogFacets, listBrands, listCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath } from "@/lib/utils/routes";

const SEARCH_PATH = "/tim-kiem/";

// Trang tìm kiếm: shell tĩnh (hero + sidebar), KẾT QUẢ tìm theo searchParams (s/q + filter)
// render ở CLIENT qua WpCatalogClient (requireQuery — chỉ fetch khi có từ khoá). noIndex.
export async function generateMetadata(): Promise<Metadata> {
  const tSearch = await getTranslations("Search");
  return buildPublicMetadata({
    title: tSearch("title"),
    description: tSearch("metaDescription"),
    canonicalPath: SEARCH_PATH,
    noIndex: true,
    ogType: "article",
  });
}

export default async function SearchPage() {
  const tSearch = await getTranslations("Search");
  const locale = await getLocale();

  const [settingsResult, brandsResult, categoriesResult, facetsResult] = await Promise.all([
    listPublicSettings(locale),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ lang: locale }),
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
  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: heroTitle },
  ];

  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);

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
              canonicalPath={SEARCH_PATH}
              brands={brandsResult.data}
              categories={filterCategories}
              facets={facetsResult.data}
              includeCategoryParam
              queryParamKeys={["s", "q"]}
              requireQuery
            />
          </div>
        </div>
      </div>
    </>
  );
}
