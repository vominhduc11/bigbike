import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PrivacyPolicyContent } from "@/components/policy/PrivacyPolicyContent";
import { WarrantyPolicyContent, type WarrantyContact } from "@/components/policy/WarrantyPolicyContent";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import type { PublicMenu } from "@/lib/contracts/public";
import { getStaticPage } from "@/lib/content/static-pages";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

// Sidebar = menu vị trí "policy" (module Menu admin quản lý). Nội dung trang ĐÃ ĐÓNG CỨNG
// (lib/content/static-pages) — không còn gọi backend pages. URL = /chinh-sach/{page-slug}.
const POLICY_MENU_LOCATION = "policy";
const POLICY_BASE_PATH = "/chinh-sach";

// Trang Chính sách bảo hành có bố cục thiết kế riêng (bảng thời hạn theo thương hiệu, quy trình…)
// nên render qua component thay vì HTML CMS. Số điện thoại / Zalo / địa chỉ / giờ lấy từ site_settings.
const WARRANTY_SLUG = "chinh-sach-bao-hanh";

// Trang Chính sách bảo vệ thông tin cá nhân cũng có bố cục thiết kế riêng (mục thu thập, công cụ đo
// lường, chia sẻ bên thứ ba, quyền của khách…) nên render qua component. Số liên hệ ĐÓNG CỨNG trong
// component theo yêu cầu owner (xem PrivacyPolicyContent + allowlist guard).
const PRIVACY_SLUG = "chinh-sach-bao-ve-thong-tin-ca-nhan";

type Props = {
  params: Promise<{ slug: string }>;
};

// Tách slug trang ra khỏi URL mục menu policy (/chinh-sach/{slug}) để so khớp "current".
function menuItemSlug(url: string): string | null {
  const prefix = `${POLICY_BASE_PATH}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length).replace(/\/+$/, "") || null;
}

// .static-navigation: các mục chính sách do admin sắp xếp qua menu vị trí "policy".
function buildSidebarItems(menu: PublicMenu | null, currentSlug: string): WpStaticSidebarItem[] {
  if (!menu) return [];
  return menu.items
    .filter((item) => menuItemSlug(item.url) !== null)
    .map((item) => ({
      label: item.label,
      href: item.url,
      current: menuItemSlug(item.url) === currentSlug,
    }));
}

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
  const [{ slug }, locale, t, tBreadcrumb] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);

  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const menuResult = await getPublicMenu(POLICY_MENU_LOCATION, locale);
  const pageTitle = safeText(page.title, t("policy.title"));
  const sidebarItems = buildSidebarItems(menuResult?.data ?? null, slug);

  // Trang bảo hành & bảo mật: bố cục component riêng, số liên hệ lấy từ site_settings (không hardcode).
  let bodyNode: React.ReactNode;
  if (slug === WARRANTY_SLUG) {
    const settings = (await listPublicSettings(locale)).data ?? [];
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
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
      />
    );
  }

  // page-static.php: .page-title + #main-content > .container > .row
  // > [.col-md-3 sidebar] + [.col-md-9 > .static-page.wyswyg].
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
