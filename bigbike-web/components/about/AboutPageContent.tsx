"use client";

import { Phone, Share2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { telHref } from "@/lib/utils/format";

/* eslint-disable @next/next/no-img-element */

/**
 * Nội dung trang Giới thiệu (/gioi-thieu) — TRANG TĨNH.
 *
 * Toàn bộ chữ lấy từ i18n namespace `About` (cố định trong code, song ngữ VI/EN); ảnh 5 ô dịch vụ
 * là asset tĩnh trong theme (`public/wp-content/themes/bigbike/images/a-{n}.png`). Admin KHÔNG quản
 * lý copy của trang này nữa — không đọc `site_settings` nhóm `public_about`. Logo hãng và thông tin
 * liên hệ là dữ liệu CHUNG của site (taxonomy thương hiệu + nhóm `contact`), tự hiển thị, không phải
 * cấu hình riêng cho trang Giới thiệu.
 */

const THEME = "/wp-content/themes/bigbike";

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
  brands,
  contact,
}: {
  brands: AboutBrandLogo[];
  contact: AboutContactInfo;
}) {
  const t = useTranslations("About");

  // Key literal vì next-intl typing không nhận key động. Ô 1 & 5 tô nền cam (red-bg) như theme gốc.
  const services = [
    { title: t("service1Title"), body: t("service1Body"), image: `${THEME}/images/a-1.png`, highlight: true },
    { title: t("service2Title"), body: t("service2Body"), image: `${THEME}/images/a-2.png`, highlight: false },
    { title: t("service3Title"), body: t("service3Body"), image: `${THEME}/images/a-3.png`, highlight: false },
    { title: t("service4Title"), body: t("service4Body"), image: `${THEME}/images/a-4.png`, highlight: false },
    { title: t("service5Title"), body: t("service5Body"), image: `${THEME}/images/a-5.png`, highlight: true },
  ];

  const facebookHandle = contact.facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <div className="static-page wyswyg">
      <div className="about-us">
        <div className="row row-1">
          <div className="col-md-4">
            <div className="block-head">
              <h3>{t("kicker")}</h3>
              <p>{t("tagline")}</p>
            </div>
          </div>
          <div className="col-md-5">
            <div className="block-text">
              {[t("intro1"), t("intro2"), t("intro3"), t("intro4")]
                .filter((para) => para.trim().length > 0)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
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
              <h3>{t("qualityHeading")}</h3>
              <p>{t("qualityBody")}</p>
            </div>
          </div>
          <div className="col-md-4">
            {services.slice(0, 2).map((tile, i) => (
              <div key={i} className={tile.highlight ? "block-grid red-bg" : "block-grid"}>
                <img src={tile.image} alt={tile.title} />
                <h4>{tile.title}</h4>
                <p>{tile.body}</p>
              </div>
            ))}
          </div>
          <div className="col-md-4">
            {services.slice(2).map((tile, i) => (
              <div key={i + 2} className={tile.highlight ? "block-grid red-bg" : "block-grid"}>
                <img src={tile.image} alt={tile.title} />
                <h4>{tile.title}</h4>
                <p>{tile.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="block-contact">
          <h3>{t("connectHeading")}</h3>
          <p>{t("connect1")}</p>
          <p>{t("connect2")}</p>
          <div className="row">
            {contact.address ? (
              <div className="col-md-3">
                <div className="block-item">
                  <Store size={28} strokeWidth={1.5} aria-hidden="true" />
                  <p><b>{t("storeLabel")}</b></p>
                  <p>{contact.address}</p>
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
