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
import { getPublicMenu } from "@/lib/api/public-api";
import type { Locale } from "@/i18n/locale";
import { isLocale } from "@/i18n/locale";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";

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
  const primaryMenuResult = await getPublicMenu("primary", locale);
  const primaryNodes: HeaderNavNode[] = primaryMenuResult.data?.items?.length
    ? buildPublicMenuTree(primaryMenuResult.data.items)
    : [];

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
          desktop/tablet lẫn nút Tìm kiếm ở bottom nav (mobile) mở được panel.
          Bọc Suspense vì SearchToggle dùng useSearchParams — bắt buộc khi trang
          render tĩnh (ISR/SSG), nếu không build sẽ bail CSR toàn trang. */}
      <Suspense fallback={null}>
        <SearchToggle />
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
