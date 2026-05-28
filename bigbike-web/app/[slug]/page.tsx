import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type StaticPageDetailProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: StaticPageDetailProps): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("StaticPage")]);
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: t("invalidTitle"),
      description: t("invalidDescription"),
      canonicalPath: toPagePath("invalid"),
      noIndex: true,
    });
  }

  const locale = await getLocale();
  const result = await getPageBySlug(slug, locale);
  if (!result.data) {
    return buildPublicMetadata({
      title: t("notFoundTitle"),
      description: t("notFoundDescription"),
      canonicalPath: toPagePath(slug),
      noIndex: true,
    });
  }

  const page = result.data;
  return buildPublicMetadata({
    title: page.seo?.title ?? page.title,
    description: page.seo?.description ?? `${page.title} — BigBike.`,
    canonicalPath: page.seo?.canonicalUrl ?? toPagePath(page.slug),
    noIndex: page.seo?.noIndex ?? false,
  });
}

export default async function StaticPageDetail({ params }: StaticPageDetailProps) {
  const [{ slug }, t, tBreadcrumb] = await Promise.all([
    params,
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const locale = await getLocale();
  const result = await getPageBySlug(slug, locale);
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

  const page = result.data;
  const pageTitle = safeText(page.title, t("contentFallback"));

  return (
    <>
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        title={page.heroTitle ?? pageTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: pageTitle },
        ]}
      />
      <section className="bb-page">
        <div className="bb-container pt-8 pb-[60px]">
          <article
            className="bb-richtext"
            dangerouslySetInnerHTML={{
              __html: sanitizeRichHtml(page.body),
            }}
          />
          <p className="text-muted-foreground text-sm mt-4">
            {t("updatedAt", { date: formatDate(page.updatedAt) })}
          </p>
        </div>
      </section>
    </>
  );
}
