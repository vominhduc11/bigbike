import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStaticPage } from "@/lib/content/static-pages";
import { getStorePolicy } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { PrivacyPolicyContent } from "@/components/policy/PrivacyPolicyContent";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { StaticSidebarLayout } from "@/components/layout/StaticSidebarLayout";
import type { PolicySidebarItem } from "@/components/layout/PolicySidebar";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { RichContent } from "@/components/layout/RichContent";
import { toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

const POLICY_BASE_PATH = "/chinh-sach";
const WARRANTY_SLUG = "chinh-sach-bao-hanh";
const PRIVACY_SLUG = "chinh-sach-bao-mat-thong-tin";
const RETURN_SLUG = "chinh-sach-doi-tra-hang";

// Đúng 3 trang chính sách cố định (owner decision 2026-07-15, FIX_PROMPT §2 #6):
// Bảo mật thông tin, Bảo hành, Đổi trả hàng. KHÔNG build các slug tĩnh khác
// (2 trang hướng dẫn size có route riêng dưới /huong-dan/ — AUD-031).
const POLICY_SLUGS = [PRIVACY_SLUG, WARRANTY_SLUG, RETURN_SLUG] as const;

export const dynamicParams = false;

export async function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
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
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  if (!(POLICY_SLUGS as readonly string[]).includes(slug)) {
    notFound();
  }

  return renderPolicyForLocale(slug, locale);
}

async function renderPolicyForLocale(slug: string, locale: Locale) {
  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const policyTopic = slug === WARRANTY_SLUG
    ? "warranty"
    : slug === RETURN_SLUG ? "return-exchange" : null;
  const livePolicy = policyTopic ? (await getStorePolicy(policyTopic, locale)).data : null;
  const t = await getTranslations({ locale, namespace: "StaticPage" });
  const tBreadcrumb = await getTranslations({ locale, namespace: "Breadcrumb" });
  const pageTitle = livePolicy?.title || page.title || t("policy.title");
  const sidebarItems = buildStaticSidebarItems(locale, slug);

  let bodyNode: ReactNode;
  if (slug === PRIVACY_SLUG) {
    bodyNode = <PrivacyPolicyContent locale={locale} />;
  } else if (livePolicy?.bodyHtml) {
    bodyNode = (
      <RichContent
        html={sanitizeRichHtml(livePolicy.bodyHtml, { allowInlineStyles: true, locale })}
      />
    );
  } else {
    bodyNode = (
      <section
        className="border border-border bg-muted p-6"
        role="status"
        aria-live="polite"
      >
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
      <StaticSidebarLayout sidebarItems={sidebarItems} bodyNode={bodyNode} />
    </StaticPageShell>
  );
}

function buildStaticSidebarItems(locale: Locale, currentSlug: string): PolicySidebarItem[] {
  const privacyPage = getStaticPage(PRIVACY_SLUG, locale);
  const warrantyPage = getStaticPage(WARRANTY_SLUG, locale);
  const returnPage = getStaticPage("chinh-sach-doi-tra-hang", locale);
  const isEn = locale === "en";

  return [
    {
      label: privacyPage?.title || (isEn ? "Privacy Policy" : "Chính sách bảo mật thông tin"),
      href: translatePath("/chinh-sach/chinh-sach-bao-mat-thong-tin/", locale),
      current: currentSlug === PRIVACY_SLUG,
    },
    {
      label: warrantyPage?.title || (isEn ? "Warranty Policy" : "Chính sách bảo hành"),
      href: translatePath("/chinh-sach/chinh-sach-bao-hanh/", locale),
      current: currentSlug === WARRANTY_SLUG,
    },
    {
      label: returnPage?.title || (isEn ? "Return Policy" : "Chính sách đổi trả hàng"),
      href: translatePath("/chinh-sach/chinh-sach-doi-tra-hang/", locale),
      current: currentSlug === "chinh-sach-doi-tra-hang",
    },
  ];
}
