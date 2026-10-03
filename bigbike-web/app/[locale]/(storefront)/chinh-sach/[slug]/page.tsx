import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStaticPage } from "@/lib/content/static-pages";
import { getStorePolicy, listPublicSettings } from "@/lib/api/public-api";
import { getPolicyLinks, POLICY_SLUGS } from "@/lib/content/policy-pages";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { PrivacyPolicyContent } from "@/components/policy/PrivacyPolicyContent";
import { PolicyContact } from "@/components/policy/PolicyContact";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { StaticSidebarLayout } from "@/components/layout/StaticSidebarLayout";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { RichContent } from "@/components/layout/RichContent";
import { toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

const POLICY_BASE_PATH = "/chinh-sach";
const WARRANTY_SLUG = "chinh-sach-bao-hanh";
const PRIVACY_SLUG = "chinh-sach-bao-mat-thong-tin";

export const dynamicParams = false;

export async function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("StaticPage");
  const page = getStaticPage(slug, locale);
  if (!page) return {};
  const canonicalPath = translatePath(`${POLICY_BASE_PATH}/${slug}/`, locale);
  return buildPublicMetadata({
    title: page.seoTitle ?? page.title ?? t("policy.title"),
    description: page.seoDescription ?? t("policy.title"),
    canonicalPath,
    locale,
    languageAlternates: {
      vi: translatePath(`${POLICY_BASE_PATH}/${slug}/`, "vi"),
      en: translatePath(`${POLICY_BASE_PATH}/${slug}/`, "en"),
    },
    noIndex: false,
  });
}

export default async function PolicyPage({ params }: Props) {
  const { slug, locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  if (!POLICY_SLUGS.includes(slug)) {
    notFound();
  }

  return renderPolicyForLocale(slug, locale);
}

async function renderPolicyForLocale(slug: string, locale: Locale) {
  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const policyTopic = slug === WARRANTY_SLUG ? "warranty" : null;
  const livePolicy = policyTopic ? (await getStorePolicy(policyTopic, locale)).data : null;
  const t = await getTranslations({ locale, namespace: "StaticPage" });
  const tBreadcrumb = await getTranslations({ locale, namespace: "Breadcrumb" });
  const pageTitle = livePolicy?.title || page.title || t("policy.title");
  const sidebarItems = getPolicyLinks(locale, slug).map((item) => ({
    ...item,
    href: translatePath(item.href, locale),
  }));
  const settings = !policyTopic ? (await listPublicSettings(locale)).data : null;

  let bodyNode: ReactNode;
  if (slug === PRIVACY_SLUG) {
    bodyNode = (
      <>
        <RichContent className="[&_h2]:uppercase!" html={sanitizeRichHtml(page.body, { locale })} />
        <PrivacyPolicyContent locale={locale} />
      </>
    );
  } else if (livePolicy?.bodyHtml) {
    bodyNode = (
      <RichContent
        html={sanitizeRichHtml(livePolicy.bodyHtml, { allowInlineStyles: true, locale })}
      />
    );
  } else if (!policyTopic && page.body) {
    bodyNode = (
      <RichContent className="[&_h2]:uppercase!" html={sanitizeRichHtml(page.body, { locale })} />
    );
  } else {
    bodyNode = (
      <section className="border border-border bg-muted p-6" role="status" aria-live="polite">
        <h2 className="text-lg font-bold uppercase text-foreground">
          {t("policy.temporarilyUnavailableTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("policy.temporarilyUnavailableDescription")}
        </p>
      </section>
    );
  }

  return (
    <StaticPageShell
      title={page.heroTitle ?? pageTitle}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath(locale) },
        { label: t("policy.title") },
        { label: pageTitle },
      ]}
    >
      <StaticSidebarLayout
        sidebarItems={sidebarItems}
        sidebarEmptyLabel={t("policy.title")}
        compactSidebar
        bodyNode={
          <>
            {bodyNode}
            {!policyTopic && <PolicyContact locale={locale} settings={settings} />}
          </>
        }
      />
    </StaticPageShell>
  );
}
