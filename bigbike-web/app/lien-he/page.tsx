import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { ContactPageContent, type ContactInfo } from "@/components/contact/ContactPageContent";
import { listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

// Trang Liên hệ (/lien-he) — TRANG TĨNH HOÀN TOÀN. Không có hero; toàn bộ bố cục, tiêu đề và SEO cố
// định trong code (i18n `Contact` / `StaticPage`). Admin KHÔNG quản lý trang này — không CMS, không
// trình dựng khối. Số điện thoại / địa chỉ / giờ làm việc / mạng xã hội là dữ liệu CHUNG ở
// site_settings nhóm `contact` (cùng nguồn với header & footer) — tự hiển thị, không phải nội dung
// admin cấu hình riêng cho trang này. Bản đồ dựng từ địa chỉ cửa hàng.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StaticPage");
  return buildPublicMetadata({
    title: t("contactTitle"),
    description: t("contactDescription"),
    canonicalPath: toPagePath("lien-he"),
    noIndex: false,
  });
}

export default async function ContactPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Contact")]);
  const settingsResult = await listPublicSettings(locale);
  const settings = settingsResult.data ?? [];
  const setting = (key: string) => pickSetting(settings, [key]);

  const contact: ContactInfo = {
    hotline: setting("hotline"),
    hotline2: setting("hotline_2"),
    address: setting("contact_address"),
    hoursWeekday: setting("opening_hours_weekday"),
    hoursWeekend: setting("opening_hours_weekend"),
    hoursHoliday: setting("opening_hours_holiday"),
    zaloUrl: setting("zalo_url"),
    facebookUrl: setting("facebook_url"),
  };

  const title = t("titleFallback");
  // Bản đồ Google nhúng từ địa chỉ cửa hàng (dữ liệu chung); ẩn nếu chưa có địa chỉ.
  const mapEmbedSrc = contact.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&z=17&output=embed`
    : "";

  // page-contact.php layout — nay cố định trong code (không còn admin-managed blocks).
  return (
    <WpStaticShell title={title} breadcrumb={[]} showHero={false} mainClassName="pb-40 contact-page">
      {mapEmbedSrc ? (
        <div className="iframe">
          <iframe
            title={title}
            src={mapEmbedSrc}
            width="100%"
            height="375"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <ContactPageContent contact={contact} />
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
