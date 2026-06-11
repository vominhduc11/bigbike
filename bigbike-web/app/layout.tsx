import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { fontBarlow, fontBarlowCondensed } from "./fonts";
import "./globals.css";
import { WpHeader } from "@/components/wp/WpHeader";
import { WpFooter } from "@/components/wp/WpFooter";
import { WpThemeScripts } from "@/components/wp/WpThemeScripts";
import { WpMobileMenuController } from "@/components/wp/WpMobileMenuController";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { getPublicMenu } from "@/lib/api/public-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { ClientIntlProvider } from "@/components/providers/ClientIntlProvider";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import viMessages from "@/messages/vi.json";
import { FloatingChatLoader } from "@/components/layout/FloatingChatLoader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { MobileCartSheet } from "@/components/layout/MobileCartSheet";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { CompareProvider } from "@/lib/compare-context";
import { CompareBar } from "@/components/catalog/CompareBar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { HeaderUiProvider } from "@/components/layout/HeaderUiContext";
import { env } from "@/env";

export const metadata: Metadata = {
  metadataBase: new URL("https://bigbike.vn"),
  title: {
    default: "BigBike - Đồ Bảo Hộ Biker",
    template: "%s | BigBike",
  },
  description:
    "BigBike — chuyên đồ bảo hộ biker, gear touring, mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

const GTM_ID = env.NEXT_PUBLIC_GTM_ID;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Toàn bộ storefront dùng shell theme WP (mọi route đã port — xem lib/wp-theme-routes).
  // Shell render MỘT LẦN ở layout, KHÔNG đọc pathname/cookie ở server (giữ layout tĩnh để
  // route đạt ISR/SSG). Menu nạp bằng locale canonical `vi` (ISR theo tag "menus").
  let wpPrimaryNodes: HeaderNavNode[] = [];
  let wpFooterNodes: HeaderNavNode[] = [];
  const [primaryMenuResult, footerMenuResult] = await Promise.all([
    getPublicMenu("primary", DEFAULT_LOCALE),
    getPublicMenu("footer", DEFAULT_LOCALE),
  ]);
  wpPrimaryNodes = primaryMenuResult.data?.items?.length
    ? buildPublicMenuTree(primaryMenuResult.data.items)
    : [];
  wpFooterNodes = footerMenuResult.data?.items?.length
    ? buildPublicMenuTree(footerMenuResult.data.items)
    : [];
  return (
    <html lang={DEFAULT_LOCALE} className={`h-full antialiased ${fontBarlowCondensed.variable} ${fontBarlow.variable}`} suppressHydrationWarning>
      <body className="bb-theme min-h-full flex flex-col" suppressHydrationWarning>
        {GTM_ID && (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="GTM"
            />
          </noscript>
        )}
        <ClientIntlProvider initialMessages={viMessages}>
          <QueryProvider>
            <HeaderUiProvider>
              <CartProvider>
                <WishlistProvider>
                  <CompareProvider>
                    <WpHeader menuNodes={wpPrimaryNodes} />
                    <main className="bb-main pb-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
                    <div className="block md:hidden">
                      <MobileBottomNav />
                    </div>
                    {/* SiteHeader (chứa SearchToggle) không còn render — gắn panel tìm kiếm
                        React như "panel host" ở MỌI breakpoint, để cả WpSearchIcon (header
                        desktop/tablet) lẫn nút Tìm kiếm ở bottom nav (mobile) mở được panel.
                        renderTrigger={false} để không render nút trigger trùng WpSearchIcon.
                        Bọc Suspense vì SearchToggle dùng useSearchParams — bắt buộc khi trang
                        render tĩnh (ISR/SSG), nếu không build sẽ bail CSR toàn trang. */}
                    <Suspense fallback={null}>
                      <SearchToggle renderTrigger={false} />
                    </Suspense>
                    <MobileCartSheet />
                    <WpFooter footerNodes={wpFooterNodes} />
                    {/* JS theme WP (header hamburger/drawer/headroom/search/scrollToTop). */}
                    <WpThemeScripts />
                    <WpMobileMenuController />
                    <CompareBar />
                    <div className="bb-floating-chat-anchor fixed z-[660] bottom-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom)+80px)] md:bottom-[max(24px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] md:right-[max(24px,env(safe-area-inset-right))] pointer-events-none [&>*]:pointer-events-auto [[data-scroll-locked]_&]:hidden">
                      <FloatingChatLoader />
                    </div>
                  </CompareProvider>
                </WishlistProvider>
              </CartProvider>
            </HeaderUiProvider>
          </QueryProvider>
        </ClientIntlProvider>
      </body>
    </html>
  );
}
