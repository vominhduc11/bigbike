import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { PolicySidebar } from "@/components/layout/PolicySidebar";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

// Map URL slug → backend page slug
const POLICY_SLUG_MAP: Record<string, string> = {
  "bao-mat": "chinh-sach-bao-ve-thong-tin-ca-nhan",
  "bao-hanh": "chinh-sach-bao-hanh",
  "doi-tra": "chinh-sach-doi-tra-hang",
  "dieu-khoan": "cac-dieu-kien-va-dieu-khoan",
};

const POLICY_META_KEYS: Record<string, { title: string; description: string }> = {
  "bao-mat": {
    title: "policy.privacyTitle",
    description: "policy.privacyDescription",
  },
  "bao-hanh": {
    title: "policy.warrantyTitle",
    description: "policy.warrantyDescription",
  },
  "doi-tra": {
    title: "policy.returnsTitle",
    description: "policy.returnsDescription",
  },
  "dieu-khoan": {
    title: "policy.termsTitle",
    description: "policy.termsDescription",
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("StaticPage")]);
  const meta = POLICY_META_KEYS[slug];
  if (!meta) return {};
  return buildPublicMetadata({
    title: t(meta.title),
    description: t(meta.description),
    canonicalPath: `/chinh-sach/${slug}/`,
  });
}

export default async function PolicyPage({ params }: Props) {
  const [{ slug }, t, tBreadcrumb] = await Promise.all([
    params,
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);
  const backendSlug = POLICY_SLUG_MAP[slug];
  if (!backendSlug) notFound();

  const locale = await getLocale();
  const result = await getPageBySlug(backendSlug, locale);
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
  const meta = POLICY_META_KEYS[slug];
  const pageTitle = safeText(page.title, meta ? t(meta.title) : t("policy.title"));

  return (
    <>
      {/* Hero render ngoài .bb-page để rule global `.bb-page h1` không ghi đè màu tiêu đề. */}
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        title={page.heroTitle ?? pageTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("policy.title") },
          { label: pageTitle },
        ]}
      />
      <section className="bb-page">
        <div className="bb-container grid grid-cols-1 gap-[30px] pt-10 pb-[60px] items-start lg:grid-cols-[3fr_9fr]">
          <PolicySidebar activeHref={`/chinh-sach/${slug}`} title={t("policy.sidebarTitle")} />
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
