import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
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
  const mapUrl = pickSetting(publicSettings, [/map/i, /iframe/i, /google_maps?/i]);
  const canEmbedMap = /^https?:\/\//i.test(mapUrl);

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <h1>{safeText(page.title, "Liên hệ")}</h1>
        </header>

        <div className="bb-detail-layout bb-section">
          {/* Main: page content + contact form */}
          <div style={{ display: "grid", gap: "var(--bb-space-5)" }}>
            {page.body && (
              <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
                <article
                  className="bb-richtext"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
                />
                <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-xs)", marginTop: "var(--bb-space-4)" }}>
                  Cập nhật {formatDate(page.updatedAt)}
                </p>
              </div>
            )}

            <ContactForm hotline={hotline} email={email} />
          </div>

          {/* Sidebar: contact info + map + navigation */}
          <aside style={{ display: "grid", gap: "var(--bb-space-4)", alignContent: "start" }}>
            <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
              <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>Thông tin liên hệ</h2>
              <div style={{ display: "grid", gap: "var(--bb-space-3)" }}>
                {hotline && (
                  <div>
                    <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-sm)" }}>Hotline</p>
                    <a href={`tel:${hotline}`} className="bb-link">{hotline}</a>
                  </div>
                )}
                {email && (
                  <div>
                    <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-sm)" }}>Email</p>
                    <a href={`mailto:${email}`} className="bb-link">{email}</a>
                  </div>
                )}
                {address && (
                  <div>
                    <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-sm)" }}>Địa chỉ</p>
                    <p>{address}</p>
                  </div>
                )}
                {zalo && (
                  <div>
                    <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-sm)" }}>Zalo / Chat</p>
                    {/^https?:\/\//.test(zalo) ? (
                      <a href={zalo} className="bb-link" target="_blank" rel="noreferrer noopener">Nhắn Zalo</a>
                    ) : (
                      <p>{zalo}</p>
                    )}
                  </div>
                )}
                {!hotline && !email && !address && !zalo && (
                  <p style={{ color: "var(--bb-text-muted)" }}>Đang cập nhật thông tin liên hệ.</p>
                )}
              </div>
            </div>

            {canEmbedMap ? (
              <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
                <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>Bản đồ</h2>
                <div style={{ aspectRatio: "16 / 9", overflow: "hidden", borderRadius: "var(--bb-radius-lg)" }}>
                  <iframe
                    title="Bản đồ liên hệ BigBike"
                    src={mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            ) : null}

            <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
              <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>Di chuyển nhanh</h2>
              <div style={{ display: "grid", gap: "var(--bb-space-2)" }}>
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
