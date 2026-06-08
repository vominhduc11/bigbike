import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getArticleBySlug, listArticles, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { ProductCarouselSection } from "@/components/catalog/ProductCarouselSection";
import type { Article } from "@/lib/contracts/public";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";
import { sectionHeading } from "@/lib/ui-classes";
import { safeText } from "@/lib/utils/format";
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

// Locale is read from a cookie (next-intl) - opt into dynamic rendering.
export const dynamic = "force-dynamic";

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
        <Container>
          <ErrorState message={result.error?.message ?? t("loadFailed")} />
        </Container>
      </section>
    );
  }

  const article = result.data;
  const [featuredResult, latestResult, settingsResult, breadcrumbJsonLd, featuredProductsResult] =
    await Promise.all([
      listArticles({ page: 1, size: 8, sort: "publishedAt:desc", featured: true, lang: locale }),
      listArticles({ page: 1, size: 8, sort: "publishedAt:desc", lang: locale }),
      listPublicSettings(locale),
      Promise.resolve(serializeJsonLd(buildArticleBreadcrumbJsonLd(article))),
      listProducts({
        page: 1,
        homepageBlock: "FEATURED_GRID",
        size: 12,
        sort: "homepageOrder:asc",
        lang: locale,
      }),
    ]);
  const featuredProducts = featuredProductsResult.data ?? [];
  const siteName = pickSetting(settingsResult.data ?? [], ["site_name"]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
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
        defaultBgUrl={defaultHero.defaultBgUrl}
        defaultIllustrationUrl={defaultHero.defaultIllustrationUrl}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb"), href: toArticleListPath() },
          { label: categoryLabel, href: categoryHref },
          { label: articleTitle },
        ]}
      />

      <main id="main-content" className="bb-article-detail-page max-md:pt-1.5">
        <div className="w-full max-w-[var(--bb-container-xl)] mx-auto px-[15px]">
          <div className="flex flex-wrap -mx-[15px]">
            <div className="relative w-full px-[15px] md:flex-[0_0_66.666667%] md:max-w-[66.666667%]">
              <div className="mb-10 max-md:pb-6">
                <div className="m-0 mb-5">
                  <WpArticleImage
                    src={resolveArticleImageUrl(article) ?? ARTICLE_DETAIL_THUMBNAIL}
                    fallbackSrc={ARTICLE_DETAIL_THUMBNAIL}
                    alt={articleTitle}
                  />
                </div>

                <div className="my-5">
                  <p className="category inline-block m-0 text-black text-ui-14 leading-[1.5625rem] [&:not(:last-child)]:after:content-['/'] [&:not(:last-child)]:after:inline-block [&:not(:last-child)]:after:mx-1.5 [&:not(:last-child)]:after:text-black">
                    <Link href={categoryHref} className="text-brand font-semibold no-underline">
                      {categoryLabel}
                    </Link>
                  </p>
                  {articleDate ? (
                    <p className="inline-block m-0 text-black text-ui-14 leading-[1.5625rem] [&:not(:last-child)]:after:content-['/'] [&:not(:last-child)]:after:inline-block [&:not(:last-child)]:after:mx-1.5 [&:not(:last-child)]:after:text-black">
                      {articleDate}
                    </p>
                  ) : null}
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

                <div className="flex items-center py-5 border-y border-y-border-default">
                  <p className="m-0 mr-5 text-black font-bold leading-[35px]">Chia sẻ</p>
                  <a
                    className="inline-flex w-[35px] h-[35px] items-center justify-center mr-2 !rounded-[50%] text-white text-base font-bold leading-[35px] no-underline bg-[#1a77f2]"
                    href={facebookShareHref}
                    aria-label="Facebook"
                  >
                    <i className="not-italic before:content-['f']" aria-hidden="true" />
                  </a>
                  <a
                    className="inline-flex w-[35px] h-[35px] items-center justify-center mr-2 !rounded-[50%] text-white text-base font-bold leading-[35px] no-underline bg-[#1da1f2]"
                    href={twitterShareHref}
                    aria-label="Twitter"
                  >
                    <i className="not-italic before:content-['t']" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>

            <aside className="relative w-full px-[15px] md:flex-[0_0_33.333333%] md:max-w-[33.333333%]">
              <ArticleSidebarWidget title="Tin nổi bật" articles={highlightedArticles} />
              <ArticleSidebarWidget title="Tin mới nhất" articles={newestArticles} />
            </aside>
          </div>
        </div>
      </main>

      <ProductCarouselSection
        products={featuredProducts}
        kicker="Gợi ý cho bạn"
        heading="Sản phẩm nổi bật"
        headingId="blog-featured-products"
        className="mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px] pb-10 max-md:px-[var(--bb-mobile-page-x)]"
      />

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
    <div className="mb-[30px]">
      <div>
        <h3 className="m-0 mb-5 text-black font-heading text-h3 font-semibold leading-[1.3] normal-case">{title}</h3>
      </div>
      <div>
        <div>
          <div className="flex flex-wrap -mx-[15px]">
            {articles.map((article) => (
              <div className="relative w-full px-[15px] md:flex-[0_0_100%] md:max-w-[100%]" key={article.id}>
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
    <div className="flex flex-wrap mb-[30px] bg-white pb-5 border-b border-b-border-default max-md:border-t max-md:border-r max-md:border-l max-md:border-t-[#ddd] max-md:border-r-[#ddd] max-md:border-l-[#ddd]">
      <div className="flex-[0_0_40%] max-w-[40%]">
        <Link href={href} className="block text-inherit no-underline">
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="flex-[0_0_60%] max-w-[60%] max-md:bg-white">
        <div className="flex flex-wrap pl-[15px]">
          <p className="m-0 text-muted-foreground text-ui-12 leading-[18px] [&:not(:last-child)]:after:content-['/'] [&:not(:last-child)]:after:mx-1.5 [&:not(:last-child)]:after:inline-block [&:not(:last-child)]:after:text-muted-foreground">{categoryLabel}</p>
          {date ? <p className="m-0 text-muted-foreground text-ui-12 leading-[18px] [&:not(:last-child)]:after:content-['/'] [&:not(:last-child)]:after:mx-1.5 [&:not(:last-child)]:after:inline-block [&:not(:last-child)]:after:text-muted-foreground">{date}</p> : null}
        </div>
        <div className="pl-[15px] max-md:bg-white">
          <h3 className="m-0 text-black font-heading text-ui-14 font-semibold leading-[18px] normal-case">
            <Link href={href} className="text-inherit no-underline [transition:all_0.3s_ease] hover:text-brand">{title}</Link>
          </h3>
          <p className="hidden">{makeExcerpt(article, 95)}</p>
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
    <section id="related" className="pb-10">
      <div className="w-full max-w-[var(--bb-container-xl)] mx-auto px-[15px]">
        <div>
          <h3 className={cn(sectionHeading, "mb-[30px]")}>CÓ THỂ BẠN QUAN TÂM</h3>
        </div>
        <div className="flex flex-wrap -mx-[15px]">
          {articles.map((article) => (
            <div className="relative w-full px-[15px] min-[576px]:flex-[0_0_50%] min-[576px]:max-w-[50%] md:flex-[0_0_25%] md:max-w-[25%]" key={article.id}>
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
    <div className="block mb-[30px] bg-white [box-shadow:0_3px_6px_rgba(0,0,0,0.16)] max-md:border max-md:border-border max-md:[box-shadow:none]">
      <div>
        <Link href={href} className="block text-inherit no-underline">
          <WpArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} />
        </Link>
      </div>
      <div className="max-md:bg-white">
        <div className="flex flex-wrap px-5 pt-5 pb-2.5">{date ? <p className="m-0 text-muted-foreground text-ui-12 leading-5">{date}</p> : null}</div>
        <div className="px-5 pb-[30px] max-md:bg-white">
          <p className="m-0 mb-2.5 text-black font-heading text-ui-20 font-semibold leading-6 normal-case">
            <Link href={href} className="text-inherit no-underline [transition:all_0.3s_ease] hover:text-brand">{title}</Link>
          </p>
          <p className="block m-0 text-black text-ui-14 leading-[25px]">{makeExcerpt(article, 140)}</p>
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
  const source = article.excerpt ?? article.body;
  const plain = stripHtmlTags(source).replace(/\s+/g, " ").trim();

  if (!plain) {
    return "";
  }

  return plain.length > maxLength ? `${plain.slice(0, Math.max(0, maxLength - 3)).trim()}...` : plain;
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

