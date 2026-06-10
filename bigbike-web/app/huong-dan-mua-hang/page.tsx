import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { toHomePath, toPagePath } from "@/lib/utils/routes";

const GUIDE_HERO_BG = "/wp-content/themes/bigbike/images/policy1.png";
const GUIDE_HERO_ILLUSTRATION = "/wp-content/themes/bigbike/images/policy.png";
const CURRENT_PATH = "/huong-dan-mua-hang/";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const pageResult = await getPageBySlug("huong-dan-mua-hang", locale);
  const page = pageResult.data;
  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("howToBuy.title"),
    description: page?.seo?.description ?? t("howToBuy.description"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("huong-dan-mua-hang"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function HowToBuyPage() {
  const locale = await getLocale();
  const [pageResult, menuResult, t, tBreadcrumb] = await Promise.all([
    getPageBySlug("huong-dan-mua-hang", locale),
    getPublicMenu("guide", locale),
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);

  // WP trả 404 khi page không tồn tại.
  if (!pageResult.data) {
    notFound();
  }

  const page = pageResult.data;
  const pageTitle = safeText(page.title, t("howToBuy.title"));

  // Sidebar .static-navigation dùng chung menu "guide" như nhóm /huong-dan.
  const sidebarItems: WpStaticSidebarItem[] = (menuResult.data?.items ?? []).map((item) => {
    const href = normalizeMenuUrl(item.url);
    return {
      label: safeText(item.label, t("howToBuy.title")),
      href,
      current: href === CURRENT_PATH,
    };
  });

  // page-guide.php: .page-title + #main-content > .container > .row
  // > [.col-md-3 sidebar] + [.col-md-9 > .static-page.wyswyg].
  return (
    <WpStaticShell
      title={page.heroTitle ?? pageTitle}
      heroBgUrl={page.heroImageUrl ?? GUIDE_HERO_BG}
      heroIllustrationUrl={GUIDE_HERO_ILLUSTRATION}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: pageTitle },
      ]}
    >
      <WpStaticSidebarLayout
        sidebarItems={sidebarItems}
        sidebarEmptyLabel={t("howToBuy.title")}
        body={page.body}
      />
    </WpStaticShell>
  );
}
