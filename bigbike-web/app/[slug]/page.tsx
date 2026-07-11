import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { getStaticPage, staticPageSlugs } from "@/lib/content/static-pages";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { RichContent } from "@/components/layout/RichContent";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type StaticPageDetailProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return staticPageSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: StaticPageDetailProps): Promise<Metadata> {
  const [{ slug }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: t("invalidTitle"),
      description: t("invalidDescription"),
      canonicalPath: toPagePath("invalid"),
      noIndex: true,
    });
  }

  const page = getStaticPage(slug, locale);
  if (!page) {
    return buildPublicMetadata({
      title: t("notFoundTitle"),
      description: t("notFoundDescription"),
      canonicalPath: toPagePath(slug),
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? `${page.title} — BigBike.`,
    canonicalPath: page.seoCanonicalUrl ?? toPagePath(page.slug),
    noIndex: false,
  });
}

export default async function StaticPageDetail({ params }: StaticPageDetailProps) {
  const [{ slug }, locale, t, tBreadcrumb] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const pageTitle = safeText(page.title, t("contentFallback"));

  // page.php: .page-title (banner + breadcrumb) + #main-content > .container > .row
  // > .col-md-12 > .static-page.wyswyg.
  return (
    <StaticPageShell
      title={page.heroTitle ?? pageTitle}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: pageTitle },
      ]}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <RichContent
          html={sanitizeRichHtml(page.body, { allowInlineStyles: true, allowStyleTags: true })}
        />
      </div>
    </StaticPageShell>
  );
}
