import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { AboutPageContent, type AboutBrandLogo } from "@/components/about/AboutPageContent";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

// Trang Giới thiệu: HERO (banner đầu trang) + SEO vẫn do admin quản lý bình thường qua bảng `pages`
// (Nội dung → trang gioi-thieu: tiêu đề/ảnh hero/SEO). Riêng THÂN BÀI là TĨNH — chữ cố định trong code
// (i18n `About`), admin không sửa, không đọc settings public_about. Logo hãng + liên hệ là dữ liệu chung.

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("StaticPage")]);
  const pageResult = await getPageBySlug("gioi-thieu", locale);
  const page = pageResult.data;

  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("aboutTitle"),
    description: page?.seo?.description ?? t("aboutDescription"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("gioi-thieu"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function AboutPage() {
  const locale = await getLocale();
  const [pageResult, brandsResult, settingsResult] = await Promise.all([
    getPageBySlug("gioi-thieu", locale),
    listBrands({ page: 1, size: 8, sort: "name:asc", lang: locale }),
    listPublicSettings(locale),
  ]);

  const page = pageResult.data;
  const pageTitle = safeText(page?.title, "Giới thiệu");
  const settings = settingsResult.data ?? [];
  const setting = (key: string) => pickSetting(settings, [key]);

  const brands: AboutBrandLogo[] = (brandsResult.data ?? [])
    .map((brand): AboutBrandLogo | null => {
      // Logo hãng phục vụ từ MinIO (same-origin proxy `/wp-content/uploads/…`), KHÔNG hotlink
      // origin web cũ `bigbike.vn` — nhiều logo (brand-logos/*) chỉ tồn tại trong MinIO (AGENTS.md §14.3).
      const logoUrl = resolveMediaUrl(brand.logo?.url?.trim());
      if (!logoUrl) return null;
      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        slugEn: brand.slugEn,
        logoUrl,
        logoAlt: brand.logo?.alt ?? brand.name,
      };
    })
    .filter((b): b is AboutBrandLogo => b !== null);

  return (
    <LocalizedContentProvider kind="page" slug="gioi-thieu">
      <WpStaticShell
        title={page?.heroTitle ?? pageTitle}
        titleNode={<LText field="title">{page?.heroTitle ?? pageTitle}</LText>}
        heroBgUrl={page?.heroImageUrl}
        breadcrumb={[
          { label: "Bigbike.vn", href: toHomePath() },
          { label: pageTitle, labelNode: <LText field="title">{pageTitle}</LText> },
        ]}
      >
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <AboutPageContent
                brands={brands}
                contact={{
                  address: setting("contact_address"),
                  hotline: setting("hotline"),
                  hotline2: setting("hotline_2"),
                  facebookUrl: setting("facebook_url"),
                }}
              />
            </div>
          </div>
        </div>
      </WpStaticShell>
    </LocalizedContentProvider>
  );
}
