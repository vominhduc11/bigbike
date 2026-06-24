import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { AboutPageContent, type AboutBrandLogo } from "@/components/about/AboutPageContent";
import { listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

// Trang Giới thiệu: TĨNH HOÀN TOÀN — tiêu đề/hero/SEO cố định trong code, thân bài tĩnh (i18n `About`).
// Logo hãng + thông tin liên hệ là dữ liệu chung (brands + site_settings), không phải nội dung trang.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StaticPage");
  return buildPublicMetadata({
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    canonicalPath: toPagePath("gioi-thieu"),
  });
}

export default async function AboutPage() {
  const locale = await getLocale();
  const [t, brandsResult, settingsResult] = await Promise.all([
    getTranslations("StaticPage"),
    listBrands({ page: 1, size: 8, sort: "name:asc", lang: locale }),
    listPublicSettings(locale),
  ]);

  const pageTitle = t("aboutTitle");
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
    <WpStaticShell
      title={pageTitle}
      breadcrumb={[
        { label: "Bigbike.vn", href: toHomePath() },
        { label: pageTitle },
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
  );
}
