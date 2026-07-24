import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

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
import { toArticlePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { ArticleView } from "../../tin-tuc/[slug]/ArticleView";

// English article detail — real server-rendered page at its own URL. Chỉ tồn tại cho
// bài viết có `slugEn`; guard bên dưới 404 nếu param không khớp đúng slugEn
// (ARTICLE_RULE_003). Khuôn giống hệt app/tin-tuc/[slug]/page.tsx (bản VI), chỉ khác
// locale cố định "en" và canonical tự trỏ về chính URL này.
export async function generateStaticParams() {
  return [];
}

type ArticleDetailPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const [{ slug = "" }, t] = await Promise.all([params, getTranslations({ locale: "en", namespace: "Blog" })]);
  if (!isValidSlug(slug)) return {};

  const result = await getArticleBySlug(slug, "en");
  const article = result.data;
  if (!article || !article.slugEn || article.slugEn !== slug) return {};

  const canonicalPath = toArticlePath(article.slugEn, "en", true);
  return buildPublicMetadata({
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? t("articleDefaultDescription"),
    canonicalPath,
    locale: "en",
    noIndex: article.seo?.noIndex ?? false,
    ogImage: article.seo?.ogImage?.url ?? article.coverImage?.url ?? undefined,
    ogType: "article",
    languageAlternates: { vi: toArticlePath(article.slug), en: canonicalPath },
  });
}

export default async function ArticleDetailPageEn({ params }: ArticleDetailPageProps) {
  const { slug = "" } = await params;
  if (!isValidSlug(slug)) notFound();

  const result = await getArticleBySlug(slug, "en");
  const article = result.data;
  // Không khớp đúng slugEn của chính bài viết này → không có trang EN cho bản ghi
  // này — 404, không hiển thị trùng nội dung qua OR-resolve của backend.
  if (!article || !article.slugEn || article.slugEn !== slug) notFound();

  const settingsResult = await listPublicSettings("en");
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );

  const canonicalPath = toArticlePath(article.slugEn, "en", true);
  const [featuredResult, latestResult] = await Promise.all([
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", featured: true, lang: "en" }),
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", lang: "en" }),
  ]);

  const siteName = pickSetting(settingsResult.data ?? [], ["site_name"]);
  const articleJsonLd = serializeJsonLd(buildArticleJsonLd(article, siteName || undefined, undefined, canonicalPath));
  const breadcrumbJsonLd = serializeJsonLd(buildArticleBreadcrumbJsonLd(article, canonicalPath));

  const latestArticles = excludeArticle(latestResult.data ?? [], article.slug);
  const featuredArticles = excludeArticle(featuredResult.data ?? [], article.slug);
  const highlightedArticles = (featuredArticles.length ? featuredArticles : latestArticles).slice(0, 5);
  const newestArticles = latestArticles.slice(0, 5);
  const relatedArticles = latestArticles.slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <AltSlugRegistrar kind="article" viSlug={article.slug} enSlug={article.slugEn} />
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
