import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "@/components/cart/CartIcon";
import { HeaderNavItem, type HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { MobileHeaderMenu } from "@/components/layout/MobileHeaderMenu";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import type { PublicMenuItem } from "@/lib/contracts/public";

const DEFAULT_SITE_NAME = "BigBike";
const PRIMARY_MENU_LOCATION = "primary";

function buildMenuTree(items: PublicMenuItem[]): HeaderNavNode[] {
  const map = new Map<string, HeaderNavNode>();
  items.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: HeaderNavNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRecursive = (nodes: HeaderNavNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

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
  const menuTree = buildMenuTree(menuResult.data?.items ?? []);

  return (
    <header className="wp-header">
      <PromoStrip hotline={hotline} zaloUrl={zaloUrl} />
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
            {menuTree.map((node) => (
              <HeaderNavItem key={node.id} node={node} />
            ))}
          </nav>

          <div className="wp-header-actions">
            <SearchToggle />

            <CartIcon />

            <HeaderUserMenu />

            <MobileHeaderMenu
              menuTree={menuTree}
              menuLabel={menuResult.data?.name ?? "Điều hướng chính"}
              hotline={hotline}
              zaloUrl={zaloUrl}
            />
        </div>
      </div>
    </header>
  );
}
