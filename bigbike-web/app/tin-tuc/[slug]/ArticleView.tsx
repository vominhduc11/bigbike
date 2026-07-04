"use client";

import Link from "next/link";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import type { ReactNode } from "react";

import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { LocalDate } from "@/components/i18n/LocalDate";
import type { Article } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { toArticleListPath, toCanonicalUrl, toHomePath } from "@/lib/utils/routes";
import { WpArticleImage } from "../WpArticleImage";
import { ArticleTableOfContents } from "./ArticleTableOfContents";

// Ảnh trang trí cố định của blog-thumbnail — port 1:1 từ single.php.
const BLOG_THUMBNAIL =
  "/wp-content/themes/bigbike/images/85f3273578840b12abf6a48a6e8c5bd1.png";

type ArticleViewProps = {
  article: Article;
  /** Resolved hero background/illustration (server page computes from settings). Empty in preview. */
  heroBgUrl?: string | null;
  /** Ảnh nền hero riêng cho điện thoại (≤767px). Empty in preview. */
  heroMobileBgUrl?: string | null;
  heroIllustrationUrl?: string | null;
  /** Sidebar + related rails — storefront context, empty in preview. */
  highlighted?: Article[];
  newest?: Article[];
  related?: Article[];
  /**
   * Live-preview mode (admin editor iframe): skip the locale-switch provider since
   * the previewed article is an unsaved draft already resolved to the chosen locale
   * by the backend dry-run. The sidebar/related rails are naturally empty in preview.
   */
  previewMode?: boolean;
};

/**
 * Presentational body of the blog detail page. Shared 1:1 by the public article
 * route (`app/tin-tuc/[slug]/page.tsx`) and the admin live-preview iframe
 * (`app/preview/article/page.tsx`) so the preview is byte-faithful to what readers
 * see. SEO (metadata, JSON-LD) stays in the server page; this owns only the body.
 */
