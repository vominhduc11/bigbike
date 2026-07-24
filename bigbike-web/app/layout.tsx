import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { fontBarlowCondensed } from "./fonts";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FooterMobileGate } from "@/components/layout/FooterMobileGate";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { getPublicMenu } from "@/lib/api/public-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { ClientIntlProvider } from "@/components/providers/ClientIntlProvider";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";
import { FloatingChatLoader } from "@/components/layout/FloatingChatLoader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ScrollToTopFab } from "@/components/layout/ScrollToTopFab";
import { SettingsFocusScroller } from "@/components/layout/SettingsFocusScroller";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { MobileCartSheet } from "@/components/layout/MobileCartSheet";
import { CartProvider } from "@/lib/cart-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { HeaderUiProvider } from "@/components/layout/HeaderUiContext";
import { AltSlugProvider } from "@/components/i18n/AltSlugProvider";
import { env } from "@/env";

const FAVICON_BASE = "/brand/favicon";

export const metadata: Metadata = {
  metadataBase: new URL("https://bigbike.vn"),
  title: {
    default: "BigBike - Đồ Bảo Hộ Biker",
    template: "%s | BigBike",
  },
  description:
    "BigBike — chuyên đồ bảo hộ biker, gear touring, mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
  icons: {
    icon: [
      { url: `${FAVICON_BASE}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
      { url: `${FAVICON_BASE}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${FAVICON_BASE}/favicon-96x96.png`, sizes: "96x96", type: "image/png" },
      { url: `${FAVICON_BASE}/favicon.ico`, rel: "shortcut icon" },
    ],
    apple: [
      { url: `${FAVICON_BASE}/apple-icon-57x57.png`, sizes: "57x57" },
      { url: `${FAVICON_BASE}/apple-icon-60x60.png`, sizes: "60x60" },
      { url: `${FAVICON_BASE}/apple-icon-72x72.png`, sizes: "72x72" },
      { url: `${FAVICON_BASE}/apple-icon-76x76.png`, sizes: "76x76" },
      { url: `${FAVICON_BASE}/apple-icon-114x114.png`, sizes: "114x114" },
      { url: `${FAVICON_BASE}/apple-icon-120x120.png`, sizes: "120x120" },
      { url: `${FAVICON_BASE}/apple-icon-144x144.png`, sizes: "144x144" },
      { url: `${FAVICON_BASE}/apple-icon-152x152.png`, sizes: "152x152" },
      { url: `${FAVICON_BASE}/apple-icon-180x180.png`, sizes: "180x180" },
    ],
    other: [
      { rel: "manifest", url: `${FAVICON_BASE}/manifest.json` },
      { rel: "msapplication-config", url: `${FAVICON_BASE}/browserconfig.xml` },
    ],
  },
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
  // Shell render MỘT LẦN ở layout, KHÔNG đọc pathname/cookie ở server (giữ layout tĩnh để
  // route đạt ISR/SSG). Nạp cả 2 bản menu (vi + en, ISR theo tag "menus") — Header chọn
  // bản hiển thị theo locale ở client (cần cho 3 route EN-only /products|categories|news/
  // vốn không phụ thuộc cookie, xem ClientIntlProvider). Footer không còn nạp menu động
  // — nội dung hardcode trong Footer (2026-07-03).
  const [primaryMenuResult, primaryMenuResultEn] = await Promise.all([
    getPublicMenu("primary", DEFAULT_LOCALE),
    getPublicMenu("primary", "en"),
  ]);
  const primaryNodes: HeaderNavNode[] = primaryMenuResult.data?.items?.length
    ? buildPublicMenuTree(primaryMenuResult.data.items)
    : [];
  const primaryNodesEn: HeaderNavNode[] = primaryMenuResultEn.data?.items?.length
    ? buildPublicMenuTree(primaryMenuResultEn.data.items)
    : [];
  return (
    <html lang={DEFAULT_LOCALE} className={`h-full antialiased ${fontBarlowCondensed.variable}`} suppressHydrationWarning>
      <body className="bb-theme min-h-full flex flex-col pt-0!" suppressHydrationWarning>
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
        <ClientIntlProvider initialMessages={viMessages} enMessages={enMessages}>
          <QueryProvider>
            <HeaderUiProvider>
              <CartProvider>
                <AltSlugProvider>
                  <Header menuNodesVi={primaryNodes} menuNodesEn={primaryNodesEn} />
                  <main className="bb-main">{children}</main>
                  <div className="block md:hidden">
                    <MobileBottomNav />
                  </div>
                  {/* Gắn panel tìm kiếm React như "panel host" ở mọi breakpoint để cả header
                      desktop/tablet lẫn nút Tìm kiếm ở bottom nav (mobile) mở được panel.
                      renderTrigger={false} để không render nút trigger trùng.
                      Bọc Suspense vì SearchToggle dùng useSearchParams — bắt buộc khi trang
                      render tĩnh (ISR/SSG), nếu không build sẽ bail CSR toàn trang. */}
                  <Suspense fallback={null}>
                    <SearchToggle renderTrigger={false} />
                  </Suspense>
                  <MobileCartSheet />
                  <FooterMobileGate>
                    <Footer />
                  </FooterMobileGate>
                  <SettingsFocusScroller />
                  <div className="bb-floating-chat-anchor fixed z-[663] pointer-events-none [&>*]:pointer-events-auto [[data-scroll-locked]_&]:hidden">
                    <FloatingChatLoader />
                  </div>
                  <ScrollToTopFab />
                </AltSlugProvider>
              </CartProvider>
            </HeaderUiProvider>
          </QueryProvider>
        </ClientIntlProvider>
      </body>
    </html>
  );
}
