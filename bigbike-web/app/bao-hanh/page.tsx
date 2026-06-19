import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { listPublicSettings } from "@/lib/api/public-api";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";
import { WarrantyContent, type WarrantyCopy } from "./WarrantyContent";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("Warranty"),
  ]);
  const settingsResult = await listPublicSettings(locale);
  const settings = settingsResult.data ?? [];
  const setting = (key: string) => pickSetting(settings, [key]);

  return buildPublicMetadata({
    title: setting("warranty_page_meta_title") || t("metaTitle"),
    description: setting("warranty_page_meta_description") || t("metaDescription"),
    canonicalPath: "/bao-hanh/",
    noIndex: false,
  });
}

export default async function WarrantyLookupPage() {
  const locale = await getLocale();
  const [t, tBreadcrumb, settingsResult] = await Promise.all([
    getTranslations("Warranty"),
    getTranslations("Breadcrumb"),
    listPublicSettings(locale),
  ]);

  const settings = settingsResult.data ?? [];
  // Copy trang Bảo hành: ưu tiên giá trị admin nhập (site_settings nhóm public_warranty),
  // fallback copy i18n (namespace Warranty) khi key trống — trang không bao giờ trắng.
  const setting = (key: string) => pickSetting(settings, [key]);

  const heading = setting("warranty_page_heading") || t("heading");

  // Hai khối nội dung mới do admin tự soạn (rich-text); rỗng → ẩn hẳn.
  const introHtml = sanitizeRichHtml(setting("warranty_page_intro_html") || "");
  const policyHtml = sanitizeRichHtml(setting("warranty_page_policy_html") || "");
  // Giá trị thô (MediaImage tự resolve /media URL); rỗng → ẩn.
  const introImage = setting("warranty_page_intro_image");

  const copy: WarrantyCopy = {
    kicker: setting("warranty_page_kicker") || t("kicker"),
    subheading: setting("warranty_page_subheading") || t("subheading"),
    serialLabel: setting("warranty_page_serial_label") || t("serialLabel"),
    serialPlaceholder: setting("warranty_page_serial_placeholder") || t("serialPlaceholder"),
    serialHint: setting("warranty_page_serial_hint") || t("serialHint"),
    submitButton: setting("warranty_page_submit_button") || t("submitButton"),
    submitting: setting("warranty_page_submitting") || t("submitting"),
    notFound: setting("warranty_page_not_found") || t("notFound"),
    resultHeading: setting("warranty_page_result_heading") || t("resultHeading"),
    fieldProduct: setting("warranty_page_field_product") || t("fieldProduct"),
    fieldSerial: setting("warranty_page_field_serial") || t("fieldSerial"),
    fieldStart: setting("warranty_page_field_start") || t("fieldStart"),
    fieldEnd: setting("warranty_page_field_end") || t("fieldEnd"),
    statusActiveTpl: setting("warranty_page_status_active") || t("statusActive", { daysLeft: "{daysLeft}" }),
    statusAlmostExpiredTpl:
      setting("warranty_page_status_almost_expired") || t("statusAlmostExpired", { daysLeft: "{daysLeft}" }),
    statusExpired: setting("warranty_page_status_expired") || t("statusExpired"),
    statusVoided: setting("warranty_page_status_voided") || t("statusVoided"),
    footerActive: setting("warranty_page_footer_active") || t("footerActive"),
    footerVoided: setting("warranty_page_footer_voided") || t("footerVoided"),
    introHtml,
    introImage,
    policyHtml,
  };

  // Khung WP page.php: banner + breadcrumb; bên trong là công cụ tra cứu bảo hành
  // (tự mang Container riêng nên đặt thẳng trong #main-content).
  return (
    <WpStaticShell
      title={heading}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: heading },
      ]}
    >
      <WarrantyContent copy={copy} />
    </WpStaticShell>
  );
}
