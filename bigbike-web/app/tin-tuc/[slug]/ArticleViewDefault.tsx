import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import type { Article } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { toArticleListPath, toArticlePath, toCanonicalUrl, toHomePath } from "@/lib/utils/routes";
import { resolveLocale, type Locale } from "@/i18n/locale";
import { ArticleTableOfContents } from "./ArticleTableOfContents";

const BLOG_THUMBNAIL =
  "/wp-content/themes/bigbike/images/85f3273578840b12abf6a48a6e8c5bd1.png";

const TRANSPARENT_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169' viewBox='0 0 300 169'%3E%3C/svg%3E";

type ArticleViewDefaultProps = {
  article: Article;
  locale: string;
  heroBgUrl?: string | null;
  heroMobileBgUrl?: string | null;
  heroIllustrationUrl?: string | null;
  highlighted?: Article[];
  newest?: Article[];
  related?: Article[];
};

export async function ArticleViewDefault({
  article,
  locale,
  heroBgUrl,
  heroMobileBgUrl,
  heroIllustrationUrl,
  highlighted = [],
  newest = [],
  related = [],
}: ArticleViewDefaultProps) {
  const t = await getTranslations("Blog");
  const resolvedLocale = resolveLocale(locale);
  const articleTitle = safeText(article.title, "Bài viết");
  const categoryLabel = getArticleCategoryLabel(article);
  const categoryHref = getArticleCategoryHref(article, resolvedLocale);
  const articleDate = getArticleDate(article);
  const articleBodyHtml = sanitizeRichHtml(article.body, {
    allowInlineStyles: true,
    rewriteMediaUrls: true,
  });

  const legacyShareUrl = toCanonicalUrl(`/tin-tuc/${article.slug}.html`);
  const facebookShareHref = `http://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(legacyShareUrl)}`;
  const twitterShareHref = `http://twitter.com/intent/tweet?text=${encodeURIComponent(legacyShareUrl)}`;

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: categoryLabel, href: categoryHref },
    { label: articleTitle },
  ];

  const hasSidebar = highlighted.length > 0 || newest.length > 0;

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4" />
      <div className="single single-post single-format-standard bb-wp-news-page">
        <WpCategoryHero
          title={articleTitle}
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
                    {articleDate ? <p className="date">{formatDate(articleDate, resolvedLocale, "long")}</p> : null}
                  </div>

                  <ArticleTableOfContents />

                  <div
                    className="blog-content wyswyg"
                    dangerouslySetInnerHTML={{ __html: articleBodyHtml }}
                  />

                  <div className="social-sharing">
                    <p>{t("shareWord")}</p>
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
                  <WpSidebarWidget title={t("featuredNews")} articles={highlighted} locale={resolvedLocale} />
                  <WpSidebarWidget title={t("latestNews")} articles={newest} locale={resolvedLocale} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <div id="related" className="news-fix-height bb-blog-listing-parity">
            <div className="container">
              <div className="related--title">
                <h3 className="big">{t("relatedSectionHeading")}</h3>
              </div>
              <div className="row">
                {related.map((item) => (
                  <div className="col-md-3 col-sm-6 col-12" key={item.id}>
                    <WpBlogGridItem article={item} locale={resolvedLocale} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function WpSidebarWidget({
  title,
  articles,
  locale,
}: {
  title: string;
  articles: Article[];
  locale: Locale;
}) {
  if (articles.length === 0) return null;

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
                <WpSidebarNewsItem article={article} locale={locale} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WpSidebarNewsItem({ article, locale }: { article: Article; locale: Locale }) {
  const title = safeText(article.title, "Tin tức");
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const categoryLabel = getArticleCategoryLabel(article);
  const date = getArticleDate(article);

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={toArticlePath(article.slug, locale)} className="lazy">
          <ArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        <div className="news-date">
          <p className="category">
            <b>{categoryLabel}</b>
          </p>
          {date ? <p>{formatDate(date, locale, "long")}</p> : null}
        </div>
        <div className="news--item-inside">
          <h3>
            <Link href={toArticlePath(article.slug, locale)}>{title}</Link>
          </h3>
          <p>{makeExcerpt(article, 70)}</p>
        </div>
      </div>
    </div>
  );
}

function WpBlogGridItem({ article, locale }: { article: Article; locale: Locale }) {
  const title = safeText(article.title, "Bài viết");
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const date = getArticleDate(article);

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={toArticlePath(article.slug, locale)} className="lazy">
          <ArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        {date ? (
          <div className="news-date">
            <p>{formatDate(date, locale, "slash")}</p>
          </div>
        ) : null}
        <div className="news--item-inside">
          <p className="title-post">
            <Link href={toArticlePath(article.slug, locale)}>{title}</Link>
          </p>
          <p>{makeExcerpt(article, 120)}</p>
        </div>
      </div>
    </div>
  );
}

function ArticleImage({ src, fallbackSrc, alt }: { src: string | null; fallbackSrc?: string | null; alt: string }) {
  const resolvedSrc = src ?? fallbackSrc ?? TRANSPARENT_THUMBNAIL;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      data-src={src ?? undefined}
      data-fallback-src={fallbackSrc ?? undefined}
      alt={alt}
      className={src ? "lazy" : "lazy bb-news-img-placeholder"}
      loading="lazy"
      decoding="async"
    />
  );
}

function getArticleCategoryLabel(article: Article): string {
  return safeText(article.category?.name ?? article.categories?.[0]?.name, "Tin tức");
}

function getArticleCategoryHref(article: Article, locale: Locale): string {
  const slug = article.category?.slug ?? article.categories?.[0]?.slug;
  if (!slug || slug === "tin-tuc") {
    return toArticleListPath(locale);
  }

  return `${toArticleListPath(locale)}?category=${encodeURIComponent(slug)}`;
}

function getArticleDate(article: Article): string | null | undefined {
  return article.publishedAt ?? article.createdAt;
}

function makeExcerpt(article: Article, maxLength: number): string {
  const source = article.excerpt || article.body;
  const plain = stripHtmlTags(source).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  return plain.length > maxLength ? `${plain.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : plain;
}

function resolveArticleImageUrl(article: Article): string | null {
  return resolveWpUploadUrl(article.coverImage?.url);
}

function formatDate(value: string, locale: Locale, style: "long" | "slash"): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  if (style === "slash") {
    const parts = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("day")}/${get("month")}/${get("year")}`;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "long",
  }).format(date);
}
