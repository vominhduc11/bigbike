import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import {
  AboutPageContent,
  type AboutBrandLogo,
  type AboutService,
} from "@/components/about/AboutPageContent";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

const T = "/wp-content/themes/bigbike";

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
  const [pageResult, brandsResult, settingsResult, tAbout] = await Promise.all([
    getPageBySlug("gioi-thieu", locale),
    listBrands({ page: 1, size: 8, sort: "name:asc", lang: locale }),
    listPublicSettings(locale),
    getTranslations("About"),
  ]);

  const page = pageResult.data;
  const pageTitle = safeText(page?.title, "Giới thiệu");
  const brandList = brandsResult.data ?? [];
  const settings = settingsResult.data ?? [];

  // Copy trang Giới thiệu: ưu tiên giá trị admin nhập (site_settings nhóm public_about),
  // fallback copy theme gốc (i18n About) khi key trống — trang không bao giờ trắng.
  const setting = (key: string) => pickSetting(settings, [key]);

  const introHtmlVi = sanitizeRichHtml(
    setting("about_page_intro_html") ||
      [tAbout("intro1"), tAbout("intro2"), tAbout("intro3"), tAbout("intro4")]
        .map((p) => `<p>${p}</p>`)
        .join(""),
  );

  // Fallback copy theme dùng key literal (next-intl typing không nhận key động).
  const serviceFallback = [
    { title: tAbout("service1Title"), body: tAbout("service1Body") },
    { title: tAbout("service2Title"), body: tAbout("service2Body") },
    { title: tAbout("service3Title"), body: tAbout("service3Body") },
    { title: tAbout("service4Title"), body: tAbout("service4Body") },
    { title: tAbout("service5Title"), body: tAbout("service5Body") },
  ];
  const servicesVi: AboutService[] = serviceFallback.map((fallback, idx) => {
    const i = idx + 1;
    const highlightRaw = setting(`about_page_service${i}_highlight`);
    return {
      title: setting(`about_page_service${i}_title`) || fallback.title,
      body: setting(`about_page_service${i}_body`) || fallback.body,
      image:
        resolveMediaUrl(setting(`about_page_service${i}_image`)) || `${T}/images/a-${i}.png`,
      highlight: highlightRaw ? highlightRaw === "true" : i === 1 || i === 5,
    };
  });

  const brands: AboutBrandLogo[] = brandList
    .map((brand): AboutBrandLogo | null => {
      const logoUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));
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
              {page?.body ? (
                /* Escape hatch: nếu admin soạn riêng thân bài (bảng pages → gioi-thieu) thì
                   ưu tiên bản đó, thay cho bố cục lưới dịch vụ dựng từ settings. */
                <LHtml field="body" viHtml={sanitizeRichHtml(page.body)} className="static-page wyswyg" />
              ) : (
                <AboutPageContent
                  kickerVi={setting("about_page_kicker") || tAbout("kicker")}
                  taglineVi={setting("about_page_tagline") || tAbout("tagline")}
                  introHtmlVi={introHtmlVi}
                  qualityHeadingVi={setting("about_page_quality_heading") || tAbout("qualityHeading")}
                  qualityBodyVi={setting("about_page_quality_body") || tAbout("qualityBody")}
                  servicesVi={servicesVi}
                  connectHeadingVi={setting("about_page_connect_heading") || tAbout("connectHeading")}
                  connectIntro1Vi={setting("about_page_connect_intro1") || tAbout("connect1")}
                  connectIntro2Vi={setting("about_page_connect_intro2") || tAbout("connect2")}
                  brands={brands}
                  contact={{
                    address: setting("contact_address"),
                    hotline: setting("hotline"),
                    hotline2: setting("hotline_2"),
                    facebookUrl: setting("facebook_url"),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </WpStaticShell>
    </LocalizedContentProvider>
  );
}
