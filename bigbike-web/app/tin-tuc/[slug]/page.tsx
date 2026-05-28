import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getArticleBySlug, listArticles, listPublicSettings } from "@/lib/api/public-api";
import type { Article } from "@/lib/contracts/public";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { readHeroSettings } from "@/lib/utils/page-hero";
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

// Locale is read from a cookie (next-intl) - opt into dynamic rendering.
export const dynamic = "force-dynamic";

const BIGBIKE_UPLOADS_BASE = "https://bigbike.vn/wp-content/uploads/";
const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PATH = "/wp-content/uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";
const WP_TIME_ZONE = "Asia/Ho_Chi_Minh";
const ARTICLE_DETAIL_THUMBNAIL =
  "https://bigbike.vn/wp-content/themes/bigbike/images/85f3273578840b12abf6a48a6e8c5bd1.png";

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
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? t("articleDefaultDescription"),
    canonicalPath: article.seo?.canonicalUrl ?? toArticlePath(article.slug),
    noIndex: article.seo?.noIndex ?? false,
    ogImage: article.seo?.ogImage?.url ?? article.coverImage?.url ?? undefined,
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
  const [featuredResult, latestResult, settingsResult, breadcrumbJsonLd] = await Promise.all([
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", featured: true, lang: locale }),
    listArticles({ page: 1, size: 8, sort: "publishedAt:desc", lang: locale }),
    listPublicSettings(),
    Promise.resolve(serializeJsonLd(buildArticleBreadcrumbJsonLd(article))),
  ]);
  const siteName = pickSetting(settingsResult.data ?? [], ["site_name"]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const articleJsonLd = serializeJsonLd(buildArticleJsonLd(article, siteName || undefined));

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

  return (
    <div className="bb-article-detail-parity single-post">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <PageHero
        title={articleTitle}
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb"), href: toArticleListPath() },
          { label: categoryLabel, href: categoryHref },
          { label: articleTitle },
        ]}
      />

      <main id="main-content" className="bb-article-detail-page">
        <div className="container">
          <div className="row">
            <div className="col-md-8">
              <div className="blog">
                <div className="blog-thumbnail">
                  <WpArticleImage src={ARTICLE_DETAIL_THUMBNAIL} alt="" />
                </div>

                <div className="blog-meta">
                  <p className="category">
                    <Link href={categoryHref}>{categoryLabel}</Link>
                  </p>
                  {articleDate ? <p className="date">{articleDate}</p> : null}
                </div>

                <ArticleTableOfContents />

                <div
                  className="blog-content wyswyg bb-article-wyswyg"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichHtml(article.body, {
                      allowInlineStyles: true,
                      rewriteMediaUrls: true,
                    }),
                  }}
                />

                <div className="social-sharing">
                  <p>Chia sẻ</p>
                  <a className="fb-share" href={facebookShareHref} aria-label="Facebook">
                    <i className="fab fa-facebook-f" aria-hidden="true" />
                  </a>
                  <a className="twitter-share" href={twitterShareHref} aria-label="Twitter">
                    <i className="fab fa-twitter" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>

            <aside className="col-md-4">
              <ArticleSidebarWidget title="Tin nổi bật" articles={highlightedArticles} />
              <ArticleSidebarWidget title="Tin mới nhất" articles={newestArticles} />
            </aside>
          </div>
        </div>
      </main>

      <RelatedArticlesSection articles={relatedArticles} />
    </div>
  );
}

