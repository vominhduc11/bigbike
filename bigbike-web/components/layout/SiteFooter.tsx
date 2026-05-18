import Link from "next/link";
import Image from "next/image";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import { safeText } from "@/lib/utils/format";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { BctBadge } from "./BctBadge";
import { FooterCollapsible } from "./FooterCollapsible";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";

const DEFAULT_SITE_NAME = "BigBike";
const DEFAULT_FOOTER_HEADING = "BigBike mong được lắng nghe và thấu hiểu bạn hơn";
const DEFAULT_FOOTER_DESCRIPTION =
  "Đăng ký bản tin để nhận những ưu đãi đặc biệt, tin tức mới nhất về sản phẩm và các sự kiện hấp dẫn từ BigBike. Đừng bỏ lỡ cơ hội nâng tầm trải nghiệm của bạn với những thông tin hữu ích và chương trình khuyến mãi độc quyền.";

type FallbackLink = { id: string; parentId: null; label: string; url: string; children: never[] };

const FALLBACK_INFO_LINKS: FallbackLink[] = [
  { id: "fbi-1", parentId: null, label: "Chính sách bảo hành", url: "/chinh-sach/bao-hanh/", children: [] },
  { id: "fbi-2", parentId: null, label: "Chính sách đổi trả hàng", url: "/chinh-sach/doi-tra/", children: [] },
  { id: "fbi-3", parentId: null, label: "Chính sách bảo mật thông tin", url: "/chinh-sach/bao-mat/", children: [] },
  { id: "fbi-4", parentId: null, label: "Hướng dẫn mua hàng", url: "/huong-dan-mua-hang/", children: [] },
];

function getSettingValue(
  settings: { settingKey: string; settingValue: string }[],
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const found = settings.find((s) => s.settingKey === key && s.settingValue.trim().length > 0);
    if (found) return normalizeSettingValue(found.settingValue);
  }
  return fallback;
}

function normalizeSettingValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function groupMenuItems(items: Array<{ id: string; parentId: string | null; label: string; url: string }>) {
  const usableItems = items.filter((item) => item.label.trim().length > 0 && item.url.trim().length > 0);
  const roots = usableItems.filter((item) => item.parentId === null);
  const children = usableItems.filter((item) => item.parentId !== null);
  return roots.map((root) => ({
    ...root,
    children: children.filter((child) => child.parentId === root.id),
  }));
}

const iconClass = "shrink-0 mt-[0.15em]";

function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={iconClass}>
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h1a1 1 0 0 1 .98.8l.4 2a1 1 0 0 1-.27.93L4.8 5.55C5.7 7.2 6.8 8.3 8.45 9.2l.82-.83a1 1 0 0 1 .93-.27l2 .4A1 1 0 0 1 13 9.5v1A1.5 1.5 0 0 1 11.5 12C5.7 12 2 8.3 2 2.5Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={iconClass}>
      <rect x="1" y="3" width="12" height="8" rx="1.5" />
      <path d="M1 4l6 4 6-4" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={iconClass}>
      <path d="M11.5 5.8c0 3.2-4.5 6.9-4.5 6.9S2.5 9 2.5 5.8a4.5 4.5 0 0 1 9 0Z" />
      <circle cx="7" cy="5.8" r="1.6" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={iconClass}>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1.75 3.5h-1c-.41 0-.5.19-.5.63V6h1.5l-.2 1.5H8.25V12h-1.5V7.5H6V6h.75V4.88C6.75 3.62 7.5 3 8.75 3c.58 0 1 .04 1 .04V4.5Z" />
    </svg>
  );
}

