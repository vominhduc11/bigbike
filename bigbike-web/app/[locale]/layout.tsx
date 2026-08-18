import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Script from "next/script";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FooterMobileGate } from "@/components/layout/FooterMobileGate";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { getPublicMenu } from "@/lib/api/public-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { ClientIntlProvider } from "@/components/providers/ClientIntlProvider";
import { isLocale, LOCALES, type Locale } from "@/i18n/locale";
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
import { getSiteOrigin } from "@/lib/utils/routes";
import { env } from "@/env";

const FAVICON_BASE = "/brand/favicon";
const absoluteAssetUrl = (path: string) => new URL(path, getSiteOrigin()).toString();

const sharedMetadata: Omit<Metadata, "title" | "description"> = {
  // Phải dùng CHUNG nguồn với canonical (lib/utils/routes.ts → NEXT_PUBLIC_SITE_URL,
  // fallback https://bigbike.vn). Đóng cứng bigbike.vn ở đây làm OG image và canonical
  // trỏ hai nơi khác nhau khi build thiếu biến môi trường — Dockerfile:26 mặc định
  // NEXT_PUBLIC_SITE_URL=http://localhost:3000 và biến này được nhúng lúc build.
  metadataBase: new URL(getSiteOrigin()),
  icons: {
    icon: [
      { url: absoluteAssetUrl(`${FAVICON_BASE}/favicon-16x16.png`), sizes: "16x16", type: "image/png" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/favicon-32x32.png`), sizes: "32x32", type: "image/png" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/favicon-96x96.png`), sizes: "96x96", type: "image/png" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/favicon.ico`), rel: "shortcut icon" },
    ],
    apple: [
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-57x57.png`), sizes: "57x57" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-60x60.png`), sizes: "60x60" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-72x72.png`), sizes: "72x72" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-76x76.png`), sizes: "76x76" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-114x114.png`), sizes: "114x114" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-120x120.png`), sizes: "120x120" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-144x144.png`), sizes: "144x144" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-152x152.png`), sizes: "152x152" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-180x180.png`), sizes: "180x180" },
    ],
    other: [
      { rel: "manifest", url: absoluteAssetUrl(`${FAVICON_BASE}/manifest.json`) },
      { rel: "msapplication-config", url: absoluteAssetUrl(`${FAVICON_BASE}/browserconfig.xml`) },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "Common" });
  return {
    ...sharedMetadata,
    title: { default: t("siteTitle"), template: "%s | BigBike" },
    description: t("siteDescription"),
  };
}

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
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  setRequestLocale(locale);
  const [messages, primaryMenuResult] = await Promise.all([
    getMessages({ locale }),
    getPublicMenu("primary", locale),
  ]);
  const primaryNodes: HeaderNavNode[] = primaryMenuResult.data?.items?.length
    ? buildPublicMenuTree(primaryMenuResult.data.items)
    : [];
  return (
    <html
      lang={locale}
      className="h-full antialiased"
    >
      <body className="bb-theme min-h-full flex flex-col pt-0!">
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
        <ClientIntlProvider locale={locale} messages={messages}>
          <QueryProvider>
            <HeaderUiProvider>
              <CartProvider>
                <AltSlugProvider>
                  <Header menuNodesVi={primaryNodes} menuNodesEn={primaryNodes} locale={locale} />
                  <main id="main-content" className="bb-main w-full">{children}</main>
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
                    <Footer locale={locale} />
                  </FooterMobileGate>
                  <SettingsFocusScroller />
                  <div className="bb-floating-chat-anchor fixed z-[var(--bb-z-floating)] pointer-events-none [&>*]:pointer-events-auto [[data-scroll-locked]_&]:hidden">
                    <FloatingChatLoader locale={locale} />
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

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
