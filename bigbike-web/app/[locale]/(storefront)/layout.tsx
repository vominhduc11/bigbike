import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Footer } from "@/components/layout/Footer";
import { FooterMobileGate } from "@/components/layout/FooterMobileGate";
import { FloatingChatLoader } from "@/components/layout/FloatingChatLoader";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MobileCartSheet } from "@/components/layout/MobileCartSheet";
import { ScrollToTopFab } from "@/components/layout/ScrollToTopFab";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { SettingsFocusScroller } from "@/components/layout/SettingsFocusScroller";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import {
  getCatalogFacets,
  getPublicMenu,
  listProducts,
} from "@/lib/api/public-api";
import type { Locale } from "@/i18n/locale";
import { isLocale } from "@/i18n/locale";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { toBrandPath, toProductPath } from "@/lib/utils/routes";
import type { SearchShortcuts } from "@/components/layout/search/types";

export default async function StorefrontLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  // listCategories(size:100) used to be fetched here on EVERY storefront page purely to build a
  // "popular categories" shortcut group that no screen ever rendered (SEARCH_RULE_003 keeps the
  // opening panel to recent / brands / suggested products). Removed 2026-09-07 along with the
  // group itself, so every page now makes one server call fewer.
  const [primaryMenuResult, facetResult, suggestedProductResult] = await Promise.all([
    getPublicMenu("primary", locale),
    getCatalogFacets({ inStock: true, lang: locale }),
    listProducts({ page: 1, size: 5, sort: "popularity", inStock: true, lang: locale }),
  ]);
  const primaryNodes: HeaderNavNode[] = primaryMenuResult.data?.items?.length
    ? buildPublicMenuTree(primaryMenuResult.data.items)
    : [];
  const facets = facetResult.data;
  const sortByCount = <T extends { count: number; name: string }>(items: T[]) =>
    [...items].sort(
      (left, right) => right.count - left.count || left.name.localeCompare(right.name, locale),
    );
  const shortcuts: SearchShortcuts = {
    trendingBrands: sortByCount(
      (facets?.brands ?? [])
        .filter((brand) => brand.count > 0)
        .map((brand) => ({
          id: `brand-${brand.key}`,
          name: brand.label,
          href: toBrandPath(brand.key, locale),
          count: brand.count,
        })),
    ).slice(0, 5),
    suggestedProducts: suggestedProductResult.data
      .filter((product) => product.stockState === "IN_STOCK")
      .map((product) => ({
        id: `product-${product.id}`,
        name: product.name,
        href: toProductPath(
          locale === "en" ? product.slugEn || product.slug : product.slug,
          locale,
        ),
        image: product.image ?? null,
        price: product.price,
      }))
      .slice(0, 5),
  };

  return (
    <>
      <Header menuNodesVi={primaryNodes} menuNodesEn={primaryNodes} locale={locale} />
      <main id="main-content" tabIndex={-1} className="bb-main w-full">
        {children}
      </main>
      <div className="block md:hidden">
        <MobileBottomNav />
      </div>
      {/* Gắn panel tìm kiếm React như "panel host" ở mọi breakpoint để cả header
          desktop/tablet lẫn nút Tìm kiếm ở thanh dưới (mobile) mở được panel.
          Bọc Suspense vì SearchToggle dùng useSearchParams — bắt buộc khi trang
          render tĩnh (ISR/SSG), nếu không build sẽ bail CSR toàn trang. */}
      <Suspense fallback={null}>
        <SearchToggle shortcuts={shortcuts} />
      </Suspense>
      <MobileCartSheet />
      <FooterMobileGate>
        <Footer locale={locale} />
      </FooterMobileGate>
      <SettingsFocusScroller />
      <div className="bb-floating-chat-anchor fixed z-[var(--bb-z-floating)] pointer-events-none [&>*]:pointer-events-auto [[data-scroll-locked]_&]:hidden">
        <FloatingChatLoader locale={locale} />
      </div>
      <ScrollToTopFab />
    </>
  );
}
