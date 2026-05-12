import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toArticleListPath, toHomePath, toPagePath, toProductListPath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Liên hệ",
  description: "Thông tin liên hệ BigBike — hotline, email, địa chỉ cửa hàng và bản đồ.",
  canonicalPath: toPagePath("lien-he"),
});

function pickSetting(settings: Array<{ settingKey: string; settingValue: string }>, patterns: RegExp[]): string {
  const match = settings.find((setting) => patterns.some((pattern) => pattern.test(setting.settingKey)));
  return match?.settingValue?.trim() ?? "";
}

export default async function ContactPage() {
  const [pageResult, settingsResult] = await Promise.all([getPageBySlug("lien-he"), listPublicSettings()]);

  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? "Không tải được nội dung trang liên hệ."} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const publicSettings = settingsResult.data ?? [];

  const hotline = pickSetting(publicSettings, [/hotline/i, /phone/i, /tel/i]);
  const email = pickSetting(publicSettings, [/email/i, /mail/i]);
  const address = pickSetting(publicSettings, [/address/i, /diachi/i, /dia_chi/i]);
  const zalo = pickSetting(publicSettings, [/zalo/i]);
  const mapUrl = publicSettings.find((s) => s.settingKey === "google_maps_url")?.settingValue?.trim() ?? "";
  const canEmbedMap = /^https?:\/\/(www\.)?google\.com\/maps[/?#]/.test(mapUrl);

  const pageTitle = safeText(page.title, "Liên hệ");

  const fallbackMap =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.5!2d106.6378!3d10.7625!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x317529b0e0a3a0e7%3A0x0!2zNzkvMzAvNTIgw4J1IEPGoSwgUDQsIFE.MTEgVHAuSENN!5e0!3m2!1svi!2s!4v1";
  const mapEmbedSrc = canEmbedMap ? mapUrl : fallbackMap;

  return (
    <section className="bb-page wp-contact-page">
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        kicker={page.heroKicker ?? "LIÊN HỆ"}
        title={page.heroTitle ?? pageTitle}
        description={page.heroDescription}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: pageTitle },
        ]}
      />

      <div className="wp-contact-map-full" aria-hidden="false">
        <iframe
          title="Bản đồ cửa hàng BigBike"
          src={mapEmbedSrc}
          width="100%"
          height="375"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <div className="bb-container">
        <div className="wp-contact-grid">
          <div className="wp-contact-info">
            {page.body && (
              <article
                className="wp-contact-intro bb-richtext"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
              />
            )}
            <ul className="wp-contact-list">
              <li className="wp-contact-row">
                <span className="wp-contact-icon" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </span>
                <div className="wp-contact-text">
                  <p>Hotline liên hệ</p>
                  {hotline ? <p><b>{hotline}</b></p> : <p><b>028.62797251</b></p>}
                  {zalo && !/^https?:\/\//.test(zalo) && <p><b>{zalo}</b></p>}
                </div>
              </li>
              <li className="wp-contact-row">
                <span className="wp-contact-icon" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <div className="wp-contact-text">
                  <p>Cửa hàng BigBike</p>
                  {address ? <p><b>{address}</b></p> : <p><b>79/30/52 Âu Cơ, P.14, Q.11, TP.HCM</b></p>}
                </div>
              </li>
              <li className="wp-contact-row">
                <span className="wp-contact-icon" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </span>
                <div className="wp-contact-text">
                  <p>Giờ làm việc</p>
                  <p><b>T2 - T6: 09h00 - 21h00</b></p>
                  <p><b>T7 / CN: 09h00 - 18h00</b></p>
                  <p><b>Lễ / Tết: nghỉ</b></p>
                </div>
              </li>
            </ul>
            {email && (
              <p className="wp-contact-email">
                Email: <a href={`mailto:${email}`} className="bb-link">{email}</a>
              </p>
            )}
          </div>

          <div className="wp-contact-form-col">
            <div className="wp-contact-form-head">
              <h3>Liên hệ trực tuyến</h3>
              <p>Để lại lời nhắn — BigBike sẽ phản hồi trong giờ làm việc.</p>
            </div>
            <ContactForm hotline={hotline} email={email} />
          </div>
        </div>

        <nav className="wp-contact-quick-nav">
          <Link href={toHomePath()} className="bb-link">Về trang chủ</Link>
          <span aria-hidden="true">·</span>
          <Link href={toProductListPath()} className="bb-link">Xem sản phẩm</Link>
          <span aria-hidden="true">·</span>
          <Link href={toArticleListPath()} className="bb-link">Xem tin tức</Link>
        </nav>

        <p className="wp-about-updated">Cập nhật {formatDate(page.updatedAt)}</p>
      </div>
    </section>
  );
}
