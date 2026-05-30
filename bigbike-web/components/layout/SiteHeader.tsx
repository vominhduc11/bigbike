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
import { getPublicMenu, listCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { pickSetting } from "@/lib/utils/settings";

const DEFAULT_SITE_NAME = "BigBike";
const PRIMARY_MENU_LOCATION = "primary";

export async function SiteHeader() {
  const [menuResult, settingsResult, categoriesResult, t] = await Promise.all([
    getPublicMenu(PRIMARY_MENU_LOCATION),
    listPublicSettings(),
    listCategories({ size: 8, sort: "sortOrder:asc" }),
    getTranslations("Header"),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || DEFAULT_SITE_NAME;
  const hotline = pickSetting(settings, ["hotline"]);
  const hotline2 = pickSetting(settings, ["hotline_2"]);
  const zaloUrl = pickSetting(settings, ["zalo_url"]);
  const shopDescription = pickSetting(settings, ["footer_description"]);
  const shopAddress = pickSetting(settings, ["contact_address"]);
  const instagramUrl = pickSetting(settings, ["instagram_url"]);

  if (!menuResult.data) {
    console.warn(
      `[SiteHeader] Menu "${PRIMARY_MENU_LOCATION}" could not be loaded.`,
      menuResult.error?.message ?? "unknown error",
    );
  }

  const fallbackPrimaryMenu: HeaderNavNode[] = [
    {
      id: "fb-1",
      parentId: null,
      label: t("fallbackNav.home"),
      url: "/",
      sortOrder: 0,
      openInNewTab: false,
      cssClass: null,
      children: [],
    },
    {
      id: "fb-2",
      parentId: null,
      label: t("fallbackNav.products"),
      url: "/san-pham/",
      sortOrder: 1,
      openInNewTab: false,
      cssClass: null,
      children: [],
    },
    {
      id: "fb-3",
      parentId: null,
      label: t("fallbackNav.categories"),
      url: "/danh-muc-san-pham/",
      sortOrder: 2,
      openInNewTab: false,
      cssClass: null,
      children: [],
    },
    {
      id: "fb-4",
      parentId: null,
      label: t("fallbackNav.brands"),
      url: "/brands/",
      sortOrder: 3,
      openInNewTab: false,
      cssClass: null,
      children: [],
    },
    {
      id: "fb-5",
      parentId: null,
      label: t("fallbackNav.news"),
      url: "/tin-tuc/",
      sortOrder: 4,
      openInNewTab: false,
      cssClass: null,
      children: [],
    },
    {
      id: "fb-6",
      parentId: null,
      label: t("fallbackNav.contact"),
      url: "/lien-he/",
      sortOrder: 5,
      openInNewTab: false,
      cssClass: null,
      children: [],
    },
  ];

  const navigationLabel = menuResult.data?.name ?? t("primaryNavigation");
  const resolvedMenuTree: HeaderNavNode[] = menuResult.data?.items?.length
    ? buildPublicMenuTree(menuResult.data.items)
    : fallbackPrimaryMenu;

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
              className="bb-navigation flex h-full min-w-0 flex-1 items-stretch justify-center max-[1260px]:hidden"
              aria-label={navigationLabel}
            >
              <ul className="bb-header-nav m-0 flex h-full list-none items-stretch p-0">
                {resolvedMenuTree.map((node) => (
                  <HeaderNavItem key={node.id} node={node} />
                ))}
              </ul>
            </nav>

            <div className="bb-user-control">
              <SearchToggle popularCategories={categoriesResult.data?.map(c => ({ name: c.name, slug: c.slug })) ?? []} />
              <CartIcon />
              <HeaderUserMenu />
              <ShopInfoDrawer
                siteName={siteName}
                description={shopDescription}
                hours=""
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
                hours=""
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
