import Link from "next/link";
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
    const found = settings.find((setting) => setting.settingKey === key && setting.settingValue.trim().length > 0);
    if (found) return found.settingValue.trim();
  }
  return fallback;
}

function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function groupMenuItems(items: Array<{ id: string; parentId: string | null; label: string; url: string }>) {
  const roots = items.filter((item) => item.parentId === null);
  const children = items.filter((item) => item.parentId !== null);
  return roots.map((root) => ({
    ...root,
    children: children.filter((child) => child.parentId === root.id),
  }));
}

export async function SiteFooter() {
  const [footerMenuResult, guideMenuResult, settingsResult] = await Promise.all([
    getPublicMenu("footer"),
    getPublicMenu("guide"),
    listPublicSettings(),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = getSettingValue(settings, ["site_name", "site_title"], DEFAULT_SITE_NAME);
  const hotline = getSettingValue(settings, ["hotline", "contact_phone", "support_phone"], "");
  const email = getSettingValue(settings, ["contact_email", "email", "support_email"], "");
  const address = getSettingValue(settings, ["contact_address", "address", "site_address"], "");
  const footerLinks = groupMenuItems(footerMenuResult.data?.items ?? []);
  const guideLinks = groupMenuItems(guideMenuResult.data?.items ?? []);

  return (
    <footer className="bb-footer">
      <div className="bb-container bb-footer-inner">
        <section className="bb-footer-brand">
          <p className="bb-kicker">BigBike</p>
          <h2>{siteName}</h2>
          <p>
            Hệ thống mua sắm biker, tập trung vào sản phẩm, tư vấn và nội dung hướng dẫn rõ ràng.
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
          {guideLinks.length > 0 ? (
            <nav className="bb-footer-links">
              {guideLinks.map((item) => (
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
            {hotline ? <p><a href={`tel:${hotline.replace(/\s+/g, "")}`} className="bb-footer-link">Hotline: {hotline}</a></p> : null}
            {email ? <p><a href={`mailto:${email}`} className="bb-footer-link">Email: {email}</a></p> : null}
            {address ? <p>Địa chỉ: {address}</p> : null}
            {!hotline && !email && !address ? <p style={{ color: "var(--bb-text-muted)" }}>Đang cập nhật thông tin liên hệ.</p> : null}
          </div>
        </section>
      </div>
    </footer>
  );
}