function IconZalo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={iconClass}>
      <rect width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" />
      <text x="8" y="11.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="currentColor">Z</text>
      <ellipse cx="8" cy="8" rx="5.5" ry="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={iconClass}>
      <path d="M15.3 4.5a2 2 0 0 0-1.4-1.4C12.7 2.8 8 2.8 8 2.8s-4.7 0-5.9.3A2 2 0 0 0 .7 4.5C.4 5.7.4 8 .4 8s0 2.3.3 3.5a2 2 0 0 0 1.4 1.4c1.2.3 5.9.3 5.9.3s4.7 0 5.9-.3a2 2 0 0 0 1.4-1.4c.3-1.2.3-3.5.3-3.5s0-2.3-.3-3.5ZM6.5 10.3V5.7L10.5 8l-4 2.3Z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={iconClass}>
      <path d="M11 1h-2v9.5a1.5 1.5 0 1 1-1.5-1.5c.17 0 .34.02.5.07V7.03A3.5 3.5 0 1 0 11 10.5V5.6a5.52 5.52 0 0 0 3 .9V4.52A3.52 3.52 0 0 1 11 1Z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={iconClass}>
      <path d="M8 1c1.86 0 2.09.01 2.82.04.73.03 1.23.15 1.66.31.45.17.83.4 1.21.78.38.38.61.76.78 1.21.17.43.28.93.31 1.66.04.73.04.96.04 2.82s-.01 2.09-.04 2.82c-.03.73-.14 1.23-.31 1.66a3.35 3.35 0 0 1-.78 1.21c-.38.38-.76.61-1.21.78-.43.17-.93.28-1.66.31-.73.04-.96.04-2.82.04s-2.09-.01-2.82-.04c-.73-.03-1.23-.14-1.66-.31a3.35 3.35 0 0 1-1.21-.78 3.35 3.35 0 0 1-.78-1.21c-.17-.43-.28-.93-.31-1.66C1.01 10.09 1 9.86 1 8s.01-2.09.04-2.82c.03-.73.14-1.23.31-1.66.17-.45.4-.83.78-1.21.38-.38.76-.61 1.21-.78.43-.17.93-.28 1.66-.31C5.91 1.01 6.14 1 8 1Zm0 1.44c-1.83 0-2.05.01-2.77.04-.67.03-1.03.14-1.27.23-.32.12-.55.27-.79.51-.24.24-.39.47-.51.79-.09.24-.2.6-.23 1.27-.03.72-.04.94-.04 2.77s.01 2.05.04 2.77c.03.67.14 1.03.23 1.27.12.32.27.55.51.79.24.24.47.39.79.51.24.09.6.2 1.27.23.72.03.94.04 2.77.04s2.05-.01 2.77-.04c.67-.03 1.03-.14 1.27-.23.32-.12.55-.27.79-.51.24-.24.39-.47.51-.79.09-.24.2-.6.23-1.27.03-.72.04-.94.04-2.77s-.01-2.05-.04-2.77c-.03-.67-.14-1.03-.23-1.27a2.13 2.13 0 0 0-.51-.79 2.13 2.13 0 0 0-.79-.51c-.24-.09-.6-.2-1.27-.23-.72-.03-.94-.04-2.77-.04ZM8 5.14a2.86 2.86 0 1 1 0 5.72 2.86 2.86 0 0 1 0-5.72Zm0 1.44a1.42 1.42 0 1 0 0 2.84 1.42 1.42 0 0 0 0-2.84Zm3-2.57a.68.68 0 1 1 0 1.36.68.68 0 0 1 0-1.36Z" />
    </svg>
  );
}

const footerLinkClass =
  "w-fit font-semibold text-[var(--bb-text-inverse-secondary)] hover:text-brand transition-colors";
const footerSocialLinkClass =
  "inline-flex items-center gap-2 text-[var(--bb-text-inverse-secondary)] text-sm no-underline hover:text-brand transition-colors";

