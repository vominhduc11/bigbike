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

  return (
    <section className="bb-page">
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
      <div className="bb-container">
        <div className="bb-detail-layout bb-section">
          {/* Main: page content + contact form */}
          <div className="bb-main-gap">
            {page.body && (
              <div className="bb-card bb-card-content">
                <article
                  className="bb-richtext"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
                />
                <p className="bb-updated-date">Cập nhật {formatDate(page.updatedAt)}</p>
              </div>
            )}

            <ContactForm hotline={hotline} email={email} />
          </div>

          {/* Sidebar: contact info + map + navigation */}
          <aside className="bb-sidebar-grid">
            <div className="bb-card bb-card-content">
              <h2 className="bb-sidebar-heading">Thông tin liên hệ</h2>
              <div style={{ display: "grid", gap: "var(--bb-space-3)" }}>
                {hotline && (
                  <div>
                    <p className="bb-contact-label">Hotline</p>
                    <a href={`tel:${hotline}`} className="bb-link">{hotline}</a>
                  </div>
                )}
                {email && (
                  <div>
                    <p className="bb-contact-label">Email</p>
                    <a href={`mailto:${email}`} className="bb-link">{email}</a>
                  </div>
                )}
                {address && (
                  <div>
                    <p className="bb-contact-label">Địa chỉ</p>
                    <p>{address}</p>
                  </div>
                )}
                {zalo && (
                  <div>
                    <p className="bb-contact-label">Zalo / Chat</p>
                    {/^https?:\/\//.test(zalo) ? (
                      <a href={zalo} className="bb-link" target="_blank" rel="noreferrer noopener">Nhắn Zalo</a>
                    ) : (
                      <p>{zalo}</p>
                    )}
                  </div>
                )}
                {!hotline && !email && !address && !zalo && (
                  <p className="wp-muted-text">Đang cập nhật thông tin liên hệ.</p>
                )}
              </div>
            </div>

            {canEmbedMap ? (
              <div className="bb-card bb-card-content">
                <h2 className="bb-sidebar-heading">Bản đồ</h2>
                <div className="bb-map-frame">
                  <iframe
                    title="Bản đồ liên hệ BigBike"
                    src={mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            ) : null}

            <div className="bb-card bb-card-content">
              <h2 className="bb-sidebar-heading">Di chuyển nhanh</h2>
              <div className="bb-nav-links">
                <Link href={toHomePath()} className="bb-link">Về trang chủ</Link>
                <Link href={toProductListPath()} className="bb-link">Xem sản phẩm</Link>
                <Link href={toArticleListPath()} className="bb-link">Xem tin tức</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
