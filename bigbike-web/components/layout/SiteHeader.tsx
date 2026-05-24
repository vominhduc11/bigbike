import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CartIcon } from "@/components/cart/CartIcon";
import { HeaderNavItem, type HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { MobileHeaderMenu } from "@/components/layout/MobileHeaderMenu";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { ShopInfoDrawer } from "@/components/layout/ShopInfoDrawer";
import { StickyHeaderShell } from "@/components/layout/StickyHeaderShell";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import type { PublicMenuItem } from "@/lib/contracts/public";
import { normalizeMenuUrl } from "@/lib/utils/nav";

const DEFAULT_SITE_NAME = "BigBike";
const PRIMARY_MENU_LOCATION = "primary";

type LegacyMenuNode = {
  label: string;
  url: string;
  children?: LegacyMenuNode[];
};

const WP_PRODUCT_MENU: LegacyMenuNode[] = [
  { label: "Khuyến mãi hot", url: "/san-pham-khuyen-mai.html" },
  {
    label: "MŨ BẢO HIỂM",
    url: "/mu-bao-hiem.html",
    children: [
      { label: "Mũ Bảo Hiểm Fullface", url: "/mu-bao-hiem/mu-bao-hiem-fullface.html" },
      { label: "Mũ Bảo Hiểm Cào Cào & Dual Sport", url: "/mu-bao-hiem/mu-bao-hiem-cao-cao-dual-sport.html" },
      { label: "MŨ BẢO HIỂM FULLFACE LẬT HÀM", url: "/mu-bao-hiem/mu-bao-hiem-fullface-lat-ham.html" },
      { label: "MŨ BẢO HIỂM 3/4", url: "/mu-bao-hiem/mu-bao-hiem-3-4.html" },
    ],
  },
  {
    label: "ÁO QUẦN BẢO HỘ MOTO PHƯỢT",
    url: "/ao-quan-bao-ho.html",
    children: [
      { label: "Áo Bảo Hộ Vải", url: "/ao-quan-bao-ho/ao-bao-ho-vai-textile-jackets.html" },
      { label: "Áo Bảo Hộ Da, Liền Quần", url: "/ao-quan-bao-ho/ao-bao-ho-da-ao-lien-quan-leather-jackets-leather-suits.html" },
      { label: "Áo bảo hộ túi khí", url: "/ao-quan-bao-ho/ao-bao-ho-tui-khi.html" },
      { label: "Quần Bảo Hộ – Quần Giáp", url: "/ao-quan-bao-ho/quan-bao-ho-quan-giap.html" },
    ],
  },
  { label: "GĂNG TAY", url: "/gang-tay.html" },
  { label: "GIÀY BẢO HỘ", url: "/giay-bao-ho.html" },
  {
    label: "BALÔ ĐEO LƯNG – TÚI ĐEO – TÚI TREO XE",
    url: "/balo-deo-lung-tui-deo-tui-treo-xe.html",
    children: [
      { label: "BALO ĐEO LƯNG", url: "/balo-deo-lung-tui-deo-tui-treo-xe/balo-deo-lung.html" },
      { label: "TÚI ĐEO ĐÙI", url: "/balo-deo-lung-tui-deo-tui-treo-xe/tui-deo-dui.html" },
      { label: "TÚI ĐEO HÔNG – TÚI BAO TỬ", url: "/balo-deo-lung-tui-deo-tui-treo-xe/tui-deo-hong-tui-bao-tu.html" },
      { label: "TÚI TREO XE", url: "/balo-deo-lung-tui-deo-tui-treo-xe/tui-treo-theo-xe.html" },
    ],
  },
  { label: "GIÁP BẢO HỘ TAY CHÂN – ĐAI LƯNG – PHỤ KIỆN GIÁP", url: "/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap.html" },
  { label: "TAI NGHE BLUETOOTH", url: "/tai-nghe-bluetooth-gan-mu-bao-hiem.html" },
  {
    label: "Phụ kiện khác",
    url: "/phu-kien-khac.html",
    children: [
      {
        label: "PHỤ KIỆN ĐỒ LÓT",
        url: "/phu-kien-khac/phu-kien-do-lot.html",
        children: [
          { label: "ÁO LÓT", url: "/phu-kien-do-lot/ao-lot.html" },
          { label: "QUẦN LÓT", url: "/phu-kien-do-lot/quan-lot.html" },
          { label: "TRÙM ĐẦU", url: "/phu-kien-do-lot/trum-dau.html" },
          { label: "VỚ – ỐNG TAY", url: "/phu-kien-do-lot/vo-ong-tay.html" },
        ],
      },
      { label: "PHỤ KIỆN ĐI MƯA", url: "/phu-kien-di-mua.html" },
      { label: "Sản phẩm vệ sinh đồ bảo hộ – Chăm sóc xe", url: "/san-pham-ve-sinh-do-bao-ho-cham-soc-xe.html" },
      { label: "KÍNH THAY – PINLOCK CHỐNG SƯƠNG", url: "/pinlock-kinh-chong-suong-mu.html" },
      { label: "PHỤ KIỆN – GIÁ ĐỠ ĐIỆN THOẠI", url: "/phu-kien-khac/phu-kien-cho-xe-va-non-bao-hiem.html" },
    ],
  },
];

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

function toHeaderNavNode(node: LegacyMenuNode, parentId: string, index: number): HeaderNavNode {
  const id = `${parentId}-${index}`;

  return {
    id,
    parentId,
    label: node.label,
    url: node.url,
    sortOrder: index,
    openInNewTab: false,
    cssClass: null,
    children: (node.children ?? []).map((child, childIndex) =>
      toHeaderNavNode(child, id, childIndex),
    ),
  };
}

function withWpProductSubmenu(nodes: HeaderNavNode[]): HeaderNavNode[] {
  return nodes.map((node) => {
    const normalizedUrl = normalizeMenuUrl(node.url);
    const label = node.label.toLocaleLowerCase("vi-VN");
    const isProductRoot =
      label.includes("sản phẩm") ||
      normalizedUrl.includes("san-pham") ||
      normalizedUrl.includes("danh-muc-san-pham");

    if (isProductRoot) {
      return {
        ...node,
        children: WP_PRODUCT_MENU.map((child, index) =>
          toHeaderNavNode(child, node.id, index),
        ),
      };
    }

    return {
      ...node,
      children: withWpProductSubmenu(node.children),
    };
  });
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
  const baseMenuTree = menuResult.data ? buildMenuTree(menuResult.data.items) : fallbackPrimaryMenu;
  const resolvedMenuTree = withWpProductSubmenu(baseMenuTree);

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
                width={252}
                height={196}
                priority
              />
              <Image
                className="bb-logo-img hide-desktop"
                src="/wp/logo-1.png"
                alt={siteName}
                width={164}
                height={52}
                priority
              />
            </Link>
          </div>

          <div className="bb-right-header">
            <nav
              className="bb-navigation flex flex-1 items-stretch h-full min-w-0 justify-center max-[1260px]:hidden"
              aria-label={navigationLabel}
            >
              <ul className="bb-header-nav flex items-stretch h-full m-0 p-0 list-none">
                {resolvedMenuTree.map((node) => (
                  <HeaderNavItem key={node.id} node={node} />
                ))}
              </ul>
            </nav>

            <div className="bb-user-control">
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
                siteName={siteName}
                hours={businessHours}
                address={shopAddress}
                hotline={hotline}
                hotline2={hotline2}
              />
            </div>
          </div>
        </div>
      </div>
    </StickyHeaderShell>
  );
}
