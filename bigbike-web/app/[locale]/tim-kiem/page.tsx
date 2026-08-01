import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { getCatalogFacets, listBrands, listCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

const SEARCH_PATH = "/tim-kiem/";

// Trang tìm kiếm: shell tĩnh (hero + sidebar), KẾT QUẢ tìm theo searchParams (s/q + filter)
// render ở CLIENT qua CatalogClient (requireQuery — chỉ fetch khi có từ khoá). noIndex.
type SearchPageProps = { params: Promise<{ locale: string }> };

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

export default async function SearchPage({ params }: SearchPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const tSearch = await getTranslations("Search");

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
  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath(locale) },
    { label: heroTitle },
  ];

  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);

  return (
    <div>
        <PageHero
          title={heroTitle}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <Container>
            <Suspense fallback={null}>
              <CatalogClient
                canonicalPath={SEARCH_PATH}
                brands={brandsResult.data}
                categories={filterCategories}
                facets={facetsResult.data}
                includeCategoryParam
                queryParamKeys={["s", "q"]}
                requireQuery
              />
            </Suspense>
          </Container>
        </div>
    </div>
  );
}
