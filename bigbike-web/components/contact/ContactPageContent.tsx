"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { telHref } from "@/lib/utils/format";

export type ContactInfo = {
  hotline: string;
  hotline2: string;
  hotline3?: string;
  address: string;
  hoursWeekday: string;
  hoursWeekend: string;
  hoursHoliday: string;
  zaloUrl: string;
  facebookUrl: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  shopeeUrl?: string;
  instagramUrl?: string;
  email?: string;
};

function getVietnamTime() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 7);
}

function getAddressParts(address: string) {
  if (!address) return { main: "", sub: "" };
  const parts = address.split(",");
  const main = parts[0]?.trim() || "";
  const sub = parts.slice(1).join(",").trim();
  return { main, sub };
}

function getSocialHandle(
  url: string,
  type: "facebook" | "youtube" | "tiktok" | "shopee"
): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (type === "facebook") return path ? `facebook.com/${path}` : u.host;
    if (type === "youtube") return path ? `@${path.replace(/^@/, "")}` : u.host;
    if (type === "tiktok") return path ? `@${path.replace(/^@/, "")}` : u.host;
    if (type === "shopee") return path ? path : u.host;
    return path ? `@${path}` : u.host;
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "");
  }
}

function getZaloDisplayPhone(zaloUrl: string): string {
  if (!zaloUrl) return "";
  const match = zaloUrl.match(/zalo\.me\/(\d+)/);
  if (match && match[1]) {
    let phone = match[1];
    if (phone.startsWith("84")) phone = "0" + phone.slice(2);
    if (phone.length === 10)
      return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    return phone;
  }
  return "";
}

