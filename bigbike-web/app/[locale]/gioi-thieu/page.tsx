import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
import { AboutPageContent, type AboutBrandLogo } from "@/components/about/AboutPageContent";
import { listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";
import type { Locale } from "@/i18n/locale";

// Trang Giới thiệu: TĨNH HOÀN TOÀN — tiêu đề/hero/SEO cố định trong code, thân bài tĩnh (i18n `About`).
// Logo hãng + thông tin liên hệ là dữ liệu chung (brands + site_settings), không phải nội dung trang.

type AboutPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("StaticPage");
  return buildPublicMetadata({
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    canonicalPath: toPagePath("gioi-thieu", locale),
    locale,
    languageAlternates: { vi: toPagePath("gioi-thieu", "vi"), en: toPagePath("gioi-thieu", "en") },
  });
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
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
        slugEn: null,
        logo: { ...brand.logo, url: logoUrl },
      };
    })
    .filter((b): b is AboutBrandLogo => b !== null);

  return (
    <StaticPageShell
      title={pageTitle}
      breadcrumb={[
        { label: "Bigbike.vn", href: toHomePath(locale) },
        { label: pageTitle },
      ]}
    >
      <Container>
        <AboutPageContent
          brands={brands}
          contact={{
            address: setting("contact_address"),
            hotline: setting("hotline"),
            hotline2: setting("hotline_2"),
            facebookUrl: setting("facebook_url"),
          }}
        />
      </Container>
    </StaticPageShell>
  );
}
