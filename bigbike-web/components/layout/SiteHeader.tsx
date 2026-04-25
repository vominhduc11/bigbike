import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { CartIcon } from "@/components/cart/CartIcon";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import { toAccountPath } from "@/lib/utils/routes";

const DEFAULT_SITE_NAME = "BigBike";
const PRIMARY_MENU_LOCATION = "primary";

function getSettingValue(
  settings: { settingKey: string; settingValue: string }[],
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const found = settings.find(
      (s) => s.settingKey === key && s.settingValue.trim().length > 0,
    );
    if (found) return found.settingValue.trim();
  }
  return fallback;
}

function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.length === 0 ? "/" : trimmed;
}

function PromoStrip({
  hotline,
  zaloUrl,
}: {
  hotline: string;
  zaloUrl: string;
}) {
  const supportLabel = hotline || "0903 123 456";

  return (
    <div className="wp-promo-strip-wrap">
      <div className="bb-container wp-promo-strip">
        <span>
          <b>BIGBIKE SINCE 2013</b> garage gear moto chính hãng, tư vấn kỹ cho
          từng cung đường
        </span>
        <span>
          Hotline {supportLabel}
          {zaloUrl ? " · Zalo hỗ trợ nhanh" : " · Giao hàng toàn quốc"}
        </span>
      </div>
    </div>
  );
}

export async function SiteHeader() {
  const [menuResult, settingsResult] = await Promise.all([
    getPublicMenu(PRIMARY_MENU_LOCATION),
    listPublicSettings(),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = getSettingValue(
    settings,
    ["site_name", "site_title"],
    DEFAULT_SITE_NAME,
  );
  const hotline = getSettingValue(settings, ["hotline", "phone", "support_phone"]);
  const zaloUrl = getSettingValue(settings, ["zalo_url", "zalo"]);
  const menuItems = (menuResult.data?.items ?? [])
    .filter((item) => item.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <PromoStrip hotline={hotline} zaloUrl={zaloUrl} />
      <header className="wp-header">
        <div className="bb-container wp-header-inner">
          <div className="wp-logo-panel">
            <Link
              href="/"
              className="wp-logo-link"
              aria-label={`${siteName} Home`}
              title={siteName}
            >
              <Image
                src="/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png"
                alt={siteName}
                width={130}
                height={56}
                priority
              />
            </Link>
          </div>

          <nav
            className="wp-nav"
            aria-label={menuResult.data?.name ?? "Điều hướng chính"}
          >
            {menuItems.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && (
                  <span className="wp-nav-sep" aria-hidden="true">
                    •
                  </span>
                )}
                <Link
                  href={normalizeMenuUrl(item.url)}
                  className={`wp-nav-link ${item.cssClass ?? ""}`.trim()}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noreferrer" : undefined}
                >
                  {item.label}
                </Link>
              </Fragment>
            ))}
          </nav>

          <div className="wp-header-actions">
            <SearchToggle />

            <CartIcon />

            <Link
              href={toAccountPath()}
              className="wp-icon-btn"
              aria-label="Tài khoản"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>

            <button className="wp-icon-btn" aria-label="Menu" type="button">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
