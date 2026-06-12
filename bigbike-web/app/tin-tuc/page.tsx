import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";
import { WpArticleListClient } from "./WpArticleListClient";
import { Tr } from "@/components/i18n/Tr";

// Shell tĩnh (ISR) — hero (settings "hero_news") + danh mục tin tức (admin quản lý,
// revalidate tag "articles"/"settings"). Danh sách bài (lọc/tìm/phân trang theo
// searchParams) render ở CLIENT qua WpArticleListClient → trang không SSR.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Blog");
  return buildPublicMetadata({
    title: t("title"),
    description: t("metaDescription"),
    canonicalPath: toArticleListPath(),
  });
}

export default async function ArticleListPage() {
  const t = await getTranslations("Blog");
  const locale = await getLocale();

  const [settingsResult, categoriesResult] = await Promise.all([
    listPublicSettings(locale),
    listContentCategories(),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? "Tin tức";
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );
  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: t("breadcrumb"), labelNode: <Tr ns="Blog" k="breadcrumb" /> },
  ];

  const sidebarCategories = categoriesResult.data.filter((cat) => cat.articleCount > 0);

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4"
        precedence="default"
      />

      <div className="archive category">
        <WpCategoryHero
          title={heroTitle}
          titleNode={heroSettings.title ? undefined : <Tr ns="Blog" k="title" />}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <div className="container">
            <WpArticleListClient categories={sidebarCategories} />
          </div>
        </div>
      </div>
    </>
  );
}
