import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ArticleCarousel } from "@/components/content/ArticleCarousel";
import { ArticleProducts } from "@/components/content/ArticleProducts";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getArticleBySlug, listArticles, listPublicSettings } from "@/lib/api/public-api";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { readHeroSettings } from "@/lib/utils/page-hero";
import { toArticleListPath, toArticlePath, toCanonicalUrl, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

// Locale is read from a cookie (next-intl) — opt into dynamic rendering.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listArticles({ page: 1, size: 100, sort: "publishedAt:desc" });
  return (result.data ?? []).map((a) => ({ slug: a.slug }));
}

type ArticleDetailPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const [{ slug = "" }, t] = await Promise.all([params, getTranslations("Blog")]);
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: t("articleInvalidTitle"),
      description: t("articleInvalidDescription"),
      canonicalPath: toArticlePath("invalid"),
      noIndex: true,
    });
  }

  const locale = await getLocale();
  const result = await getArticleBySlug(slug, locale);
  if (!result.data) {
    return buildPublicMetadata({
      title: t("articleNotFoundTitle"),
      description: t("articleNotFoundDescription"),
      canonicalPath: toArticlePath(slug),
      noIndex: true,
    });
  }

  const article = result.data;
  return buildPublicMetadata({
    title: article.title,
    description: article.excerpt ?? t("articleDefaultDescription"),
    canonicalPath: toArticlePath(article.slug),
    noIndex: false,
    ogImage: article.coverImage?.url ?? undefined,
    ogType: "article",
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const [{ slug = "" }, t, tBreadcrumb] = await Promise.all([
    params,
    getTranslations("Blog"),
    getTranslations("Breadcrumb"),
  ]);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const locale = await getLocale();
  const result = await getArticleBySlug(slug, locale);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }
  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={result.error?.message ?? t("loadFailed")} />
        </div>
      </section>
    );
  }

  const article = result.data;
  const [articleJsonLd, breadcrumbJsonLd, relatedResult, settingsResult] = await Promise.all([
    Promise.resolve(serializeJsonLd(buildArticleJsonLd(article))),
    Promise.resolve(serializeJsonLd(buildArticleBreadcrumbJsonLd(article))),
    listArticles({
      page: 1,
      size: 8,
      sort: "publishedAt:desc",
      category: article.category?.slug,
    }),
    listPublicSettings(),
  ]);
  const relatedArticles = (relatedResult.data ?? []).filter((a) => a.slug !== article.slug);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");

  const articleTitle = safeText(article.title, t("articleTitleFallback"));
  const articleCategory = safeText(article.category?.name, t("articleCategoryFallback"));
  const articleDate = article.publishedAt ?? article.createdAt;
  const categoryHref = article.category?.slug
    ? `${toArticleListPath()}?category=${encodeURIComponent(article.category.slug)}`
    : toArticleListPath();
  const relatedProducts = article.relatedProducts ?? [];
  const canonicalUrl = toCanonicalUrl(toArticlePath(article.slug));
  const breadcrumbTitle =
    articleTitle.length > 50 ? articleTitle.slice(0, 50) + "…" : articleTitle;
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`;
  const xShareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(articleTitle)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <PageHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        title={heroSettings.title ?? t("title")}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb"), href: toArticleListPath() },
          { label: breadcrumbTitle },
        ]}
      />

      <article className="max-w-[860px] mx-auto px-6 pt-8 pb-[60px]">
        {article.coverImage && (
          <div className="overflow-hidden mb-6 bg-card border border-border">
            <MediaImage
              image={article.coverImage}
              altFallback={articleTitle}
              width={1600}
              height={900}
              priority
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-sm font-bold tracking-[0.12em] uppercase text-brand">
          <Link href={categoryHref} className="text-brand no-underline hover:opacity-80">
            {articleCategory}
          </Link>
          <span aria-hidden="true">/</span>
          <time dateTime={articleDate} className="text-muted-foreground">
            {formatDate(articleDate)}
          </time>
        </div>

        <h1 className="font-display text-[clamp(1.7rem,3vw,2.5rem)] uppercase tracking-[0.01em] leading-[1.15] m-0 mb-4 text-foreground pr-14 sm:pr-0">
          {articleTitle}
        </h1>

        {article.excerpt && (
          <p className="text-muted-foreground text-base leading-[1.7] m-0 mb-6">{article.excerpt}</p>
        )}

        <div
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(article.body) }}
        />

        <ArticleProducts products={relatedProducts} title={t("relatedProductsHeading")} />

        {/* Social share */}
        <div className="flex items-center gap-[10px] mt-8 pt-5 border-t border-border flex-wrap">
          <span className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground">{t("shareLabel")}</span>
          <a
            href={fbShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] text-sm font-bold no-underline transition-opacity hover:opacity-80 bg-social-facebook text-white"
            aria-label={t("shareToFacebook")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1.75 3.5h-1c-.41 0-.5.19-.5.63V6h1.5l-.2 1.5H8.25V12h-1.5V7.5H6V6h.75V4.88C6.75 3.62 7.5 3 8.75 3c.58 0 1 .04 1 .04V4.5Z" />
            </svg>
            Facebook
          </a>
          <a
            href={xShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] text-sm font-bold no-underline transition-opacity hover:opacity-80 bg-foreground text-background"
            aria-label={t("shareToX")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            X
          </a>
        </div>
      </article>

      {relatedArticles.length > 0 && (
        <section className="bb-container mt-4 pt-9 pb-[60px] border-t border-border">
          <p className="text-sm font-bold tracking-[0.16em] uppercase text-brand text-center m-0 mb-1">
            {t("relatedKicker")}
          </p>
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-foreground text-center m-0 mb-8">
            {t("relatedHeading")}
          </h2>
          <ArticleCarousel articles={relatedArticles} />
        </section>
      )}
    </>
  );
}
