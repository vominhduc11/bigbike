import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { listArticles, listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";
import { WpArticleListClient } from "./WpArticleListClient";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import { Tr } from "@/components/i18n/Tr";

// Shell — hero (settings "hero_news") + danh mục tin tức + danh sách bài view MẶC ĐỊNH
// (trang 1, chưa lọc) đều fetch ở server (revalidate tag "articles"/"settings") và truyền
// xuống → bài viết nằm trong HTML server (SEO). Lọc/tìm/phân trang do client tiếp quản.
// size phải khớp default WpArticleListClient (12) để query key trùng → dùng đúng initialData.
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

  const [settingsResult, categoriesResult, articlesResult] = await Promise.all([
    listPublicSettings(locale),
    listContentCategories(),
    listArticles({ page: 1, size: 12, sort: "publishedAt:desc", lang: locale }),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? "Tin tức";
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroMobileBgUrl = heroSettings.mobileImageUrl?.trim()
    ? toLegacyWpMediaUrl(resolveMediaUrl(heroSettings.mobileImageUrl.trim()))
    : null;
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
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4" />

      <div className="archive category">
        <WpCategoryHero
          focusId="hero_news"
          title={heroTitle}
          titleNode={heroSettings.title ? undefined : <Tr ns="Blog" k="title" />}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          mobileBgUrl={heroMobileBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <div className="container">
            <WpArticleListClient
              categories={sidebarCategories}
              initialArticles={articlesResult.data}
              initialPagination={articlesResult.pagination}
            />
          </div>
        </div>
      </div>
    </>
  );
}
