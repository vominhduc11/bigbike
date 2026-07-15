import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getStaticPage } from "@/lib/content/static-pages";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { PrivacyPolicyContent } from "@/components/policy/PrivacyPolicyContent";
import { WarrantyPolicyContent, type WarrantyContact } from "@/components/policy/WarrantyPolicyContent";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { StaticSidebarLayout } from "@/components/layout/StaticSidebarLayout";
import type { PolicySidebarItem } from "@/components/layout/PolicySidebar";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { RichContent } from "@/components/layout/RichContent";
import { pickSetting } from "@/lib/utils/settings";
import { toHomePath } from "@/lib/utils/routes";

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
  const { slug } = await params;
  if (!(POLICY_SLUGS as readonly string[]).includes(slug)) {
    notFound();
  }

  // Render sẵn cả 2 bản VI/EN, client chọn theo locale đang bật (AUD-013 —
  // server luôn là `vi`, xem i18n/request.ts). Nội dung EN thiếu tự fallback VI.
  const [vi, en] = await Promise.all([
    renderPolicyForLocale(slug, "vi"),
    renderPolicyForLocale(slug, "en"),
  ]);
  return <LocaleSwitch vi={vi} en={en} />;
}

async function renderPolicyForLocale(slug: string, locale: string) {
  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const settingsResult = await listPublicSettings(locale);
  const settings = settingsResult?.data ?? [];
  const t = await getTranslations({ locale, namespace: "StaticPage" });
  const tBreadcrumb = await getTranslations({ locale, namespace: "Breadcrumb" });
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
      <RichContent
        html={sanitizeRichHtml(page.body, { allowInlineStyles: true, allowStyleTags: true })}
      />
    );
  }

  return (
    <StaticPageShell
      title={page.heroTitle ?? pageTitle}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: t("policy.title") },
        { label: pageTitle },
      ]}
    >
      <StaticSidebarLayout sidebarItems={sidebarItems} bodyNode={bodyNode} />
    </StaticPageShell>
  );
}

function buildStaticSidebarItems(locale: string, currentSlug: string): PolicySidebarItem[] {
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

