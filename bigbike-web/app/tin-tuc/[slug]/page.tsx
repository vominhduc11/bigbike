import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import {
  getArticleBySlug,
  listArticles,
  listPublicSettings,
} from "@/lib/api/public-api";
import type { Article } from "@/lib/contracts/public";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { pickSetting } from "@/lib/utils/settings";
import {
  toArticleListPath,
  toArticlePath,
  toCanonicalUrl,
  toHomePath,
} from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { WpArticleImage } from "../WpArticleImage";
import { ArticleTableOfContents } from "./ArticleTableOfContents";

const WP_TIME_ZONE = "Asia/Ho_Chi_Minh";
// Ảnh trang trí cố định của blog-thumbnail — port 1:1 từ single.php.
const BLOG_THUMBNAIL =
  "/wp-content/themes/bigbike/images/85f3273578840b12abf6a48a6e8c5bd1.png";

// ISR on-demand: bài viết là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Trả [] để
// sinh khi truy cập lần đầu + revalidate theo tag article:{slug}/articles khi admin sửa.
export async function generateStaticParams() {
  return [];
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
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? t("articleDefaultDescription"),
    canonicalPath: article.seo?.canonicalUrl ?? toArticlePath(article.slug),
    noIndex: article.seo?.noIndex ?? false,
    ogImage: article.seo?.ogImage?.url ?? article.coverImage?.url ?? undefined,
    ogType: "article",
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const [{ slug = "" }, t] = await Promise.all([
    params,
    getTranslations("Blog"),
  ]);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const locale = await getLocale();
  const result = await getArticleBySlug(slug, locale);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }

  const [settingsResult] = await Promise.all([
    listPublicSettings(locale),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );

  const stylesheet = (
    <link
      rel="stylesheet"
      href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4"
      precedence="default"
    />
  );

  if (!result.data) {
    const errorTitle = t("articleNotFoundTitle");
    return (
      <>
        {stylesheet}
        <div className="single single-post">
          <WpCategoryHero
            title={errorTitle}
            breadcrumb={[
              { label: "Bigbike.vn", href: toHomePath() },
              { label: t("breadcrumb"), href: toArticleListPath() },
              { label: errorTitle },
            ]}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={errorTitle}
          />
          <div id="main-content">
            <div className="container">
              <p className="woocommerce-info">{result.error?.message ?? t("loadFailed")}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const article = result.data;
  const [featuredResult, latestResult] = await Promise.all([
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", featured: true, lang: locale }),
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", lang: locale }),
  ]);

  const siteName = pickSetting(settingsResult.data ?? [], ["site_name"]);
  const articleJsonLd = serializeJsonLd(buildArticleJsonLd(article, siteName || undefined));
  const breadcrumbJsonLd = serializeJsonLd(buildArticleBreadcrumbJsonLd(article));

  const articleTitle = safeText(article.title, t("articleTitleFallback"));
  const categoryLabel = getArticleCategoryLabel(article);
  const categoryHref = getArticleCategoryHref(article);
  const articleDate = formatWpLongDate(getArticleDate(article));

  const latestArticles = excludeArticle(latestResult.data ?? [], article.slug);
  const featuredArticles = excludeArticle(featuredResult.data ?? [], article.slug);
  const highlightedArticles = (featuredArticles.length ? featuredArticles : latestArticles).slice(0, 5);
  const newestArticles = latestArticles.slice(0, 5);
  const relatedArticles = latestArticles.slice(0, 4);

  const legacyShareUrl = toCanonicalUrl(`/tin-tuc/${article.slug}.html`);
  const facebookShareHref = `http://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    legacyShareUrl,
  )}`;
  const twitterShareHref = `http://twitter.com/intent/tweet?text=${encodeURIComponent(
    legacyShareUrl,
  )}`;

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

  return (
    <LocalizedContentProvider kind="article" slug={article.slug}>
      {stylesheet}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <div className="single single-post single-format-standard">
        <WpCategoryHero
          title={articleTitle}
          titleNode={<LText field="title">{articleTitle}</LText>}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={articleTitle}
        />

        <div id="main-content">
          <div className="container">
            <div className="row">
              <div className="col-md-8">
                <div className="blog">
                  <div className="blog-thumbnail">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={BLOG_THUMBNAIL} alt="" />
                  </div>
                  <div className="blog-meta">
                    <p className="category">
                      <Link href={categoryHref}>{categoryLabel}</Link>
                    </p>
                    {articleDate ? <p className="date">{articleDate}</p> : null}
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
                    <p>Chia sẻ</p>
                    <a className="fb-share" href={facebookShareHref} aria-label="Facebook">
                      <svg width="20" height="20" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true">
                        <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
                      </svg>
                    </a>
                    <a className="twitter-share" href={twitterShareHref} aria-label="Twitter">
                      <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
                        <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <WpSidebarWidget title="Tin nổi bật" articles={highlightedArticles} />
                <WpSidebarWidget title="Tin mới nhất" articles={newestArticles} />
              </div>
            </div>
          </div>
        </div>

        {relatedArticles.length > 0 ? (
          <div id="related" className="news-fix-height bb-blog-listing-parity">
            <div className="container">
              <div className="related--title">
                <h3 className="big">CÓ THỂ BẠN QUAN TÂM</h3>
              </div>
              <div className="row">
                {relatedArticles.map((related) => (
                  <div className="col-md-3 col-sm-6 col-12" key={related.id}>
                    <WpBlogGridItem article={related} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </LocalizedContentProvider>
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
  title: string;
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
  const href = toArticlePath(article.slug);
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const categoryLabel = getArticleCategoryLabel(article);
  const date = formatWpLongDate(getArticleDate(article));

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={href}>
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        <div className="news-date">
          <p className="category">
            <b>{categoryLabel}</b>
          </p>
          {date ? <p>{date}</p> : null}
        </div>
        <div className="news--item-inside">
          <h3>
            <Link href={href}>{title}</Link>
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
  const href = toArticlePath(article.slug);
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const date = formatWpShortDate(getArticleDate(article));

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={href} className="lazy">
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        {date ? (
          <div className="news-date">
            <p>{date}</p>
          </div>
        ) : null}
        <div className="news--item-inside">
          <p className="title-post">
            <Link href={href}>{title}</Link>
          </p>
          <p>{makeExcerpt(article, 120)}</p>
        </div>
      </div>
    </div>
  );
}

function excludeArticle(articles: Article[], currentSlug: string): Article[] {
  return articles.filter((item) => item.slug !== currentSlug);
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

function formatWpLongDate(value: string | null | undefined): string {
  const parts = getWpDateParts(value);
  if (!parts) {
    return "";
  }

  return `${parts.day} Tháng ${parts.month}, ${parts.year}`;
}

function formatWpShortDate(value: string | null | undefined): string {
  const parts = getWpDateParts(value);
  if (!parts) {
    return "";
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

function getWpDateParts(value: string | null | undefined): { day: string; month: string; year: string } | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: WP_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  return day && month && year ? { day, month, year } : null;
}

function resolveArticleImageUrl(article: Article): string | null {
  return resolveWpUploadUrl(article.coverImage?.url);
}
