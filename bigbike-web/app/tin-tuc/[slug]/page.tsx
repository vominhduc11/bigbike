import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getArticleBySlug } from "@/lib/api/public-api";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toArticleListPath, toArticlePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

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
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? "Chi tiết bài viết BigBike.",
    canonicalPath: article.seo?.canonicalUrl ?? toArticlePath(article.slug),
    noIndex: article.seo?.noIndex ?? false,
    ogImage: article.coverImage?.url ?? undefined,
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
  const articleJsonLd = serializeJsonLd(buildArticleJsonLd(article));
  const breadcrumbJsonLd = serializeJsonLd(buildArticleBreadcrumbJsonLd(article));

  const articleTitle = safeText(article.title, "Bài viết");
  const articleCategory = safeText(article.category?.name, "Tin tức");
  const articleDate = article.publishedAt ?? article.createdAt;
  const categoryHref = article.category?.slug
    ? `${toArticleListPath()}?category=${encodeURIComponent(article.category.slug)}`
    : toArticleListPath();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <div className="wp-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <Link href="/tin-tuc/">Tin tức</Link>
        {article.category?.name && (
          <>
            <span className="sep">/</span>
            <span>{article.category.name}</span>
          </>
        )}
        <span className="sep">/</span>
        <span>{articleTitle}</span>
      </div>

      <div className="wp-article-wrap">
        <header className="wp-article-header">
          <div className="wp-article-meta-row">
            <Link href={categoryHref} className="wp-article-meta-chip">
              {articleCategory}
            </Link>
            {article.author?.name ? <span>{article.author.name}</span> : null}
            <time dateTime={articleDate}>{formatDate(articleDate)}</time>
          </div>
          <h1 className="wp-article-h1">{articleTitle}</h1>
          {article.excerpt && (
            <p className="wp-article-excerpt">{article.excerpt}</p>
          )}
          {article.tags && article.tags.length > 0 ? (
            <div className="wp-article-tags" aria-label="Thẻ bài viết">
              {article.tags.slice(0, 8).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </header>

        {article.coverImage && (
          <div className="wp-cover-image">
            <MediaImage
              image={article.coverImage}
              altFallback={articleTitle}
              width={1600}
              height={900}
              priority
            />
          </div>
        )}

        <article
          className="bb-richtext wp-article-body"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(article.body) }}
        />

        <nav className="wp-article-footer-nav" aria-label="Điều hướng bài viết">
          <Link href={toArticleListPath()} className="bb-button bb-button-secondary">
            Tất cả bài viết
          </Link>
          {article.category?.slug ? (
            <Link href={categoryHref} className="bb-button bb-button-primary">
              Xem cùng danh mục
            </Link>
          ) : null}
        </nav>
      </div>
    </>
  );
}