function ArticleSidebarWidget({
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
                <SidebarArticleItem article={article} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarArticleItem({ article }: Readonly<{ article: Article }>) {
  const title = safeText(article.title, "Tin tức");
  const href = toArticlePath(article.slug);
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const categoryLabel = getArticleCategoryLabel(article);
  const date = formatWpShortDate(getArticleDate(article));

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={href}>
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        <div className="news-date">
          <p>{categoryLabel}</p>
          {date ? <p>{date}</p> : null}
        </div>
        <div className="news--item-inside">
          <h3>
            <Link href={href}>{title}</Link>
          </h3>
          <p>{makeExcerpt(article, 95)}</p>
        </div>
      </div>
    </div>
  );
}

function RelatedArticlesSection({ articles }: Readonly<{ articles: Article[] }>) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section id="related" className="news-fix-height">
      <div className="container">
        <div className="related--title">
          <h3 className="big">CÓ THỂ BẠN QUAN TÂM</h3>
        </div>
        <div className="row">
          {articles.map((article) => (
            <div className="col-md-3 col-sm-6 col-12" key={article.id}>
              <RelatedArticleCard article={article} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RelatedArticleCard({ article }: Readonly<{ article: Article }>) {
  const title = safeText(article.title, "Tin tức");
  const href = toArticlePath(article.slug);
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const date = formatWpShortDate(getArticleDate(article));

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={href}>
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        <div className="news-date">{date ? <p>{date}</p> : null}</div>
        <div className="news--item-inside">
          <p className="title-post">
            <Link href={href}>{title}</Link>
          </p>
          <p>{makeExcerpt(article, 140)}</p>
        </div>
      </div>
    </div>
  );
}

function excludeArticle(articles: Article[], currentSlug: string): Article[] {
  return articles.filter((item) => item.slug !== currentSlug);
}

function getArticleCategoryLabel(article: Article): string {
  return textOrFallback(article.category?.name ?? article.categories?.[0]?.name, "Tin tức");
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
  const source = article.excerpt ?? article.body;
  const plain = stripHtml(source).replace(/\s+/g, " ").trim();

  if (!plain) {
    return "";
  }

  return plain.length > maxLength ? `${plain.slice(0, Math.max(0, maxLength - 3)).trim()}...` : plain;
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "");
}

function textOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
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
  return resolveWpUploadUrl(article.coverImage?.url ?? article.productImage?.url);
}

function resolveWpUploadUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith(LEGACY_CDN_PREFIX)) {
    return normalizeKnownWpUploadUrl(`${BIGBIKE_UPLOADS_BASE}${raw.slice(LEGACY_CDN_PREFIX.length)}`);
  }

  if (raw.startsWith(WP_UPLOADS_PATH)) {
    return normalizeKnownWpUploadUrl(`https://bigbike.vn${raw}`);
  }

  if (/^https:\/\/(?:www\.)?bigbike\.vn\/wp-content\/uploads\//.test(raw)) {
    return normalizeKnownWpUploadUrl(raw);
  }

  if (raw.startsWith("http") && raw.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = raw.indexOf(MINIO_UPLOADS_SUBPATH);
    return normalizeKnownWpUploadUrl(`${BIGBIKE_UPLOADS_BASE}${raw.slice(idx + MINIO_UPLOADS_SUBPATH.length)}`);
  }

  return raw;
}

function normalizeKnownWpUploadUrl(url: string): string {
  return url.replace(
    "/wp-content/uploads/2026/03/shop-mu-bao-hiem-gan-day-thumbnail.jpg",
    "/wp-content/uploads/2026/03/shop-non-bao-hiem-gan-day-thumbnail.jpg",
  );
}

function makeSlugThumbnailFallback(value: string | null | undefined, slug: string): string | null {
  const resolved = resolveWpUploadUrl(value);
  if (!resolved || !slug) {
    return null;
  }

  const match = resolved.match(/^(https:\/\/bigbike\.vn\/wp-content\/uploads\/\d{4}\/\d{2}\/)([^/?#]+)(\.[a-z0-9]+)([?#].*)?$/i);
  if (!match) {
    return null;
  }

  const [, basePath, fileName, extension] = match;
  const fallbackName = `${slug}-thumbnail`;
  if (fileName === fallbackName) {
    return null;
  }

  return `${basePath}${fallbackName}${extension}`;
}
