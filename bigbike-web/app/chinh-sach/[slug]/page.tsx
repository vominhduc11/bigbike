import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
import type { PublicMenu } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

// Sidebar + tập slug hợp lệ giờ do admin quản lý: menu vị trí "policy" + nội dung
// trang (PAGE) trong CMS. Không còn map slug hard-code. URL = /chinh-sach/{page-slug}.
const POLICY_MENU_LOCATION = "policy";
const POLICY_BASE_PATH = "/chinh-sach";

type Props = {
  params: Promise<{ slug: string }>;
};

// ISR on-demand: trang chính sách (CMS admin quản lý) → KHÔNG prebuild lúc build.
export async function generateStaticParams() {
  return [];
}

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
  const pageResult = await getPageBySlug(slug, locale);
  const page = pageResult?.data;
  if (!page) return {};
  return buildPublicMetadata({
    title: page.seo?.title ?? page.title ?? t("policy.title"),
    description: page.seo?.description ?? t("policy.title"),
    canonicalPath: page.seo?.canonicalUrl ?? `${POLICY_BASE_PATH}/${slug}/`,
    noIndex: page.seo?.noIndex ?? false,
  });
}

export default async function PolicyPage({ params }: Props) {
  const [{ slug }, locale, t, tBreadcrumb] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);

  // Trang nội dung + menu sidebar tải song song.
  const [result, menuResult] = await Promise.all([
    getPageBySlug(slug, locale),
    getPublicMenu(POLICY_MENU_LOCATION, locale),
  ]);
  // WP trả 404 khi page không tồn tại.
  if (!result.data) {
    notFound();
  }

  const page = result.data;
  const pageTitle = safeText(page.title, t("policy.title"));
  const sidebarItems = buildSidebarItems(menuResult?.data ?? null, slug);

  // page-static.php: .page-title + #main-content > .container > .row
  // > [.col-md-3 sidebar] + [.col-md-9 > .static-page.wyswyg].
  return (
    <LocalizedContentProvider kind="page" slug={slug}>
      <WpStaticShell
        title={page.heroTitle ?? pageTitle}
        titleNode={<LText field="title">{page.heroTitle ?? pageTitle}</LText>}
        heroBgUrl={page.heroImageUrl}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("policy.title") },
          { label: pageTitle, labelNode: <LText field="title">{pageTitle}</LText> },
        ]}
      >
        <WpStaticSidebarLayout
          sidebarItems={sidebarItems}
          bodyNode={
            <LHtml field="body" viHtml={sanitizeRichHtml(page.body)} className="static-page wyswyg" />
          }
        />
      </WpStaticShell>
    </LocalizedContentProvider>
  );
}
