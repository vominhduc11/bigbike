import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CartIcon } from "@/components/cart/CartIcon";
import { HeaderNavItem, type HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { MobileHeaderMenu } from "@/components/layout/MobileHeaderMenu";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { ShopInfoDrawer } from "@/components/layout/ShopInfoDrawer";
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

export async function SiteHeader() {
  const [menuResult, settingsResult, t] = await Promise.all([
    getPublicMenu(PRIMARY_MENU_LOCATION),
    listPublicSettings(),
    getTranslations("Header"),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = getSettingValue(
    settings,
    ["site_name", "site_title"],
    DEFAULT_SITE_NAME,
  );
  const hotline = getSettingValue(settings, ["hotline", "phone", "support_phone"]);
  const hotline2 = getSettingValue(settings, ["hotline_2"]);
  const zaloUrl = getSettingValue(settings, ["zalo_url", "zalo"]);
  const shopDescription = getSettingValue(settings, ["footer_description", "shop_description"]);
  const shopAddress = getSettingValue(settings, ["contact_address", "address", "site_address"]);
  const businessHours = getSettingValue(settings, ["business_hours"]);
  const instagramUrl = getSettingValue(settings, ["instagram_url", "instagram"]);

  if (!menuResult.data) {
    console.warn(
      `[SiteHeader] Menu "${PRIMARY_MENU_LOCATION}" could not be loaded.`,
      menuResult.error?.message ?? "unknown error",
    );
  }

  const fallbackPrimaryMenu: HeaderNavNode[] = [
    { id: "fb-1", parentId: null, label: t("fallbackNav.home"), url: "/", sortOrder: 0, openInNewTab: false, cssClass: null, children: [] },
    { id: "fb-2", parentId: null, label: t("fallbackNav.products"), url: "/san-pham/", sortOrder: 1, openInNewTab: false, cssClass: null, children: [] },
    { id: "fb-3", parentId: null, label: t("fallbackNav.brands"), url: "/brands/", sortOrder: 2, openInNewTab: false, cssClass: null, children: [] },
    { id: "fb-4", parentId: null, label: t("fallbackNav.news"), url: "/tin-tuc/", sortOrder: 3, openInNewTab: false, cssClass: null, children: [] },
    { id: "fb-5", parentId: null, label: t("fallbackNav.contact"), url: "/lien-he/", sortOrder: 4, openInNewTab: false, cssClass: null, children: [] },
  ];
  const navigationLabel = menuResult.data?.name ?? t("primaryNavigation");
  const resolvedMenuTree = menuResult.data ? buildMenuTree(menuResult.data.items) : fallbackPrimaryMenu;

  return (
    <StickyHeaderShell>
      <div className="bb-header-container">
        <div className="bb-header-row">
          <div className="bb-logo">
            <Link href="/" aria-label={t("homeAriaLabel")} title={siteName}>
              <Image
                className="bb-logo-img hide-mobile"
                src="/wp/logo.png"
                alt={siteName}
                width={210}
                height={190}
                priority
              />
              <Image
                className="bb-logo-img hide-desktop"
                src="/wp/logo-1.png"
                alt={siteName}
                width={120}
                height={44}
                priority
              />
            </Link>
          </div>

          <div className="bb-right-header">
            <nav
              className="bb-navigation flex flex-1 items-stretch h-full min-w-0 justify-center max-[1199px]:hidden"
              aria-label={navigationLabel}
            >
              <ul className="bb-header-nav flex items-stretch h-full m-0 p-0 list-none">
                {resolvedMenuTree.map((node) => (
                  <HeaderNavItem key={node.id} node={node} />
                ))}
              </ul>
            </nav>

            <div className="bb-user-control">
              <div className="max-[639px]:hidden self-center">
                <LanguageSwitcher />
              </div>
              <SearchToggle />
              <CartIcon />
              <HeaderUserMenu />
              <ShopInfoDrawer
                siteName={siteName}
                description={shopDescription}
                hours={businessHours}
                address={shopAddress}
                hotline={hotline}
                hotline2={hotline2}
                zaloUrl={zaloUrl}
                instagramUrl={instagramUrl}
              />
              <MobileHeaderMenu
                menuTree={resolvedMenuTree}
                menuLabel={navigationLabel}
                hotline={hotline}
                zaloUrl={zaloUrl}
              />
            </div>
          </div>
        </div>
      </div>
    </StickyHeaderShell>
  );
}
