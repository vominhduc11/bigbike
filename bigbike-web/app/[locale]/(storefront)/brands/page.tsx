import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { Tr } from "@/components/i18n/Tr";
import { listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toBrandListPath, toHomePath } from "@/lib/utils/routes";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { BrandListClient } from "./BrandListClient";
import { BrandListDefault } from "./BrandListDefault";
import type { Locale } from "@/i18n/locale";

// Shell + hero. Lưới thương hiệu view MẶC ĐỊNH (trang 1, sắp xếp tên A→Z) fetch sẵn ở
// server (revalidate theo tag "brands") và truyền xuống → nằm trong HTML server (SEO).
// Phân trang/đổi sắp xếp do client tiếp quản theo searchParams.
//
// size/sort phải khớp default của BrandListClient (DEFAULT_PAGE_SIZE=12, name:asc)
// để query key trùng → dùng đúng initialData, không lệch hydrate.
type BrandListPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: BrandListPageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Catalog");
  return buildPublicMetadata({
    title: t("brandsTitle"),
    description: t("brandsMetaDescription"),
    canonicalPath: toBrandListPath(locale),
    locale,
    languageAlternates: { vi: toBrandListPath("vi"), en: toBrandListPath("en") },
  });
}

export default async function BrandListPage({ params }: BrandListPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Catalog");
  const [brandsResult, settingsResult] = await Promise.all([
    listBrands({ page: 1, size: 12, sort: "name:asc", lang: locale }),
    listPublicSettings(locale),
  ]);

  // Hero trang Thương hiệu: ưu tiên cấu hình admin (hero_brands_*), fallback mặc định theme.
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_brands");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? t("brandsTitle");
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.illustrationUrl?.trim()) || defaultHero.defaultIllustrationUrl?.trim(),
  );

  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath(locale) },
    { label: t("brandsTitle"), labelNode: <Tr ns="Catalog" k="brandsTitle" /> },
  ];

  return (
    <div>
        <PageHero
          focusId="hero_brands"
          title={heroTitle}
          titleNode={heroSettings.title ? heroTitle : <Tr ns="Catalog" k="brandsTitle" />}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <Container>
            <Suspense
              fallback={
                <BrandListDefault
                  brands={brandsResult.data}
                  pagination={brandsResult.pagination}
                  locale={locale}
                />
              }
            >
              <BrandListClient
                initialBrands={brandsResult.data}
                initialPagination={brandsResult.pagination}
              />
            </Suspense>
          </Container>
        </div>
    </div>
  );
}
