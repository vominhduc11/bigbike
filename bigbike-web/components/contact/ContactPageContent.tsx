"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSetLocale } from "@/components/providers/ClientIntlProvider";
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
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7));
}

function getAddressParts(address: string) {
  if (!address) return { main: "", sub: "" };
  const parts = address.split(",");
  const main = parts[0]?.trim() || "";
  const sub = parts.slice(1).join(",").trim();
  return { main, sub };
}

function getSocialHandle(url: string, type: "facebook" | "youtube" | "tiktok" | "shopee"): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (type === "facebook") {
      return path ? `facebook.com/${path}` : u.host;
    }
    if (type === "youtube") {
      return path ? `@${path.replace(/^@/, "")}` : u.host;
    }
    if (type === "tiktok") {
      return path ? `@${path.replace(/^@/, "")}` : u.host;
    }
    if (type === "shopee") {
      return path ? path : u.host;
    }
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
    if (phone.startsWith("84")) {
      phone = "0" + phone.slice(2);
    }
    if (phone.length === 10) {
      return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    }
    return phone;
  }
  return "";
}

export function ContactPageContent({ contact }: { contact: ContactInfo }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    const checkOpenStatus = () => {
      const vnTime = getVietnamTime();
      const day = vnTime.getDay(); // 0: Sunday, 1: Mon, ..., 6: Sat
      const hour = vnTime.getHours();
      const min = vnTime.getMinutes();
      const timeValue = hour * 100 + min;

      if (day === 0) {
        // Sunday: 09:00 - 18:00
        setIsOpenNow(timeValue >= 900 && timeValue < 1800);
      } else {
        // Monday - Saturday: 09:00 - 21:00
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
    <div className="w-full bg-white select-none text-foreground font-sans max-w-5xl mx-auto border border-border pb-10">
      {/* Language Toggle */}
      <div className="flex justify-end p-5 pb-0 gap-1.5" role="group" aria-label="Language selector">
        <button
          className={`bg-none border border-border px-3.5 py-1 text-ui-13 cursor-pointer transition-colors rounded-none font-bold ${
            locale === "vi" ? "bg-brand border-brand text-white" : "text-muted-foreground hover:bg-brand hover:border-brand hover:text-white"
          }`}
          onClick={() => setLocale("vi")}
          aria-pressed={locale === "vi"}
        >
          VI
        </button>
        <button
          className={`bg-none border border-border px-3.5 py-1 text-ui-13 cursor-pointer transition-colors rounded-none font-bold ${
            locale === "en" ? "bg-brand border-brand text-white" : "text-muted-foreground hover:bg-brand hover:border-brand hover:text-white"
          }`}
          onClick={() => setLocale("en")}
          aria-pressed={locale === "en"}
        >
          EN
        </button>
      </div>

      {/* Map Block */}
      {mapUrl && (
        <div className="relative w-full h-[280px] overflow-hidden bg-[#e8e4de] mt-3">
          <iframe
            src={mapUrl}
            title={locale === "vi" ? "Bản đồ vị trí Shop Bảo Hộ Bigbike.vn" : "BigBike store location map"}
            className="w-full h-full border-0 block"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />

          {/* Floating Address Card */}
          {mainAddr && (
            <div className="absolute bottom-4 left-4 bg-white border border-border p-2.5 flex items-center gap-2.5 max-w-[270px] shadow-dropdown rounded-none">
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] text-muted-foreground mb-0.5 font-bold">
                  {locale === "vi" ? "Cửa hàng chính" : "Main store"}
                </p>
                <strong className="text-ui-13 text-foreground leading-snug block font-bold">
                  {mainAddr}
                </strong>
              </div>
            </div>
          )}

          {/* Open in Google Maps Button */}
          {contact.address && (
            <a
              className="absolute bottom-4 right-4 bg-brand hover:bg-[#c50000] text-white border-0 py-2 px-3.5 text-ui-12 cursor-pointer flex items-center gap-1.5 font-bold rounded-none no-underline transition-colors shadow-dropdown"
              href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={locale === "vi" ? "Mở Google Maps" : "Open in Google Maps"}
            >
              <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
              <span>{locale === "vi" ? "Xem trên Maps" : "Open in Maps"}</span>
            </a>
          )}
        </div>
      )}

      {/* Main 2-column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border-y border-border">
        {/* Left Column: Store info */}
        <div className="bg-white p-5 text-left">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b-2 border-brand">
            <svg className="w-[18px] h-[18px] fill-brand shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span className="text-ui-12 font-bold text-foreground uppercase tracking-wide">
              {locale === "vi" ? "Thông tin cửa hàng" : "Store info"}
            </span>
          </div>

          {/* Hours */}
          {(contact.hoursWeekday || contact.hoursWeekend || contact.hoursHoliday) && (
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-none bg-muted border border-border flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 fill-brand" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-bold">
                  {locale === "vi" ? "Giờ làm việc" : "Opening hours"}
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mb-2">
                  {contact.hoursWeekday && (
                    <>
                      <span className="text-ui-12 text-muted-foreground">
                        {locale === "vi" ? "T2 – T7" : "Mon – Sat"}
                      </span>
                      <span className="text-ui-12 text-foreground font-bold">
                        {contact.hoursWeekday}
                      </span>
                    </>
                  )}
                  {contact.hoursWeekend && (
                    <>
                      <span className="text-ui-12 text-muted-foreground">
                        {locale === "vi" ? "Chủ nhật" : "Sunday"}
                      </span>
                      <span className="text-ui-12 text-foreground font-bold">
                        {contact.hoursWeekend}
                      </span>
                    </>
                  )}
                  {contact.hoursHoliday && (
                    <>
                      <span className="text-ui-12 text-muted-foreground">
                        {locale === "vi" ? "Lễ / Tết" : "Holidays"}
                      </span>
                      <span className="text-ui-12 text-foreground font-bold">
                        {contact.hoursHoliday}
                      </span>
                    </>
                  )}
                </div>
                {mounted && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold rounded-none ${
                      isOpenNow ? "bg-[#e8f7ed] text-[#1a7a3c]" : "bg-red-50 text-brand"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isOpenNow ? "bg-[#1a7a3c]" : "bg-brand"}`} />
                    <span>{isOpenNow ? (locale === "vi" ? "Đang mở cửa" : "Open now") : (locale === "vi" ? "Đang đóng cửa" : "Closed now")}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Address */}
          {contact.address && (
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-none bg-muted border border-border flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 fill-brand" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-bold">
                  {locale === "vi" ? "Địa chỉ" : "Address"}
                </div>
                <div className="text-ui-14 text-foreground font-bold leading-normal">
                  {mainAddr}
                </div>
                {subAddr && (
                  <div className="text-ui-12 text-muted-foreground mt-0.5">
                    {subAddr}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phone */}
          {contact.hotline && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-none bg-muted border border-border flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 fill-brand" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-bold">
                  Hotline
                </div>
                <div className="text-ui-14 text-foreground font-bold leading-normal">
                  <a href={telHref(contact.hotline)} className="hover:text-brand hover:underline">{contact.hotline}</a>
                  {contact.hotline2 && (
                    <>
                      <span> · </span>
                      <a href={telHref(contact.hotline2)} className="hover:text-brand hover:underline">{contact.hotline2}</a>
                    </>
                  )}
                  {contact.hotline3 && (
                    <>
                      <span> · </span>
                      <a href={telHref(contact.hotline3)} className="hover:text-brand hover:underline">{contact.hotline3}</a>
                    </>
                  )}
                </div>
                {zaloPhone && contact.zaloUrl && (
                  <div className="text-ui-12 text-muted-foreground mt-0.5">
                    {locale === "vi" ? "Zalo hỗ trợ: " : "Zalo support: "}
                    <a href={contact.zaloUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline font-bold text-foreground">
                      {zaloPhone} (Mrs. Thư)
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Online contact */}
        <div className="bg-white p-5 text-left">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b-2 border-brand">
            <svg className="w-[18px] h-[18px] fill-brand shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
            </svg>
            <span className="text-ui-12 font-bold text-foreground uppercase tracking-wide">
              {locale === "vi" ? "Liên hệ trực tuyến" : "Contact online"}
            </span>
          </div>

          {/* Zalo Link */}
          {contact.zaloUrl && (
            <a
              className="flex items-center gap-3.5 p-3 border border-border bg-white hover:border-brand hover:bg-muted transition-colors rounded-none mb-2 no-underline text-foreground"
              href={contact.zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 text-white font-bold bg-[#0068FF] text-ui-14 rounded-none">
                Z
              </div>
              <div>
                <div className="text-ui-13 font-bold text-foreground">
                  Zalo · Mrs. Thư
                </div>
                <div className="text-ui-12 text-muted-foreground mt-0.5">
                  {locale === "vi" ? "Tư vấn nhanh nhất" : "Fastest response"}
                </div>
              </div>
              <div className="ml-auto text-muted-foreground">
                <svg className="w-3.5 h-3.5 fill-muted-foreground" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </div>
            </a>
          )}

          {/* Facebook Link */}
          {contact.facebookUrl && (
            <a
              className="flex items-center gap-3.5 p-3 border border-border bg-white hover:border-brand hover:bg-muted transition-colors rounded-none mb-2 no-underline text-foreground"
              href={contact.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 text-white font-bold bg-[#1877F2] text-ui-14 rounded-none">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 3.21 8.08 7.44 8.81V15.4H7.9v-3.4h1.58v-2.6c0-1.56.93-2.42 2.35-2.42.68 0 1.39.12 1.39.12v1.53h-.78c-.77 0-1.01.48-1.01.97V12h1.72l-.28 3.4h-1.44v5.41c4.23-.73 7.44-4.4 7.44-8.81 0-5.5-4.46-9.96-9.96-9.96z" />
                </svg>
              </div>
              <div>
                <div className="text-ui-13 font-bold text-foreground">
                  Facebook
                </div>
                <div className="text-ui-12 text-muted-foreground mt-0.5">
                  {getSocialHandle(contact.facebookUrl, "facebook")}
                </div>
              </div>
              <div className="ml-auto text-muted-foreground">
                <svg className="w-3.5 h-3.5 fill-muted-foreground" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </div>
            </a>
          )}

          {/* TikTok Link */}
          {contact.tiktokUrl && (
            <a
              className="flex items-center gap-3.5 p-3 border border-border bg-white hover:border-brand hover:bg-muted transition-colors rounded-none mb-2 no-underline text-foreground"
              href={contact.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 text-white font-bold bg-[#010101] text-ui-14 rounded-none">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.98a8.2 8.2 0 004.79 1.54V7.07a4.85 4.85 0 01-1.02-.38z" />
                </svg>
              </div>
              <div>
                <div className="text-ui-13 font-bold text-foreground">
                  TikTok
                </div>
                <div className="text-ui-12 text-muted-foreground mt-0.5">
                  {getSocialHandle(contact.tiktokUrl, "tiktok")}
                </div>
              </div>
              <div className="ml-auto text-muted-foreground">
                <svg className="w-3.5 h-3.5 fill-muted-foreground" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </div>
            </a>
          )}

          {/* Shopee Link */}
          {contact.shopeeUrl && (
            <a
              className="flex items-center gap-3.5 p-3 border border-border bg-white hover:border-brand hover:bg-muted transition-colors rounded-none mb-2 no-underline text-foreground"
              href={contact.shopeeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 text-white font-bold bg-[#EE4D2D] text-ui-14 rounded-none">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.43 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-ui-13 font-bold text-foreground">
                  Shopee
                </div>
                <div className="text-ui-12 text-muted-foreground mt-0.5">
                  {getSocialHandle(contact.shopeeUrl, "shopee")}
                </div>
              </div>
              <div className="ml-auto text-muted-foreground">
                <svg className="w-3.5 h-3.5 fill-muted-foreground" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </div>
            </a>
          )}

          {/* YouTube Link */}
          {contact.youtubeUrl && (
            <a
              className="flex items-center gap-3.5 p-3 border border-border bg-white hover:border-brand hover:bg-muted transition-colors rounded-none mb-0 no-underline text-foreground"
              href={contact.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 text-white font-bold bg-[#FF0000] text-ui-14 rounded-none">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
                </svg>
              </div>
              <div>
                <div className="text-ui-13 font-bold text-foreground">
                  YouTube
                </div>
                <div className="text-ui-12 text-muted-foreground mt-0.5">
                  {getSocialHandle(contact.youtubeUrl, "youtube")}
                </div>
              </div>
              <div className="ml-auto text-muted-foreground">
                <svg className="w-3.5 h-3.5 fill-muted-foreground" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </div>
            </a>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-px bg-border border-b border-border">
        <div className="bg-white p-4 text-center">
          <span className="block text-2xl md:text-3xl font-bold text-brand leading-normal font-sans">
            11+
          </span>
          <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide font-bold">
            {locale === "vi" ? "Năm hoạt động" : "Years active"}
          </div>
        </div>
        <div className="bg-white p-4 text-center">
          <span className="block text-2xl md:text-3xl font-bold text-brand leading-normal font-sans">
            36K+
          </span>
          <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide font-bold">
            {locale === "vi" ? "Followers Facebook" : "Facebook followers"}
          </div>
        </div>
        <div className="bg-white p-4 text-center">
          <span className="block text-2xl md:text-3xl font-bold text-brand leading-normal font-sans">
            98%
          </span>
          <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide font-bold">
            {locale === "vi" ? "Khách recommend" : "Customers recommend"}
          </div>
        </div>
      </div>
    </div>
  );
}
