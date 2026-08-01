import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHero } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { getArticleBySlug, listArticles, listPublicSettings } from "@/lib/api/public-api";
import type { Article } from "@/lib/contracts/public";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { pickSetting } from "@/lib/utils/settings";
import { toArticleListPath, toArticlePath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { Tr } from "@/components/i18n/Tr";
import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { ArticleView } from "./ArticleView";
import type { Locale } from "@/i18n/locale";

// ISR on-demand: bài viết là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Trả [] để
// sinh khi truy cập lần đầu + revalidate theo tag article:{slug}/articles khi admin sửa.
export async function generateStaticParams() {
  return [];
}

type ArticleDetailPageProps = Readonly<{
  params: Promise<{ locale: string; slug: string }>;
}>;

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug = "", locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Blog");
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: t("articleInvalidTitle"),
      description: t("articleInvalidDescription"),
      canonicalPath: toArticlePath("invalid", locale),
      noIndex: true,
    });
  }

  const result = await getArticleBySlug(slug, locale);
  if (!result.data) {
    return buildPublicMetadata({
      title: t("articleNotFoundTitle"),
      description: t("articleNotFoundDescription"),
      canonicalPath: toArticlePath(slug, locale),
      noIndex: true,
    });
  }

  const article = result.data;
  const preferredSlug = locale === "en" ? article.slugEn?.trim() || article.slug : article.slug;
  const canonicalPath = toArticlePath(preferredSlug, locale);
  return buildPublicMetadata({
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? t("articleDefaultDescription"),
    canonicalPath,
    locale,
    noIndex: article.seo?.noIndex ?? false,
    ogImage: article.seo?.ogImage?.url ?? article.coverImage?.url ?? undefined,
    ogType: "article",
    // hreflang vi/en khi bài viết có slug tiếng Anh riêng (ARTICLE_RULE_003).
    languageAlternates: {
      vi: toArticlePath(article.slug, "vi"),
      en: toArticlePath(article.slugEn?.trim() || article.slug, "en"),
    },
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug = "", locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Blog");
  if (!isValidSlug(slug)) {
    notFound();
  }

  const result = await getArticleBySlug(slug, locale);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }

  if (result.data) {
    const preferredSlug = locale === "en" ? result.data.slugEn?.trim() || result.data.slug : result.data.slug;
    if (slug !== preferredSlug) permanentRedirect(toArticlePath(preferredSlug, locale));
  }

  const [settingsResult] = await Promise.all([listPublicSettings(locale)]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );

  if (!result.data) {
    const errorTitle = t("articleNotFoundTitle");
    return (
      <div>
          <PageHero
            title={errorTitle}
            breadcrumb={[
              { label: "Bigbike.vn", href: toHomePath(locale) },
              { label: t("breadcrumb"), href: toArticleListPath(locale) },
              { label: errorTitle },
            ]}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={errorTitle}
          />
          <div id="main-content">
            <Container className="pb-10">
              <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground"><Tr ns="Blog" k="loadFailed" /></p>
            </Container>
          </div>
      </div>
    );
  }

  const article = result.data;
  const [featuredResult, latestResult] = await Promise.all([
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", featured: true, lang: locale }),
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", lang: locale }),
  ]);

  const siteName = pickSetting(settingsResult.data ?? [], ["site_name"]);
  const preferredSlug = locale === "en" ? article.slugEn?.trim() || article.slug : article.slug;
  const canonicalPath = toArticlePath(preferredSlug, locale);
  const articleJsonLd = serializeJsonLd(
    buildArticleJsonLd(article, siteName || undefined, undefined, canonicalPath),
  );
  const breadcrumbJsonLd = serializeJsonLd(buildArticleBreadcrumbJsonLd(article, canonicalPath));

  // SEO sống ở server component; phần thân hiển thị do <ArticleView> đảm nhiệm (dùng
  // chung với khung xem trước của admin).
  const latestArticles = excludeArticle(latestResult.data ?? [], article.slug);
  const featuredArticles = excludeArticle(featuredResult.data ?? [], article.slug);
  const highlightedArticles = (featuredArticles.length ? featuredArticles : latestArticles).slice(0, 5);
  const newestArticles = latestArticles.slice(0, 5);
  const relatedArticles = latestArticles.slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <AltSlugRegistrar kind="article" viSlug={article.slug} enSlug={article.slugEn ?? null} />
      <ArticleView
        article={article}
        heroBgUrl={heroBgUrl}
        heroIllustrationUrl={heroIllustrationUrl}
        highlighted={highlightedArticles}
        newest={newestArticles}
        related={relatedArticles}
      />
    </>
  );
}

function excludeArticle(articles: Article[], currentSlug: string): Article[] {
  return articles.filter((item) => item.slug !== currentSlug);
}
