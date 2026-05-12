import Link from "next/link";
import Image from "next/image";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import { safeText } from "@/lib/utils/format";
import { toAccountPath, toArticleListPath, toPagePath, toProductListPath } from "@/lib/utils/routes";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { BctBadge } from "./BctBadge";

const DEFAULT_SITE_NAME = "BigBike";

type FallbackLink = { id: string; parentId: null; label: string; url: string; children: never[] };

const FALLBACK_FOOTER_LINKS: FallbackLink[] = [
  { id: "fbf-1", parentId: null, label: "Sản phẩm", url: "/san-pham/", children: [] },
  { id: "fbf-2", parentId: null, label: "Thương hiệu", url: "/brands/", children: [] },
  { id: "fbf-3", parentId: null, label: "Giới thiệu", url: "/gioi-thieu/", children: [] },
  { id: "fbf-4", parentId: null, label: "Liên hệ", url: "/lien-he/", children: [] },
];

const FALLBACK_GUIDE_LINKS: FallbackLink[] = [
  { id: "fbg-1", parentId: null, label: "Hướng dẫn mua hàng", url: "/huong-dan-mua-hang/", children: [] },
  { id: "fbg-2", parentId: null, label: "Chính sách đổi trả", url: "/chinh-sach/doi-tra/", children: [] },
  { id: "fbg-3", parentId: null, label: "Chính sách bảo hành", url: "/chinh-sach/bao-hanh/", children: [] },
  { id: "fbg-4", parentId: null, label: "Chính sách bảo mật", url: "/chinh-sach/bao-mat/", children: [] },
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

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="bb-footer-icon">
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h1a1 1 0 0 1 .98.8l.4 2a1 1 0 0 1-.27.93L4.8 5.55C5.7 7.2 6.8 8.3 8.45 9.2l.82-.83a1 1 0 0 1 .93-.27l2 .4A1 1 0 0 1 13 9.5v1A1.5 1.5 0 0 1 11.5 12C5.7 12 2 8.3 2 2.5Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="bb-footer-icon">
      <rect x="1" y="3" width="12" height="8" rx="1.5" />
      <path d="M1 4l6 4 6-4" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="bb-footer-icon">
      <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4Z" />
      <circle cx="7" cy="5" r="1.2" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="bb-footer-icon">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1.75 3.5h-1c-.41 0-.5.19-.5.63V6h1.5l-.2 1.5H8.25V12h-1.5V7.5H6V6h.75V4.88C6.75 3.62 7.5 3 8.75 3c.58 0 1 .04 1 .04V4.5Z" />
    </svg>
  );
}

function IconZalo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="bb-footer-icon">
      <rect width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" />
      <text x="8" y="11.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="currentColor">Z</text>
      <ellipse cx="8" cy="8" rx="5.5" ry="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="bb-footer-icon">
      <path d="M15.3 4.5a2 2 0 0 0-1.4-1.4C12.7 2.8 8 2.8 8 2.8s-4.7 0-5.9.3A2 2 0 0 0 .7 4.5C.4 5.7.4 8 .4 8s0 2.3.3 3.5a2 2 0 0 0 1.4 1.4c1.2.3 5.9.3 5.9.3s4.7 0 5.9-.3a2 2 0 0 0 1.4-1.4c.3-1.2.3-3.5.3-3.5s0-2.3-.3-3.5ZM6.5 10.3V5.7L10.5 8l-4 2.3Z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="bb-footer-icon">
      <path d="M11 1h-2v9.5a1.5 1.5 0 1 1-1.5-1.5c.17 0 .34.02.5.07V7.03A3.5 3.5 0 1 0 11 10.5V5.6a5.52 5.52 0 0 0 3 .9V4.52A3.52 3.52 0 0 1 11 1Z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="bb-footer-icon">
      <path d="M8 1c1.86 0 2.09.01 2.82.04.73.03 1.23.15 1.66.31.45.17.83.4 1.21.78.38.38.61.76.78 1.21.17.43.28.93.31 1.66.04.73.04.96.04 2.82s-.01 2.09-.04 2.82c-.03.73-.14 1.23-.31 1.66a3.35 3.35 0 0 1-.78 1.21c-.38.38-.76.61-1.21.78-.43.17-.93.28-1.66.31-.73.04-.96.04-2.82.04s-2.09-.01-2.82-.04c-.73-.03-1.23-.14-1.66-.31a3.35 3.35 0 0 1-1.21-.78 3.35 3.35 0 0 1-.78-1.21c-.17-.43-.28-.93-.31-1.66C1.01 10.09 1 9.86 1 8s.01-2.09.04-2.82c.03-.73.14-1.23.31-1.66.17-.45.4-.83.78-1.21.38-.38.76-.61 1.21-.78.43-.17.93-.28 1.66-.31C5.91 1.01 6.14 1 8 1Zm0 1.44c-1.83 0-2.05.01-2.77.04-.67.03-1.03.14-1.27.23-.32.12-.55.27-.79.51-.24.24-.39.47-.51.79-.09.24-.2.6-.23 1.27-.03.72-.04.94-.04 2.77s.01 2.05.04 2.77c.03.67.14 1.03.23 1.27.12.32.27.55.51.79.24.24.47.39.79.51.24.09.6.2 1.27.23.72.03.94.04 2.77.04s2.05-.01 2.77-.04c.67-.03 1.03-.14 1.27-.23.32-.12.55-.27.79-.51.24-.24.39-.47.51-.79.09-.24.2-.6.23-1.27.03-.72.04-.94.04-2.77s-.01-2.05-.04-2.77c-.03-.67-.14-1.03-.23-1.27a2.13 2.13 0 0 0-.51-.79 2.13 2.13 0 0 0-.79-.51c-.24-.09-.6-.2-1.27-.23-.72-.03-.94-.04-2.77-.04ZM8 5.14a2.86 2.86 0 1 1 0 5.72 2.86 2.86 0 0 1 0-5.72Zm0 1.44a1.42 1.42 0 1 0 0 2.84 1.42 1.42 0 0 0 0-2.84Zm3-2.57a.68.68 0 1 1 0 1.36.68.68 0 0 1 0-1.36Z" />
    </svg>
  );
}