export function ArticleView({
  article,
  heroBgUrl,
  heroMobileBgUrl,
  heroIllustrationUrl,
  highlighted = [],
  newest = [],
  related = [],
  previewMode = false,
}: ArticleViewProps) {
  const articleTitle = safeText(article.title, "Bài viết");
  const categoryLabel = getArticleCategoryLabel(article);
  const categoryHref = getArticleCategoryHref(article);
  const articleDate = getArticleDate(article);

  const legacyShareUrl = toCanonicalUrl(`/tin-tuc/${article.slug}.html`);
  const facebookShareHref = `http://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(legacyShareUrl)}`;
  const twitterShareHref = `http://twitter.com/intent/tweet?text=${encodeURIComponent(legacyShareUrl)}`;

  // Breadcrumb WP single = Bigbike.vn → {danh mục bài} → {tiêu đề} (3 cấp).
  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: categoryLabel, href: categoryHref },
    { label: articleTitle, labelNode: <LText field="title">{articleTitle}</LText> },
  ];

  const articleBodyHtml = sanitizeRichHtml(article.body, {
    allowInlineStyles: true,
    rewriteMediaUrls: true,
  });

  // Sidebar chỉ có nội dung khi có rail bài (storefront). Ở live-preview các rail
  // rỗng → bỏ cột sidebar và cho thân bài tràn đủ chiều rộng để không bị kẹt ở
  // 66% (col-md-8) với khoảng trống bên phải. Cũng xử lý luôn trang thật khi
  // chưa có tin nổi bật/tin mới.
  const hasSidebar = highlighted.length > 0 || newest.length > 0;

  const inner = (
    <div key="blog-detail-root" className="single single-post single-format-standard bb-wp-news-page">
      <WpCategoryHero
        title={articleTitle}
        titleNode={<LText field="title">{articleTitle}</LText>}
        breadcrumb={heroBreadcrumb}
        bgUrl={heroBgUrl}
        mobileBgUrl={heroMobileBgUrl}
        illustrationUrl={heroIllustrationUrl}
        illustrationAlt={articleTitle}
      />

      <div id="main-content">
        <div className="container">
          <div className="row">
            <div className={hasSidebar ? "col-md-8" : "col-md-12"}>
              <div className="blog">
                <div className="blog-thumbnail" key="blog-thumbnail-real">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BLOG_THUMBNAIL} alt="" />
                </div>
                <div className="blog-meta">
                  <p className="category">
                    <Link href={categoryHref}>{categoryLabel}</Link>
                  </p>
                  {articleDate ? <p className="date"><LocalDate value={articleDate} dateStyle="long" /></p> : null}
                </div>

                <ArticleTableOfContents />

                <LHtml
                  field="body"
                  viHtml={articleBodyHtml}
                  className="blog-content wyswyg"
                  allowInlineStyles
                  rewriteMediaUrls
                />

                <div className="social-sharing">
                  {/* target="_blank" để mở tab mới nhất quán cả SPA lẫn full-load, không phụ thuộc script WP. */}
                  <p><Tr ns="Blog" k="shareWord" /></p>
                  <a href={facebookShareHref} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                    <svg width="20" height="20" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true">
                      <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
                    </svg>
                  </a>
                  <a href={twitterShareHref} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                    <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
                      <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {hasSidebar ? (
              <div className="col-md-4">
                <WpSidebarWidget title={<Tr ns="Blog" k="featuredNews" />} articles={highlighted} />
                <WpSidebarWidget title={<Tr ns="Blog" k="latestNews" />} articles={newest} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <div id="related" className="news-fix-height bb-blog-listing-parity">
          <div className="container">
            <div className="related--title">
              <h3 className="big"><Tr ns="Blog" k="relatedSectionHeading" /></h3>
            </div>
            <div className="row">
              {related.map((item) => (
                <div className="col-md-3 col-sm-6 col-12" key={item.id}>
                  <WpBlogGridItem article={item} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4" />
      {previewMode ? (
        inner
      ) : (
        <LocalizedContentProvider kind="article" slug={article.slug}>
          {inner}
        </LocalizedContentProvider>
      )}
    </>
  );
}

/**
 * Widget sidebar — port 1:1 từ single.php: .widget > .widget--title h3.big +
 * .news-list các .news--item (thumbnail + category/date + h3 + excerpt 70).
 */
function WpSidebarWidget({
  title,
  articles,
}: Readonly<{
  title: ReactNode;
  articles: Article[];
}>) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="widget">
      <div className="widget--title">
        <h3 className="big">{title}</h3>
      </div>
      <div className="widget--body">
        <div className="news-list">
          <div className="row">
            {articles.map((article) => (
              <div className="col-md-12" key={article.id}>
                <WpSidebarNewsItem article={article} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WpSidebarNewsItem({ article }: Readonly<{ article: Article }>) {
  const title = safeText(article.title, "Tin tức");
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const categoryLabel = getArticleCategoryLabel(article);
  const date = getArticleDate(article);

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <LocalizedLink kind="article" viSlug={article.slug} enSlug={article.slugEn}>
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </LocalizedLink>
      </div>
      <div className="news--item-desc">
        <div className="news-date">
          <p className="category">
            <b>{categoryLabel}</b>
          </p>
          {date ? <p><LocalDate value={date} dateStyle="long" /></p> : null}
        </div>
        <div className="news--item-inside">
          <h3>
            <LocalizedLink kind="article" viSlug={article.slug} enSlug={article.slugEn}>
              {title}
            </LocalizedLink>
          </h3>
          <p>{makeExcerpt(article, 70)}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * content-blog-grid-item.php — thẻ bài viết liên quan (#related).
 */
function WpBlogGridItem({ article }: Readonly<{ article: Article }>) {
  const title = safeText(article.title, "Bài viết");
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const date = getArticleDate(article);

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <LocalizedLink kind="article" viSlug={article.slug} enSlug={article.slugEn} className="lazy">
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </LocalizedLink>
      </div>
      <div className="news--item-desc">
        {date ? (
          <div className="news-date">
            <p><LocalDate value={date} dateStyle="slash" /></p>
          </div>
        ) : null}
        <div className="news--item-inside">
          <p className="title-post">
            <LocalizedLink kind="article" viSlug={article.slug} enSlug={article.slugEn}>
              {title}
            </LocalizedLink>
          </p>
          <p>{makeExcerpt(article, 120)}</p>
        </div>
      </div>
    </div>
  );
}

function getArticleCategoryLabel(article: Article): string {
  return safeText(article.category?.name ?? article.categories?.[0]?.name, "Tin tức");
}

function getArticleCategoryHref(article: Article): string {
  const slug = article.category?.slug ?? article.categories?.[0]?.slug;
  if (!slug || slug === "tin-tuc") {
    return toArticleListPath();
  }

  return `${toArticleListPath()}?category=${encodeURIComponent(slug)}`;
}

function getArticleDate(article: Article): string | null | undefined {
  return article.publishedAt ?? article.createdAt;
}

function makeExcerpt(article: Article, maxLength: number): string {
  // excerpt có thể là chuỗi rỗng "" (API trả "") → dùng || để fallback sang body.
  const source = article.excerpt || article.body;
  const plain = stripHtmlTags(source).replace(/\s+/g, " ").trim();

  if (!plain) {
    return "";
  }

  return plain.length > maxLength ? `${plain.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : plain;
}

function resolveArticleImageUrl(article: Article): string | null {
  return resolveWpUploadUrl(article.coverImage?.url);
}