export function ContactPageContent({ contact }: { contact: ContactInfo }) {
  const locale = useLocale();
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    const checkOpenStatus = () => {
      const vnTime = getVietnamTime();
      const day = vnTime.getDay();
      const timeValue = vnTime.getHours() * 100 + vnTime.getMinutes();
      if (day === 0) {
        setIsOpenNow(timeValue >= 900 && timeValue < 1800);
      } else {
        setIsOpenNow(timeValue >= 900 && timeValue < 2100);
      }
    };
    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  if (!contact) return null;

  const { main: mainAddr, sub: subAddr } = getAddressParts(contact.address || "");
  const zaloPhone = getZaloDisplayPhone(contact.zaloUrl || "");
  const mapUrl = contact.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&z=17&output=embed`
    : "";

  return (
    <div className="static-page">
      {/* Map — full-bleed (tràn 2 mép viewport + sát ngay dưới header), class .iframe
          như theme gốc page-contact.php. Bộ chuyển VI/EN đã gỡ vì header đã có sẵn.
          html/body đã `overflow-x: hidden/clip` nên 100vw không sinh thanh cuộn ngang. */}
      {mapUrl && (
        <div
          className="iframe"
          style={{
            position: "relative",
            left: "50%",
            right: "50%",
            width: "100vw",
            marginLeft: "-50vw",
            marginRight: "-50vw",
            marginBottom: 30,
            height: 420,
            overflow: "hidden",
          }}
        >
          <iframe
            src={mapUrl}
            title={
              locale === "vi"
                ? "Bản đồ vị trí Shop Bảo Hộ Bigbike.vn"
                : "BigBike store location map"
            }
            style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {/* Floating address card */}
          {mainAddr && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 20,
                background: "#fff",
                border: "1px solid #dfdfdf",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                maxWidth: 260,
                boxShadow: "0 2px 8px rgba(0,0,0,.15)",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#ff0c09",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#6f6f6f", margin: 0, fontWeight: 600 }}>
                  {locale === "vi" ? "Cửa hàng chính" : "Main store"}
                </p>
                <strong style={{ fontSize: 13, color: "#000", display: "block", lineHeight: 1.4 }}>
                  {mainAddr}
                </strong>
              </div>
            </div>
          )}
          {/* Open in Google Maps */}
          {contact.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={locale === "vi" ? "Mở Google Maps" : "Open in Google Maps"}
              style={{
                position: "absolute",
                bottom: 16,
                right: 20,
                background: "#ff0c09",
                color: "#fff",
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
                boxShadow: "0 2px 6px rgba(0,0,0,.2)",
                transition: "background .2s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
              <span>{locale === "vi" ? "Xem trên Maps" : "Open in Maps"}</span>
            </a>
          )}
        </div>
      )}

      {/* Two-column layout — dùng class .row / .col-md-* của theme giống AboutPageContent */}
      <div className="row">
        {/* Cột trái: thông tin cửa hàng — .information như theme gốc */}
        <div className="col-md-6">
          <div className="information">
            <div className="title" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#000" }}>
                {locale === "vi" ? "Thông tin cửa hàng" : "Store information"}
              </h3>
              <p style={{ marginTop: 6, fontSize: 14, color: "#6f6f6f" }}>
                {locale === "vi"
                  ? "Ghé thăm hoặc liên hệ trực tiếp với chúng tôi."
                  : "Visit or contact us directly."}
              </p>
            </div>

            <div className="desc">
              {/* Hours */}
              {(contact.hoursWeekday || contact.hoursWeekend || contact.hoursHoliday) && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13, color: "#000" }}>
                    {locale === "vi" ? "Giờ làm việc" : "Opening hours"}
                  </p>
                  <div style={{ fontSize: 14, color: "#000", lineHeight: 1.8 }}>
                    {contact.hoursWeekday && (
                      <div>
                        <span style={{ color: "#6f6f6f", display: "inline-block", minWidth: 80 }}>
                          {locale === "vi" ? "T2 – T7:" : "Mon – Sat:"}
                        </span>{" "}
                        <b>{contact.hoursWeekday}</b>
                      </div>
                    )}
                    {contact.hoursWeekend && (
                      <div>
                        <span style={{ color: "#6f6f6f", display: "inline-block", minWidth: 80 }}>
                          {locale === "vi" ? "Chủ nhật:" : "Sunday:"}
                        </span>{" "}
                        <b>{contact.hoursWeekend}</b>
                      </div>
                    )}
                    {contact.hoursHoliday && (
                      <div>
                        <span style={{ color: "#6f6f6f", display: "inline-block", minWidth: 80 }}>
                          {locale === "vi" ? "Lễ / Tết:" : "Holidays:"}
                        </span>{" "}
                        <b>{contact.hoursHoliday}</b>
                      </div>
                    )}
                  </div>
                  {/* Open/Closed badge — chỉ render sau mount (tránh hydration mismatch) */}
                  {mounted && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 8,
                        padding: "3px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        background: isOpenNow ? "#e8f7ed" : "#fff0f0",
                        color: isOpenNow ? "#1a7a3c" : "#ff0c09",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: isOpenNow ? "#1a7a3c" : "#ff0c09",
                          display: "inline-block",
                        }}
                      />
                      {isOpenNow
                        ? locale === "vi"
                          ? "Đang mở cửa"
                          : "Open now"
                        : locale === "vi"
                        ? "Đang đóng cửa"
                        : "Closed now"}
                    </div>
                  )}
                </div>
              )}

              {/* Address */}
              {contact.address && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13, color: "#000" }}>
                    {locale === "vi" ? "Địa chỉ" : "Address"}
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: "#000", fontWeight: 600 }}>
                    {mainAddr}
                  </p>
                  {subAddr && (
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6f6f6f" }}>{subAddr}</p>
                  )}
                </div>
              )}

              {/* Hotline */}
              {contact.hotline && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13, color: "#000" }}>
                    Hotline
                  </p>
                  <p style={{ margin: 0, fontSize: 16, color: "#000", fontWeight: 600 }}>
                    <a href={telHref(contact.hotline)}>{contact.hotline}</a>
                    {contact.hotline2 && (
                      <>
                        <span style={{ margin: "0 6px", color: "#cecece" }}>·</span>
                        <a href={telHref(contact.hotline2)}>{contact.hotline2}</a>
                      </>
                    )}
                    {contact.hotline3 && (
                      <>
                        <span style={{ margin: "0 6px", color: "#cecece" }}>·</span>
                        <a href={telHref(contact.hotline3)}>{contact.hotline3}</a>
                      </>
                    )}
                  </p>
                  {zaloPhone && contact.zaloUrl && (
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6f6f6f" }}>
                      {locale === "vi" ? "Zalo hỗ trợ: " : "Zalo support: "}
                      <a
                        href={contact.zaloUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 600, color: "#000" }}
                      >
                        {zaloPhone} (Mrs. Thư)
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 1,
                  background: "#dfdfdf",
                  borderTop: "2px solid #ff0c09",
                  marginTop: 10,
                }}
              >
                {[
                  {
                    value: "11+",
                    label: locale === "vi" ? "Năm hoạt động" : "Years active",
                  },
                  {
                    value: "36K+",
                    label: locale === "vi" ? "Followers Facebook" : "Facebook followers",
                  },
                  {
                    value: "98%",
                    label: locale === "vi" ? "Khách recommend" : "Customers recommend",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: "#fff",
                      padding: "14px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: "#ff0c09",
                        lineHeight: 1.2,
                        fontFamily: "Barlow Condensed, sans-serif",
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#6f6f6f",
                        marginTop: 3,
                        textTransform: "uppercase",
                        fontWeight: 600,
                        letterSpacing: 0.5,
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: kênh liên hệ trực tuyến — .contact-form như theme gốc */}
        <div className="col-md-6">
          <div className="contact-form">
            <div className="title" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#000" }}>
                {locale === "vi" ? "Liên hệ trực tuyến" : "Contact online"}
              </h3>
              <p style={{ marginTop: 6, fontSize: 14, color: "#6f6f6f" }}>
                {locale === "vi"
                  ? "Tư vấn nhanh qua các kênh dưới đây."
                  : "Get quick support through these channels."}
              </p>
            </div>

            <div className="webform">
              {/* Zalo */}
              {contact.zaloUrl && (
                <a
                  href={contact.zaloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={socialLinkStyle}
                >
                  <div style={{ ...socialIconStyle, background: "#0068FF" }}>Z</div>
                  <div>
                    <div style={socialNameStyle}>Zalo · Mrs. Thư</div>
                    <div style={socialSubStyle}>
                      {locale === "vi" ? "Tư vấn nhanh nhất" : "Fastest response"}
                    </div>
                  </div>
                  <ChevronRight />
                </a>
              )}

              {/* Facebook */}
              {contact.facebookUrl && (
                <a
                  href={contact.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={socialLinkStyle}
                >
                  <div style={{ ...socialIconStyle, background: "#1877F2" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
                      <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 3.21 8.08 7.44 8.81V15.4H7.9v-3.4h1.58v-2.6c0-1.56.93-2.42 2.35-2.42.68 0 1.39.12 1.39.12v1.53h-.78c-.77 0-1.01.48-1.01.97V12h1.72l-.28 3.4h-1.44v5.41c4.23-.73 7.44-4.4 7.44-8.81 0-5.5-4.46-9.96-9.96-9.96z" />
                    </svg>
                  </div>
                  <div>
                    <div style={socialNameStyle}>Facebook</div>
                    <div style={socialSubStyle}>
                      {getSocialHandle(contact.facebookUrl, "facebook")}
                    </div>
                  </div>
                  <ChevronRight />
                </a>
              )}

              {/* TikTok */}
              {contact.tiktokUrl && (
                <a
                  href={contact.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={socialLinkStyle}
                >
                  <div style={{ ...socialIconStyle, background: "#010101" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.98a8.2 8.2 0 004.79 1.54V7.07a4.85 4.85 0 01-1.02-.38z" />
                    </svg>
                  </div>
                  <div>
                    <div style={socialNameStyle}>TikTok</div>
                    <div style={socialSubStyle}>
                      {getSocialHandle(contact.tiktokUrl, "tiktok")}
                    </div>
                  </div>
                  <ChevronRight />
                </a>
              )}

              {/* Shopee */}
              {contact.shopeeUrl && (
                <a
                  href={contact.shopeeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={socialLinkStyle}
                >
                  <div style={{ ...socialIconStyle, background: "#EE4D2D" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
                      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.43 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div style={socialNameStyle}>Shopee</div>
                    <div style={socialSubStyle}>
                      {getSocialHandle(contact.shopeeUrl, "shopee")}
                    </div>
                  </div>
                  <ChevronRight />
                </a>
              )}

              {/* YouTube */}
              {contact.youtubeUrl && (
                <a
                  href={contact.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...socialLinkStyle, marginBottom: 0 }}
                >
                  <div style={{ ...socialIconStyle, background: "#FF0000" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
                      <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
                    </svg>
                  </div>
                  <div>
                    <div style={socialNameStyle}>YouTube</div>
                    <div style={socialSubStyle}>
                      {getSocialHandle(contact.youtubeUrl, "youtube")}
                    </div>
                  </div>
                  <ChevronRight />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared inline style objects (tránh lặp) ─── */

const socialLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  border: "1px solid #dfdfdf",
  background: "#fff",
  marginBottom: 8,
  textDecoration: "none",
  color: "#000",
  transition: "border-color .2s, background .2s",
};

const socialIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
};

const socialNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#000",
};

const socialSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6f6f6f",
  marginTop: 2,
};

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="#cecece"
      style={{ marginLeft: "auto", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}
