import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export const revalidate = 3600;

export async function generateStaticParams() {
  const result = await listArticles({ page: 1, size: 100, sort: "publishedAt:desc" });
  return (result.data ?? []).map((a) => ({ slug: a.slug }));
}

type ArticleDetailPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug = "" } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Bài viết không hợp lệ",
      description: "Slug bài viết không hợp lệ.",
      canonicalPath: toArticlePath("invalid"),
      noIndex: true,
    });
  }

  const result = await getArticleBySlug(slug);
  if (!result.data) {
    return buildPublicMetadata({
      title: "Không tìm thấy bài viết",
      description: "Không tìm thấy bài viết yêu cầu.",
      canonicalPath: toArticlePath(slug),
      noIndex: true,
    });
  }

  const article = result.data;
  return buildPublicMetadata({
    title: article.title,
    description: article.excerpt ?? "Chi tiết bài viết BigBike.",
    canonicalPath: toArticlePath(article.slug),
    noIndex: false,
    ogImage: article.coverImage?.url ?? undefined,
    ogType: "article",
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug = "" } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const result = await getArticleBySlug(slug);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }
  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={result.error?.message ?? "Không tải được bài viết."} />
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

  const articleTitle = safeText(article.title, "Bài viết");
  const articleCategory = safeText(article.category?.name, "Tin tức");
  const articleDate = article.publishedAt ?? article.createdAt;
  const categoryHref = article.category?.slug
    ? `${toArticleListPath()}?category=${encodeURIComponent(article.category.slug)}`
    : toArticleListPath();
  const relatedProducts = article.relatedProducts ?? [];
  const canonicalUrl = toCanonicalUrl(toArticlePath(article.slug));
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`;
  const twShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(articleTitle)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <PageHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        title={heroSettings.title ?? "Tin tức"}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Tin tức" },
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

        <h1 className="font-display text-[clamp(1.7rem,3vw,2.5rem)] uppercase tracking-[0.01em] leading-[1.15] m-0 mb-4 text-foreground">
          {articleTitle}
        </h1>

        {article.excerpt && (
          <p className="text-muted-foreground text-base leading-[1.7] m-0 mb-6">{article.excerpt}</p>
        )}

        <div
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(article.body) }}
        />

        <ArticleProducts products={relatedProducts} />

        {/* Social share */}
        <div className="flex items-center gap-[10px] mt-8 pt-5 border-t border-border flex-wrap">
          <span className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground">Chia sẻ:</span>
          <a
            href={fbShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] text-sm font-bold no-underline transition-opacity hover:opacity-80 bg-[#1877f2] text-white"
            aria-label="Chia sẻ lên Facebook"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1.75 3.5h-1c-.41 0-.5.19-.5.63V6h1.5l-.2 1.5H8.25V12h-1.5V7.5H6V6h.75V4.88C6.75 3.62 7.5 3 8.75 3c.58 0 1 .04 1 .04V4.5Z" />
            </svg>
            Facebook
          </a>
          <a
            href={twShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] text-sm font-bold no-underline transition-opacity hover:opacity-80 bg-[#1da1f2] text-white"
            aria-label="Chia sẻ lên Twitter"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23 4.6a8.3 8.3 0 0 1-2.4.66A4.18 4.18 0 0 0 22.4 3a8.36 8.36 0 0 1-2.65 1.02 4.16 4.16 0 0 0-7.1 3.8A11.8 11.8 0 0 1 4.2 3.5a4.16 4.16 0 0 0 1.29 5.55A4.1 4.1 0 0 1 3.6 8.5v.05a4.16 4.16 0 0 0 3.34 4.08 4.2 4.2 0 0 1-1.88.07 4.17 4.17 0 0 0 3.89 2.89A8.36 8.36 0 0 1 2 17.3a11.78 11.78 0 0 0 6.38 1.87c7.66 0 11.85-6.34 11.85-11.84 0-.18 0-.36-.01-.54A8.4 8.4 0 0 0 23 4.6Z" />
            </svg>
            Twitter
          </a>
        </div>
      </article>

      {/* Related articles — "TIN TỨC LIÊN QUAN" carousel */}
      {relatedArticles.length > 0 && (
        <section className="bb-container mt-4 pt-9 pb-[60px] border-t border-border">
          <p className="text-sm font-bold tracking-[0.16em] uppercase text-brand text-center m-0 mb-1">
            Có thể bạn quan tâm
          </p>
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-foreground text-center m-0 mb-8">
            Tin tức liên quan
          </h2>
          <ArticleCarousel articles={relatedArticles} />
        </section>
      )}
    </>
  );
}
