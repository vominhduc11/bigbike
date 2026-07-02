"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicMenu, fetchPublicSettings } from "@/lib/api/client-api";
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

const POLICY_MENU_LOCATION = "policy";
const POLICY_BASE_PATH = "/chinh-sach";
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
  initialMenu: any;
  initialSettings: any[];
};

function menuItemSlug(url: string): string | null {
  const prefix = `${POLICY_BASE_PATH}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length).replace(/\/+$/, "") || null;
}

function buildSidebarItems(menu: any, currentSlug: string): WpStaticSidebarItem[] {
  if (!menu || !menu.items) return [];
  return menu.items
    .filter((item: any) => {
      const slug = menuItemSlug(item.url);
      if (slug === null) return false;
      return slug !== "huong-dan-mua-hang";
    })
    .map((item: any) => ({
      label: item.label,
      href: item.url,
      current: menuItemSlug(item.url) === currentSlug,
    }));
}

export function PolicyPageClient({
  slug,
  initialPage,
  initialMenu,
  initialSettings,
}: PolicyPageClientProps) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;
  const t = useTranslations("StaticPage");
  const tBreadcrumb = useTranslations("Breadcrumb");

  // Refetch policy menu in client language if not vi
  const { data: menuData } = useQuery({
    queryKey: ["policy-menu", locale],
    queryFn: () => fetchPublicMenu(POLICY_MENU_LOCATION, locale),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

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

  const menu = isAlt && menuData ? menuData : initialMenu;
  const sidebarItems = buildSidebarItems(menu, slug);

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
