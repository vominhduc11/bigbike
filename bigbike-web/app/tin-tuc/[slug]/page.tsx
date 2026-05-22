import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ErrorState } from "@/components/ui/ErrorState";
import { getArticleBySlug, listArticles } from "@/lib/api/public-api";
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toArticlePath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

// Locale is read from a cookie (next-intl) - opt into dynamic rendering.
export const dynamic = "force-dynamic";

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
    title: article.title,
    description: article.excerpt ?? t("articleDefaultDescription"),
    canonicalPath: toArticlePath(article.slug),
    noIndex: false,
    ogImage: article.coverImage?.url ?? undefined,
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
  const [articleJsonLd, breadcrumbJsonLd] = await Promise.all([
    Promise.resolve(serializeJsonLd(buildArticleJsonLd(article))),
    Promise.resolve(serializeJsonLd(buildArticleBreadcrumbJsonLd(article))),
  ]);

  const articleTitle = safeText(article.title, t("articleTitleFallback"));
  const breadcrumbTitle =
    articleTitle.length > 50 ? `${articleTitle.slice(0, 50)}...` : articleTitle;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <section
        className="bb-article-wp-hero relative mb-[90px] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/wp/page-title-bg.png')" }}
      >
        <div className="mx-auto w-full max-w-[1200px] px-[15px]">
          <div className="-mx-[15px] flex min-h-[450px] flex-wrap items-center">
            <div className="relative w-full px-[15px] md:w-1/2">
              <h1 className="m-0 text-2xl font-semibold leading-[1.2] text-white">
                {articleTitle}
              </h1>
              <nav className="bb-article-wp-breadcrumb" aria-label="Breadcrumb">
                <ul>
                  <li>
                    <Link href={toHomePath()}>
                      <span>{tBreadcrumb("home")}</span>
                    </Link>
                  </li>
                  <li>
                    <span aria-current="page">{breadcrumbTitle}</span>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </section>

      <main id="main-content" className="bb-article-detail-page pb-10">
        <div className="mx-auto w-full max-w-[1200px] px-[15px]">
          <div className="-mx-[15px] flex flex-wrap">
            <div className="relative w-full px-[15px]">
              <article
                className="static-page wyswyg bb-article-wyswyg"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(article.body, {
                    allowInlineStyles: true,
                    rewriteMediaUrls: true,
                  }),
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
