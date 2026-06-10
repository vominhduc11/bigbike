import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
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
  // WP page.php trả 404 khi không có page — không có data nghĩa là không tồn tại.
  if (!result.data) {
    notFound();
  }

  const page = result.data;
  const pageTitle = safeText(page.title, t("contentFallback"));

  // page.php: .page-title (banner + breadcrumb) + #main-content > .container > .row
  // > .col-md-12 > .static-page.wyswyg.
  return (
    <WpStaticShell
      title={page.heroTitle ?? pageTitle}
      heroBgUrl={page.heroImageUrl}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: pageTitle },
      ]}
    >
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div
              className="static-page wyswyg"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
            />
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
