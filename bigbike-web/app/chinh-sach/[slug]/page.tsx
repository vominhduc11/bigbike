import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getStaticPage, staticPageSlugs } from "@/lib/content/static-pages";
import { listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { PrivacyPolicyContent } from "@/components/policy/PrivacyPolicyContent";
import { WarrantyPolicyContent, type WarrantyContact } from "@/components/policy/WarrantyPolicyContent";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { pickSetting } from "@/lib/utils/settings";
import { toHomePath } from "@/lib/utils/routes";

const POLICY_BASE_PATH = "/chinh-sach";
const WARRANTY_SLUG = "chinh-sach-bao-hanh";
const PRIVACY_SLUG = "chinh-sach-bao-mat-thong-tin";

export const dynamicParams = false;

export async function generateStaticParams() {
  return staticPageSlugs().map((slug) => ({ slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const page = getStaticPage(slug, locale);
  if (!page) return {};
  return buildPublicMetadata({
    title: page.seoTitle ?? page.title ?? t("policy.title"),
    description: page.seoDescription ?? t("policy.title"),
    canonicalPath: page.seoCanonicalUrl ?? `${POLICY_BASE_PATH}/${slug}/`,
    noIndex: false,
  });
}

export default async function PolicyPage({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([
    params,
    getLocale(),
  ]);

  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const settingsResult = await listPublicSettings(locale);
  const settings = settingsResult?.data ?? [];
  const t = await getTranslations("StaticPage");
  const tBreadcrumb = await getTranslations("Breadcrumb");
  const pageTitle = page.title || t("policy.title");
  const sidebarItems = buildStaticSidebarItems(locale, slug);

  let bodyNode: ReactNode;
  if (slug === WARRANTY_SLUG) {
    const contact: WarrantyContact = {
      hotline: pickSetting(settings, ["hotline"]),
      zalo: pickSetting(settings, ["hotline_2"]),
      zaloUrl: pickSetting(settings, ["zalo_url"]),
      address: pickSetting(settings, ["contact_address"]),
      hoursWeekday: pickSetting(settings, ["opening_hours_weekday"]),
      hoursWeekend: pickSetting(settings, ["opening_hours_weekend"]),
    };
    bodyNode = <WarrantyPolicyContent locale={locale} contact={contact} />;
  } else if (slug === PRIVACY_SLUG) {
    bodyNode = <PrivacyPolicyContent locale={locale} />;
  } else {
    bodyNode = (
      <div
        className="static-page wyswyg"
        dangerouslySetInnerHTML={{
          __html: sanitizeRichHtml(page.body, { allowInlineStyles: true, allowStyleTags: true }),
        }}
      />
    );
  }

  return (
    <WpStaticShell
      title={page.heroTitle ?? pageTitle}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: t("policy.title") },
        { label: pageTitle },
      ]}
    >
      <WpStaticSidebarLayout sidebarItems={sidebarItems} bodyNode={bodyNode} />
    </WpStaticShell>
  );
}

function buildStaticSidebarItems(locale: string, currentSlug: string): WpStaticSidebarItem[] {
  const privacyPage = getStaticPage(PRIVACY_SLUG, locale);
  const warrantyPage = getStaticPage(WARRANTY_SLUG, locale);
  const returnPage = getStaticPage("chinh-sach-doi-tra-hang", locale);
  const isEn = locale === "en";

  return [
    {
      label: privacyPage?.title || (isEn ? "Privacy Policy" : "Chính sách bảo mật thông tin"),
      href: "/chinh-sach/chinh-sach-bao-mat-thong-tin/",
      current: currentSlug === PRIVACY_SLUG,
    },
    {
      label: warrantyPage?.title || (isEn ? "Warranty Policy" : "Chính sách bảo hành"),
      href: "/chinh-sach/chinh-sach-bao-hanh/",
      current: currentSlug === WARRANTY_SLUG,
    },
    {
      label: returnPage?.title || (isEn ? "Return Policy" : "Chính sách đổi trả hàng"),
      href: "/chinh-sach/chinh-sach-doi-tra-hang/",
      current: currentSlug === "chinh-sach-doi-tra-hang",
    },
  ];
}

