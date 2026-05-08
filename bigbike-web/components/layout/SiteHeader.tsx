import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "@/components/cart/CartIcon";
import { HeaderNavItem, type HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { MobileHeaderMenu } from "@/components/layout/MobileHeaderMenu";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { StickyHeaderShell } from "@/components/layout/StickyHeaderShell";
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
  return (
    <div className="wp-promo-strip-wrap">
      <div className="bb-container wp-promo-strip">
        <span>
          <b>BIGBIKE SINCE 2013</b> garage gear moto chính hãng, tư vấn kỹ cho
          từng cung đường
        </span>
        <span>
          {hotline ? `Hotline ${hotline} · ` : ""}
          {zaloUrl ? "Zalo hỗ trợ nhanh" : "Giao hàng toàn quốc"}
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

  if (!menuResult.data) {
    console.warn(
      `[SiteHeader] Menu "${PRIMARY_MENU_LOCATION}" could not be loaded.`,
      menuResult.error?.message ?? "unknown error",
    );
  }

  const resolvedMenuTree = menuResult.data ? buildMenuTree(menuResult.data.items) : [];

  return (
    <StickyHeaderShell>
      <PromoStrip hotline={hotline} zaloUrl={zaloUrl} />
      <div className="bb-container wp-header-inner">
        <div className="wp-logo-panel">
          <Link
            href="/"
            className="wp-logo-link"
            aria-label={`${siteName} Home`}
            title={siteName}
          >
            {/* WP-style dual logo: emblem (default, ≥768px while not scrolled)
                cross-fades with wordmark (scrolled and/or <768px). */}
            <Image
              className="wp-logo-emblem hide-mobile"
              src="/brand/wp-logo/emblem.png"
              alt={siteName}
              width={210}
              height={190}
              priority
            />
            <Image
              className="wp-logo-wordmark hide-desktop"
              src="/brand/wp-logo/wordmark.png"
              alt={siteName}
              width={120}
              height={44}
              priority
            />
          </Link>
        </div>

        <nav
          className="wp-nav"
          aria-label={menuResult.data?.name ?? "Điều hướng chính"}
        >
          {resolvedMenuTree.map((node) => (
            <HeaderNavItem key={node.id} node={node} />
          ))}
        </nav>

        <div className="wp-header-actions">
          <SearchToggle />

          <CartIcon />

          <HeaderUserMenu />

          <MobileHeaderMenu
            menuTree={resolvedMenuTree}
            menuLabel={menuResult.data?.name ?? "Điều hướng chính"}
            hotline={hotline}
            zaloUrl={zaloUrl}
          />
        </div>
      </div>
    </StickyHeaderShell>
  );
}
