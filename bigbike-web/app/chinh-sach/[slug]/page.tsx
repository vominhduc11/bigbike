import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

// Map URL slug → backend page slug
const POLICY_SLUG_MAP: Record<string, string> = {
  "bao-mat": "chinh-sach-bao-ve-thong-tin-ca-nhan",
  "bao-hanh": "chinh-sach-bao-hanh",
  "doi-tra": "chinh-sach-doi-tra-hang",
  "dieu-khoan": "cac-dieu-kien-va-dieu-khoan",
};

const POLICY_META_KEYS: Record<string, { title: string; description: string }> = {
  "bao-mat": {
    title: "policy.privacyTitle",
    description: "policy.privacyDescription",
  },
  "bao-hanh": {
    title: "policy.warrantyTitle",
    description: "policy.warrantyDescription",
  },
  "doi-tra": {
    title: "policy.returnsTitle",
    description: "policy.returnsDescription",
  },
  "dieu-khoan": {
    title: "policy.termsTitle",
    description: "policy.termsDescription",
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

// ISR on-demand: trang chính sách (CMS admin quản lý) → KHÔNG prebuild lúc build.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const meta = POLICY_META_KEYS[slug];
  if (!meta) return {};
  const backendSlug = POLICY_SLUG_MAP[slug];
  const pageResult = backendSlug ? await getPageBySlug(backendSlug, locale) : null;
  const page = pageResult?.data;
  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t(meta.title),
    description: page?.seo?.description ?? t(meta.description),
    canonicalPath: page?.seo?.canonicalUrl ?? `/chinh-sach/${slug}/`,
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function PolicyPage({ params }: Props) {
  const [{ slug }, t, tBreadcrumb] = await Promise.all([
    params,
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);
  const backendSlug = POLICY_SLUG_MAP[slug];
  if (!backendSlug) notFound();

  const locale = await getLocale();
  const result = await getPageBySlug(backendSlug, locale);
  // WP trả 404 khi page không tồn tại.
  if (!result.data) {
    notFound();
  }

  const page = result.data;
  const meta = POLICY_META_KEYS[slug];
  const pageTitle = safeText(page.title, meta ? t(meta.title) : t("policy.title"));

  // Sidebar .static-navigation: 4 nhóm chính sách, mục đang xem mang class "current".
  const sidebarItems: WpStaticSidebarItem[] = Object.keys(POLICY_SLUG_MAP).map((key) => ({
    label: t(POLICY_META_KEYS[key].title),
    href: `/chinh-sach/${key}`,
    current: key === slug,
  }));

  // page-static.php: .page-title + #main-content > .container > .row
  // > [.col-md-3 sidebar] + [.col-md-9 > .static-page.wyswyg].
  return (
    <LocalizedContentProvider kind="page" slug={backendSlug}>
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
