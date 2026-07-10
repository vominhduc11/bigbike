"use client";

import type { ReactNode } from "react";
import { Phone, Share2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { telHref } from "@/lib/utils/format";

/* eslint-disable @next/next/no-img-element */

/**
 * Nội dung trang Giới thiệu (/gioi-thieu) — TRANG TĨNH.
 *
 * Toàn bộ chữ lấy từ i18n namespace `About` (cố định trong code, song ngữ VI/EN); ảnh 5 ô dịch vụ
 * là asset tĩnh trong theme (`public/wp-content/themes/bigbike/images/a-{n}.png`). Logo hãng và thông
 * tin liên hệ là dữ liệu CHUNG của site (taxonomy thương hiệu + nhóm `contact`), truyền vào qua props.
 *
 * ⚠️ TYPOGRAPHY ĐÃ HIỆN ĐẠI HOÁ (2026-06) — bỏ phụ thuộc CSS WordPress `.about-us`:
 * Trước đây trang lấy toàn bộ cỡ chữ từ `wp-theme-static.css` (tiêu đề 50px CỐ ĐỊNH cả trên điện
 * thoại — lỗi responsive). Nay dùng thang cỡ chữ chung của web (text-ui-*) CÓ co theo màn hình,
 * khớp các trang tĩnh khác (Chính sách / Hướng dẫn size).
 *
 * Vì trang nằm dưới `wp-theme-static.css` (rule element trần unlayered `a{color:#007bff}`,
 * `p{margin-bottom:1rem}`… đè được Tailwind), nên: màu/đậm/khoảng cách/link/bóng/nền đặt qua inline
 * `style` (thắng mọi rule unlayered); chỉ CỠ CHỮ (text-ui-*) + LƯỚI responsive (grid + md:) + font
 * (font-cta) dùng Tailwind — các thuộc tính WP không nhắm tới element trần nên không bị đè.
 */

const THEME = "/wp-content/themes/bigbike";
const COLORS = {
  text: "var(--bb-color-footer-top)",
  textPrimary: "var(--bb-text-primary)",
  muted: "var(--bb-text-secondary)",
  red: "var(--bb-brand-primary)",
  surface: "var(--bb-bg-surface)",
  inverse: "var(--bb-text-inverse)",
  shadow: "var(--bb-shadow-lg)",
} as const;

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

function ServiceTile({
  image,
  title,
  body,
  highlight,
}: {
  image: string;
  title: string;
  body: string;
  highlight: boolean;
}) {
  const fg = highlight ? COLORS.inverse : COLORS.text;
  return (
    <div
      className="md:min-h-[360px]"
      style={{
        padding: 28,
        boxShadow: COLORS.shadow,
        background: highlight ? COLORS.red : COLORS.surface,
        color: fg,
      }}
    >
      <img
        src={image}
        alt={title}
        style={{ marginBottom: 24, display: "block", maxWidth: "100%", height: "auto" }}
      />
      <h3
        className="text-ui-16 max-md:text-ui-14 font-cta"
        style={{ margin: "0 0 14px", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.4, color: fg }}
      >
        {title}
      </h3>
      <p className="text-ui-16 max-md:text-ui-14" style={{ margin: 0, lineHeight: 1.6, color: fg }}>
        {body}
      </p>
    </div>
  );
}

function ContactItem({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="md:px-5" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, color: COLORS.red, marginTop: 2 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div
          className="text-ui-16"
          style={{ fontWeight: 700, color: COLORS.textPrimary, marginBottom: 8 }}
        >
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AboutPageContent({
  brands,
  contact,
}: {
  brands: AboutBrandLogo[];
  contact: AboutContactInfo;
}) {
  const t = useTranslations("About");

  // Key literal vì next-intl typing không nhận key động. Ô 1 & 5 tô nền đỏ như theme gốc.
  const services = [
    { title: t("service1Title"), body: t("service1Body"), image: `${THEME}/images/a-1.png`, highlight: true },
    { title: t("service2Title"), body: t("service2Body"), image: `${THEME}/images/a-2.png`, highlight: false },
    { title: t("service3Title"), body: t("service3Body"), image: `${THEME}/images/a-3.png`, highlight: false },
    { title: t("service4Title"), body: t("service4Body"), image: `${THEME}/images/a-4.png`, highlight: false },
    { title: t("service5Title"), body: t("service5Body"), image: `${THEME}/images/a-5.png`, highlight: true },
  ];

  const intro = [t("intro1"), t("intro2"), t("intro3"), t("intro4")].filter(
    (para) => para.trim().length > 0
  );
  const facebookHandle = contact.facebookUrl.replace(/^https?:\/\/(www\.)?/, "");
  const linkStyle = { color: COLORS.text, textDecoration: "none" } as const;

  return (
    <div style={{ color: COLORS.text, marginBottom: 80 }}>
      {/* ROW 1 — intro: tiêu đề + dẫn + logo hãng */}
      <div className="grid grid-cols-1 md:grid-cols-12" style={{ gap: 30 }}>
        <div className="md:col-span-4">
          <h2
            className="text-ui-35 max-md:text-ui-24 font-cta"
            style={{ margin: 0, fontWeight: 500, textTransform: "uppercase", lineHeight: 1.1 }}
          >
            {t("kicker")}
          </h2>
          <p
            className="text-ui-22 max-md:text-ui-18 font-cta"
            style={{ margin: "16px 0 0", textTransform: "uppercase", lineHeight: 1.25, color: COLORS.text }}
          >
            {t("tagline")}
          </p>
        </div>

        <div className="md:col-span-5">
          {intro.map((para, i) => (
            <p
              key={i}
              className="text-ui-16 max-md:text-ui-14"
              style={{ margin: "0 0 20px", lineHeight: 1.6, color: COLORS.muted }}
            >
              {para}
            </p>
          ))}
        </div>

        {brands.length > 0 && (
          <div className="md:col-span-3">
            <div className="grid grid-cols-2" style={{ gap: 20 }}>
              {brands.map((brand) => (
                <LocalizedLink
                  key={brand.id}
                  kind="brand"
                  viSlug={brand.slug}
                  enSlug={brand.slugEn}
                  title={brand.name}
                >
                  <img
                    src={brand.logoUrl}
                    alt={brand.logoAlt}
                    style={{ display: "block", maxWidth: "100%", height: "auto" }}
                  />
                </LocalizedLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ROW 2 — chất lượng + 5 ô dịch vụ */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 30, marginTop: 80 }}>
        <div style={{ maxWidth: 340 }}>
          <h2
            className="text-ui-22 max-md:text-ui-18 font-cta"
            style={{ margin: "0 0 20px", fontWeight: 500, textTransform: "uppercase", lineHeight: 1.25 }}
          >
            {t("qualityHeading")}
          </h2>
          <p className="text-ui-16 max-md:text-ui-14" style={{ margin: 0, lineHeight: 1.6, color: COLORS.muted }}>
            {t("qualityBody")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {services.slice(0, 2).map((tile, i) => (
            <ServiceTile key={i} {...tile} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {services.slice(2).map((tile, i) => (
            <ServiceTile key={i + 2} {...tile} />
          ))}
        </div>
      </div>

      {/* KHỐI LIÊN HỆ */}
      <div style={{ marginTop: 80 }}>
        <h2
          className="text-ui-22 max-md:text-ui-18 font-cta"
          style={{ margin: "0 0 16px", fontWeight: 500, textTransform: "uppercase", lineHeight: 1.25 }}
        >
          {t("connectHeading")}
        </h2>
        <p className="text-ui-16 max-md:text-ui-14" style={{ margin: "12px 0 0", lineHeight: 1.6, color: COLORS.muted }}>
          {t("connect1")}
        </p>
        <p className="text-ui-16 max-md:text-ui-14" style={{ margin: "6px 0 0", lineHeight: 1.6, color: COLORS.muted }}>
          {t("connect2")}
        </p>

        <div
          className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-border"
          style={{ gap: 24, marginTop: 40 }}
        >
          {contact.address && (
            <ContactItem icon={<Store size={28} strokeWidth={1.5} aria-hidden="true" />} label={t("storeLabel")}>
              <p className="text-ui-16 max-md:text-ui-14" style={{ margin: 0, color: COLORS.text, lineHeight: 1.6 }}>
                {contact.address}
              </p>
            </ContactItem>
          )}

          {(contact.hotline || contact.hotline2) && (
            <ContactItem icon={<Phone size={28} strokeWidth={1.5} aria-hidden="true" />} label={t("hotlineLabel")}>
              {contact.hotline && (
                <p className="text-ui-16 max-md:text-ui-14" style={{ margin: 0, lineHeight: 1.6 }}>
                  <a href={telHref(contact.hotline)} style={linkStyle}>
                    {contact.hotline}
                  </a>
                </p>
              )}
              {contact.hotline2 && (
                <p className="text-ui-16 max-md:text-ui-14" style={{ margin: "4px 0 0", lineHeight: 1.6 }}>
                  <a href={telHref(contact.hotline2)} style={linkStyle}>
                    {contact.hotline2}
                  </a>
                </p>
              )}
            </ContactItem>
          )}

          {contact.facebookUrl && (
            <ContactItem icon={<Share2 size={28} strokeWidth={1.5} aria-hidden="true" />} label={t("facebookLabel")}>
              <p className="text-ui-16 max-md:text-ui-14" style={{ margin: 0, lineHeight: 1.6 }}>
                <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  {facebookHandle}
                </a>
              </p>
            </ContactItem>
          )}
        </div>
      </div>
    </div>
  );
}
