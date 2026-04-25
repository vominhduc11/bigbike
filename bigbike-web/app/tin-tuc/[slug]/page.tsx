import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
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
import { toArticlePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

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

      <div style={{ maxWidth: 860, margin: "0 auto 60px", padding: "0 24px" }}>
        <header style={{ marginBottom: 28 }}>
          <p className="wp-pdp-info-brand" style={{ marginBottom: 12 }}>
            {article.category?.name ?? "Tin tức"}
            {article.author?.name ? ` · ${article.author.name}` : ""}
            {" · "}
            {formatDate(article.publishedAt ?? article.createdAt)}
          </p>
          <h1 style={{ fontFamily: "var(--bb-font-display)", fontSize: "clamp(1.8rem,3vw,2.4rem)", textTransform: "uppercase", letterSpacing: "0.01em", lineHeight: 1.1, margin: "0 0 14px" }}>
            {articleTitle}
          </h1>
          {article.excerpt && (
            <p style={{ color: "var(--bb-text-muted)", fontSize: 15, lineHeight: 1.6 }}>{article.excerpt}</p>
          )}
        </header>

        {article.coverImage && (
          <div style={{ borderRadius: 8, overflow: "hidden", marginBottom: 32, background: "#141414" }}>
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
          className="bb-richtext"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "28px 32px" }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(article.body) }}
        />

        <div style={{ marginTop: 32 }}>
          <Link href="/tin-tuc/" className="bb-link">← Tất cả bài viết</Link>
        </div>
      </div>
    </>
  );
}
