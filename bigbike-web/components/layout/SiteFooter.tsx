import Link from "next/link";
import Image from "next/image";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import { safeText } from "@/lib/utils/format";
import { toAccountPath, toArticleListPath, toPagePath, toProductListPath } from "@/lib/utils/routes";

const DEFAULT_SITE_NAME = "BigBike";

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

function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
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
  const bctUrl = getSettingValue(settings, ["bct_url"], "");

  const footerLinks = groupMenuItems(footerMenuResult.data?.items ?? []);
  const guideLinks = groupMenuItems(guideMenuResult.data?.items ?? []);
  const importedGuideLinks = groupMenuItems(importedGuideMenuResult.data?.items ?? []);
  const visibleGuideLinks = guideLinks.length > 0 ? guideLinks : importedGuideLinks;

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
          <h3>Menu</h3>
          {footerLinks.length > 0 ? (
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
          ) : (
            <p className="bb-footer-muted">Đang cập nhật.</p>
          )}
        </section>

        <section className="bb-footer-col">
          <h3>Hướng dẫn</h3>
          {visibleGuideLinks.length > 0 ? (
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
          ) : (
            <p className="bb-footer-muted">Đang cập nhật.</p>
          )}
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
          {(facebookUrl || zaloUrl) ? (
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
            </div>
          ) : null}
        </section>
      </div>

      <div className="bb-footer-bottom">
        <div className="bb-container bb-footer-bottom-inner">
          <div className="bb-footer-bottom-logo">
            <Image
              src="/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png"
              alt="BigBike"
              width={108}
              height={36}
              unoptimized
            />
          </div>
          <div className="bb-footer-bottom-copy">
            <p>© {new Date().getFullYear()} BigBike. Mã ĐKKD: 41K8017383.</p>
            <p>Ngày cấp: 8/3/2016. Nơi cấp: Ủy Ban Nhân Dân Quận 11, TP.HCM.</p>
          </div>
          {bctUrl ? (
            <div className="bb-footer-bottom-bct">
              <a href={bctUrl} target="_blank" rel="noopener noreferrer" aria-label="Đã thông báo Bộ Công Thương">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://online.gov.vn/Content/EndUser/Images/LogoCCDVTMDT.png"
                  alt="Đã thông báo Bộ Công Thương"
                  height={36}
                  loading="lazy"
                />
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
