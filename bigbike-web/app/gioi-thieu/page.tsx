import type { Metadata } from "next";
import { Phone, Share2, Store } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { resolveMediaUrl, safeText, telHref, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { pickSetting } from "@/lib/utils/settings";

/* eslint-disable @next/next/no-img-element */

const T = "/wp-content/themes/bigbike";

// Khối lưới dịch vụ — copy cố định 1:1 từ page-templates/page-about.php (theme WP).
const SERVICE_GRID = [
  { img: `${T}/images/a-1.png`, redBg: true, titleKey: "service1Title", bodyKey: "service1Body" },
  { img: `${T}/images/a-2.png`, redBg: false, titleKey: "service2Title", bodyKey: "service2Body" },
  { img: `${T}/images/a-3.png`, redBg: false, titleKey: "service3Title", bodyKey: "service3Body" },
  { img: `${T}/images/a-4.png`, redBg: false, titleKey: "service4Title", bodyKey: "service4Body" },
  { img: `${T}/images/a-5.png`, redBg: true, titleKey: "service5Title", bodyKey: "service5Body" },
] as const;

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
  const brands = brandsResult.data ?? [];
  const settings = settingsResult.data ?? [];

  const address = pickSetting(settings, ["contact_address"]);
  const hotline = pickSetting(settings, ["hotline"]);
  const hotline2 = pickSetting(settings, ["hotline_2"]);
  const facebookUrl = pickSetting(settings, ["facebook_url"]);
  const facebookHandle = facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  // page-about.php: .static-page.wyswyg > .about-us (row-1 giới thiệu + lưới logo
  // hãng, row-2 lưới dịch vụ, .block-contact). Copy marketing cố định theo theme;
  // logo hãng nạp động từ taxonomy thương hiệu, thông tin liên hệ lấy từ settings.
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
              /* Nội dung do admin sửa được (bảng pages → gioi-thieu). Ưu tiên dùng body DB;
                 fallback về layout theme cố định bên dưới khi body trống. */
              <LHtml field="body" viHtml={sanitizeRichHtml(page.body)} className="static-page wyswyg" />
            ) : (
            <div className="static-page wyswyg">
              <div className="about-us">
                <div className="row row-1">
                  <div className="col-md-4">
                    <div className="block-head">
                      <h3><Tr ns="About" k="kicker" /></h3>
                      <p><Tr ns="About" k="tagline" /></p>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="block-text">
                      <p><Tr ns="About" k="intro1" /></p>
                      <p><Tr ns="About" k="intro2" /></p>
                      <p><Tr ns="About" k="intro3" /></p>
                      <p><Tr ns="About" k="intro4" /></p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="block-img">
                      <div className="row">
                        {brands.map((brand) => {
                          const logoUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));
                          if (!logoUrl) return null;
                          return (
                            <div key={brand.id} className="col-6">
                              <LocalizedLink
                                kind="brand"
                                viSlug={brand.slug}
                                enSlug={brand.slugEn}
                                title={brand.name}
                              >
                                <img src={logoUrl} alt={brand.logo?.alt ?? brand.name} />
                              </LocalizedLink>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row row-2 align-items-center">
                  <div className="col-md-4">
                    <div className="block-head">
                      <h3><Tr ns="About" k="qualityHeading" /></h3>
                      <p><Tr ns="About" k="qualityBody" /></p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    {SERVICE_GRID.slice(0, 2).map((tile) => (
                      <div key={tile.img} className={tile.redBg ? "block-grid red-bg" : "block-grid"}>
                        <img src={tile.img} alt="logo" />
                        <h4><Tr ns="About" k={tile.titleKey} /></h4>
                        <p><Tr ns="About" k={tile.bodyKey} /></p>
                      </div>
                    ))}
                  </div>
                  <div className="col-md-4">
                    {SERVICE_GRID.slice(2).map((tile) => (
                      <div key={tile.img} className={tile.redBg ? "block-grid red-bg" : "block-grid"}>
                        <img src={tile.img} alt="logo" />
                        <h4><Tr ns="About" k={tile.titleKey} /></h4>
                        <p><Tr ns="About" k={tile.bodyKey} /></p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="block-contact">
                  <h3><Tr ns="About" k="connectHeading" /></h3>
                  <p><Tr ns="About" k="connect1" /></p>
                  <p><Tr ns="About" k="connect2" /></p>
                  <div className="row">
                    {address ? (
                      <div className="col-md-3">
                        <div className="block-item">
                          <Store size={28} strokeWidth={1.5} aria-hidden="true" />
                          <p><b><Tr ns="About" k="storeLabel" /></b></p>
                          <p>{address}</p>
                        </div>
                      </div>
                    ) : null}
                    {(hotline || hotline2) ? (
                      <div className="col-md-3 offset-md-1">
                        <div className="block-item">
                          <Phone size={28} strokeWidth={1.5} aria-hidden="true" />
                          <p><b><Tr ns="About" k="hotlineLabel" /></b></p>
                          {hotline ? (
                            <p>
                              <a href={telHref(hotline)}>{hotline}</a>
                            </p>
                          ) : null}
                          {hotline2 ? (
                            <p>
                              <a href={telHref(hotline2)}>{hotline2}</a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {facebookUrl ? (
                      <div className="col-md-3 offset-md-1">
                        <div className="block-item">
                          <Share2 size={28} strokeWidth={1.5} aria-hidden="true" />
                          <p><b><Tr ns="About" k="facebookLabel" /></b></p>
                          <p>
                            <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                              {facebookHandle}
                            </a>
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </WpStaticShell>
    </LocalizedContentProvider>
  );
}
