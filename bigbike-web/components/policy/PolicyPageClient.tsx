"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicSettings, type PublicSetting } from "@/lib/api/client-api";
import { queryKeys } from "@/lib/query/keys";
import { getStaticPage } from "@/lib/content/static-pages";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { pickSetting } from "@/lib/utils/settings";
import { toHomePath } from "@/lib/utils/routes";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { PrivacyPolicyContent } from "./PrivacyPolicyContent";
import { WarrantyPolicyContent, type WarrantyContact } from "./WarrantyPolicyContent";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";

const WARRANTY_SLUG = "chinh-sach-bao-hanh";
const PRIVACY_SLUG = "chinh-sach-bao-mat-thong-tin";

type PolicyPageClientProps = {
  slug: string;
  initialPage: {
    slug: string;
    title: string;
    body: string;
    heroTitle: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoCanonicalUrl: string | null;
  };
  initialSettings: PublicSetting[];
};

function buildStaticSidebarItems(locale: string, currentSlug: string): WpStaticSidebarItem[] {
  const privacyPage = getStaticPage("chinh-sach-bao-mat-thong-tin", locale);
  const warrantyPage = getStaticPage("chinh-sach-bao-hanh", locale);
  const returnPage = getStaticPage("chinh-sach-doi-tra-hang", locale);
  const isEn = locale === "en";

  return [
    {
      label: privacyPage?.title || (isEn ? "Privacy Policy" : "Chính sách bảo mật thông tin"),
      href: "/chinh-sach/chinh-sach-bao-mat-thong-tin/",
      current: currentSlug === "chinh-sach-bao-mat-thong-tin",
    },
    {
      label: warrantyPage?.title || (isEn ? "Warranty Policy" : "Chính sách bảo hành"),
      href: "/chinh-sach/chinh-sach-bao-hanh/",
      current: currentSlug === "chinh-sach-bao-hanh",
    },
    {
      label: returnPage?.title || (isEn ? "Return Policy" : "Chính sách đổi trả hàng"),
      href: "/chinh-sach/chinh-sach-doi-tra-hang/",
      current: currentSlug === "chinh-sach-doi-tra-hang",
    },
  ];
}

export function PolicyPageClient({
  slug,
  initialPage,
  initialSettings,
}: PolicyPageClientProps) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;
  const t = useTranslations("StaticPage");
  const tBreadcrumb = useTranslations("Breadcrumb");

  // Refetch settings in client language if not vi (for warranty contact info).
  // Shared queryKeys.publicSettings(locale) with HomeLocalizedSettings — React Query
  // dedupes/reuses the cache instead of firing a second request for the same data.
  const { data: settingsData } = useQuery({
    queryKey: queryKeys.publicSettings(locale),
    queryFn: () => fetchPublicSettings(locale),
    enabled: isAlt && slug === WARRANTY_SLUG,
    staleTime: 5 * 60 * 1000,
  });

  const page = isAlt ? (getStaticPage(slug, locale) || initialPage) : initialPage;
  const pageTitle = page.title || t("policy.title");

  const sidebarItems = buildStaticSidebarItems(locale, slug);

  const settings = isAlt && settingsData ? settingsData : initialSettings;

  let bodyNode: React.ReactNode;
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