export async function SiteFooter() {
  const [footerMenuResult, guideMenuResult, importedGuideMenuResult, settingsResult] = await Promise.all([
    getPublicMenu("footer"),
    getPublicMenu("guide"),
    getPublicMenu("guide-menu"),
    listPublicSettings(),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = getSettingValue(settings, ["site_name", "site_title", "site.name"], DEFAULT_SITE_NAME);
  const footerTagline = getSettingValue(settings, ["footer_tagline"], "");
  const footerDescription = getSettingValue(settings, ["footer_description"], "");
  const hotline = getSettingValue(settings, ["hotline", "contact_phone", "support_phone"], "");
  const hotline2 = getSettingValue(settings, ["hotline_2"], "");
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

  const footerLinksRaw = groupMenuItems(footerMenuResult.data?.items ?? []);
  const guideLinksRaw = groupMenuItems(guideMenuResult.data?.items ?? []);
  const importedGuideLinksRaw = groupMenuItems(importedGuideMenuResult.data?.items ?? []);
  const visibleGuideLinksRaw = guideLinksRaw.length > 0 ? guideLinksRaw : importedGuideLinksRaw;

  const footerLinks = footerLinksRaw.length > 0 ? footerLinksRaw : FALLBACK_FOOTER_LINKS;
  const visibleGuideLinks = visibleGuideLinksRaw.length > 0 ? visibleGuideLinksRaw : FALLBACK_GUIDE_LINKS;

  return (
    <footer className="bb-footer">
      <div className="bb-container bb-footer-inner">
        <section className="bb-footer-brand">
          <p className="bb-kicker">{siteName}</p>
          <h2>{footerTagline || siteName}</h2>
          <p>
            {footerDescription ||
              "Hệ thống mua sắm biker, tập trung vào sản phẩm, tư vấn và nội dung hướng dẫn rõ ràng."}
          </p>
          <div className="bb-footer-meta">
            <Link href={toPagePath("gioi-thieu")} className="bb-link">
              Giới thiệu
            </Link>
            <Link href={toPagePath("lien-he")} className="bb-link">
              Liên hệ
            </Link>
          </div>
        </section>

        <div className="bb-footer-right">
        <section className="bb-footer-col">
          <h3>Danh mục</h3>
          <Link href={toProductListPath()} className="bb-footer-link">
            Sản phẩm
          </Link>
          <Link href={toArticleListPath()} className="bb-footer-link">
            Tin tức
          </Link>
          <Link href={toAccountPath()} className="bb-footer-link">
            Tài khoản
          </Link>
        </section>

        <section className="bb-footer-col">
          <h3>{footerMenuResult.data?.name || "Menu"}</h3>
          <nav className="bb-footer-links">
            {footerLinks.map((item) => (
              <div key={item.id} className="bb-footer-group">
                <Link href={normalizeMenuUrl(item.url)} className="bb-footer-link">
                  {safeText(item.label, "Liên kết")}
                </Link>
                {item.children.length > 0 ? (
                  <div className="bb-footer-sublinks">
                    {item.children.map((child) => (
                      <Link key={child.id} href={normalizeMenuUrl(child.url)} className="bb-footer-sublink">
                        {safeText(child.label, "Liên kết")}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </section>

        <section className="bb-footer-col">
          <h3>Hướng dẫn</h3>
          <nav className="bb-footer-links">
            {visibleGuideLinks.map((item) => (
              <div key={item.id} className="bb-footer-group">
                <Link href={normalizeMenuUrl(item.url)} className="bb-footer-link">
                  {safeText(item.label, "Hướng dẫn")}
                </Link>
                {item.children.length > 0 ? (
                  <div className="bb-footer-sublinks">
                    {item.children.map((child) => (
                      <Link key={child.id} href={normalizeMenuUrl(child.url)} className="bb-footer-sublink">
                        {safeText(child.label, "Hướng dẫn")}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </section>

        <section className="bb-footer-col">
          <h3>Thông tin</h3>
          <div className="bb-footer-contact">
            {hotline ? (
              <p className="bb-footer-contact-row">
                <IconPhone />
                <a href={`tel:${hotline.replace(/[\s.]/g, "")}`} className="bb-footer-link">
                  {hotline}
                </a>
              </p>
            ) : null}
            {hotline2 ? (
              <p className="bb-footer-contact-row">
                <IconPhone />
                <a href={`tel:${hotline2.replace(/[\s.]/g, "")}`} className="bb-footer-link">
                  {hotline2}
                </a>
              </p>
            ) : null}
            {email ? (
              <p className="bb-footer-contact-row">
                <IconMail />
                <a href={`mailto:${email}`} className="bb-footer-link">
                  {email}
                </a>
              </p>
            ) : null}
            {address ? (
              <p className="bb-footer-contact-row bb-footer-contact-address">
                <IconMap />
                <span>{address}</span>
              </p>
            ) : null}
            {!hotline && !email && !address ? (
              <p className="bb-footer-muted">Đang cập nhật thông tin liên hệ.</p>
            ) : null}
          </div>
          {(facebookUrl || zaloUrl || youtubeUrl || tiktokUrl || instagramUrl) ? (
            <div className="bb-footer-social">
              {facebookUrl ? (
                <a href={facebookUrl} className="bb-footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="Facebook BigBike">
                  <IconFacebook />
                  Facebook
                </a>
              ) : null}
              {zaloUrl ? (
                <a href={zaloUrl} className="bb-footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="Zalo BigBike">
                  <IconZalo />
                  Zalo
                </a>
              ) : null}
              {youtubeUrl ? (
                <a href={youtubeUrl} className="bb-footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="YouTube BigBike">
                  <IconYouTube />
                  YouTube
                </a>
              ) : null}
              {tiktokUrl ? (
                <a href={tiktokUrl} className="bb-footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="TikTok BigBike">
                  <IconTikTok />
                  TikTok
                </a>
              ) : null}
              {instagramUrl ? (
                <a href={instagramUrl} className="bb-footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="Instagram BigBike">
                  <IconInstagram />
                  Instagram
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
        </div>
      </div>

      <div className="bb-footer-bottom">
        <div className="bb-container bb-footer-bottom-inner">
          <div className="bb-footer-bottom-logo">
            <Image
              src="/wp/logo-footer.png"
              alt="BigBike"
              width={200}
              height={66}
            />
          </div>
          <div className="bb-footer-bottom-copy">
            <p>© {new Date().getFullYear()} {siteName}.</p>
            {businessLicenseNo && (
              <p>
                Mã ĐKKD: {businessLicenseNo}.
                {businessLicenseDate ? ` Ngày cấp: ${businessLicenseDate}.` : ""}
                {businessLicenseAuthority ? ` Nơi cấp: ${businessLicenseAuthority}.` : ""}
              </p>
            )}
          </div>
          {bctUrl && (
            <div className="bb-footer-bottom-bct">
              <a
                href={bctUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Đã thông báo Bộ Công Thương"
              >
                <BctBadge alt="Đã thông báo Bộ Công Thương" height={36} />
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
