import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { listArticles, listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";
import { ArticleListClient } from "./ArticleListClient";
import { ArticleListDefault } from "./ArticleListDefault";
import { Tr } from "@/components/i18n/Tr";
import type { Locale } from "@/i18n/locale";

// Shell — hero (settings "hero_news") + danh mục tin tức + danh sách bài view MẶC ĐỊNH
// (trang 1, chưa lọc) đều fetch ở server (revalidate tag "articles"/"settings") và truyền
// xuống → bài viết nằm trong HTML server (SEO). Lọc/tìm/phân trang do client tiếp quản.
// size phải khớp default ArticleListClient (12) để query key trùng → dùng đúng initialData.
type ArticleListPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ArticleListPageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Blog");
  return buildPublicMetadata({
    title: t("title"),
    description: t("metaDescription"),
    canonicalPath: toArticleListPath(locale),
    locale,
    languageAlternates: { vi: toArticleListPath("vi"), en: toArticleListPath("en") },
  });
}

export default async function ArticleListPage({ params }: ArticleListPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Blog");

  const [settingsResult, categoriesResult, articlesResult] = await Promise.all([
    listPublicSettings(locale),
    listContentCategories(),
    listArticles({ page: 1, size: 12, sort: "publishedAt:desc", lang: locale }),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? t("title");
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.illustrationUrl?.trim()) || defaultHero.defaultIllustrationUrl?.trim(),
  );
  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath(locale) },
    { label: t("breadcrumb"), labelNode: <Tr ns="Blog" k="breadcrumb" /> },
  ];

  const sidebarCategories = categoriesResult.data.filter((cat) => cat.articleCount > 0);

  return (
    <div>
        <PageHero
          focusId="hero_news"
          title={heroTitle}
          titleNode={heroSettings.title ? undefined : <Tr ns="Blog" k="title" />}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <Container>
            <Suspense
              fallback={
                <ArticleListDefault
                  categories={sidebarCategories}
                  articles={articlesResult.data}
                  pagination={articlesResult.pagination}
                  locale={locale}
                />
              }
            >
              <ArticleListClient
                categories={sidebarCategories}
                initialArticles={articlesResult.data}
                initialPagination={articlesResult.pagination}
              />
            </Suspense>
          </Container>
        </div>
    </div>
  );
}
