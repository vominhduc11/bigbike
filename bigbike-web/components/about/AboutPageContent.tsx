"use client";

import { Phone, Share2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEnSettingLookup } from "@/components/home/HomeLocalizedSettings";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { telHref } from "@/lib/utils/format";

/* eslint-disable @next/next/no-img-element */

/**
 * Nội dung trang Giới thiệu (/gioi-thieu) — copy lấy từ `site_settings` nhóm `public_about`
 * (admin sửa được qua Cài đặt → Trang Giới thiệu), giữ nguyên bố cục lưới 5 ô của theme WP.
 *
 * Server render `vi` (ISR/SEO) bằng các prop `*Vi` (đã settings-first, fallback i18n `About`);
 * khi khách đổi sang EN, `useEnSettingLookup` swap sang bản EN admin nhập — cùng pattern với
 * `HomeLocalizedSettings`. Render đầu (vi) dùng prop server → khớp HTML server, không hydration
 * mismatch. Logo hãng nạp từ taxonomy thương hiệu; địa chỉ/hotline/Facebook từ nhóm `contact`.
 */

export type AboutService = {
  title: string;
  body: string;
  /** Ảnh đã resolve ở server (theme path hoặc media URL). */
  image: string;
  highlight: boolean;
};

export type AboutBrandLogo = {
  id: string;
  name: string;
  slug: string;
  slugEn?: string | null;
  logoUrl: string;
  logoAlt: string;
};

export type AboutContactInfo = {
  address: string;
  hotline: string;
  hotline2: string;
  facebookUrl: string;
};

export function AboutPageContent({
  kickerVi,
  taglineVi,
  introHtmlVi,
  qualityHeadingVi,
  qualityBodyVi,
  servicesVi,
  connectHeadingVi,
  connectIntro1Vi,
  connectIntro2Vi,
  brands,
  contact,
}: {
  kickerVi: string;
  taglineVi: string;
  introHtmlVi: string;
  qualityHeadingVi: string;
  qualityBodyVi: string;
  servicesVi: AboutService[];
  connectHeadingVi: string;
  connectIntro1Vi: string;
  connectIntro2Vi: string;
  brands: AboutBrandLogo[];
  contact: AboutContactInfo;
}) {
  const pick = useEnSettingLookup();
  const t = useTranslations("About");

  const kicker = pick("about_page_kicker") ?? kickerVi;
  const tagline = pick("about_page_tagline") ?? taglineVi;
  const enIntro = pick("about_page_intro_html");
  const introHtml = enIntro ? sanitizeRichHtml(enIntro) : introHtmlVi;
  const qualityHeading = pick("about_page_quality_heading") ?? qualityHeadingVi;
  const qualityBody = pick("about_page_quality_body") ?? qualityBodyVi;
  const connectHeading = pick("about_page_connect_heading") ?? connectHeadingVi;
  const connectIntro1 = pick("about_page_connect_intro1") ?? connectIntro1Vi;
  const connectIntro2 = pick("about_page_connect_intro2") ?? connectIntro2Vi;
  const address = pick("contact_address") ?? contact.address;

  const services = servicesVi.map((tile, i) => ({
    ...tile,
    title: pick(`about_page_service${i + 1}_title`) ?? tile.title,
    body: pick(`about_page_service${i + 1}_body`) ?? tile.body,
  }));

  const facebookHandle = contact.facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <div className="static-page wyswyg">
      <div className="about-us">
        <div className="row row-1">
          <div className="col-md-4">
            <div className="block-head">
              <h3>{kicker}</h3>
              <p>{tagline}</p>
            </div>
          </div>
          <div className="col-md-5">
            <div className="block-text" dangerouslySetInnerHTML={{ __html: introHtml }} />
          </div>
          <div className="col-md-3">
            <div className="block-img">
              <div className="row">
                {brands.map((brand) => (
                  <div key={brand.id} className="col-6">
                    <LocalizedLink
                      kind="brand"
                      viSlug={brand.slug}
                      enSlug={brand.slugEn}
                      title={brand.name}
                    >
                      <img src={brand.logoUrl} alt={brand.logoAlt} />
                    </LocalizedLink>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="row row-2 align-items-center">
          <div className="col-md-4">
            <div className="block-head">
              <h3>{qualityHeading}</h3>
              <p>{qualityBody}</p>
            </div>
          </div>
          <div className="col-md-4">
            {services.slice(0, 2).map((tile, i) => (
              <div key={i} className={tile.highlight ? "block-grid red-bg" : "block-grid"}>
                {tile.image ? <img src={tile.image} alt={tile.title} /> : null}
                <h4>{tile.title}</h4>
                <p>{tile.body}</p>
              </div>
            ))}
          </div>
          <div className="col-md-4">
            {services.slice(2).map((tile, i) => (
              <div key={i + 2} className={tile.highlight ? "block-grid red-bg" : "block-grid"}>
                {tile.image ? <img src={tile.image} alt={tile.title} /> : null}
                <h4>{tile.title}</h4>
                <p>{tile.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="block-contact">
          <h3>{connectHeading}</h3>
          <p>{connectIntro1}</p>
          <p>{connectIntro2}</p>
          <div className="row">
            {address ? (
              <div className="col-md-3">
                <div className="block-item">
                  <Store size={28} strokeWidth={1.5} aria-hidden="true" />
                  <p><b>{t("storeLabel")}</b></p>
                  <p>{address}</p>
                </div>
              </div>
            ) : null}
            {(contact.hotline || contact.hotline2) ? (
              <div className="col-md-3 offset-md-1">
                <div className="block-item">
                  <Phone size={28} strokeWidth={1.5} aria-hidden="true" />
                  <p><b>{t("hotlineLabel")}</b></p>
                  {contact.hotline ? (
                    <p><a href={telHref(contact.hotline)}>{contact.hotline}</a></p>
                  ) : null}
                  {contact.hotline2 ? (
                    <p><a href={telHref(contact.hotline2)}>{contact.hotline2}</a></p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {contact.facebookUrl ? (
              <div className="col-md-3 offset-md-1">
                <div className="block-item">
                  <Share2 size={28} strokeWidth={1.5} aria-hidden="true" />
                  <p><b>{t("facebookLabel")}</b></p>
                  <p>
                    <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer">
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
  );
}
