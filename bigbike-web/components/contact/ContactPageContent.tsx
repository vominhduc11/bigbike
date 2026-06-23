"use client";

import { useTranslations } from "next-intl";
import { telHref } from "@/lib/utils/format";

/* eslint-disable @next/next/no-img-element */

/**
 * Nội dung trang Liên hệ (/lien-he) — TRANG TĨNH.
 *
 * Toàn bộ bố cục, nhãn và tiêu đề lấy từ i18n namespace `Contact` (cố định trong code, song ngữ
 * VI/EN). Admin KHÔNG quản lý trang này (không CMS, không trình dựng). Riêng số điện thoại / địa chỉ
 * / giờ làm việc / mạng xã hội là dữ liệu CHUNG của site (nhóm `contact` trong site_settings, cùng
 * nguồn với header/footer) nên được truyền vào qua props, không hardcode trong code (AGENTS.md §6.5).
 */

const THEME = "/wp-content/themes/bigbike";

export type ContactInfo = {
  hotline: string;
  hotline2: string;
  address: string;
  hoursWeekday: string;
  hoursWeekend: string;
  hoursHoliday: string;
  zaloUrl: string;
  facebookUrl: string;
};

function stripUrl(value: string): string {
  return value.replace(/^https?:\/\/(www\.)?/, "");
}

export function ContactPageContent({ contact }: { contact: ContactInfo }) {
  const t = useTranslations("Contact");
  const hours = [contact.hoursWeekday, contact.hoursWeekend, contact.hoursHoliday].filter(Boolean);

  return (
    <div className="static-page wyswyg">
      <div className="row">
        {/* Cột thông tin: hotline, địa chỉ, giờ làm việc */}
        <div className="col-md-6">
          <div className="information">
            <div className="title">
              <h1 style={{ fontSize: "24px" }}>{t("titleFallback")}</h1>
            </div>
            <div className="desc">
              <ul>
                {contact.hotline ? (
                  <li className="row">
                    <div className="icon col">
                      <img src={`${THEME}/images/contact-call-icon.png`} alt={t("altContact")} />
                    </div>
                    <div className="text col">
                      <p>{t("contactUs")}</p>
                      <p><b><a href={telHref(contact.hotline)}>{contact.hotline}</a></b></p>
                    </div>
                  </li>
                ) : null}
                {contact.hotline2 ? (
                  <li className="row">
                    <div className="icon col">
                      <img src={`${THEME}/images/contact-call-icon.png`} alt={t("altContact")} />
                    </div>
                    <div className="text col">
                      <p>{t("hotline")}</p>
                      <p><b><a href={telHref(contact.hotline2)}>{contact.hotline2}</a></b></p>
                    </div>
                  </li>
                ) : null}
                {contact.address ? (
                  <li className="row">
                    <div className="icon col">
                      <img src={`${THEME}/images/contact-marker-icon.png`} alt={t("altAddress")} />
                    </div>
                    <div className="text col">
                      <p>{t("store")}</p>
                      <p><b>{contact.address}</b></p>
                    </div>
                  </li>
                ) : null}
                {hours.length > 0 ? (
                  <li className="row">
                    <div className="icon col">
                      <img src={`${THEME}/images/contact-calendar-icon.png`} alt={t("altHours")} />
                    </div>
                    <div className="text col">
                      <p>{t("hoursLabel")}</p>
                      {hours.map((line, i) => <p key={i}><b>{line}</b></p>)}
                    </div>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>

        {/* Cột liên hệ trực tuyến: Zalo, Facebook, Hotline */}
        <div className="col-md-6">
          <div className="contact-form">
            <div className="title">
              <h3>{t("onlineHeading")}</h3>
              <p>{t("onlineDesc")}</p>
            </div>
            <div className="webform">
              <ul>
                {contact.zaloUrl ? (
                  <li className="row">
                    <div className="text col">
                      <p>{t("zalo")}</p>
                      <p><b><a href={contact.zaloUrl} target="_blank" rel="noopener noreferrer">{stripUrl(contact.zaloUrl)}</a></b></p>
                    </div>
                  </li>
                ) : null}
                {contact.facebookUrl ? (
                  <li className="row">
                    <div className="text col">
                      <p>{t("facebook")}</p>
                      <p><b><a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer">{stripUrl(contact.facebookUrl)}</a></b></p>
                    </div>
                  </li>
                ) : null}
                {contact.hotline ? (
                  <li className="row">
                    <div className="text col">
                      <p>{t("hotline")}</p>
                      <p><b><a href={telHref(contact.hotline)}>{contact.hotline}</a></b></p>
                    </div>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
