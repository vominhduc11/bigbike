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
import { Button } from "@/components/ui/button";
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
    title: article.title,
    description: article.excerpt ?? "Chi tiết bài viết BigBike.",
    canonicalPath: toArticlePath(article.slug),
    noIndex: false,
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

      <div className="bb-container py-4 text-muted-foreground flex flex-wrap items-center [&_a]:text-muted-foreground [&_a]:font-semibold [&_a]:no-underline [&_a:hover]:text-brand">
        <Link href="/">Trang chủ</Link>
        <span className="text-brand mx-[10px]">/</span>
        <Link href="/tin-tuc/">Tin tức</Link>
        {article.category?.name && (
          <>
            <span className="text-brand mx-[10px]">/</span>
            <span>{article.category.name}</span>
          </>
        )}
        <span className="text-brand mx-[10px]">/</span>
        <span>{articleTitle}</span>
      </div>

      <div className="grid grid-cols-1 max-w-[1200px] mx-auto mb-[60px] px-6 gap-10 lg:grid-cols-[8fr_4fr] lg:items-start">
       <div className="min-w-0 p-0">
        <header className="mb-7 p-[28px_32px] border border-border [background:radial-gradient(circle_at_88%_0%,rgba(255,12,9,0.18),transparent_32%),linear-gradient(145deg,#111,#171717)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-[14px] text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase">
            <Link
              href={categoryHref}
              className="inline-flex items-center min-h-[28px] px-[10px] border border-brand rounded-full bg-brand/[0.4] text-white no-underline transition-all hover:text-brand hover:bg-brand/[0.18]"
            >
              {articleCategory}
            </Link>
            {article.author?.name ? (
              <span className="inline-flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:rounded-full before:bg-brand before:opacity-75">
                {article.author.name}
              </span>
            ) : null}
            <time dateTime={articleDate} className="inline-flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:rounded-full before:bg-brand before:opacity-75">
              {formatDate(articleDate)}
            </time>
          </div>
          <h1 className="font-display text-[clamp(1.8rem,3vw,2.6rem)] uppercase tracking-[0.01em] leading-[1.1] m-0 mb-[14px] text-white">{articleTitle}</h1>
          {article.excerpt && (
            <p className="text-muted-foreground text-[15px] leading-[1.65] m-0">{article.excerpt}</p>
          )}
          {article.tags && article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-[18px]" aria-label="Thẻ bài viết">
              {article.tags.slice(0, 8).map((tag) => (
                <span key={tag} className="border border-border rounded-full px-[10px] py-[5px] text-muted-foreground text-[11px] font-bold tracking-[0.08em] uppercase">{tag}</span>
              ))}
            </div>
          ) : null}
        </header>

        {article.coverImage && (
          <div className="overflow-hidden mb-8 bg-card border border-border">
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
          data-article-body=""
          className="bb-richtext bg-card border border-border px-[34px] py-[30px]"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(article.body) }}
        />

        {/* Social share */}
        <div className="flex items-center gap-[10px] mt-6 pt-5 border-t border-border flex-wrap">
          <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-muted-foreground">Chia sẻ:</span>
          <a
            href={fbShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] text-xs font-bold no-underline transition-opacity hover:opacity-80 bg-[#1877f2] text-white"
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
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] text-xs font-bold no-underline transition-opacity hover:opacity-80 bg-[#0068ff] text-white"
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

        <nav className="flex flex-wrap gap-3 mt-7" aria-label="Điều hướng bài viết">
          <Button asChild variant="secondary">
            <Link href={toArticleListPath()}>Tất cả bài viết</Link>
          </Button>
          {article.category?.slug ? (
            <Button asChild variant="primary">
              <Link href={categoryHref}>Xem cùng danh mục</Link>
            </Button>
          ) : null}
        </nav>
       </div>

       <aside className="min-w-0" aria-label="Tin tức nổi bật">
        {featuredArticles.length > 0 && (
          <div className="bg-white border border-border p-5 mb-5">
            <h3 className="font-display text-[1.143rem] font-semibold text-foreground mb-4 pb-3 border-b-2 border-brand uppercase tracking-normal m-0">TIN TỨC NỔI BẬT</h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-[14px]">
              {featuredArticles.map((a) => (
                <li key={a.id} className="block">
                  <Link href={toArticlePath(a.slug)} className="group grid grid-cols-[90px_1fr] gap-3 no-underline text-inherit items-start">
                    {a.coverImage?.url && (
                      <span className="block aspect-[4/3] overflow-hidden bg-[#f2f2f2]">
                        <MediaImage image={a.coverImage} altFallback={a.title} width={120} height={90} className="w-full h-full object-cover" />
                      </span>
                    )}
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="font-display text-[11px] font-semibold text-brand uppercase tracking-[0.04em]">
                        {safeText(a.category?.name, "Tin tức")}
                      </span>
                      <span className="font-display font-semibold text-sm leading-[1.3] text-foreground line-clamp-2 group-hover:text-brand">{safeText(a.title, "Bài viết")}</span>
                      <time dateTime={a.publishedAt ?? a.createdAt} className="text-xs text-muted-foreground font-body">
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
          <div className="bg-white border border-border p-5 mb-5">
            <h3 className="font-display text-[1.143rem] font-semibold text-foreground mb-4 pb-3 border-b-2 border-brand uppercase tracking-normal m-0">TIN TỨC MỚI</h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-[14px]">
              {recentArticles.map((a) => (
                <li key={a.id} className="block">
                  <Link href={toArticlePath(a.slug)} className="group grid grid-cols-[90px_1fr] gap-3 no-underline text-inherit items-start">
                    {a.coverImage?.url && (
                      <span className="block aspect-[4/3] overflow-hidden bg-[#f2f2f2]">
                        <MediaImage image={a.coverImage} altFallback={a.title} width={120} height={90} className="w-full h-full object-cover" />
                      </span>
                    )}
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="font-display text-[11px] font-semibold text-brand uppercase tracking-[0.04em]">
                        {safeText(a.category?.name, "Tin tức")}
                      </span>
                      <span className="font-display font-semibold text-sm leading-[1.3] text-foreground line-clamp-2 group-hover:text-brand">{safeText(a.title, "Bài viết")}</span>
                      <time dateTime={a.publishedAt ?? a.createdAt} className="text-xs text-muted-foreground font-body">
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
        <section className="bb-container mt-12 pt-9 border-t border-border">
          <h2 className="text-base font-extrabold uppercase tracking-[0.08em] text-foreground mb-6 m-0">TIN TỨC LIÊN QUAN</h2>
          <div className="grid grid-cols-1 gap-[22px] pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedArticles.slice(0, 4).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