export async function SiteFooter() {
  const [guideMenuResult, importedGuideMenuResult, settingsResult] = await Promise.all([
    getPublicMenu("guide"),
    getPublicMenu("guide-menu"),
    listPublicSettings(),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = getSettingValue(settings, ["site_name", "site_title", "site.name"], DEFAULT_SITE_NAME);
  const footerHeading = getSettingValue(settings, ["footer_tagline"], DEFAULT_FOOTER_HEADING);
  const footerDescription = getSettingValue(settings, ["footer_description"], DEFAULT_FOOTER_DESCRIPTION);
  const hotline = getSettingValue(settings, ["hotline", "contact_phone", "support_phone"], "");
  const email = getSettingValue(settings, ["contact_email", "email", "support_email", "site.contact_email"], "");
  const address = getSettingValue(settings, ["contact_address", "address", "site_address"], "");
  const facebookUrl = getSettingValue(settings, ["facebook_url"], "");
  const zaloUrl = getSettingValue(settings, ["zalo_url"], "");
  const youtubeUrl = getSettingValue(settings, ["youtube_url"], "");
  const tiktokUrl = getSettingValue(settings, ["tiktok_url"], "");
  const instagramUrl = getSettingValue(settings, ["instagram_url"], "");
  const bctUrl = getSettingValue(settings, ["bct_url"], "");
  const businessLicenseNo = getSettingValue(settings, ["business_license_no"], "");
  const businessLicenseDate = getSettingValue(settings, ["business_license_date"], "");
  const businessLicenseAuthority = getSettingValue(settings, ["business_license_authority"], "");

  const guideLinksRaw = groupMenuItems(guideMenuResult.data?.items ?? []);
  const importedGuideLinksRaw = groupMenuItems(importedGuideMenuResult.data?.items ?? []);
  const guideLinksSource = guideLinksRaw.length > 0 ? guideLinksRaw : importedGuideLinksRaw;
  const infoLinks = guideLinksSource.length > 0 ? guideLinksSource : FALLBACK_INFO_LINKS;

  const socialLinks: Array<{ label: string; url: string; icon: React.ReactNode }> = [
    ...(facebookUrl ? [{ label: "Facebook", url: facebookUrl, icon: <IconFacebook /> }] : []),
    ...(zaloUrl ? [{ label: "Zalo", url: zaloUrl, icon: <IconZalo /> }] : []),
    ...(youtubeUrl ? [{ label: "YouTube", url: youtubeUrl, icon: <IconYouTube /> }] : []),
    ...(tiktokUrl ? [{ label: "TikTok", url: tiktokUrl, icon: <IconTikTok /> }] : []),
    ...(instagramUrl ? [{ label: "Instagram", url: instagramUrl, icon: <IconInstagram /> }] : []),
  ];

  return (
    <footer className="border-t-[3px] border-brand bg-footer-top text-[var(--bb-text-inverse-secondary)]">
      {/* Main footer body */}
      <div className="bb-container grid grid-cols-1 gap-6 py-10 md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.85fr)_minmax(0,1.05fr)_minmax(0,0.85fr)] md:gap-10">
        {/* Brand + newsletter column */}
        <section className="grid content-start gap-3">
          <p className="m-0 text-brand text-sm font-bold tracking-[0.12em] uppercase">{siteName}</p>
          <h2 className="m-0 font-display uppercase text-2xl text-white md:text-3xl">{footerHeading}</h2>
          <div className="mt-1">
            <NewsletterForm />
          </div>
          <p className="m-0 text-sm leading-relaxed text-[var(--bb-text-inverse-secondary)]">{footerDescription}</p>
        </section>

        {/* Thông tin */}
        <FooterCollapsible title="Thông tin">
          {infoLinks.map((item) => (
            <Link key={item.id} href={normalizeMenuUrl(item.url)} className={footerLinkClass}>
              {safeText(item.label, "Liên kết")}
            </Link>
          ))}
        </FooterCollapsible>

        {/* Liên hệ */}
        <FooterCollapsible title="Liên hệ">
          {hotline ? (
            <a
              href={`tel:${hotline.replace(/[\s.]/g, "")}`}
              className="flex items-start gap-2 text-sm font-bold text-brand no-underline hover:text-[var(--bb-brand-primary-hover)] transition-colors"
            >
              <span className="text-brand">
                <IconPhone />
              </span>
              {hotline}
            </a>
          ) : null}
          {email ? (
            <a
              href={`mailto:${email}`}
              className="flex items-start gap-2 text-sm font-bold text-brand no-underline hover:text-[var(--bb-brand-primary-hover)] transition-colors"
            >
              <span className="text-brand">
                <IconMail />
              </span>
              {email}
            </a>
          ) : null}
          {address ? (
            <p className="m-0 flex items-start gap-2 text-sm leading-relaxed text-[var(--bb-text-inverse-secondary)]">
              <span className="text-brand">
                <IconMapPin />
              </span>
              {address}
            </p>
          ) : null}
          {!hotline && !email && !address ? (
            <p className="m-0 text-sm">Đang cập nhật thông tin liên hệ.</p>
          ) : null}
        </FooterCollapsible>

        {/* Mạng xã hội */}
        <FooterCollapsible title="Mạng xã hội">
          {socialLinks.length > 0 ? (
            socialLinks.map((item) => (
              <a
                key={item.label}
                href={item.url}
                className={footerSocialLinkClass}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.label} BigBike`}
              >
                {item.icon}
                {item.label}
              </a>
            ))
          ) : (
            <p className="m-0 text-sm">Đang cập nhật kênh mạng xã hội.</p>
          )}
        </FooterCollapsible>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-white/10 bg-black py-[30px]">
        <div className="bb-container flex items-center gap-6 flex-wrap max-md:flex-col max-md:items-start max-md:gap-4">
          <div className="shrink-0 opacity-70">
            <Image
              src="/wp/logo-footer.png"
              alt="BigBike"
              width={200}
              height={66}
              className="block h-9 w-auto"
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-[0.2rem]">
            <p className="m-0 text-sm italic text-[var(--bb-text-inverse-secondary)]">Bigbike mong được lắng nghe và đồng hành cùng bạn trên mọi cung đường.</p>
            <p className="m-0 text-sm text-[var(--bb-text-inverse-secondary)]">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            {businessLicenseNo && (
              <p className="m-0 text-sm text-[var(--bb-text-inverse-secondary)]">
                Mã ĐKKD: {businessLicenseNo}.
                {businessLicenseDate ? ` Ngày cấp: ${businessLicenseDate}.` : ""}
                {businessLicenseAuthority ? ` Nơi cấp: ${businessLicenseAuthority}.` : ""}
              </p>
            )}
          </div>
          {bctUrl && (
            <div className="shrink-0">
              <a href={bctUrl} target="_blank" rel="noopener noreferrer" aria-label="Đã thông báo Bộ Công Thương">
                <BctBadge alt="Đã thông báo Bộ Công Thương" height={36} />
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
