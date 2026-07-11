import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
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
    hotline3: setting("hotline_3"),
    address: setting("contact_address"),
    hoursWeekday: setting("opening_hours_weekday"),
    hoursWeekend: setting("opening_hours_weekend"),
    hoursHoliday: setting("opening_hours_holiday"),
    zaloUrl: setting("zalo_url"),
    facebookUrl: setting("facebook_url"),
    youtubeUrl: setting("youtube_url"),
    tiktokUrl: setting("tiktok_url"),
    shopeeUrl: setting("shopee_url"),
    instagramUrl: setting("instagram_url"),
    email: setting("contact_email"),
  };

  const title = t("titleFallback");

  return (
    <StaticPageShell title={title} breadcrumb={[]} showHero={false} mainClassName="pb-10">
      <Container>
        <ContactPageContent contact={contact} />
      </Container>
    </StaticPageShell>
  );
}
