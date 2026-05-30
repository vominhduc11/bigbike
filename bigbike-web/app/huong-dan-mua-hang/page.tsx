import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { PolicySidebar } from "@/components/layout/PolicySidebar";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listPublicSettings } from "@/lib/api/public-api";
import { readDefaultHeroAssets } from "@/lib/utils/page-hero";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath, toPagePath } from "@/lib/utils/routes";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const pageResult = await getPageBySlug("huong-dan-mua-hang", locale);
  const page = pageResult.data;
  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("howToBuy.title"),
    description: page?.seo?.description ?? t("howToBuy.description"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("huong-dan-mua-hang"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function HowToBuyPage() {
  const locale = await getLocale();
  const [pageResult, t, tBreadcrumb, settingsResult] = await Promise.all([
    getPageBySlug("huong-dan-mua-hang", locale),
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
    listPublicSettings(),
  ]);
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);

  if (!pageResult.data && pageResult.error?.status === 404) {
    notFound();
  }
  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? t("howToBuy.loadFailed")} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const pageTitle = safeText(page.title, t("howToBuy.title"));

  return (
    <>
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        title={page.heroTitle ?? pageTitle}
        defaultBgUrl={defaultHero.defaultBgUrl}
        defaultIllustrationUrl={defaultHero.defaultIllustrationUrl}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: pageTitle },
        ]}
      />
      <section className="bb-page">
        <div className="bb-container grid grid-cols-1 gap-[30px] pt-10 pb-[60px] items-start lg:grid-cols-[3fr_9fr] xl:gap-10 2xl:gap-12">
          <PolicySidebar activeHref="/huong-dan-mua-hang" title={t("howToBuy.sidebarTitle")} />
          <div className="min-w-0">
            <article
              className="bb-richtext"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
            />
            <p className="text-muted-foreground text-sm text-right mb-10">
              {t("updatedAt", { date: formatDate(page.updatedAt) })}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
