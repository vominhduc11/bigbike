import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/content/ArticleCard";
import { ArticleTOC } from "@/components/content/ArticleTOC";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getArticleBySlug, listArticles } from "@/lib/api/public-api";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toArticleListPath, toArticlePath, toCanonicalUrl } from "@/lib/utils/routes";
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
  const [articleJsonLd, breadcrumbJsonLd, relatedResult, recentResult, featuredResult] = await Promise.all([
    Promise.resolve(serializeJsonLd(buildArticleJsonLd(article))),
    Promise.resolve(serializeJsonLd(buildArticleBreadcrumbJsonLd(article))),
    listArticles({
      page: 1,
      size: 4,
      sort: "publishedAt:desc",
      category: article.category?.slug,
    }),
    listArticles({ page: 1, size: 5, sort: "publishedAt:desc" }),
    listArticles({ page: 1, size: 5, sort: "publishedAt:desc", featured: true }),
  ]);
  const relatedArticles = (relatedResult.data ?? []).filter((a) => a.slug !== article.slug);
  const recentArticles = (recentResult.data ?? []).filter((a) => a.slug !== article.slug).slice(0, 5);
  const featuredArticles = (featuredResult.data ?? []).filter((a) => a.slug !== article.slug).slice(0, 5);

  const articleTitle = safeText(article.title, "Bài viết");
  const articleCategory = safeText(article.category?.name, "Tin tức");
  const articleDate = article.publishedAt ?? article.createdAt;
  const categoryHref = article.category?.slug
    ? `${toArticleListPath()}?category=${encodeURIComponent(article.category.slug)}`
    : toArticleListPath();
  const canonicalUrl = toCanonicalUrl(toArticlePath(article.slug));
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`;
  const zaloShareUrl = `https://zalo.me/share?url=${encodeURIComponent(canonicalUrl)}&title=${encodeURIComponent(articleTitle)}`;

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

      <div className="wp-article-layout">
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

        <ArticleTOC />

        <article
          className="bb-richtext wp-article-body"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(article.body) }}
        />

        {/* Social share */}
        <div className="wp-article-share">
          <span className="wp-article-share-label">Chia sẻ:</span>
          <a
            href={fbShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wp-article-share-btn wp-article-share-fb"
            aria-label="Chia sẻ lên Facebook"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1.75 3.5h-1c-.41 0-.5.19-.5.63V6h1.5l-.2 1.5H8.25V12h-1.5V7.5H6V6h.75V4.88C6.75 3.62 7.5 3 8.75 3c.58 0 1 .04 1 .04V4.5Z" />
            </svg>
            Facebook
          </a>
          <a
            href={zaloShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wp-article-share-btn wp-article-share-zalo"
            aria-label="Chia sẻ qua Zalo"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" />
              <text x="8" y="11.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="currentColor">Z</text>
              <ellipse cx="8" cy="8" rx="5.5" ry="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            Zalo
          </a>
        </div>

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

       <aside className="wp-article-sidebar" aria-label="Tin tức nổi bật">
        {featuredArticles.length > 0 && (
          <div className="wp-article-widget">
            <h3 className="wp-article-widget-title">TIN TỨC NỔI BẬT</h3>
            <ul className="wp-article-widget-list">
              {featuredArticles.map((a) => (
                <li key={a.id} className="wp-article-widget-item">
                  <Link href={toArticlePath(a.slug)} className="wp-article-widget-link">
                    {a.coverImage?.url && (
                      <span className="wp-article-widget-thumb">
                        <MediaImage image={a.coverImage} altFallback={a.title} width={120} height={90} />
                      </span>
                    )}
                    <span className="wp-article-widget-body">
                      <span className="wp-article-widget-cat">
                        {safeText(a.category?.name, "Tin tức")}
                      </span>
                      <span className="wp-article-widget-name">{safeText(a.title, "Bài viết")}</span>
                      <time dateTime={a.publishedAt ?? a.createdAt} className="wp-article-widget-date">
                        {formatDate(a.publishedAt ?? a.createdAt)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {recentArticles.length > 0 && (
          <div className="wp-article-widget">
            <h3 className="wp-article-widget-title">TIN TỨC MỚI</h3>
            <ul className="wp-article-widget-list">
              {recentArticles.map((a) => (
                <li key={a.id} className="wp-article-widget-item">
                  <Link href={toArticlePath(a.slug)} className="wp-article-widget-link">
                    {a.coverImage?.url && (
                      <span className="wp-article-widget-thumb">
                        <MediaImage image={a.coverImage} altFallback={a.title} width={120} height={90} />
                      </span>
                    )}
                    <span className="wp-article-widget-body">
                      <span className="wp-article-widget-cat">
                        {safeText(a.category?.name, "Tin tức")}
                      </span>
                      <span className="wp-article-widget-name">{safeText(a.title, "Bài viết")}</span>
                      <time dateTime={a.publishedAt ?? a.createdAt} className="wp-article-widget-date">
                        {formatDate(a.publishedAt ?? a.createdAt)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
       </aside>
      </div>

      {/* Related articles — WP shows 4 in same category */}
      {relatedArticles.length > 0 && (
        <section className="wp-related-articles bb-container">
          <h2 className="wp-related-articles-title">TIN TỨC LIÊN QUAN</h2>
          <div className="wp-news-grid wp-news-grid--4">
            {relatedArticles.slice(0, 4).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
