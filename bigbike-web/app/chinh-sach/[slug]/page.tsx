import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { getPublicMenu } from "@/lib/api/public-api";
import type { PublicMenu } from "@/lib/contracts/public";
import { getStaticPage } from "@/lib/content/static-pages";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

// Sidebar = menu vị trí "policy" (module Menu admin quản lý). Nội dung trang ĐÃ ĐÓNG CỨNG
// (lib/content/static-pages) — không còn gọi backend pages. URL = /chinh-sach/{page-slug}.
const POLICY_MENU_LOCATION = "policy";
const POLICY_BASE_PATH = "/chinh-sach";

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
      <WpStaticSidebarLayout
        sidebarItems={sidebarItems}
        bodyNode={
          <div
            className="static-page wyswyg"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
        }
      />
    </WpStaticShell>
  );
}
