"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { richContentClassName } from "@/components/layout/RichContent";
import { ArticleCard } from "@/components/content/ArticleCard";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { LocalDate } from "@/components/i18n/LocalDate";
import type { Article } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { toArticleListPath, toCanonicalUrl, toHomePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { ArticleImage } from "../ArticleImage";
import { ArticleTableOfContents } from "./ArticleTableOfContents";

const BLOG_THUMBNAIL = "/brand/news/article-cover.png";

type ArticleViewProps = {
  article: Article;
  heroBgUrl?: string | null;
  heroIllustrationUrl?: string | null;
  highlighted?: Article[];
  newest?: Article[];
  related?: Article[];
  previewMode?: boolean;
};

export function ArticleView({
  article,
  heroBgUrl,
  heroIllustrationUrl,
  highlighted = [],
  newest = [],
  related = [],
  previewMode = false,
}: ArticleViewProps) {
  const locale = useLocale() as Locale;
  const articleTitle = safeText(article.title, "Bài viết");
  const categoryLabel = getArticleCategoryLabel(article);
  const categoryHref = getArticleCategoryHref(article, locale);
  const articleDate = getArticleDate(article);

  const legacyShareUrl = toCanonicalUrl(`/tin-tuc/${article.slug}.html`);
  const facebookShareHref = `http://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(legacyShareUrl)}`;
  const twitterShareHref = `http://twitter.com/intent/tweet?text=${encodeURIComponent(legacyShareUrl)}`;

  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: categoryLabel, href: categoryHref },
    { label: articleTitle, labelNode: <LText field="title">{articleTitle}</LText> },
  ];

  const articleBodyHtml = sanitizeRichHtml(article.body, {
    allowInlineStyles: true,
    rewriteMediaUrls: true,
  });
  const hasSidebar = highlighted.length > 0 || newest.length > 0;

  const inner = (
    <div key="blog-detail-root">
      <PageHero
        title={articleTitle}
        titleNode={<LText field="title">{articleTitle}</LText>}
        breadcrumb={heroBreadcrumb}
        bgUrl={heroBgUrl}
        illustrationUrl={heroIllustrationUrl}
        illustrationAlt={articleTitle}
      />

      <div id="main-content">
        <Container className="grid grid-cols-1 gap-8 pb-10 md:grid-cols-12">
        <article className={hasSidebar ? "min-w-0 md:col-span-8" : "min-w-0 md:col-span-12"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BLOG_THUMBNAIL} alt="" className="h-auto w-full" />

          <div className="my-5 flex flex-wrap items-center gap-2 text-a5-meta text-muted-foreground">
            <p className="m-0">
              <Link href={categoryHref} className="font-semibold text-brand hover:underline">
                {categoryLabel}
              </Link>
            </p>
            {articleDate ? (
              <>
                <span aria-hidden>/</span>
                <p className="m-0"><LocalDate value={articleDate} dateStyle="long" /></p>
              </>
            ) : null}
          </div>

          <ArticleTableOfContents />

          <LHtml
            field="body"
            viHtml={articleBodyHtml}
            className={richContentClassName}
            allowInlineStyles
            rewriteMediaUrls
          />

          <div className="mt-8 flex flex-wrap items-center gap-6 border-y border-border py-5">
            <p className="m-0 font-body text-a4-content font-semibold uppercase text-muted-foreground">
              <Tr ns="Blog" k="shareWord" />
            </p>
            <a href={facebookShareHref} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground hover:text-brand">
              <svg width="20" height="20" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true">
                <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
              </svg>
            </a>
            <a href={twitterShareHref} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-muted-foreground hover:text-brand">
              <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
                <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z" />
              </svg>
            </a>
          </div>
        </article>

        {hasSidebar ? (
          <aside className="md:col-span-4">
            <ArticleSidebarWidget title={<Tr ns="Blog" k="featuredNews" />} articles={highlighted} />
            <ArticleSidebarWidget title={<Tr ns="Blog" k="latestNews" />} articles={newest} />
          </aside>
        ) : null}
        </Container>
      </div>

      {related.length > 0 ? (
        <section id="related" className="border-t border-border py-15">
          <Container>
            <h2 className="mb-6 font-cta text-a1-title font-bold uppercase text-foreground">
              <Tr ns="Blog" k="relatedSectionHeading" />
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => <ArticleCard key={item.id} article={item} />)}
            </div>
          </Container>
        </section>
      ) : null}
    </div>
  );

  return previewMode ? inner : (
    <LocalizedContentProvider kind="article" slug={article.slug}>
      {inner}
    </LocalizedContentProvider>
  );
}

function ArticleSidebarWidget({ title, articles }: { title: ReactNode; articles: Article[] }) {
  if (articles.length === 0) return null;

  return (
    <section className="mb-8 p-4">
      <h2 className="mb-5 font-cta text-a3-section font-bold uppercase text-foreground">{title}</h2>
      <div>
        {articles.map((article) => <ArticleSidebarItem key={article.id} article={article} />)}
      </div>
    </section>
  );
}

function ArticleSidebarItem({ article }: { article: Article }) {
  const title = safeText(article.title, "Tin tức");
  const imageUrl = resolveArticleImageUrl(article);
  const fallbackUrl = makeSlugThumbnailFallback(imageUrl, article.slug);
  const categoryLabel = getArticleCategoryLabel(article);
  const date = getArticleDate(article);

  return (
    <article className="flex border-b border-border py-5 first:pt-0 last:border-b-0">
      <LocalizedLink kind="article" viSlug={article.slug} enSlug={article.slugEn} className="w-2/5 shrink-0">
        <ArticleImage src={imageUrl} fallbackSrc={fallbackUrl} alt={title} className="aspect-video h-full w-full object-cover" />
      </LocalizedLink>
      <div className="w-3/5 min-w-0 p-3">
        <div className="mb-1 text-b5-label text-muted-foreground">
          <p className="m-0 font-semibold text-brand">{categoryLabel}</p>
          {date ? <p className="m-0"><LocalDate value={date} dateStyle="long" /></p> : null}
        </div>
        <h3 className="mb-1 font-body text-a5-meta font-semibold leading-5 text-foreground">
          <LocalizedLink kind="article" viSlug={article.slug} enSlug={article.slugEn} className="text-foreground hover:text-brand">
            {title}
          </LocalizedLink>
        </h3>
        <p className="m-0 line-clamp-2 text-b5-label text-muted-foreground">{makeExcerpt(article, 70)}</p>
      </div>
    </article>
  );
}

function getArticleCategoryLabel(article: Article): string {
  return safeText(article.category?.name ?? article.categories?.[0]?.name, "Tin tức");
}

function getArticleCategoryHref(article: Article, locale: Locale): string {
  const slug = article.category?.slug ?? article.categories?.[0]?.slug;
  if (!slug || slug === "tin-tuc") return toArticleListPath(locale);
  return `${toArticleListPath(locale)}?category=${encodeURIComponent(slug)}`;
}

function getArticleDate(article: Article): string | null | undefined {
  return article.publishedAt ?? article.createdAt;
}

function makeExcerpt(article: Article, maxLength: number): string {
  const source = article.excerpt || article.body;
  const plain = stripHtmlTags(source).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  return plain.length > maxLength ? `${plain.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : plain;
}

function resolveArticleImageUrl(article: Article): string | null {
  return resolveWpUploadUrl(article.coverImage?.url);
}
