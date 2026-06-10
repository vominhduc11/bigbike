import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { fontBarlow, fontBarlowCondensed } from "./fonts";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WpHeader } from "@/components/wp/WpHeader";
import { WpFooter } from "@/components/wp/WpFooter";
import { WpThemeScripts } from "@/components/wp/WpThemeScripts";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { getPublicMenu } from "@/lib/api/public-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { isWpThemeRoute } from "@/lib/wp-theme-routes";
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
  const locale = await getLocale();
  const messages = await getMessages();
  const pathname = (await headers()).get("x-pathname");
  const wpThemeRoute = isWpThemeRoute(pathname);

  // Header/footer WP được render MỘT LẦN ở layout (giống SiteHeader/SiteFooter),
  // không để mỗi trang tự dựng — tránh lệch CSS/JS giữa các trang và giữ cho
  // handler tương tác (hamburger/drawer/headroom) sống xuyên suốt khi điều hướng
  // SPA (header DOM không bị remount). Menu primary/footer nạp một lần tại đây.
  let wpPrimaryNodes: HeaderNavNode[] = [];
  let wpFooterNodes: HeaderNavNode[] = [];
  if (wpThemeRoute) {
    const [primaryMenuResult, footerMenuResult] = await Promise.all([
      getPublicMenu("primary", locale),
      getPublicMenu("footer", locale),
    ]);
    wpPrimaryNodes = primaryMenuResult.data?.items?.length
      ? buildPublicMenuTree(primaryMenuResult.data.items)
      : [];
    wpFooterNodes = footerMenuResult.data?.items?.length
      ? buildPublicMenuTree(footerMenuResult.data.items)
      : [];
  }
  return (
    <html lang={locale} className={`h-full antialiased ${fontBarlowCondensed.variable} ${fontBarlow.variable}`} suppressHydrationWarning>
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
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <HeaderUiProvider>
              <CartProvider>
                <WishlistProvider>
                  <CompareProvider>
                    {!wpThemeRoute && <SiteHeader />}
                    {wpThemeRoute && <WpHeader menuNodes={wpPrimaryNodes} />}
                    <main className="bb-main pb-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
                    <div className="block md:hidden">
                      <MobileBottomNav />
                    </div>
                    {/* Trên route WP, SiteHeader (chứa SearchToggle) bị ẩn — gắn lại
                        panel tìm kiếm React như "panel host" ở MỌI breakpoint, để cả
                        WpSearchIcon (header desktop/tablet) lẫn nút Tìm kiếm ở bottom nav
                        (mobile) mở được panel. renderTrigger={false} để không render nút
                        trigger riêng trùng với WpSearchIcon. */}
                    {wpThemeRoute && <SearchToggle renderTrigger={false} />}
                    <MobileCartSheet />
                    {!wpThemeRoute && <SiteFooter />}
                    {wpThemeRoute && <WpFooter footerNodes={wpFooterNodes} />}
                    {/* JS theme WP (header hamburger/drawer/headroom/search/
                        scrollToTop) — nạp cho MỌI route WP, không chỉ trang chủ. */}
                    {wpThemeRoute && <WpThemeScripts />}
                    <CompareBar />
                    <div className="bb-floating-chat-anchor fixed z-[660] bottom-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom)+80px)] md:bottom-[max(24px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] md:right-[max(24px,env(safe-area-inset-right))] pointer-events-none [&>*]:pointer-events-auto [[data-scroll-locked]_&]:hidden">
                      <FloatingChatLoader />
                    </div>
                  </CompareProvider>
                </WishlistProvider>
              </CartProvider>
            </HeaderUiProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
